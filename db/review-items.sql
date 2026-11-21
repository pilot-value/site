-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/review-items.sql
--
-- 戻ってきた会員に、口コミを1項目ずつ聞く板（2026-11-20）。
-- オーナー決定「書いた項目は、全社ぶん読める。7項目書けば全部読める。」
--   ・板は7日に1回。待遇の板（db/ask-own-airline.sql）と同じ日に出さない（pv_board_gap）。
--   ・もう全部読める人（フォームで出した・7項目そろった）には出さない。
--   ・1項目40字以上。書いたその場で保存して載せる（1項目＝1件として数える。2026-11-19 の数え方のまま）。
--   ・どの項目が読めるかは db/reviews-gate.sql 3-d の pv_review_my_cats() の1か所（ここでは決めない）。
--
-- 板で書き始めた口コミは「書きかけ」（3-d の表 pv_review_partial に id が1行）。7項目そろうと外れる。
-- フォームで続きを出したとき（submit_review_finish）も外れる（フォームの決まり＝6つの評価と合計300字）。
--
-- 貼る順: db/reviews-gate.sql → db/review-pending.sql → db/ask-own-airline.sql → このファイル
--         → db/review-items-webhook.sql（項目を足すたびに翻訳と AI の判定をやり直す）。
-- 冪等（何度流しても同じ）。末尾の検算が全部 ✅ なら貼れている。
-- ════════════════════════════════════════════════════════════════

do $guard$
begin
  if to_regprocedure('public.pv_review_my_cats()') is null
     or to_regclass('public.pv_review_partial') is null then
    raise exception '先に db/reviews-gate.sql を貼ってください（pv_review_my_cats / pv_review_partial が無い）';
  end if;
  if to_regprocedure('public.pv_board_gap()') is null then
    raise exception '先に db/ask-own-airline.sql を貼ってください（pv_board_gap が無い）';
  end if;
  if to_regprocedure('public.pv_validate_review_payload(jsonb)') is null then
    raise exception '先に db/review-pending.sql を貼ってください（pv_validate_review_payload が無い）';
  end if;
end
$guard$;


-- ── 0. 1項目だけの口コミを入れられるようにする ──────────────────
-- 点数と本文の列に NOT NULL が付いていたら外す（付いていなければ何もしない）。
-- フォームは今までどおり6つの評価を必ず入れる。外すのは「まだ書いていない項目」を空のまま置くため。
do $nn$
declare
  c text;
begin
  foreach c in array array['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score',
                           'training_score', 'mgmt_score',
                           'culture_comment', 'salary_comment', 'benefits_comment', 'wlb_comment',
                           'ops_comment', 'training_comment', 'mgmt_comment'] loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'reviews_v2'
                  and column_name = c and is_nullable = 'NO') then
      execute format('alter table public.reviews_v2 alter column %I drop not null', c);
    end if;
  end loop;
end
$nn$;


-- ── 1. profiles の列 ─────────────────────────────────────────
-- ★会員は書き換えられない（db/admin.sql が列ごとの update しか渡していない）。
--   review_prompt_at … 板を最後に開いた時刻（書くのは pv_review_board_seen だけ）。db/ask-own-airline.sql でも足している。
--   review_items_*   … 1日に保存できる回数の数え（submit_review_item だけが書く）。
alter table public.profiles add column if not exists review_prompt_at   timestamptz;
alter table public.profiles add column if not exists review_items_day   date;
alter table public.profiles add column if not exists review_items_today int not null default 0;


-- ── 2. 決まりの数（ここだけ）───────────────────────────────────
/* 板を出す間隔（オーナー「7日に一回でいい」）。 */
create or replace function public.pv_review_ask_gap()
returns interval
language sql
immutable
as $fn$ select interval '7 days' $fn$;
revoke all on function public.pv_review_ask_gap() from public, anon, authenticated;

/* 聞く順。給与から（いちばん読みたい人が多い）。経営陣への提案は最後。
   ⚠️ 中身は pv_review_keys() と同じ7つ（並びだけが違う）。 */
