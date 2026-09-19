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
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
/* ★プレビュー（ap-preview.js）の金額を突き合わせる相手。
     実在の社名の隣に、サイトが公開していない数字が出ていないことを見る。 */
import { SALARY } from './salary-data.mjs';

const ROOT = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const BASE = 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── ぼかしの見方（2026-09-16）──────────────────────────────────
   この画面は「隠すのではなく、最初から渡さない」で通してある。だから画面に
   ぼかしが出てよいのは、**中身の空いた板**の上だけ ── 霞ませている相手が
   最初から無い所。SNAP.blurred は「実際にぼかしが効いている要素」を
   { cls, text, f } で持ち帰る。
   ⚠️ 下限（n）が要る理由 ── 板に掛ける規則は `.ap-r--mk` / `.ap-dw--mk` の下に
      閉じ込めてある。付け忘れると板は**くっきり空**になる。何も読めないので
      画面は正しく見えてしまい、これだけが気づける。 */
const PLATE = /ap-amt-lk-p|ap-flt-lk|ap-dw-lk-p/;
const blurWhy = (v) => (v.blurred || [])
  .map((e) => (typeof e === 'string' ? e : e.cls + ' → ' + e.f + ' 「' + e.text + '」'))
  .join(' | ');
function blurOK(v, tag, n) {
  const b = v.blurred || [];
  ok(b.every((e) => typeof e !== 'string' && PLATE.test(e.cls) && e.text === ''),
     `${tag}: ★ぼかしが掛かっているのは中身の空いた板だけ（文字を霞ませていない）`,
     blurWhy(v));
  ok(b.length >= n,
     `${tag}: ★板にぼかしが**本当に**掛かっている（${n}個以上）`,
     `実測 ${b.length}個。.ap-r--mk / .ap-dw--mk を付け忘れると板はくっきり空になる`);
}

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
  /* ★?v=<指紋> が付いていても掴む（2026-09-14）。actual-pay.css / ap-preview.js /
     actual-pay.js には中身の指紋を付けた（古い JS が最長4時間残るのを塞ぐため）。
     引用符で閉じる形のままだと、指紋を付けた瞬間に「読んでいない」と誤判定する。 */
  const at = (file) => html.search(new RegExp('(?:src|href)="[^"]*' + file.replace('.', '\\.') + '(?:\\?[^"]*)?"'));
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
    const m = html.match(new RegExp('<script[^>]+src="[^"]*' + file + '(?:\\?[^"]*)?"'));
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
  const QI = /base_iata|seniority|age_bucket|period_month|period_year|created_at|proof_hash|airline_other|contract_type|tax_country|nationality|annual_total_orig|verify_level/g;
  /* ★ap-preview.js も同じ線で見る（2026-09-13）。あちらは作り物の5行だが、
       準識別子の名前を持った瞬間に「本物と同じ形」へ近づいてしまう。 */
  for (const f of ['actual-pay.js', 'ap-preview.js']) {
    const bad = decomment(read(f)).match(QI);
    ok(!bad, `準識別子の名前が ${f} に1つも無い`, bad ? bad.join(',') : '');
  }
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
  /* ★2026-09-13、オーナー指定「会社名だけ変わって絞り込みでは見つからない状態に
     しない」の画面側。サーバは解決済みの会社を1列で返すだけなので、あとは
     **画面がその1列を4か所すべてで読んでいるか**が残りの半分になる ──
       表示（一覧の札・行を押した面）／絞り込み（r.airline との突き合わせ）／
       検索（打ち込み）／プルダウンの選択肢づくり。
     どれか1つが別の材料（社名の文字列や別の列）を読み始めると、
     「一覧には新しい社名で出ているのに、その名前で絞ると0件」になる。
     ★名前の引き当ては airName() の1本だけ、という形で押さえる。 */
  ok((j.match(/function airName\(/g) || []).length === 1,
     '★社名の引き当ては airName() の1本だけ');
  ok(/function hitQ\(code\)[\s\S]{0,200}?norm\(airName\(code\)\)/.test(j),
     '★検索は表示と同じ airName() で当てている（出ている名前で必ず引ける）');
  ok(/hitQ\(r\.airline\)/.test(j) && /r\.airline !== S\.fAir/.test(j),
     '★検索も会社の絞り込みも、サーバが返した r.airline を読んでいる');
  ok(/listOf\('airline', airName,/.test(j),
     '★プルダウンの選択肢も同じ列・同じ airName() から作っている');
  /* ★2026-09-13、プレビューの一覧（previewList）が3つ目になった。
     ★2026-09-16、伏せた一覧（maskedList）が4つ目。鍵の無い人に読ませると決めた
       4つのうちの1つなので、**ここだけは本物**を出す ── だから同じ airName() を通す。
       ここを増やすときは、増えた1つが本当に同じ関数を通っているかを見てから直す。 */
  ok((j.match(/esc\(airName\(r\.airline\)\)/g) || []).length === 4,
     '★一覧の札・プレビューの一覧・行を押した面が、同じ列から出ている',
     String((j.match(/esc\(airName\(r\.airline\)\)/g) || []).length));
  ok(!/\.airline_other\b|airline_other/.test(j),
     '★打ち込まれた社名を画面が読む場所は1つも無い');
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
  /* ★2026-09-03、裸の 'bonus' だけ禁止から外した。行を押すと出る面が
       賞与を**帯の1区分として**出すようになったため（オーナー判断）。
       ⚠️ 外したのは「語を書いてよい」までで、**列・並べ替え・絞り込みは今も無い**。
          それは下の2行が別々に見張っている。 */
  for (const w of ['ap-sort', 'ap-order', 'newest', '新しい順', 'ap-bonus',
                   'id="ap-age"', 'data-ap-age', 'S.fAge']) {
    ok(!j.includes(w), `★actual-pay.js に ${w} が無い`);
  }
  ok(!/sort[^)]*bonus|bonus[^)]*sort|S\.fBonus|onlyBonus/i.test(j),
     '★賞与で並べ替える・絞り込む仕掛けが無い');
  ok(!/sort[^)]*\.age\b|\.age[^)]*sort/.test(j), '★投稿時期で並べ替える仕掛けが無い');
  ok(!/S\.f[A-Za-z]*\s*&&\s*r\.age|r\.age\s*!==/.test(j),
     '★投稿時期で絞り込む仕掛けが無い');
  /* ★投稿時期は5段の言葉だけを持つ。日付を組み立てる道具を持ち込まない。 */
  ok(/T\.age\[/.test(j) && /ageName\(/.test(j),
     '★投稿時期は段の番号（0〜4）を言葉にするだけ');
  ok(!/toLocaleDateString|new Date\(|getFullYear|getMonth/.test(j),
     '★日付を組み立てる道具をこの画面が1つも持っていない');
  /* ★支給の内訳について（2026-09-03 に方針が変わったところ）。
       この画面は内訳を出すようになった。**ただし出すのは帯だけ**で、
       ドーナツ（PVViz）も、1円単位の額も出さない。
       ⚠️ 「内訳を出す」と「ドーナツを戻す」は別の話。ここは後者を見張る。 */
  ok(!/PVViz|pt-donut|renderComp|renderDonut|conic-gradient/.test(j),
     '★ドーナツ（PVViz）はこの画面に戻っていない ── 出すのは帯だけ');
  /* ★割合（％）は 2026-09-04 にオーナーの決定で出すようになった（iPhone の作り直し）。
       出してよい理由 ── 割合は帯の中点から作っていて、**中点は画面に出ている
       両端2つを足して2で割っただけ**。しかも同じ比は前から
       style="flex:0.7031 1 0" として DOM に小数4桁で入っていた。
       つまり「割合を出す」＝**バーが既に持っている長さを読める字で書く**だけで、
       サーバから来る数は1つも増えていない。
     守る4つ（runtime 側が1本ずつ見張る）──
       ① 閉じている行（paylock）には1文字も出さない（あちらの幅は全員同じ作り物）
       ② 整数だけ・合計はちょうど 100
       ③ 「おおよその構成」と必ず並べて出す
       ④ 割合 × 年収 を画面に書かない（金額は今までどおり帯のまま）
     ⚠️ 「* 100」そのものを禁じないこと。横棒の left / width は CSS の % で置くので
        座標の計算に 100 が要る。
     ⚠️ 下の静的検査は**そのまま残す**。名前を pct にしない・toFixed(n) + '%' の形で
        作らない、という**作り方の縛り**（小数の割合が生えた合図になる）。 */
  ok(!/\bpct\b|percent|toFixed\(\s*\d\s*\)\s*\+\s*'%'/i.test(j),
     '★割合（％）を数として持ち回していない');
  /* ★帯は**サーバが作る**。画面が生の額から帯を組み立てていないこと。 */
  ok(!/pv_band|Math\.round\([^)]*\/\s*(?:1000|10000)\s*\)/.test(j),
     '★画面が帯を作っていない（両端はサーバから来た2つの数をそのまま出す）');
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

/* ══ 積み上げバーの色（2026-09-03 その2）══════════════════════════
   バーと丸の色は **区分ごと**で、色そのものは pay-viz.js の SEG が持っている。
   あちらは DEEP PAY のドーナツとマイレポートも引いていて、
   「同じ項目がマイレポートと同じ色になる」はオーナー確定（2026-08-29）。

   ⚠️ actual-pay.html は pay-viz.js を読み込んでいない（読み込めない ──
      あれはドーナツ一式で、この画面に図は戻さないと決めてある）。
      だから色は actual-pay.css に**手で写してある**。

   ⚠️ 写しである以上、あちらのパレットを変えると2つの画面が同じ項目に違う色を出す。
      **どちらも普通に動いたまま**なので、ここで3枚を突き合わせて落とす。
        pay-viz.js の SEG（鍵 → 色）
          → deep-pay.js の COL（面の区分 → SEG の鍵）
            → actual-pay.css の .ap-dw-c-<区分>
   ★賞与だけ COL に無い（DEEP PAY は賞与を月々の棒に入れない）ので SEG から直に引く。 */
{
  const viz = decomment(read('pay-viz.js'));
  const dp  = decomment(read('deep-pay.js'));
  const c   = decomment(CSS);
  const j   = decomment(JS);

  /* 1) pay-viz.js の SEG を { 鍵: 色 } に読む */
  const segBlock = (viz.match(/var\s+SEG\s*=\s*\[([\s\S]*?)\n\s*\];/) || [])[1] || '';
  const SEGC = {};
  for (const m of segBlock.matchAll(/\{\s*k:\s*'([a-z]+)'\s*,\s*c:\s*'(#[0-9a-f]{6})'\s*\}/gi)) {
    SEGC[m[1]] = m[2].toLowerCase();
  }
  ok(Object.keys(SEGC).length >= 14, '★pay-viz.js の SEG を読めた', String(Object.keys(SEGC).length));

  /* 2) deep-pay.js の COL を { 面の区分: SEG の鍵 } に読む */
  const colBlock = (dp.match(/var\s+COL\s*=\s*\{([\s\S]*?)\n\s*\};/) || [])[1] || '';
  const COL = {};
  for (const m of colBlock.matchAll(/(\w+)\s*:\s*SEGCOL\.(\w+)/g)) COL[m[1]] = m[2];
  ok(Object.keys(COL).length === 9, '★deep-pay.js の COL を読めた（9区分）', String(Object.keys(COL).length));

  /* 3) 面が持つ区分は T.seg の鍵。★名前の表が白名簿を兼ねている（segCls）。 */
  const segKeys = Object.keys(
    Object.fromEntries([...((j.match(/seg:\s*\{([\s\S]*?)\}/) || [])[1] || '')
      .matchAll(/(\w+)\s*:/g)].map((m) => [m[1], 1])));
  ok(segKeys.length === 10,
     '★面の区分はちょうど10（9つは DEEP PAY と共通・賞与だけこの画面）', segKeys.join(','));

  /* 4) 10 とも、CSS の色が SEG から出る色と一致する */
  for (const k of segKeys) {
    const want = SEGC[k === 'bonus' ? 'bonus' : COL[k]];
    const got = (c.match(new RegExp('\\.ap-dw-c-' + k + '\\s*\\{background:(#[0-9a-f]{6})\\}', 'i')) || [])[1];
    ok(!!want && !!got && want === String(got).toLowerCase(),
       `★${k} の色が pay-viz.js の SEG と同じ`, `css=${got} seg=${want}`);
  }

  /* 5) 余分な色を足していない（CSS にあって面が持たない区分が無い） */
  const cssKeys = [...c.matchAll(/\.ap-dw-c-([a-z]+)\s*\{/gi)].map((m) => m[1]);
  ok(cssKeys.length === segKeys.length && cssKeys.every((k) => segKeys.includes(k)),
     '★CSS の色は面が持つ区分ぶんだけ（余りも足りないも無い）', cssKeys.join(','));

  /* 6) 濃淡（並び順で色を決める形）に戻っていない。
        ★戻すと「1番目が濃い」だけになり、行が変わると同じ色が別の意味になる。 */
  ok(!/ap-dw-c\d/.test(j) && !/ap-dw-c\d/.test(c),
     '★色は並び順ではなく区分に付いている（濃淡の段に戻っていない）');
  ok(/function segCls/.test(j) && /T\.seg && T\.seg\[k\]/.test(j),
     '★鍵をそのまま class に流していない（T.seg が白名簿を兼ねる）');
}

/* サーバ側。1行＝人の粒度なので anon には絶対に開かない。 */
{
  const i0 = SQL.indexOf('create or replace function public.pv_pay_rows()');
  const i1 = SQL.indexOf('revoke all on function public.pv_pay_rows()');
  const FN = i0 > -1 && i1 > i0 ? SQL.slice(i0, i1) : '';
  ok(!!FN, 'pv_pay_rows の定義が読めた');
  ok(/create or replace function public\.pv_pay_rows\(\)/.test(SQL),
     'pv_pay_rows は引数を1つも取らない（総当たり面を作らない）');
  /* ★2026-09-16、オーナー判断で**未ログイン（anon）にも開けた**。
       返るのは会社・職位・出典・投稿時期の4つだけで、年収も機材も内訳も
       サーバが1バイトも送らない（下の mask の節が見張る）。
     ⚠️ 「anon にも渡す」と「PUBLIC に渡す」は別物。revoke を落とすと
        既定の EXECUTE が残って**全ロールが呼べる**のに画面は無変化なので、
        revoke が在ることまで見る（db/pay-rows.sql の自己点検66 と対）。 */
  ok(/revoke all on function public\.pv_pay_rows\(\) from public/.test(SQL),
     '★まず全員から取り上げている（PUBLIC の既定を残さない）');
  ok(/grant execute on function public\.pv_pay_rows\(\) to anon, authenticated/.test(SQL),
     '★渡すのは anon と authenticated の2つだけ');
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
  /* ★2026-09-13。年収の公開レンジを持たない運航会社（小規模・チャーター・
     ビジネスジェット）も pv_airlines に入れられるようにした（airline-ops.mjs →
     gen-airline-codes.mjs → db/airlines.generated.sql）。入れた瞬間、過去の
     「一覧にない航空会社」の行は**1行も書き換えないまま**正しい社名で出る
     （resolve は保存時ではなく**読むたび**に走るため）。
     オーナー指定「会社名だけ変わって絞り込みでは見つからない状態にしない」を
     ここで固定する ── 行が持つ会社の鍵は**解決済みの airline 1本だけ**。
     ⚠️ 打ち込まれた社名を「表示用」に別の鍵で返し始めたら、ここが落ちる。
        そのときは絞り込みだけ古い列を読む形になり、同じ会社が2つに割れる。 */
  /* ★2026-09-16、伏せた行（mask）が2つ目。どちらも同じ p.airline から出す
       ＝鍵の名前も中身も1本のまま。
     ★2026-09-18、mask の中で2つになった（上の8行の会社型／9行目以降の会社）。
       どちらも q.airline ＝ mask の材料の節が person の p.airline をそのまま運んだもの。
       ここを4以上に増やすときは、増えた1つが本当に同じ列を読んでいるかを見てから直す。 */
  ok((FN.match(/'airline',/g) || []).length === 3,
     '★行が持つ会社の鍵は1つだけ（表示用の別名を足していない）',
     String((FN.match(/'airline',/g) || []).length));
  {
    const MK = (FN.split('-- pv-mask-begin')[1] || '').split('-- pv-mask-end')[0];
    ok((FN.match(/'airline',\s+p\.airline/g) || []).length === 1
       && (MK.match(/'airline',\s+q\.airline/g) || []).length === 2
       && /select p\.pkey, p\.airline,/.test(MK) && /from person p\b/.test(MK),
       '★★どれも解決済みの同じ列から出ている（伏せた行だけ別の材料にしない）');
  }
  ok(!/'airline_other',|'airline_raw',|'airline_name',|'air_name',/.test(FN),
     '★打ち込まれた社名を別の鍵で返していない');
  ok(/group by pkey, airline, pos/.test(FN), '★1行＝1人にまとめている');
  /* ★2026-09-03、オーナー判断で機材を返すことにした（2026-08-24 に外したもの）。
       返すのは**語彙のコードだけ**で、fleet_cat（大分類）は返さない。
       ⚠️ 出すが**絞らせない**。引数ゼロの関数のままであること（契約⑤）と、
          画面に機材の絞り込みが無いこと（下の hasFleet === 0）が対になっている。 */
  ok(/\bfleet\b/.test(FN), '★機材（fleet）を返している');
  ok(!/\bfleet_cat\b/.test(FN), '★機材の大分類（fleet_cat）は返していない');
  ok(/'fleet'/.test(FN), '★機材はキー fleet として1つだけ返る');
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
     ★2026-09-16、行も渡すことにした（オーナー指示）。ただし渡すのは
       **会社・職位・出典・投稿時期の4つだけ**の別の配列（mask）で、
       年収も機材も内訳も勤務もサーバが作らない。
     ⚠️ 見るのは「2つの配列から選んでいる」ことと、「伏せるほうが mask である」こと。
        ここが `l.j` 同士になっていたら、鍵の無い人に一覧が丸ごと渡る。 */
  {
    ok(/'rows',\s*case when v_open then l\.j else m\.j end/.test(FN),
       '★鍵が無いときに返る行は、伏せた配列（mask）のほう',
       (FN.match(/'rows',[^\n]*/g) || []).join(' / '));
    {
      /* ★2026-09-18 に作り直した（オーナー指示）。上の8行は1人に固定の型で
           見える欄が違う ── 年収型（年収・年数の段）／機種型（職位・機材・年収）／
           会社型（会社・職位）。9行目以降は会社と投稿時期（2026-09-19）
           ── 上の8行から下がってきた人（会社型を除く）と預かりは投稿時期だけ。
         ⚠️ 見るのは「出してよい鍵の一覧」と「会社と年収が同じ行に並ばないこと」。
            年収や機材という**言葉が在ること**はもう赤くしない（年収型・機種型で出る）。 */
      const MK = (FN.match(/-- pv-mask-begin[\s\S]*?-- pv-mask-end/) || [''])[0];
      ok(!!MK, '★伏せた行を作る節に印が付いている（pv-mask-begin / pv-mask-end）');
      /* 鍵は1行に1つ・行頭に書いてある（jsonb_build_object の並び）。 */
      const keys = [...new Set([...MK.matchAll(/^\s+'([a-z_]+)',/gm)].map((m) => m[1]))].sort();
      const MK_OK = ['age', 'airline', 'annual_usd', 'fleet', 'pos', 't', 'ten', 'tenk', 'verified'];
      ok(JSON.stringify(keys) === JSON.stringify(MK_OK),
         '★★伏せた行に入る鍵は、型ごとの白リスト（会社・職位・機材・年収・年数の段・出典・時期・型）だけ',
         keys.join(','));
      ok(!/paylock|'pay'|'work'|'bh'|'dd'|'off'|'comp'/.test(MK),
         '★★伏せた行に、内訳・勤務・時間あたりの鍵が1つも無い',
         MK.replace(/\s+/g, ' ').slice(0, 200));
      /* ★会社と年収は同じ行に並べない。型ごとの jsonb_build_object を1つずつ見る。 */
      {
        const objs = MK.split('jsonb_build_object(').slice(1)
          .map((s) => s.split(/\bwhen\b|\belse\b|\bend\)/)[0]);
        const both = objs.filter((s) => /'airline'/.test(s) && /'annual_usd'|'fleet'|'ten'/.test(s));
        ok(objs.length === 5 && both.length === 0,
           '★★会社名と、年収・機材・年数の段が同じ行に1つも並ばない（型は3つ＋9行目以降の2つ）',
           `${objs.length}通り / 並んだもの ${both.map((s) => s.replace(/\s+/g, ' ').slice(0, 80)).join(' | ')}`);
        /* 年収を出すのは年収型と機種型の2つ（機種型は 2026-09-19 オーナー指示で足した）。 */
        const ann = objs.filter((s) => /'annual_usd'/.test(s));
        ok(ann.length === 2 && ann.every((s) => /'annual_usd',\s*public\.pv_sig2\(/.test(s)),
           '★年収を出すのは2つの型だけで、どちらも有効数字2桁（pv_sig2）を通している',
           `${ann.length}通り`);
      }
      /* ★材料は person と coarse（機材と年数の段だけを持つ節）の2つだけ。 */
      ok(/from person p\b/.test(MK) && (MK.match(/\bjoin\b/g) || []).length === 1
         && /left join coarse k on /.test(MK),
         '★★材料は person と coarse だけ（内訳・勤務を持つ節を継ぎ足せない形）',
         (MK.match(/(?:from|join)\s+\w+/g) || []).join(' / '));
      ok(!/\b(?:from|join)\s+(?:pick|paid|worked|grid|sane|listed|shelf|src)\b/.test(MK),
         '★★内訳・勤務・帯を持つ節を1つも読まない');
      /* ★型は1人に固定（本人の匿名キーから）。並びの md5 と塩を分ける。 */
      ok(/md5\('pv-tz:' \|\| p\.pkey\)/.test(MK) && /order by x\.last_at desc, md5\(x\.pkey\)/.test(MK),
         '★型は本人のキーから決める（くじを引かない）・塩は並びの md5 と別');
      ok(!/random\(|now\(\)|clock_timestamp/.test(MK), '★★型が読み込むたびに変わる材料を使っていない');
      /* ★預かりは8行に入れず、9行目以降でも会社を出さない（引き取りでキーが変わる＝型が変わる）。 */
      ok(/p\.pkey not like 'p:%' as eli/.test(MK)
         && /when not q\.pend and \(q\.tt = 2 or not q\.eli\) then/.test(MK),
         '★預かりの行は8行に入れず、9行目以降でも会社を出さない');
      /* ★9行目以降で会社を出すかと8行の型は、どちらも「見せる型」（tt）から決める。
           本来の型（t）で決めると、公開前から会社が出ていた人が8行に上がった瞬間に
           年収型・機種型に戻り、消えた会社と増えた年収が1人につながる（2026-09-19）。 */
      ok(!/q\.t\b/.test(MK) && (MK.match(/q\.tt = [012]/g) || []).length === 3,
         '★★型の分かれ道は、どれも見せる型（tt）で決める（本来の型 t を直接読まない）',
         (MK.match(/q\.tt? = \d/g) || []).join(','));
      ok(/then 2 else z\.t end as tt/.test(MK)
         && /order by x\.l0 desc, md5\(x\.pkey\)\) as rn0/.test(MK),
         '★公開前からいて公開の日の8行にいなかった人は会社型（公開の日の8行は公開前の提出だけで並べ直す）');
    }
    /* ★公開の日（l0 の境目）は1か所・日付は動かさない（2026-09-19）。
         後ろへずらすと公開の日の8行が並べ直され、8行で年収を見せた人の会社が
         9行目以降に出る。l0 は並べ直すためだけの時刻で、行には入れない。 */
    {
      const LIT = FN.match(/timestamptz '[^']*'/g) || [];
      ok(LIT.length === 1 && LIT[0] === "timestamptz '2026-09-19 00:00:00+09'"
         && /max\(cat\) filter \(where cat < timestamptz '2026-09-19 00:00:00\+09'\) as l0/.test(FN),
         '★★公開の日の境目は1か所だけで、2026-09-19 のまま', LIT.join(' / '));
      ok(!/'l0'/.test(FN), '★公開前の提出の時刻（l0）は、どの行にも入れない');
    }
    ok(!/return v_out;/.test(FN.slice(0, FN.indexOf("'contributors'"))),
       '★locked でも途中で return せず、最後の1つの select まで進む');
    ok(/'contributors'/.test(FN), '★給与を出したユニークな人数を返す（DEEP PAY の分母）');
    /* ★2026-09-03、報酬の内訳の門を入れたので pv_my_give() は**1回だけ**呼び、
         その値を v_give に持つ（総当たりでハッシュを作るので2度呼ぶと2度走る）。
         返すのはその同じ値 ── 画面に渡す give と、門に使う判定がズレないように。 */
    /* ★2026-09-16、未ログインでは呼ばない（社名の総当たりが走るだけ無駄）。
         呼び出しそのものは**1つのまま**＝下の「1か所だけ」も無傷。 */
    ok(/v_give\s*:=\s*case when v_uid is null then null else public\.pv_my_give\(\) end;/.test(FN)
       && /'give',\s*v_give/.test(FN),
       '★本人が何を出したか（basic / detailed / full / payslip）を返す',
       (FN.match(/'give',[^\n]*/g) || []).join(' / '));
    ok((FN.match(/public\.pv_my_give\(\)/g) || []).length === 1,
       '★★その判定は1か所だけ（門と画面で違う答えにならない）');
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
    /* ★2026-09-14 オーナー指示で「口コミに給与を書いただけの人」も人数に入れた。
         その人の給与は表に1行出ているのに、人数からは落ちていた
         （「52件あるのに35人」の説明のつかないぶん）。作文で戻らないようここで止める。 */
    const DCTB = (function () {
      const a = SQL.indexOf('create or replace function public.pv_deep_contributors()');
      const b = SQL.indexOf('revoke all on function public.pv_deep_contributors()');
      return a > -1 && b > a ? SQL.slice(a, b) : '';
    })();
    ok(!!DCTB, '★DEEP PAY の分子を数える関数（pv_deep_contributors）がある');
    ok(/pv_review_person/.test(DCTB),
       '★口コミに給与を書いただけの人も人数に入る（2026-09-14）', DCTB.slice(0, 260));
    ok(!/pay_reports_pending/.test(DCTB),
       '★登録前の預かりは人数に入れない（端末×日は人ではない）', DCTB.slice(0, 260));
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

/* ★アプリのナビ（2026-09-06 に作り直した）。
     それまで、ログインした人には**3種類の違うナビ**が出ていた ──
       ① 広い画面の左レール（7項目・うち2つは押せない錠前）
       ② 狭い画面の足元の帯（5項目・中身も並びも①と別物）
       ③ ヘッダーの ≡ から右に出る引き出し（公開ページ用の6項目）
     オーナー指示で1つに畳んだ。**足元の帯（.mr-tabs）は廃止**。
     狭い画面は ≡ から**左に**ドロワーが出る（app-nav.js / app-nav.css）。
   ⚠️ patch-side-nav.mjs は「在る入れ物に書く」だけで、入れ物そのものは作らない。
      1枚だけ入れ物を置き忘れても --check は緑のままなので、ここで数える。 */
{
  /* ★2026-09-06、オーナー確定事項10 で**通常ページ全部**へ広がった（16枚 → 408枚）。
       それまでの「公開ページにはアプリのナビを入れない」（確定事項5・6）は無効。
       出ないのは2種類だけ ── 認証（login / signup / auth-callback）と
       給与フォーム（pay-report。書きかけが消えるため）。
     ★同じ日の Phase 2 で **406枚**になった。マイレポート（my-value.html 日英）を
       MY PAGE の ③ YOUR PAY に統合し、あの2枚は「転送するだけの1枚」になった
       ＝ ヘッダーも板も持たない。**URL は消せない**（送信済みのメールが指している）。
     ★2026-09-07、オーナー指示で **412枚**になった。除外していた6枚のうち
       ログイン・新規登録の日英4枚と給与フォームの日英2枚を**入れた**。
       入れていなかった間、その6枚だけ右上の ≡ から**旧 search.js の引き出し**が出て、
       広い画面には左のレールが無かった（画面は普通に動いたまま、そこだけ別のサイトの顔）。
       残る除外は auth-callback（ログインの折り返しだけを担う中継ページ）だけ。 */
  const pages = [];
  for (const dir of ['.', 'en', 'airlines', 'en/airlines', 'countries', 'en/countries']) {
    for (const f of readdirSync(new URL(dir + '/', ROOT)).filter((x) => x.endsWith('.html')).sort()) {
      const rel = dir === '.' ? f : dir + '/' + f;
      pages.push({ rel, html: read(rel) });
    }
  }
  const side = pages.filter((p) => p.html.includes('<nav class="mr-side"'));
  const pub = side.filter((p) => p.html.includes('id="main-nav"'));
  const app = side.filter((p) => !p.html.includes('id="main-nav"'));
  ok(side.length === 412, '★★同じ板が 412枚に在る（公開394 ＋ アプリ18）',
     `公開 ${pub.length} ／ アプリ ${app.length} ／ 合計 ${side.length}`);
  ok(pub.length === 394 && app.length === 18, '★内訳も 394 ＋ 18 のまま',
     `公開 ${pub.length} ／ アプリ ${app.length}`);
  for (const rel of ['invite.html', 'en/invite.html']) {
    ok(side.some((p) => p.rel === rel), `★${rel} にアプリのナビが在る`);
  }

  /* ★出ない側。**数えて確かめる** ── 板は <body> の直後に入るので、
       1枚くらい混ざっても画面は普通に動く（給与フォームなら書きかけが消える）。
     ⚠️ 404 / admin / unsubscribe の日英6枚はヘッダーそのものが無い（≡ の置き場が無い）。
        ここも「板を持たない」側だが、除外の理由が違うので分けて数える。
        合計10枚 ＝ auth-callback 日英2 ＋ ヘッダーの無い6
        ＋ **転送だけの2**（my-value 日英）。
     ★2026-09-07、ここから login / signup / pay-report を**外した**（板を持つ側へ移した）。 */
  {
    const AUTH = ['auth-callback.html'];
    const bad = pages.filter((p) => AUTH.includes(p.rel.split('/').pop())
      && p.html.includes('<nav class="mr-side"')).map((p) => p.rel);
    ok(bad.length === 0, '★★ログインの折り返し（auth-callback）には板を入れない', bad.join(' / '));
    const none = pages.filter((p) => !p.html.includes('<nav class="mr-side"'))
      .map((p) => p.rel).sort();
    ok(none.length === 10, '★板を持たないのは10枚だけ（折り返し2 ＋ ヘッダーの無い6 ＋ 転送2）',
       none.join(' / '));
    /* ★転送の2枚が「本当に転送だけ」であること。中身が戻ると、
         同じレポートを2つの実装が描く元の姿に戻る。 */
    for (const rel of ['my-value.html', 'en/my-value.html']) {
      const s = read(rel);
      ok(/location\.replace\('profile\.html'/.test(s), `★${rel} は MY PAGE へ転送する1枚`);
      ok(!s.includes('id="pv-value"'), `★${rel} にレポートの器が戻っていない`);
      ok(!s.includes('my-value.js'), `★${rel} が my-value.js を読み戻していない`);
    }
  }

  /* ★足元の帯の残骸が1枚も無いこと。
       入れ物・CSS・<body> の余白 class の3つとも消えていないと、
       画面は動いたまま「iPhone だけ下に理由のない空白が出る」形になる。 */
  const leftTab = pages.filter((p) => p.html.includes('class="mr-tabs"')
    || p.html.includes('tabs.css') || /<body[^>]*\bmr-tabs-pad\b/.test(p.html)).map((p) => p.rel);
  ok(leftTab.length === 0, '★★足元の帯（下タブ）の残骸が1枚も無い', leftTab.join(' / '));
  let tabsCss = true;
  try { read('tabs.css'); } catch { tabsCss = false; }
  ok(!tabsCss, '★tabs.css をファイルごと消してある（帯はもう無い）');
  /* ★CSS も2か所に書き戻していないこと。コメントは先に外す ── そうしないと、
       あちらに書き留めた「.mr-tabs を書き戻さない」という注意書きに当たって落ちる。 */
  const noCmt = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, () => ' ');
  for (const f of ['my-value.css', 'actual-pay.css', 'app-nav.css']) {
    ok(!/\.mr-tabs?\b/.test(noCmt(f)), `★${f} に .mr-tabs を書き戻していない`);
  }
  /* ★狭い画面の「帯のぶんの余白」も戻さない（帯が無いので空白になるだけ）。 */
  ok(!/padding-bottom:calc\(96px/.test(noCmt('my-value.css')),
     '★my-value.css に帯のぶんの足元の余白（96px）が残っていない');

  /* ★412枚とも app-nav.css / app-nav.js / pv-tokens.css を読む。
       CSS を読み忘れると、狭い画面でレールが本文の上に居座る（画面は動いたまま）。
     ⚠️ 深さが3段ある（ルート ／ en・airlines・countries ／ en/airlines・en/countries）。
        「en/ なら ../」で決め打ちすると airlines/ の115枚を素通しする。 */
  const upOf = (rel) => '../'.repeat(rel.split('/').length - 1);
  const noAsset = side.filter((p) => {
    const up = upOf(p.rel);
    return !p.html.includes(`href="${up}app-nav.css"`)
        || !p.html.includes(`href="${up}pv-tokens.css"`)
        || !p.html.includes(`src="${up}app-nav.js"`);
  }).map((p) => p.rel);
  ok(noAsset.length === 0, '★★412枚は app-nav.css / pv-tokens.css / app-nav.js を読む',
     noAsset.join(' / '));

  /* ★★ここが今回いちばん大事。**app-nav.js は search.js より後**に読む。
     ⚠️ 2026-09-06 に**逆になった**。アプリ画面だけだった頃は「先に同じ id の ≡ を立てて
        search.js の inject() を丸ごと止める」やり方だった。全ページへ広げた今それをやると、
        **ヘッダーの自動折り畳みごと殺す** ── fit() / fits() / needed() が同じ
        inject() の中に入っているため（search.js:416 以降）。
        だから公開ページでは inject() を普通に走らせ、走り終わってから
        app-nav.js が ≡ を clone-replace して中身だけ差し替える。
     ★airlines/ の日本語115枚は search.js を読んでいない（今回はじめてナビが出る）。
        そこは app-nav.js が自分で ≡ を作る。 */
  const badOrder = side.filter((p) => {
    const up = upOf(p.rel);
    const a = p.html.indexOf(`src="${up}app-nav.js"`);
    const b = p.html.indexOf(`src="${up}search.js"`);
    return a < 0 || (b >= 0 && a < b);
  }).map((p) => p.rel);
  ok(badOrder.length === 0, '★★search.js を読むページでは app-nav.js を**後**に読む',
     badOrder.join(' / '));
  ok(read('search.js').includes("if (document.getElementById('pv-ham-btn')) return;"),
     '★★search.js の二重注入ガードが残っている（これが無いと ≡ が二重に立つ）');
  {
    const NAV = read('app-nav.js');
    ok(NAV.includes("'pv-ham-btn'"), '★app-nav.js が同じ id の ≡ を扱う');
    /* ★clone-replace であること。消して作り直すと、fit() が掴んでいる参照と
         MutationObserver の見張りがずれて、狭い幅でヘッダーが畳まれなくなる。 */
    ok(/cloneNode\(true\)/.test(NAV) && /replaceChild/.test(NAV),
       '★★≡ は作り直さず clone-replace する（折り畳みの参照を壊さない）');
  }

  /* ★公開ページにアプリのナビを入れない（オーナー確定事項6の境界）。
       index.html / community.html / world-airlines.html と航空会社ページは
       今までどおり #main-nav ＋ search.js の右から出る引き出しのまま。
       ⚠️ **コメントを先に外してから探す。** 字面だけで探すと、
          「帯を app-nav.js の左ドロワーへ畳んだ」と経緯を書き留めた
          world-airlines.html の注意書きに当たって落ちる（2026-09-06 に踏んだ）。
          見るのは実際に読み込む <script src="…app-nav.js"> の1形だけ。 */
  const bare = (h) => h.replace(/<!--[\s\S]*?-->/g, () => ' ');
  const hasNav = (h) => /<script[^>]+src="(?:\.\.\/)?app-nav\.js"/.test(bare(h))
                     || /<link[^>]+href="(?:\.\.\/)?app-nav\.css"/.test(bare(h))
                     || bare(h).includes('<nav class="mr-side"');
  const leaked = pages.filter((p) => hasNav(p.html) && !p.html.includes('<nav class="mr-side"'))
    .map((p) => p.rel);
  ok(leaked.length === 0, '★★資材だけ読んで板が無いページが1枚も無い', leaked.join(' / '));
  /* ★公開ページにも同じ板が在る（オーナー確定事項10）。
     ⚠️ 「ナビを統一する」と「ページをアプリ化する」は別。
        本文・口コミ・一覧・年収・SEO は1バイトも触っていない。 */
  for (const rel of ['index.html', 'en/index.html', 'community.html', 'en/community.html',
                     'world-airlines.html', 'en/world-airlines.html',
                     'airlines/ana.html', 'en/airlines/ana.html', 'countries/japan.html']) {
    ok(read(rel).includes('<nav class="mr-side"'), `★${rel} にも同じ板が在る`);
    ok(read(rel).includes('id="main-nav"'), `★${rel} のヘッダーは公開ページのまま`);
  }

  /* ★給与フォームとログイン・新規登録にも同じ板を置く（2026-09-07 オーナー指示。
       2026-09-05 の「置かない」を**取り消した**）。
       置かなかった間、この6枚だけ右上の ≡ から旧 search.js の引き出しが出て、
       広い画面ではレールが消えていた。
     ⚠️ **書きかけの心配は消えていない。** 板の行き先は7つ在るので、
        書きかけのまま離れる道が一気に増えた。pay-report.html は
        pagehide と visibilitychange で savePreset() を呼んで控えている。
        **この対で成立している。片方だけ外さない。** */
  for (const rel of ['pay-report.html', 'en/pay-report.html',
                     'login.html', 'en/login.html', 'signup.html', 'en/signup.html']) {
    ok(read(rel).includes('<nav class="mr-side"'), `★${rel} にも同じ板が在る`);
  }
  for (const rel of ['pay-report.html', 'en/pay-report.html']) {
    const s = read(rel);
    ok(/addEventListener\('pagehide'/.test(s) && /visibilitychange/.test(s)
       && /savePreset\(\)/.test(s),
       `★★${rel} はページを離れるときに書きかけを控える（板を置いた対の片割れ）`);
  }
  /* ★給与フォームの右上に「← 世界の航空会社」を戻さない（2026-09-07 オーナー指示）。
       行き先は左の板に在る。
     ⚠️ 見るのは **#main-nav の中だけ**。同じ行き先の「やめる」（btn-ghost）が
        本文の下にも在るので、ページ全体で探すと必ず当たる。 */
  for (const [rel, w] of [['pay-report.html', '世界の航空会社'],
                          ['en/pay-report.html', 'World airlines']]) {
    const h = read(rel);
    const i = h.indexOf('id="main-nav"');
    const head = i < 0 ? '' : h.slice(i, h.indexOf('</nav>', i));
    ok(!head.includes(w), `★${rel} のヘッダーに「← ${w}」を戻していない`);
  }

  /* ★入れ物が他の中身を呑み込んでいないか。
       patch-side-nav.mjs は「入れ物の始まり 〜 最初の </nav>」を差し替える。
       2026-09-05、ページのコメントに入れ物と同じ字面を1行書いたせいで、
       そこから最初の </nav> までが差し替え範囲になり、CSS 240行とヘッダーが消えた。
       ファイルは壊れたのに、そのとき赤くなった検査は1本も無かった。 */
  /* ★412枚ぶんを1行にまとめる（1枚ずつ出すと、ここだけで 412行になる）。 */
  {
    const ate = side.filter((p) => {
      const i = p.html.indexOf('<nav class="mr-side"');
      const m = p.html.slice(i, p.html.indexOf('</nav>', i) + 6);
      return !(m.length < 6000 && !/<\/style>|<!--|<script/.test(m));
    }).map((p) => p.rel);
    ok(ate.length === 0, '★★左メニューの入れ物が他の中身を呑み込んでいない（412枚）',
       ate.join(' / '));
  }
  /* ★呑み込みを止める見張りが生成器に残っているか。 */
  {
    const g = read('patch-side-nav.mjs');
    ok(/<\\\/style>\|<!--\|<script/.test(g), '★生成器に呑み込みの見張りが在る');
    ok(/^const TABS\b/m.test(g) === false && !/buildTabs/.test(g),
       '★生成器から下タブの配布が消えている（TABS / buildTabs を戻さない）');
  }

  /* ★ドロワーの約束（app-nav.js）。
     ⚠️ history を積まない ── Phase 4 で REAL PAY の詳細を「戻る」で閉じる予定で、
        ナビのドロワーが積むと、そちらが拾って詳細ではなくナビが閉じる。 */
  {
    const NAV = read('app-nav.js').replace(/\/\*[\s\S]*?\*\//g, () => ' ')
      .replace(/^[ \t]*\/\/.*$/gm, () => '');
    ok(!/pushState|replaceState/.test(NAV),
       '★★ドロワーは history を積まない（Phase 4 の「戻る」と衝突させない）');
    ok(/Escape/.test(NAV), '★Escape で閉じる');
    ok(/pv-anav-ov/.test(NAV), '★暗幕を出す（押しても閉じる）');
    ok(/\.focus\(/.test(NAV), '★閉じたら ≡ に焦点を戻す');
    ok(/resize/.test(NAV), '★広い画面に戻したら閉じる（レールに化けたまま開きっぱなしにしない）');
    ok(/aria-expanded/.test(NAV), '★≡ は開閉を読み上げに伝える');
  }
  /* ★狭い画面の板の見た目は app-nav.css の1か所だけ。 */
  {
    const CSS = read('app-nav.css');
    /* ★2026-09-06、左 → **右**（オーナー指示）。☰ が右上に在るので、
         指と板が同じ側に来る。app-nav.js は左右を1文字も知らない＝CSS だけの話。
       ⚠️ 符号を落とさない ── `translateX(100%)` は**右外**、`-100%` は左外。
          ここを字面で見ているので、向きを戻すならこの1行も一緒に戻す。 */
    ok(/max-width:1000px/.test(CSS) && /transform:translateX\(100%\)/.test(CSS),
       '★★狭い画面では板を画面の**右外**へ逃がす（右から出る）');
    ok(/visibility:hidden/.test(CSS),
       '★閉じている板はタブ移動で拾えない（visibility で外す）');
    ok(!/#[0-9a-fA-F]{3,8}\b/.test(CSS.replace(/\/\*[\s\S]*?\*\//g, () => ' ')
        .replace(/rgba?\([^)]*\)/g, () => ' ')),
       '★app-nav.css は hex を直に書かない（--pv-* を使う＝明暗の切替が効く）');
  }
}

/* ★左メニューの中身（2026-09-06 オーナー確定）。
     ┌ 独立CTA　匿名で給与を追加            → pay-report.html#ps
     └ 1 HOME / 2 REAL PAY / 3 VOTE / 4 ROADMAP & REQUESTS /
       5 AIRLINES / 6 INVITE / 7 MY PAGE
   ★DEEP PAY / VERIFIED PAY の「準備中」の段は**撤去した**。
     DEEP PAY は Phase 6 で REAL PAY の内側へ、
     VERIFIED PAY は実際の検証機能が出来るまで出さない。
   ⚠️ 押せない段を戻さない ── 7項目のうち押しても何も起きないものが混ざると、
      「どれが生きているのか」を毎回試させることになる。 */
const NAV_ORDER = ['HOME', 'REAL PAY', 'VOTE', 'ROADMAP & REQUESTS',
                   'AIRLINES', 'INVITE', 'MY PAGE'];
const NAV_HREF = {
  'HOME': 'index.html', 'REAL PAY': 'actual-pay.html', 'VOTE': 'community.html',
  'ROADMAP & REQUESTS': 'roadmap.html', 'AIRLINES': 'world-airlines.html',
  'INVITE': 'invite.html', 'MY PAGE': 'profile.html',
};
const NAV_EN = {
  'HOME': 'HOME', 'REAL PAY': 'REAL PAY', 'VOTE': 'VOTE',
  'ROADMAP & REQUESTS': 'ROADMAP & REQUESTS', 'AIRLINES': 'AIRLINES',
  'INVITE': 'INVITE', 'MY PAGE': 'MY PAGE',
};
for (const [name, file] of [['ja', 'actual-pay.html'], ['en', 'en/actual-pay.html']]) {
  const html = read(file);
  const i = html.indexOf('class="mr-side"');
  const nav = i < 0 ? '' : html.slice(i, html.indexOf('</nav>', i));
  ok(nav.length > 0, `${name}: 左メニューが読めた`);

  /* ★属性は開きタグ**全体**を掴む（class より前に出る属性があるため）。 */
  const items = Array.from(nav.matchAll(/<(a|span|button)(\s[^>]*class="mr-side-a[^"]*"[^>]*)>([\s\S]*?)<\/\1>/g))
    .map((m) => ({ tag: m[1], attr: m[2], body: m[3],
                   label: ((m[3].match(/<span>([^<]+)<\/span>/) || [])[1] || '').trim() }));
  const labels = items.map((x) => x.label);

  /* ① 独立CTA が先頭。色を持つのはこれ1つだけ。 */
  ok(items[0] && /\bis-add\b/.test(items[0].attr) && /href="pay-report\.html#ps"/.test(items[0].attr),
     `${name}: ★先頭は「匿名で給与を追加」（pay-report.html#ps）`, items[0] ? items[0].attr.trim() : '(無し)');
  ok(items.filter((x) => /\bis-add\b/.test(x.attr)).length === 1,
     `${name}: ★色を持つ段は1つだけ`);

  /* ② そのあとが7項目、この並びで。 */
  const want = NAV_ORDER.map((k) => (name === 'en' ? NAV_EN[k] : k));
  ok(labels.length === 8, `${name}: ★段は CTA ＋ 7項目 ＝ 8つ`, labels.join(' / '));
  ok(labels.slice(1).join('|') === want.join('|'),
     `${name}: ★★並びが HOME → REAL PAY → VOTE → ROADMAP & REQUESTS → AIRLINES → INVITE → MY PAGE`,
     labels.slice(1).join(' / '));

  /* ③ 行き先。VOTE と AIRLINES は**名前を変えただけ**で既存のページを指す。 */
  for (let k = 0; k < NAV_ORDER.length; k++) {
    const it = items[k + 1];
    const href = NAV_HREF[NAV_ORDER[k]];
    ok(it && it.tag === 'a' && it.attr.includes(`href="${href}"`),
       `${name}: ★${NAV_ORDER[k]} → ${href}`, it ? it.attr.trim() : '(無し)');
  }

  /* ④ 押せない段が1つも無い。 */
  ok(items.every((x) => x.tag === 'a' && /href="/.test(x.attr)),
     `${name}: ★★押しても何も起きない段が1つも無い（button / 空リンクを戻さない）`,
     items.filter((x) => x.tag !== 'a').map((x) => x.label).join(' / '));
  ok(!/DEEP PAY|VERIFIED PAY/.test(nav),
     `${name}: ★★DEEP PAY / VERIFIED PAY の「準備中」を左メニューに戻していない`);
  ok(!/mr-side-lk/.test(nav),
     `${name}: ★静的な錠前は置かない（錠前は pv-gates.js が実行時に付ける）`);

  /* ⑤ 門の目印は REAL PAY だけ（pv-gates.js が読む）。 */
  const gated = items.filter((x) => /data-mr-gate="/.test(x.attr));
  ok(gated.length === 1 && /data-mr-gate="real"/.test(gated[0].attr) && gated[0].label === 'REAL PAY',
     `${name}: ★門の目印は REAL PAY の1つだけ`, gated.map((x) => x.label).join(' / '));

  /* ⑥ 「今このページ」の印は1つだけ。 */
  const cur = items.filter((x) => /aria-current="page"/.test(x.attr));
  ok(cur.length === 1 && cur[0].label === 'REAL PAY',
     `${name}: ★今いる REAL PAY だけが「このページ」の印を持つ`, cur.map((x) => x.label).join(' / '));
  ok(cur.length === 1 && /\bis-on\b/.test(cur[0].attr),
     `${name}: ★印の付いた段だけが光る（is-on）`);

  /* ⑦ 出口。アプリ画面にはフッターが無いので、お問い合わせをここで受ける。
       ⚠️ 色を付けない ── 色を持つのは「匿名で給与を追加」1つだけ。 */
  ok(/<a class="mr-side-sub" href="contact\.html">/.test(nav),
     `${name}: ★お問い合わせへの出口が在る（アプリ画面にフッターが無いため）`);
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

  /* ⑥ ぼかしが REAL PAY 側にも無い（CSS / JS / HTML の4本）。
     ⚠️ 2026-09-03 その3 ── 閉じている内訳の「金額の板」だけ例外にした
        （オーナー指示「色付きの棒グラフと項目名までは出す。金額だけ隠す」）。
        あの板は**中身が空**で、霞ませている相手が最初から無い。
     ⚠️ 2026-09-16 ── 伏せた一覧の板（年収 `.ap-amt-lk-p` ／ 機材 `.ap-flt-lk`）も
        同じ理由で例外にした。サーバが年収も機材も**渡していない**ので、
        ぼかしている相手がやはり最初から無い。
        許すのはこの3つを名乗る規則の中だけ ── 消さずに範囲を広げてある。
     ★JS 側は今までどおり **1文字も**許さない（`blur(` を書ける場所は CSS だけ）。
        本当の担保は下の K-1 と A-3（毒を仕込んだ行を開いて、数字が1文字も出ない）と、
        節 P の blurOK（板に**本当にぼかしが掛かっているか**の実測）。 */
  const BLURY = /blur\(|(?:^|[;{\s])filter\s*:|backdrop-filter|text-security/gim;
  for (const f of ['actual-pay.css', 'actual-pay.js', 'actual-pay.html', 'en/actual-pay.html',
                   'ap-preview.js']) {
    const t = read(f);
    let bad;
    if (f.endsWith('.css')) {
      bad = [];
      let m;
      const RULE = /([^{}]+)\{([^{}]*)\}/g;
      while ((m = RULE.exec(t))) {
        BLURY.lastIndex = 0;
        if (!BLURY.test(m[2])) continue;
        if (!/\.ap-dw-lk-p|\.ap-amt-lk-p|\.ap-flt-lk/.test(m[1])) bad.push(m[1].trim().slice(0, 60));
      }
    } else {
      bad = (t.match(BLURY) || []);
    }
    ok(bad.length === 0, `★${f} にぼかしで隠す実装が無い`, bad.join(','));
  }
}

/* ★プレビューの材料そのもの。下の節（A / A-2 / 未ログイン）でも使うので外に出す。
     ap-preview.js はブラウザ用の1枚だが、window を渡すだけで node でも読める。 */
const PVW = {};
new Function('window', read('ap-preview.js'))(PVW);
const PV_ROWS = (PVW.PV_AP_PREVIEW || {}).rows || [];
const PV_T = (PVW.PV_AP_PREVIEW || {}).t || {};
/* 画面の円は sig2(usd × このレート)。プレビューの金額が SSOT と一致するかを見るのに要る。 */
const USD_RATE = Number((read('currency.js').match(/USD\s*:\s*([\d.]+)/) || [])[1]);
/* 有効数字2桁（actual-pay.js の sig2 と同じ丸め）。
   ⚠️ ここに在るのはプレビューの節がこの下で呼ぶため。下の金額の検査でも使う。 */
const sig2n = (v) => {
  if (!isFinite(v) || v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p;
};

/* ════════════════════════════════════════════════════════════════
   プレビューの材料（ap-preview.js・2026-09-13）
   ★未ログインの人・登録しただけの人に見せる5行。**作り物**であることが前提で、
     本物の投稿は1行も混ざらない（actual-pay.js は preview のとき pv_pay_rows() を
     1回も投げない。そちらは下の「未ログイン」の節で見る）。
   ★ここで見るのは**逆側**の危険 ── オーナー指示で実在の航空会社名を出すので、
     社名の隣に出る数字が作り話だと、それはサイトの主張になってしまう。
     金額は salary-data.mjs（年収の SSOT）から来ていなければならない。
     **SSOT を動かしたらこの節が赤くなる**＝プレビューだけ古い数字が残らない。
   ════════════════════════════════════════════════════════════════ */
{
  console.log('\n════ プレビューの材料（ap-preview.js）════');
  const P = { t: PV_T };
  const R = PV_ROWS;

  ok(R.length === 5, '★プレビューは5行', String(R.length));

  /* ★金額を持つのは先頭2行だけ。3行目以降は **null**（隠しているのではなく持っていない）。 */
  const shown = R.filter((r) => r.annual_usd != null);
  ok(shown.length === 2 && R.indexOf(shown[0]) === 0 && R.indexOf(shown[1]) === 1,
     '★金額が入っているのは先頭2行だけ',
     R.map((r, i) => i + ':' + (r.annual_usd == null ? '—' : r.annual_usd)).join(' '));
  ok(R.slice(2).every((r) => r.annual_usd === null && r._man === undefined && r.lock === true),
     '★3行目以降は金額を1つも持たない（CSS で隠しているのではない）',
     JSON.stringify(R.slice(2).map((r) => ({ a: r.annual_usd, m: r._man, l: r.lock }))));

  /* ★実在の社名。SSOT に居ない社を並べない（社名もロゴも本物の一覧と同じ道を通る）。 */
  for (const r of R) {
    ok(!!SALARY[r.airline], `★${r.airline} は年収の SSOT に在る会社`);
  }

  /* ★★金額が SSOT と一致するか。ここが**この節の本体**。 */
  const USD = USD_RATE;
  ok(USD > 0, '換算レートが currency.js から読める', String(USD));
  for (const r of shown) {
    const want = (SALARY[r.airline] || {})[r._rank];
    ok(!!want && want.avg === r._man,
       `★★${r.airline} の ${r._rank} が SSOT の平均と一致（${r._man}万円）`,
       JSON.stringify(want || {}));
    /* USD 側はレートを取り直すたびに動く。±10% の幅で見る
       （作り話の数字は必ずこの幅から外れる。丸めやレートの揺れでは外れない）。 */
    const calc = (r._man * 1e4) / USD;
    const gap = Math.abs(r.annual_usd - calc) / calc;
    ok(gap <= 0.10,
       `★${r.airline} のドル建てが ${r._man}万円の換算と ±10% 以内`,
       `表示 ${r.annual_usd} / 換算 ${Math.round(calc)}（差 ${(gap * 100).toFixed(1)}%）`);
    /* ★★日本語の画面に出る円は、丸めを通したあとも SSOT と**1円も違わない**。
         ⚠️ ここは実際に外した ── $210,000 と置くと ¥3,300万 になり、
            エティハドのページの 3,400万 と食い違った（画面は普通に動いたまま）。 */
    ok(sig2n(r.annual_usd * USD) === r._man * 1e4,
       `★★${r.airline} は円に直しても SSOT ちょうど（¥${r._man}万）`,
       `${sig2n(r.annual_usd * USD)} / 期待 ${r._man * 1e4}`);
  }

  /* ★「誰かが実際に出した」と読めるものを1つも持たない。
       verified（Verified の印）・age（投稿時期）・pay（金額の入った内訳）の3つ。 */
  for (const r of R) {
    ok(r.verified === undefined && r.age === undefined && r.pay === undefined,
       `★${r.airline} の行は Verified も投稿時期も金額の内訳も持たない`,
       JSON.stringify({ v: r.verified, a: r.age, p: r.pay }));
    ok(Array.isArray(r.paylock) && r.paylock.every((x) => typeof x === 'string'),
       `★${r.airline} の内訳は項目名だけ（金額を持たない）`, JSON.stringify(r.paylock));
  }

  /* ★言葉。日英で鍵がそろっていること、作り物だと分かる字を置くが
       「ダミー」「架空」とは書かないこと、事実を装う語を足さないこと。 */
  {
    const ja = P.t && P.t.ja, en = P.t && P.t.en;
    ok(!!ja && !!en, 'プレビューの言葉が日英そろっている');
    ok(JSON.stringify(Object.keys(ja || {}).sort()) === JSON.stringify(Object.keys(en || {}).sort()),
       '★日英の鍵が完全に同じ（片方だけ直されていない）',
       Object.keys(ja || {}).sort().join(',') + ' / ' + Object.keys(en || {}).sort().join(','));
    const all = JSON.stringify(P.t);
    ok(!/ダミー|架空|\bdummy\b|\bfake\b/i.test(all),
       '★「ダミー」「架空」とは書かない（添えるのは小さな「プレビュー」の札）');
    ok(!/検証済み|明細確認|本人申告|時間前|分前|\bverified\b|payslip[- ]checked|hours ago|minutes ago/i.test(all),
       '★事実を装う語を足さない（検証済み・明細確認・◯時間前）');
    ok(ja && ja.tag === 'プレビュー' && en && en.tag === 'Preview',
       '★添えるのは「プレビュー」の札', JSON.stringify([ja && ja.tag, en && en.tag]));
    /* ★2026-09-13 オーナー指示で「実際の投稿ではありません。公開されている
         平均年収から作った見本です。」を消した。作文で戻らないようここで止める。 */
    ok(!/公開されている平均年収|published average salaries/i.test(all)
       && !(ja && 'sub' in ja) && !(en && 'sub' in en),
       '★見出しの下に説明の1行を置かない（2026-09-13）',
       JSON.stringify([ja && ja.sub, en && en.sub]));
    /* ★「この5行が◯件の投稿だ」と読める言い方をしない。
         ⚠️ 「給与を1件共有すると」は本人の提出の話で、数えた数ではない。
            字面では切り分けられないので、数えていないことは**実行時**に見る
            （帯の件数が空・ページ送りが出ない）。ここでは主語が
            「この一覧」になっている言い方だけを禁じる。 */
    ok(!/この一覧[^。]*\d+\s*件|\d+\s*(?:records?|reports?) in this list/i.test(all),
       '★この一覧を「◯件」と数えない');
  }
}

// ════════════════════════════════════════════════════════════════
// 共通：偽物 Supabase
// ════════════════════════════════════════════════════════════════
/* ★本物の supabase-js の rpc が返すのは「then だけを持つ箱」。catch も finally も無い。 */
/* ★第2引数 anon ＝「まだログインしていない人」。2026-09-13 に足した。
     getSession が null を返す**だけ**で、pv_pay_rows は今までどおり
     （毒を仕込んだ本物の応答を）返せる形にしてある。
     ＝「呼べば本物が返る状態なのに、画面が1回も呼ばない」ことを確かめられる。 */
const FAKE = function (payload, anon) {
  window.__rpc = [];
  const UID = '00000000-0000-4000-8000-00000000a001';
  const RPC = {
    /* ★ログアウトした後は、サーバの答えも変わる（本番と同じ ── 席が切れた人に
         state:'open' は返らない）。2026-09-16 から、捨てた直後に一覧を
         **取り直す**ようになったので、ここを payload のままにすると
         同じ本物がそのまま戻ってくる＝Q-1 / Q-2 が意味を失う。
       ★ケースごとに変えたいときは payload.afterOut を渡す。 */
    pv_pay_rows: () => (window.__signedOut
      ? ((payload && payload.afterOut)
         || { ok: true, state: 'locked', rows: [], stats: null })
      : payload),
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
  const USER = { id: UID, email: 'pilot@example.com' };
  const CLIENT = {
    auth: {
      /* ★window.__signedOut を立てると、その後は null を返す。
           「戻る」でブラウザが画面ごと復元したときに、サーバの答えを
           取り直して本物を捨てるかを見るのに要る（2026-09-13）。 */
      getSession: async () => ({ data: { session: (anon || window.__signedOut) ? null : { user: USER } } }),
      getUser: async () => ({ data: { user: (anon || window.__signedOut) ? null : USER } }),
      signOut: async () => ({ error: null }),
      /* ★呼び出し口を窓に出しておく（ログアウトを起こすため。2026-09-13）。 */
      onAuthStateChange: (cb) => {
        window.__authCb = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
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
   ★2026-08-24 から **支給の内訳（comp）もここに入れた**。
     サーバは割合を返さない。万一また返し始めても画面には出ないこと。
   ★2026-09-03、**機材（fleet）は毒から外した** ── 画面に出るようになったため。
     代わりに3つ入れた。
       ・fleet_cat …… 機材の**大分類**。サーバは今もこれを返さない
                      （細かい機材と大分類が両方出ると、絞り込みの階段になる）
       ・base_pay ・ block_hours …… **生の額と生の時間**。
                      画面が出すのは帯の両端だけで、この形の数は1つも出ない */
const POISON = {
  base_iata: 'ZQX', seniority_years: 137, rank_years: 137, age_bucket: '40s',
  period_year: 2026, period_month: 8, created_at: '2026-08-05T00:00:00Z',
  proof_hash: 'deadbeefcafe0001', contract_type: 'direct', tax_country: 'JP',
  nationality: 'JP', annual_total_orig: 19440000, currency: 'JPY', verify_level: 2,
  airline_other: 'Somewhere Air',
  fleet_cat: 'zqx-cat', base_pay: 132456, block_hours: 137.5,
  comp: { m: 73, b: 19, d: 5, h: 2, o: 1 }
};
/* ★字面がぶつからないものを選ぶ。'17' や '2026' のような短い数字は
   年号にたまたま出るので、毒として使えない。 */
const POISON_VALUES = ['ZQX', '137', '40s', 'deadbeefcafe0001',
                       '19,440,000', '19440000', '2026-08-05', 'Somewhere Air',
                       'zqx-cat', '132,456', '132456', '73%', '19%'];

/* ★age ＝ 投稿時期の段（0〜4）。サーバが返すのはこの番号だけで、日付は来ない
     （db/pay-rows.sql の「★投稿の時期について」）。 */
const row = (airline, pos, usd, vf, age, extra) => Object.assign(
  { airline: airline, pos: pos, annual_usd: usd, verified: vf, age: age }, extra || {});

/* ★行を押すと出る面の材料（2026-09-03）。サーバが返す形をそのまま置く。
     pay …… [{ k: 区分, r: [下端, 上端] }]  ── **両端の2つだけ**。中間の位置は無い
     work … { bh / dd / off: [下端, 上端] }  ── この3つだけ（便数もステイも無い）
     ten … 昇格後年数の**段**（0〜4。5年幅・職位で分けない）。年そのものは来ない
   ★帯の刻み（grid）は年収のおよそ40分の1を 1/2/5 へ切り上げたもの。
     18万ドルなら 5,000・25万ドルなら 10,000。下の R_GRID がその写し。
   ★わざと**4通りの欠け方**を混ぜてある ── 全部そろい / 内訳だけ / 勤務だけ / 年収だけ。
     いちばん下（口コミ由来）が「年収だけ」で、押しても空にならないことを見る。 */
const bnd = (base, variable, other, bonus) => [
  { k: 'base', r: base }, { k: 'variable', r: variable },
  { k: 'other', r: other }, { k: 'bonus', r: bonus }];
const WORK = { bh: [60, 70], dd: [14, 16], off: [12, 14] };

/* 本番に近い形（2026-08-23 時点は8人・全員が手入力＝verified はほぼ付かない）。
   ★1人目にだけ毒を混ぜる。★自由入力の社名の人は airline:'other' で来る。
   ★段は5つとも出るように配る（言葉が1つでも欠けていたら気づける）。 */
const ROWS = [
  row('ana', 'cap', 180000, true, 0, Object.assign({}, POISON, {
    fleet: 'b787', ten: 1, tenk: 'r',
    pay: bnd([95000, 100000], [35000, 40000], [10000, 15000], [0, 5000]),
    work: WORK })),
  row('ana', 'fo', 120000, false, 1, {
    fleet: 'a320', ten: 0, tenk: 'r',
    pay: bnd([70000, 75000], [25000, 30000], [10000, 15000], [0, 5000]),
    work: { bh: [70, 80], dd: [16, 18], off: [10, 12] } }),
  /* 内訳だけ（勤務を書かなかった人）。 */
  row('ana', 'cap', 190000, false, 2, {
    fleet: 'b787', ten: 2, tenk: 'r',
    pay: bnd([100000, 105000], [40000, 45000], [15000, 20000], [0, 5000]) }),
  /* 勤務だけ（総支給しか書かず、明細の中身を出さなかった人）。
     ★この1行だけ tenk:'s' ＝ 昇格後年数の欄ができる前の投稿。段は在籍年数から
       作られているので、札は「在籍5年未満」でなければならない（J-3 が見ている）。 */
  row('jal', 'cap', 170000, false, 3, {
    fleet: 'b777', ten: 0, tenk: 's',
    work: { bh: [50, 60], dd: [12, 14], off: [14, 16] } }),
  /* ★年収だけ（口コミ由来）。機材も年数も内訳も勤務も無い。 */
  row('jal', 'fo', 110000, false, 4),
  row('emirates', 'cap', 250000, false, 0, {
    fleet: 'a380', ten: 3, tenk: 'r',
    pay: bnd([130000, 140000], [50000, 60000], [20000, 30000], [0, 20000]),
    work: { bh: [80, 90], dd: [16, 18], off: [10, 12] } }),
  row('other', 'cap', 130000, false, 2, { airline_other: 'Somewhere Air',
    fleet: 'b737', ten: 4, tenk: 'r',
    pay: bnd([70000, 75000], [30000, 35000], [10000, 15000], [0, 5000]),
    work: { bh: [60, 70], dd: [14, 16], off: [12, 14] } }),
  /* ★fo の段の2つ目。fo に3段目が生えていないことは、これが出ることで見える。 */
  row('other', 'fo', 90000, false, 4, {
    fleet: 'b737', ten: 1, tenk: 'r',
    pay: bnd([50000, 55000], [20000, 25000], [5000, 10000], [0, 5000]),
    work: { bh: [60, 70], dd: [14, 16], off: [12, 14] } })
];
/* 帯の刻み。★上の行と対。両端がこの倍数でなければ、どこかで生の額が混ざっている。 */
const R_GRID = ROWS.map((r) => (r.annual_usd >= 200000 ? 10000 : 5000));

/* 画面に出るはずの段の言葉。★これ以外の言い方が出たら、どこかで作り直されている。 */
/* 実物の6列。★骨組みもこれと同じ字でなければならない（賞与の列は無い）。 */
const TH6 = {
  ja: ['航空会社', '職位', '年収', '月あたり', '出典', '投稿時期'],
  en: ['Airline', 'Position', 'Annual', 'Per month', 'Source', 'Submitted']
};

/* ★機材の名前（pv-vocab.json の fleets が返す字）。伏せた一覧には**1語も**出ない。
     ⚠️ 数字だけ（787 など）を本文全体で探さない ── 在籍年数・件数・年号に当たって
        製品は正しいのに赤くなる。見るのは**表と面の中だけ**（tblTexts / 面の text）。 */
const FLEET_WORDS = ['Boeing', 'Airbus', 'A320', 'A380', '787', '777', '737'];

const AGE_WORDS = {
  ja: ['1ヶ月以内', '3ヶ月以内', '6ヶ月以内', '1年以内', 'それより前'],
  en: ['Within 1 month', 'Within 3 months', 'Within 6 months',
       'Within a year', 'Over a year ago']
};

/* 年数の段の札。★画面の言葉をここに書き写している（AGE_WORDS と同じ流儀）。
   黙って言い換えられたら、その場で赤くなるようにしておく。
   ★伏せた一覧（年収型の行）と、行を押すと出る面の両方がこれを見る。 */
/* ★2組ある（2026-09-16）。r＝昇格後年数から作った段 / s＝在籍年数から作った段。
     昇格後年数の欄はこの日に作ったので、それより前の投稿は在籍年数で段を作って
     出す（オーナー指示「これまで提出してもらったものは今まで通り出して」）。
     ⚠️ **同じ字にしないこと。** 同じ札で出した瞬間、古い行が「昇格後20年以上」と
        名乗り直す ＝ この日直した嘘がそのまま戻る。下の J-3 がそこを見ている。 */
const TEN = {
  ja: { r: ['昇格後5年未満', '昇格後5〜10年', '昇格後10〜15年',
            '昇格後15〜20年', '昇格後20年以上'],
        s: ['在籍5年未満', '在籍5〜10年', '在籍10〜15年',
            '在籍15〜20年', '在籍20年以上'] },
  en: { r: ['Under 5 yrs in rank', '5–10 yrs in rank', '10–15 yrs in rank',
            '15–20 yrs in rank', '20+ yrs in rank'],
        s: ['Under 5 yrs at airline', '5–10 yrs at airline',
            '10–15 yrs at airline', '15–20 yrs at airline',
            '20+ yrs at airline'] }
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

/* ★鍵の無い人へ返る「伏せた行」（2026-09-16）。db/pay-rows.sql の mask が返すのは
     **この4つだけ**で、年収も機材も内訳も勤務も入っていない。
   ⚠️ ROWS から作る（手で書き写さない）── 会社・職位・出典・投稿時期の配り方が
      開いている一覧と1バイトずれると、比べているものが別物になる。 */
const MASK_ROWS = ROWS.map((r) => ({
  airline: r.airline, pos: r.pos, verified: r.verified, age: r.age }));
const MASKED = { ok: true, state: 'locked', rows: MASK_ROWS, stats: ST_LOCK,
                 give: { basic: false, detailed: false, payslip: false } };
/* ★同じ locked だが、サーバが**うっかり全部返してしまった**ときの姿（毒入り）。
     画面は「モードがそうだから」板を描く＝ money() も fleetName() も呼ばないので、
     ここに何が入っていても1文字も出ないのが正しい。
   ⚠️ この fixture が、節 P を**本物の漏れ検査**にしている唯一のもの。
      ここを MASK_ROWS に差し替えると、節 P は何も守らなくなる。 */
const LOCKED_LEAK = { ok: true, state: 'locked', rows: ROWS, mine: MINE, stats: ST_LOCK,
                      give: { basic: false, detailed: false, payslip: false } };

/* ★2026-09-18 からサーバが返す形（オーナー指示）。上の8行は機長 → 副操縦士の交互で、
     1人に固定の型（t）ごとに見える欄が違う。9行目以降は t を持たない。
       a 年収型 … 年収・年数の段・出典・時期
       f 機種型 … 職位・機材・年収・出典・時期（年収は 2026-09-19 に足した）
       c 会社型 … 会社・職位・出典・時期（年収は出さない）
       9行目以降 … 会社と時期（上の8行から下がってきた人と預かりは時期だけ）
   ⚠️ 白リストは actual-pay.js の MK_KEYS を読まずに**ここで別に書く**。
      同じ表を読み込んで比べると、両方が同じ向きに間違えたとき気づけない。
   ⚠️ t の無い行は、古いサーバの4つ（会社・職位・出典・時期）まで。
      知らない t の行は時期だけ。 */
const MK_SEE = {
  a: ['annual_usd', 'ten', 'tenk', 'verified', 'age'],
  f: ['annual_usd', 'pos', 'fleet', 'verified', 'age'],
  c: ['airline', 'pos', 'verified', 'age']
};
const MK_OLD4 = ['airline', 'pos', 'verified', 'age'];
/* その行で画面に出てよい欄だけを残す（＝画面が描くべきもの）。 */
const mkSee = (r) => {
  const ks = r.t == null ? MK_OLD4 : (MK_SEE[r.t] || ['age']);
  const o = {};
  ks.forEach((k) => { if (r[k] != null) o[k] = r[k]; });
  return o;
};
/* 上の8行：[ROWS の番号, 型]。機長 → 副操縦士の交互（機長5人・副操縦士3人なので
   最後の2つは機長で埋まる）。★わざと置いた形（番号は ROWS の番号）──
     ROWS[0] … Verified の年収型（出典の印と金額が同じ行に出る）
     ROWS[4] … 機材の無い機種型（口コミ由来）＝機材の場所は板のまま
     ROWS[3] … 在籍年数から作った段の年収型（札は「在籍」でなければならない） */
const MK_TOP = [[0, 'a'], [1, 'c'], [5, 'f'], [4, 'f'], [2, 'c'], [7, 'a'], [6, 'c'], [3, 'a']];
/* サーバが本当に返す形（型に無い鍵は最初から無い）。
   ★10件＝1ページに収まる（8行＋9行目以降の2つ）。 */
const MASK_T_ROWS = MK_TOP.map(([i, t]) => Object.assign(mkSee(Object.assign({}, ROWS[i], { t })), { t }))
  .concat([{ airline: 'jal', age: 4 }, { age: 4 }]);
const MASKED_T = { ok: true, state: 'locked', rows: MASK_T_ROWS, stats: ST_LOCK,
                   give: { basic: false, detailed: false, payslip: false } };
/* ★同じ並びで、サーバが**型を無視して全部入れてしまった**ときの姿（毒入り）。
     会社型に年収・機材、年収型に会社・職位・機材、機種型に会社・年収。
     9行目以降の1つは t の無い全部入り、もう1つは知らない型（t:'z'）の全部入り。
     画面の白リスト（2本目の鍵）だけで、型の外の欄が1文字も出ないこと。 */
const MASK_T_LEAK_ROWS = MK_TOP.map(([i, t]) => Object.assign({}, ROWS[i], { t }))
  .concat([Object.assign({}, ROWS[3]), Object.assign({}, ROWS[5], { t: 'z' })]);
const MASKED_T_LEAK = { ok: true, state: 'locked', rows: MASK_T_LEAK_ROWS, mine: MINE,
                        stats: ST_LOCK, give: { basic: false, detailed: false, payslip: false } };

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

async function open(lang, payload, opt) {
  const page = await fresh();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.evaluateOnNewDocument(FAKE, payload, (opt && opt.anon) ? 1 : 0);
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
      if (!m) return [{ cls: '(.mr-main が無い)', text: '', f: '' }];
      /* ★2026-09-03、**行を押すと出る面**をここに足した。
           あれは body の直下に出る＝ .mr-main の外なので、
           足さないと「面の中だけ検査が届かない穴」になっていた。 */
      const roots = [m, document.querySelector('.ap-dw-back')].filter(Boolean);
      const out = [];
      const all = [];
      roots.forEach(function (r) {
        all.push(r);
        Array.prototype.slice.call(r.querySelectorAll('*')).forEach(function (e) { all.push(e); });
      });
      for (const e of all) {
        const c = getComputedStyle(e);
        const f = c.filter, b = c.backdropFilter || c.webkitBackdropFilter;
        if ((f && f !== 'none') || (b && b !== 'none')) {
          /* ★2026-09-16、**中に何が入っているか**も持ち帰る。
               伏せた一覧の板にはぼかしを掛けてよいが、それは「板の中が空」
               だからで、文字が1つでも入っていたらそれは霞ませているということ。
             ⚠️ className は SVG では文字列にならない。getAttribute で取る。 */
          out.push({
            cls: (e.getAttribute && e.getAttribute('class')) || e.tagName,
            text: (e.textContent || '').replace(/\s+/g, ''),
            f: f + ' / ' + b
          });
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
    /* ── 準備中の札（＝解放条件の説明への入口。2026-09-06 に左メニューから移した）── */
    pills: q('[data-pv-give]').map((e) => ({
      k: e.getAttribute('data-pv-give'),
      tag: e.tagName.toLowerCase(),
      aria: e.getAttribute('aria-label') || '',
      inPanel: !!(e.closest && e.closest('.mr-gate'))
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
    rowSel: q('#ap-rows tbody tr[data-ap-row]').length,
    rowTab: q('#ap-rows tbody tr[tabindex]').length,
    rowGo: q('#ap-rows tbody tr .ap-go[aria-label]').length,
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
    /* ── プレビュー（2026-09-13）─────────────────────────
       ★未ログイン・登録しただけの人に出る作り物の5行。
         **本物の行と同じ骨組み**で描くので、上の trs / amounts / ths /
         rowSel なども全部そのまま効く。ここではプレビュー固有の部品だけ取る。 */
    pvTag: q('.ap-pv-tag', rows).map((e) => (e.textContent || '').trim()),
    pvSub: q('.ap-pv-sub', rows).map((e) => (e.textContent || '').trim()).join(' '),
    pvTrs: q('tbody tr.ap-r--pv', rows).length,
    /* 中身の空いた板。★ぼかしではない（blurred が別に 0 を見張っている）。 */
    pvPlates: q('.ap-amt-lk', rows).length,
    pvPlateText: q('.ap-amt-lk-p', rows).map((e) => (e.textContent || '').trim()).join(''),
    /* 解放案内が tbody の何番目に居るか。★2件目の直後＝ index 2。 */
    pvUnAt: (function () {
      const b = rows && rows.querySelector('tbody');
      if (!b) return -1;
      const kids = Array.prototype.slice.call(b.children);
      return kids.findIndex((e) => e.classList.contains('ap-pv-un-r'));
    })(),
    pvUnCta: q('.ap-pv-un-c', rows).map((e) => e.getAttribute('href')),
    pvMsg: q('.ap-pv-msg', rows).map((e) => e.innerText.trim()).join(' '),
    /* ★未ログインのときだけ出る「すでにアカウントをお持ちの方：ログイン」。 */
    pvIn: q('.ap-pv-in-a').map((e) => e.getAttribute('href')),
    /* ── 伏せた一覧（2026-09-16）─────────────────
       ★鍵の無い人へサーバが返す「会社・職位・出典・投稿時期だけ」の行。
         作り物の5行と違って**本物**なので、件数もページ送りも出る。 */
    mkTbl: q('table.ap-tbl--mk', rows).length,
    mkTrs: q('tbody tr.ap-r--mk', rows).length,
    /* 機材の板だけ。★2026-09-18 から会社・職位の板も同じ部品（.ap-flt-lk）なので、
         機材の場所（.ap-flt-mk）の中だけを数える。 */
    mkFlt: q('.ap-flt-mk .ap-flt-lk', rows).length,
    /* ★行ごとに何が読めて何が板か（2026-09-18）。型ごとに見える欄が違うので、
         数を足し合わせた検査では「別の行の欄が出た」を見逃す。1行ずつ取る。
       ⚠️ 板の中の読み上げ用の字（「会社名は非公開」など）を値として数えない
          ── 板があるかどうかは別に数え、値は板の無い欄からだけ読む。 */
    mkRows: q('tbody tr.ap-r--mk', rows).map((tr) => {
      const n = (s) => tr.querySelectorAll(s).length;
      const one = (s) => { const e = tr.querySelector(s); return e ? (e.textContent || '').trim() : ''; };
      const go = tr.querySelector('.ap-go');
      const lg = tr.querySelector('.ap-logo');
      return {
        i: tr.getAttribute('data-ap-row'),
        air: one('.ap-air'), airLk: n('.ap-flt-lk--air'),
        logoImg: n('img.ap-logo'), logoTxt: lg && lg.tagName !== 'IMG' ? (lg.textContent || '').trim() : '',
        posLk: n('.ap-flt-lk--pos'), pos: n('.ap-flt-lk--pos') ? '' : one('.ap-pos'),
        sub: one('.ap-flt:not(.ap-flt-mk)'), subLk: n('.ap-flt-mk'),
        amt: one('.ap-amt'), mon: one('.ap-mon'), amtLk: n('.ap-amt-lk'),
        vf: n('.ap-vf'), vfNo: n('.ap-vf-no'),
        age: one('.ap-age'),
        go: go ? go.getAttribute('aria-label') || '' : '',
        text: tr.textContent || ''
      };
    }),
    mkHead: (function () {
      const h = rows && rows.querySelector('.ap-lock-h');
      const b = rows && rows.querySelector('.ap-lock-sub');
      return [(h ? h.textContent : ''), (b ? b.textContent : '')].join(' / ').trim();
    })(),
    calls: (window.__rpc || []).map((r) => r.name),
    withArgs: (window.__rpc || []).filter((r) => r.hasArgs).map((r) => r.name),
    tblTexts: q('table', rows).map((t) => t.innerText)
  };
};

/* ★プレビューの5行（2026-09-13）。鍵が無い人の画面は、2026-08-25 の
     「灰色の骨組み」から**作り物の5行**に替わった。ここで見るのは3つ。
       ① 出ているのは5行で、読める金額は先頭2行ぶんだけ
       ② その金額が ap-preview.js の定数どおり ＝ 年収の SSOT どおり
       ③ 「誰かが実際に出した」と読める表示（Verified・投稿時期・件数）が1つも無い
     ⚠️ 「本物を取りに行っていない」ことはここでは見ない。それは下の
        **未ログインの節**（pv_pay_rows を1回も呼ばない／毒が1文字も出ない）の仕事。 */
function previewRows(v, lang, tag) {
  ok(v.pvTrs === 5 && v.rowSel === 5 && v.rowGo === 5,
     `${tag}: ★プレビューの5行が出て、どれも押して開ける`,
     `行${v.pvTrs} / 押せる${v.rowSel} / ›${v.rowGo}`);
  ok(v.pvTag.length === 1 && v.pvSub === '',
     `${tag}: ★見出しに付くのは「プレビュー」の札だけ（説明の1行は置かない）`,
     `${v.pvTag.join(',')} / ${v.pvSub}`);
  ok(v.amounts.length === 2 && v.mons.length === 2,
     `${tag}: ★読める金額は先頭2行ぶんだけ`,
     `年収${JSON.stringify(v.amounts)} / 月${JSON.stringify(v.mons)}`);
  /* ★残りは**中身の空いた板**。ぼかしでも伏せ字でもない（数字が最初から無い）。
       3行 × 2欄（年収・月あたり）＝ 6枚。 */
  ok(v.pvPlates === 6 && v.pvPlateText === '',
     `${tag}: ★残り3行は中身の空いた板（文字が1つも入っていない）`,
     `${v.pvPlates}枚 / ${JSON.stringify(v.pvPlateText)}`);
  /* ★★画面に出た金額が ap-preview.js の定数そのままか。
       日本語は円に直したあとの SSOT の万円と**ぴったり**（sig2n は上で突き合わせ済み）。 */
  {
    const want = PV_ROWS.filter((r) => r.annual_usd != null)
      .map((r) => (lang === 'ja' ? r._man * 1e4 : sig2n(r.annual_usd)));
    const got = v.amounts.map(amountValue);
    ok(JSON.stringify(got) === JSON.stringify(want),
       `${tag}: ★★出ている金額が ap-preview.js の定数どおり（年収の SSOT 由来）`,
       `${JSON.stringify(got)} / 期待 ${JSON.stringify(want)}`);
  }
  /* ★解放案内は2件目の直後に1枚だけ。全画面の覆いにしない（指示書 §3）。 */
  ok(v.pvUnAt === 2 && v.pvUnCta.length === 1
     && /pay-report\.html#ps/.test(v.pvUnCta[0] || ''),
     `${tag}: ★解放案内は2件目の直後に1枚だけ・行き先は給与フォーム`,
     `${v.pvUnAt} / ${v.pvUnCta.join(',')}`);
  /* ★「誰かが実際に出した」と読める表示を1つも出さない。 */
  ok(v.vf === 0, `${tag}: ★Verified の印も「本人申告」も出ない`, String(v.vf));
  ok(v.ages.length === 0, `${tag}: ★投稿時期（◯ヶ月以内）を1つも出さない`,
     v.ages.join(','));
  {
    const w = AGE_WORDS[lang].filter((x) => v.rowsText.indexOf(x) >= 0);
    ok(w.length === 0, `${tag}: ★投稿時期の言葉が本文にも出ない`, w.join(','));
  }
  /* ★この5行を件数として数えない ── ページ送りも「全N件中」も帯の件数も出さない。 */
  ok(v.pgBtns.length === 0 && v.pgNums.length === 0 && v.pgLabel === '',
     `${tag}: ★ページ送りも「全N件中」も出さない（5行を件数にしない）`,
     `${v.pgBtns.length}/${v.pgNums.length}/${v.pgLabel}`);
  /* ★表の下の1文は残す（この一覧が誰に開くのかの約束）。 */
  ok(v.rowsText.indexOf(lang === 'ja' ? '給与を出したパイロットだけ' : 'only by pilots who have submitted') >= 0,
     `${tag}: ★表の下の「出した人だけが読めます」は残っている`);
}

/* ★伏せた本物の一覧（2026-09-16／2026-09-18 に行ごとの型を入れた）。鍵の無い人に
     出るのは**本物の行**で、どの欄が読めるかは行ごとに違う（上の MK_SEE）。
     読めない欄は「中身の空いた板」＝ぼかしを外しても、そこには最初から何も無い。
   sent … サーバが返した行そのもの（毒入りでもよい）。画面が描いてよいものは
          mkSee() が決める＝**サーバが何を混ぜても、それ以上は出ない**ことを見る。
   ⚠️ この関数は blurOK() と**対**で使う。板が在ることはここが、その板に
      ぼかしが掛かっているかは blurOK が見る。片方だけだと静かに壊れる
      ── .ap-r--mk を付け忘れた板は「くっきり空」で、何も読めないので
         画面は正しく見えてしまう。 */
const MK_AIR_WORDS = (() => {
  const a = JSON.parse(read('pv-airlines.json')).airlines || {};
  const out = { ja: ['ANA', 'JAL', 'Somewhere Air'], en: ['ANA', 'JAL', 'Somewhere Air'] };
  ['ana', 'jal', 'emirates'].forEach((c) => {
    if (a[c]) { out.ja.push(a[c].ja); out.en.push(a[c].en); }
  });
  return out;
})();
const MK_POS_WORDS = { ja: ['機長', '副操縦士'], en: ['Captain', 'First Officer'] };
const MK_OPEN = { ja: 'この記録を開く', en: 'Open this record' };
function maskedRows(v, lang, tag, sent) {
  const n = sent.length;
  const want = sent.map(mkSee);
  ok(v.mkTbl === 1 && v.mkTrs === n && v.rowSel === n && v.rowGo === n,
     `${tag}: ★伏せた行が${n}行出て、どれも押して開ける`,
     `表${v.mkTbl} / 行${v.mkTrs} / 押せる${v.rowSel} / ›${v.rowGo}`);
  ok(v.pvTrs === 0 && v.pvTag.length === 0,
     `${tag}: ★★作り物の5行も「プレビュー」の札も1つも混ざらない`,
     `${v.pvTrs}行 / ${v.pvTag.join(',')}`);
  ok(v.mkRows.length === n && v.mkRows.every((r, i) => r.i === String(i)),
     `${tag}: ★行はサーバの並びのまま（画面で並べ替えない）`,
     v.mkRows.map((r) => r.i).join(','));
  ok(JSON.stringify(v.ths) === JSON.stringify(TH6[lang]),
     `${tag}: ★列は開いている表と同じ6つ`, v.ths.join(','));

  /* ── 1行ずつ：型で読めてよい欄だけが読め、ほかは板 ─────────────── */
  const bad = [];
  v.mkRows.forEach((r, i) => {
    const w = want[i] || {};
    const why = [];
    if (w.airline != null) {
      if (!(r.air !== '' && r.airLk === 0)) why.push('会社が読めない');
    } else if (!(r.air === '' && r.airLk === 1 && r.logoImg === 0 && r.logoTxt === '')) {
      why.push(`会社が板になっていない（${r.air}/${r.logoTxt}/ロゴ${r.logoImg}）`);
    }
    if (w.pos != null) {
      if (!(r.pos !== '' && r.posLk === 0)) why.push('職位が読めない');
    } else if (!(r.pos === '' && r.posLk === 1)) why.push(`職位が板でない（${r.pos}）`);
    const tn = typeof w.ten === 'number' ? TEN[lang][w.tenk === 's' ? 's' : 'r'][w.ten] : '';
    if (w.fleet != null) {
      if (!(r.sub !== '' && r.subLk === 0)) why.push('機材が読めない');
    } else if (tn) {
      if (!(r.sub === tn && r.subLk === 0)) why.push(`段が「${tn}」でない（${r.sub}）`);
    } else if (!(r.sub === '' && r.subLk === 1)) why.push(`機材の場所が板でない（${r.sub}）`);
    if (w.annual_usd != null) {
      if (!(r.amt !== '' && r.mon !== '' && r.amtLk === 0 && isSig2(amountDigits(r.amt)))) {
        why.push(`年収が読めない（${r.amt}/${r.mon}）`);
      }
    } else if (!(r.amt === '' && r.mon === '' && r.amtLk === 2)) {
      why.push(`年収が板でない（${r.amt}/${r.mon}/板${r.amtLk}）`);
    }
    if (w.verified != null) {
      const y = w.verified === true;
      if (!(r.vf === (y ? 1 : 0) && r.vfNo === (y ? 0 : 1))) why.push('出典が違う');
    } else if (r.vf + r.vfNo !== 0) why.push('出典が出ている');
    if (r.age !== (AGE_WORDS[lang][w.age] || '')) why.push(`時期が違う（${r.age}）`);
    /* ★› の読み上げ。会社と職位の両方が読める行だけ名前を作る。 */
    if (w.airline != null && w.pos != null) {
      if (!(r.go !== MK_OPEN[lang] && r.go.includes(r.air))) why.push(`読み上げ（${r.go}）`);
    } else if (r.go !== MK_OPEN[lang]) why.push(`読み上げに名前が入った（${r.go}）`);
    /* ★行の文字（読み上げ用の字も含む）に、読めないはずの値が1文字も無い。 */
    if (w.annual_usd == null && /[¥$€£＄]|万/.test(r.text)) why.push('通貨の字が出た');
    if (w.fleet == null) {
      const f = FLEET_WORDS.filter((x) => r.text.includes(x));
      if (f.length) why.push('機材の名前が出た ' + f.join(','));
    }
    if (w.airline == null) {
      const a = MK_AIR_WORDS[lang].filter((x) => r.text.includes(x));
      if (a.length) why.push('会社名が出た ' + a.join(','));
    }
    if (w.pos == null) {
      const p = MK_POS_WORDS[lang].filter((x) => r.text.includes(x));
      if (p.length) why.push('職位が出た ' + p.join(','));
    }
    if (why.length) bad.push(`${i}(${sent[i].t || '-'}): ${why.join(' / ')}`);
  });
  ok(bad.length === 0, `${tag}: ★★どの行も、型で読めてよい欄だけが読め、ほかは中身の空いた板`,
     bad.join(' | '));
  /* ★★会社名と、年収・機材・年数の段が同じ行に並ばない（オーナー判断の芯）。 */
  {
    const both = v.mkRows.filter((r) => r.air !== '' && (r.amt !== '' || r.sub !== ''));
    ok(both.length === 0, `${tag}: ★★会社名と年収・機材・年数の段が同じ行に1つも並ばない`,
       both.map((r) => `${r.i}:${r.air}/${r.amt}/${r.sub}`).join(' | '));
  }
  /* ── まとめて（1行ずつの検査と、表全体の数が食い違っていないか）──────── */
  const nAmt = want.filter((w) => w.annual_usd != null).length;
  ok(v.amounts.length === nAmt && v.mons.length === nAmt,
     `${tag}: ★読める金額は年収型と機種型の行の分だけ（${nAmt}行）`,
     `年収${v.amounts.join(',')} / 月${v.mons.join(',')}`);
  ok(v.pvPlates === (n - nAmt) * 2 && v.pvPlateText === '',
     `${tag}: ★ほかの行の年収と月あたりは中身の空いた板（文字が1つも入っていない）`,
     `${v.pvPlates}枚 / ${JSON.stringify(v.pvPlateText)}`);
  /* ★機材の板は「値が無いから消える」にしない。読めない行には必ず置く。 */
  const nFlt = want.filter((w) => w.fleet == null && typeof w.ten !== 'number').length;
  ok(v.mkFlt === nFlt, `${tag}: ★機材の場所は、読めない行にはどれも板がある（${nFlt}行）`,
     `${v.mkFlt}枚`);
  ok(v.ages.length === n && v.ages.every((t) => AGE_WORDS[lang].includes(t)),
     `${tag}: ★投稿時期はどの行でも読める`, v.ages.join(','));
  if (want.some((w) => w.verified === true)) {
    ok(v.vf >= 1, `${tag}: ★Verified の印も伏せない（出典を出す行では）`, String(v.vf));
  }
  {
    const t = v.tblTexts.join(' ');
    const p = POISON_VALUES.filter((x) => t.includes(x));
    ok(p.length === 0, `${tag}: ★★サーバが混ぜた本物が表に1文字も出ない`, p.join(','));
  }
  /* ── 本物だから出すもの（作り物の5行とはここが逆）──────────── */
  ok(v.pgLabel !== '', `${tag}: ★「全N件中」を出す（数えているのが本物だから）`, v.pgLabel);
  /* ── 出す側へ戻る道 ─────────────────────────────── */
  ok(v.pvUnAt === 2 && v.pvUnCta.length === 1
     && /pay-report\.html#ps/.test(v.pvUnCta[0] || ''),
     `${tag}: ★「匿名で給与を追加する」は2件目の直後に1枚だけ`,
     `${v.pvUnAt} / ${v.pvUnCta.join(',')}`);
  ok(v.cta.some((h) => /pay-report\.html#ps/.test(h || '')),
     `${tag}: ★錠前パネルの「匿名で給与を追加する」も出ている`, v.cta.join(','));
  /* ★何が伏せてあるかを見出しの下の1行で言う。黙って板だけ並べると壊れて見える。 */
  ok(v.mkHead !== '' && v.mkHead.indexOf('/') > 0,
     `${tag}: ★一覧の頭に見出しと、伏せている物を言う1行が出る`, v.mkHead);
}
/* 板の数（blurOK の下限）。年収と月あたりで2枚、会社・職位・機材の場所で1枚ずつ。 */
const mkPlates = (sent) => sent.map(mkSee).reduce((s, w) => s
  + (w.annual_usd == null ? 2 : 0) + (w.airline == null ? 1 : 0) + (w.pos == null ? 1 : 0)
  + (w.fleet == null && typeof w.ten !== 'number' ? 1 : 0), 0);

/* ★伏せた行を押して開く面。一覧と同じ白リスト（mkSee）を、面の側でも見る。
     sent … その行としてサーバが返したもの（毒入りでもよい）。 */
function maskedDrawer(d, tag, sent, lang) {
  const w = mkSee(sent);
  ok(/actual-pay\.html$/.test(d.path),
     `${tag}: ★詳細を押してもこの画面から動かない`, d.path);
  if (w.annual_usd != null) {
    ok(d.av.length === 2 && d.avLk === 0 && isSig2(amountDigits(d.av[0])),
       `${tag}: ★年収を出す型の行は、面でも年収と月あたりが読める（有効数字2桁）`,
       `読める${d.av.join(',')} / 板${d.avLk}`);
  } else {
    ok(d.av.length === 0 && d.avLk === 2,
       `${tag}: ★★面でも年収と月あたりは中身の空いた板`,
       `読める${d.av.length} / 板${d.avLk}`);
  }
  /* ── 面の題（会社）と、その下の1行（職位・機材・年数の段）─────────── */
  if (w.airline != null) {
    ok(d.airTxt !== '' && d.airLk === 0, `${tag}: ★会社を出す型では、面の題が会社名`,
       `${d.airTxt} / 板${d.airLk}`);
  } else {
    ok(d.airTxt === '' && d.airLk === 1 && d.logoImg === 0 && d.logoTxt === '',
       `${tag}: ★★会社を出さない型では、面の題も板（ロゴも頭文字も出さない）`,
       `${d.airTxt} / 板${d.airLk} / ロゴ${d.logoImg} / ${d.logoTxt}`);
  }
  ok((w.pos != null) === (d.posLk === 0),
     `${tag}: ★職位は、読めてよい型だけ読める（ほかは板）`, `板${d.posLk} / ${d.meta}`);
  {
    const tn = typeof w.ten === 'number' ? TEN[lang][w.tenk === 's' ? 's' : 'r'][w.ten] : '';
    const tAll = TEN[lang].r.concat(TEN[lang].s).filter((x) => d.meta.includes(x));
    ok(tn ? (tAll.length === 1 && tAll[0] === tn) : tAll.length === 0,
       `${tag}: ★年数の段は、年収型の行にだけ出る（札は段の出どころどおり）`,
       `${tAll.join(',')} / 期待 ${tn || 'なし'}`);
    ok((w.fleet != null) === (d.fltLk === 0),
       `${tag}: ★機材は、読めてよい型だけ読める（ほかは板）`, `板${d.fltLk} / ${d.meta}`);
  }
  ok(d.keys.length === 0 && d.plates === '',
     `${tag}: ★内訳の帯は項目名ごと出さない（受け取っていないので）`,
     `${d.keys.length}項目 / ${JSON.stringify(d.plates)}`);
  ok(d.tag === 0, `${tag}: ★「プレビュー」の札は付けない（本物の投稿だから）`, String(d.tag));
  /* ★出典は、出してよい行だけ。9行目以降は投稿時期だけ（「本人申告」と書くと嘘になりうる）。 */
  ok(d.srcDw === 2 + (w.verified === true ? 1 : 0)
     && d.vfNoDw === (w.verified === false ? 1 : 0),
     `${tag}: ★出典は出してよい行だけ・投稿時期はどの行でも読める`,
     `${d.srcDw} / 本人申告${d.vfNoDw}`);
  ok(d.sim === 0, `${tag}: ★「同じ会社のほかの記録」は出さない（金額を並べる節）`,
     String(d.sim));
  ok(d.note === 0, `${tag}: ★伏せた面に、匿名化の断り書きを付けない`, String(d.note));
  ok(d.cta.length === 1 && /pay-report\.html/.test(d.cta[0] || ''),
     `${tag}: ★★面から出る道は給与フォーム1つだけ（DEEP PAY の門へ行かせない）`,
     d.cta.join(' | '));
  /* ── 面の文字に、読めないはずの値が1文字も無い ─────────────── */
  /* ⚠️ ここで MONEY（\d[\d,]{2,} を含む）を使わない。投稿時期の「1ヶ月以内」に
       当たって**製品は正しいのに赤くなる**。見るのは金額そのものの形だけ。 */
  if (w.annual_usd == null) {
    ok(!/[¥$€£＄]|万/.test(d.text),
       `${tag}: ★★面に通貨の記号も「万」も1文字も無い`,
       d.text.replace(/\n/g, ' / ').slice(0, 160));
  }
  if (w.fleet == null) {
    const f = FLEET_WORDS.filter((x) => d.text.includes(x));
    ok(f.length === 0, `${tag}: ★★面にも機材の名前が1語も出ない`, f.join(','));
  }
  if (w.airline == null) {
    const a = MK_AIR_WORDS[lang].filter((x) => d.text.includes(x));
    ok(a.length === 0, `${tag}: ★★面にも会社名が1語も出ない`, a.join(','));
  }
  if (w.pos == null) {
    const p = MK_POS_WORDS[lang].filter((x) => d.text.includes(x));
    ok(p.length === 0, `${tag}: ★★面にも職位が1語も出ない`, p.join(','));
  }
  {
    const p = POISON_VALUES.filter((x) => d.text.includes(x));
    ok(p.length === 0, `${tag}: ★★面にサーバが混ぜた本物が1文字も出ない`, p.join(','));
  }
}

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
  /* ★★2026-09-13、ここは**方針ごと入れ替わった**。
       前は「行も金額も1つも描かない」だった（灰色の骨組みだけ）。
       いまは ap-preview.js の**作り物の5行**を描く ── 検索や LP から来た人が、
       この画面に何が載るのかを一度も見ないまま去っていたため（オーナー指示）。
     ⚠️ 守る線は1ミリも動いていない。「本物を1バイトも渡さない」は
        サーバ（pv_pay_rows が行ゼロ）と、下の**未ログインの節**が見張る。 */
  previewRows(v, lang, lang);
  ok(v.cta.some((h) => /pay-report\.html#ps/.test(h)),
     'Give & Get の導線（匿名で給与を追加）が出る', v.cta.join(','));

  /* ★ぼかしで隠していないこと（2026-08-25）。
       クラス名ではなく、実際に効いている値を見ている。 */
  ok(v.blurred.length === 0, '★本文にぼかしが1つも掛かっていない（隠すのではなく渡さない）',
     blurWhy(v));

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
    /* ★2026-09-13 オーナー指示で、ヒーローの「あなたの給与を1件共有すると解放されます。
         給与明細でも手入力でもかまいません。」は消えた。同じことを言っているのは
         3段の「出すもの」（手動入力か明細読み取り）なので、そちらで見る。 */
    const says = lang === 'ja'
      ? /給与を1件|あなたの1件/.test(t) && /手動入力/.test(t)
      : /one record/i.test(t) && /manual entry/i.test(t);
    ok(says, `${lang}: ★「給与1件（手動入力でも可）で開く」と書いてある`, t.slice(0, 140));
  }

  /* ★Give → Get の3段が出ていて、開くのは REAL PAY だけと分かること。 */
  {
    const g = v.give;
    ok(g.length === 3, `${lang}: ★Give → Get が3段そろっている`, JSON.stringify(g));
    ok(g[0] && g[0].t === 'REAL PAY' && g[0].live,
       `${lang}: ★REAL PAY だけが今日ひらく段`, JSON.stringify(g[0] || {}));
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
    /* ★「いま開きます」と書かない（2026-09-15 オーナー指示）。まだ給与を出していない人が
         この画面を見ているのに「開いている」と読めてしまう。札には条件をそのまま書く。 */
    const openNow = lang === 'ja' ? /いま開き|今開き/ : /open now/i;
    ok(g[0] && !openNow.test(g[0].s),
       `${lang}: ★REAL PAY の札が「もう開いている」と読めない`, JSON.stringify(g[0] || {}));
  }

  /* ★左メニュー：門は REAL PAY の1つだけ（2026-09-06）。
       DEEP PAY / VERIFIED PAY の「準備中」の段は撤去した ── 押しても行き先が無い
       段を7項目のナビに混ぜない。DEEP PAY は Phase 6 で REAL PAY の内側へ、
       VERIFIED PAY は本物の検証機能が出来るまで出さない。
       ⚠️ **Give → Get の3段（上のブロック）とは別物。** あちらは本文の案内で
          「準備中」と書いてあるのが正しい。ここはナビの段。混同しない。 */
  {
    const by = Object.fromEntries(v.gates.map((x) => [x.k, x]));
    ok(by.real && by.real.locked && by.real.lk === 1,
       `${lang}: ★鍵が無いあいだ REAL PAY にも錠前が出る`, JSON.stringify(by.real || {}));
    ok(by.real && by.real.tag === 'a' && /actual-pay\.html/.test(by.real.href || ''),
       `${lang}: ★錠前が出ていても REAL PAY はリンクのまま（行き止まりを作らない）`,
       JSON.stringify(by.real || {}));
    ok(v.gates.length === 1,
       `${lang}: ★★門は REAL PAY の1つだけ（deep / verified の段を戻していない）`,
       v.gates.map((x) => x.k).join(' / '));
    /* ★★段を撤去したぶん、DEEP PAY の説明への入口は札が引き受ける。
         ここが消えると「あと79人」も「内訳を共有すると」も**開く道が無くなる**
         （2026-08-25 のオーナー指示そのものが画面から消える）。
         押せない <span> に戻っていないかまで見る。
       ⚠️ **VERIFIED PAY の札は押せないまま**（2026-09-06 オーナー確定）。
          本人確認の機能がまだ無いので、新しいクリック導線を作らない・目立たせない。
          押せる札は data-pv-give を持つので、verified がここに1つも出ないことを見る。 */
    const byP = Object.fromEntries(v.pills.map((x) => [x.k, x]));
    ok(byP.deep && byP.deep.tag === 'button' && byP.deep.aria && !byP.deep.inPanel,
       `${lang}: ★★deep の札が説明を開く入口になっている（段を消した先の受け皿）`,
       JSON.stringify(byP.deep || {}));
    ok(!byP.verified,
       `${lang}: ★★verified の札は押せない（検証機能が出来るまで導線を作らない）`,
       JSON.stringify(byP.verified || {}));
    ok(v.pills.every((x) => x.k === 'deep'),
       `${lang}: ★★押せる札は DEEP PAY だけ`, v.pills.map((x) => x.k).join(' / '));
  }
  /* ★2026-09-13、プレビューが出るようになったので帯も出る（選択肢が空ではない）。
       会社は**公開している会社マスタ**から作る ── 選んでも本物の投稿も件数も
       取りに行かない（下の未ログインの節で、選んでも RPC が増えないことを見る）。 */
  ok(v.barHidden === false, '★絞り込みの帯が出る（プレビューを会社で絞れる）',
     String(v.barHidden));
  ok(v.airOpts.length > 20,
     '★会社の選択肢は公開マスタから（プレビューの5社だけに絞らない）',
     String(v.airOpts.length));
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
    /* ★列は実物と同じ6つ。ただし**出典と投稿時期の欄は空**にしてある
         （どちらも「誰かが実際に提出した」という事実の主張になるため）。 */
    ok(v.ths.length === 6,
       `${lang}: ★プレビューの表も実物と同じ6列`, JSON.stringify(v.ths));
    ok(JSON.stringify(v.ths.slice(0, 4)) === JSON.stringify(TH6[lang].slice(0, 4)),
       `${lang}: ★左の4列の見出しは実物と同じ字`, JSON.stringify(v.ths));
    ok(v.ths[4] === '' && v.ths[5] === '',
       `${lang}: ★出典と投稿時期の見出しは空（プレビューはその2つを出さない）`,
       JSON.stringify(v.ths.slice(4)));
    const bonus = lang === 'ja' ? /賞与|ボーナス/ : /bonus/i;
    ok(!bonus.test(v.ths.join(' ')),
       `${lang}: ★賞与の列が無い（実物に無い列を描かない）`, v.ths.join(','));
    /* ★灰色の骨組み（2026-08-25）はもう出さない。ap-preview.js が読めなかった
         ときの落ち先としてコードには残してあるが、普段この道は通らない。 */
    ok(v.skelBars === 0 && v.skelThs.length === 0,
       `${lang}: ★灰色の骨組みは出ない（プレビューに置き替わった）`,
       `${v.skelBars}本 / ${v.skelThs.join(',')}`);
    ok(v.skelLock !== '' && !/\d{3,}/.test(v.skelLock),
       `${lang}: ★骨組みの上に錠前つきの1文が出る`, v.skelLock);
    /* ★2026-09-03、4行 → 7行（機材・報酬の内訳・勤務が増えた）。
         この7行は mail-bot/announce-mail.mjs にも1文字違わず写してあり、
         db/test-announce.mjs が突き合わせている＝メールだけ古い主張が残らない。 */
    ok(v.seeItems.length === 7 && v.seeNote !== '',
       `${lang}: ★「REAL PAY で見えること」7行＋「1円単位は出ない」の1文`,
       `${v.seeItems.length} / ${v.seeNote}`);
    /* ★「機種は表示しません」の1文は 2026-09-03 に消した ── 嘘になったため。
         代わりに置いたのが「金額はすべて帯」。**言い換えではなく差し替え**。 */
    const band = lang === 'ja' ? /帯/ : /range/i;
    ok(band.test(v.seeNote), `${lang}: ★「金額はすべて帯」の1文がある`, v.seeNote);
    const oldLine = lang === 'ja' ? /機種は表示しません/ : /fleet is not shown/i;
    ok(!oldLine.test(v.seeNote), `${lang}: ★古い「機種は表示しません」が残っていない`, v.seeNote);
    /* ★見えることに、実際には出していないものを書かない。
         ⚠️ en の base は「基地」以外の意味でも使う語なので、基地の意味のときだけ拾う。
            機材・在籍・賞与は出すようになったので、この一覧から外した。 */
    const lies = lang === 'ja'
      ? (v.seeItems.join(' ').match(/基地|年代|国籍|手取り/g) || [])
      : (v.seeItems.join(' ').match(/\bhome base\b|base airport|\bage\b|nationality|take-home/gi) || []);
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
  /* ★★数え上げは**サーバの数**、行は**作り物**。この2つが同じ画面に並ぶので、
       混ざっていないことをここで見る（2026-09-13）。
       上の 11 / 7 / 3 がそのまま出ていれば、プレビューの5行は1件も足されていない
       （足していれば 16 / 12 / 3 のように動く）。 */
  previewRows(v, lang, lang);
  ok(v.stats.map((c) => c.n.replace(/[^\d]/g, '')).join(',') === '11,7,3',
     `${lang}: ★★プレビューの5行を数え上げに1件も足していない`,
     JSON.stringify(v.stats.map((c) => c.n)));
  ok(v.blurred.length === 0, `${lang}: ★ぼかしが1つも掛かっていない`, blurWhy(v));

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
       この人はまだ内訳を出していないので「内訳を足す」側が出る。
       ⚠️ 押すのは**本文の Give → Get の3段の札**（2026-09-06）。
          もとは左メニューの DEEP PAY だったが、ナビを7項目へ畳んだ回に
          あの段を撤去した。撤去だけすると鍵を持たない人にはこの説明への道が
          1つも無くなるので、入口を「21 / 100人」の札へ移してある。 */
  {
    const g = await page.evaluate(() => {
      const b = document.querySelector('[data-pv-give="deep"]');
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
    const b = document.querySelector('[data-pv-give="deep"]');
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
   A-3 錠前を押したとき（2026-08-25）
   ★オーナー指示「未解放の場合は lock 状態を表示してクリック可能にし、
     クリック後に何を Give すると何が Get できるかを説明する」。
   ★ここで作るのは**覆いではない**。招待の着地と同じで、
     スクロールを止めない・下のページを残す・閉じ方が3つある。
   ★2026-09-06、押す場所が変わった ── 左メニューの DEEP PAY / VERIFIED PAY の段は
     ナビを7項目へ畳んだ回に撤去したので、入口は本文の Give → Get の3段の札。
     **説明そのものは1文字も変えていない。**（REAL PAY の段だけは今も左メニューに在る）
   ════════════════════════════════════════════════════════════════ */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / A-3 ロックを押す ════`);
  const { page, errs } = await open(lang, LOCKED);

  /* DEEP PAY（ページが無い側）の札を押す。 */
  const g = await page.evaluate(() => {
    const b = document.querySelector('[data-pv-give="deep"]');
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

  ok(!g.no, `${lang}: ★錠前（準備中の札）を押すと説明が出る`, JSON.stringify(g));
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
    const open1 = () => { document.querySelector('[data-pv-give="deep"]').click(); };
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
  /* ★2026-09-03、オーナー判断で行を押せるようにした（2026-08-24 に消したもの）。
       ⚠️ 戻したのは「押すと開く」までで、**開くのは帯だけの面**。
          ドーナツも割合も戻していない（下の donut === 0 が対）。
     ★全行に付いていること。1行でも欠けると「押せる行と押せない行」が混ざり、
       押せない行の人だけ内訳が無いように読める。 */
  ok(v.rowSel === v.trs && v.trs > 0,
     '★どの行も押せる（押せる行と押せない行が混ざっていない）',
     `${v.rowSel} / ${v.trs}`);
  ok(v.rowTab === 0,
     '★<tr> に tabindex を置いていない（入口は行末のボタン1つ）', String(v.rowTab));
  ok(v.rowGo === v.trs,
     '★行末の「›」が全行にあり、読み上げ用の名前を持っている', `${v.rowGo} / ${v.trs}`);
  ok(v.donut === 0, '★ドーナツはこの画面に1つも無い（DEEP PAY へ移した）', String(v.donut));

  /* ★原本通貨は返していない＝表は表示通貨に揃っている。 */
  ok(!/[€£₩]|AED|SGD|HKD/.test(v.tblTexts.join(' ')),
     '★原本通貨の記号が表に出ない（表示通貨に揃っている）',
     v.tblTexts.join(' ').slice(0, 120));

  /* ★表は幅いっぱい（2026-08-24 に図を外したので、右に置くものが無い）。 */
  ok(v.tblWide && Math.abs(v.tblWide.tw - v.tblWide.mw) <= 2,
     '★表は本文の幅いっぱいに広がる', JSON.stringify(v.tblWide));

  /* ★⑤数え上げ。表そのものに数え方の言葉を1つも置かない。
     ★ただし出典の札（本人申告 / Self-reported）だけは別。あれは数え方ではなく
       「その額がどこから来たか」で、たまたま「人」「report」の字を含むだけ。
       札の文字列そのものを外してから、残りを元どおり厳しく見る。
       外すのは札だけ＝他の場所に「3件」「5人」が出れば今までどおり落ちる。
     ⚠️ actual-pay.js の T.vfNo を変えたら、**同じコミットでここも直す**。
        直し忘れると画面は正しいのにこの検査だけが赤くなる
        （2026-09-03、「本人記録」→「本人申告」で実際に踏んだ。
         新しい札は日英とも「人」「report」を字として含んでいる）。 */
  const VF_LABELS = ['本人申告', 'Self-reported'];
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
  const step = await page.evaluate(async () => {
    /* ★打ち込みは 250ms 待ってから絞る作りにした（2026-09-04・iPhone の親指入力）。
         打った直後はまだ前の一覧のまま。**条件が満たされるまで**待つ
         ── sleep で待つと、混んだ回に嘘の赤が出る。 */
    const until = (f) => new Promise((res) => {
      const t0 = performance.now();
      const tick = () => {
        if (f() || performance.now() - t0 > 4000) return res();
        requestAnimationFrame(tick);
      };
      tick();
    });
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
    await until(() => document.getElementById('ap-air').options.length === 2);
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

  const sweep = await page.evaluate(async () => {
    /* ★打ち込みの 250ms 待ち（上と同じ理由）。 */
    const until = (f) => new Promise((res) => {
      const t0 = performance.now();
      const tick = () => {
        if (f() || performance.now() - t0 > 4000) return res();
        requestAnimationFrame(tick);
      };
      tick();
    });
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
      await until(() => g('ap-air').value !== a);
      combos++;
      if (g('ap-air').value === a) dead.push('q=zzq でも air=' + a + ' が残る');
      qi.value = '';
      qi.dispatchEvent(new Event('input', { bubbles: true }));
      /* ★次の周に入る前に選択肢が戻るまで待つ。戻る前に選ぶと
           「選択肢に無い値」を入れることになり、以降ぜんぶ空振りする。 */
      await until(() => g('ap-air').options.length > 1);
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
// I. DEEP PAY の札は、数え上げが来ない場面でも同じ数になる（2026-08-25）
// ════════════════════════════════════════════════════════════════
/* もとは「左メニューの DEEP PAY を押すとどこでも同じ説明が開くのに、数を持って
   いたのは pv_pay_rows() を引く2画面だけだった」という食い違いを直した節。
   直した形は「押されたときに1回だけ pv_give_progress() に聞く」。

   ⚠️ 2026-09-06、押す場所が左メニューから**本文の Give → Get の3段の札**へ移った
      （ナビを7項目へ畳んだ回に DEEP PAY / VERIFIED PAY の段を撤去したため）。
      仕掛けは1バイトも変わっていないので、見るものも同じ4つ。場面だけ、
      「札は在るがサーバが数え上げを返さない」＝ stats の無い locked に置き換えた。

     ① 数を渡されない場面でも、押せば「17 / 100人」になる
     ② 聞くのは**押されたときだけ**（開いただけでは1本も投げない）
     ③ 聞くのは**1度きり**（何度押しても増えない）
     ④ 既に数を持っている場面では**聞かない**（stats が来ている locked）
   ★サーバがまだ古い（札の口が無い）ときは黙って「準備中」のまま。0 を置かない。 */
{
  const PROG = { ok: true, contributors: 17,
                 give: { basic: false, detailed: false, payslip: false } };

  /* DEEP PAY の札を押して、札と RPC の呼ばれ方を読む。 */
  const pressDeep = (times) => page => page.evaluate(async (n) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    /* ⚠️ **毎回引き直す。** 数が届くと refreshGive() が3段を丸ごと作り直すので、
         最初に掴んだ札は2回目の時点で DOM から外れている（押しても document に届かない）。
         人は画面に出ているものを押すので、こちらも押す直前に引き直す。 */
    if (!document.querySelector('[data-pv-give="deep"]')) return { no: true };
    for (var i = 0; i < n; i++) {
      var b = document.querySelector('[data-pv-give="deep"]');
      if (b) b.click();
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

  const nRpc = (calls, name) => calls.filter((n) => n === name).length;

  for (const lang of ['ja', 'en']) {
    console.log(`\n════ ${lang} / I 数え上げが来ない場面で札を押す ════`);

    // ①②③ 札の口がある状態（stats が来ないので setProgress は数を持たない）
    const { page, errs } = await open(lang, Object.assign({ progress: PROG }, LOCKED));
    const before = await page.evaluate(() => (window.__rpc || []).map((r) => r.name));
    ok(!before.includes('pv_give_progress'),
       `${lang}: ★開いただけでは1本も投げない（押されたときだけ聞く）`, before.join(','));
    const rows0 = nRpc(before, 'pv_pay_rows');

    const g = await pressDeep(3)(page);
    ok(!g.no, `${lang}: DEEP PAY の説明が開く`);
    ok(nRpc(g.calls, 'pv_give_progress') === 1,
       `${lang}: ★3回押しても聞くのは1度きり`, String(nRpc(g.calls, 'pv_give_progress')));
    ok(nRpc(g.calls, 'pv_pay_rows') === rows0,
       `${lang}: ★札のために一覧を引き直さない（鍵を持つ人に要らない行が付いてくる）`,
       g.calls.join(','));
    const want = (lang === 'ja' ? '17 / 100人' : '17 / 100');
    ok(g.pills.some((t) => t.indexOf(want) === 0),
       `${lang}: ★札が「${want}」になる（REAL PAY と同じ数）`, JSON.stringify(g.pills));
    ok(g.goal.indexOf(want) === 0,
       `${lang}: ★説明の中の見出しも同じ数`, g.goal);
    ok(/83/.test(g.left), `${lang}: ★あと何人かも出る`, g.left);
    ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));

    // ★サーバがまだ古い（札の口が無い）とき ── 「準備中」のまま。0 を置かない。
    const old = await open(lang, LOCKED);
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

// ════════════════════════════════════════════════════════════════
// J. 行を押すと出る面（2026-09-03）
// ════════════════════════════════════════════════════════════════
/* 2026-08-24 に「行は押せない」と決めて消した仕掛けを、オーナーの判断で戻した。
   戻したのは**押すと1人ぶんの面が出る**ところまで。
   図・割合（％）・2粒度・右の「選んだ区分」パネルは戻していない。

   ここで見るのは6つ。
     ① 押せることが hover でしか分からない画面になっていない
     ② 押しても**サーバへ1本も投げない**（誰がどの行を開いたかを記録に残さない）
     ③ 出る数はすべて帯で、両端はサーバが決めた刻みの倍数
        （＝画面が生の額を受け取って自分で丸めている、という形になっていない）
     ④ サーバが返さないもの（生の基本給・生の乗務時間・機材の大分類・割合）は面にも出ない
     ⑤ 無いものは節ごと出さない。作り話の 0 も「—」も置かない
     ⑥ 閉じたら DOM から消える・押した行へフォーカスが戻る

   ⚠️ ここは1人を深く見る画面なので、**項目を足すほど個人に近づく**。
      検査を足すときは、まず db/pay-rows.sql の契約文の
      「これ以上1つも足さない。次に足したくなったらどれかを外す」を読むこと。 */
{
  const DWT = {
    ja: { comp: '報酬の内訳', work: '勤務', sim: '同じ会社・同じ職位のほかの記録',
          only: 'この投稿には年収だけが含まれています。',
          noComp: 'この投稿には給与内訳が含まれていません。',
          noWork: 'この投稿には勤務の記録が含まれていません。',
          share: '構成比は匿名化された金額帯から算出した概算です',
          wk: ['乗務時間', '乗務日数', '休日'] },
    en: { comp: 'Compensation', work: 'Work',
          sim: 'Other records at the same airline and rank',
          only: 'This submission carries the yearly figure only.',
          noComp: 'This submission does not include a pay breakdown.',
          noWork: 'This submission does not include any work data.',
          share: 'Shares are approximate, worked out from the anonymised ranges',
          wk: ['Block hours', 'Duty days', 'Days off'] }
  };
  /* 勤務の刻み（乗務時間 10h / 乗務日数 2日 / 休日 2日）。db/pay-rows.sql と対。 */
  const W_GRID = [10, 2, 2];

  /* 面の中だけを読み取る。★毎回同じ形で取る（ケースごとに見方を変えない）。 */
  const DWS = () => {
    const q = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
    const dw = document.querySelector('.ap-dw');
    const t = (e) => ((e && e.innerText) || '').trim();
    const lab = dw ? (dw.getAttribute('aria-labelledby') || '') : '';
    const labEl = lab ? document.getElementById(lab) : null;
    return {
      n: q('.ap-dw').length,
      backs: q('.ap-dw-back').length,
      role: dw ? (dw.getAttribute('role') || '') : '',
      modal: dw ? (dw.getAttribute('aria-modal') || '') : '',
      labId: lab,
      labText: t(labEl),
      labIn: !!(dw && labEl && dw.contains(labEl)),
      text: t(dw),
      html: dw ? dw.innerHTML : '',
      name: t(document.querySelector('.ap-dw-name')),
      meta: t(document.querySelector('.ap-dw-meta')),
      amts: q('.ap-dw-av').map(t),
      /* ★見出しは textContent で取る。innerText は CSS の text-transform を
           掛けた後の字を返すので、英語の見出しが全部大文字になって照合できない。 */
      heads: q('.ap-dw-h').map((e) => (e.textContent || '').trim()),
      tags: q('.ap-dw h1,.ap-dw h2,.ap-dw h3,.ap-dw h4,.ap-dw h5').map((e) => e.tagName),
      /* 内訳の行（勤務の行は別に取る。刻みが違うので混ぜて数えられない）。 */
      /* ★2026-09-04、金額の右に割合（％）が並ぶようになった。
           ここで見たいのは**帯そのもの**なので、割合の字は外して取る
           （混ぜると「$95K〜$100K65%」になって刻みが読めなくなる）。 */
      pay: q('.ap-dw-row:not(.ap-dw-row--w)').map((e) => {
        const vv = e.querySelector('.ap-dw-v');
        const ss = vv ? vv.querySelector('.ap-dw-sh') : null;
        let vt = vv ? ((vv.innerText || '').trim()) : '';
        if (ss) vt = vt.replace((ss.innerText || '').trim(), '').trim();
        return { k: t(e.querySelector('.ap-dw-k')), v: vt };
      }),
      work: q('.ap-dw-row--w').map((e) => ({
        k: t(e.querySelector('.ap-dw-k')), v: t(e.querySelector('.ap-dw-v')),
        u: t(e.querySelector('.ap-dw-u')) })),
      miss: t(document.querySelector('.ap-dw-miss')),
      sims: q('.ap-dw-sim').map((e) => ({ i: e.getAttribute('data-ap-row'), t: t(e) })),
      /* 主 ── DEEP PAY の門を開くボタン。★href を持たない（リンクではない）。 */
      go: q('.ap-dw-cta').map((e) => ({
        tag: e.tagName, href: e.getAttribute('href'), t: t(e) })),
      /* 副 ── 出す側へ戻すリンク。 */
      cta: q('.ap-dw-cta2').map((e) => e.getAttribute('href')),
      /* 積み上げバー。★flex の伸び率だけを見る（% も割合の字も持たない）。 */
      st: q('.ap-dw-st').length,
      sti: q('.ap-dw-sti').map((e) => Number(getComputedStyle(e).flexGrow)),
      stn: t(document.querySelector('.ap-dw-stn')),
      /* ★割合の字（2026-09-04 から出る）。整数・合計 100・隣の伸び率と一致、を J-2 が見る。 */
      sh: q('.ap-dw-sh').map(t),
      dots: q('.ap-dw-dot').length,
      /* 実際に塗られている色。★橙1色の濃淡に戻ると、ここが全部同じ rgb になる
           （opacity は backgroundColor に出ないので、色そのものを見る）。 */
      stiC: q('.ap-dw-sti').map((e) => getComputedStyle(e).backgroundColor),
      dotC: q('.ap-dw-dot').map((e) => getComputedStyle(e).backgroundColor),
      /* 消したもの ── 行ごとの横棒。 */
      rng: q('.ap-dw-rng,.ap-dw-rngi').length,
      note: t(document.querySelector('.ap-dw-note')),
      closes: q('.ap-dw [data-ap-close]').length,
      focusIn: !!(dw && dw.contains(document.activeElement)),
      ov: document.body.style.overflow,
      bodyText: document.body.innerText,
      calls: (window.__rpc || []).map((r) => r.name)
    };
  };

  /* 行末の › を押して、面の中を読む。★押すのはキーボードの入口と同じボタン。 */
  const press = async (page, i) => {
    await page.evaluate((n) => {
      const tr = document.querySelector('#ap-rows tbody tr[data-ap-row="' + n + '"]');
      const b = tr && tr.querySelector('.ap-go');
      if (b) b.click();
    }, i);
    await sleep(420);
    return page.evaluate(DWS);
  };

  /* 「$95K–$100K」→ [95000, 100000]。「Under $5K」→ [5000]。 */
  const band = (s) => (String(s).match(/[\d][\d,]*(?:\.\d+)?\s*[KM万]?/g) || [])
    .map((x) => amountValue(x));

  for (const lang of ['ja', 'en']) {
    const TN = TEN[lang], W = DWT[lang];

    console.log(`\n════ ${lang} / J-1 押すと1人ぶんの面が出る ════`);
    const { page, errs } = await open(lang, OPEN);
    const v0 = await page.evaluate(SNAP);
    const before = v0.calls.length;

    /* ★hover しないと押せると分からない画面にしない（オーナーの §1）。
         触る端末には hover が無いので、機材も › も最初から出ている。 */
    const seen = await page.evaluate(() => {
      const q = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
      const vis = (e) => { const c = getComputedStyle(e);
        return c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0; };
      return { go: q('#ap-rows .ap-go').filter(vis).length,
               flt: q('#ap-rows .ap-flt').filter(vis).length,
               hint: q('#ap-rows .ap-hint-i').filter((e) => e.getBoundingClientRect().height > 1).length };
    });
    ok(seen.go === ROWS.length, `${lang}: ★› は hover しなくても全行に見えている`,
       String(seen.go));
    ok(seen.flt === ROWS.filter((r) => r.fleet).length,
       `${lang}: ★機材も最初から見えている（機材の無い行だけ空く）`, String(seen.flt));
    ok(seen.hint === 0, `${lang}: ★hover の予告は畳まれたまま（黙って高さを取らない）`,
       String(seen.hint));

    const d0 = await press(page, 0);
    ok(d0.n === 1 && d0.backs === 1, `${lang}: ★押すと面が1枚だけ出る`,
       `${d0.n}/${d0.backs}`);
    ok(d0.role === 'dialog' && d0.modal === 'true',
       `${lang}: ★読み上げに「覆い」として名乗る`, `${d0.role}/${d0.modal}`);
    ok(d0.labIn && d0.labText === d0.name && d0.name !== '',
       `${lang}: ★名前は面の中の社名を指している`, `${d0.labId} / ${d0.labText}`);
    ok(d0.ov === 'hidden', `${lang}: ★後ろの一覧は動かない`, d0.ov);
    ok(d0.focusIn === true, `${lang}: ★開いたら読み上げの位置が面へ移る`, String(d0.focusIn));
    ok(d0.calls.length === before,
       `${lang}: ★★押してもサーバへ1本も投げない（誰がどの行を開いたかを残さない）`,
       `${before} → ${d0.calls.length}`);
    ok(d0.tags.length > 0 && d0.tags.every((x) => x === 'H3'),
       `${lang}: ★面の見出しは h3 だけ（この画面の h2 は 0 のまま）`, d0.tags.join(','));
    ok(d0.closes === 1, `${lang}: ★× は1つ`, String(d0.closes));
    /* ★導線は2本（2026-09-03）。主＝他社と比べる（門を開く）／副＝出す側へ戻す。
         投稿の誘導を**消していない**こと ── 下げたのは順位だけ。 */
    ok(d0.go.length === 1 && d0.go[0].tag === 'BUTTON' && !d0.go[0].href,
       `${lang}: ★主の導線はボタン（DEEP PAY へのリンクではない）`,
       JSON.stringify(d0.go));
    ok(d0.cta.length === 1 && /pay-report\.html#ps/.test(d0.cta[0]),
       `${lang}: ★副の導線は残っている（「あなたの給与情報を匿名で追加」）`,
       d0.cta.join(','));
    ok(!/deep-pay/.test(d0.html),
       `${lang}: ★DEEP PAY への辺を増やしていない（門の形を変えない）`);

    /* 消したものが、面を開いた状態でも戻っていないこと。 */
    const vOpen = await page.evaluate(SNAP);
    gone(vOpen, `${lang}（面を開いたまま）`);
    ok(vOpen.blurred.length === 0,
       `${lang}: ★★面にぼかしが1つも掛かっていない（渡っていないものは隠す必要が無い）`,
       blurWhy(vOpen));
    ok(vOpen.trs === ROWS.length,
       `${lang}: ★後ろの一覧は消えない（別画面へ飛ばしていない）`, String(vOpen.trs));

    /* ★サーバが返さない列が、面を開いた状態でも1つも出ない。 */
    const leaked = POISON_VALUES.filter((s) => d0.bodyText.includes(s));
    ok(leaked.length === 0,
       `${lang}: ★★面を開いても、返さないはずの列が1つも出ない`, leaked.join(' / '));
    /* ★割合は 2026-09-04 から出る。ただし**整数だけ** ── 小数を出すと帯より細かくなり、
         帯の中の本当の位置が逆算できてしまう。 */
    ok(!/\d+[.,]\d+\s*%/.test(d0.text),
       `${lang}: ★★面に出る割合は整数だけ（小数の％が1つも無い）`,
       d0.text.replace(/\n/g, ' ').slice(0, 120));
    ok(!/20\d\d[-/年]/.test(d0.text),
       `${lang}: ★いつ出されたかは段だけ（年月日が1つも出ない）`,
       d0.text.replace(/\n/g, ' ').slice(0, 120));
    ok(!/[€£₩]|AED|S\$|HK\$/.test(d0.text),
       `${lang}: ★原本の通貨が漏れていない（出るのは今の表示通貨だけ）`,
       d0.text.replace(/\n/g, ' ').slice(0, 120));

    console.log(`\n════ ${lang} / J-2 出る数はすべて帯（USD で見る）════`);
    await page.evaluate(() => window.PVCurrency.set('USD'));
    await sleep(260);
    const dU = await page.evaluate(DWS);
    ok(dU.n === 1, `${lang}: ★通貨を切り替えても面は開いたまま`, String(dU.n));
    ok(dU.calls.length === before,
       `${lang}: ★通貨を切り替えてもサーバへ投げ直さない`,
       `${before} → ${dU.calls.length}`);

    const g0 = R_GRID[0];
    const bads = [], flat = [], zeros = [];
    dU.pay.forEach((p) => {
      const n = band(p.v);
      if (!n.length) { bads.push(p.k + ':(読めない)'); return; }
      n.forEach((x) => { if (x % g0 !== 0) bads.push(p.k + ':' + p.v); });
      if (n.length === 2 && n[0] === n[1]) flat.push(p.k + ':' + p.v);
      if (/(^|[^\d])0\s*[〜–]/.test(p.v)) zeros.push(p.k + ':' + p.v);
    });
    ok(dU.pay.length === 4, `${lang}: ★内訳は4行（0 の区分をサーバが落としている）`,
       String(dU.pay.length));
    ok(bads.length === 0,
       `${lang}: ★★両端がサーバの刻み（$${g0.toLocaleString('en-US')}）の倍数`,
       bads.join(' / '));
    ok(flat.length === 0, `${lang}: ★両端が同じ数の帯が1つも無い（1点に見えない）`,
       flat.join(' / '));
    ok(zeros.length === 0, `${lang}: ★下端 0 は「0〜」ではなく「◯ 未満」の形`,
       zeros.join(' / '));
    ok(dU.pay.some((p) => band(p.v).length === 1),
       `${lang}: ★畳んだ帯は「◯ 未満」の1つの数で出る`,
       dU.pay.map((p) => p.v).join(' / '));

    const wbad = [];
    dU.work.forEach((wk, i) => {
      band(wk.v).forEach((x) => { if (x % W_GRID[i] !== 0) wbad.push(wk.k + ':' + wk.v); });
    });
    ok(dU.work.length === 3, `${lang}: ★勤務は3つだけ（便数もステイも拘束時間も無い）`,
       String(dU.work.length));
    ok(dU.work.map((x) => x.k).join('/') === W.wk.join('/'),
       `${lang}: ★勤務の並びは 乗務時間・乗務日数・休日`, dU.work.map((x) => x.k).join('/'));
    ok(wbad.length === 0, `${lang}: ★勤務の両端は 10 / 2 / 2 の倍数`, wbad.join(' / '));
    ok(dU.amts.length === 2, `${lang}: ★上に出る金額は年収と月あたりの2つだけ`,
       dU.amts.join(' / '));

    /* ★積み上げバー（2026-09-03）。行ごとの横棒（帯の下端〜上端）はここで消した
         ── 長さが金額の大小に読めてしまい、説明しないと読めなかった。
       ★出すのは「おおよその構成」だけ。長さは帯の中点から出す。
       ★2026-09-04 から、その長さを**読める字**でも出す（オーナーの決定）。
          出してよい形は下の5本が見張る ── 区分の数だけ出る・整数・合計 100・
          隣の伸び率と一致・通貨を切り替えても動かない。
       ⚠️ 長さそのものは今までどおり flex の伸び率で持つ。CSS の % で書かない。 */
    ok(dU.rng === 0, `${lang}: ★行ごとの横棒は残っていない（1本の積み上げに替えた）`,
       String(dU.rng));
    ok(dU.st === 1 && dU.sti.length === dU.pay.length,
       `${lang}: ★バーは1本・区分の数だけ切れている`, `${dU.st} / ${dU.sti.length}`);
    ok(dU.dots === dU.pay.length,
       `${lang}: ★一覧の丸はバーと同じ数（凡例を別に置かない）`, String(dU.dots));
    /* 伸び率は「中点 ÷ 中点の合計」なので、足すと 1 になる。
       ★合計を年収に合わせない ── 帯は足しても年収とは合わないと決めてある。 */
    const stSum = dU.sti.reduce((a, b) => a + b, 0);
    ok(Math.abs(stSum - 1) < 0.01 && dU.sti.every((x) => x > 0),
       `${lang}: ★長さは中点の合計で割ってある（0 の切れ端が無い）`,
       dU.sti.join(' / '));
    ok(dU.stn === W.share,
       `${lang}: ★★バーの下に「概算です」と必ず断っている`, dU.stn);
    /* ★割合の字（2026-09-04）。バーが既に持っている長さを書いているだけで、
         新しい数は1つも増えていない ── それをここで実測する。 */
    ok(dU.sh.length === dU.pay.length,
       `${lang}: ★割合は区分の数だけ出る（1つだけ伏せる、が起きない）`,
       dU.sh.join(' / '));
    ok(dU.sh.length > 0 && dU.sh.every((s2) => /^\d+%$/.test(s2)),
       `${lang}: ★★割合は整数だけ（小数を出すと帯より細かくなる）`, dU.sh.join(' / '));
    const shN = dU.sh.map((s2) => parseInt(s2, 10));
    ok(shN.reduce((a, b) => a + b, 0) === 100,
       `${lang}: ★割合の合計がちょうど 100（端数は最大剰余法で配ってある）`,
       shN.join('+'));
    /* ★★いちばん強い1行。字が**隣の伸び率と一致する**＝帯から作った証拠。
         金額から作り直すと、ここが必ずずれる。 */
    const shGap = shN.filter((x, i) => Math.abs(x - dU.sti[i] * 100) > 1);
    ok(shGap.length === 0,
       `${lang}: ★★割合が隣の伸び率と1ポイント以内で一致（帯から作った証拠）`,
       dU.sh.join(' / ') + ' ↔ ' + dU.sti.map((x) => (x * 100).toFixed(1)).join(' / '));
    ok(d0.sh.join('/') === dU.sh.join('/'),
       `${lang}: ★★通貨を切り替えても割合が動かない（金額から作っていない証拠）`,
       `${d0.sh.join('/')} → ${dU.sh.join('/')}`);
    /* ★色（2026-09-03 その2・オーナー指示で橙1色をやめた）。
         「オレンジだけじゃわかりづらい」が黙って戻らないように、
         **実際に塗られている色**を見る。 */
    ok(new Set(dU.stiC).size === dU.stiC.length,
       `${lang}: ★★バーの区分がその行の中で全部違う色`, dU.stiC.join(' / '));
    ok(dU.dotC.length === dU.stiC.length
       && dU.dotC.every((c2, i) => c2 === dU.stiC[i]),
       `${lang}: ★一覧の丸がバーの区分と1つずつ同じ色（凡例を別に置かない根拠）`,
       dU.dotC.join(' / '));

    console.log(`\n════ ${lang} / J-3 年数は段だけ・欠けは節ごと落とす ════`);
    ok(TN.r.includes(dU.meta.split(' · ').pop()),
       `${lang}: ★昇格後年数は段の言葉で出る（年そのものは出ない）`, dU.meta);
    ok(!/\d+\s*(年|years?)\s*\d/.test(dU.meta),
       `${lang}: ★段の中に生の年数が混ざっていない`, dU.meta);

    /* 内訳だけの人（勤務を書かなかった）／勤務だけの人／年収だけの人。 */
    const dComp = await press(page, 2);
    ok(dComp.heads.includes(W.comp) && !dComp.heads.includes(W.work),
       `${lang}: ★勤務が無い人には勤務の節ごと出ない`, dComp.heads.join(' / '));
    ok(dComp.miss === W.noWork,
       `${lang}: ★代わりに「書かれていません」と正直に1文（「—」も 0 も置かない）`,
       dComp.miss);

    const dWork = await press(page, 3);
    ok(dWork.heads.includes(W.work) && !dWork.heads.includes(W.comp),
       `${lang}: ★内訳が無い人には内訳の節ごと出ない`, dWork.heads.join(' / '));
    ok(dWork.miss === W.noComp, `${lang}: ★こちらも1文で正直に`, dWork.miss);
    ok(dWork.st === 0 && dWork.stn === '',
       `${lang}: ★内訳が無ければ積み上げバーも「概算です」の断りも出ない`,
       `${dWork.st} / ${dWork.stn}`);

    /* ★昇格後年数の欄ができる前の投稿（サーバが tenk='s' で返す行）。
         段は今までどおり出るが、**札は「在籍」**でなければならない。
         ここが「昇格後」に戻ったら、2026-09-16 に直した嘘が復活している。 */
    const wLast = dWork.meta.split(' · ').pop();
    ok(TN.s.includes(wLast),
       `${lang}: ★★昇格後年数を書いていない古い行は「在籍◯年」と出る（段は今までどおり出す）`,
       dWork.meta);
    ok(!TN.r.includes(wLast),
       `${lang}: ★★その行に「昇格後」の札を付けていない（在籍年数を昇格後と名乗らせない）`,
       dWork.meta);

    /* ★口コミ由来の行 ── 年収しか無い。押しても空の面にしない。 */
    const dOnly = await press(page, 4);
    ok(dOnly.n === 1 && dOnly.amts.length === 2,
       `${lang}: ★年収しか無い行も、押せば面が開いて金額は出る`,
       `${dOnly.n} / ${dOnly.amts.join(' ')}`);
    ok(dOnly.pay.length === 0 && dOnly.work.length === 0,
       `${lang}: ★中身が無いのに枠だけ並べない`,
       `${dOnly.pay.length}/${dOnly.work.length}`);
    ok(dOnly.miss === W.only, `${lang}: ★「年収だけです」と1文で言う`, dOnly.miss);
    ok(dOnly.meta === dOnly.meta.split(' · ')[0],
       `${lang}: ★機材も年数も無い行では、そこが黙って空く（「不明」を作らない）`,
       dOnly.meta);
    ok(!/不明|Unknown|—|N\/A/i.test(dOnly.text),
       `${lang}: ★★「不明」の札を置かない（書いていない、という情報も出さない）`,
       dOnly.text.replace(/\n/g, ' ').slice(0, 120));
    ok(dOnly.sims.length === 0,
       `${lang}: ★ほかに同じ会社・同じ職位が居なければ、その節ごと出ない`,
       JSON.stringify(dOnly.sims));

    console.log(`\n════ ${lang} / J-4 同じ会社・同じ職位のほかの記録 ════`);
    const dSim = await press(page, 0);
    ok(dSim.sims.length === 1 && dSim.sims[0].i === '2',
       `${lang}: ★同じ会社・同じ職位だけ・自分は入らない`, JSON.stringify(dSim.sims));
    const dSw = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      document.querySelector('.ap-dw-sim').click();
      await sleep(120);
      return { n: document.querySelectorAll('.ap-dw').length,
               meta: (document.querySelector('.ap-dw-meta') || {}).innerText || '',
               calls: (window.__rpc || []).length };
    });
    ok(dSw.n === 1, `${lang}: ★押しても面は1枚のまま（開き直さない）`, String(dSw.n));
    ok(TN.r[2] && dSw.meta.indexOf(TN.r[2]) >= 0,
       `${lang}: ★中身だけ入れ替わる（押した相手の段になる）`, dSw.meta);
    ok(dSw.calls === before,
       `${lang}: ★ここでもサーバへ投げない`, `${before} → ${dSw.calls}`);

    console.log(`\n════ ${lang} / J-5 閉じ方3つと戻り先 ════`);
    const cl = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const alive = () => document.querySelectorAll('.ap-dw-back').length;
      const openRow = (n) => {
        document.querySelector('#ap-rows tbody tr[data-ap-row="' + n + '"] .ap-go').click();
      };
      const out = { ovBase: document.body.style.overflow };
      /* いま開いているものを × で閉じる。 */
      document.querySelector('.ap-dw-x').click();
      await sleep(360);
      out.x = alive();
      out.ovBack = document.body.style.overflow;
      out.focus = document.activeElement
        === document.querySelector('#ap-rows tbody tr[data-ap-row="0"] .ap-go');

      openRow(1); await sleep(60);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(360);
      out.esc = alive();

      openRow(1); await sleep(60);
      const b = document.querySelector('.ap-dw-back');
      b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(360);
      out.back = alive();

      /* 続けて押しても増えない。 */
      openRow(1); await sleep(60); openRow(2); await sleep(60);
      out.dup = alive();
      out.leftover = document.querySelectorAll('.ap-dw-row').length;
      document.querySelector('.ap-dw-x').click();
      await sleep(360);
      out.after = alive();
      out.rows = document.querySelectorAll('.ap-dw-row').length;
      out.calls = (window.__rpc || []).length;
      return out;
    });
    ok(cl.x === 0 && cl.esc === 0 && cl.back === 0,
       `${lang}: ★閉じ方は3つとも効く（× ／ ESC ／ 背景）`,
       `x=${cl.x} esc=${cl.esc} back=${cl.back}`);
    ok(cl.ovBack !== 'hidden', `${lang}: ★閉じたら一覧がまた動く`, cl.ovBack);
    ok(cl.focus === true, `${lang}: ★閉じたら押した行の › にフォーカスが戻る`,
       String(cl.focus));
    ok(cl.dup === 1, `${lang}: ★続けて押しても面は1枚だけ`, String(cl.dup));
    ok(cl.after === 0 && cl.rows === 0,
       `${lang}: ★★閉じたら DOM から消える（他人の帯が残らない）`,
       `${cl.after} / ${cl.rows}`);
    ok(cl.calls === before,
       `${lang}: ★開け閉てを繰り返してもサーバへ投げない`, `${before} → ${cl.calls}`);

    console.log(`\n════ ${lang} / J-6 主の導線は「既存の門」を開く ════`);
    /* ★DEEP PAY はまだ開けていない。だから面からもリンクは張らない。
         押すと出るのは**左メニューを押したときとまったく同じ説明パネル**で、
         deep-pay.html へは1歩も進まない。
       ⚠️ ここが緑でも、assert-deep-pay.mjs の「辺は2本だけ」が本丸。
          あちらが root の全 .js を見ていて、deep-pay.html と書いた時点で落ちる。 */
    const gt = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      document.querySelector('#ap-rows tbody tr[data-ap-row="0"] .ap-go').click();
      await sleep(120);
      const btn = document.querySelector('.ap-dw-cta');
      const label = (btn && btn.innerText || '').trim();
      btn.click();
      await sleep(520);
      const p = document.querySelector('#mr-gate');
      return { label: label,
               dw: document.querySelectorAll('.ap-dw-back').length,
               panel: p ? (p.getAttribute('data-kind') || '') : '',
               inMain: !!(p && p.closest('.mr-main')),
               href: document.querySelectorAll('a[href*="deep-pay"]').length,
               calls: (window.__rpc || []).map((r) => r.name) };
    });
    ok(gt.dw === 0, `${lang}: ★門を開く前に面が閉じている（覆いの裏に出さない）`,
       String(gt.dw));
    ok(gt.panel === 'deep' && gt.inMain,
       `${lang}: ★★出るのは左メニューと同じ門（説明パネル）`, `${gt.panel}/${gt.inMain}`);
    ok(gt.href === 0,
       `${lang}: ★★deep-pay.html へのリンクは1本も生えていない`, String(gt.href));
    ok(/DEEP PAY/.test(gt.label),
       `${lang}: ★主の導線は「他社と比較する → DEEP PAY」と名乗る`, gt.label);
    /* 門は「あと何人か」を1度だけ聞くことがある（pv_give_progress）。
       ★聞くとしてもそれだけ。面を開いたこと自体はサーバに残らない。 */
    ok(gt.calls.filter((n) => n !== 'pv_give_progress').length === before,
       `${lang}: ★門を開いても、行を読み直しに行かない`, gt.calls.join(','));
    await page.evaluate(() => { if (window.PVGates) window.PVGates.close(); });

    ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));
  }
}

// ════════════════════════════════════════════════════════════════
// K. 報酬の内訳の門（Give & Get・2026-09-03）
// ════════════════════════════════════════════════════════════════
/* オーナー指示 ──「自分の給与内訳を共有した人だけ、他人の給与内訳を見られる」。
   課金の門ではなく**相互性の門**。

   いちばん強い制約（そして、この節が在る理由）──
   **「CSS でぼかして隠す」のではなく、未 Unlock の人には実数そのものを返さない。**
   開発者ツールでぼかしを外しても見えない構造にすること。

   だからここで見るのは「隠せているか」ではなく **「そもそも届いていないか」**。
     ① 閉じている行の面に、帯の形（区分名と両端の組）が1つも無い
     ② 骨組みは**中身が固定**。区分の数も幅も、その人のデータから作っていない
     ③ 内訳がそもそも無い行には門を出さない（§15 の C。出すと「隠されている」と読める）
     ④ 門のボタンは戻り先を sessionStorage に置くだけ ── **URL に載せない**
     ⑤ 戻ってくると、押した行の面が開き直り、鍵は消える（一度きり）
     ⑥ 字面 ── blur を書いていない・口コミの鍵（pv_salary_unlock_expiry）に触らない

   ⚠️ サーバ側（pay を返さない・paylock だけを返す）は db/test-pay-rows.mjs の 12-i。
      あちらが本丸で、ここは**画面がそれを裏切っていない**ことだけを見る。 */
{
  /* ★閉じている行が持つのは paylock ── **区分の名前だけ**（区分が1つしか
       無い行は真偽1つ）。pay は**鍵ごと無い** ── jsonb_strip_nulls が
       消しているので、undefined ではなく不在。金額は1円も来ていない。
     1行目 …… 閉じている（内訳も勤務もある人）。区分は4つ
     2行目 …… 閉じている＋勤務が無い（1文が「勤務が無い」だけになること）。
               ★1行目と**同じ数・違う区分**にしてある ── 帯の幅が
                 その人の金額ではなく位置だけで決まることを見るため
     3行目 …… そもそも内訳が無い（§15 の C。門を出してはいけない）
     4行目 …… 区分が1つだけ（名前も来ない）。今までどおりの灰色の骨組み */
  const LOCK_KEYS = ['base', 'variable', 'other', 'bonus'];
  const LOCK_ROWS = [
    row('ana', 'cap', 180000, true, 0, Object.assign({}, POISON, {
      fleet: 'b787', ten: 1, paylock: LOCK_KEYS, work: WORK })),
    row('jal', 'cap', 170000, false, 3, { fleet: 'b777', ten: 0,
      paylock: ['base', 'command', 'housing', 'rest'] }),
    row('jal', 'fo', 110000, false, 4, { fleet: 'a320', ten: 0, work: WORK }),
    row('ana', 'fo', 120000, false, 2, { fleet: 'a320', ten: 0, paylock: true })
  ];
  const PAYLOCK = { ok: true, state: 'open', rows: LOCK_ROWS, mine: MINE, stats: ST,
                    give: { basic: true, detailed: false, full: false, payslip: false } };

  const LKT = {
    ja: { comp: '報酬の内訳', noComp: 'この投稿には給与内訳が含まれていません。',
          noWork: 'この投稿には勤務の記録が含まれていません。',
          cta: '給与の内訳を入力する' },
    en: { comp: 'Compensation',
          noComp: 'This submission does not include a pay breakdown.',
          noWork: 'This submission does not include any work data.',
          cta: 'Add your pay breakdown' }
  };

  /* 面の中の「閉じている内訳」だけを読み取る。 */
  const LKS = () => {
    const q = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
    const t = (e) => ((e && e.innerText) || '').trim();
    const dw = document.querySelector('.ap-dw');
    return {
      n: q('.ap-dw').length,
      lk: q('.ap-dw-lk').length,
      segs: q('.ap-dw-lk-s').length,
      pills: q('.ap-dw-lk-p').length,
      flex: q('.ap-dw-lk-s').map((e) => Number(getComputedStyle(e).flexGrow)),
      /* ★帯の中の文字。帯には項目名すら置かない（色だけ）。 */
      barText: q('.ap-dw-lk-b')
        .map((e) => (e.textContent || '').replace(/\s+/g, '')).join(''),
      /* ★★金額の板の中の文字。**ここが本題** ── ぼかしているのではなく
           中身が無いこと。1文字でも在れば「置いてから霞ませた」ことになる。 */
      pillText: q('.ap-dw-lk-p')
        .map((e) => (e.textContent || '').replace(/\s+/g, '')).join(''),
      /* 出ている項目名（本物）。オーナー指示で名前までは出す。 */
      lkNames: q('.ap-dw-lk-r .ap-dw-k').map((e) => (e.innerText || '').trim()),
      /* 板がぼけていること（＝空の板の質感）。数字が入っていないことは
         pillText が別に見ている。 */
      pillBlur: q('.ap-dw-lk-r.is-real .ap-dw-lk-p2')
        .map((e) => getComputedStyle(e).filter),
      heads: q('.ap-dw-h').map((e) => (e.textContent || '').trim()),
      /* 帯（開いている行が出すもの）が1本も無いこと。 */
      bands: q('.ap-dw-row:not(.ap-dw-row--w):not(.ap-dw-lk-r)').length,
      stn: q('.ap-dw-stn').length,
      miss: t(document.querySelector('.ap-dw-miss')),
      lkT: t(document.querySelector('.ap-dw-lk-t')),
      lkAll: t(document.querySelector('.ap-dw-lk')),
      lkC: (function () {
        const a = document.querySelector('.ap-dw-lk-c');
        return a ? { tag: a.tagName, href: a.getAttribute('href') || '',
                     label: (a.innerText || '').trim() } : null;
      })(),
      /* ★面ぜんぶの文字。ここに帯の数字が出ていないことを別に見る。 */
      text: t(dw),
      html: dw ? dw.innerHTML : '',
      calls: (window.__rpc || []).map((r) => r.name)
    };
  };

  const press = async (page, i) => {
    await page.evaluate((n) => {
      const tr = document.querySelector('#ap-rows tbody tr[data-ap-row="' + n + '"]');
      const b = tr && tr.querySelector('.ap-go');
      if (b) b.click();
    }, i);
    await sleep(420);
    return page.evaluate(LKS);
  };

  /* ── 字だけで見るもの ───────────────────────────────── */
  console.log('\n════ K-0 字（ぼかしに戻っていないか）════');
  {
    const j = read('./actual-pay.js'), c = read('./actual-pay.css');
    /* ★「本物を置いてから霞ませる」形に戻っていないこと。
         霞ませる相手が在る時点で、開発者ツールで1秒で剥がれる。
       ⚠️ 2026-09-03 その3 で、金額の板だけ blur を許した（オーナー指示
          「色付きの棒グラフと項目名までは出す。金額だけ隠す」）。
       ⚠️ 2026-09-16、伏せた一覧の板（年収・機材）も同じ理由で許した。
          **許すのは中身が空の板の規則3つだけ** ── 消さずに範囲を広げてある。
          描く側（JS）は今までどおり blur を1文字も書かない。 */
    ok(!/blur\s*\(/.test(j),
       '★★描く側（actual-pay.js）に blur が1文字も無い');
    const CSSRULE = /([^{}]+)\{([^{}]*)\}/g;
    const wrong = [];
    let m;
    while ((m = CSSRULE.exec(c))) {
      if (!/blur\s*\(|(?:^|[;\s])filter\s*:/.test(m[2])) continue;
      if (!/\.ap-dw-lk-p|\.ap-amt-lk-p|\.ap-flt-lk/.test(m[1])) wrong.push(m[1].trim().slice(0, 60));
    }
    ok(wrong.length === 0,
       '★★CSS の blur / filter は「中身が空の板」の規則だけ'
       + '（.ap-dw-lk-p / .ap-amt-lk-p / .ap-flt-lk）',
       wrong.join(' | '));
    /* ★伏せた一覧を描く関数が、金額と機材の書式に1つも触っていない（2026-09-16）。
         「値が無いから板」ではなく「この画面だから板」で通してある。ここに
         money() を1つでも書くと、将来サーバが漏らした年収がそのまま画面に出る。
       ⚠️ 見るのは maskedList() / maskedPlate() の**本体だけ**。 */
    const MKBODY = ['function maskedList()', 'function maskedPlate(month)']
      .map((h) => (j.split(h)[1] || '').split('\n  function ')[0]).join('\n');
    const mkLeak = ['money(', 'moneyMonth(', 'fleetName(', 'annual_usd', 'r.pay', 'r.work']
      .filter((w) => MKBODY.includes(w));
    ok(MKBODY.length > 0 && mkLeak.length === 0,
       '★★伏せた一覧を描く所に money( / moneyMonth( / fleetName( が1つも無い',
       mkLeak.join(','));
    /* ★伏せた一覧で値を描くのは mkCell() だけ（2026-09-18）。型ごとに年収・機材・
         年数の段が出るようになったので、ここでは「呼ばない」ではなく
         **「必ず白リスト（mkHas）を通してから呼ぶ」**を見る。
       ⚠️ 見るのは呼び出しの**直前**。同じ欄の mkHas が無い呼び出しが1つでもあれば、
          サーバが混ぜた値がその欄にそのまま出る。 */
    const GATE = { 'money(': 'annual_usd', 'moneyMonth(': 'annual_usd',
                   'fleetName(': 'fleet', 'tenName(': 'ten' };
    const ungated = (body) => {
      const out = [];
      for (const [fn, key] of Object.entries(GATE)) {
        let at = -1;
        while ((at = body.indexOf(fn, at + 1)) >= 0) {
          if (/[A-Za-z_]$/.test(body.slice(0, at))) continue;   // moneyMonth( の中の money( ではない
          const back = body.slice(Math.max(0, at - 160), at);
          if (!back.includes(`mkHas(r, '${key}')`)) out.push(fn + '@' + body.slice(at, at + 30).replace(/\s+/g, ' '));
        }
      }
      return out;
    };
    const CELL = (j.split('function mkCell(r, k)')[1] || '').split('\n  function ')[0];
    const cellBad = ungated(CELL);
    ok(CELL.length > 0 && cellBad.length === 0 && /money\(/.test(CELL) && /fleetName\(/.test(CELL),
       '★★伏せた一覧の1欄を描く所は、年収・機材・年数の書式を必ず白リストを通してから呼ぶ',
       cellBad.join(' | ') || String(CELL.length));
    ok(!/r\.pay|r\.work|payHTML\(|workHTML\(|simHTML\(/.test(CELL),
       '★★その所は内訳・勤務・類似の行に1つも触らない');
    /* ★面（押すと開く方）の伏せた枝も同じ。 */
    const DWMK = ((j.split('function dwHTML(r)')[1] || '').split('if (!mk) {')[1] || '')
      .split('var bd = ')[0];
    const DWMK2 = DWMK.split('} else {')[1] || '';
    const dwBad = ungated(DWMK2);
    ok(DWMK2.length > 0 && dwBad.length === 0 && /fleetName\(/.test(DWMK2),
       '★★伏せた面の職位・機材・年数も、白リストを通してから書式に渡す',
       dwBad.join(' | ') || String(DWMK2.length));
    const AMT = (j.split('function dwAmt(r, month)')[1] || '').split('\n  function ')[0];
    ok(/isMasked\(\)\s*&&\s*!mkHas\(r, 'annual_usd'\)/.test(AMT),
       '★★面の年収は、伏せた画面では年収型の白リストを通った行だけ数字になる');
    /* ★入口で1回、表に無い鍵を**捨てる**（描く所の門をすり抜けた欄が、並べ替え・
         絞り込み・戻り先の保存から漏れないように）。 */
    ok(/S\.rows\s*=\s*mk\.map\(mkClean\)/.test(j),
       '★★伏せた一覧の行は、受け取った瞬間に白リストで作り直す（表に無い鍵を持たない）');
    /* ★画面の白リストと、この検査の白リスト（MK_SEE・別に書いたもの）が一致する。
         どちらかだけ直すと、見本の検査が「画面が出してよいもの」を取り違える。 */
    {
      const m = /var MK_KEYS = \{([\s\S]*?)\};/.exec(j);
      const tbl = {};
      if (m) for (const [, k, v] of m[1].matchAll(/(\w+|''):\s*\[([^\]]*)\]/g)) {
        tbl[k === "''" ? '' : k] = [...v.matchAll(/'(\w+)'/g)].map((x) => x[1]).sort().join(',');
      }
      const want = Object.assign({ '': MK_OLD4.slice().sort().join(',') },
        ...Object.entries(MK_SEE).map(([k, v]) => ({ [k]: v.slice().sort().join(',') })));
      ok(JSON.stringify(Object.keys(tbl).sort()) === JSON.stringify(Object.keys(want).sort())
         && Object.keys(want).every((k) => tbl[k] === want[k]),
         '★★画面の型ごとの白リストが、オーナーの決めた表と1文字も違わない',
         JSON.stringify(tbl));
      ok(Object.values(tbl).every((v) => !(v.split(',').includes('airline')
           && v.split(',').some((k) => ['annual_usd', 'fleet', 'ten'].includes(k)))),
         '★★画面のどの型にも、会社と年収・機材・年数が同居していない', JSON.stringify(tbl));
    }
    /* ★骨組みが受け取ってよいのは**区分の名前だけ**。金額の材料
         （帯 r.pay・その中点・金額の書式）をこの関数から触らない。 */
    /* ⚠️ 2026-09-13、2つ目の引数 href が増えた。増えたのは**リンクの行き先**
         だけで、金額の材料ではない（プレビューの面だけ DEEP PAY の説明ではなく
         給与フォームへ向ける）。金額に触っていないことは下の leak が見張る。 */
    ok(/function payLockHTML\(keys, href\)/.test(j),
       '★★骨組みを作る関数が受け取るのは、名前の配列とリンクの行き先だけ');
    const LKBODY = (j.split('function payLockHTML(keys, href)')[1] || '')
      .split('\n  function ')[0];
    const leak = ['r.pay', 'rngMoney', 'segMid', 'annual'].filter((w) => LKBODY.includes(w));
    ok(LKBODY.length > 0 && leak.length === 0,
       '★★その関数が金額の材料に1つも触っていない（帯・中点・書式）',
       leak.join(','));
    /* ★口コミの鍵と混ぜない（オーナーの §13）。あちらは pv-gates.js の持ち物。 */
    ok(!/pv_salary_unlock_expiry/.test(j),
       '★★口コミ・給与の既存の鍵（pv_salary_unlock_expiry）に触っていない');
    /* ★戻り先は URL に載せない。載せると他人の年収がアドレス欄に出て GA4 に載る。 */
    ok(!/location\.(href|search|hash)\s*=[^=]/.test(j.replace(/DETAIL_URL/g, '')),
       '★戻り先を URL に書き込んでいない');
    ok(/sessionStorage/.test(j), '戻り先は sessionStorage（タブを閉じれば消える）');
    ok(/pay-report\.html#pay-detail/.test(j),
       '内訳の欄まで直接飛ぶ（#pay-detail）');
  }

  for (const lang of ['ja', 'en']) {
    const W = LKT[lang];

    console.log(`\n════ ${lang} / K-1 閉じている内訳（実数が届いていない）════`);
    const { page, errs } = await open(lang, PAYLOCK);
    const v0 = await page.evaluate(SNAP);
    const before = v0.calls.length;

    const d0 = await press(page, 0);
    ok(d0.n === 1, `${lang}: 押すと面が1枚出る`, String(d0.n));
    ok(d0.lk === 1, `${lang}: ★閉じている行には門が出る`, String(d0.lk));
    ok(d0.heads.indexOf(W.comp) >= 0,
       `${lang}: ★見出しは今までどおり「報酬の内訳」`, d0.heads.join(','));
    ok(d0.bands === 0 && d0.stn === 0,
       `${lang}: ★★帯も構成比のバーも1本も出ない`, `${d0.bands}/${d0.stn}`);
    ok(d0.barText === '',
       `${lang}: ★★帯の中に文字が1つも無い（色だけ・項目名も置かない）`,
       JSON.stringify(d0.barText).slice(0, 80));
    /* ★★この節でいちばん強い1行。金額の板は**空**。
         ぼかしているのではなく、置く数が届いていない。 */
    ok(d0.pillText === '',
       `${lang}: ★★金額の板の中に文字が1つも無い（ぼかしではなく不在）`,
       JSON.stringify(d0.pillText).slice(0, 80));
    /* ★★2026-09-04、開いている行には割合（％）を出すようになった。
         閉じている行には**1文字も出さない** ── あちらの幅は CSS が持つ
         全員同じ作り物（6/4/3/2）で、割合にしたら発明した数字を公開することになる。 */
    ok(d0.text.indexOf('%') < 0,
       `${lang}: ★★閉じている面には割合（％）が1文字も無い`,
       d0.text.replace(/\n/g, ' ').slice(0, 120));
    /* オーナー指示 ── 項目名は本物を出す（何が隠れているのか伝わらないため）。 */
    ok(d0.lkNames.length === 4 && d0.lkNames.every((x) => x.length > 0),
       `${lang}: ★項目名は本物が4つ出る（区分の数だけ）`, d0.lkNames.join(' / '));
    ok(d0.pillBlur.length === 4 && d0.pillBlur.every((f) => /blur/.test(f)),
       `${lang}: ★金額の場所は空の板（ぼけた質感）`, d0.pillBlur.join(','));
    /* ★★この節の本題。1行目には**毒**（生の基本給 132,456 など）を混ぜてある。
         閉じている面のどこにも、その形の文字が1つも出ない。
         ⚠️ 「130000 が無いこと」では見ない ── あの数は年収の丸めでほかの行にも出る
            （db/test-pay-rows.mjs の 12-i で同じ罠を踏んでいる）。 */
    const dirty = POISON_VALUES.filter((v) => d0.text.includes(v));
    ok(dirty.length === 0,
       `${lang}: ★★閉じている面に生の額・生の時間が1文字も出ない`, dirty.join(','));
    /* ★門の言葉そのものにも金額を書かない（「あと◯円」のような煽りにしない）。 */
    ok(!MONEY.test(d0.lkAll),
       `${lang}: ★門の文章に金額の形をした文字が無い`, d0.lkAll.slice(0, 60));
    /* 面に出ている数字は「年収」と「月あたり」の2つだけ（一覧に元から出ている数）。
       内訳の金額は1つも増えていない。 */
    ok(d0.calls.length === before,
       `${lang}: ★門を出してもサーバへ1本も投げない`, `${before} → ${d0.calls.length}`);

    console.log(`\n════ ${lang} / K-2 幅はその人の金額から作っていない ════`);
    /* ★★ここが門の生命線。区分の**名前**は本物だが、帯の**幅**は
         位置だけで決まる定数（CSS の :nth-child）。本当の割合を出すと、
         面に出ている年収と掛けるだけで金額が戻ってしまう。 */
    ok(d0.segs === 4 && d0.pills === 4,
       `${lang}: ★帯は区分の数だけ・金額の板は1行に1つ`, `${d0.segs}/${d0.pills}`);
    ok(JSON.stringify(d0.flex) === JSON.stringify([6, 4, 3, 2]),
       `${lang}: ★★幅は決め打ちの並び（6-4-3-2）`, JSON.stringify(d0.flex));
    const d1 = await press(page, 1);
    ok(JSON.stringify(d1.flex) === JSON.stringify(d0.flex),
       `${lang}: ★★区分の顔ぶれが違っても幅はまったく同じ（金額から作っていない）`,
       `${JSON.stringify(d0.flex)} / ${JSON.stringify(d1.flex)}`);
    ok(d1.pillText === '' && d1.barText === '',
       `${lang}: ★この行にも数字が1文字も無い`, `${d1.barText}/${d1.pillText}`);
    ok(JSON.stringify(d1.lkNames) !== JSON.stringify(d0.lkNames),
       `${lang}: 　（見本の2行は別の区分にしてある＝上の比較が効いている）`,
       d1.lkNames.join(' / '));
    /* 2行目は勤務が無い人。★「内訳が無い」ではなく「勤務が無い」と言う。 */
    ok(d1.miss === W.noWork,
       `${lang}: ★閉じているだけの行を「内訳が無い」と言わない`, d1.miss);

    console.log(`\n════ ${lang} / K-2b 区分が1つだけの行は名前も出さない ════`);
    /* ★区分が1つ ＝ その区分が内訳のほぼ全部。面には年収が出ているので、
         名前を出した時点で「基本給 ≒ 年収」と読めてしまう。
         サーバはその行に真偽1つしか入れない（db/pay-rows.sql）。
         画面はそれを今までどおりの灰色の骨組みで受ける。 */
    const d3 = await press(page, 3);
    ok(d3.lk === 1, `${lang}: ★門そのものは出る`, String(d3.lk));
    ok(d3.lkNames.length === 0,
       `${lang}: ★★項目名を1つも出さない`, d3.lkNames.join(' / '));
    ok(d3.segs === 4 && d3.pills === 6,
       `${lang}: ★中身の無い骨組み（4本の帯・3行 × 2つの板）`,
       `${d3.segs}/${d3.pills}`);
    ok(d3.barText === '' && d3.pillText === '',
       `${lang}: ★ここにも文字が1つも無い`, `${d3.barText}/${d3.pillText}`);

    console.log(`\n════ ${lang} / K-3 内訳がそもそも無い行に門を出さない ════`);
    /* ★オーナーの §15 の C。ここに門を出すと「隠されている」と読めるが、
         本当は**その人が書いていない**。嘘になる。 */
    const d2 = await press(page, 2);
    ok(d2.lk === 0 && d2.segs === 0,
       `${lang}: ★★内訳が無い行には門を出さない`, `${d2.lk}/${d2.segs}`);
    ok(d2.miss === W.noComp,
       `${lang}: ★代わりに「この投稿には給与内訳が含まれていません」`, d2.miss);
    ok(d2.heads.indexOf(W.comp) < 0,
       `${lang}: ★見出しごと出さない（空の枠を置かない）`, d2.heads.join(','));

    console.log(`\n════ ${lang} / K-4 門のボタン（戻り先は URL に載せない）════`);
    await press(page, 0);
    const cl = await page.evaluate(() => {
      /* ★飛ばさずに押す。飛ぶと次の頁の読み込みを待つことになり、
           「押した瞬間に何を書いたか」が読めない。 */
      const stop = (e) => e.preventDefault();
      document.addEventListener('click', stop, true);
      const a = document.querySelector('.ap-dw-lk-c');
      a.click();
      document.removeEventListener('click', stop, true);
      return { href: location.href,
               back: sessionStorage.getItem('pv_realpay_back') || '',
               dw: document.querySelectorAll('.ap-dw-back').length };
    });
    ok(/pay-report\.html#pay-detail$/.test(d0.lkC ? d0.lkC.href : ''),
       `${lang}: ★行き先は内訳の欄（#pay-detail）`, d0.lkC ? d0.lkC.href : 'なし');
    ok(d0.lkC && d0.lkC.tag === 'A',
       `${lang}: ★リンクのまま（真ん中クリックで別のタブに開ける）`,
       d0.lkC ? d0.lkC.tag : 'なし');
    ok(d0.lkC && d0.lkC.label === W.cta,
       `${lang}: ★札は「給与の内訳を入力する」`, d0.lkC ? d0.lkC.label : 'なし');
    ok(!/180000|180,000|realpay_back|annual/.test(cl.href),
       `${lang}: ★★戻り先を URL に載せない（他人の年収がアドレス欄に出ない）`, cl.href);
    const bk = (() => { try { return JSON.parse(cl.back); } catch (e) { return null; } })();
    ok(bk && bk.a === 'ana' && bk.p === 'cap' && bk.v === 180000,
       `${lang}: ★押した行だけを覚える（会社・職位・年収の3つ）`, cl.back);
    /* ★持ってよい鍵はこれだけ（2026-09-12 に 3 → 7）。
         a/p/v ＝ 押した行を引き当てる3つ。
         fa/fp/fq/pg ＝ **画面に既に出ている絞り込み**（会社・職位・打ち込み・ページ）。
         提出のあと「REAL PAY へ戻る」で帰る先は素の actual-pay.html でクエリが無いため、
         ここに入れておかないと出す前に見ていた一覧が全件に戻る（オーナーの⑦）。
       ⚠️ 数を増やすこと自体が危ないのではなく、**新しく何かを渡す**のが危ない。
          レコード ID・proof_hash・氏名・メールが混ざっていないことを白リストで見る。 */
    const BACK_KEYS = ['a', 'p', 'v', 'fa', 'fp', 'fq', 'pg'];
    ok(Object.keys(bk || {}).every((k) => BACK_KEYS.indexOf(k) >= 0),
       `${lang}: ★それ以上は持たない`, Object.keys(bk || {}).join(','));

    console.log(`\n════ ${lang} / K-5 戻ってくると同じ面が開き、鍵は消える ════`);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2600);
    const re = await page.evaluate(() => ({
      n: document.querySelectorAll('.ap-dw').length,
      name: ((document.querySelector('.ap-dw-name') || {}).innerText || '').trim(),
      back: sessionStorage.getItem('pv_realpay_back')
    }));
    ok(re.n === 1, `${lang}: ★★戻ってくると押した行の面がそのまま開く`, String(re.n));
    ok(/ANA|All Nippon/i.test(re.name),
       `${lang}: ★開くのは押した行（別の行ではない）`, re.name);
    ok(re.back === null, `${lang}: ★★鍵は一度きり（次に来ても勝手に開かない）`,
       String(re.back));
    /* もう一度読み込んでも開かない。 */
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2600);
    const re2 = await page.evaluate(() => document.querySelectorAll('.ap-dw').length);
    ok(re2 === 0, `${lang}: ★2回目は開かない`, String(re2));

    console.log(`\n════ ${lang} / K-6 狭い画面（§17）════`);
    await page.setViewport({ width: 375, height: 780 });
    await sleep(200);
    await press(page, 0);
    const sm = await page.evaluate(() => {
      const a = document.querySelector('.ap-dw-lk-c');
      const r = a.getBoundingClientRect();
      const dw = document.querySelector('.ap-dw');
      return { right: r.right, left: r.left, w: innerWidth,
               ovX: document.documentElement.scrollWidth > innerWidth,
               dwOv: dw.scrollWidth > dw.clientWidth + 1 };
    });
    ok(sm.left >= 0 && sm.right <= sm.w,
       `${lang}: ★★375px でボタンが画面の外に出ない`,
       `${Math.round(sm.left)}〜${Math.round(sm.right)} / ${sm.w}`);
    ok(!sm.ovX && !sm.dwOv, `${lang}: ★横スクロールが生えない`,
       `${sm.ovX}/${sm.dwOv}`);
    await page.setViewport({ width: 1360, height: 1200 });

    ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));
  }
}

/* ════════════════════════════════════════════════════════════════
   L 狭い画面（iPhone）── 2026-09-04 の作り直し
   ★見るのは 375〜430px だけ。広い幅の見え方は1バイトも変えていない
     （表の DOM はそのままで、狭い幅のときだけ CSS がカードに組み替える）。
   ⚠️ 時間で待たない。**条件が満たされるまで**待つ ── 混んだ回に嘘の赤を出さない
      （2026-08-28 に assert-referral.mjs で2種類とも踏んだ）。
   ════════════════════════════════════════════════════════════════ */
const WIDTHS = [375, 390, 393, 430];

/* 条件が満たされるまで待つ。満たされなければ false を返す（例外にしない）。 */
/* ≡ に焦点が戻ったか。★「閉じた」印だけで焦点を読まない（下の2か所で使う）。 */
const FOCUS_HAM = "document.activeElement && document.activeElement.id === 'pv-ham-btn'";

/* ★★時間切れを黙らせない（2026-09-18）──
     false を返すだけだと、次の ok() が「焦点が ≡ に戻らない」という
     **製品の欠陥の顔をして**落ちる。実際には混んだ回に待ちきれなかっただけで、
     単独で流すと通る（2026-09-16、check.mjs all の同時4本でここだけが赤くなり、
     単独では 1684/0 だった）。**待ちきれなかったのか、本当に起きなかったのかを
     読む人が区別できないのが問題の本体。** だから切れた条件をその場で画面に出し、
     最後にも「時間切れが N 回あった」と名乗らせる。
   ⚠️ 5秒 → 10秒に延ばしたのは対症療法にすぎない。混めばいつかは切れるので、
     切れたことが分かる形のほうが本命。**延ばしたから安心、とは考えない。** */
let timedOut = 0;
const till = async (page, fn, ms = 10000) => {
  try { await page.waitForFunction(fn, { timeout: ms, polling: 60 }); return true; }
  catch (e) {
    timedOut++;
    /* ★呼び出した行まで名乗る。条件の文字列は同じものが何度も出てくるので、
       どの行が切れたのかが分からないと直しようがない。 */
    const at = ((new Error().stack || '').split('\n')
      .find((l) => l.includes('assert-pay-rows.mjs') && !l.includes('at till')) || '')
      .replace(/^.*assert-pay-rows\.mjs:/, '').replace(/\).*$/, '').trim();
    console.log('  ⏱ 時間切れ ' + ms + 'ms — ' + String(fn).replace(/\s+/g, ' ').slice(0, 72)
      + (at ? '  @' + at : ''));
    return false;
  }
};
/* シートを開く。★2つ、時間では取れない待ちがある ──
     ① 閉じた直後は暗幕が 320ms だけ DOM に残る。その上から「絞り込み」を押すと
        暗幕が受け取ってしまう（実際に踏んだ）。**暗幕が外れるまで待つ。**
     ② 開けた直後は下から滑っている途中。**下辺が窓の下辺に着くまで待つ。**
   どちらも sleep ではなく条件で待つ。 */
const AT_BOTTOM = "(function(){var s=document.getElementById('ap-sheet');"
  + "if(!s)return false;var r=s.getBoundingClientRect();"
  + "return r.height>0&&Math.abs(r.bottom-window.innerHeight)<=1;})()";
const sheetUp = async (page) => {
  await till(page, "document.querySelectorAll('.ap-sh-back').length === 0");
  await page.click('#ap-open-f');
  const up = await till(page, "document.querySelector('.ap-sh-back.is-in') !== null");
  return up && await till(page, AT_BOTTOM);
};
const sheetGone = (page) =>
  till(page, "!document.getElementById('ap-sheet').hasAttribute('role')");

/* 幅を変えて、その幅で描き終わるまで待つ。 */
/* ★幅を変えたら、板が滑り終わるまで待つ。**時間では待たない。**
     1000px の境目をまたいだ瞬間、閉じている板は 0.32s かけて画面の外へ動き、
     visibility も同じだけ遅れて hidden になる。途中で測ると
     「閉じているのに左端に見えている」と出て、**直っているのに赤くなる**
     （2026-09-06 に踏んだ。CLAUDE.md の「時間で待つ検査は嘘の赤を出す」そのもの）。
   ★止まったことは「2回続けて同じ右端」で判定する（開いている板でも同じに効く）。 */
/* ⚠️ 「2回続けて同じ値」だけでは足りない（2026-09-06 に**両側**を踏んだ）──
     ・混んだ回は transition が**まだ始まっていない**うちに同じ値を2回読み、
       動く前の位置（画面の外）で「止まった」と判定してしまう＝**嘘の緑**
     ・逆に 380ms の sleep で待つと滑っている途中を読み、left が -1 や -17 になる＝**嘘の赤**
   → **一度でも動いたのを見てから、同じ値が3回続いたとき**に止まったと数える。
     まったく動かない場面（reduced-motion・もう定位置）もあるので、
     10回続けて同じなら「そもそも動かない」と見なして抜ける。 */
const SETTLED = "(function(){var e=document.querySelector('.mr-side');if(!e)return true;"
  + "var r=Math.round(e.getBoundingClientRect().right);var s=window.__sideS;"
  + "if(!s){s=window.__sideS={p:r,moved:false,same:0};return false;}"
  + "if(s.p!==r){s.p=r;s.moved=true;s.same=0;return false;}"
  + "s.same++;return (s.moved&&s.same>=3)||s.same>=10;})()";

/* 板が滑り終わるまで待つ。**時間では待たない。** */
const sideStill = async (page) => {
  await page.evaluate(() => { delete window.__sideS; });
  await till(page, SETTLED);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

const widen = async (page, w) => {
  await page.setViewport({ width: w, height: 780 });
  await till(page, 'window.innerWidth === ' + w);
  await sideStill(page);
};

/* 狭い幅で一度に読み取るもの。★毎回同じ形で取る（ケースごとに見方を変えない）。 */
const NAR = () => {
  const q = (s2, r) => Array.prototype.slice.call((r || document).querySelectorAll(s2));
  const de = document.documentElement;
  const st = (e) => (e ? getComputedStyle(e).display : 'なし');
  const box = (e) => { const r = e.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height),
             top: Math.round(r.top), bottom: Math.round(r.bottom),
             left: Math.round(r.left), right: Math.round(r.right) }; };
  const ham = document.getElementById('pv-ham-btn');
  /* 触れる的。★出ていないもの（幅 0）は数えない。 */
  const small = q('#ap-rows .ap-go,#ap-rows .ap-pg,#pv-ham-btn,#ap-open-f,#ap-clear')
    .map((e) => ({ c: e.className || e.id, b: e.getBoundingClientRect() }))
    .filter((x) => x.b.width > 0 && (x.b.height < 44 || x.b.width < 44))
    .map((x) => x.c + ':' + Math.round(x.b.width) + '×' + Math.round(x.b.height));
  return {
    w: innerWidth,
    /* 横に溢れていないか。★入れ子の中で溢れる形もあるので body と一覧も見る。 */
    ovX: de.scrollWidth - de.clientWidth,
    ovBody: document.body.scrollWidth - document.body.clientWidth,
    ovRows: (() => { const e = document.getElementById('ap-rows');
      return e ? e.scrollWidth - e.clientWidth : 0; })(),
    wide: q('#ap-rows *').filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 3).map((e) => String(e.className || e.tagName)),
    trs: q('#ap-rows tbody tr').length,
    /* ★カード1枚の高さと、足元・頭の帯が食う高さ（2026-09-05）。
         オーナーが実機で「2件で画面いっぱい」＝1枚 約295px だった。
         詰めたことが後戻りしないための錨。 */
    cardMax: (() => { const rs = q('#ap-rows tbody tr');
      return rs.length
        ? Math.max.apply(null, rs.map((e) => Math.round(e.getBoundingClientRect().height)))
        : 0; })(),
    barsH: (() => { const h = (s2) => { const e = document.querySelector(s2);
      return e ? Math.round(e.getBoundingClientRect().height) : 0; };
      return h('.mr-top') + h('.ap-filter'); })(),
    /* カードに組み替わったか ── 見出し語（年収 / 月あたり）が出ている。 */
    labs: q('.ap-cl').filter((e) => e.getBoundingClientRect().height > 0).length,
    /* 表の見出しは消さない（読み上げのために置いたまま隠す）。 */
    theadDisp: st(document.querySelector('#ap-rows thead')),
    theadH: (() => { const e = document.querySelector('#ap-rows thead');
      return e ? Math.round(e.getBoundingClientRect().height) : -1; })(),
    /* 張り付く帯と、右から出るドロワーの ≡。 */
    fbtn: (() => { const e = document.getElementById('ap-open-f');
      return e && e.getBoundingClientRect().width > 0 ? box(e) : null; })(),
    cnt: ((document.getElementById('ap-fbar-n') || {}).textContent || '').trim(),
    sheetDisp: st(document.getElementById('ap-sheet')),
    ham: ham && ham.getBoundingClientRect().width > 0 ? box(ham) : null,
    hamExp: ham ? ham.getAttribute('aria-expanded') : null,
    /* ドロワーの板。★閉じている間は画面の**右外**に居る（left ≧ 画面幅）。 */
    side: (() => { const e = document.querySelector('.mr-side');
      return e ? Object.assign(box(e), { vis: getComputedStyle(e).visibility }) : null; })(),
    ovDisp: (() => { const e = document.getElementById('pv-anav-ov');
      return e ? getComputedStyle(e).pointerEvents : 'なし'; })(),
    navN: q('.mr-side-a').length,
    navOn: q('.mr-side-a.is-on').length,
    navHref: q('.mr-side-a').map((e) => e.getAttribute('href') || '(行き先なし)'),
    small: small,
    /* いちばん下の中身（ページ送りがあればそれ、無ければ最後の行）。 */
    lastB: (() => {
      const p = document.querySelector('.ap-pager');
      if (p && p.getBoundingClientRect().height > 0) return Math.round(p.getBoundingClientRect().bottom);
      const rs = q('#ap-rows tbody tr');
      return rs.length ? Math.round(rs[rs.length - 1].getBoundingClientRect().bottom) : 0;
    })(),
    calls: (window.__rpc || []).map((r) => r.name)
  };
};

for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / L-1 4つの幅で崩れない（375 / 390 / 393 / 430）════`);
  const { page, errs } = await open(lang, OPEN);
  const base = (await page.evaluate(NAR)).calls.length;

  for (const w of WIDTHS) {
    await widen(page, w);
    const n = await page.evaluate(NAR);
    ok(n.ovX <= 0 && n.ovBody <= 0 && n.ovRows <= 0,
       `${lang}/${w}px: ★★横スクロールが生えない`,
       `画面${n.ovX} / body${n.ovBody} / 一覧${n.ovRows}` +
       (n.wide.length ? ' ← ' + n.wide.join(', ') : ''));
    ok(n.trs === ROWS.length && n.labs > 0,
       `${lang}/${w}px: ★行はそのまま・カードに組み替わっている`,
       `${n.trs}行 / 見出し語${n.labs}`);
    ok(n.theadDisp !== 'none' && n.theadH <= 1,
       `${lang}/${w}px: ★表の見出しは消さずに隠してある（読み上げに残る）`,
       `${n.theadDisp} / 高さ${n.theadH}`);
    ok(n.fbtn && n.fbtn.h >= 44 && n.fbtn.left >= 0 && n.fbtn.right <= n.w,
       `${lang}/${w}px: ★「絞り込み」の的が 44px 以上で窓の中に収まる`,
       n.fbtn ? `${n.fbtn.w}×${n.fbtn.h} @${n.fbtn.left}〜${n.fbtn.right}` : 'なし');
    ok(n.ham && n.ham.h >= 38 && n.ham.left >= 0 && n.ham.right <= n.w,
       `${lang}/${w}px: ★★ヘッダーに ≡ が出て、窓の中に収まる`,
       n.ham ? `${n.ham.w}×${n.ham.h} @${n.ham.left}〜${n.ham.right} / ${n.w}` : 'なし');
    /* ★2026-09-06、左外 → **右外**。見るのは「左端が画面幅以上」＝1pxも見えていない。 */
    ok(n.side && n.side.left >= n.w - 1 && n.side.vis === 'hidden',
       `${lang}/${w}px: ★★閉じている板は画面の**右外**に居る（タブ移動でも拾えない）`,
       n.side ? `左端 ${n.side.left} / 画面幅 ${n.w} / ${n.side.vis}` : 'なし');
    ok(n.small.length === 0, `${lang}/${w}px: ★触れる的がすべて 44px 以上`,
       n.small.join(' / '));
    /* ★1画面に何枚入るか（2026-09-05・オーナー指示「4-5件入るようにしてよ」）。
       ⚠️ 窓の高さは実機の 844（iPhone 14/15）で数える。この検査の窓は 780 しか無いので、
          そのまま数えると実機より1枚少なく出て、直っているのに赤くなる。
          間の 8px はカードとカードの隙間（.ap-tbl tbody の gap）。 */
    const fit = Math.floor((844 - n.barsH) / (n.cardMax + 8));
    ok(fit >= 4, `${lang}/${w}px: ★★iPhone の1画面にカードが4枚以上入る`,
       `1枚 最大${n.cardMax}px / 上下の帯 ${n.barsH}px → ${fit}枚`);
    ok(n.sheetDisp === 'none',
       `${lang}/${w}px: ★絞り込みは開くまで出ない（帯のボタンだけ）`, n.sheetDisp);
  }
  ok((await page.evaluate(NAR)).calls.length === base,
     `${lang}: ★幅を変えてもサーバへ1本も投げ直さない`, String(base));
  {
    const n = await page.evaluate(NAR);
    ok(n.navN === 8, `${lang}: ★ドロワーの中身は CTA ＋ 7項目 ＝ 8つ`, String(n.navN));
    ok(n.navOn === 1 && n.navHref.filter((h) => h === '(行き先なし)').length === 0,
       `${lang}: ★今いる段が1つだけ光り、行き先の無い段が1つも無い`, n.navHref.join(' / '));
  }

  console.log(`\n════ ${lang} / L-2 ≡ から左にドロワーが出る（下タブは廃止）════`);
  /* ★足元の余白は**広い画面と同じか**で見る。絶対値で見ない ──
       .mr-shell はもともと全幅で 96px の底を持っていて（my-value.css:53）、
       下タブのぶんはその上に足されていた。絶対値で見張ると、帯を外した後も
       元からある底に当たって赤いまま＝**何を直しても消えない赤**になる。 */
  const padOf = () => page.evaluate(() => {
    const e = document.querySelector('.mr-shell');
    return e ? Math.round(parseFloat(getComputedStyle(e).paddingBottom)) : -1; });
  await widen(page, 1280);
  const padWide = await padOf();
  await widen(page, 390);
  const padNar = await padOf();
  ok(padNar >= 0 && padNar === padWide,
     `${lang}: ★★足元に下タブのぶんの空白（96px）が残っていない`,
     `狭い ${padNar}px / 広い ${padWide}px`);

  /* ★いちばん下まで送ってから開ける。ヘッダーは sticky なので、
       スクロール中でもメニューに手が届くことが廃止の前提になっている。 */
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const bot = await page.evaluate(NAR);
  ok(bot.ham && bot.ham.top >= 0 && bot.ham.bottom <= 780,
     `${lang}: ★★いちばん下まで送っても ≡ に手が届く（ヘッダーが張り付いている）`,
     bot.ham ? `${bot.ham.top}〜${bot.ham.bottom}` : 'なし');
  ok(bot.lastB <= 780 + 4 || bot.lastB > 0,
     `${lang}: 中身の底が読めた`, String(bot.lastB));
  /* ★履歴を積まないこと（Phase 4 の「戻る」と衝突させない）。 */
  const hist0 = await page.evaluate(() => history.length);
  await page.click('#pv-ham-btn');
  await till(page, "document.body.classList.contains('pv-anav-open')");
  await sideStill(page);          /* ★滑り終わるまで。380ms の sleep では途中を読む */
  const opened = await page.evaluate(NAR);
  /* ★2026-09-06、左端 → **右端**（オーナー指示）。☰ と同じ側から出る。 */
  ok(opened.side && opened.side.right === opened.w && opened.side.vis === 'visible',
     `${lang}: ★★板が**右端**に貼り付く（right が画面幅）`,
     opened.side ? `${opened.side.left}〜${opened.side.right} / 画面幅 ${opened.w} / ${opened.side.vis}` : 'なし');
  ok(opened.side && opened.side.w <= Math.round(390 * 0.78) + 1,
     `${lang}: ★板は画面を覆い尽くさない（78vw まで）`,
     opened.side ? `${opened.side.w}px` : 'なし');
  ok(opened.ovDisp === 'auto', `${lang}: ★暗幕が出て、押せる状態になる`, opened.ovDisp);
  ok(opened.hamExp === 'true', `${lang}: ★≡ が「開いている」と名乗る`, String(opened.hamExp));
  ok(await page.evaluate(() => history.length) === hist0,
     `${lang}: ★★ドロワーは履歴を積まない（Phase 4 の「戻る」で拾わない）`);

  /* ★閉じ方が3つ ── Escape / 暗幕 / ×。閉じたら ≡ に焦点が戻る。 */
  await page.keyboard.press('Escape');
  await till(page, "!document.body.classList.contains('pv-anav-open')");
  /* ★焦点そのものを待つ。閉じる印（class）が外れるのと、焦点が ≡ に戻るのは
     同じ瞬間ではない（焦点の戻しは次のフレームに預けてある）。class だけ見て
     その場で焦点を読むと、混んだ回に**製品は正しいのに赤くなる**（2026-09-16 に踏んだ）。 */
  await till(page, FOCUS_HAM);
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'pv-ham-btn'),
     `${lang}: ★★Escape で閉じ、焦点が ≡ に戻る`);
  /* ★★閉じた直後に ≡ を押すときは、板が滑り終わるまで待つ（2026-09-18）──
     板は右端に 304px（78vw）出ていて、**≡ ボタンの真上に重なっている**。
     閉じても 320ms は visibility:visible のまま滑っているので、その間に押すと
     板がクリックを受け取って ≡ に届かない＝ドロワーが開かない。
     ⚠️ ここは**開かなかったことに誰も気づけなかった**。次の ok が
     ok(true,…) と「閉じているか」だったので、開かないまま両方とも緑になる。
     時間切れを名乗らせて初めて見つかった（同じ形が2か所あった）。 */
  await sideStill(page);
  await page.click('#pv-ham-btn');
  ok(await till(page, "document.body.classList.contains('pv-anav-open')"),
     `${lang}: ★Escape で閉じたあと、≡ をもう一度押せば開く`);
  await sideStill(page);          /* ★滑り終わってから押す（途中を押すと当たらない）*/
  await page.evaluate(() => document.getElementById('pv-anav-ov').click());
  ok(await till(page, "!document.body.classList.contains('pv-anav-open')"),
     `${lang}: ★暗幕を押して閉じる`);
  await sideStill(page);
  await page.click('#pv-ham-btn');
  ok(await till(page, "document.body.classList.contains('pv-anav-open')"),
     `${lang}: ★暗幕で閉じたあと、≡ をもう一度押せば開く`);
  await sideStill(page);
  await page.evaluate(() => document.querySelector('.mr-side-x').click());
  await till(page, "!document.body.classList.contains('pv-anav-open')");
  await till(page, FOCUS_HAM);
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'pv-ham-btn'),
     `${lang}: ★★× で閉じ、焦点が ≡ に戻る`);

  /* ★★遅れて届いたフレームに焦点をさらわれない（2026-09-11 に踏んで直した）──
       開けた瞬間の焦点移動は「次のフレーム」に預けてある（visibility が
       切り替わる前に focus しても効かないブラウザがあるため）。混んだ回は
       そのフレームが何百 ms も遅れて届き、**そのときには本人がもう閉じている**。
       すると焦点だけが閉じた板の中へ引きずり込まれ、キーボードの人が行き先を
       見失う。実際に `check.mjs all`（同時4本）でここだけが赤くなり、
       単独では 1280/1280 通るという形で出た。
     ⚠️ 時間では待たない・混ませもしない。**フレームそのものを止めて**
       「遅れて届いた1枚」を手で流し込む＝混み具合によらず毎回同じ答えになる。 */
  const late = await page.evaluate(() => new Promise((res) => {
    const keep = [];
    const real = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { keep.push(cb); return 0; };
    document.getElementById('pv-ham-btn').click();          // 開く（焦点はフレーム待ち）
    setTimeout(() => {
      document.querySelector('.mr-side-x').click();         // 遅れている間に閉じる
      window.requestAnimationFrame = real;
      keep.forEach((cb) => { try { cb(); } catch (e) { /* 追わない */ } });
      const a = document.activeElement;
      res({ at: a ? (a.id || a.className || a.tagName) : '',
            open: document.body.classList.contains('pv-anav-open') });
    }, 400);
  }));
  ok(late.at === 'pv-ham-btn' && !late.open,
     `${lang}: ★★遅れて届いたフレームが、閉じた板へ焦点を引きずり込まない`,
     `焦点 ${late.at} / 開いている ${late.open}`);
  await till(page, "!document.body.classList.contains('pv-anav-open')");

  /* ★広い幅に戻したら、開きっぱなしにしない（レールに化けるため）。
     ⚠️ **開いたことを先に確かめる。** 開いていなければ「閉じている」は
     ただの素通りで、何も検査していない（2026-09-18 に実際そうなっていた）。 */
  await sideStill(page);
  await page.click('#pv-ham-btn');
  ok(await till(page, "document.body.classList.contains('pv-anav-open')"),
     `${lang}: 広い幅に戻す前に、まず開いている`);
  await widen(page, 1360);
  ok(await till(page, "!document.body.classList.contains('pv-anav-open')"),
     `${lang}: ★★広い幅に戻すと閉じる（レールに化けたまま暗幕が残らない）`);
  await widen(page, 390);
  await page.evaluate(() => window.scrollTo(0, 0));

  console.log(`\n════ ${lang} / L-3 絞り込みシート（開く・閉じる3経路・焦点）════`);
  const c0 = (await page.evaluate(NAR)).calls.length;
  ok(await sheetUp(page), `${lang}: ★「絞り込み」で下からシートが出る`);
  const sh = await page.evaluate(() => {
    const s2 = document.getElementById('ap-sheet');
    const r = s2.getBoundingClientRect();
    const lab = document.getElementById(s2.getAttribute('aria-labelledby') || '');
    return { role: s2.getAttribute('role'), modal: s2.getAttribute('aria-modal'),
             lab: lab ? (lab.innerText || '').trim() : '',
             ov: document.body.style.overflow,
             backs: document.querySelectorAll('.ap-sh-back').length,
             inside: s2.contains(document.activeElement),
             bottom: Math.round(r.bottom), h: Math.round(r.height),
             go: (document.getElementById('ap-sheet-go').innerText || '').trim(),
             q: !!s2.querySelector('#ap-q'), air: !!s2.querySelector('#ap-air'),
             pos: !!s2.querySelector('#ap-pos'), clr: !!s2.querySelector('#ap-clear'),
             calls: (window.__rpc || []).length };
  });
  ok(sh.role === 'dialog' && sh.modal === 'true' && sh.lab.length > 0,
     `${lang}: ★役割と見出しが読み上げに渡る`, `${sh.role}/${sh.modal}/${sh.lab}`);
  ok(sh.ov === 'hidden' && sh.backs === 1,
     `${lang}: ★★後ろは暗くなって動かない（背景が2枚出ない）`, `${sh.ov}/${sh.backs}`);
  ok(sh.calls === c0, `${lang}: ★★開いてもサーバへ1本も投げない`,
     `${c0} → ${sh.calls}`);
  ok(sh.q && sh.air && sh.pos && sh.clr,
     `${lang}: ★★口は増えていない（今までの3つと「すべてクリア」がそのまま入る）`,
     `${sh.q}/${sh.air}/${sh.pos}/${sh.clr}`);
  ok(sh.bottom <= 781 && sh.h > 0 && sh.h <= 780,
     `${lang}: ★シートは窓の下辺に付いて、はみ出さない`, `底${sh.bottom} 高さ${sh.h}`);
  ok(new RegExp('(^|[^0-9])' + ROWS.length + '([^0-9]|$)').test(sh.go),
     `${lang}: ★主ボタンに今の件数が入る`, sh.go);
  ok(sh.inside, `${lang}: ★開いた瞬間、焦点はシートの中`, String(sh.inside));
  /* ★★「押した先」を実際に拾う。見えているだけでは足りない ──
       シートが暗幕の裏に潜っていると、絵は正しく出ているのに、押した指は
       全部暗幕に当たって「閉じるだけ」になる（2026-09-05 に踏んだ）。
       口の1つ1つについて、その真ん中にある要素が本当にその口かを見る。 */
  const hit = await page.evaluate(() => {
    const at = (el) => {
      const r = el.getBoundingClientRect();
      const n = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return n ? (n.id || n.className || n.tagName) : 'なし';
    };
    const s2 = document.getElementById('ap-sheet');
    const inSheet = (el) => {
      const r = el.getBoundingClientRect();
      const n = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!n && s2.contains(n);
    };
    const ids = ['ap-q', 'ap-air', 'ap-pos', 'ap-clear', 'ap-sheet-go', 'ap-sheet-x'];
    const bad = ids.filter((id) => !inSheet(document.getElementById(id)));
    const r2 = s2.getBoundingClientRect();
    const up = document.elementFromPoint(Math.round(r2.width / 2), Math.round(r2.top / 2));
    return { bad, whom: bad.map((id) => id + '→' + at(document.getElementById(id))).join(' / '),
             dim: up ? (up.className || up.tagName) : 'なし' };
  });
  ok(hit.bad.length === 0,
     `${lang}: ★★シートの中の口は、どれも押した先が自分自身（暗幕に食われていない）`,
     hit.whom);
  ok(String(hit.dim).indexOf('ap-sh-back') >= 0,
     `${lang}: ★シートより上の空きを押すと暗幕に当たる（閉じる経路が生きている）`,
     String(hit.dim));
  /* 焦点の閉じ込め ── Tab を10回押しても外へ出ない。 */
  for (let i = 0; i < 10; i++) await page.keyboard.press('Tab');
  const trap = await page.evaluate(() =>
    document.getElementById('ap-sheet').contains(document.activeElement));
  ok(trap, `${lang}: ★★Tab を10回押しても焦点がシートの外へ出ない`, String(trap));
  /* ① Escape */
  await page.keyboard.press('Escape');
  ok(await sheetGone(page), `${lang}: ★Escape で閉じる`);
  ok(await till(page, `document.activeElement && document.activeElement.id === 'ap-open-f'`),
     `${lang}: ★★閉じたら焦点は開いたボタンへ戻る`);
  ok(await till(page, `document.body.style.overflow !== 'hidden'`),
     `${lang}: ★閉じたら後ろがまた動く`);
  ok(await till(page, `document.querySelectorAll('.ap-sh-back').length === 0`),
     `${lang}: ★暗幕は DOM から外れる（残り続けない）`);
  /* ② 背景 */
  ok(await sheetUp(page), `${lang}: もう一度開く（背景で閉じる番）`);
  await page.mouse.click(195, 30);
  ok(await sheetGone(page), `${lang}: ★背景を押すと閉じる`);
  /* ③ × */
  ok(await sheetUp(page), `${lang}: もう一度開く（× で閉じる番）`);
  await page.click('#ap-sheet-x');
  ok(await sheetGone(page), `${lang}: ★× で閉じる`);

  console.log(`\n════ ${lang} / L-4 絞り込みが URL に載り、読み直しで戻る ════`);
  await sheetUp(page);
  await page.evaluate(() => {
    const s2 = document.getElementById('ap-air');
    s2.value = 'ana';
    s2.dispatchEvent(new Event('change', { bubbles: true }));
  });
  ok(await till(page, `document.querySelectorAll('#ap-rows tbody tr').length === 3`),
     `${lang}: ★シートの中で選ぶと、後ろの一覧がその場で絞られる`);
  const u1 = await page.evaluate(() => ({
    s: location.search,
    go: (document.getElementById('ap-sheet-go').innerText || '').trim() }));
  ok(/air=ana/.test(u1.s), `${lang}: ★★選んだ絞り込みが URL に載る`, u1.s);
  ok(!/annual|180000|realpay_back|usd/i.test(u1.s),
     `${lang}: ★★URL に載るのは選んだ条件だけ（他人の年収は載らない）`, u1.s);
  ok(/(^|[^0-9])3([^0-9]|$)/.test(u1.go), `${lang}: ★主ボタンの件数も付いてくる`, u1.go);
  /* 主ボタンで閉じて一覧の先頭へ。 */
  await page.click('#ap-sheet-go');
  ok(await sheetGone(page), `${lang}: ★「◯件の実給与を見る」で閉じる`);
  /* 読み直し ── 同じ絞り込みで開く。 */
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  ok(await till(page, `document.querySelectorAll('#ap-rows tbody tr').length === 3`, 12000),
     `${lang}: ★★読み直しても同じ絞り込みで開く（共有した URL がそのまま効く）`);
  const rst = await page.evaluate(() => document.getElementById('ap-air').value);
  ok(rst === 'ana', `${lang}: ★選び直さなくても、選択そのものが戻っている`, rst);
  /* すべてクリア。 */
  await widen(page, 390);
  await sheetUp(page);
  await page.click('#ap-clear');
  ok(await till(page, `document.querySelectorAll('#ap-rows tbody tr').length === ` + ROWS.length),
     `${lang}: ★すべてクリアで全件に戻る`);
  ok(await till(page, `location.search === ''`),
     `${lang}: ★★クリアすると URL からも消える（絞り込みが残らない）`);
  await page.keyboard.press('Escape');
  await sheetGone(page);

  console.log(`\n════ ${lang} / L-5 広い幅に戻すと、今までの見え方に戻る ════`);
  await page.setViewport({ width: 1360, height: 1200 });
  await till(page, 'window.innerWidth === 1360');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const wide = await page.evaluate(() => {
    const st = (s2) => { const e = document.querySelector(s2);
      return e ? getComputedStyle(e).display : 'なし'; };
    const on = (s2) => { const e = document.querySelector(s2);
      return !!(e && e.getBoundingClientRect().width > 0); };
    return { ham: st('#pv-ham-btn'), fbtn: st('#ap-open-f'), hd: st('.ap-sheet-hd'),
             ft: st('.ap-sheet-ft'), lab: st('.ap-cl'), cb: st('.ap-cb'),
             sheet: st('#ap-sheet'), fbar: st('#ap-fbar'),
             q: on('#ap-q'), air: on('#ap-air'), pos: on('#ap-pos'), clr: on('#ap-clear'),
             thead: (() => { const e = document.querySelector('#ap-rows thead');
               return Math.round(e.getBoundingClientRect().height); })() };
  });
  ok(wide.ham === 'none' && wide.fbtn === 'none' && wide.hd === 'none' && wide.ft === 'none',
     `${lang}: ★★広い幅では、狭い幅の部品が1つも出ない（≡ も消えてレールに戻る）`,
     `${wide.ham}/${wide.fbtn}/${wide.hd}/${wide.ft}`);
  ok(wide.lab === 'none' && wide.cb === 'none',
     `${lang}: ★カード用の見出し語も帯も出ない（表の字が1文字も増えない）`,
     `${wide.lab}/${wide.cb}`);
  ok(wide.sheet === 'contents' && wide.fbar === 'contents',
     `${lang}: ★★器そのものは消える（3つの口が今までどおり横1列に並ぶ）`,
     `${wide.sheet}/${wide.fbar}`);
  ok(wide.q && wide.air && wide.pos && wide.clr,
     `${lang}: ★3つの口と「すべてクリア」がその場に出ている`,
     `${wide.q}/${wide.air}/${wide.pos}/${wide.clr}`);
  ok(wide.thead > 1, `${lang}: ★表の見出しが戻る`, String(wide.thead));

  ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));
}

/* ページ送りが出る量（23件）でも、いちばん下まで手が届く。 */
{
  console.log('\n════ ja / L-6 ページ送りが出ても、いちばん下まで押せる ════');
  const { page, errs } = await open('ja', MANY);
  await widen(page, 390);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const n = await page.evaluate(NAR);
  ok(n.ovX <= 0 && n.ovBody <= 0, '★390px で横スクロールが生えない（23件）',
     `${n.ovX}/${n.ovBody}`);
  ok(n.lastB > 0 && n.lastB <= 780,
     '★★ページ送りが窓の中に収まる（何にも隠れず押せる）',
     `送りの底 ${n.lastB} / 窓の高さ 780`);
  ok(n.small.length === 0, '★ページ送りの的も 44px 以上', n.small.join(' / '));
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

/* ════════════════════════════════════════════════════════════════
   M ブラウザの「戻る」で詳細だけを閉じる（Phase 4・2026-09-07）

   ★見るのは**押した結果**だけ。「actual-pay.js に pushState と書いてある」では
     1つも通さない（字を見るのは K-0 の担当）。
   ★history.length は back() では**減らない**（進む先が残るだけ）。
     だから「履歴が増殖しない」は **開く前 + 1 を超えない**ことで見る。
     開き直すと進む先が切り捨てられて積み直されるので、何度やっても +1 のまま。
   ★「前のページへ飛んでいない」は**目印**で見る ── 開く前に window へ置いた値が
     一連の操作のあとも残っているか。ページを離れて戻れば読み込み直しで消える。
   ⚠️ 時間で待たない。開き終わり・閉じ終わりは条件で待つ
     （面は 320ms かけて消えるので、待たずに数えると「閉じたのに残っている」と出る）。
   ════════════════════════════════════════════════════════════════ */
{
  /* 面が開き切るまで待って押す。行のどこを押しても同じ面が開く。 */
  const tap = async (page, i) => {
    await page.evaluate((n) => {
      const tr = document.querySelector('#ap-rows [data-ap-row="' + n + '"]');
      const b = tr && (tr.querySelector('.ap-go') || tr);
      if (b) b.click();
    }, i);
    return till(page, "document.querySelector('.ap-dw-back.is-in') !== null");
  };
  const gone = (page) => till(page, "document.querySelectorAll('.ap-dw-back').length === 0");
  /* 一度に読み取るもの。★毎回同じ形で取る。 */
  const HIS = () => ({
    n: history.length,
    st: JSON.stringify(history.state || null),
    href: location.href,
    y: Math.round(window.scrollY),
    dw: document.querySelectorAll('.ap-dw-back').length,
    mark: window.__pvMark || 0,
    act: document.activeElement
      ? (document.activeElement.className || document.activeElement.tagName)
      : 'なし',
    actRow: (function () {
      const a = document.activeElement;
      const tr = a && a.closest ? a.closest('[data-ap-row]') : null;
      return tr ? tr.getAttribute('data-ap-row') : '';
    })()
  });
  const mark = (page) => page.evaluate(() => { window.__pvMark = 1; });
  const back = async (page) => {
    await page.evaluate(() => history.back());
    return gone(page);
  };

  /* ── M-1 開く → 別の行へ替える → 戻る1回で詳細だけ閉じる ───────── */
  for (const lang of ['ja', 'en']) {
    console.log(`\n════ ${lang} / M-1 戻る1回で詳細だけ閉じる（絞り込み・位置・焦点）════`);
    const { page, errs } = await open(lang, MANY);
    /* ★窓を低くする ── 既定の 1200px だと絞り込んだ一覧が丸ごと収まって
         **1px も送れない**。送っていない状態で「位置が動かない」を見ても
         何も担保できない（実際に最初そうなっていた）。 */
    await page.setViewport({ width: 1360, height: 620 });
    await till(page, 'window.innerHeight === 620');

    /* 絞り込みを1つ掛けてから開く。閉じたあとも残っていること。 */
    await page.evaluate(() => {
      const s = document.getElementById('ap-air');
      s.value = 'ana';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await till(page, "location.search.indexOf('air=ana') >= 0");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await till(page, 'window.scrollY > 0');
    await mark(page);
    const a0 = await page.evaluate(HIS);
    ok(a0.y > 0, `${lang}: 前提 ── 一覧を送った状態で開く`, `scrollY ${a0.y}`);

    const rowN = await page.evaluate(() =>
      document.querySelector('#ap-rows [data-ap-row]').getAttribute('data-ap-row'));
    ok(await tap(page, rowN), `${lang}: 行を押すと詳細が開く`);
    const a1 = await page.evaluate(HIS);
    ok(a1.n === a0.n + 1, `${lang}: ★履歴は1段だけ積む`, `${a0.n} → ${a1.n}`);
    ok(a1.href === a0.href, `${lang}: ★★URL が1文字も変わらない`, a1.href);
    ok(a1.st === '{"pvDw":1}',
       `${lang}: ★★履歴に載せるのは目印だけ（会社・職位・金額・ID を持たない）`, a1.st);

    /* 開いたまま別の給与行へ替える（面の中の「類似の記録」）。 */
    const sw = await page.evaluate(() => {
      const b = document.querySelector('.ap-dw [data-ap-row]');
      if (!b) return '';
      b.click();
      return b.getAttribute('data-ap-row');
    });
    await till(page, "document.querySelectorAll('.ap-dw-back').length === 1");
    const a2 = await page.evaluate(HIS);
    ok(sw !== '', `${lang}: 前提 ── 面の中に別の行がある`, sw || 'なし');
    ok(a2.n === a1.n && a2.dw === 1,
       `${lang}: ★★別の行へ替えても履歴を積み増さない`, `${a1.n} → ${a2.n}`);

    /* Desktop ⇄ Mobile を跨いでも重複させない（同じ面なので開いたまま）。 */
    await page.setViewport({ width: 390, height: 780 });
    await till(page, 'window.innerWidth === 390');
    await page.setViewport({ width: 1360, height: 620 });
    await till(page, 'window.innerWidth === 1360');
    const a3 = await page.evaluate(HIS);
    ok(a3.n === a1.n, `${lang}: ★★Desktop / Mobile を跨いでも重複しない`,
       `${a1.n} → ${a3.n}`);

    ok(await back(page), `${lang}: ★★ブラウザの戻るで詳細が閉じる`);
    const a4 = await page.evaluate(HIS);
    ok(a4.mark === 1, `${lang}: ★★ページは動いていない（目印が残っている）`,
       String(a4.mark));
    ok(a4.href === a0.href && /air=ana/.test(a4.href),
       `${lang}: ★★絞り込みがそのまま残る`, a4.href);
    ok(a4.y === a0.y, `${lang}: ★★一覧のスクロール位置が動かない`,
       `${a0.y} → ${a4.y}`);
    ok(!/pvDw/.test(a4.st), `${lang}: ★積んだ段が外れている`, a4.st);
    ok(a4.actRow === rowN,
       `${lang}: ★★焦点が押した行へ戻る`, `${a4.actRow || 'なし'} / ${a4.act}`);
    ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));
  }

  /* ── M-2 ×・Escape・背景 で閉じても履歴が増殖しない ─────────── */
  {
    console.log('\n════ ja / M-2 閉じ方を変えて往復しても履歴が増えない ════');
    const { page, errs } = await open('ja', OPEN);
    await mark(page);
    const b0 = await page.evaluate(HIS);
    const ways = [
      ['×', async () => { await page.evaluate(() =>
        document.querySelector('.ap-dw [data-ap-close]').click()); }],
      ['Escape', async () => { await page.keyboard.press('Escape'); }],
      ['背景', async () => { await page.evaluate(() => {
        const b = document.querySelector('.ap-dw-back');
        b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        b.click();
      }); }]
    ];
    let worst = 0;
    for (let round = 0; round < 2; round++) {
      for (const [name, close] of ways) {
        const up = await tap(page, 0);
        const h = await page.evaluate(() => history.length);
        worst = Math.max(worst, h);
        await close();
        const off = await gone(page);
        if (round === 0) {
          ok(up && off, `ja: ${name} で開いて閉じられる`);
        }
      }
    }
    const b1 = await page.evaluate(HIS);
    ok(worst <= b0.n + 1,
       'ja: ★★6回開け閉めしても履歴が増殖しない（開く前 +1 を超えない）',
       `開く前 ${b0.n} / いちばん多いとき ${worst}`);
    ok(b1.mark === 1, 'ja: ★ページを離れていない', String(b1.mark));

    /* × の連打 ── 二重に戻らない（前のページへ飛ばない）。 */
    await tap(page, 0);
    await page.evaluate(() => {
      const b = document.querySelector('.ap-dw [data-ap-close]');
      b.click(); b.click(); b.click();
    });
    await gone(page);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
    const b2 = await page.evaluate(HIS);
    ok(b2.mark === 1 && b2.href === b0.href,
       'ja: ★★× を連打しても前のページへ飛ばない',
       `目印 ${b2.mark} / ${b2.href}`);
    ok(b2.dw === 0, 'ja: ★連打のあとも面は閉じたまま', String(b2.dw));
    ok(errs.length === 0, 'ja: ページのエラーが1件も出ない', errs.join(' | '));
  }

  /* ── M-3 開いたまま再読み込みしても破綻しない ─────────────── */
  {
    console.log('\n════ ja / M-3 開いたまま再読み込み ════');
    const { page, errs } = await open('ja', OPEN);
    await tap(page, 0);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2600);
    const c0 = await page.evaluate(HIS);
    ok(c0.dw === 0, 'ja: ★読み込み直後は閉じている', String(c0.dw));
    await mark(page);

    /* ★取り残された段を引き継ぐので、ここで積み増さない。 */
    ok(await tap(page, 0), 'ja: 読み込み直しても行を開ける');
    const c1 = await page.evaluate(HIS);
    ok(c1.dw === 1, 'ja: ★詳細が二重に出ない', String(c1.dw));
    ok(c1.n <= c0.n, 'ja: ★★取り残された段を引き継ぐ（積み増さない）',
       `${c0.n} → ${c1.n}`);
    ok(await back(page), 'ja: ★★戻る1回で閉じる');
    const c2 = await page.evaluate(HIS);
    ok(c2.mark === 1, 'ja: ★★戻るでページを離れない（目印が残っている）',
       String(c2.mark));

    /* もう一度往復しても同じ。 */
    await tap(page, 0);
    const c3 = await page.evaluate(HIS);
    ok(c3.n <= c0.n + 1, 'ja: ★2度目も増えない', `${c0.n} → ${c3.n}`);
    ok(await back(page), 'ja: ★2度目の戻るも効く');
    ok(errs.length === 0, 'ja: ページのエラーが1件も出ない', errs.join(' | '));
  }

  /* ── M-4 絞り込み → 詳細 → 給与フォーム → 既存の戻り経路 ─────── */
  {
    console.log('\n════ ja / M-4 給与フォームへの往復（reopenBack を壊さない）════');
    /* ★戻り先を書くのは**内訳の門のボタンだけ**（actual-pay.js の
         `[data-ap-detail]`）。だから内訳が閉じている行が要る ── K と同じ形。 */
    const M_LOCK = { ok: true, state: 'open', mine: MINE, stats: ST,
      rows: [row('ana', 'cap', 180000, true, 0,
                 { fleet: 'b787', ten: 1, work: WORK,
                   paylock: ['base', 'variable', 'other', 'bonus'] }),
             row('jal', 'fo', 110000, false, 4, { fleet: 'a320', ten: 0, work: WORK })],
      give: { basic: true, detailed: false, full: false, payslip: false } };
    const { page, errs } = await open('ja', M_LOCK);
    await page.evaluate(() => {
      const s = document.getElementById('ap-air');
      s.value = 'ana';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await till(page, "location.search.indexOf('air=ana') >= 0");
    await tap(page, 0);
    /* ★飛ばさずに押す（K-4 と同じ手）。飛ぶと偽の Supabase が
         給与フォーム側にも入って、この検査の話ではない所で転ぶ。 */
    const saved = await page.evaluate(() => {
      const a = document.querySelector('.ap-dw-lk-c');
      if (!a) return '';
      const stop = (e) => e.preventDefault();
      document.addEventListener('click', stop, true);
      a.click();
      document.removeEventListener('click', stop, true);
      return sessionStorage.getItem('pv_realpay_back') || '';
    });
    const keys = (() => { try { return Object.keys(JSON.parse(saved)); } catch (e) { return []; } })();
    /* ★行を引き当てる3つは今までどおり。2026-09-12 に**画面に既に出ている
         絞り込み**（fa/fp/fq/pg）が加わった ── 提出後に戻る先が素の
         actual-pay.html でクエリを持たないため。新しく何かを渡してはいない。 */
    ok(keys.indexOf('a') >= 0 && keys.indexOf('p') >= 0 && keys.indexOf('v') >= 0
       && keys.every((k) => ['a', 'p', 'v', 'fa', 'fp', 'fq', 'pg'].indexOf(k) >= 0),
       'ja: ★★戻り先の形（会社・職位・年収＋見ていた絞り込みだけ）', keys.join(','));
    /* 給与フォームから帰ってきた形（読み込み直し）。 */
    await page.goto(BASE + '/actual-pay.html?air=ana',
                    { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2600);
    const opened = await till(page, "document.querySelectorAll('.ap-dw-back').length === 1");
    ok(opened, 'ja: ★★reopenBack が今までどおり同じ面を開く');
    await mark(page);
    const d1 = await page.evaluate(HIS);
    ok(await back(page), 'ja: ★★そこから戻る1回で詳細だけ閉じる');
    const d2 = await page.evaluate(HIS);
    ok(d2.mark === 1, 'ja: ★★給与フォームの往復のあとでもページを離れない',
       String(d2.mark));
    ok(/air=ana/.test(d2.href), 'ja: ★絞り込みが残っている', d2.href);
    ok(d2.n <= d1.n, 'ja: ★履歴が増えたままにならない', `${d1.n} → ${d2.n}`);
    ok(errs.length === 0, 'ja: ページのエラーが1件も出ない', errs.join(' | '));
  }

  /* ── M-5 狭い画面（390px）でも同じ結果 ───────────────────── */
  {
    console.log('\n════ ja / M-5 狭い画面（390px）でも戻るで詳細だけ閉じる ════');
    const { page, errs } = await open('ja', MANY);
    await widen(page, 390);
    await page.evaluate(() => window.scrollTo(0, 260));
    await mark(page);
    const e0 = await page.evaluate(HIS);
    ok(e0.y > 0, 'ja: 前提 ── 送った状態で開く', `scrollY ${e0.y}`);

    /* ★絞り込みのシートは history を積まない（積むと戻るがシートを閉じてしまう）。 */
    const up = await sheetUp(page);
    const e1 = await page.evaluate(HIS);
    ok(up, 'ja: 前提 ── 絞り込みのシートが開く');
    ok(e1.n === e0.n, 'ja: ★★絞り込みのシートは履歴を積まない', `${e0.n} → ${e1.n}`);
    await page.click('#ap-sheet-x');
    await sheetGone(page);

    const rowN = await page.evaluate(() =>
      document.querySelector('#ap-rows [data-ap-row]').getAttribute('data-ap-row'));
    ok(await tap(page, rowN), 'ja: 390px で行を押すと詳細が開く');
    const e2 = await page.evaluate(HIS);
    ok(e2.n === e0.n + 1, 'ja: ★390px でも1段だけ', `${e0.n} → ${e2.n}`);
    ok(await back(page), 'ja: ★★390px でも戻るで詳細だけ閉じる');
    const e3 = await page.evaluate(HIS);
    ok(e3.mark === 1, 'ja: ★★390px でもページを離れない', String(e3.mark));
    ok(e3.y === e0.y, 'ja: ★★390px でもスクロール位置が動かない', `${e0.y} → ${e3.y}`);
    ok(e3.actRow === rowN, 'ja: ★390px でも焦点が押した行へ戻る',
       `${e3.actRow || 'なし'} / ${e3.act}`);
    ok(errs.length === 0, 'ja: ページのエラーが1件も出ない', errs.join(' | '));
  }

  /* ── M-6 共通ナビと干渉しない ──────────────────────────── */
  {
    console.log('\n════ ja / M-6 共通ナビと干渉しない ════');
    const { page, errs } = await open('ja', OPEN);
    await widen(page, 390);
    await mark(page);
    const f0 = await page.evaluate(HIS);
    await page.click('#pv-ham-btn');
    await till(page, "document.body.classList.contains('pv-anav-open')");
    await sideStill(page);
    const f1 = await page.evaluate(HIS);
    ok(f1.n === f0.n, 'ja: ★★共通ナビの開閉は履歴を増やさない', `${f0.n} → ${f1.n}`);
    await page.keyboard.press('Escape');
    await till(page, "!document.body.classList.contains('pv-anav-open')");

    /* ナビを触ったあとでも、詳細の戻るは正しく効く。 */
    ok(await tap(page, 0), 'ja: ナビのあとでも行を開ける');
    const f2 = await page.evaluate(HIS);
    ok(f2.n === f0.n + 1, 'ja: ★ナビのあとでも1段だけ', `${f0.n} → ${f2.n}`);
    ok(await back(page), 'ja: ★★戻るで詳細だけ閉じる');
    const f3 = await page.evaluate(HIS);
    ok(f3.mark === 1 && !f3.dw, 'ja: ★★ページを離れず、面だけ閉じている',
       `目印 ${f3.mark} / 面 ${f3.dw}`);
    ok(await page.evaluate(() => !document.body.classList.contains('pv-anav-open')),
       'ja: ★戻るで共通ナビが開いてしまわない');
    ok(errs.length === 0, 'ja: ページのエラーが1件も出ない', errs.join(' | '));
  }

  /* ── M-7 URL と通信（開閉を原因とする通信が1本も出ない）────────── */
  {
    console.log('\n════ ja / M-7 開閉で通信が1本も出ない ════');
    const { page, errs } = await open('ja', OPEN);
    /* ★数える仕掛けは**起動が落ち着いてから**入れる。最初から数えると、
         語彙と航空会社名の取得（開閉と無関係）を詰め込んでしまう。 */
    await till(page, "document.querySelectorAll('#ap-rows [data-ap-row]').length > 0");
    await page.evaluate(() => {
      window.__net = [];
      const f = window.fetch;
      window.fetch = function (u) { window.__net.push('fetch:' + u); return f.apply(this, arguments); };
      const s = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function () { window.__net.push('xhr'); return s.apply(this, arguments); };
      if (navigator.sendBeacon) {
        const b = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function (u) { window.__net.push('beacon:' + u); return b.apply(null, arguments); };
      }
      const img = window.Image;
      window.Image = function () { window.__net.push('img'); return new img(); };
      window.__rpcN = (window.__rpc || []).length;
    });
    const g0 = await page.evaluate(HIS);
    await tap(page, 0);
    const gOpen = await page.evaluate(() => ({
      href: location.href, st: JSON.stringify(history.state || null) }));
    await page.evaluate(() => {
      const b = document.querySelector('.ap-dw [data-ap-row]');
      if (b) b.click();
    });
    await page.evaluate(() =>
      document.querySelector('.ap-dw [data-ap-close]').click());
    await gone(page);
    await tap(page, 0);
    await back(page);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
    const net = await page.evaluate(() => ({
      net: window.__net, rpc: (window.__rpc || []).length, was: window.__rpcN }));
    const g1 = await page.evaluate(HIS);

    ok(net.net.length === 0,
       'ja: ★★開閉を原因とする通信が1本も出ない（fetch / XHR / beacon / img）',
       net.net.join(' | '));
    ok(net.rpc === net.was, 'ja: ★★給与を取り直さない（RPC が増えない）',
       `${net.was} → ${net.rpc}`);
    ok(gOpen.href === g0.href && g1.href === g0.href,
       'ja: ★★開いても閉じても URL が変わらない', `${g0.href} / ${gOpen.href}`);
    ok(gOpen.st === '{"pvDw":1}',
       'ja: ★★history に載るのは目印だけ', gOpen.st);
    ok(!/ana|jal|emirates|cap|180000|170000|annual|airline/i.test(gOpen.st),
       'ja: ★★会社・職位・金額・レコード ID を history に載せない', gOpen.st);
    ok(errs.length === 0, 'ja: ページのエラーが1件も出ない', errs.join(' | '));
  }

  /* ── M-8 再読み込みのあと、開き直さずに戻る（2026-09-07 追加）──────
       ★M-3 とは別の話。M-3 は「読み込み直して**開いた**とき積み増さない」。
         こちらは「読み込み直して**開かないまま**戻ったとき、REAL PAY へ
         来る前のページへ帰れる」。
       ⚠️ ここは実際に落ちていた ── 開いたまま再読み込みすると同じ URL の段が
         1つ余り（履歴から段を消す手立ては browser に無い）、戻るがその段に
         1回ぶん吸われて**一覧に留まった**。同じ URL なので画面は何も変わらず、
         利用者からは「戻るが効かない」ようにしか見えない。 */
  {
    console.log('\n════ ja / M-8 再読み込みのあと、開かずに戻る ════');
    const { page, errs } = await open('ja', OPEN);
    /* ★「別ページ → REAL PAY」の形にする。前の段が無いとこの確認は成立しない。
         前の段には Supabase を読まないページを選ぶ（偽の Supabase を差し込む
         都合で、読むページだと本題と無関係な所で転ぶ）。 */
    await page.goto(BASE + '/help.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.goto(BASE + '/actual-pay.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    ok(await till(page, "document.querySelectorAll('#ap-rows [data-ap-row]').length > 0", 15000),
       'ja: 別ページから REAL PAY へ来られる');
    ok(await tap(page, 0), 'ja: 詳細を開ける');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    ok(await till(page, "document.querySelectorAll('#ap-rows [data-ap-row]').length > 0", 15000),
       'ja: 再読み込みでも一覧が出る');
    const r0 = await page.evaluate(HIS);
    ok(r0.dw === 0, 'ja: 読み込み直後は閉じている', String(r0.dw));

    /* ★開き直さずに戻る。取り残された段に吸われて一覧へ留まってはいけない。 */
    await page.evaluate(() => history.back());
    const left = await till(page, "location.pathname.indexOf('/help.html') >= 0", 8000);
    ok(left, 'ja: ★★戻る1回で REAL PAY へ来る前のページへ帰れる',
       await page.evaluate(() => location.pathname));
    ok(errs.length === 0, 'ja: ページのエラーが1件も出ない', errs.join(' | '));
  }
}

/* ════════════════════════════════════════════════════════════════
   N / P / P-2 鍵の無い人の一覧（2026-09-16 に作り替え）

   ★2026-09-13 まで、ここは「鍵の無い人には**作り物の5行**しか出さない」節だった。
     2026-09-16、オーナー指示で**本物の行を出す**ことにした ── ただし年収と機種は
     サーバが送らない（db/pay-rows.sql の mask）。
   ★だから見る所が変わった。「1本も呼ばない」ではなく
     **「呼ぶが、渡ってこない」**を見る。3つに分けてある ──
       N   … ログイン済み・鍵なし。サーバは4つのキーだけ返す（正直な形）。
             画面がその4つをちゃんと出せているか
       P   … 未ログイン。サーバが**うっかり全部返した**（毒入り）。
             それでも画面に1文字も出ないこと ＝ 板は「値の有無」ではなく
             「モード」で描いている、という約束そのもの
       P-2 … 未ログイン。サーバが行を返さない（古いサーバ・まだ0件）。
             今までどおり作り物の5行に落ちること
   ⚠️ 本番の個人データは使わない（ここで出入りするのは全部この検査の作り物）。
   ════════════════════════════════════════════════════════════════ */
{
  /* 面が開き切るまで待って押す。★モジュールの gone(v,…) と名前がぶつからないよう
       こちらは dwGone にしてある（あちらは「消したものが戻っていないか」）。 */
  const tapRow = async (page, i) => {
    await page.evaluate((n) => {
      const tr = document.querySelector('#ap-rows [data-ap-row="' + n + '"]');
      const b = tr && (tr.querySelector('.ap-go') || tr);
      if (b) b.click();
    }, i);
    return till(page, "document.querySelector('.ap-dw-back.is-in') !== null");
  };
  const dwGone = (page) => till(page, "document.querySelectorAll('.ap-dw-back').length === 0");
  /* 面の中だけを読む。 */
  const DW = () => {
    const q = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
    const dw = document.querySelector('.ap-dw');
    return {
      path: location.pathname, search: location.search,
      av: q('.ap-dw-av').map((e) => (e.textContent || '').trim()),
      avLk: q('.ap-dw-av-lk').length,
      keys: q('.ap-dw-k').map((e) => (e.textContent || '').trim()).filter(Boolean),
      plates: q('.ap-dw-lk-p2').map((e) => (e.textContent || '').trim()).join(''),
      tag: q('.ap-dw .ap-pv-tag').length,
      src: q('.ap-dw-src').length + q('.ap-dw-age').length + q('.ap-vf').length,
      /* ★面の中だけを数えた出典（2026-09-16）。
         ⚠️ 上の src は**ページ全体**を数えている。`.ap-vf`（Verified の印）は
            一覧の行にも付くので、伏せた一覧（出典を本物のまま出す）を後ろに
            敷いた面では、面の外の印まで足し込まれて数が合わなくなる。
            伏せた面の検査はこちらを見る。 */
      srcDw: dw ? (dw.querySelectorAll('.ap-dw-src').length
                 + dw.querySelectorAll('.ap-dw-age').length
                 + dw.querySelectorAll('.ap-vf').length) : 0,
      sim: q('.ap-dw-sim').length,
      note: q('.ap-dw-note').length,
      cta: q('.ap-dw-cta, .ap-dw-cta2').map(
        (e) => e.getAttribute('href') || ('押しボタン:' + (e.getAttribute('data-ap-gate') || ''))),
      text: dw ? dw.innerText : '',
      /* ★伏せた面の欄ごと（2026-09-18）。型で見える欄が違うので、題と下の1行を分けて取る。
         ⚠️ 板の中の読み上げ用の字を値として数えない（板は別に数える）。 */
      airLk: dw ? dw.querySelectorAll('.ap-dw-name .ap-flt-lk--air').length : 0,
      airTxt: (function () {
        const e = dw && dw.querySelector('.ap-dw-name');
        return e && !e.querySelector('.ap-flt-lk') ? (e.textContent || '').trim() : '';
      })(),
      logoImg: dw ? dw.querySelectorAll('.ap-dw-air img.ap-logo').length : 0,
      logoTxt: (function () {
        const e = dw && dw.querySelector('.ap-dw-air .ap-logo');
        return e && e.tagName !== 'IMG' ? (e.textContent || '').trim() : '';
      })(),
      meta: (function () {
        const e = dw && dw.querySelector('.ap-dw-meta');
        if (!e) return '';
        const c = e.cloneNode(true);
        Array.prototype.slice.call(c.querySelectorAll('.ap-mk-lk')).forEach((x) => x.remove());
        return (c.textContent || '').trim();
      })(),
      posLk: dw ? dw.querySelectorAll('.ap-dw-meta .ap-flt-lk--pos').length : 0,
      fltLk: dw ? dw.querySelectorAll('.ap-dw-meta .ap-flt-lk:not(.ap-flt-lk--pos)').length : 0,
      vfNoDw: dw ? dw.querySelectorAll('.ap-vf-no').length : 0
    };
  };
  /* ブラウザが持ち帰った物を全部並べる（§6「保存領域に本物を混ぜない」）。 */
  const STORE = () => {
    const out = [];
    for (const s of [localStorage, sessionStorage]) {
      for (let i = 0; i < s.length; i++) out.push(s.key(i) + '=' + s.getItem(s.key(i)));
    }
    return out.join('\n');
  };

  /* ── N ログイン済み・鍵なし（サーバは型ごとの欄だけ返す）────────── */
  {
    /* ★検査の前提そのものを先に確かめる。fixture が腐ると、以下の全部が
         「何も守っていないのに緑」になる。 */
    const top = MASK_T_ROWS.slice(0, 8), rest = MASK_T_ROWS.slice(8);
    const bad = top.filter((r) => !MK_SEE[r.t]
        || Object.keys(r).some((k) => k !== 't' && !MK_SEE[r.t].includes(k)))
      .concat(rest.filter((r) => 't' in r || Object.keys(r).some((k) => !['airline', 'age'].includes(k))));
    ok(bad.length === 0 && ['a', 'f', 'c'].every((t) => top.some((r) => r.t === t)),
       'N: ★★偽サーバの行は、型ごとの欄だけ・9行目以降は会社と時期だけ（fixture の前提）',
       JSON.stringify(bad[0] || {}));
    ok(MASK_T_ROWS.every((r) => !(r.airline != null && r.annual_usd != null)),
       'N: ★★偽サーバの行に、会社と年収が並んだ行が1つも無い（fixture の前提）');
    ok(MASK_T_LEAK_ROWS.slice(0, 8).every((r) => r.airline != null && r.annual_usd != null),
       'N-2: ★毒入りの偽サーバは、どの型の行にも会社と年収を両方入れてある（fixture の前提）');
  }
  for (const lang of ['ja', 'en']) {
    console.log(`\n════ ${lang} / N 伏せた本物の一覧（鍵なし）════`);
    const { page, errs } = await open(lang, MASKED_T);
    const v = await page.evaluate(SNAP);
    const tag = `${lang}/伏せた一覧`;

    ok(/actual-pay\.html$/.test(v.url), `${lang}: ★鍵が無くてもこの画面が開く`, v.url);
    maskedRows(v, lang, tag, MASK_T_ROWS);
    blurOK(v, tag, mkPlates(MASK_T_ROWS));
    promises(v, lang, tag);
    noParen(v, tag);
    /* ★数え上げは出す。数はサーバの stats から来る**本物**で、
         伏せた行を画面で数え直したものではない。 */
    ok(v.statsHidden === false && v.stats.length === 3,
       `${lang}: ★数え上げカードは3枚出る（数はサーバのもの）`,
       `${v.statsHidden} / ${v.stats.length}枚`);
    ok(v.stats.map((c) => c.n.replace(/[^\d]/g, '')).join(',') === '11,7,3',
       `${lang}: ★★伏せた行を数え上げに1件も足していない`,
       JSON.stringify(v.stats.map((c) => c.n)));
    /* ★絞り込みの帯は出す。選択肢は**読める値だけ**から作る。 */
    {
      const seen = (k) => new Set(MASK_T_ROWS.map((r) => mkSee(r)[k]).filter((x) => x != null)).size;
      ok(v.barHidden === false && v.airOpts.length === 1 + seen('airline') && v.posOpts.length === 1 + seen('pos'),
         `${lang}: ★絞り込みが使える（選択肢は、行に読める会社・職位だけから作る）`,
         `${v.barHidden} / 社${v.airOpts.join(',')} / 職位${v.posOpts.join(',')}`);
    }
    /* ★登録は済んでいる人なので「すでにアカウントをお持ちの方」は出さない。 */
    ok(v.pvIn.length === 0, `${lang}: ★ログイン済みの人にログインの入口を出さない`,
       v.pvIn.join(','));

    /* ── 押すと開く面（型ごとに1つずつ・9行目以降の2つ）──────────── */
    for (const [i, what] of [[0, '年収型'], [1, '会社型'], [2, '機種型'],
                             [3, '機材の無い機種型'], [8, '9行目以降・会社あり'],
                             [9, '9行目以降・時期だけ']]) {
      ok(await tapRow(page, i), `${lang}: ${i + 1}件目（${what}）の詳細が開く`);
      maskedDrawer(await page.evaluate(DW), `${tag}/面${i + 1}（${what}）`, MASK_T_ROWS[i], lang);
      await page.evaluate(() => history.back());
      ok(await dwGone(page), `${lang}: 戻る操作で詳細だけ閉じる（${what}）`);
    }

    /* ── 会社で絞る ─────────────────────────────────────
         ★★会社を伏せた行（年収型・機種型）は、どの会社を選んでも1行も残らない。
           残ったら、その行の会社が画面の外で分かっていることになる。 */
    {
      await page.select('#ap-air', 'ana');
      await sleep(400);
      const v2 = await page.evaluate(SNAP);
      const want = MASK_T_ROWS.map((r, k) => [r, k]).filter(([r]) => mkSee(r).airline === 'ana');
      ok(v2.mkTrs === want.length && v2.amounts.length === 0,
         `${lang}: ★★会社で絞ると、その会社が読める行だけが残る（年収の出る行は1つも残らない）`,
         `${v2.mkTrs}行 / 期待 ${want.length} / 年収${v2.amounts.join(',')}`);
      ok(v2.mkRows.every((r) => r.air !== '' && r.sub === ''),
         `${lang}: ★絞った後の行に、機材・年数の段が1つも無い`,
         v2.mkRows.map((r) => `${r.air}/${r.sub}`).join(' | '));
      await page.select('#ap-air', '');
      await sleep(300);
    }
    ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));
  }

  /* ── N-古 古いサーバ（型の印を持たない4つだけの行）──────────────
       ★JS を先に push し、SQL を後で貼る。その間は古いサーバのまま＝
         今日までと同じ画面（会社・職位・出典・時期）がそのまま出ること。 */
  {
    const bad = MASK_ROWS.filter((r) => Object.keys(r).some((k) =>
      ['annual_usd', 'fleet', 'fleet_cat', 'work', 'pay', 'paylock', 'ten', 'comp', 't'].includes(k)));
    ok(bad.length === 0,
       'N-古: ★★古いサーバの行に、年収も機材も内訳も勤務も型の印も入っていない（fixture の前提）',
       JSON.stringify(bad[0] || {}));
  }
  for (const lang of ['ja', 'en']) {
    console.log(`\n════ ${lang} / N-古 伏せた一覧（古いサーバの4つだけ）════`);
    const { page, errs } = await open(lang, MASKED);
    const v = await page.evaluate(SNAP);
    const tag = `${lang}/古いサーバ`;
    maskedRows(v, lang, tag, MASK_ROWS);
    blurOK(v, tag, mkPlates(MASK_ROWS));
    ok(v.airNames.length === MASK_ROWS.length && v.logoImgs === MASK_ROWS.length,
       `${tag}: ★会社名と社ロゴがどの行でも読める（今日までの画面のまま）`,
       `${v.airNames.length} / ロゴ${v.logoImgs}`);
    ok(v.amounts.length === 0 && v.mkFlt === MASK_ROWS.length,
       `${tag}: ★年収と機種はどの行も板（今日までの画面のまま）`,
       `年収${v.amounts.length} / 機種の板${v.mkFlt}`);
    ok(await tapRow(page, 0), `${lang}: 1件目の詳細が開く`);
    maskedDrawer(await page.evaluate(DW), `${tag}/面1`, MASK_ROWS[0], lang);
    await page.evaluate(() => history.back());
    ok(await dwGone(page), `${lang}: 戻る操作で詳細だけ閉じる`);
    ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));
  }

  /* ── N-2 サーバが型を無視して全部入れてしまった（毒入り）──────────
       ★この節の値打ちは「2本目の鍵」──画面の白リストだけで、型の外の欄が
         1文字も出ないこと。会社型に年収・機材、年収型に会社・職位・機材、
         機種型に会社・年収、9行目以降に全部入り、知らない型にも全部入り。 */
  for (const lang of ['ja', 'en']) {
    console.log(`\n════ ${lang} / N-2 伏せた一覧（サーバが型を無視して全部返した）════`);
    const { page, errs } = await open(lang, MASKED_T_LEAK);
    const v = await page.evaluate(SNAP);
    const tag = `${lang}/型を無視した毒`;
    maskedRows(v, lang, tag, MASK_T_LEAK_ROWS);
    {
      /* ★サーバが年収型・機種型に混ぜた会社は、絞り込みの選択肢にも出ない。 */
      const seen = (k) => new Set(MASK_T_LEAK_ROWS.map((r) => mkSee(r)[k]).filter((x) => x != null)).size;
      ok(v.airOpts.length === 1 + seen('airline') && v.posOpts.length === 1 + seen('pos'),
         `${lang}: ★★絞り込みの選択肢に、型の外の会社・職位が1つも入らない`,
         `社${v.airOpts.join(',')} / 職位${v.posOpts.join(',')}`);
    }
    blurOK(v, tag, mkPlates(MASK_T_LEAK_ROWS));
    {
      const leaked = POISON_VALUES.filter((t) => v.bodyText.includes(t));
      ok(leaked.length === 0, `${lang}: ★★サーバが混ぜた本物が画面に1文字も出ない`, leaked.join(','));
      const st = await page.evaluate(STORE);
      ok(POISON_VALUES.filter((t) => st.includes(t)).length === 0,
         `${lang}: ★★ブラウザの保存領域にも本物が入らない`,
         POISON_VALUES.filter((t) => st.includes(t)).join(','));
    }
    /* ★知らない型の行は投稿時期だけ（新しい型をサーバだけ足しても、画面は何も出さない）。 */
    {
      const z = v.mkRows[9] || {};
      ok(z.airLk === 1 && z.posLk === 1 && z.subLk === 1 && z.amtLk === 2
         && z.vf + z.vfNo === 0 && z.age !== '',
         `${lang}: ★★知らない型の行は、全部入りでも投稿時期だけ`, JSON.stringify(z).slice(0, 200));
    }
    for (const [i, what] of [[0, '年収型'], [1, '会社型'], [2, '機種型'], [9, '知らない型']]) {
      ok(await tapRow(page, i), `${lang}: ${i + 1}件目（${what}）の詳細が開く`);
      maskedDrawer(await page.evaluate(DW), `${tag}/面${i + 1}（${what}）`, MASK_T_LEAK_ROWS[i], lang);
      await page.evaluate(() => history.back());
      ok(await dwGone(page), `${lang}: 戻る操作で詳細だけ閉じる（${what}）`);
    }
    /* ★会社で絞っても、年収型の行（サーバが会社を混ぜた）は残らない。 */
    {
      await page.select('#ap-air', 'ana');
      await sleep(400);
      const v2 = await page.evaluate(SNAP);
      const want = MASK_T_LEAK_ROWS.filter((r) => mkSee(r).airline === 'ana').length;
      ok(v2.mkTrs === want && v2.amounts.length === 0,
         `${lang}: ★★会社で絞っても、サーバが混ぜた会社で年収の行が引っかからない`,
         `${v2.mkTrs}行 / 期待 ${want} / 年収${v2.amounts.join(',')}`);
    }
    ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));
  }

  /* ── P 未ログイン。サーバがうっかり全部返した（毒入り）───────────
       ★この節の値打ちは「画面がそれらしく見えること」ではなく、
         **本物が1バイトも画面に出ないこと**にある。だから偽サーバには
         わざと**全部入り**（ROWS・毒入り）を答えとして持たせておく。 */
  for (const lang of ['ja', 'en']) {
    console.log(`\n════ ${lang} / P 未ログイン（サーバが全部返しても出ない）════`);
    const { page, errs } = await open(lang, LOCKED_LEAK, { anon: true });
    const v = await page.evaluate(SNAP);
    const tag = `${lang}/未ログイン`;

    /* ① ページの入口でログイン画面へ転送しない（指示書 §2）。 */
    ok(/actual-pay\.html$/.test(v.url),
       `${lang}: ★★未ログインでもこの画面が開く（ログイン画面へ飛ばさない）`, v.url);
    /* ② 投げるのは一覧の1本だけ。★2026-09-16 にここが反転した ── 前は
         「1本も投げない」だった。預かりの sweep は今までどおり投げない
         （引き取る相手が居ない）。本人の明細も引かない。 */
    const pay = v.calls.filter((n) => /pay|claim|report|unlock/i.test(n));
    ok(pay.length === 1 && pay[0] === 'pv_pay_rows',
       `${lang}: ★★本物に触る問い合わせは pv_pay_rows の1本だけ`, v.calls.join(','));
    /* ③ 返ってきた毒が、画面のどこにも1文字も出ない。
         ★伏せた一覧を描く所が money() / fleetName() を1つも呼ばないので、
           サーバが何を混ぜても出口が無い。ここはその出口を実測で塞いでいる。 */
    const leaked = POISON_VALUES.filter((t) => v.bodyText.includes(t));
    ok(leaked.length === 0, `${lang}: ★★サーバが返した本物が画面に1文字も出ない`,
       leaked.join(','));
    /* ブラウザに持ち帰ってもいない。 */
    const st0 = await page.evaluate(STORE);
    ok(POISON_VALUES.filter((t) => st0.includes(t)).length === 0,
       `${lang}: ★★ブラウザの保存領域にも本物が入らない`,
       POISON_VALUES.filter((t) => st0.includes(t)).join(','));
    /* ④ ぼかしが掛かっているのは**中身の空いた板**だけ。文字を霞ませていない。 */
    blurOK(v, tag, mkPlates(ROWS));
    /* ⑤ 伏せた一覧の約束（N と同じものを、毒入りのサーバ相手にもう一度）。 */
    maskedRows(v, lang, tag, ROWS);
    promises(v, lang, tag);
    /* ⑥ 数え上げカードは出す。★2026-09-16 にここも反転した ── 前は
         「本物が無いので 0 で埋めない」＝カードごと出さない、だった。
         いまは行が本物なので、サーバの数え上げをそのまま出す。 */
    ok(v.statsHidden === false && v.stats.length === 3,
       `${lang}: ★数え上げカードが3枚出る`, `${v.statsHidden} / ${v.stats.length}枚`);
    /* ⑦ 未ログインのときだけ出る「すでにアカウントをお持ちの方」。 */
    ok(v.pvIn.length === 1 && /login\.html/.test(v.pvIn[0] || ''),
       `${lang}: ★ログインの入口が1つだけ出る`, v.pvIn.join(','));

    /* ── 詳細（押すと開く面）─────────────────────────── */
    ok(await tapRow(page, 0), `${lang}: 1件目の詳細が開く（ログイン画面へ飛ばない）`);
    const d0 = await page.evaluate(DW);
    maskedDrawer(d0, `${tag}/面1`, ROWS[0], lang);
    ok(POISON_VALUES.filter((t) => d0.text.includes(t)).length === 0,
       `${lang}: ★★面の中にも本物が1文字も出ない`,
       POISON_VALUES.filter((t) => d0.text.includes(t)).join(','));
    await page.evaluate(() => history.back());
    ok(await dwGone(page), `${lang}: 戻る操作で詳細だけ閉じる`);

    ok(await tapRow(page, 2), `${lang}: 3件目の詳細も開く`);
    const d2 = await page.evaluate(DW);
    maskedDrawer(d2, `${tag}/面3`, ROWS[2], lang);
    await page.evaluate(() => history.back());
    ok(await dwGone(page), `${lang}: 戻る操作で詳細だけ閉じる（2回目）`);
    const f = await page.evaluate(() => {
      const a = document.activeElement;
      const tr = a && a.closest ? a.closest('[data-ap-row]') : null;
      return { cls: (a && a.className) || '', row: tr ? tr.getAttribute('data-ap-row') : '' };
    });
    ok(/ap-go/.test(f.cls) && f.row === '2',
       `${lang}: ★閉じたあと、押した行のボタンに焦点が戻る`, JSON.stringify(f));

    /* ── ⑧ 会社を選んだとき ─────────────────────────────
         ★選んでもサーバへ投げ直さない（行はもう手元に在る）。
         ★2026-09-16、**URL には載る**。ここは開いている一覧と同じ扱いにした ──
           伏せた一覧は**本物の行**なので、絞り込みも本物＝あとで開き直せるほうが良い。
           作り物の5行（P-2）だけは今までどおり載せない（在りもしない会社の一覧を
           指す URL を配れてしまうため）。 */
    const pick = await page.evaluate(() => {
      const s = document.getElementById('ap-air');
      const o = Array.prototype.slice.call(s ? s.options : []).find((x) => x.value);
      return o ? { v: o.value, label: (o.textContent || '').trim() } : null;
    });
    ok(!!pick, `${lang}: 会社の選択肢が出ている`);
    if (pick) {
      const before = v.calls.length;
      await page.select('#ap-air', pick.v);
      await sleep(400);
      const v2 = await page.evaluate(SNAP);
      ok(v2.mkTrs >= 1 && v2.mkTrs <= ROWS.length,
         `${lang}: ★選んだ会社の行だけが残る`, `${v2.mkTrs}行`);
      ok(v2.calls.length === before,
         `${lang}: ★★会社を選んでも問い合わせが1本も増えない`,
         `${before} → ${v2.calls.join(',')}`);
      ok(v2.barHidden === false,
         `${lang}: ★絞り込みの帯は出したまま（自分で解除できる）`, String(v2.barHidden));
      const q = await page.evaluate(() => location.search + location.hash);
      ok(q.indexOf('air=' + pick.v) >= 0,
         `${lang}: ★選んだ絞り込みが URL に載る（本物の行なので開き直せる）`, q);
      ok(POISON_VALUES.filter((t) => v2.bodyText.includes(t)).length === 0,
         `${lang}: ★★絞り込んだあとも本物が1文字も出ない`,
         POISON_VALUES.filter((t) => v2.bodyText.includes(t)).join(','));
    }
    ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));
  }

  /* ── P-2 未ログイン。サーバが行を返さない（古いサーバ・まだ0件）──────
       ★db/pay-rows.sql を貼る前と、投稿が本当に0件のときの姿。
         今までどおり**作り物の5行**に落ちる ── 空の画面を見せない。
       ★ここが在ることで、貼る順（SQL が先・JS が後）を間違えても
         画面が壊れないことが機械で確かめられる。 */
  for (const lang of ['ja', 'en']) {
    console.log(`\n════ ${lang} / P-2 未ログイン（サーバが行を返さない）════`);
    const { page, errs } = await open(lang, LOCKED_ST, { anon: true });
    const v = await page.evaluate(SNAP);
    const tag = `${lang}/未ログイン・行ゼロ`;

    ok(/actual-pay\.html$/.test(v.url),
       `${lang}: ★★未ログインでもこの画面が開く（ログイン画面へ飛ばさない）`, v.url);
    ok(v.mkTbl === 0 && v.mkTrs === 0,
       `${lang}: ★伏せた一覧は出ない（行が来ていないので）`,
       `表${v.mkTbl} / 行${v.mkTrs}`);
    previewRows(v, lang, tag);
    promises(v, lang, tag);
    /* ★作り物の5行にはぼかしを1つも掛けない。板はぼかさず「空のまま」出す
         ── .ap-r--mk / .ap-dw--mk の下に閉じ込めてある規則が、
            うっかり全部の板へ広がっていないかをここが見る。 */
    ok(v.blurred.length === 0,
       `${lang}: ★★作り物の5行にはぼかしが1つも掛からない（板は空のまま出す）`,
       blurWhy(v));
    ok(v.pvIn.length === 1 && /login\.html/.test(v.pvIn[0] || ''),
       `${lang}: ★ログインの入口が1つだけ出る`, v.pvIn.join(','));

    /* ── 作り物の5行で会社を絞ったとき（2026-09-13 からの約束をそのまま）──
         ★プレビューの選択肢は語彙から作るので、**行の無い会社**が選べる。
           社名をどの行にも貼らない・投稿があるとは書かない・問い合わせを増やさない。 */
    const pick = await page.evaluate(() => {
      const s = document.getElementById('ap-air');
      const pv = ['jal', 'etihad', 'ana', 'cathay-pacific', 'singapore-airlines'];
      const o = Array.prototype.slice.call(s ? s.options : [])
        .find((x) => x.value && pv.indexOf(x.value) < 0);
      return o ? { v: o.value, label: (o.textContent || '').trim() } : null;
    });
    ok(!!pick, `${lang}: 会社の選択肢に、プレビューに居ない会社がある`);
    if (pick) {
      const before = v.calls.length;
      await page.select('#ap-air', pick.v);
      await till(page, "document.querySelectorAll('.ap-pv-msg').length > 0", 4000);
      const v2 = await page.evaluate(SNAP);
      ok(v2.pvMsg !== '' && v2.pvTrs === 0,
         `${lang}: ★居ない会社を選ぶと、行は消えて案内に替わる`,
         `${v2.pvTrs}行 / ${v2.pvMsg}`);
      ok(v2.rowsText.indexOf(pick.label) < 0,
         `${lang}: ★★選んだ社名をどの行にも貼らない`, pick.label);
      /* ⚠️ 「件」だけで見ない。案内の1行目は「給与を1件共有すると」＝**本人**の
           話で、選んだ会社の投稿数の主張ではない。見るのは「ある／いくつある」と
           言っている形だけ。 */
      const bad = lang === 'ja'
        ? (v2.pvMsg.match(/投稿があ|登録されて|この会社[^。]*\d+\s*件/g) || [])
        : (v2.pvMsg.match(/there (?:are|is)\s+\d+|\d+\s*(?:records?|reports?|submissions?)\s+(?:for|from|at)/gi) || []);
      ok(bad.length === 0, `${lang}: ★★「その会社の投稿がある」とは書かない`, bad.join(','));
      ok(v2.calls.length === before
         && v2.calls.filter((n) => /claim|report|unlock/i.test(n)).length === 0,
         `${lang}: ★★会社を選んでも問い合わせが1本も増えない`,
         `${before} → ${v2.calls.length} / ${v2.calls.join(',')}`);
      ok(v2.barHidden === false,
         `${lang}: ★0件になっても帯は出したまま（自分で解除できる）`, String(v2.barHidden));
      /* ★選んだ会社を URL に載せない（画面の URL は解析に載る）。 */
      const q = await page.evaluate(() => location.search + location.hash);
      ok(q === '', `${lang}: ★★選んだ会社が URL に載らない`, q);
    }
    ok(errs.length === 0, `${lang}: ページのエラーが1件も出ない`, errs.join(' | '));
  }

  /* ════════════════════════════════════════════════════════════════
     Q 席が切れたら本物を消す（2026-09-13）

     ★指示書 §6 ── ログアウト・権限失効・別ユーザー切替で実データの表示と
       ブラウザに残った物を消し、**戻る操作で復元されない**こと。
     ★ここは2通りある ── ① 知らせが届く（SIGNED_OUT）
                        ② 知らせが届かないまま、ブラウザが画面ごと復元する
       ②のほうが危ない（画面は生きたまま古い本物が残る）ので、別に見る。
     ════════════════════════════════════════════════════════════════ */

  /* ── Q-1 ログアウトの知らせが届いたとき ───────────────────── */
  {
    console.log('\n════ ja / Q-1 ログアウトで本物を消す ════');
    const { page, errs } = await open('ja', OPEN);
    const a = await page.evaluate(SNAP);
    ok(a.rowSel === ROWS.length && a.pvTrs === 0,
       'ja: まず本物の一覧が出ている', `${a.rowSel}行 / 作り物${a.pvTrs}行`);
    ok(await tapRow(page, 0), 'ja: 詳細を開けている');

    await page.evaluate(() => { window.__signedOut = 1; window.__authCb('SIGNED_OUT', null); });
    ok(await dwGone(page), 'ja: ★ログアウトで、開いていた詳細も閉じる');
    const b = await page.evaluate(SNAP);
    /* ★2026-09-16、捨てたあとに**取り直しに行く**（席の無い人にも伏せた一覧が在るため）。
       ⚠️ 取り直しを落とすと、ログアウトした人だけが作り物の5行のまま取り残される。
          画面は普通に見えるので、数えるのはここだけ。順番は今までどおり
          「まず捨てる → それから取る」。 */
    ok(b.calls.filter((n) => n === 'pv_pay_rows').length
       === a.calls.filter((n) => n === 'pv_pay_rows').length + 1,
       'ja: ★ログアウトのあと、伏せた一覧を取り直しに行く',
       `${a.calls.join(',')} → ${b.calls.join(',')}`);
    previewRows(b, 'ja', 'ja/ログアウト後');
    ok(POISON_VALUES.filter((s) => b.bodyText.includes(s)).length === 0,
       'ja: ★★本物の中身が画面に1文字も残らない',
       POISON_VALUES.filter((s) => b.bodyText.includes(s)).join(','));
    ok(b.statsHidden === true && b.stats.length === 0,
       'ja: ★数え上げカードも消える（本物だったので）',
       `hidden=${b.statsHidden} / ${b.stats.length}枚`);
    const st = await page.evaluate(STORE);
    ok(POISON_VALUES.filter((s) => st.includes(s)).length === 0,
       'ja: ★★ブラウザの保存領域にも本物が残らない',
       POISON_VALUES.filter((s) => st.includes(s)).join(','));

    /* ★戻る操作（ブラウザが画面ごと復元する形）でも生き返らない。 */
    await page.evaluate(() => window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true })));
    await sleep(700);
    const c = await page.evaluate(SNAP);
    ok(c.pvTrs === 5 && POISON_VALUES.filter((s) => c.bodyText.includes(s)).length === 0,
       'ja: ★★戻る操作でも本物が生き返らない', `${c.pvTrs}行`);
    ok(errs.length === 0, 'ja: ページのエラーが1件も出ない', errs.join(' | '));
  }

  /* ── Q-2 知らせが届かないまま、ブラウザが画面ごと復元したとき ────────
       ★別のタブでログアウトした・鍵が切れた、のあとに「戻る」で帰ってくる形。
         画面は生きているので、何もしなければ**古い本物が出たまま**になる。 */
  {
    console.log('\n════ ja / Q-2 戻るで復元されたとき、席を取り直す ════');
    const { page, errs } = await open('ja', OPEN);
    const a = await page.evaluate(SNAP);
    ok(a.rowSel === ROWS.length, 'ja: まず本物の一覧が出ている', `${a.rowSel}行`);

    await page.evaluate(() => {
      window.__signedOut = 1;   /* ★知らせは出さない。席だけが切れている */
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    ok(await till(page, "document.querySelectorAll('#ap-rows tbody tr.ap-r--pv').length === 5", 8000),
       'ja: ★★席が切れていれば、戻って復元された画面もプレビューへ落ちる');
    const b = await page.evaluate(SNAP);
    previewRows(b, 'ja', 'ja/復元後');
    ok(POISON_VALUES.filter((s) => b.bodyText.includes(s)).length === 0,
       'ja: ★★本物の中身が画面に1文字も残らない',
       POISON_VALUES.filter((s) => b.bodyText.includes(s)).join(','));
    ok(errs.length === 0, 'ja: ページのエラーが1件も出ない', errs.join(' | '));
  }
}

for (const jar of jars) { try { await jar.close(); } catch (e) {} }
await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
if (timedOut) {
  console.log(`  ⏱ 待ちが時間切れになった回数: ${timedOut}`);
  console.log('     ↑ 上の ⏱ の行を見る。赤が出ていて、その直前に ⏱ が出ているなら、\n       製品ではなく**待ちきれなかった**可能性がある。その1本だけ単独で流し直す:\n         node assert-pay-rows.mjs');
}
process.exit(fail ? 1 : 0);
