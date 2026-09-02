-- ════════════════════════════════════════════════════════════════
-- 【2／3】入れ直す — まとめて成功か、まとめて何もしないか
--
--     db/repair-union-gross-1.sql     確認（先にこちらを流す）
--     db/repair-union-gross-2.sql  ← いまここ
--     db/repair-union-gross-3.sql     検算
--
-- ★1／3 が **1行** だったときだけ流す。
--   実際に直る行数が違ったら、この do ブロックは
--   **1文字も書き換えずにエラーで全部巻き戻る**（安全装置）。
--   数が変わっていた＝前提が変わったということなので、そこで止めて確認する。
--
-- ★金額を書き写さない。直した pv_annual_total() を**呼んで**入れ直す。
--   ここに数字を写すと、関数を直したのに写し間違えた数字が入る、という
--   いちばん見つけにくい壊れ方をする。
-- ★換算は行に保存されている fx_to_usd / fx_to_jpy を使う（＝投稿時のレート）。
--   今日のレートで引き直さない。過去の集計が流すたびに動いて再現しなくなる。
--   式は db/vocab.generated.sql の「取りこぼしの復旧」と同じ形にそろえてある。
-- ★本人が書いた金額の列（gross_monthly / union_pay / base_pay / …）は触らない。
--   行の追加も削除もしない。
--
-- 実行: Supabase → SQL Editor に全部貼って RUN
-- 2回目を流すと「1行のはずが 0行」で止まる（＝もう直っている。正常）。
-- ════════════════════════════════════════════════════════════════
do $$
declare
  -- ★1／3 で出た行数。2026-09-02 の本番の実測値が 1。
  --   ここと実際の数が違えば下で raise exception して全部巻き戻る。
  v_expect int := 1;

  -- ★税率（%）。ここだけは関数から出せないので手で置く。
  --   いま入っている値は、**間違った年収**から画面の estTaxPct() が自動で入れたもの
  --   （本人が上書きした形跡は無く、その年収で回すと保存値とぴったり一致した）。
  --   正しい年収でその同じ表を回すと 28.6%。net_annual_jpy はこの率から出す。
  --   ⚠️ 貼る直前に estTaxPct を手元で回して確かめること（居住国の表が動いていれば変わる）。
  --   ⚠️ null にすると税率に触らず、いまの率のまま net_annual_jpy だけ引き直す。
  --   ⚠️ **1行のときしか成り立たない置き方**。率は居住国と年収で1行ごとに違う。
  --      1／3 が2行以上出たら、ここは null にして税率には触らないこと。
  v_tax_pct numeric := 28.6;

  v_n int;
begin
  -- ── 関所：関数を先に貼ったか ──────────────────────────────
  -- 古い20引数版のままここを流すと、pv_annual_total が今と同じ値を返す
  -- ＝0行になって「1行のはずが 0行」で止まる。原因が分かる形で先に落とす。
  if (select count(*) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'pv_annual_total'
         and p.pronargs = 21) <> 1 then
    raise exception 'pv_annual_total が21引数版になっていない。先に db/pay-reports.sql を貼ること';
  end if;
  if to_regprocedure('public.pv_union_outside_gross(jsonb)') is null then
    raise exception 'pv_union_outside_gross が無い。先に db/pay-reports.sql を貼ること';
  end if;
  if to_regprocedure('public.pv_block_hour_usd(numeric,numeric,numeric,numeric,boolean)') is null then
    raise exception 'pv_block_hour_usd が無い。先に db/pay-reports.sql を貼り直すこと';
  end if;

  with nu as (
    -- 引数の並びは db/pay-reports.sql の submit_pay_report と1つも違わない。
    -- 並べ違えると別の年収が黙って入るので、あちらを直したらここも直す。
    select r.id,
           public.pv_annual_total(
             r.gross_monthly, r.base_pay, r.hourly_rate, r.guaranteed_hours,
             r.block_hours, r.per_diem, r.housing_type, r.housing_amount,
             r.transport, r.command_pay, r.other_allowance,
             r.bonus_annual, r.profit_share_annual,
             r.bonus_month, r.guarantee_pay, r.instructor_pay, r.examiner_pay,
             r.union_pay, r.management_pay, r.nonline_pay,
             public.pv_union_outside_gross(r.pay_items)) as ann
      from public.pay_reports r
     where public.pv_union_outside_gross(r.pay_items)
  ),
  upd as (
    update public.pay_reports r set
      annual_total_orig  = nu.ann,
      annual_total_usd   = case when r.fx_to_usd is not null
                                then round(nu.ann * r.fx_to_usd, 2) end,
      annual_total_jpy   = case when r.fx_to_jpy is not null
                                then round(nu.ann * r.fx_to_jpy, 2) end,
      -- 時間あたりUSD。★分子は年収ではなく「飛んだことへの対価」で、組合が
      -- 総支給の外で払った分を抜く（2026-09-02 オーナー判断）。式は写さず
      -- pv_block_hour_usd を呼ぶ＝保存（submit_pay_report）と1文字も違わない。
      usd_per_block_hour = public.pv_block_hour_usd(
                             nu.ann, r.fx_to_usd, r.block_hours,
                             r.union_pay, public.pv_union_outside_gross(r.pay_items)),
      tax_rate_pct       = coalesce(v_tax_pct, r.tax_rate_pct),
      net_annual_jpy     = case when r.fx_to_jpy is not null
                                 and coalesce(v_tax_pct, r.tax_rate_pct) is not null
                                then round(round(nu.ann * r.fx_to_jpy, 2)
                                     * (1 - coalesce(v_tax_pct, r.tax_rate_pct) / 100), 2) end
      from nu
     where nu.id = r.id
       and nu.ann is not null
       -- 既に正しい行は触らない（＝何度流しても同じ結果）
       and r.annual_total_orig is distinct from nu.ann
    returning 1)
  select count(*) into v_n from upd;

  if v_n <> v_expect then
    raise exception '年収を入れ直すのは % 行のはずが % 行だった。何もせずに戻した', v_expect, v_n;
  end if;

  raise notice '% 行の年収を入れ直した（組合が総支給の外で払っていた分を足した）', v_n;
end $$;

/* 「Success. No rows returned」＋ Notices に「1 行の年収を入れ直した」と出れば成功。
   エラーで止まったときは1文字も書き換わっていない。
   ⚠️ このあと 3／3 を流して、年収が関数の答えと一致していることを確かめる。 */