create or replace function public.pv_review_ask_order()
returns text[]
language sql
immutable
as $fn$ select array['salary', 'wlb', 'benefits', 'training', 'ops', 'culture', 'mgmt'] $fn$;
revoke all on function public.pv_review_ask_order() from public, anon, authenticated;


-- ── 3. 板に出す会社と職位 ─────────────────────────────────────
-- 書きかけの口コミがあれば、その会社（いちばん新しいもの）。
-- 無ければ、いちばん新しい給与の会社（一覧に在る会社だけ）。職位も同じ行から。
-- 職位が分からなければ、登録のときに選んだ職位。会社が分からなければ空（板が1回だけ聞く）。
-- ★誰にも grant しない。
create or replace function public.pv_review_board_own(p_uid uuid,
                                                      out o_air text, out o_pos text, out o_done text[])
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
begin
  o_done := '{}'::text[];
  if p_uid is null then return; end if;

  select r.airline, r."position", public.pv_review_written(to_jsonb(r))
    into o_air, o_pos, o_done
    from public.reviews_v2 r
    join public.pv_review_partial pp on pp.rid = r.id
   where r.proof_hash in (select public.pv_review_hash(p_uid, c) from public.pv_review_codes() c)
   order by r.created_at desc
   limit 1;

  if o_air is null then
    o_done := '{}'::text[];
    select pr.airline, pr."position"
      into o_air, o_pos
      from public.pay_reports pr
     where pr.proof_hash in (select public.pv_my_keys())
       and pr.airline <> 'other'
       and exists (select 1 from public.pv_airlines a where a.code = pr.airline and a.active)
     order by pr.period_year desc, pr.period_month desc, pr.created_at desc
     limit 1;
  end if;

  -- 給与の職位は cap / fo / cadet、口コミは captain / fo（訓練生の口コミは聞かない＝登録の職位へ落とす）
  o_pos := case o_pos when 'cap' then 'captain' when 'captain' then 'captain' when 'fo' then 'fo' end;
  if o_pos is null then
    select pf."position" into o_pos
      from public.profiles pf
     where pf.id = p_uid and pf."position" in ('captain', 'fo');
  end if;
end
$fn$;
revoke all on function public.pv_review_board_own(uuid) from public, anon, authenticated;


