-- ════════════════════════════════════════════════════════════════
-- 「情報を追加」── 未ログインの回答を預かる／ログイン後に引き継ぐ／補足を資格者へ返す
-- ════════════════════════════════════════════════════════════════
-- 2026-10-07 オーナー指定:
--   「情報を追加」は未ログインでも回答・保存できる。
--   本人は自分の回答・補足を確認／修正できる。
--   他人の勤務回答・補足は、ログイン＋給与提出資格が要る。一般の追加結果はログイン後。
--
-- ■ 貼る順（必ずこの順）
--     db/pay-rows.sql → db/conditions.generated.sql → db/airline-conditions.sql
--     → db/work-months.sql → **このファイル**
--   検品（pv_work_month_clean / pv_condition_clean）と、見ている人の立場（pv_work_level）は
--   前のファイルに在るものを**呼ぶ**。ここに写しを作らない。
--
-- ■ このファイルの約束
--   1. **預かった回答は、鍵を持っている端末にしか返さない。**
--      鍵はサーバが作る（192ビットの乱数）。表に残すのはその sha256 だけ ＝ 表を覗いても鍵は分からない。
--      社名・自己申告・公開 URL は本人の証拠にしない。画面が作った鍵も受け付けない
--      （表に無い鍵は「知らない鍵」＝ 新しい鍵を作って返す）。
--   2. **預かっているあいだは、集計にも、他人の画面にも出さない。**
--      集計（3人以上で幅を出す・公開の集計ビュー）が数えるのは会員の行だけ。
--      未ログインの回答を数えると、1人が鍵を3つ作るだけで「3人の壁」を破れる。
--      ログインして引き継いだ時に、はじめて会員の行になり、集計に入る。
--   3. **預かる時の検品は、会員の入口と同じ関数。** 預かった時に通ったものが、
--      引き継ぐ時に別の決まりで落ちることが無い（給与の預かりと同じ考え方）。
--   4. **引き継ぎは、ログインした本人が、鍵を出して行う。** 鍵を知らない会員は
--      何も引き取れない。引き継いだ行は、会員の入口（submit_work_month /
--      submit_airline_conditions）をそのまま通って入る ＝ 連投の制限も、親の条件も同じ。
--   5. **ここは資格を1つも付けない。** 給与の鍵・口コミの鍵・確認済みの印のどれにも触らない。
--      勤務や補足を出しただけの人は、今までどおり何も開かない。
--   6. **他人の補足は、立場をサーバが見てから返す。** 返すのは文と質問の名前だけ
--      （いつ・誰が・職位・機種・選んだ答えは返さない ＝ 3人の壁の外へ個票を出さない）。
--        未ログイン          … 1文字も返さない
--        ログインしただけ     … 勤務・訓練（roster / career）と月の勤務**以外**の補足
--        給与の鍵が生きている … 全部
--      「見せます」と書いた画面から送られた補足（text_shared）だけ。昔の補足は本人だけのまま。
--
-- ■ 何度流しても同じ結果になる（冪等）。

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regprocedure('public.pv_work_month_clean(jsonb)') is null
     or to_regprocedure('public.pv_work_level()') is null then
    raise exception '先に db/work-months.sql を実行してください（pv_work_month_clean / pv_work_level が無い）';
  end if;
  if to_regprocedure('public.pv_condition_clean(text, jsonb)') is null then
    raise exception '先に db/airline-conditions.sql を実行してください（pv_condition_clean が無い）';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. 表（どちらも、誰にも読ませない）
-- ════════════════════════════════════════════════════════════════
-- 1-a. 鍵。1端末＝1本。鍵そのものは持たない（sha256 だけ）。
create table if not exists public.pv_contrib_keys (
  key_hash    text primary key,
  created_at  timestamptz not null default now(),
  -- 最後に保存した時刻。ここから 90日（pv_contrib_ttl）で預かりごと消える
  last_at     timestamptz not null default now(),
  -- 鍵を作った回線の、その日だけの印（鍵の作りすぎを数えるためだけ。IP そのものは持たない）
  ip_day_hash text,
  -- 連投の数え（1本の鍵で1日に保存できる件数）
  saves_day   date,
  saves_today int not null default 0
);
alter table public.pv_contrib_keys drop constraint if exists pv_contrib_keys_hash_ck;
alter table public.pv_contrib_keys add constraint pv_contrib_keys_hash_ck check (
  key_hash ~ '^[0-9a-f]{64}$');

