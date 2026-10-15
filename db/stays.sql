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
--  1. ほかの人が足したもの（ホテル・食べる所・行く所の名前・住所・メモ・写真・地図のリンク、
--     「同じ空港で他社が使うホテル」）を見てよい人は2種類だけ（2026-10-15 オーナーの訂正）。
--       a) オーナー ── pv_stay_owner の1行に入っている1人。SQL Editor で手で入れる（下の 10-b）
--       b) オーナーが承認した人 ── pv_stay_viewers の行が 'approved' で、承認したのが**いまの**
--          オーナー（decided_by ＝ いまのオーナー。本人が自分を承認した行は表が受け付けない）
--     判定は pv_stay_sees() の1か所だけ。**呼ばれるたびに**表を読み直す（覚えておかない）。
--     ★ オーナーの行が無い（1行でない）あいだは、**誰にも見えない**。承認も1つも数えない。
--       このファイルのオーナーの行は、誰にも当たらない文字のままにしてある
--       ＝ 貼っただけでは誰にも開かない。オーナーが自分のメールアドレスを入れて流したときだけ開く。
--     ★ 運営（pv_admins に居る人。判定は db/pay-rows.sql の pv_is_operator）は、確認待ちを見て
--       公開する／見送る（待ち行列・公開の口・確認待ちの写真を1枚読む口）。
--       運営であることだけでは、公開済みのものは読めない・写真も足せない。
--     ★ 次のものは根拠に**しない**。どれも本人の申告か、別の約束の鍵だから。
--         ログインしているだけ／確認の印（profiles.verify_level）／
--         access_until（給与を出せば誰でも付く90日の鍵）・給与を出したこと／
--         pv_my_give の basic・detailed・full／badge／profiles の会社・職位（本人が書き換えられる列）／
--         pay_reports.source（明細と名乗っただけ）／口コミの鍵／FOUNDING の番号／待遇の質問に答えたこと／
--         ホテルを足したこと／運営であること／本人が自分で書いた行／
--         'pending'・'denied'・'revoked' の行／前のオーナーが承認した行／JWT の中身／ブラウザの保存領域
--     ★ 名簿の2表（pv_stay_owner・pv_stay_viewers）を会員か未ログインが書ける状態なら、
--       その表は**信じない**（呼ばれるたびに確かめる）。オーナーの表なら誰にも開かない・
--       承認の表なら承認した人は全員 locked に戻る。直し方はこのファイルを貼り直すこと。
--  2. 資格の無い人には何も返さない。pv_stays は {ok:true, state:'locked'} **だけ**。
--     名前も、件数も、「在る／無い」も返さない（表を1行も読まずに返している）。
--  3. user_id を持たない。author_hash だけ（区切りは '::pv_hotel::'）。
--     （投稿の表＝場所と写真の話。見てよい人の名簿 pv_stay_owner・pv_stay_viewers だけは user_id を
--       持つ ── その人に見せてよいかの印で、投稿とは1度も突き合わせない。投稿は author_hash のまま。）
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
--     ★ 運営の口（pv_stay_moderate）から 'pending' へ戻す道は無い。見送った写真は画素ごと消す。
--     ★ 'pending' へ戻るのは、**書いた本人が場所の中身を直したときだけ**（5-b の pv_stay_update）。
--       公開済みでも、直した瞬間にほかの人から見えなくなり、運営がもう一度見る
--       （2026-10-05 オーナー決定「修正した投稿は運営の確認待ちへ戻す」）。
--       ＝ 一度通ったものを、あとから誰の目も通らない中身へ書き換える道を作らない。
--     ★ 運営が通すのは**運営が見た中身**だけ。直された場所は、見たときの中身の印（rev。3-m）を
--       添えないと公開できない（8 の changed）。運営が見てから押すまでの間に本人が直していたら、
--       通さずに「変わった」と返す。id だけで通すと、その間に直された中身が誰の目も通らずに出る。
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
  -- ★確認の印を会員が自分で書ける状態なら、db/admin.sql が当たっていない。
  --   （2026-10-15 から印はステイ情報を何も開かない。それでも db/admin.sql が profiles の書き込みを
  --   10列に絞っていることの確かめとして、ここで止める。）
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
  -- 'pending'（運営がまだ見ていない）→ 'public' ／ 'rejected'。
  -- pending へ戻るのは、本人が中身を直したときだけ（5-b）。運営の口からは戻せない
  state        text not null default 'pending',
  created_at   timestamptz not null default now(),
  moderated_at timestamptz
);

-- あとから足した列（2026-10-05）。表が前から在る所へ貼り直しても入るように、ここで足す。
--   city        都市の名前（人が読むための名前。空港の3レターとは別に持つ）。無ければ null
--   updated_at  本人が中身を直した時刻。一度も直していなければ null（★画面へは返さない）
--   edit_from・edit_n  「24時間に何回直したか」を数える箱（箱の始まりと、その中で直した回数）。
--               1日の上限を数えるためだけに持つ（★画面へは返さない）
alter table public.pv_stay_places add column if not exists city       text;
alter table public.pv_stay_places add column if not exists updated_at timestamptz;
alter table public.pv_stay_places add column if not exists edit_from  timestamptz;
alter table public.pv_stay_places add column if not exists edit_n     integer not null default 0;

-- あとから足した列（2026-10-08）。上と同じ理由で、ここで足す。
--   stay_hours  ステイ時間（そのホテルでのステイが、およそ何時間か。時間の整数）。
--               ★ホテル（kind = 'hotel'）だけが持つ。食べる所・行く所には付けない（必ず null）。
--               書くかどうかは任意。書いていないホテルも null（0 で埋めない）。
--               ★「長さ」であって「いつ」ではない。日付も時刻も持たないので、約束 7 には触れない。
alter table public.pv_stay_places add column if not exists stay_hours integer;

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
alter table public.pv_stay_places drop constraint if exists pv_stay_places_city_ck;
alter table public.pv_stay_places drop constraint if exists pv_stay_places_edit_ck;
alter table public.pv_stay_places drop constraint if exists pv_stay_places_hours_ck;

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
-- 都市の名前は1行・60字まで。空は null で持つ（'' を入れない）
alter table public.pv_stay_places add constraint pv_stay_places_city_ck check (
  city is null or (city = btrim(city) and char_length(city) between 1 and 60
                   and city !~ '[[:cntrl:]]'));
alter table public.pv_stay_places add constraint pv_stay_places_edit_ck check (
  edit_n >= 0);
-- ステイ時間はホテルだけ・1〜240時間（10日）。書いていなければ null。
-- 二重の網。検品（3-k の pv_stay_clean）を通らない道で入っても、食べる所・行く所に時間は付かない。
-- ★ 列を足した回でも止まらない（前から在る行は全部 null ＝ この決まりに合っている）。
alter table public.pv_stay_places add constraint pv_stay_places_hours_ck check (
  stay_hours is null or (kind = 'hotel' and stay_hours between 1 and 240));

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
  '就航地のステイ情報（ホテル・食べる所・行く所）。user_id は持たず author_hash だけ。個票の直読みは不可。見てよいのはオーナーとオーナーが承認した人だけ（決め方は pv_stay_sees の1か所）。運営は確認待ちを見て公開する／見送る。';
