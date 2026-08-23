# CLAUDE.md — PILOT VALUE 作業ルール

## Always Do First
- **事業判断・新機能の是非は [VISION.md](VISION.md) に従う。** 作る前に Decision Framework の4問（一次データを増やすか／毎月戻る理由になるか／信頼を高めるか／企業価値を高めるか）を通し、YESが一つも無ければ作らない。
- **手順書が [workflows/](workflows/) にある作業は、必ずそれを読んでから始める。** 手順書が古かったり罠が見つかったら、作業後に更新する（新規作成・上書きはオーナー承認を得てから）。

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
  （式は [db/pay-reports.sql:556](db/pay-reports.sql#L556) と [submit-review.html:1164](submit-review.html#L1164)）。**この2つを変えたら `db/usage.mjs` も直す。**
- **訪問者数（PV/UU）はここには出ない。** DB に残るのは「登録した・投稿した」だけ。訪問は GA4 で見る。
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

そのうえで `en/` 側を置いてから **`node gen-en-manifest.mjs`**
（[lang-toggle.js](lang-toggle.js) の `EN_PAGES` は生成物。手編集禁止）→
`node seo-normalize.mjs` → `node gen-sitemap.mjs` の順に流す。

- `noindex` は `<!--PV-SRC t="…" d="…"-->` を置いて `seo-normalize.mjs` に `<!--PV-SEO-->` を書かせる
  （[airline-conditions.html:14](airline-conditions.html#L14) が手本）
- `favicon` の宣言と Inter の読み込みを忘れない（`assert-links.mjs` が見ている）
- マイページ系（`.mr-side` を持つ画面）なら [patch-side-nav.mjs](patch-side-nav.mjs) の `CURRENT` に足し、
  空の `<nav class="mr-side" aria-label="…"></nav>` を置いてから `node patch-side-nav.mjs` を流す
- `_config.yml` は変更不要（`.html` は元から配信される）

## デプロイ前チェック
1. `node serve.mjs` を起動する（下の assert 系は localhost 必須）
2. `node check-salary.mjs` — 全ページ × SSOT の整合。2パス構成:
   - パス1 = 110社の航空会社ページに自社の機長／副操縦士平均が載っているか
   - パス2 = **サイト全 HTML**（トップ・記事・比較ページ含む）から「社名＋役職＋金額」を拾って SSOT と突合。
     `❌` はレンジ外＝誤り。`⚠️` はレンジ内だが節目でない＝要目視。
     複数社の平均をまたぐ言い方など、正しいと確認済みのものは `check-salary.mjs` の `ALLOW` に理由つきで置く
   - `❌` が1件でもあれば `exitCode 1` になる（`salary-data.json` の不一致も同じ）
3. `node check-sources.mjs` — 出所台帳 [salary-sources.mjs](salary-sources.mjs) の整合（語彙・孤児 slug・`in_use` の必須項目・`conf:'high'` なのに出所ゼロの社）。
   `❌` だけが `exitCode 1`。`⚠️` は「まだ出所が埋まっていない」ことを示すだけなので落とさない。
   出所を足した回は `node check-sources.mjs --online` でURLの生存も確認する
4. `node assert-jobs.mjs` — 載せている求人がまだ生きているか。
   締切が過ぎたのに「募集中」のまま／一覧の更新日が90日以上前／JSON-LD の `validThrough` が過去、を静的に見る。
   `--online` は掲載元を実際に叩き、消えた求人（`/jobs/warning` へ飛ぶ）を落とし、
   生きている求人は**掲載元の見出しを並べて出す**。
   ⚠️ 掲載元は URL の番号を**別の求人に付け替える**。番号が生きていても中身が入れ替わっているので、
   見出しはこちらのカードと目で見比べる（2026-08-15、9本中3本が別の求人を指していた）
5. `node assert-jp.mjs` — 日本語ページの通貨表示・JPY⇄USD 往復
6. `node assert-currency.mjs` — 英語ページの通貨バグ検出
7. `node assert-langtoggle.mjs` — 言語切替の allowlist と往復
8. `node assert-review-quality.mjs` — 口コミの品質判定。**本物の投稿が長さで弾かれないこと**と、
   同じ判定を持つ**5か所（`submit-review.html` / `en/submit-review.html` / `mail-bot/admin-notify.mjs` /
   `mail-bot/delete-review.mjs` / `supabase/functions/notify-admin/index.ts`）が同じ答えを返すこと**を確かめる。
   コピーを持たず各ファイルから実体を切り出して動かすので、1か所だけ直すと落ちる
9. `node assert-translate-review.mjs` — 口コミ自動翻訳（`translate-review`）の形の検証。
   モデルが指示と違う形（配列・コードフェンス・前後に説明文）で返しても壊れないこと、
   原文の言語判定が比率で効くこと（英語の本文に地名が1語混じっても `en` のままであること）、
   訳文から数字が落ちたのを拾えること。**ネットワークも API キーも使わない**。
   [supabase/functions/translate-review/index.ts](supabase/functions/translate-review/index.ts) を
   Node 24 の `.ts` 直読みでそのまま import するので、本体を直すとここも一緒に動く。
   **鍵が死んだときに管理者へ知らせる判定（`isFatalKeyError`）も見る。**
   これは `translate-review` と `parse-payslip` の2つが同じものを持つので、
   両方から実体を import して同じ答えを返すか突き合わせる（片方だけ直すと落ちる）
10. `node db/test-announce.mjs` — 会員へ出すお知らせメール（[mail-bot/announce-mail.mjs](mail-bot/announce-mail.mjs)）の検査。
   **金額・会社名・明細の項目名が1つも入らないこと**と、
   本文の主張がサイトの実装とずれていないこと（解放「90日」＝`db/pay-reports.sql`、
   項目の見出し＝`pay-report.html` の `renderResult`）を突き合わせる。
   pay-report の文言を変えるとここが落ちる。ネットも鍵も使わない
11. `node assert-conditions.mjs` — 給与レポート直後の待遇モーダルが約束どおり閉じられるか。
   通常ログインでは出ない／× ・背景・ESC のどれでも閉じる／閉じても下のページが残る／
   1問ごとに保存され、1問目で閉じても答えた分は残る／× のときは**見せていた1問だけ**
   スキップとして残す（見せていない残りは記録しない）／初回3問・2回目1問でその次は出ない。
   Supabase を丸ごと差し替えて本物の [pv-conditions.js](pv-conditions.js) を描くので、
   **localhost が要る。本番の DB には触らない**（見た目は `node shot-conditions.mjs` が撮る）
12. `node assert-referral.mjs` — 招待（データ密度ループ）の約束。
   **同じ区分に2人以下しか居ないとき、画面に数字が1文字も出ないこと**、3人・4人のときだけ
   「あと2人／あと1人」が出ること、5人そろったら招待の導線が消えること、
   `?ref=` が Google ログイン・6桁コード・言語切替をまたいで残ること、
   待遇モーダル（`[data-pvc]`）と重ならないこと（こちらは本物のモーダルを作らない）。
   招待された人の着地は**画面の中央に出る1枚**だが、`position:fixed` でも `role="dialog"` でもなく
   `absolute` の 100vh。**スクロールを止めない・nav を覆わない・閉じ方が3つある**
   （× ／ カードの外 ／ ESC）ので閉じ込めが起きない。ここを本物のモーダルにすると落ちる。
   **送る文面に VISION（PILOT VALUE を名乗る／職業の価値／完全匿名／タグライン）が入っていること**も見る。
   ここは招待された人がサービスを見る唯一の入口で、「便利なサイトがある」だけの文面に戻すと落ちる。
   文面に勤務先名・金額・自分のレポートURLは入れない（変種を足すと勤務先名が入る道が生える）。
   **マイページ（`profile.html`）の常設入口が条件に関係なく出ること**も見る。
   給与を1件も出していない人にも・5人そろっている人にも出て、
   人数（招待した数・成立数・残り何人）は1文字も出さない。
   ここが消えると「招待したい」と思った人の行き先がサイトから無くなる（2026-08-19 に実際そうなっていた）。
   ⚠️ 偽物 Supabase の `rpc` は本物と同じ「then だけを持つ箱」。async に戻さない。
   **localhost が要る。本番の DB には触らない**（見た目は `node shot-referral.mjs` が撮る）
13. `npm run test:sql` — Supabase 側を触った場合。
   [db/test-referrals.mjs](db/test-referrals.mjs) もここで走る
   （紹介者は一生1人・自己招待が通らない・2人以下の区分では数字を返さない）。
   [db/test-pay-rows.mjs](db/test-pay-rows.mjs) もここ
   （1行＝1人の読み出し口。k≧5・準識別子ゼロ・p10-p90 クリップ・有効数字2桁・30日遅延の5つ）
14. `node assert-no-pii.mjs` — オーナーの身元が漏れていないか（下記「公開リポジトリであること」を参照）。
   6つの検査がある: A) 追跡テキスト（`.svg` 含む）の中身 B) 画像・PDF のメタデータ（GPS と作者欄）
   C) 本番で配信される拡張子のホワイトリスト D) git の作者（メール **と表示名**・設定と履歴の両方）
   E) 本番プローブ（`--live` のみ） F) **git 履歴の中身**（`--history` のみ）。
   push 後にもう一度 `node assert-no-pii.mjs --live` を走らせる。
   **`.githooks/pre-commit` から毎回自動で走るので、通常は意識しなくてよい**（下記の初回セットアップが要る）。
   ⚠️ **A) が通ることは「履歴が綺麗」を意味しない。** A) は今のファイルしか見ない。
   公開リポジトリでは過去のコミットも `raw.githubusercontent.com/<org>/<repo>/<古いSHA>/<ファイル>`
   で誰でも取れる。2026-08-09 に絶対パスを全部消して A) は 0 件になったのに、
   **履歴には実名が残ったままで実際に外から取れていた**（2026-08-20 に F) を足して発見）。
   履歴を触ったとき・公開する前・Mac を替えたときは `--history` を手で走らせる
   （毎回の commit では重いので走らせない）。
   見つかっても**その行を直して commit しても消えない**。直し方はリポジトリの作り直しだけ
