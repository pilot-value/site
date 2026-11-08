-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/company-rates.sql（2026-11-08）
--
-- 会員の年報（my-year.js の「1年」）が本人の行だけで出している2つの数を、**会社 × 職位の会員みんな**から出す。
--   ① 単価（額 ÷ 数量）      … 乗務1時間あたり・種類ごとの変動給の単価・パーディアムの1泊あたり
--   ② 単価が変わる点（折れ目）… 乗務時間に対する乗務時間の変動給の折れ線（y = a + b1·x + b2·max(0, x − t)）
-- 「明細が1枚入るたびに、その会社のことが少し詳しくなる」（オーナー承認）。
--
-- 形は db/member-median.sql と同じ（小さな表・書き込みの引き金で丸ごと作り直す・読む口は引くだけ）。
--   ⚠️ 2026-10-31 に本番（Nano）が30分止まった ── 原因は「呼ばれるたびに全員分を数え直す重い処理」。
--   ＝ **画面を開くたびに数える形にしない。** 数えるのは書き込みの引き金（for each statement）だけ。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: db/pay-reports.sql → db/pay-rows.sql → db/work-months.sql → db/member-median.sql → このファイル
--    （pv_variable_by_basis は 2026-11-08 の db/pay-reports.sql で入った。まだ貼っていなければ先にそれを貼る。
--     読む口の門 pv_work_level は db/work-months.sql に在る）
--    前のどれかが抜けていたら、下の「0. 前提」が日本語で止める。
-- ★ 冪等（何度流しても同じ結果）。表を作るのは初回だけ・関数と引き金は作り直す・最後に1回数え直す。
--
-- ── 数える行（db/member-median.sql の給与の行と同じ条件）───────────────────
--   annual_total_usd が年 $10,000〜$700,000 の中・created_at が直近24か月・本人が下ろした人（pay_hidden）でない・
--   テスト用アカウント（pv_test_users）でない。airline = 'other' の行は pv_airline_resolve(airline_other) で会社コードに直し、
--   どこにも当たらない（'other'）なら捨てる。人の鍵は 'r:'||proof_hash。
--   職位 … captain・cap・tri_tre → cap ／ fo・sfo → fo。ほかは捨てる。
--   ⚠️ 口コミ（reviews_v2）は使わない ── 単価に要る「数量」（乗務時間・泊数・セクター）を持たないため。
--
-- ── ① 単価（pv_company_rate）─────────────────────────────────
--   k        額（円 ＝ その月の原本通貨の額 × その月の fx_to_jpy）            数量
--   block    変動給の種類「乗務時間」（pv_variable_by_basis の block）          block_hours
--   duty     変動給の種類「勤務時間」（duty）                                   duty_hours
--   night    変動給の種類「夜間」（night）                                      night_hours
--   sector   変動給の種類「セクター」（sector）                                 sectors
--   perdiem  パーディアム（per_diem）                                           stay_nights
--   perBlock 乗務1時間あたり ＝ その月の支給 − パーディアム（下の numer）       block_hours
--   1人の単価 ＝ 額と数量が**同じ月に両方ある（どちらも 0 より大きい）月だけ**の Σ額 ÷ Σ数量。
--   会社の値 ＝ 1人の単価の中央値（偶数なら真ん中2人の平均 ＝ percentile_cont(0.5) と同じ答え・numeric のまま）を小数2桁に丸める。
--   ★ 1人1票 ── 10か月出した人も1人。月の数で重みを付けない（先に1人の単価を作ってから中央値）。
--   n ＝ その単価を持つ人数。表には1人の区分も置く（読む口が2人以上だけを返す）。
--
-- ── ② 単価が変わる点（pv_company_kink）────────────────────────────
--   会社 × 職位の、数える行の月を全部集めた点（x ＝ block_hours・y ＝ 乗務時間の変動給の円）。
--   その点が6つに届かなければ、変動給の合計（flight_variable_pay の円）の点に替える（my-year.js の calc と同じ）。
--   当てはめは pv_company_kink_fit（my-year.js の findKink の写し）。出せたときだけ、
--   **点が2人以上から来ている区分だけ**を置く（n ＝ 点を出した人数）。
--
-- ── 守っている約束 ────────────────────────────────────────
--  1. 数えるのは書き込みのときだけ。読む口（pv_company_rates・pv_company_kink）は表を引くだけで、何も数えない。
--  2. 人数を外へ出さない。表には n を持つが、表は誰にも読ませない（RLS 有効・ポリシー無し・grant 無し）。
--     読む口は n ≥ 2 の区分だけを返し、n の列は返さない。
--  3. ほかの会員の月の点（1か月ぶんの額や時間）を1つも返さない。返すのは中央値と折れ線の3つの数だけ。
--  4. 読めるのは給与の鍵が生きている会員と運営だけ（Give & Get・2026-11-08 決定）。
--     門は会社ページの給与の図（db/company-pay.sql の pv_company_pay・db/deep-pay.sql の pv_company_comp）と同じ
--     pv_work_level() = 'pay' の1行（db/work-months.sql の1か所が決める ── 鍵が生きている会員と運営は 'pay'・
--     止めた会員は 'member'）。ここに条件を書き写さない。鍵の無い会員には何も返さない（区分が無い会社と同じ答え）。
--     未ログインはそもそも実行権が無い。
--     ★ CLAUDE.md「会員だけが見られるものを返す関数を新しく作ったら pv_proof_blocked の1行を足す」── 2つとも足してある
--       （pv_work_level も止めた会員を 'member' にするので二重の守り）。
--  5. 数え直しが失敗しても、給与の書き込みは止めない（引き金が例外を握って warning にする。表は前の中身のまま）。
--  6. 数え直しは1本ずつ（2つの表を exclusive で握る）。読む側は止まらない（exclusive は select を止めない）。
--  7. 給与の検証の印など、数に関係しない列の update では数え直さない（引き金は列を名指しする）。
--  8. 会員を名指しで書かない（uid・氏名・メールをこのファイルに書かない）。
--
-- ⚠️ 直近24か月の窓は「数え直したとき」に動く（db/member-median.sql と同じ。気になれば
--    select public.pv_company_rate_refresh(); を SQL Editor で1回流す）。
-- ⚠️ 同じ線の写し（直すときは一緒に）
--     数える給与の行の条件（幅・24か月・下ろした人・テスト用アカウント・社名の寄せ・職位）
--                                        … db/member-median.sql の pv_member_median_refresh と同じ
--     乗務1時間あたりの分子（numer）     … pay-viz.js の calc()（monthlyOrig を含む）の写し
--     単価の数え方（両方そろった月だけ） … my-year.js の calc の rateRow の写し
--     折れ目の当てはめと出す条件         … my-year.js の findKink（fitLine・fitHinge）の写し
--     db/test-company-rates.mjs が my-year.js をそのまま読んで、同じ答えになることを突き合わせている。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.pay_reports') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports の表が無い）';
  end if;
  if to_regprocedure('public.pv_variable_by_basis(jsonb)') is null
     or to_regprocedure('public.pv_union_outside_gross(jsonb)') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pv_variable_by_basis / pv_union_outside_gross が無い）';
  end if;
  if to_regclass('public.pay_hidden') is null
     or to_regprocedure('public.pv_airline_resolve(text)') is null
     or to_regprocedure('public.pv_proof_blocked()') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pay_hidden / pv_airline_resolve / pv_proof_blocked が無い）';
  end if;
  if to_regprocedure('public.pv_work_level()') is null then
    raise exception '先に db/work-months.sql を実行してください（pv_work_level が無い）';
  end if;
  if to_regclass('public.pv_test_users') is null then
    raise exception '先に db/member-median.sql を実行してください（テスト用アカウントの名簿 pv_test_users が無い）';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. 2つの表 — 作るのは pv_company_rate_refresh() だけ。読むのは2つの読む口だけ。
