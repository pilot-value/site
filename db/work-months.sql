-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/work-months.sql
--
-- 月の勤務（6項目）の置き場。給与（pay_reports）とは別の表・別の入口で持つ。
--   乗務時間 block_hours ／ 拘束時間 duty_hours ／ 勤務日数 work_days
--   乗務日数 duty_days   ／ 公休日数 days_off   ／ ステイ泊数 stay_nights
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 流す順番: db/airlines.generated.sql → db/vocab.generated.sql → db/pay-reports.sql
--    → db/pay-rows.sql → このファイル
--    （前のどれかが抜けていたら、下の「0. 前提」が日本語で止める。）
-- 冪等（何度流しても安全）。
--
-- ── この設計が守っている約束 ────────────────────────────────
--  1. 給与と切り離す。勤務だけを出すのに、給与の一式を求めない。
--     逆に、ここへ出しても給与の資格は1つも付かない。
--       ・submit_work_month が profiles に書くのは連投の数え（work_months_*）だけ。
--         REAL PAY の鍵・給与の件数・バッジ・確認の印には触らない。
--       ・pv_my_give / pv_pay_rows はこの表を読まない（どちらも pay_reports だけを見る）。
--     ＝「勤務を1項目出した」が「給与を出した」に数えられる道が無い。
--     末尾の検算と db/test-work-months.mjs が見ている。
--  2. 0 と未回答は別物。
--       鍵が無い・null・空文字 … 未回答（null のまま持つ）
--       0                     … 0（「その月は乗務が無かった」も答え）
--     どこでも 0 で埋めない。集計も null を人数に数えない。
--  3. 知っている1項目だけで出せる。6つ全部が未回答のときだけ受けない。
--  4. 1件の投稿を、会社の決まりや平均として扱わない。
--     行は「誰か1人の、ある月の、ある条件での事実」として積む
--     （職位・機材・ベース・対象月・拘束時間の数え方・通勤を含めたか）。
--     外へ出すのは**幅**だけで、項目ごとに3人以上そろったときだけ（約束 7）。
--  5. user_id を持たない。proof_hash だけ。
--     ★ 式は給与（submit_pay_report）と**わざと同じ**にしてある（区切りは '::pv_pay::'）。
--       同じ人・同じ会社なら pay_reports と同じハッシュになる
--       ＝ 給与のほうに書いた勤務の数字と、ここに書いた数字を「同じ1人」に畳める。
--       式を変えると、同じ人が2人に数えられて3人の壁が1人ぶん薄くなる。
--     ⚠️ ステイ（'::pv_hotel::'）・要望・待遇は区切りを変えて表どうしの突き合わせを
--        防いでいる。ここは逆で、給与の行と突き合わせるためにそろえてある。
--  6. 表は完全に閉じる。ポリシーを1つも作らない＝ anon も authenticated も
--     直接は1行も読めない・書けない。出入口は security definer の関数だけ。
--  7. 外へ出す数字は pv_work_month_stats の幅（25%点〜75%点）だけ。
--       ・項目ごとに、答えた人が3人以上のときだけ。届かない項目は null。
--       ・平均も中央値も人数も返さない。時間は5刻み・日数と泊数は1刻みに丸める。
--       ・3人に届かない月は、誰も出していない月と**同じ返事**になる（在る／無いも出さない）。
--       ・壁の数（3）は pv_work_range の1か所だけ。
--  8. 出し直しは訂正。同じ人・同じ会社・同じ月は行ごと置き換える。
--     省いた項目は null に戻る（前の答えを残さない＝いま本人が言っていることだけが残る）。
--  9. 検品は全部ここでやる（範囲・月・語彙・連投）。
--     画面の制限は目安にすぎず、REST を直接叩けば素通りする。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regclass('public.pv_airlines') is null then
    raise exception '先に db/airlines.generated.sql を実行してください（pv_airlines の表が無い）';
  end if;
  if to_regclass('public.pv_positions') is null or to_regclass('public.pv_fleets') is null then
    raise exception '先に db/vocab.generated.sql を実行してください（pv_positions / pv_fleets の表が無い）';
  end if;
  if to_regclass('public.pay_reports') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports の表が無い）';
  end if;
  if to_regclass('public.pay_hidden') is null
     or to_regprocedure('public.pv_airline_resolve(text)') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pay_hidden / pv_airline_resolve が無い）';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'profiles の表がありません（Supabase の初期設定を確認してください）';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. 表
-- ════════════════════════════════════════════════════════════════

-- 1-a. その月が何日あるか（うるう年も暦どおり）。
--      表の CHECK と submit_work_month の両方がこれを呼ぶ＝数え方は1つだけ。
create or replace function public.pv_month_days(v_year int, v_month int)
returns int
language sql
immutable
as $$
  select ((make_date(v_year, v_month, 1) + interval '1 month')::date
          - make_date(v_year, v_month, 1))::int
$$;
revoke all on function public.pv_month_days(int, int) from public, anon, authenticated;