-- 1-b. 預かっている回答。1行＝1か月の勤務、または1つの質問への答え。
--   kind     … 'work'（月の勤務）／'cond'（待遇・働き方の質問）
--   item_key … work は 'YYYY-MM'／cond は質問の id。同じものを出し直したら上書き（行は増えない）
--   payload  … 検品を通した形そのまま（引き継ぐ時に、会員の入口へそのまま渡す）
create table if not exists public.pv_contrib_pending (
  id          bigint generated always as identity primary key,
  key_hash    text not null references public.pv_contrib_keys(key_hash) on delete cascade,
  kind        text not null,
  airline     text not null references public.pv_airlines(code),
  item_key    text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.pv_contrib_pending drop constraint if exists pv_contrib_pending_kind_ck;
alter table public.pv_contrib_pending drop constraint if exists pv_contrib_pending_airline_ck;
alter table public.pv_contrib_pending drop constraint if exists pv_contrib_pending_size_ck;
alter table public.pv_contrib_pending add constraint pv_contrib_pending_kind_ck check (
  kind in ('work', 'cond'));
-- 自由入力の社名（other）は預からない。名前の表記で人が分かれ、引き継ぎ先が決まらない
alter table public.pv_contrib_pending add constraint pv_contrib_pending_airline_ck check (
  airline <> 'other');
alter table public.pv_contrib_pending add constraint pv_contrib_pending_size_ck check (
  jsonb_typeof(payload) = 'object' and char_length(payload::text) <= 6000);

create unique index if not exists pv_contrib_pending_item_idx
  on public.pv_contrib_pending (key_hash, kind, airline, item_key);

comment on table public.pv_contrib_keys is
  '未ログインの回答を預かる鍵（sha256 だけ）。誰にも読ませない。入口は db/contrib.sql の関数だけ。';
comment on table public.pv_contrib_pending is
  '未ログインの回答の預かり。集計にも他人の画面にも出さない。ログイン後に claim_contrib で会員の行になる。';


-- ════════════════════════════════════════════════════════════════
-- 2. 権限：誰にも読ませない・書かせない（入口は下の関数だけ）
-- ════════════════════════════════════════════════════════════════
alter table public.pv_contrib_keys    enable row level security;
alter table public.pv_contrib_pending enable row level security;
revoke all on public.pv_contrib_keys    from public, anon, authenticated;
revoke all on public.pv_contrib_pending from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 3. 鍵
-- ════════════════════════════════════════════════════════════════
-- 3-a. 預かる長さ。★「90日」はこの1か所だけ。
create or replace function public.pv_contrib_ttl()
returns interval
language sql
immutable
as $$ select interval '90 days' $$;
revoke all on function public.pv_contrib_ttl() from public, anon, authenticated;

-- 3-b. 鍵 → 表に置く形。形が違うもの（サーバが作った形でないもの）は null。
create or replace function public.pv_contrib_key_hash(v_key text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case when v_key ~ '^[0-9a-f]{48}$'
              then encode(extensions.digest('pv_contrib::' || v_key, 'sha256'), 'hex') end
$$;
revoke all on function public.pv_contrib_key_hash(text) from public, anon, authenticated;

-- 3-c. 生きている鍵なら、その表の形を返す。知らない鍵・期限の切れた鍵は null。
create or replace function public.pv_contrib_key_live(v_key text)
returns text
language sql
security definer
stable
set search_path = public, extensions
as $$
  select k.key_hash
    from public.pv_contrib_keys k
   where k.key_hash = public.pv_contrib_key_hash(v_key)
     and k.last_at > now() - public.pv_contrib_ttl()
$$;
revoke all on function public.pv_contrib_key_live(text) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 4. 預かる（未ログインのまま保存する）
-- ════════════════════════════════════════════════════════════════
-- 受け取る形:
--   { key?: '…', kind: 'work', data: { submit_work_month と同じ形 } }
--   { key?: '…', kind: 'cond', data: { submit_airline_conditions と同じ形 } }
-- 返す形（会員の入口と同じ形に、key を足しただけ）:
--   work … { ok, saved:true, year, month, replaced, key? }
--   cond … { ok, airline, saved, skipped:0, rejected:[{question_id, reason}], key? }
-- ★key は、**この呼び出しで新しく作ったときだけ**返す。画面はそれを端末に置く。
--   2回目からは画面が key を付けて呼ぶ ＝ 同じ預かりに足される。
-- ★「スキップ」は預からない（スキップは「同じ質問を3か月聞かない」ための会員の印）。
-- ★ここに資格の列の名前を書かない（末尾の検算が、関数の中身を文字で見ている）。
create or replace function public.submit_contrib_anon(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_kind    text;
  v_data    jsonb;
  v_key     text;
  v_kh      text;
  v_new     boolean := false;
  v_ip      text;
  v_iph     text;
  v_n       int;
  v_krow    record;
  v_left    int;
  -- work
  v_c       jsonb;
  v_item    text;
  v_rep     boolean;
  -- cond
  v_airline text;
  v_pos     text;
  v_fleet   text;
  v_base    text;
  v_ctype   text;
  v_lang    text;
  v_year    int;
  v_month   int;
  v_a       record;
  v_one     jsonb;
  v_saved   int := 0;
  v_rej     jsonb := '[]'::jsonb;
  v_out     jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 20000 then
    raise exception '入力の形式が不正です' using errcode = '22023';
  end if;
  v_kind := nullif(btrim(p->>'kind'), '');
  v_data := p->'data';
  v_key  := nullif(btrim(p->>'key'), '');
  if v_kind is null or v_kind not in ('work', 'cond') or jsonb_typeof(v_data) is distinct from 'object' then
    raise exception '入力の形式が不正です' using errcode = '22023';
  end if;

  -- ── 先に中身を確かめる（おかしい入力のために鍵を作らない）────────
  if v_kind = 'work' then
    v_c := public.pv_work_month_clean(v_data);          -- おかしければ、ここが日本語で止める
    if v_c->>'airline' = 'other' then
      raise exception '一覧に無い会社の回答は、ログインしてから保存してください' using errcode = '22023';
    end if;
    v_airline := v_c->>'airline';
    v_item    := (v_c->>'year') || '-' || lpad(v_c->>'month', 2, '0');
  else
    v_airline := nullif(btrim(v_data->>'airline'), '');
    if v_airline is null
       or not exists (select 1 from public.pv_airlines where code = v_airline) then
      raise exception '航空会社が正しくありません' using errcode = '22023';
    end if;
    if v_airline = 'other' then
      raise exception '一覧に無い会社の回答は、ログインしてから保存してください' using errcode = '22023';
    end if;
    if jsonb_typeof(v_data->'answers') is distinct from 'array'
       or jsonb_array_length(v_data->'answers') = 0 then
      raise exception '回答がありません' using errcode = '22023';
    end if;
    if jsonb_array_length(v_data->'answers') > 60 then
      raise exception '一度に送れる回答は60件までです' using errcode = '22023';
    end if;
    -- 文脈は会員の入口と同じ決まり（語彙に無ければ黙って落とす）
    v_pos   := nullif(btrim(v_data->>'position'), '');
    v_fleet := nullif(btrim(v_data->>'fleet'), '');
    v_base  := upper(nullif(btrim(v_data->>'base_iata'), ''));
    v_ctype := nullif(btrim(v_data->>'contract_type'), '');
    v_lang  := lower(coalesce(nullif(btrim(v_data->>'lang'), ''), 'ja'));
    if coalesce(v_data->>'year', '')  !~ '^\s*[0-9]{0,4}\s*$'
       or coalesce(v_data->>'month', '') !~ '^\s*[0-9]{0,2}\s*$' then
      raise exception '年月が正しくありません' using errcode = '22023';
    end if;
    v_year  := coalesce(nullif(btrim(v_data->>'year'), '')::int,  extract(year  from current_date)::int);
    v_month := coalesce(nullif(btrim(v_data->>'month'), '')::int, extract(month from current_date)::int);
    if v_year not between 2015 and 2100 or v_month not between 1 and 12 then
      raise exception '年月が正しくありません' using errcode = '22023';
    end if;
    if v_lang not in ('ja', 'en') then v_lang := 'ja'; end if;
    if v_pos   is not null and not exists (select 1 from public.pv_positions      where code = v_pos)   then v_pos   := null; end if;
    if v_fleet is not null and not exists (select 1 from public.pv_fleets         where code = v_fleet) then v_fleet := null; end if;
    if v_ctype is not null and not exists (select 1 from public.pv_contract_types where code = v_ctype) then v_ctype := null; end if;
    if v_base  is not null and v_base !~ '^[A-Z]{3}$' then v_base := null; end if;
  end if;

  -- ── 鍵（生きていればそれ・無ければ作る）────────────────────
  v_kh := public.pv_contrib_key_live(v_key);
  if v_kh is null then
    -- 期限の切れた預かりは、ここで片付ける（鍵を消すと、預かりも一緒に消える）
    delete from public.pv_contrib_keys where last_at <= now() - public.pv_contrib_ttl();

    -- 同じ回線から1日に作れる鍵は20本まで。
    -- ★IP が取れない環境（手元の検査など）では数えない（給与の預かりと同じ）。
    begin
      v_ip := split_part(
        coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''),
        ',', 1);
    exception when others then
      v_ip := '';
    end;
    v_ip := btrim(v_ip);
    if v_ip <> '' then
      v_iph := encode(extensions.digest(v_ip || '::' || current_date::text, 'sha256'), 'hex');
      select count(*) into v_n
        from public.pv_contrib_keys
       where ip_day_hash = v_iph and created_at > now() - interval '1 day';
      if v_n >= 20 then
        raise exception 'しばらくしてからもう一度お試しください' using errcode = '54000';
      end if;
    end if;

    v_key := encode(extensions.gen_random_bytes(24), 'hex');
    v_kh  := public.pv_contrib_key_hash(v_key);
    insert into public.pv_contrib_keys (key_hash, ip_day_hash) values (v_kh, v_iph);
    v_new := true;
  end if;

  -- ── 連投（1本の鍵で1日80件）と、預かれる数（1本の鍵で200件）────────
  select * into v_krow from public.pv_contrib_keys where key_hash = v_kh for update;
  if v_krow.saves_day is distinct from current_date then
    v_krow.saves_day   := current_date;
    v_krow.saves_today := 0;
  end if;
  select 200 - count(*) into v_left from public.pv_contrib_pending where key_hash = v_kh;

  if v_kind = 'work' then
    v_rep := exists (select 1 from public.pv_contrib_pending
                      where key_hash = v_kh and kind = 'work'
                        and airline = v_airline and item_key = v_item);
    if v_krow.saves_today >= 80 then
      raise exception 'しばらくしてからもう一度お試しください' using errcode = '54000';
    end if;
    if not v_rep and v_left <= 0 then
      raise exception 'ログインせずに保存できる件数の上限です。ログインすると続きを保存できます'
        using errcode = '54000';
    end if;

    insert into public.pv_contrib_pending (key_hash, kind, airline, item_key, payload)
    values (v_kh, 'work', v_airline, v_item, v_c)
    on conflict (key_hash, kind, airline, item_key) do update set
      payload = excluded.payload, updated_at = now();
    v_saved := 1;

    v_out := jsonb_build_object(
      'ok', true, 'saved', true,
      'year', (v_c->>'year')::int, 'month', (v_c->>'month')::int,
      'replaced', v_rep);

  else
    -- ★priority の昇順で回す（親は必ず子より前。会員の入口と同じ）
    for v_a in
      select e.v as ans, q.id, q.version
        from jsonb_array_elements(v_data->'answers') with ordinality as e(v, ord)
        left join public.pv_condition_questions q
               on q.id = e.v->>'question_id' and q.active
       order by coalesce(q.priority, 32767), e.ord
    loop
      if v_a.id is null then
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.ans->>'question_id', 'reason', 'unknown_question'));
        continue;
      end if;
      if v_krow.saves_today + v_saved >= 80 then
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.id, 'reason', 'rate_limited'));
        continue;
      end if;
      if coalesce(v_a.ans->>'skip', '') = 'true' then
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.id, 'reason', 'skip_needs_login'));
        continue;
      end if;

      -- 親に答えていない人の子の回答は受けない（いちばん上の親まで見る）。
      -- 見るのは、**この鍵が預けている答え**。
      if exists (
           select 1 from public.pv_condition_links k
            where k.question_id = v_a.id
              and not exists (
                select 1 from public.pv_contrib_pending c
                 where c.key_hash = v_kh and c.kind = 'cond'
                   and c.airline = v_airline and c.item_key = k.parent
                   and (c.payload->>'code' = any(k.parent_when)
                        or (jsonb_typeof(c.payload->'codes') = 'array'
                            and exists (select 1 from jsonb_array_elements_text(c.payload->'codes') x
                                         where x = any(k.parent_when)))))) then
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.id, 'reason', 'parent_missing'));
        continue;
      end if;

      -- 1件ぶんの検品（会員の入口と同じ関数）
      v_one := public.pv_condition_clean(v_a.id, v_a.ans);
      if not coalesce((v_one->>'ok')::boolean, false) then
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.id, 'reason', v_one->>'reason'));
        continue;
      end if;

      if v_left <= 0 and not exists (
           select 1 from public.pv_contrib_pending
            where key_hash = v_kh and kind = 'cond'
              and airline = v_airline and item_key = v_a.id) then
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.id, 'reason', 'rate_limited'));
        continue;
      end if;

      insert into public.pv_contrib_pending (key_hash, kind, airline, item_key, payload)
      values (v_kh, 'cond', v_airline, v_a.id,
              (v_one - 'ok') || jsonb_build_object(
                'question_id', v_a.id,
                'year', v_year, 'month', v_month,
                'position', v_pos, 'fleet', v_fleet, 'base_iata', v_base,
                'contract_type', v_ctype, 'lang', v_lang))
      on conflict (key_hash, kind, airline, item_key) do update set
        payload = excluded.payload, updated_at = now();
      v_saved := v_saved + 1;
      select 200 - count(*) into v_left from public.pv_contrib_pending where key_hash = v_kh;
    end loop;

    v_out := jsonb_build_object(
      'ok', true, 'airline', v_airline,
      'saved', v_saved, 'skipped', 0, 'rejected', v_rej);
  end if;

  update public.pv_contrib_keys set
    last_at     = case when v_saved > 0 then now() else last_at end,
    saves_day   = v_krow.saves_day,
    saves_today = v_krow.saves_today + v_saved
  where key_hash = v_kh;

  -- ★1件も預からなかった新しい鍵は残さない（空の鍵を端末に配らない）
  if v_new and v_saved = 0 then
    delete from public.pv_contrib_keys where key_hash = v_kh;
    v_new := false;
  end if;

  if v_new then
    v_out := v_out || jsonb_build_object('key', v_key);
  end if;
  return v_out;
