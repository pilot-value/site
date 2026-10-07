-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/review-summary.sql
-- 会社ページの「口コミの要約」（良い点・気になる点。各3つまで）のサーバ側
--
-- 何をするファイルか
--   会員が実際に出した口コミ（reviews_v2）から作った短い要約を1社×1言語につき
--   1つ預かり、**口コミの本文を読める人にだけ**返す。
--   要約を作るのは2つ ── gen-review-summary.mjs（オーナーが手で流す）と、
--   supabase/functions/summarize-reviews（口コミが増えた・消えたときに自動で流れる）。
--   文面と検品は supabase/functions/summarize-reviews/index.ts の1か所に在り、
--   手で流す道具もそれを読む。ここは「預かる・確かめる・返す」だけで、
--   文章は1文字も作らない。
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
--  6. **書けるのは運営と、サーバの鍵（service_role）を持つ自動の道だけ。**
--       ・運営が手で預ける … pv_review_summary_set()（管理者の名簿に居る人だけ）
--       ・自動で預ける     … pv_review_summary_set_auto()（service_role にだけ配る。
--                            会員にも、ページから呼ぶ運営にも配っていない）
--     どちらも中の pv_review_summary_put() の**同じ1本**を通る＝検査が2つに割れない。
--     表は RLS を掛けてポリシーを1つも置かない＝ anon / authenticated からは
--     select も insert も通らない。読む道は pv_review_summary() だけ。
--  7. **自動の道は、いまの口コミ全部から作った要約しか預からない。**
--     材料を渡したときの集合の指紋（basis）を覚えさせ、預けに来たときに
--     いまの集合と比べる。違えば stale_input で断る＝ 古い集合から作った要約が、
--     新しい集合の要約を上書きすることは無い（6 の節）。
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
--  ⚠️ 指紋は口コミの **id の集合**。本文を書き換えた・訳があとから入った、では
--     変わらない＝ 自動の道はそれを「変わった」と数えない（作り直さない）。
--  ⚠️ service_role への grant は「その役が在るときだけ」出す（6 の末尾の do ブロック）。
--     手元の検査用の DB には役が無いことがあり、素の grant だとファイルごと止まる。
--
-- ★ このファイルを貼っただけでは、画面には何も出ない（預かった要約が0件だから）。
--   要約が入るのは次のどちらかのときだけ。
--     ・オーナーが gen-review-summary.mjs の出力を見て pv_review_summary_set() に渡した
--     ・Edge Function の summarize-reviews をデプロイし、db/review-summary-webhook.sql を
--       流した（＝自動の道を開けた）。開けるまで、6 の関数は誰からも呼ばれない。
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
  '口コミの要約（1社×1言語に1行）。読むのは pv_review_summary()、書くのは pv_review_summary_set()（運営）と pv_review_summary_set_auto()（service_role）だけ。直に select できない。';


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
-- 5. 預ける／消す（運営の道。自動の道は 6）
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
--
-- 5-a. 中の1本（検査して入れる）。**誰にも配らない。**
--   運営の道（5-b）と自動の道（6-e）は、門が違うだけで**どちらもこれを呼ぶ**。
--   検査をここ以外に書かない ── 2つに割れると、片方だけ直して黙ってずれる。
--   ★ この関数は「誰が呼んだか」を見ない。門は必ず呼ぶ側に置く。
create or replace function public.pv_review_summary_put(p jsonb)
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

revoke all on function public.pv_review_summary_put(jsonb) from public, anon, authenticated;

comment on function public.pv_review_summary_put(jsonb) is
  '口コミの要約を検査して入れる／消す、中の1本。誰が呼んだかは見ない（門は呼ぶ側）。'
  '運営の道 pv_review_summary_set と自動の道 pv_review_summary_set_auto の両方がこれを呼ぶ。誰にも grant しない。';


