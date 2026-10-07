-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/review-summary.sql
-- 会社ページの「口コミの要約」（良い点・気になる点。各3つまで）のサーバ側
--
-- 何をするファイルか
--   会員が実際に出した口コミ（reviews_v2）から作った短い要約を1社×1言語につき
--   1つ預かり、**口コミの本文を読める人にだけ**返す。
--   要約を作るのは gen-review-summary.mjs（オーナーが手で流す）。ここは
--   「預かる・確かめる・返す」だけで、文章は1文字も作らない。
--
-- ★ 流す順番: db/airlines.generated.sql → db/pay-rows.sql → db/reviews-gate.sql → このファイル
--   （pv_has_review_key と pv_is_operator が要る。無ければ下の門で止まる）
-- ★ 何度流しても同じ結果になる（表は if not exists・関数は create or replace）。
--
-- ── 守っている約束 ─────────────────────────────────────────────
--  1. **読める人は口コミの本文と同じ。** 判定は db/reviews-gate.sql の
--     pv_has_review_key() を**呼ぶ**（写さない）。本文の門を動かせば要約の門も動く。
--     鍵の無い人へ返るのは {state:'locked'} の1語だけで、要約は1文字も返らない。
--  2. **少数の感想を会社全体の事実にしない。**
--       ・口コミが3件に満たない会社には要約を預けられない（n >= 3）。
--       ・1つの点は、2件以上の口コミが同じことを言っているときだけ（k >= 2）。
--       ・良い点・気になる点はそれぞれ3つまで。
--     どれも**サーバ側で**弾く。作る側のスクリプトが間違えても入らない。
--  3. **数えるのは reviews_v2 に在る行だけ。** 見本の口コミ（airlines/airline-reviews-data.js）と
--     海外評判のカード（overseas-rep/*.json）は DB に無いので、数えようがない。
--     0件の会社は「要約なし」であって、0点でも空の要約でもない（state:'none'）。
--  4. **元の口コミが変わったら出さない。** 預けたときの件数 n・材料にした
--     いちばん新しい口コミの時刻・**材料の集合の指紋**を覚えておき、
--       ・いま読める口コミが3件を切った
--       ・その時刻までの口コミの集合が、預けたときと違う（＝材料の1件が消えた）
--     のどちらかで {state:'none'} を返す。削除依頼で消した口コミの中身が、
--     要約の中に残って出続けることを止めるため。
--     あとから口コミが**増えた**だけなら、預けた要約をそのまま返す
--     （画面は「n件の口コミから・as_of」と出す ── 新しい分は入っていないと読める）。
--     ★件数だけで比べない。口コミは画面から表へ直に入る（submit-review.html）ので、
--       日付を古く書いた1件を足せば「1件消えて1件増えた」が件数では見えなくなる。
--       指紋は集合そのものを比べるので、その形でも出さなくなる。
--  5. **どの口コミが材料かを外へ出さない。** 点ごとに覚えるのは件数 k だけで、
--     点と口コミの対応（どの id がどの点を支えたか）は**預からない**。
--     指紋は材料ぜんぶの id を混ぜた md5 1つで、そこから id へは戻れない。
--     k も指紋も読む側には返さない（返すのは text と cat の2つ）。
--     k を返すと「この点は2件」＝ 3件しか無い会社では誰が言ったかの手がかりになる。
--  6. **書けるのは運営だけ。** pv_review_summary_set() の1本しか書く道が無い。
--     表は RLS を掛けてポリシーを1つも置かない＝ anon / authenticated からは
--     select も insert も通らない。読む道は pv_review_summary() だけ。
--
-- ── 罠 ─────────────────────────────────────────────────────────
--  ⚠️ 「要約が無い」と「鍵が無い」を取り違えない。順番は
--       入力の検査 → 預かった要約が在って今も有効か → 鍵
--     で、**要約が無いときは鍵を見ない**。鍵の有無で none の出方が変わると、
--     鍵の無い人の画面にだけ「鍵を開けると要約が読めます」と出て、開けたら何も無い。
--  ⚠️ 会社コードは2通り在る。古い投稿は 'cathay' のような短いコードで入っている
--     （db/migrate-airline-codes.sql は本番に流していない前提）。会社ページは
--     airlines/airline-reviews-ui.js の LEGACY_OF で両方を引いているので、
--     ここも同じ7組を pv_review_summary_codes() に**写してある**。
--     片方だけ直すと、画面の件数と要約の n が食い違う（検査が突き合わせている）。
--  ⚠️ 分類の鍵（cat）は会社ページの絞り込みチップと同じ6つ
--     （airlines/airline-reviews-data.js の REVIEW_CATS）。'mgmt' は口コミの欄には
--     在るがチップに無いので、要約の点には付けられない（押しても辿れない）。
--  ⚠️ 字数は言語で違う。日本語 8〜90字・英語 16〜180字（pv_review_summary_bad の1か所）。
--     gen-review-summary.mjs の LIMITS が写し。片方だけ動かさない。
--  ⚠️ 検査用の制約は not valid で足している ── 規則をあとで厳しくしたとき、
--     前に預けた行のせいで**このファイルごと流れなくなる**のを避けるため。
--     代わりに読む側が毎回同じ検査を通し、通らない行は {state:'none'} になる。
--  ⚠️ as_of は「要約を預けた日」（UTC）。いちばん新しい口コミの日ではない。
--
-- ★ このファイルを貼っただけでは、画面には何も出ない（預かった要約が0件だから）。
--   要約は1社ずつ、オーナーが gen-review-summary.mjs の出力を見て
--   pv_review_summary_set() に渡したときにだけ入る。
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

do $guard$
begin
  if to_regclass('public.reviews_v2') is null then
    raise exception '口コミの表（public.reviews_v2）がありません';
  end if;
  if to_regclass('public.pv_airlines') is null then
    raise exception '先に db/airlines.generated.sql を実行してください';
  end if;
  if to_regprocedure('public.pv_is_operator()') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pv_is_operator が無い）';
  end if;
  if to_regprocedure('public.pv_has_review_key()') is null then
    raise exception '先に db/reviews-gate.sql を実行してください（pv_has_review_key が無い）';
  end if;
end
$guard$;


-- ════════════════════════════════════════════════════════════════
-- 1. 表（1社 × 1言語 に1行）
--
-- good / concern は [{text, cat, k}] の配列。それ以外の鍵は入らない（3 の検査）。
-- n         … 要約を作ったときに読めた口コミの件数（画面の「n件の口コミから」）
-- newest_at … 材料にしたいちばん新しい口コミの時刻（古くなったかの判定に使う）
-- sig       … その時刻までの口コミの集合の指紋（pv_review_summary_sig。サーバが作る）
-- made_at   … 預けた時刻（as_of の出どころ）
-- ════════════════════════════════════════════════════════════════
create table if not exists public.pv_review_summaries (
  airline   text        not null references public.pv_airlines(code),
  lang      text        not null,
  n         integer     not null,
  newest_at timestamptz not null,
  sig       text        not null,
  good      jsonb       not null default '[]'::jsonb,
  concern   jsonb       not null default '[]'::jsonb,
  made_at   timestamptz not null default now(),
  primary key (airline, lang)
);

-- ★ RLS を掛けてポリシーを置かない ＝ anon / authenticated には1行も見えない。
--   revoke は2本目の錠（Supabase は public の新しい表に既定で全権限を配る）。
alter table public.pv_review_summaries enable row level security;
revoke all on public.pv_review_summaries from public, anon, authenticated;

comment on table public.pv_review_summaries is
  '口コミの要約（1社×1言語に1行）。読むのは pv_review_summary()、書くのは pv_review_summary_set() だけ。直に select できない。';


-- ════════════════════════════════════════════════════════════════
-- 2. 決めごとの置き場（どれも誰にも配らない）
-- ════════════════════════════════════════════════════════════════

-- 2-a. 点に付けられる分類の鍵。会社ページの絞り込みチップと同じ6つ。
create or replace function public.pv_review_summary_cats()
returns text[]
language sql
immutable
set search_path = public, extensions
as $fn$
  select array['culture', 'salary', 'benefits', 'wlb', 'ops', 'training']::text[];
$fn$;

revoke all on function public.pv_review_summary_cats() from public, anon, authenticated;

comment on function public.pv_review_summary_cats() is
  '要約の点に付けられる分類の鍵（6つ）。airlines/airline-reviews-data.js の REVIEW_CATS と同じ。誰にも grant しない。';


-- 2-b. その会社の口コミが入っている会社コード（いまのコード＋古い短いコード）。
--      airlines/airline-reviews-ui.js の LEGACY_OF の写し。
create or replace function public.pv_review_summary_codes(p_slug text)
returns text[]
language sql
immutable
set search_path = public, extensions
as $fn$
  select array_remove(array[
    p_slug,
    case p_slug
      when 'cathay-pacific'     then 'cathay'
      when 'qatar-airways'      then 'qatar'
      when 'singapore-airlines' then 'singapore'
      when 'spring-japan'       then 'spring'
      when 'alaska-airlines'    then 'alaska'
      when 'british-airways'    then 'british'
      when 'turkish-airlines'   then 'turkish'
    end
  ], null)::text[];
$fn$;

revoke all on function public.pv_review_summary_codes(text) from public, anon, authenticated;

comment on function public.pv_review_summary_codes(text) is
  '会社ページが口コミを引くときの会社コード（いまのコード＋古い短いコード）。airlines/airline-reviews-ui.js の LEGACY_OF の写し。誰にも grant しない。';


-- 2-c. 読める口コミ（の id）。「どの行を数えるか」はここ1か所。
--   数えるのは reviews_v2 に在って、6つの分類のどれかに本文が書いてある行だけ。
--   p_upto を渡すと、その時刻までに出された行だけ（null なら全部）。
-- ★ 本文の列名を並べない。分類の鍵から「<鍵>_comment」を引く
--   ── db/reviews-gate.sql が7つの case を1か所にしか書かせないのと同じ理由。
-- ★ 件数（2-d）と指紋（2-e）は必ずこれを通す。条件を2か所に書くと、
--   数え方と指紋の取り方が黙ってずれる。
create or replace function public.pv_review_summary_ids(p_codes text[], p_upto timestamptz)
returns setof text
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  select r.id::text
    from public.reviews_v2 r
   where r.airline = any (p_codes)
     and (p_upto is null
          or coalesce(r.created_at, '-infinity'::timestamptz) <= p_upto)
     and exists (
           select 1
             from unnest(public.pv_review_summary_cats()) c
            where btrim(coalesce(to_jsonb(r) ->> (c || '_comment'), '')) <> '');
$fn$;

revoke all on function public.pv_review_summary_ids(text[], timestamptz) from public, anon, authenticated;

comment on function public.pv_review_summary_ids(text[], timestamptz) is
  '読める口コミの id（reviews_v2 に在り、6分類のどれかに本文がある行）。見本と海外評判は DB に無いので入らない。件数と指紋の出どころ。誰にも grant しない。';


-- 2-d. 読める口コミの件数。
create or replace function public.pv_review_summary_count(p_codes text[], p_upto timestamptz)
returns integer
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  select count(*)::int from public.pv_review_summary_ids(p_codes, p_upto);
$fn$;

revoke all on function public.pv_review_summary_count(text[], timestamptz) from public, anon, authenticated;

comment on function public.pv_review_summary_count(text[], timestamptz) is
  '読める口コミの件数（pv_review_summary_ids の行数）。誰にも grant しない。';


-- 2-e. 材料の集合の指紋。その時刻までの口コミの id を並べて md5 にしたもの。
--   1件でも消える・入れ替わる・古い日付で足されると変わる。
--   あとから（その時刻より後に）増えただけでは変わらない。
create or replace function public.pv_review_summary_sig(p_codes text[], p_upto timestamptz)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  select md5(coalesce(string_agg(i, ',' order by i), ''))
    from public.pv_review_summary_ids(p_codes, p_upto) i;
$fn$;

revoke all on function public.pv_review_summary_sig(text[], timestamptz) from public, anon, authenticated;

comment on function public.pv_review_summary_sig(text[], timestamptz) is
  '材料にした口コミの集合の指紋（id を並べた md5）。元の口コミが消えた・入れ替わったことに気づくため。外へは返さない。誰にも grant しない。';


-- ════════════════════════════════════════════════════════════════
-- 3. 点の検査（書く側・表の制約・読む側の3か所が同じこれを呼ぶ）
--
-- 引数: p_list = [{text, cat, k}, …]／p_lang = 'ja' | 'en'／p_n = 口コミの件数
-- 返り値: 問題なければ null。あれば理由の語（そのまま {ok:false, error} に載る）
--   bad_lang        言語が ja でも en でもない
--   bad_shape       配列ではない
--   too_many        4つ以上ある
--   bad_point       点が {text, cat, k} の形でない（★ほかの鍵が1つでも在れば弾く
--                   ＝ 口コミの番号や id を付けたまま預けられない）
--   not_plain_text  改行・タブなどの制御文字、< >、前後の空白がある
--   text_too_short  短すぎる（日本語 8字未満・英語 16字未満）
--   text_too_long   長すぎる（日本語 90字超・英語 180字超）
--   bad_cat         分類の鍵が6つのどれでもない
--   weak_point      1件の口コミにしか支えられていない（k < 2）
--   bad_k           k が整数でない・口コミの件数より多い
-- ★ 空の配列は通る（良い点だけ・気になる点だけ、がありうる）。
--   両方とも空は「消す」の合図で、書く側が先に受け取る。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_review_summary_bad(p_list jsonb, p_lang text, p_n integer)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $fn$
declare
  v_lo  integer;
  v_hi  integer;
  v_el  jsonb;
  v_txt text;
  v_k   integer;
begin
  if p_lang = 'ja' then
    v_lo := 8;  v_hi := 90;
  elsif p_lang = 'en' then
    v_lo := 16; v_hi := 180;
  else
    return 'bad_lang';
  end if;

  if p_list is null or jsonb_typeof(p_list) <> 'array' then
    return 'bad_shape';
  end if;
  if jsonb_array_length(p_list) > 3 then
    return 'too_many';
  end if;

  for v_el in select e from jsonb_array_elements(p_list) e loop
    if jsonb_typeof(v_el) <> 'object'
       or jsonb_typeof(v_el -> 'text') is distinct from 'string'
       or jsonb_typeof(v_el -> 'cat')  is distinct from 'string'
       or not (v_el ? 'k')
       or exists (select 1 from jsonb_object_keys(v_el) key
                   where key not in ('text', 'cat', 'k')) then
      return 'bad_point';
    end if;

    v_txt := v_el ->> 'text';
    if v_txt ~ '[[:cntrl:]]' or v_txt ~ '[<>]' or v_txt <> btrim(v_txt) then
      return 'not_plain_text';
    end if;
    if char_length(v_txt) < v_lo then
      return 'text_too_short';
    end if;
    if char_length(v_txt) > v_hi then
      return 'text_too_long';
    end if;

    if not ((v_el ->> 'cat') = any (public.pv_review_summary_cats())) then
      return 'bad_cat';
    end if;

    if jsonb_typeof(v_el -> 'k') <> 'number' or (v_el ->> 'k') !~ '^[0-9]{1,6}$' then
      return 'bad_k';
    end if;
    v_k := (v_el ->> 'k')::integer;
    if v_k < 2 then
      return 'weak_point';
    end if;
    if p_n is null or v_k > p_n then
      return 'bad_k';
    end if;
  end loop;

  return null;
end;
$fn$;

revoke all on function public.pv_review_summary_bad(jsonb, text, integer) from public, anon, authenticated;

comment on function public.pv_review_summary_bad(jsonb, text, integer) is
  '要約の点の並びを検査する。問題なければ null、あれば理由の語。書く側・表の制約・読む側が同じこれを呼ぶ。誰にも grant しない。';


-- ★ 表にも同じ検査を掛ける（2本目の錠）。SQL Editor から手で insert しても、
--   3件未満・k が1・4つ以上・長すぎる文・余計な鍵は入らない。
-- ⚠️ not valid ＝ 前から在る行は見直さない（冒頭の罠）。新しく入る行には効く。
alter table public.pv_review_summaries drop constraint if exists pv_review_summaries_lang_chk;
alter table public.pv_review_summaries add  constraint pv_review_summaries_lang_chk
  check (lang in ('ja', 'en')) not valid;

alter table public.pv_review_summaries drop constraint if exists pv_review_summaries_n_chk;
alter table public.pv_review_summaries add  constraint pv_review_summaries_n_chk
  check (n >= 3) not valid;

alter table public.pv_review_summaries drop constraint if exists pv_review_summaries_points_chk;
alter table public.pv_review_summaries add  constraint pv_review_summaries_points_chk
  check (public.pv_review_summary_bad(good,    lang, n) is null
     and public.pv_review_summary_bad(concern, lang, n) is null
     and (good || concern) <> '[]'::jsonb) not valid;


-- 3-b. 外へ返す形に直す。text と cat の2つだけ ── k は落とす（約束 5）。
create or replace function public.pv_review_summary_out(p_list jsonb)
returns jsonb
language sql
immutable
set search_path = public, extensions
as $fn$
  select coalesce(jsonb_agg(jsonb_build_object('text', e.v ->> 'text',
                                               'cat',  e.v ->> 'cat')
                            order by e.i), '[]'::jsonb)
    from jsonb_array_elements(p_list) with ordinality e(v, i);
$fn$;

revoke all on function public.pv_review_summary_out(jsonb) from public, anon, authenticated;

comment on function public.pv_review_summary_out(jsonb) is
  '預かった点の並びを、外へ返す {text, cat} だけの形に直す（k を落とす）。誰にも grant しない。';


-- ════════════════════════════════════════════════════════════════
-- 4. 読む（会社ページが呼ぶ）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {airline:'<会社コード>', lang:'ja'|'en'}
-- 返り値:
--   {ok:false, error:'bad_airline'|'bad_lang'}   引数が変（名簿に無い会社など）
--   {ok:true,  state:'none'}     預かった要約が無い／元の口コミが減って出せなくなった
--   {ok:true,  state:'locked'}   要約は在るが、呼んだ人は口コミの本文を読めない
--   {ok:true,  state:'open', n, as_of:'YYYY-MM-DD',
--              good:[{text, cat}], concern:[{text, cat}]}
-- ★ 未ログイン（anon）にも配ってある。配らないと画面は「権限エラー」と
--   「鍵が掛かっている」を見分けられない（pv_stays と同じ作法）。
-- ★ none は鍵を見る**前**に返す（冒頭の罠）。鍵の有無で none の出方は変わらない。
-- ★ open で返すのは text と cat だけ。k・口コミの id・書いた人は1つも入らない。
create or replace function public.pv_review_summary(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_air   text := lower(btrim(coalesce(p ->> 'airline', '')));
  v_lang  text := coalesce(p ->> 'lang', '');
  v_row   public.pv_review_summaries%rowtype;
  v_codes text[];
begin
  if not exists (select 1 from public.pv_airlines a
                  where a.code = v_air and a.code <> 'other') then
    return jsonb_build_object('ok', false, 'error', 'bad_airline');
  end if;
  if v_lang not in ('ja', 'en') then
    return jsonb_build_object('ok', false, 'error', 'bad_lang');
  end if;

  select * into v_row
    from public.pv_review_summaries s
   where s.airline = v_air and s.lang = v_lang;
  if not found then
    return jsonb_build_object('ok', true, 'state', 'none');
  end if;

  /* いまも出してよいか（約束 4）。
       ・読める口コミが3件を切った
       ・材料にした時刻までの口コミの集合が、預けたときと違う（指紋が合わない）
       ・預けた中身が、いまの検査を通らない
     のどれかで「無い」と同じ顔にする。 */
  v_codes := public.pv_review_summary_codes(v_air);
  if public.pv_review_summary_count(v_codes, null) < 3
     or public.pv_review_summary_sig(v_codes, v_row.newest_at) is distinct from v_row.sig
     or public.pv_review_summary_bad(v_row.good,    v_row.lang, v_row.n) is not null
     or public.pv_review_summary_bad(v_row.concern, v_row.lang, v_row.n) is not null
     or (v_row.good || v_row.concern) = '[]'::jsonb then
    return jsonb_build_object('ok', true, 'state', 'none');
  end if;

  /* ★本文と同じ門（約束 1）。写さずに呼ぶ。 */
  if not public.pv_has_review_key() then
    return jsonb_build_object('ok', true, 'state', 'locked');
  end if;

  return jsonb_build_object(
    'ok', true, 'state', 'open',
    'n', v_row.n,
    'as_of', to_char(v_row.made_at at time zone 'utc', 'YYYY-MM-DD'),
    'good',    public.pv_review_summary_out(v_row.good),
    'concern', public.pv_review_summary_out(v_row.concern));