end;
$$;

revoke all on function public.submit_contrib_anon(jsonb) from public;
grant execute on function public.submit_contrib_anon(jsonb) to anon, authenticated;

comment on function public.submit_contrib_anon(jsonb) is
  '未ログインの回答を預かる。検品は会員の入口と同じ関数。返す key は新しく作った時だけ。集計にも他人の画面にも出さない。';


-- ════════════════════════════════════════════════════════════════
-- 5. 自分が預けた回答（鍵を持っている端末にだけ）
-- ════════════════════════════════════════════════════════════════
-- 受け取る形: { key: '…', airline: 'jal' }
-- 返す形:     { ok, known, rows:[…], answers:[…] }
--   rows    … my_work_months の rows と**同じ形**（新しい月から24件）
--   answers … my_airline_conditions の answers と**同じ形**
--   known   … 鍵が生きているか。false なら、画面は端末の鍵を捨てる
-- ★知らない鍵には、空を返すだけ（在る・無いの手がかりを、鍵を知らない人に渡さない。
--   known:false は「あなたの出した鍵は使えない」と言っているだけで、他人の鍵のことは何も言わない）。
create or replace function public.my_contrib_anon(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_kh      text := public.pv_contrib_key_live(nullif(btrim(p->>'key'), ''));
  v_airline text := nullif(btrim(p->>'airline'), '');
begin
  if v_kh is null then
    return jsonb_build_object('ok', true, 'known', false,
                              'rows', '[]'::jsonb, 'answers', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'known', true,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'year',             (z.payload->>'year')::int,
               'month',            (z.payload->>'month')::int,
               'position',         z.payload->>'position',
               'fleet',            z.payload->>'fleet',
               'base_iata',        z.payload->>'base_iata',
               'block_hours',      z.payload->'block_hours',
               'duty_hours',       z.payload->'duty_hours',
               'work_days',        z.payload->'work_days',
               'duty_days',        z.payload->'duty_days',
               'days_off',         z.payload->'days_off',
               'stay_nights',      z.payload->'stay_nights',
               'duty_hours_basis', z.payload->>'duty_hours_basis',
               'commute_included', z.payload->>'commute_included',
               'note',             z.payload->>'note')
             order by z.item_key desc)
        from (select c.item_key, c.payload
                from public.pv_contrib_pending c
               where c.key_hash = v_kh and c.kind = 'work'
                 and (v_airline is null or c.airline = v_airline)
               order by c.item_key desc
               limit 24) z
    ), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'airline',     c.airline,
               'question_id', c.item_key,
               'code',        c.payload->>'code',
               'codes',       case when jsonb_typeof(c.payload->'codes') = 'array' then c.payload->'codes' end,
               'num',         c.payload->'num',
               'currency',    c.payload->>'currency',
               'text',        c.payload->>'text',
               'shared',      coalesce(c.payload->>'share', '') = 'true',
               'json',        case when jsonb_typeof(c.payload->'json') in ('array', 'object') then c.payload->'json' end,
               'year',        (c.payload->>'year')::int,
               'month',       (c.payload->>'month')::int,
               'updated_at',  c.updated_at)
             order by c.airline, q.priority)
        from public.pv_contrib_pending c
        join public.pv_condition_questions q on q.id = c.item_key
       where c.key_hash = v_kh and c.kind = 'cond'
         and (v_airline is null or c.airline = v_airline)
    ), '[]'::jsonb));
