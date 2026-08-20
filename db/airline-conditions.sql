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
  '待遇・働き方の回答。1回答＝1行。個票は非公開。公開は airline_condition_facts（k≧3）のみ。';
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
    select e.v as ans,
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

    if v_prof.cond_answers_today + v_saved >= 60 then
      v_rej := v_rej || jsonb_build_array(jsonb_build_object(
        'question_id', v_a.id, 'reason', 'rate_limited'));
      continue;
    end if;

    -- 親に答えていない人の子の回答は受けない（答えの筋が通らない行を作らない）
    if v_a.parent is not null
       and not exists (
         select 1 from public.airline_conditions c
          where c.proof_hash = v_hash and c.question_id = v_a.parent
            and (c.answer_code = any(v_a.parent_when) or c.answer_codes && v_a.parent_when)) then
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

    v_bad   := null;
    v_code  := nullif(btrim(v_a.ans->>'code'), '');
    v_codes := null;
    v_num   := null;
    v_cur   := upper(nullif(btrim(v_a.ans->>'currency'), ''));
    v_text  := nullif(btrim(v_a.ans->>'text'), '');
    v_json  := case when jsonb_typeof(v_a.ans->'json') in ('array', 'object')
                    then v_a.ans->'json' end;

    if jsonb_typeof(v_a.ans->'codes') = 'array' then
      select array_agg(distinct btrim(x)) into v_codes
        from jsonb_array_elements_text(v_a.ans->'codes') as t(x)
       where btrim(x) <> '';
    end if;

    -- 数値は先に形を見る（そのまま cast すると取引ごと落ちる）
    if nullif(btrim(coalesce(v_a.ans->>'num', '')), '') is not null then
      if btrim(v_a.ans->>'num') ~ '^-?[0-9]+(\.[0-9]+)?$' then
        v_num := btrim(v_a.ans->>'num')::numeric;
      else
        v_bad := 'bad_number';
      end if;
    end if;

    if v_bad is null then
      if v_code = 'unknown' then
        -- 「わからない」はどの kind でも受ける（翌月また同じことを聞かないため）
        v_codes := null; v_num := null; v_cur := null; v_json := null;

      elsif v_a.kind = 'choice' then
        if v_code is null then v_bad := 'missing_code';
        elsif not (v_code = any(v_a.choice_codes)) then v_bad := 'bad_code';
        end if;
        v_codes := null; v_num := null; v_cur := null; v_json := null;

      elsif v_a.kind = 'multi' then
        if coalesce(array_length(v_codes, 1), 0) = 0 then v_bad := 'missing_code';
        elsif exists (select 1 from unnest(v_codes) x where not (x = any(v_a.choice_codes)))
          then v_bad := 'bad_code';
        end if;
        v_code := null; v_num := null; v_cur := null; v_json := null;

      elsif v_a.kind = 'num' then
        if v_num is null then v_bad := 'missing_num';
        elsif v_a.num_min is not null and v_num < v_a.num_min then v_bad := 'out_of_range';
        elsif v_a.num_max is not null and v_num > v_a.num_max then v_bad := 'out_of_range';
        end if;
        if v_bad is null and v_a.has_currency then
          if v_cur is null or not exists (select 1 from public.pv_currencies where code = v_cur) then
            v_bad := 'bad_currency';
          end if;
        elsif not v_a.has_currency then
          v_cur := null;
        end if;
        v_code := null; v_codes := null; v_json := null;

      elsif v_a.kind = 'lines' then
        if v_json is null then v_bad := 'missing_json';
        elsif char_length(v_json::text) > 4000 then v_bad := 'too_long';
        end if;
        v_code := null; v_codes := null; v_num := null; v_cur := null;
      end if;
    end if;

    -- 自由記述は、その質問が持っているときだけ受ける
    if v_bad is null and v_text is not null then
      if not v_a.has_note then v_text := null;
      elsif char_length(v_text) > 300 then v_bad := 'text_too_long';
      end if;
    end if;

    if v_bad is not null then
      v_rej := v_rej || jsonb_build_array(jsonb_build_object(
        'question_id', v_a.id, 'reason', v_bad));
      continue;
    end if;

    insert into public.airline_conditions (
      proof_hash, airline, airline_other, question_id, question_version,
      answer_code, answer_codes, answer_num, answer_currency, answer_text, answer_json,
      effective_year, effective_month, "position", fleet, base_iata, contract_type, lang)
    values (
      v_hash, v_airline, v_other, v_a.id, v_a.version,
      v_code, v_codes, v_num, v_cur, v_text, v_json,
      v_year, v_month, v_pos, v_fleet, v_base, v_ctype, v_lang)
    on conflict (proof_hash, question_id) do update set
      question_version = excluded.question_version,
      answer_code      = excluded.answer_code,
      answer_codes     = excluded.answer_codes,
      answer_num       = excluded.answer_num,
      answer_currency  = excluded.answer_currency,
      answer_text      = excluded.answer_text,
      answer_json      = excluded.answer_json,
      effective_year   = excluded.effective_year,
      effective_month  = excluded.effective_month,
      "position"       = excluded."position",
      fleet            = excluded.fleet,
      base_iata        = excluded.base_iata,
      contract_type    = excluded.contract_type,
      lang             = excluded.lang,
      -- ★スキップしていた質問に、あとから本当に答えた。行は増やさず印だけ消す
      skipped_at       = null,
      updated_at       = now();

    v_saved := v_saved + 1;
  end loop;

  update public.profiles set
    cond_answers_day   = v_prof.cond_answers_day,
    cond_answers_today = v_prof.cond_answers_today + v_saved
  where id = v_uid;

  /* スキップだけの行は「答えた項目」に数えない
     （num_nonnulls = 答えの列のうち null でない数。0 なら中身はスキップの印だけ） */
  select count(*) into v_total from public.airline_conditions
   where proof_hash = v_hash
     and num_nonnulls(answer_code, answer_codes, answer_num, answer_text, answer_json) > 0;

  return jsonb_build_object(
    'ok', true,
    'airline', v_airline,
    'saved', v_saved - v_skipped,
    'skipped', v_skipped,
    'rejected', v_rej,
    -- 詳細ページの「あなたが答えた項目：7／26」に使う。進捗率（%）は出さない
    'answered_total', v_total,
    'questions_total', (select count(*) from public.pv_condition_questions where active));
