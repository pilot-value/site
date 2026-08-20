# DATA-PROVENANCE.md — データの出所と来歴

**この文書が答える問い：「この数字はどこから取得したのか？」**

Pilot Value のデータは、性質の異なる2つの層でできている。
片方は公開情報を集めた参考値、もう片方はパイロット本人が投稿した一次データ。
この2つを混ぜないこと、そしてどちらもいつでも出所を辿れることが、この文書の目的である。

将来 Pilot Value が第三者の審査（デューデリジェンス、法務レビュー、報道の照会）を受けたとき、
この文書と台帳だけで「どの数字がどこから来たか」に答えられる状態を維持する。

関連文書: [VISION.md](VISION.md)（何を作るか）/ [VERIFIED-PILOT.md](VERIFIED-PILOT.md)（一次データの検証設計）/
[CLAUDE.md](CLAUDE.md)（作業ルール）

---

## 1. データ区分（`source_type`）

出所は必ずこの語彙のどれかに分類する。分類できないものは採用しない。

| `source_type` | 意味 | 層 |
|---|---|---|
| `official_package` | 航空会社が自ら公表した報酬パッケージ | 公開情報 |
| `published_pay_scale` | 公開されている給与等級表（実額が載っているもの） | 公開情報 |
| `regulatory_filing` | 有価証券報告書・사업보고서・年次報告書などの法定開示 | 公開情報 |
| `union_cba` | 労働組合の労働協約・CBA・組合が公表した pay scale | 公開情報 |
| `government` | 政府・公的統計（賃金構造基本統計調査、BLS 等） | 公開情報 |
| `job_posting` | 航空会社公式の求人票に記載された条件 | 公開情報 |
| `third_party_reference` | 給与まとめサイト・報道・二次情報 | 公開情報 |
| `community_reference` | フォーラム・口コミサイト・SNS | 公開情報 |
| `manual_report` | Pilot Value ユーザーによる手入力の給与データ | **一次データ** |
| `payslip_derived` | 給与明細のパースから得たデータ | **一次データ** |

`regulatory_filing` と `government` を独立させているのは、日本・韓国の給与データが
有報／사업보고서に強く依存しているためである。これらを `third_party_reference` に潰すと、
最も硬い出所と最も柔らかい出所が同じ棚に入ってしまう。

---

## 2. 2つの層は物理的に分離されている

これは方針ではなく、現状すでにそうなっているという事実の記録である。

| | 公開情報の層 | 一次データの層 |
|---|---|---|
| 保管場所 | Git リポジトリ内の静的ファイル | Supabase（PostgreSQL） |
| 数値の正 | [salary-data.mjs](salary-data.mjs) の `SALARY`（112社・万円） | `pay_reports` テーブル |
| 出所の台帳 | [salary-sources.mjs](salary-sources.mjs) の `SOURCES` | 同テーブルの `source` / `verify_level` / `verify_method` / `verified_at` 列 |
| 該当する `source_type` | `official_package` 〜 `community_reference` | `manual_report` / `payslip_derived` |
| 生成物 | `salary-data.json`（[gen-salary-json.mjs](gen-salary-json.mjs) が書き出す） | — |

**したがって「第三者由来のデータをすべて除外してください」という要件が来ても、
公開情報の層を丸ごと削除して一次データベースは無傷で残せる。** 手順は本文書 6. に書く。

一次データ側の検証設計（`verify_level` 0–3 をどう付与するか、なぜ
`submit_pay_report` の `source` 申告で付与してはいけないか）は
[VERIFIED-PILOT.md](VERIFIED-PILOT.md) に詳しい。本文書では扱わない。

---

## 3. 混ぜない

**「公開情報に載っている報酬条件」と「パイロットが実際に受け取った額」は別の概念である。**
理由なく同じ中央値・同じ分布へ混ぜない。

- 集計値を出すときは、含めた `source_type` を必ず定義する
- 公開情報由来の数値を「Pilot Value 独自データ」として表示しない
- 第三者由来の数値に Verified バッジを付けない（[VERIFIED-PILOT.md](VERIFIED-PILOT.md)）

### ⚠️ my-value.html 段4 への拘束条件

[my-value.html](my-value.html) の段4「公開情報パーセンタイル」は未実装。実装するとき、
`SALARY`（公開情報）から作るパーセンタイルと、`pay_reports`（本人投稿）から作る分布を
**同一の分布として合成してはいけない。** 別々に出し、それぞれ何を母集団としているかを画面に書く。

これは事後に直すのが最も高くつく種類の間違いである。合成した数字を一度でも
ユーザーに見せてしまうと、後からどちらの層に属していたかを遡って分離できない。

---

## 4. 信頼の優先順位

同じ会社について複数の出所があるとき、上ほど優先する。

1. 航空会社の公式情報（`official_package`）
2. 労働組合の協約・CBA（`union_cba`）
3. 法定開示（`regulatory_filing`）／政府・公的統計（`government`）
4. 航空会社の公式求人（`job_posting`）
5. 正式にライセンスされた情報
6. Pilot Value ユーザーの手入力（`manual_report`）
7. Pilot Value の給与明細由来（`payslip_derived`）

一次データが十分に貯まったら、公開情報由来を検証・置き換えの対象とする。
ただし 6. と 7. が上位を「上書きする」のではない。**別の層として並べる**（3. の通り）。

---

## 5. 外部の deep research を使うときの規則

初期フェーズでは、市場調査・出所の発見のために Web 調査や外部 AI の deep research
（ChatGPT / Gemini 等）を使ってよい。ただし次を守る。

### 取りに行くのは「金額」ではなく「領収書」

