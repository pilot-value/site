/**
 * seo-batch-update.mjs
 * PILOT VALUE — Batch SEO injection for all airline pages (JP + EN)
 * Adds: title upgrade, description, keywords, canonical, hreflang, OG, JSON-LD
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';

const BASE = 'https://pilot-value.com';

/* ═══════════════════════════════════════════════════
   AIRLINE DATA MAP  (slug → SEO data)
   ═══════════════════════════════════════════════════ */
const AIRLINES = {
  /* ── Japan major ── */
  'ana': {
    nameJP:'ANA（全日本空輸）', nameEN:'ANA (All Nippon Airways)',
    captainJP:'2,200万〜3,500万円', foJP:'1,400万〜2,100万円',
    captainEN:'¥22M–35M', foEN:'¥14M–21M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'日本最大の航空会社',
    kwJP:['ANA パイロット 年収','ANA 機長 年収','全日本空輸 パイロット 年収','ANA 副操縦士 年収','ANA パイロット 転職','ANA 自社養成'],
    kwEN:['ANA pilot salary','ANA captain salary Japan','All Nippon Airways pilot pay','ANA pilot career'],
    hasEN: false,
  },
  'jal': {
    nameJP:'JAL（日本航空）', nameEN:'JAL (Japan Airlines)',
    captainJP:'2,200万〜3,500万円', foJP:'1,400万〜2,100万円',
    captainEN:'¥22M–35M', foEN:'¥14M–21M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'日本の国際フラッグキャリア',
    kwJP:['JAL パイロット 年収','JAL 機長 年収','日本航空 パイロット 年収','JAL 副操縦士 年収','JAL パイロット 転職'],
    kwEN:['JAL pilot salary','Japan Airlines pilot pay','JAL captain salary 2026'],
    hasEN: false,
  },
  'skymark': {
    nameJP:'スカイマーク', nameEN:'Skymark Airlines',
    captainJP:'1,600万〜2,300万円', foJP:'700万〜1,200万円',
    captainEN:'¥16M–23M', foEN:'¥7M–12M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'国内LCC最大手',
    kwJP:['スカイマーク パイロット 年収','スカイマーク 機長 年収','SKY パイロット 転職'],
    kwEN:['Skymark Airlines pilot salary','Skymark pilot pay Japan'],
    hasEN: true,
  },
  'zipair': {
    nameJP:'ZIPAIR Tokyo', nameEN:'ZIPAIR Tokyo',
    captainJP:'2,200万〜3,100万円', foJP:'1,200万〜1,900万円',
    captainEN:'¥22M–31M', foEN:'¥12M–19M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'JALグループ LCC 国際線',
    kwJP:['ZIPAIR パイロット 年収','ZIPAIR 機長 年収','ジップエア パイロット 転職'],
    kwEN:['ZIPAIR pilot salary','ZIPAIR Tokyo pilot pay'],
    hasEN: true,
  },
  'peach': {
    nameJP:'Peach Aviation', nameEN:'Peach Aviation',
    captainJP:'2,000万〜2,800万円', foJP:'1,000万〜1,600万円',
    captainEN:'¥20M–28M', foEN:'¥10M–16M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'ANAグループ 国内外LCC',
    kwJP:['Peach パイロット 年収','ピーチ 機長 年収','Peach Aviation パイロット 転職'],
    kwEN:['Peach Aviation pilot salary','Peach pilot pay Japan LCC'],
    hasEN: true,
  },
  'jetstar-japan': {
    nameJP:'ジェットスター・ジャパン', nameEN:'Jetstar Japan',
    captainJP:'2,000万〜2,900万円', foJP:'1,250万〜1,600万円',
    captainEN:'¥20M–29M', foEN:'¥13M–16M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'JALグループ LCC',
    kwJP:['ジェットスタージャパン パイロット 年収','Jetstar Japan 機長 年収','GK パイロット 転職'],
    kwEN:['Jetstar Japan pilot salary','Jetstar Japan pilot pay'],
    hasEN: true,
  },
  'spring-japan': {
    nameJP:'スプリング・ジャパン', nameEN:'Spring Japan',
    captainJP:'1,700万〜2,500万円', foJP:'900万〜1,400万円',
    captainEN:'¥17M–25M', foEN:'¥9M–14M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'春秋航空日本 JALグループ',
    kwJP:['スプリングジャパン パイロット 年収','春秋航空日本 機長 年収'],
    kwEN:['Spring Japan pilot salary','Spring Japan pilot pay'],
    hasEN: true,
  },
  'airdo': {
    nameJP:'AIRDO（エア・ドゥ）', nameEN:'AIRDO',
    captainJP:'1,750万〜2,250万円', foJP:'1,000万〜1,400万円',
    captainEN:'¥18M–23M', foEN:'¥10M–14M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'北海道エアシステム系',
    kwJP:['AIRDO パイロット 年収','エアドゥ 機長 年収','AIRDO 転職'],
    kwEN:['AIRDO pilot salary Japan'],
    hasEN: false,
  },
  'solaseed': {
    nameJP:'ソラシドエア', nameEN:'Solaseed Air',
    captainJP:'1,800万〜2,300万円', foJP:'1,050万〜1,400万円',
    captainEN:'¥18M–23M', foEN:'¥11M–14M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'九州拠点 国内線',
    kwJP:['ソラシドエア パイロット 年収','ソラシドエア 機長 年収'],
    kwEN:['Solaseed Air pilot salary Japan'],
    hasEN: false,
  },
  'starflyer': {
    nameJP:'スターフライヤー', nameEN:'StarFlyer',
    captainJP:'1,650万〜2,200万円', foJP:'900万〜1,350万円',
    captainEN:'¥17M–22M', foEN:'¥9M–14M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'北九州発 プレミアムLCC',
    kwJP:['スターフライヤー パイロット 年収','StarFlyer 機長 年収'],
    kwEN:['StarFlyer pilot salary Japan'],
    hasEN: false,
  },
  'skymark': {
    nameJP:'スカイマーク', nameEN:'Skymark Airlines',
    captainJP:'1,600万〜2,300万円', foJP:'700万〜1,200万円',
    captainEN:'¥16M–23M', foEN:'¥7M–12M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'国内LCC',
    kwJP:['スカイマーク パイロット 年収','スカイマーク 機長 年収'],
    kwEN:['Skymark pilot salary Japan'],
    hasEN: true,
  },
  /* ── Middle East ── */
  'emirates': {
    nameJP:'エミレーツ航空', nameEN:'Emirates',
    captainJP:'3,350万〜5,050万円', foJP:'2,500万〜3,350万円',
    captainEN:'¥34M–51M', foEN:'¥25M–34M',
    country:'UAE', countryEN:'UAE', flag:'🇦🇪',
    note:'世界最大規模 非課税 住宅手当あり',
    kwJP:['エミレーツ パイロット 年収','Emirates 機長 年収','エミレーツ航空 パイロット 転職','UAE パイロット 非課税','エミレーツ 副操縦士 年収'],
    kwEN:['Emirates pilot salary','Emirates captain salary 2026','Emirates pilot pay tax free','Emirates pilot job','pilot salary Emirates UAE'],
    hasEN: true,
  },
  'qatar-airways': {
    nameJP:'カタール航空', nameEN:'Qatar Airways',
    captainJP:'2,600万〜4,800万円', foJP:'1,850万〜2,700万円',
    captainEN:'¥26M–48M', foEN:'¥19M–27M',
    country:'カタール', countryEN:'Qatar', flag:'🇶🇦',
    note:'ワールドクラス 非課税 5★航空会社',
    kwJP:['カタール航空 パイロット 年収','Qatar Airways 機長 年収','カタール パイロット 転職','Qatar 非課税 パイロット'],
    kwEN:['Qatar Airways pilot salary','Qatar pilot salary 2026','Qatar Airways captain pay tax free','Qatar pilot job'],
    hasEN: true,
  },
  'etihad': {
    nameJP:'エティハド航空', nameEN:'Etihad Airways',
    captainJP:'3,000万〜6,000万円', foJP:'1,900万〜3,100万円',
    captainEN:'¥30M–60M', foEN:'¥19M–31M',
    country:'UAE', countryEN:'UAE', flag:'🇦🇪',
    note:'アブダビ発 非課税',
    kwJP:['エティハド航空 パイロット 年収','Etihad 機長 年収','エティハド パイロット 転職'],
    kwEN:['Etihad Airways pilot salary','Etihad pilot pay 2026','Etihad captain salary tax free'],
    hasEN: true,
  },
  'gulf-air': {
    nameJP:'ガルフエア', nameEN:'Gulf Air',
    captainJP:'2,800万〜3,800万円（非課税）', foJP:'1,500万〜2,000万円（非課税）',
    captainEN:'¥28M–38M (tax-free)', foEN:'¥15M–20M (tax-free)',
    country:'バーレーン', countryEN:'Bahrain', flag:'🇧🇭',
    note:'バーレーン 非課税',
    kwJP:['ガルフエア パイロット 年収','Gulf Air 機長 年収'],
    kwEN:['Gulf Air pilot salary','Gulf Air pilot pay tax free'],
    hasEN: false,
  },
  'saudia': {
    nameJP:'サウジア（サウジアラビア航空）', nameEN:'Saudia (Saudi Arabian Airlines)',
    captainJP:'2,500万〜3,500万円（非課税）', foJP:'1,200万〜1,800万円（非課税）',
    captainEN:'¥25M–35M (tax-free)', foEN:'¥12M–18M (tax-free)',
    country:'サウジアラビア', countryEN:'Saudi Arabia', flag:'🇸🇦',
    note:'サウジ 非課税',
    kwJP:['サウジアラビア航空 パイロット 年収','Saudia 機長 年収'],
    kwEN:['Saudia pilot salary','Saudi Arabian Airlines pilot pay'],
    hasEN: false,
  },
  'oman-air': {
    nameJP:'オマーン航空', nameEN:'Oman Air',
    captainJP:'2,500万〜3,200万円（非課税）', foJP:'1,300万〜1,800万円（非課税）',
    captainEN:'¥25M–32M (tax-free)', foEN:'¥13M–18M (tax-free)',
    country:'オマーン', countryEN:'Oman', flag:'🇴🇲',
    note:'オマーン 非課税',
    kwJP:['オマーン航空 パイロット 年収','Oman Air 機長 年収'],
    kwEN:['Oman Air pilot salary','Oman Air pilot pay'],
    hasEN: false,
  },
  'kuwait-airways': {
    nameJP:'クウェート航空', nameEN:'Kuwait Airways',
    captainJP:'2,200万〜3,000万円（非課税）', foJP:'1,200万〜1,600万円（非課税）',
    captainEN:'¥22M–30M (tax-free)', foEN:'¥12M–16M (tax-free)',
    country:'クウェート', countryEN:'Kuwait', flag:'🇰🇼',
    note:'クウェート 非課税',
    kwJP:['クウェート航空 パイロット 年収','Kuwait Airways 機長 年収'],
    kwEN:['Kuwait Airways pilot salary','Kuwait Airways pilot pay'],
    hasEN: false,
  },
  'riyadh-air': {
    nameJP:'リヤド・エア', nameEN:'Riyadh Air',
    captainJP:'3,000万〜4,000万円（非課税）', foJP:'1,500万〜2,200万円（非課税）',
    captainEN:'¥30M–40M (tax-free)', foEN:'¥15M–22M (tax-free)',
    country:'サウジアラビア', countryEN:'Saudi Arabia', flag:'🇸🇦',
    note:'新設LCC 非課税 積極採用中',
    kwJP:['リヤドエア パイロット 年収','Riyadh Air 機長 年収','新設航空会社 パイロット'],
    kwEN:['Riyadh Air pilot salary','Riyadh Air pilot jobs 2026'],
    hasEN: false,
  },
  /* ── Asia Pacific ── */
  'singapore-airlines': {
    nameJP:'シンガポール航空', nameEN:'Singapore Airlines',
    captainJP:'2,750万〜4,150万円', foJP:'1,100万〜2,280万円',
    captainEN:'¥28M–42M', foEN:'¥11M–23M',
    country:'シンガポール', countryEN:'Singapore', flag:'🇸🇬',
    note:'アジア最高評価 5★ Skytrax',
    kwJP:['シンガポール航空 パイロット 年収','SIA 機長 年収','シンガポール航空 パイロット 転職','SQ 副操縦士 年収'],
    kwEN:['Singapore Airlines pilot salary','SIA pilot pay 2026','Singapore Airlines captain salary','SIA pilot job'],
    hasEN: true,
  },
  'cathay-pacific': {
    nameJP:'キャセイパシフィック航空', nameEN:'Cathay Pacific Airways',
    captainJP:'3,000万〜5,650万円', foJP:'1,800万〜3,230万円',
    captainEN:'¥30M–57M', foEN:'¥18M–32M',
    country:'香港', countryEN:'Hong Kong', flag:'🇭🇰',
    note:'香港ベース 一部課税有',
    kwJP:['キャセイパシフィック パイロット 年収','Cathay Pacific 機長 年収','キャセイ パイロット 転職','CX 副操縦士 年収'],
    kwEN:['Cathay Pacific pilot salary','Cathay pilot pay 2026','Cathay Pacific captain salary','CX pilot job Hong Kong'],
    hasEN: true,
  },
  'korean-air': {
    nameJP:'大韓航空', nameEN:'Korean Air',
    captainJP:'1,850万〜2,750万円', foJP:'950万〜1,430万円',
    captainEN:'¥19M–28M', foEN:'¥10M–14M',
    country:'韓国', countryEN:'South Korea', flag:'🇰🇷',
    note:'韓国フラッグキャリア',
    kwJP:['大韓航空 パイロット 年収','Korean Air 機長 年収','韓国 パイロット 転職'],
    kwEN:['Korean Air pilot salary','Korean Air captain pay 2026','KAL pilot salary'],
    hasEN: true,
  },
  'eva-air': {
    nameJP:'エバー航空', nameEN:'EVA Air',
    captainJP:'1,370万〜2,200万円', foJP:'600万〜1,180万円',
    captainEN:'¥14M–22M', foEN:'¥6M–12M',
    country:'台湾', countryEN:'Taiwan', flag:'🇹🇼',
    note:'台湾 5★ Skytrax',
    kwJP:['エバー航空 パイロット 年収','EVA Air 機長 年収','台湾 パイロット 転職'],
    kwEN:['EVA Air pilot salary','EVA Air captain pay','Taiwan airline pilot salary'],
    hasEN: true,
  },
  'china-airlines': {
    nameJP:'チャイナエアライン', nameEN:'China Airlines',
    captainJP:'1,500万〜2,450万円', foJP:'700万〜1,280万円',
    captainEN:'¥15M–25M', foEN:'¥7M–13M',
    country:'台湾', countryEN:'Taiwan', flag:'🇹🇼',
    note:'台湾フラッグキャリア',
    kwJP:['チャイナエアライン パイロット 年収','China Airlines 機長 年収'],
    kwEN:['China Airlines pilot salary','China Airlines captain pay Taiwan'],
    hasEN: true,
  },
  'starlux': {
    nameJP:'スターラックス航空', nameEN:'Starlux Airlines',
    captainJP:'1,960万〜2,700万円', foJP:'750万〜1,670万円',
    captainEN:'¥20M–27M', foEN:'¥8M–17M',
    country:'台湾', countryEN:'Taiwan', flag:'🇹🇼',
    note:'新設 高サービス 台湾LCC',
    kwJP:['スターラックス パイロット 年収','Starlux 機長 年収'],
    kwEN:['Starlux Airlines pilot salary','Starlux pilot pay Taiwan'],
    hasEN: true,
  },
  'thai-airways': {
    nameJP:'タイ国際航空', nameEN:'Thai Airways',
    captainJP:'1,500万〜2,420万円', foJP:'660万〜1,140万円',
    captainEN:'¥15M–24M', foEN:'¥7M–11M',
    country:'タイ', countryEN:'Thailand', flag:'🇹🇭',
    note:'タイフラッグキャリア',
    kwJP:['タイ国際航空 パイロット 年収','Thai Airways 機長 年収'],
    kwEN:['Thai Airways pilot salary','Thai Airways captain pay'],
    hasEN: true,
  },
  'malaysia-airlines': {
    nameJP:'マレーシア航空', nameEN:'Malaysia Airlines',
    captainJP:'1,800万〜2,600万円', foJP:'900万〜1,400万円',
    captainEN:'¥18M–26M', foEN:'¥9M–14M',
    country:'マレーシア', countryEN:'Malaysia', flag:'🇲🇾',
    note:'マレーシアフラッグキャリア',
    kwJP:['マレーシア航空 パイロット 年収','Malaysia Airlines 機長 年収'],
    kwEN:['Malaysia Airlines pilot salary','Malaysia Airlines captain pay'],
    hasEN: true,
  },
  'garuda-indonesia': {
    nameJP:'ガルーダ・インドネシア', nameEN:'Garuda Indonesia',
    captainJP:'1,500万〜2,200万円', foJP:'750万〜1,200万円',
    captainEN:'¥15M–22M', foEN:'¥7.5M–12M',
    country:'インドネシア', countryEN:'Indonesia', flag:'🇮🇩',
    note:'インドネシアフラッグキャリア',
    kwJP:['ガルーダインドネシア パイロット 年収','Garuda Indonesia 機長 年収'],
    kwEN:['Garuda Indonesia pilot salary','Garuda pilot pay'],
    hasEN: true,
  },
  'airasia': {
    nameJP:'エアアジア', nameEN:'AirAsia',
    captainJP:'1,500万〜2,200万円', foJP:'700万〜1,100万円',
    captainEN:'¥15M–22M', foEN:'¥7M–11M',
    country:'マレーシア', countryEN:'Malaysia', flag:'🇲🇾',
    note:'アジア最大LCC',
    kwJP:['エアアジア パイロット 年収','AirAsia 機長 年収','エアアジア 転職'],
    kwEN:['AirAsia pilot salary','AirAsia captain pay','LCC pilot salary Asia'],
    hasEN: true,
  },
  'scoot': {
    nameJP:'スクート', nameEN:'Scoot',
    captainJP:'1,800万〜2,500万円', foJP:'900万〜1,400万円',
    captainEN:'¥18M–25M', foEN:'¥9M–14M',
    country:'シンガポール', countryEN:'Singapore', flag:'🇸🇬',
    note:'Singapore Airlines グループ LCC',
    kwJP:['スクート パイロット 年収','Scoot 機長 年収'],
    kwEN:['Scoot pilot salary','Scoot pilot pay Singapore LCC'],
    hasEN: true,
  },
  'philippine-airlines': {
    nameJP:'フィリピン航空', nameEN:'Philippine Airlines',
    captainJP:'1,500万〜2,200万円', foJP:'800万〜1,200万円',
    captainEN:'¥15M–22M', foEN:'¥8M–12M',
    country:'フィリピン', countryEN:'Philippines', flag:'🇵🇭',
    note:'フィリピンフラッグキャリア',
    kwJP:['フィリピン航空 パイロット 年収','Philippine Airlines 機長 年収'],
    kwEN:['Philippine Airlines pilot salary','PAL pilot pay'],
    hasEN: true,
  },
  'vietnam-airlines': {
    nameJP:'ベトナム航空', nameEN:'Vietnam Airlines',
    captainJP:'1,300万〜2,000万円', foJP:'700万〜1,100万円',
    captainEN:'¥13M–20M', foEN:'¥7M–11M',
    country:'ベトナム', countryEN:'Vietnam', flag:'🇻🇳',
    note:'ベトナムフラッグキャリア',
    kwJP:['ベトナム航空 パイロット 年収','Vietnam Airlines 機長 年収'],
    kwEN:['Vietnam Airlines pilot salary','Vietnam Airlines pilot pay'],
    hasEN: true,
  },
  'vietjet': {
    nameJP:'ベトジェット', nameEN:'VietJet Air',
    captainJP:'1,200万〜1,800万円', foJP:'650万〜1,000万円',
    captainEN:'¥12M–18M', foEN:'¥6.5M–10M',
    country:'ベトナム', countryEN:'Vietnam', flag:'🇻🇳',
    note:'ベトナムLCC',
    kwJP:['ベトジェット パイロット 年収','VietJet 機長 年収'],
    kwEN:['VietJet pilot salary','VietJet Air pilot pay'],
    hasEN: true,
  },
  'bamboo-airways': {
    nameJP:'バンブー航空', nameEN:'Bamboo Airways',
    captainJP:'1,300万〜1,900万円', foJP:'700万〜1,100万円',
    captainEN:'¥13M–19M', foEN:'¥7M–11M',
    country:'ベトナム', countryEN:'Vietnam', flag:'🇻🇳',
    note:'ベトナム新興キャリア',
    kwJP:['バンブー航空 パイロット 年収','Bamboo Airways 機長 年収'],
    kwEN:['Bamboo Airways pilot salary','Bamboo Airways pilot pay'],
    hasEN: true,
  },
  'indigo': {
    nameJP:'インディゴ', nameEN:'IndiGo',
    captainJP:'1,200万〜1,800万円', foJP:'600万〜950万円',
    captainEN:'¥12M–18M', foEN:'¥6M–9.5M',
    country:'インド', countryEN:'India', flag:'🇮🇳',
    note:'インド最大LCC',
    kwJP:['インディゴ パイロット 年収','IndiGo 機長 年収'],
    kwEN:['IndiGo pilot salary','IndiGo pilot pay India'],
    hasEN: true,
  },
  'air-india': {
    nameJP:'エア・インディア', nameEN:'Air India',
    captainJP:'1,500万〜2,300万円', foJP:'800万〜1,300万円',
    captainEN:'¥15M–23M', foEN:'¥8M–13M',
    country:'インド', countryEN:'India', flag:'🇮🇳',
    note:'インドフラッグキャリア Tata傘下',
    kwJP:['エアインディア パイロット 年収','Air India 機長 年収'],
    kwEN:['Air India pilot salary','Air India captain pay','Air India pilot job'],
    hasEN: true,
  },
  'air-china': {
    nameJP:'中国国際航空', nameEN:'Air China',
    captainJP:'1,500万〜2,500万円', foJP:'800万〜1,400万円',
    captainEN:'¥15M–25M', foEN:'¥8M–14M',
    country:'中国', countryEN:'China', flag:'🇨🇳',
    note:'中国フラッグキャリア',
    kwJP:['中国国際航空 パイロット 年収','Air China 機長 年収'],
    kwEN:['Air China pilot salary','Air China captain pay'],
    hasEN: true,
  },
  'china-eastern': {
    nameJP:'中国東方航空', nameEN:'China Eastern Airlines',
    captainJP:'1,400万〜2,200万円', foJP:'750万〜1,200万円',
    captainEN:'¥14M–22M', foEN:'¥7.5M–12M',
    country:'中国', countryEN:'China', flag:'🇨🇳',
    note:'中国三大キャリア',
    kwJP:['中国東方航空 パイロット 年収','China Eastern 機長 年収'],
    kwEN:['China Eastern pilot salary','China Eastern Airlines pilot pay'],
    hasEN: true,
  },
  'china-southern': {
    nameJP:'中国南方航空', nameEN:'China Southern Airlines',
    captainJP:'1,400万〜2,200万円', foJP:'750万〜1,200万円',
    captainEN:'¥14M–22M', foEN:'¥7.5M–12M',
    country:'中国', countryEN:'China', flag:'🇨🇳',
    note:'中国最大手 アジア最多路線',
    kwJP:['中国南方航空 パイロット 年収','China Southern 機長 年収'],
    kwEN:['China Southern Airlines pilot salary','China Southern pilot pay'],
    hasEN: true,
  },
  'hainan-airlines': {
    nameJP:'海南航空', nameEN:'Hainan Airlines',
    captainJP:'1,400万〜2,100万円', foJP:'750万〜1,200万円',
    captainEN:'¥14M–21M', foEN:'¥7.5M–12M',
    country:'中国', countryEN:'China', flag:'🇨🇳',
    note:'中国民営 5★ Skytrax',
    kwJP:['海南航空 パイロット 年収','Hainan Airlines 機長 年収'],
    kwEN:['Hainan Airlines pilot salary','Hainan Airlines pilot pay'],
    hasEN: true,
  },
  'hong-kong-express': {
    nameJP:'香港エクスプレス', nameEN:'Hong Kong Express',
    captainJP:'1,500万〜2,200万円', foJP:'700万〜1,300万円',
    captainEN:'¥15M–22M', foEN:'¥7M–13M',
    country:'香港', countryEN:'Hong Kong', flag:'🇭🇰',
    note:'Qatar グループ LCC',
    kwJP:['香港エクスプレス パイロット 年収','HK Express 機長 年収'],
    kwEN:['Hong Kong Express pilot salary','HK Express pilot pay'],
    hasEN: true,
  },
  'batik-air': {
    nameJP:'バティックエア', nameEN:'Batik Air',
    captainJP:'900万〜1,600万円', foJP:'400万〜800万円',
    captainEN:'¥9M–16M', foEN:'¥4M–8M',
    country:'インドネシア', countryEN:'Indonesia', flag:'🇮🇩',
    note:'Lion Airグループ FSC',
    kwJP:['バティックエア パイロット 年収','Batik Air 機長 年収'],
    kwEN:['Batik Air pilot salary','Batik Air pilot pay Indonesia'],
    hasEN: true,
  },
  'royal-brunei': {
    nameJP:'ロイヤルブルネイ航空', nameEN:'Royal Brunei Airlines',
    captainJP:'1,600万〜2,400万円（非課税）', foJP:'800万〜1,400万円（非課税）',
    captainEN:'¥16M–24M (tax-free)', foEN:'¥8M–14M (tax-free)',
    country:'ブルネイ', countryEN:'Brunei', flag:'🇧🇳',
    note:'ブルネイ 非課税 長距離路線',
    kwJP:['ロイヤルブルネイ航空 パイロット 年収','Royal Brunei 機長 年収','ブルネイ 非課税 パイロット'],
    kwEN:['Royal Brunei Airlines pilot salary','Royal Brunei pilot pay tax free'],
    hasEN: true,
  },
  /* ── US majors ── */
  'delta': {
    nameJP:'デルタ航空', nameEN:'Delta Air Lines',
    captainJP:'4,950万〜8,690万円', foJP:'1,680万〜5,020万円',
    captainEN:'¥50M–87M', foEN:'¥17M–50M',
    country:'アメリカ', countryEN:'USA', flag:'🇺🇸',
    note:'世界最高水準 シニア機長8,000万超',
    kwJP:['デルタ航空 パイロット 年収','Delta 機長 年収','デルタ パイロット 転職','アメリカ航空会社 パイロット 年収'],
    kwEN:['Delta Air Lines pilot salary','Delta pilot pay 2026','Delta captain salary','highest paid airline pilot USA'],
    hasEN: false,
  },
  'united': {
    nameJP:'ユナイテッド航空', nameEN:'United Airlines',
    captainJP:'5,370万〜8,530万円', foJP:'1,790万〜5,220万円',
    captainEN:'¥54M–85M', foEN:'¥18M–52M',
    country:'アメリカ', countryEN:'USA', flag:'🇺🇸',
    note:'米大手3社 年収ランキング上位',
    kwJP:['ユナイテッド航空 パイロット 年収','United Airlines 機長 年収','ユナイテッド パイロット 転職'],
    kwEN:['United Airlines pilot salary','United pilot pay 2026','United captain salary'],
    hasEN: true,
  },
  'american': {
    nameJP:'アメリカン航空', nameEN:'American Airlines',
    captainJP:'5,010万〜8,600万円', foJP:'1,710万〜5,260万円',
    captainEN:'¥50M–86M', foEN:'¥17M–53M',
    country:'アメリカ', countryEN:'USA', flag:'🇺🇸',
    note:'乗客数世界最大 Oneworld',
    kwJP:['アメリカン航空 パイロット 年収','American Airlines 機長 年収','アメリカン パイロット 転職'],
    kwEN:['American Airlines pilot salary','American Airlines pilot pay 2026','American captain salary','AAL pilot salary'],
    hasEN: true,
  },
  'southwest': {
    nameJP:'サウスウエスト航空', nameEN:'Southwest Airlines',
    captainJP:'4,140万〜7,110万円', foJP:'1,660万〜4,030万円',
    captainEN:'¥41M–71M', foEN:'¥17M–40M',
    country:'アメリカ', countryEN:'USA', flag:'🇺🇸',
    note:'米国内LCC最大 高年収',
    kwJP:['サウスウエスト航空 パイロット 年収','Southwest 機長 年収','LCC パイロット 高収入'],
    kwEN:['Southwest Airlines pilot salary','Southwest pilot pay 2026','Southwest captain salary','LCC pilot salary USA'],
    hasEN: true,
  },
  'alaska-airlines': {
    nameJP:'アラスカ航空', nameEN:'Alaska Airlines',
    captainJP:'4,500万〜6,500万円', foJP:'1,800万〜3,500万円',
    captainEN:'¥45M–65M', foEN:'¥18M–35M',
    country:'アメリカ', countryEN:'USA', flag:'🇺🇸',
    note:'米西海岸拠点 高水準',
    kwJP:['アラスカ航空 パイロット 年収','Alaska Airlines 機長 年収'],
    kwEN:['Alaska Airlines pilot salary','Alaska Airlines pilot pay'],
    hasEN: false,
  },
  'jetblue': {
    nameJP:'ジェットブルー', nameEN:'JetBlue Airways',
    captainJP:'3,500万〜5,500万円', foJP:'1,500万〜3,000万円',
    captainEN:'¥35M–55M', foEN:'¥15M–30M',
    country:'アメリカ', countryEN:'USA', flag:'🇺🇸',
    note:'米LCC',
    kwJP:['ジェットブルー パイロット 年収','JetBlue 機長 年収'],
    kwEN:['JetBlue pilot salary','JetBlue Airways pilot pay'],
    hasEN: false,
  },
  'frontier': {
    nameJP:'フロンティア航空', nameEN:'Frontier Airlines',
    captainJP:'2,500万〜4,000万円', foJP:'900万〜2,000万円',
    captainEN:'¥25M–40M', foEN:'¥9M–20M',
    country:'アメリカ', countryEN:'USA', flag:'🇺🇸',
    note:'米LCC',
    kwJP:['フロンティア航空 パイロット 年収','Frontier Airlines 機長 年収'],
    kwEN:['Frontier Airlines pilot salary','Frontier pilot pay'],
    hasEN: false,
  },
  'spirit': {
    nameJP:'スピリット航空', nameEN:'Spirit Airlines',
    captainJP:'2,000万〜3,500万円', foJP:'800万〜1,800万円',
    captainEN:'¥20M–35M', foEN:'¥8M–18M',
    country:'アメリカ', countryEN:'USA', flag:'🇺🇸',
    note:'米ULCC',
    kwJP:['スピリット航空 パイロット 年収','Spirit Airlines 機長 年収'],
    kwEN:['Spirit Airlines pilot salary','Spirit pilot pay'],
    hasEN: false,
  },
  /* ── Europe ── */
  'lufthansa': {
    nameJP:'ルフトハンザ航空', nameEN:'Lufthansa',
    captainJP:'2,490万〜4,320万円', foJP:'1,260万〜3,010万円',
    captainEN:'¥25M–43M', foEN:'¥13M–30M',
    country:'ドイツ', countryEN:'Germany', flag:'🇩🇪',
    note:'欧州最大 ドイツフラッグキャリア',
    kwJP:['ルフトハンザ パイロット 年収','Lufthansa 機長 年収','ドイツ 航空会社 パイロット 転職'],
    kwEN:['Lufthansa pilot salary','Lufthansa captain pay 2026','Lufthansa pilot job Germany'],
    hasEN: true,
  },
  'british-airways': {
    nameJP:'ブリティッシュ・エアウェイズ', nameEN:'British Airways',
    captainJP:'2,020万〜4,040万円', foJP:'1,170万〜2,460万円',
    captainEN:'¥20M–40M', foEN:'¥12M–25M',
    country:'イギリス', countryEN:'UK', flag:'🇬🇧',
    note:'英国フラッグキャリア IAG',
    kwJP:['ブリティッシュ エアウェイズ パイロット 年収','British Airways 機長 年収'],
    kwEN:['British Airways pilot salary','BA pilot pay 2026','British Airways captain salary'],
    hasEN: false,
  },
  'air-france': {
    nameJP:'エールフランス', nameEN:'Air France',
    captainJP:'2,750万〜6,020万円', foJP:'1,200万〜2,920万円',
    captainEN:'¥28M–60M', foEN:'¥12M–29M',
    country:'フランス', countryEN:'France', flag:'🇫🇷',
    note:'フランスフラッグキャリア',
    kwJP:['エールフランス パイロット 年収','Air France 機長 年収'],
    kwEN:['Air France pilot salary','Air France captain pay'],
    hasEN: false,
  },
  'klm': {
    nameJP:'KLMオランダ航空', nameEN:'KLM Royal Dutch Airlines',
    captainJP:'3,030万〜5,810万円', foJP:'1,380万〜4,370万円',
    captainEN:'¥30M–58M', foEN:'¥14M–44M',
    country:'オランダ', countryEN:'Netherlands', flag:'🇳🇱',
    note:'Air France-KLMグループ',
    kwJP:['KLM パイロット 年収','KLMオランダ航空 機長 年収'],
    kwEN:['KLM pilot salary','KLM Royal Dutch Airlines pilot pay'],
    hasEN: false,
  },
  'swiss': {
    nameJP:'スイス インターナショナル エアラインズ', nameEN:'Swiss International Air Lines',
    captainJP:'3,500万〜5,200万円', foJP:'1,600万〜2,800万円',
    captainEN:'¥35M–52M', foEN:'¥16M–28M',
    country:'スイス', countryEN:'Switzerland', flag:'🇨🇭',
    note:'Lufthansaグループ 高生活水準',
    kwJP:['スイス航空 パイロット 年収','SWISS 機長 年収'],
    kwEN:['Swiss International Air Lines pilot salary','SWISS pilot pay'],
    hasEN: false,
  },
  'austrian': {
    nameJP:'オーストリア航空', nameEN:'Austrian Airlines',
    captainJP:'2,800万〜4,200万円', foJP:'1,200万〜2,100万円',
    captainEN:'¥28M–42M', foEN:'¥12M–21M',
    country:'オーストリア', countryEN:'Austria', flag:'🇦🇹',
    note:'Lufthansaグループ',
    kwJP:['オーストリア航空 パイロット 年収','Austrian Airlines 機長 年収'],
    kwEN:['Austrian Airlines pilot salary','Austrian pilot pay'],
    hasEN: false,
  },
  'finnair': {
    nameJP:'フィンエアー', nameEN:'Finnair',
    captainJP:'2,800万〜4,200万円', foJP:'1,200万〜2,100万円',
    captainEN:'¥28M–42M', foEN:'¥12M–21M',
    country:'フィンランド', countryEN:'Finland', flag:'🇫🇮',
    note:'Oneworld 北欧キャリア',
    kwJP:['フィンエアー パイロット 年収','Finnair 機長 年収'],
    kwEN:['Finnair pilot salary','Finnair captain pay Finland'],
    hasEN: false,
  },
  'iberia': {
    nameJP:'イベリア航空', nameEN:'Iberia',
    captainJP:'2,800万〜4,200万円', foJP:'1,200万〜2,100万円',
    captainEN:'¥28M–42M', foEN:'¥12M–21M',
    country:'スペイン', countryEN:'Spain', flag:'🇪🇸',
    note:'IAG スペインフラッグキャリア',
    kwJP:['イベリア航空 パイロット 年収','Iberia 機長 年収'],
    kwEN:['Iberia pilot salary','Iberia Airlines pilot pay'],
    hasEN: false,
  },
  'tap': {
    nameJP:'TAPエア・ポルトガル', nameEN:'TAP Air Portugal',
    captainJP:'2,500万〜3,800万円', foJP:'1,100万〜1,900万円',
    captainEN:'¥25M–38M', foEN:'¥11M–19M',
    country:'ポルトガル', countryEN:'Portugal', flag:'🇵🇹',
    note:'ポルトガルフラッグキャリア',
    kwJP:['TAPエアポルトガル パイロット 年収','TAP 機長 年収'],
    kwEN:['TAP Air Portugal pilot salary','TAP pilot pay'],
    hasEN: false,
  },
  'sas': {
    nameJP:'スカンジナビア航空', nameEN:'SAS Scandinavian Airlines',
    captainJP:'2,800万〜4,200万円', foJP:'1,200万〜2,100万円',
    captainEN:'¥28M–42M', foEN:'¥12M–21M',
    country:'北欧', countryEN:'Scandinavia', flag:'🇸🇪',
    note:'SAS北欧三国フラッグキャリア',
    kwJP:['スカンジナビア航空 パイロット 年収','SAS 機長 年収'],
    kwEN:['SAS Scandinavian Airlines pilot salary','SAS pilot pay'],
    hasEN: false,
  },
  'norwegian': {
    nameJP:'ノルウェー・エア・シャトル', nameEN:'Norwegian Air Shuttle',
    captainJP:'2,200万〜3,500万円', foJP:'1,000万〜1,800万円',
    captainEN:'¥22M–35M', foEN:'¥10M–18M',
    country:'ノルウェー', countryEN:'Norway', flag:'🇳🇴',
    note:'北欧LCC',
    kwJP:['ノルウェー航空 パイロット 年収','Norwegian 機長 年収'],
    kwEN:['Norwegian Air pilot salary','Norwegian pilot pay'],
    hasEN: false,
  },
  'ryanair': {
    nameJP:'ライアンエア', nameEN:'Ryanair',
    captainJP:'2,000万〜3,500万円', foJP:'800万〜1,500万円',
    captainEN:'¥20M–35M', foEN:'¥8M–15M',
    country:'アイルランド', countryEN:'Ireland', flag:'🇮🇪',
    note:'欧州最大LCC',
    kwJP:['ライアンエア パイロット 年収','Ryanair 機長 年収'],
    kwEN:['Ryanair pilot salary','Ryanair captain pay Europe LCC'],
    hasEN: false,
  },
  'easyjet': {
    nameJP:'イージージェット', nameEN:'easyJet',
    captainJP:'2,000万〜3,200万円', foJP:'800万〜1,600万円',
    captainEN:'¥20M–32M', foEN:'¥8M–16M',
    country:'イギリス', countryEN:'UK', flag:'🇬🇧',
    note:'英欧LCC',
    kwJP:['イージージェット パイロット 年収','easyJet 機長 年収'],
    kwEN:['easyJet pilot salary','easyJet captain pay'],
    hasEN: false,
  },
  'vueling': {
    nameJP:'ビュエリング', nameEN:'Vueling Airlines',
    captainJP:'2,000万〜3,200万円', foJP:'900万〜1,600万円',
    captainEN:'¥20M–32M', foEN:'¥9M–16M',
    country:'スペイン', countryEN:'Spain', flag:'🇪🇸',
    note:'IAG LCC',
    kwJP:['ビュエリング パイロット 年収','Vueling 機長 年収'],
    kwEN:['Vueling Airlines pilot salary','Vueling pilot pay'],
    hasEN: false,
  },
  'wizz-air': {
    nameJP:'ウィズ・エア', nameEN:'Wizz Air',
    captainJP:'2,000万〜3,200万円', foJP:'800万〜1,500万円',
    captainEN:'¥20M–32M', foEN:'¥8M–15M',
    country:'ハンガリー', countryEN:'Hungary', flag:'🇭🇺',
    note:'欧州格安LCC',
    kwJP:['ウィズエア パイロット 年収','Wizz Air 機長 年収'],
    kwEN:['Wizz Air pilot salary','Wizz Air captain pay'],
    hasEN: false,
  },
  'aer-lingus': {
    nameJP:'エア・リンガス', nameEN:'Aer Lingus',
    captainJP:'2,500万〜4,000万円', foJP:'1,100万〜2,000万円',
    captainEN:'¥25M–40M', foEN:'¥11M–20M',
    country:'アイルランド', countryEN:'Ireland', flag:'🇮🇪',
    note:'IAG アイルランドフラッグキャリア',
    kwJP:['エアリンガス パイロット 年収','Aer Lingus 機長 年収'],
    kwEN:['Aer Lingus pilot salary','Aer Lingus pilot pay'],
    hasEN: false,
  },
  'aegean': {
    nameJP:'エーゲ航空', nameEN:'Aegean Airlines',
    captainJP:'2,000万〜3,000万円', foJP:'900万〜1,500万円',
    captainEN:'¥20M–30M', foEN:'¥9M–15M',
    country:'ギリシャ', countryEN:'Greece', flag:'🇬🇷',
    note:'ギリシャ最大手',
    kwJP:['エーゲ航空 パイロット 年収','Aegean Airlines 機長 年収'],
    kwEN:['Aegean Airlines pilot salary','Aegean pilot pay Greece'],
    hasEN: false,
  },
  'lot': {
    nameJP:'LOTポーランド航空', nameEN:'LOT Polish Airlines',
    captainJP:'2,000万〜3,200万円', foJP:'900万〜1,600万円',
    captainEN:'¥20M–32M', foEN:'¥9M–16M',
    country:'ポーランド', countryEN:'Poland', flag:'🇵🇱',
    note:'スターアライアンス',
    kwJP:['LOTポーランド航空 パイロット 年収','LOT 機長 年収'],
    kwEN:['LOT Polish Airlines pilot salary','LOT pilot pay'],
    hasEN: false,
  },
  'ita-airways': {
    nameJP:'ITAエアウェイズ', nameEN:'ITA Airways',
    captainJP:'2,200万〜3,500万円', foJP:'1,000万〜1,800万円',
    captainEN:'¥22M–35M', foEN:'¥10M–18M',
    country:'イタリア', countryEN:'Italy', flag:'🇮🇹',
    note:'イタリアフラッグキャリア（旧Alitalia）',
    kwJP:['ITAエアウェイズ パイロット 年収','ITA Airways 機長 年収'],
    kwEN:['ITA Airways pilot salary','ITA Airways pilot pay Italy'],
    hasEN: false,
  },
  'icelandair': {
    nameJP:'アイスランド航空', nameEN:'Icelandair',
    captainJP:'2,500万〜3,500万円', foJP:'1,100万〜1,800万円',
    captainEN:'¥25M–35M', foEN:'¥11M–18M',
    country:'アイスランド', countryEN:'Iceland', flag:'🇮🇸',
    note:'アイスランド ハブ経由',
    kwJP:['アイスランド航空 パイロット 年収','Icelandair 機長 年収'],
    kwEN:['Icelandair pilot salary','Icelandair pilot pay'],
    hasEN: false,
  },
  /* ── Africa / Others ── */
  'ethiopian-airlines': {
    nameJP:'エチオピア航空', nameEN:'Ethiopian Airlines',
    captainJP:'1,800万〜2,800万円', foJP:'900万〜1,500万円',
    captainEN:'¥18M–28M', foEN:'¥9M–15M',
    country:'エチオピア', countryEN:'Ethiopia', flag:'🇪🇹',
    note:'アフリカ最大 スターアライアンス',
    kwJP:['エチオピア航空 パイロット 年収','Ethiopian Airlines 機長 年収'],
    kwEN:['Ethiopian Airlines pilot salary','Ethiopian Airlines pilot pay Africa'],
    hasEN: false,
  },
  'egyptair': {
    nameJP:'エジプト航空', nameEN:'EgyptAir',
    captainJP:'1,500万〜2,500万円', foJP:'700万〜1,300万円',
    captainEN:'¥15M–25M', foEN:'¥7M–13M',
    country:'エジプト', countryEN:'Egypt', flag:'🇪🇬',
    note:'アフリカ最古の航空会社',
    kwJP:['エジプト航空 パイロット 年収','EgyptAir 機長 年収'],
    kwEN:['EgyptAir pilot salary','EgyptAir pilot pay'],
    hasEN: false,
  },
  'south-african-airways': {
    nameJP:'南アフリカ航空', nameEN:'South African Airways',
    captainJP:'1,500万〜2,400万円', foJP:'700万〜1,200万円',
    captainEN:'¥15M–24M', foEN:'¥7M–12M',
    country:'南アフリカ', countryEN:'South Africa', flag:'🇿🇦',
    note:'アフリカ南部フラッグキャリア',
    kwJP:['南アフリカ航空 パイロット 年収','SAA 機長 年収'],
    kwEN:['South African Airways pilot salary','SAA pilot pay'],
    hasEN: false,
  },
  'kenya-airways': {
    nameJP:'ケニア航空', nameEN:'Kenya Airways',
    captainJP:'1,400万〜2,200万円', foJP:'700万〜1,200万円',
    captainEN:'¥14M–22M', foEN:'¥7M–12M',
    country:'ケニア', countryEN:'Kenya', flag:'🇰🇪',
    note:'東アフリカ フラッグキャリア',
    kwJP:['ケニア航空 パイロット 年収','Kenya Airways 機長 年収'],
    kwEN:['Kenya Airways pilot salary','Kenya Airways pilot pay'],
    hasEN: false,
  },
  /* ── Oceania / Canada ── */
  'qantas': {
    nameJP:'カンタス航空', nameEN:'Qantas Airways',
    captainJP:'3,120万〜5,400万円', foJP:'1,660万〜3,120万円',
    captainEN:'¥31M–54M', foEN:'¥17M–31M',
    country:'オーストラリア', countryEN:'Australia', flag:'🇦🇺',
    note:'オーストラリアフラッグキャリア',
    kwJP:['カンタス航空 パイロット 年収','Qantas 機長 年収','オーストラリア パイロット 転職'],
    kwEN:['Qantas pilot salary','Qantas Airways captain pay','Australia airline pilot salary'],
    hasEN: false,
  },
  'air-new-zealand': {
    nameJP:'ニュージーランド航空', nameEN:'Air New Zealand',
    captainJP:'3,000万〜4,500万円', foJP:'1,300万〜2,300万円',
    captainEN:'¥30M–45M', foEN:'¥13M–23M',
    country:'ニュージーランド', countryEN:'New Zealand', flag:'🇳🇿',
    note:'NZフラッグキャリア Skytrax上位',
    kwJP:['ニュージーランド航空 パイロット 年収','Air New Zealand 機長 年収'],
    kwEN:['Air New Zealand pilot salary','Air New Zealand captain pay'],
    hasEN: false,
  },
  'fiji-airways': {
    nameJP:'フィジー・エアウェイズ', nameEN:'Fiji Airways',
    captainJP:'2,000万〜3,000万円', foJP:'900万〜1,500万円',
    captainEN:'¥20M–30M', foEN:'¥9M–15M',
    country:'フィジー', countryEN:'Fiji', flag:'🇫🇯',
    note:'フィジー国営 外国人パイロット採用',
    kwJP:['フィジーエアウェイズ パイロット 年収','Fiji Airways 機長 年収'],
    kwEN:['Fiji Airways pilot salary','Fiji Airways pilot pay'],
    hasEN: false,
  },
  'air-canada': {
    nameJP:'エア・カナダ', nameEN:'Air Canada',
    captainJP:'2,490万〜4,260万円', foJP:'580万〜2,200万円',
    captainEN:'¥25M–43M', foEN:'¥6M–22M',
    country:'カナダ', countryEN:'Canada', flag:'🇨🇦',
    note:'カナダフラッグキャリア スターアライアンス',
    kwJP:['エアカナダ パイロット 年収','Air Canada 機長 年収'],
    kwEN:['Air Canada pilot salary','Air Canada captain pay','Canadian airline pilot salary'],
    hasEN: false,
  },
  'westjet': {
    nameJP:'ウェストジェット', nameEN:'WestJet',
    captainJP:'3,000万〜4,500万円', foJP:'1,200万〜2,500万円',
    captainEN:'¥30M–45M', foEN:'¥12M–25M',
    country:'カナダ', countryEN:'Canada', flag:'🇨🇦',
    note:'カナダLCC',
    kwJP:['ウェストジェット パイロット 年収','WestJet 機長 年収'],
    kwEN:['WestJet pilot salary','WestJet Airlines pilot pay Canada'],
    hasEN: false,
  },
  'porter': {
    nameJP:'ポーターエアラインズ', nameEN:'Porter Airlines',
    captainJP:'2,500万〜4,000万円', foJP:'1,100万〜2,000万円',
    captantEN:'¥25M–40M', foEN:'¥11M–20M',
    country:'カナダ', countryEN:'Canada', flag:'🇨🇦',
    note:'カナダ東部 地域キャリア',
    kwJP:['ポーターエアラインズ パイロット 年収','Porter Airlines 機長 年収'],
    kwEN:['Porter Airlines pilot salary','Porter Airlines pilot pay'],
    hasEN: false,
  },
  /* ── Latin America ── */
  'aeromexico': {
    nameJP:'アエロメヒコ', nameEN:'Aeromexico',
    captainJP:'1,800万〜2,800万円', foJP:'900万〜1,400万円',
    captainEN:'¥18M–28M', foEN:'¥9M–14M',
    country:'メキシコ', countryEN:'Mexico', flag:'🇲🇽',
    note:'メキシコフラッグキャリア SkyTeam',
    kwJP:['アエロメヒコ パイロット 年収','Aeromexico 機長 年収'],
    kwEN:['Aeromexico pilot salary','Aeromexico pilot pay'],
    hasEN: false,
  },
  'latam': {
    nameJP:'ラタム航空', nameEN:'LATAM Airlines',
    captainJP:'1,800万〜2,800万円', foJP:'900万〜1,500万円',
    captainEN:'¥18M–28M', foEN:'¥9M–15M',
    country:'チリ', countryEN:'Chile/Latin America', flag:'🇨🇱',
    note:'南米最大 LATAM Group',
    kwJP:['ラタム航空 パイロット 年収','LATAM Airlines 機長 年収'],
    kwEN:['LATAM Airlines pilot salary','LATAM pilot pay South America'],
    hasEN: false,
  },
  'avianca': {
    nameJP:'アビアンカ航空', nameEN:'Avianca',
    captainJP:'1,500万〜2,500万円', foJP:'750万〜1,300万円',
    captainEN:'¥15M–25M', foEN:'¥7.5M–13M',
    country:'コロンビア', countryEN:'Colombia', flag:'🇨🇴',
    note:'コロンビア 中南米キャリア',
    kwJP:['アビアンカ航空 パイロット 年収','Avianca 機長 年収'],
    kwEN:['Avianca pilot salary','Avianca Airlines pilot pay'],
    hasEN: false,
  },
  'copa-airlines': {
    nameJP:'コパ航空', nameEN:'Copa Airlines',
    captainJP:'2,000万〜3,000万円', foJP:'900万〜1,500万円',
    captainEN:'¥20M–30M', foEN:'¥9M–15M',
    country:'パナマ', countryEN:'Panama', flag:'🇵🇦',
    note:'スターアライアンス 中米ハブ',
    kwJP:['コパ航空 パイロット 年収','Copa Airlines 機長 年収'],
    kwEN:['Copa Airlines pilot salary','Copa Airlines pilot pay'],
    hasEN: false,
  },
  /* ── Japanese regional ── */
  'ana-wings': {
    nameJP:'ANAウイングス', nameEN:'ANA Wings',
    captainJP:'1,200万〜1,800万円', foJP:'650万〜950万円',
    captainEN:'¥12M–18M', foEN:'¥6.5M–9.5M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'ANAグループ 地域航空',
    kwJP:['ANAウイングス パイロット 年収','ANA Wings 機長 年収','地域航空 パイロット'],
    kwEN:['ANA Wings pilot salary Japan regional'],
    hasEN: false,
  },
  'airjapan': {
    nameJP:'エアージャパン', nameEN:'Air Japan',
    captainJP:'1,500万〜2,000万円', foJP:'800万〜1,100万円',
    captainEN:'¥15M–20M', foEN:'¥8M–11M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'ANAグループ 中距離LCC',
    kwJP:['エアージャパン パイロット 年収','Air Japan 機長 年収'],
    kwEN:['Air Japan pilot salary ANA group'],
    hasEN: false,
  },
  'jta': {
    nameJP:'日本トランスオーシャン航空', nameEN:'Japan Transocean Air (JTA)',
    captainJP:'1,400万〜1,900万円', foJP:'700万〜950万円',
    captainEN:'¥14M–19M', foEN:'¥7M–9.5M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'JALグループ 沖縄拠点',
    kwJP:['日本トランスオーシャン航空 パイロット 年収','JTA 機長 年収','沖縄 パイロット'],
    kwEN:['Japan Transocean Air pilot salary JTA'],
    hasEN: false,
  },
  'jac': {
    nameJP:'日本エアコミューター', nameEN:'Japan Air Commuter (JAC)',
    captainJP:'1,100万〜1,600万円', foJP:'600万〜850万円',
    captainEN:'¥11M–16M', foEN:'¥6M–8.5M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'JALグループ 鹿児島拠点 離島路線',
    kwJP:['日本エアコミューター パイロット 年収','JAC 機長 年収'],
    kwEN:['Japan Air Commuter pilot salary JAC'],
    hasEN: false,
  },
  'ibex': {
    nameJP:'アイベックスエアラインズ', nameEN:'IBEX Airlines',
    captainJP:'1,200万〜1,700万円', foJP:'650万〜900万円',
    captainEN:'¥12M–17M', foEN:'¥6.5M–9M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'ANAグループ 地域航空',
    kwJP:['アイベックスエアラインズ パイロット 年収','IBEX Airlines 機長 年収'],
    kwEN:['IBEX Airlines pilot salary Japan'],
    hasEN: false,
  },
  'fda': {
    nameJP:'フジドリームエアラインズ', nameEN:'Fuji Dream Airlines (FDA)',
    captainJP:'1,400万〜1,800万円', foJP:'700万〜1,050万円',
    captainEN:'¥14M–18M', foEN:'¥7M–11M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'静岡拠点 独立系地域航空',
    kwJP:['フジドリームエアラインズ パイロット 年収','FDA 機長 年収'],
    kwEN:['Fuji Dream Airlines pilot salary FDA'],
    hasEN: false,
  },
  'orc': {
    nameJP:'オリエンタルエアブリッジ', nameEN:'Oriental Air Bridge (ORC)',
    captainJP:'1,000万〜1,500万円', foJP:'550万〜800万円',
    captainEN:'¥10M–15M', foEN:'¥5.5M–8M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'ANAグループ 離島 長崎拠点',
    kwJP:['オリエンタルエアブリッジ パイロット 年収','ORC 機長 年収'],
    kwEN:['Oriental Air Bridge pilot salary ORC'],
    hasEN: false,
  },
  'rac': {
    nameJP:'琉球エアーコミューター', nameEN:'Ryukyu Air Commuter (RAC)',
    captainJP:'1,100万〜1,600万円', foJP:'600万〜850万円',
    captainEN:'¥11M–16M', foEN:'¥6M–8.5M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'JALグループ 沖縄離島',
    kwJP:['琉球エアーコミューター パイロット 年収','RAC 機長 年収'],
    kwEN:['Ryukyu Air Commuter pilot salary RAC'],
    hasEN: false,
  },
  'hac': {
    nameJP:'北海道エアシステム', nameEN:'Hokkaido Air System (HAC)',
    captainJP:'1,100万〜1,600万円', foJP:'600万〜850万円',
    captainEN:'¥11M–16M', foEN:'¥6M–8.5M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'JALグループ 北海道離島',
    kwJP:['北海道エアシステム パイロット 年収','HAC 機長 年収'],
    kwEN:['Hokkaido Air System pilot salary HAC'],
    hasEN: false,
  },
  'j-air': {
    nameJP:'ジェイエア', nameEN:'J-Air',
    captainJP:'1,200万〜1,700万円', foJP:'650万〜900万円',
    captainEN:'¥12M–17M', foEN:'¥6.5M–9M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'JALグループ 地域航空',
    kwJP:['ジェイエア パイロット 年収','J-Air 機長 年収'],
    kwEN:['J-Air pilot salary JAL group regional'],
    hasEN: false,
  },
  'jetstar': {
    nameJP:'ジェットスター（国際線）', nameEN:'Jetstar Airways',
    captainJP:'1,800万〜2,800万円', foJP:'900万〜1,500万円',
    captainEN:'¥18M–28M', foEN:'¥9M–15M',
    country:'オーストラリア', countryEN:'Australia', flag:'🇦🇺',
    note:'Qantasグループ LCC',
    kwJP:['ジェットスター パイロット 年収','Jetstar 機長 年収'],
    kwEN:['Jetstar Airways pilot salary','Jetstar pilot pay Australia'],
    hasEN: false,
  },
  /* ── Charter / small ── */
  'royal-jordanian': {
    nameJP:'ロイヤル・ヨルダニアン航空', nameEN:'Royal Jordanian',
    captainJP:'1,800万〜2,800万円', foJP:'900万〜1,500万円',
    captainEN:'¥18M–28M', foEN:'¥9M–15M',
    country:'ヨルダン', countryEN:'Jordan', flag:'🇯🇴',
    note:'Oneworld ヨルダンフラッグキャリア',
    kwJP:['ロイヤルヨルダニアン パイロット 年収','Royal Jordanian 機長 年収'],
    kwEN:['Royal Jordanian pilot salary','Royal Jordanian pilot pay'],
    hasEN: false,
  },
  'turkish-airlines': {
    nameJP:'ターキッシュ エアラインズ', nameEN:'Turkish Airlines',
    captainJP:'2,500万〜4,000万円', foJP:'1,100万〜2,000万円',
    captainEN:'¥25M–40M', foEN:'¥11M–20M',
    country:'トルコ', countryEN:'Turkey', flag:'🇹🇷',
    note:'スターアライアンス 最多就航国',
    kwJP:['ターキッシュ エアラインズ パイロット 年収','Turkish Airlines 機長 年収'],
    kwEN:['Turkish Airlines pilot salary','Turkish Airlines captain pay 2026'],
    hasEN: false,
  },
  'gulf-air': {
    nameJP:'ガルフエア', nameEN:'Gulf Air',
    captainJP:'2,800万〜3,800万円（非課税）', foJP:'1,500万〜2,000万円（非課税）',
    captainEN:'¥28M–38M (tax-free)', foEN:'¥15M–20M (tax-free)',
    country:'バーレーン', countryEN:'Bahrain', flag:'🇧🇭',
    note:'バーレーン 非課税',
    kwJP:['ガルフエア パイロット 年収','Gulf Air 機長 年収'],
    kwEN:['Gulf Air pilot salary','Gulf Air pilot pay'],
    hasEN: false,
  },
  /* small/charter Japanese */
  'airdo': {
    nameJP:'AIRDO', nameEN:'AIRDO',
    captainJP:'1,750万〜2,250万円', foJP:'1,000万〜1,400万円',
    captainEN:'¥18M–23M', foEN:'¥10M–14M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'北海道拠点 ANAグループ',
    kwJP:['AIRDO パイロット 年収','エアドゥ 機長 年収'],
    kwEN:['AIRDO pilot salary Japan'],
    hasEN: false,
  },
  'toki-air': {
    nameJP:'トキエア', nameEN:'Toki Air',
    captainJP:'1,200万〜1,700万円', foJP:'650万〜900万円',
    captainEN:'¥12M–17M', foEN:'¥6.5M–9M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'新潟拠点 新設航空会社',
    kwJP:['トキエア パイロット 年収','Toki Air 機長 年収'],
    kwEN:['Toki Air pilot salary Japan'],
    hasEN: false,
  },
  'toho-air': {
    nameJP:'東邦エアサービス', nameEN:'Toho Air Service',
    captainJP:'1,000万〜1,500万円', foJP:'550万〜800万円',
    captainEN:'¥10M–15M', foEN:'¥5.5M–8M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'沖縄拠点 チャーター',
    kwJP:['東邦エアサービス パイロット 年収'],
    kwEN:['Toho Air Service pilot salary'],
    hasEN: false,
  },
  'daiichi-air': {
    nameJP:'第一航空', nameEN:'Daiichi Airlines',
    captainJP:'900万〜1,400万円', foJP:'500万〜750万円',
    captainEN:'¥9M–14M', foEN:'¥5M–7.5M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'沖縄離島 小型機',
    kwJP:['第一航空 パイロット 年収','Daiichi 機長 年収'],
    kwEN:['Daiichi Airlines pilot salary Okinawa'],
    hasEN: false,
  },
  'shin-central': {
    nameJP:'新中央航空', nameEN:'Shin Nihon Air Service',
    captainJP:'1,000万〜1,500万円', foJP:'550万〜800万円',
    captainEN:'¥10M–15M', foEN:'¥5.5M–8M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'東京島嶼部 小型機',
    kwJP:['新中央航空 パイロット 年収'],
    kwEN:['Shin Nihon Air Service pilot salary'],
    hasEN: false,
  },
  'shin-nihon': {
    nameJP:'新日本航空', nameEN:'Shin Nihon Air',
    captainJP:'1,000万〜1,500万円', foJP:'550万〜800万円',
    captainEN:'¥10M–15M', foEN:'¥5.5M–8M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'鹿児島拠点 チャーター',
    kwJP:['新日本航空 パイロット 年収'],
    kwEN:['Shin Nihon Air pilot salary Japan'],
    hasEN: false,
  },
  'eagle-jet': {
    nameJP:'イーグルジェット', nameEN:'Eagle Jet',
    captainJP:'1,000万〜1,500万円', foJP:'550万〜800万円',
    captainEN:'¥10M–15M', foEN:'¥5.5M–8M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'ビジネスジェット チャーター',
    kwJP:['イーグルジェット パイロット 年収','Eagle Jet 機長 年収'],
    kwEN:['Eagle Jet pilot salary Japan'],
    hasEN: false,
  },
  'airx-charter': {
    nameJP:'AIR X（エアエックス）', nameEN:'AIR X',
    captainJP:'1,200万〜1,800万円', foJP:'650万〜950万円',
    captainEN:'¥12M–18M', foEN:'¥6.5M–9.5M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'ヘリコプター・ビジネスジェット',
    kwJP:['AIR X パイロット 年収','エアエックス 機長 年収'],
    kwEN:['AIR X charter pilot salary Japan'],
    hasEN: false,
  },
  'root-aviation': {
    nameJP:'ルート航空', nameEN:'Root Aviation',
    captainJP:'1,000万〜1,500万円', foJP:'550万〜800万円',
    captainEN:'¥10M–15M', foEN:'¥5.5M–8M',
    country:'日本', countryEN:'Japan', flag:'🇯🇵',
    note:'小型機 航空業務',
    kwJP:['ルート航空 パイロット 年収'],
    kwEN:['Root Aviation pilot salary Japan'],
    hasEN: false,
  },
  'solairus': {
    nameJP:'ソレイラス', nameEN:'Solairus Aviation',
    captainJP:'1,500万〜2,200万円', foJP:'800万〜1,200万円',
    captainEN:'¥15M–22M', foEN:'¥8M–12M',
    country:'アメリカ', countryEN:'USA', flag:'🇺🇸',
    note:'米ビジネス航空 チャーター',
    kwJP:['ソレイラス パイロット 年収','Solairus 機長 年収'],
    kwEN:['Solairus Aviation pilot salary'],
    hasEN: false,
  },
  'amx': {
    nameJP:'AMX インターナショナル', nameEN:'AMX International',
    captainJP:'1,500万〜2,500万円', foJP:'800万〜1,300万円',
    captainEN:'¥15M–25M', foEN:'¥8M–13M',
    country:'イタリア', countryEN:'Italy', flag:'🇮🇹',
    note:'欧州チャーター',
    kwJP:['AMX パイロット 年収'],
    kwEN:['AMX International pilot salary'],
    hasEN: false,
  },
  'breeze-airways': {
    nameJP:'ブリーズ航空', nameEN:'Breeze Airways',
    captainJP:'2,500万〜4,000万円', foJP:'1,000万〜2,000万円',
    captainEN:'¥25M–40M', foEN:'¥10M–20M',
    country:'アメリカ', countryEN:'USA', flag:'🇺🇸',
    note:'米新設LCC',
    kwJP:['ブリーズ航空 パイロット 年収','Breeze Airways 機長 年収'],
    kwEN:['Breeze Airways pilot salary','Breeze Airways pilot pay'],
    hasEN: false,
  },
  'allegiant': {
    nameJP:'アレジアント航空', nameEN:'Allegiant Air',
    captainJP:'2,500万〜4,000万円', foJP:'900万〜1,800万円',
    captainEN:'¥25M–40M', foEN:'¥9M–18M',
    country:'アメリカ', countryEN:'USA', flag:'🇺🇸',
    note:'米ULCC',
    kwJP:['アレジアント航空 パイロット 年収','Allegiant Air 機長 年収'],
    kwEN:['Allegiant Air pilot salary','Allegiant pilot pay'],
    hasEN: false,
  },
  'virginia-airlines': {
    nameJP:'バージン・アトランティック航空', nameEN:'Virgin Atlantic',
    captainJP:'3,000万〜4,500万円', foJP:'1,300万〜2,300万円',
    captainEN:'¥30M–45M', foEN:'¥13M–23M',
    country:'イギリス', countryEN:'UK', flag:'🇬🇧',
    note:'Virgin Group 英国 長距離',
    kwJP:['バージン アトランティック パイロット 年収','Virgin Atlantic 機長 年収'],
    kwEN:['Virgin Atlantic pilot salary','Virgin Atlantic pilot pay'],
    hasEN: false,
  },
  'virgin-atlantic': {
    nameJP:'バージン・アトランティック航空', nameEN:'Virgin Atlantic',
    captainJP:'3,000万〜4,500万円', foJP:'1,300万〜2,300万円',
    captainEN:'¥30M–45M', foEN:'¥13M–23M',
    country:'イギリス', countryEN:'UK', flag:'🇬🇧',
    note:'Virgin Group 英国 長距離',
    kwJP:['バージン アトランティック パイロット 年収','Virgin Atlantic 機長 年収'],
    kwEN:['Virgin Atlantic pilot salary','Virgin Atlantic pilot pay'],
    hasEN: false,
  },
};

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractAirlineNameFromTitle(title) {
  // Remove common suffixes
  return title
    .replace(/パイロット年収.*$/,'')
    .replace(/Pilot Salary.*/i,'')
    .replace(/\|.*$/,'')
    .replace(/【.*$/,'')
    .trim();
}

