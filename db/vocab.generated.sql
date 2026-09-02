-- ════════════════════════════════════════════════════════════════
-- db/vocab.generated.sql — ★自動生成。手で編集しない。
--   生成元: pv-vocab.mjs（語彙）＋ currency.js（換算レート）
--   再生成: node gen-vocab.mjs
--
-- pay_reports が参照する語彙マスタ。何度流しても安全（upsert）。
-- 語彙から消えたコードは無効化するだけで消さない（過去の投稿が参照している）。
-- ════════════════════════════════════════════════════════════════

-- cat は 'other'（どれにも当てはまらない機材）だけ null を許す。
-- salary-leveling.js の r/n/w と同じ語彙。
create table if not exists public.pv_fleets (
  code text primary key, cat text check (cat is null or cat in ('r','n','w')),
  name_ja text not null, name_en text not null, active boolean not null default true
);
create table if not exists public.pv_positions (
  code text primary key, name_ja text not null, name_en text not null, active boolean not null default true
);
create table if not exists public.pv_job_roles (
  code text primary key, name_ja text not null, name_en text not null, active boolean not null default true
);
-- 年代。刻みは10歳。口コミ（reviews_v2.age_bucket）は5歳刻みで先に集めており、
-- '20-24' + '25-29' = '20-29' のように、こちらの段へちょうど畳める形にしてある。
create table if not exists public.pv_age_buckets (
  code text primary key, name_ja text not null, name_en text not null, active boolean not null default true
);
create table if not exists public.pv_housing_types (
  code text primary key, name_ja text not null, name_en text not null, active boolean not null default true
);
create table if not exists public.pv_contract_types (
  code text primary key, name_ja text not null, name_en text not null, active boolean not null default true
);
create table if not exists public.pv_currencies (
  code char(3) primary key, dec smallint not null check (dec in (0,2,3)),
  sym text not null, name_ja text not null, name_en text not null, active boolean not null default true
);

insert into public.pv_fleets (code, cat, name_ja, name_en) values
  ('a320', 'n', 'A320ファミリー（A319/320/321）', 'A320 family (A319/320/321)'),
  ('b737', 'n', 'Boeing 737', 'Boeing 737'),
  ('a220', 'n', 'Airbus A220（旧 CS100/300）', 'Airbus A220 (ex-CSeries)'),
  ('b757', 'n', 'Boeing 757', 'Boeing 757'),
  ('e-jet', 'n', 'Embraer E-Jet（E170/190）', 'Embraer E-Jet (E170/190)'),
  ('b767', 'w', 'Boeing 767', 'Boeing 767'),
  ('b777', 'w', 'Boeing 777', 'Boeing 777'),
  ('b787', 'w', 'Boeing 787 Dreamliner', 'Boeing 787 Dreamliner'),
  ('b747', 'w', 'Boeing 747', 'Boeing 747'),
  ('a330', 'w', 'Airbus A330', 'Airbus A330'),
  ('a350', 'w', 'Airbus A350', 'Airbus A350'),
  ('a380', 'w', 'Airbus A380', 'Airbus A380'),
  ('crj', 'r', 'CRJ シリーズ', 'CRJ series'),
  ('atr', 'r', 'ATR 42/72', 'ATR 42/72'),
  ('dhc8', 'r', 'DHC-8（Q400 等）', 'DHC-8 (Q400, etc.)'),
  ('regional', 'r', '上記以外のリージョナルジェット', 'Other regional jet'),
  ('turboprop', 'r', '上記以外のターボプロップ', 'Other turboprop'),
  ('bizjet', 'r', 'ビジネスジェット（Gulfstream 等）', 'Business jet (Gulfstream, etc.)'),
  ('other', null, 'その他', 'Other')