create table if not exists public.pv_work_months (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- ── 同定：user_id は持たない
  -- sha256(uid || '::pv_pay::' || airline[ || '::' || 自由入力の社名（小文字）])
  -- ★ 給与と同じ式（約束 5）。作るのは pv_work_hash だけ・画面には作らせない
  proof_hash    text not null,
  airline       text not null references public.pv_airlines(code),
  airline_other text,

  -- ── 時点（いつの月の話か。created_at では代わりにならない）
  period_year   smallint not null,
  period_month  smallint not null,

  -- ── 条件（どの立場での数字か）
  "position"    text not null references public.pv_positions(code),
  fleet         text references public.pv_fleets(code),
  base_iata     char(3),

  -- ── 勤務の6項目。**全部 null を許す**。null＝未回答・0＝0（約束 2）
  block_hours   numeric(6,2),   -- 乗務時間（ブロックタイム）
  duty_hours    numeric(6,2),   -- 拘束時間
  work_days     smallint,       -- 勤務日数（乗務以外の勤務も含む）
  duty_days     smallint,       -- 乗務日数
  days_off      smallint,       -- 公休日数
  stay_nights   smallint,       -- ステイ泊数

  -- ── 数字の読み方（任意。答えた人の数え方をそのまま残す。集計では混ぜて幅にする）
  -- 拘束時間をどこからどこまでで数えたか
  --   'report_to_release'（出頭〜解放）／'incl_standby'（スタンバイを含む）／
  --   'roster'（勤務表の表示どおり）／'unknown'（分からない）
  duty_hours_basis text,
  -- 通勤・移動を含めたか  'yes' ／ 'no' ／ 'unknown'
  commute_included text,
  -- ひとこと（任意・500字まで）。**本人にしか返さない**（集計にも一覧にも出さない）
  note          text,

  lang          text not null default 'ja'
);

-- 先に表だけ在った場合に備える（列を足した回に流し直しても通る）
alter table public.pv_work_months
  add column if not exists duty_hours_basis text,
  add column if not exists commute_included text,
  add column if not exists note             text;

-- check は毎回 drop してから付け直す（条件を変えて流し直したとき古い定義を残さない）
alter table public.pv_work_months drop constraint if exists pv_work_months_hash_ck;
alter table public.pv_work_months drop constraint if exists pv_work_months_other_ck;
alter table public.pv_work_months drop constraint if exists pv_work_months_period_ck;
alter table public.pv_work_months drop constraint if exists pv_work_months_base_ck;
alter table public.pv_work_months drop constraint if exists pv_work_months_any_ck;
alter table public.pv_work_months drop constraint if exists pv_work_months_range_ck;
alter table public.pv_work_months drop constraint if exists pv_work_months_sum_ck;
alter table public.pv_work_months drop constraint if exists pv_work_months_duty_ck;
alter table public.pv_work_months drop constraint if exists pv_work_months_basis_ck;
alter table public.pv_work_months drop constraint if exists pv_work_months_commute_ck;
alter table public.pv_work_months drop constraint if exists pv_work_months_note_ck;
alter table public.pv_work_months drop constraint if exists pv_work_months_lang_ck;

alter table public.pv_work_months add constraint pv_work_months_hash_ck check (
  proof_hash ~ '^[0-9a-f]{64}$');
-- 「一覧にない会社」のときだけ社名が入る（給与の pay_reports_other_chk と同じ形）
alter table public.pv_work_months add constraint pv_work_months_other_ck check (
  (airline = 'other') = (airline_other is not null)
  and (airline_other is null
       or (airline_other = btrim(airline_other) and char_length(airline_other) between 1 and 80)));
alter table public.pv_work_months add constraint pv_work_months_period_ck check (
  period_year between 2015 and 2100 and period_month between 1 and 12);
alter table public.pv_work_months add constraint pv_work_months_base_ck check (
  base_iata is null or base_iata ~ '^[A-Z]{3}$');
-- ★ 6つ全部が空の行を作らない（約束 3 の裏側）。関数を通らない道で入っても、ここで止まる
alter table public.pv_work_months add constraint pv_work_months_any_ck check (
  block_hours is not null or duty_hours is not null or work_days is not null
  or duty_days is not null or days_off is not null or stay_nights is not null);
-- 範囲。null は通す（未回答）。0 は通す（0 も答え）
alter table public.pv_work_months add constraint pv_work_months_range_ck check (
      (block_hours is null or block_hours between 0 and 200)
  and (duty_hours  is null or duty_hours  between 0 and 450)
  and (work_days   is null or work_days   between 0 and 31)
  and (duty_days   is null or duty_days   between 0 and 31)
  and (days_off    is null or days_off    between 0 and 31)
  and (stay_nights is null or stay_nights between 0 and 31));
-- 勤務日数 ＋ 公休日数 は、その月の日数まで（両方に答えた人だけ見る）
alter table public.pv_work_months add constraint pv_work_months_sum_ck check (
  work_days is null or days_off is null
  or work_days + days_off <= public.pv_month_days(period_year::int, period_month::int));
-- 乗務日数は勤務日数の内数（両方に答えた人だけ見る）
alter table public.pv_work_months add constraint pv_work_months_duty_ck check (
  duty_days is null or work_days is null or duty_days <= work_days);
alter table public.pv_work_months add constraint pv_work_months_basis_ck check (
  duty_hours_basis is null
  or duty_hours_basis in ('report_to_release', 'incl_standby', 'roster', 'unknown'));
