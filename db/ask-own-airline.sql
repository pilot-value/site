-- ════════════════════════════════════════════════════════════════
-- db/ask-own-airline.sql — 戻ってきた会員に「〇〇のこと、ひとつ教えて。」（2026-10-30）
--
-- オーナー指示（2026-10-29〜30）
--   「登録したパイロットが戻ってきたとき、2日に1回、自分の会社について3問。
--     大事で、まだ埋まっていない質問から。3人以上が同じような答えなら、いったん次の質問へ。
--     大事な順は 勤務 → 通勤・タクシー → 休暇・手当 → staff travel。」
--   聞く相手 … 給与か口コミのどちらかを出した会員（登録だけの会員には聞かない）
--   出し方   … 画面の真ん中の板（pv-conditions.js の askReturn。待遇の質問と同じ板）
--
-- ここが決めること（画面は何も決めない）
--   ・聞く会社   … いちばん新しい給与の会社。給与が無ければ、いちばん新しい口コミの会社。
--                  一覧に無い会社（other）・止めた会員（pv_proof_blocked）には聞かない。
--   ・いつ       … profiles.ask_prompt_at（板を開いた時刻）から ask_interval_hours（48時間）。
--                  サーバで数える ＝ スマホとパソコンで二重に出ない。
--   ・何を・どの順 … pv_condition_questions.ask_rank の順（正本は pv-conditions.mjs の ASK）。
--                  本人が答えた・わからない・スキップした質問は、今の窓（365／180／90日）が明けるまで出さない。
--                  子の質問は、本人が親に該当する答えをしたときだけ（今の質問と同じ pv_condition_links）。
--                  ★「埋まった」質問は出さない（pv_ask_filled）。
--
-- 「埋まった」の線（2026-10-30 オーナー承認）── その会社で答えた人のうち
--   1つ選ぶ・複数選ぶ … いちばん多い答えが3人以上 かつ 答えた人の過半数
--   数字             … 中央の値から ±10%（最低でも1刻み＝1日）に3人以上 かつ 過半数
--   ★数える行は公開の集計（airline_condition_facts）と同じ pv_condition_ans()。写しを作らない。
--   ★割れたら（2対2）埋まっていない＝聞き続ける。後から割れれば、また聞く側に戻る（「いったん」）。
--
-- ★ほかの人の人数は1つも返さない。返すのは質問の id だけ
--   （next_condition_questions・pv_contrib_give と同じ。2026-10-10 の判断）。
--
-- 流す順番 … db/conditions.generated.sql → db/airline-conditions.sql → … → db/contrib.sql → **このファイル**
-- 何度流しても同じ結果になる（create or replace ＋ 権限の入れ直し）。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ──────────────────────────────────────────────────
do $guard$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'pv_condition_questions'
                    and column_name = 'ask_rank') then
    raise exception '先に db/conditions.generated.sql を実行してください（ask_rank が無い）';
  end if;
  if to_regprocedure('public.pv_condition_ans()') is null then
    raise exception '先に db/airline-conditions.sql を実行してください（pv_condition_ans が無い）';
  end if;
  if to_regprocedure('public.pv_proof_blocked()') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pv_proof_blocked が無い）';
  end if;
  if to_regprocedure('public.pv_review_hash(uuid, text)') is null then
    raise exception '先に db/reviews-gate.sql を実行してください（pv_review_hash が無い）';
  end if;
  if to_regprocedure('public.pv_contrib_own(uuid)') is null then
    raise exception '先に db/contrib.sql を実行してください（pv_contrib_own が無い）';
  end if;
end
$guard$;


-- ── 1. 最後に板を開いた時刻 ────────────────────────────────────
-- ★会員は profiles のこの列を書き換えられない（db/admin.sql が列ごとの update しか渡していない）。
--   書くのは pv_ask_seen だけ。
alter table public.profiles add column if not exists ask_prompt_at timestamptz;


