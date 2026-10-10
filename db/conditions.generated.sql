-- ════════════════════════════════════════════════════════════════
-- db/conditions.generated.sql — ★自動生成。手で編集しない。
--   生成元: pv-conditions.mjs
--   再生成: node gen-conditions.mjs
--
-- 待遇アンケートの質問マスタ。何度流しても安全（upsert）。
-- 質問から消えたコードは無効化するだけで消さない（回答が参照している）。
--
-- ★流す順番: このファイル → db/airline-conditions.sql
--   逆にすると参照先の質問が無くて落ちる（向こうの冒頭が止める）。
-- ════════════════════════════════════════════════════════════════

create table if not exists public.pv_condition_sections (
  code text primary key,
  name_ja text not null, name_en text not null,
  sort smallint not null default 0,
  active boolean not null default true
);

-- 1問の定義。回答は airline_conditions に「1回答＝1行」で入る。
--   kind        choice=1つ選ぶ / multi=複数選ぶ / num=数値 / lines=明細行
--   tier        A→B→C の順に埋める。A は全社を横並びで比較できる普遍的な項目
--   micro       給与レポート直後に1問だけ出してよいか
--               （1タップで終わる choice だけ。親があってもよく、出す側が親の答えを見て絞る）
--   boost       まだ1問も答えていない人にだけ効く最優先の並び替え（大きいほど先・既定0）。
--               最初の3問を指定するためのもの。priority を動かすと詳細ページの節の並びが崩れる
--   is_opinion  制度の有無でなく本人の体感。公開時に会社の事実として並べない
--   parent/parent_when  親の答えが parent_when に入るときだけ出す
--   topic       話題の入口の印（会社の概要の画面から来る口）。枝ごと同じ話題にしてある
--   topic_only  話題の入口から来た人にだけ出す。提出直後の1問枠にも一覧にも出さず、
--               「あなたが答えた項目：N／48」の分母にも分子にも数えない
--               （出さない・数えないは db/airline-conditions.sql。保存と公開集計は他の質問と同じ）
--   spec        kind ごとの付帯情報（数値の刻み、明細行の語彙）
create table if not exists public.pv_condition_questions (
  id text primary key,
  version smallint not null default 1,
  section text not null references public.pv_condition_sections(code),
  kind text not null check (kind in ('choice', 'multi', 'num', 'lines')),
  tier char(1) not null default 'C',
  micro boolean not null default false,
  priority smallint not null default 100,
  boost smallint not null default 0,
  is_opinion boolean not null default false,
  parent text references public.pv_condition_questions(id),
  parent_when text[],
  topic text,
  topic_only boolean not null default false,
  choice_codes text[],
  num_min numeric(12,2),
  num_max numeric(12,2),
  has_currency boolean not null default false,
  has_note boolean not null default false,
  spec jsonb not null default '{}'::jsonb,
  label_ja text not null,
  label_en text not null,
  active boolean not null default true
);

-- 後から足した列（既にテーブルがある環境向け）。create table if not exists は列を足さない。
alter table public.pv_condition_questions add column if not exists tier char(1) not null default 'C';
alter table public.pv_condition_questions add column if not exists is_opinion boolean not null default false;
alter table public.pv_condition_questions add column if not exists has_currency boolean not null default false;
alter table public.pv_condition_questions add column if not exists has_note boolean not null default false;
alter table public.pv_condition_questions add column if not exists spec jsonb not null default '{}'::jsonb;
alter table public.pv_condition_questions add column if not exists boost smallint not null default 0;
alter table public.pv_condition_questions add column if not exists topic text;
alter table public.pv_condition_questions add column if not exists topic_only boolean not null default false;

-- 検品の一部は DB 側にも置く。SSOT を通さず手で1行入れられたときに効く。
-- ★毎回 drop してから付け直す。「無ければ作る」だと、条件を変えて流し直したときに
--   古い定義が残ったまま黙って通ってしまう（micro の条件は実際に一度変わっている）。
alter table public.pv_condition_questions drop constraint if exists pv_cq_tier_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_micro_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_parent_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_choice_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_topic_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_topic_only_ck;
alter table public.pv_condition_questions
  add constraint pv_cq_tier_ck check (tier in ('A', 'B', 'C'));
