-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/pay-reports.sql
--
-- 給与レポート（月次パネル）の基盤。口コミ（reviews_v2）とは別テーブルにする。
-- ライフサイクルが違うため：口コミは一度、給与は毎月。
--
-- ★ このファイルは自動では流れない。オーナーの明示承認後に SQL Editor で実行する。
-- ★ 先に db/airlines.generated.sql と db/vocab.generated.sql を流すこと
--    （このテーブルが外部キーで参照する）。順番を守らないと 42P01 で落ちる。
-- 冪等（何度流しても安全）。
--
-- ── この設計が守っている約束 ────────────────────────────────
--  1. user_id を持たない。運営者も個人に辿り着けない。
--     就業規則で報酬開示を禁じる会社の下で書いてもらうための前提。
--  2. 原本（通貨と各金額）を絶対に失わない。換算は後から再計算できるが、
--     原本は復元できない。だから正規化した値だけを保存する設計にはしない。
--  3. 集計は公開・個票は非公開を、UI ではなく DB の権限で担保する。
--     pay_reports に SELECT ポリシーを作らない。公開するのは pay_benchmarks だけ。
--  4. 派生値（年換算・$/block hour・手取り）は入力させない。人によって
--     計算根拠が違うゴミが溜まる。サーバが計算して返す＝これが投稿の見返り。
-- ════════════════════════════════════════════════════════════════

-- ── 0. 前提 ─────────────────────────────────────────────────
-- proof_hash をサーバ側で計算するために使う。Supabase では extensions スキーマ。
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regclass('public.pv_airlines') is null then
    raise exception '先に db/airlines.generated.sql を実行してください';
  end if;
  if to_regclass('public.pv_fleets') is null then
    raise exception '先に db/vocab.generated.sql を実行してください';
  end if;
  -- 年代（2026-08-18 追加）。古い vocab.generated.sql のままだとここで止まる。
  if to_regclass('public.pv_age_buckets') is null then
    raise exception 'db/vocab.generated.sql が古いです（pv_age_buckets が無い）。先に最新を実行してください';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. pay_reports
-- ════════════════════════════════════════════════════════════════
create table if not exists public.pay_reports (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  -- ── 同定：user_id は持たない（疑似匿名を維持）
  -- proof_hash = sha256(auth.uid() || '::pv_pay::' || airline[ || '::' || 自由入力社名 ])
  -- 既存の口コミ側と違い、年を含めない（期間は period_* 列で持つ）。
  -- ★ クライアントに計算させない。RPC の中でサーバが計算する（偽装できない）。
  proof_hash    text not null,
  airline       text not null references public.pv_airlines(code),
  airline_other text check (airline_other is null or length(btrim(airline_other)) between 1 and 80),
  base_iata     char(3) check (base_iata is null or base_iata ~ '^[A-Z]{3}$'),

  -- ── 期間（これが無いとパネルにならない。created_at では「いつ時点の報酬か」が消える）
  period_year  smallint not null check (period_year between 2015 and 2100),
  period_month smallint not null check (period_month between 1 and 12),

  -- ── 職務（語彙は pv-vocab.mjs / salary-leveling.js と同一）
  "position"   text not null references public.pv_positions(code),
  fleet        text not null references public.pv_fleets(code),
  fleet_cat    text check (fleet_cat in ('r','n','w')),   -- pv_fleets から自動で入る
  job_role     text references public.pv_job_roles(code),
  -- 年代（10歳刻み）。年齢そのものは聞かない。会社×職位が同じでも、
  -- 30代と50代では別の数字になるので、これが無いと比較の意味が薄い。
  -- 口コミ（reviews_v2.age_bucket）と同じ列名・同じコード体系にしてある。
  age_bucket   text references public.pv_age_buckets(code),

  -- ── 通貨（原本。ここを失うと二度と戻せない）
  currency     char(3) not null references public.pv_currencies(code),
  fx_to_usd    numeric(14,6) check (fx_to_usd  is null or fx_to_usd  > 0),
  fx_to_jpy    numeric(14,6) check (fx_to_jpy  is null or fx_to_jpy  > 0),
  fx_at        date,

  -- ── 月額（すべて currency の単位・給与明細に書いてある事実だけ）
  --
  -- ★ gross_monthly と、その下の内訳（base_pay 以下）は**排他ではない**（2026-08-26）。
  --   ・gross_monthly = 「その月の額面（総支給）」1本。明細を開かずに答えられる唯一の数字。
  --   ・内訳          = その総支給の**中身の説明**。分かるものだけ入る。
  --   合計が一致する必要は無い。差は pay-viz.js が「どの項目にも入れていない分」として
  --   灰色に描く（＝ Unclassified）。年換算は今までどおり総支給が正なので、
  --   両方入っていても年収は1円も動かない（pv_annual_total の coalesce の第1引数）。
  --   ★ 総支給を base_pay に入れないこと。pay-viz.js の segments() が base_pay を
  --     「基本給」として1切れに描くので、支給構成が『基本給100%』という嘘の図になる。
  gross_monthly    numeric(14,2) check (gross_monthly    is null or gross_monthly    >= 0),
  base_pay         numeric(14,2) check (base_pay         is null or base_pay         >= 0),
  hourly_rate      numeric(14,2) check (hourly_rate      is null or hourly_rate      >= 0),
  guaranteed_hours numeric(6,2)  check (guaranteed_hours is null or guaranteed_hours between 0 and 200),
  block_hours      numeric(6,2)  check (block_hours      is null or block_hours      between 0 and 200),
  duty_days        smallint      check (duty_days        is null or duty_days        between 0 and 31),
  days_off         smallint      check (days_off         is null or days_off         between 0 and 31),
  stay_nights      smallint      check (stay_nights      is null or stay_nights      between 0 and 31),
  sectors          smallint      check (sectors          is null or sectors          between 0 and 400),
  per_diem         numeric(14,2) check (per_diem         is null or per_diem         >= 0),
  housing_type     text          references public.pv_housing_types(code),
  housing_amount   numeric(14,2) check (housing_amount   is null or housing_amount   >= 0),
  transport        numeric(14,2) check (transport        is null or transport        >= 0),
  command_pay      numeric(14,2) check (command_pay      is null or command_pay      >= 0),
  other_allowance  numeric(14,2) check (other_allowance  is null or other_allowance  >= 0),

  -- ★ その月の総支給に含まれているボーナス（2026-08-13 追加）。年額の bonus_annual
  --   とは別物。総支給は「明細のとおり」なので、ボーナスが出た月はそれが入っている。
  --   pv_annual_total は ×12 する前にこの額を引く（引かないと年収が跳ね上がる）。
  bonus_month      numeric(14,2) check (bonus_month      is null or bonus_month      >= 0),

  -- ── 年額（currency 単位）
  bonus_annual        numeric(14,2) check (bonus_annual        is null or bonus_annual        >= 0),
  profit_share_annual numeric(14,2) check (profit_share_annual is null or profit_share_annual >= 0),
  pension_pct         numeric(5,2)  check (pension_pct         is null or pension_pct  between 0 and 100),

  -- ── 契約・税（国から自動決定しない。既定値を提示し本人が確認・上書きする）
  contract_type   text references public.pv_contract_types(code),
  tax_country     char(2) check (tax_country is null or tax_country ~ '^[A-Z]{2}$'),
  nationality     char(2) check (nationality is null or nationality ~ '^[A-Z]{2}$'),
  tax_rate_pct    numeric(5,2)  check (tax_rate_pct    is null or tax_rate_pct    between 0 and 100),
  seniority_years smallint      check (seniority_years is null or seniority_years between 0 and 60),

  -- ── 検証（法人に売り物になるのは verify_level >= 1 の行だけ）
  verify_level  smallint not null default 0 check (verify_level between 0 and 3),
  verify_method text,
  verified_at   timestamptz,

  -- ── 派生（入力させない。RPC が計算して入れる）
  annual_total_orig  numeric(14,2),
  annual_total_usd   numeric(14,2),
  annual_total_jpy   numeric(14,2),
  usd_per_block_hour numeric(10,2),
  net_annual_jpy     numeric(14,2),

  -- ── 明細に印字されている実額（Step7-B2）。すべて原本通貨・すべて任意。
  --    推定ではなく事実なので、上の派生列とは価値が段違い。
  --    ★ 控除は「合計」しか持たない。内訳を持つと組合費から所属組合が割れる。
  net_pay_actual      numeric(14,2) check (net_pay_actual      is null or net_pay_actual      >= 0),
  ytd_taxable         numeric(14,2) check (ytd_taxable         is null or ytd_taxable         >= 0),
  flight_variable_pay numeric(14,2) check (flight_variable_pay is null or flight_variable_pay >= 0),
  deduction_total     numeric(14,2) check (deduction_total     is null or deduction_total     >= 0),
  -- 勤務実績。block_hours（既存）は「飛んでいた時間」、duty は待機・地上を含む拘束時間。
  -- credit は米国式で、リグ・欠航補償を含むため実飛行時間を超える＝block と混ぜない。
  duty_hours   numeric(6,2) check (duty_hours   is null or duty_hours   between 0 and 400),
  night_hours  numeric(6,2) check (night_hours  is null or night_hours  between 0 and 400),
  credit_hours numeric(6,2) check (credit_hours is null or credit_hours between 0 and 400),

  lang   text not null default 'en',
  source text not null default 'web',

  -- 自由入力の社名は 'other' のときだけ。集計不能な行が airline 側に混ざるのを防ぐ。
  constraint pay_reports_other_chk
    check ((airline = 'other') = (airline_other is not null)),

  -- 同一人物・同一社・同一月は1件（＝月次の単位を定義する）
  constraint pay_reports_uniq unique (proof_hash, period_year, period_month)
);

