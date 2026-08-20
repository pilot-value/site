-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/pay-report-pending.sql
--
-- 「先に出してもらい、あとからアカウントを作ってもらう」ための仮の置き場。
--
-- ★ このファイルは自動では流れない。オーナーの明示承認後に SQL Editor で実行する。
-- ★ 先に db/pay-reports.sql を流すこと（submit_pay_report と
--    pv_validate_pay_payload をこのファイルが呼ぶ）。
-- 冪等（何度流しても安全）。
--
-- ── なぜ要るのか ────────────────────────────────────────────
-- pay_reports の1行は sha256(auth.uid() || …) で「誰の行か」を決めている。
-- つまり本人が確定するまで行を作れない＝これまでは
--   入力する → 登録する → やっと保存される
-- の順で、登録が1歩でも詰まった人の入力は丸ごと消えていた。
-- 会員18人・明細の読み取り17回に対して給与レポート0件、という数字の正体がこれ。
--
-- これを
--   入力する → その場でサーバに預かる → あとで登録 → 預かったぶんを本人へ移す
-- に反転させる。預かった時点では誰のものか分からないので、
-- pay_reports には入れられない。だからこのテーブルに payload のまま寝かせる。
--
-- ── この設計が守っている約束 ────────────────────────────────
--  1. 公開する数字（pay_benchmarks）はこのテーブルを1行も見ない。
--     別テーブルなので、除外の処理を書き忘れて混ざるということが起こらない。
--  2. 誰にも読ませない。RLS を有効にしてポリシーを1本も作らない
--     ＝ anon も authenticated も直接は1行も触れない。出入口は下の2つの RPC だけ。
--  3. 受け取れる入力かどうかの判定は pv_validate_pay_payload に一本化する。
--     ここで通したものは、あとの submit_pay_report でも必ず通る。
--     （通らないと「受け取りました → 登録した → 入っていない」になる）
--  4. 預かった時点では何も返さない（金額も統計も）。
--     返してしまうと、登録せずに比較結果だけ持ち帰れて、登録する理由が消える。
-- ════════════════════════════════════════════════════════════════

do $$
begin
  -- ★to_regproc ではなく to_regprocedure。to_regproc は引数の型を受け取らない
  --   （'…(jsonb)' を渡すと必ず null になり、この検査が常に落ちる）。
  if to_regprocedure('public.submit_pay_report(jsonb)') is null then
    raise exception '先に db/pay-reports.sql を実行してください';
  end if;
  if to_regprocedure('public.pv_validate_pay_payload(jsonb)') is null then
    raise exception 'db/pay-reports.sql が古いです（pv_validate_pay_payload が無い）。先に最新を実行してください';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. 置き場
-- ════════════════════════════════════════════════════════════════
create table if not exists public.pay_reports_pending (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  -- 預かり証。サーバが作る（クライアントには決めさせない）。
  -- これを持っている人だけが、あとから自分のアカウントへ移せる。
  claim_token text not null unique,

  -- submit_pay_report がそのまま食える形のまま持つ。
  -- ★ここで正規化しない。正規化を2箇所に持つと、いつか片方だけ直されて
  --   「預かったものと保存されるものが違う」になる。移すときに本体へ渡すだけ。
  payload     jsonb not null,

  -- オーナーが件数を見るための控え（payload の中にも同じものがある）。
  -- 個人には一切つながらない列だけを出しておく。
  airline      text,
  period_year  smallint,
  period_month smallint,
  lang         text,

  -- 本棚（pay_reports）へ移した時刻。移したあとも行は残す
  -- ＝「出したのに会員にならなかった人が何人いるか」がこの事業の要の数字なので、
  --   移した瞬間に消すと、その分母が永久に分からなくなる。
  claimed_at  timestamptz,

  -- 荒らし避けの計数用。IP そのものは持たない（下の comment を読むこと）。
  ip_day_hash text
);

comment on table public.pay_reports_pending is
  'アカウントを作る前に預かった給与データ。公開集計（pay_benchmarks）は1行も見ない。'
  '出入口は submit_pay_report_pending / claim_pending_report の2つだけ。';
