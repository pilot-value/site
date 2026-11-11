-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/roster.sql（2026-11-09）
--
-- マイレポートの作り直し（段1）。勤務表（ロスター）を取り込み、
-- 「働いた月」と「給与が出た月」を本人の画面でつなぐための置き場と口。
-- オーナー「働いた月（ロスター）と給与の月（明細）をつなげて、自分の給与を精密に見たい」
--         「ロスターの PDF・画像を上げられるようにする」。
--
--   表（どれも proof_hash で引く。user_id は持たない）
--     pv_roster_profile … 本人のロスターの読み方（実績か予定か・時刻の基準・勤務コードの意味）
--     pv_roster_docs    … 取り込んだ1ファイル（ファイルの指紋だけ。原本は持たない）
--     pv_roster_days    … 1日1行（勤務コード・出頭／解散の時刻）
--     pv_roster_legs    … その日の便・地上業務（空港コード・時刻・ブロック。★便名は持たない）
--     pv_roster_months  … 2年より前の月の合計（日ごとの行はまとめたら消す）
--     pv_line_map       … 明細の1行が「何か月前の勤務の分か」の本人の答え
--     pv_roster_edit_quota … 手で直した回数（人×日の数だけ。1人1日200回まで）
--     pv_roster_airline_codes … 会社ごとの勤務コードの意味（3人以上が同じ答え かつ 答えた人の過半数のものだけ・人数は持たない）
--   口（どれも security definer・本人の行だけ。my_roster_airline_codes だけは会社の辞書＝そろった答えだけ）
--     submit_roster / edit_roster_day / my_roster / my_roster_docs / delete_roster_doc /
--     set_roster_profile / set_line_map / my_report_items / my_roster_airline_codes
--
-- ★ 鍵は submit_pay_report と同じ式の proof_hash（同じ人・同じ会社なら明細の行と同じ鍵）。
--    式は pv_roster_key の1か所だけ。⚠️ submit_pay_report の式を変えたら、ここも直す（検算7が見つける）。
-- ★ 原本（画像・PDF）は保存しない。持つのはファイルの SHA-256 だけ（同じファイルの二度押しを見分ける）。
-- ★ 氏名・自由記述は1文字も入らない。どの欄も短いコードの形（英大文字・数字・記号少し）しか通さず、
--    知らないキーは組み直しで落とす。乗員の名前が載った勤務表でも、名前の入る欄が無い。
--    エラーの文にも、送られてきた値は書かない（欄の名前だけ）。
-- ★ 新しく出した勤務表は**日付で**入れ替わる（同じ日は1行だけ）。ページを分けて出しても・
--    期間が重なっても・改訂版を出し直しても、同じ日が二重に数えられない。
-- ★ 便名は保存しない（2026-11-09 オーナー了承）。日付と便名がそろうと、会社の側から本人に絞れるため。
--    送られてきても組み直しで落ちる（検品もしない）。
-- ★ 日ごとの行は2年で消す（同上）。月の頭から数えて24か月より前の月は、毎日の片づけ（pv_roster_compact）が
--    月の合計（pv_roster_months）にまとめてから、日と便を消す。月の合計に日付・空港・時刻は入らない。
-- ★ 本人は1日ずつ手で直せる・消せる（edit_roster_day・2026-11-10）。検品は submit_roster と同じ1つ（pv_roster_clean_day）。
--    在る日はその日のファイルのまま入れ替え、無い日は本人の「手で直した日」の置き場（manual = true・1人1つ）に入れる。
-- ★ 本人はいつでも消せる（delete_roster_doc ／ edit_roster_day の day=null ／ set_line_map の status=null ／ set_roster_profile の p=null）。
-- ★ 便の乗務の区分（CAP／FO など）は保存しない（2026-11-10）。勤務表に並ぶのはほかの乗員の区分だったため。
--    古い画面が送ってきても組み直しで黙って落ちる（止めない・検品もしない）。
-- ★ 勤務コードは英字の形（'^[A-Z0-9/+\-]{1,12}$'）か、読み取りが返す印（'#' ＋ 小文字の16進16字）。
--    印は印字の言葉（漢字など）の HMAC で、言葉そのものではない（このファイルは言葉を1文字も受け取らない）。
-- ★ 会社の辞書（pv_roster_airline_codes）は書き込みのときに数える（読み方の表の引き金・その会社の分だけ）。
--    読む口（my_roster_airline_codes）は表を引くだけ。⚠️ 読むたびに全員分を数え直す形にしない。
-- ★ my_pay_reports() は触らない。明細の中身（pay_items・payslip_detail）は my_report_items() が本人にだけ返す。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: db/pay-reports.sql → db/pay-edit.sql → このファイル。冪等（何度流しても同じ）。
-- ★ SQL を貼るのが先・push が後。末尾の検算が全部 ✅ になること。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.pay_reports') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports の表が無い）';
  end if;
  if to_regprocedure('public.submit_pay_report(jsonb)') is null then
    raise exception '先に db/pay-reports.sql を実行してください（submit_pay_report が無い）';
  end if;
  if to_regclass('public.pv_airlines') is null then
    raise exception '先に db/airlines.generated.sql を実行してください（pv_airlines の表が無い）';
  end if;
end $$;

