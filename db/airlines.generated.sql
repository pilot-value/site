-- ════════════════════════════════════════════════════════════════
-- db/airlines.generated.sql — ★自動生成。手で編集しない。
--   生成元: salary-data.mjs（SSOT）
--   再生成: node gen-airline-codes.mjs
--
-- pay_reports.airline / reviews の会社コードを DB 側で検証するためのマスタ。
-- 何度流しても安全（upsert）。SSOT から消えた社は無効化するだけで消さない
-- （過去の投稿が外部キーで残っているため）。
-- ════════════════════════════════════════════════════════════════

create table if not exists public.pv_airlines (
  code    text primary key,
  name_ja text not null,
  name_en text not null,
  region  text not null,
  active  boolean not null default true
);

insert into public.pv_airlines (code, name_ja, name_en, region) values
  ('ana', '全日本空輸（ANA）', 'All Nippon Airways (ANA)', 'japan'),
  ('jal', '日本航空（JAL）', 'Japan Airlines (JAL)', 'japan'),
  ('zipair', 'ZIPAIR Tokyo', 'ZIPAIR Tokyo', 'japan'),
  ('jetstar-japan', 'ジェットスター・ジャパン', 'Jetstar Japan', 'japan'),
  ('peach', 'Peach Aviation', 'Peach Aviation', 'japan'),
  ('solaseed', 'ソラシドエア', 'Solaseed Air', 'japan'),
  ('spring-japan', 'スプリング・ジャパン', 'Spring Japan', 'japan'),
  ('airdo', 'AIRDO', 'AIRDO (AIR DO)', 'japan'),
  ('starflyer', 'スターフライヤー', 'StarFlyer (Star Flyer)', 'japan'),
  ('skymark', 'スカイマーク', 'Skymark Airlines', 'japan'),
  ('fda', 'フジドリームエアラインズ（FDA）', 'Fuji Dream Airlines (FDA)', 'japan'),
  ('emirates', 'エミレーツ', 'Emirates', 'mideast'),
  ('qantas', 'カンタス航空', 'Qantas', 'oceania'),
  ('cathay-pacific', 'キャセイパシフィック', 'Cathay Pacific', 'asia'),
  ('singapore-airlines', 'シンガポール航空', 'Singapore Airlines', 'asia'),
  ('etihad', 'エティハド航空', 'Etihad Airways', 'mideast'),
  ('qatar-airways', 'カタール航空', 'Qatar Airways', 'mideast'),
  ('korean-air', '大韓航空', 'Korean Air', 'asia'),
  ('asiana', 'アシアナ航空', 'Asiana Airlines', 'asia'),
  ('starlux', 'スターラックス', 'STARLUX Airlines', 'asia'),
  ('china-airlines', 'チャイナエアライン', 'China Airlines', 'asia'),
  ('thai-airways', 'タイ国際航空', 'Thai Airways International', 'asia'),
  ('eva-air', 'エバー航空', 'EVA Air', 'asia'),
  ('united', 'ユナイテッド航空', 'United Airlines', 'us'),
  ('delta', 'デルタ航空', 'Delta Air Lines', 'us'),
  ('american', 'アメリカン航空', 'American Airlines', 'us'),
  ('southwest', 'サウスウエスト航空', 'Southwest Airlines', 'us'),
  ('klm', 'KLMオランダ航空', 'KLM Royal Dutch Airlines', 'europe'),
  ('air-france', 'エールフランス', 'Air France', 'europe'),
  ('lufthansa', 'ルフトハンザ', 'Lufthansa', 'europe'),
  ('air-canada', 'エア・カナダ', 'Air Canada', 'us'),
  ('british-airways', 'ブリティッシュ・エアウェイズ', 'British Airways', 'europe'),
  ('airjapan', 'AirJapan', 'AirJapan', 'japan'),
  ('amx', '天草エアライン', 'Amakusa Airlines (AMX)', 'japan'),
  ('ana-wings', 'ANAウイングス', 'ANA Wings', 'japan'),
  ('daiichi-air', '第一航空', 'Daiichi Aviation (Daiichi Air)', 'japan'),
  ('hac', '北海道エアシステム', 'Hokkaido Air System (HAC)', 'japan'),
  ('ibex', 'IBEXエアラインズ', 'IBEX Airlines', 'japan'),
  ('j-air', 'ジェイエア', 'J-Air (J-AIR)', 'japan'),
  ('jac', '日本エアコミューター', 'Japan Air Commuter (JAC)', 'japan'),
  ('jta', '日本トランスオーシャン航空', 'Japan Transocean Air (JTA)', 'japan'),
  ('orc', 'オリエンタルエアブリッジ', 'Oriental Air Bridge (ORC)', 'japan'),
  ('rac', '琉球エアーコミューター', 'Ryukyu Air Commuter (RAC)', 'japan'),
  ('shin-central', '新中央航空', 'Shin Chuo Airlines (Shin Nichi Aviation)', 'japan'),
  ('shin-nihon', '新日本航空', 'Shin Nihon Airlines', 'japan'),
  ('toho-air', '東邦航空', 'Toho Air Service', 'japan'),
  ('toki-air', 'トキエア', 'Toki Air', 'japan'),
  ('air-china', '中国国際航空', 'Air China', 'asia'),
  ('china-eastern', '中国東方航空', 'China Eastern Airlines', 'asia'),
  ('china-southern', '中国南方航空', 'China Southern Airlines', 'asia'),
  ('hainan-airlines', '海南航空', 'Hainan Airlines', 'asia'),
  ('airx-charter', 'エアX・チャーター', 'AirX Charter Ltd', 'europe'),
  ('eagle-jet', 'イーグルジェット・インターナショナル', 'Eagle Jet International, Inc.', 'europe'),
  ('root-aviation', 'ルート・アビエーション', 'Root Aviation', 'asia'),
  ('solairus', 'ソレイラス・アビエーション', 'Solairus Aviation', 'us'),
  ('air-india', 'エア・インディア', 'Air India', 'asia'),
  ('airasia', 'エアアジア', 'AirAsia Group', 'asia'),
  ('bamboo-airways', 'バンブー・エアウェイズ', 'Bamboo Airways', 'asia'),
  ('batik-air', 'バティック・エア', 'Batik Air', 'asia'),
  ('garuda-indonesia', 'ガルーダ・インドネシア航空', 'Garuda Indonesia', 'asia'),
  ('hong-kong-express', '香港エクスプレス航空', 'HK Express', 'asia'),
  ('indigo', 'インディゴ航空', 'IndiGo', 'asia'),
  ('malaysia-airlines', 'マレーシア航空', 'Malaysia Airlines', 'asia'),
  ('philippine-airlines', 'フィリピン航空', 'Philippine Airlines', 'asia'),
  ('scoot', 'スクート', 'Scoot', 'asia'),
  ('vietjet', 'ベトジェット航空', 'VietJet Air', 'asia'),
  ('vietnam-airlines', 'ベトナム航空', 'Vietnam Airlines', 'asia'),
  ('egyptair', 'エジプト航空', 'EgyptAir', 'africa'),
  ('ethiopian-airlines', 'エチオピア航空', 'Ethiopian Airlines', 'africa'),
  ('gulf-air', 'ガルフ・エア', 'Gulf Air', 'mideast'),
  ('kenya-airways', 'ケニア航空', 'Kenya Airways', 'africa'),
  ('kuwait-airways', 'クウェート航空', 'Kuwait Airways', 'mideast'),
  ('oman-air', 'オマーン航空', 'Oman Air', 'mideast'),
  ('riyadh-air', 'リヤド航空', 'Riyadh Air', 'mideast'),
  ('royal-brunei', 'ロイヤル・ブルネイ航空', 'Royal Brunei Airlines', 'asia'),
  ('royal-jordanian', 'ロイヤル・ヨルダン航空', 'Royal Jordanian', 'mideast'),
  ('saudia', 'サウジア航空', 'Saudia', 'mideast'),
  ('south-african-airways', '南アフリカ航空', 'South African Airways (SAA)', 'africa'),
  ('turkish-airlines', 'ターキッシュ エアラインズ', 'Turkish Airlines', 'europe'),
  ('aegean', 'エーゲ航空', 'Aegean Airlines', 'europe'),
  ('aer-lingus', 'エア・リンガス', 'Aer Lingus', 'europe'),
  ('austrian', 'オーストリア航空', 'Austrian Airlines', 'europe'),
  ('easyjet', 'イージージェット', 'easyJet', 'europe'),
  ('eurowings', 'ユーロウイングス', 'Eurowings', 'europe'),
  ('finnair', 'フィンエアー', 'Finnair', 'europe'),
  ('iberia', 'イベリア航空', 'Iberia', 'europe'),
  ('icelandair', 'アイスランド航空', 'Icelandair', 'europe'),
  ('ita-airways', 'ITAエアウェイズ', 'ITA Airways', 'europe'),
  ('lot', 'LOTポーランド航空', 'LOT Polish Airlines', 'europe'),
  ('norwegian', 'ノルウェー・エアシャトル', 'Norwegian Air Shuttle (Norwegian)', 'europe'),
  ('ryanair', 'ライアンエアー', 'Ryanair', 'europe'),
  ('sas', 'スカンジナビア航空', 'SAS Scandinavian Airlines', 'europe'),
  ('swiss', 'スイス インターナショナル エアラインズ', 'Swiss International Air Lines (SWISS)', 'europe'),
  ('tap', 'TAPポルトガル航空', 'TAP Air Portugal', 'europe'),
  ('virgin-atlantic', 'ヴァージン・アトランティック航空', 'Virgin Atlantic', 'europe'),
  ('vueling', 'ブエリング航空', 'Vueling Airlines', 'europe'),
  ('wizz-air', 'ウィズ・エアー', 'Wizz Air UK', 'europe'),
  ('aeromexico', 'アエロメヒコ航空', 'Aeromexico', 'latam'),
  ('air-new-zealand', 'ニュージーランド航空', 'Air New Zealand', 'oceania'),
  ('alaska-airlines', 'アラスカ航空', 'Alaska Airlines', 'us'),
  ('allegiant', 'アレジアント航空', 'Allegiant Air', 'us'),
  ('avianca', 'アビアンカ航空', 'Avianca', 'latam'),
  ('breeze-airways', 'ブリーズ・エアウェイズ', 'Breeze Airways', 'us'),
  ('copa-airlines', 'コパ航空', 'Copa Airlines', 'latam'),
  ('fiji-airways', 'フィジー・エアウェイズ', 'Fiji Airways', 'oceania'),
  ('frontier', 'フロンティア航空', 'Frontier Airlines', 'us'),
  ('jetblue', 'ジェットブルー航空', 'JetBlue Airways', 'us'),
  ('jetstar', 'ジェットスター航空', 'Jetstar Airways (Jetstar)', 'oceania'),
  ('latam', 'LATAM航空', 'LATAM Airlines', 'latam'),
  ('porter', 'ポーター航空', 'Porter Airlines', 'us'),
  ('spirit', 'スピリット航空', 'Spirit Airlines', 'us'),
  ('westjet', 'ウェストジェット航空', 'WestJet Airlines', 'us'),
  ('other', 'その他（自由入力）', 'Other (free text)', 'other')
