-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/stays.sql
--
-- 就航地のステイ情報（career.html の「就航地」）。
-- 会社 × 空港ごとに「泊まるホテル・食べる所・行く所」を1件＝1行で持ち、
-- 写真を何枚か付けられる。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: db/airlines.generated.sql → db/pay-reports.sql → db/pay-rows.sql
--    → db/admin.sql → このファイル
--    （前のどれかが抜けていたら、下の「0. 前提」が日本語で止める。）
-- 冪等（何度流しても安全）。
--
-- ── この設計が守っている約束 ────────────────────────────────
--  1. 見てよい人は2種類だけ。
--       a) サーバーだけが付ける確認の印を持つ人（profiles.verify_level >= 1）
--       b) 運営（pv_admins に居る人。判定は db/pay-rows.sql の pv_is_operator）
--     判定は pv_stay_role() の1か所だけ。どの関数も、表を読む前にここを通る。
--     ★ 次のものは根拠に**しない**。どれも本人の申告か、別の約束の鍵だから。
--         access_until（給与を出せば誰でも付く90日の鍵）／pv_my_give の basic・detailed・full／
--         badge／profiles の会社・職位（本人が書き換えられる列）／
--         pay_reports.source（明細と名乗っただけ）／FOUNDING の番号／ブラウザの保存領域
--     ⚠️ 2026-10-04 の時点で、verify_level を 1 以上にする処理はリポジトリのどこにも無い
--        （設計は VERIFIED-PILOT.md に書いてあるだけ）。
--        ＝ このファイルを貼っても、**いま通れる会員は0人・見えるのは運営だけ**。
--        印を付ける道を作らないまま、ここの条件をゆるめて穴を開けない。
--     ★ 印が「サーバーだけが付けたもの」であることは、**呼ばれるたびに**確かめ直す
--       （pv_is_verified_pilot）。あとから別の SQL が profiles の書き込みを会員へ配り直したら、
--       印はもう信用できないので会員は全員 locked に戻る（運営は名簿で通る）。
--       直し方は db/admin.sql を貼り直すこと。
--  2. 資格の無い人には何も返さない。pv_stays は {ok:true, state:'locked'} **だけ**。
--     名前も、件数も、「在る／無い」も返さない（表を1行も読まずに返している）。
--  3. user_id を持たない。author_hash だけ（区切りは '::pv_hotel::'）。
--     ★ 要望（'::pv_req::'）・給与・待遇のハッシュと区切りを変えてある
--       ＝ 表どうしを突き合わせて「同じ人」を束ねられない。
--     ★ author_hash を画面へ返す関数を1つも作らない。返すのは「自分のか」（mine）だけ。
--  4. 表は完全に閉じる。ポリシーを1つも作らない＝ anon も authenticated も
--     直接は1行も読めない・書けない。出入口は security definer の関数だけ。
--  5. 場所も写真も 'pending' で入る。運営が見るまで、書いた本人と運営にしか出ない。
--     ★ 写真は端末で焼き直してから届く約束だが、**それを当てにしない**（約束 11 と同じ理由）。
--       届いた JPEG を、サーバーで**節に分けて決まった形に作り直してから**保存する
--       （3-i の pv_jpeg_read。頭は毎回同じ JFIF・APPn とコメントは全部落とす・終わりの印より
--       後ろも落とす・知らない節や節の余りが在れば受けない）。REST を直接叩いても、
--       撮った日時・撮った場所・機種の名前は表に残らない。
--     ★ 関数を通さずに表へ入れる道も閉じてある。表の CHECK が「作り直した形そのものか」と
--       「幅・高さが写真の本当の値か」を見る（3-j）。保存してあるもの＝作り直し済みのものだけ。
--     ★ 幅と高さは写真そのものから読む。送られてきた w・h は読まない。
--       それでも、画素に写り込んだ顔・社員証・部屋番号・乗務の書類は落ちない。
--       符号データや表の数字の中に**わざと作り込んだもの**も、復号しない限り分からない。人が1回見る。
--     ★ 運営でも、**自分が出したものを自分で公開できない**（別の運営が見る）。
--     ★ 'pending' へ戻す道は無い。見送った写真は画素ごと消す。
--  6. 「見えるかどうか」の判定は pv_stay_visible() ただ1つ。場所にも写真にも同じ式を使う。
--  7. 時刻を返さない。返すのは0〜4の段（age）だけ。並びも時刻で決めない。
--     ★ ステイ先は乗務の記録と突き合わせやすい。「何日の何時に書いたか」が出ると、
--       その日にその空港に居た人まで絞れてしまう。
--     ★ 段は**暦の月（UTC）**で切る。「書いた時刻からちょうど1か月」で切ると、
--       段が 0 → 1 に変わる瞬間を見張るだけで、書いた時刻が秒まで分かる。
--     ★ 写真の並びも足した順にしない（id の順＝乱数）。足した順に並べると、自分の写真を
--       前後に置くだけで、他人の写真が足された時刻を挟み撃ちにできる。
--  8. 写真は Supabase Storage に置かない（storage.objects が生の user_id を持つ）。
--     この表に bytea で持つ。JPEG だけ・50万バイトまで（作り直したあとの長さで測る）。
--  9. 地図のリンクは https で Google マップのホストだけ。それ以外は**捨てる**（投稿は通す）。
--     捨てた場合は maps_url が null で返るので、画面は名前と住所から検索のリンクを作る。
--     ★ ホストが合っていても、よそへ飛ばす口（/url?q=…）は通さない。maps.google.com にも在る。
-- 10. 数を作らない。件数の欄をどこにも返さない（画面は配列の長さを見ればよい）。
-- 11. 文字数・区分・連投・画像の検品は全部ここでやる。
--     画面の maxlength は目安にすぎず、REST を直接叩けば素通りする。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regclass('public.pv_airlines') is null then
    raise exception '先に db/airlines.generated.sql を実行してください（pv_airlines の表が無い）';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles'
                    and column_name = 'verify_level') then
    raise exception '先に db/pay-reports.sql を実行してください（profiles.verify_level が無い）';
  end if;
  if to_regprocedure('public.pv_is_operator()') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pv_is_operator が無い）';
  end if;
  if to_regclass('public.pv_admins') is null then
    raise exception '先に db/admin.sql を実行してください（pv_admins の表が無い）';
  end if;
  -- ★確認の印を会員が自分で書けるなら、この門は無いのと同じ。
  --   db/admin.sql が profiles の書き込みを10列に絞っている。それが効いていることを確かめる。
  if has_column_privilege('authenticated', 'public.profiles', 'verify_level', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'verify_level', 'INSERT')
     or has_column_privilege('anon', 'public.profiles', 'verify_level', 'UPDATE')
     or has_column_privilege('anon', 'public.profiles', 'verify_level', 'INSERT') then
    raise exception '先に db/admin.sql を実行してください（会員が profiles.verify_level を自分で書ける状態になっている）';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. 表
-- ════════════════════════════════════════════════════════════════
create table if not exists public.pv_stay_places (
  id           uuid primary key default gen_random_uuid(),
  -- sha256(uid || '::pv_hotel::')。生の user_id は持たない
  author_hash  text not null,
  -- pv_airlines の code（'etihad' など）。'other' は入れない
  airline      text not null,
  -- 空港の3レター（英大文字3字）
  iata         text not null,
  -- 'hotel'（泊まる所）／'food'（食べる所）／'spot'（行く所）
  kind         text not null,
  name         text not null,
  address      text,
  -- https で Google マップのホストだけ。それ以外は null（pv_stay_maps_url が捨てる）
  maps_url     text,
  note         text,
  -- 'pending'（運営がまだ見ていない）→ 'public' ／ 'rejected'。pending へは戻らない
  state        text not null default 'pending',
  created_at   timestamptz not null default now(),
  moderated_at timestamptz
);

-- 写真。1つの場所に何枚でも付く（主キーは写真そのものの id）。
-- ★ 誰が運営として見たかは持たない（moderated_at だけ）。生の user_id を残さないため。
create table if not exists public.pv_stay_photos (
  id           uuid primary key default gen_random_uuid(),
  place_id     uuid not null references public.pv_stay_places(id) on delete cascade,
  -- 場所と同じ式のハッシュ。場所を書いた人と写真を足した人は別でよい
  author_hash  text not null,
  mime         text not null default 'image/jpeg',
  -- 見送った写真は画素を消す（null）。行は残る＝本人に「見送り」と出せる
  bytes        bytea,
  byte_len     integer,
  -- 縦横は場所を先に取るためだけ（読み込みで行が飛び跳ねない）。
  -- ★ 写真そのものから読んだ値（画面から来た値ではない。3-j の CHECK が見る）
  w            integer,
  h            integer,
  state        text not null default 'pending',
  created_at   timestamptz not null default now(),
  moderated_at timestamptz
);

-- check は毎回 drop してから付け直す（条件を変えて流し直したとき古い定義を残さない）
alter table public.pv_stay_places drop constraint if exists pv_stay_places_hash_ck;
alter table public.pv_stay_places drop constraint if exists pv_stay_places_airline_fk;
alter table public.pv_stay_places drop constraint if exists pv_stay_places_airline_ck;
alter table public.pv_stay_places drop constraint if exists pv_stay_places_iata_ck;
alter table public.pv_stay_places drop constraint if exists pv_stay_places_kind_ck;
alter table public.pv_stay_places drop constraint if exists pv_stay_places_name_ck;
alter table public.pv_stay_places drop constraint if exists pv_stay_places_address_ck;
alter table public.pv_stay_places drop constraint if exists pv_stay_places_note_ck;
alter table public.pv_stay_places drop constraint if exists pv_stay_places_maps_ck;
alter table public.pv_stay_places drop constraint if exists pv_stay_places_state_ck;

alter table public.pv_stay_places add constraint pv_stay_places_hash_ck check (
  author_hash ~ '^[0-9a-f]{64}$');
-- 会社は名簿に在るものだけ。名簿は行を消さない（active=false にするだけ）ので参照は切れない
alter table public.pv_stay_places add constraint pv_stay_places_airline_fk
  foreign key (airline) references public.pv_airlines(code);
-- ★ 'other'（その他・自由入力）には入れない。別々の会社のホテルが1つの箱に混ざる
alter table public.pv_stay_places add constraint pv_stay_places_airline_ck check (
  airline <> 'other');
alter table public.pv_stay_places add constraint pv_stay_places_iata_ck check (
  iata ~ '^[A-Z]{3}$');
