-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/airline-conditions.sql
--
-- 待遇・働き方の回答。年収（pay_reports）とは別テーブルにする。
-- ライフサイクルが違うため：年収は毎月の実績、待遇は「制度」で、変わるまで同じ。
--
-- ★ このファイルは自動では流れない。オーナーの明示承認後に SQL Editor で実行する。
-- ★ 流す順番: db/airlines.generated.sql → db/vocab.generated.sql
--    → db/conditions.generated.sql → このファイル。
--    順番を守らないと参照先が無くて落ちる（下の to_regclass が止める）。
-- 冪等（何度流しても安全）。
--
-- ── この設計が守っている約束 ────────────────────────────────
--  1. user_id を持たない。proof_hash だけ。運営者も個人に辿り着けない
--     （pay_reports と同じ。区切りだけ '::pv_cond::' で分ける）。
--  2. 1回答＝1行の縦持ち。質問を足すのは DB 変更でなくデータ編集で済み、
--     部分回答が自然に表現でき、質問のバージョンも回答ごとに持てる。
--  3. 個票は誰にも読ませない。公開するのは k≧3 の集計ビューだけ。
--     UI ではなく DB の権限で担保する（ポリシーを1つも作らない）。
--  4. 「わからない」は行として保存するが、公開の n には数えない。
--     3人が「わからない」と言っても制度がある裏付けにはならない。
--     保存するのは、同じ人に翌月また同じことを聞かないため。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regclass('public.pv_airlines') is null then
    raise exception '先に db/airlines.generated.sql を実行してください';
  end if;
  if to_regclass('public.pv_positions') is null or to_regclass('public.pv_currencies') is null then
    raise exception '先に db/vocab.generated.sql を実行してください';
  end if;
  if to_regclass('public.pv_condition_questions') is null then
    raise exception '先に db/conditions.generated.sql を実行してください（質問マスタが無い）';
  end if;
  -- 聞き直すまでの日数はここに数字を持たない。設定表と読み出し関数が要る
  if to_regclass('public.pv_condition_settings') is null
     or to_regproc('public.pv_condition_setting') is null then
    raise exception '先に db/conditions.generated.sql を実行し直してください（設定表が古い）';
  end if;
  -- 話題の入口からだけ出す質問を、1問枠と「答えた項目：N／M」から外すのに使う（5・6・7）
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'pv_condition_questions'
                    and column_name = 'topic_only') then
    raise exception '先に db/conditions.generated.sql を実行し直してください（質問マスタに topic_only の列が無い）';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'profiles がありません。先に既存のスキーマを流してください';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. 回答テーブル
-- ════════════════════════════════════════════════════════════════
create table if not exists public.airline_conditions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- ＝この人がこの項目を最後に確認した日。答え直すと動く
  updated_at timestamptz not null default now(),
  -- sha256(uid || '::pv_cond::' || airline [|| '::' || その他社名])
  -- ⚠️ この式を変えたら db/usage.mjs の再計算も直す
  proof_hash text not null,

  airline       text not null references public.pv_airlines(code),
  airline_other text,

  question_id      text     not null references public.pv_condition_questions(id),
  question_version smallint not null default 1,

  answer_code     text,            -- 1つ選ぶ（'unknown' はどの kind でも入りうる）
  answer_codes    text[],          -- 複数選ぶ
  answer_num      numeric(12,2),   -- 年数・日数・金額
  answer_currency char(3) references public.pv_currencies(code),
  answer_text     text,            -- 自由記述（≤300字・非公開）
  answer_json     jsonb,           -- 明細行用。今回どの質問も使わないが列だけ用意する

  effective_year  smallint not null,   -- いつ時点の制度か
  effective_month smallint not null,

  -- 回答が割れた理由を説明するための文脈。公開の粒度には出さない（準識別子）
  "position"    text references public.pv_positions(code),
  fleet         text references public.pv_fleets(code),
  base_iata     char(3),
  contract_type text references public.pv_contract_types(code),

  lang   text not null default 'ja',
  source text not null default 'pilot_reported'
);

-- 後から足す列はここに `add column if not exists` で書く
-- （create table if not exists は既にあるテーブルに列を足さない）。

-- ★スキップした時刻。「まだ答えていないが、いつ飛ばしたかは覚えている」行になる。
--   これが無いと「3ヶ月は同じ質問を出さない」が守れず、次の提出でまた同じ質問が出る。
--   端末（localStorage）に持たせない：機種変で消えるうえ、
--   「答えたくない／知らない」というスキップ自体が信号として意味がある。
--   ⚠️ 公開ビューにも my_airline_conditions にも出さない。
--      next_condition_questions が「いつまで黙るか」を決めるためだけに使う。
alter table public.airline_conditions add column if not exists skipped_at timestamptz;
-- 補足（answer_text）を、資格のある会員に見せてよいか。既定は false ＝ 今までの補足は本人だけ。
-- 「見せます」と書いた画面（会社ページの「情報を追加」）から送られたときだけ true になる。
alter table public.airline_conditions add column if not exists text_shared boolean not null default false;

-- 1人1社1質問で1行。答え直すと on conflict で上書き＋updated_at 更新。
-- unique 制約は張り直すと索引を作り直すので「無ければ作る」にする。
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'airline_conditions_uniq') then
    alter table public.airline_conditions
      add constraint airline_conditions_uniq unique (proof_hash, question_id);
  end if;
end $$;

-- check は毎回 drop してから付け直す（条件を変えて流し直したとき古い定義を残さない）
alter table public.airline_conditions drop constraint if exists ac_answer_any_ck;
alter table public.airline_conditions drop constraint if exists ac_text_len_ck;
alter table public.airline_conditions drop constraint if exists ac_codes_ck;
alter table public.airline_conditions drop constraint if exists ac_period_ck;
alter table public.airline_conditions drop constraint if exists ac_lang_ck;
alter table public.airline_conditions drop constraint if exists ac_base_iata_ck;

-- 空の行を作らない。★ただし「スキップした」だけの行は許す（skipped_at が立っている）。
--   あとで本当に答えたら同じ行を上書きして skipped_at を null に戻す＝行は増えない。
alter table public.airline_conditions add constraint ac_answer_any_ck check (
  answer_code is not null or answer_codes is not null or answer_num is not null
  or answer_text is not null or answer_json is not null or skipped_at is not null);
alter table public.airline_conditions add constraint ac_text_len_ck check (
  answer_text is null or char_length(answer_text) <= 300);
alter table public.airline_conditions add constraint ac_codes_ck check (
  answer_codes is null or (array_length(answer_codes, 1) between 1 and 20));
alter table public.airline_conditions add constraint ac_period_ck check (
  effective_year between 2015 and 2100 and effective_month between 1 and 12);
alter table public.airline_conditions add constraint ac_lang_ck check (lang in ('ja', 'en'));
alter table public.airline_conditions add constraint ac_base_iata_ck check (
  base_iata is null or base_iata ~ '^[A-Z]{3}$');

create index if not exists airline_conditions_aq_idx
  on public.airline_conditions (airline, question_id);
create index if not exists airline_conditions_updated_idx
  on public.airline_conditions (updated_at desc);

comment on table public.airline_conditions is
  '待遇・働き方の回答。1回答＝1行。個票は非公開。集計は airline_condition_facts（k≧3）で、読む口は pv_contrib_facts だけ。';
comment on column public.airline_conditions.skipped_at is
  '「今回はスキップ」を押した時刻。答えが1つも無い行はこれが立っている。公開・自分の回答一覧のどちらにも出さない。';