on conflict (code) do update
  set name_ja = excluded.name_ja,
      name_en = excluded.name_en,
      region  = excluded.region,
      active  = true;

-- SSOT から消えた社は残したまま active=false にする（投稿の参照先を壊さない）
update public.pv_airlines set active = false
 where code not in ('ana', 'jal', 'zipair', 'jetstar-japan', 'peach', 'solaseed', 'spring-japan', 'airdo', 'starflyer', 'skymark', 'fda', 'emirates', 'qantas', 'cathay-pacific', 'singapore-airlines', 'etihad', 'qatar-airways', 'korean-air', 'asiana', 'starlux', 'china-airlines', 'thai-airways', 'eva-air', 'united', 'delta', 'american', 'southwest', 'klm', 'air-france', 'lufthansa', 'air-canada', 'british-airways', 'airjapan', 'amx', 'ana-wings', 'daiichi-air', 'hac', 'ibex', 'j-air', 'jac', 'jta', 'orc', 'rac', 'shin-central', 'shin-nihon', 'toho-air', 'toki-air', 'air-china', 'china-eastern', 'china-southern', 'hainan-airlines', 'airx-charter', 'eagle-jet', 'root-aviation', 'solairus', 'air-india', 'airasia', 'bamboo-airways', 'batik-air', 'garuda-indonesia', 'hong-kong-express', 'indigo', 'malaysia-airlines', 'philippine-airlines', 'scoot', 'vietjet', 'vietnam-airlines', 'egyptair', 'ethiopian-airlines', 'gulf-air', 'kenya-airways', 'kuwait-airways', 'oman-air', 'riyadh-air', 'royal-brunei', 'royal-jordanian', 'saudia', 'south-african-airways', 'turkish-airlines', 'aegean', 'aer-lingus', 'austrian', 'easyjet', 'eurowings', 'finnair', 'iberia', 'icelandair', 'ita-airways', 'lot', 'norwegian', 'ryanair', 'sas', 'swiss', 'tap', 'virgin-atlantic', 'vueling', 'wizz-air', 'aeromexico', 'air-new-zealand', 'alaska-airlines', 'allegiant', 'avianca', 'breeze-airways', 'copa-airlines', 'fiji-airways', 'frontier', 'jetblue', 'jetstar', 'latam', 'porter', 'spirit', 'westjet', 'other');

alter table public.pv_airlines enable row level security;
drop policy if exists pv_airlines_read on public.pv_airlines;
create policy pv_airlines_read on public.pv_airlines for select to anon, authenticated using (true);

-- 検算：113 件（112社 ＋ other）
select count(*) filter (where active) as 有効, count(*) as 全件 from public.pv_airlines;