-- micro＝1タップで終わる形か。親の有無は見ない（親の答えを持つ人にだけ出す＝出す側の仕事）
alter table public.pv_condition_questions
  add constraint pv_cq_micro_ck check (not micro or (kind = 'choice' and not has_note and not is_opinion));
alter table public.pv_condition_questions
  add constraint pv_cq_parent_ck check (parent is null or coalesce(array_length(parent_when, 1), 0) > 0);
alter table public.pv_condition_questions
  add constraint pv_cq_choice_ck check (
    (kind in ('choice','multi')) = (coalesce(array_length(choice_codes, 1), 0) > 0));
alter table public.pv_condition_questions
  add constraint pv_cq_topic_ck check (topic is null or topic in ('taxi', 'staff_travel', 'upgrade'));
-- topic_only＝話題の入口からだけ出す。入口（topic）が要り、1問枠の印（micro・boost）とは同時に立たない
alter table public.pv_condition_questions
  add constraint pv_cq_topic_only_ck check (not topic_only or (topic is not null and not micro and boost = 0));

insert into public.pv_condition_sections (code, name_ja, name_en, sort) values
  ('roster', '勤務スケジュール', 'Roster', 0),
  ('career', 'キャリア', 'Career', 1),
  ('time_off', '休暇', 'Time off', 2),
  ('benefits', '手当・サポート', 'Benefits', 3)
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en,
  sort = excluded.sort, active = true;

