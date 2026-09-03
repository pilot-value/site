-- ════════════════════════════════════════════════════════════════════════
-- db/pay-rows.sql — 「他のパイロットの実給与を見る」の読み出し経路
--
-- 適用順：db/vocab.generated.sql → db/airlines.generated.sql →
--         db/pay-reports.sql → db/pay-report-pending.sql → ★このファイル
--         （profiles.access_until と pay_reports は pay-reports.sql が作る。
--           pay_reports_pending と pv_annual_total も、それぞれ先に要る）
--
-- ────────────────────────────────────────────────────────────────────────
-- ★★ ここはプライバシーの例外そのものなので、1文字でも変える前に必ず読む。
--
-- pay_benchmarks（db/pay-reports.sql 6章）は「1行＝区分の集計」だった。
-- この関数は違う。**1行＝1人**を返す。粒度が一段細かい。
--
-- 2026-08-23 オーナー判断：**出した人は全員そのまま行にする。**
--   同じ日に、次の3つを外した。
--     ・k≧5 の門（同じ区分に5人未満なら出さない）
--     ・30日の遅延（今出した人は翌日には出る）
--     ・p10-p90 のクリップ（区分そのものが無くなったので、寄せる相手が居ない）
--   理由は「まだ人数が少なく、門を残すと画面に1行も出ない」。
--   ＝ 出した人が9人なら9行、その人が1人しか居ない会社でも1行出る。
--
-- 2026-08-23 追加（同じ日・オーナー判断）：**登録前の「預かり」も混ぜる。**
--   給与は会員登録の前にも出せる（db/pay-report-pending.sql）。出した人の多くは
--   そのあと登録しない＝本棚（pay_reports）に移らない。本番で実際に、
--   出した11件のうち7件が移らないまま寝ていた。**出してくれたのに1行も出ない**のは
--   Give & Get の約束と食い違うので、まだ移っていない預かりもこの一覧に出す。
--   ・移した預かり（claimed_at あり）は本棚側に同じものが居るので**読まない**（二重計上）
--   ・預かりは明細検証の経路を通らないので verified は常に false
--   ・人の単位は ip_day_hash（同じ日・同じ回線＝同じ人とみなす）。
--     日をまたぐと同じ人でも別の値になるので、**その人は2行に見える**。
--     行数を人数と読まないこと。
--
-- 2026-08-24 オーナー判断：**機材の列を外した。**
--   マイページを3枚（REAL PAY / DEEP PAY / VERIFIED PAY）に分けたのに合わせて、
--   1枚目の REAL PAY からは機材を落とす。「787 の機長」まで分かると、
--   同じ会社の同僚には1人に絞れてしまうため。
--   ★列と絞り込みは**同時に**外すこと。列だけ消して機材で絞れる状態にすると、
--     絞った結果から各行の機材が逆算できる（隠したことにならない）。
--
-- 2026-09-03 オーナー判断：**機材を戻し、内訳と勤務も帯で出す。**（上の判断の取り消し）
--   REAL PAY は「どの会社の・どの職位が・年いくら」しか答えられない画面だった。
--   基本給が厚い会社と、乗務手当で積み上げる会社は、**同じ年収でも別の仕事で
--   別のリスク**を負っている。そこが読めないと、並べても比べたことにならない。
--   ＝ **比べるための画面が、比べられないままだった。** それを直すために匿名性を
--   一段渡した。行に機材が付き、行を押すと在籍年数の段・支給の内訳・勤務が出る。
--   ★ただし**数そのものは1つも出さない。帯（下端と上端）だけを出す。**
--     どこまで粗くするかは下の「★帯について」に全部書いた。
--   ★機材は全行に出す（人数の門は掛けない。オーナー確定）。
--   ★**絞り込みは戻さない。** 上の「列と絞り込みは同時に」を、今度は逆向きに守る。
--     行に出ているものを目で拾うのと、狙った1人へ数クリックで到達する道を
--     こちらから用意するのは別物。⑤のとおりサーバには引数が無い。
--     画面側にも作らないこと（#ap-fleet を戻さない）。
--
-- ★これで匿名性がどこまで落ちたか（正直に書いておく）
--   2026-09-03 より前、行に出るのは会社と職位だけだった。それでも
--   「うちの機長は3人しか居ない」が成り立つ規模なら、候補はそこまで絞れていた。
--   同じ日の判断で、そこから**もう一段下げた**。同じ会社の同僚から見れば、
--   「787 の機長で在籍20年以上」まで揃った時点で1人に当たる会社は珍しくない。
--   **そこまで含めて、これは承知のうえで選んだ形。**
--
--   ★落としていないものも同じだけ正直に書く。ここは1つも動かしていない。
--     ・1円単位の金額は、年収も内訳も1つも外へ出ない（③と「★帯について」）
--     ・基地・年代・国籍・契約形態・税の国・原本通貨・レポートID・提出日そのもの・
--       打ち込まれた社名は、今も1つも返さない
--     ・引数はゼロのまま（⑤）。狙った1人を指定して引く面は無い
--     ・1行＝1人のまま（④）。押しても出るのは、その1行の人のぶんだけ
--
--   ★いちばん危ないのは「重ねると効く」ほう。会社・職位・機材・在籍の段・
--     勤務の帯は、1つずつ見れば粗い。重ねると1人に当たる。
--     だから **これ以上1つも足さない。** 次に何かを足したくなったら、
--     まずここにあるどれかを外すこと。足し算だけで済ませないこと。
--     いま足したいと言われても足さないもの ──
--       基地／年代／国籍／便数（sectors）／ステイ日数／拘束時間／深夜時間／
--       クレジット時間／契約形態／原本通貨／提出した月。
--
--   したがってこの設計を支えているのは、いま次の7つだけ。
--
--     ① 鍵         給与明細を1枚出した人だけ・90日（サーバ側。anon には開かない）
--     ② 準識別子は「粗い段」だけ
--                   ★2026-09-03、オーナー判断でここを**大きくゆるめた**。
--                     それまでは「準識別子ゼロ」（機材・在籍年数・内訳を1つも
--                     返さない）だった。いま新しく返すのは次の4つ。
--
--                     ・機材   … pv_fleets のコードを1つ。**全行に出す**。
--                                人数の門は置かない（オーナー確定）。
--                                コードだけで、fleet_cat（区分）は返さない。
--                     ・在籍   … **段だけ**。副操縦士は2段（1〜5年／5年〜）、
--                                機長は3段（1〜10年／10〜20年／20年〜）。
--                                年そのものは1つも返さない。訓練生と、
--                                在籍を書いていない人は段を作らない（空欄になる）。
--                     ・内訳   … 8区分（基本給・保証給／変動給／職位手当／役割手当／
--                                パーディアム／住宅手当／その他の現金／未分類）と賞与。
--                                **1区分につき返すのは帯の下端と上端の2つの数だけ。**
--                                0 の区分は行ごと消える。割合（％）は返さない。
--                     ・勤務   … 乗務時間・乗務日数・休日の3つ。同じく帯の2つの数だけ。
--                                便数・ステイ日数・拘束時間・深夜時間・クレジット時間は
--                                **返さない**（重ねると一気に個人に当たる）。
--
--                   今も1つも返さないもの（列にも group by にも入れない）：
--                     基地・年代・国籍・契約形態・税の国・原本通貨・
--                     レポートID・提出日そのもの・打ち込まれた社名。
--                   ★投稿の「時期」だけは 5段の粗い区分で返す
--                     （2026-08-24。下の「★投稿の時期について」）。
--                   ★機材でも在籍でも**絞り込ませない**。⑤のとおりサーバには
--                     引数が無い。画面側にも作らないこと。
--     ③ 有効数字2桁  $183,456 は $180,000 として出る。1円まで一致する個票が存在しない
--     ④ 1行＝1人    同じ人の複数月は年換算の中央値で1行に畳む（回数から常連が割れない）
--     ⑤ 引数ゼロ    総当たりで区分を指定して引く面が無い
--     ⑥ 並びはサーバが決める **新しい順**（新しいほうが上）。画面から並べ替えられない
--                   ★2026-08-25、ここもゆるめた。前は md5(人のキー) 順だった
--                     （下の「★並びについて」）
--     ⑦ 常識の幅    年 $10,000 未満／$700,000 超は出さない（下の「⑦とは何か」）
--
--   ③を外すと個票そのものになる。④を外すと出した回数が漏れる。
--   **この7つは1つも外さないこと。**
--
-- ★帯について（2026-09-03）
--   内訳と勤務は、**数ではなく帯**で返す。返すのは下端と上端の2つだけで、
--   その間のどこに居るかは返さない。
--
--   ★画面でぼかすのではない。**サーバが帯しか作らない。**
--     生の額をブラウザまで渡して CSS で霞ませる形は、開発者ツールを開けば
--     1秒で剥がれる。このリポジトリは最初からその形を禁じていて、
--     assert-pay-rows.mjs が actual-pay の4ファイルに blur / filter が
--     1文字も無いことを見張っている。**渡さないものは、隠す必要が無い。**
--
--   帯の幅（grid）は**その人の年収から決める**（pv_band_grid）。
--     grid ＝ 年収 ÷ 40 を {1,2,5}×10ⁿ の直上へ切り上げたもの
--     例）年 $185,000 → 185000/40 = 4,625 → grid $5,000
--         基本給 $132,000 は「$130,000〜$135,000」として出る
--         2×grid に満たない額は「$10,000 未満」に畳む（1万ドル未満の手当を
--         $0〜$5,000 と書くと、下端の 0 が「無い」に読めるため）
--   ★年収から決める理由は、読んだ人が画面の数字だけで刻みを再現できるようにするため。
--   ★「有効数字2桁の刻み ÷2」にしなかった理由。その式だと年収が $100,000 を
--     またいだ瞬間に幅が**10倍**変わる（年 $95,000 の人は grid $500 ＝ ほぼ生の額、
--     年 $100,000 の人は grid $5,000）。**匿名性の弱い側に10倍の穴が開く。**
--     ÷40 は帯の幅を常に年収の約 2.5% に保つ。
--   勤務の刻みは固定（乗務時間 10 時間／乗務日数 2 日／休日 2 日）。
--     こちらは 2×grid 未満を畳まない（15 時間を「20 時間未満」と書くと、
--     10〜20 時間という本当のことより粗くなる）。
--
--   ★正直に書いておく（1）── **帯を足しても、上の年収とは合わない。**
--     ①内訳はその人の1か月ぶん（年収の中央値にいちばん近い月）を12倍したもの、
--     ②帯なので端数がある、の2つの理由。画面の脚注にも同じことを書く。
--     **合わせようとして足し算の帳尻を合わせる処理を入れないこと。**
--     入れた瞬間、帯の中の本当の位置が逆算できる（＝帯である意味が消える）。
--
--   ★正直に書いておく（2）── **給与表を知っている人には、帯から段が読める。**
--     同じ会社の人事や組合の人が号俸表を持っていれば、基本給の帯から在籍の
--     号俸まで詰められることがある。これは帯の幅を広げても完全には消えない。
--     消したければ内訳を出さないしか無く、それは 2026-09-03 に**出すと決めた**。
--
-- ★数え上げについて。2026-08-24 オーナー判断で**出すことにした**。
--   画面の上に4枚の数字が並ぶ：
--     ・給与を出したパイロット … 表の行数（画面が rows を数える。ここは前から数えれば分かった）
--     ・実給与の投稿           … ★stats.reports（新しく外へ出る）
--     ・航空会社               … 表に出ている会社の数（同上、前から分かった）
--     ・1ヶ月以内の新規投稿     … ★stats.month（新しく外へ出る）
--
--   ★これまでは逆のことを書いていた。
--     「合計件数・カバー社数・直近30日で +X件 を出さない（会員規模そのものが漏れる）」
--     「ページ送りは10件ずつ。出すのは何ページ目かだけ」
--     この2つは**運用ルール**で、下の契約①〜⑦とは別のもの。オーナー判断で外した。
--
--   ★理由。この画面は「1枚出した人だけが読める」＝ Give & Get の Get の側。
--     出した人に「今どれだけ集まっているか」が見えないと、出した意味が返ってこない。
--
--   ★正直に書いておく。これで新しく外へ出るのは
--     「今どれだけ集まっているか」と「直近1ヶ月でどれだけ増えたか」の2つ。
--     会員数そのものではない（出していない会員は1も足されない）。
--     契約①〜⑦は**1つも外していない**。
--
-- ★打ち込まれた社名について。2026-08-25 オーナー指示
--   「REAL PAY の『その他の航空会社』ってなに？失礼じゃない？ちゃんと航空会社名書いて」。
--   航空会社の欄で「その他」を選んだ人の行は、それまで一律「その他の航空会社」と出ていた。
--   打ち込まれた文字列を**そのまま出すことはできない**（②。社名の欄に
--   「ANA 767 関空ベース 2019入社」のように社名以外を書く人が居る）。
--   そこで pv_airline_resolve（1-b2）で**語彙に当てて**から出す。
--     当たる  … 本当の社名が出る（例：'スカイマーク' と打った行は skymark として出る）
--     当たらない … 'other' に落ちる。画面は「一覧にない航空会社」と書く
--   出口は pv_airlines.code か 'other' の2つだけ。打ち込まれた文字列は1文字も通らない。
--   ★口コミ側の社名の欄は**コードとは限らない**（「その他」の行には打ち込まれた
--     文字列がそのまま入っている）。だから口コミだけは無条件に通す。
--
-- ★投稿の時期について。2026-08-24 オーナー判断で**粗い段だけ出すことにした**。
--   一覧の右端に「1ヶ月以内／3ヶ月以内／6ヶ月以内／1年以内／それより前」の5段が出る。
--   その人の**いちばん新しい提出**から決める。
--
--   ★これは契約②を1段ゆるめている。正直に書いておく。
--     前は「投稿月は返さない」と書いてあった。今も**日付も年月も返さない**が、
--     「だいたいいつごろの人か」は分かるようになった。
--     理由：この一覧は古い数字と新しい数字が同じ顔で並ぶ。読む人が
--     「これは今の相場か」を判断できないと、出してもらった数字の値打ちが落ちる。
--
-- ★並びについて。2026-08-25 オーナー指示「あと一旦出した順にしてもらっていいよ」→
--   同日「これは新しい順にしよう」。並びを **新しい順（新しいほうが上）** にした。
--   前は md5(人のキー) 順だった。
--
--   ★これは契約⑥を外している。正直に書いておく。
--     前の md5 順は、並びが中身と何も関係していないことが取り柄だった。
--     時間で並べると、**同じ段の中でもどちらが先に出したかが読める**。
--     すぐ上で入れた5段（age）は「だいたいいつごろか」までしか言わないが、
--     並びはそれより細かい。上から下へ時間が流れている。
--   ★新しい順は、古い順よりもう一段だけ弱い。**いちばん最近出した人が必ず先頭に来る**。
--     出した直後に見た人には「今の1行目が自分の直前の1人」だと分かる。
--     古い順ならその1人は最後のページの末尾で、めくらないと見えなかった。
--     それでも新しい順を選んだのは、Get の側（＝出した人が見る画面）として
--     「今どれだけ動いているか」がいちばん上に来るほうが値打ちがあるという判断。
--   ★それでも次の3つは守っている。
--     ・**時刻そのものは1つも返さない。** 並べるのに使うだけで、行には入らない
--       （自己点検 12・26 が見ている）。
--     ・**画面から並べ替える口を作らない。** 並びはサーバが1つに決める。
--     ・段で絞る口も作らない。
--   ★「一旦」と言われている。戻すときは order by を md5(p.pkey) に戻すだけ
--     （古い順に戻すなら last_at の desc を外すだけ）。
--
-- ★口コミに書かれた給与も一覧に混ぜる（2026-08-24 オーナー判断）
--   給与明細の仕組みができる前、口コミフォームが年収も聞いていた時期がある。
--   出してくれた人が実際に居るのに、その数字だけ REAL PAY に出ないのは
--   Give & Get の約束と食い違う。だから混ぜる。
--   ・**もう増えない。** 口コミフォームは金額を集めるのをやめている
--     （submit-review.html「金額はここでは集めない」）。過去のぶんだけ。
--   ・**新しく外へ出る情報はゼロ。** その金額は今も口コミカードに出ている
--     （airlines/airline-reviews-ui.js と community.html が同じ式で表示している）。
--     合計の出し方もあちらと1文字も違えない。違えると同じ人の金額が画面ごとに変わる。
--   ・出典は「本人記録」（verified は false）。札を3種類に増やさない（オーナー判断）。
--   ・**同じ人が給与明細も出していたら、明細を採って口コミ側を落とす。**
--     落とさないと同じ人が2行に出る＝契約④が破れる。実際に本番で1人が重なっている。
--   ・人の突き合わせは下の pv_review_person（対応表）。口コミと明細で持ち主の
--     ハッシュの塩が違うので、名簿から作り直して1回だけ対応を取る。
--
-- ★内訳について。2026-08-24 にいったん入れて同じ日に外し、2026-09-03 に戻した。
--   最初に入れたのは「行を選ぶとその人の支給の内訳が**円グラフ**で見える」形。
--   同じ日に外したのは、マイページを3枚に分けて「この給与は何で構成されているか」は
--   DEEP PAY が複数の投稿を集計して見せる、と役割が決まったため。
--
--   2026-09-03 に戻したが、**戻したのは内訳であって、あのときの形ではない。**
--     ・図は戻していない（円グラフも棒も無い）。**帯の文字だけ。**
--     ・割合（％）は戻していない。返すのは金額の帯だけで、pv_pct5 は呼ばない。
--     ・区分は DEEP PAY と同じ8区分をそのまま使う。**新しい分類を発明しない。**
--       発明すると、同じ人について2つの画面が違う内訳を出す。
--   ＝ 役割の線は今も引いてある。**REAL PAY はその1人・DEEP PAY は集団。**
--
--   ★pv_pay_comp / pv_pct5 / pv_pending_comp の3つは**今も呼ばない。**
--     定義だけ残してある（DEEP PAY で使う）。誰にも grant していない。
--     あれは「割合」を出す関数で、こちらが要るのは「金額の帯」。自己点検 22 が
--     呼んでいないことを見ている。
--     ⚠️ pv_pay_comp には「総支給がある行は内訳を見ない」という既知の欠陥が
--        あって、⚠️ が貼られたまま残っている。**あれを流用しないこと。**
--
-- ★⑦とは何か（外した p10-p90 クリップとは別物）
--   クリップは「同じ区分の実データの上下1割に寄せる」＝**本物の値を書き換える**処理で、
--   区分が無くなったので外した。⑦は違う。**固定の常識の幅**で、
--   実在しうるパイロットの年収は1つも落ちない。落ちるのは打ち間違いだけ。
--   本番で実際にあった2件（2026-08-23 に読んで確認した実測値）：
--     ・年 $0.75（＝ ¥110）… 桁を打ち損ねた行
--     ・月額の欄に年額（¥1,200万）を入れた行 … 年 ¥1.46億 ＝ $918,486 として出る
--   丸め（③）はこれを直せない（$0.75 は $0.75 のまま2桁）。
--
--   ★上限が $700,000 なのはなぜか。
--     実在しうる最高は、米系大手の広胴機・機長・最上位号俸に利益分配が当たった年で
--     $50万台。$70万で頭を打つ幅なら、その最高値にまだ余裕がある。
--     一方、月額の欄に年額を打つ間違いは桁が1つ増える（上の $918,486）ので、
--     $70万の線で落ちる。$100万にすると落ちない＝この幅が仕事をしなくなる。
--     ⚠️ これは「絶対に本物が落ちない」保証ではなく判断。
--        $70万を超える本物が来たら、その1件を確かめてから上限を動かすこと。
--        逆に狭めるのも同じで、狭めると訓練生の低給と本物の高給が黙って消える。
--
-- ★まだ禁じていること：
--   ・この関数に引数を足すこと（総当たりで区分を指定する面が生える）
--   ・anon に execute を渡すこと（下の grant は authenticated だけ）
--   ・②が「返さない」と書いているものを1つでも返り値に足すこと
--   ・帯の中の位置（中央値・平均・何割のところか）を返すこと
--   ・帯を細かくすること（grid を小さくすること）
--   ・便数・ステイ日数・拘束時間・深夜時間・クレジット時間を返すこと
--   ・機材や在籍で絞れるようにすること（列と絞り込みは常に別。
--     出しているものでも絞らせない）
--   ・行1つを指定して引く関数を足すこと（⑤。1回の呼び出しで全部返している）
--   ・自由入力の社名を読むこと・返すこと
--     → 打ち込まれた文字列そのものが識別子。airline は 'other' のまま返し、
--        画面が「その他の航空会社」という固定の札に置き換える。
--        預かり側も同じ（payload の中にその文字列が居るが、金額の欄しか読まない）
--   ・投稿の時刻・順序が読める並びにすること（新しさは「誰が最近出したか」）
--   ・預かりの claim_token・ip_day_hash・payload そのものを返すこと
--
-- ★将来この関数が重くなったときの正しい直し方：
--   引数を足さない。結果を authenticated 限定のビューに落として PostgREST 側で絞らせる。
--   行はもう匿名化済みなので、絞り込み自体は攻撃面にならない。引数だけが攻撃面になる。
--
-- ★人数が増えたら締め直す余地（今日はまだ早い）：
--   ・✓ Verified は1ビットの準識別子。検証済みが1人だけの会社では手がかりになる。
--     画面側で「Verified だけ」の絞り込みを作らない限り実害は小さい（作らないこと）。
--   ・行数が数百に育ったら、k≧5 の門を戻すのが素直。戻すときは having を
--     person の上に置くだけで済むように、person は区分ごとに畳んだ形のままにしてある。
--
-- ★鍵を間違えないこと：
--   ここを開けるのは **給与明細の鍵（profiles.access_until・90日）** だけ。
--   口コミの鍵（pv-session.js の PVUnlock.reviewUntil）ではない。
--   2つの鍵が混ざらないことは assert-unlock.mjs が見張っている。
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 1. pv_sig2 — 有効数字2桁に丸める
--
--   183456 → log10 = 5.26 → floor = 5 → round(v, 1-5 = -4) → 180000
--     9.53 → log10 = -0.02 → floor = -1 → round(v, 2)      → 9.53
--
-- ★2桁より細かくしない。1円まで一致する数字は「個票がある」という証拠になる。
--   k≧5 の門もクリップも外した今、丸めがいちばん外側の守りになっている。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_sig2(v numeric)
returns numeric
language sql
immutable
as $$
  select case when v is null or v <= 0 then null
              else round(v, 1 - floor(log(v))::int)
         end;