alter table public.pv_work_months add constraint pv_work_months_commute_ck check (
  commute_included is null or commute_included in ('yes', 'no', 'unknown'));
alter table public.pv_work_months add constraint pv_work_months_note_ck check (
  note is null or char_length(note) between 1 and 500);
alter table public.pv_work_months add constraint pv_work_months_lang_ck check (
  lang in ('ja', 'en'));

-- 同じ人・同じ会社・同じ月は1行（出し直し＝訂正）。pay_reports_uniq と同じ3つ組
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'pv_work_months_uniq'
                    and conrelid = 'public.pv_work_months'::regclass) then
    alter table public.pv_work_months
      add constraint pv_work_months_uniq unique (proof_hash, period_year, period_month);
  end if;
end $$;

create index if not exists pv_work_months_cell_idx
  on public.pv_work_months (airline, "position", period_year, period_month);

comment on table public.pv_work_months is
  '月の勤務（乗務時間・拘束時間・勤務日数・乗務日数・公休日数・ステイ泊数）。1行＝1人×1社×1か月。'
  '★給与とは別の入口。ここへ出しても給与の資格（REAL PAY の鍵）は付かない。'
  '★6項目は null＝未回答・0＝0。0 で埋めない。'
  '★1件の投稿を会社の決まりや平均として扱わない。外へ出すのは3人以上そろった項目の幅だけ。'
  'RLS 有効・ポリシー無し・grant 無し＝security definer の中からしか読めない。';
comment on column public.pv_work_months.proof_hash is
  '給与（pay_reports.proof_hash）と同じ式。同じ人・同じ会社なら同じ値になる（わざと）。画面へは返さない。';
comment on column public.pv_work_months.duty_hours_basis is
  '拘束時間の数え方（本人の申告）。report_to_release / incl_standby / roster / unknown。';
comment on column public.pv_work_months.commute_included is
  '通勤・移動を含めたか（本人の申告）。yes / no / unknown。';
comment on column public.pv_work_months.note is
  'ひとこと。本人にしか返さない（my_work_months）。集計には使わない。';


-- ════════════════════════════════════════════════════════════════
-- 2. 権限：個票は誰にも読ませない
-- ════════════════════════════════════════════════════════════════
alter table public.pv_work_months enable row level security;

-- SELECT / INSERT / UPDATE / DELETE いずれのポリシーも作らない。
-- 書き込みは submit_work_month・読み出しは my_work_months / pv_work_month_stats 経由のみ。
revoke all on public.pv_work_months from public, anon, authenticated;

-- 既に作ってしまったポリシーがあれば落とす（冪等・事故防止）
do $$
declare q record;
begin
  for q in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'pv_work_months' loop
    execute format('drop policy %I on public.pv_work_months', q.policyname);
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 3. profiles 拡張（連投の数えだけ。権利や称号の列は作らない）
-- ════════════════════════════════════════════════════════════════
-- ★ここに足すのはこの2列だけ。給与の鍵・件数・バッジの列には触らない（約束 1）。
alter table public.profiles
  add column if not exists work_months_day   date,
  add column if not exists work_months_today int not null default 0;


-- ════════════════════════════════════════════════════════════════
-- 4. proof_hash（サーバでしか作らない）
-- ════════════════════════════════════════════════════════════════
-- ★ db/pay-reports.sql の submit_pay_report が作る式と**1文字も違えない**。
--   あちらは式を関数に切り出していない（その場に書いてある）ので、呼べずに写してある。
--   写しが腐ったら db/test-work-months.mjs が赤くなる
--   （実際に給与を出して、pay_reports に入ったハッシュとここの値を突き合わせている）。
--   式を変えるときは pv_my_give / pv_my_keys / pv_pay_person_map も同時に（db/pay-rows.sql）。
create or replace function public.pv_work_hash(v_uid uuid, v_airline text, v_other text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      v_uid::text || '::pv_pay::' || v_airline || coalesce('::' || lower(v_other), ''),
      'sha256'),
    'hex')
$$;
revoke all on function public.pv_work_hash(uuid, text, text) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 5. 数字を1つ読む（未回答と 0 を分ける場所はここだけ）
-- ════════════════════════════════════════════════════════════════
--   鍵が無い・null・空文字 → null（未回答）
--   '0' / 0               → 0
-- ★数の形かどうかを**先に**見る。そのまま ::numeric すると、形が違うときに
--   英語の生のエラーが出る。指数表記・NaN・Infinity・true/false もここで落ちる。
-- ★範囲の外は丸めずに弾く（201 時間を 200 にして受け取らない＝数字を作らない）。
create or replace function public.pv_work_num(
  v_raw text, v_label text, v_lo numeric, v_hi numeric, v_whole boolean)
returns numeric
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  v_txt text := nullif(btrim(coalesce(v_raw, '')), '');
  v_num numeric;
begin
  if v_txt is null then
    return null;
  end if;
  if v_txt !~ '^-?[0-9]{1,6}(\.[0-9]{1,4})?$' then
    raise exception '%は数字で入れてください', v_label using errcode = '22023';
  end if;
  v_num := v_txt::numeric;
  if v_whole and v_num <> trunc(v_num) then
    raise exception '%は整数で入れてください', v_label using errcode = '22023';
  end if;
  if v_num < v_lo or v_num > v_hi then
    raise exception '%は % 〜 % の範囲で入れてください', v_label, v_lo, v_hi
      using errcode = '22023';
  end if;
  -- 時間は小数2桁まで持つ（列が numeric(6,2)）
  return case when v_whole then trunc(v_num) else round(v_num, 2) end;