comment on column public.airline_conditions.answer_code is
  '''unknown''（わからない）はどの kind でも入る。公開の n には数えないが、同じ人に再度聞かないために保存する。';


-- ════════════════════════════════════════════════════════════════
-- 2. 権限：個票は誰にも読ませない
-- ════════════════════════════════════════════════════════════════
alter table public.airline_conditions enable row level security;

-- SELECT / INSERT / UPDATE / DELETE いずれのポリシーも作らない。
-- ＝ anon も authenticated も直接は1行も読めない・書けない。
-- 書き込みは submit_airline_conditions（security definer）経由のみ。
revoke all on public.airline_conditions from anon, authenticated;

-- 既に作ってしまったポリシーがあれば落とす（冪等・事故防止）
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'airline_conditions' loop
    execute format('drop policy %I on public.airline_conditions', p.policyname);
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 3. profiles 拡張（レート制限だけ。権利や称号の列は作らない）
-- ════════════════════════════════════════════════════════════════
-- Founding Contributor は「数えるだけ」なので列を足さない。
-- 誰がいつ何と答えたか・他者と一致したか・自分で訂正したかは、
-- 全部 airline_conditions に残っている（pv_contributor_stats が数える）。
alter table public.profiles
  add column if not exists cond_answers_day   date,
  add column if not exists cond_answers_today int not null default 0;


-- ════════════════════════════════════════════════════════════════
-- 4. proof_hash（サーバでしか作らない）
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_condition_hash(v_uid uuid, v_airline text, v_other text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      v_uid::text || '::pv_cond::' || v_airline || coalesce('::' || lower(v_other), ''),
      'sha256'),
    'hex')
$$;
revoke all on function public.pv_condition_hash(uuid, text, text) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 4b. 親の条件を、いちばん上までたどる（2026-10-04）
-- ════════════════════════════════════════════════════════════════
-- 質問には親があり、その親にも親がある（例: staff_travel → staff_travel_booking
-- → staff_travel_standby_trips）。子を「出す・受け取る・数える」のは、
-- **その子からいちばん上までの全部の段**で、親の答えが parent_when に入っているときだけ。
--
-- このビューは、1つの質問について「満たしていなければならない段」を全部並べる。
--   question_id … 見ている質問
--   parent      … その質問の親・親の親・…（1段につき1行）
--   parent_when … その親が持っていなければならない答え
-- 親が無い質問は1行も出ない ＝ 条件なし。
--
-- ★すぐ上の親だけを見ていた頃（親が1段しか無かった）は、いちばん上を「ない」に
--   答え直しても、あいだの親の古い答えが残っているので、その下の質問が通った。
--   回答は消さない（答え直したら元どおり出す・数える）。なので**読むたびにたどる**。
--   使う所は3つ ── 5. 保存／6. 次に聞く質問／9. 集計。3つとも同じ形で読む。
-- ★中身は質問マスタだけで、個票は1行も含まない。それでも API には出さない。
-- ★union（all なし）＝ 万一マスタに輪ができても止まる。生成側（gen-conditions.mjs）が
--   「親は自分より前に定義」を検査しているので、輪は入らないはず。
-- ⚠️ 列を変えるときは、先に airline_condition_facts を落とす（あちらがこれを読んでいる）。
create or replace view public.pv_condition_links as
with recursive up as (
  select q.id as question_id, q.parent, q.parent_when
    from public.pv_condition_questions q
   where q.parent is not null
  union
  select u.question_id, p.parent, p.parent_when
    from up u
    join public.pv_condition_questions p on p.id = u.parent
   where p.parent is not null
)
select question_id, parent, parent_when from up;

revoke all on public.pv_condition_links from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 4c. 1件ぶんの検品（会員の入口と、未ログインの預かりが**同じもの**を呼ぶ）
-- ════════════════════════════════════════════════════════════════
-- 質問マスタと突き合わせて、答えを決まった形へそろえる。**何も書き込まない。**
--   通った … { ok:true, code, codes, num, currency, text, share, json }
--   落ちた … { ok:false, reason }（reason は画面が日本語にする短い語）
-- ★返した形は、そのままもう一度ここへ渡しても同じ形で通る。
--   未ログインの預かり（db/contrib.sql）は、ここを通した形で置いておき、
--   ログイン後に submit_airline_conditions へそのまま渡す。**検品をもう1つ書かない。**
-- ★親の条件・連投・スキップは見ない（どれも「誰の回答か」が要るので、呼ぶ側が見る）。
-- ★補足（text）は、**どの質問でも**受ける（2026-10-07 オーナー指定
--   「選択回答に任意の補足説明を添えられる」）。300字まで。答えの代わりにはならない
--   （選択肢の答えが無いと missing_code で落ちる＝補足だけの行は作らない）。
-- ★share … この補足を、資格のある会員に見せてよいか。「見せます」と書いた画面から
--   送られたときだけ true（db/contrib.sql の pv_contrib_notes が、この印の行だけを返す）。
--   印を付けずに送る古い画面の補足は、今までどおり本人しか読めない。
create or replace function public.pv_condition_clean(v_qid text, v_ans jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_q     record;
  v_code  text;
  v_codes text[];
  v_num   numeric;
  v_cur   text;
  v_text  text;
  v_json  jsonb;
  v_bad   text;
begin
  select q.id, q.kind, q.choice_codes, q.num_min, q.num_max, q.has_currency
    into v_q
    from public.pv_condition_questions q
   where q.id = v_qid and q.active;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_question');
  end if;

  v_bad   := null;
  v_code  := nullif(btrim(v_ans->>'code'), '');
  v_codes := null;
  v_num   := null;
  v_cur   := upper(nullif(btrim(v_ans->>'currency'), ''));
  v_text  := nullif(btrim(v_ans->>'text'), '');
  v_json  := case when jsonb_typeof(v_ans->'json') in ('array', 'object')
                  then v_ans->'json' end;

  if jsonb_typeof(v_ans->'codes') = 'array' then
    select array_agg(distinct btrim(x)) into v_codes
      from jsonb_array_elements_text(v_ans->'codes') as t(x)
     where btrim(x) <> '';
  end if;

  -- 数値は先に形を見る（そのまま cast すると取引ごと落ちる）
  if nullif(btrim(coalesce(v_ans->>'num', '')), '') is not null then
    if btrim(v_ans->>'num') ~ '^-?[0-9]+(\.[0-9]+)?$' then
      v_num := btrim(v_ans->>'num')::numeric;
    else
      v_bad := 'bad_number';
    end if;
  end if;

  if v_bad is null then
    if v_code = 'unknown' then
      -- 「わからない」はどの kind でも受ける（翌月また同じことを聞かないため）
      v_codes := null; v_num := null; v_cur := null; v_json := null;

    elsif v_q.kind = 'choice' then
      if v_code is null then v_bad := 'missing_code';
      elsif not (v_code = any(v_q.choice_codes)) then v_bad := 'bad_code';
      end if;
      v_codes := null; v_num := null; v_cur := null; v_json := null;

    elsif v_q.kind = 'multi' then
      if coalesce(array_length(v_codes, 1), 0) = 0 then v_bad := 'missing_code';
      elsif exists (select 1 from unnest(v_codes) x where not (x = any(v_q.choice_codes)))
        then v_bad := 'bad_code';
      end if;
      v_code := null; v_num := null; v_cur := null; v_json := null;

    elsif v_q.kind = 'num' then
      if v_num is null then v_bad := 'missing_num';
      elsif v_q.num_min is not null and v_num < v_q.num_min then v_bad := 'out_of_range';
      elsif v_q.num_max is not null and v_num > v_q.num_max then v_bad := 'out_of_range';
      end if;
      if v_bad is null and v_q.has_currency then
        if v_cur is null or not exists (select 1 from public.pv_currencies where code = v_cur) then
          v_bad := 'bad_currency';
        end if;
      elsif not v_q.has_currency then
        v_cur := null;
      end if;
      v_code := null; v_codes := null; v_json := null;

    elsif v_q.kind = 'lines' then
      if v_json is null then v_bad := 'missing_json';
      elsif char_length(v_json::text) > 4000 then v_bad := 'too_long';
      end if;
      v_code := null; v_codes := null; v_num := null; v_cur := null;
    end if;
  end if;

  -- 補足は、どの質問でも受ける（300字まで）
  if v_bad is null and v_text is not null and char_length(v_text) > 300 then
    v_bad := 'text_too_long';
  end if;

  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', v_bad);
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_code, 'codes', to_jsonb(v_codes), 'num', v_num, 'currency', v_cur,
    'text', v_text,
    'share', (v_text is not null and coalesce(v_ans->>'share', '') = 'true'),
    'json', v_json);
end;
$$;
revoke all on function public.pv_condition_clean(text, jsonb) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 4d. 対になる額（低いほう・高いほう）── 相手を引く・比べるのは、サーバではここだけ（2026-10-11）
-- ════════════════════════════════════════════════════════════════
-- 着陸手当の「低いほうの額」と「高いほうの額」は、別々の質問・別々の行だが、2つで1つの幅。
-- どの2問が対かは、質問マスタの spec に入っている（高いほうの行の range_low ＝ 低いほうの id。
-- 生成元は pv-conditions.mjs の rangeLow の1か所で、gen-conditions.mjs が運ぶ）。
--   pv_condition_range_other(質問)
--       対の相手の id。どちらの端を渡してもよい。
--       対でない質問・知らない質問・使っていない質問は null
--   pv_condition_range_bad(質問, その額, その通貨, 相手の額, 相手の通貨)
--       null             … どちらかの額が無い（片方だけは、いつでもよい）／対でない質問／悪くない
--       'range_currency' … 2つの通貨がどちらも在って、違う（★大小より先に見る）
--       'range_order'    … 低いほうが高いほうより大きい（同じ額はよい）
-- ★どちらが低いほうかは、渡された質問の spec からここで決める。呼ぶ側は「この質問の額」と
--   「相手の額」を渡すだけなので、上下を取り違えようがない。
-- ★2問とも使っている（active）ときだけ対。片方を使わなくなったら、残った片方を
--   「もう答え直せない相手の古い答え」と比べない。
-- ★質問マスタを読むだけで、**何も書き込まない**。誰の回答かも見ない（相手の額を探すのは呼ぶ側）。
-- ★サーバの中に、大小や通貨を比べる所をもう1つ書かない（保存の入口が対を見るときは、ここへ聞く）。
-- ★pv_condition_clean と同じく、API からは呼べない（public・anon・authenticated の3つとも外す）。
create or replace function public.pv_condition_range_other(v_qid text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select coalesce(
    -- 渡されたのが高いほう … 自分の spec に書いてある低いほう
    (select lo.id
       from public.pv_condition_questions hi
       join public.pv_condition_questions lo
         on lo.id = hi.spec->>'range_low' and lo.active
      where hi.id = v_qid and hi.active),
    -- 渡されたのが低いほう … 自分を指している高いほう
    (select hi.id
       from public.pv_condition_questions lo
       join public.pv_condition_questions hi
         on hi.spec->>'range_low' = lo.id and hi.active
      where lo.id = v_qid and lo.active
      order by hi.priority, hi.id
      limit 1))
$$;
revoke all on function public.pv_condition_range_other(text) from public, anon, authenticated;

create or replace function public.pv_condition_range_bad(
  v_qid text, v_num numeric, v_cur text, v_other_num numeric, v_other_cur text)
returns text
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_other text := public.pv_condition_range_other(v_qid);
  v_high  boolean;
  v_lo    numeric;
  v_hi    numeric;
  v_a     text := upper(nullif(btrim(v_cur), ''));
  v_b     text := upper(nullif(btrim(v_other_cur), ''));
begin
  if v_other is null then
    return null;   -- 対でない質問には、何も言わない
  end if;

  -- 自分の spec が相手を指していれば、自分が高いほう
  select (q.spec->>'range_low') is not distinct from v_other into v_high
    from public.pv_condition_questions q
   where q.id = v_qid;
  if v_high then v_lo := v_other_num; v_hi := v_num;
  else           v_lo := v_num;       v_hi := v_other_num;
  end if;

  if v_lo is null or v_hi is null then
    return null;   -- 片方だけは、いつでもよい
  end if;

  -- 通貨が先・大小があと（通貨の違う額どうしの大小は、意味を持たない）
  return case
    when v_a is not null and v_b is not null and v_a <> v_b then 'range_currency'
    when v_lo > v_hi then 'range_order'
  end;
end;
$$;
revoke all on function public.pv_condition_range_bad(text, numeric, text, numeric, text) from public, anon, authenticated;



-- ════════════════════════════════════════════════════════════════
-- 5. 回答を保存する
-- ════════════════════════════════════════════════════════════════
-- 質問マスタと突き合わせて1件ずつ検証する。1件が悪くても他は保存し、
-- 落とした理由を rejected で返す（せっかく書いたものを丸ごと捨てない）。
create or replace function public.submit_airline_conditions(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_airline text := nullif(btrim(p->>'airline'), '');
  v_other   text := nullif(btrim(p->>'airline_other'), '');
  v_pos     text := nullif(btrim(p->>'position'), '');
  v_fleet   text := nullif(btrim(p->>'fleet'), '');
  v_base    text := upper(nullif(btrim(p->>'base_iata'), ''));
  v_ctype   text := nullif(btrim(p->>'contract_type'), '');
  v_lang    text := lower(coalesce(nullif(btrim(p->>'lang'), ''), 'ja'));
  v_year    int  := coalesce(nullif(btrim(p->>'year'), '')::int,  extract(year  from current_date)::int);
  v_month   int  := coalesce(nullif(btrim(p->>'month'), '')::int, extract(month from current_date)::int);
  v_hash    text;
  v_prof    record;
  v_a       record;
  v_saved   int := 0;
  v_rej     jsonb := '[]'::jsonb;
  v_total   int;
  -- 1件ぶんの作業用
  v_code  text;
  v_codes text[];
  v_num   numeric;
  v_cur   text;
  v_text  text;
  v_json  jsonb;
  v_bad   text;
  v_skip  boolean;
  v_skipped int := 0;
  v_one   jsonb;
  v_share boolean;
  -- 職位・機種・基地・契約（4つで1組）
  v_no_ctx  boolean;   -- この送信が、4つを1つも運んでいない
  v_ipos    text;      -- 行に書く組（送信の組か、すぐ上の親の行の組）
  v_ifleet  text;
  v_ibase   text;
  v_ictype  text;
  -- 対になる額（4d）
  v_pair    text;      -- 対の相手の質問
  v_plast   boolean;   -- この答えが、この送信の中で、その質問の最後の答えか
  v_pans    jsonb;     -- 同じ送信に入っている相手の答え
  v_pone    jsonb;     -- それを検品した形
  v_pnum    numeric;   -- この送信が終わったあとに残る、相手の額と通貨
  v_pcur    text;
  v_why     text;
  v_pord    bigint;                -- 同じ送信に入っている相手の答えの、送信の中での位置
  v_punit   boolean;               -- この答えと、同じ送信の相手とで「1組」になっている
  v_held    bigint[] := '{}';      -- 1組の、あとから回ってくる端のために取っておいた1件ぶん（その答えの位置）
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if v_airline is null
     or not exists (select 1 from public.pv_airlines where code = v_airline) then
    raise exception '航空会社が正しくありません' using errcode = '22023';
  end if;
  if v_airline <> 'other' then v_other := null; end if;
  if v_lang not in ('ja', 'en') then v_lang := 'ja'; end if;
  if v_year not between 2015 and 2100 or v_month not between 1 and 12 then
    raise exception '年月が正しくありません' using errcode = '22023';
  end if;
  if jsonb_typeof(p->'answers') is distinct from 'array' then
    raise exception '回答がありません' using errcode = '22023';
  end if;

  -- 文脈（語彙に無ければ黙って落とす。ここで投稿ごと弾かない）
  if v_pos   is not null and not exists (select 1 from public.pv_positions      where code = v_pos)   then v_pos   := null; end if;
  if v_fleet is not null and not exists (select 1 from public.pv_fleets         where code = v_fleet) then v_fleet := null; end if;
  if v_ctype is not null and not exists (select 1 from public.pv_contract_types where code = v_ctype) then v_ctype := null; end if;
  if v_base  is not null and v_base !~ '^[A-Z]{3}$' then v_base := null; end if;

  /* ★職位・機種・基地・契約は、4つで「1組」（2026-10-11）。行に書く組の決め方は3つ。
       1. 送信が1つでも運んでいれば … その送信の組をそのまま（欠けた分は空）
       2. 1つも運んでいなくて、行にもう答えが在る … 行の組を動かさない（下の on conflict）
       3. 1つも運んでいなくて、まだ答えが無い（行が無い／スキップの印だけ）
            … 親を持つ質問なら、すぐ上の親の行の組（ループの中）。親が無ければ空
     前は、運んできたもので毎回上書きしていた。4つを運ばない画面（一覧のページ）で答えだけ直すと
     行から職位も機種も消え、親を先に答えて続きの質問をあとの保存で足すと、足した行だけ空になった。
     ⚠️ 1列ずつ coalesce しない。新しい職位に、前の機種がくっ付く（どの時点の組でもなくなる）。
     ⚠️ 「運んでいない」は、ここの変数で見る（excluded.* で見ない）。3 で親の組を入れたあとは
        excluded.* が空でなくなり、2 より 3 が先に効いて、行の組を親の組で上書きする。
     ⚠️ 適用時期（年月）と lang は、この組に入れない。年月は「答えた月」で、今までどおり毎回書く。 */
  v_no_ctx := v_pos is null and v_fleet is null and v_base is null and v_ctype is null;

  -- ── レート制限 ────────────────────────────────────────
  select * into v_prof from public.profiles where id = v_uid for update;
  if not found then
    begin
      insert into public.profiles (id) values (v_uid);
    exception when others then
      raise exception 'プロフィールが作成されていません。一度ログインし直してください。'
        using errcode = '23503';
    end;
    select * into v_prof from public.profiles where id = v_uid for update;
  end if;
  if v_prof.cond_answers_day is distinct from current_date then
    v_prof.cond_answers_day   := current_date;
    v_prof.cond_answers_today := 0;
  end if;

  v_hash := public.pv_condition_hash(v_uid, v_airline, v_other);

  -- ★ priority の昇順で回す。親は必ず子より priority が小さい（生成側が昇順を検査している）
  --   ので、同じ送信に入っている親は、子を見るときには既に保存済みになる。
  for v_a in
    select e.v as ans, e.ord,
           q.id, q.version, q.kind, q.choice_codes, q.num_min, q.num_max,
           q.has_currency, q.has_note, q.parent, q.parent_when
      from jsonb_array_elements(p->'answers') with ordinality as e(v, ord)
      left join public.pv_condition_questions q
             on q.id = e.v->>'question_id' and q.active
     order by coalesce(q.priority, 32767), e.ord
  loop
    if v_a.id is null then
      v_rej := v_rej || jsonb_build_array(jsonb_build_object(
        'question_id', v_a.ans->>'question_id', 'reason', 'unknown_question'));
      continue;
    end if;

    /* 1日の上限（60件）。
       ★v_held … 対になる額の「あとから回ってくる端」のために取っておいた1件ぶん（下の「★1組」）。
         ・取っておいた端そのものは、ここを通す（その1件ぶんは、先の端を書くときに空きを確かめてある）。
         ・ほかの答えは、取っておいた分を使えない（あいだに入ったスキップや重ねた答えに使わせると、
           取っておいた端が上限で落ちて、先の端だけが残る）。 */
    if not (v_a.ord = any(v_held))
       and v_prof.cond_answers_today + v_saved + cardinality(v_held) >= 60 then
      v_rej := v_rej || jsonb_build_array(jsonb_build_object(
        'question_id', v_a.id, 'reason', 'rate_limited'));
      continue;
    end if;

    -- 親に答えていない人の子の回答は受けない（答えの筋が通らない行を作らない）。
    -- ★すぐ上の親だけでなく、いちばん上の親まで見る（4b の pv_condition_links が
    --   全部の段を並べる）。1段でも条件から外れていたら受けない。
    --   親が無い質問は段が1つも無いので、そのまま通る。
    if exists (
         select 1 from public.pv_condition_links k
          where k.question_id = v_a.id
            and not exists (
              select 1 from public.airline_conditions c
               where c.proof_hash = v_hash and c.question_id = k.parent
                 and (c.answer_code = any(k.parent_when) or c.answer_codes && k.parent_when))) then
      v_rej := v_rej || jsonb_build_array(jsonb_build_object(
        'question_id', v_a.id, 'reason', 'parent_missing'));
      continue;
    end if;

    /* ★「今回はスキップ」。答えは1つも入れず、いつ飛ばしたかだけ残す。
       スキップも1件として保存する（行が無いと3ヶ月黙れない）。
       ⚠️ 再確認をスキップした場合は、前の答えを消さない。skipped_at を立てるだけ。
          消してしまうと「答えたくなかった」が「回答の取り消し」になってしまう。 */
    if coalesce((v_a.ans->>'skip')::boolean, false) then
      insert into public.airline_conditions (
        proof_hash, airline, airline_other, question_id, question_version,
        effective_year, effective_month, "position", fleet, base_iata, contract_type, lang, skipped_at)
      values (
        v_hash, v_airline, v_other, v_a.id, v_a.version,
        v_year, v_month, v_pos, v_fleet, v_base, v_ctype, v_lang, now())
      on conflict (proof_hash, question_id) do update set
        skipped_at = now(), updated_at = now();
      v_skipped := v_skipped + 1;
      v_saved   := v_saved + 1;   -- レート制限の数え上げには含める
      continue;
    end if;

    -- 1件ぶんの検品（4c の1か所。未ログインの預かりも同じものを通る）
    v_one := public.pv_condition_clean(v_a.id, v_a.ans);
    if not coalesce((v_one->>'ok')::boolean, false) then
      v_rej := v_rej || jsonb_build_array(jsonb_build_object(
        'question_id', v_a.id, 'reason', v_one->>'reason'));
      continue;
    end if;
    v_code  := v_one->>'code';
    v_codes := case when jsonb_typeof(v_one->'codes') = 'array'
                    then array(select jsonb_array_elements_text(v_one->'codes')) end;
    v_num   := (v_one->>'num')::numeric;
    v_cur   := v_one->>'currency';
    v_text  := v_one->>'text';
    v_json  := case when jsonb_typeof(v_one->'json') in ('array', 'object') then v_one->'json' end;
    v_share := coalesce((v_one->>'share')::boolean, false);

    /* ★対になる額（低いほう・高いほう）。相手と食い違う額は受け取らない（2026-10-11）。
         どの2問が対か・大小と通貨の比べ方は 4d の2つの関数。ここは「相手の額」を探して渡すだけ。
       相手の額 ＝ **この送信が終わったあとに残る**額。
         ・同じ送信に相手の答えが入っている（スキップは答えではない。複数あれば最後のもの）
              額が在る             … その額と通貨
              額が無い（わからない）… 相手は無い（比べない）
              検品で落ちる         … その答えは保存されないので、いま保存されている額
         ・入っていない／スキップだけ … いま保存されている額
       こうしておくと、1回の送信で 100／200 を 300／400 に直せる（低いほうが先に回るので、300 を
       前の 200 と比べたら通らない）。2つが互いに食い違う送信は、2つとも断る（どちらも保存しない）。
       ⚠️ いま保存されている額を読むとき、skipped_at を見ない。スキップは前の額を消さない
          （上の ⚠️）ので、印の付いた行にも額は残っている。同じ送信のスキップを「相手は無い」とも
          読まない。どちらを外しても「低いほう 100 を持つ人が、高いほう 50」を通してしまう。
       ⚠️ 同じ送信の相手と比べてよいのは、**その質問の最後の答え**だけ。同じ質問を2回入れてきた
          送信（画面は送らない）の先の答えは、あとの答えに上書きされる側なので、その時点で保存されて
          いる相手と比べる。同じ送信の相手と比べると、その相手があとで断られたときに、先の答えだけが
          残って食い違う（100／200 の人に「低い 250・低い 900・高い 300」→ 250／200 が残る）。
       ⚠️ 断った答えは v_saved に数えない（保存した数にも、1日の上限にも入れない）。
       ★1組 ── 同じ送信に、互いに「その質問の最後の答え」で、検品を通る相手が居る2件は、1組（2026-10-11）。
         1組の2件は、**2つとも書くか、2つとも書かない**（額の無い「わからない」の端も、組に入る）。
         上の決まりは「相手も書かれる」ことを当てにして比べている。相手があとで書かれなければ、先に書いた
         端だけが残って食い違う（100／200 の人が、残り1件の日に 300／400 を送る → 300／200）。
         ・先に回ってきた端で、2件ぶんの空きを見る。無ければ、この端を rate_limited で断る（何も取っておかない）。
           あとから回ってくる相手も、同じ所で同じ理由で断られる（数は増えるだけなので、答えは変わらない）。
         ・空きが在れば、相手の1件ぶんを取っておいて（v_held）、この端を書く。
         ・取っておいた相手は、1日の上限を通す。その先で断られることは無い ── 親の筋は2つの端で同じ
           （生成側が、親と parentWhen の違う2問を対にさせない）・検品は同じ関数・対の比べ方は、どちらの
           端から見ても同じ答え。 */
    v_pair := public.pv_condition_range_other(v_a.id);
    if v_pair is not null then
      v_pone := null;
      v_pord := null;
      v_plast := not exists (
        select 1 from jsonb_array_elements(p->'answers') with ordinality as e(v, ord)
         where e.v->>'question_id' = v_a.id and e.ord > v_a.ord
           and not coalesce((e.v->>'skip')::boolean, false));
      if v_plast then
        select e.v, e.ord into v_pans, v_pord
          from jsonb_array_elements(p->'answers') with ordinality as e(v, ord)
         where e.v->>'question_id' = v_pair
           and not coalesce((e.v->>'skip')::boolean, false)
         order by e.ord desc
         limit 1;
        if found then
          v_pone := public.pv_condition_clean(v_pair, v_pans);
        end if;
      end if;
      -- 同じ送信に、保存される形の相手が居る ＝ この2件は1組
      v_punit := coalesce((v_pone->>'ok')::boolean, false);

      if v_num is not null then
        if v_punit then
          v_pnum := (v_pone->>'num')::numeric;
          v_pcur := v_pone->>'currency';
        else
          v_pnum := null;
          v_pcur := null;
          select c.answer_num, c.answer_currency into v_pnum, v_pcur
            from public.airline_conditions c
           where c.proof_hash = v_hash and c.question_id = v_pair;
        end if;
        v_why := public.pv_condition_range_bad(v_a.id, v_num, v_cur, v_pnum, v_pcur);
        if v_why is not null then
          v_rej := v_rej || jsonb_build_array(jsonb_build_object(
            'question_id', v_a.id, 'reason', v_why));
          continue;
        end if;
      end if;

      -- ★1組の先の端。2件ぶんの空きが無ければ、この端を書かない（相手も、あとで同じ所で断られる）
      if v_punit and not (v_a.ord = any(v_held)) then
        if v_prof.cond_answers_today + v_saved + cardinality(v_held) + 2 > 60 then
          v_rej := v_rej || jsonb_build_array(jsonb_build_object(
            'question_id', v_a.id, 'reason', 'rate_limited'));
          continue;
        end if;
        v_held := v_held || v_pord;
      end if;
    end if;

    -- 行に書く、職位・機種・基地・契約の組（決め方は、上の「4つで1組」の 1 と 3）
    if v_no_ctx and v_a.parent is not null then
      /* 3. すぐ上の親の、この人の行の組。親の筋は上で確かめてある（その行は在り、この質問を開く
            答えを持っている）。スキップの印が付いていても、答えは答え ── ここでも印は見ない。
            proof_hash はこの人のこの会社だけのもの ＝ ほかの会社の行・ほかの人の行は読まない。 */
      v_ipos := null; v_ifleet := null; v_ibase := null; v_ictype := null;
      select c."position", c.fleet, c.base_iata, c.contract_type
        into v_ipos, v_ifleet, v_ibase, v_ictype
        from public.airline_conditions c
       where c.proof_hash = v_hash and c.question_id = v_a.parent;
    else
      v_ipos := v_pos; v_ifleet := v_fleet; v_ibase := v_base; v_ictype := v_ctype;
    end if;

    insert into public.airline_conditions (
      proof_hash, airline, airline_other, question_id, question_version,
      answer_code, answer_codes, answer_num, answer_currency, answer_text, text_shared, answer_json,
      effective_year, effective_month, "position", fleet, base_iata, contract_type, lang)
    values (
      v_hash, v_airline, v_other, v_a.id, v_a.version,
      v_code, v_codes, v_num, v_cur, v_text, v_share, v_json,
      v_year, v_month, v_ipos, v_ifleet, v_ibase, v_ictype, v_lang)
    on conflict (proof_hash, question_id) do update set
      question_version = excluded.question_version,
      answer_code      = excluded.answer_code,
      answer_codes     = excluded.answer_codes,
      answer_num       = excluded.answer_num,
      answer_currency  = excluded.answer_currency,
      answer_text      = excluded.answer_text,
      text_shared      = excluded.text_shared,
      answer_json      = excluded.answer_json,
      effective_year   = excluded.effective_year,
      effective_month  = excluded.effective_month,
      -- 2. 4つを1つも運ばない送信は、もう答えの在る行の組を動かさない（4列とも同じ条件 ＝ 1組）。
      --    答えの無い行（スキップの印だけ）は、excluded の組（送信の組か、親の組）を受け取る。
      --    右辺の airline_conditions.* は、この上書きの前の行。
      "position"       = case when v_no_ctx and num_nonnulls(airline_conditions.answer_code,
                                     airline_conditions.answer_codes, airline_conditions.answer_num,
                                     airline_conditions.answer_text, airline_conditions.answer_json) > 0
                              then airline_conditions."position" else excluded."position" end,
      fleet            = case when v_no_ctx and num_nonnulls(airline_conditions.answer_code,
                                     airline_conditions.answer_codes, airline_conditions.answer_num,
                                     airline_conditions.answer_text, airline_conditions.answer_json) > 0
                              then airline_conditions.fleet else excluded.fleet end,
      base_iata        = case when v_no_ctx and num_nonnulls(airline_conditions.answer_code,
                                     airline_conditions.answer_codes, airline_conditions.answer_num,
                                     airline_conditions.answer_text, airline_conditions.answer_json) > 0
                              then airline_conditions.base_iata else excluded.base_iata end,
      contract_type    = case when v_no_ctx and num_nonnulls(airline_conditions.answer_code,
                                     airline_conditions.answer_codes, airline_conditions.answer_num,
                                     airline_conditions.answer_text, airline_conditions.answer_json) > 0
                              then airline_conditions.contract_type else excluded.contract_type end,
      lang             = excluded.lang,
      -- ★スキップしていた質問に、あとから本当に答えた。行は増やさず印だけ消す
      skipped_at       = null,
      updated_at       = now();

    v_saved := v_saved + 1;
    v_held := array_remove(v_held, v_a.ord);   -- 取っておいた端なら、その1件ぶんはここで使い終わり
  end loop;

  update public.profiles set
    cond_answers_day   = v_prof.cond_answers_day,
    cond_answers_today = v_prof.cond_answers_today + v_saved
  where id = v_uid;

  /* スキップだけの行は「答えた項目」に数えない
     （num_nonnulls = 答えの列のうち null でない数。0 なら中身はスキップの印だけ）
     ★話題の入口からだけ出す質問（topic_only）への答えも数えない（2026-10-04）。
       一覧に出ない質問を分子に入れると、分母（一覧に出る質問の数）を超える。
       保存はしている（saved には入る）。数えないだけ */
  select count(*) into v_total
    from public.airline_conditions c
    join public.pv_condition_questions q on q.id = c.question_id
   where c.proof_hash = v_hash
     and not q.topic_only
     and num_nonnulls(c.answer_code, c.answer_codes, c.answer_num, c.answer_text, c.answer_json) > 0;

  return jsonb_build_object(
    'ok', true,
    'airline', v_airline,
    'saved', v_saved - v_skipped,
    'skipped', v_skipped,
    'rejected', v_rej,
    -- 詳細ページの「あなたが答えた項目：7／48」に使う。進捗率（%）は出さない。
    -- ★分母は一覧に出る質問だけ。topic_only を入れると、一覧に無い質問の数だけ「未回答」が残り続ける
    'answered_total', v_total,
    'questions_total', (select count(*) from public.pv_condition_questions
                         where active and not topic_only));
end $$;

revoke all on function public.submit_airline_conditions(jsonb) from public, anon;
grant execute on function public.submit_airline_conditions(jsonb) to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 6. 次に聞く質問
-- ════════════════════════════════════════════════════════════════
-- 並べる順： ① boost（★まだ1問も答えていない人だけ・大きいほど先）
--            → ② Tier（A→B→C） → ③ その会社での回答者が少ない順
--              （③ は、その会社の回答を見てよい人にだけ効く ＝ pv_contrib_sees が 'open' の人。ほかの人には数を使わない）
--            → ④ 最終確認が古い順 → ⑤ priority
-- ★ 親を持つ質問は、その人自身の親への答えが parent_when に入るときだけ候補にする。
--   親の親があるときは、いちばん上まで条件が続いているときだけ（4b）。
--   初回の人には親のない Tier A が出て、答えるほど出せる質問が増える。
--
-- ★ 話題の入口からだけ出す質問（topic_only）は、ここでは**候補に入れない**（2026-10-04）。
--   あの質問は会社の概要の画面の入口（通勤タクシー／機長昇格）から来た人にだけ出す。
--   提出直後の1問枠にも一覧にも混ぜないので、今までの質問に集まる回答は薄まらない
--   （オーナー判断「4問を足し、その話題の入口から来た人にだけ出す」。経緯は pv-conditions.mjs の冒頭）。
--   ⚠️ 窓が切れても戻ってこない（再確認にも出さない）。聞き直すのも話題の入口から。
--   ⚠️ mine_count にも数えない。数えると、話題の入口で先に1問答えただけの人が
--      「もう答え始めた人」になり、最初の3問（boost）が出なくなる。
--
-- ★もう一度聞いてよくなる時期は、その人のその質問の状態で変える。
--   全部を1年にすると聞けたはずの回答を1年取り逃し、全部を短くすると「またこれか」になる。
--      答えた       … 制度そのものが変わるまで聞く意味がない → answer_reask_days
--      わからない   … 本人が知らなかっただけ。異動や昇格で分かる → unknown_reask_days
--      スキップ     … 今は答えたくなかっただけ                 → skip_reask_days
--   ⚠️ 日数を SQL に直書きしない。pv_condition_settings（生成元 pv-conditions.mjs の SETTINGS）
--      を読む。ここに数字を戻すと、画面（pv-conditions.json）と食い違っても誰も気づかない。
--
-- 返り値の mine_count / mine_code は画面のためにある。
--   mine_count … その会社でその人が答えた数。画面は 3問 or 1問をこれで決める
--                （「初回の給与提出か」で分けない。会社を変えた人がまた3問に戻る）
--   mine_code  … 窓が切れて戻ってきた質問の、前回の答え。
--                「以前『はい』と回答しました。現在も同じですか？」を出すのに使う
create or replace function public.next_condition_questions(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_airline text := nullif(btrim(p->>'airline'), '');
  v_other   text := nullif(btrim(p->>'airline_other'), '');
  v_micro   boolean := coalesce((p->>'micro')::boolean, false);
  v_limit   int := least(greatest(coalesce(nullif(btrim(p->>'limit'), '')::int, 1), 1), 30);
  v_hash    text;
  v_rows    jsonb;
  v_count   int;
  v_ans_d   int := public.pv_condition_setting('answer_reask_days',  365);
  v_unk_d   int := public.pv_condition_setting('unknown_reask_days', 180);
  v_skip_d  int := public.pv_condition_setting('skip_reask_days',     90);
  v_open    boolean := false;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if v_airline is null
     or not exists (select 1 from public.pv_airlines where code = v_airline) then
    raise exception '航空会社が正しくありません' using errcode = '22023';
  end if;
  if v_airline <> 'other' then v_other := null; end if;

  v_hash := public.pv_condition_hash(v_uid, v_airline, v_other);

  -- ★ほかの人の回答の数（下の n）を、並びにも返事にも使ってよい相手かどうか（2026-10-11）。
  --   決めるのは db/contrib.sql の pv_contrib_sees の1か所。そこが「開いている」と言った人にだけ使う。
  --   あのファイルは、このファイルより後に貼る。まだ無い DB では、誰にも使わない（閉じる側に倒す・止めない）。
  --   ⚠️ 2つの文に分けてある。1つの式（a and b）にまとめると、関数が無い DB で式ごと止まる。
  if to_regprocedure('public.pv_contrib_sees(text)') is not null then
    v_open := coalesce(public.pv_contrib_sees(v_airline) = 'open', false);
  end if;

  -- その会社でこの人が実際に答えた数（スキップだけの行と、話題の入口からだけ出す質問は数えない）
  select count(*) into v_count
    from public.airline_conditions c
    join public.pv_condition_questions q on q.id = c.question_id
   where c.proof_hash = v_hash
     and not q.topic_only
     and num_nonnulls(c.answer_code, c.answer_codes, c.answer_num, c.answer_text, c.answer_json) > 0;

  with mine as (
    select question_id, answer_code, answer_codes, updated_at, skipped_at,
           num_nonnulls(answer_code, answer_codes, answer_num, answer_text, answer_json) > 0 as answered
      from public.airline_conditions where proof_hash = v_hash
  ),
  cand as (
    select q.id, q.section, q.tier, q.kind, q.micro, q.priority,
           case when v_count = 0 then q.boost else 0 end as boost,
           (select count(distinct c.proof_hash)
              from public.airline_conditions c
             where c.airline = v_airline and c.question_id = q.id
               and num_nonnulls(c.answer_code, c.answer_codes, c.answer_num,
                                c.answer_text, c.answer_json) > 0) as n,
           (select m.updated_at from mine m where m.question_id = q.id) as mine_at,
           /* 前回の答え。再確認の文言に使う。スキップだけの行には付かない */
           (select m.answer_code from mine m where m.question_id = q.id and m.answered) as mine_code,
           /* ★次にこの人へ聞いてよくなる時刻。答えとスキップの両方があれば遅いほうを採る
              （再確認をスキップした人に、翌週また同じことを聞かないため）。
              greatest は null を無視するので、どちらか片方だけでも正しく出る */
           (select greatest(
                     case when m.answered then m.updated_at
                          + make_interval(days => case when m.answer_code = 'unknown'
                                                       then v_unk_d else v_ans_d end) end,
                     case when m.skipped_at is not null
                          then m.skipped_at + make_interval(days => v_skip_d) end)
              from mine m where m.question_id = q.id) as mine_due
      from public.pv_condition_questions q
     where q.active
       -- 話題の入口からだけ出す質問は、1問枠にも一覧の「次の質問」にも出さない
       and not q.topic_only
       and (not v_micro or q.micro)
       /* 親の条件が、いちばん上まで続いている質問だけ（4b の pv_condition_links）。
          親が無い質問は段が1つも無いので、そのまま通る。
          ★すぐ上の親だけを見ると、制度を「ない」に答え直した人へ、その下の下の質問を出してしまう */
       and not exists (
             select 1 from public.pv_condition_links k
              where k.question_id = q.id
                and not exists (select 1 from mine m
                                 where m.question_id = k.parent
                                   and (m.answer_code = any(k.parent_when)
                                        or m.answer_codes && k.parent_when)))
  ),
  pick as (
    select id, section, tier, kind, micro, priority, n, mine_code,
           row_number() over (
             order by boost desc,
                      case tier when 'A' then 0 when 'B' then 1 else 2 end,
                      case when v_open then n else 0 end asc,
                      mine_at asc nulls first,
                      priority asc) as rn
      from cand
     -- まだ一度も触っていない（mine_due が null）か、聞いてよい時刻を過ぎたもの
     where mine_due is null or mine_due <= now()
  )
  -- ★答えた人数（n）は返さない（2026-10-10）。並べる順にだけ使う。
  --   他人の回答の数は、3人の壁も立場も通らないまま会員へ出ていた。読む画面は無い。
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'section', section, 'tier', tier, 'kind', kind,
           'micro', micro, 'priority', priority,
           'mine_code', mine_code) order by rn), '[]'::jsonb)
    into v_rows
    from pick where rn <= v_limit;

  return jsonb_build_object(
    'ok', true, 'airline', v_airline, 'questions', v_rows,
    -- 画面が「3問 or 1問」を決めるのに使う。RPC をもう1本増やさないための返り値
    'mine_count', v_count);
end $$;

revoke all on function public.next_condition_questions(jsonb) from public, anon;
grant execute on function public.next_condition_questions(jsonb) to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 7. 自分の回答（詳細ページの初期表示）
-- ════════════════════════════════════════════════════════════════
-- user_id を持たないので、pv_airlines を総当たりして自分の proof_hash を作る
-- （db/pay-reports.sql の my_pay_reports と同じ手）。
--
-- ★ answers には、話題の入口からだけ出す質問（topic_only）への答えも**入れて返す**（2026-10-04）。
--   話題の入口の画面が、前に選んだ答えを最初から出すのに要る。
--   answered_total と questions_total は**一覧に出る質問だけ**を数える（5 の返り値と同じ決め方）。
--   ⚠️ answered_total を answers の長さに戻さない。話題の質問に答えた人だけ「N／48」の N が
--      増え、全部答えた人は分母を超える。
create or replace function public.my_airline_conditions(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_airline text := nullif(btrim(p->>'airline'), '');
  v_other   text := nullif(btrim(p->>'airline_other'), '');
  v_rows    jsonb;
  v_listed  int;   -- 一覧に出る質問への答えの数（topic_only を除く）
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if v_airline is not null and v_airline <> 'other' then v_other := null; end if;

  with mine as (
    select a.code as airline,
           public.pv_condition_hash(v_uid, a.code,
             case when a.code = 'other' then v_other end) as hash
      from public.pv_airlines a
     where v_airline is null or a.code = v_airline
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'airline',    c.airline,
           'question_id', c.question_id,
           'code',       c.answer_code,
           'codes',      to_jsonb(c.answer_codes),
           'num',        c.answer_num,
           'currency',   c.answer_currency,
           'text',       c.answer_text,
           -- 補足を資格のある会員に見せてよいか。本人の画面が、直していない補足の印を
           -- 勝手に付けたり外したりしないために返す（返すのは本人の行だけ）。
           'shared',     c.text_shared,
           'json',       c.answer_json,
           'year',       c.effective_year,
           'month',      c.effective_month,
           'updated_at', c.updated_at) order by c.airline, q.priority), '[]'::jsonb),
         count(*) filter (where not q.topic_only)
    into v_rows, v_listed
    from mine
    join public.airline_conditions c on c.proof_hash = mine.hash
     -- スキップだけの行は「自分の回答」ではない（詳細ページに空欄として出さない）
     and num_nonnulls(c.answer_code, c.answer_codes, c.answer_num,
                      c.answer_text, c.answer_json) > 0
    join public.pv_condition_questions q on q.id = c.question_id;

  return jsonb_build_object(
    'ok', true,
    'answers', v_rows,
    'answered_total', v_listed,
    'questions_total', (select count(*) from public.pv_condition_questions
                         where active and not topic_only));
end $$;

revoke all on function public.my_airline_conditions(jsonb) from public, anon;
grant execute on function public.my_airline_conditions(jsonb) to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 8. 貢献者の集計（オーナーが SQL Editor で叩く。誰にも grant しない）
-- ════════════════════════════════════════════════════════════════
-- Founding Contributor を後から遡って認定できるようにするためのもの。
-- 権利の列は作らない＝データが全部残っているので、数え方はいつでも変えられる。
-- agreed は選択式だけ数える（数値の一致は「同じ答え」とは限らないため）。
create or replace function public.pv_contributor_stats()
returns table (
  proof_hash  text,
  airline     text,
  answers     bigint,
  agreed      bigint,
  corrections bigint,
  first_at    timestamptz,
  last_at     timestamptz)
language sql
security definer
set search_path = public, extensions
as $$
  with agree as (
    select c.proof_hash, count(*) as n
      from public.airline_conditions c
      join public.airline_conditions o
        on o.airline = c.airline
       and o.question_id = c.question_id
       and o.proof_hash <> c.proof_hash
       and o.answer_code is not distinct from c.answer_code
     where c.answer_code is not null and c.answer_code <> 'unknown'
     group by c.proof_hash
  )
  select c.proof_hash,
         min(c.airline),
         count(*),
         coalesce(max(a.n), 0),
         count(*) filter (where c.updated_at > c.created_at + interval '1 second'),
         min(c.created_at),
         max(c.updated_at)
    from public.airline_conditions c
    left join agree a on a.proof_hash = c.proof_hash
   where num_nonnulls(c.answer_code, c.answer_codes, c.answer_num,
                      c.answer_text, c.answer_json) > 0
   group by c.proof_hash
   order by count(*) desc, min(c.created_at)
$$;

revoke all on function public.pv_contributor_stats() from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 9. 集計ビュー（k ≧ 3・直接は読ませない）
-- ════════════════════════════════════════════════════════════════
-- security_invoker を立てない＝所有者権限で走る。読むのは db/contrib.sql の
-- pv_contrib_facts だけ（立場を見てから返す）。anon / authenticated には select を渡さない。
--
--  ・粒度は 会社 × 質問 だけ。position / fleet / base_iata / contract_type は
--    列にも group by にも入れない（準識別子。年収ビューが base_iata を外したのと同じ判断）
--  ・「わからない」は n に数えない（n_unknown で別に見せる）
--  ・スキップだけの行（skipped_at だけの行）は1人として数えない
--  ・親の条件から外れた回答は数えない（親を答え直して、その下が画面から消えた人のぶん）
--  ・answer_text / answer_json は1列も出さない
--  ・通貨つきの質問は median_num を出さない（通貨の違う額を1つの数字にまとめない）
--  ・airline_other がある行は除外（自由入力の社名そのものが識別子）
--  ・answer_dist（答えごとの人数）を持つのは、並んだ答えの片方を「最多」と書かないため。この列は外へ出さない ──
--    db/contrib.sql の pv_contrib_facts が、answer_dist・n・kind から「最多」と書いてよい答え（lead）だけを決めて返す
drop view if exists public.airline_condition_facts;

-- 「答えた1人」として数えてよい行（2026-10-30 にビューから切り出した）。
--   使うのは、このビューと db/ask-own-airline.sql の pv_ask_filled（「埋まった」質問）の2つ。
--   ★数え方を1か所にするため。写しにすると、公開の集計と「もう聞かない」の線が黙ってずれる。
--   ⚠️ 返す列を変えるときは、上の drop view の後ろで drop function してから作り直す（ビューが依存している）。
--   ★誰にも grant しない。呼ぶのはビュー（読む口は pv_contrib_facts）と security definer の関数だけ。
create or replace function public.pv_condition_ans()
returns table (airline text, question_id text, proof_hash text, updated_at timestamptz,
               answer_code text, answer_num numeric, answer_codes text[],
               section text, tier text, kind text, is_opinion boolean, has_currency boolean)
language sql
stable
set search_path = public, extensions
as $fn$
  select c.airline, c.question_id, c.proof_hash, c.updated_at,
         c.answer_code, c.answer_num::numeric,
         case when q.kind = 'multi' then c.answer_codes end,
         q.section, q.tier::text, q.kind, q.is_opinion, q.has_currency
    from public.airline_conditions c
    join public.pv_condition_questions q on q.id = c.question_id and q.active
   where c.airline_other is null
     -- ★スキップだけの行は1人として数えない（answer_code が null なので
     --   下の n の filter（<> 'unknown'）をすり抜けてしまう）
     and num_nonnulls(c.answer_code, c.answer_codes, c.answer_num,
                      c.answer_text, c.answer_json) > 0
     -- ★親の条件が、いちばん上まで続いている回答だけを数える（2026-10-04・4b）。
     --   制度を「ない」に答え直した人の、その下の質問への古い答えを数え続けない。
     --   行は消していないので、答え直せばまた数える。
     and not exists (
           select 1 from public.pv_condition_links k
            where k.question_id = c.question_id
              and not exists (
                select 1 from public.airline_conditions p
                 where p.proof_hash = c.proof_hash and p.question_id = k.parent
                   and (p.answer_code = any(k.parent_when)
                        or p.answer_codes && k.parent_when)))
$fn$;
revoke all on function public.pv_condition_ans() from public, anon, authenticated;

create view public.airline_condition_facts as
with ans as (
  select * from public.pv_condition_ans()
),
picked as (
  select airline, question_id, proof_hash, answer_code as code
    from ans where answer_code is not null
  union all
  select a.airline, a.question_id, a.proof_hash, x
    from ans a cross join lateral unnest(a.answer_codes) as x
   where a.answer_codes is not null
),
counted as (
  select airline, question_id, code, count(distinct proof_hash) as c
    from picked where code <> 'unknown'
   group by airline, question_id, code
),
dist as (
  select airline, question_id,
         jsonb_object_agg(code, c) as answer_dist,
         (array_agg(code order by c desc, code))[1] as top_code,
         max(c) as top_n
    from counted
   group by airline, question_id
),
agg as (
  select airline, question_id,
         min(section) as section, min(tier) as tier, min(kind) as kind,
         bool_or(is_opinion) as is_opinion,
         count(distinct proof_hash) filter (where answer_code is distinct from 'unknown') as n,
         count(distinct proof_hash) filter (where answer_code = 'unknown') as n_unknown,
         -- ★通貨つきの質問（訓練費用の Bond の額・着陸手当の額）では、中央値を出さない（2026-10-09）。
         --   通貨の違う額を1つの数字にまとめない。円とドルの数字をそのまま並べた真ん中は、
         --   どの通貨の額でもない。人数（n）は今までどおり出る。
         percentile_cont(0.5) within group (order by answer_num)
           filter (where has_currency is not true) as median_num,
         max(updated_at) as last_confirmed_at
    from ans
   group by airline, question_id
)
select a.airline,
       a.question_id,
       a.section,
       a.tier,
       a.kind,
       a.is_opinion,
       a.n::int         as n,
       a.n_unknown::int as n_unknown,
       d.top_code,
       -- 10%刻みに丸める（人数が透けないように）
       case when d.top_n is not null
            then (round(100.0 * d.top_n / a.n / 10) * 10)::int end as top_share,
       d.answer_dist,
       case when a.kind = 'num' then round(a.median_num::numeric, 1) end as median_num,
       a.last_confirmed_at
  from agg a
  left join dist d on d.airline = a.airline and d.question_id = a.question_id
 where a.n >= 3;

-- ★直接は誰にも読ませない（2026-10-10）。読む口は db/contrib.sql の pv_contrib_facts だけ
--   ＝ 見ている人の立場をサーバが見てから返す。3人の壁は「誰に見せるか」の代わりにならない。
--   ⚠️ この revoke を create view から離さない。Supabase は public に作った表・ビューへ
--      anon / authenticated の全権限を自動で付ける（default privileges）ので、
--      ビューを作り直すたびに開く。ここで閉じ直さないと、このファイルだけ貼り直した回に公開へ戻る。
revoke all on public.airline_condition_facts from public, anon, authenticated;

comment on view public.airline_condition_facts is
  '待遇の集計。会社×質問の粒度、3人以上が答えた項目だけ。直接は誰にも読ませない（読む口は pv_contrib_facts）。「わからない」は n に数えない。個票・自由記述は出さない。';
