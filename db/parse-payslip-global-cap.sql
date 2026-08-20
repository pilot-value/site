-- ════════════════════════════════════════════════════════════════
-- parse-payslip に「全体の天井」を付ける
--
-- 今の上限は 未ログイン 1回/日/IP・ログイン 10回/日/ユーザー だけ。
-- どちらも「1人あたり」なので、IP を変えれば人数はいくらでも増やせる。
-- ＝ Anthropic の請求に天井が無い。リポジトリが PUBLIC で anon キーも
--    公開されているので、これは理屈上の話ではなく今そうなっている。
--
-- ここで足すのは2本：
--   ・全体で1日 N 回まで（既定 200回 ≒ $4/日）
--   ・全体で1ヶ月 M 回まで（既定 2000回 ≒ $40/月。0 なら見ない）
--
-- ★順番が肝。**先に本人ぶんを取ってから、全体を取る。**
--   逆にすると、自分の上限に達した人が叩き続けるだけで全体の枠が減り、
--   1つのIPから全員を締め出せてしまう（お金はかからないが、機能は死ぬ）。
--   本人ぶんで弾かれた呼び出しは、全体の枠を1つも使わない。
--
-- ★既存の pv_parse_quota_take(text,int) は消さない。
--   SQL を先に流しても、まだ古い Edge Function が動いたままで壊れない。
--   **必ず SQL → Edge Function の順で。逆にすると関数が無くて全部 429 になる。**
--
-- 実行: Supabase → SQL Editor にこのファイルの中身を丸ごと貼って RUN
--       （最後の検算まで含めて1回で貼る。失敗したら全部巻き戻る）
-- ════════════════════════════════════════════════════════════════

-- ── 1回取る。取れたかどうかと、どの天井で止まったかを返す ──────
--   返り値 jsonb:
--     {"ok":true, "n":3, "g":57}                     … 通った
--     {"ok":false,"cap":"subject"}                   … 本人の上限
--     {"ok":false,"cap":"global","trip":true}        … 全体（日）の上限
--     {"ok":false,"cap":"month", "trip":false}       … 全体（月）の上限
--     {"ok":false,"cap":"bad"}                       … 呼び方が変
--   trip は「この呼び出しが天井を越えた最初の1回」。通知を1日1通にするため。
create or replace function public.pv_parse_quota_take_v2(
  p_subject      text,
  p_limit        int,
  p_global_limit int,
  p_month_limit  int  default 0,
  p_bucket       text default 'global'      -- 検算のときだけ別名にする
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n   int;
  v_g   int;
  v_m   int;
  v_day date := current_date;
  v_mon date := date_trunc('month', current_date)::date;
begin
  if p_subject is null or length(p_subject) < 8 then
    return jsonb_build_object('ok', false, 'cap', 'bad');
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    return jsonb_build_object('ok', false, 'cap', 'bad');
  end if;
  if p_global_limit is null or p_global_limit < 1 or p_global_limit > 1000000 then
    return jsonb_build_object('ok', false, 'cap', 'bad');
  end if;
  if p_bucket is null or length(p_bucket) < 4 then
    return jsonb_build_object('ok', false, 'cap', 'bad');
  end if;

  -- ── ① 本人ぶん（ここを先に取る）────────────────────────────
  insert into public.pv_parse_quota as q (subject, day, n)
  values (p_subject, v_day, 1)
  on conflict (subject, day) do update
    set n = q.n + 1, updated_at = now()
  returning n into v_n;

  if v_n > p_limit then
    -- 本人の上限。全体の枠は1つも使わない（＝ここが締め出しを防いでいる）
    return jsonb_build_object('ok', false, 'cap', 'subject');
  end if;

  -- ── ② 全体（日）────────────────────────────────────────────
  insert into public.pv_parse_quota as q (subject, day, n)
  values (p_bucket, v_day, 1)
  on conflict (subject, day) do update
    set n = q.n + 1, updated_at = now()
  returning n into v_g;

  if v_g > p_global_limit then
    -- 読み取りは走らないので、本人ぶんは返す
    update public.pv_parse_quota
       set n = greatest(n - 1, 0), updated_at = now()
     where subject = p_subject and day = v_day;
    return jsonb_build_object('ok', false, 'cap', 'global',
                              'trip', v_g = p_global_limit + 1);
  end if;

  -- ── ③ 全体（月）※ 0 なら見ない ────────────────────────────
  if p_month_limit is not null and p_month_limit > 0 then
    insert into public.pv_parse_quota as q (subject, day, n)
    values (p_bucket || ':m', v_mon, 1)
    on conflict (subject, day) do update
      set n = q.n + 1, updated_at = now()
    returning n into v_m;

    if v_m > p_month_limit then
      update public.pv_parse_quota
         set n = greatest(n - 1, 0), updated_at = now()
       where subject = p_subject and day = v_day;
      update public.pv_parse_quota
         set n = greatest(n - 1, 0), updated_at = now()
       where subject = p_bucket and day = v_day;
      return jsonb_build_object('ok', false, 'cap', 'month',
                                'trip', v_m = p_month_limit + 1);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'n', v_n, 'g', v_g);
end;
$$;

revoke all on function public.pv_parse_quota_take_v2(text, int, int, int, text)
  from public, anon, authenticated;

