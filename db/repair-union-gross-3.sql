-- ════════════════════════════════════════════════════════════════
-- 【3／3】検算 — 入れ直した年収が関数の答えと一致しているか（読むだけ）
--
--     db/repair-union-gross-1.sql     確認
--     db/repair-union-gross-2.sql     入れ直す
--     db/repair-union-gross-3.sql  ← いまここ
--
-- 実行: Supabase → SQL Editor に全部貼って RUN
-- ════════════════════════════════════════════════════════════════
with calc as (
  -- 全行について「いまの保存値」と「関数の答え」を並べる。
  -- 組合の行だけでなく全行を見る＝この修復が**他の行を巻き込んでいない**ことも同時に確かめる。
  select r.id,
         public.pv_union_outside_gross(r.pay_items) as outside,
         r.annual_total_orig                        as saved,
         public.pv_annual_total(
           r.gross_monthly, r.base_pay, r.hourly_rate, r.guaranteed_hours,
           r.block_hours, r.per_diem, r.housing_type, r.housing_amount,
           r.transport, r.command_pay, r.other_allowance,
           r.bonus_annual, r.profit_share_annual,
           r.bonus_month, r.guarantee_pay, r.instructor_pay, r.examiner_pay,
           r.union_pay, r.management_pay, r.nonline_pay,
           public.pv_union_outside_gross(r.pay_items)) as want,
         r.annual_total_usd, r.annual_total_jpy, r.fx_to_usd, r.fx_to_jpy
    from public.pay_reports r
)
select '① 組合が総支給の外の行' as 項目,
       count(*)::text           as 値
  from calc where outside
union all
select '② そのうち年収が関数の答えと食い違う行（0であること）',
       count(*)::text
  from calc where outside and saved is distinct from want
union all
-- ★ここが0でなければ、組合の行以外を巻き込んで壊している。
--   2／3 は組合の行しか触らないので、本来ずっと0のまま。
select '③ 組合の行以外で年収が関数の答えと食い違う行（0であること）',
       count(*)::text
  from calc where not outside and saved is distinct from want
union all
select '④ 円換算が年収と合っていない行（0であること）',
       count(*)::text
  from calc
 where fx_to_jpy is not null
   and annual_total_jpy is distinct from round(saved * fx_to_jpy, 2)
union all
select '⑤ ドル換算が年収と合っていない行（0であること）',
       count(*)::text
  from calc
 where fx_to_usd is not null
   and annual_total_usd is distinct from round(saved * fx_to_usd, 2)
union all
select '⑥ pay_reports の総数（流す前と同じであること）',
       (select count(*)::text from public.pay_reports);

/* 読み方：
     ・②③④⑤が全部 0 なら成功。
     ・②が0でなければ 2／3 を流していないか、途中で止まっている。
     ・③が0でなければ**この修復と無関係の行**がもともと関数の答えと食い違っている。
       2／3 は組合の行しか触らないので、修復のせいではない（別途しらべる）。
     ・④⑤は「昔レートが無くて後から埋めた行」でも起きうる。0でなければ
       db/vocab.generated.sql の取りこぼし復旧が走ったあとかを先に見る。
     ・⑥は流す前と同じ数であること（この3枚は insert も delete も1つも持たない）。
   ⚠️ 具体的な件数をここに書かない。給与レポートは日々増えるので、
      書いた瞬間に腐って「合っていないのでは」と読ませることになる。

   このあとの見どころ（オーナー）：
     ・node db/usage.mjs --all の 3-c「REAL PAY の画面に出る数」で、
       その会社・その職位の中央値がまわりの行と並ぶこと。
     ・⚠️「時間あたりUSD」が跳ねる行がある（組合活動でその月ほとんど飛んでいないため）。
       事実なので隠さないが、マイページと pay-tracker の中央値に効く。 */
