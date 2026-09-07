-- ════════════════════════════════════════════════════════════════
-- db/reviews-gate.sql — 口コミの本文をサーバー側で止める（2026-09-07）
--
-- ★これを貼るまで、口コミの本文は**ログインしていない人でも全部読める**。
--   画面のぼかし（community.html の .rv-locked-tail）は見た目だけで、
--   DevTools で外せば読めるし、REST を直に叩けば最初から素で返ってくる。
--   REAL PAY は既にサーバー側で止めている（db/pay-rows.sql の pv_pay_rows）。
--   口コミも同じ形にする ── **鍵を持たない人には本文を1文字も返さない。**
--
-- ⚠️ reviews_v2 の定義（列・RLS・GRANT）はこのリポジトリに無く、本番の
--    Supabase の中にしか存在しない。だからこのファイルは
--    **列名を決め打ちで並べない**。information_schema から引いて、
--    「隠す8列以外の全部」に読み取りを与え直す。
--    → 将来 reviews_v2 に列が増えたら、このファイルをもう一度流す。
--      流すまでその列は誰にも読めない（＝閉じる側に倒れる。開きっぱなしにしない）。
--
-- 鍵の定義（サーバー側の唯一の正）
--   「口コミを1件でも出したことがある」＝ reviews_v2 に自分の proof_hash の行がある。
--   proof_hash = SHA-256(user_id || '::pv_anon::' || 航空会社コード || '::2026')
--   口コミの表は user_id を持たない（匿名）ので、pv_airlines を総当たりして
--   自分のハッシュを作り直して突き合わせる。
--   ＝ db/airline-conditions.sql の my_airline_conditions と同じ手。
--   ★運営（pv_admins）は出していなくても読める（db/pay-rows.sql の pv_is_operator と同じ扱い）。
--
-- ⚠️ 端末の localStorage（pv_unlock_expiry）は**鍵ではない。写しにすぎない。**
--    ここから先、誰が読めるかを決めるのはこのファイルの pv_has_review_key だけ。
--
-- ★トップページの抜粋（Pilot Voices）だけは開けたままにする（オーナー決定・2026-09-06）。
--   ただし「表を直に読ませる」のはやめ、pv_review_voices を通す。
--   返るのは **新しい6件・1欄あたり80字まで**（画面に出るのは今までどおり4枚）。
--   今までは30件ぶんの**全文**が
--   誰にでも返っていたので、穴は今より小さくなる。
--
-- 流す順番 … db/airlines.generated.sql → db/pay-rows.sql → **このファイル**
-- 何度流しても同じ結果になる（create or replace ＋ 権限の入れ直し）。
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ── 0. 前提 ─────────────────────────────────────────────────
do $guard$
begin
  if to_regclass('public.reviews_v2') is null then
    raise exception '口コミの表（public.reviews_v2）がありません';
  end if;
  if to_regclass('public.pv_airlines') is null then
    raise exception '先に db/airlines.generated.sql を実行してください';
  end if;
  if to_regproc('public.pv_is_operator') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pv_is_operator が無い）';
  end if;
end
$guard$;


-- ════════════════════════════════════════════════════════════════
-- 1. pv_review_hash — 口コミの proof_hash を作り直す
--
-- 式は submit-review.html:1227 / pv-reunlock.js:140 と**同じ文字列**でなければ
-- ならない。どちらかを変えたらここも変える（変えると過去の投稿と一致しなくなり、
-- 出したことがある人が締め出される）。
-- ★誰にも grant しない。security definer の中からだけ呼ぶ。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_review_hash(v_uid uuid, v_code text)
returns text
language sql
immutable
set search_path = public, extensions
as $fn$
  select encode(extensions.digest(
    v_uid::text || '::pv_anon::' || v_code || '::2026', 'sha256'), 'hex')
$fn$;

revoke all on function public.pv_review_hash(uuid, text) from public, anon, authenticated;

comment on function public.pv_review_hash(uuid, text) is
  '口コミの proof_hash。式は submit-review.html と pv-reunlock.js と同一。誰にも grant しない。';


-- ════════════════════════════════════════════════════════════════
-- 2. pv_review_codes — 投稿しうる航空会社コードの全部
--
-- 現行のマスタ（pv_airlines）＋ **廃止済みの旧コード**。
-- 旧コードは pv-reunlock.js の LEGACY_CODES と1語ずつ揃える。
-- 落とすと、その社に出した人の鍵が消える（出したのに読めなくなる）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_review_codes()
returns setof text
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  select code from public.pv_airlines
  union
  select unnest(array['spring', 'qatar', 'singapore', 'cathay',
                      'alaska', 'british', 'turkish', 'asiana'])
