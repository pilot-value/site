-- ════════════════════════════════════════════════════════════════
-- 明細の読み取りに失敗したら、運営（info@）にすぐ知らせる（2026-11-07）
--
-- それまで、読み取りが成功したか失敗したかは DB のどこにも残っていなかった
-- （GA のイベントと関数のログだけ）。30日続けて失敗していても、仕組みとして気づけなかった。
-- オーナー指示「失敗したらすぐにメール・原因も」。
--
-- ここで作るもの：
--   ・表 pv_parse_outcome … 1時間ごとの箱に、種類ごとの回数だけ。
--       ok        成功
--       ng        こちら側の失敗（鍵・混雑・時間切れ・答えの形が崩れた・途中で切れた など）
--       user_ng   本人側の失敗（「明細ではない」「読むのを断られた」＝暗い写真・別の書類）
--       client_ng ブラウザの中で止まった失敗（写真が開けない・通信が切れた・入力欄に入れる所で落ちた）
--     ★人も画像も金額も持たない（持つ欄が無い）。誰が読んだかも分からない。
--   ・pv_parse_outcome_add(p_kind) … parse-payslip が1回ごとに1つ足し、知らせに要る数を返す：
--       {ok, ng, user_ng, client_ng}（直近24時間の合計）・today（今日＝UTC の日付の失敗の数）・stalled
--     メールを送るかは関数の側（失敗ごとに1通・1日30通まで）。
--   ・pv_parse_outcome_stalled(ok, ng, user_ng, client_ng) … 「24時間 成功0」の印（件名に付ける）：
--       成功が0回 かつ（こちら側の失敗が3回以上 または 失敗が合わせて5回以上）
--     ★決まりはここの1か所だけ（関数の側に写さない）。
--
-- ★触れるのは service_role の Edge Function だけ。会員・未ログインからは読めない・呼べない。
-- ★90日より古い箱は、足すたびに消える（表は最大で約2,200行）。
--
-- 貼る順：このファイル → parse-payslip の Deploy。
--   逆でも壊れない（数えられなくても、関数は失敗ごとに知らせる。読み取りの返事も今までどおり）。
-- 中を見る：select * from public.pv_parse_outcome order by hr desc limit 48;
-- ════════════════════════════════════════════════════════════════

create table if not exists public.pv_parse_outcome (
  hr        timestamptz primary key,          -- 1時間ごとの箱（date_trunc('hour', now())）
  ok        int not null default 0,
  ng        int not null default 0,
  user_ng   int not null default 0,
  client_ng int not null default 0
);
alter table public.pv_parse_outcome add column if not exists client_ng int not null default 0;
alter table public.pv_parse_outcome enable row level security;
revoke all on table public.pv_parse_outcome from public, anon, authenticated;

drop function if exists public.pv_parse_outcome_stalled(int, int, int);
create or replace function public.pv_parse_outcome_stalled(p_ok int, p_ng int, p_user_ng int, p_client_ng int)
returns boolean
language sql
immutable
as $fn$
  select coalesce(p_ok, 0) = 0
     and (coalesce(p_ng, 0) >= 3
          or coalesce(p_ng, 0) + coalesce(p_user_ng, 0) + coalesce(p_client_ng, 0) >= 5);
$fn$;
revoke all on function public.pv_parse_outcome_stalled(int, int, int, int) from public, anon, authenticated;

/* 1回ぶん足して、知らせに要る数を返す。p_kind は 'ok' / 'ng' / 'user_ng' / 'client_ng' のどれか。
   知らない種類は何も足さず null を返す。 */
drop function if exists public.pv_parse_outcome_add(text);
create or replace function public.pv_parse_outcome_add(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ok int; v_ng int; v_user int; v_client int; v_today int;
begin
  if p_kind is null or p_kind not in ('ok', 'ng', 'user_ng', 'client_ng') then return null; end if;
  insert into public.pv_parse_outcome as o (hr, ok, ng, user_ng, client_ng)
  values (date_trunc('hour', now()),
          (p_kind = 'ok')::int, (p_kind = 'ng')::int, (p_kind = 'user_ng')::int, (p_kind = 'client_ng')::int)
  on conflict (hr) do update
     set ok = o.ok + excluded.ok, ng = o.ng + excluded.ng,
         user_ng = o.user_ng + excluded.user_ng, client_ng = o.client_ng + excluded.client_ng;
  delete from public.pv_parse_outcome where hr < now() - interval '90 days';
  -- 直近24時間＝いまの箱を含む24個
  select coalesce(sum(o.ok), 0), coalesce(sum(o.ng), 0), coalesce(sum(o.user_ng), 0), coalesce(sum(o.client_ng), 0)
    into v_ok, v_ng, v_user, v_client
    from public.pv_parse_outcome o
   where o.hr >= date_trunc('hour', now()) - interval '23 hours';
  -- 今日（UTC の日付＝メールの1日の数え方と同じ）の失敗の数
  select coalesce(sum(o.ng + o.user_ng + o.client_ng), 0) into v_today
    from public.pv_parse_outcome o
   where o.hr >= date_trunc('day', now());
  return jsonb_build_object('ok', v_ok, 'ng', v_ng, 'user_ng', v_user, 'client_ng', v_client,
                            'today', v_today,
                            'stalled', public.pv_parse_outcome_stalled(v_ok, v_ng, v_user, v_client));
end
$fn$;
revoke all on function public.pv_parse_outcome_add(text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- 検算（貼ったあと、この表が全部 ✅ なら OK）。表には何も書かない。
-- ════════════════════════════════════════════════════════════════
select '1 表がある' as "確認",
       case when to_regclass('public.pv_parse_outcome') is not null then '✅' else '❌' end as "結果"
union all
select '2 会員・未ログインは表を読めない',
       case when not has_table_privilege('anon', 'public.pv_parse_outcome', 'select')
             and not has_table_privilege('authenticated', 'public.pv_parse_outcome', 'select')
            then '✅' else '❌' end
union all
select '3 会員・未ログインは足す関数を呼べない',
       case when not has_function_privilege('anon', 'public.pv_parse_outcome_add(text)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_parse_outcome_add(text)', 'execute')
            then '✅' else '❌' end
union all
select '4 失敗3回・成功0 → 24時間 成功0 の印',
       case when public.pv_parse_outcome_stalled(0, 3, 0, 0) then '✅' else '❌' end
union all
select '5 成功が1回でもあれば印を付けない',
       case when not public.pv_parse_outcome_stalled(1, 9, 9, 9) then '✅' else '❌' end
union all
select '6 こちら側の失敗2回だけでは印を付けない',
       case when not public.pv_parse_outcome_stalled(0, 2, 0, 0) then '✅' else '❌' end
union all
select '7 本人側・ブラウザ側を合わせて5回で印（4回では付けない）',
       case when public.pv_parse_outcome_stalled(0, 0, 3, 2) and not public.pv_parse_outcome_stalled(0, 0, 2, 2)
            then '✅' else '❌' end;
