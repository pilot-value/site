-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/airline-activity.sql（2026-11-04）
--
-- 航空会社の一覧（world-airlines.html）の並べ替え「新しい投稿順」のための、
-- **会社ごとの「いちばん新しい投稿の時刻」**を、給与・口コミが書き込まれたときに1回だけ数えて小さな表に保存する。
-- ページは pv_airline_activity_order() を1回呼ぶだけ ── 返るのは会社コードの並び（新しい順）だけ。
--
-- なぜ（2026-11-04 オーナー決定）
--   一覧の「情報の更新順」を、会員の給与・口コミが新しく入った順にする。
--   ⚠️ 2026-10-31 に本番（Nano）が30分止まった ── 原因は「呼ばれるたびに全員分を数え直す重い処理」。
--   ＝ **ページを開くたびに数える形にしない。** 数えるのは書き込みの引き金（for each statement）だけ。
--   形は db/member-median.sql と同じ（小さな表・引き金で丸ごと作り直す・読む口は引くだけ）。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: db/pay-rows.sql → db/reviews-gate.sql → db/member-median.sql → このファイル
--    前のどれかが抜けていたら、下の「0. 前提」が日本語で止める。
-- ★ 冪等（何度流しても同じ結果）。表を作るのは初回だけ・関数と引き金は作り直す・最後に1回数え直す。
--
-- ── 数え方（会社ごとに「いちばん新しい created_at」を1つ）──────────────────
--   給与（pay_reports）        … annual_total_usd が年 $10,000〜$700,000 の中（REAL PAY の常識の幅と同じ）。
--                                本人が下ろした人（pay_hidden）・テスト用アカウント（pv_test_users）は外す。
--                                airline = 'other' の行は pv_airline_resolve(airline_other) で会社コードに直す。
--   口コミ（reviews_v2）        … 全部（pv_reviews が一覧に出す行と同じ）。テスト用アカウントは外す。
--                                社名の欄はコードとは限らない（「その他」は打ち込まれた字）ので、必ず pv_airline_resolve を通す。
--   預かりの口コミ（pv_review_pending）… 引き取っていない行だけ（claimed_at is null ＝ 一覧に出ている行）。
--                                引き取った行は reviews_v2 の行（引き取った時刻）として数える＝2回数えない。
--   捨てる行                    … どの会社にも当たらない社名（'other'）・会社の表に無いコード・active でない会社。
--
-- ── 守っている約束 ────────────────────────────────────────
--  1. 数えるのは書き込みのときだけ。読む口（pv_airline_activity_order）は表を引くだけで、何も数えない。
--  2. 日付も件数も外へ出さない・順番だけ。表は誰にも読ませない（RLS 有効・ポリシー無し・grant 無し）。
--     読む口が返すのは会社コードの jsonb の配列1つだけ（投稿の無い会社は入らない）。
--  3. 数え直しが失敗しても、給与・口コミの書き込みは止めない（引き金が例外を握って warning にする。
--     表は前の中身のまま残る＝一覧は1つ前の並びを出し続ける）。
--  4. 数え直しは1本ずつ（表を exclusive で握る）。読む側は止まらない（exclusive は select を止めない）。
--  5. 口コミの翻訳・給与の検証の印など、並びに関係しない列の update では数え直さない（引き金は列を名指しする）。
--  6. 会員を名指しで書かない（uid・氏名・メールをこのファイルに書かない）。
--
-- ★ CLAUDE.md の「会員だけが見られるものを返す関数を新しく作ったら pv_proof_blocked の1行を足す」は
--   **この関数は対象外**。一覧の並び順は誰でも見られる（未ログインでも並べ替えられる）もので、
--   1人ずつの値も人数も日付も返さない。止めた会員にだけ閉じる意味が無い。
--
-- ⚠️ 会社を active でなくしたときは、読む口が会社の表と突き合わせるのでその場で並びから消える
--    （数え直しは待たない）。会社を足した・名前を変えたことで「その他」だった社名が当たるようになったぶんは、
--    次の給与・口コミの書き込みで入る（気になれば SQL Editor で select public.pv_airline_activity_refresh(); を1回流す）。
-- ⚠️ 給与の預かり（pay_reports_pending）は数えていない（2026-11-04 の決め方は 給与・口コミ・口コミの預かり の3つ）。
-- ⚠️ 同じ線の写し（直すときは一緒に）
--     年収の常識の幅（1万〜70万ドル）  … db/pay-rows.sql ・ db/member-median.sql と同じ
--     給与の鍵の式                       … db/pay-reports.sql 5章（submit_pay_report の v_hash）
--     口コミの鍵の式                     … db/reviews-gate.sql の pv_review_hash
--     テスト用アカウントの外し方         … db/member-median.sql の pv_member_median_refresh と同じ2つの式
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.pv_airlines') is null then
    raise exception '先に db/airlines.generated.sql を実行してください（会社の表 pv_airlines が無い）';
  end if;
  if to_regclass('public.pay_reports') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports の表が無い）';
  end if;
  if to_regclass('public.reviews_v2') is null then
    raise exception '口コミの表（public.reviews_v2）がありません';
  end if;
  if to_regclass('public.pay_hidden') is null
     or to_regprocedure('public.pv_airline_resolve(text)') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pay_hidden / pv_airline_resolve が無い）';
  end if;
  if to_regclass('public.pv_review_pending') is null then
    raise exception '先に db/reviews-gate.sql を実行してください（口コミの預かりの表 pv_review_pending が無い）';
  end if;
  if to_regclass('public.pv_test_users') is null then
    raise exception '先に db/member-median.sql を実行してください（テスト用アカウントの名簿 pv_test_users が無い）';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. pv_airline_activity — 会社ごとの「いちばん新しい投稿の時刻」