-- ── 2. 聞く会社（誰にも grant しない）──────────────────────────
-- 給与が先（その月に勤めていた会社）。無ければ口コミ。どちらも、いちばん新しいもの。
-- 一覧に無い会社・名簿から外れた会社は返さない（会社ページも集計も無い）。
create or replace function public.pv_ask_own(p_uid uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v text;
begin
  if p_uid is null then return null; end if;

  select o.o_code into v
    from public.pv_contrib_own(p_uid) o
   where o.o_code is not null and o.o_code <> 'other'
     and exists (select 1 from public.pv_airlines a where a.code = o.o_code and a.active)
   order by o.o_ym desc, o.o_at desc, o.o_code
   limit 1;
  if v is not null then return v; end if;

  -- 口コミは user_id を持たない。本人の印を総当たりで作り直して突き合わせる（pv_has_review_key と同じ手）
  select r.airline into v
    from public.reviews_v2 r
   where r.proof_hash in (select public.pv_review_hash(p_uid, c) from public.pv_review_codes() c)
     and r.airline <> 'other'
     and exists (select 1 from public.pv_airlines a where a.code = r.airline and a.active)
   order by r.created_at desc
   limit 1;
  return v;
end
$fn$;
revoke all on function public.pv_ask_own(uuid) from public, anon, authenticated;


-- ── 3. 「埋まった」質問（誰にも grant しない）──────────────────
-- 返すのは、その会社で埋まった質問の id だけ。数は返さない。
create or replace function public.pv_ask_filled(p_airline text)
returns setof text
language sql
stable
set search_path = public, extensions
as $fn$
  with a as (
    select x.* from public.pv_condition_ans() x where x.airline = p_airline
  ),
  q as (
    select q.id, q.kind,
           coalesce(nullif(q.spec->>'step', '')::numeric, 1) as step
      from public.pv_condition_questions q
     where q.active and q.ask_rank is not null
  ),
  -- 答えた人（わからないは数えない）＝ 公開の集計の n と同じ数え方
  n as (
    select a.question_id,
           count(distinct a.proof_hash) filter (where a.answer_code is distinct from 'unknown') as n
      from a group by a.question_id
  ),
  -- 1つ選ぶ・複数選ぶ：答えごとの人数のいちばん多いもの
  picked as (
    select a.question_id, a.proof_hash, a.answer_code as code
      from a where a.answer_code is not null and a.answer_code <> 'unknown'
    union all
    select a.question_id, a.proof_hash, x
      from a cross join lateral unnest(a.answer_codes) as x
     where a.answer_codes is not null and x <> 'unknown'
  ),
  top as (
    select t.question_id, max(t.c) as k
      from (select question_id, code, count(distinct proof_hash) as c
              from picked group by question_id, code) t
     group by t.question_id
  ),
  -- 数字：中央の値の近く（±10%・最低でも1刻み）にいる人数
  med as (
    select a.question_id,
           percentile_cont(0.5) within group (order by a.answer_num) as m
      from a
     where a.answer_num is not null and not a.has_currency
     group by a.question_id
  ),
  near as (
    select a.question_id, count(distinct a.proof_hash) as k
      from a
      join med on med.question_id = a.question_id
      join q   on q.id = a.question_id
     where a.answer_num is not null and not a.has_currency
       and abs(a.answer_num::float8 - med.m) <= greatest(abs(med.m) * 0.10, q.step::float8)
     group by a.question_id
  )
  select q.id
    from q
    join n on n.question_id = q.id
    left join top  t on t.question_id = q.id
    left join near r on r.question_id = q.id
   where n.n >= 3
     and (case when q.kind = 'num' then coalesce(r.k, 0) else coalesce(t.k, 0) end) >= 3
     and (case when q.kind = 'num' then coalesce(r.k, 0) else coalesce(t.k, 0) end) * 2 > n.n
$fn$;
revoke all on function public.pv_ask_filled(text) from public, anon, authenticated;


-- ── 4. 次に聞く質問（会員だけ・読むだけ）─────────────────────────
-- 受け取る形: { limit?: 1〜ask_limit, cont?: true, not?: [板で既に出した質問の id] }
--   cont … 開いている板の続き（1問答えた後に、子の質問を拾い直す）。48時間の窓を見ない。
--   not  … この板で既に出した質問。スキップの保存が先に届かなくても、同じ質問を2度出さない。
-- 返す形:
--   聞かない … { ok, due:false, why:'login'|'blocked'|'none'|'wait'|'done', next_at? }
--   聞く     … { ok, due:true, airline, name_ja, name_en, questions:[{ id, kind, mine_code }] }
--   mine_code … 窓が明けて戻ってきた質問の、前回の答え（1つ選ぶ質問だけ）。「今も同じですか？」に使う。
create or replace function public.pv_ask_next(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid    uuid := auth.uid();
  v_hours  int  := public.pv_condition_setting('ask_interval_hours', 48);
  v_max    int  := least(greatest(public.pv_condition_setting('ask_limit', 3), 1), 5);
  v_ans_d  int  := public.pv_condition_setting('answer_reask_days',  365);
  v_unk_d  int  := public.pv_condition_setting('unknown_reask_days', 180);
  v_skip_d int  := public.pv_condition_setting('skip_reask_days',     90);
  v_cont   boolean := coalesce(p->>'cont', '') = 'true';
  v_limit  int;
  v_not    text[];
  v_code   text;
  v_hash   text;
  v_next   timestamptz;
  v_filled text[];
  v_rows   jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', true, 'due', false, 'why', 'login');
  end if;
  if public.pv_proof_blocked() then
    return jsonb_build_object('ok', true, 'due', false, 'why', 'blocked');
  end if;

  v_code := public.pv_ask_own(v_uid);
  if v_code is null then
    return jsonb_build_object('ok', true, 'due', false, 'why', 'none');
  end if;

  if not v_cont then
    select pr.ask_prompt_at + make_interval(hours => v_hours) into v_next
      from public.profiles pr where pr.id = v_uid;
    if v_next is not null and v_next > now() then
      return jsonb_build_object('ok', true, 'due', false, 'why', 'wait', 'next_at', v_next);
    end if;
  end if;

  v_limit := case when coalesce(p->>'limit', '') ~ '^[0-9]{1,2}$'
                  then least(greatest((p->>'limit')::int, 1), v_max) else v_max end;
  select coalesce(array_agg(x), '{}'::text[]) into v_not
    from (select x from jsonb_array_elements_text(
            case when jsonb_typeof(p->'not') = 'array' then p->'not' else '[]'::jsonb end) as x
          limit 20) s;
  v_filled := array(select public.pv_ask_filled(v_code));
  v_hash   := public.pv_condition_hash(v_uid, v_code, null);

  with mine as (
    select question_id, answer_code, answer_codes, updated_at, skipped_at,
           num_nonnulls(answer_code, answer_codes, answer_num, answer_text, answer_json) > 0 as answered
      from public.airline_conditions where proof_hash = v_hash
  ),
  cand as (
    select q.id, q.kind, q.ask_rank,
           (select m.answer_code from mine m
             where m.question_id = q.id and m.answered and q.kind = 'choice') as mine_code,
           /* 次にこの人へ聞いてよくなる時刻（next_condition_questions と同じ決め方） */
           (select greatest(
                     case when m.answered then m.updated_at
                          + make_interval(days => case when m.answer_code = 'unknown'
                                                       then v_unk_d else v_ans_d end) end,
                     case when m.skipped_at is not null
                          then m.skipped_at + make_interval(days => v_skip_d) end)
              from mine m where m.question_id = q.id) as mine_due
      from public.pv_condition_questions q
     where q.active
       and q.ask_rank is not null
       and not q.topic_only
       and q.id <> all(v_not)
       and q.id <> all(v_filled)
       -- 親の条件が、その人自身の答えで、いちばん上まで続いている質問だけ
       and not exists (
             select 1 from public.pv_condition_links k
              where k.question_id = q.id
                and not exists (select 1 from mine m
                                 where m.question_id = k.parent
                                   and (m.answer_code = any(k.parent_when)
                                        or m.answer_codes && k.parent_when)))
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'kind', z.kind, 'mine_code', z.mine_code)
                            order by z.ask_rank), '[]'::jsonb)
    into v_rows
    from (select * from cand
           where mine_due is null or mine_due <= now()
           order by ask_rank
           limit v_limit) z;

  if jsonb_array_length(v_rows) = 0 then
    return jsonb_build_object('ok', true, 'due', false, 'why', 'done');
  end if;

  return jsonb_build_object(
    'ok', true, 'due', true,
    'airline', v_code,
    'name_ja', (select a.name_ja from public.pv_airlines a where a.code = v_code),
    'name_en', (select a.name_en from public.pv_airlines a where a.code = v_code),
    'questions', v_rows);
