-- ════════════════════════════════════════════════════════════════
-- 明細の Verified（2026-11-19 オーナー決定）── 一度きりの引換券
--
-- REAL PAY の「出典」の欄に出る ✓ Verified を、明細を読んで出した行にだけ付ける。
-- 付く意味は「その月の総支給が、本人が出した給与明細の印字と一致した」まで。
-- ★本物の明細だとは保証しない（上手に作った偽物は見分けられない）。画面にもそう書かない。
--
-- 流れ：
--   1. parse-payslip（Edge Function）が明細を読み、次の2つを満たしたときだけ
--      pv_payslip_ticket_put を呼んで引換券を1枚作る（判定は index.ts の ticketEligible）。
--        ・AI が「パイロットの給与明細」と答え、乗務時間か乗務手当が載っている
--        ・明細の中の計算が合う（支給の合計＝印字の総支給・総支給−控除＝手取り）
--   2. 券はブラウザの隠し欄（f-psticket）に入り、提出の payload で payslip_ticket として届く。
--   3. submit_pay_report（db/pay-reports.sql）が pv_payslip_redeem で照合する。
--      年・月・通貨・総支給が1文字も違わなければ verify_level = 1。
--      読んだあとに総支給を書き換えたら付かない。
--   4. 同じ明細（下の指紋）で、ほかの人・ほかの月が先に付いていたら付けない（submit_pay_report 側）。
--   5. 運営が手で外せる（pv_payslip_unverify。SQL Editor から）。
--
-- ★この表に人は入らない。uid も行の id も持たない（「誰がどの行を出したか」を DB に残さない、は今までどおり）。
--   券は sha256 でだけ持つ（生の券は parse-payslip の答えとブラウザにしか無い）。
-- ★使った券はその場で消す。使われなかった券は7日で消える（次に券を作るときに掃く）。
--
-- 貼る順：db/pay-reports.sql（verify_fp の列）→ このファイル。
--   逆でも壊れない（submit_pay_report は照合の関数が無ければ呼ばない＝誰にも付かないだけ）。
-- 実行: Supabase → SQL Editor にこのファイルの中身を貼って RUN（末尾の検算5行が ✅）
-- ════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'pay_reports'
                    and column_name = 'verify_fp') then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports.verify_fp が無い）';
  end if;
end $$;

create table if not exists public.pv_payslip_tickets (
  token_sha    text        primary key,          -- 券の sha256（生の券は持たない）
  period_year  int         not null,
  period_month int         not null check (period_month between 1 and 12),
  currency     text        not null,
  gross        numeric     not null check (gross > 0),   -- 印字の総支給（ブラウザと同じく四捨五入した額）
  fp           text        not null,             -- 同じ明細を見分ける指紋（下の pv_payslip_fp）
  created_at   timestamptz not null default now()
);

-- RLS は全面拒否。触るのは下の関数だけ。
alter table public.pv_payslip_tickets enable row level security;
revoke all on public.pv_payslip_tickets from public, anon, authenticated;

-- ── 指紋 ──────────────────────────────────────────────────────
-- 年・月・通貨・総支給・手取り・控除・累計課税の並び。手取り・控除・累計は人ごとに違う
-- （税・扶養・住民税・在籍）ので、同じ給与表の2人でもまず重ならない。
-- ★読み取りの小さな揺れで別物にならないよう、金額は整数に丸める。読めなかった値は空のまま並べる。
create or replace function public.pv_payslip_fp(
  p_year int, p_month int, p_cur text, p_gross numeric,
  p_net numeric, p_deduct numeric, p_ytd numeric)
returns text
language sql
immutable
set search_path = public, extensions
as $fn$
  select encode(extensions.digest(
           p_year::text || '|' || p_month::text || '|' || upper(btrim(p_cur)) || '|' ||
           coalesce(round(p_gross)::text, '') || '|' || coalesce(round(p_net)::text, '') || '|' ||
           coalesce(round(p_deduct)::text, '') || '|' || coalesce(round(p_ytd)::text, ''),
           'sha256'), 'hex');
$fn$;

revoke all on function public.pv_payslip_fp(int, int, text, numeric, numeric, numeric, numeric)
  from public, anon, authenticated;

-- ── 券を作る（parse-payslip だけが service_role で呼ぶ）──────────
-- 形がおかしければ券を作らない（null）。読み取りそのものは失敗させない（index.ts 側）。
create or replace function public.pv_payslip_ticket_put(
  p_year int, p_month int, p_cur text, p_gross numeric,
  p_net numeric, p_deduct numeric, p_ytd numeric)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_cur text := upper(btrim(coalesce(p_cur, '')));
  v_tok text;
