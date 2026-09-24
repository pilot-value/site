-- ════════════════════════════════════════════════════════════════
-- weekly-digest — 週に一度の新着まとめを、Supabase の時計から送るための土台
--
--   貼る順: pay-reports.sql → pay-rows.sql → airlines.generated.sql → **これ**
--   （pv_airline_resolve と pv_airlines を使うため。先に貼ると落ちる）
--
--   このファイルが持つのは4つだけ:
--     pv_digest_since()          … 前回どこまで送ったか
--     pv_digest_week(since)      … その週の**件数と社名だけ**を作る
--     pv_digest_recipients()     … 通知を希望した人＋言語の手がかり
--     pv_digest_mark(at)         … 送れた週を記録する
--
--   ★ここが「何を数えるか」の唯一の正。Edge Function は数えない。
--     数えるのを SQL に寄せているのは、**関数が行そのものを受け取らない**ため。
--     受け取らなければ、口コミの本文も金額も、メールに出しようが無い
--     （mail-bot/announce-mail.mjs の digestStats は、手で流すときの写し。
--       db/test-digest.mjs が両方に同じ週を数えさせて突き合わせている）。
--
--   ★誰にも grant しない。service_role だけが呼べる
--     ＝ログインした会員が叩いても、投稿のあった社の一覧は取れない。
--
--   ★4つとも security definer。理由は「黙って0件になる」のを避けるため。
--     Supabase の service_role は BYPASSRLS だが、それに寄りかかると
--     ロールの設定が変わった日に **エラーも出さずに0件のまま送らなくなる**
--     （週まとめは「静かな週は送らない」設計なので、止まっても誰も気づけない）。
--     ⚠️ security definer にした以上、**anon / authenticated から呼べないことが命綱**。
--        下の revoke を外さない。db/test-digest.mjs の②が8通りで固定している。
-- ════════════════════════════════════════════════════════════════

-- ── 1. どこまで送ったか ─────────────────────────────────────
--   1行しか入らない。.send-state.json（手元）と同じ役目を DB 側に置く。
--   ★手で流す側とは別々に進む。片方で送った週をもう片方が送り直さないよう、
--     Resend の Idempotency-Key（digest:<人>:<週>）が最後の網になっている。
create table if not exists public.pv_mail_state (
  key text primary key,
  at  timestamptz not null default now()
);
alter table public.pv_mail_state enable row level security;
-- ポリシーを1つも置かない＝service_role 以外からは読めない・書けない。
revoke all on table public.pv_mail_state from public, anon, authenticated;
-- ★送る側には明示的に渡す。Supabase の既定権限（新しい表は service_role にも
--   自動で付く）に頼ると、既定が変わった日に週まとめだけが黙って止まる。
grant select, insert, update on table public.pv_mail_state to service_role;


create or replace function public.pv_digest_since()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  -- 記録が無い初回は「直近7日」。件名が「この1週間の新着」なので、
  -- いきなり全期間を数えない。
  select coalesce((select s.at from public.pv_mail_state s where s.key = 'digest'),
                  now() - interval '7 days');
$$;

revoke all on function public.pv_digest_since() from public, anon, authenticated;
grant execute on function public.pv_digest_since() to service_role;


