-- ════════════════════════════════════════════════════════════════════════
-- db/pay-rows.sql — 「他のパイロットの実給与を見る」の読み出し経路
--
-- 適用順：db/vocab.generated.sql → db/airlines.generated.sql →
--         db/pay-reports.sql → ★このファイル
--         （profiles.access_until と pay_reports は pay-reports.sql が作る）
--
-- ────────────────────────────────────────────────────────────────────────
-- ★★ ここはプライバシーの例外そのものなので、1文字でも変える前に必ず読む。
--
-- pay_benchmarks（db/pay-reports.sql 6章）は「1行＝区分の集計」だった。
-- この関数は違う。**1行＝1人**を返す。粒度が一段細かい。
--
-- 2026-08-23 オーナー判断：件数バッジは出さず、条件を満たした人は全員を行にする。
--   ＝ **行を数えれば n≧5 の区分の人数はそのまま読める。** これは承知のうえで選んだ形。
--   だから匿名性は「件数を隠すこと」には一切かかっていない。かかっているのは次の5つで、
--   **5つ全部が同時に成り立っているときだけ**この設計が成立する。1つでも外すと壊れる。
--
--     ① k≧5 の門       同じ区分に5人未満なら、その区分の行は1つも存在しない
--     ② 準識別子ゼロ    基地・在籍年数・年代・投稿月・原本通貨・契約形態・国籍・
--                       レポートID・提出日を1つも返さない（列にも group by にも入れない）
--     ③ p10-p90 クリップ 区分の中で極端に高い／低い1人が、そのままの額で浮かない
--     ④ 有効数字2桁     $183,456 は $180,000 として出る。1円まで一致する個票が存在しない
--     ⑤ 30日の遅延      「今出した人」が翌日に浮かない
--
--   ③④が効いているので、行数の差分から読めるのは「だいたい¥2,100万」までの粗さで、
--   これは pay_benchmarks が今日すでに公開している粒度と同じ。だから実害は小さいと判断した。
--   **丸めとクリップを外すと、この判断そのものが崩れる。**
--
-- ★まだ禁じていること：
--   ・この関数に引数を足すこと（総当たりで区分を指定する面が生える）
--   ・anon に execute を渡すこと（下の grant は authenticated だけ）
--   ・having count(*) >= 5 を緩めること
--   ・②の列を1つでも返り値に足すこと
--   ・「機材別が5人未満だったのでカテゴリに落とす」というフォールバックを書くこと
--     → 粗い行が「薄い機種の寄せ集め」になり、公開済みの機種別行と引き算すると
--        個々の機種の人数が 1〜4 に絞れる。だから粒度A・Bは**独立に**作る（下記）。
--
-- ★将来この関数が重くなったときの正しい直し方：
--   引数を足さない。結果を authenticated 限定のビューに落として PostgREST 側で絞らせる。
--   行はもう匿名化済みなので、絞り込み自体は攻撃面にならない。引数だけが攻撃面になる。
--
-- ★既知の弱いところ（オーナー承知）：
--   ・n=5 ちょうどの区分では、その5人全員が行として出る。pay_benchmarks が同じ5人について
--     3点しか出していないのに対し5点出る。しかも percentile_cont は n=5 だと p90 が
--     最大値の側へ強く寄るので、クリップが効きにくい。人数が増えるほど強くなる種類の守り。
--   ・✓ Verified は1ビットの準識別子。区分の中で検証済みが1人だけなら手がかりになる。
--     絞り込みフィルタを作らない限り実害は小さい（画面側で「Verified だけ」を作らない）。
--     もっと堅くするなら、6章の項目別ゲートと同じく「その区分で検証済みが5人以上のときだけ
--     ✓ を出す」に締められる。今日は検証済みが0件なので、締めても列が空になるだけ。
--   ・訂正（同じ社・同じ月の出し直し）は created_at を now() に戻す。だから訂正した行は
--     30日のあいだ一覧から消える。安全側に倒れているので直さない。
--
-- ★鍵を間違えないこと：
--   ここを開けるのは **給与明細の鍵（profiles.access_until・90日）** だけ。
--   口コミの鍵（pv-session.js の PVUnlock.reviewUntil）ではない。
--   2つの鍵が混ざらないことは assert-unlock.mjs が見張っている。
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 1. pv_sig2 — 有効数字2桁に丸める
--
--   183456 → log10 = 5.26 → floor = 5 → round(v, 1-5 = -4) → 180000
--     9.53 → log10 = -0.02 → floor = -1 → round(v, 2)      → 9.53
--
-- ★2桁より細かくしない。1円まで一致する数字は「個票がある」という証拠になる。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_sig2(v numeric)
returns numeric
language sql
immutable
as $$
  select case when v is null or v <= 0 then null
              else round(v, 1 - floor(log(v))::int)
         end;
$$;

revoke all on function public.pv_sig2(numeric) from public, anon;
grant execute on function public.pv_sig2(numeric) to authenticated;

