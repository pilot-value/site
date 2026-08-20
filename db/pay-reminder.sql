-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/pay-reminder.sql
-- 月次リマインド（Edge Function: remind-payslip）の土台。
-- Supabase → SQL Editor に貼り付けて実行。冪等（何度流しても安全）。
--
-- 前提: db/schema-additions.sql と db/pay-reports.sql が適用済みであること。
--
-- ── ここで直す不具合（送る前に直さないと事故になる）────────────
-- profiles には「メールを送ってよいか」の旗が2つある。
--
--   email_opt_in   … 昔からある方。signup.html が書き、profile.html の
--                    トグルが直接 update し、unsubscribe.html の解除リンクが
--                    unsubscribe(p_token) で false にする。★実際に動いている方。
--   mail_optin     … 明細トラッカー（pay-tracker.js）用に後から足した方。
--                    set_mail_optin(boolean) だけが書く。
--
-- 旗が2つあると、片方だけ落ちる経路ができる。具体的には
-- **解除リンクを踏んだ人（email_opt_in=false）に、mail_optin=true が残るので
-- リマインドが届き続ける。** 配信停止を無視して送るのは、機能の不具合ではなく
-- 事業のリスク（EU 圏の会員が来る前提なので特に）。
--
-- 直し方は「送信側で気をつける」ではなく「食い違えなくする」：
--   ① トリガーで email_opt_in が false に落ちた瞬間 mail_optin も false にする
--      （どの経路の update でも効く。UI が増えても守られる）
--   ② set_mail_optin(true) は email_opt_in も true にする
--      （リマインドを自分でオンにした＝メールの同意そのもの。
--        ここを繋がないと「オンにしたのに一通も来ない」という無言の失敗になる）
--   ③ 送信対象の条件は email_opt_in と mail_optin の両方が true
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 1. 同意の旗を食い違えなくする
-- ════════════════════════════════════════════════════════════════

-- 1-a. 既に食い違っている行を先に揃える（解除済みなのにリマインドが残っている人）
update public.profiles
   set mail_optin = false
 where mail_optin and not coalesce(email_opt_in, false);

-- 1-b. 以後は食い違えない。★送信側の実装に関係なく DB が保証する。
create or replace function public.pv_sync_mail_consent()
returns trigger
language plpgsql
as $$
begin
  -- 親（email_opt_in）が落ちたら子（mail_optin）も落とす。
  -- 逆は繋がない：メール全般を受け取る＝月次リマインドまで頼んだ、ではない。
  if coalesce(old.email_opt_in, false) and not coalesce(new.email_opt_in, false) then
    new.mail_optin := false;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_mail_consent_sync on public.profiles;
create trigger profiles_mail_consent_sync
  before update of email_opt_in on public.profiles
  for each row execute function public.pv_sync_mail_consent();

comment on function public.pv_sync_mail_consent() is
  '配信停止を1つの操作で確実にする。email_opt_in を false にすると mail_optin も落ちる。'
  '★送信クエリ側の条件だけに頼らない（UI が増えたときに片方だけ落ちる事故を構造的に消す）。';