--    RLS 有効・ポリシー無し・grant 無し ＝ security definer の中からしか読めない（人数を外へ出さない）。
-- ════════════════════════════════════════════════════════════════
create table if not exists public.pv_company_rate (
  airline    text        not null,
  rank       text        not null check (rank in ('cap', 'fo')),
  k          text        not null check (k in ('block', 'duty', 'night', 'sector', 'perdiem', 'perBlock')),
  rate_jpy   numeric     not null,
  n          integer     not null,
  updated_at timestamptz not null default now(),
  primary key (airline, rank, k)
);
alter table public.pv_company_rate enable row level security;
revoke all on table public.pv_company_rate from public, anon, authenticated;
comment on table public.pv_company_rate is
  '会社 × 職位の単価（1人の Σ額 ÷ Σ数量 の中央値・円）と人数。給与の書き込みの引き金が丸ごと作り直す。'
  '誰にも読ませない（人数を外へ出さない）。外へ出すのは pv_company_rates() の n ≥ 2 の区分の単価だけ。';

create table if not exists public.pv_company_kink (
  airline    text        not null,
  rank       text        not null check (rank in ('cap', 'fo')),
  t          numeric     not null,
  below      numeric     not null,
  above      numeric     not null,
  n          integer     not null,
  updated_at timestamptz not null default now(),
  primary key (airline, rank)
);
alter table public.pv_company_kink enable row level security;
revoke all on table public.pv_company_kink from public, anon, authenticated;
comment on table public.pv_company_kink is
  '会社 × 職位の「単価が変わる点」（折れ目の乗務時間 t・その手前と超えた分の1時間あたりの円）と、点を出した人数。'
  '給与の書き込みの引き金が丸ごと作り直す。2人以上から来た点で折れ目が出た区分だけを置く。誰にも読ませない。';


