-- ════════════════════════════════════════════════════════════════
-- 【2／3】戻す — まとめて成功か、まとめて何もしないか
--
--     db/repair-orphan-unlock-1.sql     確認（先にこちらを流す）
--     db/repair-orphan-unlock-2.sql  ← いまここ
--     db/repair-orphan-unlock-3.sql     検算
--
-- ★1／3 が **4行** だったときだけ流す。
--   実際に直る人数が4人と違ったら、この do ブロックは
--   **1文字も書き換えずにエラーで全部巻き戻る**（安全装置）。
--   人数が変わっていた＝前提が変わったということなので、そこで止めて確認する。
--
-- ★pay_reports も pay_reports_pending も1行も消さない。
-- ★auth.users には触れない（アカウントは消さない）。
--
-- 実行: Supabase → SQL Editor に全部貼って RUN
-- 何度流しても同じ結果になる（2回目は「0行のはずが」で止まる＝正常）。
-- ════════════════════════════════════════════════════════════════
do $$
declare
  -- ★1／3 で出た行数。2026-08-27 の本番の実測値が 4。
  --   ここと実際の数が違えば下で raise exception して全部巻き戻る。
  v_expect int := 4;
  v_n      int;
begin
  if v_expect < 0 then
    raise exception '1／3 で出た行数を v_expect に書いてから流すこと。まだ既定値のまま';
  end if;

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
  -- submit_pay_report が書いた列を、投稿前の既定値へ戻す
  -- （db/cleanup-test-payslip-row.sql の②とまったく同じ10列・同じ理由）
  update public.profiles p set
    last_pay_report_at = null,
    pay_report_count   = 0,
    pay_streak_months  = 0,
    last_pay_period_ym = null,
    pay_reports_day    = null,   -- 1日あたりの投稿数カウンタ
    pay_reports_today  = 0,
    -- ★解放を取り上げる。access_until を書くのは submit_pay_report だけ
    access_until       = null,
    -- ★ここがいちばん効く。給料日は「初回の提出日」からしか入らない列なので、
    --   残すと**消えたレポートから学習した給料日**で毎月のリマインドが飛び続ける。
    pay_day_of_month   = null,
    -- バッジは contributor が付いただけ（verified 以上は検証でしか付かない）
    badge       = 'none',
    badge_state = 'none'
  where p.id not in (select uid from owner_of)
    and (   p.pay_report_count   > 0
         or p.access_until       is not null
         or p.last_pay_report_at is not null
         or p.pay_day_of_month   is not null
         or p.last_pay_period_ym is not null
         or p.pay_streak_months  > 0 );

  get diagnostics v_n = row_count;
  if v_n <> v_expect then
    raise exception 'profiles が % 行のはずが % 行だった。何もせずに戻した', v_expect, v_n;
  end if;

  raise notice '% 人を投稿前へ戻した（解放・給料日・バッジを落とした）', v_n;
end $$;

/* 「Success. No rows returned」＋ Notices に「4 人を投稿前へ戻した」と出れば成功。
   エラーで止まったときは1文字も書き換わっていない。 */
