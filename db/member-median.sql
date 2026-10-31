-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/member-median.sql（2026-10-31）
--
-- 会社ページの「会員が出した年収の中央値」（会社 × 機長／副操縦士）を、
-- **給与・口コミが書き込まれたときに1回だけ**数えて小さな表に保存する。ページはその表を1行引くだけ。
--
-- なぜ（オーナー指示「提出のたびにすぐ変える」）
--   それまでの中央値は、手元の道具（member-median.mjs）で1回数えた値をページに書き込んでいただけで、
--   新しい提出があっても動かなかった。
--   ⚠️ 同じ日に本番（Nano）が30分止まった ── 原因は「呼ばれるたびに全員分を数え直す重い処理」が
--   時間切れを起こし、ディスクの読み書きの上限を使い切ったこと。
--   ＝ **ページを開くたびに数える形にしない。** 数えるのは書き込みの引き金（for each statement）だけ。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: db/pay-reports.sql → db/pay-rows.sql → db/reviews-gate.sql → このファイル
--    前のどれかが抜けていたら、下の「0. 前提」が日本語で止める。
-- ★ 冪等（何度流しても同じ結果）。表を作るのは初回だけ・関数と引き金は作り直す・最後に1回数え直す。
-- ★ 貼ったあと、テスト用アカウントの uid をオーナーが SQL Editor で入れる（リポジトリには書かない）:
--      insert into public.pv_test_users (uid) values ('<uid>') on conflict do nothing;
--    入れた瞬間に引き金が数え直す（入れる前は、テスト用アカウントの給与も中央値に混ざっている）。
--
-- ── 数え方（手元の道具 member-median.mjs と同じ）────────────────────
--   給与（pay_reports）   … annual_total_usd がある・created_at が直近24か月・人の鍵は 'r:'||proof_hash。
--                           airline = 'other' の行は pv_airline_resolve(airline_other) で会社コードに直す。
--   口コミ（reviews_v2）  … 対応表 pv_review_person で人の鍵が取れる行だけ・直近24か月。
--                           同じ人（同じ鍵）が給与を1件でも出していたら口コミは使わない。
--                           年額（万円）＝ annual_salary（0 は無いもの）
--                                     → base_annual ＋ flight_allowance_annual ＋ bonus（前の2つのどちらかが0でないとき）
--                                     → monthly_salary × 12 ＋ bonus。ドルへは fx_rates の JPY の to_usd を掛ける。
--   職位                  … captain・cap・tri_tre → cap ／ fo・sfo → fo。ほかは捨てる。
--   捨てる行              … 年 $10,000〜$700,000 の外・本人が下ろした人（pay_hidden）・テスト用アカウント（pv_test_users）。
--   1人 × 会社 × 職位で1件 … created_at がいちばん新しいもの。
--   区分の数字            … ドルを円に戻した値（usd × USD の to_jpy ÷ 10000 ＝ 万円）の中央値
--                           （偶数なら真ん中2つの平均）を整数に丸める（.5 は上へ ＝ 道具の Math.round と同じ）。
--
-- ── 道具と違うところ（2つ・どちらも会社ページの数字には出ない）──────────
--   ① 打ち込まれた社名がどの会社にも当たらない行（pv_airline_resolve が 'other' を返す）は捨てる。
--      道具は 'other' という1つの区分にまとめていた（別々の会社の人が1つの数字に混ざる＝会社ページに出し先が無い）。
--      db/pay-median.sql の約束 9 と同じ扱い。
--   ② 同じ人の同じ時刻の2行（引き取りで同じ取引に入った月など）は、給与の月が新しいほう → 行の id で1つに決める
--      （道具は読んだ順の先頭＝決まっていなかった）。
--
-- ── 守っている約束 ────────────────────────────────────────
--  1. 数えるのは書き込みのときだけ。読む関数（pv_member_medians）は表を1行ずつ引くだけで、何も数えない。
--  2. 人数を外へ出さない。表には n を持つが、表は誰にも読ませない（RLS 有効・ポリシー無し・grant 無し）。
--     pv_member_medians は n ≥ 2 の区分だけを返し、返す列は rank と median_man の2つだけ。
--  3. 数え直しが失敗しても、給与・口コミの書き込みは止めない（引き金が例外を握って warning にする。
--     表は前の中身のまま残る＝ページは1つ前の数字を出し続ける）。
--  4. 数え直しは1本ずつ（表を exclusive で握る）。同時に2件出ても、後の1本は前の結果を見てから作り直す
--     （読む側は止まらない。exclusive は select を止めない）。
--  5. 口コミの表の翻訳など、数字に関係しない列の update では数え直さない（引き金は列を名指しする）。
--  6. 会員を名指しで書かない（uid・氏名・メールをこのファイルに書かない）。
--
-- ★ CLAUDE.md の「会員だけが見られるものを返す関数を新しく作ったら pv_proof_blocked の1行を足す」は
--   **この関数は対象外**。pv_member_medians は誰でも見られる集計（会社ページに未ログインでも出る数字）で、
--   1人ずつの値も人数も返さない。止めた会員にだけ閉じる意味が無い。
--
-- ⚠️ 直近24か月の窓は「数え直したとき」に動く。書き込みが何日も無ければ、24か月を過ぎた行が
--    次の書き込みまで残る（1日に何件も出る今は実害なし。気になれば SQL Editor で
--    select public.pv_member_median_refresh(); を1回流す）。
-- ⚠️ 同じ線の写し（直すときは一緒に）
--     年収の常識の幅（1万〜70万ドル）  … db/pay-rows.sql ・ db/deep-pay.sql ・ db/pay-median.sql と同じ
--     給与の鍵の式                       … db/pay-reports.sql 5章（submit_pay_report の v_hash）
--     口コミの鍵の式                     … db/pay-rows.sql 1-d（pv_review_person）
--     職位の読み替え・年額の作り方       … 手元の道具 member-median.mjs（db/test-member-median.mjs が同じ規則の写しで突き合わせる）
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.pay_reports') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports の表が無い）';
  end if;
  if to_regclass('public.reviews_v2') is null then
    raise exception '口コミの表（public.reviews_v2）がありません';
  end if;
  if to_regclass('public.fx_rates') is null then
    raise exception '先に db/vocab.generated.sql を実行してください（fx_rates の表が無い）';
  end if;
  if to_regclass('public.pay_hidden') is null
     or to_regclass('public.pv_review_person') is null
     or to_regprocedure('public.pv_airline_resolve(text)') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pay_hidden / pv_review_person / pv_airline_resolve が無い）';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. pv_test_users — 動作確認用のテストアカウント（中央値から外す）