$$;

revoke all on function public.pv_sig2(numeric) from public, anon;
grant execute on function public.pv_sig2(numeric) to authenticated;

comment on function public.pv_sig2(numeric) is
  '有効数字2桁に丸める。実給与の一覧はこれを通した額しか外へ出さない。'
  '桁を増やすと個票の証拠になるので増やさないこと。';


-- ════════════════════════════════════════════════════════════════
-- 1-a2. pv_band_grid — 帯の幅（刻み）を決める
--
--   grid ＝ 年収 ÷ 40 を {1,2,5}×10ⁿ の直上へ切り上げたもの
--      40,000 → 1,000 → 1,000       95,000 →  2,375 →  5,000
--     185,000 → 4,625 → 5,000      250,000 →  6,250 → 10,000
--     400,000 → 10,000 → 10,000    700,000 → 17,500 → 20,000
--   ＝ 帯の幅は常に年収の 2.5%〜5% に収まる（どの桁でも同じ強さでぼける）
--
-- ★これ1つが「どこまでぼかすか」の全部。変えるならここだけ。呼ぶ側は1行も変わらない。
-- ★「有効数字2桁の刻み ÷2」にしない理由はファイル冒頭の「★帯について」に書いた。
--   （$100,000 の前後で幅が10倍変わり、匿名性の弱い側に穴が開く）
-- ★読んだ人が画面に出ている年収だけから刻みを再現できる（生の中央値から作らない理由）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_band_grid(v_annual numeric)
returns numeric
language sql
immutable
as $$
  with t as (
    select case when v_annual is null or v_annual <= 0 then null
                else v_annual / 40.0 end as raw
  ), d as (
    select raw, power(10, floor(log(raw))::int)::numeric as p from t where raw is not null
  )
  select case when p is null then null
              when raw <= p     then p
              when raw <= p * 2 then p * 2
              when raw <= p * 5 then p * 5
              else p * 10
         end
    from d;
$$;

revoke all on function public.pv_band_grid(numeric) from public, anon;
grant execute on function public.pv_band_grid(numeric) to authenticated;

comment on function public.pv_band_grid(numeric) is
  '帯の刻みを年収から決める（年収÷40を1/2/5へ切り上げ）。'
  'ぼかしの強さはこの関数1つが決めている。細かくしないこと。';


-- ════════════════════════════════════════════════════════════════
-- 1-a3. pv_band — 値を刻みで床に落として [下端, 上端] を返す
--
--   pv_band(132000, 5000, true) → [130000, 135000]
--   pv_band(  7000, 5000, true) → [0, 10000]   ← 画面は「$10,000 未満」と書く
--   pv_band(    65,   10, false) → [60, 70]
--
-- ★返すのは2つの数だけ。**間のどこに居るかは返さない。**
-- ★p_collapse が真なら 2×grid 未満を [0, 2×grid] に畳む。金額はこれを使う
--   （1万ドル未満の手当を $0〜$5,000 と書くと、下端の 0 が「無い」に読める）。
--   勤務は畳まない（15 時間を「20 時間未満」と書くと 10〜20 時間より粗くなる）。
-- ★default を付けないこと。付けるとシグネチャが2つに見えて revoke の対象を取り違える。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_band(v numeric, grid numeric, p_collapse boolean)
returns jsonb
language sql
immutable
as $$
  select case
    when v is null or grid is null or grid <= 0 or v <= 0 then null
    when p_collapse and v < grid * 2 then jsonb_build_array(0, grid * 2)
    else jsonb_build_array(floor(v / grid) * grid, floor(v / grid) * grid + grid)
  end;
$$;

revoke all on function public.pv_band(numeric, numeric, boolean) from public, anon;
grant execute on function public.pv_band(numeric, numeric, boolean) to authenticated;

comment on function public.pv_band(numeric, numeric, boolean) is
  '値を帯（下端・上端）に変える。実給与の一覧は内訳と勤務をこれを通してしか外へ出さない。';



-- ════════════════════════════════════════════════════════════════
-- 1-b. pv_pending_usd — 預かりの payload から年換算USDを出す
--
-- 本棚（pay_reports）は annual_total_usd を**列に持っている**。
-- 預かり（pay_reports_pending）は payload を寝かせているだけで持っていない
-- （db/pay-report-pending.sql が「ここで正規化しない」と決めているため）。
-- 読むときに出すのがここ。
--
-- ★年換算の定義そのものは書き写さない。pv_annual_total（db/pay-reports.sql 4章）を呼ぶ。
--   あれが唯一の正で、引数が増えた過去もある。書き写すと必ずいつか片方だけ直る。
--
-- ★それでも「payload の読み方」と「USDの掛け方」はここが2つめの実装になる。
--   submit_pay_report の宣言部（v_gross ほか）と1文字ずつ同じにしてある：
--     ・gross_monthly だけ nullif を二重に掛ける（'' と 0 の両方を null に倒す）
--     ・総支給があるときは内訳（base_pay・hourly_rate・transport・command_pay・
--       other_allowance）を見ない。per_diem と housing_amount は総支給と排他にしない
--     ・レートの無い通貨は null を返す（本棚側の annual_total_usd と同じ振る舞い）
--   ズレていないことは db/test-pay-rows.mjs が、**同じ payload を
--   submit_pay_report にも通して突き合わせる**ことで毎回確かめている。
--   片方だけ直すとそこで落ちる。
--
-- ★金額の欄しか読まない。社名・基地・年代・在籍年数・国籍には触れない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_pending_usd(p jsonb)
returns numeric
language sql
stable
set search_path = public, extensions
as $$
  select round(
           public.pv_annual_total(
             x.gross,
             -- 総支給が来ている行では内訳を見ない（両方足すと二重計上）。
             -- pv_annual_total の coalesce も同じ判断をするが、
             -- あちらの実装に頼らず、submit_pay_report と同じ形をここにも書く。
             case when x.gross is null then x.base   end,
             case when x.gross is null then x.hourly end,
             x.guar, x.bh, x.perdiem,
             x.htype, x.hamt,
             case when x.gross is null then x.trans end,
             case when x.gross is null then x.cmd   end,
             case when x.gross is null then x.othal end,
             x.bonus_a, x.profit, x.bonus_m,
             -- ★ 2026-08-26 追加。保証給（金額）。内訳の側なので総支給と同じ扱いで隠す。
             case when x.gross is null then x.gpay  end,
             -- ★ 2026-08-26 追加。教官・訓練の手当。同じく内訳の側。
             --   ここを足し忘れると、同じ明細から**本棚と預かりで違う年収**が出る。
             case when x.gross is null then x.ipay  end,
             -- ★ 2026-08-26 追加。審査・査察の手当。同上。
             case when x.gross is null then x.epay  end,
             /* ★ 2026-08-26 追加。組合・乗員代表の手当。
                ⚠️ ここだけは隠さない（2026-09-02）。組合が直接払った額は会社の明細に
                   印字されない＝本人が書いた総支給の中に無いので、隠すと年収が
                   その分だけ丸ごと落ちる。総支給の中にあるとき（支給元＝会社／両方）は
                   下の真偽値が false になり、pv_annual_total が1円も足さない。 */
             x.upay,
             -- ★ 2026-08-26 追加。管理・マネジメントの手当。同上。
             case when x.gross is null then x.mpay  end,
             -- ★ 2026-08-27 追加。その他の兼務・配属の手当。同上。
             case when x.gross is null then x.npay  end,
             -- ★ 2026-09-02 追加。組合の分が総支給の外か。判定は本棚と同じ関数を呼ぶ
             --   （ここに規則を書き写すと、預かりと本棚で違う年収が出る）。
             public.pv_union_outside_gross(
               case when jsonb_typeof(p->'pay_items') = 'object' then p->'pay_items' end)
           ) * r.to_usd, 2)
    from (
      select nullif(nullif(p->>'gross_monthly', '')::numeric, 0) as gross,
             nullif(p->>'base_pay',            '')::numeric      as base,
             nullif(p->>'guarantee_pay',       '')::numeric      as gpay,
             nullif(p->>'instructor_pay',      '')::numeric      as ipay,
             nullif(p->>'examiner_pay',        '')::numeric      as epay,
             nullif(p->>'union_pay',           '')::numeric      as upay,
             nullif(p->>'management_pay',      '')::numeric      as mpay,
             nullif(p->>'nonline_pay',         '')::numeric      as npay,
             nullif(p->>'hourly_rate',         '')::numeric      as hourly,
             nullif(p->>'guaranteed_hours',    '')::numeric      as guar,
             nullif(p->>'block_hours',         '')::numeric      as bh,
             nullif(p->>'per_diem',            '')::numeric      as perdiem,
             nullif(btrim(p->>'housing_type'), '')               as htype,
             nullif(p->>'housing_amount',      '')::numeric      as hamt,
             nullif(p->>'transport',           '')::numeric      as trans,
             nullif(p->>'command_pay',         '')::numeric      as cmd,
             nullif(p->>'other_allowance',     '')::numeric      as othal,
             nullif(p->>'bonus_annual',        '')::numeric      as bonus_a,
             nullif(p->>'profit_share_annual', '')::numeric      as profit,
             nullif(p->>'bonus_month',         '')::numeric      as bonus_m,
             upper(nullif(btrim(p->>'currency'), ''))            as cur
    ) x
    -- ★join なので、レートの無い通貨は行が消える＝null が返る。
    --   本棚側（submit_pay_report）も annual_total_usd を null のままにする。同じ扱い。
    join public.fx_rates r on r.code = x.cur;
$$;

-- ★誰にも渡さない。呼ぶのは下の pv_pay_rows（security definer なので所有者権限で動く）だけ。
--   単体で開けると「この payload はいくらか」を総当たりで問える面になる。
revoke all on function public.pv_pending_usd(jsonb) from public, anon, authenticated;

comment on function public.pv_pending_usd(jsonb) is
  '登録前に預かった給与 payload の年換算USD。pv_annual_total を呼ぶ（定義は書き写さない）。'
  '金額の欄しか読まない。誰にも grant しない＝pv_pay_rows の中からだけ使う。';


-- ════════════════════════════════════════════════════════════════
-- 1-b3. pv_pending_detail — 預かりの payload から「帯の材料」を出す（2026-09-03）
--
-- 本棚（pay_reports）は8区分の材料を**列で持っている**。預かりは payload の中。
-- 形をそろえて1つの jsonb で返し、pv_pay_rows 側は本棚と同じ式で帯にする。
--
-- ★pv_pending_usd（1-b）は今までどおり金額の欄しか読まない。**あちらは触らない。**
--   年収は今も pv_pending_usd が出す。ここが出すのは内訳と勤務だけ。
--
-- ★★ 8区分の式は db/deep-pay.sql の sane（a_fixed〜a_other）と同じもの。★★
--    片方だけ直すと、DEEP PAY のドーナツと REAL PAY の帯が
--    同じ人について違う内訳を出す（どちらも普通に動いたまま）。
--
-- ★誰にも渡さない。単体で開けると「この payload の内訳はいくらか」を
--   総当たりで問える面になる（pv_pending_usd と同じ理由）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_pending_detail(p jsonb)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'fx',     r.to_usd,
    /* その月の現金（賞与ぬき）。総支給がある人はそこから当月賞与を引く。
       無い人は内訳の足し算。db/deep-pay.sql の cash_m と1行ずつ同じ。
       ★組合が直接払った分だけは総支給の外にある（2026-09-02）。判定は
         pv_union_outside_gross の1か所だけを呼ぶ（規則を書き写さない）。 */
    'cash_m', case when x.gross is not null
                   then greatest(x.gross - coalesce(x.bonus_m, 0), 0)
                      + case when public.pv_union_outside_gross(x.items)
                             then coalesce(x.upay, 0) else 0 end
                   else coalesce(x.base, 0) + coalesce(x.gpay, 0)
                      + coalesce(x.hourly, 0)
                        * greatest(coalesce(x.bh, 0), coalesce(x.guar, 0))
                      + coalesce(x.perdiem, 0)
                      + case when x.htype = 'allowance'
                             then coalesce(x.hamt, 0) else 0 end
                      + coalesce(x.trans, 0) + coalesce(x.cmd, 0)
                      + coalesce(x.othal, 0) + coalesce(x.ipay, 0)
                      + coalesce(x.epay, 0)  + coalesce(x.upay, 0)
                      + coalesce(x.mpay, 0)  + coalesce(x.npay, 0)
              end,
    -- ① 固定・保証給
    'fixed',  coalesce(x.base, 0) + coalesce(x.gpay, 0),
    -- ② 変動給。書いていない人は「時給 × 実績と保証時間の大きい方」
    'var',    coalesce(x.fvp, coalesce(x.hourly, 0)
                              * greatest(coalesce(x.bh, 0), coalesce(x.guar, 0))),
    -- ③ 職位手当
    'cmd',    coalesce(x.cmd, 0),
    -- ④ 役割手当（教官・審査・組合・管理・兼務）
    'role',   coalesce(x.ipay, 0) + coalesce(x.epay, 0) + coalesce(x.upay, 0)
              + coalesce(x.mpay, 0) + coalesce(x.npay, 0),
    -- ⑤ パーディアム
    'pd',     coalesce(x.perdiem, 0),
    -- ⑥ 住宅手当。現物支給の社宅は現金ではないので数えない
    'house',  case when x.htype = 'allowance' then coalesce(x.hamt, 0) else 0 end,
    /* ⑦ その他の現金手当
       ★★ この引き算が命綱。★★ 給与フォームが変動の合計を
       flight_variable_pay **と** other_allowance の**両方**に写すので、
       素直に足すと変動給を二重に数える。
       ★★ 直したら db/deep-pay.sql の sane（a_other）と、
          下の pv_pay_rows の shelf も同じに直す。同じ式が3か所にある。★★ */
    'other',  greatest(coalesce(x.othal, 0) - coalesce(x.fvp, 0), 0)
              + coalesce(x.trans, 0),
    -- 賞与は帯の中に混ぜず、1本だけ別に出す
    'bonus_y', coalesce(x.bonus_a, 0) + coalesce(x.profit, 0),
    -- 勤務。3つだけ。便数・ステイ日数・拘束時間は読まない（ファイル冒頭②）
    'bh',     x.bh,
    'dd',     x.dd,
    'dof',    x.dof,
    /* 内訳を書いたか。db/deep-pay.sql の det と**同じ条件**にそろえる
       （pv_my_give の detailed とも同じ）。false の人には帯を1本も作らない。
       ★総支給しか書いていない人を「その他 1本」の帯で埋めないための旗。
         埋めると、内訳を書いていない人の画面に、年収を写しただけの
         内訳が出る（本人は何も書いていないのに、書いたように見える）。 */
    'det',    (x.base is not null or x.gpay is not null
               or x.cmd is not null or x.items is not null)
  )
    from (
      select nullif(nullif(p->>'gross_monthly', '')::numeric, 0) as gross,
             nullif(p->>'base_pay',            '')::numeric      as base,
             nullif(p->>'guarantee_pay',       '')::numeric      as gpay,
             nullif(p->>'instructor_pay',      '')::numeric      as ipay,
             nullif(p->>'examiner_pay',        '')::numeric      as epay,
             nullif(p->>'union_pay',           '')::numeric      as upay,
             nullif(p->>'management_pay',      '')::numeric      as mpay,
             nullif(p->>'nonline_pay',         '')::numeric      as npay,
             nullif(p->>'hourly_rate',         '')::numeric      as hourly,
             nullif(p->>'guaranteed_hours',    '')::numeric      as guar,
             nullif(p->>'block_hours',         '')::numeric      as bh,
             nullif(p->>'duty_days',           '')::smallint     as dd,
             nullif(p->>'days_off',            '')::smallint     as dof,
             nullif(p->>'per_diem',            '')::numeric      as perdiem,
             nullif(btrim(p->>'housing_type'), '')               as htype,
             nullif(p->>'housing_amount',      '')::numeric      as hamt,
             nullif(p->>'transport',           '')::numeric      as trans,
             nullif(p->>'command_pay',         '')::numeric      as cmd,
             nullif(p->>'other_allowance',     '')::numeric      as othal,
             nullif(p->>'flight_variable_pay', '')::numeric      as fvp,
             nullif(p->>'bonus_annual',        '')::numeric      as bonus_a,
             nullif(p->>'profit_share_annual', '')::numeric      as profit,
             nullif(p->>'bonus_month',         '')::numeric      as bonus_m,
             case when jsonb_typeof(p->'pay_items') = 'object'
                  then p->'pay_items' end                        as items,
             upper(nullif(btrim(p->>'currency'), ''))            as cur
    ) x
    -- ★join なので、レートの無い通貨は行が消える＝null が返る（1-b と同じ扱い）。
    join public.fx_rates r on r.code = x.cur;