end;
$$;
revoke all on function public.pv_work_num(text, text, numeric, numeric, boolean)
  from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 6. 勤務を出す
-- ════════════════════════════════════════════════════════════════
-- 受け取る形（p）:
--   airline           … pv_airlines の code。必須。'other' なら airline_other も必須
--   position          … 必須（選択肢に出ている職位だけ）
--   year / month      … 対象月。必須（period_year / period_month でも受ける）
--   fleet / base_iata … 任意
--   block_hours / duty_hours / work_days / duty_days / days_off / stay_nights
--                     … どれも任意。**1つ以上**。無い・null・'' は未回答、0 は 0
--   duty_hours_basis / commute_included / note / lang … 任意
-- 返す形: { ok:true, saved:true, year, month, replaced }
--   replaced … 同じ月を出し直した（＝訂正）なら true
--
-- ★金額は1つも受け取らない。給与の検品（pv_validate_pay_payload）は呼ばない
--   ── あちらは通貨と金額を必須にしているので、呼ぶと「勤務だけ」が出せなくなる。
--   会社・職位・対象月の決まりは、あちらと同じにしてある（同じ文言で止まる）。
create or replace function public.submit_work_month(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_airline text := nullif(btrim(p->>'airline'), '');
  v_other   text := nullif(btrim(p->>'airline_other'), '');
  v_pos     text := nullif(btrim(p->>'position'), '');
  v_fleet   text := nullif(btrim(p->>'fleet'), '');
  v_base    text := upper(nullif(btrim(p->>'base_iata'), ''));
  v_lang    text := lower(coalesce(nullif(btrim(p->>'lang'), ''), 'ja'));
  v_ytxt    text := nullif(btrim(coalesce(p->>'year',  p->>'period_year')),  '');
  v_mtxt    text := nullif(btrim(coalesce(p->>'month', p->>'period_month')), '');
  v_basis   text := nullif(btrim(p->>'duty_hours_basis'), '');
  v_commute text := nullif(btrim(p->>'commute_included'), '');
  v_note    text := nullif(btrim(p->>'note'), '');
  v_year    int;
  v_month   int;
  v_bh      numeric;
  v_dh      numeric;
  v_wd      numeric;
  v_dd      numeric;
  v_od      numeric;
  v_sn      numeric;
  v_hash    text;
  v_prof    record;
  v_new     boolean;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  -- ── 会社・職位・対象月（決まりは給与と同じ）────────────
  if v_airline is null or v_pos is null or v_ytxt is null or v_mtxt is null then
    raise exception '必須項目が足りません（会社・職位・対象月）' using errcode = '22023';
  end if;
  if v_ytxt !~ '^[0-9]{4}$' or v_mtxt !~ '^[0-9]{1,2}$' then
    raise exception '対象月が不正です' using errcode = '22023';
  end if;
  v_year  := v_ytxt::int;
  v_month := v_mtxt::int;
  if v_month not between 1 and 12 then
    raise exception '対象月が不正です' using errcode = '22023';
  end if;
  -- 未来の月は受け取らない（まだ終わっていない勤務は事実ではない）
  if v_year * 12 + v_month
     > extract(year from current_date)::int * 12 + extract(month from current_date)::int then
    raise exception '未来の月は投稿できません' using errcode = '22023';
  end if;
  if v_year < 2015 then
    raise exception '対象年が古すぎます' using errcode = '22023';
  end if;

  if v_airline = 'other' then
    if v_other is null then
      raise exception '「一覧にない会社」を選んだ場合は社名の入力が必要です' using errcode = '22023';
    end if;
    if char_length(v_other) > 80 then
      raise exception '社名が長すぎます（80字まで）' using errcode = '22023';
    end if;
  else
    if not exists (select 1 from public.pv_airlines where code = v_airline and active) then
      raise exception '会社コードが不正です: %', v_airline using errcode = '22023';
    end if;
    v_other := null;   -- 一覧から選んだのに自由入力が残っていたら捨てる
  end if;
  if not exists (select 1 from public.pv_positions where code = v_pos and active) then
    raise exception '職位が不正です: %', v_pos using errcode = '22023';
  end if;

  -- ── 任意の条件 ────────────────────────────────────────
  -- 機材とベースは、語彙に無ければ黙って落とす（ここで投稿ごと弾かない。待遇と同じ）
  if v_fleet is not null and not exists (select 1 from public.pv_fleets where code = v_fleet) then
    v_fleet := null;
  end if;
  if v_base is not null and v_base !~ '^[A-Z]{3}$' then v_base := null; end if;
  if v_lang not in ('ja', 'en') then v_lang := 'ja'; end if;
  -- 数字の読み方は、知らない値なら弾く（黙って落とすと、本人の言った前提が消えた数字だけが残る）
  if v_basis is not null
     and v_basis not in ('report_to_release', 'incl_standby', 'roster', 'unknown') then
    raise exception '拘束時間の数え方が不正です: %', v_basis using errcode = '22023';
  end if;
  if v_commute is not null and v_commute not in ('yes', 'no', 'unknown') then
    raise exception '通勤を含めたかの答えが不正です: %', v_commute using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'ひとことは500字までです' using errcode = '22023';
  end if;

  -- ── 6つの数字（無い・null・'' は未回答。0 は 0）────────
  v_bh := public.pv_work_num(p->>'block_hours', '乗務時間',   0, 200, false);
  v_dh := public.pv_work_num(p->>'duty_hours',  '拘束時間',   0, 450, false);
  v_wd := public.pv_work_num(p->>'work_days',   '勤務日数',   0, 31,  true);
  v_dd := public.pv_work_num(p->>'duty_days',   '乗務日数',   0, 31,  true);
  v_od := public.pv_work_num(p->>'days_off',    '公休日数',   0, 31,  true);
  v_sn := public.pv_work_num(p->>'stay_nights', 'ステイ泊数', 0, 31,  true);

  if v_bh is null and v_dh is null and v_wd is null
     and v_dd is null and v_od is null and v_sn is null then
    raise exception '勤務の項目を1つ以上入れてください（分かるものだけで大丈夫です）'
      using errcode = '22023';
  end if;

  -- ── 項目どうしの筋（両方に答えた人だけ見る）────────────
  if v_wd is not null and v_od is not null
     and v_wd + v_od > public.pv_month_days(v_year, v_month) then
    raise exception '勤務日数と公休日数の合計が、その月の日数を超えています'
      using errcode = '22023';
  end if;
  if v_dd is not null and v_wd is not null and v_dd > v_wd then
    raise exception '乗務日数が勤務日数を超えています' using errcode = '22023';
  end if;

  -- ── 連投の制限（1日40件。24か月ぶんをさかのぼって入れ、少し直せる数）──
  select * into v_prof from public.profiles where id = v_uid for update;
  if not found then
    -- 通常は登録時に行ができている。取りこぼした人をここで詰まらせない
    begin
      insert into public.profiles (id) values (v_uid);
    exception when others then
      raise exception 'プロフィールが作成されていません。一度ログインし直してください。'
        using errcode = '23503';
    end;
    select * into v_prof from public.profiles where id = v_uid for update;
  end if;
  if v_prof.work_months_day is distinct from current_date then
    v_prof.work_months_day   := current_date;
    v_prof.work_months_today := 0;
  end if;
  if v_prof.work_months_today >= 40 then
    raise exception '1日に投稿できる件数の上限に達しました。明日また続きをどうぞ。'
      using errcode = '54000';
  end if;

  v_hash := public.pv_work_hash(v_uid, v_airline, v_other);

  -- ── 行を作る（同じ月が在れば**行ごと**置き換える。省いた項目は null に戻る）──
  insert into public.pv_work_months as w (
    proof_hash, airline, airline_other, period_year, period_month,
    "position", fleet, base_iata,
    block_hours, duty_hours, work_days, duty_days, days_off, stay_nights,
    duty_hours_basis, commute_included, note, lang
  ) values (
    v_hash, v_airline, v_other, v_year, v_month,
    v_pos, v_fleet, v_base,
    v_bh, v_dh, v_wd, v_dd, v_od, v_sn,
    v_basis, v_commute, v_note, v_lang
  )
  on conflict on constraint pv_work_months_uniq do update set
    airline          = excluded.airline,
    airline_other    = excluded.airline_other,
    "position"       = excluded."position",
    fleet            = excluded.fleet,
    base_iata        = excluded.base_iata,
    block_hours      = excluded.block_hours,
    duty_hours       = excluded.duty_hours,
    work_days        = excluded.work_days,
    duty_days        = excluded.duty_days,
    days_off         = excluded.days_off,
    stay_nights      = excluded.stay_nights,
    duty_hours_basis = excluded.duty_hours_basis,
    commute_included = excluded.commute_included,
    note             = excluded.note,
    lang             = excluded.lang,
    updated_at       = now()
  returning (xmax = 0) into v_new;

  update public.profiles set
    work_months_day   = v_prof.work_months_day,
    work_months_today = v_prof.work_months_today + 1
  where id = v_uid;

  return jsonb_build_object(
    'ok', true, 'saved', true,
    'year', v_year, 'month', v_month,
    'replaced', not v_new);
end;
$$;

revoke all on function public.submit_work_month(jsonb) from public, anon;
grant execute on function public.submit_work_month(jsonb) to authenticated;

comment on function public.submit_work_month(jsonb) is
  '月の勤務を出す。6項目のうち1つ以上（無い・null・空文字は未回答、0 は 0）。'
  '同じ人・同じ会社・同じ月は行ごと置き換える（省いた項目は null に戻る）。'
  '★給与の資格は付けない。profiles に書くのは連投の数えだけ。';


-- ════════════════════════════════════════════════════════════════
-- 7. 自分が出した勤務（本人だけ）
-- ════════════════════════════════════════════════════════════════
-- 受け取る形: { airline, airline_other? }
-- 返す形:     { ok:true, rows:[{ year, month, position, fleet, base_iata,
--                block_hours, duty_hours, work_days, duty_days, days_off, stay_nights,
--                duty_hours_basis, commute_included, note }] }
--   新しい月が先・24件まで。
-- ★未回答は null のまま返す（鍵は必ず在る）。0 に直さない・鍵を落とさない
--   ── 画面が「0」と「未回答」を描き分けられるのは、ここが混ぜないから。
-- ★ハッシュ・行の id・時刻は返さない。
create or replace function public.my_work_months(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_airline text := nullif(btrim(p->>'airline'), '');
  v_other   text := nullif(btrim(p->>'airline_other'), '');
  v_hash    text;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if v_airline is null
     or not exists (select 1 from public.pv_airlines where code = v_airline) then
    raise exception '航空会社が正しくありません' using errcode = '22023';
  end if;
  if v_airline <> 'other' then v_other := null; end if;

  v_hash := public.pv_work_hash(v_uid, v_airline, v_other);

  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'year',             z.period_year,
               'month',            z.period_month,
               'position',         z."position",
               'fleet',            z.fleet,
               'base_iata',        z.base_iata,
               'block_hours',      trim_scale(z.block_hours),
               'duty_hours',       trim_scale(z.duty_hours),
               'work_days',        z.work_days,
               'duty_days',        z.duty_days,
               'days_off',         z.days_off,
               'stay_nights',      z.stay_nights,
               'duty_hours_basis', z.duty_hours_basis,
               'commute_included', z.commute_included,
               'note',             z.note)
             order by z.period_year desc, z.period_month desc)
        from (select w.*
                from public.pv_work_months w
               where w.proof_hash = v_hash
               order by w.period_year desc, w.period_month desc
               limit 24) z
    ), '[]'::jsonb));
