-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/towns.sql
--
-- 会社ページの「暮らし」に集まる、住みやすい街の投稿（会社 × 基地ごと）。
-- 「＋住みやすい街を追加」から出た投稿を、会員1人・1つの街に1行で持つ。
-- 街の候補（台帳の街・運営が足した街・会員が打ち込んだ街）も、ここに持つ。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: … → db/founding.sql → db/stays.sql → db/work-months.sql → このファイル
--    → db/towns.generated.sql → db/contrib.sql
--    （このファイルが要るのは pv_airlines・pv_currencies・pv_is_operator の3つだけ。
--      どれかが抜けていたら、下の「0. 前提」が日本語で止める。）
-- 冪等（何度流しても安全）。
--
-- ── オーナーの言葉 ──────────────────────────────────────────
--   「匿名保存→本人確認→再読込/修正→既存の承認/集計に接続まで作る。」
--   「実際の家の住所や自動位置取得は不要。」
--   「「人気の居住地」は実投稿が揃ってから実件数で表示。」
--   「最初から架空ランキングを作らない。」
--   「「＋住みやすい街を追加」で集まった投稿は人数関係なく出そう。ランキング順で」
--   「C. 街の投稿で、打ち込まれた文の扱い−１　運営に通知来るシステム( info@pilot-value.com の管理ページに）」
--
-- ── この設計が守っている約束 ────────────────────────────────
--  1. 住所も位置も持たない（列が無い）。
--     家の住所・緯度経度・地図のリンク・郵便番号の列を作らない。
--     街・最寄駅、間取り、ターミナルの欄も、番地・部屋番号・URL のような字を断る（3-b の pv_town_clean）。
--  2. user_id を持たない。author_hash だけ（区切りは '::pv_town::'）。
--     ★ 給与（'::pv_pay::'）・ステイ（'::pv_hotel::'）・要望（'::pv_req::'）と区切りを変えてある
--       ＝ 表どうしを突き合わせて「同じ人」を束ねられない。
--  3. 表は閉じる。ポリシーを1つも作らない＝ anon も authenticated も直接は1行も読めない・書けない。
--     出入口は関数だけ。中でだけ使う部品（3. の節）は、どれも画面から呼べない。
--  4. 数えるのは会員の行だけ（ログインせずに預けた分は数えない）。
--  5. 一覧（7）を見せてよい相手は、db/contrib.sql の pv_contrib_sees の1か所が決める
--     （ここに立場の条件を書き足さない）。
--  6. 候補の一覧（6）は、サイトの名前だけ（台帳の街・運営が足した街）。誰が読んでも同じ。人の行を読まない。
--  7. 打ち込まれた街の名前と文は、運営が見るまで本人にしか返さない。
--  8. 家賃・通勤・住んだ時期は、本人にしか返さない。
--  9. 時刻を返さない・並びを時刻で決めない。
-- 10. 資格を1つも付けない。
--
-- 断る文は日本語（エラーコードは db/work-months.sql と同じ：22023 ＝ 受けない入力・54000 ＝ 上限・
-- 42501 ＝ ログインが要る）。画面（pv-contrib.js）は、日本語の文をそのまま出す。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regclass('public.pv_airlines') is null then
    raise exception '先に db/airlines.generated.sql を実行してください（pv_airlines の表が無い）';
  end if;
  if to_regclass('public.pv_currencies') is null then
    raise exception '先に db/vocab.generated.sql を実行してください（pv_currencies の表が無い）';
  end if;
  if to_regprocedure('public.pv_is_operator()') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pv_is_operator が無い）';
  end if;
end $$;

-- ════ 1. 街の鍵（★表の決まりが使うので、表より先に作る）════
-- 全角の英数字を半角へ → 小文字 → 末尾の（…）を外す → 空白と「・」を外す → 末尾の「駅」／「站」／station を1つ外す。
-- ★かな・漢字・ローマ字は束ねない（別の街を1つにしてしまう）。束ねるのは、台帳が持つ別の書き方（生成物の alias）と、運営（8 の into）。
create or replace function public.pv_town_key(p_name text)
returns text
language sql
immutable
set search_path = public, extensions
as $fn$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(translate(coalesce(p_name, ''),
            'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ０１２３４５６７８９',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')),
          '[（(][^（）()]*[）)][[:space:]　]*$', ''),
        '[[:space:]　・･]+', '', 'g'),
      '(駅|站|station)$', ''),
    '')
$fn$;
revoke all on function public.pv_town_key(text) from public, anon, authenticated;

