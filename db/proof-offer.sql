/* ════════════════════════════════════════════════════════════════
   db/proof-offer.sql — 自分から出す画像（何も止めない申請）（2026-10-16）

   実行: Supabase ダッシュボード → SQL Editor に貼って Run（冪等）
   ★貼る順 ── … → db/proof-store.sql（main を取り込んだあとは db/pay-rows.sql と db/pilot-proof.sql）
               → これ → db/stays.sql

   オーナー指示（2026-10-16）
     「会員が画像を出す入口…マイページに1か所で、いいよ。…ポップアップで…それを作って
       (この間アカウント停止の人に作ったやつでいいと思う)」
     「申請した画像…他の会員に見せないだろ？…運営はおれしかいないんだけど」
     ＝ 会員が自分から画像を出せる。出しても何も止まらない。見て決めるのはオーナーだけ。

   ★画像は**前からある置き場**（pv_proof_images・1人1枚・900KB まで・JPEG だけ・出し直しは上書き）。
     2つ目の置き場を作らない。大きさと形の最後の線は、置き場の制約そのもの（ここで数を写さない）。
   ★止める仕組みには何も足さない。main の止める決まりは「state が required か submitted」の1つで、
     新しい状態 'offered' はそこに入らない（REAL PAY・DEEP PAY・口コミ本文・印・板のどれも数えない）。
   ★main のものを変えるのは**1つだけ**：状態の制約に 'offered' を足す（1.）。
     引き金（画像を消す・置かせない）も関数も main のまま。申請の画像を置くときは、同じ取引の中で
     一度だけ 'submitted' を通り（main の網がそれを見ているため）、終わる前に 'offered' に戻す
     ＝ 外からは 'submitted' は1度も見えない。申請の行が在るあいだ画像を残すのは 1-b の引き金。
   ★ここの4本（2.）は誰にも配らない。呼ぶのは db/stays.sql 10-c の security definer の関数だけ
     （会員の入口・オーナーの一覧・画像・verified）。画像を読めるのも決められるのもオーナーだけ。
   ⚠️ 会員を名指しで書かない（公開リポジトリ）。
   ⚠️ 画像は氏名・免許番号・会社名が写りうる。通知メールに載せない・ログに出さない。
   ⚠️ main を取り込むときは 1. の2文を main の db/pay-rows.sql 1-e2 の制約へ移す（このファイルからは消す）。
      移さないと、db/pay-rows.sql を貼り直すたびに、申請が1件でもあると制約の所で丸ごと止まる。
════════════════════════════════════════════════════════════════ */

-- ── 0. 前提 ───────────────────────────────────────────────────
do $guard$
begin
  if to_regclass('public.pv_proof') is null or to_regclass('public.pv_proof_images') is null
     or not exists (select 1 from pg_trigger t where not t.tgisinternal and t.tgname = 'pv_proof_discard')
     or not exists (select 1 from pg_trigger t where not t.tgisinternal and t.tgname = 'pv_proof_image_guard') then
    raise exception '先に db/proof-store.sql を実行してください（画像の置き場が無い）';
  end if;
end
$guard$;


-- ── 1. 状態に 'offered' を足す（★main のものを変えるのはここだけ）────────
--   'offered' ＝ 会員が自分から画像を出した（申請）。何も止めない。
alter table public.pv_proof drop constraint if exists pv_proof_state_ck;
alter table public.pv_proof add constraint pv_proof_state_ck check (
  state in ('required', 'submitted', 'approved', 'offered'));


-- ── 1-b. 申請の行が在るあいだ、その画像を消させない ─────────────────
--   main の引き金 pv_proof_discard は「submitted でなくなったら画像を消す」。申請の行を 'offered' に
--   戻した瞬間にもそれが走るので、行が 'offered' のあいだだけ、その1枚を消す文を素通りさせる。
--   ★申請を終える（行を消す）・運営が確認を求める（'required' にする）・手で 'approved' にする、の
--     どれでも行はもう 'offered' ではない ＝ 画像は今までどおり消える。
--   ★「画像の無い申請」は作れない（置くときは画像と同じ取引・消せるのは行を終えたときだけ）。
create or replace function public.pv_proof_offer_keep_tg()
returns trigger
language plpgsql
as $fn$
begin
  if exists (select 1 from public.pv_proof b
              where b.user_id = old.user_id and b.state = 'offered') then
    return null;
  end if;
  return old;
end
$fn$;

drop trigger if exists pv_proof_offer_keep on public.pv_proof_images;
create trigger pv_proof_offer_keep
  before delete on public.pv_proof_images
  for each row execute function public.pv_proof_offer_keep_tg();