function buildJPSEO(slug, d, title) {
  const airlineName = d ? d.nameJP : extractAirlineNameFromTitle(title);
  const airlineNameEN = d ? d.nameEN : extractAirlineNameFromTitle(title);
  const captain = d ? d.captainJP : '要確認';
  const fo = d ? d.foJP : '要確認';
  const url = `${BASE}/airlines/${slug}.html`;
  const enUrl = `${BASE}/en/airlines/${slug}.html`;
  const hasEN = d ? d.hasEN : false;

  const desc = `${airlineName}のパイロット年収【2026年最新】。機長平均${captain}、副操縦士${fo}。採用情報・転職要件・キャリアパスを詳しく解説。`;
  const kwBase = d ? d.kwJP : [`${airlineName} パイロット 年収`, `${airlineName} 機長 年収`, `${airlineName} パイロット 転職`];
  const keywords = [
    ...kwBase,
    `${airlineName} パイロット 2026`,
    'パイロット 年収 ランキング',
    'パイロット 転職 海外',
    'PILOT VALUE',
  ].join(',');

  const ogTitle = `${airlineName} パイロット年収【2026年最新】機長${captain} | PILOT VALUE`;
  const newTitle = `${airlineName} パイロット年収【2026年最新】機長${captain}・副操縦士${fo} | PILOT VALUE`;

  const hreflang = hasEN ? `
<link rel="alternate" hreflang="ja" href="${url}"/>
<link rel="alternate" hreflang="en" href="${enUrl}"/>
<link rel="alternate" hreflang="x-default" href="${url}"/>` : `
<link rel="alternate" hreflang="ja" href="${url}"/>
<link rel="alternate" hreflang="x-default" href="${url}"/>`;

  const faq = [
    { q: `${airlineName}のパイロット年収はいくらですか？`, a: `${airlineName}のパイロット年収は、機長で${captain}、副操縦士で${fo}が目安です。詳細は採用条件や路線・機材によって異なります。` },
    { q: `${airlineName}のパイロットに転職するには？`, a: `${airlineName}のパイロット採用には、ATPL（航空運送事業操縦士）またはCPL取得が必要です。英語力（ICAO Level 4以上）と一定の飛行時間が求められます。` },
    { q: `${airlineName}は外国人パイロットを採用していますか？`, a: `${airlineName}の外国人パイロット採用状況は時期によって異なります。最新の採用情報は公式サイトをご確認ください。` },
  ];

  const ldJson = JSON.stringify([
    {
      "@context":"https://schema.org",
      "@type":"BreadcrumbList",
      "itemListElement":[
        {"@type":"ListItem","position":1,"name":"PILOT VALUE","item":BASE},
        {"@type":"ListItem","position":2,"name":"世界の航空会社一覧","item":`${BASE}/world-airlines.html`},
        {"@type":"ListItem","position":3,"name":`${airlineName} パイロット年収`,"item":url},
      ]
    },
    {
      "@context":"https://schema.org",
      "@type":"Article",
      "headline":`${airlineName} パイロット年収【2026年最新】機長${captain}・副操縦士年収を解説`,
      "description":desc,
      "publisher":{"@type":"Organization","name":"PILOT VALUE","url":BASE},
      "url":url,
      "mainEntityOfPage":url,
    },
    {
      "@context":"https://schema.org",
      "@type":"FAQPage",
      "mainEntity": faq.map(({q,a}) => ({
        "@type":"Question",
        "name":q,
        "acceptedAnswer":{"@type":"Answer","text":a}
      }))
    }
  ], null, 0);

  return { desc, keywords, url, enUrl, hasEN, ogTitle, newTitle, hreflang, ldJson, airlineName };
}

