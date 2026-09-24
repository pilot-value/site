# CLAUDE.md — PILOT VALUE 作業ルール

## Always Do First
- **事業判断・新機能の是非は [VISION.md](VISION.md) に従う。** 作る前に Decision Framework の4問（一次データを増やすか／毎月戻る理由になるか／信頼を高めるか／企業価値を高めるか）を通し、YESが一つも無ければ作らない。
- **手順書が [workflows/](workflows/) にある作業は、必ずそれを読んでから始める。** 手順書が古かったり罠が見つかったら、作業後に更新する（新規作成・上書きはオーナー承認を得てから）。

**この文書は索引。詳細は [workflows/](workflows/) にあり、必要なときだけ読む。**
触る前に必ず開くもの ↓

| これを触るなら | 先に読む |
|---|---|
| 年収の数値 | [workflows/update-salary.md](workflows/update-salary.md) |
| 航空会社を1社足す | [workflows/add-airline.md](workflows/add-airline.md) |
| 年収の無い運航会社（チャーター・ビジネスジェット）を投稿先に足す | [workflows/add-airline.md](workflows/add-airline.md) の「道B」 |
| 給与フォーム（`pay-report.html`）| [workflows/pay-form.md](workflows/pay-form.md) |
| 落ちた検査を直す・その画面を触る | [workflows/deploy-checklist.md](workflows/deploy-checklist.md) |
| 削除依頼・開示請求が来た | [workflows/handle-disclosure-request.md](workflows/handle-disclosure-request.md) |
| Apple ログイン | [workflows/add-apple-login.md](workflows/add-apple-login.md) |

⚠️ **「たぶんこうだろう」で触らない。** 上の4本には、**画面は普通に動いたまま静かに壊れる**形が
1つずつ書き留めてある（列を足して `jsonb_build_object` に写し忘れる／生成スクリプトを再実行して
年収が巻き戻る／`String.replace` の `$'` で SQL が壊れる、など）。全部実際に起きたもの。

## このリポジトリの実態
静的サイト + Supabase。ビルドツールもフレームワークも無い。HTML を直接書き、`.mjs` スクリプトで一括編集する。

```
index.html, world-airlines.html, ...   ルート直下に HTML 28枚
airlines/{slug}.html                   日本語の航空会社ページ 約110社
en/, en/airlines/                      英語版
salary-data.mjs                        年収の唯一の正（SSOT）
*.mjs                                  生成・一括編集・検証スクリプト 約49本
db/*.sql, supabase/                    Supabase スキーマと Edge Function
baland_ass/                            ブランド資産（※ brand_assets の綴り違い。これが正しいフォルダ名）
```

## 単一データソースの鉄則（年収）
- 年収の唯一の正は [salary-data.mjs](salary-data.mjs) の `SALARY`（112社・単位は**万円**）。数値を変えるときは必ずここを起点にする。
- `salary-data.json` は**生成物。手編集禁止。** [gen-salary-json.mjs](gen-salary-json.mjs) が書き出す。
- 数値を触ったら必ず `node check-salary.mjs` で全ページ整合を検証する。
- **年収を更新する手順は [workflows/update-salary.md](workflows/update-salary.md) にある。必ず読むこと。**
- **年収を載せない「投稿先だけの会社」は [airline-ops.mjs](airline-ops.mjs) の `OPS`。**
  小規模・チャーター・ビジネスジェットなど、年収の出典が無い会社の置き場。
  [gen-airline-codes.mjs](gen-airline-codes.mjs) が `SALARY` と合流させて8つの成果物へ配る
  （フォームの選択肢・`pv-airlines.json`・`db/airlines.generated.sql` ほか）。
  **`SALARY` に年収なしの社を混ぜない**（`check-salary.mjs` と「112社」の表記が全部ずれる）。
  手順は [workflows/add-airline.md](workflows/add-airline.md) の**道B**。
- **航空会社を1社追加する手順は [workflows/add-airline.md](workflows/add-airline.md) にある。** SSOT だけ足してページを置かないと国別ページから 404 リンクが生える。ページは [gen-new-airline.mjs](gen-new-airline.mjs) で起こす（`gen_*` を再実行しない）。
- 数字を盛らない。確認できない数値を推測で埋めない。検証できないものを「Verified」と表示しない（[VERIFIED-PILOT.md](VERIFIED-PILOT.md)）。
- **数値の出所は [salary-sources.mjs](salary-sources.mjs)、方針は [DATA-PROVENANCE.md](DATA-PROVENANCE.md)。** 数値を変えたら出所を同じコミットで入れる。SALARY 本体に `src` を足さない（[gen-salary-json.mjs](gen-salary-json.mjs) が `{ ...d }` で展開するので出所URLが `salary-data.json` に載って公開される）。出所資料の原本は `sources-raw/`（gitignore 済み）に置き、リポジトリに commit しない。

## 単一データソースの鉄則（為替）
- 換算レートの唯一の正は [fx-rates.mjs](fx-rates.mjs) の `JPY_PER`（**45通貨・1単位あたりの円**）と `AS_OF`。手編集しない。
- 取り直しは [gen-fx-rates.mjs](gen-fx-rates.mjs)。`fx-rates.mjs` を書き出し、[currency.js](currency.js) の `RATES` と `AS_OF` も同時に直す。
  **⚠️ ネットを叩くのでデプロイ前チェックの一覧には入れない。** `--check` で差分だけ見られる。
- レートは2か所で使う。**この2つは必ず同じ値でなければならない。**
  - 画面の通貨切替 = `currency.js` の `RATES`（7通貨だけ。切替メニューに出る分）
  - 集計 = Supabase の `fx_rates` テーブル（45通貨。`db/vocab.generated.sql` に入る）
  ズレは [gen-vocab.mjs](gen-vocab.mjs) が検出して落とす（語彙にある通貨のレートが無いときも落ちる）。
- **レートを取り直したら `node gen-vocab.mjs` を流し、`db/vocab.generated.sql` をオーナーが Supabase に貼る。**
  貼るまで DB のレートは古いまま＝新しい通貨の投稿が集計から外れ続ける。
- **`annual_total_usd` は投稿した瞬間に確定する。** レートが無い通貨は `null` のまま集計から落ちる
  （2026-08-22 まで7通貨しか無く、台湾ドルのエバー航空1件が実際に落ちていた）。
  `db/vocab.generated.sql` の末尾に**落ちた行を拾い直すブロック**が入っている。既に値がある行は触らないので、
  過去の集計は投稿時のレートのまま再現できる。
- レートは腐る。**半年に一度は `node gen-fx-rates.mjs` で取り直す。**