-- ── 1. 表 ───────────────────────────────────────────────────
-- 読み方（本人が答える。勤務表に印字があればその通り）。1人・1社に1行。
create table if not exists public.pv_roster_profile (
  proof_hash    text primary key check (proof_hash ~ '^[0-9a-f]{64}$'),
  kind          text check (kind in ('actual', 'planned')),
  time_ref      text check (time_ref in ('local', 'utc')),
  tz            text check (tz is null or length(tz) between 1 and 40),
  time_meaning  text check (time_meaning in ('block', 'flight', 'other')),
  -- 勤務コード → 意味（'OFF1' → 'off' など）。形は set_roster_profile が検品する。
  codes         jsonb not null default '{}'::jsonb check (jsonb_typeof(codes) = 'object'),
  share_company boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- 何も書いていない日の意味（2026-11-10）。'off' = 休み ／ 'none' = 何も決まっていない ／ null = まだ答えていない。
alter table public.pv_roster_profile add column if not exists blank text;
alter table public.pv_roster_profile drop constraint if exists pv_roster_profile_blank_check;
alter table public.pv_roster_profile add constraint pv_roster_profile_blank_check
  check (blank is null or blank in ('off', 'none'));
-- ★2026-11-11 スケジュールで飛んだ分が何か月あとの給与明細に出るか（オーナー「どの月がどの明細に紐づくかわかんないじゃん？
--   自動でわかるといいけど、そうでない場合は勤務表アップロードした時点で最初にユーザーに聞いて」）。
--   0 = 同じ月 ／ 1 = 翌月 ／ 2 = 翌々月 ／ -1 = 本人が「わからない」と答えた ／ null = まだ聞いていない。
alter table public.pv_roster_profile add column if not exists pay_lag smallint;
alter table public.pv_roster_profile drop constraint if exists pv_roster_profile_pay_lag_check;
alter table public.pv_roster_profile add constraint pv_roster_profile_pay_lag_check
  check (pay_lag is null or pay_lag between -1 and 2);
-- この読み方がどの会社のものか（一覧の会社コード。「一覧にない会社」は null）。会社の辞書を会社ごとに数えるためだけに持つ。
-- set_roster_profile が書くたびに入れる。前に貼った版の行は、下の「9-c」で鍵から当て直す。
-- ★会員 × 一覧の全社の鍵を作って当てる重い当て直しは、この列を初めて足す貼り付けの1回だけ（印を立てて 9-c が見る）。
do $mark$
begin
  if not exists (select 1 from pg_attribute a
                  where a.attrelid = 'public.pv_roster_profile'::regclass and a.attname = 'airline'
                    and a.attnum > 0 and not a.attisdropped) then
    perform set_config('pv.roster_airline_fill', '1', false);
  end if;
end
$mark$;
alter table public.pv_roster_profile add column if not exists airline text;
create index if not exists pv_roster_profile_airline on public.pv_roster_profile (airline);

-- 取り込んだ1ファイル。★原本は持たない（指紋・ページ数・日付の幅・日数だけ）。
create table if not exists public.pv_roster_docs (
  id         uuid primary key default gen_random_uuid(),
  proof_hash text not null check (proof_hash ~ '^[0-9a-f]{64}$'),
  file_sha   text not null check (file_sha ~ '^[0-9a-f]{64}$'),
  pages      int  not null check (pages between 1 and 60),
  date_from  date,
  date_to    date,
  days       int  not null default 0 check (days between 0 and 62),
  created_at timestamptz not null default now(),
  unique (proof_hash, file_sha)
);
create index if not exists pv_roster_docs_hash_created on public.pv_roster_docs (proof_hash, created_at);

-- 手で直した日の置き場（edit_roster_day が作る・1人1社に1つ）。指紋は 'manual::' ＋ 鍵 の SHA-256（同じ人なら必ず同じ＝1つ）。
alter table public.pv_roster_docs add column if not exists manual boolean not null default false;
-- 置き場の日数は「いま持っている日数」で、窓（±400日）と2年の片づけの間に 62 を超えうる。置き場だけ上を外す。
alter table public.pv_roster_docs drop constraint if exists pv_roster_docs_days_check;
alter table public.pv_roster_docs add constraint pv_roster_docs_days_check
  check (days >= 0 and (days <= 62 or manual));

-- 1日1行。★主キーが (proof_hash, duty_date) ＝ 同じ人・同じ日は1行しか在り得ない（二重に数えない）。
create table if not exists public.pv_roster_days (
  proof_hash text not null,
  duty_date  date not null,
  doc_id     uuid not null references public.pv_roster_docs(id) on delete cascade,
  code       text check (code is null or code ~ '^([A-Z0-9/+\-]{1,12}|#[0-9a-f]{16})$'),
  d_on       time,
  d_off      time,
  d_off_day  smallint not null default 0 check (d_off_day between 0 and 2),
  page       smallint check (page between 1 and 60),
  "row"      smallint check ("row" between 1 and 999),
  primary key (proof_hash, duty_date)
);
create index if not exists pv_roster_days_doc on public.pv_roster_days (doc_id);
-- 勤務コードは英字の形か、読み取りの印（'#' ＋ 小文字の16進16字）。前に貼った版の決まり（英字だけ）を置き換える。
alter table public.pv_roster_days drop constraint if exists pv_roster_days_code_check;
alter table public.pv_roster_days add constraint pv_roster_days_code_check
  check (code is null or code ~ '^([A-Z0-9/+\-]{1,12}|#[0-9a-f]{16})$');

-- その日の便・地上業務。日が消えれば一緒に消える。
create table if not exists public.pv_roster_legs (
  proof_hash text not null,
  duty_date  date not null,
  seq        smallint not null check (seq between 1 and 16),
  orig       text check (orig is null or orig ~ '^[A-Z0-9]{3,4}$'),
  dest       text check (dest is null or dest ~ '^[A-Z0-9]{3,4}$'),
  loc        text check (loc is null or loc ~ '^[A-Z0-9]{2,8}$'),
  t_out      time,
  t_in       time,
  in_day     smallint not null default 0 check (in_day between 0 and 2),
  block_min  int check (block_min between 0 and 1440),
  kind       text not null default 'unknown' check (kind in ('operating', 'deadhead', 'ground', 'unknown')),
  page       smallint check (page between 1 and 60),
  "row"      smallint check ("row" between 1 and 999),
  -- ★地上業務に空港を入れない（場所は loc）。
  check (kind <> 'ground' or (orig is null and dest is null)),
  primary key (proof_hash, duty_date, seq),
  foreign key (proof_hash, duty_date)
    references public.pv_roster_days(proof_hash, duty_date) on delete cascade
);

-- ★便名は持たない。前に貼った版に列が残っていれば外す（何度流しても同じ）。
alter table public.pv_roster_legs drop column if exists flight;
-- ★乗務の区分（CAP／FO など）も持たない（2026-11-10）。勤務表の区分は、ほかの乗員のものだった。前の版の列を外す。
alter table public.pv_roster_legs drop column if exists role_raw;
alter table public.pv_roster_legs drop column if exists role;

-- 2年より前の月の合計（pv_roster_compact が日ごとの行から作り、そのあと日と便を消す）。1人・1社・1か月に1行。
-- ★日付・空港・時刻・便名は入らない。勤務コードごとに日数と時間を足しただけ。
--   groups = [{code, days, duty_days, timed_days, duty_min,
--              legs:{operating|deadhead|ground|unknown:{n, block_min, gaps}}}]（code は印字のまま・無ければ null）
--   コードの意味（休み・休暇など）は後から読み方（codes）で当てる ＝ 本人が意味を直しても合計は作り直さずに済む。
create table if not exists public.pv_roster_months (
  proof_hash   text not null check (proof_hash ~ '^[0-9a-f]{64}$'),
  ym           date not null check (extract(day from ym) = 1),
  covered_days smallint not null check (covered_days between 1 and 31),
  time_basis   text not null check (time_basis in ('utc', 'tz', 'clock')),
  groups       jsonb not null check (jsonb_typeof(groups) = 'array'),
  compacted_at timestamptz not null default now(),
  primary key (proof_hash, ym)
);

-- 明細の1行（label_key）が何か月ずれた勤務の分か。month_offset: 0 = 明細と同じ月・-1 = 前の月。
-- ★列の名前は month_offset（offset は予約語）。画面へは 'offset' のキーで返す。
create table if not exists public.pv_line_map (
  proof_hash   text not null check (proof_hash ~ '^[0-9a-f]{64}$'),
  label_key    text not null check (length(label_key) between 1 and 80),
  month_offset smallint check (month_offset between -12 and 1),
  status       text not null check (status in ('confirmed', 'unknown', 'other')),
  qty_kind     text check (qty_kind is null or qty_kind ~ '^[a-z][a-z0-9_]{0,23}$'),
  updated_at   timestamptz not null default now(),
  primary key (proof_hash, label_key)
);

-- 手で直した回数（edit_roster_day の1人1日200回まで）。★人×日の数だけ。どの日をどう直したかは持たない。
-- 前の日の行は、その人が次に直すときに消す（1人1行より増えない）。
create table if not exists public.pv_roster_edit_quota (
  proof_hash text not null check (proof_hash ~ '^[0-9a-f]{64}$'),
  day        date not null,
  n          int  not null default 0 check (n between 0 and 100000),
  primary key (proof_hash, day)
);

-- 会社の辞書（2026-11-10）。同じ会社の会員の読み方から、そろった答えだけを置く（作るのは pv_roster_airline_recount だけ）。
--   key … 勤務コード（英字の形）か読み取りの印（'#'＋16進16字）か、特別なキー '@kind' / '@time_ref' / '@time_meaning' / '@blank'
--   ★人数・誰が答えたかは持たない。そろわなくなった答えは数え直しで消える。
create table if not exists public.pv_roster_airline_codes (
  airline    text not null check (length(airline) between 1 and 80),
  key        text not null check (key ~ '^([A-Z0-9/+\-]{1,12}|#[0-9a-f]{16})$'
                                  or key in ('@kind', '@time_ref', '@time_meaning', '@blank')),
  meaning    text not null check (length(meaning) between 1 and 16),
  updated_at timestamptz not null default now(),
  primary key (airline, key)
);

-- 動作確認用のテストアカウント（db/member-median.sql と同じ表・同じ形）。会社の辞書から外すために読む。
-- 中身はオーナーが SQL Editor で入れる（リポジトリに uid を書かない）。このファイルが先に流れても困らないよう、ここでも作る。
create table if not exists public.pv_test_users (
  uid uuid primary key
);
alter table public.pv_test_users enable row level security;
revoke all on table public.pv_test_users from public, anon, authenticated;

-- ★誰も直接は読めない・書けない。本人の口（下の security definer）からだけ。
alter table public.pv_roster_profile enable row level security;
alter table public.pv_roster_docs    enable row level security;
alter table public.pv_roster_days    enable row level security;
alter table public.pv_roster_legs    enable row level security;
alter table public.pv_line_map       enable row level security;
alter table public.pv_roster_months  enable row level security;
alter table public.pv_roster_edit_quota enable row level security;
alter table public.pv_roster_airline_codes enable row level security;
revoke all on table public.pv_roster_profile from public, anon, authenticated;
revoke all on table public.pv_roster_docs    from public, anon, authenticated;
revoke all on table public.pv_roster_days    from public, anon, authenticated;
revoke all on table public.pv_roster_legs    from public, anon, authenticated;
revoke all on table public.pv_line_map       from public, anon, authenticated;
revoke all on table public.pv_roster_months  from public, anon, authenticated;
revoke all on table public.pv_roster_edit_quota from public, anon, authenticated;
revoke all on table public.pv_roster_airline_codes from public, anon, authenticated;

-- ── 2. 内部の道具（誰からも直接は呼べない）───────────────────────
-- 本人の鍵。★submit_pay_report と1文字も違わない式（検算7が両方の本文を突き合わせる）。
-- 会社が不正なら null（呼ぶ側が止める）。名簿から外した会社も、読むためには通す。
create or replace function public.pv_roster_key(p_uid uuid, p_airline text, p_airline_other text)
returns text
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_uid     uuid := p_uid;
  v_airline text := nullif(btrim(p_airline), '');
  v_other   text := nullif(btrim(p_airline_other), '');
begin
  if v_uid is null or v_airline is null then
    return null;
  end if;
  if v_airline = 'other' then
    if v_other is null or length(v_other) > 80 then
      return null;
    end if;
  else
    v_other := null;   -- 一覧から選んだのに自由入力が残っていたら捨てる（submit_pay_report と同じ）
    if not exists (select 1 from public.pv_airlines where code = v_airline) then
      return null;
    end if;
  end if;
  return encode(
    extensions.digest(
      v_uid::text || '::pv_pay::' || v_airline || coalesce('::' || lower(v_other), ''),
      'sha256'),
    'hex');
end;
$$;

-- 文字列の欄を1つ読む。無い・null・'' は null。文字列でない／形が合わない → 止める（値は文に書かない）。
create or replace function public.pv_roster_txt(j jsonb, k text, re text, what text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  v jsonb := j -> k;
  s text;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    return null;
  end if;
  if jsonb_typeof(v) <> 'string' then
    raise exception 'ロスターの%が不正です', what using errcode = '22023';
  end if;
  s := v #>> '{}';
  if s = '' then
    return null;
  end if;
  if s !~ re then
    raise exception 'ロスターの%が不正です', what using errcode = '22023';
  end if;
  return s;
end;
$$;

-- 整数の欄を1つ読む。無い・null は null。整数でない／範囲の外 → 止める。
create or replace function public.pv_roster_int(j jsonb, k text, lo int, hi int, what text)
returns int
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  v jsonb := j -> k;
  n int;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    return null;
  end if;
  if jsonb_typeof(v) <> 'number' or v::text !~ '^[0-9]{1,4}$' then
    raise exception 'ロスターの%が不正です', what using errcode = '22023';
  end if;
  n := v::text::int;
  if n < lo or n > hi then
    raise exception 'ロスターの%が範囲の外です', what using errcode = '22023';
  end if;
  return n;
end;
$$;

-- 日付の欄を1つ読む（'YYYY-MM-DD'）。在り得ない日（2月30日など）も止める。
create or replace function public.pv_roster_date(j jsonb, k text, what text)
returns date
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  s text := public.pv_roster_txt(j, k, '^[0-9]{4}-[0-9]{2}-[0-9]{2}$', what);
begin
  if s is null then
    return null;
  end if;
  begin
    return s::date;
  exception when others then
    raise exception 'ロスターの%が不正です', what using errcode = '22023';
  end;
end;
$$;

-- 本人の読み方を画面へ返す形（無ければ null）。
create or replace function public.pv_roster_profile_json(p_hash text)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
           'kind', r.kind, 'time_ref', r.time_ref, 'tz', r.tz,
           'time_meaning', r.time_meaning, 'codes', r.codes, 'blank', r.blank, 'pay_lag', r.pay_lag,
           'share_company', r.share_company, 'updated_at', r.updated_at)
    from public.pv_roster_profile r
   where r.proof_hash = p_hash
$$;

-- 1日を検品して組み直す。★submit_roster と edit_roster_day が同じこれを呼ぶ（決まりは1か所・検算14）。
-- 日付は見ない（呼ぶ側が決める）。知らないキーはここで落ちる。
-- p_pages が null（手で直した日）のときは page・row を読まずに null にする（どのページの何行目でもないため）。
-- 勤務コードは英字の形か読み取りの印（'#'＋小文字の16進16字）。★便の乗務の区分（role）は読まない（送られてきても黙って落ちる）。
-- 返す: {code, d_on, d_off, d_off_day, page, row, legs:[{seq, from, to, loc, out, in, in_day, block_min, kind, page, row}]}
create or replace function public.pv_roster_clean_day(p_d jsonb, p_pages int)
returns jsonb
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  v_l    jsonb;
  v_seqs int[] := '{}';
  v_seq  int;
  v_kind text;
  v_orig text;
  v_dest text;
  v_blk  text;
  v_bmin int;
  v_legs jsonb := '[]'::jsonb;
  c_code constant text := '^([A-Z0-9/+\-]{1,12}|#[0-9a-f]{16})$';
  c_hhmm constant text := '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$';
begin
  if p_d is null or jsonb_typeof(p_d) <> 'object' then
    raise exception 'ロスターの日の形が不正です' using errcode = '22023';
  end if;

  if jsonb_typeof(p_d->'legs') is not null and jsonb_typeof(p_d->'legs') <> 'null' then
    if jsonb_typeof(p_d->'legs') <> 'array' then
      raise exception 'ロスターの便の形が不正です' using errcode = '22023';
    end if;
    if jsonb_array_length(p_d->'legs') > 16 then
      raise exception 'ロスターの1日の便が多すぎます（16まで）' using errcode = '54000';
    end if;
    for v_l in select e from jsonb_array_elements(p_d->'legs') as t(e) loop
      if jsonb_typeof(v_l) <> 'object' then
        raise exception 'ロスターの便の形が不正です' using errcode = '22023';
      end if;
      v_seq := public.pv_roster_int(v_l, 'seq', 1, 16, '便の順番');
      if v_seq is null or v_seq = any (v_seqs) then
        raise exception 'ロスターの便の順番が不正です' using errcode = '22023';
      end if;
      v_seqs := v_seqs || v_seq;

      v_kind := coalesce(public.pv_roster_txt(v_l, 'kind', '^(operating|deadhead|ground|unknown)$', '便の種類'), 'unknown');
      v_orig := public.pv_roster_txt(v_l, 'from', '^[A-Z0-9]{3,4}$', '出発地');
      v_dest := public.pv_roster_txt(v_l, 'to',   '^[A-Z0-9]{3,4}$', '到着地');
      if v_kind = 'ground' then
        v_orig := null;   -- ★地上業務に空港を作らない（場所は loc だけ）
        v_dest := null;
      end if;
      v_blk := public.pv_roster_txt(v_l, 'block', '^[0-9]{1,2}:[0-5][0-9]$', 'ブロック時間');
      v_bmin := case when v_blk is null then null
                     else split_part(v_blk, ':', 1)::int * 60 + split_part(v_blk, ':', 2)::int end;
      if v_bmin > 1440 then
        raise exception 'ロスターのブロック時間が範囲の外です' using errcode = '22023';
      end if;

      -- ★便名と乗務の区分は組み直しに入れない（送られてきても落ちる・検品もしない）
      v_legs := v_legs || jsonb_build_object(
        'seq',       v_seq,
        'from',      v_orig,
        'to',        v_dest,
        'loc',       public.pv_roster_txt(v_l, 'loc', '^[A-Z0-9]{2,8}$', '場所'),
        'out',       public.pv_roster_txt(v_l, 'out', c_hhmm, '出発時刻'),
        'in',        public.pv_roster_txt(v_l, 'in',  c_hhmm, '到着時刻'),
        'in_day',    coalesce(public.pv_roster_int(v_l, 'in_day', 0, 2, '到着の日'), 0),
        'block_min', v_bmin,
        'kind',      v_kind,
        'page',      case when p_pages is null then null else public.pv_roster_int(v_l, 'page', 1, p_pages, 'ページ') end,
        'row',       case when p_pages is null then null else public.pv_roster_int(v_l, 'row', 1, 999, '行') end);
    end loop;
  end if;

  return jsonb_build_object(
    'code',      public.pv_roster_txt(p_d, 'code',  c_code, '勤務コード'),
    'd_on',      public.pv_roster_txt(p_d, 'd_on',  c_hhmm, '出頭時刻'),
    'd_off',     public.pv_roster_txt(p_d, 'd_off', c_hhmm, '解散時刻'),
    'd_off_day', coalesce(public.pv_roster_int(p_d, 'd_off_day', 0, 2, '解散の日'), 0),
    'page',      case when p_pages is null then null else public.pv_roster_int(p_d, 'page', 1, p_pages, 'ページ') end,
    'row',       case when p_pages is null then null else public.pv_roster_int(p_d, 'row', 1, 999, '行') end,
    'legs',      v_legs);
end;
$$;

revoke all on function public.pv_roster_key(uuid, text, text)                    from public, anon, authenticated;
revoke all on function public.pv_roster_clean_day(jsonb, int)                    from public, anon, authenticated;
revoke all on function public.pv_roster_txt(jsonb, text, text, text)             from public, anon, authenticated;
revoke all on function public.pv_roster_int(jsonb, text, int, int, text)         from public, anon, authenticated;
revoke all on function public.pv_roster_date(jsonb, text, text)                  from public, anon, authenticated;
revoke all on function public.pv_roster_profile_json(text)                       from public, anon, authenticated;

-- ── 3. 勤務表を出す ───────────────────────────────────────────
-- p = { airline, airline_other, file_sha, pages, period:{from,to}|null, days:[...] }
-- 返す: {ok, dup:false, doc_id, days, legs, replaced} ／ 同じファイルの二度目は {ok, dup:true, doc_id}
create or replace function public.submit_roster(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid      uuid := auth.uid();
  v_airline  text;
  v_other    text;
  v_key      text;
  v_sha      text;
  v_pages    int;
  v_pfrom    date;
  v_pto      date;
  v_doc      uuid;
  v_d        jsonb;
  v_date     date;
  v_dates    date[] := '{}';
  v_clean    jsonb := '[]'::jsonb;
  v_today    int;
  v_replaced int;
  v_nlegs    int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'ロスターの形が不正です' using errcode = '22023';
  end if;
  if octet_length(p::text) > 400 * 1024 then
    raise exception 'ロスターが大きすぎます' using errcode = '54000';
  end if;

  -- 会社（submit_pay_report と同じ決まり）
  v_airline := nullif(btrim(p->>'airline'), '');
  v_other   := nullif(btrim(p->>'airline_other'), '');
  if v_airline is null then
    raise exception '会社が選ばれていません' using errcode = '22023';
  end if;
  if v_airline = 'other' then
    if v_other is null or length(v_other) > 80 then
      raise exception '「一覧にない会社」を選んだ場合は社名の入力が必要です' using errcode = '22023';
    end if;
  elsif not exists (select 1 from public.pv_airlines where code = v_airline and active) then
    raise exception '会社コードが不正です' using errcode = '22023';
  end if;
  v_key := public.pv_roster_key(v_uid, v_airline, v_other);
  if v_key is null then
    raise exception '会社コードが不正です' using errcode = '22023';
  end if;

  v_sha   := public.pv_roster_txt(p, 'file_sha', '^[0-9a-f]{64}$', 'ファイルの指紋');
  v_pages := public.pv_roster_int(p, 'pages', 1, 60, 'ページ数');
  if v_sha is null or v_pages is null then
    raise exception 'ロスターのファイルの指紋かページ数がありません' using errcode = '22023';
  end if;

  -- 勤務表の見出しの期間（印字があれば）。形と幅だけ見る（保存はしない ── 日付の幅は実際の日から取る）。
  if p ? 'period' and jsonb_typeof(p->'period') <> 'null' then
    if jsonb_typeof(p->'period') <> 'object' then
      raise exception 'ロスターの期間が不正です' using errcode = '22023';
    end if;
    v_pfrom := public.pv_roster_date(p->'period', 'from', '期間');
    v_pto   := public.pv_roster_date(p->'period', 'to', '期間');
    if v_pfrom is null or v_pto is null or v_pto < v_pfrom or v_pto - v_pfrom > 62
       or v_pfrom < current_date - 400 or v_pto > current_date + 400 then
      raise exception 'ロスターの期間が不正です' using errcode = '22023';
    end if;
  end if;

  if jsonb_typeof(p->'days') is distinct from 'array'
     or jsonb_array_length(p->'days') = 0 then
    raise exception 'ロスターに日が1日もありません' using errcode = '22023';
  end if;
  if jsonb_array_length(p->'days') > 62 then
    raise exception 'ロスターの日数が多すぎます（1回62日まで）' using errcode = '54000';
  end if;

  -- ── 1日ずつ検品して組み直す（知らないキーはここで落ちる・決まりは pv_roster_clean_day の1か所）──
  for v_d in select e from jsonb_array_elements(p->'days') as t(e) loop
    if jsonb_typeof(v_d) <> 'object' then
      raise exception 'ロスターの日の形が不正です' using errcode = '22023';
    end if;
    v_date := public.pv_roster_date(v_d, 'date', '日付');
    if v_date is null then
      raise exception 'ロスターの日付がありません' using errcode = '22023';
    end if;
    if v_date < current_date - 400 or v_date > current_date + 400 then
      raise exception 'ロスターの日付が範囲の外です' using errcode = '22023';
    end if;
    if v_date = any (v_dates) then
      raise exception 'ロスターに同じ日付が2回あります' using errcode = '22023';
    end if;
    v_dates := v_dates || v_date;

    -- 便と日の欄は pv_roster_clean_day（edit_roster_day と同じ1つ）。日付は上で決めたもの。
    v_clean := v_clean || (jsonb_build_object('date', v_date) || public.pv_roster_clean_day(v_d, v_pages));
  end loop;

  -- ── 書く（同じ人の提出は1本ずつ順番に）──
  perform pg_advisory_xact_lock(20261109, hashtext(v_key));

  -- 同じファイルの二度目は何もしない
  select d.id into v_doc
    from public.pv_roster_docs d
   where d.proof_hash = v_key and d.file_sha = v_sha;
  if found then
    return jsonb_build_object('ok', true, 'dup', true, 'doc_id', v_doc);
  end if;

  select count(*) into v_today
    from public.pv_roster_docs d
   where d.proof_hash = v_key and d.created_at >= date_trunc('day', now()) and not d.manual;
  if v_today >= 30 then
    raise exception '1日に取り込める勤務表の上限に達しました。明日また続きをどうぞ。' using errcode = '54000';
  end if;

  insert into public.pv_roster_docs (proof_hash, file_sha, pages, date_from, date_to, days)
  values (v_key, v_sha, v_pages,
          (select min(x) from unnest(v_dates) x), (select max(x) from unnest(v_dates) x),
          cardinality(v_dates))
  returning id into v_doc;

  -- ★日付で入れ替える。同じ日の古い行（とその便）を消してから入れる＝二重に数えない。
  delete from public.pv_roster_days t
   where t.proof_hash = v_key and t.duty_date = any (v_dates);
  get diagnostics v_replaced = row_count;

  insert into public.pv_roster_days (proof_hash, duty_date, doc_id, code, d_on, d_off, d_off_day, page, "row")
  select v_key, (e->>'date')::date, v_doc, e->>'code',
         (e->>'d_on')::time, (e->>'d_off')::time, (e->>'d_off_day')::smallint,
         (e->>'page')::smallint, (e->>'row')::smallint
    from jsonb_array_elements(v_clean) as t(e);

  insert into public.pv_roster_legs (proof_hash, duty_date, seq, orig, dest, loc,
                                     t_out, t_in, in_day, block_min, kind, page, "row")
  select v_key, (e->>'date')::date, (l->>'seq')::smallint, l->>'from', l->>'to', l->>'loc',
         (l->>'out')::time, (l->>'in')::time, (l->>'in_day')::smallint, (l->>'block_min')::int,
         l->>'kind', (l->>'page')::smallint, (l->>'row')::smallint
    from jsonb_array_elements(v_clean) as t(e),
         jsonb_array_elements(e->'legs') as u(l);
  get diagnostics v_nlegs = row_count;

  return jsonb_build_object('ok', true, 'dup', false, 'doc_id', v_doc,
                            'days', cardinality(v_dates), 'legs', v_nlegs, 'replaced', v_replaced);
end;
$$;

-- ── 3-b. 1日を手で直す・消す（2026-11-10）──────────────────────────
-- 確かめの画面・勤務ロスターのタブで、本人が1日だけ直す（読み違い・載っていなかった日・読めなかった記号の日）。
-- p = { date:'YYYY-MM-DD',
--       day:{code, d_on, d_off, d_off_day, legs:[{seq, from, to, loc, out, in, in_day, block, kind}]} | null }
--   ・検品は submit_roster と同じ1つ（pv_roster_clean_day）。便名・乗務の区分・知らないキーは落ちる。page・row は持たない（null）。
--   ・日付は今日から ±400日の中で、かつ月の合計にまとめた期間（24か月前の月の頭より前）でないこと。
--     ★まとめた月に日の行を足すと、月の合計と日の行で二重に数える。今は ±400日 のほうが狭いが、
--       窓を広げたときにも破れないよう、境目は pv_roster_compact と同じ式で別に見る（検算15）。
--   ・day = null → その日を消す（便も一緒に）。
--   ・その日が在れば、その日のファイル（doc_id）のまま入れ替える。無ければ本人の「手で直した日」の置き場
--     （manual = true の1つ。無ければ作る）に入れ、置き場の日付の幅を広げ、日数を数え直す。
--   ・1人1日200回まで（消すのも1回。検品で止まった呼び出しは数えない）。数えるのは pv_roster_edit_quota の 人×日 の1行だけ。
-- 返す: {ok, date, legs}（入れた便の数） ／ 消したとき {ok, date, deleted:true}（もともと無い日でも true ＝ その日はもう無い）
create or replace function public.edit_roster_day(p_airline text, p_airline_other text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_key   text;
  v_cut   date := (date_trunc('month', current_date) - interval '24 months')::date;
  v_date  date;
  v_clean jsonb;
  v_doc   uuid;
  v_msha  text;
  v_used  int;
  v_nlegs int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  v_key := public.pv_roster_key(v_uid, p_airline, p_airline_other);
  if v_key is null then
    raise exception '会社コードが不正です' using errcode = '22023';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' or not (p ? 'day') then
    raise exception 'ロスターの形が不正です' using errcode = '22023';
  end if;
  if octet_length(p::text) > 32 * 1024 then
    raise exception 'ロスターが大きすぎます' using errcode = '54000';
  end if;

  v_date := public.pv_roster_date(p, 'date', '日付');
  if v_date is null then
    raise exception 'ロスターの日付がありません' using errcode = '22023';
  end if;
  -- ★月の合計にまとめた期間の日は受け付けない（境目は pv_roster_compact と同じ「24か月前の月の頭」）
  if v_date < v_cut then
    raise exception 'ロスターの日付が2年より前です（月の合計にまとめた期間は直せません）' using errcode = '22023';
  end if;
  if v_date < current_date - 400 or v_date > current_date + 400 then
    raise exception 'ロスターの日付が範囲の外です' using errcode = '22023';
  end if;
  -- 1日の中身は submit_roster と同じ検品（日付は上で決めたもの・page と row は読まない）
  if jsonb_typeof(p->'day') <> 'null' then
    v_clean := public.pv_roster_clean_day(p->'day', null);
  end if;

  -- ── 書く（同じ人の書き込みは1本ずつ順番に。submit_roster と同じ錠）──
  perform pg_advisory_xact_lock(20261109, hashtext(v_key));

  -- 1人1日200回まで（前の日の行は消す＝1人1行より増えない）
  delete from public.pv_roster_edit_quota q where q.proof_hash = v_key and q.day < current_date;
  select q.n into v_used from public.pv_roster_edit_quota q where q.proof_hash = v_key and q.day = current_date;
  if coalesce(v_used, 0) >= 200 then
    raise exception '1日に手で直せる回数の上限に達しました。明日また続きをどうぞ。' using errcode = '54000';
  end if;
  insert into public.pv_roster_edit_quota as q (proof_hash, day, n)
  values (v_key, current_date, 1)
  on conflict (proof_hash, day) do update set n = q.n + 1;

  -- その日をいま持っているファイル（無ければ null）
  select d.doc_id into v_doc
    from public.pv_roster_days d
   where d.proof_hash = v_key and d.duty_date = v_date;

  if v_clean is null then
    -- 消す（便は外部キーで一緒に消える）。手で直した日の置き場の日数は数え直す。
    delete from public.pv_roster_days t where t.proof_hash = v_key and t.duty_date = v_date;
    update public.pv_roster_docs f
       set days = (select count(*) from public.pv_roster_days x where x.doc_id = f.id)
     where f.id = v_doc and f.manual;
    return jsonb_build_object('ok', true, 'date', v_date, 'deleted', true);
  end if;

  if v_doc is null then
    -- 無い日は本人の「手で直した日」の置き場へ（1人1社に1つ。無ければ作る）
    v_msha := encode(extensions.digest('manual::' || v_key, 'sha256'), 'hex');
    select f.id into v_doc
      from public.pv_roster_docs f
     where f.proof_hash = v_key and f.file_sha = v_msha;
    if v_doc is null then
      insert into public.pv_roster_docs (proof_hash, file_sha, pages, date_from, date_to, days, manual)
      values (v_key, v_msha, 1, v_date, v_date, 0, true)
      returning id into v_doc;
    end if;
  end if;

  -- ★その日だけ入れ替える（古い行と便を消してから入れる）
  delete from public.pv_roster_days t where t.proof_hash = v_key and t.duty_date = v_date;

  insert into public.pv_roster_days (proof_hash, duty_date, doc_id, code, d_on, d_off, d_off_day, page, "row")
  values (v_key, v_date, v_doc, v_clean->>'code',
          (v_clean->>'d_on')::time, (v_clean->>'d_off')::time, (v_clean->>'d_off_day')::smallint,
          null, null);

  insert into public.pv_roster_legs (proof_hash, duty_date, seq, orig, dest, loc,
                                     t_out, t_in, in_day, block_min, kind, page, "row")
  select v_key, v_date, (l->>'seq')::smallint, l->>'from', l->>'to', l->>'loc',
         (l->>'out')::time, (l->>'in')::time, (l->>'in_day')::smallint, (l->>'block_min')::int,
         l->>'kind', null, null
    from jsonb_array_elements(v_clean->'legs') as u(l);
  get diagnostics v_nlegs = row_count;

  -- 手で直した日の置き場なら、日付の幅を広げて日数を数え直す（取り込んだファイルの記録は変えない）
  update public.pv_roster_docs f
     set date_from = least(f.date_from, v_date),
         date_to   = greatest(f.date_to, v_date),
         days      = (select count(*) from public.pv_roster_days x where x.doc_id = f.id)
   where f.id = v_doc and f.manual;

  return jsonb_build_object('ok', true, 'date', v_date, 'legs', v_nlegs);
end;
$$;

-- ── 4. 本人の勤務表を読む ───────────────────────────────────────
-- 返す: {ok, profile:{...}|null, days:[{date, code, d_on, d_off, d_off_day, doc_id, page, row,
--                                    legs:[{seq, from, to, loc, out, in, in_day, block, block_min, kind, page, row}]}]}
--   ★便の乗務の区分（role）は返さない（持っていない）。
-- 期間は最大400日。空なら p_to = 今日＋62日・p_from = p_to − 399日。
create or replace function public.my_roster(
  p_airline text, p_airline_other text, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid  uuid := auth.uid();
  v_key  text;
  v_to   date;
  v_from date;
  v_days jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  v_key := public.pv_roster_key(v_uid, p_airline, p_airline_other);
  if v_key is null then
    raise exception '会社コードが不正です' using errcode = '22023';
  end if;
  v_to   := coalesce(p_to, current_date + 62);
  v_from := coalesce(p_from, v_to - 399);
  if v_to < v_from or v_to - v_from > 400 then
    raise exception '期間が不正です（400日まで）' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'date',      d.duty_date,
           'code',      d.code,
           'd_on',      to_char(d.d_on, 'HH24:MI'),
           'd_off',     to_char(d.d_off, 'HH24:MI'),
           'd_off_day', d.d_off_day,
           'doc_id',    d.doc_id,
           'page',      d.page,
           'row',       d."row",
           'legs', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'seq',       l.seq,
                      'from',      l.orig,
                      'to',        l.dest,
                      'loc',       l.loc,
                      'out',       to_char(l.t_out, 'HH24:MI'),
                      'in',        to_char(l.t_in, 'HH24:MI'),
                      'in_day',    l.in_day,
                      'block',     case when l.block_min is null then null
                                        else (l.block_min / 60)::text || ':' || lpad((l.block_min % 60)::text, 2, '0') end,
                      'block_min', l.block_min,
                      'kind',      l.kind,
                      'page',      l.page,
                      'row',       l."row") order by l.seq)
               from public.pv_roster_legs l
              where l.proof_hash = d.proof_hash and l.duty_date = d.duty_date), '[]'::jsonb)
         ) order by d.duty_date), '[]'::jsonb)
    into v_days
    from public.pv_roster_days d
   where d.proof_hash = v_key
     and d.duty_date between v_from and v_to;

  return jsonb_build_object('ok', true,
                            'profile', public.pv_roster_profile_json(v_key),
                            'days', v_days);
