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
-- 2026-08-23 オーナー判断：**出した人は全員そのまま行にする。**
--   同じ日に、次の3つを外した。
--     ・k≧5 の門（同じ区分に5人未満なら出さない）
--     ・30日の遅延（今出した人は翌日には出る）
--     ・p10-p90 のクリップ（区分そのものが無くなったので、寄せる相手が居ない）
--   理由は「まだ人数が少なく、門を残すと画面に1行も出ない」。
--   ＝ 出した人が9人なら9行、その人が1人しか居ない会社でも1行出る。
--
-- ★これで匿名性がどこまで落ちたか（正直に書いておく）
--   会社・職位・機材の3つが分かっている同僚には、行を当てられうる。
--   「うちの 787 の機長で去年から居るのはあいつだけ」が成り立つ規模だと、
--   その行はその人のものだと分かる。**これは承知のうえで選んだ形。**
--   したがってこの設計を支えているのは、いま次の6つだけ。
--
--     ① 鍵         給与明細を1枚出した人だけ・90日（サーバ側。anon には開かない）
--     ② 準識別子ゼロ 基地・在籍年数・年代・投稿月・原本通貨・契約形態・国籍・
--                   レポートID・提出日を1つも返さない（列にも group by にも入れない）
--     ③ 有効数字2桁  $183,456 は $180,000 として出る。1円まで一致する個票が存在しない
--     ④ 1行＝1人    同じ人の複数月は年換算の中央値で1行に畳む（回数から常連が割れない）
--     ⑤ 引数ゼロ    総当たりで区分を指定して引く面が無い
--     ⑥ 並びに時間が無い md5(proof_hash) 順。投稿順に並べない
--
--   ③を外すと個票そのものになる。④を外すと出した回数が漏れる。
--   **この6つは1つも外さないこと。**
--
-- ★まだ禁じていること：
--   ・この関数に引数を足すこと（総当たりで区分を指定する面が生える）
--   ・anon に execute を渡すこと（下の grant は authenticated だけ）
--   ・②の列を1つでも返り値に足すこと
--   ・自由入力の社名（airline_other）を読むこと・返すこと
--     → 打ち込まれた文字列そのものが識別子。airline は 'other' のまま返し、
--        画面が「その他の航空会社」という固定の札に置き換える
--   ・投稿の時刻・順序が読める並びにすること（新しさは「誰が最近出したか」）
--
-- ★将来この関数が重くなったときの正しい直し方：
--   引数を足さない。結果を authenticated 限定のビューに落として PostgREST 側で絞らせる。
--   行はもう匿名化済みなので、絞り込み自体は攻撃面にならない。引数だけが攻撃面になる。
--
-- ★人数が増えたら締め直す余地（今日はまだ早い）：
--   ・✓ Verified は1ビットの準識別子。検証済みが1人だけの会社では手がかりになる。
--     画面側で「Verified だけ」の絞り込みを作らない限り実害は小さい（作らないこと）。
--   ・行数が数百に育ったら、k≧5 の門を戻すのが素直。戻すときは having を
--     person の上に置くだけで済むように、person は区分ごとに畳んだ形のままにしてある。
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
--   k≧5 の門もクリップも外した今、丸めがいちばん外側の守りになっている。
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
-- 2. pv_pay_rows — 匿名レポート一覧（1行＝1人・出した人は全員）
--
-- 返り値
--   { ok:true, state:'locked', rows:[] }   鍵が無い／切れている
--   { ok:true, state:'open',   rows:[ … ] } 鍵がある
--
-- rows[] の1件
--   { airline, pos, fleet, annual_usd, verified }
--     airline … 航空会社コード。自由入力の社名の人は 'other' のまま
--               （打ち込まれた文字列は返さない。画面が固定の札に置き換える）
--     fleet   … 機材コード。'other' はそのまま「その他」として出る
--
-- 同じ人の複数月は「年換算額の中央値」で1行に畳む。
--   ★最新月を採らない。最新月は投稿の新しさと相関するので、月をまたいで並べると
--     個人の変化を定点観測できてしまう。中央値なら2ヶ月の人は2値の平均＝
--     どの明細にも存在しない数になる（むしろ望ましい）。
--   ★同じ人が 787 と 330 の両方を出していれば、機材ごとに1行ずつ出る。
--     これは「1人が2人に見える」ということなので、行数を人数と読まないこと。
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
    --   自由入力の社名の列は、ここにも下にも1度も出てこない（読まない）。
    --   ★この行に列名そのものを書かないこと。自己点検7が「読んでいる」と誤検知する。
    select r.proof_hash,
           r.airline,
           r."position" as pos,
           r.fleet,
           r.annual_total_usd,
           r.verify_level
      from public.pay_reports r
     where r.annual_total_usd is not null      -- レートの無い通貨は落ちる（6章と同じ）
       and r.created_at >= now() - interval '24 months'
  ),
  person as (
    -- ★人ごとに畳む。ここが「1行＝1人」の実体。
    select airline, pos, fleet, proof_hash,
           -- ★percentile_cont は numeric を渡しても double precision で返る。
           --   round(値, 桁) は numeric にしか無いので、先に ::numeric を通す。
           (percentile_cont(0.5) within group (order by annual_total_usd))::numeric as v,
           max(verify_level) >= 1 as verified
      from src
     group by airline, pos, fleet, proof_hash
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'airline',    p.airline,
           'pos',        p.pos,
           'fleet',      p.fleet,
           'annual_usd', public.pv_sig2(p.v),
           'verified',   p.verified
         -- ★並びに時間を入れないこと。投稿順に並べると、並び順そのものが
         --   「誰が最近出したか」になる（外した30日の遅延より悪い）。
         --   md5 なので毎回同じ並びで、しかも中身とも関係が無い。
         --   proof_hash そのものは返さない（並べるためだけに使う）。
         ) order by md5(p.proof_hash)), '[]'::jsonb)
    into v_rows
    from person p;

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
  '実給与の匿名一覧。1行＝1人（複数月は年換算の中央値で畳む）。出した人は全員出る。'
  '基地・在籍年数・年代・投稿月・原本通貨・契約形態・自由入力の社名は返さない。'
  '金額は有効数字2桁に丸める。並びは md5(proof_hash) 順で投稿順ではない。'
  '★引数を取らない＝他人の区分を狙って引く面が無い。'
  '★鍵は給与明細の access_until のみ。口コミの鍵では開かない。';


