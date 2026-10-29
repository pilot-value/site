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
--       公開する／見送る（待ち行列・公開の口・確認待ちの写真を1枚読む口・管理ページの「追加」＝ 足す口の publish:true）。
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
--  2. 見てよい人でなければ、ほかの人が足したものは何も返さない。pv_stays は {ok:true, state:'locked'} **だけ**。
--     名前も、件数も、「在る／無い」も返さない（足す口・直す口の exists も、見てよい人にしか答えない。
--     ただ1つ、運営が管理ページの「追加」（足す口の publish:true）で足すときは、公開の行に同じ名前を2つ作らないために答える）。
--     ★ 自分が足したものだけは、足した本人に返す（own。写真は並べない）。「本人」の証拠は、ログイン（その人の印）か、
--       ログインせずに足したときにサーバーが作って返した端末の鍵（pv_stay_keys に sha256 だけを置く）。
--     ★ ログインしていない人と、ログインしただけの人を、返事で見分けない（同じ字。言い方は画面が決める）。
--  3. user_id を持たない。author_hash だけ（区切りは '::pv_hotel::'）。
--     ★ ログインせずに足した行の印は、端末の鍵の印（区切りは '::pv_hotel_key::'）。ログインした人が引き取ると、その人の印に替わる。
--     （投稿の表＝場所と写真の話。見てよい人の名簿 pv_stay_owner・pv_stay_viewers だけは user_id を
--       持つ ── その人に見せてよいかの印で、投稿とは1度も突き合わせない。投稿は author_hash のまま。）
--     ★ 要望（'::pv_req::'）・給与・待遇のハッシュと区切りを変えてある
--       ＝ 表どうしを突き合わせて「同じ人」を束ねられない。
--     ★ author_hash を画面へ返す関数を1つも作らない。返すのは「自分のか」（mine）だけ。
--  4. 表は完全に閉じる。ポリシーを1つも作らない＝ anon も authenticated も
--     直接は1行も読めない・書けない。出入口は security definer の関数だけ。
--  5. 場所も写真も 'pending' で入る。運営が見るまで、書いた本人と運営にしか出ない。
--     ★ 足すのは誰でもできる（ログインも要らない。2026-10-11 オーナー決定）。決め方は pv_stay_may_add() の1行。
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
--       ただ1つの例外：運営が管理ページの「追加」から足したもの（足す口に publish:true を添えたとき）は、その場で公開で入る。
--     ★ 運営の口（pv_stay_moderate）から 'pending' へ戻す道は無い。見送った写真は画素ごと消す。
--     ★ 'pending' へ戻るのは、**書いた本人が場所の中身を直したときだけ**（5-b の pv_stay_update）。
--       公開済みでも、直した瞬間にほかの人から見えなくなり、運営がもう一度見る
--       （2026-10-05 オーナー決定「修正した投稿は運営の確認待ちへ戻す」）。
--       ＝ 一度通ったものを、あとから誰の目も通らない中身へ書き換える道を作らない。
--     ★ 運営が通すのは**運営が見た中身**だけ。直された場所は、見たときの中身の印（rev。3-m）を
--       添えないと公開できない（8 の changed）。運営が見てから押すまでの間に本人が直していたら、
--       通さずに「変わった」と返す。id だけで通すと、その間に直された中身が誰の目も通らずに出る。
--  6. 「見えるかどうか」の判定は pv_stay_visible() ただ1つ。場所にも写真にも同じ式を使う。
--     ★ 見てよい人でない人へ自分の行（own）を返すときは「書いた人の印が、呼んだ人の手のどれかと同じ」だけで選ぶ
--       （pv_stay_visible に p_op・p_sees を false で渡したのと同じ答え。4 の一覧）。
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

-- 端末の鍵。ログインせずに足した人が「自分が足したもの」を見る・直す・消すための、ただ1つの証拠。
-- 鍵そのものは持たない（sha256 だけ）。場所の author_hash には、この key_hash がそのまま入る。
-- ★ ログインした人が引き取ったら、この行は消える（5-c の pv_stay_claim）。足したものが1つも無い鍵も、1日たてば消す。
create table if not exists public.pv_stay_keys (
  key_hash    text primary key,
  created_at  timestamptz not null default now(),
  -- 鍵を作った回線の、その日だけの印（同じ回線が1日に作れる鍵を数えるためだけ。IP そのものは持たない）。
  -- ★ 1日たったら null にする（数えるのはその日だけ。残しておくと「どの回線が・どの日に足したか」が表に残る）
  ip_day_hash text
);
alter table public.pv_stay_keys drop constraint if exists pv_stay_keys_hash_ck;
alter table public.pv_stay_keys add constraint pv_stay_keys_hash_ck check (key_hash ~ '^[0-9a-f]{64}$');
create index if not exists pv_stay_keys_ip_idx on public.pv_stay_keys (ip_day_hash, created_at desc);

-- 回線ごとの、その日に足せた数（2026-10-18 オーナーの答え Q3「②」── 同じ回線からログインせずに足せるのは1日40件まで）。
--   ★ 鍵の行の印では数えられない：鍵の印は「鍵を作った日」の回線にしか付かず、1日で空になる。前の日に作った端末で足したものが
--     数えから漏れる（1つの回線が、残っている端末の数だけ 20件ずつ足せてしまう）。だから、足せた1件ごとにここを1つ進める。
--   ip_day_hash  鍵の表と同じ式の、その日だけの回線の印（IP そのものは持たない。日付が式に入っている ＝ 日が替われば別の印）
--   n            その日に、その回線からログインせずに足せた数（断った呼び出しは数えない。あとで消しても減らさない）
--   first_at     その日の1件目の時刻（片づけのためだけ ── 1日たったら行ごと消す。3-c5）
--   ★ どの場所・どの鍵・どの人とも結びつけない（行は回線の印と数だけ）。誰にも読ませない・返さない（入口は 5 の足す口だけ）
create table if not exists public.pv_stay_ip_day (
  ip_day_hash text primary key,
  n           integer not null default 0,
  first_at    timestamptz not null default now()
);
alter table public.pv_stay_ip_day drop constraint if exists pv_stay_ip_day_hash_ck;
alter table public.pv_stay_ip_day add constraint pv_stay_ip_day_hash_ck check (ip_day_hash ~ '^[0-9a-f]{64}$');

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
alter table public.pv_stay_keys   enable row level security;
alter table public.pv_stay_ip_day enable row level security;

revoke all on public.pv_stay_places from public, anon, authenticated;
revoke all on public.pv_stay_photos from public, anon, authenticated;
revoke all on public.pv_stay_keys   from public, anon, authenticated;
revoke all on public.pv_stay_ip_day from public, anon, authenticated;

-- 既に作ってしまったポリシーがあれば落とす（冪等・事故防止）
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
            where schemaname = 'public'
              and tablename in ('pv_stay_places', 'pv_stay_photos', 'pv_stay_keys', 'pv_stay_ip_day') loop
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

-- あとから足した列（2026-10-17・P12.51）。表が前から在る所へ貼り直しても入るように、ここで足す。
--   ever_applied  画像つきの申請（10-c）を、オーナーが決めて終えたことがあるか（true / false だけ。時刻も画像も持たない）。
--                 申請の行と画像は決めた瞬間に消えるので、「申請したことがある」はここにだけ残る。
--                 ★申請したことのある人は、画像を見ずには承認しない（10-a-2b の pv_stay_image_needed。例外は下の image_verified だけ）。
--                 ★どの関数も画面へ返さない。書くのは verified（10-c-5）の承認の行の1文だけ・false に戻す道は無い
--                   （取り消し・見送り・オーナーを替える・貼り直す、のどれでも残る）。
alter table public.pv_stay_viewers add column if not exists ever_applied boolean not null default false;
-- あとから足した列（2026-10-18・P12.61 オーナーの答え Q1 = 2）。
--   image_verified  オーナーが申請の画像を見て verified にしたことがあるか（true / false だけ。時刻も画像も持たない）。
--                   ★ これが true で、いまのオーナーが取り消した人だけは、新しい画像なしで verified に戻せる（オーナーが押したときだけ。
--                     10-a-2b の pv_stay_image_needed）。画像を見て見送った人・古い申し込みの行・画像で verified になったことのない人には付かない。
--                   ★ 書くのは verified（10-c-5）の承認の行の1文だけ ── 申請してきた人の道で、画像が在るまま「verified」を押して状態が
--                     変わったときだけ true。false に戻す道は無い（取り消し・見送り・オーナーを替える・貼り直す、のどれでも残る）。
--                   ★ どの関数も画面へ返さない（会員一覧が返すのは、今までどおり reapply の true / false だけ）。
--                   ★ この列を足す前に画像で verified にした行は false のまま（推測で埋めない ＝ その人は今までどおり新しい画像が要る）。
alter table public.pv_stay_viewers add column if not exists image_verified boolean not null default false;

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

-- 3-a2. 端末の鍵 → 表に置く形。サーバーが作った形（英数48字）でなければ null。
create or replace function public.pv_stay_key_hash(v_key text)
returns text
language sql
immutable
set search_path = public, extensions
as $fn$
  select case when v_key ~ '^[0-9a-f]{48}$'
              then encode(extensions.digest(v_key || '::pv_hotel_key::', 'sha256'), 'hex') end;
$fn$;

revoke all on function public.pv_stay_key_hash(text) from public, anon, authenticated;

-- 3-a3. 呼んだ人の「手」（書いた人の印の並び）。ログインしていればその人の印、端末の鍵が届いていればその印。
-- どちらも無ければ空。★表を読まない（届いた鍵が本物かどうかは、足す口 5 と引き取る口 5-c が表で確かめる。
--   読む・直す・消すでは、表に無い鍵の印は「誰の行とも合わない印」でしかない ＝ 何も返らない・何も変わらない）。
create or replace function public.pv_stay_me(p jsonb)
returns text[]
language sql
stable
set search_path = public, extensions
as $fn$
  select array_remove(array[
           case when auth.uid() is not null then public.pv_stay_hash(auth.uid()) end,
           case when jsonb_typeof(p) = 'object' then public.pv_stay_key_hash(p->>'key') end
         ], null);
$fn$;

revoke all on function public.pv_stay_me(jsonb) from public, anon, authenticated;


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

-- 3-c3. 「足してよい人」の決め方（★ここ1行だけ）
-- いま: 誰でも（2026-10-11 オーナー決定「ログインも要らない（誰でも追加できる）」）。
-- 見てよい人（オーナーとオーナーが承認した人）と運営だけへ戻すとき: 下の select の1行を、次の1行に替える。
--     select coalesce(public.pv_is_operator(), false) or coalesce(public.pv_stay_sees(), false);
-- ★ 足せることは何も開かない。読めるかどうかは、今までどおり pv_stay_sees() だけが決める。
create or replace function public.pv_stay_may_add()
returns boolean
language sql
stable
set search_path = public, extensions
as $fn$
  select true as anyone;
$fn$;

revoke all on function public.pv_stay_may_add() from public, anon, authenticated;

-- 3-c4. 1日に足せる数・直せる回数。ログインしている人は 20。端末の鍵だけの人も 20
--   （2026-10-16 オーナー「ログインしていない人 1日20件までにしようよ。」。前は端末の鍵だけの人は 5）。
--   2つの数を分けて書いておくのは、片方だけ変えるときに、ここ1か所で済むようにするため。
--   （同じ回線が1日に作れる鍵は20本。そのうえで、同じ回線からログインせずに足せるのは端末をまたいで1日40件まで ── 5 の足す口・
--    2026-10-18 オーナーの答え Q3。数えるのは 1 の pv_stay_ip_day（足せた1件ごとに進める ＝ 前の日に作った端末で足したものも数える）。
--    サイト全体の待ちの上限 200 に届いたら、ログインしていない人の追加は queue_full で止まる。運営が見れば、また足せる）。
create or replace function public.pv_stay_cap(p_device boolean)
returns integer
language sql
immutable
set search_path = public, extensions
as $fn$
  select case when coalesce(p_device, false) then 20 else 20 end;
$fn$;

revoke all on function public.pv_stay_cap(boolean) from public, anon, authenticated;

-- 3-c5. 端末の鍵の表の片づけ（★回線の印を空にする文と、足したものが無い鍵を消す文は、この1か所だけ）
--   回線の印は1日だけ／足したものが1つも無い鍵は1日で消す／回線ごとのその日の数（pv_stay_ip_day）は、1件目から1日たったら行ごと消す
--   （その行の印は前の日のもの ＝ もう数えには使わない）。
--   流れるのは2か所：ログインせずに足すたびに毎回（5 の足す口）と、毎時の片づけ（10-d。pg_cron が在るときだけ）。
--   ＝ 誰も足さない日が続いても、作って1日たった印は、遅くとも1時間あとに消える
--     （個人データのページの「1日だけ保持し、その後削除します」は、この2か所で本当になる）。
--   ほかの呼び出しが掴んでいる行は、待たずに飛ばす（飛ばした行は、次の呼び出しが片づける。db/contrib.sql と同じ形）。
--   ★ 足したもの（場所・写真）には触らない。足したものが在る鍵は、印を空にするだけで残す。
create or replace function public.pv_stay_key_sweep()
returns void
language sql
set search_path = public, extensions
as $fn$
  update public.pv_stay_keys k
     set ip_day_hash = null
   where k.key_hash in (
           select x.key_hash from public.pv_stay_keys x
            where x.ip_day_hash is not null
              and x.created_at <= now() - interval '1 day'
            order by x.key_hash
              for update skip locked);
  delete from public.pv_stay_keys k
   where k.key_hash in (
           select x.key_hash from public.pv_stay_keys x
            where x.created_at <= now() - interval '1 day'
              and not exists (select 1 from public.pv_stay_places s where s.author_hash = x.key_hash)
            order by x.key_hash
              for update skip locked);
  delete from public.pv_stay_ip_day d
   where d.ip_day_hash in (
           select x.ip_day_hash from public.pv_stay_ip_day x
            where x.first_at <= now() - interval '1 day'
            order by x.ip_day_hash
              for update skip locked);
$fn$;

revoke all on function public.pv_stay_key_sweep() from public, anon, authenticated;


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
-- ★ exists は、見てよい人（p_sees）にだけ答える。見てよい人でない人に答えると、名前を1つずつ足してみるだけで
--   「そのホテルが載っているか」が分かる（載っている名前は、見てよい人にしか返さない約束 2）。
--   見てよい人でない人が足した同じ名前は、確認待ちとして受け取り、運営が通すとき（8）に exists で止める。
drop function if exists public.pv_stay_clash(text, text, text, text, text, uuid);

