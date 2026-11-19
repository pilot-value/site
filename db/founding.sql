-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/founding.sql
--
-- FOUNDING PILOT 100（創設メンバー）。
-- 「給与レポートか口コミを最初に出した100人」に、一生変わらない通し番号を渡す。
--
-- ★ このファイルは自動では流れない。オーナーの明示承認後に SQL Editor で実行する。
-- ★ 先に db/pay-reports.sql を流すこと（pay_reports にトリガを付ける）。
-- 冪等（何度流しても安全）。
--
-- ── なぜ登録順ではなく「出した順」なのか ────────────────────
-- VISION.md の North Star は「月間の一次データ投稿数」で、PV や会員数より
-- 優先すると明記してある。登録しただけの人に番号を配ると、その優先順位を
-- 自分で裏切ることになる。それに profiles.created_at は移行でまとめて作られた
-- 行があり、登録日として使えない（db/usage.mjs:43）。
-- 「最初に出した時刻」なら reviews_v2 / pay_reports の created_at に実在する。
--
-- ── この設計が守っている約束 ────────────────────────────────
--  1. **番号は付与した時点で凍結する。** その場で数え直す方式だと、誰かが
--     退会したときに全員の番号がずれる。それは称号ではない。
--  2. **本人は自分の番号を書けない。** 表への insert / update / delete は
--     ポリシーを1本も作らない＝書けるのは下の security definer 関数だけ。
--     ★ profiles に列を足す案は却下した。db/admin.sql:81 が
--       `grant select, insert, update on public.profiles to authenticated`
--       を列単位の制限なしで出しているので、本人が自分を1番に書き換えられる。
--  3. **profiles.badge を使わない。** あちらは「検証を通したときだけ上げる」と
--     コメントに書いてある列（db/pay-reports.sql:328）。投稿の早さで上げると
--     Verified Pilot の約束が壊れる。称号は別の軸として別の表に持つ。
--  4. **人数・残り枠数をどこにも出さない。** my_founding が返すのは自分の番号
--     だけ。「残り86枠」を出すと会員数が外から分かる（db/referrals.sql:19 と同じ）。
--  5. **称号のために投稿を落とさない。** トリガの中で何が起きても投稿は通す
--     （下の 3. の exception を読むこと）。一次データのほうが称号より重い。
--
-- ── 意図的に作っていないもの ────────────────────────────────
--  ・ランキング／一覧／「あなたは何番目に早かった」の比較
--  ・口コミカードや給与レポートへの称号表示（母集団が小さく、特定に近づく）
--  ・番号の取り消し・付け替えの画面（要るならオーナーが SQL で消す）
-- ════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'profiles がありません。先に db/schema-additions.sql を実行してください';
  end if;
  if to_regclass('public.pay_reports') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports が無い）';
  end if;
  if to_regclass('public.reviews_v2') is null then
    raise exception 'reviews_v2 がありません（口コミの表）';
  end if;
  -- ★2026-11-19 保留中の口コミでは付けない（下の 5-b）。保留の表と判定は db/reviews-gate.sql に在る。
  if to_regprocedure('public.pv_review_held(text, uuid)') is null
     or to_regclass('public.pv_review_judge') is null then
    raise exception '先に db/reviews-gate.sql を実行してください（pv_review_held / pv_review_judge が無い）';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. 名簿
--
-- ★ no は unique。1〜100 の check があるので、101人目は入らない
--   （関数側でも止めるが、効いているのはこちら）。
-- ★ awarded_at は「番号を渡した時刻」ではなく「最初に出した時刻」を入れる。
--   遡って振ったぶん（backfill）も、その人が実際に出した日が残る。
-- ════════════════════════════════════════════════════════════════
create table if not exists public.founding_members (
  -- ★ 主キーは番号のほう。user_id ではない。
  --   退会したら user_id だけ null に落ちて、行（＝番号）は残る。
  --   こうしないと「いちばん大きい番号の人が退会すると、その番号が次の人に
  --   渡る」。No.14 を名乗る人が時期をずらして2人いる称号は、称号ではない。
  --   残るのは番号・review|pay・日付だけで、誰だったかは1文字も残らない。
  no           int  primary key check (no between 1 and 100),
  user_id      uuid unique references public.profiles(id) on delete set null,
  first_source text not null check (first_source in ('review', 'pay')),
  awarded_at   timestamptz not null default now()
);

