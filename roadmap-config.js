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
        要望の件数＝pv_requests_list の total）。
        ハードコードした数はその日から腐り、誰も気づかない。
     ③ 段（milestones）の文言で、**まだ約束していないこと**を約束しない。
        100人の段だけは既に pv-gates.js が画面で約束している内容
        （「DEEP PAY はパイロット100人で開きます」）と揃えてある。
        ずらすと、同じサイトの2画面が違うことを言う。
     ④ 日本語と英語を必ず両方書く。片方だけ足すと assert-roadmap.mjs が落ちる。
     ⑤ tasks は**1本の配列**。「運営が進めていること」と「最近のアップデート」は
        同じ配列の別の見え方でしかない。2本に割ると必ず片方だけ直されて食い違う。

   state は4つ。
     'done'        … 出し終わったもの（date が必須。最近のアップデートに出る）
     'building'    … いま手を動かしているもの
     'planned'     … やると決まっているが、まだ着手していないもの
     'considering' … 検討中。まだやると決めていない
════════════════════════════════════════════════════════════════ */
window.PVRoadmap = {

  /* ── 目標の段。現在地は pv_give_progress() の人数で決まる ──────
     ★数え方は「給与を出したユニークなパイロットの人数」。
       登録者数ではない（登録者数はサイトのどこにも出していない）。 */
  milestones: [100, 500, 1000, 2000, 5000],

  goals: [
    { n: 100,
      ja: { t: 'DEEP PAY が開く',
            d: '給与を出したパイロットが100人そろった時点で、職位・機材ごとの内訳を読む DEEP PAY を開きます。' },
      en: { t: 'DEEP PAY opens',
            d: 'Once 100 pilots have shared their pay, DEEP PAY — the breakdown by position and fleet — opens.' } },
    { n: 500,
      ja: { t: '主要エアラインが「実データ」で読める',
            d: '主要な航空会社について、職位・機材ごとに実データだけで比較できる密度になります。' },
      en: { t: 'Major airlines readable from real data',
            d: 'Enough density to compare major airlines by position and fleet using submitted data alone.' } },
    { n: 1000,
      ja: { t: '国をまたいだ比較ができる',
            d: '公開情報の推定ではなく、実際に受け取った額で国をまたいだ比較ができるようになります。' },
      en: { t: 'Cross-border comparison',
            d: 'Compare across countries using what pilots actually received, not published estimates.' } },
    { n: 2000,
      ja: { t: '待遇の「動き」が見える',
            d: '同じ会社の待遇が上がったのか下がったのかを、時系列で読めるようになります。' },
      en: { t: 'Movement becomes visible',
            d: 'See whether pay at a given airline is rising or falling, over time.' } },
    { n: 5000,
      ja: { t: '世界の基準になる',
            d: 'パイロットの待遇を語るときに参照される、世界で最も信頼されるデータになります。' },
      en: { t: 'A world standard',
            d: 'The most trusted reference for what pilots are actually paid, worldwide.' } }
  ],

  /* ── ヒーローの3原則。サイト全体で守っていることだけを書く ────── */
  tenets: [
    { ja: '数字を盛らない。確かめられない数値は載せない。',
      en: 'No inflated numbers. Nothing we cannot verify gets published.' },
    { ja: '出してくれた人が、必ず何かを受け取る。',
      en: 'If you give data, you get data back.' },
    { ja: '誰が出したかは、公開しない。',
      en: 'Who submitted what is never made public.' }
  ],

  /* ── なぜ作っているのか（3枚）───────────────────────────── */
  why: [
    { ja: { t: '情報が無いまま、キャリアを決めている',
            d: '転職先の実際の年収も、手当の構成も、外からは分からない。だから多くのパイロットが、確かめようのない噂と求人票だけで人生の決断をしている。' },
      en: { t: 'Career decisions made in the dark',
            d: 'Actual pay and how it is built up are invisible from outside. Most pilots decide on rumour and a job ad.' } },
    { ja: { t: '待遇は「聞ける人がいるか」で決まってしまう',
            d: '中に知り合いがいる人だけが本当の数字を知っている。情報が人脈の有無で配られている限り、待遇の交渉も転職も公平にはならない。' },
      en: { t: 'What you know depends on who you know',
            d: 'Only pilots with a contact on the inside see real numbers. While information travels through networks, nothing is fair.' } },
    { ja: { t: '見えるようになれば、市場が動く',
            d: '待遇が比較できるようになると、良い会社に人が集まり、悪い会社は改善を迫られる。その市場原理が、世界のパイロット待遇を継続的に押し上げる。' },
      en: { t: 'Visibility moves the market',
            d: 'When pay is comparable, pilots move toward better employers and the rest have to improve. That pressure is the point.' } }
  ],

  /* ── やったこと・やっていること（1本の配列）────────────────
     ★done の日付は実際に本番へ出した日。git log と揃えてある。
     ★community:true は「みんなからの要望がきっかけで作ったもの」。
       本当にそうだったものにだけ付ける（付けると画面に札が出る）。 */
  tasks: [
    { id: 'roadmap-page', state: 'building',
      ja: { t: 'このページ（ロードマップと要望）',
            d: '運営が何を作っているかを公開し、パイロットからの要望を匿名で受け取れるようにする。' },
      en: { t: 'This page — roadmap and requests',
            d: 'Publish what we are building, and take requests from pilots anonymously.' } },

    { id: 'verified-pilot', state: 'planned',
      ja: { t: 'VERIFIED PILOT（明細で裏を取ったデータに印を付ける）',
            d: '給与明細から読み取ったデータと、手入力のデータを画面で区別する。信頼できる数字がどれかを、読む側が判断できるようにする。' },
      en: { t: 'VERIFIED PILOT — mark data backed by a payslip',
            d: 'Distinguish figures read from an actual payslip from figures typed in by hand, so readers can judge what to trust.' } },

    { id: 'public-percentile', state: 'planned',
      ja: { t: 'あなたの年収が、公開情報の中でどのあたりか',
            d: 'マイレポートに、公開されている年収レンジの中での位置を足す。順位は付けない。' },
      en: { t: 'Where your pay sits against published ranges',
            d: 'Add your position within published salary ranges to your report. No leaderboards.' } },

    { id: 'apple-login', state: 'considering',
      ja: { t: 'Apple でログイン',
            d: '海外のパイロットからの要望が増えたら着手する。まだ決めていない。' },
      en: { t: 'Sign in with Apple',
            d: 'We will build it if more pilots outside Japan ask for it. Not decided yet.' } },

    /* ── ここから下は出し終わったもの（最近のアップデートに出る）── */
    { id: 'pay-breakdown-row', state: 'done', date: '2026-09-03',
      ja: { t: '実給与の1行を押すと、その人の報酬の内訳が見られる',
            d: '固定・変動・職位手当・住宅などの構成を、金額そのものではなく帯で読む。' },
      en: { t: 'Tap a pay row to see how it was built up',
            d: 'Fixed, variable, command and housing shown as a band rather than raw figures.' } },

    { id: 'union-pay', state: 'done', date: '2026-09-02',
      ja: { t: '組合から直接支払われた分を、年収に正しく入れる',
            d: '会社の明細に載らないお金があるぶん、年収が実際より低く出ていたのを直した。' },
      en: { t: 'Pay routed through a union now counts',
            d: 'Money that never appears on the company payslip was making annual totals read low.' } },

    { id: 'deep-pay-compare', state: 'done', date: '2026-09-01',
      ja: { t: 'DEEP PAY に会社比較を足す',
            d: '2社を並べて、支給の構成まで比べられるようにした。選べる区分は必ず数字が返る。' },
      en: { t: 'Company comparison in DEEP PAY',
            d: 'Put two airlines side by side, down to how the pay is composed.' } },

    { id: 'real-pay', state: 'done', date: '2026-08-24',
      ja: { t: 'REAL PAY —— 他のパイロットの実際の給与を1行ずつ読む',
            d: '公開情報とは混ぜず、実際に受け取った額だけを並べる。給与を出した人が読める。' },
      en: { t: 'REAL PAY — other pilots’ actual pay, row by row',
            d: 'Only what pilots actually received, never mixed with published figures.' } },

    { id: 'conditions', state: 'done', date: '2026-08-19',
      ja: { t: '待遇アンケート（32問）',
            d: '年収に出てこない待遇 —— 休日・ベース・ローテーション・宿泊などを集める。' },
      en: { t: 'Working-conditions survey (32 questions)',
            d: 'The parts of a job that never show up in a salary figure.' } },

    { id: 'review-i18n', state: 'done', date: '2026-08-10',
      ja: { t: '口コミの日英自動翻訳',
            d: '日本語で書かれた口コミが英語でも、英語の口コミが日本語でも読めるようになった。' },
      en: { t: 'Reviews translated both ways',
            d: 'Japanese reviews readable in English, and English reviews in Japanese.' } },

    { id: 'payslip-redact', state: 'done', date: '2026-08-06',
      ja: { t: '給与明細を、端末の中で黒塗りしてから読み取る',
            d: '氏名・社員番号・住所が写った画像を、サーバーへ送る前に本人の端末で消す。明細そのものは保存しない。' },
      en: { t: 'Payslips redacted on your device',
            d: 'Name, employee number and address are removed before anything leaves your phone. The image itself is never stored.' } }
  ]
};
