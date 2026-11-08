-- ════════════════════════════════════════════════════════════════
-- welcome-mail — 登録した会員に、1人1回だけ歓迎のメールを送るための土台（2026-11-06）
--
--   貼る順: pay-reports.sql → profile-lang.sql → pay-rows.sql → airlines.generated.sql → **これ**
--   （profiles.lang・profiles.pay_report_count・pv_airline_resolve・pv_airlines を使う。本番にはどれも貼ってある）
--   ★先に Edge Function「welcome-member」を Deploy してから貼る
--     （最後の節で10分おきの時計が入る。関数が無いと、時計が404を叩き続ける）。
--
--   このファイルが持つもの:
--     pv_welcome_mail            … 送った人の記録（1人1行）
--     pv_welcome_due(limit)      … 今送る相手（ここが「誰に送るか」の唯一の正）
--     pv_welcome_mark(id, ok)    … 送れた／送れなかったを記録する
--     時計 pv-welcome-member     … 10分おきに Edge Function を叩く
--
--   ★誰にも grant しない。service_role だけが呼べる（会員が叩いても、新しく登録した人の
--     アドレスは取れない）。security definer にしてあるので、下の revoke が命綱。
--   ★何度貼っても同じ。
-- ════════════════════════════════════════════════════════════════

do $guard$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'lang') then
    raise exception '先に db/profile-lang.sql を貼ってください（profiles.lang がまだありません）';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'pay_report_count') then
    raise exception '先に db/pay-reports.sql を貼ってください（profiles.pay_report_count がまだありません）';
  end if;
end
$guard$;


-- ── 1. 送った人の記録 ───────────────────────────────────────
--   ★会員が退会して profiles の行が消えたら、この記録も一緒に消える（誰が登録したかを残さない）。
create table if not exists public.pv_welcome_mail (
  id       uuid primary key references public.profiles(id) on delete cascade,
  sent_at  timestamptz,                         -- 送れた時刻（null ＝ まだ送れていない）
  tries    integer not null default 0,          -- 送ろうとした回数（3回で諦める）
  tried_at timestamptz not null default now()
);
alter table public.pv_welcome_mail enable row level security;
-- ポリシーを1つも置かない＝service_role 以外からは読めない・書けない。
revoke all on table public.pv_welcome_mail from public, anon, authenticated;
grant select, insert, update on table public.pv_welcome_mail to service_role;