on conflict (code) do update set cat = excluded.cat, name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_positions (code, name_ja, name_en) values
  ('cap', '機長（CAP）', 'Captain (CAP)'),
  ('fo', '副操縦士（FO）', 'First Officer (FO)'),
  ('cadet', '訓練生', 'Cadet / Trainee')
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_job_roles (code, name_ja, name_en) values
  ('line', 'ライン乗務', 'Line pilot'),
  ('instructor', '教官・訓練担当', 'Instructor / Training'),
  ('examiner', '審査・査察担当', 'Examiner / Check'),
  ('union', '組合・乗員代表', 'Union / Pilot representative'),
  ('management', '管理・マネジメント', 'Management / Leadership'),
  ('nonline', 'その他の兼務・配属', 'Other / Non-Line Assignment')
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_age_buckets (code, name_ja, name_en) values
  ('20-29', '20〜29歳', '20–29'),
  ('30-39', '30〜39歳', '30–39'),
  ('40-49', '40〜49歳', '40–49'),
  ('50-59', '50〜59歳', '50–59'),
  ('60+', '60歳以上', '60 or over')
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_housing_types (code, name_ja, name_en) values
  ('provided', '社宅・会社支給（現物）', 'Company-provided (in kind)'),
  ('allowance', '住宅手当（現金）', 'Housing allowance (cash)'),
  ('none', 'なし', 'None')
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_contract_types (code, name_ja, name_en) values
  ('direct', '直接雇用', 'Direct employment'),
  ('contract', '契約（有期・自営業含む）', 'Contract (incl. self-employed)'),
  ('agency', 'エージェンシー経由', 'Via agency')
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_currencies (code, dec, sym, name_ja, name_en) values
  ('USD', 2, '$', '米ドル', 'US Dollar'),
  ('EUR', 2, '€', 'ユーロ', 'Euro'),
  ('JPY', 0, '¥', '日本円', 'Japanese Yen'),
  ('GBP', 2, '£', '英ポンド', 'British Pound'),
  ('AED', 2, 'د.إ', 'UAEディルハム', 'UAE Dirham'),
  ('QAR', 2, 'ر.ق', 'カタールリヤル', 'Qatari Riyal'),
  ('SAR', 2, 'ر.س', 'サウジリヤル', 'Saudi Riyal'),
  ('KWD', 3, 'د.ك', 'クウェートディナール', 'Kuwaiti Dinar'),
  ('BHD', 3, '.د.ب', 'バーレーンディナール', 'Bahraini Dinar'),
  ('OMR', 3, 'ر.ع.', 'オマーンリアル', 'Omani Rial'),
  ('JOD', 3, 'د.ا', 'ヨルダンディナール', 'Jordanian Dinar'),
  ('TRY', 2, '₺', 'トルコリラ', 'Turkish Lira'),
  ('CHF', 2, 'CHF', 'スイスフラン', 'Swiss Franc'),
  ('SEK', 2, 'kr', 'スウェーデンクローナ', 'Swedish Krona'),
  ('NOK', 2, 'kr', 'ノルウェークローネ', 'Norwegian Krone'),
  ('DKK', 2, 'kr', 'デンマーククローネ', 'Danish Krone'),
  ('ISK', 0, 'kr', 'アイスランドクローナ', 'Icelandic Krona'),
  ('PLN', 2, 'zł', 'ポーランドズロチ', 'Polish Zloty'),
  ('HUF', 0, 'Ft', 'ハンガリーフォリント', 'Hungarian Forint'),
  ('CZK', 2, 'Kč', 'チェココルナ', 'Czech Koruna'),
  ('RON', 2, 'lei', 'ルーマニアレウ', 'Romanian Leu'),
  ('CAD', 2, 'C$', 'カナダドル', 'Canadian Dollar'),
  ('AUD', 2, 'A$', '豪ドル', 'Australian Dollar'),
  ('NZD', 2, 'NZ$', 'ニュージーランドドル', 'New Zealand Dollar'),
  ('FJD', 2, 'FJ$', 'フィジードル', 'Fijian Dollar'),
  ('SGD', 2, 'S$', 'シンガポールドル', 'Singapore Dollar'),
  ('HKD', 2, 'HK$', '香港ドル', 'Hong Kong Dollar'),
  ('TWD', 2, 'NT$', '台湾ドル', 'New Taiwan Dollar'),
  ('KRW', 0, '₩', '韓国ウォン', 'South Korean Won'),
  ('CNY', 2, '¥', '中国元', 'Chinese Yuan'),
  ('THB', 2, '฿', 'タイバーツ', 'Thai Baht'),
  ('MYR', 2, 'RM', 'マレーシアリンギット', 'Malaysian Ringgit'),
  ('IDR', 0, 'Rp', 'インドネシアルピア', 'Indonesian Rupiah'),
  ('PHP', 2, '₱', 'フィリピンペソ', 'Philippine Peso'),
  ('VND', 0, '₫', 'ベトナムドン', 'Vietnamese Dong'),
  ('BND', 2, 'B$', 'ブルネイドル', 'Brunei Dollar'),
  ('INR', 2, '₹', 'インドルピー', 'Indian Rupee'),
  ('EGP', 2, 'E£', 'エジプトポンド', 'Egyptian Pound'),
  ('ETB', 2, 'Br', 'エチオピアブル', 'Ethiopian Birr'),
  ('KES', 2, 'KSh', 'ケニアシリング', 'Kenyan Shilling'),
  ('ZAR', 2, 'R', '南アフリカランド', 'South African Rand'),
  ('MXN', 2, 'MX$', 'メキシコペソ', 'Mexican Peso'),
  ('BRL', 2, 'R$', 'ブラジルレアル', 'Brazilian Real'),
  ('CLP', 0, 'CLP$', 'チリペソ', 'Chilean Peso'),
  ('COP', 2, 'COL$', 'コロンビアペソ', 'Colombian Peso')
