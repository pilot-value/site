-- ════════════════════════════════════════════════════════════════
-- db/label-hints.verify.sql — ラベル辞書がどこまで育ったかを見る
--
-- 公開ビュー public.pv_label_hints は「どう分類するか」しか返さない
-- （人数を列に出さない設計）。人数はここで見る。オーナー用。
--
-- ★別ファイルにしてある。pay-reports.verify.sql に足すと、Supabase の
--   SQL Editor が最後の1文しか表示しない都合で、あちらの10行の判定表が
--   隠れてしまう（あのファイルはそれを避けるために作った）。
--
-- 使い方：Supabase → SQL Editor に貼って Run。
-- ════════════════════════════════════════════════════════════════

-- 会社ごとの答え。n = 実人数（同じ人が12か月ぶん出しても1人）。
-- 採用 = ✅ の行だけが pv_label_hints に出て、次の人には聞かなくなる。
with raw as (
  select r.airline,
         r.airline_other is null    as listed,
         lower(btrim(coalesce(u->>'label', ''), E' \t\r\n\u00A0\u3000')) as label,
         u->>'asked'                as asked,
         r.proof_hash
    from public.pay_reports r
    cross join lateral jsonb_array_elements(
           case when jsonb_typeof(r.payslip_detail->'unmapped') = 'array'
                then r.payslip_detail->'unmapped'
                else '[]'::jsonb end) u
   where jsonb_typeof(u) = 'object'
),
votes as (
  select * from raw
   where asked in ('flight_variable','night_ot','command','bonus','per_diem','other')
     and length(label) between 1 and 60
),
per_airline as (
  select airline, label, asked, count(distinct proof_hash) as n
    from votes where listed group by 1, 2, 3
),
tot as (
  select airline, label, sum(n) as total from per_airline group by 1, 2
)
select p.airline                                as 会社,
       p.label                                  as 明細のラベル,
       p.asked                                  as 人が答えた分類,
       p.n                                      as 確認した人数,
       t.total                                  as そのラベルに答えた総数,
       case when p.n >= 3 and p.n * 2 > t.total then '✅ 採用'
            when p.n * 2 <= t.total             then '答えが割れている'
            else 'あと ' || (3 - p.n) || '人'
       end                                      as 状態
  from per_airline p
  join tot t using (airline, label)
 order by p.n desc, t.total desc, p.airline, p.label;
