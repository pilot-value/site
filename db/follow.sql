-- ════════════════════════════════════════════════════════════════
-- follow — 気になる会社をフォローして、新着が入ったらメールで知らせる（2026-11-07）
--
--   オーナー採用（2026-11-07）：
--     ・会社ページの「フォロー」で会社を足す（1人10社まで）。マイページで外せる。
--     ・**自分の会社（登録の会社）は最初からフォロー済み**。外したときだけ外れる（外した記録だけを持つ＝全員分を書き込まない）。
--     ・**新着が入ったら、すぐ別のメール**（給与・口コミ・待遇の答え）。件数・金額・職位・本文は書かない（どれが入ったかだけ）。
--   推測されにくくする工夫（オーナーの決定の範囲で）：
--     ・1時間ごとにまとめて送る（時計は1時間おき＝分単位で出した時刻が分からない）
--     ・1人24時間に1通まで（続いた分は次の1通にまとまる。前に送った時刻から先の新着を数える）
--     ・**自分が出した分では知らせない**（受け取る人の印を作り直して、その人の投稿を外す）
--
--   貼る順: pay-reports.sql → pay-rows.sql → airline-conditions.sql → reviews-gate.sql → pilot-proof.sql
--           → member-median.sql（テスト用アカウントの名簿 pv_test_users）→ profile-lang.sql → **これ**（serve-local.mjs の SQL_FILES の順）
--   ★先に Edge Function「follow-notify」を Deploy してから貼る（最後の節で1時間おきの時計が入る）。
--
--   このファイルが持つもの:
--     pv_follow                … フォローの記録（会員×会社。following=false は「自分の会社を外した」印）
--     pv_my_follows()          … 本人のフォロー中の会社（会員が呼ぶ・自分の分だけ）
--     pv_follow_set(code, on)  … フォローする／外す（会員が呼ぶ・自分の分だけ・10社まで）
--     pv_follow_mail           … 知らせを送った時刻（1人1行）
--     pv_follow_due(limit)     … 今送る相手と、会社ごとの「何が入ったか」（★件数は返さない）
--     pv_follow_mark(id, ok)   … 送れた／送れなかったを記録する
--     時計 pv-follow-notify    … 1時間おき（毎時7分）に Edge Function を叩く
--
--   ★数えるもの（ほかの画面と同じ外し方。db/airline-activity.sql と同じ）
--     給与＝年 $10,000〜$700,000 の幅・一覧から下ろした人でない・テスト用アカウントでない
--     口コミ＝テスト用アカウントでない（引き取っていない預かりは数えない：誰の投稿か分からず、本人を外せないため）
--     待遇の答え＝実際に答えた行だけ（スキップ・「わからない」は数えない）・テスト用アカウントでない
--   ★知らせの数え始めは、このファイルを初めて貼った時刻（それより前の投稿では知らせない）。
--   ★何度貼っても同じ。
-- ════════════════════════════════════════════════════════════════

do $guard$
begin
  if to_regclass('public.pv_test_users') is null then
    raise exception '先に db/member-median.sql を貼ってください（テスト用アカウントの名簿 pv_test_users がまだありません）';
  end if;
  if to_regclass('public.pv_proof') is null then
    raise exception '先に db/pilot-proof.sql を貼ってください（pv_proof がまだありません）';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'lang') then
    raise exception '先に db/profile-lang.sql を貼ってください（profiles.lang がまだありません）';
  end if;
end
$guard$;


-- ── 1. 表 ────────────────────────────────────────────────────
create table if not exists public.pv_follow (
  uid        uuid not null references public.profiles(id) on delete cascade,
  airline    text not null references public.pv_airlines(code) on delete cascade,
  following  boolean not null,                  -- false ＝ 自分の会社を外した印（ほかの会社は外したら行ごと消す）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),  -- フォローした時刻（ここより後の新着だけ知らせる）
  primary key (uid, airline)
);
alter table public.pv_follow enable row level security;
revoke all on table public.pv_follow from public, anon, authenticated;

create table if not exists public.pv_follow_mail (
  uid      uuid primary key references public.profiles(id) on delete cascade,
  sent_at  timestamptz,                 -- 最後に送れた時刻（ここより後の新着を次に知らせる）
  tries    integer not null default 0,  -- 続けて失敗した回数（送れたら0に戻る）
  tried_at timestamptz
);
alter table public.pv_follow_mail enable row level security;
revoke all on table public.pv_follow_mail from public, anon, authenticated;