15. `node assert-header.mjs` — ヘッダーが幅ごとに正しく畳まれるか（日英6ページ × 7幅）。
   ヘッダーは Tailwind の `md:` で出し分けるのをやめ、**[search.js](search.js) が実測して自動で畳む**。
   `.pv-nav-links` / `.pv-nav-right` / `.pv-nav-2nd` / `.pv-nav-cta` は**JS が付ける目印**なので、
   HTML 側に `md:` を書き足しても効かない。畳む順は ① 真ん中のリンク群 → ② ログイン・← 戻る →
   ③ CTA（CTA が最後まで残る。消えるときは引き出しの先頭に金色で入る）。
   見るのは、はみ出さない／2行に折れない／隣どうしが 20px 未満に近づかない／
   ≡ は畳んだときだけ出る／CTA が黙って消えない／
   引き出しに**そのページのリンクが入り、国別年収は入らず、口コミへ行ける**こと。
   ⚠️ `scrollWidth` では測れない（文字が折れて逃げるあいだ増えないので入っていないことが分からない）。
   **localhost が要る**（見た目は `node shot-header.mjs` が撮る）
16. `node assert-admin.mjs` — 管理者ページが「ログインした管理者にしか見えない」こと。
   2026-08-20 まで `admin.html` は合言葉をページ本文に持っていて、しかも画面から `profiles` を
   直接読んでいた。**ページは誰でも読めるので合言葉は最初から公開されていたのと同じ**で、
   開発者ツールから会員の氏名・メール・生年月日・在籍企業が全部取れた。
   直した形は「ページは合言葉を持たない／管理者かはサーバーが答える（`pv_is_admin`）／
   一覧は `admin_list_profiles` `admin_list_reviews` からしか来ない」。
   見るのは、日英2ページに合言葉・パスワード欄・`from('profiles')` が残っていないこと、
   [db/admin.sql](db/admin.sql) が名簿・入口・`profiles` の締めを全部持っていること、
   実際に開いて ①ログアウト ②管理者でない ③管理者 ④SQL 未適用 の4通りが正しく分かれること。
   ⚠️ **DB 側が本体。** `db/admin.sql` を Supabase で流すまでページだけ直っても意味が無い
   （anon キーは全ページに埋まっていて回せないので、RLS で締める）。
   **localhost が要る。本番の DB には触らない**（Supabase ごと差し替える）

