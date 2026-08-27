-- ════════════════════════════════════════════════════════════════
-- 【3／3】検算 — 両方向のズレを数える（読むだけ）
--
--     db/repair-orphan-unlock-1.sql     確認
--     db/repair-orphan-unlock-2.sql     戻す
--     db/repair-orphan-unlock-3.sql  ← いまここ
--
-- 実行: Supabase → SQL Editor に全部貼って RUN
-- ════════════════════════════════════════════════════════════════
with cand as (
  select u.id as uid,
         encode(extensions.digest(u.id::text || '::pv_pay::' || a.code, 'sha256'), 'hex') as h
    from auth.users u
   cross join public.pv_airlines a
  union all
  select u.id,
         encode(extensions.digest(u.id::text || '::pv_pay::other::' || o.nm, 'sha256'), 'hex')
    from auth.users u
   cross join (select distinct lower(airline_other) as nm
                 from public.pay_reports
                where airline = 'other' and airline_other is not null) o
),
owner_of as (
  select distinct c.uid
    from public.pay_reports r
    join cand c on c.h = r.proof_hash
)
select '① 行が無いのに痕跡が残っている人' as 項目,
       count(*)::text                     as 値
  from public.profiles p
 where p.id not in (select uid from owner_of)
   and (   p.pay_report_count   > 0
        or p.access_until       is not null
        or p.last_pay_report_at is not null
        or p.pay_day_of_month   is not null
        or p.last_pay_period_ym is not null
        or p.pay_streak_months  > 0 )
union all
select '② 行があるのに解放が無い人',
       count(*)::text
  from public.profiles p
 where p.id in (select uid from owner_of)
   and p.access_until is null
--  ★「期限が過ぎている」はここに数えない。解放は90日で普通に切れるので、
--    入れると時間がたつだけで②が0でなくなり、本物のズレが埋もれる。
--    （db/usage.mjs の「■ 整合」も同じ数え方にしてある）
union all
select '③ pay_reports の総数（変わっていないこと）',
       (select count(*)::text from public.pay_reports);

/* ①が0でなければ 2／3 を流していないか、v_expect が合っていない。
   ②が0でなければ「出したのに開いていない」人が居る＝別の問題なので
   その人の access_until を submit_pay_report 経由で立て直す（手で書かない）。
   ③は流す前と同じ数であること（この3枚は insert も delete も1つも持たない）。
   ⚠️ 具体的な件数をここに書かない。給与レポートは日々増えるので、
      書いた瞬間に腐って「合っていないのでは」と読ませることになる
      （2026-08-27、実際に「16」と伝えて17になっていた）。 */