-- ════════════════════════════════════════════════════════════════
-- 2. pv_company_kink_fit(x[], y[]) — 折れ目の当てはめ（純粋な計算だけ・表を読まない）
--
--    ⚠️⚠️ my-year.js の findKink（と、その中の fitLine・fitHinge）の写し。**片方だけ直さない。**
--       db/test-company-rates.mjs が my-year.js をそのまま読み、同じ点で同じ答えになることを見ている
--       （作り物の点 240組・会社の点の組）。
--    出す条件（findKink と1つも違わない）
--      点が6つ以上・x がばらついている（直線の sxx > 0）
--      候補の t は floor(最小の x) から ceil(最大の x) まで 0.5 刻み・t 以下と t 超えがどちらも3点以上
--      y = a + b1·x + b2·max(0, x − t) を最小二乗（3×3 の正規方程式を掃き出し法で解く・軸を入れ替えない・軸が 1e-9 以下なら捨てる）
--      誤差（SSE）がいちばん小さい t を選ぶ（同じなら先の t）
--      その誤差が直線の誤差の半分以下・超えた側 above ＝ b1 + b2 が 0 より大きく、max(0, b1) の 1.2 倍より大きい
--      返す below は max(0, b1)
--    出せないときは0行。計算は float8（JS の数と同じ倍精度）。
--
--    ★ 計算の段取りだけは findKink と違う（答えは同じ。書き込みのたびに走るので軽くした）。
--      findKink は候補の t ごとに全部の点を2回なめる（和を作る・誤差を数える）。会社の点は人数ぶん多いので、
--      そのままだと 2,400行・100区分で数え直しが約1.1秒かかった（会員の中央値は 0.05秒・どちらも手元の PGlite）。ここでは
--        ① 点を x の小さい順に並べ、後ろからの和（Σx・Σx²・Σy・Σxy）を1回だけ作る
--           → どの t でも「t を超えた点」の和が引くだけで出る（h ＝ x − t の和は Σx − t·k などで組み立てる）
--        ② 誤差はまず式で出す（Σy² − 2β·B ＋ βᵀAβ）── 候補の比べ合いに使う
--        ③ いちばん小さい誤差に近い候補（差が Σy² の 10億分の1 以内）だけ、findKink と同じ形（点を1つずつ）で
--           誤差を数え直して選ぶ（同じなら先の t）。直線と比べる誤差も、この数え直した値
--      和の足す順が違うぶん、below / above は最後の数桁（10兆分の1 ほど）だけ違いうる。保存するときに小数2桁へ丸める。
--      これで同じ 2,400行の数え直しは約0.25秒（残りは明細の内訳 pay_items を読む分と、テスト用アカウントを外す分）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_company_kink_fit(p_x float8[], p_y float8[])
returns table (t float8, below float8, above float8)
language plpgsql
immutable
set search_path = public
as $fn$
declare
  v_n   int := coalesce(array_length(p_x, 1), 0);
  i int; v_k int; v_m int;
  v_mx float8 := 0; v_my float8 := 0; v_sxy float8 := 0; v_sxx float8 := 0;
  v_lb float8; v_la float8; v_le float8 := 0;
  v_hi float8; v_t float8; v_nb int; v_uk int; v_d float8;
  v_xs float8[]; v_ys float8[];                                   -- x の小さい順に並べた点（同じ x は渡された順）
  v_ux float8[]; v_uxx float8[]; v_uy float8[]; v_uxy float8[];   -- 並べた k 番目から後ろの和（n+1 番目は 0）
  v_tx float8; v_txx float8; v_ty float8; v_txy float8; v_tyy float8 := 0;
  v_qh float8; v_qxh float8; v_qhh float8; v_qhy float8;
  v_a12 float8; v_a13 float8; v_a22 float8; v_a23 float8; v_a32 float8; v_a33 float8; v_b1 float8; v_b2 float8; v_b3 float8;
  v_f float8; v_ok boolean; v_cf float8;
  c_t float8[] := '{}'; c_b0 float8[] := '{}'; c_b1 float8[] := '{}'; c_b2 float8[] := '{}'; c_cf float8[] := '{}';
  v_min float8; v_tol float8; v_e float8; v_best_e float8; v_best int;
  v_above float8;