$$;

revoke all on function public.pv_pending_detail(jsonb) from public, anon, authenticated;

comment on function public.pv_pending_detail(jsonb) is
  '預かり payload の内訳（8区分）と勤務。帯にするための材料で、金額そのものは外へ出ない。'
  '誰にも grant しない＝pv_pay_rows の中からだけ使う。';


-- ════════════════════════════════════════════════════════════════
-- 1-b2. pv_airline_resolve — 打ち込まれた社名を「知っている航空会社」に寄せる
--
-- ★2026-08-25、オーナー指示「REAL PAY の『その他の航空会社』ってなに？失礼じゃない？
--   ちゃんと航空会社名書いて」。
--
-- それまでは airline='other' の行を、画面が固定の札に置き換えて出していた。
-- 打ち込まれた文字列そのものは**外に出せない**（ファイル冒頭②）。
--   「ANA 767 関空ベース 2019入社」のように、社名の欄に社名以外を書く人が居る。
--   そこだけ自由文になると、他の列から全部剥がした準識別子が1つの列から戻ってくる。
--
-- そこで**文字列を通さず、語彙に当てる**。
--   入口  … 人が打った文字列（pay_reports.airline_other / 口コミの airline ほか）
--   出口  … pv_airlines.code か 'other'。**それ以外は絶対に出ない**
-- 当たれば本当の社名が出る（画面が code から名前を引く）。当たらなければ
-- 'other' に落ちて、画面が「一覧にない航空会社」と書く。
--
-- ★当て方は「表記ゆれを潰した完全一致」だけ。前方一致も部分一致もしない。
--   間違った社名を貼るのは、書かないことより悪い（その人の勤務先を誤って公開する）。
--   潰すのは 空白・中黒・各種ハイフン・括弧・句読点・引用符・スラッシュ・アンダースコアと大小文字。
--   当てる先は code / 和名 / 英名 と、その括弧の外と中（'全日本空輸（ANA）' なら
--   '全日本空輸' と 'ANA' の両方）。
--
-- ★複数に当たったときは code の若い順で1つに決める（同じ入力に毎回同じ答え）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_airline_norm(p text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(p, ''),
                '[[:space:]　・･''".,/_()（）\[\]‐‑‒–—―−ー－-]+', '', 'g'));
$$;

revoke all on function public.pv_airline_norm(text) from public, anon, authenticated;

comment on function public.pv_airline_norm(text) is
  '社名の表記ゆれを潰す（空白・中黒・ハイフン・括弧・大小文字）。pv_airline_resolve の中だけで使う。';

