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
--  6. 「見えるかどうか」の判定は pv_req_visible() ただ1つ。
--     ★ 一覧の total と本体で同じ where を2回書かない。片方だけ直すと
--       「7件と書いてあるのに6件しか並ばない」が静かに起きる。
--  7. 添付の絵は運営が見るまで他人に出ない（image_state='pending'）。
--     ★ 再エンコードで EXIF は落ちるが、画素に写った氏名・社員番号・会社名は落ちない。
--       機械で守れるのはそこまでなので、人が1回見る。この門を外さない。
--     ★ 絵は Supabase Storage に置かない。storage.objects が生の user_id と
--       request_id を並べて持ち、この機能の匿名性そのものを崩すため。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regprocedure('public.pv_is_admin()') is null then
    raise exception '先に db/admin.sql を実行してください（pv_is_admin が無い）';
  end if;
  -- 下の pv_give_growth（コミュニティの伸びの折れ線）が使う。
  -- ★これが無いまま貼ると、折れ線だけが黙って出ない画面になる。
  if to_regprocedure('public.pv_pay_person_map()') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pv_pay_person_map が無い）';
  end if;
  -- コメントを書ける条件（給与を1件でも出したか）をここで判定する。
  -- ★これが無いまま貼ると、コメント欄だけが誰にも書けない画面になる。
  if to_regprocedure('public.pv_my_give()') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pv_my_give が無い）';
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

-- 添付の絵（1件につき1枚）。
-- ★ Supabase Storage を使わない。storage.objects は owner に **生の user_id** を持ち、
--   パスに request_id が入る＝「この user がこの要望を書いた」の対応表が平文でできる。
--   この機能ぜんぶが author_hash しか持たない前提の上に乗っているので、そこは崩せない。
--   （加えて PGlite に storage スキーマが無く、手元で1行も試せない。）
-- ★ 誰が出したかはここにも書かない。親の pv_requests を辿らないと分からない。
create table if not exists public.pv_request_images (
  -- 1件1枚。主キーが request_id そのもの＝2枚目を入れる道が無い
  request_id uuid primary key references public.pv_requests(id) on delete cascade,
  mime       text not null default 'image/jpeg',
  bytes      bytea not null,
  byte_len   integer not null,
  -- 縦横は場所を先に取るためだけ（読み込みで行が飛び跳ねない）。画面から来た値
  w          integer,
  h          integer,
  created_at timestamptz not null default now()
);