begin
  if v_n < 6 or v_n <> coalesce(array_length(p_y, 1), 0) then return; end if;

  -- 直線（fitLine）── 平均 → 偏差の積和 → 誤差（findKink と同じ形・同じ順）
  for i in 1..v_n loop v_mx := v_mx + p_x[i]; v_my := v_my + p_y[i]; end loop;
  v_mx := v_mx / v_n; v_my := v_my / v_n;
  for i in 1..v_n loop
    v_sxy := v_sxy + (p_x[i] - v_mx) * (p_y[i] - v_my);
    v_sxx := v_sxx + (p_x[i] - v_mx) * (p_x[i] - v_mx);
  end loop;
  if not (v_sxx > 0) then return; end if;
  v_lb := v_sxy / v_sxx;
  v_la := v_my - v_lb * v_mx;
  for i in 1..v_n loop v_d := p_y[i] - v_la - v_lb * p_x[i]; v_le := v_le + v_d * v_d; end loop;

  -- ① 並べて、後ろからの和を作る
  select array_agg(u.x order by u.x, u.i), array_agg(u.y order by u.x, u.i) into v_xs, v_ys
    from unnest(p_x, p_y) with ordinality as u(x, y, i);
  v_ux := array_fill(0::float8, array[v_n + 1]); v_uxx := v_ux; v_uy := v_ux; v_uxy := v_ux;
  for i in reverse v_n..1 loop
    v_ux[i]  := v_ux[i + 1]  + v_xs[i];
    v_uxx[i] := v_uxx[i + 1] + v_xs[i] * v_xs[i];
    v_uy[i]  := v_uy[i + 1]  + v_ys[i];
    v_uxy[i] := v_uxy[i + 1] + v_xs[i] * v_ys[i];
  end loop;
  v_tx := v_ux[1]; v_txx := v_uxx[1]; v_ty := v_uy[1]; v_txy := v_uxy[1];
  for i in 1..v_n loop v_tyy := v_tyy + p_y[i] * p_y[i]; end loop;

  -- 折れ線（fitHinge）を 0.5 刻みの t ごとに（t が増えるにつれ、t 以下になった点を前から順に外していく）
  select floor(min(x)), ceil(max(x)) into v_t, v_hi from unnest(p_x) as x;
  v_k := 1;
  while v_t <= v_hi loop
    while v_k <= v_n and v_xs[v_k] <= v_t loop v_k := v_k + 1; end loop;
    v_nb := v_k - 1; v_uk := v_n - v_nb;                            -- t 以下の点の数・t を超えた点の数
    if v_nb >= 3 and v_uk >= 3 then
      -- t を超えた点だけの h ＝ x − t の和（それ以外の点の h は 0）
      v_qh  := v_ux[v_k] - v_t * v_uk;
      v_qxh := v_uxx[v_k] - v_t * v_ux[v_k];
      v_qhh := v_uxx[v_k] - 2 * v_t * v_ux[v_k] + v_t * v_t * v_uk;
      v_qhy := v_uxy[v_k] - v_t * v_uy[v_k];
      -- 正規方程式 A·β = B
      --   A ＝ | n    Σx    Σh  |   B ＝ | Σy  |
      --        | Σx   Σx²   Σxh |        | Σxy |
      --        | Σh   Σxh   Σh² |        | Σhy |
      -- 掃き出し（軸を入れ替えない・findKink の fitHinge と同じ順の式を、3×3 なので1つずつ書き下した）
      v_a12 := v_tx; v_a13 := v_qh; v_a22 := v_txx; v_a23 := v_qxh; v_a32 := v_qxh; v_a33 := v_qhh;
      v_b1 := v_ty; v_b2 := v_txy; v_b3 := v_qhy;
      v_ok := false;
      -- 1列目（軸 ＝ n。点が6つ以上なので 1e-9 を下回らない）
      v_a12 := v_a12 / v_n; v_a13 := v_a13 / v_n; v_b1 := v_b1 / v_n;
      v_f := v_tx; v_a22 := v_a22 - v_f * v_a12; v_a23 := v_a23 - v_f * v_a13; v_b2 := v_b2 - v_f * v_b1;
      v_f := v_qh; v_a32 := v_a32 - v_f * v_a12; v_a33 := v_a33 - v_f * v_a13; v_b3 := v_b3 - v_f * v_b1;
      -- 2列目
      if abs(v_a22) > 1e-9 and v_a22 <> 'NaN'::float8 then
        v_a23 := v_a23 / v_a22; v_b2 := v_b2 / v_a22;
        v_f := v_a12; v_a13 := v_a13 - v_f * v_a23; v_b1 := v_b1 - v_f * v_b2;
        v_f := v_a32; v_a33 := v_a33 - v_f * v_a23; v_b3 := v_b3 - v_f * v_b2;
        -- 3列目
        if abs(v_a33) > 1e-9 and v_a33 <> 'NaN'::float8 then
          v_b3 := v_b3 / v_a33;
          v_b1 := v_b1 - v_a13 * v_b3;
          v_b2 := v_b2 - v_a23 * v_b3;
          v_ok := true;
        end if;
      end if;
      if v_ok then
        -- ② 誤差を式で（Σy² − 2β·B ＋ βᵀAβ・A は対称）
        v_cf := v_tyy - 2 * (v_b1 * v_ty + v_b2 * v_txy + v_b3 * v_qhy)
                + v_n * v_b1 * v_b1 + v_txx * v_b2 * v_b2 + v_qhh * v_b3 * v_b3
                + 2 * (v_tx * v_b1 * v_b2 + v_qh * v_b1 * v_b3 + v_qxh * v_b2 * v_b3);
        c_t := c_t || v_t; c_b0 := c_b0 || v_b1; c_b1 := c_b1 || v_b2; c_b2 := c_b2 || v_b3; c_cf := c_cf || v_cf;
        if v_min is null or v_cf < v_min then v_min := v_cf; end if;
      end if;
    end if;
    v_t := v_t + 0.5;
  end loop;
  if v_min is null then return; end if;

  -- ③ いちばん小さい誤差に近い候補だけ、findKink と同じ形（点を1つずつ）で数え直して選ぶ（同じなら先の t）
  v_tol := 1e-9 * v_tyy + 1e-9 * abs(v_min);
  for v_m in 1..array_length(c_t, 1) loop
    if c_cf[v_m] <= v_min + v_tol then
      v_e := 0;
      for i in 1..v_n loop
        v_d := p_y[i] - (c_b0[v_m] + c_b1[v_m] * p_x[i] + c_b2[v_m] * greatest(0, p_x[i] - c_t[v_m]));
        v_e := v_e + v_d * v_d;
      end loop;
      if v_best_e is null or v_e < v_best_e then v_best_e := v_e; v_best := v_m; end if;
    end if;
  end loop;

  v_b1 := c_b1[v_best];
  v_above := c_b1[v_best] + c_b2[v_best];
  if not (v_best_e <= v_le * 0.5) then return; end if;                           -- 直線で十分に説明できる＝折れ目とは言わない
  if not (v_above > 0 and v_above > greatest(0, v_b1) * 1.2) then return; end if; -- 超えた側で単価が上がっていない
  t := c_t[v_best]; below := greatest(0, v_b1); above := v_above;
  return next;
