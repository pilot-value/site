-- ════════════════════════════════════════════════════════════════════════
-- db/deep-pay.sql — DEEP PAY（給与の中身を集計して見る画面）のサーバ側
--
-- 貼る順番：db/pay-reports.sql → db/pay-rows.sql → **このファイル**
--   （pv_sig2 / pv_my_give / pv_deep_contributors / pv_pay_person_map を使う）
--
-- ════════════════════════════════════════════════════════════════════════
-- この画面が答えるのは5つだけ。
--   ① この会社・この役職はいくらもらうのか
--   ② そのうち固定はどれくらいで、変動はどれくらいか
--   ③ どれだけ働いてその額なのか
--   ④ 変動給は何で増えているのか
--   ⑤ この数字はどれくらい信じてよいのか
--
-- ★ REAL PAY（pv_pay_rows）は「1行＝1人」を返す。こちらは**1人も返さない。**
--   返すのは区分（cohort）ごとに束ねた中央値と割合だけ。
--   ★2026-10-11 から、**その区分に何人いるかも返さない**（オーナー判断）。
--     隠すのではなく、最初から渡さない。画面に渡すのは信頼度の3段（cohort.trust）だけ。
--
-- ★2026-10-11、このファイルに関数を2つ足した。
--     pv_deep_step      … 見出しの数字を刻みに寄せる小さな道具（2-b 章・誰にも開かない）
--     pv_deep_missing   … その1行で、まだ答えていない項目を返す（2-c 章・誰にも開かない）
--                         ＝「見る資格」の線。pv_deep_pay の門がこれを読む（約束①）。
--
-- ════════════════════════════════════════════════════════════════════════
-- 守っている約束（db/pay-rows.sql の①〜⑦をこの画面の形に写したもの）
--
--   ① Give → Get   鍵（access_until）と、本人が**答えきっていること**（ready）の
--                  両方が要る。REAL PAY より深い画面が、より弱い鍵で開いてはいけない。
--                  ★2026-10-11（オーナー判断）、本人の側の条件を上げた。
--                    前 … 内訳が1つでもある（pv_my_give の detailed）
--                    今 … 自分に当てはまる項目を**ぜんぶ**答えた月が、直近24か月に
--                         1つ以上ある（pv_deep_missing が空を返す行。2-c 章）
--                    給与フォームは1文字も変えていない。線を引くのはこの画面の側だけで、
--                    材料は保存されている行だけ。足りない人には、残っている項目を返して
--                    今のフォームへ送る（gate.todo）。
--                  ★同じ日（オーナー判断「3つとも答えている人はそのまま開く」）、
--                    **公開より前から居た人**の決まりを1つ足した ──
--                    DEEP PAY を公開する**より前に**、基本給／保証手当・職務手当／変動給
--                    （何に連動する支給かまで）の3つに答えていた人は、残りを埋めなくても
--                    開いたまま（pv_deep_pay の v_old。境目は定数 v_launch の1か所）。
--                    それ以外の人と、公開から先に出す行（出し直しも）は、ぜんぶ答えること。
--                    （その前は、ここに「まだ誰も使っていないので経過措置は無い」と書いていた。
--                      線だけ上げると、公開の日に開く人が居ない ── 線のうち3つ（乗務日数・
--                      職位手当・プロフィットシェア）が、給与フォームでは任意の「＋」の先に在る。）
--                  ⚠️ 上がったのは**見る**側だけ。**数えられる**側（区分の頭数）は
--                     今までどおり「内訳を書いた人」（3章の det）。
--                     見る線のほうが、数えられる線より高い。そろえないこと。
--   ② 割合で返す    内訳は**割合**が主。金額は「画面に出ている丸めた年収 × 割合」でしか
--                  作れない形にする。1人ずつの実額を組み立てられないようにするため。
--   ③ 丸めて返す    1円まで合う数字は個票の証拠になる。**丸める前の中央値は1つも返さない。**
--                  ★2026-10-11 から、丸め方は2通り（オーナー判断）──
--                    ・見出しの2つだけは**刻み**に寄せる（pv_deep_step）。
--                        年収の中央値       … $50 刻み （円でおよそ ¥8,000）
--                        Pay / Block Hour  … $0.5 刻み（円でおよそ ¥80）
--                      前はこの2つも有効数字2桁だった（$148,140 → $150,000）。
--                      刻みにしたので、画面が 万円の位・¥100 の位まで出せる。
--                    ・それ以外の金額（給与構成の月額）は今までどおり pv_sig2
--                      ＝有効数字2桁。**こちらは細かくしていない。**
--                  ⚠️ 刻みをこれ以上細かくしない。細かくするほど、少人数の区分で
--                     「中央値からその人の実額を割り戻す」幅が狭くなる。
--   ④ 1行＝1人      proof_hash で束ねてから中央値を取る。同じ人の6か月分は1人。
--   ⑤ 語彙の中だけ  pv_deep_pay(p jsonb) は会社・役職・機材を受け取る。
--                  ★2026-08-30 に引数ゼロから変えた。初めは「呼んだ本人の区分」しか
--                    出さなかったが、REAL PAY（pv_pay_rows）が既に**全社の行**を
--                    見せている以上、DEEP PAY だけ自分の区分に閉じているのは
--                    筋が通らない（オーナー判断）。
--                  引数が増えたぶんは、この2つで守る ──
--                    (a) 受け取った値は pv_airlines / pv_positions / pv_fleets に
--                        **在るものだけ**通す。無い値は空を返す。知らない値を
--                        「広い区分」に読み替えない。読み替えると、打ち間違いに
--                        別の区分の数字が出て、読み手はそれと気づけない。
--                    (b) 手で選んだ区分は**はしごを登らない**。人数の壁（v_min。
--                        3章の頭を読む）に届かなければそのまま「まだ出せません」。
--                        広い区分の数字を、狭い区分の見出しのまま出すことをしない。
--                  人数の壁は誰が選んでも同じに掛かる。引数では緩められない。
--   ⑥ 準識別子ゼロ  投稿月・作成日時・proof_hash・自由入力の社名・年代・在籍年数は
--                  返さない。返すのは会社・役職・機材（＝選んだ本人が渡した値、
--                  または呼んだ本人が既に知っている自分の値）だけ。
--                  ★2026-10-11 から、1つだけ月を返す所がある ── gate.todo の
--                    year / month。**呼んだ本人自身の**直近1行の対象月で、
--                    「どの月の、どの項目が残っているか」を本人に言うためのもの。
--                    他人の月は今も1つも返さない（集計の側はどこも月を持たない）。
--   ⑦ 常識の幅      年 $10,000〜$700,000 の外は数えない。
--
-- ════════════════════════════════════════════════════════════════════════
-- ★★ pv_pay_comp / pv_pct5 / pv_pending_comp（db/pay-rows.sql 3章）は使わない。★★
--
--   あちらの頭に「DEEP PAY を作る回に内訳優先へ直すこと」と書いてあるが、直さなかった。
--   理由は3つで、どれも直すほうが危ない。
--
--     1. assert-pay-rows.mjs が pv_pay_comp の**本文を切り出して grep している**。
--        本文を1行変えるとあの検査が落ちる。
--     2. db/pay-rows.sql の自己点検が **20個の型を並べた署名文字列**で
--        to_regprocedure している。引数を1つ増やすと null になって❌になる。
--     3. そもそも5バケツ {m,b,d,h,o} では、この画面が要る9区分を表現できない。
--        あちらは**年額・賞与込み**、こちらは**月額・賞与抜き**。分母も分子も別物。
--
--   だから pv_pay_comp は**1バイトも触らず、誰からも呼ばれないまま**残す。
--   ⚠️ 将来ここを「共通化」したくなっても、あちらを配線しないこと。
--      同じ数字を2か所で計算していたのが、あの o = 0 のバグが誰にも気づかれずに
--      残った理由そのもの。
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 1. pv_my_keys — 呼んだ本人の proof_hash を作り直す
--
-- pv_my_give()（db/pay-rows.sql 1-e）の中に同じ式が埋まっているが、
-- あちらは language sql で本文の中に閉じていて切り出せない。**写しが2つある。**
-- 片方を直したらもう片方も直すこと。db/test-deep-pay.mjs が
-- 「2つが同じ人の行を拾う」ことを検査して固定している。
--
-- 引き方は my_pay_reports()（db/pay-reports.sql 5-b）と同じ。**式を変えないこと。**
-- ★誰にも grant しない。security definer の中からだけ呼ぶ。
-- ════════════════════════════════════════════════════════════════
drop function if exists public.pv_my_keys();

create or replace function public.pv_my_keys()
returns setof text
language sql
security definer
stable
set search_path = public, extensions
as $fn$
  -- 一覧から選んだ会社：コードは有限なので総当たりでハッシュを作れる
  select encode(extensions.digest(
           auth.uid()::text || '::pv_pay::' || a.code, 'sha256'), 'hex')
    from public.pv_airlines a
   where auth.uid() is not null
  union
  -- 「一覧にない会社」：ハッシュに自由入力の社名が入っているので総当たりでは
  -- 引けない。実在する社名だけを候補にして作り直す。ここで他人の書いた社名を
  -- 読むが、使うのはハッシュの材料としてだけで、関数の外へは1文字も出ない。
  select encode(extensions.digest(
           auth.uid()::text || '::pv_pay::other::' || o.nm, 'sha256'), 'hex')
    from (select distinct lower(airline_other) as nm
            from public.pay_reports
           where airline = 'other' and airline_other is not null) o
   where auth.uid() is not null;
$fn$;

revoke all on function public.pv_my_keys() from public, anon, authenticated;

comment on function public.pv_my_keys() is
  '呼んだ本人の pay_reports.proof_hash を作り直して返す。'
  'pv_my_give() の中の同じ式の写し（あちらは切り出せない）。両方を同時に直すこと。'
  '★誰にも grant しない。pv_deep_pay() の中からだけ呼ぶ。';


-- ════════════════════════════════════════════════════════════════
-- 2. pv_deep_pct — 割合の配列を「合計ちょうど100」の整数にする
--
-- 中央値をそれぞれ取ると合計は100にならない（別々の人の中央値なので当然）。
-- そのまま出すと「62 + 20 + 8 + 5 + 3 + 2」が100にならず、
-- 読む人が数え直して「壊れている」と思う。最大剰余法で配る。
--
-- pv_pct5（db/pay-rows.sql 3-b）を n 個に一般化したもの。
-- ★pv_pct5 そのものは触らない（署名が db/pay-rows.sql の自己点検で固定されている）。
--
-- 入力は割合の配列（合計は1でなくてよい）。null と負は 0 として扱う。
-- 出力は同じ長さの整数配列。全部 0 なら null を返す（＝画面は描かない）。
-- ★誰にも grant しない。
-- ════════════════════════════════════════════════════════════════
drop function if exists public.pv_deep_pct(numeric[]);

create or replace function public.pv_deep_pct(p numeric[])
returns int[]
language plpgsql
immutable
as $fn$
declare
  n     int := coalesce(array_length(p, 1), 0);
  tot   numeric := 0;
  i     int;
  v     numeric;
  out_a int[] := '{}';
  frac  numeric[] := '{}';
  sum_i int := 0;
  rest  int;
  bi    int;
  bf    numeric;
  live  boolean;
begin
  if n = 0 then return null; end if;

  for i in 1 .. n loop
    tot := tot + greatest(coalesce(p[i], 0), 0);
  end loop;
  if tot <= 0 then return null; end if;

  -- 100 を掛けて整数部と小数部に分ける
  for i in 1 .. n loop
    v := greatest(coalesce(p[i], 0), 0) / tot * 100;
    out_a := out_a || floor(v)::int;
    frac  := frac  || (v - floor(v));
    sum_i := sum_i + floor(v)::int;
  end loop;

  rest := 100 - sum_i;

  -- 余りを、小数部の大きい区分から1ずつ配る（最大剰余法）
  while rest > 0 loop
    bi := 0; bf := -1;
    for i in 1 .. n loop
      if frac[i] > bf then bf := frac[i]; bi := i; end if;
    end loop;
    exit when bi = 0;                 -- ありえないが、無限ループにしない
    out_a[bi] := out_a[bi] + 1;
    frac[bi]  := -1;                  -- 同じ区分に二度配らない
    rest := rest - 1;

    -- 配り切る前に候補が尽きたら、いちばん大きい区分へ残りを寄せる
    if rest > 0 then
      live := false;
      for i in 1 .. n loop
        if frac[i] >= 0 then live := true; end if;
      end loop;
      if not live then
        bi := 1;
        for i in 1 .. n loop
          if out_a[i] > out_a[bi] then bi := i; end if;
        end loop;
        out_a[bi] := out_a[bi] + rest;
        rest := 0;
      end if;
    end if;
  end loop;

  return out_a;
end;
$fn$;

revoke all on function public.pv_deep_pct(numeric[]) from public, anon, authenticated;

comment on function public.pv_deep_pct(numeric[]) is
  '割合の配列を、合計ちょうど100の整数％にする（最大剰余法）。'
  'pv_pct5 を n 個に一般化したもの。★誰にも grant しない。';


-- ════════════════════════════════════════════════════════════════
-- 2-b. pv_deep_step — 金額を「刻み」のいちばん近い倍数に寄せる（2026-10-11）
--
--   148140 を 50 刻みで → 148150      92.59 を 0.5 刻みで → 92.5
--
-- 使うのは pv_deep_pay の**見出しの2つだけ**（年収の中央値＝$50・
-- Pay / Block Hour＝$0.5）。なぜこの2つだけ刻みなのかは、ファイル冒頭の約束③。
-- ★pv_sig2（db/pay-rows.sql）は触っていない。あちらは REAL PAY の1行＝1人の額を
--   丸めている道具で、桁を増やすと個票の証拠になる。**あちらに刻みを持ち込まない。**
-- ★null と 0 以下は null（pv_sig2 と同じ。0 を置いて埋めない）。
-- ★刻みは呼ぶ側が定数で渡す。利用者の入力から刻みを決める道を作らないこと
--   （刻みを 0.01 にされれば、丸めていないのと同じになる）。
-- ★誰にも grant しない。security definer の中からだけ呼ぶ。
-- ════════════════════════════════════════════════════════════════
drop function if exists public.pv_deep_step(numeric, numeric);

create or replace function public.pv_deep_step(v numeric, p_step numeric)
returns numeric
language sql
immutable
as $fn$
  select case when v is null or v <= 0 then null
              else round(v / p_step) * p_step
         end;
$fn$;

revoke all on function public.pv_deep_step(numeric, numeric) from public, anon, authenticated;