-- ════ 2. 表 ════
-- 2-a. 街（候補）。origin … 'ledger'（台帳の街）／'operator'（運営が足した）／'member'（会員が打ち込んだ）
--      state … 'public' ／ 'pending'（運営がまだ見ていない）／ 'rejected'
--      alias_of … 別の書き方として、この街へ束ねた（運営が決める）。束ねた行は候補にも一覧にも出さない
create table if not exists public.pv_towns (
  id           bigint generated always as identity primary key,
  airline      text not null references public.pv_airlines(code),
  base_iata    text not null,
  tkey         text not null,
  name         text not null,
  origin       text not null,
  state        text not null default 'pending',
  alias_of     bigint references public.pv_towns(id),
  created_at   timestamptz not null default now(),
  moderated_at timestamptz
);
alter table public.pv_towns drop constraint if exists pv_towns_ck;
alter table public.pv_towns add constraint pv_towns_ck check (
  airline <> 'other' and base_iata ~ '^[A-Z]{3}$'
  and char_length(name) between 1 and 30 and tkey = public.pv_town_key(name)
  and origin in ('ledger', 'operator', 'member') and state in ('public', 'pending', 'rejected')
  and (alias_of is null or alias_of <> id));
create unique index if not exists pv_towns_key_idx on public.pv_towns (airline, base_iata, tkey);

-- 2-b. 投稿（会員の行）。1人・1つの街に1行。家の住所・位置の列は作らない。
create table if not exists public.pv_town_posts (
  id             uuid primary key default gen_random_uuid(),
  author_hash    text not null,
  airline        text not null references public.pv_airlines(code),
  base_iata      text not null,
  town_id        bigint not null references public.pv_towns(id),
  lived          text,
  lived_to_year  int,
  good           text,
  concern        text,
  text_state     text not null default 'none',
  rent_layout    text,
  rent_area      numeric(7,2),
  rent_area_unit text,
  rent_amount    numeric(12,2),
  rent_currency  char(3) references public.pv_currencies(code),
  trip_mode      text,
  trip_airport   text,
  trip_terminal  text,
  trip_hour      int,
  trip_minutes   int,
  lang           text not null default 'ja',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  moderated_at   timestamptz
);
alter table public.pv_town_posts drop constraint if exists pv_town_posts_ck;
alter table public.pv_town_posts add constraint pv_town_posts_ck check (
  author_hash ~ '^[0-9a-f]{64}$'
  and (lived is null or lived in ('now', 'past'))
  and char_length(coalesce(good, '')) <= 200 and char_length(coalesce(concern, '')) <= 200
  and text_state in ('none', 'pending', 'public', 'rejected')
  and ((good is null and concern is null) = (text_state = 'none'))
  and char_length(coalesce(rent_layout, '')) <= 12 and char_length(coalesce(trip_terminal, '')) <= 12
  and (rent_area_unit is null or rent_area_unit in ('m2', 'sqft'))
  and (rent_amount is null or rent_currency is not null)
  and (trip_mode is null or trip_mode in ('train', 'bus', 'car', 'taxi', 'other'))
  and (trip_hour is null or trip_hour between 0 and 23)
  and (trip_minutes is null or trip_minutes between 1 and 600));
create unique index if not exists pv_town_posts_one_idx on public.pv_town_posts (author_hash, town_id);
create index if not exists pv_town_posts_town_idx on public.pv_town_posts (town_id);

-- 2-c. 連投の数え（1日20件・新しい街の名前は1日3つ）。profiles に列を足さない。
create table if not exists public.pv_town_rate (
  author_hash text primary key,
  day         date not null,
  n           int not null default 0,
  names       int not null default 0
);

alter table public.pv_towns      enable row level security;
alter table public.pv_town_posts enable row level security;
alter table public.pv_town_rate  enable row level security;
revoke all on public.pv_towns      from public, anon, authenticated;
revoke all on public.pv_town_posts from public, anon, authenticated;
revoke all on public.pv_town_rate  from public, anon, authenticated;

-- ════ 3. 中でだけ使う部品（★どれも画面から呼べない）════
create or replace function public.pv_town_hash(p_uid uuid, p_airline text)
returns text
language sql
immutable
set search_path = public, extensions
as $fn$
  select encode(extensions.digest(p_uid::text || '::pv_town::' || p_airline, 'sha256'), 'hex')
$fn$;
revoke all on function public.pv_town_hash(uuid, text) from public, anon, authenticated;