-- ── 4. 板を出すか ────────────────────────────────────────────
-- 受け取る形: { manual?: true }
--   manual … 会員が自分で押して開いた（Vote の「続きを書く」「書く」）。7日と待遇の板の間隔を見ない。
-- 返す形:
--   出さない … { ok, due:false, why:'login'|'blocked'|'done'|'wait', next_at? }
--   出す     … { ok, due:true, airline, name_ja, name_en, position, done:[書いた項目], open:[読める項目], order:[聞く順] }
--   airline が null なら、板が会社を1回だけ聞く。position が null なら職位も聞く。
-- ★ほかの人のことは何も返さない（その会社に口コミが何件あるかも）。
create or replace function public.pv_review_board(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid    uuid    := auth.uid();
  v_manual boolean := coalesce(p->>'manual', '') = 'true';
  v_cats   text[];
  v_own    record;
  v_next   timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', true, 'due', false, 'why', 'login');
  end if;
  if public.pv_proof_blocked() then
    return jsonb_build_object('ok', true, 'due', false, 'why', 'blocked');
  end if;
  v_cats := public.pv_review_my_cats();
  if cardinality(v_cats) = 7 then
    return jsonb_build_object('ok', true, 'due', false, 'why', 'done');
  end if;

  if not v_manual then
    select greatest(pr.review_prompt_at + public.pv_review_ask_gap(),
                    pr.ask_prompt_at    + public.pv_board_gap())
      into v_next
      from public.profiles pr where pr.id = v_uid;
    if v_next is not null and v_next > now() then
      return jsonb_build_object('ok', true, 'due', false, 'why', 'wait', 'next_at', v_next);
    end if;
  end if;

  select * into v_own from public.pv_review_board_own(v_uid);

  return jsonb_build_object(
    'ok', true, 'due', true,
    'airline',  v_own.o_air,
    'name_ja',  (select a.name_ja from public.pv_airlines a where a.code = v_own.o_air),
    'name_en',  (select a.name_en from public.pv_airlines a where a.code = v_own.o_air),
    'position', v_own.o_pos,
    'done',     to_jsonb(coalesce(v_own.o_done, '{}'::text[])),
    'open',     to_jsonb(v_cats),
    'order',    to_jsonb(public.pv_review_ask_order()));
end
$fn$;
revoke all on function public.pv_review_board(jsonb) from public, anon;
grant execute on function public.pv_review_board(jsonb) to authenticated;


-- ── 5. 板を開いた（7日の窓を始める）─────────────────────────────
-- 窓の中なら何もしない（2枚目の端末が同時に開いても、窓は延びない）。自分で押して開いた板では呼ばない。
create or replace function public.pv_review_board_seen()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid uuid := auth.uid();
  v_at  timestamptz;
begin
  if v_uid is null then return jsonb_build_object('ok', false); end if;
  update public.profiles
     set review_prompt_at = now()
   where id = v_uid
     and (review_prompt_at is null or review_prompt_at + public.pv_review_ask_gap() <= now());
  select pr.review_prompt_at into v_at from public.profiles pr where pr.id = v_uid;
  return jsonb_build_object('ok', true, 'next_at', v_at + public.pv_review_ask_gap());
end
$fn$;
revoke all on function public.pv_review_board_seen() from public, anon;
grant execute on function public.pv_review_board_seen() to authenticated;


-- ── 6. 1項目を保存する ───────────────────────────────────────
-- 受け取る形: { airline, position:'captain'|'fo', cat, score:1〜5, comment:40〜300字 }
-- 返す形: { ok:true, saved, done:[この口コミで書いた項目], open:[読める項目], full }
--         { ok:false, why:'cat'|'score'|'short'|'long'|'quality'|'copy'|'airline'|'position'|'limit' }
--   ・その会社の自分の口コミ（1社1件）が無ければ新しく作り、書きかけの印を付ける。在れば、その項目だけを書き換える。
--   ・本文が変わったら訳を消す（db/review-items-webhook.sql の引き金が、翻訳と AI の判定をやり直す）。
--   ・7項目そろったら書きかけの印を外す。
-- ★品質の判定（連打・同じ語の繰り返し）は画面の assessReviewQuality（写しの7か所）。ここでは字数と、
--   字の種類が少なすぎる文（同じ字の並べ書き）だけを止める。中身の怪しさは翻訳の AI の判定（保留）が見る。
create or replace function public.submit_review_item(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_cat   text := p->>'cat';
  v_score int;
  v_txt   text := btrim(coalesce(p->>'comment', ''));
  v_len   int;
  v_air   text := nullif(btrim(coalesce(p->>'airline', '')), '');
  v_pos   text := p->>'position';
  v_hash  text;
  v_id    uuid;
  v_n     int;
  v_done  text[];
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if v_cat is null or not (v_cat = any (public.pv_review_keys())) then
    return jsonb_build_object('ok', false, 'why', 'cat');
  end if;
  if coalesce(p->>'score', '') !~ '^[1-5]$' then
    return jsonb_build_object('ok', false, 'why', 'score');
  end if;
  v_score := (p->>'score')::int;
  v_len := char_length(v_txt);
  if v_len < 40 then return jsonb_build_object('ok', false, 'why', 'short'); end if;
  if v_len > 300 then return jsonb_build_object('ok', false, 'why', 'long'); end if;
  if (select count(distinct ch) from regexp_split_to_table(v_txt, '') ch) < 10 then
    return jsonb_build_object('ok', false, 'why', 'quality');
  end if;
  if v_air is null or v_air = 'other'
     or not exists (select 1 from public.pv_airlines a where a.code = v_air and a.active) then
    return jsonb_build_object('ok', false, 'why', 'airline');
  end if;
  if coalesce(v_pos, '') not in ('captain', 'fo') then
    return jsonb_build_object('ok', false, 'why', 'position');
  end if;

  -- 1日の回数（打ち間違いの直しを含めて30回まで。翻訳と判定の費用が膨らまないように）
  update public.profiles
     set review_items_today = case when review_items_day = current_date then review_items_today + 1 else 1 end,
         review_items_day   = current_date
   where id = v_uid
  returning review_items_today into v_n;
  if coalesce(v_n, 0) > 30 then
    return jsonb_build_object('ok', false, 'why', 'limit');
  end if;

  v_hash := public.pv_review_hash(v_uid, v_air);
  perform pg_advisory_xact_lock(hashtext('pv_review_item:' || v_hash));

  select r.id into v_id
    from public.reviews_v2 r
   where r.proof_hash = v_hash
   order by r.created_at
   limit 1
   for update;

  /* ★同じ文を別の項目に貼り回して7項目を開けるのを止める（画面の assessReviewSet と同じ考え。ここは空白と大小を
       そろえて「同じ文」だけを見る。似ているだけの文は画面が止める）。 */
  if v_id is not null and exists (
       select 1
         from public.reviews_v2 r, unnest(public.pv_review_keys()) k
        where r.id = v_id and k <> v_cat
          and lower(regexp_replace(coalesce(to_jsonb(r) ->> (k || '_comment'), ''), '\s+', '', 'g'))
            = lower(regexp_replace(v_txt, '\s+', '', 'g'))) then
    return jsonb_build_object('ok', false, 'why', 'copy');
  end if;

  if v_id is null then
    execute format('insert into public.reviews_v2 (proof_hash, airline, "position", %I, %I)
                    values ($1, $2, $3, $4, $5) returning id',
                   v_cat || '_score', v_cat || '_comment')
       into v_id
      using v_hash, v_air, v_pos, v_score, v_txt;
    insert into public.pv_review_partial (rid) values (v_id) on conflict (rid) do nothing;
  else
    execute format('update public.reviews_v2
                       set %1$I = $1,
                           %2$I = $2,
                           translations = case when %2$I is distinct from $2 then null else translations end
                     where id = $3',
                   v_cat || '_score', v_cat || '_comment')
      using v_score, v_txt, v_id;
  end if;

  select public.pv_review_written(to_jsonb(r)) into v_done from public.reviews_v2 r where r.id = v_id;
  if cardinality(v_done) = 7 then
    delete from public.pv_review_partial where rid = v_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'saved', v_cat,
    'done', to_jsonb(v_done),
    'open', to_jsonb(public.pv_review_my_cats()),
    'full', cardinality(public.pv_review_my_cats()) = 7);
end
$fn$;
revoke all on function public.submit_review_item(jsonb) from public, anon;
grant execute on function public.submit_review_item(jsonb) to authenticated;


-- ── 7. 書きかけの口コミを、フォームで出し切る ──────────────────────
-- submit-review.html が、書きかけの口コミの続きをフォームで出したとき（新しく作る口コミは今までどおり直接入れる）。
-- 受け取る形はフォームと同じ（airline・position・7つの *_score と *_comment）。決まりもフォームと同じ
-- （pv_validate_review_payload：6つの評価と合計300字）。通ったら7項目をまとめて書き換え、書きかけの印を外す
-- ＝ フォームで1件出したのと同じ（全部読める）。
-- 返す形: { ok:true } / { ok:false, why:'none' }（その会社の書きかけの口コミが無い）
create or replace function public.submit_review_finish(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid  uuid := auth.uid();
  v_hash text;
  v_id   uuid;
  v_old  jsonb;
  v_chg  boolean := false;
  k      text;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  perform public.pv_validate_review_payload(p);

  v_hash := public.pv_review_hash(v_uid, btrim(p->>'airline'));
  perform pg_advisory_xact_lock(hashtext('pv_review_item:' || v_hash));
  select r.id, to_jsonb(r) into v_id, v_old
    from public.reviews_v2 r
    join public.pv_review_partial pp on pp.rid = r.id
   where r.proof_hash = v_hash
   order by r.created_at
   limit 1
   for update of r;
  if v_id is null then
    return jsonb_build_object('ok', false, 'why', 'none');
  end if;

  foreach k in array public.pv_review_keys() loop
    if nullif(btrim(coalesce(p->>(k || '_comment'), '')), '') is distinct from
       nullif(btrim(coalesce(v_old->>(k || '_comment'), '')), '') then
      v_chg := true;
    end if;
  end loop;

  update public.reviews_v2 r
     set "position"       = p->>'position',
         culture_score    = nullif(p->>'culture_score', '')::int,
         salary_score     = nullif(p->>'salary_score', '')::int,
         benefits_score   = nullif(p->>'benefits_score', '')::int,
         wlb_score        = nullif(p->>'wlb_score', '')::int,
         ops_score        = nullif(p->>'ops_score', '')::int,
         training_score   = nullif(p->>'training_score', '')::int,
         mgmt_score       = nullif(p->>'mgmt_score', '')::int,
         culture_comment  = nullif(btrim(coalesce(p->>'culture_comment', '')), ''),
         salary_comment   = nullif(btrim(coalesce(p->>'salary_comment', '')), ''),
         benefits_comment = nullif(btrim(coalesce(p->>'benefits_comment', '')), ''),
         wlb_comment      = nullif(btrim(coalesce(p->>'wlb_comment', '')), ''),
         ops_comment      = nullif(btrim(coalesce(p->>'ops_comment', '')), ''),
         training_comment = nullif(btrim(coalesce(p->>'training_comment', '')), ''),
         mgmt_comment     = nullif(btrim(coalesce(p->>'mgmt_comment', '')), ''),
         translations     = case when v_chg then null else r.translations end
   where r.id = v_id;
  delete from public.pv_review_partial where rid = v_id;
  return jsonb_build_object('ok', true);
end
$fn$;
revoke all on function public.submit_review_finish(jsonb) from public, anon;
grant execute on function public.submit_review_finish(jsonb) to authenticated;


-- ── 検算（全部 ✅ なら貼れている）──────────────────────────────
with fn as (
  select p.oid, p.proname,
         has_function_privilege('anon', p.oid, 'execute')          as anon_x,
         has_function_privilege('authenticated', p.oid, 'execute') as auth_x
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
)
select 1 as 番号, '会員が呼べる口が4つ（板を出すか・開いた・1項目を保存・フォームで出し切る）' as 項目,
       case when (select count(*) from fn
                   where proname in ('pv_review_board', 'pv_review_board_seen', 'submit_review_item', 'submit_review_finish')
                     and auth_x and not anon_x) = 4
            then '✅' else '❌' end as 結果
union all
select 2, '中だけで使う関数を会員が呼べない（会社の決め方・読める項目・書いた項目）',
       case when (select count(*) from fn
                   where proname in ('pv_review_board_own', 'pv_review_my_cats', 'pv_review_written',
                                     'pv_review_open_part', 'pv_review_ask_order', 'pv_review_ask_gap')
                     and (anon_x or auth_x)) = 0
            then '✅' else '❌' end
union all
select 3, '書きかけの表を会員が読めない',
       case when not has_table_privilege('authenticated', 'public.pv_review_partial', 'select')
             and not has_table_privilege('anon', 'public.pv_review_partial', 'select')
            then '✅' else '❌' end
union all
select 4, '点数と本文の列が空を受け取れる（1項目だけの口コミ）',
       case when (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = 'reviews_v2'
                     and column_name ~ '_(score|comment)$' and is_nullable = 'NO') = 0
            then '✅' else '❌' end
union all
select 5, '鍵（pv_has_review_key）と一覧（pv_reviews）が項目ごとの鍵を読んでいる',
       case when (select count(*) from fn
                   where proname in ('pv_has_review_key', 'pv_reviews')
                     and pg_get_functiondef(oid) like '%pv_review_my_cats()%') = 2
            then '✅' else '❌ 古い db/reviews-gate.sql のまま（先に貼り直す）' end
union all
select 6, '待遇の板が口コミの板の時刻を見ている（同じ日に出さない）',
       case when (select count(*) from fn
                   where proname = 'pv_ask_next'
                     and pg_get_functiondef(oid) like '%review_prompt_at%') = 1
            then '✅' else '❌ 古い db/ask-own-airline.sql のまま（先に貼り直す）' end
order by 1;