end;
$$;

revoke all on function public.my_contrib_anon(jsonb) from public;
grant execute on function public.my_contrib_anon(jsonb) to anon, authenticated;

comment on function public.my_contrib_anon(jsonb) is
  '預けた回答を、鍵を持っている端末にだけ返す。形は my_work_months / my_airline_conditions と同じ。';


-- ════════════════════════════════════════════════════════════════
-- 6. 引き継ぐ（ログインした本人が、鍵を出して行う）
-- ════════════════════════════════════════════════════════════════
-- 受け取る形: { key: '…' }
-- 返す形:     { ok, known, moved, kept, dropped, left }
--   moved   … 会員の行になった件数（ここで初めて集計に入る）
--   kept    … 会員の側に、もっと新しい同じ回答が在ったので、預かりを捨てた件数
--   dropped … 会員の入口が受け取らなかったので捨てた件数（質問が無くなった、など）
--   left    … 連投の制限に当たって、預かりに残した件数（あとでもう一度呼べば続きが入る）
-- ★入れるのは会員の入口（submit_work_month / submit_airline_conditions）だけ。
--   ここで表へ直接書かない ＝ 検品・連投の制限・親の条件を二重に持たない。
-- ★残りが0になったら鍵ごと消す（同じ鍵を、別の会員がもう一度使えない）。
create or replace function public.claim_contrib(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_kh      text;
  v_r       record;
  v_res     jsonb;
  v_moved   int := 0;
  v_kept    int := 0;
  v_dropped int := 0;
  v_left    int := 0;
  v_stop    boolean := false;
  v_newer   boolean;
  v_why     text;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception '入力の形式が不正です' using errcode = '22023';
  end if;

  v_kh := public.pv_contrib_key_live(nullif(btrim(p->>'key'), ''));
  if v_kh is null then
    return jsonb_build_object('ok', true, 'known', false,
                              'moved', 0, 'kept', 0, 'dropped', 0, 'left', 0);
  end if;
  -- 同じ鍵を2つの画面から同時に引き継がせない
  perform 1 from public.pv_contrib_keys where key_hash = v_kh for update;

  -- ── 月の勤務（古い月から）──────────────────────────────
  for v_r in
    select c.id, c.airline, c.payload, c.updated_at
      from public.pv_contrib_pending c
     where c.key_hash = v_kh and c.kind = 'work'
     order by c.item_key
  loop
    exit when v_stop;
    -- 会員の側に、もっと新しい同じ月が在れば、そちらを残す
    v_newer := exists (
      select 1 from public.pv_work_months w
       where w.proof_hash = public.pv_work_hash(v_uid, v_r.airline, null)
         and w.period_year  = (v_r.payload->>'year')::int
         and w.period_month = (v_r.payload->>'month')::int
         and w.updated_at >= v_r.updated_at);
    if v_newer then
      delete from public.pv_contrib_pending where id = v_r.id;
      v_kept := v_kept + 1;
      continue;
    end if;
    begin
      perform public.submit_work_month(v_r.payload);
      delete from public.pv_contrib_pending where id = v_r.id;
      v_moved := v_moved + 1;
    exception
      when sqlstate '54000' then
        v_stop := true;                      -- 連投の制限。残りは次の回に
      when sqlstate '22023' then
        delete from public.pv_contrib_pending where id = v_r.id;
        v_dropped := v_dropped + 1;          -- いまの決まりでは受け取れない形
    end;
  end loop;

  -- ── 待遇・働き方の質問（親から）──────────────────────────
  for v_r in
    select c.id, c.airline, c.item_key, c.payload, c.updated_at
      from public.pv_contrib_pending c
      left join public.pv_condition_questions q on q.id = c.item_key
     where c.key_hash = v_kh and c.kind = 'cond'
     order by c.airline, coalesce(q.priority, 32767), c.id
  loop
    exit when v_stop;
    v_newer := exists (
      select 1 from public.airline_conditions a
       where a.proof_hash = public.pv_condition_hash(v_uid, v_r.airline, null)
         and a.question_id = v_r.item_key
         and a.updated_at >= v_r.updated_at
         and num_nonnulls(a.answer_code, a.answer_codes, a.answer_num,
                          a.answer_text, a.answer_json) > 0);
    if v_newer then
      delete from public.pv_contrib_pending where id = v_r.id;
      v_kept := v_kept + 1;
      continue;
    end if;
    begin
      v_res := public.submit_airline_conditions(jsonb_build_object(
        'airline',       v_r.airline,
        'year',          v_r.payload->'year',
        'month',         v_r.payload->'month',
        'position',      v_r.payload->'position',
        'fleet',         v_r.payload->'fleet',
        'base_iata',     v_r.payload->'base_iata',
        'contract_type', v_r.payload->'contract_type',
        'lang',          v_r.payload->'lang',
        'answers',       jsonb_build_array(v_r.payload)));
    exception
      when sqlstate '22023' then
        v_res := jsonb_build_object('saved', 0, 'rejected',
                   jsonb_build_array(jsonb_build_object('reason', 'bad_request')));
    end;
    if coalesce((v_res->>'saved')::int, 0) > 0 then
      delete from public.pv_contrib_pending where id = v_r.id;
      v_moved := v_moved + 1;
    else
      v_why := v_res->'rejected'->0->>'reason';
      if v_why = 'rate_limited' then
        v_stop := true;
      else
        delete from public.pv_contrib_pending where id = v_r.id;
        v_dropped := v_dropped + 1;
      end if;
    end if;
  end loop;

  select count(*) into v_left from public.pv_contrib_pending where key_hash = v_kh;
  if v_left = 0 then
    delete from public.pv_contrib_keys where key_hash = v_kh;
  end if;

  return jsonb_build_object(
    'ok', true, 'known', true,
    'moved', v_moved, 'kept', v_kept, 'dropped', v_dropped, 'left', v_left);
end;
$$;

revoke all on function public.claim_contrib(jsonb) from public, anon;
grant execute on function public.claim_contrib(jsonb) to authenticated;

comment on function public.claim_contrib(jsonb) is
  '預けた回答を、ログインした本人が鍵を出して引き継ぐ。入れるのは会員の入口だけ。資格は何も付けない。';


-- ════════════════════════════════════════════════════════════════
-- 7. 他人の補足（立場をサーバが見てから返す）
-- ════════════════════════════════════════════════════════════════
-- 受け取る形: { airline: 'jal' }
-- 返す形:
--   未ログイン          … { ok, state:'login' }                       ← 1文字も返さない
--   ログインしただけ     … { ok, state:'member', notes:[…] }           ← 勤務・訓練と月の勤務は入っていない
--   給与の鍵が生きている … { ok, state:'open',   notes:[…] }
--   notes の1件 … { topic, q, text, mine }
--     topic … 話題（'work'＝月の勤務／それ以外は質問の節: roster / career / time_off / benefits）
--     q     … 質問の id（月の勤務のひとことは null）。名前は画面が質問の表から引く
--     mine  … 自分が書いたものか（画面が「あなたの投稿」の札を付ける）
-- ★返さないもの ── いつ書いたか・職位・機種・基地・選んだ答え・書いた人の印。
--   並びも時刻にしない（新しい順にすると「さっき出した人」が分かる）。
-- ★返すのは会員の行だけ（預かり＝未ログインのままの回答は出さない）。自由入力の社名も出さない。
-- ★1社につき40件まで（並びは行ごとに決まった順 ＝ 開くたびに入れ替わらない）。
create or replace function public.pv_contrib_notes(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_level   text := public.pv_work_level();
  v_uid     uuid := auth.uid();
  v_airline text := nullif(btrim(p->>'airline'), '');
  v_ch      text;
  v_wh      text;
  v_notes   jsonb;
begin
  if v_level = 'anon' then
    return jsonb_build_object('ok', true, 'state', 'login');
  end if;
  if v_airline is null or v_airline = 'other'
     or not exists (select 1 from public.pv_airlines where code = v_airline) then
    raise exception '航空会社が正しくありません' using errcode = '22023';
  end if;

  v_ch := public.pv_condition_hash(v_uid, v_airline, null);
  v_wh := public.pv_work_hash(v_uid, v_airline, null);

  with pool as (
    -- 質問への補足（「見せます」と書いた画面から送られたものだけ）
    select q.section as topic, c.question_id as q, c.answer_text as body,
           (c.proof_hash = v_ch) as mine,
           md5(c.proof_hash || '::' || c.question_id) as ord
      from public.airline_conditions c
      join public.pv_condition_questions q on q.id = c.question_id and q.active
     where c.airline = v_airline
       and c.airline_other is null
       and c.text_shared
       and c.answer_text is not null
       and (v_level = 'pay' or q.section not in ('roster', 'career'))
    union all
    -- 月の勤務のひとこと（給与の鍵が生きている人にだけ）
    select 'work', null, w.note,
           (w.proof_hash = v_wh),
           md5(w.proof_hash || '::' || w.period_year || '-' || w.period_month)
      from public.pv_work_months w
     where v_level = 'pay'
       and w.airline = v_airline
       and w.airline_other is null
       and w.note is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'topic', z.topic, 'q', z.q, 'text', z.body, 'mine', z.mine)
           order by z.topic, z.q nulls first, z.ord), '[]'::jsonb)
    into v_notes
    from (select * from pool order by mine desc, ord limit 40) z;

  return jsonb_build_object(
    'ok', true,
    'state', case when v_level = 'pay' then 'open' else 'member' end,
    'notes', v_notes);
