/* ════════════════════════════════════════════════════════════════
   airline-ops.mjs — 年収データを持たない「投稿先だけの会社」の名簿

   なぜ別ファイルか: salary-data.mjs の SALARY は「年収の唯一の正」。
   小規模航空会社・チャーター会社・ビジネスジェット運航会社は
   公開されている年収レンジが無い。SALARY に入れると
   ① 推測の数値を書くことになる（VERIFIED-PILOT の原則に反する）
   ② check-salary.mjs / gen-og-images.mjs / gen-sitemap.mjs が
      「会社ページがある社」として数え始め、404 と件数のずれが生える。
   そこで「年収はある社」と「投稿できる社」を分け、
   gen-airline-codes.mjs が両方を合流させて選択肢と pv_airlines を作る。

   ★ ここに足しても会社ページ（airlines/{code}.html）は作らない。
     年収の出典が揃ったら SALARY へ昇格させる。
     そのとき code は変えない（過去の投稿が全部ついてくる）。

   手順は workflows/add-airline.md の「道B」。

   ── 1件の形 ──────────────────────────────────────────────
     ja     公開表示名（日本語）。REAL PAY と選択肢に出る
     en     公開表示名（英語）
     region gen-airline-codes.mjs の8地域のいずれか
            japan / mideast / asia / europe / us / oceania / latam / africa
     kind   bizjet / charter / regional / cargo（画面の検索の補助。DB には出さない）
     alias  ★フォームの検索だけが読む別名。pv_airlines には行を作らない
            （別名の行を作ると pv_airline_resolve が別会社として当たり得る）
     src    実在と正式名称を確認した出どころ＋確認日。年収が無くても出どころは要る

   ⚠️ ja / en は「正式名称（公式略称）」の形にする。
     pv_airline_resolve（db/pay-rows.sql:668）は括弧の外と中の両方で
     完全一致を取るので、略称でも当たるようになる。
     ★ただし公式に使われている略称だけ。作った略称を括弧に入れない。

   ⚠️ 日本語の社名が定まっていない海外の運航会社は、ja にも英語のブランド名を
     そのまま入れてある（ZIPAIR / Peach / AIRDO と同じ扱い）。
     カタカナは alias に置く＝検索では当たるが、勝手な訳を表示名にしない。
════════════════════════════════════════════════════════════════ */