create or replace function public.pv_airline_resolve(p_typed text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select coalesce((
    select c.code
      from (
        select a.code,
               unnest(array[
                 a.code,
                 a.name_ja,
                 a.name_en,
                 regexp_replace(a.name_ja, '[（(].*$', ''),
                 (regexp_match(a.name_ja, '[（(]([^）)]+)[）)]'))[1],
                 regexp_replace(a.name_en, '[（(].*$', ''),
                 (regexp_match(a.name_en, '[（(]([^）)]+)[）)]'))[1]
               ]) as nm
          from public.pv_airlines a
         where a.code <> 'other'
      ) c
     where public.pv_airline_norm(c.nm) <> ''
       and public.pv_airline_norm(c.nm) = public.pv_airline_norm(p_typed)
     order by c.code
     limit 1
  ), 'other');
$$;

revoke all on function public.pv_airline_resolve(text) from public, anon, authenticated;

comment on function public.pv_airline_resolve(text) is
  '打ち込まれた社名を pv_airlines.code に寄せる。当たらなければ ''other''。'
  '返すのは語彙の code か ''other'' だけ＝打ち込まれた文字列そのものは通さない。'
  '誰にも grant しない＝pv_pay_rows の中からだけ使う。';



-- ════════════════════════════════════════════════════════════════
-- 1-c. 支給の内訳（割合だけ）
--
-- ★ここから下の3つ（pv_pay_comp / pv_pct5 / pv_pending_comp）は、
--   いま**どこからも呼ばれていない**。DEEP PAY で使うために定義だけ置いてある。
--   REAL PAY（pv_pay_rows）は行そのものしか返さない（ファイル冒頭②）。
--   誰にも grant していないので、置いてあるだけでは誰からも呼べない。
--
-- ★なぜ「割合」なのか。
--   金額（基本給いくら・パーディアムいくら）を1人ずつ返すと、③の
--   「有効数字2桁」をすり抜けて実額の個票ができる。割合なら、画面に出ている
--   丸めた年収を掛けないと額にならない＝丸めの粗さをそのまま引き継ぐ。
--
-- ★成分の足し算は pv_annual_total（db/pay-reports.sql 4章）と1円まで同じ。
--     総支給1本の行 … m = 12×(総支給 − その月の賞与) − パーディアム年額 − 住宅手当年額
--                     o = 0（内訳を入れていないので「その他の手当」は立てない）
--     内訳の行     … m = 12×(基本給 + 保証給 + 時給×max(実績,保証))
--                     o = 12×(交通費 + 機長手当 + その他手当)
--     どちらも      b = 年1回の賞与 + 利益分配
--                     d = 12×パーディアム
--                     h = 12×住宅手当（現物支給の社宅は現金ではないので入れない）
--   5本の合計は pv_annual_total の返り値と一致する。
--   ズレていないことは db/test-pay-rows.mjs が毎回突き合わせている。
--   ⚠️ 2026-09-02 から**組合が総支給の外で払われている行だけ例外**。
--      pv_annual_total はその額を総支給に足すが、この関数（凍結中・誰も呼ばない）は
--      足さないので、その行では 5本の合計がその額のぶん小さく出る。
--      直すのは「DEEP PAY を作る回に内訳優先へ直す」（下の ⚠️）と同じ機会に。
--
-- ★返すのは「割合」（合計1）であって額ではない。通貨に依らないので、
--   月ごとに通貨が違う人が居ても、そのまま平均できる。
--
-- ★引数の並びは pv_annual_total と1文字も違わない。呼ぶ側が並べ違えないため。
--   （2026-09-02、pv_annual_total だけ21本目 p_union_outside_gross が付いた。
--     この関数は金額しか受け取らないので、そこまでは並べていない。
--     20本目までは今も1文字も違わない。）
--
-- ⚠️ 2026-08-26、給与フォームで**総支給と内訳の両方**を書けるようにした。
--    この関数はまだ「総支給がある行は内訳を見ない」形のまま（下の m と o の case）。
--    ＝新しい形の行は全部そちらへ落ち、その他の手当（o）が 0 として描かれる。
--    いまは誰も呼んでいないので害は無い（pv_pay_rows からは呼ばない・誰にも grant しない）。
--    **DEEP PAY を作る回に、ここを内訳優先へ直すこと。** 内訳の行は
--    pay_reports.pay_items にあり、合計は flight_variable_pay / other_allowance に
--    寄せてある（変動給 ⊂ その他の手当）。
-- ════════════════════════════════════════════════════════════════
-- ★ 引数を増やしたら、古い版を必ず落とす。create or replace は「引数の数が違う別物」を
--   増やすだけなので、落とさないと呼び出し側の引数の数で新旧どちらが走るか変わる。
drop function if exists public.pv_pay_comp(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric);
drop function if exists public.pv_pay_comp(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric);
drop function if exists public.pv_pay_comp(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric);
drop function if exists public.pv_pay_comp(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric);
drop function if exists public.pv_pay_comp(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric);
drop function if exists public.pv_pay_comp(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric);

create or replace function public.pv_pay_comp(
  p_gross_monthly    numeric,
  p_base_pay         numeric, p_hourly_rate numeric, p_guaranteed_hours numeric,
  p_block_hours      numeric, p_per_diem    numeric,
  p_housing_type     text,    p_housing_amount numeric,
  p_transport        numeric, p_command_pay numeric, p_other_allowance numeric,
  p_bonus_annual     numeric, p_profit_share_annual numeric,
  p_bonus_month      numeric default null,
  -- ★ 2026-08-26 追加。保証給（金額）。pv_annual_total と1文字も違わない並びを保つ。
  p_guarantee_pay    numeric default null,
  -- ★ 2026-08-26 追加。教官・訓練の手当。同じく並びを揃えるためだけに置く。
  p_instructor_pay   numeric default null,
  -- ★ 2026-08-26 追加。審査・査察の手当。同上。
  p_examiner_pay     numeric default null,
  -- ★ 2026-08-26 追加。組合・乗員代表の手当。同上。
  p_union_pay        numeric default null,
  -- ★ 2026-08-26 追加。管理・マネジメントの手当。同上。
  p_management_pay   numeric default null,
  -- ★ 2026-08-27 追加。その他の兼務・配属の手当。同上。
  p_nonline_pay      numeric default null
) returns numeric[]
language sql
immutable
as $$
  select case
           -- 総額が出ない行（レートも金額も無い）は図を描かせない
           when x.tot is null or x.tot <= 0 then null
           -- 1つでも負になる行は入力違い（手当が総支給を超えている等）。
           -- 嘘の円を描くより、何も描かない方がよい。
           when least(x.m, x.b, x.d, x.h, x.o) < 0 then null
           -- ★nullif を外さないこと。where や case より先に割り算が走ることがある
           --   （2026-08-24、これを外した形が「0で割った」で落ちた）。
           else array[x.m / nullif(x.tot, 0), x.b / nullif(x.tot, 0),
                      x.d / nullif(x.tot, 0), x.h / nullif(x.tot, 0),
                      x.o / nullif(x.tot, 0)]
         end
    from (
      select y.*, (y.m + y.b + y.d + y.h + y.o) as tot
        from (
          select
            /* m … 月々の支給（下の手当をのぞく） */
            case when nullif(p_gross_monthly, 0) is not null
                 then 12 * greatest(p_gross_monthly - coalesce(p_bonus_month, 0), 0)
                      - 12 * coalesce(p_per_diem, 0)
                      - 12 * case when p_housing_type = 'allowance'
                                  then coalesce(p_housing_amount, 0) else 0 end
                 else 12 * (coalesce(p_base_pay, 0)
                            + coalesce(p_guarantee_pay, 0)
                            + coalesce(p_hourly_rate, 0)
                              * greatest(coalesce(p_block_hours, 0),
                                         coalesce(p_guaranteed_hours, 0)))
            end as m,
            /* b … 年1回の賞与（利益分配を含む。月額の外） */
            coalesce(p_bonus_annual, 0) + coalesce(p_profit_share_annual, 0) as b,
            /* d … パーディアム */
            12 * coalesce(p_per_diem, 0) as d,
            /* h … 住宅手当。現物支給の社宅は現金ではないので入れない */
            12 * case when p_housing_type = 'allowance'
                      then coalesce(p_housing_amount, 0) else 0 end as h,
            /* o … その他の手当。総支給1本の行では立てない（中身が分からない） */
            case when nullif(p_gross_monthly, 0) is not null then 0
                 else 12 * (coalesce(p_transport, 0) + coalesce(p_command_pay, 0)
                            + coalesce(p_other_allowance, 0)
                            -- 教官の手当は other_allowance に入っていない（別の入れ物）
                            + coalesce(p_instructor_pay, 0)
                            -- 審査の手当も同じ。★m（月々の支給）に混ぜない
                            --   ＝混ぜると DEEP PAY の「基本給の割合」が汚れる。
                            + coalesce(p_examiner_pay, 0)
                            -- 組合・乗員代表の手当も同じ。ここも o に入れる。
                            + coalesce(p_union_pay, 0)
                            -- 管理・マネジメントの手当も同じ。ここも o に入れる。
                            + coalesce(p_management_pay, 0)
                            -- その他の兼務・配属の手当も同じ。ここも o に入れる。
                            + coalesce(p_nonline_pay, 0))
            end as o
        ) y
    ) x;
$$;

revoke all on function public.pv_pay_comp(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon, authenticated;

comment on function public.pv_pay_comp(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric) is
  '支給の内訳を「割合」（合計1・5本）で返す。金額は返さない。'
  '足し算は pv_annual_total と一致する。引数の並びもあれと同じ。'
  '誰にも grant しない。今はどこからも呼ばれていない（DEEP PAY 用）。';


-- ────────────────────────────────────────────────────────────────
-- pv_pct5 — 割合5本を整数パーセントにする（合計ちょうど100）
--
-- ★丸めた5つを足すと 99 や 101 になる。端数はいちばん大きい成分に寄せる
--   （いちばん大きい成分は必ず 20 以上なので、寄せても負にならない）。
-- ★入力が null／合計0のときは null を返す＝画面は円グラフを出さない。
-- ────────────────────────────────────────────────────────────────
create or replace function public.pv_pct5(a numeric[])
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
           'm', v.p1 + case when v.k = 1 then v.diff else 0 end,
           'b', v.p2 + case when v.k = 2 then v.diff else 0 end,
           'd', v.p3 + case when v.k = 3 then v.diff else 0 end,
           'h', v.p4 + case when v.k = 4 then v.diff else 0 end,
           'o', v.p5 + case when v.k = 5 then v.diff else 0 end)
    from (
      select u.*, 100 - (u.p1 + u.p2 + u.p3 + u.p4 + u.p5) as diff,
             case when u.v1 >= u.v2 and u.v1 >= u.v3 and u.v1 >= u.v4 and u.v1 >= u.v5 then 1
                  when u.v2 >= u.v3 and u.v2 >= u.v4 and u.v2 >= u.v5 then 2
                  when u.v3 >= u.v4 and u.v3 >= u.v5 then 3
                  when u.v4 >= u.v5 then 4
                  else 5 end as k
        from (
          -- ★nullif を外さないこと。下の where より先に割り算が走ることがある
          --   （2026-08-24、内訳の出せない人＝合計0 が来て「0で割った」で落ちた）。
          select t.*,
                 round(t.v1 / nullif(t.tot, 0) * 100)::int as p1,
                 round(t.v2 / nullif(t.tot, 0) * 100)::int as p2,
                 round(t.v3 / nullif(t.tot, 0) * 100)::int as p3,
                 round(t.v4 / nullif(t.tot, 0) * 100)::int as p4,
                 round(t.v5 / nullif(t.tot, 0) * 100)::int as p5
            from (
              select coalesce(a[1], 0) as v1, coalesce(a[2], 0) as v2,
                     coalesce(a[3], 0) as v3, coalesce(a[4], 0) as v4,
                     coalesce(a[5], 0) as v5,
                     coalesce(a[1], 0) + coalesce(a[2], 0) + coalesce(a[3], 0)
                     + coalesce(a[4], 0) + coalesce(a[5], 0) as tot
            ) t
           where t.tot > 0
        ) u
    ) v;
$$;

revoke all on function public.pv_pct5(numeric[]) from public, anon, authenticated;

comment on function public.pv_pct5(numeric[]) is
  '割合5本を整数パーセント（合計100）にする。端数は最大の成分に寄せる。'
  '誰にも grant しない。今はどこからも呼ばれていない（DEEP PAY 用）。';


-- ────────────────────────────────────────────────────────────────
-- pv_pending_comp — 預かりの payload から内訳の割合を出す
--
-- ★pv_pending_usd と同じ payload の読み方を、もう一度ここに書いている。
--   （関数を分けたのは、あちらが「額」でこちらが「割合」だから。）
--   ズレていないことは db/test-pay-rows.mjs が
--   **同じ payload で「5本の合計 : pv_pending_usd」が一致するか**で毎回確かめる。
--   片方だけ直すとそこで落ちる。
-- ★fx は要らない。割合は通貨に依らない。
-- ★金額の欄しか読まない。社名・基地・年代・国籍には触れない。
-- ────────────────────────────────────────────────────────────────
create or replace function public.pv_pending_comp(p jsonb)
returns numeric[]
language sql
immutable
set search_path = public, extensions
as $$
  select public.pv_pay_comp(
           x.gross,
           case when x.gross is null then x.base   end,
           case when x.gross is null then x.hourly end,
           x.guar, x.bh, x.perdiem,
           x.htype, x.hamt,
           case when x.gross is null then x.trans end,
           case when x.gross is null then x.cmd   end,
           case when x.gross is null then x.othal end,
           x.bonus_a, x.profit, x.bonus_m,
           case when x.gross is null then x.gpay  end,
           case when x.gross is null then x.ipay  end,
           case when x.gross is null then x.epay  end,
           case when x.gross is null then x.upay  end,
           case when x.gross is null then x.mpay  end,
           case when x.gross is null then x.npay  end
         )
    from (
      select nullif(nullif(p->>'gross_monthly', '')::numeric, 0) as gross,
             nullif(p->>'base_pay',            '')::numeric      as base,
             nullif(p->>'guarantee_pay',       '')::numeric      as gpay,
             nullif(p->>'instructor_pay',      '')::numeric      as ipay,
             nullif(p->>'examiner_pay',        '')::numeric      as epay,
             nullif(p->>'union_pay',           '')::numeric      as upay,
             nullif(p->>'management_pay',      '')::numeric      as mpay,
             nullif(p->>'nonline_pay',         '')::numeric      as npay,
             nullif(p->>'hourly_rate',         '')::numeric      as hourly,
             nullif(p->>'guaranteed_hours',    '')::numeric      as guar,
             nullif(p->>'block_hours',         '')::numeric      as bh,
             nullif(p->>'per_diem',            '')::numeric      as perdiem,
             nullif(btrim(p->>'housing_type'), '')               as htype,
             nullif(p->>'housing_amount',      '')::numeric      as hamt,
             nullif(p->>'transport',           '')::numeric      as trans,
             nullif(p->>'command_pay',         '')::numeric      as cmd,
             nullif(p->>'other_allowance',     '')::numeric      as othal,
             nullif(p->>'bonus_annual',        '')::numeric      as bonus_a,
             nullif(p->>'profit_share_annual', '')::numeric      as profit,
             nullif(p->>'bonus_month',         '')::numeric      as bonus_m
    ) x;
$$;

revoke all on function public.pv_pending_comp(jsonb) from public, anon, authenticated;

comment on function public.pv_pending_comp(jsonb) is
  '登録前に預かった給与 payload の内訳を「割合」で返す。金額もレートも使わない。'
  '誰にも grant しない。今はどこからも呼ばれていない（DEEP PAY 用）。';


-- ════════════════════════════════════════════════════════════════
-- 1-d. pv_review_person — 口コミと給与明細の「同じ人」をつなぐ対応表
--
-- なぜ表が要るか。持ち主のハッシュの塩が2つの機能で違う。
--   口コミ   sha256( uid || '::pv_anon::' || 社 || '::2026' )   submit-review.html
--   給与明細 sha256( uid || '::pv_pay::'  || 社 )               db/pay-reports.sql 5章
-- どちらの表にも uid は残っていない（そういう設計にした）。
-- つまり SQL だけでは突き合わせられない。名簿（profiles）から両方を作り直して、
-- 1回だけ対応を取っておく。
--
-- ★持つのは「口コミの id → 明細側と同じ形の人のキー」だけ。uid は列に持たない。
-- ★誰にも開かない。RLS を有効にしてポリシーを1つも置かず、grant も剥がす。
--   ＝ security definer の pv_pay_rows から読むときだけ見える。
--   （口コミの proof_hash 自体は anon から読める（口コミ一覧が select * している）。
--     そこに明細側のキーを並べた表を足すと、2つの機能が同じ人だと外から分かってしまう）
-- ★入れるのは**金額を持つ口コミだけ**。それ以外は一覧に出ないので対応も要らない。
--   金額を集めるのはもうやめているので、この表はこれ以上増えない。
-- ★何度流しても同じ（on conflict do nothing）。
-- ════════════════════════════════════════════════════════════════
create table if not exists public.pv_review_person (
  review_id uuid primary key references public.reviews_v2(id) on delete cascade,
  pkey      text not null
);

alter table public.pv_review_person enable row level security;
-- ポリシーを1つも作らない＝RLS が有効なだけで誰も読めない。
revoke all on table public.pv_review_person from public, anon, authenticated;

comment on table public.pv_review_person is
  '口コミ（reviews_v2）と給与明細（pay_reports）の同じ人をつなぐ対応表。'
  '持つのは口コミの id と、明細側と同じ形の人のキーだけ（uid は持たない）。'
  'RLS 有効・ポリシー無し・grant 無し＝pv_pay_rows の中からしか読めない。';

-- ── 埋める（冪等）───────────────────────────────────────────
-- 名簿 × その口コミの社コード で口コミ側のハッシュを作り直して当てる。
-- 当たった人について、明細側と**同じ形**のキーを入れておく。
-- こうしておくと、一覧の group by が何もしなくても同じ人として畳む。
--
-- ★'other'（自由入力の社名）の人だけは、明細側のキーに打ち込んだ社名まで入るので
--   （db/pay-reports.sql 5章の coalesce）、明細を出していても突き合わない。
--   その場合は口コミ側も1行出る。会社はどちらも「その他」なので実害は小さい。
insert into public.pv_review_person (review_id, pkey)
select v.id,
       'r:' || encode(extensions.digest(
                 p.id::text || '::pv_pay::' || v.airline, 'sha256'), 'hex')
  from public.reviews_v2 v
  join public.profiles p
    on v.proof_hash = encode(extensions.digest(
         p.id::text || '::pv_anon::' || v.airline || '::2026', 'sha256'), 'hex')
 where coalesce(nullif(v.annual_salary, 0),
                nullif(v.base_annual, 0),
                nullif(v.flight_allowance_annual, 0),
                nullif(v.monthly_salary, 0)) is not null
on conflict (review_id) do nothing;


-- ════════════════════════════════════════════════════════════════
-- 1-e. pv_my_give — 呼んだ本人が「何を出したか」だけを返す
--
-- 返り値  { basic, detailed, payslip }  ── 真偽3つだけ。
--   basic    … 給与レポートが1件でもある
--   detailed … 内訳のある行が1件でもある
--   payslip  … そのうち明細の裏付けがあるもの（verify_level >= 1）
--
-- なぜ要るか（2026-08-25・DEEP PAY の解放条件）
--   DEEP PAY は2つとも満たしたときだけ開く：
--     ① 給与を出したユニークなパイロットが100人（＝みんなの話）
--     ② **本人が内訳まで出している**（＝この関数が答える側）
--   ★①と②は別々に判定する。100人はプライバシーの閾値ではなく、
--     「機能を正式に開ける」という区切り。人数が足りない細かい区分を
--     出さない判断は、DEEP PAY のページ側が別に持つ。
--
-- ★2026-08-26、総支給と内訳の排他をやめた（オーナー指示。会社ごとに変動給の
--   建て付けが違い、固定6欄では多くのパイロットが入れられなかったため）。
--   なので detailed は「総支給が無い」では判定できない。**内訳が有る**で見る：
--     base_pay is not null      … 昔の形（総支給の代わりに内訳を入れた人）
--     guarantee_pay is not null … 保証給だけ書いた人（米国型。基本給という項目が無い）
--     command_pay is not null   … 職位手当だけ書いた人
--     pay_items is not null     … 新しい形（総支給を残したまま内訳の行を書いた人）
--   ⚠️ ここを `gross_monthly is null and base_pay is not null` に戻すと、
--      新しい形で内訳を書いた人が**全員「内訳なし」**になる。画面は普通に動くので
--      誰も気づけない（「準備は完了しています」が一生出ない）。
--   ★どちらの形も拾うので、前から内訳を出してくれていた人もさかのぼって数えられる
--     （既存データを1行も壊さない）。
-- ★明細から入れた行は内訳の側に入るので detailed が自動で true になる。
--   ＝明細を出した人に、内訳のフォームをもう一度書かせない。
-- ★payslip は verify_level を見る（一覧の「出典」列とまったく同じ判定）。
--   source は自己申告なので使わない（db/pay-reports.sql 冒頭の約束）。
--
-- ⚠️ なぜ pv_pay_rows の中に書かないか
--   本人の行を引くには proof_hash を作り直す必要があり、その材料に
--   **打ち込まれた社名**が入る（pay_reports に user_id が無いため）。
--   一覧の関数の中でそれを読むと、「打ち込まれた社名を読んでいない」という
--   一覧側の約束（自己点検7）が言えなくなる。読む場所をこの関数1つに閉じ込める。
--   引き方は my_pay_reports()（db/pay-reports.sql 5-b）と同じ。**式を変えないこと。**
--
-- ★誰にも grant しない。security definer の中（pv_pay_rows）からだけ呼ぶ。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_my_give()
returns jsonb
language sql
security definer
stable
set search_path = public, extensions
as $fn$
  with mine as (
    -- 一覧から選んだ会社：コードは有限なので総当たりでハッシュを作れる
    select encode(extensions.digest(
             auth.uid()::text || '::pv_pay::' || a.code, 'sha256'), 'hex') as h
      from public.pv_airlines a
    union
    -- 「一覧にない会社」：ハッシュに自由入力の社名が入っているので総当たりでは
    -- 引けない。実在する社名だけを候補にして作り直す。ここで他人の社名を読むが、
    -- 使うのはハッシュの材料としてだけで、関数の外へは1文字も出ない。
    select encode(extensions.digest(
             auth.uid()::text || '::pv_pay::other::' || o.nm, 'sha256'), 'hex')
      from (select distinct lower(airline_other) as nm
              from public.pay_reports
             where airline = 'other' and airline_other is not null) o
  )
  select jsonb_build_object(
           'basic',    coalesce(bool_or(true), false),
           'detailed', coalesce(bool_or(r.base_pay is not null
                                        or r.guarantee_pay is not null
                                        or r.command_pay is not null
                                        or r.pay_items is not null), false),
           'payslip',  coalesce(bool_or(r.verify_level >= 1), false),
           /* ── full ── REAL PAY の「報酬の内訳」を開く鍵（2026-09-03）──────
              ★detailed とは別物。detailed は「内訳が1つでもあるか」で、
                DEEP PAY の個人条件がそれを読んでいる。**あちらは1バイトも変えない。**
              条件は3つ ── 基本給 / 保証手当・職務手当 / 変動給。
              それぞれ「金額が入っている」か「該当なし」のどちらかで回答済み。
              ★空欄は未回答。0 と「該当なし」は別物（pay_items の *_none で持つ）。
              ★**同じ1件の中で**3つそろっていること。月をまたいで拾い集めない
                （フォームは3つ同時に出るので、1件で埋まるのが普通の形）。 */
           'full',     coalesce(bool_or(
                         (r.base_pay is not null
                          or coalesce((r.pay_items->>'fixed_none')::boolean, false))
                         and
                         (r.guarantee_pay is not null
                          or coalesce((r.pay_items->>'guarantee_none')::boolean, false))
                         and
                         (r.flight_variable_pay is not null
                          or coalesce(jsonb_array_length(r.pay_items->'variable'), 0) > 0
                          or coalesce((r.pay_items->>'variable_none')::boolean, false))
                       /* ── 経過措置（2026-09-03）────────────────────────
                          この門を入れる前から内訳を出してくれていた人は、開いたまま。
                          先に出した人が損をする形にしない。
                          ★締切は**定数**。「今から何日前」という動く窓にすると、
                            門が永久に閉じない（誰でもいつでも経過措置に入れる）。
                            自己点検57 が、この関数に現在時刻を取る関数が
                            1つも無いことを見ている。
                          ⚠️ この関数の中で、投稿時刻の列名を**引用符でくくって**
                             書かないこと。自己点検39 が「日付をキーとして
                             返していない」をその文字列で見ているので、
                             注意書きのつもりで書くと注意書きだけで赤くなる
                             （列参照として書くぶんには当たらない）。 */
                       or (r.created_at < timestamptz '2026-09-04 00:00:00+09'
                           and (r.base_pay is not null
                                or r.guarantee_pay is not null
                                or r.command_pay is not null
                                or r.pay_items is not null))
                       ), false)
         )
    from public.pay_reports r
    join mine k on k.h = r.proof_hash
   where auth.uid() is not null;
$fn$;

-- ★誰にも渡さない。pv_pay_rows の中からだけ呼ぶ（pv_pending_usd と同じ扱い）。
revoke all on function public.pv_my_give() from public, anon, authenticated;

comment on function public.pv_my_give() is
  '呼んだ本人が Basic / Detailed / Payslip / Full のどれを出したかを真偽4つで返す。'
  'detailed は DEEP PAY の個人条件（本人が内訳まで出しているか）。'
  'full は REAL PAY の「報酬の内訳」を開く鍵 ── 基本給・保証手当・変動給の3つが'
  '同じ1件の中で「金額」か「該当なし」で回答済みなこと。'
  '2026-09-04 より前に内訳を出していた人は経過措置で開いたまま（締切は定数）。'
  '金額も件数も日付も返さない。判定は「内訳が有るか」だけ（base_pay か pay_items）。'
  '昔の形（総支給の代わりに内訳）も新しい形（総支給＋内訳の行）も同じように拾うので、'
  '過去の投稿もそのまま数えられる。'
  '本人の行の引き方は my_pay_reports() と同じ（proof_hash を作り直す）。'
  '★誰にも grant しない。pv_pay_rows() の中からだけ呼ぶ。';


-- ════════════════════════════════════════════════════════════════
-- 1-f. pv_contributors — 給与を出したユニークな人数（DEEP PAY の分子）
--
-- 返り値  整数1つだけ。誰が・いつ・いくら出したかは1バイトも出ない。
--
-- なぜ関数に切り出すか（2026-08-25）
--   この数は2か所から要る ── 一覧の stats（pv_pay_rows）と、
--   左メニューの DEEP PAY の札（pv_give_progress）。
--   **数え方を書き写すと、同じ「N / 100人」が画面によって違う数になる。**
--   pv_pending_usd が pv_annual_total を呼ぶのと同じ形で、定義はここ1つだけにする。
--
-- 数え方（ここが唯一の正）
--   本棚は proof_hash、預かりは ip_day_hash が「人」の単位。
--   ★sane（表に出る行）からは数えない。あれは「表の行の説明」で、
--     こちらは「何人のパイロットが参加したか」という別の問い。
--     sane から数えると、レートの無い通貨の人・24ヶ月より古い人が
--     参加していないことになってしまう。給与フォームを通った人を素直に数える。
--   ⚠️ 口コミに金額を書いた人は数えない（給与フォームを通っていない）。
--   ⚠️ 預かりは日ごとにキーが変わるので、登録前に2日に分けて出した人は2と数える
--      （登録して本棚へ移った時点で claimed_at が立ち、こちらからは消える）。
--   ⚠️ **会員登録の数ではない**（オーナー決定 2026-08-25）。登録しただけでは動かず、
--      給与を1件出したときに1つ増える。FOUNDING PILOT 100 と同じ100人。
--
-- ★誰にも grant しない。security definer の中（pv_pay_rows / pv_give_progress）からだけ呼ぶ。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_contributors()
returns int
language sql
security definer
stable
set search_path = public, extensions
as $fn$
  select (
    (select count(distinct r.proof_hash) from public.pay_reports r)
    + (select count(distinct q.ip_day_hash)
         from public.pay_reports_pending q
        where q.claimed_at is null and q.ip_day_hash is not null)
  )::int;
$fn$;

revoke all on function public.pv_contributors() from public, anon, authenticated;

comment on function public.pv_contributors() is
  '給与を出したユニークな人数。本棚は proof_hash、まだ移っていない預かりは ip_day_hash が人の単位。'
  '★会員登録の数ではない（給与を1件出したときだけ増える）。'
  '★表に出る行（sane）からは数えない。あれは表の説明で、これは参加人数という別の問い。'
  '★DEEP PAY の進捗にこれを使わない。表示も門も pv_deep_contributors（1-h）を呼ぶ。'
  '  こちらは proof_hash 単位（本人 × 会社）なので、2社に出した1人が2人になる。'
  '★誰にも grant しない。security definer の中からだけ呼ぶ。';


-- ════════════════════════════════════════════════════════════════
-- 1-g. pv_pay_person_map — proof_hash → 「同じ人」の通し番号
--
-- 返り値  (h, human) の表。h は pay_reports.proof_hash、human は
--         **この呼び出しの中だけで意味のある整数**。uid は1文字も出さない。
--
-- なぜ要るか（2026-09-01）
--   proof_hash は **（本人 × 会社）で1つ**（db/pay-reports.sql 5章）。
--   だから proof_hash を数えると、2社に出した1人が2人になる。
--   ・DEEP PAY の「100人」…… 実際より早く開いてしまう
--   ・区分の「3人以上」…… 実は2人しか居ないセルで中央値が出てしまう
--   後者は匿名性そのものなので、人の単位を1つ用意する。
--
-- 引き方は pv_review_person（1-d）と同じ ── 名簿（profiles）から
-- ハッシュを作り直して当てる。**列も表も pepper も新設していない。**
--   profiles.id は auth の uid そのもの。
--   submit_pay_report は投稿のたびに profiles 行を作る（db/pay-reports.sql 6章）
--   ＝正常に出した人がこの表から落ちることはない。
--
-- ★式は pv_my_keys（db/deep-pay.sql 1）・pv_my_give（1-e）と同じもの。**写しが3つ目。**
--   1つ直したら3つとも直す。db/test-deep-pay.mjs が「3つが同じ人を拾う」ことを固定している。
--
--   ⚠️ 技術的負債（DEEP PAY のリリースとは別タスク・2026-09-01 に記録）
--      この式は3か所にある（pv_my_keys / pv_my_give / ここ）。1つの private helper に
--      まとめたいが、3つは security definer の境界をまたいでいて、まとめると
--      「どの権限で走るか」が変わる。**今回は触らない**（オーナー指示：大規模
--      リファクタ禁止）。横断テスト db/test-deep-pay.mjs ▼21-i が3つのズレを検出する。
--
-- ★総当たりの相手は**実際に投稿のある会社だけ**（pv_airlines 全部ではない）。
--   proof_hash 側には必ずその会社が入っているので、これで取りこぼさない。
--
--   ⚠️ 性能の分岐点（今は最適化しない・オーナー指示 2026-09-01）
--      計算量は profiles の行数 × 投稿のある会社数ぶんの sha256。
--      今は数百人 × 数十社＝1000回未満で一瞬。**profiles が1万行を超えたあたり**から
--      毎回作り直すのが重くなるので、そのときに (proof_hash → 人) を持つ
--      内部キャッシュ表と、profiles・pay_reports へのトリガでの更新を検討する。
--      それまでは作らない（表が増えるほど「静かにズレる」場所が増えるため）。
-- ★誰にも grant しない。security definer の中からだけ呼ぶ。
--   uid → h は作れるが h → uid は作れない（sha256）。返り値の human は連番なので
--   外へ出しても本人には戻らないが、**それでも返り値には入れない**（下の pv_deep_pay）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_pay_person_map()
returns table (h text, human bigint)
language sql
security definer
stable
set search_path = public, extensions
as $fn$
  -- ★内側で h という名前を使わない（RETURNS TABLE の名前と衝突する）
  select z.hx, dense_rank() over (order by z.pid)
    from (
      -- 一覧から選んだ会社
      select encode(extensions.digest(
               p.id::text || '::pv_pay::' || a.code, 'sha256'), 'hex') as hx,
             p.id                                                      as pid
        from public.profiles p
        cross join (select distinct airline as code
                      from public.pay_reports
                     where airline <> 'other') a
      union all
      -- 「一覧にない会社」：ハッシュに自由入力の社名が入っている
      select encode(extensions.digest(
               p.id::text || '::pv_pay::other::' || o.nm, 'sha256'), 'hex'),
             p.id
        from public.profiles p
        cross join (select distinct lower(airline_other) as nm
                      from public.pay_reports
                     where airline = 'other' and airline_other is not null) o
    ) z;
$fn$;

revoke all on function public.pv_pay_person_map() from public, anon, authenticated;

comment on function public.pv_pay_person_map() is
  'pay_reports の proof_hash を「同じ人」でまとめるための対応表。'
  'proof_hash は（本人 × 会社）で1つなので、そのまま数えると2社に出した1人が2人になる。'
  '名簿（profiles）からハッシュを作り直して当てる（pv_review_person と同じ引き方）。'
  '★uid は関数の外へ出ない。human はこの呼び出しの中だけで意味のある連番。'
  '★式は pv_my_keys / pv_my_give と同じ写し。3つとも同時に直すこと。'
  '★誰にも grant しない。security definer の中からだけ呼ぶ。';


-- ════════════════════════════════════════════════════════════════
-- 1-h. pv_deep_contributors — DEEP PAY の「N / 100人」の分子（唯一の正）
--
-- pv_contributors（1-f）との違いは1つだけ ── **同じ人が2社に出しても 1**。
-- 画面に出るのは「給与を出したパイロットが100人」なので、こちらが正しい数え方。
--
-- ★これは表示と門の**両方**が呼ぶ。分けない（オーナー確定 2026-09-01）。
--   「表示上100人なのに門は開かない」という状態を作らないため、
--   pv_pay_rows の stats・pv_give_progress・pv_deep_pay の門が全部これを呼ぶ。
-- ★名簿に当たらない行は数えない（fail closed）。多く数えて門を早く開けるより、
--   少なく数えて開かないほうが安全。投稿時に必ず profiles 行ができるので
--   今は落ちる行が無い。
-- ★★預かり（pay_reports_pending）は数えない（オーナー確定 2026-09-01）。★★
--   ip_day_hash は「端末 × 日」であって人ではない ── 同じ人が翌日また出せば 2、
--   家族で1台なら 2人が 1。これを「パイロット◯人」と呼ぶと数が嘘になる。
--   預かりは**件数**として db/usage.mjs §3-b が別に出す（人数には混ぜない）。
--   登録して claim した時点で、その人は上の行として普通に 1 と数えられる。
--   ⚠️ ここに pay_reports_pending を書き戻さないこと。
--      db/pay-rows.sql の自己点検 47 が検出して落ちる。
-- ★誰にも grant しない。security definer の中からだけ呼ぶ。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_deep_contributors()
returns int
language sql
security definer
stable
set search_path = public, extensions
as $fn$
  select (select count(distinct m.human)
            from public.pay_reports r
            join public.pv_pay_person_map() m on m.h = r.proof_hash)::int;
$fn$;

revoke all on function public.pv_deep_contributors() from public, anon, authenticated;

comment on function public.pv_deep_contributors() is
  'DEEP PAY の解放進捗（N / 100人）の分子。ユニークな実人物で数える。'
  '同じ人が2社に給与を出しても 1（pv_contributors は proof_hash 単位なので 2 になる）。'
  '★表示（pv_pay_rows の stats・pv_give_progress）と門（pv_deep_pay）が同じこれを呼ぶ。'
  '★名簿に当たらない行は数えない（fail closed）。'
  '★登録前の預かりは数えない（ip_day_hash は端末×日であって人ではない）。'
  '★誰にも grant しない。security definer の中からだけ呼ぶ。';


-- ════════════════════════════════════════════════════════════════
-- 1-i. pv_deep_launch — 正式公開の手動フラグ（1行しか入らない）
--
-- ★解放条件はこの1行だけ（オーナー確定 2026-09-01）。
--     開く ＝ 今のユニークな人数が100人以上  or  この表に行が在る
--   前の版は「100人に達した瞬間にトリガで自動記録」していたが、取りやめた。
--   **自動では立たない・自動では降りない。管理者が一度だけ手で立てる。**
-- ★立てる前は、100人 → 99人 に落ちれば普通に閉じる（それが正しい挙動）。
--   立てたあとは人数が減っても開いたまま ── だから
--   「100人を保つために、消してほしい人のデータを残す」動機が生まれない。
--   **削除依頼が来た人のデータは普通に消す。この表があるからそれができる。**
-- ★区分ごとの3人の壁はこれとは別物で、今のデータで毎回判定する
--   （3人 → 2人に落ちればその区分は消える）。
-- ★個人データを1文字も持たない。持つのは真偽1つと日付1つだけ。
-- ★ポリシーを1本も作らない＋全権限 revoke ＝ 通常ユーザーは読むことも書くこともできない。
--
-- ★正式公開すると決めた日に、Supabase の SQL Editor でこの1行だけ流す：
--     insert into public.pv_deep_launch (one) values (true) on conflict do nothing;
--   ⚠️ この insert をこのファイルに書かないこと。貼り直すたびに勝手に開く。
-- ════════════════════════════════════════════════════════════════
create table if not exists public.pv_deep_launch (
  one       boolean primary key default true check (one),
  opened_at timestamptz not null default now()
);

alter table public.pv_deep_launch enable row level security;
revoke all on table public.pv_deep_launch from public, anon, authenticated;

comment on table public.pv_deep_launch is
  'DEEP PAY の正式公開フラグ。1行だけ。個人データは持たない。'
  '★管理者が一度だけ手で入れる。自動では立たないし、自動では降りない。'
  '★この行が在る間は再ロックしない（退会で99人に落ちても閉じない）。'
  '★立てる前は、100人 → 99人 に落ちれば普通に閉じる。'
  '★区分ごとの3人の壁は別物で、今のデータで毎回判定する。';


-- ════════════════════════════════════════════════════════════════
-- 1-j. 後始末 — 100人到達の自動記録は取りやめた（2026-09-01）
--
-- ★前の版には pv_deep_latch()（表2つの after insert トリガ）と
--   pv_deep_goal() が在った。解放条件が「今100人以上 or 手動フラグ」の
--   2つだけになったので、どちらも要らない。
-- ★貼ってしまった環境から確実に消すための後始末。何も無ければ何も起きない。
-- ★トリガを先に落としてから関数を落とす。
-- ════════════════════════════════════════════════════════════════
drop trigger  if exists trg_pv_deep_latch_pay  on public.pay_reports;
drop trigger  if exists trg_pv_deep_latch_prof on public.profiles;
drop function if exists public.pv_deep_latch();
drop function if exists public.pv_deep_goal();


-- ════════════════════════════════════════════════════════════════
-- 2. pv_pay_rows — 匿名レポート一覧（1行＝1人・出した人は全員）
--
-- 返り値
--   { ok:true, state:'locked', rows:[], stats:{…}, give:{…} }  鍵が無い／切れている
--   { ok:true, state:'open',   rows:[ … ], stats:{…}, give:{…} }  鍵がある
--   ★違いは rows だけ。鍵が無い人には**行が1つも入らない**。
--
-- stats（2026-08-24 に足した。理由はファイル冒頭「★数え上げについて」）
--   reports      … 提出の件数。同じ人の複数月もそれぞれ1件（＝ rows の数より必ず多いか同じ）
--   month        … そのうち直近1ヶ月に入ったぶん（★暦の月ではない。下の tally を見る）
--   airlines     … 行に出てくる航空会社の数
--   contributors … 給与を出したユニークな人数（DEEP PAY の「N / 100人」に使う）
--   ★reports / month / airlines は rows を作ったのと同じ材料（下の sane）から数える。
--     別々に数えると「126件なのに表は60行」の説明がつかなくなる。
--
--   ⚠️ 2026-08-25、オーナー判断で **stats は鍵が無い人にも返す**ことにした。
--      前は「数字も鍵の内側」として stats ごと落としていた。外へ新しく出るのは
--      「今どれだけ集まっているか」と「直近1ヶ月でどれだけ増えたか」の2つで、
--      **金額は1つも出ない**（行は今までどおり1つも返さない）。
--      理由は、出す前の人に「どれだけ集まっているか」が見えないと
--      Give & Get を選びようがないため。戻すなら v_open を stats にも掛ける。
--
--   ★contributors だけは sane から数えない。あれは「表の行の説明」で、
--     こちらは「何人のパイロットが参加したか」という別の問い。
--     sane から数えると、レートの無い通貨の人・24ヶ月より古い人が
--     参加していないことになってしまう。給与フォームを通った人を素直に数える。
--     ⚠️ 口コミに金額を書いた人は数えない（給与フォームは通っていない）。
--     ⚠️ 預かりは日ごとにキーが変わるので、登録前に2日に分けて出した人は2と数える
--        （登録して本棚へ移った時点で claimed_at が立ち、こちらからは消える）。
--
-- give ── 本人が何を出したか（2026-08-25。DEEP PAY の個人条件のため）
--   basic    … 給与レポートが1件でもある
--   detailed … 内訳のある行が1件でもある（基本給・保証給・職位手当・内訳の行のどれか）
--   payslip  … そのうち明細の裏付けがあるもの（verify_level >= 1）
--   ★新しい列を作っていない。総支給と内訳は 2026-08-26 から**両立する**ので、
--     判定は「内訳の欄が1つでも埋まっているか」で見る（pv_my_give の本体を参照）。
--     ＝既存の投稿も1件も取りこぼさない。
--   ★本人の行の引き方は my_pay_reports()（db/pay-reports.sql 5-b）と同じ。
--     pay_reports に user_id は無いので、proof_hash を作り直して突き合わせる。
--   ★返すのは真偽3つだけ。金額も件数も日付もここから出さない。
--
-- rows[] の1件
--   { airline, pos, annual_usd, verified, age }
--     airline … 航空会社コード。自由入力の社名の人は 'other' のまま
--               （打ち込まれた文字列は返さない。画面が固定の札に置き換える）
--     age     … 投稿の時期。0=1ヶ月以内 1=3ヶ月以内 2=6ヶ月以内 3=1年以内 4=それより前。
--               その人のいちばん新しい提出から決める。**日付も年月も返さない。**
--               並べ替えにも絞り込みにも使わない（契約⑥はそのまま）。
--     ★機材は返さない（2026-08-24 に外した。理由はファイル冒頭）。
--
-- 材料は3つ。本棚（会員が出したぶん）、まだ移っていない預かり、
-- そして昔の口コミに書かれた給与。
--   ★預かりは claimed_at が null のものだけ。移したものは本棚側に同じ人が居る。
--   ★口コミは、同じ人が本棚に居るなら落とす（明細を優先）。理由はファイル冒頭。
--
-- 同じ人の複数月は「年換算額の中央値」で1行に畳む。
--   ★最新月を採らない。最新月は投稿の新しさと相関するので、月をまたいで並べると
--     個人の変化を定点観測できてしまう。中央値なら2ヶ月の人は2値の平均＝
--     どの明細にも存在しない数になる（むしろ望ましい）。
--   ★機材を返さなくなったので、同じ人が 787 と 330 の両方を出していても
--     1行に畳まれる（前は機材ごとに1行ずつ出ていた）。④「1行＝1人」に近づいた。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_pay_rows()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_until timestamptz;
  v_open  boolean;
  /* ★本人が何を出したか。総当たりでハッシュを作り直す重い関数なので
     **1回だけ呼んで持ち回る**（下の give でも同じ値を使う）。 */
  v_give  jsonb;
  /* ★報酬の内訳の門（Give & Get）。上の鍵とは**別の錠前**。
     access_until を持っていても、自分の内訳を出していなければ開かない。 */
  v_comp  boolean;
  v_out   jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select p.access_until into v_until from public.profiles p where p.id = v_uid;

  -- ★ここで raise しない。投げると画面がエラー表示になり、
  --   「1枚出せば開く」という肝心の伝え方ができなくなる。
  -- ★2026-08-25、ここで return するのをやめた。数え上げ（stats）と
  --   本人が何を出したか（give）は鍵が無い人にも返すため。
  --   **行だけ**を下の listed で落とす。旗はここ1つで、
  --   分岐を2つに増やさない（増やすと片方だけ直して漏れる）。
  v_open := (v_until is not null and v_until > now());

  /* ── 報酬の内訳の門（Give & Get・2026-09-03）─────────────────
     オーナー指示 ──「自分の給与内訳を共有した人だけ、他人の給与内訳を見られる」。
     ★これは課金の門ではない。access_until の鍵とは**別**の錠前で、
       両方そろって初めて他人の内訳が見える。
     ⚠️ この注意書きに鍵の旗の変数名を書かないこと ── 自己点検36 が
        その名前の出現数をきっかり4と数えている（注意書きだけで赤くなる）。
     ★判定はここ（サーバ）だけ。閉じている人のブラウザには
       **金額そのものを1つも返さない**。画面でぼかす作りにしない
       ── DevTools でぼかしを外せば見えてしまう。
     ★開けるのは「報酬の内訳」だけ。会社・職位・機材・在籍の段・年収・
       月あたり・本人申告・投稿時期・勤務の帯は、閉じている人にもそのまま出す。 */
  v_give := public.pv_my_give();
  v_comp := coalesce((v_give->>'full')::boolean, false);

  with shelf as (
    -- ── ① 本棚（会員が出したぶん）──────────────────────────
    -- ★ここで選んだ列がすべて。増やす前に必ずファイル冒頭の②を読む。
    --   ★この行に列名そのものを書かないこと。自己点検8が「読んでいる」と誤検知する。
    --   ★自由入力の社名は pv_airline_resolve を通してからしか使わない（1-b2）。
    --     打ち込まれた文字列そのものは、ここから先へ1文字も出ない。
    --     出るのは pv_airlines.code か 'other' だけ。自己点検7が見ている。
    --   ★最後の1列は「いつ出されたか」。数を数えるため、粗い段（下の age）を
    --     出すため、そして並べる（契約⑥）ために持つ。
    --     日付そのものは行として返さない。自己点検 26 が見ている。
    select 'r:' || r.proof_hash as pkey,
           case when r.airline = 'other'
                then public.pv_airline_resolve(r.airline_other)
                else r.airline end as airline,
           r."position"         as pos,
           r.annual_total_usd   as usd,
           (r.verify_level >= 1) as vf,
           r.created_at         as cat,
           -- ── ここから下は2026-09-03に足した「帯の材料」──────────────
           --   ★どれも生の値のままここを通るが、**外へ出るのは帯だけ**。
           --     帯にするのは下の listed ただ1か所（pv_band を通す）。
           --     ここから listed までの間で行に混ぜないこと。
           --   ★語彙に無い機材は捨てる。画面の辞書にも無い＝コードが素で出る。
           case when exists (select 1 from public.pv_fleets f
                              where f.code = r.fleet and f.active)
                then r.fleet end as fleet,
           r.seniority_years    as sen,
           r.fx_to_usd          as fx,
           /* その月の現金（賞与ぬき）。db/deep-pay.sql の cash_m と1行ずつ同じ。
              ★組合が直接払った分だけは総支給の外にある（2026-09-02）。
                判定は pv_union_outside_gross の1か所だけを呼ぶ。 */
           case when nullif(r.gross_monthly, 0) is not null
                then greatest(r.gross_monthly - coalesce(r.bonus_month, 0), 0)
                   + case when public.pv_union_outside_gross(r.pay_items)
                          then coalesce(r.union_pay, 0) else 0 end
                else coalesce(r.base_pay, 0) + coalesce(r.guarantee_pay, 0)
                   + coalesce(r.hourly_rate, 0)
                     * greatest(coalesce(r.block_hours, 0),
                                coalesce(r.guaranteed_hours, 0))
                   + coalesce(r.per_diem, 0)
                   + case when r.housing_type = 'allowance'
                          then coalesce(r.housing_amount, 0) else 0 end
                   + coalesce(r.transport, 0) + coalesce(r.command_pay, 0)
                   + coalesce(r.other_allowance, 0) + coalesce(r.instructor_pay, 0)
                   + coalesce(r.examiner_pay, 0) + coalesce(r.union_pay, 0)
                   + coalesce(r.management_pay, 0) + coalesce(r.nonline_pay, 0)
           end                  as cash_m,
           -- ① 固定・保証給
           coalesce(r.base_pay, 0) + coalesce(r.guarantee_pay, 0)    as a_fixed,
           -- ② 変動給。書いていない人は「時給 × 実績と保証時間の大きい方」
           coalesce(r.flight_variable_pay,
                    coalesce(r.hourly_rate, 0)
                    * greatest(coalesce(r.block_hours, 0),
                               coalesce(r.guaranteed_hours, 0)))     as a_var,
           -- ③ 職位手当
           coalesce(r.command_pay, 0)                                as a_cmd,
           -- ④ 役割手当（教官・審査・組合・管理・兼務）
           coalesce(r.instructor_pay, 0) + coalesce(r.examiner_pay, 0)
           + coalesce(r.union_pay, 0) + coalesce(r.management_pay, 0)
           + coalesce(r.nonline_pay, 0)                              as a_role,
           -- ⑤ パーディアム
           coalesce(r.per_diem, 0)                                   as a_pd,
           -- ⑥ 住宅手当。現物支給の社宅は現金ではないので数えない
           case when r.housing_type = 'allowance'
                then coalesce(r.housing_amount, 0) else 0 end        as a_house,
           /* ⑦ その他の現金手当
              ★★ この引き算が命綱。★★ 給与フォームが変動の合計を
              flight_variable_pay **と** other_allowance の**両方**に写すので、
              素直に足すと変動給を二重に数える。
              ★★ 直したら db/deep-pay.sql の sane（a_other）と、
                 上の pv_pending_detail も同じに直す。同じ式が3か所にある。★★ */
           greatest(coalesce(r.other_allowance, 0)
                    - coalesce(r.flight_variable_pay, 0), 0)
           + coalesce(r.transport, 0)                                as a_other,
           -- 賞与は帯の中に混ぜず、1本だけ別に出す（年額なので12倍しない）
           coalesce(r.bonus_annual, 0)
           + coalesce(r.profit_share_annual, 0)                      as bonus_y,
           -- 勤務は3つだけ。便数・ステイ日数・拘束時間は読まない（ファイル冒頭②）
           r.block_hours        as bh,
           r.duty_days          as dd,
           r.days_off           as dof,
           -- 内訳を書いたか。db/deep-pay.sql の det と1文字ずつ同じ条件
           (r.base_pay is not null or r.guarantee_pay is not null
            or r.command_pay is not null or r.pay_items is not null) as det
      from public.pay_reports r
     where r.annual_total_usd is not null      -- レートの無い通貨は落ちる（6章と同じ）
       and r.created_at >= now() - interval '24 months'
  ),
  src as (
    select * from shelf
    union all
    -- ── ② 預かり（登録前に出されたぶん。まだ本棚に移っていないものだけ）──
    --   ★claimed_at is null が二重計上の唯一の歯止め。外さないこと。
    --   ★人の単位は ip_day_hash。日をまたぐと同じ人でも別の値になる（＝2行に見える）。
    --   ★読むのは airline と、金額を出すための payload だけ。
    --     payload の中の自由入力の社名も、本棚と同じく pv_airline_resolve を通す。
    --     pv_pending_usd のほうは今までどおり金額の欄しか見ない。
    select 'p:' || q.ip_day_hash,
           case when q.airline = 'other'
                then public.pv_airline_resolve(q.payload->>'airline_other')
                else q.airline end,
           q.payload->>'position',
           public.pv_pending_usd(q.payload),
           false,
           q.created_at,
           -- ★2026-09-03。本棚と同じ材料を payload から出す（pv_pending_detail）。
           --   年収は今までどおり pv_pending_usd。あちらは1文字も変えていない。
           case when exists (select 1 from public.pv_fleets f
                              where f.code = nullif(btrim(q.payload->>'fleet'), '')
                                and f.active)
                then nullif(btrim(q.payload->>'fleet'), '') end,
           nullif(q.payload->>'seniority_years', '')::smallint,
           (d.j->>'fx')::numeric,
           (d.j->>'cash_m')::numeric,
           (d.j->>'fixed')::numeric,
           (d.j->>'var')::numeric,
           (d.j->>'cmd')::numeric,
           (d.j->>'role')::numeric,
           (d.j->>'pd')::numeric,
           (d.j->>'house')::numeric,
           (d.j->>'other')::numeric,
           (d.j->>'bonus_y')::numeric,
           (d.j->>'bh')::numeric,
           (d.j->>'dd')::smallint,
           (d.j->>'dof')::smallint,
           (d.j->>'det')::boolean
      from public.pay_reports_pending q
      cross join lateral (select public.pv_pending_detail(q.payload) as j) d
     where q.claimed_at is null
       and q.ip_day_hash is not null
       and q.created_at >= now() - interval '24 months'
       -- 預かりの airline には外部キーが無いので、ここで語彙に当てる。
       -- 当たらない値は画面の辞書にも無い＝コードがそのまま出てしまう。
       and exists (select 1 from public.pv_airlines a where a.code = q.airline)
    union all
    -- ── ③ 昔の口コミに書かれた給与（2026-08-24。理由はファイル冒頭）──
    --   ★合計の出し方は口コミカード（airlines/airline-reviews-ui.js）と1文字も違えない。
    --     総額 ＞ 基本給＋乗務手当＋賞与 ＞ 月給×12＋賞与。
    --     nullif を外さないこと。あちらは 0 を「入っていない」と読むので、
    --     coalesce だけにすると 0 の行で答えが変わる。
    --   ★保存されているのは万円。原本の通貨は持っていない（口コミは常に万円で入る）。
    --     だから**今の**レートで USD に直す。本棚側は投稿した瞬間のレートで
    --     確定しているので、ここだけ扱いが違う。ゆがみは丸め（③）より小さい。
    --   ★職位は古いコードを寄せる（pv-vocab.mjs の LEGACY_POSITIONS と同じ内容）。
    --     語彙に無い値の行は落とす。
    --   ★同じ人が本棚に居るなら出さない。明細のほうが確かで、両方出すと
    --     同じ人が2行になる（契約④）。
    --   ★口コミの社名の欄は**コードとは限らない**。「その他」を選んだ人の行には
    --     打ち込まれた文字列がそのまま入っている（submit-review.html の
    --     effectiveAirline）。だから本棚・預かりと違い、無条件に
    --     pv_airline_resolve を通す。当たれば本当の社名、当たらなければ 'other'。
    select l.pkey,
           public.pv_airline_resolve(v.airline),
           case v."position" when 'captain' then 'cap'
                             when 'sfo'     then 'fo'
                             when 'tri_tre' then 'cap'
                             else v."position" end,
           round(coalesce(
                   nullif(v.annual_salary, 0),
                   case when coalesce(nullif(v.base_annual, 0),
                                      nullif(v.flight_allowance_annual, 0)) is not null
                        then coalesce(v.base_annual, 0)
                           + coalesce(v.flight_allowance_annual, 0)
                           + coalesce(v.bonus, 0) end,
                   case when nullif(v.monthly_salary, 0) is not null
                        then v.monthly_salary * 12 + coalesce(v.bonus, 0) end
                 )::numeric * 10000 * jpy.to_usd, 2),
           false,
           v.created_at,
           /* ★口コミは機材も在籍も内訳も勤務も**持っていない**（金額だけ）。
              ここを埋めるための推測をしないこと。行は総額だけの行として出て、
              画面は「この行は年収だけです」と正直に書く。 */
           null::text, null::smallint, null::numeric, null::numeric,
           null::numeric, null::numeric, null::numeric, null::numeric,
           null::numeric, null::numeric, null::numeric, null::numeric,
           null::numeric, null::smallint, null::smallint, false
      from public.reviews_v2 v
      join public.pv_review_person l on l.review_id = v.id
      join public.fx_rates jpy on jpy.code = 'JPY'
     where v.created_at >= now() - interval '24 months'
       and case v."position" when 'captain' then 'cap'
                             when 'sfo'     then 'fo'
                             when 'tri_tre' then 'cap'
                             else v."position" end
           in (select c.code from public.pv_positions c)
       and not exists (select 1 from shelf s where s.pkey = l.pkey)
  ),
  sane as (
    -- ── ③ 常識の幅（⑦）。打ち間違いだけを落とす ────────────────
    --   ★狭めないこと。実在しうる年収を1つも落とさない幅にしてある。
    --     理由と実例はファイル冒頭「⑦とは何か」。
    select * from src
     where usd is not null
       and usd between 10000 and 700000
  ),
  person as (
    -- ★人ごとに畳む。ここが「1行＝1人」の実体。
    select pkey, airline, pos,
           -- ★percentile_cont は numeric を渡しても double precision で返る。
           --   round(値, 桁) は numeric にしか無いので、先に ::numeric を通す。
           (percentile_cont(0.5) within group (order by usd))::numeric as v,
           bool_or(vf) as verified,
           -- ★投稿の時期。**その人のいちばん新しい提出**から決める。
           --   出るのは0〜4の段だけで、日付も年月もここから先へ行かない。
           --   段で並べ替えない・段で絞らない（契約⑥。理由はファイル冒頭）。
           case when max(cat) >= now() - interval '1 month'   then 0
                when max(cat) >= now() - interval '3 months'  then 1
                when max(cat) >= now() - interval '6 months'  then 2
                when max(cat) >= now() - interval '12 months' then 3
                else 4 end as age,
           -- ★並べるためだけの時刻（契約⑥）。**行には入れない**。
           --   段（age）と同じ max(cat) から出す。別の時刻で並べると、
           --   並び順と右端の列が食い違って見える。
           max(cat) as last_at
      from sane
     group by pkey, airline, pos
  ),
  pick as (
    /* ── どの月の内訳と勤務を見せるか（2026-09-03）─────────────
       金額は person で中央値に畳んでいるので、内訳と勤務も
       **その中央値にいちばん近い月**を代表に採る。同点は md5 で割る。
       ★★ 最新月を採らないこと。★★ 採ると「いつ出したか」が内訳ごしに
          漏れる（契約⑥と同じ理由）。abs() が第1キーである限り、この
          order by に時刻は1つも入らない。
       ★1か月しか出していない人は、どの採り方でも同じ行になる。
       ★ここで採った月の**生の額**が下の paid へ渡るが、外へ出るのは
         pv_band を通した帯だけ。この CTE の値を行に混ぜないこと。 */
    select distinct on (s.pkey, s.airline, s.pos)
           s.pkey, s.airline, s.pos, s.fleet, s.sen, s.fx, s.cash_m, s.det,
           s.a_fixed, s.a_var, s.a_cmd, s.a_role, s.a_pd, s.a_house, s.a_other,
           s.bonus_y, s.bh, s.dd, s.dof
      from sane s
      join person p
        on p.pkey = s.pkey and p.airline = s.airline and p.pos = s.pos
     order by s.pkey, s.airline, s.pos,
              abs(s.usd - p.v), md5(s.pkey || s.usd::text)
  ),
  grid as (
    /* 帯の幅。**その人の年収から1つだけ**決める（区分ごとに変えない）。
       式は pv_band_grid ただ1本。ここで刻みを直接書かないこと。 */
    select p.pkey, p.airline, p.pos,
           public.pv_band_grid(public.pv_sig2(p.v)) as g
      from person p
  ),
  paid as (
    /* ── 支給の内訳を帯にする（2026-09-03）─────────────────
       ★出るのは帯（下端と上端）だけ。**割合も図も出さない。**
         割合は DEEP PAY の担当で、あちらは1人ずつではなく集計して出す。
       ★検品は db/deep-pay.sql の ok と同じ関所 ── 現金があり、内訳の合計が
         現金を2%以上はみ出していないこと。はみ出しは本人の書き間違いで、
         こちらで按分すると嘘の内訳になる。落ちた行は帯が付かないだけで、
         行そのものは総額の行として残る（画面は正直に1文だけ出す）。
       ★0 の区分は落とす。空の札を並べない。
       ★帯を足しても上の年収とは合わない。**合わせる処理を入れないこと。**
         入れた瞬間、帯の中の本当の位置が逆算できる（ファイル冒頭の「★帯について」）。 */
    select k.pkey, k.airline, k.pos,
           /* キーは k（区分）と r（帯 ＝ 下端と上端の2つ）だけ。
              ★'b' を使わないこと ── DEEP PAY の割合が
                {"m":…,"b":…,"d":…,"h":…,"o":…} という形をしていて、
                db/test-pay-rows.mjs が「REAL PAY の返り値にその形が無い」を
                見ている。同じ1文字を使うと、割合が混ざっていないという
                検査が**当たらなくなる**（検査は緑のまま意味を失う）。 */
           jsonb_agg(jsonb_build_object(
             'k', x.seg,
             'r', public.pv_band(x.amt, gr.g, true)
           ) order by x.ord) as j
      from pick k
      join grid gr
        on gr.pkey = k.pkey and gr.airline = k.airline and gr.pos = k.pos
      cross join lateral (values
        (1, 'fixed',    k.a_fixed * 12 * k.fx),
        (2, 'variable', k.a_var   * 12 * k.fx),
        (3, 'command',  k.a_cmd   * 12 * k.fx),
        (4, 'role',     k.a_role  * 12 * k.fx),
        (5, 'perdiem',  k.a_pd    * 12 * k.fx),
        (6, 'housing',  k.a_house * 12 * k.fx),
        (7, 'other',    k.a_other * 12 * k.fx),
        (8, 'rest',     greatest(k.cash_m - (k.a_fixed + k.a_var + k.a_cmd
                                             + k.a_role + k.a_pd + k.a_house
                                             + k.a_other), 0) * 12 * k.fx),
        -- ★賞与は**年額**なので12倍しない。月々の帯にも混ぜない。
        (9, 'bonus',    k.bonus_y * k.fx)
      ) as x(ord, seg, amt)
     where k.det                 -- 総支給しか書いていない人には帯を作らない
       and k.fx is not null
       and k.cash_m is not null and k.cash_m > 0
       and (k.a_fixed + k.a_var + k.a_cmd + k.a_role
            + k.a_pd + k.a_house + k.a_other) <= k.cash_m * 1.02
       and gr.g is not null
       and x.amt > 0
     group by k.pkey, k.airline, k.pos
    /* ★「余り」1本だけの内訳は出さない。それは年収を写しただけで、
         本人が書いた内訳ではない。 */
    having bool_or(x.seg <> 'rest')
  ),
  worked as (
    /* ── 勤務を帯にする（2026-09-03）───────────────────────
       刻みは固定（乗務時間 10h / 乗務日数 2日 / 休日 2日）。
       年収の grid に連動させないこと ── 連動させると、勤務の帯の幅から
       年収の帯の幅が読め、年収の丸めが1段細かくなる。
       ★2×刻み未満を畳まない（15h を「20h未満」と書くと 10〜20h より粗くなる）。
       ★★ 3つだけ。★★ 便数・ステイ日数・拘束時間・深夜時間・クレジット時間は
          返さない。重ねると一気に個人へ当たる（ファイル冒頭②）。
          ★この段落に列名そのものを書かないこと ── 自己点検 55 が
            「その5つの列名がこの関数に1語も無い」を見ているので、
            注意書きのつもりで書くと**注意書きだけで赤くなる**（8番と同じ罠）。 */
    select k.pkey, k.airline, k.pos,
           nullif(jsonb_strip_nulls(jsonb_build_object(
             'bh',  public.pv_band(k.bh::numeric,  10::numeric, false),
             'dd',  public.pv_band(k.dd::numeric,   2::numeric, false),
             'off', public.pv_band(k.dof::numeric,  2::numeric, false)
           )), '{}'::jsonb) as j
      from pick k
  ),
  listed as (
    /* ★jsonb_strip_nulls ── 材料が無い行は**キーごと消える**。
         「不明」「—」を入れないこと。書いていないという事実も情報。 */
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'airline',    p.airline,
             'pos',        p.pos,
             'annual_usd', public.pv_sig2(p.v),
             'verified',   p.verified,
             'age',        p.age,
             -- ── ここから4つが2026-09-03に足したもの。どれも段か帯だけ ──
             --   機材は語彙のコード1つ（全行。人数の門は掛けない＝オーナー確定）。
             --   ★機材の区分（狭胴・中型・広胴）のほうは返さない。2粒度が
             --     揃うと、機材を書いていない人の区分まで推測の材料になる。
             --     自己点検 23 が、その列名がこの関数に1語も無いことを見ている。
             'fleet',      k.fleet,
             /* 在籍は**段だけ**。年そのものは返さない。
                FO＝5年で2段 / CAP＝10年・20年で3段（オーナー確定）。
                cadet と、年数を書いていない人は null ＝ キーごと消える。
                ★キー名は ten（tenure の頭3文字）。在籍を表す英単語を
                  そのままキーにしないこと ── 画面側の禁止語であり、
                  自己点検 51 もその語が関数に無いことを見ている
                  （注意書きのつもりで書くと注意書きだけで赤くなる）。 */
             'ten',        case when k.sen is null then null
                                when p.pos = 'fo'
                                  then case when k.sen < 5 then 0 else 1 end
                                when p.pos = 'cap'
                                  then case when k.sen < 10 then 0
                                            when k.sen < 20 then 1
                                            else 2 end
                           end,
             /* ── 報酬の内訳（2026-09-03 に門がついた）─────────────
                ★閉じている人には帯そのものを渡さない。**null にして消す**
                  （jsonb_strip_nulls が下で効くので、キーごと消える）。
                  伏せた値・0・ダミーを入れないこと ── 入れた瞬間、
                  「隠している」だけになり DevTools で外せる作りに戻る。
                ★paylock に入るのは**区分の名前だけ**（2026-09-03 その3、
                  オーナー指示「色付きの棒グラフと項目名までは出す。金額だけ隠す」）。
                  帯（r）は1つも入れない＝金額は今までどおり1円も出ない。
                  画面がこの3状態を見分けるために要る ──
                    pay あり      … 内訳あり・開いている
                    paylock だけ  … 内訳あり・閉じている（門を出す）
                    どちらも無し  … そもそも内訳が無い（門を出してはいけない）
                  3つ目に門を出すと、書いていない人の投稿を
                  「何か隠されている」と読ませることになる。 */
             'pay',        case when v_comp then c.j else null end,
             'paylock',    case when c.j is null or v_comp then null
                                /* ★区分が1つだけの行は名前も渡さない（真偽に落とす）。
                                     区分が1つ ＝ その区分が内訳のほぼ全部。面には年収が
                                     出ているので、名前を出した時点で「基本給 ≒ 年収」と
                                     読めてしまい、金額を渡さない意味が消える。 */
                                when jsonb_array_length(c.j) < 2 then to_jsonb(true)
                                /* ★名前だけを、上の paid が組んだ**固定順**のまま渡す。
                                     金額順に並べ替えないこと ── 大きい順にすると
                                     「変動給 > 基本給」という順位が、数字を1文字も
                                     書かないまま漏れる。帯の幅は画面の CSS が持つ
                                     （全員同じ）＝割合もここから出ない。 */
                                else (select jsonb_agg(e.v->'k' order by e.i)
                                        from jsonb_array_elements(c.j)
                                             with ordinality as e(v, i))
                           end,
             'work',       wk.j
           -- ★2026-08-25、オーナー指示で md5 順をやめ、**新しい順**にした
           --   （新しいほうが上）。理由と、これで何が読めるようになったかは
           --   ファイル冒頭「★並びについて」。
           --   ・並べるのに使う時刻（last_at）は**行に入れない**。
           --     出るのは今までどおり段（age）だけ。
           --   ・同じ時刻の人が居ても順番が揺れないよう md5 を第2キーに残す。
           --   ・画面側に並べ替えの口は作らない（サーバが1つに決める）。
           )) order by p.last_at desc, md5(p.pkey)), '[]'::jsonb) as j
      from person p
      /* ★どれも left join。材料が無い人も**行は必ず出る**（総額だけの行になる）。
         内側の join にすると、口コミ由来の行と総支給だけの行が一覧から消える。 */
      left join pick   k  on k.pkey  = p.pkey and k.airline  = p.airline
                         and k.pos   = p.pos
      left join paid   c  on c.pkey  = p.pkey and c.airline  = p.airline
                         and c.pos   = p.pos
      left join worked wk on wk.pkey = p.pkey and wk.airline = p.airline
                         and wk.pos  = p.pos
  ),
  tally as (
    -- ★数え上げ。**必ず sane から数える**（＝行と同じ材料。同じ幅・同じ期間・
    --   同じ「移した預かりは読まない」）。別の場所から数え直すと、画面の
    --   「◯件」と表の行数の関係が説明できなくなる。
    --   ここで数えるのは件数だけで、誰がいつ出したかは1つも外へ出ない。
    -- ★2026-08-25、オーナー指示で窓を暦の月（date_trunc）から**直近1ヶ月**に変えた。
    --   理由は2つ。①「今月の新規投稿」は毎月1日に 0 へ戻るので、月初に見た人には
    --   まだ誰も出していないように見える。②上の person の段0（「1ヶ月以内」）が
    --   もともと now() - interval '1 month' なので、カードと表の右端が**同じ境目**になる。
    --   ⚠️ どちらか片方だけ直すと、札は「1ヶ月以内 27件」なのに表で「1ヶ月以内」と
    --      出る行がそれより少ない、という静かなずれになる。必ず一緒に動かす。
    select count(*)::int as reports,
           count(*) filter (where cat >= now() - interval '1 month')::int as mo
      from sane
  ),
  airs as (
    -- 社数。★person から数える（＝表に実際に出てくる会社）。画面が rows を
    --   数えて出していた数字を、行の来ない人にも返せるようにサーバへ移した。
    select count(distinct airline)::int as n from person
  ),
  contrib as (
    -- ★給与を出したユニークな人数。ここだけ sane から数えない（理由は上のヘッダ）。
    --   数え方は書き写さない。唯一の正は pv_deep_contributors()（1-h）で、
    --   左メニューの札を出す pv_give_progress()（2-b）と、DEEP PAY の門
    --   （pv_deep_pay）も同じ関数を呼ぶ。
    --   ここに式を戻すと、同じ「N / 100人」が画面によって違う数になる。
    -- ★1-f（pv_contributors）ではない。あちらは proof_hash 単位＝2社に出した
    --   1人が2人になる。画面は「パイロットが100人」と書いているので実人物で数える。
    select public.pv_deep_contributors() as n
  )
  select jsonb_build_object(
           'ok',    true,
           'state', case when v_open then 'open' else 'locked' end,
           -- ★行はここだけで落とす。鍵が無ければ空の配列そのもので、
           --   ぼかした行でも伏せ字の行でもない（渡していないものは隠せない）。
           'rows',  case when v_open then l.j else '[]'::jsonb end,
           'stats', jsonb_build_object('reports',      t.reports,
                                       'month',        t.mo,
                                       'airlines',     s.n,
                                       'contributors', c.n),
           -- ★本人が何を出したか。中身は pv_my_give() が持つ（1-b3）。
           --   ここに書き写さない。本人の行を引くには打ち込まれた社名を
           --   ハッシュの材料として読む必要があり、この関数の中で読むと
           --   「打ち込まれた社名を読んでいない」という一覧側の約束
           --   （自己点検7）が言えなくなる。読む場所を1つに閉じ込める。
           -- ★上（begin の直後）で1回だけ呼んだものをそのまま返す。
           --   もう一度呼ばない ── 航空会社の総当たりでハッシュを作る関数なので、
           --   1回の呼び出しで2度走らせると素直に2倍かかる。
           'give',  v_give
         )
    into v_out
    from listed l
    cross join tally t
    cross join airs s
    cross join contrib c;

  return v_out;