end $$;

revoke all on function public.submit_airline_conditions(jsonb) from public, anon;
grant execute on function public.submit_airline_conditions(jsonb) to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 6. 次に聞く質問
-- ════════════════════════════════════════════════════════════════
-- 並べる順： ① boost（★まだ1問も答えていない人だけ・大きいほど先）
--            → ② Tier（A→B→C） → ③ その会社での回答者が少ない順
--            → ④ 最終確認が古い順 → ⑤ priority
-- ★ 親を持つ質問は、その人自身の親への答えが parent_when に入るときだけ候補にする。
--   初回の人には親のない Tier A が出て、答えるほど出せる質問が増える。
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

  -- その会社でこの人が実際に答えた数（スキップだけの行は数えない）
  select count(*) into v_count
    from public.airline_conditions
   where proof_hash = v_hash
     and num_nonnulls(answer_code, answer_codes, answer_num, answer_text, answer_json) > 0;

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
       and (not v_micro or q.micro)
       and (q.parent is null
            or exists (select 1 from mine m
                        where m.question_id = q.parent
                          and (m.answer_code = any(q.parent_when)
                               or m.answer_codes && q.parent_when)))
  ),
  pick as (
    select id, section, tier, kind, micro, priority, n, mine_code,
           row_number() over (
             order by boost desc,
                      case tier when 'A' then 0 when 'B' then 1 else 2 end,
                      n asc,
                      mine_at asc nulls first,
                      priority asc) as rn
      from cand
     -- まだ一度も触っていない（mine_due が null）か、聞いてよい時刻を過ぎたもの
     where mine_due is null or mine_due <= now()
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'section', section, 'tier', tier, 'kind', kind,
           'micro', micro, 'priority', priority, 'n', n,
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
           'json',       c.answer_json,
           'year',       c.effective_year,
           'month',      c.effective_month,
           'updated_at', c.updated_at) order by c.airline, q.priority), '[]'::jsonb)
    into v_rows
    from mine
    join public.airline_conditions c on c.proof_hash = mine.hash
     -- スキップだけの行は「自分の回答」ではない（詳細ページに空欄として出さない）
     and num_nonnulls(c.answer_code, c.answer_codes, c.answer_num,
                      c.answer_text, c.answer_json) > 0
    join public.pv_condition_questions q on q.id = c.question_id;

  return jsonb_build_object(
    'ok', true,
    'answers', v_rows,
    'answered_total', jsonb_array_length(v_rows),
    'questions_total', (select count(*) from public.pv_condition_questions where active));
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
-- 9. 公開集計ビュー（k ≧ 3）
-- ════════════════════════════════════════════════════════════════
-- security_invoker を立てない＝所有者権限で走る。だから anon が
-- airline_conditions を1行も読めないまま、この集計だけを読める。
--
--  ・粒度は 会社 × 質問 だけ。position / fleet / base_iata / contract_type は
--    列にも group by にも入れない（準識別子。年収ビューが base_iata を外したのと同じ判断）
--  ・「わからない」は n に数えない（n_unknown で別に見せる）
--  ・スキップだけの行（skipped_at だけの行）は1人として数えない
--  ・answer_text / answer_json は1列も出さない
--  ・airline_other がある行は除外（自由入力の社名そのものが識別子）
--  ・answer_dist を出すのは、回答が割れたときに多数決で事実にしないため。
--    画面は「8名中7名が『あり』」のように、割れていることが見える形で出す
drop view if exists public.airline_condition_facts;
create view public.airline_condition_facts as
with ans as (
  select c.airline, c.question_id, c.proof_hash, c.updated_at,
         c.answer_code, c.answer_num,
         case when q.kind = 'multi' then c.answer_codes end as answer_codes,
         q.section, q.tier, q.kind, q.is_opinion
    from public.airline_conditions c
    join public.pv_condition_questions q on q.id = c.question_id and q.active
   where c.airline_other is null
     -- ★スキップだけの行は1人として数えない（answer_code が null なので
     --   下の n の filter（<> 'unknown'）をすり抜けてしまう）
     and num_nonnulls(c.answer_code, c.answer_codes, c.answer_num,
                      c.answer_text, c.answer_json) > 0
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
         percentile_cont(0.5) within group (order by answer_num) as median_num,
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

grant select on public.airline_condition_facts to anon, authenticated;

comment on view public.airline_condition_facts is
  '待遇の公開集計。会社×質問の粒度、3人以上が答えた項目だけ。「わからない」は n に数えない。個票・自由記述は出さない。';