end;
$$;

revoke all on function public.my_work_months(jsonb) from public, anon;
grant execute on function public.my_work_months(jsonb) to authenticated;

comment on function public.my_work_months(jsonb) is
  '自分が出した月の勤務（その会社のぶん・新しい月が先・24件まで）。未回答は null のまま返す。';


-- ════════════════════════════════════════════════════════════════
-- 8. 幅（外へ出す数字はここだけ）
-- ════════════════════════════════════════════════════════════════

-- 8-a. 壁。★「3人」はこの関数の1か所だけに在る。
--   v_n    … その項目に答えた人数（null は数えていない・0 は数えている）
--   v_step … 丸めの刻み（時間は 5・日数と泊数は 1）
--   3人に届かなければ null。届けば { lo, hi } ＝ 25%点と 75%点。
--   ★人数そのものは返さない。平均も中央値も作らない。
create or replace function public.pv_work_range(
  v_n bigint, v_lo double precision, v_hi double precision, v_step numeric)
returns jsonb
language sql
immutable
as $$
  select case when v_n >= 3 then
           jsonb_build_object(
             'lo', round(v_lo::numeric / v_step) * v_step,
             'hi', round(v_hi::numeric / v_step) * v_step)
         end
$$;
revoke all on function public.pv_work_range(bigint, double precision, double precision, numeric)
  from public, anon, authenticated;