comment on function public.pv_deep_step(numeric, numeric) is
  '金額を刻み（p_step）のいちばん近い倍数に寄せる。null と 0 以下は null。'
  'pv_deep_pay の見出しの2つ（年収の中央値＝$50・Pay / Block Hour＝$0.5）だけが使う。'
  '★誰にも grant しない。pv_sig2 の代わりではない（あちらは触っていない）。';


-- ════════════════════════════════════════════════════════════════
-- 2-c. pv_deep_missing — その1行で、まだ答えていない項目を返す（2026-10-11）
--
-- ★オーナー判断（2026-10-11）──
--   「DEEP PAY は、自分に当てはまる項目を**ぜんぶ**答えた人にだけ開く」。
--   ★給与フォームは変えていない（必須を1つも増やしていない）。線はこの画面の側だけ。
--   ★材料は**保存されている行**だけ。画面の状態も、送られてきた payload も見ない。
--   ★**この関数（線そのもの）に、経過措置は入れていない。** いつ出した行にも同じ読み方をする
--     （出した時刻を見ない）。公開より前から居た人を通す決まり（2026-10-11・オーナー判断
--     「3つとも答えている人はそのまま開く」）は**門の側**に在る ── pv_deep_pay の v_old が、
--     ここの答えに base / guarantee / variable の3つが残っていないかを読むだけ。
--     ⚠️ だから、この3つのコードの字と意味を変えるときは、あちらも一緒に見る。
--
-- 返り値  未回答の項目コードの配列。**並びは固定**（下の表の順）。空配列＝答えきった行。
--          金額も日付も返さない。分かるのは「どの欄が空か」だけ。
--
--   コード       答えたと数える条件（列 ／ pay_items の鍵）
--   ─────────────────────────────────────────────────────────
--   base        base_pay が入っている ／ pay_items.fixed_none = true
--   guarantee   guarantee_pay が入っている ／ pay_items.guarantee_none = true
--   variable    pay_items.variable_none = true ／ pay_items.variable が1行以上あって、
--               **どの行にも** amount（金額）と basis（何に連動する支給か）が在る
--   command     command_pay が入っている
--   perdiem     per_diem が入っている
--   housing     housing_type が入っている。allowance（住宅手当・現金）のときは
--               housing_amount も入っている
--   bonus       bonus_annual が入っている
--   profit      profit_share_annual が入っている
--   block       block_hours が入っている
--   duty_h      duty_hours が入っている
--   duty_days   duty_days が入っている
--   stay        stay_nights が入っている
--   roles       job_roles が1つ以上（複数を持たない古い行は job_role の単数で見る）
--   instructor / examiner / union / management / nonline
--               **その役割に印を付けた行だけ**（line にはモジュールが無い）。
--               pay_items.<役割>.extra（別に支給されているか、の問い）に答えが在る。
--               「別に支給されている」と答えた行は、その役割の金額の列も入っている
--               （union は extra = yes・union_pay。ほかの4つは extra = separate と
--                 instructor_pay / examiner_pay / management_pay / nonline_pay）。
--               union は、支給されているとき支給元（pay_items.union.source）も。
--
-- ★**0 は答え。空欄（null）だけが未回答。** 保存の道（submit_pay_report）は
--   '' を null に、0 を 0 のまま入れる（総支給だけは 0 も null に倒すが、総支給は
--   この線に入っていない）。「職位手当は無い」は 0 と書けば答えになる。
-- ★**「わからない」も答え**（変動給の basis = unknown・役割の extra = unknown）。
--   フォームが逃げ道として用意している選択肢を、あとから「未回答」と読み替えない。
--   役割の extra は included（通常の給与に含まれる）・none・unknown・
--   with_instructor（審査だけ。教官の手当とまとめて支給）のどれでも答え。
-- ★変動給は **flight_variable_pay だけでは答えにしない。** あの列は行の合計の写しで、
--   「何に連動する支給か」を持っていない（この画面の④がそれを集計している）。
--   ⚠️ pv_my_give の full（REAL PAY の内訳の鍵）は flight_variable_pay でも通す。
--      **あちらとは別の線。そろえない**（あちらは1バイトも変えていない）。
-- ★basis は**許可リストで見ない**（pv_deep_pay の vraw は許可リストで見る）。
--   ここが見るのは「答えたか」だけ。許可リストにすると、フォームに選択肢を1つ
--   足した日に、それを選んだ人だけがこの画面から閉め出される（誰も赤くならない）。
-- ★役割モジュールの中身（担当・会社での呼び名・支給単位・回数・日数）は線に入れない。
--   フォームがどれも必須にしていない（CLAUDE.md「絶対に破らない7つ」の6）。
-- ⚠️ 「別に支給されている」の見分けは**値の字**（separate / yes）で、住宅も allowance の
--    字で見ている。どれも pay-report.html の option の値の**写し**。フォームが値を
--    変えるか足すと、その答えは「金額の要らない答え」と読まれて、線が黙って緩む。
--    役職・区分の箱が増えたときも同じ（その役割の問いが線に入らない）。
--    db/test-deep-pay.mjs の ▼2-b「写しの見張り」が、日英のフォームの選択肢と
--    突き合わせている。あちらが落ちたら、ここを直してから通す。
-- ★明細から読んだ行（verify_level が1以上）も**同じ線**で見る。特別扱いしない。
--   読み取りが埋めない欄（賞与・勤務・役割など）は、本人がフォームで足して出し直す。
--
-- ⚠️ **その他の現金手当（other_allowance ／ pay_items.other）と交通費（transport）は、
--    わざと見ていない。「抜けている」と思って足さないこと。**
--    今のフォームは、この2つに「無い」を保存できない ── 「該当なし」の印が無く、
--    交通費は画面から欄ごと消えていて明細の読み取りだけが書く。だから空の値は
--    「まだ答えていない」と「その手当が無い」の見分けが付かない。線に入れると、
--    手当の無い会社の人が**何を出しても一生開かない**（画面は普通に動いたまま）。
--    足すなら、先にフォームへ「該当なし」を作る（オーナー判断）。
-- ⚠️ pay_items の読み方は**例外を投げない形**にしてある（真偽は jsonb のまま比べ、
--    配列でない variable は空として読む）。ここで落ちると、形の崩れた1行を持つ人の
--    pv_deep_pay が丸ごとエラーになる。::boolean や jsonb_array_elements を素で使わない。
--
-- ★誰にも grant しない。pv_deep_pay（security definer）の中からだけ呼ぶ。
--   この関数は**渡された1行しか読まない**（表を引かない・auth.uid() も見ない）。
--   だから開けても他人の行は読めないが、開ける理由が無い。本人の行を選ぶのは
--   呼ぶ側（pv_deep_pay の v_own）の仕事で、ここに「誰の行か」を持ち込まない。
--   ⚠️ 引数が**表の行そのもの**の関数は、API（PostgREST）からは「その表の計算列」の
--      形に見える。pay_reports は誰にも select が無く、この関数も3ロールとも revoke
--      してあるので外からは届かない。**あとから grant を足さないこと。**
-- ════════════════════════════════════════════════════════════════
drop function if exists public.pv_deep_missing(public.pay_reports);

create or replace function public.pv_deep_missing(r public.pay_reports)
returns text[]
language sql
immutable
as $fn$
  select array_remove(array[
    -- ── 月々の現金 ──────────────────────────────────────────
    case when not (r.base_pay is not null
                   or coalesce((x.it -> 'fixed_none') = 'true'::jsonb, false))
         then 'base' end,
    case when not (r.guarantee_pay is not null
                   or coalesce((x.it -> 'guarantee_none') = 'true'::jsonb, false))
         then 'guarantee' end,
    /* 変動給。「該当なし」か、行が1本以上あって**全部の行**に金額と連動先が在ること。
       ★金額は数（0 も数）。項目名だけ書いて金額が空の行が1本でもあれば未回答
         （画面が pay_items.partial を立てる形。jsonb_strip_nulls が amount の鍵ごと落とす）。 */
    case when not (coalesce((x.it -> 'variable_none') = 'true'::jsonb, false)
                   or (jsonb_array_length(x.va) > 0
                       and not exists (
                         select 1 from jsonb_array_elements(x.va) e
                          where jsonb_typeof(e) is distinct from 'object'
                             or not (coalesce(jsonb_typeof(e -> 'amount') = 'number', false)
                                     or coalesce((e ->> 'amount') ~ '^-?[0-9]+(\.[0-9]+)?$', false))
                             or nullif(btrim(e ->> 'basis'), '') is null)))
         then 'variable' end,
    case when r.command_pay is null then 'command' end,
    case when r.per_diem    is null then 'perdiem' end,
    case when not (r.housing_type is not null
                   and (r.housing_type <> 'allowance' or r.housing_amount is not null))
         then 'housing' end,
    -- ── 年額 ────────────────────────────────────────────────
    case when r.bonus_annual        is null then 'bonus'  end,
    case when r.profit_share_annual is null then 'profit' end,
    -- ── 働き方 ──────────────────────────────────────────────
    case when r.block_hours is null then 'block'     end,
    case when r.duty_hours  is null then 'duty_h'    end,
    case when r.duty_days   is null then 'duty_days' end,
    case when r.stay_nights is null then 'stay'      end,
    -- ── 役割 ────────────────────────────────────────────────
    case when cardinality(x.roles) = 0 then 'roles' end,
    /* 役割ごとの手当。印を付けた役割だけを見る。
       ★金額は**列**で見る（pay_items の amount ではない）。画面は 0 を列には 0 で送るが、
         pay_items の側には入れない（0 より大きいときだけ書く）。 */
    case when 'instructor' = any(x.roles)
          and not (x.ex_i is not null
                   and (x.ex_i <> 'separate' or r.instructor_pay is not null))
         then 'instructor' end,
    case when 'examiner' = any(x.roles)
          and not (x.ex_e is not null
                   and (x.ex_e <> 'separate' or r.examiner_pay is not null))
         then 'examiner' end,
    case when 'union' = any(x.roles)
          and not (x.ex_u is not null
                   and (x.ex_u <> 'yes'
                        or (r.union_pay is not null and x.src_u is not null)))
         then 'union' end,
    case when 'management' = any(x.roles)
          and not (x.ex_m is not null
                   and (x.ex_m <> 'separate' or r.management_pay is not null))
         then 'management' end,
    case when 'nonline' = any(x.roles)
          and not (x.ex_n is not null
                   and (x.ex_n <> 'separate' or r.nonline_pay is not null))
         then 'nonline' end
  ]::text[], null)
  from (
    select y.it,
           case when jsonb_typeof(y.it -> 'variable') = 'array'
                then y.it -> 'variable' else '[]'::jsonb end              as va,
           -- 役割：複数（job_roles）が正。2026-08-26 より前の行は単数（job_role）だけ
           coalesce(r.job_roles, '{}'::text[])
           || case when nullif(btrim(r.job_role), '') is null then '{}'::text[]
                   else array[btrim(r.job_role)] end                      as roles,
           nullif(btrim(y.it -> 'instructor' ->> 'extra'), '')            as ex_i,
           nullif(btrim(y.it -> 'examiner'   ->> 'extra'), '')            as ex_e,
           nullif(btrim(y.it -> 'union'      ->> 'extra'), '')            as ex_u,
           nullif(btrim(y.it -> 'union'      ->> 'source'), '')           as src_u,
           nullif(btrim(y.it -> 'management' ->> 'extra'), '')            as ex_m,
           nullif(btrim(y.it -> 'nonline'    ->> 'extra'), '')            as ex_n
      from (select case when jsonb_typeof(r.pay_items) = 'object'
                        then r.pay_items end as it) y
  ) x;
$fn$;

revoke all on function public.pv_deep_missing(public.pay_reports) from public, anon, authenticated;

comment on function public.pv_deep_missing(public.pay_reports) is
  '給与レポートの1行について、まだ答えていない項目のコードを固定の並びで返す（空配列＝答えきった行）。'
  'DEEP PAY の「見る資格」の線（2026-10-11 オーナー判断）。0 と「該当なし」と「わからない」は答え、空欄だけが未回答。'
  '役割ごとの手当は、その役割に印を付けた行だけを見る。'
  '★その他の現金手当と交通費は、わざと見ていない（今のフォームが「無い」を保存できないため）。'
  '★金額も日付も返さない。誰にも grant しない。pv_deep_pay() の中からだけ呼ぶ。';


