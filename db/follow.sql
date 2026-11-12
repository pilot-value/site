-- ════════════════════════════════════════════════════════════════
-- follow — 気になる会社をフォローして、新着が入ったらメールで知らせる（2026-11-07）
--
--   オーナー採用（2026-11-07）：
--     ・会社ページの「フォロー」で会社を足す（1人10社まで）。マイページで外せる。
--     ・**自分の会社（登録の会社）は最初からフォロー済み**。外したときだけ外れる（外した記録だけを持つ＝全員分を書き込まない）。
--     ・新着（口コミ・待遇の答え）を別のメールで知らせる。
--       ★★2026-11-12 オーナー指示「出しづらいからメールなしにして。給与投稿はいらない」：**給与では知らせない。**
--         前は給与の新しい行でも「新しい給与が入りました」と知らせていた。受け取るのは主に同じ会社の同僚で、
--         毎月出す人は出すたびに同僚へ知らせが行っていた。⚠️ 給与を新着へ足し戻さない（検算の最後から2行目が見ている）。
--       ★2026-11-09 オーナー指示「提出後すぐではなく、翌日の17時に」「受け取る人の国の17時」：
--       **ある日に入った新着を、次の日の17時（受け取る人の国の時間）に1通にまとめて送る。**
--       日の区切りも受け取る人の国の0時。国はプロフィールの国の欄（pv_follow_tz の1か所で時間帯に直す）。
--       時刻が複数ある国（アメリカ・カナダ・オーストラリア）は代表の1つ・空と「その他」は日本時間。
--     ・**フォローしていなくても、見た会社にも知らせる**（2026-11-07 オーナー「OpenWork は閲覧だけで送っている」）。
--       見た記録は1人10社まで・30日で消える。マイページに「最近見た会社」として出し、本人が消せる。
--     ・メールに書くのは**サイトで誰にでも見せている範囲だけ**（2026-11-07 オーナー決定）：
--       口コミ＝評価・職位・在籍年数・最初の80字／待遇＝答えが入った質問の名前。
--   推測されにくくする工夫（オーナーの決定の範囲で）：
--     ・次の日の17時にまとめて送る（＝届いた時刻から、出した時刻が分からない。2026-11-08 には出して数分後に届いていた）
--     ・1人1日1通まで（前の日の0時までに入った分を1通に。送った日の分は次の日の1通に回る）
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
--     pv_follow_view           … 見た会社（会員×会社・最後に見た時刻。10社まで・30日で消える）
--     pv_follow_seen(code)     … 会社ページを開いた会員が呼ぶ（自分の分だけ）／pv_follow_unsee(code) … 消す
--     pv_follow_mail           … 知らせを送った時刻と、どこまでの新着を送ったか（upto）（1人1行）
--     pv_follow_tz(country)    … プロフィールの国 → 時間帯（受け取る人の国の17時と0時を決める1か所）
--     pv_follow_due(limit, now) … 今送る相手と、会社ごとの新着（★件数は返さない。口コミは公開の範囲の抜粋だけ）
--     pv_follow_mark(id, ok, upto) … 送れた／送れなかったを記録する
--     時計 pv-follow-notify    … 1時間おき（毎時0分）に Edge Function を叩く（国ごとの17時を拾うため。送るのは各国の17時〜24時だけ）
--
--   ★数えるもの（ほかの画面と同じ外し方。db/airline-activity.sql と同じ）
--     給与＝**数えない**（2026-11-12 から。上の ★★）
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

create table if not exists public.pv_follow_view (
  uid       uuid not null references public.profiles(id) on delete cascade,
  airline   text not null references public.pv_airlines(code) on delete cascade,
  viewed_at timestamptz not null default now(),   -- 最後に見た時刻（ここより後の新着だけ知らせる）
  primary key (uid, airline)
);
alter table public.pv_follow_view enable row level security;
revoke all on table public.pv_follow_view from public, anon, authenticated;

create table if not exists public.pv_follow_mail (
  uid      uuid primary key references public.profiles(id) on delete cascade,
  sent_at  timestamptz,                 -- 最後に送れた時刻（ここより後の新着を次に知らせる）
  tries    integer not null default 0,  -- 続けて失敗した回数（送れたら0に戻る）
  tried_at timestamptz
);
-- ★どこまでの新着を送ったか（受け取る人の国の0時）。次の1通はここから先を数える。
--   2026-11-09 より前に送った行は空（＝送った時刻 sent_at までを送り済みとして扱う）。
alter table public.pv_follow_mail add column if not exists upto timestamptz;
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

