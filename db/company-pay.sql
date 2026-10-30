-- ════════════════════════════════════════════════════════════════
-- db/company-pay.sql — 会社ページと比較の「提出された年収」の中央値（会社 × 職位）。2026-10-30 版：5人以上の区分は 25%・75% も返す。
--
-- ── 数字の決め方（1文）──────────────────────────────────────
--   決めるのは db/pay-median.sql の pv_pay_medians() の1か所（地域の中央値と同じ式）。
--   ここは「誰に返すか」と「2社まで」だけを決め、数え直さない。
--
-- ── 守っている約束 ────────────────────────────────────────
--  1. 鍵の無い人へは { ok, state } の2つしか返さない（人数・期間・どの会社に数字が在るか、どれも返さない）。
--     鍵 ＝ REAL PAY の一覧が開く条件と同じ。判定は db/work-months.sql の pv_work_level() の1か所。ここに条件を書き写さない。
--  2. 人数・件数は返さない（人数はどこにも出さない ── DEEP PAY と同じ）。
--     まんなか半分の幅（p25_usd・p75_usd）は、db/pay-median.sql が返したときだけ渡す（5人からの区分・2026-10-30）。
--     幅が在ることから分かるのは「5人以上」だけ。人数そのものは返さない。
--  3. 数字の決め方の約束は db/pay-median.sql の頭に在る。
--  4. 一度に聞けるのは2社まで。語彙に無い会社・3社以上・同じ会社2つは { ok:false, state:'bad' }（別の区分に読み替えない）。
--  5. 何も書き込まない。資格を1つも付けない。
-- ⚠️ 関数の本体の中には、読まない表の名前と、鍵の列の名前を、注意書きとしても書かない（末尾の検算と検査が字で見ている）。
-- ════════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.pv_airlines') is null then
    raise exception '先に db/airlines.generated.sql を実行してください（pv_airlines の表が無い）'; end if;
  if to_regclass('public.pay_reports') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports の表が無い）'; end if;
  if to_regclass('public.pay_hidden') is null
     or to_regprocedure('public.pv_pay_person_map()') is null
     or to_regprocedure('public.pv_airline_resolve(text)') is null
     or to_regprocedure('public.pv_sig2(numeric)') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pay_hidden / pv_pay_person_map / pv_airline_resolve / pv_sig2 が無い）'; end if;
  if to_regprocedure('public.pv_work_level()') is null then
    raise exception '先に db/work-months.sql を実行してください（pv_work_level が無い）'; end if;
  if to_regprocedure('public.pv_pay_medians(jsonb)') is null then
    raise exception '先に db/pay-median.sql を実行してください（pv_pay_medians が無い）'; end if;
end $$;