-- ★親は子より先に入れる（自己参照の外部キー）。並び順は pv-conditions.mjs の並びそのまま。
insert into public.pv_condition_questions
  (id, version, section, kind, tier, micro, priority, boost, is_opinion, parent, parent_when,
   topic, topic_only,
   choice_codes, num_min, num_max, has_currency, has_note, spec, label_ja, label_en) values
  ('days_off_request', 1, 'roster', 'choice', 'A', true, 10, 3, false, null, null, null, false, array['yes', 'partial', 'no', 'unknown'], null, null, false, false, '{}', '希望する休日の日付を指定できますか？', 'Can pilots request specific days off?'),
  ('days_off_request_limit', 1, 'roster', 'num', 'A', false, 11, 0, false, 'days_off_request', array['yes', 'partial'], null, false, null, 0, 31, false, false, '{"step":1}', '月に何日まで希望できますか？', 'How many days per month can be requested?'),
  ('schedule_bidding', 1, 'roster', 'choice', 'A', true, 12, 2, false, null, null, null, false, array['yes', 'partial', 'no', 'unknown'], null, null, false, false, '{}', '勤務スケジュールの希望を提出できますか？', 'Can pilots submit preferences for their roster?'),
  ('bidding_scope', 1, 'roster', 'multi', 'A', false, 13, 0, false, 'schedule_bidding', array['yes', 'partial'], null, false, array['days_off', 'consecutive', 'routes', 'layovers', 'avoid_early', 'avoid_night', 'turnaround', 'block', 'reserve', 'other'], null, null, false, false, '{}', 'どの希望を出せますか？', 'What can be bid for?'),
  ('seniority_effect', 1, 'roster', 'choice', 'C', false, 14, 0, true, null, null, null, false, array['strong', 'some', 'little', 'unknown'], null, null, false, false, '{}', '休日や路線の希望は、先任順位（Seniority）で通りやすさが変わりますか？', 'Does seniority change how likely your day-off or route bids are granted?'),
  ('reserve_duty', 1, 'roster', 'choice', 'A', true, 15, 0, false, null, null, null, false, array['yes', 'some_pilots', 'no', 'unknown'], null, null, false, false, '{}', 'Reserve / Standby 勤務はありますか？', 'Is there reserve / standby duty?'),
  ('reserve_location', 1, 'roster', 'choice', 'A', true, 16, 0, false, 'reserve_duty', array['yes', 'some_pilots'], null, false, array['home', 'airport', 'both', 'unknown'], null, null, false, false, '{}', 'Reserve は自宅待機ですか、空港待機ですか？', 'Is reserve served at home or at the airport?'),
  ('reserve_days', 1, 'roster', 'num', 'A', false, 17, 0, false, 'reserve_duty', array['yes', 'some_pilots'], null, false, null, 0, 31, false, false, '{"step":1}', '月に平均何日くらいですか？', 'How many days per month on average?'),
  ('roster_lead_days', 1, 'roster', 'num', 'A', false, 18, 0, false, null, null, null, false, null, 1, 90, false, false, '{"step":1}', '翌月の勤務予定は、何日前に確定しますか？', 'How far in advance is next month’s roster published?'),
  ('roster_changes', 1, 'roster', 'choice', 'A', true, 19, 0, false, null, null, null, false, array['rare', 'sometimes', 'often', 'unknown'], null, null, false, false, '{}', '確定後の勤務変更は多いですか？', 'How often does the published roster change afterwards?'),
  ('external_hiring', 1, 'career', 'choice', 'A', true, 20, 1, false, null, null, null, false, array['yes', 'conditional', 'rare', 'no', 'unknown'], null, null, false, false, '{}', '他社からパイロットとして中途入社できますか？', 'Can pilots join from another airline?'),
  ('external_experience_credit', 1, 'career', 'choice', 'A', true, 21, 0, false, 'external_hiring', array['yes', 'conditional'], null, false, array['major', 'partial', 'minimal', 'case_by_case', 'unknown'], null, null, false, false, '{}', '他社でのパイロット経験は、入社時の待遇（Rank・給与ステップ）に考慮されますか？', 'Does prior airline experience count towards your starting rank and pay step?'),
  ('external_seniority_start', 1, 'career', 'choice', 'A', true, 22, 0, false, 'external_hiring', array['yes', 'conditional'], null, false, array['from_join', 'credited', 'case_by_case', 'unknown'], null, null, false, false, '{}', '中途入社した場合、社内の先任順位（Seniority）はどこから始まりますか？', 'Where does your seniority start if you join from another airline?'),
  ('training_bond', 1, 'career', 'choice', 'A', true, 23, 0, false, null, null, null, false, array['yes', 'conditional', 'no', 'unknown'], null, null, false, false, '{}', '入社時の訓練費用に、Bond・返済義務がありますか？', 'Is there a training bond or repayment obligation on joining?'),
  ('training_bond_years', 1, 'career', 'num', 'A', false, 24, 0, false, 'training_bond', array['yes', 'conditional'], null, false, null, 0.5, 15, false, false, '{"step":0.5}', '拘束期間は何年ですか？', 'How many years does the bond run for?'),
  ('training_bond_amount', 1, 'career', 'num', 'A', false, 25, 0, false, 'training_bond', array['yes', 'conditional'], null, false, null, 0, 100000000, true, false, '{"step":1}', '金額はいくらですか？', 'How much is the bond?'),
  ('upgrade_years', 1, 'career', 'num', 'A', false, 26, 0, false, null, null, 'upgrade', false, null, 0.5, 30, false, false, '{"step":0.5}', '副操縦士から機長まで、今どれくらいかかりますか？', 'How long does it currently take to upgrade from First Officer to Captain?'),
  ('upgrade_order', 1, 'career', 'choice', 'B', false, 27, 0, false, null, null, 'upgrade', true, array['seniority', 'seniority_selection', 'selection', 'vacancy_bid', 'unknown'], null, null, false, true, '{}', '機長への昇格の順番は、どう決まりますか？', 'How is the order of upgrade to Captain decided?'),
  ('upgrade_min_hours', 1, 'career', 'choice', 'B', false, 28, 0, false, null, null, 'upgrade', true, array['none', 'under_3000', 'h3000_4999', 'h5000_6999', 'h7000_plus', 'unknown'], null, null, false, false, '{}', '機長昇格に必要な総飛行時間の条件は、どれですか？', 'What is the minimum total flight time required for upgrade to Captain?'),
  ('upgrade_min_tenure', 1, 'career', 'choice', 'B', false, 29, 0, false, null, null, 'upgrade', true, array['none', 'under_3', 'y3_5', 'y6_9', 'y10_plus', 'unknown'], null, null, false, false, '{}', '機長昇格に必要な在籍年数の条件は、どれですか？', 'What is the minimum time with the company required for upgrade to Captain?'),
  ('external_hiring_types', 1, 'career', 'multi', 'B', false, 30, 0, false, 'external_hiring', array['yes', 'conditional'], null, false, array['fo', 'captain', 'dec', 'type_rated', 'other'], null, null, false, false, '{}', 'どの形の採用がありますか？', 'What forms of external hiring exist?'),
  ('cadet_program', 1, 'career', 'choice', 'B', true, 31, 0, false, null, null, null, false, array['regular', 'irregular', 'suspended', 'no', 'unknown'], null, null, false, false, '{}', '自社養成パイロット制度はありますか？', 'Is there a cadet programme?'),
  ('fo_development', 1, 'career', 'choice', 'B', true, 32, 0, false, null, null, null, false, array['formal', 'informal', 'none', 'unknown'], null, null, false, false, '{}', '副操縦士の成長を継続的に支援する制度がありますか？', 'Is there ongoing support for First Officer development?'),
  ('annual_leave_days', 1, 'time_off', 'num', 'A', false, 40, 0, false, null, null, null, false, null, 0, 60, false, false, '{"step":1}', '年間の有給休暇は何日ですか？', 'How many days of annual paid leave are there?'),
  ('sick_leave', 1, 'time_off', 'choice', 'A', true, 41, 0, false, null, null, null, false, array['days', 'unlimited', 'varies', 'none', 'unknown'], null, null, false, false, '{}', '病気休暇（Sick Leave）はどれくらい使えますか？', 'How much sick leave is available?'),
  ('sick_leave_days', 1, 'time_off', 'num', 'A', false, 42, 0, false, 'sick_leave', array['days'], null, false, null, 0, 365, false, false, '{"step":1}', '年間で何日ですか？', 'How many days per year?'),
  ('peer_support', 1, 'benefits', 'choice', 'B', true, 49, 0, false, null, null, null, false, array['internal', 'external', 'both', 'no', 'unknown'], null, null, false, false, '{}', 'パイロット向けの Peer Support 制度がありますか？', 'Is there a Peer Support programme for pilots?'),
  ('landing_pay', 1, 'benefits', 'choice', 'C', true, 50, 0, false, null, null, null, false, array['fixed', 'variable', 'no', 'unknown'], null, null, false, false, '{}', '着陸回数に応じた手当はありますか？', 'Is there a landing allowance?'),
  ('landing_pay_amount', 1, 'benefits', 'num', 'C', false, 51, 0, false, 'landing_pay', array['fixed'], null, false, null, 1, 10000000, true, false, '{"step":0.01}', '着陸手当はいくらですか？', 'How much is the landing allowance?'),
  ('landing_pay_unit', 1, 'benefits', 'choice', 'C', false, 52, 0, false, 'landing_pay', array['fixed'], null, false, array['per_landing', 'per_leg', 'unknown'], null, null, false, false, '{}', '着陸手当は何を1回と数えますか？', 'Landing allowance: paid per landing or per sector?'),
  ('landing_pay_from', 1, 'benefits', 'num', 'C', false, 53, 0, false, 'landing_pay', array['variable'], null, false, null, 1, 10000000, true, false, '{"step":0.01}', '着陸手当の低いほうの額', 'Landing allowance: lowest amount'),
  ('landing_pay_to', 1, 'benefits', 'num', 'C', false, 54, 0, false, 'landing_pay', array['variable'], null, false, null, 1, 10000000, true, false, '{"step":0.01}', '着陸手当の高いほうの額', 'Landing allowance: highest amount'),
  ('landing_pay_varies_by', 1, 'benefits', 'choice', 'C', false, 55, 0, false, 'landing_pay', array['variable'], null, false, array['aircraft', 'airport', 'rank', 'count', 'mixed', 'unknown'], null, null, false, true, '{}', '着陸手当の額は何で変わりますか？', 'What does the landing allowance vary by?'),
  ('ground_duty_pay', 1, 'benefits', 'choice', 'C', false, 56, 0, false, null, null, null, false, array['yes', 'case_by_case', 'no', 'unknown'], null, null, false, true, '{}', '乗務以外の会社業務に、手当や勤務時間上の補償がありますか？', 'Is non-flying company work compensated, in pay or in duty credit?'),
  ('staff_travel', 1, 'benefits', 'choice', 'A', true, 57, 0, false, null, null, 'staff_travel', false, array['yes', 'some_pilots', 'no', 'unknown'], null, null, false, false, '{}', '自社便に割引や無料で乗れる社員向けの航空券制度がありますか？', 'Is there a staff travel scheme — free or reduced-fare tickets on your own airline?'),
  ('staff_travel_booking', 1, 'benefits', 'choice', 'B', true, 58, 0, false, 'staff_travel', array['yes', 'some_pilots'], 'staff_travel', false, array['standby', 'both', 'confirmed', 'unknown'], null, null, false, false, '{}', 'その席は空席待ちですか、確保できますか？', 'Are those seats standby, or can they be confirmed?'),
  ('staff_travel_cabin', 1, 'benefits', 'choice', 'B', true, 59, 0, false, 'staff_travel', array['yes', 'some_pilots'], 'staff_travel', false, array['by_rank', 'if_available', 'economy', 'unknown'], null, null, false, false, '{}', 'ビジネスクラスなど上位クラスに乗れますか？', 'Can you travel in a premium cabin such as business class?'),
  ('staff_travel_family', 1, 'benefits', 'choice', 'B', true, 60, 0, false, 'staff_travel', array['yes', 'some_pilots'], 'staff_travel', false, array['self', 'partner', 'family', 'unknown'], null, null, false, false, '{}', '家族も使えますか？', 'Can family members use it?'),
  ('staff_travel_standby_trips', 1, 'benefits', 'choice', 'B', true, 61, 0, false, 'staff_travel_booking', array['standby', 'both'], 'staff_travel', false, array['unlimited', 'limit_13_plus', 'limit_5_12', 'limit_1_4', 'unknown'], null, null, false, false, '{}', '空席待ちの社員向け航空券は、1年に何回まで使えますか？', 'How many times a year can you use standby staff tickets?'),
  ('staff_travel_standby_cost', 1, 'benefits', 'choice', 'B', true, 62, 0, false, 'staff_travel_booking', array['standby', 'both'], 'staff_travel', false, array['free', 'taxes_only', 'reduced_fare', 'unknown'], null, null, false, false, '{}', '空席待ちの社員向け航空券で乗るとき、本人が払うのはどれに近いですか？', 'What do you pay yourself when you fly on a standby staff ticket?'),
  ('staff_travel_standby_family', 1, 'benefits', 'multi', 'B', false, 63, 0, false, 'staff_travel_booking', array['standby', 'both'], 'staff_travel', false, array['self', 'partner', 'children', 'parents', 'siblings', 'nominee', 'other'], null, null, false, false, '{}', '空席待ちの社員向け航空券は、誰が使えますか？', 'Who can travel on standby staff tickets?'),
  ('staff_travel_confirmed_trips', 1, 'benefits', 'choice', 'B', true, 64, 0, false, 'staff_travel_booking', array['both', 'confirmed'], 'staff_travel', false, array['unlimited', 'limit_5_plus', 'limit_3_4', 'limit_2', 'limit_1', 'unknown'], null, null, false, false, '{}', '座席を確保できる社員向け航空券は、1年に何回まで使えますか？', 'How many times a year can you use confirmed-seat staff tickets?'),
  ('staff_travel_confirmed_cost', 1, 'benefits', 'choice', 'B', true, 65, 0, false, 'staff_travel_booking', array['both', 'confirmed'], 'staff_travel', false, array['free', 'taxes_only', 'reduced_fare', 'unknown'], null, null, false, false, '{}', '座席を確保できる社員向け航空券で乗るとき、本人が払うのはどれに近いですか？', 'What do you pay yourself when you fly on a confirmed-seat staff ticket?'),
  ('staff_travel_confirmed_family', 1, 'benefits', 'multi', 'B', false, 66, 0, false, 'staff_travel_booking', array['both', 'confirmed'], 'staff_travel', false, array['self', 'partner', 'children', 'parents', 'siblings', 'nominee', 'other'], null, null, false, false, '{}', '座席を確保できる社員向け航空券は、誰が使えますか？', 'Who can travel on confirmed-seat staff tickets?'),
  ('commuting_transport', 1, 'benefits', 'choice', 'B', true, 67, 0, false, null, null, 'taxi', false, array['always', 'conditional', 'no', 'unknown'], null, null, false, false, '{}', '出社・帰宅の移動を、会社が用意または負担しますか？', 'Does the company provide or pay for your travel to and from work?'),
  ('commuting_transport_method', 1, 'benefits', 'multi', 'B', false, 68, 0, false, 'commuting_transport', array['always', 'conditional'], 'taxi', false, array['company_taxi', 'reimburse', 'crew_bus', 'hotel', 'other'], null, null, false, false, '{}', 'どの形で提供されますか？', 'How is it provided?'),
  ('commuting_taxi_when', 1, 'benefits', 'multi', 'B', false, 69, 0, false, 'commuting_transport_method', array['company_taxi', 'reimburse'], 'taxi', false, array['any_time', 'no_public_transport', 'outside_set_hours', 'standby_callout', 'disruption', 'other'], null, null, false, false, '{}', 'タクシーでの出社・帰宅は、どんなときに会社の手配や精算で使えますか？', 'When can you take a taxi to or from work, arranged or reimbursed by the company?'),
  ('commuting_taxi_where', 1, 'benefits', 'choice', 'B', true, 70, 0, false, 'commuting_transport_method', array['company_taxi', 'reimburse'], 'taxi', false, array['door_to_door', 'within_area', 'to_set_point', 'unknown'], null, null, false, false, '{}', 'タクシーでの出社・帰宅は、どこまで会社の手配や精算で使えますか？', 'How far does a company-arranged or reimbursed taxi to or from work reach?'),
  ('commuting_taxi_cost', 1, 'benefits', 'choice', 'B', true, 71, 0, false, 'commuting_transport_method', array['company_taxi', 'reimburse'], 'taxi', false, array['company_full', 'partial', 'self_full', 'unknown'], null, null, false, false, '{}', 'タクシーでの出社・帰宅の費用は、誰が負担しますか？', 'Who pays for a taxi to or from work?'),
  ('commuting_taxi_cap', 1, 'benefits', 'choice', 'B', false, 72, 0, false, 'commuting_transport_method', array['company_taxi', 'reimburse'], 'taxi', true, array['no_cap', 'per_ride', 'per_month', 'by_zone', 'unknown'], null, null, false, true, '{}', '通勤のタクシー代に、上限はありますか？', 'Is there a cap on what the company pays for a taxi to or from work?'),
  ('commuting_bus_when', 1, 'benefits', 'multi', 'B', false, 73, 0, false, 'commuting_transport_method', array['crew_bus'], 'taxi', false, array['any_time', 'no_public_transport', 'outside_set_hours', 'standby_callout', 'disruption', 'other'], null, null, false, false, '{}', 'クルーバス（送迎バス）は、どんなときに出社・帰宅で使えますか？', 'When can you use the crew bus (company bus) to get to or from work?'),
  ('commuting_bus_cost', 1, 'benefits', 'choice', 'B', true, 74, 0, false, 'commuting_transport_method', array['crew_bus'], 'taxi', false, array['company_full', 'partial', 'self_full', 'unknown'], null, null, false, false, '{}', 'クルーバス（送迎バス）の費用は、誰が負担しますか？', 'Who pays for the crew bus (company bus) to or from work?')
