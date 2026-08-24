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
-- ★これで匿名性がどこまで落ちたか（正直に書いておく）
--   出るのは会社と職位だけ。それでも「うちの機長は3人しか居ない」が成り立つ規模なら、
--   候補はそこまで絞れる。**これは承知のうえで選んだ形。**
--   したがってこの設計を支えているのは、いま次の7つだけ。
--
--     ① 鍵         給与明細を1枚出した人だけ・90日（サーバ側。anon には開かない）
--     ② 準識別子ゼロ 機材・基地・在籍年数・年代・原本通貨・契約形態・国籍・
--                   レポートID・提出日そのものは1つも返さない（列にも group by にも入れない）。
--                   支給の内訳も返さない（内訳は DEEP PAY の担当）。
--                   ★2026-08-24、ここだけ1段ゆるめた。投稿の「時期」を
--                     5段の粗い区分で返す（下の「★投稿の時期について」）
--     ③ 有効数字2桁  $183,456 は $180,000 として出る。1円まで一致する個票が存在しない
--     ④ 1行＝1人    同じ人の複数月は年換算の中央値で1行に畳む（回数から常連が割れない）
--     ⑤ 引数ゼロ    総当たりで区分を指定して引く面が無い
--     ⑥ 並びに時間が無い md5(人のキー) 順。投稿順に並べない
--     ⑦ 常識の幅    年 $10,000 未満／$700,000 超は出さない（下の「⑦とは何か」）
--
--   ③を外すと個票そのものになる。④を外すと出した回数が漏れる。
--   **この7つは1つも外さないこと。**
--
-- ★数え上げについて。2026-08-24 オーナー判断で**出すことにした**。
--   画面の上に4枚の数字が並ぶ：
--     ・給与を出したパイロット … 表の行数（画面が rows を数える。ここは前から数えれば分かった）
--     ・実給与の投稿           … ★stats.reports（新しく外へ出る）
--     ・航空会社               … 表に出ている会社の数（同上、前から分かった）
--     ・今月の新規投稿         … ★stats.month（新しく外へ出る）
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
--     「今どれだけ集まっているか」と「今月どれだけ増えたか」の2つ。
--     会員数そのものではない（出していない会員は1も足されない）。
--     契約①〜⑦は**1つも外していない**。
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
--   ★契約⑥（並びに時間が無い）は**外していない**。
--     並びは今も md5(人のキー) 順で、段で並べ替える口も、段で絞る口も作らない。
--     段で並べ替えられると、それは実質「投稿順の並び」になる（＝誰が最近出したか）。
--     5段しか無いので、同じ段の中の順序は今までどおり md5 のまま何も語らない。
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
-- ★内訳（支給の割合）について。2026-08-24 にいったん入れて、同じ日に外した。
--   「行を選ぶとその人の支給の内訳が円グラフで見える」形にしてみたが、
--   オーナー判断でマイページを3枚に分けることになり、
--   「この給与は何で構成されているか」は **DEEP PAY が複数の投稿を集計して**見せる、
--   と役割が決まった。1人ずつの内訳を返すのは REAL PAY の仕事ではない。
--   ＝ ここは内訳を1つも返さない。②は「準識別子ゼロ」のまま守られている。
--
--   ★pv_pay_comp / pv_pct5 / pv_pending_comp の3つは**定義だけ残してある**
--     （DEEP PAY で使う）。誰にも grant していないので、今は誰からも呼べない。
--     pv_pay_rows からは呼ばない。自己点検 22 がそれを見ている。
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
--   ・②の列を1つでも返り値に足すこと
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
             x.bonus_a, x.profit, x.bonus_m
           ) * r.to_usd, 2)
    from (
      select nullif(nullif(p->>'gross_monthly', '')::numeric, 0) as gross,
             nullif(p->>'base_pay',            '')::numeric      as base,
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
--     内訳の行     … m = 12×(基本給 + 時給×max(実績,保証))
--                     o = 12×(交通費 + 機長手当 + その他手当)
--     どちらも      b = 年1回の賞与 + 利益分配
--                     d = 12×パーディアム
--                     h = 12×住宅手当（現物支給の社宅は現金ではないので入れない）
--   5本の合計は pv_annual_total の返り値と一致する。
--   ズレていないことは db/test-pay-rows.mjs が毎回突き合わせている。
--
-- ★返すのは「割合」（合計1）であって額ではない。通貨に依らないので、
--   月ごとに通貨が違う人が居ても、そのまま平均できる。
--
-- ★引数の並びは pv_annual_total と1文字も違わない。呼ぶ側が並べ違えないため。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_pay_comp(
  p_gross_monthly    numeric,
  p_base_pay         numeric, p_hourly_rate numeric, p_guaranteed_hours numeric,
  p_block_hours      numeric, p_per_diem    numeric,
  p_housing_type     text,    p_housing_amount numeric,
  p_transport        numeric, p_command_pay numeric, p_other_allowance numeric,
  p_bonus_annual     numeric, p_profit_share_annual numeric,
  p_bonus_month      numeric default null
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
                            + coalesce(p_other_allowance, 0))
            end as o
        ) y
    ) x;