--    中身はオーナーが SQL Editor で入れる。リポジトリに uid を書かない。
--    RLS 有効・ポリシー無し・grant 無し＝ security definer の数え直しの中からしか読めない。
-- ════════════════════════════════════════════════════════════════
create table if not exists public.pv_test_users (
  uid uuid primary key
);
alter table public.pv_test_users enable row level security;
revoke all on table public.pv_test_users from public, anon, authenticated;
comment on table public.pv_test_users is
  '動作確認用のテストアカウント（auth.users の id）。会員の中央値（pv_member_median）から外す。'
  '中身はオーナーが SQL Editor で入れる（リポジトリに uid を書かない）。誰にも読ませない。';


-- ════════════════════════════════════════════════════════════════
-- 2. pv_member_median — 会社 × 職位の中央値（万円）と人数
--    作るのは pv_member_median_refresh() だけ。読むのは pv_member_medians() だけ。
-- ════════════════════════════════════════════════════════════════
create table if not exists public.pv_member_median (
  airline    text    not null,
  rank       text    not null check (rank in ('cap', 'fo')),
  median_man integer not null,
  n          integer not null,
  updated_at timestamptz not null default now(),
  primary key (airline, rank)
);
alter table public.pv_member_median enable row level security;
revoke all on table public.pv_member_median from public, anon, authenticated;
comment on table public.pv_member_median is
  '会員が出した年収の中央値（会社 × 機長／副操縦士・万円）と人数。給与・口コミの書き込みの引き金が丸ごと作り直す。'
  '誰にも読ませない（人数を外へ出さない）。外へ出すのは pv_member_medians() の n ≥ 2 の区分の中央値だけ。';