-- 受け取る人の国 → 時間帯（2026-11-09 オーナー「受け取る人の国の17時」）。
--   国の欄は登録・プロフィールの決まった20の選択肢（日英西とも値は日本語）。
--   時刻が複数ある国は代表の1つ：アメリカ＝中部（シカゴ・東部と西部のあいだ）／カナダ＝トロント／オーストラリア＝シドニー。
--   空・「その他」・選択肢に無い字は日本時間。夏時間は時間帯の名前が受け持つ。
create or replace function public.pv_follow_tz(p_country text)
returns text
language sql
immutable
set search_path = public
as $$
  select case btrim(coalesce(p_country, ''))
    when '日本'           then 'Asia/Tokyo'
    when 'アメリカ'       then 'America/Chicago'
    when 'UAE'            then 'Asia/Dubai'
    when 'シンガポール'   then 'Asia/Singapore'
    when '香港'           then 'Asia/Hong_Kong'
    when 'イギリス'       then 'Europe/London'
    when 'ドイツ'         then 'Europe/Berlin'
    when 'フランス'       then 'Europe/Paris'
    when 'オーストラリア' then 'Australia/Sydney'
    when 'カナダ'         then 'America/Toronto'
    when '韓国'           then 'Asia/Seoul'
    when '中国'           then 'Asia/Shanghai'
    when 'メキシコ'       then 'America/Mexico_City'
    when 'スペイン'       then 'Europe/Madrid'
    when 'コロンビア'     then 'America/Bogota'
    when 'チリ'           then 'America/Santiago'
    when 'ペルー'         then 'America/Lima'
    when 'アルゼンチン'   then 'America/Argentina/Buenos_Aires'
    when 'パナマ'         then 'America/Panama'
    else 'Asia/Tokyo' end;
$$;
revoke all on function public.pv_follow_tz(text) from public, anon, authenticated;


-- ── 2. 本人のフォロー中の会社（中で使う）─────────────────────
--   自分の会社は、外した印が無い限りフォロー扱い。since ＝ その会社の新着を数え始める時刻。
drop function if exists public.pv_follow_list(uuid);
create or replace function public.pv_follow_list(p_uid uuid)
returns table (airline text, own boolean, since timestamptz, why text)
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
    select m.own_code as airline, true as own, m.created_at as since, 'follow'::text as why
      from me m join public.pv_airlines a on a.code = m.own_code and a.code <> 'other' and coalesce(a.active, true)
     where not exists (select 1 from public.pv_follow f
                        where f.uid = m.id and f.airline = m.own_code and not f.following)
  ),
  picked as (
    -- ★見ていた会社をあとからフォローしたら、見た時刻から数える（見てからフォローするまでの新着を落とさない）
    select f.airline, false as own,
           least(f.updated_at, coalesce((select v.viewed_at from public.pv_follow_view v
                                          where v.uid = p_uid and v.airline = f.airline
                                            and v.viewed_at > now() - interval '30 days'), f.updated_at)) as since,
           'follow'::text as why
      from public.pv_follow f
      join public.pv_airlines a on a.code = f.airline and a.code <> 'other' and coalesce(a.active, true)
     where f.uid = p_uid and f.following
       and f.airline is distinct from (select own_code from me)
  ),
  -- ★見た会社（フォローしていない会社だけ・30日以内）。自分の会社を外した人が、その会社のページを見たら、ここで拾う
  seen as (
    select v.airline, false as own, v.viewed_at as since, 'seen'::text as why
      from public.pv_follow_view v
      join public.pv_airlines a on a.code = v.airline and a.code <> 'other' and coalesce(a.active, true)
     where v.uid = p_uid and v.viewed_at > now() - interval '30 days'
       and not exists (select 1 from own o where o.airline = v.airline)
       and not exists (select 1 from picked k where k.airline = v.airline)
  )
  select * from own union all select * from picked union all select * from seen;
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
                        from public.pv_follow_list(v_uid) l join public.pv_airlines a on a.code = l.airline
                       where l.why = 'follow'), '[]'::jsonb),
    -- 最近見た会社（フォローしていない会社・新しい順）。消すのは pv_follow_unsee
    'seen', coalesce((select jsonb_agg(jsonb_build_object('code', l.airline, 'ja', a.name_ja, 'en', a.name_en,
                                                          'page', a.cap_lo is not null) order by l.since desc)
                        from public.pv_follow_list(v_uid) l join public.pv_airlines a on a.code = l.airline
                       where l.why = 'seen'), '[]'::jsonb));
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
      select count(*) into v_n from public.pv_follow_list(v_uid) l where l.why = 'follow';
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