end;
$$;

-- ── 5. 本人が取り込んだファイルの一覧 ─────────────────────────────
-- 返す: {ok, docs:[{id, file_sha, pages, date_from, date_to, days, days_owned, manual, created_at}]}（新しい順）
--   days = 取り込んだときの日数 ／ days_owned = いまもこのファイルが持っている日数（後の提出に入れ替わった日は数えない）
--   manual = true は「手で直した日」の置き場（edit_roster_day が作る・1人1社に1つ。days は最後に直したときの日数・
--            date_from〜date_to は直した日の幅）。delete_roster_doc でほかのファイルと同じように消せる。
create or replace function public.my_roster_docs(p_airline text, p_airline_other text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid  uuid := auth.uid();
  v_key  text;
  v_docs jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  v_key := public.pv_roster_key(v_uid, p_airline, p_airline_other);
  if v_key is null then
    raise exception '会社コードが不正です' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',         d.id,
           'file_sha',   d.file_sha,
           'pages',      d.pages,
           'date_from',  d.date_from,
           'date_to',    d.date_to,
           'days',       d.days,
           'days_owned', (select count(*) from public.pv_roster_days x where x.doc_id = d.id),
           'manual',     d.manual,
           'created_at', d.created_at
         ) order by d.created_at desc, d.id), '[]'::jsonb)
    into v_docs
    from public.pv_roster_docs d
   where d.proof_hash = v_key;

  return jsonb_build_object('ok', true, 'docs', v_docs);
