-- ════════════════════════════════════════════════════════════════════════
-- db/deep-pay.sql — DEEP PAY（給与の中身を集計して見る画面）のサーバ側
--
-- 貼る順番：db/pay-reports.sql → db/pay-rows.sql → **このファイル**
--   （pv_sig2 / pv_my_give / pv_contributors を使う）
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
--
-- ════════════════════════════════════════════════════════════════════════
-- 守っている約束（db/pay-rows.sql の①〜⑦をこの画面の形に写したもの）
--
--   ① Give → Get   鍵（access_until）と、本人が内訳を出していること（detailed）の
--                  両方が要る。REAL PAY より深い画面が、より弱い鍵で開いてはいけない。
--   ② 割合で返す    内訳は**割合**が主。金額は「画面に出ている丸めた年収 × 割合」でしか
--                  作れない形にする。1人ずつの実額を組み立てられないようにするため。
--   ③ 有効数字2桁   金額は pv_sig2 を通す。1円まで合う数字は個票の証拠になる。
--   ④ 1行＝1人      proof_hash で束ねてから中央値を取る。同じ人の6か月分は1人。
--   ⑤ 引数ゼロ      pv_deep_pay() は引数を取らない。引数だけが攻撃面になる。
--                  区分は**呼んだ本人の最新の1行**からサーバが決める。
--   ⑥ 準識別子ゼロ  投稿月・作成日時・proof_hash・自由入力の社名・年代・在籍年数は
--                  返さない。返すのは会社・役職・機材（＝呼んだ本人が既に知っている値）だけ。
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
--     3. そもそも5バケツ {m,b,d,h,o} では、この画面が要る8区分を表現できない。
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
-- 別々の人が3人以上そろう**最初の段**を採る。
--
-- ★ cohort.level を必ず返して画面に出すこと。隠すと読み手は
--   「自分の会社の数字だ」と思い込む。段4の数字を段1だと思って
--   転職を決める人が出る。**この画面でいちばん危ないのはそこ。**
-- ★ 返す会社・役職・機材は**呼んだ本人自身の値**。落ちてきた元の段の
--   会社名は返さない（約束⑥）。
--
-- ── なぜ n ≧ 3 か ────────────────────────────────────────
-- 待遇アンケート（db/airline-conditions.sql）と同じ閾値。
-- 書いた人が1人のセルで percentile を取ると、「中央値」と名乗ったまま
-- その1人の実数が公開される（db/pay-reports.sql の pay_benchmarks に
-- 同じ理由が書いてある）。
-- **区分ごと・列ごと・内訳の項目ごとに、それぞれ 3 を掛ける。**
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
-- ════════════════════════════════════════════════════════════════
drop function if exists public.pv_deep_pay();

