/* ════════════════════════════════════════════════════════════════
   roadmap-config.js — ROADMAP & REQUESTS 画面に出る「言葉」だけを持つ

   ★このページの文言を変えたいときは、**このファイルだけ**を直す。
     roadmap.js は描き方しか知らない。

   ⚠️ 守ること（roadmap.js ではなく、ここを書く人の責任）
     ① 架空の履歴を書かない。state:'done' に書いてよいのは、
        **実際に本番へ出したもの**だけ。日付も実際に出した日を書く
        （git log の日付と合っていること）。
        「もうすぐ出す」を done に書くと、それは嘘の実績になる。
     ② 数字を盛らない。ここに人数や件数を直接書かない。
        画面に出る数はすべてサーバから来る（現在の人数＝pv_give_progress、
        伸びの折れ線＝pv_give_growth、要望の件数＝pv_requests_list の total）。
        ハードコードした数はその日から腐り、誰も気づかない。
     ③ 段（milestones）の文言で、**まだ約束していないこと**を約束しない。
        100人の段だけは既に pv-gates.js が画面で約束している内容
        （「DEEP PAY はパイロット100人で開きます」）と揃えてある。
        ずらすと、同じサイトの2画面が違うことを言う。
     ④ 日本語と英語を必ず両方書く。片方だけ足すと assert-roadmap.mjs が落ちる。
     ⑤ tasks は**1本の配列**。「運営が進めていること」と「最近のアップデート」は
        同じ配列の別の見え方でしかない。2本に割ると必ず片方だけ直されて食い違う。

     ⑥ 何を書いてよいか（2026-09-04 オーナー決定）。
        **本番に出したものは、基本ぜんぶ書いてよい。** 書かないのは次の4つだけ。
        ・お金 ── 売上・費用・資金調達・単価・報酬
        ・売却・提携・出資の話
        ・運営の体制 ── 人数・誰がやっているか（身元を守る方針と直結）
        ・まだ出していないものの時期を断定すること
          （「今月出します」と書かない。予定／検討中 の札までにする）
        迷ったら書かない。ここは1つ載せ損ねても誰も困らないが、
        1つ載せすぎると取り消せない。

   ⚠️ **短く書く**（2026-09-04 のオーナー指示「文字多すぎ」）。
      この画面は1枚に収まっていることが値打ちで、説明の長さではない。
      ・goals[].t は横一列のレールの札になる。**9文字ちょうどまで**。
        長いと 390px で1マス 65px に3行折り返し、レールが崩れる
        （説明を足したいときは d に書く。d は「次の段」1つぶんだけ画面に出る）。
      ・tasks[].d は1行。2文書きたくなったら、それは d ではなく別のタスク。
════════════════════════════════════════════════════════════════ */
window.PVRoadmap = {

  /* ── 何のためにやっているか（ヒーローの2行）──────────────────
     ★ここは長くしない。増やしたくなったら、それは別のページの仕事。 */
  mission: {
    ja: 'パイロットの待遇に、匿名の実データで透明性を。',
    en: 'Bring transparency to pilot pay with anonymous, real data.'
  },
  vision: {
    ja: '世界中の航空会社が、優秀なパイロットに選ばれるために待遇を競う市場をつくる。',
    en: 'Build a market where airlines worldwide compete on pay and conditions '
      + 'to be the ones great pilots choose.'
  },

  /* ── 目標の段。現在地は pv_give_progress() の人数で決まる ──────
     ★数え方は「給与を出したユニークなパイロットの人数」。
       登録者数ではない（登録者数はサイトのどこにも出していない）。 */
  milestones: [100, 500, 1000, 2000, 5000],

  goals: [
    { n: 100,
      ja: { t: 'DEEP PAY',
            d: '給与を出したパイロットが100人そろった時点で、職位・機材ごとの内訳を読む DEEP PAY を開きます。' },
      en: { t: 'DEEP PAY',
            d: 'Once 100 pilots have shared their pay, DEEP PAY — the breakdown by position and fleet — opens.' } },
    { n: 500,
      ja: { t: '実データで比較',
            d: '主要な航空会社について、職位・機材ごとに実データだけで比較できる密度になります。' },
      en: { t: 'Major airlines',
            d: 'Enough density to compare major airlines by position and fleet using submitted data alone.' } },
    { n: 1000,
      ja: { t: '国をまたぐ',
            d: '公開情報の推定ではなく、実際に受け取った額で国をまたいだ比較ができるようになります。' },
      en: { t: 'Cross-border',
            d: 'Compare across countries using what pilots actually received, not published estimates.' } },
    { n: 2000,
      ja: { t: '待遇の動き',
            d: '同じ会社の待遇が上がったのか下がったのかを、時系列で読めるようになります。' },
      en: { t: 'Pay movement',
            d: 'See whether pay at a given airline is rising or falling, over time.' } },
    { n: 5000,
      ja: { t: '世界の基準',
            d: 'パイロットの待遇を語るときに参照される、世界で最も信頼されるデータになります。' },
      en: { t: 'World standard',
            d: 'The most trusted reference for what pilots are actually paid, worldwide.' } }
  ],

  /* ── やったこと・やっていること（1本の配列）────────────────
     ★done の日付は実際に本番へ出した日。git log と揃えてある。
     ★community:true は「みんなからの要望がきっかけで作ったもの」。
       本当にそうだったものにだけ付ける（付けると画面に札が出る）。
     ★d は1行。 */
  tasks: [
    { id: 'roadmap-page', state: 'building',
      ja: { t: 'このページ（ロードマップと要望）',
            d: '作っているものを公開し、要望を匿名で受け取る。' },
      en: { t: 'This page — roadmap and requests',
            d: 'Publish what we build; take requests anonymously.' } },

    { id: 'verified-pilot', state: 'planned',
      ja: { t: 'VERIFIED PILOT',
            d: '明細で裏を取ったデータと、手入力を画面で区別する。' },
      en: { t: 'VERIFIED PILOT',
            d: 'Mark figures backed by a payslip, apart from typed-in ones.' } },

    { id: 'public-percentile', state: 'planned',
      ja: { t: '公開レンジの中での位置',
            d: 'マイレポートに位置だけ足す。順位は付けない。' },
      en: { t: 'Where your pay sits',
            d: 'Your position within published ranges. No leaderboards.' } },

    { id: 'apple-login', state: 'considering',
      ja: { t: 'Apple でログイン',
            d: '海外からの要望が増えたら着手する。' },
      en: { t: 'Sign in with Apple',
            d: 'If more pilots outside Japan ask for it.' } },

    /* ── ここから下は出し終わったもの（最近のアップデートに出る）── */
    { id: 'pay-breakdown-row', state: 'done', date: '2026-09-03',
      ja: { t: '実給与の1行から報酬の内訳を見る',
            d: '固定・変動・職位手当・住宅の構成を帯で読む。' },
      en: { t: 'Tap a pay row to see how it was built up',
            d: 'Fixed, variable, command and housing as a band.' } },

    { id: 'union-pay', state: 'done', date: '2026-09-02',
      ja: { t: '組合から直接払われた分を年収に入れる',
            d: '明細に載らないお金のぶん、年収が低く出ていた。' },
      en: { t: 'Pay routed through a union now counts',
            d: 'Money off the company payslip was reading low.' } },

    { id: 'deep-pay-compare', state: 'done', date: '2026-09-01',
      ja: { t: 'DEEP PAY に会社比較',
            d: '2社を並べて、支給の構成まで比べられる。' },
      en: { t: 'Company comparison in DEEP PAY',
            d: 'Two airlines side by side, down to composition.' } },

    { id: 'real-pay', state: 'done', date: '2026-08-24',
      ja: { t: 'REAL PAY — 実際の給与を1行ずつ読む',
            d: '公開情報と混ぜず、受け取った額だけを並べる。' },
      en: { t: 'REAL PAY — actual pay, row by row',
            d: 'Only what pilots received, never mixed with estimates.' } },

    { id: 'conditions', state: 'done', date: '2026-08-19',
      ja: { t: '待遇アンケート（32問）',
            d: '休日・ベース・ローテーション・宿泊を集める。' },
      en: { t: 'Working-conditions survey (32 questions)',
            d: 'The parts of a job a salary figure never shows.' } },

    { id: 'review-i18n', state: 'done', date: '2026-08-10',
      ja: { t: '口コミの日英自動翻訳',
            d: '日本語の口コミが英語でも、英語が日本語でも読める。' },
      en: { t: 'Reviews translated both ways',
            d: 'Japanese readable in English, and the other way round.' } },

    { id: 'payslip-redact', state: 'done', date: '2026-08-06',
      ja: { t: '明細を端末の中で黒塗りしてから読み取る',
            d: '氏名・社員番号・住所は送る前に消す。画像は保存しない。' },
      en: { t: 'Payslips redacted on your device',
            d: 'Name and address never leave the phone. Image not stored.' } }
  ]
};