end;
$fn$;

revoke all on function public.pv_company_kink_fit(float8[], float8[]) from public, anon, authenticated;
comment on function public.pv_company_kink_fit(float8[], float8[]) is
  '折れ目の当てはめ（my-year.js の findKink の写し・片方だけ直さない）。点 (x, y) から t・below・above を返す。出せなければ0行。'
  '表を読まない純粋な計算。呼ぶのは pv_company_rate_refresh() だけ（誰にも grant しない）。';


-- ════════════════════════════════════════════════════════════════
-- 3. pv_company_rate_refresh() — 2つの表の中身を丸ごと作り直す
--    呼ぶのは下の引き金（と、ファイルの最後の1回）だけ。誰にも実行させない。
--    数える行（mon）は1回だけ作り、単価と折れ目の両方がそれを読む（給与の表を読むのは1回）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_company_rate_refresh()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_from timestamptz := now() - interval '24 months';
begin
  -- 1本ずつ（同時に来た後の1本は、前の1本が終わってから新しい中身を見て作り直す）。select は止めない。
  lock table public.pv_company_rate in exclusive mode;
  lock table public.pv_company_kink in exclusive mode;

  delete from public.pv_company_rate where true;
  delete from public.pv_company_kink where true;

  with
  -- 給与：db/member-median.sql の給与の行と同じ条件（幅・24か月・下ろした人・テスト用アカウント）
  pay as (
    select 'r:' || p.proof_hash as pkey, p.airline, p.airline_other, p."position" as pos,
           p.period_year * 100 + p.period_month as per,
           p.fx_to_jpy::numeric as fx,
           public.pv_variable_by_basis(p.pay_items) as vb,
           p.block_hours::numeric as bh, p.duty_hours::numeric as dh, p.night_hours::numeric as nh,
           p.sectors::numeric as sec, p.stay_nights::numeric as stay,
           p.per_diem::numeric as pd, p.flight_variable_pay::numeric as fv,
           -- ★乗務1時間あたりの分子（原本通貨・月額）。pay-viz.js の calc() の numer の写し（片方だけ直さない）:
           --   月額 ＝ (annual_total_orig − bonus_annual − profit_share_annual) ÷ 12（monthlyOrig）
           --   numer ＝ max(0, 月額 − パーディアム − 総支給の外の組合分)。年額が無ければ null。
           case when p.annual_total_orig is not null
                then greatest(0, (p.annual_total_orig - coalesce(p.bonus_annual, 0) - coalesce(p.profit_share_annual, 0)) / 12
                                 - coalesce(p.per_diem, 0)
                                 - case when public.pv_union_outside_gross(p.pay_items)
                                        then coalesce(p.union_pay, 0) else 0 end)
           end as numer
      from public.pay_reports p
     where p.annual_total_usd between 10000 and 700000
       and p.created_at >= v_from
       -- 下ろした人（db/member-median.sql の 'r:' || h.proof_hash = 人の鍵 と同じ ── 給与の行だけなので鍵の頭を付けずに比べる）
       and not exists (select 1 from public.pay_hidden h where h.proof_hash = p.proof_hash)
       and not exists (select 1 from public.pv_test_users t   -- ★テスト用アカウント（給与）
                        where encode(extensions.digest(t.uid::text || '::pv_pay::' || p.airline || coalesce('::' || lower(p.airline_other), ''), 'sha256'), 'hex') = p.proof_hash)
  ),
  -- 社名を会社コードへ（同じ字は1回だけ引く）。どこにも当たらない（'other'）なら捨てる
  names as materialized (
    select distinct p.airline_other as nm from pay p where p.airline = 'other' and p.airline_other is not null
  ),
  res as materialized (
    select n.nm, nullif(public.pv_airline_resolve(n.nm), 'other') as code from names n
  ),
  mon as materialized (
    select x.pkey, x.air, x.per, x.fx, x.vb, x.bh, x.dh, x.nh, x.sec, x.stay, x.pd, x.fv, x.numer,
           case x.pos when 'captain' then 'cap' when 'cap' then 'cap' when 'tri_tre' then 'cap'
                      when 'fo' then 'fo' when 'sfo' then 'fo' end as rank
      from (select p.*, p.airline as air from pay p where p.airline <> 'other'
            union all
            select p.*, r.code from pay p join res r on r.nm = p.airline_other where p.airline = 'other') x
     where x.air is not null
  ),
  -- ① 単価：月ごとに (額, 数量) を k の数だけ並べ、両方が 0 より大きい月だけ残す（my-year.js の rateRow と同じ）
  pts as (
    select m.pkey, m.air, m.rank, v.k, v.amt, v.qty
      from mon m
      cross join lateral (values
        ('block',    (m.vb ->> 'block')::numeric  * m.fx, m.bh),
        ('duty',     (m.vb ->> 'duty')::numeric   * m.fx, m.dh),
        ('night',    (m.vb ->> 'night')::numeric  * m.fx, m.nh),
        ('sector',   (m.vb ->> 'sector')::numeric * m.fx, m.sec),
        ('perdiem',  m.pd * m.fx,                         m.stay),
        ('perBlock', m.numer * m.fx,                      m.bh)
      ) as v(k, amt, qty)
     where m.rank is not null
       and v.amt > 0 and v.qty > 0
  ),
  -- 1人の単価を先に作る（★1人1票 ── 月の数で重みを付けない）
  person as (
    select s.air, s.rank, s.k, s.pkey, sum(s.amt) / sum(s.qty) as rate
      from pts s
     group by s.air, s.rank, s.k, s.pkey
  ),
  vals as (
    select q.air, q.rank, q.k, q.rate,
           row_number() over (partition by q.air, q.rank, q.k order by q.rate) as i,
           count(*)     over (partition by q.air, q.rank, q.k)                 as n   -- ★人数（person は1人1行）
      from person q
  ),
  ins_rate as (
    insert into public.pv_company_rate (airline, rank, k, rate_jpy, n, updated_at)
    select v.air, v.rank, v.k, round(avg(v.rate), 2), v.n::int, now()
      from vals v
     where v.i in ((v.n + 1) / 2, (v.n + 2) / 2)
     group by v.air, v.rank, v.k, v.n
    returning 1
  ),
  -- ② 折れ目：会社 × 職位の月を全部集めた点。乗務時間の変動給の点が6つに届かなければ、変動給の合計の点に替える
  kp as (
    select m.pkey, m.air, m.rank, m.per, m.bh as x, (m.vb ->> 'block')::numeric * m.fx as y, true as blk
      from mon m
     where m.rank is not null and m.bh > 0 and (m.vb ->> 'block')::numeric * m.fx > 0
    union all
    select m.pkey, m.air, m.rank, m.per, m.bh, m.fv * m.fx, false
      from mon m
     where m.rank is not null and m.bh > 0 and m.fv * m.fx > 0
  ),
  kc as (
    select k.air, k.rank, count(*) filter (where k.blk) as nblk from kp k group by k.air, k.rank
  ),
  kg as (
    select k.air, k.rank,
           array_agg(k.x::float8 order by k.pkey, k.per) as xs,
           array_agg(k.y::float8 order by k.pkey, k.per) as ys,
           count(distinct k.pkey) as n                                       -- ★点を出した人数（点の数ではない）
      from kp k
      join kc c on c.air = k.air and c.rank = k.rank
     where k.blk = (c.nblk >= 6)
     group by k.air, k.rank
  )
  insert into public.pv_company_kink (airline, rank, t, below, above, n, updated_at)
  select g.air, g.rank, f.t::numeric, round(f.below::numeric, 2), round(f.above::numeric, 2), g.n::int, now()
    from kg g
    cross join lateral public.pv_company_kink_fit(g.xs, g.ys) f
   where g.n >= 2;                                                          -- ★2人以上から来た点だけ
