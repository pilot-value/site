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
--   delete_my_pay_report(p_airline, p_airline_other, p_year, p_month)（2026-11-10・2章）
--     → MY PAGE の「削除」。本人が出したその月の1行を消し、profiles の給与の数えを残りの行から作り直す。
--       ★最後の1件を消したら REAL PAY は閉じる（access_until → null。オーナー決定）。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: db/pay-reports.sql → このファイル。冪等（何度流しても同じ）。
-- ★ 貼る前に push しても壊れない ── 関数が無ければ、フォームは今までどおり入口の2択を出す。
--    削除は関数が無ければ「消せませんでした」と出るだけ（何も消えない）。
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
             r.bonus_month,   -- ★2026-11-11 明細に印字されたその月のボーナス（直す画面へ戻す。戻さないと送り直しで ×12 に入る）
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

-- ── 2. その月の1行を本人が消す（2026-11-10）─────────────────────────
-- オーナー「自分の給与レポートを削除するところも作って。あなたが出したものの中の編集の隣あたりに」。
-- ★オーナー決定：最後の1件を消したら REAL PAY は閉じる（access_until → null）。ほかの給与が残っていれば鍵はそのまま。
--
-- ★ 消すのは本人の行だけ。鍵は my_pay_report_one と同じ式（検算9が submit_pay_report と突き合わせる）。
--    本人の行でなければ何もしない（在る・無いも言わない ＝ deleted:false）。
-- ★ 消したあと、profiles の給与の数えを「残っている本人の行」から作り直す（会社をまたいで全部）。
--    残りの行は「その行の会社でこの人の鍵を作ったら一致するか」で1行ずつ探す（表を1回なめる。
--    消すのはめったに無いのでこの形にした ── ⚠️ ページを開くたびに呼ぶ読む口には使わない）。
--      pay_report_count   = 残りの件数（招待の「出した」もこの数で読む ＝ db/referrals.sql）
--      last_pay_period_ym = 残りのいちばん新しい対象月（year*12+month ＝ submit と同じ形）
--      pay_streak_months  = 残りの対象月で submit の数え方をやり直した値（pv_pay_streak_of の1か所）
--    0件になったら db/cleanup-test-payslip-row.sql と同じく提出前の形へ戻す
--      （access_until・pay_day_of_month・last_pay_report_at は null／件数と継続は 0／contributor の札は none）。
--      ★verified 以上の札は検証で付いたものなので残す（給与を出しただけでは付かない札）。
--    残りがあれば access_until と札は触らない（前に配った「少なくとも今から90日」はそのまま）。
--    ⚠️ 1日の上限の数え（pay_reports_day / pay_reports_today）は触らない ── 消して出し直すで上限を抜けさせない。
-- ★ 会員の中央値・人数（pv_stats）・会社の単価・新しい投稿順は、pay_reports の引き金が消した行でも数え直す。
-- ★ 返すのは {ok, deleted, remaining, closed} だけ（id も proof_hash も返さない）。

-- 継続の数え方（submit_pay_report の「② profiles に投稿の事実だけを刻む」の4つの枝）を、
-- 残っている対象月に古い順でもう一度当てる。★submit の枝を変えたら、ここも直す（検算10が submit の本文を見ている）。
create or replace function public.pv_pay_streak_of(p_yms int[])
returns int
language plpgsql
immutable
as $$
declare
  v_last   int;
  v_streak int := 0;
  v_ym     int;
begin
  for v_ym in select distinct u from unnest(coalesce(p_yms, '{}'::int[])) as u where u is not null order by u loop
    if v_last is null then           v_streak := 1;
    elsif v_ym = v_last + 1 then     v_streak := greatest(v_streak, 0) + 1;
    elsif v_ym <= v_last then        v_streak := greatest(v_streak, 1);
    else                             v_streak := 1;   -- 間が空いた
    end if;
    v_last := greatest(coalesce(v_last, 0), v_ym);
  end loop;
  return v_streak;
end;
$$;

revoke all on function public.pv_pay_streak_of(int[]) from public, anon, authenticated;