on conflict (id) do update set
  version = excluded.version, section = excluded.section, kind = excluded.kind,
  tier = excluded.tier, micro = excluded.micro, priority = excluded.priority,
  boost = excluded.boost, is_opinion = excluded.is_opinion,
  parent = excluded.parent, parent_when = excluded.parent_when,
  topic = excluded.topic, topic_only = excluded.topic_only,
  choice_codes = excluded.choice_codes, num_min = excluded.num_min, num_max = excluded.num_max,
  has_currency = excluded.has_currency, has_note = excluded.has_note, spec = excluded.spec,
  label_ja = excluded.label_ja, label_en = excluded.label_en, active = true;

update public.pv_condition_sections  set active = false where code not in ('roster', 'career', 'time_off', 'benefits');
update public.pv_condition_questions set active = false where id not in ('days_off_request', 'days_off_request_limit', 'schedule_bidding', 'bidding_scope', 'seniority_effect', 'reserve_duty', 'reserve_location', 'reserve_days', 'roster_lead_days', 'roster_changes', 'external_hiring', 'external_experience_credit', 'external_seniority_start', 'training_bond', 'training_bond_years', 'training_bond_amount', 'upgrade_years', 'upgrade_order', 'upgrade_min_hours', 'upgrade_min_tenure', 'external_hiring_types', 'cadet_program', 'fo_development', 'annual_leave_days', 'sick_leave', 'sick_leave_days', 'peer_support', 'landing_pay', 'landing_pay_amount', 'landing_pay_unit', 'landing_pay_from', 'landing_pay_to', 'landing_pay_varies_by', 'ground_duty_pay', 'staff_travel', 'staff_travel_booking', 'staff_travel_cabin', 'staff_travel_family', 'staff_travel_standby_trips', 'staff_travel_standby_cost', 'staff_travel_standby_family', 'staff_travel_confirmed_trips', 'staff_travel_confirmed_cost', 'staff_travel_confirmed_family', 'commuting_transport', 'commuting_transport_method', 'commuting_taxi_when', 'commuting_taxi_where', 'commuting_taxi_cost', 'commuting_taxi_cap', 'commuting_bus_when', 'commuting_bus_cost');

