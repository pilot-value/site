-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/requests.sql
--
-- ROADMAP & REQUESTS 画面（roadmap.html）の「みんなからのリクエスト」。
-- 匿名の要望を1件＝1行で持ち、ほかのパイロットが ♡ で賛成する。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: db/admin.sql（pv_is_admin が要る）→ このファイル
--    → そのあと db/notify-admin-webhooks.sql を貼り直す。
--    ⚠️ webhooks を先に流すと、まだ表が無いので **黙って飛ばされる**。
--       エラーも出ないまま「7本目の通知だけ無い」状態になる。
-- 冪等（何度流しても安全）。
--
-- ── この設計が守っている約束 ────────────────────────────────
--  1. user_id を持たない。author_hash だけ（pay_reports の proof_hash、
--     airline_conditions の pv_condition_hash と同じ流儀。区切りは '::pv_req::'）。
--     ★ author_hash / liker_hash を画面へ返す関数を1つも作らない。
--       1度でも外へ出ると、それは安定した仮名 ID になり
--       「この人はこの12件を書いた」が組み立てられる。
--  2. 表は完全に閉じる。ポリシーを1つも作らない＝ anon も authenticated も
--     直接は1行も読めない・書けない。出入口は security definer の関数だけ。
--  3. 投稿すると本人の1票が **本当に** pv_request_likes に入る。
--     ♡ が 1 から始まるのは飾りではなく実データ。
--     第三者から見えるのは数字だけで、誰が押したかはどの関数も返さない。
--  4. 文字数・空投稿・連投の判定は全部ここでやる。
--     画面の maxlength は目安にすぎず、REST を直接叩けば素通りする。
--  5. status を変えられるのは pv_is_admin() だけ。
--     守っているのは grant ではなく関数の中の判定。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regprocedure('public.pv_is_admin()') is null then
    raise exception '先に db/admin.sql を実行してください（pv_is_admin が無い）';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. 表