on conflict (code) do update set dec = excluded.dec, sym = excluded.sym,
  name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

update public.pv_fleets    set active = false where code not in ('a320', 'b737', 'a220', 'b757', 'e-jet', 'b767', 'b777', 'b787', 'b747', 'a330', 'a350', 'a380', 'crj', 'atr', 'dhc8', 'regional', 'turboprop', 'bizjet', 'other');
update public.pv_positions set active = false where code not in ('cap', 'fo');
update public.pv_job_roles set active = false where code not in ('line', 'instructor', 'examiner', 'union', 'management', 'nonline');
update public.pv_age_buckets set active = false where code not in ('20-29', '30-39', '40-49', '50-59', '60+');
update public.pv_housing_types  set active = false where code not in ('provided', 'allowance', 'none');
update public.pv_contract_types set active = false where code not in ('direct', 'contract', 'agency');
update public.pv_currencies set active = false where code not in ('USD', 'EUR', 'JPY', 'GBP', 'AED', 'QAR', 'SAR', 'KWD', 'BHD', 'OMR', 'JOD', 'TRY', 'CHF', 'SEK', 'NOK', 'DKK', 'ISK', 'PLN', 'HUF', 'CZK', 'RON', 'CAD', 'AUD', 'NZD', 'FJD', 'SGD', 'HKD', 'TWD', 'KRW', 'CNY', 'THB', 'MYR', 'IDR', 'PHP', 'VND', 'BND', 'INR', 'EGP', 'ETB', 'KES', 'ZAR', 'MXN', 'BRL', 'CLP', 'COP');

-- ── 換算レート ───────────────────────────────────────────────
-- ★ fx-rates.mjs（1通貨あたりの円。USD 1 = 158.95 円）から生成。
--    基準日 2026-08-22 / 出所 https://www.exchangerate-api.com / 取り直しは node gen-fx-rates.mjs。
-- ★ 語彙の 45 通貨すべてにレートがある（2026-08-22 に7→45）。
--    レートが無い通貨で出すと to_usd が無く annual_total_usd が null になり、
--    pay_benchmarks から黙って外れる。実際にエバー航空の台湾ドルが1件外れていた。
--    原本（currency ＋ 各金額）は必ず保存されるので、レートを入れた時点で再計算できる。
create table if not exists public.fx_rates (
  code   char(3) primary key references public.pv_currencies(code),
  to_usd numeric(14,6) not null check (to_usd > 0),
  to_jpy numeric(14,6) not null check (to_jpy > 0),
  as_of  date not null default current_date
);

insert into public.fx_rates (code, to_usd, to_jpy) values
  ('USD', 1.000000, 158.950000),
  ('EUR', 1.168229, 185.690000),
  ('JPY', 0.006291, 1.000000),
  ('GBP', 1.363699, 216.760000),
  ('AED', 0.272303, 43.282500),
  ('QAR', 0.274734, 43.668900),
  ('SAR', 0.266675, 42.388000),
  ('KWD', 3.273231, 520.280000),
  ('BHD', 2.659641, 422.750000),
  ('OMR', 2.600881, 413.410000),
  ('JOD', 1.410506, 224.200000),
  ('TRY', 0.020812, 3.308100),
  ('CHF', 1.248569, 198.460000),
  ('SEK', 0.105602, 16.785500),
  ('NOK', 0.107543, 17.093900),
  ('DKK', 0.156354, 24.852400),
  ('ISK', 0.008254, 1.311900),
  ('PLN', 0.271122, 43.094800),
  ('HUF', 0.003219, 0.511723),
  ('CZK', 0.048450, 7.701200),
  ('RON', 0.222486, 35.364100),
  ('CAD', 0.726581, 115.490000),
  ('AUD', 0.716452, 113.880000),
  ('NZD', 0.597909, 95.037600),
  ('FJD', 0.455612, 72.419600),
  ('SGD', 0.787921, 125.240000),
  ('HKD', 0.127552, 20.274400),
  ('TWD', 0.031435, 4.996600),
  ('KRW', 0.000722, 0.114707),
  ('CNY', 0.148420, 23.591300),
  ('THB', 0.030601, 4.864000),
  ('MYR', 0.247582, 39.353200),
  ('IDR', 0.000057, 0.009001),
  ('PHP', 0.016203, 2.575400),
  ('VND', 0.000039, 0.006123),
  ('BND', 0.787921, 125.240000),
  ('INR', 0.010444, 1.660000),
  ('EGP', 0.019655, 3.124100),
  ('ETB', 0.006190, 0.983966),
  ('KES', 0.007727, 1.228200),
  ('ZAR', 0.062416, 9.921100),
  ('MXN', 0.059093, 9.392900),
  ('BRL', 0.193167, 30.703900),
  ('CLP', 0.001222, 0.194221),
  ('COP', 0.000273, 0.043384)
