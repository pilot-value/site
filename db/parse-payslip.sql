-- ════════════════════════════════════════════════════════════════
-- parse-payslip の回数制限
--
-- Edge Function は複数インスタンスで動くのでメモリ上のカウンタは使えない。
-- 数える場所は DB ただ1つ。
--
-- ★ここに個人を特定できるものを置かない。
--   subject は Edge Function 側で HMAC(値, PV_IP_SALT) にしたもの。
--   IP も user_id も平文では入らない（会社ドメイン認証で決めた方針と同じ）。
--   HMAC は逆算できないので、この表を全部見ても誰が何回使ったかは分からない。
--
-- 実行: Supabase → SQL Editor にこのファイルの中身を貼って RUN
-- ════════════════════════════════════════════════════════════════

create table if not exists public.pv_parse_quota (
  subject    text        not null,          -- 'u:<hmac>' or 'i:<hmac>'
  day        date        not null,
  n          int         not null default 0,
  updated_at timestamptz not null default now(),
  primary key (subject, day)
);

-- RLS は全面拒否。触るのは service_role の Edge Function だけ。
alter table public.pv_parse_quota enable row level security;
revoke all on public.pv_parse_quota from anon, authenticated;

-- ── 1回取る。取れたら true、上限に達していたら false ──────────
-- security definer なので RLS を通らずに数えられる。
create or replace function public.pv_parse_quota_take(p_subject text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if p_subject is null or length(p_subject) < 8 then
    return false;                                   -- 呼び方が変なら通さない
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    return false;
  end if;

  -- ★数えてから判定するのではなく、入れながら判定する。
  --   同時に2枚投げられたときに両方通るのを防ぐ（upsert が直列化する）。
  insert into public.pv_parse_quota as q (subject, day, n)
  values (p_subject, current_date, 1)
  on conflict (subject, day) do update
    set n = q.n + 1, updated_at = now()
  returning n into v_n;

  return v_n <= p_limit;
end;
$$;

revoke all on function public.pv_parse_quota_take(text, int) from public, anon, authenticated;

-- ── 掃除（30日より古い行は要らない）──────────────────────────
-- pg_cron を使わない方針なので、関数だけ置いて必要なときに呼ぶ。
create or replace function public.pv_parse_quota_sweep()
returns int
language sql
security definer
set search_path = public
as $$
  with d as (delete from public.pv_parse_quota where day < current_date - 30 returning 1)
  select count(*)::int from d;
$$;

revoke all on function public.pv_parse_quota_sweep() from public, anon, authenticated;

-- ── 検算（コメントアウトしない。ここまで含めて1回で貼る）──────
-- 未ログイン相当（上限1）で 1回目 true / 2回目 false になることを確かめる。
--
-- ★成功したときは何も表示されない（Success. No rows returned）のが正解。
--   失敗したときだけ赤いエラーが出て、SQL Editor はスクリプト全体を
--   1トランザクションで流すので **上の create table ごと巻き戻る**。
--   ＝「回数制限が効かない状態のテーブルだけが出来ている」が起こらない。
do $$
declare a boolean; b boolean;
begin
  delete from public.pv_parse_quota where subject = 'i:selftest0000';
  a := public.pv_parse_quota_take('i:selftest0000', 1);
  b := public.pv_parse_quota_take('i:selftest0000', 1);
  delete from public.pv_parse_quota where subject = 'i:selftest0000';   -- 痕跡を残さない
  if not (a and not b) then
    raise exception '検算NG: take1=% take2=% （期待 true / false）。回数制限が効いていないので中止しました。', a, b;
  end if;
end $$;