--    作るのは pv_airline_activity_refresh() だけ。読むのは pv_airline_activity_order() だけ。
-- ════════════════════════════════════════════════════════════════
create table if not exists public.pv_airline_activity (
  airline    text        primary key,
  last_at    timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.pv_airline_activity enable row level security;
revoke all on table public.pv_airline_activity from public, anon, authenticated;
comment on table public.pv_airline_activity is
  '会社ごとの、会員の給与・口コミ（引き取っていない口コミの預かりも）のいちばん新しい投稿の時刻。'
  '給与・口コミの書き込みの引き金が丸ごと作り直す。誰にも読ませない（日付を外へ出さない）。'
  '外へ出すのは pv_airline_activity_order() の会社コードの並びだけ。';


-- ════════════════════════════════════════════════════════════════
-- 2. pv_airline_activity_refresh() — 表の中身を丸ごと作り直す
--    呼ぶのは下の引き金（と、ファイルの最後の1回）だけ。誰にも実行させない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_airline_activity_refresh()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $fn$
begin
  -- 1本ずつ（同時に来た後の1本は、前の1本が終わってから新しい中身を見て作り直す）。select は止めない。
  lock table public.pv_airline_activity in exclusive mode;

  delete from public.pv_airline_activity where true;

  insert into public.pv_airline_activity (airline, last_at, updated_at)
  with
  -- 給与：常識の幅の中・下ろした人でない・テスト用アカウントでない。会社（と打ち込んだ社名）ごとに最新の1つ
  pay as (
    select case when p.airline = 'other' then null else p.airline end    as code,
           case when p.airline = 'other' then p.airline_other end         as nm,
           max(p.created_at)                                              as at
      from public.pay_reports p
     where p.annual_total_usd between 10000 and 700000
       and not exists (select 1 from public.pay_hidden h where h.proof_hash = p.proof_hash)
       and not exists (select 1 from public.pv_test_users t   -- ★テスト用アカウント（給与）
                        where encode(extensions.digest(t.uid::text || '::pv_pay::' || p.airline || coalesce('::' || lower(p.airline_other), ''), 'sha256'), 'hex') = p.proof_hash)
     group by 1, 2
  ),
  -- 口コミ：全部（テスト用アカウントでない）＋ 引き取っていない預かり。社名の欄ごとに最新の1つ
  rv as (
    select x.nm, max(x.at) as at
      from (
        select v.airline as nm, v.created_at as at
          from public.reviews_v2 v
         where not exists (select 1 from public.pv_test_users t   -- ★テスト用アカウント（口コミ）
                            where encode(extensions.digest(t.uid::text || '::pv_anon::' || v.airline || '::2026', 'sha256'), 'hex') = v.proof_hash)
        union all
        select q.airline, q.created_at
          from public.pv_review_pending q
         where q.claimed_at is null
      ) x
     group by x.nm
  ),
  -- 社名を会社コードへ（同じ字は1回だけ引く）。どこにも当たらなければ 'other'（下で捨てる）
  names as materialized (
    select distinct nm from (
      select p.nm from pay p
      union all
      select v.nm from rv v) x
     where nm is not null
  ),
  res as materialized (
    select n.nm, public.pv_airline_resolve(n.nm) as code from names n
  ),
  cand as (
    select p.code, p.at from pay p where p.code is not null
    union all
    select r.code, p.at from pay p join res r on r.nm = p.nm
    union all
    select r.code, v.at from rv v join res r on r.nm = v.nm
  )
  select c.code, max(c.at), now()
    from cand c
    join public.pv_airlines a on a.code = c.code
   where a.active
     and a.code <> 'other'
   group by c.code;
end;
$fn$;

revoke all on function public.pv_airline_activity_refresh() from public, anon, authenticated;
comment on function public.pv_airline_activity_refresh() is
  '会社ごとのいちばん新しい投稿の時刻の表（pv_airline_activity）を丸ごと作り直す。'
  '呼ぶのは書き込みの引き金だけ（誰にも実行させない＝外から何度も呼んで重くさせない）。';


-- ════════════════════════════════════════════════════════════════
-- 3. pv_airline_activity_order() — 一覧の「新しい投稿順」が読む口（表を引くだけ・何も数えない）
--    返すのは会社コードの jsonb の配列だけ（新しい順）。日付も件数も返さない。誰でも呼べる。
--    同じ時刻の会社はコードの順（毎回同じ並びになるように）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_airline_activity_order()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(jsonb_agg(t.airline order by t.last_at desc, t.airline), '[]'::jsonb)
    from public.pv_airline_activity t
    join public.pv_airlines a on a.code = t.airline
   where a.active
     and a.code <> 'other';
$fn$;

revoke all on function public.pv_airline_activity_order() from public, anon, authenticated;
grant execute on function public.pv_airline_activity_order() to anon, authenticated;
comment on function public.pv_airline_activity_order() is
  '航空会社の一覧の「新しい投稿順」。会員の給与・口コミがいちばん新しく入った会社から順に、会社コードを並べた配列だけを返す'
  '（日付も件数も返さない・投稿の無い会社は入らない）。表を引くだけで何も数えない（数えるのは書き込みの引き金）。'
  '誰でも見られる並びなので pv_proof_blocked は呼ばない。';


-- ════════════════════════════════════════════════════════════════
-- 4. 引き金 — 書き込みのあと（1文に1回）数え直す。失敗しても書き込みは止めない
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_airline_activity_trg()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $fn$
begin
  begin
    perform public.pv_airline_activity_refresh();
  exception when others then
    -- 書き込みは通す。表は前の中身のまま（この begin の中の変更だけが巻き戻る）
    raise warning 'pv_airline_activity_refresh に失敗しました（書き込みはそのまま通します）: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end;
$fn$;

revoke all on function public.pv_airline_activity_trg() from public, anon, authenticated;
comment on function public.pv_airline_activity_trg() is
  '給与・口コミ・口コミの預かり・下ろした人・テスト用アカウントの書き込みのあとに pv_airline_activity_refresh() を呼ぶ。'
  '数え直しが失敗しても warning にするだけで、書き込みは止めない。';

-- 給与：並びに関わる列の update だけ（verify_level などの書き換えでは数え直さない）
drop trigger if exists trg_pv_airline_activity on public.pay_reports;
create trigger trg_pv_airline_activity
  after insert or delete
        or update of proof_hash, airline, airline_other, annual_total_usd, created_at
  on public.pay_reports
  for each statement execute function public.pv_airline_activity_trg();

-- 口コミ：並びに関わる列の update だけ（翻訳・要約・点数・本文の書き込みでは数え直さない）
drop trigger if exists trg_pv_airline_activity on public.reviews_v2;
create trigger trg_pv_airline_activity
  after insert or delete
        or update of proof_hash, airline, created_at
  on public.reviews_v2
  for each statement execute function public.pv_airline_activity_trg();

-- 口コミの預かり：預けた（同じ日の上書きは created_at が新しくなる）・引き取った（claimed_at）とき
drop trigger if exists trg_pv_airline_activity on public.pv_review_pending;
create trigger trg_pv_airline_activity
  after insert or delete
        or update of airline, created_at, claimed_at
  on public.pv_review_pending
  for each statement execute function public.pv_airline_activity_trg();

drop trigger if exists trg_pv_airline_activity on public.pay_hidden;
create trigger trg_pv_airline_activity
  after insert or update or delete on public.pay_hidden
  for each statement execute function public.pv_airline_activity_trg();

drop trigger if exists trg_pv_airline_activity on public.pv_test_users;
create trigger trg_pv_airline_activity
  after insert or update or delete on public.pv_test_users
  for each statement execute function public.pv_airline_activity_trg();


-- ════════════════════════════════════════════════════════════════
-- 5. いまの中身で1回数え直す
-- ════════════════════════════════════════════════════════════════
select public.pv_airline_activity_refresh();


-- 検算（貼ったあとに出る10行。全部 ✅ が正しい。★「貼れた」は証拠にならない。この10行を読む）
-- 10行目だけは ⚠️ がありうる（給与も口コミもまだ1件も無い手元の DB）。
with d as (select pg_get_functiondef('public.pv_airline_activity_refresh()'::regprocedure) as s),
     r as (select pg_get_functiondef('public.pv_airline_activity_order()'::regprocedure) as s),
     g as (select pg_get_functiondef('public.pv_airline_activity_trg()'::regprocedure) as s)
select 1 as no, '表は RLS 有効・ポリシー無し' as 検算,
       case when (select c.relrowsecurity from pg_class c where c.oid = 'public.pv_airline_activity'::regclass)
             and not exists (select 1 from pg_policies p
                              where p.schemaname = 'public' and p.tablename = 'pv_airline_activity')
            then '✅' else '❌' end as 結果
union all select 2, '未ログイン・ログイン済みとも表を直接読めない（日付を外へ出さない）',
       case when not has_table_privilege('anon', 'public.pv_airline_activity', 'select')
             and not has_table_privilege('authenticated', 'public.pv_airline_activity', 'select')
            then '✅' else '❌' end
union all select 3, '読む口（pv_airline_activity_order）は未ログインもログイン済みも呼べる',
       case when has_function_privilege('anon', 'public.pv_airline_activity_order()', 'execute')
             and has_function_privilege('authenticated', 'public.pv_airline_activity_order()', 'execute')
            then '✅' else '❌' end
union all select 4, '読む口が返すのは会社コードの並び1つだけ（日付も件数も返さない）',
       case when pg_get_function_result('public.pv_airline_activity_order()'::regprocedure) = 'jsonb'
             and (select s from r) like '%jsonb_agg(t.airline order by t.last_at desc, t.airline)%'
            then '✅' else '❌' end
union all select 5, '読む口は表を引くだけ（給与・口コミ・預かりの表を読まない＝開くたびに数えない）',
       case when (select s from r) not like '%pay_reports%' and (select s from r) not like '%reviews_v2%'
             and (select s from r) not like '%pv_review_pending%' and (select s from r) not like '%refresh%'
            then '✅' else '❌' end
union all select 6, '数え直しは誰にも実行させない（PUBLIC・未ログイン・ログイン済み）',
       case when not has_function_privilege('anon', 'public.pv_airline_activity_refresh()', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_airline_activity_refresh()', 'execute')
             and not exists (select 1 from pg_proc q, lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
                              where q.oid = 'public.pv_airline_activity_refresh()'::regprocedure
                                and a.grantee = 0 and a.privilege_type = 'EXECUTE')
            then '✅' else '❌' end
union all select 7, '引き金が5つの表に付いている（給与・口コミ・口コミの預かり・下ろした人・テスト用アカウント）',
       case when (select count(*) from pg_trigger t
                   where t.tgname = 'trg_pv_airline_activity' and not t.tgisinternal
                     and t.tgrelid in ('public.pay_reports'::regclass, 'public.reviews_v2'::regclass,
                                       'public.pv_review_pending'::regclass, 'public.pay_hidden'::regclass,
                                       'public.pv_test_users'::regclass)) = 5
            then '✅' else '❌' end
union all select 8, '数え直しが失敗しても書き込みは止めない（引き金が例外を握る）',
       case when (select s from g) like '%exception when others then%' and (select s from g) like '%raise warning%'
            then '✅' else '❌' end
union all select 9, 'テスト用アカウントを給与・口コミの両方で外している・預かりは引き取っていないものだけ',
       case when (select s from d) like '%pv_test_users t   -- ★テスト用アカウント（給与）%'
             and (select s from d) like '%pv_test_users t   -- ★テスト用アカウント（口コミ）%'
             and (select s from d) like '%''::pv_pay::''%' and (select s from d) like '%''::pv_anon::''%'
             and (select s from d) like '%q.claimed_at is null%'
            then '✅' else '❌' end
union all select 10, '並びに入っている会社 ' || jsonb_array_length(public.pv_airline_activity_order()) || ' 社',
       case when jsonb_array_length(public.pv_airline_activity_order()) > 0 then '✅'
            else '⚠️ 0社（給与も口コミもまだ1件も無い）' end
order by 1;