-- ★ 上の create table は「if not exists」なので、既に本番にあるテーブルには
--    1列も足さない。既存DBに Step7-B2 の列を入れるのはこちら。
--    すべて nullable ＝ 既存行も、既存の投稿フォームも1つも壊れない。
alter table public.pay_reports
  add column if not exists net_pay_actual      numeric(14,2),
  add column if not exists ytd_taxable         numeric(14,2),
  add column if not exists flight_variable_pay numeric(14,2),
  add column if not exists deduction_total     numeric(14,2),
  add column if not exists duty_hours          numeric(6,2),
  add column if not exists night_hours         numeric(6,2),
  add column if not exists credit_hours        numeric(6,2),
  -- ★ 休日数とセクター数（PAY-EXTRAS.md）。給与明細ではなくロスターに書いてある
  --    数字なので、parse-payslip では埋まらない＝本人の手入力（任意）。
  add column if not exists days_off            smallint,
  add column if not exists sectors             smallint,
  -- ★ かんたん入力の「その月の額面（総支給）」。2026-08-12 追加。
  --    「基本給って何よ」で止まる人のための1本。内訳と両立する（上のコメント参照）。
  add column if not exists gross_monthly       numeric(14,2),
  -- ★ 2026-08-26 追加。保証給（Minimum Guarantee など）。
  --    基本給とは**別の列**に持つ。足し込むと二度と割り戻せないし、
  --    レポートの「基本給」の切れが嘘になる（日本＝基本給、米国＝保証給が下限）。
  --    ⚠️ guaranteed_hours（保証**時間**）とは別物。時間 × 単価を本人に
  --       計算させないためにこの列を足した（オーナー指示）。
  add column if not exists guarantee_pay       numeric(14,2),
  -- ★ 2026-08-13 追加。ステイ日数（基地の外で泊まった泊数）と、
  --    その月の総支給に含まれているボーナス。どちらも本人の手入力（必須）。
  add column if not exists stay_nights         smallint,
  add column if not exists bonus_month         numeric(14,2),
  -- ★ 2026-08-14 追加。読めた手当を1行ずつ（項目名・金額・分類）そのまま溜める。
  --    画面は1文字も変えない。いまのフォームは深夜割増も変動付加乗務手当も
  --    「その他手当」に合算するので、送った瞬間に内訳が消えていた。
  --    ★一度取り損ねた内訳は、あとから遡って集められない（VISION：一次データ＝Asset）。
  --    形は {"v":1,"earnings":[{label,amount,kind}],"unmapped":[…],"hours":[…],
  --          "gross_printed":…,"checks":{…}}。
  --    ★控除の内訳は入れない（組合費からどの組合に属しているかが割れる）。
  --    ★これを Verified の判定に使わない。source と同じでクライアント申告。
  --    ★公開面に出る道が無いことを設計で担保している：pay_reports はポリシーを
  --      1つも作らず revoke all（下部）＝ anon も authenticated も1行も読めない。
  --      公開されるのは k≧5 の pay_benchmarks だけで、そのビューはこの列を触らない。
  add column if not exists payslip_detail      jsonb,
  -- ★ 2026-08-18 追加。年代（10歳刻み）。外部キーは下の do ブロックで冪等に張る
  --    （add column if not exists は制約を後付けしない）。
  add column if not exists age_bucket          text,
  -- ★ 2026-08-26 追加。役職・区分を**複数**持てるようにした（オーナー指示）。
  --    ラインを飛びながら教官、組合の役員も兼ねる、は普通にある。
  --    ⚠️ job_role（単数）は消さない。過去の全行がそちらを持っていて、
  --       明細読み取りと管理者メールもそちらを見ている。新しい投稿は
  --       job_roles[1]（主たる役割）を job_role にも入れて両方そろえる。
  --    ⚠️ 外部キーは張らない（text[] には張れない）。代わりに
  --       pv_validate_pay_payload が pv_job_roles に在るコードだけ通す。
  add column if not exists job_roles           text[],
  -- ★ 2026-08-26 追加。給与の内訳のうち「行が何本あるか会社ごとに違う」ぶん
  --    （変動給・その他の現金手当）を、行の形のまま溜める。
  --    形は {"v":1,"fixed_none":bool,
  --          "variable":[{amount,basis,label,rule}],"other":[{amount,label}]}。
  --    ★合計は既存の列に寄せてある（変動給→flight_variable_pay、
  --      変動給＋その他→other_allowance）ので、集計もレポートの図も
  --      この列を読まなくてよい。ここは「何に対して払われているか」を残すため。
  --    ★payslip_detail と同じ扱い：Verified の判定に使わない（クライアント申告）。
  --      公開面に出る道も同じく無い（pay_reports は revoke all）。
  add column if not exists pay_items           jsonb;

do $$
begin
  -- 年代の外部キー。既存行は全部 null なので、いま張っても1行も落ちない。
  if not exists (select 1 from pg_constraint where conname = 'pay_reports_age_bucket_fkey') then
    alter table public.pay_reports add constraint pay_reports_age_bucket_fkey
      foreign key (age_bucket) references public.pv_age_buckets(code);
  end if;
end $$;

