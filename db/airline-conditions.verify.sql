-- ════════════════════════════════════════════════════════════════
-- db/airline-conditions.verify.sql — 検算を1回の Run で全部見る
--
-- Supabase の SQL Editor は最後の1文の結果しか表示しない。
-- ＝ select を並べると途中が見えないまま「通った」と誤認できる。
-- ここでは15項目を1つの結果表にまとめ、期待値との一致を 判定 列で出す。
-- db/airline-conditions.sql を流したあとに、そのまま続けて実行する。
--
-- 期待：15行すべて 判定 = ✅
-- ════════════════════════════════════════════════════════════════

with c as (
  select
    -- 個人に辿り着ける列が無いこと
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'airline_conditions'
        and column_name in ('user_id', 'uid', 'email'))                        as c1,
    -- 個票を読めるポリシーが1本も無いこと
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'airline_conditions')        as c2,
    -- RLS が有効なこと
    (select count(*) from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
      where n.nspname = 'public' and cl.relname = 'airline_conditions'
        and cl.relrowsecurity)                                                 as c3,
    -- anon/authenticated に直接権限が無いこと（読み書きは RPC と集計ビューだけ）
    (select count(*) from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'airline_conditions'
        and grantee in ('anon', 'authenticated'))                              as c4,
    -- 集計ビューが所有者権限で走ること（security_invoker が付いていない）
    (select count(*) from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
      where n.nspname = 'public' and cl.relname = 'airline_condition_facts'
        and coalesce(array_to_string(cl.reloptions, ','), '') like '%security_invoker%') as c5,
    -- 公開集計に個票・準識別子が1列も出ていないこと
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'airline_condition_facts'
        and column_name in ('answer_text', 'answer_json', 'proof_hash', 'airline_other',
                            'position', 'fleet', 'base_iata', 'contract_type')) as c6,
    -- 公開集計を anon が読めること
    (select count(*) from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'airline_condition_facts'
        and grantee = 'anon' and privilege_type = 'SELECT')                    as c7,
    -- ログイン済みが叩ける RPC は3本だけ
    (select count(distinct routine_name) from information_schema.routine_privileges
      where routine_schema = 'public' and grantee = 'authenticated'
        and routine_name in ('submit_airline_conditions', 'next_condition_questions',
                             'my_airline_conditions'))                          as c8,
    -- proof_hash の作り方と貢献者集計は誰にも渡していないこと
    (select count(*) from information_schema.routine_privileges
      where routine_schema = 'public' and grantee in ('anon', 'authenticated')
        and routine_name in ('pv_condition_hash', 'pv_contributor_stats'))      as c9,
    -- 語彙の外部キー6本（airline / question_id / currency / position / fleet / contract）
    (select count(*) from pg_constraint
      where conrelid = to_regclass('public.airline_conditions') and contype = 'f') as c10,
    -- 1人1社1質問で1行（answer 済みの項目を二重に持たない）
    (select count(*) from pg_constraint
      where conrelid = to_regclass('public.airline_conditions')
        and contype = 'u' and conname = 'airline_conditions_uniq')             as c11,
    -- proof_hash の区切りが '::pv_cond::' であること（給与 '::pv_pay::' と混ざらない）
    (select public.pv_condition_hash(
              '00000000-0000-0000-0000-000000000000'::uuid, 'ana', null))      as c12,
    -- スキップを覚える列（これが無いと同じ質問が毎回出る）
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'airline_conditions'
        and column_name = 'skipped_at')                                        as c13,
    -- 最初の3問を決める列（これが無いと出る順が変わる）
    (select count(*) from public.pv_condition_questions where active and boost > 0) as c14,
    -- 聞き直すまでの日数が設定表から来ていること（SQL に直書きされていない）
    (select count(*) from public.pv_condition_settings
      where key in ('answer_reask_days', 'unknown_reask_days', 'skip_reask_days',
                    'initial_limit', 'recurring_limit', 'profile_limit', 'modal_delay_ms')) as c15
)
select * from (
  select 1 as "#", 'user_id/uid/email 列が無い'                as 検査,
         c1::text as 実際, '0' as 期待,
         case when c1 = 0 then '✅' else '❌' end as 判定 from c
  union all select  2, '個票を読めるポリシーが1本も無い',        c2::text, '0',
         case when c2 = 0 then '✅' else '❌' end from c
  union all select  3, 'RLS が有効',                            c3::text, '1',
         case when c3 = 1 then '✅' else '❌' end from c
  union all select  4, 'anon/authenticated の直接権限が無い',    c4::text, '0',
         case when c4 = 0 then '✅' else '❌' end from c
  union all select  5, '集計ビューが所有者権限で走る',            c5::text, '0',
         case when c5 = 0 then '✅' else '❌' end from c
  union all select  6, '公開集計に個票・準識別子が無い',          c6::text, '0',
         case when c6 = 0 then '✅' else '❌' end from c
  union all select  7, '公開集計を anon が読める',               c7::text, '1',
         case when c7 = 1 then '✅' else '❌' end from c
  union all select  8, 'ログイン済みが叩ける RPC は3本',          c8::text, '3',
         case when c8 = 3 then '✅' else '❌' end from c
  union all select  9, 'hash 生成と貢献者集計は誰にも渡さない',   c9::text, '0',
         case when c9 = 0 then '✅' else '❌' end from c
  union all select 10, '語彙の外部キーが6本',                    c10::text, '6',
         case when c10 = 6 then '✅' else '❌' end from c
  union all select 11, '1人1社1質問の unique がある',            c11::text, '1',
         case when c11 = 1 then '✅' else '❌' end from c
  union all select 12, 'proof_hash の区切りが ::pv_cond::',      left(c12, 12), '8cbe80f8b4ff',
         case when c12 = '8cbe80f8b4ffa300300778692e7fcdec8020573c835afc8dd700f649e0d94fd9'
              then '✅' else '❌' end from c
  union all select 13, 'スキップを覚える skipped_at 列がある',   c13::text, '1',
         case when c13 = 1 then '✅' else '❌' end from c
  union all select 14, '最初の3問が boost で指定されている',      c14::text, '3',
         case when c14 = 3 then '✅' else '❌' end from c
  union all select 15, '聞く頻度の設定が7件そろっている',         c15::text, '7',
         case when c15 = 7 then '✅' else '❌' end from c
) t order by "#";