/* 会社ページを開いた会員が呼ぶ。最後に見た時刻を更新し、30日より前と、新しい10社より外を消す。 */
create or replace function public.pv_follow_seen(p_airline text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'login'); end if;
  if p_airline is null or not exists (select 1 from public.pv_airlines a
                     where a.code = p_airline and a.code <> 'other' and coalesce(a.active, true))
     or not exists (select 1 from public.profiles p where p.id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'bad_airline');
  end if;
  insert into public.pv_follow_view(uid, airline, viewed_at) values (v_uid, p_airline, now())
  on conflict (uid, airline) do update set viewed_at = now();
  delete from public.pv_follow_view v where v.uid = v_uid and v.viewed_at <= now() - interval '30 days';
  delete from public.pv_follow_view v
   where v.uid = v_uid
     and v.airline not in (select x.airline from public.pv_follow_view x where x.uid = v_uid order by x.viewed_at desc limit 10);
  return jsonb_build_object('ok', true);
end
$$;
revoke all on function public.pv_follow_seen(text) from public, anon;
grant execute on function public.pv_follow_seen(text) to authenticated;

/* マイページの「最近見た会社」から消す。null なら全部消す。 */
create or replace function public.pv_follow_unsee(p_airline text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'login'); end if;
  delete from public.pv_follow_view v where v.uid = v_uid and (p_airline is null or v.airline = p_airline);
  return public.pv_my_follows();
end
$$;
revoke all on function public.pv_follow_unsee(text) from public, anon;
grant execute on function public.pv_follow_unsee(text) to authenticated;


