/* ════════════════════════════════════════════════════════════════
   assert-directory-ui.mjs ── 航空会社一覧（world-airlines.html・en/world-airlines.html）を、
   手元の使い捨ての保存先（serve-local.mjs）に立ててブラウザで歩く検査（REAL LOCAL CONNECTION）。

   ★ 3000 番にも本番にも1回も通信しない。
     サーバーは local-chain.mjs の bring()（空いているポート・一時の保存先・解析タグは配る時に外す）、
     ページは local-chain.mjs の open()（門：手元と書体・部品の配信元 LIBS だけを通す。*.supabase.* は st.supa、
     ほかの行き先は st.blocked に書き留めて止める）で開く。
   ★ 期待する値は、ここ（Node）で台帳から作る ── SALARY（salary-data.mjs）と一覧の行（airlines-meta.js）。
     gen-directory.mjs・directory-model.mjs・ページの台本からは作らない（検査される側の答えを写さない）。
   ★ 待つのは条件だけ（時間では待たない）。
   ★ どの場面も最後に quiet(st, 場面) が空であること ── 一覧のページが開いているあいだ、
     サーバーの口（/rest/v1/rpc/…）を1本も呼ばない（QUIET_ALLOW に在る名前だけは呼んでよい。この一覧では空）。
     スクリプトの止まり（st.errs）と、手元の配信元からの 4xx も落ちる。

   場面 base（日英・1440×900）
     b1 見えているカード ＝ 台帳の112社を一覧の並び（地域の順 → 一覧の行の順）で・社数「112社」／«112 airlines»・
        どの社名も語の途中で折れず切れていない（折れ目は空白・「・」の後ろ・「（」の前だけ ── WP-dd-9。390 は場面 first で）
     b2 地域のボタンを1つずつ押す → 見えているカード ＝ その地域の会社（集合）・社数・押したボタンだけ aria-pressed="true"
     （b3 種類の絞り込み（FSC・LCC/ULCC・免税）は WP-dmap-7 で口ごと外した ── 無いことは assert-directory.mjs の G10 が見る）
     b4 レベリング比較 → 絞り込みの帯（#filter-bar）が消え、#lvl-wa-grid に4本の .lvl-col・カード一覧 → 戻る
     b5 テーマのボタンで data-theme が入れ替わる（もう1回で戻る）
     b6 地域のまとめ：アジアのボタンにマウスを載せる → カードが見せているのは wam-p-asia で、定義の行に台帳の社数・
        そのボタンを押すと選ばれ、もう1回で外れる・9枚のカードの社数 ＝ 地域の社数（古い地図の3行を WP-dmap-4 で付け替えた）
     b7 検索欄に «emirates» → エミレーツが見えている・«zzzz» → 見つからない（#no-results）
     b8 ヘッダーの検索（#pv-search-btn）で «Solairus» → airlines/solairus.html へのリンクが出る
     b9 quiet(st, 'base') が空

   場面 first（日英・390×680 のスマホ）
     検索欄（#search）が最初の1画面の中・高さ 48px 以上・字 16px 以上・見出しと検索欄のあいだに押せるもの無し・
     見出し「次のキャリアを、選択する」／«Choose your next career»・結果の見出し「すべて」／«All»・
     開いたときは地域の札・解除・見つからないときのボタンを見せない・どの社名も語の途中で折れず切れていない（WP-dd-9）・quiet が空
   場面 nojs（日英・台本を止める）
     112社のリンクが見えている・h2#wd-rh-name「すべて」／«All»・検索欄／絞り込みの帯／表示の切り替え／古い地図／比べる印／盆を見せない・quiet が空

   場面 search（日英・1440×900）── 検索が約束どおり（期待する集合はここで台帳から作る。台本の答えを写さない）
     s1 112社の「自分の値」を6種類（日本語名・英語名・略称・コード・国名（日）・国名（英））そのまま打つ → その会社が見えている
     s2 決めた例：NH・JL・EK・EY・AXC ＝ 一覧の行の略号を持つ1社だけ・UA → 先頭がユナイテッド・BA → 先頭が英国航空・
        ANA ＝ ＡＮＡ ＝ "ana " → 先頭が ANA・日本の会社だけ・JAL と Ryanair は出ない・
        US ＝ USA ＝ 米国 ＝ America ＝ アメリカ ＝ アメリカ合衆国 → 国が US の会社ちょうど・UK ＝ GB ＝ 英国 ＝ Britain ＝ Great Britain ＝
        England → GB ちょうど・JP ＝ 日本 → JP ちょうど・ドイツ ＝ Germany → DE ちょうど・フランスの6つ → エールフランスだけ・
        台湾 ＝ Taiwan → TW ちょうど・インド → 先頭の2社が IN、あとは ID だけ・India → IN ちょうど・マルタ ＝ Malta → エアX だけ・
        トルコ ＝ Türkiye ＝ Turkiye → ターキッシュだけ・全日空 → ANA だけ・ぴーち ＝ ピーチ → ピーチだけ・ｴﾐﾚｰﾂ → 先頭がエミレーツ・
        ワンワールド ＝ oneworld → 一覧の行の提携がワンワールドの会社ちょうど・zzzz → 0
     s3 打っているあいだは地図と地域のまとめ（#wd-explore）を見せない・空にすると戻る
     s3b 地図の一言「地図をクリックして地域を選択」／«Click the map to choose a region» は地図の枠（.wam-mc）の中に1つ（見出しの帯には無い）・
        打っているあいだは地図と一緒に見えない（WP-dd-9）
     s4 レベリング比較を開いたまま打つ → カード一覧に戻る
   場面 scope（日英・390×680 のスマホ）── 地域を選んだまま別の地域の会社を打つ
     欧州を選ぶ → 欄の中に「欧州」の札・「全日空」＋ Enter → 地域のボタンと結果の見出しが上の帯のすぐ下（ヘッダーの裏に無い・WP-dmap-7）・カード0枚・見つからないの文は出さない・#wd-else のボタンは
     「日本 1」の1つだけ（画面の中・横にずれない）・欧州の帯の数 ＝ 台帳で数えた当たり（0）→ 押す → 日本・ANA・欄はそのまま・
     history.length は増えない → 欧州 → 札を押す → すべて・先頭が ANA・見えている数 ＝ すべての数 → 欧州 ＋ «air» → 見えているのは
     欧州の会社だけ・社数 ＝ その数 → 欧州をもう1回 → 外れる
   場面 empty（日英・1440×900）── zzzz → 見つからないの文と「絞り込みを解除」・地域のボタンは出さない・社数は空 →
     「絞り込みを解除」→ 112社・欄は空・すべてが押されている・ボタンは隠れる
   場面 url（日英・1440×900）── 住所（WP-dd-6）
     u1 8つの住所（?q=ana・?q=ana#list・?region=asia・?region=zz・?ref=ABCD1234・?q=ドイツ&region=europe&type=fsc・?type=taxfree#list・?view=range）で開く →
        住所は1文字も変わらない（古い ?type= の2つだけは、type の鍵だけが消える ── ほかの鍵・# はそのまま。WP-dmap-7）・
        history.state は null（開いた時は履歴に触らない）・状態・欄・押した地域が住所どおり・
        見えているカード ＝ 台帳（地域・国）／打った時と同じ（q）・zz と ?type= は「すべて」（種類では絞らない）・?view=range は絞り込みの帯が消え、
        DOMContentLoaded のあと #lvl-wa-grid に4本の .lvl-col
     u2 «emirates» を本当に打つ → その場で絞り込まれ、欄にいるあいだ住所は変わらない → Enter → ?q=emirates・history.length は同じ
     u3 打って欄を離れる（Tab）→ ?q=emirates（change）・欄の消すボタン（空にして search）→ q が消える
     u4 地域のボタン → ?region=… ・history.length は同じ → «air» ＋ Enter ＋ スクロール → 読み直す → 同じ地域・欄・スクロール
     u5 地域を選び、打ち終えないまま言語のボタン → 向こうのページで同じカードが見えている
   場面 back（日英・1440×900・新しい headless）── 会社のページへ移って「戻る」（WP-dd-6）
     JAL と ルフトハンザ × 2つの歩き方 × 2つの離れ方。結果：その社の地域 ＋ «air» ／ «luft»（Enter なし）→ 社名 → 戻る →
     同じカード・欄・札・住所に q。スクロール：何も選ばずにその社のカードを画面のまんなかへ → 社名 → 戻る → 112社・
     スクロールが ±2px。離れ方：そのまま（ブラウザの手元に置かれたか ＝ cache ／ reload を印字）と、unload の聞き手を足して
     （手元に置かれない ＝ 必ず reload）。ページはサイトのファイルの no-store を max-age=600（GitHub Pages と同じ）に替える前の口
     （frontOf）から開く ── serve-local の no-store のままだと、ブラウザはいつも読み直す
   場面 touch（日英・390×680・指）── 欄を指で押して打つ → 社名を指で押す → 移る → 戻る → 同じカードと欄 → 比べる印を指で押す →
     付く・移らない
   場面 card（日英・390×680）── 比べる印と盆（WP-dd-7）
     印の在るカード ＝ data-two="1" かつ 新しい会社ページを持つ社（日本語 SWITCH・英語 EN_SWITCH。airline-rollout.mjs を Node で読む）／
     印の在るカードごとに、機長の額のまんなか ＝ そのカードのリンク・印のまんなか ＝ 印・足もとの左端 ＝ どちらでもない・印の高さ 44px 以上／
     T0 盆なし（「航空会社を比較」／«Compare airlines» の要素は在って隠れている）→ T1 jal「1 / 5 社」＋レベリング比較 → T2 jal ＋ ana
     （「航空会社を比較」／«Compare airlines» ＝ career.html?view=compare&a=jal&b=ana・その横にレベリング比較）→ 盆のレベリング比較 →
     印の2社だけの図 → 読み直す → 同じ図 → カード一覧 → 印はそのまま → 社名 → 戻る → 印はそのまま →「航空会社を比較」／«Compare airlines» →
     その言葉の比較のページ（career.html／en/career.html）が jal と ana を2社で開く → 戻る → 3社目で入口が隠れる → 5社「5 / 5 社」・
     ほかの印はどれも押せない（英語は6社目を押しても付かない）→ 盆の札を押すと外れる／
     WP-dd-9：盆のレベリング比較を押した直後（マウスは動かさない）に図の吹き出しが出ない・3社目で隠れた「航空会社を比較」の行き先は
     出荷のまま（前の2社を残さない）・5社で札の列があふれても1社目から（左の端で切れない）／T6（段の無い社に印 ＝ 2社まで）は、そのページに印の在る
     data-lvl="0" のカードが在る時だけ歩く（無ければ「T6：まだ歩けない（比較の切り替えの前）」と印字して通す）
     ★2026-10-25 英語の EN-9 で、英語を日本語と同じ決まりへ向け直した（弱めていない）。前の英語は「印 ＝ 一覧の行に fleet がある社（4社には無い）・
     盆はレベリング比較だけ（#wd-tray-two の要素そのものが無い）」── 英語の比較のページ（en/career.html）が無かったあいだの決まり
     ★WP-dmap-10（比較リスト）で付け替えた（同じ強さ）：印は button.wd-cmp（付いた ＝ aria-pressed・押せない ＝ aria-disabled となぜか）・盆の札は行
     （li[data-slug] と外す ×）・押せない2つのボタンは「隠れる」から「押せない形」へ（「航空会社を比較」は行き先そのものが無い ＝ 前より強い）・
     レベリング比較は2〜5社（シート）＝ 1社では押せない・印を付け外しすると住所の cmp だけが変わる（履歴は積まない）・
     狭い画面の盆は1行に畳んだ形（次の1手だけ）で出る ＝ レベリング比較・× は題の行で開いてから押す
   ★場面 list（日英・1440×900 と 390×680 の指）── 比較リスト（WP-dmap-10・オーナー「膨大な量の航空会社がある中で、カードにチェックつけるだけしか方法ない
     のキツくない？」）。class A：リストの欄の候補 ＝ ページの検索の当たり（カタール・qr・ドイツ・zzzz・同じ並び）・「航空会社を比較」の行き先 ＝
     career.html?view=compare&a=<1社目>&b=<2社目>（英語は en/career.html）・住所の cmp からリストが戻る（読み直し・共有した住所）。
     class B：0社でもカードの右に出る・欄から足す（↓・Enter）・カードの印で付け外し・3社目で「航空会社を比較」が押せない・× で外す・段の無い社の行は理由・
     押せない印はなぜかを持つ／390：盆は1社から・1行に畳んだ形 → 開く → 「＋ 会社を追加」の板（履歴1段）→ 候補を指で → Esc・戻るで閉じても足した社はそのまま

   場面 map-pos（日英・1440×900 と 390×680 の指・台本なし）── 地図の区域（WP-dmap-3／WP-dmap-4）：面の右上の「機長｜副操縦士」の切り替え。
     押した方が区域の data-pos・aria-pressed・見せる帯・地図の点の色・凡例の行を決める・カードの高さは変わらない・履歴と保存領域に書かない・
     キーボードでも押せる・組の読み上げの名前（職位／Rank）・台本なしでは見えない・狭い画面では地図の上の1行（中身は関数 mapPos の頭）・
     ★狭い画面でカードが閉じているあいだは、切り替えの右に「すべて」と選んだ職位の額だけが出ていて、押すとその額が変わる（WP-dmap-8 D1・class B）

   地図の場面（WP-dmap-5 ＝ DM4 ＋ DM6・日英）── 組んだ形（WP-dmap-4）のとおり：区域の幅 1000px 以上は地図の右にカード・700〜999px は地図の下・
   700px 未満は切り替え・地図・カード（カードは触れるか選ぶまで閉じている ＝ 見えるのは切り替えの右の「すべて」の1行だけ・closedCard ── WP-dmap-8 D1）。
   地図を指す・押すのは world-outline-probes.mjs の POINT_AT／SEA／PROBES を
   toPage() で写した所。時計は Asia/Tokyo。どの場面も最後に quiet が空
   場面 map-card（1440×900・1001×900・390×680 の指）
     (1) 9つのボタンにマウス → 見せるカードはその地域・カードの箱（文書の上の x・y・幅・高さ）は9つとも同じ・離れると選んでいる地域
     (2) 欧州を選んで「条件/出典」→「対象」＝ 欧州のカードの見えている社名（頭の旗を外す）ちょうど・対象掲載社数・換算の文・ほかに何も無い →
         開いたまま別のボタンにマウス／フォーカス：カードはそのまま・そのボタンに is-hot → 別の地域を選ぶと閉じる →（1001・カードが地図の下）
         「条件/出典」を開いたまま地図のアフリカを指し、キーボードで閉じる → すぐアフリカ（1440 では開いた「条件/出典」が面を高くし、閉じると
         ボタンも地図も動いてマウスの下から外れる ── ページは正しく指しを外すので、ここは地図が動かない 1001 で見る）→
         05b との継ぎ目（#pv-rp の中の開いた <details> もカードを止め、選ぶと閉じる）→ 北米のボタンにフォーカスしたまま定義の行を押す → 北米のまま
     (3) #pv-rp の data-rp-region ＝ 見せている地域（マウス・フォーカス・選ぶ）・すべてと検索中は無い・「条件/出典」を開いたまま検索欄を空にすると戻る
     (4) 古いページ（PV-DIRMAP の中身を抜いて <base> を足した写しを temporary screenshots/wam-old-{lang}.html に書き、終わったら消す）＋ 新しい台本：
         止まらない・112社・欧州が選べる
     (5) 390 指：開いたときカードは閉じている（「すべて」の1行だけ）→ Tab で欧州（開かない）→ Enter（開く・scrollTo を呼ばない・ボタンは画面の中）→
         アジアを指で（結果の見出しの上端が画面の中）→ すべてを指で（開いたまま）
   場面 map-keys（1440×900）── 検索欄から Tab で地域のボタンへ → 9つとも :focus-visible・その地域のカード・その地域の光る層（.wam-o … .wam-lit）の
     opacity > 0（日本は丸も）→ Enter で選ぶ・スクロールしない／欧州を選んで Tab ×40・Shift+Tab ×40（<body> にも隠れた所にも <svg> の中にも
     落ちない）／すべてから Shift+Tab → 欧州のカードの中 → 欧州の「条件/出典」／Tab で北米・マウスで「条件/出典」→ 北米の中が開く／
     欧州の「条件/出典」にフォーカスしたまま setRegion('asia') → フォーカスはアジアの「条件/出典」→ 読み直す → region=asia（A13：履歴は積まない）
   場面 map-fit（1001×900・390×680。ライト）── 7つの通貨（currency.js の RATES）× 9枚のカード：額が切れない・カードの中・職位の札と額が重ならない・
     帯 72px 以上・凡例は面の中・横にはみ出さない・通貨を戻すと区域の字が1字も違わない・英語はドルで開き ¥ が無い／帯の点は会社の数・帯の両端と
     平均の印とどの点も、書いた額と目盛の右端の割合の所（0.6px 以内）・最低／最高は台帳どおり／assert-header.mjs の WIDTHS × 円・ドルで横にはみ出さない／
     ★1001・390 と WIDTHS で「機長｜副操縦士」の切り替えの箱に陸の点が1つも掛からない（onLand・WP-dmap-7）
   場面 map-point（1440×900・マウス）── 開いたとき何も光らない（日本の丸はかすか）／8つの POINT_AT を指す → その地域・光る・海と Moscow では
     そのまま・離れると戻る・カードの箱は動かない／押す → 選ぶ・opacity 1・結果の見出しが画面の中 → もう1回 → 外れる・動かない／
     ★当たり（リードの決め・WP-dmap-5）：8地域とも、点の中心（POINT_AT にいちばん近い点）と点と点のあいだ（その点と右下の点のまんなか ＝ どの点の
     中心からも 2.6・点の縁の外。点の並びは見本 sketch-v4 の決まりで、ここで形から作る）を押すとその地域が選ばれる・海（SEA）は何も選ばない
     （押す前にマウスは海に置き、is-hot が無いのを待つ）／?region=europe で開くと欧州だけ光る
   場面 map-tap（指・390×680・375×640・820×980）── 8つの POINT_AT に触れる → その地域を見せる・「この地域の航空会社を見る」が見える・選んでいる
     地域と一覧はそのまま・カードは画面の中・カードの箱は8つとも同じ → そのボタン → 選ばれる・結果の見出し・フォーカスは #wd-rh-name・ボタンは消える →
     地域のボタンを指で → すぐ選ばれ、結果の見出しの上端が画面の中／390 では地図の下の一言（クリックして選ぶ）を出さない・凡例は出ている（WP-dmap-7）
   場面 map-first（assert-hero-fold.mjs の SIZES の8つ・iPad とスマホは指）── 測って印字（ヒーローの下端・区域・地図・地域のボタンの下端・#wd-rh）・
     どの大きさでも検索欄が丸ごと画面の中で地図より上・何か打つと区域は箱を持たない。
     ★D37（リードの決め 2026-10-25）：地図とカードの面（.wam-g）が丸ごと最初の1画面の中（#wd-rh は印字だけ）。組んだ形で収まらない大きさは
       D37_OPEN（WP-dmap-7 が地図の上端と高さを変える）── そこでは「まだ収まらない」を数え、収まったら赤（外して数える）。関数 mapFirst の頭
     ★8つの大きさ（指）で「機長｜副操縦士」の切り替えの箱に陸の点が1つも掛からない（onLand・WP-dmap-7）

   動かせる地図（WP-dmap-9・オーナー「地図自体を自分で動かせるようにしたい（windy みたいに）」）── 地図の層は1つの <g class="wam-z">。
   倍率とずれはその transform を読み、拡大していても地図の上の点は zPt（その <g> の getScreenCTM）で写す。指は CDP の touch
   場面 map-move（class B・1440×900 のマウスと 390×680 の指）── 開いたときのボタン（1440：拡大・縮小・全画面／390：全画面だけ）・押していない地図の
     ホイールはページのスクロール・海を押す（フォーカス）→ 欧州の上でホイール → 拡大・欧州は指の下のまま・拡大していても指すと光る・つかんで動かす → ずれる・
     選ばない・動かさずに押す → 選ぶ・元に戻す／拡大／縮小のボタン・キー（+ → 0）・ctrl ＋ ホイール・6倍で止まり、いちばん遠くまで動かしても枠の四隅は
     地図の箱の中・拡大したまま「副操縦士」／390：2本の指で広げる → 拡大（ページは動かず・ページそのものも拡大しない・選ばない）・1本の指で上へ → ページが
     スクロールし、地図は動かず、「2本の指で動かせます」が出る・拡大したまま触れる → 見せる（選ぶのはボタン）・元に戻す
   場面 map-full（class B・390×680 の指と 1440×900 のマウス）── 全画面：開く（画面いっぱい・ページは止まる・履歴が1段・フォーカスは地図）・拡大して動かす・
     欧州 → カードが画面の中（指 ＝ 地図の下の板・マウス ＝ 地図の右）・Esc で閉じる（スクロールはそのまま）・もう1回開いても積み増さない・戻るで閉じる・
     北米 →「この地域の航空会社を見る」→ 閉じてから北米が選ばれ、住所は region=us・全画面の段は残らない
   ★場面 map-strip（class A・390×680 と 768×1024 の指）── 地域の9つのボタンがどれも画面の中に丸ごと（帯は横にすべらない）・字が切れない（オーナー #8）
   ★場面 head-name（class A・1440×900・ライトとダーク）── ログインしている会員の名前がサイトの緑の字で、ヘッダーの地とのコントラスト 4.5:1 以上（オーナー #18）

   使い方: node assert-directory-ui.mjs [--scenes base,first,nojs,search,scope,empty,url,back,touch,card,list,map-pos,map-card,map-keys,map-fit,map-point,map-tap,map-first,map-move,map-full,map-strip,head-name] [--lang ja,en] [--shots <リポジトリの外のフォルダ>]
     --shots  名前の付いた段ごとに PNG を1枚（<scene>-<lang>-<段>.png）
     back が入る回は、ブラウザを新しい headless で立てる（'shell' は戻るの手元置き場を使わない：BackForwardCacheDisabledForDelegate）。
     どの回も、名前を引けるのは localhost と LIBS の4つだけ（--host-resolver-rules ＝ 門の外のもう1枚の網）

   ほかの検査が読む名前（export）: dirOpen / ready / visible / QUIET_ALLOW / quiet
   ════════════════════════════════════════════════════════════════ */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bring, open, LIBS } from './local-chain.mjs';
import { SALARY } from './salary-data.mjs';
import { AIRLINE_COUNTRY, BY_CODE } from './airline-countries.mjs';
import { SWITCH, EN_SWITCH } from './airline-rollout.mjs';
import { POINT_AT, SEA, PROBES, toPage } from './world-outline-probes.mjs';
import { SHAPES } from './world-outline.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ── 共有の言葉（契約。台帳から作れないものだけここに書く）──────────────── */
/** 地域の8つの符号（この順が一覧の並び） */
const REG8 = ['japan', 'asia', 'mideast', 'africa', 'europe', 'us', 'oceania', 'latam'];
/** 地域の名前（日・英） */
const REGION_LABEL = {
  all: ['すべて', 'All'], japan: ['日本', 'Japan'], asia: ['アジア', 'Asia'], mideast: ['中東', 'Middle East'], africa: ['アフリカ', 'Africa'],
  europe: ['欧州', 'Europe'], us: ['北米', 'North America'], oceania: ['オセアニア', 'Oceania'], latam: ['中南米', 'Latin America'],
};
/** 社数の書き方（英語の1社だけ «1 airline» ＝ 進行役の決め C3） */
const COUNT = { ja: (n) => `${n}社`, en: (n) => (n === 1 ? '1 airline' : `${n} airlines`) };
/** 見つからないときの文（いまのページの字）と、絞り込みを解除の字（actual-pay.html の字） */
const NONE_SENT = { ja: '該当する航空会社が見つかりませんでした', en: 'No airlines matched your search' };
const CLEAR = { ja: '絞り込みを解除', en: 'Clear filters' };
/** 見出しの字（オーナーの字・進行役の決め C4） */
const H1 = { ja: '次のキャリアを、選択する', en: 'Choose your next career' };
/** 一覧の2枚のページ */
const PAGE_REL = { ja: 'world-airlines.html', en: 'en/world-airlines.html' };
/** 地図の上の一言（もとは見出しの帯の1行の前半。WP-dd-9 で地図の枠の中へ移した。字はそのまま） */
const HINT = { ja: '地図をクリックして地域を選択', en: 'Click the map to choose a region' };
/** 動かせる地図（WP-dmap-9）で、指で地図に触れた最初の1回だけ出る一言（シートの字 ＝ directory-map.mjs の WORDS.zoom.touch。字そのものは M11 が見張る） */
const ZOOM_HINT = { ja: '2本の指で動かせます', en: 'Use two fingers to move the map' };
/** 地域のまとめのカードの字（シートの字 ＝ directory-map.mjs の WORDS と同じ。字そのものは assert-directory.mjs の M11 が見張る）：
    指で地図に触れたあとのボタン・「条件/出典」の中の3つの見出し・対象掲載社数の書き方 */
const GO = { ja: 'この地域の航空会社を見る', en: 'View airlines in this region' };
const FOLD = { ja: ['対象', '対象掲載社数', '換算'], en: ['Airlines included', 'Number of airlines', 'Conversion'] };
const COUNT_N = { ja: (n) => `${n}社`, en: (n) => `${n}` };

/* ── 地図の点（WP-dmap-5 の「当たり」の行。リードの決め：点の中心と、点と点のあいだの1点。どちらでも選べる）──────────
   点の並びは見本 sketch-v4 の決まり（WP-dmap-4 の報告 (9)）：横 5.2・縦 5.2 × 0.866 の六角の並び。行 r の y ＝ r1(3.4 + r × 縦)（いちばん上の行 3.4 ＝ 陸のいちばん北のすぐ下 ── WP-dmap-7。前は 2.6）、
   その行の点 i の x ＝ r1((r が奇数なら 5.2、偶数なら 2.6) + i × 5.2)。点の太さ（直径）3.7。ここでは形（world-outline.mjs）から
   自分で作る ── 地図の部品（directory-map.mjs）の答えは写さない。ページの点がこの決まりどおりかは assert-directory.mjs の M16 が見る。 */
