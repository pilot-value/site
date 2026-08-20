-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/run-06-review-input-currency.sql
-- db/schema-additions.sql の「6) 口コミの給与を入力したときの通貨」だけを
-- 貼りやすく切り出したもの。内容は同じ。直したときは両方を揃えること。
-- Supabase → SQL Editor に貼り付けて実行。冪等（何度流しても安全）。
--
-- submit-review.html / en/submit-review.html の給与入力欄が、ヘッダーの通貨切替に
-- 追随するようになった（salary-input-currency.js）。海外のパイロットは $ のまま
-- 打てるが、保存先の base_annual / flight_allowance_annual / monthly_salary /
-- bonus / annual_salary は今までどおり**万円の整数**で、外貨で入れられた分は
-- currency.js の概算・固定レートを1回通っている。
--
-- そのため「換算後の円」だけを残すと、後から検算できず、概算値が実額の顔をする。
-- 本人が実際に打った通貨と、通したレートを併記して追えるようにする。
--   input_currency … 入力時の表示通貨（'JPY' なら換算していない＝素の入力）
--   input_rate     … その通貨1単位あたりの円。JPY のときは null
--                    （元の金額に戻すには  万円 × 10000 ÷ input_rate）
--
-- **適用しなくてもフロントは壊れない**：列不在エラーを検知して該当キーを落とし
-- 再 insert する（submit-review.html の OPTIONAL_COLS リトライ）。
-- 流すと初めて実際に保存されるようになる。
-- ════════════════════════════════════════════════════════════════
alter table public.reviews_v2
  add column if not exists input_currency text,
  add column if not exists input_rate     numeric;

comment on column public.reviews_v2.input_currency is '給与入力時の表示通貨（JPY なら換算なし）';
comment on column public.reviews_v2.input_rate     is '入力通貨1単位あたりの円。JPY は null。元の金額 = 万円×10000÷input_rate';

-- 既存行は全て日本語フォームの万円入力（通貨切替が無かった頃）
update public.reviews_v2 set input_currency = 'JPY' where input_currency is null;

-- 確認用:
-- select airline, position, input_currency, input_rate, annual_salary
--   from public.reviews_v2 order by created_at desc limit 10;