-- 5-b. 運営の道（管理者ページ・SQL Editor から、運営のログインで呼ぶ）。
create or replace function public.pv_review_summary_set(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
begin
  if not public.pv_is_operator() then
    raise exception '管理者ではありません' using errcode = '42501';
  end if;
  return public.pv_review_summary_put(p);
end;
$fn$;

-- grant は authenticated に出すが、守っているのは中の pv_is_operator() の判定。
revoke all on function public.pv_review_summary_set(jsonb) from public, anon;
grant execute on function public.pv_review_summary_set(jsonb) to authenticated;

comment on function public.pv_review_summary_set(jsonb) is
  '口コミの要約を預ける／消す。運営だけ（一般ユーザーが呼ぶと 42501）。'
  '3件未満の会社・1件にしか支えられていない点・4つ以上・長すぎる文は入らない。件数はサーバが数え直す。';


-- ════════════════════════════════════════════════════════════════
-- 6. 自動の道（Edge Function の summarize-reviews だけが呼ぶ）
--
-- 口コミが増えた・消えたときに、要約を作り直す。作るのは Edge Function で、
-- ここは「作り直しが要るか決める・材料を渡す・検査して預かる」だけ。
--
-- ★ 4本とも **service_role にだけ**配る。anon・authenticated（＝会員）には配らない。
--   運営のログインでページから呼んでも通らない（運営の道は 5-b の1本だけ）。
-- ★ 流れ（Edge Function から見た順）
--     due      … どの会社×言語を作り直すか（読むだけ）
--     take     … 1社ぶんの番を取り、材料（口コミの本文）と指紋 basis を受け取る
--     （ここでモデルを1回呼ぶ ── お金がかかるのはここだけ）
--     set_auto … basis と一緒に預ける。basis がいまの集合と違えば断られる
--     done     … 預けられずに終わったとき、番を返す（失敗／鍵の問題）
--
-- ── 守っていること ────────────────────────────────────────────
--  a. **変わっていなければ、モデルを呼ばせない。** 要るかどうかは 6-b の1か所が決める。
--     外から同じ知らせを何度投げられても、答えは DB が持っている。
--  b. **同じ会社×言語を、同時に2人が作らない。** take が控え（6-a）に「いま作っている」
--     と書く。あとから来た人には busy が返り、材料は渡らない＝モデルを呼べない。
--     番は 10分で切れる（Edge Function は長くても数分で落ちる。切れた番は死んだもの）。
--     切れた番は**失敗と同じ扱い**（c の回数に入り、同じ集合は番を取ってから30分待つ）。
--     そのあいだに集合が変わっていれば、切れた時点ですぐ作る（回数は1から）。
--  c. **同じ集合に、二度お金を払わない。** 預け終えた集合・点が1つも残らなかった集合は
--     控えに残り、集合が変わるまで settled が返る。失敗は同じ集合につき3回まで・
--     30分おき（cooling → parked）。parked は集合が変わるか、控えを手で消すまで続く。
--  d. **古い集合の要約で、新しい集合の要約を上書きしない。** set_auto は basis を
--     いまの集合の指紋と比べ、違えば stale_input で断る（約束 7）。
--     ＝ 預かるのは必ず「いま読める口コミ全部」から作った要約。
--  e. 材料として渡すのは、読める口コミの本文と、言語を選ぶための2欄だけ。
--     id・書いた人・職位・機種・在籍年数・提案の欄は渡さない。
--
-- ⚠️ b は「番を取ってから」の話。番を取る瞬間の順番は pg_advisory_xact_lock が守る
--    （同じ会社×言語の take と set_auto は1つずつしか通らない）。
-- ⚠️ 運営が手で預ける道（5-b）は控えに書かない。なので ──
--    ・**自動が作った**要約を手で消すと、集合が変わるまで自動では作り直さない（c の settled）。
--      すぐ作り直させたいときは、その会社の控えを1行消す:
--        delete from public.pv_review_summary_runs where airline = '<会社コード>';
--    ・**手で預けた**要約を手で消すと、控えが無いので、次の知らせ・見回りで自動が作る。
--    ・手で預けた要約も、口コミの集合が変われば自動のものに置き換わる。
--    「この会社には出さない」と決めておく場所は、いまは無い。
-- ════════════════════════════════════════════════════════════════

-- 6-a. 控え（1社 × 1言語 に1行）。「この集合に、もう払ったか」を覚えるだけ。
--   sig    … そのとき読めた口コミ全部の指紋（pv_review_summary_sig(codes, null)）
--   state  … running（作っている）／saved（預けた）／empty（点が残らなかった）／failed
--   tries  … 同じ sig で番を取った回数（sig が変われば 1 に戻る）
--   ran_at … state を書いた時刻（番の期限・失敗のあとの待ち時間を測る）
-- ★ 要約の文も口コミの本文も入らない。名簿への参照も置かない（消しても困らない表）。
create table if not exists public.pv_review_summary_runs (
  airline text        not null,
  lang    text        not null,
  sig     text        not null,
  n       integer     not null,
  state   text        not null,
  tries   integer     not null default 1,
  ran_at  timestamptz not null default now(),
  primary key (airline, lang)
);

alter table public.pv_review_summary_runs enable row level security;
revoke all on public.pv_review_summary_runs from public, anon, authenticated;

comment on table public.pv_review_summary_runs is
  '口コミの要約を自動で作り直すときの控え（1社×1言語に1行）。集合の指紋・状態・回数だけ。文章は入らない。直に select できない。';


-- 6-b. 作り直しが要るか。**決めるのはここ1か所**（due も take もこれを呼ぶ）。
--   返り値（語）:
--     none        口コミが3件に満たず、預かった要約も無い（何もしない）
--     too_few     口コミが3件に満たないのに、預かった要約が在る（→ 消す）
--     fresh       預かった要約の指紋が、いまの集合と同じ（何もしない）
--     busy        ほかの呼び出しが作っている最中（番を取って10分以内）
--     settled     この集合はもう済んだ（預けた／点が1つも残らなかった）
--     parked      この集合で3回失敗した（集合が変わるまで止める）
--     cooling     この集合で失敗して（または番を取ったまま落ちて）から30分たっていない
--     bad_newest  いちばん新しい口コミの時刻が無い・先の時刻（預けても断られる）
--     missing     3件以上あるのに、預かった要約が無い        （→ 作る）
--     stale       預かった要約の指紋が、いまの集合と違う      （→ 作り直す）
--   ★ 作る・消すに進むのは too_few / missing / stale の3つだけ。
create or replace function public.pv_review_summary_need(p_air text, p_lang text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_codes text[] := public.pv_review_summary_codes(p_air);
  v_n     integer;
  v_sig   text;
  v_max   timestamptz;
  v_has   boolean;
  v_row   public.pv_review_summaries%rowtype;
  v_run   public.pv_review_summary_runs%rowtype;
begin
  select * into v_row
    from public.pv_review_summaries s
   where s.airline = p_air and s.lang = p_lang;
  v_has := found;

  v_n := public.pv_review_summary_count(v_codes, null);
  if v_n < 3 then
    return case when v_has then 'too_few' else 'none' end;
  end if;

  /* ★読む側（4）は「預けた時刻までの集合」を比べるが、ここは**いまの全部**と比べる。
     あとから1件増えただけでも指紋は変わる ＝ 作り直す。 */
  v_sig := public.pv_review_summary_sig(v_codes, null);
  if v_has
     and v_row.sig = v_sig
     and public.pv_review_summary_bad(v_row.good,    v_row.lang, v_row.n) is null
     and public.pv_review_summary_bad(v_row.concern, v_row.lang, v_row.n) is null
     and (v_row.good || v_row.concern) <> '[]'::jsonb then
    return 'fresh';
  end if;

  select * into v_run
    from public.pv_review_summary_runs r
   where r.airline = p_air and r.lang = p_lang;
  if found then
    if v_run.state = 'running' and v_run.ran_at > now() - interval '10 minutes' then
      return 'busy';
    end if;
    if v_run.sig = v_sig then
      if v_run.state in ('saved', 'empty') then
        return 'settled';
      end if;
      /* ここに来るのは failed か、期限の切れた running（＝途中で落ちた呼び出し）。 */
      if v_run.tries >= 3 then
        return 'parked';
      end if;
      if v_run.ran_at > now() - interval '30 minutes' then
        return 'cooling';
      end if;
    end if;
  end if;

  select max(r.created_at) into v_max
    from public.reviews_v2 r
   where r.id::text in (select public.pv_review_summary_ids(v_codes, null));
  if v_max is null or v_max > now() then
    return 'bad_newest';
  end if;

  return case when v_has then 'stale' else 'missing' end;
end;
$fn$;

revoke all on function public.pv_review_summary_need(text, text) from public, anon, authenticated;

comment on function public.pv_review_summary_need(text, text) is
  '口コミの要約を作り直す必要があるかを1語で返す（none / too_few / fresh / busy / settled / parked / cooling / bad_newest / missing / stale）。決めるのはここ1か所。誰にも grant しない。';


-- 6-c. 作り直しが要る会社×言語の一覧（読むだけ・番は取らない）。
-- 引数: p = {langs:['ja', …], airline:'<会社コード>'（無くてもよい）}
--   airline … 渡すと、その会社だけを見る。**古い短いコードで渡してもよい**
--             （口コミの行に入っている字のまま渡せる。いまのコードへ引き直す）。
--             名簿に無い字なら、何も見ずに空の一覧を返す。
-- 返り値:
--   {ok:false, error:'bad_lang'}
--   {ok:true, checked:<見た会社×言語の数>, due:[{airline, lang, why}]}
--     why は too_few / missing / stale のどれか（6-b）
-- ★ 見るのは、口コミが1件でも在る会社と、要約を預かっている会社だけ。
create or replace function public.pv_review_summary_due(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_hint  text  := lower(btrim(coalesce(p ->> 'airline', '')));
  v_langs jsonb := p -> 'langs';
  v_air   text;
  v_lang  text;
  v_need  text;
  v_seen  integer := 0;
  v_due   jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(v_langs) is distinct from 'array'
     or jsonb_array_length(v_langs) = 0
     or exists (select 1 from jsonb_array_elements(v_langs) e
                 where jsonb_typeof(e) <> 'string'
                    or (e #>> '{}') not in ('ja', 'en')) then
    return jsonb_build_object('ok', false, 'error', 'bad_lang');
  end if;

  for v_air in
    select a.code
      from public.pv_airlines a
     where a.code <> 'other'
       and (v_hint = '' or v_hint = any (public.pv_review_summary_codes(a.code)))
       and (exists (select 1 from public.reviews_v2 r
                     where r.airline = any (public.pv_review_summary_codes(a.code)))
            or exists (select 1 from public.pv_review_summaries s
                        where s.airline = a.code))
     order by a.code
  loop
    for v_lang in
      select distinct e #>> '{}' from jsonb_array_elements(v_langs) e order by 1
    loop
      v_seen := v_seen + 1;
      v_need := public.pv_review_summary_need(v_air, v_lang);
      if v_need in ('too_few', 'missing', 'stale') then
        v_due := v_due || jsonb_build_object('airline', v_air, 'lang', v_lang, 'why', v_need);
      end if;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'checked', v_seen, 'due', v_due);
end;
$fn$;

revoke all on function public.pv_review_summary_due(jsonb) from public, anon, authenticated;

comment on function public.pv_review_summary_due(jsonb) is
  '口コミの要約を作り直す必要がある会社×言語の一覧（読むだけ）。返るのは会社コード・言語・理由の語だけ。service_role だけ。';


-- 6-d. 1社ぶんの番を取り、材料を受け取る。
-- 引数: p = {airline:'<いまの会社コード>', lang:'ja'|'en'}
-- 返り値:
--   {ok:false, error:'bad_airline'|'bad_lang'}
--   {ok:true, state:'go', why:'missing'|'stale', n, basis, rows:[…]}
--        番を取った。rows が材料（読める口コミだけ・古い順）。
--        basis はこの集合の指紋 ── 預けるとき（6-e）にそのまま返す。
--   {ok:true, state:'too_few', n, basis}
--        3件に満たないのに要約が在る。モデルは呼ばず、空で預ければ消える（番は取らない）。
--   {ok:true, state:'none'|'fresh'|'busy'|'settled'|'parked'|'cooling'|'bad_newest'}
--        何もしない（材料も basis も返さない ＝ この先へ進めない）。
-- ★ rows の1行は {airline, created_at, orig_lang, translations:{<lang>:{…}}, <分類>_comment ×6}。
--   口コミの id・proof_hash・職位・機種・在籍年数・年収・提案の欄（mgmt）は**入れない**。
--   translations は、頼まれた言語の・6分類の訳だけ。
-- ★ basis を先に読み、そのあと rows を読む（同じ1文の中）。逆にすると、間に1件
--   入ったとき「新しい指紋・古い材料」になり、古い集合の要約が通ってしまう。
create or replace function public.pv_review_summary_take(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_air   text := lower(btrim(coalesce(p ->> 'airline', '')));
  v_lang  text := coalesce(p ->> 'lang', '');
  v_codes text[];
  v_need  text;
  v_n     integer;
  v_sig   text;
  v_rows  jsonb;
begin
  if not exists (select 1 from public.pv_airlines a
                  where a.code = v_air and a.code <> 'other') then
    return jsonb_build_object('ok', false, 'error', 'bad_airline');
  end if;
  if v_lang not in ('ja', 'en') then
    return jsonb_build_object('ok', false, 'error', 'bad_lang');
  end if;

  /* 同じ会社×言語の take と set_auto を1つずつに並べる（この取引が終わるまで）。 */
  perform pg_advisory_xact_lock(hashtext('pv_review_summary'), hashtext(v_air || ':' || v_lang));

  v_codes := public.pv_review_summary_codes(v_air);
  v_need  := public.pv_review_summary_need(v_air, v_lang);

  if v_need not in ('too_few', 'missing', 'stale') then
    return jsonb_build_object('ok', true, 'state', v_need);
  end if;

  /* ★件数・指紋・材料を**1文で**読む（同じ瞬間の集合）。 */
  select public.pv_review_summary_count(v_codes, null),
         public.pv_review_summary_sig(v_codes, null),
         coalesce((
           select jsonb_agg(x.j order by x.ts, x.id)
             from (
               select r.created_at as ts, r.id::text as id,
                      jsonb_build_object(
                        'airline',      r.airline,
                        'created_at',   r.created_at,
                        'orig_lang',    r.orig_lang,
                        'translations', jsonb_build_object(v_lang, coalesce((
                            select jsonb_object_agg(c, r.translations -> v_lang -> c)
                              from unnest(public.pv_review_summary_cats()) c
                             where jsonb_typeof(r.translations -> v_lang -> c) = 'string'),
                            '{}'::jsonb)))
                      || (select jsonb_object_agg(c || '_comment', to_jsonb(r) -> (c || '_comment'))
                            from unnest(public.pv_review_summary_cats()) c) as j
                 from public.reviews_v2 r
                where r.id::text in (select public.pv_review_summary_ids(v_codes, null))
             ) x), '[]'::jsonb)
    into v_n, v_sig, v_rows;

  /* 「要るか」を読んだあと・材料を読む前に口コミが動いた（3件の境をまたいだ）。
     この知らせでは何もしない ── 動かした側の知らせが、あとから自分で来る。 */
  if (v_need = 'too_few') <> (v_n < 3) then
    return jsonb_build_object('ok', true, 'state', 'busy');
  end if;

  if v_need = 'too_few' then
    return jsonb_build_object('ok', true, 'state', 'too_few', 'n', v_n, 'basis', v_sig);
  end if;

  /* 番を取る。同じ集合なら回数を1つ足し、集合が変わっていれば1に戻す。 */
  insert into public.pv_review_summary_runs as r
         (airline, lang, sig, n, state, tries, ran_at)
  values (v_air, v_lang, v_sig, v_n, 'running', 1, now())
  on conflict (airline, lang) do update
     set tries  = case when r.sig = excluded.sig then r.tries + 1 else 1 end,
         sig    = excluded.sig,
         n      = excluded.n,
         state  = excluded.state,
         ran_at = excluded.ran_at;

  return jsonb_build_object('ok', true, 'state', 'go', 'why', v_need,
                            'n', v_n, 'basis', v_sig, 'rows', v_rows);
end;
$fn$;

revoke all on function public.pv_review_summary_take(jsonb) from public, anon, authenticated;

comment on function public.pv_review_summary_take(jsonb) is
  '口コミの要約を作り直す番を取り、材料（読める口コミの本文）と集合の指紋を返す。作り直しが要らないときは語だけ返す。'
  '口コミの id・書いた人・職位・機種は返さない。service_role だけ。';


-- 6-e. 自動の道で預ける／消す。
-- 引数: p = {airline, lang, basis, n, good:[{text, cat, k}], concern:[{text, cat, k}]}
--   basis … take が返した指紋をそのまま。
--   ★ good と concern が両方とも空なら消す（3件に満たない／点が1つも残らなかった）。
--   ★ newest は受け取らない。いまの集合のいちばん新しい時刻を**サーバが引く**
--     （basis が合った ＝ 材料はいまの全部、なので引き直せる。時刻の字の丸めで
--       件数がずれる罠 ── 11 の検査の stale_input ── を、自動の道は踏めない）。
-- 返り値:
--   5-a と同じ（{ok:true, state:'saved'|'deleted', …} / {ok:false, error:…}）に加えて
--   {ok:false, error:'bad_basis'}    basis が指紋の形でない
--   {ok:false, error:'stale_input'}  ★basis がいまの集合と違う ＝ 材料を渡したあとで
--                                     口コミが増えた・消えた。**壊れてはいない**
--                                     （新しい集合の番があとから来る／いま走っている）。
--   {ok:false, error:'bad_n'}        n がサーバの数えた件数と違う（作る側の数え間違い）
create or replace function public.pv_review_summary_set_auto(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_air    text := lower(btrim(coalesce(p ->> 'airline', '')));
  v_lang   text := coalesce(p ->> 'lang', '');
  v_basis  text := coalesce(p ->> 'basis', '');
  v_good   jsonb := p -> 'good';
  v_con    jsonb := p -> 'concern';
  v_codes  text[];
  v_n      integer;
  v_sig    text;
  v_newest timestamptz;
  v_empty  boolean;
  v_res    jsonb;
begin
  if not exists (select 1 from public.pv_airlines a
                  where a.code = v_air and a.code <> 'other') then
    return jsonb_build_object('ok', false, 'error', 'bad_airline');
  end if;
  if v_lang not in ('ja', 'en') then
    return jsonb_build_object('ok', false, 'error', 'bad_lang');
  end if;
  if v_basis !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_basis');
  end if;

  perform pg_advisory_xact_lock(hashtext('pv_review_summary'), hashtext(v_air || ':' || v_lang));

  v_codes := public.pv_review_summary_codes(v_air);
  select public.pv_review_summary_count(v_codes, null),
         public.pv_review_summary_sig(v_codes, null),
         (select max(r.created_at)
            from public.reviews_v2 r
           where r.id::text in (select public.pv_review_summary_ids(v_codes, null)))
    into v_n, v_sig, v_newest;

  /* ★古い集合から作った要約は預からない（守っていること d）。
       自分の番だけを返す ── あとから来た人が新しい集合の番を取っていたら、それには触らない。 */
  if v_sig is distinct from v_basis then
    delete from public.pv_review_summary_runs r
     where r.airline = v_air and r.lang = v_lang
       and r.sig = v_basis and r.state = 'running';
    return jsonb_build_object('ok', false, 'error', 'stale_input');
  end if;

  v_empty := jsonb_typeof(v_good) = 'array' and jsonb_typeof(v_con) = 'array'
             and jsonb_array_length(v_good) = 0 and jsonb_array_length(v_con) = 0;

  if v_empty then
    v_res := public.pv_review_summary_put(
               jsonb_build_object('airline', v_air, 'lang', v_lang,
                                  'good', '[]'::jsonb, 'concern', '[]'::jsonb));
  elsif jsonb_typeof(p -> 'n') is distinct from 'number'
        or (p ->> 'n') !~ '^[0-9]{1,6}$'
        or (p ->> 'n')::integer <> v_n then
    v_res := jsonb_build_object('ok', false, 'error', 'bad_n');
  else
    /* ★検査して入れるのは 5-a の1本。ここには検査を書かない。 */
    v_res := public.pv_review_summary_put(
               (p - 'basis') || jsonb_build_object('airline', v_air, 'newest', v_newest));
  end if;

  if coalesce((v_res ->> 'ok')::boolean, false) then
    if v_n < 3 then
      /* 3件を切って消した ── 覚えておくことが無い。 */
      delete from public.pv_review_summary_runs r
       where r.airline = v_air and r.lang = v_lang;
    else
      /* 預けた（saved）／点が1つも残らなかった（empty）。この集合はこれで済み。 */
      insert into public.pv_review_summary_runs as r
             (airline, lang, sig, n, state, tries, ran_at)
      values (v_air, v_lang, v_sig, v_n,
              case when v_res ->> 'state' = 'saved' then 'saved' else 'empty' end, 1, now())
      on conflict (airline, lang) do update
         set sig = excluded.sig, n = excluded.n, state = excluded.state, ran_at = excluded.ran_at;
    end if;
  else
    /* サーバの検査で断られた ── 1回の失敗として数える。
       触るのは自分の番（同じ集合で running）だけ。済んだ集合の控えを失敗に戻さない。 */
    update public.pv_review_summary_runs r
       set state = 'failed', ran_at = now()
     where r.airline = v_air and r.lang = v_lang
       and r.sig = v_basis and r.state = 'running';
  end if;

  return v_res;
end;
$fn$;

revoke all on function public.pv_review_summary_set_auto(jsonb) from public, anon, authenticated;

comment on function public.pv_review_summary_set_auto(jsonb) is
  '自動の道で口コミの要約を預ける／消す。材料を渡したときの指紋（basis）がいまの集合と違えば stale_input で断る'
  '＝古い集合の要約で上書きしない。検査は pv_review_summary_put の1本。service_role だけ。';


-- 6-f. 預けられずに終わったとき、番を返す。
-- 引数: p = {airline, lang, basis, state:'failed'|'released'}
--   failed   … モデルの呼び出しが落ちた・返事が使えなかった。1回と数え、30分待たせる。
--   released … 呼ぶ前にやめた・こちらの鍵の問題で断られた。回数に数えず、番を消す。
-- 返り値: {ok:true, state, hit:<自分の番が在ったか>} / {ok:false, error:'bad_lang'|'bad_basis'|'bad_state'}
-- ★ 触るのは「同じ basis で running の番」だけ。ほかの人の番には触らない。
create or replace function public.pv_review_summary_done(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_air   text := lower(btrim(coalesce(p ->> 'airline', '')));
  v_lang  text := coalesce(p ->> 'lang', '');
  v_basis text := coalesce(p ->> 'basis', '');
  v_state text := coalesce(p ->> 'state', '');
  v_hit   boolean;
begin
  if v_lang not in ('ja', 'en') then
    return jsonb_build_object('ok', false, 'error', 'bad_lang');
  end if;
  if v_basis !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_basis');
  end if;

  if v_state = 'released' then
    delete from public.pv_review_summary_runs r
     where r.airline = v_air and r.lang = v_lang
       and r.sig = v_basis and r.state = 'running';
    v_hit := found;
  elsif v_state = 'failed' then
    update public.pv_review_summary_runs r
       set state = 'failed', ran_at = now()
     where r.airline = v_air and r.lang = v_lang
       and r.sig = v_basis and r.state = 'running';
    v_hit := found;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_state');
  end if;

  return jsonb_build_object('ok', true, 'state', v_state, 'hit', v_hit);
end;
$fn$;

revoke all on function public.pv_review_summary_done(jsonb) from public, anon, authenticated;

comment on function public.pv_review_summary_done(jsonb) is
  '口コミの要約を預けられずに終わったとき、自分の番を返す（failed は1回と数える・released は数えない）。service_role だけ。';


-- 6-g. 配る（service_role にだけ）。
-- ⚠️ 役が在るときだけ出す。素の grant にすると、service_role の無い DB
--    （手元の検査用）でこのファイルごと止まる。Supabase には必ず在る。
do $grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.pv_review_summary_due(jsonb)      to service_role;
    grant execute on function public.pv_review_summary_take(jsonb)     to service_role;
    grant execute on function public.pv_review_summary_set_auto(jsonb) to service_role;
    grant execute on function public.pv_review_summary_done(jsonb)     to service_role;
  end if;
end
$grant$;


-- ════════════════════════════════════════════════════════════════
-- 検算（貼ったあと、6行とも ✅ になっていること）
--   ⚠️ 6行目は service_role という役が在る DB でだけ ✅ になる（Supabase には必ず在る）。
-- ════════════════════════════════════════════════════════════════
select '表は anon / authenticated から直に読めない' as 確認,
       case when not has_table_privilege('anon', 'public.pv_review_summaries', 'select')
             and not has_table_privilege('authenticated', 'public.pv_review_summaries', 'select')
             and not has_table_privilege('anon', 'public.pv_review_summary_runs', 'select')
             and not has_table_privilege('authenticated', 'public.pv_review_summary_runs', 'select')
             and (select bool_and(c.relrowsecurity) from pg_class c
                   where c.oid in ('public.pv_review_summaries'::regclass,
                                   'public.pv_review_summary_runs'::regclass))
             and not exists (select 1 from pg_policies q
                              where q.schemaname = 'public'
                                and q.tablename in ('pv_review_summaries', 'pv_review_summary_runs'))
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
             and not has_function_privilege('authenticated', 'public.pv_review_summary_put(jsonb)', 'execute')
             and not has_function_privilege('authenticated', 'public.pv_review_summary_need(text, text)', 'execute')
            then '✅' else '❌' end
union all
select '自動で預ける道は anon / authenticated から呼べない',
       case when not exists (
              select 1
                from (values ('anon'), ('authenticated')) w(who)
               cross join (values ('public.pv_review_summary_due(jsonb)'),
                                  ('public.pv_review_summary_take(jsonb)'),
                                  ('public.pv_review_summary_set_auto(jsonb)'),
                                  ('public.pv_review_summary_done(jsonb)')) f(sig)
               where has_function_privilege(w.who, f.sig, 'execute'))
            then '✅' else '❌' end
union all
select '自動で預ける道は service_role から呼べる',
       case when coalesce((
              select bool_and(has_function_privilege(r.oid, f.sig, 'execute'))
                from pg_roles r
               cross join (values ('public.pv_review_summary_due(jsonb)'),
                                  ('public.pv_review_summary_take(jsonb)'),
                                  ('public.pv_review_summary_set_auto(jsonb)'),
                                  ('public.pv_review_summary_done(jsonb)')) f(sig)
               where r.rolname = 'service_role'), false)
            then '✅' else '❌' end;
