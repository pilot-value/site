/* ════════════════════════════════════════════════════════════════
   db/admin.sql — 管理画面を「ログイン必須」にする

   実行: Supabase ダッシュボード → SQL Editor に貼って Run
   何度流しても同じ結果になるように書いてある（冪等）。

   なぜ要るか
     admin.html は「合言葉を JavaScript に書いておいて、合っていたら
     表を出す」という作りだった。JavaScript はサイトから誰でも読めるので、
     合言葉は最初から公開されていたのと同じ。さらに悪いことに、表の中身は
     ブラウザが anon キーで profiles を直接読んで作っていた。
     つまりページを直さなくても、anon キーさえあれば会員一覧は取れた。

   なので直す場所は2つある。
     ① profiles を「本人の行だけ」に閉じる（ここが本体）
     ② 管理者だけが全件を読める入口を、サーバー側の判定つきで作る

   ①をやると、ブラウザから他人の profiles は原理的に取れなくなる。
   ②の入口は security definer ＝ 関数の中だけ権限が上がる作りで、
   入口の1行目で「あなたは名簿に載っているか」を必ず聞く。
   画面側の分岐では守らない（画面は誰でも書き換えられる）。

   ⚠️ profiles にポリシーを作り直す。既存のポリシーは
      public.pv_policy_backup に控えを取ってから消す（戻せる）。
   ⚠️ profiles を読み書きしている SQL 関数（submit_pay_report /
      my_pay_reports / handle_new_user / claim_referral など）は
      すべて security definer なので、RLS を有効にしても素通りする。
      画面側（profile.html / login.html / signup.html / pay-login.js /
      my-value.js / pay-report.html）は全部「自分の id」で絞っているので
      本人ポリシーだけで足りる。
════════════════════════════════════════════════════════════════ */

-- ── 1. 管理者名簿 ────────────────────────────────────────────
--    ここに載っている人だけが管理用の入口を通れる。
create table if not exists public.pv_admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  note     text,
  added_at timestamptz not null default now()
);

comment on table public.pv_admins is
  '管理者の名簿。ポリシーを1つも作らない＝ anon も authenticated も1行も読めない。'
  '書き換えられるのはサービスロール（＝ダッシュボードの SQL Editor）だけ。';

alter table public.pv_admins enable row level security;
revoke all on public.pv_admins from anon, authenticated;

-- ポリシーは1つも要らない。過去に作ってしまっていたら消す。
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'pv_admins'
  loop execute format('drop policy %I on public.pv_admins', p.policyname); end loop;
end $$;


-- ── 2. 管理者かどうか（名簿を読むので security definer）──────
create or replace function public.pv_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.pv_admins a where a.user_id = auth.uid())
$$;

comment on function public.pv_is_admin() is
  '呼んだ本人が管理者かどうかだけを返す。他人については何も答えない。';

revoke all on function public.pv_is_admin() from public, anon;
grant execute on function public.pv_is_admin() to authenticated;


-- ── 3. profiles を本人の行だけに閉じる（ここが本体）─────────
alter table public.profiles enable row level security;

-- anon には1行も渡さない。ログイン前に profiles を読む画面は1つも無い。
revoke all on public.profiles from anon;

/* ★2026-08-27、ここを列単位に絞った。

   それまでは `grant select, insert, update on public.profiles to authenticated`
   ＝ **表ごと** 書き換えを許していた。RLS は「どの行か」しか見ないので、
   ログインしている人なら誰でもブラウザの開発者ツールから

       await sb.from('profiles').update({ access_until: '2099-01-01' }).eq('id', myId)

   で自分の REAL PAY を永久に開けたし、verify_level を上げて Verified を
   名乗ることもできた。画面には出していない列でも、表に書ける以上は書ける。
   （実データを調べた限り、使われた形跡はゼロ。2026-08-27 時点で verify_level>0 は0人）

   ⚠️ 許すのは **画面が実際に書いている列だけ**。増やす前に必ず grep する：
       from('profiles').update / .upsert
     現在の書き手は4ファイル・6か所しかない
       profile.html:775 / en/profile.html:777   氏名ほか6列（プロフィール編集）
       profile.html:630 / en/profile.html:632   メール通知の2列（トグル）
       signup.html:649  / en/signup.html:649    登録時の upsert（id と email を含む）

   ⚠️ `id` と `email` を外さない。登録の upsert は
       INSERT ... ON CONFLICT DO UPDATE  になり、その2列も SET に入る。
       外すと**登録時に氏名・会社が黙って保存されない**（本人は成功したつもりで、
       プロフィールが空のまま残る。実際にそういうアカウントが1つあった）。
       `id` を勝手な値にはできない ── 下の RLS の with check (id = auth.uid()) が縛る。

   ⚠️ 給与・口コミ・招待・待遇の書き込みはここを通らない。全部
      security definer の関数（submit_pay_report / set_mail_optin / claim_referral …）
      なので、この grant を絞っても1つも壊れない。 */
/* ⚠️ **この3行の順番を入れ替えない。**
   Postgres は「表ごとの revoke」で **その表の列の許可も道連れに消す**
   （PGlite で実測済み）。revoke を後ろに書くと、下の grant が全部消えて
   **profiles に1文字も書けなくなる** ＝ 登録も、プロフィール編集も、
   メール通知のトグルも黙って失敗する。必ず revoke → grant の順。 */
revoke insert, update on public.profiles from authenticated;

grant select on public.profiles to authenticated;
grant insert (id, email, name, gender, birthdate, country, company, position,
              email_opt_in, email_opt_in_at) on public.profiles to authenticated;
