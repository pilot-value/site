-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/schema-additions.sql
-- 会員メール通知（オプトイン）に必要な profiles 拡張と解除 RPC。
-- Supabase → SQL Editor に貼り付けて実行。冪等（何度流しても安全）。
--
-- 前提: フロント側は既に email_opt_in / email_opt_in_at を
--   signup.html（signUp metadata＋profiles upsert）と
--   profile.html（通知トグル）から送信する。列が無いと upsert は
--   フォールバックするが、通知配信には下記の適用が必須。
-- ════════════════════════════════════════════════════════════════

-- ── 1) 列の追加（存在しなければ）──
alter table public.profiles
  add column if not exists email_opt_in    boolean     not null default false,
  add column if not exists email_opt_in_at timestamptz,
  add column if not exists unsub_token      uuid        not null default gen_random_uuid();

-- 既存行に unsub_token が無ければ払い出し（保険）
update public.profiles set unsub_token = gen_random_uuid() where unsub_token is null;

-- 解除リンクの照合キーは一意に
create unique index if not exists profiles_unsub_token_key on public.profiles (unsub_token);

-- 配信対象の高速化（任意）
create index if not exists profiles_email_opt_in_idx on public.profiles (email_opt_in) where email_opt_in = true;


-- ── 2) 解除 RPC（ログイン不要・security definer で RLS を回避）──
-- unsubscribe.html?token=... から anon キーで呼ばれる。
create or replace function public.unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hit int;
begin
  update public.profiles
     set email_opt_in = false
   where unsub_token = p_token;
  get diagnostics hit = row_count;
  return hit > 0;   -- 一致行が無ければ false（既に解除済み等）
end;
$$;

-- 再開 RPC（解除ページの「再開」リンク用）
create or replace function public.resubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hit int;
begin
  update public.profiles
     set email_opt_in = true,
         email_opt_in_at = now()
   where unsub_token = p_token;
  get diagnostics hit = row_count;
  return hit > 0;
end;
$$;

-- anon（未ログイン）と authenticated から実行可能に
grant execute on function public.unsubscribe(uuid)  to anon, authenticated;
grant execute on function public.resubscribe(uuid)  to anon, authenticated;


-- ── 3) 新規登録トリガーの更新（metadata → profiles 反映）──
-- ※既存の handle_new_user がある場合は、この定義で置き換える想定。
--   既存のカラム構成に合わせて調整すること（下記は現行フォームの項目に対応）。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, name, gender, birthdate, country, company, position,
    email_opt_in, email_opt_in_at
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'gender',
    (new.raw_user_meta_data->>'birthdate')::date,
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'position',
    coalesce((new.raw_user_meta_data->>'email_opt_in')::boolean, false),
    nullif(new.raw_user_meta_data->>'email_opt_in_at','')::timestamptz
  )
  on conflict (id) do update set
    email          = excluded.email,
    name           = coalesce(excluded.name, public.profiles.name),
    gender         = coalesce(excluded.gender, public.profiles.gender),
    birthdate      = coalesce(excluded.birthdate, public.profiles.birthdate),
    country        = coalesce(excluded.country, public.profiles.country),
    company        = coalesce(excluded.company, public.profiles.company),
    position       = coalesce(excluded.position, public.profiles.position),
    email_opt_in    = coalesce(excluded.email_opt_in, public.profiles.email_opt_in),
    email_opt_in_at = coalesce(excluded.email_opt_in_at, public.profiles.email_opt_in_at);
  return new;
end;
$$;

-- トリガー本体（未作成なら作成）
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;

-- 確認用:
-- select id, email, email_opt_in, email_opt_in_at, unsub_token from public.profiles limit 5;


-- ════════════════════════════════════════════════════════════════
-- ── 4) reviews_v2 給与ディテール列（Levels.fyi 型 給与入力フォーム）──
-- submit-review.html の「基本給／乗務手当」分離入力＋機種／役職の収集用。
-- 冪等（何度流しても安全）。**適用しなくてもフロントは壊れない**：
--   フロントは列不在エラーを検知して該当キーを落とし再 insert する
--   （submit-review.html の OPTIONAL_COLS リトライ）。この SQL を流すと
--   初めて実際に保存されるようになる。
--
-- 既存の monthly_salary / bonus / annual_salary / salary_note は保持。
--   annual_salary … 総額（詳細モードでは base+乗務+賞与、月額モードでは月給×12+賞与）
--   base_annual   … 基本給（年・万円）
--   flight_allowance_annual … 乗務手当（年・万円）＝ブロックタイム×単価、機種で最も変動
--   fleet         … 機種（a320/b737/b787/a350 …）現役しか正確に持たない目玉フィールド
--   job_role      … 役職・区分（line/instructor/examiner/management）
-- ════════════════════════════════════════════════════════════════
alter table public.reviews_v2
  add column if not exists base_annual              integer,
  add column if not exists flight_allowance_annual  integer,
  add column if not exists fleet                    text,
  add column if not exists job_role                 text;

