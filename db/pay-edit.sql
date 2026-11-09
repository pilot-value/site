-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/pay-edit.sql（2026-11-09）
--
-- MY PAGE の「編集」で、出した月の中身を**全部**給与フォームに戻すための読む口。
-- オーナー「編集ボタンを押しても二択（アップロードか手入力）に行くから編集できない。
--           最後のまとめの一覧に飛んで、そこから編集させればいい」。
--
--   my_pay_report_one(p_airline, p_airline_other, p_year, p_month)
--     → 本人が出したその月の1行（給与フォームが送る列 ＋ 内訳の行 pay_items）。無ければ null。
--
-- ★ 本人の行だけ。proof_hash を submit_pay_report と**同じ式**で作り直して引く
--    （pay_reports に user_id は無い。式の写しは my_pay_reports・pv_my_keys ほかと同じく1つ増えた）。
--    ⚠️ submit_pay_report の式を変えたら、ここも直す（下の検算5が食い違いを見つける）。
-- ★ 返す列は名指しで並べる（r.* や to_jsonb(r) にしない）── proof_hash・回線のハッシュ・id を返さない。
-- ★ my_pay_reports() は触らない。あちらは「pay_items そのものは返さない」まま（毎回開く一覧なので、要らない物は出さない）。
--    こちらは本人が「編集」を押したときに1か月ぶんだけ呼ぶ。
-- ★ 書き込みはしない。出し直し（上書き）は今までどおり submit_pay_report（同じ会社・同じ月は入れ替わる）。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: db/pay-reports.sql → このファイル。冪等（何度流しても同じ）。
-- ★ 貼る前に push しても壊れない ── 関数が無ければ、フォームは今までどおり入口の2択を出す。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.pay_reports') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports の表が無い）';
  end if;
  if to_regprocedure('public.submit_pay_report(jsonb)') is null then
    raise exception '先に db/pay-reports.sql を実行してください（submit_pay_report が無い）';
  end if;
end $$;

-- ── 1. その月の1行を本人に返す ──────────────────────────────────
create or replace function public.my_pay_report_one(
  p_airline text, p_airline_other text, p_year int, p_month int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_airline text := nullif(btrim(p_airline), '');
  v_other   text := nullif(btrim(p_airline_other), '');
  v_hash    text;
  v_row     jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if v_airline is null or p_year is null or p_month is null then
    return null;
  end if;
  -- 一覧から選んだ会社に自由入力が残っていたら捨てる（submit_pay_report と同じ）
  if v_airline <> 'other' then
    v_other := null;
  end if;

  -- ★ submit_pay_report と1文字も違わない式（検算5が両方の本文を突き合わせる）
  v_hash := encode(
    extensions.digest(
      v_uid::text || '::pv_pay::' || v_airline || coalesce('::' || lower(v_other), ''),
      'sha256'),
    'hex');

  select to_jsonb(t) into v_row
    from (
      select r.airline, r.airline_other, r."position", r.fleet, r.job_role, r.job_roles,
             r.age_bucket, r.base_iata, r.period_year, r.period_month,
             r.currency, r.gross_monthly, r.base_pay, r.guarantee_pay, r.hourly_rate,
             r.guaranteed_hours, r.block_hours, r.duty_days, r.stay_nights, r.per_diem,
             r.housing_type, r.housing_amount, r.transport, r.command_pay,
             r.instructor_pay, r.examiner_pay, r.union_pay, r.management_pay, r.nonline_pay,
             r.other_allowance, r.flight_variable_pay,
             r.bonus_annual, r.profit_share_annual, r.pension_pct,
             r.contract_type, r.tax_country, r.tax_rate_pct, r.seniority_years, r.rank_years,
             r.net_pay_actual, r.ytd_taxable, r.deduction_total,
             r.duty_hours, r.night_hours, r.credit_hours,
             r.payslip_detail, r.pay_items, r.source
        from public.pay_reports r
       where r.proof_hash = v_hash
         and r.airline = v_airline
         and r.period_year = p_year
         and r.period_month = p_month
       limit 1
    ) t;
  return v_row;
end;
$$;

revoke all on function public.my_pay_report_one(text, text, int, int) from public, anon;
grant execute on function public.my_pay_report_one(text, text, int, int) to authenticated;

comment on function public.my_pay_report_one(text, text, int, int) is
  'MY PAGE の「編集」用。本人が出したその月の1行（給与フォームが送る列＋pay_items）。proof_hash をサーバ側で作り直して引くので本人の行しか返らない。';

-- ── 2. 検算（貼ったあと、全部 ✅ になること）──────────────────────────
with f as (select pg_get_functiondef('public.my_pay_report_one(text, text, int, int)'::regprocedure) as s),
     s as (select pg_get_functiondef('public.submit_pay_report(jsonb)'::regprocedure) as s),
     k as (select $k$v_uid::text || '::pv_pay::' || v_airline || coalesce('::' || lower(v_other), '')$k$ as s)
select 1 as "#", '関数がある（呼んだ本人の権限で動かない＝ security definer）' as "確かめること",
       case when (select prosecdef from pg_proc where oid = 'public.my_pay_report_one(text, text, int, int)'::regprocedure)
            then '✅' else '❌' end as "判定"
union all select 2, '未ログイン（anon）と PUBLIC は呼べない・ログイン済みは呼べる',
       case when not exists (select 1 from pg_proc q, lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
                              where q.oid = 'public.my_pay_report_one(text, text, int, int)'::regprocedure
                                and a.privilege_type = 'EXECUTE'
                                and (a.grantee = 0 or a.grantee in (select oid from pg_roles where rolname = 'anon')))
             and has_function_privilege('authenticated', 'public.my_pay_report_one(text, text, int, int)', 'EXECUTE')
            then '✅' else '❌' end
union all select 3, 'ログインしていなければ止める（auth.uid() が無い）',
       case when (select s from f) like '%if v_uid is null then%' and (select s from f) like '%42501%'
            then '✅' else '❌' end
union all select 4, '返す列は名指し（行まるごと・proof_hash・id を返さない）',
       case when (select s from f) not like '%to_jsonb(r)%' and (select s from f) not like '%r.*%'
             and (select s from f) not like '%r.proof_hash,%' and (select s from f) not like '%r.id,%'
            then '✅' else '❌' end
union all select 5, '本人の鍵の式が submit_pay_report と1文字も違わない',
       case when (select s from f) like '%' || (select s from k) || '%' and (select s from s) like '%' || (select s from k) || '%'
            then '✅' else '❌' end
order by 1;