$fn$;

revoke all on function public.pv_review_codes() from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 3. pv_has_review_key — 呼んだ本人が口コミの鍵を持っているか
--
-- 返るのは真偽1つだけ。誰が何を出したかは1バイトも出ない。
-- ★判定はここ（サーバ）だけ。画面のぼかしを鍵の代わりにしない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_has_review_key()
returns boolean
language plpgsql
security definer
stable
set search_path = public, extensions
as $fn$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  if public.pv_is_operator() then return true; end if;
  return exists (
    select 1
      from public.reviews_v2 r
     where r.proof_hash in (select public.pv_review_hash(v_uid, c)
                              from public.pv_review_codes() c));
end
$fn$;

revoke all on function public.pv_has_review_key() from public, anon;
grant execute on function public.pv_has_review_key() to authenticated;

comment on function public.pv_has_review_key() is
  '口コミを1件でも出したことがあるか（＝本文を読める鍵を持つか）。運営は常に true。';


-- ════════════════════════════════════════════════════════════════
-- 4. pv_reviews — 口コミの一覧（本文は鍵を持つ人にだけ）
--
-- 引数 p（全部省略可）
--   airline  … 1社に絞る            例 {"airline":"ana"}
--   airlines … 複数社に絞る（配列）  例 {"airlines":["ana","ana-wings"]}
--   mine     … 自分が出したものだけ  例 {"mine":true}（要ログイン）
--   limit    … 最大件数（既定 200・上限 500）
--
-- 返り値 { ok, unlocked, rows }
--   rows は reviews_v2 の1行をそのまま jsonb にしたもの。ただし
--     ・proof_hash は**常に落とす**（今まで select('*') で外に出ていた）
--     ・鍵が無いときは 7つの *_comment と translations も落とす
--       → **ぼかさない。列そのものが返らない。**
--     ・cats（本文がある欄の名前だけ）は鍵の有無にかかわらず返す
--       ＝ REAL PAY が「帯と項目名は出す」のと同じ考え方。
--         これが無いと、未解放の人の画面でカテゴリ別の件数が全部 0 になる。
--
-- ⚠️ to_jsonb(行) から要らない鍵を引く形にしてあるのは、reviews_v2 の列が
--    このリポジトリから見えないため。列名を並べると、本番に在る列を1つ
--    書き落とした瞬間に画面から黙って消える。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_reviews(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid    := auth.uid();
  v_open  boolean := public.pv_has_review_key();
  v_air   text    := nullif(btrim(p->>'airline'), '');
  v_airs  text[]  := null;
  v_mine  boolean := coalesce((p->>'mine')::boolean, false);
  v_limit int     := least(greatest(coalesce((p->>'limit')::int, 200), 1), 500);
  v_hide  text[]  := array['culture_comment', 'salary_comment', 'benefits_comment',
                           'wlb_comment', 'ops_comment', 'training_comment',
                           'mgmt_comment', 'translations'];
  v_rows  jsonb;
begin
  if jsonb_typeof(p->'airlines') = 'array' then
    select array_agg(x) into v_airs from jsonb_array_elements_text(p->'airlines') x;
    if v_airs is not null and cardinality(v_airs) = 0 then v_airs := null; end if;
  end if;

  if v_mine and v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  with mine as (
    select public.pv_review_hash(v_uid, c) as h
      from public.pv_review_codes() c
     where v_mine and v_uid is not null
  ), pick as (
    select r.*
      from public.reviews_v2 r
     where (v_air  is null or r.airline = v_air)
       and (v_airs is null or r.airline = any (v_airs))
       and (not v_mine or r.proof_hash in (select h from mine))
     order by r.created_at desc nulls last
     limit v_limit
  )
  select coalesce(jsonb_agg(z.j order by z.ord), '[]'::jsonb)
    into v_rows
    from (
      select row_number() over (order by pick.created_at desc nulls last) as ord,
             (case when v_open then to_jsonb(pick) - 'proof_hash'
                   else to_jsonb(pick) - 'proof_hash' - v_hide end)
             || jsonb_build_object('cats', to_jsonb(array_remove(array[
                  case when btrim(coalesce(pick.culture_comment,  '')) <> '' then 'culture'  end,
                  case when btrim(coalesce(pick.salary_comment,   '')) <> '' then 'salary'   end,
                  case when btrim(coalesce(pick.benefits_comment, '')) <> '' then 'benefits' end,
                  case when btrim(coalesce(pick.wlb_comment,      '')) <> '' then 'wlb'      end,
                  case when btrim(coalesce(pick.ops_comment,      '')) <> '' then 'ops'      end,
                  case when btrim(coalesce(pick.training_comment, '')) <> '' then 'training' end,
                  case when btrim(coalesce(pick.mgmt_comment,     '')) <> '' then 'mgmt'     end
                ], null))) as j
        from pick
    ) z;

  return jsonb_build_object('ok', true, 'unlocked', v_open, 'rows', v_rows);
end
$fn$;

revoke all on function public.pv_reviews(jsonb) from public;
grant execute on function public.pv_reviews(jsonb) to anon, authenticated;

comment on function public.pv_reviews(jsonb) is
  '口コミの一覧。本文（7つの *_comment と translations）は鍵を持つ人にだけ返す。'
  'proof_hash は誰にも返さない。';


-- ════════════════════════════════════════════════════════════════
-- 5. pv_review_clip — 本文を n 字で切る（トップページの抜粋用）
--
-- 切り方は lp.js の clip() と同じにする ── 空白を1つに均し、
-- n を超えたら n-1 字＋「…」。ここを変えるとトップの見え方が変わる。
-- ★誰にも grant しない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_review_clip(t text, n int)
returns text
language sql
immutable
set search_path = public, extensions
as $fn$
  select case
    when t is null then null
    when length(s.v) > n then left(s.v, n - 1) || '…'
    else s.v
  end
  from (select btrim(regexp_replace(
                 regexp_replace(t, '\\[nrt]', ' ', 'g'),  -- 文字としての \n \r \t
                 '\s+', ' ', 'g')) as v) s
$fn$;

revoke all on function public.pv_review_clip(text, int) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 6. pv_review_voices — トップページの抜粋（ここだけ鍵なしで開けておく）
--
-- オーナー決定（2026-09-06）「トップページの抜粋だけは今のまま開けておく」。
-- 返るのは **新しい6件・1欄あたり80字まで**。
--   ・足切りは lp.js と同じ ── あちらが1枚に出すのは
--     「本文のある欄のうち KEYS 順の最初の1つ」だけで、それが20字（空白を除く）に
--     満たなければカードにしない。ここも同じ順の最初の1欄で測る。
--     ⚠️ 順番（culture → salary → benefits → wlb → ops → training → mgmt）は
--        review-i18n.js の KEYS と同じ。あちらを並べ替えたらここも直す。
--     ⚠️ 4ではなく6返すのは、英語面では訳文が出るため（訳して20字を割ることがある）。
--        lp.js は 4枚で打ち切るので、**画面に出るのは今までどおり4枚**。
--   ・訳文（translations）も同じ80字で切る。切らないと英語の行から全文が漏れる。
--   ・proof_hash は返さない。
--
-- ⚠️ これは意図して開けてある唯一の穴。広げない（件数も字数もここの数字だけ）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_review_voices()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  with pick as (
    select r.*
      from public.reviews_v2 r
     where length(regexp_replace(coalesce(
             nullif(btrim(r.culture_comment),  ''),
             nullif(btrim(r.salary_comment),   ''),
             nullif(btrim(r.benefits_comment), ''),
             nullif(btrim(r.wlb_comment),      ''),
             nullif(btrim(r.ops_comment),      ''),
             nullif(btrim(r.training_comment), ''),
             nullif(btrim(r.mgmt_comment),     ''), ''), '\s', '', 'g')) >= 20
     order by r.created_at desc nulls last
     limit 6
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id',               pick.id,
           'airline',          pick.airline,
           'position',         pick.position,
           'tenure_bucket',    pick.tenure_bucket,
           'created_at',       pick.created_at,
           'culture_score',    pick.culture_score,
           'salary_score',     pick.salary_score,
           'benefits_score',   pick.benefits_score,
           'wlb_score',        pick.wlb_score,
           'ops_score',        pick.ops_score,
           'training_score',   pick.training_score,
           'orig_lang',        pick.orig_lang,
           'culture_comment',  public.pv_review_clip(pick.culture_comment,  80),
           'salary_comment',   public.pv_review_clip(pick.salary_comment,   80),
           'benefits_comment', public.pv_review_clip(pick.benefits_comment, 80),
           'wlb_comment',      public.pv_review_clip(pick.wlb_comment,      80),
           'ops_comment',      public.pv_review_clip(pick.ops_comment,      80),
           'training_comment', public.pv_review_clip(pick.training_comment, 80),
           'mgmt_comment',     public.pv_review_clip(pick.mgmt_comment,     80),
           'translations',
             case when jsonb_typeof(pick.translations) = 'object' then (
               select jsonb_object_agg(l.key, (
                        select jsonb_object_agg(c.key,
                                 to_jsonb(public.pv_review_clip(c.value #>> '{}', 80)))
                          from jsonb_each(l.value) c
                         where jsonb_typeof(l.value) = 'object'))
                 from jsonb_each(pick.translations) l)
             end
         )) order by pick.created_at desc nulls last), '[]'::jsonb)
    from pick
$fn$;

revoke all on function public.pv_review_voices() from public;
grant execute on function public.pv_review_voices() to anon, authenticated;

comment on function public.pv_review_voices() is
  'トップページの抜粋だけ。新しい4件・1欄80字まで。意図して開けてある唯一の穴。';


-- ════════════════════════════════════════════════════════════════
-- 7. ★本題 ── 表から本文を直接読めなくする
--
-- ⚠️ 列だけを revoke しても効かない。PostgreSQL は「表ぜんぶの SELECT」と
--    「列ごとの SELECT」を別の権限として持っていて、表ぜんぶを持っている
--    ロールから列を1つ revoke しても **警告が出るだけで何も起きない**。
--    → 表ぜんぶを取り上げ、隠す8列**以外**を列ごとに与え直す。
--
-- 隠す8列 … 7つの *_comment と translations（訳文。これも本文そのもの）
-- 残す列 … 上記以外の全部（proof_hash を含む）
--    ★proof_hash を残すのは、投稿の重複チェック（submit-review.html）と
--      airlines/premium-auth-lock.js が **絞り込み条件に使う**ため。
--      絞り込みにも列の読み取り権限が要る。値そのものは pv_reviews が返さない。
--
-- insert は触らない（口コミの投稿は今までどおり通る）。
-- ════════════════════════════════════════════════════════════════
do $gate$
declare
  v_hide text[] := array['culture_comment', 'salary_comment', 'benefits_comment',
                         'wlb_comment', 'ops_comment', 'training_comment',
                         'mgmt_comment', 'translations'];
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'reviews_v2'
     and not (column_name = any (v_hide));

  if v_cols is null then
    raise exception 'reviews_v2 の列が読めませんでした（権限を変更していません）';
  end if;

  execute 'revoke select on public.reviews_v2 from anon, authenticated';
  execute format('grant select (%s) on public.reviews_v2 to anon, authenticated', v_cols);
end
$gate$;


-- ════════════════════════════════════════════════════════════════
-- 8. 検算 ── 流したあと、この結果を見る（✅ が4行）
-- ════════════════════════════════════════════════════════════════
select '① 本文の列に残っている読み取り権限（anon）' as 項目,
       case when count(*) = 0 then '✅ なし（これが正しい）'
            else '❌ まだ読める: ' || string_agg(distinct column_name, ', ') end as 値
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'reviews_v2'
   and grantee = 'anon' and privilege_type = 'SELECT'
   and column_name in ('culture_comment','salary_comment','benefits_comment',
                       'wlb_comment','ops_comment','training_comment',
                       'mgmt_comment','translations')
union all
select '② 本文の列に残っている読み取り権限（authenticated）',
       case when count(*) = 0 then '✅ なし（これが正しい）'
            else '❌ まだ読める: ' || string_agg(distinct column_name, ', ') end
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'reviews_v2'
   and grantee = 'authenticated' and privilege_type = 'SELECT'
   and column_name in ('culture_comment','salary_comment','benefits_comment',
                       'wlb_comment','ops_comment','training_comment',
                       'mgmt_comment','translations')
union all
select '③ 表ぜんぶの読み取り（無いのが正しい）',
       case when count(*) = 0 then '✅ なし（列ごとに与え直してある）'
            else '❌ 表ごと読める（列の制限が効かない）' end
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'reviews_v2'
   and grantee in ('anon','authenticated') and privilege_type = 'SELECT'
union all
select '④ 本文以外は読める列の数',
       count(*)::text || ' 列'
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'reviews_v2'
   and grantee = 'anon' and privilege_type = 'SELECT';