-- ════════════════════════════════════════════════════════════════
-- 3. pv_member_median_refresh() — 表の中身を丸ごと作り直す
--    呼ぶのは下の引き金（と、ファイルの最後の1回）だけ。誰にも実行させない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_member_median_refresh()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_from timestamptz := now() - interval '24 months';
begin
  -- 1本ずつ（同時に来た後の1本は、前の1本が終わってから新しい中身を見て作り直す）。select は止めない。
  lock table public.pv_member_median in exclusive mode;

  delete from public.pv_member_median where true;

  insert into public.pv_member_median (airline, rank, median_man, n, updated_at)
  with
  fx as (
    select (select f.to_usd from public.fx_rates f where f.code = 'JPY') as jpy_usd,   -- 口コミの万円 → ドル
           (select f.to_jpy from public.fx_rates f where f.code = 'USD') as usd_jpy    -- ドル → 円（道具の JPY_PER.USD）
  ),
  -- 給与：年収がある・直近24か月・テスト用アカウントでない（この3つを通った行の鍵が「給与を出した人」）
  pay as (
    select 'r:' || p.proof_hash as pkey, p.airline, p.airline_other, p."position" as pos,
           p.annual_total_usd::numeric as usd, p.created_at,
           p.period_year * 100 + p.period_month as per, p.id::text as rid
      from public.pay_reports p
     where p.annual_total_usd is not null
       and p.created_at >= v_from
       and not exists (select 1 from public.pv_test_users t   -- ★テスト用アカウント（給与）
                        where encode(extensions.digest(t.uid::text || '::pv_pay::' || p.airline || coalesce('::' || lower(p.airline_other), ''), 'sha256'), 'hex') = p.proof_hash)
  ),
  -- 口コミ：人の鍵が取れる・直近24か月・給与を出した人でない・テスト用アカウントでない
  rv as (
    select l.pkey, v.airline, v."position" as pos, v.created_at, v.id::text as rid,
           coalesce(nullif(v.annual_salary, 0)::numeric,
                    case when nullif(v.base_annual, 0) is not null or nullif(v.flight_allowance_annual, 0) is not null
                         then coalesce(v.base_annual, 0)::numeric + coalesce(v.flight_allowance_annual, 0) + coalesce(v.bonus, 0) end,
                    case when nullif(v.monthly_salary, 0) is not null
                         then v.monthly_salary::numeric * 12 + coalesce(v.bonus, 0) end) as man
      from public.reviews_v2 v
      join public.pv_review_person l on l.review_id = v.id
     where v.created_at >= v_from
       and not exists (select 1 from pay s where s.pkey = l.pkey)
       and not exists (select 1 from public.pv_test_users t   -- ★テスト用アカウント（口コミ）
                        where encode(extensions.digest(t.uid::text || '::pv_anon::' || v.airline || '::2026', 'sha256'), 'hex') = v.proof_hash)
  ),
  -- 社名を会社コードへ（同じ字は1回だけ引く）。どこにも当たらない（'other'）なら捨てる
  names as materialized (
    select distinct nm from (
      select p.airline_other as nm from pay p where p.airline = 'other'
      union all
      select v.airline from rv v) x
     where nm is not null
  ),
  res as materialized (
    select n.nm, nullif(public.pv_airline_resolve(n.nm), 'other') as code from names n
  ),
  cand as (
    select p.pkey, p.airline as air, p.pos, p.usd, p.created_at, p.per, p.rid
      from pay p where p.airline <> 'other'
    union all
    select p.pkey, r.code, p.pos, p.usd, p.created_at, p.per, p.rid
      from pay p join res r on r.nm = p.airline_other where p.airline = 'other'
    union all
    select v.pkey, r.code, v.pos, v.man * 10000 * f.jpy_usd, v.created_at, null, v.rid
      from rv v join res r on r.nm = v.airline cross join fx f
     where v.man is not null and f.jpy_usd is not null
  ),
  ok as (
    select c.pkey, c.air, c.usd, c.created_at, c.per, c.rid,
           case c.pos when 'captain' then 'cap' when 'cap' then 'cap' when 'tri_tre' then 'cap'
                      when 'fo' then 'fo' when 'sfo' then 'fo' end as rank
      from cand c
     where c.air is not null
       and c.usd between 10000 and 700000
       and not exists (select 1 from public.pay_hidden h where 'r:' || h.proof_hash = c.pkey)
  ),
  latest as (
    select distinct on (o.pkey, o.air, o.rank) o.air, o.rank, o.usd
      from ok o
     where o.rank is not null
     order by o.pkey, o.air, o.rank, o.created_at desc, o.per desc nulls last, o.rid desc
  ),
  vals as (
    select l.air, l.rank, l.usd * f.usd_jpy / 10000 as man,
           row_number() over (partition by l.air, l.rank order by l.usd) as i,
           count(*)     over (partition by l.air, l.rank)                as n
      from latest l cross join fx f
  )
  select v.air, v.rank, floor(avg(v.man) + 0.5)::int, v.n::int, now()
    from vals v
   where v.i in ((v.n + 1) / 2, (v.n + 2) / 2)
   group by v.air, v.rank, v.n
  having avg(v.man) is not null;