function buildENSEO(slug, d, titleOld) {
  const airlineNameEN = d ? d.nameEN : extractAirlineNameFromTitle(titleOld);
  const captain = d ? d.captainEN : 'varies';
  const fo = d ? d.foEN : 'varies';
  const url = `${BASE}/en/airlines/${slug}.html`;
  const jaUrl = `${BASE}/airlines/${slug}.html`;

  const desc = `${airlineNameEN} pilot salary 2026: captain avg ${captain}, first officer ${fo}. Hiring requirements, career path, and detailed pay breakdown.`;
  const newTitle = `${airlineNameEN} Pilot Salary 2026 – Captain ${captain} & First Officer Pay | PILOT VALUE`;
  const kwEN = d ? d.kwEN : [`${airlineNameEN} pilot salary`, `${airlineNameEN} captain salary 2026`];
  const keywords = [...kwEN, 'pilot salary 2026', 'airline pilot pay', 'PILOT VALUE'].join(',');

  const faq = [
    { q: `What is the ${airlineNameEN} pilot salary?`, a: `${airlineNameEN} pilot salary in 2026: captain averages ${captain} and first officer earages ${fo}. Actual pay depends on seniority, aircraft type, and routes flown.` },
    { q: `How to become a pilot at ${airlineNameEN}?`, a: `To join ${airlineNameEN} as a pilot, you typically need an ATPL, ICAO English Level 4 or higher, and a minimum number of flight hours. Check the official careers page for current requirements.` },
    { q: `Does ${airlineNameEN} hire foreign pilots?`, a: `${airlineNameEN}'s hiring of foreign pilots varies by period. Check the official careers page for the latest openings.` },
  ];

  const ldJson = JSON.stringify([
    {
      "@context":"https://schema.org",
      "@type":"BreadcrumbList",
      "itemListElement":[
        {"@type":"ListItem","position":1,"name":"PILOT VALUE","item":BASE},
        {"@type":"ListItem","position":2,"name":"All Airlines","item":`${BASE}/world-airlines.html`},
        {"@type":"ListItem","position":3,"name":`${airlineNameEN} Pilot Salary`,"item":url},
      ]
    },
    {
      "@context":"https://schema.org",
      "@type":"Article",
      "headline":`${airlineNameEN} Pilot Salary 2026 – Captain & First Officer Pay Guide`,
      "description":desc,
      "publisher":{"@type":"Organization","name":"PILOT VALUE","url":BASE},
      "url":url,
      "mainEntityOfPage":url,
    },
    {
      "@context":"https://schema.org",
      "@type":"FAQPage",
      "mainEntity": faq.map(({q,a}) => ({
        "@type":"Question",
        "name":q,
        "acceptedAnswer":{"@type":"Answer","text":a}
      }))
    }
  ], null, 0);

  return { desc, keywords, url, jaUrl, newTitle, ldJson, airlineNameEN };
}

