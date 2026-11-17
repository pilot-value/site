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
// 48問。これ以上増やすと、どの質問も公開に必要な k≧3 に届かないまま薄く散る。
// 高価値な質問バンクを小さく持ち、1人には毎月少しずつ聞く。
// （48 ＝ 一覧に出す数。話題の入口からだけ出す4問は別に在る
//   ＝ 下の 2026-10-04 の2つ目の注記。48 のうち5問は着陸手当に「あり」と答えた人にしか
//   出ない子の質問 ＝ 下の 2026-10-09 の注記。）
//
// ★2026-11-17 オーナー判断で、一覧に出る質問を 51 → 54 にした（質問の見直し・段階C の案1〜24 のうち採用分）。
//   ・止めた（下の RETIRED）：社員航空券の「家族も使えますか？」（staff_travel_family ── 券ごとの「誰が使えますか？」2問に任せる）／
//     「副操縦士の育成支援」（fo_development ── Loss of Licence の補償と入れ替え）／
//     月の希望日数の数の欄（days_off_request_limit）と上位クラスの1つ選ぶ（staff_travel_cabin）は、意味が変わるので新しい id へ。
//   ・足した：パイロットの定年・Loss of Licence の補償・Commuting（＋「一部」の続き）・自宅待機の出頭までの時間（待機場所の続き）・
//     日当の出方（日当の続き）。入れ替えの2つ（月の希望日数・上位クラス）は数が変わらない。続きの質問は今までどおり数えない。
//   増やすのはこの回が最後のつもりで足した。次に足したくなったら、先に1問減らせないか考える。

// ★2026-11-14、続きの質問（deep）を21問足した（オーナー指示「一部可能にはもう一つ突っ込んで質問して欲しい。
//   あと回答が分かれている場合も」）。6問は「一部」の答えの続き、15問は答えが分かれた会社でだけ聞く「何によって違うか」
//   （型から作る ＝ 下の withSplit）。どちらも一覧の行にも「答えた項目」の数にも入れない ＝ 上の数は変わらない。
//   差し込む場所を空けるため priority をすべて10倍にした（並ぶ順は1つも変わらない）。下の注記にある番号は10倍する前のもの。
//
// ★2026-11-16、続きの質問21問と着陸手当の「何で変わるか」を**複数選ぶ**にした（オーナー承認。会員の声
//   「いくつも当てはまるときは何を選べばいい？」「答えの選択肢をもっと増やして」「自分で答えを書けるその他が欲しい」）。
//   ・「いくつか当てはまる・その他」（mixed）は外した。当てはまるものを全部選んでもらう（「わからない」は画面が足す）。
//   ・どの問も最後に「その他」（other）を置き、選んだ人にだけ1行の欄（100字まで）を出す（otherText）。
//     書いた字は答えと一緒に answer_text へ入る。会社ページに出すのは**運営が「載せる」を押した字だけ**
//     （admin.html の「その他の答え」・db/contrib.sql の admin_other_text_decide）。ほかの補足は今までどおり。
//   ・選択肢を足した（コードは足すだけ・今までのコードは1つも変えていない）。mixed で入っていた答えは other として読む
//     （db/airline-conditions.sql の pv_condition_clean と、既存の行を直す1回の update）。
//
// ★2026-08-19、社用航空券と出退社の移動を6問だけ足して 26→32 にした（オーナー指示）。
//   提案は15問あったが、落としたのは「誰が使えるか／路線の範囲／年間上限／自己負担額／
//   タクシーが使える条件」。転職の判断が変わるのは、制度の有無・座席が確保できるか・
//   上位クラスに乗れるか・家族が使えるかの4つで、残りは細部。
//   足すたびに1問あたりの回答が薄まる。次に増やしたくなったら、まず1問減らせないか考える。
//
// ★2026-10-04、そのとき落とした「誰が使えるか／年間上限／自己負担額／タクシーが使える条件」を、
//   **制度の条件がそのまま伝わる形**で11問足して 32→43 にした（オーナー指示）。
//   会社の概要の画面で「まだ分からない」と出す項目から、その質問へ直接来られるように
//   したため（?airline=…&q=<鍵>）。
//   ・社員向けの航空券の回数・本人の負担・使える人は、**券の種類ごとに別の質問**にした
//     （空席待ち／座席を確保できる、で3問ずつ＝6問）。同じ日の最初の版は
//     「券の種類で違うときは、合わせた回数で」と1問で聞いていて、回数に上限の無い
//     空席待ちの券と、回数が決まっている券が1つの答えに混ざった（本番へ出す前に作り直した）。
//     親は staff_travel_booking ＝ 券の種類そのもの。「両方ある」の人には両方が出る。
//     使える人も同じ。券の種類で対象が違う制度（片方は親まで・もう片方は本人だけ、のような形）は、
//     共通の1問（本番の staff_travel_family）では書き分けられない。あちらは本番に在るので
//     そのまま残し、内訳（子／親／きょうだい／指名した人）は券の種類ごとの複数選択で聞く。
//     （共通の1問は 2026-11-17 に止めた ── 冒頭の 2026-11-17 の注記）
//   ・出社・帰宅の移動は、**手段ごとに別の質問**にした（タクシー3問・クルーバス2問＝5問）。
//     同じ日の2つ目の版は「どんなときに／どこまで／誰が負担するか」を手段をまとめて1問ずつ
//     聞いていて、手段ごとに条件が違う制度（片方はいつでも・会社が全額、もう片方は時間が
//     限られて一部は本人、のような形）が1つの答えに混ざった（これも本番へ出す前に作り直した）。
//     親は commuting_transport_method（複数選択）＝ 手段そのもの。両方を選んだ人には5問とも出る。
//   ⚠️ 回数も負担も**段で聞く**（数値の欄にしない）。上限が無い会社は数値で答えられない。
//      額・距離・時刻は聞かない（路線と地域で変わり、1つの数字に丸めると何の数か分からなくなる）。
//   ⚠️ 「券の種類によって違う」「手段によって違う」「合わせた回数」という選択肢・説明を置かない
//      （それが直した対象）。違うものは別の質問で聞く。
//   ⚠️ 11問とも子の質問で Tier B ＝ 親の答えが条件に合う人にしか出ない。
//      11問とも**親が2段**（staff_travel → staff_travel_booking → 6問／
//      commuting_transport → commuting_transport_method → 5問）。
//      画面（pv-conditions.js の visible）もサーバ（db/airline-conditions.sql の
//      pv_condition_links）も、**いちばん上の親まで**条件が続いているかを見る。
//      すぐ上の親だけを見ると、制度を「ない」に答え直した人の古い回数が出続け、数えられ続ける。
//   ⚠️ すぐ上の親が**複数選択**のとき（移動の5問）は、選んだものの中に parentWhen が
//      1つでも入っていれば条件に合う。バスだけを選んだ人にタクシーの質問は出ない・送っても
//      受け取らない・数えない（db/test-conditions.mjs の ⑱ が見ている。使える人は ⑲）。
//   ⚠️ 本番に在った32問の priority は、出社・帰宅の2問だけ 65・66 → 67・68 へ動かした
//      （航空券の質問を6つ並べる場所が 61〜64 の4つしか無かった）。並ぶ順は変わらない。
//
// ★2026-10-04、同じ日のオーナー判断「4問を足し、その話題の入口から来た人にだけ出す」で、
//   上の「これ以上増やさない」を**この4問についてだけ**上書きした（質問マスタは 43→47）。
//   会社の概要の画面には話題ごとの入口がある（通勤タクシー／社員向け航空券／機長昇格）。
//   そこから来た人には、その話題を具体的に聞く（オーナー指示「タクシーは利用できる勤務・
//   時間帯・地域、配車か立替か、自己負担と上限。機長昇格も、経験や条件を具体的に聞く。
//   選択式を中心にし、詳しい説明は任意にする」）。
//   足したのは、通勤のタクシー代の上限（commuting_taxi_cap）と、機長昇格の3問
//   （upgrade_order／upgrade_min_hours／upgrade_min_tenure）。
//   ・4問とも topicOnly ＝ **提出直後の1問枠にも、一覧にも混ぜない。** 出すのは話題の入口だけ。
//     だから、一覧に出る質問（この日は43問・いまは48問）に集まる回答は薄まらない
//     （上書きしてよい理由はこれ1つ）。
//     一覧の「あなたが答えた項目：N／48」の分母にも分子にも数えない
//     （db/airline-conditions.sql の questions_total／answered_total／mine_count）。
//   ・topic は「どの入口から来た人に、どの質問をまとめて出すか」の印。枝ごと同じ話題にする
//     （親に在るのに子に無い、を gen-conditions.mjs が落とす）。今までの質問にも付けたが、
//     **付いただけでは出方は1つも変わらない**（変えるのは topicOnly のほう）。
//   ⚠️ topicOnly を今までの質問に付けない。付けた瞬間に一覧と1問枠から消え、分母も減る。
//   ⚠️ 「一覧に出ないから何問でも足せる」ではない。話題の入口に並ぶ問数が増えるほど、
//      入口で離れる人が増える。足すのは今までどおり判断が要る。
//   ⚠️ タクシー代の上限は**額を聞かない**（上の「額・距離・時刻は聞かない」のまま）。
//      聞くのは上限の形だけ。額を書ける人は任意の補足へ（自由記述は公開集計に出ない）。
//      機長昇格の時間と年数も段で聞く（条件が無い会社は数値で答えられない）。
//   ⚠️ 上限の質問を費用の質問（commuting_taxi_cost）のすぐ後ろへ置くために、クルーバスの
//      2問の priority を 72・73 → 73・74 へ動かした。並ぶ順は変わらない。
//
// ★2026-10-09、着陸手当（landing_pay）に「あり」と答えた人へ、その場で額と数え方を聞く5問を足して
//   43→48 にした（質問マスタは 47→52）。オーナー指示「一定額なら通貨＋1回あたりの額＋単位
//   （着陸／レグ）をその場で質問。変動なら金額／幅は任意＋変動条件の補足。なし／不明では出さない」。
//   ・「あり・1回あたり一定額」の人に2問 ── 額（landing_pay_amount）と、何を1回と数えるか
//     （landing_pay_unit）。
//   ・「あり・一定額ではない」の人に3問 ── 低いほうの額・高いほうの額（どちらも任意・片方だけでよい）と、
//     何で変わるか（landing_pay_varies_by・補足つき）。
//   ・5問とも子の質問 ＝ 親の答えが条件に合う人にしか出ない。「ない」「わからない」の人には1問も出ない。
//     2つの枝は**同時には出ない**ので、1人が48問ぜんぶに答えることは無い（N／48 の N は 48 に届かない）。
//   ・機種・職位・いつの時点の話かは、親と同じ1回の送信で運ばれる（子のために聞き直さない）。
//   ⚠️ 上の「額は聞かない」は、路線と地域で変わるもの（タクシー代・航空券の負担）の話。
//      着陸手当は明細や規程に1回分の額が書いてあるので、**額を通貨と一緒に**聞く。
//   ⚠️ 額の下限は 1。0 を「答えた」として保存させない（未回答は 0 ではない）。
//   ⚠️ 通貨の違う額を1つの数字にまとめない。公開集計の中央値は、通貨つきの質問では出さない
//      （db/airline-conditions.sql の 9）。低いほう・高いほうも別々の行のまま持つ。
//   ⚠️ 額の質問を、会社ページの箱（gen-airline-glance.mjs の WORK_ASK／BEN_ASK／LIVE_ASK）へ入れない。
//      あの箱は通貨なしで数字だけを出す。入れると gen-airline-glance.mjs が止める。
//   ⚠️ 親を「ない」に答え直しても、子の行は消さない（答え直せば戻る）。そのかわり**数えない・出さない**
//      （サーバは pv_condition_links・シートは pv-contrib.js の chainSaved）。
//   ・子を親のすぐ後ろへ並べるために、peer_support の priority を 50 → 49、landing_pay を 55 → 50 へ
//     動かした。並ぶ順は変わらない。
//
// ── コードを消さない ────────────────────────────────────────────────
// 質問も選択肢も、いらなくなったら消さずに active:false にする（pv-vocab.mjs と同じ）。
// 消すと、そのコードで既に入っている回答が宙に浮く。
// ★質問を止めるときは、下の BASE から外して RETIRED に id を足す。db/conditions.generated.sql が台帳に無い id を
//   active = false にする（行も答えも消さない）。止めた質問の答えは、公開の集計にも「答えた項目」にも数えない
//   （db/airline-conditions.sql と db/contrib.sql が q.active で外す）。
// ★止めた id を別の意味の質問に使い回さない（使い回すと、古い答えが新しい質問の答えとして生き返る）。gen-conditions.mjs が止める。
// ★選択肢を外したときの古い答えは書き換えない（選択肢から外れた答えは会社ページに出ない）。言い換えて同じ意味の
//   選択肢へ寄せられるときだけ、db/airline-conditions.sql の1回だけの update で寄せる（例：中途採用の「機長採用」→ DEC）。
// ─────────────────────────────────────────────────────────────────────────

/* 止めた質問の id（2026-11-17〜）。ここに在る id は QUESTIONS に戻せない（gen-conditions.mjs が止める）。 */
export const RETIRED = [
  'days_off_request_limit',   // 2026-11-17 数の欄 → 段で選ぶ days_off_request_quota へ
  'staff_travel_cabin',       // 2026-11-17 1つ選ぶ → 複数選ぶ staff_travel_premium へ（選択肢の意味も変えた）
  'staff_travel_family',      // 2026-11-17 券ごとの「誰が使えますか？」（staff_travel_standby_family / staff_travel_confirmed_family）に任せる
  'fo_development',           // 2026-11-17 Loss of Licence の補償（loss_of_licence）と入れ替え
  'fo_development_split',     // ↳ 上の続き（withSplit が作っていた）
];

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
     ★2026-11-08 オーナー「給与提出のあとに1問しか聞かれない。3問聞いてよ」→ 2回目以降も3問（1タップの質問だけ）。 */
  initial_limit:        3,   // その会社でまだ0問の人（＝3問目まで埋める）
  recurring_limit:      3,   // 2回目以降の給与提出（2026-11-08 に 1 → 3）
  profile_limit:        1,   // マイページの導線を自分で押した人

  /* レポートが描かれてからモーダルを出すまで。0だと結果を読む前に被さる。 */
  modal_delay_ms:     700,

  /* 戻ってきた会員に聞く板「〇〇のこと、ひとつ教えて。」（下の ASK・2026-10-30 オーナー指示）。
     ★間隔はサーバ（profiles.ask_prompt_at）で数える ＝ スマホとパソコンで二重に出ない。 */
  ask_interval_hours:  48,   // 板を開いてから、次に開いてよいまで（2日に1回）
  ask_limit:            3,   // 1回の板で聞く問数（言った数で必ず終わる）
};

