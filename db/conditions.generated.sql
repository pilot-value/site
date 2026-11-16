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
--               「あなたが答えた項目：N／51」の分母にも分子にも数えない
--               （出さない・数えないは db/airline-conditions.sql。保存と公開集計は他の質問と同じ）
--   deep        続きの質問（2026-11-14）。'partial' ＝ 親に「一部」の答えをした本人だけ／'split' ＝ その会社で親の答えが
--               分かれているときだけ（見せる門は pv_condition_split）。一覧の行にも「答えた項目」の数にも入れない
--   other_text  「その他」（other）を選んだ人にだけ1行の欄（100字まで）を出す（2026-11-16）。字は answer_text に入り、
--               会社ページに出すのは運営が載せた字だけ（airline_conditions.text_ok・db/contrib.sql の pv_contrib_notes）
--   spec        kind ごとの付帯情報（数値の刻み、明細行の語彙）。
--               range_low は、対になる額（低いほう・高いほう）の低いほうの id。高いほうの質問だけが持つ
--               （読むのは db/airline-conditions.sql の pv_condition_range_other）
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
  deep text,
  other_text boolean not null default false,
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
-- 戻ってきた会員に聞く順（2026-10-30・pv-conditions.mjs の ASK）。null ＝ その板では聞かない。
--   読むのは db/ask-own-airline.sql の pv_ask_next だけ。
alter table public.pv_condition_questions add column if not exists ask_rank smallint;
-- 続きの質問（2026-11-14）。null ＝ ふつうの質問
alter table public.pv_condition_questions add column if not exists deep text;
-- 「その他」の欄（2026-11-16）。false ＝ その他の欄を出さない
alter table public.pv_condition_questions add column if not exists other_text boolean not null default false;

-- 検品の一部は DB 側にも置く。SSOT を通さず手で1行入れられたときに効く。
-- ★毎回 drop してから付け直す。「無ければ作る」だと、条件を変えて流し直したときに
--   古い定義が残ったまま黙って通ってしまう（micro の条件は実際に一度変わっている）。
alter table public.pv_condition_questions drop constraint if exists pv_cq_tier_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_micro_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_parent_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_choice_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_topic_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_topic_only_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_deep_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_other_text_ck;
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
-- deep＝続きの質問。親が要り、選ぶ形で、1問枠の印・話題の入口だけの印とは同時に立たない
--   ★選ぶ形は1つ選ぶ・複数選ぶのどちらも通す（2026-11-16 に複数選ぶへ変えた）。この制約は下の upsert より**先に**
--     付け直すので、kind = 'multi' だけにすると、まだ 'choice' のままの今の行で付け直しが落ちる（kind を変えるのは upsert）。
--     「続きは複数選ぶ＋その他の欄」の決まりそのものは gen-conditions.mjs が止める。
alter table public.pv_condition_questions
  add constraint pv_cq_deep_ck check (deep is null or (deep in ('partial', 'split')
    and parent is not null and kind in ('choice', 'multi') and not micro and boost = 0 and not topic_only));