-- ── 4. 今送る相手 ───────────────────────────────────────────
--   1人1行。items ＝ 新着があった会社ごとに {code, ja, en, page, kinds:['pay','review','cond']}（★件数は返さない）。page ＝ 会社のページがある。
--   新着＝フォローを始めた時刻・前に送った分の終わり（upto）・数え始めのうち、いちばん遅い時刻より後に入ったもので、
--         ★受け取る人の国の今日の0時より前に入ったもの（今日入った分は、次の日の17時に回す）。
--   送る相手に入るのは、受け取る人の国で17時を過ぎていて、今日の分をまだ送っていない人だけ（2026-11-09）。
--   upto ＝ この1通がどこまでの新着か（受け取る人の国の今日の0時）。送れたら pv_follow_mark に渡して記録する。
--   p_now ＝ 今の時刻（検査で時計を決めるためだけにある。本番は渡さない）。
drop function if exists public.pv_follow_due(integer);
drop function if exists public.pv_follow_due(integer, timestamptz);
create or replace function public.pv_follow_due(p_limit integer default 50, p_now timestamptz default now())
returns table (
  id uuid, email text, name text, country text, airline_region text, lang text, unsub_token text,
  has_key boolean,   -- 給与の鍵が生きている（REAL PAY の金額が見られる）
  items jsonb,
  upto timestamptz   -- この1通がどこまでの新着か（受け取る人の国の今日の0時）
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with
  launch as (select coalesce((select l.at from public.pv_follow_launch l), p_now) as at),
  floor_at as (select greatest((select at from launch), p_now - interval '8 days') as at),
  -- ★新着の候補（数える物だけ・テスト用アカウントを外す）。8日より前は見ない（重くしない）
  ev as (
    /* ★給与は数えない（2026-11-12 オーナー指示「出しづらいからメールなしにして」）。
       前は pay_reports の新しい行も「新しい給与が入りました」と知らせていた。受け取るのは主に同じ会社の同僚で、
       毎月出す人は出すたびに同僚へ知らせが行っていた ＝ 出しづらい。⚠️ ここへ pay_reports を足し戻さない。 */
    select public.pv_airline_resolve(v.airline) as code, 'review'::text as kind, v.created_at as at, v.proof_hash as h,
           'review'::text as hk, v.airline as raw, v.id as rid, null::text as qid
      from public.reviews_v2 v
     where v.created_at > (select at from floor_at)
       and not exists (select 1 from public.pv_test_users t where public.pv_review_hash(t.uid, v.airline) = v.proof_hash)
    union all
    select c.airline, 'cond', c.created_at, c.proof_hash, 'cond', null, null, c.question_id
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
           coalesce(p.access_until > p_now, false) as has_key,
           -- 前に送った分の終わり（2026-11-09 より前に送った行は upto が空＝送った時刻まで送り済み）
           greatest((select at from launch), coalesce(fm.upto, fm.sent_at, '-infinity'::timestamptz)) as since_p,
           z.cut
      from public.profiles p
      left join public.pv_follow_mail fm on fm.uid = p.id
      -- 受け取る人の国の、今日の0時（cut）と17時（send_at）。壁の時計で作る＝夏時間の日もずれない
      cross join lateral (select public.pv_follow_tz(p.country) as tz) t
      cross join lateral (select (date_trunc('day', p_now at time zone t.tz)) at time zone t.tz as cut,
                                 (date_trunc('day', p_now at time zone t.tz) + interval '17 hours') at time zone t.tz as send_at) z
     where coalesce(p.email_opt_in, false)
       and p.email is not null and position('@' in p.email) > 1
       -- ★受け取る人の国で17時を過ぎてから（17時〜24時。送れなかった分は次の1時間で送り直す）
       and p_now >= z.send_at
       -- ★1日1通まで（今日の0時までの分をもう送った人は、次の日まで待つ）
       and coalesce(fm.upto, fm.sent_at, '-infinity'::timestamptz) < z.cut
       -- ★続けて3回失敗したら、その日は諦める
       and not (coalesce(fm.tries, 0) >= 3 and fm.tried_at >= z.send_at)
       -- ★確認待ちで止めた会員には送らない
       and not exists (select 1 from public.pv_proof b where b.user_id = p.id and b.state in ('required', 'submitted'))
  ),
  hits as (
    select w.id, l.airline as code, l.why, e.kind, e.at, e.rid, e.qid
      from who w
      cross join lateral public.pv_follow_list(w.id) l
      join ev e on e.code = l.airline
     where e.at > greatest(w.since_p, l.since)
       and e.at < w.cut          -- ★今日入った分は、次の日の17時に回す
       -- ★自分が出した分では知らせない（受け取る人の印を作り直して外す）
       and e.h is distinct from (case e.hk
             when 'review' then public.pv_review_hash(w.id, e.raw)
             else               public.pv_condition_hash(w.id, l.airline, null) end)
  ),
  per as (
    select g.id, g.code,
           jsonb_build_object('code', g.code, 'ja', a.name_ja, 'en', a.name_en, 'page', a.cap_lo is not null, 'why', g.why,
             'kinds', (select jsonb_agg(k order by case k when 'pay' then 1 when 'review' then 2 else 3 end)
                         from (select distinct h.kind as k from hits h where h.id = g.id and h.code = g.code) kk),
             -- ★口コミはサイトで誰にでも見せている範囲だけ（評価・職位・在籍年数・最初の80字。訳も80字）。新しい3件まで
             'reviews', (select jsonb_agg(rv.j order by rv.at desc) from (
                select h.at, jsonb_strip_nulls(jsonb_build_object(
                         'score', (select round(avg(x)::numeric, 1) from unnest(array[v.culture_score, v.salary_score, v.benefits_score,
                                     v.wlb_score, v.ops_score, v.training_score]) x where x is not null),
                         'pos_ja', ps.name_ja, 'pos_en', ps.name_en,
                         'tenure', v.tenure_bucket,
                         'orig', v.orig_lang,
                         'text', public.pv_review_fill(to_jsonb(v), '_comment', 80),
                         'tr', case when jsonb_typeof(v.translations) = 'object' then (
                                 select jsonb_object_agg(t.key, public.pv_review_fill(t.value, '', 80))
                                   from jsonb_each(v.translations) t where jsonb_typeof(t.value) = 'object') end)) as j
                  from hits h
                  join public.reviews_v2 v on v.id = h.rid
                  left join public.pv_positions ps on ps.code = v.position
                 where h.id = g.id and h.code = g.code and h.kind = 'review'
                 order by h.at desc limit 3) rv),
             -- 待遇：答えが入った質問の名前（答えそのものは書かない）。5つまで
             'conds', (select jsonb_agg(jsonb_build_object('ja', q.label_ja, 'en', q.label_en) order by q.id) from (
                select distinct h.qid from hits h where h.id = g.id and h.code = g.code and h.kind = 'cond' limit 5) cq
                join public.pv_condition_questions q on q.id = cq.qid)
           ) as item
      from (select distinct h.id, h.code, h.why from hits h) g
      join public.pv_airlines a on a.code = g.code
  )
  select w.id, w.email, w.name, w.country,
         coalesce((select a.region from public.pv_airlines a where a.code = public.pv_airline_resolve(w.company)), '') as airline_region,
         w.lang, w.unsub_token, w.has_key,
         (select jsonb_agg(pr.item order by (pr.item ->> 'why') = 'seen', pr.code) from per pr where pr.id = w.id) as items,
         w.cut as upto
    from who w
   where exists (select 1 from per pr where pr.id = w.id)
   order by w.created_at asc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
revoke all on function public.pv_follow_due(integer, timestamptz) from public, anon, authenticated;


-- ── 5. 送れた／送れなかったを記録する ────────────────────────
--   p_upto ＝ pv_follow_due が返した upto（この1通がどこまでの新着か）。
--   渡されなければ（古い Edge Function）、受け取る人の国の今日の0時を記録する。
drop function if exists public.pv_follow_mark(uuid, boolean);
create or replace function public.pv_follow_mark(p_id uuid, p_ok boolean default true, p_upto timestamptz default null)
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.pv_follow_mail as m (uid, sent_at, upto, tries, tried_at)
  select p.id,
         case when p_ok then now() end,
         case when p_ok then coalesce(p_upto, (date_trunc('day', now() at time zone public.pv_follow_tz(p.country)))
                                              at time zone public.pv_follow_tz(p.country)) end,
         case when p_ok then 0 else 1 end, now()
    from public.profiles p where p.id = p_id
  on conflict (uid) do update
     set sent_at  = case when p_ok then now() else m.sent_at end,
         upto     = case when p_ok then excluded.upto else m.upto end,
         tries    = case when p_ok then 0 else m.tries + 1 end,
         tried_at = now()
  returning tries;
$$;
revoke all on function public.pv_follow_mark(uuid, boolean, timestamptz) from public, anon, authenticated;


-- ── service_role（Edge Function）に渡す。手元の検査の DB には service_role が無いので、在るときだけ ──
do $grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on table public.pv_follow to service_role';
    execute 'grant select, insert, update on table public.pv_follow_mail to service_role';
    execute 'grant execute on function public.pv_follow_due(integer, timestamptz) to service_role';
    execute 'grant execute on function public.pv_follow_mark(uuid, boolean, timestamptz) to service_role';
  end if;
end
$grant$;

-- ── 6. 1時間おきの時計 ──────────────────────────────────────
--   ★週まとめの予約（pv-weekly-digest）の中身を写して、叩く先だけ follow-notify に替える（同じ合言葉）。
--   ★毎時0分（2026-11-09 に7分から）。国ごとに17時が来る時刻が違うので1時間おきのまま叩き、送るかどうかは pv_follow_due が決める。
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
  perform cron.schedule('pv-follow-notify', '0 * * * *',
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
             and not has_function_privilege('anon', 'public.pv_follow_seen(text)', 'execute')
             and has_function_privilege('authenticated', 'public.pv_follow_seen(text)', 'execute')
            then '✅ フォローの口は会員だけが呼べる（未ログインは呼べない）' else '❌ フォローの口の権限がおかしい' end
union all
select case when not has_function_privilege('authenticated', 'public.pv_follow_due(integer, timestamptz)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_follow_mark(uuid, boolean, timestamptz)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_follow_list(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.pv_follow_due(integer, timestamptz)', 'execute')
            then '✅ 送る相手と記録は会員からは呼べない' else '❌ 送る相手が会員から呼べてしまう' end
union all
select case when to_regprocedure('public.pv_follow_due(integer)') is null
             and to_regprocedure('public.pv_follow_mark(uuid, boolean)') is null
             and exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'pv_follow_mail' and column_name = 'upto')
            then '✅ 翌日の17時（受け取る人の国）に送る形になった（すぐ送る古い形は残っていない）'
            else '❌ すぐ送る古い形が残っている' end
union all
select case when not has_table_privilege('authenticated', 'public.pv_follow', 'select')
             and not has_table_privilege('authenticated', 'public.pv_follow_mail', 'select')
             and not has_table_privilege('anon', 'public.pv_follow', 'select')
             and not has_table_privilege('authenticated', 'public.pv_follow_view', 'select')
            then '✅ 表は会員から直接読めない（ほかの人のフォローは見えない）' else '❌ 表が会員から読める' end
union all
select case when (select prosrc from pg_proc where oid = 'public.pv_follow_due(integer, timestamptz)'::regprocedure)
                 not like '%from public.pay_reports%'
            then '✅ 給与の提出では知らせない（新着に数えるのは口コミと待遇の答えだけ）'
            else '❌ 給与の提出でも知らせが飛ぶ古い形が残っている' end
union all
select case when not exists (select 1 from pg_extension where extname = 'pg_cron')
            then 'ℹ️ 時計が無い場所（手元の検査）'
            else '✅ 時計の予約を入れた（毎時0分・名前 pv-follow-notify）' end
union all
select 'ℹ️ いま時計が動いたら知らせを送る人数（受け取る人の国で17時を過ぎた人だけ）：' || count(*)::text from public.pv_follow_due(200);