do $$
declare c text;
begin
  -- add column if not exists は check を後付けしないので、制約はここで冪等に張る。
  foreach c in array array['net_pay_actual','ytd_taxable','flight_variable_pay','deduction_total'] loop
    if not exists (select 1 from pg_constraint where conname = 'pay_reports_' || c || '_chk') then
      execute format('alter table public.pay_reports add constraint %I check (%I is null or %I >= 0)',
                     'pay_reports_' || c || '_chk', c, c);
    end if;
  end loop;
  foreach c in array array['duty_hours','night_hours','credit_hours'] loop
    if not exists (select 1 from pg_constraint where conname = 'pay_reports_' || c || '_chk') then
      execute format('alter table public.pay_reports add constraint %I check (%I is null or %I between 0 and 400)',
                     'pay_reports_' || c || '_chk', c, c);
    end if;
  end loop;
  -- 休日は最大31日。セクターは短距離の最繁忙で月80〜100本なので、400は
  -- 「打ち間違いは弾くが、実在する人は弾かない」線。
  if not exists (select 1 from pg_constraint where conname = 'pay_reports_days_off_chk') then
    alter table public.pay_reports add constraint pay_reports_days_off_chk
      check (days_off is null or days_off between 0 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pay_reports_sectors_chk') then
    alter table public.pay_reports add constraint pay_reports_sectors_chk
      check (sectors is null or sectors between 0 and 400);
  end if;
  -- ステイは1泊単位なので日数と同じ上限。31泊＝丸ごと帰っていない月。
  if not exists (select 1 from pg_constraint where conname = 'pay_reports_stay_nights_chk') then
    alter table public.pay_reports add constraint pay_reports_stay_nights_chk
      check (stay_nights is null or stay_nights between 0 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pay_reports_bonus_month_chk') then
    alter table public.pay_reports add constraint pay_reports_bonus_month_chk
      check (bonus_month is null or bonus_month >= 0);
  end if;
end $$;

create index if not exists pay_reports_seg_idx
  on public.pay_reports (airline, "position", fleet, period_year, period_month);

comment on table  public.pay_reports is
  '給与レポート（月次）。user_id を持たない＝運営者も個人に辿り着けない。権利判定は profiles 側。';
comment on column public.pay_reports.annual_total_orig is
  '年換算の現金報酬（原本通貨）。= 12 ×（基本給 + 時給×max(実績,保証) + パーディアム + 住宅手当（現金のみ）'
  ' + 交通 + 役職手当 + その他）+ 賞与 + プロフィットシェア。'
  '★ 会社負担の年金（pension_pct）と現物支給の住居は含めない（現金ではないため）。'
  '比較可能性のために定義を1つに固定する。変更するときは既存行の再計算も同時に行うこと。';
comment on column public.pay_reports.base_iata is
  '基地。★ 公開集計には絶対に出さない（k≧5 でも準識別子として個人に絞り込めるため）。内部分析のみ。';
comment on column public.pay_reports.days_off is
  'ロスターで OFF と指定された日数。年休・スタンバイ・訓練・病欠は含めない。'
  '★「月の日数 − 乗務日数」で作らない。年休を10日取った月が「10日休めた」に化ける。';
comment on column public.pay_reports.sectors is
  '有償フライトの区間数（離陸〜着陸で1本）。デッドヘッドは含めない。'
  '★ block hours だけでは「長距離8本」と「短距離80本」が同じ数字になる。'
  '疲労と拘束の量はここにしか出ない。';
comment on column public.pay_reports.stay_nights is
  'ステイ日数＝基地の外で泊まった泊数（レイオーバー）。日帰りだけの月は 0。'
  '★「月の日数 − 乗務日数」で作らない（days_off と同じ罠）。'
  '同じ年収でも家に帰れない日数は会社ごとにまったく違う。ここにしか出ない。';
comment on column public.pay_reports.bonus_month is
  'その月の総支給（gross_monthly）に含まれているボーナス。出ていない月は 0。'
  '★ bonus_annual（1年の合計）とは別物。足し合わせないこと。'
  'pv_annual_total は (gross_monthly − bonus_month) × 12 + bonus_annual で年換算する。';


-- ════════════════════════════════════════════════════════════════
-- 2. 権限：個票は誰にも読ませない
-- ════════════════════════════════════════════════════════════════
alter table public.pay_reports enable row level security;

-- SELECT / INSERT / UPDATE / DELETE いずれのポリシーも作らない。
-- ＝ anon も authenticated も直接は1行も読めない・書けない。
-- 書き込みは submit_pay_report（security definer）経由のみ。
revoke all on public.pay_reports from anon, authenticated;

-- 既に作ってしまったポリシーがあれば落とす（冪等・事故防止）
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'pay_reports' loop
    execute format('drop policy %I on public.pay_reports', p.policyname);
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 3. profiles 拡張（権利判定はこちら側だけで行う）
-- ════════════════════════════════════════════════════════════════
alter table public.profiles
  add column if not exists last_review_at      timestamptz,
  add column if not exists last_pay_report_at  timestamptz,
  add column if not exists pay_report_count    int      not null default 0,
  add column if not exists pay_streak_months   int      not null default 0,
  add column if not exists last_pay_period_ym  int,      -- 直近レポートの対象月 = year*12+month
  add column if not exists verify_level        smallint not null default 0,
  add column if not exists verified_airline    text,
  add column if not exists verified_at         timestamptz,
  add column if not exists badge               text     not null default 'none',
  add column if not exists badge_state         text     not null default 'none',
  add column if not exists access_until        timestamptz,
  -- レート制限用。unique(proof_hash, 年, 月) は「同じ社の同じ月」しか止められないため、
  -- 110社 × 12ヶ月を一人で投げ込む荒らしを防ぐにはこれが要る。
  add column if not exists pay_reports_day     date,
  add column if not exists pay_reports_today   int      not null default 0,

  -- ── 月次リマインドの同意（既定は false。同意した人にしか一通も送らない）──
  -- 世界規模が前提なので、EU 圏の人が来ることを織り込んで作る＝明示同意と
  -- 1クリック解除を最初から持つ。後付けだと送信済みのぶんが取り返せない。
  add column if not exists mail_optin          boolean  not null default false,
  add column if not exists mail_optin_at       timestamptz,
  -- 解除リンク用。メールアドレスをURLに載せない（載せると転送・ログで漏れる）。
  add column if not exists mail_unsub_token    uuid     not null default gen_random_uuid(),
  -- 二重送信よけ。cron が二度走っても同じ月に二通は出さない。
  add column if not exists mail_last_sent_at   timestamptz,
  -- その人の給料日（1〜31）。世界規模なので「毎月25日に一斉送信」は誤り。
  -- 日本は25日前後、湾岸は月末、米国は月2回。null のうちは投稿日から学習する。
  add column if not exists pay_day_of_month    smallint;

create unique index if not exists profiles_mail_unsub_token_idx
  on public.profiles (mail_unsub_token);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_badge_chk') then
    alter table public.profiles add constraint profiles_badge_chk
      check (badge in ('none','contributor','verified','gold'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_badge_state_chk') then
    alter table public.profiles add constraint profiles_badge_state_chk
      check (badge_state in ('none','active','inactive'));
  end if;
end $$;

comment on column public.profiles.badge is
  'none/contributor/verified/gold。★ 検証を通したときだけ verified 以上にする。'
  '入力回数・継続では絶対に上げない（自己申告を3回繰り返しても本物の証明にならない）。';
comment on column public.profiles.access_until is
  '解放の期限（サーバ側の正）。★「永続」を作らない。最長でも12ヶ月先までしか伸びない。';


-- ════════════════════════════════════════════════════════════════
-- 4. 年換算の計算（定義を1箇所に固定する）
-- ════════════════════════════════════════════════════════════════
-- ★ 2026-08-12 に引数が1つ増えた（p_gross_monthly）。2026-08-13 にもう1つ増えた
--   （p_bonus_month）。2026-08-26 にもう1つ増えた（p_guarantee_pay）。
--   create or replace は引数リストを変えられない（別の関数として
--   増えるだけ）ので、古い版を先に落とす。落とさないと、呼び出し側の引数の数によって
--   新旧どちらが呼ばれるかが変わり、同じ入力から違う年収が出る。
drop function if exists public.pv_annual_total(
  numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric);
drop function if exists public.pv_annual_total(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric);
drop function if exists public.pv_annual_total(
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric);

create or replace function public.pv_annual_total(
  p_gross_monthly    numeric,
  p_base_pay         numeric, p_hourly_rate numeric, p_guaranteed_hours numeric,
  p_block_hours      numeric, p_per_diem    numeric,
  p_housing_type     text,    p_housing_amount numeric,
  p_transport        numeric, p_command_pay numeric, p_other_allowance numeric,
  p_bonus_annual     numeric, p_profit_share_annual numeric,
  p_bonus_month      numeric default null,
  -- ★ 2026-08-26 追加。保証給（金額）。基本給と足して1本にしない。
  --    末尾に置くのは、13引数で呼んでいる既存の呼び出しを1つも壊さないため。
  p_guarantee_pay    numeric default null
) returns numeric
language sql immutable as $$
  select 12 * coalesce(
         /* ── かんたん入力：その月の額面（総支給）が1本だけ来る ──
            ★ここで内訳を足してはいけない。総支給には住宅手当も乗務手当も
              パーディアムも既に入っているので、足すと二重計上になる。
              coalesce の第1引数に置く＝入っていれば下は一切評価しない。
            ★総支給は「明細のとおり」なので、ボーナスが出た月はそれが入っている。
              ×12 する前にその月のボーナスだけ引く（2026-08-13）。
            ★greatest を case when で包むこと。Postgres の greatest は null を
              無視するので、greatest(null - 0, 0) は null ではなく 0 を返す。
              包まないと、総支給が無い行が「年収0」になって内訳へ落ちない。 */
           case when nullif(p_gross_monthly, 0) is not null
                then greatest(p_gross_monthly - coalesce(p_bonus_month, 0), 0) end,
         /* ── くわしく入力／明細から読めた場合：内訳を足し上げる ── */
           coalesce(p_base_pay, 0)
         -- 保証給（Minimum Guarantee）。基本給と別に明細へ出ている会社のぶん。
         + coalesce(p_guarantee_pay, 0)
         -- 時給は「実績と保証時間の大きい方」で払われるのが業界の標準的な建て付け
         + coalesce(p_hourly_rate, 0)
           * greatest(coalesce(p_block_hours, 0), coalesce(p_guaranteed_hours, 0))
         + coalesce(p_per_diem, 0)
         -- 現物支給の社宅は現金ではないので足さない（足すと現金報酬と比較できなくなる）
         + case when p_housing_type = 'allowance' then coalesce(p_housing_amount, 0) else 0 end
         + coalesce(p_transport, 0)
         + coalesce(p_command_pay, 0)
         + coalesce(p_other_allowance, 0)
         )
         -- 年間ボーナスは月額の外（月によって出る／出ないが変わるため、額面×12 に
         -- 混ぜると同じ人の年収が月ごとに倍ちがう）。ここに p_bonus_month を足さない
         -- ＝それは既に総支給の中にあり、上で引いた額そのもの。
         + coalesce(p_bonus_annual, 0)
         + coalesce(p_profit_share_annual, 0);
$$;


-- ════════════════════════════════════════════════════════════════
-- 4-b. 入力の検品（受け取れる payload かどうかの判定を1箇所に固定する）
--
-- ★ なぜ関数に切り出すか。
--   給与は「アカウントを作る前に」匿名で預かる（submit_pay_report_pending）。
--   預かった時点で受け取ったと画面に出す以上、そこで通した payload は
--   後の本登録（submit_pay_report）でも必ず通らなければならない。
--   判定を2箇所に書き写すと、いつか片方だけ直され、
--   「受け取りました → 会員登録した → でもデータは入っていない」という
--   いちばん取り返しのつかない形になる。だから判定はここにしか置かない。
--
-- ★ ログイン済みかどうかは見ない（匿名の入口からも呼ぶため）。
--   uid の検査は submit_pay_report 側に残す。
-- ★ 返すのは機材の区分（fleet_cat）。呼ぶ側がもう一度引かなくて済むように。
-- ★ 直したら node db/test-pay-reports.mjs（npm run test:sql）を必ず流す。
--   2つの入口が同じ入力に同じ答えを返すことを、そこで突き合わせている。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_validate_pay_payload(p jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_airline text := nullif(btrim(p->>'airline'), '');
  v_other   text := nullif(btrim(p->>'airline_other'), '');
  v_pos     text := nullif(btrim(p->>'position'), '');
  v_fleet   text := nullif(btrim(p->>'fleet'), '');
  v_age     text := nullif(btrim(p->>'age_bucket'), '');
  v_cur     text := upper(nullif(btrim(p->>'currency'), ''));
  v_year    int  := (p->>'period_year')::int;
  v_month   int  := (p->>'period_month')::int;
  v_ym      int;
  v_cat     text;
  -- 金額まわり。submit_pay_report と同じ導き方をする（0 は「入力あり」に数えない）。
  v_gross   numeric := nullif(nullif(p->>'gross_monthly', '')::numeric, 0);
  v_base    numeric := nullif(p->>'base_pay', '')::numeric;
  -- ★ 2026-08-26 追加。保証給（金額）。基本給とは別の欄・別の列。
  v_gpay    numeric := nullif(p->>'guarantee_pay', '')::numeric;
  v_hourly  numeric := nullif(p->>'hourly_rate', '')::numeric;
  v_trans   numeric := nullif(p->>'transport', '')::numeric;
  v_cmd     numeric := nullif(p->>'command_pay', '')::numeric;
  v_othal   numeric := nullif(p->>'other_allowance', '')::numeric;
  v_ann     numeric;
begin
  if v_airline is null or v_pos is null or v_fleet is null or v_cur is null
     or v_year is null or v_month is null then
    raise exception '必須項目が足りません（会社・職位・機材・通貨・対象月）' using errcode = '22023';
  end if;
  if v_month not between 1 and 12 then
    raise exception '対象月が不正です' using errcode = '22023';
  end if;

  v_ym := v_year * 12 + v_month;
  -- 未来の月は受け取らない（まだ発生していない報酬は事実ではない）
  if v_ym > (extract(year from current_date)::int * 12 + extract(month from current_date)::int) then
    raise exception '未来の月は投稿できません' using errcode = '22023';
  end if;
  if v_year < 2015 then
    raise exception '対象年が古すぎます' using errcode = '22023';
  end if;

  if v_airline = 'other' then
    if v_other is null then
      raise exception '「一覧にない会社」を選んだ場合は社名の入力が必要です' using errcode = '22023';
    end if;
  else
    if not exists (select 1 from public.pv_airlines where code = v_airline and active) then
      raise exception '会社コードが不正です: %', v_airline using errcode = '22023';
    end if;
  end if;

  select cat into v_cat from public.pv_fleets where code = v_fleet and active;
  if v_cat is null then
    raise exception '機材コードが不正です: %', v_fleet using errcode = '22023';
  end if;

  /* 年代。★フォームでは必須にしているが、ここでは「入っていたら語彙にあるか」しか見ない。
     必須にすると、年代を聞く前に受け取った仮受け（pay_report_pending）が
     本登録の時点で全部落ちる。過去に預かった投稿を、あとから作ったルールで捨てない。 */
  if v_age is not null
     and not exists (select 1 from public.pv_age_buckets where code = v_age and active) then
    raise exception '年代が不正です: %', v_age using errcode = '22023';
  end if;

  /* 役職・区分。2026-08-26 から**複数**選べる（オーナー指示）。
     ★空でも通す。役職を聞く前に預かった仮受けと、過去の投稿を落とさないため。
     ★入っているなら pv_job_roles に在るコードだけ通す。
       job_role（単数）には外部キーが張ってあるが、job_roles（配列）には張れないので
       ここが唯一の関門になる。 */
  if jsonb_typeof(p->'job_roles') = 'array' then
    if jsonb_array_length(p->'job_roles') > 20 then
      raise exception '役職・区分が多すぎます' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(p->'job_roles') as t(code)
       where not exists (select 1 from public.pv_job_roles r
                          where r.code = t.code and r.active)
    ) then
      raise exception '役職・区分が不正です' using errcode = '22023';
    end if;
  end if;

  /* ★ 2026-08-26、総支給と内訳の排他をやめた（オーナー指示）。
     以前はここで「総支給が来ていたら内訳を捨てる」としていた。だが会社ごとに
     変動給の建て付けが違うため、総支給は明細の印字どおりに残したまま
     「そのうち何が固定で何が変動か」を別に書いてもらう形にした。
     ⚠️ 二重計上は起きない。pv_annual_total は総支給があれば内訳を一切見ない
        （coalesce の第1引数）。年換算は今までと1円も変わらない。
     ⚠️ 内訳の合計が総支給と一致することは条件にしない。差は
        「どの項目にも入れていない分」として、レポートの図が灰色で描く。 */

  -- 手当だけの行は給与レポートとして成立しない（比較の軸が無くなる）。
  -- かんたん入力なら総支給、くわしく入れるなら基本給、明細から時給が読めたなら時給。
  -- ★ 2026-08-26、保証給も数に入れた。基本給という項目が無く保証給だけが下限として
  --    出る会社が実在する（米国型）ので、外すと pv_annual_total は年収を出せるのに
  --    ここだけが弾く、という食い違いになる。
  -- 4つとも無い行は受け取らない。
  if coalesce(v_gross, 0) <= 0
     and coalesce(v_base, 0) <= 0
     and coalesce(v_gpay, 0) <= 0
     and coalesce(v_hourly, 0) <= 0 then
    raise exception '報酬額が入力されていません（その月の額面、または基本給・保証給か時給が必要です）'
      using errcode = '22023';
  end if;

  v_ann := public.pv_annual_total(
    v_gross,
    v_base,   v_hourly,
    nullif(p->>'guaranteed_hours', '')::numeric,
    nullif(p->>'block_hours', '')::numeric,
    nullif(p->>'per_diem', '')::numeric,
    nullif(btrim(p->>'housing_type'), ''),
    nullif(p->>'housing_amount', '')::numeric,
    v_trans,  v_cmd,  v_othal,
    nullif(p->>'bonus_annual', '')::numeric,
    nullif(p->>'profit_share_annual', '')::numeric,
    nullif(p->>'bonus_month', '')::numeric,
    v_gpay);
  if v_ann is null or v_ann <= 0 then
    raise exception '年換算が0になりました（時給制なら乗務時間か保証時間が必要です）'
      using errcode = '22023';
  end if;

  return v_cat;
end;
$$;

-- 内側から呼ぶだけの関数。外に出す口ではない（security definer なので、
-- submit_pay_report / submit_pay_report_pending からは権限なしでも呼べる）。
revoke all on function public.pv_validate_pay_payload(jsonb) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 5. 投稿 RPC（匿名性を守ったまま解放する）
--
-- この関数は2つのことを、互いに紐付けずに行う：
--   ① pay_reports に行を作る（user_id は入れない）
--   ② profiles の auth.uid() に投稿の事実だけを刻む
-- どのレポートが誰のものかは、どこにも保存されない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.submit_pay_report(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid       uuid := auth.uid();
  v_airline   text := nullif(btrim(p->>'airline'), '');
  v_other     text := nullif(btrim(p->>'airline_other'), '');
  v_pos       text := nullif(btrim(p->>'position'), '');
  v_fleet     text := nullif(btrim(p->>'fleet'), '');
  v_cur       text := upper(nullif(btrim(p->>'currency'), ''));
  v_year      int  := (p->>'period_year')::int;
  v_month     int  := (p->>'period_month')::int;
  v_ym        int;
  v_hash      text;
  v_cat       text;
  v_fx        record;
  v_ann       numeric;
  v_usd       numeric;
  v_jpy       numeric;
  v_bh        numeric := nullif(p->>'block_hours', '')::numeric;
  v_tax       numeric := nullif(p->>'tax_rate_pct', '')::numeric;
  -- ★ かんたん入力の「その月の額面（総支給）」。0 も null に倒す（0 を「入力あり」と
  --   数えると、下の coalesce が内訳へ落ちずに年収0の行が通る）。
  v_gross     numeric := nullif(nullif(p->>'gross_monthly', '')::numeric, 0);
  -- 内訳。★2026-08-26 から総支給と同時に持てる（排他をやめた）。
  -- 変数に受けているのは、insert と on conflict の2箇所で同じ判断を書き写さないため。
  v_base      numeric := nullif(p->>'base_pay', '')::numeric;
  -- ★ 2026-08-26 追加。保証給（Minimum Guarantee などの金額）。
  --    ⚠️ v_guar（保証**時間** guaranteed_hours）とは別物。名前が似ているので注意。
  v_gpay      numeric := nullif(p->>'guarantee_pay', '')::numeric;
  v_hourly    numeric := nullif(p->>'hourly_rate', '')::numeric;
  v_trans     numeric := nullif(p->>'transport', '')::numeric;
  v_cmd       numeric := nullif(p->>'command_pay', '')::numeric;
  v_othal     numeric := nullif(p->>'other_allowance', '')::numeric;
  v_fvp       numeric := nullif(p->>'flight_variable_pay', '')::numeric;
  -- ここから下は総支給とは排他にしない。
  -- ★ パーディアムと住宅手当は 2026-08-13 から全員に聞く欄になった（内訳の中ではない）。
  --    ので総支給と一緒に来ても捨てない。二重計上は起きない
  --    ＝ pv_annual_total は総支給があれば内訳側を一切見ないため。
  v_perdiem   numeric := nullif(p->>'per_diem', '')::numeric;
  v_hamt      numeric := nullif(p->>'housing_amount', '')::numeric;
  -- ★ 総支給と手取りは「明細のとおり」＝ボーナスが出た月は込みの額。
  --    そのままだと年換算がボーナス月の額×12になるので、うち今月出たぶんを別に聞いて引く。
  v_bonusm    numeric := nullif(p->>'bonus_month', '')::numeric;
  v_stay      smallint := nullif(p->>'stay_nights', '')::smallint;
  v_guar      numeric := nullif(p->>'guaranteed_hours', '')::numeric;
  v_htype     text    := nullif(btrim(p->>'housing_type'), '');
  v_src       text    := lower(nullif(btrim(p->>'source'), ''));
  v_detail    jsonb;   -- 読めた手当の内訳（画面には出さない。下で検品する）
  v_items     jsonb;   -- 本人が書いた内訳の行（同上。下で検品する）
  v_roles     text[];  -- 役職・区分（複数）。job_role 単数は先頭を入れる
  v_role      text;
  v_pbh       numeric;
  v_net       numeric;
  v_prof      public.profiles%rowtype;
  v_inserted  boolean;
  v_streak    int;
  v_until     timestamptz;
  v_id        uuid;
  v_n         int;
  v_le        int;
  v_med       numeric;
  v_p25       numeric;
  v_p75       numeric;
  v_medbh     numeric;
begin
  -- ── 入口の検品 ──────────────────────────────────────────
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  -- ★ 入力そのものの検品は pv_validate_pay_payload（4-b）に集約してある。
  --   ここに書き戻さない。アカウントを作る前の仮受け（submit_pay_report_pending）が
  --   同じ関数を呼んでいるので、片方だけ直すと「受け取りましたと出したのに
  --   会員登録のあとで落ちる」という、いちばん取り返しのつかない形になる。
  v_cat := public.pv_validate_pay_payload(p);
  v_ym  := v_year * 12 + v_month;
  if v_airline <> 'other' then
    v_other := null;   -- 一覧から選んだのに自由入力が残っていたら捨てる
  end if;

  -- ── 役職・区分（2026-08-26 から複数）──────────────────
  -- 語彙に在るかは pv_validate_pay_payload が既に見ている。ここは形を整えるだけ。
  -- ★job_role（単数）は消さない。過去の全行と、管理者メールがそちらを見ている。
  --   先頭＝主たる役割を入れて、単数と複数の両方をそろえる。
  if jsonb_typeof(p->'job_roles') = 'array' then
    select array_agg(distinct t.code order by t.code)
      into v_roles
      from jsonb_array_elements_text(p->'job_roles') as t(code)
     where nullif(btrim(t.code), '') is not null;
  end if;
  v_role := coalesce(nullif(btrim(p->>'job_role'), ''), v_roles[1]);

  -- 明細から下書きした行を、後から見分けられるようにする（AIが埋めた行の品質を
  -- 測る唯一の手段）。知らない値は 'web' に倒す。素通しにすると集計に使えなくなる。
  if v_src is null or v_src not in ('web', 'payslip') then
    v_src := 'web';
  end if;

  -- ── 明細の内訳（2026-08-14）。溜めるだけで、画面にも集計にも出さない ──
  --    ★ここで落とすのは「内訳だけ」。壊れていても投稿そのものは通す。
  --      内訳の不備で明細1枚が丸ごと無駄になるのがいちばん損。
  --    ★p はログイン利用者が自由に作れる。素通しにすると好きなものを
  --      好きなだけ入れられるので、知っているキーだけを組み直す。
  --    ★Verified の判定には使わない（source と同じでクライアント申告）。
  begin
    if jsonb_typeof(p->'payslip_detail') = 'object' then
      v_detail := p->'payslip_detail';
    elsif length(coalesce(p->>'payslip_detail', '')) between 1 and 8000 then
      v_detail := (p->>'payslip_detail')::jsonb;     -- 画面は文字列で送ってくる
    end if;
  exception when others then
    v_detail := null;                                -- 壊れた JSON でも投稿は通す
  end;
  if v_detail is not null then
    if jsonb_typeof(v_detail) <> 'object' or length(v_detail::text) > 8000 then
      v_detail := null;
    else
      v_detail := jsonb_strip_nulls(jsonb_build_object(
        'v',             coalesce(v_detail->'v', to_jsonb(1)),
        'earnings',      case when jsonb_typeof(v_detail->'earnings')      = 'array'  then v_detail->'earnings' end,
        'unmapped',      case when jsonb_typeof(v_detail->'unmapped')      = 'array'  then v_detail->'unmapped' end,
        'hours',         case when jsonb_typeof(v_detail->'hours')         = 'array'  then v_detail->'hours' end,
        'gross_printed', case when jsonb_typeof(v_detail->'gross_printed') = 'number' then v_detail->'gross_printed' end,
        'currency',      case when jsonb_typeof(v_detail->'currency')      = 'string' then v_detail->'currency' end,
        'checks',        case when jsonb_typeof(v_detail->'checks')        = 'object' then v_detail->'checks' end
      ));
      -- 'v' しか残らなかった＝中身が無い。空の殻を溜めない。
      if not (v_detail ? 'earnings' or v_detail ? 'unmapped' or v_detail ? 'hours') then
        v_detail := null;
      end if;
    end if;
  end if;

  -- ── 本人が書いた内訳の行（2026-08-26）───────────────────
  --    変動給とその他の現金手当は、会社ごとに本数も呼び名も違う。固定の欄に
  --    押し込めないので、行の形のまま溜める。
  --    ★金額の合計は既存の列に寄せてある（変動給→flight_variable_pay、
  --      変動給＋その他→other_allowance）。ここが空でも金額は1円も欠けない。
  --    ★payslip_detail と同じ扱い：壊れていても投稿そのものは通す。
  --      内訳の不備で1件が丸ごと無駄になるのがいちばん損。
  --    ★p はログイン利用者が自由に作れるので、知っているキーだけを組み直す。
  begin
    if jsonb_typeof(p->'pay_items') = 'object' then
      v_items := p->'pay_items';
    elsif length(coalesce(p->>'pay_items', '')) between 1 and 8000 then
      v_items := (p->>'pay_items')::jsonb;    -- 文字列で送られてきた場合
    end if;
  exception when others then
    v_items := null;                          -- 壊れた JSON でも投稿は通す
  end;
  if v_items is not null then
    if jsonb_typeof(v_items) <> 'object' or length(v_items::text) > 8000 then
      v_items := null;
    else
      v_items := jsonb_strip_nulls(jsonb_build_object(
        'v',          coalesce(v_items->'v', to_jsonb(1)),
        'fixed_none', case when jsonb_typeof(v_items->'fixed_none') = 'boolean' then v_items->'fixed_none' end,
        'variable',   case when jsonb_typeof(v_items->'variable') = 'array'
                            and jsonb_array_length(v_items->'variable') <= 40 then v_items->'variable' end,
        'other',      case when jsonb_typeof(v_items->'other') = 'array'
                            and jsonb_array_length(v_items->'other') <= 40 then v_items->'other' end
      ));
      -- 行も「該当なし」も無い＝中身が無い。空の殻を溜めない。
      if not (v_items ? 'variable' or v_items ? 'other'
              or coalesce((v_items->>'fixed_none')::boolean, false)) then
        v_items := null;
      end if;
    end if;
  end if;

  -- ── レート制限（1日10件。本物のパイロットは月1〜2件しか出さない）──
  select * into v_prof from public.profiles where id = v_uid for update;
  if not found then
    -- 通常は on_auth_user_created トリガーが作る。取りこぼした人を
    -- ここで詰まらせない（せっかく書いた1件が消えるのが最悪の結果）。
    begin
      insert into public.profiles (id) values (v_uid);
    exception when others then
      raise exception 'プロフィールが作成されていません。一度ログインし直してください。'
        using errcode = '23503';
    end;
    select * into v_prof from public.profiles where id = v_uid for update;
  end if;

  if v_prof.pay_reports_day is distinct from current_date then
    v_prof.pay_reports_day   := current_date;
    v_prof.pay_reports_today := 0;
  end if;
  if v_prof.pay_reports_today >= 10 then
    raise exception '1日に投稿できる件数の上限に達しました。明日また続きをどうぞ。'
      using errcode = '54000';
  end if;

  -- ── proof_hash はサーバで計算する（クライアントには作らせない）──
  -- 自由入力の社名まで含める。含めないと「その他」が1社分に潰れて、
  -- 別々の会社の月次レポートが unique 制約で弾かれる。
  v_hash := encode(
    extensions.digest(
      v_uid::text || '::pv_pay::' || v_airline || coalesce('::' || lower(v_other), ''),
      'sha256'),
    'hex');

  -- ── 換算レート（無い通貨は null のまま。原本があるので後で再計算できる）──
  select to_usd, to_jpy, as_of into v_fx from public.fx_rates where code = v_cur;

  -- ── 総支給と内訳は両立する（2026-08-26 オーナー指示で排他をやめた）──
  -- 以前はここで内訳を捨てていた。会社ごとに変動給の建て付けが違い、固定6欄では
  -- 多くのパイロットが自分の明細を入れられなかったので、
  -- 「総支給は明細の印字どおり・内訳はそのうち分かる範囲だけ」という形にした。
  -- ⚠️ 二重計上は起きない。pv_annual_total は総支給があれば内訳を一切見ない。
  -- ⚠️ 一致は求めない。差は「どの項目にも入れていない分」としてレポートの図が灰色で描く。
  -- （判定は pv_validate_pay_payload 側にも同じ趣旨のコメントがある）

  -- ── 派生値 ──────────────────────────────────────────────
  v_ann := public.pv_annual_total(
    v_gross,
    v_base,    v_hourly,
    v_guar,    v_bh,
    v_perdiem,
    v_htype,   v_hamt,
    v_trans,   v_cmd,
    v_othal,
    nullif(p->>'bonus_annual','')::numeric,     nullif(p->>'profit_share_annual','')::numeric,
    v_bonusm,  v_gpay);

  -- 金額が足りているかは pv_validate_pay_payload が既に見ている（4-b）。
  -- ★ここに残す1本は判定ではなく最後の網。annual_total_orig は null を許す列なので、
  --   万一すり抜けると「年収が空の行」が黙って1本できる。直すなら 4-b 側を直す。
  if v_ann is null or v_ann <= 0 then
    raise exception '年換算が0になりました（時給制なら乗務時間か保証時間が必要です）'
      using errcode = '22023';
  end if;

  v_usd := case when v_fx.to_usd is not null then round(v_ann * v_fx.to_usd, 2) end;
  v_jpy := case when v_fx.to_jpy is not null then round(v_ann * v_fx.to_jpy, 2) end;
  v_pbh := case when v_usd is not null and coalesce(v_bh, 0) > 0
                then round(v_usd / (12 * v_bh), 2) end;
  v_net := case when v_jpy is not null and v_tax is not null
                then round(v_jpy * (1 - v_tax / 100), 2) end;

  -- ── ① 行を作る（user_id は入れない）────────────────────
  insert into public.pay_reports (
    proof_hash, airline, airline_other, base_iata,
    period_year, period_month, "position", fleet, fleet_cat, job_role, job_roles, age_bucket,
    currency, fx_to_usd, fx_to_jpy, fx_at,
    gross_monthly,
    base_pay, guarantee_pay, hourly_rate, guaranteed_hours, block_hours, duty_days, days_off, sectors,
    stay_nights, per_diem,
    housing_type, housing_amount, transport, command_pay, other_allowance,
    bonus_month, bonus_annual, profit_share_annual, pension_pct,
    contract_type, tax_country, nationality, tax_rate_pct, seniority_years,
    annual_total_orig, annual_total_usd, annual_total_jpy, usd_per_block_hour, net_annual_jpy,
    -- ★ Step7-B2：明細に印字されている実額。キーを増やしただけで、
    --    上の既存26キーは名前も作り方も1つも変えていない。
    net_pay_actual, ytd_taxable, flight_variable_pay, deduction_total,
    duty_hours, night_hours, credit_hours,
    payslip_detail, pay_items,
    lang, source
  ) values (
    v_hash, v_airline, v_other, upper(nullif(btrim(p->>'base_iata'), '')),
    v_year, v_month, v_pos, v_fleet, v_cat, v_role, v_roles,
    nullif(btrim(p->>'age_bucket'), ''),
    v_cur, v_fx.to_usd, v_fx.to_jpy, v_fx.as_of,
    v_gross,
    v_base,   v_gpay,   v_hourly,
    v_guar,   v_bh,
    nullif(p->>'duty_days','')::smallint,
    nullif(p->>'days_off','')::smallint,        nullif(p->>'sectors','')::smallint,
    v_stay,   v_perdiem,
    v_htype,  v_hamt,
    v_trans,  v_cmd,
    v_othal,
    v_bonusm,
    nullif(p->>'bonus_annual','')::numeric,     nullif(p->>'profit_share_annual','')::numeric,
    nullif(p->>'pension_pct','')::numeric,
    nullif(btrim(p->>'contract_type'),''),
    upper(nullif(btrim(p->>'tax_country'),'')), upper(nullif(btrim(p->>'nationality'),'')),
    v_tax, nullif(p->>'seniority_years','')::smallint,
    v_ann, v_usd, v_jpy, v_pbh, v_net,
    nullif(p->>'net_pay_actual','')::numeric,      nullif(p->>'ytd_taxable','')::numeric,
    v_fvp,                                         nullif(p->>'deduction_total','')::numeric,
    nullif(p->>'duty_hours','')::numeric,          nullif(p->>'night_hours','')::numeric,
    nullif(p->>'credit_hours','')::numeric,
    v_detail, v_items,
    coalesce(nullif(btrim(p->>'lang'), ''), 'en'), v_src
  )
  on conflict on constraint pay_reports_uniq do update set
    -- 同じ社・同じ月の出し直しは「訂正」として扱う（弾かずに上書き）。
    -- 弾くと、打ち間違いに気づいた人が二度と直せない。
    created_at = now(),
    base_iata = excluded.base_iata, "position" = excluded."position",
    fleet = excluded.fleet, fleet_cat = excluded.fleet_cat, job_role = excluded.job_role,
    -- ★ ここに書き忘れると、役職を選び直しても複数のほうだけ古いまま残る。
    job_roles = excluded.job_roles,
    -- ★ ここに書き忘れると、年代だけ訂正が効かない（最初に出した値が残る）。
    age_bucket = excluded.age_bucket,
    currency = excluded.currency, fx_to_usd = excluded.fx_to_usd,
    fx_to_jpy = excluded.fx_to_jpy, fx_at = excluded.fx_at,
    -- ★ ここに書き忘れると、くわしく入れ直した人の行に古い総支給が残り、
    --    pv_annual_total が総支給を優先するので「内訳を直したのに年収が動かない」になる。
    gross_monthly = excluded.gross_monthly,
    base_pay = excluded.base_pay,
    -- ★ ここに書き忘れると、保証給だけ訂正が効かない（最初に出した値が残る）。
    guarantee_pay = excluded.guarantee_pay, hourly_rate = excluded.hourly_rate,
    guaranteed_hours = excluded.guaranteed_hours, block_hours = excluded.block_hours,
    duty_days = excluded.duty_days,
    -- ★ ここに書き忘れると、同じ月を出し直しても休日とセクターだけ古い値のまま残る
    --    （＝この2つだけ訂正が効かない）。
    days_off = excluded.days_off, sectors = excluded.sectors,
    -- ★ ここに書き忘れると、同じ月を出し直してもステイ日数と今月のボーナスだけ
    --    古い値のまま残る（＝この2つだけ訂正が効かない）。
    stay_nights = excluded.stay_nights,
    per_diem = excluded.per_diem,
    housing_type = excluded.housing_type, housing_amount = excluded.housing_amount,
    transport = excluded.transport, command_pay = excluded.command_pay,
    other_allowance = excluded.other_allowance,
    bonus_month = excluded.bonus_month, bonus_annual = excluded.bonus_annual,
    profit_share_annual = excluded.profit_share_annual, pension_pct = excluded.pension_pct,
    contract_type = excluded.contract_type, tax_country = excluded.tax_country,
    nationality = excluded.nationality, tax_rate_pct = excluded.tax_rate_pct,
    seniority_years = excluded.seniority_years,
    annual_total_orig = excluded.annual_total_orig, annual_total_usd = excluded.annual_total_usd,
    annual_total_jpy = excluded.annual_total_jpy,
    usd_per_block_hour = excluded.usd_per_block_hour, net_annual_jpy = excluded.net_annual_jpy,
    net_pay_actual = excluded.net_pay_actual, ytd_taxable = excluded.ytd_taxable,
    flight_variable_pay = excluded.flight_variable_pay,
    deduction_total = excluded.deduction_total,
    duty_hours = excluded.duty_hours, night_hours = excluded.night_hours,
    credit_hours = excluded.credit_hours,
    /* ★訂正で内訳が空になったときに古い内訳を残さない。残すと、金額は新しく
       内訳は前回のまま、という食い違った1行ができる。 */
    payslip_detail = excluded.payslip_detail,
    /* ★同じ理由で内訳の行も上書きする。残すと、合計は新しく行は前回のまま、
       という食い違った1行ができる。 */
    pay_items = excluded.pay_items,
    lang = excluded.lang, source = excluded.source
  -- xmax=0 は「今この文で新規に挿入された行」の目印。訂正（update）と区別する。
  -- この事業が追う唯一の指標が月間コントリビューション数なので、
  -- 打ち直しで件数が水増しされると指標そのものが嘘になる。
  returning id, (xmax = 0) into v_id, v_inserted;

  -- ── ② profiles に投稿の事実だけを刻む（どの行かは記録しない）──
  -- 継続は「提出日」ではなく「対象月」で数える。まとめて出しても連続にならない。
  if v_prof.last_pay_period_ym is null then           v_streak := 1;
  elsif v_ym = v_prof.last_pay_period_ym + 1 then     v_streak := greatest(v_prof.pay_streak_months, 0) + 1;
  elsif v_ym <= v_prof.last_pay_period_ym then        v_streak := greatest(v_prof.pay_streak_months, 1);
  else                                                v_streak := 1;   -- 間が空いた
  end if;

  -- 解放は積み上げない（「少なくとも今から90日」）。だから青天井にならない。
  --
  -- ★ streak で期間を伸ばしてはいけない。
  --   以前ここは「3ヶ月連続なら12ヶ月」だった。つまり3回出せば1年間は戻ってくる
  --   理由が無くなる。この事業の資産は「月次で更新され続けるデータ」なので、
  --   それは資産そのものを削る設定だった。連続提出への見返りは、期間ではなく
  --   「見えるものの深さ」（マイページの推移・内訳・比較）で返す。
  -- ★ 90日なのは、1〜2ヶ月落としただけの人を締め出さないため。30日固定だと
  --   1ヶ月飛ばした瞬間に鍵がかかる。そして pv_refresh_badge_states() の
  --   バッジ失効も90日なので、解放とバッジの寿命がここで一致する。
  -- ★ greatest() は残す＝既に長い解放を持っている人からは取り上げない。
  --   仕様変更は必ず前向きだけに効かせる（過去に配ったものは取り返さない）。
  v_until := greatest(
    coalesce(v_prof.access_until, '-infinity'::timestamptz),
    now() + interval '90 days');

  update public.profiles set
    last_pay_report_at = now(),
    pay_report_count   = coalesce(pay_report_count, 0) + case when v_inserted then 1 else 0 end,
    pay_streak_months  = v_streak,
    last_pay_period_ym = greatest(coalesce(last_pay_period_ym, 0), v_ym),
    pay_reports_day    = v_prof.pay_reports_day,
    pay_reports_today  = v_prof.pay_reports_today + 1,
    access_until       = v_until,
    -- その人の給料日を、初回の提出日から覚える。世界規模なので「毎月25日に一斉」は
    -- 成り立たない（日本は25日前後・湾岸は月末・米国は月2回）。一度決めたら動かさない
    -- ＝まとめて過去分を出した月に日付が飛ばない。
    pay_day_of_month   = coalesce(pay_day_of_month, extract(day from current_date)::smallint),
    -- ★ バッジは contributor 止まり。verified 以上は検証（Step 7/8）でしか付かない。
    badge       = case when badge in ('none', '') then 'contributor' else badge end,
    badge_state = 'active'
  where id = v_uid;

  -- ── 投稿の見返り（同じ区分に5人以上いるときだけ返す）────────
  -- k≧5 は公開ビューと同じ閾値。ここだけ緩めると裏口になる。
  select count(*),
         count(*) filter (where annual_total_usd <= v_usd),
         percentile_cont(0.5)  within group (order by annual_total_usd),
         percentile_cont(0.25) within group (order by annual_total_usd),
         percentile_cont(0.75) within group (order by annual_total_usd),
         percentile_cont(0.5)  within group (order by usd_per_block_hour)
    into v_n, v_le, v_med, v_p25, v_p75, v_medbh
    from public.pay_reports
   where airline = v_airline and "position" = v_pos and fleet = v_fleet
     and period_year = v_year and annual_total_usd is not null and airline_other is null;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'currency', v_cur,
    'annual_total_orig',  v_ann,
    'annual_total_usd',   v_usd,
    'annual_total_jpy',   v_jpy,
    'usd_per_block_hour', v_pbh,
    'net_annual_jpy',     v_net,
    'fx_at',              v_fx.as_of,
    'fx_missing',         (v_fx.to_usd is null),
    'is_new',             v_inserted,
    'streak_months',      v_streak,
    'access_until',       v_until,
    'benchmark', case when coalesce(v_n, 0) >= 5 then jsonb_build_object(
        'n', v_n,
        'percentile',        round(100.0 * v_le / v_n),
        'median_usd',        round(v_med, 2),
        'p25_usd',           round(v_p25, 2),
        'p75_usd',           round(v_p75, 2),
        'median_usd_per_bh', round(v_medbh, 2)
      ) else null end
  );
end;
$$;

-- ログイン必須。anon には渡さない。
revoke all on function public.submit_pay_report(jsonb) from public, anon;
grant execute on function public.submit_pay_report(jsonb) to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 5-b. my_pay_reports — 本人の履歴だけを返す（マイページの土台）
--
-- ★ pay_reports に user_id は無い。だが proof_hash はサーバが再計算できるので、
--    user_id を1列も増やさずに本人の行だけ引ける。
--    ＝疑似匿名を1ミリも弱めないままマイページが作れる。
-- ★ security definer。RLS で誰も読めないテーブルを、本人ぶんだけ開ける唯一の口。
-- ★ 返すのは本人の行だけ。他人の proof_hash では1行も一致しない（uid がハッシュの
--    材料に入っているため、当てるには uid そのものが要る）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.my_pay_reports()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid  uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select * into v_prof from public.profiles where id = v_uid;

  with mine as (
    -- 一覧から選んだ会社：コードは有限なので総当たりでハッシュを作れる
    select encode(extensions.digest(
             v_uid::text || '::pv_pay::' || a.code, 'sha256'), 'hex') as h
      from public.pv_airlines a
    union
    -- 「一覧にない会社」：ハッシュに自由入力の社名が入っているので総当たりでは
    -- 引けない。実在する社名だけを候補にして作り直す。ここで他社の行を読むが、
    -- 使うのはハッシュの材料としてだけで、関数の外へは一切出さない。
    select encode(extensions.digest(
             v_uid::text || '::pv_pay::other::' || o.nm, 'sha256'), 'hex')
      from (select distinct lower(airline_other) as nm
              from public.pay_reports
             where airline = 'other' and airline_other is not null) o
  ),
  rows as (
    select r.airline, r.airline_other, r."position", r.fleet, r.job_role,
           -- ★ 年代。翌月のフォームを前月の値で埋めるために返す（返さないと毎月選び直し）。
           r.age_bucket,
           -- ★ base_iata はレポート概要（会社/機種/Position/Base）に要る。
           --    ここは呼び出した本人の行しか返さないので、pay_benchmarks 側の
           --    「base で絞らせない」匿名性ルール（下の view のコメント）とは別問題。
           r.base_iata,
           r.period_year, r.period_month,
           r.period_year * 12 + r.period_month as period_ym,
           -- 原本通貨と、そのときの換算レート。★ fx_to_jpy を返さないと、
           -- 明細の実額（すべて原本通貨）を円に直せず、通貨切替（PVCurrency）に
           -- 載せられない＝月をまたいで通貨が変わった人の推移が引けなくなる。
           r.currency, r.fx_to_jpy, r.fx_to_usd,
           r.annual_total_orig, r.annual_total_usd, r.annual_total_jpy,
           r.usd_per_block_hour, r.net_annual_jpy,
           -- 明細から取れた実額（推定ではない側）
           r.net_pay_actual, r.ytd_taxable, r.deduction_total,
           -- ★ かんたん入力の「その月の額面（総支給）」。これが入っている行は内訳が
           --    空なので、レポート側は支給構成を「見本」としてぼかす判定に使う
           --    （source は自己申告なので判定に使わない）。
           r.gross_monthly,
           -- 内訳ドーナツの材料。housing_type も返す＝現物支給の社宅を現金として
           -- 描かないため（pv_annual_total も allowance のときしか足していない）。
           r.base_pay, r.command_pay, r.housing_type, r.housing_amount,
           r.flight_variable_pay,
           r.per_diem, r.transport, r.other_allowance,
           -- ★ 総支給と手取りは明細のとおり（ボーナス込み）。うち今月出たぶんを返さないと
           --    レポート側で年換算を再現できない（サーバの式と食い違う）。
           r.bonus_month,
           r.bonus_annual, r.profit_share_annual, r.pension_pct,
           -- 分母（block と duty で時給が倍ちがう。そこが商品）
           -- guaranteed_hours は「飛ばなくても払う」契約上の下限。実績との差を出すために返す
           -- （中東の75〜80時間保証と、保証の無い日本を並べられるのはこの列があるから）。
           r.block_hours, r.guaranteed_hours, r.duty_hours, r.night_hours, r.credit_hours,
           -- 契約と税。★ 翌月の投稿フォームを前月の値で埋める（＝2ヶ月目以降は
           --    「額面」と「飛んだ時間」だけで終わる）ために返す。
           r.contract_type, r.tax_country, r.tax_rate_pct, r.seniority_years,
           -- 稼働日数。フォームは前から集めて列にも入っていたが、ここに書き忘れていた
           -- ので画面に出せなかった。本人の行しか返さない関数なので、
           -- pay_benchmarks 側の匿名性ルール（base で絞らせない）とは無関係。
           -- 休日数とセクター数も同じ扱い（PAY-EXTRAS.md）。
           r.duty_days, r.days_off, r.sectors, r.stay_nights,
           r.source, r.verify_level, r.created_at
      from public.pay_reports r
      join mine m on m.h = r.proof_hash
  )
  select coalesce(jsonb_agg(to_jsonb(t) order by t.period_ym), '[]'::jsonb)
    into v_rows
    from rows t;

  return jsonb_build_object(
    'ok',            true,
    'reports',       v_rows,
    'report_count',  coalesce(v_prof.pay_report_count, 0),
    'streak_months', coalesce(v_prof.pay_streak_months, 0),
    'access_until',  v_prof.access_until,
    'badge',         coalesce(v_prof.badge, 'none'),
    'badge_state',   coalesce(v_prof.badge_state, 'none'),
    -- 同意は2つある（親＝メール全般 / 子＝月次リマインド）。両方返す。
    -- 片方しか見ないと「オンと表示されているのに送られない」状態が作れる。
    -- 送信条件は db/pay-reminder.sql の pv_reminder_due で「両方 true」。
    'mail_optin',    coalesce(v_prof.mail_optin, false),
    'email_opt_in',  coalesce(v_prof.email_opt_in, false),
    -- その人の給料日（投稿日から学習した値）。「次はいつ来るか」をマイページで
    -- 言うために返す。世界規模なので全員同じ日ではない。
    'pay_day_of_month', v_prof.pay_day_of_month
  );
end;
$$;

revoke all on function public.my_pay_reports() from public, anon;
grant execute on function public.my_pay_reports() to authenticated;

comment on function public.my_pay_reports() is
  '本人の給与レポート履歴。proof_hash をサーバ側で再計算して引くので、'
  'pay_reports に user_id を持たせずに済む（＝疑似匿名を保ったままマイページが作れる）。';


-- ════════════════════════════════════════════════════════════════
-- 5-c. メール通知の同意（本人だけが自分の設定を変えられる）
-- ════════════════════════════════════════════════════════════════
create or replace function public.set_mail_optin(p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_on  boolean := coalesce(p_on, false);
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  update public.profiles
     set mail_optin    = v_on,
         -- 同意した瞬間だけ記録する。外したときは消さない（いつ同意したかの証拠を残す）
         mail_optin_at = case when v_on then now() else mail_optin_at end,
         -- ★オンにしたときは親の同意（email_opt_in）も立てる。
         --   profiles には旗が2つあり、送信条件は「両方 true」。ここを繋がないと
         --   「オンにしたのに一通も来ない」＝原因の分からない無言の失敗になる。
         --   オフにしたときは親に触らない（他のメールまで勝手に止めない）。
         --   逆向き（親が false に落ちたら子も落とす）は db/pay-reminder.sql の
         --   トリガー profiles_mail_consent_sync が受け持つ。
         email_opt_in    = case when v_on then true else email_opt_in end,
         email_opt_in_at = case when v_on and email_opt_in_at is null then now() else email_opt_in_at end
   where id = v_uid;
  return (
    select jsonb_build_object('ok', true, 'mail_optin', p.mail_optin, 'email_opt_in', p.email_opt_in)
      from public.profiles p where p.id = v_uid
  );
end;
$$;

revoke all on function public.set_mail_optin(boolean) from public, anon;
grant execute on function public.set_mail_optin(boolean) to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 6. 公開する集計（k≧5 未満は構造的に出ない）
--
-- ★ security_invoker を立てない＝所有者権限で走る。だから pay_reports に
--    RLS を張ったまま、集計だけを公開できる。ここを invoker にすると
--    このビューは即座に0行になる。
-- ★ base_iata を group by に入れない。「Emirates・A380・機長・DXB基地・在籍15年」
--    まで絞れば n=5 でも1人に特定できる。件数の閾値だけでは匿名性は守れない。
--    公開の粒度は 会社 × 職位 × 機材 × 年 まで。
-- ★ having count(*) >= 5 は「セルに何人いるか」しか見ていない。任意入力の項目は
--    5人のうち1人しか書いていないことがあるので、項目ごとに別の門番が要る
--    （下の case when count(列) >= 5）。詳細は PAY-EXTRAS.md 2章。
-- ════════════════════════════════════════════════════════════════
drop view if exists public.pay_benchmarks;
create view public.pay_benchmarks as
select airline, "position", fleet, period_year,
       count(*)                                                        as n,
       percentile_cont(0.5)  within group (order by annual_total_usd)   as median_usd,
       percentile_cont(0.25) within group (order by annual_total_usd)   as p25_usd,
       percentile_cont(0.75) within group (order by annual_total_usd)   as p75_usd,
       percentile_cont(0.5)  within group (order by usd_per_block_hour) as median_usd_per_bh,

       -- ★ ここから下は「その項目を書いた人が5人以上いるとき」だけ値を出す。
       --    書いた人が1人のセルでそのまま percentile を取ると、「中央値」と
       --    名乗ったままその1人の実数が公開される。
       case when count(days_off) >= 5
            then round(percentile_cont(0.5) within group (order by days_off)::numeric)
       end                                                              as median_days_off,
       case when count(sectors) >= 5
            then round(percentile_cont(0.5) within group (order by sectors)::numeric)
       end                                                              as median_sectors,
       -- 住居は「額」より先に「形」。社宅か・手当か・無しか。
       -- 10%刻みに丸める＝5人中1人でも 20% としか出ないので、誰の話かは絞れない。
       case when count(housing_type) >= 5
            then round(100.0 * count(*) filter (where housing_type = 'provided')
                       / count(housing_type) / 10) * 10
       end                                                              as housing_provided_pct,
       -- 現金の住宅手当だけの中央値（月額）。現物支給の社宅は金額が無いので混ぜない。
       -- ★ 名前に _mo を入れる。上の median_usd は年額なので、同じ「usd」でも
       --    桁が2つ違う。列名だけ見て画面に並べると年額と月額が同じ段に出る。
       case when count(*) filter (where housing_type = 'allowance'
                                    and housing_amount is not null) >= 5
            -- ★ percentile_cont は numeric を渡しても double precision で返る
            --    （PostgreSQL に numeric 版が無い）。round(値, 桁) は numeric
            --    にしか無いので、先に ::numeric を通さないと関数が見つからず落ちる。
            then round((percentile_cont(0.5) within group (
                   order by case when housing_type = 'allowance'
                                 then housing_amount * fx_to_usd end))::numeric, 2)
       end                                                              as median_housing_usd_mo,

       count(*) filter (where verify_level >= 1)                        as n_verified,
       max(period_month)                                                as latest_month
  from public.pay_reports
 -- 自由入力の社名は集計から外す（社名そのものが識別子になりうる）
 where annual_total_usd is not null and airline_other is null
 group by 1, 2, 3, 4
having count(*) >= 5;

grant select on public.pay_benchmarks to anon, authenticated;

comment on view public.pay_benchmarks is
  '公開集計。k≧5 未満のセルは having で消える。base_iata と seniority_years は'
  '準識別子なので列にも group by にも入れない。粒度をこれより細かくしないこと。'
  '任意入力の項目（days_off/sectors/housing）は、セルの人数ではなく'
  'その項目を書いた人数が5人以上のときだけ値を出す。';


-- ════════════════════════════════════════════════════════════════
-- 6-b. 明細のラベル辞書（2026-08-14）
--
-- 海外の変動給は会社ごとに名前が違う（Flight Productivity Pay / Sector Pay /
-- FDP Allowance / Flying Allowance …）。語彙を先回りで足しても追いつかないので、
-- 分類できなかった行は金額だけ数えて、最後に軽く1問だけ本人に聞いている
-- （payslip.js の renderAsk）。その答えが payslip_detail.unmapped[].asked に入る。
--
-- ★このビューは、その答えを読み出す口。同じ質問を100人に繰り返さないためにある。
--   「最初の3人が答えたら、4人目からは黙って正しい欄に入る」。
--   ★新しいテーブルもトリガーもバッチも要らない。答えは既に投稿に入っている。
--
-- 人数は count(distinct proof_hash) で数える。pay_reports に user_id は無いが、
-- proof_hash は（本人 × 会社）で1つなので、列を1つも増やさずに実人数が数えられる
-- （同じ人が12か月ぶん出しても1人）。
--
-- ★門番が4つ要る。どれか1つでも外すと辞書そのものが攻撃面になる。
--   ① asked は6択の語彙だけ。payslip_detail の配列の中身は submit_pay_report が
--      素通しする（＝ログインすれば誰でも好きな文字列を入れられる）ので、
--      ここで締めないと「他人の金額をどの欄に入れるか」を書き込める
--   ② ラベルは 1〜60 文字。長い文字列を辞書に置かせない
--   ③ 3人以上が一致（オーナー確定 2026-08-14）。1人の押し間違いが会社の全員に
--      広がらない。同時に、3人未満のラベルは公開されない＝誰か1人の珍しい項目名が
--      外に出ない（pay_benchmarks の k≧5 と同じ考え方）
--   ④ 人数を列に出さない。公開するのは「どう分類するか」だけ
--
-- ★scope が2つある。
--   'airline' … その会社の答え。過半数が一致していること
--   'global'  … 会社をまたいだ答え。海外は1社あたり1〜2人しか投稿が無く、
--               会社ごとだけだと辞書が永久に育たない。ただし会社によって意味が
--               違うラベルを混ぜると害になるので、2/3以上が一致しているときだけ。
--               画面（payslip.js）は 'airline' を先に見る
--
-- ★辞書が自分の出力を食べないようにする仕掛けは画面側にある。
--   辞書が入れた行は asked ではなく hint に残る＝ここでは1票も数えない。
--   分けないと、3人の答えが100人に自動適用されて「103人が確認済み」に見え、
--   最初の3人の間違いが100人の同意に化ける。
-- ════════════════════════════════════════════════════════════════
drop view if exists public.pv_label_hints;
create view public.pv_label_hints as
with raw as (
  select r.airline,
         r.airline_other is null                          as listed,
         -- ★画面（payslip.js の normLabel）と同じ規則にする。片方だけ直すと
         --   「辞書に入っているのに一生当たらない」という、いちばん気づけない壊れ方をする。
         --   JavaScript の trim() は全角スペースも NBSP も落とすので、こちらも同じ字を渡す。
         --   突き合わせは db/test-pay-reports.mjs が実際に両方動かしてやる。
         lower(btrim(coalesce(u->>'label', ''), E' \t\r\n\u00A0\u3000')) as label,
         u->>'asked'                                      as asked,
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
   -- ① 6択の語彙だけ。ここが唯一の門
   where asked in ('flight_variable','night_ot','command','bonus','per_diem','other')
   -- ② ラベルの長さ
     and length(label) between 1 and 60
),
-- 自由入力の社名（airline='other'）は会社別の側から外す。外さないと
-- 別々の会社の答えが 'other' という1社に潰れて混ざる。会社をまたぐ側では使う。
per_airline as (
  select airline, label, asked, count(distinct proof_hash) as n
    from votes where listed group by 1, 2, 3
),
airline_total as (
  select airline, label, sum(n) as total from per_airline group by 1, 2
),
per_global as (
  select label, asked, count(distinct proof_hash) as n
    from votes group by 1, 2
),
global_total as (
  select label, sum(n) as total from per_global group by 1
)
select p.airline, p.label, p.asked, 'airline'::text as scope
  from per_airline p
  join airline_total t using (airline, label)
 where p.n >= 3 and p.n * 2 > t.total            -- 3人以上 かつ 過半数
union all
select '*'::text, g.label, g.asked, 'global'::text
  from per_global g
  join global_total t using (label)
 where g.n >= 3 and g.n * 3 >= t.total * 2;      -- 3人以上 かつ 2/3以上

grant select on public.pv_label_hints to anon, authenticated;

comment on view public.pv_label_hints is
  '明細のラベル辞書。分類できなかった行を本人が6択で答えた結果を、'
  '3人以上が一致したものだけ返す。画面はこれを引いて、4人目以降には聞かない。'
  '人数は列に出さない（オーナー用の集計は db/label-hints.verify.sql）。'
  'asked の語彙をここで締めているのが唯一の門＝広げないこと。';


-- ════════════════════════════════════════════════════════════════
-- 7. バッジの鮮度（最終レポートから90日で inactive に落とす）
--
-- データの鮮度が商品なので、バッジも鮮度を持つ。これで法人に
-- 「Gold Active ◯◯人」＝在庫ではなくフローの証明を出せる。
-- 呼び出し：pg_cron か Edge Function から1日1回（Step 5 で配線する）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_refresh_badge_states()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update public.profiles
     set badge_state = 'inactive'
   where badge in ('contributor','verified','gold')
     and badge_state = 'active'
     -- 日で数える。timestamp の差で比較すると、ちょうど90日の人が実行時刻の
     -- 数マイクロ秒の差で落ちる（＝落ちる日が実行時刻に依存する）。
     and (current_date - coalesce(last_pay_report_at, last_review_at)::date) > 90;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.pv_refresh_badge_states() from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 8. 検算（実行後にここだけ流して確かめる）
-- ════════════════════════════════════════════════════════════════

-- 8-1. user_id 列が存在しないこと（期待：0 行）
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'pay_reports'
   and column_name in ('user_id', 'uid', 'email');

-- 8-2. pay_reports に SELECT ポリシーが1本も無いこと（期待：0 行）
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'pay_reports';

-- 8-3. RLS が有効で、anon/authenticated に直接権限が無いこと
select c.relname, c.relrowsecurity as rls有効,
       coalesce(array_to_string(array(
         select g.grantee || ':' || g.privilege_type from information_schema.role_table_grants g
          where g.table_schema='public' and g.table_name='pay_reports'
            and g.grantee in ('anon','authenticated')), ', '), 'なし') as 直接権限
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'pay_reports';

-- 8-4. ビューが所有者権限で走ること（期待：security_invoker が付いていない）
select c.relname, c.reloptions
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'pay_benchmarks';

-- 8-5. 公開集計に準識別子が出ていないこと（期待：0 行）
--      days_off / sectors / housing_type は「生の値」が出ていないことを見る。
--      集計した median_days_off / median_sectors / housing_provided_pct は別名なので
--      ここには引っかからない。
select column_name from information_schema.columns
 where table_schema='public' and table_name='pay_benchmarks'
   and column_name in ('base_iata','seniority_years','proof_hash','airline_other',
                       'period_month','days_off','sectors','housing_type','housing_amount');

-- 8-6. 語彙の外部キーが効いていること
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.pay_reports'::regclass and contype = 'f'
 order by conname;

-- 8-7. 年換算の計算が定義どおりか（AED 例：基本給2万＋時給250×85h＋パーディアム3千
--      ＋住宅手当1万、賞与なし → 12×(20000+21250+3000+10000) = 651,000）
--      ★第1引数は「その月の額面（総支給）」。内訳を足すときは null を渡す。
select public.pv_annual_total(null, 20000, 250, 75, 85, 3000, 'allowance', 10000,
                              null, null, null, null, null) as 期待651000;
-- 現物支給の社宅は足さない（同じ入力で housing_type を provided にすると 531,000）
select public.pv_annual_total(null, 20000, 250, 75, 85, 3000, 'provided', 10000,
                              null, null, null, null, null) as 期待531000;
-- かんたん入力：総支給54,250だけ → 12×54,250 = 651,000（上と同額になる）
select public.pv_annual_total(54250, null, null, null, 85, null, null, null,
                              null, null, null, null, null) as 期待651000;
-- ★総支給が入っていたら内訳は一切見ない。上と同じ54,250に内訳を全部足しても額は動かない
--   （＝住居や手当の二重計上が構造的に起きない）。
select public.pv_annual_total(54250, 20000, 250, 75, 85, 3000, 'allowance', 10000,
                              2000, 3000, 1000, null, null) as 期待651000_内訳は無視;
-- 年間ボーナスは総支給の外。年間30万を足すと 651,000 + 300,000 = 951,000
select public.pv_annual_total(54250, null, null, null, 85, null, null, null,
                              null, null, null, 300000, null) as 期待951000;
-- ★総支給は明細のとおり（ボーナスが出た月は込み）。うち今月出たぶんは ×12 する前に引く。
--   総支給64,250のうち1万が今月のボーナス → 12×54,250 = 651,000
--   ＝同じ人がボーナスの出た月に出しても、年収が跳ね上がらない（上と同額になる）。
select public.pv_annual_total(64250, null, null, null, 85, null, null, null,
                              null, null, null, null, null, 10000) as 期待651000;

-- 8-7b. かんたん入力の列が入ったこと（期待：1 行 gross_monthly numeric）
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='pay_reports'
   and column_name = 'gross_monthly';

-- 8-7c. pv_annual_total が15引数の1本だけになっていること（期待：1 行）
--       2行出たら drop function が流れておらず、呼び出し側の引数の数で
--       新旧どちらが呼ばれるか変わる＝同じ入力から違う年収が出る。
select p.oid::regprocedure as 定義, p.pronargs as 引数の数
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.proname='pv_annual_total';

-- 8-7d. 2026-08-13 に足した2列が入ったこと（期待：2 行）
--       流れていないと、ステイ日数と今月のボーナスだけ黙って捨てられる
--       （＝ボーナスが出た月の年収が跳ね上がったまま集計に乗る）。
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='pay_reports'
   and column_name in ('stay_nights','bonus_month')
 order by column_name;

-- 8-8. 換算レートが入っている通貨（当面この通貨だけが集計に乗る）
select code, to_usd, to_jpy, as_of from public.fx_rates order by code;

-- 8-9. Step7-B2 の列が入ったこと（期待：7 行）
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='pay_reports'
   and column_name in ('net_pay_actual','ytd_taxable','flight_variable_pay',
                       'deduction_total','duty_hours','night_hours','credit_hours')
 order by column_name;

-- 8-9-b. 明細の内訳の列が入ったこと（期待：payslip_detail / jsonb が1行）
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='pay_reports'
   and column_name = 'payslip_detail';

-- 8-10. 解放が「90日固定」になったこと（期待：90 days が1つ・12 months が0）
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='submit_pay_report'
      and p.prosrc like '%interval ''90 days''%')  as _90日が入っている,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='submit_pay_report'
      and p.prosrc like '%12 months%')             as _12ヶ月が残っている_0であること;

-- 8-11. 既に長い解放を持っている人（この変更では縮まない。人数の確認だけ）
select count(*) as 半年以上の解放を持つ人数
  from public.profiles where access_until > now() + interval '6 months';

-- 8-12. マイページ用 RPC が anon に開いていないこと（期待：authenticated のみ）
select p.proname, p.prosecdef as security_definer,
       coalesce(array_to_string(p.proacl::text[], ', '), '(既定)') as 権限
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.proname in ('my_pay_reports','set_mail_optin');

-- 8-13. メール同意の既定が false であること（期待：false・同意した人だけに送る）
select column_name, column_default, is_nullable
  from information_schema.columns
 where table_schema='public' and table_name='profiles'
   and column_name in ('mail_optin','mail_unsub_token','pay_day_of_month')
 order by column_name;

-- 8-14. マイページ（明細トラッカー）が必要とする3つを RPC が返すこと。
--       fx_to_jpy … 明細の実額は全部「原本通貨」。これが無いと1円も換算できず
--                   サイト共通の通貨切替に載らない
--       housing_type … 現物支給の社宅を現金として描かないため
--       pay_day_of_month … 「次はいつ来るか」を言うため（給料日は国・会社で違う）
--       期待：3 行とも true
select k as 必要な項目,
       position(k in pg_get_functiondef(p.oid)) > 0 as 返している
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace,
       unnest(array['fx_to_jpy','housing_type','pay_day_of_month']) as k
 where n.nspname='public' and p.proname='my_pay_reports';

-- 8-15. 休日数とセクター数の列が入ったこと（期待：2 行・どちらも smallint）
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='pay_reports'
   and column_name in ('days_off','sectors')
 order by column_name;

-- 8-16. ★ ここが今回いちばん大事な検算。
--       「その項目を書いた人が1〜4人」なのに公開集計に値が出ている行を探す。
--       1行でも出たら、その1人（〜4人）の実数が「中央値」の名前で公開されている。
--       期待：0 行。
select b.airline, b."position", b.fleet, b.period_year,
       s.n_days_off, b.median_days_off, s.n_sectors, b.median_sectors,
       s.n_housing, b.housing_provided_pct
  from public.pay_benchmarks b
  join (select airline, "position", fleet, period_year,
               count(days_off)     as n_days_off,
               count(sectors)      as n_sectors,
               count(housing_type) as n_housing
          from public.pay_reports
         where annual_total_usd is not null and airline_other is null
         group by 1,2,3,4) s
    on (s.airline, s."position", s.fleet, s.period_year)
     = (b.airline, b."position", b.fleet, b.period_year)
 where (s.n_days_off between 1 and 4 and b.median_days_off     is not null)
    or (s.n_sectors  between 1 and 4 and b.median_sectors      is not null)
    or (s.n_housing  between 1 and 4 and b.housing_provided_pct is not null);

-- 8-17. 本人の履歴が新しい2列を返すこと（期待：2 行とも true）
--       ここが false のままだと、フォームで集めても画面に一生出ない。
select k as 必要な項目,
       position(k in pg_get_functiondef(p.oid)) > 0 as 返している
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace,
       unnest(array['days_off','sectors']) as k
 where n.nspname='public' and p.proname='my_pay_reports';

-- 8-18. ラベル辞書が anon / authenticated に開いていること（期待：2 行とも true）
--       ここが false だと、画面から辞書が引けず 101人目にも同じ6択が出る。
select r as ロール,
       has_table_privilege(r, 'public.pv_label_hints', 'select') as 読める
  from unnest(array['anon','authenticated']) as r;

-- 8-19. 辞書に6択以外の分類が紛れていないこと（期待：0 行）
--       payslip_detail の配列の中身は素通しなので、門はビューの where だけ。
--       1行でも出たら、誰かが他人の金額の行き先を書き込めている。
select distinct asked from public.pv_label_hints
 where asked not in ('flight_variable','night_ot','command','bonus','per_diem','other');

-- 8-20. pay_reports を読む security definer 関数が anon に開いていないこと（期待：0 行）
--       ★1行でも出たら、匿名クライアントから他人の行に届く経路がある。
--         Postgres は関数の execute を既定で PUBLIC に渡すので、
--         revoke を1本書き忘れただけでこうなる。画面には何も出ないまま開く。
--       ★将来ここに関数を足した人も自動で引っかかる。これが狙い。
--       ・pay_reports_pending は別の表なので単語境界（\M）で外す。
--         あちらは「登録前の預かり」で、anon に開いているのが正しい。
--       ・pay_benchmarks（ビュー）は 1行＝区分・k≧5 なので anon に開いていてよい。
--         このクエリはビューを見ていない。関数だけを見る。
select n.nspname || '.' || p.proname
       || '(' || pg_get_function_identity_arguments(p.oid) || ')' as anonに開いている関数
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.prosecdef
   and pg_get_functiondef(p.oid) ~ '\mpay_reports\M'
   and has_function_privilege('anon', p.oid, 'execute')
 order by 1;

-- 8-21. 2026-08-26 に足した2列が入っていること（期待：2 行とも true）
--       ★入っていないと、役職を複数選んでも1つしか残らず、
--         内訳の行（変動給・その他の現金手当）は保存されずに消える。
--         画面は普通に「送信できました」と出るので、貼り忘れに気づけない。
select k as 列, exists (
         select 1 from information_schema.columns
          where table_schema='public' and table_name='pay_reports' and column_name=k
       ) as ある
  from unnest(array['job_roles','pay_items']) as k;

-- 8-22. 総支給と内訳の排他が復活していないこと（期待：2 行とも false）
--       ★2026-08-26、オーナー指示で排他をやめた。総支給は明細の印字どおりに残し、
--         そのうち何が固定で何が変動かを別に書いてもらう。
--         ここが true に戻ると、内訳を書いた人の行から内訳だけが黙って消える
--         （年収は変わらないので、誰も気づけない）。
select p.proname as 関数,
       pg_get_functiondef(p.oid) ~ 'v_gross is not null then\s*\n\s*v_base := null' as 内訳を捨てている
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public'
   and p.proname in ('submit_pay_report','pv_validate_pay_payload');