$$;

revoke all on function public.pv_pay_comp(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric) from public, anon, authenticated;

comment on function public.pv_pay_comp(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric) is
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
           x.bonus_a, x.profit, x.bonus_m
         )
    from (
      select nullif(nullif(p->>'gross_monthly', '')::numeric, 0) as gross,
             nullif(p->>'base_pay',            '')::numeric      as base,
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
-- 2. pv_pay_rows — 匿名レポート一覧（1行＝1人・出した人は全員）
--
-- 返り値
--   { ok:true, state:'locked', rows:[] }   鍵が無い／切れている
--   { ok:true, state:'open',   rows:[ … ], stats:{ reports, month } } 鍵がある
--
-- stats（2026-08-24 に足した。理由はファイル冒頭「★数え上げについて」）
--   reports … 提出の件数。同じ人の複数月もそれぞれ1件（＝ rows の数より必ず多いか同じ）
--   month   … そのうち今月に入ったぶん
--   ★どちらも rows を作ったのと同じ材料（下の sane）から数える。
--     別々に数えると「126件なのに表は60行」の説明がつかなくなる。
--   ★鍵が無いときは stats ごと返さない（数字も鍵の内側）。
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
  v_out   jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select p.access_until into v_until from public.profiles p where p.id = v_uid;

  -- ★ここで raise しない。投げると画面がエラー表示になり、
  --   「1枚出せば開く」という肝心の伝え方ができなくなる。
  if v_until is null or v_until <= now() then
    return jsonb_build_object('ok', true, 'state', 'locked', 'rows', '[]'::jsonb);
  end if;

  with shelf as (
    -- ── ① 本棚（会員が出したぶん）──────────────────────────
    -- ★ここで選んだ列がすべて。増やす前に必ずファイル冒頭の②を読む。
    --   自由入力の社名の列は、ここにも下にも1度も出てこない（読まない）。
    --   ★この行に列名そのものを書かないこと。自己点検8が「読んでいる」と誤検知する。
    --   ★最後の1列は「いつ出されたか」。数を数えるためと、粗い段（下の age）を
    --     出すためだけに持つ。日付そのものは行として返さない・並べ替えにも
    --     使わない（契約⑥）。自己点検 26 が見ている。
    select 'r:' || r.proof_hash as pkey,
           r.airline            as airline,
           r."position"         as pos,
           r.annual_total_usd   as usd,
           (r.verify_level >= 1) as vf,
           r.created_at         as cat
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
    --     payload の中には自由入力の社名も居るが、pv_pending_usd は金額の欄しか見ない。
    select 'p:' || q.ip_day_hash,
           q.airline,
           q.payload->>'position',
           public.pv_pending_usd(q.payload),
           false,
           q.created_at
      from public.pay_reports_pending q
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
    select l.pkey,
           v.airline,
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
           v.created_at
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
                else 4 end as age
      from sane
     group by pkey, airline, pos
  ),
  listed as (
    select coalesce(jsonb_agg(jsonb_build_object(
             'airline',    p.airline,
             'pos',        p.pos,
             'annual_usd', public.pv_sig2(p.v),
             'verified',   p.verified,
             'age',        p.age
           -- ★並びに時間を入れないこと。投稿順に並べると、並び順そのものが
           --   「誰が最近出したか」になる（外した30日の遅延より悪い）。
           --   md5 なので毎回同じ並びで、しかも中身とも関係が無い。
           --   人のキーそのものは返さない（並べるためだけに使う）。
           ) order by md5(p.pkey)), '[]'::jsonb) as j
      from person p
  ),
  tally as (
    -- ★数え上げ。**必ず sane から数える**（＝行と同じ材料。同じ幅・同じ期間・
    --   同じ「移した預かりは読まない」）。別の場所から数え直すと、画面の
    --   「◯件」と表の行数の関係が説明できなくなる。
    --   ここで数えるのは件数だけで、誰がいつ出したかは1つも外へ出ない。
    select count(*)::int as reports,
           count(*) filter (where cat >= date_trunc('month', now()))::int as mo
      from sane
  )
  select jsonb_build_object(
           'ok',    true,
           'state', 'open',
           'rows',  l.j,
           'stats', jsonb_build_object('reports', t.reports, 'month', t.mo)
         )
    into v_out
    from listed l cross join tally t;

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
  '並びは md5(人のキー) 順で投稿順ではない。'
  '2026-08-24 から stats（提出の件数・今月のぶん）も返す。行と同じ材料から数える。'
  '★引数を取らない＝他人の区分を狙って引く面が無い。'
  '★鍵は給与明細の access_until のみ。口コミの鍵では開かない。';


-- ════════════════════════════════════════════════════════════════
-- 3. 自己点検（読むだけ。何も書き換えない）
--
-- ★1本の SELECT にしてある。Supabase の SQL Editor は複数文を流すと
--   最後の1本の結果しか出さないので、分けて書くと上から順に消えていく。
-- 期待：32行すべて ✅。1つでも ❌ なら、そこが効いていない。
--
-- 特に 4・8・12・13・14・16・22・23・30・31 は「静かに壊れる」種類のもの。画面には何も
-- 出ないまま、他人の個票に届く経路が開く（16・30 は逆に、同じ人が二重に出る）。
-- ════════════════════════════════════════════════════════════════
with f as (
  select to_regprocedure('public.pv_pay_rows()')       as f_rows,
         to_regprocedure('public.pv_sig2(numeric)')    as f_sig,
         to_regprocedure('public.pv_pending_usd(jsonb)') as f_pend,
         to_regprocedure('public.pv_pct5(numeric[])')    as f_pct,
         to_regprocedure('public.pv_pending_comp(jsonb)') as f_pcomp,
         to_regprocedure('public.pv_pay_comp(numeric,numeric,numeric,numeric,numeric,'
                         || 'numeric,text,numeric,numeric,numeric,numeric,numeric,'
                         || 'numeric,numeric)')          as f_comp,
         to_regclass('public.pay_benchmarks')          as bench,
         to_regclass('public.pv_review_person')        as link
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
  select 7, '自由入力の社名は読んでも返してもいない（一覧・預かりの換算とも）',
         case when f_rows is null or f_pend is null then false
              else pg_get_functiondef(f_rows) not like '%airline_other%'
               and pg_get_functiondef(f_pend) not like '%airline_other%' end from f
  union all
  select 8, '準識別子を1つも読んでいない（基地・在籍年数・年代・投稿月・国籍・契約・税・原本通貨）',
         case when f_rows is null or f_pend is null then false
              else pg_get_functiondef(f_rows) !~
                   '(base_iata|seniority_years|age_bucket|contract_type|tax_country|nationality|annual_total_orig|period_month)'
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
  select 11, '並びに時間が入っていない（md5 順・投稿順ではない）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%order by md5(%'
               and pg_get_functiondef(f_rows) !~ 'order by[^;]*created_at'
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
  select 22, '★REAL PAY は支給の内訳を1つも返していない（内訳は DEEP PAY の担当）',
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
  select 23, '★REAL PAY は機材を返していない（列にも group by にも無い）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) not like '%fleet%' end from f
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
  select 26, '★投稿の時刻そのものは行として返していない（返すのは粗い段だけ）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) not like '%''created_at''%'
               and pg_get_functiondef(f_rows) not like '%''cat''%'
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
  select 28, '★時期で並べ替えていない（並びは今も md5 順のまま）',
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
  select 32, '口コミ側も自由入力の社名は読んでいない（打ち込まれた文字列は識別子）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) not like '%airline_other%' end from f
) t
order by n;