/* ── 戻ってきた会員に聞く質問と、その順番（2026-10-30 オーナー指示）──────────
   「登録したパイロットが戻ってきたとき、2日に1回、自分の会社について3問。
     大事で、まだ埋まっていない質問から。3人以上が同じような答えなら、いったん次の質問へ。
     大事な順は 勤務 → 通勤・タクシー → 休暇・手当 → staff travel。その中でも大事なことだけ。」
   ★聞く順の正本はこの並び1つだけ。gen-conditions.mjs が DB の ask_rank（1, 2, …）へ写し、
     db/ask-own-airline.sql の pv_ask_next がこの順で選ぶ。
   ★子（parent を持つ質問）は、本人が親に該当する答えをしたときだけ出る（今の質問と同じ決まり）。
     子は親のすぐ後ろに置く ＝ 親に「ある」と答えた直後に、その中身を聞ける。
   ★ここに無い質問は、この板では聞かない（給与の後の1問・会社ページの「情報を追加」・質問の一覧では今までどおり聞く）。
     聞かないもの：意見の質問・細かい続き（希望休の日数・Bidding の範囲・Reserve の日数・病休の日数・
     着陸手当が一定額でない人の低いほう・高いほうの額・バス・タクシーの上限・staff travel の回数や費用）・
     キャリア節・Peer Support。
   ★2026-10-30 オーナー指示で足した：着陸手当の1回あたりの額・日当（パーディアム）が出るか・国内線と国際線の1日の額。
     額は通貨と一緒に聞く（板に通貨を選ぶ欄が出る）。
   ⚠️ 対になる額（rangeLow）・明細行・話題の入口だけの質問・意見の質問は置けない（gen-conditions.mjs が止める）。 */
export const ASK = [
  // 勤務
  'days_off_request',
  'days_off_request_partial',  // ↳ 一部可能と答えた人（続き・deep）
  'days_off_request_split',    // ↳ 答えが分かれた会社だけ（続き・deep）
  'schedule_bidding',
  'schedule_bidding_partial',  // ↳ 一部可能と答えた人
  'schedule_bidding_split',    // ↳ 答えが分かれた会社だけ
  'reserve_duty',
  'reserve_duty_who',          // ↳ 一部のパイロットのみと答えた人
  'reserve_duty_split',        // ↳ 答えが分かれた会社だけ
  'reserve_location',          // ↳ reserve_duty
  'roster_lead_days',
  'roster_changes',
  'roster_changes_split',      // ↳ 答えが分かれた会社だけ
  // 通勤・タクシー
  'commuting_transport',
  'commuting_transport_split', // ↳ 答えが分かれた会社だけ
  'commuting_transport_method', // ↳ commuting_transport（複数選ぶ）
  'commuting_taxi_where',       // ↳ commuting_transport_method
  'commuting_taxi_cost',        // ↳ commuting_transport_method
  // 休暇・手当
  'annual_leave_days',
  'sick_leave',
  'sick_leave_split',          // ↳ 答えが分かれた会社だけ
  'landing_pay',
  'landing_pay_split',         // ↳ 答えが分かれた会社だけ
  'landing_pay_amount',         // ↳ landing_pay（1回あたり一定額の人だけ・通貨つき）
  'per_diem',
  'per_diem_split',            // ↳ 答えが分かれた会社だけ
  'per_diem_domestic',          // ↳ per_diem（通貨つき）
  'per_diem_international',     // ↳ per_diem（通貨つき）
  'ground_duty_pay',
  'ground_duty_pay_split',     // ↳ 答えが分かれた会社だけ
  // staff travel
  'staff_travel',
  'staff_travel_who',          // ↳ 一部のパイロットのみと答えた人
  'staff_travel_split',        // ↳ 答えが分かれた会社だけ
  'staff_travel_booking',       // ↳ staff_travel
  'staff_travel_premium',       // ↳ staff_travel（複数選ぶ・2026-11-17 に staff_travel_cabin と入れ替え。家族の1問は止めた）
];

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
               ★親の親がある（2段）ときは、**いちばん上まで**条件が続いているときだけ。
                 画面もサーバも同じ決め方をする（冒頭の 2026-10-04 の注記）。
   note      … 選択肢に加えて自由記述欄を出す。★自由記述は公開集計に一切出さない。
   currency  … 金額。通貨コードも一緒に保存する。
   rangeLow  … 対になる額（低いほう・高いほう）の、低いほうの質問の id。★高いほうの質問にだけ書く
               （低いほうには何も書かない）。2問は数値で、同じ親・同じ parentWhen・同じ currency の有無
               （gen-conditions.mjs が検査する）。pv-conditions.json には rangeLow、質問マスタの spec には
               range_low として運ばれる。サーバ側で対の相手を引くのは pv_condition_range_other、
               対として悪いかを言うのは pv_condition_range_bad（どちらも db/airline-conditions.sql）。
   topic     … 話題の入口の印（'taxi' / 'staff_travel' / 'upgrade'）。会社の概要の画面には
               話題ごとの入口があり、そこから来た人には同じ topic の質問をまとめて出す。
               ★付いているだけでは、一覧と1問枠での出方は1つも変わらない。
               ★枝ごと同じ話題にする（親が持つなら子も同じ topic。gen-conditions.mjs が検査する）。
   deep      … 続きの質問（2026-11-14 オーナー指示「一部可能にはもう一つ突っ込んで質問して欲しい。あと回答が分かれている場合も」）。
               'partial' ＝ 親に「一部可能／一部のパイロットのみ／条件付き」と答えた本人にだけ聞く（parentWhen がその答えだけ）。
               'split'   ＝ その会社で親の答えが分かれているときだけ、親に答えた人に聞く（下の withSplit が型から作る）。
               ★どちらも「質問の一覧の行」「質問 N問」「答えた項目：N／◯」に数えない（DB の deep 列。数えないのは db/airline-conditions.sql）。
               ★答える画面では親のすぐ下に出る。会社ページのカードの集計には入る（親のカードの中の1行）。
               ★ja.cue / en.cue ＝ 会社ページのカードに置く誘いの字（「どんな形で一部可能？」）。deep の質問だけが持つ。
               ★2026-11-16 から全部「複数選ぶ＋その他の欄」（multi・otherText）。gen-conditions.mjs が検査する。
   otherText … 「その他」（other）を選んだ人にだけ、1行の欄（100字まで・OTHER_TEXT_MAX）を出す（2026-11-16 オーナー承認
               「自分で答えを書けるその他が欲しい」）。書いた字は answer_text に入る（other を選んでいないときは保存しない）。
               ★会社ページに出すのは、運営が管理画面の「その他の答え」で「載せる」を押した字だけ（airline_conditions.text_ok）。
               ★この印のある質問には補足（note）の欄を出さない（同じ answer_text を2つの欄で書かせない）。
               ★選ぶ質問だけ・選択肢に other が要る（gen-conditions.mjs と DB の pv_cq_other_text_ck が止める）。
   topicOnly … 話題の入口から来た人に**だけ**出す。提出直後の1問枠にも一覧にも出さず、
               「あなたが答えた項目：N／48」の分母にも分子にも数えない
               （1問枠に出さない・数えないを決めているのは db/airline-conditions.sql。
                 画面の側は pv-conditions.json に運ばれた topicOnly を見て一覧から外す）。
               ★topic が要る。micro と boost は付けられない（gen-conditions.mjs が検査する）。
               ★今までの質問に付けない（冒頭の 2026-10-04 の2つ目の注記）。
