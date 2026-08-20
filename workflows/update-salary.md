# 年収データを更新する

## 目的
[salary-data.mjs](../salary-data.mjs)（唯一の正）の年収を変更し、サイト全体の表示をそこに一致させる。

## いつ使うか
- ある航空会社の機長平均 / 副操縦士平均 / レンジを変えるとき
- 新しい航空会社を `SALARY` に追加したとき
- 出典を更新して数値を見直したとき

## 前提
- 単位は**万円**（`¥1万 = 10,000円`）
- `avg` はフリート全体の平均推計であって最上位額ではない。`lo` / `hi` がレンジ
- `salary-data.json` は生成物。**手編集しない**
- 生成スクリプト（`gen_*.mjs` / `generate_*.mjs`）は**絶対に実行しない**。日本語版の生成スクリプトは年収を自前でハードコードしており、実行すると SSOT で更新した数値が古い値へ巻き戻る

## 使うツール
| ツール | 役割 | 変更するか |
|---|---|---|
| `gen-salary-json.mjs` | `salary-data.json` を書き出す | する |
| `patch-site-salaries.mjs` | `index.html` のランキング配列（21社）に反映（冪等・再ソートと pct 再計算込み） | する |
| `check-salary.mjs` | 全 `airlines/*.html` × SSOT の整合を検証 | しない |
| `check-sources.mjs` | 出所台帳 `salary-sources.mjs` の整合を検証（`--online` でURL生存） | しない |
| `read-source-pdf.mjs` | 出所資料の PDF から本文・表を読む（表は `--pos` 必須） | しない |
| `audit-en-salary.mjs` | 英語ページの数値ドリフトを報告 | しない |
| `assert-jp.mjs` / `assert-currency.mjs` | 通貨表示の回帰テスト（localhost 必須） | しない |

---

## 手順

### 1. 唯一の正を編集する
[salary-data.mjs](../salary-data.mjs) の `SALARY` で対象の slug を書き換える。

**変更前の値をメモしておく。** 手順4と6で必要になる。

### 1-b. 出所を台帳に記録する（数値と同じコミットで入れる）
[salary-sources.mjs](../salary-sources.mjs) の `SOURCES[slug]` に、その数値の根拠になった資料を足す。
`source_type` / `name` / `url` / `accessed_at` / `value_orig`（原通貨・原単位のまま）/ `quote` を書く。

- 引用を確認できていないうちは `status:'candidate'` のまま置く。`in_use` は現物を確認してから
  （PDF なら `node read-source-pdf.mjs sources-raw/xxx.pdf <ページ> --pos`。**表は `--pos` 必須**。
  平文の順に読むと列が混ざり、他社の数値を自社の根拠として書いてしまう）
- **単位が違う資料は「レンジを支える」までしか書かない。** 米国の組合資料は時間あたり料率で、
  `avg`（年収・全年次平均）の根拠にはならない。何を支える資料なのかを `note` に明記する
- **資料が SSOT と食い違っても、ここで数値を書き換えない。** `note` に差分を書いて手順1へ戻る
- 原本 PDF は `sources-raw/`（gitignore 済み）へ。**リポジトリに commit しない**
  （public + GitHub Pages のルート配信なので、そのまま公開されてしまう）

方針の本文は [DATA-PROVENANCE.md](../DATA-PROVENANCE.md)。
**数値だけ変えて出所を残さないのがこの工程で最も起きやすい事故で、**
それが積み重なると「この数字はどこから？」に答えられなくなる。

### 2. JSON を再生成する
```bash
node gen-salary-json.mjs
```
→ `✅ salary-data.json 書き出し: 110 社 ／ 背骨 8 段`

### 3. トップページのランキングに機械反映する
```bash
node patch-site-salaries.mjs
```
`index.html` の `captainData` / `foData` が更新され、順位と pct が再計算される。冪等なので何度実行してもよい。

**この配列は上位21社だけ。** 対象社がランキング外なら何も出力されない（`fda` 等）。それが正常。

> **`world-airlines.html: 0 rows updated` は毎回出る。異常ではない。**
> このスクリプトの world-airlines 分岐は `{... file:'airlines/xxx.html' ... salary:'...'}` という
> 静的な配列を書き換える設計だが、その配列は既に存在しない（サラリーエンジン導入時に、
> `airlines-meta.js` / `salary-leveling.js` が `salary-data.json` を実行時 fetch する方式へ移行した）。
> world-airlines.html には `¥N,NNN万` の文字列が**0件**で、**工程2でカバー済み**。
> この分岐は現在デッドコード。

### 4. 個社ページを更新する（⚠️ 最も事故る工程・機械化されていない）

**この工程を担うスクリプトは存在しない。手作業で置換する。**

そして数値は当該社のページだけに無い。**比較記事や他社ページにも散っている。**
実例として ANA の `2,700万` は **23ファイル**に出現する（`ana.html` 内だけで 22箇所、
`ana-vs-jal.html` / `emirates.html` / `gaishi-vs-nikkei.html` など他社ページにも）。

必ず全体を洗い出してから置換する：

```bash
# 旧値の出現箇所を全て洗う（man 形式 = カンマ区切り + 万）
grep -rn "2,700万" airlines/*.html index.html world-airlines.html
```