comment on function public.pv_sig2(numeric) is
  '有効数字2桁に丸める。実給与の一覧はこれを通した額しか外へ出さない。'
  '桁を増やすと個票の証拠になるので増やさないこと。';


-- ════════════════════════════════════════════════════════════════
-- 2. pv_pay_rows — 匿名レポート一覧（1行＝1人）
--
-- 返り値
--   { ok:true, state:'locked', rows:[] }   鍵が無い／切れている
--   { ok:true, state:'open',   rows:[ … ] } 鍵がある
--
-- rows[] の1件
--   { airline, pos, grain, bucket, annual_usd, verified, cohort_median_usd }
--     grain  … 'fleet'（機材そのもの）／ 'cat'（機材カテゴリ r/n/w）
--     bucket … grain が 'fleet' なら機材コード、'cat' ならカテゴリコード
--
-- 粒度は2つを**独立に**作る（片方のフォールバックにしない）
--   粒度A  (会社, 職位, 機材)         に5人以上 → 機材別の行
--   粒度B  (会社, 職位, 機材カテゴリ) に5人以上 → そのカテゴリの**全員**で作り直した行
--          （Aに出ている人も含める。含めないと引き算で個々の機材の人数が割れる）
--   カテゴリの無い機材（＝「その他」）は粒度Bに乗せない。
--   会社は粗くしない（会社名がこの画面の要点）。
--
-- 同じ人の複数月は「年換算額の中央値」で1行に畳む。
--   ★最新月を採らない。最新月は投稿の新しさと相関するので、月をまたいで並べると
--     個人の変化を定点観測できてしまう。中央値なら2ヶ月の人は2値の平均＝
--     どの明細にも存在しない数になる（むしろ望ましい）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_pay_rows()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_until timestamptz;
  v_rows  jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select p.access_until into v_until from public.profiles p where p.id = v_uid;

  -- ★ここで raise しない。投げると画面がエラー表示になり、
  --   「1枚出せば開く」という肝心の伝え方ができなくなる。
  if v_until is null or v_until <= now() then
    return jsonb_build_object('ok', true, 'state', 'locked', 'rows', '[]'::jsonb);
  end if;

  with src as (
    -- ★ここで選んだ列がすべて。増やす前に必ずファイル冒頭の②を読む。
    select r.proof_hash,
           r.airline,
           r."position" as pos,
           r.fleet,
           r.fleet_cat,
           r.annual_total_usd,
           r.verify_level
      from public.pay_reports r
     where r.annual_total_usd is not null      -- レートの無い通貨は落ちる（6章と同じ）
       and r.airline_other is null             -- 自由入力の社名は社名そのものが識別子
       and r.created_at <= now() - interval '30 days'
       and r.created_at >= now() - interval '24 months'
  ),
  -- 粒度A：人ごとに畳む
  p_fleet as (
    select 'fleet'::text as grain,
           airline, pos, fleet as bucket, proof_hash,
           -- ★percentile_cont は numeric を渡しても double precision で返る。
           --   round(値, 桁) は numeric にしか無いので、先に ::numeric を通す。
           (percentile_cont(0.5) within group (order by annual_total_usd))::numeric as v,
           max(verify_level) >= 1 as verified
      from src
     group by airline, pos, fleet, proof_hash
  ),
  -- 粒度B：★A から作らない。src から作り直す。
  --   A から積み上げると、同じ人が 787 と 330 を出したときカテゴリで2人に数える。
  p_cat as (
    select 'cat'::text as grain,
           airline, pos, fleet_cat as bucket, proof_hash,
           (percentile_cont(0.5) within group (order by annual_total_usd))::numeric as v,
           max(verify_level) >= 1 as verified
      from src
     where fleet_cat is not null
     group by airline, pos, fleet_cat, proof_hash
  ),
  person as (
    select grain, airline, pos, bucket, proof_hash, v, verified from p_fleet
    union all
    select grain, airline, pos, bucket, proof_hash, v, verified from p_cat
  ),
  coh as (
    select grain, airline, pos, bucket,
           (percentile_cont(0.10) within group (order by v))::numeric as p10,
           (percentile_cont(0.50) within group (order by v))::numeric as p50,
           (percentile_cont(0.90) within group (order by v))::numeric as p90
      from person
     group by grain, airline, pos, bucket
    having count(*) >= 5     -- ★①の門。6章の having と同じ数字。緩めないこと
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'airline',           x.airline,
           'pos',               x.pos,
           'grain',             x.grain,
           'bucket',            x.bucket,
           'annual_usd',        x.annual_usd,
           'verified',          x.verified,
           'cohort_median_usd', x.cohort_median_usd
         ) order by x.airline, x.pos, x.grain, x.bucket, x.annual_usd), '[]'::jsonb)
    into v_rows
    from (
      select p.grain, p.airline, p.pos, p.bucket, p.verified,
             -- ★クリップしてから丸める。この順。
             --   逆にすると端が半端な数で出て、そこだけ実額に見える。
             public.pv_sig2(least(greatest(p.v, c.p10), c.p90)) as annual_usd,
             public.pv_sig2(c.p50)                              as cohort_median_usd
        from person p
        join coh c
          on  c.grain   = p.grain
          and c.airline = p.airline
          and c.pos     = p.pos
          and c.bucket  = p.bucket
    ) x;
  -- ★order by に投稿の時刻を入れないこと。並び順そのものが「誰が新しいか」になる。
  --   金額順にしてあるのは見た目のためではなく、順番から時間を消すため。

  return jsonb_build_object('ok', true, 'state', 'open', 'rows', v_rows);
