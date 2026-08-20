-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/review-mgmt-score.sql
-- 口コミ（reviews_v2）の「経営陣への提案」に★評価を1列足す。
-- Supabase → SQL Editor に貼り付けて実行。冪等（何度流しても安全）。
--
-- なぜ。口コミは7軸あるが、Management だけ文章しか無く
-- （culture / salary / benefits / wlb / ops / training は ★＋文章）、
-- 他6軸と並べて出せない。待遇DB側に同じスライダーを作ると主観データが
-- 2箇所に割れるので作らない。★をこちらに1つ足して寄せる。
--
-- ⚠️ reviews_v2 の定義はリポジトリに無く、本番 Supabase にしか存在しない。
--    このファイルが reviews_v2 への唯一の追記なので、他の列には触らない。
--
-- **適用しなくてもフロントは壊れない**：列不在エラーを検知して該当キーを落とし
-- 再 insert する（submit-review.html の OPTIONAL_COLS リトライ）。
-- 流すと初めて実際に保存されるようになる。
--
-- ⚠️ 航空会社ページの口コミカードは6枚のまま。7枚目にすると
--    「6カテゴリ」の文言を日英の複数箇所で直すことになるので、
--    点だけ先に貯め、表示は WORKING CONDITIONS の公開と同じ回にまとめて直す。
-- ════════════════════════════════════════════════════════════════

-- ── 0) 前提テーブルの存在確認 ──
-- 無い状態で流すと「列を足したつもり」で終わるので、はっきり止める。
do $$
begin
  if to_regclass('public.reviews_v2') is null then
    raise exception 'public.reviews_v2 が無い。口コミ本体を先に作ること。';
  end if;
end $$;

-- ── 1) 列の追加 ──
alter table public.reviews_v2
  add column if not exists mgmt_score smallint;

comment on column public.reviews_v2.mgmt_score is
  '経営陣への提案の★（1〜5）。未評価は null。他6軸の *_score と同じ意味。';

-- ── 2) 値の範囲（名前を固定したいので inline check にしない）──
-- 条件を変えて流し直したときに古い定義が残らないよう、毎回付け直す。
alter table public.reviews_v2 drop constraint if exists reviews_v2_mgmt_score_ck;
alter table public.reviews_v2
  add constraint reviews_v2_mgmt_score_ck check (mgmt_score between 1 and 5);

-- 確認用:
-- select airline, mgmt_score, left(mgmt_comment, 40) as mgmt
--   from public.reviews_v2 order by created_at desc limit 10;