revoke all on function public.pv_proof_offer_keep_tg() from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════
-- 2. 申請の4本（★誰にも配らない・security definer にしない。
--    db/stays.sql 10-c の security definer の関数の中からだけ呼ぶ）
-- ══════════════════════════════════════════════════════════════

-- 2-a. 呼んだ本人の画像を出す（申請）。返すのは受け取れたかどうかだけ。
--   ★確かめ方は main の pv_proof_submit と同じ順・同じ数（空 → 長さ → base64 → 小さすぎ・JPEG の頭）。
--     900KB と JPEG の最後の線は置き場の制約（pv_proof_images_len_ck / _mime_ck）がそのまま決める。
--   ★画像が通らなければ、申請の行も作らない（行と画像は同じ取引）。
--   ★運営の確認の途中（required / submitted）・前の確認の控え（approved）の行には触らない。
create or replace function public.pv_proof_offer(p_image_b64 text)
returns jsonb
language plpgsql
volatile
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_row   public.pv_proof%rowtype;
  v_had   boolean;
  v_bytes bytea;
  v_con   text;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    return jsonb_build_object('ok', false, 'status', 'no_member');
  end if;

  select * into v_row from public.pv_proof b where b.user_id = v_uid for update;
  v_had := found;
  if v_had and v_row.state in ('required', 'submitted') then
    return jsonb_build_object('ok', false, 'status', 'in_check');
  end if;
  if v_had and v_row.state = 'approved' then
    return jsonb_build_object('ok', false, 'status', 'checked');
  end if;
  if v_had and v_row.tries >= 10 then
    return jsonb_build_object('ok', false, 'status', 'too_many');
  end if;

  if p_image_b64 is null or char_length(btrim(p_image_b64)) = 0 then
    return jsonb_build_object('ok', false, 'status', 'image_bad');
  end if;
  if char_length(p_image_b64) > 1250000 then
    return jsonb_build_object('ok', false, 'status', 'image_too_big');
  end if;
  begin
    v_bytes := decode(p_image_b64, 'base64');
  exception when others then
    return jsonb_build_object('ok', false, 'status', 'image_bad');
  end;
  if octet_length(v_bytes) < 100 then
    return jsonb_build_object('ok', false, 'status', 'image_bad');
  end if;

  begin
    -- ★先に一度だけ 'submitted' を通す（main の網 pv_proof_image_guard が見ている）
    if v_had then
      update public.pv_proof b
         set state = 'submitted', submitted_at = now(), tries = b.tries + 1
       where b.user_id = v_uid;
    else
      insert into public.pv_proof (user_id, state, required_at, submitted_at, tries)
      values (v_uid, 'submitted', now(), now(), 1);
    end if;

    insert into public.pv_proof_images (user_id, bytes, byte_len)
    values (v_uid, v_bytes, octet_length(v_bytes))
    on conflict (user_id) do update
       set bytes = excluded.bytes, byte_len = excluded.byte_len,
           mime = 'image/jpeg', created_at = now();

    -- ★取引が終わる前に 'offered' へ（画像は 1-b が残す）
    update public.pv_proof b set state = 'offered' where b.user_id = v_uid;
  exception when check_violation then
    get stacked diagnostics v_con = constraint_name;
    if v_con = 'pv_proof_images_len_ck' then
      return jsonb_build_object('ok', false, 'status', 'image_too_big');
    end if;
    if v_con = 'pv_proof_images_mime_ck' then
      return jsonb_build_object('ok', false, 'status', 'image_bad');
    end if;
    raise;
  end;

  if not exists (select 1 from public.pv_proof b
                   join public.pv_proof_images i on i.user_id = b.user_id
                  where b.user_id = v_uid and b.state = 'offered') then
    raise exception '申請の画像を置けませんでした（pv_proof_offer_keep が無い）';
  end if;
  return jsonb_build_object('ok', true, 'state', 'offered');
end
$fn$;

revoke all on function public.pv_proof_offer(text) from public, anon, authenticated;


-- 2-b. 申請の一覧（だれが・画像の大きさ・出した時刻だけ。名前もメールも画像も返さない）
create or replace function public.pv_proof_offers()
returns table (user_id uuid, has_image boolean, byte_len integer, submitted_at timestamptz)
language sql
stable
set search_path = public, extensions
as $fn$
  select b.user_id, i.user_id is not null, i.byte_len, b.submitted_at
    from public.pv_proof b
    left join public.pv_proof_images i on i.user_id = b.user_id
   where b.state = 'offered';
$fn$;