alter table public.pv_stay_places add constraint pv_stay_places_kind_ck check (
  kind in ('hotel', 'food', 'spot'));
-- ★ 前後の空白を落としてから数える。空白だけの名前で通り抜けられないように
alter table public.pv_stay_places add constraint pv_stay_places_name_ck check (
  name = btrim(name) and char_length(name) between 2 and 80);
alter table public.pv_stay_places add constraint pv_stay_places_address_ck check (
  address is null or (address = btrim(address) and char_length(address) between 1 and 200));
alter table public.pv_stay_places add constraint pv_stay_places_note_ck check (
  note is null or char_length(note) between 1 and 500);
-- 二重の網。関数（pv_stay_maps_url）を通らない道で入っても、ホストはここで止まる
alter table public.pv_stay_places add constraint pv_stay_places_maps_ck check (
  maps_url is null or (
    char_length(maps_url) <= 500
    and maps_url ~ '^https://(www\.google\.com|google\.com|www\.google\.co\.jp|maps\.google\.com|maps\.google\.co\.jp|maps\.app\.goo\.gl|goo\.gl)($|[/?#])'));
alter table public.pv_stay_places add constraint pv_stay_places_state_ck check (
  state in ('pending', 'public', 'rejected'));

alter table public.pv_stay_photos drop constraint if exists pv_stay_photos_hash_ck;
alter table public.pv_stay_photos drop constraint if exists pv_stay_photos_mime_ck;
alter table public.pv_stay_photos drop constraint if exists pv_stay_photos_state_ck;
alter table public.pv_stay_photos drop constraint if exists pv_stay_photos_body_ck;
alter table public.pv_stay_photos drop constraint if exists pv_stay_photos_size_ck;

alter table public.pv_stay_photos add constraint pv_stay_photos_hash_ck check (
  author_hash ~ '^[0-9a-f]{64}$');
alter table public.pv_stay_photos add constraint pv_stay_photos_mime_ck check (
  mime = 'image/jpeg');
alter table public.pv_stay_photos add constraint pv_stay_photos_state_ck check (
  state in ('pending', 'public', 'rejected'));
-- ★ JPEG だけ・50万バイトまで。常に JPEG へ焼き直して送るので、SVG のような
--   「絵の顔をした HTML」が原理的に入らない。
-- ★ 見送った写真（rejected）は画素を持たない。「見送り」と書いてあるのに
--   DB には残っている、を作らない。
-- ★ 「JPEG であること」は先頭3バイトでは見ない（2026-10-04 まではそれだけで、撮影情報が
--   入ったままの JPEG が通っていた）。中身の決まりは 3-j の2本
--   （pv_stay_photos_clean_ck・pv_stay_photos_dims_ck）が見る。あちらは 3-i の関数を
--   使うので、関数を作ったあとに付ける。
alter table public.pv_stay_photos add constraint pv_stay_photos_body_ck check (
  (state = 'rejected' and bytes is null and byte_len is null)
  or (state in ('pending', 'public')
      and bytes is not null
      and byte_len = octet_length(bytes)
      and byte_len between 100 and 500000));
alter table public.pv_stay_photos add constraint pv_stay_photos_size_ck check (
  (w is null or w between 1 and 8192) and (h is null or h between 1 and 8192));

create index if not exists pv_stay_places_where_idx
  on public.pv_stay_places (airline, iata);
create index if not exists pv_stay_places_iata_idx
  on public.pv_stay_places (iata) where kind = 'hotel';
create index if not exists pv_stay_places_author_idx
  on public.pv_stay_places (author_hash, created_at desc);
create index if not exists pv_stay_photos_place_idx
  on public.pv_stay_photos (place_id);
create index if not exists pv_stay_photos_author_idx
  on public.pv_stay_photos (author_hash, created_at desc);

comment on table public.pv_stay_places is
  '就航地のステイ情報（ホテル・食べる所・行く所）。user_id は持たず author_hash だけ。個票の直読みは不可。見てよいのは確認の印（profiles.verify_level >= 1）を持つ人と運営だけ。';
comment on column public.pv_stay_places.author_hash is
  '★ どの関数の返り値にも入れないこと。外へ出た瞬間に安定した仮名 ID になり、同じ人の投稿を束ねられる。';
