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
  /* ★2026-11-03 avelo-airlines は道Aへ上げた（同じコードのまま salary-data.mjs の SALARY へ・add-airline.md の B5） */

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

  /* 貨物
     ★2026-11-02 FedEx Express（fedex-express）と UPS Airlines（ups-airlines）は、同じコードのまま salary-data.mjs の SALARY へ上げた
       （道A・B5 ── 米国20社の統合調査の給与表で推定年収を出した）。ここから消したのはそのため（両方に書くと gen-airline-codes.mjs が「コードの衝突」で止まる）。
       名前（ja・en）は SALARY でもここに書いていたまま（FedEx Express／UPS Airlines）。
       ⚠️ ここに在った別名（フェデックス・フェデラル・エクスプレス・Federal Express Corporation・UPS航空・ユーピーエス）は、
          給与フォームの検索欄だけが読む道具だった（DB には出していない）。SALARY の会社は search.js の t:[...] がその役をする。
       ⚠️ FedEx の雇用主は Federal Express Corporation。持株会社 FedEx Corporation・FedEx Ground とは別。 */

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

  /* ── アジア（韓国の LCC）── 2026-11-10 ───────────────────────
     ★2026-11-09 に会員が「その他」に「Air busan」と打ち込んで給与を出した（オーナー「一覧にない航空会社の人が給与提出した」）。
       英語名 'Air Busan' が pv_airline_resolve で当たる（大小文字・空白は無視）＝その行も書き換えずに「エアプサン」で出る。
     ★統合の相手2社（ジンエアー・エアソウル）も一緒に足した（オーナー判断 2026-11-10）。統合のあとは
       エアプサンの人もジンエアーで出すので、受け皿を先に作っておく。
     ⚠️ 3社は 2026-08-21 に合併契約を結び、2027-03-17（予定）に「統合ジンエアー」として発足する
       （存続はジンエアー・エアプサンとエアソウルは消える。12月の臨時株主総会と国の認可が残っている）。
       発足した日以降、air-busan と air-seoul をどうするか（RETIRED へ移すか）は要判断。
       コードは変えない（過去の投稿の鍵）。air-busan をジンエアーへ寄せない（統合前は別の雇用主・別の給与）。
     ★日本語の名前は、各社の日本語サイト・日本の旅行会社・航空専門紙で使われている表記（勝手な訳ではない）。
       各社の公式サイトは機械の取得を断る（403）ので、出どころには日本語の記事を併記した。 */

  'air-busan': {
    ja: 'エアプサン', en: 'Air Busan', region: 'asia', kind: 'passenger',
    alias: ['エアブサン', '에어부산', 'BX', 'ABL', 'えあぷさん'],
    src: '会社の日本語サイト jp.airbusan.com（機械の取得は 403）＋ Aviation Wire 2026-08-27「「統合ジンエアー」27年3月発足へ　韓国LCC 3社が合併契約」（エアプサン ABL/BX） / 確認 2026-11-10',
  },
  'jin-air': {
    ja: 'ジンエアー', en: 'Jin Air', region: 'asia', kind: 'passenger',
    alias: ['진에어', 'LJ', 'JNA', 'じんえあー'],
    src: '会社のサイト www.jinair.com（機械の取得は 403）＋ Aviation Wire 2026-08-27（ジンエアー JNA/LJ・合併の存続会社） / 確認 2026-11-10',
  },
  'air-seoul': {
    ja: 'エアソウル', en: 'Air Seoul', region: 'asia', kind: 'passenger',
    alias: ['에어서울', 'RS', 'ASV', 'えあそうる'],
    src: '会社のサイト flyairseoul.com（機械の取得は 403）＋ Aviation Wire 2026-08-27（エアソウル ASV/RS） / 確認 2026-11-10',
  },

  /* ★2026-10-31 オーナー「一覧にない航空会社で給与を出してくれている人がいる＝需要がある」── 会員が「その他」に打ち込んで給与を出した3社。
       打ち込まれた表記（Flydubai・Juneyao Airlines・air peace）が pv_airline_resolve でそのまま当たる名前にした（大小文字・空白は無視・英語名で当たる）。
       ★日本語の名前は日本語だけ（オーナー「ちゃんとした会社名にしてね。juneyao-airlines は日本語だと吉祥航空でしょ？」）。
       ★2026-10-31 3社とも（フライドバイ flydubai・エア・ピース air-peace・吉祥航空 juneyao-airlines）、同じコードのまま
         salary-data.mjs の SALARY へ上げた（道A・B5）。ここから消したのはそのため（両方に書くと gen-airline-codes.mjs が「コードの衝突」で止まる）。
         ⚠️ フライドバイはエミレーツ（emirates）とは別会社（エミレーツ・グループに入っていない）。 */


  /* ★2026-11-03 北米追加20社（ChatGPT の調べ・2026-11-02 基準）のうち、会社ページを作らない10社（オーナー「A1 B1」）。
     年収の出どころが無い・旧い協約か署名前の案しか無い・給与表の出どころが APC（使わない決まり）しか無い会社。
     正式な名前と会社のサイトは 2026-11-03 に開いて確かめた（omniairinternational.com はパーキングドメイン・21air.com は別の会社 ── 使わない）。 */
  'commuteair': {
    ja: 'CommuteAir', en: 'CommuteAir', region: 'us', kind: 'regional',
    alias: ['コミュートエアー', 'コミュートエア', 'CommuteAir LLC'],
    src: '会社のサイト https://www.commuteair.com/ / 確認 2026-11-03',
  },
  'omni-air-international': {
    ja: 'Omni Air International', en: 'Omni Air International', region: 'us', kind: 'charter',
    alias: ['オムニ・エア・インターナショナル', 'オムニエア', 'OAI'],
    src: '会社のサイト https://www.oai.aero/ / 確認 2026-11-03',
  },
  'air-transport-international': {
    ja: 'Air Transport International', en: 'Air Transport International', region: 'us', kind: 'cargo',
    alias: ['エア・トランスポート・インターナショナル', 'ATI'],
    src: '会社のサイト https://www.airtransport.cc/ / 確認 2026-11-03',
  },
  'amerijet': {
    ja: 'Amerijet International', en: 'Amerijet International', region: 'us', kind: 'cargo',
    alias: ['アメリジェット', 'Amerijet'],
    src: '会社のサイト https://amerijet.com/ / 確認 2026-11-03',
  },
  '21-air': {
    ja: '21 Air', en: '21 Air', region: 'us', kind: 'cargo',
    alias: ['21エアー', '21エア'],
    src: '会社のサイト https://www.21air.us/ / 確認 2026-11-03',
  },
  'national-airlines': {
    ja: 'National Airlines', en: 'National Airlines', region: 'us', kind: 'charter',
    alias: ['ナショナル航空'],
    src: '会社のサイト https://www.nationalairlines.com/careers/ / 確認 2026-11-03',
  },
  'global-crossing': {
    ja: 'Global Crossing Airlines', en: 'Global Crossing Airlines', region: 'us', kind: 'charter',
    alias: ['グローバル・クロッシング航空', 'GlobalX', 'グローバルX'],
    src: '会社のサイト https://globalxair.com/company/ / 確認 2026-11-03',
  },
  'mountain-air-cargo': {
    ja: 'Mountain Air Cargo', en: 'Mountain Air Cargo', region: 'us', kind: 'cargo',
    alias: ['マウンテン・エア・カーゴ'],
    src: '会社のサイト https://mtaircargo.com/about/ / 確認 2026-11-03',
  },
  'air-transat': {
    ja: 'Air Transat', en: 'Air Transat', region: 'us', kind: 'passenger',
    alias: ['エア・トランザット', 'Air Transat A.T. Inc.'],
    src: '会社のサイト https://www.airtransat.com/（規約の表記 Air Transat A.T. Inc.） / 確認 2026-11-03',
  },
  'cargojet': {
    ja: 'Cargojet', en: 'Cargojet', region: 'us', kind: 'cargo',
    alias: ['カーゴジェット', 'Cargojet Inc.', 'Cargojet Airways'],
    src: '会社のサイト https://cargojet.com/（表記 Cargojet Inc.） / 確認 2026-11-03',
  },
};