-- 要望へのコメント（オーナー指示「他の人がコメントできるようにして」）。
-- ★ 書けるのは給与を1件でも出した人だけ（pv_my_give の basic）。運営はいつでも書ける。
-- ★ 名乗りは「投稿者」「運営」「匿名1」「匿名2」…。番号はこの表には持たない（下の表で配る）。
-- ★ コメントは物理削除しない。伏せるだけ（is_hidden）。
create table if not exists public.pv_request_comments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.pv_requests(id) on delete cascade,
  -- 要望と同じ式のハッシュ。★どの関数の返り値にも入れない
  author_hash text not null,
  body        text not null,
  -- ★書いた時点の pv_is_admin() を焼き付ける。名簿から外れた日に、
  --   過去の運営の返信が「匿名3」に化けないため
  is_staff    boolean not null default false,
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- スレッドごとの匿名の通し番号。★配るのはここ1か所だけ。
--   主キー (request_id, author_hash) ＝ 1人が持つ番号は1つ。
--   unique (request_id, anon_no)     ＝ 1つの番号を持つ人は1人。
-- ★ 一度配った番号を書き換える口も、返す口も作らない。だから、コメントを
--   伏せても消しても「匿名2さんの言うとおり」が別人への返事に化けない。
--   （読むときに dense_rank で数え直す形にすると、1行欠けた日に全員ずれる。）
create table if not exists public.pv_request_anons (
  request_id  uuid not null references public.pv_requests(id) on delete cascade,
  author_hash text not null,
  anon_no     integer not null,
  created_at  timestamptz not null default now(),
  primary key (request_id, author_hash),
  unique (request_id, anon_no)
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

-- 「運営だけに見せる」── 個人的な内容の要望のため（オーナー指示）。
-- ★ 後から公開へ切り替える口は作らない。本人の意図に反して運営が公開できる形にしない。
alter table public.pv_requests add column if not exists visibility text not null default 'public';
alter table public.pv_requests drop constraint if exists pv_requests_vis_ck;
alter table public.pv_requests add constraint pv_requests_vis_ck check (
  visibility in ('public', 'private'));

-- 添付の絵は「運営が見てから公開」（オーナー決定）。
-- ★ ここが要。再エンコードで EXIF の位置情報は落ちるが、画素に写り込んだ
--   氏名・社員番号・会社名・金額は落ちない。機械で守れるのはここまでなので人が1回見る。
--   この門を外すと、この機能はサイトの土台（匿名性）に反する。
alter table public.pv_requests add column if not exists image_state text not null default 'none';
alter table public.pv_requests drop constraint if exists pv_requests_img_ck;
alter table public.pv_requests add constraint pv_requests_img_ck check (
  image_state in ('none', 'pending', 'public', 'rejected'));

alter table public.pv_request_images drop constraint if exists pv_request_images_len_ck;
alter table public.pv_request_images add constraint pv_request_images_len_ck check (
  byte_len = octet_length(bytes) and byte_len > 0 and byte_len <= 500000);
alter table public.pv_request_images drop constraint if exists pv_request_images_mime_ck;
-- ★ JPEG だけ。常に JPEG へ焼き直して送るので、SVG のような
--   「絵の顔をした HTML」が原理的に入らない
alter table public.pv_request_images add constraint pv_request_images_mime_ck check (
  mime = 'image/jpeg' and substring(bytes from 1 for 3) = '\xffd8ff'::bytea);

alter table public.pv_request_likes drop constraint if exists pv_request_likes_hash_ck;
alter table public.pv_request_likes add constraint pv_request_likes_hash_ck check (
  liker_hash ~ '^[0-9a-f]{64}$');

alter table public.pv_request_comments drop constraint if exists pv_request_comments_body_ck;
alter table public.pv_request_comments add constraint pv_request_comments_body_ck check (
  char_length(btrim(body)) between 2 and 500);
alter table public.pv_request_comments drop constraint if exists pv_request_comments_hash_ck;
alter table public.pv_request_comments add constraint pv_request_comments_hash_ck check (
  author_hash ~ '^[0-9a-f]{64}$');
-- 匿名の番号は1から。0 や負の番号を配らない
alter table public.pv_request_anons drop constraint if exists pv_request_anons_no_ck;
alter table public.pv_request_anons add constraint pv_request_anons_no_ck check (
  anon_no >= 1);
alter table public.pv_request_anons drop constraint if exists pv_request_anons_hash_ck;
alter table public.pv_request_anons add constraint pv_request_anons_hash_ck check (
  author_hash ~ '^[0-9a-f]{64}$');

create index if not exists pv_requests_new_idx
  on public.pv_requests (created_at desc) where not is_hidden;
create index if not exists pv_requests_author_idx
  on public.pv_requests (author_hash, created_at desc);
create index if not exists pv_request_likes_req_idx
  on public.pv_request_likes (request_id);

create index if not exists pv_request_comments_req_idx
  on public.pv_request_comments (request_id, created_at);

comment on table public.pv_requests is
  'ROADMAP & REQUESTS の匿名リクエスト。user_id は持たず author_hash だけ。個票の直読みは不可。';
comment on column public.pv_requests.author_hash is
  '★ どの関数の返り値にも入れないこと。外へ出た瞬間に安定した仮名 ID になり、同じ人の投稿を束ねられる。';
comment on column public.pv_requests.visibility is
  '''private'' は運営と本人にしか出さない。公開へ戻す関数は作らない（消して出し直す）。';
comment on column public.pv_requests.is_hidden is
  '荒らしを伏せる札。「やらない」を表すのは status=''declined'' のほう。';
comment on table public.pv_request_likes is
  '♡。1人1票は主キー (request_id, liker_hash) で担保する。
   ★ 「誰が押したか」を返す関数を作らないこと。作った瞬間に、投稿時の自動1票から投稿者が割れる。';


comment on table public.pv_request_comments is
  '要望へのコメント。user_id は持たず author_hash だけ。書けるのは給与を1件でも出した人（pv_my_give の basic）。';
comment on table public.pv_request_anons is
  '「匿名1」「匿名2」をスレッドごとに配る表。★配った番号は書き換えない・返さない。読むときに数え直さないのは、1行欠けただけで過去の会話の相手が入れ替わるため。';
comment on column public.pv_request_comments.is_staff is
  '★書いた時点の pv_is_admin() を焼き付けたもの。名簿から外れても過去の「運営」の返信が匿名に化けない。';


-- ════════════════════════════════════════════════════════════════
-- 2. 権限：表は誰にも触らせない
-- ════════════════════════════════════════════════════════════════
-- SELECT / INSERT / UPDATE / DELETE いずれのポリシーも作らない。
-- ＝ anon も authenticated も直接は1行も読めない・書けない。
alter table public.pv_requests         enable row level security;
alter table public.pv_request_likes    enable row level security;
alter table public.pv_request_images   enable row level security;
alter table public.pv_request_comments enable row level security;
alter table public.pv_request_anons    enable row level security;

revoke all on public.pv_requests         from anon, authenticated;
revoke all on public.pv_request_likes    from anon, authenticated;
revoke all on public.pv_request_images   from anon, authenticated;
revoke all on public.pv_request_comments from anon, authenticated;
revoke all on public.pv_request_anons    from anon, authenticated;

-- 既に作ってしまったポリシーがあれば落とす（冪等・事故防止）
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
            where schemaname = 'public'
              and tablename in ('pv_requests', 'pv_request_likes',
                                'pv_request_images', 'pv_request_comments',
                                'pv_request_anons') loop
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
-- 3-b. 見えるかどうか（★この判定はここ1か所だけ）
-- ════════════════════════════════════════════════════════════════
-- 一覧の total と本体、♡ を押せるかの3か所が全部これを呼ぶ。
-- ★ where を手で書き写さない。書き写した瞬間、片方だけ直す日が来る。
create or replace function public.pv_req_visible(
  p_hidden boolean, p_vis text, p_author text, p_me text, p_admin boolean)
returns boolean
language sql
immutable
as $fn$
  select coalesce(p_admin, false)
      or (p_author = p_me)
      or ((not coalesce(p_hidden, false)) and coalesce(p_vis, 'public') = 'public');
$fn$;

comment on function public.pv_req_visible(boolean, text, text, text, boolean) is
  '要望が自分に見えるか。運営は全部／自分の行は必ず／それ以外は「伏せられていない かつ public」。';


-- ════════════════════════════════════════════════════════════════
-- 4. 出す（投稿）
-- ════════════════════════════════════════════════════════════════
-- 返り値は {ok:true, item:{…}}。弾いたときは例外ではなく
-- {ok:false, status:'rate_limited'|'too_fast'|'duplicate'} を返す
-- （db/referrals.sql と同じ作法。画面は理由ごとに違う一言を出す）。
-- ⚠️ 引数が1つ増えた。create or replace だけでは **古い2引数版が残る**。
--    画面が古いほうを呼び続け、「運営だけに見せる」が黙って効かなくなるので、
--    必ず先に落とす。
drop function if exists public.pv_request_submit(text, text);
drop function if exists public.pv_request_submit(text, text, boolean);

create or replace function public.pv_request_submit(
  p_body text, p_category text default 'other', p_private boolean default false,
  p_image_b64 text default null, p_w int default null, p_h int default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_hash  text;
  v_body  text;
  v_cat   text;
  v_vis   text;
  v_admin boolean;
  v_n     int;
  v_bytes bytea;
  v_state text := 'none';
  v_row   public.pv_requests%rowtype;
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

  v_vis := case when coalesce(p_private, false) then 'private' else 'public' end;

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

  -- ── 添付の絵 ──────────────────────────────────────────────
  -- ★ 行より先に中身を確かめる。ここを通してから1つの取引で両方入れるので、
  --   「絵だけ入って行が無い」も「行だけ入って絵が無い」も起きない。
  -- ★ 絵は行と同じ取引で入る＝通知の Webhook（INSERT のときだけ飛ぶ）が
  --   image_state を 'pending' として読める。あとから足す形にすると
  --   「絵が付いているのにメールが何も言わない」になる。
  if p_image_b64 is not null and char_length(btrim(p_image_b64)) > 0 then
    -- 先に長さで弾く（base64 は元の約4/3）。大きいものを decode してから測らない
    if char_length(p_image_b64) > 700000 then
      return jsonb_build_object('ok', false, 'status', 'image_too_big');
    end if;
    begin
      v_bytes := decode(p_image_b64, 'base64');
    exception when others then
      return jsonb_build_object('ok', false, 'status', 'image_bad');
    end;
    if octet_length(v_bytes) > 500000 then
      return jsonb_build_object('ok', false, 'status', 'image_too_big');
    end if;
    -- ★ 中身の検品が先。小さすぎるものを「大きすぎる」と言い返さない
    --   （PNG を送った人に image_too_big と返して、意味の分からない画面になっていた）。
    -- JPEG の先頭3バイト。画面は必ず canvas で焼き直してから送るので、
    -- ここを通らない＝送り方がおかしい（SVG や PDF を混ぜようとしている）
    if octet_length(v_bytes) < 100
       or substring(v_bytes from 1 for 3) <> '\xffd8ff'::bytea then
      return jsonb_build_object('ok', false, 'status', 'image_bad');
    end if;
    v_state := 'pending';
  end if;

  insert into public.pv_requests (author_hash, body, category, visibility, image_state)
  values (v_hash, v_body, v_cat, v_vis, v_state)
  returning * into v_row;

  if v_state = 'pending' then
    insert into public.pv_request_images (request_id, bytes, byte_len, w, h)
    values (v_row.id, v_bytes, octet_length(v_bytes),
            nullif(least(greatest(coalesce(p_w, 0), 0), 20000), 0),
            nullif(least(greatest(coalesce(p_h, 0), 0), 20000), 0));
  end if;

  -- ★ 本人の1票を本当に入れる。like_count が 1 から始まるのは実データ。
  --   誰が押したかはどの関数も返さないので、これで投稿者は割れない。
  insert into public.pv_request_likes (request_id, liker_hash)
  values (v_row.id, v_hash);

  -- ★ 一覧と「鍵の顔ぶれまで」同じ形で返す（画面が取り直さずに先頭へ挿せる）。
  --   1つでも欠けると、出した直後の1件だけ札や絵が出ない行になる。
  v_admin := public.pv_is_admin();
  return jsonb_build_object('ok', true, 'item', jsonb_build_object(
    'id',          v_row.id,
    'body',        v_row.body,
    'category',    v_row.category,
    'status',      v_row.status,
    'visibility',  v_row.visibility,
    'created_at',  v_row.created_at,
    'like_count',  1,
    'liked_by_me', true,
    -- 出した直後は当然ゼロ。★フロントで数えない（増減は必ずサーバの実数）
    'comment_count', 0,
    'image',       v_row.image_state,
    'is_hidden',   case when v_admin then false else null end));
end;
$fn$;

revoke all on function public.pv_request_submit(text, text, boolean, text, int, int)
  from public, anon;
grant execute on function public.pv_request_submit(text, text, boolean, text, int, int)
  to authenticated;

comment on function public.pv_request_submit(text, text, boolean, text, int, int) is
  '要望を1件出す。ログインした人だけ。本文4〜500字・60秒/5件24時間・同文の重複を弾く。投稿者の1票も同時に入れる。p_private で運営だけに見せる。絵は JPEG 500KB まで・出した時点では pending（運営が見るまで他人に出ない）。';


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

  -- ★ total は「その人に見えている件数」。運営だけに見せる要望を1件出した人は、
  --   その人にだけ1件多く見える。自分の行なので他人のことは1件も分からない。
  select count(*) into v_total
    from public.pv_requests r
   where public.pv_req_visible(r.is_hidden, r.visibility, r.author_hash, v_hash, v_admin);

  select coalesce(jsonb_agg(x order by x_ord), '[]'::jsonb) into v_items
    from (
      select jsonb_build_object(
               'id',          r.id,
               'body',        r.body,
               'category',    r.category,
               'status',      r.status,
               'visibility',  r.visibility,
               'created_at',  r.created_at,
               'like_count',  c.n,
               'liked_by_me', exists (select 1 from public.pv_request_likes l
                                       where l.request_id = r.id and l.liker_hash = v_hash),
               -- ★実数。伏せたコメントは一般ユーザーの数にも入れない
               --   （数だけ多い行を作ると「1件消えた」が分かってしまう）
               'comment_count', cc.n,
               -- ★ 確認前の絵は、第三者には **あることすら** 出さない。
               --   'pending' を返すと「運営が確認中の絵がある」という札が立ち、
               --   公開前の絵をめぐる催促や詮索の的になる。第三者には 'none'。
               'image',       case
                                when r.image_state = 'public' then 'public'
                                when v_admin or r.author_hash = v_hash then r.image_state
                                else 'none' end,
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
        cross join lateral (
               select count(*)::int as n from public.pv_request_comments cm
                where cm.request_id = r.id and (v_admin or not cm.is_hidden)) cc
       where public.pv_req_visible(r.is_hidden, r.visibility, r.author_hash, v_hash, v_admin)
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
  '要望の一覧。ログインした人だけ。author_hash は返さない。見えるかは pv_req_visible ただ1つで決める。total はその人に見えている件数。';


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
  v_row    public.pv_requests%rowtype;
  v_del    int;
  v_n      int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  v_hash := public.pv_request_hash(v_uid);

  select * into v_row from public.pv_requests r where r.id = p_id;
  if not found then
    raise exception 'その要望はありません' using errcode = '22023';
  end if;
  -- ★ 一覧と同じ判定。見えない行には押せない（見えない行の数を数えられない）
  if not public.pv_req_visible(v_row.is_hidden, v_row.visibility,
                               v_row.author_hash, v_hash, public.pv_is_admin()) then
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
-- 6-b. 添付の絵を1枚読む
-- ════════════════════════════════════════════════════════════════
-- 一覧では絵を返さない（4件でも数百KBずつ乗る）。画面が「絵がある」と分かった行だけ、
-- 描くときに1枚ずつ取りにくる。返すのは base64 で、画面が data: URL にして貼る。
-- ★ 門は3つ全部。行が自分に見えて、かつ（公開済み or 自分の行 or 運営）。
create or replace function public.pv_request_image(p_id uuid)
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
  v_row   public.pv_requests%rowtype;
  v_img   public.pv_request_images%rowtype;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  v_hash  := public.pv_request_hash(v_uid);
  v_admin := public.pv_is_admin();

  select * into v_row from public.pv_requests where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;
  -- 見えない要望の絵は、あるかどうかも答えない
  if not public.pv_req_visible(v_row.is_hidden, v_row.visibility,
                               v_row.author_hash, v_hash, v_admin) then
    raise exception '見られません' using errcode = '42501';
  end if;
  if not (v_row.image_state = 'public' or v_row.author_hash = v_hash or v_admin) then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  select * into v_img from public.pv_request_images where request_id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'mime', v_img.mime,
                            'w', v_img.w, 'h', v_img.h,
                            'state', v_row.image_state,
                            -- ★ encode は76字ごとに改行を挟む。画面は data: URL に
                            --   そのまま入れるので、外してから返す
                            'b64', replace(encode(v_img.bytes, 'base64'), chr(10), ''));
end;
$fn$;

revoke all on function public.pv_request_image(uuid) from public, anon;
grant execute on function public.pv_request_image(uuid) to authenticated;

comment on function public.pv_request_image(uuid) is
  '添付の絵を1枚 base64 で返す。公開済み・自分の行・運営のときだけ。author_hash は返さない。';


-- ════════════════════════════════════════════════════════════════
-- 6-c. コメント（書く・読む）
-- ════════════════════════════════════════════════════════════════
-- オーナー指示「みんなからのリクエストの部分、他の人がコメントできるようにして」。
--
-- ★ 書けるのは給与を1件でも出した人だけ（オーナー決定）。Give & Get の門を
--   ここにも掛ける。運営は pv_my_give の basic が自動で通す。
-- ★ 名乗りは「投稿者」「運営」「匿名1」「匿名2」…。番号は書いた瞬間に決まる。
-- ★ author_hash はどの返り値にも入れない。要望の側と同じ約束。
--   ここが破れると「この匿名1は、あの要望を出した人と同じ」が組み立てられる。
create or replace function public.pv_request_comment_add(p_id uuid, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_hash  text;
  v_admin boolean;
  v_body  text;
  v_row   public.pv_requests%rowtype;
  v_who   text;
  v_no    integer;
  v_n     int;
  v_c     public.pv_request_comments%rowtype;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  v_hash  := public.pv_request_hash(v_uid);
  v_admin := public.pv_is_admin();

  -- ★ trim が先（空白だけのコメントを潰す）
  v_body := btrim(coalesce(p_body, ''));
  if char_length(v_body) < 2 then
    raise exception 'コメントを書いてください' using errcode = '22023';
  end if;
  if char_length(v_body) > 500 then
    raise exception '500文字までです' using errcode = '22023';
  end if;

  -- ★ 親の行を掴んでから読む。同じスレッドへ2人が同時に書いても、
  --   同じ匿名番号を2人に配らない（表の unique はその裏取り）。
  select * into v_row from public.pv_requests where id = p_id for update;
  if not found then
    raise exception 'その要望はありません' using errcode = '22023';
  end if;
  -- ★ 一覧と同じ判定。自分に見えない要望には書けない
  --   （書けたかどうかで、見えない行の存在が分かってしまう）
  if not public.pv_req_visible(v_row.is_hidden, v_row.visibility,
                               v_row.author_hash, v_hash, v_admin) then
    raise exception 'その要望は表示されていません' using errcode = '42501';
  end if;

  -- ★ Give & Get の門。例外にしないのは、画面が
  --   「給与を1件出すと、コメントできます」の1行を出すため（既存の too_fast と同じ流儀）。
  if not coalesce((public.pv_my_give()->>'basic')::boolean, false) then
    return jsonb_build_object('ok', false, 'status', 'need_give');
  end if;

  -- 連投（30秒）
  if exists (select 1 from public.pv_request_comments
              where author_hash = v_hash and created_at > now() - interval '30 seconds') then
    return jsonb_build_object('ok', false, 'status', 'too_fast');
  end if;
  -- 1日の上限
  select count(*) into v_n from public.pv_request_comments
   where author_hash = v_hash and created_at > now() - interval '24 hours';
  if v_n >= 20 then
    return jsonb_build_object('ok', false, 'status', 'rate_limited');
  end if;
  -- 同じスレッドへの同じ内容の重ね出し
  if exists (select 1 from public.pv_request_comments
              where request_id = p_id and author_hash = v_hash
                and lower(btrim(body)) = lower(v_body)) then
    return jsonb_build_object('ok', false, 'status', 'duplicate');
  end if;

  -- 名乗り。投稿者 > 運営 > 匿名N の順に決まる
  if v_row.author_hash = v_hash then
    v_who := 'author';
  elsif v_admin then
    v_who := 'staff';
  else
    v_who := 'anon';
    -- ★ 番号は pv_request_anons で配る。同じスレッドで前にも書いていれば
    --   そのときの番号がそのまま返る（主キーが1人1番号を担保している）。
    select an.anon_no into v_no from public.pv_request_anons an
     where an.request_id = p_id and an.author_hash = v_hash;
    if v_no is null then
      -- ★ 伏せた人・消えたコメントの番号も飛ばさずに数える（他人の番号がずれない）
      select coalesce(max(an.anon_no), 0) + 1 into v_no
        from public.pv_request_anons an where an.request_id = p_id;
      insert into public.pv_request_anons (request_id, author_hash, anon_no)
      values (p_id, v_hash, v_no);
    end if;
  end if;

  insert into public.pv_request_comments (request_id, author_hash, body, is_staff)
  values (p_id, v_hash, v_body, v_who = 'staff')
  returning * into v_c;

  -- ★ 一覧と同じ鍵の顔ぶれで返す（画面が取り直さずに末尾へ足せる）
  return jsonb_build_object('ok', true, 'item', jsonb_build_object(
    'id',         v_c.id,
    'body',       v_c.body,
    'who',        v_who,
    'n',          v_no,
    'mine',       true,
    'created_at', v_c.created_at,
    'is_hidden',  case when v_admin then false else null end));
end;
$fn$;

revoke all on function public.pv_request_comment_add(uuid, text) from public, anon;
grant execute on function public.pv_request_comment_add(uuid, text) to authenticated;

comment on function public.pv_request_comment_add(uuid, text) is
  '要望に1件コメントする。給与を1件でも出した人だけ（出していなければ {ok:false,status:''need_give''}）。author_hash は返さない。';


-- ★ 一覧には本文を載せない。開いた行のぶんだけ、ここで取りにくる
--   （「一覧を全件ブラウザへ投げない」の約束はコメントにも掛かる）。
create or replace function public.pv_request_comments_list(
  p_id uuid, p_limit int default 50, p_offset int default 0)
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
  v_row   public.pv_requests%rowtype;
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

  select * into v_row from public.pv_requests where id = p_id;
  if not found then
    raise exception 'その要望はありません' using errcode = '22023';
  end if;
  -- ★ 見えない要望のコメントは読めない（あるかどうかも答えない）
  if not public.pv_req_visible(v_row.is_hidden, v_row.visibility,
                               v_row.author_hash, v_hash, v_admin) then
    raise exception 'その要望は表示されていません' using errcode = '42501';
  end if;

  v_lim := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_off := greatest(coalesce(p_offset, 0), 0);

  select count(*) into v_total from public.pv_request_comments c
   where c.request_id = p_id and (v_admin or not c.is_hidden);

  select coalesce(jsonb_agg(x order by x_ord), '[]'::jsonb) into v_items
    from (
      select jsonb_build_object(
               'id',   c.id,
               'body', c.body,
               -- ★ 名乗りはこの3つだけ。ハッシュそのものは1バイトも出さない。
               --   比較は下の f に閉じてあり、ここには hash という語すら出てこない
               'who',  case when f.is_author then 'author'
                            when c.is_staff then 'staff'
                            else 'anon' end,
               'n',    case when c.is_staff or f.is_author
                            then null else an.anon_no end,
               -- 自分の書き込みか。呼んだ本人のことしか分からない値
               'mine', f.is_mine,
               'created_at', c.created_at,
               'is_hidden',  case when v_admin then c.is_hidden else null end) as x,
             row_number() over (order by c.created_at, c.id) as x_ord
        from public.pv_request_comments c
        left join public.pv_request_anons an
               on an.request_id = c.request_id and an.author_hash = c.author_hash
        -- ★ハッシュを見るのはここ1か所だけ。ここから外へ出るのは真偽2つだけ
        cross join lateral (
               select c.author_hash = v_row.author_hash as is_author,
                      c.author_hash = v_hash            as is_mine) f
       where c.request_id = p_id and (v_admin or not c.is_hidden)
       order by c.created_at, c.id
       limit v_lim offset v_off
    ) s;

  return jsonb_build_object('ok', true, 'id', p_id, 'total', v_total,
                            'limit', v_lim, 'offset', v_off,
                            -- 画面が門の一言を先に出せるように（空振りの往復を作らない）
                            'can_write',
                            coalesce((public.pv_my_give()->>'basic')::boolean, false),
                            'items', v_items);
end;
$fn$;

revoke all on function public.pv_request_comments_list(uuid, int, int) from public, anon;
grant execute on function public.pv_request_comments_list(uuid, int, int) to authenticated;

comment on function public.pv_request_comments_list(uuid, int, int) is
  '1つの要望のコメントを古い順に返す。名乗りは author / staff / anon+番号 だけで、author_hash は返さない。見えない要望のコメントは読めない。';


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


-- 添付の絵を公開する／見送る。★この門がこの機能の芯（オーナー決定）。
-- ★ 'pending' へ戻す道は作らない。運営が一度見た事実を、あとから無かったことにしない。
-- ★ 絵そのものを差し替える道もどこにも無い（絵が入るのは pv_request_submit の
--   INSERT のとき1回だけ）。公開したあとで別の絵にすり替えられない。
create or replace function public.pv_request_set_image_state(p_id uuid, p_state text)
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
  if p_state not in ('public', 'rejected') then
    raise exception '公開するか見送るかのどちらかです' using errcode = '22023';
  end if;

  update public.pv_requests
     set image_state = p_state, updated_at = now()
   where id = p_id and image_state in ('pending', 'public', 'rejected');
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'その要望に絵がありません' using errcode = '22023';
  end if;

  -- 見送った絵は中身ごと消す。「見送り」と書いてあるのに DB には残っている、を作らない
  if p_state = 'rejected' then
    delete from public.pv_request_images where request_id = p_id;
  end if;

  return jsonb_build_object('ok', true, 'id', p_id, 'image', p_state);
end;
$fn$;

revoke all on function public.pv_request_set_image_state(uuid, text) from public, anon;
grant execute on function public.pv_request_set_image_state(uuid, text) to authenticated;

comment on function public.pv_request_set_image_state(uuid, text) is
  '添付の絵を公開する／見送る。管理者だけ（pv_is_admin）。見送ると絵の中身も消す。pending へは戻せない。';


-- コメントを伏せる／戻す。★消す関数は作らない。
--   物理削除すると匿名の通し番号が意味を失い、過去の会話の相手が入れ替わる。
create or replace function public.pv_request_comment_set_hidden(p_id uuid, p_hidden boolean)
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

  update public.pv_request_comments
     set is_hidden = coalesce(p_hidden, false)
   where id = p_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'そのコメントはありません' using errcode = '22023';
  end if;

  return jsonb_build_object('ok', true, 'id', p_id, 'is_hidden', coalesce(p_hidden, false));
end;
$fn$;

revoke all on function public.pv_request_comment_set_hidden(uuid, boolean) from public, anon;
grant execute on function public.pv_request_comment_set_hidden(uuid, boolean) to authenticated;

comment on function public.pv_request_comment_set_hidden(uuid, boolean) is
  'コメントを伏せる／戻す。管理者だけ（pv_is_admin）。★消す関数は無い（消すと匿名の通し番号がずれる）。';


-- ════════════════════════════════════════════════════════════════
-- 8. コミュニティの伸び（折れ線の材料）
-- ════════════════════════════════════════════════════════════════
-- 週ごとの「給与を出したパイロットの累計人数」を返すだけ。
-- 返るのは [{d: '2026-07-06', n: 12}, …] の形で、週の日付と人数しか入っていない。
-- 個人の属性は1つも出さない（会社も職位も金額も、この関数は触っていない）。
--
-- ★★ 数え方は pv_deep_contributors() と1文字も違えてはいけない。★★
--   あれは pv_pay_person_map() を通した**実人物**で数える。ここで proof_hash を
--   そのまま数えると、2社に給与を出した人が 2 になり、
--   **折れ線の右端がヒーローの人数と食い違う**（同じ画面に「23人」と「25」が並ぶ）。
--   式を写さず、同じ地図（pv_pay_person_map）を呼ぶこと。
--
-- ★預かり（pay_reports_pending）は数えない。pv_deep_contributors() と同じ理由で、
--   ip_day_hash は「端末 × 日」であって人ではない。
--
-- ★未ログインでは jsonb_agg が NULL を返す（= 空の配列ではなく null）。
--   画面は null を「取れなかった」として — を出す。0 の並びを描かせない。
create or replace function public.pv_give_growth(p_weeks int default 12)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  with wk as (
    -- 週数はサーバで抑える（2〜52）。呼ぶ側の数字をそのまま信じない
    select generate_series(
             date_trunc('week', now())
               - make_interval(weeks => greatest(2, least(52, coalesce(p_weeks, 12))) - 1),
             date_trunc('week', now()),
             interval '1 week') as w
  ),
  firsts as (
    -- 1人につき「はじめて給与を出した日」1つだけ
    select m.human as human, min(r.created_at) as t
      from public.pay_reports r
      join public.pv_pay_person_map() m on m.h = r.proof_hash
     group by m.human
  )
  select jsonb_agg(jsonb_build_object(
           'd', (wk.w)::date,
           'n', (select count(*) from firsts f where f.t < wk.w + interval '7 days')
         ) order by wk.w)
    from wk
   where auth.uid() is not null;
$fn$;

revoke all on function public.pv_give_growth(int) from public, anon;
grant execute on function public.pv_give_growth(int) to authenticated;

comment on function public.pv_give_growth(int) is
  'コミュニティの伸び。週ごとの「給与を出したパイロット」の累計人数だけを返す。'
  '数え方は pv_deep_contributors() と同じ実人物単位（pv_pay_person_map を通す）。'
  '右端の値は必ず pv_deep_contributors() と一致する。';