-- 1-c. リマインドをオンにしたら、メールの同意そのものも立てる
create or replace function public.set_mail_optin(p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_on  boolean := coalesce(p_on, false);
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  update public.profiles
     set mail_optin    = v_on,
         -- 同意した瞬間だけ記録する。外したときは消さない（いつ同意したかの証拠を残す）
         mail_optin_at = case when v_on then now() else mail_optin_at end,
         -- ★オンにしたときは親の同意も立てる。ここを繋がないと
         --   「オンにしたのに一通も来ない」＝原因の分からない無言の失敗になる。
         --   オフにしたときは親に触らない（他のメールまで勝手に止めない）。
         email_opt_in    = case when v_on then true else email_opt_in end,
         email_opt_in_at = case when v_on and email_opt_in_at is null then now() else email_opt_in_at end
   where id = v_uid;
  return (
    select jsonb_build_object('ok', true, 'mail_optin', p.mail_optin, 'email_opt_in', p.email_opt_in)
      from public.profiles p where p.id = v_uid
  );
end;
$$;

revoke all on function public.set_mail_optin(boolean) from public, anon;
grant execute on function public.set_mail_optin(boolean) to authenticated;


-- 1-d. 解除リンク（unsubscribe.html）は今までどおり email_opt_in を落とす。
--      mail_optin は 1-b のトリガーが道連れに落とすので、ここは触らなくてよい。
--      再開（resubscribe）は親だけ戻す。★リマインドは自動で戻さない
--      ＝止めてくれと言われた配信を、こちらの判断で復活させない。
comment on function public.unsubscribe(uuid) is
  'ワンクリック解除。email_opt_in を false にすると、トリガー profiles_mail_consent_sync が '
  'mail_optin も false にする（＝1回のクリックで全部止まる）。';
comment on function public.resubscribe(uuid) is
  '配信再開。戻すのは email_opt_in だけ。月次リマインドは本人がマイページで入れ直す。';


-- ════════════════════════════════════════════════════════════════
-- 2. 今日送る人を選ぶ
--
-- ★「毎月25日に一斉送信」は誤り。日本は25日前後、湾岸は月末、
--   米国は月2回（1日/16日）。世界規模が前提なので、その人の
--   pay_day_of_month（初回投稿日から学習した値）を基準にする。
-- ★ 一度出した月には送らない。「もう出した人」に催促を送るのが
--   いちばん解除される。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_reminder_due(p_limit int default 200)
returns table (
  id             uuid,
  email          text,
  name           text,
  country        text,
  unsub_token    uuid,
  pay_day        smallint,
  streak_months  int,
  report_count   int,
  access_until   timestamptz,
  days_left      int
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select p.*,
           -- 給料日。学習前は 25 を仮に置く（初回投稿で本人の値に上書きされる）。
           coalesce(p.pay_day_of_month, 25)::int as raw_day,
           -- 月末が28日の月に「31日払い」の人を永久に取りこぼさないための丸め
           extract(day from (date_trunc('month', current_date)
                             + interval '1 month - 1 day'))::int as month_days
      from public.profiles p
  )
  select b.id, b.email, b.name, b.country, b.unsub_token,
         least(b.raw_day, b.month_days)::smallint as pay_day,
         coalesce(b.pay_streak_months, 0) as streak_months,
         coalesce(b.pay_report_count, 0)  as report_count,
         b.access_until,
         greatest(0, (b.access_until::date - current_date))::int as days_left
    from base b
   where coalesce(b.email_opt_in, false)          -- 親の同意
     and coalesce(b.mail_optin, false)            -- リマインドの同意
     and b.email is not null and position('@' in b.email) > 0
     -- 一度も明細を出していない人には送らない。文面が「先月の続き」なので
     -- 成立しないし、獲得メールを同意の裏で送ることになる。
     and b.last_pay_report_at is not null
     -- 給料日を過ぎている（当日も含む）。cron が1日落ちても翌日に拾える。
     and extract(day from current_date)::int >= least(b.raw_day, b.month_days)
     -- 今月まだ出していない人だけ。出した人に催促しない。
     and b.last_pay_report_at < date_trunc('month', current_date)
     -- 今月まだ送っていない（cron が二度走っても二通は出ない）
     and (b.mail_last_sent_at is null
          or b.mail_last_sent_at < date_trunc('month', current_date))
   order by b.access_until nulls last, b.id
   limit greatest(1, least(coalesce(p_limit, 200), 2000));
$$;

-- service_role だけ。anon にも authenticated にも開けない
-- （開くと会員のメールアドレス一覧がログイン1つで引ける）。
-- ★ revoke ... from public は「既定で全ロールに付いている EXECUTE」を剥がすので、
--   service_role も一緒に失う。Edge Function から呼ぶには明示的に grant し直す。
revoke all on function public.pv_reminder_due(int) from public, anon, authenticated;
grant execute on function public.pv_reminder_due(int) to service_role;

comment on function public.pv_reminder_due(int) is
  '今日リマインドを送る人。同意2つ・投稿実績あり・給料日到来・今月未投稿・今月未送信。'
  '★ service_role 専用。会員のメールアドレスを返すので絶対に anon/authenticated に開かない。';


-- 送信済みの記録。冪等キー（remind:<id>:<YYYY-MM>）と二重に効かせる。
create or replace function public.pv_reminder_mark_sent(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update public.profiles
     set mail_last_sent_at = now()
   where id = any(coalesce(p_ids, '{}'::uuid[]));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.pv_reminder_mark_sent(uuid[]) from public, anon, authenticated;
grant execute on function public.pv_reminder_mark_sent(uuid[]) to service_role;


-- ════════════════════════════════════════════════════════════════
-- 3. 解除トークンから1行引く（Edge Function の解除ページ用）
--    ★メールアドレスは返さない。解除ページに出す必要が無い上に、
--      URL を拾った第三者に会員のメールを見せることになる。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_reminder_unsub(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_hit int;
begin
  update public.profiles
     set email_opt_in = false     -- トリガーが mail_optin も落とす
   where unsub_token = p_token;
  get diagnostics v_hit = row_count;
  -- 見つからなくても true を返す。「そのトークンは存在しない」と答えると、
  -- トークンの当たり判定を外から作れてしまう。
  return jsonb_build_object('ok', true, 'changed', v_hit > 0);
end;
$$;

revoke all on function public.pv_reminder_unsub(uuid) from public, anon, authenticated;
grant execute on function public.pv_reminder_unsub(uuid) to service_role;

-- ついでに既存の1本も直す。revoke ... from public で service_role まで失っていて、
-- cron / Edge Function から呼べない状態だった（まだ配線していないので実害は無い）。
grant execute on function public.pv_refresh_badge_states() to service_role;


-- ════════════════════════════════════════════════════════════════
-- 4. マイページ RPC が同意の状態を両方返すようにする
--    （片方だけ見ていると、UI が「オン」と言っているのに送られない状態が作れる）
-- ════════════════════════════════════════════════════════════════
-- ※ 本体は db/pay-reports.sql の 5-b にある。ここでは触らない
--    （二重定義を作らない）。pay-reports.sql 側を直してあるので、
--    そちらを再実行すれば email_opt_in も返る。


-- ════════════════════════════════════════════════════════════════
-- 5. pg_cron（オーナー作業・Supabase の Dashboard から）
--
--   Database → Extensions → pg_cron を有効化 → 下を SQL Editor で実行。
--   ★ <PROJECT_REF> と <CRON_SECRET> を自分の値に置き換えること。
--   ★ CRON_SECRET は Edge Functions → Secrets の PV_CRON_SECRET と同じ値。
--
--   毎日 06:00 UTC に1回。給料日は人ごとに違うので、
--   「毎日走らせて、その日が給料日の人だけ選ぶ」が正しい形。
-- ════════════════════════════════════════════════════════════════
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule('pv-remind-payslip', '0 6 * * *', $cron$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/remind-payslip',
--     headers := jsonb_build_object('Content-Type','application/json',
--                                   'x-pv-cron-secret','<CRON_SECRET>'),
--     body    := '{}'::jsonb
--   );
-- $cron$);
--
-- 止めるとき: select cron.unschedule('pv-remind-payslip');
-- 実行履歴  : select * from cron.job_run_details order by start_time desc limit 20;


-- ════════════════════════════════════════════════════════════════
-- 6. 検算（実行後にここだけ流して確かめる）
-- ════════════════════════════════════════════════════════════════

-- 6-1. 同意が食い違っている行が無いこと（期待：0）
select count(*) as 解除済みなのにリマインドが残っている人数_0であること
  from public.profiles
 where coalesce(mail_optin, false) and not coalesce(email_opt_in, false);

-- 6-2. トリガーが付いていること（期待：1 行）
select tgname, tgenabled from pg_trigger
 where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_mail_consent_sync';

-- 6-3. 送信系の関数が anon/authenticated に開いていないこと
--      （期待：権限に anon= / authenticated= が出てこない）
select p.proname, coalesce(array_to_string(p.proacl::text[], ', '), '(既定)') as 権限
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('pv_reminder_due','pv_reminder_mark_sent','pv_reminder_unsub')
 order by p.proname;

-- 6-4. 今日の送信対象（0 行でも正常。給料日前・今月投稿済みなら出ない）
select count(*) as 今日送る人数 from public.pv_reminder_due(2000);

-- 6-5. 同意している人が何人いるか（母数の確認）
select count(*) filter (where coalesce(email_opt_in,false))                       as メール同意,
       count(*) filter (where coalesce(mail_optin,false))                          as リマインド同意,
       count(*) filter (where coalesce(mail_optin,false) and last_pay_report_at is not null) as うち投稿実績あり
  from public.profiles;