end;
$fn$;

revoke all on function public.pv_company_rate_refresh() from public, anon, authenticated;
comment on function public.pv_company_rate_refresh() is
  '会社 × 職位の単価（pv_company_rate）と単価が変わる点（pv_company_kink）を丸ごと作り直す。'
  '数える行は db/member-median.sql の給与の行と同じ。呼ぶのは書き込みの引き金だけ（誰にも実行させない）。';


-- ════════════════════════════════════════════════════════════════
-- 4. 読む口（表を引くだけ・何も数えない）
--    n ≥ 2 の区分だけ。n は返さない（人数を外へ出さない）。ほかの会員の月の点も返さない。
--    給与の鍵が生きている会員と運営だけ（pv_work_level() = 'pay'・会社ページの給与の図と同じ門）。
--    鍵の無い会員・止めた会員には何も返さない。未ログインは実行権が無い。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_company_rates(p_airline text)
returns table (rank text, k text, rate_jpy numeric)
language sql
stable
security definer
set search_path = public
as $fn$
  select r.rank, r.k, r.rate_jpy
    from public.pv_company_rate r
   where r.airline = p_airline
     and r.n >= 2
     and public.pv_work_level() = 'pay'  -- ★給与の鍵が生きている会員と運営だけ（pv_company_pay と同じ門）
     and not public.pv_proof_blocked()   -- ★止めた会員には何も返さない（会員だけが見られるものの1行）
   order by r.rank, r.k;
$fn$;