create or replace function public.pv_stay_clash(
  p_me text, p_air text, p_iata text, p_kind text, p_name text, p_skip uuid, p_sees boolean)
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
    when coalesce(p_sees, false) and exists (select 1 from public.pv_stay_places
                  where airline = p_air and iata = p_iata
                    and kind = p_kind and lower(name) = lower(p_name)
                    and state = 'public'
                    and id is distinct from p_skip) then 'exists'
    else null end;
$fn$;

revoke all on function public.pv_stay_clash(text, text, text, text, text, uuid, boolean)
  from public, anon, authenticated;

comment on function public.pv_stay_clash(text, text, text, text, text, uuid, boolean) is
  '同じ会社・空港・種別に同じ名前が在るか。''duplicate''（自分のもの）／''exists''（公開済み。見てよい人にだけ答える）／null。他人の確認前の行とは比べない。';


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


-- 3-n. 会社ごとの就航地（★運営の「追加」＝ 足す口の publish:true が、その場で公開で入れてよい空港は、ここに在るものだけ）
-- 会社ページの「ステイ先」に並ぶ空港と同じ一覧（先行5社 ＝ airline-destinations.mjs の NETWORK の list の写し／ほかの会社（2026-10-21 全社へ広げる d1）＝
-- 調べで確かめた就航地（pv-airline-view.mjs の viewOf(slug).network の list）の写し。本拠地は入れない）。
-- ★ 載っていない空港に運営が「追加」すると、どのページにも出ない公開の行ができてしまう（3字の打ち間違い）。
--   ＝ 5 の足す口は、publish:true のときだけ、ここに無い空港を bad_iata で止める（何も書かない）。
--   会員・未ログインの足す口と、publish を添えない運営の足す口は、今までどおり（確認待ちで入り、運営が見る）。
-- ⚠️ 中身は手で書かない ── node gen-stay-network.mjs が書く（2026-10-29 から。96社に広げたとき手の写しを直し忘れた）。
--    airline-destinations.mjs・調べの台帳の就航地・airline-display.mjs の NET を直したら流す。db/test-stays.mjs と assert-generated.mjs が突き合わせる。
--    40社ずつ || でつないでいるのは、Postgres の関数が引数を100個（＝50社）までしか受け取らないため。
create or replace function public.pv_stay_network()
returns jsonb
language sql
immutable
set search_path = public, extensions
as $fn$
  select jsonb_build_object(
    'jal', regexp_split_to_array(btrim('
      CTS MMB AKJ KUH OBO HKD AOJ MSJ KMQ NGO KIX ITM SHM OKJ IZO HIJ TKS TAK KCZ MYJ
      FUK KKJ OIT NGS KMJ KMI KOJ ASJ OKA BKK SIN KUL CGK HAN SGN MNL DEL BLR PEK SHA
      PVG CAN DLC TSN HKG TSA TPE GMP GUM SYD MEL JFK BOS ORD DFW SFO LAX SAN SEA YVR
      HNL LHR CDG FRA HEL
    ', E' \n'), '\s+'),
    'ana', regexp_split_to_array(btrim('
      ITM KIX UKB CTS NGO FUK OKA KOJ KMI NGS SDJ KMJ MYJ HIJ OIT ISG MMY AXT KCZ KIJ
      HKD IWK TAK HSG OKJ UBJ KMQ TTJ YGJ SYO KUH TOY TKS SHB NTQ HAC IWJ WKJ ONJ DEL
      BOM BKK HAN SGN KUL SIN CGK MNL PEK DLC TAO PVG SHA HGH CAN SZX HKG TSA GMP SYD
      PER LAX SFO SEA IAD JFK IAH ORD YVR HNL MEX LHR CDG FRA MUC BRU VIE MXP ARN IST
    ', E' \n'), '\s+'),
    'eva-air', regexp_split_to_array(btrim('
      NRT HND KIX UKB FUK CTS SDJ KMQ OKA AOJ MYJ TSA KHH HKG MFM PEK PVG SHA CAN HGH
      CTU ICN GMP PUS BKK CNX HAN SGN DAD SIN KUL CGK DPS MNL CEB CRK KTI BNE LAX SFO
      SEA JFK ORD IAH DFW IAD YVR YYZ LHR CDG AMS VIE MUC MXP
    ', E' \n'), '\s+'),
    'cathay-pacific', regexp_split_to_array(btrim('
      FUK NGO KIX CTS HND NRT BLR MAA DEL HYD BOM DPS CGK SUB KTI SIN CMB BKK HKT KTM
      DAC CEB MNL HAN SGN KUL PEN PEK CSX CTU CKG FOC CAN HAK HGH NKG NGB TAO PVG SHA
      URC WNZ WUH XIY XMN CGO KHH TPE ICN ADL BNE MEL PER SYD AKL CHC BOS ORD DFW LAX
      JFK SFO SEA YYZ YVR LHR MAN MXP FCO AMS ZRH BCN MAD FRA MUC CDG BRU JNB
    ', E' \n'), '\s+'),
    'etihad', regexp_split_to_array(btrim('
      KIX NRT AMD BLR MAA CMB DAC HYD ISB JAI KHI COK CCU CCJ LHE MLE BOM DEL PEW TRV
      DPS BKK PKX HAN HKG CGK KBL KBV KUL MNL KTI HKT ICN PVG SIN TPE TAS MEL SYD ATL
      BOS CLT ORD JFK YYZ IAD AMS ATH BCN BRU CPH DUB DUS FRA GVA IST KZN KRK LIS LHR
      MAD AGP MAN MXP SVO MUC JMK NCE PMI CDG PRG FCO LED JTR AER VIE WAW ZRH ADD DBB
      ELQ AMM BAH BEY CAI CMN DAM DMM DOH JED JNB KWI MED MCT NBO RUH SLL SEZ TLV RSI
      TUN ZNZ
    ', E' \n'), '\s+'),
    'qantas', regexp_split_to_array(btrim('
      AKL SFO HNL LAX DFW JFK
    ', E' \n'), '\s+'),
    'skymark', regexp_split_to_array(btrim('
      CTS FUK IBR KOJ NGO NGS OKA SDJ SHI UKB
    ', E' \n'), '\s+'),
    'zipair', regexp_split_to_array(btrim('
      BKK ICN SIN HNL IAH LAX SFO YVR
    ', E' \n'), '\s+'),
    'jetstar-japan', regexp_split_to_array(btrim('
      AKJ CTS FUK KCZ KIX KMI KMJ KOJ MYJ NGO NGS OIT OKA TAK
    ', E' \n'), '\s+'),
    'peach', regexp_split_to_array(btrim('
      CTS FUK HND OKA NGS NGO ISG KOJ SDJ KMI ASJ BKK PVG TPE ICN SIN HKG GMP KHH
    ', E' \n'), '\s+'),
    'solaseed', regexp_split_to_array(btrim('
      FUK ISG KMI KMJ KOJ NGO NGS OIT OKA UKB
    ', E' \n'), '\s+'),
    'spring-japan', regexp_split_to_array(btrim('
      CTS HIJ HKD NGO PEK HRB TSN PVG
    ', E' \n'), '\s+'),
    'airdo', regexp_split_to_array(btrim('
      AKJ CTS FUK HKD KUH MMB NGO OBO SDJ UKB
    ', E' \n'), '\s+'),
    'starflyer', regexp_split_to_array(btrim('
      FUK KIX NGO SDJ UBJ
    ', E' \n'), '\s+'),
    'fda', regexp_split_to_array(btrim('
      AOJ CTS FUK GAJ HNA KIJ KMJ KOJ MMJ OKD SDJ UKB
    ', E' \n'), '\s+'),
    'airjapan', regexp_split_to_array(btrim('
      SIN
    ', E' \n'), '\s+'),
    'amx', regexp_split_to_array(btrim('
      FUK ITM KMJ
    ', E' \n'), '\s+'),
    'ana-wings', regexp_split_to_array(btrim('
      CTS ISG KIX NRT OKA
    ', E' \n'), '\s+'),
    'daiichi-air', regexp_split_to_array(btrim('
      AGJ HTR TRA
    ', E' \n'), '\s+'),
    'hac', regexp_split_to_array(btrim('
      AXT HKD KUH MMB MSJ OIR RIS SHB
    ', E' \n'), '\s+'),
    'ibex', regexp_split_to_array(btrim('
      CTS FKS FUK HIJ ITM KIJ MYJ NGO OIT
    ', E' \n'), '\s+'),
    'j-air', regexp_split_to_array(btrim('
      AOJ AXT FUK GAJ HKD HND KIJ KMI MSJ SDJ UBJ OKI TKS MMB OBO MYJ KOJ KCZ OIT KMJ
      HNA CTS IZO TKN ASJ NGS SHM
    ', E' \n'), '\s+'),
    'jac', regexp_split_to_array(btrim('
      ASJ FUK ITM IZO KKX KUM MYJ OKA OKE OKI RNJ TJH TKN TNE
    ', E' \n'), '\s+'),
    'jta', regexp_split_to_array(btrim('
      ITM UEO KIX HND ISG FUK NGO MMY KMQ OKJ TPE
    ', E' \n'), '\s+'),
    'orc', regexp_split_to_array(btrim('
      AXT FUJ FUK IKI KMI KMQ NGO NGS TSJ
    ', E' \n'), '\s+'),
    'rac', regexp_split_to_array(btrim('
      ISG KTD MMD MMY OGN RNJ TRA UEO OKA
    ', E' \n'), '\s+'),
    'shin-central', regexp_split_to_array(btrim('
      MYE OIM
    ', E' \n'), '\s+'),
    'toho-air', regexp_split_to_array(btrim('
      HAC MYE OIM
    ', E' \n'), '\s+'),
    'singapore-airlines', regexp_split_to_array(btrim('
      NGO KIX SIN BKK BLR BOM CAN CGK CMB COK DAD DEL DPS HAN HKG HKT HYD ICN KNO KTI
      MAA MLE MNL PEN PVG RGN SGN SUB TPE ADL BNE MEL PER BCN MAD CDG FRA MXP JNB
    ', E' \n'), '\s+'),
    'korean-air', regexp_split_to_array(btrim('
      NGO GUM ORD HNL SEA IAD BOS SFO ATL LAS LAX JFK DFW
    ', E' \n'), '\s+'),
    'asiana', regexp_split_to_array(btrim('
      KMI SDJ HND NGO FUK NRT UKB KIX OKA CTS MNL XIY UBN YNZ ICN PVG HAN CKG CSX KTI
      CRK HKT HGH CAN CGQ TPE TAS CGK BKK YNJ TSN ALA HKG NKG SZX SGN DAD DLC PEK HRB
      TFU SIN SYD SEA SFO JFK LAX BCN FCO PRG CDG IST LHR MXP FRA BUD
    ', E' \n'), '\s+'),
    'starlux', regexp_split_to_array(btrim('
      KMJ NGO UKB FUK NRT SDJ SHI CTS HKD OKA TAK KIX KUL RMQ HAN TPE HKG CEB CGK MFM
      PQC DAD BKK SGN MNL DPS CNX SIN CRK PUS LAX ONT SFO PHX SEA PRG
    ', E' \n'), '\s+'),
    'china-airlines', regexp_split_to_array(btrim('
      NGO TPE PHX ONT SEA JFK SFO LAX
    ', E' \n'), '\s+'),
    'thai-airways', regexp_split_to_array(btrim('
      NGO BKK AMS
    ', E' \n'), '\s+'),
    'air-china', regexp_split_to_array(btrim('
      SZX PEK SFO IAD LAX JFK OTP ZAG
    ', E' \n'), '\s+'),
    'china-eastern', regexp_split_to_array(btrim('
      NGO LAX JFK SFO
    ', E' \n'), '\s+'),
    'china-southern', regexp_split_to_array(btrim('
      WUH CAN CSX LAX JFK SFO ADD
    ', E' \n'), '\s+'),
    'hainan-airlines', regexp_split_to_array(btrim('
      PEK CKG SEA BOS MAN
    ', E' \n'), '\s+'),
    'airasia', regexp_split_to_array(btrim('
      BKK DAD WUH KUL DPS DMK BTH
    ', E' \n'), '\s+'),
    'batik-air', regexp_split_to_array(btrim('
      LUW NBX KNO UPG TMC AMQ YIA BPN KOE MDC SUB AAP TKG BUU PDG SRG DPS SOC
    ', E' \n'), '\s+')
  ) || jsonb_build_object(
    'garuda-indonesia', regexp_split_to_array(btrim('
      KNO PNK SUB TKG BDO UPG PKU CGK SIN YIA GTO BPN SRG DPS SYD MEL
    ', E' \n'), '\s+'),
    'hong-kong-express', regexp_split_to_array(btrim('
      OKA SDJ HND NGO NRT TAK HIJ KIX FUK KMQ CJU KHH NGB CZX BKK PUS TAE PQC PKX BKI
      RMQ SYX HAN MNL ICN SZB CNX DAD CRK HKT TPE YIW PEN WUX
    ', E' \n'), '\s+'),
    'indigo', regexp_split_to_array(btrim('
      HYD NMI BHU KWI
    ', E' \n'), '\s+'),
    'malaysia-airlines', regexp_split_to_array(btrim('
      KIX FUK NRT DAD HAN JHB SGN PEN KCH TPE SUB KUL BNE
    ', E' \n'), '\s+'),
    'philippine-airlines', regexp_split_to_array(btrim('
      NGO MNL GUM JFK SFO HNL LAX SEA
    ', E' \n'), '\s+'),
    'scoot', regexp_split_to_array(btrim('
      KIX CTS HND NRT OKA DPS HKG CXR KNO TPE CJB PLM LOP CAN YIA HKT KUL IPH CGK CSX
      TAO CNX MDC SHE SZB SUB SWA MAA MKZ PEN CEB LGK DAD ILO BPN TJQ PKU WUH NNG PNK
      USM MNL TRZ HAK KBV BKK SRG TRV UPG HGH KWE VTE XIY LBJ NKG HDY BKI KMG PQC ICN
      TSN VTZ HAN SBW CEI FOC CGO KBR KJT CRK MFM CJU KCH MYY SGN KUA ATQ DVO PDG PER
      SYD MEL ATH VIE JED
    ', E' \n'), '\s+'),
    'vietjet', regexp_split_to_array(btrim('
      NGO SGN CGK HAN
    ', E' \n'), '\s+'),
    'vietnam-airlines', regexp_split_to_array(btrim('
      NGO CXR TPE KHH VII
    ', E' \n'), '\s+'),
    'royal-brunei', regexp_split_to_array(btrim('
      SIN KUL
    ', E' \n'), '\s+'),
    'emirates', regexp_split_to_array(btrim('
      KIX HND NRT SIN BKK SKT TPE CEB HYD PEW DEL CAN DPS SAI KTI ISB SZX HKG HAN TRV
      AMD BOM KHI PVG CMB CRK HKT PEK ICN MAA KUL BLR MLE CCU COK LHE DAD SGN DAC MNL
      CGK HGH CHC AKL SYD PER MEL ADL BNE IAH DFW LAX SEA EWR YYZ JFK ORD MIA YUL BOS
      IAD SFO MCO EZE MEX BOG GRU GIG BUD MAN EDI FCO ARN MLA VIE LED DME AMS MXP LYS
      CDG MUC BRU FRA ZRH ATH DUS WAW CPH HEL LGW NCL BLQ MAD LIS VCE DUB STN LCA GLA
      LHR PRG NCE GVA BCN OSL IST BHX HAM CAI IKA CKY EBB DSS BAH LOS ACC BGW LUN CMN
      TNR CPT NBJ TUN DUR NBO JNB KWI MRU MED MCT DAM RUH DAR AMM HRE JED ABJ BSR DMM
      SEZ BEY ALG ADD
    ', E' \n'), '\s+'),
    'qatar-airways', regexp_split_to_array(btrim('
      KUL HKT MLE YUL LHR ELQ ZNZ
    ', E' \n'), '\s+'),
    'gulf-air', regexp_split_to_array(btrim('
      KUL KWI BAH
    ', E' \n'), '\s+'),
    'kuwait-airways', regexp_split_to_array(btrim('
      KTM BLR ISB HKT CAN MAA DAC BKK AMD MNL HYD LHE CMB TRV DEL BOM COK LHR MAD CDG
      GVA IST SAW MAN BCN FRA AMS MUC KWI DXB MED BEY DAM RUH BAH JED AMM
    ', E' \n'), '\s+'),
    'oman-air', regexp_split_to_array(btrim('
      KWI
    ', E' \n'), '\s+'),
    'riyadh-air', regexp_split_to_array(btrim('
      DAC LHE ISB LHR CAI ELQ JED
    ', E' \n'), '\s+'),
    'royal-jordanian', regexp_split_to_array(btrim('
      JFK DFW ORD DTW IAD
    ', E' \n'), '\s+'),
    'saudia', regexp_split_to_array(btrim('
      IAD JFK RUH JED DMM ELQ MED
    ', E' \n'), '\s+'),
    'egyptair', regexp_split_to_array(btrim('
      LAX CAI KWI
    ', E' \n'), '\s+'),
    'ethiopian-airlines', regexp_split_to_array(btrim('
      EWR ORD ATL JFK IAD ADD LFW
    ', E' \n'), '\s+'),
    'kenya-airways', regexp_split_to_array(btrim('
      JFK EDL KIS MBA
    ', E' \n'), '\s+'),
    'south-african-airways', regexp_split_to_array(btrim('
      PER GRU CPT JNB DAR MRU LOS VFA FIH ABJ HRE DUR WDH PLZ LUN ACC FBM GBE
    ', E' \n'), '\s+'),
    'klm', regexp_split_to_array(btrim('
      IAH LAX ORD PDX BOS SFO MSP SAN JFK ATL IAD AUS SLC MIA LAS
    ', E' \n'), '\s+'),
    'air-france', regexp_split_to_array(btrim('
      PPT MSP DTW PHX DFW SFO SEA MIA ATL IAH MCO LAX ORD IAD DEN RDU LAS EWR JFK BOS
      PTP
    ', E' \n'), '\s+'),
    'lufthansa', regexp_split_to_array(btrim('
      AUS JFK SFO SEA ATL RDU DEN CLT ORD DFW BOS LAX SAN MIA EWR IAH DTW STL IAD MUC
      FRA
    ', E' \n'), '\s+'),
    'british-airways', regexp_split_to_array(btrim('
      JFK MCO BWI ORD SFO CVG TPA PHX AUS BNA MSY LAS IAH EWR SEA DFW PDX LAX PIT PHL
      BOS IAD ATL MIA SAN STL DEN LGW
    ', E' \n'), '\s+'),
    'turkish-airlines', regexp_split_to_array(btrim('
      SIN MIA DFW LAX SFO DTW BOS EWR IAD ORD ATL JFK IAH SEA DEN IST
    ', E' \n'), '\s+'),
    'aegean', regexp_split_to_array(btrim('
      ATH DXB
    ', E' \n'), '\s+'),
    'aer-lingus', regexp_split_to_array(btrim('
      CLE IAD BOS DEN ORD SEA LAX MCO JFK PIT BDL MSP IND PHL SFO EWR RDU BNA SNN DUB
    ', E' \n'), '\s+'),
    'austrian', regexp_split_to_array(btrim('
      BOS EWR JFK LAX ORD LHR ZRH FRA CDG MUC
    ', E' \n'), '\s+'),
    'eurowings', regexp_split_to_array(btrim('
      BER
    ', E' \n'), '\s+'),
    'finnair', regexp_split_to_array(btrim('
      HND NRT LAX SEA ORD JFK DFW
    ', E' \n'), '\s+'),
    'iberia', regexp_split_to_array(btrim('
      JFK MIA BOS SFO LAX DFW IAD MCO ORD EWR SJU
    ', E' \n'), '\s+'),
    'icelandair', regexp_split_to_array(btrim('
      BWI BNA MSP RDU BOS DEN SEA EWR IAD PIT PDX MCO ORD JFK YHZ YVR YYZ KEF AGP ALC
      AMS ARN BCN BER BGO BRU CDG CPH DUB EDI FAE FAO FCO FRA GDN GLA GOH HEL LGW LHR
      LIS LPA MAN MUC MXP NCE OSL PRG RKV TFS ZRH
    ', E' \n'), '\s+'),
    'ita-airways', regexp_split_to_array(btrim('
      IAH FLR MAD CDG LIN FCO NAP
    ', E' \n'), '\s+'),
    'lot', regexp_split_to_array(btrim('
      JFK LAX EWR MIA ORD SFO KRK RZE ARN BRU CDG FCO IST LHR MXP ORY OSL
    ', E' \n'), '\s+'),
    'norwegian', regexp_split_to_array(btrim('
      BGO TOS SVG CPH BLL TRD ARN LGW AAL
    ', E' \n'), '\s+'),
    'ryanair', regexp_split_to_array(btrim('
      ZAZ AAR SPU CPH OSL SCQ CFU PMI DUB FCO FSC PED BRU ABZ MAH AMS DLM MRS TSF VRN
      AOI BRE CGN FAO TRN ALC REU SZY HHN SVQ RDZ TFS BZG LPA INI BIQ NCE ARN LEI ZAG
      HEL GLA CIA FMO PMO IAS TLS GDN JSI KGS SDR MXP PMF SNN GOT EDI NUE GOA DLE ACE
      PUY BOJ PSA DBV JMK LCJ CCF PVK EGC EFL NQY CRV HER TPS ORK OSR FUE PIK TRF BTS
      OLB VNO LUZ KRK LIG BOH MAD CAG BGY WRO BCN MMX FNC PIS BHX GRO BRI SZG FRL PRG
      SZZ PLQ TRS SOF HAM EIN PGF EXT KLX BNX ATH MAN OPO CRL VIT RJK BFS RZE BVA KTW
      KIR PDV RVN BVE XCR AGP GNB RMI LUX LDY NAP TGD KUN NCL VLC BJV EMA TUF MLA FKB
      VST CWL PSR LDE VAR STN OTP RHO NOC WMI RMU BZR KLU KSC BLQ VXO POZ BDS LIL ZAD
      JTR LIS MME BSL LGW BUD ZTH BRQ SKG CUF VCE LCA PFO CLJ NRN LBA PEG CTA FMM LTN
      IBZ LRH LPL PAD AHO VIE FNI RIX BRS CDT SUF BER NTE CHQ TLL ESU NDR FEZ AMM RBA
      OUD TNG RAK TTU OZZ AGA
    ', E' \n'), '\s+'),
    'sas', regexp_split_to_array(btrim('
      ICN LAX SFO ORD JFK SEA BOS ATL IAD EWR
    ', E' \n'), '\s+'),
    'swiss', regexp_split_to_array(btrim('
      ICN ORD SFO EWR BOS IAD LAX MIA JFK GVA ZRH
    ', E' \n'), '\s+'),
    'tap', regexp_split_to_array(btrim('
      MIA JFK SFO IAD BOS ORD LAX EWR CWB GIG TER LIS
    ', E' \n'), '\s+')
  ) || jsonb_build_object(
    'virgin-atlantic', regexp_split_to_array(btrim('
      ICN MCO LAX BOS SFO JFK SEA IAD LAS ATL MIA TPA EDI
    ', E' \n'), '\s+'),
    'vueling', regexp_split_to_array(btrim('
      BIO PMO TRN
    ', E' \n'), '\s+'),
    'united', regexp_split_to_array(btrim('
      NRT HND KIX NGO PEK SIN HKG DEL ICN PVG MNL TPE ROR TKK MAJ YAP AKL SPN BNE SYD
      PPT MEL EWR MIA PIT SBA FAT BIL YUL IND CID MFR ATW SAT XNA DTW PDX EGE FLL LEX
      YYC MKE BFL RIC CVG AUS MSP TUS RNO ALB MFE MSY KOA BOS CMH ATL BWI RDM MSN BUR
      PNS FAI MSO DRO BDL SDF SAN BGR MDT SJC TPA FAR PSP SAV JAC SLC PSC EUG BOI GRR
      RDU MTJ CLT ANC BZN OMA YOW ROC BNA GSP LIT MEM BDA EYW OGG MRY ICT HDN BUF ONT
      HNL BHM AVL CHS FSD PWM COS MAF GTF OKC GEG YEG LIH SEA JAX TYS ECP SMF IDA RAP
      TUL SRQ SNA PHL RSW ABQ PBI STL MCI YYZ DFW GJT SBP MYR ELP DSM BTV TVC FCA SYR
      YVR DAY ORF PHX LGA PUJ BJX SAL SXM NAS UVF XPL BGI LIM GCM PTY RTB BON GDL MTY
      ANU SJD GEO BZE SLP LIR SAP SJO STI MBJ CUN EZE PLS SJU STT MID QRO MEX MGA CUR
      AUA POS GRU PVR SDQ GUA TQO POP MDE GIG BQN BOG CZM VER UIO PMO MXP FAO EDI PDL
      BER MAD ATH PMI LIS FCO GVA NCE GLA BRU NAP DUB KEF BRI ZRH GOH FNC MUC SCQ BCN
      CDG SNN DBV LHR BIO OPO AMS AGP VCE SPU FRA LOS ACC JNB CPT
    ', E' \n'), '\s+'),
    'delta', regexp_split_to_array(btrim('
      HND ICN PVG HKG TPE MEL SYD ANC FAI HNL KOA LIH OGG TPA JNU ABQ HPN MSO MDT ICT
      GEG SAN ORD MSN BOI ALB SAV BUF GSO XNA AUS LAS FLL SRQ SYR GRB TRI PHX IAD MSY
      DFW SMF IAH SDF BIL CAE SFO ATW CSG BWI MKE CHA AVL VPS PDX TVC PVD ECP BGR IDA
      FSD SGF SAT FAR JAN OMA CHO YYC MCI RDU STL OKC TUL IND CLT BNA PHL MIA ROC CVG
      AGS LEX BZN RNO JAX HSV PWM HOU RIC BDA FCA JAC TUS PIT ELP BTV TLH PSC DSM DEN
      CHS BDL DCA MYR SJC EYW YYZ DAL DAB BHM DAY CID ORF BIS RSW COS YVR LIT MOB GNV
      ABE RAP ROA CLE MDW YUL GRR GPT GSP PBI TYS MEM PNS MLB CMH MCO ILM BTR CTG SJU
      RTB BGI AUA KIN STT EZE PUJ SJD SJO SAL BOG HAV PTY LIR BZE MTY BON GCM PLS CUR
      ANU MBJ SXM GUA GDL PVR GIG NAS SCL SDQ TQO UIO SVD GND GRU STI LIM MEX SAP STX
      SKB UVF CUN BCN FCO NCE CDG LHR MUC ARN MLA EDI OPO CPH CTA PRG OLB NAP BER SNN
      ATH FRA KEF ZRH MXP VCE MAD BRU DUB LIS AMS ACC CPT LOS DSS JNB
    ', E' \n'), '\s+'),
    'american', regexp_split_to_array(btrim('
      NRT HND PVG ICN DEL SYD HNL RDU FCA CLE BWI ONT PIT MSP SLC SEA BUR YYZ AVP SAN
      CHA GSO MEM PWM RSW SJC FLG PVD GUC FAT CMH STL JAC SRQ BNA PSP ANC FLL OMA MSO
      PVU BTV EGE ORF JAX IND MKE SAV MSY LAS RNO TPA CHS CVG MFE YVR SBP GSP MSN ROC
      VPS YHZ IAH ATL RIC KOA YYC BZN MCO BDL YUL AVL ILM ALB PBI OKC DTW DEN ABQ BUF
      OGG MYR SMF EYW ELP SDF TUL SNA GEG XNA TVC PNS SYR LIH MRY GRR MTJ BHM MDT TYS
      AUS PDX BGR HSV TUS FSD DSM STS ICT COS CID SBA MCI ECP BFL BOI SFO SAT BDA AMA
      PLS MEX OAX NAS BGI HAV CMW AUA ANU SDQ KIN SLP XPL GND MZT PTY CTG SCU CUN BOG
      MDE RTB MBJ SJO DGO PUJ GEO UVF SXM STT SAP LIM SKB SVD CUR BAQ FPO CLO PTP SJU
      QRO TQO GIG STI HOG FDF SJD GYE MLM GRU UIO CZM LIR LRM BON GDL SNU STX GUA VRA
      BJX SCL GCM MGA POS BZE MID MTY SAL POP PVR EZE PRG MAD ZRH MUC FCO VCE BUD AMS
      FRA ATH NAP NCE CPH EDI LIS BCN LHR CDG MXP DUB
    ', E' \n'), '\s+'),
    'southwest', regexp_split_to_array(btrim('
      BOS SLC BHM RIC ABQ GRR ANC VPS DSM GSP MEM PDX CLT MHT PHL MTJ SAV SDF JAX FAT
      SNA CMH LGA ICT RSW CLE ROC OMA LIH CRP TYS PVD SFO LIT BUF BUR STL IND ELP CHS
      JAN CVG PWM DCA HNL PSP MKE ECP MCI ALB STS BDL ONT SRQ TPA PIT COS SAN TUS SMF
      MYR OGG AMA MAF ISP ORF SBA BOI HDN KOA EUG BZN LBB RDU ITO RNO SAT OKC SEA PNS
      SJC MIA TUL MSP GEG DTW FLL MSY LGB HRL LIR BZE PVR CUN SXM SJD STT SJO GCM PUJ
      AUA SJU PLS MBJ NAS HAV
    ', E' \n'), '\s+'),
    'air-canada', regexp_split_to_array(btrim('
      DEN SFO SMF SEA JAX SNA SAT EWR IAH DFW LAX LGA ORD RDU IAD AUS YYC MIA BOS BNA
      MCO SAN
    ', E' \n'), '\s+'),
    'alaska-airlines', regexp_split_to_array(btrim('
      NRT HND KIX ICN RAR PPG PPT SYD CDV SLC DLG LAS RNO KTN DTW OTZ ATL OGG STL FAI
      BRW SNA SCC CHS BOI LGB JFK KOA SAT YYZ PAE TUS CMH STS JNU ONT FAT GEG PSG RDU
      PSP BET SBA HNL BZN AKN IND TPA BUR PIT DCA MCI ITO IAH PHL MIA MCO LIH ADK YAK
      CVG GST BNA ADQ WRG PHX MSY MKE SIT MSO EWR OKC IAD ABQ OAK BOS MSP OME FLL ORD
      AUS DFW SJC BWI OMA DEN SMF CLE PVR SJO GDL SJD LIR GUA BZE ZIH FCO LHR KEF
    ', E' \n'), '\s+'),
    'allegiant', regexp_split_to_array(btrim('
      ACY ALB AUS BGR BIL BIS BLV BMI BOI BOS BUR BZN CAE CAK CHA CHS CID CKB COS COU
      DAY DEN ELM EUG EVV EWR EYW FAR FAT FCA FSD FWA GEG GFK GRI GSO GSP GTF HGR HOU
      HSV HTS IAD IAG ICT IDA JAX LCK LEX LIT LRD LSE MCI MCO MDT MDW MEM MFE MFR MLB
      MLI MOT MRY MSO MSY MYR OKC OMA ORF PBG PDX PHL PHX PIA PSC PSM PVD RAP RFD RIC
      ROA ROC RSW SBN SCK SDF SGF SHV SMX SNA SPI STC SWF SYR TOL TRI TTN TUL TVC USA
      XNA PBI
    ', E' \n'), '\s+'),
    'breeze-airways', regexp_split_to_array(btrim('
      ACY ALB BGR BHM BTV CMH DAB EYW HVN ISP JAX MEM MHT MSN SDF SWF LAN TWF GPT PIT
      SFO BRO LNK SAN HPN EWN ERI SRQ MYR IAD GSO AVP ILM SNA SPI EWR CVG EVV TRI HSV
      OGD LAS OGS PNS LNS DEN GSP SBD PWM ACV TLH PBI ROC SBN SYR LAX SAT RIC DFW PHX
      RDM SBY PSM GJT BUR SAV XNA NAS CUN PUJ
    ', E' \n'), '\s+'),
    'frontier', regexp_split_to_array(btrim('
      BOS BUF DTW FLL IAH RDU BNA RNO MSN ISP XNA SMF BDL IAD MYR LAX FSD SLC PDX MCI
      CID CRP STL JAX SAT DSM SAN AUS LIT TYS CMH PIT ELP ONT TTN RSW JFK PBI OKC SNA
      IND BWI RIC CLT EWR MKE LGA SEA BOI SFO OMA GRR ORF MSY MEM FAR MSP DCA BUR SJC
      PNS CUN SXM PSE PUJ MBJ SAL SAP BQN STI SJO SDQ GUA
    ', E' \n'), '\s+'),
    'jetblue', regexp_split_to_array(btrim('
      AUS BDL BUF DCA SFO DEN PWM ORF SAV RSW PDX HPN RDU DAB MSY CLT SYR CLE DFW ROC
      TPA BNA SAN ATL MHT PHX VRB CHS YVR LAS ALB VPS RNO PHL HYA ONT MKE JAX EWR RIC
      ORH MVY BZN PIT SMF SLC TVC ILM ACK PVD ORD PQI DTW BDA SEA ABQ BWI BUR SRQ IAH
      ISP PBI LGA SDQ KIN STT STX GEO PSE GND NAS ANU CTG SJU SKB PUJ SJD CUR GCM MBJ
      BQN GUA SJO SVD POP POS SAP LIR PLS UVF CUN BGI MDE STI SXM GYE AUA MAD BCN DUB
      AMS LHR MXP LGW CDG EDI
    ', E' \n'), '\s+'),
    'porter', regexp_split_to_array(btrim('
      ORD
    ', E' \n'), '\s+'),
    'westjet', regexp_split_to_array(btrim('
      IAH LAX PSP AUS FLL BOS SLC ORD RSW BNA SEA OGG YQR SFO TPA PDX HNL YHZ DTW SAN
      PHX MCO DEN ANC JFK SNA MSP IAD LAS ATL YXE KEF
    ', E' \n'), '\s+'),
    'aeromexico', regexp_split_to_array(btrim('
      MEX
    ', E' \n'), '\s+'),
    'avianca', regexp_split_to_array(btrim('
      BOS FLL TPA DFW MIA JFK IAD MCO ORD BOG LIM SJU MDE CLO BAQ PEI
    ', E' \n'), '\s+'),
    'copa-airlines', regexp_split_to_array(btrim('
      DEN SAN LAX LAS MIA AUS SFO BOS RDU IAD ORD ATL BWI FLL TPA JFK MCO SJU
    ', E' \n'), '\s+'),
    'latam', regexp_split_to_array(btrim('
      MIA MCO JFK LAX SCL EZE PUJ
    ', E' \n'), '\s+'),
    'air-new-zealand', regexp_split_to_array(btrim('
      CHC DUD WLG ZQN LAX SFO HNL IAH JFK
    ', E' \n'), '\s+'),
    'fiji-airways', regexp_split_to_array(btrim('
      CXI APW DFW SFO LAX HNL
    ', E' \n'), '\s+'),
    'jetstar', regexp_split_to_array(btrim('
      NRT KIX DPS SGN HKT ICN SIN BKK MNL CMB HVB RAR CHC PPP ZQN DUD AKL LST HLZ VLI
      OOL DRW HBA ADL MCY WLG NTL CBR AYQ WSI TSV NAN BQB BNK BNE
    ', E' \n'), '\s+')
  );
$fn$;

revoke all on function public.pv_stay_network() from public, anon, authenticated;

comment on function public.pv_stay_network() is
  '会社ごとの就航地（会社ページの「ステイ先」に並ぶ空港の3字。gen-stay-network.mjs が書く）。運営の「追加」（足す口の publish:true）が、その場で公開で入れてよい空港の一覧。誰にも配らない（足す口と、運営だけが読む 10-e が呼ぶ）。';


-- ════════════════════════════════════════════════════════════════
-- 4. 読む（会社 × 空港の一覧）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {airline:'etihad', iata:'NRT', key}（key は任意。ログインせずに足した端末の控え）
-- 返り値:
--   資格なし → {ok:true, state:'locked'}            ★これだけ。手（ログインか端末の鍵）が無ければ表を読む前に返す
--   資格なし・自分が足したものが在る → {ok:true, state:'locked', own:[{…12個の欄。photos は必ず []…}]}
--     ★ own に入るのは、書いた人の印が呼んだ人の手のどれかと同じ行**だけ**（この会社 × 空港の。50件まで）。
--       引数が変でも、その会社 × 空港に自分のものが無ければ locked の1行（「変だ」とすら答えない）。
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
-- ★ 未ログイン（anon）にも配ってある。返るのは locked の1行だけ（端末の鍵で足したものが在れば、その own だけ）で、
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
  v_mine   text[];
  v_air    text;
  v_iata   text;
  v_active boolean;
  v_places jsonb;
  v_others jsonb;
  v_own    jsonb;
begin
  v_role := public.pv_stay_role();
  -- ★ 開くのは見てよい人（オーナーかオーナーが承認した人。約束 1）だけ。運営であることだけでは開かない
  v_sees := coalesce(public.pv_stay_sees(), false);
  v_mine := public.pv_stay_me(p);

  if not v_sees then
    -- ★見てよい人ではない。返すのは locked の1行だけ（引数が変でも同じ）。
    --   自分が足したものがこの会社 × 空港に在るときだけ、それ**だけ**を own に付ける。
    --   探すのは「書いた人の印が、呼んだ人の手のどれかと同じ行」だけ。写真は並べない（3-h）。
    if cardinality(v_mine) = 0 then
      return jsonb_build_object('ok', true, 'state', 'locked');
    end if;
    v_air  := lower(btrim(coalesce(p->>'airline', '')));
    v_iata := upper(btrim(coalesce(p->>'iata', '')));
    select jsonb_agg(z.j order by z.k, z.n, z.id)
      into v_own
      from (
        select public.pv_stay_place_json(s, v_mine, false, false) as j,
               case s.kind when 'hotel' then 0 when 'food' then 1 else 2 end as k,
               lower(s.name) as n, s.id
          from public.pv_stay_places s
         where s.airline = v_air and s.iata = v_iata
           and s.author_hash = any(v_mine)
         order by 2, 3, 4
         limit 50
      ) z;
    if v_own is null then
      return jsonb_build_object('ok', true, 'state', 'locked');
    end if;
    return jsonb_build_object('ok', true, 'state', 'locked', 'own', v_own);
  end if;
  -- 全部（ほかの人の確認待ちも）見えるのは、見てよい人でもある運営だけ
  v_all := (v_role = 'operator' and v_sees);

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
      select public.pv_stay_place_json(s, v_mine, v_all, v_sees)
               || case when v_all then jsonb_build_object('rev', public.pv_stay_rev(s))
                       else '{}'::jsonb end as j,
             case s.kind when 'hotel' then 0 when 'food' then 1 else 2 end as k,
             lower(s.name) as n, s.id
        from public.pv_stay_places s
       where s.airline = v_air and s.iata = v_iata
         and public.pv_stay_visible(s.state, s.author_hash, v_mine, v_all, v_sees)
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
                 public.pv_stay_place_json(s, v_mine, v_all, v_sees)
                   || case when v_all then jsonb_build_object('rev', public.pv_stay_rev(s))
                           else '{}'::jsonb end as j,
                 lower(s.name) as n, s.id
            from public.pv_stay_places s
           where s.iata = v_iata and s.airline <> v_air and s.kind = 'hotel'
             and public.pv_stay_visible(s.state, s.author_hash, v_mine, v_all, v_sees)
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
  '会社 × 空港のステイ情報。オーナーとオーナーが承認した人にだけ中身を返す（運営であることだけでは開かない）。それ以外には {ok:true, state:''locked''} だけ（ほかの人の名前も件数も返さない）。自分が足したものだけは own で本人に返す（ログインか端末の鍵。写真は並べない）。author_hash と時刻は返さない。';


-- ════════════════════════════════════════════════════════════════
-- 5. 足す（場所）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {airline, iata, kind:'hotel'|'food'|'spot', name, address, maps_url, note, city, stay_hours, publish}
--   publish:true は運営だけが使える（運営でなければ読まない）。その行は確認待ちを通さずに 'public' で入る。
--     （管理ページの「追加」。同じ名前がもう公開されていれば exists で止まる ── 公開の行に同じ名前を2つ作らない）
--   city は都市の名前（任意。空港の3レターとは別に、人が読む名前として持つ）。
--   stay_hours はステイ時間（任意・ホテルだけ。そのホテルでのステイがおよそ何時間か。1〜240 の整数）。
--     ホテル以外に付けて送っても弾かない。保存せずに捨てる（item.stay_hours は null で返る）。
--   key は任意。ログインせずに前に足したとき返した端末の控え（ログインしている人の行は、いつもログインの印で入る）。
-- 返り値: {ok:true, item:{…一覧と同じ形…}}。入った時点では state:'pending'（運営の「追加」＝ publish:true だけは 'public'）。
--   key（ログインせずに初めて足したときだけ。端末の控え。★返すのはこの1回だけ・表には sha256 しか置かない）
-- 弾いたときは例外ではなく {ok:false, status:…} を返す（画面は理由ごとに違う一言を出す）。
--   locked        いまは誰も足せない設定になっている（pv_stay_may_add。★何も調べずに返す）
--   bad_airline   名簿に無い・無効・'other'
--   bad_iata      英字3字でない／運営の「追加」（publish:true）で、その会社の就航地（3-n）に無い空港
--   bad_kind      白リストの外
--   bad_name      名前が2〜80字でない
--   too_long      住所が200字・メモが500字を超える
--   bad_city      都市の名前が60字を超える
--   bad_hours     ステイ時間が 1〜240 の整数でない（ホテルのときだけ）
--   too_fast      10秒以内の連投
--   rate_limited  24時間の上限（ログインしている人 20件・端末の鍵だけの人 20件）／同じ回線が1日に作れる端末の鍵は20本／
--                 同じ回線からログインせずに足せるのは1日40件（端末をまたいで合わせて数える。2026-10-18 オーナーの答え Q3）
--   queue_full    ログインせずに足されたものが、運営の確認を 200件 待っている（運営が見れば、また足せる）
--   duplicate     自分が同じ名前を既に出している
--   exists        同じ名前が既に**公開済み**（★見てよい人と、運営の「追加」（publish:true）にだけ返す。3-l）
-- ★ 足すのは誰でもできる（ログインも要らない）。足せることは何も開かない（読めるかは pv_stay_sees だけが決める）。
--   見てよい人でない人に返すのは、足した1件（自分のもの・写真は並べない）か、上の status の1語だけ。
-- ★ ログインしていない人の「手」は、サーバーが作って返した端末の鍵だけ（画面が作った鍵は受け付けない）。
--   届いた鍵が表に無ければ、新しい鍵を作る（作るのは、断る理由を全部見たあと ＝ 断った呼び出しは鍵を作らない）。
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
  v_uid   uuid := auth.uid();
  v_role  text;
  v_sees  boolean;
  v_all   boolean;
  v_me    text;
  v_air   text;
  v_iata  text;
  v_bad   text;
  v_kind  text;
  v_name  text;
  v_addr  text;
  v_note  text;
  v_url   text;
  v_city  text;
  v_hours int;
  v_n     int;
  v_key   text;        -- この呼び出しで新しく作った端末の鍵（作らなければ null）
  v_ip    text;
  v_iph   text;
  v_pub   boolean;
  v_row   public.pv_stay_places%rowtype;
begin
  if not coalesce(public.pv_stay_may_add(), false) then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  v_role := public.pv_stay_role();
  -- 見てよい人か（オーナーかオーナーが承認した人。約束 1）。返す1件の形と exists を答えるかだけに使う
  -- （足せるかどうかは決めない。足した直後の行には写真がまだ無い）
  v_sees := coalesce(public.pv_stay_sees(), false);
  v_all := (v_role = 'operator' and v_sees);

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

  if v_uid is not null then
    v_me := public.pv_stay_hash(v_uid);
  else
    -- ログインしていない人。表に在る端末の鍵ならその手、そうでなければ新しい鍵を作る（画面が作った鍵は受け付けない）
    -- 片づけ：回線の印は1日だけ／足したものが1つも無い鍵は1日で消す／回線ごとのその日の数も1日で消す（ログインせずに足すたびに、毎回流す）。
    --   文は 3-c5 の1か所だけ（毎時の片づけ 10-d も同じものを呼ぶ）
    perform public.pv_stay_key_sweep();
    v_me := public.pv_stay_key_hash(p->>'key');
    if v_me is not null and not exists (select 1 from public.pv_stay_keys k where k.key_hash = v_me) then
      v_me := null;
    end if;
    -- サイト全体：ログインせずに足されて、まだ運営が見ていないものは 200件まで（運営の待ち行列が1度に出す数）。
    -- ★ 数えるのは「待っている行」。運営が通すか見送れば、また足せる（24時間の件数で数えると、1人が毎日ふさげる）
    select count(*) into v_n from public.pv_stay_places s
     where s.state = 'pending'
       and exists (select 1 from public.pv_stay_keys k where k.key_hash = s.author_hash);
    if v_n >= 200 then
      return jsonb_build_object('ok', false, 'status', 'queue_full');
    end if;
    -- 回線（x-forwarded-for の先頭）。ハッシュにして数えるだけ（生の値はどこにも置かない）。回線が分からない所では数えない
    begin
      v_ip := split_part(
        coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1);
    exception when others then
      v_ip := '';
    end;
    v_ip := btrim(v_ip);
    if v_ip <> '' then
      v_iph := encode(extensions.digest(v_ip || '::pv_hotel_ip::' || current_date::text, 'sha256'), 'hex');
      -- 同じ回線の同時の呼び出しを1列に並べる（下の40件の数え方をすり抜けさせない。数えてから1つ進めるまで、この印を掴んだまま）
      perform pg_advisory_xact_lock(hashtextextended('pv_stay_ip:' || v_iph, 0));
      -- 同じ回線からログインせずに足せるのは1日40件まで（2026-10-18 オーナーの答え Q3「②」）。端末を替えても合わせて数える：
      -- 数えるのは 1 の pv_stay_ip_day の、この回線のその日の数（足せた1件ごとに、下の insert のあとで1つ進める）。
      -- ★鍵がいつ作られたかは見ない（前の日に作った端末で足したものも、新しい端末で足したものも、同じ1つの数）。
      -- ★知っている鍵で足すときも数える（鍵を作る前に止める ＝ 断った呼び出しは鍵を作らない）。日が替われば印が替わる（鍵の20本と同じ1日の窓）
      select coalesce((select d.n from public.pv_stay_ip_day d where d.ip_day_hash = v_iph), 0) into v_n;
      if v_n >= 40 then
        return jsonb_build_object('ok', false, 'status', 'rate_limited');
      end if;
    end if;
    if v_me is null then
      -- 同じ回線から1日に作れる鍵は20本まで（db/contrib.sql の預かりと同じ数）。回線が分からない所では数えない
      if v_iph is not null then
        select count(*) into v_n from public.pv_stay_keys
         where ip_day_hash = v_iph and created_at > now() - interval '1 day';
        if v_n >= 20 then
          return jsonb_build_object('ok', false, 'status', 'rate_limited');
        end if;
      end if;
      v_key := encode(extensions.gen_random_bytes(24), 'hex');
      v_me  := public.pv_stay_key_hash(v_key);
      insert into public.pv_stay_keys (key_hash, ip_day_hash) values (v_me, v_iph);
    end if;
  end if;

  -- 同じ人の同時の2本を1列に並べる（連投の数え方をすり抜けさせない）
  perform pg_advisory_xact_lock(hashtextextended('pv_stay:' || v_me, 0));

  -- 連投（10秒。2026-10-16 オーナー「続けて足すとき は10秒でいいよ」。前は30秒）
  if exists (select 1 from public.pv_stay_places
              where author_hash = v_me and created_at > now() - interval '10 seconds') then
    return jsonb_build_object('ok', false, 'status', 'too_fast');
  end if;

  -- 1日の上限（ログインしている人 20・端末の鍵だけの人 20。数は 3-c4 の1か所）
  select count(*) into v_n from public.pv_stay_places
   where author_hash = v_me and created_at > now() - interval '24 hours';
  if v_n >= public.pv_stay_cap(v_uid is null) then
    return jsonb_build_object('ok', false, 'status', 'rate_limited');
  end if;

  -- 運営が管理ページから直接足すときだけ、確認待ちを通さずに出す（2026-10-11 オーナー「承認と追加のボタン」）
  v_pub := coalesce(v_role = 'operator', false) and coalesce(p->'publish' = 'true'::jsonb, false);

  -- ★運営の「追加」は、その会社の就航地（3-n ＝ 会社ページのステイ先に並ぶ空港）にだけ。
  --   3字の打ち間違いで、どのページにも出ない公開の行を作らない（何も書かずに止める）
  if v_pub and not coalesce((public.pv_stay_network() -> v_air) ? v_iata, false) then
    return jsonb_build_object('ok', false, 'status', 'bad_iata');
  end if;

  -- 自分の重ね出し（duplicate）／既に公開されている同じ名前（exists。★見てよい人と、運営の「追加」にだけ答える）。判定は 3-l の1か所
  -- （運営の「追加」は公開で入るので、ここで止めないと公開の行に同じ名前が2つできる）
  v_bad := public.pv_stay_clash(v_me, v_air, v_iata, v_kind, v_name, null, v_sees or v_pub);
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'status', v_bad);
  end if;

  insert into public.pv_stay_places
    (author_hash, airline, iata, kind, name, address, maps_url, note, city, stay_hours, state, moderated_at)
  values (v_me, v_air, v_iata, v_kind, v_name, v_addr, v_url, v_note, v_city, v_hours,
          case when v_pub then 'public' else 'pending' end, case when v_pub then now() end)
  returning * into v_row;

  -- ログインせずに足せた1件を、この回線のその日の数に入れる（40件の数え方。回線が分からない所では数えない。
  -- 上で回線の印を掴んだまま ＝ 同じ回線の同時の呼び出しが、同じ数を見て両方とも入ることはない）
  if v_uid is null and v_iph is not null then
    insert into public.pv_stay_ip_day as d (ip_day_hash, n) values (v_iph, 1)
    on conflict (ip_day_hash) do update set n = d.n + 1;
  end if;

  return jsonb_build_object('ok', true, 'item',
           public.pv_stay_place_json(v_row, array[v_me], v_all, v_sees))
         || case when v_key is not null then jsonb_build_object('key', v_key) else '{}'::jsonb end;
end;
$fn$;

revoke all on function public.pv_stay_add(jsonb) from public;
grant execute on function public.pv_stay_add(jsonb) to anon, authenticated;

comment on function public.pv_stay_add(jsonb) is
  'ステイ情報を1件足す。誰でも足せる（ログインも要らない。決め方は pv_stay_may_add の1行）。足せることは何も開かない（読めるのはオーナーとオーナーが承認した人だけ）。pending で入る（運営が見るまで、足した本人と運営にしか出ない。運営が publish:true を添えたときだけ、その場で public。その空港は、その会社の就航地（3-n）に在るものだけ）。ログインせずに初めて足したときだけ端末の鍵を1回返す（表には sha256 だけ）。名前2〜80字・住所200字・メモ500字・都市60字・ステイ時間はホテルだけで1〜240時間（任意）・10秒・24時間にログインしている人20件／端末の鍵だけの人20件・同じ回線が1日に作れる鍵は20本・同じ回線からログインせずに足せるのは端末をまたいで1日40件・ログインせずに足して運営の確認を待つものは200件まで。exists は見てよい人と運営の「追加」にだけ答える。地図のリンクは Google マップ以外なら捨てる。';


-- ════════════════════════════════════════════════════════════════
-- 5-b. 直す（場所。★書いた本人だけ）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {id:<場所の id>, kind, name, address, maps_url, note, city, stay_hours, key}
--   key は任意。ログインせずに足したときの端末の控え（その鍵で書いた行を直すとき）。
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
--   locked        誰の手か分からない（ログインしておらず、端末の鍵も無い）／いまは誰も直せない設定
--   not_found     その場所が無い・自分のものではない・id の形が違う（★同じ答え。消す口と同じ）
--   final         見送られたものは直せない（出し直してもらう。公開へ戻す道が無いので、直しても出ない）
--   bad_kind／bad_name／too_long／bad_city／bad_hours   足す口と同じ検品（3-k）
--   rate_limited  24時間の上限（足す口と同じ数。ログインの印で書いた行は20回・端末の鍵で書いた行も20回）
--   duplicate／exists   名前か種別を変えた先に、同じ名前がもう在る（3-l。足す口と同じ決まり）。exists は見てよい人にだけ返す
-- ★ 直したら必ず 'pending' へ戻す（2026-10-05 オーナー決定「修正した投稿は運営の確認待ちへ戻す」）。
--   公開済みでも、その瞬間からほかの人には出なくなる（3-d の決まりのまま）。本人には出続ける。
--   運営が見た時刻（moderated_at）も消す ＝ 待ち行列の「まだ見ていないもの」と同じ姿に戻す。
--   直された場所を運営が通すには、見たときの中身の印（rev）が要る（8 の changed）。
-- ★ 付いている写真の状態は触らない。場所が確認待ちの間は、公開済みの写真もほかの人には
--   出ない（7 の読む口が場所の見える・見えないも通している）。運営が場所を通せばまた出る。
-- ★ 直せるのは書いた本人だけ（ログインの印か、端末の鍵）。運営でも他人のものは not_found（運営の道は 8 の公開する／見送る
--   と 9 の消す。中身を書き換える力を運営に持たせると、誰の言葉か分からなくなる）。
--   運営が自分で書いたものは、書いた本人として直せる。確認待ちへ戻り、自分では公開できない
--   （8 の own_post が今までどおり効く）。
-- ★ 直せるかどうかは「見てよい人か」で決めない（決めるのは pv_stay_may_add の1行と、書いた人の印）。
--   見てよい人でない人（承認を取り消された人・ログインせずに足した人）も、自分が書いたものは直せる
--   （確認待ちへ戻るだけで、何も開かない。返す1件の形と exists だけは「見てよい人か」で決める）。
-- ★ 何も変わらない送り直しは、状態を戻さない（保存ボタンを押し直しただけで公開が外れない）。
-- ★ 10秒の決まりは入れていない（続けて直すのは普通の使い方。変わらなければ何も起きない）。
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
  v_mine text[];
  v_dev  boolean;
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
  if not coalesce(public.pv_stay_may_add(), false) then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  v_mine := public.pv_stay_me(p);
  if cardinality(v_mine) = 0 then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  v_role := public.pv_stay_role();      -- 返す形と exists を答えるかだけに使う（直せるかどうかは決めない）
  -- 返す1件の形（写真の並び）と exists は、読む口と同じ「見てよい人か」で決める
  v_sees := coalesce(public.pv_stay_sees(), false);
  v_all := (v_role = 'operator' and v_sees);

  v_id := public.pv_stay_uuid(p->>'id');
  if v_id is null then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  -- ★ 自分のものだけを探す。他人のもの・無い id は、どちらも「見つからない」
  select * into v_row from public.pv_stay_places
   where id = v_id and author_hash = any(v_mine)
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;
  v_me  := v_row.author_hash;           -- 回数と錠は、その行を書いた手で数える
  v_dev := exists (select 1 from public.pv_stay_keys k where k.key_hash = v_me);

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
      public.pv_stay_place_json(v_row, v_mine, v_all, v_sees));
  end if;

  -- 同じ人の同時の2本を1列に並べる（回数の数え方をすり抜けさせない）
  perform pg_advisory_xact_lock(hashtextextended('pv_stay:' || v_me, 0));

  -- 1日の上限（足す口と同じ数。ログインしている人 20・端末の鍵だけの人 20。直すたびに運営の待ち行列へ戻るので、際限なく戻させない）
  select coalesce(sum(edit_n), 0) into v_n from public.pv_stay_places
   where author_hash = v_me and edit_from > now() - interval '24 hours';
  if v_n >= public.pv_stay_cap(v_dev) then
    return jsonb_build_object('ok', false, 'status', 'rate_limited');
  end if;

  -- 名前か種別を変えたときだけ、変えた先に同じ名前が在るかを見る（自分自身は数えない）
  if v_kind <> v_row.kind or lower(v_name) <> lower(v_row.name) then
    v_bad := public.pv_stay_clash(v_me, v_row.airline, v_row.iata, v_kind, v_name, v_id, v_sees);
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
    public.pv_stay_place_json(v_row, v_mine, v_all, v_sees));
end;
$fn$;

revoke all on function public.pv_stay_update(jsonb) from public;
grant execute on function public.pv_stay_update(jsonb) to anon, authenticated;

comment on function public.pv_stay_update(jsonb) is
  '自分が足した場所の中身（名前・種別・住所・地図のリンク・メモ・都市・ステイ時間）を直す。書いた本人だけ（ログインの印か、ログインせずに足したときの端末の鍵）。直したら pending へ戻る（運営が見るまで他人に出ない）。会社と空港は変えられない。何も変わらなければ状態を戻さない。24時間にログインの印で書いた行は20回・端末の鍵で書いた行も20回まで。exists は見てよい人にだけ答える。';


-- ════════════════════════════════════════════════════════════════
-- 5-c. 引き取る（ログインした人が、ログインする前にこの端末から足したものを自分のものにする）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {key:<端末の鍵>}
-- 返り値: {ok:true}   ★これだけ。何件移したかを返さない（約束 10）。鍵が無い・形が違う・表に無い、でも同じ字
--   locked   ログインしていない
-- ★ 表に在る鍵（サーバーが作って返したもの）だけを引き取る。その鍵の行の「書いた人の印」を、ログインした人の印に
--   書き換え、鍵の行を消す ＝ その端末の鍵は、もう誰の行とも合わない。
-- ★ 引き取ったあとは、その人のログインだけが証拠になる（別の端末でも見える・ログアウトした画面には残らない）。
-- ★ これで開くものは無い。見てよい人かどうかは、今までどおり pv_stay_sees() が決める。
create or replace function public.pv_stay_claim(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid uuid := auth.uid();
  v_kh  text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
  v_kh := case when jsonb_typeof(p) = 'object' then public.pv_stay_key_hash(p->>'key') end;
  if v_kh is not null then
    -- 同じ鍵の2本を1列に並べる（足す口と同じ錠。半分だけ移った形を作らない）
    perform pg_advisory_xact_lock(hashtextextended('pv_stay:' || v_kh, 0));
    delete from public.pv_stay_keys where key_hash = v_kh;
    if found then
      update public.pv_stay_places
         set author_hash = public.pv_stay_hash(v_uid)
       where author_hash = v_kh;
    end if;
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.pv_stay_claim(jsonb) from public, anon;
grant execute on function public.pv_stay_claim(jsonb) to authenticated;

comment on function public.pv_stay_claim(jsonb) is
  'ログインせずに足したステイ情報を、ログインした人が引き取る。表に在る端末の鍵だけ。返すのは {ok:true} だけ（件数を返さない）。何も開かない。';


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
--   exists      同じ会社・空港・種別に、同じ名前がもう公開されている（★何も変えずに返す）
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
    -- ★ 同じ名前がもう公開されていれば、通さない（公開の行に同じ名前を2つ作らない）。
    --   足す口・直す口は exists を見てよい人にしか答えない（3-l）。見てよい人でない人が足した同じ名前は
    --   確認待ちとして届くので、ここで運営に知らせる。行は待ちのまま（見送るかどうかは運営が決める）。
    if v_state = 'public'
       and exists (select 1 from public.pv_stay_places o
                    where o.airline = v_place.airline and o.iata = v_place.iata
                      and o.kind = v_place.kind and lower(o.name) = lower(v_place.name)
                      and o.state = 'public' and o.id <> v_place.id) then
      return jsonb_build_object('ok', false, 'status', 'exists');
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
  'ステイ情報の場所・写真を公開する／見送る。運営だけ（守っているのは grant ではなく関数の中の判定）。自分が出したものは自分で公開できない。同じ会社・空港・種別に同じ名前がもう公開されていれば exists で止める。見送った写真は画素を消す。pending へは戻せない。';


-- ════════════════════════════════════════════════════════════════
-- 9. 消す（本人か運営）
-- ════════════════════════════════════════════════════════════════
-- 引数: p = {target:'place'|'photo', id, key}（key は任意。ログインせずに足したときの端末の控え）
-- 返り値: {ok:true, target, id}
--   locked      誰の手か分からない（ログインしておらず、端末の鍵も無い）
--   bad_target  'place' と 'photo' 以外
--   not_found   その id が無い・自分のものではない（★同じ答え。在るかどうかを答えない）
-- ★ ここだけは「見てよい人か」も「足してよい設定か」も見ない。鍵が切れたあとでも、設定を戻したあとでも、自分が出したものは自分で消せる。
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
  v_mine   text[];
  v_op     boolean;
  v_target text;
  v_id     uuid;
  v_n      int;
begin
  v_mine := public.pv_stay_me(p);
  if cardinality(v_mine) = 0 then
    return jsonb_build_object('ok', false, 'status', 'locked');
  end if;
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
     where id = v_id and (author_hash = any(v_mine) or v_op);
  else
    delete from public.pv_stay_photos
     where id = v_id and (author_hash = any(v_mine) or v_op);
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'target', v_target, 'id', v_id);
end;
$fn$;

revoke all on function public.pv_stay_delete(jsonb) from public;
grant execute on function public.pv_stay_delete(jsonb) to anon, authenticated;

comment on function public.pv_stay_delete(jsonb) is
  'ステイ情報の場所・写真を消す。書いた本人（ログインの印か、ログインせずに足したときの端末の鍵）か運営だけ。他人のものは在っても無くても not_found。';


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
-- 10-e. 運営の「追加」で足せる空港（管理ページのホテルの面が、会社と空港の候補に使う）
-- ════════════════════════════════════════════════════════════════
-- 引数: p（いまは使わない。形をそろえるためだけ ── pv_stay_queue と同じ）
-- 返り値: {ok:true, airports:{<会社の符号>:['AAA', …], …}}   3-n の一覧そのもの（足す口が止める決まりと同じ1か所）
--   forbidden  運営ではない（★何も調べずに返す）
-- ★ ホテルのことは何も返さない（名前も件数も）。空港の3字は会社ページに出ているものと同じ。
create or replace function public.pv_stay_airports(p jsonb default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
begin
  if public.pv_stay_role() is distinct from 'operator' then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;
  return jsonb_build_object('ok', true, 'airports', public.pv_stay_network());
end;
$fn$;

revoke all on function public.pv_stay_airports(jsonb) from public, anon;
grant execute on function public.pv_stay_airports(jsonb) to authenticated;

comment on function public.pv_stay_airports(jsonb) is
  '運営の「追加」でホテルを足せる空港（会社ごとの就航地。3-n）。運営だけ。ホテルのことは何も返さない。';


-- ════════════════════════════════════════════════════════════════
-- 10-a. 見てよい人の申し込みと、オーナーの承認（★決めるのはオーナーだけ）── 約束 1
-- ════════════════════════════════════════════════════════════════
-- オーナーが承認するのは**人**（ホテルではない）。この節の決める口が決めるのは、承認の表に行が在る人だけ
-- （行が無い人は not_found）。
-- ★ 2026-10-16 から画面はこの節を呼ばない。申請（画像つき）と verified は 10-c。
-- ★ 2026-10-17（P12.51）から、この節の決める口も「画像を見ずに承認しない」に従う（10-a-2b。会員一覧の verified と同じ1か所）。
--   この節の申し込みで申し込んだ人・見送った人・画像を見て決めたことのある人は、ここでは承認されない（画像の面からだけ）。
--   ただし、画像を見て verified にしたあといまのオーナーが取り消した人は、ここでも画像なしで戻せる（P12.61 Q1 = 2。同じ1か所）。
--   見送り・取り消しは今までどおり。口そのものは消さない。
-- 3本とも authenticated にだけ配る（未ログインには配らない）。
-- ★ 一覧の口と決める口は、オーナーでなければ**何も読まずに** forbidden を返す。
--   オーナーかどうかは pv_stay_owner_id()（3-b）の1か所で決める。運営であること（pv_admins）・
--   承認された人であること・確認の印・JWT の中身は、どれもオーナーの代わりにならない。
-- ★ 状態は「いまのオーナーにとっての状態」で返す。前のオーナーが決めた行は、いまのオーナーが
--   決め直すまで 'pending'（申し込んだまま、返事を待っている）として扱う
--   ＝ 前のオーナーの承認を 'approved' と言わない（その行では何も開かない。3-b2 の pv_stay_sees）。
--   オーナーを替えると（10-b）、前のオーナーの承認は全部効かなくなり、新しいオーナーが決め直す。
-- ★ 時刻は返さない（約束 7）。申し込んだ時期・決めた時期は 0〜4 の段（3-e）だけ。
-- ★ 名簿の行には user_id が入っている（2-b）。それを返すのはオーナーの一覧だけ。
--   投稿の表とは突き合わせない・author_hash は返さない（約束 3）。

-- 10-a-1. 申し込む／自分の状態を読む（会員）
-- 引数: p = {ask:true|false}（ask が JSON の true のときだけ申し込む。それ以外は読むだけ）
--   ★ ほかの欄（state・user_id など）は読まない。自分の状態を自分で決める道・人の分を申し込む道を作らない。
-- 返り値:
--   ログインしていない → {ok:false, status:'login'}
--   オーナー           → {ok:true, state:'owner'}（申し込まない・行を書かない）
--   それ以外           → {ok:true, state:'none'|'pending'|'approved'|'denied'|'revoked'}
--     ★ 呼んだ本人の状態だけ。ほかの人の状態も、ホテルの欄も1つも返さない。
--   ask:true は、本人の行が無いときだけ 'pending' の行を入れる（申し込んだ時刻は now()）。
--   行が在れば（申し込み中・承認・見送り・取り消し）、そのまま残して今の状態を返す。
create or replace function public.pv_stay_viewer_request(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_caller uuid;
  v_owner  uuid;
  v_row    public.pv_stay_viewers%rowtype;
begin
  v_caller := auth.uid();
  if v_caller is null then
    return jsonb_build_object('ok', false, 'status', 'login');
  end if;
  v_owner := public.pv_stay_owner_id();
  if v_caller = v_owner then
    return jsonb_build_object('ok', true, 'state', 'owner');
  end if;

  if coalesce(p -> 'ask' = 'true'::jsonb, false) then
    insert into public.pv_stay_viewers (user_id, state, asked_at)
    values (v_caller, 'pending', now())
    on conflict (user_id) do nothing;
  end if;

  select * into v_row from public.pv_stay_viewers v where v.user_id = v_caller;
  if not found then
    return jsonb_build_object('ok', true, 'state', 'none');
  end if;
  return jsonb_build_object('ok', true, 'state',
    case when v_row.state = 'pending' or v_row.decided_by is distinct from v_owner then 'pending'
         else v_row.state end);
end;
$fn$;

revoke all on function public.pv_stay_viewer_request(jsonb) from public, anon;
grant execute on function public.pv_stay_viewer_request(jsonb) to authenticated;

comment on function public.pv_stay_viewer_request(jsonb) is
  'ステイ情報を見てよい人への申し込み（会員）。ask:true で、行が無いときだけ pending を入れる。返すのは呼んだ本人の状態だけ（none・pending・approved・denied・revoked。オーナーには owner）。前のオーナーが決めた行は pending と答える。ほかの欄は読まない。';

-- 10-a-2. 申し込んだ人の一覧（オーナーだけ）
-- 引数: なし
-- 返り値:
--   オーナーでない（未ログイン・会員・承認された人・運営）→ {ok:false, status:'forbidden'}（★何も読まずに返す）
--   オーナー → {ok:true, rows:[{id, email, name, company, position, state, asked, decided}]}
--     id       その人の user_id（決める口へそのまま送り返す）
--     email    その人がログインに使っているメールアドレス（auth.users）
--     name・company・position  その人がプロフィールに自分で書いた言葉（無ければ null）。
--              ★ 見せるだけ。確かめた値ではなく、何も開かない（約束 1 の「根拠にしない」）。
--     state    'pending'|'approved'|'denied'|'revoked'（いまのオーナーにとっての状態。上の ★）
--     asked    申し込んだ時期の段（0〜4。3-e。入っていなければ null）
--     decided  いまのオーナーが決めた時期の段（まだ決めていなければ null）
--   ★ 並びは 申し込み中 → 承認 → 見送り → 取り消し、その中は申し込んだ順。200人まで。
--   ★ オーナー自身の行は出さない（オーナーは承認なしで読める。自分は決めない）。
create or replace function public.pv_stay_viewer_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_owner uuid;
  v_rows  jsonb;
begin
  v_owner := public.pv_stay_owner_id();
  if auth.uid() is null or v_owner is null or auth.uid() <> v_owner then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;

  select coalesce(jsonb_agg(z.j order by z.k, z.t, z.id), '[]'::jsonb)
    into v_rows
    from (
      select jsonb_build_object(
               'id', x.user_id,
               'email', u.email,
               'name', pf.name,
               'company', pf.company,
               'position', pf."position",
               'state', x.st,
               'asked', case when x.asked_at is null then null else public.pv_stay_age(x.asked_at) end,
               'decided', case when x.st = 'pending' then null else public.pv_stay_age(x.decided_at) end) as j,
             case x.st when 'pending' then 0 when 'approved' then 1 when 'denied' then 2 else 3 end as k,
             x.asked_at as t, x.user_id as id
        from (select v.user_id, v.asked_at, v.decided_at,
                     case when v.state = 'pending' or v.decided_by is distinct from v_owner then 'pending'
                          else v.state end as st
                from public.pv_stay_viewers v
               where v.user_id <> v_owner) x
        left join auth.users u on u.id = x.user_id
        left join public.profiles pf on pf.id = x.user_id
       order by k, t nulls last, id limit 200
    ) z;

  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$fn$;

revoke all on function public.pv_stay_viewer_queue() from public, anon;
grant execute on function public.pv_stay_viewer_queue() to authenticated;

comment on function public.pv_stay_viewer_queue() is
  'ステイ情報を見てよい人の申し込みの一覧。オーナーだけ（運営でも、オーナーでなければ forbidden）。id・メールアドレス・プロフィールに本人が書いた言葉・いまのオーナーにとっての状態・時期の段（0〜4）。時刻は返さない。';

-- 10-a-2b. 画像を見ずに承認してよい人か（★決める口 10-a-3 と、verified の会員一覧の道 10-c-5 が、同じこれを呼ぶ）── P12.51
-- 「画像を見ずに承認してよい」のは、一度も申請していない人（オーナーの答え P12.47「1よい」）と、
-- オーナーが画像を見て verified にしたあと、いまのオーナーが取り消した人（オーナーの答え P12.61 Q1 = 2。印 image_verified）だけ。
-- ほかに申請したことのある人は、オーナーが画像を見て決める（それが見てよい理由。P12.46）。
-- 引数: p_id（その人の user_id）
-- 返り値: null ＝ 画像なしで承認してよい（申請の跡が無い・画像で verified にして取り消した人・または、いまのオーナーがもう承認している ＝ 何も変わらない）
--   'use_image'       申請（画像）が待っている ── 画像の面（10-c-5 の via 'applicant'）から決める（画像で verified にしたことがある人も同じ）
--   'applied_denied'  申請を見送られた（決めたのがどのオーナーでも）── 画像なしでは通さない。本人はマイページからまた申請できる
--                     （前に画像で verified にしたことがある人でも、そのあと画像を見て見送ったなら同じ）
--   'no_image'        ほかの申請の跡がある（10-a-1 の申し込みの行が在る・画像を見て決めたことがある ever_applied）。
--                     いまは画像が無いので、画像なしでは決めない ── 本人がもう一度申請する
--   ★ 画像で verified にしたあと取り消した人が null になるのは、取り消したのがいまのオーナーのときだけ（オーナーが替わったら no_image ──
--     前のオーナーの承認が効かないのと同じ）。自動では戻さない（null は「オーナーが押せば通る」であって、ここは何も書かない）。
-- ★ 読むのは承認の表の本人の1行と、申請の一覧（db/proof-offer.sql。無ければ画像は「無い」）だけ。何も書かない。
-- ★ 誰にも配らない（呼ぶのは 10-a-3 と 10-c-5 の security definer の中だけ。ほかに 10-c-4 の会員一覧が、行の印 reapply を作るために読む ── 承認はしない）。
create or replace function public.pv_stay_image_needed(p_id uuid)
returns text
language plpgsql
stable
set search_path = public, extensions
as $fn$
declare
  v_row public.pv_stay_viewers%rowtype;
begin
  if p_id is null then
    return null;
  end if;
  -- 申請の仕組み（db/proof-offer.sql）がまだ貼られていなければ、画像は「無い」（文は分けておく ── 無い関数の文は流さない）
  if to_regprocedure('public.pv_proof_offers()') is not null then
    if exists (select 1 from public.pv_proof_offers() o where o.user_id = p_id and o.has_image) then
      return 'use_image';
    end if;
  end if;
  select * into v_row from public.pv_stay_viewers v where v.user_id = p_id;
  if not found then
    return null;
  end if;
  if v_row.state = 'approved' and v_row.decided_by = public.pv_stay_owner_id() then
    return null;
  end if;
  if v_row.state = 'denied' then
    return 'applied_denied';
  end if;
  -- ★Q1 = 2（P12.61）: オーナーが画像を見て verified にした人を、いまのオーナーが取り消した ── 画像なしで戻してよい
  if v_row.state = 'revoked' and v_row.decided_by = public.pv_stay_owner_id() and v_row.image_verified then
    return null;
  end if;
  if v_row.state = 'pending' or v_row.asked_at is not null or v_row.ever_applied then
    return 'no_image';
  end if;
  return null;
end;
$fn$;

revoke all on function public.pv_stay_image_needed(uuid) from public, anon, authenticated;

comment on function public.pv_stay_image_needed(uuid) is
  '画像を見ずに承認してよい人か（null ＝ よい）。よいのは一度も申請していない人と、画像を見て verified にしたあといまのオーナーが取り消した人（image_verified）だけ。申請が待っている → use_image・見送られた → applied_denied・ほかに申請の跡がある（申し込みの行・画像を見て決めたことがある）→ no_image。決める口と verified の会員一覧の道が同じこれを呼ぶ。誰にも配らない。';

-- 10-a-3. 決める（オーナーだけ）
-- 引数: p = {id:<その人の user_id>, state:'approved'|'denied'|'revoked'}
-- 返り値:
--   オーナーでない → {ok:false, status:'forbidden'}（★何も読まず・何も書かずに返す）
--   id がオーナー自身 → {ok:false, status:'self'}（オーナーは自分を決めない。何も書かない）
--   承認（state 'approved'）で、画像を見ずに承認してはいけない人 → {ok:false, status:'use_image'|'applied_denied'|'no_image'}
--     （★10-a-2b の1か所で決める ── 会員一覧の verified と同じ答え。何も書かない。P12.51）
--   id の形が違う・申し込みの行が無い → {ok:false, status:'not_found'}（行の無い人はこの口では決めない）
--   state が上の3つでない・いまの状態からは動かせない → {ok:false, status:'bad_state'}（何も書かない）
--   決めた → {ok:true, state}（決めた人 decided_by ＝ オーナー・決めた時刻 decided_at ＝ now()）
-- 動かせるのは（「いまの状態」は、いまのオーナーにとっての状態。前のオーナーが決めた行は 'pending'）:
--   'pending' → 'approved' か 'denied'／'approved' → 'revoked'／'denied'・'revoked' → 'approved'
--   ★ 'approved' へ動かせるのは、10-a-2b が「画像なしで承認してよい」と答えた人だけ（一度も申請していない人と、
--     画像を見て verified にしたあといまのオーナーが取り消した人 ── P12.61 Q1 = 2）。
--     この節の申し込みで申し込んだ人・見送った人・ほかに画像を見て決めたことのある人は、画像の面（10-c-5）からだけ。
--     ★ 戻すときも印（image_verified・ever_applied）には触らない（この口は印を書かない）。
--   ★ 見送り（'denied'）と取り消し（'revoked'）は今までどおり。
--   ★ いまと同じ状態を指定したら、何も書かずに {ok:true, state} を返す（2回押しても壊れない）。
-- ★ 承認を取り消すと、その人は次に呼んだ瞬間から locked（pv_stay_sees は呼ばれるたびに表を読む）。
create or replace function public.pv_stay_viewer_decide(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_owner uuid;
  v_id    uuid;
  v_to    text;
  v_from  text;
  v_why   text;
  v_row   public.pv_stay_viewers%rowtype;
begin
  v_owner := public.pv_stay_owner_id();
  if auth.uid() is null or v_owner is null or auth.uid() <> v_owner then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;

  v_id := public.pv_stay_uuid(p->>'id');
  if v_id = v_owner then
    return jsonb_build_object('ok', false, 'status', 'self');
  end if;

  -- ★画像を見ずに承認しない（P12.51）。会員一覧の verified（10-c-5）と同じ1か所で決める・同じ答えを返す
  if coalesce(p->>'state', '') = 'approved' then
    v_why := public.pv_stay_image_needed(v_id);
    if v_why = 'use_image' then
      return jsonb_build_object('ok', false, 'status', 'use_image');
    end if;
    if v_why = 'applied_denied' then
      return jsonb_build_object('ok', false, 'status', 'applied_denied');
    end if;
    if v_why is not null then
      return jsonb_build_object('ok', false, 'status', 'no_image');
    end if;
  end if;

  select * into v_row from public.pv_stay_viewers v where v.user_id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  v_to := coalesce(p->>'state', '');
  if v_to not in ('approved', 'denied', 'revoked') then
    return jsonb_build_object('ok', false, 'status', 'bad_state');
  end if;
  v_from := case when v_row.state = 'pending' or v_row.decided_by is distinct from v_owner then 'pending'
                 else v_row.state end;
  if v_to = v_from then
    return jsonb_build_object('ok', true, 'state', v_to);
  end if;
  if not ((v_from = 'pending' and v_to in ('approved', 'denied'))
          or (v_from = 'approved' and v_to = 'revoked')
          or (v_from in ('denied', 'revoked') and v_to = 'approved')) then
    return jsonb_build_object('ok', false, 'status', 'bad_state');
  end if;

  update public.pv_stay_viewers
     set state = v_to, decided_by = auth.uid(), decided_at = now()
   where user_id = v_id;
  return jsonb_build_object('ok', true, 'state', v_to);
end;
$fn$;

revoke all on function public.pv_stay_viewer_decide(jsonb) from public, anon;
grant execute on function public.pv_stay_viewer_decide(jsonb) to authenticated;

comment on function public.pv_stay_viewer_decide(jsonb) is
  'ステイ情報を見てよい人を決める（承認・見送り・取り消し）。オーナーだけ（運営でも、オーナーでなければ forbidden・何も書かない）。行が無ければ not_found。オーナー自身は self。承認は、一度も申請していない人と、画像を見て verified にしたあといまのオーナーが取り消した人だけ（申請が待っている → use_image・見送った → applied_denied・ほかに申請の跡がある → no_image。会員一覧の verified と同じ1か所 pv_stay_image_needed で決める・何も書かない）。決めた人と時刻を必ず書く。';


-- ════════════════════════════════════════════════════════════════
-- 10-c. パイロットであることの確認（申請と、オーナーの「verified」）── 約束 1（2026-10-16）
-- ════════════════════════════════════════════════════════════════
-- オーナー指示（2026-10-16）「オーナーの管理画面で申請してきた人一覧と、会員一覧の中にボタンで
--   verified ボタンをつけて。基本的に申請してきた人は、パイロットと証明する画像提出必要」
--   「運営はおれしかいない」── 申請者・画像・verified はオーナーだけ。
-- ★ 画像の置き場は前からある仕組み（db/pilot-proof.sql ＋ db/proof-offer.sql の4本）。
--   ここは画像の表を1回も読まない・書かない。
-- ★ 申請は何も止めない（REAL PAY・DEEP PAY・口コミ本文・ホテルの追加・いま見られているもの）。
-- ★ 見てよい人になるのは、オーナーが verified を押したときだけ（pv_stay_viewers に 'approved'・
--   決めた人 ＝ いまのオーナー）。画像を出しただけ・パイロットの確認（proof の approved）・運営の名簿・
--   給与・ログイン・プロフィールの印では、どれも1行も書かれない。
-- ★ verified はパイロットの確認（pv_proof）を 'approved' にしない。申請の行を終える（画像ごと消える）だけ。
-- ★ オーナーの4本は、オーナーでなければ**何も読まずに** forbidden を返す（10-a と同じ1か所 pv_stay_owner_id）。
-- ★ 申請の仕組み（db/proof-offer.sql）がまだ貼られていなければ、会員の入口は 'closed'・申請者の一覧は空・
--   画像は 'none'（何も受け取らない）。会員一覧と verified はそれでも動く（申請の行を終える所だけ飛ばす）。
-- ★ 10-a の申し込み（pv_stay_viewer_request / _queue / _decide）はそのまま残す（画面からはもう呼ばない）。

-- 10-c-1. 申請する／自分の状態を読む（会員。ポップアップが呼ぶ）
-- 引数: p = {image:<JPEG の base64>}（image が文字列のときだけ出す。それ以外は読むだけ）
-- 返り値:
--   ログインしていない → {ok:false, status:'login'}
--   オーナーが決まっていない・申請の仕組みが無い → {ok:false, status:'closed'}（画像を受け取らない）
--   オーナー           → {ok:true, state:'owner'}
--   もう見てよい人      → {ok:true, state:'approved'}（画像を受け取らない）
--   読むだけ           → {ok:true, state:'offered'|'none'}
--   出した             → {ok:true, state:'offered'} か {ok:false, status:'image_bad'|'image_too_big'|'too_many'|'unavailable'}
--   ★ 'unavailable' は運営の確認の途中・前の確認の控えがある人（どちらも中身を言わない ──
--     「前に確認を求められたことがある」を画面へ渡さない。main の pv_proof_state と同じ考え）。
create or replace function public.pv_stay_apply(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_b64   text;
  v_r     jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'status', 'login');
  end if;
  v_owner := public.pv_stay_owner_id();
  if v_owner is null or to_regprocedure('public.pv_proof_offer(text)') is null then
    return jsonb_build_object('ok', false, 'status', 'closed');
  end if;
  if v_uid = v_owner then
    return jsonb_build_object('ok', true, 'state', 'owner');
  end if;
  if coalesce(public.pv_stay_sees(), false) then
    return jsonb_build_object('ok', true, 'state', 'approved');
  end if;

  v_b64 := case when jsonb_typeof(p) = 'object' and jsonb_typeof(p->'image') = 'string'
                then p->>'image' end;
  if v_b64 is null then
    return jsonb_build_object('ok', true, 'state',
      case when exists (select 1 from public.pv_proof_offers() o
                         where o.user_id = v_uid and o.has_image)
           then 'offered' else 'none' end);
  end if;

  v_r := public.pv_proof_offer(v_b64);
  if v_r->>'status' in ('in_check', 'checked', 'no_member') then
    return jsonb_build_object('ok', false, 'status', 'unavailable');
  end if;
  return v_r;
end;
$fn$;

revoke all on function public.pv_stay_apply(jsonb) from public, anon;
grant execute on function public.pv_stay_apply(jsonb) to authenticated;

comment on function public.pv_stay_apply(jsonb) is
  'パイロットであることを示す画像を自分から出す（申請）／自分の状態を読む。何も止めない。返すのは本人の状態だけ（none・offered・approved・owner）。見てよい人になるのはオーナーが verified を押したときだけ。';

-- 10-c-2. 申請してきた人の一覧（オーナーだけ）
-- 引数: p（いまは使わない。形をそろえるためだけ ── pv_stay_queue と同じ）
-- 返り値: オーナーでない → {ok:false, status:'forbidden'}（★何も読まずに返す）
--         オーナー → {ok:true, rows:[{id, email, name, company, position, size, asked}]}
--   画像のある申請だけ（画像の無い申請は作れない）。出した時期は 0〜4 の段（3-e）。古い順に200人まで。
create or replace function public.pv_stay_applicants(p jsonb default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_owner uuid;
  v_rows  jsonb;
begin
  v_owner := public.pv_stay_owner_id();
  if auth.uid() is null or v_owner is null or auth.uid() <> v_owner then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;
  if to_regprocedure('public.pv_proof_offers()') is null then
    return jsonb_build_object('ok', true, 'rows', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(z.j order by z.t, z.id), '[]'::jsonb) into v_rows
    from (select jsonb_build_object(
                   'id', o.user_id, 'email', u.email, 'name', pf.name,
                   'company', pf.company, 'position', pf."position",
                   'size', o.byte_len, 'asked', public.pv_stay_age(o.submitted_at)) as j,
                 o.submitted_at as t, o.user_id as id
            from public.pv_proof_offers() o
            left join auth.users u on u.id = o.user_id
            left join public.profiles pf on pf.id = o.user_id
           where o.has_image and o.user_id <> v_owner
           order by o.submitted_at, o.user_id
           limit 200) z;
  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$fn$;

revoke all on function public.pv_stay_applicants(jsonb) from public, anon;
grant execute on function public.pv_stay_applicants(jsonb) to authenticated;

comment on function public.pv_stay_applicants(jsonb) is
  'パイロットであることの確認を申請してきた人の一覧（画像のある人だけ）。オーナーだけ（運営でも、オーナーでなければ forbidden）。画像は返さない。';

-- 10-c-3. 申請の画像を1枚見る（オーナーだけ）
-- 引数: p = {id}  返り値: forbidden（★何も読まずに）／{ok:true, mime, b64}／{ok:false, status:'none'}
create or replace function public.pv_stay_applicant_image(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare v_owner uuid;
begin
  v_owner := public.pv_stay_owner_id();
  if auth.uid() is null or v_owner is null or auth.uid() <> v_owner then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;
  if to_regprocedure('public.pv_proof_offer_image(uuid)') is null then
    return jsonb_build_object('ok', false, 'status', 'none');
  end if;
  return public.pv_proof_offer_image(public.pv_stay_uuid(p->>'id'));
end;
$fn$;

revoke all on function public.pv_stay_applicant_image(jsonb) from public, anon;
grant execute on function public.pv_stay_applicant_image(jsonb) to authenticated;

comment on function public.pv_stay_applicant_image(jsonb) is
  '申請の画像を1枚返す。オーナーだけ（運営でも、オーナーでなければ forbidden）。申請の行の画像だけ。';

-- 10-c-4. 会員一覧（オーナーだけ）
-- 引数: p（いまは使わない。形をそろえるためだけ）
-- 返り値: オーナーでない → {ok:false, status:'forbidden'}（★何も読まずに返す）
--         オーナー → {ok:true, rows:[{id, email, name, company, position, state, applied, reapply}]}
--   state    いまのオーナーにとっての状態（'approved'|'denied'|'revoked'|'none'。前のオーナーが決めた行・
--            申し込んだだけの行は 'none'）
--   applied  申請（画像あり）が在るか
--   reapply  画像なしでは verified にできず、いま待っている申請（画像）も無いか（true / false だけ）。
--            ＝ 会員一覧の verified が断られる人（申請を見送られた・ほかに申請の跡がある）。本人がマイページから新しい画像を出すまで、
--            行に verified を置かない。画像を見て verified にしたあといまのオーナーが取り消した人は false（P12.61 Q1 = 2 ──
--            新しい画像なしで戻せるので、行の verified を押せる）。
--            決めるのは 10-a-2b の1か所（verified の会員一覧の道と同じ答え）。申請の跡そのもの・時刻・理由は返さない。
--   ★ オーナー自身は出さない。並びは 申請あり → verified → それ以外、その中はメールの順。1000人まで。
create or replace function public.pv_stay_members(p jsonb default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
declare
  v_owner uuid;
  v_apps  uuid[] := array[]::uuid[];
  v_rows  jsonb;
begin
  v_owner := public.pv_stay_owner_id();
  if auth.uid() is null or v_owner is null or auth.uid() <> v_owner then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;
  if to_regprocedure('public.pv_proof_offers()') is not null then
    v_apps := array(select o.user_id from public.pv_proof_offers() o where o.has_image);
  end if;
  select coalesce(jsonb_agg(z.j order by z.k, z.e, z.id), '[]'::jsonb) into v_rows
    from (select jsonb_build_object(
                   'id', pf.id, 'email', u.email, 'name', pf.name,
                   'company', pf.company, 'position', pf."position",
                   'state', x.st, 'applied', x.ap, 'reapply', x.ra) as j,
                 case when x.ap then 0 when x.st = 'approved' then 1 else 2 end as k,
                 lower(coalesce(u.email, '')) as e, pf.id
            from public.profiles pf
            join auth.users u on u.id = pf.id
            cross join lateral (
              select coalesce((select v.state from public.pv_stay_viewers v
                                where v.user_id = pf.id and v.decided_by = v_owner
                                  and v.state in ('approved', 'denied', 'revoked')), 'none') as st,
                     pf.id = any(v_apps) as ap,
                     coalesce(public.pv_stay_image_needed(pf.id) in ('applied_denied', 'no_image'), false) as ra) x
           where pf.id <> v_owner
           order by k, e, pf.id
           limit 1000) z;
  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$fn$;

revoke all on function public.pv_stay_members(jsonb) from public, anon;
grant execute on function public.pv_stay_members(jsonb) to authenticated;

comment on function public.pv_stay_members(jsonb) is
  '会員一覧（verified の状態と、申請があるか・画像なしでは verified にできず申請も待っていないか reapply）。オーナーだけ（運営でも、オーナーでなければ forbidden）。オーナー自身は出さない。';

-- 10-c-5. verified（オーナーだけ）── 申請してきた人の一覧と、会員一覧の両方のボタンがこれを呼ぶ
-- 引数: p = {id, state, via}
--   via 'applicant'（申請してきた人の一覧・画像を見た所から）: state 'approved'（verified）か 'denied'（見送り）
--        ★申請の画像が在るときだけ決める（無ければ no_image・何も書かない）
--   via 'member'（会員一覧）: state 'approved'（verified）か 'revoked'（取り消す・いま verified の人だけ）
--        ★会員一覧は、申請の画像を通る道の代わりにならない（P12.46・オーナーの決まり 2026-10-17）。verified は
--          申請（画像）が待っている人 → use_image（画像の面から決める）・画像を見て見送った人 → applied_denied
--          （画像なしでは通さない。本人はマイページからまた申請できる）。どちらも何も書かない・画像も申請もそのまま。
--          一度も申請していない人は、画像なしで verified にしてよい（オーナーの答え P12.47「1よい」）。
--        ★決めるのは 10-a-2b の1か所（10-a-3 の決める口と同じ答え。P12.51）。ほかに申請の跡がある人
--          （10-a-1 の申し込みの行が在る・画像を見て決めたことがある）も → no_image（何も書かない）。
--          ただし、画像を見て verified にしたあと、いまのオーナーが取り消した人は、画像なしで verified に戻せる
--          （オーナーの答え P12.61 Q1 = 2。オーナーが会員一覧の「verified」を押したときだけ ── 自動では戻さない）。
-- 返り値: forbidden（★何も読まず・何も書かずに）／self／not_found／bad_state／no_image／use_image／applied_denied／
--         {ok:true, state, discarded}（discarded ＝ この決定で消えた申請の画像の枚数）
-- ★ どの決定でも、その人の申請は終わる（画像はその場で消える）。
-- ★ 申請の画像が在るまま状態を決めたときは、承認の表のその人の行に ever_applied を残す（申請の行と画像は消えても、
--   「申請したことがある」は消えない。前の印は消さない）。
-- ★ 申請してきた人の道で、画像が在るまま「verified」を押したときだけ、同じ1文で image_verified も残す（Q1 = 2。前の印は消さない ──
--   会員一覧から戻しても・取り消しても true のまま。見送りの読み替え（下の P12.17）より前に決めるので、「見送り」では付かない）。
--   ただし状態を変えない決定（いま verified の人の申請を「見送り」── P12.17）は、承認の行に1文字も触らない（印も書かない）。
--   verified の人は自分からは申請できない（10-c-1）ので、その形はオーナーを替えて戻したときと、DB の持ち主が作った行にしか無い。
-- ★ 'denied' でも、いま verified の人は verified のまま（見送りで、見られているものを取り上げない）。
-- ★ pv_proof には「申請の行を終える」以外で1文字も触らない（approved にしない・運営の確認の行は動かさない）。
create or replace function public.pv_stay_viewer_verify(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $fn$
declare
  v_owner uuid;
  v_id    uuid;
  v_via   text;
  v_to    text;
  v_cur   text;
  v_img   boolean;
  v_why   text;
  v_imgv  boolean;
  v_disc  integer := 0;
begin
  v_owner := public.pv_stay_owner_id();
  if auth.uid() is null or v_owner is null or auth.uid() <> v_owner then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;
  v_id := public.pv_stay_uuid(p->>'id');
  if v_id = v_owner then
    return jsonb_build_object('ok', false, 'status', 'self');
  end if;
  if v_id is null
     or not exists (select 1 from auth.users u where u.id = v_id)
     or not exists (select 1 from public.profiles pf where pf.id = v_id) then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;
  v_via := coalesce(p->>'via', '');
  v_to  := coalesce(p->>'state', '');
  if not ((v_via = 'applicant' and v_to in ('approved', 'denied'))
          or (v_via = 'member' and v_to in ('approved', 'revoked'))) then
    return jsonb_build_object('ok', false, 'status', 'bad_state');
  end if;

  select case when v.decided_by = v_owner and v.state in ('approved', 'denied', 'revoked')
              then v.state else 'none' end
    into v_cur
    from public.pv_stay_viewers v where v.user_id = v_id for update;
  v_cur := coalesce(v_cur, 'none');
  v_img := false;
  if to_regprocedure('public.pv_proof_offers()') is not null then
    v_img := exists (select 1 from public.pv_proof_offers() o where o.user_id = v_id and o.has_image);
  end if;

  if v_via = 'applicant' and not v_img then
    return jsonb_build_object('ok', false, 'status', 'no_image');
  end if;
  -- ★画像を見て verified にした印（Q1 = 2・P12.61）。申請してきた人の道で、画像が在るまま「verified」を押したときだけ
  --   （見送りの読み替え ── 下の P12.17 ── より前に決める。会員一覧の道・見送り・取り消しでは付かない）
  v_imgv := v_via = 'applicant' and v_to = 'approved' and v_img;
  -- ★会員一覧の verified は、画像を見ずに通す道にしない。画像なしで承認してよいのは一度も申請していない人と、
  --   画像を見て verified にしたあといまのオーナーが取り消した人だけ（10-a-3 の決める口と同じ1か所で決める・同じ答えを返す ── P12.51・P12.61）
  if v_via = 'member' and v_to = 'approved' then
    v_why := public.pv_stay_image_needed(v_id);
    if v_why = 'use_image' then
      return jsonb_build_object('ok', false, 'status', 'use_image');
    end if;
    if v_why = 'applied_denied' then
      return jsonb_build_object('ok', false, 'status', 'applied_denied');
    end if;
    if v_why is not null then
      return jsonb_build_object('ok', false, 'status', 'no_image');
    end if;
  end if;
  if v_to = 'revoked' and v_cur <> 'approved' then
    return jsonb_build_object('ok', false, 'status', 'bad_state');
  end if;
  if v_to = 'denied' and v_cur = 'approved' then
    v_to := 'approved';                         -- 見送りで、いま見られているものを取り上げない
  end if;

  -- 状態を変えない決定（いま verified の人の申請への「見送り」── P12.17）では、承認の行に1文字も触らない（印も書かない）
  if v_to <> v_cur then
    insert into public.pv_stay_viewers as v (user_id, state, decided_by, decided_at, ever_applied, image_verified)
    values (v_id, v_to, auth.uid(), now(), v_img, v_imgv)
    on conflict (user_id) do update
       set state = excluded.state, decided_by = excluded.decided_by, decided_at = excluded.decided_at,
           ever_applied = v.ever_applied or excluded.ever_applied,
           image_verified = v.image_verified or excluded.image_verified;
  end if;

  if to_regprocedure('public.pv_proof_offer_close(uuid)') is not null then
    v_disc := public.pv_proof_offer_close(v_id);
  end if;
  return jsonb_build_object('ok', true, 'state', v_to, 'discarded', coalesce(v_disc, 0));
end;
$fn$;

revoke all on function public.pv_stay_viewer_verify(jsonb) from public, anon;
grant execute on function public.pv_stay_viewer_verify(jsonb) to authenticated;

comment on function public.pv_stay_viewer_verify(jsonb) is
  'verified（見てよい人にする）・見送り・取り消し。オーナーだけ（運営でも、オーナーでなければ forbidden・何も書かない）。申請してきた人は画像があるときだけ決める。会員一覧からは、申請が待っている人（use_image）・画像を見て見送った人（applied_denied）・ほかに申請の跡がある人（no_image）を verified にしない（何も書かない。決める口と同じ1か所 pv_stay_image_needed）。ただし画像を見て verified にしたあといまのオーナーが取り消した人は、画像なしで戻せる。どの決定でも申請は終わり、画像はその場で消える（申請したことは ever_applied に、画像を見て verified にしたことは image_verified に残る）。パイロットの確認（pv_proof）を approved にしない。';


-- ════════════════════════════════════════════════════════════════
-- 10-d. 毎時の片づけ（★pg_cron が在るときだけ登録する。無ければ何もしない）
-- ════════════════════════════════════════════════════════════════
--   3-c5 の片づけ（回線の印は1日だけ・足したものが無い鍵は1日で消す・回線ごとのその日の数も1日で消す）を、誰も足さない日にも流す。
--   1時間に1回 ＝ 作って1日たった印は、遅くとも1時間あとに消える（1日に1回だと、最長で2日近く残る）。
--   ★ pg_cron は本番（Supabase）には在る。手元の検査（PGlite）には無い ＝ ここは飛ばす。
--   ★ 同じ名前で登録し直すだけなので、何度流しても1本のまま（pg_cron は同じ名前の登録を置き換える）。
--   止めるとき: select cron.unschedule('pv-stay-key-sweep');
--   実行履歴  : select * from cron.job_run_details order by start_time desc limit 20;
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute format('select cron.schedule(%L, %L, %L)',
                   'pv-stay-key-sweep', '17 * * * *', 'select public.pv_stay_key_sweep()');
  end if;
end
$cron$;


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
-- ポリシー数は 0 が正しい（場所・写真・端末の鍵・回線ごとのその日の数の表と、見てよい人の名簿の2表の合計）。
-- オーナーは 1 が正しい。0 のあいだは誰にも見えない（上の 10-b の1行を、メールアドレスを入れて流す）。
-- 承認した人は、いまのオーナーが承認した人の数（オーナー自身は数えない。申し込み・見送り・取り消しは数えない）。
-- 端末の鍵は、ログインせずに足した端末の数（ログインして引き取られると消える・足したものが無い鍵は1日で消える）。
select (select count(*) from pg_policies
         where schemaname = 'public'
           and tablename in ('pv_stay_places', 'pv_stay_photos', 'pv_stay_keys', 'pv_stay_ip_day'))
     + (select count(*) from pg_policies
         where schemaname = 'public'
           and tablename in ('pv_stay_owner', 'pv_stay_viewers'))      as ポリシー数,
       (select count(*) from public.pv_stay_owner)                     as オーナー,
       (select count(*) from public.pv_stay_viewers v
         where v.state = 'approved'
           and v.decided_by = (select o.user_id from public.pv_stay_owner o)) as 承認した人,
       (select count(*) from public.pv_stay_keys)                      as 端末の鍵,
       (select count(*) from public.pv_admins)                         as 運営;