-- 数え始め（初めて貼った時刻。二度目からは変えない）
create table if not exists public.pv_follow_launch (
  one boolean primary key default true check (one),
  at  timestamptz not null default now()
);
alter table public.pv_follow_launch enable row level security;
revoke all on table public.pv_follow_launch from public, anon, authenticated;
insert into public.pv_follow_launch(one) values (true) on conflict (one) do nothing;


-- ── 2. 本人のフォロー中の会社（中で使う）─────────────────────
--   自分の会社は、外した印が無い限りフォロー扱い。since ＝ その会社の新着を数え始める時刻。
create or replace function public.pv_follow_list(p_uid uuid)
returns table (airline text, own boolean, since timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.id, p.created_at,
           public.pv_airline_resolve(p.company) as own_code
      from public.profiles p where p.id = p_uid
  ),
  own as (
    select m.own_code as airline, true as own, m.created_at as since
      from me m join public.pv_airlines a on a.code = m.own_code and a.code <> 'other' and coalesce(a.active, true)
     where not exists (select 1 from public.pv_follow f
                        where f.uid = m.id and f.airline = m.own_code and not f.following)
  ),
  picked as (
    select f.airline, false as own, f.updated_at as since
      from public.pv_follow f
      join public.pv_airlines a on a.code = f.airline and a.code <> 'other' and coalesce(a.active, true)
     where f.uid = p_uid and f.following
       and f.airline is distinct from (select own_code from me)
  )
  select * from own union all select * from picked;
$$;
revoke all on function public.pv_follow_list(uuid) from public, anon, authenticated;


-- ── 3. 会員が呼ぶ口（自分の分だけ）─────────────────────────
create or replace function public.pv_my_follows()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'login'); end if;
  return jsonb_build_object(
    'ok', true,
    'max', 10,
    -- 会社名と「会社のページがあるか」（年収を載せている会社だけページがある）も返す ── マイページの一覧に出すため
    'list', coalesce((select jsonb_agg(jsonb_build_object('code', l.airline, 'own', l.own, 'ja', a.name_ja, 'en', a.name_en,
                                                          'page', a.cap_lo is not null) order by l.own desc, l.since)
                        from public.pv_follow_list(v_uid) l join public.pv_airlines a on a.code = l.airline), '[]'::jsonb));
end
$$;
revoke all on function public.pv_my_follows() from public, anon;
grant execute on function public.pv_my_follows() to authenticated;

create or replace function public.pv_follow_set(p_airline text, p_on boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_own text;
  v_n   int;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'login'); end if;
  if p_on is null or p_airline is null
     or not exists (select 1 from public.pv_airlines a
                     where a.code = p_airline and a.code <> 'other' and coalesce(a.active, true)) then
    return jsonb_build_object('ok', false, 'reason', 'bad_airline');
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'login');
  end if;
  select public.pv_airline_resolve(p.company) into v_own from public.profiles p where p.id = v_uid;

  if p_airline = v_own then
    -- 自分の会社：外したら印を残す・付け直したら印を消す（＝最初からフォロー済みに戻る）
    if p_on then
      delete from public.pv_follow f where f.uid = v_uid and f.airline = p_airline;
    else
      insert into public.pv_follow(uid, airline, following) values (v_uid, p_airline, false)
      on conflict (uid, airline) do update set following = false, updated_at = now();
    end if;
  elsif p_on then
    if not exists (select 1 from public.pv_follow f where f.uid = v_uid and f.airline = p_airline and f.following) then
      select count(*) into v_n from public.pv_follow_list(v_uid);
      if v_n >= 10 then return jsonb_build_object('ok', false, 'reason', 'too_many', 'max', 10); end if;
      insert into public.pv_follow(uid, airline, following) values (v_uid, p_airline, true)
      on conflict (uid, airline) do update set following = true, updated_at = now();
    end if;
  else
    delete from public.pv_follow f where f.uid = v_uid and f.airline = p_airline;
  end if;
  return public.pv_my_follows();
end
$$;
revoke all on function public.pv_follow_set(text, boolean) from public, anon;
grant execute on function public.pv_follow_set(text, boolean) to authenticated;