begin
  if p_year is null or p_year < 2015 or p_year > extract(year from now())::int + 1
     or p_month is null or p_month not between 1 and 12
     or v_cur !~ '^[A-Z]{3}$'
     or p_gross is null or p_gross <= 0 then
    return null;
  end if;
  -- 掃除：使われなかった券は7日で消す（pg_cron を使わない方針なので、作るついでに）。
  delete from public.pv_payslip_tickets where created_at < now() - interval '7 days';
  v_tok := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.pv_payslip_tickets (token_sha, period_year, period_month, currency, gross, fp)
  values (encode(extensions.digest(v_tok, 'sha256'), 'hex'), p_year, p_month, v_cur, round(p_gross),
          public.pv_payslip_fp(p_year, p_month, v_cur, p_gross, p_net, p_deduct, p_ytd));
  return v_tok;
end;
$fn$;

revoke all on function public.pv_payslip_ticket_put(int, int, text, numeric, numeric, numeric, numeric)
  from public, anon, authenticated;
-- service_role（Edge Function）にだけ配る。役が在るときだけ（手元の検査の DB には無いことがある。
-- db/reviews-gate.sql と同じ書き方）。
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function
      public.pv_payslip_ticket_put(int, int, text, numeric, numeric, numeric, numeric) to service_role;
  end if;
end $$;

-- ── 券を照合する（submit_pay_report だけが呼ぶ。grant しない）──────
-- 合えば指紋を返す。期限切れ・使用済み・知らない券・年月・通貨・総支給の不一致は null。
-- ★合っても合わなくても券は消す（一度きり）。提出がエラーで止まったときは
--   submit_pay_report ごと巻き戻るので、券も戻る。
create or replace function public.pv_payslip_redeem(
  p_ticket text, p_year int, p_month int, p_cur text, p_gross numeric)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_t public.pv_payslip_tickets%rowtype;
begin
  if p_ticket is null or p_ticket !~ '^[0-9a-f]{48}$' then
    return null;
  end if;
  delete from public.pv_payslip_tickets
   where token_sha = encode(extensions.digest(p_ticket, 'sha256'), 'hex')
  returning * into v_t;
  if not found then return null; end if;
  if v_t.created_at < now() - interval '7 days' then return null; end if;
  if v_t.period_year is distinct from p_year
     or v_t.period_month is distinct from p_month
     or v_t.currency is distinct from upper(btrim(coalesce(p_cur, '')))
     or v_t.gross is distinct from p_gross then
    return null;
  end if;
  return v_t.fp;
end;
$fn$;

revoke all on function public.pv_payslip_redeem(text, int, int, text, numeric)
  from public, anon, authenticated;

-- ── 運営が手で外す（SQL Editor から。grant しない）──────────────
-- 外した行は、同じ月を何度出し直しても印が戻らない（verify_method = 'revoked'）。
-- 行の id の探し方は workflows/pay-form.md の「明細の Verified」。
create or replace function public.pv_payslip_unverify(p_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_n int;
begin
  update public.pay_reports
     set verify_level = 0, verify_method = 'revoked', verified_at = null
   where id = p_id and verify_method is distinct from 'revoked';
  get diagnostics v_n = row_count;
  return v_n;
end;
$fn$;

revoke all on function public.pv_payslip_unverify(uuid) from public, anon, authenticated;

-- ── 検算（コメントアウトしない。ここまで含めて1回で貼る）──────
-- 5行すべて ✅ なら正しく入っている。
select n, what, case when good then '✅' else '❌' end as result
from (values
  (1, '券の表に会員が触れない（RLS あり・anon / authenticated に権限なし）',
   (select relrowsecurity from pg_class where oid = 'public.pv_payslip_tickets'::regclass)
   and not has_table_privilege('authenticated', 'public.pv_payslip_tickets', 'SELECT')
   and not has_table_privilege('anon', 'public.pv_payslip_tickets', 'SELECT')),
  (2, '券を作る関数を会員が呼べない',
   not has_function_privilege('authenticated',
     'public.pv_payslip_ticket_put(int, int, text, numeric, numeric, numeric, numeric)', 'EXECUTE')
   and not has_function_privilege('anon',
     'public.pv_payslip_ticket_put(int, int, text, numeric, numeric, numeric, numeric)', 'EXECUTE')),
  (3, '照合と外す関数を会員が呼べない',
   not has_function_privilege('authenticated', 'public.pv_payslip_redeem(text, int, int, text, numeric)', 'EXECUTE')
   and not has_function_privilege('authenticated', 'public.pv_payslip_unverify(uuid)', 'EXECUTE')),
  (4, '券の表に人を指す列が無い',
   not exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'pv_payslip_tickets'
                  and column_name ~ '(uid|user|proof|report|email|ip)')),
  (5, '提出の関数が券を照合している（db/pay-reports.sql が新しい）',
   pg_get_functiondef('public.submit_pay_report(jsonb)'::regprocedure) ~ 'pv_payslip_redeem')
) as t(n, what, good)
order by n;