grant update (id, email, name, gender, birthdate, country, company, position,
              email_opt_in, email_opt_in_at) on public.profiles to authenticated;

-- 消す前に控えを取る。戻したくなったらこの表を見る。
create table if not exists public.pv_policy_backup (
  taken_at   timestamptz not null default now(),
  tablename  text,
  policyname text,
  cmd        text,
  roles      text,
  qual       text,
  with_check text
);
alter table public.pv_policy_backup enable row level security;
revoke all on public.pv_policy_backup from anon, authenticated;

insert into public.pv_policy_backup (tablename, policyname, cmd, roles, qual, with_check)
select tablename, policyname, cmd, roles::text, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles';

do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'profiles'
  loop execute format('drop policy %I on public.profiles', p.policyname); end loop;
end $$;

create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 消す口は開けない。退会や後始末はサービスロール（SQL Editor）で行う。


-- ── 4. 管理用の入口（1行目で必ず名簿を見る）─────────────────
--     列の型を書かずに済むよう jsonb で返す。profiles に列を足しても
--     ここを直さなくてよい（直し忘れで管理画面だけ落ちるのを防ぐ）。
create or replace function public.admin_list_profiles()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.pv_is_admin() then
    raise exception '管理者ではありません' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]'::jsonb)
    into v from public.profiles p;
  return v;
end $$;

revoke all on function public.admin_list_profiles() from public, anon;
grant execute on function public.admin_list_profiles() to authenticated;

create or replace function public.admin_list_reviews()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.pv_is_admin() then
    raise exception '管理者ではありません' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
    into v from public.reviews_v2 r;
  return v;
end $$;

revoke all on function public.admin_list_reviews() from public, anon;
grant execute on function public.admin_list_reviews() to authenticated;


-- ── 5. 自分を名簿に入れる（★ここだけ手で直す）───────────────
--     下の1行のメールアドレスを、管理画面に入るときにログインする
--     アカウントのものに置き換えてから流す。
--     （Authentication → Users に出ている address のこと）
insert into public.pv_admins (user_id, note)
select id, '運営' from auth.users
 where email = 'ここにログイン用のメールアドレスを入れる'
on conflict (user_id) do nothing;


-- ── 6. 検算（流したあと、この結果を見る）─────────────────────
select '① 名簿の人数' as 項目, count(*)::text as 値 from public.pv_admins
union all
select '② profiles の RLS', case when c.relrowsecurity then '有効' else '❌ 無効' end
  from pg_class c where c.oid = 'public.profiles'::regclass
union all
select '③ profiles のポリシー', string_agg(policyname, ', ')
  from pg_policies where schemaname='public' and tablename='profiles'
union all
select '④ anon に残った権限', coalesce(string_agg(distinct g.privilege_type, ', '), 'なし（これが正しい）')
  from information_schema.role_table_grants g
 where g.table_schema='public' and g.table_name='profiles' and g.grantee='anon'
union all
select '④b PUBLIC に残った権限', coalesce(string_agg(distinct g.privilege_type, ', '), 'なし（これが正しい）')
  from information_schema.role_table_grants g
 where g.table_schema='public' and g.table_name='profiles' and g.grantee='PUBLIC'
union all
select '⑤ 管理用の入口', string_agg(p.proname, ', ')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.proname in ('pv_is_admin','admin_list_profiles','admin_list_reviews')
union all
select '⑥ 会員が profiles に表ごと書けるか',
       coalesce(string_agg(distinct g.privilege_type, ', '), 'なし（これが正しい）')
  from information_schema.role_table_grants g
 where g.table_schema='public' and g.table_name='profiles'
   and g.grantee='authenticated' and g.privilege_type in ('INSERT','UPDATE')
union all
select '⑦ 会員が書ける列（この10列だけが正しい）',
       coalesce(string_agg(distinct c.column_name, ', ' order by c.column_name), '❌ 1列も無い')
  from information_schema.column_privileges c
 where c.table_schema='public' and c.table_name='profiles'
   and c.grantee='authenticated' and c.privilege_type = 'UPDATE'
union all
select '⑧ 会員が書けてはいけない列が混ざっていないか',
       coalesce(string_agg(distinct c.column_name, ', '), 'なし（これが正しい）')
  from information_schema.column_privileges c
 where c.table_schema='public' and c.table_name='profiles'
   and c.grantee='authenticated' and c.privilege_type in ('INSERT','UPDATE')
   and c.column_name in ('access_until','verify_level','verified_airline','verified_at',
                         'badge','badge_state','pay_report_count','pay_streak_months',
                         'pay_day_of_month','last_pay_report_at','mail_unsub_token','mail_optin');

/* ①が 0 のままなら 5. のメールアドレスが auth.users に無い。
   ④・④b が「なし」でなければ revoke が効いていない。
   ⑥が「なし」でなければ表ごとの許可が残っている＝⑦の絞り込みが意味を失う。
   ⑦が「❌ 1列も無い」なら revoke と grant の順番が逆
     ＝ このあと**誰も登録できない・プロフィールを保存できない**。すぐ直す。
   ⑧に何か出たら、会員が自分で REAL PAY を開けたり Verified を名乗れる。
   ここまで通ったら admin.html にログインして表が出るか確かめる。 */


-- ── 7. 未ログインの人になって実際に読んでみる（読むだけ・何も変えない）──
--     ここだけは別に流す。権限エラーで止まるのも「正しい」結果なので、
--     6. までと一緒に流すと途中で止まったように見えてしまう。
-- set role anon;
-- select count(*) as "未ログインで読める profiles の行数" from public.profiles;
-- reset role;