-- annual_salary は既存想定だが、無い環境向けに冪等で追加（総額保存先）
alter table public.reviews_v2
  add column if not exists annual_salary            integer;

-- 集計の高速化（任意）：機種別・役職別の将来クエリ用
create index if not exists reviews_v2_fleet_idx    on public.reviews_v2 (fleet)    where fleet    is not null;
create index if not exists reviews_v2_job_role_idx on public.reviews_v2 (job_role) where job_role is not null;

-- 確認用:
-- select airline, position, fleet, job_role, base_annual, flight_allowance_annual, bonus, annual_salary
--   from public.reviews_v2 order by created_at desc limit 10;


-- ════════════════════════════════════════════════════════════════
-- ── 5) 口コミの日↔英 自動翻訳（reviews_v2）──
-- ※このセクションだけを貼りやすく切り出したものが db/run-05-review-i18n.sql。
--   内容は同じ。直したときは両方を揃えること。
-- 日本語で投稿された口コミが英語ページにそのまま出ていた問題への対応。
-- orig_lang … 投稿原文の言語（'ja' | 'en'）
-- translations … 反対言語の訳文。形は {"en":{"culture":…,"salary":…,
--   "benefits":…,"wlb":…,"ops":…,"training":…,"mgmt":…}}（原文が en なら "ja"）。
--   欄が空の口コミはキー自体を入れない。表示側は translations が無い/空でも
--   原文表示にフォールバックするので、この SQL 未適用でもサイトは壊れない。
-- 冪等（何度流しても安全）。
-- ════════════════════════════════════════════════════════════════
alter table public.reviews_v2
  add column if not exists orig_lang    text not null default 'ja',
  add column if not exists translations jsonb;

comment on column public.reviews_v2.orig_lang    is '投稿原文の言語 ja|en';
comment on column public.reviews_v2.translations is '反対言語の訳文 {"en":{...}} または {"ja":{...}}';

-- 未翻訳の行だけを拾うための部分インデックス（Edge Function の再処理用）
create index if not exists reviews_v2_untranslated_idx
  on public.reviews_v2 (created_at) where translations is null;


-- ── 既存6件のバックフィル ──
-- Edge Function を用意する前に投稿された分。原文の意味を変えない忠実訳で、
-- 意訳・要約・脚色はしていない（1件も削っていない。空欄はキーごと省略）。
-- where に translations is null を付けているので、
-- 何度流しても既に入っている訳を上書きしない。
update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"culture":"There is a sense of distance between the company and the crew, but the training and the operation itself are of high quality.","salary":"The pay is attractive and I have no complaints.","benefits":"One of the attractions is the staff travel tickets, which can be used for family members as well, on both domestic and international flights. That said, on international flights you can end up waiting for an open seat, so there are few chances to actually use them when taking a long break.","wlb":"Duty periods are long, and I often feel the fatigue even during the time I spend with my family on days off.","ops":"Safety standards are very high, but there is no denying that some pilots are characters who operate in their own particular way.","training":"High quality, and I have no complaints. Most of it is carried out during daytime hours, so the physical strain is also light."}}$j$::jsonb
 where id = '1920cde4-325a-4629-8979-726a51bd2a93' and translations is null;

update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"culture":"Inside, it is still a Showa-era Japanese conglomerate stuck in its old ways. Very much a hierarchical, athletic-club culture. A culture that is fairly hard going for the Reiwa generation.","salary":"It has not kept up with inflation at all.\nWe used to have the number-one pay among Japanese airlines, but lately other carriers have kept raising theirs in order to stop talent from leaving, so our pay no longer has any advantage.","benefits":"Good overall.","wlb":"Good overall.","ops":"Discrepancies with the dispatcher do arise, but the principle that final authority rests with the captain is respected.","mgmt":"If you are going to call yourselves a leading airline, then lead on pilot pay levels as well.\nOtherwise the outflow of talent will become impossible to stop."}}$j$::jsonb
 where id = '9f19c930-fbb9-48ab-b004-e2a6b2f78309' and translations is null;