-- 3-b. 中身の検品（★会員の入口も、未ログインの預かりも、運営の追加も、これを通る。式を写さない）
-- 受け取る形は submit_town_post と同じ。返すのは、検品を通した形（tkey を足す。書いていない欄は鍵ごと無い）。
create or replace function public.pv_town_clean(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, extensions
as $fn$
declare
  v_air   text;   v_base  text;   v_name  text;   v_key   text;   v_was  text;
  v_lived text;   v_to    int;    v_good  text;   v_conc  text;
  v_r     jsonb;  v_lay   text;   v_area  numeric; v_unit text;   v_amt  numeric; v_cur text;
  v_t     jsonb;  v_mode  text;   v_port  text;   v_term  text;   v_hour int;     v_min int;
  v_lang  text;   v_s     text;
  c_link  constant text := '(https?://|www\.|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})';
  c_addr  constant text := '(〒|[0-9０-９]{4,}|[0-9０-９][[:space:]]*[-－‐][[:space:]]*[0-9０-９]|番地|号室)';
begin
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 4000 then
    raise exception '入力の形式が不正です' using errcode = '22023';
  end if;

  v_air := nullif(btrim(p->>'airline'), '');
  if v_air is null or v_air = 'other'
     or not exists (select 1 from public.pv_airlines a where a.code = v_air) then
    raise exception '航空会社が正しくありません' using errcode = '22023';
  end if;
  -- ★街を出せるのは、台帳に街がある会社と基地だけ（台帳の街は db/towns.generated.sql が入れる）。
  --   打ち間違えた基地の下に、どの画面も読まない街を作らせない。
  v_base := upper(nullif(btrim(p->>'base_iata'), ''));
  if v_base is null or v_base !~ '^[A-Z]{3}$'
     or not exists (select 1 from public.pv_towns t where t.airline = v_air and t.base_iata = v_base) then
    raise exception '基地が正しくありません' using errcode = '22023';
  end if;

  v_name := nullif(regexp_replace(btrim(coalesce(p->>'town', '')), '[[:space:]　]+', ' ', 'g'), '');
  v_key  := public.pv_town_key(v_name);
  if v_name is null or char_length(v_name) > 30 or v_key is null then
    raise exception '街・最寄駅は1〜30字で入れてください' using errcode = '22023';
  end if;
  if v_name ~* c_link or v_name ~ c_addr then
    raise exception '街・最寄駅に、番地・部屋番号・URL は書けません' using errcode = '22023';
  end if;
  v_was := nullif(regexp_replace(btrim(coalesce(p->>'was', '')), '[[:space:]　]+', ' ', 'g'), '');
  if v_was is not null and (char_length(v_was) > 30 or public.pv_town_key(v_was) is null
                            or public.pv_town_key(v_was) = v_key) then
    v_was := null;
  end if;

  v_lived := nullif(btrim(p->>'lived'), '');
  if v_lived is not null and v_lived not in ('now', 'past') then v_lived := null; end if;
  v_s := btrim(coalesce(p->>'lived_to_year', ''));
  if v_lived = 'past' and v_s ~ '^[0-9]{4}$'
     and v_s::int between 1990 and extract(year from current_date)::int then
    v_to := v_s::int;
  end if;

  v_good := nullif(btrim(coalesce(p->>'good', '')), '');
  v_conc := nullif(btrim(coalesce(p->>'concern', '')), '');
  if char_length(coalesce(v_good, '')) > 200 then
    raise exception '良い点は200字までです' using errcode = '22023';
  end if;
  if char_length(coalesce(v_conc, '')) > 200 then
    raise exception '気になる点は200字までです' using errcode = '22023';
  end if;
  if coalesce(v_good, '') ~* c_link or coalesce(v_conc, '') ~* c_link then
    raise exception '良い点・気になる点に、URL やメールアドレスは書けません' using errcode = '22023';
  end if;

  -- 家賃（任意）。間取りは、本人の言葉のまま（12字まで）。語彙の表を持たない ＝ 会社ページの台帳の欄の鍵と結ばない
  -- （家賃の台帳が無い基地でも答えられる・台帳の欄が替わっても、預かった字は読める）。
  -- ★打ち込む欄は、読めない・書けない字を黙って落とさない（断って、その欄を直してもらう）。
  v_r   := case when jsonb_typeof(p->'rent') = 'object' then p->'rent' else '{}'::jsonb end;
  v_lay := nullif(regexp_replace(btrim(coalesce(v_r->>'layout', '')), '[[:space:]　]+', ' ', 'g'), '');
  if v_lay is not null and (char_length(v_lay) > 12 or v_lay ~* c_link or v_lay ~ c_addr) then
    raise exception '間取りが正しくありません' using errcode = '22023';
  end if;
  v_s := btrim(coalesce(v_r->>'area', ''));
  if v_s <> '' then
    v_unit := coalesce(nullif(btrim(v_r->>'area_unit'), ''), 'm2');
    if v_s !~ '^[0-9]{1,5}(\.[0-9]{1,2})?$' or v_unit not in ('m2', 'sqft')
       or (v_unit = 'm2'   and v_s::numeric not between 5 and 1000)
       or (v_unit = 'sqft' and v_s::numeric not between 50 and 10000) then
      raise exception '広さが正しくありません' using errcode = '22023';
    end if;
    v_area := v_s::numeric;
  end if;
  v_s := btrim(coalesce(v_r->>'amount', ''));
  if v_s <> '' then
    if v_s !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$' or v_s::numeric <= 0 or v_s::numeric > 100000000 then
      raise exception '家賃の月額が正しくありません' using errcode = '22023';
    end if;
    v_amt := v_s::numeric;
    v_cur := upper(nullif(btrim(v_r->>'currency'), ''));
    if v_cur is null or not exists (select 1 from public.pv_currencies c where c.code = v_cur) then
      raise exception '家賃の通貨を選んでください' using errcode = '22023';
    end if;
  end if;

  -- 通勤（任意）。語彙の外の値は黙って落とす（会員の入口の文脈の欄と同じ決まり）。打ち込む欄（ターミナル・所要時間）は、外れたら断る
  v_t    := case when jsonb_typeof(p->'trip') = 'object' then p->'trip' else '{}'::jsonb end;
  v_mode := nullif(btrim(v_t->>'mode'), '');
  if v_mode is not null and v_mode not in ('train', 'bus', 'car', 'taxi', 'other') then v_mode := null; end if;
  v_port := upper(nullif(btrim(v_t->>'airport'), ''));
  if v_port is not null and v_port !~ '^[A-Z]{3}$' then v_port := null; end if;
  v_term := nullif(regexp_replace(btrim(coalesce(v_t->>'terminal', '')), '[[:space:]　]+', ' ', 'g'), '');
  if v_term is not null and (char_length(v_term) > 12 or v_term ~* c_link or v_term ~ c_addr) then
    raise exception 'ターミナルが正しくありません' using errcode = '22023';
  end if;
  v_s := btrim(coalesce(v_t->>'hour', ''));
  if v_s ~ '^[0-9]{1,2}$' and v_s::int between 0 and 23 then v_hour := v_s::int; end if;
  v_s := btrim(coalesce(v_t->>'minutes', ''));
  if v_s <> '' then
    if v_s !~ '^[0-9]{1,3}$' or v_s::int not between 1 and 600 then
      raise exception '通勤の所要時間は1〜600分で入れてください' using errcode = '22023';
    end if;
    v_min := v_s::int;
  end if;

  v_lang := lower(coalesce(nullif(btrim(p->>'lang'), ''), 'ja'));
  if v_lang not in ('ja', 'en') then v_lang := 'ja'; end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'airline', v_air, 'base_iata', v_base, 'town', v_name, 'tkey', v_key, 'was', v_was,
    'lived', v_lived, 'lived_to_year', v_to, 'good', v_good, 'concern', v_conc,
    'rent', nullif(jsonb_strip_nulls(jsonb_build_object(
              'layout', v_lay, 'area', v_area, 'area_unit', case when v_area is null then null else v_unit end,
              'amount', v_amt, 'currency', v_cur)), '{}'::jsonb),
    'trip', nullif(jsonb_strip_nulls(jsonb_build_object(
              'mode', v_mode, 'airport', v_port, 'terminal', v_term, 'hour', v_hour, 'minutes', v_min)), '{}'::jsonb),
    'lang', v_lang));