-- 聞く頻度の設定。★数字を持つ場所を1つにする（生成元は pv-conditions.mjs の SETTINGS）。
--   next_condition_questions がここを読む。同じ数字が pv-conditions.json にも入り、画面が読む。
--   ⚠️ SQL に interval '365 days' のような直書きを戻さない。片方だけ直る事故になる。
create table if not exists public.pv_condition_settings (
  key text primary key,
  value int not null
);

insert into public.pv_condition_settings (key, value) values
  ('answer_reask_days', 365),
  ('unknown_reask_days', 180),
  ('skip_reask_days', 90),
  ('initial_limit', 3),
  ('recurring_limit', 1),
  ('profile_limit', 1),
  ('modal_delay_ms', 700)
on conflict (key) do update set value = excluded.value;

-- SSOT から消えた設定は残さない（古い key を読み続ける関数が出ないように）
delete from public.pv_condition_settings where key not in ('answer_reask_days', 'unknown_reask_days', 'skip_reask_days', 'initial_limit', 'recurring_limit', 'profile_limit', 'modal_delay_ms');

-- 1つ読む。key が無ければ既定値を返す（DB を流す前でも関数が落ちないように）
create or replace function public.pv_condition_setting(p_key text, p_default int)
returns int language sql stable set search_path = public, pg_temp as $$
  select coalesce((select value from public.pv_condition_settings where key = p_key), p_default)