comment on table public.founding_members is
  'FOUNDING PILOT 100。給与レポートか口コミを最初に出した100人の通し番号。'
  '番号は付与した時点で凍結する（誰かが退会しても他の人の番号は動かない）。'
  '★本人は書けない。書くのは pv_award_founding と pv_backfill_founding だけ。';
comment on column public.founding_members.no is
  '1〜100。一生変わらない。退会しても行は残る＝番号は二度と使い回されない。';
comment on column public.founding_members.user_id is
  '退会すると null になる（行は残る）。null の行は RLS のせいで誰にも読めない。';
comment on column public.founding_members.first_source is
  'review | pay。どちらで番号が入ったか。金額も社名も持たない。';


-- ════════════════════════════════════════════════════════════════
-- 2. 権限：読めるのは自分の1行だけ。書く道は無い。
-- ════════════════════════════════════════════════════════════════
alter table public.founding_members enable row level security;

revoke all on public.founding_members from anon, authenticated;
grant select on public.founding_members to authenticated;

-- 既に作ってしまったポリシーがあれば落とす（冪等・事故防止）
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'founding_members' loop
    execute format('drop policy %I on public.founding_members', p.policyname);
  end loop;
end $$;

-- SELECT だけ。INSERT / UPDATE / DELETE のポリシーは作らない。
-- ★ここに update を1本足すと、本人が自分の番号を 1 に書き換えられる。
create policy founding_select_self on public.founding_members
  for select to authenticated using (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- 3. 付与（トリガ）
--
-- 口コミは submit-review.html:1284 が画面から reviews_v2 へ直接 insert していて
-- RPC を通らない。だから RPC にフックできない＝トリガでしか拾えない。
-- 給与側もトリガにしておけば submit_pay_report と claim_pending_report の
-- 両方を1か所で捉えられる（どちらの本体も1行も触らない）。
--
-- ★ 例外を握りつぶしている。称号の付与に失敗しても、投稿そのものは通す。
--   一次データはこの事業の資産で、称号はその飾り。飾りのために資産を
--   落とすことは絶対にしない。
-- ★ 同じ月の出し直しは on conflict do update なので INSERT トリガは鳴らない
--   （＝1人が何度出しても番号は1つ）。
-- ★ 番号を振るのは pv_founding_grant の1か所だけ（2026-11-19 に切り出した。
--   保留が解けた口コミで付け直す 5-b も同じものを呼ぶ＝採番の書き方が2つにならない）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_founding_grant(p_uid uuid, p_src text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_max int;
begin
  if p_uid is null then
    return;
  end if;

  -- ロックを取る前に一度見る。ほとんどの投稿は既に番号を持つ人か満枠なので、
  -- そのときはロックを取らずに抜ける（毎回の投稿を直列化しない）。
  if exists (select 1 from public.founding_members where user_id = p_uid) then
    return;
  end if;

  -- ここから先は1本ずつ通す。番号の採番が同時に走ると同じ番号が2人に出る。
  perform pg_advisory_xact_lock(8093311477);

  -- ロックを取ってからもう一度見る（取る前の判定は同時実行でずれている）。
  if exists (select 1 from public.founding_members where user_id = p_uid) then
    return;
  end if;

  -- ★ count(*) ではなく max(no)。行を消したときに番号を使い回さない。
  select coalesce(max(no), 0) into v_max from public.founding_members;
  if v_max >= 100 then
    return;                            -- 101人目。黙って何もしない（例外にしない）
  end if;

  -- profiles 行が無い人（トリガーの取りこぼし）でも詰まらせない。
  insert into public.profiles (id) values (p_uid) on conflict (id) do nothing;

  insert into public.founding_members (user_id, no, first_source, awarded_at)
  values (p_uid, v_max + 1, coalesce(p_src, 'pay'), now())
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.pv_founding_grant(uuid, text) from public, anon, authenticated;

create or replace function public.pv_award_founding()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return null;                       -- サーバ側の手作業（service_role）では付けない
  end if;
  perform public.pv_founding_grant(v_uid, coalesce(tg_argv[0], 'pay'));
  return null;
exception when others then
  -- 称号のために投稿を落とさない。
  return null;
end;
$$;

comment on function public.pv_award_founding() is
  'FOUNDING PILOT 100 の付与トリガ。tg_argv[0] が review | pay。'
  '既に番号がある人・満枠のときは黙って何もしない。'
  '★何が起きても投稿そのものは通す（例外を握りつぶしている）。';

drop trigger if exists pv_founding_on_review on public.reviews_v2;
create trigger pv_founding_on_review
  after insert on public.reviews_v2
  for each row execute function public.pv_award_founding('review');

drop trigger if exists pv_founding_on_pay on public.pay_reports;
create trigger pv_founding_on_pay
  after insert on public.pay_reports
  for each row execute function public.pv_award_founding('pay');


-- ════════════════════════════════════════════════════════════════
-- 4. my_founding — 自分の番号を取る
--
-- ★ 引数を取らない＝他人の番号を引く窓口が無い。
-- ★ 総数も残り枠も返さない。返すのは自分の no（無ければ null）だけ。
-- ════════════════════════════════════════════════════════════════
create or replace function public.my_founding()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_no  int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select no into v_no from public.founding_members where user_id = v_uid;

  return jsonb_build_object('ok', true, 'no', v_no);
end;
$$;

revoke all on function public.my_founding() from public, anon;
grant execute on function public.my_founding() to authenticated;

comment on function public.my_founding() is
  '自分の FOUNDING PILOT 100 番号。無ければ no は null。'
  '★総数・残り枠・他人の番号は返さない。引数を取らないので他人の分は引けない。';


-- ════════════════════════════════════════════════════════════════
-- 5. pv_backfill_founding — もう出してくれている人へ遡って振る
--
-- 口コミも給与レポートも user_id を持たない（本人が特定されない設計）。
-- 繋がりは proof_hash だけで、式に秘密の塩が入っていないのでサーバ側で作り直せる。
--   給与    sha256(uid || '::pv_pay::'  || airline [|| '::' || lower(airline_other)])
--           … db/pay-reports.sql:682
--   口コミ  sha256(uid || '::pv_anon::' || airline || '::2026')
--           … submit-review.html:1186
--
-- ★ 動作確認用のアカウントは p_exclude で外す。実在のアドレスはこのリポジトリに
--   書けない（PUBLIC）ので、uuid の並びは `node db/usage.mjs --founding` が出す。
-- ★ 冪等。すでに番号がある人は触らない＝何度流しても結果が変わらない。
-- ★ profiles × 投稿の総当たりでハッシュを作る。一度きりの遡り用で、日常の付与は
--   上のトリガがやる（こちらを cron に載せない）。
-- ★ 口コミは航空会社コードを付け替えた移行（db/migrate-airline-codes.sql）より
--   前の行だと hash が旧コードのままで一致しない。そのぶんは拾えない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_backfill_founding(p_exclude uuid[] default '{}'::uuid[])
returns table (no int, first_source text, first_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_max int;
begin
  perform pg_advisory_xact_lock(8093311477);
  select coalesce(max(fm.no), 0) into v_max from public.founding_members fm;

  with hits as (
    select p.id as uid, r.created_at as at, 'review'::text as src
      from public.profiles p
      join public.reviews_v2 r
        on r.proof_hash = encode(extensions.digest(
             p.id::text || '::pv_anon::' || r.airline || '::2026', 'sha256'), 'hex')
     where not (p.id = any(coalesce(p_exclude, '{}'::uuid[])))
    union all
    select p.id, r.created_at, 'pay'::text
      from public.profiles p
      join public.pay_reports r
        on r.proof_hash = encode(extensions.digest(
             p.id::text || '::pv_pay::' || r.airline
             || coalesce('::' || lower(r.airline_other), ''), 'sha256'), 'hex')
     where not (p.id = any(coalesce(p_exclude, '{}'::uuid[])))
  ),
  firsts as (
    -- 人ごとに「最初の1件」だけ残す
    select distinct on (h.uid) h.uid, h.at, h.src
      from hits h
     where not exists (select 1 from public.founding_members m where m.user_id = h.uid)
     order by h.uid, h.at asc, h.src asc
  ),
  ranked as (
    -- 出した順。同時刻は uuid 順（db/usage.mjs --founding と同じ決め方）
    select f.uid, f.at, f.src,
           (v_max + row_number() over (order by f.at asc, f.uid asc))::int as n
      from firsts f
  )
  insert into public.founding_members (user_id, no, first_source, awarded_at)
  select r.uid, r.n, r.src, r.at
    from ranked r
   where r.n <= 100
  on conflict (user_id) do nothing;

  return query
    select fm.no, fm.first_source, fm.awarded_at
      from public.founding_members fm
     order by fm.no;
end;
$$;

revoke all on function public.pv_backfill_founding(uuid[]) from public, anon, authenticated;

comment on function public.pv_backfill_founding(uuid[]) is
  'すでに出してくれている人へ遡って番号を振る。オーナーが1度だけ手で流す。'
  '冪等（すでに番号がある人は触らない）。誰にも grant しない。';


-- ════════════════════════════════════════════════════════════════
-- 5-b. 保留中の口コミでは付けない（2026-11-19 オーナー決定「保留が解けたときだけ付ける」）
--
-- 口コミの保留は、口コミが入った**数秒後**に translate-review が pv_review_judge に書く
-- （db/reviews-gate.sql 3-c）。上の INSERT の引き金の時点では、どの口コミもまだ保留ではない。
-- だから付けるのは今までどおり INSERT のとき。判定の表に引き金を置いて、
--   保留になった瞬間 … その人に「数えるもの」が残っていなければ外す
--   保留が解けた瞬間（運営が「出す」・判定し直して ok）… 番号が無ければ付ける（100まで）
-- 数えるもの ＝ 給与（pay_reports）か、保留中でない口コミ（pv_review_held の1か所で決める）。
-- ★給与を出した人は、口コミが保留になっても外れない（オーナー「給与提出した人にも出して」）。
-- ★判定に失敗して行が無い口コミは保留ではない＝今までどおり付いたまま。
-- ★外した番号がいちばん大きい番号なら、次の人がそのまま使う（max(no)+1）。途中なら欠番になる
--   （番号は本人にも見せないので困らない）。
-- ★運営が「消す」にした口コミは、判定の表に答えを書く前に行ごと消える＝誰の口コミか分からない。
--   その人の称号は、保留になった時点で（数えるものが無ければ）もう外れている。
-- ★書いた人は profiles × proof_hash で探す（pv_backfill_founding と同じ手）。判定を書くときだけ走る。
-- ★何が起きても判定の書き込みは通す（例外を握りつぶす。称号のために保留を落とさない）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_founding_review_author(p_rid uuid)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  select p.id
    from public.reviews_v2 r
    join public.profiles p on r.proof_hash = public.pv_review_hash(p.id, r.airline)
   where r.id = p_rid
   limit 1
$fn$;

revoke all on function public.pv_founding_review_author(uuid) from public, anon, authenticated;

-- その人に、称号の元になる投稿が残っているか（給与か、保留中でない口コミ）。
create or replace function public.pv_founding_counts(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  select exists (
           select 1 from public.pay_reports r
            where r.proof_hash = encode(extensions.digest(
                    p_uid::text || '::pv_pay::' || r.airline
                    || coalesce('::' || lower(r.airline_other), ''), 'sha256'), 'hex'))
      or exists (
           select 1 from public.reviews_v2 r
            where r.proof_hash = public.pv_review_hash(p_uid, r.airline)
              and not public.pv_review_held('r', r.id))
$fn$;

revoke all on function public.pv_founding_counts(uuid) from public, anon, authenticated;

-- 数え直す。p_may_grant = true のときだけ付ける側にも動く（保留が解けたときだけ）。
-- ★付ける側を「保留が解けたとき」に絞るのは、運営が SQL で外した番号（試験用の口座など）を
--   口コミの判定し直しのたびに生き返らせないため。
create or replace function public.pv_founding_recheck(p_uid uuid, p_may_grant boolean)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_uid is null then
    return;
  end if;
  if public.pv_founding_counts(p_uid) then
    if p_may_grant then
      perform public.pv_founding_grant(p_uid, 'review');
    end if;
  else
    delete from public.founding_members where user_id = p_uid;
  end if;
end;
$$;

revoke all on function public.pv_founding_recheck(uuid, boolean) from public, anon, authenticated;

create or replace function public.pv_founding_on_judge()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_now  boolean := new.verdict = 'hold' and new.decided is null;
  v_was  boolean := tg_op = 'UPDATE' and old.verdict = 'hold' and old.decided is null;
begin
  if new.src <> 'r' or v_now = v_was then
    return null;                       -- 預かり（q）は会員ではない・保留の状態が変わっていない
  end if;
  perform public.pv_founding_recheck(public.pv_founding_review_author(new.rid), not v_now);
  return null;
exception when others then
  return null;                         -- 称号のために判定の書き込みを落とさない
end;
$$;

revoke all on function public.pv_founding_on_judge() from public, anon, authenticated;

drop trigger if exists pv_founding_on_judge on public.pv_review_judge;
create trigger pv_founding_on_judge
  after insert or update on public.pv_review_judge
  for each row execute function public.pv_founding_on_judge();

-- いま保留中の口コミで付いてしまった分を直す（2026-11-16〜この貼り付けまでの分）。
-- 同じ数え直しを呼ぶだけ＝何度流しても同じ。付ける側には動かない。
do $$
declare r record;
begin
  for r in select j.rid from public.pv_review_judge j
            where j.src = 'r' and j.verdict = 'hold' and j.decided is null loop
    perform public.pv_founding_recheck(public.pv_founding_review_author(r.rid), false);
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 6. 自己点検（読むだけ。何も書き換えない）
--
-- ★1本の SELECT にしてある。Supabase の SQL Editor は複数文を流すと
--   最後の1本の結果しか出さないので、分けて書くと上から順に消えていく。
-- 期待：12行すべて ✅。1つでも ❌ なら、そこが効いていない。
--
-- 特に 3・4 は「静かに壊れる」種類のもの。update を1本開けただけで、
-- 本人が自分の番号を 1 に書き換えられるようになり、画面には何も出ない。
-- ════════════════════════════════════════════════════════════════
with f as (
  select to_regclass('public.founding_members')                 as t,
         to_regprocedure('public.my_founding()')                as f_my,
         to_regprocedure('public.pv_award_founding()')          as f_aw,
         to_regprocedure('public.pv_backfill_founding(uuid[])') as f_bf
)
select n as "#", case when ok then '✅' else '❌' end as 結果, 見るところ
from (
  select 1 as n, '名簿の表がある' as 見るところ, (t is not null) as ok from f
  union all
  select 2, '3つの関数がそろっている',
         (f_my is not null and f_aw is not null and f_bf is not null) from f
  union all
  select 3, '本人は自分の番号を書き換えられない（insert/update/delete の権限が無い）',
         case when t is null then false else
           not has_table_privilege('authenticated', t, 'insert')
       and not has_table_privilege('authenticated', t, 'update')
       and not has_table_privilege('authenticated', t, 'delete') end from f
  union all
  select 4, '読めるのは自分の1行だけ（RLS 有効・SELECT のポリシーが1本）',
         case when t is null then false else
           (select c.relrowsecurity from pg_class c where c.oid = f.t)
       and (select count(*) from pg_policies
             where schemaname='public' and tablename='founding_members') = 1
       and (select bool_and(cmd = 'SELECT') from pg_policies
             where schemaname='public' and tablename='founding_members') end from f
  union all
  select 5, '登録していない人は名簿にも関数にも触れない',
         case when t is null or f_my is null then false else
           not has_table_privilege('anon', t, 'select')
       and not has_function_privilege('anon', f_my, 'execute') end from f
  union all
  select 6, 'ログインした人は自分の番号を取れる',
         case when f_my is null then false
              else has_function_privilege('authenticated', f_my, 'execute') end from f
  union all
  select 7, '遡って振る関数は誰にも渡っていない（オーナーが手で流すだけ）',
         case when f_bf is null then false else
           not has_function_privilege('anon',          f_bf, 'execute')
       and not has_function_privilege('authenticated', f_bf, 'execute') end from f
  union all
  select 8, '自分の番号を返す関数は引数を取らない（他人の番号を引けない）',
         case when f_my is null then false
              else (select p.pronargs from pg_proc p where p.oid = f.f_my) = 0 end from f
  union all
  select 9, '返り値に総数・残り枠が入っていない',
         case when f_my is null then false else
           pg_get_functiondef(f.f_my) not like '%count(%'
       and pg_get_functiondef(f.f_my) not like '%remaining%' end from f
  union all
  select 11, '退会しても番号は残る（user_id は set null。番号を使い回さない）',
         exists (select 1 from information_schema.referential_constraints rc
                  join information_schema.key_column_usage k
                    on k.constraint_name = rc.constraint_name
                 where k.table_schema='public' and k.table_name='founding_members'
                   and k.column_name='user_id' and rc.delete_rule='SET NULL') from f
  union all
  select 12, '保留中の口コミでは付けない（判定の表に引き金がある・数え直しの関数は誰にも渡っていない）',
         exists (select 1 from pg_trigger
                  where tgname = 'pv_founding_on_judge'
                    and tgrelid = to_regclass('public.pv_review_judge') and not tgisinternal)
     and not has_function_privilege('authenticated',
               to_regprocedure('public.pv_founding_recheck(uuid, boolean)'), 'execute')
     and not has_function_privilege('authenticated',
               to_regprocedure('public.pv_founding_grant(uuid, text)'), 'execute') from f
  union all
  select 10, '名簿に金額・メール・氏名・会社の列が無い',
         not exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='founding_members'
                        and column_name in ('email','name','airline','salary','amount',
                                            'annual_total_usd','position')) from f
) t
order by n;