export const OPS = {

  /* ── 日本 ───────────────────────────────────────────────── */

  'aero-toyota': {
    ja: 'エアロトヨタ', en: 'AERO TOYOTA', region: 'japan', kind: 'charter',
    alias: ['朝日航洋', 'Aero Asahi', 'エアロトヨタ株式会社', 'えあろとよた'],
    // 2024-12-03 発表 → 2025-07-01 付で朝日航洋から社名変更（英文 AERO TOYOTA CORPORATION）。
    // 1997年からトヨタ自動車グループ。ヘリコプターとビジネスジェットを運航する
    src: '会社公式 aerotoyota.co.jp ＋ PR TIMES 2024-12-03（社名変更の告知） / 確認 2026-09-13',
  },

  'nakanihon-air': {
    ja: '中日本航空（NNK）', en: 'Nakanihon Air (NNK)', region: 'japan', kind: 'charter',
    alias: ['中日本航空株式会社', 'なかにほんこうくう'],
    src: '会社公式 nnk.co.jp/company/about/ / 確認 2026-09-13',
  },

  'honda-airways': {
    ja: '本田航空', en: 'Honda Airways', region: 'japan', kind: 'charter',
    alias: ['本田航空株式会社', 'ホンダ航空', 'ほんだこうくう', 'ホンダエアポート'],
    // ⚠️ HondaJet を作る Honda Aircraft Company（米）とは別法人
    src: '会社公式 honda-air.co.jp / 確認 2026-09-13',
  },

  'fuji-business-jet': {
    ja: 'フジビジネスジェット（FBJ）', en: 'Fuji Business Jet (FBJ)',
    region: 'japan', kind: 'bizjet',
    alias: ['フジビジネスジェット株式会社', 'ふじびじねすじぇっと'],
    // 2020-04 に静岡エアコミュータのビジネスジェット部門が独立。富士山静岡空港が基地。
    // ⚠️ フジドリームエアラインズ（FDA）とは別法人（同じ鈴与グループの別会社）
    src: '会社公式 fuji-businessjet.co.jp（鈴与グループ・Citation / Falcon を運航） / 確認 2026-09-13',
  },

  'japan-biz-aviation': {
    ja: 'Japan Biz Aviation', en: 'Japan Biz Aviation', region: 'japan', kind: 'bizjet',
    alias: ['株式会社Japan Biz Aviation', 'ジャパン・ビズ・アビエーション'],
    src: '会社公式 j-bizavi.com（東京航空局 東空事第29号） / 確認 2026-09-13',
  },

  /* ── 北米 ───────────────────────────────────────────────── */

  'netjets': {
    ja: 'NetJets', en: 'NetJets', region: 'us', kind: 'bizjet',
    alias: ['ネットジェッツ', 'NetJets Inc.', 'ネットジェット'],
    src: 'NetJets Inc.（オハイオ州コロンバス） / 確認 2026-09-13',
  },

  'executive-jet-management': {
    ja: 'Executive Jet Management（EJM）', en: 'Executive Jet Management (EJM)',
    region: 'us', kind: 'bizjet',
    alias: ['エグゼクティブ・ジェット・マネジメント'],
    // NetJets の子会社だが別の運航証明を持つ別会社。netjets と混ぜない
    src: 'NetJets 傘下の運航会社（オハイオ州シンシナティ） / 確認 2026-09-13',
  },

  'flexjet': {
    ja: 'Flexjet', en: 'Flexjet', region: 'us', kind: 'bizjet',
    alias: ['フレックスジェット', 'Flexjet, LLC'],
    src: 'Flexjet, LLC（オハイオ州リッチモンドハイツ） / 確認 2026-09-13',
  },

  'wheels-up': {
    ja: 'Wheels Up', en: 'Wheels Up', region: 'us', kind: 'bizjet',
    alias: ['ウィールズ・アップ', 'Wheels Up Experience'],
    src: 'Wheels Up Experience Inc.（ニューヨーク） / 確認 2026-09-13',
  },

  'flyexclusive': {
    ja: 'flyExclusive', en: 'flyExclusive', region: 'us', kind: 'bizjet',
    alias: ['フライエクスクルーシブ', 'Exclusive Jets'],
    src: '会社公式 flyexclusive.com（FAA Part 135・自社運航） / 確認 2026-09-13',
  },

  'clay-lacy': {
    ja: 'Clay Lacy Aviation', en: 'Clay Lacy Aviation', region: 'us', kind: 'bizjet',
    alias: ['クレイ・レイシー・アビエーション', 'Clay Lacy'],
    src: '会社公式 claylacy.com（カリフォルニア州ヴァンナイズ） / 確認 2026-09-13',
  },

  /* ── 欧州 ───────────────────────────────────────────────── */

  'vistajet': {
    ja: 'VistaJet', en: 'VistaJet', region: 'europe', kind: 'bizjet',
    alias: ['ビスタジェット', 'Vista Global', 'ヴィスタジェット'],
    src: 'VistaJet Holding SA（マルタ・Vista Global 傘下） / 確認 2026-09-13',
  },

  'jet-aviation': {
    ja: 'Jet Aviation', en: 'Jet Aviation', region: 'europe', kind: 'bizjet',
    alias: ['ジェット・アビエーション'],
    src: 'Jet Aviation（スイス・バーゼル／General Dynamics 傘下） / 確認 2026-09-13',
  },

  'luxaviation': {
    ja: 'Luxaviation', en: 'Luxaviation', region: 'europe', kind: 'bizjet',
    alias: ['ラクスアビエーション', 'Luxaviation Group'],
    src: '会社公式 luxaviation.com（15の AOC・従業員1,500名超） / 確認 2026-09-13',
  },

  'gama-aviation': {
    ja: 'Gama Aviation', en: 'Gama Aviation', region: 'europe', kind: 'bizjet',
    alias: ['ガマ・アビエーション', 'Gama Aviation Plc'],
    src: 'Gama Aviation Plc（英・ファーンボロー） / 確認 2026-09-13',
  },

  /* ── 中東 ───────────────────────────────────────────────── */

  'royal-jet': {
    ja: 'Royal Jet', en: 'Royal Jet', region: 'mideast', kind: 'bizjet',
    alias: ['ロイヤルジェット', 'RoyalJet'],
    // ⚠️ ロイヤル・ヨルダン航空（royal-jordanian）とは別会社
    src: 'Royal Jet LLC（アブダビ・BBJ 8機ほか） / 確認 2026-09-13',
  },

};
