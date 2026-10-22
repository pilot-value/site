/* ════════════════════════════════════════════════════════════════
   db/pilot-proof.sql — パイロットであることの確認（2026-10-13）

   実行: Supabase ダッシュボード → SQL Editor に貼って Run
   何度流しても同じ結果になるように書いてある（冪等）。
   ★貼る順 ── db/pay-rows.sql → db/deep-pay.sql → db/reviews-gate.sql → これ。
     （db/admin.sql は前から入っている。無ければ下の関所が止める）

   オーナー指示
     「パイロットではない会員のアカウントを止める。ログイン後の画面に、
       パイロットであることを示す画像（肩章・ウィングバッジ・事業用操縦士の
       免許証・勤務表など）を出すボタンを置く。出すまでサイトの詳細は見せない。
       出した画像は、運営が確認したら破棄する。」

   何がどこに在るか
     db/pay-rows.sql 1-e2 … 「誰に確認を求めているか」の表 pv_proof と、
                            3つの門が呼ぶ pv_proof_blocked、印の材料 pv_proof_held_keys
     このファイル        … 画像の表・会員の入口2つ・運営の入口5つ
     pv-session.js / pv-proof.js … 会員の画面に出す板
     admin.html          … 運営が押すボタン

   ここで守っている約束（どれも db/test-proof.mjs が見ている）
     ① 画像は**確認待ち（submitted）のあいだだけ**在る。承認しても出し直しを
        求めても、その場で消える。関数の中の1行ではなく**表の引き金**で守る
        ＝ SQL Editor から手で state を書き換えても画像は残らない。
     ② 画像を読めるのは運営だけ。出した本人にも返さない（返す入口が無い）。
     ③ 会員が自分で止めたり解いたりできない。表には誰の grant も無く、
        入口は全部「あなたは名簿に載っているか」を1行目で聞く。
     ④ 止まっていない会員は画像を出せない（置き場を埋められない）。

   ★Supabase Storage を使わない。理由は db/requests.sql の絵と同じ ──
     PGlite に storage が無く手元で1行も試せないうえ、「承認」と「破棄」が
     別々の通信になる（承認できたのに画像が残る、が起こりうる）。
     表に置けば、承認と破棄は同じ1つの取引になる。
   ⚠️ **会員を名指しで書かない**（公開リポジトリ）。このファイルにも
      検査にも、uid・氏名・メールを1つも書かない。
   ⚠️ 画像は氏名・免許番号・会社名が写りうる。通知メールに載せない・
      ログに出さない・この表を他の関数から読まない。
════════════════════════════════════════════════════════════════ */

-- ── 0. 前提 ───────────────────────────────────────────────────
do $guard$
begin
  if to_regclass('public.pv_proof') is null
     or to_regprocedure('public.pv_proof_blocked()') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pv_proof が無い）';
  end if;
  if to_regprocedure('public.pv_is_admin()') is null then
    raise exception '先に db/admin.sql を実行してください（pv_is_admin が無い）';
  end if;
end
$guard$;


-- ── 1. 画像（1人につき1枚）────────────────────────────────────
--   主キーが user_id そのもの＝2枚目を入れる道が無い。出し直しは上書き。
create table if not exists public.pv_proof_images (
  user_id    uuid primary key references public.pv_proof(user_id) on delete cascade,
  mime       text not null default 'image/jpeg',
  bytes      bytea not null,
  byte_len   integer not null,
  created_at timestamptz not null default now()
);

alter table public.pv_proof_images drop constraint if exists pv_proof_images_len_ck;
alter table public.pv_proof_images add constraint pv_proof_images_len_ck check (
  byte_len = octet_length(bytes) and byte_len > 0 and byte_len <= 900000);
alter table public.pv_proof_images drop constraint if exists pv_proof_images_mime_ck;
-- ★JPEG だけ。画面は必ず canvas で焼き直してから送る（撮影地などの
--   付帯情報が落ちる・SVG のような「絵の顔をした HTML」が原理的に入らない）
alter table public.pv_proof_images add constraint pv_proof_images_mime_ck check (
  mime = 'image/jpeg' and substring(bytes from 1 for 3) = '\xffd8ff'::bytea);