comment on column public.pv_stay_places.state is
  '''pending'' は本人と運営にしか出ない。''public'' にできるのは運営だけで、自分の投稿は自分で公開できない。pending へ戻す関数は無い。';
comment on column public.pv_stay_places.created_at is
  '★ そのまま返さない。返すのは0〜4の段（age）だけ。ステイ先は乗務の記録と突き合わせやすい。';
comment on table public.pv_stay_photos is
  'ステイ情報の写真（1つの場所に何枚でも）。JPEG・50万バイトまで。運営が見るまで他人に出ない。見送った写真は画素を消す。';
comment on column public.pv_stay_photos.author_hash is
  '★ どの関数の返り値にも入れないこと。返すのは「自分のか」（mine）だけ。';


-- ════════════════════════════════════════════════════════════════
-- 2. 権限：表は誰にも触らせない
-- ════════════════════════════════════════════════════════════════
-- SELECT / INSERT / UPDATE / DELETE いずれのポリシーも作らない。
-- ＝ anon も authenticated も直接は1行も読めない・書けない。
alter table public.pv_stay_places enable row level security;
alter table public.pv_stay_photos enable row level security;

revoke all on public.pv_stay_places from public, anon, authenticated;
revoke all on public.pv_stay_photos from public, anon, authenticated;

-- 既に作ってしまったポリシーがあれば落とす（冪等・事故防止）
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
            where schemaname = 'public'
              and tablename in ('pv_stay_places', 'pv_stay_photos') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 3. 中でだけ使う部品（★どれも画面から呼べない）
-- ════════════════════════════════════════════════════════════════

-- 3-a. ハッシュ（サーバの中でしか作らない）
-- ⚠️ 画面から呼べるようにしない。自分の uid を入れて答え合わせできる関数を配ると、
--    どこかで漏れた1つのハッシュから本人を確かめる道ができる。
create or replace function public.pv_stay_hash(v_uid uuid)
returns text
language sql
immutable
set search_path = public, extensions
as $fn$
  select encode(extensions.digest(v_uid::text || '::pv_hotel::', 'sha256'), 'hex');
$fn$;

revoke all on function public.pv_stay_hash(uuid) from public, anon, authenticated;


-- 3-b. 確認の印（★サーバーだけが付ける。会員は書けない列）
-- ここが見るのは profiles.verify_level の1列だけ。
-- ★ access_until・badge・会社・職位を「ついでに」見ない。それを始めた日に、
--   給与を1件出しただけの人・プロフィールを書いただけの人が通るようになる。
-- ★ 土台の確かめ直し（毎回）。会員が verify_level を自分で書ける状態なら、その印はもう
--   「サーバーだけが付けた」ものではない ＝ **誰の印も信じない**（全員 false。運営は名簿で通る）。
--   冒頭の「0. 前提」は貼った瞬間しか見ない。あとから別の SQL が profiles の書き込みを
--   配り直すと、登録しただけの人が自分に印を付けてホテルの名前を読めてしまう
--   （2026-10-04 に手元で実際に通ることを確かめた）。直し方は db/admin.sql を貼り直すこと。
create or replace function public.pv_is_verified_pilot()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  select auth.uid() is not null
     and not has_column_privilege('authenticated', 'public.profiles', 'verify_level', 'UPDATE')
     and not has_column_privilege('authenticated', 'public.profiles', 'verify_level', 'INSERT')
     and not has_column_privilege('anon', 'public.profiles', 'verify_level', 'UPDATE')
     and not has_column_privilege('anon', 'public.profiles', 'verify_level', 'INSERT')
     and exists (select 1 from public.profiles p
                  where p.id = auth.uid()
                    and coalesce(p.verify_level, 0) >= 1);
$fn$;

-- ★ 誰にも配らない。security definer の関数の中からだけ呼ぶ（pv_is_operator と同じ作法）。
--   画面から呼べると「自分は確認済みか」をブラウザが覚えはじめ、それが門の代わりに使われる。
revoke all on function public.pv_is_verified_pilot() from public, anon, authenticated;

comment on function public.pv_is_verified_pilot() is
  'サーバーだけが付ける確認の印（profiles.verify_level >= 1）を、呼んだ本人が持っているか。security definer の中でだけ使う。';


-- 3-c. 門（★見てよいかの判定はここ1か所だけ）
-- 返すのは 'operator'（運営）／'pilot'（確認の印を持つ人）／null（どちらでもない）。
-- どの関数も最初にこれを呼び、null なら表を1行も読まずに返る。
create or replace function public.pv_stay_role()
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
begin
  if auth.uid() is null then
    return null;
  end if;
  if coalesce(public.pv_is_operator(), false) then
    return 'operator';
  end if;
  if coalesce(public.pv_is_verified_pilot(), false) then
    return 'pilot';
  end if;
  return null;
end;
$fn$;

revoke all on function public.pv_stay_role() from public, anon, authenticated;

comment on function public.pv_stay_role() is
  'ステイ情報を見てよい人か。''operator''／''pilot''／null。★判定はここ1か所。給与の鍵・バッジ・プロフィールは見ない。';


-- 3-d. 見えるかどうか（★この判定はここ1か所だけ。場所にも写真にも使う）
-- 運営は全部／自分のものは必ず／それ以外は 'public' だけ。
-- ★ どの引数が null でも null を返さない（「if not null」は素通りする＝見えてしまう）。
create or replace function public.pv_stay_visible(
  p_state text, p_author text, p_me text, p_op boolean)
returns boolean
language sql
immutable
set search_path = public, extensions
as $fn$
  select coalesce(p_op, false)
      or coalesce(p_author = p_me, false)
      or coalesce(p_state = 'public', false);
$fn$;

revoke all on function public.pv_stay_visible(text, text, text, boolean)
  from public, anon, authenticated;

comment on function public.pv_stay_visible(text, text, text, boolean) is
  '場所・写真が自分に見えるか。運営は全部／自分のものは必ず／それ以外は public だけ。';


-- 3-e. 投稿の時期（0〜4の段）
-- 0=1ヶ月以内 1=3ヶ月以内 2=6ヶ月以内 3=1年以内 4=それより前
-- ★ 切り方は**暦の月（UTC）**。「今月に書いた」が 0、1〜2か月前の月が 1、3〜5か月前の月が 2、
--   6〜11か月前の月が 3、それより前が 4。段が変わるのは毎月1日の UTC 0時だけで、
--   同じ月に書かれた行は全部いっしょに変わる。
-- ⚠️ 「書いた時刻からちょうど1か月」（now() - interval '1 month' との比較）に戻さない。
--    その形だと、段が 0 → 1 に変わる瞬間 ＝ 書いた時刻のちょうど1か月後なので、
--    一覧を何度か読むだけで書いた時刻が秒まで分かる（約束 7 がそのまま破れる。
--    2026-10-04 に手元で、境目の前後2秒で 0 → 1 に変わることを確かめた）。
-- ★ 上の5つの言い方は、どれも嘘にならない（「以内」は上限として正しい）。
--   月が変わった直後は、昨日書いた行も 1（3ヶ月以内）になる。粗いほうへ倒してある。
-- ★ 時計のずれで先の時刻が入っていても 0。
create or replace function public.pv_stay_age(p_at timestamptz)
returns int
language sql
stable
set search_path = public, extensions
as $fn$
  select case when x.m <= 0  then 0
              when x.m <= 2  then 1
              when x.m <= 5  then 2
              when x.m <= 11 then 3
              else 4 end
    from (select (extract(year  from now() at time zone 'utc')::int
                  - extract(year  from p_at at time zone 'utc')::int) * 12
               + (extract(month from now() at time zone 'utc')::int
                  - extract(month from p_at at time zone 'utc')::int) as m) x;
$fn$;

revoke all on function public.pv_stay_age(timestamptz) from public, anon, authenticated;


-- 3-f. uuid の読み取り（形が違えば null。例外を外へ出さない）
create or replace function public.pv_stay_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = public, extensions
as $fn$
begin
  if p is null
     or p !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return p::uuid;
exception when others then
  return null;
end;
$fn$;

revoke all on function public.pv_stay_uuid(text) from public, anon, authenticated;


-- 3-g. 地図のリンク（https で Google マップのホストだけ。それ以外は null）
-- 通すもの:
--   https://www.google.com/maps…   https://google.com/maps…   https://www.google.co.jp/maps…
--   https://maps.google.com（頭と /maps の下）  https://maps.google.co.jp（同じ）
--   https://maps.app.goo.gl/<記号>  https://goo.gl/maps/<記号>
-- ★ ホストは「// の直後から、最初の / ? # まで」を丸ごと取って**完全一致**で見る。
--   www.google.com.evil.example も www.google.com@evil.example も :8443 付きも落ちる。
-- ★ www.google.com は /maps の下だけ。/url?q=…（よそへ飛ばす口）を通さない。
--   「..」と「%2e」を落とすのは、ブラウザが /maps/../url を /url に畳むため。
-- ★ maps.google.com と maps.google.co.jp も「丸ごと地図」ではない。同じ /url?q=… が在る
--   （2026-10-04 までここは素通しで、https://maps.google.com/url?q=<よその場所> が
--   「Google マップのリンク」として保存できた）。通すのは 頭（/ と /?q=…）と /maps の下だけ。
-- ★ 空白・制御文字・引用符・山かっこ・バックスラッシュ・バッククォートが1つでもあれば捨てる。
create or replace function public.pv_stay_maps_url(p_url text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $fn$
declare
  v      text := btrim(coalesce(p_url, ''));
  m      text[];
  v_host text;
  v_rest text;
begin
  if char_length(v) < 12 or char_length(v) > 500 then
    return null;
  end if;
  if v ~ '[[:space:][:cntrl:]"''<>\\`]' or v ~ '　' then
    return null;
  end if;
  if v ~ '\.\.' or v ~* '%2e' then
    return null;
  end if;

  m := regexp_match(v, '^[Hh][Tt][Tt][Pp][Ss]://([A-Za-z0-9.-]+)($|[/?#].*$)');
  if m is null then
    return null;
  end if;
  v_host := lower(m[1]);
  v_rest := coalesce(m[2], '');

  if v_host in ('www.google.com', 'google.com', 'www.google.co.jp') then
    if v_rest !~ '^/maps($|[/?#])' then
      return null;
    end if;
  elsif v_host in ('maps.google.com', 'maps.google.co.jp') then
    -- 頭（空・/・?…・#…）か、/maps の下だけ。/url や /anything は落とす
    if v_rest !~ '^($|[?#]|/($|[?#])|/maps($|[/?#]))' then
      return null;
    end if;
  elsif v_host = 'maps.app.goo.gl' then
    if v_rest !~ '^/[A-Za-z0-9_-]+($|[/?#])' then
      return null;
    end if;
  elsif v_host = 'goo.gl' then
    if v_rest !~ '^/maps/[A-Za-z0-9_-]+($|[/?#])' then
      return null;
    end if;
  else
    return null;
  end if;

  return 'https://' || v_host || v_rest;
end;
$fn$;

revoke all on function public.pv_stay_maps_url(text) from public, anon, authenticated;

comment on function public.pv_stay_maps_url(text) is
  '地図のリンクを検品して返す。https で Google マップのホストだけ。それ以外は null（捨てる）。';

-- ★ 貼り直したとき、前から入っている行にも**いまの決まり**を当て直す
--   （決まりを厳しくした回のため。上の関数だけ直しても、保存済みのリンクは古いまま残る）。
--   通らなくなったリンクだけを捨てる。場所そのものは残る（約束 9）。何度流しても同じ。
update public.pv_stay_places
   set maps_url = public.pv_stay_maps_url(maps_url)
 where maps_url is not null
   and maps_url is distinct from public.pv_stay_maps_url(maps_url);


-- 3-h. 1件を画面へ返す形（★列を名指しで並べるのはここ1か所だけ）
-- ⚠️ to_jsonb(s) や s.* で返さない。author_hash と created_at がそのまま外へ出る。
-- 写真は、その人に見えるものだけを並べる（他人の確認前の写真は「在る」ことも出さない）。
-- ⚠️ 写真を足した順（created_at）に並べない。並びは id の順（＝乱数。何度読んでも同じ）。
--    足した順だと、自分の写真を先と後に置くだけで、あいだに入った他人の写真が
--    「いつからいつの間に足されたか」が分かる（約束 7。2026-10-04 に手元で確かめた）。
create or replace function public.pv_stay_place_json(
  s public.pv_stay_places, p_me text, p_op boolean)
returns jsonb
language sql
stable
set search_path = public, extensions
as $fn$
  select jsonb_build_object(
    'id',       s.id,
    'kind',     s.kind,
    'name',     s.name,
    'address',  s.address,
    'maps_url', s.maps_url,
    'note',     s.note,
    'age',      public.pv_stay_age(s.created_at),
    'mine',     coalesce(s.author_hash = p_me, false),
    'state',    s.state,
    'photos',   coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',    f.id,
               'mine',  coalesce(f.author_hash = p_me, false),
               'state', f.state)
             order by f.id)
        from public.pv_stay_photos f
       where f.place_id = s.id
         and public.pv_stay_visible(f.state, f.author_hash, p_me, p_op)
    ), '[]'::jsonb));
$fn$;

revoke all on function public.pv_stay_place_json(public.pv_stay_places, text, boolean)
  from public, anon, authenticated;


-- 3-i. 写真の撮影情報を、サーバーで必ず落とす（JPEG を節に分けて、決まった形に作り直す）
--
-- なぜ要るか
--   画面は端末のキャンバスで描き直してから送るが、関数を直接呼べばカメラの元ファイルが
--   そのまま届く。2026-10-04 までは先頭3バイトしか見ておらず、撮った場所（GPS）・日時・
--   機種の名前が入った JPEG がそのまま保存され、公開後は資格のある全員に渡る形だった。
--   ステイ先の写真でこれが出ると「いつ・どこに居たか」が分かる。
--   ＝ 端末の描き直しを保証にしない。**サーバーで作り直したものしか保存しない。**
--
-- 部品は4つ（どれも plpgsql・immutable・誰にも execute を配らない）
--   pv_jpeg_read(p)     本体。節を1つずつ読み、作り直した JPEG と幅・高さを返す
--   pv_jpeg_strip(p)    作り直した JPEG（読めない・決まりに合わないなら null）
--   pv_jpeg_is_clean(p) 「pv_jpeg_strip が出す形そのもの」か（表の CHECK に使う）
--   pv_jpeg_dims(p)     {幅, 高さ}（SOF から読む。送り手が言った w／h は信じない）
--   ★ 決まりを読むのは pv_jpeg_read の1か所だけ。残りの3つはそれを呼ぶだけ
--     ＝「作り直す側」と「形を確かめる側」が別の式になって食い違うことが無い。
--   ★ 同じ目的の部品を2つ置かない。前に在った pv_stay_jpeg_clean（頭の APPn から
--     JFIF・ICC・Adobe の3種を残す形）は消した（この節の末尾で drop）。
--     2つ残すと、どちらを通ったか分からない行ができる。
--
-- 作り直した JPEG の形（これ以外は1バイトも出ない）
--   SOI → **ここで書く決まった JFIF 頭（18バイト・毎回同じ）**
--       → DQT／DHT／DRI／SOF0・SOF1・SOF2 のどれか1つ／SOS＋符号データ（RST0〜7 を含む）
--         を**元の順のまま・1バイトも変えずに** → EOI
--
-- 落とすもの
--   APP0〜APP15 の全部（Exif・XMP・ICC・IPTC・MPF・Adobe・**元の JFIF も**）／COM／
--   EOI より後ろ全部／節の前の詰め物の FF。
--   ★ JFIF はここで書き直すので、頭に送り手の字は1バイトも残らない
--     （元の JFIF は版・密度・縮小画像を持てる＝字の置き場になる）。
--
-- 拒否するもの（null。呼ぶ側が image_bad にする）
--   SOI で始まらない／SOF が無い・2つ以上・SOS より後ろ／SOF3・SOF5〜7・SOF9〜15
--   （ロスレス・階層・算術符号）／DAC／DNL／JPGn・TEM・DHP・EXP など知らない節／
--   成分の数が 1 でも 3 でもない／幅か高さが 0・8,192 を超える／SOS が1つも無い／
--   EOI に届かずに終わる／節の長さが 2 未満・ファイルをはみ出す／節のあいだにゴミ／
--   **節の長さが中身と合わない**（余りに字を隠せるので、余りを1バイトも許さない）:
--     DQT … 65 か 129 バイトの表がぴったり並ぶ
--     DHT … 「17 ＋ 符号の数の合計」の表がぴったり並ぶ（合計は 256 まで）
--     SOF … 8 + 3×成分数／SOS … 6 + 2×成分数／DRI … 4
--
-- ★ 決めに足したもの（どれも「復号する側が読み飛ばす＝字を置ける所」を閉じるため。
--    並びは libjpeg が受け付ける範囲に合わせてある）
--   ・SOF の精度は 8 だけ／間引きは 1〜4／表の番号は 0〜3／成分の名前の重なりは不可
--   ・SOS の成分は枠に在るものだけ・重なり不可／表の番号は 0〜3
--     逐次（SOF0・SOF1）は Ss=0・Se=63・Ah=Al=0 だけ
--     段階的（SOF2）は Ss=0 なら Se=0／それ以外は Ss≦Se≦63 で成分1つ／
--     Ah≠0 なら Al=Ah−1／Al≦13
--   ・符号データが空の走査は不可
--   ・RST は DRI で間隔を決めてあるときだけ・番号は走査ごとに 0→7 の順
--   ・節は全部で 1,000 個まで（本物の写真は 100 個に届かない。上限が無いと、
--     2バイトの節を何万個も並べた入力で1回の呼び出しが何秒も回る）
--   ・★ 使われない表を受けない（2026-10-04 に自分で破って足した。表の中身は復号する側が
--     読まなければ何でも書ける＝ 1つの節に同じ番号の表を何百個も並べて字を運べた）
--       量子化表 … 同じ番号を2回定義しない／枠（SOF）が使う番号とちょうど同じ集まり
--       ハフマン表 … 定義したら、次に同じ表を定義するまで・ファイルが終わるまでに、
--                    どれかの走査が使っている
--   ・★ 符号データの中の余分な FF（FF FF 00・FF FF RSTn）を受けない
--     （復号する側は読み飛ばす＝ FF の本数で字を運べた。本物の符号器はこれを出さない）
--
-- ⚠️ 色の読み方が変わってしまうものは、落とさずに拒否する
--   頭を落として JFIF を書くと、復号する側は「3成分 ＝ YCbCr」と読む。元が
--     a) Adobe の頭（APP14）が「RGB のまま」（transform=0）と言っている
--     b) 成分の名前が R・G・B（JFIF も Adobe も無いとき、これで RGB と読む復号器がある）
--   のどちらかなら、作り直すと色が化ける。化けた絵を黙って保存しない＝ null。
--   （キャンバスの出力・カメラの JPEG はどちらにも当たらない）
--
-- ⚠️ ここで落とせないもの（正直に書く）
--   ・画素に写り込んだもの。
--   ・**符号データの中身と、その後ろに足されたバイト。** 復号しない限り、
--     どこまでが絵でどこからが足し物かは分からない（FF を含まない字なら、最後の走査の
--     後ろに足しても通る）。使われている量子化表・ハフマン表の中身（数字の並び）も同じ
--     （1つの表で 64〜256 バイト）。
--     落とせるのは「撮影情報・付帯情報の節」「節の余り」「EOI の後ろ」「節のあいだ」
--     「使われない表」。
--     ＝ カメラやアプリが**勝手に付ける**情報は全部落ちる。**わざと作り込んだもの**は
--       人が1回見る（約束 5）ことでしか止まらない。
--   ・ICC（色の決まり）も落とすので、sRGB でない写真を画面を通さずに送ると色が少し変わる。
--     Exif の「向き」も落ちるので、横倒しのまま保存される。
--     どちらも画面の描き直しを通れば起きない（キャンバスが sRGB・正しい向きで描き直す）。
--
-- ⚠️ 作り直すと、元より最大 18 バイト増えることがある（元に JFIF 頭が無いとき）。
--   **50万バイトの上限は、作り直したあとの長さで測る。**
-- ⚠️ 速さ: 50万バイトの写真1枚で 10〜20 ミリ秒ほど（手元の PGlite）。1バイトずつ回す形に戻さない。


-- ── 1. 本体: 節を1つずつ読み、作り直した JPEG と幅・高さを返す ──────────
-- 返り値: (body, w, h)。読めない・決まりに合わないなら3つとも null。例外を外へ投げない。
-- ★ 1バイトずつ回さない（50万バイトで遅い）。
--     節 …… 長さを読んで次の節へ飛ぶ
--     符号データ … position() で次の FF まで塊で飛ぶ（FF は平均 256 バイトに1つ）
--     FF の並び … btrim() で並びの長さを1回で測る
--   ltrim(bytea, bytea) は使わない（PostgreSQL 14 から。btrim は昔から在る）。
-- ★ 残す節は、元のバイト列の**続いている範囲ごと**にまとめて写す（v_ks が範囲の頭）。
--   描き直し済みの写真なら「頭の後ろから EOI の前まで」の1回で済む。
create or replace function public.pv_jpeg_read(
  p        bytea,
  out body bytea,
  out w    integer,
  out h    integer
)
language plpgsql
immutable
set search_path = public, extensions
as $fn$
declare
  -- 作り直しの頭（SOI ＋ JFIF 1.01・単位なし 1:1・縮小画像なし）。★毎回これと同じ18バイト
  c_head    constant bytea   := '\xffd8ffe000104a46494600010100000100010000';
  c_side    constant integer := 8192;   -- 幅・高さの上限
  c_segs    constant integer := 1000;   -- 節の数の上限
  c_win     constant integer := 1024;   -- 符号データを飛ぶ幅
  v       bytea;
  v_n     integer;                -- 全体の長さ
  v_i     integer := 2;           -- いま見ている場所（0 から数える）
  v_m     integer;                -- 節の番号
  v_l     integer;                -- 節が言っている長さ（長さの2バイトを含む）
  v_e     integer;                -- 節の終わり（その次の場所）
  v_j     integer;
  v_k     integer;
  v_q     integer;
  v_r     integer;                -- FF の並びの長さ
  v_c     integer;
  v_t     integer;
  v_a     integer;
  v_chunk bytea;
  v_out   bytea;
  v_ks    integer := -1;          -- 残す範囲の頭（-1 ＝ 開いていない）
  v_segs  integer := 0;
  v_sof   integer := 0;           -- 192／193／194（0 ＝ まだ見ていない）
  v_nf    integer := 0;           -- 成分の数
  v_cid   integer[] := '{}';      -- 成分の名前
  v_seen  integer[];
  v_ns    integer;
  v_scans integer := 0;
  v_ri    integer := 0;           -- DRI の間隔（0 ＝ RST は来ない）
  v_rst   integer;
  v_adobe0 boolean := false;      -- Adobe の頭が「RGB のまま」と言っていた
  v_dq    integer[] := '{}';      -- 定義された量子化表の番号
  v_tq    integer[] := '{}';      -- 枠（SOF）が使う量子化表の番号
  v_dh    integer[] := '{}';      -- 定義されて、まだどの走査にも使われていないハフマン表（種類×16＋番号）
  v_w     integer;
  v_h     integer;
begin
  if p is null then
    return;
  end if;
  -- ★ 手元に素の写しを1つ作る。表から来た値（TOAST）をそのまま get_byte すると、
  --   呼ぶたびに取り出し直しになる
  v   := p || ''::bytea;
  v_n := octet_length(v);
  if v_n < 4 or get_byte(v, 0) <> 255 or get_byte(v, 1) <> 216 then
    return;                                   -- SOI で始まらない
  end if;
  v_out := c_head;

  loop
    -- 節の頭（FF ＋ 番号）。足りなければ「EOI に届かずに終わった」
    if v_i + 1 >= v_n or get_byte(v, v_i) <> 255 then
      return;                                 -- 切れている／節のあいだにゴミ
    end if;
    v_m := get_byte(v, v_i + 1);

    if v_m = 255 then
      -- 詰め物の FF。残している範囲をここで閉じ、並びの最後の FF まで飛ぶ
      if v_ks >= 0 then
        v_out := v_out || substring(v from v_ks + 1 for v_i - v_ks);
        v_ks  := -1;
      end if;
      v_r := 2;
      loop
        v_chunk := substring(v from v_i + v_r + 1 for 256);
        v_t := octet_length(v_chunk);
        exit when v_t = 0;
        v_q := v_t + 1 - octet_length(btrim(v_chunk || '\x00'::bytea, '\xff'::bytea));
        v_r := v_r + v_q;
        exit when v_q < v_t;
      end loop;
      v_i := v_i + v_r - 1;
      continue;                               -- 次の周で「FF ＋ 番号」として読み直す
    end if;

    v_segs := v_segs + 1;
    if v_segs > c_segs then
      return;                                 -- 節が多すぎる
    end if;

    if v_m = 217 then
      -- EOI。ここで終わり。後ろは見ない＝捨てる
      if v_sof = 0 or v_scans = 0 then
        return;                               -- SOF が無い／SOS が無い
      end if;
      if not (v_dq <@ v_tq and v_tq <@ v_dq) or cardinality(v_dh) > 0 then
        return;                               -- 使われない表が在る／枠が使う量子化表が無い
      end if;
      if v_nf = 3 and (v_adobe0 or (v_cid[1] = 82 and v_cid[2] = 71 and v_cid[3] = 66)) then
        return;                               -- 頭を落とすと色が化ける
      end if;
      if v_ks >= 0 then
        v_out := v_out || substring(v from v_ks + 1 for v_i - v_ks);
      end if;
      body := v_out || '\xffd9'::bytea;
      w    := v_w;
      h    := v_h;
      return;
    end if;

    -- 長さを持たない番号（00・TEM・RST・SOI）と、使われない番号（02〜BF）
    if v_m < 192 or (v_m >= 208 and v_m <= 216) then
      return;
    end if;

    if v_i + 3 >= v_n then
      return;
    end if;
    v_l := get_byte(v, v_i + 2) * 256 + get_byte(v, v_i + 3);
    v_e := v_i + 2 + v_l;
    if v_l < 2 or v_e > v_n then
      return;                                 -- 長さが 2 未満／ファイルをはみ出す
    end if;

    if (v_m >= 224 and v_m <= 239) or v_m = 254 then
      -- ── APPn・COM: 落とす（中身は1バイトも写さない）
      if v_ks >= 0 then
        v_out := v_out || substring(v from v_ks + 1 for v_i - v_ks);
        v_ks  := -1;
      end if;
      -- Adobe の頭（"Adobe" ＋ 7バイト以上。12バイト目が色の変換の印）だけ覗く
      if v_m = 238 and v_l >= 14
         and substring(v from v_i + 5 for 5) = '\x41646f6265'::bytea
         and get_byte(v, v_i + 15) = 0 then
        v_adobe0 := true;
      end if;
      v_i := v_e;
      continue;
    end if;

    -- ここから下は残す節。範囲が開いていなければ開く
    if v_ks < 0 then
      v_ks := v_i;
    end if;

    if v_m = 219 then
      -- ── DQT: [精度(0/1)・番号(0〜3)] ＋ 64 か 128 バイト、がぴったり並ぶ
      if v_l = 2 then
        return;
      end if;
      v_j := v_i + 4;
      while v_j < v_e loop
        v_c := get_byte(v, v_j);
        if v_c > 31 or (v_c & 15) > 3 then
          return;
        end if;
        if (v_c & 15) = any (v_dq) then
          return;                             -- 同じ番号の量子化表を重ねて定義している
        end if;
        v_dq := v_dq || (v_c & 15);
        v_j := v_j + 65 + 64 * (v_c >> 4);
      end loop;
      if v_j <> v_e then
        return;                               -- 余りがある／表が途中まで
      end if;
      v_i := v_e;

    elsif v_m = 196 then
      -- ── DHT: [種類(0/1)・番号(0〜3)] ＋ 長さごとの数 16 バイト ＋ その合計ぶんの符号
      if v_l = 2 then
        return;
      end if;
      v_j := v_i + 4;
      while v_j < v_e loop
        if v_j + 17 > v_e then
          return;
        end if;
        v_c := get_byte(v, v_j);
        if v_c > 31 or (v_c & 15) > 3 then
          return;
        end if;
        v_t := get_byte(v, v_j + 1)  + get_byte(v, v_j + 2)  + get_byte(v, v_j + 3)  + get_byte(v, v_j + 4)
             + get_byte(v, v_j + 5)  + get_byte(v, v_j + 6)  + get_byte(v, v_j + 7)  + get_byte(v, v_j + 8)
             + get_byte(v, v_j + 9)  + get_byte(v, v_j + 10) + get_byte(v, v_j + 11) + get_byte(v, v_j + 12)
             + get_byte(v, v_j + 13) + get_byte(v, v_j + 14) + get_byte(v, v_j + 15) + get_byte(v, v_j + 16);
        if v_t > 256 then
          return;
        end if;
        if v_c = any (v_dh) then
          return;                             -- 使われる前に、同じハフマン表をもう一度定義している
        end if;
        v_dh := v_dh || v_c;
        v_j := v_j + 17 + v_t;
      end loop;
      if v_j <> v_e then
        return;
      end if;
      v_i := v_e;

    elsif v_m = 221 then
      -- ── DRI: 4 バイトちょうど
      if v_l <> 4 then
        return;
      end if;
      v_ri := get_byte(v, v_i + 4) * 256 + get_byte(v, v_i + 5);
      v_i  := v_e;

    elsif v_m = 192 or v_m = 193 or v_m = 194 then
      -- ── SOF0／SOF1／SOF2: 1つだけ・最初の SOS より前
      --    （SOS は SOF が無いと通らないので、「SOS より後ろの SOF」は必ず2つ目になる）
      if v_sof <> 0 or v_l < 8 then
        return;
      end if;
      v_nf := get_byte(v, v_i + 9);
      if (v_nf <> 1 and v_nf <> 3) or v_l <> 8 + 3 * v_nf then
        return;
      end if;
      if get_byte(v, v_i + 4) <> 8 then
        return;                               -- 精度は 8 だけ
      end if;
      v_h := get_byte(v, v_i + 5) * 256 + get_byte(v, v_i + 6);
      v_w := get_byte(v, v_i + 7) * 256 + get_byte(v, v_i + 8);
      if v_w < 1 or v_h < 1 or v_w > c_side or v_h > c_side then
        return;
      end if;
      for v_a in 0 .. v_nf - 1 loop
        v_c := get_byte(v, v_i + 10 + 3 * v_a);
        if v_c = any (v_cid) then
          return;                             -- 成分の名前が重なっている
        end if;
        v_cid := v_cid || v_c;
        v_t := get_byte(v, v_i + 11 + 3 * v_a);
        if (v_t >> 4) < 1 or (v_t >> 4) > 4 or (v_t & 15) < 1 or (v_t & 15) > 4 then
          return;                             -- 間引きは 1〜4
        end if;
        if get_byte(v, v_i + 12 + 3 * v_a) > 3 then
          return;                             -- 量子化表の番号は 0〜3
        end if;
        v_tq := v_tq || get_byte(v, v_i + 12 + 3 * v_a);
      end loop;
      v_sof := v_m;
      v_i   := v_e;

    elsif v_m = 218 then
      -- ── SOS ＋ 符号データ
      if v_sof = 0 or v_l < 6 then
        return;                               -- SOS の前に SOF が無い
      end if;
      v_ns := get_byte(v, v_i + 4);
      if v_ns < 1 or v_ns > v_nf or v_l <> 6 + 2 * v_ns then
        return;
      end if;
      v_seen := '{}';
      for v_a in 0 .. v_ns - 1 loop
        v_c := get_byte(v, v_i + 5 + 2 * v_a);
        if not (v_c = any (v_cid)) or v_c = any (v_seen) then
          return;                             -- 枠に無い成分／同じ成分が2回
        end if;
        v_seen := v_seen || v_c;
        v_t := get_byte(v, v_i + 6 + 2 * v_a);
        if (v_t >> 4) > 3 or (v_t & 15) > 3 then
          return;
        end if;
      end loop;
      -- 末尾の3バイト（Ss・Se・Ah/Al）。復号する側が読み飛ばす値を許さない
      v_c := get_byte(v, v_e - 3);            -- Ss
      v_q := get_byte(v, v_e - 2);            -- Se
      v_t := get_byte(v, v_e - 1);            -- Ah（上4ビット）・Al（下4ビット）
      if v_sof = 194 then
        if v_c = 0 then
          if v_q <> 0 then
            return;
          end if;
        elsif v_c > v_q or v_q > 63 or v_ns <> 1 then
          return;
        end if;
        if (v_t >> 4) <> 0 and (v_t & 15) <> (v_t >> 4) - 1 then
          return;
        end if;
        if (v_t & 15) > 13 then
          return;
        end if;
      elsif v_c <> 0 or v_q <> 63 or v_t <> 0 then
        return;
      end if;
      -- この走査が使うハフマン表を「使われた」にする
      --   逐次 … DC と AC の両方／段階的 … Ss=0 なら DC（Ah=0 のときだけ）・それ以外は AC
      for v_a in 0 .. v_ns - 1 loop
        v_j := get_byte(v, v_i + 6 + 2 * v_a);
        if v_sof <> 194 or (v_c = 0 and (v_t >> 4) = 0) then
          v_dh := array_remove(v_dh, v_j >> 4);
        end if;
        if v_sof <> 194 or v_c <> 0 then
          v_dh := array_remove(v_dh, 16 + (v_j & 15));
        end if;
      end loop;
      v_scans := v_scans + 1;

      -- 符号データ。FF の次が 00（詰め物）か D0〜D7（RST）なら続き。
      -- FF の並びは詰め物。並びの次がそれ以外なら、並びの頭が次の節。
      v_k   := v_e;
      v_rst := 0;
      loop
        if v_k >= v_n then
          return;                             -- EOI に届かずに終わる
        end if;
        if get_byte(v, v_k) <> 255 then
          v_q := position('\xff'::bytea in substring(v from v_k + 2 for c_win));
          if v_q = 0 then
            v_k := v_k + 1 + c_win;           -- この幅に FF は無かった
            continue;
          end if;
          v_k := v_k + v_q;
        end if;
        -- v_k は FF の場所
        if v_k + 1 >= v_n then
          return;                             -- FF で終わる
        end if;
        v_r := 1;
        v_c := get_byte(v, v_k + 1);
        if v_c = 255 then
          v_r := 2;
          loop
            v_chunk := substring(v from v_k + v_r + 1 for 256);
            v_t := octet_length(v_chunk);
            exit when v_t = 0;
            v_q := v_t + 1 - octet_length(btrim(v_chunk || '\x00'::bytea, '\xff'::bytea));
            v_r := v_r + v_q;
            exit when v_q < v_t;
          end loop;
          if v_k + v_r >= v_n then
            return;                           -- FF の並びのまま終わる
          end if;
          v_c := get_byte(v, v_k + v_r);
        end if;
        if v_r > 1 and (v_c = 0 or (v_c >= 208 and v_c <= 215)) then
          return;                             -- 符号データの中に余分な FF（FF FF 00・FF FF RST）
        end if;
        if v_c = 0 then
          v_k := v_k + v_r + 1;
        elsif v_c >= 208 and v_c <= 215 then
          if v_ri = 0 or v_c <> 208 + (v_rst & 7) then
            return;                           -- 間隔を決めていない RST／順番が違う
          end if;
          v_rst := v_rst + 1;
          v_k   := v_k + v_r + 1;
        else
          exit;                               -- v_k から次の節（詰め物の FF を含む）
        end if;
      end loop;
      if v_k = v_e then
        return;                               -- 符号データが空
      end if;
      v_i := v_k;

    else
      -- SOF3・SOF5〜7・JPG・SOF9〜15・DAC・DNL・DHP・EXP・JPGn
      return;
    end if;
  end loop;
exception when others then
  -- 命綱。上の検査が正しければここへは来ない（来ても null で返す。例外を外へ投げない）
  body := null;
  w    := null;
  h    := null;
  return;
end;
$fn$;

revoke all on function public.pv_jpeg_read(bytea) from public, anon, authenticated;

comment on function public.pv_jpeg_read(bytea) is
  'JPEG を節に分けて読み、撮影情報を落として作り直したもの（body）と幅・高さを返す。読めない・決まりに合わないなら3つとも null。画素の符号データは1バイトも変えない。';


-- ── 2. 作り直した JPEG を返す ─────────────────────────────────
create or replace function public.pv_jpeg_strip(p bytea)
returns bytea
language plpgsql
immutable
set search_path = public, extensions
as $fn$
declare
  v_r record;
begin
  v_r := public.pv_jpeg_read(p);
  return v_r.body;
end;
$fn$;

revoke all on function public.pv_jpeg_strip(bytea) from public, anon, authenticated;

comment on function public.pv_jpeg_strip(bytea) is
  'JPEG から撮影情報・付帯情報（APPn 全部・COM・EOI の後ろ・節の余り）を落として作り直す。頭は決まった JFIF。JPEG として読めない・決まりに合わないなら null。';


-- ── 3. 「作り直しの形そのもの」か ─────────────────────────────
-- ★ 作り直してみて、1バイトも変わらなければ true。式を別に持たない
--   ＝ pv_jpeg_is_clean(pv_jpeg_strip(x)) は必ず true・pv_jpeg_strip を2回掛けても同じ。
-- ★ null は false（CHECK は null を通すので、ここで閉じておく）。
-- ⚠️ 表の CHECK に使うとき: CHECK は**行を入れる役**の権限で評価される。
--    この関数は誰にも配っていないので、行を入れるのは security definer の関数からだけにする
--    （pv_stay_photos は表を閉じてあり、出入口は security definer だけ＝そのまま使える）。
create or replace function public.pv_jpeg_is_clean(p bytea)
returns boolean
language plpgsql
immutable
set search_path = public, extensions
as $fn$
begin
  if p is null then
    return false;
  end if;
  return coalesce(public.pv_jpeg_strip(p) = p, false);
end;
$fn$;

revoke all on function public.pv_jpeg_is_clean(bytea) from public, anon, authenticated;

comment on function public.pv_jpeg_is_clean(bytea) is
  'pv_jpeg_strip が出す形そのもの（決まった JFIF 頭・APPn と COM なし・節の余りなし・EOI がちょうど末尾）なら true。表の CHECK 用。';


-- ── 4. 幅と高さ（SOF から読む。送り手が言った w／h は信じない） ──────
-- 返り値: {幅, 高さ}。pv_jpeg_strip が null を返す入力なら null。
-- ★ 保存するときは pv_jpeg_read を1回呼べば body・w・h が一度に取れる（pv_stay_photo_add がそうしている）。
create or replace function public.pv_jpeg_dims(p bytea)
returns integer[]
language plpgsql
immutable
set search_path = public, extensions
as $fn$
declare
  v_r record;
begin
  v_r := public.pv_jpeg_read(p);
  if v_r.body is null then
    return null;
  end if;
  return array[v_r.w, v_r.h];
end;
$fn$;

revoke all on function public.pv_jpeg_dims(bytea) from public, anon, authenticated;

comment on function public.pv_jpeg_dims(bytea) is
  'JPEG の {幅, 高さ} を SOF から読む。pv_jpeg_strip が受けない入力なら null。';


-- ── 5. 前の部品を消す（同じ目的の部品を2つ残さない） ────────────────────
drop function if exists public.pv_stay_jpeg_clean(bytea);


-- 3-j. 写真の表の決まり（★ 3-i の関数を使うので、表を作る節ではなくここで付ける）
-- 関数を通さずに表へ入れる道（表の持ち主が直接 INSERT する・あとから別の SQL が行を足す）も、
-- ここで閉じる。保存してよいのは「サーバーで作り直した形そのもの」だけで、
-- 幅と高さは写真そのものから読んだ値とちょうど同じでなければならない。
--   pv_stay_photos_clean_ck … 撮影情報入り・末尾に付け足しのある JPEG・JPEG でないものは入らない
--   pv_stay_photos_dims_ck  … w・h に嘘の値を入れられない（画素が在る行は w・h も必ず在る）
-- ★ 見送った写真（bytes が null）は対象の外。w・h は入れたときの値のまま残る。
-- ★ 流し直せる形（落として付け直す）。付け直すとき、いま在る行を全部読み直して確かめる
--   ＝ 決まりに合わない行が在れば、ここで止まる（黙って残さない）。
--   そのときは先に update … set bytes = public.pv_jpeg_strip(bytes) で作り直すか、行を消す。
-- ⚠️ CHECK は**行を入れる役**の権限で評価される。この2本の関数は誰にも配っていないので、
--    行を入れるのは security definer の関数からだけにする（表は閉じてある＝いまの形のまま）。
alter table public.pv_stay_photos drop constraint if exists pv_stay_photos_clean_ck;
alter table public.pv_stay_photos drop constraint if exists pv_stay_photos_dims_ck;

alter table public.pv_stay_photos add constraint pv_stay_photos_clean_ck check (
  bytes is null or public.pv_jpeg_is_clean(bytes));
alter table public.pv_stay_photos add constraint pv_stay_photos_dims_ck check (
  bytes is null
  or (w is not null and h is not null and array[w, h] = public.pv_jpeg_dims(bytes)));


-- ════════════════════════════════════════════════════════════════
-- 4. 読む（会社 × 空港の一覧）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {airline:'etihad', iata:'NRT'}
-- 返り値:
--   資格なし → {ok:true, state:'locked'}            ★これだけ。表を読む前に返す
--   資格あり → {ok:true, state:'open', can_add, is_operator,
--               places:[{id, kind, name, address, maps_url, note, age, mine, state,
--                        photos:[{id, mine, state}]}],
--               others:[{airline, places:[…]}]}
--   引数が変 → {ok:false, status:'bad_airline'|'bad_iata'}（資格のある人にだけ返る）
-- others は「同じ空港で他社が使うホテル」。kind='hotel' だけ。食べる所・行く所は出さない。
-- can_add は、その会社がいまも名簿で有効なとき true。
-- ★ 並びは 種類 → 名前。時刻で並べない（約束 7）。
-- ★ 未ログイン（anon）にも配ってある。返るのは locked の1行だけで、
--   配らないと画面は「権限エラー」と「鍵が掛かっている」を見分けられない。
create or replace function public.pv_stays(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_role   text;
  v_op     boolean;
  v_me     text;
  v_air    text;
  v_iata   text;
  v_active boolean;
  v_places jsonb;
  v_others jsonb;
begin
  v_role := public.pv_stay_role();
  if v_role is null then
    return jsonb_build_object('ok', true, 'state', 'locked');
  end if;
  v_op := (v_role = 'operator');
  v_me := public.pv_stay_hash(auth.uid());

  v_air := lower(btrim(coalesce(p->>'airline', '')));
  select a.active into v_active from public.pv_airlines a
   where a.code = v_air and a.code <> 'other';
  if not found then
    return jsonb_build_object('ok', false, 'status', 'bad_airline');
  end if;

  v_iata := btrim(coalesce(p->>'iata', ''));
  if v_iata !~ '^[A-Za-z]{3}$' then
    return jsonb_build_object('ok', false, 'status', 'bad_iata');
  end if;
  v_iata := upper(v_iata);

  select coalesce(jsonb_agg(z.j order by z.k, z.n, z.id), '[]'::jsonb)
    into v_places
    from (
      select public.pv_stay_place_json(s, v_me, v_op) as j,
             case s.kind when 'hotel' then 0 when 'food' then 1 else 2 end as k,
             lower(s.name) as n, s.id
        from public.pv_stay_places s
       where s.airline = v_air and s.iata = v_iata
         and public.pv_stay_visible(s.state, s.author_hash, v_me, v_op)
       order by 2, 3, 4
       limit 200
    ) z;

  select coalesce(jsonb_agg(jsonb_build_object('airline', g.airline, 'places', g.places)
                            order by g.airline), '[]'::jsonb)
    into v_others
    from (
      select z.airline, jsonb_agg(z.j order by z.n, z.id) as places
        from (
          select s.airline,
                 public.pv_stay_place_json(s, v_me, v_op) as j,
                 lower(s.name) as n, s.id
            from public.pv_stay_places s
           where s.iata = v_iata and s.airline <> v_air and s.kind = 'hotel'
             and public.pv_stay_visible(s.state, s.author_hash, v_me, v_op)
           order by 1, 3, 4
           limit 200
        ) z
       group by z.airline
    ) g;

  return jsonb_build_object(
    'ok', true, 'state', 'open',
    'can_add', coalesce(v_active, false),
    'is_operator', v_op,
    'places', v_places,
    'others', v_others);
end;
$fn$;

revoke all on function public.pv_stays(jsonb) from public;
grant execute on function public.pv_stays(jsonb) to anon, authenticated;

comment on function public.pv_stays(jsonb) is
  '会社 × 空港のステイ情報。確認の印（profiles.verify_level >= 1）を持つ人と運営にだけ中身を返す。それ以外には {ok:true, state:''locked''} だけ（名前も件数も返さない）。author_hash と時刻は返さない。';


-- ════════════════════════════════════════════════════════════════
-- 5. 足す（場所）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {airline, iata, kind:'hotel'|'food'|'spot', name, address, maps_url, note}
-- 返り値: {ok:true, item:{…一覧と同じ形…}}。入った時点では state:'pending'。
-- 弾いたときは例外ではなく {ok:false, status:…} を返す（画面は理由ごとに違う一言を出す）。
--   locked        資格が無い（★何も調べずに返す）
--   bad_airline   名簿に無い・無効・'other'
--   bad_iata      英字3字でない
--   bad_kind      白リストの外
--   bad_name      名前が2〜80字でない
--   too_long      住所が200字・メモが500字を超える
--   too_fast      30秒以内の連投
--   rate_limited  24時間に20件
--   duplicate     自分が同じ名前を既に出している
--   exists        同じ名前が既に**公開済み**
-- ★ exists は公開済みの行だけを見る。他人の確認前の行と比べない
--   （比べると「誰かがそのホテルを出したところだ」が分かってしまう）。
-- ★ 地図のリンクが通らなくても投稿は通す（リンクだけ捨てる）。
create or replace function public.pv_stay_add(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_role text;
  v_me   text;
  v_air  text;
  v_iata text;
  v_kind text;
  v_name text;
  v_addr text;
  v_note text;
  v_url  text;
  v_n    int;
  v_row  public.pv_stay_places%rowtype;
begin
  v_role := public.pv_stay_role();
  if v_role is null then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  v_me := public.pv_stay_hash(auth.uid());

  v_air := lower(btrim(coalesce(p->>'airline', '')));
  if v_air = 'other' or not exists (
       select 1 from public.pv_airlines a where a.code = v_air and a.active) then
    return jsonb_build_object('ok', false, 'status', 'bad_airline');
  end if;

  v_iata := btrim(coalesce(p->>'iata', ''));
  if v_iata !~ '^[A-Za-z]{3}$' then
    return jsonb_build_object('ok', false, 'status', 'bad_iata');
  end if;
  v_iata := upper(v_iata);

  v_kind := coalesce(p->>'kind', '');
  if v_kind not in ('hotel', 'food', 'spot') then
    return jsonb_build_object('ok', false, 'status', 'bad_kind');
  end if;

  -- ★ 名前と住所は1行にそろえる（改行・タブ・全角空白・連続した空白を1つの空白に）。
  --   trim が先。空白だけの名前と、前後の空白ぶんだけ長い名前を同時に潰す。
  v_name := btrim(regexp_replace(coalesce(p->>'name', ''), '[[:space:][:cntrl:]　]+', ' ', 'g'));
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'status', 'bad_name');
  end if;

  v_addr := nullif(btrim(regexp_replace(coalesce(p->>'address', ''), '[[:space:][:cntrl:]　]+', ' ', 'g')), '');
  if char_length(v_addr) > 200 then
    return jsonb_build_object('ok', false, 'status', 'too_long');
  end if;

  -- メモは改行を残す（前後だけ落とす）
  v_note := nullif(btrim(coalesce(p->>'note', ''), E' \t\r\n　'), '');
  if char_length(v_note) > 500 then
    return jsonb_build_object('ok', false, 'status', 'too_long');
  end if;

  v_url := public.pv_stay_maps_url(p->>'maps_url');

  -- 同じ人の同時の2本を1列に並べる（連投の数え方をすり抜けさせない）
  perform pg_advisory_xact_lock(hashtextextended('pv_stay:' || v_me, 0));

  -- 連投（30秒）
  if exists (select 1 from public.pv_stay_places
              where author_hash = v_me and created_at > now() - interval '30 seconds') then
    return jsonb_build_object('ok', false, 'status', 'too_fast');
  end if;

  -- 1日の上限（1つの街でホテル1つ＋店をいくつか、を数回ぶん）
  select count(*) into v_n from public.pv_stay_places
   where author_hash = v_me and created_at > now() - interval '24 hours';
  if v_n >= 20 then
    return jsonb_build_object('ok', false, 'status', 'rate_limited');
  end if;

  -- 自分の重ね出し（見送られたものは数えない＝出し直せる）
  if exists (select 1 from public.pv_stay_places
              where author_hash = v_me and airline = v_air and iata = v_iata
                and kind = v_kind and lower(name) = lower(v_name)
                and state <> 'rejected') then
    return jsonb_build_object('ok', false, 'status', 'duplicate');
  end if;

  -- 既に公開されている同じ名前（★公開済みだけ。他人の確認前の行とは比べない）
  if exists (select 1 from public.pv_stay_places
              where airline = v_air and iata = v_iata
                and kind = v_kind and lower(name) = lower(v_name)
                and state = 'public') then
    return jsonb_build_object('ok', false, 'status', 'exists');
  end if;

  insert into public.pv_stay_places
    (author_hash, airline, iata, kind, name, address, maps_url, note)
  values (v_me, v_air, v_iata, v_kind, v_name, v_addr, v_url, v_note)
  returning * into v_row;

  return jsonb_build_object('ok', true, 'item',
    public.pv_stay_place_json(v_row, v_me, v_role = 'operator'));
end;
$fn$;

revoke all on function public.pv_stay_add(jsonb) from public, anon;
grant execute on function public.pv_stay_add(jsonb) to authenticated;

comment on function public.pv_stay_add(jsonb) is
  'ステイ情報を1件足す。確認の印を持つ人と運営だけ。pending で入る（運営が見るまで他人に出ない）。名前2〜80字・住所200字・メモ500字・30秒/20件24時間。地図のリンクは Google マップ以外なら捨てる。';


-- ════════════════════════════════════════════════════════════════
-- 6. 写真を足す
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {place:<場所の id>, b64:<素の base64。data: の頭は付けない>}
--   ★ w・h は読まない（送られてきても無視する）。幅と高さは写真そのものから読む。
-- 返り値: {ok:true, photo:{id, mine:true, state:'pending'}}
--   locked         資格が無い
--   not_found      その場所が無い・自分に見えない・見送られている（★同じ答え）
--   image_bad      空・base64 でない・JPEG でない・小さすぎる・**作り直せない JPEG**
--                  （途中で切れている・節の長さが中身と合わない・知らない節がある・
--                    大きさの印が無い／2つある・1辺が 8,192 を超える・色の読み方が変わる など）
--   image_too_big  base64 が 70万字を超える（読まずに返す）／作り直したあと 50万バイトを超える
--   rate_limited   24時間に30枚
--   full           1つの場所に自分が付けられるのは4枚まで
--   duplicate      同じ場所に同じ写真をもう付けている
-- ★ 枚数の上限は「自分が付けた枚数」で数える。他人の確認前の写真を数に入れると、
--   full の返事から「見えていない写真が何枚あるか」が読めてしまう。
-- ★ 公開済みの場所なら、書いた本人でなくても写真を足せる。
-- ★ 保存するのは、サーバーで作り直したあとのバイト列だけ（3-i の pv_jpeg_read）。
--   届いたバイト列（v_raw）は、作り直しに渡したあとはどこにも使わない。
--   重ね出しの判定も、作り直したあとで比べる
--   （撮影情報や末尾の付け足しだけが違う同じ写真は duplicate になる）。
--   作り直すと、頭の JFIF が無かった写真は 18 バイト増える。50万バイトは作り直したあとで測る。
-- ★ 場所の行は for share で読む。読まずに進むと、この関数が場所を見てから写真を入れる
--   までのあいだに運営がその場所を見送ったとき、見送られた場所に画素の入った写真が1枚残る
--   （見送りの側の「写真も全部消す」は、まだ入っていない写真を消せない）。
create or replace function public.pv_stay_photo_add(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_role  text;
  v_op    boolean;
  v_me    text;
  v_pid   uuid;
  v_place public.pv_stay_places%rowtype;
  v_b64   text;
  v_raw   bytea;            -- 届いたまま（作り直しに渡すだけ。保存しない）
  v_bytes bytea;            -- 作り直したあと（保存するのはこれだけ）
  v_w     int;
  v_h     int;
  v_n     int;
  v_id    uuid;
begin
  v_role := public.pv_stay_role();
  if v_role is null then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  v_op := (v_role = 'operator');
  v_me := public.pv_stay_hash(auth.uid());

  v_pid := public.pv_stay_uuid(p->>'place');
  if v_pid is null then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;
  select * into v_place from public.pv_stay_places where id = v_pid for share;
  -- 見えない場所・見送られた場所には付けられない。在るかどうかも答えない
  if not found
     or v_place.state = 'rejected'
     or not public.pv_stay_visible(v_place.state, v_place.author_hash, v_me, v_op) then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  v_b64 := p->>'b64';
  if v_b64 is null or char_length(btrim(v_b64)) = 0 then
    return jsonb_build_object('ok', false, 'status', 'image_bad');
  end if;
  -- 受け取る長さの上限（作り直す前）。base64 は元の約4/3 ＝ 70万字で約52万バイト。
  -- 大きいものを decode しない・作り直しにも渡さない
  if char_length(v_b64) > 700000 then
    return jsonb_build_object('ok', false, 'status', 'image_too_big');
  end if;
  begin
    v_raw := decode(v_b64, 'base64');
  exception when others then
    return jsonb_build_object('ok', false, 'status', 'image_bad');
  end;
  -- 撮影情報を落として作り直す。画面の焼き直しを当てにしない（約束 5・11）。
  -- 幅と高さも写真そのものから読む（★ p の w・h は読まない）。
  -- JPEG でないもの（PNG・SVG・PDF）・作り直せない JPEG は、ここで3つとも null になる
  select r.body, r.w, r.h into v_bytes, v_w, v_h from public.pv_jpeg_read(v_raw) r;
  v_raw := null;
  if v_bytes is null or v_w is null or v_h is null or octet_length(v_bytes) < 100 then
    return jsonb_build_object('ok', false, 'status', 'image_bad');
  end if;
  -- 50万バイトの上限は、作り直したあとの長さで測る
  if octet_length(v_bytes) > 500000 then
    return jsonb_build_object('ok', false, 'status', 'image_too_big');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pv_stay:' || v_me, 0));

  -- 1日の上限
  select count(*) into v_n from public.pv_stay_photos
   where author_hash = v_me and created_at > now() - interval '24 hours';
  if v_n >= 30 then
    return jsonb_build_object('ok', false, 'status', 'rate_limited');
  end if;

  -- 1つの場所に自分が付けられる枚数（見送られたものは数えない）
  select count(*) into v_n from public.pv_stay_photos
   where place_id = v_pid and author_hash = v_me and state <> 'rejected';
  if v_n >= 4 then
    return jsonb_build_object('ok', false, 'status', 'full');
  end if;

  -- 同じ写真の重ね出し（ボタンの二度押し）
  if exists (select 1 from public.pv_stay_photos
              where place_id = v_pid and author_hash = v_me
                and state <> 'rejected' and bytes = v_bytes) then
    return jsonb_build_object('ok', false, 'status', 'duplicate');
  end if;

  insert into public.pv_stay_photos (place_id, author_hash, bytes, byte_len, w, h)
  values (v_pid, v_me, v_bytes, octet_length(v_bytes), v_w, v_h)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'photo',
    jsonb_build_object('id', v_id, 'mine', true, 'state', 'pending'));
end;
$fn$;

revoke all on function public.pv_stay_photo_add(jsonb) from public, anon;
grant execute on function public.pv_stay_photo_add(jsonb) to authenticated;

comment on function public.pv_stay_photo_add(jsonb) is
  'ステイ情報に写真を1枚足す。確認の印を持つ人と運営だけ。JPEG・50万バイトまで・pending で入る。届いた JPEG はサーバーで作り直し（撮影情報・付帯情報を全部落とす）、作り直したものだけを保存する。幅と高さは写真から読む（送られた w・h は読まない）。1つの場所に自分の写真は4枚まで・24時間に30枚。';


-- ════════════════════════════════════════════════════════════════
-- 7. 写真を1枚読む
-- ════════════════════════════════════════════════════════════════
-- 一覧では写真を返さない（数枚でも数百KBずつ乗る）。画面が1枚ずつ取りにくる。
-- 引数: p = {id:<写真の id>}
-- 返り値: {ok:true, mime:'image/jpeg', w, h, state, b64}。画面が data: URL にして貼る。
-- ★ 門は3つ全部。資格がある／場所が自分に見える／写真が自分に見える
--   （公開済みか、自分のか、運営か）。
-- ★ 無い・見えない・画素を消した、は全部同じ not_found。在るかどうかを答えない。
-- ★ 返すのは表に保存してあるバイト列だけ ＝ サーバーで作り直したもの（3-i）。
--   表の CHECK（3-j）が「作り直した形そのもの」しか入れないので、ここでは作り直さない。
--   w・h も、写真そのものから読んだ値。
create or replace function public.pv_stay_photo(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_role  text;
  v_op    boolean;
  v_me    text;
  v_id    uuid;
  v_f     public.pv_stay_photos%rowtype;
  v_place public.pv_stay_places%rowtype;
begin
  v_role := public.pv_stay_role();
  if v_role is null then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  v_op := (v_role = 'operator');
  v_me := public.pv_stay_hash(auth.uid());

  v_id := public.pv_stay_uuid(p->>'id');
  if v_id is null then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  select * into v_f from public.pv_stay_photos where id = v_id;
  if not found or v_f.bytes is null then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;
  select * into v_place from public.pv_stay_places where id = v_f.place_id;
  if not found
     or not public.pv_stay_visible(v_place.state, v_place.author_hash, v_me, v_op)
     or not public.pv_stay_visible(v_f.state, v_f.author_hash, v_me, v_op) then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true, 'mime', v_f.mime, 'w', v_f.w, 'h', v_f.h, 'state', v_f.state,
    -- ★ encode は76字ごとに改行を挟む。画面は data: URL にそのまま入れるので外してから返す
    'b64', replace(encode(v_f.bytes, 'base64'), chr(10), ''));
end;
$fn$;

revoke all on function public.pv_stay_photo(jsonb) from public, anon;
grant execute on function public.pv_stay_photo(jsonb) to authenticated;

comment on function public.pv_stay_photo(jsonb) is
  'ステイ情報の写真を1枚 base64 で返す。確認の印を持つ人と運営にだけ。公開済み・自分の写真・運営のときだけ。author_hash は返さない。';


-- ════════════════════════════════════════════════════════════════
-- 8. 運営が見る（公開する／見送る）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {target:'place'|'photo', id, state:'public'|'rejected'}
-- 返り値: {ok:true, target, id, state}
--   forbidden   運営ではない（★何も調べずに返す）
--   bad_state   'public' と 'rejected' 以外（★'pending' へ戻す道は無い）
--   bad_target  'place' と 'photo' 以外
--   not_found   その id が無い
--   own_post    自分が出したものを自分で公開しようとした
--   final       見送ったものは公開へ戻せない（出し直してもらう）
-- ★ own_post が要。運営が自分で書いて自分で通せると、「人が1回見る」が
--   「書いた本人が見た」になる。見送る側は自分のものでもできる（害が無い）。
-- ★ 場所を見送ると、その場所の写真も全部見送りになり、画素を消す。
--   場所が見えなくなったあとに写真だけ DB に残る、を作らない。
-- ★ 場所を公開しても写真は公開にならない。写真は1枚ずつ見る。
-- ★ 見送った場所に付いている写真は公開できない（final）。そういう写真は本来残らないが、
--   残っていたときに「見えない場所の公開済みの写真」を作らないための2本目の錠。
create or replace function public.pv_stay_moderate(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_me     text;
  v_target text;
  v_state  text;
  v_id     uuid;
  v_place  public.pv_stay_places%rowtype;
  v_f      public.pv_stay_photos%rowtype;
begin
  if public.pv_stay_role() is distinct from 'operator' then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;
  v_me := public.pv_stay_hash(auth.uid());

  v_state := coalesce(p->>'state', '');
  if v_state not in ('public', 'rejected') then
    return jsonb_build_object('ok', false, 'status', 'bad_state');
  end if;
  v_target := coalesce(p->>'target', 'place');
  if v_target not in ('place', 'photo') then
    return jsonb_build_object('ok', false, 'status', 'bad_target');
  end if;
  v_id := public.pv_stay_uuid(p->>'id');
  if v_id is null then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  if v_target = 'place' then
    select * into v_place from public.pv_stay_places where id = v_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'status', 'not_found');
    end if;
    if v_place.state = v_state then
      return jsonb_build_object('ok', true, 'target', v_target, 'id', v_id, 'state', v_state);
    end if;
    if v_place.state = 'rejected' then
      return jsonb_build_object('ok', false, 'status', 'final');
    end if;
    if v_state = 'public' and v_place.author_hash = v_me then
      return jsonb_build_object('ok', false, 'status', 'own_post');
    end if;

    update public.pv_stay_places
       set state = v_state, moderated_at = now()
     where id = v_id;
    if v_state = 'rejected' then
      update public.pv_stay_photos
         set state = 'rejected', bytes = null, byte_len = null, moderated_at = now()
       where place_id = v_id and state <> 'rejected';
    end if;
  else
    select * into v_f from public.pv_stay_photos where id = v_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'status', 'not_found');
    end if;
    if v_f.state = v_state then
      return jsonb_build_object('ok', true, 'target', v_target, 'id', v_id, 'state', v_state);
    end if;
    if v_f.state = 'rejected' then
      return jsonb_build_object('ok', false, 'status', 'final');
    end if;
    if v_state = 'public' and v_f.author_hash = v_me then
      return jsonb_build_object('ok', false, 'status', 'own_post');
    end if;
    -- 見送った場所の写真は公開しない
    if v_state = 'public'
       and exists (select 1 from public.pv_stay_places s
                    where s.id = v_f.place_id and s.state = 'rejected') then
      return jsonb_build_object('ok', false, 'status', 'final');
    end if;

    if v_state = 'rejected' then
      -- 見送った写真は中身ごと消す
      update public.pv_stay_photos
         set state = 'rejected', bytes = null, byte_len = null, moderated_at = now()
       where id = v_id;
    else
      update public.pv_stay_photos
         set state = 'public', moderated_at = now()
       where id = v_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'target', v_target, 'id', v_id, 'state', v_state);
end;
$fn$;

revoke all on function public.pv_stay_moderate(jsonb) from public, anon;
grant execute on function public.pv_stay_moderate(jsonb) to authenticated;

comment on function public.pv_stay_moderate(jsonb) is
  'ステイ情報の場所・写真を公開する／見送る。運営だけ（守っているのは grant ではなく関数の中の判定）。自分が出したものは自分で公開できない。見送った写真は画素を消す。pending へは戻せない。';


-- ════════════════════════════════════════════════════════════════
-- 9. 消す（本人か運営）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {target:'place'|'photo', id}
-- 返り値: {ok:true, target, id}
--   locked      ログインしていない
--   bad_target  'place' と 'photo' 以外
--   not_found   その id が無い・自分のものではない（★同じ答え。在るかどうかを答えない）
-- ★ ここだけは確認の印を見ない。印を外されたあとでも、自分が出したものは自分で消せる。
--   他人のものは、在っても無くても同じ not_found なので、何も漏れない。
-- ★ 場所を消すと、付いていた写真も一緒に消える（ほかの人が足した写真も）。
create or replace function public.pv_stay_delete(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid    uuid := auth.uid();
  v_me     text;
  v_op     boolean;
  v_target text;
  v_id     uuid;
  v_n      int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  v_me := public.pv_stay_hash(v_uid);
  v_op := (public.pv_stay_role() is not distinct from 'operator');

  v_target := coalesce(p->>'target', 'place');
  if v_target not in ('place', 'photo') then
    return jsonb_build_object('ok', false, 'status', 'bad_target');
  end if;
  v_id := public.pv_stay_uuid(p->>'id');
  if v_id is null then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  if v_target = 'place' then
    delete from public.pv_stay_places
     where id = v_id and (author_hash = v_me or v_op);
  else
    delete from public.pv_stay_photos
     where id = v_id and (author_hash = v_me or v_op);
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'target', v_target, 'id', v_id);
end;
$fn$;

revoke all on function public.pv_stay_delete(jsonb) from public, anon;
grant execute on function public.pv_stay_delete(jsonb) to authenticated;

comment on function public.pv_stay_delete(jsonb) is
  'ステイ情報の場所・写真を消す。書いた本人か運営だけ。他人のものは在っても無くても not_found。';


-- ════════════════════════════════════════════════════════════════
-- 10. 運営の待ち行列（まだ見ていないもの）
-- ════════════════════════════════════════════════════════════════
-- pv_stays は会社 × 空港を1つずつしか返さない。これが無いと、運営は
-- 「どの空港に確認待ちがあるか」を知る手段が無い。
-- 引数: p（いまは使わない。形をそろえるためだけ）
-- 返り値: {ok:true,
--          places:[{airline, iata, …一覧と同じ形…}],          確認待ちの場所
--          photos:[{id, mine, place, airline, iata, kind, name, place_state}]}  確認待ちの写真
--   forbidden  運営ではない（★何も調べずに返す）
-- ★ ここも時刻は返さない。古い順に並べるだけ。
create or replace function public.pv_stay_queue(p jsonb default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_me     text;
  v_places jsonb;
  v_photos jsonb;
begin
  if public.pv_stay_role() is distinct from 'operator' then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;
  v_me := public.pv_stay_hash(auth.uid());

  select coalesce(jsonb_agg(z.j order by z.t, z.id), '[]'::jsonb)
    into v_places
    from (
      select public.pv_stay_place_json(s, v_me, true)
               || jsonb_build_object('airline', s.airline, 'iata', s.iata) as j,
             s.created_at as t, s.id
        from public.pv_stay_places s
       where s.state = 'pending'
       order by s.created_at, s.id
       limit 200
    ) z;

  select coalesce(jsonb_agg(z.j order by z.t, z.id), '[]'::jsonb)
    into v_photos
    from (
      select jsonb_build_object(
               'id', f.id,
               'mine', coalesce(f.author_hash = v_me, false),
               'place', s.id,
               'airline', s.airline, 'iata', s.iata,
               'kind', s.kind, 'name', s.name,
               'place_state', s.state) as j,
             f.created_at as t, f.id
        from public.pv_stay_photos f
        join public.pv_stay_places s on s.id = f.place_id
       where f.state = 'pending'
       order by f.created_at, f.id
       limit 200
    ) z;

  return jsonb_build_object('ok', true, 'places', v_places, 'photos', v_photos);
end;
$fn$;

revoke all on function public.pv_stay_queue(jsonb) from public, anon;
grant execute on function public.pv_stay_queue(jsonb) to authenticated;

comment on function public.pv_stay_queue(jsonb) is
  'ステイ情報の確認待ち（場所と写真）。運営だけ。author_hash と時刻は返さない。';


-- ════════════════════════════════════════════════════════════════
-- 11. 検算（貼ったあとに出る1行）
-- ════════════════════════════════════════════════════════════════
-- ポリシー数は 0 が正しい。
-- 「確認の印を持つ会員」が 0 のあいだは、見えるのは運営だけ（約束 1 の ⚠️）。
select (select count(*) from pg_policies
         where schemaname = 'public'
           and tablename in ('pv_stay_places', 'pv_stay_photos'))      as ポリシー数,
       (select count(*) from public.profiles where verify_level >= 1)  as 確認の印を持つ会員,
       (select count(*) from public.pv_admins)                         as 運営;