end;
$fn$;

revoke all on function public.pv_review_summary(jsonb) from public;
grant execute on function public.pv_review_summary(jsonb) to anon, authenticated;

comment on function public.pv_review_summary(jsonb) is
  '口コミの要約を返す。本文を読める人（pv_has_review_key）にだけ中身が返り、ほかは locked の1語。'
  '要約が無い・元の口コミが減ったときは none（鍵を見る前に返す）。k と口コミの id は返さない。';


-- ════════════════════════════════════════════════════════════════
-- 5. 預ける／消す（運営だけ）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {airline, lang, n, newest, good:[{text, cat, k}], concern:[{text, cat, k}]}
--   n      … 要約の材料にした口コミの件数
--   newest … 材料にしたいちばん新しい口コミの created_at（pv_reviews が返す字のまま渡す）
--   ★ good と concern が**両方とも空の配列**なら、その会社×言語の行を消す（n・newest は読まない）。
-- 返り値:
--   {ok:true, state:'saved', airline, lang, n, as_of}
--   {ok:true, state:'deleted'}
--   {ok:false, error:…}
--     bad_airline / bad_lang   名簿に無い会社・ja でも en でもない
--     bad_shape                good か concern が配列で届いていない
--                              （★鍵ごと無いときも弾く。書き損じで消えないように）
--     bad_n / bad_newest       n が整数でない・newest が時刻として読めない／先の時刻
--     too_few_reviews          n が3未満、または**いま**読める口コミが3件に満たない
--     stale_input              newest までの口コミの件数が n と合わない
--                              （書き出したあとで口コミが消えた・別の会社の束を渡した）
--     そのほか                 3 の検査が返す語（too_many / weak_point / text_too_long …）
-- ★ 運営でない人が呼ぶと 42501（管理者ページのほかの関数と同じ）。何も調べずに返す。
--   名簿は db/admin.sql の pv_admins（pv_is_admin と同じ1つ）。判定は
--   db/pay-rows.sql の pv_is_operator ── 名簿が無い環境では必ず false。
-- ★ 件数は**サーバが数え直す**。渡された n をそのまま信じない
--   （画面に「n件の口コミから」と出る数なので、盛れない形にしてある）。
create or replace function public.pv_review_summary_set(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_air    text := lower(btrim(coalesce(p ->> 'airline', '')));
  v_lang   text := coalesce(p ->> 'lang', '');
  v_good   jsonb := p -> 'good';
  v_con    jsonb := p -> 'concern';
  v_n      integer;
  v_newest timestamptz;
  v_err    text;
  v_codes  text[];
  v_made   timestamptz;
begin
  if not public.pv_is_operator() then
    raise exception '管理者ではありません' using errcode = '42501';
  end if;

  if not exists (select 1 from public.pv_airlines a
                  where a.code = v_air and a.code <> 'other') then
    return jsonb_build_object('ok', false, 'error', 'bad_airline');
  end if;
  if v_lang not in ('ja', 'en') then
    return jsonb_build_object('ok', false, 'error', 'bad_lang');
  end if;
  if jsonb_typeof(v_good) is distinct from 'array'
     or jsonb_typeof(v_con) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'bad_shape');
  end if;

  /* 両方とも空 ＝ 消す。 */
  if jsonb_array_length(v_good) = 0 and jsonb_array_length(v_con) = 0 then
    delete from public.pv_review_summaries s
     where s.airline = v_air and s.lang = v_lang;
    return jsonb_build_object('ok', true, 'state', 'deleted');
  end if;

  if jsonb_typeof(p -> 'n') is distinct from 'number'
     or (p ->> 'n') !~ '^[0-9]{1,6}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_n');
  end if;
  v_n := (p ->> 'n')::integer;
  if v_n < 3 then
    return jsonb_build_object('ok', false, 'error', 'too_few_reviews');
  end if;

  begin
    v_newest := nullif(btrim(coalesce(p ->> 'newest', '')), '')::timestamptz;
  exception when others then
    v_newest := null;
  end;
  if v_newest is null or v_newest > now() then
    return jsonb_build_object('ok', false, 'error', 'bad_newest');
  end if;

  v_err := coalesce(public.pv_review_summary_bad(v_good, v_lang, v_n),
                    public.pv_review_summary_bad(v_con,  v_lang, v_n));
  if v_err is not null then
    return jsonb_build_object('ok', false, 'error', v_err);
  end if;

  /* ★件数はここで数え直す。 */
  v_codes := public.pv_review_summary_codes(v_air);
  if public.pv_review_summary_count(v_codes, null) < 3 then
    return jsonb_build_object('ok', false, 'error', 'too_few_reviews');
  end if;
  if public.pv_review_summary_count(v_codes, v_newest) <> v_n then
    return jsonb_build_object('ok', false, 'error', 'stale_input');
  end if;

  /* ★指紋もここで取る（渡された値は使わない）。 */
  insert into public.pv_review_summaries as s
         (airline, lang, n, newest_at, sig, good, concern, made_at)
  values (v_air, v_lang, v_n, v_newest,
          public.pv_review_summary_sig(v_codes, v_newest), v_good, v_con, now())
  on conflict (airline, lang) do update
     set n = excluded.n, newest_at = excluded.newest_at, sig = excluded.sig,
         good = excluded.good, concern = excluded.concern, made_at = excluded.made_at
  returning s.made_at into v_made;

  return jsonb_build_object(
    'ok', true, 'state', 'saved',
    'airline', v_air, 'lang', v_lang, 'n', v_n,
    'as_of', to_char(v_made at time zone 'utc', 'YYYY-MM-DD'));