revoke all on function public.pv_company_rates(text) from public, anon, authenticated;
grant execute on function public.pv_company_rates(text) to authenticated;
comment on function public.pv_company_rates(text) is
  '会社 × 職位の単価（円・1人の Σ額 ÷ Σ数量 の中央値）。2人以上の区分だけ・返すのは職位・種類・単価の3つだけ（人数は返さない）。'
  '表を引くだけで何も数えない。給与の鍵が生きている会員と運営だけ（pv_work_level）・止めた会員には何も返さない。';

create or replace function public.pv_company_kink(p_airline text)
returns table (rank text, t numeric, below numeric, above numeric)
language sql
stable
security definer
set search_path = public
as $fn$
  select k.rank, k.t, k.below, k.above
    from public.pv_company_kink k
   where k.airline = p_airline
     and k.n >= 2
     and public.pv_work_level() = 'pay'  -- ★給与の鍵が生きている会員と運営だけ（pv_company_pay と同じ門）
     and not public.pv_proof_blocked()   -- ★止めた会員には何も返さない（会員だけが見られるものの1行）
   order by k.rank;
$fn$;

revoke all on function public.pv_company_kink(text) from public, anon, authenticated;
grant execute on function public.pv_company_kink(text) to authenticated;
comment on function public.pv_company_kink(text) is
  '会社 × 職位の「単価が変わる点」（t・その手前 below・超えた分 above。円／乗務1時間）。2人以上から来た点で出た区分だけ・'
  '人数も点も返さない。表を引くだけで何も数えない。給与の鍵が生きている会員と運営だけ（pv_work_level）・止めた会員には何も返さない。';


-- ════════════════════════════════════════════════════════════════
-- 5. 引き金 — 書き込みのあと（1文に1回）数え直す。失敗しても書き込みは止めない
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_company_rate_trg()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $fn$
begin
  begin
    perform public.pv_company_rate_refresh();
  exception when others then
    -- 書き込みは通す。表は前の中身のまま（この begin の中の変更だけが巻き戻る）
    raise warning 'pv_company_rate_refresh に失敗しました（書き込みはそのまま通します）: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end;
$fn$;

revoke all on function public.pv_company_rate_trg() from public, anon, authenticated;
comment on function public.pv_company_rate_trg() is
  '給与・下ろした人・テスト用アカウントの書き込みのあとに pv_company_rate_refresh() を呼ぶ。'
  '数え直しが失敗しても warning にするだけで、書き込みは止めない。';

-- 給与：数える行の条件と額・数量に関わる列の update だけ（verify_level などの書き換えでは数え直さない）
drop trigger if exists trg_pv_company_rate on public.pay_reports;
create trigger trg_pv_company_rate
  after insert or delete
        or update of proof_hash, airline, airline_other, "position", annual_total_usd, created_at,
                     period_year, period_month, fx_to_jpy, pay_items,
                     block_hours, duty_hours, night_hours, sectors, stay_nights,
                     per_diem, flight_variable_pay, union_pay,
                     annual_total_orig, bonus_annual, profit_share_annual
  on public.pay_reports
  for each statement execute function public.pv_company_rate_trg();

drop trigger if exists trg_pv_company_rate on public.pay_hidden;
create trigger trg_pv_company_rate
  after insert or update or delete on public.pay_hidden
  for each statement execute function public.pv_company_rate_trg();

drop trigger if exists trg_pv_company_rate on public.pv_test_users;
create trigger trg_pv_company_rate
  after insert or update or delete on public.pv_test_users
  for each statement execute function public.pv_company_rate_trg();


-- ════════════════════════════════════════════════════════════════
-- 6. いまの中身で1回数え直す
-- ════════════════════════════════════════════════════════════════
select public.pv_company_rate_refresh();


-- 検算（貼ったあとに出る14行。全部 ✅ が正しい。★「貼れた」は証拠にならない。この14行を読む）
-- 14行目だけは ⚠️ がありうる（テスト用アカウントをまだ入れていない＝ db/member-median.sql の冒頭の insert を流す）。
with d as (select pg_get_functiondef('public.pv_company_rate_refresh()'::regprocedure) as s),
     r as (select pg_get_functiondef('public.pv_company_rates(text)'::regprocedure) as s),
     k as (select pg_get_functiondef('public.pv_company_kink(text)'::regprocedure) as s),
     g as (select pg_get_functiondef('public.pv_company_rate_trg()'::regprocedure) as s)
select 1 as no, '2つの表は RLS 有効・ポリシー無し' as 検算,
       case when (select bool_and(c.relrowsecurity) from pg_class c
                   where c.oid in ('public.pv_company_rate'::regclass, 'public.pv_company_kink'::regclass))
             and not exists (select 1 from pg_policies p
                              where p.schemaname = 'public' and p.tablename in ('pv_company_rate', 'pv_company_kink'))
            then '✅' else '❌' end as 結果
union all select 2, '未ログイン・ログイン済みとも2つの表を直接読めない',
       case when not has_table_privilege('anon', 'public.pv_company_rate', 'select')
             and not has_table_privilege('authenticated', 'public.pv_company_rate', 'select')
             and not has_table_privilege('anon', 'public.pv_company_kink', 'select')
             and not has_table_privilege('authenticated', 'public.pv_company_kink', 'select')
            then '✅' else '❌' end