end;
$fn$;
revoke all on function public.pv_town_clean(jsonb) from public, anon, authenticated;

-- 3-c. 本人へ返す1件の形（★列を名指しで並べるのはここだけ。to_jsonb(s) で返さない ＝ author_hash と時刻が外へ出る）
create or replace function public.pv_town_post_json(s public.pv_town_posts, t public.pv_towns)
returns jsonb
language sql
stable
set search_path = public, extensions
as $fn$
  select jsonb_build_object(
    'town', t.name, 'base', s.base_iata, 'town_state', t.state,
    'lived', s.lived, 'lived_to_year', s.lived_to_year,
    'good', s.good, 'concern', s.concern, 'text_state', s.text_state,
    'rent', case when num_nonnulls(s.rent_layout, s.rent_area, s.rent_amount) = 0 then null else
              jsonb_build_object('layout', s.rent_layout, 'area', s.rent_area, 'area_unit', s.rent_area_unit,
                                 'amount', s.rent_amount, 'currency', s.rent_currency) end,
    'trip', case when num_nonnulls(s.trip_mode, s.trip_airport, s.trip_terminal, s.trip_hour, s.trip_minutes) = 0 then null else
              jsonb_build_object('mode', s.trip_mode, 'airport', s.trip_airport, 'terminal', s.trip_terminal,
                                 'hour', s.trip_hour, 'minutes', s.trip_minutes) end)