/* ════════════════════════════════════════════════════════════════
   RETIRED ── 名簿から外した会社（運航をやめた会社など）。★もう投稿を受け付けない。

   なぜ消さずに残すか: 過去の給与・口コミの行がこのコードを持っている。
     gen-airline-codes.mjs が次の4つにだけ配る（どれも「過去の行を読む」側）──
       ・pv-airlines.json に kind:'retired' で残す ＝ REAL PAY・Vote・マイページなどが社名を出せる
         （vote.js の hasPage は kind === 'airline' だけ ＝ 会社ページへのリンクは張られない・会社の一覧にも出ない）
       ・airline-codes.json と pv-reunlock.js の FALLBACK_CODES に残す ＝ その会社に口コミを出した人が、
         別の端末でログインしても鍵が戻る（proof_hash はコードの文字列から作るので、コードが一覧から消えると二度と当たらない）
       ・db/airlines.generated.sql に active=false で残す ＝ 外部キーは生きたまま、新しい給与だけ止まる
         （submit_pay_report は active を見る・pv_review_codes は active を見ない＝口コミの鍵も残る）。
         年収の幅（cap_lo〜fo_hi）は null ＝ 公開していない幅で REAL PAY の ⚠ を付けない
     配らないもの ── 投稿フォーム日英4枚の選択肢と AIRLINE_LABELS・salary-data.json・会社ページ・国別ページ・sitemap・検索。
   ⚠️ 年収（cap / fo）を書かない。コードを変えない・SALARY や OPS と同じコードを書かない（gen-airline-codes.mjs が止める）。
   ⚠️ 戻すとき（運航を再開した等）は、ここから消して SALARY か OPS へ同じコードのまま移す（add-airline.md の道A／道B）。
   手順は workflows/add-airline.md の「会社を外す」。
   ════════════════════════════════════════════════════════════════ */
export const RETIRED = {

  'spirit': {
    ja: 'スピリット航空', en: 'Spirit Airlines', region: 'us',
    // 2026-05-02 に全便の運航を停止。オーナー決定（2026-10-11「スピリットを外す」・2026-11-02 再確認）で会社ページごと外した。
    // 住所（airlines/spirit.html・en/airlines/spirit.html）は 404。お知らせのページは置かない（オーナー判断）。
    // 古い形のページは gen-new-airline.mjs の借り元として airline-donor-pages.mjs に写してある（配信されない）。
    until: '2026-05-02',
    src: 'オーナー決定 2026-10-11（2026-11-02 再確認）',
  },

};