alter table public.pv_proof_images enable row level security;
revoke all on table public.pv_proof_images from public, anon, authenticated;

comment on table public.pv_proof_images is
  'パイロットであることの確認のために会員が出した画像（1人1枚・JPEG）。'
  '★確認待ち（pv_proof.state = submitted）のあいだだけ在る。それ以外になった瞬間に引き金が消す。'
  'RLS 有効・ポリシー無し・grant 無し。読めるのは admin_proof_image（運営）だけ。';


-- ── 2. 約束①の実体：確認待ちでなくなったら、画像を消す ─────────
--   ★関数（承認・出し直し）の中にも delete を書かない。ここ1か所で足りるうえ、
--     2か所に書くと「片方だけ直して残る」ができる。
--   ★SQL Editor から手で state を 'approved' に書き換えても、ここが消す。
create or replace function public.pv_proof_discard_tg()
returns trigger
language plpgsql
as $fn$
begin
  if new.state <> 'submitted' then
    delete from public.pv_proof_images i where i.user_id = new.user_id;
  end if;
  return new;
end
$fn$;

drop trigger if exists pv_proof_discard on public.pv_proof;
create trigger pv_proof_discard
  after insert or update on public.pv_proof
  for each row execute function public.pv_proof_discard_tg();

revoke all on function public.pv_proof_discard_tg() from public, anon, authenticated;

-- 逆向きの網。確認待ちでない会員に画像を入れさせない（順番を間違えた関数や、
-- 手で入れた1行が「承認済みなのに画像が在る」を作らないように）。
create or replace function public.pv_proof_image_guard_tg()
returns trigger
language plpgsql
as $fn$
begin
  if not exists (select 1 from public.pv_proof b
                  where b.user_id = new.user_id and b.state = 'submitted') then
    raise exception '確認待ちではない会員の画像は置けません' using errcode = '23514';
  end if;
  return new;
end
$fn$;

drop trigger if exists pv_proof_image_guard on public.pv_proof_images;
create trigger pv_proof_image_guard
  before insert or update on public.pv_proof_images
  for each row execute function public.pv_proof_image_guard_tg();

revoke all on function public.pv_proof_image_guard_tg() from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════
-- 3. 会員の入口（2つ）
-- ══════════════════════════════════════════════════════════════

-- 3-a. 自分が止まっているか。板を出すかどうかを決めるためだけに画面が呼ぶ。
--   返るのは state（none / required / submitted）と again（出し直しを求められたか）。
--   ★止まっていない人（一度も求められていない・承認済み）はどちらも 'none'。
--     「前に確認を求められたことがある」を画面へ渡さない。
create or replace function public.pv_proof_state()
returns jsonb
language sql
security definer
stable
set search_path = public, extensions
as $fn$
  select coalesce(
    (select jsonb_build_object(
              'state', b.state,
              'again', b.state = 'required' and b.rejected_at is not null)
       from public.pv_proof b
      where b.user_id = auth.uid()
        and b.state in ('required', 'submitted')),
    jsonb_build_object('state', 'none', 'again', false));
$fn$;

revoke all on function public.pv_proof_state() from public, anon;
grant execute on function public.pv_proof_state() to authenticated;

comment on function public.pv_proof_state() is
  '呼んだ本人が、パイロットであることの確認待ちで止まっているか（none / required / submitted）。'
  '他人については何も答えない。';