-- ════════════════════════════════════════════════════════════════
create table if not exists public.pv_requests (
  id          uuid primary key default gen_random_uuid(),
  -- sha256(uid || '::pv_req::')。生の user_id は持たない
  author_hash text not null,
  body        text not null,
  category    text not null default 'other',
  status      text not null default 'new',
  -- 荒らし・誹謗中傷を伏せるためだけの札。見送りは status='declined' で表す
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.pv_request_likes (
  request_id uuid not null references public.pv_requests(id) on delete cascade,
  -- 投稿者と同じ式のハッシュ。誰が押したかはどの関数も返さない
  liker_hash text not null,
  created_at timestamptz not null default now(),
  -- ★ 「1人1票」の実体はここ。関数の中の判定ではなく主キーで担保する
  primary key (request_id, liker_hash)
);

-- check は毎回 drop してから付け直す（条件を変えて流し直したとき古い定義を残さない）
alter table public.pv_requests drop constraint if exists pv_requests_body_ck;
alter table public.pv_requests drop constraint if exists pv_requests_hash_ck;
alter table public.pv_requests drop constraint if exists pv_requests_cat_ck;
alter table public.pv_requests drop constraint if exists pv_requests_status_ck;

-- ★ btrim してから数える。空白500個で通り抜けられないように
alter table public.pv_requests add constraint pv_requests_body_ck check (
  char_length(btrim(body)) between 4 and 500);
alter table public.pv_requests add constraint pv_requests_hash_ck check (
  author_hash ~ '^[0-9a-f]{64}$');
alter table public.pv_requests add constraint pv_requests_cat_ck check (
  category in ('feature', 'data', 'ui', 'bug', 'other'));
alter table public.pv_requests add constraint pv_requests_status_ck check (
  status in ('new', 'considering', 'planned', 'building', 'done', 'declined'));

alter table public.pv_request_likes drop constraint if exists pv_request_likes_hash_ck;
alter table public.pv_request_likes add constraint pv_request_likes_hash_ck check (
  liker_hash ~ '^[0-9a-f]{64}$');

create index if not exists pv_requests_new_idx
  on public.pv_requests (created_at desc) where not is_hidden;
create index if not exists pv_requests_author_idx
  on public.pv_requests (author_hash, created_at desc);
create index if not exists pv_request_likes_req_idx
  on public.pv_request_likes (request_id);

comment on table public.pv_requests is
  'ROADMAP & REQUESTS の匿名リクエスト。user_id は持たず author_hash だけ。個票の直読みは不可。';
comment on column public.pv_requests.author_hash is
  '★ どの関数の返り値にも入れないこと。外へ出た瞬間に安定した仮名 ID になり、同じ人の投稿を束ねられる。';
comment on column public.pv_requests.is_hidden is
  '荒らしを伏せる札。「やらない」を表すのは status=''declined'' のほう。';
comment on table public.pv_request_likes is
  '♡。1人1票は主キー (request_id, liker_hash) で担保する。
   ★ 「誰が押したか」を返す関数を作らないこと。作った瞬間に、投稿時の自動1票から投稿者が割れる。';


-- ════════════════════════════════════════════════════════════════
-- 2. 権限：表は誰にも触らせない
-- ════════════════════════════════════════════════════════════════
-- SELECT / INSERT / UPDATE / DELETE いずれのポリシーも作らない。
-- ＝ anon も authenticated も直接は1行も読めない・書けない。
alter table public.pv_requests      enable row level security;
alter table public.pv_request_likes enable row level security;

revoke all on public.pv_requests      from anon, authenticated;
revoke all on public.pv_request_likes from anon, authenticated;

-- 既に作ってしまったポリシーがあれば落とす（冪等・事故防止）
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
            where schemaname = 'public'
              and tablename in ('pv_requests', 'pv_request_likes') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 3. ハッシュ（サーバの中でしか作らない）
-- ════════════════════════════════════════════════════════════════
-- ⚠️ 画面から呼べるようにしない。uuid は空間が広いとはいえ、
--    自分の uid を入れて答え合わせできる関数を配ると、
--    どこかで漏れた1つのハッシュから本人を確かめる道ができる。
create or replace function public.pv_request_hash(v_uid uuid)
returns text
language sql
immutable
set search_path = public, extensions
as $fn$
  select encode(extensions.digest(v_uid::text || '::pv_req::', 'sha256'), 'hex');
$fn$;

revoke all on function public.pv_request_hash(uuid) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 4. 出す（投稿）
-- ════════════════════════════════════════════════════════════════
-- 返り値は {ok:true, item:{…}}。弾いたときは例外ではなく
-- {ok:false, status:'rate_limited'|'too_fast'|'duplicate'} を返す
-- （db/referrals.sql と同じ作法。画面は理由ごとに違う一言を出す）。
create or replace function public.pv_request_submit(p_body text, p_category text default 'other')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid  uuid := auth.uid();
  v_hash text;
  v_body text;
  v_cat  text;
  v_n    int;
  v_row  public.pv_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  -- ★ trim が先。空白だけの投稿と、前後の空白ぶんだけ長い投稿を同時に潰す
  v_body := btrim(coalesce(p_body, ''));
  if char_length(v_body) < 4 then
    raise exception 'もう少し詳しく書いてください' using errcode = '22023';
  end if;
  if char_length(v_body) > 500 then
    raise exception '500文字までです' using errcode = '22023';
  end if;

  -- 区分は白リスト外なら 'other' に丸める。区分の綴り違いで本文を落とさない
  v_cat := case when p_category in ('feature', 'data', 'ui', 'bug', 'other')
                then p_category else 'other' end;

  v_hash := public.pv_request_hash(v_uid);

  -- 連投（60秒）
  if exists (select 1 from public.pv_requests
              where author_hash = v_hash and created_at > now() - interval '60 seconds') then
    return jsonb_build_object('ok', false, 'status', 'too_fast');
  end if;

  -- 1日の上限（db/referrals.sql:329 と同じ数え方）
  select count(*) into v_n from public.pv_requests
   where author_hash = v_hash and created_at > now() - interval '24 hours';
  if v_n >= 5 then
    return jsonb_build_object('ok', false, 'status', 'rate_limited');
  end if;

  -- 同じ内容の重ね出し
  if exists (select 1 from public.pv_requests
              where author_hash = v_hash
                and lower(btrim(body)) = lower(v_body)
                and created_at > now() - interval '24 hours') then
    return jsonb_build_object('ok', false, 'status', 'duplicate');
  end if;

  insert into public.pv_requests (author_hash, body, category)
  values (v_hash, v_body, v_cat)
  returning * into v_row;

  -- ★ 本人の1票を本当に入れる。like_count が 1 から始まるのは実データ。
  --   誰が押したかはどの関数も返さないので、これで投稿者は割れない。
  insert into public.pv_request_likes (request_id, liker_hash)
  values (v_row.id, v_hash);

  -- 一覧と同じ形で返す（画面が取り直さずに先頭へ挿せる）
  return jsonb_build_object('ok', true, 'item', jsonb_build_object(
    'id',          v_row.id,
    'body',        v_row.body,
    'category',    v_row.category,
    'status',      v_row.status,
    'created_at',  v_row.created_at,
    'like_count',  1,
    'liked_by_me', true));
end;
$fn$;

revoke all on function public.pv_request_submit(text, text) from public, anon;
grant execute on function public.pv_request_submit(text, text) to authenticated;

comment on function public.pv_request_submit(text, text) is
  '要望を1件出す。ログインした人だけ。本文4〜500字・60秒/5件24時間・同文の重複を弾く。投稿者の1票も同時に入れる。';


-- ════════════════════════════════════════════════════════════════
-- 5. 読む（一覧）
-- ════════════════════════════════════════════════════════════════
-- ★★ select r.* を絶対に書かない。author_hash が1回でも外へ出ると
--     以後それは安定した仮名 ID になる。列は必ず明示的に並べる。
create or replace function public.pv_requests_list(
  p_sort text default 'popular', p_limit int default 20, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_hash  text;
  v_admin boolean;
  v_lim   int;
  v_off   int;
  v_total int;
  v_items jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  v_hash  := public.pv_request_hash(v_uid);
  v_admin := public.pv_is_admin();
  -- 全件をブラウザへ投げない。上限は必ずサーバで抑える
  v_lim := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_off := greatest(coalesce(p_offset, 0), 0);

  select count(*) into v_total
    from public.pv_requests r
   where (not r.is_hidden) or v_admin;

  select coalesce(jsonb_agg(x order by x_ord), '[]'::jsonb) into v_items
    from (
      select jsonb_build_object(
               'id',          r.id,
               'body',        r.body,
               'category',    r.category,
               'status',      r.status,
               'created_at',  r.created_at,
               'like_count',  c.n,
               'liked_by_me', exists (select 1 from public.pv_request_likes l
                                       where l.request_id = r.id and l.liker_hash = v_hash),
               -- 隠した札は管理者にだけ返す（一般ユーザーの JSON には鍵ごと出ない）
               'is_hidden',   case when v_admin then r.is_hidden else null end)
               as x,
             row_number() over (
               order by case when p_sort = 'new' then 0 else c.n end desc,
                        r.created_at desc, r.id) as x_ord
        from public.pv_requests r
        cross join lateral (
               select count(*)::int as n from public.pv_request_likes l
                where l.request_id = r.id) c
       where (not r.is_hidden) or v_admin
       order by case when p_sort = 'new' then 0 else c.n end desc,
                r.created_at desc, r.id
       limit v_lim offset v_off
    ) s;

  return jsonb_build_object('ok', true, 'total', v_total,
                            'sort', case when p_sort = 'new' then 'new' else 'popular' end,
                            'limit', v_lim, 'offset', v_off,
                            'items', v_items);
end;
$fn$;

revoke all on function public.pv_requests_list(text, int, int) from public, anon;
grant execute on function public.pv_requests_list(text, int, int) to authenticated;

comment on function public.pv_requests_list(text, int, int) is
  '要望の一覧。ログインした人だけ。author_hash は返さない。隠した行は管理者にしか出ない。total は KPI にそのまま使う。';


-- ════════════════════════════════════════════════════════════════
-- 6. ♡（押す・外す）
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_request_like_toggle(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid    uuid := auth.uid();
  v_hash   text;
  v_hidden boolean;
  v_del    int;
  v_n      int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  v_hash := public.pv_request_hash(v_uid);

  select r.is_hidden into v_hidden from public.pv_requests r where r.id = p_id;
  if not found then
    raise exception 'その要望はありません' using errcode = '22023';
  end if;
  if v_hidden then
    raise exception 'その要望は表示されていません' using errcode = '42501';
  end if;

  delete from public.pv_request_likes
   where request_id = p_id and liker_hash = v_hash;
  get diagnostics v_del = row_count;

  if v_del = 0 then
    -- on conflict は連打（同じ人の2回目が同時に来る）を例外にしないため
    insert into public.pv_request_likes (request_id, liker_hash)
    values (p_id, v_hash)
    on conflict (request_id, liker_hash) do nothing;
  end if;

  -- ★ 画面に出る数は必ずここで数え直したもの。JS 側の足し算は見た目だけ
  select count(*)::int into v_n from public.pv_request_likes where request_id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id,
                            'like_count', v_n, 'liked_by_me', v_del = 0);
end;
$fn$;

revoke all on function public.pv_request_like_toggle(uuid) from public, anon;
grant execute on function public.pv_request_like_toggle(uuid) to authenticated;

comment on function public.pv_request_like_toggle(uuid) is
  '♡ を押す／外す。1人1票は主キーで担保。返す like_count は数え直した実数。';


-- ════════════════════════════════════════════════════════════════
-- 7. 管理者だけ（状態を変える・伏せる）
-- ════════════════════════════════════════════════════════════════
-- grant は authenticated に出すが、守っているのは中の pv_is_admin() の判定。
-- db/admin.sql の admin_list_profiles と同じ形にしてある。
create or replace function public.pv_request_set_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare v_n int;
begin
  if not public.pv_is_admin() then
    raise exception '管理者ではありません' using errcode = '42501';
  end if;
  if p_status not in ('new', 'considering', 'planned', 'building', 'done', 'declined') then
    raise exception '知らない状態です: %', p_status using errcode = '22023';
  end if;

  update public.pv_requests
     set status = p_status, updated_at = now()
   where id = p_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'その要望はありません' using errcode = '22023';
  end if;

  return jsonb_build_object('ok', true, 'id', p_id, 'status', p_status);
end;
$fn$;

revoke all on function public.pv_request_set_status(uuid, text) from public, anon;
grant execute on function public.pv_request_set_status(uuid, text) to authenticated;

comment on function public.pv_request_set_status(uuid, text) is
  '要望の状態を変える。管理者だけ（pv_is_admin）。一般ユーザーが呼ぶと 42501。';


create or replace function public.pv_request_set_hidden(p_id uuid, p_hidden boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare v_n int;
begin
  if not public.pv_is_admin() then
    raise exception '管理者ではありません' using errcode = '42501';
  end if;

  update public.pv_requests
     set is_hidden = coalesce(p_hidden, false), updated_at = now()
   where id = p_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'その要望はありません' using errcode = '22023';
  end if;

  return jsonb_build_object('ok', true, 'id', p_id, 'is_hidden', coalesce(p_hidden, false));
end;
$fn$;

revoke all on function public.pv_request_set_hidden(uuid, boolean) from public, anon;
grant execute on function public.pv_request_set_hidden(uuid, boolean) to authenticated;

comment on function public.pv_request_set_hidden(uuid, boolean) is
  '要望を伏せる／戻す。管理者だけ（pv_is_admin）。伏せた行は一覧にも total にも出ない。';
