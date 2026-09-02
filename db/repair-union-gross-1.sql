-- ════════════════════════════════════════════════════════════════
-- 【1／3】確認 — どの行が直るかを見る（読むだけ。1文字も書き換えない）
--
-- 「組合が総支給の外で払った分が年収から丸ごと落ちている行」を入れ直す作業の1枚目。
-- 3枚に分かれている（オーナーが1枚ずつ貼れるように）:
--     db/repair-union-gross-1.sql  ← いまここ（確認・読むだけ）
--     db/repair-union-gross-2.sql     入れ直す
--     db/repair-union-gross-3.sql     検算
--
-- 2026-09-02。乗員代表の方が「会社からの分」と「組合からの分」を別々に書いたところ、
-- 年収が半分ほどに出ていた。本人は画面の指示どおりに書いている ──
-- 総支給の欄の案内は「明細に出ているそのままの額」で、組合が直接払った分は
-- 会社の明細に印字されないので、そこには入らない。
--
-- 真因は pv_annual_total で、総支給がある行では内訳の枝を一切評価しない。
-- 組合の額を足していたのはその内訳の枝だけだった（総支給は必須項目なので、
-- Web からの投稿では実質いつも評価されない）。
-- 直したあとは pv_union_outside_gross(pay_items) が真の行だけ、総支給に組合の分を足す。
--
-- ★この3枚は年収の派生列（annual_total_* / usd_per_block_hour / net_annual_jpy）
--   しか触らない。本人が書いた金額の列（gross_monthly / union_pay / …）は
--   1つも書き換えない。行の追加も削除もしない。
-- ★預かり（pay_reports_pending）には何もしない。あちらは年収を保存しておらず、
--   読むたびに pv_pending_usd が計算する＝関数を貼り替えた時点でもう直っている。
-- ★この3枚に uuid もメールアドレスも金額も書かない
--   （このリポジトリは PUBLIC。commit したものは後から消しても履歴に残る）。
--
-- 実行: Supabase → SQL Editor に全部貼って RUN
-- ════════════════════════════════════════════════════════════════

-- ── 関所：関数を先に貼ったか ────────────────────────────────
-- db/pay-reports.sql を貼る前にこの3枚を流すと、古い20引数の pv_annual_total が
-- 「直したあとの年収」として今と同じ値を返す＝0行に見えて「もう直っている」と
-- 読み違える。先にそれを潰す。
do $$
begin
  if (select count(*) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'pv_annual_total'
         and p.pronargs = 21) <> 1 then
    raise exception 'pv_annual_total が21引数版になっていない。先に db/pay-reports.sql を貼ること';
  end if;
  if to_regprocedure('public.pv_union_outside_gross(jsonb)') is null then
    raise exception 'pv_union_outside_gross が無い。先に db/pay-reports.sql を貼ること';
  end if;
  if to_regprocedure('public.pv_block_hour_usd(numeric,numeric,numeric,numeric,boolean)') is null then
    raise exception 'pv_block_hour_usd が無い。先に db/pay-reports.sql を貼り直すこと';
  end if;
  raise notice '関数は新しい側。このまま下の一覧を読んでよい';
end $$;

-- ── 対象の一覧 ──────────────────────────────────────────────
-- 「支給元＝組合／その他」かつ「別に受け取っている（extra=yes）」の行だけ。
-- 会社払い（airline）・両方（both）・未回答は総支給の中にあるので対象外。
select r.airline                                     as 航空会社,
       r.fleet                                       as 機材,
       r.position                                    as 職位,
       r.period_year || '-' || lpad(r.period_month::text, 2, '0') as 対象月,
       r.currency                                    as 通貨,
       r.annual_total_orig                           as いまの年収,
       public.pv_annual_total(
         r.gross_monthly, r.base_pay, r.hourly_rate, r.guaranteed_hours,
         r.block_hours, r.per_diem, r.housing_type, r.housing_amount,
         r.transport, r.command_pay, r.other_allowance,
         r.bonus_annual, r.profit_share_annual,
         r.bonus_month, r.guarantee_pay, r.instructor_pay, r.examiner_pay,
         r.union_pay, r.management_pay, r.nonline_pay,
         public.pv_union_outside_gross(r.pay_items))  as 直したあとの年収,
       r.tax_rate_pct                                as いまの税率pct,
       r.block_hours                                 as 飛んだ時間,
       r.usd_per_block_hour                          as いまの時間あたりUSD,
       public.pv_block_hour_usd(
         public.pv_annual_total(
           r.gross_monthly, r.base_pay, r.hourly_rate, r.guaranteed_hours,
           r.block_hours, r.per_diem, r.housing_type, r.housing_amount,
           r.transport, r.command_pay, r.other_allowance,
           r.bonus_annual, r.profit_share_annual,
           r.bonus_month, r.guarantee_pay, r.instructor_pay, r.examiner_pay,
           r.union_pay, r.management_pay, r.nonline_pay,
           public.pv_union_outside_gross(r.pay_items)),
         r.fx_to_usd, r.block_hours,
         r.union_pay, public.pv_union_outside_gross(r.pay_items)) as 直したあとの時間あたりUSD
  from public.pay_reports r
 where public.pv_union_outside_gross(r.pay_items)
 order by r.created_at;

/* 読み方：
     ・**1行**出るはず（2026-09-02 に本番を読んで確認した数）。
       1行で、かつ「直したあとの年収」が「いまの年収」より大きければ 2／3 へ進む。
     ・行数が違ったら止める。2／3 は「ちょうど1行」でなければ
       1文字も書き換えずにエラーで巻き戻るので、勝手に壊れることはない。
       増えていた場合は、その人数を 2／3 の v_expect に書いてから流す。
     ・0行なら何もしなくてよい（関所を通っている＝関数は新しい側なので、
       「まだ古い関数だから0行」ではない）。
     ・「時間あたりUSD」は年収では割らない。組合が総支給の外で払った分は
       乗務の対価ではないので分子から抜いてある（2026-09-02 オーナー判断）。
       ＝年収が上がっても、時間あたりはほとんど動かないのが正しい。
       ⚠️ ここが跳ねていたら pv_block_hour_usd を呼べていない（貼り直しを疑う）。 */
