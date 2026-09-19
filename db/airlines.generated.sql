-- ════════════════════════════════════════════════════════════════
-- db/airlines.generated.sql — ★自動生成。手で編集しない。
--   生成元: salary-data.mjs（年収がある社）＋ airline-ops.mjs（投稿先だけの社）
--   再生成: node gen-airline-codes.mjs
--
-- pay_reports.airline / reviews の会社コードを DB 側で検証するためのマスタ。
-- 何度流しても安全（upsert）。名簿から消えた社は無効化するだけで消さない
-- （過去の投稿が外部キーで残っているため）。
--
-- ★このファイルを貼ると、過去の「その他（自由入力）」の投稿のうち
--   社名が新しく登録した会社と完全一致するものは、行を1行も書き換えずに
--   REAL PAY で正しい社名に出るようになる（pv_airline_resolve が実行時に引くため）。
--   pay_reports を update してはいけない（持ち主の proof_hash が外れる）。
--
-- ★cap_lo / cap_hi / fo_lo / fo_hi は公開年収の幅（万円・salary-data.mjs のまま）。
--   REAL PAY が「公開年収から大きく外れた本人申告の行」に ⚠ を付けるのに読む
--   （db/pay-rows.sql の fence）。年収の幅を直したら、このファイルも流し直して貼る。
--   貼らないと ⚠ の判定だけが古い幅のまま残る（画面は普通に動く）。
-- ════════════════════════════════════════════════════════════════

create table if not exists public.pv_airlines (
  code    text primary key,
  name_ja text not null,
  name_en text not null,
  region  text not null,
  active  boolean not null default true
);
alter table public.pv_airlines add column if not exists cap_lo integer;
alter table public.pv_airlines add column if not exists cap_hi integer;
alter table public.pv_airlines add column if not exists fo_lo  integer;
alter table public.pv_airlines add column if not exists fo_hi  integer;

