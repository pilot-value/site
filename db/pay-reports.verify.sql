-- ════════════════════════════════════════════════════════════════
-- db/pay-reports.verify.sql — 検算を1回の Run で全部見る
--
-- pay-reports.sql の「8. 検算」は select が8本並んでいるが、Supabase の
-- SQL Editor は最後の1文の結果しか表示しない。＝ 8-1〜8-7 が見えないまま
-- 「通った」と誤認できてしまう。ここでは16項目を1つの結果表にまとめ、
-- 期待値との一致を 判定 列で出す。スキーマを触るたびに流し直す。
--
-- 期待：16行すべて 判定 = ✅
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
    -- 語彙の外部キー8本
    -- （airline/position/fleet/job_role/age_bucket/currency/housing/contract）
    (select count(*) from pg_constraint
      where conrelid = to_regclass('public.pay_reports') and contype = 'f')    as c7,
    -- 年換算：12×(20000 + 250×85 + 3000 + 10000) = 651,000
    -- ★第1引数は「その月の額面（総支給）」。内訳を足すときは null。
    public.pv_annual_total(null, 20000, 250, 75, 85, 3000, 'allowance', 10000,
                           null, null, null, null, null)                       as c8,
    -- 現物支給の社宅は足さない：12×(20000 + 21250 + 3000) = 531,000
    public.pv_annual_total(null, 20000, 250, 75, 85, 3000, 'provided', 10000,
                           null, null, null, null, null)                       as c9,
    -- ★ レートの無い通貨（語彙にあるのにレートが無いと、その通貨の投稿は
    --    annual_total_usd が null のまま集計から落ちる）。実数を固定値で見ない
    (select count(*) from public.pv_currencies cu
      where cu.active and not exists (select 1 from public.fx_rates f
                                       where f.code = cu.code))                as c10,
    -- ★ 2026-08-26。保証給（金額）。基本給という項目が無く、保証給だけが下限として
    --    出る会社（米国型）を落とさないための列。12×5,000 = 60,000
    public.pv_annual_total(null, null, null, null, null, null, null, null,
                           null, null, null, null, null, null, 5000)           as c11,
    -- ★ 総支給がある行は内訳をひとつも見ない。保証給を足しても 651,000 のまま
    public.pv_annual_total(54250, 20000, 250, 75, 85, 3000, 'allowance', 10000,
                           null, null, null, null, null, null, 5000)           as c12,
    -- ★ 2026-09-02。組合の手当だけが「総支給の外」で払われることがある
    --    （乗員代表。組合が直接払うので会社の明細に印字されない）。
    --    最後の引数が真のときだけ、総支給の枝でも足す：12×(54250 + 3000) = 687,000
    --    ⚠️ ここが 651000 と出たら、本番にまだ古い20引数版が残っていて
    --       そちらが呼ばれている。db/pay-reports.sql を貼り直すこと。
    public.pv_annual_total(54250, null, null, null, null, null, null, null,
                           null, null, null, null, null, null, null, null, null,
                           3000, null, null, true)                             as c13,
    -- ★ 支給元が会社なら1円も動かない（総支給の中に既に入っている）。651,000 のまま
    public.pv_annual_total(54250, null, null, null, null, null, null, null,
                           null, null, null, null, null, null, null, null, null,
                           3000, null, null, false)                            as c14,
    -- ★ 2026-09-02。「総支給の外」と数えるのは支給元＝**組合のときだけ**。
    --    会社・両方・その他・空はぜんぶ「中」（お金は会社から出ている）。
    --    5つ試して「外」と出るのは1つだけ。
    (select count(*) from (values ('airline'), ('union'), ('both'), ('other'), (''))
                            v(s)
      where public.pv_union_outside_gross(
              jsonb_build_object('union',
                jsonb_build_object('extra', 'yes', 'source', v.s))))           as c15,
    -- ★ 2026-09-02。乗務1時間あたりは「飛んだことへの対価」で割る。
    --    組合が総支給の外で払った分（月3,000）は分子から抜く：
    --    (687,000 − 3,000×12) ÷ (12×50) = 1,085.00
    --    ⚠️ ここで「関数が無い」と怒られたら db/pay-reports.sql を貼り直すこと。
    public.pv_block_hour_usd(687000, 1, 50, 3000, true)                        as c16
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
  union all select  7, '8-6 語彙の外部キー本数',                c7::text, '8',
         case when c7 = 8      then '✅' else '❌' end from c
  union all select  8, '8-7 年換算（住宅手当＝現金は足す）',    c8::text, '651000',
         case when c8 = 651000 then '✅' else '❌' end from c
  union all select  9, '8-7 年換算（社宅＝現物は足さない）',    c9::text, '531000',
         case when c9 = 531000 then '✅' else '❌' end from c
  union all select 10, '8-8 レートの無い通貨',                  c10::text, '0',
         case when c10 = 0     then '✅' else '❌' end from c
  union all select 11, '8-9 年換算（保証給だけの行も出せる）',   c11::text, '60000',
         case when c11 = 60000 then '✅' else '❌' end from c
  union all select 12, '8-9 総支給がある行は保証給でも動かない', c12::text, '651000',
         case when c12 = 651000 then '✅' else '❌' end from c
  union all select 13, '8-10 組合払いは総支給に足す（乗員代表）', c13::text, '687000',
         case when c13 = 687000 then '✅' else '❌' end from c
  union all select 14, '8-10 会社払いの組合手当は動かさない',     c14::text, '651000',
         case when c14 = 651000 then '✅' else '❌' end from c
  union all select 15, '8-11 総支給の外は「組合」だけ（5つ中1つ）', c15::text, '1',
         case when c15 = 1      then '✅' else '❌' end from c
  union all select 16, '8-11 時間あたりは組合の分を分子から抜く',   c16::text, '1085.00',
         case when c16 = 1085   then '✅' else '❌' end from c
) t
order by "#";