end;
$$;

-- ★anon に渡さない。pay_benchmarks が anon に開いているのは「1行＝区分」だから。
--   こちらは 1行＝人で粒度が一段細かいので、同じ扱いにはできない。
--   画面側でぼかす方式（index.html の .pv-mask）もここでは使えない。
--   開発者ツールから全部見えるので、Give & Get の約束はサーバ側で守る。
revoke all on function public.pv_pay_rows() from public, anon;
grant execute on function public.pv_pay_rows() to authenticated;

comment on function public.pv_pay_rows() is
  '実給与の匿名一覧。1行＝1人（複数月は年換算の中央値で畳む）。'
  '同じ区分に5人以上いるときだけ行が存在する。基地・在籍年数・年代・投稿月・'
  '原本通貨・契約形態は返さない。金額は p10-p90 でクリップし有効数字2桁に丸める。'
  '投稿から30日たつまで出ない。★引数を取らない＝他人の区分を狙って引く面が無い。'
  '★鍵は給与明細の access_until のみ。口コミの鍵では開かない。';


-- ════════════════════════════════════════════════════════════════
-- 3. 自己点検（読むだけ。何も書き換えない）
--
-- ★1本の SELECT にしてある。Supabase の SQL Editor は複数文を流すと
--   最後の1本の結果しか出さないので、分けて書くと上から順に消えていく。
-- 期待：15行すべて ✅。1つでも ❌ なら、そこが効いていない。
--
-- 特に 4・6・12・13 は「静かに壊れる」種類のもの。画面には何も出ないまま、
-- 他人の個票に届く経路が開く。
-- ════════════════════════════════════════════════════════════════
with f as (
  select to_regprocedure('public.pv_pay_rows()')     as f_rows,
         to_regprocedure('public.pv_sig2(numeric)')  as f_sig,
         to_regclass('public.pay_benchmarks')        as bench
)
select n as "#", case when ok then '✅' else '❌' end as 結果, 見るところ
from (
  select 1 as n, '2つの関数がある' as 見るところ,
         (f_rows is not null and f_sig is not null) as ok from f
  union all
  select 2, '一覧の関数は引数を取らない（他人の区分を狙って引けない）',
         case when f_rows is null then false
              else (select p.pronargs from pg_proc p where p.oid = f.f_rows) = 0 end from f
  union all
  select 3, '一覧の関数は security definer で動く',
         case when f_rows is null then false
              else (select p.prosecdef from pg_proc p where p.oid = f.f_rows) end from f
  union all
  select 4, '登録していない人（anon）は一覧を呼べない',
         case when f_rows is null then false
              else not has_function_privilege('anon', f_rows, 'execute') end from f
  union all
  select 5, 'ログインした人は一覧を呼べる',
         case when f_rows is null then false
              else has_function_privilege('authenticated', f_rows, 'execute') end from f
  union all
  select 6, '5人未満の区分は構造的に出ない（having が残っている）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%count(*) >= 5%' end from f
  union all
  select 7, '自由入力の社名は一覧に混ざらない',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%airline_other is null%' end from f
  union all
  select 8, '給与明細の鍵（access_until）を見ている',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%access_until%' end from f
  union all
  select 9, '投稿から30日たつまで出ない',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%30 days%' end from f
  union all
  select 10, '両端をクリップしている（極端な1人がそのまま浮かない）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%least(greatest(%' end from f
  union all
  select 11, '金額を有効数字2桁に丸めている',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%pv_sig2(%' end from f
  union all
  select 12, '準識別子を1つも読んでいない（基地・在籍年数・年代・投稿月・国籍・契約・税・原本通貨）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) !~
                   '(base_iata|seniority_years|age_bucket|contract_type|tax_country|nationality|annual_total_orig|period_month)'
         end from f
  union all
  select 13, '返す行に個人の同定キーが入っていない',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) not like '%''proof_hash''%' end from f
  union all
  select 14, '丸めの関数が immutable（呼ぶたびに答えが変わらない）',
         case when f_sig is null then false
              else (select p.provolatile from pg_proc p where p.oid = f.f_sig) = 'i' end from f
  union all
  select 15, '公開集計の5人未満ルールは今も生きている（このファイルは緩めていない）',
         case when bench is null then false
              else pg_get_viewdef(bench) like '%>= 5%' end from f
) t
order by n;
