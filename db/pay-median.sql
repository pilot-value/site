-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/pay-median.sql
--
-- 「提出された給与」の中央値の、ただ1つの決め方（地域でも会社でも同じ式）。
-- 呼ぶのは2つだけ ── db/region-pay.sql の pv_region_pay()（航空会社一覧の地域）と、
-- db/company-pay.sql の pv_company_pay()（2社の比較）。この関数そのものは誰にも渡さない。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する（本番未適用）。
-- ★ 流す順番: db/airlines.generated.sql → db/pay-reports.sql → db/pay-rows.sql → このファイル
--    → db/region-pay.sql（と db/company-pay.sql）
--    前のどれかが抜けていたら、下の「0. 前提」が日本語で止める。
-- 冪等（何度流しても安全）。表は1つも作らない。関数が1つだけ。
--
-- ── 数字の決め方（1文）──────────────────────────────────────
--   その区分（地域・会社）の航空会社に給与を提出した人について、月ごとの額を同じ式で年に直し、
--   1人を本人の月々のまんなかの値1つにまとめた、その人たちのまんなかの値です。
--
-- ── 守っている約束 ────────────────────────────────────────
--  1. 材料は本棚（会員が出した月の給与）だけ。登録前の預かり・昔の口コミに書かれた年収・
--     公開の中央値の表は読まない（年額そのものと月の年換算を混ぜない／人の単位が無いものを数えない）。
--  2. 1人は1回だけ数える。同じ人の12か月も、同じ区分の2社に出した人も1人（pv_pay_person_map）。
--     人数（people）と件数（records ＝ 月の数）は別の数として返す。
--  3. 区分の数字は「人のまんなかの値（中央値）」。平均ではない。会社ごとの中央値を平均する形にもしない。
--  4. 職位は月ごと。機長の月は機長へ、副操縦士の月は副操縦士へ（昇格した人は両方に1回ずつ）。
--     返すのは機長と副操縦士の2つだけ。2つを混ぜた数字は作らない。
--  5. 期間は「その給与がいつのものか」で見る。当月を含む暦の24か月（DEEP PAY と同じ窓）。
--  6. 3人に届かない区分は { s:'few' } だけ（0人・1人・2人を見分けない）。
--     まんなか半分の幅（p25・p75）は5人から。どちらも人で数える。
--  7. 本人の依頼で一覧から下ろした人（pay_hidden）は、誰が呼んでも入れない（運営にも入れない）。
--     3人の区分に残すと、鍵を持つ人が一覧の2行と突き合わせて3人目の額を出せてしまう。
--  8. 金額は有効数字2桁（pv_sig2）。会社・機種・基地・日付・ハッシュ・1人ずつの値・内訳は返さない。
--  9. 打ち込まれた社名は pv_airline_resolve を通す。どの会社にも当たらない行はどの区分にも入れない。
-- 10. 数字を選ばない。公開年収から大きく外れた額（REAL PAY が ⚠ を付ける行）も、常識の幅の中なら入れる。
--     外すのは常識の幅の外（打ち間違いの形）と、下ろした人だけ。
-- 11. 誰に見せてよいかは、ここでは決めない（決めるのは呼ぶ側。どちらも db/work-months.sql の
--     pv_work_level() の1か所を呼ぶ）。だからこの関数は誰にも実行させない。
-- 12. 何も書き込まない。外の AI・Edge Function へは1行も送らない（Postgres の中の1文で済ませる）。
--
-- ⚠️ 同じ線の写し（直すときは一緒に）
--     年収の常識の幅（1万〜70万ドル）    … db/pay-rows.sql ・ db/deep-pay.sql と同じ
--     直近24か月（給与の月で見る）        … db/deep-pay.sql と同じ
-- ⚠️ 関数の本体の中には、読まない表の名前を、注意書きとしても書かない
--     （末尾の検算と db/test-region-pay.mjs が、関数の中身を字で見ている）。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.pv_airlines') is null then
    raise exception '先に db/airlines.generated.sql を実行してください（pv_airlines の表が無い）';
  end if;
  if to_regclass('public.pay_reports') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports の表が無い）';
  end if;
  if to_regclass('public.pay_hidden') is null
     or to_regprocedure('public.pv_pay_person_map()') is null
     or to_regprocedure('public.pv_airline_resolve(text)') is null
     or to_regprocedure('public.pv_sig2(numeric)') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pay_hidden / pv_pay_person_map / pv_airline_resolve / pv_sig2 が無い）';
  end if;