-- 3-b. 画像を出す。
--   ★止まっている会員だけが出せる（約束④）。確認待ちのあいだは出し直せる（上書き）。
--   ★返すのは受け取れたかどうかだけ。画像そのものは返さない（約束②）。
create or replace function public.pv_proof_submit(p_image_b64 text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_row   public.pv_proof%rowtype;
  v_bytes bytea;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select * into v_row from public.pv_proof b where b.user_id = v_uid for update;
  if not found or v_row.state not in ('required', 'submitted') then
    return jsonb_build_object('ok', false, 'status', 'not_required');
  end if;
  -- 置き場を埋める連投を止めるだけの上限。運営が求め直すと 0 に戻る
  if v_row.tries >= 10 then
    return jsonb_build_object('ok', false, 'status', 'too_many');
  end if;

  if p_image_b64 is null or char_length(btrim(p_image_b64)) = 0 then
    return jsonb_build_object('ok', false, 'status', 'image_bad');
  end if;
  -- 先に長さで弾く（base64 は元の約4/3）。大きいものを decode してから測らない
  if char_length(p_image_b64) > 1250000 then
    return jsonb_build_object('ok', false, 'status', 'image_too_big');
  end if;
  begin
    v_bytes := decode(p_image_b64, 'base64');
  exception when others then
    return jsonb_build_object('ok', false, 'status', 'image_bad');
  end;
  if octet_length(v_bytes) > 900000 then
    return jsonb_build_object('ok', false, 'status', 'image_too_big');
  end if;
  if octet_length(v_bytes) < 100
     or substring(v_bytes from 1 for 3) <> '\xffd8ff'::bytea then
    return jsonb_build_object('ok', false, 'status', 'image_bad');
  end if;

  -- ★先に「確認待ち」へ進めてから画像を置く（画像の側の網が state を見ている）
  update public.pv_proof b
     set state = 'submitted', submitted_at = now(), rejected_at = null,
         tries = b.tries + 1
   where b.user_id = v_uid;

  insert into public.pv_proof_images (user_id, bytes, byte_len)
  values (v_uid, v_bytes, octet_length(v_bytes))
  on conflict (user_id) do update
     set bytes = excluded.bytes, byte_len = excluded.byte_len,
         mime = 'image/jpeg', created_at = now();

  return jsonb_build_object('ok', true, 'state', 'submitted');
end
$fn$;

revoke all on function public.pv_proof_submit(text) from public, anon;
grant execute on function public.pv_proof_submit(text) to authenticated;

comment on function public.pv_proof_submit(text) is
  'パイロットであることを示す画像を出す（止まっている会員だけ・JPEG・900KB まで）。'
  '画像そのものは返さない。';


-- ══════════════════════════════════════════════════════════════
-- 4. 運営の入口（5つ。どれも1行目で必ず名簿を見る）
--    名前は db/admin.sql の admin_list_* にそろえてある。
-- ══════════════════════════════════════════════════════════════

-- 4-a. 確認を求めている会員の一覧。
--   ★氏名・メールはここから返さない。admin.html は admin_list_profiles の
--     結果と user_id で突き合わせて出す（会員の表を2か所から配らない）。
--   ★画像は返さない（在るかどうかと大きさだけ）。見るのは 4-c で1枚ずつ。
create or replace function public.admin_list_proofs()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare v jsonb;
begin
  if not public.pv_is_admin() then
    raise exception '管理者ではありません' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id',      b.user_id,
           'state',        b.state,
           'required_at',  b.required_at,
           'submitted_at', b.submitted_at,
           'rejected_at',  b.rejected_at,
           'decided_at',   b.decided_at,
           'has_image',    i.user_id is not null,
           'byte_len',     i.byte_len)
           order by (b.state = 'submitted') desc, (b.state = 'required') desc,
                    coalesce(b.submitted_at, b.required_at) desc), '[]'::jsonb)
    into v
    from public.pv_proof b
    left join public.pv_proof_images i on i.user_id = b.user_id
   -- ★会員が自分から出した申請（'offered'・db/proof-offer.sql）は運営の一覧に出さない（見るのはオーナーだけ・db/stays.sql 10-c）
   where b.state <> 'offered';
  return v;
end
$fn$;

revoke all on function public.admin_list_proofs() from public, anon;
grant execute on function public.admin_list_proofs() to authenticated;