## 新しいスクリプトを書く前に
- **まず既存の約49本を探す。** `ls *.mjs` して、近いものが無いか確認してから作る。
- 実際に `patch-payslip.mjs` 〜 `patch-payslip5.mjs` と5本に増殖した前例がある。連番を足す前に、既存を直せないか考える。
- 一括編集スクリプトは**冪等・再実行可能**に書く。手本は [patch-site-salaries.mjs](patch-site-salaries.mjs)（再ソートと pct 再計算まで含めて何度実行しても同じ結果になる）。
- **⚠️ `String.replace(old, new)` の「新しい側」を文字列で渡さない。** 中の `$` が特殊記号として解釈される。
  `$$` は `$` に潰れ、`$&` はマッチそのもの、`` $` `` はマッチより前全体、
  **`$'` はマッチより後ろ全体**に化ける。
  2026-08-23、`db/notify-admin-webhooks.sql` を一括編集して `do $$` が `do $` になり、
  さらに `$'` がファイル末尾の確認クエリを途中に丸ごと流し込んだ（115行 → 212行）。
  **手元の検査は全部通ったまま**で、本番の SQL Editor に貼って初めて構文エラーで気づいた。
  必ず**関数形** `s.replace(old, () => neu)` で書く（関数形は `$` を素通しする）。
  SQL・正規表現・シェルなど `$` を含むファイルを触るときは特に。

## ⚠️ 再実行してはいけないスクリプト
`gen_asia.mjs` / `gen_europe.mjs` / `gen_americas.mjs` / `gen_mideast_africa.mjs` / `generate_airlines.mjs` / `generate_world_airlines.mjs` / `gen_en_airlines.mjs` / `seo-title-update.mjs` / `seo-phase2.mjs` / `seo-batch-update.mjs` / `seo-content-expand.mjs`

これらは**初回の一括生成用**で、ページを丸ごと上書きする。特に日本語版の生成スクリプトは
**`salary-data.mjs` を参照しておらず、年収を自前でハードコードしている**（例: `gen_europe.mjs` の `stats:[{val:'¥1,956万〜3,260万', ...}]`）。
生成後に SSOT 側で更新した数値が、実行した瞬間に古い値へ巻き戻る。