end $$;


-- ── 1. 決め方 ───────────────────────────────────────────────
-- 受け取る形: { <区分>: [<会社>, …], … }   区分の名前は呼ぶ側が決める（地域なら地域の名前、比較なら会社）。
--             形の違う入力は「区分なし」として扱う（{} を返す。例外は投げない）。
-- 返す形:     { period:{from:'YYYY-MM', to:'YYYY-MM'}, floor:3, band_floor:5,
--               groups:{ <区分>:{ cap:<数字>, fo:<数字> }, … } }
--   <数字> ＝ { s:'few' }
--          ／ { s:'ok', people, records, median_usd }                 … 3人・4人
--          ／ { s:'ok', people, records, median_usd, p25_usd, p75_usd } … 5人から
create or replace function public.pv_pay_medians(p_groups jsonb)
returns jsonb
language sql
security definer
stable
set search_path = public, extensions
as $fn$
  with knobs as (
    select (date_trunc('month', now()) - interval '23 months')::date as d_from,
           date_trunc('month', now())::date as d_to,
           3 as c_floor,
           5 as c_band_floor
  ),
  grpcode as (
    -- 区分と、その区分に入る会社。同じ会社を同じ区分に2回書いても1回。
    select distinct g.key as grp, t.code
      from jsonb_each(case when jsonb_typeof(p_groups) = 'object' then p_groups else '{}'::jsonb end) as g(key, value)
     cross join lateral jsonb_array_elements_text(
             case when jsonb_typeof(g.value) = 'array' then g.value else '[]'::jsonb end) as t(code)
  ),
  base as (
    -- 月の行。常識の幅・職位・期間・下ろした人、の4つをここで済ませる。
    select r.proof_hash as pkey,
           case when r.airline = 'other'
                then public.pv_airline_resolve(r.airline_other)
                else r.airline end as air,
           r."position" as pos,
           r.annual_total_usd as usd
      from public.pay_reports r
     cross join knobs k
     where r.annual_total_usd between 10000 and 700000
       and r."position" in ('cap', 'fo')
       and make_date(r.period_year, r.period_month, 1) between k.d_from and k.d_to
       and not exists (select 1 from public.pay_hidden h where h.proof_hash = r.proof_hash)
  ),
  placed as (
    -- 区分と「同じ人」を貼る。当たらない行は落とす（数え上げない）。
    select c.grp, b.pos, m.human, b.usd
      from base b
      join grpcode c on c.code = b.air
      join public.pv_pay_person_map() m on m.h = b.pkey
  ),
  person as (
    -- 1人を1つに（その区分・その職位での、本人の月々のまんなか）。
    select p.grp, p.pos, p.human,
           (percentile_cont(0.5) within group (order by p.usd))::numeric as v,
           count(*) as months
      from placed p
     group by p.grp, p.pos, p.human
  ),
  cell as (
    -- 区分ごと。人数と件数は別の数。
    select s.grp, s.pos,
           count(*)::int as people,
           sum(s.months)::int as records,
           (percentile_cont(0.5) within group (order by s.v))::numeric as med,
           (percentile_cont(0.25) within group (order by s.v))::numeric as p25,
           (percentile_cont(0.75) within group (order by s.v))::numeric as p75
      from person s
     group by s.grp, s.pos
  ),
  grid as (
    -- 聞かれた区分は、数字が無くても2職位とも返す（どこに数字が在るかを、形で教えない）。
    select distinct c.grp, q.pos
      from grpcode c
     cross join (values ('cap'), ('fo')) as q(pos)
  ),
  shown as (
    select g.grp, g.pos,
           case when coalesce(c.people, 0) < k.c_floor
                then jsonb_build_object('s', 'few')
                else jsonb_build_object('s', 'ok', 'people', c.people, 'records', c.records,
                                        'median_usd', public.pv_sig2(c.med))
                     || case when c.people >= k.c_band_floor
                             then jsonb_build_object('p25_usd', public.pv_sig2(c.p25),
                                                     'p75_usd', public.pv_sig2(c.p75))
                             else '{}'::jsonb end
           end as j
      from grid g
     cross join knobs k
      left join cell c on c.grp = g.grp and c.pos = g.pos
  ),
  bygrp as (
    select w.grp, jsonb_object_agg(w.pos, w.j) as j
      from shown w
     group by w.grp
  )
  select jsonb_build_object(
           'period', jsonb_build_object('from', to_char(k.d_from, 'YYYY-MM'),
                                        'to',   to_char(k.d_to,   'YYYY-MM')),
           'floor', k.c_floor,
           'band_floor', k.c_band_floor,
           'groups', coalesce((select jsonb_object_agg(y.grp, y.j) from bygrp y), '{}'::jsonb))
    from knobs k