-- ── 今どれだけ使ったかを見る（オーナー用）────────────────────
create or replace function public.pv_parse_usage()
returns table (bucket text, day date, n int)
language sql
security definer
set search_path = public
as $$
  select subject, day, n
    from public.pv_parse_quota
   where subject in ('global', 'global:m')
   order by day desc
   limit 40;
$$;

revoke all on function public.pv_parse_usage() from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- 検算（コメントアウトしない。ここまで含めて1回で貼る）
--
-- ★成功したときは何も表示されない（Success. No rows returned）のが正解。
--   失敗したときだけ赤いエラーが出て、SQL Editor はスクリプト全体を
--   1トランザクションで流すので **上の create function ごと巻き戻る**。
--   ＝「天井が効かない関数だけが出来ている」が起こらない。
--
-- ★本物の 'global' は触らない。検算は 'gselftest' という別バケツでやる。
-- ════════════════════════════════════════════════════════════════
do $$
declare
  r1 jsonb; r2 jsonb; r3 jsonb; r4 jsonb; r5 jsonb;
  v_g int; v_own int;
begin
  delete from public.pv_parse_quota
   where subject in ('i:selftestA00', 'i:selftestB00', 'i:selftestC00',
                     'gselftest', 'gselftest:m');

  -- 検査1 本人の上限が効く（上限2で 3回目が止まる）
  r1 := public.pv_parse_quota_take_v2('i:selftestA00', 2, 100, 0, 'gselftest');
  r2 := public.pv_parse_quota_take_v2('i:selftestA00', 2, 100, 0, 'gselftest');
  r3 := public.pv_parse_quota_take_v2('i:selftestA00', 2, 100, 0, 'gselftest');
  if not ((r1->>'ok')::boolean and (r2->>'ok')::boolean) then
    raise exception '検算NG-1: 本人の枠内なのに通らない r1=% r2=%', r1, r2;
  end if;
  if (r3->>'ok')::boolean or r3->>'cap' <> 'subject' then
    raise exception '検算NG-2: 本人の上限で止まらない r3=%', r3;
  end if;

  -- 検査3 ★本人の上限で弾かれた呼び出しが、全体の枠を使っていないこと
  --        （ここが「1つのIPで全員を締め出せる」を塞いでいる証明）
  select n into v_g from public.pv_parse_quota where subject = 'gselftest' and day = current_date;
  if v_g is distinct from 2 then
    raise exception '検算NG-3: 全体の枠が % （期待 2）。弾かれた呼び出しが全体を減らしている', v_g;
  end if;

  -- 検査4 全体（日）の上限が効く。別人でも止まる
  r4 := public.pv_parse_quota_take_v2('i:selftestB00', 10, 3, 0, 'gselftest');  -- 全体3本目 → 通る
  r5 := public.pv_parse_quota_take_v2('i:selftestC00', 10, 3, 0, 'gselftest');  -- 全体4本目 → 止まる
  if not (r4->>'ok')::boolean then
    raise exception '検算NG-4: 全体の枠内なのに通らない r4=%', r4;
  end if;
  if (r5->>'ok')::boolean or r5->>'cap' <> 'global' then
    raise exception '検算NG-5: 全体の上限で止まらない r5=%', r5;
  end if;
  if not (r5->>'trip')::boolean then
    raise exception '検算NG-6: 天井を越えた最初の1回に trip が立たない r5=%', r5;
  end if;

  -- 検査7 全体で弾かれた人の本人ぶんは返っている（1回ぶん損させない）
  select n into v_own from public.pv_parse_quota where subject = 'i:selftestC00' and day = current_date;
  if v_own is distinct from 0 then
    raise exception '検算NG-7: 全体で弾かれたのに本人の回数が % 減ったまま', v_own;
  end if;

  -- 検査8 2回目以降は trip が立たない（通知が1日1通で済む）
  r5 := public.pv_parse_quota_take_v2('i:selftestB00', 10, 3, 0, 'gselftest');
  if (r5->>'ok')::boolean or (r5->>'trip')::boolean then
    raise exception '検算NG-8: 止まったあとにも trip が立つ r5=%', r5;
  end if;

  -- 検査9 月の上限が効く
  delete from public.pv_parse_quota
   where subject in ('i:selftestA00', 'i:selftestB00', 'gselftest', 'gselftest:m');
  r1 := public.pv_parse_quota_take_v2('i:selftestA00', 10, 100, 1, 'gselftest');
  r2 := public.pv_parse_quota_take_v2('i:selftestB00', 10, 100, 1, 'gselftest');
  if not (r1->>'ok')::boolean then
    raise exception '検算NG-9: 月の枠内なのに通らない r1=%', r1;
  end if;
  if (r2->>'ok')::boolean or r2->>'cap' <> 'month' then
    raise exception '検算NG-10: 月の上限で止まらない r2=%', r2;
  end if;

  -- 検査11 呼び方が変なら通さない
  if (public.pv_parse_quota_take_v2('short', 10, 100, 0, 'gselftest')->>'ok')::boolean then
    raise exception '検算NG-11: subject が短いのに通った';
  end if;
  if (public.pv_parse_quota_take_v2('i:selftestA00', 10, 0, 0, 'gselftest')->>'ok')::boolean then
    raise exception '検算NG-12: 全体の上限が 0 なのに通った';
  end if;

  -- 痕跡を残さない
  delete from public.pv_parse_quota
   where subject in ('i:selftestA00', 'i:selftestB00', 'i:selftestC00',
                     'gselftest', 'gselftest:m');
end $$;