end;
$$;

-- ── 6. 取り込んだファイルを消す ─────────────────────────────────
-- そのファイルと、いまもそのファイルが持っている日（と便）を消す。後の提出に入れ替わった日は残る。
-- 本人のファイルでなければ何もしない（在る・無いも言わない）。
-- p_airline は省略できるが、「一覧にない会社」の勤務表は p_airline='other' と社名を渡さないと見つからない
-- （ロスターの表は社名を持たないため。給与を出している「その他」の会社なら省略しても見つかる）。
-- 返す: {ok, deleted, days}
create or replace function public.delete_roster_doc(
  p_doc_id uuid, p_airline text default null, p_airline_other text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid  uuid := auth.uid();
  v_hash text;
  v_from date;
  v_to   date;
  v_own  boolean;
  v_n    int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if p_doc_id is null then
    return jsonb_build_object('ok', true, 'deleted', false, 'days', 0);
  end if;

  select d.proof_hash, d.date_from, d.date_to into v_hash, v_from, v_to
    from public.pv_roster_docs d where d.id = p_doc_id;
  if not found then
    return jsonb_build_object('ok', true, 'deleted', false, 'days', 0);
  end if;

  -- 本人の鍵か（渡された会社 → 一覧の全社 → 給与に出ている「その他」の社名、の順に作り直して比べる）
  v_own := v_hash is not distinct from public.pv_roster_key(v_uid, p_airline, p_airline_other)
        or exists (select 1 from public.pv_airlines a
                    where public.pv_roster_key(v_uid, a.code, null) = v_hash)
        or exists (select 1
                     from (select distinct lower(r.airline_other) as nm
                             from public.pay_reports r
                            where r.airline = 'other' and r.airline_other is not null) o
                    where public.pv_roster_key(v_uid, 'other', o.nm) = v_hash);
  if not v_own then
    return jsonb_build_object('ok', true, 'deleted', false, 'days', 0);
  end if;

  perform pg_advisory_xact_lock(20261109, hashtext(v_hash));
  select count(*) into v_n from public.pv_roster_days x where x.doc_id = p_doc_id;
  -- 2年より前にまとめた月の合計も、このファイルの期間に掛かる月は消す（消したいと言った人の分を残さない）
  if v_from is not null and v_to is not null then
    delete from public.pv_roster_months m
     where m.proof_hash = v_hash
       and m.ym between date_trunc('month', v_from)::date and v_to;
  end if;
  -- 日と便は外部キーの on delete cascade で一緒に消える
  delete from public.pv_roster_docs d where d.id = p_doc_id and d.proof_hash = v_hash;
  return jsonb_build_object('ok', true, 'deleted', true, 'days', v_n);
end;
$$;

-- ── 7. 読み方を保存する ─────────────────────────────────────────
-- p に在るキーだけを書き換える（無いキーは前のまま）。知らないキーは無視。p = null は消す。
--   kind 'actual'|'planned'|null ／ time_ref 'local'|'utc'|null ／ tz IANA の名前（40字まで）|null
--   time_meaning 'block'|'flight'|'other'|null ／ share_company true|false
--   blank 'off'|'none'|null（何も書いていない日 ＝ 休み／何も決まっていない／まだ答えていない）
--   codes { 'OFF1':'off', '#0123456789abcdef':'vac', ... }（丸ごと置き換え・200個まで。キーは英字の形か読み取りの印・
--         意味は off/vac/duty/standby/training/ground/unknown）
--   ★どの会社の読み方かを毎回書く（airline。一覧の会社コード・「一覧にない会社」は null）＝ 会社の辞書を数える単位。
--     書くと引き金がその会社の辞書を数え直す（pv_roster_airline_recount）。
-- 返す: {ok, profile} ／ p=null のとき {ok, deleted}
create or replace function public.set_roster_profile(p_airline text, p_airline_other text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_key   text;
  v_old   public.pv_roster_profile%rowtype;
  v_kind  text;
  v_ref   text;
  v_tz    text;
  v_mean  text;
  v_codes jsonb;
  v_share boolean;
  v_blank text;
  v_lag   smallint;
  v_air   text;
  v_n     int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  v_key := public.pv_roster_key(v_uid, p_airline, p_airline_other);
  if v_key is null then
    raise exception '会社コードが不正です' using errcode = '22023';
  end if;
  -- 会社の辞書の単位（鍵と同じ決まりで読む。「一覧にない会社」は辞書を持たない ＝ null）
  v_air := nullif(btrim(p_airline), '');
  if v_air = 'other' then
    v_air := null;
  end if;

  if p is null or jsonb_typeof(p) = 'null' then
    delete from public.pv_roster_profile where proof_hash = v_key;
    get diagnostics v_n = row_count;
    return jsonb_build_object('ok', true, 'deleted', v_n > 0);
  end if;
  if jsonb_typeof(p) <> 'object' then
    raise exception 'ロスターの読み方の形が不正です' using errcode = '22023';
  end if;
  if octet_length(p::text) > 16384 then
    raise exception 'ロスターの読み方が大きすぎます' using errcode = '54000';
  end if;

  select * into v_old from public.pv_roster_profile where proof_hash = v_key;
  v_kind  := v_old.kind;
  v_ref   := v_old.time_ref;
  v_tz    := v_old.tz;
  v_mean  := v_old.time_meaning;
  v_codes := coalesce(v_old.codes, '{}'::jsonb);
  v_share := coalesce(v_old.share_company, false);
  v_blank := v_old.blank;

  if p ? 'kind' then
    v_kind := public.pv_roster_txt(p, 'kind', '^(actual|planned)$', '実績か予定か');
  end if;
  if p ? 'time_ref' then
    v_ref := public.pv_roster_txt(p, 'time_ref', '^(local|utc)$', '時刻の基準');
  end if;
  if p ? 'tz' then
    v_tz := public.pv_roster_txt(p, 'tz', '^[A-Za-z0-9_+/\-]{1,40}$', 'タイムゾーン');
    if v_tz is not null and not exists (select 1 from pg_timezone_names z where z.name = v_tz) then
      raise exception 'ロスターのタイムゾーンが不正です' using errcode = '22023';
    end if;
  end if;
  if p ? 'time_meaning' then
    v_mean := public.pv_roster_txt(p, 'time_meaning', '^(block|flight|other)$', '時間の意味');
  end if;
  if p ? 'share_company' then
    if jsonb_typeof(p->'share_company') = 'null' then
      v_share := false;
    elsif jsonb_typeof(p->'share_company') = 'boolean' then
      v_share := (p->>'share_company')::boolean;
    else
      raise exception 'ロスターの共有の答えが不正です' using errcode = '22023';
    end if;
  end if;
  if p ? 'blank' then
    v_blank := public.pv_roster_txt(p, 'blank', '^(off|none)$', '空欄の日の意味');
  end if;
  v_lag := v_old.pay_lag;
  if p ? 'pay_lag' then        -- ★-1（わからない）があるので pv_roster_int（0 以上だけ）は使わない
    if jsonb_typeof(p->'pay_lag') = 'null' then
      v_lag := null;
    elsif jsonb_typeof(p->'pay_lag') = 'number' and (p->>'pay_lag') in ('-1', '0', '1', '2') then
      v_lag := (p->>'pay_lag')::smallint;
    else
      raise exception 'ロスターの給与明細に出る月が不正です' using errcode = '22023';
    end if;
  end if;
  if p ? 'codes' then
    if jsonb_typeof(p->'codes') = 'null' then
      v_codes := '{}'::jsonb;
    elsif jsonb_typeof(p->'codes') <> 'object' then
      raise exception 'ロスターの勤務コードの形が不正です' using errcode = '22023';
    elsif (select count(*) from jsonb_object_keys(p->'codes')) > 200 then
      raise exception 'ロスターの勤務コードが多すぎます（200まで）' using errcode = '54000';
    elsif exists (select 1 from jsonb_each(p->'codes') e
                   where e.key !~ '^([A-Z0-9/+\-]{1,12}|#[0-9a-f]{16})$'
                      or jsonb_typeof(e.value) <> 'string'
                      or (e.value #>> '{}') not in ('off', 'vac', 'duty', 'standby', 'training', 'ground', 'unknown')) then
      raise exception 'ロスターの勤務コードが不正です' using errcode = '22023';
    else
      v_codes := p->'codes';
    end if;
  end if;

  insert into public.pv_roster_profile as t
         (proof_hash, kind, time_ref, tz, time_meaning, codes, share_company, blank, pay_lag, airline, updated_at)
  values (v_key, v_kind, v_ref, v_tz, v_mean, v_codes, v_share, v_blank, v_lag, v_air, now())
  on conflict (proof_hash) do update
     set kind = excluded.kind, time_ref = excluded.time_ref, tz = excluded.tz,
         time_meaning = excluded.time_meaning, codes = excluded.codes,
         share_company = excluded.share_company, blank = excluded.blank, pay_lag = excluded.pay_lag,
         airline = excluded.airline, updated_at = now();

  return jsonb_build_object('ok', true, 'profile', public.pv_roster_profile_json(v_key));
end;
$$;

-- ── 8. 明細の1行が何か月前の勤務の分か ─────────────────────────────
-- p_status null → その行の答えを消す。'confirmed' は p_offset が要る（-12〜1）。'unknown' は offset を持たない。
-- label_key は画面（pv-report-engine.js）が正規化した名前をそのまま持つ（80字まで・制御文字なし）。
-- 返す: {ok, map:{label_key, offset, status, qty_kind}} ／ 消したとき {ok, deleted}
create or replace function public.set_line_map(
  p_airline text, p_airline_other text, p_label_key text,
  p_offset int, p_status text, p_qty_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid    uuid := auth.uid();
  v_key    text;
  v_label  text := p_label_key;
  v_status text := nullif(btrim(p_status), '');
  v_off    int  := p_offset;
  v_qty    text := nullif(btrim(p_qty_kind), '');
  v_n      int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  v_key := public.pv_roster_key(v_uid, p_airline, p_airline_other);
  if v_key is null then
    raise exception '会社コードが不正です' using errcode = '22023';
  end if;
  if v_label is null or length(v_label) not between 1 and 80 or v_label ~ '[[:cntrl:]]' then
    raise exception '明細の行の名前が不正です' using errcode = '22023';
  end if;

  if v_status is null then
    delete from public.pv_line_map where proof_hash = v_key and label_key = v_label;
    get diagnostics v_n = row_count;
    return jsonb_build_object('ok', true, 'deleted', v_n > 0);
  end if;
  if v_status not in ('confirmed', 'unknown', 'other') then
    raise exception '明細の行の答えが不正です' using errcode = '22023';
  end if;
  if v_off is not null and (v_off < -12 or v_off > 1) then
    raise exception '明細の行のずれが範囲の外です（-12〜1）' using errcode = '22023';
  end if;
  if v_status = 'confirmed' and v_off is null then
    raise exception '明細の行のずれがありません' using errcode = '22023';
  end if;
  if v_status = 'unknown' then
    v_off := null;
  end if;
  if v_qty is not null and v_qty !~ '^[a-z][a-z0-9_]{0,23}$' then
    raise exception '明細の行の数量の種類が不正です' using errcode = '22023';
  end if;
  if (select count(*) from public.pv_line_map m where m.proof_hash = v_key and m.label_key <> v_label) >= 400 then
    raise exception '明細の行の答えが多すぎます' using errcode = '54000';
  end if;

  insert into public.pv_line_map as t (proof_hash, label_key, month_offset, status, qty_kind, updated_at)
  values (v_key, v_label, v_off, v_status, v_qty, now())
  on conflict (proof_hash, label_key) do update
     set month_offset = excluded.month_offset, status = excluded.status,
         qty_kind = excluded.qty_kind, updated_at = now();

  return jsonb_build_object('ok', true,
    'map', jsonb_build_object('label_key', v_label, 'offset', v_off, 'status', v_status, 'qty_kind', v_qty));
end;
$$;

-- ── 9. レポート用に、本人の明細の中身と行の答えを返す ─────────────────
-- my_pay_reports() と同じやり方（本人の鍵を全社ぶん作り直して引く）。my_pay_reports() そのものは変えない。
-- 返す: {ok, items:[{airline, airline_other, period_year, period_month, currency, fx_to_jpy, gross_monthly,
--                    net_pay_actual, deduction_total, hourly_rate, job_roles, pay_items, payslip_detail}],
--        maps:[{airline, airline_other, label_key, offset, status, qty_kind}]}
create or replace function public.my_report_items()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_items jsonb;
  v_maps  jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  with mine as (
    -- 一覧から選んだ会社：コードは有限なので総当たりで鍵を作れる
    select public.pv_roster_key(v_uid, a.code, null) as h, a.code as airline
      from public.pv_airlines a
     where a.code <> 'other'
    union all
    -- 「一覧にない会社」：実在する社名だけを候補にして作り直す（他人の行は鍵の材料にしか使わない）
    select public.pv_roster_key(v_uid, 'other', o.nm), 'other'
      from (select distinct lower(airline_other) as nm
              from public.pay_reports
             where airline = 'other' and airline_other is not null) o
  ),
  own as (
    select r.* from public.pay_reports r join mine m on m.h = r.proof_hash
  ),
  -- 社名は本人の行の書き方で返す（他人の書き方を混ぜない）
  names as (
    select distinct on (o.proof_hash) o.proof_hash, o.airline_other
      from own o
     order by o.proof_hash, o.created_at desc
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
              'airline',         o.airline,
              'airline_other',   o.airline_other,
              'period_year',     o.period_year,
              'period_month',    o.period_month,
              'currency',        o.currency,
              'fx_to_jpy',       o.fx_to_jpy,
              'gross_monthly',   o.gross_monthly,
              'net_pay_actual',  o.net_pay_actual,
              'deduction_total', o.deduction_total,
              'hourly_rate',     o.hourly_rate,
              'job_roles',       o.job_roles,
              'pay_items',       o.pay_items,
              'payslip_detail',  o.payslip_detail
            ) order by o.period_year, o.period_month, o.airline, o.airline_other), '[]'::jsonb)
       from own o),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'airline',       m.airline,
              'airline_other', case when m.airline = 'other' then n.airline_other end,
              'label_key',     l.label_key,
              'offset',        l.month_offset,
              'status',        l.status,
              'qty_kind',      l.qty_kind
            ) order by m.airline, l.label_key), '[]'::jsonb)
       from public.pv_line_map l
       join mine m on m.h = l.proof_hash
       left join names n on n.proof_hash = l.proof_hash)
    into v_items, v_maps;

  return jsonb_build_object('ok', true, 'items', v_items, 'maps', v_maps);