-- ════════════════════════════════════════════════════════════════
-- 3. 自己点検（読むだけ。何も書き換えない）
--
-- ★1本の SELECT にしてある。Supabase の SQL Editor は複数文を流すと
--   最後の1本の結果しか出さないので、分けて書くと上から順に消えていく。
-- 期待：14行すべて ✅。1つでも ❌ なら、そこが効いていない。
--
-- 特に 4・11・12・13 は「静かに壊れる」種類のもの。画面には何も出ないまま、
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
  select 6, '給与明細の鍵（access_until）を見ている',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%access_until%' end from f
  union all
  select 7, '自由入力の社名は読んでも返してもいない',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) not like '%airline_other%' end from f
  union all
  select 8, '金額を有効数字2桁に丸めている',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%pv_sig2(%' end from f
  union all
  select 9, '同じ人の複数月を1行に畳んでいる（proof_hash で group by）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%group by airline, pos, fleet, proof_hash%'
         end from f
  union all
  select 10, '並びに時間が入っていない（md5 順・投稿順ではない）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) like '%order by md5(%'
               and pg_get_functiondef(f_rows) !~ 'order by[^;]*created_at'
         end from f
  union all
  select 11, '準識別子を1つも読んでいない（基地・在籍年数・年代・投稿月・国籍・契約・税・原本通貨）',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) !~
                   '(base_iata|seniority_years|age_bucket|contract_type|tax_country|nationality|annual_total_orig|period_month)'
         end from f
  union all
  select 12, '返す行に個人の同定キーが入っていない',
         case when f_rows is null then false
              else pg_get_functiondef(f_rows) not like '%''proof_hash''%' end from f
  union all
  select 13, '丸めの関数が immutable（呼ぶたびに答えが変わらない）',
         case when f_sig is null then false
              else (select p.provolatile from pg_proc p where p.oid = f.f_sig) = 'i' end from f
  union all
  select 14, '公開集計の5人未満ルールは今も生きている（このファイルは緩めていない）',
         case when bench is null then false
              else pg_get_viewdef(bench) like '%>= 5%' end from f
) t
order by n;