end;
$fn$;

revoke all on function public.pv_member_median_refresh() from public, anon, authenticated;
comment on function public.pv_member_median_refresh() is
  '会員の中央値の表（pv_member_median）を丸ごと作り直す。数え方は手元の道具 member-median.mjs と同じ。'
  '呼ぶのは書き込みの引き金だけ（誰にも実行させない＝外から何度も呼んで重くさせない）。';


-- ════════════════════════════════════════════════════════════════
-- 4. pv_member_medians(p_airline) — 会社ページが読む口（表を引くだけ・何も数えない）
--    n ≥ 2 の区分だけ。n は返さない（人数を外へ出さない）。誰でも呼べる。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_member_medians(p_airline text)
returns table (rank text, median_man integer)
language sql
stable
security definer
set search_path = public
as $fn$
  select m.rank, m.median_man
    from public.pv_member_median m
   where m.airline = p_airline
     and m.n >= 2
   order by m.rank;
$fn$;

revoke all on function public.pv_member_medians(text) from public, anon, authenticated;
grant execute on function public.pv_member_medians(text) to anon, authenticated;
comment on function public.pv_member_medians(text) is
  '会社ページの「会員が出した年収の中央値」（万円）。2人以上の区分だけ・返すのは職位と中央値の2つだけ（人数は返さない）。'
  '表を引くだけで何も数えない（数えるのは書き込みの引き金）。誰でも見られる集計なので pv_proof_blocked は呼ばない。';


-- ════════════════════════════════════════════════════════════════
-- 5. 引き金 — 書き込みのあと（1文に1回）数え直す。失敗しても書き込みは止めない
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_member_median_trg()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $fn$
begin
  begin
    perform public.pv_member_median_refresh();
  exception when others then
    -- 書き込みは通す。表は前の中身のまま（この begin の中の変更だけが巻き戻る）
    raise warning 'pv_member_median_refresh に失敗しました（書き込みはそのまま通します）: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end;
$fn$;

revoke all on function public.pv_member_median_trg() from public, anon, authenticated;
comment on function public.pv_member_median_trg() is
  '給与・口コミ・下ろした人・対応表・テスト用アカウントの書き込みのあとに pv_member_median_refresh() を呼ぶ。'
  '数え直しが失敗しても warning にするだけで、書き込みは止めない。';

-- 給与：数字に関わる列の update だけ（verify_level などの書き換えでは数え直さない）
drop trigger if exists trg_pv_member_median on public.pay_reports;
create trigger trg_pv_member_median
  after insert or delete
        or update of proof_hash, airline, airline_other, "position", annual_total_usd, created_at
  on public.pay_reports
  for each statement execute function public.pv_member_median_trg();

-- 口コミ：数字に関わる列の update だけ（翻訳・要約の書き込みでは数え直さない）
drop trigger if exists trg_pv_member_median on public.reviews_v2;
create trigger trg_pv_member_median
  after insert or delete
        or update of proof_hash, airline, "position", created_at,
                     annual_salary, base_annual, flight_allowance_annual, monthly_salary, bonus
  on public.reviews_v2
  for each statement execute function public.pv_member_median_trg();

drop trigger if exists trg_pv_member_median on public.pay_hidden;
create trigger trg_pv_member_median
  after insert or update or delete on public.pay_hidden
  for each statement execute function public.pv_member_median_trg();

drop trigger if exists trg_pv_member_median on public.pv_review_person;
create trigger trg_pv_member_median
  after insert or update or delete on public.pv_review_person
  for each statement execute function public.pv_member_median_trg();

drop trigger if exists trg_pv_member_median on public.pv_test_users;
create trigger trg_pv_member_median
  after insert or update or delete on public.pv_test_users
  for each statement execute function public.pv_member_median_trg();


-- ════════════════════════════════════════════════════════════════
-- 6. いまの中身で1回数え直す
-- ════════════════════════════════════════════════════════════════
select public.pv_member_median_refresh();