insert into public.pv_airlines (code, name_ja, name_en, region, cap_lo, cap_hi, fo_lo, fo_hi) values
  ('ana', '全日本空輸（ANA）', 'All Nippon Airways (ANA)', 'japan', 2200, 3500, 1400, 2100),
  ('jal', '日本航空（JAL）', 'Japan Airlines (JAL)', 'japan', 2200, 3500, 1400, 2100),
  ('zipair', 'ZIPAIR Tokyo', 'ZIPAIR Tokyo', 'japan', 2200, 3100, 1200, 1900),
  ('jetstar-japan', 'ジェットスター・ジャパン', 'Jetstar Japan', 'japan', 2000, 2900, 1250, 1600),
  ('peach', 'Peach Aviation', 'Peach Aviation', 'japan', 2000, 2800, 1000, 1600),
  ('solaseed', 'ソラシドエア', 'Solaseed Air', 'japan', 1800, 2300, 1050, 1400),
  ('spring-japan', 'スプリング・ジャパン', 'Spring Japan', 'japan', 1700, 2500, 900, 1400),
  ('airdo', 'AIRDO', 'AIRDO (AIR DO)', 'japan', 1750, 2250, 1000, 1400),
  ('starflyer', 'スターフライヤー', 'StarFlyer (Star Flyer)', 'japan', 1650, 2200, 900, 1350),
  ('skymark', 'スカイマーク', 'Skymark Airlines', 'japan', 1600, 2300, 700, 1200),
  ('fda', 'フジドリームエアラインズ（FDA）', 'Fuji Dream Airlines (FDA)', 'japan', 1400, 1800, 700, 1050),
  ('emirates', 'エミレーツ', 'Emirates', 'mideast', 3350, 5050, 2500, 3350),
  ('qantas', 'カンタス航空', 'Qantas', 'oceania', 3120, 5400, 1660, 3120),
  ('cathay-pacific', 'キャセイパシフィック', 'Cathay Pacific', 'asia', 3000, 5650, 1800, 3230),
  ('singapore-airlines', 'シンガポール航空', 'Singapore Airlines', 'asia', 2750, 4150, 1100, 2280),
  ('etihad', 'エティハド航空', 'Etihad Airways', 'mideast', 3000, 6000, 1900, 3100),
  ('qatar-airways', 'カタール航空', 'Qatar Airways', 'mideast', 2600, 4800, 1850, 2700),
  ('korean-air', '大韓航空', 'Korean Air', 'asia', 1850, 2750, 950, 1430),
  ('asiana', 'アシアナ航空', 'Asiana Airlines', 'asia', 1650, 2450, 840, 1270),
  ('starlux', 'スターラックス', 'STARLUX Airlines', 'asia', 2000, 3900, 1200, 1700),
  ('china-airlines', 'チャイナエアライン', 'China Airlines', 'asia', 1500, 2450, 700, 1280),
  ('thai-airways', 'タイ国際航空', 'Thai Airways International', 'asia', 1500, 2420, 660, 1140),
  ('eva-air', 'エバー航空', 'EVA Air', 'asia', 1370, 2200, 600, 1180),
  ('united', 'ユナイテッド航空', 'United Airlines', 'us', 5370, 8530, 1790, 5220),
  ('delta', 'デルタ航空', 'Delta Air Lines', 'us', 4950, 8690, 1680, 5020),
  ('american', 'アメリカン航空', 'American Airlines', 'us', 5010, 8600, 1710, 5260),
  ('southwest', 'サウスウエスト航空', 'Southwest Airlines', 'us', 4140, 7110, 1660, 4030),
  ('klm', 'KLMオランダ航空', 'KLM Royal Dutch Airlines', 'europe', 3030, 5810, 1380, 4370),
  ('air-france', 'エールフランス', 'Air France', 'europe', 2750, 6020, 1200, 2920),
  ('lufthansa', 'ルフトハンザ', 'Lufthansa', 'europe', 2490, 4320, 1260, 3010),
  ('air-canada', 'エア・カナダ', 'Air Canada', 'us', 2490, 4260, 580, 2200),
  ('british-airways', 'ブリティッシュ・エアウェイズ', 'British Airways', 'europe', 2020, 4040, 1170, 2460),
  ('airjapan', 'AirJapan', 'AirJapan', 'japan', 1900, 2400, 1150, 1550),
  ('amx', '天草エアライン', 'Amakusa Airlines (AMX)', 'japan', 1200, 1600, 700, 1000),
  ('ana-wings', 'ANAウイングス', 'ANA Wings', 'japan', 1700, 2300, 1100, 1500),
  ('daiichi-air', '第一航空', 'Daiichi Aviation (Daiichi Air)', 'japan', 1100, 1500, 650, 950),
  ('hac', '北海道エアシステム', 'Hokkaido Air System (HAC)', 'japan', 1500, 1900, 850, 1200),
  ('ibex', 'IBEXエアラインズ', 'IBEX Airlines', 'japan', 1500, 1900, 900, 1250),
  ('j-air', 'ジェイエア', 'J-Air (J-AIR)', 'japan', 1800, 2300, 1100, 1500),
  ('jac', '日本エアコミューター', 'Japan Air Commuter (JAC)', 'japan', 1500, 1900, 850, 1200),
  ('jta', '日本トランスオーシャン航空', 'Japan Transocean Air (JTA)', 'japan', 1800, 2300, 1100, 1500),
  ('orc', 'オリエンタルエアブリッジ', 'Oriental Air Bridge (ORC)', 'japan', 1300, 1700, 700, 1000),
  ('rac', '琉球エアーコミューター', 'Ryukyu Air Commuter (RAC)', 'japan', 1500, 1900, 850, 1200),
  ('shin-central', '新中央航空', 'Shin Chuo Airlines (Shin Nichi Aviation)', 'japan', 1000, 1500, 650, 900),
  ('shin-nihon', '新日本航空', 'Shin Nihon Airlines', 'japan', 1000, 1400, 600, 900),
  ('toho-air', '東邦航空', 'Toho Air Service', 'japan', 1000, 1500, 600, 900),
  ('toki-air', 'トキエア', 'Toki Air', 'japan', 1200, 1700, 650, 950),
  ('air-china', '中国国際航空', 'Air China', 'asia', 2200, 4800, 1000, 2200),
  ('china-eastern', '中国東方航空', 'China Eastern Airlines', 'asia', 2100, 4600, 980, 2100),
  ('china-southern', '中国南方航空', 'China Southern Airlines', 'asia', 2100, 4700, 980, 2100),
  ('hainan-airlines', '海南航空', 'Hainan Airlines', 'asia', 2200, 4800, 1000, 2200),
  ('airx-charter', 'エアX・チャーター', 'AirX Charter Ltd', 'europe', 1350, 2500, 750, 1500),
  ('eagle-jet', 'イーグルジェット・インターナショナル', 'Eagle Jet International, Inc.', 'europe', 1050, 1900, 550, 1050),
  ('root-aviation', 'ルート・アビエーション', 'Root Aviation', 'asia', 1000, 1800, 500, 1000),
  ('solairus', 'ソレイラス・アビエーション', 'Solairus Aviation', 'us', 1850, 3200, 1300, 2200),
  ('air-india', 'エア・インディア', 'Air India', 'asia', 1100, 2000, 540, 900),
  ('airasia', 'エアアジア', 'AirAsia Group', 'asia', 1050, 1680, 400, 780),
  ('bamboo-airways', 'バンブー・エアウェイズ', 'Bamboo Airways', 'asia', 1300, 2400, 700, 1400),
  ('batik-air', 'バティック・エア', 'Batik Air', 'asia', 590, 1180, 300, 560),
  ('garuda-indonesia', 'ガルーダ・インドネシア航空', 'Garuda Indonesia', 'asia', 1050, 2200, 470, 980),
  ('hong-kong-express', '香港エクスプレス航空', 'HK Express', 'asia', 1400, 2600, 800, 1500),
  ('indigo', 'インディゴ航空', 'IndiGo', 'asia', 1150, 2200, 340, 650),
  ('malaysia-airlines', 'マレーシア航空', 'Malaysia Airlines', 'asia', 1300, 2600, 650, 1350),
  ('philippine-airlines', 'フィリピン航空', 'Philippine Airlines', 'asia', 1150, 2100, 500, 1050),
  ('scoot', 'スクート', 'Scoot', 'asia', 1900, 2900, 850, 1450),
  ('vietjet', 'ベトジェット航空', 'VietJet Air', 'asia', 1200, 2300, 600, 1350),
  ('vietnam-airlines', 'ベトナム航空', 'Vietnam Airlines', 'asia', 1400, 2500, 700, 1450),
  ('egyptair', 'エジプト航空', 'EgyptAir', 'africa', 1250, 1900, 650, 1050),
  ('ethiopian-airlines', 'エチオピア航空', 'Ethiopian Airlines', 'africa', 1300, 1950, 700, 1100),
  ('gulf-air', 'ガルフ・エア', 'Gulf Air', 'mideast', 2300, 3300, 1250, 1850),
  ('kenya-airways', 'ケニア航空', 'Kenya Airways', 'africa', 1150, 1950, 550, 1050),
  ('kuwait-airways', 'クウェート航空', 'Kuwait Airways', 'mideast', 2300, 3500, 1250, 1950),
  ('oman-air', 'オマーン航空', 'Oman Air', 'mideast', 2100, 3000, 1150, 1750),
  ('riyadh-air', 'リヤド航空', 'Riyadh Air', 'mideast', 3600, 5000, 2700, 3400),
  ('royal-brunei', 'ロイヤル・ブルネイ航空', 'Royal Brunei Airlines', 'asia', 1700, 2450, 900, 1350),
  ('royal-jordanian', 'ロイヤル・ヨルダン航空', 'Royal Jordanian', 'mideast', 1350, 2200, 700, 1150),
  ('saudia', 'サウジア航空', 'Saudia', 'mideast', 2700, 4200, 1450, 2300),
  ('south-african-airways', '南アフリカ航空', 'South African Airways (SAA)', 'africa', 1050, 1700, 550, 950),
  ('turkish-airlines', 'ターキッシュ エアラインズ', 'Turkish Airlines', 'europe', 2000, 3000, 1150, 1800),
  ('aegean', 'エーゲ航空', 'Aegean Airlines', 'europe', 1030, 1550, 480, 780),
  ('aer-lingus', 'エア・リンガス', 'Aer Lingus', 'europe', 2150, 4100, 1240, 2600),
  ('austrian', 'オーストリア航空', 'Austrian Airlines', 'europe', 2000, 3300, 1240, 2050),
  ('easyjet', 'イージージェット', 'easyJet', 'europe', 2300, 3600, 1210, 1980),
  ('eurowings', 'ユーロウイングス', 'Eurowings', 'europe', 2060, 3480, 1270, 2150),
  ('finnair', 'フィンエアー', 'Finnair', 'europe', 2400, 3900, 1150, 2300),
  ('iberia', 'イベリア航空', 'Iberia', 'europe', 2150, 3400, 1000, 1890),
  ('icelandair', 'アイスランド航空', 'Icelandair', 'europe', 1720, 2600, 950, 1550),
  ('ita-airways', 'ITAエアウェイズ', 'ITA Airways', 'europe', 1890, 2500, 780, 1460),
  ('lot', 'LOTポーランド航空', 'LOT Polish Airlines', 'europe', 1150, 1650, 590, 860),
  ('norwegian', 'ノルウェー・エアシャトル', 'Norwegian Air Shuttle (Norwegian)', 'europe', 1430, 2700, 720, 1650),
  ('ryanair', 'ライアンエアー', 'Ryanair', 'europe', 1450, 3100, 650, 1460),
  ('sas', 'スカンジナビア航空', 'SAS Scandinavian Airlines', 'europe', 2220, 3170, 740, 1500),
  ('swiss', 'スイス インターナショナル エアラインズ', 'Swiss International Air Lines (SWISS)', 'europe', 3520, 5900, 1850, 3400),
  ('tap', 'TAPポルトガル航空', 'TAP Air Portugal', 'europe', 1720, 3100, 780, 1550),
  ('virgin-atlantic', 'ヴァージン・アトランティック航空', 'Virgin Atlantic', 'europe', 2830, 4600, 1510, 2420),
  ('vueling', 'ブエリング航空', 'Vueling Airlines', 'europe', 1200, 2400, 690, 1380),
  ('wizz-air', 'ウィズ・エアー', 'Wizz Air UK', 'europe', 1860, 3300, 720, 1720),
  ('aeromexico', 'アエロメヒコ航空', 'Aeromexico', 'latam', 1700, 2900, 850, 1700),
  ('air-new-zealand', 'ニュージーランド航空', 'Air New Zealand', 'oceania', 2500, 4000, 1150, 2300),
  ('alaska-airlines', 'アラスカ航空', 'Alaska Airlines', 'us', 3800, 5800, 1700, 3600),
  ('allegiant', 'アレジアント航空', 'Allegiant Air', 'us', 2600, 3600, 900, 2400),
  ('avianca', 'アビアンカ航空', 'Avianca', 'latam', 1200, 2400, 550, 1300),
  ('breeze-airways', 'ブリーズ・エアウェイズ', 'Breeze Airways', 'us', 3200, 4400, 1650, 2500),
  ('copa-airlines', 'コパ航空', 'Copa Airlines', 'latam', 1700, 3000, 850, 1700),
  ('fiji-airways', 'フィジー・エアウェイズ', 'Fiji Airways', 'oceania', 1400, 2400, 800, 1600),
  ('frontier', 'フロンティア航空', 'Frontier Airlines', 'us', 2600, 4300, 1100, 2200),
  ('jetblue', 'ジェットブルー航空', 'JetBlue Airways', 'us', 3500, 4700, 1500, 3000),
  ('jetstar', 'ジェットスター航空', 'Jetstar Airways (Jetstar)', 'oceania', 1900, 3100, 950, 1750),
  ('latam', 'LATAM航空', 'LATAM Airlines', 'latam', 1200, 2700, 550, 1500),
  ('porter', 'ポーター航空', 'Porter Airlines', 'us', 2300, 3200, 1000, 1700),
  ('spirit', 'スピリット航空', 'Spirit Airlines', 'us', 2900, 4700, 1300, 3000),
  ('westjet', 'ウェストジェット航空', 'WestJet Airlines', 'us', 2600, 4400, 1400, 2200),
  ('aero-toyota', 'エアロトヨタ', 'AERO TOYOTA', 'japan', null, null, null, null),
  ('nakanihon-air', '中日本航空（NNK）', 'Nakanihon Air (NNK)', 'japan', null, null, null, null),
  ('honda-airways', '本田航空', 'Honda Airways', 'japan', null, null, null, null),
  ('fuji-business-jet', 'フジビジネスジェット（FBJ）', 'Fuji Business Jet (FBJ)', 'japan', null, null, null, null),
  ('japan-biz-aviation', 'Japan Biz Aviation', 'Japan Biz Aviation', 'japan', null, null, null, null),
  ('netjets', 'NetJets', 'NetJets', 'us', null, null, null, null),
  ('executive-jet-management', 'Executive Jet Management（EJM）', 'Executive Jet Management (EJM)', 'us', null, null, null, null),
  ('flexjet', 'Flexjet', 'Flexjet', 'us', null, null, null, null),
  ('wheels-up', 'Wheels Up', 'Wheels Up', 'us', null, null, null, null),
  ('flyexclusive', 'flyExclusive', 'flyExclusive', 'us', null, null, null, null),
  ('clay-lacy', 'Clay Lacy Aviation', 'Clay Lacy Aviation', 'us', null, null, null, null),
  ('vistajet', 'VistaJet', 'VistaJet', 'europe', null, null, null, null),
  ('jet-aviation', 'Jet Aviation', 'Jet Aviation', 'europe', null, null, null, null),
  ('luxaviation', 'Luxaviation', 'Luxaviation', 'europe', null, null, null, null),
  ('gama-aviation', 'Gama Aviation', 'Gama Aviation', 'europe', null, null, null, null),
  ('royal-jet', 'Royal Jet', 'Royal Jet', 'mideast', null, null, null, null),
  ('other', 'その他（自由入力）', 'Other (free text)', 'other', null, null, null, null)