-- ── 4. 今送る相手 ───────────────────────────────────────────
--   1人1行。items ＝ 新着があった会社ごとに {code, ja, en, page, kinds:['pay','review','cond']}（★件数は返さない）。page ＝ 会社のページがある。
--   新着＝フォローを始めた時刻・前に送った時刻・数え始めのうち、いちばん遅い時刻より後に入ったもの。
create or replace function public.pv_follow_due(p_limit integer default 50)
returns table (
  id uuid, email text, name text, country text, airline_region text, lang text, unsub_token text, items jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with
  launch as (select coalesce((select l.at from public.pv_follow_launch l), now()) as at),
  floor_at as (select greatest((select at from launch), now() - interval '8 days') as at),
  -- ★新着の候補（数える物だけ・テスト用アカウントを外す）。8日より前は見ない（重くしない）
  ev as (
    select r.airline as code, 'pay'::text as kind, r.created_at as at, r.proof_hash as h, 'pay'::text as hk, null::text as raw
      from public.pay_reports r
     where r.created_at > (select at from floor_at)
       and r.airline <> 'other'
       and r.annual_total_usd between 10000 and 700000
       and not exists (select 1 from public.pay_hidden h where h.proof_hash = r.proof_hash)
       and not exists (select 1 from public.pv_test_users t
                        where encode(digest(t.uid::text || '::pv_pay::' || r.airline, 'sha256'), 'hex') = r.proof_hash)
    union all
    select public.pv_airline_resolve(v.airline), 'review', v.created_at, v.proof_hash, 'review', v.airline
      from public.reviews_v2 v
     where v.created_at > (select at from floor_at)
       and not exists (select 1 from public.pv_test_users t where public.pv_review_hash(t.uid, v.airline) = v.proof_hash)
    union all
    select c.airline, 'cond', c.created_at, c.proof_hash, 'cond', null
      from public.airline_conditions c
     where c.created_at > (select at from floor_at)
       and c.airline <> 'other'
       and c.skipped_at is null
       and num_nonnulls(c.answer_code, c.answer_codes, c.answer_num) > 0
       and c.answer_code is distinct from 'unknown'
       and not exists (select 1 from public.pv_test_users t where public.pv_condition_hash(t.uid, c.airline, null) = c.proof_hash)
  ),
  who as (
    select p.id, p.email, p.name, p.country, p.lang, p.unsub_token::text as unsub_token, p.created_at, p.company,
           greatest((select at from launch), coalesce(fm.sent_at, '-infinity'::timestamptz)) as since_p
      from public.profiles p
      left join public.pv_follow_mail fm on fm.uid = p.id
     where coalesce(p.email_opt_in, false)
       and p.email is not null and position('@' in p.email) > 1
       -- ★24時間に1通まで
       and (fm.sent_at is null or fm.sent_at <= now() - interval '24 hours')
       -- ★続けて3回失敗したら、その日は諦める
       and not (coalesce(fm.tries, 0) >= 3 and fm.tried_at > now() - interval '24 hours')
       -- ★確認待ちで止めた会員には送らない
       and not exists (select 1 from public.pv_proof b where b.user_id = p.id and b.state in ('required', 'submitted'))
  ),
  hits as (
    select w.id, l.airline as code, e.kind
      from who w
      cross join lateral public.pv_follow_list(w.id) l
      join ev e on e.code = l.airline
     where e.at > greatest(w.since_p, l.since)
       and e.at <= now()
       -- ★自分が出した分では知らせない（受け取る人の印を作り直して外す）
       and e.h is distinct from (case e.hk
             when 'pay'    then encode(digest(w.id::text || '::pv_pay::' || l.airline, 'sha256'), 'hex')
             when 'review' then public.pv_review_hash(w.id, e.raw)
             else               public.pv_condition_hash(w.id, l.airline, null) end)
     group by w.id, l.airline, e.kind
  ),
  per as (
    select h.id, h.code,
           jsonb_build_object('code', h.code, 'ja', a.name_ja, 'en', a.name_en, 'page', a.cap_lo is not null,
             'kinds', jsonb_agg(h.kind order by case h.kind when 'pay' then 1 when 'review' then 2 else 3 end)) as item
      from hits h join public.pv_airlines a on a.code = h.code
     group by h.id, h.code, a.name_ja, a.name_en, a.cap_lo
  )
  select w.id, w.email, w.name, w.country,
         coalesce((select a.region from public.pv_airlines a where a.code = public.pv_airline_resolve(w.company)), '') as airline_region,
         w.lang, w.unsub_token,
         (select jsonb_agg(pr.item order by pr.code) from per pr where pr.id = w.id) as items
    from who w
   where exists (select 1 from per pr where pr.id = w.id)
   order by w.created_at asc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
revoke all on function public.pv_follow_due(integer) from public, anon, authenticated;


-- ── 5. 送れた／送れなかったを記録する ────────────────────────
create or replace function public.pv_follow_mark(p_id uuid, p_ok boolean default true)
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.pv_follow_mail as m (uid, sent_at, tries, tried_at)
  select p_id, case when p_ok then now() end, case when p_ok then 0 else 1 end, now()
   where exists (select 1 from public.profiles p where p.id = p_id)
  on conflict (uid) do update
     set sent_at  = case when p_ok then now() else m.sent_at end,
         tries    = case when p_ok then 0 else m.tries + 1 end,
         tried_at = now()
  returning tries;
$$;
revoke all on function public.pv_follow_mark(uuid, boolean) from public, anon, authenticated;


-- ── service_role（Edge Function）に渡す。手元の検査の DB には service_role が無いので、在るときだけ ──
do $grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on table public.pv_follow to service_role';
    execute 'grant select, insert, update on table public.pv_follow_mail to service_role';
    execute 'grant execute on function public.pv_follow_due(integer) to service_role';
    execute 'grant execute on function public.pv_follow_mark(uuid, boolean) to service_role';
  end if;
end
$grant$;

-- ── 6. 1時間おきの時計 ──────────────────────────────────────
--   ★週まとめの予約（pv-weekly-digest）の中身を写して、叩く先だけ follow-notify に替える（同じ合言葉）。
--   止めるとき: select cron.unschedule('pv-follow-notify');
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
    raise exception '週まとめの予約（pv-weekly-digest）が見つからないので、フォローの時計を入れられません';
  end if;
  perform cron.schedule('pv-follow-notify', '7 * * * *',
                        replace(v_cmd, '/functions/v1/weekly-digest', '/functions/v1/follow-notify'));
end
$cron$;


-- ════════════════════════════════════════════════════════════════
-- 7. 検算（貼ったあと、この表がすべて ✅ なら完了。ℹ️ の行は今の人数）
-- ════════════════════════════════════════════════════════════════
select case when to_regclass('public.pv_follow') is not null and to_regclass('public.pv_follow_mail') is not null
            then '✅ フォローの表と、送った記録の表がある' else '❌ 表が無い' end as 検算
union all
select case when not has_function_privilege('anon', 'public.pv_my_follows()', 'execute')
             and not has_function_privilege('anon', 'public.pv_follow_set(text, boolean)', 'execute')
             and has_function_privilege('authenticated', 'public.pv_my_follows()', 'execute')
             and has_function_privilege('authenticated', 'public.pv_follow_set(text, boolean)', 'execute')
            then '✅ フォローの口は会員だけが呼べる（未ログインは呼べない）' else '❌ フォローの口の権限がおかしい' end
union all
select case when not has_function_privilege('authenticated', 'public.pv_follow_due(integer)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_follow_mark(uuid, boolean)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_follow_list(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.pv_follow_due(integer)', 'execute')
            then '✅ 送る相手と記録は会員からは呼べない' else '❌ 送る相手が会員から呼べてしまう' end
union all
select case when not has_table_privilege('authenticated', 'public.pv_follow', 'select')
             and not has_table_privilege('authenticated', 'public.pv_follow_mail', 'select')
             and not has_table_privilege('anon', 'public.pv_follow', 'select')
            then '✅ 表は会員から直接読めない（ほかの人のフォローは見えない）' else '❌ 表が会員から読める' end
union all
select case when not exists (select 1 from pg_extension where extname = 'pg_cron')
            then 'ℹ️ 時計が無い場所（手元の検査）'
            else '✅ 時計の予約を入れた（毎時7分・名前 pv-follow-notify）' end
union all
select 'ℹ️ 次の時計で知らせを送る人数：' || count(*)::text from public.pv_follow_due(200);
