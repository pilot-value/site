/* assert-pay-rows.mjs — 「REAL PAY」（actual-pay）の約束を機械で確かめる。

   この画面は、このサイトで初めて **他人の一次データを1行ずつ見せる** 場所。
   1行＝1人で、しかも **給与を出した人は全員出る**（人数の門は無い）。

   ★2026-08-23、オーナー判断で次の3つが無くなった。
       ・k≧5 の門（5人そろった区分だけ出す）
       ・30日の遅延
       ・公開情報からの推定レンジの節（青）と、右の「選んだ区分」パネル

   ★2026-08-24、マイページを3枚（REAL PAY / DEEP PAY / VERIFIED PAY）に分けた。
     この画面は REAL PAY ＝「他のパイロットの実給与」だけを持つ。
       ・**機材（fleet）を返すのをやめた**（個人特定を避ける。契約②が元に戻った）
       ・**支給の内訳（ドーナツ）を DEEP PAY へ移した**。この画面は1度も描かない
       ・逆に、**数え上げ（今どれだけ集まっているか）を出すことにした**。
         出した人に「どれだけ集まっているか」が見えないと Give & Get が成立しない、
         というオーナー判断。新しく外へ出るのは
         **「今どれだけ集まっているか」と「直近1ヶ月でどれだけ増えたか」**の2つだけ
       ・**図を全部外した**（同じ日に、年収の分布の棒も落とした）。
         この画面に図は1つも無い。分布は DEEP PAY で作り直す
       ・数字カードは**3枚**（「一覧のパイロット」の枚を外した。
         行数は表の下の「全N件中」が言っているので二度言わない）。横に線画のアイコン
       ・表のいちばん右に**投稿時期**の列を足した。出るのは
         **5段の粗い区分の言葉だけ**（1ヶ月以内 / 3ヶ月以内 / 6ヶ月以内 / 1年以内 / それより前）。
         ⚠️ ここは守りを1段ゆるめたところ。**並べ替えの口も絞り込みの口も作らない**

   ここで見るのは7つ：

     ① 鍵の無い人には金額が1文字も出ない
        （db/pay-rows.sql が state:'locked' を返す。画面のモザイクではない）
     ② 準識別子は1つも画面に出ない
        機材・基地・在籍年数・年代・**投稿の日付そのもの**・原本の通貨・契約形態・国籍・識別子、
        そして**自由入力で打ち込まれた社名**。支給の内訳（comp）もここに戻った。
        ★2026-08-24、投稿の時期だけ**5段の粗い区分**で出すようにした（オーナー指示）。
          日付も年月も画面には出さない＝毒（2026-08-05）は毒のまま。
        ★この検査では、サーバが返さないはずのこれらを **わざと混ぜた行** を流し込み、
          画面のどこにも出ないことを見る。将来 r.base_iata を1つ足した人が即座に赤くなる
     ③ 金額はすべて有効数字2桁（表示通貨に換算したあとも）
     ④ 1行＝1人。表は1枚だけ
        ⚠️ 粒度を2つに分けた形へ戻さない（同じ人が両方に出て二重に数えたように見える）
     ⑤ 数え上げ（★2026-08-24 に方針が変わったところ）
        ・上の数字カード3枚は**本物の数字だけ**。読めないカードは**そのカードごと出さない**
          （埋めるための 0 を置かない＝画面に嘘の数字を作らない）
        ・「投稿」は必ず**表の行数以上**（サーバと画面が別々に数えていない証拠）
        ・ページ送りは**絞り込んだ後の総件数**を出す
        ・鍵が無い人・0件の人には帯ごと出ない
        ・表の中には今までどおり「◯件」「◯人」を1つも置かない
     ⑥ 通貨を切り替えても pv_pay_rows() を引き直さない
        （データは state に持つ。引き直すと切替のたびにサーバを叩く）
     ⑦ 並びに時間が無い
        ★**並び替えの口を作らない**。並びに投稿の新しさが乗ると、
          誰が最近出したかが読める（契約⑥に真っ向から反する）

   ★図はこの画面に**1つも無い**（2026-08-24、オーナー判断）。
     .ap-vcard / .ap-bar / .ap-you / .ap-ax も、表を右の細い列と並べていた
     2段組（.ap-cols / .ap-main / .ap-side）も無い。表は幅いっぱい。
     ⚠️ 「消した」であって「差し替えた」ではない。**別の図を置き直さない**。
     ⚠️ my_pay_reports() も引かない（引いていたのは分布の破線のためだけ）。

   ★もう1つ、消えたものが戻っていないことを見る：
     青のバッジ・推定レンジ・「5人」「30日」の約束・招待カードの差込口・
     機材の絞り込み・行を押すドーナツ・賞与の列・「賞与ありのみ」。
     文言は特に静かに戻る（「5人そろうと出ます」は、今は嘘）。

   ⚠️ 偽物 Supabase の rpc は本物と同じ「then だけを持つ箱」にしてある。
      async にすると本番に無い .catch が生えて、本番だけ真っ白になる穴が開く
      （assert-referral.mjs / assert-conditions.mjs に経緯あり）。

   実行: node assert-pay-rows.mjs
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない。
*/
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const BASE = 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* CSS / JS のコメントを落としてから中身を見る。
   ★どのファイルも「何を消したか・何を戻さないか」をコメントで説明している。
     素朴に grep すると、説明を書いた人が赤くなる（＝説明を消すのが直し方になる）。 */
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, ' ');
const nohtmlcomment = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ');

// ════════════════════════════════════════════════════════════════
// 0. ソースの検査（ブラウザを開かなくても分かること）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ソース ════');

const JA = read('actual-pay.html');
const EN = read('en/actual-pay.html');
const JS = read('actual-pay.js');
const CSS = read('actual-pay.css');
const SQL = read('db/pay-rows.sql');

for (const [name, raw] of [['ja', JA], ['en', EN]]) {
  const html = nohtmlcomment(raw);
  ok(/<meta\s+name="robots"\s+content="noindex/.test(html),
     `${name}: 検索に出さない（noindex）`);
  ok(/<link\s+rel="icon"/.test(html), `${name}: favicon を宣言している`);
  ok(/fonts\.googleapis\.com\/css2/.test(html), `${name}: Inter を読んでいる`);
  ok(/<title>[^<]+<\/title>/.test(html), `${name}: title が空でない`);
  ok(!/pv-founding/.test(html), `${name}: FOUNDING の板を置かない（あれは profile.html だけ）`);
  /* ★2026-08-24 に**もう一度**反転。支給の内訳（ドーナツ）はこの画面から外して
       DEEP PAY の担当にした。残る図は分布の棒1枚で、それは actual-pay.js が自前で描く。
       ⚠️ pay-viz.css は暗い前提の .pt-* を持っていて、actual-pay.css と詳細度が同じ（0,2,0）。
          読み込みを戻すと、明るい画面に暗い前提の色が漏れる。 */
  const at = (file) => html.search(new RegExp('(?:src|href)="[^"]*' + file.replace('.', '\\.') + '"'));
  ok(at('pay-viz.css') < 0, `${name}: ★pay-viz.css を読んでいない`);
  ok(at('pay-viz.js') < 0, `${name}: ★pay-viz.js を読んでいない`);
  ok(at('actual-pay.css') >= 0 && at('actual-pay.js') >= 0,
     `${name}: actual-pay.css / actual-pay.js は読んでいる`);

  /* 結果の入れ物は「開始タグ自体」に pv-no-cur。currency.js の自動走査に
     金額を触らせない（通貨ごとに2桁へ丸め直すのはこちらの仕事）。 */
  const m = html.match(/<div[^>]*id="ap-rows"[^>]*>/);
  ok(!!m && /\bpv-no-cur\b/.test(m[0]),
     `${name}: #ap-rows の開始タグに pv-no-cur が付いている`, m ? m[0] : '(タグが無い)');

  /* ★消したものが戻っていないこと。 */
  ok(!/id="ap-pub"/.test(html), `${name}: ★公開情報からの推定レンジの節が無い`);
  ok(!/ap-badge--pub/.test(html), `${name}: ★青（推定）のバッジが無い`);
  ok(!/ap-ref-slot/.test(html), `${name}: ★招待カードの差込口が無い`);

  /* 絞り込みは帯1つ。打ち込み1つ＋プルダウン2つ＋解除。
     ★機材で絞る口は無い（列に出していないものを絞れると逆算できる）。 */
  ok(/id="ap-filter"[^>]*\shidden/.test(html) || /\shidden[^>]*id="ap-filter"/.test(html),
     `${name}: 絞り込みの帯は既定で隠れている（行が無いときに空の選択肢を出さない）`);
  for (const id of ['ap-q', 'ap-air', 'ap-pos', 'ap-clear']) {
    ok(html.includes('id="' + id + '"'), `${name}: #${id} がある`);
  }
  ok(!html.includes('id="ap-fleet"'), `${name}: ★機材で絞る口が無い`);

  /* ★数え上げのカード（2026-08-24）。入れ物だけ HTML にあり、中身は JS が入れる。
     既定で hidden ＝ 鍵が無い人・0件の人に空の枠を見せない。 */
  ok(/id="ap-stats"[^>]*\shidden/.test(html) || /\shidden[^>]*id="ap-stats"/.test(html),
     `${name}: 数え上げのカードの入れ物は既定で隠れている`);

  /* ★並び替えの口を作らない。並びに投稿の新しさが乗ると、誰が最近出したかが読める
     （契約⑥「並びに時間が無い」に真っ向から反する）。
     ★2026-08-24 に投稿時期の列を足したので、**その列で並べ替える／絞る口**も
       ここで一緒に見張る。列に出したものは、絞れると逆算の足がかりになる。 */
  for (const w of ['ap-sort', '新しい順', 'Newest', 'id="ap-order"',
                   'id="ap-age"', 'data-ap-age', 'ap-recent']) {
    ok(!html.includes(w), `${name}: ★並び替え（${w}）が無い`);
  }
  /* ★賞与の列も「賞与ありのみ」の絞りも作らない（絞った行数が生の人数になる）。 */
  for (const w of ['ap-bonus', 'bonus-only', '賞与ありのみ', 'With bonus only']) {
    ok(!html.includes(w), `${name}: ★${w} が無い`);
  }

  /* 読み込み順。pv-referral.js が lang-toggle.js より後だと、
     英語設定の人が /en/ へ飛ばされる時に ?ref= が丸ごと消える。
     ★この画面にカードは出さないが、?ref= を持ち回る仕事は残っている。 */
  const iRef = html.indexOf('pv-referral.js');
  const iLang = html.indexOf('lang-toggle.js');
  ok(iRef > -1 && iLang > -1 && iRef < iLang,
     `${name}: pv-referral.js を lang-toggle.js より前に読む`, `${iRef} / ${iLang}`);

  /* 社ロゴの対応表。★actual-pay.js より前に読まないと、全社が頭2文字の札になる
     （落ちはしないので、絵を見ない限り誰も気づかない）。 */
  /* ★<script src> の位置で見る。ファイル名は本文の説明にも出るので、
     素の indexOf だと解説の一行を掴んで順番を取り違える。 */
  const srcAt = (file) => {
    const m = html.match(new RegExp('<script[^>]+src="[^"]*' + file + '"'));
    return m ? html.indexOf(m[0]) : -1;
  };
  const iLogo = srcAt('airline-logos\\.js');
  const iAp = srcAt('actual-pay\\.js');
  ok(iLogo > -1, `${name}: 社ロゴの対応表（airline-logos.js）を読んでいる`);
  ok(iAp > -1, `${name}: actual-pay.js を読んでいる`);
  ok(iLogo > -1 && iAp > iLogo,
     `${name}: ★airline-logos.js は actual-pay.js より前`, `${iLogo} / ${iAp}`);

  /* ★戻さないと決めたもの（経験年数・提出日・レポートID・Verified だけの絞り込み）。
     8人規模では、この4つはどれも1つ足すだけで本人に当たる。 */
  for (const w of ['ap-exp', 'ap-date', 'ap-id', 'verified-only']) {
    ok(!html.includes(w), `${name}: ★${w} が無い`);
  }
}

/* ★準識別子を受け取る場所がソースに1つも無いこと。
   実行時の検査（下）と二重にしてある。あちらは「出ていない」、こちらは「持っていない」。 */
{
  const bad = decomment(JS).match(
    /base_iata|seniority|age_bucket|period_month|period_year|created_at|proof_hash|airline_other|contract_type|tax_country|nationality|annual_total_orig|verify_level/g);
  ok(!bad, '準識別子の名前が actual-pay.js に1つも無い', bad ? bad.join(',') : '');
}