-- 受け取る形: { airlines: [<会社>, <会社>] }（1社でもよい）
-- 返す形:
--   鍵が無い … { ok:true, state:'locked' }
--   鍵が在る … { ok:true, state:'open', period:{from:'YYYY-MM', to:'YYYY-MM'}, floor:<db/pay-median.sql の壁>,
--                airlines:{ <会社>:{ cap:<区分>, fo:<区分> }, … } }
--     <区分> ＝ { s:'few' } ／ { s:'ok', median_usd } ／ { s:'ok', median_usd, p25_usd, p75_usd }（幅は5人から）
create or replace function public.pv_company_pay(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $fn$
declare
  v_in  jsonb := case when jsonb_typeof(p -> 'airlines') = 'array' then p -> 'airlines' else '[]'::jsonb end;
  v_air text[];
  v_m   jsonb;
begin
  -- 鍵の無い人（給与を出していない会員・鍵の切れた会員）には、この2つだけ。引数も見ない。
  if public.pv_work_level() is distinct from 'pay' then
    return jsonb_build_object('ok', true, 'state', 'locked');
  end if;
  select array_agg(distinct a.code) into v_air
    from jsonb_array_elements_text(v_in) as t(code)
    join public.pv_airlines a on a.code = t.code and a.code <> 'other';
  if v_air is null or jsonb_array_length(v_in) > 2 or jsonb_array_length(v_in) <> array_length(v_air, 1) then
    return jsonb_build_object('ok', false, 'state', 'bad');
  end if;
  select public.pv_pay_medians(coalesce(jsonb_object_agg(a.code, jsonb_build_array(a.code)), '{}'::jsonb))
    into v_m from unnest(v_air) as a(code);
  -- 区分は作り直す（数字が在れば額と、5人からの幅だけ）。人数・件数は渡さない。
  return jsonb_build_object(
           'ok', true, 'state', 'open',
           'period', v_m -> 'period',
           'floor', v_m -> 'floor',
           'airlines', coalesce((
             select jsonb_object_agg(g.key, (
                      select jsonb_object_agg(c.key,
                               case when c.value ->> 's' = 'ok'
                                    then jsonb_strip_nulls(jsonb_build_object(
                                           's', 'ok', 'median_usd', c.value -> 'median_usd',
                                           'p25_usd', c.value -> 'p25_usd', 'p75_usd', c.value -> 'p75_usd'))
                                    else jsonb_build_object('s', 'few') end)
                        from jsonb_each(g.value) as c(key, value)))
               from jsonb_each(v_m -> 'groups') as g(key, value)), '{}'::jsonb));
end;
$fn$;

-- ★ PUBLIC の既定の実行権を外してから、ログイン済みにだけ渡す（未ログインは呼べない。画面も聞かない）。
revoke all on function public.pv_company_pay(jsonb) from public, anon, authenticated;
grant execute on function public.pv_company_pay(jsonb) to authenticated;
comment on function public.pv_company_pay(jsonb) is
  '比較の「提出された年収」の中央値（会社 × 職位）。給与の鍵が生きている人と運営にだけ。'
  '★鍵の無い人へは { ok, state } だけ。区分は { s:few } か { s:ok, median_usd }、5人からは p25_usd・p75_usd も（人数・件数は返さない）。';

-- 検算（貼ったあとに出る6行。全部 ✅ が正しい。★「貼れた」は証拠にならない。この6行を読む）
with d as (select pg_get_functiondef('public.pv_company_pay(jsonb)'::regprocedure) as s)
select 1 as no, '呼べるのはログイン済みだけ（未ログインと PUBLIC には渡っていない）' as 検算,
       case when has_function_privilege('authenticated', 'public.pv_company_pay(jsonb)', 'execute')
             and not has_function_privilege('anon', 'public.pv_company_pay(jsonb)', 'execute')
             and not exists (select 1 from pg_proc q, lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
                              where q.oid = 'public.pv_company_pay(jsonb)'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE')
            then '✅' else '❌' end as 結果
union all select 2, '鍵の判定は pv_work_level の1か所（ここに写しを持たない）',
       case when (select s from d) like '%pv_work_level()%' and (select s from d) not like '%access_until%' then '✅' else '❌' end
union all select 3, '数字の決め方は pv_pay_medians の1か所',
       case when (select s from d) like '%pv_pay_medians(%' and (select s from d) not like '%percentile_cont%'
             and (select s from d) not like '%pay_reports%' and (select s from d) not like '%reviews_v2%'
             and (select s from d) not like '%avg(%' then '✅' else '❌' end
union all select 4, '人数・件数を渡さない（幅は 5人から pay-median.sql が返したものだけ）',
       case when (select s from d) not like '%people%' and (select s from d) not like '%records%'
             and (select s from d) not like '%band_floor%' and (select s from d) not like '%human%'
             and (select s from d) like '%''p25_usd'', c.value -> ''p25_usd''%'
             and (select s from d) like '%''p75_usd'', c.value -> ''p75_usd''%' then '✅' else '❌' end
union all select 5, '機材で分けない（関数の中に機材の字が無い）',
       case when (select s from d) not like '%fleet%' and (select s from d) not like '%aircraft%' then '✅' else '❌' end
union all select 6, '壁の数をここに書いていない',
       case when (select s from d) not like '%c_floor%' then '✅' else '❌' end
order by 1;