-- 4-b. 確認を求める（＝その会員を止める）。
--   ★運営は止められない。自分を止めると、解く人が居なくなる。
--   ★もう止まっている会員には何もしない（出してある画像を消さない）。
--   ★承認済みの会員にもう一度求めることはできる（回数は 0 に戻る）。
create or replace function public.admin_proof_require(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare v_state text;
begin
  if not public.pv_is_admin() then
    raise exception '管理者ではありません' using errcode = '42501';
  end if;
  if p_user is null
     or not exists (select 1 from public.profiles p where p.id = p_user) then
    return jsonb_build_object('ok', false, 'status', 'no_member');
  end if;
  if exists (select 1 from public.pv_admins a where a.user_id = p_user) then
    return jsonb_build_object('ok', false, 'status', 'is_admin');
  end if;

  select b.state into v_state from public.pv_proof b
   where b.user_id = p_user for update;
  if v_state in ('required', 'submitted') then
    return jsonb_build_object('ok', true, 'state', v_state, 'changed', false);
  end if;

  insert into public.pv_proof (user_id, state, required_at)
  values (p_user, 'required', now())
  on conflict (user_id) do update
     set state = 'required', required_at = now(), submitted_at = null,
         rejected_at = null, decided_at = null, tries = 0;

  return jsonb_build_object('ok', true, 'state', 'required', 'changed', true);
end
$fn$;

revoke all on function public.admin_proof_require(uuid) from public, anon;
grant execute on function public.admin_proof_require(uuid) to authenticated;


-- 4-c. 出された画像を1枚見る。
create or replace function public.admin_proof_image(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare v_img public.pv_proof_images%rowtype;
begin
  if not public.pv_is_admin() then
    raise exception '管理者ではありません' using errcode = '42501';
  end if;
  -- ★確認待ちの画像だけ。申請の画像（'offered'）は「無い」と同じ答え（見るのはオーナーだけ・db/stays.sql 10-c）
  select i.* into v_img from public.pv_proof_images i
    join public.pv_proof b on b.user_id = i.user_id and b.state = 'submitted'
   where i.user_id = p_user;
  if not found then
    return jsonb_build_object('ok', false, 'status', 'none');
  end if;
  return jsonb_build_object('ok', true, 'mime', v_img.mime,
                            'b64', encode(v_img.bytes, 'base64'));
end
$fn$;

revoke all on function public.admin_proof_image(uuid) from public, anon;
grant execute on function public.admin_proof_image(uuid) to authenticated;


-- 4-d. 承認する（＝止めるのをやめる）。画像はこの取引の中で消える（2. の引き金）。
--   ★画像が無くても承認できる（止める相手を間違えたときに解く道）。
--   ★discarded は「この承認で消えた画像の枚数」。画面はこれを見て
--     「画像を破棄しました」と言う ── 消えていないのに言わない。
create or replace function public.admin_proof_approve(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_had  integer;
  v_left integer;
begin
  if not public.pv_is_admin() then
    raise exception '管理者ではありません' using errcode = '42501';
  end if;
  select count(*) into v_had from public.pv_proof_images i where i.user_id = p_user;

  update public.pv_proof b
     set state = 'approved', decided_at = now(), rejected_at = null
   where b.user_id = p_user and b.state in ('required', 'submitted');
  if not found then
    return jsonb_build_object('ok', false, 'status', 'none');
  end if;

  select count(*) into v_left from public.pv_proof_images i where i.user_id = p_user;
  if v_left > 0 then
    -- 引き金が外れている。承認だけ通して画像を残すことはしない（丸ごと巻き戻る）
    raise exception '画像を破棄できませんでした（pv_proof_discard が無い）';
  end if;
  return jsonb_build_object('ok', true, 'state', 'approved', 'discarded', v_had);
end
$fn$;

revoke all on function public.admin_proof_approve(uuid) from public, anon;
grant execute on function public.admin_proof_approve(uuid) to authenticated;


-- 4-e. 出し直しを求める（画像では確認できなかったとき）。
--   会員は止まったまま。出してあった画像は消え、板は「別の画像を」と言う。
--   運営が求め直したので提出回数も 0 に戻す（10回目の画像でも出し直せる）。
create or replace function public.admin_proof_reject(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_had  integer;
  v_left integer;
begin
  if not public.pv_is_admin() then
    raise exception '管理者ではありません' using errcode = '42501';
  end if;
  select count(*) into v_had from public.pv_proof_images i where i.user_id = p_user;

  update public.pv_proof b
     set state = 'required', rejected_at = now(), submitted_at = null,
         decided_at = now(), tries = 0
   where b.user_id = p_user and b.state = 'submitted';
  if not found then
    return jsonb_build_object('ok', false, 'status', 'none');
  end if;

  select count(*) into v_left from public.pv_proof_images i where i.user_id = p_user;
  if v_left > 0 then
    raise exception '画像を破棄できませんでした（pv_proof_discard が無い）';
  end if;
  return jsonb_build_object('ok', true, 'state', 'required', 'discarded', v_had);
end
$fn$;

revoke all on function public.admin_proof_reject(uuid) from public, anon;
grant execute on function public.admin_proof_reject(uuid) to authenticated;


-- ══════════════════════════════════════════════════════════════
-- 5. 検算（読むだけ。何も書き換えない）── 期待：8行すべて ✅
-- ══════════════════════════════════════════════════════════════
with fn as (
  select p.proname, p.oid,
         has_function_privilege('anon', p.oid, 'execute')          as anon_x,
         has_function_privilege('authenticated', p.oid, 'execute') as auth_x
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
)
select 1 as "#", '確認待ち以外の会員に画像が残っていない（約束①。会員が自分から出した申請 offered は db/proof-offer.sql の検算が見る）' as 項目,
       case when (select count(*) from public.pv_proof_images i
                   join public.pv_proof b on b.user_id = i.user_id
                  where b.state not in ('submitted', 'offered')) = 0
            then '✅' else '❌ 残っている' end as 結果
union all
select 2, '画像を消す引き金と、置かせない網が付いている',
       case when (select count(*) from pg_trigger t
                   where not t.tgisinternal
                     and t.tgname in ('pv_proof_discard', 'pv_proof_image_guard')) = 2
            then '✅' else '❌' end
union all
select 3, '2つの表に RLS が掛かっていて、ポリシーが1つも無い',
       case when (select bool_and(c.relrowsecurity) from pg_class c
                   where c.oid in ('public.pv_proof'::regclass,
                                   'public.pv_proof_images'::regclass))
             and (select count(*) from pg_policies
                   where schemaname = 'public'
                     and tablename in ('pv_proof', 'pv_proof_images')) = 0
            then '✅' else '❌' end
union all
select 4, '会員にも未ログインにも、2つの表の権限が1つも無い',
       case when (select count(*) from information_schema.role_table_grants g
                   where g.table_schema = 'public'
                     and g.table_name in ('pv_proof', 'pv_proof_images')
                     and g.grantee in ('anon', 'authenticated', 'PUBLIC')) = 0
            then '✅' else '❌' end
union all
select 5, '未ログインから呼べる入口が1つも無い',
       case when (select count(*) from fn
                   where (proname like 'pv\_proof%' or proname like 'admin\_proof%'
                          or proname = 'admin_list_proofs')
                     and anon_x) = 0
            then '✅' else '❌' end
union all
select 6, '門の関数と印の材料は、会員から直接呼べない',
       case when (select count(*) from fn
                   where proname in ('pv_proof_blocked', 'pv_proof_held_keys')
                     and (anon_x or auth_x)) = 0
            then '✅' else '❌' end
union all
select 7, '3つの門が pv_proof_blocked を呼んでいる（REAL PAY・DEEP PAY・口コミ本文）',
       case when (select count(*) from fn
                   where proname in ('pv_pay_rows', 'pv_deep_pay', 'pv_has_review_key')
                     and pg_get_functiondef(oid) like '%pv_proof_blocked()%') = 3
            then '✅'
            else '❌ 古いファイルが残っている（pay-rows → deep-pay → reviews-gate の順に貼る）' end
union all
select 8, '運営の入口が5つとも「名簿に載っているか」を聞いている',
       case when (select count(*) from fn
                   where proname in ('admin_list_proofs', 'admin_proof_require',
                                     'admin_proof_image', 'admin_proof_approve',
                                     'admin_proof_reject')
                     and pg_get_functiondef(oid) like '%if not public.pv_is_admin() then%') = 5
            then '✅' else '❌' end
order by 1;