$fn$;
revoke all on function public.pv_town_post_json(public.pv_town_posts, public.pv_towns) from public, anon, authenticated;

-- 3-d. 預かりの1件を、同じ形で返す（db/contrib.sql が呼ぶ。c は pv_town_clean を通した形）
create or replace function public.pv_town_held_json(c jsonb)
returns jsonb
language sql
immutable
set search_path = public, extensions
as $fn$
  select jsonb_build_object(
    'town', c->>'town', 'base', c->>'base_iata', 'town_state', 'held',
    'lived', c->>'lived', 'lived_to_year', (c->>'lived_to_year')::int,
    'good', c->>'good', 'concern', c->>'concern',
    'text_state', case when c ? 'good' or c ? 'concern' then 'held' else 'none' end,
    'rent', case when c ? 'rent' then jsonb_build_object(
              'layout', c#>>'{rent,layout}', 'area', (c#>>'{rent,area}')::numeric, 'area_unit', c#>>'{rent,area_unit}',
              'amount', (c#>>'{rent,amount}')::numeric, 'currency', c#>>'{rent,currency}') end,
    'trip', case when c ? 'trip' then jsonb_build_object(
              'mode', c#>>'{trip,mode}', 'airport', c#>>'{trip,airport}', 'terminal', c#>>'{trip,terminal}',
              'hour', (c#>>'{trip,hour}')::int, 'minutes', (c#>>'{trip,minutes}')::int) end)
$fn$;
revoke all on function public.pv_town_held_json(jsonb) from public, anon, authenticated;

-- 3-e. 文の印（★運営が「見た字」と「通す字」を同じにするための16字）
create or replace function public.pv_town_rev(s public.pv_town_posts)
returns text
language sql
immutable
set search_path = public, extensions
as $fn$
  select substr(encode(extensions.digest(
           coalesce(s.good, '') || chr(31) || coalesce(s.concern, '') || chr(31) || s.town_id::text, 'sha256'), 'hex'), 1, 16)
$fn$;
revoke all on function public.pv_town_rev(public.pv_town_posts) from public, anon, authenticated;

-- 3-f. 会員の側に、同じ街のもっと新しい投稿が在るか（引き継ぎが聞く。db/contrib.sql に街の表の名前を書かせない）
create or replace function public.pv_town_newer(p_uid uuid, c jsonb, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  select exists (
    select 1
      from public.pv_towns t
      join public.pv_town_posts s on s.town_id = coalesce(t.alias_of, t.id)
     where t.airline = c->>'airline' and t.base_iata = c->>'base_iata' and t.tkey = c->>'tkey'
       and s.author_hash = public.pv_town_hash(p_uid, c->>'airline')
       and s.updated_at >= p_at)
$fn$;
revoke all on function public.pv_town_newer(uuid, jsonb, timestamptz) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 9. 検算（貼ったあとに出る1行）
-- ════════════════════════════════════════════════════════════════
-- ポリシー数は 0・それ以外は全部 true が正しい。
select (select count(*) from pg_policies
         where schemaname = 'public' and tablename in ('pv_towns', 'pv_town_posts', 'pv_town_rate'))      as ポリシー数,
       (select bool_and(relrowsecurity) from pg_class
         where oid in ('public.pv_towns'::regclass, 'public.pv_town_posts'::regclass,
                       'public.pv_town_rate'::regclass))                                                  as 表は閉じている,
       not has_table_privilege('anon', 'public.pv_town_posts', 'select')
         and not has_table_privilege('authenticated', 'public.pv_town_posts', 'select')
         and not has_table_privilege('authenticated', 'public.pv_towns', 'select')                        as 表は誰も直接読めない,
       not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name in ('pv_towns', 'pv_town_posts')
                      and column_name ~ '(^|_)(address|lat|latitude|lng|lon|longitude|geo|coord|coords|postal|zip|user_id|uid|email)($|_)')
                                                                                                          as 住所も位置も人の印も持たない;
