-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/hotel-suggest.sql
--
-- ホテルの名前の候補（Google の Places API (New) の Autocomplete）を、月に 10,000 回で止める数え札。
-- 2026-10-18 オーナー「V7 ホテル名の候補 google で作る 月10000回？超えたらストップ」（P12.61・P12.62）。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: ほかのファイルに頼らない（表も関数もここだけで完結する）。
--    ただし Edge Function（supabase/functions/hotel-suggest）より**先に**流す。
--    逆にすると、関数が数え札を呼べずに「数えられない ＝ Google へは1回も送らない」になる
--    （安全側に止まるだけで、お金はかからない）。
-- 冪等（何度流しても安全）。流し直しても、数えた回数は消えない（表は if not exists）。
--
-- ── この設計が守っている約束 ────────────────────────────────
--  1. 天井は **10,000 回** で、ここ（pv_hotel_suggest_cap と表の制約）の2か所にしか書かない。secret でも引数でも上げられない。
--     数えるのは「Google へ送った要求」そのもの（全員・全部の画面の合計）。
--  2. **送る前に**1回ぶんを取る。取れなかったら Google へは送らない（Edge Function の側の約束）。
--     取った1回は返さない ── Google が失敗した・時間切れになった要求も1回に数える（減らす文はこのファイルに1つも無い）。
--  3. 月の区切りは2つ持ち、**どちらか一方でも 10,000 なら止める**（P12.62）。
--       utc … UTC の暦の月（日本時間では毎月1日の 9:00 に切り替わる）
--       la  … America/Los_Angeles の暦の月（日本時間では毎月1日の 16:00（夏時間）／17:00（冬時間））
--     Google の無料枠は「毎月1日の太平洋時間の0時」に戻る（Google の公式の料金のページ・2026-10-16 版）。
--     UTC の月も持つのは、どちらの区切りで数えられても 10,000 を越えないようにするため。
--     止まったあとに候補が戻るのは、2つの札の両方に空きができたとき（ふつうは1日の 16:00／17:00 日本時間）。
--  4. 2つの札は**1回の呼び出しの中で、決まった順（la → utc）に行を押さえてから**見て、両方に空きがあるときだけ両方を1つ進める。
--     同時に何本来ても、片方だけ進む・数え漏れる、は起こらない。表の制約（n は 0〜10,000）が最後の網
--     （どんな道で書き込んでも 10,001 にはならない）。
--  5. 呼べるのは Edge Function（service_role）だけ。会員・未ログインからは、表も関数も見えない。
--     時刻を選べる口（pv_hotel_suggest_take_at・pv_hotel_suggest_room_at）は service_role からも呼べない（ほかの月の札を使わせない）。
--  7. 「いま空きがあるか」だけを見る口（pv_hotel_suggest_room）がある。札は1つも進めない・回数は返さない（真か偽だけ）。
--     画面は、打った字を送る前に Edge Function の ping でこれを聞き、空きが無い（止まっている）・答えが無い・読めない ──
--     どれのときも、打った字を1文字も送らない（2026-10-19 P12.74：止まっているあいだ、打った字はこのサイトの外へも中へも出ない）。
--  6. ここに置くのは、札の名前・月・回数だけ。打たれた字・候補の名前・誰が打ったかは置かない。
--
-- ★ 今どれだけ使ったかは SQL Editor で:  select * from public.pv_hotel_suggest_usage();
--    （日本時間で、その月の札がいつ始まったかも出る）
-- ════════════════════════════════════════════════════════════════

-- ── 1. 数え札（札 × 月 ＝ 1行）────────────────────────────────
create table if not exists public.pv_hotel_suggest_quota (
  bucket     text        not null,
  month      date        not null,
  n          integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (bucket, month),
  constraint pv_hotel_suggest_quota_bucket_ck check (bucket in ('utc', 'la')),
  constraint pv_hotel_suggest_quota_month_ck  check (month = date_trunc('month', month)::date),
  constraint pv_hotel_suggest_quota_n_ck      check (n between 0 and 10000)
);
alter table public.pv_hotel_suggest_quota enable row level security;
revoke all on table public.pv_hotel_suggest_quota from public, anon, authenticated;

-- ── 1b. 天井（ここと表の制約の2か所だけ。取る口も、空きを見る口も、これを読む）──────
create or replace function public.pv_hotel_suggest_cap()
returns integer
language sql
immutable
set search_path = public
as $$
  select 10000;   -- オーナーの天井（2026-10-18）。上げない
$$;

