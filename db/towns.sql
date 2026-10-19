-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/towns.sql
--
-- 会社ページの「暮らし」に集まる、住みやすい街の投稿（会社 × 基地ごと）。
-- 「＋パイロットに人気の街を追加」（2026-10-18 までの字は「＋住みやすい街を追加」）から出た投稿を、会員1人・1つの街に1行で持つ。
-- 街の候補（台帳の街・運営が足した街・会員が打ち込んだ街）も、ここに持つ。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: … → db/founding.sql → db/proof-store.sql → db/proof-offer.sql → db/stays.sql → db/work-months.sql → このファイル
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

-- ════ 4. 会員の入口 ════
-- 返す形: { ok:true, saved:true, replaced, post:{…3-c…} }   replaced … 同じ街を出し直した／街を直した
-- ★同じ街が在れば行ごと置き換える（省いた欄は空に戻る。月の勤務と同じ決まり）。
-- ★候補（台帳の街・運営が足した街）に在る街は、その場で数に入る。候補に無い名前は 'pending' の街として入り、運営が見るまで数えない。
-- ★文（良い点・気になる点）は、新しく書いた時と、1文字でも変えた時に、運営の確認待ちになる。
-- ★上限は2つ。どちらも 54000 で止める。引き継ぎ（db/contrib.sql の claim_contrib）が2つを見分けられるように、
--   候補に無い名前の上限にだけ detail = 'names' を付ける（付いていれば、その1件だけ残して次の街へ進む）。
-- ★候補に無い名前は、もう誰かが打った名前でも、運営が承認したあとでも、初めての名前と同じに数える（1日に3つ）。
--   数えないと、返事の town_state（'public'）から「その名前はもう在る」が、鍵の無い人にも何度でも分かる。
-- ★ここに資格の列の名前を書かない（末尾の検算が、関数の中身を文字で見ている）。
create or replace function public.submit_town_post(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_c     jsonb;
  v_air   text;
  v_base  text;
  v_me    text;
  v_good  text;
  v_conc  text;
  v_rate  public.pv_town_rate%rowtype;
  v_town  public.pv_towns%rowtype;
  v_from  public.pv_towns%rowtype;
  v_old   public.pv_town_posts%rowtype;
  v_row   public.pv_town_posts%rowtype;
  v_had   boolean := false;
  v_guess boolean := false;     -- 候補（台帳・運営）に無い名前を、この人が初めて出す回
  v_ts    text;
  v_n     int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  v_c    := public.pv_town_clean(p);
  v_air  := v_c->>'airline';
  v_base := v_c->>'base_iata';
  v_good := v_c->>'good';
  v_conc := v_c->>'concern';
  v_me   := public.pv_town_hash(v_uid, v_air);

  -- 同じ人の同時の2本を1列に並べる（数え方をすり抜けさせない）
  perform pg_advisory_xact_lock(hashtextextended('pv_town:' || v_me, 0));

  insert into public.pv_town_rate as r (author_hash, day, n, names)
  values (v_me, current_date, 0, 0)
  on conflict (author_hash) do update set
    n     = case when r.day = current_date then r.n     else 0 end,
    names = case when r.day = current_date then r.names else 0 end,
    day   = current_date
  returning * into v_rate;
  if v_rate.n >= 20 then
    raise exception '1日に投稿できる件数の上限に達しました。明日また続きをどうぞ。' using errcode = '54000';
  end if;

  -- 街を決める（候補に在ればその街。別の書き方として束ねてあれば、束ねた先）
  select * into v_town from public.pv_towns
   where airline = v_air and base_iata = v_base and tkey = v_c->>'tkey';
  v_guess := v_town.id is null or v_town.origin = 'member';
  if v_town.id is null then
    begin
      insert into public.pv_towns (airline, base_iata, tkey, name, origin, state)
      values (v_air, v_base, v_c->>'tkey', v_c->>'town', 'member', 'pending')
      returning * into v_town;
    exception when unique_violation then          -- 同じ名前を、別の人が同時に出した
      select * into v_town from public.pv_towns
       where airline = v_air and base_iata = v_base and tkey = v_c->>'tkey';
    end;
  end if;
  if v_town.alias_of is not null then
    select * into v_town from public.pv_towns where id = v_town.alias_of;
  end if;
  if v_town.state = 'rejected' then
    raise exception 'この街の名前は、いま受け付けていません' using errcode = '22023';
  end if;

  select * into v_old from public.pv_town_posts
   where author_hash = v_me and town_id = v_town.id for update;
  v_had := v_old.id is not null;

  -- 候補に無い名前の上限（自分がもう出している街の出し直しは数えない）。
  -- ★ここで止まると、上で作った街の行も一緒に取り消される（1つの呼び出しは、全部入るか、何も入らないか）。
  v_guess := v_guess and not v_had;
  if v_guess and v_rate.names >= 3 then
    raise exception '新しい街の名前を出せるのは、1日に3つまでです。明日また続きをどうぞ。'
      using errcode = '54000', detail = 'names';
  end if;

  -- 街を直した回：前の街の投稿を外してから、この街へ置く。
  -- ★直した先の街をもう持っていても、前の街の行は消す（この街の1行が、出した中身で置き換わる ＝ replaced:true）。
  --   残すと、画面からは消えた前の街が、読み直すと戻り、その街の数にも入り続ける。
  -- ★前の街が、この街そのもの（束ねた別の書き方）なら、何も消さない。
  if v_c ? 'was' then
    select * into v_from from public.pv_towns
     where airline = v_air and base_iata = v_base and tkey = public.pv_town_key(v_c->>'was');
    if v_from.id is not null and coalesce(v_from.alias_of, v_from.id) <> v_town.id then
      delete from public.pv_town_posts
       where author_hash = v_me and town_id = coalesce(v_from.alias_of, v_from.id);
      v_had := v_had or found;
    end if;
  end if;

  if not v_had then
    select count(*) into v_n from public.pv_town_posts where author_hash = v_me;
    if v_n >= 10 then
      raise exception '1つの会社に出せる街は10か所までです' using errcode = '22023';
    end if;
  end if;

  v_ts := case
    when v_good is null and v_conc is null then 'none'
    when v_old.id is not null and v_old.good is not distinct from v_good
         and v_old.concern is not distinct from v_conc then v_old.text_state
    else 'pending' end;

  insert into public.pv_town_posts as s (
    author_hash, airline, base_iata, town_id, lived, lived_to_year, good, concern, text_state,
    rent_layout, rent_area, rent_area_unit, rent_amount, rent_currency,
    trip_mode, trip_airport, trip_terminal, trip_hour, trip_minutes, lang)
  values (
    v_me, v_air, v_base, v_town.id, v_c->>'lived', (v_c->>'lived_to_year')::int, v_good, v_conc, v_ts,
    v_c#>>'{rent,layout}', (v_c#>>'{rent,area}')::numeric, v_c#>>'{rent,area_unit}',
    (v_c#>>'{rent,amount}')::numeric, v_c#>>'{rent,currency}',
    v_c#>>'{trip,mode}', v_c#>>'{trip,airport}', v_c#>>'{trip,terminal}',
    (v_c#>>'{trip,hour}')::int, (v_c#>>'{trip,minutes}')::int, v_c->>'lang')
  on conflict (author_hash, town_id) do update set
    lived = excluded.lived, lived_to_year = excluded.lived_to_year,
    good = excluded.good, concern = excluded.concern, text_state = excluded.text_state,
    -- ★家賃（rent_*）は、送られてきた時だけ置き換える（2026-10-18）。画面は広さ・間取り・家賃を聞かない・送らない
    --   （オーナー「広さとか間取りとか投稿する人が入力するのおかしい」）。前に預かった値は、出し直しで消さずにそのまま持つ
    --   （列も行も消さない。どの画面にも投稿した人の家賃としては出さない ── 家の数字はサイトが調べて載せるものだけ）。
    rent_layout    = case when v_c ? 'rent' then excluded.rent_layout    else s.rent_layout    end,
    rent_area      = case when v_c ? 'rent' then excluded.rent_area      else s.rent_area      end,
    rent_area_unit = case when v_c ? 'rent' then excluded.rent_area_unit else s.rent_area_unit end,
    rent_amount    = case when v_c ? 'rent' then excluded.rent_amount    else s.rent_amount    end,
    rent_currency  = case when v_c ? 'rent' then excluded.rent_currency  else s.rent_currency  end,
    trip_mode = excluded.trip_mode, trip_airport = excluded.trip_airport, trip_terminal = excluded.trip_terminal,
    trip_hour = excluded.trip_hour, trip_minutes = excluded.trip_minutes, lang = excluded.lang,
    updated_at = now(),
    moderated_at = case when excluded.text_state = s.text_state then s.moderated_at else null end
  returning * into v_row;

  update public.pv_town_rate
     set n = n + 1, names = names + case when v_guess then 1 else 0 end
   where author_hash = v_me;

  return jsonb_build_object('ok', true, 'saved', true, 'replaced', v_had,
                            'post', public.pv_town_post_json(v_row, v_town));
end;
$fn$;
revoke all on function public.submit_town_post(jsonb) from public, anon;
grant execute on function public.submit_town_post(jsonb) to authenticated;

-- ════ 5. 自分の投稿（その会社のぶん。ほかの人の行は1つも読まない）════
create or replace function public.my_town_posts(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $fn$
declare
  v_uid uuid := auth.uid();
  v_air text := nullif(btrim(p->>'airline'), '');
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if v_air is null or v_air = 'other'
     or not exists (select 1 from public.pv_airlines a where a.code = v_air) then
    raise exception '航空会社が正しくありません' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true, 'posts', coalesce((
    select jsonb_agg(public.pv_town_post_json(s, t) order by s.base_iata, t.tkey collate "C")
      from public.pv_town_posts s
      join public.pv_towns t on t.id = s.town_id
     where s.author_hash = public.pv_town_hash(v_uid, v_air)), '[]'::jsonb));
end;
$fn$;
revoke all on function public.my_town_posts(jsonb) from public, anon;
grant execute on function public.my_town_posts(jsonb) to authenticated;

-- ════ 6. 候補の一覧（追加の面の中の「街の検索」が読む）════
-- 返す形: { ok:true, towns:[名前…] }。台帳の街 → 運営が足した街。
-- ★サイトの名前だけ。誰が読んでも同じ字が返る（立場を見ない・読む人を見ない・投稿の表を読まない）。
-- ★会員が打ち込んだ街の名前は、運営が承認したあとも、ここには入れない。それは「ほかの人が出した情報」で、
--   見せてよい相手にだけ 7 の一覧が返す。追加の面は、ほかの人の回答を読む口を1つも呼ばない（段階2bの決まり）。
--   みんなの候補にしたい名前は、運営が「追加」で足す（8-c。origin が 'operator' になり、ここに入る）。
-- ★別の書き方として束ねた行（alias_of）は出さない。
create or replace function public.pv_town_options(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $fn$
declare
  v_air  text := nullif(btrim(p->>'airline'), '');
  v_base text := upper(nullif(btrim(p->>'base'), ''));
  v_list jsonb;
begin
  select coalesce(jsonb_agg(z.name order by z.o, z.id), '[]'::jsonb)
    into v_list
    from (
      select t.name, t.id, case t.origin when 'ledger' then 0 else 1 end as o
        from public.pv_towns t
       where t.airline = v_air and t.base_iata = v_base
         and t.state = 'public' and t.alias_of is null
         and t.origin in ('ledger', 'operator')
       order by 3, 2
       limit 60
    ) z;
  return jsonb_build_object('ok', true, 'towns', v_list);
end;
$fn$;
revoke all on function public.pv_town_options(jsonb) from public;
grant execute on function public.pv_town_options(jsonb) to anon, authenticated;

-- ════ 7. 街の一覧（会員が挙げた人数の多い順）════
-- 返す形:
--   開いていない … { ok:true, state:'login' | 'locked' | 'give' }      ← この3つの鍵と語だけ。会社も基地も見ない
--   開いている   … { ok:true, state:'open', towns:[{ name, n, mine, good:[{text, mine}], concern:[{text, mine}] }] }
-- ★決めるのは pv_contrib_sees の1か所（db/contrib.sql ＝ あとのファイル。無ければここで止まる ＝ 画面は「準備中」）。
-- ★n は会員の行の数（1人・1つの街に1行）。預かり（未ログイン）は数えない。1人から出す（オーナー指定 2026-10-11）。
-- ★並びは n の多い順。同じ数は、街の鍵の順（意味を持たない・何度読んでも同じ）。時刻で並べない。
-- ★返さないもの：書いた人の印・時刻・住んだ時期・家賃・通勤・確認待ちの街と文・待っている数。
create or replace function public.pv_town_board(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $fn$
declare
  v_air   text := nullif(btrim(p->>'airline'), '');
  v_base  text := upper(nullif(btrim(p->>'base'), ''));
  v_sees  text := public.pv_contrib_sees(v_air);
  v_me    text;
  v_towns jsonb;
begin
  if v_sees is distinct from 'open' then
    return jsonb_build_object('ok', true, 'state', coalesce(v_sees, 'login'));
  end if;
  if v_air is null or v_air = 'other'
     or not exists (select 1 from public.pv_airlines a where a.code = v_air) then
    raise exception '航空会社が正しくありません' using errcode = '22023';
  end if;
  if v_base is null or v_base !~ '^[A-Z]{3}$' then
    raise exception '基地が正しくありません' using errcode = '22023';
  end if;
  v_me := public.pv_town_hash(auth.uid(), v_air);

  select coalesce(jsonb_agg(z.j order by z.n desc, z.k), '[]'::jsonb)
    into v_towns
    from (
      select jsonb_build_object(
               'name', t.name, 'n', c.n, 'mine', c.mine,
               -- 文は1つの街に5つまで。読む人自身の文を先に置く（6つ目以降に回って、本人にも見えなくなることが無い）。
               -- ほかの人の文の並びは、時刻ではなく、書いた人の印と街から作った字の順（意味を持たない・何度読んでも同じ）。
               'good', coalesce((
                 select jsonb_agg(jsonb_build_object('text', x.body, 'mine', x.mine) order by x.mine desc, x.ord)
                   from (select s.good as body, coalesce(s.author_hash = v_me, false) as mine,
                                md5(s.author_hash || '::g::' || s.town_id::text) as ord
                           from public.pv_town_posts s
                          where s.town_id = t.id and s.text_state = 'public' and s.good is not null
                          order by 2 desc, 3 limit 5) x), '[]'::jsonb),
               'concern', coalesce((
                 select jsonb_agg(jsonb_build_object('text', x.body, 'mine', x.mine) order by x.mine desc, x.ord)
                   from (select s.concern as body, coalesce(s.author_hash = v_me, false) as mine,
                                md5(s.author_hash || '::c::' || s.town_id::text) as ord
                           from public.pv_town_posts s
                          where s.town_id = t.id and s.text_state = 'public' and s.concern is not null
                          order by 2 desc, 3 limit 5) x), '[]'::jsonb)) as j,
             c.n, t.tkey collate "C" as k
        from public.pv_towns t
        join lateral (select count(*)::int as n, coalesce(bool_or(s.author_hash = v_me), false) as mine
                        from public.pv_town_posts s where s.town_id = t.id) c on c.n > 0
       where t.airline = v_air and t.base_iata = v_base
         and t.state = 'public' and t.alias_of is null
       order by c.n desc, t.tkey collate "C"
       limit 30
    ) z;

  return jsonb_build_object('ok', true, 'state', 'open', 'towns', v_towns);
end;
$fn$;
revoke all on function public.pv_town_board(jsonb) from public;
grant execute on function public.pv_town_board(jsonb) to anon, authenticated;

-- ════ 8. 運営（★守っているのは grant ではなく、関数の頭の pv_is_operator。db/stays.sql と同じ1つ）════
-- 8-a. 確認待ち。返す形: { ok:true, scopes:[{airline, name, base, towns:[{id, name}]}], towns:[{id, airline, base, name, posts}],
--                          texts:[{id, airline, base, town, town_state, good, concern, rev}] } ／ 運営でなければ forbidden
-- ★数えるのは会員の行だけ（預かり＝未ログインのままの投稿は、ここに出ない）。★時刻も書いた人の印も返さない。古い順に並べるだけ。
create or replace function public.pv_town_queue(p jsonb default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_scopes jsonb;
  v_towns  jsonb;
  v_texts  jsonb;
begin
  if not public.pv_is_operator() then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;
  -- 会社と基地の組（街を足す先・束ねる先を、打たせずに選ばせるため）。towns は、いま公開されている候補
  select coalesce(jsonb_agg(jsonb_build_object('airline', z.airline, 'name', z.name_ja, 'base', z.base_iata,
                                               'towns', coalesce(z.towns, '[]'::jsonb))
                            order by z.airline, z.base_iata), '[]'::jsonb)
    into v_scopes
    from (select t.airline, a.name_ja, t.base_iata,
                 jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.tkey collate "C")
                   filter (where t.state = 'public' and t.alias_of is null) as towns
            from public.pv_towns t join public.pv_airlines a on a.code = t.airline
           group by t.airline, a.name_ja, t.base_iata) z;
  -- 待っている名前。★投稿が1つも付いていない名前は出さない（出した人が街を直して離れた行。「0人」の行を運営に見せない）。
  select coalesce(jsonb_agg(z.j order by z.at, z.id), '[]'::jsonb)
    into v_towns
    from (select jsonb_build_object('id', t.id, 'airline', t.airline, 'base', t.base_iata, 'name', t.name,
                   'posts', (select count(*)::int from public.pv_town_posts s where s.town_id = t.id)) as j,
                 t.created_at as at, t.id
            from public.pv_towns t
           where t.state = 'pending' and t.alias_of is null
             and exists (select 1 from public.pv_town_posts s where s.town_id = t.id)
           order by t.created_at, t.id
           limit 200) z;
  -- 待っている文。★見送った名前の下の文は出さない（街が出ないので、通しても誰にも見えない。出した本人が街を直せば、また待つ）。
  select coalesce(jsonb_agg(z.j order by z.at, z.id), '[]'::jsonb)
    into v_texts
    from (select jsonb_build_object('id', s.id, 'airline', s.airline, 'base', s.base_iata,
                   'town', t.name, 'town_state', t.state,
                   'good', s.good, 'concern', s.concern, 'rev', public.pv_town_rev(s)) as j,
                 s.updated_at as at, s.id
            from public.pv_town_posts s join public.pv_towns t on t.id = s.town_id
           where s.text_state = 'pending' and t.state <> 'rejected'
           order by s.updated_at, s.id
           limit 200) z;
  return jsonb_build_object('ok', true, 'scopes', v_scopes, 'towns', v_towns, 'texts', v_texts);
end;
$fn$;
revoke all on function public.pv_town_queue(jsonb) from public, anon;
grant execute on function public.pv_town_queue(jsonb) to authenticated;

-- 8-b. 通す／見送る。引数: { target:'town'|'text', id, state:'public'|'rejected', rev, into }
--   forbidden … 運営ではない（★何も調べずに返す）／ bad_state ／ bad_target ／ not_found
--   ledger    … 台帳の街（台帳で直す。ここでは動かさない）
--   final     … 見送ったものは、この口から公開へ戻せない（街は「追加」で入れ直す。文は本人が直せば、また確認待ちに入る）
--   changed   … 運営が見たあとで、文が直されている（★何も変えずに返す）
--   bad_into  … 束ねる先が無い・公開されていない・別の会社や基地
-- ★文を通すときは rev が要る（見た字と通す字が同じ）。見送るときは要らない。
-- ★into … 打ち込まれた名前を、在る街の別の書き方として通す。その名前の投稿を束ねた先へ移し、次からは打った時点で束ねた先に入る。
create or replace function public.pv_town_moderate(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_target text := coalesce(p->>'target', '');
  v_state  text := coalesce(p->>'state', '');
  v_town   public.pv_towns%rowtype;
  v_dst    public.pv_towns%rowtype;
  v_post   public.pv_town_posts%rowtype;
begin
  if not public.pv_is_operator() then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;
  if v_state not in ('public', 'rejected') then
    return jsonb_build_object('ok', false, 'status', 'bad_state');
  end if;
  if v_target not in ('town', 'text') then
    return jsonb_build_object('ok', false, 'status', 'bad_target');
  end if;

  if v_target = 'town' then
    if coalesce(p->>'id', '') !~ '^[0-9]{1,18}$' then
      return jsonb_build_object('ok', false, 'status', 'not_found');
    end if;
    select * into v_town from public.pv_towns where id = (p->>'id')::bigint for update;
    if v_town.id is null or v_town.alias_of is not null then
      return jsonb_build_object('ok', false, 'status', 'not_found');
    end if;
    if v_town.origin = 'ledger' then
      return jsonb_build_object('ok', false, 'status', 'ledger');
    end if;
    if v_town.state = 'rejected' and v_state = 'public' then
      return jsonb_build_object('ok', false, 'status', 'final');
    end if;
    if v_state = 'public' and coalesce(p->>'into', '') <> '' then
      if p->>'into' !~ '^[0-9]{1,18}$' then
        return jsonb_build_object('ok', false, 'status', 'bad_into');
      end if;
      select * into v_dst from public.pv_towns
       where id = (p->>'into')::bigint and id <> v_town.id
         and airline = v_town.airline and base_iata = v_town.base_iata
         and state = 'public' and alias_of is null
         for update;
      if v_dst.id is null then
        return jsonb_build_object('ok', false, 'status', 'bad_into');
      end if;
      -- 同じ人が両方に出していたら、束ねた先の行を残す
      delete from public.pv_town_posts s using public.pv_town_posts d
       where s.town_id = v_town.id and d.town_id = v_dst.id and d.author_hash = s.author_hash;
      update public.pv_town_posts set town_id = v_dst.id where town_id = v_town.id;
      -- 前にこの街へ束ねた書き方も、束ねた先へ付け替える（街を決める側は1段しかたどらない。LEAD-RULINGS-35 P12.23 a）
      update public.pv_towns set alias_of = v_dst.id where alias_of = v_town.id;
      update public.pv_towns set state = 'public', alias_of = v_dst.id, moderated_at = now() where id = v_town.id;
      return jsonb_build_object('ok', true, 'target', 'town', 'id', v_town.id, 'state', 'public', 'into', v_dst.id);
    end if;
    update public.pv_towns set state = v_state, moderated_at = now() where id = v_town.id;
    return jsonb_build_object('ok', true, 'target', 'town', 'id', v_town.id, 'state', v_state);
  end if;

  if coalesce(p->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;
  select * into v_post from public.pv_town_posts where id = (p->>'id')::uuid for update;
  if v_post.id is null or v_post.text_state = 'none' then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;
  if v_post.text_state = v_state then
    return jsonb_build_object('ok', true, 'target', 'text', 'id', v_post.id, 'state', v_state);
  end if;
  if v_post.text_state = 'rejected' then
    return jsonb_build_object('ok', false, 'status', 'final');
  end if;
  if v_state = 'public'
     and nullif(btrim(coalesce(p->>'rev', '')), '') is distinct from public.pv_town_rev(v_post) then
    return jsonb_build_object('ok', false, 'status', 'changed');
  end if;
  update public.pv_town_posts set text_state = v_state, moderated_at = now() where id = v_post.id;
  return jsonb_build_object('ok', true, 'target', 'text', 'id', v_post.id, 'state', v_state);
end;
$fn$;
revoke all on function public.pv_town_moderate(jsonb) from public, anon;
grant execute on function public.pv_town_moderate(jsonb) to authenticated;

-- 8-c. 運営が街を足す。引数: { airline, base, name }。候補として公開で入る（人数は付かない ＝ 一覧には、会員が挙げるまで出ない）。
--   同じ名前が確認待ち・見送りで在れば、それを公開にする。中身の検品は 3-b（断るときは日本語の文で止まる）。
create or replace function public.pv_town_admin_add(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_c    jsonb;
  v_town public.pv_towns%rowtype;
begin
  if not public.pv_is_operator() then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;
  v_c := public.pv_town_clean(jsonb_build_object(
           'airline', p->>'airline', 'base_iata', p->>'base', 'town', p->>'name'));
  select * into v_town from public.pv_towns
   where airline = v_c->>'airline' and base_iata = v_c->>'base_iata' and tkey = v_c->>'tkey' for update;
  if v_town.id is null then
    insert into public.pv_towns (airline, base_iata, tkey, name, origin, state, moderated_at)
    values (v_c->>'airline', v_c->>'base_iata', v_c->>'tkey', v_c->>'town', 'operator', 'public', now())
    returning * into v_town;
    return jsonb_build_object('ok', true, 'id', v_town.id, 'name', v_town.name, 'state', 'public', 'existed', false);
  end if;
  if v_town.alias_of is null and v_town.origin <> 'ledger'
     and (v_town.state <> 'public' or v_town.origin <> 'operator') then
    update public.pv_towns set state = 'public', origin = 'operator', moderated_at = now() where id = v_town.id;
  end if;
  return jsonb_build_object('ok', true, 'id', coalesce(v_town.alias_of, v_town.id), 'name', v_town.name,
                            'state', 'public', 'existed', true);
end;
$fn$;
revoke all on function public.pv_town_admin_add(jsonb) from public, anon;
grant execute on function public.pv_town_admin_add(jsonb) to authenticated;


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
                                                                                                          as 住所も位置も人の印も持たない,
       pg_get_functiondef('public.pv_town_board(jsonb)'::regprocedure) like '%pv_contrib_sees(%'           as 一覧は同じ決まりで返す,
       pg_get_functiondef('public.pv_town_options(jsonb)'::regprocedure)
         !~ '(auth\.uid|pv_contrib_sees|pv_work_level|pv_is_operator|pv_town_posts|pv_town_hash)'         as 候補は誰が読んでも同じ,
       pg_get_functiondef('public.pv_town_queue(jsonb)'::regprocedure) like '%pv_is_operator()%'
         and pg_get_functiondef('public.pv_town_moderate(jsonb)'::regprocedure) like '%pv_is_operator()%'
         and pg_get_functiondef('public.pv_town_admin_add(jsonb)'::regprocedure) like '%pv_is_operator()%' as 運営の口は名簿を見る,
       not has_function_privilege('anon', 'public.submit_town_post(jsonb)', 'execute')
         and not has_function_privilege('anon', 'public.my_town_posts(jsonb)', 'execute')
         and not has_function_privilege('anon', 'public.pv_town_queue(jsonb)', 'execute')
         and not has_function_privilege('authenticated', 'public.pv_town_clean(jsonb)', 'execute')
         and not has_function_privilege('authenticated', 'public.pv_town_key(text)', 'execute')           as 入口は決めたものだけ,
       (pg_get_functiondef('public.submit_town_post(jsonb)'::regprocedure)
          || pg_get_functiondef('public.my_town_posts(jsonb)'::regprocedure)
          || pg_get_functiondef('public.pv_town_board(jsonb)'::regprocedure)
          || pg_get_functiondef('public.pv_town_options(jsonb)'::regprocedure)
          || pg_get_functiondef('public.pv_town_clean(jsonb)'::regprocedure))
         !~ '(access_until|pay_report|pay_streak|last_pay|badge|verify_level|founding|review_unlock)'     as 資格に触らない;
