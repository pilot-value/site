/* ════════════════════════════════════════════════════════════════
   my-value.js — マイレポート（明細を出した人に返すもの）

   ★2026-09-06、MY PAGE（profile.html / en/profile.html）の
     ③ YOUR PAY ＝ <div id="pv-value"> に載る。my-value.html は転送1枚になった
     （送信済みメールが指しているので URL は消せない）。
   ページ側の inline script より **後**、pay-viz.js より **後** に読むこと。
   日英で1本。<html lang> を見て T を切り替える＝文言が2ファイルに散らない。

   ── なぜ作るか ──────────────────────────────────────────────
   VERIFIED-PILOT の Give to Get は「明細を出す＝自分専用のレポートが返る」
   という約束。明細アップロードは"サイトへの協力"ではなく、
   **自分の報酬履歴を育てるための材料**という位置付けにしてある。
   だから画面の主語は「順位」ではなく「あなたが記録したもの」。

   ── 画面の並び（上ほど強い）────────────────────────────────
     見出し → 今月の実績 → 累計報酬 → 機会 → 前回との差
            → 支給構成 → 推移と節目 → 次の1枚
   全部を同じ強さで並べない。毎月戻ってくる理由は「累計が伸びる」ことなので、
   累計だけカードを一段持ち上げてある（見た目は my-value.css の .is-hero）。

   ── 数字の出どころは my_pay_reports() と pay_benchmarks だけ ──────
   ★ submit_pay_report の戻り値には依存しない。依存させると
     「出した直後」と「翌月また見に来たとき」で違うページになる。
     ?new=1 は **文言だけ** 変える。数字は1つも変えない。

   ── 出さないと決めたもの（VISION / VERIFIED-PILOT より）──────────
   ・順位（「上位◯%」）：本人を採点しない。出すのは中央値との「差」だけ。
     percentile は計算にも持たない（持つと必ず画面に出たがる）。
   ・「転職すべき」「採用される確率」「市場価値◯点」：測っていないものを言わない。
     このファイルは AI を呼ばない＝そもそも作れない形にしてある。
   ・税・控除の**内訳**：pay_reports が持っていない。持たせてもいけない
     （組合費が見えると所属組合が割れる。VERIFIED-PILOT Part 6）。
   ・機種ごとの公開平均との差：公開年収の SSOT に機種の粒度が無い。
     ここで比べているのは pay_benchmarks（本人たちが記録した実績）だけ。
   ・「生涯年収」「これまでの総収入」：累計が足しているのは **出した明細ぶんだけ**。
     出していない月は1円も入っていないので、そう名乗った瞬間に嘘になる。

   ── 数字が無いときは枠を残す ────────────────────────────────
   黙って消すと「自分には関係ない項目」に見える。実際は
   「明細から読めなかった」か「まだ集まっていない」のどちらかで、
   どちらなのかは本人にしか直せない。だから枠と理由を出す。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  /* host ＝ #pv-value。root ＝ いま「給与サマリー」を描く箱（タブの骨組みを置いたあとは、その1枚目の面）。
     ★下の描画はみな root に書く＝タブを足しても、給与サマリーの中身は1文字も変わらない。 */
  var host = d.getElementById('pv-value');
  if (!host) return;
  var root = host;

  var SB = null;
  try { SB = sb; } catch (e) { SB = null; }
  if (!SB) return;

  var V = w.PVViz;
  if (!V) return;                       // 読み込み順が崩れたら黙って出さない
  var esc = V.esc, num = V.num, fmt = V.fmt;

  var L = (window.PV_BASE === 'en' || d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';   // スペイン語のページは英語と同じ動き（pv-session.js）
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* 掲載額（salary-data.json）の在り処。★ ページ相対で書くと /en/ から
     /en/salary-data.json を見に行って 404 になる（英語版は1枚も無い）。
     このスクリプト自身の URL を基準に解くとルート直下を指す
     ＝ salary-leveling.js と同じやり方。currentScript は同期実行中しか
     取れないので、ここ（IIFE の冒頭）で確定させる。 */
  var PUB_URL = 'salary-data.json';
  var POP_URL = 'vote-popular.json';     // よく見られている会社の順（GA4・gen-vote-popular.mjs が書く）
  /* ★後から読む2本にも中身の指紋を付ける（.js は配信で4時間覚えられる＝付けないと出した直後に古い部品が残る）。
       my-year.js か my-value-sample.js を直したら、db/test-year-report.mjs が示す値に書き換える（中身と一致するかを見ている）。
       そのあと profile.html（日英）の my-value.js の指紋も変わる（assert-links.mjs が示す値に写す・西は gen-lang.mjs）。 */
  var YEAR_V = 'adbe97b5';
  var SAMPLE_V = '56f31187';
  var SAMPLE_URL = 'my-value-sample.js?v=' + SAMPLE_V;     // 運営の見本（運営のときだけ読む）
  var YEAR_URL = 'my-year.js?v=' + YEAR_V;                 // 「1年」の画面（押したときだけ読む）
  /* ★「勤務ロスター」のタブ（2026-11-09）。開いたときだけ読む4本。指紋は上の2本と同じ決まり
       （db/test-year-report.mjs が中身と突き合わせる）。計算の部品は分析のタブも使う。 */
  var ROSTER_V = '639f029f';
  var ROSTER_CSS_V = 'aa718a29';
  var UPLOAD_V = '8b9b153f';
  var ENGINE_V = '2d3cdeae';
  var AIRPORT_TZ_V = 'ec27da34';   // ★2026-11-11 空港 → タイムゾーンの表（pv-airport-tz.js・現地時刻の便の時間）
  /* ★「分析」のタブ（2026-11-09）。開いたときだけ読む2本（見た目 → 計算の部品 → 画面の順）。指紋の決まりは上と同じ */
  var ANALYSIS_V = 'ae699612';
  var ANALYSIS_CSS_V = 'aeff3463';
  /* ★スケジュールの一番上の「飛んだルート」の地球儀（2026-11-12）。スケジュールのタブを開いたときだけ読む4本。指紋の決まりは上と同じ */
  var GLOBE_V = '6594e499';
  var GLOBE_CSS_V = 'aeb30f8d';
  var AIRPORT_GEO_V = '12fab2ff';   // 空港 → 位置と街の名前（pv-airport-geo.js）
  var GLOBE_LAND_V = '1b63fac1';    // 陸地の点（pv-globe-land.js）
  var LATE = {
    roster: 'my-roster.js?v=' + ROSTER_V, rosterCss: 'my-roster.css?v=' + ROSTER_CSS_V,
    upload: 'roster-upload.js?v=' + UPLOAD_V, engine: 'pv-report-engine.js?v=' + ENGINE_V, airportTz: 'pv-airport-tz.js?v=' + AIRPORT_TZ_V,
    analysis: 'my-analysis.js?v=' + ANALYSIS_V, analysisCss: 'my-analysis.css?v=' + ANALYSIS_CSS_V,
    globe: 'my-globe.js?v=' + GLOBE_V, globeCss: 'my-globe.css?v=' + GLOBE_CSS_V,
    airportGeo: 'pv-airport-geo.js?v=' + AIRPORT_GEO_V, globeLand: 'pv-globe-land.js?v=' + GLOBE_LAND_V,
    airlines: 'pv-airlines.json'
  };
  try {
    var _self = (d.currentScript && d.currentScript.src) || '';
    if (_self) {
      PUB_URL = new URL('salary-data.json', _self).href;
      POP_URL = new URL('vote-popular.json', _self).href;
      SAMPLE_URL = new URL('my-value-sample.js?v=' + SAMPLE_V, _self).href;
      YEAR_URL = new URL('my-year.js?v=' + YEAR_V, _self).href;
      Object.keys(LATE).forEach(function (k) { LATE[k] = new URL(LATE[k], _self).href; });
    }
  } catch (e) {}

  var T = {
    ja: {
      /* 見出し。★「市場価値」とは言わない（順位ではなく本人の記録が主語）。
         名前が取れたら「◯◯さんの報酬レポート」。取れなければ「あなたの」に落とす
         （プロフィール未入力の人に空欄の「さん」を出さない）。 */
      titleOf: function (nm) { return (nm ? nm + 'さん' : 'あなた') + 'の報酬レポート'; },
      unlockOn: function (n) { return '解放中 ' + n + '日'; },
      unlockOff: '未解放',
      kAirline: '会社', kFleet: '機種', kPos: '職位', kBase: 'ベース',
      /* ★「使った明細」にすると、下の数字が全部の平均に見える。実際は最新1枚から
         作っていて、枚数が効くのは累計と推移だけ。数えたものの名前で言う。 */
      kMonth: '対象月', kUpdated: '作成日', kSheets: '記録した明細',
      sheets: function (n) { return n + '枚'; },

      /* 今月の実績 */
      monthOf: function (t) { return '{t}の給与'.replace('{t}', function () { return t; }); },
      noNet: 'この月は手取りを書いていません。書くと控除の合計も出ます。', noNetA: '手取りを書く',
      kGross: '総支給', kNet: '差引支給額',
      perBlock: '乗務1時間あたり', perDuty: '勤務1時間あたり',
      /* 数量の1行（「乗務 57.1h · 総勤務 139.6h · ステイ 7泊」）の短い名前 */
      mBlockH: '乗務', mDutyH: '総勤務', mDays: '稼働',
      mStay: 'ステイ',
      /* 細かい数字を畳む札（最初は閉じている）。2026-11-10 オーナー「何の数字か・どれが大切か分かりにくい」 */
      more: 'ほかの数字',
      hDays: function (n) { return n + '日'; },
      hStay: function (n) { return n + '泊'; },
      kDeduct: '控除合計', kYtd: '年初来の課税支給額',
      /* ★総支給の外で受け取った分（支給元＝組合）。会社の明細に印字されないので
         上の「総支給」には入っていない。出さないと年換算だけが大きくなり、
         画面の中で掛け算が合わなくなる（2026-09-02）。 */
      kUnionOut: '組合から別に受け取った分', kGrossAll: '合わせて受け取った額',
      /* ★明細とは別に受け取ったパーディアム（2026-11-04）。組合の分と同じ理由で出す。 */
      kPerdiemOut: '明細とは別に受け取ったパーディアム',
      kAnnual: '今月ベースの単純年換算',
      /* ★年間の賞与・利益配分を入れた人の年換算は、それも足してある（サーバの pv_annual_total）。
         札を「単純年換算」のままにすると、12倍が合わない数字に嘘の名前が付く（2026-11-08）。
         ★説明の2行（参考値・※）は 2026-11-08 オーナー「不要な文言はカット」で外した。 */
      kAnnualB: '今月ベースの年換算（賞与込み）',
      /* 運営の見本（運営にしか出ない）。数字が作り物だと見出しで言う。 */
      opH: '見本（運営だけ・数字は作り物）',
      opS: { many: '12か月', one: '1か月', hand: '手入力だけ' },
      opEmpty: '給与なしの画面',
      opMine: '自分の数字',          // 運営が自分の明細も出しているとき、最後のボタンはこれ（2026-11-09）
      /* 「今月｜1年」の切り替え（2026-11-08 オーナー決定の置き場所） */
      vMonth: '今月', vYear: '1年',
      /* YOUR PAY の3つのタブ（2026-11-09）。期間の切り替え（今月｜1年）とは別物＝形も違える。短い字は狭い画面用。 */
      tabsAria: 'YOUR PAY の表示',
      tabSum: '給与サマリー', tabRoster: 'スケジュール', tabAna: '分析', tabSet: '設定',
      tabSumS: '給与', tabRosterS: '勤務', tabAnaS: '分析', tabSetS: '設定',
      /* MY PAGE｜MY PAY のタブ（2026-11-09 オーナー「mypage と my pay でタブ分けない？」）。字はオーナーの呼び方のまま */
      pgAria: 'マイページの表示', pgPage: 'MY PAGE', pgPay: 'MY PAY',
      anaErr: '分析の画面を読み込めませんでした。時間をおいて開き直してください。',
      /* 印刷（表示中のタブだけ）。紙の1行目は「YOUR PAY · タブ · 期間」 */
      prPrint: '印刷', prPrintA: '表示中のタブを印刷', prMonth: '明細 {t}',
      rosterErr: 'スケジュールの画面を読み込めませんでした。時間をおいて開き直してください。',
      /* 給与が変わった理由（2026-11-09・承認済みの見本）。数量の名前は表の行の見出し */
      why: '給与が変わった理由', whyTot: '支給合計の増減', whyDed: '控除合計の増減', whyNet: '手取りの増減',
      whyRest: 'ほかの{n}項目', whyChart: '項目ごとの増減',
      whyBd: '支給項目の内訳', whyBdS: '{a}・{b}の実額', whyItem: '項目', whyDiff: '差', whyOut: '総支給の外', whyGross: '総支給',
      whyQty: '数量（明細に書かれたもの）',
      kProfit: 'プロフィットシェア', kNotional: '現物給与の評価', kAbsence: '不就労減額',
      qnBlock: '乗務時間', qnDuty: '勤務時間', qnNight: '深夜時間', qnCredit: 'クレジット時間', qnGuarantee: '保証時間',
      qnSectors: '便数', qnDutyDays: '勤務日数', qnStay: '宿泊数', qnDaysOff: '休日数',
      mGuar: function (g) { return '保証 ' + g + 'h との差'; },
      momOf: function (ym) { return ym + 'との差'; },

      /* 累計 ── 「生涯年収」「総収入」とは書かない */
      total: '累計報酬',
      tNet: '手取りの合計', tDeduct: '控除の合計',
      tAvg: '月平均の総支給', tHourly: '乗務1時間あたり（通算）',
      /* 上の合計の**内数**。組合が総支給の外で払った分は会社の明細に印字されない＝
         「額面 − 手取り ＝ 控除」の外側にある。出さないと、控除と手取りを足しても
         上の合計に届かない理由が画面のどこにも書いていないことになる（2026-09-02）。 */
      tUnionOut: 'うち組合から別に受け取った分',
      tPerdiemOut: 'うち明細とは別に受け取ったパーディアム',
      tBlockH: '累計の乗務時間', tDutyH: '累計の総勤務時間',
      tSpanOf: function (a, b) { return a === b ? a : a + '〜' + b; },
      /* 累計の図に指を置いたときの吹き出し（2026-11-10）。1行目は月 */
      tipCum: function (a, b) { return '累計 ' + a + '（この月 ' + b + '）'; },
      tOnly: function (m, n) {
        return '※ 総支給が分かる月だけを足しています（' + n + '件中 ' + m + '件）。';
      },
      tNetOnly: function (m) { return '※ 手取りと控除は、手取りを書いた ' + m + 'ヶ月ぶんの合計です。'; },
      tNone: '記録した月がまだありません。給与を追加すると、ここに積み上がっていきます。',
      months: function (n) { return n + 'ヶ月'; },

      /* 機会。★ ここに出すのは「いまより上がる選択肢」だけ。
         下回る会社は畳んだ先にも出さない（オーナー判断・2026-08-12）。 */
      oppQ: function (p) { return '他社の{p}の年収'.replace('{p}', function () { return p; }); },
      oppSub: '地域ごとに選んだ会社 · 年収の高い順',
      rg: { asia: 'アジア', na: '北米', europe: 'ヨーロッパ', mideast: '中東', oceania: 'オセアニア', latam: '中南米', africa: 'アフリカ' },
      oppMe: 'あなた',
      tagEst: '推定', tagMed: '中央値',
      oppCurAnnual: '今月ベースの単純年換算',
      oppCurAnnualB: '今月ベースの年換算（賞与込み）',
      oppNone: '比べられる会社がまだありません。',
      oppNoPace: 'あなたの年収（月額×12＋賞与）がまだ出ていないので、比較できません。明細をもう一度出すか、フォームで年収の欄まで入れてください。',
      /* 自分の会社・職位の会員の中央値（会社ページと同じ数字。2人以上・1人1件）。 */
      /* スカウトは作らない。将来やる予定があることだけ示す。
         ★「受け取れる」と言い切らない（機能が無いので嘘になる）。 */
      /* 他社の額は会社ページに出ている額と同じ（推定年収か会員の中央値）。
         ★2026-11-08 オーナー決定「会社ページと同じ2人にそろえる」。どちらの額かは札に必ず書く。 */
      pubAll: '全社の一覧を見る →',

      /* 前回との差。★ 見出しの文字列は変えない（契約テストがこれで節を探す） */
      cmp: '前回の明細との差',
      cmpGross: '総支給', cmpBlock: '乗務時間あたり', cmpDuty: '総勤務時間あたり',
      cmpBlockH: '乗務時間', cmpDutyH: '総勤務時間',
      cmpNone: '来月もう1枚出すと、ここに差が出ます。',
      cmpFirstAt: function (nm) {
        return nm + ' の明細は今回が1枚目です。それより前の月は別の会社なので、差の計算には入れていません（通貨も契約も手当の名前も違います）。';
      },
      cmpGap: function (n) { return '前回とは ' + n + 'ヶ月あいています。連続した月どうしの比較ではありません。'; },
      cmpCur: '前回と支給通貨が違うので、金額の増減は出していません（為替の動きが混ざって、昇給かどうか分からなくなるため）。時間の増減だけ出しています。',
      cmpFx: function (c) {
        return '増減は原本通貨（' + c + '）で計算しています。表示額は、為替が動いただけの月を昇給に見せないよう、両方の月を最新月のレートで揃えました。';
      },
      cmpNoPair: '両方の月に揃っている数字がまだありません。',

      /* 支給構成 */
      breakdown: '支給構成',
      housingNote: '※ 社宅（現物支給）は現金ではないので内訳に入れていません。',
      noBd: '手当ごとに分けて入れると、この円グラフがあなたの数字になります。明細を読み取ると自動で分かれます。',
      /* ★灰色1色の円（総支給1本だけの月）に添える1行。上の noBd は
         **円そのものが描けない行**の見本に添える文で、宛先が違う。 */
      restOnly: '※ 手当ごとに分けて入れると、この灰色が項目ごとに分かれます。明細を読み取ると自動で入ります。',
      /* 見本の札。★「サンプル」ではなく「見本」。本人の数字と1文字も似せない。 */
      sampleTag: '見本', sampleBtn: '匿名で給与を追加する →', psT: '明細から自動入力', psB: ['匿名', '暗号化＆セキュア', '簡単'],
      segBase: '基本給', segGuarantee: '保証手当・職務手当', segCommand: '機長・役職手当',
      segInstructor: '教官・訓練手当', segExaminer: '審査・査察手当',
      segUnion: '組合・乗員代表手当', segManagement: '管理・マネジメント手当',
      segNonline: 'その他の兼務・配属手当',
      segFlight: '乗務変動手当',
      segOther: 'その他手当', segHousing: '住宅手当', segTransport: '交通費', segPerDiem: 'パーディアム',
      /* ★下の2つは総支給が入っている行にしか出ない（pay-viz.js の segments()）。
         ★2026-08-26、総支給と内訳が両立するようになったので「内訳を入れていない分」
           という言い方をやめた。内訳を書いた人にも残りは出る＝それは
           「どの項目にも入れていない分」であって「内訳が無い」ではない。 */
      segBonus: '今月の賞与', segRest: 'どの項目にも入れていない分',
      fixed: '固定', variable: '変動', unknown: '判別できない',
      baseRatio: '基本給が総支給に占める割合',
      /* ★この円は総支給の中だけ。組合が外で払った分が抜けていることを断る
         （断らないと「自分が書いた70万が消えた」と読める）。 */
      unionOutNote: '※ 組合から別に受け取った分は、会社の明細には印字されません。受け取った額としてこの円に入れています。',
      /* ★不就労の減額があった月（2026-09-12）。明細の総支給は減額後、この円の
         内訳は減額前なので、合計が総支給より大きくなる。その1点だけ断る。 */
      absenceNote: '※ 不就労の減額（欠勤控除など）は、明細では総支給から引かれています。この円は引く前の内訳なので、合計は明細の総支給より減額のぶんだけ大きくなります。',

      /* 推移と節目 */
      /* ★ データだけで「転職した」「昇格した」と断定しない（§9）。
         明細の並びが変わっただけかもしれない（出向・期間限定の派遣など）。 */

      /* 次の給与。★ ポイント制にしない（§11）。返すのは「自分の分析が伸びること」そのもの。 */
      nextAdd: '匿名で給与を追加する →',
      nextAddYm: function (t) { return '{t}の給与を匿名で追加'.replace('{t}', function () { return t; }); },
      /* 記録月数。得点ではなく「何ヶ月ぶんのレポートになるか」を返す（§11）。 */
      mlH: '記録した月数',
      mlDone: function (n) { return n + 'ヶ月記録済み'; },
      mlNext: function (k, g) { return 'あと ' + k + 'ヶ月で、' + g + 'ヶ月ぶんのレポートになります'; },
      mlGoal: function (g) { return g + 'ヶ月'; },
      mlMax: '36ヶ月ぶんそろいました。ここから先は、記録するほど過去の自分との比較が効いてきます。',
      remind: '明細のリマインドを受け取る',
      remindOn: 'あなたの給料日ごろに、月1回だけ届きます。',
      remindOff: '現在オフ。リマインドは届きません。',
      remindWhen: function (dd) { return '目安：毎月 ' + dd + '日ごろ'; },
      remindNote: 'メール本文に明細の項目名や金額は書きません。解除リンクは毎回入ります。',
      remindErr: '設定を保存できませんでした。時間をおいて再度お試しください。',

      /* ── まだ給与を1件も出していない人が見る画面（2026-08-25 に作り直し）──
         前は「明細を1枚落とすと〜」だけで、**明細が要る**と読めていた。
         実際は手入力でも同じように解放される。★見出し・ボタンにカッコの注記を足さない。 */
      eTitle: 'マイレポート',
      eBandT: '給与を共有すると、すべての価値が解放されます',
      /* ★数字はサーバーの数え上げから来る。読めなかったら、この行ごと出さない。 */
      eBand: function (n, a) {
        return '現在 <b>' + n + '件</b> の実給与が、<b>' + a + '社</b> から共有されています';
      },
      eBand1: function (n) { return '現在 <b>' + n + '件</b> の実給与が共有されています'; },
      eBandC: 'REAL PAY を見る →',
      eStRep: '実給与の投稿', eStRepU: '件',
      eStAir: '航空会社',     eStAirU: '社',
      eStMon: '1ヶ月以内の新規投稿', eStMonU: '件',
      err: 'レポートを読み込めませんでした。時間をおいて開き直してください。',
      /* sfo / tri_tre は 2026-08-18 に選択肢から外した旧コード。過去の投稿がまだ持っているので、
         ラベルだけ残す（消すと本人のマイページに生の 'sfo' が出る）。 */
      cap: '機長', fo: '副操縦士', cadet: '訓練生',
      sfo: 'シニア副操縦士', tri_tre: '教官機長',
      ym: function (y, m) { return y + '年' + m + '月'; },
      ymShort: function (y, m) { return m + '月'; },
      date: function (s) {
        var t = new Date(s);
        return isFinite(t) ? (t.getFullYear() + '年' + (t.getMonth() + 1) + '月' + t.getDate() + '日') : '—';
      }
    },
    en: {
      /* ★ 日本語側と同じ考え方。名前が取れたら本人の名前を主語にする。 */
      titleOf: function (nm) { return nm ? nm + '’s pay report' : 'Your pay report'; },
      unlockOn: function (n) { return 'Unlocked · ' + n + (n === 1 ? ' day' : ' days'); },
      unlockOff: 'Locked',
      kAirline: 'Airline', kFleet: 'Aircraft', kPos: 'Seat', kBase: 'Base',
      kMonth: 'Pay month', kUpdated: 'Built on', kSheets: 'Payslips on record',
      sheets: function (n) { return String(n); },

      monthOf: function (t) { return '{t} pay'.replace('{t}', function () { return t; }); },
      noNet: 'Net pay isn’t entered for this month. Add it and your deductions show too.', noNetA: 'Add net pay',
      kGross: 'Gross pay', kNet: 'Net pay',
      perBlock: 'Per block hour', perDuty: 'Per duty hour',
      mBlockH: 'Block', mDutyH: 'Duty', mDays: 'Duty days',
      mStay: 'Layovers',
      more: 'More figures',
      hDays: function (n) { return String(n); },
      hStay: function (n) { return String(n); },
      kDeduct: 'Total deductions', kYtd: 'Taxable pay, year to date',
      kUnionOut: 'Paid separately by your union', kGrossAll: 'Received in total',
      kPerdiemOut: 'Per diem paid separately from the payslip',
      kAnnual: 'This month, straight-annualised',
      kAnnualB: 'This month, annualised (incl. bonus)',
      opH: 'Sample (operators only, made-up numbers)',
      opS: { many: '12 months', one: '1 month', hand: 'Typed in only' },
      opEmpty: 'No-pay screen',
      opMine: 'My numbers',
      vMonth: 'This month', vYear: 'Year',
      tabsAria: 'YOUR PAY views',
      /* ★"Roster" と "Pay" だけ二重引用符：訳の辞書の 'Roster'・'Pay' は別の部品のための長い訳（括弧の説明つき）を持つ。
           タブは短い字が要るので、別の鍵にしてある（gen-msg.mjs は値のソースそのものを鍵にする）。 */
      tabSum: 'Pay summary', tabRoster: "Roster", tabAna: 'Analysis', tabSet: 'Settings',
      pgAria: 'My page views', pgPage: 'MY PAGE', pgPay: 'MY PAY',
      tabSumS: "Pay", tabRosterS: "Roster", tabAnaS: 'Analysis', tabSetS: 'Settings',
      anaErr: 'Could not load the analysis view. Please try again in a moment.',
      prPrint: 'Print', prPrintA: 'Print this tab', prMonth: '{t} payslip',
      rosterErr: 'Could not load the roster view. Please try again in a moment.',
      why: 'What changed your pay', whyTot: 'Change in total earnings', whyDed: 'Change in total deductions', whyNet: 'Change in net pay',
      whyRest: '{n} other items', whyChart: 'Change by pay item',
      whyBd: 'Pay items', whyBdS: '{a} and {b} amounts', whyItem: 'Item', whyDiff: 'Difference', whyOut: 'Outside gross pay', whyGross: 'Gross pay',
      whyQty: 'Quantities (as printed on the payslip)',
      kProfit: 'Profit share', kNotional: 'Benefit in kind', kAbsence: 'Absence deduction',
      qnBlock: 'Block hours', qnDuty: 'Duty hours', qnNight: 'Night hours', qnCredit: 'Credit hours', qnGuarantee: 'Guaranteed hours',
      qnSectors: 'Sectors', qnDutyDays: 'Duty days', qnStay: 'Night stops', qnDaysOff: 'Days off',
      mGuar: function (g) { return 'vs ' + g + 'h guaranteed'; },
      momOf: function (ym) { return 'vs ' + ym; },

      total: 'Total pay recorded',
      tNet: 'Take-home, total', tDeduct: 'Deductions, total',
      tAvg: 'Average gross / month', tHourly: 'Career per block hour',
      tUnionOut: 'of which, paid by your union',
      tPerdiemOut: 'of which, per diem paid separately from the payslip',
      tBlockH: 'Block hours, total', tDutyH: 'Duty hours, total',
      tSpanOf: function (a, b) { return a === b ? a : a + ' – ' + b; },
      tipCum: function (a, b) { return 'Total ' + a + ' (this month ' + b + ')'; },
      tOnly: function (m, n) {
        return '※ Only months with a readable gross figure are added up (' + m + ' of ' + n + ').';
      },
      tNetOnly: function (m) { return '※ Take-home and deductions cover only the ' + m + (m === 1 ? ' month' : ' months') + ' where you entered take-home pay.'; },
      tNone: 'Nothing on record yet. Add your pay and the pile starts here.',
      months: function (n) { return n + (n === 1 ? ' month' : ' months'); },

      oppQ: function (p) { return '{p} pay at other airlines'.replace('{p}', function () { return p; }); },
      oppSub: 'Picked by region · highest pay first',
      rg: { asia: 'Asia', na: 'North America', europe: 'Europe', mideast: 'Middle East', oceania: 'Oceania', latam: 'Latin America', africa: 'Africa' },
      oppMe: 'You',
      tagEst: 'est.', tagMed: 'median',
      oppCurAnnual: 'This month, straight-annualised',
      oppCurAnnualB: 'This month, annualised (incl. bonus)',
      oppNone: 'No airlines to compare with yet.',
      oppNoPace: 'Your annual figure (monthly × 12 + bonus) is not available yet, so there is nothing to compare. File the payslip again, or fill in the annual fields on the form.',
      /* スカウトは作らない。将来やる予定があることだけ示す。 */
      pubAll: 'See every airline →',

      cmp: 'Change since your last payslip',
      cmpGross: 'Gross pay', cmpBlock: 'Per block hour', cmpDuty: 'Per duty hour',
      cmpBlockH: 'Block hours', cmpDutyH: 'Duty hours',
      cmpNone: 'File next month’s payslip and the change shows up here.',
      cmpFirstAt: function (nm) {
        return 'This is your first payslip at ' + nm + '. The months before it were at a different airline, so they are not differenced here — currency, contract and allowance names all change.';
      },
      cmpGap: function (n) { return 'There is a ' + n + '-month gap. These are not consecutive months.'; },
      cmpCur: 'Your pay currency changed since the last payslip, so amounts are not differenced — the move would be mostly FX and would not tell you whether you got a raise. Hours only.',
      cmpFx: function (c) {
        return 'Changes are computed in your pay currency (' + c + '). Both months are shown at the latest month’s rate, so a currency move does not appear as a raise.';
      },
      cmpNoPair: 'No figure is readable in both months yet.',

      breakdown: 'How your pay is made up',
      housingNote: '※ Company-provided housing is not cash, so it is left out of the breakdown.',
      noBd: 'Enter your pay allowance by allowance and this chart becomes your own. Reading a payslip fills it in automatically.',
      restOnly: '※ Enter your pay allowance by allowance and this grey circle splits into items. Reading a payslip fills it in automatically.',
      sampleTag: 'Sample', sampleBtn: 'Add pay anonymously →', psT: 'Auto-fill from a payslip', psB: ['Anonymous', 'Encrypted & secure', 'Quick'],
      segBase: 'Base pay', segGuarantee: 'Guarantee / duty',
      segCommand: 'Command / position', segInstructor: 'Instructor / training',
      segExaminer: 'Examiner / check',
      segUnion: 'Union / representative', segManagement: 'Management / leadership',
      segNonline: 'Other / non-line assignment',
      segFlight: 'Flight variable',
      segOther: 'Other allowances', segHousing: 'Housing', segTransport: 'Transport', segPerDiem: 'Per diem',
      /* ★The two below only appear on a row filed as one gross figure (see segments() in pay-viz.js). */
      segBonus: 'Bonus this month', segRest: 'Not itemised',
      fixed: 'Fixed', variable: 'Variable', unknown: 'Cannot tell',
      baseRatio: 'Base pay as a share of gross',

      unionOutNote: '※ Money your union pays you directly is not printed on the company payslip. It is included here as pay you received.',
      absenceNote: '※ Unpaid-absence deductions are taken off the gross on your payslip. This circle shows the items before that deduction, so the total here is larger than the printed gross by that amount.',

      nextAdd: 'Add pay anonymously →',
      nextAddYm: function (t) { return 'Add {t} pay anonymously'.replace('{t}', function () { return t; }); },
      mlH: 'Months on record',
      mlDone: function (n) { return n + (n === 1 ? ' month recorded' : ' months recorded'); },
      mlNext: function (k, g) { return k + ' more and this becomes a ' + g + '-month report'; },
      mlGoal: function (g) { return g + 'm'; },
      mlMax: '36 months on record. From here, every payslip you add deepens the comparison with your own past.',
      remind: 'Remind me when my payslip lands',
      remindOn: 'Once a month, around your own payday.',
      remindOff: 'Off. No reminders will be sent.',
      remindWhen: function (dd) { return 'Around the ' + ORD(dd) + ' of each month'; },
      remindNote: 'The email never contains payslip line items or amounts, and always carries a one-click unsubscribe link.',
      remindErr: 'Could not save that setting. Please try again in a moment.',

      /* Same screen in English. A payslip is not required — typing it in unlocks the same thing. */
      eTitle: 'My report',
      eBandT: 'Share your pay and everything here opens',
      eBand: function (n, a) {
        return '<b>' + n + '</b> pay records have been shared so far, from <b>' + a + '</b> airlines';
      },
      eBand1: function (n) { return '<b>' + n + '</b> pay records have been shared so far'; },
      eBandC: 'See REAL PAY →',
      eStRep: 'Pay records',      eStRepU: '',
      eStAir: 'Airlines',         eStAirU: '',
      eStMon: 'Added within 1 month', eStMonU: '',
      err: 'Could not load your report. Please try again in a moment.',
      /* sfo / tri_tre are retired codes (removed from the form 2026-08-18). Old reports still carry
         them, so keep the labels — otherwise the raw code shows up on the member's own page. */
      cap: 'Captain', fo: 'First Officer', cadet: 'Cadet',
      sfo: 'Senior First Officer', tri_tre: 'Instructor Captain',
      ym: function (y, m) { return MON[m - 1] + ' ' + y; },
      ymShort: function (y, m) { return MON[m - 1]; },
      date: function (s) {
        var t = new Date(s);
        return isFinite(t) ? (MON[t.getMonth()] + ' ' + t.getDate() + ', ' + t.getFullYear()) : '—';
      }
    }, /*PV-MSG:es*/ es: {
      /* ★ 日本語側と同じ考え方。名前が取れたら本人の名前を主語にする。 */
      titleOf: function (nm) { return nm ? nm + ': informe de remuneración' : 'Tu informe de remuneración'; },
      unlockOn: function (n) { return 'Desbloqueado · ' + n + (n === 1 ? ' día' : ' días'); },
      unlockOff: 'Bloqueado',
      kAirline: 'Aerolínea', kFleet: 'Tipo de aeronave', kPos: 'Categoría', kBase: 'Base',
      kMonth: 'Mes de pago', kUpdated: 'Creado el', kSheets: 'Recibos de nómina registrados',
      sheets: function (n) { return String(n); },

      monthOf: function (t) { return 'Remuneración de {t}'.replace('{t}', function () { return t; }); },
      noNet: 'No ingresaste tu sueldo neto de este mes. Si lo agregas, también verás tus deducciones.', noNetA: 'Agregar sueldo neto',
      kGross: 'Sueldo bruto', kNet: 'Sueldo neto',
      perBlock: 'Por hora block', perDuty: 'Por hora de servicio',
      mBlockH: 'Horas block', mDutyH: 'Servicio', mDays: 'Días de servicio',
      mStay: 'Pernoctas',
      more: 'Más cifras',
      hDays: function (n) { return String(n); },
      hStay: function (n) { return String(n); },
      kDeduct: 'Total de deducciones', kYtd: 'Remuneración gravable acumulada en el año',
      kUnionOut: 'Pagado aparte por tu sindicato', kGrossAll: 'Total recibido',
      kPerdiemOut: 'Viáticos pagados aparte del recibo de nómina',
      kAnnual: 'Este mes, anualizado de forma simple',
      kAnnualB: 'Este mes, anualizado (con bono)',
      opH: 'Muestra (solo operadores, cifras inventadas)',
      opS: { many: '12 meses', one: '1 mes', hand: 'Solo ingreso manual' },
      opEmpty: 'Pantalla sin remuneración',
      opMine: 'Mis cifras',
      vMonth: 'Este mes', vYear: 'Año',
      tabsAria: 'Vistas de YOUR PAY',
      /* ★"Roster" と "Pay" だけ二重引用符：訳の辞書の 'Roster'・'Pay' は別の部品のための長い訳（括弧の説明つき）を持つ。
           タブは短い字が要るので、別の鍵にしてある（gen-msg.mjs は値のソースそのものを鍵にする）。 */
      tabSum: 'Resumen de pago', tabRoster: "Programación", tabAna: 'Análisis', tabSet: 'Ajustes',
      pgAria: 'Vistas de mi página', pgPage: 'MI PÁGINA', pgPay: 'MI REMUNERACIÓN',
      tabSumS: "Pago", tabRosterS: "Programación", tabAnaS: 'Análisis', tabSetS: 'Ajustes',
      anaErr: 'No se pudo cargar la vista de análisis. Inténtalo de nuevo en un momento.',
      prPrint: 'Imprimir', prPrintA: 'Imprimir esta pestaña', prMonth: 'Recibo de {t}',
      rosterErr: 'No se pudo cargar la vista de programación. Inténtalo de nuevo en un momento.',
      why: 'Qué cambió en tu remuneración', whyTot: 'Variación del total devengado', whyDed: 'Variación del total de deducciones', whyNet: 'Variación del sueldo neto',
      whyRest: 'Otros {n} conceptos', whyChart: 'Variación por concepto de pago',
      whyBd: 'Conceptos de pago', whyBdS: 'Montos de {a} y {b}', whyItem: 'Concepto', whyDiff: 'Diferencia', whyOut: 'Fuera del sueldo bruto', whyGross: 'Sueldo bruto',
      whyQty: 'Cantidades (tal como aparecen en el recibo de nómina)',
      kProfit: 'Participación en las utilidades', kNotional: 'Prestación en especie', kAbsence: 'Descuento por ausencia',
      qnBlock: 'Horas block', qnDuty: 'Tiempo de servicio', qnNight: 'Horas nocturnas', qnCredit: 'Horas de crédito', qnGuarantee: 'Horas garantizadas',
      qnSectors: 'Sectores', qnDutyDays: 'Días de servicio', qnStay: 'Pernoctas', qnDaysOff: 'Días libres',
      mGuar: function (g) { return 'vs. ' + g + ' h garantizadas'; },
      momOf: function (ym) { return 'vs. ' + ym; },

      total: 'Remuneración total registrada',
      tNet: 'Total neto', tDeduct: 'Total de deducciones',
      tAvg: 'Bruto promedio / mes', tHourly: 'Por hora block, en toda tu carrera',
      tUnionOut: 'de lo cual, pagado por tu sindicato',
      tPerdiemOut: 'de lo cual, viáticos pagados aparte del recibo de nómina',
      tBlockH: 'Total de horas block', tDutyH: 'Total de horas de servicio',
      tSpanOf: function (a, b) { return a === b ? a : a + ' – ' + b; },
      tipCum: function (a, b) { return 'Acumulado ' + a + ' (este mes ' + b + ')'; },
      tOnly: function (m, n) {
        return '※ Solo se suman los meses con un sueldo bruto legible (' + m + ' de ' + n + ').';
      },
      tNetOnly: function (m) { return '※ El sueldo neto y las deducciones corresponden solo a ' + m + (m === 1 ? ' mes' : ' meses') + ' en que ingresaste tu sueldo neto.'; },
      tNone: 'Aún no hay nada registrado. Agrega tu remuneración y aquí empezará a acumularse.',
      months: function (n) { return n + (n === 1 ? ' mes' : ' meses'); },

      oppQ: function (p) { return '{p}: remuneración en otras aerolíneas'.replace('{p}', function () { return p; }); },
      oppSub: 'Seleccionadas por región · de mayor a menor remuneración',
      rg: { asia: 'Asia', na: 'Norteamérica', europe: 'Europa', mideast: 'Oriente Medio', oceania: 'Oceanía', latam: 'Latinoamérica', africa: 'África' },
      oppMe: 'Tú',
      tagEst: 'estimado', tagMed: 'mediana',
      oppCurAnnual: 'Este mes, anualizado de forma simple',
      oppCurAnnualB: 'Este mes, anualizado (con bono)',
      oppNone: 'Todavía no hay aerolíneas para comparar.',
      oppNoPace: 'Tu cifra anual (mensual × 12 + bono) todavía no está disponible, así que no hay nada con qué comparar. Vuelve a enviar el recibo de nómina o llena los campos anuales del formulario.',
      /* スカウトは作らない。将来やる予定があることだけ示す。 */
      pubAll: 'Ver todas las aerolíneas →',

      cmp: 'Cambio desde tu último recibo de nómina',
      cmpGross: 'Sueldo bruto', cmpBlock: 'Por hora block', cmpDuty: 'Por hora de servicio',
      cmpBlockH: 'Horas block', cmpDutyH: 'Tiempo de servicio',
      cmpNone: 'Envía el recibo de nómina del próximo mes y el cambio aparecerá aquí.',
      cmpFirstAt: function (nm) {
        return 'Este es tu primer recibo de nómina en ' + nm + '. Los meses anteriores corresponden a otra aerolínea, así que aquí no se calculan diferencias con ellos: cambian la moneda, el contrato y los nombres de las asignaciones.';
      },
      cmpGap: function (n) { return 'Hay un salto de ' + n + ' meses. No son meses consecutivos.'; },
      cmpCur: 'La moneda en que te pagan cambió desde el recibo de nómina anterior, así que no calculamos la diferencia de montos: el movimiento sería sobre todo por tipo de cambio y no te diría si tuviste un aumento. Solo se muestran las horas.',
      cmpFx: function (c) {
        return 'Los cambios se calculan en la moneda en que te pagan (' + c + '). Ambos meses se muestran al tipo de cambio del mes más reciente, así que un movimiento de la moneda no aparece como un aumento.';
      },
      cmpNoPair: 'Todavía no hay ninguna cifra legible en ambos meses.',

      breakdown: 'Cómo se compone tu remuneración',
      housingNote: '※ La vivienda proporcionada por la empresa no es efectivo, así que no se incluye en el desglose.',
      noBd: 'Ingresa tu remuneración asignación por asignación y esta gráfica mostrará tus propias cifras. Al leer un recibo de nómina, se completa automáticamente.',
      restOnly: '※ Ingresa tu remuneración asignación por asignación y este círculo gris se dividirá en conceptos. Al leer un recibo de nómina, se completa automáticamente.',
      sampleTag: 'Ejemplo', sampleBtn: 'Agregar remuneración de forma anónima →', psT: 'Autocompletar desde un recibo de nómina', psB: ['Anónimo', 'Cifrado y seguro', 'Rápido'],
      segBase: 'Sueldo base', segGuarantee: 'Horas garantizadas / asignación por servicio',
      segCommand: 'Asignación por categoría (puesto)', segInstructor: 'Instrucción / entrenamiento',
      segExaminer: 'Examinador / verificación',
      segUnion: 'Actividad sindical / representación', segManagement: 'Cargo de gestión / mando',
      segNonline: 'Otros / funciones fuera de la operación de línea',
      segFlight: 'Remuneración variable de vuelo',
      segOther: 'Otras asignaciones', segHousing: 'Vivienda', segTransport: 'Transporte', segPerDiem: 'Viáticos',
      /* ★The two below only appear on a row filed as one gross figure (see segments() in pay-viz.js). */
      segBonus: 'Bono del mes', segRest: 'Sin desglosar',
      fixed: 'Fijo', variable: 'Variable', unknown: 'No se puede determinar',
      baseRatio: 'Proporción del sueldo base en el sueldo bruto',

      unionOutNote: '※ El dinero que te paga directamente tu sindicato no aparece en el recibo de nómina de la empresa. Aquí se incluye como remuneración que recibiste.',
      absenceNote: '※ Los descuentos por ausencias sin goce de sueldo se restan del sueldo bruto en tu recibo de nómina. Este círculo muestra los conceptos antes de ese descuento, así que el total aquí supera en ese monto al sueldo bruto impreso.',

      nextAdd: 'Agregar remuneración de forma anónima →',
      nextAddYm: function (t) { return 'Agregar la remuneración de {t} de forma anónima'.replace('{t}', function () { return t; }); },
      mlH: 'Meses registrados',
      mlDone: function (n) { return n + (n === 1 ? ' mes registrado' : ' meses registrados'); },
      mlNext: function (k, g) { return k + ' más y este será un informe de ' + g + ' meses'; },
      mlGoal: function (g) { return g + 'm'; },
      mlMax: '36 meses registrados. A partir de aquí, cada recibo de nómina que agregues profundiza la comparación con tu propio historial.',
      remind: 'Avísame cuando llegue mi recibo de nómina',
      remindOn: 'Una vez al mes, cerca de tu día de pago.',
      remindOff: 'Desactivado. No se enviarán recordatorios.',
      remindWhen: function (dd) { return 'Alrededor del día ' + ORD(dd) + ' de cada mes'; },
      remindNote: 'El correo nunca incluye conceptos ni montos de tu recibo de nómina, y siempre trae un enlace para darte de baja con un solo clic.',
      remindErr: 'No se pudo guardar esa configuración. Inténtalo de nuevo en un momento.',

      /* Same screen in English. A payslip is not required — typing it in unlocks the same thing. */
      eTitle: 'Mi informe',
      eBandT: 'Comparte tu remuneración y se desbloquea todo lo que hay aquí',
      eBand: function (n, a) {
        return '<b>' + n + '</b> registros de remuneración compartidos hasta ahora, de <b>' + a + '</b> aerolíneas';
      },
      eBand1: function (n) { return '<b>' + n + '</b> registros de remuneración compartidos hasta ahora'; },
      eBandC: 'Ver REAL PAY →',
      eStRep: 'Registros de remuneración',      eStRepU: '',
      eStAir: 'Aerolíneas',         eStAirU: '',
      eStMon: 'Agregados hace menos de 1 mes', eStMonU: '',
      err: 'No se pudo cargar tu informe. Inténtalo de nuevo en un momento.',
      /* sfo / tri_tre are retired codes (removed from the form 2026-08-18). Old reports still carry
         them, so keep the labels — otherwise the raw code shows up on the member's own page. */
      cap: 'Capitán', fo: 'Primer oficial', cadet: 'Piloto en formación',
      sfo: 'Primer oficial sénior', tri_tre: 'Capitán instructor',
      ym: function (y, m) { return MON[m - 1] + ' ' + y; },
      ymShort: function (y, m) { return MON[m - 1]; },
      date: function (s) {
        var t = new Date(s);
        return isFinite(t) ? (MON[t.getMonth()] + ' ' + t.getDate() + ', ' + t.getFullYear()) : '—';
      }
    } /*/PV-MSG:es*/
  };
  T = (window.PV_T && window.PV_T(T, L)) || T[L];   // スペイン語の辞書（gen-msg.mjs が足す）があればそれ

  // 給料日は 1〜31 なので 11/12/13 の例外だけ見れば足りる
  function ORD(n) {
    var v = Number(n) || 0;
    var s = (v % 100 >= 11 && v % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th');
    return v + s;
  }

  var SEGNAME = {
    base:    T.segBase,    guarantee: T.segGuarantee,
    command: T.segCommand, instructor: T.segInstructor,
    examiner: T.segExaminer, union: T.segUnion, management: T.segManagement,
    nonline: T.segNonline,
    flight:  T.segFlight,
    other:   T.segOther,   housing:   T.segHousing,   transport: T.segTransport,
    perdiem: T.segPerDiem,
    bonus:   T.segBonus,   rest:      T.segRest
  };


  /* series ＝ 最新の明細と同じ会社の月だけ（前回との差・推移の線が使う）
     rows   ＝ 全社ぶんそのまま（累計だけが使う。足し算に会社の壁は無い）
     pub    ＝ 各社の推定年収と会社ページの決まり（salary-data.json）
     meds   ＝ 会員の中央値（全社ぶん・2人以上の組だけ。pv_member_medians_all） */
  var state = { data: null, rows: [], series: [], busy: false,
               pub: null, meds: null, name: '', pay: null,
               op: false, sample: null,           // 運営か・見本の種類（運営だけ）
               view: 'month',                     // 「今月」か「1年」か
               tab: 'summary', sumDirty: false };  // YOUR PAY のタブ・給与サマリーを隠れている間に描き直しそびれたか

  /* 見出しに出す呼び名。★ プロフィールの氏名を**そのまま**は出さない。
     ここは本人しか見ない画面だが、肩越しに覗かれる・スクリーンショットが
     流れる、が普通に起きる。姓（最初の1語）だけにして「◯◯さん」にする。
     取れないとき・長すぎるとき（自由入力なので何でも入る）は黙って
     「あなたの報酬レポート」に落とす。空欄の「さん」を出さない。 */
  function personName() {
    var s = String(state.name || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    var head = s.split(' ')[0];
    return (head.length >= 1 && head.length <= 12) ? head : '';
  }

  var payHref = function () { return 'pay-report.html#ps'; };

  /* ── 小物 ───────────────────────────────────────────────── */
  function sec(title, body, sub, mod) {
    return '<section class="pt-sec mr-card' + (mod ? ' ' + mod : '') + '">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(title) + '</h2>' +
      (sub ? '<span class="mr-card-s">' + esc(sub) + '</span>' : '') + '</div>' + body + '</section>';
  }
  function note(s) { return '<div class="pt-note">' + s + '</div>'; }   // 太字を通すので esc しない
  function empty(s) { return '<div class="pt-empty">' + esc(s) + '</div>'; }
  function row(k, v, sub) {
    return '<div class="mv-row"><span class="k">' + esc(k) + '</span>' +
      '<span class="v">' + esc(v) + '</span>' +
      (sub ? '<span class="s">' + esc(sub) + '</span>' : '') + '</div>';
  }
  var SEP = (L === 'ja') ? '・' : ' · ';
  var jpyOf = function (r, v) {                 // 原本通貨 → 表示用（fx は行が持っている）
    var fx = num(r.fx_to_jpy), n = num(v);
    return (n != null && fx != null) ? n * fx : null;
  };

  /* ── 見本（明細を出すまでの空欄）────────────────────────────────
     「かんたん入力」で額面1本だけ出した人には、明細でしか作れない節が
     空欄のまま並ぶ。空欄は「壊れている」に見えるので、代わりに見本を
     ぼかして置き、何が返ってくるのかを見せる（Give & Get の Get 側）。

     ★ 明細を出したかどうかは「出所」の自己申告では判定しない（投稿側は
       いくらでも名乗れる）。その行に数字が有るか無いかだけで分ける。
       行の事実なので嘘が入らない。
       ※出所の列名をこのファイルに書かないこと。db/test-form-contract.mjs が
         「列名が1度も出てこない」ことで分岐していない証明にしている。
     ★ 見本に金額を1つも書かない。割合だけ。金額を書くと、ありもしない年収を
       本人の画面に置くことになる（currency.js の走査対象にもなる）。
     ★ ぼかしは hover でも解かない。中身は見本なので、読めても意味が無い。
     ★ 中身は読み上げから外す（aria-hidden）。見本を数字として読ませない。 */
  function maskSample(inner, what) {
    return '<div class="mr-mask">' +
      '<div class="mr-mask-in" aria-hidden="true">' + inner + '</div>' +
      '<div class="mr-mask-over">' +
        '<span class="mr-mask-tag">' + esc(T.sampleTag) + '</span>' +
        '<p class="mr-mask-t">' + esc(what) + '</p>' +
        '<a class="pt-btn" href="' + payHref() + '">' + esc(T.sampleBtn) + '</a>' +
      '</div></div>';
  }

  /* 見本の支給構成。★ V.donut() は使えない（凡例と中央に金額を刷るため）。
     割合だけのドーナツをここで組む。色は pay-viz.js の SEG から借りる
     （見本と本物で色が違うと、明細を出したあとに別の図に見える）。 */
  var SEGCOL = {};
  (V.SEG || []).forEach(function (s) { SEGCOL[s.k] = s.c; });
  var SAMPLE_SEG = [
    { k: 'base', p: 52 }, { k: 'flight', p: 18 }, { k: 'perdiem', p: 12 },
    { k: 'housing', p: 11 }, { k: 'other', p: 7 }
  ];
  function sampleBreakdown() {
    var R = 52, SW = 20, C = 2 * Math.PI * R, acc = 0, arcs = '', legend = '';
    SAMPLE_SEG.forEach(function (s) {
      var len = C * s.p / 100;
      arcs += '<circle cx="66" cy="66" r="' + R + '" fill="none" stroke="' + SEGCOL[s.k] +
        '" stroke-width="' + SW + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) +
        '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 66 66)"></circle>';
      acc += len;
      legend += '<div class="pt-leg"><i style="background:' + SEGCOL[s.k] + '"></i>' +
        '<span class="nm">' + esc(SEGNAME[s.k]) + '</span>' +
        '<span class="pct">' + s.p + '%</span></div>';
    });
    return '<div class="pt-donut-wrap">' +
        '<div class="pt-donut"><svg viewBox="0 0 132 132" width="132" height="132" aria-hidden="true">' +
          '<circle cx="66" cy="66" r="' + R + '" fill="none" stroke="rgba(128,140,160,.12)" ' +
          'stroke-width="' + SW + '"></circle>' + arcs + '</svg></div>' +
        '<div class="pt-legend">' + legend + '</div>' +
      '</div>' +
      '<div class="mv-ratio"><b>52%</b><span>' + esc(T.baseRatio) + '</span></div>' +
      '<div class="mv-bar">' +
        '<i style="width:63%;background:#34d399"></i>' +
        '<i style="width:30%;background:#f5c842"></i>' +
        '<i style="width:7%;background:#94a3b8"></i>' +
      '</div>';
  }

  /* 増減のピル。★ 緑/赤は使わない。上げ＝オレンジ、下げ＝青、同じ＝無彩色。
     勤務時間が増えれば時間あたりの報酬は下がるので、色で良し悪しを言わない。 */
  function pct(p) {
    var cls = p > 0 ? 'up' : p < 0 ? 'dn' : 'fl';
    var sign = p > 0 ? '+' : p < 0 ? '−' : '±';    // 「−」は U+2212（ハイフンだと数字の一部に見える）
    return { cls: cls, tx: sign + Math.abs(p).toFixed(1) + '%' };
  }

  /* ── 会社の同一性 ─────────────────────────────────────────
     ★ 月をまたぐ比較（差・推移の線）は「同じ会社」の中だけでやる。
       会社が変われば通貨も契約も手当の名前も変わるので、つないだ瞬間に
       意味の無い数字になる（為替が動いただけで「昇給」に見える）。
     「一覧にない会社」は airline='other' ＋ 自由入力なので、コードだけで
     見ると別々の会社が全部ひとつに潰れる。自由入力まで込みで鍵にする。 */
  function airlineKey(r) {
    var a = String(r.airline || '').trim().toLowerCase();
    return (a === 'other') ? 'other:' + String(r.airline_other || '').trim().toLowerCase() : a;
  }
  function airlineName(r) {
    var n = r.airline_other || r.airline;
    return n ? String(n).toUpperCase() : '—';
  }
  /* 一覧の会社コード（'singapore-airlines'）を読める形に。
     ★ 辞書が届いていれば正しい社名。届かなければ全部大文字に落とす
       （頭文字だけ大文字にすると 'ana' が「Ana」、'klm' が「Klm」になる。
        左端の「現在」の札が airlineName() で全部大文字なので、そちらに揃う）。 */
  function codeLabel(code) {
    return String(code || '').split('-').join(' ').toUpperCase();
  }
  function sameAirline(rows, r) {
    var k = airlineKey(r);
    return rows.filter(function (x) { return airlineKey(x) === k; });
  }
  function posName(r) { return T[r.position] || r.position || '—'; }
  function fleetName(r) { return r.fleet ? String(r.fleet).toUpperCase() : '—'; }

  /* calc() の時間あたり報酬は円換算済み。原本通貨に戻すのは fx で割るだけ。
     ★ 分子の式（年額−賞与 ÷12 −パーディアム）をここへ写さない。写した時点で
       pay-viz.js の冒頭が禁じている二重定義になる。 */
  function toOrig(v, r) { var fx = num(r.fx_to_jpy); return (v != null && fx) ? v / fx : null; }
  // 小数第1位で揃える（74h と 86.5h が縦に並ぶと桁が揃わず読み比べにくい）
  function hh(v) { return v.toFixed(1) + 'h'; }

  /* ★ ここだけ fmt() の K/M 圧縮を使わない。
     $14,314 → $14,872 は fmt() だと「$14K → $15K」になり、正しい +3.9% が
     読み手には +7% に見える。並べて割り算される数字だけは丸めない。
     通貨切替には fmt() と同じ経路（PVCurrency の rates/symbols）で乗る。 */
  function exact(jpy) {
    var C = w.PVCurrency;
    var cur = (C && C.get) ? C.get() : 'JPY';
    var rate = (C && C.rates && C.rates[cur]) || 1;
    var sym = (C && C.symbols && C.symbols[cur]) || '¥';
    return sym + Math.round(jpy / rate).toLocaleString('en-US');
  }
  // pay_benchmarks は USD 建て。サイトの表示レートで円に直す（lp.js と同じ既定値）。
  function usdToJpy(usd) {
    var r = (w.PVCurrency && w.PVCurrency.rates && w.PVCurrency.rates.USD) || 158.95;
    return usd * r;
  }
  function median(list) {
    var a = list.slice().sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var h = Math.floor(a.length / 2);
    return (a.length % 2) ? a[h] : (a[h - 1] + a[h]) / 2;
  }

  /* ★ 比較に使う年収は「月額×12＋賞与」の方（annual_total_jpy）で固定する。
     比べる相手（pay_benchmarks.median_usd）が pv_annual_total() ＝ 月額×12＋賞与 で
     作られているため。定義の違う2つを引き算すると、その差が「機会」として大きく出る。 */
  function annualJpy(r) { return num(r.annual_total_jpy); }

  /* ── 前回の明細との差（同じ会社の直近2枚だけ）─────────────────
     ★ 増減は必ず原本通貨で計算する。円に直してから引くと、為替が動いた
       だけの月が「昇給」になる。表示額も両方の月を最新月のレートで揃える
       （そうしないと、画面の2つの数字と % が合わない）。
     ★ 総支給は pay-viz.js の grossOrig() ただ1つ。ここに式を写すと、
       同じページの中で違う「総支給」が並ぶ。 */
  function mom(rows) {
    var r = rows[rows.length - 1];
    var mine = sameAirline(rows, r);
    if (mine.length < 2) return null;
    var a = mine[mine.length - 2], b = r;          // 配列は period_ym の昇順
    var ca = V.calc(a), cb = V.calc(b);
    var sameCur = String(a.currency || '') === String(b.currency || '');
    var fx = num(b.fx_to_jpy);                     // 表示はこの月のレートで揃える
    var pairs = (sameCur ? [
      { k: 'gross', nm: T.cmpGross, a: V.grossOrig(a), b: V.grossOrig(b), money: true },
      { k: 'block', nm: T.cmpBlock, a: toOrig(ca.hourlyBlock, a), b: toOrig(cb.hourlyBlock, b), money: true },
      { k: 'duty',  nm: T.cmpDuty,  a: toOrig(ca.hourlyDuty, a),  b: toOrig(cb.hourlyDuty, b),  money: true }
    ] : []).concat([
      { k: 'blockH', nm: T.cmpBlockH, a: num(a.block_hours), b: num(b.block_hours) },
      { k: 'dutyH',  nm: T.cmpDutyH,  a: num(a.duty_hours),  b: num(b.duty_hours) }
    ]).filter(function (m) {
      // 前月が 0 だと % が無限大になる。片方でも読めていない行は出さない
      return m.a != null && m.b != null && m.a > 0 && (!m.money || fx != null);
    });
    return { a: a, b: b, sameCur: sameCur, fx: fx, pairs: pairs, dropped: rows.length > mine.length };
  }
  function pctOf(m, key) {
    if (!m) return null;
    var f = m.pairs.filter(function (x) { return x.k === key; })[0];
    return f ? pct((f.b / f.a - 1) * 100) : null;
  }

  /* ── 今月の実績 ────────────────────────────────────────────
     ★2026-11-10 オーナー「数字がたくさん並んでいるが、何の数字か・どれが大切か分かりにくい」。
       大きいのは総支給の1つだけ。ほかは「名前が左・数字が右」の1行1数字（1年の .yr-rl と同じ読み方）。
       明細の外の分・控除・年初来は「ほかの数字」に畳む（最初は閉じている）。数え方は1文字も変えていない。
     ★ duty が無いときに block から推定しない。実際の block:duty は
       会社と路線で倍ちがうので、推定した瞬間に数字が嘘になる。
     ★ 読めた数字だけ並べる。無い行は 0 でも「—」でも埋めない（0時間と未読取は別のこと）。 */
  function pill(delta) {
    return delta ? '<span class="mr-d ' + delta.cls + '">' + esc(delta.tx) + '</span>' : '';
  }
  // 名前が左・数字が右の1行（v はもう作った字。esc はここでする）
  function rl(k, v, delta) {
    return '<li class="mr-rl-i"><span class="mr-rl-k">' + esc(k) + '</span>' +
      '<span class="mr-rl-v"><b>' + esc(v) + '</b>' + pill(delta) + '</span></li>';
  }
  function rlList(items) { return items ? '<ul class="mr-rl" role="list">' + items + '</ul>' : ''; }
  // 細かい数字は畳む（最初は閉じている）。中身が無ければ札ごと出さない
  function moreBox(items) {
    return items ? '<details class="mr-more"><summary>' + esc(T.more) + '</summary>' + rlList(items) + '</details>' : '';
  }

  function thisMonth(r, m) {
    var c = V.calc(r);
    var net = num(r.net_pay_actual), ded = num(r.deduction_total), ytd = num(r.ytd_taxable);
    var gross = V.grossOrig(r);                    // 総支給の式は pay-viz.js に1つだけ
    var days = num(r.duty_days);                   // SQL に列が足りるまで undefined で来る
    var stay = num(r.stay_nights);                 // 同上（2026-08-13 に足した列）
    /* 控除は明細からしか読めなかったが、総支給と手取りが必須になったので手入力でも出せる。
       ★ 引き算で作るのは、そのぶんが本当に「総支給 − 手取り」のときだけ
         （＝ gross が総支給の実額であるとき）。 */
    if (ded == null && gross != null && net != null) ded = gross - net;

    // 大きい数字は総支給の1つだけ
    var body = '<div class="mr-hero"><span class="mr-hero-k">' + esc(T.kGross) + '</span>' +
      '<b class="mr-hero-v">' + esc(gross != null ? fmt(jpyOf(r, gross)) : '—') + '</b>' +
      pill(pctOf(m, 'gross')) + '</div>';

    /* ★総支給の外で受け取った分（支給元＝組合）。上の「総支給」は明細に印字された
       額そのもので、組合が直接払った分はそこに載っていない。ここに出さないと、
       下の年換算だけが大きくなって「12倍が合わない」画面になる（2026-09-02）。
       ★足し算をそのまま見せる。合計は年換算の分子と同じ額＝画面の中で追える。
       ★組合の分は畳まない（年換算と並べて見えていないと、掛け算が合わない理由が隠れる）。 */
    var uo = V.unionOutsideJpy(r);
    /* ★明細とは別に受け取ったパーディアム（2026-11-04）も足し算に入る。こちらは「ほかの数字」へ。
       古い pay-viz.js が残っている端末でも落ちないように、関数があるときだけ読む。 */
    var po = typeof V.perdiemOutsideJpy === 'function' ? V.perdiemOutsideJpy(r) : 0;
    var all = gross != null ? rl(T.kGrossAll, fmt(jpyOf(r, gross) + uo + po)) : '';

    /* ★年換算は「今月を12倍した」参考値であって、年収の実績ではない。名前（今月ベースの…）で言う。 */
    var ann = num(r.annual_total_orig);
    var rows =
      (net != null ? rl(T.kNet, fmt(jpyOf(r, net))) : '') +
      (uo > 0 && gross != null ? rl(T.kUnionOut, fmt(uo)) + all : '') +
      (ann != null ? rl(hasBonus(r) ? T.kAnnualB : T.kAnnual, fmt(jpyOf(r, ann))) : '') +
      (c.hourlyBlock != null ? rl(T.perBlock, fmt(c.hourlyBlock), pctOf(m, 'block')) : '') +
      (c.hourlyDuty != null ? rl(T.perDuty, fmt(c.hourlyDuty), pctOf(m, 'duty')) : '');
    body += rlList(rows);

    // 数量は1行の文で（乗務 57.1h · 総勤務 139.6h · ステイ 7泊）
    var q = [];
    if (c.blockH != null) q.push(T.mBlockH + ' ' + hh(c.blockH));
    if (c.dutyH != null) q.push(T.mDutyH + ' ' + hh(c.dutyH));
    if (days != null) q.push(T.mDays + ' ' + T.hDays(days));
    /* 0泊（日帰りだけの月）も出す。「書かなかった」と「泊まらなかった」は別のこと。 */
    if (stay != null) q.push(T.mStay + ' ' + T.hStay(stay));
    /* 保証時間との差。★ 明細は要らない。フォームで保証時間を書いた人にだけ出る。
       中東の 75〜80h 保証と日本の無保証を並べられるのは、この欄があるからこそ。
       ★ 保証が無い（空欄・0）人には出さない。0h との差を出すと、あたかも
         「保証0時間の契約」が実在するかのように読める。 */
    var guar = num(r.guaranteed_hours);
    if (guar > 0 && c.blockH != null) {
      var over = c.blockH - guar;
      q.push(T.mGuar(guar) + ' ' + (over >= 0 ? '+' : '−') + Math.abs(over).toFixed(1) + 'h');
    }
    if (q.length) body += '<p class="mr-qty">' + esc(q.join(' · ')) + '</p>';

    /* 控除は「総支給 − 手取り」でしか作れないので、手取りを書いた月にだけ出る。
       年初来の課税額は明細からしか読めない。★ 空の行を置かない。 */
    var extra = (ded != null ? rl(T.kDeduct, fmt(jpyOf(r, ded))) : '') +
                (ytd != null ? rl(T.kYtd, fmt(jpyOf(r, ytd))) : '');
    body += moreBox((po > 0 && gross != null ? rl(T.kPerdiemOut, fmt(po)) + (uo > 0 ? '' : all) : '') + extra);
    /* 手取りを書かなかった月。★2026-11-11 オーナー「緑のカード・白い字に」── 緑の上にぼかした見本と橙のボタンを
       置かない。1行の文と、その月を直す画面（MY PAGE の「編集」と同じ入口）へのリンクだけ。 */
    if (!extra && net == null && r.airline && r.period_year && r.period_month) {
      var fix = 'pay-report.html?edit=' + r.period_year + '-' + r.period_month + '&airline=' + encodeURIComponent(r.airline) +
        ((r.airline === 'other' && r.airline_other) ? '&other=' + encodeURIComponent(r.airline_other) : '');
      body += '<p class="mr-gn">' + esc(T.noNet) + ' <a href="' + esc(fix) + '">' + esc(T.noNetA) + '</a></p>';
    }

    /* 見出しは「2026年2月の給与」（最新の月が今月とは限らない）。右は比べた前の月（同じ年なら月だけ）。
       ★2026-11-11 ページで色のついたカードはこの1枚だけ（is-green）。 */
    var prev = m ? (m.a.period_year === r.period_year ? T.ymShort(m.a.period_year, m.a.period_month)
                                                       : T.ym(m.a.period_year, m.a.period_month)) : null;
    return sec(T.monthOf(T.ym(r.period_year, r.period_month)), body, prev ? T.momOf(prev) : '', 'is-green');
  }

  /* ── 累計報酬 ──────────────────────────────────────────────
     記録した月の支給額を積み上げる。1回出すごとに増える数字＝毎月戻る理由。

     ★ ここは差・推移の線と違って **会社で絞らない**。あれは比較なので同じ会社の
       中に閉じるが、これは「受け取った額の足し算」で、転職しても受け取った
       事実は消えない。足し方（各月をその月のレートで円に直す）は totals()。
     ★ 「生涯年収」「総収入」とは書かない。出していない月は入っていないので、
       そう名乗った瞬間に嘘になる。対象期間と月数を必ず見出しの右に出す。
     ★2026-11-10 オーナー「数字がたくさん並んでいるが、何の数字か・どれが大切か分かりにくい」。
       大きい数字は累計の1つだけ。ほかは「名前が左・数字が右」の行、細かい数字は「ほかの数字」に畳む。
     ★ 額面は総支給が分かる月ぜんぶ、手取り・控除は手取りを書いた月だけ
       （totals() がそう作っている）。控除は同じ部分集合の額面から引いているので、
       画面の「額面 − 手取り」は必ず「控除の合計」と一致する。額面と枚数が
       違うときは、いくつぶんの合計かを下に1行で断る。
     ★ 一番上の合計には**組合が総支給の外で払った分も入っている**（2026-09-02）。
       受け取った額の足し算なので入れないと嘘になるが、あの分は会社の明細の外＝
       控除が1円も引かれていない。だから「手取り＋控除」は上の合計より小さくなる。
       その差が何なのかを、内数の行（tUnionOut）1つで必ず出す（畳まない）。 */
  function lifetime(rows) {
    var t = V.totals(rows);
    if (!t.months) {
      return sec(T.total, empty(T.tNone) +
        '<a class="pt-btn" href="' + payHref() + '">' + esc(T.nextAdd) + '</a>', null, 'is-total');
    }

    var span = T.tSpanOf(
      T.ym(t.from.period_year, t.from.period_month),
      T.ym(t.to.period_year, t.to.period_month));

    var body = '<div class="mr-total"><b class="mr-total-v">' + esc(fmt(t.gross)) + '</b></div>';
    // 積み上がりの折れ線（指を置くとその月の累計とその月の額）。点は「足せた月」だけ＝見出しの月数と数が合う
    body += '<div class="mr-cum"></div>';

    /* 通算の時間あたり報酬。
       ★ 累計の額面 ÷ 累計の乗務時間 では出さない。上の「乗務時間あたり」は
         calc() の分子（賞与とパーディアムを抜いた月額）で作っているので、
         額面で割ると同じ名前の数字が同じページに2つ並ぶ。
         各月の calc() を時間で重み付けして平均する＝定義は1つのまま。 */
    var bh = 0, dh = 0, hNum = 0, hDen = 0;
    t.series.forEach(function (s) {
      var c = V.calc(s.r);
      bh += num(s.r.block_hours) || 0;
      dh += num(s.r.duty_hours) || 0;
      if (c.hourlyBlock != null && c.blockH > 0) { hNum += c.hourlyBlock * c.blockH; hDen += c.blockH; }
    });
    /* 手取り・控除は「手取りを書いた月」だけの合計（totals() がそう作る）。
       枚数が違うときは下に1行で断る。 */
    body += rlList(
      (t.monthsNet ? rl(T.tNet, fmt(t.net)) + rl(T.tDeduct, fmt(t.deduct)) : '') +
      /* 組合が総支給の外で払った分（内数）。0 の人には出さない。 */
      (t.unionOut > 0 ? rl(T.tUnionOut, fmt(t.unionOut)) : '') +
      rl(T.tAvg, fmt(t.gross / t.months)));
    body += moreBox(
      (bh > 0 ? rl(T.tBlockH, bh.toFixed(1) + 'h') : '') +
      (dh > 0 ? rl(T.tDutyH, dh.toFixed(1) + 'h') : '') +
      (hDen > 0 ? rl(T.tHourly, fmt(hNum / hDen)) : '') +
      /* 明細とは別に受け取ったパーディアム（内数・2026-11-04）。 */
      (t.perdiemOut > 0 ? rl(T.tPerdiemOut, fmt(t.perdiemOut)) : ''));

    if (t.skipped > 0) body += note(esc(T.tOnly(t.months, t.total)));
    if (t.monthsNet && t.monthsNet < t.months) body += note(esc(T.tNetOnly(t.monthsNet)));
    /* ★2026-11-11 紺と金をやめて白いカードに（色のついたカードは今月の緑1枚だけ）。is-hero はロードマップが使うので残す */
    return sec(T.total, body, span + SEP + T.months(t.months), 'is-total');
  }

  /* 累計の折れ線は running total なので、1行だけでは値が決まらない。
     chart() の valueAt に渡す（key は使われない）。
     ★ valueOf という名前にはできない。Object.prototype.valueOf が継承されていて
       常に function になり、他の呼び出しまで巻き込む（pay-viz.js の注記を参照）。
     ★ 枠は .mr-cum。
     ★2026-11-10 オーナー「指を置いたらその月の金額が出るべき。なぜ最後の点にだけ数字が？」
       ── 吹き出し（tipOf）に月・累計・その月の額。最後の点の数字は描かない（真上の大きい数字と同じ）。
       「この月」は累計の差＝その月に足した額（組合・明細の外のパーディアムも込み。totals() の足し方のまま）。
       年をまたぐときは横軸の月の下に年（yearOf）。 */
  function drawCumChart() {
    var box = root.querySelector('.mr-cum');
    if (!box) return;
    var t = V.totals(state.rows);
    if (!t.months) { box.innerHTML = ''; return; }
    box.innerHTML = V.chart(t.series.map(function (s) { return s.r; }), 'cum', {
      width:    V.widthOf(box, root),
      valueAt:  function (r, i) { return t.series[i].gross; },
      labelOf:  function (r) { return T.ymShort(r.period_year, r.period_month); },
      yearOf:   function (r) { return r.period_year; },
      tipOf:    function (r, i) {
        var s = t.series[i], before = i ? t.series[i - 1].gross : 0;
        return [T.ym(r.period_year, r.period_month), T.tipCum(fmt(s.gross), fmt(s.gross - before))];
      },
      endLabel: false,
      /* ★2026-11-11 白いカードの上なので金をやめてブランドの緑（--pv-accent と同じ値。SVG の属性は var() を読まない） */
      color:    '#0a8f79',
      aria:     T.total,
      noMetric: T.tNone
    });
  }

  /* ── 他社の年収（旧「機会」）────────────────────────────────
     ★2026-11-08 オーナー決定「会社ページと同じ2人にそろえる」。
       他社の額は**会社ページに出ている額と同じ**にする ── 推定年収（salary-data.json）か、
       会員の中央値（pv_member_medians_all ＝ 2人以上・1人1件・人数は返らない）か。
       どちらにするかの決まりも会社ページと同じ（salary-data.json の medRule ＝ 台帳 salary-basis.mjs の写し）：
       always ＝ 中央値があればいつも中央値（ANA・JAL）／higher ＝ 中央値が推定（base）を超えたときだけ中央値。
       ⚠️ 前は pay_benchmarks（提出の件数で5）を見ていた。件数で数えると1人の5か月で区分が開くので外した。
     ★ 順位を出さない。出すのは差だけ。「上位◯%」は本人を採点する言い方。
     ★ 「おすすめ転職先」「応募できます」とは書かない。採用の可否は測っていない。
     ★ 出すのは「いまより上がる会社」だけ（オーナー判断・2026-08-12）。下回る会社は畳んだ先にも出さない。 */

  /* ★2026-11-11 オーナー「グラフとか使えば？」── 札を横に並べるのをやめて、横に並ぶ棒（Levels.fyi の形）。
     目盛は 0 から・全部の棒で同じ（畳んだ先の棒も同じ目盛）。1本目はあなた（緑）、2本目は自社の会員の中央値
     （ある時だけ・薄い緑）、ほかの会社は灰色。どちらの額か（推定／中央値）は全部の行に書く。
     全部の棒に額が書いてあるので、指を置いたときの吹き出しは作らない。
     額は万の位で丸める（¥7,290万。円以外は currency.js の縮め方＝$46K）。各社の額が万円単位なので、
     丸めないと1つの図の中で桁の書き方が割れて、読み手が引き算できない。 */
  function bigOf(jpy) { return fmt(Math.round(jpy / 10000) * 10000); }
  function barRow(o, max) {
    var pc = max > 0 ? Math.max(1.5, Math.min(100, o.jpy / max * 100)) : 0;
    return '<li class="mr-cmp-r' + (o.mod ? ' ' + o.mod : '') + '">' +
      /* href があるときだけ社名をリンクにする。★ 相対で書く＝英語ページからは en/airlines/… を指す */
      '<span class="mr-cmp-n">' + (o.href ? '<a href="' + esc(o.href) + '">' + esc(o.name) + '</a>' : esc(o.name)) +
        (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</span>' +
      '<span class="mr-cmp-t" aria-hidden="true"><i style="width:' + pc.toFixed(1) + '%"></i></span>' +
      '<span class="mr-cmp-v"><b>' + esc(bigOf(o.jpy)) + '</b>' +
        '<em>' + esc(o.tag || '') + '</em></span>' +    // 札の無い行も空の札＝額の位置がそろう
      // 差は別の列（無い行も空の列を置く＝どの行も額の位置がそろう）
      '<span class="mr-cmp-d">' + esc(o.diff || '') + '</span></li>';
  }
  function barList(rows, max, mod) {
    return '<ol class="mr-cmp' + (mod ? ' ' + mod : '') + '" role="list">' +
      rows.map(function (o) { return barRow(o, max); }).join('') + '</ol>';
  }

  /* 年換算に年間の賞与・利益配分が入っているか（pay-viz.js の monthlyOrig が引く額と同じ2つ）。 */
  function hasBonus(r) {
    return ((num(r.bonus_annual) || 0) + (num(r.profit_share_annual) || 0)) > 0;
  }

  /* 職位の寄せ先（salary-data.json と会員の中央値の区分）。SFO は副操縦士、教官機長は機長へ。
     訓練生は寄せ先が無いので比較そのものを出さない（別の階級の数字を黙って当てない）。 */
  var PUB_BAND = { fo: 'fo', sfo: 'fo', cap: 'cap', tri_tre: 'cap' };

  /* 自分の会社・職位の会員の中央値（円）。2人以上の組しかサーバは返さない。 */
  function ownMedian(r) {
    var band = PUB_BAND[r && r.position], k = airlineKey(r), m = state.meds && state.meds[k];
    return (band && m && m[band] > 0) ? m[band] * 10000 : null;
  }

  /* 社名。salary-data.json に在れば読める名前、無ければ今までどおり略号の大文字。 */
  function ownName(r) {
    var A = state.pub && state.pub.A, a = A && r.airline !== 'other' && A[String(r.airline || '').toLowerCase()];
    if (a) return (L === 'en' && a.en) ? a.en : (a.ja || a.en);
    return airlineName(r);
  }

  /* 自社の会社ページ（一覧に在る会社だけ）。 */
  function ownHref(r) {
    var A = state.pub && state.pub.A, k = airlineKey(r);
    return (r && r.airline !== 'other' && A && A[k]) ? 'airlines/' + k + '.html' : '';
  }

  /* 1社1職位の額（円）と、それが会員の中央値か。会社ページの medianApply（career-live.js）と同じ決め方。
     返事が無い（中央値の口が無い・失敗した）ときは、会社ページと同じく書き込んである額のまま。 */
  function figureOf(slug, band) {
    var p = state.pub, a = p && p.A && p.A[slug], s = a && a[band], avg = s && num(s.avg);
    if (!(avg > 0)) return null;
    var R = (p.R && p.R[slug] && p.R[slug][band]) || {};
    var always = R.r === 'always', base = num(R.b) > 0 ? num(R.b) : avg;
    var m = state.meds && state.meds[slug] && state.meds[slug][band];
    if (m > 0) {
      var isMed = always || m > base;
      return { jpy: (isMed ? m : base) * 10000, med: isMed };
    }
    if (always) return { jpy: avg * 10000, med: R.m === 1 };     // 2人に届かない ＝ 書き込んである額のまま
    return { jpy: base * 10000, med: false };
  }

  /* 比べる相手の一覧（自分の会社は外す・高い順）。 */
  function pubList(r) {
    var p = state.pub, band = PUB_BAND[r && r.position];
    if (!p || !p.A || !band) return [];
    var my = airlineKey(r), list = [];
    Object.keys(p.A).forEach(function (k) {
      if (k === my) return;
      var f = figureOf(k, band), a = p.A[k];
      if (!f) return;
      list.push({ slug: k, band: band, jpy: f.jpy, med: f.med,
                  name: (L !== 'ja' && a.en) ? a.en : (a.ja || codeLabel(k)) });
    });
    list.sort(function (x, y) { return y.jpy - x.jpy; });
    return list;
  }

  /* あなたとの差（上も下も・色は付けない）。同じ額なら書かない */
  function diffTx(jpy, mine) {
    var dd = Math.round((jpy - mine) / 10000) * 10000;
    return dd > 0 ? '+' + fmt(dd) : dd < 0 ? '−' + fmt(-dd) : '';
  }
  function pubRow(x, mine) {
    return { name: x.name, href: 'airlines/' + x.slug + '.html', jpy: x.jpy,
             tag: x.med ? T.tagMed : T.tagEst, diff: diffTx(x.jpy, mine) };
  }

  /* 招待（データ密度）カードの差し込み口。中身は pv-referral.js が描く。
     ★区分が特定できる出口すべてに置く（mine == null の早期 return には置かない）。
       忘れると「いちばん区分が薄い人」＝この機能の対象そのものが永久にカードを見られない。 */
  function refSlot() { return '<div id="mr-ref-slot"></div>'; }

  /* ★2026-11-11 オーナー「ランキング形式でピックアップして、自分もその中に入るかたち。各地域から1社ずつ。自分と同じ地域は3社。
       日本ならアジア。色はちゃんと分けて（緑と灰色以外も・薄い色）」「番号は付けない」。
     ★2026-08-12 の「あなたより高い会社だけ」はやめた（オーナーが今回変えた）。順位の番号・上位◯% は今も書かない。
     地域は salary-data.json の region（japan はアジアに・us は北米に寄せる）。各地域の中では、よく見られている会社（vote-popular.json）
     を先に、無ければ年収の高い順に選ぶ。額の決め方は figureOf()（会社ページと同じ額・推定／中央値の札）のまま。 */
  var RG_OF = { japan: 'asia', asia: 'asia', us: 'na', europe: 'europe', mideast: 'mideast', oceania: 'oceania', latam: 'latam', africa: 'africa' };
  var RG_ORDER = ['asia', 'na', 'europe', 'mideast', 'oceania', 'latam', 'africa'];
  function regionOf(k) { var a = state.pub && state.pub.A && state.pub.A[k]; return a ? RG_OF[a.region] || null : null; }
  function rankPicks(list, mineRg) {
    var pop = (state.pub && state.pub.P) || [];
    var at = function (x) { var i = pop.indexOf(x.slug); return i < 0 ? 1e6 : i; };
    var out = [];
    RG_ORDER.forEach(function (g) {
      var c = list.filter(function (x) { return regionOf(x.slug) === g; });
      c.sort(function (p, q) { return at(p) - at(q) || q.jpy - p.jpy; });
      out = out.concat(c.slice(0, g === mineRg ? 3 : 1));
    });
    return out;
  }
  function opportunity(r) {
    var mine = annualJpy(r), band = PUB_BAND[r && r.position];
    var title = band ? T[band] : posName(r);
    // 比べられないときは1行の文だけ（区分が分からない出口なので、招待の差込口は置かない）
    if (mine == null) {
      return sec(T.oppQ(title), empty(T.oppNoPace));
    }
    var list = pubList(r);
    if (!list.length) {
      return sec(T.oppQ(title), empty(T.oppNone) + refSlot());
    }
    var mineRg = regionOf(airlineKey(r));
    var rows = rankPicks(list, mineRg).map(function (x) {
      var o = pubRow(x, mine), g = regionOf(x.slug);
      o.mod = 'g-' + g; o.sub = T.rg[g]; o.g = g;
      return o;
    });
    var om = ownMedian(r);
    if (om != null) rows.push({ mod: 'is-own', name: ownName(r), href: ownHref(r), tag: T.tagMed, jpy: om, sub: mineRg ? T.rg[mineRg] : '', diff: diffTx(om, mine) });
    rows.push({ mod: 'is-me', name: T.oppMe, sub: hasBonus(r) ? T.oppCurAnnualB : T.oppCurAnnual, jpy: mine, me: true });
    rows.sort(function (p, q) { return q.jpy - p.jpy || (p.me ? 1 : 0) - (q.me ? 1 : 0); });
    var max = Math.max.apply(null, rows.map(function (x) { return x.jpy; }));
    var seen = {};
    rows.forEach(function (x) { if (x.g) seen[x.g] = 1; });
    var body = '<ul class="mr-cmp-lg" aria-hidden="true">' + RG_ORDER.filter(function (g) { return seen[g]; }).map(function (g) {
      return '<li><i class="g-' + g + '"></i>' + esc(T.rg[g]) + '</li>';
    }).join('') + '</ul>' + barList(rows, max, 'is-rank') +
      '<p class="mr-more-s"><a class="mr-cmp-all" href="world-airlines.html">' + esc(T.pubAll) + '</a></p>';
    body += refSlot();
    return sec(T.oppQ(title), body, T.oppSub);
  }

  /* ── 前回の明細との差 ──────────────────────────────────────
     ★ 見出し「前回の明細との差」は変えない。連続した月とは限らないので
       「先月比」とは書けない（あいた月数は下の注記で出す）。 */
  function cmpRow(k, was, now, a, b) {
    var p = pct((b / a - 1) * 100);
    return '<div class="mv-c"><span class="k">' + esc(k) + '</span>' +
      '<span class="was">' + esc(was) + '</span>' +
      '<span class="arw" aria-hidden="true">→</span>' +
      '<span class="now">' + esc(now) + '</span>' +
      '<span class="d ' + p.cls + '">' + esc(p.tx) + '</span></div>';
  }

  function compare(rows, m) {
    var r = rows[rows.length - 1];
    if (!m) {
      // 会社が変わった直後：前の会社の枚数はあるので「1枚も無い」とは言わない
      var mine = sameAirline(rows, r);
      return sec(T.cmp, empty(T.cmpNone) +
        (rows.length > mine.length ? note(esc(T.cmpFirstAt(airlineName(r)))) : ''));
    }
    var body = m.pairs.length
      ? '<div class="mv-cmp">' + m.pairs.map(function (x) {
          return x.money ? cmpRow(x.nm, exact(x.a * m.fx), exact(x.b * m.fx), x.a, x.b)
                         : cmpRow(x.nm, hh(x.a), hh(x.b), x.a, x.b);
        }).join('') + '</div>'
      : empty(T.cmpNoPair);

    var gap = (m.b.period_year * 12 + m.b.period_month) - (m.a.period_year * 12 + m.a.period_month);
    if (gap > 1) body += note(esc(T.cmpGap(gap)));
    if (!m.sameCur) body += note(esc(T.cmpCur));
    else if (m.pairs.some(function (x) { return x.money; }) && num(m.a.fx_to_jpy) !== m.fx) {
      body += note(esc(T.cmpFx(m.b.currency || '')));
    }

    return sec(T.cmp, body,
      T.ym(m.a.period_year, m.a.period_month) + ' → ' + T.ym(m.b.period_year, m.b.period_month));
  }

  /* ── 給与が変わった理由（2026-11-09・承認済みの見本「WHAT CHANGED」）──────────
     ★「前回の明細との差」（上の compare）の置き換え。項目ごとの増減（同じ会社・同じ通貨の1つ前の明細と）を滝の図に、
       支給合計・控除合計・手取りの増減を横に、支給項目の内訳（金額だけ・数量は別の表）を開閉式で。
     ★数字は pv-report-engine.js の summary() / checks() だけ（ここで足し引きを作り直さない）。
     ★検算が1つでも通らなければ描かない＝ compare() に戻す（compare はそのために残してある）：
         増減の合計 ＝ Δ総支給（waterfall.ok）・2つの月とも内訳の合計 ＝ 総支給（sumToGross）・同じ通貨。
     ★計算の部品と明細の中身（my_report_items）は後から読む。届くまでは compare を出し、届いたら1回だけ描き直す。
       2枚以上ある人にだけ読む（1枚の人・まだ出していない人の通信は増えない）。 */
  var rep = { started: false, done: false, data: { items: [], maps: [], ok: false }, p: null };
  function reportItems(force) {
    if (force) rep.p = null;
    if (!rep.p) {
      rep.p = SB.rpc('my_report_items').then(function (r) {
        if (!r || r.error || !r.data || r.data.ok !== true) { rep.p = null; return { items: [], maps: [], ok: false }; }
        return { items: Array.isArray(r.data.items) ? r.data.items : [], maps: Array.isArray(r.data.maps) ? r.data.maps : [], ok: true };
      }, function () { rep.p = null; return { items: [], maps: [], ok: false }; });
    }
    return rep.p.then(function (x) { rep.data = x; return x; });
  }
  function ensureRep() {
    if (rep.started) return;
    rep.started = true;
    Promise.all([engineJs(), reportItems()]).then(function (r) {
      rep.done = !!r[0];
      if (!rep.done) return;
      if (!sumShown()) { state.sumDirty = true; return; }
      if (state.view === 'month') render();
    });
  }
  /* 描けるかどうか（画面を持たない。db/test-analysis-ui.mjs がこの関数をそのまま切り出して確かめる） */
  function whyModel(R, rows, items, maps, r) {
    if (!R || !R.build || !r) return null;
    var model = R.build({ reports: rows, items: items || [], maps: maps || [], airline: r.airline, airlineOther: r.airline_other });
    var s = R.summary(model, { b: R.helpers.ymOf(Number(r.period_year), Number(r.period_month)), by: (items && items.length) ? 'label' : 'kind' });
    var wf = s.waterfall;
    if (!s.a || !s.b || !wf || wf.sameCurrency !== true || wf.ok !== true) return null;     // ★増減の合計 ＝ Δ総支給 が確かめられないなら描かない
    var ck = R.checks(model).months;
    var good = function (ym) { return ck.some(function (c) { return c.ym === ym && c.sumToGross === true; }); };
    if (!good(s.a) || !good(s.b)) return null;                                                // ★内訳の合計 ＝ 総支給 でない月があれば描かない
    return { model: model, s: s };
  }
  function why(rows, m) {
    var r = rows[rows.length - 1], W = null;
    if (m && !rep.started) ensureRep();
    if (m && rep.done && w.PVReport) {
      try { W = whyModel(w.PVReport, rows, state.sample ? [] : rep.data.items, state.sample ? [] : rep.data.maps, r); } catch (e) { W = null; }
    }
    if (!W) return { card: compare(rows, m), table: '' };
    return whyHTML(W);
  }
  function whyHTML(W) {
    var R = w.PVReport, s = W.s, wf = s.waterfall;
    var monthOf = function (ym) { return W.model.months.filter(function (x) { return x.ym === ym; })[0]; };
    var ma = monthOf(s.a), mb = monthOf(s.b), cur = mb.currency, fx = num(mb.fx_to_jpy);   // ★2つの月とも新しい月のレート（compare と同じ）
    var la = T.ymShort(ma.y, ma.m), lb = T.ymShort(mb.y, mb.m);
    var mny = function (v, sign) {
      var x = R.fromMinor(v, cur);
      if (x == null || fx == null) return '—';
      var j = x * fx, t = exact(Math.abs(j)), z = /^\D*0$/.test(t);
      return sign ? (z ? '±' : j > 0 ? '+' : '−') + t : (j < 0 && !z ? '−' : '') + t;
    };
    var kindNm = function (k) {
      if (k === 'profit') return T.kProfit;
      if (k === 'notional') return T.kNotional;
      if (k === 'absence') return T.kAbsence;
      var kd = R.KINDS[k];
      return (kd && kd.seg && SEGNAME[kd.seg]) || k;
    };
    var nm = function (it) { return it.label ? String(it.label) : kindNm(it.kind); };

    /* 滝の図：動いた項目（多いときは大きい順に6つ ＋「ほかのN項目」）→ 支給合計の増減 */
    var moved = wf.items.filter(function (x) { return x.delta !== 0; }), steps = moved;
    if (moved.length > 7) {
      var keep = moved.slice().sort(function (x, y) { return Math.abs(y.delta) - Math.abs(x.delta); }).slice(0, 6);
      var others = moved.filter(function (x) { return keep.indexOf(x) < 0; });
      steps = moved.filter(function (x) { return keep.indexOf(x) >= 0; });
      steps = steps.concat([{ rest: others.length, delta: others.reduce(function (a, x) { return a + x.delta; }, 0) }]);
    }
    var cum = 0, lo = 0, hi = 0;
    steps = steps.map(function (x) {
      var o = { k: x.rest ? T.whyRest.replace('{n}', function () { return x.rest; }) : nm(x), d: x.delta, a: x.a, b: x.b, rest: !!x.rest, s: cum };
      cum += x.delta; o.e = cum;
      lo = Math.min(lo, o.s, o.e); hi = Math.max(hi, o.s, o.e);
      return o;
    });
    var span = (hi - lo) || 1, P = function (v) { return (v - lo) / span * 100; };
    var bar = function (from, to, cls) {
      var x0 = P(Math.min(from, to)), x1 = P(Math.max(from, to));
      return '<i class="mv-wf-0" style="left:' + P(0).toFixed(2) + '%"></i>' +
        '<i class="mv-wf-b ' + cls + '" style="left:' + x0.toFixed(2) + '%;width:' + Math.max(0.8, x1 - x0).toFixed(2) + '%"></i>';
    };
    var rowsH = steps.map(function (x) {
      var cls = x.d > 0 ? 'up' : 'dn';
      var tip = x.rest ? '' : la + ' ' + (x.a == null ? '—' : mny(x.a)) + ' → ' + lb + ' ' + (x.b == null ? '—' : mny(x.b));
      return '<div class="mv-wf-r" role="listitem" tabindex="0" aria-label="' + esc(x.k + ' ' + mny(x.d, true) + (tip ? ' · ' + tip : '')) + '">' +
        '<span class="mv-wf-k">' + esc(x.k) + '</span><span class="mv-wf-t">' + bar(x.s, x.e, cls) + '</span>' +
        '<b class="mv-wf-v">' + esc(mny(x.d, true)) + '</b>' + (tip ? '<span class="mv-wf-tip" aria-hidden="true">' + esc(tip) + '</span>' : '') + '</div>';
    }).join('') +
      '<div class="mv-wf-r is-tot" role="listitem" tabindex="0" aria-label="' + esc(T.whyTot + ' ' + mny(wf.deltaGross, true)) + '">' +
        '<span class="mv-wf-k">' + esc(T.whyTot) + '</span><span class="mv-wf-t">' + bar(0, wf.deltaGross, 'tot') + '</span>' +
        '<b class="mv-wf-v">' + esc(mny(wf.deltaGross, true)) + '</b>' +
        '<span class="mv-wf-tip" aria-hidden="true">' + esc(la + ' ' + mny(ma.gross) + ' → ' + lb + ' ' + mny(mb.gross)) + '</span></div>';

    /* 支給合計・控除合計・手取りの増減（書いていない月は「—」。0 で埋めない） */
    var D = s.netChange && s.netChange.delta;
    var net = D ? '<div class="mv-why-net">' +
      '<div class="mv-why-nr"><span>' + esc(T.whyTot) + '</span><b>' + esc(mny(D.gross, true)) + '</b></div>' +
      '<div class="mv-why-nr"><span>' + esc(T.whyDed) + '</span><b>' + esc(D.deductions == null ? '—' : mny(D.deductions, true)) + '</b></div>' +
      '<div class="mv-why-nr is-net"><span>' + esc(T.whyNet) + '</span><b>' + esc(D.net == null ? '—' : mny(D.net, true)) + '</b></div></div>' : '';

    var card = '<section class="pt-sec mr-card mv-why">' +
      '<div class="mr-card-h"><h2 class="mr-card-t">' + esc(T.why) + '</h2><span class="mr-card-s">' +
        esc(T.ym(ma.y, ma.m) + ' → ' + T.ym(mb.y, mb.m)) + '</span></div>' +
      '<div class="mv-why-top"><b class="mv-why-big">' + esc(mny(wf.deltaGross, true)) + '</b><span>' + esc(T.whyTot) + '</span></div>' +
      '<div class="mv-wf" role="list" aria-label="' + esc(T.whyChart) + '">' + rowsH + '</div>' + net + '</section>';

    /* 支給項目の内訳（開閉式）：金額の表と数量の表を分ける（同じ列に混ぜない） */
    var tr = function (k, a, b, dd, tag) {
      return '<tr><th scope="row">' + esc(k) + (tag ? ' <small>' + esc(tag) + '</small>' : '') + '</th><td>' + esc(a == null ? '—' : mny(a)) + '</td><td>' +
        esc(b == null ? '—' : mny(b)) + '</td><td>' + esc(dd == null ? '—' : mny(dd, true)) + '</td></tr>';
    };
    var body = wf.items.map(function (x) { return tr(nm(x), x.a, x.b, x.delta); }).join('') +
      (wf.outside || []).map(function (x) { return tr(kindNm(x.kind), x.a, x.b, x.delta, T.whyOut); }).join('');
    var QN = { block: T.qnBlock, duty: T.qnDuty, night: T.qnNight, credit: T.qnCredit, guarantee: T.qnGuarantee,
               sectors: T.qnSectors, dutyDays: T.qnDutyDays, stay: T.qnStay, daysOff: T.qnDaysOff };
    var qv = function (k, v) {
      if (v == null) return '—';
      return R.QTY_UNIT[k] === 'min' ? Math.floor(v / 60) + ':' + ('0' + (v % 60)).slice(-2) : String(v);
    };
    var qrows = Object.keys(QN).filter(function (k) { return ma.qty[k] != null || mb.qty[k] != null; }).map(function (k) {
      return '<tr><th scope="row">' + esc(QN[k]) + '</th><td>' + esc(qv(k, ma.qty[k])) + '</td><td>' + esc(qv(k, mb.qty[k])) + '</td></tr>';
    }).join('');
    var head = function (third) {
      return '<thead><tr><th scope="col">' + esc(T.whyItem) + '</th><th scope="col">' + esc(la) + '</th><th scope="col">' + esc(lb) + '</th>' +
        (third ? '<th scope="col">' + esc(T.whyDiff) + '</th>' : '') + '</tr></thead>';
    };
    var table = '<details class="mr-card mv-why-bd"><summary><span class="mr-card-t">' + esc(T.whyBd) + '</span>' +
      '<span class="mr-card-s">' + esc(T.whyBdS.replace('{a}', function () { return la; }).replace('{b}', function () { return lb; })) + '</span></summary>' +
      '<div class="mv-why-tw"><table class="mv-why-tbl">' + head(true) + '<tbody>' + body + '</tbody>' +
      '<tfoot>' + tr(T.whyGross, ma.gross, mb.gross, wf.deltaGross) + '</tfoot></table>' +
      (qrows ? '<p class="mv-why-qh">' + esc(T.whyQty) + '</p><table class="mv-why-tbl is-qty">' + head(false) + '<tbody>' + qrows + '</tbody></table>' : '') +
      '</div></details>';
    return { card: card, table: table };
  }

  /* ── 支給構成（ドーナツ ＋ 固定/変動）─────────────────────────
     ★ その他手当は固定とも変動とも決められないので3本目のバケツに置く。
       無理に2分割すると、どちらに寄せても嘘になる。 */
  function breakdown(r) {
    var dn = V.donut(r, {
      title: T.ym(r.period_year, r.period_month), name: SEGNAME,
      notes: { housing: T.housingNote, unionOut: T.unionOutNote,
               absence: T.absenceNote, noBreakdown: T.restOnly }
    });
    /* 円そのものが描けない行（＝その月の総支給が無い・レートが無い・手当の合計が
       総支給を大きく超えている）。空欄で終わらせず、見本をぼかして出す。
       ★総支給1本だけの行はここに落ちない（2026-09-02）。灰色1色でも本人の
         数字が真ん中に出る円を描く＝給与を出した人には必ず円が出る。 */
    if (!dn) return sec(T.breakdown, maskSample(sampleBreakdown(), T.noBd));

    var body = dn;
    var s = V.segments(r);
    /* ★灰色1色の円。固定/変動/判別できない の3本棒は「判別できない100%」に
       なるだけで何も言わないので出さない。代わりに入口を1つ置く
       （円の下の但し書き（restOnly）とセットで Give & Get の Get 側になる）。 */
    if (s && s.noBreakdown) {
      return sec(T.breakdown, dn +
        '<a class="pt-btn" href="' + payHref() + '">' + esc(T.sampleBtn) + '</a>');
    }
    var v = s ? s.vals : null;
    if (v) {
      /* ★保証給は毎月かならず出る下限＝固定。落とすと3本の合計が総支給に届かず、
         「固定 + 変動 + 判別できない < 円ぜんぶ」になって割合が静かにズレる。 */
      var fixed = v.base + v.guarantee + v.command + v.housing + v.transport;
      /* 賞与は月ごとに出たり出なかったりする＝変動。総支給1本の行にしか入らない。
         ★教官・審査・組合・管理職・兼務の手当もここ。担当したセッション数・日数・
           活動日数・管理業務日数・兼務の業務日数で月ごとに変わるのが普通で、
           「月額で固定」の会社もあるが、変動として数えるほうが実態に近い。
           ★どれか1本に必ず入れること。3本のどこにも入れないと、
             db/test-value-breakdown.mjs が「スライスの取りこぼし」で落ちる。 */
      var vari  = v.flight + v.instructor + v.examiner + v.union + v.management
                + v.nonline + v.perdiem + v.bonus;
      /* 「内訳を入れていない分」は固定とも変動とも言えないので、その他手当と同じ3本目へ。 */
      var unk   = v.other + v.rest;
      var total = fixed + vari + unk;
      if (total > 0) {
        var pc = function (x) { return Math.round(x / total * 100); };
        var BARS = [
          { nm: T.fixed,    v: fixed, c: '#34d399' },
          { nm: T.variable, v: vari,  c: '#f5c842' },
          { nm: T.unknown,  v: unk,   c: '#94a3b8' }
        ].filter(function (x) { return x.v > 0; });

        /* ★分母は円ぜんぶ（＝受け取った額）。棒の割合とも、DEEP PAY の支給構成とも、
           年収とも同じ数え方になる。
           ⚠️ 2026-09-02 の一時期、ここだけ組合が総支給の外で払った分を引いていた
              （「明細に印字された額に戻す」つもりだった）。同じ日にオーナーが
              「総支給は会社から＋組合から」と決めた年収の定義と食い違うので戻した。
              半分が組合から出ている人の基本給は、受け取った額の 28% で正しい。
              47% は「会社の半分しか見なかったらこう見える」という架空の数字だった。 */
        var basePc = Math.round(v.base / total * 100);

        /* ★総支給1本の行（s.partial）では基本給が分かっていない。ここを出すと
           「基本給は0%」と刷ることになるので、行ごと出さない。 */
        body += (s.partial ? '' :
            '<div class="mv-ratio"><b>' + basePc + '%</b><span>' + esc(T.baseRatio) + '</span></div>') +
          '<div class="mv-bar">' + BARS.map(function (x) {
            return '<i style="width:' + (x.v / total * 100).toFixed(2) + '%;background:' + x.c + '"></i>';
          }).join('') + '</div>' +
          '<div class="pt-legend" style="margin-top:12px">' + BARS.map(function (x) {
            return '<div class="pt-leg"><i style="background:' + x.c + '"></i>' +
              '<span class="nm">' + esc(x.nm) + '</span>' +
              '<span class="amt">' + esc(fmt(x.v)) + '</span>' +
              '<span class="pct">' + pc(x.v) + '%</span></div>';
          }).join('') + '</div>';
      }
    }
    return sec(T.breakdown, body);
  }

  /* ★2026-11-11 オーナー「このグラフいる？」── 「月ごとの推移」（と一緒に出していた「記録の節目」）は外した。
       2か月では「前回との差」と同じことしか言っておらず、月が増えても、時間あたりの推移は分析タブ
       （〇〇あたりの収入）に、月ごとの額は「1年」に、もう在る。 */

  /* ── 次の1枚で増えるもの ──────────────────────────────────
     ★ ポイントを配らない。返すのは「自分の分析が伸びること」そのもの。 */
  /* ★ スイッチの見た目は mail_optin だけで決めない。
     送信条件は「メール通知（親 email_opt_in）× リマインド（子 mail_optin）」の AND
     （db/pay-reminder.sql の pv_reminder_due）。このページには親のスイッチが無いので、
     子だけを見て「オン」と描くと、マイページで親を切った人に
     「オンなのに届かない」画面を出すことになる。 */
  function remindOn(dat) { return !!(dat && dat.mail_optin && dat.email_opt_in); }

  /* 記録月数の節目。★ 点数を配らない（§11）。返すのは
     「何ヶ月ぶんのレポートになるか」だけ（次の節目までの細い線1本）。 */
  var GOALS = [6, 12, 24, 36];
  // 次に出す月。12月の次は翌年1月（年をまたぐと「13月」になる）
  function nextYm(r) {
    var y = Number(r.period_year), m = Number(r.period_month) + 1;
    if (m > 12) { m = 1; y += 1; }
    return T.ym(y, m);
  }

  /* ── 月次リマインド（子）のスイッチ ─────────────────────────
     ★2026-09-06、MY PAGE に統合した。あちらでは ⑥ SETTINGS の中の
       #mv-remind-slot に描く（親のスイッチのすぐ下＝親子が並んで見える）。
       差込口が無いページでは、今までどおり「次の1枚」の中に出す。
     ★どちらの場合も、押したときに走るのは toggleRemind ひとつだけ。
       set_mail_optin 以外は呼ばない（保存先も送信条件も一切変えない）。 */
  function remindBlock(dat) {
    var on = remindOn(dat);
    var day = dat && dat.pay_day_of_month;
    var when = (on && day) ? note(esc(T.remindWhen(day))) : '';
    return '<div class="pt-sec pt-remind-row" style="margin-top:0">' +
        '<div><div class="pt-remind-h">' + esc(T.remind) + '</div>' +
        '<div class="pt-note" id="mv-remind-hint">' + esc(on ? T.remindOn : T.remindOff) + '</div>' + when + '</div>' +
        '<button id="mv-remind-sw" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" ' +
          'aria-label="' + esc(T.remind) + '" class="pt-sw' + (on ? ' on' : '') + '"><span></span></button>' +
      '</div>' + note(esc(T.remindNote));
  }

  function bindRemind(scope) {
    var sw = scope && scope.querySelector('#mv-remind-sw');
    if (sw) sw.addEventListener('click', toggleRemind);
  }

  /* ⑥ SETTINGS の差込口へ描く。★rows が 0 件の人にも描く
     ── 設定は「まだ1枚も出していない」ことと関係が無い。 */
  function paintRemind(dat) {
    var slot = d.getElementById('mv-remind-slot');
    if (!slot) return;
    if (!dat) { slot.textContent = T.remindErr; return; }
    slot.innerHTML = remindBlock(dat);
    bindRemind(slot);
  }

  /* ★2026-11-11 「次の給与を追加すると」の「＋」の4行と見出しを外した。残すのは、記録した月数と次の節目までの
       細い線1本と、次の月を出すボタンだけ（通知の切り替えは、差込口が無いページだけ今までどおりここに）。 */
  function next(dat, rows, r) {
    var here = !d.getElementById('mv-remind-slot');   // 差込口が無いページだけ、ここに出す
    var n = rows.length, goal = null;
    for (var i = 0; i < GOALS.length; i++) { if (n < GOALS[i]) { goal = GOALS[i]; break; } }
    var pc = goal ? Math.max(4, Math.round(n / goal * 100)) : 100;
    return '<section class="pt-sec mr-card mv-next">' +
      '<div class="mv-next-l"><b>' + esc(T.mlDone(n)) + '</b>' +
        '<span>' + esc(goal ? T.mlNext(goal - n, goal) : T.mlMax) + '</span>' +
        '<span class="mv-next-bar" aria-hidden="true"><i style="width:' + pc + '%"></i></span></div>' +
      '<a class="pt-btn" href="' + payHref() + '">' + esc(T.nextAddYm(nextYm(r))) + '</a>' +
      (here ? '<div class="mv-next-rm">' + remindBlock(dat) + '</div>' : '') +
      '</section>';
  }

  /* ── 描画 ────────────────────────────────────────────────── */
  /* ★MY PAGE（profile.html）の中では、h1 も「解放中／あと N 日」も「N 枚」も
       ① YOUR STATUS がもう出している。同じ数字を1画面に2回書くと、
       食い違ったときにどちらが本物か分からなくなる。ここでは
       会社・機材・職位・基地・更新日だけにする（見出しは節の h2 が持つ）。 */
  /* ★2026-11-11 オーナー「会社・機種・職位・作成日が丸いボタンのようなのはなぜ？そもそもいる？」
       ── 押せないのに押せそうな形をしていただけだった。灰色の字1行にして、同じ行の右に「今月｜1年」と印刷。
       作成日は画面から外し、印刷の見出しにだけ載せる（bindView → printPane）。 */
  function header(dat, r, rows) {
    var host = !!w.PV_MYPAGE_HOST;
    var until = dat.access_until ? new Date(dat.access_until) : null;
    var left = until ? Math.max(0, Math.ceil((until - Date.now()) / 86400000)) : 0;
    var meta = [ownName(r), fleetName(r), posName(r)]
      .concat(r.base_iata ? [T.kBase + ' ' + String(r.base_iata).toUpperCase()] : [])
      .concat(host ? [] : [T.sheets(rows.length), left > 0 ? T.unlockOn(left) : T.unlockOff]);
    return '<div class="mr-hd mv-meta">' +
      (host ? '' : '<h1 class="mr-hd-t">' + esc(T.titleOf(personName())) + '</h1>') +
      '<p class="mv-meta-t">' + esc(meta.join(' · ')) + '</p>' + viewBar() + '</div>';
  }

  /* ══ まだ給与を1件も出していない人の画面 ═══════════════════════
     ★ここで数字を作らない。件数・社数・直近1ヶ月ぶんは pv_pay_rows() の数え上げ
       （state.pay.stats）からしか来ない。読めなかったカードは、そのカードごと出さない
       ── 0 を並べると「誰も出していない」という嘘の数字になる（REAL PAY と同じ決まり）。
     ★見出し・ボタンにカッコの注記を足さない（2026-08-25 オーナー指摘）。
     ★3段の Give → Get は pv-gates.js の giveGetHTML() をそのまま借りる。書き写さない。 */

  var E_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"'
            + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'
            + ' aria-hidden="true" focusable="false">';
  // 錠前。帯と最後の1行で使い回す
  var IC_LOCK = '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor"'
              + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
              + ' aria-hidden="true" focusable="false">'
              + '<rect x="4.25" y="8.6" width="11.5" height="8.15" rx="2.2"/>'
              + '<path d="M7 8.6V6.4a3 3 0 0 1 6 0v2.2"/></svg>';

  var E_ICON = {
    rep: '<path d="M6 2.75h7.5L17.25 6.5v10.75a1 1 0 0 1-1 1h-10.25a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1Z"/>'
       + '<path d="M13.25 2.75v4h4"/><path d="M8 10.5h5M8 13.5h3.5"/>',
    air: '<circle cx="10" cy="10" r="7.25"/><path d="M2.75 10h14.5"/>'
       + '<path d="M10 2.75c1.9 2 2.9 4.55 2.9 7.25S11.9 15.25 10 17.25C8.1 15.25 7.1 12.7 7.1 10S8.1 4.75 10 2.75Z"/>',
    mon: '<path d="M3 15.25 8 10l3 3 5.25-6.25"/><path d="M12.25 6.75h4.25V11"/>'
  };
  function eIcon(k) {
    return '<span class="mv-e-st-i" aria-hidden="true">'
         + '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor"'
         + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">'
         + E_ICON[k] + '</svg></span>';
  }

  /* 0 以上の整数だけを通す。ここを抜けた値しか画面に出さないので、
     下の太字タグを esc せずに出しても中身は数字だけになる。 */
  function eNum(v) {
    return (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.floor(v) : null;
  }
  function eStat() { return (state.pay && state.pay.stats) || {}; }

  function eStats() {
    var st = eStat();
    var cards = [
      { n: eNum(st.reports),  l: T.eStRep, u: T.eStRepU, i: 'rep' },
      { n: eNum(st.airlines), l: T.eStAir, u: T.eStAirU, i: 'air' },
      { n: eNum(st.month),    l: T.eStMon, u: T.eStMonU, i: 'mon' }
    ].filter(function (c) { return c.n != null; });
    if (!cards.length) return '';
    return '<div class="mv-e-stats">' + cards.map(function (c) {
      return '<div class="mv-e-st">' + eIcon(c.i) + '<div class="mv-e-st-b">'
           + '<div class="mv-e-st-n">' + esc(String(c.n))
           + (c.u ? '<span class="mv-e-st-u">' + esc(c.u) + '</span>' : '')
           + '</div><div class="mv-e-st-l">' + esc(c.l) + '</div></div></div>';
    }).join('') + '</div>';
  }

  function eBandLine() {
    var st = eStat();
    var n = eNum(st.reports), a = eNum(st.airlines);
    if (n == null) return '';
    return '<p class="mv-e-band-s">' + (a != null ? T.eBand(n, a) : T.eBand1(n)) + '</p>';
  }

  /* まだ給与を出していない人に見せる「出すと見られるもの」（2026-11-11 オーナー「ぼかし入れて、その上からアップロードのボタンでいいだろ」
     「ぼかしのクオリティ低い。ちゃんと作れ」）。
     ★本物の画面と同じ部品（緑のカード・累計の線・支給構成の円・他社の横の棒）を見本の数字で組み、強くぼかす。上には給与フォームと
       同じ「明細から自動入力」のボタンだけ（説明の札や「見本」の字は置かない ── オーナーに却下された）。
     ★見本の数字は作り物で、本人の数字と並ばない（この画面には本人の数字が1つも無い）。読めない強さでぼかし（my-value.css の .mv-peek-in）、
       読み上げから外し（aria-hidden）、押せず（inert）、通貨の書き換えからも外す（pv-no-cur）。 */
  var IC_UPLOAD = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 17v-6"/><path d="m9.5 13.5 2.5-2.5 2.5 2.5"/></svg>';
  function upPay() {
    return '<a class="mv-up" href="' + payHref() + '"><span class="mv-up-t"><span class="mv-up-i">' + IC_UPLOAD + '</span>' + esc(T.psT) + '</span>' +
      '<span class="mv-up-b">' + T.psB.map(function (x) { return '<span><i aria-hidden="true">✓</i>' + esc(x) + '</span>'; }).join('') + '</span></a>';
  }
  function peek(inner, btn) {
    return '<div class="mv-peek"><div class="mv-peek-in pv-no-cur" aria-hidden="true" inert>' + inner + '</div>' +
      '<div class="mv-peek-over">' + btn + '</div></div>';
  }
  function peekPay() {
    var now = new Date(), t = now.getFullYear() * 12 + now.getMonth() - 1;     // 先月まで12か月
    var ymOf = function (k) { var v = t - k; return { y: Math.floor(v / 12), m: v % 12 + 1 }; };
    var a = ymOf(0), b = ymOf(1), z = ymOf(11);
    var green = sec(T.monthOf(T.ym(a.y, a.m)),
      '<div class="mr-hero"><span class="mr-hero-k">' + esc(T.kGross) + '</span><b class="mr-hero-v">¥1,291,638</b>' + pill(pct(6.0)) + '</div>' +
      rlList(rl(T.kNet, '¥836,408') + rl(T.kAnnual, '¥17,599,656') + rl(T.perBlock, '¥22,621', pct(4.1))) +
      '<p class="mr-qty">' + esc(T.mBlockH + ' 57.1h · ' + T.mDutyH + ' 139.6h') + '</p>',
      T.momOf(T.ym(b.y, b.m)), 'is-green');
    var rows = [], cum = [], c0 = 0;
    for (var k = 11; k >= 0; k--) { var q = ymOf(k); rows.push({ period_year: q.y, period_month: q.m }); c0 += 1180000 + ((k * 37) % 9) * 21000; cum.push(c0); }
    var line = V.chart(rows, 'cum', { width: 460, valueAt: function (r, i) { return cum[i]; },
      labelOf: function (r) { return T.ymShort(r.period_year, r.period_month); }, yearOf: function (r) { return r.period_year; },
      endLabel: false, color: '#0a8f79', aria: '' });
    var total = sec(T.total,
      '<div class="mr-total"><b class="mr-total-v">¥' + c0.toLocaleString('en-US') + '</b></div><div class="mr-cum">' + line + '</div>' +
      rlList(rl(T.tAvg, '¥' + Math.round(c0 / 12).toLocaleString('en-US')) + rl(T.tHourly, '¥22,104')),
      T.tSpanOf(T.ym(z.y, z.m), T.ym(a.y, a.m)), 'is-total');
    var opp = sec(T.oppQ(T.cap || ''), barList([
      { name: T.oppMe, sub: T.oppCurAnnual, jpy: 17600000, mod: 'is-me' },
      { name: 'Airline', jpy: 16000000, tag: T.tagMed, mod: 'is-own' },
      { name: 'Airways', jpy: 31000000, tag: T.tagEst, diff: '+' + fmt(13400000) },
      { name: 'Air Lines', jpy: 30500000, tag: T.tagEst, diff: '+' + fmt(12900000) },
      { name: 'Airline Co', jpy: 26800000, tag: T.tagEst, diff: '+' + fmt(9200000) }
    ], 31000000), T.oppSub);
    return peek('<div class="mr-2col">' + green + total + '</div><div class="mr-2col">' + sec(T.breakdown, sampleBreakdown(), T.ym(a.y, a.m)) + opp + '</div>', upPay());
  }
  function renderEmpty() {
    var band =
      '<section class="mr-card mv-e-band">'
      + '<div class="mv-e-band-hd">'
      +   '<span class="mv-e-lk" aria-hidden="true">' + IC_LOCK + '</span>'
      +   '<div class="mv-e-band-b">'
      +     '<h2 class="mv-e-h">' + esc(T.eBandT) + '</h2>' + eBandLine()
      +   '</div>'
      +   '<a class="mv-e-link" href="actual-pay.html">' + esc(T.eBandC) + '</a>'
      + '</div>' + eStats() + '</section>';

    var give = (w.PVGates && w.PVGates.giveGetHTML)
      ? '<section class="mr-card mv-e-give">' + w.PVGates.giveGetHTML() + '</section>' : '';

    /* ★「給与を追加する」の2枚組（匿名で手入力／給与明細から入力）と、
         その下の錠前の注記は 2026-09-07 に廃止した（オーナー指示）。
         同じ画面に ② NEXT ACTION の橙の口と、下の「レポートを作成する →」が
         既に在り、橙の口が3つ並んでいた。入口は上の2つに任せる。 */

    var head = w.PV_MYPAGE_HOST ? ''       // MY PAGE では ③ の見出しが上に在る
      : '<div class="mr-hd"><h1 class="mr-hd-t">' + esc(T.eTitle) + '</h1></div>';

    /* ★2026-11-11 上の「あなたの給与レポート（未作成）」の板は、ぼかした本物の画面＋ボタンに置き換えた（オーナー指示） */
    root.innerHTML = opBar() + head + peekPay() + band + give;
    bindOp();
  }

  /* ── 運営の見本（2026-11-08 オーナー「info@ にも市場レポート出せるようにして。みえないから」）──
     運営（pv_admins）は給与を出していない＝レポートが空になる。偽の給与を本番に入れずに見られるよう、
     作り物の行（my-value-sample.js）で同じ画面を描く。
     ★会員には読み込みもしない（pv_is_admin が true のときだけ）。見出しで作り物だと言う。 */
  async function loadOperator() {
    try {
      var res = await SB.rpc('pv_is_admin');
      if (!res || res.error || res.data !== true) return false;
    } catch (e) { return false; }
    if (!w.PV_VALUE_SAMPLE) {
      await new Promise(function (ok) {
        var el = d.createElement('script');
        el.src = SAMPLE_URL; el.onload = ok; el.onerror = ok;
        d.head.appendChild(el);
      });
    }
    return typeof w.PV_VALUE_SAMPLE === 'function';
  }
  function opBar() {
    if (!state.op) return '';
    return '<div class="pt-tabs mv-op" role="group" aria-label="' + esc(T.opH) + '">' +
      '<b class="mv-op-h">' + esc(T.opH) + '</b>' +
      ['many', 'one', 'hand'].map(function (k) {
        return '<button type="button" class="pt-tab' + (state.sample === k ? ' on' : '') + '" data-sample="' + k + '">' + esc(T.opS[k]) + '</button>';
      }).join('') +
      '<button type="button" class="pt-tab' + (state.sample ? '' : ' on') + '" data-sample="">' +
        esc(state.data && (state.data.reports || []).length ? T.opMine : T.opEmpty) + '</button>' +
      '</div>';
  }
  /* ── 「今月｜1年」（2026-11-08）──────────────────────────────
     開いたときは「今月」＝今までと1文字も変わらない画面。「1年」は my-year.js が描く。 */
  function viewBar() {
    return '<div class="mv-vrow"><div class="pt-tabs mv-view" role="tablist">' +
      ['month', 'year'].map(function (k) {
        return '<button type="button" role="tab" aria-selected="' + (state.view === k) + '" class="pt-tab' + (state.view === k ? ' on' : '') +
          '" data-view="' + k + '">' + esc(k === 'month' ? T.vMonth : T.vYear) + '</button>';
      }).join('') + '</div>' +
      /* 「今月」だけ印刷のボタン（「1年」には自分の PDF のボタンがある） */
      (state.view === 'month' ? '<button type="button" class="mv-tool" data-print aria-label="' + esc(T.prPrintA) + '">' + PRINT_ICON + esc(T.prPrint) + '</button>' : '') +
      '</div>';
  }
  var PRINT_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>';

  /* ── CSV と印刷（2026-11-09・勤務ロスターと分析のタブから呼ぶ）──────────────
     ★CSV は Excel でそのまま開ける形（UTF-8 の BOM・CRLF）。中身はタブが画面に出している数字だけで、行はタブが組む。
       ここは字の包み方と保存だけ（db/test-analysis-ui.mjs がこの関数をそのまま切り出して確かめる）。
       = + - @ で始まる字の欄は、表計算に式と読ませない（' を前に）。
     ★印刷は「いま開いているタブ」の写しだけを body の直下の #pv-print に置いて紙にする（printYear と同じやり方。
       隠れているタブ・タブの帯・操作の部品・サイトの枠は紙に出ない）。図は画面に描いたまま。 */
  function csvText(rows) {
    var cell = function (v) {
      if (v == null) return '';
      if (typeof v === 'number') return isFinite(v) ? String(v) : '';
      var t = String(v);
      if (/^[=+\-@\t\r]/.test(t) && !/^[+\-]?\d+(\.\d+)?$/.test(t)) t = "'" + t;
      return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, function () { return '""'; }) + '"' : t;
    };
    return '\uFEFF' + rows.map(function (r) { return (r || []).map(cell).join(','); }).join('\r\n') + '\r\n';
  }
  function saveCsv(name, rows) {
    var safe = String(name || 'pilot-value').replace(/[^A-Za-z0-9._-]/g, '_') + '.csv';
    try {
      var url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }));
      var a = d.createElement('a');
      a.href = url; a.download = safe; a.rel = 'noopener'; a.style.display = 'none';
      d.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1000);
    } catch (e) {}
  }
  /* 紙に出さない操作の部品（選ぶ欄は選んでいる字に置き換えてから外す） */
  var PR_DROP = '.mv-vrow,.mv-op,.mv-remind,.an-tools,.an-btn,.an-link,.an-ask,.an-tip,.an-thr input,.an-thr-ax,.an-need,' +
    '.rs-hd-r,.rs-resel,.rs-tip,.rs-docs,.rs-upbox,.rs-entry,.rs-flash,.rs-hint,.mv-wf-tip,.pt-btn,.mr-mask-over,#mr-ref-slot,input,textarea';
  function printPane(period) {
    var src = panes && panes[state.tab];
    if (!src) return;
    var old = d.getElementById('pv-print');
    if (old) old.parentNode.removeChild(old);
    var wrap = d.createElement('div');
    wrap.id = 'pv-print';
    var scope = d.createElement('div');
    scope.id = 'pv-value';                         // 見た目の規則（#pv-value …）をそのまま効かせる
    scope.className = 'pv-no-cur pv-pr';
    var t = d.createElement('p');
    t.className = 'pv-pr-t';
    t.textContent = ['YOUR PAY', { summary: T.tabSum, roster: T.tabRoster, analysis: T.tabAna, settings: T.tabSet }[state.tab], period].filter(Boolean).join(' · ');
    scope.appendChild(t);
    var c = src.cloneNode(true);
    c.hidden = false; c.removeAttribute('id');
    var ss = src.querySelectorAll('select'), cs = c.querySelectorAll('select');
    for (var i = 0; i < cs.length; i++) {
      var o = ss[i] && ss[i].options[ss[i].selectedIndex];
      var sp = d.createElement('span');
      sp.className = 'pv-pr-sel';
      sp.textContent = o ? o.text : '';
      cs[i].parentNode.replaceChild(sp, cs[i]);
    }
    Array.prototype.forEach.call(c.querySelectorAll(PR_DROP), function (x) { if (x.parentNode) x.parentNode.removeChild(x); });
    /* 切り替えは、選んでいるものだけを見出しの字として残す（何を見ている紙か分かるように） */
    Array.prototype.forEach.call(c.querySelectorAll('.pt-tabs > :not(.on), .an-segs > :not([aria-pressed="true"])'), function (x) { x.parentNode.removeChild(x); });
    scope.appendChild(c);
    wrap.appendChild(scope);
    d.body.appendChild(wrap);
    d.documentElement.classList.add('pv-printing');
    var done = function () {
      d.documentElement.classList.remove('pv-printing');
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      w.removeEventListener('afterprint', done);
    };
    w.addEventListener('afterprint', done);
    w.print();
    setTimeout(done, 1000);                        // afterprint を出さない端末でも写しを残さない
  }
  function bindView() {
    var pb = root.querySelector('[data-print]');
    if (pb) pb.addEventListener('click', function () {
      var r = state.rows[state.rows.length - 1];
      var p = r ? T.prMonth.replace('{t}', function () { return T.ym(r.period_year, r.period_month); }) : '';
      // 作成日は画面から外した（2026-11-11）。紙の見出しにだけ載せる
      if (r && r.created_at) p += ' · ' + T.kUpdated + ' ' + T.date(r.created_at);
      printPane(p);
    });
    root.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-view');
        if (v === state.view) return;
        state.view = v;
        render();
      });
    });
  }
  var yearLoading = null;
  function loadYear() {
    if (w.PVYear) return Promise.resolve(true);
    if (!yearLoading) {
      yearLoading = new Promise(function (ok) {
        var el = d.createElement('script');
        el.src = YEAR_URL; el.onload = function () { ok(!!w.PVYear); }; el.onerror = function () { ok(false); };
        d.head.appendChild(el);
      });
    }
    return yearLoading;
  }
  /* ── MY PAY｜MY PAGE のタブ（2026-11-09 オーナー「mypage と my pay でタブ分けない？」）──────────
     ★作るのはこの JS（日英西で1本）。HTML の骨組みはそのまま＝この JS が落ちても今までの縦並びで全部見える。
     ★2026-11-12 オーナー「最初に表示させるのは MY PAY。タブの順番は MY PAY が先で次に MY PAGE」。
       住所に印が無ければ MY PAY。MY PAGE で開くのは #my-page か、MY PAGE の中の場所を指す印
       （#pay-tracker・#edit-card・#password-card など ── 昔からの行き先を死なせない）。
       押したら住所の印を替える（履歴は積まない）＝読み込み直しても同じ面のまま。
     ★MY PAY が閉じている間は図を描かない（幅0で描くと崩れたまま残る）。開いたときに今の小タブを描き直す。 */
  var PAGES = ['pay', 'page'];
  var pg = { on: false, cur: 'pay', panes: null };
  /* 住所の印 → 開く面。分からない印（ページの外の名前・#）は null ＝ 今の面のまま */
  function hashPage() {
    var h = location.hash;
    if (!h || h === '#') return null;
    if (h === '#your-pay') return 'pay';
    if (h === '#my-page') return 'page';
    var t = null;
    try { t = d.getElementById(decodeURIComponent(h.slice(1))); } catch (e) {}
    if (!t || !pg.panes) return null;
    return pg.panes.page.contains(t) ? 'page' : pg.panes.pay.contains(t) ? 'pay' : null;
  }
  function payShown() { return !pg.on || pg.cur === 'pay'; }
  function sumShown() { return state.tab === 'summary' && payShown(); }
  function pageTabs() {
    var main = w.PV_MYPAGE_HOST ? host.closest('main') : null;
    var pay = d.getElementById('your-pay');
    if (!main || !pay || pay.parentNode !== main || main.querySelector('.mp-tabs')) return;
    var bar = d.createElement('div');
    bar.className = 'mp-tabs';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', T.pgAria);
    bar.innerHTML = PAGES.map(function (k) {
      return '<button type="button" role="tab" class="mp-tab" id="mp-tab-' + k + '" data-pg="' + k +
        '" aria-controls="mp-pane-' + k + '" aria-selected="false" tabindex="-1">' + esc(k === 'pay' ? T.pgPay : T.pgPage) + '</button>';
    }).join('');
    pg.panes = {};
    PAGES.forEach(function (k) {
      var p = d.createElement('div');
      p.className = 'mp-pane';
      p.id = 'mp-pane-' + k;
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', 'mp-tab-' + k);
      pg.panes[k] = p;
    });
    /* main の子を順番のまま2つの面へ移す（#your-pay だけ MY PAY・ほかは MY PAGE） */
    Array.prototype.slice.call(main.children).forEach(function (el) {
      (el === pay ? pg.panes.pay : pg.panes.page).appendChild(el);
    });
    main.appendChild(bar);
    main.appendChild(pg.panes.pay);
    main.appendChild(pg.panes.page);
    main.classList.add('mp-tabbed');
    pg.on = true;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.mp-tab') : null;
      if (b) setPage(b.getAttribute('data-pg'), false, true);
    });
    bar.addEventListener('keydown', function (e) {
      var i = PAGES.indexOf(pg.cur), j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % PAGES.length;
      else if (e.key === 'ArrowLeft') j = (i + PAGES.length - 1) % PAGES.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = PAGES.length - 1;
      if (j == null) return;
      e.preventDefault();
      setPage(PAGES[j], true, true);
    });
    w.addEventListener('hashchange', function () { var k = hashPage(); if (k) setPage(k); });
    setPage(hashPage() || 'pay');
  }
  function setPage(k, focus, byUser) {
    if (!pg.on || PAGES.indexOf(k) < 0) return;
    pg.cur = k;
    d.querySelectorAll('.mp-tab').forEach(function (b) {
      var on = b.getAttribute('data-pg') === k;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    PAGES.forEach(function (t) { pg.panes[t].hidden = t !== k; });
    if (byUser) {
      try {
        var now = hashPage() || (location.hash && location.hash !== '#' ? null : 'pay');
        if (now !== k) {
          history.replaceState(history.state, '', location.pathname + location.search + (k === 'pay' ? '#your-pay' : '#my-page'));
        }
      } catch (e) {}
    }
    if (k !== 'pay') { if (w.PVGlobe) w.PVGlobe.hide(); return; }
    /* 開いたとき：隠れている間に描きそびれた面を描き直す */
    if (state.tab === 'summary' && state.sumDirty) { state.sumDirty = false; render(); }
    else if (state.tab === 'roster' && w.PVRoster && w.PVRoster.redraw) { w.PVRoster.redraw(); if (w.PVGlobe) w.PVGlobe.show(); }
    else if (state.tab === 'analysis' && w.PVAnalysis && w.PVAnalysis.redraw) w.PVAnalysis.redraw();
  }

  /* ── YOUR PAY の3つのタブ（2026-11-09 オーナー「給与サマリー｜勤務ロスター｜分析」）──────────
     ★期間の切り替え（今月｜1年）は給与サマリーの中に残す。用途のタブと混ぜない（形も違える）。
     ★面は消さずに隠すだけ＝タブを移っても、選んだ月・日はそのまま。
       隠れた面には図を描かない（幅0で描くと崩れたまま残る）。見えたときに描き直す。
     ★勤務ロスターの部品は、そのタブを開いたときだけ読む（会員の大多数は通信が増えない）。 */
  var TABS = ['summary', 'roster', 'analysis', 'settings'];     // ★2026-11-11 設定（提出したものを直す・消す）を足した
  var panes = null;
  function tabText(k) {
    var full = { summary: T.tabSum, roster: T.tabRoster, analysis: T.tabAna, settings: T.tabSet }[k];
    var short = { summary: T.tabSumS, roster: T.tabRosterS, analysis: T.tabAnaS, settings: T.tabSetS }[k];
    return '<span class="mv-tab-l">' + esc(full) + '</span><span class="mv-tab-s" aria-hidden="true">' + esc(short) + '</span>';
  }
  function shell() {
    if (panes) return;
    host.innerHTML = '<div class="mv-tabs" role="tablist" aria-label="' + esc(T.tabsAria) + '">' +
        TABS.map(function (k) {
          var on = k === state.tab;
          return '<button type="button" role="tab" class="mv-tab' + (on ? ' on' : '') + '" id="mv-tab-' + k + '" data-tab="' + k +
            '" aria-controls="mv-pane-' + k + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '">' + tabText(k) + '</button>';
        }).join('') + '</div>' +
      TABS.map(function (k) {
        return '<div class="mv-pane" id="mv-pane-' + k + '" role="tabpanel" aria-labelledby="mv-tab-' + k + '"' + (k === state.tab ? '' : ' hidden') + '></div>';
      }).join('');
    panes = {};
    TABS.forEach(function (k) { panes[k] = d.getElementById('mv-pane-' + k); });
    root = panes.summary;
    /* 分析は開いたときに my-analysis.js が #pv-analysis を埋める */
    panes.analysis.innerHTML = '<div id="pv-analysis"></div>';
    /* ★2026-11-11 設定タブ：MY PAGE の「あなたが出したもの」（profile.html の #my-reviews-card・給与の編集と削除・口コミの一覧）を
         ここへ移す。中身を描くのは今までどおり profile.html の JS（id で探すので、置き場所が変わっても同じに動く）。
         置き場所は1つ＝MY PAGE からは消える。スケジュールの提出資料は開いたときに my-roster.js が描く（mountDocs）。 */
    panes.settings.innerHTML = '<div class="mv-set"><div class="mv-set-posts"></div><div class="mv-set-docs"></div></div>';
    var mine = d.getElementById('my-reviews-card');
    if (mine) panes.settings.querySelector('.mv-set-posts').appendChild(mine);
    var bar = host.querySelector('.mv-tabs');
    bar.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.mv-tab') : null;
      if (b) setTab(b.getAttribute('data-tab'));
    });
    /* キーボード：左右で隣のタブへ・Home/End で端へ（WAI-ARIA のタブの決まり） */
    bar.addEventListener('keydown', function (e) {
      var i = TABS.indexOf(state.tab), j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
      else if (e.key === 'ArrowLeft') j = (i + TABS.length - 1) % TABS.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = TABS.length - 1;
      if (j == null) return;
      e.preventDefault();
      setTab(TABS[j], true);
    });
  }
  function setTab(k, focus) {
    if (!panes || TABS.indexOf(k) < 0) return;
    state.tab = k;
    host.querySelectorAll('.mv-tab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === k;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    TABS.forEach(function (t) { panes[t].hidden = t !== k; });
    if (k === 'summary' && state.sumDirty && payShown()) { state.sumDirty = false; render(); }
    if (k === 'roster') openRoster().then(function (ok) { if (ok) openGlobe(); });
    else if (w.PVRoster && w.PVRoster.hide) w.PVRoster.hide();
    if (k !== 'roster' && w.PVGlobe) w.PVGlobe.hide();
    if (k === 'analysis') openAnalysis();
    else if (w.PVAnalysis && w.PVAnalysis.hide) w.PVAnalysis.hide();
    if (k === 'settings') openSettings();
    try { host.dispatchEvent(new CustomEvent('pv-myreport-tab', { bubbles: true, detail: { tab: k } })); } catch (e) {}
  }

  /* 計算の部品。空港のタイムゾーンの表も一緒に読む（読めなくても計算は動く＝現地時刻の便の時間が出ないだけ） */
  function engineJs() {
    return Promise.all([lateJs(LATE.airportTz, function () { return !!w.PV_AIRPORT_TZ; }).then(null, function () { return false; }),
                        lateJs(LATE.engine, function () { return !!w.PVReport; })]).then(function (r) { return r[1]; });
  }
  /* 後から読む部品（同じものを2回読まない） */
  var late = {};
  function lateJs(src, ready) {
    if (ready()) return Promise.resolve(true);
    if (!late[src]) {
      late[src] = new Promise(function (ok) {
        var el = d.createElement('script');
        el.src = src;
        el.onload = function () { ok(!!ready()); };
        el.onerror = function () { delete late[src]; ok(false); };
        d.head.appendChild(el);
      });
    }
    return late[src];
  }
  function lateCss(href) {
    if (!late[href]) {
      late[href] = new Promise(function (ok) {
        var el = d.createElement('link');
        el.rel = 'stylesheet'; el.href = href;
        el.onload = function () { ok(true); };
        el.onerror = function () { delete late[href]; ok(false); };
        d.head.appendChild(el);
      });
    }
    return late[href];
  }
  var rosterMounted = false;
  function openRoster(quiet) {
    if (rosterMounted) { if (!quiet) w.PVRoster.show(); return Promise.resolve(true); }
    if (!panes.roster.firstChild) panes.roster.innerHTML = '<div class="mr-skel" style="height:220px"></div>';
    /* 見た目が届いてから描く（素の字が一瞬覆わない）。計算の部品 → 画面の部品の順 */
    return Promise.all([lateCss(LATE.rosterCss), engineJs()])
      .then(function (r) { return r[0] && r[1] ? lateJs(LATE.roster, function () { return !!w.PVRoster; }) : false; })
      .then(function (ok) {
        if (rosterMounted) return true;            // 同時に2回呼ばれた（タブと設定）＝もう載っている
        if (!ok) { panes.roster.innerHTML = empty(T.rosterErr); return false; }
        rosterMounted = true;
        w.PVRoster.mount(panes.roster, {
          sb: SB,
          reports: (state.data && state.data.reports) || [],   // ★運営の見本は渡さない（会社を決めるのは本人の行だけ）
          urls: { upload: LATE.upload, airlines: LATE.airlines },
          csv: saveCsv, print: printPane
        });
        if (state.tab === 'roster') w.PVRoster.show(); else w.PVRoster.hide();
        if (rosterWant) { w.PVRoster.open(rosterWant); rosterWant = null; }
        return true;
      });
  }
  /* 「飛んだルート」の地球儀（2026-11-12）── スケジュールのタブの一番上。タブを開いたときだけ読む
     （見た目 → 空港の位置・陸地の点・計算の部品 → 画面）。読めなければ黙って出さない（スケジュールは今のまま）。
     取り込みの画面を開いている間は CSS が隠す（my-globe.css）。 */
  var globeMounted = false, globeLoading = false;
  function openGlobe() {
    if (globeMounted) { if (state.tab === 'roster' && payShown()) w.PVGlobe.show(); return; }
    if (globeLoading || !w.PVRoster || !panes.roster) return;
    globeLoading = true;
    Promise.all([lateCss(LATE.globeCss), engineJs(),
                 lateJs(LATE.airportGeo, function () { return !!w.PV_AIRPORT_GEO; }),
                 lateJs(LATE.globeLand, function () { return !!w.PV_GLOBE_LAND; })])
      .then(function (r) { return r[0] && r[1] && r[2] && r[3] ? lateJs(LATE.globe, function () { return !!w.PVGlobe; }) : false; })
      .then(function (ok) {
        globeLoading = false;
        if (!ok || globeMounted) return;
        globeMounted = true;
        var box = d.createElement('div');
        box.id = 'pv-globe';
        panes.roster.insertBefore(box, panes.roster.firstChild);
        w.PVGlobe.mount(box, {
          sb: SB,
          reports: (state.data && state.data.reports) || [],   // ★運営の見本は渡さない（本人の行だけ）
          items: reportItems,
          current: function () { return w.PVRoster && w.PVRoster.current ? w.PVRoster.current() : null; }
        });
        if (state.tab === 'roster' && payShown()) w.PVGlobe.show(); else w.PVGlobe.hide();
      }, function () { globeLoading = false; });
  }
  /* 設定タブ（2026-11-11）。給与と口コミの一覧は shell() で移してある。スケジュールの提出資料はロスターの部品を読んでから描く。
     まだ給与を出していない人には、一覧の下に「明細から自動入力」を置く（空の画面の上のボタンと同じもの）。 */
  var setMounted = false;
  function openSettings() {
    if (setMounted) return;
    setMounted = true;
    var rows = (state.data && state.data.reports) || [];
    if (!rows.length && !state.sample) panes.settings.querySelector('.mv-set-posts').insertAdjacentHTML('beforeend', '<div class="mv-set-cta">' + upPay() + '</div>');
    var box = panes.settings.querySelector('.mv-set-docs');
    box.innerHTML = '<div class="mr-skel" style="height:120px"></div>';
    openRoster(true).then(function (ok) {
      if (!ok || !w.PVRoster || !w.PVRoster.mountDocs) { box.innerHTML = ''; return; }
      w.PVRoster.mountDocs(box, { upload: function () { gotoRoster({ upload: true }); } });
    }, function () { box.innerHTML = ''; });
  }
  /* 分析のタブから勤務ロスターへ（点を押した日・「ロスターを足す」）。ロスターの部品が届いてから渡す */
  var rosterWant = null;
  function gotoRoster(o) {
    setPage('pay');
    setTab('roster');
    if (rosterMounted && w.PVRoster && w.PVRoster.open) w.PVRoster.open(o);
    else rosterWant = o;
    try { host.scrollIntoView({ behavior: 'auto', block: 'start' }); } catch (e) {}
  }

  /* ── 「分析」のタブ（2026-11-09）── 開いたときだけ読む（見た目 → 計算の部品 → 画面） ── */
  var anaMounted = false;
  function openAnalysis() {
    if (anaMounted) { w.PVAnalysis.show(); return; }
    var box = d.getElementById('pv-analysis') || panes.analysis;
    if (!box.firstChild) box.innerHTML = '<div class="mr-skel" style="height:220px"></div>';
    Promise.all([lateCss(LATE.analysisCss), engineJs()])
      .then(function (r) { return r[0] && r[1] ? lateJs(LATE.analysis, function () { return !!w.PVAnalysis; }) : false; })
      .then(function (ok) {
        if (anaMounted) return;
        if (!ok) { box.innerHTML = empty(T.anaErr); return; }
        anaMounted = true;
        w.PVAnalysis.mount(box, {
          sb: SB,
          reports: (state.data && state.data.reports) || [],   // ★運営の見本は渡さない（本人の行だけ）
          items: reportItems, segName: SEGNAME, goto: gotoRoster, csv: saveCsv, print: printPane
        });
        if (state.tab === 'analysis') w.PVAnalysis.show(); else w.PVAnalysis.hide();
      });
  }

  function renderYear(rows) {
    state.rows = rows;
    /* ★累計報酬（2026-11-09 オーナー「1年の累計報酬のカードとか消えてる」→「両方やる」）。
         「今月」と同じカードを年のまとめの上に置く（全社ぶん・足し方は totals()）。PDF（#pv-year の写し）には入れない。 */
    /* 見出しの行（会社・機種・職位＋「今月｜1年」）は「今月」と同じ＝切り替えても同じ場所に居る */
    /* ★2026-11-11 累計報酬は1年のカードと同じ2列の並びの1枚目（my-year.js の lead）。1年の部品が届く前もそこに置いておく */
    root.innerHTML = opBar() + header(state.data || {}, rows[rows.length - 1], rows) +
      '<div class="mr-stack"><div id="pv-year-box"><div class="yr yr-g">' + lifetime(rows) + '</div></div></div>';
    drawCumChart();                        // 実寸が要るので DOM に入れてから
    bindOp();
    bindView();
    if (!w.PVYear) {
      loadYear().then(function (ok) { if (ok && state.view === 'year') render(); });
      return;
    }
    /* 月をまたぐ比較と同じく、最新の会社の月だけ（会社が変われば契約が違う） */
    w.PVYear.render(d.getElementById('pv-year-box'), sameAirline(rows, rows[rows.length - 1]), {
      segName: SEGNAME, sample: !!state.sample,
      lead: function () { return lifetime(rows); }, onDraw: drawCumChart,
      /* 会社の会員の単価と折れ目（db/company-rates.sql・2人以上の組だけ・人数は返らない）。
         口がまだ無い（SQL を貼る前）・失敗したときは null ＝本人の数字だけで描く。見本のときは作り物を返す。 */
      company: function (airline) {
        if (state.sample) return Promise.resolve(w.PV_VALUE_SAMPLE_COMPANY || null);
        return Promise.all([SB.rpc('pv_company_rates', { p_airline: airline }), SB.rpc('pv_company_kink', { p_airline: airline })])
          .then(function (r) {
            var ok = function (x) { return x && !x.error && Array.isArray(x.data) ? x.data : []; };
            return { rates: ok(r[0]), kink: ok(r[1]) };
          }, function () { return null; });
      }
    });
  }

  function bindOp() {
    root.querySelectorAll('[data-sample]').forEach(function (b) {
      b.addEventListener('click', function () { state.sample = b.getAttribute('data-sample') || null; render(); });
    });
  }

  function render() {
    var dat = state.data;
    if (!dat) return;
    paintRemind(dat);                      // ★0 件で戻る前に描く（設定は件数と無関係）
    shell();                               // タブの骨組み（1回だけ）。ここから root は給与サマリーの面
    if (!sumShown()) { state.sumDirty = true; return; }   // 隠れた面に図を描かない（MY PAY が閉じているときも）
    var rows = (state.sample && w.PV_VALUE_SAMPLE) ? w.PV_VALUE_SAMPLE(state.sample) : (dat.reports || []);
    if (!rows.length) return renderEmpty();
    if (state.view === 'year') return renderYear(rows);
    var r = rows[rows.length - 1];
    state.series = sameAirline(rows, r);   // 月をまたぐ比較はこの会社の中だけ
    state.rows = rows;                     // 累計だけは全社ぶんを足す
    var m = mom(rows);

    /* ★ 並びは「今月（緑）｜累計 → 構成｜前回との差 → 他社 → 次」。
       ★2026-11-11 オーナー「今月の実績を緑のカード・白い字に」── 色のついたカードは今月の1枚だけにして先頭へ
         （PC は左上、スマホは一番上）。累計は白いカードでその右。
       ★ 上段は「今月」と「累計」を横に並べる（.mr-2col）。
         縦に積むと2枚で 1,072px＝最初の画面が累計だけで終わる。横に置くと
         実測でどちらも同じくらいの高さになり、開いた瞬間に
         「これまで」と「今月」が同時に目に入る。
       ★ 2段目は「支給構成」を今月の真下（左）に、「前回の明細との差」をその右に。
         どちらも今月1枚の中を見る話なので、縦に離すと関係が切れる。
         自分の明細を読み終えてから外（機会）を見る、という順にする。
       ★ どちらの段も、幅が足りない画面では自動で縦に落ちる
         （CSS 側。メディアクエリではなく flex-basis で決めている）。 */
    var wy = why(rows, m);                 // 給与が変わった理由（検算が通らなければ前回の明細との差）
    root.innerHTML =
      opBar() +
      header(dat, r, rows) +
      '<div class="mr-stack">' +
        '<div class="mr-2col">' + thisMonth(r, m) + lifetime(rows) + '</div>' +
        '<div class="mr-2col">' + breakdown(r) + wy.card + '</div>' + wy.table +
        opportunity(r) +
        next(dat, rows, r) +
      '</div>';

    drawCumChart();                        // 実寸が要るので DOM に入れてから
    bind();
    bindOp();
    bindView();
    if (state.sample) return;              // 見本のときは招待カードを出さない（運営の区分は無い）

    /* 招待（データ密度）カード。★ここが落ちてもレポートには一切触らない。
       中身を決めるのはサーバの my_cohort_gap() で、n≦2 のときは
       返り値に数字が1つも無い（＝画面に人数が出しようがない）。
       pv-referral.js 側で1ページ1回しか引かない（render は通貨切替のたびに走る）。 */
    try {
      if (w.PVReferral) w.PVReferral.mountCohort(d.getElementById('mr-ref-slot'), {
        sb: SB, surface: 'my_value', variant: 'card' });
    } catch (e) {}
  }

  function bind() {
    bindRemind(root);                      // ★差込口の側は paintRemind が繋いでいる
  }

  async function toggleRemind() {
    if (state.busy || !state.data) return;
    state.busy = true;
    var nextOn = !remindOn(state.data);
    var hint = d.getElementById('mv-remind-hint');
    try {
      var res = await SB.rpc('set_mail_optin', { p_on: nextOn });
      if (res.error) throw res.error;
      /* 親（email_opt_in）はサーバが立てる（set_mail_optin はオン時に一緒に立てる）。
         こちらから推測で書かず、返ってきた値をそのまま入れる。 */
      var got = res.data || {};
      state.data.mail_optin = (got.mail_optin != null) ? !!got.mail_optin : nextOn;
      /* ★同じ画面に親のスイッチ（メール通知 全般 ＝ email_opt_in）がある。
           リマインドをオンにするとサーバ側で親も立つので、それを伝えないと
           「実際はオンなのに、親だけオフのまま」の画面が残る。
           2026-09-06 に pay-tracker.js から引き取った（あちらは削除）。 */
      if (got.email_opt_in != null) {
        state.data.email_opt_in = !!got.email_opt_in;
        if (typeof w.PVOptInSync === 'function') w.PVOptInSync(!!got.email_opt_in);
      }
      render();
    } catch (e) {
      if (hint) hint.textContent = T.remindErr;
    } finally { state.busy = false; }
  }

  /* 各社の額を読む（推定年収と、会社ページと同じ決まり medRule）。
     ★ salary-data.json は世界に公開しているファイルなので、読むだけで
       誰が読んだかは残らない（本人の記録は一切ここへ渡さない）。 */
  async function loadPub() {
    /* よく見られている会社の順は、他社のランキングで地域ごとの会社を選ぶのに使う。読めなければ年収の順だけで選ぶ */
    var pop = fetch(POP_URL).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return (j && Array.isArray(j.slugs)) ? j.slugs : []; }, function () { return []; });
    try {
      var res = await fetch(PUB_URL);
      if (!res.ok) return null;
      var j = await res.json();
      return (j && j.airlines) ? { A: j.airlines, R: j.medRule || {}, P: await pop } : null;
    } catch (e) { return null; }        // 読めなくてもレポート本体は出す
  }

  /* 会員の中央値（全社ぶん）。サーバーは書き込みのときに数えて保存した表を引くだけ
     （db/member-median.sql）。2人以上の組だけ・人数は返さない。
     ★口がまだ無い（SQL を貼る前）・失敗したときは null ＝ 書き込んである額のまま比べる。 */
  async function loadMeds() {
    try {
      var res = await SB.rpc('pv_member_medians_all');
      if (!res || res.error || !Array.isArray(res.data)) return null;
      var out = {};
      res.data.forEach(function (x) {
        var m = x && num(x.median_man), k = x && String(x.airline || '').toLowerCase();
        if (!k || !(m > 0) || (x.rank !== 'cap' && x.rank !== 'fo')) return;
        (out[k] = out[k] || {})[x.rank] = m;
      });
      return out;
    } catch (e) { return null; }
  }

  /* 見出しの呼び名だけを取りに行く。★ profiles を select('*') しない
     （生年月日・国・所属まで持ってきて、名前1つのために全部をこのページに置くことになる）。
     取れなくてもレポートは出す＝「あなたの報酬レポート」に落ちるだけ。 */
  async function loadName(sess) {
    var uid = sess && sess.user && sess.user.id;
    if (!uid) return '';
    try {
      var res = await SB.from('profiles').select('name').eq('id', uid).maybeSingle();
      return (res && !res.error && res.data && res.data.name) ? String(res.data.name) : '';
    } catch (e) { return ''; }
  }

  /* 数え上げだけを取りに行く。取れなくても画面は出す
     （帯の1行と数字カードが消えるだけ ── 0 を並べない）。 */
  async function loadPayStats() {
    try {
      var res = await SB.rpc('pv_pay_rows');
      if (!res || res.error || !res.data || res.data.ok !== true) return null;
      return res.data;
    } catch (e) { return null; }
  }

  async function load() {
    /* ページ側がセッションを確かめてからにする。未ログインだと my_pay_reports() は
       42501 で落ちるので、エラー枠を出す前にログインへ送られる（HTML の PV_SESSION）。 */
    var sess = null;
    if (w.PV_SESSION) { try { sess = await w.PV_SESSION; if (!sess) return; } catch (e) { return; } }
    /* 招待リンクから来てここまで辿り着いた人を紹介者に結びつける。冪等なので
       他の3か所（profile / pay-report ×2）と重なっても害は無い。
       ★失敗してもレポートは止めない。 */
    try { if (w.PVReferral && !w.PV_HOST_CLAIMED) await w.PVReferral.claim(SB); } catch (e) {}
    /* 匿名で出した給与データの預かり証を拾う（最後の網。profile.html:477 と同じ実体）。
       ★my_pay_reports() より **前**。引き取りに成功すると submit_pay_report が走って
         その1件が本人のものになるので、直後に引く一覧に最初から載る。
         後ろに置くと、1回目だけ「出したのに無い」画面が出る。
       ★takeFromUrl() を自分で呼ばない ── sweep() が中で先に呼んでいる。
       ★失敗しても画面は止めない（profile.html と同じ扱い）。 */
    try { if (w.PVClaimPending && !w.PV_HOST_CLAIMED) await w.PVClaimPending.sweep(SB); } catch (e) {}
    /* ★問い合わせは pv-reunlock.js のキャッシュを通す。直に rpc を投げない。
         MY PAGE では ①②③④ と待遇の二次導線が同じ my_pay_reports() を要る。
         それぞれが投げると1画面で4本になる（画面は普通に動いたまま通信だけ増える）。
       ★PV_HOST_CLAIMED が立っているとき＝ host 側が claim → sweep → 問い合わせまで
         済ませている。ここで来るのは、その答えの写し。 */
    var res;
    try {
      res = (typeof w.pvMyPayReports === 'function')
        ? { data: await w.pvMyPayReports(SB) }
        : await SB.rpc('my_pay_reports');
    } catch (e) { res = { error: e }; }
    if (!res || res.error || !res.data) { paintRemind(null); root.innerHTML = empty(T.err); return; }
    state.data = res.data;
    /* ★左メニューの錠前は localStorage の写しで暫定的に出ている。
         ここはサーバの access_until を持っているので、そちらで上書きする
         （別の端末で初めて開いた人でも、正しい錠前になる）。 */
    if (w.PVGates && w.PVGates.mark) {
      var au = state.data.access_until ? Date.parse(state.data.access_until) : 0;
      w.PVGates.mark(!!au && Date.now() < au);
    }
    var rows = state.data.reports || [];
    if (rows.length) {
      /* ★運営かどうかも同時に聞く（2026-11-09）。前は「自分の行が0件」のときだけ聞いていたので、
           運営が自分の明細を出した日から見本の切り替えが消えた。会員には pv_is_admin が false を返す1本だけ増える。 */
      var got = await Promise.all([loadPub(), loadMeds(), loadOperator()]);
      state.pub = got[0];
      state.meds = got[1];
      state.op = got[2];
    } else {
      /* ★まだ1件も出していない人のときだけ、数え上げを取りに行く。
           pv_pay_rows() は鍵が無くても stats（件数・社数・直近1ヶ月ぶん・出した人数）と
           give（本人が何を出したか）を返す。行は 1 件も返らない。
         ★出した人には引かない。この画面は行を必要としないのに、
           鍵を持つ人には全行が付いてくるため。 */
      state.pay = await loadPayStats();
      state.op = await loadOperator();
      if (state.op) {
        var got0 = await Promise.all([loadPub(), loadMeds()]);
        state.pub = got0[0];
        state.meds = got0[1];
      }
      if (w.PVGates && w.PVGates.setProgress && state.pay) {
        w.PVGates.setProgress({
          n: state.pay.stats ? state.pay.stats.contributors : null,
          detailed: state.pay.give ? state.pay.give.detailed : null
        });
      }
    }
    state.name = await loadName(sess);
    render();
  }

  /* 親（メール通知 全般 ＝ email_opt_in）が切られたら、子のリマインドも切れる。
     切るのは DB のトリガー profiles_mail_consent_sync（db/pay-reminder.sql）なので、
     画面はその結果に合わせるだけ。★ここで RPC を呼び直さない
     ＝画面の都合でもう一度書きに行くと、真の値がどちらか分からなくなる。
     2026-09-06 に pay-tracker.js:440 からそのまま引き取った（あちらは削除）。 */
  w.PVRemindSync = function (parentOn) {
    if (!state.data) return;
    state.data.email_opt_in = !!parentOn;
    if (!parentOn) state.data.mail_optin = false;
    render();
  };

  // 通貨を切り替えたら SVG の中の数字も追随させる（自動スキャンは届かない）
  w.addEventListener('pv-currency-change', function () { if (state.data) render(); });

  // 幅が変わったら折れ線を組み直す（viewBox を伸ばさない代わり）
  var rt = null;
  w.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (state.tab === 'roster' && payShown()) { if (w.PVRoster && w.PVRoster.redraw) w.PVRoster.redraw(); }
      if (!state.rows.length) return;
      if (!sumShown()) { state.sumDirty = true; return; }   // 見えたときに描き直す
      if (state.view === 'year') { if (w.PVYear) w.PVYear.redraw(); drawCumChart(); return; }
      drawCumChart();
    }, 160);
  });

  pageTabs();
  load();
}(window, document));