union all select 3, '読む口2つはログイン済みだけが呼べる（未ログイン・PUBLIC には実行権が無い）',
       case when has_function_privilege('authenticated', 'public.pv_company_rates(text)', 'execute')
             and has_function_privilege('authenticated', 'public.pv_company_kink(text)', 'execute')
             and not has_function_privilege('anon', 'public.pv_company_rates(text)', 'execute')
             and not has_function_privilege('anon', 'public.pv_company_kink(text)', 'execute')
             and not exists (select 1 from pg_proc q, lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
                              where q.oid in ('public.pv_company_rates(text)'::regprocedure, 'public.pv_company_kink(text)'::regprocedure)
                                and a.grantee = 0 and a.privilege_type = 'EXECUTE')
            then '✅' else '❌' end
union all select 4, '単価の口が返すのは職位・種類・単価の3つだけ（人数を返さない）・2人以上だけ',
       case when pg_get_function_result('public.pv_company_rates(text)'::regprocedure) = 'TABLE(rank text, k text, rate_jpy numeric)'
             and (select s from r) like '%r.n >= 2%'
            then '✅' else '❌' end
union all select 5, '折れ目の口が返すのは職位・t・below・above の4つだけ（人数を返さない）・2人以上だけ',
       case when pg_get_function_result('public.pv_company_kink(text)'::regprocedure) = 'TABLE(rank text, t numeric, below numeric, above numeric)'
             and (select s from k) like '%k.n >= 2%'
            then '✅' else '❌' end
union all select 6, '読む口は表を引くだけ（給与の表を読まない・数えない＝開くたびに重くならない）',
       case when (select s from r) not like '%pay_reports%' and (select s from k) not like '%pay_reports%'
             and (select s from r) not like '%refresh%' and (select s from k) not like '%refresh%'
             and (select s from r) not like '%kink_fit%' and (select s from k) not like '%kink_fit%'
            then '✅' else '❌' end
union all select 7, '読む口は2つとも止めた会員に何も返さない（pv_proof_blocked）',
       case when (select s from r) like '%not public.pv_proof_blocked()%' and (select s from k) like '%not public.pv_proof_blocked()%'
            then '✅' else '❌' end
union all select 8, '読む口は2つとも給与の鍵が生きている会員と運営だけ（pv_work_level = pay ・会社ページの給与の図と同じ門・写しを持たない）',
       case when (select s from r) like '%and public.pv_work_level() = ''pay''%' and (select s from k) like '%and public.pv_work_level() = ''pay''%'
             and (select s from r) not like '%access_until%' and (select s from k) not like '%access_until%'
            then '✅' else '❌' end
union all select 9, '数え直し・当てはめ・引き金の関数は誰にも実行させない（PUBLIC・未ログイン・ログイン済み）',
       case when not exists (select 1 from pg_proc q, lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
                              where q.oid in ('public.pv_company_rate_refresh()'::regprocedure,
                                              'public.pv_company_kink_fit(float8[], float8[])'::regprocedure,
                                              'public.pv_company_rate_trg()'::regprocedure)
                                and a.privilege_type = 'EXECUTE'
                                and (a.grantee = 0 or a.grantee in (select oid from pg_roles where rolname in ('anon', 'authenticated'))))
            then '✅' else '❌' end
union all select 10, '引き金が3つの表に付いている（給与・下ろした人・テスト用アカウント）',
       case when (select count(*) from pg_trigger t
                   where t.tgname = 'trg_pv_company_rate' and not t.tgisinternal
                     and t.tgrelid in ('public.pay_reports'::regclass, 'public.pay_hidden'::regclass,
                                       'public.pv_test_users'::regclass)) = 3
            then '✅' else '❌' end
union all select 11, '数え直しが失敗しても書き込みは止めない（引き金が例外を握る）',
       case when (select s from g) like '%exception when others then%' and (select s from g) like '%raise warning%'
            then '✅' else '❌' end
union all select 12, 'テスト用アカウントと下ろした人を外している（db/member-median.sql と同じ式）',
       case when (select s from d) like '%pv_test_users t   -- ★テスト用アカウント（給与）%'
             and (select s from d) like '%''::pv_pay::''%'
             and (select s from d) like '%pay_hidden%'
             and (select s from d) like '%between 10000 and 700000%'
            then '✅' else '❌' end
union all select 13, '単価の人数は1人1票（1人の単価を先に作る）・折れ目は2人以上から来た点だけ',
       case when (select s from d) like '%group by s.air, s.rank, s.k, s.pkey%'
             and (select s from d) like '%count(distinct k.pkey) as n%'
             and (select s from d) like '%where g.n >= 2;%'
            then '✅' else '❌' end
union all select 14, 'テスト用アカウントの名簿 ' || (select count(*) from public.pv_test_users) || ' 人'
                     || '・単価の表 ' || (select count(*) from public.pv_company_rate) || ' 行'
                     || '・折れ目の表 ' || (select count(*) from public.pv_company_kink) || ' 区分',
       case when (select count(*) from public.pv_test_users) > 0 then '✅'
            else '⚠️ 0人（テスト用アカウントの uid を pv_test_users に入れる）' end
order by 1;