on conflict (code) do update
  set to_usd = excluded.to_usd, to_jpy = excluded.to_jpy, as_of = current_date;

-- ── レートが無くて集計から外れていた行を戻す ──────────────────
-- レートが無い通貨で出した行は annual_total_usd が null になり、pay_benchmarks の
-- 対象から外れる（提出は成功しているので本人には見えている）。原本の
-- annual_total_orig と currency は残っているので、レートが入った今なら計算し直せる。
-- ★ null の行だけを触る＝何度流しても同じ。既に入っている行のレートは書き替えない
--   （提出時点のレートで確定させる。あとから全部を今日のレートに揃えると、
--     過去の集計が流すたびに動いて再現しなくなる）。
-- ★ pay_reports がまだ無い環境（語彙を先に流す）でも落ちないように包む。
-- ⚠️ **ここでは pv_* の関数を呼べない**（2026-09-02）。このファイルは
--    db/pay-reports.sql より**先に**貼るので、貼った瞬間にまだ関数が無い＝
--    パースで落ちる。そのため時間あたりの式は pv_block_hour_usd を呼ばず素の割り算のまま。
--    ＝ここで戻した行の usd_per_block_hour には「組合が総支給の外で払った分を抜く」規則が
--    掛からない。掛けたい行が出たら db/repair-union-gross-2.sql の側で入れ直す
--    （触るのは annual_total_usd が null の行だけなので、通常は1件も当たらない）。
do $$
declare n int;
begin
  if to_regclass('public.pay_reports') is null then
    raise notice 'pay_reports がまだ無いので取りこぼしの復旧はしない';
    return;
  end if;

  with fixed as (
    update public.pay_reports r
       set fx_to_usd = f.to_usd,
           fx_to_jpy = f.to_jpy,
           fx_at     = f.as_of,
           annual_total_usd = round(r.annual_total_orig * f.to_usd, 2),
           annual_total_jpy = round(r.annual_total_orig * f.to_jpy, 2),
           usd_per_block_hour = case when coalesce(r.block_hours, 0) > 0
                then round(round(r.annual_total_orig * f.to_usd, 2) / (12 * r.block_hours), 2) end,
           net_annual_jpy = case when r.tax_rate_pct is not null
                then round(round(r.annual_total_orig * f.to_jpy, 2) * (1 - r.tax_rate_pct / 100), 2) end
      from public.fx_rates f
     where f.code = r.currency
       and r.annual_total_usd is null
       and r.annual_total_orig is not null
    returning 1)
  select count(*) into n from fixed;

  raise notice '取りこぼしを復旧: % 件', n;
end $$;

-- 語彙は誰でも読める（フォームのラベルに使う）。書き込みポリシーは作らない。
do $$
declare t text;
begin
  foreach t in array array['pv_fleets','pv_positions','pv_job_roles','pv_age_buckets',
                           'pv_housing_types','pv_contract_types','pv_currencies','fx_rates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
  end loop;
end $$;

-- 検算：機種19 / 職位2 / 役職6 / 年代5 / 通貨45 / レート45
select
  (select count(*) from public.pv_fleets     where active) as 機種,
  (select count(*) from public.pv_positions  where active) as 職位,
  (select count(*) from public.pv_job_roles  where active) as 役職,
  (select count(*) from public.pv_age_buckets where active) as 年代,
  (select count(*) from public.pv_currencies where active) as 通貨,
  (select count(*) from public.fx_rates)                   as レート;