end;
$$;

-- ── 9-b. 2年より前の日を月の合計にまとめて消す（毎日の片づけ・誰からも直接は呼べない）──────────
-- 境目は「今月の頭から24か月前」。それより前の月を**丸ごと**まとめる（月の途中で切らない）。
-- submit_roster は今日から400日より前の日を受け付けない ＝ まとめた月に後から日が足されることは無い。
-- 時間の数え方は pv-report-engine.js の dayOf / legOf / elapsed の写し（⚠️ 片方だけ直さない。db/test-roster.mjs が突き合わせる）:
--   勤務時間 … 出頭と解散の両方がある日だけ。utc → 時計の差／local＋正しいタイムゾーン → 夏時間込み／それ以外 → 時計の差。
--              0 分以下・3日を超えるものは数えない。
--   便の時間 … 印字の時間。無いときだけ、時刻の基準が utc なら発着の差（0 分より長く1日より短いときだけ）。
-- 返す: {ok, months, days}（まとめた月の数・消した日の数）
create or replace function public.pv_roster_tz_ok(p_tz text)
returns boolean
language plpgsql
stable
set search_path = public, extensions
as $$
begin
  -- IANA の名前だけ（'UTC+9' のような POSIX の書き方は符号が逆になるので通さない）
  if p_tz is null or length(p_tz) > 40 or not (p_tz = 'UTC' or p_tz ~ '^[A-Za-z]+(/[A-Za-z0-9_+\-]+)+$') then
    return false;
  end if;
  perform now() at time zone p_tz;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.pv_roster_compact(p_today date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cut    date := (date_trunc('month', coalesce(p_today, current_date)) - interval '24 months')::date;
  v_months int;
  v_days   int;
begin
  with pr as (
    select r.proof_hash,
           case when r.time_ref = 'utc' then 'utc'
                when r.time_ref = 'local' and public.pv_roster_tz_ok(r.tz) then 'tz'
                else 'clock' end as basis,
           r.tz, r.time_ref
      from public.pv_roster_profile r
  ),
  d as (
    select x.proof_hash, x.duty_date, date_trunc('month', x.duty_date)::date as ym, x.code,
           x.d_on, x.d_off, coalesce(pr.basis, 'clock') as basis,
           case when x.d_on is null or x.d_off is null then null
                when pr.basis = 'tz' then
                  round(extract(epoch from (((x.duty_date + x.d_off_day) + x.d_off) at time zone pr.tz)
                                         - ((x.duty_date + x.d_on) at time zone pr.tz)) / 60)::int
                else (x.d_off_day * 1440 + extract(epoch from x.d_off) / 60 - extract(epoch from x.d_on) / 60)::int
           end as el
      from public.pv_roster_days x
      left join pr on pr.proof_hash = x.proof_hash
     where x.duty_date < v_cut
  ),
  l2 as (
    select lg.proof_hash, lg.duty_date, lg.kind,
           case when lg.block_min is not null then lg.block_min
                when pr.time_ref = 'utc' and t.v > 0 and t.v < 1440 then t.v
           end as bmin
      from public.pv_roster_legs lg
      left join pr on pr.proof_hash = lg.proof_hash
      cross join lateral (select (lg.in_day * 1440 + extract(epoch from lg.t_in) / 60
                                  - extract(epoch from lg.t_out) / 60)::int as v) t
     where lg.duty_date < v_cut
  ),
  dn as (select proof_hash, duty_date, count(*) as n from l2 group by 1, 2),
  dd as (
    select d.*, ((d.d_on is not null and d.d_off is not null) or coalesce(dn.n, 0) > 0) as has_duty,
           case when d.el > 0 and d.el <= 3 * 1440 then d.el end as el_ok
      from d left join dn using (proof_hash, duty_date)
  ),
  gk as (
    select proof_hash, ym, code, max(basis) as basis,
           count(*)::int as days,
           (count(*) filter (where has_duty))::int as duty_days,
           (count(*) filter (where has_duty and el_ok is not null))::int as timed_days,
           coalesce(sum(el_ok) filter (where has_duty), 0)::int as duty_min
      from dd group by proof_hash, ym, code
  ),
  gl as (
    select l2.proof_hash, date_trunc('month', l2.duty_date)::date as ym, x.code, l2.kind,
           count(*)::int as n, coalesce(sum(l2.bmin), 0)::int as bsum, (count(*) - count(l2.bmin))::int as gaps
      from l2
      join public.pv_roster_days x on x.proof_hash = l2.proof_hash and x.duty_date = l2.duty_date
     group by 1, 2, 3, 4
  ),
  g as (
    select gk.*,
           (select jsonb_object_agg(k.kind, jsonb_build_object(
                     'n', coalesce(gl.n, 0), 'block_min', coalesce(gl.bsum, 0), 'gaps', coalesce(gl.gaps, 0)))
              from (values ('operating'), ('deadhead'), ('ground'), ('unknown')) as k(kind)
              left join gl on gl.proof_hash = gk.proof_hash and gl.ym = gk.ym
                          and gl.code is not distinct from gk.code and gl.kind = k.kind) as legs
      from gk
  ),
  ins as (
    insert into public.pv_roster_months (proof_hash, ym, covered_days, time_basis, groups)
    select g.proof_hash, g.ym, sum(g.days)::smallint, max(g.basis),
           jsonb_agg(jsonb_build_object(
             'code', g.code, 'days', g.days, 'duty_days', g.duty_days,
             'timed_days', g.timed_days, 'duty_min', g.duty_min, 'legs', g.legs) order by g.code nulls first)
      from g
     group by g.proof_hash, g.ym
    on conflict (proof_hash, ym) do nothing
    returning 1
  )
  select count(*) into v_months from ins;

  -- 日を消す（便は外部キーで一緒に消える）。ファイルの記録（指紋・期間）は残す ＝ 本人がそこから月の合計ごと消せる。
  delete from public.pv_roster_days x where x.duty_date < v_cut;
  get diagnostics v_days = row_count;

  return jsonb_build_object('ok', true, 'months', v_months, 'days', v_days);
end;
$$;

revoke all on function public.pv_roster_tz_ok(text)    from public, anon, authenticated;
revoke all on function public.pv_roster_compact(date)  from public, anon, authenticated;

-- 毎日の片づけ（★pg_cron が在るときだけ登録する。手元の検査（PGlite）には無い ＝ ここは飛ばす）。
-- 同じ名前で登録し直すだけなので、何度流しても1本のまま。止めるとき: select cron.unschedule('pv-roster-compact');
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute format('select cron.schedule(%L, %L, %L)',
                   'pv-roster-compact', '17 4 * * *', 'select public.pv_roster_compact()');
  end if;
end
$cron$;

-- ── 9-c. 会社の辞書（2026-11-10）────────────────────────────────────
-- オーナー「勤務表を読んだあとに読めない日が残り、会員が打つことが多い」。勤務コードの意味などを、同じ会社の会員の答えから覚える。
--   数える単位 … 読み方（pv_roster_profile）の1行 ＝ 1人・1社。codes の 'unknown' は答えに数えない（kind などの null も）。
--   そろった線 … いちばん多い答えが3人以上 かつ 答えた人の過半数（db/ask-own-airline.sql の pv_ask_filled と同じ考え。
--                3対3 は割れている ＝ 置かない）。★線は pv_roster_airline_recount の定数の1か所だけ。
--   数えるとき … 読み方の表に書いたとき（引き金）。その会社の分だけを作り直す。⚠️ 読むたびに数えない。
--   外す人     … テスト用アカウント（pv_test_users）。鍵は pv_roster_key で作り直して比べる（式の写しを作らない）。
--   ★表に持つのは会社・キー・意味だけ。人数も、誰が答えたかも持たない。読む口も返さない。
create or replace function public.pv_roster_airline_recount(p_airline text)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  c_min_agree constant int := 3;   -- ★いちばん多い答えがこの人数以上（かつ、下の「答えた人の過半数」）
  v_n int;
begin
  if p_airline is null then
    return 0;
  end if;
  -- 同じ会社の数え直しは1本ずつ（後の1本は、前の1本が書き終えてから新しい中身を見て数える）
  perform pg_advisory_xact_lock(20261110, hashtext('pv_roster_airline:' || p_airline));

  -- ★その会社の分だけ作り直す（ほかの会社の行には触れない）
  delete from public.pv_roster_airline_codes c where c.airline = p_airline;

  with tk as (
    select public.pv_roster_key(t.uid, p_airline, null) as h
      from public.pv_test_users t
  ),
  pr as (
    select r.*
      from public.pv_roster_profile r
     where r.airline = p_airline
       and not exists (select 1 from tk where tk.h = r.proof_hash)
  ),
  ans as (
    select r.proof_hash, e.key, e.value #>> '{}' as v
      from pr r cross join lateral jsonb_each(r.codes) e
     where jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') <> 'unknown'
    union all select r.proof_hash, '@kind', r.kind from pr r where r.kind is not null
    union all select r.proof_hash, '@time_ref', r.time_ref from pr r where r.time_ref is not null
    union all select r.proof_hash, '@time_meaning', r.time_meaning from pr r where r.time_meaning is not null
    union all select r.proof_hash, '@blank', r.blank from pr r where r.blank is not null
  ),
  per as (select a.key, a.v, count(*)::int as c from ans a group by a.key, a.v),
  tot as (select p.key, sum(p.c)::int as n from per p group by p.key),
  best as (select distinct on (p.key) p.key, p.v, p.c from per p order by p.key, p.c desc, p.v)
  insert into public.pv_roster_airline_codes (airline, key, meaning, updated_at)
  select p_airline, b.key, b.v, now()
    from best b join tot t on t.key = b.key
   where b.c >= c_min_agree      -- 3人以上
     and b.c * 2 > t.n;          -- かつ、答えた人の過半数
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- 全部の会社を数え直す（テスト用アカウントの名簿が変わったとき・このファイルを貼ったときの1回だけ）。
create or replace function public.pv_roster_airline_recount_all()
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_a text;
  v_n int := 0;
begin
  -- 読み方がもう1行も無い会社の辞書は消す
  delete from public.pv_roster_airline_codes c
   where not exists (select 1 from public.pv_roster_profile r where r.airline = c.airline);
  for v_a in select distinct r.airline from public.pv_roster_profile r where r.airline is not null loop
    v_n := v_n + public.pv_roster_airline_recount(v_a);
  end loop;
  return v_n;
end;
$$;

-- 引き金。読み方の1行が変わったら、前の会社と新しい会社を数え直す（同じなら1回）。
-- テスト用アカウントの名簿が変わったら（1文に1回）全部の会社を数え直す。
-- 数え直しが失敗しても書き込みは止めない（辞書は前の中身のまま。db/member-median.sql と同じ）。
create or replace function public.pv_roster_airline_codes_trg()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old text;
  v_new text;
begin
  begin
    if tg_level = 'STATEMENT' then
      perform public.pv_roster_airline_recount_all();
      return null;
    end if;
    if tg_op = 'UPDATE' then
      -- 答えに関わる欄が1つも変わっていない書き換え（タイムゾーン・共有・時刻だけ）は数え直さない
      if (old.airline, old.proof_hash, old.kind, old.time_ref, old.time_meaning, old.blank, old.codes)
         is not distinct from
         (new.airline, new.proof_hash, new.kind, new.time_ref, new.time_meaning, new.blank, new.codes) then
        return null;
      end if;
    end if;
    if tg_op in ('UPDATE', 'DELETE') then
      v_old := old.airline;
    end if;
    if tg_op in ('UPDATE', 'INSERT') then
      v_new := new.airline;
    end if;
    if v_old is not null then
      perform public.pv_roster_airline_recount(v_old);
    end if;
    if v_new is not null and v_new is distinct from v_old then
      perform public.pv_roster_airline_recount(v_new);
    end if;
  exception when others then
    raise warning 'pv_roster_airline_recount に失敗しました（書き込みはそのまま通します）: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

drop trigger if exists trg_pv_roster_airline_codes on public.pv_roster_profile;
create trigger trg_pv_roster_airline_codes
  after insert or update or delete on public.pv_roster_profile
  for each row execute function public.pv_roster_airline_codes_trg();

drop trigger if exists trg_pv_roster_airline_codes on public.pv_test_users;
create trigger trg_pv_roster_airline_codes
  after insert or update or delete on public.pv_test_users
  for each statement execute function public.pv_roster_airline_codes_trg();

revoke all on function public.pv_roster_airline_recount(text)  from public, anon, authenticated;
revoke all on function public.pv_roster_airline_recount_all()  from public, anon, authenticated;
revoke all on function public.pv_roster_airline_codes_trg()    from public, anon, authenticated;

-- 会社の辞書を読む口。表を引くだけ（何も数えない）。人数も、誰が答えたかも返さない。
-- 返す: {ok:true, codes:{KEY:meaning, …}, kind?, time_ref?, time_meaning?, blank?}
--   codes の KEY は勤務コード（英字の形）か読み取りの印（'#'＋16進16字）。意味は off/vac/duty/standby/training/ground。
--   kind・time_ref・time_meaning・blank は、そろっているときだけキーが在る（無ければキーごと無い）。
--   「一覧にない会社」は辞書を持たない → {ok:true, codes:{}}。
create or replace function public.my_roster_airline_codes(p_airline text, p_airline_other text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_key   text;
  v_air   text := nullif(btrim(p_airline), '');
  v_codes jsonb;
  v_kind  text;
  v_ref   text;
  v_mean  text;
  v_blank text;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  -- 会社の決まりは本人の鍵と同じ（作れなければ不正な会社）
  v_key := public.pv_roster_key(v_uid, p_airline, p_airline_other);
  if v_key is null then
    raise exception '会社コードが不正です' using errcode = '22023';
  end if;
  if v_air = 'other' then
    return jsonb_build_object('ok', true, 'codes', '{}'::jsonb);
  end if;

  select coalesce(jsonb_object_agg(c.key, c.meaning) filter (where left(c.key, 1) <> '@'), '{}'::jsonb),
         max(c.meaning) filter (where c.key = '@kind'),
         max(c.meaning) filter (where c.key = '@time_ref'),
         max(c.meaning) filter (where c.key = '@time_meaning'),
         max(c.meaning) filter (where c.key = '@blank')
    into v_codes, v_kind, v_ref, v_mean, v_blank
    from public.pv_roster_airline_codes c
   where c.airline = v_air;

  return jsonb_build_object('ok', true, 'codes', v_codes)
      || jsonb_strip_nulls(jsonb_build_object('kind', v_kind, 'time_ref', v_ref,
                                              'time_meaning', v_mean, 'blank', v_blank));
end;
$$;

-- 前に貼った版の読み方には会社（airline）が入っていない。本人の鍵から当て直す（貼るときだけ・決まらない行は null のまま）。
--   ① 同じ鍵の給与の行がある人は、その行の会社（鍵の式が同じ ＝ 検算7）。軽いので毎回。
--   ② 残りは、会員 × 一覧の会社 の鍵を作って突き合わせる。★重い（会員数 × 約140社の鍵）ので、
--      会社の列を初めて足した貼り付けの1回だけ（1 の印）。「一覧にない会社」の行は null のまま
--      （null が正しい行なので、毎回やると貼るたびに全員ぶん作り直してしまう）。
--      その後に会社の欄が空のまま残った行は、本人が次に読み方を保存したときに入る。
--   当てた行は引き金がその会社の辞書を数え直す。
do $fill$
begin
  update public.pv_roster_profile r
     set airline = p.airline
    from (select distinct x.proof_hash, x.airline
            from public.pay_reports x
           where x.airline <> 'other') p
   where r.airline is null and p.proof_hash = r.proof_hash;
  if current_setting('pv.roster_airline_fill', true) = '1' then
    perform set_config('pv.roster_airline_fill', '', false);
    if exists (select 1 from public.pv_roster_profile where airline is null)
       and to_regclass('public.profiles') is not null then
      execute $q$
        update public.pv_roster_profile r
           set airline = m.code
          from (select public.pv_roster_key(u.id, a.code, null) as h, a.code
                  from public.profiles u cross join public.pv_airlines a
                 where a.code <> 'other') m
         where r.airline is null and r.proof_hash = m.h
      $q$;
    end if;
  end if;
end
$fill$;

-- 貼ったときに1回だけ全部の会社を数え直す（線を変えて貼り直したときも、ここで新しい線になる）
select public.pv_roster_airline_recount_all();

-- ── 10. 呼べる人 ─────────────────────────────────────────────
revoke all on function public.submit_roster(jsonb)                               from public, anon;
revoke all on function public.edit_roster_day(text, text, jsonb)                 from public, anon;
revoke all on function public.my_roster(text, text, date, date)                  from public, anon;
revoke all on function public.my_roster_docs(text, text)                         from public, anon;
revoke all on function public.delete_roster_doc(uuid, text, text)                from public, anon;
revoke all on function public.set_roster_profile(text, text, jsonb)              from public, anon;
revoke all on function public.set_line_map(text, text, text, int, text, text)    from public, anon;
revoke all on function public.my_report_items()                                  from public, anon;
revoke all on function public.my_roster_airline_codes(text, text)                 from public, anon;
grant execute on function public.submit_roster(jsonb)                            to authenticated;
grant execute on function public.edit_roster_day(text, text, jsonb)              to authenticated;
grant execute on function public.my_roster(text, text, date, date)               to authenticated;
grant execute on function public.my_roster_docs(text, text)                      to authenticated;
grant execute on function public.delete_roster_doc(uuid, text, text)             to authenticated;
grant execute on function public.set_roster_profile(text, text, jsonb)           to authenticated;
grant execute on function public.set_line_map(text, text, text, int, text, text) to authenticated;
grant execute on function public.my_report_items()                               to authenticated;
grant execute on function public.my_roster_airline_codes(text, text)              to authenticated;

comment on function public.submit_roster(jsonb) is
  '勤務表を取り込む（本人の鍵で・日付で入れ替え・原本は持たない・氏名や自由記述の入る欄が無い）。';
comment on function public.edit_roster_day(text, text, jsonb) is
  '勤務表の1日を手で直す・消す（本人の鍵で・検品は submit_roster と同じ pv_roster_clean_day・便名は持たない・2年より前の日は受け付けない・1人1日200回まで）。';
comment on function public.my_roster_airline_codes(text, text) is
  '会社の辞書（勤務コードの意味など・3人以上が同じ答え かつ 答えた人の過半数のものだけ）。表を引くだけ・人数は返さない。';
comment on function public.my_report_items() is
  'マイレポート用。本人の明細の中身（pay_items・payslip_detail）と行の答え。my_pay_reports と同じく本人の鍵を作り直して引く。';

-- ── 11. 検算（貼ったあと、全部 ✅ になること）──────────────────────────
with fns(sig) as (values
       ('public.submit_roster(jsonb)'),
       ('public.edit_roster_day(text, text, jsonb)'),
       ('public.my_roster(text, text, date, date)'),
       ('public.my_roster_docs(text, text)'),
       ('public.delete_roster_doc(uuid, text, text)'),
       ('public.set_roster_profile(text, text, jsonb)'),
       ('public.set_line_map(text, text, text, integer, text, text)'),
       ('public.my_report_items()'),
       ('public.my_roster_airline_codes(text, text)')),
     fn as (select sig, to_regprocedure(sig) as oid from fns),
     fd as (select sig, pg_get_functiondef(oid) as s from fn where oid is not null),
     hp(sig) as (values
       ('public.pv_roster_key(uuid, text, text)'),
       ('public.pv_roster_txt(jsonb, text, text, text)'),
       ('public.pv_roster_int(jsonb, text, integer, integer, text)'),
       ('public.pv_roster_date(jsonb, text, text)'),
       ('public.pv_roster_clean_day(jsonb, integer)'),
       ('public.pv_roster_profile_json(text)'),
       ('public.pv_roster_tz_ok(text)'),
       ('public.pv_roster_compact(date)'),
       ('public.pv_roster_airline_recount(text)'),
       ('public.pv_roster_airline_recount_all()'),
       ('public.pv_roster_airline_codes_trg()')),
     hpo as (select sig, to_regprocedure(sig) as oid from hp),
     tb(t) as (values ('public.pv_roster_profile'), ('public.pv_roster_docs'), ('public.pv_roster_days'),
                      ('public.pv_roster_legs'), ('public.pv_line_map'), ('public.pv_roster_months'),
                      ('public.pv_roster_edit_quota'), ('public.pv_roster_airline_codes')),
     tbo as (select t, to_regclass(t) as oid from tb),
     ro as (select oid from pg_roles where rolname in ('anon', 'authenticated')),
     k as (select $k$v_uid::text || '::pv_pay::' || v_airline || coalesce('::' || lower(v_other), '')$k$ as s),
     sr as (select coalesce((select s from fd where sig = 'public.submit_roster(jsonb)'), '') as s),
     ed as (select coalesce((select s from fd where sig = 'public.edit_roster_day(text, text, jsonb)'), '') as s),
     mr as (select coalesce((select s from fd where sig = 'public.my_roster(text, text, date, date)'), '') as s),
     md as (select coalesce((select s from fd where sig = 'public.my_roster_docs(text, text)'), '') as s),
     cd as (select coalesce(pg_get_functiondef(to_regprocedure('public.pv_roster_clean_day(jsonb, integer)')), '') as s),
     sp as (select coalesce((select s from fd where sig = 'public.set_roster_profile(text, text, jsonb)'), '') as s),
     ac as (select coalesce((select s from fd where sig = 'public.my_roster_airline_codes(text, text)'), '') as s),
     rc as (select coalesce(pg_get_functiondef(to_regprocedure('public.pv_roster_airline_recount(text)')), '') as s),
     tg as (select coalesce(pg_get_functiondef(to_regprocedure('public.pv_roster_airline_codes_trg()')), '') as s)
select 1 as "#", '9つの口がある・どれも呼んだ本人の権限で動かない（security definer）' as "確かめること",
       case when (select count(*) from fn where oid is not null) = 9
             and (select bool_and(p.prosecdef) from fn join pg_proc p on p.oid = fn.oid)
            then '✅' else '❌' end as "判定"
union all select 2, '未ログイン（anon）と PUBLIC は9つとも呼べない・ログイン済みは呼べる',
       case when (select count(*) from fn where oid is not null) = 9
             and not exists (select 1 from fn join pg_proc q on q.oid = fn.oid,
                                    lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
                              where a.privilege_type = 'EXECUTE'
                                and (a.grantee = 0 or a.grantee in (select oid from pg_roles where rolname = 'anon')))
             and (select bool_and(has_function_privilege('authenticated', fn.oid, 'EXECUTE')) from fn where oid is not null)
            then '✅' else '❌' end
union all select 3, '内部の道具（鍵の式・検品・1日の組み直し・読み方の形・月の合計へのまとめ・会社の辞書の数え直し）は誰からも直接呼べない',
       case when (select count(*) from hpo where oid is not null) = 11
             and not exists (select 1 from hpo join pg_proc q on q.oid = hpo.oid,
                                    lateral aclexplode(coalesce(q.proacl, acldefault('f', q.proowner))) a
                              where a.privilege_type = 'EXECUTE'
                                and (a.grantee = 0 or a.grantee in (select oid from ro)))
            then '✅' else '❌' end
union all select 4, 'ログインしていなければ止める（9つとも auth.uid() が無ければ 42501）',
       case when (select count(*) from fd) = 9
             and (select bool_and(strpos(s, 'if v_uid is null then') > 0 and strpos(s, '42501') > 0) from fd)
            then '✅' else '❌' end
union all select 5, '8つの表は RLS が有効・ポリシーが1つも無い（直接は誰も読めない）',
       case when (select count(*) from tbo where oid is not null) = 8
             and (select bool_and(c.relrowsecurity) from tbo join pg_class c on c.oid = tbo.oid)
             and not exists (select 1 from pg_policy pl where pl.polrelid in (select oid from tbo where oid is not null))
            then '✅' else '❌' end
union all select 6, '8つの表に anon・authenticated・PUBLIC の権限が1つも無い',
       case when (select count(*) from tbo where oid is not null) = 8
             and not exists (select 1 from tbo join pg_class c on c.oid = tbo.oid,
                                    lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
                              where a.grantee = 0 or a.grantee in (select oid from ro))
            then '✅' else '❌' end
union all select 7, '本人の鍵の式が submit_pay_report と1文字も違わない（9つとも pv_roster_key で作る）',
       case when strpos(coalesce(pg_get_functiondef(to_regprocedure('public.pv_roster_key(uuid, text, text)')), ''), (select s from k)) > 0
             and strpos(pg_get_functiondef('public.submit_pay_report(jsonb)'::regprocedure), (select s from k)) > 0
             and (select count(*) from fd) = 9
             and (select bool_and(strpos(s, 'public.pv_roster_key(v_uid') > 0) from fd)
            then '✅' else '❌' end
union all select 8, '新しい提出は日付で入れ替わる（日の主キーが本人×日付・先に同じ日を消してから入れる・便は日と一緒に消える）',
       case when (select array_agg(a.attname::text order by a.attname)
                    from pg_constraint c
                    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
                   where c.conrelid = to_regclass('public.pv_roster_days') and c.contype = 'p')
                 = array['duty_date', 'proof_hash']
             and strpos((select s from sr), 'delete from public.pv_roster_days') > 0
             and strpos((select s from sr), 'delete from public.pv_roster_days')
                 < strpos((select s from sr), 'insert into public.pv_roster_days')
             and exists (select 1 from pg_constraint c
                          where c.conrelid = to_regclass('public.pv_roster_legs') and c.contype = 'f'
                            and c.confrelid = to_regclass('public.pv_roster_days') and c.confdeltype = 'c')
             and exists (select 1 from pg_constraint c
                          where c.conrelid = to_regclass('public.pv_roster_days') and c.contype = 'f'
                            and c.confrelid = to_regclass('public.pv_roster_docs') and c.confdeltype = 'c')
            then '✅' else '❌' end
union all select 9, '原本・氏名・自由記述を入れる列が無い（bytea も name・note・memo・image などの列も無い）',
       case when (select count(*) from tbo where oid is not null) = 8
             and not exists (select 1 from pg_attribute a
                              where a.attrelid in (select oid from tbo where oid is not null)
                                and a.attnum > 0 and not a.attisdropped
                                and (a.atttypid = 'bytea'::regtype
                                     or a.attname ~ '(name|note|memo|comment|remark|image|photo|crew|free|text)'))
            then '✅' else '❌' end
union all select 10, 'my_pay_reports は今までどおり pay_items・payslip_detail をそのまま返さない',
       case when strpos(pg_get_functiondef('public.my_pay_reports()'::regprocedure), 'r.pay_items,') = 0
             and strpos(pg_get_functiondef('public.my_pay_reports()'::regprocedure), 'r.payslip_detail') = 0
            then '✅' else '❌' end
union all select 11, '便名を保存しない（便の表に列が無い・出す口・直す口・1日の組み直しは入れない・読む口も返さない）',
       case when not exists (select 1 from pg_attribute a
                              where a.attrelid = to_regclass('public.pv_roster_legs')
                                and a.attname = 'flight' and a.attnum > 0 and not a.attisdropped)
             and strpos((select s from sr), $f$'flight'$f$) = 0
             and strpos((select s from ed), $f$'flight'$f$) = 0
             and strpos((select s from cd), $f$'flight'$f$) = 0
             and strpos((select s from mr), $f$'flight'$f$) = 0
             and length((select s from sr)) > 0 and length((select s from ed)) > 0
             and length((select s from cd)) > 0 and length((select s from mr)) > 0
            then '✅' else '❌' end
union all select 12, '2年より前の日は月の合計にまとめて消す（境目は24か月前の月の頭・日を消す・時計が在れば毎日流れる）',
       case when to_regprocedure('public.pv_roster_compact(date)') is not null
             and strpos(pg_get_functiondef('public.pv_roster_compact(date)'::regprocedure), $c$interval '24 months'$c$) > 0
             and strpos(pg_get_functiondef('public.pv_roster_compact(date)'::regprocedure), 'delete from public.pv_roster_days') > 0
             and (not exists (select 1 from pg_extension where extname = 'pg_cron')
                  or (xpath('/row/n/text()',
                            query_to_xml($q$select count(*) as n from cron.job where jobname = 'pv-roster-compact'$q$,
                                         false, true, '')))[1]::text = '1')
            then '✅' else '❌' end
union all select 13, '手で直す口（edit_roster_day）はログインしていなければ 42501・本人の鍵（pv_roster_key）で書く',
       case when strpos((select s from ed), 'if v_uid is null then') > 0
             and strpos((select s from ed), '42501') > 0
             and strpos((select s from ed), 'public.pv_roster_key(v_uid, p_airline, p_airline_other)') > 0
            then '✅' else '❌' end
union all select 14, '1日の検品は1か所（submit_roster と edit_roster_day がどちらも pv_roster_clean_day を呼び、自前の検品を持たない）',
       case when strpos((select s from sr), 'public.pv_roster_clean_day(') > 0
             and strpos((select s from ed), 'public.pv_roster_clean_day(') > 0
             and strpos((select s from cd), '^[A-Z0-9]{3,4}$') > 0
             and strpos((select s from cd), 'ブロック時間') > 0
             and strpos((select s from sr), '^[A-Z0-9]{3,4}$') = 0 and strpos((select s from sr), 'ブロック時間') = 0
             and strpos((select s from ed), '^[A-Z0-9]{3,4}$') = 0 and strpos((select s from ed), 'ブロック時間') = 0
            then '✅' else '❌' end
union all select 15, '手で直す口は月の合計にまとめた期間（24か月前の月の頭より前）の日を受け付けない',
       case when strpos((select s from ed), $c$date_trunc('month', current_date) - interval '24 months'$c$) > 0
             and strpos((select s from ed), 'if v_date < v_cut then') > 0
            then '✅' else '❌' end
union all select 16, 'ファイルの表に manual の列がある（手で直した日の置き場は1人1社に1つ・my_roster_docs が返す）',
       case when exists (select 1 from pg_attribute a
                          where a.attrelid = to_regclass('public.pv_roster_docs') and a.attname = 'manual'
                            and a.atttypid = 'boolean'::regtype and a.attnotnull and a.attnum > 0 and not a.attisdropped)
             and exists (select 1 from pg_constraint c
                          where c.conrelid = to_regclass('public.pv_roster_docs') and c.contype = 'u'
                            and (select array_agg(a.attname::text order by a.attname)
                                   from pg_attribute a
                                  where a.attrelid = c.conrelid and a.attnum = any (c.conkey)) = array['file_sha', 'proof_hash'])
             and strpos((select s from ed), $m$'manual::' || v_key$m$) > 0
             and strpos((select s from md), $m$'manual'$m$) > 0
            then '✅' else '❌' end
union all select 17, '便の乗務の区分（CAP／FO など）を保存しない（便の表に列が無い・出す口・直す口・1日の組み直し・読む口のどれにも無い）',
       case when not exists (select 1 from pg_attribute a
                              where a.attrelid = to_regclass('public.pv_roster_legs')
                                and a.attname in ('role', 'role_raw') and a.attnum > 0 and not a.attisdropped)
             and strpos((select s from sr), $r$'role'$r$) = 0 and strpos((select s from sr), 'role_raw') = 0
             and strpos((select s from ed), $r$'role'$r$) = 0 and strpos((select s from ed), 'role_raw') = 0
             and strpos((select s from cd), $r$'role'$r$) = 0 and strpos((select s from cd), 'role_raw') = 0
             and strpos((select s from mr), $r$'role'$r$) = 0 and strpos((select s from mr), 'role_raw') = 0
             and length((select s from sr)) > 0 and length((select s from ed)) > 0
             and length((select s from cd)) > 0 and length((select s from mr)) > 0
            then '✅' else '❌' end
union all select 18, '勤務コードは英字の形か読み取りの印（#＋小文字の16進16字）だけ（日の表・1日の組み直し・読み方の codes・会社の辞書が同じ形）',
       case when strpos(coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c
                                   where c.conrelid = to_regclass('public.pv_roster_days')
                                     and c.conname = 'pv_roster_days_code_check'), ''), '|#[0-9a-f]{16})$') > 0
             and strpos((select s from cd), '|#[0-9a-f]{16})$') > 0
             and strpos((select s from sp), '|#[0-9a-f]{16})$') > 0
             and exists (select 1 from pg_constraint c
                          where c.conrelid = to_regclass('public.pv_roster_airline_codes') and c.contype = 'c'
                            and strpos(pg_get_constraintdef(c.oid), '|#[0-9a-f]{16})$') > 0)
            then '✅' else '❌' end