comment on column public.pv_stay_places.author_hash is
  '★ どの関数の返り値にも入れないこと。外へ出た瞬間に安定した仮名 ID になり、同じ人の投稿を束ねられる。';
comment on column public.pv_stay_places.state is
  '''pending'' は本人と運営にしか出ない。''public'' にできるのは運営だけで、自分の投稿は自分で公開できない。運営の口から pending へは戻せない。pending へ戻るのは、書いた本人が中身を直したとき（pv_stay_update）だけ。';
comment on column public.pv_stay_places.created_at is
  '★ そのまま返さない。返すのは0〜4の段（age）だけ。ステイ先は乗務の記録と突き合わせやすい。';
comment on column public.pv_stay_places.city is
  '都市の名前（人が読むための名前。空港の3レターとは別に持つ）。1行・60字まで。無ければ null。';
comment on column public.pv_stay_places.stay_hours is
  'ステイ時間（そのホテルでのステイが、およそ何時間か）。1〜240 の整数。ホテル（kind = ''hotel''）だけが持ち、ほかの種別と、書いていないホテルは null。';
comment on column public.pv_stay_places.updated_at is
  '★ どの関数の返り値にも入れないこと。書いた本人が中身を直した時刻（一度も直していなければ null）。';
comment on column public.pv_stay_places.edit_n is
  '直した回数（edit_from から24時間の箱の中だけ）。1日の上限を数えるためだけに持つ。画面へは返さない。';
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
-- 2-b. 見てよい人の名簿（オーナー1人と、オーナーが承認した人）── 約束 1
-- ════════════════════════════════════════════════════════════════
-- pv_stay_owner   オーナーの1行だけ（主キーは true の1つしか取れない ＝ 2行目は入らない）。
--                 入れるのは SQL Editor の手だけ（下の 10-b）。画面からも関数からも書かない。
-- pv_stay_viewers 承認の行（1人1行）。'pending'（申し込み）→ 'approved' ／ 'denied'、
--                 'approved' → 'revoked'。'pending' でない行は、決めた人と時刻を必ず持つ。
--                 ★ 本人が自分を決めた行は表が受け付けない（decided_by ≠ user_id）。
-- ★ この2表は user_id を持つ（その人に見せてよいかの印だから）。投稿の表（場所・写真）とは
--   1度も突き合わせない（投稿は author_hash だけ。約束 3）。
-- ★ 表は完全に閉じる（約束 4 と同じ）。ポリシーを作らない・anon にも authenticated にも配らない。
create table if not exists public.pv_stay_owner (
  one      boolean primary key default true,
  user_id  uuid not null references auth.users(id) on delete cascade,
  set_at   timestamptz not null default now()
);

create table if not exists public.pv_stay_viewers (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  state       text not null,
  asked_at    timestamptz,
  decided_by  uuid references auth.users(id),
  decided_at  timestamptz
);

alter table public.pv_stay_owner   drop constraint if exists pv_stay_owner_one_ck;
alter table public.pv_stay_viewers drop constraint if exists pv_stay_viewers_state_ck;
alter table public.pv_stay_viewers drop constraint if exists pv_stay_viewers_decided_ck;
alter table public.pv_stay_viewers drop constraint if exists pv_stay_viewers_self_ck;

alter table public.pv_stay_owner add constraint pv_stay_owner_one_ck check (one);
alter table public.pv_stay_viewers add constraint pv_stay_viewers_state_ck check (
  state in ('pending', 'approved', 'denied', 'revoked'));
alter table public.pv_stay_viewers add constraint pv_stay_viewers_decided_ck check (
  state = 'pending' or (decided_by is not null and decided_at is not null));
alter table public.pv_stay_viewers add constraint pv_stay_viewers_self_ck check (
  decided_by is distinct from user_id);

alter table public.pv_stay_owner   enable row level security;
alter table public.pv_stay_viewers enable row level security;

revoke all on public.pv_stay_owner   from public, anon, authenticated;
revoke all on public.pv_stay_viewers from public, anon, authenticated;

-- 既に作ってしまったポリシーがあれば落とす（冪等・事故防止）
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
            where schemaname = 'public'
              and tablename in ('pv_stay_owner', 'pv_stay_viewers') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

comment on table public.pv_stay_owner is
  'ステイ情報のオーナー（1行だけ）。この人と、この人が承認した人だけが、ほかの人が足したステイ情報を読める。SQL Editor の手でだけ入れる。行が無いあいだは誰も読めない。';
comment on table public.pv_stay_viewers is
  'ステイ情報を見てよい人の承認（1人1行）。approved で、承認したのがいまのオーナーの行だけが効く。pending・denied・revoked・前のオーナーが承認した行は何も開かない。投稿の表とは突き合わせない。';


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


-- 3-b. オーナー（★見てよい人の決め方の土台。オーナーの行は SQL Editor の手でだけ入る）
-- 返すのは、オーナーの表にちょうど1行あるときの、その人の user_id。それ以外は null（＝誰にも開かない）。
-- ★ 土台の確かめ直し（毎回）。会員か未ログインがオーナーの表を書ける状態なら、その行はもう
--   「オーナーが手で入れた」ものではない ＝ **信じない**（null。誰にも開かない）。
--   冒頭の「0. 前提」は貼った瞬間しか見ない。あとから別の SQL が書き込みを配り直したときのため。
-- ★ 表を読むが security definer にしない。呼ぶのは security definer の関数の中からだけ
--   （誰にも配らない ＝ 画面からは呼べない）。
create or replace function public.pv_stay_owner_id()
returns uuid
language sql
stable
set search_path = public, extensions
as $fn$
  select case
           when not has_any_column_privilege('authenticated', 'public.pv_stay_owner', 'INSERT')
            and not has_any_column_privilege('authenticated', 'public.pv_stay_owner', 'UPDATE')
            and not has_any_column_privilege('anon', 'public.pv_stay_owner', 'INSERT')
            and not has_any_column_privilege('anon', 'public.pv_stay_owner', 'UPDATE')
            and (select count(*) from public.pv_stay_owner) = 1
           then (select o.user_id from public.pv_stay_owner o)
         end;
$fn$;

revoke all on function public.pv_stay_owner_id() from public, anon, authenticated;

comment on function public.pv_stay_owner_id() is
  'ステイ情報のオーナーの user_id（オーナーの表にちょうど1行あるときだけ。無ければ null ＝ 誰も読めない）。会員か未ログインがその表を書ける状態なら null。security definer の関数の中でだけ使う。';


-- 3-b2. 見てよい人か（★約束 1 の判定はここ1か所だけ）
-- true になるのは2つだけ:
--   a) 呼んだ人がオーナー
--   b) 呼んだ人の承認の行が 'approved' で、承認したのが**いまの**オーナー
--      （前のオーナーが承認した行・本人が自分を決めた行は数えない）
-- ★ 呼ばれるたびに表を読む。JWT の中身・ブラウザの値・前に読んだ答えを使わない。
-- ★ 承認の表を会員か未ログインが書ける状態なら、承認の行は信じない（通れるのはオーナーだけ）。
-- ★ 確認の印・給与の鍵・バッジ・プロフィール・運営の名簿は見ない（約束 1 の「根拠にしない」）。
-- ★ 表を読むが security definer にしない。呼ぶのは security definer の関数の中からだけ。
create or replace function public.pv_stay_sees()
returns boolean
language sql
stable
set search_path = public, extensions
as $fn$
  select coalesce(
    auth.uid() is not null
    and public.pv_stay_owner_id() is not null
    and (auth.uid() = public.pv_stay_owner_id()
         or (not has_any_column_privilege('authenticated', 'public.pv_stay_viewers', 'INSERT')
             and not has_any_column_privilege('authenticated', 'public.pv_stay_viewers', 'UPDATE')
             and not has_any_column_privilege('anon', 'public.pv_stay_viewers', 'INSERT')
             and not has_any_column_privilege('anon', 'public.pv_stay_viewers', 'UPDATE')
             and exists (select 1 from public.pv_stay_viewers v
                          where v.user_id = auth.uid()
                            and v.state = 'approved'
                            and v.decided_by = public.pv_stay_owner_id()
                            and v.decided_by <> v.user_id))),
    false);
$fn$;

revoke all on function public.pv_stay_sees() from public, anon, authenticated;

comment on function public.pv_stay_sees() is
  'ほかの人が足したステイ情報を見てよい人か。オーナーと、いまのオーナーが承認した人だけ。呼ばれるたびに表を読む（JWT・ブラウザの値は見ない）。決め方はこの関数の1か所。security definer の関数の中でだけ使う。';


-- 3-c. 門（★見てよいかの判定はここ1か所だけ）
-- 返すのは 'operator'（運営）／'reader'（見てよい人 ＝ オーナーかオーナーが承認した人）／null（どちらでもない）。
-- どの関数も最初にこれを呼び、null なら表を1行も読まずに返る。
-- ★ 'operator' は確認待ちを見て公開する人であって、読む人ではない。読む口（一覧・写真）は
--   これとは別に pv_stay_sees() を見る（運営でも、見てよい人でなければ locked）。
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
  if coalesce(public.pv_stay_sees(), false) then
    return 'reader';
  end if;
  return null;
end;
$fn$;

revoke all on function public.pv_stay_role() from public, anon, authenticated;

comment on function public.pv_stay_role() is
  'ステイ情報の役。''operator''（運営：確認待ちを見て公開する）／''reader''（見てよい人：オーナーかオーナーが承認した人）／null。★見てよい人の決め方は pv_stay_sees の1か所。給与の鍵・バッジ・プロフィール・確認の印は見ない。';

-- 3-c2. 前の部品を消す（確認の印で開けていた頃の判定。2026-10-15 から、印は何も開かない）
drop function if exists public.pv_is_verified_pilot();


-- 3-d. 見えるかどうか（★この判定はここ1か所だけ。場所にも写真にも使う）
-- p_me は「呼んだ人の手」の並び（ログインの印・端末の鍵の印）。p_sees は、公開のものを見てよい人か。
-- 運営は全部／自分のもの（p_me のどれか）は必ず／それ以外は、見てよい人（p_sees）に 'public' だけ。
-- ★ どの引数が null でも null を返さない（「if not null」は素通りする＝見えてしまう）。
drop function if exists public.pv_stay_place_json(public.pv_stay_places, text, boolean);
drop function if exists public.pv_stay_visible(text, text, text, boolean);

create or replace function public.pv_stay_visible(
  p_state text, p_author text, p_me text[], p_op boolean, p_sees boolean)
returns boolean
language sql
immutable
set search_path = public, extensions
as $fn$
  select coalesce(p_op, false)
      or coalesce(p_author = any(p_me), false)
      or (coalesce(p_sees, false) and coalesce(p_state = 'public', false));
$fn$;

revoke all on function public.pv_stay_visible(text, text, text[], boolean, boolean)
  from public, anon, authenticated;

comment on function public.pv_stay_visible(text, text, text[], boolean, boolean) is
  '場所・写真が自分に見えるか。運営は全部／自分のもの（p_me のどれか）は必ず／それ以外は、見てよい人（p_sees）に public だけ。';


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
-- ⚠️ to_jsonb(s) や s.* で返さない。author_hash と created_at がそのまま外へ出る
--    （直した時刻の updated_at と、直した回数の箱 edit_from・edit_n も同じ。ここに並べない）。
-- mine は「呼んだ本人が書いたか」だけ（印そのものは返さない）。state は見える人にそのまま返す
-- ＝ 本人は自分のものが 確認待ち／公開／見送り のどれかを、いつでも読める。
-- 写真は、その人に見えるものだけを並べる（他人の確認前の写真は「在る」ことも出さない）。
-- ⚠️ 写真を足した順（created_at）に並べない。並びは id の順（＝乱数。何度読んでも同じ）。
--    足した順だと、自分の写真を先と後に置くだけで、あいだに入った他人の写真が
--    「いつからいつの間に足されたか」が分かる（約束 7。2026-10-04 に手元で確かめた）。
-- 返す欄は12個（2026-10-08 に stay_hours を足した）。stay_hours はホテルだけが持つステイ時間で、
-- 食べる所・行く所と、書いていないホテルは null のまま返す（欄そのものは必ず在る ＝ 形は種別で変わらない）。
-- ★ 写真は、見てよい人（p_sees）と運営にだけ並べる。見てよい人でない人には、自分が足した写真も並べない
--   （写真を読む口 7 が、その人には何も返さないから。並べると、画面が読みに行っては断られる）。
create or replace function public.pv_stay_place_json(
  s public.pv_stay_places, p_me text[], p_op boolean, p_sees boolean)
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
    'city',     s.city,
    'stay_hours', s.stay_hours,
    'age',      public.pv_stay_age(s.created_at),
    'mine',     coalesce(s.author_hash = any(p_me), false),
    'state',    s.state,
    'photos',   case when coalesce(p_op, false) or coalesce(p_sees, false) then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',    f.id,
               'mine',  coalesce(f.author_hash = any(p_me), false),
               'state', f.state)
             order by f.id)
        from public.pv_stay_photos f
       where f.place_id = s.id
         and public.pv_stay_visible(f.state, f.author_hash, p_me, p_op, p_sees)
    ), '[]'::jsonb) else '[]'::jsonb end);
$fn$;

revoke all on function public.pv_stay_place_json(public.pv_stay_places, text[], boolean, boolean)
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


-- 3-k. 場所の中身の検品（★足す口と直す口の両方がこれを呼ぶ。式を写さない）
-- 引数: p = {kind, name, address, maps_url, note, city, stay_hours}（ほかの欄は読まない）
-- 返り値: status が null なら通った ＝ 残りの7つが「保存してよい形にそろえた値」。
--         null でなければ弾いた理由で、残りの値は使わない。
--   bad_kind   種別が白リストの外
--   bad_name   名前が2〜80字でない
--   too_long   住所が200字・メモが500字を超える
--   bad_city   都市の名前が60字を超える
--   bad_hours  ステイ時間が 1〜240 の整数でない（ホテルのときだけ見る）
-- ★ 見る順番（種別 → 名前 → 住所 → メモ → 都市 → ステイ時間）を変えない。画面に出る一言がこの順で決まる。
-- ★ 地図のリンクは通らなくても弾かない（リンクだけ捨てる。3-g）。
-- ★ 空の欄は null にそろえる（'' を保存しない＝「書いていない」が1つの形になる）。
-- ★ ステイ時間（stay_hours）はホテルだけの欄で、書くかどうかは任意。
--     欄が無い・null・空（空白だけ）        … 書いていない（null）。弾かない
--     数か、数字だけの文字で、1〜240 の整数 … その整数
--     それ以外（0・241・1.5・負の数・'abc'・真偽・入れ物） … bad_hours
--   ホテルでなければ**何が来ても null**（弾かない・黙って捨てる）。
--   ＝ ホテルを食べる所へ直した場所に、前の時間が残らない（5-b は今の行に重ねてからここを呼ぶ）。
--   ⚠️ 丸めて通さない（1.5 を 2 にしない）。書いた人の数と違う数を、その人の言葉として出さない。
-- ⚠️ 片方の口だけに検品を書き足さない。足すときは通らない中身が、直す口からは入る、を作る。
-- ★ 先に落としてから作る。返す欄（out）を1つ足した回に create or replace だけだと、
--   「返り値の型は変えられない」でこのファイルごと止まる（前に貼った形が残っているため）。
--   落としても、これを呼ぶ2つの口（5・5-b）は名前で呼んでいるので壊れない。
drop function if exists public.pv_stay_clean(jsonb);

create or replace function public.pv_stay_clean(
  p jsonb,
  out status   text,
  out kind     text,
  out name     text,
  out address  text,
  out maps_url text,
  out note     text,
  out city     text,
  out stay_hours integer
)
language plpgsql
immutable
set search_path = public, extensions
as $fn$
declare
  v_ht text;      -- 届いたステイ時間の型（'number'・'string'・'null'…。欄が無ければ null）
  v_hs text;      -- 文字で届いたときの中身（前後の空白を落としたもの）
  v_hn numeric;   -- 数で届いたときの値
begin
  kind := coalesce(p->>'kind', '');
  if kind not in ('hotel', 'food', 'spot') then
    status := 'bad_kind';
    return;
  end if;

  -- ★ 名前と住所は1行にそろえる（改行・タブ・全角空白・連続した空白を1つの空白に）。
  --   trim が先。空白だけの名前と、前後の空白ぶんだけ長い名前を同時に潰す。
  name := btrim(regexp_replace(coalesce(p->>'name', ''), '[[:space:][:cntrl:]　]+', ' ', 'g'));
  if char_length(name) < 2 or char_length(name) > 80 then
    status := 'bad_name';
    return;
  end if;

  address := nullif(btrim(regexp_replace(coalesce(p->>'address', ''), '[[:space:][:cntrl:]　]+', ' ', 'g')), '');
  if char_length(address) > 200 then
    status := 'too_long';
    return;
  end if;

  -- メモは改行を残す（前後だけ落とす）
  note := nullif(btrim(coalesce(p->>'note', ''), E' \t\r\n　'), '');
  if char_length(note) > 500 then
    status := 'too_long';
    return;
  end if;

  -- 都市の名前も1行にそろえる（名前と同じ。改行は入らない）。書いていなければ null
  city := nullif(btrim(regexp_replace(coalesce(p->>'city', ''), '[[:space:][:cntrl:]　]+', ' ', 'g')), '');
  if char_length(city) > 60 then
    status := 'bad_city';
    return;
  end if;

  -- ステイ時間はホテルだけ。ほかの種別では読まない（stay_hours は null のまま＝黙って捨てる）
  if kind = 'hotel' then
    v_ht := jsonb_typeof(p->'stay_hours');
    if v_ht = 'number' then
      v_hn := (p->>'stay_hours')::numeric;
    elsif v_ht = 'string' then
      v_hs := btrim(p->>'stay_hours', E' \t\r\n　');
      if v_hs <> '' then
        -- 数字だけ・3けたまで（'1.5'・'-3'・'1e2'・'abc' はここで弾く）。
        -- ★ 形を確かめてから数へ直す（形の合わない文字を数へ直そうとすると、例外でこの口ごと落ちる）
        if v_hs !~ '^[0-9]{1,3}$' then
          status := 'bad_hours';
          return;
        end if;
        v_hn := v_hs::numeric;
      end if;
    elsif v_ht is not null and v_ht <> 'null' then
      -- 真偽・入れ物（{}・[]）は、数として読まない
      status := 'bad_hours';
      return;
    end if;

    -- ここまでで v_hn が空なら「書いていない」。在れば 1〜240 の整数だけ通す
    -- ★ 範囲を見てから integer へ直す（とても大きい数でも、例外にせず bad_hours で返す）
    if v_hn is not null then
      if v_hn < 1 or v_hn > 240 or v_hn <> trunc(v_hn) then
        status := 'bad_hours';
        return;
      end if;
      stay_hours := v_hn::integer;
    end if;
  end if;

  maps_url := public.pv_stay_maps_url(p->>'maps_url');
end;
$fn$;

revoke all on function public.pv_stay_clean(jsonb) from public, anon, authenticated;

comment on function public.pv_stay_clean(jsonb) is
  '場所の中身（種別・名前・住所・地図のリンク・メモ・都市・ステイ時間）を検品して、保存してよい形にそろえる。status が null なら通った。ステイ時間はホテルだけ（1〜240 の整数。ほかの種別では null）。足す口と直す口が同じものを呼ぶ。';


-- 3-l. 同じ名前が既に在るか（★足す口と直す口の両方がこれを呼ぶ）
-- 返り値: 'duplicate'（自分が同じ名前を既に出している）／'exists'（同じ名前が既に公開済み）／null
-- p_skip は「いま直している場所そのもの」。足すときは null。
-- ★ 自分の重ね出しは、見送られたものを数えない（＝出し直せる）。
-- ★ exists は公開済みの行だけを見る。他人の確認前の行と比べない
--   （比べると「誰かがそのホテルを出したところだ」が分かってしまう）。
create or replace function public.pv_stay_clash(
  p_me text, p_air text, p_iata text, p_kind text, p_name text, p_skip uuid)
returns text
language sql
stable
set search_path = public, extensions
as $fn$
  select case
    when exists (select 1 from public.pv_stay_places
                  where author_hash = p_me and airline = p_air and iata = p_iata
                    and kind = p_kind and lower(name) = lower(p_name)
                    and state <> 'rejected'
                    and id is distinct from p_skip) then 'duplicate'
    when exists (select 1 from public.pv_stay_places
                  where airline = p_air and iata = p_iata
                    and kind = p_kind and lower(name) = lower(p_name)
                    and state = 'public'
                    and id is distinct from p_skip) then 'exists'
    else null end;
$fn$;

revoke all on function public.pv_stay_clash(text, text, text, text, text, uuid)
  from public, anon, authenticated;

comment on function public.pv_stay_clash(text, text, text, text, text, uuid) is
  '同じ会社・空港・種別に同じ名前が在るか。''duplicate''（自分のもの）／''exists''（公開済み）／null。他人の確認前の行とは比べない。';


-- 3-m. 中身の印（★運営が「見たもの」と「通すもの」を同じにするための16字）
-- 種別・名前・住所・地図のリンク・メモ・都市・ステイ時間の7つ**だけ**から作る。
-- ★ 時刻も、書いた人の印も、id も混ぜない（混ぜると、この16字が「いつ・誰が」を運ぶ）。
--   中身が同じなら、誰がいつ書いても同じ印になる。
-- ★ 返すのは運営が読む所だけ ── 4 の一覧を運営として読んだ行と、10 の待ち行列の行。
--   会員へ返る12個の欄には入れない（3-h に足さない）。足す口・直す口の返事にも入れない。
-- ★ 使うのは 8 の「公開する」だけ。運営が見たときの印と、いまの中身の印を比べる。
-- ⚠️ 欄を1つ足したら、ここにも足す（5-b の「何も変わっていない」が比べる7つと同じ並び）。
--    足し忘れると、その欄だけを直された場所が、古い印のまま通る。
--    ★ 足すのは**並びのいちばん後ろ**（2026-10-08 のステイ時間もそうした。前の6つの並びは動かさない）。
-- ⚠️ 並びと作り方を変えると、開いたままの運営の画面が持っている印が全部合わなくなる
--    （合わないときは通さないだけ。読み直せば通る）。
--    欄を足した回も同じ ── ステイ時間を足した 2026-10-08 に、全部の場所の印が1度だけ変わった。
create or replace function public.pv_stay_rev(s public.pv_stay_places)
returns text
language sql
immutable
set search_path = public, extensions
as $fn$
  select substr(encode(extensions.digest(
           jsonb_build_array(s.kind, s.name, s.address, s.maps_url, s.note, s.city, s.stay_hours)::text,
           'sha256'), 'hex'), 1, 16);
$fn$;

revoke all on function public.pv_stay_rev(public.pv_stay_places) from public, anon, authenticated;

comment on function public.pv_stay_rev(public.pv_stay_places) is
  '場所の中身（種別・名前・住所・地図のリンク・メモ・都市・ステイ時間）だけから作る16字の印。運営が見た中身と、公開するときの中身が同じかを確かめるために使う。時刻・書いた人・id は混ぜない。運営にしか返さない。';


-- ════════════════════════════════════════════════════════════════
-- 4. 読む（会社 × 空港の一覧）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {airline:'etihad', iata:'NRT'}
-- 返り値:
--   資格なし → {ok:true, state:'locked'}            ★これだけ。表を読む前に返す
--   資格あり → {ok:true, state:'open', can_add, is_operator,
--               places:[{id, kind, name, address, maps_url, note, city, stay_hours, age, mine, state,
--                        photos:[{id, mine, state}]}],
--               others:[{airline, places:[…]}]}
--   引数が変 → {ok:false, status:'bad_airline'|'bad_iata'}（資格のある人にだけ返る）
-- others は「同じ空港で他社が使うホテル」。kind='hotel' だけ。食べる所・行く所は出さない。
-- can_add は、その会社がいまも名簿で有効なとき true。
-- stay_hours はステイ時間（時間の整数）。ホテルだけが持ち、ほかの種別と、書いていないホテルは null。
-- ★ 運営として読んだときだけ（運営で、見てよい人でもあるとき。約束 1）、places と others の1件ずつに rev（中身の印。3-m）が付く。
--   公開するときに、見た行の rev をそのまま 8 へ送り返す。会員が読む行は12個の欄のまま。
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
  v_sees   boolean;
  v_all    boolean;
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
  -- ★ 開くのは見てよい人（オーナーかオーナーが承認した人。約束 1）だけ。運営であることだけでは開かない
  v_sees := public.pv_stay_sees();
  if not v_sees then
    return jsonb_build_object('ok', true, 'state', 'locked');
  end if;
  -- 全部（ほかの人の確認待ちも）見えるのは、見てよい人でもある運営だけ
  v_all := (v_role = 'operator' and v_sees);
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
      select public.pv_stay_place_json(s, array[v_me], v_all, v_sees)
               || case when v_all then jsonb_build_object('rev', public.pv_stay_rev(s))
                       else '{}'::jsonb end as j,
             case s.kind when 'hotel' then 0 when 'food' then 1 else 2 end as k,
             lower(s.name) as n, s.id
        from public.pv_stay_places s
       where s.airline = v_air and s.iata = v_iata
         and public.pv_stay_visible(s.state, s.author_hash, array[v_me], v_all, v_sees)
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
                 public.pv_stay_place_json(s, array[v_me], v_all, v_sees)
                   || case when v_all then jsonb_build_object('rev', public.pv_stay_rev(s))
                           else '{}'::jsonb end as j,
                 lower(s.name) as n, s.id
            from public.pv_stay_places s
           where s.iata = v_iata and s.airline <> v_air and s.kind = 'hotel'
             and public.pv_stay_visible(s.state, s.author_hash, array[v_me], v_all, v_sees)
           order by 1, 3, 4
           limit 200
        ) z
       group by z.airline
    ) g;

  return jsonb_build_object(
    'ok', true, 'state', 'open',
    'can_add', coalesce(v_active, false),
    'is_operator', v_all,
    'places', v_places,
    'others', v_others);
end;
$fn$;

revoke all on function public.pv_stays(jsonb) from public;
grant execute on function public.pv_stays(jsonb) to anon, authenticated;

comment on function public.pv_stays(jsonb) is
  '会社 × 空港のステイ情報。オーナーとオーナーが承認した人にだけ中身を返す（運営であることだけでは開かない）。それ以外には {ok:true, state:''locked''} だけ（名前も件数も返さない）。author_hash と時刻は返さない。';


-- ════════════════════════════════════════════════════════════════
-- 5. 足す（場所）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {airline, iata, kind:'hotel'|'food'|'spot', name, address, maps_url, note, city, stay_hours}
--   city は都市の名前（任意。空港の3レターとは別に、人が読む名前として持つ）。
--   stay_hours はステイ時間（任意・ホテルだけ。そのホテルでのステイがおよそ何時間か。1〜240 の整数）。
--     ホテル以外に付けて送っても弾かない。保存せずに捨てる（item.stay_hours は null で返る）。
-- 返り値: {ok:true, item:{…一覧と同じ形…}}。入った時点では state:'pending'。
-- 弾いたときは例外ではなく {ok:false, status:…} を返す（画面は理由ごとに違う一言を出す）。
--   locked        資格が無い（★何も調べずに返す）
--   bad_airline   名簿に無い・無効・'other'
--   bad_iata      英字3字でない
--   bad_kind      白リストの外
--   bad_name      名前が2〜80字でない
--   too_long      住所が200字・メモが500字を超える
--   bad_city      都市の名前が60字を超える
--   bad_hours     ステイ時間が 1〜240 の整数でない（ホテルのときだけ）
--   too_fast      30秒以内の連投
--   rate_limited  24時間に20件
--   duplicate     自分が同じ名前を既に出している
--   exists        同じ名前が既に**公開済み**
-- ★ exists は公開済みの行だけを見る。他人の確認前の行と比べない
--   （比べると「誰かがそのホテルを出したところだ」が分かってしまう）。
-- ★ 地図のリンクが通らなくても投稿は通す（リンクだけ捨てる）。
-- ★ 中身の検品は 3-k（pv_stay_clean）、同じ名前の判定は 3-l（pv_stay_clash）。
--   どちらも直す口（5-b）と同じものを呼ぶ。ここに式を書き戻さない。
create or replace function public.pv_stay_add(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_role text;
  v_sees boolean;
  v_all  boolean;
  v_me   text;
  v_air  text;
  v_iata text;
  v_bad  text;
  v_kind text;
  v_name text;
  v_addr text;
  v_note text;
  v_url  text;
  v_city text;
  v_hours int;
  v_n    int;
  v_row  public.pv_stay_places%rowtype;
begin
  v_role := public.pv_stay_role();
  if v_role is null then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  -- 返す1件の形を、読む口と同じ「見てよい人か」で作る（足した直後の行には写真がまだ無い）
  v_sees := public.pv_stay_sees();
  v_all := (v_role = 'operator' and v_sees);
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

  -- 中身の検品（種別・名前・住所・メモ・都市・ステイ時間・地図のリンク）は 3-k の1か所
  select c.status, c.kind, c.name, c.address, c.maps_url, c.note, c.city, c.stay_hours
    into v_bad, v_kind, v_name, v_addr, v_url, v_note, v_city, v_hours
    from public.pv_stay_clean(p) c;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'status', v_bad);
  end if;

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

  -- 自分の重ね出し（duplicate）／既に公開されている同じ名前（exists）。判定は 3-l の1か所
  v_bad := public.pv_stay_clash(v_me, v_air, v_iata, v_kind, v_name, null);
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'status', v_bad);
  end if;

  insert into public.pv_stay_places
    (author_hash, airline, iata, kind, name, address, maps_url, note, city, stay_hours)
  values (v_me, v_air, v_iata, v_kind, v_name, v_addr, v_url, v_note, v_city, v_hours)
  returning * into v_row;

  return jsonb_build_object('ok', true, 'item',
    public.pv_stay_place_json(v_row, array[v_me], v_all, v_sees));
end;
$fn$;

revoke all on function public.pv_stay_add(jsonb) from public, anon;
grant execute on function public.pv_stay_add(jsonb) to authenticated;

comment on function public.pv_stay_add(jsonb) is
  'ステイ情報を1件足す。見てよい人（オーナーとオーナーが承認した人）と運営だけ。pending で入る（運営が見るまで他人に出ない）。名前2〜80字・住所200字・メモ500字・都市60字・ステイ時間はホテルだけで1〜240時間（任意）・30秒/20件24時間。地図のリンクは Google マップ以外なら捨てる。';


-- ════════════════════════════════════════════════════════════════
-- 5-b. 直す（場所。★書いた本人だけ）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {id:<場所の id>, kind, name, address, maps_url, note, city, stay_hours}
--   ★ 直すのは**送ってきた欄だけ**。送らなかった欄は今のまま残る。
--     欄を消したいときは null か空を送る（名前と種別は消せない＝検品で弾く）。
--   ★ ステイ時間（stay_hours）はホテルだけの欄。種別をホテルからほかへ直すと、送らなくても消える
--     （3-k がホテル以外では必ず null にそろえる。ここに式を書き足していない）。
--     ホテルへ戻しても、前の時間は戻らない（書き直してもらう）。
--   ★ 会社（airline）と空港（iata）は読まない＝変わらない。送られてきても無視する。
--     そこが変わるなら別の場所なので、消して足し直してもらう。
-- 返り値:
--   直した        → {ok:true, changed:true,  item:{…一覧と同じ形…}}   item.state は 'pending'
--   何も変わらない → {ok:true, changed:false, item:{…}}                状態も回数もそのまま
--   locked        資格が無い（★何も調べずに返す）
--   not_found     その場所が無い・自分のものではない・id の形が違う（★同じ答え。消す口と同じ）
--   final         見送られたものは直せない（出し直してもらう。公開へ戻す道が無いので、直しても出ない）
--   bad_kind／bad_name／too_long／bad_city／bad_hours   足す口と同じ検品（3-k）
--   rate_limited  24時間に20回
--   duplicate／exists   名前か種別を変えた先に、同じ名前がもう在る（3-l。足す口と同じ決まり）
-- ★ 直したら必ず 'pending' へ戻す（2026-10-05 オーナー決定「修正した投稿は運営の確認待ちへ戻す」）。
--   公開済みでも、その瞬間からほかの人には出なくなる（3-d の決まりのまま）。本人には出続ける。
--   運営が見た時刻（moderated_at）も消す ＝ 待ち行列の「まだ見ていないもの」と同じ姿に戻す。
--   直された場所を運営が通すには、見たときの中身の印（rev）が要る（8 の changed）。
-- ★ 付いている写真の状態は触らない。場所が確認待ちの間は、公開済みの写真もほかの人には
--   出ない（7 の読む口が場所の見える・見えないも通している）。運営が場所を通せばまた出る。
-- ★ 直せるのは書いた本人だけ。運営でも他人のものは not_found（運営の道は 8 の公開する／見送る
--   と 9 の消す。中身を書き換える力を運営に持たせると、誰の言葉か分からなくなる）。
--   運営が自分で書いたものは、書いた本人として直せる。確認待ちへ戻り、自分では公開できない
--   （8 の own_post が今までどおり効く）。
-- ★ 何も変わらない送り直しは、状態を戻さない（保存ボタンを押し直しただけで公開が外れない）。
-- ★ 30秒の決まりは入れていない（続けて直すのは普通の使い方。変わらなければ何も起きない）。
-- ★ 錠の順番は「場所の行 → 人ごとの錠」。6 の写真を足す口と同じ向き（逆にすると噛み合って止まる）。
create or replace function public.pv_stay_update(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_role text;
  v_sees boolean;
  v_all  boolean;
  v_me   text;
  v_id   uuid;
  v_row  public.pv_stay_places%rowtype;
  v_in   jsonb;
  v_bad  text;
  v_kind text;
  v_name text;
  v_addr text;
  v_note text;
  v_url  text;
  v_city text;
  v_hours int;
  v_n    int;
begin
  v_role := public.pv_stay_role();
  if v_role is null then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  -- 返す1件の形（写真の並び）は、読む口と同じ「見てよい人か」で作る
  v_sees := public.pv_stay_sees();
  v_all := (v_role = 'operator' and v_sees);
  v_me := public.pv_stay_hash(auth.uid());

  v_id := public.pv_stay_uuid(p->>'id');
  if v_id is null then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  -- ★ 自分のものだけを探す。他人のもの・無い id は、どちらも「見つからない」
  select * into v_row from public.pv_stay_places
   where id = v_id and author_hash = v_me
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  if v_row.state = 'rejected' then
    return jsonb_build_object('ok', false, 'status', 'final');
  end if;

  -- いまの中身の上に、送ってきた欄だけを重ねてから検品する（会社と空港は重ねない）
  v_in := jsonb_build_object(
            'kind', v_row.kind, 'name', v_row.name, 'address', v_row.address,
            'maps_url', v_row.maps_url, 'note', v_row.note, 'city', v_row.city,
            'stay_hours', v_row.stay_hours)
          || case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end;

  select c.status, c.kind, c.name, c.address, c.maps_url, c.note, c.city, c.stay_hours
    into v_bad, v_kind, v_name, v_addr, v_url, v_note, v_city, v_hours
    from public.pv_stay_clean(v_in) c;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'status', v_bad);
  end if;

  -- 何も変わっていなければ、ここで終わり（状態も回数も動かさない）
  if v_kind is not distinct from v_row.kind
     and v_name is not distinct from v_row.name
     and v_addr is not distinct from v_row.address
     and v_url  is not distinct from v_row.maps_url
     and v_note is not distinct from v_row.note
     and v_city is not distinct from v_row.city
     and v_hours is not distinct from v_row.stay_hours then
    return jsonb_build_object('ok', true, 'changed', false, 'item',
      public.pv_stay_place_json(v_row, array[v_me], v_all, v_sees));
  end if;

  -- 同じ人の同時の2本を1列に並べる（回数の数え方をすり抜けさせない）
  perform pg_advisory_xact_lock(hashtextextended('pv_stay:' || v_me, 0));

  -- 1日の上限（足す口と同じ 20。直すたびに運営の待ち行列へ戻るので、際限なく戻させない）
  select coalesce(sum(edit_n), 0) into v_n from public.pv_stay_places
   where author_hash = v_me and edit_from > now() - interval '24 hours';
  if v_n >= 20 then
    return jsonb_build_object('ok', false, 'status', 'rate_limited');
  end if;

  -- 名前か種別を変えたときだけ、変えた先に同じ名前が在るかを見る（自分自身は数えない）
  if v_kind <> v_row.kind or lower(v_name) <> lower(v_row.name) then
    v_bad := public.pv_stay_clash(v_me, v_row.airline, v_row.iata, v_kind, v_name, v_id);
    if v_bad is not null then
      return jsonb_build_object('ok', false, 'status', v_bad);
    end if;
  end if;

  update public.pv_stay_places
     set kind         = v_kind,
         name         = v_name,
         address      = v_addr,
         maps_url     = v_url,
         note         = v_note,
         city         = v_city,
         stay_hours   = v_hours,
         state        = 'pending',
         moderated_at = null,
         updated_at   = now(),
         edit_n       = case when edit_from > now() - interval '24 hours'
                             then edit_n + 1 else 1 end,
         edit_from    = case when edit_from > now() - interval '24 hours'
                             then edit_from else now() end
   where id = v_id
  returning * into v_row;

  return jsonb_build_object('ok', true, 'changed', true, 'item',
    public.pv_stay_place_json(v_row, array[v_me], v_all, v_sees));
end;
$fn$;

revoke all on function public.pv_stay_update(jsonb) from public, anon;
grant execute on function public.pv_stay_update(jsonb) to authenticated;

comment on function public.pv_stay_update(jsonb) is
  '自分が足した場所の中身（名前・種別・住所・地図のリンク・メモ・都市・ステイ時間）を直す。書いた本人だけ。直したら pending へ戻る（運営が見るまで他人に出ない）。会社と空港は変えられない。何も変わらなければ状態を戻さない。24時間に20回まで。';


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
  v_sees  boolean;
  v_all   boolean;
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
  -- ★ 写真を足せるのは、見てよい人（オーナーかオーナーが承認した人。約束 1）だけ。運営であることだけでは足せない
  v_sees := public.pv_stay_sees();
  if not v_sees then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  v_all := (v_role = 'operator' and v_sees);
  v_me := public.pv_stay_hash(auth.uid());

  v_pid := public.pv_stay_uuid(p->>'place');
  if v_pid is null then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;
  select * into v_place from public.pv_stay_places where id = v_pid for share;
  -- 見えない場所・見送られた場所には付けられない。在るかどうかも答えない
  if not found
     or v_place.state = 'rejected'
     or not public.pv_stay_visible(v_place.state, v_place.author_hash, array[v_me], v_all, v_sees) then
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
  -- ★ 上限は、写真を読む前に見る（2026-10-08）。作り直しは重い仕事なので、
  --   上限に達した人の写真は decode も作り直しもしない。錠もここで取る ＝
  --   同じ人の写真は1枚ずつ順に作り直す（並べて何枚も同時に走らせられない）。
  --   ⚠️ 数えているのは「いま在る行」。自分で消すと数は戻る（＝ 足して消すを繰り返す人は
  --   上限に当たらない）。行は溜まらず、呼べるのは確認済みのパイロットだけなので、いまは許している。
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
  'ステイ情報に写真を1枚足す。見てよい人（オーナーとオーナーが承認した人）だけ（運営であることだけでは足せない）。JPEG・50万バイトまで・pending で入る。届いた JPEG はサーバーで作り直し（撮影情報・付帯情報を全部落とす）、作り直したものだけを保存する。幅と高さは写真から読む（送られた w・h は読まない）。1つの場所に自分の写真は4枚まで・24時間に30枚。';


-- ════════════════════════════════════════════════════════════════
-- 7. 写真を1枚読む
-- ════════════════════════════════════════════════════════════════
-- 一覧では写真を返さない（数枚でも数百KBずつ乗る）。画面が1枚ずつ取りにくる。
-- 引数: p = {id:<写真の id>}
-- 返り値: {ok:true, mime:'image/jpeg', w, h, state, b64}。画面が data: URL にして貼る。
-- ★ 門は3つ全部。資格がある／場所が自分に見える／写真が自分に見える
--   （公開済みか、自分のか、運営か）。
--   資格 ＝ 見てよい人（オーナーかオーナーが承認した人。約束 1）。
--   もう1つだけ口がある: 運営は、写真か場所が**確認待ち**のあいだだけ、その写真を読める
--   （待ち行列から開いて見るため）。公開済みのものは、見てよい人でなければ運営でも読めない。
--   この口も、オーナーが決まるまでは開かない（オーナーの行が無いあいだは、誰も読めない）。
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
  v_sees  boolean;
  v_all   boolean;
  v_mod   boolean;
  v_me    text;
  v_id    uuid;
  v_f     public.pv_stay_photos%rowtype;
  v_place public.pv_stay_places%rowtype;
begin
  v_role := public.pv_stay_role();
  if v_role is null then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  v_sees := public.pv_stay_sees();
  v_all := (v_role = 'operator' and v_sees);
  -- 運営の「確認待ちを1枚見る」口（オーナーが決まっていないあいだは開かない）
  v_mod := (v_role = 'operator' and public.pv_stay_owner_id() is not null);
  if not v_sees and not v_mod then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
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
     or not ((public.pv_stay_visible(v_place.state, v_place.author_hash, array[v_me], v_all, v_sees)
              and public.pv_stay_visible(v_f.state, v_f.author_hash, array[v_me], v_all, v_sees))
             or (v_mod and (v_f.state = 'pending' or v_place.state = 'pending'))) then
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
  'ステイ情報の写真を1枚 base64 で返す。見てよい人（オーナーとオーナーが承認した人）には公開済みと自分の写真、見てよい人でもある運営には全部。運営は、写真か場所が確認待ちのあいだだけ読める（オーナーが決まっていなければ読めない）。author_hash は返さない。';


-- ════════════════════════════════════════════════════════════════
-- 8. 運営が見る（公開する／見送る）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {target:'place'|'photo', id, state:'public'|'rejected', rev}
--   rev は、運営が見た行に付いていた中身の印（4 の一覧・10 の待ち行列が返す。3-m）。
--   読むのは**場所を公開するとき**だけ。見送るとき・写真のときは読まない。
-- 返り値: {ok:true, target, id, state}
--   forbidden   運営ではない（★何も調べずに返す）
--   bad_state   'public' と 'rejected' 以外（★この口から 'pending' へ戻す道は無い。
--               'pending' へ戻るのは、書いた本人が中身を直したときだけ＝5-b）
--   bad_target  'place' と 'photo' 以外
--   not_found   その id が無い
--   own_post    自分が出したものを自分で公開しようとした
--   final       見送ったものは公開へ戻せない（出し直してもらう）
--   changed     運営が見たあとで中身が直されている（★何も変えずに返す。読み直してから通す）
-- ★ own_post が要。運営が自分で書いて自分で通せると、「人が1回見る」が
--   「書いた本人が見た」になる。見送る側は自分のものでもできる（害が無い）。
-- ★ changed も同じ約束の続き。場所を公開するとき、
--     rev が届いていれば … いまの中身の印と同じでなければ通さない。
--     届いていなければ   … **一度も直されていない場所だけ**通す
--                          （足したときの中身のまま ＝ 運営が見たものと同じ）。
--   ＝ 直された場所は、id だけでは公開できない。id だけで通すと、運営が一覧を見てから
--   押すまでの間に本人が直した中身が、誰の目も通らずに出る（約束 5）。
--   見送る側は印が要らない（見ていない中身を外へ出す向きではない）。
-- ★ 直された場所を通すときは、付いている写真も見直す。場所が確認待ちの間、公開済みだった
--   写真はほかの人から隠れているだけで、場所を通した瞬間にそのまま出る（写真は見直しに戻らない）。
--   待ち行列の行にも、一覧の行にも、その場所の写真の並び（photos）が付いている。
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
  v_rev    text;
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
    -- ★ 通すのは運営が見た中身だけ。行は上で錠を掛けて読んであるので、
    --   ここで比べた中身と、下で公開する中身は同じもの（間に本人の直しは入れない）。
    --   空の rev は「届いていない」と同じに扱う。
    v_rev := nullif(btrim(coalesce(p->>'rev', '')), '');
    if v_state = 'public'
       and (v_rev is not null or v_place.updated_at is not null)
       and v_rev is distinct from public.pv_stay_rev(v_place) then
      return jsonb_build_object('ok', false, 'status', 'changed');
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
--          places:[{airline, iata, rev, …一覧と同じ形…}],     確認待ちの場所（rev ＝ いま見ている版の印。公開するときに添えて返す）
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
      select public.pv_stay_place_json(s, array[v_me], true, true)
               || jsonb_build_object('airline', s.airline, 'iata', s.iata, 'rev', public.pv_stay_rev(s)) as j,
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
-- 10-b. オーナーを1人だけ決める（★ここだけ手で直す）── 約束 1
-- ════════════════════════════════════════════════════════════════
--     下の1行のメールアドレスを、オーナーがログインするアカウントのものに置き換えてから流す。
--     （Authentication → Users に出ている address のこと）
--     ★ 置き換えないまま流しても、誰にも当たらない ＝ オーナーの行は入らない ＝ 誰にも開かない。
--       置き換えて1度流したあとは、置き換えないまま貼り直しても、入っているオーナーはそのまま。
--     ★ オーナーを替えると、前のオーナーが承認した人は全員 locked に戻る（承認は人ごとにやり直す）。
insert into public.pv_stay_owner (user_id)
select id from auth.users
 where email = 'ここにオーナーのログイン用メールアドレスを入れる'
on conflict (one) do update set user_id = excluded.user_id, set_at = now();


-- ════════════════════════════════════════════════════════════════
-- 11. 検算（貼ったあとに出る1行）
-- ════════════════════════════════════════════════════════════════
-- ポリシー数は 0 が正しい（場所・写真の表と、見てよい人の名簿の2表の合計）。
-- オーナーは 1 が正しい。0 のあいだは誰にも見えない（上の 10-b の1行を、メールアドレスを入れて流す）。
-- 承認した人は、いまのオーナーが承認した人の数（オーナー自身は数えない。申し込み・見送り・取り消しは数えない）。
select (select count(*) from pg_policies
         where schemaname = 'public'
           and tablename in ('pv_stay_places', 'pv_stay_photos'))
     + (select count(*) from pg_policies
         where schemaname = 'public'
           and tablename in ('pv_stay_owner', 'pv_stay_viewers'))      as ポリシー数,
       (select count(*) from public.pv_stay_owner)                     as オーナー,
       (select count(*) from public.pv_stay_viewers v
         where v.state = 'approved'
           and v.decided_by = (select o.user_id from public.pv_stay_owner o)) as 承認した人,
       (select count(*) from public.pv_admins)                         as 運営;
