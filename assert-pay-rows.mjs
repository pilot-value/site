/* assert-pay-rows.mjs — 「他のパイロットの実給与を見る」（actual-pay）の約束を機械で確かめる。

   この画面は、このサイトで初めて **他人の一次データを1行ずつ見せる** 場所。
   1行＝1人で、しかも **給与を出した人は全員出る**（人数の門は無い）。

   ★2026-08-23、オーナー判断で次の3つが無くなった。
       ・k≧5 の門（5人そろった区分だけ出す）
       ・30日の遅延
       ・公開情報からの推定レンジの節（青）と、右の「選んだ区分」パネル
     だから守りは残る6つに全部かかっている。ここはその6つを見る：

     ① 鍵の無い人には金額が1文字も出ない
        （db/pay-rows.sql が state:'locked' を返す。画面のモザイクではない）
     ② 内訳は割合だけ（金額は返さない）＋ 準識別子は1つも画面に出ない
        ★2026-08-24、オーナー判断で「行を押すとその人の内訳（ドーナツ）」を足した。
          だから②は「準識別子ゼロ」ではなくなった。サーバが返すのは comp＝
          m/b/d/h/o の**整数パーセント5つだけ**で、金額は1つも返さない。
          画面の年収（有効数字2桁）に掛ければ ±10% ほどで実額は逆算できる。
          ここではその線を守る：**他人のドーナツに通貨記号が1文字も出ないこと**。
        そのうえで、基地・在籍年数・年代・投稿月・原本の通貨・契約形態・国籍・識別子、
        そして**自由入力で打ち込まれた社名**。
        ★この検査では、サーバが返さないはずのこれらを **わざと混ぜた行** を流し込み、
          画面のどこにも出ないことを見る。将来 r.base_iata を1つ足した人が即座に赤くなる
     ③ 金額はすべて有効数字2桁（表示通貨に換算したあとも）
     ④ 1行＝1人。表は1枚だけ
        ⚠️ 粒度を2つに分けた形へ戻さない（同じ人が両方に出て二重に数えたように見える）
     ⑤ 数え上げを見せない
        合計件数・カバー社数・「◯人」を結果の中に出さない。行を数えれば人数は読めるが、
        総数を明示すると会員規模そのものが出る
     ⑥ 通貨を切り替えても pv_pay_rows() を引き直さない
        （データは state に持つ。引き直すと切替のたびにサーバを叩く）
     ⑦ 図（2026-08-24 追加）
        ・既定は「あなたの支給構成」＝ my_pay_reports()。ここだけ金額が出る（本人の数字）
        ・行を押すと**その人の割合**に切り替わる。★通貨記号が1文字も出ない
        ・comp が null の行を押しても壊れず、静かに「内訳を出せません」になる
        ・閉じ方が3つ（もう一度押す／「自分に戻す」／ESC）。閉じ込めを作らない
        ・分布の棒に**人数の数字を書かない**（高さで目分量に読めるところまで）
        ・行を選んでも**並びは1行も動かない**（選択が並べ替えに化けない）

   ★もう1つ、消えたものが戻っていないことを見る：
     青のバッジ・推定レンジ・「5人」「30日」の約束・招待カードの差込口。
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
  /* ★2026-08-24 反転。この画面は図を描くようになったので pay-viz を読む。
       ⚠️ 読む順が肝。pay-viz.css の [data-theme="light"] .pt-* と
          actual-pay.css の .ap-vcard .pt-* は詳細度が同じ（0,2,0）で、
          後に書いたほうが勝つ。逆に置くと暗い前提の色が明るい画面に出る。 */
  const at = (file) => html.search(new RegExp('(?:src|href)="[^"]*' + file.replace('.', '\\.') + '"'));
  const iVizC = at('pay-viz.css'), iApC = at('actual-pay.css');
  ok(iVizC >= 0 && iApC > iVizC,
     `${name}: pay-viz.css を actual-pay.css より先に読む`, `${iVizC} / ${iApC}`);
  const iVizJ = at('pay-viz.js'), iApJ = at('actual-pay.js');
  ok(iVizJ >= 0 && iApJ > iVizJ,
     `${name}: pay-viz.js を actual-pay.js より先に読む`, `${iVizJ} / ${iApJ}`);

  /* 結果の入れ物は「開始タグ自体」に pv-no-cur。currency.js の自動走査に
     金額を触らせない（通貨ごとに2桁へ丸め直すのはこちらの仕事）。 */
  const m = html.match(/<div[^>]*id="ap-rows"[^>]*>/);
  ok(!!m && /\bpv-no-cur\b/.test(m[0]),
     `${name}: #ap-rows の開始タグに pv-no-cur が付いている`, m ? m[0] : '(タグが無い)');

  /* ★消したものが戻っていないこと。 */
  ok(!/id="ap-pub"/.test(html), `${name}: ★公開情報からの推定レンジの節が無い`);
  ok(!/ap-badge--pub/.test(html), `${name}: ★青（推定）のバッジが無い`);
  ok(!/ap-ref-slot/.test(html), `${name}: ★招待カードの差込口が無い`);

  /* 絞り込みは帯1つに3つ。機材だけ②の中に置く形はやめた（効く範囲が同じなので）。 */
  ok(/id="ap-filter"[^>]*\shidden/.test(html) || /\shidden[^>]*id="ap-filter"/.test(html),
     `${name}: 絞り込みの帯は既定で隠れている（行が無いときに空の選択肢を出さない）`);
  for (const id of ['ap-air', 'ap-pos', 'ap-fleet', 'ap-clear']) {
    ok(html.includes('id="' + id + '"'), `${name}: #${id} がある`);
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
  /* ★ページ送りは「何ページ目か」だけを出す。総数を出すと会員規模が漏れる。 */
  ok(/data-ap-page/.test(j), 'ページ送りがある（10件ずつ）');
  ok(!/\.length\s*\+\s*'\s*件|件目|全\s*'\s*\+|of\s*'\s*\+\s*rows\.length/.test(j),
     '★ページ送りに総件数を書いていない');
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
  ok(/\.ap-badge--actual/.test(c), '本人記録（橙）のバッジを .ap-* で持っている');
  ok(!/\.ap-badge--pub/.test(c) && !/--pv-blue/.test(c),
     '★青（推定）の見た目がこの画面に1つも残っていない');
  ok(!/transition\s*:\s*all/.test(c), 'transition-all を使っていない');
  ok(/--pv-orange-ink/.test(c), '色はトークンから取っている（ブランド色を発明していない）');
  /* display:flex は UA の [hidden]{display:none} に勝つ。帯と枠の両方に要る。 */
  ok(/\.ap-filter\[hidden\]/.test(c) && /\.ap-f\[hidden\]/.test(c),
     '★[hidden] を明示している（flex は UA の hidden に勝つ）');
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
  ok(/order by md5\(/.test(FN),
     '★並びは md5(proof_hash) 順（投稿順に並べると「誰が最近出したか」が漏れる）');
  ok(!/order by[^;]*created_at/.test(FN), '★投稿順に並べていない');
  ok(!/>=\s*5|having\s+count/.test(FN), '★人数の門が残っていない（全員出す）');
  ok(!/interval\s*'30 days'|30 day/.test(FN), '★30日の遅延が残っていない');
  ok(!/percentile_cont\(0\.[19]\)/.test(FN), '★p10-p90 のクリップが残っていない');
  ok(!/airline_other/.test(FN), '★自由入力の社名の列は読んでも返してもいない');
  ok(/group by pkey, airline, pos, fleet/.test(FN), '★1行＝1人にまとめている');
  /* 集計側（pay_benchmarks）の k≧5 は今も生きている。こちらを一緒に外さない。 */
  ok(/pg_get_viewdef\(bench\) like '%>= 5%'/.test(SQL),
     '★集計（pay_benchmarks）の k≧5 は今も見張っている');

  /* ★登録前の預かりも混ぜる（2026-08-23）。ここを外すと、まだ会員になっていない人の
     ぶんが1行も出ない＝「出したのに載っていない」に見える。 */
  ok(/pay_reports_pending/.test(FN), '★登録前の預かりも読んでいる');
  ok(/claimed_at is null/.test(FN),
     '★本棚へ移した預かりは読まない（同じ人が二重に出ない）');
  ok(/pv_pending_usd\(/.test(FN), '預かりの年換算は pv_pending_usd() が出す');
  ok(!/payload->>'airline_other'/.test(FN),
     '★預かりの payload からも自由入力の社名を読まない');

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

  /* ★comp（内訳の割合・2026-08-24）。
     返すのは m/b/d/h/o の整数パーセント5つだけ。**金額は1つも返さない。**
     ここが崩れると、1人ずつの実額が画面から逆算できるようになる。 */
  ok(/'comp'/.test(FN) || /\bcomp\b/.test(FN), '★内訳の割合（comp）を返している');
  ok(/pv_pay_comp\(/.test(FN), '★割合は pv_pay_comp() が作る（式を書き写していない）');
  ok(/pv_pct5\(/.test(FN), '★整数パーセント化は pv_pct5() が1か所でやる');
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
  /* ★契約ヘッダの②が「準識別子ゼロ」に戻っていないこと。
     戻すなら comp を返すのをやめてからにする（画面は comp が無ければ図を隠す）。 */
  {
    const head = SQL.slice(0, SQL.indexOf('create or replace'));
    ok(/割合/.test(head) && /やめるとき/.test(head),
       '★契約ヘッダが「割合だけ」と「やめるとき」を書いている');
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

// ════════════════════════════════════════════════════════════════
// 共通：偽物 Supabase
// ════════════════════════════════════════════════════════════════
/* ★本物の supabase-js の rpc が返すのは「then だけを持つ箱」。catch も finally も無い。 */
const FAKE = function (payload) {
  window.__rpc = [];
  const UID = '00000000-0000-4000-8000-00000000a001';
  const RPC = {
    pv_pay_rows: () => payload,
    /* ★左のドーナツの既定＝自分の支給構成。本人の行しか返らない関数で、
       ここだけ金額が出る（自分の数字なので隠す相手が居ない）。
       payload.mine を渡さないケースでは空＝「まだ出していない」の絵になる。 */
    my_pay_reports: () => ({ ok: true, reports: (payload && payload.mine) || [] }),
    my_referral_code: () => ({ ok: true, code: 'K7QD3XZM', invited: 0, converted: 0 }),
    pv_referral_settle: () => ({ ok: true })
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
     その人の勤務先が本人の書いた文字列そのままで他人に見えている。 */
const POISON = {
  base_iata: 'ZQX', seniority_years: 137, age_bucket: '40s',
  period_year: 2026, period_month: 8, created_at: '2026-08-05T00:00:00Z',
  proof_hash: 'deadbeefcafe0001', contract_type: 'direct', tax_country: 'JP',
  nationality: 'JP', annual_total_orig: 19440000, currency: 'JPY', verify_level: 2,
  airline_other: 'Somewhere Air'
};
/* ★字面がぶつからないものを選ぶ。'17' や '2026' のような短い数字は
   年号にたまたま出るので、毒として使えない。 */
const POISON_VALUES = ['ZQX', '137', '40s', 'deadbeefcafe0001',
                       '19,440,000', '19440000', '2026-08-05', 'Somewhere Air'];

const row = (airline, pos, fleet, usd, vf, extra) => Object.assign(
  { airline: airline, pos: pos, fleet: fleet, annual_usd: usd, verified: vf }, extra || {});

/* 内訳の割合。★整数で合計はちょうど 100。**金額は1つも入らない**（それがこの形の要点）。
     m=月々の支給 b=年1回の賞与 d=パーディアム h=住宅手当 o=その他の手当 */
const C = (m, b, dd, h, o) => ({ m: m, b: b, d: dd, h: h, o: o });

/* 本番に近い形（2026-08-23 時点は8人・全員が手入力＝verified はほぼ付かない）。
   ★1人目にだけ毒を混ぜる。★自由入力の社名の人は airline:'other' で来る。
   ★comp は本番の実測に寄せる。賞与20%の ANA、賞与ゼロで月給99%の JAL、
     そして **comp が null の行を2つ**（内訳が出せない人がいても壊れないこと）。 */
const ROWS = [
  row('ana', 'cap', 'b787', 180000, true, Object.assign({ comp: C(75, 20, 4, 1, 0) }, POISON)),
  row('ana', 'fo', 'b787', 120000, false, { comp: C(96, 0, 3, 1, 0) }),
  row('ana', 'cap', 'b777', 190000, false, { comp: null }),
  row('jal', 'cap', 'a350', 170000, false, { comp: C(70, 22, 5, 2, 1) }),
  row('jal', 'fo', 'b737', 110000, false, { comp: C(99, 0, 1, 0, 0) }),
  row('emirates', 'cap', 'a380', 250000, false, { comp: C(62, 0, 12, 24, 2) }),
  row('other', 'cap', 'b737', 130000, false,
      { airline_other: 'Somewhere Air', comp: C(88, 8, 4, 0, 0) }),
  row('other', 'fo', 'a320', 90000, false, { comp: null })
];

/* 自分の支給構成（my_pay_reports()）。★ここだけ金額が出る。
   本番と同じで、内訳まで入れている人の形（総支給1本の人は灰色が多くなる）。 */
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
  MANY_ROWS.push(row(a, i % 2 ? 'fo' : 'cap', i % 3 ? 'b787' : 'a320',
                     90000 + i * 5000, false,
                     { comp: i % 5 === 4 ? null : C(70 + i % 20, 20 - i % 20, 6, 3, 1) }));
}

const LOCKED = { ok: true, state: 'locked', rows: [] };
const EMPTY = { ok: true, state: 'open', rows: [] };
const OPEN = { ok: true, state: 'open', rows: ROWS, mine: MINE };

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
    /* ページ送り。★数は出さない。出るのは「何ページ目か」だけ。 */
    pgBtns: q('.ap-pg', rows).map((e) => ({ t: e.textContent.trim(), off: e.disabled })),
    pgLabel: q('.ap-pg-n', rows).map((e) => e.textContent.trim()).join(' '),
    vf: q('.ap-vf', rows).length,
    lock: q('.ap-msg--lock', rows).length,
    msg: q('.ap-msg', rows).length,
    cta: q('.ap-cta', rows).map((e) => e.getAttribute('href')),
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
    /* 絞り込み */
    barHidden: bar ? bar.hidden : null,
    fleetHidden: (function () {
      const w = document.getElementById('ap-fleet-wrap');
      return w ? w.hidden : null;
    })(),
    airOpts: opts('ap-air'), posOpts: opts('ap-pos'), fleetOpts: opts('ap-fleet'),
    /* ── 図（2026-08-24）──────────────────────────────
       ★他人の内訳は「割合だけ」。.amt（金額）が1つでも出たら赤。 */
    vizCards: q('.ap-vcard').length,
    vizText: txt(document.querySelector('.ap-viz')),
    vizTitle: txt(document.querySelector('.ap-vcard .pt-h')).trim(),
    vizLegend: q('.ap-vcard .pt-leg').map((e) => e.innerText.replace(/\s+/g, ' ').trim()).join(' / '),
    vizAmts: q('.ap-vcard .pt-leg .amt').map((e) => e.textContent.trim()),
    vizPcts: q('.ap-vcard .pt-leg .pct').map((e) => e.textContent.trim()),
    vizCenter: txt(document.querySelector('.ap-vcard .pt-donut-c b')).trim(),
    vizEmpty: q('.ap-vcard .pt-empty').length,
    vizBack: q('[data-ap-unsel]').length,
    /* ★分布の棒。人数の数字は書かない（高さで目分量に読めるところまで）。 */
    bars: q('.ap-bar').length,
    plotText: txt(document.querySelector('.ap-plot')),
    you: q('.ap-you').length,
    axText: q('.ap-ax').map((e) => e.innerText).join(' '),
    /* 選んだ行。★aria-selected は grid の中でしか使えないので aria-current。 */
    sel: q('#ap-rows tbody tr[aria-current="true"]').length,
    selIdx: q('#ap-rows tbody tr[aria-current="true"]')
      .map((e) => e.getAttribute('data-ap-row')).join(','),
    rowIdx: q('#ap-rows tbody tr').map((e) => e.getAttribute('data-ap-row')).join(','),
    calls: (window.__rpc || []).map((r) => r.name),
    withArgs: (window.__rpc || []).filter((r) => r.hasArgs).map((r) => r.name),
    tblTexts: q('table', rows).map((t) => t.innerText)
  };
};

/* ★消したものが戻っていないか（全ケースで同じことを見る）。 */
function gone(v, tag) {
  ok(v.pub === 0 && v.bluePresent === 0 && v.ranges === 0 && v.plist === 0,
     `${tag}: ★推定レンジの節が実行時にも無い`,
     `${v.pub}/${v.bluePresent}/${v.ranges}/${v.plist}`);
  ok(v.panels === 0, `${tag}: ★右の「選んだ区分」パネルが無い`, String(v.panels));
  ok(v.pvr === 0 && v.refSlot === 0, `${tag}: ★招待カードがこの画面に出ない`,
     `${v.pvr}/${v.refSlot}`);
  /* ★表の節は1つ。h1 とほぼ同じ h2 を並べない。
     札（本人記録）はその1つの見出しの行に付く。
     ★2026-08-24：h2 は「図のカード」のぶんだけ増える（支給の内訳／年収の分布）。
       だから 0 固定ではなく **図の枚数と一致すること** を見る。
       表の節に h2 が生えると、この式がずれて赤くなる。 */
  ok(v.h2 === v.vizCards && v.orange === 1,
     `${tag}: ★見出しは1つ・h2 は図の枚数と同じ・「本人記録」の札も1つ`,
     `h2=${v.h2} / viz=${v.vizCards} / badge=${v.orange} / ${v.h1}`);
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

  ok(v.lock === 1, '「明細を1枚出すと開きます」の1枚だけ', String(v.lock));
  ok(v.trs === 0 && v.amounts.length === 0, '★行も金額も1つも描かない',
     `${v.trs} 行 / ${v.amounts.length} 金額`);
  ok(!MONEY.test(v.rowsText), '★結果の中に金額の形をした文字が1つも無い',
     JSON.stringify(v.rowsText).slice(0, 160));
  ok(v.cta.some((h) => /pay-report\.html#ps/.test(h)),
     'Give & Get の導線（匿名で給与を追加）が出る', v.cta.join(','));
  ok(v.barHidden === true, '★絞り込みの帯ごと隠れる（空の選択肢を3つ並べない）',
     String(v.barHidden));
  gone(v, lang);
  promises(v, lang, lang);
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
  const othLabel = lang === 'en' ? 'Other airline' : 'その他の航空会社';
  ok(v.rowsText.includes(othLabel), `★自由入力の社名は「${othLabel}」という固定の札になる`,
     JSON.stringify(v.rowsText).slice(0, 160));

  /* 検証済みは1人だけ。★verified の無い人に ✓ を付けない。 */
  ok(v.vf === 1, '★✓ Verified は verified:true の1人だけ', String(v.vf));

  /* ★⑤数え上げ。表そのものに数え方の言葉を1つも置かない。
     ★ただし出典の札（本人記録 / Pilot-recorded）だけは別。あれは数え方ではなく
       「その額がどこから来たか」で、たまたま「人」「Pilot」の字を含むだけ。
       札の文字列そのものを外してから、残りを元どおり厳しく見る。
       外すのは札だけ＝他の場所に「3件」「5人」が出れば今までどおり落ちる。 */
  const VF_LABELS = ['本人記録', 'Pilot-recorded'];
  const tblAll = VF_LABELS.reduce((t, w) => t.split(w).join(' '), v.tblTexts.join('\n'));
  ok(!/(件|人|reports?|pilots?)/i.test(tblAll),
     '★表の中に「件」「人」が1つも無い', JSON.stringify(tblAll).slice(0, 160));
  const counts = (v.rowsText.match(/(\d+)\s*(件|人|reports?|pilots?)/gi) || []);
  ok(counts.length === 0, '★合計件数・カバー社数を出さない', counts.join(','));
  ok(!/パーセンタイル|上位\s*\d|percentile|top\s*\d+\s*%/i.test(v.bodyText),
     '★「上位◯パーセンタイル」を出さない（本人を採点しない）');

  gone(v, lang);
  promises(v, lang, lang);

  /* ★絞り込みは「実際に行がある区分」だけ。112社を並べない。 */
  ok(v.barHidden === false, '行があるときは絞り込みの帯が出る', String(v.barHidden));
  ok(v.airOpts.length === 5, '航空会社は「すべて」＋実在する4つだけ', v.airOpts.join(','));
  ok(v.airOpts.some((s) => s === othLabel), '「その他の航空会社」も選べる', v.airOpts.join(','));
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
    set('ap-air', 'ana');
    const afterAir = { trs: q('#ap-rows tbody tr').length,
                       pos: document.getElementById('ap-pos').options.length,
                       fleetHidden: document.getElementById('ap-fleet-wrap').hidden };
    set('ap-pos', 'cap');
    const afterPos = { trs: q('#ap-rows tbody tr').length,
                       fleet: document.getElementById('ap-fleet').options.length,
                       fleetHidden: document.getElementById('ap-fleet-wrap').hidden };
    document.getElementById('ap-clear').click();
    const afterClear = { trs: q('#ap-rows tbody tr').length,
                         air: document.getElementById('ap-air').value };
    return { afterAir, afterPos, afterClear };
  });
  ok(step.afterAir.trs === 3, '会社で絞ると3行', JSON.stringify(step.afterAir));
  ok(step.afterAir.pos === 3, '職位の選択肢はその会社にある2つ＋すべて',
     JSON.stringify(step.afterAir));
  ok(step.afterPos.trs === 2, '会社＋職位で絞ると2行', JSON.stringify(step.afterPos));
  ok(step.afterPos.fleet === 3 && step.afterPos.fleetHidden === false,
     '機材は2機種あるので選ばせる', JSON.stringify(step.afterPos));
  ok(step.afterClear.trs === ROWS.length && step.afterClear.air === '',
     '★解除で全員に戻る', JSON.stringify(step.afterClear));

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
      if (!n()) dead.push('air=' + a);
      for (const p of vals('ap-pos')) {
        set('ap-air', a); set('ap-pos', p);
        if (!n()) dead.push('air=' + a + ',pos=' + p);
        for (const f of vals('ap-fleet')) {
          set('ap-air', a); set('ap-pos', p); set('ap-fleet', f);
          combos++;
          if (!n()) dead.push('air=' + a + ',pos=' + p + ',fleet=' + f);
        }
      }
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
/* 10件で1ページ。★出すのは「何ページ目か」だけで、総件数・総人数は出さない
   （出すと会員規模そのものが漏れる。D と同じ理由でここも総当たりする）。
   見るのは4つ:
     ・どのページにも1行以上ある（空のページへ行けない）
     ・端では「前へ」「次へ」が押せなくなる（押しても何も起きない、ではなく無効）
     ・行ったページから必ず戻れる
     ・絞り込みを変えたら1ページ目に戻る（3ページ目のまま絞ると空に見える） */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / E ページ送り ════`);
  const { page, errs } = await open(lang, { ok: true, state: 'open', rows: MANY_ROWS });
  const v0 = await page.evaluate(SNAP);

  ok(v0.trs === 10, '1ページ目は10行', String(v0.trs));
  ok(v0.pgBtns.length === 2, '「前へ」「次へ」が2つ', JSON.stringify(v0.pgBtns));
  ok(v0.pgBtns[0].off === true, '★1ページ目で「前へ」は押せない', JSON.stringify(v0.pgBtns));
  ok(v0.pgBtns[1].off === false, '1ページ目で「次へ」は押せる', JSON.stringify(v0.pgBtns));
  ok(!/(\d+)\s*(件|人|reports?|pilots?)/i.test(v0.rowsText),
     '★ページ送りに件数を出さない', JSON.stringify(v0.pgLabel));

  /* 端まで進んで、端まで戻る。★行が0のページに立てたらそこで落ちる。 */
  const walk = await page.evaluate(() => {
    const rows = document.getElementById('ap-rows');
    const n = () => rows.querySelectorAll('tbody tr').length;
    const btn = (i) => rows.querySelectorAll('.ap-pg')[i];
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
    const endBtns = Array.prototype.slice.call(rows.querySelectorAll('.ap-pg'))
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
    const next = () => { const b = rows.querySelectorAll('.ap-pg')[1]; if (b && !b.disabled) b.click(); };
    next(); next();                         // 3ページ目へ
    const at3 = n();
    const s = document.getElementById('ap-air');
    s.value = 'jal';
    s.dispatchEvent(new Event('change', { bubbles: true }));
    const after = n();
    const lbl = rows.querySelector('.ap-pg-n');
    return { at3: at3, after: after, lbl: lbl ? lbl.textContent.trim() : '(1ページだけ)' };
  });
  ok(jump.at3 === 3, '3ページ目まで行けた', String(jump.at3));
  ok(jump.after > 0, '★絞り込んだ瞬間に1ページ目へ戻る（空に落ちない）',
     JSON.stringify(jump));

  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// F. 図（内訳のドーナツ・年収の分布）
// ════════════════════════════════════════════════════════════════
/* ★2026-08-24 追加。オーナー判断「一旦やってみよう。イマイチならやめよう」。
   増える露出は **1人ぶんの内訳の割合** だけ。金額はサーバが返さない。
   ここで守るのは3つ：
     ・他人の側に通貨記号が1文字も出ない（割合だけ）
     ・自分の側にだけ金額が出る（my_pay_reports＝自分の数字なので隠す相手が居ない）
     ・閉じ方が3つあり、どれで閉じても「自分の支給構成」に戻る（閉じ込めを作らない） */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / F 図 ════`);
  const { page, errs } = await open(lang, OPEN);
  const v = await page.evaluate(SNAP);

  ok(v.vizCards === 2, '図は2枚（支給の内訳・年収の分布）', String(v.vizCards));

  /* ① 既定は自分の支給構成。★ここだけ金額が出る。 */
  ok(v.calls.includes('my_pay_reports'),
     '★自分の内訳は my_pay_reports() から取る（他人の表から自分を探さない）',
     v.calls.join(','));
  ok(v.vizAmts.length > 0, '既定＝自分の支給構成（金額が出る）', v.vizLegend.slice(0, 120));
  ok(v.sel === 0 && v.vizBack === 0,
     '何も選んでいないときは「自分に戻す」を出さない', `${v.sel}/${v.vizBack}`);

  /* ② 分布の棒。★人数の数字を書かない。 */
  ok(v.bars >= 3, '分布の棒が出ている', String(v.bars));
  ok(!/\d/.test(v.plotText),
     '★棒のところに数字が1文字も無い（人数を書かない）', JSON.stringify(v.plotText).slice(0, 120));
  ok(!/(\d+)\s*(件|人|reports?|pilots?)/i.test(v.vizText),
     '★図の帯の中に件数・人数を書かない', v.vizText.replace(/\n/g, ' ').slice(0, 160));
  ok(v.axText.length > 0 && MONEY.test(v.axText),
     '軸の両端は表示中の通貨で出す', v.axText);
  ok(v.you === 1, '★「あなたの位置」は1本だけ', String(v.you));

  /* ③ 行を押すと、その人の割合に切り替わる。 */
  const clickRow = async (i) => {
    await page.evaluate((n) => {
      const tr = document.querySelector('[data-ap-row="' + n + '"]');
      if (tr) tr.click();
    }, i);
    await sleep(320);
    return page.evaluate(SNAP);
  };

  const a = await clickRow(0);
  ok(a.sel === 1 && a.selIdx === '0', '★押した行だけが選ばれる', `${a.sel}/${a.selIdx}`);
  ok(a.rowIdx === v.rowIdx, '★行を選んでも並びが1行も動かない（選択が並べ替えに化けない）',
     `${v.rowIdx} → ${a.rowIdx}`);
  ok(a.amounts.join('|') === v.amounts.join('|'), '★金額も1つも動かない');
  ok(a.vizAmts.length === 0,
     '★他人のドーナツに金額が1つも出ない（サーバが返していない）', a.vizAmts.join(','));
  ok(!MONEY.test(a.vizLegend),
     '★凡例に通貨記号も桁区切りの数字も出ない（割合だけ）', a.vizLegend.slice(0, 160));
  ok(a.vizPcts.length === 4 && a.vizPcts.every((t) => /^\d{1,3}%$/.test(t)),
     '★凡例は「◯%」だけ（75/20/4/1 の4つ）', a.vizPcts.join(','));
  ok(a.vizCenter === a.amounts[0],
     '★中央は画面に出ている年収そのもの（別の丸め方をしない）',
     `${a.vizCenter} / ${a.amounts[0]}`);
  ok(a.vizBack === 1, '「自分に戻す」が出る', String(a.vizBack));
  {
    const hit = POISON_VALUES.filter((p) => a.mainText.includes(p));
    ok(hit.length === 0, '★行を選んでも毒（準識別子）が1つも出ない', hit.join(','));
  }

  /* ④ comp が無い行を押しても壊れない。★静かに「出せません」になる。 */
  const b2 = await clickRow(2);
  ok(b2.sel === 1 && b2.vizEmpty === 1 && b2.vizPcts.length === 0,
     '★内訳が無い行は静かに「出せません」（図が壊れない）',
     `${b2.sel}/${b2.vizEmpty}/${b2.vizPcts.length}`);
  ok(b2.vizBack === 1, 'そこからも「自分に戻す」で戻れる', String(b2.vizBack));

  /* ⑤ 閉じ方が3つ。どれでも「自分の支給構成」に戻る。 */
  const same = await clickRow(2);
  ok(same.sel === 0 && same.vizAmts.length > 0,
     '★もう一度押すと自分に戻る', `${same.sel}/${same.vizAmts.length}`);

  await clickRow(3);
  await page.keyboard.press('Escape');
  await sleep(320);
  const esc = await page.evaluate(SNAP);
  ok(esc.sel === 0 && esc.vizAmts.length > 0,
     '★ESC でも自分に戻る', `${esc.sel}/${esc.vizAmts.length}`);

  await clickRow(3);
  await page.evaluate(() => document.querySelector('[data-ap-unsel]').click());
  await sleep(320);
  const back = await page.evaluate(SNAP);
  ok(back.sel === 0 && back.vizAmts.length > 0,
     '★「自分に戻す」でも戻る', `${back.sel}/${back.vizAmts.length}`);

  /* ⑥ キーボードだけでも選べる（行はボタンではないので自前で拾っている）。 */
  const kb = await page.evaluate(() => {
    const tr = document.querySelector('[data-ap-row="1"]');
    return { tab: tr ? tr.getAttribute('tabindex') : null };
  });
  ok(kb.tab === '0', '行に tabindex が付いている', String(kb.tab));
  await page.evaluate(() => document.querySelector('[data-ap-row="1"]').focus());
  await page.keyboard.press('Enter');
  await sleep(320);
  const ke = await page.evaluate(SNAP);
  ok(ke.sel === 1 && ke.selIdx === '1', '★Enter でも選べる', `${ke.sel}/${ke.selIdx}`);

  /* ⑦ 通貨を切り替えても引き直さない（図も手元の値で描き直すだけ）。 */
  const n0 = ke.calls.length;
  await page.evaluate(() => window.PVCurrency.set('USD'));
  await sleep(700);
  const cu = await page.evaluate(SNAP);
  ok(cu.calls.length === n0, '★通貨を切り替えても RPC が1本も増えない',
     `${n0} → ${cu.calls.length}`);
  ok(cu.vizCenter === cu.amounts[1] && /\$/.test(cu.vizCenter),
     '★図の中央もドル表記に描き直る（表の金額と同じ文字）',
     `${cu.vizCenter} / ${cu.amounts[1]}`);
  ok(/\$/.test(cu.axText), '軸もドル表記に描き直る', cu.axText);
  ok(cu.vizAmts.length === 0, '★切り替えても他人の側に金額は出ない', cu.vizAmts.join(','));

  /* ⑧ 絞り込みを触ったら選択は外れる（消えた行が選ばれたままにならない）。 */
  const fl = await page.evaluate(() => {
    const s2 = document.getElementById('ap-air');
    s2.value = 'jal';
    s2.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  });
  await sleep(320);
  const af = await page.evaluate(SNAP);
  ok(fl && af.sel === 0 && af.vizAmts.length > 0,
     '★絞り込みを触ると選択が外れて自分に戻る', `${af.sel}/${af.vizAmts.length}`);

  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// G. まだ給与を出していない人（自分の内訳が無い）
// ════════════════════════════════════════════════════════════════
/* ★鍵はあるが my_pay_reports が空、という形はありうる（預かりから来た人など）。
   ここで図が壊れると、いちばん最初に来る人の画面だけ真っ白になる。 */
{
  const { page, errs } = await open('ja', { ok: true, state: 'open', rows: ROWS, mine: [] });
  const v = await page.evaluate(SNAP);
  ok(v.vizCards === 2, '自分の内訳が無くても図は2枚', String(v.vizCards));
  ok(v.vizEmpty === 1 && v.vizAmts.length === 0,
     '★静かに「まだ出せません」になる（金額を捏造しない）',
     `${v.vizEmpty}/${v.vizAmts.length}`);
  ok(v.you === 0, '★自分の年収が無いので「あなたの位置」も出さない', String(v.you));
  ok(v.bars >= 3, '分布の棒はそれでも出る', String(v.bars));
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

for (const jar of jars) { try { await jar.close(); } catch (e) {} }
await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