union all select 19, '読み方に「空欄の日の意味」（blank：off／none／null）と会社（airline）の列・会社で引く索引がある・保存の口が毎回会社を書く',
       case when exists (select 1 from pg_attribute a
                          where a.attrelid = to_regclass('public.pv_roster_profile') and a.attname = 'blank'
                            and a.atttypid = 'text'::regtype and a.attnum > 0 and not a.attisdropped)
             and exists (select 1 from pg_constraint c
                          where c.conrelid = to_regclass('public.pv_roster_profile')
                            and c.conname = 'pv_roster_profile_blank_check')
             and exists (select 1 from pg_attribute a
                          where a.attrelid = to_regclass('public.pv_roster_profile') and a.attname = 'airline'
                            and a.atttypid = 'text'::regtype and a.attnum > 0 and not a.attisdropped)
             and exists (select 1 from pg_indexes i
                          where i.schemaname = 'public' and i.tablename = 'pv_roster_profile'
                            and i.indexdef like '%(airline)%')
             and strpos((select s from sp), 'airline = excluded.airline') > 0
             and strpos((select s from sp), 'blank = excluded.blank') > 0
            then '✅' else '❌' end
union all select 20, '会社の辞書は書き込みのときに数える（読み方の表の引き金・その会社の分だけ・線は「3人以上 かつ 過半数」の1か所・テスト用アカウントを外す・失敗しても書き込みは止めない）',
       case when exists (select 1 from pg_trigger t
                          where t.tgrelid = to_regclass('public.pv_roster_profile')
                            and t.tgname = 'trg_pv_roster_airline_codes' and not t.tgisinternal
                            and (t.tgtype::int & 29) = 29 and (t.tgtype::int & 2) = 0)
             and exists (select 1 from pg_trigger t
                          where t.tgrelid = to_regclass('public.pv_test_users')
                            and t.tgname = 'trg_pv_roster_airline_codes' and not t.tgisinternal)
             and strpos((select s from rc), 'c_min_agree constant int := 3;') > 0
             and strpos((select s from rc), 'b.c >= c_min_agree') > 0
             and strpos((select s from rc), 'b.c * 2 > t.n') > 0
             and strpos((select s from rc), 'delete from public.pv_roster_airline_codes c where c.airline = p_airline;') > 0
             and strpos((select s from rc), 'public.pv_test_users') > 0
             and strpos((select s from rc), 'public.pv_roster_key(t.uid, p_airline, null)') > 0
             and strpos((select s from tg), 'exception when others then') > 0
            then '✅' else '❌' end
union all select 21, '会社の辞書を読む口は表を引くだけ（数えない・人数を返さない・読み方の表に触れない・一覧にない会社は空）',
       case when strpos((select s from ac), 'from public.pv_roster_airline_codes c') > 0
             and strpos((select s from ac), 'count(') = 0
             and strpos((select s from ac), 'pv_roster_profile') = 0
             and strpos((select s from ac), $o$v_air = 'other'$o$) > 0
             and length((select s from ac)) > 0
            then '✅' else '❌' end
union all select 22, '読み方に「給与明細に出る月」（pay_lag：-1〜2／null）の列と制約がある・保存の口が書き・読み方の形が返す',
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pv_roster_profile' and column_name = 'pay_lag')
             and exists (select 1 from pg_constraint where conname = 'pv_roster_profile_pay_lag_check')
             and strpos((select s from sp), $l$(p->>'pay_lag') in ('-1', '0', '1', '2')$l$) > 0
             and strpos((select s from sp), 'pay_lag = excluded.pay_lag') > 0
             and strpos(coalesce(pg_get_functiondef(to_regprocedure('public.pv_roster_profile_json(text)')), ''), $l$'pay_lag', r.pay_lag$l$) > 0
            then '✅' else '❌' end
order by 1;
