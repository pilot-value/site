-- ════════════════════════════════════════════════════════════════
-- db/remove-review-1.sql — 指摘を受けて口コミを1件削除する（2026-09-10）
--
-- 手順書 workflows/handle-disclosure-request.md の A-3「2. 消す」にあたる
-- 運営判断。**社名・投稿者・指摘してきた相手のことはここに書かない**
-- （このリポジトリは PUBLIC で、db/ は配信されないが履歴には残る）。
--
-- ★消す前に必ず控えを取る。控えは RLS を掛けて権限を全部落とすので、
--   サイトからは誰にも読めない（運営のキーからしか読めない）。
--
-- ⚠️ 行を消すと、その人の**口コミの鍵が外れる**。
--    pv_has_review_key（db/reviews-gate.sql）は「reviews_v2 に自分の
--    proof_hash の行があるか」だけを見ているため。給与の90日は別なので残る。
--
-- 何度流しても同じ結果になる（控えは重複を入れない・削除は0行になるだけ）。
-- 貼る場所: Supabase ダッシュボード → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ── 1) 退避 ──────────────────────────────────────────────────
create table if not exists public.reviews_removed
  (like public.reviews_v2 including all);

alter table public.reviews_removed enable row level security;
revoke all on public.reviews_removed from anon, authenticated;

comment on table public.reviews_removed is
  '削除した口コミの控え。サイトからは読めない（RLS ＋ 権限なし）。運営のキーでのみ読む。';

insert into public.reviews_removed
select r.*
  from public.reviews_v2 r
 where r.id = '8f2cad71-d0c1-425b-b34d-125589f61582'
   and not exists (select 1 from public.reviews_removed x where x.id = r.id);

-- ── 2) 消す ──────────────────────────────────────────────────
delete from public.reviews_v2
 where id = '8f2cad71-d0c1-425b-b34d-125589f61582';

-- ── 3) 確認（3行とも出ること）────────────────────────────────
select '消えた（0 なら成功）'     as chk, count(*) as n
  from public.reviews_v2  where id = '8f2cad71-d0c1-425b-b34d-125589f61582'
union all
select '控えがある（1 なら成功）', count(*)
  from public.reviews_removed where id = '8f2cad71-d0c1-425b-b34d-125589f61582'
union all
select '残りの口コミ件数',         count(*) from public.reviews_v2;
