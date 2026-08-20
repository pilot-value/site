// ─────────────────────────────────────────────────────────────────────────
// pv-conditions.mjs — 待遇・働き方の質問の単一データソース（Single Source of Truth）
//
// 年収（salary-data.mjs）と入力語彙（pv-vocab.mjs）に続く3本目の SSOT。
// ここが持つのは「各航空会社の制度について、現役パイロットに何を聞くか」。
//
// 生成: node gen-conditions.mjs
//   → pv-conditions.json          （ブラウザ用。pv-conditions.js が読む）
//   → db/conditions.generated.sql （DB の質問マスタ pv_condition_questions）
//
// ── なぜ「列」ではなく「質問の一覧」なのか ────────────────────────────
// 待遇の項目を pay_reports のように列で持つと、質問を1つ足すたびに本番の
// テーブルを変更することになる。この一覧なら、質問を足すのはこのファイルの
// 編集と upsert だけで済む。回答は airline_conditions に「1回答＝1行」で入る。
//
// ── 3つの禁じ手 ──────────────────────────────────────────────────────
// ① 主観をここに入れない。「雰囲気」「公平感」「Work-Life Balance の満足度」は
//    既に口コミ（reviews_v2 の6カテゴリ）が集めている。ここに足すと主観データが
//    2箇所に割れて、どちらも育たない。ここは**制度があるか無いか**だけ。
//    唯一の例外が PILOT VOICES 節で、そこは isOpinion を立てて会社の事実と分ける。
// ② 会社固有・日本固有の言い回しを label にしない。「OFF2」「班」は
//    会社によって通じ方が違う。何をする制度かを普通の言葉で書き、
//    社内の呼び名は help に添える。
// ③ 推測を促さない。全問に「わからない」がある。埋めた数で報酬を出さない。
//    知らない項目を埋める動機を作った時点で、このデータは価値を失う。
//
// ── これ以上、質問を増やさない ──────────────────────────────────────
// 32問。50問に増やすと、どの質問も公開に必要な k≧3 に届かないまま薄く散る。
// 高価値な質問バンクを小さく持ち、1人には毎月少しずつ聞く。
//
// ★2026-08-19、社用航空券と出退社の移動を6問だけ足して 26→32 にした（オーナー指示）。
//   提案は15問あったが、落としたのは「誰が使えるか／路線の範囲／年間上限／自己負担額／
//   タクシーが使える条件」。転職の判断が変わるのは、制度の有無・座席が確保できるか・
//   上位クラスに乗れるか・家族が使えるかの4つで、残りは細部。
//   足すたびに1問あたりの回答が薄まる。次に増やしたくなったら、まず1問減らせないか考える。
//
// ── コードを消さない ────────────────────────────────────────────────
// 質問も選択肢も、いらなくなったら消さずに active:false にする（pv-vocab.mjs と同じ）。
// 消すと、そのコードで既に入っている回答が宙に浮く。
// ─────────────────────────────────────────────────────────────────────────

/* 詳細ページの節。並ぶ順もこの順。
   ★名前は将来の航空会社ページの見出しに合わせてある —
     PAY（既存の年収）／ROSTER／CAREER／TIME OFF／BENEFITS／PILOT VOICES（既存の口コミ）。 */
export const SECTIONS = [
  { code: 'roster',   ja: '勤務スケジュール', en: 'Roster' },
  { code: 'career',   ja: 'キャリア',         en: 'Career' },
  { code: 'time_off', ja: '休暇',             en: 'Time off' },
  { code: 'benefits', ja: '手当・サポート',   en: 'Benefits' },
];

/* 「わからない」の共通コード。
   ★これを1箇所に決めておかないと、集計側が「答えた人数」を数え間違える。
     わからないは**回答として保存する**（同じ人に翌月また同じことを聞かないため）が、
     公開集計の n には数えない。3人が「わからない」と言っても、それは
     「この会社にはこの制度がある」の裏付けにはならない。 */
export const UNKNOWN = 'unknown';

/* ── 聞く頻度と、聞き直すまでの日数 ──────────────────────────────
   ★この数字を持つ場所を1つにする。gen-conditions.mjs が
     pv-conditions.json（画面が読む）と db/conditions.generated.sql の
     pv_condition_settings（next_condition_questions が読む）の**両方**へ書き出す。
     片方だけ直すと「画面は3問出すつもりなのに DB は1問しか返さない」が起きる。

   ── なぜ状態ごとに窓を変えるのか ────────────────────────────────
   「答えた」「わからない」「スキップした」は、次に聞いてよい時期が違う。
     答えた       … 制度そのものが変わるまで聞く意味がない → 1年
     わからない   … その人が知らなかっただけ。異動や昇格で分かるようになる → 半年
     スキップ     … 今は答えたくなかっただけ → 3ヶ月
   全部を1年にすると、聞けたはずの回答を1年取り逃す。
   全部を短くすると、同じ質問が何度も出て「またこれか」になる。 */