-- ── 2. 1回ぶんを取る（時刻を渡す形。検算と下の 3 だけが呼ぶ）────────
--   返り値: {"ok":true} … 取れた（両方の札が1つ進んだ）
--           {"ok":false,"cap":"month"} … どちらかの札が 10,000（何も進めない）
--           {"ok":false,"cap":"bad"}   … 時刻が無い
create or replace function public.pv_hotel_suggest_take_at(p_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_cap constant integer := public.pv_hotel_suggest_cap();
  v_la  date;
  v_utc date;
  n_la  integer;
  n_utc integer;
begin
  if p_at is null then
    return jsonb_build_object('ok', false, 'cap', 'bad');
  end if;
  v_la  := date_trunc('month', p_at at time zone 'America/Los_Angeles')::date;
  v_utc := date_trunc('month', p_at at time zone 'UTC')::date;

  insert into public.pv_hotel_suggest_quota (bucket, month)
  values ('la', v_la), ('utc', v_utc)
  on conflict (bucket, month) do nothing;

  -- いつも la → utc の順に押さえる（2本が逆の順で待ち合って止まることが無い）
  select q.n into n_la  from public.pv_hotel_suggest_quota q where q.bucket = 'la'  and q.month = v_la  for update;
  select q.n into n_utc from public.pv_hotel_suggest_quota q where q.bucket = 'utc' and q.month = v_utc for update;
  if n_la is null or n_utc is null then
    return jsonb_build_object('ok', false, 'cap', 'bad');
  end if;
  if n_la >= c_cap or n_utc >= c_cap then
    return jsonb_build_object('ok', false, 'cap', 'month');
  end if;

  update public.pv_hotel_suggest_quota set n = n + 1, updated_at = now() where bucket = 'la'  and month = v_la;
  update public.pv_hotel_suggest_quota set n = n + 1, updated_at = now() where bucket = 'utc' and month = v_utc;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 3. Edge Function が呼ぶ口（いまの時刻で 2 を呼ぶだけ）──────────────
create or replace function public.pv_hotel_suggest_take()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.pv_hotel_suggest_take_at(now());
$$;

-- ── 3b. 空きがあるか（時刻を渡す形）：2つの札のどちらも天井に届いていなければ真。札は進めない・行も作らない ──
create or replace function public.pv_hotel_suggest_room_at(p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_at is not null and not exists (
    select 1
      from public.pv_hotel_suggest_quota q
     where q.n >= public.pv_hotel_suggest_cap()
       and (   (q.bucket = 'la'  and q.month = date_trunc('month', p_at at time zone 'America/Los_Angeles')::date)
            or (q.bucket = 'utc' and q.month = date_trunc('month', p_at at time zone 'UTC')::date)));
$$;

-- ── 3c. Edge Function の ping が呼ぶ口（いまの時刻で 3b を呼ぶだけ。真か偽だけを返す）──
create or replace function public.pv_hotel_suggest_room()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.pv_hotel_suggest_room_at(now());
$$;

-- ── 4. オーナー用：いまの回数（SQL Editor で読む。月の札が始まった時刻を日本時間でも出す）──
create or replace function public.pv_hotel_suggest_usage()
returns table (bucket text, month date, n integer, starts_jst timestamp, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select q.bucket, q.month, q.n,
         ((q.month::timestamp) at time zone (case q.bucket when 'la' then 'America/Los_Angeles' else 'UTC' end))
           at time zone 'Asia/Tokyo',
         q.updated_at
    from public.pv_hotel_suggest_quota q
   order by q.month desc, q.bucket
   limit 24;
$$;

revoke all on function public.pv_hotel_suggest_take_at(timestamptz) from public, anon, authenticated;
revoke all on function public.pv_hotel_suggest_take()              from public, anon, authenticated;
revoke all on function public.pv_hotel_suggest_usage()             from public, anon, authenticated;
revoke all on function public.pv_hotel_suggest_cap()               from public, anon, authenticated;
revoke all on function public.pv_hotel_suggest_room_at(timestamptz) from public, anon, authenticated;
revoke all on function public.pv_hotel_suggest_room()              from public, anon, authenticated;
-- Supabase には service_role が在る：呼べるのは 3 と 3c だけ（時刻を選べる 2・3b と、天井の 1b と、4 は呼べない）
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on function public.pv_hotel_suggest_take_at(timestamptz) from service_role';
    execute 'revoke all on function public.pv_hotel_suggest_room_at(timestamptz) from service_role';
    execute 'revoke all on function public.pv_hotel_suggest_cap() from service_role';
    execute 'revoke all on function public.pv_hotel_suggest_usage() from service_role';
    execute 'revoke all on table public.pv_hotel_suggest_quota from service_role';
    execute 'grant execute on function public.pv_hotel_suggest_take() to service_role';
    execute 'grant execute on function public.pv_hotel_suggest_room() to service_role';
  end if;
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- 検算（コメントアウトしない。ここまで含めて1回で貼る）
--   本物の月の札には触らない（2099年1月の札で見て、最後に巻き戻す）。
--   ★成功したときは何も表示されない（Success. No rows returned）のが正解。
--     失敗したときだけ赤いエラーが出て、上の create ごと巻き戻る。
-- ════════════════════════════════════════════════════════════════
do $$
declare
  r1 jsonb;
  r2 jsonb;
  e1 boolean;
  e2 boolean;
begin
  begin
    insert into public.pv_hotel_suggest_quota (bucket, month, n)
    values ('la', date '2099-01-01', 9999), ('utc', date '2099-01-01', 9999)
    on conflict (bucket, month) do update set n = 9999;
    e1 := public.pv_hotel_suggest_room_at(timestamptz '2099-01-15 12:00:00+00');
    r1 := public.pv_hotel_suggest_take_at(timestamptz '2099-01-15 12:00:00+00');
    e2 := public.pv_hotel_suggest_room_at(timestamptz '2099-01-15 12:00:00+00');
    r2 := public.pv_hotel_suggest_take_at(timestamptz '2099-01-15 12:00:00+00');
    if r1 is distinct from '{"ok": true}'::jsonb or r2 is distinct from '{"ok": false, "cap": "month"}'::jsonb
       or e1 is distinct from true or e2 is distinct from false then
      raise exception 'pv_hotel_suggest: 検算が合わない（10,000 回目 % ／ 10,001 回目 % ／ 空き % → %）', r1, r2, e1, e2;
    end if;
    raise exception 'pv_hotel_suggest_selfcheck_ok';
  exception when raise_exception then
    if sqlerrm <> 'pv_hotel_suggest_selfcheck_ok' then
      raise;
    end if;
  end;
end;
$$;