/* ═══════════════════════════════════════════════════
   INJECT: JP PAGES
   ═══════════════════════════════════════════════════ */
function injectJP(filePath, slug) {
  let html = readFileSync(filePath, 'utf8');
  const d = AIRLINES[slug];
  const title = extractTitle(html);
  const { desc, keywords, url, enUrl, hasEN, ogTitle, newTitle, hreflang, ldJson } = buildJPSEO(slug, d, title);

  // Skip if already fully SEO'd (has description AND canonical AND JSON-LD)
  const hasDesc = html.includes('meta name="description"');
  const hasCanonical = html.includes('rel="canonical"');
  const hasLD = html.includes('application/ld+json');
  if (hasDesc && hasCanonical && hasLD) {
    // Still ensure hreflang is present
    if (!html.includes('hreflang') && hasEN) {
      html = html.replace(/<link rel="canonical"[^>]*\/>/,
        `<link rel="canonical" href="${url}"/>${hreflang}`);
      writeFileSync(filePath, html, 'utf8');
      console.log(`  hreflang added: ${slug}`);
    }
    return false; // already done
  }

  // Upgrade title if it's the thin version
  if (title.endsWith('パイロット年収・求人情報 | PILOT VALUE')) {
    html = html.replace(/<title>[^<]+<\/title>/, `<title>${newTitle}</title>`);
  }

  // Build injection block (insert after <meta charset...> line)
  const injection = [
    hasDesc ? '' : `<meta name="description" content="${desc}"/>`,
    `<meta name="keywords" content="${keywords}"/>`,
    `<meta name="robots" content="index,follow"/>`,
    hasCanonical ? '' : `<link rel="canonical" href="${url}"/>`,
    hreflang,
    `<meta property="og:title" content="${ogTitle}"/>`,
    `<meta property="og:description" content="${desc}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    `<meta property="og:type" content="article"/>`,
    `<meta property="og:site_name" content="PILOT VALUE"/>`,
    `<meta name="twitter:card" content="summary_large_image"/>`,
    `<meta name="twitter:title" content="${ogTitle}"/>`,
    `<meta name="twitter:description" content="${desc}"/>`,
    hasLD ? '' : `<script type="application/ld+json">${ldJson}</script>`,
  ].filter(Boolean).join('\n');

  // Insert after viewport meta tag
  html = html.replace(
    /(<meta name="viewport"[^>]*\/>)/i,
    `$1\n${injection}`
  );

  writeFileSync(filePath, html, 'utf8');
  return true;
}

/* ═══════════════════════════════════════════════════
   INJECT: EN PAGES
   ═══════════════════════════════════════════════════ */
function injectEN(filePath, slug) {
  let html = readFileSync(filePath, 'utf8');
  const d = AIRLINES[slug];
  const titleOld = extractTitle(html);
  const { desc: newDesc, keywords, url, jaUrl, newTitle, ldJson } = buildENSEO(slug, d, titleOld);

  const hasLD = html.includes('application/ld+json');
  const hasOG = html.includes('og:title');
  const hasTwt = html.includes('twitter:card');

  // Upgrade title if it's thin
  if (/Pilot Salary 2026 \|/.test(titleOld) || /Pilot Salary \|/.test(titleOld)) {
    if (d) {
      html = html.replace(/<title>[^<]+<\/title>/, `<title>${newTitle}</title>`);
    }
  }

  // Upgrade description to be more keyword-rich
  if (d) {
    html = html.replace(
      /<meta name="description" content="[^"]*"\/>/,
      `<meta name="description" content="${newDesc}"/>`
    );
  }

  const injection = [
    `<meta name="keywords" content="${keywords}"/>`,
    hasOG ? '' : `<meta property="og:title" content="${newTitle}"/>`,
    hasOG ? '' : `<meta property="og:description" content="${newDesc}"/>`,
    hasOG ? '' : `<meta property="og:url" content="${url}"/>`,
    hasOG ? '' : `<meta property="og:type" content="article"/>`,
    hasOG ? '' : `<meta property="og:site_name" content="PILOT VALUE"/>`,
    hasTwt ? '' : `<meta name="twitter:card" content="summary_large_image"/>`,
    hasTwt ? '' : `<meta name="twitter:title" content="${newTitle}"/>`,
    hasTwt ? '' : `<meta name="twitter:description" content="${newDesc}"/>`,
    hasLD ? '' : `<script type="application/ld+json">${ldJson}</script>`,
  ].filter(Boolean).join('\n');

  if (injection.trim()) {
    html = html.replace(
      /(<meta name="viewport"[^>]*\/>)/i,
      `$1\n${injection}`
    );
  }

  writeFileSync(filePath, html, 'utf8');
  return true;
}

/* ═══════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════ */
let jpUpdated = 0, jpSkipped = 0, enUpdated = 0;

// JP pages
const jpFiles = readdirSync('airlines').filter(f => f.endsWith('.html'));
for (const f of jpFiles) {
  const slug = f.replace('.html', '');
  const result = injectJP(`airlines/${f}`, slug);
  if (result) { jpUpdated++; console.log(`JP ✓ ${slug}`); }
  else { jpSkipped++; }
}

// EN pages
const enFiles = readdirSync('en/airlines').filter(f => f.endsWith('.html'));
for (const f of enFiles) {
  const slug = f.replace('.html', '');
  injectEN(`en/airlines/${f}`, slug);
  enUpdated++;
  console.log(`EN ✓ ${slug}`);
}

console.log(`\n✅ JP: ${jpUpdated} updated, ${jpSkipped} already SEO'd`);
console.log(`✅ EN: ${enUpdated} updated`);