on conflict (code) do update
  set name_ja = excluded.name_ja,
      name_en = excluded.name_en,
      region  = excluded.region,
      cap_lo  = excluded.cap_lo,
      cap_hi  = excluded.cap_hi,
      fo_lo   = excluded.fo_lo,
      fo_hi   = excluded.fo_hi,
      active  = true;

-- 名簿から消えた社は残したまま active=false にする（投稿の参照先を壊さない）
update public.pv_airlines set active = false
 where code not in ('ana', 'jal', 'zipair', 'jetstar-japan', 'peach', 'solaseed', 'spring-japan', 'airdo', 'starflyer', 'skymark', 'fda', 'emirates', 'qantas', 'cathay-pacific', 'singapore-airlines', 'etihad', 'qatar-airways', 'korean-air', 'asiana', 'starlux', 'china-airlines', 'thai-airways', 'eva-air', 'united', 'delta', 'american', 'southwest', 'klm', 'air-france', 'lufthansa', 'air-canada', 'british-airways', 'airjapan', 'amx', 'ana-wings', 'daiichi-air', 'hac', 'ibex', 'j-air', 'jac', 'jta', 'orc', 'rac', 'shin-central', 'shin-nihon', 'toho-air', 'toki-air', 'air-china', 'china-eastern', 'china-southern', 'hainan-airlines', 'airx-charter', 'eagle-jet', 'root-aviation', 'solairus', 'air-india', 'airasia', 'bamboo-airways', 'batik-air', 'garuda-indonesia', 'hong-kong-express', 'indigo', 'malaysia-airlines', 'philippine-airlines', 'scoot', 'vietjet', 'vietnam-airlines', 'egyptair', 'ethiopian-airlines', 'gulf-air', 'kenya-airways', 'kuwait-airways', 'oman-air', 'riyadh-air', 'royal-brunei', 'royal-jordanian', 'saudia', 'south-african-airways', 'turkish-airlines', 'aegean', 'aer-lingus', 'austrian', 'easyjet', 'eurowings', 'finnair', 'iberia', 'icelandair', 'ita-airways', 'lot', 'norwegian', 'ryanair', 'sas', 'swiss', 'tap', 'virgin-atlantic', 'vueling', 'wizz-air', 'aeromexico', 'air-new-zealand', 'alaska-airlines', 'allegiant', 'avianca', 'breeze-airways', 'copa-airlines', 'fiji-airways', 'frontier', 'jetblue', 'jetstar', 'latam', 'porter', 'spirit', 'westjet', 'aero-toyota', 'nakanihon-air', 'honda-airways', 'fuji-business-jet', 'japan-biz-aviation', 'netjets', 'executive-jet-management', 'flexjet', 'wheels-up', 'flyexclusive', 'clay-lacy', 'vistajet', 'jet-aviation', 'luxaviation', 'gama-aviation', 'royal-jet', 'other');

alter table public.pv_airlines enable row level security;
drop policy if exists pv_airlines_read on public.pv_airlines;
create policy pv_airlines_read on public.pv_airlines for select to anon, authenticated using (true);

-- 検算：129 件（128社 ＋ other）・年収の幅あり 112 社
select count(*) filter (where active) as 有効, count(*) as 全件,
       count(*) filter (where active and cap_hi is not null and fo_hi is not null) as 年収の幅あり
  from public.pv_airlines;
