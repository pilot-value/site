/* ════════════════════════════════════════════════════════════════
   my-value.js — マイレポート（明細を出した人に返すもの）

   my-value.html / en/my-value.html の #pv-value に載る。
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

  var root = d.getElementById('pv-value');
  if (!root) return;

  var SB = null;
  try { SB = sb; } catch (e) { SB = null; }
  if (!SB) return;

  var V = w.PVViz;
  if (!V) return;                       // 読み込み順が崩れたら黙って出さない
  var esc = V.esc, num = V.num, fmt = V.fmt;

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* 掲載額（salary-data.json）の在り処。★ ページ相対で書くと /en/ から
     /en/salary-data.json を見に行って 404 になる（英語版は1枚も無い）。
     このスクリプト自身の URL を基準に解くとルート直下を指す
     ＝ salary-leveling.js と同じやり方。currentScript は同期実行中しか
     取れないので、ここ（IIFE の冒頭）で確定させる。 */
  var PUB_URL = 'salary-data.json';
  try {
    var _self = (d.currentScript && d.currentScript.src) || '';
    if (_self) PUB_URL = new URL('salary-data.json', _self).href;
  } catch (e) {}

  var T = {
    ja: {
      /* 見出し。★「市場価値」とは言わない（順位ではなく本人の記録が主語）。
         名前が取れたら「◯◯さんの報酬レポート」。取れなければ「あなたの」に落とす
         （プロフィール未入力の人に空欄の「さん」を出さない）。 */
      titleOf: function (nm) { return (nm ? nm + 'さん' : 'あなた') + 'の報酬レポート'; },
      leadNew: '出してもらった明細から作りました。記録した実データに基づく、あなた専用の報酬インサイトです。',
      lead: '記録した実データに基づく、あなた専用の報酬インサイト。月を重ねるほど濃くなります。',
      unlockOn: function (n) { return '解放中 ' + n + '日'; },
      unlockOff: '未解放',
      kAirline: '会社', kFleet: '機種', kPos: '職位', kBase: 'ベース',
      /* ★「使った明細」にすると、下の数字が全部の平均に見える。実際は最新1枚から
         作っていて、枚数が効くのは累計と推移だけ。数えたものの名前で言う。 */
      kMonth: '対象月', kUpdated: '作成日', kSheets: '記録した明細',
      sheets: function (n) { return n + '枚'; },

      /* 今月の実績 */
      month: '今月の実績',
      kGross: '総支給', kNet: '差引支給額',
      perBlock: '乗務時間あたり', perDuty: '総勤務時間あたり',
      mBlockH: '乗務時間', mDutyH: '総勤務時間', mDays: '稼働日数',
      mStay: 'ステイ日数',
      hDays: function (n) { return n + '日'; },
      hStay: function (n) { return n + '泊'; },
      noDuty: '総勤務時間が明細から読み取れていません。乗務時間あたりだけ出しています。<b>乗務時間から推定はしません</b>（実際の拘束時間は人によって倍ちがうため）。',
      kDeduct: '控除合計', kYtd: '年初来の課税支給額',
      kAnnual: '今月ベースの単純年換算',
      annualFrom: '今月と同水準の給与が12ヶ月続いた場合の参考値',
      annualWarn: '※ 賞与・変動手当・勤務時間によって、実際の年間報酬とは異なります。',
      noGross: 'この月は手取りを書いていないので、控除合計が出せません。同じ月をもう一度出すと、ここがあなたの数字になります。',
      mGuar: function (g) { return '保証 ' + g + 'h との差'; },
      momOf: function (ym) { return ym + 'との差'; },

      /* 累計 ── 「生涯年収」「総収入」とは書かない */
      total: '累計報酬',
      tHead: 'これまでに記録した支給額',
      tGross: '額面の合計', tNet: '手取りの合計', tDeduct: '控除の合計',
      tMonths: '記録月数', tAvg: '月平均の額面', tHourly: '通算の乗務時間あたり',
      tBlockH: '累計の乗務時間', tDutyH: '累計の総勤務時間',
      tSpanOf: function (a, b) { return a === b ? a : a + '〜' + b; },
      tCountOf: function (m, n) { return m === n ? m + '件' : n + '件中 ' + m + '件'; },
      tOf: function (span, cnt) { return span + '・' + cnt; },
      tOnly: function (m, n) {
        return '※ 総支給が分かる月だけを足しています（' + n + '件中 ' + m + '件）。';
      },
      tNetOnly: function (m) { return '※ 手取りと控除は、手取りを書いた ' + m + 'ヶ月ぶんの合計です。'; },
      tNone: '記録した月がまだありません。給与を追加すると、ここに積み上がっていきます。',
      months: function (n) { return n + 'ヶ月'; },

      /* 機会。★ ここに出すのは「いまより上がる選択肢」だけ。
         下回る会社は畳んだ先にも出さない（オーナー判断・2026-08-12）。 */
      oppQ: '同じ資格・経験を活かすと、どんな報酬機会がある？',
      oppEyebrow: 'YOUR OPPORTUNITIES',
      oppCurTag: '現在',
      oppCurAnnual: '今月ベースの単純年換算',
      oppUnit: '/ 年',
      oppMed: '同条件の中央値との差',
      oppScope: function (n, m) { return '同じ職位・同じ機種で記録された ' + n + '件（' + m + '社）から'; },
      oppScopeWide: function (n, m) { return '同じ職位で記録された ' + n + '件（' + m + '社）から'; },
      oppWide: '同じ機種では件数が足りないので、同じ職位の記録全体まで広げて見ています。',
      oppThin: '会社ごとの内訳を出すには記録がまだ足りません。いまは中央値との差だけ出しています。',
      oppNone: 'まだ比較に十分な実データがありません。同じ条件のパイロットが5人以上記録すると、ここが動き出します。',
      oppNoPace: 'あなたの年収（月額×12＋賞与）がまだ出ていないので、比較できません。明細をもう一度出すか、フォームで年収の欄まで入れてください。',
      oppNoUp: '同じ条件で記録された実績の中に、いまのあなたを上回る中央値はまだありません。記録が増えると変わります。',
      oppHidden: function (n) { return 'いまを下回る' + n + '社は出していません。'; },
      oppMoreH: 'ほかにも上回る会社を見る',
      oppMoreS: '上位3社に入らなかった会社です。ここに出ている会社も、年間報酬の中央値はすべていまのあなたを上回っています。',
      oppN: function (n) { return '実績データ ' + n + '件'; },
      oppAnnual: '年間報酬の中央値との差', oppHourly: '乗務時間あたりの差',
      /* スカウトは作らない。将来やる予定があることだけ示す。
         ★「受け取れる」と言い切らない（機能が無いので嘘になる）。 */
      scoutTag: 'COMING SOON',
      scoutH: '匿名スカウト',
      scoutB: 'あなたの氏名や勤務先を公開せず、条件に合う航空会社・採用担当から機会を受け取れる仕組みを準備しています。参加するかどうかは、あとからあなたが選びます。',
      scoutBtn: '準備中',
      /* 会員の記録がまだ無いときに出す、公開情報にもとづく掲載額のほう。
         「記録された実績」とは絶対に書かない（別のものなので）。 */
      pubCap: '掲載の平均年収との差',
      pubAvg: 'この会社の掲載平均',
      pubFoot: '公開情報にもとづく掲載額',
      pubScope: '会員の記録はまだ集まっていません。ここは PILOT VALUE が公開情報をもとに掲載している各社の平均年収と比べています。揃えているのは職位（機長／副操縦士）だけで、機種は問いません。同じ条件で5人が記録すると、実際に記録された数字に切り替わります。',
      pubNoUp: '掲載している平均年収の中に、いまのあなたを上回る会社はありません。',
      pubMoreH: 'ほかにも上回る会社を見る',
      pubMoreS: '上位3社に入らなかった会社です。ここに出ている会社も、掲載の平均年収はすべていまのあなたを上回っています。',
      pubRest: function (n) { return 'このほかに' + n + '社が上回っています。'; },
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
      cmpNote: '増減に良し悪しの判定はしていません。勤務時間が増えれば時間あたりの報酬は下がります。どちらが良いかは、あなたの契約と生活で決まります。',

      /* 支給構成 */
      breakdown: '支給構成',
      housingNote: '※ 社宅（現物支給）は現金ではないので内訳に入れていません。',
      noBd: '手当ごとに分けて入れると、この円グラフがあなたの数字になります。明細を読み取ると自動で分かれます。',
      /* 見本の札。★「サンプル」ではなく「見本」。本人の数字と1文字も似せない。 */
      sampleTag: '見本', sampleBtn: '匿名で給与を追加する →',
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

      /* 推移と節目 */
      trend: '月ごとの推移',
      mHourly: '時間あたり（乗務）', mAnnual: '年収（12ヶ月換算）', mNet: '差引支給額（月）',
      onePoint: '点が1つだけです。来月の明細を1枚落とすと、ここに線が引けます。',
      noMetric: 'この指標に使える月がまだありません。',
      trendScoped: '別の会社の明細は、この線には入れていません。会社をまたぐと通貨も契約も変わるので、つないでも読めません。',
      msH: '記録の節目',
      msSub: '記録した明細の並びから、変わった月を拾っています',
      msPos: function (a, b) { return '職位が ' + a + ' → ' + b; },
      msFleet: function (a, b) { return '機種が ' + a + ' → ' + b; },
      msAir: function (a, b) { return '会社が ' + a + ' → ' + b; },
      msBase: function (a, b) { return 'ベースが ' + a + ' → ' + b; },
      /* ★ データだけで「転職した」「昇格した」と断定しない（§9）。
         明細の並びが変わっただけかもしれない（出向・期間限定の派遣など）。 */
      msCand: '※ これは記録の並びから拾った候補です。転職・昇格として確定させてはいません。前後の月を実額で見比べるための目印です。',

      /* 次の給与。★ ポイント制にしない（§11）。返すのは「自分の分析が伸びること」そのもの。 */
      next: '次の給与を追加すると',
      nextAdd: '匿名で給与を追加する →',
      nextWhat: function (ym) {
        return [
          [ym + 'のレポートが増える', '記録が1ヶ月ぶん伸び、この画面がその月まで届きます。'],
          ['前回との差が更新される', '総支給と時間あたりの動きが、今回の月と並べて出ます。'],
          ['累計報酬が更新される', '記録した支給額に1ヶ月ぶんが積まれ、折れ線が1点伸びます。'],
          ['報酬機会が計算し直される', '同じ職位・同じ機種の記録が5件に届くと、中央値との差が動き出します。'],
          ['キャリアイベント前後が正確になる', '機種や職位が変わった月の前後を、実額で見比べられるようになります。']
        ];
      },
      /* 記録月数。得点ではなく「何ヶ月ぶんのレポートになるか」を返す（§11）。 */
      mlH: '記録した月数',
      mlDone: function (n) { return n + 'ヶ月記録済み'; },
      mlNext: function (k, g) { return 'あと ' + k + 'ヶ月で、' + g + 'ヶ月ぶんのレポートになります'; },
      mlGoal: function (g) { return g + 'ヶ月'; },
      mlMax: '36ヶ月ぶんそろいました。ここから先は、記録するほど過去の自分との比較が効いてきます。',
      mlNote: '点数は付けません。増えるのは、あなた自身の記録です。',
      nextTracker: 'マイページで記録を見る →',
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
      eLead: 'あなたの給与レポートと、給与共有で解放される価値を確認できます。',
      eRepT: 'あなたの給与レポート',
      eRepBadge: '未作成',
      eRepH: '給与をまだ共有していません',
      eRepS: '給与を1件追加すると、あなただけのレポートがここに出ます。'
           + '明細がなくても、手入力で作れます。',
      eRepC: '給与を追加してレポートを作成する →',
      eKnowT: 'レポートでわかること',
      eKnow: ['年収・月収・賞与の内訳',
              '市場の中央値との差と、あなたの位置',
              '乗務時間あたりの報酬',
              'あなたが入れた手取りと控除の積み上げ',
              '月をまたいだ推移'],
      eKnowN: '同じ条件で5人そろうと、実データとの比較に切り替わります。',
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
      eAddT: '給与を追加する',
      eRec: 'おすすめ',
      eWay1T: '匿名で手入力',
      eWay1S: '明細がなくても大丈夫です。最短50秒で終わり、すぐに REAL PAY が解放されます。',
      eWay1C: '匿名で手入力する →',
      eWay2T: '給与明細から入力',
      eWay2S: '画像は端末の中で黒塗りしてから送られ、保存はされません。読み取った金額だけが残ります。',
      eWay2C: '明細をアップロードする →',
      eFoot: '氏名・社員番号・メールは公開されません。'
           + '画像は保存せず、個人が特定できる情報は一切取得しません。',
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
      leadNew: 'Built from the payslip you just filed. Your own pay insight, from the data you recorded.',
      lead: 'Your own pay insight, built from the data you have recorded. It gets sharper every month you add.',
      unlockOn: function (n) { return 'Unlocked · ' + n + (n === 1 ? ' day' : ' days'); },
      unlockOff: 'Locked',
      kAirline: 'Airline', kFleet: 'Aircraft', kPos: 'Seat', kBase: 'Base',
      kMonth: 'Pay month', kUpdated: 'Built on', kSheets: 'Payslips on record',
      sheets: function (n) { return String(n); },

      month: 'This month',
      kGross: 'Gross pay', kNet: 'Net pay',
      perBlock: 'Per block hour', perDuty: 'Per duty hour',
      mBlockH: 'Block hours', mDutyH: 'Duty hours', mDays: 'Duty days',
      mStay: 'Layover nights',
      hDays: function (n) { return String(n); },
      hStay: function (n) { return String(n); },
      noDuty: 'Duty hours were not readable from your payslip, so only the block-hour figure is shown. <b>We do not estimate duty hours from block hours</b> — the real ratio varies by up to 2× between operators.',
      kDeduct: 'Total deductions', kYtd: 'Taxable pay, year to date',
      kAnnual: 'This month, straight-annualised',
      annualFrom: 'what twelve months like this one would come to',
      annualWarn: '※ Bonus, variable allowances and hours flown all move this. It is not your actual annual pay.',
      noGross: 'You did not enter take-home pay for this month, so deductions cannot be worked out. File the same month again and these become your own figures.',
      mGuar: function (g) { return 'vs ' + g + 'h guaranteed'; },
      momOf: function (ym) { return 'vs ' + ym; },

      total: 'Total pay recorded',
      tHead: 'Everything you have on record',
      tGross: 'Gross, total', tNet: 'Take-home, total', tDeduct: 'Deductions, total',
      tMonths: 'Months recorded', tAvg: 'Average gross / month', tHourly: 'Career per block hour',
      tBlockH: 'Block hours, total', tDutyH: 'Duty hours, total',
      tSpanOf: function (a, b) { return a === b ? a : a + ' – ' + b; },
      tCountOf: function (m, n) { return m === n ? m + (m === 1 ? ' record' : ' records') : m + ' of ' + n + ' records'; },
      tOf: function (span, cnt) { return span + ' · ' + cnt; },
      tOnly: function (m, n) {
        return '※ Only months with a readable gross figure are added up (' + m + ' of ' + n + ').';
      },
      tNetOnly: function (m) { return '※ Take-home and deductions cover only the ' + m + (m === 1 ? ' month' : ' months') + ' where you entered take-home pay.'; },
      tNone: 'Nothing on record yet. Add your pay and the pile starts here.',
      months: function (n) { return n + (n === 1 ? ' month' : ' months'); },

      oppQ: 'What does your licence and experience open up?',
      oppEyebrow: 'YOUR OPPORTUNITIES',
      oppCurTag: 'Current',
      oppCurAnnual: 'This month, straight-annualised',
      oppUnit: '/ yr',
      oppMed: 'vs the median on the same terms',
      oppScope: function (n, m) { return 'from ' + n + ' records at the same seat and aircraft type, across ' + m + ' airlines'; },
      oppScopeWide: function (n, m) { return 'from ' + n + ' records at the same seat, across ' + m + ' airlines'; },
      oppWide: 'There are not enough records for your aircraft type, so this widens to every record at your seat.',
      oppThin: 'Not enough records yet to break this down by airline. For now only the gap to the median is shown.',
      oppNone: 'Not enough real data to compare yet. Once five or more pilots on the same terms have recorded their pay, this starts working.',
      oppNoPace: 'Your annual figure (monthly × 12 + bonus) is not available yet, so there is nothing to compare. File the payslip again, or fill in the annual fields on the form.',
      oppNoUp: 'Nothing recorded on your terms sits above where you are now. That changes as more records come in.',
      oppHidden: function (n) { return n + (n === 1 ? ' airline that sits' : ' airlines that sit') + ' below your current terms ' + (n === 1 ? 'is' : 'are') + ' not shown.'; },
      oppMoreH: 'See the other airlines above you',
      oppMoreS: 'Airlines that did not make the top three. Every one of these also has a higher annual median than you do now.',
      oppN: function (n) { return n + ' records'; },
      oppAnnual: 'Gap to median annual', oppHourly: 'Gap per block hour',
      /* スカウトは作らない。将来やる予定があることだけ示す。 */
      scoutTag: 'COMING SOON',
      scoutH: 'Anonymous scouting',
      scoutB: 'We are building a way for airlines and recruiters to reach you without your name or your employer being shown. Whether you take part will be your choice, later.',
      scoutBtn: 'In preparation',
      pubCap: 'vs our published average',
      pubAvg: 'Published average there',
      pubFoot: 'From published salary data',
      pubScope: 'Member records have not built up yet, so this section compares against the average annual pay PILOT VALUE publishes for each airline, drawn from public information. It matches on seat (captain / first officer) only — not on aircraft type. Once five pilots on the same terms have recorded their pay, this switches to what they actually recorded.',
      pubNoUp: 'None of the published averages sits above where you are now.',
      pubMoreH: 'See the other airlines above you',
      pubMoreS: 'Airlines that did not make the top three. Every one of these also has a higher published average than you do now.',
      pubRest: function (n) { return n + (n === 1 ? ' more airline sits' : ' more airlines sit') + ' above you.'; },
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
      cmpNote: 'No judgement is attached to these changes. More duty hours means a lower hourly rate — which one you want depends on your contract and your life.',

      breakdown: 'How your pay is made up',
      housingNote: '※ Company-provided housing is not cash, so it is left out of the breakdown.',
      noBd: 'Enter your pay allowance by allowance and this chart becomes your own. Reading a payslip fills it in automatically.',
      sampleTag: 'Sample', sampleBtn: 'Add pay anonymously →',
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

      trend: 'Month by month',
      mHourly: 'Hourly (block)', mAnnual: 'Annual (×12)', mNet: 'Net pay (month)',
      onePoint: 'Only one point so far. Drop next month’s payslip and this becomes a line.',
      noMetric: 'No month has the data this metric needs yet.',
      trendScoped: 'Payslips from your other airline are not on this line. Across an airline change both the currency and the contract change, so joining them would not mean anything.',
      msH: 'Milestones',
      msSub: 'Picked up from where your own records change',
      msPos: function (a, b) { return 'Seat: ' + a + ' → ' + b; },
      msFleet: function (a, b) { return 'Aircraft: ' + a + ' → ' + b; },
      msAir: function (a, b) { return 'Airline: ' + a + ' → ' + b; },
      msBase: function (a, b) { return 'Base: ' + a + ' → ' + b; },
      msCand: '※ These are picked up from the order of your own records. Nothing here is confirmed as a move or a promotion — they are markers, so you can compare the real amounts either side.',

      next: 'When you add your next payslip',
      nextAdd: 'Add pay anonymously →',
      nextWhat: function (ym) {
        return [
          [ym + ' joins your report', 'One more month on record, and this page reaches that month.'],
          ['The change is updated', 'Gross and hourly pay line up against the month you just filed.'],
          ['Your total is updated', 'One more month goes on the pile and the line gains a point.'],
          ['Opportunities recalculate', 'Once five records share your seat and aircraft type, the gap to the median starts working.'],
          ['Career events sharpen', 'Months either side of a fleet or seat change become comparable in real amounts.']
        ];
      },
      mlH: 'Months on record',
      mlDone: function (n) { return n + (n === 1 ? ' month recorded' : ' months recorded'); },
      mlNext: function (k, g) { return k + ' more and this becomes a ' + g + '-month report'; },
      mlGoal: function (g) { return g + 'm'; },
      mlMax: '36 months on record. From here, every payslip you add deepens the comparison with your own past.',
      mlNote: 'There are no points here. What grows is your own record.',
      nextTracker: 'See your record →',
      remind: 'Remind me when my payslip lands',
      remindOn: 'Once a month, around your own payday.',
      remindOff: 'Off. No reminders will be sent.',
      remindWhen: function (dd) { return 'Around the ' + ORD(dd) + ' of each month'; },
      remindNote: 'The email never contains payslip line items or amounts, and always carries a one-click unsubscribe link.',
      remindErr: 'Could not save that setting. Please try again in a moment.',

      /* Same screen in English. A payslip is not required — typing it in unlocks the same thing. */
      eTitle: 'My report',
      eLead: 'Your own pay report, and what sharing your pay unlocks.',
      eRepT: 'Your pay report',
      eRepBadge: 'Not started',
      eRepH: 'You have not shared your pay yet',
      eRepS: 'Add one pay record and your own report appears here. '
           + 'No payslip needed — you can type it in.',
      eRepC: 'Add your pay and build the report →',
      eKnowT: 'What the report shows',
      eKnow: ['Your annual, monthly and bonus breakdown',
              'How far you sit from the median, and where you land',
              'What you earn per block hour',
              'The take-home and deductions you entered, stacked up',
              'How it moves from month to month'],
      eKnowN: 'Once five pilots share your conditions, the comparison switches to real member data.',
      eBandT: 'Share your pay and everything here opens',
      eBand: function (n, a) {
        return '<b>' + n + '</b> pay records have been shared so far, from <b>' + a + '</b> airlines';
      },
      eBand1: function (n) { return '<b>' + n + '</b> pay records have been shared so far'; },
      eBandC: 'See REAL PAY →',
      eStRep: 'Pay records',      eStRepU: '',
      eStAir: 'Airlines',         eStAirU: '',
      eStMon: 'Added within 1 month', eStMonU: '',
      eAddT: 'Add your pay',
      eRec: 'Recommended',
      eWay1T: 'Type it in anonymously',
      eWay1S: 'No payslip needed. It takes about 50 seconds, and REAL PAY opens straight away.',
      eWay1C: 'Type it in anonymously →',
      eWay2T: 'Start from a payslip',
      eWay2S: 'The image is redacted on your own device before it is sent, and it is never stored. Only the figures are kept.',
      eWay2C: 'Upload a payslip →',
      eFoot: 'Your name, staff number and email are never published. '
           + 'Images are not stored, and nothing that identifies you is collected.',
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
    }
  }[L];

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

  var isNew = /(?:^|[?&])new=1(?:&|$)/.test(w.location.search);

  /* series ＝ 最新の明細と同じ会社の月だけ（前回との差・推移の線が使う）
     rows   ＝ 全社ぶんそのまま（累計だけが使う。足し算に会社の壁は無い）
     bench  ＝ pay_benchmarks から引いた同条件の集計（n≧5 のセルしか返らない） */
  var state = { data: null, rows: [], series: [], metric: 'hourly', busy: false,
               bench: null, pub: null, name: '', pay: null };

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
  var trackerHref = function () { return 'profile.html#pay-tracker'; };

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
  // 解放期限のように「項目名の要らないチップ」があるので、空ラベルは詰める
  function chip(k, v) {
    return '<span class="mr-chip">' + (k ? esc(k) + ' ' : '') + '<b>' + esc(v) + '</b></span>';
  }
  var SEP = (L === 'ja') ? '・' : ' · ';
  function mini(v, lab) {
    return '<div class="mr-mini-i"><b>' + v + '</b><span>' + esc(lab) + '</span></div>';
  }
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

  /* 見本の手取り。★ 額面に対する割合だけ。国によって控除は倍ちがうので、
     ここに置いた割合は「そういう形の数字が返る」以上のことを言っていない。 */
  function sampleNet() {
    return '<div class="mv-grid">' + row(T.kNet, '78%') + row(T.kDeduct, '22%') + '</div>' +
      '<div class="mv-bar">' +
        '<i style="width:78%;background:#34d399"></i>' +
        '<i style="width:22%;background:#94a3b8"></i>' +
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
     ★ 頭文字だけ大文字にすると 'ana' が「Ana」、'jal' が「Jal」、'klm' が「Klm」になる。
       正しい社名の対応表はフォームの <option>（約110行）にしか無く、ここに写すと
       二重持ちになって必ずずれる。左端の「現在」の札が airlineName() で
       全部大文字にしているので、こちらも全部大文字で揃える＝略号が壊れない。 */
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
     総支給を2枠ぶん取って、残りを同じ大きさで並べる。全部を同じ強さにしない。
     ★ duty が無いときに block から推定しない。実際の block:duty は
       会社と路線で倍ちがうので、推定した瞬間に数字が嘘になる。 */
  function kpi(k, v, delta, sub, lead) {
    return '<div class="mr-kpi' + (lead ? ' is-lead' : '') + '">' +
      '<span class="mr-kpi-k">' + esc(k) + '</span>' +
      '<b class="mr-kpi-v">' + esc(v) + '</b>' +
      (delta ? '<span class="mr-d ' + delta.cls + '">' + esc(delta.tx) + '</span>' : '') +
      (sub ? '<span class="mr-kpi-n">' + esc(sub) + '</span>' : '') +
      '</div>';
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

    var body = '<div class="mr-kpis">' +
      kpi(T.kGross, gross != null ? fmt(jpyOf(r, gross)) : '—', pctOf(m, 'gross'), null, true) +
      kpi(T.kNet, net != null ? fmt(jpyOf(r, net)) : '—') +
      kpi(T.perDuty, c.hourlyDuty != null ? fmt(c.hourlyDuty) : '—', pctOf(m, 'duty')) +
      kpi(T.perBlock, c.hourlyBlock != null ? fmt(c.hourlyBlock) : '—', pctOf(m, 'block')) +
      '</div>';

    // 読めた数字だけ並べる。無い枠は 0 で埋めない（0時間と未読取は別のこと）
    var cells = '';
    if (c.blockH != null) cells += mini(c.blockH + '<i>h</i>', T.mBlockH);
    if (c.dutyH != null) cells += mini(c.dutyH + '<i>h</i>', T.mDutyH);
    if (days != null) cells += mini(T.hDays(days), T.mDays);
    /* 0泊（日帰りだけの月）も出す。「書かなかった」と「泊まらなかった」は別のこと。 */
    if (stay != null) cells += mini(T.hStay(stay), T.mStay);
    /* 保証時間との差。★ 明細は要らない。フォームで保証時間を書いた人にだけ出る。
       中東の 75〜80h 保証と日本の無保証を並べられるのは、この欄があるからこそ。
       ★ 保証が無い（空欄・0）人には出さない。0h との差を出すと、あたかも
         「保証0時間の契約」が実在するかのように読める。 */
    var guar = num(r.guaranteed_hours);
    if (guar > 0 && c.blockH != null) {
      var over = c.blockH - guar;
      cells += mini((over >= 0 ? '+' : '−') + Math.abs(over).toFixed(1) + '<i>h</i>', T.mGuar(guar));
    }
    if (cells) body += '<div class="mr-mini">' + cells + '</div>';

    if (c.hourlyBlock != null && c.hourlyDuty == null) body += note(T.noDuty);

    /* 控除は「総支給 − 手取り」でしか作れないので、手取りを書いた月にだけ出る。
       年初来の課税額は明細からしか読めない。★ 空の枠を置かない。 */
    var extra = (ded != null ? row(T.kDeduct, fmt(jpyOf(r, ded))) : '') +
                (ytd != null ? row(T.kYtd, fmt(jpyOf(r, ytd))) : '');
    if (extra) {
      body += '<div class="mv-grid" style="margin-top:14px">' + extra + '</div>';
    } else {
      /* 手取りを書かなかった月。空欄ではなく見本を置く（同じ月を出し直せば埋まる）。 */
      body += maskSample(sampleNet(), T.noGross);
    }

    /* ★ これは「今月を12倍しただけ」の参考値であって、年収の実績ではない。
       面も文字も一段沈めたまま置く（.mr-ann-s）。控除の行より目立たせない。 */
    var ann = num(r.annual_total_orig);
    if (ann != null) {
      body += '<div class="mr-ann">' +
        '<div class="mr-ann-s"><span class="k">' + esc(T.kAnnual) + '</span>' +
        '<b class="v">' + esc(fmt(jpyOf(r, ann))) + '</b>' +
        '<span class="s">' + esc(T.annualFrom) + '</span>' +
        '<span class="w">' + esc(T.annualWarn) + '</span></div>' +
      '</div>';
    }
    return sec(T.month, body, T.ym(r.period_year, r.period_month) +
      (m ? SEP + T.momOf(T.ym(m.a.period_year, m.a.period_month)) : ''));
  }

  /* ── 累計報酬 ──────────────────────────────────────────────
     記録した月の支給額を積み上げる。1回出すごとに増える数字＝毎月戻る理由。

     ★ ここは差・推移の線と違って **会社で絞らない**。あれは比較なので同じ会社の
       中に閉じるが、これは「受け取った額の足し算」で、転職しても受け取った
       事実は消えない。足し方（各月をその月のレートで円に直す）は totals()。
     ★ 「生涯年収」「総収入」とは書かない。出していない月は入っていないので、
       そう名乗った瞬間に嘘になる。対象期間と枚数を必ず同じ枠に出す。
     ★ 額面は総支給が分かる月ぜんぶ、手取り・控除は手取りを書いた月だけ
       （totals() がそう作っている）。控除は同じ部分集合の額面から引いているので、
       画面の「額面 − 手取り」は必ず「控除の合計」と一致する。額面と枚数が
       違うときは、いくつぶんの合計かを下に1行で断る。 */
  function lifetime(rows) {
    var t = V.totals(rows);
    if (!t.months) {
      return sec(T.total, empty(T.tNone) +
        '<a class="pt-btn" href="' + payHref() + '">' + esc(T.nextAdd) + '</a>', null, 'is-hero');
    }

    var span = T.tSpanOf(
      T.ym(t.from.period_year, t.from.period_month),
      T.ym(t.to.period_year, t.to.period_month));

    var body = '<div class="mr-total">' +
        '<span class="mr-total-k">' + esc(T.tHead) + '</span>' +
        '<b class="mr-total-v">' + esc(fmt(t.gross)) + '</b>' +
        '<span class="mr-total-n">' + esc(T.tOf(span, T.tCountOf(t.months, t.total))) + '</span>' +
      '</div>';

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
       札の見出しには足さない（この幅では必ず「3」と「ヶ月」で改行する）。
       枚数が違うときは下に1行で断る。 */
    var cells =
      (t.monthsNet ? mini(esc(fmt(t.net)), T.tNet) +
                     mini(esc(fmt(t.deduct)), T.tDeduct) : '') +
      mini(T.months(t.months), T.tMonths) +
      mini(esc(fmt(t.gross / t.months)), T.tAvg) +
      (hDen > 0 ? mini(esc(fmt(hNum / hDen)), T.tHourly) : '') +
      (bh > 0 ? mini(bh.toFixed(1) + '<i>h</i>', T.tBlockH) : '') +
      (dh > 0 ? mini(dh.toFixed(1) + '<i>h</i>', T.tDutyH) : '');
    body += '<div class="mr-mini">' + cells + '</div>';

    // 積み上がりの折れ線。点は「足せた月」だけ＝上の枚数と数が合う
    body += '<div class="mr-cum"></div>';

    if (t.skipped > 0) body += note(esc(T.tOnly(t.months, t.total)));
    if (t.monthsNet && t.monthsNet < t.months) body += note(esc(T.tNetOnly(t.monthsNet)));
    return sec(T.total, body, null, 'is-hero');
  }

  /* 累計の折れ線は running total なので、1行だけでは値が決まらない。
     chart() の valueAt に渡す（key は使われない）。
     ★ valueOf という名前にはできない。Object.prototype.valueOf が継承されていて
       常に function になり、他の呼び出しまで巻き込む（pay-viz.js の注記を参照）。
     ★ 枠は .mr-cum。.pt-chart にすると drawChart() の探し先とぶつかる。 */
  function drawCumChart() {
    var box = root.querySelector('.mr-cum');
    if (!box) return;
    var t = V.totals(state.rows);
    if (!t.months) { box.innerHTML = ''; return; }
    box.innerHTML = V.chart(t.series.map(function (s) { return s.r; }), 'cum', {
      width:    V.widthOf(box, root),
      valueAt:  function (r, i) { return t.series[i].gross; },
      labelOf:  function (r) { return T.ymShort(r.period_year, r.period_month); },
      aria:     T.total,
      noMetric: T.tNone
    });
  }

  /* ── 機会（YOUR OPPORTUNITIES）────────────────────────────────
     ★ 主役は「いまの条件」と「同条件で記録された中央値」を横に並べた札。
       大きなマイナス1つを Hero にしない。開いた瞬間に損が確定した画面になり、
       しかもそれは「転職すれば取り戻せる額」ではない（比べているのは
       他人が記録した実績の中央値であって、あなたへの提示額ではない）。
     ★ 順位を出さない。出すのは差だけ。「上位◯%」は本人を採点する言い方。
     ★ 「おすすめ転職先」「応募できます」とは書かない。採用の可否は測っていない。
     ★ pay_benchmarks は n≧5 のセルしか返らない＝5人未満の条件は行そのものが
       無い。だから「あと◯件」は数えられない（0件と4件の区別がつかない）。
     ★ 会社ごとの札を出すのは合計15件以上のときだけ。5〜14件では中央値だけ。 */

  /* 札は1つの関数で作る。現在も候補も Scout も同じ骨格＝横に並べたとき
     数字の行の高さが揃う（別々に書くと必ずずれる）。 */
  function oppCard(o) {
    return '<article class="mr-opp' + (o.mod ? ' ' + o.mod : '') + '">' +
      (o.tag ? '<span class="mr-opp-tag">' + esc(o.tag) + '</span>' : '') +
      /* href があるときだけ社名をリンクにする。★ 相対で書く＝英語ページからは
         en/airlines/… を指す（両方に112社ぶん揃っているのを確認済み）。 */
      '<div class="mr-opp-n">' + (o.href
        ? '<a class="mr-opp-a" href="' + esc(o.href) + '">' + esc(o.name) + '</a>'
        : esc(o.name)) + '</div>' +
      (o.meta ? '<div class="mr-opp-m">' + esc(o.meta) + '</div>' : '') +
      (o.big ? '<div class="mr-opp-big"><b' + (o.up ? ' class="is-up"' : '') + '>' + esc(o.big) + '</b>' +
        (o.unit ? '<span>' + esc(o.unit) + '</span>' : '') + '</div>' : '') +
      (o.cap ? '<p class="mr-opp-cap">' + esc(o.cap) + '</p>' : '') +
      (o.rows ? '<div class="mr-opp-r">' + o.rows + '</div>' : '') +
      (o.foot ? '<div class="mr-opp-f">' + esc(o.foot) + '</div>' : '') +
      (o.btn ? '<button class="mr-opp-btn" type="button" disabled>' + esc(o.btn) + '</button>' : '') +
      '</article>';
  }
  /* 札の中の1行。第3引数は「休日・住居・税の差」が入るようになったときの
     ただし書き用に空けてある（いまは比較用の中央値が無いので出さない）。 */
  function oppCell(k, v, sub) {
    return '<div><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span>' +
      (sub ? '<span class="s">' + esc(sub) + '</span>' : '') + '</div>';
  }
  function signed(jpy) { return (jpy >= 0 ? '+' : '−') + fmt(Math.abs(jpy)); }
  function rail(cards, mod) {
    return '<div class="mr-rail' + (mod ? ' ' + mod : '') + '">' + cards + '</div>';
  }

  /* いまの条件。★ 良い・悪いを付けない。左端に置く「基準」でしかない。 */
  function curCard(r) {
    var c = V.calc(r);
    var mine = annualJpy(r);
    var meta = [fleetName(r), posName(r)]
      .concat(r.base_iata ? [String(r.base_iata).toUpperCase()] : []).join(SEP);
    var rows = '';
    if (c.hourlyDuty != null) rows += oppCell(T.perDuty, fmt(c.hourlyDuty));
    if (c.hourlyBlock != null) rows += oppCell(T.perBlock, fmt(c.hourlyBlock));
    return oppCard({
      mod: 'is-cur', tag: T.oppCurTag, name: airlineName(r), meta: meta,
      big: mine != null ? fmt(mine) : '—', unit: mine != null ? T.oppUnit : '',
      cap: T.oppCurAnnual, rows: rows
    });
  }

  function candCard(x, mine, mineHourly) {
    var d = x.v - mine;
    var meta = [x.c.fleet ? String(x.c.fleet).toUpperCase() : null, T[x.c.position] || x.c.position]
      .filter(Boolean).join(SEP);
    var rows = '';
    var hb = num(x.c.median_usd_per_bh);
    if (hb != null && mineHourly != null) rows += oppCell(T.oppHourly, signed(usdToJpy(hb) - mineHourly));
    return oppCard({
      name: codeLabel(x.c.airline), meta: meta,
      big: signed(d), unit: T.oppUnit, up: d > 0,
      cap: T.oppMed, rows: rows, foot: T.oppN(x.c.n)
    });
  }

  // 5〜14件。会社名を出すと1社2〜3人になり個人が透けるので、中央値1枚だけ。
  function medianCard(delta, n) {
    return oppCard({
      name: T.oppMed, big: signed(delta), unit: T.oppUnit, up: delta > 0,
      cap: T.oppThin, foot: T.oppN(n)
    });
  }

  /* ★ スカウトは作っていない。場所と予定だけ置く。
     押せるボタンにしない・主役の色を使わない・「受け取れます」と言い切らない。 */
  function scoutCard() {
    return oppCard({ mod: 'is-scout', tag: T.scoutTag, name: T.scoutH, cap: T.scoutB, btn: T.scoutBtn });
  }

  /* ── 会員の記録がまだ無いときの中身（公開情報にもとづく掲載額）─────
     ★ pay_benchmarks は n≧5 のセルしか行を持たない＝本番ではいま1行も返らない。
       この節を空のまま置くと「明細を出しても何も返ってこない画面」になるので、
       記録が集まるまではサイトが掲載している各社の平均年収と比べる
       （オーナー判断・2026-08-12）。守るのは2つだけ:
       ① 作り話の数字を置かない（出どころは salary-data.json ＝ SSOT の書き出し）
       ② 会員が記録した実績だと言わない（文言を pub* に分けてある）
     ★ 揃えるのは職位だけ。掲載側に機種の区別が無いので、機種で揃えたふりをしない。
       そのことは画面（pubScope）に書く。 */
  function pubCard(x, mine) {
    /* 差だけでなく、その会社の掲載額そのものも1行出す。差だけだと
       「何と比べて +2,700万 なのか」が札の中で閉じない（＋札の丈も揃う）。
       ★ 差は万円の位で丸める。掲載額は元から万円単位なので、丸めないと
         「+¥27,287,500 ／ 掲載平均 ¥6,320万」と1枚の札で桁の書き方が割れ、
         読み手が引き算できない。末尾の ,500 は精度ではなく本人側の年換算の端数。 */
    var d = Math.round((x.jpy - mine) / 10000) * 10000;
    return oppCard({
      name: x.name, meta: T[x.band] || x.band, href: 'airlines/' + x.slug + '.html',
      big: signed(d), unit: T.oppUnit, up: true,
      cap: T.pubCap, rows: oppCell(T.pubAvg, fmt(x.jpy)), foot: T.pubFoot
    });
  }

  /* 招待（データ密度）カードの差し込み口。中身は pv-referral.js が描く。
     ★「機会」節の3つの出口すべてに置く。opportunity() は
       pubSection() へ逃げる経路が2本あり（会員の記録が無い／畳んだら0社）、
       そこを忘れると「いちばん区分が薄い人」＝この機能の対象そのものが
       永久にカードを見られない。
     ★mine == null の早期 return には置かない（区分が特定できない）。 */
  function refSlot() { return '<div id="mr-ref-slot"></div>'; }

  function pubSection(r, mine) {
    var p = state.pub;
    if (!p || !p.list.length) {
      return sec(T.oppQ, rail(curCard(r) + scoutCard()) + empty(T.oppNone) + refSlot(), T.oppEyebrow);
    }

    var up = p.list.filter(function (x) { return x.jpy - mine > 0; });
    var top = up.slice(0, 3);
    /* 畳んだ先に入れるのは9社まで。★ 黙って切らない。残りは社数を書いて
       全社の一覧へ送る（低い階級ほど「上回る会社」が90社以上になるため）。 */
    var rest = up.slice(3, 12), over = up.length - 3 - rest.length;

    var cards = curCard(r) + top.map(function (x) { return pubCard(x, mine); }).join('') + scoutCard();
    var body = rail(cards);
    if (!up.length) body += note(esc(T.pubNoUp));
    if (rest.length) {
      body += '<details class="mr-more"><summary>' + esc(T.pubMoreH) + '</summary>' +
        '<p class="mr-more-s">' + esc(T.pubMoreS) + '</p>' +
        rail(rest.map(function (x) { return pubCard(x, mine); }).join(''), 'is-more') +
        (over > 0 ? '<p class="mr-more-s">' + esc(T.pubRest(over)) +
          ' <a class="mr-opp-a" href="world-airlines.html">' + esc(T.pubAll) + '</a></p>' : '') +
        '</details>';
    }
    body += note(esc(T.pubScope));
    body += refSlot();
    return sec(T.oppQ, body, T.oppEyebrow);
  }

  function opportunity(r) {
    var b = state.bench;
    var mine = annualJpy(r);

    // 比較が引けないときも「いまの条件」と Scout は出す（節を空欄にしない）
    if (mine == null) {
      return sec(T.oppQ, rail(curCard(r) + scoutCard()) + empty(T.oppNoPace), T.oppEyebrow);
    }
    if (!b || !b.cells.length) return pubSection(r, mine);

    /* 機種を外して広げると、1社が複数の機種セルで出てくる。そのまま数えると
       「◯社」が水増しされ、中央値も記録の多い会社に引っ張られる。
       先に会社ごとへ畳む（記録数の一番多いセルを、その会社の代表にする）。 */
    var byAir = {};
    b.cells.forEach(function (c) {
      var k = String(c.airline || '').toLowerCase();
      var v = usdToJpy(num(c.median_usd));
      if (!k || !(v > 0)) return;
      if (!byAir[k] || (num(c.n) || 0) > (num(byAir[k].n) || 0)) byAir[k] = c;
    });
    var airs = Object.keys(byAir).map(function (k) { return byAir[k]; });
    if (!airs.length) return pubSection(r, mine);

    var cohort = median(airs.map(function (c) { return usdToJpy(num(c.median_usd)); }));
    var delta = cohort - mine;
    var scope = (b.wide ? T.oppScopeWide : T.oppScope)(b.n, airs.length);
    var myKey = airlineKey(r);
    var mineHourly = V.calc(r).hourlyBlock;

    var cards = curCard(r), more = '', up = [], rest = [], hidden = 0;

    if (b.n >= 15) {
      var list = airs
        .filter(function (c) { return String(c.airline).toLowerCase() !== myKey; })
        .map(function (c) { return { c: c, v: usdToJpy(num(c.median_usd)) }; })
        .sort(function (x, y) { return y.v - x.v; });
      /* ★ 出すのは「いまより上がる会社」だけ。下回る会社は畳んだ先にも出さない
         （オーナー判断・2026-08-12）。「−¥311万」の札は行き先の候補ではないし、
         並べた瞬間にこの節が「損の一覧」になる。
         上位3社を主レールに、4社目以降（これも全部プラス）は畳んだ先へ。
       ★ 「乗務時間あたりでは上がる」会社もここでは拾わない。年間がマイナスなら
         札の主役の数字がマイナスになるため。 */
      var upAll = list.filter(function (x) { return x.v - mine > 0; });
      up = upAll.slice(0, 3);
      rest = upAll.slice(3);
      hidden = list.length - upAll.length;                 // 下回るので出さなかった社数
      cards += up.map(function (x) { return candCard(x, mine, mineHourly); }).join('');
      if (rest.length) {
        more = '<details class="mr-more"><summary>' + esc(T.oppMoreH) + '</summary>' +
          '<p class="mr-more-s">' + esc(T.oppMoreS) + '</p>' +
          rail(rest.map(function (x) { return candCard(x, mine, mineHourly); }).join(''), 'is-more') +
          '</details>';
      }
    } else if (delta > 0) {
      /* 5〜14件。会社名は出せないので中央値1枚だけ。
         ★ ここも上回るときだけ。下回るとマイナスの札が1枚だけ残り、
           この節が「あなたは平均以下です」という採点画面になる。 */
      cards += medianCard(delta, b.n);
      up = [1];                                            // 上回る比較を1枚出した印
    }
    cards += scoutCard();

    var body = rail(cards);
    if (!up.length) body += note(esc(T.oppNoUp));
    if (hidden > 0) body += note(esc(T.oppHidden(hidden)));
    body += note(esc(scope));
    if (b.wide) body += note(esc(T.oppWide));
    body += more;
    body += refSlot();
    return sec(T.oppQ, body, T.oppEyebrow);
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
    if (m.pairs.length) body += note(esc(T.cmpNote));

    return sec(T.cmp, body,
      T.ym(m.a.period_year, m.a.period_month) + ' → ' + T.ym(m.b.period_year, m.b.period_month));
  }

  /* ── 支給構成（ドーナツ ＋ 固定/変動）─────────────────────────
     ★ その他手当は固定とも変動とも決められないので3本目のバケツに置く。
       無理に2分割すると、どちらに寄せても嘘になる。 */
  function breakdown(r) {
    var dn = V.donut(r, {
      title: T.ym(r.period_year, r.period_month), name: SEGNAME,
      notes: { housing: T.housingNote }
    });
    /* 内訳の数字が1つも無い行（＝かんたん入力で額面1本だけ出した人・
       明細の読み取りに失敗した人）。空欄で終わらせず、見本をぼかして出す。 */
    if (!dn) return sec(T.breakdown, maskSample(sampleBreakdown(), T.noBd));

    var body = dn;
    var s = V.segments(r);
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

        /* ★総支給1本の行（s.partial）では基本給が分かっていない。ここを出すと
           「基本給は0%」と刷ることになるので、行ごと出さない。 */
        body += (s.partial ? '' :
            '<div class="mv-ratio"><b>' + pc(v.base) + '%</b><span>' + esc(T.baseRatio) + '</span></div>') +
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

  /* ── 月ごとの推移 ＋ 記録の節目（キャリアイベントの候補）──────────
     ★ 新しいテーブルは作らない。隣り合う明細で職位・機種・会社・ベースが
       変わった所を拾うだけ。予測はしない（何が起きたかだけ書く）。
     ★ ここで返す形は、あとで「機種移行として記録しますか？」と本人に確かめて
       before/after を並べるところまで持っていける形にしてある
       （event_type / event_date / old_* / new_* ＋ 前後の行そのもの）。
     ★ データだけで「転職した」「昇格した」と確定させない。出向・期間限定の
       派遣・記録の抜けでも同じ見え方をするので、確定させた瞬間に嘘になりうる。
       だから confirmed は必ず false で作る（立てるのは本人だけ）。 */
  function milestones(rows) {
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var a = rows[i - 1], b = rows[i], ev = [];
      if (String(a.position || '') !== String(b.position || '')) {
        ev.push({ event_type: 'rank_change', old_rank: a.position || null, new_rank: b.position || null,
                  tx: T.msPos(posName(a), posName(b)) });
      }
      if (String(a.fleet || '') !== String(b.fleet || '')) {
        ev.push({ event_type: 'fleet_change', old_fleet: a.fleet || null, new_fleet: b.fleet || null,
                  tx: T.msFleet(fleetName(a), fleetName(b)) });
      }
      if (airlineKey(a) !== airlineKey(b)) {
        ev.push({ event_type: 'airline_change', old_airline: airlineKey(a), new_airline: airlineKey(b),
                  tx: T.msAir(airlineName(a), airlineName(b)) });
      }
      if (String(a.base_iata || '') !== String(b.base_iata || '')) {
        ev.push({ event_type: 'base_change', old_base: a.base_iata || null, new_base: b.base_iata || null,
                  tx: T.msBase(String(a.base_iata || '—').toUpperCase(), String(b.base_iata || '—').toUpperCase()) });
      }
      if (!ev.length) continue;
      var when = { year: b.period_year, month: b.period_month };
      ev.forEach(function (e) { e.event_date = when; e.confirmed = false; });
      // 同じ月に複数（機種と職位が同時に変わる等）起きるので、月でまとめて返す
      out.push({ r: b, prev: a, events: ev, tx: ev.map(function (e) { return e.tx; }) });
    }
    return out;
  }

  function trend(series, dropped, rows) {
    var METRICS = [
      { k: 'hourly', nm: T.mHourly }, { k: 'annual', nm: T.mAnnual }, { k: 'net', nm: T.mNet }
    ].filter(function (m) {
      return series.some(function (r) { var x = V.metricOf(r, m.k); return x != null && x > 0; });
    });
    if (!METRICS.some(function (m) { return m.k === state.metric; })) {
      state.metric = METRICS.length ? METRICS[0].k : 'hourly';
    }
    var tabs = '<div class="pt-tabs">' + METRICS.map(function (m) {
      return '<button class="pt-tab' + (m.k === state.metric ? ' on' : '') + '" data-m="' + m.k + '">' +
             esc(m.nm) + '</button>';
    }).join('') + '</div>';
    // 会社で絞って落ちた月がある＝チップの枚数と点の数が合わない。理由を書く
    var body = tabs + '<div class="pt-chart"></div>' + ((dropped > 0) ? note(esc(T.trendScoped)) : '');

    var ms = milestones(rows);
    if (ms.length) {
      body += '<div class="pt-sec" style="margin-top:20px"><div class="pt-h">' + esc(T.msH) +
        '<span class="pt-sub">' + esc(T.msSub) + '</span></div>' +
        '<ul class="mr-ms">' + ms.map(function (x) {
          return '<li><span class="ym">' + esc(T.ym(x.r.period_year, x.r.period_month)) + '</span>' +
            '<span class="tx">' + x.tx.map(esc).join('<br>') + '</span></li>';
        }).join('') + '</ul>' + note(esc(T.msCand)) + '</div>';
    }
    return sec(T.trend, body);
  }

  function drawChart() {
    var box = root.querySelector('.pt-chart');
    if (!box) return;
    box.innerHTML = V.chart(state.series, state.metric, {
      width:    V.widthOf(box, root),
      labelOf:  function (r) { return T.ymShort(r.period_year, r.period_month); },
      aria:     T.trend,
      onePoint: T.onePoint,
      noMetric: T.noMetric
    });
  }

  /* ── 次の1枚で増えるもの ──────────────────────────────────
     ★ ポイントを配らない。返すのは「自分の分析が伸びること」そのもの。 */
  /* ★ スイッチの見た目は mail_optin だけで決めない。
     送信条件は「メール通知（親 email_opt_in）× リマインド（子 mail_optin）」の AND
     （db/pay-reminder.sql の pv_reminder_due）。このページには親のスイッチが無いので、
     子だけを見て「オン」と描くと、マイページで親を切った人に
     「オンなのに届かない」画面を出すことになる。 */
  function remindOn(dat) { return !!(dat && dat.mail_optin && dat.email_opt_in); }

  var PLUS = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';

  /* 記録月数の節目。★ 点数を配らない（§11）。返すのは
     「何ヶ月ぶんのレポートになるか」だけ。目盛りは等間隔に並べて、
     それぞれに月数を書く（6→12→24→36 を比例した軸に見せない）。 */
  var GOALS = [6, 12, 24, 36];
  function mlStrip(n) {
    var goal = null;
    for (var i = 0; i < GOALS.length; i++) { if (n < GOALS[i]) { goal = GOALS[i]; break; } }
    return '<div class="mr-ml">' +
      '<div class="mr-ml-h"><b>' + esc(T.mlDone(n)) + '</b>' +
        '<span>' + esc(goal ? T.mlNext(goal - n, goal) : T.mlMax) + '</span></div>' +
      '<ol class="mr-ml-g">' + GOALS.map(function (g) {
        var cls = (n >= g) ? ' class="is-on"' : (g === goal ? ' class="is-next"' : '');
        return '<li' + cls + '><b>' + esc(T.mlGoal(g)) + '</b></li>';
      }).join('') + '</ol>' + note(esc(T.mlNote)) + '</div>';
  }

  // 次に出す月。12月の次は翌年1月（年をまたぐと「13月」になる）
  function nextYm(r) {
    var y = Number(r.period_year), m = Number(r.period_month) + 1;
    if (m > 12) { m = 1; y += 1; }
    return T.ym(y, m);
  }

  function next(dat, rows, r) {
    var on = remindOn(dat);
    var day = dat && dat.pay_day_of_month;
    var when = (on && day) ? note(esc(T.remindWhen(day))) : '';
    return sec(T.next,
      '<ul class="mr-next">' + T.nextWhat(nextYm(r)).map(function (x) {
        return '<li><span class="mr-next-i">' + PLUS + '</span>' +
          '<div><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></div></li>';
      }).join('') + '</ul>' +
      mlStrip(rows.length) +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<a class="pt-btn" href="' + payHref() + '">' + esc(T.nextAdd) + '</a>' +
        '<a class="pt-btn ghost" href="' + trackerHref() + '">' + esc(T.nextTracker) + '</a>' +
      '</div>' +
      '<div class="pt-sec pt-remind-row" style="margin-top:22px">' +
        '<div><div class="pt-remind-h">' + esc(T.remind) + '</div>' +
        '<div class="pt-note" id="mv-remind-hint">' + esc(on ? T.remindOn : T.remindOff) + '</div>' + when + '</div>' +
        '<button id="mv-remind-sw" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" ' +
          'aria-label="' + esc(T.remind) + '" class="pt-sw' + (on ? ' on' : '') + '"><span></span></button>' +
      '</div>' + note(esc(T.remindNote)));
  }

  /* ── 描画 ────────────────────────────────────────────────── */
  function header(dat, r, rows) {
    var until = dat.access_until ? new Date(dat.access_until) : null;
    var left = until ? Math.max(0, Math.ceil((until - Date.now()) / 86400000)) : 0;
    var chips =
      chip(T.kAirline, airlineName(r)) +
      chip(T.kFleet, fleetName(r)) +
      chip(T.kPos, posName(r)) +
      (r.base_iata ? chip(T.kBase, String(r.base_iata).toUpperCase()) : '') +
      chip(T.kSheets, T.sheets(rows.length)) +
      chip(T.kUpdated, r.created_at ? T.date(r.created_at) : '—') +
      chip('', left > 0 ? T.unlockOn(left) : T.unlockOff);
    return '<div class="mr-hd">' +
      '<h1 class="mr-hd-t">' + esc(T.titleOf(personName())) + '</h1>' +
      '<p class="mr-hd-s">' + esc(isNew ? T.leadNew : T.lead) + '</p>' +
      '<div class="mr-chips">' + chips + '</div></div>';
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
  // 書類（＝これから作るレポート）
  var IC_DOC = E_SVG + '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/>'
             + '<path d="M14 3v4h4"/><path d="M9 12h6M9 16h4"/></svg>';
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

  function renderEmpty() {
    var rep =
      '<section class="mr-card mv-e-rep">'
      + '<div class="mv-e-rep-b">'
      +   '<div class="mv-e-rep-hd">'
      +     '<span class="mv-e-ic" aria-hidden="true">' + IC_DOC + '</span>'
      +     '<h2 class="mv-e-h">' + esc(T.eRepT) + '</h2>'
      +     '<span class="mv-e-badge">' + esc(T.eRepBadge) + '</span>'
      +   '</div>'
      +   '<p class="mv-e-rep-t">' + esc(T.eRepH) + '</p>'
      +   '<p class="mv-e-s">' + esc(T.eRepS) + '</p>'
      +   '<a class="pt-btn" href="' + payHref() + '">' + esc(T.eRepC) + '</a>'
      + '</div>'
      + '<aside class="mv-e-know">'
      +   '<div class="mv-e-know-t">' + esc(T.eKnowT) + '</div>'
      +   '<ul class="mv-e-know-l">'
      +     T.eKnow.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('')
      +   '</ul>'
      +   '<p class="mv-e-know-n">' + esc(T.eKnowN) + '</p>'
      + '</aside></section>';

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

    var add =
      '<section class="mr-card mv-e-add">'
      + '<h2 class="mv-e-h">' + esc(T.eAddT) + '</h2>'
      + '<div class="mv-e-ways">'
      +   '<div class="mv-e-way is-rec">'
      +     '<span class="mv-e-badge is-rec">' + esc(T.eRec) + '</span>'
      +     '<div class="mv-e-way-t">' + esc(T.eWay1T) + '</div>'
      +     '<p class="mv-e-s">' + esc(T.eWay1S) + '</p>'
      +     '<a class="pt-btn" href="' + payHref() + '">' + esc(T.eWay1C) + '</a>'
      +   '</div>'
      +   '<div class="mv-e-way is-ps">'
      +     '<div class="mv-e-way-t">' + esc(T.eWay2T) + '</div>'
      +     '<p class="mv-e-s">' + esc(T.eWay2S) + '</p>'
      +     '<a class="pt-btn ghost" href="' + payHref() + '">' + esc(T.eWay2C) + '</a>'
      +   '</div>'
      + '</div></section>';

    root.innerHTML =
      '<div class="mr-hd"><h1 class="mr-hd-t">' + esc(T.eTitle) + '</h1>'
      + '<p class="mr-hd-s">' + esc(T.eLead) + '</p></div>'
      + rep + band + give + add
      + '<p class="mv-e-foot">' + IC_LOCK + '<span>' + esc(T.eFoot) + '</span></p>';
  }

  function render() {
    var dat = state.data;
    if (!dat) return;
    var rows = dat.reports || [];
    if (!rows.length) return renderEmpty();
    var r = rows[rows.length - 1];
    state.series = sameAirline(rows, r);   // 月をまたぐ比較はこの会社の中だけ
    state.rows = rows;                     // 累計だけは全社ぶんを足す
    var m = mom(rows);

    /* ★ 並びは「累計｜今月 → 構成｜前回との差 → 機会 → 推移 → 次」。
         累計を一番上に置くのは、毎月戻ってくる理由がここにしか無いため。
         今月の額は明細を見れば分かるが、積み上がりはこの画面にしか無い。
       ★ 上段は「累計」と「今月」を横に並べる（.mr-2col）。
         縦に積むと2枚で 1,072px＝最初の画面が累計だけで終わる。横に置くと
         実測でどちらも同じくらいの高さになり、開いた瞬間に
         「これまで」と「今月」が同時に目に入る。
       ★ 2段目は「支給構成」を累計の真下（左）に、「前回の明細との差」をその右に。
         どちらも今月1枚の中を見る話なので、縦に離すと関係が切れる。
         自分の明細を読み終えてから外（機会）を見る、という順にする。
       ★ どちらの段も、幅が足りない画面では自動で縦に落ちる
         （CSS 側。メディアクエリではなく flex-basis で決めている）。 */
    root.innerHTML =
      header(dat, r, rows) +
      '<div class="mr-stack">' +
        '<div class="mr-2col">' + lifetime(rows) + thisMonth(r, m) + '</div>' +
        '<div class="mr-2col">' + breakdown(r) + compare(rows, m) + '</div>' +
        opportunity(r) +
        trend(state.series, rows.length - state.series.length, rows) +
        next(dat, rows, r) +
      '</div>';

    drawChart();                           // 実寸が要るので DOM に入れてから
    drawCumChart();
    bind();

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
    root.querySelectorAll('.pt-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        state.metric = b.getAttribute('data-m');
        root.querySelectorAll('.pt-tab').forEach(function (o) {
          o.classList.toggle('on', o === b);
        });
        drawChart();                       // タブはグラフだけ差し替える（全部組み直さない）
      });
    });
    var sw = d.getElementById('mv-remind-sw');
    if (sw) sw.addEventListener('click', toggleRemind);
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
      if (got.email_opt_in != null) state.data.email_opt_in = !!got.email_opt_in;
      render();
    } catch (e) {
      if (hint) hint.textContent = T.remindErr;
    } finally { state.busy = false; }
  }

  /* 同条件の集計を引く。n≧5 のセルしか行が無いビューなので、
     ① 同じ職位 × 同じ機種 → ② 同じ職位だけ、の順に降りる。
     どこまで広げたかは画面に必ず書く（広げたことを黙らない）。 */
  async function loadBench(r) {
    if (!r || !r.position || !r.period_year) return null;
    var COLS = 'airline,position,fleet,period_year,n,median_usd,median_usd_per_bh';
    async function q(withFleet) {
      var sel = SB.from('pay_benchmarks').select(COLS)
        .eq('position', r.position).eq('period_year', r.period_year);
      if (withFleet) sel = sel.eq('fleet', r.fleet);
      var res = await sel;
      return (res && !res.error && Array.isArray(res.data)) ? res.data : [];
    }
    try {
      var cells = r.fleet ? await q(true) : [];
      var wide = false;
      if (!cells.length) { cells = await q(false); wide = true; }
      if (!cells.length) return null;
      var n = cells.reduce(function (a, c) { return a + (num(c.n) || 0); }, 0);
      return { cells: cells, n: n, wide: wide };
    } catch (e) { return null; }          // 比較が引けなくてもレポート本体は出す
  }

  /* 掲載額のほうを読む（会員の記録が5人分たまるまでの中身）。
     ★ 職位で寄せる。SFO は副操縦士、教官機長は機長へ。訓練生は寄せ先が無いので
       比較そのものを出さない（別の階級の数字を黙って当てない）。
     ★ 自分の会社は外す。「いまの条件」の札と同じ会社が候補として並ぶのを防ぐ。
     ★ salary-data.json は世界に公開しているファイルなので、読むだけで
       誰が読んだかは残らない（本人の記録は一切ここへ渡さない）。 */
  var PUB_BAND = { fo: 'fo', sfo: 'fo', cap: 'cap', tri_tre: 'cap' };
  async function loadPub(r) {
    var band = PUB_BAND[r && r.position];
    if (!band) return null;
    try {
      var res = await fetch(PUB_URL);
      if (!res.ok) return null;
      var j = await res.json();
      var A = j && j.airlines;
      if (!A) return null;
      var my = airlineKey(r), list = [];
      Object.keys(A).forEach(function (k) {
        if (k === my) return;
        var a = A[k], v = a && a[band] && num(a[band].avg);
        if (!(v > 0)) return;
        list.push({ slug: k, band: band, jpy: v * 10000,       // 掲載の単位は万円
                    name: (L === 'en' && a.en) ? a.en : (a.ja || codeLabel(k)) });
      });
      list.sort(function (x, y) { return y.jpy - x.jpy; });
      return { band: band, list: list };
    } catch (e) { return null; }        // 読めなくてもレポート本体は出す
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
    try { if (w.PVReferral) await w.PVReferral.claim(SB); } catch (e) {}
    var res;
    try { res = await SB.rpc('my_pay_reports'); } catch (e) { res = { error: e }; }
    if (!res || res.error || !res.data) { root.innerHTML = empty(T.err); return; }
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
      var last = rows[rows.length - 1];
      /* 会員の記録（pay_benchmarks）を先に見て、無いときだけ掲載額を読む。
         いつも両方読むと、使わない 60KB を毎回落とすことになる。 */
      state.bench = await loadBench(last);
      if (!state.bench || !state.bench.cells.length) state.pub = await loadPub(last);
    } else {
      /* ★まだ1件も出していない人のときだけ、数え上げを取りに行く。
           pv_pay_rows() は鍵が無くても stats（件数・社数・直近1ヶ月ぶん・出した人数）と
           give（本人が何を出したか）を返す。行は 1 件も返らない。
         ★出した人には引かない。この画面は行を必要としないのに、
           鍵を持つ人には全行が付いてくるため。 */
      state.pay = await loadPayStats();
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

  // 通貨を切り替えたら SVG の中の数字も追随させる（自動スキャンは届かない）
  w.addEventListener('pv-currency-change', function () { if (state.data) render(); });

  // 幅が変わったら折れ線を組み直す（viewBox を伸ばさない代わり）
  var rt = null;
  w.addEventListener('resize', function () {
    if (!state.rows.length) return;
    clearTimeout(rt);
    rt = setTimeout(function () { drawChart(); drawCumChart(); }, 160);
  });

  load();
}(window, document));