end
$fn$;
revoke all on function public.pv_ask_next(jsonb) from public, anon;
grant execute on function public.pv_ask_next(jsonb) to authenticated;

comment on function public.pv_ask_next(jsonb) is
  '戻ってきた会員に聞く質問（自分の会社・ask_rank の順・埋まった質問を除く・48時間に1回）。ほかの人の人数は返さない。';


-- ── 5. 板を開いた ─────────────────────────────────────────────
-- 48時間の窓の中なら何もしない（2枚目の端末が同時に開いても、窓は延びない）。
create or replace function public.pv_ask_seen()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_hours int  := public.pv_condition_setting('ask_interval_hours', 48);
  v_at    timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false);
  end if;
  update public.profiles
     set ask_prompt_at = now()
   where id = v_uid
     and (ask_prompt_at is null or ask_prompt_at + make_interval(hours => v_hours) <= now());
  select pr.ask_prompt_at into v_at from public.profiles pr where pr.id = v_uid;
  return jsonb_build_object('ok', true, 'next_at', v_at + make_interval(hours => v_hours));
end
$fn$;
revoke all on function public.pv_ask_seen() from public, anon;
grant execute on function public.pv_ask_seen() to authenticated;


-- ── 検算（4行とも ✅ なら貼れている）────────────────────────────
select '戻った人に聞く質問が在る' as 項目,
       case when (select count(*) from public.pv_condition_questions where active and ask_rank is not null) > 0
            then '✅' else '❌' end as 結果
union all
select '会員だけが呼べる（未ログインの役は呼べない）',
       case when has_function_privilege('authenticated', 'public.pv_ask_next(jsonb)', 'execute')
             and not has_function_privilege('anon', 'public.pv_ask_next(jsonb)', 'execute')
             and has_function_privilege('authenticated', 'public.pv_ask_seen()', 'execute')
             and not has_function_privilege('anon', 'public.pv_ask_seen()', 'execute')
            then '✅' else '❌' end
union all
select '中の部品は誰も呼べない',
       case when not has_function_privilege('authenticated', 'public.pv_ask_filled(text)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_ask_own(uuid)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_condition_ans()', 'execute')
            then '✅' else '❌' end
union all
select '設定（48時間・3問）が入っている',
       case when public.pv_condition_setting('ask_interval_hours', -1) > 0
             and public.pv_condition_setting('ask_limit', -1) > 0
            then '✅' else '❌' end;