*/
const BASE = [
  // ══ ROSTER 勤務スケジュール ═══════════════════════════════════════
  {
    id: 'days_off_request', version: 1, section: 'roster', kind: 'choice',
    tier: 'A', micro: true, priority: 100, boost: 3,   // 最初の3問①。休みを自分で決められるかは、全社を横並びにできて誰にでも答えられる
    /* ★「OFF2」を label にしない。日本の一部の会社の呼び名で、他社のパイロットには
       通じない。制度そのものを説明する文にして、呼び名は help に逃がす。 */
    ja: { short: '希望休の指定', label: '希望する休日の日付を指定できますか？',
          help: '自分で「この日は休みにしたい」と日付を指定できる制度です。会社によって OFF 指定・希望休などと呼ばれます。' },
    en: { short: 'Day-off requests', label: 'Can pilots request specific days off?',
          help: 'A system where you name the calendar dates you want off. Airlines call it preferred days off, OFF request, and other names.' },
    choices: [
      { code: 'yes',     ja: 'はい',       en: 'Yes' },
      { code: 'partial', ja: '一部可能',   en: 'Partially' },
      { code: 'no',      ja: 'いいえ',     en: 'No' },
      { code: UNKNOWN,   ja: 'わからない', en: "Don't know" },
    ],
  },
  {
    /* ★2026-11-17 数の欄（days_off_request_limit・止めた）を、段で選ぶ形にした（オーナー判断・見直し案3）。
       上限の無い会社の人は「31」と打つしかなく、本当に31日の人と区別できなかった（0 も入った）。
       意味が変わるので新しい id（今までの数の答えとは混ぜて数えない）。社員航空券の回数・機長昇格の条件と同じく段で聞く。 */
    id: 'days_off_request_quota', version: 1, section: 'roster', kind: 'choice',
    tier: 'A', micro: true, priority: 110,
    parent: 'days_off_request', parentWhen: ['yes', 'partial'],
    ja: { short: '月の希望日数', label: '希望休は、月に何日まで指定できますか？', help: '' },
    en: { short: 'Request limit per month', label: 'How many days off per month can you request?', help: '' },
    choices: [
      { code: 'unlimited', ja: '上限はない', en: 'No limit' },
      { code: 'd1_2',      ja: '月1〜2日',   en: '1 to 2 days a month' },
      { code: 'd3_4',      ja: '月3〜4日',   en: '3 to 4 days a month' },
      { code: 'd5_8',      ja: '月5〜8日',   en: '5 to 8 days a month' },
      { code: 'd9_plus',   ja: '月9日以上',  en: '9 or more days a month' },
      { code: UNKNOWN,     ja: 'わからない', en: "Don't know" },
    ],
  },
  {
    /* ★「一部」の答えの続き（deep:'partial'・2026-11-14 オーナー指示「一部可能にはもう一つ突っ込んで質問して欲しい」）。
       親にその答えをした本人にだけ、親のすぐ下で聞く（会社ページのカードは「どんな形で一部可能？ 教える ›」から来る）。 */
    id: 'days_off_request_partial', version: 1, section: 'roster', kind: 'multi',
    tier: 'A', micro: false, priority: 111, otherText: true, deep: 'partial',
    parent: 'days_off_request', parentWhen: ['partial'],
    ja: { short: '希望休の制限', label: '希望休は、どんな形で一部だけ指定できますか？',
          help: '当てはまるものを全部選んでください。', cue: 'どんな形で一部可能？' },
    en: { short: 'Day-off request limits', label: 'How are day-off requests limited?',
          help: 'Pick all that apply.', cue: 'Partly — how?' },
    /* ★2026-11-16 複数選ぶ＋その他の欄に（冒頭の注記）。mixed は外した・コードは足すだけ */
    choices: [
      { code: 'cap',            ja: '月に指定できる日数に上限がある',          en: 'Capped at a set number of days per month' },
      { code: 'seniority',      ja: '先任順位（Seniority）の順に通る',         en: 'Granted in seniority order' },
      { code: 'peak',           ja: '繁忙期（年末年始・夏など）は指定できない', en: 'Not available in peak periods (holidays, summer)' },
      { code: 'not_guaranteed', ja: '出せるが、通るとは限らない',              en: 'You can request, but it is not guaranteed' },
      { code: 'no_consecutive', ja: '連休にする指定はできない',                en: "Consecutive days off can't be requested" },
      { code: 'early_deadline', ja: '申し込みの期限が早い',                    en: 'The request deadline is early' },
      { code: 'other',          ja: 'その他',                                  en: 'Other' },
    ],
  },
  {
    id: 'schedule_bidding', version: 1, section: 'roster', kind: 'choice',
    tier: 'A', micro: true, priority: 120, boost: 2,   // 最初の3問②。①と混ぜない（日付の指定と、路線・時間帯の希望は別の制度）
    ja: { short: '勤務の希望提出', label: '勤務スケジュールの希望を提出できますか？',
          help: '翌月などの勤務について、路線・ステイ先・時間帯・休日の希望を出せる制度です。PBS（Preferential Bidding System）や Bidding とも呼ばれます。' },
    en: { short: 'Roster bidding', label: 'Can pilots submit preferences for their roster?',
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
    tier: 'A', micro: false, priority: 130,
    parent: 'schedule_bidding', parentWhen: ['yes', 'partial'],
    /* ★2026-11-17 質問文だけで何の話か分かる形に・選択肢を2つ足した・「集中勤務」を言い換えた（コードは同じ） */
    ja: { short: '希望できる内容', label: '勤務スケジュールの希望では、どの項目を出せますか？', help: '当てはまるものをすべて選んでください。' },
    en: { short: 'What you can bid for', label: 'When bidding for your roster, what can you bid for?', help: 'Select all that apply.' },
    choices: [
      { code: 'days_off',    ja: '休日の日付',        en: 'Specific days off' },
      { code: 'consecutive', ja: '連休',              en: 'Consecutive days off' },
      { code: 'routes',      ja: '路線',              en: 'Routes / destinations' },
      { code: 'layovers',    ja: 'ステイ先',          en: 'Layover cities' },
      { code: 'avoid_early', ja: '早朝勤務を避ける',  en: 'Avoiding early starts' },
      { code: 'avoid_night', ja: '深夜勤務を避ける',  en: 'Avoiding night duty' },
      { code: 'turnaround',  ja: '日帰り勤務',        en: 'Turnarounds (no overnight)' },
      { code: 'block',       ja: '勤務日をまとめる（連勤で休みを固める）', en: 'Back-to-back duty days (to group days off)' },
      { code: 'reserve',     ja: 'Reserve・Standby',  en: 'Reserve / standby' },
      { code: 'credit',      ja: '乗務時間（Credit）を多め・少なめに', en: 'Higher or lower credit hours' },
      { code: 'buddy',       ja: '一緒に乗る人（Buddy bid）',          en: 'Flying with a chosen colleague (buddy bid)' },
      { code: 'other',       ja: 'その他',            en: 'Other' },
    ],
  },
  {
    id: 'schedule_bidding_partial', version: 1, section: 'roster', kind: 'multi',
    tier: 'A', micro: false, priority: 131, otherText: true, deep: 'partial',
    parent: 'schedule_bidding', parentWhen: ['partial'],
    ja: { short: '勤務の希望の制限', label: '勤務スケジュールの希望は、どんな形で一部だけ出せますか？',
          help: '当てはまるものを全部選んでください。', cue: 'どんな形で一部可能？' },
    en: { short: 'Bidding limits', label: 'How is roster bidding limited?',
          help: 'Pick all that apply.', cue: 'Partly — how?' },
    choices: [
      { code: 'few_items',      ja: '出せる項目が限られる（休日だけ など）', en: 'Only some items can be bid (e.g. days off only)' },
      { code: 'few_bids',       ja: '出せる件数が限られる',                  en: 'Only a limited number of bids' },
      { code: 'seniority',      ja: '先任順位（Seniority）の順に通る',       en: 'Awarded in seniority order' },
      { code: 'not_guaranteed', ja: '出せるが、通るとは限らない',            en: 'Bids are not guaranteed' },
      { code: 'some_bases',     ja: '一部の拠点・機種だけ出せる',            en: 'Only at some bases or fleets' },
      { code: 'some_periods',   ja: '決まった時期だけ出せる',                en: 'Only in certain periods' },
      { code: 'other',          ja: 'その他',                                en: 'Other' },
    ],
  },
  {
    /* ★全問の中で唯一「会社の事実」でない質問。制度の有無ではなく、運用の体感を聞く。
       同じ会社でも先任順位の上下で答えが割れ、しかもどちらも正しい。
       isOpinion を立てて公開集計で会社の事実と分けて出す（micro には出さない）。
       ここに置くのは、直前2問（希望休・スケジュール希望）が「出せるか」までしか
       聞いておらず、「で、実際それは通るのか」が抜けるため。節を分けると
       何の話か分からなくなるので、話が続いているこの位置に置く。 */
    id: 'seniority_effect', version: 1, section: 'roster', kind: 'choice',
    tier: 'C', micro: false, priority: 140, isOpinion: true,
    ja: { short: '先任順位の効き方', label: '休日や路線の希望は、先任順位（Seniority）で通りやすさが変わりますか？',
          help: 'あなたの実感で構いません。会社の公式な説明ではなく、体感として集めています。' },
    en: { short: 'Seniority weight', label: 'Does seniority change how likely your day-off or route bids are granted?',
          help: 'Your impression is fine. This is collected as pilot perception, not as company policy.' },
    /* ★2026-11-17「希望を出す仕組みが無い」を足した。親の質問が無く全員に出るので、希望を出せない会社の人が
         「わからない」や「ほとんど変わらない」に流れて、意見が読めなくなっていた。 */
    choices: [
      { code: 'strong',     ja: '強く変わる',       en: 'Strongly' },
      { code: 'some',       ja: 'ある程度変わる',   en: 'Somewhat' },
      { code: 'little',     ja: 'ほとんど変わらない', en: 'Hardly at all' },
      { code: 'no_bidding', ja: '希望を出す仕組みが無い', en: 'There is no way to bid or request' },
      { code: UNKNOWN,      ja: 'わからない',       en: "Don't know" },
    ],
  },
  {
    id: 'reserve_duty', version: 1, section: 'roster', kind: 'choice',
    tier: 'A', micro: true, priority: 150,
    /* ★「ある／ない」の間に「一部のパイロットのみ」を置く。若手だけ、
       特定の基地だけ、という会社が実在し、二択にすると回答が割れて読めなくなる。 */
    ja: { short: 'Reserve 勤務', label: 'Reserve / Standby 勤務はありますか？',
          help: '呼び出しに備えて待機する勤務です。会社によって Reserve・Standby・予備勤務などと呼ばれます。' },
    en: { short: 'Reserve duty', label: 'Is there reserve / standby duty?',
          help: 'Duty where you stay available to be called out to fly. Airlines call it reserve, standby or similar.' },
    choices: [
      { code: 'yes',         ja: 'ある',                 en: 'Yes' },
      { code: 'some_pilots', ja: '一部のパイロットのみ', en: 'Some pilots only' },
      { code: 'no',          ja: 'ない',                 en: 'No' },
      { code: UNKNOWN,       ja: 'わからない',           en: "Don't know" },
    ],
  },
  {
    id: 'reserve_location', version: 1, section: 'roster', kind: 'multi',
    tier: 'A', micro: false, priority: 160,
    parent: 'reserve_duty', parentWhen: ['yes', 'some_pilots'],
    /* ★自宅待機と空港待機では拘束の重さが全く違う。年収が同じでも仕事の価値が変わる。
       ★2026-11-17 複数選ぶにした（オーナー判断・見直し案6）。ホテルで待つ Reserve が選べず、「両方ある」ではどの2つか分からなかった。
         「両方ある」（both）は外した。今までの1つ選ぶ答えは db/airline-conditions.sql の1回だけの update が複数選ぶの形へ直す
         （自宅・空港はそのまま／「両方ある」＝ 自宅と空港の両方）。複数選ぶので、提出直後の1問枠（micro）からは外れる。 */
    ja: { short: '待機場所', label: 'Reserve / Standby で待機する場所はどこですか？', help: '当てはまるものをすべて選んでください。' },
    en: { short: 'Reserve location', label: 'Where do you wait when on reserve / standby?', help: 'Select all that apply.' },
    choices: [
      { code: 'home',    ja: '自宅',               en: 'At home' },
      { code: 'airport', ja: '空港・会社の待機室', en: 'At the airport or a company crew room' },
      { code: 'hotel',   ja: 'ホテル',             en: 'At a hotel' },
      { code: 'other',   ja: 'その他',             en: 'Other' },
    ],
  },
  {
    /* ★2026-11-17 足した（見直し案23）。待機場所で「自宅」を選んだ人にだけ聞く。同じ自宅待機でも、1時間で空港に着かないと
         いけないのと3時間あるのとでは、住める場所も待機中の過ごし方も変わる。 */
    id: 'reserve_report_time', version: 1, section: 'roster', kind: 'choice',
    tier: 'A', micro: true, priority: 165,
    parent: 'reserve_location', parentWhen: ['home'],
    ja: { short: '自宅待機の出頭時間', label: '自宅での Reserve は、呼び出しから何時間以内に出頭（Report）する決まりですか？',
          help: '呼び出しを受けてから、空港などに出頭（Report）するまでに会社が認めている時間です。' },
    en: { short: 'Home reserve call-out time', label: 'On home reserve, how soon must you report after a call-out?',
          help: 'The time the company allows between the call-out and reporting for duty.' },
    choices: [
      { code: 'within_1h', ja: '1時間以内',     en: 'Within 1 hour' },
      { code: 'h1_2',      ja: '1〜2時間',      en: '1 to 2 hours' },
      { code: 'h2_3',      ja: '2〜3時間',      en: '2 to 3 hours' },
      { code: 'over_3h',   ja: '3時間を超える', en: 'More than 3 hours' },
      { code: UNKNOWN,     ja: 'わからない',    en: "Don't know" },
    ],
  },
  {
    id: 'reserve_days', version: 1, section: 'roster', kind: 'num',
    tier: 'A', micro: false, priority: 170,
    parent: 'reserve_duty', parentWhen: ['yes', 'some_pilots'],
    num: { min: 0, max: 31, step: 1, ja: '日／月', en: 'days / month' },
    ja: { short: 'Reserve の日数', label: 'Reserve / Standby 勤務は、月に平均何日くらいありますか？', help: '直近の実感で構いません。' },
    en: { short: 'Reserve days', label: 'On average, how many days of reserve / standby do you have per month?', help: 'A recent typical month is fine.' },
  },
  {
    id: 'reserve_duty_who', version: 1, section: 'roster', kind: 'multi',
    tier: 'A', micro: false, priority: 171, otherText: true, deep: 'partial',
    parent: 'reserve_duty', parentWhen: ['some_pilots'],
    ja: { short: 'Reserve の対象', label: 'Reserve / Standby 勤務があるのは、どのパイロットですか？',
          help: '当てはまるものを全部選んでください。', cue: 'どのパイロット？' },
    en: { short: 'Who does reserve', label: 'Which pilots do reserve / standby duty?',
          help: 'Pick all that apply.', cue: 'Which pilots?' },
    choices: [
      { code: 'junior',      ja: '先任順位の低いパイロット',     en: 'Junior pilots (low seniority)' },
      { code: 'rank',        ja: '機長だけ、または副操縦士だけ', en: 'Captains only, or first officers only' },
      { code: 'fleet',       ja: '一部の機種',                   en: 'Some fleets' },
      { code: 'base',        ja: '一部の拠点',                   en: 'Some bases' },
      { code: 'contract',    ja: '一部の契約の形',               en: 'Some contract types' },
      { code: 'new_joiners', ja: '入社・昇格して間もない人',     en: 'Pilots who recently joined or upgraded' },
      { code: 'volunteers',  ja: '本人が希望した人',             en: 'Pilots who volunteer' },
      { code: 'other',       ja: 'その他',                       en: 'Other' },
    ],
  },
  {
    id: 'roster_lead_days', version: 1, section: 'roster', kind: 'num',
    tier: 'A', micro: false, priority: 180,
    num: { min: 1, max: 90, step: 1, ja: '日前', en: 'days before' },
    /* ★2026-11-17 質問文を直した（見直し案7）。「何日前」が月の初めの前か終わりの前か、読む人で割れた。
         28日ごとなど、暦の月で区切らない勤務表の会社の人も答えられる形にした。範囲は同じ。 */
    ja: { short: '勤務予定の確定', label: '次の勤務期間（翌月など）の勤務表は、その期間が始まる何日前に出ますか？',
          help: 'その期間の初日から数えて何日前か、の目安です。28日ごとなど、暦の月で区切らない勤務表でも同じ数え方です。' },
    en: { short: 'Roster publication', label: 'How many days before the next roster period (e.g. next month) starts is the roster published?',
          help: 'Count back from the first day of the period. The same applies if your rosters do not follow calendar months (e.g. 28-day periods).' },
  },
  {
    id: 'roster_changes', version: 1, section: 'roster', kind: 'choice',
    tier: 'A', micro: true, priority: 190,
    /* ★給与が同じでも「1ヶ月前に確定・ほぼ変更なし」と「直前変更が多い」では
       仕事の価値が違う。年収表には絶対に出てこない差。 */
    ja: { short: '確定後の勤務変更', label: '確定後の勤務変更は多いですか？',
          help: '一度出たスケジュールが、あとから会社都合で変わる頻度です。' },
    en: { short: 'Roster changes', label: 'How often does the published roster change afterwards?',
          help: 'How frequently a published schedule is changed by the company.' },
    choices: [
      { code: 'rare',      ja: 'ほとんどない', en: 'Rarely' },
      { code: 'sometimes', ja: '時々ある',     en: 'Sometimes' },
      { code: 'often',     ja: '多い',         en: 'Often' },
      { code: UNKNOWN,     ja: 'わからない',   en: "Don't know" },
    ],
  },
  {
    /* ★2026-11-17 足した（オーナー判断・見直し案22）。住む国を変えずに働けるかは、外国の会社へ移るかを決める大きな条件で、
         制度の有無がはっきりしている。出社・帰宅の移動（commuting_transport ── 家と空港のあいだのタクシーやバス）とは別の話。
       ★「一部のパイロットだけ」を置く（オーナー指示）。その人には続きの base_commuting_who で「どんな人か」を聞く。 */
    id: 'base_commuting', version: 1, section: 'roster', kind: 'choice',
    tier: 'B', micro: true, priority: 193,
    ja: { short: 'Commuting', label: '拠点の近くに住まず、勤務のときだけ拠点へ通う働き方（Commuting）を、会社は認めていますか？',
          help: '住まいを別の街や国に置き、勤務の前後に飛行機などで拠点へ通う働き方です。' },
    en: { short: 'Commuting to base', label: 'Does the company allow commuting — living away from base and traveling in for duty?',
          help: 'Living in another city or country and flying (or otherwise traveling) to base before and after your duty.' },
    choices: [
      { code: 'company_seat',  ja: '認めている・通う便の席を会社が出す', en: 'Yes — the company provides the commuting seat' },
      { code: 'self_arranged', ja: '認めている・通う便は自分で手配',     en: 'Yes — you arrange your own travel' },
      { code: 'some_pilots',   ja: '一部のパイロットだけ認められている', en: 'Only some pilots are allowed' },
      { code: 'no',            ja: '認めていない（拠点の近くに住む決まり）', en: 'No — pilots must live near base' },
      { code: UNKNOWN,         ja: 'わからない',                         en: "Don't know" },
    ],
  },
  {
    /* ★「一部」の答えの続き（deep:'partial'・2026-11-17 オーナー指示）。選択肢はオーナーが挙げた4つ＋その他（自分で書く欄）。 */
    id: 'base_commuting_who', version: 1, section: 'roster', kind: 'multi',
    tier: 'B', micro: false, priority: 194, otherText: true, deep: 'partial',
    parent: 'base_commuting', parentWhen: ['some_pilots'],
    ja: { short: '認められている人', label: 'Commuting（拠点へ通う働き方）は、どんな人が認められていますか？',
          help: '当てはまるものを全部選んでください。', cue: 'どんな人？' },
    en: { short: 'Who may commute', label: 'Which pilots are allowed to commute to base?',
          help: 'Pick all that apply.', cue: 'Which pilots?' },
    choices: [
      { code: 'join_date',    ja: '入社時期で決まる',             en: 'Depends on when you joined' },
      { code: 'lived_before', ja: '以前その街や国に住んでいた人', en: 'Pilots who already lived in that city or country' },
      { code: 'captains',     ja: '機長だけ',                     en: 'Captains only' },
      { code: 'approved',     ja: '会社の許可が出た人',           en: 'Pilots the company approves' },
      { code: 'other',        ja: 'その他',                       en: 'Other' },
    ],
  },

  // ══ CAREER キャリア ═══════════════════════════════════════════════
  {
    id: 'external_hiring', version: 1, section: 'career', kind: 'choice',
    tier: 'A', micro: true, priority: 200, boost: 1,   // 最初の3問③。このサイトに来る理由そのもの。中途で入れるかが分からないと転職の話が始まらない
    /* ★「制度としてあるか」と「今まさに募集中か」を混ぜない。混ぜると
       募集が閉じた月に全社が「いいえ」に振れて、制度の記録として使えなくなる。 */
    ja: { short: '他社からの中途採用', label: '他社からパイロットとして中途入社できますか？',
          help: '制度としてあるかどうかを聞いています。今まさに募集中かどうかとは別です。' },
    en: { short: 'Direct entry', label: 'Can pilots join from another airline?',
          help: 'Whether the pathway exists — not whether a vacancy is open right now.' },
    /* ★2026-11-17 rare を言い換えた（コードは同じ）。説明は「今まさに募集中かどうかとは別」なのに、この選択肢だけ
         「今」の話になっていて、募集が止まった時期に答えが寄った。 */
    choices: [
      { code: 'yes',         ja: 'はい',           en: 'Yes' },
      { code: 'conditional', ja: '条件付きで可能', en: 'Under conditions' },
      { code: 'rare',        ja: '制度はあるが、実際にはほとんど採っていない', en: 'The route exists, but they hardly ever hire' },
      { code: 'no',          ja: 'いいえ',         en: 'No' },
      { code: UNKNOWN,       ja: 'わからない',     en: "Don't know" },
    ],
  },
  {
    id: 'external_experience_credit', version: 1, section: 'career', kind: 'choice',
    tier: 'A', micro: true, priority: 210,
    parent: 'external_hiring', parentWhen: ['yes', 'conditional'],
    /* ★「入社時の待遇」と「社内の先任順位」は別物。他社で B777 機長を10年やって
       いても、Rank と給与ステップには考慮されるが Seniority は入社日から最下位、
       という会社が実在する。1問に畳むと、その会社のデータが取れない。 */
    ja: { short: '前職経験の考慮', label: '他社でのパイロット経験は、入社時の待遇（Rank・給与ステップ）に考慮されますか？',
          help: '入社時点の職位と給与の号数に、前職の経験がどれくらい反映されるかです。' },
    en: { short: 'Credit for prior experience', label: 'Does prior airline experience count towards your starting rank and pay step?',
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
    tier: 'A', micro: true, priority: 220,
    parent: 'external_hiring', parentWhen: ['yes', 'conditional'],
    ja: { short: '中途の先任順位', label: '中途入社した場合、社内の先任順位（Seniority）はどこから始まりますか？',
          help: '昇格・機種選択・希望の通りやすさを決める社内の順位のことです。' },
    en: { short: 'Seniority on joining', label: 'Where does your seniority start if you join from another airline?',
          help: 'The internal seniority list that drives upgrade, fleet choice and bidding.' },
    choices: [
      { code: 'from_join',    ja: '入社日ベースで新規',     en: 'From date of joining' },
      { code: 'credited',     ja: '過去経験の Credit あり', en: 'Prior experience is credited' },
      { code: 'case_by_case', ja: 'ケースによる',           en: 'Case by case' },
      /* ★2026-11-17 足した。昇格や機種・路線を Seniority で決めない会社の人には、選べるものが無かった */
      { code: 'no_seniority', ja: '社内に先任順位（Seniority）の仕組みが無い', en: 'No seniority system at the airline' },
      { code: UNKNOWN,        ja: 'わからない',             en: "Don't know" },
    ],
  },
  {
    id: 'external_hiring_conditions', version: 1, section: 'career', kind: 'multi',
    tier: 'A', micro: false, priority: 221, otherText: true, deep: 'partial',
    parent: 'external_hiring', parentWhen: ['conditional'],
    /* ★2026-11-16 複数選ぶにしたので「主に」「いちばん大きい条件」をやめた（質問の id は同じ） */
    ja: { short: '中途入社の条件', label: '他社からの中途入社には、どんな条件がありますか？',
          help: '当てはまるものを全部選んでください。', cue: 'どんな条件？' },
    en: { short: 'Direct entry conditions', label: 'What are the conditions for joining from another airline?',
          help: 'Pick all that apply.', cue: 'What conditions?' },
    choices: [
      { code: 'type_rating', ja: '同じ機種の資格・経験（Type Rating）', en: 'A type rating or time on type' },
      { code: 'hours',       ja: '総飛行時間',                         en: 'Total flight hours' },
      { code: 'command',     ja: '機長経験',                           en: 'Command experience' },
      { code: 'license',     ja: '免許の発行国・就労資格',             en: 'Licence state of issue or right to work' },
      { code: 'timing',      ja: '募集がある時期だけ',                 en: 'Only when a hiring round is open' },
      { code: 'age',         ja: '年齢',                               en: 'Age' },
      { code: 'english',     ja: '英語力（ICAO の英語能力など）',      en: 'English proficiency (e.g. ICAO level)' },
      { code: 'other',       ja: 'その他',                             en: 'Other' },
    ],
  },
  {
    id: 'training_bond', version: 1, section: 'career', kind: 'choice',
    tier: 'A', micro: true, priority: 230,
    /* ★「年収 +500万、ただし Bond あり」を比べられるようにするための質問。
       年収だけの表では絶対に見えない条件。 */
    ja: { short: '訓練費の Bond', label: '入社時の訓練費用に、Bond・返済義務がありますか？',
          help: '一定期間内に辞めると訓練費用の返済を求められる取り決めのことです。' },
    en: { short: 'Training bond', label: 'Is there a training bond or repayment obligation on joining?',
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
    tier: 'A', micro: false, priority: 240,
    parent: 'training_bond', parentWhen: ['yes', 'conditional'],
    num: { min: 0.5, max: 15, step: 0.5, ja: '年', en: 'years' },
    ja: { short: 'Bond の年数', label: '訓練費の Bond の拘束期間は何年ですか？', help: '' },
    en: { short: 'Bond length', label: 'How many years does the training bond run for?', help: '' },
  },
  {
    id: 'training_bond_amount', version: 1, section: 'career', kind: 'num',
    tier: 'A', micro: false, priority: 250,
    parent: 'training_bond', parentWhen: ['yes', 'conditional'],
    currency: true,
    /* ★2026-11-17 下限 0 → 1（親で「ある」と答えた人にだけ出るので、0 は答えとして食い違う）。
       上限 1億 → 99億9999万9999（通貨で桁が違う。インドネシア・ルピアの1億は日本円で約90万円）。
       ⚠️ 100億ちょうどにしない。答えの列（airline_conditions.answer_num）と質問マスタの num_max が numeric(12,2) で、
          整数の部分は10桁まで ＝ 100億は入らない（保存で落ちる）。 */
    num: { min: 1, max: 9999999999, step: 1, ja: '（総額）', en: '(total)' },
    ja: { short: 'Bond の額', label: '訓練費の Bond の額は、総額でいくらですか？', help: '入社時点の総額で構いません。' },
    en: { short: 'Bond amount', label: 'What is the total amount of the training bond?', help: 'The full amount at the time of joining is fine.' },
  },
  {
    id: 'training_bond_conditions', version: 1, section: 'career', kind: 'multi',
    tier: 'A', micro: false, priority: 251, otherText: true, deep: 'partial',
    parent: 'training_bond', parentWhen: ['conditional'],
    ja: { short: 'Bond が付く場合', label: '訓練費の Bond は、どんな場合に付きますか？',
          help: '当てはまるものを全部選んでください。', cue: 'どんな場合？' },
    en: { short: 'When a bond applies', label: 'When does a training bond apply?',
          help: 'Pick all that apply.', cue: 'When does it apply?' },
    choices: [
      { code: 'type_rating', ja: '機種移行（Type Rating）の訓練', en: 'Type-rating training' },
      { code: 'cadet',       ja: '自社養成（Cadet）の訓練',       en: 'Cadet (ab initio) training' },
      { code: 'contract',    ja: '契約の形による',                en: 'Depends on contract type' },
      { code: 'upgrade',     ja: '機長昇格の訓練',                en: 'Command upgrade training' },
      { code: 'initial',     ja: '入社時の初期訓練',              en: 'Initial training on joining' },
      { code: 'other',       ja: 'その他',                        en: 'Other' },
    ],
  },
  {
    id: 'upgrade_years', version: 1, section: 'career', kind: 'num',
    tier: 'A', micro: false, priority: 260, topic: 'upgrade',
    num: { min: 0.5, max: 30, step: 0.5, ja: '年', en: 'years' },
    ja: { short: '機長昇格までの年数', label: '副操縦士から機長まで、今どれくらいかかりますか？',
          help: '今の目安で構いません。会社の規定年数ではなく、実際にかかっている年数です。' },
    en: { short: 'Time to command', label: 'How long does it currently take to upgrade from First Officer to Captain?',
          help: 'A current estimate is fine — the time it actually takes, not the published minimum.' },
  },
  {
    /* ── 機長昇格の条件（2026-10-04 追加・オーナー判断） ─────────────────
       ★話題の入口（機長昇格）から来た人にだけ出す3問（topicOnly）。提出直後の1問枠にも
         一覧にも出さず、「答えた項目：N／48」にも数えない（冒頭の 2026-10-04 の2つ目の注記）。
       ★上の upgrade_years は「実際にかかっている年数」。こちらの3問は**会社が決めている条件**
         （順番の決め方・要る時間・要る年数）。同じことを2回聞いていない。
       ★親を持たない。昇格はどの会社にも在るので、「制度があるか」を先に聞く必要が無い。
       ★label だけで何の話か分かるように書く（「その」「それ」で前の質問を指さない）。
         話題の入口でどの質問が隣に来るかは、このファイルが決めていない。
       ★選考の中身（試験・面接・査定）は選択肢にしない。会社ごとに呼び名も段取りも違い、
         並べると選べない人が出る。書ける人は任意の補足へ（自由記述は公開集計に出ない）。 */
    id: 'upgrade_order', version: 1, section: 'career', kind: 'choice',
    tier: 'B', micro: false, priority: 270, topic: 'upgrade', topicOnly: true, note: true,
    ja: { short: '機長昇格の順番', label: '機長への昇格の順番は、どう決まりますか？',
          help: '先任順（Seniority）で順番が来るのか、会社が選ぶのか、空いた席に自分で応募するのかです。選考の中身は、書ける場合だけ補足に書いてください。' },
    en: { short: 'Command upgrade order', label: 'How is the order of upgrade to Captain decided?',
          help: 'Whether your turn comes by seniority, the company selects, or you apply when a command vacancy opens. If you can, describe the selection in the note.' },
    choices: [
      { code: 'seniority',           ja: '先任順（入社の順）',       en: 'By seniority (order of joining)' },
      { code: 'seniority_selection', ja: '先任順に加えて選考がある', en: 'By seniority, plus a selection' },
      { code: 'selection',           ja: '会社の選考で決まる',       en: 'By company selection' },
      { code: 'vacancy_bid',         ja: '空きが出たときに応募する', en: 'You apply when a vacancy opens' },
      { code: UNKNOWN,               ja: 'わからない',               en: "Don't know" },
    ],
  },
  {
    /* ★数値の欄にしない。条件が無い会社は数で答えられず、空欄と区別が付かなくなる。
         段はどの会社の規定とも無関係な切り方にしておく（特定の会社の数字を境目にすると、
         その会社の人しか迷わず答えられない）。
       ★聞くのは会社が決めている最低限。実際に昇格した人の時間は聞かない
         （人によって違い、1つの段に丸めると何の数か分からなくなる）。 */
    id: 'upgrade_min_hours', version: 1, section: 'career', kind: 'choice',
    tier: 'B', micro: false, priority: 280, topic: 'upgrade', topicOnly: true,
    ja: { short: '昇格に要る飛行時間', label: '機長昇格に必要な総飛行時間の条件は、どれですか？',
          help: '昇格の対象になるために会社が決めている、最低限の総飛行時間です。実際に昇格した人の時間ではありません。' },
    en: { short: 'Upgrade minimum hours', label: 'What is the minimum total flight time required for upgrade to Captain?',
          help: 'The minimum the company sets to be eligible — not the hours people actually have when they upgrade.' },
    choices: [
      { code: 'none',       ja: '時間の条件はない',  en: 'No flight-time requirement' },
      { code: 'under_3000', ja: '3,000時間未満',     en: 'Under 3,000 hours' },
      { code: 'h3000_4999', ja: '3,000〜4,999時間',  en: '3,000 to 4,999 hours' },
      { code: 'h5000_6999', ja: '5,000〜6,999時間',  en: '5,000 to 6,999 hours' },
      { code: 'h7000_plus', ja: '7,000時間以上',     en: '7,000 hours or more' },
      { code: UNKNOWN,      ja: 'わからない',        en: "Don't know" },
    ],
  },
  {
    id: 'upgrade_min_tenure', version: 1, section: 'career', kind: 'choice',
    tier: 'B', micro: false, priority: 290, topic: 'upgrade', topicOnly: true,
    ja: { short: '昇格に要る在籍年数', label: '機長昇格に必要な在籍年数の条件は、どれですか？',
          help: '昇格の対象になるために会社が決めている、入社してからの最低限の年数です。' },
    en: { short: 'Upgrade minimum tenure', label: 'What is the minimum time with the company required for upgrade to Captain?',
          help: 'The minimum number of years since joining that the company sets to be eligible.' },
    choices: [
      { code: 'none',     ja: '年数の条件はない', en: 'No time-with-company requirement' },
      { code: 'under_3',  ja: '3年未満',          en: 'Under 3 years' },
      { code: 'y3_5',     ja: '3〜5年',           en: '3 to 5 years' },
      { code: 'y6_9',     ja: '6〜9年',           en: '6 to 9 years' },
      { code: 'y10_plus', ja: '10年以上',         en: '10 years or more' },
      { code: UNKNOWN,    ja: 'わからない',       en: "Don't know" },
    ],
  },
  {
    id: 'external_hiring_types', version: 1, section: 'career', kind: 'multi',
    tier: 'B', micro: false, priority: 300,
    parent: 'external_hiring', parentWhen: ['yes', 'conditional'],
    /* ★2026-11-17 選択肢を整理した（オーナー判断・見直し案12）。
         「機長採用」（captain）と「Direct Entry Captain」（dec）は同じもので、答えが2つに割れて3人そろいにくかった
         → dec の1つ「機長として採用（Direct Entry Captain）」にまとめた。今までの captain の答えは
           db/airline-conditions.sql の1回だけの update が dec へ寄せる（同じ人が両方を選んでいたら1つにする）。
         「型式限定保持者のみ」（type_rated）は採用の形ではなく条件（続きの「中途入社の条件」の Type Rating で聞いている）── 止めた。
           今までの答えは書き換えない（選択肢から外れて会社ページに出ない）。
         巡航中の交代要員（Second Officer・Cruise Relief Pilot）と、派遣・契約会社経由を足した。 */
    ja: { short: '中途採用の形', label: '他社からの中途採用には、どの形がありますか？', help: '当てはまるものをすべて選んでください。' },
    en: { short: 'Direct entry routes', label: 'What routes are there for pilots joining from another airline?', help: 'Select all that apply.' },
    choices: [
      { code: 'fo',       ja: '副操縦士採用',                           en: 'First Officer entry' },
      { code: 'dec',      ja: '機長として採用（Direct Entry Captain）', en: 'Captain entry (Direct Entry Captain)' },
      { code: 'so_relief', ja: 'Second Officer・Cruise Relief Pilot（巡航中の交代要員）', en: 'Second Officer / Cruise Relief Pilot' },
      { code: 'contract', ja: '派遣・契約会社経由（Contract）',         en: 'Through an agency or contract company' },
      { code: 'other',    ja: 'その他',                                 en: 'Other' },
    ],
  },
  {
    id: 'cadet_program', version: 1, section: 'career', kind: 'choice',
    tier: 'B', micro: true, priority: 310,
    /* ★「制度があるか」と「今も採っているか」を1問に畳んだ。2問に割ると
       タップが1回増えるだけで、分かることは同じ。 */
    ja: { short: '自社養成', label: '自社養成パイロット制度はありますか？',
          help: '未経験から自社で訓練して操縦士にする制度です。' },
    en: { short: 'Cadet program', label: 'Is there a cadet program?',
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
    /* ★2026-11-17 足した（オーナー判断・見直し案20）。会社ページでは公表が見つからず書けていない項目で、
         どのパイロットも迷わず答えられ、3人そろいやすい。「副操縦士の育成支援」（fo_development）はこの日に止めた
         （「制度」と「文化」の境目があいまいで答えが割れやすかった ── 入れ替え先は benefits の loss_of_licence）。
       ★段はどの会社の規定とも無関係な切り方（60歳・65歳は多くの国の法律の線）。 */
    id: 'retirement_age', version: 1, section: 'career', kind: 'choice',
    tier: 'B', micro: true, priority: 320,
    ja: { short: 'パイロットの定年', label: 'この会社のパイロットの定年は何歳ですか？',
          help: '定年のあとも契約や再雇用で乗務を続けられる場合も、定年の歳を選んでください。' },
    en: { short: 'Retirement age', label: 'What is the retirement age for pilots at this airline?',
          help: 'If pilots can keep flying after it on a contract or re-employment, still choose the retirement age.' },
    choices: [
      { code: 'under_60',    ja: '60歳未満',   en: 'Under age 60' },
      { code: 'age_60',      ja: '60歳',       en: 'Age 60' },
      { code: 'age_61_64',   ja: '61〜64歳',   en: 'Age 61 to 64' },
      { code: 'age_65',      ja: '65歳',       en: 'Age 65' },
      { code: 'age_66_plus', ja: '66歳以上',   en: 'Age 66 or older' },
      { code: 'none',        ja: '会社の定年は無い（法律の上限まで飛べる）', en: 'No company retirement age (you can fly to the legal limit)' },
      { code: UNKNOWN,       ja: 'わからない', en: "Don't know" },
    ],
  },

  // ══ TIME OFF 休暇 ═════════════════════════════════════════════════
  {
    id: 'annual_leave_days', version: 1, section: 'time_off', kind: 'num',
    tier: 'A', micro: false, priority: 400,
    num: { min: 0, max: 60, step: 1, ja: '日／年', en: 'days / year' },
    /* ★2026-11-17 説明に「月の休日とは別」を足した（月の休日と合わせて数える人が混ざると、同じ会社でも数が大きく割れる）。
         範囲はこのまま（有給の無い契約の人は 0 が答え）。 */
    ja: { short: '年間の有給休暇', label: '年間の有給休暇は何日ですか？',
          help: '月の休日（OFF）とは別にもらえる休暇です。勤続年数や契約で変わる場合は、今のあなたの日数で構いません。' },
    en: { short: 'Annual leave', label: 'How many days of annual paid leave are there?',
          help: 'Leave on top of your monthly days off. If it varies by seniority or contract, your own current entitlement is fine.' },
  },
  {
    id: 'sick_leave', version: 1, section: 'time_off', kind: 'choice',
    tier: 'A', micro: true, priority: 410,
    ja: { short: '病気休暇', label: '病気休暇（Sick Leave）はどれくらい使えますか？',
          help: '有給休暇とは別に、病気のときに使える休暇のことです。' },
    en: { short: 'Sick leave', label: 'How much sick leave is available?',
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
    tier: 'A', micro: false, priority: 420,
    parent: 'sick_leave', parentWhen: ['days'],
    /* ★2026-11-17 下限 0 → 1（親で「日数が決まっている」と答えた人にだけ出るので、0 は答えとして食い違う） */
    num: { min: 1, max: 365, step: 1, ja: '日／年', en: 'days / year' },
    ja: { short: '病気休暇の日数', label: '病気休暇は、年間で何日ですか？', help: '' },
    en: { short: 'Sick days per year', label: 'How many days of sick leave are there per year?', help: '' },
  },

  // ══ BENEFITS 手当・サポート ═══════════════════════════════════════
  {
    id: 'peer_support', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 490,
    /* ★表記は Peer Support で固定（オーナー指示）。訳さない。 */
    ja: { short: 'Peer Support', label: 'パイロット向けの Peer Support 制度がありますか？',
          help: 'パイロット同士、または専門スタッフを通じて、心理的・職業上の相談ができる仕組みです。' },
    en: { short: 'Peer support', label: 'Is there a Peer Support program for pilots?',
          help: 'A route to confidential psychological or professional support, through fellow pilots or trained staff.' },
    /* ★2026-11-17 組合や乗員の団体が運営する形を足した（社内制度でも外部委託でもなく、選べるものが無かった）。
         「あり・両方」は3つになったので「いくつかの形がある」に言い換えた（コードは同じ）。 */
    choices: [
      { code: 'internal', ja: 'あり・社内制度', en: 'Yes — in-house' },
      { code: 'external', ja: 'あり・外部委託', en: 'Yes — external provider' },
      { code: 'union',    ja: 'あり・組合や乗員の団体が運営', en: 'Yes — run by the union or a pilot association' },
      { code: 'both',     ja: 'あり・いくつかの形がある',     en: 'Yes — more than one of these' },
      { code: 'no',       ja: 'ない',           en: 'No' },
      { code: UNKNOWN,    ja: 'わからない',     en: "Don't know" },
    ],
  },
  {
    /* ★2026-11-17 足した（オーナー判断・見直し案21。「副操縦士の育成支援」と入れ替え）。医学的な理由で職を失うのは
         パイロットだけが抱える危険で、会社によって有無がはっきり分かれる。 */
    id: 'loss_of_licence', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 495,
    ja: { short: 'ライセンス喪失の補償', label: '身体検査（Medical）に通らず乗務できなくなったときの補償（Loss of Licence）が、会社の制度にありますか？',
          help: '一時金や収入の補償が出る制度・保険です。組合などの保険に自分で入っている場合は「会社の制度は無い」を選んでください。' },
    en: { short: 'Loss of license cover', label: 'If you lose your medical and can no longer fly, does the company provide loss of license cover?',
          help: 'A lump sum or income protection through a company scheme or insurance. If your only cover is one you buy yourself (for example through the union), choose "No company scheme".' },
    choices: [
      { code: 'all_pilots',    ja: '会社の制度で全員に付く',     en: 'Yes — a company scheme for all pilots' },
      { code: 'premium_share', ja: '会社が保険料の一部を出す',   en: 'The company pays part of the premium' },
      { code: 'none',          ja: '会社の制度は無い',           en: 'No company scheme' },
      { code: UNKNOWN,         ja: 'わからない',                 en: "Don't know" },
    ],
  },
  {
    id: 'landing_pay', version: 1, section: 'benefits', kind: 'choice',
    /* ★Tier C。存在しない会社が多く、世界横断で比べる軸としては弱い。
       ある会社では効くので残すが、A と B が埋まってから聞く。
       ★「あり」の人には、すぐ下の5問（額と数え方）をその場で聞く（冒頭の 2026-10-09 の注記）。 */
    tier: 'C', micro: true, priority: 500,
    ja: { short: '着陸手当', label: '着陸回数に応じた手当はありますか？',
          help: '1回の着陸（またはレグ）ごとに払われる手当です。' },
    en: { short: 'Landing pay', label: 'Is there a landing allowance?',
          help: 'Pay per landing or per sector flown.' },
    choices: [
      { code: 'fixed',    ja: 'あり・1回あたり一定額', en: 'Yes — a fixed amount per landing' },
      { code: 'variable', ja: 'あり・一定額ではない',   en: 'Yes — but the amount varies' },
      { code: 'no',       ja: 'ない',                   en: 'No' },
      { code: UNKNOWN,    ja: 'わからない',             en: "Don't know" },
    ],
  },
  {
    /* ── 着陸手当の額と数え方（2026-10-09 追加・オーナー指示） ────────────
       ★親（landing_pay）に「あり」と答えた人にだけ、その場で出す5問。
         「ない」「わからない」の人には1問も出ない（送っても受け取らない・数えない）。
       ★「あり・1回あたり一定額」の人に2問（額／何を1回と数えるか）、
         「あり・一定額ではない」の人に3問（低いほう／高いほう／何で変わるか）。
         2つの枝は同時には出ない。
       ★額は通貨と一緒に聞く。下限は 1 ＝ 0 を「答えた」として保存させない（未回答は 0 ではない）。
       ★見本の額を help に書かない（会社ごとに違う。書いた額に答えが引っぱられる）。
       ★micro にしない。提出直後の1問枠は1タップで終わる質問だけ。額は一覧とシートで聞く。
       ★label だけで何の話か分かるように書く（保存後の一覧では、親と離れて1行ずつ出る）。 */
    id: 'landing_pay_amount', version: 1, section: 'benefits', kind: 'num',
    tier: 'C', micro: false, priority: 510,
    parent: 'landing_pay', parentWhen: ['fixed'],
    currency: true,
    num: { min: 1, max: 10000000, step: 0.01, ja: '（1回あたり）', en: '(each time)' },
    ja: { short: '着陸手当の額', label: '着陸手当はいくらですか？',
          help: '明細や規程に書かれている、1回分の額をそのまま入れてください。' },
    en: { short: 'Landing pay amount', label: 'How much is the landing allowance?',
          help: 'Enter the amount paid each time, as written on your payslip or pay rules.' },
  },
  {
    id: 'landing_pay_unit', version: 1, section: 'benefits', kind: 'choice',
    /* ★「一定額」の人にだけ聞く（オーナーの判断）。一定額ではない人の数え方は、
         下の landing_pay_varies_by の補足に書ける。 */
    tier: 'C', micro: false, priority: 520,
    parent: 'landing_pay', parentWhen: ['fixed'],
    /* ★2026-11-17 選択肢を作り直した（オーナー判断・見直し案15）。着陸の回数とレグの数はほとんど同じになり、分けても差が出ない。
         額に差が出るのは「自分が操縦して着陸させたときだけ出るか」のほう。意味が変わるので、今までの2つ（per_landing・per_leg）は
         止めて新しいコードにした（今までの答えは書き換えない ＝ 選択肢から外れて会社ページに出ない・新しい答えと混ぜて数えない）。 */
    ja: { short: '着陸手当の数え方', label: '着陸手当は何を1回と数えますか？',
          help: '自分が操縦して着陸したとき（PF）だけ数えるか、PF・PM を問わず乗務した区間（レグ）ごとに数えるかです。' },
    en: { short: 'Landing pay basis', label: 'Landing allowance: what counts as one?',
          help: 'Whether only landings you fly yourself as PF count, or every sector you operate as PF or PM.' },
    choices: [
      { code: 'pf_only',      ja: '自分が操縦して着陸したときだけ（PF のとき）',   en: 'Only landings you fly yourself (as PF)' },
      { code: 'every_sector', ja: '乗務した区間（レグ）ごと（PF・PM を問わない）', en: 'Every sector you operate (as PF or PM)' },
      { code: UNKNOWN,        ja: 'わからない',                                     en: "Don't know" },
    ],
  },
  {
    /* ★低いほう・高いほうは**どちらも任意**で、片方だけでもよい。
         別々の行として保存する（2つを1つの数字にまとめない）。低いほうが高いほうより大きい組・通貨が違う組は、
         保存のときに断る（フォームとサーバの両方。対は、高いほうの rangeLow で結ぶ）。 */
    id: 'landing_pay_from', version: 1, section: 'benefits', kind: 'num',
    tier: 'C', micro: false, priority: 530,
    parent: 'landing_pay', parentWhen: ['variable'],
    currency: true,
    num: { min: 1, max: 10000000, step: 0.01, ja: '（1回あたり）', en: '(each time)' },
    ja: { short: '着陸手当（低い額）', label: '着陸手当の低いほうの額',
          help: '任意です。わかる範囲で、低いほうの額を入れてください。片方だけでもかまいません。' },
    en: { short: 'Landing pay (low)', label: 'Landing allowance: lowest amount',
          help: 'Optional. Enter the lowest amount you know of. Filling in just one end is fine.' },
  },
  {
    id: 'landing_pay_to', version: 1, section: 'benefits', kind: 'num',
    tier: 'C', micro: false, priority: 540,
    parent: 'landing_pay', parentWhen: ['variable'],
    currency: true,
    rangeLow: 'landing_pay_from',
    num: { min: 1, max: 10000000, step: 0.01, ja: '（1回あたり）', en: '(each time)' },
    ja: { short: '着陸手当（高い額）', label: '着陸手当の高いほうの額',
          help: '任意です。片方だけでもかまいません。' },
    en: { short: 'Landing pay (high)', label: 'Landing allowance: highest amount',
          help: 'Optional. Filling in just one end is fine.' },
  },
  {
    id: 'landing_pay_varies_by', version: 1, section: 'benefits', kind: 'multi',
    /* ★2026-11-16 複数選ぶ＋その他の欄にした（冒頭の注記）。それまでは「一覧のページが複数選ぶ質問に補足を保存できない」
         ので1つ選ぶにして「いくつかの条件で変わる・その他」を置いていた。いまは一覧のページもその他の字を保存する。
         ★細かい条件は「その他」の欄へ（会社ページに出すのは運営が載せた字だけ）。 */
    tier: 'C', micro: false, priority: 550, otherText: true,
    parent: 'landing_pay', parentWhen: ['variable'],
    ja: { short: '着陸手当の決まり方', label: '着陸手当の額は何で変わりますか？',
          help: '当てはまるものを全部選んでください。' },
    en: { short: 'Landing pay varies by', label: 'What does the landing allowance vary by?',
          help: 'Pick all that apply.' },
    choices: [
      { code: 'aircraft',    ja: '機種',                   en: 'Aircraft type' },
      { code: 'airport',     ja: '空港・路線',             en: 'Airport or route' },
      { code: 'rank',        ja: '職位',                   en: 'Rank' },
      { code: 'count',       ja: '月の着陸回数',           en: 'Number of landings in the month' },
      { code: 'time_of_day', ja: '時間帯（深夜・早朝）',   en: 'Time of day (late night, early morning)' },
      { code: 'seniority',   ja: '在籍年数・先任順位',     en: 'Years of service or seniority' },
      { code: 'other',       ja: 'その他',                 en: 'Other' },
    ],
  },
  {
    id: 'ground_duty_pay', version: 1, section: 'benefits', kind: 'choice',
    /* ★自由記述をいちばん使ってほしい質問。会社ごとに制度が複雑で、
       1つの数値に丸めると意味が失われる（地上業務1時間＝乗務◯時間相当、など）。
       ★micro にしない。1タップで終わらせると note が空のまま埋まる。 */
    tier: 'C', micro: false, priority: 560, note: true,
    ja: { short: '地上業務の補償', label: '乗務以外の会社業務に、手当や勤務時間上の補償がありますか？',
          help: '会議・訓練担当・事務など、乗務でない業務に対する扱いです。「地上業務1時間＝乗務◯時間相当」のような換算がある場合は、補足に書いてください。',
          /* 戻ってきた会員に聞く板には補足の欄が無い ＝ 「補足に書いて」を言わない（askHelp はその板だけが使う） */
          askHelp: '会議・訓練担当・事務など、乗務でない業務に対する扱いです。' },
    en: { short: 'Ground duty pay', label: 'Is non-flying company work compensated, in pay or in duty credit?',
          help: 'Meetings, training duties, office work. If ground time converts into credited flying time at some ratio, please describe it in the note.',
          askHelp: 'Meetings, training duties, office work.' },
    /* ★2026-11-17「はい」（yes）を3つに分けた（オーナー判断・見直し案16）。お金で払う会社と、勤務時間に数える会社が
         同じ「はい」になり、並べられなかった。1つ選ぶ形のまま・補足の欄もそのまま。今までの yes の答えは書き換えない
         （どちらの意味か分からない ＝ 選択肢から外れて会社ページに出ない）。 */
    choices: [
      { code: 'allowance',    ja: '手当（お金）が出る',             en: 'Yes — paid as an allowance' },
      { code: 'credit',       ja: '乗務時間（Credit）として数える', en: 'Yes — counted as credit hours' },
      { code: 'both',         ja: '両方ある',                       en: 'Yes — both' },
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
    tier: 'A', micro: true, priority: 570, topic: 'staff_travel',
    ja: { short: '社員航空券', label: '自社便に割引や無料で乗れる社員向けの航空券制度がありますか？',
          help: '社員やその家族が割引・無料で乗れる制度です。ID チケット、スタッフトラベルなどと呼ばれます。' },
    en: { short: 'Staff travel', label: 'Is there a staff travel scheme — free or reduced-fare tickets on your own airline?',
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
    tier: 'B', micro: true, priority: 580, topic: 'staff_travel',
    parent: 'staff_travel', parentWhen: ['yes', 'some_pilots'],
    ja: { short: '座席の取り方', label: '社員航空券の席は、空席待ちですか、確保できますか？',
          help: '出発まで席が決まらない空席待ち（Standby）か、あらかじめ席を押さえられるかです。' },
    en: { short: 'Standby or confirmed', label: 'Are staff travel seats standby only, or can they be confirmed?',
          help: 'Whether you wait for a free seat at the gate, or can hold a seat in advance.' },
    choices: [
      { code: 'standby',   ja: '空席待ちのみ',     en: 'Standby only' },
      { code: 'both',      ja: '両方ある',         en: 'Both exist' },
      { code: 'confirmed', ja: '座席を確保できる', en: 'Seats can be confirmed' },
      { code: UNKNOWN,     ja: 'わからない',       en: "Don't know" },
    ],
  },
  {
    /* ★2026-11-17 1つ選ぶ（staff_travel_cabin・止めた）から複数選ぶにした（オーナー判断・見直し案17）。
         「空席があれば乗れる」と「職位・勤続で優先順位が決まる」は両方当てはまる人が多く、どちらを選ぶかで答えが割れた。
         追加の料金を払って乗る形も選べなかった。意味が変わるので新しい id（今までの答えとは混ぜて数えない）。
         複数選ぶので、提出直後の1問枠（micro）からは外れる（戻ってきた会員に聞く板・情報を追加には出る）。
       ★「エコノミーのみ」はほかと一緒に選ばない答え ── 説明でそう頼む（タクシーの「制限はない」と同じ書き方）。
       ★家族が使えるか（staff_travel_family）は同じ日に止めた。券ごとの「誰が使えますか？」2問に任せる
         （券が「両方ある」人は、家族のことを3回聞かれていた）。 */
    id: 'staff_travel_premium', version: 1, section: 'benefits', kind: 'multi',
    tier: 'B', micro: false, priority: 590, topic: 'staff_travel',
    parent: 'staff_travel', parentWhen: ['yes', 'some_pilots'],
    ja: { short: '上位クラス', label: '社員航空券で、ビジネスクラスなど上位クラスに乗れますか？',
          help: '当てはまるものをすべて選んでください。上位クラスに乗れない場合は「エコノミーのみ」だけを選んでください。' },
    en: { short: 'Premium cabin', label: 'On staff travel, can you fly in a premium cabin such as business class?',
          help: 'Select all that apply. If premium cabins are not available to you, choose only "Economy only".' },
    choices: [
      { code: 'free',         ja: '乗れる（追加の料金なし）',             en: 'Yes — at no extra charge' },
      { code: 'paid',         ja: '乗れる（上位クラスの料金を払う）',     en: 'Yes — by paying a premium-cabin fare' },
      { code: 'some',         ja: '一部の人だけ乗れる（職位・勤続など）', en: 'Only some pilots (by rank or seniority)' },
      { code: 'if_available', ja: '空席が出たときだけ',                   en: 'Only when premium seats are free' },
      { code: 'economy',      ja: 'エコノミーのみ',                       en: 'Economy only' },
    ],
  },
  {
    /* ── 券の種類ごとの回数と本人の負担（2026-10-04 追加・オーナー指示） ─────
       ★券の種類を混ぜない。親は staff_travel_booking（空席待ちのみ／両方ある／座席を
         確保できる）＝ 券の種類そのもの。空席待ちの3問は standby・both、確保できる券の
         3問は both・confirmed のときだけ出る。「両方ある」の人には6問とも出る
         （回数・本人の負担・使える人。使える人は下の staff_travel_standby_family）。
         1問で「合わせた回数」を聞くと、回数に上限の無い空席待ちの券と、年に数回と
         決まっている券が1つの答えに混ざって、どちらの制度も読めなくなる。
       ★親が2段（staff_travel → staff_travel_booking → ここ）。出す・受け取る・数えるは、
         いちばん上の親まで条件が続いているときだけ（冒頭の 2026-10-04 の注記）。
       ★数値の欄にしない。「上限が無い」会社は数で答えられず、空欄と区別が付かなくなる。
         段はどの会社の制度とも無関係な切り方にしておく（特定の会社の枚数を境目にすると、
         その会社の人しか迷わず答えられない）。空席待ちは月1回（年12回）と四半期に1回（年4回）。
       ★往復で数える。会社によって「枚」「区間」「回」と数え方が違うので、
         そのまま聞くと同じ制度が2倍の差で入る。聞くのは本人が使える回数。
       ★label だけで何の話か分かるように書く（「その」「それ」で親を指さない）。
         提出直後の1問枠（micro）と ?q= の入口では、親の質問が隣に無い。 */
    id: 'staff_travel_standby_trips', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 610, topic: 'staff_travel',
    parent: 'staff_travel_booking', parentWhen: ['standby', 'both'],
    ja: { short: '空席待ちの回数', label: '空席待ちの社員向け航空券は、1年に何回まで使えますか？',
          help: '出発まで席が決まらない券（Standby）を、あなた本人が使える回数です。往復を1回と数えます。勤続年数や契約で変わる場合は、今のあなたの回数で構いません。' },
    en: { short: 'Standby trips per year', label: 'How many times a year can you use standby staff tickets?',
          help: 'Tickets where you wait for a free seat. Your own allowance, counting a return trip as one. If it varies by seniority or contract, your own current entitlement is fine.' },
    choices: [
      { code: 'unlimited',     ja: '上限はない',   en: 'No limit' },
      { code: 'limit_13_plus', ja: '年13回以上',   en: '13 or more a year' },
      { code: 'limit_5_12',    ja: '年5〜12回',    en: '5 to 12 a year' },
      { code: 'limit_1_4',     ja: '年1〜4回',     en: '1 to 4 a year' },
      { code: UNKNOWN,         ja: 'わからない',   en: "Don't know" },
    ],
  },
  {
    /* ★額は聞かない。路線で変わり、1つの数字に丸めると何の額か分からなくなる。
         転職の判断に効くのは「運賃を払うのか、諸費用だけなのか」の形のほう。
       ★「券の種類によって違う」を置かない。種類ごとに別の質問にしたので、要らない
         （置くと、いちばん知りたい所がその1つに集まって読めなくなる）。 */
    id: 'staff_travel_standby_cost', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 620, topic: 'staff_travel',
    parent: 'staff_travel_booking', parentWhen: ['standby', 'both'],
    ja: { short: '空席待ちの本人負担', label: '空席待ちの社員向け航空券で乗るとき、本人が払うのはどれに近いですか？',
          help: '出発まで席が決まらない券（Standby）についてです。運賃そのものを払うのか、税金や空港使用料などの諸費用だけなのかです。' },
    en: { short: 'Standby ticket cost', label: 'What do you pay yourself when you fly on a standby staff ticket?',
          help: 'For tickets where you wait for a free seat: whether you pay a fare, or only taxes and airport charges.' },
    choices: [
      { code: 'free',         ja: '何も払わない',         en: 'Nothing' },
      { code: 'taxes_only',   ja: '税金・諸費用だけ',     en: 'Taxes and charges only' },
      { code: 'reduced_fare', ja: '割引された運賃を払う', en: 'A reduced fare' },
      { code: UNKNOWN,        ja: 'わからない',           en: "Don't know" },
    ],
  },
  {
    /* ── 券の種類ごとの「使える人」（2026-10-04 追加・同じ日の見直しの指摘） ───
       ★本番の staff_travel_family（本人のみ／配偶者・パートナーまで／子や親も）は、券の種類を
         分けずに1問で聞いている。券の種類で対象が違う制度を、あの1問では書き分けられない
         （片方は親まで・もう片方は本人だけ、のような形）。あちらは本番に在るので触らず、
         券の種類ごとに誰が使えるかをここで聞く。★2026-11-17 共通の1問は止めた（家族のことはこの2問だけで聞く）。
       ★複数選択。「子は使えるが親は使えない」「家族でなくても本人が指名した人が使える」は、
         広さの段（本人 → 配偶者 → 家族）に並ばない。1つ選ばせると、どれかが消える。
         複数選択は1問枠（micro）には出ないので、詳細ページと ?q= の入口で集まる。
       ★「本人」も選択肢に置く。選ばれた家族の並びだけでは、本人が使えるのかが読めない
         （本人が使えず、家族だけが使える券は置いていない、とは言い切れない）。
       ★人数や年齢の上限は聞かない（子の年齢など。数字を境目にすると会社ごとに違う）。 */
    id: 'staff_travel_standby_family', version: 1, section: 'benefits', kind: 'multi',
    tier: 'B', micro: false, priority: 630, topic: 'staff_travel',
    parent: 'staff_travel_booking', parentWhen: ['standby', 'both'],
    ja: { short: '空席待ちの対象', label: '空席待ちの社員向け航空券は、誰が使えますか？',
          help: '出発まで席が決まらない券（Standby）を使える人を、すべて選んでください。' },
    en: { short: 'Standby eligibility', label: 'Who can travel on standby staff tickets?',
          help: 'Tickets where you wait for a free seat. Select everyone who can use them.' },
    choices: [
      { code: 'self',     ja: '本人',                           en: 'The employee' },
      { code: 'partner',  ja: '配偶者・パートナー',             en: 'Spouse or partner' },
      { code: 'children', ja: '子',                             en: 'Children' },
      { code: 'parents',  ja: '親',                             en: 'Parents' },
      { code: 'siblings', ja: 'きょうだい',                     en: 'Brothers and sisters' },
      { code: 'nominee',  ja: '本人が指名した人（家族以外）',   en: 'Someone you nominate (not family)' },
      { code: 'other',    ja: 'その他',                         en: 'Other' },
    ],
  },
  {
    /* ★段を空席待ちと同じにしない。席を確保できる券は年に1〜数回という決め方が普通で、
         「年1〜4回」の1段にまとめると、年1回と年4回の差が消える。
         年1回・半年に1回（年2回）・四半期に1回（年4回）で切ってある。 */
    id: 'staff_travel_confirmed_trips', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 640, topic: 'staff_travel',
    parent: 'staff_travel_booking', parentWhen: ['both', 'confirmed'],
    ja: { short: '確保席の回数', label: '座席を確保できる社員向け航空券は、1年に何回まで使えますか？',
          help: 'あらかじめ席を押さえられる券を、あなた本人が使える回数です。往復を1回と数えます。勤続年数や契約で変わる場合は、今のあなたの回数で構いません。' },
    en: { short: 'Confirmed trips per year', label: 'How many times a year can you use confirmed-seat staff tickets?',
          help: 'Tickets where the seat is held in advance. Your own allowance, counting a return trip as one. If it varies by seniority or contract, your own current entitlement is fine.' },
    choices: [
      { code: 'unlimited',    ja: '上限はない', en: 'No limit' },
      { code: 'limit_5_plus', ja: '年5回以上',  en: '5 or more a year' },
      { code: 'limit_3_4',    ja: '年3〜4回',   en: '3 or 4 a year' },
      { code: 'limit_2',      ja: '年2回',      en: 'Twice a year' },
      { code: 'limit_1',      ja: '年1回',      en: 'Once a year' },
      { code: UNKNOWN,        ja: 'わからない', en: "Don't know" },
    ],
  },
  {
    id: 'staff_travel_confirmed_cost', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 650, topic: 'staff_travel',
    parent: 'staff_travel_booking', parentWhen: ['both', 'confirmed'],
    ja: { short: '確保席の本人負担', label: '座席を確保できる社員向け航空券で乗るとき、本人が払うのはどれに近いですか？',
          help: 'あらかじめ席を押さえられる券についてです。運賃そのものを払うのか、税金や空港使用料などの諸費用だけなのかです。' },
    en: { short: 'Confirmed-seat cost', label: 'What do you pay yourself when you fly on a confirmed-seat staff ticket?',
          help: 'For tickets where the seat is held in advance: whether you pay a fare, or only taxes and airport charges.' },
    choices: [
      { code: 'free',         ja: '何も払わない',         en: 'Nothing' },
      { code: 'taxes_only',   ja: '税金・諸費用だけ',     en: 'Taxes and charges only' },
      { code: 'reduced_fare', ja: '割引された運賃を払う', en: 'A reduced fare' },
      { code: UNKNOWN,        ja: 'わからない',           en: "Don't know" },
    ],
  },
  {
    /* ★選択肢は空席待ちの側（staff_travel_standby_family）と1文字も違えない。
         同じ会社の2つの券を並べて読むための質問なので、片方だけ選択肢が違うと比べられない
         （db/test-conditions.mjs が2問の選択肢を突き合わせている）。 */
    id: 'staff_travel_confirmed_family', version: 1, section: 'benefits', kind: 'multi',
    tier: 'B', micro: false, priority: 660, topic: 'staff_travel',
    parent: 'staff_travel_booking', parentWhen: ['both', 'confirmed'],
    ja: { short: '確保席の対象', label: '座席を確保できる社員向け航空券は、誰が使えますか？',
          help: 'あらかじめ席を押さえられる券を使える人を、すべて選んでください。' },
    en: { short: 'Confirmed-seat eligibility', label: 'Who can travel on confirmed-seat staff tickets?',
          help: 'Tickets where the seat is held in advance. Select everyone who can use them.' },
    choices: [
      { code: 'self',     ja: '本人',                           en: 'The employee' },
      { code: 'partner',  ja: '配偶者・パートナー',             en: 'Spouse or partner' },
      { code: 'children', ja: '子',                             en: 'Children' },
      { code: 'parents',  ja: '親',                             en: 'Parents' },
      { code: 'siblings', ja: 'きょうだい',                     en: 'Brothers and sisters' },
      { code: 'nominee',  ja: '本人が指名した人（家族以外）',   en: 'Someone you nominate (not family)' },
      { code: 'other',    ja: 'その他',                         en: 'Other' },
    ],
  },
  {
    id: 'staff_travel_who', version: 1, section: 'benefits', kind: 'multi',
    tier: 'A', micro: false, priority: 661, topic: 'staff_travel', otherText: true, deep: 'partial',
    parent: 'staff_travel', parentWhen: ['some_pilots'],
    ja: { short: '社員航空券の対象', label: '社員航空券を使えるのは、どのパイロットですか？',
          help: '当てはまるものを全部選んでください。', cue: 'どのパイロット？' },
    en: { short: 'Who is eligible', label: 'Which pilots are eligible for staff travel?',
          help: 'Pick all that apply.', cue: 'Which pilots?' },
    choices: [
      { code: 'contract',  ja: '契約の形による（直接雇用・Expat 契約・派遣など）', en: 'Depends on contract (direct, expat, agency)' },
      { code: 'service',   ja: '一定の在籍期間を過ぎた人',                       en: 'Only after a qualifying period of service' },
      { code: 'base',      ja: '一部の拠点',                                     en: 'Some bases' },
      { code: 'rank',      ja: '職位（機長だけ など）',                          en: 'By rank (e.g. captains only)' },
      { code: 'probation', ja: '訓練中・試用期間中は使えない',                   en: 'Not during training or probation' },
      { code: 'other',     ja: 'その他',                                         en: 'Other' },
    ],
  },
  {
    /* ── 出退社の移動（2026-08-19 追加・オーナー指示） ─────────────────
       ★毎月定額で出る通勤手当と混ぜない。あれは給与明細の「交通費」で
         既に集めている（payslip.js の f-transport）。同じものを2箇所で
         集めると、どちらの数字も何を指すのか分からなくなる。
       ★Tier B。日本と一部の会社に強く偏り、横断比較の軸としては社用航空券より弱い。 */
    id: 'commuting_transport', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 670, topic: 'taxi',
    ja: { short: '出社・帰宅の移動', label: '出社・帰宅の移動を、会社が用意または負担しますか？',
          help: '会社が手配するタクシー、クルーバス、あとから精算する運賃などです。毎月定額で出る通勤手当のことではありません。' },
    en: { short: 'Transport to work', label: 'Does the company provide or pay for your travel to and from work?',
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
    tier: 'B', micro: false, priority: 680, topic: 'taxi',
    parent: 'commuting_transport', parentWhen: ['always', 'conditional'],
    ja: { short: '移動の形', label: '出社・帰宅の移動は、どの形で用意されますか？', help: '当てはまるものをすべて選んでください。' },
    en: { short: 'Transport type', label: 'How is transport to and from work provided?', help: 'Select all that apply.' },
    choices: [
      { code: 'company_taxi', ja: '会社が手配するタクシー',     en: 'Taxi arranged by the company' },
      { code: 'reimburse',    ja: '自分で乗って後から精算',     en: 'You travel and claim it back' },
      { code: 'crew_bus',     ja: '送迎バス・クルーバス',       en: 'Company or crew bus' },
      { code: 'hotel',        ja: '前泊や仮眠室で対応',         en: 'Pre-duty hotel or rest room instead' },
      { code: 'other',        ja: 'その他',                     en: 'Other' },
    ],
  },
  {
    /* ── 手段ごとの条件（2026-10-04 追加・同じ日の見直しの指摘） ───────────
       ★手段を混ぜない。親は commuting_transport_method（複数選択）＝ 手段そのもの。
         タクシーの3問は company_taxi・reimburse、クルーバスの2問は crew_bus を選んだ人にだけ出る。
         両方を選んだ人には5問とも出る。手段をまとめて1問ずつ聞くと、手段ごとに条件が違う制度
         （片方はいつでも・会社が全額、もう片方は時間が限られて一部は本人、のような形）が
         1つの答えに混ざって、どちらの条件も読めなくなる。
       ★親が2段（commuting_transport → commuting_transport_method → ここ）で、すぐ上の親は
         複数選択。選んだものの中に parentWhen が1つでも入っていれば出す・受け取る・数える
         （冒頭の 2026-10-04 の注記）。
       ★「どんなときに」は複数選択で、先頭に「制限はない（いつでも）」を置く。
         いちばん上の親（いつでも使える／条件付きで使える）は手段を分けずに聞いているので、
         「バスはいつでも・タクシーは条件付き」の人は、ここでしか書き分けられない。
         なので親が「いつでも使える」の人にも出す（「条件付き」の人だけに絞らない）。
       ★選択肢は**何が起きたときか**で書く。時刻そのものや距離の数字を選択肢にしない
         （会社ごとに違う数字を境目にすると、その会社の人しか迷わず答えられない）。
       ★label だけで何の手段の話か分かるように書く（「その」「それ」で親を指さない）。
         提出直後の1問枠（micro）と ?q= の入口では、親の質問が隣に無い。
       ★前泊・仮眠室（hotel）と「その他」には、条件の質問を置かない。移動の手段ではなく、
         足すと5問がさらに増える。 */
    id: 'commuting_taxi_when', version: 1, section: 'benefits', kind: 'multi',
    tier: 'B', micro: false, priority: 690, topic: 'taxi',
    parent: 'commuting_transport_method', parentWhen: ['company_taxi', 'reimburse'],
    ja: { short: 'タクシーが使えるとき', label: 'タクシーでの出社・帰宅は、どんなときに会社の手配や精算で使えますか？',
          help: '会社が手配するタクシーと、自分で乗ってあとから精算する場合についてです。当てはまるものをすべて選んでください。制限が無ければ「制限はない」だけを選んでください。' },
    en: { short: 'Taxi: when', label: 'When can you take a taxi to or from work, arranged or reimbursed by the company?',
          help: 'For taxis the company arranges, and rides you pay for and claim back. Select all that apply. If there is no restriction, choose only "No restriction".' },
    choices: [
      { code: 'any_time',            ja: '制限はない（いつでも）',               en: 'No restriction (any time)' },
      { code: 'no_public_transport', ja: '公共交通が動いていない時間の出退勤',   en: 'Reporting or finishing when public transport is not running' },
      { code: 'outside_set_hours',   ja: '決まった時刻より早い出社・遅い退社',   en: 'Reporting before, or finishing after, a set time' },
      { code: 'standby_callout',     ja: 'Reserve・Standby からの呼び出し',     en: 'A call-out from reserve or standby' },
      { code: 'disruption',          ja: '遅延などで予定が変わったとき',         en: 'When a delay or disruption changes your duty' },
      { code: 'other',               ja: 'その他',                               en: 'Other' },
    ],
  },
  {
    /* ★いつでも乗れる会社でも、届く範囲は別に決まっている（自宅までか、決められた
         場所までか）。なので、タクシーを選んだ人の全員に聞く。
       ★距離の数字は聞かない。形（制限なし／範囲の中だけ／決められた場所まで）だけ。
       ★クルーバスには「どこまで」を置かない。バスは決まった経路を走るもので、
         自宅まで届くかどうかを聞く質問がそのままは当てはまらない。 */
    id: 'commuting_taxi_where', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 700, topic: 'taxi',
    parent: 'commuting_transport_method', parentWhen: ['company_taxi', 'reimburse'],
    ja: { short: 'タクシーの範囲', label: 'タクシーでの出社・帰宅は、どこまで会社の手配や精算で使えますか？',
          help: '会社が手配するタクシーと、自分で乗ってあとから精算する場合についてです。自宅まで使えるのか、距離や地域、決められた場所までに限られるのかです。' },
    en: { short: 'Taxi: coverage', label: 'How far does a company-arranged or reimbursed taxi to or from work reach?',
          help: 'For taxis the company arranges, and rides you pay for and claim back: whether it covers the whole way between home and the airport, only a set distance or area, or only as far as a set point.' },
    choices: [
      { code: 'door_to_door', ja: '自宅と空港のあいだ・距離の制限なし',       en: 'Between home and the airport, with no distance limit' },
      { code: 'within_area',  ja: '決められた範囲（距離・地域）の中だけ',     en: 'Only within a set distance or area' },
      { code: 'to_set_point', ja: '決められた場所（駅・集合場所など）まで',   en: 'Only as far as a set point (a station or pick-up point)' },
      { code: UNKNOWN,        ja: 'わからない',                               en: "Don't know" },
    ],
  },
  {
    /* ── 費用の負担（2026-10-04 追加・オーナー指示） ───────────────────
       ★「会社が手配する」と「会社が払う」は別のこと。手配は会社でも、費用は給与から
         引かれる会社がある。いちばん上の親は「用意または負担」をまとめて聞いているので、
         ここで分ける。
       ★額や上限の金額は聞かない（地域と距離で変わる。聞くなら給与明細の「交通費」の側）。 */
    id: 'commuting_taxi_cost', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 710, topic: 'taxi',
    parent: 'commuting_transport_method', parentWhen: ['company_taxi', 'reimburse'],
    ja: { short: 'タクシー代の負担', label: 'タクシーでの出社・帰宅の費用は、誰が負担しますか？',
          help: '会社が手配するタクシーと、自分で乗ってあとから精算する場合についてです。会社が全額を持つのか、本人の負担があるのかです。' },
    en: { short: 'Taxi: who pays', label: 'Who pays for a taxi to or from work?',
          help: 'For taxis the company arranges, and rides you pay for and claim back: whether the company covers the whole cost, or you pay some of it.' },
    choices: [
      { code: 'company_full', ja: '会社が全額',                           en: 'The company pays all of it' },
      { code: 'partial',      ja: '一部は本人（上限額・定額の負担など）', en: 'You pay part (a cap or a fixed share)' },
      { code: 'self_full',    ja: '本人が全額（手配だけ会社）',           en: 'You pay all of it (the company only arranges it)' },
      { code: UNKNOWN,        ja: 'わからない',                           en: "Don't know" },
    ],
  },
  {
    /* ── 上限の形（2026-10-04 追加・オーナー判断） ─────────────────────
       ★話題の入口（通勤タクシー）から来た人にだけ出す（topicOnly）。提出直後の1問枠にも
         一覧にも出さず、「答えた項目：N／48」にも数えない（冒頭の 2026-10-04 の2つ目の注記）。
       ★上の commuting_taxi_cost は「誰が負担するか」。こちらは**会社が払う額に上限があるか**。
         「一部は本人」が、上限を超えた分なのか毎回の定額なのかは、あちらでは分からない。
       ★額は聞かない（地域と距離で変わる）。聞くのは上限の形だけ。額を書ける人は任意の補足へ
         （自由記述は公開集計に一切出さない）。
       ★親と条件は commuting_taxi_cost と同じ ＝ タクシーを選んだ人にだけ開く。
       ★label だけで何の話か分かるように書く（「その」「それ」で前の質問を指さない）。 */
    id: 'commuting_taxi_cap', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: false, priority: 720, topic: 'taxi', topicOnly: true, note: true,
    parent: 'commuting_transport_method', parentWhen: ['company_taxi', 'reimburse'],
    ja: { short: 'タクシー代の上限', label: '通勤のタクシー代に、上限はありますか？',
          help: '会社が手配するタクシーと、自分で乗ってあとから精算する場合についてです。会社が払う額に上限があるかどうかです。上限の額は、書ける場合だけ補足に書いてください。' },
    en: { short: 'Taxi: cap', label: 'Is there a cap on what the company pays for a taxi to or from work?',
          help: 'For taxis the company arranges, and rides you pay for and claim back: whether there is a limit on what the company covers. If you can, give the amount in the note.' },
    choices: [
      { code: 'no_cap',    ja: '上限はない',           en: 'No cap' },
      { code: 'per_ride',  ja: '1回ごとの上限がある',  en: 'A cap per ride' },
      { code: 'per_month', ja: '月ごとの上限がある',   en: 'A cap per month' },
      { code: 'by_zone',   ja: '距離・区域で決まる',   en: 'Set by distance or zone' },
      { code: UNKNOWN,     ja: 'わからない',           en: "Don't know" },
    ],
  },
  {
    /* ★選択肢はタクシーの側（commuting_taxi_when）と1文字も違えない。同じ会社の2つの手段を
         並べて読むための質問なので、片方だけ選択肢が違うと比べられない
         （db/test-conditions.mjs が突き合わせている）。 */
    id: 'commuting_bus_when', version: 1, section: 'benefits', kind: 'multi',
    tier: 'B', micro: false, priority: 730, topic: 'taxi',
    parent: 'commuting_transport_method', parentWhen: ['crew_bus'],
    ja: { short: 'クルーバスの利用', label: 'クルーバス（送迎バス）は、どんなときに出社・帰宅で使えますか？',
          help: '会社が走らせる送迎バス・クルーバスについてです。当てはまるものをすべて選んでください。制限が無ければ「制限はない」だけを選んでください。' },
    en: { short: 'Crew bus: when', label: 'When can you use the crew bus (company bus) to get to or from work?',
          help: 'For a bus the company runs for crew or staff. Select all that apply. If there is no restriction, choose only "No restriction".' },
    choices: [
      { code: 'any_time',            ja: '制限はない（いつでも）',               en: 'No restriction (any time)' },
      { code: 'no_public_transport', ja: '公共交通が動いていない時間の出退勤',   en: 'Reporting or finishing when public transport is not running' },
      { code: 'outside_set_hours',   ja: '決まった時刻より早い出社・遅い退社',   en: 'Reporting before, or finishing after, a set time' },
      { code: 'standby_callout',     ja: 'Reserve・Standby からの呼び出し',     en: 'A call-out from reserve or standby' },
      { code: 'disruption',          ja: '遅延などで予定が変わったとき',         en: 'When a delay or disruption changes your duty' },
      { code: 'other',               ja: 'その他',                               en: 'Other' },
    ],
  },
  {
    id: 'commuting_bus_cost', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: true, priority: 740, topic: 'taxi',
    parent: 'commuting_transport_method', parentWhen: ['crew_bus'],
    ja: { short: 'クルーバスの負担', label: 'クルーバス（送迎バス）の費用は、誰が負担しますか？',
          help: '会社が走らせる送迎バス・クルーバスについてです。会社が全額を持つのか、本人の負担があるのかです。' },
    en: { short: 'Crew bus: who pays', label: 'Who pays for the crew bus (company bus) to or from work?',
          help: 'For a bus the company runs for crew or staff: whether the company covers the whole cost, or you pay some of it.' },
    choices: [
      { code: 'company_full', ja: '会社が全額',                           en: 'The company pays all of it' },
      { code: 'partial',      ja: '一部は本人（上限額・定額の負担など）', en: 'You pay part (a cap or a fixed share)' },
      { code: 'self_full',    ja: '本人が全額（運行だけ会社）',           en: 'You pay all of it (the company only runs it)' },
      { code: UNKNOWN,        ja: 'わからない',                           en: "Don't know" },
    ],
  },
  /* ── 日当（パーディアム）（2026-10-30 オーナー指示「1日あたりのパーディアムを聞いて。国内線、国際線」）──
     ★親で「出るか・どちらに出るか」を聞き、出る側の額だけを聞く（国際線しか飛ばない会社の人に国内線の額を聞かない）。
     ★額は通貨と一緒に聞く。下限は 1 ＝ 0 を「答えた」として保存させない（出ない人は親で「出ない」）。
     ★見本の額を help に書かない（会社ごとに違う。書いた額に答えが引っぱられる）。
     ★micro にしない（提出直後の1問枠は今のまま）。
     ★並びの最後に置く（priority を詰め直すと、ほかの質問の番号が全部動くため）。一覧の画面では待遇の節の最後に出る。 */
  {
    id: 'per_diem', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: false, priority: 750,
    ja: { short: '日当（パーディアム）', label: '乗務の日当（パーディアム）は出ますか？',
          help: 'ステイ先での食事代などとして、乗務の日数や時間に応じて出る手当です。' },
    en: { short: 'Per diem', label: 'Is per diem paid on trips?',
          help: 'A daily allowance for meals and expenses away from base, paid by trip days or hours.' },
    choices: [
      { code: 'both',      ja: '国内線・国際線とも出る', en: 'Yes — domestic and international' },
      { code: 'intl_only', ja: '国際線だけ出る',         en: 'International only' },
      { code: 'dom_only',  ja: '国内線だけ出る',         en: 'Domestic only' },
      { code: 'no',        ja: '出ない',                 en: 'No' },
      { code: UNKNOWN,     ja: 'わからない',             en: "Don't know" },
    ],
  },
  {
    /* ★2026-11-17 足した（見直し案24）。日当が出る人にだけ聞く。時間ごとに出る会社の人は「1日いくら」を自分で換算していて、
         換算のしかたで額がずれる。出方が分かれば、国内線・国際線の額を同じ物差しで読める。
       ★額の質問より前に置く（何の単位の額かを先に聞く）。micro にしない（日当の枝は提出直後の1問枠に出さない ── 上の注記）。 */
    id: 'per_diem_basis', version: 1, section: 'benefits', kind: 'choice',
    tier: 'B', micro: false, priority: 755,
    parent: 'per_diem', parentWhen: ['both', 'intl_only', 'dom_only'],
    ja: { short: '日当の出方', label: '日当（パーディアム）は、何に応じて出ますか？', help: '' },
    en: { short: 'Per diem basis', label: 'What is per diem paid by?', help: '' },
    choices: [
      { code: 'per_day',     ja: '乗務した日ごと（1日いくら）',               en: 'Per duty day (a daily rate)' },
      { code: 'per_hour',    ja: '拠点を離れていた時間ごと（1時間いくら）',   en: 'Per hour away from base (an hourly rate)' },
      { code: 'per_layover', ja: 'ステイ（宿泊）1回ごと',                     en: 'Per layover (each night away)' },
      { code: UNKNOWN,       ja: 'わからない',                                 en: "Don't know" },
    ],
  },
  {
    id: 'per_diem_domestic', version: 1, section: 'benefits', kind: 'num',
    tier: 'B', micro: false, priority: 760,
    parent: 'per_diem', parentWhen: ['both', 'dom_only'],
    currency: true,
    num: { min: 1, max: 10000000, step: 0.01, ja: '（1日あたり）', en: '(per day)' },
    ja: { short: '国内線の日当', label: '国内線の日当は1日いくらですか？',
          help: '国内線の乗務で1日あたりに出る額です。時間で計算される場合は、1日分の目安で構いません。' },
    en: { short: 'Domestic per diem', label: 'Domestic per diem: how much per day?',
          help: 'The amount paid per day on domestic trips. If it is paid by the hour, a rough daily figure is fine.' },
  },
  {
    id: 'per_diem_international', version: 1, section: 'benefits', kind: 'num',
    tier: 'B', micro: false, priority: 770,
    parent: 'per_diem', parentWhen: ['both', 'intl_only'],
    currency: true,
    num: { min: 1, max: 10000000, step: 0.01, ja: '（1日あたり）', en: '(per day)' },
    ja: { short: '国際線の日当', label: '国際線の日当は1日いくらですか？',
          help: '国際線の乗務で1日あたりに出る額です。行き先で変わる場合は、いちばんよく行く行き先の額で構いません。' },
    en: { short: 'International per diem', label: 'International per diem: how much per day?',
          help: 'The amount paid per day on international trips. If it varies by destination, use the one you fly to most.' },
  },
];

/* ── 答えが分かれた会社でだけ聞く「何によって違いますか？」（deep:'split'・2026-11-14 オーナー指示）────
   「一部可能にはもう一つ突っ込んで質問して欲しい。あと回答が分かれている場合も」。
   会社ページのカードが「回答が分かれています」になる（db/contrib.sql の pv_condition_lead が決める1か所）質問について、
   その親に答えた人へ、親のすぐ下で「同じ会社の中で何によって違うか」を聞く。
   ★親は、1つ選ぶ・会社の事実の・親を持たない質問ぜんぶ（話題の入口だけの質問は除く）。型から作るので、質問を足せば続きも付く。
   ★parentWhen は親の「わからない」以外の全部 ＝ 保存の検品と集計は、今の子の質問と同じ決まりのまま通る。
     「分かれている会社でだけ出す」は**見せるかどうかの門**（pv_condition_split）。保存では見ない
     （出したあとに同点が崩れても、もらった答えは捨てない）。
   ★続きの質問（deep）は「質問の一覧の行」にも「答えた項目：N／◯」にも数えない ＝ 冒頭の「これ以上、質問を増やさない」の数は変わらない。
   ★選ぶ答えは全部の親で同じ（並びも同じ）。並び順の番号は、親の続き（子・孫・「一部」の続き）のすぐ後ろ ＋1。 */
/* ★2026-11-16 複数選ぶ＋その他の欄にした（冒頭の注記）。足したコードは tenure・route・no_rule・other。
     mixed（いくつか当てはまる・その他）と unknown は外した（複数選ぶ質問の「わからない」は画面が足す）。 */
const SPLIT_CHOICES = [
  { code: 'rank',      ja: '職位（機長・副操縦士）',     en: 'Rank (captain or first officer)' },
  { code: 'fleet',     ja: '機種',                       en: 'Fleet' },
  { code: 'base',      ja: '拠点',                       en: 'Base' },
  { code: 'seniority', ja: '先任順位（Seniority）',      en: 'Seniority' },
  { code: 'tenure',    ja: '在籍年数',                   en: 'Years of service' },
  { code: 'contract',  ja: '契約の形（直接雇用・Expat・派遣など）', en: 'Contract type (direct, expat, agency, etc.)' },
  { code: 'route',     ja: '路線（国内線・国際線など）', en: 'Route (domestic, international, etc.)' },
  { code: 'changed',   ja: '最近、制度が変わった',       en: 'The policy changed recently' },
  { code: 'no_rule',   ja: '決まった基準が無い（その時々で違う）', en: 'No fixed rule (case by case)' },
  { code: 'other',     ja: 'その他',                     en: 'Other' },
];
const splitOf = (p) => !p.parent && p.kind === 'choice' && !p.isOpinion && !p.topicOnly && !p.retired;
function withSplit(list) {
  const out = [...list];
  const under = (id, q) => { for (let x = q; x && x.parent; x = list.find((y) => y.id === x.parent)) if (x.parent === id) return true; return false; };
  for (const p of list.filter(splitOf)) {
    let i = out.indexOf(p) + 1;
    while (i < out.length && under(p.id, out[i])) i++;
    const prev = out[i - 1], next = out[i];
    const priority = prev.priority + 1;
    if (next && priority >= next.priority) throw new Error(`withSplit: ${p.id} の続きを置く番号が無い（${prev.id} の次 ${priority} が ${next.id} と並ぶ）`);
    out.splice(i, 0, {
      id: `${p.id}_split`, version: 1, section: p.section, kind: 'multi',
      tier: p.tier, micro: false, priority, otherText: true, deep: 'split',
      ...(p.topic ? { topic: p.topic } : {}),
      parent: p.id, parentWhen: p.choices.map((c) => c.code).filter((c) => c !== UNKNOWN),
      ja: { short: '何で違うか', label: `「${p.ja.short}」は、同じ会社の中で何によって違いますか？`,
            help: '同じ会社でも、パイロットによって答えが違うことがあります。当てはまるものを全部選んでください。', cue: '何によって違う？' },
      en: { short: 'What it varies by', label: `Within the same airline, what does “${p.en.short}” vary by?`,
            help: 'Pilots at the same airline sometimes answer differently. Pick all that apply.', cue: 'What does it vary by?' },
      choices: SPLIT_CHOICES.map((c) => ({ ...c })),
    });
  }
  return out;
}
export const QUESTIONS = withSplit(BASE);

/* 自由記述の上限。DB 側の check 制約と画面の maxlength を同じ数にするため
   ここから配る。★長い文章は個人特定の材料になるので、そもそも長く書かせない。 */
export const TEXT_MAX = 300;

/* 「その他」の欄（otherText）の上限（2026-11-16）。1行で書けるだけ ＝ 画面の maxlength とサーバの断り（pv_condition_clean）を
   同じ数にする（gen-conditions.mjs が pv-conditions.json の limits と pv_condition_limits() へ配る）。 */
export const OTHER_TEXT_MAX = 100;

/* 明細行（kind:'lines'）の上限。★今この形の質問は無い（手当の明細は見送り）。
   縦持ちなので、足すときは DB を変えずにこのファイルの編集だけで済む。
   そのとき上限を決め直さずに済むよう、値と検証だけ先に置いておく。 */
export const LINES_MAX = 10;
export const LINE_NAME_MAX = 40;