create or replace function public.pv_deep_pay()
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
  v_det   boolean;
  v_open  boolean;
  v_out   jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select p.access_until into v_until from public.profiles p where p.id = v_uid;
  v_give := public.pv_my_give();

  -- ★門は2つとも要る（約束①）。
  --   access_until … REAL PAY と同じ90日の鍵。
  --   detailed     … 本人が内訳まで出していること。pv-gates.js に条件として
  --                  書いてあるが、今まで JS にしかなかった＝devtools で素通しできた。
  --                  ここが唯一の実装場所。
  -- ★ここで raise しない。投げると画面がエラーになり、
  --   「1枚出せば開く」という肝心の伝え方ができなくなる（pv_pay_rows と同じ）。
  v_key  := (v_until is not null and v_until > now());
  v_det  := coalesce((v_give ->> 'detailed')::boolean, false);
  v_open := v_key and v_det;

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
           (r.verify_level >= 1)            as vf,
           -- 内訳を書いたか。pv_my_give の detailed と**同じ条件**にそろえる
           (r.base_pay is not null or r.guarantee_pay is not null
            or r.command_pay is not null or r.pay_items is not null) as det,
           /* ── その月の現金（賞与ぬき）──────────────────────
              総支給がある人はそこから当月賞与を引く。無い人は
              pv_annual_total の第2分岐と**同じ並び**を12で割った形。
              ★あちらと1行ずつ揃えること。揃えないとドーナツの合計と
                年収カードが食い違う。 */
           case when nullif(r.gross_monthly, 0) is not null
                then greatest(r.gross_monthly - coalesce(r.bonus_month, 0), 0)
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
           -- ① 固定・保証給
           coalesce(r.base_pay, 0) + coalesce(r.guarantee_pay, 0)      as a_fixed,
           -- ② 変動給。書いていない人は「時給 × 実績と保証時間の大きい方」で見る
           --    （pv_annual_total と同じ建て付け）
           coalesce(r.flight_variable_pay,
                    coalesce(r.hourly_rate, 0)
                    * greatest(coalesce(r.block_hours, 0),
                               coalesce(r.guaranteed_hours, 0)))       as a_var,
           -- ③ 職位手当
           coalesce(r.command_pay, 0)                                  as a_cmd,
           -- ④ 役割手当（教官・審査・組合・管理・兼務）。どれも other_allowance の
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
              同じ罠を避けている。**外さないこと。** */
           greatest(coalesce(r.other_allowance, 0)
                    - coalesce(r.flight_variable_pay, 0), 0)
           + coalesce(r.transport, 0)                                  as a_other,
           /* 賞与は**ドーナツに入れない**（オーナー確定）。年収に対する割合を
              別行で1つだけ出すので、ここで1行ぶんの割合にしておく。
              年収は本人の通貨に戻してから割る（USD どうしでも同じ値になるが、
              fx_to_usd が無い行を確実に外すためこの形にする）。 */
           case when r.fx_to_usd is not null and r.fx_to_usd > 0
                 and r.annual_total_usd is not null and r.annual_total_usd > 0
                then (coalesce(r.bonus_annual, 0) + coalesce(r.profit_share_annual, 0)
                      + coalesce(r.bonus_month, 0) * 12)
                     / (r.annual_total_usd / r.fx_to_usd)
           end                                                          as b_share
      from public.pay_reports r
     where r.annual_total_usd is not null    -- レートの無い通貨は落ちる
       and r.annual_total_usd between 10000 and 700000   -- 約束⑦
       and r.created_at >= now() - interval '24 months'
  ),

  -- ── 1行＝1人（約束④）──────────────────────────────────
  -- 同じ人の複数月は、ここで中央値にして1行に潰す。
  -- ★割合は「1人ごとの割合」を先に出してから中央値にする。
  --   金額の中央値どうしを割ると、通貨の違う人が混ざったときに壊れる。
  --   割合なら各人が自分の通貨のまま計算できて、為替が1度も入らない（約束②）。
  person as (
    select pkey,
           mode() within group (order by airline) as airline,
           mode() within group (order by pos)     as pos,
           mode() within group (order by fleet)   as fleet,
           mode() within group (order by cat)     as cat,
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
           bool_or(vf)                                                     as vf,
           (percentile_cont(0.5) within group (order by a_fixed / cash_m))::numeric as s_fixed,
           (percentile_cont(0.5) within group (order by a_var   / cash_m))::numeric as s_var,
           (percentile_cont(0.5) within group (order by a_cmd   / cash_m))::numeric as s_cmd,
           (percentile_cont(0.5) within group (order by a_role  / cash_m))::numeric as s_role,
           (percentile_cont(0.5) within group (order by a_pd    / cash_m))::numeric as s_pd,
           (percentile_cont(0.5) within group (order by a_house / cash_m))::numeric as s_house,
           (percentile_cont(0.5) within group (order by a_other / cash_m))::numeric as s_other,
           (percentile_cont(0.5) within group (order by
              greatest(cash_m - (a_fixed + a_var + a_cmd + a_role
                                 + a_pd + a_house + a_other), 0) / cash_m))::numeric as s_rest
      from sane
      /* 1人分の検品：現金が無い／内訳が現金をはみ出している行は割合に混ぜない。
         はみ出しは本人の書き間違いで、こちらで按分すると嘘の内訳になる。
         2%までは丸めの誤差として通す（給与フォームも合計一致を強制していない）。
         落とした数はどこにも出さない（出すと「何人が変な書き方をしたか」が漏れる）。 */
     where cash_m is not null and cash_m > 0
       and (a_fixed + a_var + a_cmd + a_role + a_pd + a_house + a_other)
           <= cash_m * 1.02
     group by pkey
    having bool_or(det)          -- 総支給だけの人は「給与の中身」の母集団に入れない
  ),

  -- ── はしごを1段ずつ数える ────────────────────────────────
  lvl as (
    select 1 as lv, count(*) as n from person p, me m
      where p.airline = m.airline and p.pos = m.pos
        and p.fleet is not distinct from m.fleet
        and p.airline <> 'other'
    union all
    select 2, count(*) from person p, me m
      where p.airline = m.airline and p.pos = m.pos
        and p.cat is not distinct from m.cat
        and p.airline <> 'other'
    union all
    select 3, count(*) from person p, me m
      where p.airline = m.airline and p.pos = m.pos
        and p.airline <> 'other'
    union all
    select 4, count(*) from person p, me m
      where p.pos = m.pos
    union all
    select 5, count(*) from person
  ),
  pick as (select coalesce(min(lv), 5) as lv from lvl where n >= 3),

  -- ── 採った段の人たち ────────────────────────────────────
  -- ★自由入力の社名（airline = 'other'）は 1〜3段では外す。
  --   別々の会社の答えが other という1社に潰れて混ざるため
  --   （db/pay-reports.sql の pay_benchmarks に同じ理由が書いてある）。
  -- ★lvl 側の条件と1行ずつ同じにすること。ずれると
  --   「3人そろったと数えた段に2人しか居ない」が起きる。
  coh as (
    -- ★me を left join にする。呼んだ本人がまだ1枚も出していないとき、
    --   cross join だと段5（全体）まで空になる。門は detailed を要求するので
    --   実際には起きないが、門を緩めた回に静かに全部消える形は残さない。
    select p.* from person p cross join pick k left join me m on true
     where case k.lv
             when 1 then p.airline = m.airline and p.pos = m.pos
                         and p.fleet is not distinct from m.fleet
                         and p.airline <> 'other'
             when 2 then p.airline = m.airline and p.pos = m.pos
                         and p.cat is not distinct from m.cat
                         and p.airline <> 'other'
             when 3 then p.airline = m.airline and p.pos = m.pos
                         and p.airline <> 'other'
             when 4 then p.pos = m.pos
             else true
           end
  ),

  -- ── 見出しの数字 ────────────────────────────────────────
  hagg as (
    select public.pv_sig2((percentile_cont(0.5) within group (order by usd_y))::numeric) as annual,
           case when count(ubh) >= 3
                then public.pv_sig2((percentile_cont(0.5) within group (order by ubh))::numeric) end as ubh,
           count(*) as n,
           count(*) filter (where vf) as vfn
      from coh
  ),

  -- ── 給与構成 ────────────────────────────────────────────
  -- 生の中央値と「何人が書いたか」を並べて出しておき、門は次の CTE で掛ける。
  cagg as (
    select count(*)                                                     as n,
           (percentile_cont(0.5) within group (order by s_fixed))::numeric as f_raw,
           (percentile_cont(0.5) within group (order by s_var))::numeric   as v_raw,
           (percentile_cont(0.5) within group (order by s_cmd))::numeric   as c_raw,
           (percentile_cont(0.5) within group (order by s_role))::numeric  as r_raw,
           (percentile_cont(0.5) within group (order by s_pd))::numeric    as p_raw,
           (percentile_cont(0.5) within group (order by s_house))::numeric as h_raw,
           (percentile_cont(0.5) within group (order by s_other))::numeric as o_raw,
           (percentile_cont(0.5) within group (order by s_rest))::numeric  as u_raw,
           count(*) filter (where s_fixed > 0) as f_n,
           count(*) filter (where s_var   > 0) as v_n,
           count(*) filter (where s_cmd   > 0) as c_n,
           count(*) filter (where s_role  > 0) as r_n,
           count(*) filter (where s_pd    > 0) as p_n,
           count(*) filter (where s_house > 0) as h_n,
           count(*) filter (where s_other > 0) as o_n,
           /* 金額（月額・USD）。割合と違って通貨をまたげないので ucm で数える。
              ★人数の門は割合とは別に掛ける。ucm を持つ人だけで数え直すと
                3 を割ることがあり、そのとき「2人の中央値＝その人の実額」になる。 */
           count(*) filter (where s_fixed > 0 and ucm is not null) as f_an,
           count(*) filter (where s_var   > 0 and ucm is not null) as v_an,
           count(*) filter (where s_cmd   > 0 and ucm is not null) as c_an,
           count(*) filter (where s_role  > 0 and ucm is not null) as r_an,
           count(*) filter (where s_pd    > 0 and ucm is not null) as p_an,
           count(*) filter (where s_house > 0 and ucm is not null) as h_an,
           count(*) filter (where s_other > 0 and ucm is not null) as o_an,
           count(*) filter (where s_rest  > 0 and ucm is not null) as u_an,
           (percentile_cont(0.5) within group (order by s_fixed * ucm)
              filter (where ucm is not null))::numeric as f_amt,
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
  /* ★項目ごとにも n ≧ 3。満たさない区分は **0 として並べず、未分類へ畳む。**
     比例配分で他の区分へ配ると、たとえば「住宅手当を書いたのが2人」というだけで
     固定給の割合が水増しされる。畳めば増えるのは灰色だけで、
     「まだ分けられていない」という正しい意味になる。
     ★畳んだぶん未分類の意味が変わるので、画面の凡例は
       「集計できなかった分を含む」と書くこと（書かないと灰色が嘘になる）。 */
  cnorm as (
    select n,
           public.pv_deep_pct(array[
             case when f_n >= 3 then coalesce(f_raw, 0) else 0 end,
             case when v_n >= 3 then coalesce(v_raw, 0) else 0 end,
             case when c_n >= 3 then coalesce(c_raw, 0) else 0 end,
             case when r_n >= 3 then coalesce(r_raw, 0) else 0 end,
             case when p_n >= 3 then coalesce(p_raw, 0) else 0 end,
             case when h_n >= 3 then coalesce(h_raw, 0) else 0 end,
             case when o_n >= 3 then coalesce(o_raw, 0) else 0 end,
             coalesce(u_raw, 0)
             + case when f_n >= 3 then 0 else coalesce(f_raw, 0) end
             + case when v_n >= 3 then 0 else coalesce(v_raw, 0) end
             + case when c_n >= 3 then 0 else coalesce(c_raw, 0) end
             + case when r_n >= 3 then 0 else coalesce(r_raw, 0) end
             + case when p_n >= 3 then 0 else coalesce(p_raw, 0) end
             + case when h_n >= 3 then 0 else coalesce(h_raw, 0) end
             + case when o_n >= 3 then 0 else coalesce(o_raw, 0) end
           ]) as pc,
           /* 金額は割合の「おまけ」。出す条件は割合より1つ厳しく、
              その区分に金額を書いた人が3人以上いるときだけ。
              ★出ない区分は 0 ではなく null を返す（画面は「—」と出す）。
                0 と書くと「その手当が無い」と読めてしまう。 */
           case when f_n >= 3 and f_an >= 3 then public.pv_sig2(f_amt) end as f_usd,
           case when v_n >= 3 and v_an >= 3 then public.pv_sig2(v_amt) end as v_usd,
           case when c_n >= 3 and c_an >= 3 then public.pv_sig2(c_amt) end as c_usd,
           case when r_n >= 3 and r_an >= 3 then public.pv_sig2(r_amt) end as r_usd,
           case when p_n >= 3 and p_an >= 3 then public.pv_sig2(p_amt) end as p_usd,
           case when h_n >= 3 and h_an >= 3 then public.pv_sig2(h_amt) end as h_usd,
           case when o_n >= 3 and o_an >= 3 then public.pv_sig2(o_amt) end as o_usd,
           /* ★未分類の金額は「1つも畳まれていない」ときしか出さない。
              畳んだ区分があるときの u_raw は畳むぶんを含んでいるが u_amt は
              含んでいない＝画面の割合と桁が合わない金額になる。 */
           case when u_an >= 3
                 and f_n >= 3 and v_n >= 3 and c_n >= 3 and r_n >= 3
                 and p_n >= 3 and h_n >= 3 and o_n >= 3
                then public.pv_sig2(u_amt) end as u_usd
      from cagg
  ),
  -- ★キーの並びは cnorm の配列と1対1。片方だけ足すと色と名前がずれる。
  cseg as (
    select coalesce(jsonb_agg(jsonb_build_object('k', t.k, 'pct', t.p,
                                                'med_usd', t.a)
                              order by t.p desc, t.i), '[]'::jsonb) as j
      from cnorm,
           unnest(array['fixed','variable','command','role',
                        'perdiem','housing','other','rest'],
                  cnorm.pc,
                  array[cnorm.f_usd, cnorm.v_usd, cnorm.c_usd, cnorm.r_usd,
                        cnorm.p_usd, cnorm.h_usd, cnorm.o_usd, cnorm.u_usd],
                  array[1,2,3,4,5,6,7,8]) as t(k, p, a, i)
     where t.p > 0
  ),
  /* 固定給比率 ── 飛ばなくても出る4つ（固定・職位・役割・住宅）。
     パーディアムと変動給は飛んだぶんだけ動くので変動側。
     未分類は**変動側に数える**（分からないものを固定と言わない）。
     ★画面は「固定給比率」と「変動給比率」の2つを出すが、
       足して100になるのはここで1つの配列から出しているから。 */
  cfix as (
    select case when pc is null then null
                else pc[1] + pc[3] + pc[4] + pc[6] end as pct
      from cnorm
  ),
  -- 賞与（ドーナツの外・オーナー確定）
  bagg as (
    select case when count(b_share) filter (where b_share > 0) >= 3
                then round((percentile_cont(0.5)
                            within group (order by b_share))::numeric * 100, 0) end as pct,
           count(b_share) filter (where b_share > 0) as n
      from coh
  ),

  -- ── 働き方（列ごとに n ≧ 3）───────────────────────────────
  wagg as (
    select case when count(block_h) >= 3
                then round((percentile_cont(0.5) within group (order by block_h))::numeric, 1) end as block_h,
           case when count(duty_h) >= 3
                then round((percentile_cont(0.5) within group (order by duty_h))::numeric, 1) end as duty_h,
           case when count(duty_d) >= 3
                then round((percentile_cont(0.5) within group (order by duty_d))::numeric, 0) end as duty_d,
           case when count(stay_n) >= 3
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
  --   まとめれば n ≧ 3 を通りやすくなるので「整理」したくなるが、
  --   3つは別の働き方の対価で、混ぜると何が効いているのか分からなくなる。
  vraw as (
    select s.pkey,
           it ->> 'basis'                          as basis,
           greatest((it ->> 'amount')::numeric, 0) as amt
      from sane s
           cross join lateral jsonb_array_elements(
             case when jsonb_typeof(s.items -> 'variable') = 'array'
                  then s.items -> 'variable' else '[]'::jsonb end) it
     where s.pkey in (select pkey from coh)
       and it ->> 'basis' in ('block','duty','sector','overtime','reserve',
                              'night','weekend','holiday','other','unknown')
       and (it ->> 'amount') ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  vper as (
    select pkey, basis, sum(amt) as amt,
           sum(sum(amt)) over (partition by pkey) as tot
      from vraw group by pkey, basis
  ),
  vagg as (
    select basis,
           count(*) as n,
           (percentile_cont(0.5) within group (order by amt / tot))::numeric as sh
      from vper where tot > 0 group by basis
  ),
  -- 3人未満の区分は**配列ごと落とす**（pct 0 で並べない）
  vord as (
    select basis, sh, row_number() over (order by basis) as i
      from vagg where n >= 3
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
  st as (
    select (select count(*) from public.pay_reports
             where created_at >= now() - interval '24 months')            as reports,
           (select count(*) from public.pay_reports
             where created_at >= now() - interval '30 days')              as month,
           (select count(distinct airline) from public.pay_reports
             where created_at >= now() - interval '24 months')            as airlines,
           public.pv_contributors()                                        as contributors
  )

  select jsonb_build_object(
    'ok',    true,
    'state', case when v_open then 'open' else 'locked' end,
    'gate',  jsonb_build_object(
               'key',          v_key,
               'detailed',     v_det,
               'contributors', (select contributors from st),
               'goal',         100),
    'give',  v_give,
    'stats', jsonb_build_object(
               'reports',      (select reports from st),
               'month',        (select month from st),
               'airlines',     (select airlines from st),
               'contributors', (select contributors from st)),

    'cohort', case when not v_open then null else jsonb_build_object(
               'level',   (select case lv when 1 then 'airline_pos_fleet'
                                          when 2 then 'airline_pos_cat'
                                          when 3 then 'airline_pos'
                                          when 4 then 'pos'
                                          else 'all' end from pick),
               -- ★返すのは呼んだ本人自身の値だけ（約束⑥）。
               --   落ちてきた元の段の会社名は返さない。
               'airline', (select airline from me),
               'pos',     (select pos from me),
               'fleet',   (select fleet from me),
               'n',       (select n from hagg)) end,

    'head', case when not v_open then null else jsonb_build_object(
               'annual_usd',    (select annual from hagg),
               'per_block_usd', (select ubh from hagg),
               'detailed_n',    (select n from hagg),
               'verified_n',    (select vfn from hagg),
               'fixed_pct',     (select pct from cfix)) end,

    'comp', case when not v_open then null else (
               select case when pc is null then null else jsonb_build_object(
                        'total_kind', 'monthly_cash',
                        'n',          n,
                        'segs',       (select j from cseg),
                        'bonus',      (select case when pct is null then null
                                                   else jsonb_build_object(
                                                     'pct_of_annual', pct, 'n', n) end
                                         from bagg)
                      ) end from cnorm) end,

    'work', case when not v_open then null else (
               select jsonb_build_object(
                        'block_h',     block_h,
                        'duty_h',      duty_h,
                        'duty_days',   duty_d,
                        'stay_nights', stay_n) from wagg) end,

    'var',  case when not v_open then null else (select j from vpct) end
  ) into v_out;

  return v_out;
end;
$fn$;

-- ★順番を変えないこと。revoke してから grant する。
revoke all on function public.pv_deep_pay() from public, anon;
grant execute on function public.pv_deep_pay() to authenticated;

comment on function public.pv_deep_pay() is
  'DEEP PAY の画面が呼ぶ唯一の関数。引数ゼロ。'
  '区分（会社×役職×機材から順に落とすはしご）ごとの中央値と、給与構成の割合を返す。'
  '個人の行は1件も返さない。金額は有効数字2桁。内訳は割合で返す。'
  '鍵（access_until）と本人の内訳（pv_my_give の detailed）の両方が要る。'
  '足りないときは例外にせず state = locked を返す（画面が「何を出せば開くか」を出せるように）。';


-- ════════════════════════════════════════════════════════════════
-- 自己点検 — オーナーが Supabase の SQL Editor に貼ったとき、
-- ここが全部 ✅ になっていれば貼れている。
-- ★1つの select にまとめる（SQL Editor は最後の結果しか出さない）。
-- ════════════════════════════════════════════════════════════════
with d as (select pg_get_functiondef('public.pv_deep_pay()'::regprocedure) as s),
     -- ★db/pay-rows.sql:1240 の自己点検が使っている文字列と1字も違わないこと
     --   （numeric×6 → text → numeric×13）。写し間違えると、あちらを触っていないのに
     --   13番が ❌ になり、オーナーが「貼れていない」と誤解する。
     c as (select 'public.pv_pay_comp(numeric,numeric,numeric,numeric,numeric,'
                || 'numeric,text,numeric,numeric,numeric,numeric,numeric,'
                || 'numeric,numeric,numeric,numeric,numeric,numeric,numeric,'
                || 'numeric)' as sig)
select * from (
  select  1 as "#", '引数ゼロ（約束⑤）' as "見るもの",
          case when (select pronargs from pg_proc
                      where oid = 'public.pv_deep_pay()'::regprocedure) = 0
               then '✅' else '❌' end as "答え"
  union all select  2, 'security definer で動く',
          case when (select prosecdef from pg_proc
                      where oid = 'public.pv_deep_pay()'::regprocedure)
               then '✅' else '❌' end
  union all select  3, '未ログイン（anon）は呼べない',
          case when not has_function_privilege('anon', 'public.pv_deep_pay()', 'execute')
               then '✅' else '❌' end
  union all select  4, 'ログイン済みは呼べる',
          case when has_function_privilege('authenticated', 'public.pv_deep_pay()', 'execute')
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
  union all select  8, '本人が内訳を出したかを見ている',
          case when (select s from d) like '%pv_my_give%' then '✅' else '❌' end
  union all select  9, 'n ≧ 3 の門が8か所以上ある',
          case when (length((select s from d))
                     - length(replace((select s from d), '>= 3', ''))) / 4 >= 8
               then '✅' else '❌' end
  union all select 10, '投稿月・作成日時を返していない（約束⑥）',
          case when (select s from d) not like '%''period_month''%'
                and (select s from d) not like '%''created_at''%'
                and (select s from d) not like '%''proof_hash''%'
               then '✅' else '❌' end
  union all select 11, '自由入力の社名を返していない（約束⑥）',
          case when (select s from d) not like '%''airline_other''%' then '✅' else '❌' end
  union all select 12, '金額は有効数字2桁を通している（約束③）',
          case when (select s from d) like '%pv_sig2%' then '✅' else '❌' end
  union all select 13, '旧 pv_pay_comp は 20 引数のまま（触っていない）',
          case when to_regprocedure((select sig from c)) is not null
               then '✅' else '❌' end
  union all select 14, '旧 pv_pay_comp は今も誰にも開いていない',
          case when to_regprocedure((select sig from c)) is null
                 or not has_function_privilege('authenticated', (select sig from c), 'execute')
               then '✅' else '❌' end
) t order by "#";