17. `node assert-unlock.mjs` — **2つの鍵が混ざらないこと**。
   口コミを1件出すと「全社の口コミ」が読める（2026-08-22 に**期限を外した**＝ずっと読める）。
   給与明細を1枚出すと「年収データ」が90日読める。**この2つは別々の鍵で、口コミの鍵で年収枠は開かない。**
   昔あった引き継ぎ（`grandfatherSalaryUnlock` — 口コミの鍵の期限を年収の鍵に書き写す）は削除済み。
   これが復活すると**口コミ1件で年収データがずっと開く**ので、①がそれを見張る。
   見るのは、口コミの鍵だけ持つ人・サーバー側に口コミがある人・明細だけ出した人の3通りで
   年収枠と口コミ枠が正しく分かれること、口コミの鍵を書く**9か所すべて**が
   `pv-session.js` の `PVUnlock.reviewUntil()`（＝遠い未来）を使っていること
   （増やしたら未知の書き手として落ちる）、年収側は今も90日で `access_until` 由来であること、
   そして**画面・メール・SEO の元表に「30日／1ヶ月」の約束が1つも残っていないこと**（日英）。
   ⚠️ 文言を消す一括スクリプトは [patch-unlock-wording.mjs](patch-unlock-wording.mjs)（42か所・冪等・`--check` あり）。
   本物の30日／1ヶ月（台湾のホテル・IPハッシュの保持・預かり証・ログイン最長・退会後の削除・
   有給15〜30日・口コミ本文の引用）は消さない。除外は同スクリプトと `assert-unlock.mjs` の `ALLOW` に理由つきで置く。
   **localhost が要る。本番の DB には触らない**（Supabase ごと差し替える。見た目は `node shot-unlock.mjs` が撮る）