年収の数値は既に [salary-data.mjs](salary-data.mjs) にある。足りないのは出所である。
deep research に金額を出させると、二次情報の推計が一次資料のふりをして混入し、
この作業の目的が壊れる。

### プロンプト雛形

> 対象＝〇〇航空のパイロット報酬。**推計や要約は不要。一次資料の所在だけを返せ。**
> 有価証券報告書／사업보고서／労働組合の協約書（CBA・pay scale）／政府統計／
> 会社公式の求人票 に限る。各件について
> `source_type / 資料名 / URL / 発行日 / 該当箇所の原文引用 / その資料に書かれている数値（原通貨・原単位のまま）`
> を返せ。**該当箇所を引用できない資料は返すな。**
> 二次情報（給与まとめサイト、フォーラム、ニュース記事の孫引き）は
> `third_party_reference` と明示して分けろ。

### 台帳に `status:'in_use'` として載せる条件

1. `node check-sources.mjs --online` で URL が実際に 200 を返す
2. 引用がその資料に実在する（**1件ずつ確かめる。外部 AI は実在しない引用を作る**）
3. 資料の数値が `SALARY` のレンジ `lo`–`hi` に入っている

3 を満たさない場合も **`SALARY` を書き換えない。** `status:'candidate'` のまま残し、
`note` に差分を書く。数値の変更は [workflows/update-salary.md](workflows/update-salary.md)
の手順で別途判断する（ここで数値を動かすと `check-salary.mjs` が110ページ分落ちる）。

**条件2は PDF なら機械で満たせる。** [read-source-pdf.mjs](read-source-pdf.mjs) が
原本から本文と表を取り出す（外部依存なし。この Mac に poppler は無い）。
**表を読むときは必ず `--pos` を付ける。** 平文の順に読むと列が混ざる — 実例として
Delta MEC の契約比較 p.25 は3社が横に並ぶ表で、平文だと同じ行に `$373.33` と `$375.28` が
現れてどちらがどの社か分からない。`--pos` なら x 座標で列（＝社）を確定できる。

### ⚠️ 単位が違う資料は「レンジを支える」までしか言わない

条件3 は資料と `SALARY` が同じ単位のときにしか判定できない。
米国の組合資料は**時間あたり料率**、`SALARY` は**年収（万円）**で、直接は比較できない。
年収換算には「年間乗務時間」と「ドル円」の2つの仮定が要る。

- **台帳では換算しない。** `value_orig` は原通貨・原単位のまま書く（2. の原則）
- こういう資料が支えるのは**レンジ `lo`–`hi` の側**であって `avg` ではない。
  `avg` はフリート全体・全年次の平均推計なので、特定年次・特定機種の料率からは出ない
- **`note` に「この資料が支えるのはどこか」を明記する。**
  これを書かないと、DD で「この avg の根拠は？」と聞かれたときに
  台帳が根拠を示しているように見えて実は示していない、という最悪の形になる

### 第三者サイトを調べるときの制限

- 認証・Paywall・CAPTCHA などの技術的アクセス制限を意図的に回避しない
- 相手サイトに過度な負荷をかけない
- 非公開情報・個人のプライベート情報を意図的に収集しない
- 文章を必要以上に複製しない。**事実・数値の抽出を優先する**
  （海外口コミの扱いは [CLAUDE.md](CLAUDE.md) の「口コミ・海外評判のコンテンツルール」に従う）

### ⚠️ 原本 PDF をリポジトリに置かない

このリポジトリは **public、かつ `main` が GitHub Pages としてルート配信されている**
（[CNAME](CNAME) = pilot-value.com）。[robots.txt](robots.txt) は全許可。
資料を commit した瞬間 `https://pilot-value.com/…` で誰でもダウンロードでき、検索にも載る。

- Git に入れるのは**台帳（`salary-sources.mjs`）だけ** — URL・発行日・取得日・短い引用
- 原本 PDF/HTML は `sources-raw/`（`.gitignore` 済み）に置く
- 原本は iCloud Drive の `Claude-Backup` へ退避する（`backup-claude.command`）

有報のような公開文書の再配布自体は問題ないが、再配布できない協約書が1枚混ざるだけで事故になる。
判定を個別にやらずに済むよう、**原本は一律でリポジトリの外**とする。

---

## 6. 第三者由来データの除去手順

「第三者由来のデータをすべて除外してください」という要件が発生した場合。

```bash
# 1. 公開情報の層を落とす（数値・出所台帳・生成物・依存ページ）
rm salary-data.mjs salary-sources.mjs salary-data.json

# 2. 影響範囲を確認する（静的ページ側の年収表示が全て落ちる）
node check-salary.mjs        # 落ちる。これが「公開情報の層が消えた」ことの確認になる
```

このとき Supabase の `pay_reports`（`manual_report` / `payslip_derived`）は**一切影響を受けない。**
静的サイトのビルドプロセスに DB は関与せず、DB 側も静的ファイルを参照していない。

より穏当な運用として、台帳の `status` を `rejected` に落とせば
`check-sources.mjs` が「出所を失った社」として列挙し続ける。全削除の前にこちらを使う。

---

## 7. 台帳の使い方

出所の記録は [salary-sources.mjs](salary-sources.mjs) の `SOURCES`。
`SALARY` と同じ slug をキーにした配列で、1エントリ＝1資料。

数値を更新するときは [workflows/update-salary.md](workflows/update-salary.md) の手順に従い、
**数値と出所を同じコミットで入れる。** 数値だけ変えて出所を残さないのが最も起きやすい事故で、
それが積み重なると本文書が答えるはずの問いに答えられなくなる。

検証は `node check-sources.mjs`（構造・語彙・孤児キー・出所ゼロの検出）と
`node check-sources.mjs --online`（URL の生存確認）。