revoke all on function public.pv_proof_offers() from public, anon, authenticated;


-- 2-c. 申請の画像を1枚（申請の行のものだけ。運営の確認の画像は返さない）
--   返す形は main の admin_proof_image と同じ（{ok,mime,b64} か {ok:false,status:'none'}）。
create or replace function public.pv_proof_offer_image(p_user uuid)
returns jsonb
language plpgsql
stable
set search_path = public, extensions
as $fn$
declare v_img public.pv_proof_images%rowtype;
begin
  select i.* into v_img
    from public.pv_proof_images i
    join public.pv_proof b on b.user_id = i.user_id
   where i.user_id = p_user and b.state = 'offered';
  if not found then
    return jsonb_build_object('ok', false, 'status', 'none');
  end if;
  return jsonb_build_object('ok', true, 'mime', v_img.mime,
                            'b64', encode(v_img.bytes, 'base64'));
end
$fn$;

revoke all on function public.pv_proof_offer_image(uuid) from public, anon, authenticated;


-- 2-d. 申請を終える（行を消す ＝ 画像も同じ取引で消える：置き場の on delete cascade）。
--   返すのは消えた画像の枚数（申請が無ければ 0）。画像が残ったら取引ごと巻き戻す。
--   ★運営の確認の行（required / submitted / approved）には触らない。
create or replace function public.pv_proof_offer_close(p_user uuid)
returns integer
language plpgsql
volatile
set search_path = public, extensions
as $fn$
declare v_had integer;
begin
  select count(*) into v_had
    from public.pv_proof_images i
    join public.pv_proof b on b.user_id = i.user_id
   where i.user_id = p_user and b.state = 'offered';
  delete from public.pv_proof b where b.user_id = p_user and b.state = 'offered';
  if not found then
    return 0;
  end if;
  if exists (select 1 from public.pv_proof_images i where i.user_id = p_user) then
    raise exception '画像を破棄できませんでした';
  end if;
  return v_had;
end
$fn$;

revoke all on function public.pv_proof_offer_close(uuid) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════
-- 3. 検算（読むだけ）── 期待：6行すべて ✅
-- ══════════════════════════════════════════════════════════════
with fn as (
  select p.proname, p.oid,
         has_function_privilege('anon', p.oid, 'execute')          as anon_x,
         has_function_privilege('authenticated', p.oid, 'execute') as auth_x
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
)
select 1 as "#", '申請の行には必ず画像が1枚ある（画像の無い申請は無い）' as 項目,
       case when (select count(*) from public.pv_proof b
                   where b.state = 'offered'
                     and not exists (select 1 from public.pv_proof_images i where i.user_id = b.user_id)) = 0
            then '✅' else '❌ 画像の無い申請がある' end as 結果
union all
select 2, '画像が残っているのは、確認待ちか申請の行だけ',
       case when (select count(*) from public.pv_proof_images i
                   join public.pv_proof b on b.user_id = i.user_id
                  where b.state not in ('submitted', 'offered')) = 0
            then '✅' else '❌ 残っている' end
union all
select 3, '引き金が3つ（main の2つ ＋ 申請の画像を残す1つ）',
       case when (select count(*) from pg_trigger t
                   where not t.tgisinternal
                     and t.tgname in ('pv_proof_discard', 'pv_proof_image_guard', 'pv_proof_offer_keep')) = 3
            then '✅' else '❌' end
union all
select 4, '申請の4本は、会員からも未ログインからも呼べない',
       case when (select count(*) from fn
                   where proname in ('pv_proof_offer', 'pv_proof_offers', 'pv_proof_offer_image',
                                     'pv_proof_offer_close', 'pv_proof_offer_keep_tg')
                     and (anon_x or auth_x)) = 0
            then '✅' else '❌' end
union all
select 5, '2つの表に RLS が掛かっていて、ポリシーが1つも無い',
       case when (select bool_and(c.relrowsecurity) from pg_class c
                   where c.oid in ('public.pv_proof'::regclass, 'public.pv_proof_images'::regclass))
             and (select count(*) from pg_policies
                   where schemaname = 'public' and tablename in ('pv_proof', 'pv_proof_images')) = 0
            then '✅' else '❌' end
union all
select 6, '止める決まり（在れば pv_proof_blocked・pv_proof_held_keys・pv_proof_state）は offered を数えない',
       case when (select count(*) from fn
                   where proname in ('pv_proof_blocked', 'pv_proof_held_keys', 'pv_proof_state')
                     and pg_get_functiondef(oid) like '%offered%') = 0
            then '✅' else '❌ 止める決まりが申請を数えている' end
order by 1;