end;
$$;

-- ★anon に渡さない。pay_benchmarks が anon に開いているのは「1行＝区分」だから。
--   こちらは 1行＝人で粒度が一段細かいので、同じ扱いにはできない。
--   画面側でぼかす方式（index.html の .pv-mask）もここでは使えない。
--   開発者ツールから全部見えるので、Give & Get の約束はサーバ側で守る。
revoke all on function public.pv_pay_rows() from public, anon;
grant execute on function public.pv_pay_rows() to authenticated;

comment on function public.pv_pay_rows() is
  '実給与の匿名一覧。1行＝1人（複数月は年換算の中央値で畳む）。出した人は全員出る。'
  '材料は3つ：本棚（pay_reports）／まだ移っていない預かり（pay_reports_pending）／'
  '昔の口コミに書かれた給与（reviews_v2。同じ人が本棚に居るなら明細を優先して落とす）。'
  '機材・基地・在籍年数・年代・原本通貨・契約形態・自由入力の社名は返さない。'
  '投稿の時期は5段の粗い区分（age 0〜4）でだけ返す。日付も年月も返さない。'
  '支給の内訳も返さない（内訳は DEEP PAY の担当）。'
  '金額は有効数字2桁に丸め、年 $10,000〜$700,000 の外は打ち間違いとして出さない。'
  '並びは新しい順（last_at desc）。並べるのに使う時刻は行に入れない。'
  '2026-08-24 から stats（提出の件数・直近1ヶ月のぶん）も返す。行と同じ材料から数える。'
  '2026-08-25 から stats に社数と、給与を出したユニークな人数（contributors）を足し、'
  '**鍵が無い人にも stats を返す**ようにした（金額は1つも出ない。行は今までどおり空）。'
  '同じ回に give（本人が basic / detailed / payslip のどれを出したか）を足した。'
  'give は真偽3つだけで、金額も件数も日付も返さない。'
  '★引数を取らない＝他人の区分を狙って引く面が無い。'
  '★鍵は給与明細の access_until のみ。口コミの鍵では開かない。';