`seo-phase2.mjs` も同じ。[seo-phase2.mjs:199](seo-phase2.mjs#L199) が `airlines/gaishi-vs-nikkei.html` を丸ごと生成し、
エミレーツ4,500万・デルタ9,000万という SSOT に無い古い数値を持っている（現在の SSOT は 3,700万 / 6,160万）。

`seo-content-expand.mjs` は5社（emirates / singapore-airlines / qatar-airways / lufthansa / cathay-pacific）に
節を挿し込む一発物で、`salary-data.mjs` を読まず年収を本文にハードコードしている
（[seo-content-expand.mjs:32](seo-content-expand.mjs#L32) が `¥4,500万`。現在の SSOT は 3,700万）。
`insertBefore` は既に入っているかを見ないので、**流すたびに同じ節が二重・三重に増える**。
末尾で `sitemap.xml` の `lastmod` を `2026-04-15` 固定で上書きするので、`gen-sitemap.mjs` の出力とも食い違う。

**1社を直したいときは、そのページを直接編集する。生成スクリプトを再実行しない。**

## 通貨表記のルール
サイト全体が通貨切替対応（[currency.js](currency.js) の `window.PVCurrency`）。金額を書くときは必ずどちらか：

- 標準の円表記（`¥1,800万` / `1,800万円` / `¥…`）— `currency.js` が実行時に変換する
- [salary-leveling.js](salary-leveling.js) の `fmtMan` / `PVCurrency.fmt` 経由

独自フォーマットで書くと変換から漏れ、`node assert-currency.mjs` が落ちる。

### 既定の通貨は「言語」と「見ている地域」で決まる（2026-09-24）
- **選んだ通貨は言語ごとに別々に覚える。** 日本語ページ＝`pv-currency`（昔からのキー）／
  英語ページ＝`pv-currency-en`。**1つのキーに戻さない** ── 戻すと、日本語で一度 ¥ を選んだ人が
  英語ページでも ¥ のままになる（オーナー指摘「英語にしても jpy のままだから自動で USD に」）。
- **英語ページの既定は見ている地域**（`currency.js` の `TZ_CUR`）。ブラウザのタイムゾーンを
  読むだけで**通信は1本もしない**（IP も位置情報も使わない）。
  ⚠️ **英語ページの既定が JPY になる道を作らない。** それが直した不具合そのもの。
  ⚠️ `navigator.language` を足さない。あれは「読みたい言語」で居場所ではない（en-US は世界中の既定）。
- **日本語ページは地域を見ない＝必ず円**（オーナー判断）。
  日本語＋JPY は「1文字も書き換えない」＝ `currency.js` の土台なので、ここを動かすと全ページが書き換え対象になる。
- ⚠️ **自分で選んだ通貨は、ページを移っても地域の通貨に戻さない**（オーナーの条件）。
- 検査は `assert-currency.mjs` の末尾の「既定の通貨の決め方」。
  **時計の置き場所を `Asia/Tokyo` に固定してある**（固定しないと、この Mac がどこにあるかで答えが変わる）。
  `TZ_CUR` を変えたら検査の `REGION` も直す（写しなので、片方だけだと黙って別物になる）。

### ⚠️ 英語ページの金額は HTML の時点でドルになっている（2026-09-18）
本文を円で書いて実行時に直していたので、**JS を動かさない読み手（AI のクローラ）には
¥3,700万としか見えなかった**。いまは `currency.js` が実行時に作るのと同じ span を
あらかじめ HTML に書いてある。人間の画面は1ピクセルも変わらない。

```html
<span class="pv-cur" data-jpy="37000000" data-orig="¥37M">$233K</span>
```

- **`en/` の本文に円で金額を足したら `node bake-en-currency.mjs` を流す。**
  流さないと、その1か所だけ英語ページに円が残る（画面では JS が直すので**気づけない**）。
  `--check` で差分だけ・`--undo` で全部元に戻る（1バイト違わず戻ることを 183枚で確認済み）。
- **ページのソースを読んで金額を照合する道具は、必ず [cur-core.mjs](cur-core.mjs) の `unbake()` を通す。**
  元の円表記は `data-orig` に残っているが**タグの中**なので、正規表現からは見えない。
  通さないと英語183枚が**黙って照合から外れる**（[check-salary.mjs](check-salary.mjs) が手本）。
- **span の作り方を写さない。** [cur-core.mjs](cur-core.mjs) が `currency.js` から
  `fmt` / `makeRe` / `matchToParts` の**関数本体をそのまま切り出して**評価している。
  数字の作り方はサイトに1つだけ。
- ⚠️ **ドルの換算レートを手で持たない。** 4本のスクリプトが `160` を自前で持っていて、
  タイトルが `$231K`・本文が `$233K` と**同じページの中で食い違っていた**（`currency.js` は 158.95）。
  レートは `(await curCore('USD','en')).RATES.USD`、額は `CUR.fmt()` で作る。
- ⚠️ `currency.js` の `init()` で `applyAll()` を `state !== 'JPY'` の中に戻さない。
  焼き込んだ span は `scan()` が素通りする（`pv-cur` は `SKIP_CLASS`）ので、
  **英語ページで円を選んでいる人の画面がドル表記のまま固まる。**

### JSON-LD の更新日（冒頭の答えの段落は撤去済み）
- ★**航空会社ページの冒頭に年収の要約を置かない**（2026-09-21 オーナー指示「全部削除」）。
  2026-09-18 に AI に引かれるための手当てとして、リード文の直後に
  「◯◯の機長の年収は平均¥…、幅はおおむね…。副操縦士は…。2026年3月時点。」の1段落
  （`<p class="pv-answer">`・日英224枚）を置いたが、日英とも全部外した。
  置いていた `gen-answer-lead.mjs` と `.pv-answer` の見た目も消してある（戻すなら git の `3822922` から）。
- [gen-datemod.mjs](gen-datemod.mjs) … JSON-LD の Article に `datePublished` / `dateModified` を入れる。
  **`seo-normalize.mjs` のあと・コミットの直前に流す。** 流し忘れは `assert-generated.mjs` が捕まえる。
  日付の決め方は [page-dates.mjs](page-dates.mjs) の1か所で、`gen-sitemap.mjs` の `lastmod` も
  同じものを呼ぶ（＝サイトマップと JSON-LD の日付は必ず一致する。346枚で確認済み）。
  ⚠️ **日付を入れただけの変更を「直した」と数えない**（JSON-LD を読んで Article の日付を落としてから
  前後を比べる。コミットした後も効く）。外すと、中身が1文字も変わっていないページまで
  「今日直した」になる＝数字を盛る。
  ⚠️ **分からない日付は書かない。** 履歴は 2026-08-20 の1コミットから始まっていて、それより前の
  公開日は git から分からない。なので `datePublished` は**手で書いてあった15枚にしか無い**
  （履歴の始まりより前の日付＝人が書いたものは残す）。初版はここを 2026-08-20 で埋め、
  手書きの公開日 11枚を上書きしていた（2026-09-18 に戻した）。
  ⚠️ **`seo-normalize.mjs` は管理ブロックを作り直すとき、前にあった日付を運ぶ。**
  運ばなかった頃、ドルのレートを直すために流して **216枚の日付が黙って消えた**（画面は何も変わらない）。

## 口コミ・海外評判のコンテンツルール
- 海外の口コミは**忠実訳の引用＋末尾に出典**。全文転載・大量リライト・出典なしの自社コンテンツ化はしない（翻案権侵害＋検索順位の毀損＋信用の毀損）。
- 海外評判は6カテゴリ×約150字の通常の口コミ風カードに分けて混ぜる。先頭に長文を1枚置く形にしない。星は付けない。出典は必須。

## ローカルサーバー
- **必ず localhost で確認する。** `file:///` を開かない（スクリーンショットも同様）。
- 起動: `node serve.mjs`（プロジェクトルートを `http://localhost:3000` で配信）
- バックグラウンドで起動しておく。**すでに動いていたら二重に起動しない。**

## 利用状況を見る（本当に使われているか）
- `node db/usage.mjs`（`--days 7` / `--since=2026-08-11` / `--all` / `--emails`）。本番 Supabase を**読むだけ**。
- **動作確認用のテストアカウントを外して数える。** 除外リストは `mail-bot/.env` の `PV_TEST_EMAILS`
  （公開リポジトリなので実在アドレスをコードに書かない）。未設定だと警告が出るが数字は素のまま＝動作確認が実績に混ざる。
- 口コミも給与レポートも `user_id` を持たない。`proof_hash` を手元で作り直して本人と突き合わせている
  （式は [db/pay-reports.sql:925](db/pay-reports.sql#L925) と [submit-review.html:1227](submit-review.html#L1227)）。**この2つを変えたら `db/usage.mjs` も直す。**
- **訪問者数（PV/UU）はここには出ない。** DB に残るのは「登録した・投稿した」だけ。訪問は GA4 で見る。
- ★**「REAL PAY の画面に出る数」の節（3-c）が、画面の3枚のカードと DEEP PAY の分子を出す**（2026-08-25）。
  `shot-*.mjs` の見本（`ST_LOCK`）は手で書き写した値なので**腐る**。写す前にここを走らせる。
  ⚠️ この節は `db/pay-rows.sql` の数え方（`sane` / `person` / `tally` / `airs` / `contrib`）を**手で写している**。
  あちらを変えたらここも直す。金額の出し方だけは写さず本物の関数を呼んでいる
  （`pv_pending_usd` / `pv_airline_resolve`。呼べる名前は `RPC_READONLY` に列挙）。
  本物の金額は本人としてしか取れない（サービスキーで `pv_pay_rows()` を叩いても、
  鍵が開いていない扱いになるか権限で弾かれるかのどちらかで、金額は返らない）ので、写す以外の道が無い。
  ⚠️ 2026-09-16 から**未ログインでも呼べる**ようになった（伏せた一覧を出すため）。
  返るのは航空会社・出典・投稿時期の3つだけで、金額・職位・機種は入っていない
  （★2026-09-21 オーナー指示「職位ださなくていいや」で職位も渡すのをやめた。画面は
  職位の欄に空の板を置き、絞り込みの職位の口を枠ごと隠す ── 送っていないから隠せる）。
  ★2026-09-19〜09-21 のあいだだけ、上の8行を1人に固定の型（年収型／機種型／会社型）で出していた。
    給与の新規提出が2日続けて0だったのでオーナー指示で戻した（`80ff719` の revert）。
    **戻すときは SQL と JS の両方が要る**（サーバが送る欄と、画面が描く欄）。
  ★2026-09-19 から、同じ会社・同じ職位の公開年収から大きく外れた**本人申告**の行は、開いた一覧で ⚠ が付く
  （数字は書き換えない・集計にも今までどおり入る。**伏せた一覧には印そのものを返さない**）。
  判定は `db/pay-rows.sql` の `fence` の1か所だけで、幅は DB の会社の表にある
  ＝**年収のレンジを変えたら `db/airlines.generated.sql` を貼り直す**（「⚠ の印」の節）。
- デプロイ前チェックには入れない（本番のDBを読むため）。

## スクリーンショット
- Puppeteer は `package.json` の依存。`node_modules` から解決されるので追加インストール不要。
- 撮影: `node screenshot.mjs http://localhost:3000`
- 保存先は `./temporary screenshots/screenshot-N.png`（自動採番・上書きされない）
- ラベル付き: `node screenshot.mjs http://localhost:3000 label` → `screenshot-N-label.png`
- 撮ったら Read ツールで PNG を読む。画像はそのまま解析できる。
- 比較は具体的に。「見出しが 32px だが参照は約 24px」「カード間 16px、あるべきは 24px」のように書く。
- 確認項目: 余白/パディング、フォントサイズ・太さ・行高、色（正確な hex）、揃え、角丸、影、画像サイズ

## ページを1枚足すとき

**同じ集合が4つある。1つ忘れると sitemap と robots が食い違うのに、何も赤くならない。**

| 場所 | 作業 |
|---|---|
| [gen-sitemap.mjs](gen-sitemap.mjs) の `NOINDEX` | 検索に出さないページなら足す |
| [seo-normalize.mjs](seo-normalize.mjs) の `NOINDEX` | 同上 |
| [assert-seo.mjs](assert-seo.mjs) の `NOINDEX` | 同上（3つで対、と両方のコメントが書いている） |
| [assert-links.mjs](assert-links.mjs) の `APPFLOW` | ログインの先にあるページなら足す |
| [seo-normalize.mjs](seo-normalize.mjs) の `COPY` | 日英の `t`/`d`。**noindex でも `<title>` は出る。無いと次に流した人がタイトルを空にする** |
| [assert-founding.mjs](assert-founding.mjs) の除外リスト | FOUNDING の板は `profile.html` の最上部だけ |
| [pv-session.js](pv-session.js) の `GF_SKIP` | **入力の途中の画面なら足す。** 足さないと、登録だけの会員がそのページを開いた瞬間に Give → Get の板が入力を覆う |

⚠️ **`defer-third-party.mjs` は流さない。** あれは PV-3P の塊を必ず `</head>` の直前へ置き直すので、
先に入っている `pv-session.js` との前後が入れ替わり、**298枚が本題と無関係な差分になる**
（英語ページのコメントも日本語に戻る）。新しいページに解析タグが要るときは、
既存ページの `<!--PV-3P-->…<!--/PV-3P-->` を**そのまま写す**（置き場所は `pv-session.js` の直前）。

そのうえで `en/` 側を置いてから **`node bake-en-currency.mjs`**（英語ページの金額をドルにする）→
**`node gen-en-manifest.mjs`**
（[lang-toggle.js](lang-toggle.js) の `EN_PAGES` は生成物。手編集禁止）→
`node seo-normalize.mjs` → `node gen-datemod.mjs` → `node gen-sitemap.mjs` の順に流す。

- `noindex` は `<!--PV-SRC t="…" d="…"-->` を置いて `seo-normalize.mjs` に `<!--PV-SEO-->` を書かせる
  （[airline-conditions.html:14](airline-conditions.html#L14) が手本）
- `favicon` の宣言と Inter の読み込みを忘れない（`assert-links.mjs` が見ている）
- マイページ系（`.mr-side` を持つ画面）なら [patch-side-nav.mjs](patch-side-nav.mjs) の `CURRENT` に足し、
  空の `<nav class="mr-side" aria-label="…"></nav>` を置いてから `node patch-side-nav.mjs` を流す
- `_config.yml` は変更不要（`.html` は元から配信される）
## 登録だけで止まっている会員に、Give → Get を1回だけ出す（全ページ）

★2026-09-15 オーナー指示「会員登録だけの人がログインしたりページに来たら毎回1回はこの画面出して」。
登録完了画面と**同じ板**を、給与を1件も出していない会員に出す。

- **出すかどうかを決めるのは [pv-session.js](pv-session.js) の `giveFirstDue()` の1か所だけ。**
  420枚すべての `<head>` に居るのはこのファイルだけなので、ここに置いてある。
  判定は**ブラウザの保存領域を読むだけ**で、通信は1本もしない。
- 出すと決まったときだけ [pv-give-first.js](pv-give-first.js) を動的に読む。
  **出さない人（＝ログインしていない大多数）の通信は1本も増えない。**
- 出さない相手 ── 未ログイン／死んだログイン／給与の鍵が生きている人／さっき見た人
  （同じログインのまま6時間以内）。出さない画面は `GF_SKIP` と、**`?claim=` を持って
  戻ってきた人**（匿名で出した給与を引き取る途中を覆わない）。
- 3段の表は [pv-gates.js](pv-gates.js) の `giveGetHTML(true)` を**呼ぶ**。文言を書き写さない。
  ⚠️ このとき `PV_GATES_TEXT_ONLY` を立ててから読む。立て忘れると `boot()` まで走り、
  **頼まれていない約400枚のナビに錠前が付く**（`data-mr-gate` は全ページの REAL PAY のリンクにある）。

⚠️ **`my-value.css` を「全ページにある」と思わない。** `<link>` で読んでいるのは **18枚だけ**
（`pv-tokens.css` と `app-nav.css` は412枚）。2026-09-15、`.mr-gate` と `.pv-give` の見た目が
あると思って板を出したら、残り約400枚では**下地も罫線も無い素の文字列**が画面を覆った。
3段と板の見た目だけを [pv-give.css](pv-give.css) へ出し（8KB）、18枚には `<link>` を並べ、
それ以外では `pv-give-first.js` が**読み終わるのを待ってから**開く。
**マイページ専用の規則を `pv-give.css` に書き足さない。**

見るもの: `node assert-give-first.mjs`（日英で82項目）。

## デプロイ前チェック

**`node check.mjs` 1本で全部走る。** 中で並列に回すので、手で1本ずつ流すより速い。

| コマンド | 中身 | 目安 |
|---|---|---|
| `node check.mjs fast` | 静的検査＋ネット不要の単体（17本）| 2秒 |
| `node check.mjs sql` | PGlite の SQL テスト（13本）| 80秒 |
| `node check.mjs web` | Puppeteer の画面検査（20本）| 7分半 |
| `node check.mjs all` | 全部（50本）| 10分 |
| `node check.mjs` | 既定 ＝ `fast` ＋ `sql`（画面を触っていない回はこれで足りる）| 80秒 |

- 画面・CSS・共有 JS を触ったら `web` か `all` まで流す。
- ブラウザ検査は `serve.mjs` を必要なときだけ自分で起動し、自分で止める（すでに動いていたら触らない）。
- `-j N` で並列数を変えられる（既定は `web` が 4、それ以外が 8）。
- 落ちた検査は**落ちた行を先に出し**、そのあと最後の40行を出す。全文が要るときはその1本を単体で流す。
- ⚠️ `db/test-payslip-redact.mjs` だけは**先に単独で流す**（`check.mjs` の `SOLO`）。
  明細の文字読み取りに40秒の制限があり、他と一緒に走らせると**製品は正しいのに赤くなる**。
  そのぶん `web` が約2分長い。ここに検査を足すとその間ほぼ全コアが遊ぶので、安易に増やさない。
- ⚠️ **時間で待つ検査は、混んだ回に嘘の赤を出す。** 2026-08-28 に `assert-referral.mjs` で
  2種類とも踏んだ（ページの高さがまだ足りず1pxも動けない／`scroll-behavior:smooth` の
  アニメーション途中で位置を読む）。`sleep` ではなく**条件が満たされるまで待つ**形で書く。

### 何がどれを守っているか
| コマンド | 守っているもの |
|---|---|
| `check-salary.mjs` | 全ページの金額 × SSOT [salary-data.mjs](salary-data.mjs)。`❌` はレンジ外＝誤り・`⚠️` は要目視 |
| `check-sources.mjs` | 出所台帳 [salary-sources.mjs](salary-sources.mjs) の整合（`❌` だけが落ちる）|
| `assert-seo.mjs` / `assert-links.mjs` | `NOINDEX` の対・favicon・Inter・404 リンク |
| `assert-jobs.mjs` | 載せている求人がまだ生きているか（締切・更新日・`validThrough`）|
| `assert-jp.mjs` | 日本語ページの通貨表示・JPY⇄USD 往復 |
| `assert-currency.mjs` | 英語ページの通貨バグ＋**既定の通貨の決め方**（地域ごとの通貨・**英語ページの既定が円にならない**・選んだ通貨がページを移っても戻らない）|
| `assert-langtoggle.mjs` | 言語切替の allowlist と往復 |
| `assert-header.mjs` | ヘッダーが日英14ページ × 10幅で正しく畳まれる／横に溢れない／入力欄が 16px 未満でない |
| `assert-hero-fold.mjs` | トップの**帯2本（緑のカード・口コミ）が最初の1画面に入っている**か（日英 × PC・大画面・iPad 横2つ/縦・スマホの6つ）。中身が空でない・帯2本のあいだが 10px。⚠️ ヒーローの上余白を広げるなら**同じだけ緑の面を縮める**（[lp.css](lp.css) の「★2026-09-24」の節）。⚠️ 段組みは**幅と高さの両方**で決まる（iPad 縦は2列・iPad 横は1列）。高さの条件を外すと 1024×768 が 91px はみ出す|
| `assert-review-quality.mjs` | 口コミの品質判定が**5か所で同じ答え**を返す |
| `assert-translate-review.mjs` | 口コミ自動翻訳の形・鍵が死んだときの通知（`isFatalKeyError`）|
| `assert-admin-notify.mjs` | 管理者通知メールに**金額・明細の項目名が1文字も出ない**・`builders` と SQL の表が一致 |
| `db/test-announce.mjs` | お知らせメールに金額・社名・項目名が入らない |
| `db/test-digest.mjs` | 週まとめの土台（`db/weekly-digest.sql`）── **関数が行そのものを返さない**（返るのは件数と社名だけ）・打ち込まれた社名が出ない・会員から呼べない・**手で流す側と同じ週を同じに数える**（社名まで突き合わせる）|
| `assert-conditions.mjs` | 待遇モーダルが約束どおり閉じられる・1問ごとに保存される |
| `assert-referral.mjs` | 招待 ── **2人以下の区分では数字が1文字も出ない**・常設入口が消えない |
| `assert-admin.mjs` | 管理者ページが**ログインした管理者にしか見えない**（合言葉を持たない）|
| `assert-unlock.mjs` | **口コミの鍵と給与の鍵が混ざらない**（口コミ1件で年収が開かない）|
| `assert-give-first.mjs` | 登録だけの会員に出す Give → Get の板 ── **出す相手を間違えない**（未ログイン・給与を出した人・さっき見た人には出ない）・入力の途中の画面と同じ3段を本文で出す画面では出ない・**ナビに錠前を増やさない**・閉じたらスクロールが戻る・見た目が当たっている（`pv-give.css` を読めている）|
| `assert-pay-rows.mjs` | REAL PAY の7つの約束（Give → Get・準識別子は粗い段だけ・有効数字2桁・1行＝1人…）＋**行を押すと出る面**（帯の両端が刻みの倍数・％も生の額も出ない・押してもサーバへ投げない）＋**行に出る年数の札が段の出どころと合っている**（昇格後が空の古い行は「在籍◯年」と出る・在籍年数を「昇格後」と名乗らせない）|
| `assert-pay-report-sync.mjs` | 給与レポートの**日英が片方だけ直されていない**か（骨格だけ照合・文言は見ない）＋共有 `pay-wizard.js` が日英とも読まれているか＋**段の通過を知らせる名前が日英で1文字も違わない**（違うと「どこで離脱したか」の階段が2本に割れる）|
| `db/test-pay-preview.mjs` | 確認画面の「公開イメージ」が **SQL と同じ答え**を返すか（`pv_sig2` / `pv_band_grid` / `pv_band` と9区分の切り分けを JS へ写しているため。写しが腐ったことに気づく仕掛けはこれ1本だけ）|
| `assert-deep-pay.mjs` | DEEP PAY ── **錠前が掛かったまま**（対の外から入口ゼロ）・「時給」と呼ばない・順位を書かない・0 で埋めない・**選んだ区分が3人未満なら広い区分の数字で埋めない**・**選ぶまで何も出さない** |
| `assert-deep-pay-compare.mjs` | 会社比較 ── **片側が3人未満でももう片側は普通に出る**・勝ち負けの語を書かない・賞与を月々の棒に入れない・人数を JS で数えない（壁は SQL の1か所）|
| `assert-roadmap.mjs` | ROADMAP & REQUESTS ── **匿名が解けない**（一覧の SQL が `author_hash` に触れない）・要望の本文が `textContent` で入る・**日英の文言の鍵が完全に同じ**・区分と状態の白リストが SQL と画面で一致・取れないときに 0 で埋めない・hex と `prefers-color-scheme` の直書きが無い |
| `db/test-requests.mjs` | 要望と ♡ の SQL ── ハッシュが外へ出ない・**1人1票**・管理者しか状態を変えられない・隠した行が一般ユーザーの `total` にも出ない・文字数と連投の制限がサーバ側で効く |
| `assert-claims.mjs` | サイトが**本当のことだけ**を言っているか ── A)「画像は送らない」と書かない（**本当は送っている。**端末を出ないのは*枠の外*と*塗った部分*だけ）・正しい説明が送る直前の確認画面と `personal-data.html` に在る／B) 画面に出る数を HTML に直書きしない（JS が書き換える欄は「—」で出荷・日英で欄の集合が同じ・掲載社数は `SALARY` と一致）|
| `assert-generated.mjs` | 生成物（sitemap・英語版一覧・語彙・JSON-LD の更新日）が**流し忘れで古くなっていない**か。使い捨てのコピーの中で生成スクリプトを流すので**リポジトリには書き込まない**（`.git` だけ読むために貸す）|
| `assert-no-pii.mjs` | オーナーの身元が漏れていないか（`.githooks/pre-commit` から毎回自動で走る）|
| `npm run test:sql` | Supabase 側（`db/*.sql`）を触ったとき。`check.mjs sql` が同じものを並列で回す |

⚠️ **落ちた検査の「なぜ」は [workflows/deploy-checklist.md](workflows/deploy-checklist.md) にある。**
どれも過去に実際に壊れた形を1つずつ書き留めたもので、**検査を直す前に必ずそこを読む**
（検査のほうが正しいことがほとんど）。その画面を触るときも先に読む。

⚠️ **`check.mjs` に入れていないもの**（ネット・本番DB・課金があるため。必要な回だけ手で流す）──
`gen-fx-rates.mjs`（レート取り直し・半年に一度）/ `db/usage.mjs`（本番DBを読む）/
`db/eval-payslip.mjs`（$0.32）/ `translate-eval.mjs`（課金）/
`check-sources.mjs --online` / `assert-jobs.mjs --online` /
`assert-no-pii.mjs --live`（push 後に必ず）/ `assert-no-pii.mjs --history`（履歴を触ったとき）。


## 給与フォームの内訳（[pay-report.html](pay-report.html)）

**⚠️ この画面を触る前に [workflows/pay-form.md](workflows/pay-form.md) を読む。**
2026-08-26〜27 の作り直しの判断が全部そこにある（役割ごとの5モジュール・明細読み取りの対応表・
`pay_items` の形・超過の注意の出し場所）。
**どれも「画面は普通に動いたまま静かに壊れる」形**をしているので、ここに置くのは
読まずに触ると即座に壊れるものだけ。

★**2026-09-08 から5段のウィザード**（`#s1`〜`#s5`・歩かせるのは日英で共有の
[pay-wizard.js](pay-wizard.js)）。**送信ボタンは `#s5` の中だけ**で、途中の段からは送れない
（2026-08-27 の「常設の匿名で提出バー」はオーナー指示で廃止。下端に残したのは年換算の合計表示だけ）。
⚠️ **共有 JS が落ちたら元の1枚ものに戻る二形態**なので、この画面を機械で触る道具は
両方で動かないといけない。下書きは `pv_pay_draft`（このブラウザだけ・DB は触らない）。
詳細と罠は手順書の冒頭の節。

**目的は明細の再現ではない。** 固定／変動／変動の理由／その他の現金の4つに分けて、
**航空会社をまたいで比べられる形**にすること。

### 絶対に破らない7つ
1. **総支給と内訳は排他ではない。** 本人が入れた「その月の総支給額」を内訳の合計で上書きしない。
   **一致は今も条件にしない**（差がプラス側＝「どの項目にも入れていない分」は普通のこと）。
   ⚠️ **超えたときだけは、2026-09-15 から「次へ」で止まる**（オーナー指示「エラーが出てるのに
   次の画面にいけてしまう」）。門は [pay-wizard.js](pay-wizard.js) の `forward()` が呼ぶ
   `blocked` 1か所で、**判定の式は `settleOver()` のまま**＝条件は1つも増えていない。
   送信ボタンは `#s5` の中だけなので、超えたままでは提出にも届かない
   （共有 JS が落ちた1枚もの形態には門が無い。そちらは今までどおり注意だけ）。
   年換算は昔から総支給が正（[db/pay-reports.sql](db/pay-reports.sql) の `pv_annual_total` の
   `coalesce` 第1引数）＝**内訳の列を足しても年収の数字は1円も動かない**
   ⚠️ **例外は組合の手当が1つだけ**（2026-09-02）。**支給元が「組合」のときだけ**、そのお金が
   会社の明細に印字されない＝本人が書いた総支給の中に無いので、総支給の枝でも足す。
   会社・両方・**その他**・空は「総支給の中」（その他を選ぶ人も、お金は会社から出ている）。
   判定は `pv_union_outside_gross` の**1か所だけ**（画面・預かり・本棚・DEEP PAY が全部これを呼ぶ）。
   ここを直す前は、乗員代表の年収が組合払いのぶん丸ごと落ちていた（本番で1件・年収が半分）
   ⚠️ **時間あたり（`usd_per_block_hour`）だけは、この組合分を分子から抜く。** あれは
   「飛んだことへの対価」で年収そのものではない。式は `pv_block_hour_usd` の1か所だけ
   ⚠️ **支給構成の円にも入れる**（2026-09-02）。入れないと、半分が組合から出ている人の円が
   会社ぶんだけになり、内訳を書いていない人は図そのものが出ない（本番の1件がそうだった）。
   ★**総支給ぜんぶ ＝ 会社から ＋ 組合から**（オーナーが決めた定義）。年収も・円も・
   「基本給が総支給に占める割合」の分母も・DEEP PAY の支給構成も**全部これ1つ**。
   どこかで引き算を始めない（2026-09-02 に割合の分母だけ引いてみて、同じ日に戻した）。
   額そのものは `unionOutsideJpy` の1か所だけ
   ⚠️ **不就労減額（欠勤控除など）は、同じ話の逆向き**（2026-09-12）。印字の総支給は減額**後**・
   内訳の欄は減額**前**なので、**比べる側の分母にだけ足し戻す**（`pv_absence_total` →
   `my_pay_reports` の `absence_total`）。**年収にも総支給の列にも1円も足さない。**
   足し戻す所は4つ ── フォームの注意（`recalc` の `showOver`）／[pay-viz.js](pay-viz.js) の円／
   [db/deep-pay.sql](db/deep-pay.sql) の `cash_m`／[db/pay-rows.sql](db/pay-rows.sql) の
   `shelf` と `pv_pending_detail`。1つ忘れると、**休んだ月だけが黙って落ちる**
   （注意が出たまま・円が消える・段が下りて別の集団の数字になる・帯が出ない）
2. **役割ごとの手当は専用の列に入れる。二重計上させない。**
   教官 `instructor_pay` ／ 審査 `examiner_pay` ／ 組合 `union_pay` ／
   管理 `management_pay` ／ 兼務 `nonline_pay`。
   職位手当（`command_pay`）・変動給（`flight_variable_pay`）・その他（`other_allowance`）の
   **どれにも足し込まない**
3. **こちらで割り算・掛け算して出せる数は、そもそも聞かない。**
   単価・1回あたり・1日あたり・時給換算は**今月の額 ÷ 数量**で出せるので欄を作らない。
   **数量（回数・日数・Sessions 数）は残す**（明細を見ないと分からない数）
4. **列を1つ足したら4か所に写す。** [db/pay-reports.sql](db/pay-reports.sql) の `jsonb_build_object`
   （足し忘れると中身が黙って消える）／[db/pay-rows.sql](db/pay-rows.sql) の `pv_annual_total` の
   **引数の並び**（署名を書く場所が4つ。1つでも古いと**ファイルごと流れない**）／
   [pay-viz.js](pay-viz.js) の `SEG`／[my-value.js](my-value.js) の3本のバケツ
   ⚠️ **9区分に分ける「命綱の引き算」は2か所にある**（2026-09-03。2026-09-15 に
   `a_fixed` を `a_base`＝基本給 と `a_gtee`＝保証手当・職務手当 の2つへ割った）──
   [db/deep-pay.sql](db/deep-pay.sql) の `a_base / a_gtee / a_var / a_cmd / a_role / a_pd / a_house / a_other` と、
   [db/pay-rows.sql](db/pay-rows.sql) の `shelf`（REAL PAY の帯を作る側）。**同じ式を写してある。**
   片方だけ直すと、DEEP PAY のドーナツと REAL PAY の帯が**同じ人について違う内訳を出す**
   （どちらも普通に動いたまま）。共有関数にしていないのは、`pv_pay_comp` が同型の欠陥を
   抱えたまま残っている（直す場所が3つになる）ことと、`deep-pay.sql` が `pay-rows.sql` より
   **後**に貼るファイルで依存すると適用順が逆転するため。
5. **`reviews_v2` に列を足さない。**
   2026-09-07 に本文の列を DB 側で隠したが（[db/reviews-gate.sql](db/reviews-gate.sql)）、
   **隠すのは「隠す」と名指しした8列だけ**で、あとから足した列は `pv_reviews()` が
   丸ごと返す＝そのまま公開される。役職・区分は既存の `job_role` にカンマ区切りで入れる
6. **必須（`req-tag`）を役割モジュールに置かない。** 「なし」「含まれている」を選んだ人が
   数クリックで抜けられることが、この5モジュールが成立している理由
7. **年数の欄は2つあり、混ぜない**（2026-09-16・オーナー指摘）。
   在籍年数 `seniority_years`＝**この会社に入ってから**（訓練期間を含む）。
   昇格後年数 `rank_years`＝**いまの職位になってから**（他社での同じ職位も通算）。
   **REAL PAY の行の段（`ten`＝5年幅の5段・0〜4）は昇格後年数が第一。**
   行の並びが `機長 · B787 · …年` なので、読む側は必ず「昇格してから」と読む。
   自社養成の人は昇格した年でも「10〜20年」と出ていた。
   ⚠️ **段を職位ごとに変えない**（刻みの形そのものが職位を指す）。
   ⚠️ **`rank_years > seniority_years` は正しい**（他社から移ってきた機長）。列をまたぐ CHECK を置かない。
   ⚠️ **古い行（`rank_years` が null）は在籍年数で段を作って今までどおり出す**
   （オーナー指示「これまで提出してもらったものは今まで通り出して」）。
   ただし**同じ札で出さない** ── サーバが `tenk`（`r`＝昇格後／`s`＝在籍）を必ず添え、
   画面が「昇格後10〜15年」と「在籍10〜15年」を別の言葉で出す。
   **`tenk` を落とすと、直した嘘がそのまま戻る。**
   式は [db/pay-rows.sql](db/pay-rows.sql) の `ten` / `tenk` が正・[pay-wizard.js](pay-wizard.js) が写し。
   詳細は [workflows/pay-form.md](workflows/pay-form.md) の「年数の欄は2つある」

### 見るもの
`node db/test-form-contract.mjs`（画面の契約）／`npm run test:sql`（保存と検品）／
`node db/test-payslip-extras.mjs`（隠し欄 → payload）／`node assert-admin-notify.mjs`（メール）／
`node db/test-value-breakdown.mjs`（支給構成の切れ）／
`node db/test-pay-preview.mjs`（確認画面の公開イメージ ⇄ SQL）。
絵は `node shot-pay.mjs`（日英 × Desktop/Mobile × ライト/ダークで 198枚）と
`node shot-value.mjs both ja`、はみ出しは `node measure-pay.mjs`（5段を歩く）。
[db/pay-reports.verify.sql](db/pay-reports.verify.sql) は**オーナーが Supabase に貼る検算**（16行が ✅）。
中身は `db/test-pay-reports.mjs` が毎回流している＝**検算だけ古い**にはならない。
★**列や鍵を足した回は [db/pay-reports.roundtrip.sql](db/pay-reports.roundtrip.sql) も貼る**（2026-09-12）。
あちらは関数の計算しか見ていないので、「保存はされたが**その鍵だけ黙って消えている**」を捕まえられない
（`pay_items` はサーバ側の白リストを通って作り直される）。こちらは**保存 → 再取得 → 表示**を実際に通して
18項目を判定し、最後にわざと例外を投げて**巻き戻す**＝検証用の行が REAL PAY・DEEP PAY・公開集計に1件も混ざらない。
⚠️ 赤い枠で出るのが正常（中に結果表が入っている）。これも `db/test-pay-reports.mjs` が毎回流している。

**⚠️ 「,」の読みは、画面と明細でわざと違う**（2026-09-15）。
手で打つ欄は**常にけた区切り**（`3500,50` → 350050。数字1つでは判別できず、打っている途中の形もある）。
明細は [detectDecMark()](supabase/functions/parse-payslip/index.ts) が**紙1枚ごとに小数点の記号を1回決めて**
全行そろえる（`4250,00` → 4250）。同じ紙に金額が何十個あり全部同じ流儀だから決められる。
**揃えようとして `readMoneyNum` の第3引数を消さない** ── 欧州の明細が100倍になって年収に入る。
第3引数を省いた呼び出しは今までと1文字も違わないので、`db/test-payslip-parse.mjs` の
**画面との突き合わせ（2引数）はそのまま生きている**。理由と決め手の順は
[workflows/pay-form.md](workflows/pay-form.md) の「明細だけは紙1枚ごとに流儀を決める」。

### ⚠️ 明細の扱いは、サイト全体で1つの言い方にそろえる（2026-09-20）
**「画像は送りません」は嘘。** 端末でやっているのは *枠の外の切り落とし* と *黒塗り* で、
読み取りは**枠の中を切り出した画像を送って**やっている（→ Edge Function → Anthropic）。
端末を出ないのは**枠の外**と**塗った部分**であって、画像そのものではない。保存はしない
（ストレージにも DB にもログにも書かず、読み終わったら捨てる）。

> 氏名・社員番号・口座はブラウザの中で黒塗りしてから送ります。画像は保存しません。
> Your name, staff number and bank details are blacked out in your browser before anything is sent. The image itself is never stored.

2026-08-13 に `pay-report.html` で一度直したが、**検査がその2枚しか見ていなかった**ため、
2026-09-20 まで4か所に嘘が残っていた（`index.html` は同じ1枚の中で §4 と §7 が矛盾し、
`airlines/premium-auth-lock.js` は**226枚**に出ていた）。いまは `node assert-claims.mjs` が
サイト全体（HTML＋共有 JS）を見ている。**売り文句を強くしたくなったら、ここへ戻る。**

**`supabase/functions/` を触ったら push だけでは本番に反映されない。**
Supabase ダッシュボード → Edge Functions → 該当関数 → コードを貼り替えて Deploy（オーナー作業）。
リポジトリ側だけ直して安心すると、サイトと通知メールで判定が食い違う（実際に起きた）。

**⚠️ Anthropic の API キーを消す・入れ替える前に、使っている側を全部 grep する。**
Supabase の secret はプロジェクト単位だが、**`parse-payslip` だけは専用キーを先に見る**
（[parse-payslip/index.ts:51](supabase/functions/parse-payslip/index.ts#L51) の
`ANTHROPIC_API_KEY_PAYSLIP || ANTHROPIC_API_KEY`）。2026-08-10、コンソールで「未使用に見えた」キーを
消したら、専用 secret が死んだキーを指したまま残り**明細読み取りだけが停止した**（`ANTHROPIC_API_KEY_PAYSLIP`
secret を削除して共通キーへ落として復旧。現在この secret は無い）。
`node db/smoke-parse-payslip.mjs` の段1〜3は secret の**存在**しか見ない。**有効性は `--live` でしか分からない**
（$0.02）。`read_failed` が1〜2秒で返ればキーが無効、9〜10秒かかっていれば読み取り側の問題。

**翻訳のプロンプトを直すときは、デプロイする前に手元で訳し比べる。**
`node translate-eval.mjs`（`--ja` / `--en` / `--row <id>`）が
[translate-review/index.ts](supabase/functions/translate-review/index.ts) のプロンプトと翻訳の実体を
そのまま import して回し、**原文・下訳・推敲後**を並べて出す。
要るのは `mail-bot/.env` の `ANTHROPIC_API_KEY`（gitignore 済み・開発用）。
⚠️ これは API を実際に叩いて課金される。デプロイ前チェックの一覧には入れない。
訳が不自然だったら `GLOSSARY` に**実際に出た誤訳だけ**を足す（推測で膨らませない）。

本番は **`main` ブランチ → GitHub Pages**（[CNAME](CNAME) = pilot-value.com、GitHub Actions は無し）。
**push はオーナーの承認を得てから。** 作業ブランチから直接 main に入れない。

## ⚠️ 公開リポジトリであること（運営者の身元は守る）
このリポジトリは **PUBLIC** で、GitHub Pages が `main` のルートを丸ごと配信する。
つまり **「リポジトリに入れた」＝「pilot-value.com から誰でも落とせる」**。
実際に `https://pilot-value.com/shot-remind.mjs` から運営者の実名が、
`patch-payslip.mjs` から macOS のログイン名が 200 で読めていた（2026-08-09 に塞いだ）。
運営者が誰かを特定されると職業上の実害が出る。

- **絶対パスを書かない。** `const ROOT = '/Users/…'` はログイン名がそのまま公開される。
  `fileURLToPath(new URL('.', import.meta.url))` で自分の位置から解く（手本は [patch-payslip.mjs](patch-payslip.mjs)）。
- **サンプルデータに実在の氏名を使わない。** メール文面の検証用でも公開される。
  日本語の氏名が要る箇所は架空名を使う（[shot-remind.mjs](shot-remind.mjs) の `高橋 蓮` / `Alex Mercer`）。
- **個人メールを書かない。** 連絡先は `info@pilot-value.com`、送信元は `noreply@pilot-value.com`。
- **削除依頼・開示請求が来たときは [workflows/handle-disclosure-request.md](workflows/handle-disclosure-request.md) を先に読む。**
  種類が4つあり、**事業者からの「開示してよいか」という照会だけは期限が数日〜2週間と短い**。
  放置すると異議なしとして扱われ、こちらの言い分が無いまま話が進む。弁護士名義・裁判所の書類は自分で返さない。
- **問い合わせに Gmail からそのまま返信しない。** MX は Cloudflare Email Routing ＝転送専用で、
  受信箱で「返信」を押すと個人アドレスと表示名が相手に渡る。**1通でここまでの作業が無意味になる。**
  Gmail の送信元に `info@pilot-value.com` を Resend の SMTP 経由で登録すること
  （手順は [mail-bot/README.md](mail-bot/README.md) の「返信経路」）。
  送った現物の検証は `node mail-bot/check-reply-headers.mjs <保存した.eml>`。
  **表示名も署名も base64 に包まれるので、`.eml` を `grep` しても氏名は出ない。必ずこれを通す。**
- **git の作者は `PILOT VALUE <info@pilot-value.com>`。** 個人アカウントでコミットしない。
- **写真を入れない。スクリーンショットにする。** カメラの画像は EXIF に撮影地の緯度経度を持つ。
  どうしても要るなら `node assert-no-pii.mjs` の B) が GPS を検出して落とすので、それに従って作り直す。
- 何を配信するかは [_config.yml](_config.yml) の `exclude` が決める。
  `.mjs` `.md` `db/` `supabase/` などは配信対象外。**ここを触ったら必ず `--live` で
  「消したい物が 404」かつ「サイトが読む物が 200」の両方を確認する**（消しすぎると本番が壊れる）。
  `exclude` は**除外リスト方式**なので、書いていない種類のファイルは全部配信される。
  新しい拡張子を足したときは `assert-no-pii.mjs` の C) が知らせる。
- 氏名など「ここに書けない語」は `.pii-denylist`（gitignore 済み・ローカル限り）に置く。
  **姓と名を独立に、表記ゆれごと**書く（連結した1パターンだけでは別表記の氏名に当たらない）。
  語を足すときは先に `git grep` で 0 件を確かめる。バックアップは iCloud の Claude-Backup。
- 勤務先が割れる**社内語彙**は `.employer-denylist`（同じく gitignore 済み・ローカル限り）。
  部門コード・手当の呼び名・社内指標の書式など、**中の人しか書けない語だけ**を入れる。
  ⚠️ **勤務先の「社名」を入れない。** サイトは110社の航空会社を扱っていて社名は本文に山ほど出るので、
  1行足すだけで正しいページが何百件も落ちて検査が使い物にならなくなる。
  「所属長」「社内ポータル」のような、どこの会社でも使う言葉も入れない（口コミが普通に書く）。

### 新しい Mac / 新しい clone での初回セットアップ（3つとも要る）
```sh
git config core.hooksPath .githooks     # commit と push のたびに検査が走るようにする
#   pre-commit → assert-no-pii.mjs（身元漏れ。入ると消せないので commit で止める）
#   pre-push   → check.mjs fast（約2秒）。DB 側（db/ ・ supabase/ ・ *.sql）を
#                触っている回だけ check.mjs sql（約70秒）も足して流し、落ちたら止める
# iCloud の Claude-Backup/latest/repo-lists/ から
#   .pii-denylist と .employer-denylist をリポジトリのルートに戻す
# （どちらも gitignore 済みなので clone には付いてこない。
#   backup-claude.command が iCloud へ入れている）
```
**この2つのどちらかが無いと `assert-no-pii.mjs` は落ちる。** 氏名や勤務先の検査だけが黙って
無効になった状態で「✓ 全部通った」と出るのが一番危ないため、意図的にそうしてある。

**なぜ commit の時点で止めるのか。** 一度 push すると、履歴を書き換えても GitHub 側の
unreachable object や外部のミラーに残る可能性があり、こちらからは消せない。
「入ってから消す」は成立しない。`git commit --no-verify` はやむを得ないときだけ使う。

## 並列サブエージェント
- 一括編集を分担させるとき、**サブエージェントに git 操作をさせない。** 過去に1体が `git checkout` を実行し、未コミットの約90ページを失った事故がある。
- 分担を始める前に**チェックポイント commit を取る。**

## ブランドアセット
- 設計前に [baland_ass/](baland_ass/) を確認する（`brand_assets` ではない）。ロゴ・配色・サイトイメージ・運営ポリシーの画像が入っている。
- 資産があるならそれを使う。実物があるところにプレースホルダを置かない。
- 配色が定義されているならその値をそのまま使う。ブランド色を勝手に発明しない。

## Anti-Generic Guardrails
- **色:** Tailwind デフォルトパレット（indigo-500, blue-600 等）を使わない。ブランド色を決めてそこから導出する。
- **影:** 平坦な `shadow-md` を使わない。低不透明度で色味を持たせた多層の影にする。
- **タイポ:** 見出しと本文に同じフォントを使わない。ディスプレイ/セリフ＋クリーンなサンセリフで組む。大見出しは字間を詰め（`-0.03em`）、本文は行高を広く（`1.7`）。
- **グラデーション:** 放射グラデーションを重ねる。SVG ノイズフィルタで粒子感を足して奥行きを出す。
- **アニメーション:** `transform` と `opacity` のみ。`transition-all` は使わない。スプリング系のイージングを使う。
- **インタラクティブ状態:** クリックできる要素には全て hover / focus-visible / active を付ける。例外なし。
- **画像:** グラデーションのオーバーレイ（`bg-gradient-to-t from-black/60`）＋ `mix-blend-multiply` の色調整レイヤーを重ねる。
- **余白:** 意図を持った一貫したスペーシングトークンで組む。Tailwind の刻みをその場で選ばない。
- **奥行き:** 面に階層を持たせる（base → elevated → floating）。全てを同じ z 平面に置かない。

## Hard Rules
- 生成スクリプト（`gen_*` / `generate_*`）を1社の修正のために再実行しない
- `salary-data.json` を手編集しない
- スクリーンショットを1回撮って終わりにしない
- `transition-all` を使わない
- Tailwind デフォルトの blue / indigo を主色にしない
- オーナーの承認なしに `main` へ push しない