-- ════════════════════════════════════════════════════════════════
-- 3. pv_deep_pay — 画面がこれ1つだけを呼ぶ
--
-- 引数ゼロ（約束⑤）。区分は**呼んだ本人の最新の1行**からサーバが決める。
--
-- ── 区分のはしご ──────────────────────────────────────────
--   1  会社 × 役職 × 機材
--   2  会社 × 役職 × 機材区分（fleet_cat = r / n / w）
--   3  会社 × 役職
--   4  役職のみ（全社）
--   5  全体
-- 別々の人が v_min 人以上そろう**最初の段**を採る。
--
-- ★ cohort.level を必ず返して画面に出すこと。隠すと読み手は
--   「自分の会社の数字だ」と思い込む。段4の数字を段1だと思って
--   転職を決める人が出る。**この画面でいちばん危ないのはそこ。**
-- ★ 返す会社・役職・機材は**呼んだ本人自身の値**。落ちてきた元の段の
--   会社名は返さない（約束⑥）。
--
-- ── 人数の壁（v_min）──────────────────────────────────────
-- ★2026-10-11、壁を 3人 → **2人** に下げた（オーナー判断）。
--   数字が在るのは関数の頭の定数 v_min の**1か所だけ**。本文のどこにも
--   人数を直書きしない（片方だけ直すと「選べるのに選ぶと空」が黙って起きる）。
--   ★数え方は変えていない ──「内訳を書いた月を持つ実人物」（下の lvl / avail）。
-- 書いた人が1人のセルで percentile を取ると、「中央値」と名乗ったまま
-- その1人の実数が公開される（db/pay-reports.sql の pay_benchmarks に
-- 同じ理由が書いてある）。**1人のセルは今も1つも出さない。**
-- **区分ごと・列ごと・内訳の項目ごとに、それぞれ v_min を掛ける。**
-- ⚠️ 2人のセルの中央値は、その2人の平均。自分がその1人なら、もう1人の額を
--    割り戻せる。壁を下げたぶん、外側の守りは次の2つになった ──
--      ・その区分に何人いるかを返さない（下の「人数は返さない」）
--      ・金額は丸めてから返す（ファイル冒頭の約束③。刻みを細かくしないこと）
-- ⚠️ 待遇アンケート（db/airline-conditions.sql）の壁は 3人のまま。前は
--    「あちらと同じ閾値」だったが、いまは**別の数**。そろえ直すならオーナーに聞く。
--
-- ── 人数は返さない（2026-10-11・オーナー判断）────────────────
-- 前は cohort / head / comp / 賞与の4か所で、その区分の人数を返していた。
-- 全部やめた。**隠すのではなく、最初から渡さない**（画面で伏せるだけだと、
-- 関数を直接叩けば取れる）。
-- かわりに返すのは cohort.trust の3段（high / mid / low）だけ。
--   式は、2026-10-11 まで画面（deep-pay.js）が人数から出していたものをそのまま
--   ここへ移した（画面の側の式はもう無い ── 画面は返ってきた段を読むだけ）。
--   中身は、人数の段（10人以上・5人以上・それ未満）と、区分の狭さ
--   （会社×役職×機材まで絞れているか）の、**低いほう**を採る。
--   区分が広いほど「自分の給与」から遠いので、人数が多くても「高」にしない。
-- ⚠️ gate.contributors / gate.goal / stats.* は**サイト全体**の数で、区分の人数ではない。
--    左メニューの札と Give の誘いが使っているので、これは返し続ける。
--
-- ── 預かりと口コミを混ぜない ──────────────────────────────
-- 預かり（pay_reports_pending）は payload に機材も検証段階も無く、
-- ip_day_hash は日をまたぐと変わる＝同じ人を2人に数えて約束④を壊す。
-- 口コミ由来の給与は内訳を1つも持たない＝分母だけ増やして分子に何も足さない。
-- どちらも人数（stats.contributors）にだけ使い、集計には入れない。
--
-- ── 内訳を書いた人だけを数える ────────────────────────────
-- この画面は「給与の中身」の画面なので、総支給しか書いていない人は
-- 区分（coh）に入れない。入れると全員が未分類100%になり、
-- ドーナツが灰色一色になる。人数表示（stats）とは別の数であることに注意。
--
-- ── 見る資格と、数えられる資格は別の線（2026-10-11・オーナー判断）──
--   数えられる … 内訳を書いた月を持つ人（下の det。上の段落のとおりで、**動かしていない**）
--   見る       … 自分に当てはまる項目を**ぜんぶ**答えた月を、直近24か月に1つ以上持つ人
--                （v_rdy。線の中身は 2-c 章の pv_deep_missing）
--                ★公開より前から居た人だけは、内訳の3つ（基本給／保証手当・職務手当／
--                  変動給）に答えた月が同じ窓の中に在れば足りる（v_old。2026-10-11・
--                  オーナー判断。境目と読み方は、本文の「公開より前から居た人」の注）。
--                  この決まりが広げるのも**見る**側だけ。数えられる側には触れていない。
-- ★見る線のほうが高い。だから「内訳は書いたが、まだ答えきっていない人」は、
--   **区分の頭数には入っているのに、自分ではこの画面を見られない**。これは意図どおり ──
--   その人の数字を捨てると、線を上げた日に区分がいっせいに壁を割って画面ごと空になる。
-- ⚠️ det を pv_deep_missing に差し替えないこと（「そろえる」と、頭数が黙って減る）。
--    逆に、見る側を det に戻さないこと（それが 2026-10-11 より前の線）。
-- ★見る資格は**月をまたいで拾い集めない**。同じ1行の中で答えきっていること
--   （pv_my_give の full と同じ考え方）。ただし答えきった月が1つあれば足りる ──
--   あとから出した月が途中までしか書けていなくても、鍵は閉め直さない
--   （毎月ぜんぶ書き直させる門にすると、続けて出す人ほど閉め出される）。
-- ★窓は区分の本棚（sane）と**同じ直近24か月**（v_from 〜 v_to の1か所）。
--   窓の外の月しか答えきっていない人は、その月が区分にも入らない＝いまの数字に
--   何も出していないのと同じなので、見る資格にも数えない。
--   ⚠️ 常識の幅（約束⑦・年 $10,000〜$700,000）は、見る資格には掛けていない。
--      あれは「集計に入れてよい額か」で、「本人が答えきったか」とは別の問い。
--      （オーナーが決めたのは「窓の中の、答えきった自分の行」まで。幅を掛けないのは
--        その字面どおりの実装。掛けることにした日は db/test-deep-pay.mjs の
--        「見る資格の1行」── わざと幅の下に置いてある ── も作り直す。）
-- ★足りない人には gate.todo を返す ── 窓の中でいちばん新しい自分の1行の、
--   対象の年・月と、残っている項目のコードだけ。その行のほかの中身は何も返さない。
--   答えきっている人と、窓の中に行が1つも無い人には null。
--   公開より前から居て通る人にも null（残りが在っても、何も頼まない）。
-- ════════════════════════════════════════════════════════════════
drop function if exists public.pv_deep_pay();          -- 引数ゼロだった頃のもの
drop function if exists public.pv_deep_pay(jsonb);