export const SETTINGS = {
  answer_reask_days:  365,   // 答えた質問をもう一度確認するまで（＝再確認の窓）
  unknown_reask_days: 180,   // 「わからない」と答えた質問を聞き直すまで
  skip_reask_days:     90,   // スキップされた質問を聞き直すまで

  /* 1回に出す問数。★給与を保存し、レポートを見せた**あと**にしか出さない。
     初回だけ3問なのは、最初の3問で1社の骨格（休み・Bidding・中途採用）が立つから。
     以後は月1問。毎月戻る理由を、負担にならない大きさで置き続ける。 */
  initial_limit:        3,   // その会社でまだ0問の人（＝3問目まで埋める）
  recurring_limit:      1,   // 2回目以降の給与提出
  profile_limit:        1,   // マイページの導線を自分で押した人

  /* レポートが描かれてからモーダルを出すまで。0だと結果を読む前に被さる。 */
  modal_delay_ms:     700,
};

/* 質問の形（kind）
     choice … 1つ選ぶ
     multi  … 複数選ぶ
     num    … 数値を入れる
     lines  … 明細行を何行でも足す（★今は使う質問が無い。将来の手当明細用に形だけ残す）

   tier      … A → B → C の順に埋める。100人から最初に集めるなら、
               全社を横並びで比較できる普遍的な項目が先。
               Landing Pay は面白いが存在しない会社が多く、横断比較の軸としては弱い＝C。
   micro     … 給与レポートの直後に1問だけ出してよいか。
               ★1タップで終わる choice だけ true。自由記述つき（note）と体感（isOpinion）は false。
                 数値入力・複数選択は kind が違うので自動的に外れる。
               ★親がある子でも true にしてよい。出す側（next_condition_questions）が
                 「その人自身が親に答えていて、答えが parentWhen に入る」ときだけ候補に入れる。
                 中途採用の扱い（external_experience_credit / external_seniority_start）は
                 今いちばん取りたいデータで、1タップで終わる。親があるという理由だけで
                 1問枠から外すのは本末転倒。
   boost     … まだ1問も答えていない人にだけ効く、最優先の並び替え（大きいほど先）。
               既定0。priority を動かすと詳細ページの節の並びまで崩れる（ROSTER の中に
               CAREER の質問が割り込む）ので、最初の3問はこちらで指定する。
   priority  … 小さいほど先に聞く。★このファイルに並んでいる順と一致させる
               （gen-conditions.mjs が昇順を検査する）。同じ会社で回答者が少ない質問が
               優先されるので、これは最後のタイブレークにしか効かない。
   isOpinion … 制度の有無ではなく本人の体感。同じ会社でも人によって答えが割れ、
               しかもどちらも正しい。公開集計で会社の事実と分けて出すための旗で、
               micro（提出直後の1問）にも出さない。★節では分けない。
               節にすると「何の話か」が読んで分からなくなるので、話が続く場所に置く。
   parent / parentWhen … 親の答えが parentWhen に入っているときだけ表示する。
   note      … 選択肢に加えて自由記述欄を出す。★自由記述は公開集計に一切出さない。
   currency  … 金額。通貨コードも一緒に保存する。
*/
export const QUESTIONS = [
  // ══ ROSTER 勤務スケジュール ═══════════════════════════════════════
  {
    id: 'days_off_request', version: 1, section: 'roster', kind: 'choice',
    tier: 'A', micro: true, priority: 10, boost: 3,   // 最初の3問①。休みを自分で決められるかは、全社を横並びにできて誰にでも答えられる
    /* ★「OFF2」を label にしない。日本の一部の会社の呼び名で、他社のパイロットには
       通じない。制度そのものを説明する文にして、呼び名は help に逃がす。 */
    ja: { label: '希望する休日の日付を指定できますか？',
          help: '自分で「この日は休みにしたい」と日付を指定できる制度です。会社によって OFF 指定・希望休などと呼ばれます。' },
    en: { label: 'Can pilots request specific days off?',
          help: 'A system where you name the calendar dates you want off. Airlines call it preferred days off, OFF request, and other names.' },
    choices: [
      { code: 'yes',     ja: 'はい',       en: 'Yes' },
      { code: 'partial', ja: '一部可能',   en: 'Partially' },
      { code: 'no',      ja: 'いいえ',     en: 'No' },
      { code: UNKNOWN,   ja: 'わからない', en: "Don't know" },
    ],
  },
  {
    id: 'days_off_request_limit', version: 1, section: 'roster', kind: 'num',
    tier: 'A', micro: false, priority: 11,
    parent: 'days_off_request', parentWhen: ['yes', 'partial'],
    num: { min: 0, max: 31, step: 1, ja: '日／月', en: 'days / month' },
    ja: { label: '月に何日まで希望できますか？', help: '' },
    en: { label: 'How many days per month can be requested?', help: '' },
  },
  {
    id: 'schedule_bidding', version: 1, section: 'roster', kind: 'choice',
    tier: 'A', micro: true, priority: 12, boost: 2,   // 最初の3問②。①と混ぜない（日付の指定と、路線・時間帯の希望は別の制度）
    ja: { label: '勤務スケジュールの希望を提出できますか？',
          help: '翌月などの勤務について、路線・ステイ先・時間帯・休日の希望を出せる制度です。PBS（Preferential Bidding System）や Bidding とも呼ばれます。' },
    en: { label: 'Can pilots submit preferences for their roster?',
          help: 'Submitting preferences for routes, layovers, time of day or days off for an upcoming period. Often called bidding or PBS (Preferential Bidding System).' },
    choices: [
      { code: 'yes',     ja: 'はい',       en: 'Yes' },
      { code: 'partial', ja: '一部可能',   en: 'Partially' },
      { code: 'no',      ja: 'いいえ',     en: 'No' },
      { code: UNKNOWN,   ja: 'わからない', en: "Don't know" },
    ],
  },
  {
    id: 'bidding_scope', version: 1, section: 'roster', kind: 'multi',
    tier: 'A', micro: false, priority: 13,
    parent: 'schedule_bidding', parentWhen: ['yes', 'partial'],
    ja: { label: 'どの希望を出せますか？', help: '当てはまるものをすべて選んでください。' },
    en: { label: 'What can be bid for?', help: 'Select all that apply.' },
    choices: [
      { code: 'days_off',    ja: '休日の日付',        en: 'Specific days off' },
      { code: 'consecutive', ja: '連休',              en: 'Consecutive days off' },
      { code: 'routes',      ja: '路線',              en: 'Routes / destinations' },
      { code: 'layovers',    ja: 'ステイ先',          en: 'Layover cities' },
      { code: 'avoid_early', ja: '早朝勤務を避ける',  en: 'Avoiding early starts' },
      { code: 'avoid_night', ja: '深夜勤務を避ける',  en: 'Avoiding night duty' },
      { code: 'turnaround',  ja: '日帰り勤務',        en: 'Turnarounds (no overnight)' },
      { code: 'block',       ja: '集中勤務',          en: 'Blocked / concentrated duty' },
      { code: 'reserve',     ja: 'Reserve・Standby',  en: 'Reserve / standby' },
      { code: 'other',       ja: 'その他',            en: 'Other' },
    ],
  },
  {
    /* ★26問で唯一「会社の事実」でない質問。制度の有無ではなく、運用の体感を聞く。
       同じ会社でも先任順位の上下で答えが割れ、しかもどちらも正しい。
       isOpinion を立てて公開集計で会社の事実と分けて出す（micro には出さない）。
       ここに置くのは、直前2問（希望休・スケジュール希望）が「出せるか」までしか
       聞いておらず、「で、実際それは通るのか」が抜けるため。節を分けると
       何の話か分からなくなるので、話が続いているこの位置に置く。 */
    id: 'seniority_effect', version: 1, section: 'roster', kind: 'choice',
    tier: 'C', micro: false, priority: 14, isOpinion: true,
    ja: { label: '休日や路線の希望は、先任順位（Seniority）で通りやすさが変わりますか？',
          help: 'あなたの実感で構いません。会社の公式な説明ではなく、体感として集めています。' },
    en: { label: 'Does seniority change how likely your day-off or route bids are granted?',
          help: 'Your impression is fine. This is collected as pilot perception, not as company policy.' },
    choices: [
      { code: 'strong', ja: '強く変わる',       en: 'Strongly' },
      { code: 'some',   ja: 'ある程度変わる',   en: 'Somewhat' },
      { code: 'little', ja: 'ほとんど変わらない', en: 'Hardly at all' },
      { code: UNKNOWN,  ja: 'わからない',       en: "Don't know" },
    ],
  },
  {
    id: 'reserve_duty', version: 1, section: 'roster', kind: 'choice',
    tier: 'A', micro: true, priority: 15,
    /* ★「ある／ない」の間に「一部のパイロットのみ」を置く。若手だけ、
       特定の基地だけ、という会社が実在し、二択にすると回答が割れて読めなくなる。 */
    ja: { label: 'Reserve / Standby 勤務はありますか？',
          help: '呼び出しに備えて待機する勤務です。会社によって Reserve・Standby・予備勤務などと呼ばれます。' },
    en: { label: 'Is there reserve / standby duty?',
          help: 'Duty where you stay available to be called out to fly. Airlines call it reserve, standby or similar.' },
    choices: [
      { code: 'yes',         ja: 'ある',                 en: 'Yes' },
      { code: 'some_pilots', ja: '一部のパイロットのみ', en: 'Some pilots only' },
      { code: 'no',          ja: 'ない',                 en: 'No' },
      { code: UNKNOWN,       ja: 'わからない',           en: "Don't know" },
    ],
  },
  {
    id: 'reserve_location', version: 1, section: 'roster', kind: 'choice',
    tier: 'A', micro: true, priority: 16,
    parent: 'reserve_duty', parentWhen: ['yes', 'some_pilots'],
    /* ★自宅待機と空港待機では拘束の重さが全く違う。年収が同じでも仕事の価値が変わる。 */
    ja: { label: 'Reserve は自宅待機ですか、空港待機ですか？', help: '' },
    en: { label: 'Is reserve served at home or at the airport?', help: '' },
    choices: [
      { code: 'home',    ja: '自宅待機',   en: 'At home' },
      { code: 'airport', ja: '空港待機',   en: 'At the airport' },
      { code: 'both',    ja: '両方ある',   en: 'Both exist' },
      { code: UNKNOWN,   ja: 'わからない', en: "Don't know" },
    ],
  },
  {
    id: 'reserve_days', version: 1, section: 'roster', kind: 'num',
    tier: 'A', micro: false, priority: 17,
    parent: 'reserve_duty', parentWhen: ['yes', 'some_pilots'],
    num: { min: 0, max: 31, step: 1, ja: '日／月', en: 'days / month' },
    ja: { label: '月に平均何日くらいですか？', help: '直近の実感で構いません。' },
    en: { label: 'How many days per month on average?', help: 'A recent typical month is fine.' },
  },
  {
    id: 'roster_lead_days', version: 1, section: 'roster', kind: 'num',
    tier: 'A', micro: false, priority: 18,
    num: { min: 1, max: 90, step: 1, ja: '日前', en: 'days before' },
    ja: { label: '翌月の勤務予定は、何日前に確定しますか？',
          help: '月末の何日前に翌月分が出るか、の目安です。' },
    en: { label: 'How far in advance is next month’s roster published?',
          help: 'Roughly how many days before the month starts.' },
  },
  {
    id: 'roster_changes', version: 1, section: 'roster', kind: 'choice',
    tier: 'A', micro: true, priority: 19,
    /* ★給与が同じでも「1ヶ月前に確定・ほぼ変更なし」と「直前変更が多い」では
       仕事の価値が違う。年収表には絶対に出てこない差。 */
    ja: { label: '確定後の勤務変更は多いですか？',
          help: '一度出たスケジュールが、あとから会社都合で変わる頻度です。' },
    en: { label: 'How often does the published roster change afterwards?',
          help: 'How frequently a published schedule is changed by the company.' },
    choices: [
      { code: 'rare',      ja: 'ほとんどない', en: 'Rarely' },
      { code: 'sometimes', ja: '時々ある',     en: 'Sometimes' },
      { code: 'often',     ja: '多い',         en: 'Often' },
      { code: UNKNOWN,     ja: 'わからない',   en: "Don't know" },
    ],
  },

  // ══ CAREER キャリア ═══════════════════════════════════════════════
  {
    id: 'external_hiring', version: 1, section: 'career', kind: 'choice',
    tier: 'A', micro: true, priority: 20, boost: 1,   // 最初の3問③。このサイトに来る理由そのもの。中途で入れるかが分からないと転職の話が始まらない
    /* ★「制度としてあるか」と「今まさに募集中か」を混ぜない。混ぜると
       募集が閉じた月に全社が「いいえ」に振れて、制度の記録として使えなくなる。 */
    ja: { label: '他社からパイロットとして中途入社できますか？',
          help: '制度としてあるかどうかを聞いています。今まさに募集中かどうかとは別です。' },
    en: { label: 'Can pilots join from another airline?',
          help: 'Whether the pathway exists — not whether a vacancy is open right now.' },
    choices: [
      { code: 'yes',         ja: 'はい',           en: 'Yes' },
      { code: 'conditional', ja: '条件付きで可能', en: 'Under conditions' },
      { code: 'rare',        ja: '現在はほぼ不可', en: 'Almost never now' },
      { code: 'no',          ja: 'いいえ',         en: 'No' },
      { code: UNKNOWN,       ja: 'わからない',     en: "Don't know" },
    ],
  },
  {
    id: 'external_experience_credit', version: 1, section: 'career', kind: 'choice',
    tier: 'A', micro: true, priority: 21,
    parent: 'external_hiring', parentWhen: ['yes', 'conditional'],
    /* ★「入社時の待遇」と「社内の先任順位」は別物。他社で B777 機長を10年やって
       いても、Rank と給与ステップには考慮されるが Seniority は入社日から最下位、
       という会社が実在する。1問に畳むと、その会社のデータが取れない。 */
    ja: { label: '他社でのパイロット経験は、入社時の待遇（Rank・給与ステップ）に考慮されますか？',
          help: '入社時点の職位と給与の号数に、前職の経験がどれくらい反映されるかです。' },
    en: { label: 'Does prior airline experience count towards your starting rank and pay step?',
          help: 'How much previous flying counts when your entry rank and pay step are set.' },
    choices: [
      { code: 'major',        ja: '大きく考慮される',   en: 'Counts substantially' },
      { code: 'partial',      ja: '一部考慮される',     en: 'Counts partially' },
      { code: 'minimal',      ja: 'ほぼ考慮されない',   en: 'Hardly counts' },
      { code: 'case_by_case', ja: 'ケースによる',       en: 'Case by case' },
      { code: UNKNOWN,        ja: 'わからない',         en: "Don't know" },
    ],
  },
  {
    id: 'external_seniority_start', version: 1, section: 'career', kind: 'choice',
    tier: 'A', micro: true, priority: 22,
    parent: 'external_hiring', parentWhen: ['yes', 'conditional'],
    ja: { label: '中途入社した場合、社内の先任順位（Seniority）はどこから始まりますか？',
          help: '昇格・機種選択・希望の通りやすさを決める社内の順位のことです。' },
    en: { label: 'Where does your seniority start if you join from another airline?',
          help: 'The internal seniority list that drives upgrade, fleet choice and bidding.' },
    choices: [
      { code: 'from_join',    ja: '入社日ベースで新規',     en: 'From date of joining' },
      { code: 'credited',     ja: '過去経験の Credit あり', en: 'Prior experience is credited' },
      { code: 'case_by_case', ja: 'ケースによる',           en: 'Case by case' },
      { code: UNKNOWN,        ja: 'わからない',             en: "Don't know" },
    ],
  },
  {
    id: 'training_bond', version: 1, section: 'career', kind: 'choice',
    tier: 'A', micro: true, priority: 23,
    /* ★「年収 +500万、ただし Bond あり」を比べられるようにするための質問。
       年収だけの表では絶対に見えない条件。 */
    ja: { label: '入社時の訓練費用に、Bond・返済義務がありますか？',
          help: '一定期間内に辞めると訓練費用の返済を求められる取り決めのことです。' },
    en: { label: 'Is there a training bond or repayment obligation on joining?',
          help: 'An agreement to repay training costs if you leave within a certain period.' },
    choices: [
      { code: 'yes',         ja: 'ある',       en: 'Yes' },
      { code: 'conditional', ja: '条件付き',   en: 'Under conditions' },
      { code: 'no',          ja: 'ない',       en: 'No' },
      { code: UNKNOWN,       ja: 'わからない', en: "Don't know" },
    ],
  },
  {
    id: 'training_bond_years', version: 1, section: 'career', kind: 'num',
    tier: 'A', micro: false, priority: 24,
    parent: 'training_bond', parentWhen: ['yes', 'conditional'],
    num: { min: 0.5, max: 15, step: 0.5, ja: '年', en: 'years' },
    ja: { label: '拘束期間は何年ですか？', help: '' },
    en: { label: 'How many years does the bond run for?', help: '' },
  },
  {
    id: 'training_bond_amount', version: 1, section: 'career', kind: 'num',
    tier: 'A', micro: false, priority: 25,
    parent: 'training_bond', parentWhen: ['yes', 'conditional'],
    currency: true,
    num: { min: 0, max: 100000000, step: 1, ja: '（総額）', en: '(total)' },
    ja: { label: '金額はいくらですか？', help: '入社時点の総額で構いません。' },
    en: { label: 'How much is the bond?', help: 'The full amount at the time of joining is fine.' },
  },
  {
    id: 'upgrade_years', version: 1, section: 'career', kind: 'num',
    tier: 'A', micro: false, priority: 26,
    num: { min: 0.5, max: 30, step: 0.5, ja: '年', en: 'years' },
    ja: { label: '副操縦士から機長まで、今どれくらいかかりますか？',
          help: '今の目安で構いません。会社の規定年数ではなく、実際にかかっている年数です。' },
    en: { label: 'How long does it currently take to upgrade from First Officer to Captain?',
          help: 'A current estimate is fine — the time it actually takes, not the published minimum.' },
  },
  {
    id: 'external_hiring_types', version: 1, section: 'career', kind: 'multi',
    tier: 'B', micro: false, priority: 30,
    parent: 'external_hiring', parentWhen: ['yes', 'conditional'],
    ja: { label: 'どの形の採用がありますか？', help: '当てはまるものをすべて選んでください。' },
    en: { label: 'What forms of external hiring exist?', help: 'Select all that apply.' },
    choices: [
      { code: 'fo',         ja: '副操縦士採用',         en: 'First Officer entry' },
      { code: 'captain',    ja: '機長採用',             en: 'Captain entry' },
      { code: 'dec',        ja: 'Direct Entry Captain', en: 'Direct Entry Captain' },
      { code: 'type_rated', ja: '型式限定保持者のみ',   en: 'Type-rated candidates only' },
      { code: 'other',      ja: 'その他',               en: 'Other' },
    ],
  },
  {
    id: 'cadet_program', version: 1, section: 'career', kind: 'choice',
    tier: 'B', micro: true, priority: 31,
    /* ★「制度があるか」と「今も採っているか」を1問に畳んだ。2問に割ると
       タップが1回増えるだけで、分かることは同じ。 */
    ja: { label: '自社養成パイロット制度はありますか？',
          help: '未経験から自社で訓練して操縦士にする制度です。' },
    en: { label: 'Is there a cadet programme?',
          help: 'Training ab-initio candidates into pilots in-house.' },
    choices: [
      { code: 'regular',   ja: 'あり・定期的に採用',   en: 'Yes — recruits regularly' },
      { code: 'irregular', ja: 'あり・不定期',         en: 'Yes — irregularly' },
      { code: 'suspended', ja: 'あり・現在は募集停止', en: 'Yes — currently suspended' },
      { code: 'no',        ja: 'ない',                 en: 'No' },
      { code: UNKNOWN,     ja: 'わからない',           en: "Don't know" },
    ],
  },
  {
    id: 'fo_development', version: 1, section: 'career', kind: 'choice',
    tier: 'B', micro: true, priority: 32,
    /* ★「班」を label にしない。会社固有語。help で例として挙げるに留める。 */
    ja: { label: '副操縦士の成長を継続的に支援する制度がありますか？',
          help: 'メンター・班・定期フィードバック・キャリア面談など、通常の定期訓練とは別に成長を支える仕組みです。' },
    en: { label: 'Is there ongoing support for First Officer development?',
          help: 'Mentoring, team structures, regular feedback or career conversations — separate from routine recurrent training.' },
    choices: [
      { code: 'formal',   ja: '体系的な制度がある',       en: 'A formal programme exists' },
      { code: 'informal', ja: '非公式な制度や文化がある', en: 'Informal, cultural only' },
      { code: 'none',     ja: '特にない',                 en: 'Nothing in particular' },
      { code: UNKNOWN,    ja: 'わからない',               en: "Don't know" },
    ],
  },

  // ══ TIME OFF 休暇 ═════════════════════════════════════════════════
  {
    id: 'annual_leave_days', version: 1, section: 'time_off', kind: 'num',
    tier: 'A', micro: false, priority: 40,
    num: { min: 0, max: 60, step: 1, ja: '日／年', en: 'days / year' },
    ja: { label: '年間の有給休暇は何日ですか？',
          help: '勤続年数や契約で変わる場合は、今のあなたの日数で構いません。' },
    en: { label: 'How many days of annual paid leave are there?',
          help: 'If it varies by seniority or contract, your own current entitlement is fine.' },
  },
  {
    id: 'sick_leave', version: 1, section: 'time_off', kind: 'choice',
    tier: 'A', micro: true, priority: 41,
    ja: { label: '病気休暇（Sick Leave）はどれくらい使えますか？',
          help: '有給休暇とは別に、病気のときに使える休暇のことです。' },
    en: { label: 'How much sick leave is available?',
          help: 'Leave for illness, separate from annual paid leave.' },
    choices: [
      { code: 'days',      ja: '日数が決まっている',   en: 'A fixed number of days' },
      { code: 'unlimited', ja: '規定により実質無制限', en: 'Effectively unlimited under policy' },
      { code: 'varies',    ja: '勤続年数などで変わる', en: 'Varies by seniority or contract' },
      { code: 'none',      ja: '制度としては無い',     en: 'No such entitlement' },
      { code: UNKNOWN,     ja: 'わからない',           en: "Don't know" },
    ],
  },
  {
    id: 'sick_leave_days', version: 1, section: 'time_off', kind: 'num',
    tier: 'A', micro: false, priority: 42,
    parent: 'sick_leave', parentWhen: ['days'],
    num: { min: 0, max: 365, step: 1, ja: '日／年', en: 'days / year' },
    ja: { label: '年間で何日ですか？', help: '' },
    en: { label: 'How many days per year?', help: '' },
  },

  // ══ BENEFITS 手当・サポート ═══════════════════════════════════════
  {
    id: 'peer_support', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 50,
    /* ★表記は Peer Support で固定（オーナー指示）。訳さない。 */
    ja: { label: 'パイロット向けの Peer Support 制度がありますか？',
          help: 'パイロット同士、または専門スタッフを通じて、心理的・職業上の相談ができる仕組みです。' },
    en: { label: 'Is there a Peer Support programme for pilots?',
          help: 'A route to confidential psychological or professional support, through fellow pilots or trained staff.' },
    choices: [
      { code: 'internal', ja: 'あり・社内制度', en: 'Yes — in-house' },
      { code: 'external', ja: 'あり・外部委託', en: 'Yes — external provider' },
      { code: 'both',     ja: 'あり・両方',     en: 'Yes — both' },
      { code: 'no',       ja: 'ない',           en: 'No' },
      { code: UNKNOWN,    ja: 'わからない',     en: "Don't know" },
    ],
  },
  {
    id: 'landing_pay', version: 1, section: 'benefits', kind: 'choice',
    /* ★Tier C。存在しない会社が多く、世界横断で比べる軸としては弱い。
       ある会社では効くので残すが、A と B が埋まってから聞く。 */
    tier: 'C', micro: true, priority: 55,
    ja: { label: '着陸回数に応じた手当はありますか？',
          help: '1回の着陸（またはレグ）ごとに払われる手当です。' },
    en: { label: 'Is there a landing allowance?',
          help: 'Pay per landing or per sector flown.' },
    choices: [
      { code: 'fixed',    ja: 'あり・1回あたり一定額', en: 'Yes — a fixed amount per landing' },
      { code: 'variable', ja: 'あり・一定額ではない',   en: 'Yes — but the amount varies' },
      { code: 'no',       ja: 'ない',                   en: 'No' },
      { code: UNKNOWN,    ja: 'わからない',             en: "Don't know" },
    ],
  },
  {
    id: 'ground_duty_pay', version: 1, section: 'benefits', kind: 'choice',
    /* ★自由記述をいちばん使ってほしい質問。会社ごとに制度が複雑で、
       1つの数値に丸めると意味が失われる（地上業務1時間＝乗務◯時間相当、など）。
       ★micro にしない。1タップで終わらせると note が空のまま埋まる。 */
    tier: 'C', micro: false, priority: 56, note: true,
    ja: { label: '乗務以外の会社業務に、手当や勤務時間上の補償がありますか？',
          help: '会議・訓練担当・事務など、乗務でない業務に対する扱いです。「地上業務1時間＝乗務◯時間相当」のような換算がある場合は、補足に書いてください。' },
    en: { label: 'Is non-flying company work compensated, in pay or in duty credit?',
          help: 'Meetings, training duties, office work. If ground time converts into credited flying time at some ratio, please describe it in the note.' },
    choices: [
      { code: 'yes',          ja: 'はい',         en: 'Yes' },
      { code: 'case_by_case', ja: 'ケースによる', en: 'Case by case' },
      { code: 'no',           ja: 'いいえ',       en: 'No' },
      { code: UNKNOWN,        ja: 'わからない',   en: "Don't know" },
    ],
  },

  {
    /* ── 社用航空券（2026-08-19 追加・オーナー指示） ───────────────────
       ★親だけ Tier A。ほぼ全社にあり、世界中を横並びで比べられる。
         子3問は B（制度がある会社の中での差なので、A が埋まってから）。
       ★「一部のパイロットのみ」は実在する。契約形態（現地採用と Expat 契約）で
         使える範囲が変わる会社があり、二択にすると回答が割れて読めなくなる。 */
    id: 'staff_travel', version: 1, section: 'benefits', kind: 'choice',
    tier: 'A', micro: true, priority: 57,
    ja: { label: '自社便に割引や無料で乗れる社員向けの航空券制度がありますか？',
          help: '社員やその家族が割引・無料で乗れる制度です。ID チケット、スタッフトラベルなどと呼ばれます。' },
    en: { label: 'Is there a staff travel scheme — free or reduced-fare tickets on your own airline?',
          help: 'Discounted or free tickets for employees and their family. Often called ID tickets or staff travel.' },
    choices: [
      { code: 'yes',         ja: 'ある',                 en: 'Yes' },
      { code: 'some_pilots', ja: '一部のパイロットのみ', en: 'Some pilots only' },
      { code: 'no',          ja: 'ない',                 en: 'No' },
      { code: UNKNOWN,       ja: 'わからない',           en: "Don't know" },
    ],
  },
  {
    /* ★制度の価値がいちばん割れるのはここ。「ある」だけでは、12時間の路線で
       本当に家に帰れるのかが分からない。空席待ちのみと座席確保では別物。 */
    id: 'staff_travel_booking', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 58,
    parent: 'staff_travel', parentWhen: ['yes', 'some_pilots'],
    ja: { label: 'その席は空席待ちですか、確保できますか？',
          help: '出発まで席が決まらない空席待ち（Standby）か、あらかじめ席を押さえられるかです。' },
    en: { label: 'Are those seats standby, or can they be confirmed?',
          help: 'Whether you wait for a free seat at the gate, or can hold a seat in advance.' },
    choices: [
      { code: 'standby',   ja: '空席待ちのみ',     en: 'Standby only' },
      { code: 'both',      ja: '両方ある',         en: 'Both exist' },
      { code: 'confirmed', ja: '座席を確保できる', en: 'Seats can be confirmed' },
      { code: UNKNOWN,     ja: 'わからない',       en: "Don't know" },
    ],
  },
  {
    id: 'staff_travel_cabin', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 59,
    parent: 'staff_travel', parentWhen: ['yes', 'some_pilots'],
    ja: { label: 'ビジネスクラスなど上位クラスに乗れますか？',
          help: '上位クラスに乗れるか、乗れる場合に誰から優先されるかです。' },
    en: { label: 'Can you travel in a premium cabin such as business class?',
          help: 'Whether premium cabins are available, and who gets them first.' },
    choices: [
      { code: 'by_rank',      ja: '職位・勤続で優先順位が決まる', en: 'Yes — priority by rank or seniority' },
      { code: 'if_available', ja: '空席があれば乗れる',           en: 'Yes — if seats are free' },
      { code: 'economy',      ja: 'エコノミーのみ',               en: 'Economy only' },
      { code: UNKNOWN,        ja: 'わからない',                   en: "Don't know" },
    ],
  },
  {
    id: 'staff_travel_family', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 60,
    parent: 'staff_travel', parentWhen: ['yes', 'some_pilots'],
    ja: { label: '家族も使えますか？', help: '本人以外がどこまで使えるかです。' },
    en: { label: 'Can family members use it?', help: 'How far beyond the employee the scheme reaches.' },
    choices: [
      { code: 'self',    ja: '本人のみ',               en: 'Employee only' },
      { code: 'partner', ja: '配偶者・パートナーまで', en: 'Spouse or partner too' },
      { code: 'family',  ja: '子や親も',               en: 'Children and parents too' },
      { code: UNKNOWN,   ja: 'わからない',             en: "Don't know" },
    ],
  },
  {
    /* ── 出退社の移動（2026-08-19 追加・オーナー指示） ─────────────────
       ★毎月定額で出る通勤手当と混ぜない。あれは給与明細の「交通費」で
         既に集めている（payslip.js の f-transport）。同じものを2箇所で
         集めると、どちらの数字も何を指すのか分からなくなる。
       ★Tier B。日本と一部の会社に強く偏り、横断比較の軸としては社用航空券より弱い。 */
    id: 'commuting_transport', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 65,
    ja: { label: '出社・帰宅の移動を、会社が用意または負担しますか？',
          help: '会社が手配するタクシー、クルーバス、あとから精算する運賃などです。毎月定額で出る通勤手当のことではありません。' },
    en: { label: 'Does the company provide or pay for your travel to and from work?',
          help: 'Company-arranged taxis, crew buses or fares reimbursed afterwards. Not the fixed monthly commuting allowance.' },
    choices: [
      { code: 'always',      ja: 'いつでも使える',                   en: 'Yes — any time' },
      { code: 'conditional', ja: '条件付きで使える（早朝・深夜など）', en: 'Yes — under certain conditions' },
      { code: 'no',          ja: 'ない',                             en: 'No' },
      { code: UNKNOWN,       ja: 'わからない',                       en: "Don't know" },
    ],
  },
  {
    /* ★複数選択。タクシーとクルーバスの両方がある会社が普通にあるので、
       1つ選ばせると片方が消える。複数選択は1問枠（micro）には出ないので、
       詳細ページで集まる。 */
    id: 'commuting_transport_method', version: 1, section: 'benefits', kind: 'multi',
    tier: 'B', micro: false, priority: 66,
    parent: 'commuting_transport', parentWhen: ['always', 'conditional'],
    ja: { label: 'どの形で提供されますか？', help: '当てはまるものをすべて選んでください。' },
    en: { label: 'How is it provided?', help: 'Select all that apply.' },
    choices: [
      { code: 'company_taxi', ja: '会社が手配するタクシー',     en: 'Taxi arranged by the company' },
      { code: 'reimburse',    ja: '自分で乗って後から精算',     en: 'You travel and claim it back' },
      { code: 'crew_bus',     ja: '送迎バス・クルーバス',       en: 'Company or crew bus' },
      { code: 'hotel',        ja: '前泊や仮眠室で対応',         en: 'Pre-duty hotel or rest room instead' },
      { code: 'other',        ja: 'その他',                     en: 'Other' },
    ],
  },
];

/* 自由記述の上限。DB 側の check 制約と画面の maxlength を同じ数にするため
   ここから配る。★長い文章は個人特定の材料になるので、そもそも長く書かせない。 */
export const TEXT_MAX = 300;

/* 明細行（kind:'lines'）の上限。★今この形の質問は無い（手当の明細は見送り）。
   縦持ちなので、足すときは DB を変えずにこのファイルの編集だけで済む。
   そのとき上限を決め直さずに済むよう、値と検証だけ先に置いておく。 */
export const LINES_MAX = 10;
export const LINE_NAME_MAX = 40;
