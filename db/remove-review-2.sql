-- ════════════════════════════════════════════════════════════════
-- db/remove-review-2.sql — 待遇の情報になっていない口コミを1件消す（2026-11-14）
--
-- オーナー指示「トップに、ゲームや下品な内容を含む、待遇情報として不適切な口コミが
-- 表示されている。表示しなくしよう」。運営判断で消す（手本は db/remove-review-1.sql）。
-- **投稿者のことはここに書かない**（このリポジトリは PUBLIC）。本文も写さない。
--
-- 番号（id）は公開の口からは取れない（鍵の無い人には返さない）ので、
-- 「会社・投稿の時刻（マイクロ秒まで）・本文の語」の3つで1件に絞る。
-- ★ちょうど1件に当たらなければ、何も変えずにエラーで止まる。
-- ★控えが取れなければ消さない（1つの do の中＝どこで落ちても全部巻き戻る）。
--   控えの表は 2026-09-10 に作ったもの。そのあと口コミに足した列は、先に控えの側へ足してから写す。
--
-- 消すと一緒に動くもの（どれも DELETE で動く引き金。ほかに貼るものは無い）:
--   口コミ一覧の置き場 pv_review_card（Vote・会社ページ）／トップ（pv_review_voices は表を直に読む）／
--   会員の中央値（trg_pv_member_median）／人数（trg_pv_stats）／AI 要約（summarize_reviews_reviews_v2）／
--   本人の対応表 pv_review_person（on delete cascade）
-- ⚠️ 投稿した人の口コミの鍵は外れる（remove-review-1.sql と同じ）。
--
-- 何度流しても同じ結果になる（2回目からは「もう消えている」と出て何もしない）。
-- 貼る場所: Supabase ダッシュボード → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ── 1) 控えの表（無ければ作る）────────────────────────────────
create table if not exists public.reviews_removed
  (like public.reviews_v2 including all);

alter table public.reviews_removed enable row level security;
revoke all on public.reviews_removed from anon, authenticated;

-- ── 2) 1件に絞る → 控え → 消す ────────────────────────────────
do $$
declare
  v_at   constant timestamptz := timestamptz '2026-10-10 08:01:03.182471+00';
  v_ids  uuid[];
  v_id   uuid;
  v_cols text;
  v_n    int;
  c      record;
begin
  select array_agg(r.id) into v_ids
    from public.reviews_v2 r
   where r.airline = 'riyadh-air'
     and r.created_at = v_at
     and r.benefits_comment ilike '%roblox%';

  if v_ids is null then
    if exists (select 1 from public.reviews_removed x
                where x.airline = 'riyadh-air' and x.created_at = v_at) then
      raise notice 'もう消えています（控えはあります）。何もしません。';
      return;
    end if;
    raise exception '当てはまる口コミが見つかりません。何も変えていません。';
  end if;
  if cardinality(v_ids) <> 1 then
    raise exception '当てはまる口コミが % 件あります（1件のはず）。何も変えていません。', cardinality(v_ids);
  end if;
  v_id := v_ids[1];

  -- 口コミの表にあって控えの表に無い列を足す（2026-09-10 のあとに足した列）
  for c in
    select a.attname, format_type(a.atttypid, a.atttypmod) as typ
      from pg_attribute a
     where a.attrelid = 'public.reviews_v2'::regclass and a.attnum > 0 and not a.attisdropped
       and not exists (select 1 from pg_attribute b
                        where b.attrelid = 'public.reviews_removed'::regclass
                          and b.attname = a.attname and b.attnum > 0 and not b.attisdropped)
     order by a.attnum
  loop
    execute format('alter table public.reviews_removed add column %I %s', c.attname, c.typ);
  end loop;

  -- 列の名前で写す（並び順が違っても・自動で埋まる列があっても写せる）
  select string_agg(quote_ident(b.attname), ', ' order by b.attnum) into v_cols
    from pg_attribute b
   where b.attrelid = 'public.reviews_removed'::regclass and b.attnum > 0
     and not b.attisdropped and b.attgenerated = ''
     and exists (select 1 from pg_attribute a
                  where a.attrelid = 'public.reviews_v2'::regclass
                    and a.attname = b.attname and a.attnum > 0 and not a.attisdropped);

  execute format(
    'insert into public.reviews_removed (%1$s) select %1$s from public.reviews_v2 r
      where r.id = $1 and not exists (select 1 from public.reviews_removed x where x.id = $1)',
    v_cols) using v_id;

  if not exists (select 1 from public.reviews_removed x where x.id = v_id) then
    raise exception '控えが取れませんでした。何も消していません。';
  end if;

  delete from public.reviews_v2 where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception '消えた件数が % 件（1件のはず）。全部巻き戻します。', v_n;
  end if;

  raise notice '1件消しました（控えあり）。';
end
$$;

-- ── 3) 確認（4行とも出ること）────────────────────────────────
select 'トップの抜粋に出ていない（0 なら成功）' as chk, count(*) as n
  from jsonb_array_elements(public.pv_review_voices()) e
 where e->>'airline' = 'riyadh-air'
   and (e->>'created_at')::timestamptz = timestamptz '2026-10-10 08:01:03.182471+00'
union all
select '口コミ一覧の置き場にも無い（0 なら成功）', count(*)
  from public.pv_review_card
 where air = 'riyadh-air' and at = timestamptz '2026-10-10 08:01:03.182471+00'
union all
select '控えがある（1 なら成功）', count(*)
  from public.reviews_removed
 where airline = 'riyadh-air' and created_at = timestamptz '2026-10-10 08:01:03.182471+00'
union all
select '残りの口コミ件数', count(*) from public.reviews_v2;