$fn$;

-- ★ 誰にも渡さない（PUBLIC の既定の実行権も外す）。呼ぶのは security definer の口の中からだけ。
--   ここを開けると、鍵の判定を通らずに区分の数字が読めてしまう。
revoke all on function public.pv_pay_medians(jsonb) from public, anon, authenticated;

comment on function public.pv_pay_medians(jsonb) is
  '「提出された給与」の中央値の決め方（区分 × 職位。1人を1つにまとめた年収の中央値・人数・件数）。'
  '★誰にも grant しない。pv_region_pay と pv_company_pay の中からだけ呼ぶ。';


-- ════════════════════════════════════════════════════════════════
-- 2. 検算（貼ったあとに出る6行。全部 ✅ が正しい）
--    ★「貼れた」は証拠にならない。この6行を読む。
-- ════════════════════════════════════════════════════════════════
with d as (
  select pg_get_functiondef('public.pv_pay_medians(jsonb)'::regprocedure) as s
)
select 1 as no, '誰にも渡していない（未ログイン・ログイン済み・PUBLIC のどれも実行できない）' as 検算,
       case when not has_function_privilege('anon', 'public.pv_pay_medians(jsonb)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_pay_medians(jsonb)', 'execute')
             and not exists (
               select 1 from pg_proc p,
                      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where p.oid = 'public.pv_pay_medians(jsonb)'::regprocedure
                  and a.grantee = 0 and a.privilege_type = 'EXECUTE')
            then '✅' else '❌' end as 結果
union all
select 2, '材料は本棚だけ（預かり・口コミ・公開の中央値の表を読まない）・平均を作らない',
       case when (select s from d) not like '%pay_reports_pending%'
             and (select s from d) not like '%reviews_v2%'
             and (select s from d) not like '%pay_benchmarks%'
             and (select s from d) not like '%avg(%' then '✅' else '❌' end
union all
select 3, '1人を1つにまとめる・下ろした人を外す・金額は有効数字2桁',
       case when (select s from d) like '%pv_pay_person_map()%'
             and (select s from d) like '%pay_hidden%'
             and (select s from d) like '%pv_sig2%' then '✅' else '❌' end
union all
select 4, '誰に見せるかをここで決めていない（鍵の判定は呼ぶ側の1か所）',
       case when (select s from d) not like '%pv_work_level%'
             and (select s from d) not like '%access_until%'
             and (select s from d) not like '%auth.uid%' then '✅' else '❌' end
union all
select 5, '関数は1つ・受け取るのは jsonb 1つ・書き込まない',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'pv_pay_medians') = 1
             and (select p.pronargs = 1 and p.provolatile = 's' from pg_proc p
                   where p.oid = 'public.pv_pay_medians(jsonb)'::regprocedure) then '✅' else '❌' end
union all
select 6, '区分を1つも渡さないと、区分の無い返事（3人の壁・5人の幅も返る）',
       case when public.pv_pay_medians('{}'::jsonb) -> 'groups' = '{}'::jsonb
             and (public.pv_pay_medians('{}'::jsonb) ->> 'floor')::int = 3
             and (public.pv_pay_medians('{}'::jsonb) ->> 'band_floor')::int = 5 then '✅' else '❌' end
order by no;