18. `node assert-admin-notify.mjs` — 管理者への通知メール（[notify-admin](supabase/functions/notify-admin/index.ts)）の検査。
   1本の Edge Function が**6つの表**を捌く（口コミ／新規会員／問い合わせ／給与レポート／
   登録前の預かり／待遇アンケート）。見るのは6つ:
   ① **給与まわりのメールに金額・明細の項目名が1文字も出ないこと。**
     給与レポートは `user_id` を持たない設計で「誰がいくら」を運営側に残さない（[db/pay-reports.sql](db/pay-reports.sql)）。
     メールに載せると受信箱と Resend の送信ログに残る＝設計で守ったものを送信で外に出す。
     待遇の金額回答と自由記述（スキーマが「非公開」と書いている列）も同じ扱い
   ② **`builders` の顔ぶれと [db/notify-admin-webhooks.sql](db/notify-admin-webhooks.sql) の表の配列が一致すること。**
     いちばん静かな壊れ方はこれ。片方だけ足すと実装は正しく見えるのに一通も届かない
   ③ 待遇の**スキップの行では送らない**こと（スキップも本物の行として保存されるので、
     飛ばすたびに中身の無いメールが飛ぶ）
   ④ 「明細から／手入力」の言い方が [db/usage.mjs](db/usage.mjs) と揃っていること
   ⑤ 待遇の**累計（n / 32問）を数えられなくても通知そのものは落ちない**こと。
     累計はおまけで、値打ちは「どの質問にどう答えたか」の側にある。
     数えられないときは行ごと省く（「0 / 0問」のような嘘の数字を出さない）
   ⑥ **`db/notify-admin-webhooks.sql` が壊れていないこと**（`$$` が対・確認クエリが1つだけ）。
     オーナーが Supabase に貼るまで構文エラーに気づけないので、ここで見る
     （上の「新しいスクリプトを書く前に」の `String.replace` の罠を参照）
   本体（`.ts`）を Node 24 の直読みでそのまま import し、`fetch` だけ差し替える。
   **ネットも鍵も localhost も使わない**

19. `node assert-pay-rows.mjs` — 「他のパイロットの実給与」（[actual-pay.html](actual-pay.html)）の検査。
   この画面は**1行＝1人**の匿名レポートを出す。行を数えれば n≧5 の区分の人数は読めるので、
   守りは ①k≧5 の門 ②準識別子を1つも出さない ③p10-p90 クリップ ④有効数字2桁 ⑤30日遅延 の
   5つに全部かかっている（理由は [db/pay-rows.sql](db/pay-rows.sql) の契約ヘッダ）。見るのは:
   - **鍵の無い人に金額が1文字も出ない**（サーバー側で止める。画面のモザイクではない）
   - **1件も無いときに公開情報（青）だけが出て、実給与（オレンジ）と混ざらない。**
     ①と②から1つの数を作る計算を書かない（差分・平均・%も含めて）
   - 表示中の**すべての金額が表示通貨で有効数字2桁**
   - 基地コード・在籍年数・年代・投稿月・原本通貨・契約形態が1つも出ない
   - **金額での並べ替えと「✓ Verified だけ」の絞り込みが無い**
     （前者はこの画面をランキングにする。後者は絞った行数＝検証済み人数という生カウントになる）
   - 合計件数・カバー社数・「直近30日で +X件」を出さない（会員規模そのものが漏れる）
   - 通貨を切り替えても **RPC を引き直さない**（データは手元に持って描き直すだけ）
   - **サイドバーが8枚（4画面 × 日英）で1バイトも食い違わない**
   ⚠️ サイドバーを配るのは [patch-side-nav.mjs](patch-side-nav.mjs)。**HTML に手で項目を足さない**
   （`--check` で書かずに差分だけ見られる）。
   **localhost が要る。本番の DB には触らない**（Supabase ごと差し替える。見た目は `node shot-actual-pay.mjs` が撮る）

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
git config core.hooksPath .githooks     # commit のたびに assert-no-pii.mjs が走るようにする
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