- 表記ゆれ（`¥2,700万` / `2,700万円` / `2,700万`）は**すべて基底の `2,700万` を含む**ので、
  `2,700万` → `2,800万` の置換1回で3種とも直る
- meta description、og:description、JSON-LD の `headline` と FAQ の `acceptedAnswer`、
  本文の全てに入っている。**本文だけ直して meta と JSON-LD を忘れやすい**
- 他社ページの記述は文脈付き（「ANAは2,700万円（課税後）」等）。機械置換後に文意が壊れていないか読む

置換後、取りこぼしゼロを確認：
```bash
grep -rn "2,700万" airlines/*.html index.html world-airlines.html   # 0件になるはず
```

### 5. 整合を検証する
```bash
node check-salary.mjs
```
→ `111 pass · 0 warn · 0 fail (of 111)` と `✅ salary-data.json: ... == buildSalaryJson()`
（社数は [salary-data.mjs](../salary-data.mjs) の件数。増えていれば増えた数で出る）

> **終了コードは信用してよい。** [check-salary.mjs:180](../check-salary.mjs#L180) が
> `if (!js.ok || fail || nBad) process.exitCode = 1;` なので、ページ側の `fail` も
> クロスチェックの `❌` も落ちる。`&&` の連鎖に入れてよい。
> ただし **`⚠️` は終了コードに出ない**（レンジ内だが節目でない＝要目視）。出力は必ず読むこと。
>
> ※ かつてここには「終了コードを信用するな」と書いてあった。`768fccd` で
> `if (!js.ok)` → `if (!js.ok || fail || nBad)` に直っており、その記述はもう誤り。

### 6. 旧値を STALE に登録する
[check-salary.mjs](../check-salary.mjs) の `STALE` 定数に、そのページの旧数値を追加する。

```js
const STALE = {
  'skymark': ['2,900万', '2,400万'],
  'ana':     ['2,700万'],   // ← 今回の旧値を足す
};
```

**これをやらないと取り残しを二度と検出できない。** `check-salary.mjs` は
「新しい数値が存在するか」しか見ないので、ページに旧数値が同居していても pass する。

### 7. 英語版を確認する
```bash
node audit-en-salary.mjs
```
報告のみで**変更はしない**。ドリフトが出た `en/airlines/{slug}.html` は手作業で直す
（英語ページは `¥37M` のような百万円単位表記。`3,700万` = `¥37M`）。

### 8. 表示の回帰テスト
```bash
node serve.mjs        # バックグラウンドで起動（すでに動いていれば不要）
node assert-jp.mjs
node assert-currency.mjs
```
金額の書き方を変えた場合のみ `node assert-langtoggle.mjs` も回す。

---

## 完了条件
- [ ] `node check-salary.mjs` が `0 fail` かつ `salary-data.json` 一致（**出力を目視**）
- [ ] `node check-sources.mjs` が `❌0`（出所を足した回は `--online` でURLの生存も確認）
- [ ] 旧値の `grep -rn` が 0 件
- [ ] `STALE` に旧値を登録済み
- [ ] `node audit-en-salary.mjs` にドリフト無し
- [ ] `assert-jp.mjs` / `assert-currency.mjs` が pass
- [ ] オーナー承認を得てから `main` へ push

## エッジケース
- **`salary-data.json` を直接編集してしまった** → `check-salary.mjs` が
  「`salary-data.mjs` と不一致」を出して `exitCode 1`。`node gen-salary-json.mjs` で再生成すれば直る
- **新しい航空会社を追加した** → `airlines/{slug}.html` がまだ無いので `check-salary.mjs` が
  `❓ page not found` を warn で出す。**この場合は [workflows/add-airline.md](add-airline.md) を使う**
  （ページを置かないと国別ページから 404 リンクが生える）
- **レンジ（`lo` / `hi`）だけ変えた** → `check-salary.mjs` は `avg` しか見ないので pass してしまう。
  レンジはページ本文とレベリング図（`salary-leveling.js`）の表示を目視で確認する
- **`avg` を変えて順位が入れ替わった** → `patch-site-salaries.mjs` が自動で再ソートするが、
  本文に「業界2位」等と書かれていれば手作業で直す

## この手順書のメンテ
- **工程4が手作業なのは**、日本語版ページの年収が生成時にハードコードされたまま SSOT 化されていないため。
  機械化するなら `airlines/*.html` を `SALARY` から更新する冪等スクリプトが要る（未着手）。
  着手したらこの手順書を更新すること。
- **`patch-site-salaries.mjs` の world-airlines 分岐はデッドコード**（工程3参照）。
  消すと `0 rows updated` の紛らわしい出力が無くなるが、動作に害は無いので今は放置している。

---
*この手順書は 2026-08-07 に実データで通して検証済み。`fda` の `cap.avg` を 1600→1601 に変え、
工程4を意図的に飛ばして `check-salary.mjs` が `❌ fda missing: CAP(1,601万)` を出すことを確認した。*

*2026-08-08 追記：そのとき「終了コードは 0 になる」と書いたが誤り。`768fccd` で
`fail`／`nBad` も `process.exitCode = 1` を立てるようになっていた（工程5の注記を修正済み）。*