const DOT = { g: 5.2, row: 5.2 * 0.866, y0: 3.4 };
const r1 = (v) => Math.round(v * 10) / 10;
const RINGS = Object.fromEntries(Object.entries(SHAPES).map(([k, d]) => [k, String(d).split('M').filter((s) => s.trim()).map((s) => {
  const n = s.replace(/[lz]/g, () => ' ').match(/-?\d+/g).map(Number), pts = [[n[0], n[1]]];
  for (let i = 2; i + 1 < n.length; i += 2) { const p = pts[pts.length - 1]; pts.push([p[0] + n[i], p[1] + n[i + 1]]); }
  return pts;
})]));
/** 形 k の中か（偶奇の数え方） */
const inShape = (k, x, y) => {
  let c = false;
  for (const q of RINGS[k]) for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, yi] = q[i], [xj, yj] = q[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const onlyIn = (code, x, y) => inShape(code, x, y) && Object.keys(RINGS).every((k) => k === code || !inShape(k, x, y));
/** 地域ごとに、POINT_AT のいちばん近くの点の中心 D と、点と点のあいだの1点 G（D と右下の点のまんなか ＝ 2つの点の中心から 2.6・
    点の縁（半径 1.85）の外。点の行の線からも 2.25 離れていて、当たりの層の太い線（5.6）だけが答える所）。
    D と左右・左下・右下の点がどれもその地域だけの形の中（G のまわりはその地域の点だけ）。日本は形が小さくてそういう所が無い ──
    日本は目印の丸（当たりの層の円）が答えるので、D はその地域の中の点・G は D の右下とのまんなか */
const DOTGAP = Object.fromEntries(REG8.map((code) => {
  const p = POINT_AT[code], cand = [];
  for (let r = 0; r1(DOT.y0 + r * DOT.row) < 440; r++) {
    const y = r1(DOT.y0 + r * DOT.row), yn = r1(DOT.y0 + (r + 1) * DOT.row);
    if (Math.abs(y - p[1]) > 20) continue;
    for (let i = 0; r1((r % 2 ? DOT.g : DOT.g / 2) + i * DOT.g) < 1000; i++) {
      const x = r1((r % 2 ? DOT.g : DOT.g / 2) + i * DOT.g);
      if (Math.abs(x - p[0]) > 20 || !onlyIn(code, x, y)) continue;
      const ring = [[r1(x + DOT.g), y], [r1(x - DOT.g), y], [r1(x + DOT.g / 2), yn], [r1(x - DOT.g / 2), yn]].every(([a, b]) => onlyIn(code, a, b));
      cand.push({ ring, d: Math.hypot(x - p[0], y - p[1]), D: [x, y], G: [(x + r1(x + DOT.g / 2)) / 2, (y + yn) / 2] });
    }
  }
  const pick = (xs) => xs.sort((a, b) => a.d - b.d)[0] || null;
  const best = pick(cand.filter((c) => c.ring)) || (code === 'japan' ? pick(cand) : null);
  if (!best) throw new Error(`当たりの行：${code} の点が POINT_AT の近くに無い`);
  return [code, best];
}));

/* ── 読む（台帳）──────────────────────────────────────────── */
/** 一覧の行（airlines-meta.js の window.PV_AIRLINES）。slug は PV_slugOf で */
function listRows() {
  const win = {};
  new Function('window', read('airlines-meta.js'))(win);
  return win.PV_AIRLINES.map((r) => ({ ...r, slug: win.PV_slugOf(r) }));
}
const LIST = listRows();
const POS = new Map(LIST.map((r, i) => [r.slug, i]));
const ROW = new Map(LIST.map((r) => [r.slug, r]));
const SLUGS = Object.keys(SALARY);
/** 一覧の並び（地域の順 → 一覧の行の順） */
const ORDER = SLUGS.slice().sort((a, b) => (REG8.indexOf(SALARY[a].region) - REG8.indexOf(SALARY[b].region))
  || ((POS.get(a) ?? 1e9) - (POS.get(b) ?? 1e9)));
const inRegion = (code) => SLUGS.filter((s) => code === 'all' || SALARY[s].region === code);
/** ヘッダー検索の行（search.js の var DB = [ … ]; の中身）。slug を足して返す */
function headerRows() {
  const src = read('search.js'), a = src.indexOf('var DB = ['), z = src.indexOf('window.PV_DB = DB;');
  if (a < 0 || z < 0) throw new Error('search.js の形が変わった（var DB = [ / window.PV_DB = DB; が無い）');
  const rows = new Function('return ' + src.slice(a + 'var DB = '.length, src.lastIndexOf('];', z) + 1))();
  return rows.map((r) => ({ ...r, slug: String(r.f || '').replace(/^airlines\//, () => '').replace(/\.html$/, () => '') }));
}
const HEAD = new Map(headerRows().map((h) => [h.slug, h]));
const codeLike = (t) => /^[A-Z0-9]{2,3}$/.test(t);
const uniqStr = (xs) => [...new Set(xs.filter((x) => x != null && String(x) !== '').map(String))];
/** その会社の「自分の値」を6種類（日本語名・英語名・略称・コード・国名（日）・国名（英））。どれも打ったまま見つかること */
function ownValues(s) {
  const d = SALARY[s], r = ROW.get(s) || {}, t = (HEAD.get(s) || {}).t || [], c = BY_CODE[AIRLINE_COUNTRY[s]] || null, alt = (c && c.alt) || [];
  return {
    日本語名: uniqStr([d.ja, r.name]),
    英語名: uniqStr([d.en, r.en]),
    略称: uniqStr(t.filter((x) => !codeLike(x))),
    コード: uniqStr([r.code, ...t.filter(codeLike)]),
    '国名（日）': uniqStr(c ? [c.ja, ...alt] : []),
    '国名（英）': uniqStr(c ? [c.en, ...alt] : []),
  };
}
const ofCountry = (code) => SLUGS.filter((s) => AIRLINE_COUNTRY[s] === code);
/** その略号を持つ会社（一覧の行の略号と、ヘッダー検索の略号らしい語 ＝ コードの種類） */
const ofCode = (code) => SLUGS.filter((s) => ownValues(s).コード.includes(code));
const ofAlliance = (a) => SLUGS.filter((s) => (ROW.get(s) || {}).alliance === a);

/* ── 道具（export）──────────────────────────────────────────── */
/** 一覧のページが今の文書のあいだに呼んでよいサーバーの口（この一覧では空） */
export const QUIET_ALLOW = [];

/** カードのリンクが描かれ、通貨の切り替え（currency.js）が立ち上がるまで */
export function ready(page) {
  return page.waitForFunction(() => window.PVCurrency && document.querySelectorAll('#airline-grid a[href^="airlines/"]').length > 0);
}

/** 見えているカードの slug（DOM の順） */
export function visible(page) {
  return page.evaluate(() => [...document.querySelectorAll('#airline-grid a[href^="airlines/"]')]
    .filter((a) => a.getClientRects().length > 0)
    .map((a) => a.getAttribute('href').replace(/^airlines\//, () => '').replace(/\.html$/, () => '')));
}

/** 一覧のページを、新しい窓（context）で開く。
    st.segs ＝ 主の枠が移るたびに { at: その時の st.calls の本数, dir: 一覧のページか }（quiet が「一覧が開いていたあいだの呼び出し」を切り分ける）
    st.http4 ＝ 手元の配信元が 4xx / 5xx で答えた要求 */
export async function dirOpen(browser, L, { rel = 'world-airlines.html', query = '', w = 1440, h = 900, touch = false, theme = null, js = true, init = null, who = null } = {}) {
  const o = await open(browser, L.base, { w, h, touch, theme, who });   // who ＝ 手元の会員としてログインしておく（場面 head-name だけ）
  const { page, st } = o, origin = new URL(L.base).origin;
  if (init) await init(page);   // 最初の文書より先に置くもの（evaluateOnNewDocument など）
  st.segs = [];
  st.http4 = [];
  page.on('framenavigated', (f) => {
    if (f !== page.mainFrame()) return;
    let p = '';
    try { p = new URL(f.url()).pathname; } catch { p = ''; }
    st.segs.push({ at: st.calls.length, dir: /\/(en\/)?world-airlines\.html$/.test(p) });
  });
  page.on('response', (res) => {
    let u;
    try { u = new URL(res.url()); } catch { return; }
    if (u.origin === origin && res.status() >= 400) st.http4.push(`${res.status()} ${u.pathname}`);
  });
  if (js === false) await page.setJavaScriptEnabled(false);
  await page.goto(`${L.base}/${rel}${query}`, { waitUntil: js === false ? 'domcontentloaded' : 'load', timeout: 60000 });
  if (js !== false) await ready(page);
  return o;
}

/** 静かか（[] ＝ 静か）。外への通信（st.supa・st.blocked）と、一覧の文書が今だったあいだのサーバーの口の呼び出しで allow に無いもの */
export function quiet(st, label, { allow = QUIET_ALLOW } = {}) {
  const out = [...st.supa, ...st.blocked].map((x) => `${label}：外への通信 ${x}`);
  const segs = st.segs || [];
  st.calls.forEach((name, i) => {
    let seg = null;
    for (const s of segs) if (s.at <= i) seg = s;
    if (seg && seg.dir && !allow.includes(name)) out.push(`${label}：一覧のページがサーバーの口 ${name} を呼んだ（${i + 1}本目）`);
  });
  return out;
}

/* 手元のサーバーの前の口：サイトのファイルの no-store だけを GitHub Pages と同じ max-age=600 に替えて渡す（ほかは1字も替えない）。
   serve-local.mjs の no-store のままだと、ブラウザは一覧を手元に置かない（戻るがいつも読み直しになる ＝ 本番と違う）。
   assert-keep.mjs の pagesFront と同じ形の写し。3000 番では開かない。 */
async function frontOf(base) {
  const to = new URL(base);
  const srv = http.createServer((req, res) => {
    const up = http.request({ host: '127.0.0.1', port: to.port, path: req.url, method: req.method, headers: { ...req.headers, host: to.host } }, (r) => {
      const h = { ...r.headers };
      if (!/^\/(rest|auth|functions|storage|realtime)\/v1(\/|$)|^\/__local\//.test(req.url) && /no-store/.test(h['cache-control'] || '')) h['cache-control'] = 'max-age=600';
      res.writeHead(r.statusCode, h);
      r.pipe(res);
    });
    up.on('error', () => { try { res.writeHead(502); res.end(); } catch { /* もう書き始めていた */ } });
    req.pipe(up);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  if (port === 3000) { srv.close(); throw new Error('3000 番は使わない'); }
  return { base: `http://localhost:${port}`, close: () => new Promise((r) => { srv.close(r); srv.closeAllConnections?.(); }) };
}

/* ── 実行（このファイルを直接流したときだけ）────────────────────── */
/* ⚠️ 実体のパスどうしで比べる。リンク越し（/tmp → /private/tmp、写しの中のリンク）で流すと、Node は argv[1] をリンクのまま・
   import.meta.url を実体で持つので、素の path.resolve では一致せず「何も流さず exit 0」＝検査の門が黙って緑になる */
const realOf = (p) => { try { return fs.realpathSync(path.resolve(p)); } catch { return path.resolve(p); } };
if (process.argv[1] && realOf(process.argv[1]) === realOf(fileURLToPath(import.meta.url))) await main();

async function main() {
  const argv = process.argv.slice(2);
  const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const SCENES = { base, first, nojs, search, scope, empty, url, back, touch, card, list, 'map-pos': mapPos,
    'map-card': mapCard, 'map-keys': mapKeys, 'map-fit': mapFit, 'map-point': mapPoint, 'map-tap': mapTap, 'map-first': mapFirst,
    'map-move': mapMove, 'map-full': mapFull, 'map-strip': mapStrip, 'head-name': headName };
  const want = (val('--scenes') || Object.keys(SCENES).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = want.filter((s) => !SCENES[s]);
  if (unknown.length) { console.error(`✗ 知らない場面: ${unknown.join(', ')}（あるのは ${Object.keys(SCENES).join(', ')}）`); process.exit(2); }
  const LANGS = (val('--lang') || 'ja,en').split(',').map((s) => s.trim()).filter(Boolean);
  if (!LANGS.length || LANGS.some((l) => !PAGE_REL[l])) { console.error('✗ --lang は ja / en'); process.exit(2); }
  const SHOTS = val('--shots') ? path.resolve(val('--shots')) : '';
  if (SHOTS && (SHOTS + path.sep).startsWith(ROOT)) { console.error('✗ --shots はリポジトリの外に置く'); process.exit(2); }
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

  let pass = 0, fail = 0;
  const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? ' ' + e : ''))); };
  const J = (v) => { try { return JSON.stringify(v).slice(0, 400); } catch { return String(v); } };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const sameSet = (a, b) => same([...new Set(a)].sort(), [...new Set(b)].sort());

  const L = await bring();
  /* back が入る回だけ新しい headless（'shell' は戻るの手元置き場を使わない）。名前を引けるのは localhost と LIBS の4つだけ */
  const NO_NAMES = '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE cdn.jsdelivr.net, EXCLUDE fonts.googleapis.com, '
    + 'EXCLUDE fonts.gstatic.com, EXCLUDE cdn.tailwindcss.com';
  const browser = await puppeteer.launch({ headless: want.includes('back') ? true : 'shell', args: ['--no-sandbox', NO_NAMES] });
  let FRONT = null;
  const PAGES = [];
  console.log(`手元の使い捨ての保存先 ${L.base}（REAL LOCAL CONNECTION・3000 番でも本番でもない）`);

  /* 条件がそろうまで待つ（上限つき。時間では待たない）。そろわなければ false */
  const until = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 20000 }, ...args).then(() => true, () => false);
  const shot = async (page, scene, lang, name) => {
    if (!SHOTS) return;
    await page.screenshot({ path: path.join(SHOTS, `${scene}-${lang}-${name}.png`) });
  };
  const press = (page, sel) => page.click(sel);
  /* 検索欄に打つ（値を入れて input を1回） */
  const type = (page, s) => page.evaluate((s) => {
    const el = document.getElementById('search');
    el.value = s;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, s);
  const countText = (page) => page.evaluate(() => (document.getElementById('result-count') || {}).textContent || '');
  const pressed = (page) => page.evaluate(() => [...document.querySelectorAll('#region-strip .rstrip-btn')]
    .filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.region));
  const shown = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).display !== 'none'; }, sel);
  /* 要素の上で、その要素そのものに当たる点（地図の形は四角でないので、当たる所を探す） */
  const pointIn = (page, sel) => page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    for (let iy = 1; iy < 24; iy++) for (let ix = 1; ix < 24; ix++) {
      const x = r.left + (r.width * ix) / 24, y = r.top + (r.height * iy) / 24;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit.closest(sel)) return { x, y };
    }
    return null;
  }, sel);
  /* カードの社名が語の途中で折れていないか・切れていないか（WP-dd-9）── 折れてよいのは空白・「・」の後ろ・「（」の前だけ
     （括弧の中の略号は別の語）。見えているカードの社名ごとに、1字ずつの行の位置から折れ目を読む。[] ＝ どの社名も大丈夫 */
  const nameCut = (page) => page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('#airline-grid .wd-name')) {
      if (!el.getClientRects().length) continue;
      const n = el.firstChild;
      if (!n || n.nodeType !== 3 || el.childNodes.length !== 1) { bad.push(`${el.id}：社名が字だけでない`); continue; }
      let prevTop = null;
      for (let i = 0; i < n.data.length; i++) {
        const r = document.createRange();
        r.setStart(n, i); r.setEnd(n, i + 1);
        const q = r.getClientRects()[0];
        if (!q) continue;
        const top = Math.round(q.top);
        if (prevTop != null && top > prevTop + 3) {
          const a = n.data[i - 1], b = n.data[i];
          if (!(/\s/.test(a) || /\s/.test(b) || a === '・' || b === '（')) bad.push(`${n.data.slice(0, i)}／${n.data.slice(i)}`);
        }
        prevTop = top;
      }
      if (el.scrollWidth > el.clientWidth) bad.push(`${n.data}（切れている ${el.scrollWidth}／${el.clientWidth}px）`);
    }
    return bad;
  });
  /* 何コマか描き終わるまで（押した直後にブラウザが送る「マウスが上に来た」の知らせを待つ。時間ではなくコマで数える） */
  const settle = (page, n = 10) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  /* 滑らかなスクロールが止まるまで（2コマ続けて同じ位置） */
  const still = (page) => until(page, () => new Promise((res) => {
    const y = window.scrollY;
    requestAnimationFrame(() => requestAnimationFrame(() => res(window.scrollY === y)));
  }));

  async function base(lang) {
    const T = (s) => `[${lang}] ${s}`, C = COUNT[lang];
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang] });
    PAGES.push(P);
    const { page, st } = P;
    try {
      /* b1 */
      const v1 = await visible(page);
      ok(same(v1, ORDER), T(`b1 見えているカード ＝ 台帳の${ORDER.length}社を一覧の並びで`), J({ n: v1.length, first: v1.slice(0, 3) }));
      const c1 = await countText(page);
      ok(c1 === C(ORDER.length), T(`b1 社数「${C(ORDER.length)}」`), J(c1));
      const nc1 = await nameCut(page);
      ok(nc1.length === 0, T('b1 1440：どのカードの社名も語の途中で折れず、切れていない（折れ目は空白・「・」の後ろ・「（」の前だけ）'), J(nc1));
      await shot(page, 'base', lang, 'b1');

      /* b2 地域のボタン（すべて ＋ 8地域） */
      for (const code of ['all', ...REG8]) {
        await press(page, `#region-strip .rstrip-btn[data-region="${code}"]`);
        const exp = inRegion(code);
        const on = await until(page, (code) => {
          const b = document.querySelector(`#region-strip .rstrip-btn[data-region="${code}"]`);
          return !!b && b.getAttribute('aria-pressed') === 'true';
        }, code);
        const v = await visible(page), c = await countText(page), pr = await pressed(page);
        ok(on && sameSet(v, exp) && v.length === exp.length && c === C(exp.length) && same(pr, [code]),
          T(`b2 ${REGION_LABEL[code][lang === 'en' ? 1 : 0]} → その地域の${exp.length}社・社数「${C(exp.length)}」・押したボタンだけ aria-pressed="true"`),
          J({ n: v.length, c, pr }));
        if (code === 'europe') await shot(page, 'base', lang, 'b2-europe');
      }
      await press(page, '#region-strip .rstrip-btn[data-region="all"]');

      /* b3 種類の絞り込み（FSC・LCC/ULCC・免税）は WP-dmap-7 で口ごと外した（オーナー P12.114）。無いことは静的な G10（assert-directory.mjs）が見る */

      /* b4 レベリング比較 ⇄ カード一覧 */
      await press(page, '.view-btn[data-view="range"]');
      const cols = await until(page, () => document.querySelectorAll('#lvl-wa-grid .lvl-col').length === 4);
      const fb = await shown(page, '#filter-bar');
      ok(cols && !fb, T('b4 レベリング比較 → 絞り込みの帯が消え、#lvl-wa-grid に4本の .lvl-col'),
        J({ cols: await page.evaluate(() => document.querySelectorAll('#lvl-wa-grid .lvl-col').length), filterBar: fb }));
      await shot(page, 'base', lang, 'b4-range');
      await press(page, '.view-btn[data-view="card"]');
      const back = await until(page, () => getComputedStyle(document.getElementById('range-view')).display === 'none');
      const v4 = await visible(page), fb2 = await shown(page, '#filter-bar');
      ok(back && fb2 && same(v4, ORDER), T('b4 カード一覧 → 絞り込みの帯と112枚のカードに戻る'), J({ back, filterBar: fb2, n: v4.length }));

      /* b5 テーマ */
      const th0 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await press(page, '#theme-toggle');
      const th1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await press(page, '#theme-toggle');
      const th2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      ok(['light', 'dark'].includes(th0) && th1 === (th0 === 'dark' ? 'light' : 'dark') && th2 === th0,
        T('b5 テーマのボタンで data-theme が入れ替わり、もう1回で戻る'), J([th0, th1, th2]));

      /* b6 地域のまとめ（古い地図は WP-dmap-4 で消えた ── 3行を design l.1095-1100 のとおり、新しい地図なしでも成り立つ形へ付け替えた：
         吹き出し → カードの見せている1枚・地図のアジアを押す → アジアのボタンを押す・ピンの8つの社数 → 9枚のカードの社数） */
      const AS = '#region-strip .rstrip-btn[data-region="asia"]', nAsia = inRegion('asia').length;
      await page.mouse.move(2, 2);
      await page.hover(AS);
      const hov = await until(page, (n) => {
        const p = document.querySelector('.wam-panel.is-shown');
        return !!p && p.id === 'wam-p-asia' && (/(\d+)/.exec((p.querySelector('.wam-def') || {}).textContent || '') || [])[1] === String(n);
      }, nAsia);
      ok(hov, T(`b6 アジアのボタンにマウスを載せる → カードが見せているのは wam-p-asia・定義の行の社数 ${nAsia}`),
        J(await page.evaluate(() => { const p = document.querySelector('.wam-panel.is-shown'); return p ? [p.id, (p.querySelector('.wam-def') || {}).textContent] : null; })));
      await shot(page, 'base', lang, 'b6-card');
      await press(page, AS);
      const sel1 = await until(page, () => { const b = document.querySelector('#region-strip .rstrip-btn[data-region="asia"]'); return !!b && b.getAttribute('aria-pressed') === 'true'; });
      const v6 = await visible(page);
      ok(sel1 && sameSet(v6, inRegion('asia')) && v6.length === nAsia, T(`b6 そのボタンを押す → アジアが選ばれ、${nAsia}社`), J({ n: v6.length }));
      await still(page);
      await press(page, AS);
      const sel2 = await until(page, () => { const b = document.querySelector('#region-strip .rstrip-btn[data-region="all"]'); return !!b && b.getAttribute('aria-pressed') === 'true'; });
      const v6b = await visible(page);
      ok(sel2 && same(v6b, ORDER), T('b6 もう1回押す → 選ぶのをやめ、112社に戻る'), J({ n: v6b.length, pr: await pressed(page) }));
      await still(page);
      const nums = await page.evaluate((codes) => codes.map((c) => ((/(\d+)/.exec(((document.querySelector(`#wam-p-${c} .wam-def`) || {}).textContent) || '') || [])[1] || '')), ['all', ...REG8]);
      const numWant = ['all', ...REG8].map((c) => String(inRegion(c).length));
      ok(same(nums, numWant), T('b6 9枚のカードの社数（定義の行）＝ 地域の社数'), J({ nums, numWant }));

      /* b7 一覧の検索欄 */
      await type(page, 'emirates');
      const em = await until(page, () => { const a = document.querySelector('#airline-grid a[href="airlines/emirates.html"]'); return !!a && a.getClientRects().length > 0 && [...document.querySelectorAll('#airline-grid a[href^="airlines/"]')].some((x) => x.getClientRects().length === 0); });
      const v7 = await visible(page);
      ok(em && v7.includes('emirates') && v7.length < ORDER.length, T('b7 «emirates» → エミレーツが見えている（絞り込まれている）'), J({ n: v7.length }));
      await type(page, 'zzzz');
      const none = await until(page, () => { const n = document.getElementById('no-results'); return !!n && getComputedStyle(n).display !== 'none'; });
      const v7b = await visible(page);
      ok(none && v7b.length === 0, T('b7 «zzzz» → 見つからない（#no-results）・カードは0枚'), J({ n: v7b.length }));
      await shot(page, 'base', lang, 'b7-none');
      await type(page, '');
      const v7c = await visible(page);
      ok(same(v7c, ORDER), T('b7 検索欄を空に → 112社に戻る'), J({ n: v7c.length }));

      /* b8 ヘッダーの検索 */
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await press(page, '#pv-search-btn');
      await until(page, () => { const i = document.getElementById('pv-search-input'); return !!i && i.getClientRects().length > 0; });
      await page.evaluate(() => {
        const el = document.getElementById('pv-search-input');
        el.value = 'Solairus';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const hs = await until(page, () => [...document.querySelectorAll('#pv-search-dd a.pv-si')]
        .some((a) => a.getClientRects().length > 0 && (a.getAttribute('href') || '').endsWith('airlines/solairus.html')));
      ok(hs, T('b8 ヘッダーの検索で «Solairus» → airlines/solairus.html へのリンク'),
        J(await page.evaluate(() => [...document.querySelectorAll('#pv-search-dd a.pv-si')].map((a) => a.getAttribute('href')))));
      await shot(page, 'base', lang, 'b8-header');

      /* b9 静か */
      const q = quiet(st, 'base');
      ok(q.length === 0, T('b9 quiet(st, \'base\') が空 ── 外への通信も、一覧のページからのサーバーの口の呼び出しも無い'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 first（日英・390×680 のスマホ）── 開いた最初の1画面に、見出しのすぐ下の大きな検索欄 */
  async function first(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: 390, h: 680, touch: true });
    PAGES.push(P);
    const { page, st } = P;
    try {
      await page.evaluate(() => document.fonts && document.fonts.ready);
      const m = await page.evaluate(() => {
        const s = document.getElementById('search'), h1 = document.querySelector('#wa-hero h1'), hero = document.getElementById('wa-hero');
        const r = s ? s.getBoundingClientRect() : null;
        /* 見出しと検索欄のあいだ（#wa-hero の中・文書の順）に押せるものが無い */
        const between = !h1 || !s ? ['?'] : [...hero.querySelectorAll('a[href],button,input,select,textarea,[tabindex],[role="button"]')]
          .filter((e) => e !== s && e.getClientRects().length > 0
            && (h1.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) && (e.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING))
          .map((e) => e.outerHTML.slice(0, 80));
        const shownEl = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
        return {
          rect: r && { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }, vh: window.innerHeight,
          font: s ? parseFloat(getComputedStyle(s).fontSize) : 0, h1: h1 ? h1.textContent : null, between,
          h2: (document.getElementById('wd-rh-name') || {}).textContent ?? null,
          shown: ['#wd-scope', '#wd-clear', '#wd-scope-e', '#wd-clear-e', '.wd-else-b'].filter((sel) => [...document.querySelectorAll(sel)].some(shownEl)),
        };
      });
      ok(!!m.rect && m.rect.top >= 0 && m.rect.bottom <= m.vh, T(`first #search が最初の1画面（390×680）の中`), J(m.rect));
      ok(!!m.rect && m.rect.h >= 48, T('first #search の高さ 48px 以上'), J(m.rect));
      ok(m.font >= 16, T('first #search の字 16px 以上（iOS の拡大を起こさない）'), J(m.font));
      ok(m.between.length === 0, T('first 見出しと検索欄のあいだに押せるものが無い'), J(m.between));
      ok(m.h1 === H1[lang], T(`first 見出し「${H1[lang]}」`), J(m.h1));
      ok(m.h2 === REGION_LABEL.all[lang === 'en' ? 1 : 0], T(`first 結果の見出し「${REGION_LABEL.all[lang === 'en' ? 1 : 0]}」`), J(m.h2));
      ok(m.shown.length === 0, T('first 開いたときは、地域の札・解除・見つからないときのボタンを見せない'), J(m.shown));
      const nc = await nameCut(page);
      ok(nc.length === 0, T('first 390：どのカードの社名も語の途中で折れず、切れていない（折れ目は空白・「・」の後ろ・「（」の前だけ）'), J(nc));
      await shot(page, 'first', lang, '390');
      const q = quiet(st, 'first');
      ok(q.length === 0, T('first quiet(st, \'first\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 nojs（日英・台本を止めたブラウザ）── 112社のリンクと見出しは HTML だけで読め、台本が要る部品は見せない */
  async function nojs(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], js: false });
    PAGES.push(P);
    const { page, st } = P;
    try {
      const v = await visible(page);
      ok(same(v, ORDER), T(`nojs 台帳の${ORDER.length}社のリンクが見えている（一覧の並び）`), J({ n: v.length }));
      const h2 = await page.evaluate(() => (document.getElementById('wd-rh-name') || {}).textContent ?? null);
      ok(h2 === REGION_LABEL.all[lang === 'en' ? 1 : 0], T(`nojs h2#wd-rh-name「${REGION_LABEL.all[lang === 'en' ? 1 : 0]}」`), J(h2));
      const vis = await page.evaluate(() => ['.wd-search', '#filter-bar', '.view-toggle', '.map-wrapper', '.wd-cmp', '.wd-tray']
        .filter((sel) => [...document.querySelectorAll(sel)].some((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0)));
      ok(vis.length === 0, T('nojs 検索欄・絞り込みの帯・表示の切り替え・古い地図・比べる印・盆を見せない'), J(vis));
      await shot(page, 'nojs', lang, '1440');
      const q = quiet(st, 'nojs');
      ok(q.length === 0, T('nojs quiet(st, \'nojs\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 検索欄に打って、見えているカード（DOM の順）を返す（打つと台本はその場で並べ直す。待つものは無い） */
  const typed = async (page, s) => { await type(page, s); return visible(page); };
  const regionOfSlug = (s) => SALARY[s].region;

  /* 場面 search（日英・1440×900）── 6種類の自分の値・決めた例・国の帯と地図・レベリング比較からの戻り */
  async function search(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang] });
    PAGES.push(P);
    const { page, st } = P;
    try {
      /* s1 112社 × 6種類の自分の値（ブラウザの中で1つずつ打つ。打つたびに input を1回） */
      const vals = [], perKind = {};
      for (const s of SLUGS) for (const [kind, vs] of Object.entries(ownValues(s))) for (const v of vs) { vals.push([s, v, kind]); perKind[kind] = (perKind[kind] || 0) + 1; }
      const misses = [];
      for (let i = 0; i < vals.length; i += 200) {
        misses.push(...await page.evaluate((chunk) => {
          const el = document.getElementById('search'), out = [];
          for (const [s, v, kind] of chunk) {
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            const a = document.querySelector(`#airline-grid a[href="airlines/${s}.html"]`);
            if (!a || a.getClientRects().length === 0) out.push(`${s}「${v}」（${kind}）`);
          }
          return out;
        }, vals.slice(i, i + 200)));
      }
      console.log(`  ${T(`s1 自分の値 ${vals.length} 個（${Object.entries(perKind).map(([k, n]) => `${k} ${n}`).join('・')}）・会社 ${SLUGS.length}社`)}`);
      ok(vals.length > 0 && misses.length === 0, T(`s1 ${SLUGS.length}社の自分の値 ${vals.length} 個をそのまま打つ → どれもその会社が見えている（外れ ${misses.length}）`), J(misses.slice(0, 12)));

      /* s2 決めた例（期待する集合は台帳から） */
      const PINS = [];
      for (const c of ['NH', 'JL', 'EK', 'EY', 'AXC']) PINS.push({ qs: [c], exact: ofCode(c), name: `略号 ${c} を持つ会社だけ` });
      PINS.push({ qs: ['UA'], first: 'united', name: '先頭がユナイテッド' });
      PINS.push({ qs: ['BA'], first: 'british-airways', name: '先頭が英国航空' });
      PINS.push({ qs: ['ANA', 'ＡＮＡ', 'ana '], first: 'ana', all: (s) => AIRLINE_COUNTRY[s] === 'JP', not: ['jal', 'ryanair'], name: '先頭が ANA・日本の会社だけ・jal と ryanair は出ない' });
      PINS.push({ qs: ['US', 'USA', '米国', 'America', 'アメリカ', 'アメリカ合衆国'], exact: ofCountry('US'), name: '国が US の会社ちょうど' });
      PINS.push({ qs: ['UK', 'GB', '英国', 'Britain', 'Great Britain', 'England'], exact: ofCountry('GB'), name: '国が GB の会社ちょうど' });
      PINS.push({ qs: ['JP', '日本'], exact: ofCountry('JP'), name: '国が JP の会社ちょうど' });
      PINS.push({ qs: ['ドイツ', 'Germany'], exact: ofCountry('DE'), name: '国が DE の会社ちょうど' });
      PINS.push({ qs: ['フランス', 'France', 'エール フランス', 'エールフランス', 'air france', 'airfrance'], exact: ['air-france'], name: 'エールフランスだけ' });
      PINS.push({ qs: ['台湾', 'Taiwan'], exact: ofCountry('TW'), name: '国が TW の会社ちょうど' });
      PINS.push({ qs: ['インド'], india: true, name: '先頭の2社が IN・あとは ID だけ' });
      PINS.push({ qs: ['India'], exact: ofCountry('IN'), name: '国が IN の会社ちょうど' });
      PINS.push({ qs: ['マルタ', 'Malta'], exact: ['airx-charter'], name: 'エアX・チャーターだけ' });
      PINS.push({ qs: ['トルコ', 'Türkiye', 'Turkiye'], exact: ['turkish-airlines'], name: 'ターキッシュ エアラインズだけ' });
      PINS.push({ qs: ['全日空'], exact: ['ana'], name: 'ANA だけ' });
      PINS.push({ qs: ['ぴーち', 'ピーチ'], exact: ['peach'], name: 'ピーチだけ' });
      PINS.push({ qs: ['ｴﾐﾚｰﾂ'], first: 'emirates', name: '先頭がエミレーツ' });
      PINS.push({ qs: ['ワンワールド', 'oneworld'], exact: ofAlliance('ワンワールド'), name: '一覧の行の提携がワンワールドの会社ちょうど' });
      PINS.push({ qs: ['zzzz'], exact: [], name: '0社' });
      const IN = ofCountry('IN'), ID = ofCountry('ID');
      let nPin = 0, nPinOk = 0;
      for (const p of PINS) for (const q of p.qs) {
        const v = await typed(page, q);
        let good = true;
        if (p.exact) good = good && sameSet(v, p.exact) && v.length === p.exact.length;
        if (p.first) good = good && v[0] === p.first;
        if (p.all) good = good && v.length > 0 && v.every(p.all);
        if (p.not) good = good && p.not.every((s) => !v.includes(s));
        if (p.india) good = good && v.length > 2 && sameSet(v.slice(0, 2), IN) && v.slice(2).every((s) => ID.includes(s));
        nPin++; if (good) nPinOk++;
        ok(good, T(`s2 «${q}» → ${p.name}${p.exact ? `（${p.exact.length}社）` : ''}`), J({ n: v.length, v: v.slice(0, 14) }));
      }
      console.log(`  ${T(`s2 決めた例 ${nPin} 個のうち ${nPinOk} 個が通った`)}`);
      if (SHOTS) {
        for (const [name, q] of [['ja-name', 'エミレーツ航空'], ['en-name', 'Lufthansa'], ['abbr', '全日空'], ['code', 'NH'], ['country-ja', 'ドイツ'], ['country-en', 'Britain'], ['miss', 'zzzz']]) {
          await typed(page, q);
          await page.evaluate(() => { const r = document.getElementById('search'); r.scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy({ top: -90, behavior: 'instant' }); });
          await shot(page, 'search', lang, name);
        }
      }

      /* s3 国の帯と古い地図（#wd-explore）は、打っているあいだ見せない */
      await type(page, 'emirates');
      const ex1 = await shown(page, '#wd-explore');
      await type(page, '');
      const ex2 = await shown(page, '#wd-explore'), v3 = await visible(page);
      ok(!ex1 && ex2 && same(v3, ORDER), T('s3 打っているあいだは #wd-explore を見せない・空にすると見せて112社に戻る'), J({ typing: ex1, empty: ex2, n: v3.length }));
      /* s3b 地図の一言は、地図の枠の中に1つだけ（見出しの帯には無い）・打っているあいだは地図と一緒に見えない（WP-dd-9）。
         枠は WP-dmap-4 から新しい地図の列（.wam-mc ── 古い地図の .map-wrapper は消えた。一言は地図の下の行） */
      const hintOf = () => page.evaluate((t) => {
        const ps = [...document.querySelectorAll('p')].filter((p) => p.textContent.includes(t)), hero = document.getElementById('wa-hero');
        return { n: ps.length, inMap: ps.filter((p) => p.closest('.wam-mc')).length, hero: !!hero && hero.textContent.includes(t), seen: ps.filter((p) => p.getClientRects().length > 0).length };
      }, HINT[lang]);
      const hn0 = await hintOf();
      await type(page, 'emirates');
      const hn1 = await hintOf();
      await type(page, '');
      const hn2 = await hintOf();
      ok(hn0.n === 1 && hn0.inMap === 1 && !hn0.hero && hn0.seen === 1 && hn1.seen === 0 && hn2.seen === 1,
        T(`s3b 「${HINT[lang]}」は地図の枠の中に1つ（見出しの帯には無い）・打っているあいだは地図と一緒に見えない・空にすると戻る`), J({ hn0, hn1, hn2 }));

      /* s4 レベリング比較を開いたまま打つ → カード一覧に戻る */
      await press(page, '.view-btn[data-view="range"]');
      const cols = await until(page, () => document.querySelectorAll('#lvl-wa-grid .lvl-col').length === 4);
      await type(page, 'jal');
      const back = await until(page, () => getComputedStyle(document.getElementById('range-view')).display === 'none'
        && getComputedStyle(document.getElementById('airline-grid')).display !== 'none'
        && document.querySelector('.view-btn[data-view="card"]').classList.contains('active'));
      const v4 = await visible(page);
      ok(cols && back && v4.includes('jal'), T('s4 レベリング比較を開いたまま «jal» → カード一覧に戻り、JAL が見えている'), J({ cols, back, v: v4.slice(0, 5) }));
      await type(page, '');

      const q = quiet(st, 'search');
      ok(q.length === 0, T('search quiet(st, \'search\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 scope（日英・390×680 のスマホ）── 地域を選んだまま、別の地域にだけ在る会社を打つ */
  async function scope(lang) {
    const T = (s) => `[${lang}] ${s}`, C = COUNT[lang], li = lang === 'en' ? 1 : 0;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: 390, h: 680, touch: true });
    PAGES.push(P);
    const { page, st } = P;
    try {
      const EU = REGION_LABEL.europe[li], JPN = REGION_LABEL.japan[li], Q = '全日空';
      /* 台帳で数える「全日空」を持つ会社（一覧の行・ヘッダー検索の略称・社名）と、地域ごとの数 */
      const holders = SLUGS.filter((s) => Object.values(ownValues(s)).flat().some((v) => v.includes(Q)));
      const hitIn = (code) => holders.filter((s) => regionOfSlug(s) === code).length;
      const chip = () => page.evaluate(() => { const c = document.getElementById('wd-scope'); return c && getComputedStyle(c).display !== 'none' && c.getClientRects().length > 0 ? c.textContent : null; });
      const elseShown = () => page.evaluate(() => [...document.querySelectorAll('#wd-else .wd-else-b')]
        .filter((b) => getComputedStyle(b).display !== 'none' && b.getClientRects().length > 0)
        .map((b) => ({ region: b.dataset.region, l: (b.querySelector('.wd-else-l') || {}).textContent, n: (b.querySelector('.wd-else-n') || {}).textContent })));
      const stripN = (code) => page.evaluate((code) => ((document.querySelector(`#region-strip .rstrip-btn[data-region="${code}"] .rstrip-n`) || {}).textContent || ''), code);

      /* 欧州を選ぶ → 欄の中の札 */
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      const on1 = await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="europe"]') || {}).getAttribute?.('aria-pressed') === 'true');
      const c1 = await chip();
      ok(on1 && c1 === EU && same(await pressed(page), ['europe']), T(`scope 欧州を選ぶ → 欄の中の札「${EU}」・欧州だけ aria-pressed="true"`), J({ chip: c1, pr: await pressed(page) }));
      await shot(page, 'scope', lang, '1-europe');

      /* 「全日空」＋ Enter（本当に欄に触って Enter を押す） */
      await page.focus('#search');
      await type(page, Q);
      const hl0 = await page.evaluate(() => history.length);
      await page.keyboard.press('Enter');
      /* Enter は結果の見出しを上の帯（固定のヘッダー）のすぐ下へ送る。真上の地域のボタンも一緒に入るなら、ボタンから（WP-dmap-7・リード 2026-10-25：
         種類の列が無くなってボタンは見出しの真上 ── 見出しだけを 86px に置くとボタンがヘッダーの裏に入る）。
         ボタンの上端が 86px に着くか、ページの底に着くまで待ってから、止まるのを待つ */
      const arrived = await until(page, () => {
        const s = document.getElementById('region-strip').getBoundingClientRect(), maxY = document.documentElement.scrollHeight - window.innerHeight;
        return Math.abs(s.top - 86) <= 2 || Math.abs(window.scrollY - maxY) <= 1;
      });
      await still(page);
      const at = await page.evaluate(() => {
        const s = document.getElementById('region-strip').getBoundingClientRect(), r = document.getElementById('wd-rh').getBoundingClientRect();
        const b = document.querySelector('#region-strip .rstrip-btn[aria-pressed="true"]'), c = b && b.getBoundingClientRect(), h = c && document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
        return { strip: Math.round(s.top), rh: [Math.round(r.top), Math.round(r.bottom)], vh: window.innerHeight, hit: !!h && (h === b || b.contains(h)) };
      });
      ok(arrived && at.strip >= 84 && at.rh[0] >= at.strip && at.rh[1] <= at.vh && at.hit,
        T('scope Enter → 地域のボタンと結果の見出しが上の帯のすぐ下・どちらもヘッダーの裏に無い（押してある欧州のボタンのまんなかに当たるのは、そのボタン）'), J(at));
      const v2 = await visible(page), e2 = await elseShown(), none2 = await shown(page, '#wd-none'), n2 = await stripN('europe');
      ok(v2.length === 0, T(`scope 欧州 ＋「${Q}」＋ Enter → カード0枚`), J(v2));
      ok(!none2, T('scope 見つからないの文（#wd-none）を出さない（会社は在る）'), J(none2));
      ok(holders.length === 1 && e2.length === 1 && e2[0].region === 'japan' && e2[0].l === JPN && e2[0].n === String(hitIn('japan')),
        T(`scope #wd-else のボタンは「${JPN} ${hitIn('japan')}」の1つだけ`), J({ e2, holders }));
      ok(n2 === String(hitIn('europe')), T(`scope 欧州の帯の数 ＝ 台帳で数えた欧州の当たり（${hitIn('europe')}）`), J(n2));
      const geo = await page.evaluate(() => {
        const b = [...document.querySelectorAll('#wd-else .wd-else-b')].find((x) => x.getClientRects().length > 0);
        const r = b ? b.getBoundingClientRect() : null;
        return { r: r && { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }, vw: window.innerWidth, vh: window.innerHeight,
          sx: window.scrollX, sw: document.documentElement.scrollWidth };
      });
      ok(!!geo.r && geo.r.l >= 0 && geo.r.r <= geo.vw && geo.r.t >= 0 && geo.r.b <= geo.vh && geo.sx === 0 && geo.sw <= geo.vw,
        T('scope Enter のあと、そのボタンは画面の中（横にずらさずに見える）'), J(geo));
      await shot(page, 'scope', lang, '2-else');

      /* そのボタンを押す → 日本・ANA・欄はそのまま・履歴は増えない */
      await press(page, '#wd-else .wd-else-b[data-region="japan"]');
      const on3 = await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="japan"]') || {}).getAttribute?.('aria-pressed') === 'true');
      const v3 = await visible(page), f3 = await page.evaluate(() => document.getElementById('search').value), hl3 = await page.evaluate(() => history.length);
      const c3 = await countText(page), h3 = await page.evaluate(() => (document.getElementById('wd-rh-name') || {}).textContent);
      ok(on3 && same(v3, ['ana']) && f3 === Q && hl3 === hl0 && (await chip()) === JPN,
        T(`scope 「${JPN} 1」を押す → ${JPN}が選ばれ、ANA が見える・欄は「${Q}」のまま・history.length は増えない`), J({ on3, v3, f3, hl0, hl3 }));
      ok(h3 === JPN && c3 === C(1), T(`scope 結果の見出し「${JPN}」「${C(1)}」（英語の1社は «1 airline»）`), J({ h3, c3 }));
      await shot(page, 'scope', lang, '3-japan');

      /* 欧州に戻して、札を押す → すべて・先頭が ANA・見えている数 ＝ すべての数 */
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="europe"]') || {}).getAttribute?.('aria-pressed') === 'true');
      const e4 = await elseShown();
      /* 欄の札は検索欄の中 ── Enter のあと欄は地域のボタンの上 ＝ 固定のヘッダーの裏（WP-dmap-7 の計り：欄 15〜69px・ヘッダーの下端 71px）。
         画面の中なので page.click は動かさずにそこを押し、ヘッダーを押してしまう。読む人と同じく、押す前に欄をまんなかへ送る（地域のボタンは送らない ── Enter が見せている） */
      await page.$eval('#wd-scope', (e) => e.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
      await still(page);
      await press(page, '#wd-scope');
      const on4 = await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="all"]') || {}).getAttribute?.('aria-pressed') === 'true');
      const v4 = await visible(page), nAll = await stripN('all'), c4 = await chip();
      ok(e4.length === 1 && on4 && v4[0] === 'ana' && String(v4.length) === nAll && c4 === null,
        T('scope 欧州に戻して欄の札を押す → すべて・先頭が ANA・見えている数 ＝「すべて」の数・札は消える'), J({ e4, on4, v4, nAll, c4 }));
      await shot(page, 'scope', lang, '4-all');

      /* 欧州 ＋ «air» → 見えているのは欧州の会社だけ・社数 ＝ その数 → 欧州をもう1回 → 外れる */
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="europe"]') || {}).getAttribute?.('aria-pressed') === 'true');
      const v5 = await typed(page, 'air'), c5 = await countText(page);
      ok(v5.length > 0 && v5.every((s) => regionOfSlug(s) === 'europe') && c5 === C(v5.length),
        T(`scope 欧州 ＋ «air» → 見えている${v5.length}社はどれも欧州・社数「${C(v5.length)}」`), J({ n: v5.length, c5, notEU: v5.filter((s) => regionOfSlug(s) !== 'europe') }));
      await shot(page, 'scope', lang, '5-europe-air');
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      const off = await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="all"]') || {}).getAttribute?.('aria-pressed') === 'true');
      ok(off && same(await pressed(page), ['all']) && (await chip()) === null, T('scope 欧州をもう1回押す → 外れて「すべて」・札は消える'), J(await pressed(page)));

      const q = quiet(st, 'scope');
      ok(q.length === 0, T('scope quiet(st, \'scope\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 empty（日英・1440×900）── どの地域にも無い字 → 文と「絞り込みを解除」→ 元に戻る */
  async function empty(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang] });
    PAGES.push(P);
    const { page, st } = P;
    try {
      const shownList = (sels) => page.evaluate((sels) => sels.filter((sel) => [...document.querySelectorAll(sel)]
        .some((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0)), sels);
      const v1 = await typed(page, 'zzzz');
      const txt = await page.evaluate(() => ({ none: (document.getElementById('wd-none') || {}).textContent, clr: (document.getElementById('wd-clear-e') || {}).textContent }));
      const s1 = await shownList(['#no-results', '#wd-none', '#wd-clear-e', '#wd-else .wd-else-b', '#wd-scope-e']);
      const c1 = await countText(page);
      ok(v1.length === 0 && s1.includes('#no-results') && s1.includes('#wd-none') && txt.none === NONE_SENT[lang],
        T(`empty «zzzz» → カード0枚・文「${NONE_SENT[lang]}」`), J({ n: v1.length, s1, txt }));
      ok(s1.includes('#wd-clear-e') && txt.clr === CLEAR[lang], T(`empty 「${CLEAR[lang]}」が見えている`), J({ s1, txt }));
      ok(!s1.includes('#wd-else .wd-else-b') && !s1.includes('#wd-scope-e'), T('empty 地域のボタンも地域の札も出さない（どの地域にも無い）'), J(s1));
      ok(c1 === '', T('empty 社数は空（「0社」と書かない）'), J(c1));
      await page.evaluate(() => document.getElementById('no-results').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await shot(page, 'empty', lang, '1-none');
      await press(page, '#wd-clear-e');
      const back = await until(page, () => [...document.querySelectorAll('#airline-grid a[href^="airlines/"]')].every((a) => a.getClientRects().length > 0));
      const v2 = await visible(page), f2 = await page.evaluate(() => document.getElementById('search').value), s2 = await shownList(['#wd-clear-e', '#wd-clear', '#no-results']);
      ok(back && same(v2, ORDER) && f2 === '' && same(await pressed(page), ['all']) && s2.length === 0,
        T(`empty 「${CLEAR[lang]}」を押す → 112社・欄は空・すべてが押されている・解除のボタンは隠れる`), J({ n: v2.length, f2, pr: await pressed(page), s2 }));
      const q = quiet(st, 'empty');
      ok(q.length === 0, T('empty quiet(st, \'empty\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* ── 住所と「戻る」の場面で使う道具（WP-dd-6）── */
  const fieldOf = (page) => page.evaluate(() => document.getElementById('search').value);
  const stateOf = (page) => page.evaluate(() => (window.PVDirectory ? window.PVDirectory.state() : null));
  const chipOf = (page) => page.evaluate(() => { const c = document.getElementById('wd-scope'); return c && getComputedStyle(c).display !== 'none' && c.getClientRects().length > 0 ? c.textContent : null; });
  const addr = (page) => page.evaluate(() => ({ href: location.href, search: location.search, hl: history.length, hs: history.state }));
  /* 見えているカードが v（DOM の順）と同じになるまで */
  const untilVisible = (page, v) => until(page, (v) => JSON.stringify([...document.querySelectorAll('#airline-grid a[href^="airlines/"]')]
    .filter((a) => a.getClientRects().length > 0)
    .map((a) => a.getAttribute('href').replace(/^airlines\//, () => '').replace(/\.html$/, () => ''))) === JSON.stringify(v), v);
  const pressedIs = (page, code) => until(page, (c) => (document.querySelector(`#region-strip .rstrip-btn[data-region="${c}"]`) || {}).getAttribute?.('aria-pressed') === 'true', code);
  const D0 = { q: '', region: 'all', view: 'card' };   // 状態は q・region・view の3つ（種類 type は WP-dmap-7 で無くなった）
  /* 別の文書（道の終わりが end）へ移って読み終わるまで。⚠️ waitForNavigation は使わない ── 押した時の住所の書き込み
     （replaceState ＝ 同じ文書の中の移り）でも返るので、まだ一覧のページにいるうちに先へ進んでしまう */
  const toDoc = async (page, end, act) => {
    await act();
    return page.waitForFunction((end) => location.pathname.endsWith(end) && document.readyState === 'complete', { timeout: 60000 }, end).then(() => true, () => false);
  };

  /* 場面 url（日英・1440×900）── 住所が状態を決め、決まった時だけ住所に書く（履歴は積まない） */
  async function url(lang) {
    const T = (s) => `[${lang}] ${s}`, rel = PAGE_REL[lang], other = lang === 'ja' ? 'en' : 'ja', plain = `${L.base}/${rel}`;
    const P = await dirOpen(browser, L, { rel });
    PAGES.push(P);
    const { page, st } = P;
    const go = async (href) => { await page.goto(href, { waitUntil: 'load', timeout: 60000 }); await ready(page); };
    try {
      /* u1 8つの住所（期待する集合は台帳から）。古い ?type=（種類の絞り込みの住所 ── WP-dmap-7 で口ごと外した）は、すべてとして開き、
         住所から type の鍵だけが消える（ほかの鍵・# はそのまま・history.state は触らない）。種類では絞らない ＝ 見えるのはその地域・国の会社ぜんぶ */
      const DE = ofCountry('DE').filter((s) => SALARY[s].region === 'europe');
      const ADDR = [
        ['?q=ana', { ...D0, q: 'ana' }, { typed: 'ana' }],
        ['?q=ana#list', { ...D0, q: 'ana' }, { typed: 'ana' }],
        ['?region=asia', { ...D0, region: 'asia' }, { exp: inRegion('asia') }],
        ['?region=zz', D0, { exp: ORDER }],
        ['?ref=ABCD1234', D0, { exp: ORDER }],
        ['?q=%E3%83%89%E3%82%A4%E3%83%84&region=europe&type=fsc', { ...D0, q: 'ドイツ', region: 'europe' }, { exp: DE, clean: '?q=%E3%83%89%E3%82%A4%E3%83%84&region=europe' }],
        ['?type=taxfree#list', D0, { exp: ORDER, clean: '#list' }],
        ['?view=range', { ...D0, view: 'range' }, { range: true }],
      ];
      for (const [qs, want, how] of ADDR) {
        const href = plain + qs;
        await go(href);
        const a = await addr(page), s = await stateOf(page), f = await fieldOf(page), pr = await pressed(page);
        let good = a.href === plain + (how.clean ?? qs) && a.hs === null && same(s, want) && f === want.q && same(pr, [want.region]), ex = {};
        if (how.exp) {
          const v = await visible(page);
          ex = { n: v.length };
          good = good && how.exp.length > 0 && sameSet(v, how.exp) && v.length === how.exp.length;
        }
        if (how.typed) {
          const v = await visible(page), v2 = (await type(page, ''), await typed(page, how.typed));
          ex = { n: v.length, first: v[0], typed: v2.length };
          good = good && v.length > 0 && v[0] === 'ana' && same(v, v2);
        }
        if (how.range) {
          const cols = await until(page, () => document.querySelectorAll('#lvl-wa-grid .lvl-col').length === 4);
          const fb = await shown(page, '#filter-bar'), grid = await shown(page, '#airline-grid');
          ex = { cols, fb, grid };
          good = good && cols && !fb && !grid;
          await shot(page, 'url', lang, 'range');
        }
        const what = how.exp ? `${how.exp.length}社` : how.typed ? '打った時と同じカード（先頭が ANA）' : '絞り込みの帯が消え、#lvl-wa-grid に4本の .lvl-col';
        ok(good, T(`u1 「${decodeURIComponent(qs)}」で開く → ${how.clean !== undefined ? `すべて（種類では絞らない）・住所は type だけが消えて「${decodeURIComponent(how.clean) || '（鍵なし）'}」` : '住所はそのまま'}・history.state は null・状態・欄・地域が住所どおり・${what}`), J({ a, s, f, pr, ...ex }));
      }

      /* u2 本当に打つ → 欄にいるあいだは住所を書かない → Enter */
      await go(plain);
      const h0 = (await addr(page)).hl;
      await page.focus('#search');
      await page.keyboard.type('emirates');
      const narrowed = await until(page, () => {
        const g = [...document.querySelectorAll('#airline-grid a[href^="airlines/"]')];
        return g.some((x) => x.getAttribute('href') === 'airlines/emirates.html' && x.getClientRects().length > 0) && g.some((x) => x.getClientRects().length === 0);
      });
      const a2 = await addr(page), foc = await page.evaluate(() => (document.activeElement || {}).id);
      ok(narrowed && foc === 'search' && a2.search === '', T('u2 «emirates» を打つ → その場で絞り込まれ、欄にいるあいだ住所は変わらない'), J({ narrowed, foc, search: a2.search }));
      await page.keyboard.press('Enter');
      const w2 = await until(page, () => location.search === '?q=emirates');
      const a2b = await addr(page);
      ok(w2 && a2b.hl === h0, T('u2 Enter → ?q=emirates・history.length は同じ'), J({ search: a2b.search, hl: a2b.hl, h0 }));

      /* u3 打って欄を離れる → change が書く・欄の消すボタン（空にして search）→ q が消える */
      await go(plain);
      const h3 = (await addr(page)).hl;
      await page.focus('#search');
      await page.keyboard.type('emirates');
      const s3 = (await addr(page)).search;
      await page.keyboard.press('Tab');
      const w3 = await until(page, () => location.search === '?q=emirates');
      ok(s3 === '' && w3 && (await addr(page)).hl === h3, T('u3 打って欄を離れる（Tab）→ ?q=emirates・history.length は同じ'), J({ s3, now: (await addr(page)).search }));
      await page.evaluate(() => {
        const el = document.getElementById('search');
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('search', { bubbles: true }));
      });
      const w3b = await until(page, () => location.search === '');
      const v3 = await visible(page);
      ok(w3b && same(v3, ORDER) && (await addr(page)).hl === h3, T('u3 欄の消すボタン（空にして search）→ 住所から q が消え、112社'), J({ now: (await addr(page)).search, n: v3.length }));

      /* u4 地域のボタン → ?region= → «air» ＋ Enter ＋ スクロール → 読み直す */
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      const w4 = await until(page, () => location.search === '?region=europe');
      ok(w4 && (await addr(page)).hl === h3, T('u4 地域のボタン（欧州）→ ?region=europe・history.length は同じ'), J(await addr(page)));
      await page.focus('#search');
      await page.keyboard.type('air');
      await page.keyboard.press('Enter');
      const w4b = await until(page, () => location.search === '?q=air&region=europe');
      await still(page);
      await page.evaluate(() => {
        const g = document.getElementById('airline-grid'), max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: Math.max(0, Math.min(max - 40, Math.round(g.getBoundingClientRect().top + window.scrollY + 200))), behavior: 'instant' });
      });
      await still(page);
      const y4 = await page.evaluate(() => Math.round(window.scrollY)), v4 = await visible(page);
      await page.reload({ waitUntil: 'load', timeout: 60000 });
      await ready(page);
      const back4 = await until(page, (y) => Math.abs(window.scrollY - y) <= 2, y4);
      const s4 = await stateOf(page), f4 = await fieldOf(page), v4b = await visible(page), y4b = await page.evaluate(() => Math.round(window.scrollY));
      ok(w4b && y4 > 100 && back4 && same(s4, { ...D0, q: 'air', region: 'europe' }) && f4 === 'air' && same(await pressed(page), ['europe']) && v4.length > 0 && same(v4b, v4),
        T(`u4 欧州 ＋ «air» ＋ Enter ＋ スクロール（${y4}px）→ 読み直す → 同じ地域・欄・${v4.length}社・スクロール（±2px）`), J({ w4b, y4, y4b, s4, f4, n: v4b.length }));

      /* u5 地域を選び、打ち終えないまま言語のボタン → 向こうのページで同じカード */
      await go(plain);
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      await until(page, () => location.search === '?region=europe');
      await page.focus('#search');
      await page.keyboard.type('air');
      const v5 = await visible(page), s5 = (await addr(page)).search;
      const went5 = await toDoc(page, '/' + PAGE_REL[other], () => page.click('#lang-toggle'));
      await ready(page);
      const v5b = await visible(page), a5 = await addr(page), f5 = await fieldOf(page);
      ok(went5 && s5 === '?region=europe' && new URL(a5.href).pathname === '/' + PAGE_REL[other] && f5 === 'air' && v5.length > 0 && same(v5b, v5),
        T(`u5 欧州 ＋ «air»（打ち終えないまま）→ 言語のボタン → ${other} のページで同じ${v5.length}社・欄は «air»`), J({ s5, to: a5.href.replace(L.base, () => ''), f5, n: v5.length, nb: v5b.length }));
      await shot(page, 'url', lang, 'lang');

      const q = quiet(st, 'url');
      ok(q.length === 0, T('url quiet(st, \'url\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 back（日英・1440×900）── 会社のページへ移って「戻る」。前の口（frontOf）から開く */
  async function back(lang) {
    const T = (s) => `[${lang}] ${s}`, rel = PAGE_REL[lang];
    if (!FRONT) FRONT = await frontOf(L.base);
    const F = { base: FRONT.base };
    /* 戻った時に、ブラウザの手元から出したか（pageshow の persisted）を数える */
    const init = (page) => page.evaluateOnNewDocument(() => { window.__ps = []; window.addEventListener('pageshow', (e) => { window.__ps.push(!!e.persisted); }); });
    const howBack = (page) => page.evaluate(() => {
      const ps = window.__ps || [], n = performance.getEntriesByType('navigation')[0], r = n && n.notRestoredReasons, out = [];
      const walk = (x) => { if (!x) return; (x.reasons || []).forEach((y) => out.push(y.reason || String(y))); (x.children || []).forEach(walk); };
      walk(r);
      return { cache: ps[ps.length - 1] === true, ps, reasons: out.join(',') };
    });
    const TARGETS = [['jal', 'japan', 'air'], ['lufthansa', 'europe', 'luft']], qs = [];
    for (const [slug, region, word] of TARGETS) for (const walk of ['results', 'scroll']) for (const leave of ['as-is', 'unload']) {
      const P = await dirOpen(browser, F, { rel, init });
      PAGES.push(P);
      const { page, st } = P, link = `#airline-grid a[href="airlines/${slug}.html"]`;
      try {
        let rec;
        if (walk === 'results') {
          await press(page, `#region-strip .rstrip-btn[data-region="${region}"]`);
          await pressedIs(page, region);
          await type(page, word);
          rec = { v: await visible(page), f: await fieldOf(page), chip: await chipOf(page) };
        } else {
          await page.evaluate(() => document.fonts && document.fonts.ready);   // 書体が入って高さが決まってから
          await page.evaluate((sel) => document.querySelector(sel).closest('li').scrollIntoView({ block: 'center', behavior: 'instant' }), link);
          await still(page);
        }
        if (leave === 'unload') await page.evaluate(() => { window.addEventListener('unload', () => {}); });
        /* 離れる直前の位置を記録する（まんなかへ送ったあとに上の高さが少し動くことがある ＝ 読む人がいた場所は押した時の位置） */
        if (walk === 'scroll') rec = { y: await page.evaluate(() => Math.round(window.scrollY)) };
        const went = await toDoc(page, `/airlines/${slug}.html`, () => page.click(link));
        const there = went ? new URL(page.url()).pathname : '（移らなかった）';
        await page.goBack({ waitUntil: 'load', timeout: 60000 });
        await ready(page);
        let good, got;
        if (walk === 'results') {
          const eq = await untilVisible(page, rec.v);
          got = { f: await fieldOf(page), chip: await chipOf(page), search: await page.evaluate(() => location.search) };
          const sp = new URLSearchParams(got.search);
          good = eq && rec.v.includes(slug) && got.f === rec.f && got.chip === rec.chip && sp.get('q') === word && sp.get('region') === region;
        } else {
          const all = await untilVisible(page, ORDER);
          const yok = all && await until(page, (y) => Math.abs(window.scrollY - y) <= 2, rec.y);
          got = { y: await page.evaluate(() => Math.round(window.scrollY)) };
          good = all && yok && rec.y > 0;
        }
        const h = await howBack(page), word2 = h.cache ? 'cache' : 'reload';
        console.log(`  ${T(`back ${slug} ${walk} ${leave}: ${word2}${h.cache ? '' : `（${h.reasons || '理由の記録なし'}）`}`)}`);
        const what = walk === 'results' ? `${REGION_LABEL[region][lang === 'en' ? 1 : 0]} ＋ «${word}» → 戻る → 同じ${rec.v.length}社・欄・札・住所に q`
          : `カードをまんなかへ（${rec.y}px）→ 戻る → 112社・スクロール ±2px`;
        ok(good && there.endsWith(`/airlines/${slug}.html`) && (leave === 'as-is' || !h.cache),
          T(`back ${slug}・${walk === 'results' ? '結果' : 'スクロール'}・${leave === 'as-is' ? 'そのまま' : 'unload あり（必ず reload）'}：${what}（${word2}）`), J({ there, rec: walk === 'results' ? { n: rec.v.length, f: rec.f, chip: rec.chip } : rec, got, h }));
        qs.push(...quiet(st, `back ${slug} ${walk} ${leave}`));
      } finally {
        await P.ctx.close().catch(() => {});
      }
    }
    ok(qs.length === 0, T('back quiet が空（8つの歩き方とも）'), J(qs));
  }

  /* ── 比べる印と盆の場面で使う道具（WP-dd-7）── */
  const fleetOf = (row) => typeof row?.fleet === 'string' && row.fleet !== '';
  /* 印を付ける社（新しい会社ページを持つ社）── 日本語 SWITCH・英語 EN_SWITCH（★EN-9 で英語を向け直した。前の英語は fleet） */
  const SW = { ja: new Set(SWITCH), en: new Set(EN_SWITCH) };
  const SW_NAME = { ja: 'SWITCH', en: 'EN_SWITCH' };
  const TRAY_FMT = { ja: (n, m) => `${n} / ${m} 社`, en: (n, m) => `${n} / ${m} airlines` };
  const LVL_WORD = { ja: 'レベリング比較', en: 'Leveling Comparison' };
  const TWO_WORD = { ja: '航空会社を比較', en: 'Compare airlines' };
  /* 盆の2社比較が開くページ（どちらの一覧からも、そのページから見た career.html?view=compare…） */
  const CAREER_PATH = { ja: '/career.html', en: '/en/career.html' };
  /* 盆（比較リスト）と印の今（盆の字・行・2つのボタンが見えているか／押せるか・印の付き方）。★WP-dmap-10：印は button.wd-cmp（付いた ＝ aria-pressed・
     押せない ＝ aria-disabled）・行は li[data-slug]（社名・段の無い社の理由・外す ×）・ボタンは「押せる」（on）と「見えている」（shown）を分けて読む */
  const trayOf = (page) => page.evaluate(() => {
    const $ = (id) => document.getElementById(id), seen = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
    const on = (el) => !!el && el.getAttribute('aria-disabled') !== 'true';
    const t = $('wd-tray'), two = $('wd-tray-two'), lv = $('wd-tray-lvl'), boxes = [...document.querySelectorAll('#airline-grid button.wd-cmp')];
    const off = boxes.filter((b) => b.getAttribute('aria-disabled') === 'true');
    return {
      shown: seen(t), n: ($('wd-tray-n') || {}).textContent ?? null, isTwo: !!t && t.classList.contains('is-two'), open: !!t && t.classList.contains('is-open'),
      chips: [...document.querySelectorAll('#wd-tray-list li[data-slug]')].map((li) => ({ s: li.dataset.slug, t: (li.querySelector('.wd-cl-name') || {}).textContent ?? null,
        note: (li.querySelector('.wd-cl-note') || {}).textContent ?? null, x: !!li.querySelector('button.wd-cl-x') })),
      two: two ? { shown: seen(two), on: on(two) && two.hasAttribute('href'), href: two.getAttribute('href'), text: two.textContent, dis: two.getAttribute('aria-disabled'), by: two.getAttribute('aria-describedby') } : null,
      lvl: lv ? { shown: seen(lv), on: on(lv), text: lv.textContent, by: lv.getAttribute('aria-describedby') } : null,
      main: ['wd-tray-two', 'wd-tray-lvl', 'wd-cl-open'].find((id) => $(id) && $(id).classList.contains('is-main')) || null,
      checked: boxes.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.value), disabled: off.map((b) => b.value), boxes: boxes.length,
      why: off.map((b) => ({ s: b.value, by: b.getAttribute('aria-describedby') || '', title: b.getAttribute('title') || '' })),
      all: boxes.map((b) => b.value),
    };
  });
  /* 住所の cmp だけを書き直した住所（ページと同じ URLSearchParams の書き方 ＝ ?cmp=jal+ana） */
  const cmpHref = (href, list) => { const u = new URL(href); u.searchParams.delete('cmp'); if (list.length) u.searchParams.set('cmp', list.join(' ')); return u.href; };
  /* 比較リストの字（シートの字 ＝ gen-directory.mjs の WORDS・LIST と同じ。ここに書いた字が正。字そのものは assert-directory.mjs の H4・H6 も見る） */
  const CL = {
    ja: { h: '比較リスト', add: '会社を追加', open: '＋ 会社を追加', rule: '比較は2社・レベリング比較は5社まで', why: '機材の区分が無いため、レベリング比較には入りません',
      rm: '外す', off: '＋ 比較', on: '✓ 比較中', close: '閉じる', empty: 'カードの「＋ 比較」か、下の欄から追加できます' },
    en: { h: 'Compare list', add: 'Add an airline', open: '+ Add an airline', rule: 'Compare: 2 airlines · Leveling: up to 5', why: 'No aircraft class, so it can’t join the leveling comparison',
      rm: 'Remove', off: '+ Compare', on: '✓ Added', close: 'Close', empty: 'Use “+ Compare” on a card, or add one below' },
  };
  /* 押せないはずの印（ここで台帳から）：付いていない印のうち、足すと決まり（どの社も fleet を持てば5社・持たない社が入れば2社）を超える社。
     compare-all の切り替え（日本語の印が全社に）の前でも後でも同じ式で当たる */
  const lvlN = (s) => fleetOf(ROW.get(s));
  const fitsN = (list, s) => list.length < (list.concat([s]).every(lvlN) ? 5 : 2);
  const wantOff = (t) => t.all.filter((s) => !t.checked.includes(s) && !fitsN(t.checked, s));
  const nameOf = (page, s) => page.evaluate((s) => (document.getElementById('wn-' + s) || {}).textContent ?? null, s);
  /* その社の印を押す（印を、下に貼りつく盆より上の、見えている所のまんなかへ送ってから ── 盆の下で押さない。★WP-dmap-10：印は button.wd-cmp） */
  const tickIt = async (page, s) => {
    await page.evaluate((s) => {
      const lab = document.querySelector(`li[data-slug="${s}"] button.wd-cmp`), tray = document.getElementById('wd-tray');
      const tr = tray && !tray.hidden ? tray.getBoundingClientRect() : null;
      const bottom = tr && tr.top > window.innerHeight / 2 ? tr.top : window.innerHeight, r = lab.getBoundingClientRect();
      window.scrollBy({ top: (r.top + r.height / 2) - bottom / 2, left: 0, behavior: 'instant' });
    }, s);
    await page.click(`li[data-slug="${s}"] button.wd-cmp`);
  };
  /* 狭い画面の盆を開いた形にする（畳んだ形では行・×・2つ目のボタンは見えない） */
  const openTray = async (page) => {
    if (await page.evaluate(() => document.getElementById('wd-tray').classList.contains('is-open'))) return true;
    await page.click('#wd-cl-fold');
    return until(page, () => document.getElementById('wd-tray').classList.contains('is-open') && document.getElementById('wd-cl-fold').getAttribute('aria-expanded') === 'true');
  };
  const lvlCols = (page) => page.evaluate(() => document.querySelectorAll('#lvl-wa-grid .lvl-col').length);
  const pickOn = (page) => page.evaluate(() => [...document.querySelectorAll('#lvl-wa-picker .lvl-qchip[aria-pressed="true"]')].map((b) => b.dataset.sl));
  const QUICK = ['ana', 'jal', 'emirates', 'delta', 'united', 'singapore-airlines'];   // pv-directory.js が図に渡す quick（図の会社選びに札が出る社）

  /* 場面 card（日英・390×680）── 比べる印と盆（WP-dd-7）。期待する印の集合はここ（Node）で：
     data-two="1" のカード ∩ 新しい会社ページを持つ社（日本語 SWITCH・英語 EN_SWITCH。airline-rollout.mjs）。
     ★EN-9 で英語を日本語と同じ決まりへ向け直した（前の英語 ＝ 一覧の行に fleet がある社・盆に2社比較の入口が無い） */
  async function card(lang) {
    const T = (s) => `[${lang}] ${s}`, rel = PAGE_REL[lang], en = lang === 'en', fmt = TRAY_FMT[lang], qsT6 = [];
    const sw = SW[lang], TWO = TWO_WORD[lang], LVW = LVL_WORD[lang];
    const P = await dirOpen(browser, L, { rel, w: 390, h: 680 });
    PAGES.push(P);
    const { page, st } = P;
    try {
      /* c1 印の在るカード */
      const dom = await page.evaluate(() => [...document.querySelectorAll('#airline-grid li[data-slug]')]
        .map((li) => ({ s: li.dataset.slug, two: li.dataset.two, lvl: li.dataset.lvl, tick: !!li.querySelector('.wd-foot > button.wd-cmp[aria-pressed]') })));
      const exp = dom.filter((x) => x.two === '1' && sw.has(x.s)).map((x) => x.s);
      const got = dom.filter((x) => x.tick).map((x) => x.s);
      ok(exp.length > 0 && sameSet(got, exp) && got.length === exp.length,
        T(`card 印の在るカード ＝ data-two="1" かつ ${SW_NAME[lang]} の${exp.length}社${exp.length <= 10 ? `（${exp.join('・')}）` : ''}`),
        J({ n: got.length, extra: got.filter((s) => !exp.includes(s)), missing: exp.filter((s) => !got.includes(s)) }));

      /* c2 押せる所（390）── 印の在るカードごとに：機長の額のまんなか ＝ そのカードのリンク・印のまんなか ＝ 印・足もとの左端 ＝ どちらでもない・
         印の高さ 44px 以上・印がリンクの中身にも額の行にも重ならない */
      const hit = await page.evaluate(() => {
        const bad = [], seen = [];
        const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }), at = (p) => document.elementFromPoint(p.x, p.y);
        const cross = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        for (const li of document.querySelectorAll('#airline-grid li[data-slug]')) {
          const lab = li.querySelector('button.wd-cmp');
          if (!lab || !li.getClientRects().length) continue;
          li.scrollIntoView({ block: 'center', behavior: 'instant' });
          const go = li.querySelector('a.wd-go'), amt = li.querySelector('.wd-fig[data-rank="cap"] .wd-v'), foot = li.querySelector('.wd-foot'), figs = li.querySelector('.wd-figs');
          const rt = lab.getBoundingClientRect(), rf = foot.getBoundingClientRect(), q = [];
          const e1 = at(mid(amt.getBoundingClientRect())), e2 = at(mid(rt)), e3 = at({ x: rf.left + 2, y: rf.top + rf.height / 2 });
          if (!e1 || !e1.closest || e1.closest('a.wd-go') !== go) q.push('額のまんなかがそのカードのリンクでない');
          if (!e2 || !e2.closest || e2.closest('button.wd-cmp') !== lab) q.push('印のまんなかが印でない');
          if (!e3 || !e3.closest || e3.closest('a.wd-go') || e3.closest('button.wd-cmp')) q.push('足もとの左端がリンクか印');
          if (rt.height < 44) q.push(`印の高さ ${rt.height}px`);
          for (const el of [...go.children, figs]) if (cross(rt, el.getBoundingClientRect())) q.push(`印が ${el.className} に重なる`);
          seen.push(li.dataset.slug);
          if (q.length) bad.push(`${li.dataset.slug}：${q.join('・')}`);
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        return { bad, n: seen.length };
      });
      ok(hit.n === exp.length && hit.bad.length === 0, T(`card 390：印の在る${hit.n}枚とも、額 → リンク・印 → 印・足もとの左端 → どちらでもない・印の高さ 44px 以上・重ならない`), J(hit));

      /* c3 T0 印が無い ＝ 盆は出ない（「航空会社を比較」／«Compare airlines» の要素は日英とも在って、隠れている ── ★EN-9 で英語を向け直した。
         前の英語は「#wd-tray-two の要素そのものが無い」） */
      const t0 = await trayOf(page);
      ok(!t0.shown && t0.checked.length === 0 && !!t0.two && !t0.two.shown, T(`card T0 印が無い → 盆は出ない（「${TWO}」の要素は在って隠れている）`), J(t0));

      /* c4 T1 1社（jal）→「1 / 5」・社名の行（× つき）／★WP-dmap-10：レベリング比較は2〜5社 ＝ 1社では押せない・「航空会社を比較」も押せない（行き先も無い）・
         畳んだ盆の次の1手は「＋ 会社を追加」・印を押すと住所の cmp だけが変わる（履歴は積まない ── 前は「住所はそのまま」） */
      const href0 = await page.evaluate(() => location.href), hl0 = await page.evaluate(() => history.length), wnJal = await nameOf(page, 'jal'), wnAna = await nameOf(page, 'ana');
      await tickIt(page, 'jal');
      await until(page, () => !document.getElementById('wd-tray').hidden);
      const t1 = await trayOf(page), a1 = await page.evaluate(() => ({ href: location.href, hl: history.length }));
      ok(t1.shown && t1.n === fmt(1, 5) && same(t1.chips, [{ s: 'jal', t: wnJal, note: null, x: true }]) && t1.lvl && !t1.lvl.on && t1.lvl.text === LVW
        && !!t1.two && !t1.two.on && t1.two.href === null && t1.main === 'wd-cl-open' && same(t1.checked, ['jal']) && a1.href === cmpHref(href0, ['jal']) && a1.hl === hl0,
        T(`card T1 jal に印 →「${fmt(1, 5)}」・行「${wnJal}」・「${LVW}」も「${TWO}」もまだ押せない・次の1手は「${CL[lang].open}」・住所は cmp=jal だけ変わる（履歴は積まない）`), J({ t1, a1 }));
      await shot(page, 'card', lang, 'T1');

      /* c5 T2 2社（jal → ana） */
      await tickIt(page, 'ana');
      await until(page, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(2, 5));
      const t2 = await trayOf(page), a2 = await page.evaluate(() => ({ href: location.href, hl: history.length }));
      const chips2 = [{ s: 'jal', t: wnJal, note: null, x: true }, { s: 'ana', t: wnAna, note: null, x: true }];
      /* 日英とも同じ（★EN-9 で英語を向け直した。前の英語は「«Leveling Comparison» だけ・2社比較の入口は無い」） */
      ok(t2.n === fmt(2, 5) && same(t2.chips, chips2) && !!t2.two && t2.two.shown && t2.two.on && t2.two.text === TWO && t2.two.href === 'career.html?view=compare&a=jal&b=ana'
        && t2.lvl.on && t2.isTwo && t2.main === 'wd-tray-two' && a2.href === cmpHref(href0, ['jal', 'ana']) && a2.hl === hl0,
        T(`card T2 jal ＋ ana →「${fmt(2, 5)}」・行2つ・「${TWO}」（career.html?view=compare&a=jal&b=ana ── 畳んだ盆の次の1手）・「${LVW}」も押せる・住所は cmp=jal ana`), J({ t2, a2 }));
      await shot(page, 'card', lang, 'T2');

      /* c6 盆の「レベリング比較」→ 印の2社だけの図（列が2本・図の会社選びで2社が押されている）→ 読み直す → 同じ2本 → カード一覧 → 印はそのまま
         （★WP-dmap-10：畳んだ盆の次の1手は「航空会社を比較」＝ レベリング比較は盆を開いてから押す） */
      await openTray(page);
      await page.click('#wd-tray-lvl');
      const c6 = await until(page, () => document.querySelectorAll('#lvl-wa-grid .lvl-col').length === 2);
      const k6 = await lvlCols(page), pk6 = await pickOn(page), s6 = await page.evaluate(() => location.search), tr6 = await trayOf(page);
      ok(c6 && k6 === 2 && sameSet(pk6, ['jal', 'ana'].filter((s) => QUICK.includes(s))) && new URLSearchParams(s6).get('view') === 'range' && !tr6.shown,
        T('card 盆の「レベリング比較」→ 印の2社だけの図（.lvl-col 2本・会社選びで jal と ana が押されている）・住所に view=range・盆は隠れる'), J({ k6, pk6, s6 }));
      /* 押した所の下に図が来ても、マウスが動くまで図の吹き出しは出ない（ブラウザが送る「上に来た」の知らせを数コマ待ってから見る ── WP-dd-9） */
      await settle(page);
      const tip6 = await page.evaluate(() => {
        const t = document.getElementById('lvl-wa-tip'); if (!t) return null;
        const cs = getComputedStyle(t);
        return { show: t.classList.contains('show'), seen: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0 && t.getClientRects().length > 0 };
      });
      ok(!!tip6 && !tip6.seen, T('card 盆の「レベリング比較」を押した直後（マウスは動かさない）→ 図の吹き出し（#lvl-wa-tip）は出ていない'), J(tip6));
      await shot(page, 'card', lang, 'lvl');
      await page.reload({ waitUntil: 'load', timeout: 60000 });
      await ready(page);
      const c7 = await until(page, () => document.querySelectorAll('#lvl-wa-grid .lvl-col').length === 2);
      ok(c7 && sameSet(await pickOn(page), ['jal', 'ana']), T('card 読み直す（住所は view=range のまま）→ また印の2社だけの図（.lvl-col 2本）'), J({ k: await lvlCols(page), pk: await pickOn(page) }));
      await page.click('.view-btn[data-view="card"]');
      await until(page, () => !document.getElementById('wd-tray').hidden);
      const t8 = await trayOf(page);
      ok(t8.shown && sameSet(t8.checked, ['jal', 'ana']) && same(t8.chips.map((c) => c.s), ['jal', 'ana']) && t8.n === fmt(2, 5),
        T(`card カード一覧に戻る → 印は jal と ana のまま・盆「${fmt(2, 5)}」（付けた順）`), J(t8));

      /* c7 社名を押す → 会社のページへ移る → 戻る → 印はそのまま */
      await page.evaluate(() => document.querySelector('li[data-slug="ana"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
      const went = await toDoc(page, '/airlines/ana.html', () => page.click('#wn-ana'));
      await page.goBack({ waitUntil: 'load', timeout: 60000 });
      await ready(page);
      await until(page, () => !document.getElementById('wd-tray').hidden);
      const t9 = await trayOf(page);
      ok(went && sameSet(t9.checked, ['jal', 'ana']) && same(t9.chips.map((c) => c.s), ['jal', 'ana']),
        T('card 社名（ana）を押す → 会社のページへ移る → 戻る → 印は jal と ana のまま'), J({ went, t9 }));

      /* c8 「航空会社を比較」／«Compare airlines» → その言葉の比較のページ（career.html／en/career.html）が jal と ana を2社として開く
         （住所の約束の端から端まで）→ 戻る。★EN-9 で英語も歩く（前は日本語だけ ── 英語の盆に入口が無かった） */
      const went2 = await toDoc(page, CAREER_PATH[lang], () => page.click('#wd-tray-two'));
      /* 2社は札に見えている会社で読む（★2026-10-25 段階5 compare-all-3：career.html の2つの選ぶ欄は無くなり、札を押すと開く選ぶ面で選ぶ） */
      const sides = went2 && await until(page, () => { const on = (sd) => document.querySelector(`#cr .cr-side[data-side="${sd}"] .cr-opt:not([hidden])`); const a = on('a'), b = on('b'); return !!a && !!b && a.dataset.airline === 'jal' && b.dataset.airline === 'ana'; });
      const at2 = await page.evaluate(() => { const on = (sd) => (document.querySelector(`#cr .cr-side[data-side="${sd}"] .cr-opt:not([hidden])`) || { dataset: {} }).dataset.airline; return { path: location.pathname, search: location.search, lang: document.documentElement.lang, a: on('a'), b: on('b') }; });
      ok(went2 && sides && at2.path === CAREER_PATH[lang] && at2.lang === lang,
        T(`card 「${TWO}」を押す → ${CAREER_PATH[lang].slice(1)}?view=compare&a=jal&b=ana（<html lang="${lang}">）が jal と ana を2社として開く`), J(at2));
      await page.goBack({ waitUntil: 'load', timeout: 60000 });
      await ready(page);
      await until(page, () => !document.getElementById('wd-tray').hidden);
      /* c9 T3 3社目（etihad）→ 2社比較の入口は隠れ、レベリング比較だけ → T5 5社 →「5 / 5 社」 */
      await tickIt(page, 'etihad');
      await until(page, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(3, 5));
      const t3 = await trayOf(page);
      ok(t3.n === fmt(3, 5) && !!t3.two && !t3.two.on && !t3.isTwo && t3.lvl.on && t3.main === 'wd-tray-lvl' && same(t3.chips.map((c) => c.s), ['jal', 'ana', 'etihad']),
        T(`card T3 3社目（etihad）→「${fmt(3, 5)}」・「${TWO}」は押せない形・押せるのは「${LVW}」（畳んだ盆の次の1手）`), J(t3));
      /* WP-dd-9 の「前の2社を残さない」を付け替えた（前は出荷のままの行き先へ戻した ── いまは行き先そのものが無く、押せない形の理由は決まりの行） */
      ok(!!t3.two && t3.two.href === null && t3.two.dis === 'true' && t3.two.by === 'wd-cl-rule', T(`card T3 押せない「${TWO}」に前の2社が残らない（行き先そのものが無い・aria-disabled・なぜか ＝ 決まりの行）`), J(t3.two));
      await shot(page, 'card', lang, 'T3');
      /* 4社目・5社目 ＝ 印の在る、機種の段（fleet）を持つ社のうち、ページの並びで先の2社 */
      const more = dom.filter((x) => x.tick && lvlN(x.s) && !['jal', 'ana', 'etihad'].includes(x.s)).map((x) => x.s).slice(0, 2);
      for (const s of more) await tickIt(page, s);
      await until(page, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(5, 5));
      const t5 = await trayOf(page), off5 = wantOff(t5);
      /* 6社目（印の在る、まだ付いていない最初の社）を押しても付かない（前は英語だけで見ていた。いまは日英とも） */
      const sixth = exp.find((s) => !t5.checked.includes(s));
      const dis = await page.evaluate((s) => { const b = document.querySelector(`li[data-slug="${s}"] button.wd-cmp`); b.closest('li').scrollIntoView({ block: 'center', behavior: 'instant' }); b.click(); return { pressed: b.getAttribute('aria-pressed'), disabled: b.getAttribute('aria-disabled') }; }, sixth);
      const t5b = await trayOf(page);
      /* ★WP-dmap-10：押せない印は灰色だけでなく、なぜか（aria-describedby ＝ 決まりの行・title ＝ その字）を持つ */
      const why5 = t5.why.filter((x) => !x.by.split(' ').includes('wd-cl-rule') || !x.title.includes(CL[lang].rule)).map((x) => x.s);
      ok(more.length === 2 && t5.n === fmt(5, 5) && t5.checked.length === 5 && sameSet(t5.disabled, off5) && t5.disabled.length === t5.boxes - 5 && t5.lvl.on
        && dis.pressed === 'false' && dis.disabled === 'true' && t5b.checked.length === 5 && t5b.n === fmt(5, 5) && why5.length === 0,
        T(`card T5 5社に印（${more.join('・')} を足す）→「${fmt(5, 5)}」・ほかの${t5.boxes - 5}社の印はどれも押せない（なぜか ＝ 決まりの行）・6社目（${sixth}）は付かない`), J({ n: t5.n, checked: t5.checked, disabled: t5.disabled.length, boxes: t5.boxes, dis, why5: why5.slice(0, 5) }));
      await shot(page, 'card', lang, 'T5');

      /* 5社のとき、行の1社目が切れない（WP-dd-9 の「札の列はあふれても1社目から」を付け替えた ── 行は縦に並び、横にすべらない）。盆を開いて見る */
      await openTray(page);
      const chip5 = await page.evaluate(() => {
        const l = document.getElementById('wd-tray-list'), f = l && l.firstElementChild, t = document.getElementById('wd-tray');
        if (!f) return null;
        const lr = l.getBoundingClientRect(), fr = f.getBoundingClientRect(), tr = t.getBoundingClientRect();
        return { rows: l.children.length, listLeft: Math.round(lr.left), listRight: Math.round(lr.right), firstLeft: Math.round(fr.left), firstRight: Math.round(fr.right), firstTop: Math.round(fr.top), trayTop: Math.round(tr.top), side: l.scrollWidth > l.clientWidth };
      });
      ok(!!chip5 && chip5.rows === 5 && !chip5.side && chip5.firstLeft >= chip5.listLeft && chip5.firstRight <= chip5.listRight && chip5.firstTop >= chip5.trayTop,
        T('card T5 盆を開く → 5社の行は縦に並び、1社目の行が切れていない（横にすべらない）'), J(chip5));

      /* c10 行の ×（外す）を押す ＝ その社の印が外れる（★WP-dmap-10：前は社名の札そのものを押した） */
      const before = await trayOf(page);
      await page.click('#wd-tray-list li[data-slug="ana"] button.wd-cl-x');
      await until(page, () => !document.querySelector('#wd-tray-list li[data-slug="ana"]'));
      const after = await trayOf(page);
      const off10 = wantOff(after);
      ok(!after.checked.includes('ana') && after.checked.length === before.checked.length - 1 && after.n === fmt(before.checked.length - 1, 5) && sameSet(after.disabled, off10),
        T(`card 行の ×（ana）を押す → ana の印が外れる・「${fmt(before.checked.length - 1, 5)}」・印はまた押せる（機種の段（fleet）の無い社を除いて ＝ いま ${off10.length}社が押せない）`), J({ n: after.n, checked: after.checked, disabled: after.disabled.length, want: off10.length }));

      /* c11 T6（段の無い社に印 ＝ 2社まで）── そのページに「印が在って data-lvl="0"」のカードが在る時だけ歩く（★EN-9：英語も歩く ──
         英語の印も data-two かつ EN_SWITCH になり、段の無い4社にも付くようになった。前は日本語だけ） */
      const walker = dom.find((x) => x.tick && x.lvl === '0')?.s || null;
      if (!walker) console.log(`  ${T('T6：まだ歩けない（比較の切り替えの前）')}`);
      else {
        const Q = await dirOpen(browser, L, { rel, w: 390, h: 680 });
        PAGES.push(Q);
        try {
          const pg = Q.page;
          await tickIt(pg, walker);
          await until(pg, () => !document.getElementById('wd-tray').hidden);
          const a1 = await trayOf(pg);
          /* ★WP-dmap-10（class B）：段の無い社の行は、レベリング比較に入らない理由を言う・押せない「レベリング比較」のなぜか ＝ その理由の行 */
          ok(a1.n === fmt(1, 2) && !a1.lvl.on && a1.lvl.by === 'wd-cl-why' && !a1.two.on && a1.chips.length === 1 && a1.chips[0].note === CL[lang].why && sameSet(a1.disabled, wantOff(a1)),
            T(`card T6 段の無い ${walker} に印 →「${fmt(1, 2)}」・行に理由「${CL[lang].why}」・「${LVW}」は押せない（なぜか ＝ その理由）`), J(a1));
          await tickIt(pg, 'jal');
          await until(pg, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(2, 2));
          const a2 = await trayOf(pg);
          const why2 = a2.why.filter((x) => !x.by.split(' ').includes('wd-cl-rule')).map((x) => x.s);
          ok(a2.two.on && a2.two.href === `career.html?view=compare&a=${walker}&b=jal` && !a2.lvl.on && sameSet(a2.disabled, wantOff(a2)) && a2.disabled.length === a2.boxes - 2 && why2.length === 0,
            T(`card T6 2社目（jal）→「${fmt(2, 2)}」・「${TWO}」（a=${walker}&b=jal）・ほかの印はどれも押せない（なぜか ＝ 決まりの行）`), J({ n: a2.n, two: a2.two, lvl: a2.lvl, disabled: a2.disabled.length, boxes: a2.boxes, why2: why2.slice(0, 5) }));
          await shot(pg, 'card', lang, 'T6');
          await tickIt(pg, walker);
          await until(pg, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(1, 5));
          const a3 = await trayOf(pg);
          /* 5社までに戻る（★WP-dmap-10：レベリング比較は2〜5社 ＝ 1社のいまは押せない。前は「1社でもレベリング比較」） */
          ok(a3.n === fmt(1, 5) && !a3.lvl.on && sameSet(a3.disabled, wantOff(a3)), T(`card T6 ${walker} の印を外す → 5社までに戻る（「${fmt(1, 5)}」）`), J(a3));
          const third = exp.filter((s) => s !== walker && s !== 'jal' && lvlN(s)).slice(0, 2);
          for (const s of third) await tickIt(pg, s);
          await until(pg, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(3, 5));
          const a4 = await trayOf(pg), w4 = a4.why.find((x) => x.s === walker) || null;
          ok(third.length === 2 && a4.n === fmt(3, 5) && a4.disabled.includes(walker) && sameSet(a4.disabled, wantOff(a4)) && !!w4 && w4.by === 'wd-cl-why wd-cl-rule' && w4.title.includes(CL[lang].why),
            T(`card T6 段を持つ3社に印 → 段の無い ${walker} の印は押せない（3社目に段の無い社は入らない・なぜか ＝ 理由の行と決まりの行）`), J({ checked: a4.checked, w4 }));
          qsT6.push(...quiet(Q.st, 'card T6'));
        } finally {
          await Q.ctx.close().catch(() => {});
        }
      }

      const q = quiet(st, 'card').concat(qsT6);
      ok(q.length === 0, T('card quiet(st, \'card\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 list（日英）── 比較リスト（WP-dmap-10）。期待する集合はここ（Node）とページの検索で作る（台本の答えを写さない）。
     ★class A（壊すと赤を見た）：①欄の候補 ＝ ページの検索の当たり（同じ並び。地域 すべて・候補はカードに印の在る社）＋ 台帳の錨（カタール → カタール航空・
     qr → 先頭がカタール航空・ドイツ → 国が DE の会社ちょうど・zzzz → 0 と「見つからない」の文・jal → 先頭が日本航空で、あとに JAL グループの社
     ＝ ぴったり同じ物が先・あとはページの並び。ぴったりと一部の当たりが混ざる語はこれだけ）／②「航空会社を比較」の行き先 ＝
     career.html?view=compare&a=<1社目>&b=<2社目>（その言葉のページから見て ＝ 英語は /en/career.html）／③住所の cmp からリストが戻る
     （読み直し・別の窓で開いた共有の住所・知らない社と2つ目は落とす・開いた時は住所も履歴も書かない）。
     class B：1440 の0社・欄（↓・Enter）・カードの印・3社目・×・段の無い社・押せない印のなぜか／390 の盆と「＋ 会社を追加」の板（Esc・戻る） */
  async function list(lang) {
    const T = (s) => `[${lang}] ${s}`, rel = PAGE_REL[lang], fmt = TRAY_FMT[lang], W = CL[lang], qs = [];
    const P = await dirOpen(browser, L, { rel, w: 1440, h: 900 });
    PAGES.push(P);
    const { page, st } = P;
    const seenOf = (pg, id) => pg.evaluate((id) => { const el = document.getElementById(id); return !!el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0; }, id);
    const field = (pg, v) => pg.evaluate((v) => { const f = document.getElementById('wd-cl-q'); f.focus(); f.value = v; f.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    const optsOf = (pg) => pg.evaluate(() => {
      const o = document.getElementById('wd-cl-opts'), n = document.getElementById('wd-cl-none'), f = document.getElementById('wd-cl-q');
      const seen = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none';
      const act = f.getAttribute('aria-activedescendant');
      return { got: [...o.querySelectorAll('li[data-slug]')].map((li) => li.dataset.slug), open: seen(o), none: seen(n) ? n.textContent : null, exp: f.getAttribute('aria-expanded'),
        act: act ? (document.getElementById(act) || { dataset: {} }).dataset.slug || null : null };
    });
    const pressOf = (pg, s) => pg.evaluate((s) => { const b = document.querySelector(`li[data-slug="${s}"] button.wd-cmp`); return { p: b.getAttribute('aria-pressed'), t: [...b.querySelectorAll('span[aria-hidden="true"]')].filter((x) => getComputedStyle(x).display !== 'none').map((x) => x.textContent).join('') }; }, s);
    const tog = async (pg, s) => { await pg.evaluate((s) => document.querySelector(`li[data-slug="${s}"]`).scrollIntoView({ block: 'center', behavior: 'instant' }), s); await pg.click(`li[data-slug="${s}"] button.wd-cmp`); };
    const nIs = (pg, n) => until(pg, (n) => document.getElementById('wd-tray-n').textContent === n, n);
    try {
      /* L0 0社：カードの右（上端がそろう）に題・0 / 5・空の一言・決まりの行・欄・押せない2つのボタン（狭い画面の部品は出ない） */
      const t0 = await trayOf(page);
      const k0 = await page.evaluate(() => {
        const $ = (id) => document.getElementById(id), seen = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
        const rt = $('wd-tray').getBoundingClientRect(), rg = $('airline-grid').getBoundingClientRect();
        return { beside: rt.left >= rg.right, top: Math.round(rt.top - rg.top), h: $('wd-cl-h').textContent, empty: seen($('wd-cl-empty')) ? $('wd-cl-empty').textContent : null,
          rule: seen($('wd-cl-rule')) ? $('wd-cl-rule').textContent : null, field: seen($('wd-cl-q')) ? $('wd-cl-q').getAttribute('placeholder') : null,
          small: ['wd-cl-fold', 'wd-cl-open', 'wd-cl-close'].filter((id) => seen($(id))) };
      });
      ok(t0.shown && t0.n === fmt(0, 5) && t0.chips.length === 0 && k0.beside && Math.abs(k0.top) <= 2 && k0.h === W.h && k0.empty === W.empty && k0.rule === W.rule && k0.field === W.add
        && !t0.two.on && t0.two.href === null && !t0.lvl.on && k0.small.length === 0,
        T(`list 1440 0社 → カードの右（上端がそろう）に「${W.h}」「${fmt(0, 5)}」・空の一言・決まりの行「${W.rule}」・欄「${W.add}」・2つのボタンは押せない`), J({ t0: { n: t0.n, two: t0.two, lvl: t0.lvl }, k0 }));
      await shot(page, 'list', lang, '1440-0');

      /* L1 ★class A：欄の候補 ＝ ページの検索の当たり（同じ並び）＋ 台帳の錨 */
      const ticked = new Set(await page.evaluate(() => [...document.querySelectorAll('#airline-grid button.wd-cmp')].map((b) => b.value)));
      const DE = ofCountry('DE');
      for (const q of ['カタール', 'qr', 'ドイツ', 'zzzz', 'jal']) {
        await type(page, q);
        const pg = (await visible(page)).filter((s) => ticked.has(s));
        await type(page, '');
        await field(page, q);
        const a = await optsOf(page);
        const anchor = q === 'カタール' ? pg.includes('qatar-airways') : q === 'qr' ? pg[0] === 'qatar-airways' : q === 'ドイツ' ? (DE.length > 0 && sameSet(pg, DE))
          : q === 'jal' ? (pg[0] === 'jal' && pg.length > 1) : pg.length === 0;
        ok(anchor && same(a.got, pg) && (pg.length ? a.open && a.none === null && a.exp === 'true' : !a.open && a.none === NONE_SENT[lang] && a.exp === 'false'),
          T(`list ★欄に「${q}」→ ページの検索と同じ${pg.length}社を同じ並びで（${pg.length ? pg.slice(0, 4).join('・') : `0社・「${NONE_SENT[lang]}」`}）`), J({ q, got: a.got, pg, a }));
      }
      await field(page, '');

      /* L2 欄から足す（キーボード）：«qatar» → いま選んでいるのは先頭の候補 → Enter → 行・カードの印も付いた形・欄は空でフォーカスはそのまま */
      const hl0 = await page.evaluate(() => history.length), href0 = await page.evaluate(() => location.href);
      await page.focus('#wd-cl-q');
      await page.keyboard.type('qatar');
      await until(page, () => !document.getElementById('wd-cl-opts').hidden);
      const o2 = await optsOf(page);
      await page.keyboard.press('Enter');
      await nIs(page, fmt(1, 5));
      const t2 = await trayOf(page), f2 = await page.evaluate(() => ({ v: document.getElementById('wd-cl-q').value, foc: (document.activeElement || {}).id, open: !document.getElementById('wd-cl-opts').hidden }));
      ok(o2.act === 'qatar-airways' && same(t2.chips.map((c) => c.s), ['qatar-airways']) && t2.chips[0].x && same(t2.checked, ['qatar-airways']) && f2.v === '' && f2.foc === 'wd-cl-q' && !f2.open,
        T('list 欄に «qatar» → 選んでいるのは先頭の候補（カタール航空）→ Enter → 行に入り・カードの印も付いた形・欄は空でフォーカスはそのまま'), J({ o2, t2: t2.chips, f2 }));
      /* ↓ で選び直す：«air» の候補の2つ目を ↓ で選んで Enter → その社が入る */
      await page.keyboard.type('air');
      await until(page, () => !document.getElementById('wd-cl-opts').hidden);
      const o3 = await optsOf(page);
      const want3 = o3.got.filter((s) => s !== 'qatar-airways')[1] || null;
      await page.keyboard.press('ArrowDown');
      const o3b = await optsOf(page);
      if (o3b.act !== want3) await page.keyboard.press('ArrowDown');   // 1つ目が足せない社のときは、もう1つ下
      const o3c = await optsOf(page);
      await page.keyboard.press('Enter');
      await nIs(page, fmt(2, 5));
      const t3 = await trayOf(page), a3 = await addr(page);
      const resolved = await page.evaluate(() => { const a = document.getElementById('wd-tray-two'); return a.href ? new URL(a.href).pathname : null; });
      ok(!!want3 && o3c.act === want3 && same(t3.chips.map((c) => c.s), ['qatar-airways', want3]),
        T(`list «air» → ↓ で次の候補（${want3}）→ Enter → 2社目に入る`), J({ o3: o3.got.slice(0, 4), b: o3b.act, c: o3c.act, chips: t3.chips.map((c) => c.s) }));
      /* ★class A：行き先 ＝ 1社目・2社目の順 */
      ok(t3.two.on && t3.two.href === `career.html?view=compare&a=qatar-airways&b=${want3}` && resolved === CAREER_PATH[lang] && t3.lvl.on && t3.main === 'wd-tray-two',
        T(`list ★「${TWO_WORD[lang]}」の行き先 ＝ ${CAREER_PATH[lang].slice(1)}?view=compare&a=qatar-airways&b=${want3}（1社目・2社目の順）・「${LVL_WORD[lang]}」も押せる`), J({ two: t3.two, resolved }));
      ok(new URLSearchParams(a3.search).get('cmp') === `qatar-airways ${want3}` && a3.hl === hl0 && a3.href === cmpHref(href0, ['qatar-airways', want3]),
        T('list 住所は cmp だけが変わる（付けた順）・履歴は積まない'), J(a3));
      await shot(page, 'list', lang, '1440-2');

      /* L3 カードの印で付け外し（「✓ …」→ 外れる → 「＋ …」→ もう1回 → 付いて行の最後へ） */
      const e0 = await pressOf(page, want3);
      await tog(page, want3);
      await nIs(page, fmt(1, 5));
      const e1 = await pressOf(page, want3), t4 = await trayOf(page);
      await tog(page, want3);
      await nIs(page, fmt(2, 5));
      const e2 = await pressOf(page, want3), t5 = await trayOf(page);
      ok(e0.p === 'true' && e0.t === W.on && e1.p === 'false' && e1.t === W.off && same(t4.chips.map((c) => c.s), ['qatar-airways']) && e2.p === 'true' && same(t5.chips.map((c) => c.s), ['qatar-airways', want3]),
        T(`list カードの「${W.on}」を押す → 外れて「${W.off}」・行からも消える → もう1回 → 付いて行の最後へ`), J({ e0, e1, e2 }));

      /* L4 3社目（カードの印で th ＝ 欄で足した2社と重ならない社）→「航空会社を比較」は押せない（行き先も無い）・「レベリング比較」は押せる */
      const th = ['jal', 'ana', 'emirates'].find((s) => s !== want3 && s !== 'qatar-airways');
      await tog(page, th);
      await nIs(page, fmt(3, 5));
      const t6 = await trayOf(page);
      ok(!t6.two.on && t6.two.href === null && t6.two.dis === 'true' && t6.lvl.on && same(t6.chips.map((c) => c.s), ['qatar-airways', want3, th]),
        T(`list 3社目（${th}）→「${TWO_WORD[lang]}」は押せない（行き先も無い）・「${LVL_WORD[lang]}」は押せる`), J({ two: t6.two, lvl: t6.lvl }));
      /* L5 ×（外す）で2社目を外す → 行とカードから外れ、行き先は a=qatar-airways&b=<th> */
      const xl = await page.evaluate((s) => (document.querySelector(`#wd-tray-list li[data-slug="${s}"] button.wd-cl-x`) || { getAttribute: () => null }).getAttribute('aria-label'), want3);
      await page.click(`#wd-tray-list li[data-slug="${want3}"] button.wd-cl-x`);
      await nIs(page, fmt(2, 5));
      const t7 = await trayOf(page), x7 = await pressOf(page, want3);
      ok(same(t7.chips.map((c) => c.s), ['qatar-airways', th]) && x7.p === 'false' && t7.two.href === `career.html?view=compare&a=qatar-airways&b=${th}` && typeof xl === 'string' && xl.startsWith(`${W.rm} `),
        T(`list 「${W.rm}」（×）で ${want3} を外す → 行とカードから外れ・行き先は a=qatar-airways&b=${th}`), J({ chips: t7.chips.map((c) => c.s), x7, xl }));

      /* L6 ★class A：読み直す → 同じリスト（同じ順・行き先・カードの印） */
      await page.reload({ waitUntil: 'load', timeout: 60000 });
      await ready(page);
      const t8 = await trayOf(page);
      ok(same(t8.chips.map((c) => c.s), ['qatar-airways', th]) && sameSet(t8.checked, ['qatar-airways', th]) && t8.two.href === `career.html?view=compare&a=qatar-airways&b=${th}`,
        T('list ★読み直す → 同じリスト（同じ順・行き先・カードの印）'), J({ chips: t8.chips.map((c) => c.s), checked: t8.checked, two: t8.two.href }));
      /* ★class A：共有した住所を別の窓で開く（知らない社・2つ目は落とす）・開いた時は住所も履歴も書かない */
      for (const [q, want] of [['?cmp=jal+ana', ['jal', 'ana']], ['?cmp=ana+zzz+ana+jal', ['ana', 'jal']]]) {
        const Q = await dirOpen(browser, L, { rel, query: q, w: 1440, h: 900 });
        PAGES.push(Q);
        try {
          const tq = await trayOf(Q.page), aq = await addr(Q.page);
          ok(same(tq.chips.map((c) => c.s), want) && sameSet(tq.checked, want) && tq.two.href === `career.html?view=compare&a=${want[0]}&b=${want[1]}` && aq.search === q && aq.hs === null,
            T(`list ★共有した住所「${q}」を開く → リスト ${want.join('・')}・行き先 a=${want[0]}&b=${want[1]}・開いた時は住所も履歴も書かない`), J({ chips: tq.chips.map((c) => c.s), two: tq.two.href, aq }));
          qs.push(...quiet(Q.st, 'list 住所'));
        } finally {
          await Q.ctx.close().catch(() => {});
        }
      }

      /* L7 段の無い社（class B）：欄から足す → 行に理由・「1 / 2」・レベリング比較は押せない（なぜか ＝ 理由の行）→ jal → 2 / 2 → ほかの印と候補は押せない（なぜか） */
      const walker = ORDER.find((s) => ticked.has(s) && !fleetOf(ROW.get(s))) || null;
      if (!walker) ok(false, T('list 段の無い社に印が無い（歩けない）'));
      else {
        const R = await dirOpen(browser, L, { rel, w: 1440, h: 900 });
        PAGES.push(R);
        try {
          const pg = R.page;
          await field(pg, SALARY[walker].en);
          await until(pg, () => !document.getElementById('wd-cl-opts').hidden);
          const ow = await optsOf(pg);
          await pg.keyboard.press('Enter');
          await nIs(pg, fmt(1, 2));
          const w1 = await trayOf(pg);
          ok(ow.act === walker && same(w1.chips.map((c) => c.s), [walker]) && w1.chips[0].note === W.why && !w1.lvl.on && w1.lvl.by === 'wd-cl-why',
            T(`list 段の無い ${walker} を欄から足す →「${fmt(1, 2)}」・行に理由「${W.why}」・「${LVL_WORD[lang]}」は押せない（なぜか ＝ その理由）`), J({ ow: ow.act, w1: { n: w1.n, chips: w1.chips, lvl: w1.lvl } }));
          await tog(pg, 'jal');
          await nIs(pg, fmt(2, 2));
          const w2 = await trayOf(pg), ana2 = w2.why.find((x) => x.s === 'ana') || null;
          await field(pg, 'ANA');
          await until(pg, () => !document.getElementById('wd-cl-opts').hidden);
          const oa = await pg.evaluate(() => { const li = document.querySelector('#wd-cl-opts li[data-slug="ana"]'); return li ? { dis: li.getAttribute('aria-disabled'), by: li.getAttribute('aria-describedby') } : null; });
          await pg.keyboard.press('Enter');
          const ruleB = await pg.evaluate(() => document.getElementById('wd-cl-rule').classList.contains('is-ping'));
          const w3 = await trayOf(pg);
          ok(w2.two.on && w2.two.href === `career.html?view=compare&a=${walker}&b=jal` && !!ana2 && ana2.by === 'wd-cl-rule' && ana2.title === W.rule && !!oa && oa.dis === 'true' && oa.by === 'wd-cl-rule' && ruleB && w3.n === fmt(2, 2),
            T(`list 2社目（jal）→「${fmt(2, 2)}」・ほかの印と欄の候補は押せず、なぜか ＝ 決まりの行（「${W.rule}」）・押そうとすると決まりの行が強まる・増えない`), J({ two: w2.two.href, ana2, oa, ruleB, n: w3.n }));
          await shot(pg, 'list', lang, '1440-why');
          qs.push(...quiet(R.st, 'list 段の無い社'));
        } finally {
          await R.ctx.close().catch(() => {});
        }
      }
      qs.push(...quiet(st, 'list 1440'));
    } finally {
      await P.ctx.close().catch(() => {});
    }

    /* L8 390（指）── 盆は1社から・1行に畳んだ形（次の1手だけ）→ 開く → 「＋ 会社を追加」の板（履歴1段・フォーカスは欄・ページは止まる）→ 候補を指で →
       Esc で閉じる（足した社はそのまま・住所に cmp）→ もう1回開いても積み増さない → 戻るで閉じる（足した社はそのまま・一覧のページのまま） */
    const M = await dirOpen(browser, L, { rel, w: 390, h: 680, touch: true });
    PAGES.push(M);
    try {
      const pg = M.page;
      const m0 = await trayOf(pg);
      await pg.evaluate(() => document.querySelector('li[data-slug="jal"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await pg.tap('li[data-slug="jal"] button.wd-cmp');
      await until(pg, () => !document.getElementById('wd-tray').hidden);
      const m1 = await trayOf(pg), k1 = await pg.evaluate(() => { const t = document.getElementById('wd-tray'), r = t.getBoundingClientRect(); return { h: Math.round(r.height), bottom: Math.round(r.bottom), vh: innerHeight }; });
      const open1 = await seenOf(pg, 'wd-cl-open'), rows1 = await seenOf(pg, 'wd-tray-list');
      ok(!m0.shown && m1.shown && !m1.open && m1.main === 'wd-cl-open' && open1 && !rows1 && k1.h <= 72 && k1.bottom <= k1.vh,
        T(`list 390 0社では盆は出ない → jal に印 → 盆は1行に畳んだ形（題・${fmt(1, 5)}・次の1手「${W.open}」だけ・高さ ${k1.h}px）`), J({ m1: { n: m1.n, open: m1.open, main: m1.main }, k1, open1, rows1 }));
      await shot(pg, 'list', lang, '390-fold');
      await pg.tap('#wd-cl-fold');
      await until(pg, () => document.getElementById('wd-tray').classList.contains('is-open'));
      const rows2 = await seenOf(pg, 'wd-tray-list'), rule2 = await seenOf(pg, 'wd-cl-rule'), exp2 = await pg.evaluate(() => document.getElementById('wd-cl-fold').getAttribute('aria-expanded'));
      ok(rows2 && rule2 && exp2 === 'true', T('list 390 題の行を押す → 開いた形（行・決まりの行・aria-expanded）'), J({ rows2, rule2, exp2 }));
      const hlA = await pg.evaluate(() => history.length);
      await pg.tap('#wd-cl-open');
      const sh = await until(pg, () => document.getElementById('wd-tray').classList.contains('is-adding') && (document.activeElement || {}).id === 'wd-cl-q');
      const s1 = await pg.evaluate(() => { const t = document.getElementById('wd-tray'), r = t.getBoundingClientRect(); return { role: t.getAttribute('role'), modal: t.getAttribute('aria-modal'), lock: document.documentElement.classList.contains('wd-lock'), hl: history.length, wdadd: !!(history.state && history.state.wdadd), bottom: Math.round(r.bottom), vh: innerHeight, top: Math.round(r.top) }; });
      ok(sh && s1.role === 'dialog' && s1.modal === 'true' && s1.lock && s1.hl === hlA + 1 && s1.wdadd && s1.bottom === s1.vh && s1.top > 0,
        T(`list 390 「${W.open}」→ 下から出る板（role="dialog"・ページは止まる・履歴が1段・フォーカスは欄）`), J(s1));
      await pg.keyboard.type(lang === 'en' ? 'Qatar' : 'カタール');
      await until(pg, () => !!document.querySelector('#wd-cl-opts li[data-slug="qatar-airways"]') && !document.getElementById('wd-cl-opts').hidden);
      await shot(pg, 'list', lang, '390-sheet');
      await pg.tap('#wd-cl-opts li[data-slug="qatar-airways"]');
      await nIs(pg, fmt(2, 5));
      const s2 = await pg.evaluate(() => ({ adding: document.getElementById('wd-tray').classList.contains('is-adding'), v: document.getElementById('wd-cl-q').value, cmp: new URLSearchParams(location.search).get('cmp') }));
      ok(s2.adding && s2.v === '' && s2.cmp === 'jal qatar-airways', T('list 390 候補（カタール航空）を指で → 足される・板は開いたまま・欄は空・住所に cmp'), J(s2));
      await pg.keyboard.press('Escape');
      const c1 = await until(pg, () => !document.getElementById('wd-tray').classList.contains('is-adding') && !(history.state && history.state.wdadd));
      const s3 = await pg.evaluate(() => ({ lock: document.documentElement.classList.contains('wd-lock'), cmp: new URLSearchParams(location.search).get('cmp'), rows: [...document.querySelectorAll('#wd-tray-list li[data-slug]')].map((li) => li.dataset.slug), hs: history.state && history.state.cmp, path: location.pathname }));
      ok(c1 && !s3.lock && s3.cmp === 'jal qatar-airways' && same(s3.rows, ['jal', 'qatar-airways']) && same(s3.hs, ['jal', 'qatar-airways']),
        T('list 390 Esc → 板が閉じ、履歴の1段も外れる・足した社はそのまま（行・住所・history.state）'), J(s3));
      await pg.tap('#wd-cl-open');
      await until(pg, () => document.getElementById('wd-tray').classList.contains('is-adding'));
      const s4 = await pg.evaluate(() => history.length);
      await pg.keyboard.type('EK');
      await until(pg, () => !!document.querySelector('#wd-cl-opts li[data-slug="emirates"]'));
      await pg.tap('#wd-cl-opts li[data-slug="emirates"]');
      await nIs(pg, fmt(3, 5));
      await pg.evaluate(() => history.back());
      const c2 = await until(pg, () => !document.getElementById('wd-tray').classList.contains('is-adding'));
      await settle(pg);
      const s5 = await pg.evaluate(() => ({ cmp: new URLSearchParams(location.search).get('cmp'), rows: [...document.querySelectorAll('#wd-tray-list li[data-slug]')].map((li) => li.dataset.slug), path: location.pathname, lock: document.documentElement.classList.contains('wd-lock'), wdadd: !!(history.state && history.state.wdadd) }));
      ok(s4 === s1.hl && c2 && s5.cmp === 'jal qatar-airways emirates' && same(s5.rows, ['jal', 'qatar-airways', 'emirates']) && s5.path.endsWith(rel) && !s5.lock && !s5.wdadd,
        T('list 390 もう1回開いても履歴を積み増さない → 足して → 戻る → 板が閉じ、足した社はそのまま（一覧のページのまま）'), J({ s4, hl1: s1.hl, s5 }));
      qs.push(...quiet(M.st, 'list 390'));
    } finally {
      await M.ctx.close().catch(() => {});
    }
    ok(qs.length === 0, T('list quiet が空（1440・住所・段の無い社・390）'), J(qs));
  }

  /* 場面 touch（日英・390×680・指）── 欄を指で押して打つ → 社名を指で押す → 移る → 戻る */
  async function touch(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: 390, h: 680, touch: true });
    PAGES.push(P);
    const { page, st } = P;
    try {
      await page.tap('#search');
      const foc = await until(page, () => (document.activeElement || {}).id === 'search');
      await page.keyboard.type('jal');
      const v0 = await visible(page), f0 = await fieldOf(page);
      ok(foc && f0 === 'jal' && v0.includes('jal') && v0.length < ORDER.length, T(`touch 欄を指で押して «jal» → 絞り込まれ（${v0.length}社）、JAL が見えている`), J({ foc, f0, n: v0.length }));
      await shot(page, 'touch', lang, '1-typed');
      const went = await toDoc(page, '/airlines/jal.html', () => page.tap('#wn-jal'));
      const there = went ? new URL(page.url()).pathname : '（移らなかった）';
      ok(there.endsWith('/airlines/jal.html'), T('touch 社名を指で押す → 会社のページ（jal）へ移る'), J(there));
      await page.goBack({ waitUntil: 'load', timeout: 60000 });
      await ready(page);
      const eq = await untilVisible(page, v0), f1 = await fieldOf(page);
      ok(eq && f1 === f0, T('touch 戻る → 同じカードと欄（«jal»）'), J({ f1, n: (await visible(page)).length }));
      await shot(page, 'touch', lang, '2-back');
      /* 比べる印を指で押す → 付く・どこへも移らない（WP-dd-7。★WP-dmap-10：印は button.wd-cmp・住所は cmp だけが変わる ── 前は「住所はそのまま」） */
      const href0 = await page.evaluate(() => location.href), hl0 = await page.evaluate(() => history.length);
      await page.tap('li[data-slug="jal"] button.wd-cmp');
      const on = await until(page, () => (document.querySelector('li[data-slug="jal"] button.wd-cmp') || { getAttribute: () => null }).getAttribute('aria-pressed') === 'true');
      const t1 = await page.evaluate(() => ({ href: location.href, path: location.pathname, hl: history.length, tray: !document.getElementById('wd-tray').hidden }));
      ok(on && t1.href === cmpHref(href0, ['jal']) && t1.hl === hl0 && t1.tray, T('touch 比べる印（jal）を指で押す → 付く・移らない（住所は cmp=jal だけ・履歴は積まない）・盆が出る'), J({ on, t1, href0 }));
      await shot(page, 'touch', lang, '3-tick');
      const q = quiet(st, 'touch');
      ok(q.length === 0, T('touch quiet(st, \'touch\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 map-pos（WP-dmap-3・リード P12.109 (3)。WP-dmap-4 で切り替えはカードの先頭から面の先頭へ移った・P12.112）──「機長｜副操縦士」の切り替え（P12.100）。
     広い画面（1440×900）：台本が動けば見える・組の名前は「職位」／Rank・押してあるのは機長（区域の data-pos も機長・見せている帯は機長の1本・
     凡例は機長の行）→ 副操縦士を押す → data-pos・aria-pressed・見せる帯・凡例の行が副操縦士へ・地図の中東の点の色が変わる（中東は機長と
     副操縦士で濃さが違う）・カードの高さはそのまま・履歴も保存領域も増えない → キーボード（機長にフォーカスして Space）で戻る／
     台本を止めると切り替えは見えない（押しても何も起きないボタンを出さない）／
     狭い画面（390×680・指）：カードは閉じていて、切り替えは地図の上の1行で見えている → 地域のボタンを指で押す → カードが開く → 副操縦士を指で押す → data-pos／
     どれも quiet が空 */
  async function mapPos(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const posOf = (page) => page.evaluate(() => {
      const sec = document.getElementById('wa-map-sec'), sw = document.querySelector('#wa-map-sec .wam-pos');
      const p = document.querySelector('#wa-sum .wam-panel.is-shown'), c = document.getElementById('wa-sum');
      return {
        pos: sec && sec.getAttribute('data-pos'), shown: !!sw && !sw.hidden && sw.getClientRects().length > 0,
        btn: sw ? [...sw.querySelectorAll('.wam-pb')].map((b) => `${b.dataset.pos}:${b.getAttribute('aria-pressed')}:${b.textContent}`) : [],
        strip: p ? [...p.querySelectorAll('.wam-sp')].filter((s) => getComputedStyle(s).visibility === 'visible').map((s) => s.dataset.pos) : [],
        h: c && c.getClientRects().length ? Math.round(c.getBoundingClientRect().height) : null,
        hist: history.length, ls: JSON.stringify(Object.entries(localStorage).sort()), ss: JSON.stringify(Object.entries(sessionStorage).sort()),
        name: sw ? sw.getAttribute('aria-label') : null,
        key: [...document.querySelectorAll('#wa-map-sec .wam-key')].filter((k) => getComputedStyle(k).display !== 'none').map((k) => k.dataset.pos),
        dot: (() => { const d = document.querySelector('#wa-map-sec .wam-r[data-region="mideast"] path'); return d ? getComputedStyle(d).stroke : null; })(),
      };
    });
    const W = { ja: ['機長', '副操縦士'], en: ['Captain', 'First Officer'] }[lang], NAME = { ja: '職位', en: 'Rank' }[lang];
    /* 広い画面 */
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang] });
    PAGES.push(P);
    try {
      const { page, st } = P;
      const a = await posOf(page);
      ok(a.shown && same(a.btn, [`cap:true:${W[0]}`, `fo:false:${W[1]}`]) && a.pos === 'cap' && same(a.strip, ['cap']) && a.name === NAME && same(a.key, ['cap']),
        T(`map-pos 1440：切り替えが見える（${W[0]}｜${W[1]}・押してあるのは${W[0]}・組の名前「${NAME}」）・区域は cap・見せる帯と凡例は機長の1本`), J(a));
      await press(page, '#wa-map-sec .wam-pb[data-pos="fo"]');
      const on = await until(page, () => document.getElementById('wa-map-sec').getAttribute('data-pos') === 'fo');
      const b = await posOf(page);
      ok(on && same(b.btn, [`cap:false:${W[0]}`, `fo:true:${W[1]}`]) && same(b.strip, ['fo']) && b.h === a.h,
        T(`map-pos 1440：${W[1]}を押す → 区域は fo・押してあるのは${W[1]}・見せる帯は副操縦士の1本・カードの高さはそのまま`), J({ a: a.h, b }));
      ok(b.hist === a.hist && b.ls === a.ls && b.ss === a.ss, T('map-pos 1440：履歴も保存領域（local / session）も1つも増えない・変わらない'), J({ hist: [a.hist, b.hist], ls: a.ls === b.ls, ss: a.ss === b.ss }));
      ok(same(b.key, ['fo']) && !!a.dot && !!b.dot && a.dot !== b.dot, T(`map-pos 1440：${W[1]}を押す → 凡例は副操縦士の行・地図の中東の点の色が変わる（地図は選んだ職位で塗る）`), J({ key: b.key, dot: [a.dot, b.dot] }));
      await shot(page, 'map-pos', lang, '1-fo');
      await page.focus('#wa-map-sec .wam-pb[data-pos="cap"]');
      await page.keyboard.press('Space');
      const back = await until(page, () => document.getElementById('wa-map-sec').getAttribute('data-pos') === 'cap');
      const c = await posOf(page);
      ok(back && same(c.btn, [`cap:true:${W[0]}`, `fo:false:${W[1]}`]) && same(c.strip, ['cap']) && c.dot === a.dot, T(`map-pos 1440：キーボード（${W[0]}にフォーカスして Space）で機長へ戻る（地図の色も戻る）`), J(c));
      const q = quiet(st, 'map-pos');
      ok(q.length === 0, T('map-pos quiet(st, \'map-pos\') が空（1440）'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
    /* 台本を止める */
    const N = await dirOpen(browser, L, { rel: PAGE_REL[lang], js: false });
    PAGES.push(N);
    try {
      const n = await N.page.evaluate(() => { const s = document.querySelector('#wa-map-sec .wam-pos'); return s ? { disp: getComputedStyle(s).display, rects: s.getClientRects().length } : null; });
      ok(!!n && n.disp === 'none' && n.rects === 0, T('map-pos 台本なし：切り替えは見えない（押しても何も起きないボタンを出さない）'), J(n));
    } finally {
      await N.ctx.close().catch(() => {});
    }
    /* 狭い画面・指 */
    const S = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: 390, h: 680, touch: true });
    PAGES.push(S);
    try {
      const { page, st } = S;
      const z = await posOf(page), k0 = await closedCard(page);
      ok(z.shown && isClosed(k0) && k0.pos === 'cap', T('map-pos 390：開いたときはカードが閉じていて（見えているのは切り替えの右の「すべて」と機長の額の1行だけ ── WP-dmap-8 D1）、切り替えは見えている（地図と一緒に立つ）'), J({ z: z.shown, k0 }));
      /* ★WP-dmap-8 D1（class B）：カードが閉じたまま副操縦士を押すと、見えている額が変わる（地図の濃さは職位ごとに 0〜1 なので、地図だけでは押した効き目が見えない） */
      await page.tap('#wa-map-sec .wam-pb[data-pos="fo"]');
      const onF = await until(page, () => document.getElementById('wa-map-sec').getAttribute('data-pos') === 'fo');
      const k1 = await closedCard(page);
      ok(onF && isClosed(k1) && k1.pos === 'fo' && same(k1.shown, [k0.fo]) && k0.shown[0] !== k1.shown[0],
        T(`map-pos 390：カードが閉じたまま${W[1]}を指で押す → 見えている額が「すべて」の機長の額から副操縦士の額に変わる・カードは閉じたまま（WP-dmap-8 D1）`), J({ k0: k0.shown, k1 }));
      await shot(page, 'map-pos', lang, '2a-narrow-closed-fo');
      await page.tap('#wa-map-sec .wam-pb[data-pos="cap"]');
      const onC = await until(page, () => document.getElementById('wa-map-sec').getAttribute('data-pos') === 'cap');
      const k2 = await closedCard(page);
      ok(onC && isClosed(k2) && same(k2.shown, [k0.cap]), T(`map-pos 390：${W[0]}を押すと見えている額も機長の額へ戻る`), J(k2));
      await page.tap('#region-strip .rstrip-btn[data-region="europe"]');
      const open1 = await until(page, () => document.getElementById('wa-map-sec').classList.contains('is-open') && !!document.querySelector('#wam-p-europe.is-shown'));
      const y = await page.evaluate(() => { const s = document.querySelector('#wa-map-sec .wam-pos'), m = document.querySelector('#wa-map-sec .wam-map'); if (!s || !m) return null; s.scrollIntoView({ block: 'center', behavior: 'instant' });
        const a = s.getBoundingClientRect(), b = m.getBoundingClientRect(); return { pos: getComputedStyle(s).position, above: a.bottom <= b.top + 1 }; });
      ok(open1 && !!y && y.pos === 'static' && y.above, T('map-pos 390：地域のボタンを指で押す → カードが開く・切り替えは地図の上の1行'), J({ open1, y }));
      await page.tap('#wa-map-sec .wam-pb[data-pos="fo"]');
      const on = await until(page, () => document.getElementById('wa-map-sec').getAttribute('data-pos') === 'fo');
      const b = await posOf(page);
      ok(on && same(b.strip, ['fo']) && same(b.btn, [`cap:false:${W[0]}`, `fo:true:${W[1]}`]), T(`map-pos 390：${W[1]}を指で押す → 区域は fo・見せる帯は副操縦士の1本`), J(b));
      await shot(page, 'map-pos', lang, '2-narrow');
      const q = quiet(st, 'map-pos');
      ok(q.length === 0, T('map-pos quiet(st, \'map-pos\') が空（390）'), J(q));
    } finally {
      await S.ctx.close().catch(() => {});
    }
  }

  /* ════ 地図の場面（WP-dmap-5 ＝ DM4 ＋ DM6）。組んだ形（WP-dmap-4）のとおりに歩く：区域の幅 1000px 以上 ＝ 地図の右にカード・
     700〜999px ＝ 地図の下にカード・700px 未満 ＝ 切り替え・地図・カード（カードは地図に触れるか選ぶまで閉じている）。
     地図を指す・押すのは toPage(svg.wam-svg の箱, ...POINT_AT[地域] / SEA)（形の箱のまんなかへは行かない）。時計は Asia/Tokyo ════ */
  const tokyo = (page) => page.emulateTimezone('Asia/Tokyo');
  const AWAY = [4, 200];   // 地域のボタンにも地図にもカードにも掛からない所（左の余白）── マウスを「離す」ときに置く
  const BTN = (c) => `#region-strip .rstrip-btn[data-region="${c}"]`;
  const LB = (c, lang) => REGION_LABEL[c][lang === 'en' ? 1 : 0];
  /* 見せているカード（computed visibility が visible の .wam-panel の地域。ちょうど1枚のはず） */
  const shownPanels = (page) => page.evaluate(() => [...document.querySelectorAll('#wa-sum .wam-panel')]
    .filter((p) => getComputedStyle(p).visibility === 'visible').map((p) => p.dataset.region));
  const isShown = (page, code, timeout = 20000) => page.waitForFunction((c) => {
    const v = [...document.querySelectorAll('#wa-sum .wam-panel')].filter((p) => getComputedStyle(p).visibility === 'visible');
    return v.length === 1 && v[0].dataset.region === c;
  }, { timeout }, code).then(() => true, () => false);
  /* カードの箱（文書の上の位置 ＝ スクロールしても変わらない）。箱が無ければ null */
  const cardBox = (page) => page.evaluate(() => {
    const c = document.getElementById('wa-sum');
    if (!c || !c.getClientRects().length) return null;
    const r = c.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.top + window.scrollY), Math.round(r.width), Math.round(r.height)];
  });
  /* 閉じたカード（区域 700px 未満・WP-dmap-8 D1）。前は「箱を持たない」だった（P7.4）── リード（WP-dmap-8 D1：スマホでは「機長｜副操縦士」を
     押しても凡例しか変わらないように見える → 「すべて」のカードを小さく出す）で付け替えた。閉じている ＝ is-open が無く、見えているのは
     「すべて」の札と選んだ職位の額の2つだけ（定義・散らばり・条件/出典・ボタン・ほかの地域の札と額は箱を持たない）・その1行は切り替えと同じ行の中
     （面を高くしない）。開いたカードの中身（散らばり・条件/出典・ボタン）は今までどおり、触れるか選ぶまで出ない */
  const closedCard = (page) => page.evaluate(() => {
    const sec = document.getElementById('wa-map-sec'), c = document.getElementById('wa-sum'), sw = document.querySelector('#wa-map-sec .wam-pos');
    const seen = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility === 'visible';
    const parts = [...c.querySelectorAll('.wam-h, .wam-k, .wam-def, .wam-n, .wam-sp, .wam-cond, .wam-go')].filter(seen)
      .map((e) => `${(e.closest('.wam-panel') || { dataset: {} }).dataset.region || '-'}:${e.className.split(' ')[0]}${e.closest('.wam-row') ? ':' + e.closest('.wam-row').dataset.pos : ''}`);
    const a = c.getClientRects().length ? c.getBoundingClientRect() : null, b = sw && sw.getClientRects().length ? sw.getBoundingClientRect() : null;
    const fig = (p) => (document.querySelector(`#wam-p-all .wam-row[data-pos="${p}"] .wam-n`) || {}).textContent || null;
    return { open: sec.classList.contains('is-open'), pos: sec.getAttribute('data-pos'), parts, inRow: !!a && !!b && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5,
      shown: [...c.querySelectorAll('.wam-n')].filter(seen).map((e) => e.textContent), cap: fig('cap'), fo: fig('fo') };
  });
  const isClosed = (k) => !k.open && same(k.parts, ['all:wam-h', `all:wam-n:${k.pos}`]) && k.inRow && same(k.shown, [k[k.pos]]);
  /* 光る層の opacity（地域ごと） */
  const lightOf = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#wa-map-sec .wam-o')].map((o) => {
    const q = (s) => { const e = o.querySelector(s); return e ? Number(getComputedStyle(e).opacity) : null; };
    return [o.dataset.region, { lit: q('.wam-lit'), halo: q('.wam-halo'), ring: q('.wam-ring') }];
  })));
  const litWhere = (page, code, test) => until(page, (c, t) => {
    const e = document.querySelector(`#wa-map-sec .wam-o[data-region="${c}"] .${t[0]}`);
    const v = e ? Number(getComputedStyle(e).opacity) : NaN;
    return t[1] === '>' ? v > t[2] : v === t[2];
  }, code, test);
  const regionNow = (page) => page.evaluate(() => window.PVDirectory.state().region);
  const selectedIs = (page, code, timeout = 20000) => page.waitForFunction((c) => window.PVDirectory.state().region === c
    && (document.querySelector(`#region-strip .rstrip-btn[data-region="${c}"]`) || {}).getAttribute?.('aria-pressed') === 'true', { timeout }, code).then(() => true, () => false);
  /* 箱の中の位置 → ページの上の位置（いまの svg の箱で） */
  /* toPage() は「svg の箱 ＝ 形の箱 0〜1000 × 0〜440」の写し。WP-dmap-7 から svg の viewBox は形の箱より上下に広い（北の上に海）ので、
     viewBox が形の箱のどこに在るかを読み、形の箱 0〜440 が画面のどこに在るかの箱を作ってから toPage() に渡す（同じ写し方・同じ強さ） */
  const boxPt = async (page, xy) => {
    const r = await page.evaluate(() => {
      const s = document.querySelector('#wa-map-sec .wam-svg'), b = s.getBoundingClientRect(), v = s.viewBox.baseVal;
      return { left: b.left - (v.x / v.width) * b.width, top: b.top - (v.y / v.height) * b.height, width: (b.width * 1000) / v.width, height: (b.height * 440) / v.height };
    });
    return toPage(r, xy[0], xy[1]);
  };
  /* ★「機長｜副操縦士」の切り替えの箱に掛かる陸の点（WP-dmap-7・リード 2026-10-25 Q2：class A）── 700〜999px では切り替えが地図に重なる。
     点はページそのものの点の列（svg の path[id^="wam-d-"] の d ＝「M x y h 長さ」、点は 5.2 ごと）から、半径はその path の線の太さの半分。
     いまの svg の箱と viewBox で画面の位置へ写し、点の円が切り替えの箱に1px でも掛かれば数える。切り替えが見えない・点が読めないときも赤（0 個を測って通らない） */
  const onLand = (page) => page.evaluate(() => {
    const sw = document.querySelector('#wa-map-sec .wam-pos'), svg = document.querySelector('#wa-map-sec .wam-svg');
    if (!sw || !svg || !sw.getClientRects().length || !svg.getClientRects().length) return { err: '切り替えか地図が見えない' };
    const a = sw.getBoundingClientRect(), b = svg.getBoundingClientRect(), v = svg.viewBox.baseVal, sx = b.width / v.width, sy = b.height / v.height;
    let dots = 0; const hit = [];
    for (const p of svg.querySelectorAll('path[id^="wam-d-"]')) {
      const d = p.getAttribute('d') || '', r = (parseFloat(getComputedStyle(p).strokeWidth) / 2) * sx;
      if (/[^Mh\d.\s-]/.test(d) || !(r > 0)) return { err: `点の列が読めない（${p.id}）` };
      for (const m of d.matchAll(/M(-?[\d.]+) (-?[\d.]+)h([\d.]+)/g)) {
        const x0 = +m[1], y = +m[2], n = Math.floor(+m[3] / 5.2 + 1e-6) + 1;
        for (let i = 0; i < n; i++) {
          dots++;
          const cx = b.left + (x0 + i * 5.2 - v.x) * sx, cy = b.top + (y - v.y) * sy;
          const dx = Math.max(a.left - cx, 0, cx - a.right), dy = Math.max(a.top - cy, 0, cy - a.bottom);
          if (dx * dx + dy * dy < r * r) hit.push(`${p.id.slice(6)} ${Math.round((x0 + i * 5.2) * 10) / 10},${y}`);
        }
      }
    }
    return dots < 1000 ? { err: `読めた点が ${dots} 個` } : { n: hit.length, hit: hit.slice(0, 4), sw: [Math.round(a.left), Math.round(a.top), Math.round(a.width), Math.round(a.height)], pos: getComputedStyle(sw).position };
  });
  const toTop = async (page) => { await still(page); await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await still(page); };
  const mapInView = async (page) => { await still(page); await page.evaluate(() => document.querySelector('#wa-map-sec .wam-map').scrollIntoView({ block: 'center', behavior: 'instant' })); await still(page); };
  const shiftTab = async (page) => { await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift'); };
  /* フォーカスの在り処 */
  const act = (page) => page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return { body: true };
    const cls = a.getAttribute('class') || '';
    return {
      body: false, tag: a.tagName.toLowerCase(), id: a.id || '', cls, region: /\brstrip-btn\b/.test(cls) ? a.dataset.region : null,
      fv: a.matches(':focus-visible'), box: a.getClientRects().length > 0, vis: getComputedStyle(a).visibility, inSvg: !!a.closest('svg'),
      inSum: !!a.closest('#wa-sum'), summary: a.tagName === 'SUMMARY', panel: (a.closest('.wam-panel') || {}).id || null,
    };
  });
  const rpRegion = (page) => page.evaluate(() => document.getElementById('pv-rp').getAttribute('data-rp-region'));
  const rpIs = (page, v) => until(page, (v) => document.getElementById('pv-rp').getAttribute('data-rp-region') === v, v);
  const hotBtn = (page, c) => until(page, (c) => document.querySelector(`#region-strip .rstrip-btn[data-region="${c}"]`).classList.contains('is-hot'), c);
  const rhBox = (page) => page.evaluate(() => { const r = document.getElementById('wd-rh').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight }; });
  /* 滑らかなスクロールのあとの形を待つ：その形になるまで待ち（上限つき）、スクロールが止まってからもう一度確かめる
     （「2コマ同じ位置」だけで待つと、スクロールが始まる前に通ってしまう ── 820×980 で踏んだ） */
  const settledOn = async (page, fn, ...args) => (await until(page, fn, ...args)) && (await still(page)) && page.evaluate(fn, ...args);
  const inViewEl = (id, whole) => { const r = document.getElementById(id).getBoundingClientRect(); return r.top >= 0 && (whole ? r.bottom <= window.innerHeight : r.top < window.innerHeight); };
  /* 要素のまんなかを押す・指す・指で触れる。先にその要素を画面のまんなかへ（固定のヘッダーの下に隠れた所を押さない）・
     その点に当たるのがその要素（かその中）でなければ押さずに false（ヘッダーのリンクを押して別のページへ移る、を起こさない） */
  const pointAt = (page, sel) => page.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, h = document.elementFromPoint(x, y);
    return h && (h === e || e.contains(h)) ? [x, y] : null;
  }, sel);
  const clickIn = async (page, sel) => { const p = await pointAt(page, sel); if (p) await page.mouse.click(...p); return !!p; };
  const hoverIn = async (page, sel) => { const p = await pointAt(page, sel); if (p) await page.mouse.move(...p); return !!p; };
  const tapIn = async (page, sel) => { const p = await pointAt(page, sel); if (p) await page.touchscreen.tap(...p); return !!p; };
  /* 社名（一覧のカードの見えている名前から、頭の旗の絵文字を外したもの ＝「条件/出典」の「対象」が書く名前） */
  const plainName = (t) => String(t || '').replace(/^[^\p{L}\p{N}]+\s/u, () => '');

  /* 場面 map-card（DM4・日英）── 地域のまとめのカード：指す・選ぶ・「条件/出典」・05b との継ぎ目・#pv-rp の印・古いページ・スマホ */
  async function mapCard(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], init: tokyo });
    PAGES.push(P);
    try {
      const { page, st } = P;
      /* (1) 9つのボタンにマウス：見せるのはその地域・カードの箱は動かない・離れると選んでいる地域 */
      await page.mouse.move(...AWAY);
      const b0 = await cardBox(page), bad1 = [];
      for (const c of ['all', ...REG8]) {
        const hv = await hoverIn(page, BTN(c));
        const s1 = await isShown(page, c), b = await cardBox(page);
        if (!hv || !s1 || !same(b, b0)) bad1.push({ c, hv, shown: await shownPanels(page), b });
      }
      await page.mouse.move(...AWAY);
      const back1 = await isShown(page, 'all'), bEnd = await cardBox(page);
      ok(!!b0 && bad1.length === 0 && back1 && same(bEnd, b0),
        T('map-card (1) 1440：9つの地域のボタンにマウスを載せる → 見せるカードはその地域・カードの箱（x・y・幅・高さ）は前も最中も9つとも同じ・ボタンから離れると選んでいる地域（すべて）'), J({ b0, bad1, back1, bEnd }));
      await shot(page, 'map-card', lang, '1-hover');

      /* (2) 「条件/出典」 */
      await page.focus(BTN('europe'));
      await page.keyboard.press('Enter');
      const selE = await selectedIs(page, 'europe');
      const cE = await clickIn(page, '#wam-p-europe .wam-cond > summary');
      const N = inRegion('europe').length;
      const fold = await page.evaluate((slugs) => {
        const d = document.querySelector('#wam-p-europe .wam-cond');
        const rows = [...d.querySelectorAll('.wam-cl > div')];
        return {
          open: d.open, kids: [...d.children].map((e) => e.tagName.toLowerCase() + (e.getAttribute('class') ? '.' + e.getAttribute('class') : '')),
          dts: rows.map((r) => (r.querySelector('dt') || {}).textContent), names: [...d.querySelectorAll('.wam-names li')].map((l) => l.textContent),
          cards: slugs.map((s) => { const e = document.getElementById('wn-' + s); return e && e.getClientRects().length ? e.textContent : null; }),
          count: rows[1] ? (rows[1].querySelector('dd') || {}).textContent : null, fx: rows[2] ? ((rows[2].querySelector('dd') || {}).textContent || '').trim() : '',
        };
      }, inRegion('europe'));
      const cardNames = fold.cards.map(plainName);
      ok(selE && cE && fold.open && same(fold.kids, ['summary', 'dl.wam-cl']) && same(fold.dts, FOLD[lang]) && fold.cards.every(Boolean)
        && fold.names.length === N && sameSet(fold.names, cardNames) && fold.count === COUNT_N[lang](N) && fold.fx.length > 0,
        T(`map-card (2) 欧州を選んで「条件/出典」を押す → 開く・「対象」は欧州の${N}枚のカードの見えている社名ちょうど・対象掲載社数「${COUNT_N[lang](N)}」・換算の文が在る・ほかには何も無い（${FOLD[lang].join('／')}の3つだけ）`),
        J({ selE, open: fold.open, kids: fold.kids, dts: fold.dts, n: fold.names.length, onlyFold: fold.names.filter((x) => !cardNames.includes(x)), onlyCards: cardNames.filter((x) => !fold.names.includes(x)), count: fold.count, fx: fold.fx.slice(0, 60) }));
      await shot(page, 'map-card', lang, '2-fold');
      await hoverIn(page, BTN('asia'));
      const hotA = await hotBtn(page, 'asia'), keepA = same(await shownPanels(page), ['europe']);
      await page.mouse.move(...AWAY);
      await page.focus(BTN('mideast'));
      const hotM = await hotBtn(page, 'mideast'), keepM = same(await shownPanels(page), ['europe']);
      ok(hotA && keepA && hotM && keepM, T('map-card (2) 開いたまま：別の地域のボタンにマウス（アジア）・フォーカス（中東）→ 見せるカードは欧州のまま・そのボタンに is-hot'), J({ hotA, keepA, hotM, keepM, shown: await shownPanels(page) }));
      await page.keyboard.press('Enter');
      const selM = await selectedIs(page, 'mideast');
      const closed = await page.evaluate(() => document.querySelector('#wam-p-europe .wam-cond').open === false);
      const showM = await isShown(page, 'mideast');
      ok(selM && closed && showM, T('map-card (2) 別の地域（中東）を選ぶ → 欧州の「条件/出典」は閉じ、カードは中東'), J({ selM, closed, shown: await shownPanels(page) }));
      /* 05b との継ぎ目：#pv-rp の中の開いた <details> もカードを止める・選ぶと閉じる */
      await page.mouse.move(...AWAY);
      const back2 = await isShown(page, 'mideast');
      await page.evaluate(() => { const x = document.createElement('div'); x.id = 'wam-test-joint'; x.innerHTML = '<details open><summary>x</summary></details>'; document.getElementById('pv-rp').appendChild(x); });
      await hoverIn(page, BTN('asia'));
      const hotJ = await hotBtn(page, 'asia'), keepJ = same(await shownPanels(page), ['mideast']);
      await page.mouse.move(...AWAY);
      await page.focus(BTN('oceania'));
      await page.keyboard.press('Enter');
      const selO = await selectedIs(page, 'oceania');
      const jClosed = await page.evaluate(() => document.querySelector('#wam-test-joint details').open === false);
      const showO = await isShown(page, 'oceania');
      await page.evaluate(() => document.getElementById('wam-test-joint').remove());
      ok(back2 && hotJ && keepJ && selO && jClosed && showO, T('map-card (2) 05b との継ぎ目：#pv-rp に開いた <details> → マウスで指してもカードは入れ替わらない・地域を選ぶとその <details> は閉じ、カードは選んだ地域'),
        J({ back2, hotJ, keepJ, selO, jClosed, shown: await shownPanels(page) }));
      /* D26 (c)：フォーカスが北米のボタンにあるまま、カードの字（定義の行）を押す → 北米のまま */
      await page.focus(BTN('us'));
      const showU = await isShown(page, 'us');
      const cU = await clickIn(page, '#wam-p-us .wam-def');
      await settle(page);
      const keepU = same(await shownPanels(page), ['us']);
      ok(showU && cU && keepU, T('map-card (2) フォーカスを北米のボタンに置いたまま、カードの字（定義の行）を押す → 見せるカードは北米のまま（D26 c）'), J({ showU, cU, shown: await shownPanels(page) }));

      /* (3) #pv-rp の data-rp-region */
      await page.mouse.move(...AWAY);
      await page.focus(BTN('all'));
      await page.keyboard.press('Enter');
      const selAll = await selectedIs(page, 'all');
      await page.mouse.move(...AWAY);
      const r0 = await rpIs(page, null);
      await hoverIn(page, BTN('asia'));
      const rH = await rpIs(page, 'asia');
      await page.mouse.move(...AWAY);
      const rOut = await rpIs(page, null);
      await page.focus(BTN('japan'));
      const rF = await rpIs(page, 'japan');
      await page.keyboard.press('Enter');
      const rS = (await selectedIs(page, 'japan')) && await rpIs(page, 'japan');
      await page.focus(BTN('all'));
      await page.keyboard.press('Enter');
      const rAll = (await selectedIs(page, 'all')) && await rpIs(page, null);
      await page.focus(BTN('europe'));
      await page.keyboard.press('Enter');
      const rE = (await selectedIs(page, 'europe')) && await rpIs(page, 'europe');
      const fo = (await clickIn(page, '#wam-p-europe .wam-cond > summary')) && await until(page, () => document.querySelector('#wam-p-europe .wam-cond').open === true);
      await type(page, 'x');
      const rQ = await rpIs(page, null);
      await type(page, '');
      const rBack = await rpIs(page, 'europe');
      ok(selAll && r0 && rH && rOut && rF && rS && rAll && rE && fo && rQ && rBack,
        T('map-card (3) #pv-rp の data-rp-region ＝ 見せている地域（マウス・フォーカス・選ぶ）・すべてと検索中は無い・「条件/出典」を開いたまま検索欄を空にすると戻る'),
        J({ selAll, r0, rH, rOut, rF, rS, rAll, rE, fo, rQ, rBack, now: await rpRegion(page) }));
      const q = quiet(st, 'map-card');
      ok(q.length === 0, T('map-card quiet(st, \'map-card\') が空（1440）'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }

    /* (2) の続き：「条件/出典」をキーボードで閉じた時、マウスが指している地域をすぐ見せる。
       組んだ形では 1440 のカードは地図の右にあり、開いた「条件/出典」が面を高くする ── 閉じると地域のボタンも地図も元の高さへ動き、
       マウスはもうその上に無い（ページは正しくマウスの指しを外す）。だからここは 1001（カードは地図の下・地図は動かない）で、
       マウスを地図のアフリカ（POINT_AT）に置いて確かめる */
    const K = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: 1001, h: 900, init: tokyo });
    PAGES.push(K);
    try {
      const { page, st } = K;
      await page.mouse.move(...AWAY);
      await page.focus(BTN('mideast'));
      await page.keyboard.press('Enter');
      const selM = await selectedIs(page, 'mideast');
      const openM = (await clickIn(page, '#wam-p-mideast .wam-cond > summary')) && await until(page, () => document.querySelector('#wam-p-mideast .wam-cond').open === true);
      const onSum = await page.evaluate(() => { const a = document.activeElement; return !!a && a.tagName === 'SUMMARY' && !!a.closest('#wam-p-mideast'); });
      await mapInView(page);
      await page.mouse.move(...(await boxPt(page, POINT_AT.africa)));
      const hotF = await litWhere(page, 'africa', ['wam-lit', '>', 0]), keepF = same(await shownPanels(page), ['mideast']);
      await page.keyboard.press('Enter');
      const showF = await isShown(page, 'africa');
      ok(selM && openM && onSum && hotF && keepF && showF,
        T('map-card (2) 1001：中東を選んで「条件/出典」を開いたまま、マウスを地図のアフリカに置く（光るのはアフリカ・カードは中東のまま）→ キーボード（Enter）で閉じる → すぐアフリカを見せる'),
        J({ selM, openM, onSum, hotF, keepF, shown: await shownPanels(page) }));
      const q = quiet(st, 'map-card');
      ok(q.length === 0, T('map-card quiet(st, \'map-card\') が空（1001）'), J(q));
    } finally {
      await K.ctx.close().catch(() => {});
    }

    /* (4) 古いページ（地図とカードの塊の無い一覧）＋ 新しい台本 */
    const OLD_DIR = path.join(ROOT, 'temporary screenshots'), OLD = path.join(OLD_DIR, `wam-old-${lang}.html`);
    let O = null;
    try {
      fs.mkdirSync(OLD_DIR, { recursive: true });
      const src = read(PAGE_REL[lang]);
      const cut = src.replace(/<!--PV-DIRMAP-->[\s\S]*?<!--\/PV-DIRMAP-->/, () => '<!--PV-DIRMAP--><!--/PV-DIRMAP-->')
        .replace(/<head[^>]*>/, (m) => `${m}<base href="${lang === 'en' ? '/en/' : '/'}">`);
      if (cut === src || cut.includes('wa-map-sec')) throw new Error('古いページを作れない（塊の印が無い）');
      fs.writeFileSync(OLD, cut);
      O = await dirOpen(browser, L, { rel: `temporary%20screenshots/wam-old-${lang}.html`, init: tokyo });
      PAGES.push(O);
      const v0 = await visible(O.page);
      await clickIn(O.page, BTN('europe'));
      const selO = await until(O.page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="europe"]') || {}).getAttribute?.('aria-pressed') === 'true');
      const v1 = await visible(O.page);
      ok(O.st.errs.length === 0 && same(v0, ORDER) && selO && sameSet(v1, inRegion('europe')) && v1.length === inRegion('europe').length,
        T('map-card (4) 古いページ（PV-DIRMAP の中身なし）＋ 新しい台本：スクリプトは止まらない・112社が並ぶ・地域のボタンで欧州が選べる'), J({ errs: O.st.errs, n0: v0.length, selO, n1: v1.length }));
      const q4 = quiet(O.st, 'map-card (4)');
      ok(q4.length === 0, T('map-card (4) quiet が空'), J(q4));
    } finally {
      if (O) await O.ctx.close().catch(() => {});
      fs.rmSync(OLD, { force: true });
    }

    /* (5) スマホ（390×680・指）：開いたときカードは閉じている（closedCard ── 見えるのは「すべて」の1行だけ。前は「箱を持たない」・WP-dmap-8 D1 で付け替え）
       → Tab で欧州（開かない・欧州の札も額も見せない）→ Enter（開く・結果へは動かない・ボタンは画面の中）→
       アジアを指で押す（アジア・結果の見出しが画面に入る）→ すべてを指で押す（開いたまま・すべて） */
    const S = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: 390, h: 680, touch: true,
      init: async (page) => { await tokyo(page); await page.evaluateOnNewDocument(() => { const f = window.scrollTo; window.__wamTo = 0; window.scrollTo = function () { window.__wamTo++; return f.apply(window, arguments); }; }); } });
    PAGES.push(S);
    try {
      const { page, st } = S;
      const z0 = await closedCard(page), a0 = await rpRegion(page);
      await page.focus(BTN('africa'));
      await page.keyboard.press('Tab');
      const onE = (await act(page)).region === 'europe';
      const z1 = await closedCard(page), a1 = await rpRegion(page);
      ok(isClosed(z0) && a0 === null && onE && isClosed(z1) && a1 === null, T('map-card (5) 390 指：開いたときカードは閉じていて（「すべて」の1行だけ・WP-dmap-8 D1）#pv-rp に地域の印も無い・Tab で欧州のボタンへ → まだ開かない・欧州の札も額も見せない・印も無い（フォーカスでは開かない）'), J({ z0, a0, onE, z1, a1 }));
      const to0 = await page.evaluate(() => window.__wamTo);
      await page.keyboard.press('Enter');
      const openE = await isShown(page, 'europe');
      await still(page);
      const e = await page.evaluate(() => { const b = document.activeElement.getBoundingClientRect(); return { to: window.__wamTo, region: document.activeElement.dataset.region, top: b.top, bottom: b.bottom, vh: innerHeight }; });
      const z2 = await cardBox(page);
      ok(openE && !!z2 && e.to === to0 && e.region === 'europe' && e.top >= 0 && e.bottom <= e.vh + 1,
        T('map-card (5) 390 Enter → カードが開いて欧州・結果の見出しへは動かさない（scrollTo を呼ばない）・押したボタンは画面の中（D26 e。1px 未満の端数は許す）'), J({ openE, z2, e, to0 }));
      await tapIn(page, BTN('asia'));
      const showA = await isShown(page, 'asia');
      const rhIn = await settledOn(page, inViewEl, 'wd-rh', false), rh = await rhBox(page);
      ok(showA && rhIn, T('map-card (5) 390 アジアのボタンを指で押す → カードはアジア・スクロールが止まったとき結果の見出しの上端が画面の中（D12）'), J({ showA, rh }));
      await tapIn(page, BTN('all'));
      const showAll = await isShown(page, 'all'), z3 = await cardBox(page);
      ok(showAll && !!z3, T('map-card (5) 390 「すべて」を指で押す → カードは開いたまま、すべてを見せる'), J({ showAll, z3 }));
      await shot(page, 'map-card', lang, '5-390');
      const q = quiet(st, 'map-card');
      ok(q.length === 0, T('map-card quiet(st, \'map-card\') が空（390）'), J(q));
    } finally {
      await S.ctx.close().catch(() => {});
    }
  }

  /* 場面 map-keys（DM4 ＋ DM6・日英・1440×900）── キーボードで地域のボタン・フォーカスの決まり・光る層 */
  async function mapKeys(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], init: tokyo });
    PAGES.push(P);
    try {
      const { page, st } = P;
      await page.mouse.move(...AWAY);
      await page.focus('#search');
      let n = 0, a = await act(page);
      while (!(a.region === 'all') && n < 40) { await page.keyboard.press('Tab'); n++; a = await act(page); }
      ok(a.region === 'all', T(`map-keys 検索欄から Tab ${n} 回で地域の「すべて」のボタン`), J({ n, a }));
      /* part 1 ＋ part 2：9つのボタンを Tab で → :focus-visible・その地域を見せる・その地域の点が光る（日本は丸も）→ Enter で選ぶ・スクロールしない */
      const y0 = await page.evaluate(() => window.scrollY), bad = [];
      for (const [k, c] of ['all', ...REG8].entries()) {
        if (k > 0) await page.keyboard.press('Tab');
        const f = await act(page), sh = await isShown(page, c);
        const lit = c === 'all' ? true : await litWhere(page, c, ['wam-lit', '>', 0]);
        const ring = c === 'japan' ? await litWhere(page, c, ['wam-ring', '=', 1]) : true;
        await page.keyboard.press('Enter');
        const sel = await selectedIs(page, c), y = await page.evaluate(() => window.scrollY);
        if (!(f.region === c && f.fv && sh && lit && ring && sel && y === y0)) bad.push({ c, f, sh, lit, ring, sel, y, y0, light: (await lightOf(page))[c] });
      }
      ok(bad.length === 0, T('map-keys part 1・2 9つの地域のボタンへ Tab → :focus-visible・見せるカードはその地域・その地域の点の光る層（.wam-o … .wam-lit）の opacity > 0（日本は丸も）→ Enter で選ぶ（aria-pressed・state().region）・window.scrollY は変わらない'), J(bad));
      await shot(page, 'map-keys', lang, '1-latam');
      /* 欧州を選んで、検索欄から Tab 40 回 → Shift+Tab 40 回：どの1回も <body> でない・箱がある・visible・地図の <svg> の中でない */
      await page.focus(BTN('europe'));
      await page.keyboard.press('Enter');
      const selE = await selectedIs(page, 'europe');
      await page.focus('#search');
      const walk = [];
      for (let i = 0; i < 80; i++) {
        if (i < 40) await page.keyboard.press('Tab'); else await shiftTab(page);
        const f = await act(page);
        if (f.body || !f.box || f.vis !== 'visible' || f.inSvg) walk.push({ i, f });
      }
      ok(selE && walk.length === 0, T('map-keys 欧州を選んで検索欄から Tab ×40・Shift+Tab ×40：フォーカスはいつも <body> でなく、箱があり、visible で、地図の <svg> の中に入らない'), J(walk.slice(0, 4)));
      /* すべてのボタンから Shift+Tab 1回 → 選んでいる欧州のカードの中・あと3回までに欧州の「条件/出典」 */
      await page.focus(BTN('all'));
      await shiftTab(page);
      const s1 = await act(page), p1 = await isShown(page, 'europe');
      let k = 0, s = s1;
      while (!(s.summary && s.panel === 'wam-p-europe') && k < 3) { await shiftTab(page); k++; s = await act(page); }
      ok(p1 && s1.inSum && s.summary && s.panel === 'wam-p-europe', T(`map-keys 欧州を選んだまま「すべて」のボタンから Shift+Tab → カードは欧州・フォーカスはカード（#wa-sum）の中・あと ${k} 回で欧州の「条件/出典」`), J({ p1, s1, k, s }));
      /* 北米のボタンに Tab で（何も選ばずに）→ マウスで見せているカードの「条件/出典」を押す → 北米の中の <details> が開く */
      await page.focus(BTN('all'));
      await page.keyboard.press('Enter');
      const selAll = await selectedIs(page, 'all');
      await page.mouse.move(...AWAY);
      await page.focus(BTN('europe'));
      await page.keyboard.press('Tab');
      const onUs = (await act(page)).region === 'us' && await isShown(page, 'us');
      const cUs = await clickIn(page, '#wam-p-us .wam-cond > summary');
      const openUs = cUs && await until(page, () => document.querySelector('#wam-p-us .wam-cond').open === true && document.querySelectorAll('#wa-sum details[open]').length === 1);
      const stillUs = same(await shownPanels(page), ['us']);
      ok(selAll && onUs && openUs && stillUs, T('map-keys 何も選ばずに Tab で北米のボタン → マウスで「条件/出典」を押す → 北米のカードの <details> が開く（カードは北米のまま）'), J({ selAll, onUs, openUs, shown: await shownPanels(page) }));
      /* A13（地域ごとに履歴を積まない）：欧州を選び、欧州の「条件/出典」にフォーカス → PVDirectory.setRegion('asia') → アジアのカードの「条件/出典」へ → 読み直す → アジア */
      await page.mouse.move(...AWAY);
      await page.focus(BTN('europe'));
      await page.keyboard.press('Enter');
      const selE2 = await selectedIs(page, 'europe');
      await page.focus('#wam-p-europe .wam-cond > summary');
      await page.evaluate(() => window.PVDirectory.setRegion('asia'));
      const fA = await until(page, () => { const x = document.activeElement; return !!x && x.tagName === 'SUMMARY' && !!x.closest('#wam-p-asia'); });
      const pA = await isShown(page, 'asia');
      ok(selE2 && fA && pA, T('map-keys 欧州の「条件/出典」にフォーカスしたまま、ほかの台本が setRegion(\'asia\') → カードはアジア・フォーカスはアジアの「条件/出典」（隠れた所に残らない）'), J({ selE2, fA, pA, act: await act(page) }));
      await page.reload({ waitUntil: 'load', timeout: 60000 });
      await ready(page);
      const pR = await isShown(page, 'asia'), href = page.url();
      ok(pR && /[?&]region=asia(&|$)/.test(href), T('map-keys 読み直す → 住所は region=asia・カードはアジア'), J({ pR, href: href.replace(L.base, () => '') }));
      const q = quiet(st, 'map-keys');
      ok(q.length === 0, T('map-keys quiet(st, \'map-keys\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 map-fit（DM4・ライト）── 7つの通貨 × 幅 1001・390 × 9枚のカード：額が切れない・カードの中・職位の札と重ならない・帯は 72px 以上・
     帯の点と幅と平均の印は書いた額のとおりの所（0.6px 以内）・通貨を戻すと1字も違わない・英語はドルで開く（¥ なし）／
     assert-header.mjs の10の幅 × 円・ドルで横にはみ出さない（区域の箱は画面の幅の中）／★1001・390 と10の幅で、切り替えの箱に陸の点が1つも掛からない（onLand） */
  async function mapFit(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const CURS = [...(read('currency.js').match(/var RATES = \{([^}]*)\}/) || ['', ''])[1].matchAll(/([A-Z]{3}):/g)].map((m) => m[1]);
    const WIDTHS = JSON.parse((read('assert-header.mjs').match(/const WIDTHS = (\[[\d,\s]+\]);/) || ['', '[]'])[1]);
    ok(CURS.length === 7 && CURS.includes('JPY') && CURS.includes('USD') && WIDTHS.length === 10, T(`map-fit 通貨は currency.js の RATES から（${CURS.join('・')}）・幅は assert-header.mjs の WIDTHS から（${WIDTHS.join('・')}）`), J({ CURS, WIDTHS }));
    const start = lang === 'en' ? 'USD' : 'JPY';
    /* 9枚のカード（重なっていて、見えていない8枚も箱は持つ）と凡例の、額・札・帯の当てはまり */
    const fit = (page) => page.evaluate(() => {
      const bad = [], card = document.getElementById('wa-sum').getBoundingClientRect(), g = document.querySelector('#wa-map-sec .wam-g').getBoundingClientRect();
      const inX = (r, b) => r.left >= b.left - 0.5 && r.right <= b.right + 0.5;
      const px = (r) => `${Math.round(r.left)}〜${Math.round(r.right)}`;
      let n = 0;
      for (const p of document.querySelectorAll('#wa-sum .wam-panel')) {
        const id = p.dataset.region;
        for (const e of p.querySelectorAll('.wam-n, .wam-mm-v, .wam-w-v, .wam-ax span')) {
          if (e.closest('.wam-ax span span')) continue;
          n++;
          const r = e.getBoundingClientRect();
          if (e.scrollWidth > e.clientWidth) bad.push(`${id}「${e.textContent}」が切れている ${e.scrollWidth}/${e.clientWidth}`);
          if (!inX(r, card)) bad.push(`${id}「${e.textContent}」がカードの外 ${px(r)}／${px(card)}`);
        }
        for (const row of p.querySelectorAll('.wam-row')) {
          const k = row.querySelector('.wam-rk').getBoundingClientRect(), n = row.querySelector('.wam-n').getBoundingClientRect(), rr = row.getBoundingClientRect();
          if (k.right > n.left + 0.5) bad.push(`${id} ${row.dataset.pos}：職位の札と額が重なる`);
          if (!inX(k, rr) || !inX(n, rr)) bad.push(`${id} ${row.dataset.pos}：札か額が行の外`);
        }
        for (const t of p.querySelectorAll('.wam-track')) if (t.getBoundingClientRect().width < 72) bad.push(`${id}：帯が ${Math.round(t.getBoundingClientRect().width)}px（72 未満）`);
      }
      const keys = [...document.querySelectorAll('#wa-map-sec .wam-key > span')].filter((e) => e.getClientRects().length);
      if (keys.length !== 2) bad.push(`見えている凡例の額が ${keys.length} 個（選んでいる職位の行の 2 のはず）`);
      for (const e of keys) {
        if (e.scrollWidth > e.clientWidth) bad.push(`凡例「${e.textContent}」が切れている`);
        if (!inX(e.getBoundingClientRect(), g)) bad.push(`凡例「${e.textContent}」が面の外`);
      }
      const de = document.documentElement;
      if (de.scrollWidth > de.clientWidth) bad.push(`ページが横にはみ出す ${de.scrollWidth}/${de.clientWidth}`);
      /* 測った額の数（9枚 × (行の額 2 ＋ 帯 2本 × (最低・最高・幅・目盛の 0 と右端の 5))）＝ 108。0 個を測って通る、を起こさない */
      if (n !== 9 * (2 + 2 * 5)) bad.push(`測った額が ${n} 個（108 のはず）`);
      return bad;
    });
    /* 帯の絵（いまの通貨で。額は書いた字から：英語は焼いた span の data-jpy、日本語は「¥…万」）*/
    const geo = (page) => page.evaluate(() => {
      const man = (e) => { if (!e) return null; const s = e.querySelector('.pv-cur[data-jpy]'); if (s) return Number(s.dataset.jpy) / 10000; const m = /¥([\d,]+)万/.exec(e.textContent); return m ? Number(m[1].replace(/,/g, () => '')) : null; };
      const out = [];
      for (const p of document.querySelectorAll('#wa-sum .wam-panel')) for (const sp of p.querySelectorAll('.wam-sp')) {
        const t = sp.querySelector('.wam-track'), tr = t.getBoundingClientRect(), band = t.querySelector('.wam-band').getBoundingClientRect(), mk = t.querySelector('.wam-mean').getBoundingClientRect();
        out.push({
          region: p.dataset.region, pos: sp.dataset.pos, tl: tr.left, tw: tr.width, ax: man(sp.querySelector('.wam-ax span:last-child')),
          lo: man(sp.querySelector('.wam-lo .wam-mm-v')), hi: man(sp.querySelector('.wam-hi .wam-mm-v')), mean: man(p.querySelector(`.wam-row[data-pos="${sp.dataset.pos}"] .wam-n`)),
          bl: band.left, br: band.right, mc: mk.left + mk.width / 2,
          dots: [...t.querySelectorAll('i:not([class])')].map((i) => { const r = i.getBoundingClientRect(); return r.left + r.width / 2; }),
        });
      }
      return out;
    });
    const geoBad = (G) => {
      const bad = [];
      if (G.length !== 18) bad.push(`帯が ${G.length} 本（9枚 × 2職位 ＝ 18 のはず）`);
      for (const g of G) {
        const at = (v) => g.tl + (v / g.ax) * g.tw, vals = inRegion(g.region).map((s) => SALARY[s][g.pos].avg).sort((a, b) => a - b);
        const tag = `${g.region} ${g.pos}`;
        if (![g.ax, g.lo, g.hi, g.mean].every((v) => typeof v === 'number' && v > 0)) { bad.push(`${tag}：額が読めない ${JSON.stringify([g.ax, g.lo, g.hi, g.mean])}`); continue; }
        if (g.lo !== vals[0] || g.hi !== vals[vals.length - 1]) bad.push(`${tag}：最低／最高 ${g.lo}／${g.hi} ≠ 台帳 ${vals[0]}／${vals[vals.length - 1]}`);
        if (Math.abs(g.bl - at(g.lo)) > 0.6) bad.push(`${tag}：帯の左端 ${g.bl.toFixed(1)} ≠ 最低の所 ${at(g.lo).toFixed(1)}`);
        if (at(g.hi) - at(g.lo) >= 2 && Math.abs(g.br - at(g.hi)) > 0.6) bad.push(`${tag}：帯の右端 ${g.br.toFixed(1)} ≠ 最高の所 ${at(g.hi).toFixed(1)}`);
        if (Math.abs(g.mc - at(g.mean)) > 0.6) bad.push(`${tag}：平均の印 ${g.mc.toFixed(1)} ≠ 平均の所 ${at(g.mean).toFixed(1)}`);
        if (g.dots.length !== vals.length) bad.push(`${tag}：点が ${g.dots.length} 個（会社は ${vals.length} 社）`);
        else { const d = g.dots.slice().sort((a, b) => a - b); vals.forEach((v, i) => { if (Math.abs(d[i] - at(v)) > 0.6) bad.push(`${tag}：${i + 1}番目の点 ${d[i].toFixed(1)} ≠ ${v}万の所 ${at(v).toFixed(1)}`); }); }
      }
      return bad;
    };
    const land = [];   // ★切り替えの箱に掛かる陸の点（onLand）── 1001・390 と10の幅で測り、最後に1行
    for (const [w, h] of [[1001, 900], [390, 680]]) {
      const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w, h, init: tokyo });
      PAGES.push(P);
      try {
        const { page, st } = P;
        land.push({ w, ...(await onLand(page)) });
        if (w < 700) {
          await page.focus(BTN('europe'));
          await page.keyboard.press('Enter');
          await isShown(page, 'europe');
        }
        const cur0 = await page.evaluate(() => window.PVCurrency.get());
        const text0 = await page.evaluate(() => document.getElementById('wa-map-sec').textContent);
        const yen0 = lang === 'en' ? /¥/.test(await page.evaluate(() => document.getElementById('wa-map-sec').innerText)) : false;
        if (lang === 'en') ok(cur0 === 'USD' && !yen0, T(`map-fit ${w}：英語のページはドルで開き、区域に ¥ が1字も無い`), J({ cur0, yen0 }));
        const gb = geoBad(await geo(page));
        ok(cur0 === start && gb.length === 0, T(`map-fit ${w}：9枚 × 2職位の帯 ── 点は会社の数だけ・帯の両端・平均の印・どの点も、書いた額と目盛の右端の割合の所（0.6px 以内）・最低／最高は台帳どおり`), J(gb.slice(0, 6)));
        const bad = [];
        for (const c of CURS) {
          await page.evaluate((c) => window.PVCurrency.set(c), c);
          const now = await page.evaluate(() => window.PVCurrency.get());
          const f = await fit(page);
          if (now !== c || f.length) bad.push({ c, now, f: f.slice(0, 4) });
          await page.evaluate((c) => window.PVCurrency.set(c), start);
          const back = await page.evaluate(() => document.getElementById('wa-map-sec').textContent);
          if (back !== text0) bad.push({ c, back: '戻すと字が違う' });
        }
        ok(bad.length === 0, T(`map-fit ${w}：7つの通貨 × 9枚のカード ── どの額も切れず、カードの中・職位の札と額が重ならない・帯は 72px 以上・凡例は面の中・横にはみ出さない／${start} → ほか → ${start} で区域の字が1字も違わない`), J(bad.slice(0, 3)));
        if (w === 390) await shot(page, 'map-fit', lang, '390-europe');
        const q = quiet(st, 'map-fit');
        ok(q.length === 0, T(`map-fit quiet(st, 'map-fit') が空（${w}）`), J(q));
      } finally {
        await P.ctx.close().catch(() => {});
      }
    }
    /* 10の幅 × 円・ドル：横にはみ出さない・区域の箱は画面の幅の中 */
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], init: tokyo });
    PAGES.push(P);
    try {
      const { page, st } = P;
      const bad = [];
      for (const w of WIDTHS) {
        await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
        await settle(page, 4);
        land.push({ w, ...(await onLand(page)) });
        for (const c of ['JPY', 'USD']) {
          await page.evaluate((c) => window.PVCurrency.set(c), c);
          const o = await page.evaluate(() => { const de = document.documentElement, s = document.getElementById('wa-map-sec').getBoundingClientRect(); return { sw: de.scrollWidth, cw: de.clientWidth, l: Math.round(s.left), r: Math.round(s.right) }; });
          if (o.sw > o.cw || o.l < 0 || o.r > o.cw) bad.push({ w, c, ...o });
        }
      }
      ok(bad.length === 0, T(`map-fit ${WIDTHS.length}の幅（${WIDTHS.join('・')}）× 円・ドル：ページが横にはみ出さない・地図の区域の箱は画面の幅の中`), J(bad));
      const onl = land.filter((x) => x.err || x.n !== 0);
      ok(land.length === 2 + WIDTHS.length && onl.length === 0,
        T(`map-fit 1001・390 と${WIDTHS.length}の幅：「機長｜副操縦士」の切り替えの箱に陸の点が1つも掛からない（700〜999px は地図の左下の海の上）`), J(onl.length ? onl.slice(0, 4) : land.map((x) => `${x.w}:${x.pos}`)));
      const q = quiet(st, 'map-fit');
      ok(q.length === 0, T('map-fit quiet(st, \'map-fit\') が空（10の幅）'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 map-point（DM6・日英・1440×900・マウス）── 地図を指す・押す・光る層・当たりの層（点の中心と点と点のあいだ・海） */
  async function mapPoint(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], init: tokyo });
    PAGES.push(P);
    try {
      const { page, st } = P;
      await page.mouse.move(...AWAY);
      /* 開いたとき */
      const rest = await page.evaluate(() => ({
        marks: [...document.querySelectorAll('#wa-map-sec .is-on, #wa-map-sec .is-hot, #region-strip .is-on, #region-strip .is-hot')].map((e) => e.getAttribute('class')),
        tip: !!document.getElementById('map-tooltip'),
      }));
      const L0 = await lightOf(page);
      const lit0 = Object.entries(L0).filter(([, v]) => v.lit !== 0 || v.halo !== 0).map(([c]) => c);
      ok(rest.marks.length === 0 && !rest.tip && Object.keys(L0).length === 8 && lit0.length === 0 && typeof L0.japan.ring === 'number' && L0.japan.ring < 1,
        T('map-point 開いたとき（地域なし）：is-on / is-hot はどこにも無い・8地域の光る層（.wam-lit・.wam-halo）は opacity 0・日本の丸はかすか（1 未満）・#map-tooltip は無い'), J({ rest, lit0, ring: L0.japan && L0.japan.ring }));
      /* 指す */
      const b0 = await cardBox(page), badH = [];
      for (const c of REG8) {
        await page.mouse.move(...AWAY);
        await page.mouse.move(...(await boxPt(page, POINT_AT[c])));
        const sh = await isShown(page, c), li = await litWhere(page, c, ['wam-lit', '>', 0]), b = await cardBox(page);
        await page.mouse.move(...(await boxPt(page, SEA)));
        await settle(page);
        const keep = same(await shownPanels(page), [c]);
        if (!(sh && li && keep && same(b, b0))) badH.push({ c, sh, li, keep, b });
      }
      const mos = PROBES.find((p) => p[0] === 'neutral' && p[3] === 'Moscow');
      await page.mouse.move(...(await boxPt(page, [mos[1], mos[2]])));
      await settle(page);
      const keepMos = same(await shownPanels(page), [REG8[REG8.length - 1]]);
      await page.mouse.move(...AWAY);
      const backAll = await isShown(page, 'all');
      const go0 = await page.evaluate(() => document.getElementById('wa-go').getClientRects().length === 0);
      ok(!!b0 && badH.length === 0 && keepMos && backAll && go0 && same(await cardBox(page), b0),
        T('map-point 1440 マウスで8つの POINT_AT を指す → 見せるカードはその地域・その地域の点が光る（.wam-lit の opacity > 0）・海（SEA）へ動いても、どこにも入れない陸地（Moscow）へ動いてもそのまま・地図を離れると選んでいる地域（すべて）・カードの箱は最初から最後まで同じ・「' + GO[lang] + '」は箱を持たない'),
        J({ badH, keepMos, backAll, go0 }));
      await shot(page, 'map-point', lang, '1-point');
      /* 押す（選ぶ）・もう1回（外す） */
      const badC = [];
      for (const c of REG8) {
        await toTop(page);
        await page.mouse.move(...AWAY);
        await page.mouse.click(...(await boxPt(page, POINT_AT[c])));
        const sel = await selectedIs(page, c), lit1 = await litWhere(page, c, ['wam-lit', '=', 1]);
        const rhIn = await settledOn(page, inViewEl, 'wd-rh', true), rh = await rhBox(page);
        await toTop(page);
        const yB = await page.evaluate(() => window.scrollY);
        await page.mouse.click(...(await boxPt(page, POINT_AT[c])));
        const rel = await selectedIs(page, 'all');
        await still(page);
        const yA = await page.evaluate(() => window.scrollY);
        if (!(sel && lit1 && rhIn && rel && yA === yB)) badC.push({ c, sel, lit1, rh, rel, yB, yA });
      }
      const tip = await page.evaluate(() => !!document.getElementById('map-tooltip'));
      ok(badC.length === 0 && !tip, T('map-point 1440 8つの POINT_AT を押す → その地域が選ばれる（state().region・aria-pressed）・光る層の opacity 1・結果の見出しが画面の中 → もう1回押す → 外れて、スクロールしない・#map-tooltip は無い'), J({ badC, tip }));
      /* 当たりの層（リードの決め・WP-dmap-5）：点の中心でも、点と点のあいだでも、その地域が選ばれる・海は何も選ばない。押す前にマウスは海（SEA）に置き、is-hot が無いのを待つ（A39） */
      const badHit = [];
      for (const c of REG8) {
        for (const [kind, xy] of [['点の中心', DOTGAP[c].D], ['点と点のあいだ', DOTGAP[c].G]]) {
          await toTop(page);
          await page.mouse.move(...AWAY);
          await page.mouse.move(...(await boxPt(page, SEA)));
          const calm = await until(page, () => !document.querySelector('#wa-map-sec .wam-svg .is-hot'));
          const [x, y] = await boxPt(page, xy);
          const hit = await page.evaluate((x, y) => { const e = document.elementFromPoint(x, y); return e ? `${e.tagName.toLowerCase()}.${e.getAttribute('class') || ''}[${e.getAttribute('data-region') || ''}]` : null; }, x, y);
          await page.mouse.click(x, y);
          const sel = await selectedIs(page, c, 5000);
          if (!calm || !sel) badHit.push({ c, kind, xy, hit, now: await regionNow(page) });
          await page.evaluate(() => window.PVDirectory.setRegion('all'));
          await selectedIs(page, 'all');
        }
      }
      await toTop(page);
      await page.mouse.move(...AWAY);
      const [sx, sy] = await boxPt(page, SEA);
      await page.mouse.move(sx, sy);
      const ySea = await page.evaluate(() => window.scrollY);
      const seaHit = await page.evaluate((x, y) => { const e = document.elementFromPoint(x, y); return e ? `${e.tagName.toLowerCase()}.${e.getAttribute('class') || ''}` : null; }, sx, sy);
      await page.mouse.click(sx, sy);
      await settle(page);
      const sea = { now: await regionNow(page), pr: await pressed(page), y: await page.evaluate(() => window.scrollY), hit: seaHit };
      ok(badHit.length === 0 && sea.now === 'all' && same(sea.pr, ['all']) && sea.y === ySea && sea.hit === 'svg.wam-svg',
        T('map-point 当たり（点の地図）：8地域とも、点の中心を押しても、点と点のあいだ（どの点の中心からも 2.6・点の縁の外）を押してもその地域が選ばれる（当たりの層の太い透明な線・日本は丸）・海（SEA）を押しても何も選ばれず、スクロールもしない'),
        J({ badHit, sea }));
      const q = quiet(st, 'map-point');
      ok(q.length === 0, T('map-point quiet(st, \'map-point\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
    /* ?region=europe で開く → 欧州だけが光る */
    const Q = await dirOpen(browser, L, { rel: PAGE_REL[lang], query: '?region=europe', init: tokyo });
    PAGES.push(Q);
    try {
      const { page, st } = Q;
      await page.mouse.move(...AWAY);
      const oneLit = await until(page, () => [...document.querySelectorAll('#wa-map-sec .wam-o')]
        .every((o) => Number(getComputedStyle(o.querySelector('.wam-lit')).opacity) === (o.dataset.region === 'europe' ? 1 : 0)));
      const on = await page.evaluate(() => ({
        sec: [...document.querySelectorAll('#wa-map-sec .is-on')].map((e) => `${(e.getAttribute('class') || '').split(' ')[0]}:${e.getAttribute('data-region')}`),
        strip: [...document.querySelectorAll('#region-strip .is-on')].map((e) => e.dataset.region), hot: document.querySelectorAll('#wa-map-sec .is-hot, #region-strip .is-hot').length,
      }));
      ok(oneLit && sameSet(on.sec, ['wam-r:europe', 'wam-o:europe']) && on.sec.length === 2 && same(on.strip, ['europe']) && on.hot === 0,
        T('map-point ?region=europe で開く → 光るのは欧州だけ（.wam-lit の opacity：欧州 1・ほか 0）・is-on は欧州の点の <g>・光る層の <g>・ボタンだけ'), J({ oneLit, on, light: await lightOf(page) }));
      await shot(page, 'map-point', lang, '2-europe');
      const q = quiet(st, 'map-point');
      ok(q.length === 0, T('map-point quiet(st, \'map-point\') が空（?region=europe）'), J(q));
    } finally {
      await Q.ctx.close().catch(() => {});
    }
  }

  /* 場面 map-tap（DM6・日英・指）── 390×680・375×640・820×980：地図に触れると見せるだけ・「この地域の航空会社を見る」で選ぶ・地域のボタンはすぐ選ぶ */
  async function mapTap(lang) {
    const T = (s) => `[${lang}] ${s}`;
    for (const [w, h] of [[390, 680], [375, 640], [820, 980]]) {
      const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w, h, touch: true, init: tokyo });
      PAGES.push(P);
      try {
        const { page, st } = P;
        const z = await cardBox(page), z8 = w < 700 ? await closedCard(page) : null, bad = [];
        if (w === 390) {
          /* 指の画面では地図の下の一言（クリックして地域を選ぶ）を出さない ── 触れると見せるだけで、選ぶのは「この地域の航空会社を見る」
             （WP-dmap-7・P2-a：本当でないことを言わない）。凡例はそのまま。マウスの画面で見えていることは場面 search の s3b */
          const hint = await page.evaluate((t) => {
            const p = document.querySelector('#wa-map-sec .wam-hint'), k = document.querySelector('#wa-map-sec .wam-key[data-pos="cap"]');
            return { has: !!p && p.textContent === t, shown: !!p && p.getClientRects().length > 0, key: !!k && k.getClientRects().length > 0 };
          }, HINT[lang]);
          ok(hint.has && !hint.shown && hint.key, T(`map-tap 390 指：地図の下の一言「${HINT[lang]}」は出さない（触れると見せるだけ・選ぶのはボタン）・凡例は出ている`), J(hint));
        }
        let b0 = null;
        for (const c of REG8) {
          await mapInView(page);
          await page.touchscreen.tap(...(await boxPt(page, POINT_AT[c])));
          const sh = await isShown(page, c);
          const cardIn = await settledOn(page, inViewEl, 'wa-sum', true);
          const m = await page.evaluate(() => {
            const g = document.getElementById('wa-go'), r = document.getElementById('wa-sum').getBoundingClientRect();
            return { go: g.getClientRects().length > 0 ? g.textContent : null, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, region: window.PVDirectory.state().region };
          });
          const v = await visible(page), pr = await pressed(page), b = await cardBox(page);
          if (!b0) b0 = b;
          if (!(sh && m.go === GO[lang] && m.region === 'all' && same(pr, ['all']) && same(v, ORDER) && cardIn && !!b && same(b, b0))) bad.push({ c, sh, cardIn, m, b, n: v.length, pr });
        }
        ok((w < 700 ? isClosed(z8) : z !== null) && bad.length === 0,
          T(`map-tap ${w}×${h} 指：8つの POINT_AT に触れる → 見せるカードはその地域・「${GO[lang]}」が見える・選んでいる地域（すべて）と一覧はそのまま・カードは画面の中（${w < 700 ? '開いたときは閉じていて（「すべて」の1行だけ・WP-dmap-8 D1）、触れると開く' : '初めから開いている'}）・カードの箱は8つとも同じ`),
          J({ z: z8 || z, b0, bad: bad.slice(0, 3) }));
        if (w === 390) await shot(page, 'map-tap', lang, '390-latam');
        const last = REG8[REG8.length - 1];
        await tapIn(page, '#wa-go');
        const selG = await selectedIs(page, last);
        const gIn = await settledOn(page, inViewEl, 'wd-rh', true);
        const g = await page.evaluate(() => { const r = document.getElementById('wd-rh').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, act: (document.activeElement || {}).id || '', gone: document.getElementById('wa-go').getClientRects().length === 0 }; });
        ok(selG && gIn && g.act === 'wd-rh-name' && g.gone,
          T(`map-tap ${w}×${h} 「${GO[lang]}」を指で押す → ${LB(last, lang)}が選ばれる・結果の見出しが画面の中・フォーカスは #wd-rh-name・ボタンは箱を持たない`), J({ selG, g }));
        await tapIn(page, BTN('asia'));
        const selA = await selectedIs(page, 'asia');
        const tIn = await settledOn(page, inViewEl, 'wd-rh', false), t = await rhBox(page);
        ok(selA && tIn, T(`map-tap ${w}×${h} 地域のボタン（アジア）を指で押す → すぐ選ばれ、スクロールが止まると結果の見出しの上端が画面の中`), J({ selA, t }));
        const q = quiet(st, 'map-tap');
        ok(q.length === 0, T(`map-tap quiet(st, 'map-tap') が空（${w}×${h}）`), J(q));
      } finally {
        await P.ctx.close().catch(() => {});
      }
    }
  }

  /* 場面 map-first（DM6・日英）── assert-hero-fold.mjs の8つの大きさ（バーを引いた実寸）で、開いた最初の1画面を測って印字する。
     どの大きさでも：検索欄が丸ごと画面の中で、地図より上・何か打つと地図の区域は箱を持たない。
     ★D37（リードの決め 2026-10-25 Q1 で付け替え）：地図とカードの面（.wam-g ＝ 切り替え・地図・地図の下の一言と凡例・カードを載せる1枚）が、
       丸ごと最初の1画面の中（上端も下端も）。結果の見出し（#wd-rh）が画面の外なのは受け入れ（印字だけ）。地図の高さ 45% の線は外した。
       組んだ形（WP-dmap-4）で収まらない大きさは D37_OPEN に名前で置く ── WP-dmap-7 が地図の上端と高さを変える。そこでは「まだ収まらない」を数え、
       収まったら赤くなる（D37_OPEN から外して約束として数える ＝ 黙って開いたままにならない）。
       WP-dmap-7：地図の上に海を足し（地図は 363 → 368px）、ヒーローの下（32 → 16px）と面の上下（20 → 14・10px）を詰めて、1440×780 と 375×640 が
       丸ごと入った（1440×780 は面の下端 776／780）→ 外して数える。1024×690・1080×730 はカードが地図の下（区域 1000px 未満）で、面だけで約 650px ＝ まだ開いたまま */
  const D37_OPEN = new Set(['1024x690', '1080x730']);
  async function mapFirst(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const SIZES = [...read('assert-hero-fold.mjs').matchAll(/\[(\d+),\s*(\d+),\s*'[^']*',\s*'(both|peek)'\]/g)].map((m) => ({ w: +m[1], h: +m[2], cls: m[3] }));
    const REQUIRED = ['1440x780', '820x980', '1024x690', '390x680'];
    ok(SIZES.length === 8 && [...REQUIRED, ...D37_OPEN].every((k) => SIZES.some((s) => `${s.w}x${s.h}` === k)), T(`map-first 大きさは assert-hero-fold.mjs の SIZES から8つ（${SIZES.map((s) => `${s.w}×${s.h} ${s.cls}`).join('・')}）・「必ず」の4つ（${REQUIRED.join('・')}）と D37_OPEN（${[...D37_OPEN].join('・')}）がその中に在る`), J(SIZES));
    const rows = [], land = [];   // land ＝ ★切り替えの箱に掛かる陸の点（onLand）── 8つの大きさで測り、最後に1行
    for (const s of SIZES) {
      const touch = s.w < 1440;   // iPad とスマホの6つ
      const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: s.w, h: s.h, touch, init: tokyo });
      PAGES.push(P);
      try {
        const { page, st } = P;
        await page.evaluate(() => document.fonts && document.fonts.ready);
        const m = await page.evaluate(() => {
          const B = (sel) => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height) }; };
          return { vh: window.innerHeight, hero: B('#wa-hero'), search: B('#search'), sec: B('#wa-map-sec'), surf: B('#wa-map-sec .wam-g'), map: B('#wa-map-sec .wam-map'), foot: B('#wa-map-sec .wam-foot'), card: B('#wa-sum'), strip: B('#region-strip'), rh: B('#wd-rh') };
        });
        const k = `${s.w}x${s.h}`, req = REQUIRED.includes(k);
        land.push({ k, ...(await onLand(page)) });
        const searchOk =!!m.search && !!m.map && m.search.top >= 0 && m.search.bottom <= m.vh && m.search.bottom <= m.map.top;
        await type(page, 'a');
        const gone = await until(page, () => document.getElementById('wa-map-sec').getClientRects().length === 0);
        await type(page, '');
        ok(searchOk && gone, T(`map-first ${s.w}×${s.h}：検索欄が丸ごと画面の中で、地図より上・何か打つと地図の区域は箱を持たない`), J({ search: m.search, map: m.map, gone }));
        const whole = !!m.surf && m.surf.top >= 0 && m.surf.bottom <= m.vh, open = D37_OPEN.has(k);
        rows.push({ k, cls: s.cls, req, m, whole, open });
        ok(open ? !whole : whole, T(open
          ? `map-first ${s.w}×${s.h}${req ? '（必ず）' : ''}：組んだ形では地図とカードの面（.wam-g）が最初の1画面に収まらない ── D37_OPEN（WP-dmap-7 が地図の上端と高さを変える。収まったら D37_OPEN から外して数える）`
          : `map-first ${s.w}×${s.h}${req ? '（必ず）' : ''}：地図とカードの面（.wam-g）が丸ごと最初の1画面の中（上端 ≥ 0・下端 ≤ 画面の高さ）`), J({ vh: m.vh, surf: m.surf, map: m.map, foot: m.foot, card: m.card }));
        const q = quiet(st, 'map-first');
        ok(q.length === 0, T(`map-first quiet(st, 'map-first') が空（${s.w}×${s.h}）`), J(q));
      } finally {
        await P.ctx.close().catch(() => {});
      }
    }
    console.log(`  ── map-first の測った値（${lang}・px：画面の高さ｜ヒーローの下端｜区域の上〜下｜地図の上〜下（高さ・画面の%）｜面の上〜下｜地図の下の行の下端｜カード｜地域のボタンの下端｜結果の見出しの上〜下（印字だけ）｜面）`);
    for (const r of rows) {
      const { m } = r;
      console.log(`     ${r.k.padEnd(9)} ${r.cls.padEnd(4)}${r.req ? '★' : ' '} vh ${m.vh}｜hero ${m.hero && m.hero.bottom}｜区域 ${m.sec && m.sec.top}〜${m.sec && m.sec.bottom}｜地図 ${m.map && m.map.top}〜${m.map && m.map.bottom}（${m.map && m.map.h}・${m.map ? Math.round((1000 * m.map.h) / m.vh) / 10 : '-'}%）｜面 ${m.surf && m.surf.top}〜${m.surf && m.surf.bottom}｜地図の下の行の下端 ${m.foot && m.foot.bottom}｜カード ${m.card ? `${m.card.top}〜${m.card.bottom}` : '箱なし'}｜ボタン下 ${m.strip && m.strip.bottom}｜#wd-rh ${m.rh && m.rh.top}〜${m.rh && m.rh.bottom}｜面 ${r.whole ? '✓ 丸ごと' : `✗ 下端が ${m.surf ? m.surf.bottom - m.vh : '-'}px 外`}${r.open ? '（D37_OPEN）' : ''}`);
    }
    const onl = land.filter((x) => x.err || x.n !== 0);
    ok(land.length === SIZES.length && onl.length === 0,
      T(`map-first ${SIZES.length}つの大きさ（iPad とスマホは指）：「機長｜副操縦士」の切り替えの箱に陸の点が1つも掛からない（700〜999px は地図の左下の海の上）`), J(onl.length ? onl.slice(0, 4) : land.map((x) => `${x.k}:${x.pos}`)));
    const out = rows.filter((r) => !r.whole);
    console.log(`  ── map-first：面が丸ごと最初の1画面に入る大きさ ${rows.length - out.length}／${rows.length}・入らない（D37_OPEN・WP-dmap-7）：${out.map((r) => `${r.k}${r.req ? '★' : ''}`).join('・') || 'なし'}`);
  }

  /* ════ 動かせる地図（WP-dmap-9・オーナー「地図はスマホで見ると小さいし、地図自体を自分で動かせるようにしたい（windy みたいに）」）════
     地図の層は1つの <g class="wam-z">（動くのはその transform だけ）。拡大していても、地図の上の点は zPt（その <g> の getScreenCTM）で写す。
     倍率と「ずれ」は transform を読む（台本の答えは読まない）。 */
  const ztf = (page) => page.evaluate(() => {
    const z = document.querySelector('#wa-map-sec .wam-z'), m = z && z.transform.baseVal.consolidate();
    return m ? { a: Math.round(m.matrix.a * 1e3) / 1e3, e: Math.round(m.matrix.e * 10) / 10, f: Math.round(m.matrix.f * 10) / 10 } : { a: 1, e: 0, f: 0 };
  });
  const zPt = (page, xy) => page.evaluate((x, y) => { const m = document.querySelector('#wa-map-sec .wam-z').getScreenCTM(); return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; }, xy[0], xy[1]);
  const zoomedOver = (page, k) => until(page, (k) => { const z = document.querySelector('#wa-map-sec .wam-z'), m = z.transform.baseVal.consolidate(); return !!m && m.matrix.a > k; }, k);
  /* ボタンの拡大・縮小・元に戻すは滑らかに動く（0.32 秒）── 地図の上の点を写す前に、動きが止まるのを待つ（2コマ続けて同じ位置） */
  const steady = (page) => until(page, () => new Promise((res) => {
    const z = document.querySelector('#wa-map-sec .wam-z'), m = () => { const c = z.getScreenCTM(); return [c.a, c.e, c.f].join(); }, a = m();
    requestAnimationFrame(() => requestAnimationFrame(() => res(m() === a)));
  }));
  /* 枠の四隅（1px 内側）が、地図の箱（viewBox ＝ 点を描く箱）のどこを写しているか。どれも箱の中 ＝ 枠に空いた縁が無い */
  const filled = (page) => page.evaluate(() => {
    const svg = document.querySelector('#wa-map-sec .wam-svg'), v = svg.viewBox.baseVal, f = document.getElementById('wa-map').getBoundingClientRect();
    const inv = svg.querySelector('.wam-z').getScreenCTM().inverse();
    const c = [[f.left + 1, f.top + 1], [f.right - 1, f.top + 1], [f.left + 1, f.bottom - 1], [f.right - 1, f.bottom - 1]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(inv));
    return { ok: c.every((p) => p.x >= v.x && p.x <= v.x + v.width && p.y >= v.y && p.y <= v.y + v.height), c: c.map((p) => [Math.round(p.x), Math.round(p.y)]), box: [v.x, v.y, v.width, v.height] };
  });
  const zButtons = (page) => page.evaluate(() => [...document.querySelectorAll('#wa-map-sec .wam-zb, #wa-map-sec .wam-zx')].filter((b) => b.getClientRects().length > 0).map((b) => b.dataset.z));
  const mapMid = (page) => page.evaluate(() => { const r = document.getElementById('wa-map').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const lit = (page) => page.evaluate(() => document.querySelectorAll('#wa-map-sec .is-on').length);
  /* 指（CDP の touch）：2本の指で広げる・1本の指で動かす（どちらも何コマかに分けて） */
  const tp = (x, y, id) => ({ x, y, id, radiusX: 1, radiusY: 1, force: 1 });
  const pinchOut = async (page, c, steps = 10, by = 8) => {
    const s = await page.createCDPSession();
    await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(c[0] - 20, c[1], 0), tp(c[0] + 20, c[1], 1)] });
    for (let i = 1; i <= steps; i++) await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(c[0] - 20 - i * by, c[1], 0), tp(c[0] + 20 + i * by, c[1], 1)] });
    await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await s.detach();
  };
  const swipe = async (page, c, dx, dy, steps = 10) => {
    const s = await page.createCDPSession();
    await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(c[0], c[1], 0)] });
    for (let i = 1; i <= steps; i++) await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(c[0] + (dx * i) / steps, c[1] + (dy * i) / steps, 0)] });
    await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await s.detach();
  };
  const fsState = (page) => page.evaluate(() => {
    const sec = document.getElementById('wa-map-sec'), r = sec.getBoundingClientRect();
    return { fs: sec.classList.contains('is-fs'), lock: document.documentElement.classList.contains('wam-lock'), hl: history.length, wamfs: !!(history.state && history.state.wamfs),
      box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], vw: innerWidth, vh: innerHeight, act: (document.activeElement || {}).id || (document.activeElement && document.activeElement.getAttribute('data-z')) || '',
      y: Math.round(scrollY), role: sec.getAttribute('role') };
  });
  const fsGone = (page) => until(page, () => !document.getElementById('wa-map-sec').classList.contains('is-fs') && !(history.state && history.state.wamfs));

  /* 場面 map-move（class B・日英）── 1440×900 のマウスと 390×680 の指で、地図を拡大して動かす */
  async function mapMove(lang) {
    const T = (s) => `[${lang}] ${s}`;
    {
      const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], init: tokyo });
      PAGES.push(P);
      try {
        const { page, st } = P;
        await page.mouse.move(...AWAY);
        const ui0 = await page.evaluate(() => ({ tab: document.getElementById('wa-map').getAttribute('tabindex'), zc: document.querySelector('#wa-map-sec .wam-zc').hidden }));
        const b0 = await zButtons(page), t0 = await ztf(page);
        ok(same(b0, ['in', 'out', 'fs']) && !ui0.zc && ui0.tab === '-1' && t0.a === 1 && t0.e === 0 && t0.f === 0,
          T('map-move 1440 開いたとき：地図の左上に 拡大・縮小・全画面（元に戻すは1倍のあいだ・閉じるは全画面のあいだだけ）・倍率 1・地図は押すとフォーカスを持つ（tabindex -1 ＝ Tab では止まらない）'), J({ b0, ui0, t0 }));
        /* ホイール：地図を押していない → ページがスクロールし、地図はそのまま */
        const mid = await mapMid(page), y0 = await page.evaluate(() => window.scrollY);
        await page.mouse.move(...mid);
        await page.mouse.wheel({ deltaY: 240 });
        const sc = await until(page, (y) => window.scrollY > y, y0);
        await still(page);
        const t1 = await ztf(page);
        ok(sc && t1.a === 1, T('map-move 地図を押していないとき、地図の上でホイール → ページがスクロールする・地図は 1 倍のまま（ページのスクロールを奪わない）'), J({ y0, y: await page.evaluate(() => window.scrollY), t1 }));
        await toTop(page);
        /* 海を押す（何も選ばない）→ フォーカスは地図 → 欧州の点の上でホイール → 拡大・ページは動かない・欧州の点は指の下のまま */
        await page.mouse.click(...(await boxPt(page, SEA)));
        const foc = await page.evaluate(() => (document.activeElement || {}).id), y1 = await page.evaluate(() => window.scrollY);
        const eu0 = await zPt(page, POINT_AT.europe);
        await page.mouse.move(...eu0);
        await page.mouse.wheel({ deltaY: -360 });
        const zw = await zoomedOver(page, 1.2), y2 = await page.evaluate(() => window.scrollY), eu1 = await zPt(page, POINT_AT.europe), r1 = await regionNow(page);
        ok(foc === 'wa-map' && zw && y2 === y1 && Math.hypot(eu1[0] - eu0[0], eu1[1] - eu0[1]) < 1 && r1 === 'all',
          T('map-move 海を押す（何も選ばない）→ フォーカスは地図・欧州の点の上でホイール → 拡大（倍率 > 1.2）・ページは動かない・欧州の点は指したまま（1px 以内）'), J({ foc, t: await ztf(page), y1, y2, eu0, eu1, r1 }));
        /* 指している地域は拡大していても光る（マウス） */
        const hot = await litWhere(page, 'europe', ['wam-lit', '>', 0]);
        /* つかんで動かす（欧州の点から）→ 地図がずれる・何も選ばない */
        const tA = await ztf(page);
        await page.mouse.move(...eu1);
        await page.mouse.down();
        for (let i = 1; i <= 8; i++) await page.mouse.move(eu1[0] + i * 12, eu1[1] + i * 6);
        await page.mouse.up();
        await settle(page);
        const tB = await ztf(page), r2 = await regionNow(page), on2 = await lit(page), eu2 = await zPt(page, POINT_AT.europe);
        ok(hot && tB.a === tA.a && tB.e > tA.e && tB.f > tA.f && Math.abs(eu2[0] - eu1[0] - 96) < 1.5 && Math.abs(eu2[1] - eu1[1] - 48) < 1.5 && r2 === 'all' && on2 === 0,
          T('map-move 拡大したまま欧州を指すと光る → 欧州の点をつかんで右下へ 96×48px 動かす → 地図が同じだけずれる・倍率はそのまま・何も選ばない（つかんで離した点が欧州でも）'), J({ hot, tA, tB, eu1, eu2, r2, on2 }));
        /* 動かさずに押す → 欧州を選ぶ（拡大したまま）→ 外す */
        await page.mouse.click(...eu2);
        const selE = await selectedIs(page, 'europe'), tC = await ztf(page);
        await page.evaluate(() => window.PVDirectory.setRegion('all'));
        await toTop(page);
        ok(selE && tC.a === tB.a, T('map-move 拡大して動かしたあと、欧州の点を動かさずに押す → 欧州が選ばれる（倍率はそのまま）'), J({ selE, tC }));
        /* ボタン：元に戻す → 1倍（transform が無い）・元に戻すは隠れ、フォーカスは地図へ／拡大 → 2倍・縮小 → 1倍 */
        const shownZ = await zButtons(page);
        await page.click('#wa-map-sec .wam-zb[data-z="reset"]');
        const t3 = await ztf(page), b3 = await zButtons(page), a3 = await page.evaluate(() => (document.activeElement || {}).id);
        await page.click('#wa-map-sec .wam-zb[data-z="in"]');
        const t4 = await ztf(page), b4 = await zButtons(page);
        await page.click('#wa-map-sec .wam-zb[data-z="out"]');
        const t5 = await ztf(page), tf5 = await page.evaluate(() => document.querySelector('#wa-map-sec .wam-z').getAttribute('transform'));
        ok(same(shownZ, ['in', 'out', 'reset', 'fs']) && t3.a === 1 && t3.e === 0 && same(b3, ['in', 'out', 'fs']) && a3 === 'wa-map' && t4.a === 2 && same(b4, ['in', 'out', 'reset', 'fs']) && t5.a === 1 && tf5 === null,
          T('map-move ボタン：拡大しているあいだだけ「元に戻す」→ 押すと 1倍・隠れてフォーカスは地図へ／拡大 → 2倍・縮小 → 1倍（transform を書かない）'), J({ shownZ, t3, b3, a3, t4, b4, t5, tf5 }));
        /* キー（地図にフォーカス）：+ → 2倍・→ → 左へずれる（右を見る）・0 → 1倍 */
        await page.focus('#wa-map');
        await page.keyboard.press('+');
        const k1 = await ztf(page);
        await page.keyboard.press('ArrowRight');
        const k2 = await ztf(page);
        await page.keyboard.press('0');
        const k3 = await ztf(page), yk = await page.evaluate(() => window.scrollY);
        ok(k1.a === 2 && k2.a === 2 && k2.e < k1.e && k3.a === 1 && k3.e === 0 && yk === 0, T('map-move キー（地図にフォーカス）：+ → 2倍・→ → 地図が左へずれる・0 → 1倍・ページは動かない'), J({ k1, k2, k3, yk }));
        /* ctrl ＋ ホイール（トラックパッドのピンチ）は、地図にフォーカスが無くても地図を拡大する（ページの拡大にしない）*/
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        await page.mouse.move(...(await mapMid(page)));
        await page.keyboard.down('Control');
        await page.mouse.wheel({ deltaY: -60 });
        await page.keyboard.up('Control');
        const zc = await zoomedOver(page, 1.2), ac = await page.evaluate(() => (document.activeElement || {}).id || ''), yc = await page.evaluate(() => window.scrollY);
        ok(zc && ac !== 'wa-map' && yc === 0, T('map-move ctrl ＋ ホイール（トラックパッドのピンチ）→ 地図にフォーカスが無くても地図が拡大する・ページは動かない'), J({ zc, ac, yc, t: await ztf(page) }));
        await page.focus('#wa-map');
        await page.keyboard.press('0');
        /* 6倍で止まる・いちばん遠くまでつかんで動かしても、枠の四隅はどれも地図の箱の中（縁が空かない）── 右下へ・左上へ */
        for (let i = 0; i < 4; i++) await page.keyboard.press('+');
        await steady(page);
        const k6 = await ztf(page), m6 = await mapMid(page);
        const far = [];
        for (const [dx, dy] of [[2400, 1600], [-4800, -3200]]) {
          await page.mouse.move(...m6); await page.mouse.down();
          for (let i = 1; i <= 12; i++) await page.mouse.move(m6[0] + (dx * i) / 12, m6[1] + (dy * i) / 12);
          await page.mouse.up();
          far.push({ dx, dy, t: await ztf(page), ...(await filled(page)) });
        }
        ok(k6.a === 6 && far.every((f) => f.ok && f.t.a === 6), T('map-move + を4回 → 6倍で止まる・いちばん遠くまで右下へ・左上へつかんで動かしても、枠の四隅はどれも地図の箱の中（縁が空かない）'), J({ k6, far }));
        /* 「機長｜副操縦士」は拡大していても同じ：副操縦士 → data-pos fo・倍率とずれはそのまま → 機長 */
        const tP = await ztf(page);
        await page.click('#wa-map-sec .wam-pb[data-pos="fo"]');
        const pf = await page.evaluate(() => document.getElementById('wa-map-sec').getAttribute('data-pos')), tQ = await ztf(page);
        await page.click('#wa-map-sec .wam-pb[data-pos="cap"]');
        ok(pf === 'fo' && same(tP, tQ), T('map-move 6倍のまま「副操縦士」を押す → 区域は副操縦士・地図の倍率とずれはそのまま'), J({ pf, tP, tQ }));
        await shot(page, 'map-move', lang, '1440-6x');
        const q = quiet(st, 'map-move');
        ok(q.length === 0, T('map-move quiet(st, \'map-move\') が空（1440）'), J(q));
      } finally {
        await P.ctx.close().catch(() => {});
      }
    }
    {
      const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: 390, h: 680, touch: true, init: tokyo });
      PAGES.push(P);
      try {
        const { page, st } = P;
        const b0 = await zButtons(page);
        ok(same(b0, ['fs']), T('map-move 390 指：ページの中の地図のボタンは「全画面」だけ（拡大・縮小は2本の指・元に戻すは拡大しているあいだ）'), J(b0));
        /* 2本の指で広げる（欧州のまわり）→ 拡大・ページは動かない・ページそのものは拡大しない・何も選ばない */
        const y0 = await page.evaluate(() => window.scrollY), eu0 = await zPt(page, POINT_AT.europe);
        await pinchOut(page, eu0);
        const zp = await zoomedOver(page, 1.2);
        const m = await page.evaluate(() => ({ y: window.scrollY, vv: window.visualViewport ? window.visualViewport.scale : 1, region: window.PVDirectory.state().region, open: document.getElementById('wa-map-sec').classList.contains('is-open') }));
        ok(zp && m.y === y0 && m.vv === 1 && m.region === 'all' && !m.open, T('map-move 390 2本の指で広げる → 地図が拡大する（倍率 > 1.2）・ページはスクロールせず、ページそのものも拡大しない・何も選ばず、カードも開かない'), J({ t: await ztf(page), y0, ...m }));
        await shot(page, 'map-move', lang, '390-pinch');
        /* 1本の指で上へ → ページがスクロールする・地図はそのまま・「2本の指で動かせます」が1回だけ出る */
        const tA = await ztf(page);
        await swipe(page, await mapMid(page), 0, -120);
        const sc = await until(page, (y) => window.scrollY > y, y0);
        await still(page);
        const tB = await ztf(page), hint = await page.evaluate(() => { const h = document.querySelector('#wa-map-sec .wam-zh'); return { on: h.classList.contains('is-on') || !h.hidden, text: h.textContent }; });
        ok(sc && same(tA, tB) && hint.on && hint.text === ZOOM_HINT[lang], T(`map-move 390 1本の指で地図の上を上へ → ページがスクロールする・地図は動かない・「${ZOOM_HINT[lang]}」が出る`), J({ sc, tA, tB, hint }));
        await toTop(page);
        /* 動かさずに触れる（拡大したまま）→ その地域を見せる（いつもの指の決まり：選ぶのはボタン）→ 元に戻す → 1倍 */
        const eu = await zPt(page, POINT_AT.europe);
        await page.touchscreen.tap(...eu);
        const sh = await isShown(page, 'europe');
        await still(page);   // 開いたカードを画面に入れる滑らかなスクロールが止まってから（動いている最中のボタンを押さない）
        const g = await page.evaluate(() => ({ go: document.getElementById('wa-go').getClientRects().length > 0, region: window.PVDirectory.state().region }));
        const b1 = await zButtons(page);
        await page.tap('#wa-map-sec .wam-zb[data-z="reset"]');
        const t2 = await ztf(page);
        ok(sh && g.go && g.region === 'all' && same(b1, ['reset', 'fs']) && t2.a === 1, T('map-move 390 拡大したまま欧州に触れる → 欧州を見せる・ボタンが出る・まだ選ばない／ボタンは「元に戻す」と「全画面」→ 元に戻す → 1倍'), J({ sh, g, b1, t2 }));
        const q = quiet(st, 'map-move');
        ok(q.length === 0, T('map-move quiet(st, \'map-move\') が空（390）'), J(q));
      } finally {
        await P.ctx.close().catch(() => {});
      }
    }
  }

  /* 場面 map-full（class B・日英）── 全画面：開く（履歴を1段）・動かす・地域を見せる（カードは画面の中）・Esc／戻るで閉じる・積み増さない・
     「この地域の航空会社を見る」で閉じてから選ぶ（選んだ地域は住所に残る）。390×680 の指と 1440×900 のマウス */
  async function mapFull(lang) {
    const T = (s) => `[${lang}] ${s}`;
    for (const [w, h, touch] of [[390, 680, true], [1440, 900, false]]) {
      const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w, h, touch, init: tokyo });
      PAGES.push(P);
      try {
        const { page, st } = P;
        const hit = (sel) => (touch ? page.tap(sel) : page.click(sel));
        const at = (xy) => (touch ? page.touchscreen.tap(...xy) : page.mouse.click(...xy));
        if (!touch) await page.mouse.move(...AWAY);
        const s0 = await fsState(page);
        await hit('#wa-map-sec .wam-zb[data-z="fs"]');
        const opened = await until(page, () => document.getElementById('wa-map-sec').classList.contains('is-fs'));
        const s1 = await fsState(page), b1 = await zButtons(page);
        ok(opened && s1.lock && s1.hl === s0.hl + 1 && s1.wamfs && same(s1.box, [0, 0, s1.vw, s1.vh]) && s1.act === 'wa-map' && s1.role === 'dialog' && same(b1, ['in', 'out', 'close']),
          T(`map-full ${w}×${h} 「全画面」→ 地図の区域が画面いっぱい・後ろのページは止まる・履歴が1段・フォーカスは地図・ボタンは 拡大・縮小・閉じる`), J({ s0, s1, b1 }));
        /* 全画面で動かす：拡大 → ${touch ? '1本の指' : 'マウス'}でずらす → ずれる・ページは動かない */
        await hit('#wa-map-sec .wam-zb[data-z="in"]');
        const tA = await ztf(page), mid = await mapMid(page);
        if (touch) await swipe(page, mid, 60, 30);
        else { await page.mouse.move(...mid); await page.mouse.down(); for (let i = 1; i <= 6; i++) await page.mouse.move(mid[0] + i * 10, mid[1] + i * 5); await page.mouse.up(); }
        const tB = await ztf(page), yB = await page.evaluate(() => window.scrollY);
        ok(tA.a === 2 && tB.a === 2 && tB.e > tA.e && tB.f > tA.f && yB === s0.y, T(`map-full ${w}×${h} 全画面で拡大 → ${touch ? '1本の指' : 'マウス'}で右下へ → 地図がずれる・後ろのページは動かない`), J({ tA, tB, yB }));
        await shot(page, 'map-full', lang, `${w}-moved`);
        /* 元に戻して欧州を押す → 欧州のカード（画面の中）・ボタンが出る・まだ選ばない */
        await hit('#wa-map-sec .wam-zb[data-z="reset"]');
        await steady(page);
        await at(await zPt(page, POINT_AT.europe));
        const sh = await isShown(page, 'europe');
        const c = await page.evaluate(() => {
          const r = document.getElementById('wa-sum').getBoundingClientRect(), m = document.getElementById('wa-map').getBoundingClientRect(), g = document.getElementById('wa-go');
          return { card: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], map: [Math.round(m.left), Math.round(m.top), Math.round(m.right), Math.round(m.bottom)], vh: innerHeight, vw: innerWidth,
            go: g.getClientRects().length > 0 && g.getBoundingClientRect().bottom <= innerHeight, region: window.PVDirectory.state().region };
        });
        const place = touch ? c.card[1] >= c.map[3] - 1 : c.card[0] >= c.map[2] - 1;
        ok(sh && c.go && c.region === 'all' && c.card[1] >= 0 && c.card[3] <= c.vh + 1 && c.card[0] >= 0 && c.card[2] <= c.vw && place,
          T(`map-full ${w}×${h} 全画面で欧州を${touch ? '指で触れる' : '押す'} → 欧州のカードが画面の中（${touch ? '地図の下の板' : '地図の右'}）・「${GO[lang]}」が見える・まだ選ばない`), J({ sh, c }));
        await shot(page, 'map-full', lang, `${w}-europe`);
        /* Esc → 閉じる（履歴は戻る・前へ進む段は1つ残る）・スクロールは開く前のまま・フォーカスは「全画面」 */
        await page.keyboard.press('Escape');
        const gone1 = await fsGone(page), s2 = await fsState(page);
        ok(gone1 && !s2.lock && s2.hl === s0.hl + 1 && s2.y === s0.y && s2.act === 'fs' && s2.role === null, T(`map-full ${w}×${h} Esc → 全画面が閉じる・履歴の段から降りる・スクロールは開く前のまま・フォーカスは「全画面」`), J(s2));
        /* もう1回開く → 積み増さない（履歴の長さは同じ）→ 戻る（ブラウザの戻る）→ 閉じる */
        await hit('#wa-map-sec .wam-zb[data-z="fs"]');
        const re = await until(page, () => document.getElementById('wa-map-sec').classList.contains('is-fs'));
        const s3 = await fsState(page);
        await page.evaluate(() => history.back());
        const gone2 = await fsGone(page), s4 = await fsState(page);
        ok(re && s3.hl === s0.hl + 1 && s3.wamfs && gone2 && !s4.lock && s4.y === s0.y, T(`map-full ${w}×${h} もう1回「全画面」→ 履歴を積み増さない（長さは同じ）→ ブラウザの「戻る」→ 閉じる`), J({ s3, s4 }));
        /* 開いて北米を押し、「この地域の航空会社を見る」→ 全画面が閉じてから北米が選ばれる・住所に region=us・全画面の段は残らない */
        await hit('#wa-map-sec .wam-zb[data-z="fs"]');
        await until(page, () => document.getElementById('wa-map-sec').classList.contains('is-fs'));
        await at(await zPt(page, POINT_AT.us));
        const shU = await isShown(page, 'us');
        await hit('#wa-go');
        const selU = await selectedIs(page, 'us'), gone3 = await fsGone(page), s5 = await fsState(page), href = page.url();
        ok(shU && selU && gone3 && !s5.lock && /[?&]region=us(&|$)/.test(href) && s5.hl === s0.hl + 1, T(`map-full ${w}×${h} 全画面で北米 →「${GO[lang]}」→ 全画面が閉じ、北米が選ばれる・住所は region=us・全画面の段は残らない`), J({ shU, selU, s5, href: href.replace(L.base, () => '') }));
        const q = quiet(st, 'map-full');
        ok(q.length === 0, T(`map-full quiet(st, 'map-full') が空（${w}×${h}）`), J(q));
      } finally {
        await P.ctx.close().catch(() => {});
      }
    }
  }

  /* ★場面 map-strip（class A・日英）── オーナー #8「切れないようにして」：390・768（指）で、地域の9つのボタンがどれも画面の中に丸ごと
     （横にすべる列ではない ＝ 帯の overflow-x が visible で、中身が帯の幅に入る）・ボタンの字が切れない */
  async function mapStrip(lang) {
    const T = (s) => `[${lang}] ${s}`;
    for (const [w, h] of [[390, 680], [768, 1024]]) {
      const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w, h, touch: true, init: tokyo });
      PAGES.push(P);
      try {
        const { page, st } = P;
        const m = await page.evaluate(() => {
          const s = document.getElementById('region-strip'), vw = document.documentElement.clientWidth;
          const bs = [...s.querySelectorAll('.rstrip-btn')].map((b) => { const r = b.getBoundingClientRect(); return { c: b.dataset.region, l: Math.round(r.left * 10) / 10, r: Math.round(r.right * 10) / 10, t: Math.round(r.top), cut: b.scrollWidth > b.clientWidth + 1 }; });
          return { ox: getComputedStyle(s).overflowX, sw: s.scrollWidth, cw: s.clientWidth, vw, n: bs.length, rows: new Set(bs.map((b) => b.t)).size, bad: bs.filter((b) => b.l < 0 || b.r > vw || b.cut) };
        });
        ok(m.n === 9 && m.ox === 'visible' && m.sw <= m.cw + 1 && m.bad.length === 0,
          T(`map-strip ${w}×${h} 指：地域の9つのボタンがどれも画面の中に丸ごと（帯は横にすべらない ＝ overflow-x visible・中身 ${m.sw}px ≤ 帯 ${m.cw}px）・字が切れない（${m.rows} 行）`), J(m));
        await shot(page, 'map-strip', lang, `${w}`);
        const q = quiet(st, 'map-strip');
        ok(q.length === 0, T(`map-strip quiet(st, 'map-strip') が空（${w}×${h}）`), J(q));
      } finally {
        await P.ctx.close().catch(() => {});
      }
    }
  }

  /* ★場面 head-name（class A・日英）── オーナー #18「緑にしたら」：ログインしている会員の名前（ヘッダーの #nav-auth-btn が profile.html を指す）は
     サイトの緑の字（--pv-accent-ink）で、ヘッダーの地とのコントラストが 4.5:1 以上（ライトとダーク）。地は、名前から上の要素の背景を
     いちばん外（白い紙）から順に重ねて作る。手元の会員 a としてログインしておく */
  const contrast = (page) => page.evaluate(() => {
    const b = document.getElementById('nav-auth-btn');
    const rgba = (s) => { const n = (String(s).match(/[\d.]+/g) || []).map(Number); return [n[0] || 0, n[1] || 0, n[2] || 0, n.length > 3 ? n[3] : 1]; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const chain = [];
    for (let e = b; e; e = e.parentElement) chain.unshift(rgba(getComputedStyle(e).backgroundColor));
    let bg = [255, 255, 255];
    for (const c of chain) bg = bg.map((v, i) => c[i] * c[3] + v * (1 - c[3]));
    const fg = rgba(getComputedStyle(b).color), hi = Math.max(lum(fg), lum(bg)), lo = Math.min(lum(fg), lum(bg));
    const probe = document.createElement('span');
    probe.setAttribute('style', 'color:var(--pv-accent-ink)');
    document.getElementById('main-nav').appendChild(probe);
    const want = getComputedStyle(probe).color;
    probe.remove();
    return { href: b.getAttribute('href'), name: b.textContent, shown: b.getClientRects().length > 0, fg: getComputedStyle(b).color, want, bg: bg.map(Math.round), ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100, theme: document.documentElement.getAttribute('data-theme') };
  });
  async function headName(lang) {
    const T = (s) => `[${lang}] ${s}`;
    for (const theme of ['light', 'dark']) {
      const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], who: 'a', theme, init: tokyo });
      PAGES.push(P);
      try {
        const { page, st } = P;
        const named = await until(page, () => { const b = document.getElementById('nav-auth-btn'); return !!b && /profile\.html$/.test(b.getAttribute('href') || ''); });
        const m = await contrast(page);
        ok(named && m.shown && m.theme === theme && m.fg === m.want && m.ratio >= 4.5,
          T(`head-name ${theme}：ログインしている会員の名前「${m.name}」はサイトの緑の字（--pv-accent-ink ${m.want}）・ヘッダーの地とのコントラスト ${m.ratio}:1（4.5 以上）`), J(m));
        await shot(page, 'head-name', lang, theme);
        /* ログインしている会員には、どのページでも pv-session.js が「パイロットであることの確認」を同じログインのまま6時間に1回だけ聞く
           （pv_proof_state ── CLAUDE.md「パイロットであることの確認」）。一覧の台本の呼び出しではないので、この場面だけ名指しで許す */
        const q = quiet(st, 'head-name', { allow: ['pv_proof_state'] });
        ok(q.length === 0, T(`head-name quiet(st, 'head-name') が空（${theme}・ログインしていても、一覧のページが呼ぶのは pv-session.js の確認の1本だけ）`), J({ q, calls: st.calls }));
      } finally {
        await P.ctx.close().catch(() => {});
      }
    }
  }

  try {
    for (const s of want) for (const lang of LANGS) {
      console.log(`\n════ ${s}（${lang}） ════`);
      try { await SCENES[s](lang); }
      catch (e) { ok(false, `[${lang}] 場面が途中で止まった（${s}）`, String(e && e.stack || e).split(ROOT).join('').slice(0, 600)); }
    }
  } finally {
    await browser.close().catch(() => {});
    if (FRONT) await FRONT.close().catch(() => {});
    await L.stop().catch(() => {});
  }

  /* 閉じの行（どの実行でも出す） */
  const supa = PAGES.flatMap((p) => [...p.st.supa]), blocked = PAGES.flatMap((p) => [...p.st.blocked]);
  const dirCalls = PAGES.flatMap((p) => p.st.calls.filter((_, i) => { let seg = null; for (const g of p.st.segs || []) if (g.at <= i) seg = g; return seg && seg.dir; }));
  const errs = PAGES.flatMap((p) => p.st.errs), http4 = PAGES.flatMap((p) => p.st.http4 || []);
  console.log('');
  console.log(`  st.supa ${supa.length} · st.blocked ${blocked.length} · 一覧のページの st.calls ${dirCalls.length}（${PAGES.length}枚）${dirCalls.length ? '：' + dirCalls.join(', ') : ''}`);
  ok(errs.length === 0, '★どのページにも、スクリプトの止まり（pageerror）が無い', J(errs));
  ok(http4.length === 0, '★手元の配信元が 4xx / 5xx で答えた要求が無い', J(http4));
  console.log(`\n══ assert-directory-ui：${pass} pass / ${fail} fail ══`);
  process.exitCode = fail ? 1 : 0;
}
