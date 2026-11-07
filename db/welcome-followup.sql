-- ════════════════════════════════════════════════════════════════
-- welcome-followup — 登録だけで止まっている会員に、2通目を1人1回だけ送る土台（2026-11-07）
--
--   オーナー採用（2026-11-07）「登録だけで止まっている人への2通目」・登録から3日後。
--   送るのは歓迎メールと同じ関数 welcome-member（同じ10分おきの時計の中で、歓迎メールのあとに送る）。
--
--   貼る順: welcome-mail.sql → pilot-proof.sql（本番にはどちらも貼ってある）→ **これ**
--   ★先に Edge Function「welcome-member」を新しい版で Deploy してから貼っても、逆でもよい
--     （関数は、この口が無ければ2通目を飛ばすだけ。歓迎メールは今までどおり送る）。
--
--   このファイルが持つもの:
--     pv_welcome_followup             … 2通目を送った人の記録（1人1行）
--     pv_welcome_followup_due(limit)  … 今送る相手（ここが「誰に送るか」の唯一の正）
--     pv_welcome_followup_mark(id,ok) … 送れた／送れなかったを記録する
--
--   誰に送るか（すべて満たす人だけ）
--     ・通知を希望している（email_opt_in）。登録時の同意は「有益な更新」。中身は本人の会社のページの案内＋お願い1つ
--     ・歓迎メールを受け取った人で、それから2日以上たっている（2通が続けて届かない）
--     ・登録から3日以上・10日以内（★今までの会員には送らない。歓迎メールを受け取った人だけなので、新しく登録した人だけ）
--     ・給与をまだ1件も出していない（pay_report_count = 0）
--     ・パイロットであることの確認待ちで止めた会員ではない
--     ・1人1回（送れたら二度と選ばない・3回失敗したら諦める）
--
--   ★誰にも grant しない。service_role だけが呼べる。security definer なので、下の revoke が命綱。
--   ★勤務先は自由入力。語彙に寄せた会社コード・会社名（表の名前）・地域だけを返す（打ち込まれた字は返さない）。
--   ★何度貼っても同じ。
-- ════════════════════════════════════════════════════════════════

do $guard$
begin
  if to_regclass('public.pv_welcome_mail') is null then
    raise exception '先に db/welcome-mail.sql を貼ってください（歓迎メールの記録 pv_welcome_mail がまだありません）';
  end if;
  if to_regclass('public.pv_proof') is null then
    raise exception '先に db/pilot-proof.sql を貼ってください（pv_proof がまだありません）';
  end if;
end
$guard$;


-- ── 1. 送った人の記録 ───────────────────────────────────────
create table if not exists public.pv_welcome_followup (
  id       uuid primary key references public.profiles(id) on delete cascade,
  sent_at  timestamptz,
  tries    integer not null default 0,
  tried_at timestamptz not null default now()
);
alter table public.pv_welcome_followup enable row level security;
revoke all on table public.pv_welcome_followup from public, anon, authenticated;
grant select, insert, update on table public.pv_welcome_followup to service_role;


-- ── 2. 今送る相手 ───────────────────────────────────────────
drop function if exists public.pv_welcome_followup_due(integer);
create function public.pv_welcome_followup_due(p_limit integer default 50)
returns table (
  id             uuid,
  email          text,
  name           text,
  country        text,
  airline_region text,
  lang           text,
  unsub_token    text,
  airline        text,      -- 会社コード（一覧に無い・語彙に当たらない会社は null）
  airline_ja     text,
  airline_en     text,
  airline_page   boolean    -- 会社のページがある（年収を載せている会社）
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.name, p.country,
         coalesce(a.region, '') as airline_region,
         p.lang,
         p.unsub_token::text,
         a.code, a.name_ja, a.name_en,
         (a.code is not null and a.cap_lo is not null) as airline_page
    from public.profiles p
    join public.pv_welcome_mail w on w.id = p.id and w.sent_at is not null
    left join public.pv_welcome_followup f on f.id = p.id
    left join public.pv_airlines a
      on a.code = public.pv_airline_resolve(p.company) and a.code <> 'other' and coalesce(a.active, true)
   where coalesce(p.email_opt_in, false)
     and p.email is not null
     and position('@' in p.email) > 1
     -- ★歓迎メールから2日以上あける
     and w.sent_at <= now() - interval '2 days'
     -- ★登録から3日以上・10日以内
     and p.created_at <= now() - interval '3 days'
     and p.created_at >  now() - interval '10 days'
     -- ★給与をまだ出していない
     and coalesce(p.pay_report_count, 0) = 0
     -- ★確認待ちで止めた会員には送らない
     and not exists (select 1 from public.pv_proof b
                      where b.user_id = p.id and b.state in ('required', 'submitted'))
     -- ★1人1回
     and f.sent_at is null
     and coalesce(f.tries, 0) < 3
   order by p.created_at asc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.pv_welcome_followup_due(integer) from public, anon, authenticated;
grant execute on function public.pv_welcome_followup_due(integer) to service_role;

comment on function public.pv_welcome_followup_due(integer) is
  '2通目を今送る相手。通知を希望・歓迎メールから2日以上・登録から3〜10日・給与を出していない・確認待ちで止めていない・まだ送っていない人。'
  '勤務先は語彙の会社コードと表の名前だけを返す。service_role だけが呼べる。';


-- ── 3. 送れた／送れなかったを記録する ────────────────────────
create or replace function public.pv_welcome_followup_mark(p_id uuid, p_ok boolean default true)
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.pv_welcome_followup as f (id, sent_at, tries, tried_at)
  select p_id, case when p_ok then now() end, 1, now()
   where exists (select 1 from public.profiles p where p.id = p_id)
  on conflict (id) do update
     set tries    = f.tries + 1,
         tried_at = now(),
         sent_at  = coalesce(f.sent_at, excluded.sent_at)
  returning tries;
$$;

revoke all on function public.pv_welcome_followup_mark(uuid, boolean) from public, anon, authenticated;
grant execute on function public.pv_welcome_followup_mark(uuid, boolean) to service_role;


-- ════════════════════════════════════════════════════════════════
-- 4. 検算（貼ったあと、この表がすべて ✅ なら完了。ℹ️ の行は今の人数）
-- ════════════════════════════════════════════════════════════════
select case when to_regclass('public.pv_welcome_followup') is not null
            then '✅ 2通目を送った人の記録の表がある' else '❌ 2通目の記録の表が無い' end as 検算
union all
select case when not has_function_privilege('anon', 'public.pv_welcome_followup_due(integer)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_welcome_followup_due(integer)', 'execute')
             and not has_function_privilege('anon', 'public.pv_welcome_followup_mark(uuid, boolean)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_welcome_followup_mark(uuid, boolean)', 'execute')
            then '✅ 会員からは呼べない' else '❌ 会員から呼べてしまう' end
union all
select case when not has_table_privilege('anon', 'public.pv_welcome_followup', 'select')
             and not has_table_privilege('authenticated', 'public.pv_welcome_followup', 'select')
             and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pv_welcome_followup')
            then '✅ 記録の表は会員から読めない' else '❌ 記録の表が会員から読める' end
union all
select 'ℹ️ 次の時計で2通目を送る人数：' || count(*)::text from public.pv_welcome_followup_due(200);