$$;

-- 入力欄の上限。★画面（pv-conditions.js）と保存側（submit_airline_conditions）で
--   別々の数字を持たないよう、pv-conditions.mjs から配る。
create or replace function public.pv_condition_limits()
returns jsonb language sql immutable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'text_max', 300, 'lines_max', 10, 'line_name_max', 40,
    'unknown', 'unknown')
$$;
grant execute on function public.pv_condition_limits() to anon, authenticated;

-- 質問文は誰でも読める（フォームのラベルに使う）。書き込みポリシーは作らない。
do $$
declare t text;
begin
  foreach t in array array['pv_condition_sections','pv_condition_questions','pv_condition_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
  end loop;
end $$;

-- 検算：節4 / 質問52（一覧に出る質問48 ＋ 話題の入口からだけ出る質問4）/ 提出直後に出せる質問26
--        Tier A20 / B24 / C8
select
  (select count(*) from public.pv_condition_sections  where active)                as 節,
  (select count(*) from public.pv_condition_questions where active)                as 質問,
  (select count(*) from public.pv_condition_questions where active and not topic_only) as 一覧に出る質問,
  (select count(*) from public.pv_condition_questions where active and topic_only)     as 話題の入口からだけ出る質問,
  (select count(*) from public.pv_condition_questions where active and micro)      as 直後に出せる質問,
  (select count(*) from public.pv_condition_questions where active and tier = 'A') as tier_a,
  (select count(*) from public.pv_condition_questions where active and boost > 0) as 最初の3問,
  (select count(*) from public.pv_condition_settings)                             as 設定;