create or replace function public.pv_deep_pay(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_until timestamptz;
  v_give  jsonb;
  v_key   boolean;
  -- ★見る資格（2026-10-11）。前はここに「内訳が1つでもあるか」の変数が居た。
  --   名前ごと消してある（残すと、門へ配線し直す入口になる。自己点検 26 が見ている）。
  v_own   boolean;   -- 窓の中に、答えきった**自分の**行が1つ以上あるか
  v_old   boolean;   -- 窓の中に、公開より前に出して内訳の3つに答えてある**自分の**行が1つ以上あるか
  v_rdy   boolean;   -- 門が読む答え ＝ v_own か、v_old か、運営
  v_todo  jsonb;     -- 足りない人に返す「残っている項目」（足りている人には null）
  v_open  boolean;
  /* ★直近24か月の窓。**ここが唯一の場所**（2026-10-11 に変数へ出した）。
       読むのは2か所 ── 区分の本棚（sane＝数える側）と、見る資格（下の v_own。
       同じ日に足した v_old も、その同じ1回の読みの中に居る ＝ 読む場所は2か所のまま）。
       前は sane の中に式が直に書いてあった。見る資格にも同じ窓が要るようになり、
       式を写して持つと「数える窓と見る窓が1か月ずれる」が黙って起きるので、
       2つとも同じ変数を読む形にした。**式そのものは1文字も変えていない。**
     当月を含めて暦の24か月ちょうど（2026-09 なら 2024-10〜2026-09）。
     なぜ投稿日ではなく対象月で見るのかは、sane の where の注を読む。 */
  v_from  constant date := (date_trunc('month', now()) - interval '23 months')::date;
  v_to    constant date := date_trunc('month', now())::date;
  /* ★DEEP PAY を**公開する瞬間**（2026-10-11・オーナー判断「3つとも答えている人は
       そのまま開く」）。**ここが唯一の場所。** 読むのは1か所だけ ── 下の「公開より前から
       居た人」（v_old）が、その行を出したのが公開より前かどうかを、これと比べる。
     ★**わざと決め打ちの日時**（字で書いた定数）。現在時刻（now()）から作らない ──
       「今から何日前」という動く境目にすると、いつ来た人でも「前から居た人」に入れて、
       上げた線がいつまでも効かない（db/pay-rows.sql の pv_my_give が、内訳の鍵の
       経過措置の締切を定数で持っているのと同じ理由）。自己点検 30 が形を見ている。
     ⚠️ **オーナーが貼る前に、本当に公開する日時へ直すこと。** 下の日時は仮置き。
        直すのは日付と時刻の字だけ（+09 ＝ 日本時間のまま）。
        ・本当の公開より**あと**の日時のまま貼ると、公開してからその日時までに出した人まで
          「前から居た人」に入る（3つだけで開く人が、決めたより増える）。
        ・本当の公開より**前**の日時にすると、そのあいだに3つを答えて出した人が、
          公開の日に閉め出される（決めたより減る）。
     ⚠️ 公開したあとで先へ動かさない（あとから来た人が、3つだけで入れるようになる）。
     ⚠️ 境目ちょうどに出した行は「前」ではない（より小さい、で比べる）。
     ⚠️ この関数の中で、出した時刻の列名を**引用符でくくって**書かないこと。自己点検 10 が
        「日付を鍵として返していない」をその字で見ている（列として読むぶんには当たらない）。
     ⚠️ 下の宣言は字面のまま検査が見ている（空白を足して桁をそろえない）。 */
  v_launch constant timestamptz := timestamptz '2026-10-13 00:00:00+09';
  v_air   text := nullif(btrim(coalesce(p ->> 'airline',  '')), '');
  v_pos   text := nullif(btrim(coalesce(p ->> 'position', '')), '');
  v_flt   text := nullif(btrim(coalesce(p ->> 'fleet',    '')), '');
  v_man   boolean;   -- 手で選んだか（＝本人の区分ではないか）
  v_bad   boolean := false;   -- 語彙に無い値が来たか
  -- 解放に要る人数。返り値の goal もここから出す。
  -- ★ここが唯一の場所（2026-09-01）。前は pv_deep_goal() から取っていたが、
  --   数字を見る場所がこの1か所だけになったので直書きに戻した。
  v_goal  constant int := 100;
  -- 区分ごとの人数の壁（内訳を書いた実人物が、この人数に届かない区分は出さない）。
  -- ★ここが唯一の場所（2026-10-11・オーナー判断で 3 → 2）。本文の比較は全部
  --   この名前で書いてある。**数字を本文に直書きしない**（自己点検 9 が見ている）。
  -- ⚠️ 100人の門（v_goal）とは別物。あちらはサイト全体・こちらは区分ごと。
  -- ⚠️ 下の宣言は字面のまま検査が見ている（空白を足して桁をそろえない）。
  v_min constant int := 2;
  v_ctb   int;       -- 今までに給与を出したユニークな人数（今の実数）
  v_lch   boolean;   -- 正式公開の手動フラグが立っているか
  v_byp   boolean;   -- 試験だけの抜け道（本番では立たない。下の注を読む）
  v_crd   boolean;   -- 「みんなの側」の条件が満たされているか（100人 or 手動フラグ）
  v_out   jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select p.access_until into v_until from public.profiles p where p.id = v_uid;
  v_give := public.pv_my_give();

  -- ★門は3つとも要る（約束①）。
  --   access_until … REAL PAY と同じ90日の鍵。
  --   答えきったか … 本人が、自分に当てはまる項目をぜんぶ答えた月を持っていること
  --                  （v_rdy。2026-10-11 オーナー判断）。**ここが唯一の実装場所。**
  --                  前は「内訳が1つでもある」（pv_my_give の内訳の真偽）を読んでいた。
  --                  その線は門から外した ── 今も give の中で画面へ返してはいるが、
  --                  **この関数はもう読んでいない**（自己点検 26）。
  --                  ★公開より前から居た人だけは、内訳の3つに答えていれば足りる
  --                    （v_old。同じ日のオーナー判断。下の「公開より前から居た人」の注）。
  --   100人        … 「給与を出したパイロットが100人に達したら開く」という
  --                  プロダクトの約束（2026-09-01）。今までは画面に札を出すだけで
  --                  **どこも強制していなかった**（JS にも無い）。ここが唯一の実装場所。
  -- ★人数は pv_deep_contributors()（db/pay-rows.sql 1-h）＝**札と同じ関数**。
  --   ここに数え方を書き写すと「画面は 100 / 100 人なのに開かない」が起きる。
  --   proof_hash をそのまま数えないこと（本人 × 会社で1つ＝2社に出した1人が2人になる）。
  -- ★ここで raise しない。投げると画面がエラーになり、
  --   「1枚出せば開く」という肝心の伝え方ができなくなる（pv_pay_rows と同じ）。
  -- ★運営（pv_admins）は鍵が無くても開く（2026-09-03。REAL PAY 側と同じ理由）。
  --   答えきったかの側（v_rdy）も、下で同じ pv_is_operator を足して通す。
  --   （2026-10-11 より前は pv_my_give が運営を通していたので1行で足りた。
  --     門がそれを読まなくなったので、こちらにも要る。）
  v_key  := (v_until is not null and v_until > now()) or public.pv_is_operator();

  /* ★★見る資格（2026-10-11・オーナー判断）★★
       「DEEP PAY は、自分に当てはまる項目をぜんぶ答えた人にだけ開く」。
       線の中身（どの欄を・どう読むか）は pv_deep_missing の1か所（2-c 章）。
       ここが決めているのは3つだけ ──
         ① 見るのは**呼んだ本人の行**だけ（鍵の作り方は下の me と同じ pv_my_keys）。
            他人が答えきっていても、自分の資格にはならない。
         ② 対象月が**直近24か月の窓の中**の行だけ（sane と同じ v_from 〜 v_to）。
         ③ その中に、未回答が空の行が**1つでも**あれば足りる（bool_or）。
            月をまたいで拾い集めない／あとから出した書きかけの月で閉め直さない。
     ★足りない人のために、窓の中で**いちばん新しい自分の1行**の残りを持って出る
       （対象月の新しい順・同じ月なら出した時刻の新しい順）。
       返すのは年・月・残っている項目のコードだけ。金額も会社もその行の他の値も出さない。
     ⚠️ 並べ替えに使う列を、返り値の鍵にしないこと（約束⑥。年と月は本人の値なので
        返すが、出した時刻は返さない）。
     ⚠️ ここで raise しない（下の門と同じ。投げると「何を出せば開くか」を言えない）。 */
  /* ★★公開より前から居た人（2026-10-11・オーナー判断「3つとも答えている人はそのまま開く」）★★
       DEEP PAY を公開する**より前に**、内訳の芯の3つ ── 基本給／保証手当・職務手当／
       変動給（何に連動する支給かまで）── に答えて出していた人は、残りを埋めなくても
       開いたまま（v_old）。先に出してくれた人を、あとから上げた線で閉め出さない。
       それ以外の人と、公開から先に出す行は、上のとおり**ぜんぶ**答えること（v_own）。
     ★見る行は v_own と**同じ**（呼んだ本人の行・同じ窓）。別の問い合わせを書かず、
       下の**同じ1回の読み**の中で、同じ行の同じ答え（miss）を読む ＝ 鍵の作り方も、
       窓の式も、答えきったかの判定を呼ぶ場所も、1つも増やしていない（自己点検 28・29）。
     ★「3つに答えた」は、その行の未回答に base / guarantee / variable が**1つも
       残っていない**こと（配列の重なり && で見る）。3つの条件をここへ書き写さない ──
       写すと、線の読み方（0・「該当なし」・変動給の行の金額と連動先）を直した日に、
       こちらだけ古い読み方のまま残る。
       ⚠️ pv_my_give の full（REAL PAY の内訳の鍵）も「3つ」を見るが、あちらは変動給を
          合計の列だけでも通す。**別の線。あちらの答えをここへ配線しない。**
     ★**同じ1行の中で**3つ（月をまたいで拾い集めない。v_own と同じ考え方）。
       そういう行が窓の中に1つでもあれば足りる。
     ★境目は「公開の瞬間（v_launch）**より前**に出した行」。ちょうどは前ではない。
     (a) 公開から先に同じ月を出し直すと、保存の道（db/pay-reports.sql ── 同じ会社・同じ月は
         上書き）が出した時刻を新しくする ＝ その行は「前に出した行」ではなくなる。
         **意図どおり** ── 公開から先に出すものは、出し直しも含めてぜんぶ答える。
         （出し直さなければ前の行はそのまま残り、開いたまま。別の月を新しく出しても、
           前の行は動かないので閉め直さない。）
         登録前の預かりも同じ道を通る ── 行が出来るのは引き取ったときなので、公開から先に
         引き取った預かりは「公開から先に出した行」。
     (b) この決まりが広げるのは**見る**側だけ。**数えられる**側（区分の頭数 ── 下の det）は
         1文字も動かしていない。この決まりで区分に入る人も、区分から出る人も居ない。
     (c) 片づけは要らない。公開より前に出せたのは公開の月までの行だけ（未来の月は投稿の
         時点で弾かれる）で、どの行も、遅くとも公開の月の24か月後には窓を出る。そこから先、
         この決まりは誰にも当たらない ── 消さなくても、ひとりでに効かなくなる。
     ★この道で通った人にも、何も頼まない（下で todo を null にする。答えきった人と同じ）。 */
  select coalesce(bool_or(cardinality(m.miss) = 0), false),
         coalesce(bool_or(m.early
                          and not (m.miss && array['base', 'guarantee', 'variable'])), false),
         (array_agg(jsonb_build_object('year',  m.py,
                                       'month', m.pm,
                                       'items', to_jsonb(m.miss))
                    order by m.py desc, m.pm desc, m.ca desc))[1]
    into v_own, v_old, v_todo
    from (select r.period_year  as py,
                 r.period_month as pm,
                 r.created_at   as ca,
                 (r.created_at < v_launch) as early,
                 public.pv_deep_missing(r) as miss
            from public.pay_reports r
           where r.proof_hash in (select h from public.pv_my_keys() h)
             and make_date(r.period_year, r.period_month, 1) between v_from and v_to) m;
  /* ★運営は自分で出さなくても通す（鍵と同じ理由 ── 門が効いているかを目で確かめるため。
       偽の給与を1件出して開ける手は取らない。db/pay-rows.sql の pv_is_operator）。
     ★足りている人には todo を返さない。「残りは無い」を空の配列で言わせない ──
       画面が「todo が在る＝まだ足りない」の1つだけで分けられるようにする。
       公開より前から居て通った人（v_old）も「足りている人」── 残りが在っても返さない。 */
  v_rdy  := v_own or v_old or public.pv_is_operator();
  if v_rdy then v_todo := null; end if;

  v_ctb  := public.pv_deep_contributors();

  /* ★試験だけの抜け道（オーナー確定 2026-09-01）
     「本番では強制する。ただし開発・検証ができなくなるのは困る。
       本番で管理者だけ静かに迂回できる隠し例外は作らない。」

     だから合言葉ひとつでは開けない。**2つとも**要る：
       ① auth.users が存在しないこと ── 試験の器（PGlite）は auth.uid() の
          代役だけ作って auth.users を作らない。本番の Supabase には必ず在る。
          ＝**本番ではこの条件が立てようがない。** 誰が何を設定しても開かない。
       ② そのうえで pv.deep_bypass を明示的に立てること。
     管理者フラグも合言葉も見ない。見ると「本番の管理者だけ迂回できる」形になる。 */
  v_byp  := (to_regclass('auth.users') is null
             and coalesce(current_setting('pv.deep_bypass', true), '') = 'on');

  /* ★解放条件はこの2つだけ（オーナー確定 2026-09-01）。
       ・今のユニークな人数が100人以上
       ・正式公開の手動フラグが立っている（db/pay-rows.sql の pv_deep_launch）
     フラグは**管理者が一度だけ手で立てる。** 自動では立たないし、自動では降りない。
     ⚠️ フラグを立てるまでは、100人 → 99人 に落ちれば普通に閉じる。
        （前の版は100人到達をトリガで自動記録していた。取りやめた。）
     ⚠️ フラグを立てたあとは人数が減っても開いたまま ── でないと
        「100人を保つために消してほしい人のデータを残す」という
        やってはいけない動機が生まれる。**削除依頼が来た人のデータは普通に消す。**
     ⚠️ 区分ごとの人数の壁（v_min）はこれとは別物で、今のデータで毎回判定する
        （壁を割ればその区分は消える。下の thin を見る）。
     ⚠️ gate.contributors は今の実数を出し続ける（99 と出たまま開いているのが正しい）。 */
  v_lch  := exists (select 1 from public.pv_deep_launch);
  /* ★「みんなの側」の条件を1つの値にまとめ、gate.crowd としても返す（2026-10-11）。
       閉じている理由は3つある（鍵が無い／本人が答えきっていない／まだ100人に届かない）。
       前は3つめを、画面が contributors と goal を比べて自分で判定していた。
       それだと手動フラグで開けたあと（99人のまま開いている日）にも、鍵の無い人へ
       「100人に届いたら開く」の行が出る ── その人を止めているのは人数ではないのに。
       **門と同じ式の答え**をそのまま渡し、本当にそれが理由のときだけ出せるようにする。
     ⚠️ 式を2か所に書かない。v_open が読むのも、返すのも、この v_crd の1つ。 */
  v_crd  := (v_lch or v_ctb >= v_goal or v_byp);
  -- ★3つとも and。まんなかは 2026-10-11 に「内訳が1つでもある」から「答えきった」へ替えた。
  --   （同じ日に足した「公開より前から居た人」の道も、まんなかの中に入っている。
  --     鍵と、みんなの側の条件は、その人たちにも今までどおり要る。）
  v_open := v_key and v_rdy and v_crd;

  -- ★選べるのは語彙に在るものだけ（約束⑤a）。
  --   'other'（自由入力の社名）は選ばせない。別々の会社が other という1社に
  --   潰れて混ざるので、その見出しで数字を出すと嘘になる。
  --   ★語彙に無い値を null に読み替えて「広い区分」を返さないこと。
  --     打ち間違いに別の区分の数字が出て、読み手はそれと気づけない。
  --     v_bad は下の lvl で 0段を丸ごと消し、空の区分として返る。
  v_man := (v_air is not null or v_pos is not null or v_flt is not null);
  if v_air is not null and not exists (
       select 1 from public.pv_airlines a where a.code = v_air and a.code <> 'other')
    then v_bad := true; end if;
  if v_pos is not null and not exists (
       select 1 from public.pv_positions q where q.code = v_pos)
    then v_bad := true; end if;
  if v_flt is not null and not exists (
       select 1 from public.pv_fleets f where f.code = v_flt)
    then v_bad := true; end if;

  with
  -- ── 呼んだ本人の行 ──────────────────────────────────────
  keys as (select h from public.pv_my_keys() h),
  me as (
    select r.airline as airline, r."position" as pos,
           r.fleet as fleet, r.fleet_cat as cat
      from public.pay_reports r
     where r.proof_hash in (select h from keys)
     order by r.period_year desc, r.period_month desc, r.created_at desc
     limit 1
  ),

  -- ── 本棚（直近24か月・常識の幅の中だけ）────────────────────
  -- ★ここで選んだ列がすべて。増やす前にファイル冒頭の約束⑥を読む。
  sane as (
    select r.proof_hash                     as pkey,
           r.airline                        as airline,
           r."position"                     as pos,
           r.fleet                          as fleet,
           r.fleet_cat                      as cat,
           r.annual_total_usd               as usd,
           r.usd_per_block_hour             as ubh,
           r.block_hours                    as block_h,
           r.duty_hours                     as duty_h,
           r.duty_days                      as duty_d,
           r.stay_nights                    as stay_n,
           r.pay_items                      as items,
           /* ★2026-10-11、ここに在った「明細の裏付けがあるか」の列を外した。
              使い道は「うち明細あり◯人」という**人数**を返すことだけで、
              人数を返すのをやめたので読む場所が無くなった。 */
           -- 内訳を書いたか。pv_my_give の detailed と**同じ条件**にそろえる
           /* ★これは**数えられる**側の線（区分の頭数に入るか）。2026-10-11 に
                上がったのは**見る**側だけ（上の v_rdy）で、ここは動かしていない。
              ⚠️ 「見る線にそろえる」つもりで、ここへ答えきったかの判定を持ち込まない。
                 頭数が黙って減り、区分がいっせいに壁を割る（自己点検 28）。 */
           (r.base_pay is not null or r.guarantee_pay is not null
            or r.command_pay is not null or r.pay_items is not null) as det,
           /* ★内訳のうち、金額を書いていない行がある月（2026-09-12）。
              画面が pay_items.partial に立てる。ここで拾わないと、
              「変動給を1行だけ書いて、残りは分からないので空にした」月が
              **全額が揃った内訳**として割合の母集団に入り、固定給の割合が
              実際より高く出る。det と同じ考え方で、観測していないものを
              0% と読まないための印。
              ⚠️ この印そのものは**閲覧の資格ではない**（pv_my_give も、上の見る資格も
                 この印を読まない）。その人の REAL PAY は今までどおり開く。
              ★DEEP PAY の見る資格は、2026-10-11 から行ごとに別の線で見ている
                （2-c 章）。金額の無い変動給の行が残っている月は、そちらの線で
                「変動給が未回答」になる ＝ **その月では**開かない。答えきった月が
                ほかに1つあれば開く。印を立てたから閉じる、という道は今も無い。 */
           coalesce((r.pay_items->>'partial')::boolean, false)          as part,
           /* ── その月の現金（賞与ぬき）──────────────────────
              総支給がある人はそこから当月賞与を引く。無い人は
              pv_annual_total の第2分岐と**同じ並び**を12で割った形。
              ★あちらと1行ずつ揃えること。揃えないとドーナツの合計と
                年収カードが食い違う。 */
           case when nullif(r.gross_monthly, 0) is not null
                then greatest(r.gross_monthly - coalesce(r.bonus_month, 0), 0)
                     /* ★組合が直接払った分だけは総支給の外にある（2026-09-02）。
                        会社の明細に印字されないので、足さないと分母が小さいまま
                        ④役割手当だけが膨らみ、下の 1.02 倍の関所でこの行が
                        まるごと集計から落ちる。pv_annual_total と同じ1行。 */
                   + case when public.pv_union_outside_gross(r.pay_items)
                          then coalesce(r.union_pay, 0) else 0 end
                   /* ★不就労減額（欠勤控除など）も足し戻す（2026-09-12）。
                      印字の総支給は減額を**引いたあと**、下の9区分は引く**前**。
                      足さないと分母だけ小さく、同じ理由で 1.02 倍の関所に
                      引っかかってこの行がまるごと集計から落ちる。
                      年収（pv_annual_total）には1円も足さない。 */
                   + public.pv_absence_total(r.pay_items)
                else coalesce(r.base_pay, 0)
                   + coalesce(r.guarantee_pay, 0)
                   + coalesce(r.hourly_rate, 0)
                     * greatest(coalesce(r.block_hours, 0), coalesce(r.guaranteed_hours, 0))
                   + coalesce(r.per_diem, 0)
                   + case when r.housing_type = 'allowance'
                          then coalesce(r.housing_amount, 0) else 0 end
                   + coalesce(r.transport, 0)
                   + coalesce(r.command_pay, 0)
                   + coalesce(r.other_allowance, 0)
                   + coalesce(r.instructor_pay, 0)
                   + coalesce(r.examiner_pay, 0)
                   + coalesce(r.union_pay, 0)
                   + coalesce(r.management_pay, 0)
                   + coalesce(r.nonline_pay, 0)
           end                              as cash_m,
           /* ①基本給 ②保証手当・職務手当
              ★2026-09-15、1つだった a_fixed を2つに割った（オーナー指示）。
                フォームでは別々の欄なのに、図では同じ緑の1本に見えていた。
                足した数は1円も変わらない（cash_m も未分類の引き算も両方を足す）。
              ★★ db/pay-rows.sql の shelf と pv_pending_detail も同じに直す。★★ */
           coalesce(r.base_pay, 0)                                     as a_base,
           coalesce(r.guarantee_pay, 0)                                as a_gtee,
           -- ③ 変動給。書いていない人は「時給 × 実績と保証時間の大きい方」で見る
           --    （pv_annual_total と同じ建て付け）
           coalesce(r.flight_variable_pay,
                    coalesce(r.hourly_rate, 0)
                    * greatest(coalesce(r.block_hours, 0),
                               coalesce(r.guaranteed_hours, 0)))       as a_var,
           -- ④ 職位手当
           coalesce(r.command_pay, 0)                                  as a_cmd,
           -- ⑤ 役割手当（教官・審査・組合・管理・兼務）。どれも other_allowance の
           --    外にある別の入れ物なので、まとめてここで数える
           coalesce(r.instructor_pay, 0) + coalesce(r.examiner_pay, 0)
           + coalesce(r.union_pay, 0) + coalesce(r.management_pay, 0)
           + coalesce(r.nonline_pay, 0)                                as a_role,
           -- ⑤ パーディアム
           coalesce(r.per_diem, 0)                                     as a_pd,
           -- ⑥ 住宅手当。現物支給の社宅は現金ではないので数えない
           case when r.housing_type = 'allowance'
                then coalesce(r.housing_amount, 0) else 0 end          as a_house,
           /* ⑦ その他の現金手当
              ★★ この引き算が命綱。★★
              db/pay-reports.sql（5章）が pay_items.variable の合計を
              flight_variable_pay **と** other_allowance の**両方**に写している。
              素直に足すと変動給を二重に数える。
              pay-viz.js の segments() も split = (fv > 0 && fv <= other) で
              同じ罠を避けている。**外さないこと。**

              ★★ 直したら db/pay-rows.sql の2か所も同じに直す（2026-09-03）。★★
                 ・shelf CTE の a_other（本棚）
                 ・pv_pending_detail の 'other'（登録前の預かり）
              同じ式が**3か所**にある。片方だけ直すと、DEEP PAY のドーナツと
              REAL PAY の帯が**同じ人について違う内訳**を出す。どちらの画面も
              普通に動いたまま、数字だけが食い違う。
              ★共有関数にしていないのは、pay-rows.sql が deep-pay.sql より
                **先に**貼られるファイルだから（依存させると適用順が逆転する）。 */
           greatest(coalesce(r.other_allowance, 0)
                    - coalesce(r.flight_variable_pay, 0), 0)
           + coalesce(r.transport, 0)                                  as a_other,
           /* 賞与は**ドーナツに入れない**（オーナー確定）。年収に対する割合を
              別行で1つだけ出すので、ここで1行ぶんの割合にしておく。
              年収は本人の通貨に戻してから割る（USD どうしでも同じ値になるが、
              fx_to_usd が無い行を確実に外すためこの形にする）。

              ★★ bonus_month をここに足さない（2026-09-01 に直した）。★★
              その月の賞与は**総支給の中に既に入っている**。上の cash_m が
              総支給から1回引いていて、年収（pv_annual_total）も同じ理由で
              引いてから12倍している（db/pay-reports.sql 4章）。
              ここで ×12 して足すと、同じ賞与を年に2回数えることになり、
              賞与比率が実際より大きく・月額（ucm）が実際より小さく出る。
              足さないことで **年収 ×(1 − b_share) ÷ 12 ＝ cash_m** が
              恒等式になる（db/test-deep-pay.mjs が固定している）。 */
           case when r.fx_to_usd is not null and r.fx_to_usd > 0
                 and r.annual_total_usd is not null and r.annual_total_usd > 0
                then (coalesce(r.bonus_annual, 0) + coalesce(r.profit_share_annual, 0))
                     / (r.annual_total_usd / r.fx_to_usd)
           end                                                          as b_share
      from public.pay_reports r
     where r.annual_total_usd is not null    -- レートの無い通貨は落ちる
       and r.annual_total_usd between 10000 and 700000   -- 約束⑦
       /* ★「直近24か月」は**その報酬がいつのものか**で見る（2026-09-01 に直した）。
          投稿された日で見ていたので、2020年の給与を昨日書いた行が「直近」に入り、
          去年書いた去年の給与が今年落ちていた。
          db/pay-reports.sql の期間の列にも「created_at では"いつ時点の報酬か"が
          消える」と書いてあり、コードだけが食い違っていた。
          当月を含めて暦の24か月ちょうど（2026-09 なら 2024-10〜2026-09）。
          上限は保険 ── 未来の月は投稿時に既に弾いている
          （pv_validate_pay_payload の「未来の月は投稿できません」）。
          ★2026-10-11、窓の両端を関数の頭の変数（v_from / v_to）へ出した。
            式は同じ。見る資格（v_own）が**同じ2つ**を読むので、数える窓と
            見る窓がずれない（自己点検 29）。ここへ式を直に書き戻さないこと。 */
       and make_date(r.period_year, r.period_month, 1) between v_from and v_to
  ),

  /* ── ここから下の並びを2026-09-01に組み替えた ────────────────
     前は「人に潰す → 区分で絞る」だった。だから
       ・FO のときの給与が、今 CAP の人の CAP の数字に混ざっていた
         （人を1行にした時点で、月ごとの役職が消えていた）
       ・人数の壁を proof_hash で数えていた＝**本人 × 会社**で1つなので、
         2社に出した1人が2人になり、壁に届いていないセルで中央値が出ていた
     今は「月次で絞る → 人に潰す」。順番を入れ替えただけで両方直る。

     hum → ok → tag → lvl → pick → mrow → person → coh
     ★過去の給与は1行も捨てない。FO だった月は FO の統計に残り、
       CAP になった月は CAP の統計に入る（オーナー確定 2026-09-01）。 */

  -- ── 月次行に「同じ人」を貼る ────────────────────────────
  -- ★当たらない行は落とす（fail closed）。「たぶん別人」として数え上げると
  --   壁に届いていないセルが届いたように見えて中央値が出る＝匿名性が破れる方向。
  --   落とすと数字が出ないだけで、誰の実額も漏れない。
  --   投稿のたびに profiles 行ができる（db/pay-reports.sql 6章）ので、
  --   正常に出した人がここで落ちることは無い。
  -- ★human はこの関数の中だけの連番。**返り値に入れないこと。**
  hum as (
    select s.*, m.human
      from sane s
      join public.pv_pay_person_map() m on m.h = s.pkey
  ),

  -- ── 1行ぶんの検品 ──────────────────────────────────────
  /* 現金が無い／内訳が現金をはみ出している行は割合に混ぜない。
     はみ出しは本人の書き間違いで、こちらで按分すると嘘の内訳になる。
     2%までは丸めの誤差として通す（給与フォームも合計一致を強制していない）。
     落とした数はどこにも出さない（出すと「何人が変な書き方をしたか」が漏れる）。 */
  ok as (
    select * from hum
     where cash_m is not null and cash_m > 0
       and (a_base + a_gtee + a_var + a_cmd + a_role + a_pd + a_house + a_other)
           <= cash_m * 1.02
  ),

  -- ── 選べる組み合わせ（会社・職位・機材）────────────────
  /* 画面の選択肢をこれで絞る。約束は1つ ── **選べる ＝ 必ず数字が返る**
     （オーナー確定 2026-09-01）。110社・3職位・19機材を素で並べると、中身が
     あるのは一握りで、選んだ先が「まだ出せません」しか無い選択肢が大半になる。

     ★**ここで閾値を決め直しているのではない。** 下の lvl と同じ数え方を、
       段ではなく「会社・職位・機材の絞り方」で割っただけ。材料も ok で同じ
       （直近24か月・約束⑦の幅・現金の検品まで通った行）。
       lvl は `group by lv, human having bool_or(det)` ＝「その区分の中に、
       内訳を書いた月を持つ人が何人いるか」。ここは先に where o.det で絞って
       count(distinct human) を数える。**同じことを別の書き方でしている**
       （どちらも「内訳の月を1つ以上持つ人」を1人と数える）。
       ⬆ ズレると「選択肢に出ているのに選ぶと空」が**画面は普通に動いたまま**起きる。
       自己点検 21 が、ここと lvl 側の両方が同じ v_min で比べていることを見ている。

     ★0段（tag の lv=0）と**同じ絞り方**を8通りぜんぶ数える。0段は
       「渡された v_air / v_pos / v_flt のうち、null でないものだけで絞る」
       ので、選択肢の組み合わせはちょうど 2×2×2 = 8通りしか無い。
       grouping sets で1回のなめで全部出す。

     ⚠️ **空文字は「絞っていない」の意味だけに使う。** coalesce(fleet,'') では
        書かないこと。いまは pay_reports の airline / position / fleet が3つとも
        not null（db/pay-reports.sql の表）なので当たらないが、当たった日には
        「機材を書かなかった人」と「機材で絞らない」が同じ鍵に潰れて、選択肢に
        出ていない機材が選べるようになる。grouping() で見分ける（下の3行）。

     ★'other'（一覧に無い航空会社）は**会社としては**選ばせない。別々の会社の
       答えが1社に潰れて混ざるため（tag の1〜3段・pay_benchmarks と同じ理由）。
       会社で絞らない側（grouping=1）には混ぜたまま ── 0段も v_air が null の
       ときは other を混ぜているので、そこと同じにする。 */
  /* ⚠️ 列名を a / p / f にしない。**p は関数の引数の名前**なので
        「column reference "p" is ambiguous」で落ちる（実際に踏んだ）。 */
  avail as (
    select case when grouping(airline) = 1 then '' else airline end as qa,
           case when grouping(pos)     = 1 then '' else pos     end as qp,
           case when grouping(fleet)   = 1 then '' else fleet   end as qf
      from ok o
     where o.det
     group by grouping sets ((airline, pos, fleet), (airline, pos), (airline, fleet),
                             (airline), (pos, fleet), (pos), (fleet), ())
    having count(distinct o.human) >= v_min
       and (grouping(airline) = 1 or airline is not null)
       and (grouping(pos)     = 1 or pos     is not null)
       and (grouping(fleet)   = 1 or fleet   is not null)
       and (grouping(airline) = 1 or airline <> 'other')
  ),
  /* 画面が引く形に組み直す。'' ＝「その軸で絞っていない」。
       air              … 会社を選ぶだけで数字が返る会社
       pos["ana"]       … ANA を選んだとき数字が返る職位（pos[""] は会社なし）
       flt["ana|cap"]   … ANA × 機長で数字が返る機材（flt["ana|"] / flt["|"] も同じ形）
     ★行き止まりが構造的に無い。air に居る会社は「会社だけ」で必ず返るので、
       職位・機材の「指定なし」はいつでも有効。
     ★名前を picks にしない。すぐ下に段の pick が居て1文字違いになる。 */
  avail_j as (
    select jsonb_build_object(
      'air', (select coalesce(jsonb_agg(qa order by qa), '[]'::jsonb)
                from avail where qp = '' and qf = '' and qa <> ''),
      'pos', (select coalesce(jsonb_object_agg(kk, vv), '{}'::jsonb)
                from (select qa as kk, jsonb_agg(qp order by qp) as vv
                        from avail where qf = '' and qp <> '' group by qa) t),
      'flt', (select coalesce(jsonb_object_agg(kk, vv), '{}'::jsonb)
                from (select qa || '|' || qp as kk, jsonb_agg(qf order by qf) as vv
                        from avail where qf <> '' group by qa, qp) t)
    ) as j
  ),

  -- ── その月がどの段に属するかの札 ────────────────────────
  /* ★役職・機材は**その月の行に書いてある値**で判定する（約束⑧・2026-09-01）。
     FO 検索には FO だった月だけ、CAP 検索には CAP だった月だけが入る。
     昇進した人の過去の給与を捨てるのではなく、**その頃の区分に残す**。
     機材を変えた人も同じ。
     ★自由入力の社名（airline = 'other'）は 1〜3段では外す。
       別々の会社の答えが other という1社に潰れて混ざるため
       （db/pay-reports.sql の pay_benchmarks に同じ理由が書いてある）。
     ★me を left join にする。呼んだ本人がまだ1枚も出していないとき、
       cross join だと段5（全体）まで空になる。
     ★条件を書くのはここ1か所だけ。前は数える側（lvl）と集める側（coh）に
       同じ条件が2つあり、ずれると「壁に届いたと数えた段に、実際は届いていない」が
       起きる作りだった。**その写しが消えた。** */
  tag as (
    select o.*, l.lv
      from ok o
      cross join (values (0),(1),(2),(3),(4),(5)) l(lv)
      left join me m on true
     where case l.lv
             -- 0段 ＝ 手で選んだ区分。★v_air は語彙に在るコードなので
             --   'other' は最初から入らない。会社を選んでいないときは
             --   4段・5段と同じく other も混ぜる。
             when 0 then v_man and not v_bad
                     and (v_air is null or o.airline = v_air)
                     and (v_pos is null or o.pos     = v_pos)
                     and (v_flt is null or o.fleet   = v_flt)
             -- 1〜5段 ＝ 何も選んでいないときだけ。本人の区分から順に落とす
             when 1 then not v_man and o.airline = m.airline and o.pos = m.pos
                     and o.fleet is not distinct from m.fleet
                     and o.airline <> 'other'
             when 2 then not v_man and o.airline = m.airline and o.pos = m.pos
                     and o.cat is not distinct from m.cat
                     and o.airline <> 'other'
             when 3 then not v_man and o.airline = m.airline and o.pos = m.pos
                     and o.airline <> 'other'
             when 4 then not v_man and o.pos = m.pos
             when 5 then not v_man
           end
  ),

  -- ── はしごを1段ずつ数える ────────────────────────────────
  /* ★数えるのは**実人物**（human）。proof_hash ではない。
       proof_hash は本人 × 会社で1つなので、2社に出した1人が2人になり、
       実は1人しか居ないセルで中央値が出る＝その人の実額がそのまま出る。
     ★数えるのは「その段の中に、内訳を書いた月を持つ人」＝下の person と同じ条件。 */
  lvl as (
    select lv, count(*) as n
      from (select lv, human from tag group by lv, human having bool_or(det)) z
     group by lv
  ),
  -- ★壁（v_min）に届く段が1つも無ければ -1（空）。5段（全体）にも落とさない
  --   （約束⑤b）。落として広い区分の数字を狭い見出しのまま出すことはしない。
  -- ★2026-09-01、手で選んでいないときの落ち先も -1 にした（オーナー確定）。
  --   前は 5（全体）へ落ちていたので、壁に届く段が1つも無いほど人が少なくても
  --   「全体の年収中央値」が出た＝ほぼその数人の年収そのもの。
  pick as (select coalesce(min(lv), -1) as lv from lvl where n >= v_min),

  -- ── 採った段の月次行 ────────────────────────────────────
  -- ★-1（選んだ区分が壁に届かなかった）のときは1行も残らない。
  --   pick.lv = -1 に当たる tag が無いので自然にそうなる。
  mrow as (
    select t.* from tag t cross join pick k where t.lv = k.lv
  ),

  -- ── 1行＝1人（約束④）──────────────────────────────────
  -- 同じ人の複数月は、ここで中央値にして1行に潰す。
  -- ★割合は「1人ごとの割合」を先に出してから中央値にする。
  --   金額の中央値どうしを割ると、通貨の違う人が混ざったときに壊れる。
  --   割合なら各人が自分の通貨のまま計算できて、為替が1度も入らない（約束②）。
  -- ★group by は human。前は pkey（本人 × 会社）だったので、2社に出した人が
  --   2行になって「1行＝1人」が破れていた。
  -- ★会社・役職・機材はもう持たない。区分の判定は上の tag で終わっていて、
  --   ここから下の CTE はどれも使わない。持たせると「人の代表値で絞る」
  --   古いやり方に戻す入口になる。
  person as (
    select human,
           (percentile_cont(0.5) within group (order by usd))::numeric     as usd_y,
           (percentile_cont(0.5) within group (order by ubh))::numeric     as ubh,
           (percentile_cont(0.5) within group (order by block_h))::numeric as block_h,
           (percentile_cont(0.5) within group (order by duty_h))::numeric  as duty_h,
           (percentile_cont(0.5) within group (order by duty_d))::numeric  as duty_d,
           (percentile_cont(0.5) within group (order by stay_n))::numeric  as stay_n,
           (percentile_cont(0.5) within group (order by b_share))::numeric as b_share,
           /* その月の現金を USD にしたもの（賞与ぬき）。給与構成の
              「月額（中央値）」の材料はこれ1つだけ。
              ★割合は通貨をまたげるが金額はまたげない。annual_total_usd は
                投稿した瞬間のレートで確定していて後から動かないので、
                同じ人の割合と同じ土俵に乗る（約束②を壊さない）。
              ★賞与の割合が出せない人（fx_to_usd が無い）は null にして
                金額の集計から外す。0 とみなすと賞与のぶんだけ月額が太る。 */
           case when (percentile_cont(0.5) within group (order by b_share)) is null
                then null
                else (percentile_cont(0.5) within group (order by usd))::numeric
                     * greatest(1 - (percentile_cont(0.5)
                                     within group (order by b_share))::numeric, 0)
                     / 12
           end                                                             as ucm,
           /* ── 給与構成の割合（8本）────────────────────────────
              ★ここだけ filter (where det and not part) を掛ける
                （det は 2026-09-01・part は 2026-09-12）。
                内訳を書いていない月は「固定給 0%」ではなく**観測していない**。
                混ぜると、内訳を書いた月が少ない人ほど割合が低く出て、
                「1人が3か月出して内訳は1か月だけ」で固定給が 100% → 33% に化ける。
                会社どうしの比較が静かに壊れる（画面は普通に動いたまま）。
              ⚠️ 上の年収（usd_y）・Pay per Block Hour（ubh）・働き方（block_h /
                 duty_h / duty_d / stay_n）・賞与（b_share / ucm）には**掛けない。**
                 総支給しか書いていない月も、**内訳を一部だけ書いた月**も、
                 そちらの統計には引き続き使う（年収は総支給から出ていて欠けていない）。
              ⚠️ having は bool_or(det) のまま。part で母集団から人を落とすと、
                 その人の年収・時間あたりまで DEEP PAY から消える。
                 落とすのは**割合の計算に使う月**だけ。 */
           (percentile_cont(0.5) within group (order by a_base / cash_m)
              filter (where det and not part))::numeric as s_base,
           (percentile_cont(0.5) within group (order by a_gtee / cash_m)
              filter (where det and not part))::numeric as s_gtee,
           (percentile_cont(0.5) within group (order by a_var   / cash_m)
              filter (where det and not part))::numeric as s_var,
           (percentile_cont(0.5) within group (order by a_cmd   / cash_m)
              filter (where det and not part))::numeric as s_cmd,
           (percentile_cont(0.5) within group (order by a_role  / cash_m)
              filter (where det and not part))::numeric as s_role,
           (percentile_cont(0.5) within group (order by a_pd    / cash_m)
              filter (where det and not part))::numeric as s_pd,
           (percentile_cont(0.5) within group (order by a_house / cash_m)
              filter (where det and not part))::numeric as s_house,
           (percentile_cont(0.5) within group (order by a_other / cash_m)
              filter (where det and not part))::numeric as s_other,
           (percentile_cont(0.5) within group (order by
              greatest(cash_m - (a_base + a_gtee + a_var + a_cmd + a_role
                                 + a_pd + a_house + a_other), 0) / cash_m)
              filter (where det and not part))::numeric as s_rest
      from mrow
     group by human
    having bool_or(det)          -- 総支給だけの人は「給与の中身」の母集団に入れない
  ),

  -- ── 採った段の人たち ────────────────────────────────────
  -- ★名前だけ残してある（下の CTE 群が全部 coh を見ている）。
  coh as (select * from person),

  -- ── 見出しの数字 ────────────────────────────────────────
  /* ★この2つだけ pv_deep_step（刻み）を通す（2026-10-11・ファイル冒頭の約束③）。
       年収の中央値      … $50 刻み
       Pay / Block Hour … $0.5 刻み
     前は2つとも pv_sig2（有効数字2桁）だった。**丸める前の中央値は今も返さない。**
     ⚠️ 下の cnorm の月額（pv_sig2）まで刻みに替えない。あちらは項目ごとに
        人数の壁を掛け直している細かい数で、細かくするほど割り戻しやすくなる。
     ★n は**返さない**（2026-10-11）。使うのは下の thin（壁）と trust（信頼度の段）だけ。
       前はここで「明細の裏付けがある人数」も数えて返していた。それもやめた。 */
  hagg as (
    select public.pv_deep_step((percentile_cont(0.5) within group (order by usd_y))::numeric, 50) as annual,
           case when count(ubh) >= v_min
                then public.pv_deep_step((percentile_cont(0.5) within group (order by ubh))::numeric, 0.5) end as ubh,
           count(*) as n
      from coh
  ),

  /* ── 人数の門（オーナー必須修正2・2026-09-01）──────────────
     ★v_min 人に満たないときは「画面で隠す」のではなく**返り値に入れない。**
       関数を直接叩いても、壁に届かない区分の集計値は1つも取れない。
     ★伏せるのは head / comp / work / var の4つ。
       返してよいのは「非公開だと画面が判断するための材料」だけ ──
       ok / state / gate / give / stats / cohort（level・本人が渡した区分。
       信頼度の段 trust は、このとき null）。
     ★pick が -1 のときも人数が 0 でここが立つ。門が二重なのは意図的で、
       はしごの式を将来1行変えたときの最後の壁として残す。 */
  thin as (select coalesce((select n from hagg), 0) < v_min as x),

  /* ── 信頼度の段（2026-10-11）── 人数のかわりに返す、たった1つの値 ──
     式は、それまで画面（deep-pay.js）が持っていたものを**そのまま**移した
     （画面の側の式はもう無い。画面は返ってきた段を読むだけ）。
       人数の段   … 10人以上＝3 ／ 5人以上＝2 ／ それ未満＝1
       区分の上限 … 会社×役職×機材（段1）・会社×役職×機材区分（段2）＝3
                     会社×役職（段3）＝2 ／ 役職のみ（段4）・全体（段5）＝1
                     手で選んだ区分（段0）は、選んだ軸の数で同じに決める
                     （3つ＝3 ／ 2つ＝2 ／ 1つ＝1）
       低いほうを採って 3＝high ／ 2＝mid ／ 1＝low。
     ★人数だけで決めない。段4に12人そろっても、それは全社の副操縦士12人であって
       自分の会社の数字ではない（そうしないと、いちばんあてにならない状態が
       「信頼度 高」と出る）。
     ★壁に届かない区分・段が無いとき（none）は null。数字を1つも出していない
       区分に「信頼度 低」と付けると、低いなりに数字が在るように読める。
     ⚠️ ここの 10 と 5 は**段の境目**で、人数の壁（v_min）ではない。
        境目を増やさないこと ── 段が細かくなるほど、段から人数が読める。 */
  trust as (
    select case when (select x from thin) or k.lv = -1 then null
                else case least(
                            case when h.n >= 10 then 3 when h.n >= 5 then 2 else 1 end,
                            case k.lv
                              when 0 then case (v_air is not null)::int
                                               + (v_pos is not null)::int
                                               + (v_flt is not null)::int
                                            when 3 then 3 when 2 then 2 else 1 end
                              when 1 then 3
                              when 2 then 3
                              when 3 then 2
                              else 1 end)
                       when 3 then 'high' when 2 then 'mid' else 'low' end
           end as t
      from hagg h cross join pick k
  ),

  -- ── 給与構成 ────────────────────────────────────────────
  -- 生の中央値と「何人が書いたか」を並べて出しておき、門は次の CTE で掛ける。
  -- ★区分ぜんたいの人数はここで数えない（2026-10-11。返すのをやめたので使い道が無い）。
  --   下の b_n … u_an は**項目ごとの壁**に使う数で、どれも返り値には入らない。
  cagg as (
    select (percentile_cont(0.5) within group (order by s_base))::numeric  as b_raw,
           (percentile_cont(0.5) within group (order by s_gtee))::numeric  as g_raw,
           (percentile_cont(0.5) within group (order by s_var))::numeric   as v_raw,
           (percentile_cont(0.5) within group (order by s_cmd))::numeric   as c_raw,
           (percentile_cont(0.5) within group (order by s_role))::numeric  as r_raw,
           (percentile_cont(0.5) within group (order by s_pd))::numeric    as p_raw,
           (percentile_cont(0.5) within group (order by s_house))::numeric as h_raw,
           (percentile_cont(0.5) within group (order by s_other))::numeric as o_raw,
           (percentile_cont(0.5) within group (order by s_rest))::numeric  as u_raw,
           count(*) filter (where s_base  > 0) as b_n,
           count(*) filter (where s_gtee  > 0) as g_n,
           count(*) filter (where s_var   > 0) as v_n,
           count(*) filter (where s_cmd   > 0) as c_n,
           count(*) filter (where s_role  > 0) as r_n,
           count(*) filter (where s_pd    > 0) as p_n,
           count(*) filter (where s_house > 0) as h_n,
           count(*) filter (where s_other > 0) as o_n,
           /* 金額（月額・USD）。割合と違って通貨をまたげないので ucm で数える。
              ★人数の門は割合とは別に掛ける。ucm を持つ人だけで数え直すと
                壁（v_min）を割ることがあり、そのとき「1人の中央値＝その人の実額」になる。 */
           count(*) filter (where s_base  > 0 and ucm is not null) as b_an,
           count(*) filter (where s_gtee  > 0 and ucm is not null) as g_an,
           count(*) filter (where s_var   > 0 and ucm is not null) as v_an,
           count(*) filter (where s_cmd   > 0 and ucm is not null) as c_an,
           count(*) filter (where s_role  > 0 and ucm is not null) as r_an,
           count(*) filter (where s_pd    > 0 and ucm is not null) as p_an,
           count(*) filter (where s_house > 0 and ucm is not null) as h_an,
           count(*) filter (where s_other > 0 and ucm is not null) as o_an,
           count(*) filter (where s_rest  > 0 and ucm is not null) as u_an,
           (percentile_cont(0.5) within group (order by s_base  * ucm)
              filter (where ucm is not null))::numeric as b_amt,
           (percentile_cont(0.5) within group (order by s_gtee  * ucm)
              filter (where ucm is not null))::numeric as g_amt,
           (percentile_cont(0.5) within group (order by s_var   * ucm)
              filter (where ucm is not null))::numeric as v_amt,
           (percentile_cont(0.5) within group (order by s_cmd   * ucm)
              filter (where ucm is not null))::numeric as c_amt,
           (percentile_cont(0.5) within group (order by s_role  * ucm)
              filter (where ucm is not null))::numeric as r_amt,
           (percentile_cont(0.5) within group (order by s_pd    * ucm)
              filter (where ucm is not null))::numeric as p_amt,
           (percentile_cont(0.5) within group (order by s_house * ucm)
              filter (where ucm is not null))::numeric as h_amt,
           (percentile_cont(0.5) within group (order by s_other * ucm)
              filter (where ucm is not null))::numeric as o_amt,
           (percentile_cont(0.5) within group (order by s_rest  * ucm)
              filter (where ucm is not null))::numeric as u_amt
      from coh
  ),
  /* ★項目ごとにも人数の壁（v_min）。満たさない区分は **0 として並べず、未分類へ畳む。**
     比例配分で他の区分へ配ると、たとえば「住宅手当を書いたのが1人」というだけで
     固定給の割合が水増しされる。畳めば増えるのは灰色だけで、
     「まだ分けられていない」という正しい意味になる。
     ★畳んだぶん未分類の意味が変わるので、画面の凡例は
       「集計できなかった分を含む」と書くこと（書かないと灰色が嘘になる）。 */
  cnorm as (
    select public.pv_deep_pct(array[
             case when b_n >= v_min then coalesce(b_raw, 0) else 0 end,
             case when g_n >= v_min then coalesce(g_raw, 0) else 0 end,
             case when v_n >= v_min then coalesce(v_raw, 0) else 0 end,
             case when c_n >= v_min then coalesce(c_raw, 0) else 0 end,
             case when r_n >= v_min then coalesce(r_raw, 0) else 0 end,
             case when p_n >= v_min then coalesce(p_raw, 0) else 0 end,
             case when h_n >= v_min then coalesce(h_raw, 0) else 0 end,
             case when o_n >= v_min then coalesce(o_raw, 0) else 0 end,
             coalesce(u_raw, 0)
             + case when b_n >= v_min then 0 else coalesce(b_raw, 0) end
             + case when g_n >= v_min then 0 else coalesce(g_raw, 0) end
             + case when v_n >= v_min then 0 else coalesce(v_raw, 0) end
             + case when c_n >= v_min then 0 else coalesce(c_raw, 0) end
             + case when r_n >= v_min then 0 else coalesce(r_raw, 0) end
             + case when p_n >= v_min then 0 else coalesce(p_raw, 0) end
             + case when h_n >= v_min then 0 else coalesce(h_raw, 0) end
             + case when o_n >= v_min then 0 else coalesce(o_raw, 0) end
           ]) as pc,
           /* 金額は割合の「おまけ」。出す条件は割合より1つ厳しく、
              その区分に金額を書いた人が v_min 人以上いるときだけ。
              ★出ない区分は 0 ではなく null を返す（画面は「—」と出す）。
                0 と書くと「その手当が無い」と読めてしまう。
              ★ここは今も pv_sig2（有効数字2桁）。2026-10-11 に刻みへ替えたのは
                見出しの2つ（hagg）だけで、**月額は細かくしていない。** */
           case when b_n >= v_min and b_an >= v_min then public.pv_sig2(b_amt) end as b_usd,
           case when g_n >= v_min and g_an >= v_min then public.pv_sig2(g_amt) end as g_usd,
           case when v_n >= v_min and v_an >= v_min then public.pv_sig2(v_amt) end as v_usd,
           case when c_n >= v_min and c_an >= v_min then public.pv_sig2(c_amt) end as c_usd,
           case when r_n >= v_min and r_an >= v_min then public.pv_sig2(r_amt) end as r_usd,
           case when p_n >= v_min and p_an >= v_min then public.pv_sig2(p_amt) end as p_usd,
           case when h_n >= v_min and h_an >= v_min then public.pv_sig2(h_amt) end as h_usd,
           case when o_n >= v_min and o_an >= v_min then public.pv_sig2(o_amt) end as o_usd,
           /* ★未分類の金額は「1つも畳まれていない」ときしか出さない。
              畳んだ区分があるときの u_raw は畳むぶんを含んでいるが u_amt は
              含んでいない＝画面の割合と桁が合わない金額になる。 */
           case when u_an >= v_min
                 and b_n >= v_min and g_n >= v_min and v_n >= v_min and c_n >= v_min and r_n >= v_min
                 and p_n >= v_min and h_n >= v_min and o_n >= v_min
                then public.pv_sig2(u_amt) end as u_usd
      from cagg
  ),
  -- ★キーの並びは cnorm の配列と1対1。片方だけ足すと色と名前がずれる。
  cseg as (
    select coalesce(jsonb_agg(jsonb_build_object('k', t.k, 'pct', t.p,
                                                'med_usd', t.a)
                              order by t.p desc, t.i), '[]'::jsonb) as j
      from cnorm,
           unnest(array['base','guarantee','variable','command','role',
                        'perdiem','housing','other','rest'],
                  cnorm.pc,
                  array[cnorm.b_usd, cnorm.g_usd, cnorm.v_usd, cnorm.c_usd,
                        cnorm.r_usd, cnorm.p_usd, cnorm.h_usd, cnorm.o_usd,
                        cnorm.u_usd],
                  array[1,2,3,4,5,6,7,8,9]) as t(k, p, a, i)
     where t.p > 0
  ),
  /* 固定・保証給比率 ── 乗務量に左右されにくい現金だけ（基本給・保証手当・職位・役割）。
     パーディアムと変動給は飛んだぶんだけ動くので変動側。
     未分類は**変動側に数える**（分からないものを固定と言わない）。
     ★2026-09-01、ここから**住宅手当を外した**（オーナー確定）。
       住宅手当は働きに対する報酬ではなく住居の補填で、会社が現物の社宅を出す国では
       同じ待遇でも 0 になる。固定側に混ぜると「住宅手当が手厚い会社ほど固定給が高い」
       という読み違いが出て、会社どうしの比較が成り立たなくなる。
       ⚠️ 戻さない。戻すと db/test-deep-pay.mjs の
          「★固定・保証給比率＝基本給＋保証手当＋職位＋役割（住宅は入らない）」が落ちる。
     ★2026-09-15、区分を9つに割ったので**添字が1つずつ後ろへずれた**
       （旧 pc[1]+pc[3]+pc[4] ＝ 固定・職位・役割）。中身は同じもの。
     ★画面は「固定・保証給比率」と「変動給比率」の2つを出すが、
       **足して100にはならない**（住宅・パーディアム・その他が残る）。
       だから変動側は 100 − 固定 では出さず、配列の variable をそのまま読んでいる。 */
  cfix as (
    select case when pc is null then null
                else pc[1] + pc[2] + pc[4] + pc[5] end as pct
      from cnorm
  ),
  -- 賞与（ドーナツの外・オーナー確定）
  -- ★賞与を貰った人数は返さない（2026-10-11）。壁に使うだけ。
  bagg as (
    select case when count(b_share) filter (where b_share > 0) >= v_min
                then round((percentile_cont(0.5)
                            within group (order by b_share))::numeric * 100, 0) end as pct
      from coh
  ),

  -- ── 働き方（列ごとに v_min 人）─────────────────────────────
  wagg as (
    select case when count(block_h) >= v_min
                then round((percentile_cont(0.5) within group (order by block_h))::numeric, 1) end as block_h,
           case when count(duty_h) >= v_min
                then round((percentile_cont(0.5) within group (order by duty_h))::numeric, 1) end as duty_h,
           case when count(duty_d) >= v_min
                then round((percentile_cont(0.5) within group (order by duty_d))::numeric, 0) end as duty_d,
           case when count(stay_n) >= v_min
                then round((percentile_cont(0.5) within group (order by stay_n))::numeric, 0) end as stay_n
      from coh
  ),

  -- ── 変動給の中身 ────────────────────────────────────────
  -- pay_items.variable は [{amount, basis, label, rule}]。
  -- ★basis はサーバで検証していない（db/pay-reports.sql 5章は jsonb の型と
  --   長さしか見ない）。だから許可リストはここに置く。
  --   pay-report.html の option の値そのまま。
  -- ★許可リストに無い値は other へ寄せずに**捨てる**。
  --   打ち間違いを本物の答えに見せないため。
  -- ★★ night / weekend / holiday を1つにまとめないこと。★★
  --   まとめれば人数の壁を通りやすくなるので「整理」したくなるが、
  --   3つは別の働き方の対価で、混ぜると何が効いているのか分からなくなる。
  -- ★読むのは mrow（採った段の月次行）。sane 全体ではない（2026-09-01）。
  --   前は人のキーで sane を引き直していたので、CAP の人の FO だった月の
  --   変動給の内訳まで CAP の円グラフに入っていた。上の tag と同じ月だけを見る。
  vraw as (
    select s.human,
           it ->> 'basis'                          as basis,
           greatest((it ->> 'amount')::numeric, 0) as amt
      from mrow s
           cross join lateral jsonb_array_elements(
             case when jsonb_typeof(s.items -> 'variable') = 'array'
                  then s.items -> 'variable' else '[]'::jsonb end) it
     where it ->> 'basis' in ('block','duty','sector','overtime','reserve',
                              'night','weekend','holiday','other','unknown')
       and (it ->> 'amount') ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  -- ★人の単位も human。pkey（本人 × 会社）で割ると、2社に出した1人が
  --   2人ぶんの重みで円グラフに効く。
  vper as (
    select human, basis, sum(amt) as amt,
           sum(sum(amt)) over (partition by human) as tot
      from vraw group by human, basis
  ),
  vagg as (
    select basis,
           count(*) as n,
           (percentile_cont(0.5) within group (order by amt / tot))::numeric as sh
      from vper where tot > 0 group by basis
  ),
  -- v_min 人未満の区分は**配列ごと落とす**（pct 0 で並べない）
  vord as (
    select basis, sh, row_number() over (order by basis) as i
      from vagg where n >= v_min
  ),
  vpa as (
    select public.pv_deep_pct((select array_agg(sh order by i) from vord)) as a
  ),
  vpct as (
    select coalesce(jsonb_agg(jsonb_build_object('k', o.basis, 'pct', (vpa.a)[o.i])
                              order by (vpa.a)[o.i] desc, o.basis), '[]'::jsonb) as j
      from vord o, vpa
     where (vpa.a)[o.i] > 0
  ),

  -- ── 数え上げ（鍵が無い人にも返す）────────────────────────
  -- ★ここの日付は投稿された日でよい。「いつ投稿されたか」という別の問いで、
  --   上の sane（いつ時点の報酬か）とは違う（2026-09-01）。
  st as (
    select (select count(*) from public.pay_reports
             where created_at >= now() - interval '24 months')            as reports,
           (select count(*) from public.pay_reports
             where created_at >= now() - interval '30 days')              as month,
           (select count(distinct airline) from public.pay_reports
             where created_at >= now() - interval '24 months')            as airlines,
           v_ctb                                                          as contributors
  )

  select jsonb_build_object(
    'ok',    true,
    'state', case when v_open then 'open' else 'locked' end,
    /* ★gate は閉じているときも返す（画面が「何を出せば開くか」を言うための材料）。
         crowd … 「みんなの側」の条件（100人以上 or 手動フラグ）が満たされているか。
                  false のときだけ、画面は「100人に届いたら開く」の行を出してよい。
                  ⚠️ 画面が contributors と goal を比べて自分で決めないこと
                     （手動フラグで開けた日に食い違う。上の v_crd の注を読む）。
         contributors / goal は**サイト全体**の数。区分の人数ではない。
       ★ready / todo（2026-10-11）── 本人の側の門。前はここに「内訳が1つでもあるか」の
         真偽を1つ返していた。その鍵は**名前ごと外した**（古い画面が読みに来ても
         値が無い＝開いている側には倒れない）。
         ready … 門が読んでいるのと**同じ値**（v_rdy）。
                  公開より前から居て通った人（v_old）も true。**どの道で通ったかは返さない**
                  （画面が分ける理由が無い。この塊の鍵は6つのまま）。
         todo  … 足りない人にだけ { year, month, items:[コード…] }。
                  窓の中でいちばん新しい自分の1行の、残っている項目。
                  ready のとき・窓の中に自分の行が無いときは null。
                  ⚠️ 画面は items のコードを自分の言葉に直して出す。ここに日本語を持たない。
                  ⚠️ この塊に鍵を足さない（金額・会社・その行のほかの値は返さない）。 */
    'gate',  jsonb_build_object(
               'key',          v_key,
               'ready',        v_rdy,
               'todo',         v_todo,
               'crowd',        v_crd,
               'contributors', (select contributors from st),
               'goal',         v_goal),
    'give',  v_give,
    'stats', jsonb_build_object(
               'reports',      (select reports from st),
               'month',        (select month from st),
               'airlines',     (select airlines from st),
               'contributors', (select contributors from st)),

    /* ★選べる組み合わせ（画面の選択肢を絞るためだけの値）。
         鍵が開いているときだけ返す ── 閉じた画面は選択欄ごと出さないので
         要らないし、**渡していないものは隠せない**（pv_pay_rows の rows と同じ）。
       ★入っているのはコードだけ。人数も、どの組み合わせが何人かも返さない。
         鍵を持つ人は選択肢を1つずつ叩けば同じことが分かるので、新しく漏れる
         ものは無い（会社×職位×機材は pay_benchmarks が k≧5 で anon に公開済み）。
       ★選んだ区分（p）に影響されない。選ぶたびに一覧が入れ替わると、
         選び直しの途中で自分が今選んでいる値が消える。 */
    'picks', case when not v_open then null else (select j from avail_j) end,

    'cohort', case when not v_open then null else jsonb_build_object(
               'level',   (select case lv when 0 then 'selected'
                                          when 1 then 'airline_pos_fleet'
                                          when 2 then 'airline_pos_cat'
                                          when 3 then 'airline_pos'
                                          when 4 then 'pos'
                                          when 5 then 'all'
                                          else 'none' end from pick),
               'manual',  v_man,
               -- ★返すのは「選んだ本人が渡した値」か「呼んだ本人自身の値」だけ
               --   （約束⑥）。落ちてきた元の段の会社名は返さない。
               --   語彙に無い値が来たときは echo もしない。
               'airline', case when v_man then (case when v_bad then null else v_air end)
                               else (select airline from me) end,
               'pos',     case when v_man then (case when v_bad then null else v_pos end)
                               else (select pos from me) end,
               'fleet',   case when v_man then (case when v_bad then null else v_flt end)
                               else (select fleet from me) end,
               /* ★ここに在った人数を、信頼度の段に替えた（2026-10-11）。
                    high / mid / low。壁に届かない区分・段が無いときは null。
                  ⚠️ 人数のキーを足し戻さない（cohort にも head にも comp にも）。
                     自己点検 22 が、この関数のどこにも人数のキーが無いことを見ている。 */
               'trust',   (select t from trust)) end,

    /* ★ここから下の4つは「人が v_min 人に満たなければ1つも返さない」（thin）。
         年収中央値・Pay per Block Hour・給与構成・賞与率・Block Hours まで、
         個人の推定につながる値は**返り値そのものに入れない。**
         画面で隠すだけでは、関数を直接叩けば取れてしまう。 */
    'head', case when not v_open or (select x from thin) then null
                 else jsonb_build_object(
               'annual_usd',    (select annual from hagg),
               'per_block_usd', (select ubh from hagg),
               'fixed_pct',     (select pct from cfix)) end,

    'comp', case when not v_open or (select x from thin) then null else (
               select case when pc is null then null else jsonb_build_object(
                        'total_kind', 'monthly_cash',
                        'segs',       (select j from cseg),
                        'bonus',      (select case when pct is null then null
                                                   else jsonb_build_object(
                                                     'pct_of_annual', pct) end
                                         from bagg)
                      ) end from cnorm) end,

    'work', case when not v_open or (select x from thin) then null else (
               select jsonb_build_object(
                        'block_h',     block_h,
                        'duty_h',      duty_h,
                        'duty_days',   duty_d,
                        'stay_nights', stay_n) from wagg) end,

    'var',  case when not v_open or (select x from thin) then null
                 else (select j from vpct) end
  ) into v_out;

  return v_out;
end;
$fn$;

-- ★順番を変えないこと。revoke してから grant する。
revoke all on function public.pv_deep_pay(jsonb) from public, anon;
grant execute on function public.pv_deep_pay(jsonb) to authenticated;

comment on function public.pv_deep_pay(jsonb) is
  'DEEP PAY の画面が呼ぶ唯一の関数。会社・役職・機材を選べる（語彙に在る値だけ）。'
  '区分（会社×役職×機材から順に落とすはしご）ごとの中央値と、給与構成の割合を返す。'
  '個人の行は1件も返さない。その区分に何人いるかも返さない（返すのは信頼度の3段 cohort.trust だけ）。'
  '人数の壁は定数 v_min（2026-10-11 から2人）で、区分・列・項目ごとに掛かる。'
  '金額は丸めて返す ── 見出しの2つだけ刻み（年収の中央値＝$50・Pay / Block Hour＝$0.5。'
  '円でおよそ ¥8,000・¥80）、それ以外の金額は有効数字2桁。丸める前の中央値は返さない。'
  '内訳は割合で返す。'
  '鍵（access_until）と、本人が答えきっていること（gate.ready）の両方が要る。'
  '答えきった ＝ 自分に当てはまる項目をぜんぶ答えた自分の行が、直近24か月に1つ以上ある'
  '（2026-10-11 オーナー判断。線の中身は pv_deep_missing。前は「内訳が1つでもある」だった）。'
  'ただし公開（定数 v_launch）より前に出した自分の行で、基本給／保証手当・職務手当／変動給の3つに答えてあるものが'
  '同じ窓に在る人は、残りを答えていなくても開く（同じ日のオーナー判断。公開から先に出す行は、出し直しも含めてぜんぶ答えること）。'
  '区分の頭数に数えられる条件は今までどおり「内訳を書いた人」で、見る条件のほうが高い。'
  '足りないときは例外にせず state = locked を返す（画面が「何を出せば開くか」を出せるように）。'
  '足りない人には gate.todo（窓の中でいちばん新しい自分の1行の、年・月・残っている項目のコード）を返す。'
  'gate.crowd は「100人以上 or 正式公開フラグ」が満たされているか（門と同じ式の答え）。';


-- ════════════════════════════════════════════════════════════════
-- 自己点検 — オーナーが Supabase の SQL Editor に貼ったとき、
-- ここが全部 ✅ になっていれば貼れている。
-- ★1つの select にまとめる（SQL Editor は最後の結果しか出さない）。
-- ════════════════════════════════════════════════════════════════
with d as (select pg_get_functiondef('public.pv_deep_pay(jsonb)'::regprocedure) as s),
     -- ★db/pay-rows.sql:1240 の自己点検が使っている文字列と1字も違わないこと
     --   （numeric×6 → text → numeric×13）。写し間違えると、あちらを触っていないのに
     --   13番が ❌ になり、オーナーが「貼れていない」と誤解する。
     c as (select 'public.pv_pay_comp(numeric,numeric,numeric,numeric,numeric,'
                || 'numeric,text,numeric,numeric,numeric,numeric,numeric,'
                || 'numeric,numeric,numeric,numeric,numeric,numeric,numeric,'
                || 'numeric)' as sig)
select * from (
  select  1 as "#", '受け取る引数は jsonb 1つだけ（約束⑤）' as "見るもの",
          case when (select pronargs from pg_proc
                      where oid = 'public.pv_deep_pay(jsonb)'::regprocedure) = 1
               then '✅' else '❌' end as "答え"
  union all select  2, 'security definer で動く',
          case when (select prosecdef from pg_proc
                      where oid = 'public.pv_deep_pay(jsonb)'::regprocedure)
               then '✅' else '❌' end
  union all select  3, '未ログイン（anon）は呼べない',
          case when not has_function_privilege('anon', 'public.pv_deep_pay(jsonb)', 'execute')
               then '✅' else '❌' end
  union all select  4, 'ログイン済みは呼べる',
          case when has_function_privilege('authenticated', 'public.pv_deep_pay(jsonb)', 'execute')
               then '✅' else '❌' end
  union all select  5, '本人の鍵づくりは誰にも開いていない',
          case when not has_function_privilege('authenticated', 'public.pv_my_keys()', 'execute')
                and not has_function_privilege('anon', 'public.pv_my_keys()', 'execute')
               then '✅' else '❌' end
  union all select  6, '割合の正規化は誰にも開いていない',
          case when not has_function_privilege('authenticated', 'public.pv_deep_pct(numeric[])', 'execute')
                and not has_function_privilege('anon', 'public.pv_deep_pct(numeric[])', 'execute')
               then '✅' else '❌' end
  union all select  7, '鍵（access_until）を見ている',
          case when (select s from d) like '%access_until%' then '✅' else '❌' end
  union all select  8, '本人の Give の状態（pv_my_give）を、そのまま give として返している',
          -- ★2026-10-11 から、門はこれを読まない（門の側は 26 番が見ている）。
          --   画面へ返すのは今までどおりなので、呼んでいること・返していることを見る。
          case when (select s from d) like '%v_give := public.pv_my_give();%'
                and (select s from d) ~ '''give'',\s+v_give,'
               then '✅' else '❌' end
  union all select  9, '人数の壁は定数 v_min（＝2人）の1か所だけで、本文に人数の直書きが無い',
          -- 静かに壊れる。1か所だけ数字のまま残ると、その列だけ別の壁で出る
          -- （「選べるのに選ぶと空」か、壁に届かない列の実額が出るか）。見るのは3つ。
          --   ① 宣言が字面どおり（2026-10-11 から 2）
          --   ② 壁の比較が全部 v_min を見ている（「以上」が50か所・thin の「未満」が1か所）
          --   ③ 2 や 3 という数と直に比べている所が、本文に1つも無い
          --      （信頼度の段の境目 10 と 5 は壁ではないので当たらない）
          case when (select s from d) like '%v_min constant int := 2;%'
                and (length((select s from d))
                     - length(replace((select s from d), '>= v_min', ''))) / 8 >= 50
                and (select s from d) like '%< v_min as x%'
                and (select s from d) !~ '(>=|<=|<|>) *[23]\M'
               then '✅' else '❌' end
  union all select 10, '他人の投稿月・作成日時・ハッシュを返していない（約束⑥。月を返すのは gate.todo ＝ 本人の1行だけ）',
          -- ★2026-10-11 から、足りない本人にだけ「どの月の行か」を返す（gate.todo）。
          --   年の鍵が出てくるのはそこ1か所だけであること＝集計の側へ月が漏れていないこと。
          case when (select s from d) not like '%''period_month''%'
                and (select s from d) not like '%''created_at''%'
                and (select s from d) not like '%''proof_hash''%'
                and (length((select s from d))
                     - length(replace((select s from d), '''year''', ''))) / 6 = 1
               then '✅' else '❌' end
  union all select 11, '自由入力の社名を返していない（約束⑥）',
          case when (select s from d) not like '%''airline_other''%' then '✅' else '❌' end
  union all select 12, '選べる区分は語彙の中だけ（約束⑤a）',
          case when (select s from d) like '%pv_airlines%'
                and (select s from d) like '%pv_positions%'
                and (select s from d) like '%pv_fleets%'
               then '✅' else '❌' end
  union all select 13, '給与構成の月額は有効数字2桁を通している（約束③）',
          -- ★見出しの2つ（年収の中央値・Pay / Block Hour）は 2026-10-11 から刻み。
          --   そちらは 23 番が見ている。ここは「月額まで刻みに替えていない」の側。
          case when (length((select s from d))
                     - length(replace((select s from d), 'public.pv_sig2(', ''))) / 15 = 9
               then '✅' else '❌' end
  union all select 14, '旧 pv_pay_comp は 20 引数のまま（触っていない）',
          case when to_regprocedure((select sig from c)) is not null
               then '✅' else '❌' end
  union all select 15, '旧 pv_pay_comp は今も誰にも開いていない',
          case when to_regprocedure((select sig from c)) is null
                 or not has_function_privilege('authenticated', (select sig from c), 'execute')
               then '✅' else '❌' end
  union all select 16, '本番では試験用の抜け道が効かない',
          case when to_regclass('auth.users') is not null then '✅' else '❌' end
  union all select 17, '門に「100人に達したか」が入っている',
          case when (select s from d) like '%pv_deep_contributors%' then '✅' else '❌' end
  union all select 18, '人の対応表は誰にも開いていない',
          case when not has_function_privilege('authenticated', 'public.pv_pay_person_map()', 'execute')
                and not has_function_privilege('anon', 'public.pv_pay_person_map()', 'execute')
               then '✅' else '❌' end
  -- ── 2026-09-01 に足した3つ ────────────────────────────────
  union all select 19, '正式公開の手動フラグが門に入っている',
          -- 静かに壊れる。ここが抜けても100人以上の間は普通に開くので気づけず、
          -- 正式公開したあとに99人へ落ちた日、DEEP PAY が丸ごと消える。
          case when (select s from d) like '%pv_deep_launch%' then '✅' else '❌' end
  union all select 20, '人数の壁（v_min）に満たない区分では集計値を返さない（返り値そのもので伏せる）',
          -- 画面で隠すだけでは、関数を直接叩けば取れてしまう。
          case when (select s from d) like '%thin%'
                and (length((select s from d))
                     - length(replace((select s from d), 'from thin', ''))) / 9 >= 4
               then '✅' else '❌' end
  union all select 21, '★選べる組み合わせは、区分と同じ数え方で出している（閾値の写しが無い）',
          -- 静かに壊れる。ここがズレると「選択肢に出ているのに選ぶと空」になり、
          -- 画面は普通に動いたままなので誰も気づけない。見るのは4つ。
          --   ① 鍵が閉じているときは一覧そのものを渡していない
          --   ② 8通りの絞り方を1回で数えている（grouping sets）＝0段と同じ絞り方
          --   ③ 数え上げが「内訳を書いた月を持つ実人物」（行数でも proof_hash でもない）
          --   ④ 人数の壁が、選択肢の側（avail）と区分の側（lvl→pick）の
          --      両方で**同じ v_min** を見ている。片方だけ書き換えると落ちる。
          case when (select s from d) like '%''picks'', case when not v_open then null%'
                and (select s from d) like '%group by grouping sets%'
                and (select s from d) like '%where o.det%'
                and (select s from d) like '%count(distinct o.human) >= v_min%'
                and (select s from d) like '%where n >= v_min%'
               then '✅' else '❌' end
  -- ── 2026-10-11 に足した3つ ────────────────────────────────
  union all select 22, '★その区分に何人いるかを返していない（隠すのではなく渡さない）',
          -- 静かに戻る。画面は人数が来なくても動くので、キーを1つ足し戻しても
          -- どこも赤くならない。見るのは返り値のキーの字 ── 人数を運んでいた
          -- 3つの名前（区分・見出しの2つ）が、関数のどこにも無いこと。
          case when (select s from d) not like '%''n'',%'
                and (select s from d) not like '%''detailed_n''%'
                and (select s from d) not like '%''verified_n''%'
               then '✅' else '❌' end
  union all select 23, '見出しの2つ（年収の中央値・Pay / Block Hour）は刻みを通している（約束③）',
          -- $50 と $0.5。刻みの道具は誰にも開いていない。
          case when (select s from d) like '%public.pv_deep_step((percentile_cont(0.5) within group (order by usd_y))::numeric, 50)%'
                and (select s from d) like '%public.pv_deep_step((percentile_cont(0.5) within group (order by ubh))::numeric, 0.5)%'
                and not has_function_privilege('authenticated', 'public.pv_deep_step(numeric,numeric)', 'execute')
                and not has_function_privilege('anon', 'public.pv_deep_step(numeric,numeric)', 'execute')
               then '✅' else '❌' end
  union all select 24, '人数のかわりに信頼度の段（cohort.trust）と、門の理由（gate.crowd）を返している',
          -- crowd は門と**同じ値**（v_crd）を返していること。式を写して返すと、
          -- 門だけ直した日に「開いているのに 100人待ち と出る」が黙って起きる。
          case when (select s from d) ~ '''trust'',\s+\(select t from trust\)'
                and (select s from d) ~ '''crowd'',\s+v_crd,'
                and (select s from d) like '%v_crd  := (v_lch or v_ctb >= v_goal or v_byp);%'
                and (select s from d) like '%v_open := v_key and v_rdy and v_crd;%'
               then '✅' else '❌' end
  -- ── 2026-10-11 に足した5つ（見る資格 ── オーナー判断「ぜんぶ答えた人にだけ開く」）──
  union all select 25, '★答えきったかの判定（pv_deep_missing）が在って、誰にも開いていない',
          case when to_regprocedure('public.pv_deep_missing(public.pay_reports)') is not null
                and not has_function_privilege('authenticated', 'public.pv_deep_missing(public.pay_reports)', 'execute')
                and not has_function_privilege('anon', 'public.pv_deep_missing(public.pay_reports)', 'execute')
               then '✅' else '❌' end
  union all select 26, '★門は「答えきったか」を読んでいる（「内訳が1つでもある」は、もう門ではない）',
          -- 静かに戻る。前の線へ配線し直しても画面は普通に開くので、どこも赤くならない。
          -- 見るのは4つ。
          --   ① 門の式が 鍵・答えきったか・みんなの側 の3つの and
          --   ② 答えきったか（v_rdy）は「本人の行の答え or 運営」だけで出来ている
          --      ★本人の行の答えは2つ ── 答えきった行が在る（v_own）か、公開より前に
          --        内訳の3つに答えた行が在る（v_old。同じ日に足した。形は 30 番が見ている）
          --   ③ 本人の行の答えは、未回答が空の行が1つでもあるか（月をまたいで集めない）
          --   ④ 前の線の変数も、前の鍵の名前も、関数のどこにも残っていない
          case when (select s from d) like '%v_open := v_key and v_rdy and v_crd;%'
                and (select s from d) like '%v_rdy  := v_own or v_old or public.pv_is_operator();%'
                and (select s from d) like '%coalesce(bool_or(cardinality(m.miss) = 0), false)%'
                and (select s from d) like '%public.pv_deep_missing(r) as miss%'
                and (select s from d) not like '%v_det%'
                and (select s from d) not like '%''detailed''%'
               then '✅' else '❌' end
  union all select 27, '★門の答えを ready / todo で返している（todo は年・月・残っている項目のコードだけ）',
          -- ready は門と**同じ値**（v_rdy）。足りている人には todo を必ず null で返す。
          case when (select s from d) ~ '''ready'',\s+v_rdy,'
                and (select s from d) ~ '''todo'',\s+v_todo,'
                and (select s from d) like '%jsonb_build_object(''year'',  m.py,%'
                and (select s from d) like '%''items'', to_jsonb(m.miss))%'
                and (select s from d) like '%if v_rdy then v_todo := null; end if;%'
               then '✅' else '❌' end
  union all select 28, '★区分の頭数に数える条件（内訳を書いた人）は動かしていない ── 見る線を持ち込んでいない',
          -- 静かに壊れる。数える側へ「答えきったか」を持ち込むと頭数が減り、区分が
          -- いっせいに壁を割る（画面は「まだ出せません」と出るだけで、誰も気づけない）。
          --   ① 答えきったかの判定を呼ぶのは、見る資格の1か所だけ
          --      （「公開より前から居た人」も、その同じ1回の答えを読む。呼ぶ場所は今も1つ）
          --   ② 「内訳を書いたか」（det）の式が字面どおり
          --   ③ 頭数は今も det で数えている（人に潰す側の having・選択肢の側の where）
          case when (length((select s from d))
                     - length(replace((select s from d), 'pv_deep_missing(', ''))) / 16 = 1
                and (select s from d) ~ '\(r\.base_pay is not null or r\.guarantee_pay is not null\s+or r\.command_pay is not null or r\.pay_items is not null\) as det,'
                and (select s from d) like '%having bool_or(det)%'
                and (select s from d) like '%where o.det%'
               then '✅' else '❌' end
  union all select 29, '★見る側と数える側が、同じ直近24か月の窓を読んでいる（式の写しが無い）',
          -- 静かにずれる。片方だけ式を書き換えると、区分には入っている月で資格が
          -- 付かない（またはその逆）が、境目の1か月でだけ起きる。
          --   ① 窓の式は関数の頭の1か所（月数の式は1回しか出てこない）
          --   ② その2つの変数を読んでいるのは2か所（区分の本棚と、見る資格）
          case when (select s from d) like '%v_from  constant date := (date_trunc(''month'', now()) - interval ''23 months'')::date;%'
                and (select s from d) like '%v_to    constant date := date_trunc(''month'', now())::date;%'
                and (length((select s from d))
                     - length(replace((select s from d), 'interval ''23 months''', ''))) / 20 = 1
                and (length((select s from d))
                     - length(replace((select s from d), 'between v_from and v_to', ''))) / 23 = 2
               then '✅' else '❌' end
  -- ── 2026-10-11 に足した1つ（公開より前から居た人 ── オーナー判断「3つとも答えている人はそのまま開く」）──
  union all select 30, '★公開より前に内訳の3つ（基本給・保証手当・変動給）に答えていた人は開いたまま ── 境目は決め打ちの日時が1つだけ',
          -- 静かに壊れる。どちらへ壊れても画面は普通に動く。
          --   ・境目を現在時刻から作る形にすると、いつ来た人でも「前から居た人」に入り、
          --     上げた線が誰にも効かなくなる（3つだけで開く）。
          --   ・この決まりが抜けると、先に出してくれた人だけが、ある日閉め出される。
          -- 見るのは4つ。
          --   ① 境目の宣言は1つだけで、日時を字で書いた定数（現在時刻から作っていない）。
          --      ★日付の字そのものは見ていない ── 公開の日が決まったら、字だけ直して貼る。
          --   ② 「前」は、出した時刻が境目**より小さい**こと（ちょうどは前ではない）。
          --      境目と比べている所は1つだけ
          --   ③ 3つに答えたかは、答えきったかの判定の答えと、3つのコードの重なりで見ている
          --      （条件を書き写していない。判定を呼ぶ場所が増えていないことは 28 番）
          --   ④ 門が読む答え（v_rdy）は「答えきった or 公開より前の3つ or 運営」の3つの or
          case when (select s from d) ~ 'v_launch constant timestamptz := timestamptz ''[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\+09'';'
                and (length((select s from d))
                     - length(replace((select s from d), 'v_launch constant', ''))) / 17 = 1
                and (select s from d) like '%(r.created_at < v_launch) as early,%'
                and (length((select s from d))
                     - length(replace((select s from d), '< v_launch', ''))) / 10 = 1
                and (select s from d) ~ 'coalesce\(bool_or\(m\.early\s+and not \(m\.miss && array\[''base'', ''guarantee'', ''variable''\]\)\), false\),'
                and (select s from d) like '%into v_own, v_old, v_todo%'
                and (select s from d) like '%v_rdy  := v_own or v_old or public.pv_is_operator();%'
               then '✅' else '❌' end
) t order by "#";