comment on function public.pv_pay_streak_of(int[]) is
  '対象月（year*12+month）の集まりから、submit_pay_report と同じ数え方で継続月数を出す。delete_my_pay_report が数え直しに使う。';

create or replace function public.delete_my_pay_report(
  p_airline text, p_airline_other text, p_year int, p_month int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_airline text := nullif(btrim(p_airline), '');
  v_other   text := nullif(btrim(p_airline_other), '');
  v_hash    text;
  v_n       int := 0;
  v_left    int;
  v_last    int;
  v_yms     int[];
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  -- 一覧から選んだ会社に自由入力が残っていたら捨てる（submit_pay_report と同じ）
  if v_airline <> 'other' then
    v_other := null;
  end if;

  -- 同じ人の2つのタブが同時に消しても、数え直しが前後しない（本人の profiles の行で順番待ち）
  perform 1 from public.profiles where id = v_uid for update;

  if v_airline is not null and p_year is not null and p_month is not null then
    -- ★ submit_pay_report と1文字も違わない式（検算9が両方の本文を突き合わせる）
    v_hash := encode(
      extensions.digest(
        v_uid::text || '::pv_pay::' || v_airline || coalesce('::' || lower(v_other), ''),
        'sha256'),
      'hex');
    delete from public.pay_reports r
     where r.proof_hash = v_hash
       and r.airline = v_airline
       and r.period_year = p_year
       and r.period_month = p_month;
    get diagnostics v_n = row_count;
  end if;

  -- 残っている本人の行（会社をまたいで全部）。その行の会社で作り直した鍵が一致する行だけ
  -- （airline_other は「その他」のときだけ入る ＝ pay_reports の制約。submit の式と同じ形になる）。
  select count(*)::int,
         max(r.period_year * 12 + r.period_month),
         array_agg(r.period_year * 12 + r.period_month)
    into v_left, v_last, v_yms
    from public.pay_reports r
   where r.proof_hash = encode(
           extensions.digest(
             v_uid::text || '::pv_pay::' || r.airline || coalesce('::' || lower(r.airline_other), ''),
             'sha256'),
           'hex');

  if v_n > 0 then
    if v_left = 0 then
      -- 提出前の形へ（db/cleanup-test-payslip-row.sql と同じ列。★REAL PAY を閉じる）
      update public.profiles set
        last_pay_report_at = null,
        pay_report_count   = 0,
        pay_streak_months  = 0,
        last_pay_period_ym = null,
        access_until       = null,
        -- 消したレポートから覚えた給料日で、毎月のお知らせが飛ばないように
        pay_day_of_month   = null,
        badge       = case when badge = 'contributor' then 'none' else badge end,
        badge_state = case when badge = 'contributor' then 'none' else badge_state end
      where id = v_uid;
    else
      update public.profiles set
        pay_report_count   = v_left,
        pay_streak_months  = public.pv_pay_streak_of(v_yms),
        last_pay_period_ym = v_last
      where id = v_uid;
    end if;
  end if;

  return jsonb_build_object(
    'ok',        true,
    'deleted',   v_n > 0,
    'remaining', v_left,
    'closed',    v_n > 0 and v_left = 0);
end;
$$;

revoke all on function public.delete_my_pay_report(text, text, int, int) from public, anon;
grant execute on function public.delete_my_pay_report(text, text, int, int) to authenticated;

comment on function public.delete_my_pay_report(text, text, int, int) is
  'MY PAGE の「削除」用。本人が出したその月の1行を消し、profiles の給与の数えを残りの行から作り直す。'
  '最後の1件なら REAL PAY を閉じる（access_until → null）。返すのは ok / deleted / remaining / closed だけ。';

-- ── 3. 検算（貼ったあと、12行が全部 ✅ になること）──────────────────────
with f as (select pg_get_functiondef('public.my_pay_report_one(text, text, int, int)'::regprocedure) as s),
     s as (select pg_get_functiondef('public.submit_pay_report(jsonb)'::regprocedure) as s),
     d as (select pg_get_functiondef('public.delete_my_pay_report(text, text, int, int)'::regprocedure) as s),
     g as (select pg_get_functiondef('public.pv_pay_streak_of(int[])'::regprocedure) as s),
     k as (select $k$v_uid::text || '::pv_pay::' || v_airline || coalesce('::' || lower(v_other), '')$k$ as s),
     kr as (select $k$v_uid::text || '::pv_pay::' || r.airline || coalesce('::' || lower(r.airline_other), '')$k$ as s),
     ex as (select q.oid, a.grantee
              from pg_proc q, lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
             where a.privilege_type = 'EXECUTE')
select 1 as "#", '関数がある（呼んだ本人の権限で動かない＝ security definer）' as "確かめること",
       case when (select prosecdef from pg_proc where oid = 'public.my_pay_report_one(text, text, int, int)'::regprocedure)
            then '✅' else '❌' end as "判定"
union all select 2, '未ログイン（anon）と PUBLIC は呼べない・ログイン済みは呼べる',
       case when not exists (select 1 from ex
                              where ex.oid = 'public.my_pay_report_one(text, text, int, int)'::regprocedure
                                and (ex.grantee = 0 or ex.grantee in (select oid from pg_roles where rolname = 'anon')))
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
union all select 6, '削除：関数がある（security definer）',
       case when (select prosecdef from pg_proc where oid = 'public.delete_my_pay_report(text, text, int, int)'::regprocedure)
            then '✅' else '❌' end
union all select 7, '削除：未ログイン（anon）と PUBLIC は呼べない・ログイン済みは呼べる',
       case when not exists (select 1 from ex
                              where ex.oid = 'public.delete_my_pay_report(text, text, int, int)'::regprocedure
                                and (ex.grantee = 0 or ex.grantee in (select oid from pg_roles where rolname = 'anon')))
             and has_function_privilege('authenticated', 'public.delete_my_pay_report(text, text, int, int)', 'EXECUTE')
            then '✅' else '❌' end
union all select 8, '削除：ログインしていなければ止める（auth.uid() が無い）',
       case when (select s from d) like '%if v_uid is null then%' and (select s from d) like '%42501%'
            then '✅' else '❌' end
union all select 9, '削除：消す行の鍵と残りの行を探す鍵が submit_pay_report と同じ式',
       case when (select s from d) like '%' || (select s from k) || '%' and (select s from d) like '%' || (select s from kr) || '%'
             and (select s from s) like '%' || (select s from k) || '%'
            then '✅' else '❌' end
union all select 10, '削除：継続の数え方が submit_pay_report の4つの枝と同じ（submit の本文が変わっていない）',
       case when (select s from s) like '%if v_prof.last_pay_period_ym is null then%v_streak := 1;%'
                                  || 'elsif v_ym = v_prof.last_pay_period_ym + 1 then%v_streak := greatest(v_prof.pay_streak_months, 0) + 1;%'
                                  || 'elsif v_ym <= v_prof.last_pay_period_ym then%v_streak := greatest(v_prof.pay_streak_months, 1);%'
                                  || 'else%v_streak := 1;%'
             and (select s from g) like '%if v_last is null then%v_streak := 1;%'
                                  || 'elsif v_ym = v_last + 1 then%v_streak := greatest(v_streak, 0) + 1;%'
                                  || 'elsif v_ym <= v_last then%v_streak := greatest(v_streak, 1);%'
                                  || 'else%v_streak := 1;%'
             and (select s from d) like '%pv_pay_streak_of(v_yms)%'
            then '✅' else '❌' end
union all select 11, '削除：最後の1件で REAL PAY を閉じる・返すのは ok / deleted / remaining / closed だけ',
       case when (select s from d) like '%access_until       = null%'
             and (select s from d) like '%''closed'',%'
             and (select s from d) not like '%''proof_hash''%' and (select s from d) not like '%''id''%'
            then '✅' else '❌' end
union all select 12, '継続の数え直し（pv_pay_streak_of）は外から呼べない',
       case when not exists (select 1 from ex
                              where ex.oid = 'public.pv_pay_streak_of(int[])'::regprocedure
                                and (ex.grantee = 0 or ex.grantee in (select oid from pg_roles where rolname in ('anon', 'authenticated'))))
            then '✅' else '❌' end
order by 1;