comment on column public.pay_reports_pending.ip_day_hash is
  'sha256(IP || その日の日付)。1日あたりの件数を数えるためだけに使う。'
  '★IPそのものは残さない。ただしこのリポジトリは公開なので式は誰でも読める＝'
  '本気で当てにいけば当てられる。ここで守っているのは「万一この表が漏れても'
  '訪問者の一覧にはならない」ことだけで、それ以上を主張しない。'
  '日付を混ぜてあるので、日をまたぐと同じ人でも別の値になる（追跡には使えない）。';
comment on column public.pay_reports_pending.claimed_at is
  '本棚へ移した時刻。移した行も消さない（出したのに会員にならなかった人を数えるため）。';

create index if not exists pay_reports_pending_unclaimed_idx
  on public.pay_reports_pending (created_at) where claimed_at is null;
create index if not exists pay_reports_pending_ipday_idx
  on public.pay_reports_pending (ip_day_hash) where ip_day_hash is not null;


-- ════════════════════════════════════════════════════════════════
-- 2. 権限：誰にも直接は触らせない
-- ════════════════════════════════════════════════════════════════
alter table public.pay_reports_pending enable row level security;

-- SELECT / INSERT / UPDATE / DELETE いずれのポリシーも作らない。
-- ＝ anon も authenticated も直接は1行も読めない・書けない。
-- ★ここにポリシーを足さないこと。1本でも SELECT を開けると、
--   まだ本人が確定していない給与データを誰でも読めるようになる。
revoke all on public.pay_reports_pending from anon, authenticated;

