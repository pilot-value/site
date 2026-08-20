-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/migrate-airline-codes.sql
--
-- 会社コードを 35 社の旧語彙から SSOT（salary-data.mjs／110社）へ寄せる。
--
-- 背景：投稿フォームの選択肢が事実上の正になっていたため、フォームだけに
-- 存在する短いコード（'qatar' 等）で口コミが保存されていた。SSOT 側は
-- 'qatar-airways' なので、そのままでは会社ページ・年収データと結合できない。
--
-- ★ このファイルは自動では流れない。オーナーの明示承認後に SQL Editor で実行する。
-- ★ 先に「1. 影響範囲」だけを実行して、何行動くかを見てから「2. 実行」に進むこと。
--
-- ── 実行前に知っておくべき副作用 ────────────────────────────
-- proof_hash は SHA-256(userId + '::pv_anon::' + 旧コード + '::2026') で、
-- 保存済みのハッシュは**旧コードからしか再現できない**。airline 列を書き換えても
-- proof_hash は変わらない（userId が無いので再計算できない）。したがって：
--
--   ・再解放は壊れない。pv-reunlock.js が LEGACY_CODES で旧コードのハッシュも
--     照合するため、旧コードで投稿した人は別端末でも解放が復活する。
--   ・ただし「1社1回」の重複防止は、該当する人・該当する社に限って外れる
--     （新コードで投稿すると別ハッシュになるため、もう1件書ける）。
--     現在 reviews_v2 は7件なので実害は小さい。件数が増えてからでは
--     この付け替えはできない、というのが今やる理由。
-- ════════════════════════════════════════════════════════════════

-- ── 1. 影響範囲を見る（先にこれだけ実行する）──────────────────
select airline as 現在のコード, count(*) as 件数,
       case airline
         when 'spring'    then 'spring-japan'
         when 'qatar'     then 'qatar-airways'
         when 'singapore' then 'singapore-airlines'
         when 'cathay'    then 'cathay-pacific'
         when 'alaska'    then 'alaska-airlines'
         when 'british'   then 'british-airways'
         when 'turkish'   then 'turkish-airlines'
         when 'jetstar'   then 'jetstar-japan'
         when 'asiana'    then '★SSOT に無い（要判断）'
       end as 寄せ先
  from public.reviews_v2
 where airline in ('spring','qatar','singapore','cathay','alaska','british','turkish','jetstar','asiana')
 group by airline
 order by 2 desc;

-- ── 2. 実行（1 の結果を確認してから）──────────────────────────
-- 'jetstar' は特に注意：旧フォームでは「ジェットスター・ジャパン」の意味だったが、
-- SSOT の 'jetstar' は Jetstar Airways（オーストラリア）を指す。放置すると
-- 別会社のデータとして黙って混ざるため、'jetstar-japan' に寄せる。
begin;

update public.reviews_v2 set airline = 'spring-japan'       where airline = 'spring';
update public.reviews_v2 set airline = 'qatar-airways'      where airline = 'qatar';
update public.reviews_v2 set airline = 'singapore-airlines' where airline = 'singapore';
update public.reviews_v2 set airline = 'cathay-pacific'     where airline = 'cathay';
update public.reviews_v2 set airline = 'alaska-airlines'    where airline = 'alaska';
update public.reviews_v2 set airline = 'british-airways'    where airline = 'british';
update public.reviews_v2 set airline = 'turkish-airlines'   where airline = 'turkish';
update public.reviews_v2 set airline = 'jetstar-japan'      where airline = 'jetstar';

-- 'asiana'（アシアナ航空）は SSOT に無い＝年収データも会社ページも無い。
-- 勝手に korean-air に寄せると事実と違う行になるので、ここでは触らない。
-- 対応は2択。オーナーが決めてから、どちらかを実施する：
--   (a) SSOT に asiana を追加し、年収データと会社ページ（JA/EN）を作る
--   (b) 一覧に無い会社として扱う（集計から外す）
-- 今どうなっているかだけ確認する：
select count(*) as asiana残 from public.reviews_v2 where airline = 'asiana';

commit;

-- ── 3. 検算：旧コードが1件も残っていないこと ──────────────────
-- 期待：0 行。
select airline, count(*) as 残件数
  from public.reviews_v2
 where airline in ('spring','qatar','singapore','cathay','alaska','british','turkish','jetstar')
 group by 1 order by 2 desc;

-- ── 4. 全コードの棚卸し（目視）────────────────────────────────
-- ここに出た値が airlines/<値>.html と1対1で対応していれば健全。
-- 'other'（自由入力）と 'asiana'（上記 (a)/(b) 未決）以外は SSOT の110社に収まるはず。
select airline, count(*) as 件数
  from public.reviews_v2
 group by 1 order by 2 desc, 1;
