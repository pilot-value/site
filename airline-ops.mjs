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
     kind   bizjet / charter / regional / cargo / passenger（画面の検索の補助。DB には出さない）
            passenger ＝ 定期旅客の航空会社で、年収の公開レンジがまだ無い社（2026-10-24 に追加）
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

  /* ── 北米（定期旅客・リージョナル・貨物）── 2026-10-24 オーナー指示で11社を登録 ──
     出どころは米国の調査パック（2026-10-11）の「雇用主体」の記録（記録番号つき）。
     ★「現行適用を確認」まで行っていない4社（UPS・Envoy・PSA・Sun Country）は、そのまま src に書いた。
     ★調査の記録（給与・勤務など）はまだ取り込んでいない。この11社を出す画面がまだ無いため。
     ⚠️ 親会社・提携先と1社にまとめない（片方の給与がもう片方に黙って混ざる）。
       Endeavor ≠ delta ／ Envoy・Piedmont・PSA ≠ american（3社どうしも別）／Horizon ≠ alaska-airlines ／
       Sun Country ≠ allegiant ／ SkyWest Airlines ≠ SkyWest Charter ／ Republic ≠ 旧 Mesa。
       提携ブランド（American Eagle・Delta Connection・United Express）は複数社が共有するので alias に入れない。 */

  /* 定期旅客（年収の公開レンジがまだ無い社） */
  'avelo-airlines': {
    ja: 'Avelo Airlines', en: 'Avelo Airlines', region: 'us', kind: 'passenger',
    alias: ['アベロ航空', 'アヴェロ航空', 'Avelo Airlines, Inc.'],
    src: '雇用主体 Avelo Airlines, Inc.（本社 テキサス州ヒューストン）・米国の調査パックの記録 XP-A-001（現行適用を確認） / 確認 2026-10-11',
  },

  'sun-country': {
    ja: 'Sun Country Airlines', en: 'Sun Country Airlines', region: 'us', kind: 'passenger',
    alias: ['サンカントリー航空', 'Sun Country, Inc.'],
    // ⚠️ 2026-05-13 に Allegiant（allegiant）との合併が完了（調査の台帳）。allegiant と混ぜない。
    //   合併のあとも別の雇用主・別の給与の集団かは、まだ確かめていない（オーナー判断で登録は先に行った）。
    //   別でないと分かったら、ここから消して gen-airline-codes.mjs を流し直す
    //   （active=false に落ちるだけ＝過去の投稿は残る。workflows/add-airline.md の「エッジケース（道B）」）
    src: '雇用主体 Sun Country, Inc.（ブランド名 Sun Country Airlines・親会社 Sun Country Airlines Holdings, Inc.・本社 ミネソタ州ミネアポリス）・米国の調査パックの記録 SY-A-001（現行適用は未確認） / 確認 2026-10-11',
  },

  /* リージョナル */
  'endeavor-air': {
    ja: 'Endeavor Air', en: 'Endeavor Air', region: 'us', kind: 'regional',
    alias: ['エンデバー航空', 'エンデバー・エア', 'Endeavor Air, Inc.'],
    // Delta Air Lines, Inc. の完全子会社だが別法人・別の給与。delta と混ぜない
    src: '雇用主体 Endeavor Air, Inc.（Delta Air Lines, Inc. の完全子会社・本社 ミネソタ州ミネアポリス）・米国の調査パックの記録 9E-A-001（現行適用を確認） / 確認 2026-10-11',
  },

  'envoy-air': {
    ja: 'Envoy Air', en: 'Envoy Air', region: 'us', kind: 'regional',
    alias: ['エンボイ航空', 'エンボイ・エア', 'Envoy Air Inc.'],
    // American Airlines Group の完全子会社。american とも Piedmont・PSA とも混ぜない
    src: '雇用主体 Envoy Air Inc.（American Airlines Group の完全子会社・本社 テキサス州アーヴィング）・米国の調査パックの記録 MQ-A-001（現行適用は未確認） / 確認 2026-10-11',
  },

  'horizon-air': {
    ja: 'Horizon Air', en: 'Horizon Air', region: 'us', kind: 'regional',
    alias: ['ホライゾン航空', 'ホライズン航空', 'Horizon Air Industries, Inc.'],
    // Alaska Air Group の子会社。alaska-airlines と混ぜない
    src: '雇用主体 Horizon Air Industries, Inc.（ワシントン州法人・Alaska Air Group の子会社・本社 ワシントン州シータック）・米国の調査パックの記録 QX-A-001（現行適用を確認） / 確認 2026-10-11',
  },

  'piedmont-airlines': {
    ja: 'Piedmont Airlines', en: 'Piedmont Airlines', region: 'us', kind: 'regional',
    alias: ['ピードモント航空', 'Piedmont Airlines, Inc.'],
    // American Airlines Group の完全子会社（American Airlines, Inc. とは別の雇用主）。american と混ぜない
    src: '雇用主体 Piedmont Airlines, Inc.（American Airlines Group の完全子会社・本社 メリーランド州ソールズベリー）・米国の調査パックの記録 PT-A-001（現行適用を確認） / 確認 2026-10-11',
  },

  'psa-airlines': {
    ja: 'PSA Airlines', en: 'PSA Airlines', region: 'us', kind: 'regional',
    alias: ['PSA航空', 'PSA Airlines, Inc.'],
    // American の完全子会社。american とも Envoy・Piedmont とも混ぜない
    src: '雇用主体 PSA Airlines, Inc.（American の完全子会社・本社 ノースカロライナ州シャーロット）・米国の調査パックの記録 OH-A-001（現行適用は未確認） / 確認 2026-10-11',
  },

  'republic-airways': {
    ja: 'Republic Airways', en: 'Republic Airways', region: 'us', kind: 'regional',
    alias: ['リパブリック航空', 'リパブリック・エアウェイズ', 'Republic Airways Inc.'],
    // ⚠️ 2025-11-25 に Mesa Air Group と合併。旧 Mesa のパイロットは別の雇用主・別の給与＝ここは Republic だけ。
    //   Mesa の名前を alias に入れない
    src: '雇用主体 Republic Airways Inc.（Republic Airways Holdings Inc. の完全子会社・インディアナ州カーメル）・米国の調査パックの記録 YX-A-001（現行適用を確認） / 確認 2026-10-11',
  },

  'skywest': {
    ja: 'SkyWest Airlines', en: 'SkyWest Airlines', region: 'us', kind: 'regional',
    alias: ['スカイウエスト航空', 'スカイウェスト航空', 'SkyWest Airlines, Inc.'],
    // ⚠️ SkyWest Charter（別の運航証明）と混ぜない。持株会社 SkyWest, Inc. はパイロットの雇用主ではない
    src: '雇用主体 SkyWest Airlines, Inc.（SkyWest, Inc. の完全子会社・本社 ユタ州セントジョージ）・米国の調査パックの記録 OO-A-001（現行適用を確認） / 確認 2026-10-11',
  },

  /* 貨物 */
  'fedex-express': {
    ja: 'FedEx Express', en: 'FedEx Express', region: 'us', kind: 'cargo',
    alias: ['フェデックス', 'フェデックス・エクスプレス', 'フェデラル・エクスプレス', 'Federal Express Corporation'],
    // 雇用主は Federal Express Corporation。持株会社 FedEx Corporation・FedEx Ground などとは別
    src: '雇用主体 Federal Express Corporation（ブランド名 FedEx Express・ALPA との労働協約の当事者）・米国の調査パックの記録 FX-A-001（現行適用を確認） / 確認 2026-10-11',
  },

  'ups-airlines': {
    ja: 'UPS Airlines', en: 'UPS Airlines', region: 'us', kind: 'cargo',
    alias: ['UPS航空', 'ユーピーエス'],
    // パイロットの雇用法人の名前は、調査の台帳でも公開資料で未確認の行が多い（表示名は公式の呼び名の確認待ち）
    src: '親会社 United Parcel Service, Inc. の子会社一覧（Form 10-K・2025-12-31 期）に掲載・米国の調査パックの記録 5X-A-002（現行適用は未確認） / 確認 2026-10-11',
  },

  /* ── 北米（ビジネスジェット）──────────────────────────────── */

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

  /* ★2026-10-31 オーナー「一覧にない航空会社で給与を出してくれている人がいる＝需要がある」── 会員が「その他」に打ち込んで給与を出した3社。
       打ち込まれた表記（Flydubai・Juneyao Airlines・air peace）が pv_airline_resolve でそのまま当たる名前にした（大小文字・空白は無視）。
       Flydubai と吉祥航空は、年収の出典がそろったら道Aへ（コードはこのまま）。 */
  'flydubai': {
    ja: 'フライドバイ（flydubai）', en: 'flydubai', region: 'mideast', kind: 'passenger',
    alias: ['Fly Dubai', 'フライ・ドバイ', 'Dubai Aviation Corporation'],
    // ⚠️ エミレーツ（emirates）とは別会社（エミレーツ・グループに入っていない）
    src: 'Dubai Aviation Corporation（ブランド flydubai・本社 ドバイ国際空港 第2ターミナル・2008年設立） / 確認 2026-10-31',
  },
  'juneyao-airlines': {
    ja: '吉祥航空（Juneyao Air）', en: 'Juneyao Airlines', region: 'asia', kind: 'passenger',
    alias: ['上海吉祥航空', 'ジュンヤオ航空', 'Juneyao Airlines Co., Ltd.'],
    src: '上海吉祥航空股份有限公司（Juneyao Airlines Co., Ltd.・上海・上場コード 603885） / 確認 2026-10-31',
  },
  'air-peace': {
    ja: 'エア・ピース（Air Peace）', en: 'Air Peace', region: 'africa', kind: 'passenger',
    alias: ['エアピース', 'Air Peace Limited'],
    src: 'Air Peace Limited（本社 ナイジェリア・ラゴス州イケジャ・公式 flyairpeace.com） / 確認 2026-10-31',
  },

};