-- 既に作ってしまったポリシーがあれば落とす（冪等・事故防止）
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'pay_reports_pending' loop
    execute format('drop policy %I on public.pay_reports_pending', p.policyname);
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 3. submit_pay_report_pending — ログインせずに預ける（anon に開ける唯一の口）
--
-- 返すのは預かり証だけ。金額も統計も返さない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.submit_pay_report_pending(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ip     text;
  v_iph    text;
  v_n      int;
  v_token  text;
  v_id     uuid;
begin
  -- ── 大きすぎる入力は見ない ──────────────────────────────
  -- ログイン不要の口なので、まず量から止める。実物のフォームは 3KB 前後。
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 20000 then
    raise exception '入力の形式が不正です' using errcode = '22023';
  end if;

  -- ── 受け取れる入力かの判定は本体と同じ関数を使う ────────────
  -- ★ここで通ったものは claim_pending_report → submit_pay_report でも必ず通る。
  --   別の判定を書くと、その差がそのまま「受け取りましたと出したのに
  --   会員登録のあとで落ちる人」になる。
  perform public.pv_validate_pay_payload(p);

  -- ── 1日あたりの上限（同じ回線から20件）──────────────────
  -- 実際に出す人は月1〜2件なので、本物のパイロットはまず当たらない。
  -- ★画面には何も出さない。超えた分だけ静かに断る。
  -- ★IP が取れない環境（ローカルの検査など）では数えない。
  --   取れないことを理由に投稿そのものを止めると、本番以外で一切試せなくなる。
  begin
    v_ip := split_part(
      coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''),
      ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_ip := btrim(v_ip);
  if v_ip <> '' then
    v_iph := encode(extensions.digest(v_ip || '::' || current_date::text, 'sha256'), 'hex');
    select count(*) into v_n
      from public.pay_reports_pending
     where ip_day_hash = v_iph and created_at > now() - interval '1 day';
    if v_n >= 20 then
      raise exception 'しばらくしてからもう一度お試しください' using errcode = '54000';
    end if;
  end if;

  -- ── 預かり証（当てられない長さにする）────────────────────
  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.pay_reports_pending
    (claim_token, payload, airline, period_year, period_month, lang, ip_day_hash)
  values (
    v_token, p,
    nullif(btrim(p->>'airline'), ''),
    (p->>'period_year')::smallint,
    (p->>'period_month')::smallint,
    coalesce(nullif(btrim(p->>'lang'), ''), 'en'),
    v_iph
  )
  returning id into v_id;

  -- ★ok と預かり証だけ。年収も比較も返さない（返すと登録する理由が消える）。
  return jsonb_build_object('ok', true, 'claim_token', v_token, 'id', v_id);
end;
$$;

-- ログイン前に呼ぶ口なので anon に渡す。ここだけが例外。
revoke all on function public.submit_pay_report_pending(jsonb) from public;
grant execute on function public.submit_pay_report_pending(jsonb) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 4. claim_pending_report — 登録できた人が、預けたぶんを自分の物にする
--
-- ★ 本棚入れは submit_pay_report に丸ごと任せる（作り直さない）。
--   auth.uid() は JWT から読むので、入れ子で呼んでも「いま呼んでいる本人」になる。
--   ＝ proof_hash・1日10件の上限・90日の解放・継続月数・バッジ・返り値が
--     そのまま効く。ここに同じ処理を書き写す必要はない。
-- ★ 1トランザクション。本棚入れが落ちれば claimed_at も戻る＝預かったものは消えない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.claim_pending_report(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.pay_reports_pending%rowtype;
  v_res jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if p_token is null or length(btrim(p_token)) not between 16 and 200 then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- 30日を過ぎた預かりは移さない。行は残る（データとしては数える）が、
  -- 何ヶ月も前に打った数字が、忘れた頃に本人の履歴へ入るのは事故になる。
  select * into v_row
    from public.pay_reports_pending
   where claim_token = btrim(p_token)
     and claimed_at is null
     and created_at > now() - interval '30 days'
   for update;

  -- ★見つからないのは例外にしない。二度押し・再読み込み・古い預かり証は
  --   「もう済んでいる」か「無い」だけで、利用者に見せる異常ではない。
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_res := public.submit_pay_report(v_row.payload);

  update public.pay_reports_pending
     set claimed_at = now()
   where id = v_row.id;

  -- payload も返す。Google から戻った直後はフォームが空なので、
  -- これが無いと「保存はされたのにレポートが描けない」になる。
  return v_res || jsonb_build_object('payload', v_row.payload);
end;
$$;

revoke all on function public.claim_pending_report(text) from public, anon;
grant execute on function public.claim_pending_report(text) to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 5. 自己点検（読むだけ。何も書き換えない）
--
-- ★1本の SELECT にしてある。Supabase の SQL Editor は複数文を流すと
--   最後の1本の結果しか出さないので、分けて書くと上から順に消えていく。
-- 期待：9行すべて ✅。1つでも ❌ なら、そこが効いていない。
--
-- 特に 2 と 9 は「静かに壊れる」種類のもの。ポリシーを1本足しただけで
-- 未確定の給与データが誰でも読めるようになり、置き場が公開の中央値に
-- 混ざっても画面には何も出ない（数字がずれるだけ）。
-- ════════════════════════════════════════════════════════════════
with f as (
  select to_regclass('public.pay_reports_pending')                as tbl,
         to_regclass('public.pay_benchmarks')                     as bench,
         to_regprocedure('public.submit_pay_report_pending(jsonb)') as stash,
         to_regprocedure('public.claim_pending_report(text)')       as claim,
         to_regprocedure('public.submit_pay_report(jsonb)')         as submit,
         to_regprocedure('public.pv_validate_pay_payload(jsonb)')   as valid
)
select n as "#", case when ok then '✅' else '❌' end as 結果, 見るところ
from (
  select 1 as n, '置き場のテーブルがある' as 見るところ,
         (tbl is not null) as ok from f
  union all
  select 2, '置き場は直接は誰も読めない（RLS 有効・ポリシー0本）',
         coalesce((select c.relrowsecurity from pg_class c where c.oid = f.tbl), false)
         and (select count(*) from pg_policies
               where schemaname = 'public' and tablename = 'pay_reports_pending') = 0
    from f
  union all
  select 3, '匿名で出す口がある', (stash is not null) from f
  union all
  select 4, '匿名で出す口を、まだ登録していない人が呼べる',
         case when stash is null then false
              else has_function_privilege('anon', stash, 'execute') end from f
  union all
  select 5, '本送信は今まで通り、登録していない人には開いていない',
         case when submit is null then false
              else not has_function_privilege('anon', submit, 'execute') end from f
  union all
  select 6, '紐付けの口はログインした人だけ',
         case when claim is null then false
              else has_function_privilege('authenticated', claim, 'execute')
               and not has_function_privilege('anon', claim, 'execute') end from f
  union all
  select 7, '入力の検品が1か所にまとまっている（預かりと本送信で同じ判定）',
         (valid is not null) from f
  union all
  select 8, '2つの口が security definer で動く',
         coalesce((select bool_and(p.prosecdef) from pg_proc p
                    where p.oid in (f.stash, f.claim)), false) from f
  union all
  select 9, '公開する中央値は置き場を1行も見ていない',
         case when bench is null then false
              else pg_get_viewdef(bench) not like '%pay_reports_pending%' end from f
) t
order by n;