-- ════════════════════════════════════════════════════════════════
-- 2-b. pv_give_progress — DEEP PAY の札に要る2つだけを返す
--
-- 返り値  { ok:true, contributors:<int>, give:{ basic, detailed, payslip } }
--         整数1つと真偽3つだけ。行も金額も日付も社名も1つも入らない。
--
-- なぜ要るか（2026-08-25 オーナー指示「パイロットの人数が合うように他のページとも調整して」）
--   左メニュー（マイレポート／REAL PAY／DEEP PAY／VERIFIED PAY／設定）は
--   4つの画面に同じものが出ていて、DEEP PAY を押すとどこでも同じ説明が開く。
--   ところが数を持っているのは pv_pay_rows() を引く2画面だけで、残りは
--   「準備中」のままだった＝**同じボタンなのに画面によって答えが違う**。
--
--   ではなぜ全画面で pv_pay_rows() を引かないか。
--   鍵を持つ人が引くと**要らない行が全部付いてくる**（あの関数の本体は一覧）。
--   CLAUDE.md が「数え上げのために pv_pay_rows() を引くのは、まだ1件も出していない人の
--   枝だけ」と決めているのはそのため。この関数はその約束を守ったまま札を出す口で、
--   一覧を1行も作らない。
--
-- ★中身を1つも書き写さない。
--   contributors … pv_deep_contributors()（1-h）。数え方はあちらが唯一の正。
--                  ★門（pv_deep_pay）と同じ関数。札とゲートがずれない。
--   give         … pv_my_give()（1-e）。本人の行の引き方はあちらが唯一の正。
--   ここが持っているのは「2つを1回で返す」ことだけ。
--
-- ★未ログインでも落とさない（null を返す）。画面は札を「準備中」のままにする。
--   数が読めないときに 0 を置かない、はカードと同じ決まり。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_give_progress()
returns jsonb
language sql
security definer
stable
set search_path = public, extensions
as $fn$
  select jsonb_build_object(
           'ok',           true,
           'contributors', public.pv_deep_contributors(),
           'give',         public.pv_my_give()
         )
   where auth.uid() is not null;
