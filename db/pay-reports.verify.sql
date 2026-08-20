-- ════════════════════════════════════════════════════════════════
-- db/pay-reports.verify.sql — 検算を1回の Run で全部見る
--
-- pay-reports.sql の「8. 検算」は select が8本並んでいるが、Supabase の
-- SQL Editor は最後の1文の結果しか表示しない。＝ 8-1〜8-7 が見えないまま
-- 「通った」と誤認できてしまう。ここでは10項目を1つの結果表にまとめ、
-- 期待値との一致を 判定 列で出す。スキーマを触るたびに流し直す。
--
-- 期待：10行すべて 判定 = ✅
-- ════════════════════════════════════════════════════════════════

with c as (
  select
    -- 個人に辿り着ける列が無いこと
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'pay_reports'
        and column_name in ('user_id', 'uid', 'email'))                        as c1,
    -- 個票を読めるポリシーが1本も無いこと
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'pay_reports')               as c2,
    -- RLS が有効なこと
    (select count(*) from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
      where n.nspname = 'public' and cl.relname = 'pay_reports'
        and cl.relrowsecurity)                                                 as c3,
    -- anon/authenticated に直接権限が無いこと（投稿は RPC 経由のみ）
    (select count(*) from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'pay_reports'
        and grantee in ('anon', 'authenticated'))                              as c4,
    -- 集計ビューが所有者権限で走ること（security_invoker が付いていない）
    (select count(*) from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
      where n.nspname = 'public' and cl.relname = 'pay_benchmarks'
        and coalesce(array_to_string(cl.reloptions, ','), '') like '%security_invoker%') as c5,
    -- 公開集計に準識別子が出ていないこと
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'pay_benchmarks'
        and column_name in ('base_iata', 'seniority_years', 'proof_hash',
                            'airline_other', 'period_month'))                  as c6,
    -- 語彙の外部キー7本（airline/position/fleet/job_role/currency/housing/contract）
    (select count(*) from pg_constraint
      where conrelid = to_regclass('public.pay_reports') and contype = 'f')    as c7,
    -- 年換算：12×(20000 + 250×85 + 3000 + 10000) = 651,000
    -- ★第1引数は「その月の額面（総支給）」。内訳を足すときは null。
    public.pv_annual_total(null, 20000, 250, 75, 85, 3000, 'allowance', 10000,
                           null, null, null, null, null)                       as c8,
    -- 現物支給の社宅は足さない：12×(20000 + 21250 + 3000) = 531,000
    public.pv_annual_total(null, 20000, 250, 75, 85, 3000, 'provided', 10000,
                           null, null, null, null, null)                       as c9,
    -- 換算レートのある通貨数（当面この通貨だけが pay_benchmarks に乗る）
    (select count(*) from public.fx_rates)                                     as c10
)
select * from (
  select 1 as "#", '8-1 user_id/uid/email 列が無い'          as 検査,
         c1::text as 実際, '0' as 期待,
         case when c1 = 0 then '✅' else '❌' end as 判定 from c
  union all select  2, '8-2 個票を読める SELECT ポリシーが無い', c2::text, '0',
         case when c2 = 0      then '✅' else '❌' end from c
  union all select  3, '8-3 RLS が有効',                       c3::text, '1',
         case when c3 = 1      then '✅' else '❌' end from c
  union all select  4, '8-3 anon/authenticated の直接権限が無い', c4::text, '0',
         case when c4 = 0      then '✅' else '❌' end from c
  union all select  5, '8-4 集計ビューが所有者権限で走る',      c5::text, '0',
         case when c5 = 0      then '✅' else '❌' end from c
  union all select  6, '8-5 公開集計に準識別子が無い',          c6::text, '0',
         case when c6 = 0      then '✅' else '❌' end from c
  union all select  7, '8-6 語彙の外部キー本数',                c7::text, '7',
         case when c7 = 7      then '✅' else '❌' end from c
  union all select  8, '8-7 年換算（住宅手当＝現金は足す）',    c8::text, '651000',
         case when c8 = 651000 then '✅' else '❌' end from c
  union all select  9, '8-7 年換算（社宅＝現物は足さない）',    c9::text, '531000',
         case when c9 = 531000 then '✅' else '❌' end from c
  union all select 10, '8-8 換算レートのある通貨数',            c10::text, '7',
         case when c10 = 7     then '✅' else '❌' end from c
) t
order by "#";