/* 金額での並べ替えと「Verified だけ」の絞り込みを作らない。
   前者はこの画面をランキングにする。後者は絞った行数＝検証済みの人数という生カウントになる。 */
{
  const j = decomment(JS);
  ok(!/sort[^)]*annual_usd|annual_usd[^)]*sort|sortBy|data-sort/.test(j),
     '金額で並べ替える仕掛けが無い');
  ok(!/filter[^)]*\.verified|verified[^)]*filter|ap-vf-only|onlyVerified/.test(j),
     '「Verified だけ」の絞り込みが無い');
  ok(/localeCompare/.test(j), '絞り込みの選択肢は名前順（localeCompare）である');
  ok(!/PVReferral|mountInvite|mountCohort/.test(j),
     '★招待カードをこの画面に描かない（my_cohort_gap の「あと2人で見える」はもう合わない）');
  ok(!/renderPub|ap-range|ap-plist|salaryRange/.test(j),
     '★推定レンジを描く関数が残っていない');
  ok(!/grain|ap-panel|ap-tcol/.test(j), '★2粒度と右パネルの部品が残っていない');
  for (const w of ['ap-exp', 'ap-date', 'ap-id', 'verified-only', 'Verifiedのみ']) {
    ok(!j.includes(w), `★actual-pay.js に ${w} が無い`);
  }
  /* ★並び替えと賞与（2026-08-24 に「作らない」と決めたもの）。
     ★投稿時期の列も同じ。言葉にして出すだけで、並べ替えも絞り込みも作らない。 */
  for (const w of ['ap-sort', 'ap-order', 'newest', '新しい順', 'ap-bonus', 'bonus',
                   'id="ap-age"', 'data-ap-age', 'S.fAge']) {
    ok(!j.includes(w), `★actual-pay.js に ${w} が無い`);
  }
  ok(!/sort[^)]*\.age\b|\.age[^)]*sort/.test(j), '★投稿時期で並べ替える仕掛けが無い');
  ok(!/S\.f[A-Za-z]*\s*&&\s*r\.age|r\.age\s*!==/.test(j),
     '★投稿時期で絞り込む仕掛けが無い');
  /* ★投稿時期は5段の言葉だけを持つ。日付を組み立てる道具を持ち込まない。 */
  ok(/T\.age\[/.test(j) && /ageName\(/.test(j),
     '★投稿時期は段の番号（0〜4）を言葉にするだけ');
  ok(!/toLocaleDateString|new Date\(|getFullYear|getMonth/.test(j),
     '★日付を組み立てる道具をこの画面が1つも持っていない');
  /* ★支給の内訳（ドーナツ）は DEEP PAY の担当。この画面からは呼ばない。 */
  ok(!/PVViz|pt-donut|renderComp|\bcomp\b/.test(j),
     '★内訳（comp／PVViz）をこの画面が1文字も持っていない');
  /* ★2026-08-24、図を全部外した。分布の棒も、その部品も、2段組も残っていない。
     ⚠️ 分布は DEEP PAY で作り直す。ここに別の図を置き直さない。 */
  for (const w of ['renderViz', 'vizDist', 'myAnnual', 'ap-vcard', 'ap-plot',
                   'ap-bar', 'ap-you', 'ap-ax', 'ap-cols', 'ap-main', 'ap-side']) {
    ok(!j.includes(w), `★actual-pay.js に ${w} が無い（図は外した）`);
  }
  /* ★my_pay_reports は「本人の行しか返さない関数」。使い道は分布の破線だけだった。
     図が無くなった以上、この画面は本人の明細を1度も引かない。 */
  ok(!/my_pay_reports|mineAll|loadMine/.test(j),
     '★本人の明細（my_pay_reports）をこの画面が引かない');
  /* ★2026-08-24、オーナー判断で件数を出すことにした。
     出すのは「絞り込んだ後の行数」で、絞り込みを解いた全体は上のカードが持つ。 */
  ok(/data-ap-page/.test(j), 'ページ送りがある（10件ずつ）');
  ok(/pgRange/.test(j), '★ページ送りが件数を出す（全N件中 a〜b件）');
  ok(/pageList\(/.test(j), '★数字のページ番号を作る（多いときは … で畳む）');
  ok(!/pgOf/.test(j), '★古い「◯ / ◯ページ」の文言が残っていない');
  /* ★数え上げは JS が勝手に作らない。サーバ（stats）か rows を数えるかの2つだけ。 */
  ok(/S\.stats/.test(j), '★数え上げはサーバの stats から受け取る');
  ok(!/stats\s*=\s*\{[^}]*0/.test(j),
     '★数が読めないときに 0 を置いていない（カードごと出さない）');
  /* ★月あたりは「画面に出ている年収」から作る。生の値から割ると、
     画面の月額 × 12 が画面の年収と合わない数字になる。 */
  ok(!/money\(\s*r\.annual_usd\s*\/\s*12\s*\)/.test(j),
     '★月あたりを生の年収から割っていない');
  ok(/moneyMonth\(/.test(j), '月あたりは moneyMonth() が作る（画面の年収 ÷ 12）');
}

/* pay-viz.js が root で1回だけ持つ2式（db/test-form-contract.mjs が見張っている）。
   この画面に写すと、あちらが「2回ある」と言って落ちる。 */
{
  const j = decomment(JS);
  ok(!/\(\s*ann\s*-\s*bonus\s*\)\s*\/\s*12/.test(j), '(ann - bonus) / 12 を写していない');
  ok(!/\bn\s*\+\s*d\b/.test(j), 'n + d を写していない');
}

/* バッジは .ap-* で持つ。lp.css の .pv-badge を2ファイルで定義するとドリフトする。 */
{
  const c = decomment(CSS);
  ok(!/\.pv-badge/.test(c), 'actual-pay.css が .pv-badge 系を再定義していない');
  /* ★見出しの札そのものを消した（2026-08-24）。ページ全体に「本人記録」と貼ると、
     出典が ✓ Verified の行と食い違う。出典は行ごとの .ap-vf / .ap-vf-no が持つ。 */
  ok(!/\.ap-badge--actual/.test(c), '★見出しの札（橙）が残っていない');
  ok(/\.ap-vf-no/.test(c) && /\.ap-vf\{/.test(c), '出典の札は行ごとの2つだけ');
  ok(!/\.ap-badge--pub/.test(c) && !/--pv-blue/.test(c),
     '★青（推定）の見た目がこの画面に1つも残っていない');
  ok(!/transition\s*:\s*all/.test(c), 'transition-all を使っていない');
  ok(/--pv-orange-ink/.test(c), '色はトークンから取っている（ブランド色を発明していない）');
  /* display:flex は UA の [hidden]{display:none} に勝つ。帯と枠の両方に要る。 */
  ok(/\.ap-filter\[hidden\]/.test(c) && /\.ap-f\[hidden\]/.test(c),
     '★[hidden] を明示している（flex は UA の hidden に勝つ）');
  /* ★2026-08-24、図と2段組の見た目を丸ごと落とした。
     ⚠️ 残しておくと「使われていない CSS」ではなく「戻す下地」になる。 */
  for (const w of ['.ap-viz', '.ap-vcard', '.ap-plot', '.ap-bw', '.ap-bar',
                   '.ap-you', '.ap-ax', '.ap-vsub', '.ap-cols', '.ap-main', '.ap-side']) {
    ok(!c.includes(w), `★actual-pay.css に ${w} が残っていない（図は外した）`);
  }
  /* ★カードは3枚（4枚のときの repeat(4,…) が残っていると、3枚が左に寄る）。 */
  ok(/\.ap-stats\{[^}]*repeat\(3,/.test(c), '★カードの並びは3列');
  ok(/\.ap-st-i\{/.test(c), '★カードのアイコンの下地（丸）がある');
  ok(/\.ap-age\{/.test(c), '★投稿時期の列の見た目がある');
}

/* サーバ側。1行＝人の粒度なので anon には絶対に開かない。 */
{
  const i0 = SQL.indexOf('create or replace function public.pv_pay_rows()');
  const i1 = SQL.indexOf('revoke all on function public.pv_pay_rows()');
  const FN = i0 > -1 && i1 > i0 ? SQL.slice(i0, i1) : '';
  ok(!!FN, 'pv_pay_rows の定義が読めた');
  ok(/create or replace function public\.pv_pay_rows\(\)/.test(SQL),
     'pv_pay_rows は引数を1つも取らない（総当たり面を作らない）');
  ok(/grant execute on function public\.pv_pay_rows\(\) to authenticated/.test(SQL),
     'ログインした人だけが実行できる');
  ok(!/grant\s+execute[^;]*to[^;]*\banon\b/i.test(SQL),
     '★anon には1つも実行させない（pay_benchmarks と違って粒度が人なので開けない）');
  ok(/access_until/.test(FN), '鍵（access_until）を見ている');
  ok(/pv_sig2\(/.test(FN), '有効数字2桁に丸めている');
  /* ★2026-08-25、オーナー指示で「出した順（古いほうが上）」にした。
     前は md5(人のキー) 順で、並びが中身と何も関係していないのが取り柄だった。
     ゆるめたのは並びだけ。**時刻そのものを返さないこと**と
     **画面から並べ替えられないこと**は下で見張り続ける。 */
  ok(/order by p\.last_at desc, md5\(p\.pkey\)/.test(FN),
     '★並びは新しい順（同着でも揺れないよう md5 を第2キーに残している）');
  ok(!/'last_at'/.test(FN),
     '★並べるのに使う時刻は行に入れていない（入れると秒単位の提出時刻が漏れる）');
  ok(!/>=\s*5|having\s+count/.test(FN), '★人数の門が残っていない（全員出す）');
  ok(!/interval\s*'30 days'|30 day/.test(FN), '★30日の遅延が残っていない');
  ok(!/percentile_cont\(0\.[19]\)/.test(FN), '★p10-p90 のクリップが残っていない');
  /* ★2026-08-25、オーナー指示「ちゃんと航空会社名書いて」で、打ち込まれた社名を
     語彙に当ててから使うようにした（pv_airline_resolve）。出口は pv_airlines の
     コードか 'other' の2つだけ＝打ち込まれた文字列そのものは1文字も通らない。
     resolve の括弧の中を消してから、素の airline_other が残らないことを見る。 */
  ok(/pv_airline_resolve\(/.test(FN),
     '★打ち込まれた社名は語彙に当ててから使っている');
  ok(!/airline_other/.test(FN.replace(/pv_airline_resolve\([^)]*\)/g, '')),
     '★語彙に当てずに自由入力の社名を読んでいる場所が無い');
  ok(/pv_airline_resolve\(v\.airline\)/.test(FN),
     '★口コミの社名の欄も無条件に語彙へ当てている（あそこはコードとは限らない）');
  {
    const i = SQL.indexOf('create or replace function public.pv_airline_resolve');
    const RES = i > -1 ? SQL.slice(i, SQL.indexOf('$$;', i)) : '';
    ok(!!RES && /pv_airlines/.test(RES) && !/like|similar to/i.test(RES),
       '★寄せ先は語彙だけ。前方一致・部分一致で当てていない（社名を取り違えない）');
    ok(/revoke all on function public\.pv_airline_resolve\(text\) from public, anon, authenticated/
       .test(SQL), '★社名を寄せる関数は誰にも開いていない');
  }
  ok(/group by pkey, airline, pos/.test(FN), '★1行＝1人にまとめている');
  ok(!/\bfleet\b/.test(FN), '★機材（fleet）は読んでも返してもいない');
  /* 集計側（pay_benchmarks）の k≧5 は今も生きている。こちらを一緒に外さない。 */
  ok(/pg_get_viewdef\(bench\) like '%>= 5%'/.test(SQL),
     '★集計（pay_benchmarks）の k≧5 は今も見張っている');

  /* ★登録前の預かりも混ぜる（2026-08-23）。ここを外すと、まだ会員になっていない人の
     ぶんが1行も出ない＝「出したのに載っていない」に見える。 */
  ok(/pay_reports_pending/.test(FN), '★登録前の預かりも読んでいる');
  ok(/claimed_at is null/.test(FN),
     '★本棚へ移した預かりは読まない（同じ人が二重に出ない）');
  ok(/pv_pending_usd\(/.test(FN), '預かりの年換算は pv_pending_usd() が出す');
  /* ★2026-08-25。前はここで「payload の自由入力社名を読まない」を見ていたが、
     オーナー指示で読むようになった。読んだうえで必ず語彙に当てる（出口はコードか 'other'）。
     素で読んでいないことは上の「語彙に当てずに…」がまとめて見ている。 */
  ok(/pv_airline_resolve\(q\.payload->>'airline_other'\)/.test(FN),
     '★預かりの自由入力社名も語彙に当ててから使っている');

  /* ★常識の幅（⑦）。k≧5 とクリップを外したので、打ち間違いを止めるのはここだけ。 */
  ok(/usd between 10000 and 700000/.test(FN),
     '★常識の幅（年 $10,000〜$700,000）が効いている');

  /* pv_pending_usd は誰にも開かない（pv_pay_rows の中からだけ呼ぶ）。
     開くと payload を渡して年収を計算させる面ができる。 */
  ok(/revoke all on function public\.pv_pending_usd\(jsonb\) from public, anon, authenticated/
       .test(SQL),
     '★預かりの換算は誰にも開いていない');
  ok(!/grant execute on function public\.pv_pending_usd/.test(SQL),
     '★預かりの換算に grant が無い');
  {
    const j0 = SQL.indexOf('create or replace function public.pv_pending_usd(');
    const j1 = SQL.indexOf('revoke all on function public.pv_pending_usd(');
    const PF = j0 > -1 && j1 > j0 ? SQL.slice(j0, j1) : '';
    ok(!!PF, 'pv_pending_usd の定義が読めた');
    /* ★年換算の定義は pv_annual_total にしか無い。ここに式を書き写すと、
       本棚と預かりで同じ明細から違う年収が出る。 */
    ok(/public\.pv_annual_total\(/.test(PF),
       '★年換算の式を書き写さず pv_annual_total() を呼んでいる');
    ok(!/airline_other|proof_hash|ip_day_hash|claim_token/.test(PF),
       '★換算のときも社名・同定キーを読まない');
  }

  /* ★comp（内訳の割合）。2026-08-24 に**返すのをやめた**。
     支給の内訳は DEEP PAY の担当で、あちらは1人ずつではなく複数の投稿を集計して出す。
     これで契約②が元の「準識別子ゼロ」に戻った。
     ⚠️ 3つの関数（pv_pay_comp / pv_pct5 / pv_pending_comp）の**定義は残してある**。
        DEEP PAY で使うため。定義が残っているぶん、誰にも開いていないことを下で見る。 */
  ok(!/'comp'/.test(FN), '★内訳の割合（comp）を返していない');
  ok(!/pv_pay_comp\(|pv_pct5\(|pv_pending_comp\(/.test(FN),
     '★pv_pay_rows が割合を作る3つを呼んでいない');
  ok(/revoke all on function public\.pv_pay_comp\([^)]*\) from public, anon, authenticated/
       .test(SQL),
     '★pv_pay_comp は誰にも開いていない');
  ok(/revoke all on function public\.pv_pct5\(numeric\[\]\) from public, anon, authenticated/
       .test(SQL),
     '★pv_pct5 は誰にも開いていない');
  ok(/revoke all on function public\.pv_pending_comp\(jsonb\) from public, anon, authenticated/
       .test(SQL),
     '★預かりの割合も誰にも開いていない');
  ok(!/grant execute on function public\.pv_(pay_comp|pct5|pending_comp)/.test(SQL),
     '★割合を作る3つに grant が1つも無い');
  {
    const k0 = SQL.indexOf('create or replace function public.pv_pay_comp(');
    const k1 = SQL.indexOf('revoke all on function public.pv_pay_comp(');
    const CF = k0 > -1 && k1 > k0 ? SQL.slice(k0, k1) : '';
    ok(!!CF, 'pv_pay_comp の定義が読めた');
    /* ★現物支給の社宅は現金ではない（pv_annual_total と同じ扱い）。 */
    ok(/housing_type[^;]*allowance/.test(CF),
       "★住宅は housing_type='allowance' のときだけ数える");
    /* ★2026-08-23 に本番で踏んだ。where で外しても SELECT の割り算が先に走りうる。
       割り算を書いた行には必ず nullif が同じ行にあること。 */
    {
      /* ★SQL のコメントを先に落とす。/* … *​/ の中に「/」があると全部拾ってしまう。 */
      const body = CF.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
      const raw = body.split('\n').filter((l) => l.includes('/'));
      const nonull = raw.filter((l) => !/nullif\(/.test(l));
      ok(raw.length > 0 && nonull.length === 0,
         '★割り算の行は必ず nullif で包む（division by zero を踏んだ）',
         nonull.join(' | ').slice(0, 160));
    }
  }
  /* ★数え上げ（2026-08-24）。
     カード3枚のうち2枚（投稿の件数・直近1ヶ月の件数）はサーバでしか数えられない。
     ⚠️ 一覧と**同じ材料**（sane）から数えること。別々に数えると
        「126件なのに表は60行」の説明がつかなくなる。 */
  ok(/'stats'/.test(FN), '★数え上げ（stats）を返している');
  ok(/from sane/.test(FN), '★数え上げは一覧と同じ材料（sane）から数えている');
  /* ★2026-08-25、窓を暦の月から**直近1ヶ月**に変えた（オーナー指示）。
     date_trunc に戻すと毎月1日に 0 へ落ちるうえ、表の右端の段0（「1ヶ月以内」）と
     境目がずれる。両方が同じ now() - interval '1 month' であることを見る。 */
  ok(/count\(\*\) filter \(where cat >= now\(\) - interval '1 month'\)/.test(FN),
     "★直近1ヶ月ぶんを数えている（暦の月に戻っていない）");
  ok(!/date_trunc\('month'/.test(FN), '★暦の月（date_trunc）で数えていない');
  ok(/max\(cat\) >= now\(\) - interval '1 month'/.test(FN),
     '★表の段0（1ヶ月以内）とカードが同じ境目を使っている');
  /* ★数えるために投稿時刻を読むが、行としては返さない（契約⑥・②）。 */
  ok(!/'created_at'/.test(FN) && !/'cat'/.test(FN),
     '★数え上げに使う投稿時刻を、行としては返していない');
  /* ★並べるほうに投稿時刻が入っていないこと。
     ⚠️ [^;] で拾うと関数まるごと1つの塊になる（SQL の途中に ; が無い）。
        数えるための `filter (where cat >= …)` まで当たって、正しいものが赤くなる。
        order by は1行に収まっているので、その行の中だけを見る。 */
  ok(!/order by\s[^\n]*\bcat\b/.test(FN), '★投稿時刻で並べていない',
     (FN.match(/order by\s[^\n]*/g) || []).join(' / ').slice(0, 160));
  /* ★鍵が無い人にも「数」と「本人が何を出したか」は渡す（2026-08-25 オーナー判断）。
       ⚠️ 渡さないのは **行だけ**。ここが逆になっていないことを見る。 */
  {
    ok(/'rows',\s*case when v_open then l\.j else '\[\]'::jsonb end/.test(FN),
       '★鍵が無いときに返る rows は空の配列（1バイトも行を返さない）',
       (FN.match(/'rows',[^\n]*/g) || []).join(' / '));
    ok(!/return v_out;/.test(FN.slice(0, FN.indexOf("'contributors'"))),
       '★locked でも途中で return せず、最後の1つの select まで進む');
    ok(/'contributors'/.test(FN), '★給与を出したユニークな人数を返す（DEEP PAY の分母）');
    ok(/'give',\s*public\.pv_my_give\(\)/.test(FN),
       '★本人が何を出したか（basic / detailed / payslip）を返す');
    /* ★①（100人）と②（本人の内訳）は別の材料から出ている。 */
    /* ★数え方は pv_deep_contributors() 1つだけが持つ（2026-09-01 に 1-f から移した）。
         同じ「N / 100人」を左メニューの札（pv_give_progress）も DEEP PAY の門も出すので、
         一覧の中に式を書き戻すと**画面によって違う数**になる。
         これは静かに壊れる ── どちらの画面も普通に動いたまま数だけずれる。
         ⚠️ pv_contributors()（1-f・proof_hash 単位）ではない。あちらは2社に出した
            1人を2人と数える。画面は「パイロットが100人」なので実人物で数える。 */
    ok(/contrib as \(\s*(--[^\n]*\n\s*)*select public\.pv_deep_contributors\(\) as n/.test(FN),
       '★一覧は人数の式を書き写さず pv_deep_contributors() を呼んでいる',
       FN.slice(FN.indexOf('contrib as'), FN.indexOf('contrib as') + 300));
    const CTB = (function () {
      const a = SQL.indexOf('create or replace function public.pv_contributors()');
      const b = SQL.indexOf('revoke all on function public.pv_contributors()');
      return a > -1 && b > a ? SQL.slice(a, b) : '';
    })();
    ok(!!CTB, '★人数を数える関数（pv_contributors）がある');
    ok(/proof_hash/.test(CTB) && /pay_reports_pending/.test(CTB) && /ip_day_hash/.test(CTB),
       '★人数は未引き取りの預かりも数える（出したのに数に入らない人を作らない）', CTB.slice(0, 200));
    ok(/claimed_at is null/.test(CTB),
       '★本棚へ移った預かりは二重に数えない', CTB.slice(0, 200));
    ok(/revoke all on function public\.pv_contributors\(\) from public, anon, authenticated/.test(SQL),
       '★人数を数える関数は誰にも開いていない');
  }

  /* ★左メニューの札の口（2026-08-25）。整数1つと真偽3つだけを返し、
       一覧（pv_pay_rows）を引かずに済ませるためだけに在る。
       ⚠️ 中身を書き写したら、ここが2つ目の数え方になる。 */
  {
    const i2 = SQL.indexOf('create or replace function public.pv_give_progress()');
    const i3 = SQL.indexOf('revoke all on function public.pv_give_progress()');
    const PG = i2 > -1 && i3 > i2 ? SQL.slice(i2, i3) : '';
    ok(!!PG, '★札の口（pv_give_progress）がある');
    ok(/public\.pv_deep_contributors\(\)/.test(PG) && /public\.pv_my_give\(\)/.test(PG),
       '★札の口は中身を書き写さず、2つの関数をそのまま呼ぶ', PG.slice(0, 200));
    /* ★札とゲートが同じ数え方であること（2026-09-01）。ここが 1-f に戻ると
         「表示は100人なのに DEEP PAY が開かない」が起きる。 */
    ok(!/public\.pv_contributors\(\)/.test(PG),
       '★札は proof_hash 単位（pv_contributors）では数えない', PG.slice(0, 200));
    ok(!/pay_reports|reviews_v2|annual|usd/.test(PG),
       '★札の口は表も金額も自分では触らない', PG.slice(0, 200));
    ok(/where auth\.uid\(\) is not null/.test(PG),
       '★ログインしていない人には何も返さない（0 を置いて埋めない）', PG.slice(0, 200));
    ok(/revoke all on function public\.pv_give_progress\(\) from public, anon/.test(SQL)
       && /grant execute on function public\.pv_give_progress\(\) to authenticated/.test(SQL),
       '★札の口は anon に開かず、ログインした人にだけ開く');
  }
  /* ★pv_my_give は誰にも開かない（security definer の中からしか読まれない）。 */
  ok(/revoke all on function public\.pv_my_give\(\) from public, anon, authenticated/.test(SQL),
     '★pv_my_give は誰にも開いていない');

  /* ★契約ヘッダ。②が「準識別子ゼロ」に戻り、数え上げを出した理由が日付つきで書いてある。 */
  {
    const head = SQL.slice(0, SQL.indexOf('create or replace'));
    ok(/準識別子/.test(head), '★契約ヘッダの②が「準識別子ゼロ」に戻っている');
    ok(/2026-08-24/.test(head) && /数え上げ/.test(head),
       '★数え上げを出すことにした日付と理由が契約ヘッダに書いてある');
  }
}

/* サイドナビは patch-side-nav.mjs が1か所から書く。手で足すとドリフトする。 */
{
  let out = '', code = 0;
  try { out = execFileSync(process.execPath, ['patch-side-nav.mjs', '--check'],
                           { cwd: new URL('.', import.meta.url), encoding: 'utf8' }); }
  catch (e) { code = 1; out = String((e.stdout || '') + (e.stderr || '')); }
  ok(code === 0, '★サイドナビが全ページで1バイトも食い違わない（patch-side-nav.mjs --check）',
     out.trim().split('\n').slice(-3).join(' / '));
}

/* ★左メニューの並び（2026-08-24 オーナー指定）。
     REAL PAY → DEEP PAY → VERIFIED PAY。
   ★後ろ2つはまだページが無い。**リンクにしない。**
     リンクにすると assert-links.mjs が 404 で落ちるし、押した人が行き止まりに落ちる。
   ⚠️ href の無い <a> は「押せそうに見えるのにキーボードから触れない」＝いちばん悪い形。
   ★2026-08-25、<span aria-disabled="true"> をやめて **<button type="button">** にした。
     オーナー指示「未解放の場合は lock 状態を表示してクリック可能にし、
     クリック後に何を Give すると何が Get できるかを説明する」。
     <button> なら 404 も作らず、キーボードからも掴めて、押すと説明が出せる。
     ⚠️ <span aria-disabled> に戻すと、押せる約束が黙って消える。 */
for (const [name, file] of [['ja', 'actual-pay.html'], ['en', 'en/actual-pay.html']]) {
  const html = read(file);
  const i = html.indexOf('class="mr-side"');
  const nav = i < 0 ? '' : html.slice(i, html.indexOf('</nav>', i));
  ok(nav.length > 0, `${name}: 左メニューが読めた`);

  /* ★属性は開きタグ**全体**を掴む。type="button" は class より前に出るので、
       class の後ろだけを見ていると「button なのに type が無い」に見える。 */
  const items = Array.from(nav.matchAll(/<(a|span|button)(\s[^>]*class="mr-side-a[^"]*"[^>]*)>([\s\S]*?)<\/\1>/g))
    .map((m) => ({ tag: m[1], attr: m[2], body: m[3],
                   label: ((m[3].match(/<span>([^<]+)<\/span>/) || [])[1] || '').trim() }));
  const labels = items.map((x) => x.label);
  const at = (s) => labels.indexOf(s);

  ok(at('REAL PAY') >= 0 && at('DEEP PAY') >= 0 && at('VERIFIED PAY') >= 0,
     `${name}: ★3枚とも左メニューにある`, labels.join(' / '));
  ok(at('REAL PAY') < at('DEEP PAY') && at('DEEP PAY') < at('VERIFIED PAY'),
     `${name}: ★並びは REAL PAY → DEEP PAY → VERIFIED PAY`, labels.join(' / '));

  for (const l of ['DEEP PAY', 'VERIFIED PAY']) {
    const it = items[at(l)];
    ok(it && it.tag === 'button' && /type="button"/.test(it.attr),
       `${name}: ★${l} は押せる <button>（<span aria-disabled> に戻さない）`,
       it ? `${it.tag} ${it.attr.trim()}` : '(無し)');
    ok(it && !/href=/.test(it.attr), `${name}: ★${l} に行き先を書かない（404 を作らない）`);
    ok(it && !/aria-disabled/.test(it.attr),
       `${name}: ★${l} を「押せない」と名乗らせない（押すと説明が出る）`, it ? it.attr.trim() : '');
    ok(it && /data-mr-gate="/.test(it.attr),
       `${name}: ★${l} に門の目印がある（pv-gates.js が説明を出す）`, it ? it.attr.trim() : '');
    ok(it && /class="mr-side-lk"/.test(it.body),
       `${name}: ★${l} に錠前が静的に入っている（JS が落ちても閉じていると分かる）`);
    ok(it && /aria-label="[^"]+"/.test(it.attr),
       `${name}: ★${l} は読み上げでも「準備中・押すと説明」と分かる`, it ? it.attr.trim() : '');
  }
  const real = items[at('REAL PAY')];
  ok(real && real.tag === 'a' && /aria-current="page"/.test(real.attr),
     `${name}: ★今いる REAL PAY だけが「このページ」の印を持つ`,
     real ? real.attr.trim() : '(無し)');
  ok(real && /data-mr-gate="real"/.test(real.attr),
     `${name}: ★REAL PAY にも門の目印がある（錠前は実行時に付く）`,
     real ? real.attr.trim() : '(無し)');
  ok(real && !/class="mr-side-lk"/.test(real.body),
     `${name}: ★REAL PAY の錠前は静的に置かない（開いている人に錠前が一瞬出る）`);
}

/* ════════════════════════════════════════════════════════════════
   Give-to-Get（2026-08-25 オーナー指示）
   ★実給与を止めているのは**サーバ**（pv_pay_rows() が行を返さない）。
     画面のぼかしで隠す実装は禁止。ここはそれが生えていないことを見張る。
   ════════════════════════════════════════════════════════════════ */
{
  /* ★説明文まで見ると「fixed は書かない」と**書いた**行が赤くなる。実体だけ見る。 */
  const GATES = read('pv-gates.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  /* ① 門の部品はデータを隠さない。 */
  ok(!/blur\(|filter\s*:|backdrop-filter|text-security/i.test(GATES),
     '★pv-gates.js にぼかしの実装が無い（隠すのではなく、最初から渡さない）');
  /* ② 鍵の写しは**読むだけ**。書き手を増やさない（assert-unlock.mjs と対）。 */
  ok(/getItem\(\s*KEY\s*\)/.test(GATES) && !/setItem\(/.test(GATES),
     '★pv-gates.js は鍵の写しを読むだけで書かない');
  /* ③ 覆いを作らない（招待の着地と同じ考え方。閉じ込めない）。 */
  ok(!/position\s*:\s*fixed|role=["']dialog|aria-modal|body\.style\.overflow/.test(GATES),
     '★説明のパネルは覆いではない（fixed / dialog / スクロール止めが無い）');
  /* ④ 閉じ方が3つある。 */
  ok(/mr-gate-x/.test(GATES) && /mousedown/.test(GATES) && /Escape/.test(GATES),
     '★閉じ方は3つ（× ／ 外を押す ／ ESC）');
  /* ⑤ DEEP / VERIFIED は「準備中」。ページが無いのに「開きます」と書かない。 */
  ok(/state: 'soon'[\s\S]*state: 'soon'/.test(GATES) && /'live'/.test(GATES),
     '★いま開くのは REAL PAY だけ（残り2つは準備中）');

  /* ⑥ ぼかしが REAL PAY 側にも無い（CSS / JS / HTML の4本）。 */
  for (const f of ['actual-pay.css', 'actual-pay.js', 'actual-pay.html', 'en/actual-pay.html']) {
    const t = read(f);
    const bad = (t.match(/blur\(|(?:^|[;{\s])filter\s*:|backdrop-filter|text-security/gim) || []);
    ok(bad.length === 0, `★${f} にぼかしで隠す実装が無い`, bad.join(','));
  }
}

// ════════════════════════════════════════════════════════════════
// 共通：偽物 Supabase
// ════════════════════════════════════════════════════════════════
/* ★本物の supabase-js の rpc が返すのは「then だけを持つ箱」。catch も finally も無い。 */
const FAKE = function (payload) {
  window.__rpc = [];
  const UID = '00000000-0000-4000-8000-00000000a001';
  const RPC = {
    pv_pay_rows: () => payload,
    /* ★自分の給与。本人の行しか返らない関数で、ここから取るのは年収1つだけ
       （分布の棒の「あなた」の破線をどこに立てるか）。
       payload.mine を渡さないケースでは空＝破線を出さない。 */
    my_pay_reports: () => ({ ok: true, reports: (payload && payload.mine) || [] }),
    my_referral_code: () => ({ ok: true, code: 'K7QD3XZM', invited: 0, converted: 0 }),
    pv_referral_settle: () => ({ ok: true }),
    /* ★DEEP PAY の札に要る2つだけを返す口（2026-08-25）。
       payload.progress を渡さないケースでは undefined ＝ サーバがまだ古い状態。
       そのとき札は「準備中」のままでなければならない（0 を置いて埋めない）。 */
    pv_give_progress: () => (payload && payload.progress)
  };
  function q(rows) {
    const o = { data: rows, error: null,
      select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
      update: () => o, insert: () => o,
      single: async () => ({ data: rows[0] || null, error: null }),
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      then: (res) => res({ data: rows, error: null }) };
    return o;
  }
  const CLIENT = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: UID, email: 'pilot@example.com' } } } }),
      getUser: async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => q([]),
    rpc: (name, args) => {
      window.__rpc.push({ name: name, hasArgs: args !== undefined });
      const res = { data: RPC[name] ? RPC[name](args) : { ok: true }, error: null };
      return { then: (y, n) => Promise.resolve(res).then(y, n) };   // ★then だけ
    }
  };
  Object.defineProperty(window, 'supabase',
    { value: { createClient: () => CLIENT }, writable: false, configurable: false });
};

/* ★サーバが返さないはずの列を、わざと行に混ぜておく。
   画面のどこかに出たら、その瞬間に赤くなる。
   ZQX は実在しない3文字（実在の空港コードを使うと、たまたま本文に出て誤検知する）。
   ★Somewhere Air は「自由入力で打ち込まれた社名」。これが画面に出たら、
     その人の勤務先が本人の書いた文字列そのままで他人に見えている。
   ★2026-08-24 から **機材（fleet）と支給の内訳（comp）もここに入れた**。
     サーバは返さなくなったが、万一また返し始めても画面には出ないこと。 */
const POISON = {
  base_iata: 'ZQX', seniority_years: 137, age_bucket: '40s',
  period_year: 2026, period_month: 8, created_at: '2026-08-05T00:00:00Z',
  proof_hash: 'deadbeefcafe0001', contract_type: 'direct', tax_country: 'JP',
  nationality: 'JP', annual_total_orig: 19440000, currency: 'JPY', verify_level: 2,
  airline_other: 'Somewhere Air',
  fleet: 'zqx-jet', comp: { m: 73, b: 19, d: 5, h: 2, o: 1 }
};
/* ★字面がぶつからないものを選ぶ。'17' や '2026' のような短い数字は
   年号にたまたま出るので、毒として使えない。 */
const POISON_VALUES = ['ZQX', '137', '40s', 'deadbeefcafe0001',
                       '19,440,000', '19440000', '2026-08-05', 'Somewhere Air',
                       'zqx-jet', '73%', '19%'];

/* ★age ＝ 投稿時期の段（0〜4）。サーバが返すのはこの番号だけで、日付は来ない
     （db/pay-rows.sql の「★投稿の時期について」）。 */
const row = (airline, pos, usd, vf, age, extra) => Object.assign(
  { airline: airline, pos: pos, annual_usd: usd, verified: vf, age: age }, extra || {});

/* 本番に近い形（2026-08-23 時点は8人・全員が手入力＝verified はほぼ付かない）。
   ★1人目にだけ毒を混ぜる。★自由入力の社名の人は airline:'other' で来る。
   ★段は5つとも出るように配る（言葉が1つでも欠けていたら気づける）。 */
const ROWS = [
  row('ana', 'cap', 180000, true, 0, POISON),
  row('ana', 'fo', 120000, false, 1),
  row('ana', 'cap', 190000, false, 2),
  row('jal', 'cap', 170000, false, 3),
  row('jal', 'fo', 110000, false, 4),
  row('emirates', 'cap', 250000, false, 0),
  row('other', 'cap', 130000, false, 2, { airline_other: 'Somewhere Air' }),
  row('other', 'fo', 90000, false, 4)
];

/* 画面に出るはずの段の言葉。★これ以外の言い方が出たら、どこかで作り直されている。 */
/* 実物の6列。★骨組みもこれと同じ字でなければならない（賞与の列は無い）。 */
const TH6 = {
  ja: ['航空会社', '職位', '年収', '月あたり', '出典', '投稿時期'],
  en: ['Airline', 'Position', 'Annual', 'Per month', 'Source', 'Submitted']
};

const AGE_WORDS = {
  ja: ['1ヶ月以内', '3ヶ月以内', '6ヶ月以内', '1年以内', 'それより前'],
  en: ['Within 1 month', 'Within 3 months', 'Within 6 months',
       'Within a year', 'Over a year ago']
};

/* 自分の給与（my_pay_reports()）。★2026-08-24、図を外したのでこの画面は
   **もう1度も引かない**。それでも渡し続ける＝万一また引き始めたら、
   下の「本人の明細の額が画面に出ない」で即座に赤くなる（毒として置いてある）。 */
const MINE = [{
  period_year: 2026, period_month: 7, currency: 'JPY', fx_to_jpy: 1,
  base_pay: 620000, command_pay: 90000, flight_variable_pay: 110000,
  other_allowance: 140000, per_diem: 42000,
  housing_type: 'allowance', housing_amount: 20000, transport: 18000,
  bonus_annual: 2200000, annual_total_usd: 132000
}];

/* ページ送りの検査用。★10件で1ページなので 23人 = 3ページ（10 / 10 / 3）。
   会社は上の4つのまま（絞り込みの選択肢の検査とぶつからないように）。 */
const MANY_ROWS = [];
for (let i = 0; i < 23; i++) {
  const a = ['ana', 'jal', 'emirates', 'other'][i % 4];
  MANY_ROWS.push(row(a, i % 2 ? 'fo' : 'cap', 90000 + i * 5000, false, i % 5));
}

/* ★数え上げ（2026-08-24）。サーバは一覧と同じ材料から数えるので、
     **投稿件数 ≧ 行数** かつ **直近1ヶ月 ≦ 投稿件数** になる。ここもその形で渡す。 */
const ST = { reports: 11, month: 3 };
const ST_MANY = { reports: 31, month: 6 };

const LOCKED = { ok: true, state: 'locked', rows: [] };
/* ★鍵が無いのに数え上げだけ来た形。画面は帯ごと出さない（サーバも返さないが、
     返ってきても会員規模が漏れないこと）。 */
/* ★2026-08-25 オーナー判断で、鍵が無い人にも数え上げを返すようになった。
     contributors ＝ 給与を出したユニークな人数（DEEP PAY の「N / 100人」に使う）。 */
const ST_LOCK = { reports: 11, month: 3, airlines: 7, contributors: 21 };
const LOCKED_ST = { ok: true, state: 'locked', rows: [], stats: ST_LOCK,
                    give: { basic: false, detailed: false, payslip: false } };
/* 先に内訳を出してくれた人（100人にはまだ届いていない）。 */
const LOCKED_DET = { ok: true, state: 'locked', rows: [], stats: ST_LOCK,
                     give: { basic: true, detailed: true, payslip: false } };
const EMPTY = { ok: true, state: 'open', rows: [] };
const OPEN = { ok: true, state: 'open', rows: ROWS, mine: MINE, stats: ST };
const MANY = { ok: true, state: 'open', rows: MANY_ROWS, mine: MINE, stats: ST_MANY };
/* ★サーバがまだ古い（db/pay-rows.sql を貼っていない）形。
     数が読めない2枚は**そのカードごと出さない**＝埋めるための 0 を置かない。 */
const NOSTAT = { ok: true, state: 'open', rows: ROWS, mine: MINE };

/* 表示された金額の文字から数字だけを取り出す。
   単位（万 / K / M）は 10 のべき乗なので、有効数字の桁数を変えない。
     ¥2,700万 → 2700   $180K → 180   $1.9M → 1.9   ¥29,000,000 → 29000000 */
function amountDigits(s) {
  const m = String(s).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}
function isSig2(v) {
  if (!isFinite(v) || v <= 0) return false;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.abs(Math.round(v / p) * p - v) < p * 1e-6;
}
/* 表示された金額を、単位まで含めた「値」にする（amountDigits は桁だけを見る道具で、
   $180K と $15K を比べられない。月あたりの照合にはこちらが要る）。
     ¥2,900万 → 29000000   $180K → 180000   $9.2K → 9200   $1.9M → 1900000 */
function amountValue(str) {
  const s0 = String(str);
  const m = s0.match(/[\d][\d,]*(?:\.\d+)?/);
  if (!m) return NaN;
  const n = Number(m[0].replace(/,/g, ''));
  if (/万/.test(s0)) return n * 1e4;
  if (/K/i.test(s0)) return n * 1e3;
  if (/M/.test(s0)) return n * 1e6;
  return n;
}
const sig2n = (v) => {
  if (!isFinite(v) || v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p;
};

/* 結果の入れ物に出てはいけない「金額の形をした文字」。 */
const MONEY = /[¥$€£＄]|万|\d[\d,]{2,}/;

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const jars = [];
async function fresh() {
  const jar = await browser.createBrowserContext();
  jars.push(jar);
  const page = await jar.newPage();
  await page.setViewport({ width: 1360, height: 1200 });
  await page.evaluateOnNewDocument(() => { window['ga-disable-G-3XYF69VQ3X'] = true; });
  return page;
}

async function open(lang, payload) {
  const page = await fresh();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.evaluateOnNewDocument(FAKE, payload);
  await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'actual-pay.html',
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2600);
  return { page, errs };
}

/* 画面から一度に読み取るもの。★毎回同じ形で取る（ケースごとに見方を変えない）。 */
const SNAP = () => {
  const q = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const rows = document.getElementById('ap-rows');
  const bar = document.getElementById('ap-filter');
  const main = document.querySelector('.mr-main');
  const opts = (id) => {
    const s = document.getElementById(id);
    return s ? Array.prototype.slice.call(s.options).map((o) => o.textContent) : [];
  };
  const txt = (e) => (e ? e.innerText : '');
  return {
    url: location.pathname,
    rowsText: txt(rows),
    /* ★3段の Give → Get を外した本文。真ん中の札は「21 / 100人」＝**進み具合**で、
         金額ではない。金額の検査はこちらで見る（札の数字で赤くならないように）。 */
    rowsTextX: (function () {
      if (!rows) return '';
      const c = rows.cloneNode(true);
      Array.prototype.slice.call(c.querySelectorAll('.pv-give')).forEach((e) => e.remove());
      return c.textContent || '';
    })(),
    mainText: txt(main),
    bodyText: document.body.innerText,
    trs: q('tbody tr', rows).length,
    tables: q('table', rows).length,
    amounts: q('.ap-amt', rows).map((e) => e.textContent),
    mons: q('.ap-mon', rows).map((e) => e.textContent),
    /* 社ロゴ。★画像が落ちても社名が読めること（alt は空・社名は別に文字で出す）。 */
    logoImgs: q('.ap-logo', rows).length,
    logoAlt: q('img.ap-logo', rows).map((e) => e.getAttribute('alt')),
    airNames: q('.ap-air', rows).map((e) => (e.textContent || '').trim()),
    /* ページ送り。★2026-08-24 から**総件数を出す**（オーナー判断）。
       「前へ／次へ」と「数字のページ番号」は別のものなので、別々に取る
       （同じ .ap-pg を持つので、混ぜて数えると端の判定が壊れる）。 */
    pgBtns: q('.ap-pg:not(.ap-pg--n)', rows).map((e) => ({ t: e.textContent.trim(), off: e.disabled })),
    pgNums: q('.ap-pg--n', rows).map((e) => ({ t: e.textContent.trim(),
                                               cur: e.getAttribute('aria-current') === 'page' })),
    pgLabel: q('.ap-pg-n', rows).map((e) => e.textContent.trim()).join(' '),
    vf: q('.ap-vf', rows).length,
    lock: q('.ap-msg--lock', rows).length,
    msg: q('.ap-msg', rows).length,
    cta: q('.ap-cta', rows).map((e) => e.getAttribute('href')),
    /* ── ぼかし禁止（2026-08-25）──────────────────────────
       ★クラス名を変えて逃げられないよう、**実際に効いている値**を見る。
         本文（.mr-main）の中にぼかしが1つでも掛かっていたら、それは
         「隠して見せている」形＝この画面がやらないと決めたこと。
         ⚠️ ページ上部の帯（.mr-top）は backdrop-filter を持つが、
            あれは背景の磨りガラスで .mr-main の外。だからここには入らない。 */
    blurred: (function () {
      const m = document.querySelector('.mr-main');
      if (!m) return ['(.mr-main が無い)'];
      const out = [];
      const all = [m].concat(Array.prototype.slice.call(m.querySelectorAll('*')));
      for (const e of all) {
        const c = getComputedStyle(e);
        const f = c.filter, b = c.backdropFilter || c.webkitBackdropFilter;
        if ((f && f !== 'none') || (b && b !== 'none')) {
          out.push((e.className || e.tagName) + ' → ' + f + ' / ' + b);
        }
      }
      return out;
    })(),
    /* ── Give → Get の3段（pv-gates.js が作る）───────────── */
    give: q('.pv-give-r').map((e) => ({
      g: ((e.querySelector('.pv-give-g') || {}).textContent || '').trim(),
      t: ((e.querySelector('.pv-give-t') || {}).textContent || '').trim(),
      s: ((e.querySelector('.pv-give-s') || {}).textContent || '').trim(),
      live: e.classList.contains('is-live')
    })),
    /* ── 左メニューの門（実行時の姿）───────────────────── */
    gates: q('[data-mr-gate]').map((e) => ({
      k: e.getAttribute('data-mr-gate'),
      tag: e.tagName.toLowerCase(),
      href: e.getAttribute('href'),
      locked: e.classList.contains('is-locked'),
      lk: e.querySelectorAll('.mr-side-lk').length,
      aria: e.getAttribute('aria-label') || ''
    })),
    /* 消したものが実行時にも戻っていないこと。 */
    pub: document.getElementById('ap-pub') ? 1 : 0,
    bluePresent: q('.ap-badge--pub').length,
    orange: q('.ap-badge--actual').length,
    h1: q('h1').map((e) => e.innerText).join(' | '),
    h2: q('h2').length,
    ranges: q('.ap-range').length,
    plist: q('.ap-plist').length,
    panels: q('.ap-panel').length,
    pvr: q('.pvr').length,
    refSlot: document.getElementById('ap-ref-slot') ? 1 : 0,
    /* 絞り込み。★機材（ap-fleet）はもう無い。会社を打ち込む窓（ap-q）が代わりに入った。 */
    barHidden: bar ? bar.hidden : null,
    hasFleet: document.getElementById('ap-fleet') ? 1 : 0,
    hasQ: document.getElementById('ap-q') ? 1 : 0,
    airOpts: opts('ap-air'), posOpts: opts('ap-pos'),
    /* ★並び替えと「賞与ありのみ」の口が実行時にも生えていないこと。 */
    sortEls: q('#ap-sort, #ap-order, [name="sort"], [data-ap-sort]').length,
    bonusEls: q('#ap-bonus, [data-ap-bonus], .ap-bonus').length,
    /* ── 図（2026-08-24 に全部外した）──────────────────
       ★この画面に図は1つも無い。ドーナツも分布の棒も。
         ここが 0 でなくなったら、消したものが戻ったということ。 */
    vizCards: q('.ap-vcard').length,
    donut: q('.pt-donut, .pt-leg, .pt-empty, [data-ap-unsel]').length,
    bars: q('.ap-bar').length,
    you: q('.ap-you').length,
    axText: q('.ap-ax').map((e) => e.innerText).join(' '),
    svgInRows: q('svg', rows).length,
    /* ★行は押せない（押すと内訳が出る形はもう無い）。 */
    rowSel: q('#ap-rows tbody tr[data-ap-row], #ap-rows tbody tr[tabindex]').length,
    /* ── 数字カード（2026-08-24）───────────────────────
       ★読めない数のカードは**そのカードごと出さない**＝0 を並べない。 */
    statsHidden: (function () { const b = document.getElementById('ap-stats'); return b ? b.hidden : null; })(),
    stats: q('.ap-st').map((e) => ({
      n: ((e.querySelector('.ap-st-n') || {}).textContent || '').trim(),
      l: ((e.querySelector('.ap-st-l') || {}).textContent || '').trim(),
      /* ★カード1枚につき絵は1つ（2026-08-24 オーナー指示）。 */
      i: e.querySelectorAll('.ap-st-i svg').length
    })),
    /* ★表の列。いちばん右が投稿時期（2026-08-24）。 */
    ths: q('thead th', rows).map((e) => (e.textContent || '').trim()),
    thBtns: q('thead th button, thead th a, thead th [role="button"]', rows).length,
    ages: q('.ap-age', rows).map((e) => (e.textContent || '').trim()),
    /* ★見出しの下に説明を置かない（オーナー指定）。 */
    hdSub: (function () { const e = document.querySelector('.mr-hd-s'); return e ? e.innerText.trim() : ''; })(),
    /* ── 置き場所（2026-08-24 オーナー指定）─────────────
       ★図が無くなったので、表は幅いっぱい。2段組の部品は1つも無い。 */
    /* ★表は幅いっぱい。2段組はもう無い（図が消えたので右の列に置くものが無い）。 */
    cols: q('.ap-cols').length + q('.ap-main').length + q('.ap-side').length,
    tblWide: (function () {
      const t = document.querySelector('.ap-tw'), m = document.querySelector('.mr-main');
      if (!t || !m) return null;
      const a = t.getBoundingClientRect(), b = m.getBoundingClientRect();
      return { tw: Math.round(a.width), mw: Math.round(b.width) };
    })(),
    /* ── 鍵が無い人の画面（2026-08-25）─────────────────
       ★骨組みは「ぼかし」ではない。中身が最初から無いことを、
         棒の並びに文字が1つも無いことで確かめる。 */
    lockArt: q('.ap-lock-art', rows).length,
    lockCols: q('.ap-lock-cols', rows).length,
    skelThs: q('.ap-skel-hd span', rows).map((e) => (e.textContent || '').trim()),
    skelBars: q('.ap-skel-bar', rows).length,
    skelRowsText: q('.ap-skel-r', rows).map((e) => (e.textContent || '').trim()).join(''),
    skelLock: q('.ap-skel-lock', rows).map((e) => (e.textContent || '').trim()).join(' '),
    seeItems: q('.ap-see li', rows).map((e) => (e.textContent || '').trim()),
    seeNote: q('.ap-see-n', rows).map((e) => (e.textContent || '').trim()).join(' '),
    /* ★見出し・列名・ボタンの字に注記のカッコを足さない（2026-08-25 オーナー指摘
         「（丸め）とか不要な文字はいらない」）。静かに戻るたぐいなので字として見張る。
       ⚠️ 表の下の1文（.ap-foot）はここに入れない。あれは注記ではなく約束で、
          カッコ書きを含んでいてよい。 */
    labels: q('h1, h2, .ap-msg-t, .ap-lock-h, .ap-st-l, .ap-skel-hd span,'
            + ' thead th, .ap-cta, .ap-pg, .pv-give-hd, .mr-gate-t', main)
      .map((e) => (e.textContent || '').trim()),
    calls: (window.__rpc || []).map((r) => r.name),
    withArgs: (window.__rpc || []).filter((r) => r.hasArgs).map((r) => r.name),
    tblTexts: q('table', rows).map((t) => t.innerText)
  };
};

/* ★消したものが戻っていないか（全ケースで同じことを見る）。 */
function gone(v, tag, opt) {
  /* opt.h2 … 鍵が無い画面だけ、下段2枚の見出しを許す（開いている画面は今までどおり0）。
     opt.lock … 飾りの絵と2段組は**鍵が無いときだけ**出る。 */
  const h2max = (opt && opt.h2) || 0;
  const lk = (opt && opt.lock) ? 1 : 0;
  ok(v.lockArt === lk && v.lockCols === lk,
     `${tag}: ★飾りの絵と2段組は鍵が無いときだけ`,
     `art=${v.lockArt} cols=${v.lockCols} / 期待 ${lk}`);
  ok(v.pub === 0 && v.bluePresent === 0 && v.ranges === 0 && v.plist === 0,
     `${tag}: ★推定レンジの節が実行時にも無い`,
     `${v.pub}/${v.bluePresent}/${v.ranges}/${v.plist}`);
  ok(v.panels === 0, `${tag}: ★右の「選んだ区分」パネルが無い`, String(v.panels));
  ok(v.pvr === 0 && v.refSlot === 0, `${tag}: ★招待カードがこの画面に出ない`,
     `${v.pvr}/${v.refSlot}`);
  /* ★表の節は1つ。h1 とほぼ同じ h2 を並べない。
     ★2026-08-24 に図を全部外したので、h2 は**1つも無い**のが正しい形になった
       （それまでは図のカードの見出しぶんだけ増えた）。
     ★見出しに札を置かない。ページ全体を「本人記録」と名乗ると、
       出典が ✓ Verified の行と食い違う（英語の画面で実際に並んで見えた）。 */
  ok(v.h2 === h2max && v.orange === 0,
     `${tag}: ★h2 は ${h2max} つだけ・見出しに札は無い`,
     `h2=${v.h2} / badge=${v.orange} / ${v.h1}`);
  /* ★図が1つも無いこと（消したものが戻っていないか）。 */
  ok(v.vizCards === 0 && v.bars === 0 && v.you === 0 && v.axText === ''
     && v.donut === 0 && v.cols === 0,
     `${tag}: ★図も2段組も1つも無い（分布は DEEP PAY で作り直す）`,
     `viz=${v.vizCards} bar=${v.bars} you=${v.you} cols=${v.cols}`);
  /* ★本人の明細を引かない（引いていたのは分布の破線のためだけ）。 */
  ok(!v.calls.includes('my_pay_reports'),
     `${tag}: ★本人の明細（my_pay_reports）を1度も引かない`, v.calls.join(','));
}

/* ★見出し・列名・ボタンに、断り書きのカッコを足していないこと（2026-08-25）。
     「年収（丸め）」「給与を追加する（約30〜50秒）」のたぐい。
     説明が要るものは本文か、表の下の1文が引き受ける。 */
function noParen(v, tag) {
  const bad = v.labels.filter((t) => /[（(][^）)]{0,24}[）)]/.test(t));
  ok(bad.length === 0, `${tag}: ★見出し・列名・ボタンにカッコの注記が1つも無い`,
     bad.join(' | '));
}

/* ★文言の約束。外した3つが本文に残っていると、そこだけ嘘になる。 */
function promises(v, lang, tag) {
  const t = v.mainText;
  const bad = lang === 'ja'
    ? (t.match(/5人|５人|30日|特定されません|公開情報|推定/g) || [])
    : (t.match(/five (?:or more|records|pilots)|30 days|30-day|cannot be identified|public sources|estimate/gi) || []);
  ok(bad.length === 0, `${tag}: ★外した約束（5人・30日・推定）が本文に残っていない`,
     bad.join(','));
}

// ════════════════════════════════════════════════════════════════
// A. 鍵が無い人（state:'locked'）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / A 鍵が無い（locked）════`);
  const { page, errs } = await open(lang, LOCKED);
  const v = await page.evaluate(SNAP);

  ok(v.lock === 1, '鍵の案内は1枚だけ', String(v.lock));
  ok(v.trs === 0 && v.amounts.length === 0, '★行も金額も1つも描かない',
     `${v.trs} 行 / ${v.amounts.length} 金額`);
  ok(!MONEY.test(v.rowsText), '★結果の中に金額の形をした文字が1つも無い',
     JSON.stringify(v.rowsText).slice(0, 160));
  ok(v.cta.some((h) => /pay-report\.html#ps/.test(h)),
     'Give & Get の導線（匿名で給与を追加）が出る', v.cta.join(','));

  /* ★ぼかしで隠していないこと（2026-08-25）。
       クラス名ではなく、実際に効いている値を見ている。 */
  ok(v.blurred.length === 0, '★本文にぼかしが1つも掛かっていない（隠すのではなく渡さない）',
     v.blurred.join(' | '));

  /* ★文言（2026-08-25 オーナー指示）。
       「明細を1枚」と要求しない ── 手入力でも解放される。
       明細は VERIFIED PAY の話なので、ここで求めると Give を1つ減らす。 */
  {
    const t = v.rowsText;
    const asks = lang === 'ja'
      ? /給与明細を1枚出すと|明細を1枚出した人だけ/.test(t)
      : /submit one payslip|only.*payslip/i.test(t);
    ok(!asks, `${lang}: ★「明細が要る」と読める言い方をしない（手入力でも開く）`,
       t.slice(0, 140));
    const says = lang === 'ja'
      ? /給与を1件/.test(t) && /手入力/.test(t)
      : /one of your own pay records/i.test(t) && /not required/i.test(t);
    ok(says, `${lang}: ★「給与を1件（手入力でも可）で開く」と書いてある`, t.slice(0, 140));
  }

  /* ★Give → Get の3段が出ていて、開くのは REAL PAY だけと分かること。 */
  {
    const g = v.give;
    ok(g.length === 3, `${lang}: ★Give → Get が3段そろっている`, JSON.stringify(g));
    ok(g[0] && g[0].t === 'REAL PAY' && g[0].live,
       `${lang}: ★REAL PAY だけが「いま開きます」`, JSON.stringify(g[0] || {}));
    for (const i of [1, 2]) {
      const r = g[i];
      const soon = lang === 'ja' ? /準備中/ : /in preparation/i;
      ok(r && !r.live && soon.test(r.s),
         `${lang}: ★${(r || {}).t} は「準備中」と書いてある（ページが無いのに開くと書かない）`,
         JSON.stringify(r || {}));
    }
    const soonWord = lang === 'ja' ? /準備中/ : /in preparation/i;
    ok(g[0] && !soonWord.test(g[0].s),
       `${lang}: ★REAL PAY の段に「準備中」が付いていない`, JSON.stringify(g[0] || {}));
  }

  /* ★左メニュー：REAL PAY に錠前が出て、DEEP / VERIFIED は押せる button のまま。 */
  {
    const by = Object.fromEntries(v.gates.map((x) => [x.k, x]));
    ok(by.real && by.real.locked && by.real.lk === 1,
       `${lang}: ★鍵が無いあいだ REAL PAY にも錠前が出る`, JSON.stringify(by.real || {}));
    ok(by.real && by.real.tag === 'a' && /actual-pay\.html/.test(by.real.href || ''),
       `${lang}: ★錠前が出ていても REAL PAY はリンクのまま（行き止まりを作らない）`,
       JSON.stringify(by.real || {}));
    for (const k of ['deep', 'verified']) {
      ok(by[k] && by[k].tag === 'button' && by[k].lk === 1 && by[k].aria,
         `${lang}: ★${k} は錠前つきの押せる button`, JSON.stringify(by[k] || {}));
    }
  }
  ok(v.barHidden === true, '★絞り込みの帯ごと隠れる（空の選択肢を並べない）',
     String(v.barHidden));
  /* ★数え上げは見せる（2026-08-25 オーナー判断）が、**数が読めなければ出さない**。
       この場面はサーバーが stats を返していないので、カードは1枚も出ないのが正しい。 */
  ok(v.statsHidden === true && v.stats.length === 0,
     '★数が読めないときはカードごと出さない（0 を並べない）',
     `${v.statsHidden}/${v.stats.length}`);

  /* ── 一覧の骨組み（2026-08-25）──────────────────────────
     ⚠️ これは**ぼかしではない**。サーバーが行を返していないので中身が最初から無い。 */
  {
    ok(v.lockCols === 1 && v.lockArt === 1,
       `${lang}: ★下段2枚と飾りの絵が出る`, `cols=${v.lockCols} art=${v.lockArt}`);
    ok(JSON.stringify(v.skelThs) === JSON.stringify(TH6[lang]),
       `${lang}: ★骨組みの列が実物と同じ6つ`, JSON.stringify(v.skelThs));
    const bonus = lang === 'ja' ? /賞与|ボーナス/ : /bonus/i;
    ok(!bonus.test(v.skelThs.join(' ')),
       `${lang}: ★骨組みに賞与の列が無い（実物に無い列を描かない）`, v.skelThs.join(','));
    ok(v.skelBars > 0 && v.skelRowsText === '',
       `${lang}: ★骨組みは灰色の棒だけ（数字も社名も1文字も無い）`,
       `${v.skelBars}本 / ${JSON.stringify(v.skelRowsText).slice(0, 80)}`);
    ok(v.skelLock !== '' && !/\d{3,}/.test(v.skelLock),
       `${lang}: ★骨組みの上に錠前つきの1文が出る`, v.skelLock);
    ok(v.seeItems.length === 4 && v.seeNote !== '',
       `${lang}: ★「REAL PAY で見えること」4行＋機種の1文`,
       `${v.seeItems.length} / ${v.seeNote}`);
    const fleet = lang === 'ja' ? /機種/ : /fleet/i;
    ok(fleet.test(v.seeNote), `${lang}: ★「機種は表示しません」が残っている`, v.seeNote);
    /* ★見えることに、実際には出していないものを書かない。 */
    const lies = lang === 'ja'
      ? (v.seeItems.join(' ').match(/機材|基地|年代|在籍|賞与|手取り/g) || [])
      : (v.seeItems.join(' ').match(/fleet|base|bonus|take-home/gi) || []);
    ok(lies.length === 0, `${lang}: ★出していないものを「見えること」に書かない`, lies.join(','));
  }

  noParen(v, lang);
  gone(v, lang, { h2: 2, lock: 1 });
  promises(v, lang, lang);
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

/* ════════════════════════════════════════════════════════════════
   A-2 鍵が無い人にも数え上げを見せる（2026-08-25 オーナー判断）
   ★前はここで「数が来ても1文字も出さない」を見張っていた。方針が変わったところ。
     出した人に「いまどれだけ集まっているか」が見えないと Give & Get が成立しない。
   ⚠️ 見せるのは**数だけ**。行・金額は1つも出ない（そちらは今までどおり）。
   ════════════════════════════════════════════════════════════════ */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / A-2 鍵が無い人に数だけ ════`);
  const { page, errs } = await open(lang, LOCKED_ST);
  const v = await page.evaluate(SNAP);

  ok(v.statsHidden === false && v.stats.length === 3,
     `${lang}: ★数字カードが3枚出る`, `${v.statsHidden}/${JSON.stringify(v.stats)}`);
  ok(v.stats.every((c) => c.i === 1), `${lang}: ★カード1枚につき絵が1つ`,
     JSON.stringify(v.stats.map((c) => c.i)));
  {
    const n = v.stats.map((c) => c.n.replace(/[^\d]/g, ''));
    ok(JSON.stringify(n) === JSON.stringify(['11', '7', '3']),
       `${lang}: ★数はサーバーの数え上げそのまま（画面で数え直さない）`, JSON.stringify(n));
  }
  /* ★数を見せても、行と金額は1つも出ない。 */
  ok(v.trs === 0 && v.amounts.length === 0 && v.tables === 0,
     `${lang}: ★数を見せても行は1つも描かない`,
     `${v.trs}行 / ${v.amounts.length}金額 / ${v.tables}表`);
  ok(!MONEY.test(v.rowsTextX), `${lang}: ★結果の中に金額の形をした文字が1つも無い`,
     JSON.stringify(v.rowsTextX).slice(0, 160));
  ok(v.blurred.length === 0, `${lang}: ★ぼかしが1つも掛かっていない`, v.blurred.join(' | '));

  /* ★DEEP PAY の札が「N / 100人」になる（3段の真ん中）。 */
  {
    const deep = v.give[1] || {};
    const want = lang === 'ja' ? '21 / 100人' : '21 / 100';
    ok(deep.s === want, `${lang}: ★DEEP PAY の札が「${want}」`, JSON.stringify(deep));
    ok(!deep.live, `${lang}: ★札が出ても DEEP PAY は開いていない`, JSON.stringify(deep));
    const real = v.give[0] || {};
    ok(real.t === 'REAL PAY' && real.live,
       `${lang}: ★いま開くのは REAL PAY だけ`, JSON.stringify(real));
  }

  /* ★条件2つを別々に書いてある（100人 ／ 本人の内訳）。
       この人はまだ内訳を出していないので「内訳を足す」側が出る。 */
  {
    const g = await page.evaluate(() => {
      const b = document.querySelector('[data-mr-gate="deep"]');
      if (!b) return { no: true };
      b.click();
      const p = document.getElementById('mr-gate');
      if (!p) return { no: true };
      const a = Array.prototype.slice.call(p.querySelectorAll('a'));
      return {
        no: false,
        goal: (p.querySelector('.mr-gate-goal-n') || {}).textContent || '',
        left: (p.querySelector('.mr-gate-left') || {}).textContent || '',
        ok0: p.querySelectorAll('.mr-gate-ok').length,
        need: (p.querySelector('.mr-gate-need') || {}).textContent || '',
        hrefs: a.map((x) => x.getAttribute('href')),
        pos: getComputedStyle(p).position,
        role: p.getAttribute('role') || '',
        ov: document.body.style.overflow || ''
      };
    });
    ok(!g.no, `${lang}: DEEP PAY の説明が開く`);
    ok(/21/.test(g.goal) && /100/.test(g.goal),
       `${lang}: ★①の進み具合が「21 / 100」で出る`, g.goal);
    ok(/79/.test(g.left), `${lang}: ★あと79人と書いてある`, g.left);
    ok(g.ok0 === 0 && g.need !== '',
       `${lang}: ★②がまだの人には「内訳を共有すると」が出る`, `${g.ok0} / ${g.need}`);
    ok(g.hrefs.some((h) => /pay-report\.html#pay-detail/.test(h || '')),
       `${lang}: ★「給与内訳を追加する」の行き先がある`, g.hrefs.join(','));
    ok(g.hrefs.some((h) => /profile\.html#pv-invite-slot/.test(h || '')),
       `${lang}: ★招待の常設入口へ行ける`, g.hrefs.join(','));
    ok(g.pos !== 'fixed' && g.role !== 'dialog' && g.ov === '',
       `${lang}: ★説明は覆いではない（閉じ込めない）`, `${g.pos}/${g.role}/${g.ov}`);
  }

  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

/* ★先に内訳を出してくれた人が「出し損」に見えないこと。ここがこの表示の目的。 */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / A-2b 先に内訳を出した人 ════`);
  const { page, errs } = await open(lang, LOCKED_DET);
  const g = await page.evaluate(() => {
    const b = document.querySelector('[data-mr-gate="deep"]');
    if (!b) return { no: true };
    b.click();
    const p = document.getElementById('mr-gate');
    if (!p) return { no: true };
    return {
      no: false,
      ok0: (p.querySelector('.mr-gate-ok') || {}).textContent || '',
      need: p.querySelectorAll('.mr-gate-need').length,
      detail: p.querySelectorAll('a[href*="pay-detail"]').length,
      left: (p.querySelector('.mr-gate-left') || {}).textContent || ''
    };
  });
  ok(!g.no, `${lang}: DEEP PAY の説明が開く`);
  ok(g.ok0 !== '', `${lang}: ★「あなたの準備は完了しています」が出る`, g.ok0);
  ok(g.need === 0 && g.detail === 0,
     `${lang}: ★済んだ人に、内訳をもう一度入れさせない`, `${g.need}/${g.detail}`);
  ok(/79/.test(g.left), `${lang}: ★それでも①（100人）は別に書いてある`, g.left);
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

/* ════════════════════════════════════════════════════════════════
   A-3 左メニューのロックを押したとき（2026-08-25）
   ★オーナー指示「未解放の場合は lock 状態を表示してクリック可能にし、
     クリック後に何を Give すると何が Get できるかを説明する」。
   ★ここで作るのは**覆いではない**。招待の着地と同じで、
     スクロールを止めない・下のページを残す・閉じ方が3つある。
   ════════════════════════════════════════════════════════════════ */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / A-3 ロックを押す ════`);
  const { page, errs } = await open(lang, LOCKED);

  /* DEEP PAY（ページが無い側）を押す。 */
  const g = await page.evaluate(() => {
    const b = document.querySelector('[data-mr-gate="deep"]');
    if (!b) return { no: true };
    const before = { ov: document.body.style.overflow, h: document.body.scrollHeight };
    b.click();
    const p = document.getElementById('mr-gate');
    if (!p) return { no: true, before };
    const cs = getComputedStyle(p);
    return {
      no: false,
      first: document.querySelector('.mr-main').firstElementChild === p,
      pos: cs.position,
      role: p.getAttribute('role') || '',
      modal: p.getAttribute('aria-modal') || '',
      filter: cs.filter,
      ovAfter: document.body.style.overflow,
      /* 下のページが残っていること（覆いなら見えなくなる） */
      bodyStillThere: document.body.scrollHeight >= before.h,
      t: (p.querySelector('.mr-gate-t') || {}).textContent || '',
      give: Array.prototype.slice.call(p.querySelectorAll('.pv-give-r')).length,
      cta: (p.querySelector('.mr-gate-cta') || {}).getAttribute
           ? p.querySelector('.mr-gate-cta').getAttribute('href') : '',
      closeBtn: p.querySelectorAll('.mr-gate-x').length,
      focused: document.activeElement === p,
      text: p.innerText
    };
  });

  ok(!g.no, `${lang}: ★ロックを押すと説明が出る`, JSON.stringify(g));
  ok(g.first === true, `${lang}: ★説明は本文の先頭に差し込まれる（別画面に飛ばさない）`,
     String(g.first));
  ok(g.pos !== 'fixed' && g.role !== 'dialog' && g.modal !== 'true',
     `${lang}: ★覆いではない（fixed / dialog / aria-modal が無い）`,
     `${g.pos} / ${g.role} / ${g.modal}`);
  ok(g.ovAfter !== 'hidden' && g.bodyStillThere,
     `${lang}: ★スクロールを止めない・下のページが残る`, `${g.ovAfter}`);
  ok(g.filter === 'none', `${lang}: ★説明にぼかしを掛けない`, g.filter);
  ok(g.closeBtn === 1, `${lang}: ★× で閉じられる`, String(g.closeBtn));
  ok(g.focused === true, `${lang}: ★開いたら読み上げの位置が説明へ移る`, String(g.focused));
  ok(g.give === 3, `${lang}: ★同じ Give → Get の3段が出る（2か所に書き写していない）`,
     String(g.give));
  ok(/pay-report\.html#ps/.test(g.cta || ''),
     `${lang}: ★説明の一番下は「匿名で給与を追加する」`, String(g.cta));
  ok((lang === 'ja' ? /準備中/ : /in preparation/i).test(g.t),
     `${lang}: ★DEEP PAY は「準備中」と名乗る`, g.t);
  ok(!MONEY.test(g.text), `${lang}: ★説明を開いても金額が1文字も出ない`,
     JSON.stringify(g.text).slice(0, 160));

  /* 閉じ方3つ ── ESC ／ 外を押す ／ ×。 */
  const closes = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const open1 = () => { document.querySelector('[data-mr-gate="deep"]').click(); };
    const alive = () => !!document.getElementById('mr-gate');
    const out = {};

    open1(); await sleep(30);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    out.esc = !alive();

    open1(); await sleep(30);
    document.querySelector('.mr-main').dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true }));
    out.outside = !alive();

    open1(); await sleep(30);
    document.querySelector('.mr-gate-x').click();
    out.x = !alive();

    /* 二重に開かない（押すたびに増えない） */
    open1(); await sleep(10); open1(); await sleep(10);
    out.dup = document.querySelectorAll('.mr-gate').length;
    document.querySelector('.mr-gate-x').click();
    return out;
  });
  ok(closes.esc && closes.outside && closes.x,
     `${lang}: ★閉じ方は3つとも効く（ESC ／ 外を押す ／ ×）`, JSON.stringify(closes));
  ok(closes.dup === 1, `${lang}: ★続けて押しても説明は1枚だけ`, String(closes.dup));

  /* REAL PAY のロックを REAL PAY の上で押したとき ── 同じ話を二重に出さない。 */
  const same = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('[data-mr-gate="real"]').click();
    await sleep(30);
    return { panels: document.querySelectorAll('.mr-gate').length,
             lock: document.querySelectorAll('.ap-msg--lock').length };
  });
  ok(same.panels === 0 && same.lock === 1,
     `${lang}: ★REAL PAY の上では説明を重ねず、本文の案内へ寄せる`, JSON.stringify(same));

  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// B. 鍵はあるが1件も無い（state:'open', rows:[]）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / B 鍵はあるが0件 ════`);
  const { page, errs } = await open(lang, EMPTY);
  const v = await page.evaluate(SNAP);

  ok(v.msg === 1 && v.lock === 0, '「まだ1行もありません」の正直な1枚（鍵の案内ではない）',
     `${v.msg} / ${v.lock}`);
  ok(v.trs === 0 && v.tables === 0, '空の表を出さない', `${v.trs} / ${v.tables}`);
  ok(!MONEY.test(v.rowsText), '★0件のとき金額が1つも出ない',
     JSON.stringify(v.rowsText).slice(0, 160));
  ok(!/1,?247|68社|872|直近30日/.test(v.bodyText), '★件数・カバー社数の作り話を置かない');
  ok(v.barHidden === true, '★0件のときも絞り込みの帯は隠れる', String(v.barHidden));
  ok(v.statsHidden === true && v.stats.length === 0,
     '★0件のときは数字カードも出ない（「0名」を並べない）',
     `${v.statsHidden}/${v.stats.length}`);
  ok(v.cta.some((h) => /pay-report\.html#ps/.test(h)), '投稿への導線が出る', v.cta.join(','));
  gone(v, lang);
  promises(v, lang, lang);
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// C. 行がある（1行＝1人・全員）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / C 行がある ════`);
  const { page, errs } = await open(lang, OPEN);
  const v = await page.evaluate(SNAP);

  ok(v.tables === 1, '★表は1枚だけ（粒度を2つに分けない）', String(v.tables));
  ok(v.trs === ROWS.length, `★返ってきた ${ROWS.length} 人が ${ROWS.length} 行そのまま出る`,
     String(v.trs));
  ok(v.amounts.length === ROWS.length, `金額が ${ROWS.length} つ`, String(v.amounts.length));

  /* ★③有効数字2桁。 */
  const bad2 = v.amounts.filter((s) => !isSig2(amountDigits(s)));
  ok(bad2.length === 0, '★金額がすべて有効数字2桁', bad2.join(' / ') || v.amounts.join(' / '));

  /* ★月あたり＝「画面に出ている年収」を12で割って2桁に丸めた数。
     生の年収から割ると、画面の月額 × 12 が画面の年収と合わない
     （年 $105,000 は「$110K」と出るのに月は「$8.8K」＝年 $105.6K 相当になる）。
     読んだ人が掛け算して桁を疑う＝信用の話なので、ここで固定しておく。 */
  ok(v.mons.length === v.amounts.length, '月あたりが年収と同じ数だけ出ている',
     `${v.mons.length} / ${v.amounts.length}`);
  {
    const bad = [];
    for (let i = 0; i < v.amounts.length; i++) {
      const ann = amountValue(v.amounts[i]);
      const got = amountValue(v.mons[i]);
      const want = sig2n(ann / 12);
      if (!(Math.abs(got - want) <= Math.max(1, want * 1e-6))) {
        bad.push(`${v.amounts[i]} → ${v.mons[i]}（あるべきは ${want}）`);
      }
    }
    ok(bad.length === 0, '★月あたり＝画面の年収 ÷ 12 を2桁に丸めた数', bad.join(' / '));
  }
  const badMon = v.mons.filter((s) => !isSig2(amountDigits(s)));
  ok(badMon.length === 0, '★月あたりも有効数字2桁', badMon.join(' / '));

  /* ★社ロゴ。画像は飾りなので alt は空にし、社名は必ず別に文字で出す
     （画像が落ちても・読み上げでも、どこの会社かが分かる）。 */
  ok(v.logoImgs === ROWS.length, '各行に社の印が1つずつ付く',
     `${v.logoImgs} / ${ROWS.length}`);
  ok(v.logoAlt.every((a) => a === ''), '★ロゴの alt は空（社名を二重に読ませない）',
     JSON.stringify(v.logoAlt));
  ok(v.airNames.length === ROWS.length && v.airNames.every((t) => t.length > 0),
     '★社名は必ず文字でも出る（画像が落ちても読める）', JSON.stringify(v.airNames));

  /* ★②準識別子。行に混ぜた毒がどこにも出ていないこと。 */
  const leaked = POISON_VALUES.filter((s) => v.bodyText.includes(s));
  ok(leaked.length === 0,
     '★基地・在籍年数・年代・投稿月・原本額・proof_hash・自由入力の社名が画面に出ない',
     leaked.join(','));
  ok(!/20\d\d年\s*\d+月|20\d\d-\d\d-\d\d/.test(v.rowsText), '★投稿の年月が出ない',
     JSON.stringify(v.rowsText).slice(0, 120));

  /* 自由入力の社名の人は、固定の札に置き換わる。 */
  /* ★2026-08-25、オーナー指示で札の言い方を変えた。
     「その他の航空会社」＝ひとまとめに片付けた言い方に読める。
     ここに来るのは「打ち込まれた社名が語彙に当たらなかった人」だけ。 */
  const othLabel = lang === 'en' ? 'Airline not listed' : '一覧にない航空会社';
  ok(!/その他の航空会社|Other airline/.test(v.rowsText),
     '★「その他の航空会社」という言い方が戻っていない', v.rowsText.slice(0, 120));
  ok(v.rowsText.includes(othLabel), `★自由入力の社名は「${othLabel}」という固定の札になる`,
     JSON.stringify(v.rowsText).slice(0, 160));

  /* 検証済みは1人だけ。★verified の無い人に ✓ を付けない。 */
  ok(v.vf === 1, '★✓ Verified は verified:true の1人だけ', String(v.vf));

  /* ★数字カード3枚（2026-08-24 オーナー判断「本当の数字だけ出す」）。
     1枚は rows を数えるだけ。残り2枚は pv_pay_rows() の stats から来る。
     ★同じ日に「一覧のパイロット」の枚を外した（オーナー指示「件数だけでいいよ」）。
       行数は表の下の「全N件中」が言っているので、上でも言うと二度言うことになる。 */
  ok(v.statsHidden === false && v.stats.length === 3, '★数字カードが3枚出る',
     JSON.stringify(v.stats));
  {
    const num = (s) => Number(String(s).replace(/[^\d]/g, ''));
    const got = v.stats.map((c) => num(c.n));
    ok(got[0] === ST.reports, '★1枚目「実給与の投稿」＝サーバが数えた件数', JSON.stringify(got));
    ok(got[0] >= v.trs,
       '★投稿の件数は必ず表の行数以上（サーバと画面が別々に数えていない）',
       `${got[0]} / ${v.trs}`);
    ok(got[1] === 4, '★2枚目「航空会社」＝表に出ている会社の数', JSON.stringify(got));
    ok(got[2] === ST.month && got[2] <= got[0],
       '★3枚目「1ヶ月以内の新規投稿」（投稿の件数を越えない）', JSON.stringify(got));
    /* ★3枚目の札は「1ヶ月以内」（2026-08-25 オーナー指示）。
       「今月」に戻ると毎月1日に 0 へ落ちるうえ、表の右端の「1ヶ月以内」と
       同じ期間を2つの言い方で書くことになる。字として見張る。 */
    const monLabel = lang === 'en' ? 'Added within 1 month' : '1ヶ月以内の新規投稿';
    ok(v.stats[2] && v.stats[2].l === monLabel,
       `★3枚目の札は「${monLabel}」`, JSON.stringify(v.stats.map((c) => c.l)));
    ok(!/今月の新規投稿|Added this month/.test(v.bodyText),
       '★「今月の新規投稿」に戻っていない');
    /* ★カードの窓と、表のいちばん右の段0（「1ヶ月以内」）は同じ境目
       （どちらも now() - interval '1 month'）。だから札の件数は、表に見えている
       段0の行数を必ず上回る（同じ人の複数月は1行に畳まれるので、件数のほうが多い）。
       ここが逆転したら、片方の窓だけを動かした証拠＝
       「1ヶ月以内 4件」と書いた下に「1ヶ月以内」の行が10本並ぶ絵になっている。 */
    const nAge0 = v.ages.filter((t) => t === AGE_WORDS[lang][0]).length;
    ok(got[2] >= nAge0,
       '★「1ヶ月以内の新規投稿」は表の「1ヶ月以内」の行数を下回らない（窓が同じ）',
       `札 ${got[2]} / 行 ${nAge0}`);
    /* ★「一覧のパイロット」の枚が戻っていないこと。 */
    const label = lang === 'en' ? 'Pilots listed' : '一覧のパイロット';
    ok(!v.stats.some((c) => c.l === label) && !v.bodyText.includes(label),
       `★「${label}」のカードが戻っていない`, JSON.stringify(v.stats.map((c) => c.l)));
    /* ★カード1枚につき絵を1つ（2026-08-24 オーナー指示）。 */
    ok(v.stats.every((c) => c.i === 1), '★カードには絵が1枚ずつ入る',
       JSON.stringify(v.stats.map((c) => c.i)));
  }

  /* ★列は6つで、いちばん右が投稿時期（2026-08-24 オーナー指示）。 */
  {
    const thAge = lang === 'en' ? 'Submitted' : '投稿時期';
    ok(v.ths.length === 6, '★表の列は6つ', JSON.stringify(v.ths));
    ok(v.ths[5] === thAge, `★いちばん右が「${thAge}」`, JSON.stringify(v.ths));
    ok(v.thBtns === 0, '★見出しは押せない（＝並べ替えの口が無い）', String(v.thBtns));
    const words = AGE_WORDS[lang];
    ok(v.ages.length === ROWS.length, '★投稿時期は全部の行に出る',
       `${v.ages.length} / ${ROWS.length}`);
    ok(v.ages.every((t) => words.includes(t)),
       '★出るのは5段の言葉だけ（日付も年月も出ない）', JSON.stringify(v.ages));
    ok(v.ages.join('|') === ROWS.map((r) => words[r.age]).join('|'),
       '★段の番号と言葉が1つずつ対応している', JSON.stringify(v.ages));
    /* ★数字を含む段の言葉（「1ヶ月以内」）はあるが、それは件数でも人数でもない。
         下の「表の中に件・人が無い」がここを誤検知しないことも、同時に見ている。 */
    ok(!/\d{4}|\d+\s*\/\s*\d+|\d+日/.test(v.ages.join(' ')),
       '★段の言葉に日付らしい数字が混ざっていない', JSON.stringify(v.ages));
  }

  /* ★モックにあったが作らなかったもの。実行時にも生えていないこと。 */
  ok(v.sortEls === 0 && v.bonusEls === 0,
     '★並び替えの口も「賞与ありのみ」も無い', `${v.sortEls}/${v.bonusEls}`);
  ok(v.hasFleet === 0 && v.hasQ === 1,
     '★機材で絞る口は無い／会社を打ち込む窓はある', `${v.hasFleet}/${v.hasQ}`);
  ok(v.hdSub === '', '★見出しの下に説明を置かない（オーナー指定）', v.hdSub.slice(0, 80));
  ok(v.rowSel === 0, '★行は押せない（押すと内訳が出る形はもう無い）', String(v.rowSel));
  ok(v.donut === 0, '★ドーナツはこの画面に1つも無い（DEEP PAY へ移した）', String(v.donut));

  /* ★原本通貨は返していない＝表は表示通貨に揃っている。 */
  ok(!/[€£₩]|AED|SGD|HKD/.test(v.tblTexts.join(' ')),
     '★原本通貨の記号が表に出ない（表示通貨に揃っている）',
     v.tblTexts.join(' ').slice(0, 120));

  /* ★表は幅いっぱい（2026-08-24 に図を外したので、右に置くものが無い）。 */
  ok(v.tblWide && Math.abs(v.tblWide.tw - v.tblWide.mw) <= 2,
     '★表は本文の幅いっぱいに広がる', JSON.stringify(v.tblWide));

  /* ★⑤数え上げ。表そのものに数え方の言葉を1つも置かない。
     ★ただし出典の札（本人記録 / Pilot-recorded）だけは別。あれは数え方ではなく
       「その額がどこから来たか」で、たまたま「人」「Pilot」の字を含むだけ。
       札の文字列そのものを外してから、残りを元どおり厳しく見る。
       外すのは札だけ＝他の場所に「3件」「5人」が出れば今までどおり落ちる。 */
  const VF_LABELS = ['本人記録', 'Pilot-recorded'];
  const tblAll = VF_LABELS.reduce((t, w) => t.split(w).join(' '), v.tblTexts.join('\n'));
  ok(!/(件|人|reports?|pilots?)/i.test(tblAll),
     '★表の中に「件」「人」が1つも無い', JSON.stringify(tblAll).slice(0, 160));
  /* ★2026-08-24 から、表の**外**（上のカードと下のページ送り）には数字が出る。
     だから「#ap-rows の中に数え方の言葉が1つも無い」ではなく、
     **ページ送りの1文を外したら1つも無いこと**を見る。 */
  {
    const rest = v.pgLabel ? v.rowsText.split(v.pgLabel).join(' ') : v.rowsText;
    const counts = (rest.match(/(\d+)\s*(件|人|reports?|pilots?)/gi) || []);
    ok(counts.length === 0, '★件数が出るのはページ送りの1文だけ', counts.join(','));
  }
  ok(!/直近\s*\d+\s*日|last\s*\d+\s*days|\+\s*\d+\s*件/i.test(v.mainText),
     '★「直近30日で +X件」は出さない（増え方の速さまでは出さない）');
  ok(!/パーセンタイル|上位\s*\d|percentile|top\s*\d+\s*%/i.test(v.bodyText),
     '★「上位◯パーセンタイル」を出さない（本人を採点しない）');

  gone(v, lang);
  promises(v, lang, lang);
  noParen(v, lang);

  /* ★絞り込みは「実際に行がある区分」だけ。112社を並べない。 */
  ok(v.barHidden === false, '行があるときは絞り込みの帯が出る', String(v.barHidden));
  ok(v.airOpts.length === 5, '航空会社は「すべて」＋実在する4つだけ', v.airOpts.join(','));
  ok(v.airOpts.some((s) => s === othLabel), `「${othLabel}」も選べる`, v.airOpts.join(','));
  ok(v.posOpts.length === 3, '職位は「すべて」＋2つ', v.posOpts.join(','));

  /* 会社 → 職位 と絞ると、下の段は上の段に追随する。 */
  const step = await page.evaluate(() => {
    const set = (id, v) => {
      const s = document.getElementById(id);
      const o = Array.prototype.slice.call(s.options).find((x) => x.value === v);
      s.value = o ? o.value : s.value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const q = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
    /* カードの数字。★絞り込みで動かないことを、同じ手順の中で見る。 */
    const st = () => q('.ap-st .ap-st-n').map((e) => e.textContent.trim()).join('|');
    const before = st();
    set('ap-air', 'ana');
    const afterAir = { trs: q('#ap-rows tbody tr').length,
                       pos: document.getElementById('ap-pos').options.length, st: st() };
    set('ap-pos', 'cap');
    const afterPos = { trs: q('#ap-rows tbody tr').length, st: st() };
    /* ★会社を打ち込む窓（2026-08-24）。会社が増えても選択肢の中で迷子にならない。 */
    document.getElementById('ap-clear').click();
    const qi = document.getElementById('ap-q');
    qi.value = 'jal';
    qi.dispatchEvent(new Event('input', { bubbles: true }));
    const afterQ = { trs: q('#ap-rows tbody tr').length,
                     air: document.getElementById('ap-air').options.length };
    document.getElementById('ap-clear').click();
    const afterClear = { trs: q('#ap-rows tbody tr').length,
                         air: document.getElementById('ap-air').value,
                         q: qi.value, st: st() };
    return { before, afterAir, afterPos, afterQ, afterClear };
  });
  ok(step.afterAir.trs === 3, '会社で絞ると3行', JSON.stringify(step.afterAir));
  ok(step.afterAir.pos === 3, '職位の選択肢はその会社にある2つ＋すべて',
     JSON.stringify(step.afterAir));
  ok(step.afterPos.trs === 2, '会社＋職位で絞ると2行', JSON.stringify(step.afterPos));
  ok(step.afterQ.trs === 2 && step.afterQ.air === 2,
     '★社名を打ち込むと、その会社の行だけになる（選択肢もその1社＋すべて）',
     JSON.stringify(step.afterQ));
  ok(step.afterClear.trs === ROWS.length && step.afterClear.air === ''
     && step.afterClear.q === '',
     '★解除で全員に戻る（打ち込んだ文字も消える）', JSON.stringify(step.afterClear));
  ok(step.before === step.afterAir.st && step.before === step.afterPos.st
     && step.before === step.afterClear.st,
     '★数字カードは絞り込みでは動かない（ここは「全体で今どれだけ集まっているか」）',
     `${step.before} → ${step.afterPos.st}`);

  /* ⑥通貨を切り替えても引き直さない。 */
  const before = v.calls.filter((n) => n === 'pv_pay_rows').length;
  await page.evaluate(() => window.PVCurrency.set('USD'));
  await sleep(600);
  const u = await page.evaluate(SNAP);
  ok(u.calls.filter((n) => n === 'pv_pay_rows').length === before,
     '★通貨を切り替えても pv_pay_rows() を引き直さない',
     `${before} → ${u.calls.filter((n) => n === 'pv_pay_rows').length}`);
  ok(u.amounts.length === ROWS.length && u.amounts.every((s) => /\$/.test(s)),
     '金額はドル表記に変わる', u.amounts.join(' / '));
  const badU = u.amounts.filter((s) => !isSig2(amountDigits(s)));
  ok(badU.length === 0, '★換算後も有効数字2桁（端数の残った数字を出さない）',
     badU.join(' / ') || u.amounts.join(' / '));

  ok(u.calls.filter((n) => n === 'pv_pay_rows').length === 1,
     'pv_pay_rows() は1回だけ引く', String(u.calls.filter((n) => n === 'pv_pay_rows').length));
  ok(!u.withArgs.includes('pv_pay_rows'), '★引数を渡さない（総当たり面を作らない）',
     u.withArgs.join(','));
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// D. 絞り込みが行き止まりにならない
// ════════════════════════════════════════════════════════════════
/* 選択肢は「実際に行がある区分」からしか作らず、上の段を変えたら下の段は落とす。
   だから **どう選んでも0件にはならない**。0件が出る画面は「隠されている」に見える。
   ここでは総当たりでそれを確かめ、そのうえで
   万一そこへ落ちたときの受け皿（絞り込み用の正直な1枚）が正しいことも見る。 */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / D 行き止まりが無い ════`);
  const { page, errs } = await open(lang, OPEN);

  const sweep = await page.evaluate(() => {
    const g = (id) => document.getElementById(id);
    const set = (id, v) => {
      const s = g(id); s.value = v;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const vals = (id) => Array.prototype.slice.call(g(id).options).map((o) => o.value);
    const n = () => document.querySelectorAll('#ap-rows tbody tr').length;
    const dead = [];
    let combos = 0;
    for (const a of vals('ap-air')) {
      set('ap-air', a);
      combos++;
      if (!n()) dead.push('air=' + a);
      for (const p of vals('ap-pos')) {
        set('ap-air', a); set('ap-pos', p);
        combos++;
        if (!n()) dead.push('air=' + a + ',pos=' + p);
      }
    }
    /* ★打ち込む窓も同じ。**選んだ会社に当たらない文字**を打つと、
       選ばれていた会社は外れる（外れないと0件の行き止まりになる）。 */
    g('ap-clear').click();
    for (const a of vals('ap-air')) {
      if (!a) continue;
      set('ap-air', a);
      const qi = g('ap-q');
      qi.value = 'zzq';
      qi.dispatchEvent(new Event('input', { bubbles: true }));
      combos++;
      if (g('ap-air').value === a) dead.push('q=zzq でも air=' + a + ' が残る');
      qi.value = '';
      qi.dispatchEvent(new Event('input', { bubbles: true }));
    }
    g('ap-clear').click();
    return { dead: dead, combos: combos, back: n() };
  });
  ok(sweep.dead.length === 0,
     `★どう絞っても0件にならない（${sweep.combos} 通り試した）`, sweep.dead.join(' / '));
  ok(sweep.back === ROWS.length, '解除で全員に戻る', String(sweep.back));

  /* 受け皿。★選択肢に無い値を差し込んで、わざとそこへ落とす。
     ここで「まだ1行もありません／最初の1人になれます」と言うと、
     絞り込みのせいで空なだけなのに「誰も出していない」という嘘になる。 */
  const net = await page.evaluate(() => {
    const s = document.getElementById('ap-air');
    const o = document.createElement('option');
    o.value = 'zzz-not-an-airline'; o.textContent = 'zzz';
    s.appendChild(o); s.value = o.value;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    const rows = document.getElementById('ap-rows');
    return { trs: rows.querySelectorAll('tbody tr').length,
             msg: rows.querySelectorAll('.ap-msg').length,
             lock: rows.querySelectorAll('.ap-msg--lock').length,
             cta: rows.querySelectorAll('.ap-cta').length,
             text: rows.innerText,
             barHidden: document.getElementById('ap-filter').hidden };
  });
  ok(net.trs === 0 && net.msg === 1 && net.lock === 0, '正直な1枚が出る',
     `${net.trs}/${net.msg}/${net.lock}`);
  ok(net.barHidden === false, '★絞り込みの帯は出したまま（外せないと閉じ込めになる）',
     String(net.barHidden));
  const first = lang === 'en' ? 'the first' : '最初の1人';
  ok(!net.text.includes(first) && net.cta === 0,
     '★「最初の1人になれます」と言わない（絞り込みのせいで0件なだけ）',
     JSON.stringify(net.text).slice(0, 160));
  ok(!MONEY.test(net.text), '金額が1つも出ない', JSON.stringify(net.text).slice(0, 120));

  const undo = await page.evaluate(() => {
    document.getElementById('ap-clear').click();
    return document.querySelectorAll('#ap-rows tbody tr').length;
  });
  ok(undo === ROWS.length, '★そこからも「絞り込みを解除」で戻れる', String(undo));
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// E. ページ送りが行き止まりにならない
// ════════════════════════════════════════════════════════════════
/* 10件で1ページ。★2026-08-24 から**総件数を出す**（オーナー判断）。
   N は「絞り込んだ後の行数」で、絞ると N も一緒に動く。
   見るのは6つ:
     ・どのページにも1行以上ある（空のページへ行けない）
     ・端では「前へ」「次へ」が押せなくなる（押しても何も起きない、ではなく無効）
     ・行ったページから必ず戻れる
     ・絞り込みを変えたら1ページ目に戻る（3ページ目のまま絞ると空に見える）
     ・★数字のページ番号が出て、今いるページが1つだけ印を持つ
     ・★「全N件中 a〜b件」の N が絞り込みに追随する */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / E ページ送り ════`);
  const { page, errs } = await open(lang, MANY);
  const v0 = await page.evaluate(SNAP);

  ok(v0.trs === 10, '1ページ目は10行', String(v0.trs));
  ok(v0.pgBtns.length === 2, '「前へ」「次へ」が2つ', JSON.stringify(v0.pgBtns));
  ok(v0.pgBtns[0].off === true, '★1ページ目で「前へ」は押せない', JSON.stringify(v0.pgBtns));
  ok(v0.pgBtns[1].off === false, '1ページ目で「次へ」は押せる', JSON.stringify(v0.pgBtns));
  ok(v0.pgNums.length === 3 && v0.pgNums.map((x) => x.t).join(',') === '1,2,3',
     '★数字のページ番号が 1 2 3 と出る', JSON.stringify(v0.pgNums));
  ok(v0.pgNums.filter((x) => x.cur).length === 1 && v0.pgNums[0].cur,
     '★今いるページに印が1つだけ付く', JSON.stringify(v0.pgNums));
  {
    const d = (v0.pgLabel.match(/\d+/g) || []).map(Number);
    ok(d.includes(MANY_ROWS.length) && d.includes(1) && d.includes(10),
       `★「全 ${MANY_ROWS.length} 件中 1〜10件」と出る`, v0.pgLabel);
  }
  /* ★数字が出るのはページ送りの1文だけ。表の中は今までどおり。 */
  {
    const rest = v0.pgLabel ? v0.rowsText.split(v0.pgLabel).join(' ') : v0.rowsText;
    const c = (rest.match(/(\d+)\s*(件|人|reports?|pilots?)/gi) || []);
    ok(c.length === 0, '★件数が出るのはページ送りの1文だけ', c.join(','));
  }

  /* 端まで進んで、端まで戻る。★行が0のページに立てたらそこで落ちる。 */
  const walk = await page.evaluate(() => {
    const rows = document.getElementById('ap-rows');
    const n = () => rows.querySelectorAll('tbody tr').length;
    /* ★「前へ／次へ」だけを拾う（.ap-pg--n は数字のページ番号）。 */
    const btn = (i) => rows.querySelectorAll('.ap-pg:not(.ap-pg--n)')[i];
    const lbl = () => { const e = rows.querySelector('.ap-pg-n'); return e ? e.textContent.trim() : ''; };
    const fwd = [], back = [];
    /* 進む。★止まらないと困るので上限を置く（ここに掛かったら無限送り＝赤）。 */
    for (let g = 0; g < 30; g++) {
      fwd.push({ n: n(), lbl: lbl() });
      const b = btn(1);
      if (!b || b.disabled) break;
      b.click();
    }
    for (let g = 0; g < 30; g++) {
      back.push({ n: n(), lbl: lbl() });
      const b = btn(0);
      if (!b || b.disabled) break;
      b.click();
    }
    const endBtns = Array.prototype.slice.call(rows.querySelectorAll('.ap-pg:not(.ap-pg--n)'))
      .map((e) => e.disabled);
    return { fwd: fwd, back: back, endBtns: endBtns, endN: n() };
  });

  ok(walk.fwd.length === 3, '★23人ぶんは3ページ（10 / 10 / 3）',
     JSON.stringify(walk.fwd));
  ok(walk.fwd.map((x) => x.n).join(',') === '10,10,3', '各ページの行数',
     JSON.stringify(walk.fwd.map((x) => x.n)));
  ok(walk.fwd.every((x) => x.n > 0), '★空のページへ行けない',
     JSON.stringify(walk.fwd));
  ok(walk.back.length === 3 && walk.back.map((x) => x.n).join(',') === '3,10,10',
     '★最後まで行っても同じ道を戻れる', JSON.stringify(walk.back.map((x) => x.n)));
  ok(walk.endBtns[0] === true, '★1ページ目まで戻ると「前へ」が押せなくなる',
     JSON.stringify(walk.endBtns));
  ok(walk.endN === 10, '戻った先は1ページ目（10行）', String(walk.endN));

  /* ★3ページ目のまま会社を絞ると、その会社に3ページ目が無くて空に見える。
     絞り込みを触ったら必ず1ページ目に戻ること。 */
  const jump = await page.evaluate(() => {
    const rows = document.getElementById('ap-rows');
    const n = () => rows.querySelectorAll('tbody tr').length;
    const next = () => {
      const b = rows.querySelectorAll('.ap-pg:not(.ap-pg--n)')[1];
      if (b && !b.disabled) b.click();
    };
    const lbl = () => { const e = rows.querySelector('.ap-pg-n'); return e ? e.textContent.trim() : ''; };
    next(); next();                         // 3ページ目へ
    const at3 = n(), lbl3 = lbl();
    const s = document.getElementById('ap-air');
    s.value = 'jal';
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return { at3: at3, lbl3: lbl3, after: n(), lbl: lbl(),
             nums: Array.prototype.slice.call(rows.querySelectorAll('.ap-pg--n'))
               .map((e) => e.textContent.trim()).join(',') };
  });
  ok(jump.at3 === 3, '3ページ目まで行けた', String(jump.at3));
  ok(jump.after > 0, '★絞り込んだ瞬間に1ページ目へ戻る（空に落ちない）',
     JSON.stringify(jump));
  /* ★N は絞り込んだ後の行数。23 のまま残ると「全23件中 1〜6件」という嘘になる。 */
  {
    const d3 = (jump.lbl3.match(/\d+/g) || []).map(Number);
    const d1 = (jump.lbl.match(/\d+/g) || []).map(Number);
    ok(d3.includes(MANY_ROWS.length), '絞る前の N は全体の数', jump.lbl3);
    ok(!d1.includes(MANY_ROWS.length) && d1.includes(jump.after),
       '★絞ったら N も一緒に減る（総数が残らない）', jump.lbl);
  }

  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// F. 図が1つも無い
// ════════════════════════════════════════════════════════════════
/* ★2026-08-24、オーナー判断で**図を全部外した**。
   前の版はここに「年収の分布の棒1枚」を持っていて、置き場所・軸・「あなたの位置」を
   細かく見張っていた。その節をまるごと**反転**させてある。
   ⚠️ 分布は DEEP PAY で作り直す。**この画面に別の図を置き直さない。**
   守るのは5つ：
     ・図の部品（カード・棒・破線・軸）が1つも無い
     ・2段組（.ap-cols / .ap-main / .ap-side）が無く、表が幅いっぱいに広がる
     ・**本人の明細（my_pay_reports）を1度も引かない**（引いていたのは破線のためだけ）
     ・本人の明細の額が画面に1文字も出ない（毒として渡し続けている）
     ・狭い幅にしても、通貨を切り替えても、絞り込んでも、図は生えてこない */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / F 図が1つも無い ════`);
  const { page, errs } = await open(lang, OPEN);
  const v = await page.evaluate(SNAP);

  ok(v.vizCards === 0 && v.bars === 0 && v.you === 0 && v.axText === '',
     '★分布の棒も「あなたの位置」も軸も1つも無い',
     `viz=${v.vizCards} bar=${v.bars} you=${v.you} ax=${v.axText}`);
  ok(v.donut === 0, '★ドーナツの部品も1つも無い（DEEP PAY へ移した）', String(v.donut));
  ok(v.cols === 0, '★2段組の部品（.ap-cols / .ap-main / .ap-side）が無い', String(v.cols));
  ok(v.tblWide && Math.abs(v.tblWide.tw - v.tblWide.mw) <= 2,
     '★表が本文の幅いっぱいに広がる', JSON.stringify(v.tblWide));

  /* ★本人の明細を引かない。図が無くなった以上、この画面に使い道が無い。 */
  ok(!v.calls.includes('my_pay_reports'),
     '★本人の明細（my_pay_reports）を1度も引かない', v.calls.join(','));
  {
    const leak = ['620,000', '620000', '2,200,000', '2200000', '42,000', '42000',
                  '132,000', '132000']
      .filter((x) => v.bodyText.includes(x));
    ok(leak.length === 0, '★本人の明細の額が画面に1文字も出ない', leak.join(','));
  }
  /* 表の中の svg は社ロゴ（頭2文字の札のときは img も svg も無い）と ✓ Verified だけ。
     棒グラフを svg で描き直した人が居たら、ここが増えて赤くなる。 */
  ok(v.svgInRows <= v.trs + 1, '★表の中に図らしい絵が生えていない',
     `svg=${v.svgInRows} / 行=${v.trs}`);

  /* ★狭い幅にしても図は出てこない（前の版は「下に回る」を見ていた）。 */
  await page.setViewport({ width: 720, height: 1200 });
  await sleep(500);
  const nar = await page.evaluate(SNAP);
  ok(nar.vizCards === 0 && nar.bars === 0 && nar.cols === 0,
     '★狭い幅でも図は無い', `${nar.vizCards}/${nar.bars}/${nar.cols}`);
  ok(nar.trs === ROWS.length, '★狭い幅でも行はそのまま出る', String(nar.trs));
  await page.setViewport({ width: 1360, height: 1200 });
  await sleep(500);

  /* ★通貨を切り替えても図は生えない・RPC も増えない。 */
  const n0 = (await page.evaluate(SNAP)).calls.length;
  await page.evaluate(() => window.PVCurrency.set('USD'));
  await sleep(700);
  const cu = await page.evaluate(SNAP);
  ok(cu.calls.length === n0, '★通貨を切り替えても RPC が1本も増えない',
     `${n0} → ${cu.calls.length}`);
  ok(cu.vizCards === 0 && cu.bars === 0, '★切り替えても図は生えない',
     `${cu.vizCards}/${cu.bars}`);

  /* ★絞り込んでも図は生えない。 */
  await page.evaluate(() => {
    const sel = document.getElementById('ap-air');
    sel.value = 'ana';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(500);
  const af = await page.evaluate(SNAP);
  ok(af.vizCards === 0 && af.bars === 0, '★絞り込んでも図は生えない',
     `${af.vizCards}/${af.bars}`);
  ok(af.trs === 3, '★絞り込みはふつうに効く（図が無くても表は動く）', String(af.trs));

  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

/* ★G節（自分の年収が無い）は 2026-08-24 に落とした。
   あれは「分布の『あなたの位置』の破線が出ないこと」を見る節で、
   図が無くなった今は見るものが無い（表とカードが出ることは C節が見ている）。
   ⚠️ 図を作り直すときは、この節も一緒に戻すこと。 */

// ════════════════════════════════════════════════════════════════
// H. サーバがまだ古い（数え上げを返さない）
// ════════════════════════════════════════════════════════════════
/* ★db/pay-rows.sql を Supabase に貼るまで、本番からは stats が返らない。
   そのとき **読めない2枚はカードごと落として、1枚だけ並べる**。
   埋めるための 0 を置かない＝画面に嘘の数字を作らない。
   ★カードを3枚にしたので（2026-08-24）、この形では「航空会社」の1枚だけが残る。 */
{
  console.log('\n════ ja / H サーバがまだ数え上げを返さない ════');
  const { page, errs } = await open('ja', NOSTAT);
  const v = await page.evaluate(SNAP);
  const num = (t) => Number(String(t).replace(/[^\d]/g, ''));
  ok(v.statsHidden === false && v.stats.length === 1,
     '★読めない2枚は出さず、rows から数えられる1枚だけ並ぶ', JSON.stringify(v.stats));
  ok(v.stats.every((c) => num(c.n) > 0), '★埋めるための 0 を置かない',
     JSON.stringify(v.stats));
  ok(num(v.stats[0].n) === 4 && v.stats[0].l === '航空会社',
     '残る1枚は「航空会社」', JSON.stringify(v.stats));
  ok(v.stats[0].i === 1, '★カードが1枚でも絵は付いている', String(v.stats[0].i));
  ok(v.trs === ROWS.length, '表はふつうに出る（カードが欠けても壊れない）', String(v.trs));
  ok(v.ages.length === ROWS.length,
     '★投稿時期も出る（段は rows が持っているので stats とは無関係）', String(v.ages.length));
  ok(v.vizCards === 0 && v.bars === 0, '★図はここでも1つも無い',
     `${v.vizCards}/${v.bars}`);
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// I. 左メニューの DEEP PAY の札を、どの画面でも同じ数にする（2026-08-25）
// ════════════════════════════════════════════════════════════════
/* 左メニューは4画面（マイレポート／REAL PAY／DEEP PAY／VERIFIED PAY／設定）に
   同じものが出ていて、DEEP PAY を押すとどこでも同じ説明が開く。
   ところが数を持っていたのは pv_pay_rows() を引く2画面だけで、残りは
   「準備中」のままだった＝**同じボタンなのに画面によって答えが違う**。

   直した形は「押されたときに1回だけ pv_give_progress() に聞く」。ここで見るのは4つ。
     ① 数を渡されない画面でも、押せば「17 / 100人」になる
     ② 聞くのは**押されたときだけ**（開いただけでは1本も投げない）
     ③ 聞くのは**1度きり**（何度押しても増えない）
     ④ 既に数を持っている画面では**聞かない**（一覧を引く2画面）
   ★サーバがまだ古い（札の口が無い）ときは黙って「準備中」のまま。0 を置かない。 */
{
  const PROG = { ok: true, contributors: 17,
                 give: { basic: false, detailed: false, payslip: false } };

  const openPage = async (url, payload) => {
    const page = await fresh();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
    await page.evaluateOnNewDocument(FAKE, payload);
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    return { page, errs };
  };

  /* 左メニューの DEEP PAY を押して、札と RPC の呼ばれ方を読む。 */
  const pressDeep = (times) => page => page.evaluate(async (n) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const b = document.querySelector('[data-mr-gate="deep"]');
    if (!b) return { no: true };
    for (var i = 0; i < n; i++) {
      b.click();
      await sleep(120);
      const x = document.querySelector('.mr-gate-x');
      if (i < n - 1 && x) x.click();
      await sleep(20);
    }
    const p = document.getElementById('mr-gate');
    const pills = Array.prototype.slice.call(document.querySelectorAll('.pv-give-p'))
                       .map((e) => e.textContent);
    return {
      no: false,
      pills: pills,
      goal: (p && (p.querySelector('.mr-gate-goal-n') || {}).textContent) || '',
      left: (p && (p.querySelector('.mr-gate-left') || {}).textContent) || '',
      calls: (window.__rpc || []).map((r) => r.name)
    };
  }, times);

  for (const lang of ['ja', 'en']) {
    console.log(`\n════ ${lang} / I 数を渡されない画面（設定）で札を押す ════`);
    const url = (lang === 'en' ? '/en/' : '/') + 'profile.html';

    // ①②③ 札の口がある状態
    const { page, errs } = await openPage(url, { progress: PROG });
    const before = await page.evaluate(() => (window.__rpc || []).map((r) => r.name));
    ok(!before.includes('pv_give_progress'),
       `${lang}: ★開いただけでは1本も投げない（押されたときだけ聞く）`, before.join(','));
    ok(!before.includes('pv_pay_rows'),
       `${lang}: ★この画面は一覧（pv_pay_rows）を引かない`, before.join(','));

    const g = await pressDeep(3)(page);
    ok(!g.no, `${lang}: DEEP PAY の説明が開く`);
    ok(g.calls.filter((n) => n === 'pv_give_progress').length === 1,
       `${lang}: ★3回押しても聞くのは1度きり`,
       String(g.calls.filter((n) => n === 'pv_give_progress').length));
    ok(!g.calls.includes('pv_pay_rows'),
       `${lang}: ★札のために一覧を引かない（鍵を持つ人に要らない行が付いてくる）`,
       g.calls.join(','));
    const want = (lang === 'ja' ? '17 / 100人' : '17 / 100');
    ok(g.pills.some((t) => t.indexOf(want) === 0),
       `${lang}: ★札が「${want}」になる（REAL PAY と同じ数）`, JSON.stringify(g.pills));
    ok(g.goal.indexOf(want) === 0,
       `${lang}: ★説明の中の見出しも同じ数`, g.goal);
    ok(/83/.test(g.left), `${lang}: ★あと何人かも出る`, g.left);
    ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));

    // ★サーバがまだ古い（札の口が無い）とき ── 「準備中」のまま。0 を置かない。
    const old = await openPage(url, {});
    const o = await pressDeep(1)(old.page);
    ok(!o.no, `${lang}: 札の口が無くても説明は開く`);
    ok(o.goal === '' && !/\d/.test(o.pills.join(' ')),
       `${lang}: ★数が読めないときは「準備中」のまま（0 を置いて埋めない）`,
       JSON.stringify(o.pills));
    ok((lang === 'ja' ? /準備中/ : /in preparation/i).test(o.pills.join(' ')),
       `${lang}: ★札は「準備中」と名乗ったまま`, JSON.stringify(o.pills));
    ok(old.errs.length === 0, `${lang}: ページのエラーが1件も出ない`, old.errs.join(' | '));
  }

  // ④ 既に数を持っている画面（REAL PAY）では聞かない
  console.log('\n════ ja / I 数を持っている画面では聞かない ════');
  const { page, errs } = await open('ja', Object.assign({ progress: PROG }, LOCKED_ST));
  const g = await pressDeep(2)(page);
  ok(!g.calls.includes('pv_give_progress'),
     '★一覧から数を受け取っている画面は、札のために聞き直さない', g.calls.join(','));
  ok(g.goal.indexOf('21 / 100人') === 0,
     '★出る数は一覧から来たほう（札の口の 17 ではない）', g.goal);
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

for (const jar of jars) { try { await jar.close(); } catch (e) {} }
await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