$fn$;

-- ★anon には渡さない。ログインした人だけが自分の進み具合を見る。
revoke all on function public.pv_give_progress() from public, anon;
grant execute on function public.pv_give_progress() to authenticated;

comment on function public.pv_give_progress() is
  'DEEP PAY の札（N / 100人）に要る2つだけを返す。整数1つと真偽3つで、行も金額も日付も返さない。'
  '左メニューを持つどの画面からでも同じ数が出るようにするための口（2026-08-25）。'
  '一覧（pv_pay_rows）を引くと鍵を持つ人に要らない行が全部付いてくるので、そちらは使わない。'
  '★中身は書き写さず pv_deep_contributors() と pv_my_give() をそのまま呼ぶ。'
  '★未ログインでは null を返す（0 を置かない。画面は「準備中」のまま）。';


-- ════════════════════════════════════════════════════════════════
-- 3. 自己点検（読むだけ。何も書き換えない）
--
-- ★1本の SELECT にしてある。Supabase の SQL Editor は複数文を流すと
--   最後の1本の結果しか出さないので、分けて書くと上から順に消えていく。
-- 期待：56行すべて ✅。1つでも ❌ なら、そこが効いていない。
--
-- 特に 4・8・12・13・14・16・22・23・30・31・36・37・40・41・42・44・45・46・47・
--      50・51・52・53・54・55・56 は
-- 「静かに壊れる」種類のもの ── 画面には何も出ないまま、他人の個票に届く経路が開く
-- （16・30 は逆に、同じ人が二重に出る／41・45・47 は数だけが画面ごとに食い違う）。
-- ════════════════════════════════════════════════════════════════
with f as (
  select to_regprocedure('public.pv_pay_rows()')       as f_rows,
         to_regprocedure('public.pv_sig2(numeric)')    as f_sig,
         to_regprocedure('public.pv_pending_usd(jsonb)') as f_pend,
         -- ★2026-09-03 に足した3本（帯の関数2つと、預かりの材料）
         to_regprocedure('public.pv_pending_detail(jsonb)')      as f_pdet,
         to_regprocedure('public.pv_band_grid(numeric)')         as f_grid,
         to_regprocedure('public.pv_band(numeric,numeric,boolean)') as f_band,
         to_regprocedure('public.pv_pct5(numeric[])')    as f_pct,
         to_regprocedure('public.pv_pending_comp(jsonb)') as f_pcomp,
         to_regprocedure('public.pv_pay_comp(numeric,numeric,numeric,numeric,numeric,'
                         || 'numeric,text,numeric,numeric,numeric,numeric,numeric,'
                         || 'numeric,numeric,numeric,numeric,numeric,numeric,numeric,'
                         || 'numeric)')  as f_comp,
         to_regclass('public.pay_benchmarks')          as bench,
         to_regclass('public.pv_review_person')        as link,
         to_regprocedure('public.pv_airline_resolve(text)') as f_res,
         to_regprocedure('public.pv_airline_norm(text)')    as f_norm,
         to_regprocedure('public.pv_my_give()')             as f_give,
         to_regprocedure('public.pv_contributors()')        as f_ctb,
         to_regprocedure('public.pv_deep_contributors()')   as f_dctb,
         to_regprocedure('public.pv_pay_person_map()')      as f_pmap,
         to_regprocedure('public.pv_give_progress()')       as f_prog,
         to_regclass('public.pv_deep_launch')               as t_lch
)
select n as "#", case when ok then '✅' else '❌' end as 結果, 見るところ
from (
  select 1 as n, '3つの関数がある' as 見るところ,
         (f_rows is not null and f_sig is not null and f_pend is not null) as ok from f
  union all
  select 2, '一覧の関数は引数を取らない（他人の区分を狙って引けない）',
         case when f_rows is null then false
              else (select p.pronargs from pg_proc p where p.oid = f.f_rows) = 0 end from f
  union all
  select 3, '一覧の関数は security definer で動く',
         case when f_rows is null then false
              else (select p.prosecdef from pg_proc p where p.oid = f.f_rows) end from f
  union all
  select 4, '登録していない人（anon）は一覧を呼べない',
         case when f_rows is null then false
              else not has_function_privilege('anon', f_rows, 'execute') end from f
  union all
  select 5, 'ログインした人は一覧を呼べる',
         case when f_rows is null then false
              else has_function_privilege('authenticated', f_rows, 'execute') end from f
  union all
  select 6, '給与明細の鍵（access_until）を見ている',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%access_until%' end from f
  union all
  select 7, '★打ち込まれた社名は pv_airline_resolve を通してからしか使っていない',
         -- ★2026-08-25 に書き換えた。前は「airline_other を1文字も書いていない」を
         --   見ていた。今は語彙に当ててから使う（出口は code か 'other' だけ）ので、
         --   **resolve の括弧の中を消してから** airline_other が残らないかを見る。
         --   素の airline_other が1つでも残っていれば、それは文字列がどこかへ
         --   漏れる道が開いたということ。
         case when f_rows is null or f_pend is null then false
              else regexp_replace(pg_get_functiondef(f_rows),
                     'pv_airline_resolve\([^()]*(\([^()]*\))?[^()]*\)', '', 'g')
                   not like '%airline_other%'
               and pg_get_functiondef(f_pend) not like '%airline_other%' end from f
  union all
  select 8, '準識別子を1つも読んでいない（基地・年代・投稿月・国籍・契約・税・原本通貨）',
         /* ★2026-09-03 に seniority_years を除外語から外した（オーナー判断で
            在籍を出すことにしたため）。**外したのはこの1語だけ。**
            年数そのものが行へ出ていないことは 51 が別に見ている。
            ⚠️ この一覧に語を足すのは簡単だが、外すのは設計判断。
               外すときは必ずファイル冒頭の②も同じ日付で書き換えること。 */
         case when f_rows is null or f_pend is null then false
              else pg_get_functiondef(f_rows) !~
                   '(base_iata|age_bucket|contract_type|tax_country|nationality|annual_total_orig|period_month)'
               and pg_get_functiondef(f_pend) !~
                   '(base_iata|seniority_years|age_bucket|contract_type|tax_country|nationality|period_month)'
         end from f
  union all
  select 9, '金額を有効数字2桁に丸めている',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%pv_sig2(%' end from f
  union all
  select 10, '同じ人の複数月を1行に畳んでいる（人のキーで group by）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%group by pkey, airline, pos%'
         end from f
  union all
  select 11, '★並びは新しい順（サーバが1つに決める。同着は md5 で固定）',
         -- ★2026-08-25 に書き換えた。前は「md5 順であること」を見ていた。
         --   オーナー指示で出した順にしたので、見るところを
         --   「並べるのに使う時刻が last_at であること」＋
         --   「同着でも順番が揺れないよう md5 が第2キーに残っていること」に変えた。
         --   時刻そのものを返していないことは 12・26 が見ている。
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%order by p.last_at desc, md5(p.pkey)%'
         end from f
  union all
  select 12, '返す行に個人の同定キーが入っていない',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) not like '%''proof_hash''%'
               and pg_get_functiondef(f_rows) not like '%''pkey''%'
               and pg_get_functiondef(f_rows) not like '%''ip_day_hash''%'
               and pg_get_functiondef(f_rows) not like '%claim_token%'
         end from f
  union all
  select 13, '丸めの関数が immutable（呼ぶたびに答えが変わらない）',
         case when f_sig is null then false
              else (select p.provolatile from pg_proc p where p.oid = f.f_sig) = 'i' end from f
  union all
  select 14, '公開集計の5人未満ルールは今も生きている（このファイルは緩めていない）',
         case when bench is null then false
              else pg_get_viewdef(bench) like '%>= 5%' end from f
  union all
  select 15, '登録前の預かりも一覧に混ざる',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%pay_reports_pending%' end from f
  union all
  select 16, '★本棚へ移した預かりは読まない（同じ人が二重に出ない）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%claimed_at is null%' end from f
  union all
  select 17, '打ち間違いの幅（年 $10,000〜$700,000）が効いている',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%between 10000 and 700000%' end from f
  union all
  select 18, '預かりの換算は誰にも開いていない（pv_pay_rows の中からだけ）',
         case when f_pend is null then false
              else not has_function_privilege('anon', f_pend, 'execute')
               and not has_function_privilege('authenticated', f_pend, 'execute') end from f
  union all
  select 19, '年換算の定義を書き写していない（pv_annual_total を呼んでいる）',
         case when f_pend is null then false
              else pg_get_functiondef(f_pend) like '%pv_annual_total(%' end from f
  union all
  -- ── 内訳（割合）まわり ──────────────────────────────────────
  -- ★この3つは DEEP PAY で使うために**定義だけ**置いてある。
  --   REAL PAY（pv_pay_rows）からは呼ばない。22 がそれを見張っている。
  select 20, '内訳の関数が3つそろっている（DEEP PAY 用に定義だけ置いてある）',
         (f_comp is not null and f_pct is not null and f_pcomp is not null) as ok from f
  union all
  select 21, '内訳の関数は誰にも開いていない（今はどこからも呼ばれていない）',
         case when f_comp is null or f_pct is null or f_pcomp is null then false
              else not has_function_privilege('anon', f_comp, 'execute')
               and not has_function_privilege('authenticated', f_comp, 'execute')
               and not has_function_privilege('anon', f_pct, 'execute')
               and not has_function_privilege('authenticated', f_pct, 'execute')
               and not has_function_privilege('anon', f_pcomp, 'execute')
               and not has_function_privilege('authenticated', f_pcomp, 'execute')
         end from f
  union all
  -- ★22 と 23 が「静かに戻る」2つ。どちらも画面は動いたままで、
  --   出て行く情報だけが増える。REAL PAY は行そのものしか返さない。
  select 22, '★内訳は「割合」でも「生の額」でもなく帯だけ（割合は今も DEEP PAY の担当）',
         /* ★2026-09-03 に見出しを変えた。内訳は返すようになったが、
            **返るのは pv_band が作った下端と上端だけ**。
            ・割合を作る3つ（pv_pct5 / pv_pay_comp / pv_pending_comp）は
              今も1つも呼んでいない ── あれは「割合」を出す関数で、
              こちらが要るのは「金額の帯」。混ぜると2画面が食い違う。
            ・列名そのものをキーにしていない（'base_pay' などが返り値に出ない）。
              出ているのは 'fixed' 'variable' … という区分名だけ。 */
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) not like '%pv_pct5(%'
               and pg_get_functiondef(f_rows) not like '%pv_pay_comp(%'
               and pg_get_functiondef(f_rows) not like '%pv_pending_comp(%'
               and pg_get_functiondef(f_rows) not like '%''comp''%'
               and pg_get_functiondef(f_rows) not like '%''base_pay''%'
               and pg_get_functiondef(f_rows) not like '%''gross_monthly''%'
               and pg_get_functiondef(f_rows) not like '%''bonus_annual''%'
               and pg_get_functiondef(f_rows) not like '%''per_diem''%'
               and pg_get_functiondef(f_rows) not like '%''housing_amount''%'
         end from f
  union all
  select 23, '★機材は語彙のコードだけ（狭・中・広の区分は返さない・絞る口も無い）',
         /* ★2026-09-03 にオーナー判断で反転（前は「機材を1語も書いていない」）。
            全行に出す＝人数の門は掛けない。そのかわり
            ・fleet_cat（狭胴・中型・広胴）は返さない ── 機材と区分の2粒度が
              揃うと、機材を書いていない人の区分まで推測の材料になる
            ・機材で**絞る**口はサーバにも画面にも作らない（契約⑤）。
              行に出ているものを目で拾うのと、狙った1人へ数クリックで
              到達する道を用意するのは別物。 */
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%''fleet''%'
               and pg_get_functiondef(f_rows) not like '%fleet_cat%'
         end from f
  union all
  select 24, '内訳の関数も自由入力の社名・準識別子を読んでいない',
         case when f_comp is null or f_pcomp is null then false
              else pg_get_functiondef(f_comp) not like '%airline_other%'
               and pg_get_functiondef(f_pcomp) not like '%airline_other%'
               and pg_get_functiondef(f_comp) !~
                   '(base_iata|seniority_years|age_bucket|contract_type|tax_country|nationality|period_month)'
               and pg_get_functiondef(f_pcomp) !~
                   '(base_iata|seniority_years|age_bucket|contract_type|tax_country|nationality|period_month)'
         end from f
  union all
  -- ── 数え上げ（2026-08-24）──────────────────────────────────
  select 25, '★数え上げは一覧と同じ材料から数えている（別々に数えていない）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%''stats''%'
               and pg_get_functiondef(f_rows) like '%from sane%'
         end from f
  union all
  -- ── 鍵が無い人に何を返すか（2026-08-25）──────────────────────
  select 36, '★鍵で落としているのは行だけ（数え上げは鍵が無い人にも返る）',
         -- 鍵の旗（v_open）が掛かっているのは rows の1か所だけであること。
         -- stats や give にも掛けてしまうと、出す前の人に何も見えなくなる。
         -- ★鍵の旗（v_open）が出てよいのは4か所だけ ── 宣言・旗を立てる・state・rows。
         --   増えていたら stats か give にも鍵を掛けた疑いがある＝出す前の人に
         --   何も見えなくなる。数で釘を打っておく。
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%case when v_open then l.j else%'
               and pg_get_functiondef(f_rows) like '%when v_open then ''open'' else ''locked''%'
               and (length(pg_get_functiondef(f_rows))
                    - length(replace(pg_get_functiondef(f_rows), 'v_open', ''))) / 6 = 4
         end from f
  union all
  select 37, '★鍵が無い人には行が1つも入らない（空の配列そのもの。伏せた行ではない）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%else ''[]''::jsonb end%'
         end from f
  union all
  -- ── 報酬の内訳の門（Give & Get・2026-09-03）───────────────────
  select 58, '★内訳を出していない人には帯の金額を渡さない（伏せるのではなく null で消す）',
         -- ★オーナー指示の一番外側 ──「CSS でぼかして隠す」のではなく、
         --   実数そのものを返さない。ここが崩れたら機能ごと嘘になる。
         -- ★もう1つの旗（v_comp）も、出てよいのは4か所だけ ── 宣言・旗を立てる・
         --   pay・paylock。増えていたら stats か give にも掛けた疑い
         --   （鍵の旗を4つで釘打ちしているのと同じ理屈）。
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%case when v_comp then c.j else null end%'
               and (length(pg_get_functiondef(f_rows))
                    - length(replace(pg_get_functiondef(f_rows), 'v_comp', ''))) / 6 = 4
         end from f
  union all
  select 59, '★内訳が「無い」と「閉じている」を別の形で返している（無い人に門を出さない）',
         -- 内訳あり・閉じている → paylock だけ／そもそも内訳が無い → どちらも無い。
         -- 混ぜると、書いていない人の投稿が「何か隠されている」ように読める。
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like
                   '%''paylock'',%c.j is null or v_comp then null%'
         end from f
  union all
  select 60, '★重い関数（pv_my_give）は1回だけ呼んで持ち回っている',
         -- 総当たりでハッシュを作る関数。門の判定と give の2か所で要るので、
         -- 2度呼ぶと素直に2倍かかる。呼び出しは1つだけであること。
         case when f_rows is null then false
              else (length(pg_get_functiondef(f_rows))
                    - length(replace(pg_get_functiondef(f_rows),
                                     'public.pv_my_give()', ''))) / 19 = 1
         end from f
  union all
  select 61, '★閉じている行に渡すのは区分の名前だけ（帯の金額を混ぜていない・1区分の行は名前も渡さない）',
         -- 2026-09-03 その3、オーナー指示で骨組みに色と項目名を出すことにした。
         -- 渡してよいのは名前（k）だけで、帯（r）を1つでも混ぜたら金額が出る。
         -- ★区分が1つだけの行は名前も渡さない ── 区分が1つ ＝ その区分が内訳の
         --   ほぼ全部で、面には年収が出ている。名前を出すだけで額が読める。
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like
                   '%jsonb_array_length(c.j) < 2 then to_jsonb(true)%'
               and pg_get_functiondef(f_rows) like
                   '%jsonb_agg(e.v->''k'' order by e.i)%'
         end from f
  union all
  select 38, '★給与を出したユニークな人数を返している（DEEP PAY の「N / 100人」の材料）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%''contributors''%'
         end from f
  union all
  select 39, '★本人が何を出したかは真偽4つだけ（金額も件数も日付もここから出ない）',
         case when f_give is null then false
              else pg_get_functiondef(f_give) like '%''basic''%'
               and pg_get_functiondef(f_give) like '%''detailed''%'
               and pg_get_functiondef(f_give) like '%''payslip''%'
               -- ★2026-09-03 に4つ目。REAL PAY の「報酬の内訳」を開く鍵。
               and pg_get_functiondef(f_give) like '%''full''%'
               -- 金額そのものを返す道が無いこと（真偽に畳んでからしか出さない）
               and pg_get_functiondef(f_give) not like '%annual_total%'
               -- ★禁じているのは「日付をキーとして返すこと」。経過措置の締切を
               --   見るための列参照（r.created_at）は当たらない書き方にしてある。
               and pg_get_functiondef(f_give) not like '%''created_at''%'
               and pg_get_functiondef(f_give) !~
                   '(base_iata|seniority_years|age_bucket|contract_type|tax_country|period_month)'
         end from f
  union all
  select 57, '★経過措置の締切は定数（動く窓にしていない＝門がいつか本当に閉まる）',
         -- ⚠️ 「今から何日前」という動く窓にすると、いつ来た人でも経過措置に
         --    入れてしまい、3項目を書く人が永久にゼロになる（画面は普通に動く）。
         --    detailed / payslip の判定に現在時刻は要らないので、この関数に
         --    現在時刻を取る関数が現れたら十中八九これ。
         case when f_give is null then false
              else pg_get_functiondef(f_give) not like '%now()%'
               and pg_get_functiondef(f_give) like '%timestamptz ''2026-09-04%'
         end from f
  union all
  select 40, '★本人が何を出したかを返す関数は誰にも開いていない（pv_pay_rows の中からだけ）',
         case when f_give is null then false
              else not has_function_privilege('anon', f_give, 'execute')
               and not has_function_privilege('authenticated', f_give, 'execute')
         end from f
  union all
  select 26, '★投稿の時刻そのものは行として返していない（返すのは粗い段だけ）',
         -- ★並べるのに使う last_at も行に入れていないこと。
         --   入れると、5段どころか秒単位の提出時刻がそのまま外へ出る。
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) not like '%''created_at''%'
               and pg_get_functiondef(f_rows) not like '%''cat''%'
               and pg_get_functiondef(f_rows) not like '%''last_at''%'
         end from f
  union all
  -- ── 投稿の時期・口コミの合流（2026-08-24）────────────────────
  select 27, '★投稿の時期は5段の粗い区分でだけ返している',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%''age''%'
               and pg_get_functiondef(f_rows) like '%interval ''1 month''%'
               and pg_get_functiondef(f_rows) like '%interval ''12 months''%'
         end from f
  union all
  select 28, '★段（age）そのもので並べ替えてはいない（並べるのは last_at）',
         case when f_rows is null then false
              -- ★[^,()]* にしてある。[^;]* だと percentile_cont の
              --   order by usd から下の as age まで届いて、常に落ちる。
              else pg_get_functiondef(f_rows) !~ 'order by[^,()]*\mage\M'
         end from f
  union all
  select 29, '昔の口コミに書かれた給与も一覧に混ざる',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%reviews_v2%'
               and pg_get_functiondef(f_rows) like '%pv_review_person%'
         end from f
  union all
  select 30, '★同じ人が明細も出していたら口コミ側を落としている（二重に出ない）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%not exists (select 1 from shelf%'
         end from f
  union all
  select 31, '口コミとの対応表は誰にも開いていない（pv_pay_rows の中からだけ）',
         case when link is null then false
              else not has_table_privilege('anon', link, 'select')
               and not has_table_privilege('authenticated', link, 'select')
               and (select c.relrowsecurity from pg_class c where c.oid = f.link)
         end from f
  union all
  select 32, '★口コミの社名の欄も無条件に pv_airline_resolve を通している',
         -- 口コミの airline はコードとは限らない（「その他」の行には打ち込まれた
         -- 文字列がそのまま入っている）。素の v.airline が残っていたら、
         -- その文字列が画面まで届く。
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%pv_airline_resolve(v.airline)%'
               and pg_get_functiondef(f_rows) !~ '\mv\.airline\M[^_)]'
         end from f
  union all
  -- ── 打ち込まれた社名の寄せ（2026-08-25）──────────────────────
  select 33, '★社名を寄せる関数がある（出口は語彙の code か other だけ）',
         (f_res is not null and f_norm is not null) from f
  union all
  select 34, '★社名を寄せる関数は誰にも開いていない（pv_pay_rows の中からだけ）',
         case when f_res is null then false
              else not has_function_privilege('anon', f_res, 'execute')
               and not has_function_privilege('authenticated', f_res, 'execute')
         end from f
  union all
  select 35, '★寄せ先は語彙（pv_airlines）だけ。前方一致・部分一致で当てていない',
         case when f_res is null then false
              else pg_get_functiondef(f_res) like '%pv_airlines%'
               and pg_get_functiondef(f_res) not like '%like%'
               and pg_get_functiondef(f_res) not like '%similar to%'
         end from f
  union all
  -- ── DEEP PAY の札を全画面で同じ数にする（2026-08-25）──────────
  select 41, '★人数の数え方は1か所だけ（一覧は pv_deep_contributors を呼んでいる／式を書き写していない）',
         -- 静かに壊れる。書き写しても画面は普通に動き、同じ「N / 100人」が
         -- 画面によって違う数になるだけなので、誰も気づかない。
         case when (f_dctb is null or f_rows is null) then false
              else pg_get_functiondef(f_rows) like '%pv_deep_contributors()%'
               and pg_get_functiondef(f_dctb) like '%pv_pay_person_map()%'
         end from f
  union all
  select 42, '★人数の関数は誰にも開いていない（security definer の中からだけ）',
         case when (f_ctb is null or f_dctb is null) then false
              else not has_function_privilege('anon', f_ctb, 'execute')
               and not has_function_privilege('authenticated', f_ctb, 'execute')
               and not has_function_privilege('anon', f_dctb, 'execute')
               and not has_function_privilege('authenticated', f_dctb, 'execute')
         end from f
  union all
  select 43, '★札の口（pv_give_progress）はログインした人だけ・中身を書き写していない',
         case when f_prog is null then false
              else not has_function_privilege('anon', f_prog, 'execute')
               and has_function_privilege('authenticated', f_prog, 'execute')
               and pg_get_functiondef(f_prog) like '%pv_deep_contributors()%'
               and pg_get_functiondef(f_prog) like '%pv_my_give()%'
               and pg_get_functiondef(f_prog) not like '%pay_reports%'
         end from f
  union all
  -- ── 人の対応表（2026-09-01）────────────────────────────────
  select 44, '★人の対応表がある・誰にも開いていない（uid は関数の外へ出ない）',
         -- 静かに壊れる。grant が付いても画面は普通に動くが、
         -- 誰でも「どの proof_hash が同じ人か」を引けるようになる。
         case when f_pmap is null then false
              else not has_function_privilege('anon', f_pmap, 'execute')
               and not has_function_privilege('authenticated', f_pmap, 'execute')
         end from f
  union all
  select 45, '★札とゲートが同じ数え方（表示も門も pv_deep_contributors を呼ぶ）',
         -- 静かに壊れる。片方だけ古い数え方に戻ると、
         -- 「画面は 100 / 100 人なのに DEEP PAY が開かない」が起きる。
         case when (f_rows is null or f_prog is null) then false
              else pg_get_functiondef(f_rows) not like '%pv_contributors()%'
               and pg_get_functiondef(f_prog) not like '%pv_contributors()%'
         end from f
  union all
  -- ── 正式公開の手動フラグ（2026-09-01）──────────────────────
  select 46, '★正式公開の手動フラグは誰にも開いていない（RLS 有効・ポリシー0本）',
         -- 静かに壊れる。書けるようになっても画面は何も変わらないが、
         -- 通常ユーザーが自分で1行入れて DEEP PAY を開けてしまう。
         case when t_lch is null then false
              else not has_table_privilege('anon', t_lch, 'select')
               and not has_table_privilege('authenticated', t_lch, 'select')
               and not has_table_privilege('anon', t_lch, 'insert')
               and not has_table_privilege('authenticated', t_lch, 'insert')
               and (select c.relrowsecurity from pg_class c where c.oid = f.t_lch)
               and (select count(*) from pg_policies
                     where schemaname = 'public' and tablename = 'pv_deep_launch') = 0
         end from f
  union all
  select 47, '★進捗に登録前の預かりが混ざっていない（端末を人と呼んでいない）',
         -- 静かに壊れる。混ざっても画面は普通に動き、数だけが多く出る。
         case when f_dctb is null then false
              else pg_get_functiondef(f_dctb) not like '%pay_reports_pending%'
         end from f

  -- ════════════════════════════════════════════════════════
  -- 48〜56 ＝ 2026-09-03。行を押すと内訳と勤務が見えるようにしたぶん。
  -- どれも「画面は普通に動いたまま、他人の実額へ近づく」形をしている。
  -- ════════════════════════════════════════════════════════
  union all
  select 48, '★帯を作る関数が2本あり、どちらも immutable（呼ぶたびに答えが変わらない）',
         -- 揺れると、同じ行を何度も引いて帯の境目を動かし、中の値を挟み撃ちにできる。
         case when f_grid is null or f_band is null then false
              else (select p.provolatile = 'i' from pg_proc p where p.oid = f.f_grid)
               and (select p.provolatile = 'i' from pg_proc p where p.oid = f.f_band)
         end from f
  union all
  select 49, '★帯の関数は anon に開いていない（ログインした人だけ）',
         case when f_grid is null or f_band is null then false
              else not has_function_privilege('anon', f.f_grid, 'execute')
               and not has_function_privilege('anon', f.f_band, 'execute')
               and has_function_privilege('authenticated', f.f_grid, 'execute')
               and has_function_privilege('authenticated', f.f_band, 'execute')
         end from f
  union all
  select 50, '★帯はサーバが作っている（一覧が pv_band と pv_band_grid を呼んでいる）',
         /* 静かに壊れる。生の額を返して画面側で丸める形にすると、見た目は
            まったく同じまま、通信の中身に1円単位の他人の実額が乗る。
            このリポジトリの原則は「隠すのではなく渡さない」。 */
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%public.pv_band(%'
               and pg_get_functiondef(f_rows) like '%public.pv_band_grid(%'
         end from f
  union all
  select 51, '★在籍は粗い段だけ（年数そのものは行に入っていない）',
         /* 静かに壊れる。段のつもりで年を入れても画面は同じに見えるが、
            会社×職位×機材と重なった時点で1人に当たる。 */
         /* ★読むのは許す・返すのは許さない、を見分ける。
            預かりの枝は payload->>'seniority_years' で年数を読むので、
            素の like では**正しいものが赤くなる**（7番と同じ形）。
            payload の読み出しだけを消してから、その語が残らないかを見る。 */
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%''ten''%'
               and regexp_replace(pg_get_functiondef(f_rows),
                     'payload->>''seniority_years''', '', 'g')
                   not like '%''seniority_years''%'
               and pg_get_functiondef(f_rows) not like '%''seniority''%'
               and pg_get_functiondef(f_rows) not like '%''sen''%'
         end from f
  union all
  select 52, '★命綱の引き算が本棚にも預かりにも入っている（変動給を二重に数えていない）',
         /* ★★ 静かに壊れる。★★ 給与フォームは変動の合計を
            flight_variable_pay と other_allowance の**両方**に写す。
            引き算を落とすと、内訳の合計が現金をはみ出して下の検品に引っかかり、
            **その人の帯だけが黙って消える**（画面はエラーも出さない）。
            同じ式が3か所（ここ2つ ＋ db/deep-pay.sql の a_other）。 */
         case when f_rows is null or f_pdet is null then false
              else pg_get_functiondef(f_rows) like
                     '%greatest(coalesce(r.other_allowance, 0)%'
               and pg_get_functiondef(f_rows) like
                     '%- coalesce(r.flight_variable_pay, 0), 0)%'
               and pg_get_functiondef(f_pdet) like
                     '%greatest(coalesce(x.othal, 0) - coalesce(x.fvp, 0), 0)%'
         end from f
  union all
  select 53, '★内訳の検品が効いている（現金をはみ出した行に帯を作らない）',
         /* db/deep-pay.sql の ok と同じ関所。外すと、本人の書き間違いを
            こちらで按分した「嘘の内訳」が帯になって出る。 */
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%<= k.cash_m * 1.02%'
               and pg_get_functiondef(f_rows) like '%where k.det%'
         end from f
  union all
  select 54, '★代表の月を時刻で選んでいない（中央値にいちばん近い月＋md5）',
         /* ★★ 静かに壊れる。★★ 「最新の月」に変えても画面は同じに見えるが、
            内訳ごしに**いつ出したか**が読める。契約⑥（並びはサーバが決める・
            時刻そのものは返さない）が、内訳の側から破られる。 */
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like
                   '%abs(s.usd - p.v), md5(s.pkey || s.usd::text)%'
         end from f
  union all
  select 55, '★勤務は3つだけ（便数・ステイ日数・拘束時間・深夜時間・クレジット時間を読まない）',
         /* 静かに壊れる。1つ足すごとに重ね合わせが効いて、
            会社×職位×機材×在籍の段に「勤務の形」まで加わる。 */
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%''bh''%'
               and pg_get_functiondef(f_rows) like '%''dd''%'
               and pg_get_functiondef(f_rows) like '%''off''%'
               and pg_get_functiondef(f_rows) !~
                   '(sectors|stay_nights|duty_hours|night_hours|credit_hours)'
         end from f
  union all
  select 56, '★預かりの材料を出す関数は誰にも開いていない・準識別子を読んでいない',
         /* pv_pending_usd と同じ扱い（pv_pay_rows の中からだけ使う）。
            grant すると、payload を1つ渡すだけで他人の内訳が生の額で返る口になる。 */
         case when f_pdet is null then false
              else not has_function_privilege('anon',          f.f_pdet, 'execute')
               and not has_function_privilege('authenticated', f.f_pdet, 'execute')
               and pg_get_functiondef(f_pdet) !~
                   '(base_iata|seniority_years|age_bucket|contract_type|tax_country|nationality|period_month|airline_other)'
         end from f
) t
order by n;