end;
$$;

revoke all on function public.pv_contrib_notes(jsonb) from public;
grant execute on function public.pv_contrib_notes(jsonb) to anon, authenticated;

comment on function public.pv_contrib_notes(jsonb) is
  '他人の補足。未ログインには返さない／会員には勤務・訓練以外／給与の鍵が生きている人には全部。返すのは文と質問の id だけ。';


-- ════════════════════════════════════════════════════════════════
-- 8. 検算（貼ったあとに出る1行。ポリシー数は 0・それ以外は全部 true が正しい）
-- ════════════════════════════════════════════════════════════════
-- ★「資格に触らない」は、関数の中身を文字で見ている。預かる・返す・引き継ぐ関数の**中に**、
--   資格の列の名前を注意書きとしても書かないこと（書くと注意書きだけで false になる）。
select (select count(*) from pg_policies
         where schemaname = 'public'
           and tablename in ('pv_contrib_keys', 'pv_contrib_pending'))            as ポリシー数,
       (select bool_and(relrowsecurity) from pg_class
         where oid in ('public.pv_contrib_keys'::regclass,
                       'public.pv_contrib_pending'::regclass))                    as 表は閉じている,
       not has_table_privilege('anon', 'public.pv_contrib_pending', 'select')
         and not has_table_privilege('authenticated', 'public.pv_contrib_pending', 'select')
         and not has_table_privilege('authenticated', 'public.pv_contrib_keys', 'select')
                                                                                  as 預かりは誰も直接読めない,
       has_function_privilege('anon', 'public.submit_contrib_anon(jsonb)', 'execute')
         and has_function_privilege('anon', 'public.my_contrib_anon(jsonb)', 'execute')
                                                                                  as 未ログインで預けて読める,
       not has_function_privilege('anon', 'public.claim_contrib(jsonb)', 'execute')
                                                                                  as 引き継ぎはログインが要る,
       pg_get_functiondef('public.pv_contrib_notes(jsonb)'::regprocedure) like '%pv_work_level()%'
                                                                                  as 補足は立場を見てから返す,
       (pg_get_functiondef('public.submit_contrib_anon(jsonb)'::regprocedure)
          || pg_get_functiondef('public.my_contrib_anon(jsonb)'::regprocedure)
          || pg_get_functiondef('public.claim_contrib(jsonb)'::regprocedure))
         !~ '(access_until|pay_report|pay_streak|last_pay|badge|verify_level|founding|review_unlock)'
                                                                                  as 資格に触らない;