-- 検算（貼ったあとに出る10行。全部 ✅ が正しい。★「貼れた」は証拠にならない。この10行を読む）
-- 10行目だけは ⚠️ がありうる（テスト用アカウントをまだ入れていない＝ 上の insert を流す）。
with d as (select pg_get_functiondef('public.pv_member_median_refresh()'::regprocedure) as s),
     r as (select pg_get_functiondef('public.pv_member_medians(text)'::regprocedure) as s),
     g as (select pg_get_functiondef('public.pv_member_median_trg()'::regprocedure) as s)
select 1 as no, '2つの表は RLS 有効・ポリシー無し' as 検算,
       case when (select bool_and(c.relrowsecurity) from pg_class c
                   where c.oid in ('public.pv_member_median'::regclass, 'public.pv_test_users'::regclass))
             and not exists (select 1 from pg_policies p
                              where p.schemaname = 'public' and p.tablename in ('pv_member_median', 'pv_test_users'))
            then '✅' else '❌' end as 結果
union all select 2, '未ログイン・ログイン済みとも2つの表を直接読めない',
       case when not has_table_privilege('anon', 'public.pv_member_median', 'select')
             and not has_table_privilege('authenticated', 'public.pv_member_median', 'select')
             and not has_table_privilege('anon', 'public.pv_test_users', 'select')
             and not has_table_privilege('authenticated', 'public.pv_test_users', 'select')
            then '✅' else '❌' end
union all select 3, '読む口（pv_member_medians）は未ログインもログイン済みも呼べる',
       case when has_function_privilege('anon', 'public.pv_member_medians(text)', 'execute')
             and has_function_privilege('authenticated', 'public.pv_member_medians(text)', 'execute')
            then '✅' else '❌' end
union all select 4, '読む口が返すのは職位と中央値の2つだけ（人数を返さない）・2人以上だけ',
       case when pg_get_function_result('public.pv_member_medians(text)'::regprocedure) = 'TABLE(rank text, median_man integer)'
             and (select s from r) like '%m.n >= 2%'
            then '✅' else '❌' end
union all select 5, '読む口は表を引くだけ（給与・口コミの表を読まない＝開くたびに数えない）',
       case when (select s from r) not like '%pay_reports%' and (select s from r) not like '%reviews_v2%'
             and (select s from r) not like '%refresh%'
            then '✅' else '❌' end
union all select 6, '数え直しは誰にも実行させない（PUBLIC・未ログイン・ログイン済み）',
       case when not has_function_privilege('anon', 'public.pv_member_median_refresh()', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_member_median_refresh()', 'execute')
             and not exists (select 1 from pg_proc q, lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
                              where q.oid = 'public.pv_member_median_refresh()'::regprocedure
                                and a.grantee = 0 and a.privilege_type = 'EXECUTE')
            then '✅' else '❌' end
union all select 7, '引き金が5つの表に付いている（給与・口コミ・下ろした人・対応表・テスト用アカウント）',
       case when (select count(*) from pg_trigger t
                   where t.tgname = 'trg_pv_member_median' and not t.tgisinternal
                     and t.tgrelid in ('public.pay_reports'::regclass, 'public.reviews_v2'::regclass,
                                       'public.pay_hidden'::regclass, 'public.pv_review_person'::regclass,
                                       'public.pv_test_users'::regclass)) = 5
            then '✅' else '❌' end
union all select 8, '数え直しが失敗しても書き込みは止めない（引き金が例外を握る）',
       case when (select s from g) like '%exception when others then%' and (select s from g) like '%raise warning%'
            then '✅' else '❌' end
union all select 9, 'テスト用アカウントを給与・口コミの両方で外している',
       case when (select s from d) like '%pv_test_users t   -- ★テスト用アカウント（給与）%'
             and (select s from d) like '%pv_test_users t   -- ★テスト用アカウント（口コミ）%'
             and (select s from d) like '%''::pv_pay::''%' and (select s from d) like '%''::pv_anon::''%'
            then '✅' else '❌' end
union all select 10, 'テスト用アカウントの名簿 ' || (select count(*) from public.pv_test_users) || ' 人'
                     || '・中央値の表 ' || (select count(*) from public.pv_member_median) || ' 区分',
       case when (select count(*) from public.pv_test_users) > 0 then '✅'
            else '⚠️ 0人（テスト用アカウントの uid を pv_test_users に入れる）' end
order by 1;
