/* ── EN 表示辞書 ─────────────────────────────────────────────────
   /en/ 配下でのみ使用。日本語ページでは T() が引数を素通しするため描画は不変。
   DB の t:[…] は「読み仮名エイリアス＝検索インデックス」であってUIではないので訳さない
   （英語ページでも日本語で検索できる方が、日本人パイロットには都合が良い）。 */
var PV_SEARCH_L10N = {
  '航空会社を検索':   'Search airlines',
  '航空会社を検索…': 'Search airlines…',
  '閉じる':           'Close',
  '世界の航空会社':   'World Airlines',
  '日本 vs 海外':     'Japan vs Overseas',
  '年収ランキング':   'Salary Ranking',
  '求人情報':         'Job Openings',
  'コミュニティ':     'Community',
  'お問い合わせ':     'Contact',
  'ログイン':         'Login'
};

/* ═══════════════════════════════════════════════════
   PILOT VALUE — Global Airline Search
   ═══════════════════════════════════════════════════ */
(function(){
  'use strict';
  if (document.getElementById('pv-search-wrap')) return;

  /* ── Path prefix (airline sub-pages need ../) ── */
  /* ── /en/ 配下はルートより 1 階層深い ──────────────────────────
     P      … 現在の言語ディレクトリまで（/en/ 内なら /en/… に解決）
     ROOT_P … サイトルートまで（共有アセットと、EN 版が無いページ用）
     pageHref() … EN 版が実在するトップ級ページだけ言語内リンク、他はルート（日本語版）へ退避。
     実在リストは lang-toggle.js が生成する PV_EN_PAGES を唯一の正として参照する。 */
  var IS_EN  = location.pathname.indexOf('/en/') === 0;
  /* ⚠️ 以前は /airlines/ だけを見ていた。あとから増えた /countries/ では
        引き出しのロゴ画像とリンクの行き先が1階層ずれる（画像が出ない）。
        決め打ちをやめて、いま居る階層を数える。 */
  var P = (function () {
    var segs = location.pathname.replace(/[^/]*$/, '').split('/').filter(Boolean);
    if (IS_EN) segs.shift();
    return segs.map(function () { return '../'; }).join('');
  }());
  var ROOT_P = P + (IS_EN ? '../' : '');
  function pageHref(f) {
    if (!IS_EN) return P + f;
    var base = f.split('#')[0];
    if (base === 'index.html') return P + f;          // /en/index.html は常に存在
    var set = window.PV_EN_PAGES;
    return (set && set.has(base)) ? P + f : ROOT_P + f;
  }
  function T(s) { return IS_EN && PV_SEARCH_L10N[s] ? PV_SEARCH_L10N[s] : s; }

  /* ── Airline database ────────────────────────── */
  var DB = [
    /* ─ Japan — Major ─ */
    {n:'全日本空輸（ANA）',     e:'All Nippon Airways',         g:'🇯🇵', t:['ANA','NH','全日空','ぜんにっくう','あな'],                  f:'airlines/ana.html'},
    {n:'日本航空（JAL）',        e:'Japan Airlines',              g:'🇯🇵', t:['JAL','JL','じゃる','日本エアラインズ'],                    f:'airlines/jal.html'},
    {n:'スカイマーク',           e:'Skymark Airlines',            g:'🇯🇵', t:['SKY','BC','すかいまーく'],                               f:'airlines/skymark.html'},
    {n:'ZIPAIR Tokyo',           e:'ZIPAIR',                      g:'🇯🇵', t:['ZIP','ZG','ジップエア','じっぷ'],                        f:'airlines/zipair.html'},
    {n:'ピーチ・アビエーション', e:'Peach Aviation',              g:'🇯🇵', t:['Peach','APJ','MM','ピーチ'],                            f:'airlines/peach.html'},
    {n:'ジェットスター・ジャパン',e:'Jetstar Japan',              g:'🇯🇵', t:['JJP','GK','Jetstar','ジェットスター'],                   f:'airlines/jetstar-japan.html'},
    {n:'スプリング・ジャパン',   e:'Spring Japan',                g:'🇯🇵', t:['SJO','春秋航空日本','春秋','スプリング'],                 f:'airlines/spring-japan.html'},
    /* ─ Japan — Group/Regional ─ */
    {n:'ジェイエア（J-AIR）',    e:'J-AIR',                      g:'🇯🇵', t:['JAI','JALグループ','jair'],                             f:'airlines/j-air.html'},
    {n:'日本トランスオーシャン航空',e:'Japan Transocean Air',     g:'🇯🇵', t:['JTA','NU','那覇','トランスオーシャン'],                  f:'airlines/jta.html'},
    {n:'日本エアコミューター',   e:'Japan Air Commuter',          g:'🇯🇵', t:['JAC','3X','鹿児島','えあこみゅーたー'],                  f:'airlines/jac.html'},
    {n:'琉球エアーコミューター', e:'Ryukyu Air Commuter',         g:'🇯🇵', t:['RAC','沖縄','りゅうきゅう'],                            f:'airlines/rac.html'},
    {n:'北海道エアシステム',     e:'Hokkaido Air System',         g:'🇯🇵', t:['HAC','NTH','北海道','ほっかいどう'],                    f:'airlines/hac.html'},
    {n:'ANAウイングス',          e:'ANA Wings',                   g:'🇯🇵', t:['AKX','EH','ANAウィングス'],                            f:'airlines/ana-wings.html'},
    {n:'エアジャパン',           e:'Air Japan',                   g:'🇯🇵', t:['AJX','エアージャパン'],                                 f:'airlines/airjapan.html'},
    {n:'エア・ドゥ',             e:'AirDo',                       g:'🇯🇵', t:['ADO','HD','北海道国際航空','えあどぅ'],                  f:'airlines/airdo.html'},
    {n:'ソラシドエア',           e:'Solaseed Air',                g:'🇯🇵', t:['VJ','SNJ','そらしど','九州'],                           f:'airlines/solaseed.html'},
    {n:'スターフライヤー',       e:'Star Flyer',                  g:'🇯🇵', t:['SFJ','7G','StarFlyer','北九州'],                       f:'airlines/starflyer.html'},
    {n:'フジドリームエアラインズ',e:'Fuji Dream Airlines',        g:'🇯🇵', t:['FDA','ふじどりーむ','静岡'],                            f:'airlines/fda.html'},
    {n:'アイベックスエアラインズ',e:'Ibex Airlines',              g:'🇯🇵', t:['IBX','FW','アイベックス','仙台'],                       f:'airlines/ibex.html'},
    {n:'トキエア',               e:'Toki Air',                    g:'🇯🇵', t:['TKI','とき','新潟'],                                   f:'airlines/toki-air.html'},
    {n:'オリエンタルエアブリッジ',e:'Oriental Air Bridge',        g:'🇯🇵', t:['ORC','長崎','おりえんたる'],                            f:'airlines/orc.html'},
    {n:'天草エアライン',         e:'Amakusa Airlines',            g:'🇯🇵', t:['AMX','MZ','あまくさ','天草'],                           f:'airlines/amx.html'},
    {n:'新中央航空',             e:'Shin Central Air',            g:'🇯🇵', t:['SCA','しんちゅうおう'],                                 f:'airlines/shin-central.html'},
    {n:'東邦エア',               e:'Toho Air',                    g:'🇯🇵', t:['THA','とうほう'],                                      f:'airlines/toho-air.html'},
    {n:'第一航空',               e:'Daiichi Air',                 g:'🇯🇵', t:['DAI','だいいち'],                                      f:'airlines/daiichi-air.html'},
    {n:'新日本航空',             e:'Shin Nihon Airlines',         g:'🇯🇵', t:['SNA','しんにほん'],                                    f:'airlines/shin-nihon.html'},
    /* ─ Americas — US ─ */
    {n:'デルタ航空',             e:'Delta Air Lines',             g:'🇺🇸', t:['DAL','DL','delta','でるた'],                           f:'airlines/delta.html'},
    {n:'ユナイテッド航空',       e:'United Airlines',             g:'🇺🇸', t:['UAL','UA','united','ゆないてっど'],                     f:'airlines/united.html'},
    {n:'アメリカン航空',         e:'American Airlines',           g:'🇺🇸', t:['AAL','AA','american','あめりかん'],                    f:'airlines/american.html'},
    {n:'サウスウエスト航空',     e:'Southwest Airlines',          g:'🇺🇸', t:['WN','southwest','さうすうえすと'],                     f:'airlines/southwest.html'},
    {n:'アラスカ航空',           e:'Alaska Airlines',             g:'🇺🇸', t:['ASA','AS','alaska','あらすか'],                        f:'airlines/alaska-airlines.html'},
    {n:'ジェットブルー',         e:'JetBlue Airways',             g:'🇺🇸', t:['B6','jetblue','じぇっとぶるー'],                       f:'airlines/jetblue.html'},
    {n:'スピリット航空',         e:'Spirit Airlines',             g:'🇺🇸', t:['NK','spirit'],                                         f:'airlines/spirit.html'},
    {n:'フロンティア航空',       e:'Frontier Airlines',           g:'🇺🇸', t:['F9','frontier'],                                       f:'airlines/frontier.html'},
    {n:'アレジアント航空',       e:'Allegiant Air',               g:'🇺🇸', t:['G4','allegiant'],                                      f:'airlines/allegiant.html'},
    {n:'ブリーズ航空',           e:'Breeze Airways',              g:'🇺🇸', t:['MX','breeze'],                                         f:'airlines/breeze-airways.html'},
    /* ─ Americas — Canada/Latin ─ */
    {n:'エアカナダ',             e:'Air Canada',                  g:'🇨🇦', t:['ACA','AC','あえかなだ','カナダ'],                      f:'airlines/air-canada.html'},
    {n:'ウエストジェット',       e:'WestJet',                     g:'🇨🇦', t:['WJA','WS'],                                            f:'airlines/westjet.html'},
    {n:'ポーターエアラインズ',   e:'Porter Airlines',             g:'🇨🇦', t:['POE','PD'],                                            f:'airlines/porter.html'},
    {n:'アエロメヒコ航空',       e:'Aeromexico',                  g:'🇲🇽', t:['AM','AMX','メキシコ'],                                  f:'airlines/aeromexico.html'},
    {n:'アビアンカ航空',         e:'Avianca',                     g:'🇨🇴', t:['AV','AVA','コロンビア'],                                f:'airlines/avianca.html'},
    {n:'コパ航空',               e:'Copa Airlines',               g:'🇵🇦', t:['CM','CMP','パナマ'],                                   f:'airlines/copa-airlines.html'},
    {n:'ラタム航空',             e:'LATAM Airlines',              g:'🇨🇱', t:['LA','LAN','らたむ'],                                   f:'airlines/latam.html'},
    /* ─ Middle East ─ */
    {n:'エミレーツ航空',         e:'Emirates',                    g:'🇦🇪', t:['EK','UAE','えみれーつ','ドバイ','Dubai'],              f:'airlines/emirates.html'},
    {n:'カタール航空',           e:'Qatar Airways',               g:'🇶🇦', t:['QR','QTR','かたーる','Qatar'],                        f:'airlines/qatar-airways.html'},
    {n:'エティハド航空',         e:'Etihad Airways',              g:'🇦🇪', t:['EY','ETD','えてぃはど','アブダビ'],                    f:'airlines/etihad.html'},
    {n:'リヤドエア',             e:'Riyadh Air',                  g:'🇸🇦', t:['RX','サウジ','りやど'],                                f:'airlines/riyadh-air.html'},
    {n:'サウジアラビア航空',     e:'Saudia',                      g:'🇸🇦', t:['SV','SaudiArabian','さうでぃ'],                       f:'airlines/saudia.html'},
    {n:'ガルフエア',             e:'Gulf Air',                    g:'🇧🇭', t:['GF','GFA','バーレーン'],                               f:'airlines/gulf-air.html'},
    {n:'オマーン航空',           e:'Oman Air',                    g:'🇴🇲', t:['WY','OAS','おまーん'],                                 f:'airlines/oman-air.html'},
    {n:'クウェート航空',         e:'Kuwait Airways',              g:'🇰🇼', t:['KAC','KU','くうぇーと'],                              f:'airlines/kuwait-airways.html'},
    {n:'ロイヤルヨルダン',       e:'Royal Jordanian',             g:'🇯🇴', t:['RJA','RJ','ヨルダン'],                                f:'airlines/royal-jordanian.html'},
    /* ─ Africa ─ */
    {n:'エジプト航空',           e:'EgyptAir',                    g:'🇪🇬', t:['MS','MSR','えじぷと'],                                 f:'airlines/egyptair.html'},
    {n:'エチオピア航空',         e:'Ethiopian Airlines',          g:'🇪🇹', t:['ET','ETH','えちおぴあ'],                               f:'airlines/ethiopian-airlines.html'},
    {n:'ケニア航空',             e:'Kenya Airways',               g:'🇰🇪', t:['KQ','KQA','けにあ'],                                  f:'airlines/kenya-airways.html'},
    {n:'南アフリカ航空',         e:'South African Airways',       g:'🇿🇦', t:['SA','SAA','みなみあふりか'],                           f:'airlines/south-african-airways.html'},
    /* ─ Asia — Northeast ─ */
    {n:'シンガポール航空',       e:'Singapore Airlines',          g:'🇸🇬', t:['SQ','SIA','しんがぽーる','Singapore'],                f:'airlines/singapore-airlines.html'},
    {n:'キャセイパシフィック航空',e:'Cathay Pacific',             g:'🇭🇰', t:['CX','CPA','キャセイ','かせい','香港','HongKong'],     f:'airlines/cathay-pacific.html'},
    {n:'大韓航空',               e:'Korean Air',                  g:'🇰🇷', t:['KE','KAL','だいかん','韓国','Korea'],                 f:'airlines/korean-air.html'},
    {n:'アシアナ航空',           e:'Asiana Airlines',             g:'🇰🇷', t:['OZ','AAR','あしあな','韓国','Korea'],                 f:'airlines/asiana.html'},
    {n:'中国国際航空',           e:'Air China',                   g:'🇨🇳', t:['CA','CCA','エアチャイナ','中国','China'],             f:'airlines/air-china.html'},
    {n:'中国東方航空',           e:'China Eastern Airlines',      g:'🇨🇳', t:['MU','CES','チャイナイースタン'],                      f:'airlines/china-eastern.html'},
    {n:'中国南方航空',           e:'China Southern Airlines',     g:'🇨🇳', t:['CZ','CSN','チャイナサザン'],                          f:'airlines/china-southern.html'},
    {n:'チャイナエアライン',     e:'China Airlines',              g:'🇹🇼', t:['CI','CAL','台湾','Taiwan'],                           f:'airlines/china-airlines.html'},
    {n:'エバー航空',             e:'EVA Air',                     g:'🇹🇼', t:['BR','EVA','えばー','台湾'],                            f:'airlines/eva-air.html'},
    {n:'スターラックス航空',     e:'StarLux Airlines',            g:'🇹🇼', t:['JX','StarLux','すたーらっくす'],                     f:'airlines/starlux.html'},
    {n:'香港エクスプレス',       e:'Hong Kong Express',           g:'🇭🇰', t:['UO','HKExpress','香港'],                             f:'airlines/hong-kong-express.html'},
    {n:'海南航空',               e:'Hainan Airlines',             g:'🇨🇳', t:['HU','HXA','はいなん'],                                f:'airlines/hainan-airlines.html'},
    /* ─ Asia — Southeast/South ─ */
    {n:'エアインディア',         e:'Air India',                   g:'🇮🇳', t:['AI','AIC','インド','India'],                          f:'airlines/air-india.html'},
    {n:'インディゴ',             e:'IndiGo',                      g:'🇮🇳', t:['6E','IGO','インド'],                                  f:'airlines/indigo.html'},
    {n:'ガルーダ・インドネシア', e:'Garuda Indonesia',            g:'🇮🇩', t:['GA','GIA','ガルーダ','インドネシア'],                  f:'airlines/garuda-indonesia.html'},
    {n:'マレーシア航空',         e:'Malaysia Airlines',           g:'🇲🇾', t:['MH','MAS','マレーシア'],                              f:'airlines/malaysia-airlines.html'},
    {n:'タイ国際航空',           e:'Thai Airways',                g:'🇹🇭', t:['TG','THA','タイ','Thailand'],                        f:'airlines/thai-airways.html'},
    {n:'ベトナム航空',           e:'Vietnam Airlines',            g:'🇻🇳', t:['VN','HVN','ベトナム'],                                f:'airlines/vietnam-airlines.html'},
    {n:'ビエットジェット',       e:'VietJet Air',                 g:'🇻🇳', t:['VJ','VJC','ベトナム'],                                f:'airlines/vietjet.html'},
    {n:'フィリピン航空',         e:'Philippine Airlines',         g:'🇵🇭', t:['PR','PAL','フィリピン'],                              f:'airlines/philippine-airlines.html'},
    {n:'エアアジア',             e:'AirAsia',                     g:'🇲🇾', t:['AK','AAX','えああじあ'],                              f:'airlines/airasia.html'},
    {n:'スクート',               e:'Scoot',                       g:'🇸🇬', t:['TR','TGW','すくーと'],                                f:'airlines/scoot.html'},
    {n:'バティックエア',         e:'Batik Air',                   g:'🇮🇩', t:['ID','BTK','ばてぃっく'],                              f:'airlines/batik-air.html'},
    {n:'バンブー・エアウェイズ', e:'Bamboo Airways',              g:'🇻🇳', t:['QH','BAV','バンブー'],                                f:'airlines/bamboo-airways.html'},
    {n:'ロイヤルブルネイ航空',   e:'Royal Brunei Airlines',       g:'🇧🇳', t:['BI','RBA','ブルネイ'],                                f:'airlines/royal-brunei.html'},
    {n:'フィジー・エアウェイズ', e:'Fiji Airways',                g:'🇫🇯', t:['FJ','FAJ','フィジー'],                               f:'airlines/fiji-airways.html'},
    /* ─ Europe — Major ─ */
    {n:'ルフトハンザ航空',       e:'Lufthansa',                   g:'🇩🇪', t:['LH','LHA','ルフトハンザ','ドイツ','Germany'],        f:'airlines/lufthansa.html'},
    {n:'エールフランス',         e:'Air France',                  g:'🇫🇷', t:['AF','AFR','えーるふらんす','フランス','France'],     f:'airlines/air-france.html'},
    {n:'ブリティッシュ・エアウェイズ',e:'British Airways',        g:'🇬🇧', t:['BA','BAW','ブリティッシュ','イギリス','UK'],         f:'airlines/british-airways.html'},
    {n:'KLMオランダ航空',        e:'KLM Royal Dutch Airlines',    g:'🇳🇱', t:['KL','KLM','オランダ','Netherlands'],                 f:'airlines/klm.html'},
    {n:'スイス国際航空',         e:'Swiss International Air Lines',g:'🇨🇭', t:['LX','SWR','swiss','スイス','Switzerland'],          f:'airlines/swiss.html'},
    {n:'ターキッシュ エアラインズ',e:'Turkish Airlines',          g:'🇹🇷', t:['TK','THY','トルコ','Turkey','ターキッシュ'],         f:'airlines/turkish-airlines.html'},
    {n:'スカンジナビア航空',     e:'SAS',                         g:'🇸🇪', t:['SK','SAS','スカンジナビア'],                          f:'airlines/sas.html'},
    {n:'ノルウェジアン航空',     e:'Norwegian Air Shuttle',       g:'🇳🇴', t:['DY','NAX','ノルウェジアン'],                         f:'airlines/norwegian.html'},
    {n:'フィンエアー',           e:'Finnair',                     g:'🇫🇮', t:['AY','FIN','ふぃんえあー','フィンランド'],             f:'airlines/finnair.html'},
    {n:'エアリンガス',           e:'Aer Lingus',                  g:'🇮🇪', t:['EI','EIN','アイルランド','Ireland'],                  f:'airlines/aer-lingus.html'},
    {n:'イベリア航空',           e:'Iberia Airlines',             g:'🇪🇸', t:['IB','IBE','スペイン','Spain'],                        f:'airlines/iberia.html'},
    {n:'TAPエアポルトガル',      e:'TAP Air Portugal',            g:'🇵🇹', t:['TP','TAP','ポルトガル'],                              f:'airlines/tap.html'},
    {n:'エーゲ航空',             e:'Aegean Airlines',             g:'🇬🇷', t:['A3','AEE','ギリシャ','Greece'],                       f:'airlines/aegean.html'},
    {n:'LOTポーランド航空',      e:'LOT Polish Airlines',         g:'🇵🇱', t:['LO','LOT','ポーランド'],                              f:'airlines/lot.html'},
    {n:'オーストリア航空',       e:'Austrian Airlines',           g:'🇦🇹', t:['OS','AUA','オーストリア'],                            f:'airlines/austrian.html'},
    {n:'ITAエアウェイズ',        e:'ITA Airways',                 g:'🇮🇹', t:['AZ','ITA','イタリア','Italy','Alitalia','アリタリア'],f:'airlines/ita-airways.html'},
    {n:'ブエリング航空',         e:'Vueling Airlines',            g:'🇪🇸', t:['VY','VLG','ぶえりんぐ'],                              f:'airlines/vueling.html'},
    {n:'アイスランド航空',       e:'Icelandair',                  g:'🇮🇸', t:['FI','ICE','アイスランド'],                            f:'airlines/icelandair.html'},
    {n:'ウィズエア',             e:'Wizz Air',                    g:'🇭🇺', t:['W6','WZZ','ウィズ'],                                  f:'airlines/wizz-air.html'},
    {n:'ライアンエア',           e:'Ryanair',                     g:'🇮🇪', t:['FR','RYR','らいあん'],                                f:'airlines/ryanair.html'},
    {n:'イージージェット',       e:'easyJet',                     g:'🇬🇧', t:['U2','EZY','いーじー'],                                f:'airlines/easyjet.html'},
    {n:'ユーロウイングス',       e:'Eurowings',                   g:'🇩🇪', t:['EW','EWG','ユーロウイングス','ドイツ','Germany'],      f:'airlines/eurowings.html'},
    {n:'ヴァージン・アトランティック',e:'Virgin Atlantic',        g:'🇬🇧', t:['VS','VIR','ヴァージン','バージン'],                   f:'airlines/virgin-atlantic.html'},
    /* ─ Oceania ─ */
    {n:'カンタス航空',           e:'Qantas Airways',              g:'🇦🇺', t:['QF','QFA','カンタス','Australia','オーストラリア'],  f:'airlines/qantas.html'},
    {n:'ニュージーランド航空',   e:'Air New Zealand',             g:'🇳🇿', t:['NZ','ANZ','ニュージーランド'],                        f:'airlines/air-new-zealand.html'},
    {n:'ジェットスター（豪州）', e:'Jetstar Airways',             g:'🇦🇺', t:['JQ','JST','ジェットスター'],                          f:'airlines/jetstar.html'},
  ];
  window.PV_DB = DB;

  /* ── Normalize for matching ── */
  function norm(s) {
    return (s||'').toLowerCase()
      .replace(/\s+|　/g,'')
      .replace(/ー/g,'')           // ignore long vowel mark in katakana
      .replace(/（[^）]*）/g,'');  // strip bracketed content like (ANA)
  }

  /* ── Search ── */
  function doSearch(q) {
    if (!q || q.length < 1) return [];
    var nq = norm(q);
    return DB.filter(function(a) {
      return norm(a.n).includes(nq) ||
             norm(a.e).includes(nq) ||
             a.t.some(function(t){ return norm(t).includes(nq) || t.toLowerCase().includes(q.toLowerCase()); });
    }).slice(0, 9);
  }

  /* ── Highlight match ── */
  function hl(text, q) {
    if (!q) return text;
    try {
      return text.replace(
        new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi'),
        '<mark>$1</mark>'
      );
    } catch(e) { return text; }
  }

  /* ── Inject styles ── */
  var style = document.createElement('style');
  style.textContent = [
    '#pv-search-wrap{position:relative;display:flex;align-items:center}',
    /* toggle button */
    '#pv-search-btn{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.12);cursor:pointer;transition:background .2s,color .2s;flex-shrink:0}',
    '#pv-search-btn:hover{background:rgba(255,255,255,.13);color:#fff}',
    '[data-theme=light] #pv-search-btn{background:rgba(0,0,0,.06);color:rgba(15,23,42,.6);border-color:rgba(0,0,0,.12)}',
    '[data-theme=light] #pv-search-btn:hover{background:rgba(0,0,0,.1);color:#0f172a}',
    /* input box */
    '#pv-search-box{display:flex;align-items:center;gap:6px;background:rgba(17,22,32,.97);border:1px solid rgba(61,155,255,.35);border-radius:10px;padding:0 10px;height:36px;width:260px}',
    '[data-theme=light] #pv-search-box{background:#fff;border-color:rgba(61,155,255,.4);box-shadow:0 2px 12px rgba(61,155,255,.12)}',
    '#pv-search-input{background:none;border:none;outline:none;color:#e8edf2;font-size:.83rem;width:100%;font-family:inherit}',
    '[data-theme=light] #pv-search-input{color:#0f172a}',
    '#pv-search-input::placeholder{color:#4e5f73;font-size:.78rem}',
    '#pv-search-close{background:none;border:none;color:#4e5f73;cursor:pointer;font-size:.85rem;padding:0;line-height:1;flex-shrink:0;transition:color .15s}',
    '#pv-search-close:hover{color:#e8edf2}',
    '[data-theme=light] #pv-search-close:hover{color:#0f172a}',
    /* dropdown — position set via JS to avoid Safari backdrop-filter containment */
    '#pv-search-dd{position:fixed;width:320px;background:rgba(11,15,23,.98);border:1px solid rgba(255,255,255,.1);border-radius:14px;overflow:hidden;box-shadow:0 20px 48px rgba(0,0,0,.55);z-index:99999}',
    '[data-theme=light] #pv-search-dd{background:#fff;border-color:rgba(0,0,0,.1);box-shadow:0 8px 32px rgba(0,0,0,.14)}',
    '.pv-si{display:flex;align-items:center;gap:10px;padding:10px 14px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.04);transition:background .1s}',
    '[data-theme=light] .pv-si{border-bottom-color:rgba(0,0,0,.04)}',
    '.pv-si:last-child{border-bottom:none}',
    '.pv-si:hover,.pv-si.active{background:rgba(61,155,255,.13)}',
    '[data-theme=light] .pv-si:hover,[data-theme=light] .pv-si.active{background:rgba(61,155,255,.08)}',
    '.pv-si-flag{font-size:1.15rem;flex-shrink:0;line-height:1}',
    '.pv-si-ja{font-size:.83rem;font-weight:600;color:#e8edf2;line-height:1.3}',
    '[data-theme=light] .pv-si-ja{color:#0f172a}',
    '.pv-si-en{font-size:.7rem;color:#6b7d93;margin-top:2px}',
    '.pv-si mark{background:rgba(245,200,66,.22);color:#f5c842;border-radius:2px;padding:0 1px;font-style:normal}',
    '[data-theme=light] .pv-si mark{background:rgba(160,114,0,.14);color:#92690a}',
    '.pv-search-empty{padding:16px 14px;font-size:.8rem;color:#6b7d93;text-align:center}',
    /* mobile — expand wrap only when open; dropdown always full-width */
    '@media(max-width:640px){#pv-search-wrap.open{flex:1;min-width:0;margin-left:4px}#pv-search-box{width:100%!important;height:40px;box-sizing:border-box}#pv-search-dd{left:8px!important;right:8px!important;width:auto!important}}',
  ].join('');
  document.head.appendChild(style);

  /* ── State ── */
  var activeIdx = -1;
  var lastResults = [];

  /* ── Build UI ── */
  function buildUI() {
    var nav = document.getElementById('main-nav');
    if (!nav || document.getElementById('pv-search-wrap')) return;

    /* Get the rightmost .flex.items-center.gap-3 in the nav */
    var all = nav.querySelectorAll('.flex.items-center.gap-3');
    var right = all[all.length - 1];
    if (!right) return;

    var wrap = document.createElement('div');
    wrap.id = 'pv-search-wrap';

    var btn = document.createElement('button');
    btn.id = 'pv-search-btn';
    btn.setAttribute('aria-label',T('航空会社を検索'));
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>';

    var box = document.createElement('div');
    box.id = 'pv-search-box';
    box.style.display = 'none';
    box.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4e5f73" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
      '<input id="pv-search-input" type="text" placeholder="' + T('航空会社を検索…') + '" autocomplete="off" spellcheck="false"/>' +
      '<button id="pv-search-close" aria-label="' + T('閉じる') + '">✕</button>';

    var dd = document.createElement('div');
    dd.id = 'pv-search-dd';
    dd.style.display = 'none';

    wrap.appendChild(btn);
    wrap.appendChild(box);
    document.body.appendChild(dd);   // outside nav to avoid Safari backdrop-filter containment
    right.insertBefore(wrap, right.firstChild);

    btn.addEventListener('click', openSearch);
    document.getElementById('pv-search-close').addEventListener('click', closeSearch);
    document.getElementById('pv-search-input').addEventListener('input', onInput);
    document.getElementById('pv-search-input').addEventListener('keydown', onKeydown);
    document.addEventListener('click', onOutside);
  }

  function positionDD() {
    var box = document.getElementById('pv-search-box');
    var dd  = document.getElementById('pv-search-dd');
    if (!box || !dd) return;
    var rect = box.getBoundingClientRect();
    var vw = window.innerWidth;
    dd.style.top = (rect.bottom + 6) + 'px';
    // Desktop only: align right edge to search box. Mobile handled by CSS !important.
    if (window.screen.width > 500 && vw > 640) {
      dd.style.left  = 'auto';
      dd.style.right = Math.max(8, vw - rect.right) + 'px';
      dd.style.width = '320px';
    }
  }

  function openSearch() {
    document.getElementById('pv-search-wrap').classList.add('open');
    document.getElementById('pv-search-btn').style.display = 'none';
    document.getElementById('pv-search-box').style.display = 'flex';
    setTimeout(function(){ document.getElementById('pv-search-input').focus(); }, 10);
  }

  function closeSearch() {
    document.getElementById('pv-search-wrap').classList.remove('open');
    document.getElementById('pv-search-btn').style.display = '';
    document.getElementById('pv-search-box').style.display = 'none';
    document.getElementById('pv-search-dd').style.display = 'none';
    document.getElementById('pv-search-input').value = '';
    activeIdx = -1;
    lastResults = [];
  }

  function onInput(e) {
    activeIdx = -1;
    var q = e.target.value.trim();
    lastResults = doSearch(q);
    renderDD(lastResults, q);
  }

  function renderDD(results, q) {
    var dd = document.getElementById('pv-search-dd');
    if (!q) { dd.style.display = 'none'; return; }
    if (!results.length) {
      dd.innerHTML = '<div class="pv-search-empty">' + (IS_EN
        ? 'No airlines match “' + q + '”'
        : '「' + q + '」に一致する航空会社は見つかりません') + '</div>';
      positionDD();
      dd.style.display = 'block';
      return;
    }
    dd.innerHTML = results.map(function(a, i) {
      return '<a class="pv-si" href="' + P + a.f + '">' +
        '<span class="pv-si-flag">' + a.g + '</span>' +
        '<div>' +
          '<div class="pv-si-ja">' + hl(IS_EN ? a.e : a.n, q) + '</div>' +
          '<div class="pv-si-en">' + hl(IS_EN ? a.n : a.e, q) + '</div>' +
        '</div>' +
      '</a>';
    }).join('');
    positionDD();
    dd.style.display = 'block';
    setActive(-1);
  }

  function setActive(idx) {
    var items = document.querySelectorAll('#pv-search-dd .pv-si');
    items.forEach(function(el, i) { el.classList.toggle('active', i === idx); });
    activeIdx = idx;
  }

  function onKeydown(e) {
    var items = document.querySelectorAll('#pv-search-dd .pv-si');
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0 && items[activeIdx]) {
      items[activeIdx].click();
    }
  }

  function onOutside(e) {
    var wrap = document.getElementById('pv-search-wrap');
    var dd   = document.getElementById('pv-search-dd');
    if (wrap && !wrap.contains(e.target) && (!dd || !dd.contains(e.target))) closeSearch();
  }

  /* ── Init ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }
})();

/* ═══════════════════════════════════════════════════
   PILOT VALUE — Hamburger / Mobile Drawer
   ═══════════════════════════════════════════════════ */
(function(){
  /* ── /en/ 配下はルートより 1 階層深い ──────────────────────────
     P      … 現在の言語ディレクトリまで（/en/ 内なら /en/… に解決）
     ROOT_P … サイトルートまで（共有アセットと、EN 版が無いページ用）
     pageHref() … EN 版が実在するトップ級ページだけ言語内リンク、他はルート（日本語版）へ退避。
     実在リストは lang-toggle.js が生成する PV_EN_PAGES を唯一の正として参照する。 */
  var IS_EN  = location.pathname.indexOf('/en/') === 0;
  /* ⚠️ 以前は /airlines/ だけを見ていた。あとから増えた /countries/ では
        引き出しのロゴ画像とリンクの行き先が1階層ずれる（画像が出ない）。
        決め打ちをやめて、いま居る階層を数える。 */
  var P = (function () {
    var segs = location.pathname.replace(/[^/]*$/, '').split('/').filter(Boolean);
    if (IS_EN) segs.shift();
    return segs.map(function () { return '../'; }).join('');
  }());
  var ROOT_P = P + (IS_EN ? '../' : '');
  function pageHref(f) {
    if (!IS_EN) return P + f;
    var base = f.split('#')[0];
    if (base === 'index.html') return P + f;          // /en/index.html は常に存在
    var set = window.PV_EN_PAGES;
    return (set && set.has(base)) ? P + f : ROOT_P + f;
  }
  function T(s) { return IS_EN && PV_SEARCH_L10N[s] ? PV_SEARCH_L10N[s] : s; }

  function inject() {
    if (document.getElementById('pv-ham-btn')) return;
    var nav = document.getElementById('main-nav');
    if (!nav) return;

    var s = document.createElement('style');
    s.textContent = [
      '.pv-ham-btn{display:none;flex-direction:column;justify-content:center;align-items:center;width:38px;height:38px;gap:5px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;cursor:pointer;transition:background .2s;flex-shrink:0;padding:0}',
      '.pv-ham-btn:hover{background:rgba(255,255,255,.13)}',
      '[data-theme=light] .pv-ham-btn{background:rgba(0,0,0,.06);border-color:rgba(0,0,0,.12)}',
      '[data-theme=light] .pv-ham-btn:hover{background:rgba(0,0,0,.11)}',
      '.pv-ham-line{width:18px;height:1.8px;border-radius:1px;background:rgba(255,255,255,.75);transition:transform .3s,opacity .3s;display:block}',
      '[data-theme=light] .pv-ham-line{background:rgba(15,23,42,.7)}',
      '#pv-nav-overlay{position:fixed;inset:0;z-index:190;background:rgba(0,0,0,.55);opacity:0;pointer-events:none;transition:opacity .3s}',
      '#pv-nav-overlay.open{opacity:1;pointer-events:all}',
      '#pv-nav-drawer{position:fixed;top:0;right:0;bottom:0;z-index:195;width:270px;max-width:82vw;background:#0d1117;border-left:1px solid rgba(255,255,255,.08);transform:translateX(100%);transition:transform .35s cubic-bezier(.16,1,.3,1);overflow-y:auto}',
      '[data-theme=light] #pv-nav-drawer{background:#f4f6f9;border-left-color:rgba(0,0,0,.09)}',
      '#pv-nav-drawer.open{transform:translateX(0)}',
      '.pv-nd-head{display:flex;align-items:center;justify-content:space-between;height:72px;padding:0 20px;border-bottom:1px solid rgba(255,255,255,.07)}',
      '[data-theme=light] .pv-nd-head{border-bottom-color:rgba(0,0,0,.08)}',
      '.pv-nd-logo{height:30px;width:auto}',
      '.pv-nd-close{width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .2s;flex-shrink:0}',
      '[data-theme=light] .pv-nd-close{background:rgba(0,0,0,.06);border-color:rgba(0,0,0,.1);color:rgba(15,23,42,.6)}',
      '.pv-nd-close:hover{background:rgba(255,255,255,.13)}',
      '.pv-nd-links{padding:8px 0}',
      '.pv-nd-link{display:flex;align-items:center;padding:15px 24px;font-size:.95rem;font-weight:600;color:rgba(255,255,255,.75);text-decoration:none;border-bottom:1px solid rgba(255,255,255,.05);transition:background .15s,color .15s}',
      '[data-theme=light] .pv-nd-link{color:rgba(15,23,42,.75);border-bottom-color:rgba(0,0,0,.06)}',
      '.pv-nd-link:hover{background:rgba(255,255,255,.05);color:#fff}',
      '[data-theme=light] .pv-nd-link:hover{background:rgba(0,0,0,.04);color:#0f172a}',
      '.pv-nd-login{display:block;margin:16px 20px;padding:13px;border-radius:10px;text-align:center;font-size:.9rem;font-weight:700;text-decoration:none;background:linear-gradient(135deg,rgba(249,115,22,.1),rgba(245,200,66,.1));border:1px solid rgba(245,200,66,.28);color:#f5c842;transition:background .2s}',
      '[data-theme=light] .pv-nd-login{color:#a07200;border-color:rgba(160,114,0,.28);background:rgba(160,114,0,.07)}',
      '.pv-nd-login:hover{background:linear-gradient(135deg,rgba(249,115,22,.2),rgba(245,200,66,.2))}',
      '.pv-nd-sep{height:1px;margin:8px 20px;background:rgba(255,255,255,.09)}',
      '[data-theme=light] .pv-nd-sep{background:rgba(0,0,0,.09)}',
      '.pv-nd-cta{display:block;margin:16px 20px 4px;padding:13px;border-radius:10px;text-align:center;font-size:.9rem;font-weight:700;text-decoration:none;background:linear-gradient(135deg,#f5c842,#f97316);color:#000;transition:opacity .2s}',
      '.pv-nd-cta:hover{opacity:.88}',
      /* ── ヘッダーが入らないときに畳む（class は下の fit() が付ける）──────
         幅が足りないとき、いままでは文字のほうが2行に折れて逃げ、ロゴに重なり、
         英語版は画面の外へ出ていた。折らせない代わりに、入らないぶんを ≡ へ移す。
         段① リンク群 → 段② ログイン/← 戻る → 段③ CTA（CTA が最後まで残る）。 */
      '#main-nav .nav-link,#main-nav .btn-ghost,#main-nav .btn-primary,#main-nav .btn-orange,#main-nav #nav-auth-btn{white-space:nowrap}',
      /* ロゴまで縮む対象だった。世界の航空会社一覧の 390px ではロゴの幅が 0 になり、
         航空会社ページの 900px ではロゴが 29px 潰れて「入っているように見えて」いた。 */
      '#main-nav>div>*,#main-nav .pv-nav-right>*{flex-shrink:0}',
      '#main-nav.pv-nav-compact .pv-nav-links{display:none!important}',
      '#main-nav.pv-nav-compact .pv-ham-btn{display:flex}',
      '#main-nav.pv-nav-tight .pv-nav-2nd{display:none!important}',
      '#main-nav.pv-nav-min .pv-nav-cta{display:none!important}',
      '#main-nav.pv-nav-min>div{padding-left:16px;padding-right:16px}',
      '#main-nav.pv-nav-min .pv-nav-right{gap:8px}',
      '@media(max-width:767px){.pv-ham-btn{display:flex}}',
    ].join('');
    document.head.appendChild(s);

    var overlay = document.createElement('div');
    overlay.id = 'pv-nav-overlay';
    document.body.appendChild(overlay);

    var drawer = document.createElement('div');
    drawer.id = 'pv-nav-drawer';
    drawer.innerHTML =
      '<div class="pv-nd-head">' +
        '<a href="' + pageHref('index.html') + '"><img src="' + ROOT_P + 'assets/logo.png" alt="PILOT VALUE" class="pv-nd-logo"/></a>' +
  '' +
      '</div>' +
      '<div class="pv-nd-links">' +
        '<a href="' + pageHref('world-airlines.html') + '" class="pv-nd-link">' + T('\u4e16\u754c\u306e\u822a\u7a7a\u4f1a\u793e') + '</a>' +
        '<a href="' + pageHref('index.html#compare') + '" class="pv-nd-link">' + T('\u65e5\u672c vs \u6d77\u5916') + '</a>' +
        '<a href="' + pageHref('index.html#ranking') + '" class="pv-nd-link">' + T('\u5e74\u53ce\u30e9\u30f3\u30ad\u30f3\u30b0') + '</a>' +
        '<a href="' + pageHref('index.html#jobs') + '" class="pv-nd-link">' + T('\u6c42\u4eba\u60c5\u5831') + '</a>' +
        '<a href="' + pageHref('community.html') + '" class="pv-nd-link">' + T('\u30b3\u30df\u30e5\u30cb\u30c6\u30a3') + '</a>' +
        '<a href="' + pageHref('contact.html') + '" class="pv-nd-link" style="color:#3d9bff">' + T('\u304a\u554f\u3044\u5408\u308f\u305b') + '</a>' +
      '</div>' +
      '<a href="' + pageHref('login.html') + '" class="pv-nd-login" id="pv-nd-login-lnk">' + T('\u30ed\u30b0\u30a4\u30f3') + '</a>';
    document.body.appendChild(drawer);

    /* ── 引き出しに「そのページ自身のリンク」を入れる ──────────────────
       引き出しは長らく全ページ共通の5本だけで、トップの「実際の給与」「口コミ」
       「Give & Get」「給与レンジ112社」へ行く道がスマホから無かった。
       ヘッダーを畳むと PC でも同じことが起きるので、畳む前にここへ写しておく。
       ⚠️ 国別年収（countries.html）は入れない（オーナー判断 2026-08-19）。
          行き先が共通5本と同じときは、そのページの言い方を優先する
          （航空会社ページの「最新の口コミ」が「コミュニティ」に化けないため）。 */
    (function () {
      var box = drawer.querySelector('.pv-nd-links');
      if (!box) return;
      function key(a) {
        try {
          var u = new URL(a.getAttribute('href'), location.href);
          return u.pathname.replace(/\/index\.html$/, '/') + u.hash;
        } catch (e) { return ''; }
      }
      var have = {}, add = [];
      [].forEach.call(box.querySelectorAll('.pv-nd-link'), function (a) { have[key(a)] = a; });
      [].forEach.call(nav.querySelectorAll('a.nav-link'), function (a) {
        var k = key(a), txt = (a.textContent || '').trim();
        if (!k || !txt) return;
        if (/countries\.html$/.test(k.split('#')[0])) return;   /* ★国別年収は入れない */
        if (have[k]) { have[k].textContent = txt; return; }      /* 同じ行き先＝言い方だけ寄せる */
        var el = document.createElement('a');
        el.className = 'pv-nd-link';
        el.href = a.getAttribute('href');
        el.textContent = txt;
        have[k] = el;
        add.push(el);
      });
      if (add.length) {
        var sep = document.createElement('div');
        sep.className = 'pv-nd-sep';
        box.insertBefore(sep, box.firstChild);
        add.reverse().forEach(function (el) { box.insertBefore(el, box.firstChild); });
      }
      /* ヘッダーの CTA を引き出しの先頭にも置く。
         いちばん狭いところ（段③）でヘッダーから CTA が消えても、
         「出す」道が1つも無い画面にならないようにする。 */
      var cta = nav.querySelector('.btn-primary, .btn-orange');
      if (cta) {
        var c = document.createElement('a');
        c.className = 'pv-nd-cta';
        c.href = cta.getAttribute('href');
        c.textContent = (cta.textContent || '').trim();
        c.setAttribute('data-pv-ev', 'nav_drawer_cta');
        drawer.insertBefore(c, drawer.querySelector('.pv-nd-links'));
      }
    }());

    var btn = document.createElement('button');
    btn.className = 'pv-ham-btn';
    btn.id = 'pv-ham-btn';
    btn.setAttribute('aria-label', '\u30e1\u30cb\u30e5\u30fc');
    btn.innerHTML = '<span class="pv-ham-line"></span><span class="pv-ham-line"></span><span class="pv-ham-line"></span>';

    var rights = nav.querySelectorAll('.flex.items-center');
    var right = rights[rights.length - 1];
    if (right) right.appendChild(btn);

    function openD() { drawer.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function closeD() { drawer.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; }

    btn.addEventListener('click', function(){ drawer.classList.contains('open') ? closeD() : openD(); });
    overlay.addEventListener('click', closeD);
    drawer.querySelectorAll('.pv-nd-link, .pv-nd-cta').forEach(function(a){ a.addEventListener('click', closeD); });

    try {
      var u = JSON.parse(localStorage.getItem('pv_user') || 'null');
      var lnk = document.getElementById('pv-nd-login-lnk');
      if (u && u.name && lnk) { lnk.textContent = u.name.replace(/[\s\u3000].*/, ''); lnk.href = pageHref('profile.html'); }
    } catch(e) {}

    /* ── 入らなくなったら畳む ──────────────────────────────────────
       Tailwind の md:(768px) で真ん中のリンク群が出てくるが、1行に収めるのに
       日本語トップは 1155px、英語トップは 1197px 要る。足りないぶんは文字が
       2行に折れてロゴに重なり、英語版は 768px で画面の外へ 173px 出ていた。
       固定の幅で決め打ちせず、実際に測って足りなければ畳む（オーナー判断 2026-08-19）。
       ⚠️ 目印の class は HTML ではなくここで付ける。Tailwind の `hidden md:flex` を
          セレクタに書くと `\:` のエスケープが要るうえ、gap-6 と gap-7 の2種類がある。 */
    var inner = nav.firstElementChild;
    if (!inner) return;
    var linkBox = null;
    [].forEach.call(nav.querySelectorAll('div'), function (d) {
      if (!linkBox && d.querySelector('a.nav-link') && !d.contains(btn)) linkBox = d;
    });
    if (linkBox) linkBox.classList.add('pv-nav-links');
    if (right) {
      right.classList.add('pv-nav-right');
      [].forEach.call(right.querySelectorAll('#nav-auth-btn,.btn-ghost'), function (e) { e.classList.add('pv-nav-2nd'); });
      [].forEach.call(right.querySelectorAll('.btn-primary,.btn-orange'), function (e) { e.classList.add('pv-nav-cta'); });
    }

    /* 中身が本当に要る幅。scrollWidth では測らない —
       文字が折れて逃げているあいだ scrollWidth は増えず、崩れを検出できない。 */
    function needed() {
      var st = getComputedStyle(inner);
      var gap = parseFloat(st.columnGap || st.gap) || 0, w = 0, n = 0;
      [].forEach.call(inner.children, function (c) {
        if (getComputedStyle(c).display === 'none') return;
        w += c.getBoundingClientRect().width; n++;
      });
      return w + gap * Math.max(0, n - 1) +
        parseFloat(st.paddingLeft) + parseFloat(st.paddingRight);
    }
    /* いま実際に空いている、いちばん狭いすき間 */
    function minGap() {
      var box = [];
      [].forEach.call(inner.children, function (c) {
        if (getComputedStyle(c).display === 'none') return;
        box.push(c.getBoundingClientRect());
      });
      box.sort(function (a, b) { return a.left - b.left; });
      var m = Infinity;
      for (var i = 1; i < box.length; i++) m = Math.min(m, box[i].left - box[i - 1].right);
      return m;
    }
    /* 幅が足りているだけでは足りない。ぴったり収まるとロゴとリンクが 14px まで
       近づいて「入っているのに詰まって見える」（en 航空会社ページ @768px が実際そうだった）。
       いちばん狭いすき間が 20px を切ったら、まだ入っていないものとして次の段へ落とす。 */
    var BREATH = 20;
    function fits() {
      return needed() <= inner.clientWidth + 0.5 && minGap() >= BREATH;
    }
    function fit() {
      nav.classList.remove('pv-nav-compact', 'pv-nav-tight', 'pv-nav-min');
      if (fits()) return;
      nav.classList.add('pv-nav-compact');   /* ① リンク群を ≡ の中へ */
      if (fits()) return;
      nav.classList.add('pv-nav-tight');     /* ② ログイン・← 戻る（どちらも ≡ の中にある） */
      if (fits()) return;
      nav.classList.add('pv-nav-min');       /* ③ 最後に CTA（引き出しの先頭に置いてある） */
    }

    /* 右側の幅はあとから増える — currency.js の通貨ピルと lang-toggle.js の
       言語ボタンは読み込み後に差し込まれ、「ログイン」はログイン後に名前へ変わる。
       ⚠️ MutationObserver で属性は見ない（fit() が付ける class で無限に回る）。 */
    var pending = 0;
    function later() {
      if (pending) return;
      pending = requestAnimationFrame(function () { pending = 0; fit(); });
    }
    fit();
    window.addEventListener('resize', later);
    window.addEventListener('load', later);
    [0, 300, 1200].forEach(function (ms) { setTimeout(later, ms); });
    if (window.MutationObserver && right) {
      new MutationObserver(later).observe(right, { childList: true, subtree: true, characterData: true });
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', inject); } else { inject(); }
})();