-- ── 2. 今送る相手 ───────────────────────────────────────────
-- ★2026-11-07 返す形を変えた（gave_pay を足した）。形が変わると create or replace では
--   入れ替えられないので、一度消してから作る（下で権限も付け直す）。
drop function if exists public.pv_welcome_due(integer);
create function public.pv_welcome_due(p_limit integer default 50)
returns table (
  id             uuid,
  email          text,
  name           text,
  country        text,
  airline_region text,
  lang           text,
  unsub_token    text,
  gave_pay       boolean      -- もう給与を出した人（文面のお願いを口コミに替える）
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.name, p.country,
         -- ★勤務先は自由入力。語彙に寄せて地域だけを渡す（打ち込まれた社名は関数に渡さない）。
         --   言語が残っていない人の推測にだけ使う（週まとめと同じ）。
         coalesce((select a.region from public.pv_airlines a
                    where a.code = public.pv_airline_resolve(p.company)), '') as airline_region,
         p.lang,
         p.unsub_token::text,
         coalesce(p.pay_report_count, 0) > 0 as gave_pay
    from public.profiles p
    left join public.pv_welcome_mail w on w.id = p.id
   -- ★通知を希望しているかどうかは見ない（2026-11-08 オーナー指示「通知を希望しているかいないかに関わらず」）。
   --   1人1回のお礼で、繰り返し届くメールではない＝登録者全員へ送るお知らせと同じ扱い。
   --   そのぶん足元の文は「通知を希望された方に」と書かない（welcome-member の foot）。
   where p.email is not null
     and position('@' in p.email) > 1
     -- ★会員になった人。どちらか一方で足りる。認証だけして途中でやめた人には送らない。
     --   ・登録画面を終えた（必須の3つ）
     --   ・給与を1件以上出した（2026-11-07 オーナー指摘：給与フォームから入る人には
     --     メールアドレスしか聞かないので、3つが空のまま会員になる。いちばん大事な人を外していた）
     and (   (    nullif(btrim(p.country), '') is not null
              and nullif(btrim(p.company), '') is not null
              and nullif(btrim(p."position"::text), '') is not null)
          or coalesce(p.pay_report_count, 0) > 0)
     -- ★登録から72時間以内。今までの会員には送らない（初めて動かした日に全員へ飛ばない）。
     and p.created_at > now() - interval '72 hours'
     -- ★1人1回。送れた人は二度と選ばない・3回失敗した人も選ばない。
     and w.sent_at is null
     and coalesce(w.tries, 0) < 3
   order by p.created_at asc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.pv_welcome_due(integer) from public, anon, authenticated;
grant execute on function public.pv_welcome_due(integer) to service_role;

comment on function public.pv_welcome_due(integer) is
  '歓迎メールを今送る相手。会員になった（登録画面を終えた か 給与を出した）・登録から72時間以内・まだ送っていない人（通知の希望は問わない）。'
  '勤務先は地域だけを返す。service_role だけが呼べる。';


-- ── 3. 送れた／送れなかったを記録する ────────────────────────
--   返すのは試した回数。退会して profiles の行がもう無い人は何も書かない（null を返す）。
create or replace function public.pv_welcome_mark(p_id uuid, p_ok boolean default true)
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.pv_welcome_mail as w (id, sent_at, tries, tried_at)
  select p_id, case when p_ok then now() end, 1, now()
   where exists (select 1 from public.profiles p where p.id = p_id)
  on conflict (id) do update
     set tries    = w.tries + 1,
         tried_at = now(),
         -- ★一度送れた記録は消さない（あとで失敗を記録しても「送った」のまま）。
         sent_at  = coalesce(w.sent_at, excluded.sent_at)
  returning tries;
$$;

revoke all on function public.pv_welcome_mark(uuid, boolean) from public, anon, authenticated;
grant execute on function public.pv_welcome_mark(uuid, boolean) to service_role;


-- ── 4. 10分おきの時計 ───────────────────────────────────────
--   ★合言葉と住所を手で打たない。週まとめの予約（pv-weekly-digest）の中身を写して、
--     叩く先だけ welcome-member に替える（同じ合言葉・同じプロジェクト）。
--   ★時計の無い場所（手元の検査）では何もしない。
--   止めるとき: select cron.unschedule('pv-welcome-member');
--   実行履歴  : select * from cron.job_run_details order by start_time desc limit 20;
do $cron$
declare
  v_cmd text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron が無いので、時計の予約は飛ばしました';
    return;
  end if;
  execute $q$select command from cron.job where jobname = 'pv-weekly-digest'$q$ into v_cmd;
  if v_cmd is null or position('/functions/v1/weekly-digest' in v_cmd) = 0 then
    raise exception '週まとめの予約（pv-weekly-digest）が見つからないので、歓迎メールの時計を入れられません';
  end if;
  -- 同じ名前で入れ直すと上書きになる（何度貼っても1本）。
  perform cron.schedule('pv-welcome-member', '*/10 * * * *',
                        replace(v_cmd, '/functions/v1/weekly-digest', '/functions/v1/welcome-member'));
end
$cron$;


-- ════════════════════════════════════════════════════════════════
-- 5. 検算（貼ったあと、この表がすべて ✅ なら完了。ℹ️ の行は今の人数）
-- ════════════════════════════════════════════════════════════════
select case when to_regclass('public.pv_welcome_mail') is not null
            then '✅ 送った人の記録の表がある' else '❌ 送った人の記録の表が無い' end as 検算
union all
select case when not has_function_privilege('anon', 'public.pv_welcome_due(integer)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_welcome_due(integer)', 'execute')
             and not has_function_privilege('anon', 'public.pv_welcome_mark(uuid, boolean)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_welcome_mark(uuid, boolean)', 'execute')
            then '✅ 会員からは呼べない' else '❌ 会員から呼べてしまう' end
union all
select case when not has_table_privilege('anon', 'public.pv_welcome_mail', 'select')
             and not has_table_privilege('authenticated', 'public.pv_welcome_mail', 'select')
             and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pv_welcome_mail')
            then '✅ 記録の表は会員から読めない' else '❌ 記録の表が会員から読める' end
union all
select case when not exists (select 1 from pg_extension where extname = 'pg_cron')
            then 'ℹ️ 時計が無い場所（手元の検査）'
            else '✅ 時計の予約を入れた（10分おき・名前 pv-welcome-member）' end
union all
select 'ℹ️ 次の時計で送る人数：' || count(*)::text from public.pv_welcome_due(200);