end;
$fn$;

-- grant は authenticated に出すが、守っているのは中の pv_is_operator() の判定。
revoke all on function public.pv_review_summary_set(jsonb) from public, anon;
grant execute on function public.pv_review_summary_set(jsonb) to authenticated;

comment on function public.pv_review_summary_set(jsonb) is
  '口コミの要約を預ける／消す。運営だけ（一般ユーザーが呼ぶと 42501）。'
  '3件未満の会社・1件にしか支えられていない点・4つ以上・長すぎる文は入らない。件数はサーバが数え直す。';


-- ════════════════════════════════════════════════════════════════
-- 検算（貼ったあと、4行とも ✅ になっていること）
-- ════════════════════════════════════════════════════════════════
select '表は anon / authenticated から直に読めない' as 確認,
       case when not has_table_privilege('anon', 'public.pv_review_summaries', 'select')
             and not has_table_privilege('authenticated', 'public.pv_review_summaries', 'select')
             and (select c.relrowsecurity from pg_class c
                   where c.oid = 'public.pv_review_summaries'::regclass)
             and not exists (select 1 from pg_policies q
                              where q.schemaname = 'public'
                                and q.tablename = 'pv_review_summaries')
            then '✅' else '❌' end as 結果
union all
select '読む関数は未ログインからも呼べる',
       case when has_function_privilege('anon', 'public.pv_review_summary(jsonb)', 'execute')
             and has_function_privilege('authenticated', 'public.pv_review_summary(jsonb)', 'execute')
            then '✅' else '❌' end
union all
select '預ける関数は未ログインから呼べない',
       case when not has_function_privilege('anon', 'public.pv_review_summary_set(jsonb)', 'execute')
            then '✅' else '❌' end
union all
select '中の部品は誰にも配っていない',
       case when not has_function_privilege('authenticated', 'public.pv_review_summary_bad(jsonb, text, integer)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_review_summary_ids(text[], timestamptz)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_review_summary_count(text[], timestamptz)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_review_summary_sig(text[], timestamptz)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_review_summary_codes(text)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_review_summary_cats()', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_review_summary_out(jsonb)', 'execute')
            then '✅' else '❌' end;