-- ── 2. その週の件数と社名 ───────────────────────────────────
create or replace function public.pv_digest_week(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  -- ★窓の終わりも返す（'until'）。送り終えたあとの now() で記録すると、
  --   数えてから送り終えるまでの数十秒に届いた投稿が、今週にも来週にも
  --   入らないまま消える。記録するのはここで使った now() そのもの。
  --   （now() は文の中で一定なので、下の絞り込みと 'until' は必ず同じ値になる）
  with pay as (
    select r.airline from public.pay_reports r
     where r.created_at > p_since and r.created_at <= now()
  ),
  rev as (
    select v.airline from public.reviews_v2 v
     where v.created_at > p_since and v.created_at <= now()
  ),
  both_ as (
    select airline from pay union all select airline from rev
  ),
  by_air as (
    -- ★語彙に当たった社だけ。当たらない自由入力（airline_other）は名前を出さない。
    --   ここで弾いておけば、メール側が何をしても本文に出しようが無い。
    select a.code as slug, a.name_ja as ja, a.name_en as en, count(*)::int as n
      from both_ b
      join public.pv_airlines a on a.code = public.pv_airline_resolve(b.airline)
     where public.pv_airline_resolve(b.airline) <> 'other'
     group by a.code, a.name_ja, a.name_en
  )
  select jsonb_build_object(
    'since',    p_since,
    'until',    now(),
    'pay',      (select count(*)::int from pay),
    'reviews',  (select count(*)::int from rev),
    'total',    (select count(*)::int from both_),
    -- ★多い順・同数ならコード順。同じ週なら何度数えても同じ並びになる
    --   （送り直しても本文が変わらない＝Idempotency-Key が意味を持つ）。
    --   ★件数（n）も返すが、これは並べ替えのためだけ。本文には書かない
    --     （「◯◯社 1件」と書くと、その週にその社から出したたった1人が居ると伝わる）。
    'airlines', coalesce((
      select jsonb_agg(jsonb_build_object('slug', t.slug, 'n', t.n, 'ja', t.ja, 'en', t.en)
                        order by t.n desc, t.slug)
        from by_air t), '[]'::jsonb)
  );
$$;

revoke all on function public.pv_digest_week(timestamptz) from public, anon, authenticated;
grant execute on function public.pv_digest_week(timestamptz) to service_role;

comment on function public.pv_digest_week(timestamptz) is
  '週の新着を数える。返すのは件数と社名だけ＝行そのものは1件も外へ出ない。'
  '金額・職位・機材・口コミ本文は組み立てもしない。service_role だけが呼べる。';


-- ── 3. 送る相手 ─────────────────────────────────────────────
create or replace function public.pv_digest_recipients()
returns table (
  id             uuid,
  email          text,
  name           text,
  country        text,
  airline_region text,
  unsub_token    text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.name, p.country,
         -- ★勤務先は自由入力。語彙に寄せてから地域だけを渡す
         --   （打ち込まれた文字列そのものは Edge Function に渡さない）。
         coalesce((select a.region from public.pv_airlines a
                    where a.code = public.pv_airline_resolve(p.company)), '') as airline_region,
         p.unsub_token
    from public.profiles p
   -- ★繰り返し届くメールなので、希望した人だけ。
   --   他の5通（一度きりのお知らせ）は登録者全員に送るが、これだけは違う。
   where coalesce(p.email_opt_in, false)
     and p.email is not null
     and position('@' in p.email) > 1
   order by p.created_at asc;
$$;

revoke all on function public.pv_digest_recipients() from public, anon, authenticated;
grant execute on function public.pv_digest_recipients() to service_role;

comment on function public.pv_digest_recipients() is
  '週のまとめを送る相手。email_opt_in = true の人だけ。'
  '勤務先は語彙に寄せた地域だけを返す（打ち込まれた社名は通さない）。';


-- ── 4. 送れた週を記録する ───────────────────────────────────
create or replace function public.pv_digest_mark(p_at timestamptz default now())
returns timestamptz
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.pv_mail_state (key, at) values ('digest', p_at)
    on conflict (key) do update set at = excluded.at
  returning at;
$$;

revoke all on function public.pv_digest_mark(timestamptz) from public, anon, authenticated;
grant execute on function public.pv_digest_mark(timestamptz) to service_role;

comment on function public.pv_digest_mark(timestamptz) is
  '週のまとめを送れたときだけ呼ぶ。1通も出せなかった週は呼ばない'
  '＝そのぶんは翌週のまとめに合流する。';


-- ════════════════════════════════════════════════════════════════
-- 5. pg_cron（オーナー作業・Supabase の Dashboard から）
--
--   Database → Extensions → pg_cron を有効化 → 下を SQL Editor で実行。
--   ★ <PROJECT_REF> と <CRON_SECRET> を自分の値に置き換えること。
--   ★ CRON_SECRET は Edge Functions → Secrets の PV_CRON_SECRET と同じ値
--     （remind-payslip と同じものでよい）。
--
--   毎週月曜 00:00 UTC ＝ 日本時間 月曜 09:00。
--   ⚠️ pg_cron の時刻は UTC。日本時間で書くと9時間ずれる。
-- ════════════════════════════════════════════════════════════════
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule('pv-weekly-digest', '0 0 * * 1', $cron$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/weekly-digest',
--     headers := jsonb_build_object('Content-Type','application/json',
--                                   'x-pv-cron-secret','<CRON_SECRET>'),
--     body    := '{}'::jsonb
--   );
-- $cron$);
--
-- 止めるとき: select cron.unschedule('pv-weekly-digest');
-- 実行履歴  : select * from cron.job_run_details order by start_time desc limit 20;


-- ════════════════════════════════════════════════════════════════
-- 6. 検算（貼ったあとにここだけ流して確かめる）
-- ════════════════════════════════════════════════════════════════

-- 6-1. 前回どこまで送ったか（初回は「7日前」が出る）
select public.pv_digest_since() as 前回送ったところ;

-- 6-2. 今この瞬間に送るとしたら何件か（4件未満なら送らない）
select (public.pv_digest_week(public.pv_digest_since()) -> 'pay')    as 年収,
       (public.pv_digest_week(public.pv_digest_since()) -> 'reviews') as 口コミ,
       (public.pv_digest_week(public.pv_digest_since()) -> 'total')   as 合計_4以上で送る,
       jsonb_array_length(public.pv_digest_week(public.pv_digest_since()) -> 'airlines') as 名前を出す社数;

-- 6-3. 送る相手が何人か（メールアドレスは出さない）
select count(*) as 通知を希望した人数 from public.pv_digest_recipients();

-- 6-4. 会員から呼べないこと（期待：権限に anon= / authenticated= が出てこない）
select p.proname, coalesce(array_to_string(p.proacl::text[], ', '), '(既定)') as 権限
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('pv_digest_since','pv_digest_week','pv_digest_recipients','pv_digest_mark')
 order by p.proname;

-- 6-5. 記録の置き場が誰にも開いていないこと（期待：0 行）
select policyname from pg_policies where schemaname = 'public' and tablename = 'pv_mail_state';