-- 8-b. 会社 × 職位について、月ごとの幅を作る。
--
-- 材料は2つ。
--   wm … この表（pv_work_months）
--   pr … 給与の行（pay_reports）に書かれた勤務の数字。**一覧に出してよい行だけ**
--        ・年換算が常識の幅（年 $10,000〜$700,000）に入っている
--        ・本人の依頼で一覧から下ろした人（pay_hidden）ではない
--        ⚠️ この2つは db/pay-rows.sql の pv_pay_rows が一覧に使っている条件の写し
--           （あちらに「出してよい行」を返す関数が無い）。あちらを変えたらここも直す。
--        ⚠️ pay_reports に「勤務日数」の列は無い。勤務日数は wm からしか来ない。
--
-- 畳み方（同じ人を2回数えない）:
--   ・同じ人の同じ月は1行にする。項目ごとに wm が先・無ければ pr。
--   ・「同じ人」は proof_hash で分かる（給与と同じ式なので、wm と pr で同じ値）。
--   ・★打ち込まれた社名（一覧にない会社）は、給与の一覧と同じ pv_airline_resolve で
--     会社の code に寄せる（当て方を写さない）。打ち込まれた文字列そのものは外へ出ない。
--     ただし綴りが違うと別のハッシュになるので、ハッシュのまま数えると
--     **1人が綴りを3つ変えるだけで3人に数えられる**。
--     そこで名簿（profiles）からハッシュを作り直して本人に戻し、人で畳む
--     （引き方は db/pay-rows.sql の pv_pay_person_map と同じ）。
--     名簿に当たらない打ち込みの行（退会した人）は数えない。
--   ・★uid はこの関数の外へ出ない。person はこの呼び出しの中だけで意味のある印。
--
-- ★内側で yy / mm / items という名前を使わない（RETURNS TABLE の名前と衝突する）。
-- ★'other' そのものは会社として集計しない（別々の会社が1つの箱に混ざる）。
create or replace function public.pv_work_month_cells(v_airline text, v_pos text)
returns table (yy int, mm int, items jsonb)
language sql
security definer
stable
set search_path = public, extensions
as $fn$
  with wm as (
    select w.proof_hash             as hx,
           (w.airline = 'other')    as typed,
           lower(w.airline_other)   as nm,
           w.period_year::int       as py,
           w.period_month::int      as pm,
           w.updated_at             as ts,
           w.block_hours            as bh,
           w.duty_hours             as dh,
           w.work_days::numeric     as wd,
           w.duty_days::numeric     as dd,
           w.days_off::numeric      as od,
           w.stay_nights::numeric   as sn
      from public.pv_work_months w
     where v_airline <> 'other'
       and w."position" = v_pos
       and case when w.airline = 'other'
                then public.pv_airline_resolve(w.airline_other)
                else w.airline end = v_airline
  ),
  pr as (
    select r.proof_hash             as hx,
           (r.airline = 'other')    as typed,
           lower(r.airline_other)   as nm,
           r.period_year::int       as py,
           r.period_month::int      as pm,
           r.created_at             as ts,
           r.block_hours            as bh,
           r.duty_hours             as dh,
           null::numeric            as wd,
           r.duty_days::numeric     as dd,
           r.days_off::numeric      as od,
           r.stay_nights::numeric   as sn
      from public.pay_reports r
     where v_airline <> 'other'
       and r."position" = v_pos
       and case when r.airline = 'other'
                then public.pv_airline_resolve(r.airline_other)
                else r.airline end = v_airline
       and r.annual_total_usd between 10000 and 700000
       and not exists (select 1 from public.pay_hidden g where g.proof_hash = r.proof_hash)
       and (r.block_hours is not null or r.duty_hours is not null or r.duty_days is not null
            or r.days_off is not null or r.stay_nights is not null)
  ),
  names as (
    -- この会社に当たった「打ち込まれた社名」（小文字）。ハッシュの材料にするだけ
    select nm from wm where typed
    union
    select nm from pr where typed
  ),
  who as (
    -- 名簿からハッシュを作り直す ＝ ハッシュ → 本人
    select public.pv_work_hash(f.id, v_airline, null) as kx, f.id as pid
      from public.profiles f
    union all
    select public.pv_work_hash(f.id, 'other', n.nm), f.id
      from public.profiles f
     cross join names n
  ),
  src as (
    -- pri … 項目ごとにどの行を先に使うか。wm（一覧の会社 → 打ち込み）→ pr（同じ順）
    select case when x.typed then k.pid::text
                else coalesce(k.pid::text, x.hx) end as person,
           x.py, x.pm, x.pri, x.ts, x.bh, x.dh, x.wd, x.dd, x.od, x.sn
      from (select hx, typed, py, pm, ts, bh, dh, wd, dd, od, sn,
                   case when typed then 1 else 0 end as pri
              from wm
            union all
            select hx, typed, py, pm, ts, bh, dh, wd, dd, od, sn,
                   case when typed then 3 else 2 end
              from pr) x
      left join who k on k.kx = x.hx
  ),
  folded as (
    -- 1人 × 1か月 ＝ 1行。項目ごとに、答えの在る最初の行を取る（null は飛ばす・0 は答え）
    select s.person, s.py, s.pm,
           (array_agg(s.bh order by s.pri, s.ts desc) filter (where s.bh is not null))[1] as bh,
           (array_agg(s.dh order by s.pri, s.ts desc) filter (where s.dh is not null))[1] as dh,
           (array_agg(s.wd order by s.pri, s.ts desc) filter (where s.wd is not null))[1] as wd,
           (array_agg(s.dd order by s.pri, s.ts desc) filter (where s.dd is not null))[1] as dd,
           (array_agg(s.od order by s.pri, s.ts desc) filter (where s.od is not null))[1] as od,
           (array_agg(s.sn order by s.pri, s.ts desc) filter (where s.sn is not null))[1] as sn
      from src s
     where s.person is not null
     group by s.person, s.py, s.pm
  )
  -- count(列) は null を数えない ＝ その項目に答えた人数（0 と答えた人は入る）
  select o.py, o.pm,
         jsonb_build_object(
           'block_hours', public.pv_work_range(count(o.bh),
             percentile_cont(0.25) within group (order by o.bh),
             percentile_cont(0.75) within group (order by o.bh), 5),
           'duty_hours',  public.pv_work_range(count(o.dh),
             percentile_cont(0.25) within group (order by o.dh),
             percentile_cont(0.75) within group (order by o.dh), 5),
           'work_days',   public.pv_work_range(count(o.wd),
             percentile_cont(0.25) within group (order by o.wd),
             percentile_cont(0.75) within group (order by o.wd), 1),
           'duty_days',   public.pv_work_range(count(o.dd),
             percentile_cont(0.25) within group (order by o.dd),
             percentile_cont(0.75) within group (order by o.dd), 1),
           'days_off',    public.pv_work_range(count(o.od),
             percentile_cont(0.25) within group (order by o.od),
             percentile_cont(0.75) within group (order by o.od), 1),
           'stay_nights', public.pv_work_range(count(o.sn),
             percentile_cont(0.25) within group (order by o.sn),
             percentile_cont(0.75) within group (order by o.sn), 1))
    from folded o
   group by o.py, o.pm