update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"culture":"I think it has become considerably easier to work here than it used to be, but even so there is nothing but room for improvement.","salary":"I cannot say it is very good.","benefits":"There is a housing allowance, but it amounts to a pittance.","wlb":"Duty periods are a little under 9–12 hours every day. For some people they are longer. If you have a duty-officer shift, a flight follows straight after the shift ends, so you are on duty for 36 hours.\nBasically you are doing flight duties and ground duties continuously, so even if a flight finishes in the early afternoon, ground duties follow and you never get to go home.","ops":"Not good, the aircraft and the environment included.","training":"There is not much in the way of support."}}$j$::jsonb
 where id = 'fb3ddffa-a5ab-4553-84cd-84b7e8551fd6' and translations is null;

update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"culture":"It is rigid.\nMany people are fed up with the fact that governance is not working.\nThe company cannot get out from under its alcohol problem.","salary":"The pay is so-so.","benefits":"Considerably inferior compared with ANA.","wlb":"There is a lot that is tough.\nYou can take days off without any trouble.\nAs long as it falls within the regulations, you get assigned punishing rosters right up to the limit.","ops":"Time pressure is heavy.\nAwareness differs too much between departments, and the organization has become siloed.","training":"It is properly run, but demanding.\nI would not recommend it if you want to be promoted quickly."}}$j$::jsonb
 where id = 'e6c70426-06de-44a3-b2b6-c667df6eb8e5' and translations is null;

update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"culture":"When it comes to safety culture, it is extremely strict. That said, there is a tendency to become bound by rules and procedures beyond what the actual situation warrants (bureaucratic), and voices from the front line sometimes suggest that a somewhat more flexible operation would be acceptable.","salary":"Base pay and allowances were cut heavily at the time of the bankruptcy in the past, but following the subsequent recovery in performance and the recent moves to address inflation and to invest in people, they have now been corrected to a level befitting the top of the industry.","benefits":"The staff travel scheme on JAL and partner flights, which makes the most of oneworld membership, is extremely strong. It contributes a great deal to time spent with family and to enriching my own private life."}}$j$::jsonb
 where id = '1bef802d-755c-4193-8dfe-840e1d71c31e' and translations is null;

update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"benefits":"Because we are based at Haneda Airport, we operate within an extremely congested schedule. Maintaining on-time performance while staying conscious of fuel efficiency (eco-flight) and at the same time guaranteeing safety — the advanced management ability demanded of a captain is tested on every single flight.","wlb":"Because we are based at Haneda Airport, we operate within an extremely congested schedule. Maintaining on-time performance while staying conscious of fuel efficiency (eco-flight) and at the same time guaranteeing safety — the advanced management ability demanded of a captain is tested on every single flight.","ops":"Because we are based at Haneda Airport, we operate within an extremely congested schedule. Maintaining on-time performance while staying conscious of fuel efficiency (eco-flight) and at the same time guaranteeing safety — the advanced management ability demanded of a captain is tested on every single flight."}}$j$::jsonb
 where id = 'b95b3841-5db9-4d77-96bc-a8a0aad53b3b' and translations is null;

-- 確認用（使うときは下の4行から -- を「まとめて」外す。1行だけ外すと
-- 文が途中で終わって 42601 syntax error at end of input になる）:
-- select id, airline, orig_lang,
--        translations->'en'->>'culture' as culture_en,
--        translations is null as untranslated
--   from public.reviews_v2 order by created_at desc;


-- ════════════════════════════════════════════════════════════════
-- ── 6) 口コミの給与を入力したときの通貨（reviews_v2）──
-- ※このセクションだけを貼りやすく切り出したものが
--   db/run-06-review-input-currency.sql。内容は同じ。直したら両方を揃えること。
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
-- 冪等（何度流しても安全）。**適用しなくてもフロントは壊れない**：
--   列不在エラーを検知して該当キーを落とし再 insert する
--   （submit-review.html の OPTIONAL_COLS リトライ）。流すと初めて実際に保存される。
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