-- other_text＝「その他」の欄。選ぶ形で、選択肢に 'other' が在る質問だけ
alter table public.pv_condition_questions
  add constraint pv_cq_other_text_ck check (not other_text or (kind in ('choice', 'multi')
    and 'other' = any(choice_codes)));

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
   topic, topic_only, deep, other_text, ask_rank,
   choice_codes, num_min, num_max, has_currency, has_note, spec, label_ja, label_en) values
  ('days_off_request', 1, 'roster', 'choice', 'A', true, 100, 3, false, null, null, null, false, null, false, 1, array['yes', 'partial', 'no', 'unknown'], null, null, false, false, '{}', '希望する休日の日付を指定できますか？', 'Can pilots request specific days off?'),
  ('days_off_request_limit', 1, 'roster', 'num', 'A', false, 110, 0, false, 'days_off_request', array['yes', 'partial'], null, false, null, false, null, null, 0, 31, false, false, '{"step":1}', '月に何日まで希望できますか？', 'How many days per month can be requested?'),
  ('days_off_request_partial', 1, 'roster', 'multi', 'A', false, 111, 0, false, 'days_off_request', array['partial'], null, false, 'partial', true, 2, array['cap', 'seniority', 'peak', 'not_guaranteed', 'no_consecutive', 'early_deadline', 'other'], null, null, false, false, '{}', '希望休は、どんな形で一部だけ指定できますか？', 'How are day-off requests limited?'),
  ('days_off_request_split', 1, 'roster', 'multi', 'A', false, 112, 0, false, 'days_off_request', array['yes', 'partial', 'no'], null, false, 'split', true, 3, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「希望休の指定」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Day-off requests” vary by?'),
  ('schedule_bidding', 1, 'roster', 'choice', 'A', true, 120, 2, false, null, null, null, false, null, false, 4, array['yes', 'partial', 'no', 'unknown'], null, null, false, false, '{}', '勤務スケジュールの希望を提出できますか？', 'Can pilots submit preferences for their roster?'),
  ('bidding_scope', 1, 'roster', 'multi', 'A', false, 130, 0, false, 'schedule_bidding', array['yes', 'partial'], null, false, null, false, null, array['days_off', 'consecutive', 'routes', 'layovers', 'avoid_early', 'avoid_night', 'turnaround', 'block', 'reserve', 'other'], null, null, false, false, '{}', 'どの希望を出せますか？', 'What can be bid for?'),
  ('schedule_bidding_partial', 1, 'roster', 'multi', 'A', false, 131, 0, false, 'schedule_bidding', array['partial'], null, false, 'partial', true, 5, array['few_items', 'few_bids', 'seniority', 'not_guaranteed', 'some_bases', 'some_periods', 'other'], null, null, false, false, '{}', '勤務スケジュールの希望は、どんな形で一部だけ出せますか？', 'How is roster bidding limited?'),
  ('schedule_bidding_split', 1, 'roster', 'multi', 'A', false, 132, 0, false, 'schedule_bidding', array['yes', 'partial', 'no'], null, false, 'split', true, 6, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「勤務の希望提出」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Roster bidding” vary by?'),
  ('seniority_effect', 1, 'roster', 'choice', 'C', false, 140, 0, true, null, null, null, false, null, false, null, array['strong', 'some', 'little', 'unknown'], null, null, false, false, '{}', '休日や路線の希望は、先任順位（Seniority）で通りやすさが変わりますか？', 'Does seniority change how likely your day-off or route bids are granted?'),
  ('reserve_duty', 1, 'roster', 'choice', 'A', true, 150, 0, false, null, null, null, false, null, false, 7, array['yes', 'some_pilots', 'no', 'unknown'], null, null, false, false, '{}', 'Reserve / Standby 勤務はありますか？', 'Is there reserve / standby duty?'),
  ('reserve_location', 1, 'roster', 'choice', 'A', true, 160, 0, false, 'reserve_duty', array['yes', 'some_pilots'], null, false, null, false, 10, array['home', 'airport', 'both', 'unknown'], null, null, false, false, '{}', 'Reserve は自宅待機ですか、空港待機ですか？', 'Is reserve served at home or at the airport?'),
  ('reserve_days', 1, 'roster', 'num', 'A', false, 170, 0, false, 'reserve_duty', array['yes', 'some_pilots'], null, false, null, false, null, null, 0, 31, false, false, '{"step":1}', '月に平均何日くらいですか？', 'How many days per month on average?'),
  ('reserve_duty_who', 1, 'roster', 'multi', 'A', false, 171, 0, false, 'reserve_duty', array['some_pilots'], null, false, 'partial', true, 8, array['junior', 'rank', 'fleet', 'base', 'contract', 'new_joiners', 'volunteers', 'other'], null, null, false, false, '{}', 'Reserve / Standby 勤務があるのは、どのパイロットですか？', 'Which pilots do reserve / standby duty?'),
  ('reserve_duty_split', 1, 'roster', 'multi', 'A', false, 172, 0, false, 'reserve_duty', array['yes', 'some_pilots', 'no'], null, false, 'split', true, 9, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「Reserve 勤務」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Reserve duty” vary by?'),
  ('roster_lead_days', 1, 'roster', 'num', 'A', false, 180, 0, false, null, null, null, false, null, false, 11, null, 1, 90, false, false, '{"step":1}', '翌月の勤務予定は、何日前に確定しますか？', 'How far in advance is next month’s roster published?'),
  ('roster_changes', 1, 'roster', 'choice', 'A', true, 190, 0, false, null, null, null, false, null, false, 12, array['rare', 'sometimes', 'often', 'unknown'], null, null, false, false, '{}', '確定後の勤務変更は多いですか？', 'How often does the published roster change afterwards?'),
  ('roster_changes_split', 1, 'roster', 'multi', 'A', false, 191, 0, false, 'roster_changes', array['rare', 'sometimes', 'often'], null, false, 'split', true, 13, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「確定後の勤務変更」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Roster changes” vary by?'),
  ('external_hiring', 1, 'career', 'choice', 'A', true, 200, 1, false, null, null, null, false, null, false, null, array['yes', 'conditional', 'rare', 'no', 'unknown'], null, null, false, false, '{}', '他社からパイロットとして中途入社できますか？', 'Can pilots join from another airline?'),
  ('external_experience_credit', 1, 'career', 'choice', 'A', true, 210, 0, false, 'external_hiring', array['yes', 'conditional'], null, false, null, false, null, array['major', 'partial', 'minimal', 'case_by_case', 'unknown'], null, null, false, false, '{}', '他社でのパイロット経験は、入社時の待遇（Rank・給与ステップ）に考慮されますか？', 'Does prior airline experience count towards your starting rank and pay step?'),
  ('external_seniority_start', 1, 'career', 'choice', 'A', true, 220, 0, false, 'external_hiring', array['yes', 'conditional'], null, false, null, false, null, array['from_join', 'credited', 'case_by_case', 'unknown'], null, null, false, false, '{}', '中途入社した場合、社内の先任順位（Seniority）はどこから始まりますか？', 'Where does your seniority start if you join from another airline?'),
  ('external_hiring_conditions', 1, 'career', 'multi', 'A', false, 221, 0, false, 'external_hiring', array['conditional'], null, false, 'partial', true, null, array['type_rating', 'hours', 'command', 'license', 'timing', 'age', 'english', 'other'], null, null, false, false, '{}', '他社からの中途入社には、どんな条件がありますか？', 'What are the conditions for joining from another airline?'),
  ('external_hiring_split', 1, 'career', 'multi', 'A', false, 222, 0, false, 'external_hiring', array['yes', 'conditional', 'rare', 'no'], null, false, 'split', true, null, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「他社からの中途採用」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Direct entry” vary by?'),
  ('training_bond', 1, 'career', 'choice', 'A', true, 230, 0, false, null, null, null, false, null, false, null, array['yes', 'conditional', 'no', 'unknown'], null, null, false, false, '{}', '入社時の訓練費用に、Bond・返済義務がありますか？', 'Is there a training bond or repayment obligation on joining?'),
  ('training_bond_years', 1, 'career', 'num', 'A', false, 240, 0, false, 'training_bond', array['yes', 'conditional'], null, false, null, false, null, null, 0.5, 15, false, false, '{"step":0.5}', '拘束期間は何年ですか？', 'How many years does the bond run for?'),
  ('training_bond_amount', 1, 'career', 'num', 'A', false, 250, 0, false, 'training_bond', array['yes', 'conditional'], null, false, null, false, null, null, 0, 100000000, true, false, '{"step":1}', '金額はいくらですか？', 'How much is the bond?'),
  ('training_bond_conditions', 1, 'career', 'multi', 'A', false, 251, 0, false, 'training_bond', array['conditional'], null, false, 'partial', true, null, array['type_rating', 'cadet', 'contract', 'upgrade', 'initial', 'other'], null, null, false, false, '{}', '訓練費の Bond は、どんな場合に付きますか？', 'When does a training bond apply?'),
  ('training_bond_split', 1, 'career', 'multi', 'A', false, 252, 0, false, 'training_bond', array['yes', 'conditional', 'no'], null, false, 'split', true, null, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「訓練費の Bond」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Training bond” vary by?'),
  ('upgrade_years', 1, 'career', 'num', 'A', false, 260, 0, false, null, null, 'upgrade', false, null, false, null, null, 0.5, 30, false, false, '{"step":0.5}', '副操縦士から機長まで、今どれくらいかかりますか？', 'How long does it currently take to upgrade from First Officer to Captain?'),
  ('upgrade_order', 1, 'career', 'choice', 'B', false, 270, 0, false, null, null, 'upgrade', true, null, false, null, array['seniority', 'seniority_selection', 'selection', 'vacancy_bid', 'unknown'], null, null, false, true, '{}', '機長への昇格の順番は、どう決まりますか？', 'How is the order of upgrade to Captain decided?'),
  ('upgrade_min_hours', 1, 'career', 'choice', 'B', false, 280, 0, false, null, null, 'upgrade', true, null, false, null, array['none', 'under_3000', 'h3000_4999', 'h5000_6999', 'h7000_plus', 'unknown'], null, null, false, false, '{}', '機長昇格に必要な総飛行時間の条件は、どれですか？', 'What is the minimum total flight time required for upgrade to Captain?'),
  ('upgrade_min_tenure', 1, 'career', 'choice', 'B', false, 290, 0, false, null, null, 'upgrade', true, null, false, null, array['none', 'under_3', 'y3_5', 'y6_9', 'y10_plus', 'unknown'], null, null, false, false, '{}', '機長昇格に必要な在籍年数の条件は、どれですか？', 'What is the minimum time with the company required for upgrade to Captain?'),
  ('external_hiring_types', 1, 'career', 'multi', 'B', false, 300, 0, false, 'external_hiring', array['yes', 'conditional'], null, false, null, false, null, array['fo', 'captain', 'dec', 'type_rated', 'other'], null, null, false, false, '{}', 'どの形の採用がありますか？', 'What forms of external hiring exist?'),
  ('cadet_program', 1, 'career', 'choice', 'B', true, 310, 0, false, null, null, null, false, null, false, null, array['regular', 'irregular', 'suspended', 'no', 'unknown'], null, null, false, false, '{}', '自社養成パイロット制度はありますか？', 'Is there a cadet program?'),
  ('cadet_program_split', 1, 'career', 'multi', 'B', false, 311, 0, false, 'cadet_program', array['regular', 'irregular', 'suspended', 'no'], null, false, 'split', true, null, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「自社養成」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Cadet program” vary by?'),
  ('fo_development', 1, 'career', 'choice', 'B', true, 320, 0, false, null, null, null, false, null, false, null, array['formal', 'informal', 'none', 'unknown'], null, null, false, false, '{}', '副操縦士の成長を継続的に支援する制度がありますか？', 'Is there ongoing support for First Officer development?'),
  ('fo_development_split', 1, 'career', 'multi', 'B', false, 321, 0, false, 'fo_development', array['formal', 'informal', 'none'], null, false, 'split', true, null, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「副操縦士の育成支援」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “FO development” vary by?'),
  ('annual_leave_days', 1, 'time_off', 'num', 'A', false, 400, 0, false, null, null, null, false, null, false, 19, null, 0, 60, false, false, '{"step":1}', '年間の有給休暇は何日ですか？', 'How many days of annual paid leave are there?'),
  ('sick_leave', 1, 'time_off', 'choice', 'A', true, 410, 0, false, null, null, null, false, null, false, 20, array['days', 'unlimited', 'varies', 'none', 'unknown'], null, null, false, false, '{}', '病気休暇（Sick Leave）はどれくらい使えますか？', 'How much sick leave is available?'),
  ('sick_leave_days', 1, 'time_off', 'num', 'A', false, 420, 0, false, 'sick_leave', array['days'], null, false, null, false, null, null, 0, 365, false, false, '{"step":1}', '年間で何日ですか？', 'How many days per year?'),
  ('sick_leave_split', 1, 'time_off', 'multi', 'A', false, 421, 0, false, 'sick_leave', array['days', 'unlimited', 'varies', 'none'], null, false, 'split', true, 21, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「病気休暇」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Sick leave” vary by?'),
  ('peer_support', 1, 'benefits', 'choice', 'B', true, 490, 0, false, null, null, null, false, null, false, null, array['internal', 'external', 'both', 'no', 'unknown'], null, null, false, false, '{}', 'パイロット向けの Peer Support 制度がありますか？', 'Is there a Peer Support program for pilots?'),
  ('peer_support_split', 1, 'benefits', 'multi', 'B', false, 491, 0, false, 'peer_support', array['internal', 'external', 'both', 'no'], null, false, 'split', true, null, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「Peer Support」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Peer support” vary by?'),
  ('landing_pay', 1, 'benefits', 'choice', 'C', true, 500, 0, false, null, null, null, false, null, false, 22, array['fixed', 'variable', 'no', 'unknown'], null, null, false, false, '{}', '着陸回数に応じた手当はありますか？', 'Is there a landing allowance?'),
  ('landing_pay_amount', 1, 'benefits', 'num', 'C', false, 510, 0, false, 'landing_pay', array['fixed'], null, false, null, false, 24, null, 1, 10000000, true, false, '{"step":0.01}', '着陸手当はいくらですか？', 'How much is the landing allowance?'),
  ('landing_pay_unit', 1, 'benefits', 'choice', 'C', false, 520, 0, false, 'landing_pay', array['fixed'], null, false, null, false, null, array['per_landing', 'per_leg', 'unknown'], null, null, false, false, '{}', '着陸手当は何を1回と数えますか？', 'Landing allowance: paid per landing or per sector?'),
  ('landing_pay_from', 1, 'benefits', 'num', 'C', false, 530, 0, false, 'landing_pay', array['variable'], null, false, null, false, null, null, 1, 10000000, true, false, '{"step":0.01}', '着陸手当の低いほうの額', 'Landing allowance: lowest amount'),
  ('landing_pay_to', 1, 'benefits', 'num', 'C', false, 540, 0, false, 'landing_pay', array['variable'], null, false, null, false, null, null, 1, 10000000, true, false, '{"step":0.01,"range_low":"landing_pay_from"}', '着陸手当の高いほうの額', 'Landing allowance: highest amount'),
  ('landing_pay_varies_by', 1, 'benefits', 'multi', 'C', false, 550, 0, false, 'landing_pay', array['variable'], null, false, null, true, null, array['aircraft', 'airport', 'rank', 'count', 'time_of_day', 'seniority', 'other'], null, null, false, false, '{}', '着陸手当の額は何で変わりますか？', 'What does the landing allowance vary by?'),
  ('landing_pay_split', 1, 'benefits', 'multi', 'C', false, 551, 0, false, 'landing_pay', array['fixed', 'variable', 'no'], null, false, 'split', true, 23, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「着陸手当」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Landing pay” vary by?'),
  ('ground_duty_pay', 1, 'benefits', 'choice', 'C', false, 560, 0, false, null, null, null, false, null, false, 29, array['yes', 'case_by_case', 'no', 'unknown'], null, null, false, true, '{}', '乗務以外の会社業務に、手当や勤務時間上の補償がありますか？', 'Is non-flying company work compensated, in pay or in duty credit?'),
  ('ground_duty_pay_split', 1, 'benefits', 'multi', 'C', false, 561, 0, false, 'ground_duty_pay', array['yes', 'case_by_case', 'no'], null, false, 'split', true, 30, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「地上業務の補償」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Ground duty pay” vary by?'),
  ('staff_travel', 1, 'benefits', 'choice', 'A', true, 570, 0, false, null, null, 'staff_travel', false, null, false, 31, array['yes', 'some_pilots', 'no', 'unknown'], null, null, false, false, '{}', '自社便に割引や無料で乗れる社員向けの航空券制度がありますか？', 'Is there a staff travel scheme — free or reduced-fare tickets on your own airline?'),
  ('staff_travel_booking', 1, 'benefits', 'choice', 'B', true, 580, 0, false, 'staff_travel', array['yes', 'some_pilots'], 'staff_travel', false, null, false, 34, array['standby', 'both', 'confirmed', 'unknown'], null, null, false, false, '{}', 'その席は空席待ちですか、確保できますか？', 'Are those seats standby, or can they be confirmed?'),
  ('staff_travel_cabin', 1, 'benefits', 'choice', 'B', true, 590, 0, false, 'staff_travel', array['yes', 'some_pilots'], 'staff_travel', false, null, false, 36, array['by_rank', 'if_available', 'economy', 'unknown'], null, null, false, false, '{}', 'ビジネスクラスなど上位クラスに乗れますか？', 'Can you travel in a premium cabin such as business class?'),
  ('staff_travel_family', 1, 'benefits', 'choice', 'B', true, 600, 0, false, 'staff_travel', array['yes', 'some_pilots'], 'staff_travel', false, null, false, 35, array['self', 'partner', 'family', 'unknown'], null, null, false, false, '{}', '家族も使えますか？', 'Can family members use it?'),
  ('staff_travel_standby_trips', 1, 'benefits', 'choice', 'B', true, 610, 0, false, 'staff_travel_booking', array['standby', 'both'], 'staff_travel', false, null, false, null, array['unlimited', 'limit_13_plus', 'limit_5_12', 'limit_1_4', 'unknown'], null, null, false, false, '{}', '空席待ちの社員向け航空券は、1年に何回まで使えますか？', 'How many times a year can you use standby staff tickets?'),
  ('staff_travel_standby_cost', 1, 'benefits', 'choice', 'B', true, 620, 0, false, 'staff_travel_booking', array['standby', 'both'], 'staff_travel', false, null, false, null, array['free', 'taxes_only', 'reduced_fare', 'unknown'], null, null, false, false, '{}', '空席待ちの社員向け航空券で乗るとき、本人が払うのはどれに近いですか？', 'What do you pay yourself when you fly on a standby staff ticket?'),
  ('staff_travel_standby_family', 1, 'benefits', 'multi', 'B', false, 630, 0, false, 'staff_travel_booking', array['standby', 'both'], 'staff_travel', false, null, false, null, array['self', 'partner', 'children', 'parents', 'siblings', 'nominee', 'other'], null, null, false, false, '{}', '空席待ちの社員向け航空券は、誰が使えますか？', 'Who can travel on standby staff tickets?'),
  ('staff_travel_confirmed_trips', 1, 'benefits', 'choice', 'B', true, 640, 0, false, 'staff_travel_booking', array['both', 'confirmed'], 'staff_travel', false, null, false, null, array['unlimited', 'limit_5_plus', 'limit_3_4', 'limit_2', 'limit_1', 'unknown'], null, null, false, false, '{}', '座席を確保できる社員向け航空券は、1年に何回まで使えますか？', 'How many times a year can you use confirmed-seat staff tickets?'),
  ('staff_travel_confirmed_cost', 1, 'benefits', 'choice', 'B', true, 650, 0, false, 'staff_travel_booking', array['both', 'confirmed'], 'staff_travel', false, null, false, null, array['free', 'taxes_only', 'reduced_fare', 'unknown'], null, null, false, false, '{}', '座席を確保できる社員向け航空券で乗るとき、本人が払うのはどれに近いですか？', 'What do you pay yourself when you fly on a confirmed-seat staff ticket?'),
  ('staff_travel_confirmed_family', 1, 'benefits', 'multi', 'B', false, 660, 0, false, 'staff_travel_booking', array['both', 'confirmed'], 'staff_travel', false, null, false, null, array['self', 'partner', 'children', 'parents', 'siblings', 'nominee', 'other'], null, null, false, false, '{}', '座席を確保できる社員向け航空券は、誰が使えますか？', 'Who can travel on confirmed-seat staff tickets?'),
  ('staff_travel_who', 1, 'benefits', 'multi', 'A', false, 661, 0, false, 'staff_travel', array['some_pilots'], 'staff_travel', false, 'partial', true, 32, array['contract', 'service', 'base', 'rank', 'probation', 'other'], null, null, false, false, '{}', '社員航空券を使えるのは、どのパイロットですか？', 'Which pilots are eligible for staff travel?'),
  ('staff_travel_split', 1, 'benefits', 'multi', 'A', false, 662, 0, false, 'staff_travel', array['yes', 'some_pilots', 'no'], 'staff_travel', false, 'split', true, 33, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「社員航空券」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Staff travel” vary by?'),
  ('commuting_transport', 1, 'benefits', 'choice', 'B', true, 670, 0, false, null, null, 'taxi', false, null, false, 14, array['always', 'conditional', 'no', 'unknown'], null, null, false, false, '{}', '出社・帰宅の移動を、会社が用意または負担しますか？', 'Does the company provide or pay for your travel to and from work?'),
  ('commuting_transport_method', 1, 'benefits', 'multi', 'B', false, 680, 0, false, 'commuting_transport', array['always', 'conditional'], 'taxi', false, null, false, 16, array['company_taxi', 'reimburse', 'crew_bus', 'hotel', 'other'], null, null, false, false, '{}', 'どの形で提供されますか？', 'How is it provided?'),
  ('commuting_taxi_when', 1, 'benefits', 'multi', 'B', false, 690, 0, false, 'commuting_transport_method', array['company_taxi', 'reimburse'], 'taxi', false, null, false, null, array['any_time', 'no_public_transport', 'outside_set_hours', 'standby_callout', 'disruption', 'other'], null, null, false, false, '{}', 'タクシーでの出社・帰宅は、どんなときに会社の手配や精算で使えますか？', 'When can you take a taxi to or from work, arranged or reimbursed by the company?'),
  ('commuting_taxi_where', 1, 'benefits', 'choice', 'B', true, 700, 0, false, 'commuting_transport_method', array['company_taxi', 'reimburse'], 'taxi', false, null, false, 17, array['door_to_door', 'within_area', 'to_set_point', 'unknown'], null, null, false, false, '{}', 'タクシーでの出社・帰宅は、どこまで会社の手配や精算で使えますか？', 'How far does a company-arranged or reimbursed taxi to or from work reach?'),
  ('commuting_taxi_cost', 1, 'benefits', 'choice', 'B', true, 710, 0, false, 'commuting_transport_method', array['company_taxi', 'reimburse'], 'taxi', false, null, false, 18, array['company_full', 'partial', 'self_full', 'unknown'], null, null, false, false, '{}', 'タクシーでの出社・帰宅の費用は、誰が負担しますか？', 'Who pays for a taxi to or from work?'),
  ('commuting_taxi_cap', 1, 'benefits', 'choice', 'B', false, 720, 0, false, 'commuting_transport_method', array['company_taxi', 'reimburse'], 'taxi', true, null, false, null, array['no_cap', 'per_ride', 'per_month', 'by_zone', 'unknown'], null, null, false, true, '{}', '通勤のタクシー代に、上限はありますか？', 'Is there a cap on what the company pays for a taxi to or from work?'),
  ('commuting_bus_when', 1, 'benefits', 'multi', 'B', false, 730, 0, false, 'commuting_transport_method', array['crew_bus'], 'taxi', false, null, false, null, array['any_time', 'no_public_transport', 'outside_set_hours', 'standby_callout', 'disruption', 'other'], null, null, false, false, '{}', 'クルーバス（送迎バス）は、どんなときに出社・帰宅で使えますか？', 'When can you use the crew bus (company bus) to get to or from work?'),
  ('commuting_bus_cost', 1, 'benefits', 'choice', 'B', true, 740, 0, false, 'commuting_transport_method', array['crew_bus'], 'taxi', false, null, false, null, array['company_full', 'partial', 'self_full', 'unknown'], null, null, false, false, '{}', 'クルーバス（送迎バス）の費用は、誰が負担しますか？', 'Who pays for the crew bus (company bus) to or from work?'),
  ('commuting_transport_split', 1, 'benefits', 'multi', 'B', false, 741, 0, false, 'commuting_transport', array['always', 'conditional', 'no'], 'taxi', false, 'split', true, 15, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「出社・帰宅の移動」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Transport to work” vary by?'),
  ('per_diem', 1, 'benefits', 'choice', 'B', false, 750, 0, false, null, null, null, false, null, false, 25, array['both', 'intl_only', 'dom_only', 'no', 'unknown'], null, null, false, false, '{}', '乗務の日当（パーディアム）は出ますか？', 'Is per diem paid on trips?'),
  ('per_diem_domestic', 1, 'benefits', 'num', 'B', false, 760, 0, false, 'per_diem', array['both', 'dom_only'], null, false, null, false, 27, null, 1, 10000000, true, false, '{"step":0.01}', '国内線の日当は1日いくらですか？', 'Domestic per diem: how much per day?'),
  ('per_diem_international', 1, 'benefits', 'num', 'B', false, 770, 0, false, 'per_diem', array['both', 'intl_only'], null, false, null, false, 28, null, 1, 10000000, true, false, '{"step":0.01}', '国際線の日当は1日いくらですか？', 'International per diem: how much per day?'),
  ('per_diem_split', 1, 'benefits', 'multi', 'B', false, 771, 0, false, 'per_diem', array['both', 'intl_only', 'dom_only', 'no'], null, false, 'split', true, 26, array['rank', 'fleet', 'base', 'seniority', 'tenure', 'contract', 'route', 'changed', 'no_rule', 'other'], null, null, false, false, '{}', '「日当（パーディアム）」は、同じ会社の中で何によって違いますか？', 'Within the same airline, what does “Per diem” vary by?')
on conflict (id) do update set
  version = excluded.version, section = excluded.section, kind = excluded.kind,
  tier = excluded.tier, micro = excluded.micro, priority = excluded.priority,
  boost = excluded.boost, is_opinion = excluded.is_opinion,
  parent = excluded.parent, parent_when = excluded.parent_when,
  topic = excluded.topic, topic_only = excluded.topic_only, deep = excluded.deep, other_text = excluded.other_text,
  ask_rank = excluded.ask_rank,
  choice_codes = excluded.choice_codes, num_min = excluded.num_min, num_max = excluded.num_max,
  has_currency = excluded.has_currency, has_note = excluded.has_note, spec = excluded.spec,
  label_ja = excluded.label_ja, label_en = excluded.label_en, active = true;

update public.pv_condition_sections  set active = false where code not in ('roster', 'career', 'time_off', 'benefits');
update public.pv_condition_questions set active = false where id not in ('days_off_request', 'days_off_request_limit', 'days_off_request_partial', 'days_off_request_split', 'schedule_bidding', 'bidding_scope', 'schedule_bidding_partial', 'schedule_bidding_split', 'seniority_effect', 'reserve_duty', 'reserve_location', 'reserve_days', 'reserve_duty_who', 'reserve_duty_split', 'roster_lead_days', 'roster_changes', 'roster_changes_split', 'external_hiring', 'external_experience_credit', 'external_seniority_start', 'external_hiring_conditions', 'external_hiring_split', 'training_bond', 'training_bond_years', 'training_bond_amount', 'training_bond_conditions', 'training_bond_split', 'upgrade_years', 'upgrade_order', 'upgrade_min_hours', 'upgrade_min_tenure', 'external_hiring_types', 'cadet_program', 'cadet_program_split', 'fo_development', 'fo_development_split', 'annual_leave_days', 'sick_leave', 'sick_leave_days', 'sick_leave_split', 'peer_support', 'peer_support_split', 'landing_pay', 'landing_pay_amount', 'landing_pay_unit', 'landing_pay_from', 'landing_pay_to', 'landing_pay_varies_by', 'landing_pay_split', 'ground_duty_pay', 'ground_duty_pay_split', 'staff_travel', 'staff_travel_booking', 'staff_travel_cabin', 'staff_travel_family', 'staff_travel_standby_trips', 'staff_travel_standby_cost', 'staff_travel_standby_family', 'staff_travel_confirmed_trips', 'staff_travel_confirmed_cost', 'staff_travel_confirmed_family', 'staff_travel_who', 'staff_travel_split', 'commuting_transport', 'commuting_transport_method', 'commuting_taxi_when', 'commuting_taxi_where', 'commuting_taxi_cost', 'commuting_taxi_cap', 'commuting_bus_when', 'commuting_bus_cost', 'commuting_transport_split', 'per_diem', 'per_diem_domestic', 'per_diem_international', 'per_diem_split');

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
  ('recurring_limit', 3),
  ('profile_limit', 1),
  ('modal_delay_ms', 700),
  ('ask_interval_hours', 48),
  ('ask_limit', 3)
on conflict (key) do update set value = excluded.value;

-- SSOT から消えた設定は残さない（古い key を読み続ける関数が出ないように）
delete from public.pv_condition_settings where key not in ('answer_reask_days', 'unknown_reask_days', 'skip_reask_days', 'initial_limit', 'recurring_limit', 'profile_limit', 'modal_delay_ms', 'ask_interval_hours', 'ask_limit');

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
    'text_max', 300, 'other_max', 100, 'lines_max', 10, 'line_name_max', 40,
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

-- 検算：節4 / 質問76（一覧に出る質問51 ＋ 話題の入口からだけ出る質問4 ＋ 続き21）/ 提出直後に出せる質問26
--        Tier A34 / B32 / C10
select
  (select count(*) from public.pv_condition_sections  where active)                as 節,
  (select count(*) from public.pv_condition_questions where active)                as 質問,
  (select count(*) from public.pv_condition_questions where active and not topic_only and deep is null) as 一覧に出る質問,
  (select count(*) from public.pv_condition_questions where active and topic_only)     as 話題の入口からだけ出る質問,
  (select count(*) from public.pv_condition_questions where active and deep is not null) as 続きの質問,
  (select count(*) from public.pv_condition_questions where active and other_text) as その他の欄のある質問,
  (select count(*) from public.pv_condition_questions where active and micro)      as 直後に出せる質問,
  (select count(*) from public.pv_condition_questions where active and tier = 'A') as tier_a,
  (select count(*) from public.pv_condition_questions where active and boost > 0) as 最初の3問,
  (select count(*) from public.pv_condition_questions where active and ask_rank is not null) as 戻った人に聞く質問,
  (select count(*) from public.pv_condition_settings)                             as 設定;