$fn$;

-- ★誰にも渡さない。pv_work_month_stats の中からだけ呼ぶ。
revoke all on function public.pv_work_month_cells(text, text) from public, anon, authenticated;

-- 8-c. 外から呼ぶ口（未ログインでも呼べる）。
-- 受け取る形: { airline, position, year?, month? }
-- 返す形:
--   年月あり … { ok:true, airline, position, year, month,
--                items:{ block_hours, duty_hours, work_days, duty_days, days_off, stay_nights } }
--              各項目は { lo, hi } か null（3人に届かない）
--   年月なし … { ok:true, airline, position, months:[{ year, month }] }
--              どれか1項目でも幅が出る月だけ・新しい月が先・24件まで
-- ★個票は返さない。人数も返さない（幅が出ていること＝3人以上、としか分からない）。
-- ★3人に届かない月と、誰も出していない月は、**同じ返事**になる。
create or replace function public.pv_work_month_stats(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_airline text := nullif(btrim(p->>'airline'), '');
  v_pos     text := nullif(btrim(p->>'position'), '');
  v_ytxt    text := nullif(btrim(coalesce(p->>'year',  p->>'period_year')),  '');
  v_mtxt    text := nullif(btrim(coalesce(p->>'month', p->>'period_month')), '');
  v_year    int;
  v_month   int;
  v_items   jsonb;
begin
  if v_airline is null
     or not exists (select 1 from public.pv_airlines where code = v_airline) then
    raise exception '航空会社が正しくありません' using errcode = '22023';
  end if;
  if v_pos is null
     or not exists (select 1 from public.pv_positions where code = v_pos) then
    raise exception '職位が正しくありません' using errcode = '22023';
  end if;

  -- ── 年月なし：幅が出る月の一覧 ─────────────────────────
  if v_ytxt is null and v_mtxt is null then
    return jsonb_build_object(
      'ok', true, 'airline', v_airline, 'position', v_pos,
      'months', coalesce((
        select jsonb_agg(jsonb_build_object('year', z.yy, 'month', z.mm)
                         order by z.yy desc, z.mm desc)
          from (select c.yy, c.mm
                  from public.pv_work_month_cells(v_airline, v_pos) c
                 where exists (select 1 from jsonb_each(c.items) e
                                where jsonb_typeof(e.value) <> 'null')
                 order by c.yy desc, c.mm desc
                 limit 24) z
      ), '[]'::jsonb));
  end if;

  -- ── 年月あり：その月の幅 ───────────────────────────────
  if v_ytxt is null or v_mtxt is null
     or v_ytxt !~ '^[0-9]{4}$' or v_mtxt !~ '^[0-9]{1,2}$' then
    raise exception '年月が正しくありません' using errcode = '22023';
  end if;
  v_year  := v_ytxt::int;
  v_month := v_mtxt::int;
  if v_year not between 2015 and 2100 or v_month not between 1 and 12 then
    raise exception '年月が正しくありません' using errcode = '22023';
  end if;

  select c.items into v_items
    from public.pv_work_month_cells(v_airline, v_pos) c
   where c.yy = v_year and c.mm = v_month;

  return jsonb_build_object(
    'ok', true, 'airline', v_airline, 'position', v_pos,
    'year', v_year, 'month', v_month,
    -- 行が1つも無い月は、3人に届かない月と同じ形（全部 null）で返す
    'items', coalesce(v_items, jsonb_build_object(
      'block_hours', null, 'duty_hours', null, 'work_days', null,
      'duty_days', null, 'days_off', null, 'stay_nights', null)));
end;
$$;

revoke all on function public.pv_work_month_stats(jsonb) from public;
grant execute on function public.pv_work_month_stats(jsonb) to anon, authenticated;

comment on function public.pv_work_month_stats(jsonb) is
  '月の勤務の幅（会社×職位×月）。項目ごとに3人以上が答えたときだけ { lo, hi }（25%点〜75%点）。'
  '平均・中央値・人数・個票は返さない。年月を省くと、幅が出る月の一覧（新しい順・24件まで）。';


-- ════════════════════════════════════════════════════════════════
-- 9. 検算（貼ったあとに出る1行）
-- ════════════════════════════════════════════════════════════════
-- ポリシー数は 0・それ以外は全部 true が正しい。
-- ★「給与の資格に触らない」は、関数の中身を文字で見ている。
--   submit_work_month の**中に**、給与の鍵や件数の列名を注意書きとしても書かないこと
--   （書くと注意書きだけで false になる。説明はこのファイルの冒頭に置いてある）。
select (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'pv_work_months')            as ポリシー数,
       (select relrowsecurity from pg_class
         where oid = 'public.pv_work_months'::regclass)                           as 表は閉じている,
       not has_function_privilege('anon', 'public.submit_work_month(jsonb)', 'execute')
                                                                                  as 未ログインは出せない,
       has_function_privilege('anon', 'public.pv_work_month_stats(jsonb)', 'execute')
                                                                                  as 幅は誰でも読める,
       pg_get_functiondef('public.submit_work_month(jsonb)'::regprocedure)
         !~ '(access_until|pay_report|pay_streak|last_pay|badge|verify_level|founding)'
                                                                                  as 給与の資格に触らない,
       pg_get_functiondef('public.pv_my_give()'::regprocedure) not like '%pv_work_months%'
         and pg_get_functiondef('public.pv_pay_rows()'::regprocedure) not like '%pv_work_months%'
                                                                                  as 給与の門はこの表を読まない;
