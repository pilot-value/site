# 航空会社を1社追加する

## 目的
新しい航空会社を [salary-data.mjs](../salary-data.mjs)（唯一の正）に足し、
日本語版・英語版のページを起こして、サイト全体（国別ページ・検索・投稿フォーム・sitemap・OG画像）に行き渡らせる。

## いつ使うか
- 掲載社を増やすとき
- [workflows/update-salary.md](update-salary.md) が「本手順の範囲外」として投げている
  「新しい航空会社を追加した」ケース

## 前提

### ⚠️ SSOT だけ足してページを置かないのは禁止
`gen-countries.mjs` が国別ページから `airlines/{slug}.html` へリンクを張る。
ページが無ければ**404 リンクが増える**。SSOT とページは必ず同じコミットで出す。

### ⚠️ 生成スクリプトを再実行しない
`gen_asia.mjs` / `gen_europe.mjs` / `gen_americas.mjs` / `gen_mideast_africa.mjs` /
`generate_airlines.mjs` / `gen_en_airlines.mjs` は [CLAUDE.md](../CLAUDE.md) の禁止リスト。
110社を丸ごと上書きするうえ、年収を SSOT ではなく自前でハードコードしている。
1社足すために流すと、更新済みの数値が全社ぶん巻き戻る。
**この手順では [gen-new-airline.mjs](../gen-new-airline.mjs) を使う。**

### 数字を作らない
`avg` / `lo` / `hi` は出典のある数値から作る。推測で埋めない（[VISION.md](../VISION.md)）。
根拠が弱いなら `conf:'low'` を付け、**何を仮定したかを SSOT のコメントに書く。**
根拠が「弱い」のと「無い」のは別。無いなら入れない。

---

## 手で足す6箇所

残りはパイプラインが拾う。**この6つ以外を手で編集しない。**

| ファイル | 中身 |
|---|---|
| [salary-data.mjs](../salary-data.mjs) | `ja / en / region / cap{avg,lo,hi} / fo{avg,lo,hi} / taxFree / conf`。単位は**万円** |
| [airline-countries.mjs](../airline-countries.mjs) | `'asiana': 'KR'` の1行 |
| [airlines-meta.js](../airlines-meta.js) | 一覧・レベリング図用。`code / color / flag / type / alliance / salary`。⚠️ `salary` はハードコードなので SSOT と手で揃える |
| [search.js](../search.js) | サイト内検索。`t:[...]` に IATA / ICAO / ひらがな / 国名を入れる |
| `submit-review.html` / `pay-report.html` の**日英4枚** | 投稿フォームの `<option>`。日英の `submit-review.html` にはラベル辞書もある |
| [gen-new-airline.mjs](../gen-new-airline.mjs) の `CONTENT[slug]` | ページ本文。下記「本文の書き方」 |

**自動で入る（手で触らない）:**
[lang-toggle.js](../lang-toggle.js) の EN allowlist（`gen-en-manifest.mjs` が `en/airlines/` を走査）、
`airline-codes.json` / `db/airlines.generated.sql` / [pv-reunlock.js](../pv-reunlock.js) の FALLBACK_CODES
（`gen-airline-codes.mjs`）、`salary-data.json`、`index.html` のランキング配列、
国別ページ、FAQ、`<!--PV-CLINK-->`、`sitemap.xml`。

**任意:** [airline-logos.js](../airline-logos.js) ＋ `assets/airline-logos/{slug}.svg`。
無ければモノグラムに自動フォールバックするので必須ではない（実ロゴを置くのが望ましい）。

---

## 手順

### 1. SSOT に追加する
[salary-data.mjs](../salary-data.mjs) の `SALARY` に1行。既存行と列を揃える。

**仮定を置いたなら、その上のコメントブロックに全部書く。** 実例（アシアナ航空）:
出典の年・元の数字・換算レート・置いた仮定2つ・按分の計算・検算・反証・`conf` を下げた理由・
数値の見直し期限。**あとから読んで再現できないコメントは書いた意味が無い。**

### 2. 残り5箇所を足す
上の表のとおり。投稿フォーム4枚は、既に `<option>` があれば飛ばす**冪等なスクリプト**で足す
（同じ社を二重に入れない）。

### 3. 本文を書いて日英ページを起こす

[gen-new-airline.mjs](../gen-new-airline.mjs) に `CONTENT[slug]` を追加してから：

```bash
node gen-new-airline.mjs asiana
```
→ `✅ airlines/asiana.html  19.8KB` / `✅ en/airlines/asiana.html  27.3KB`

**この生成器の作り（守るべき性質）:**
- **年収は `H` ヘルパ経由でしか渡らない。** `CONTENT` 側に生の数字を書く手段が無い。
  この性質を壊さない（既存生成器の欠陥がこれ）
- **既存ファイルには書かない。** あれば skip して報告する（`--force` は通常使わない）
- `donor` に指定した既存ページから head・nav・footer の外枠だけを借り、本文は丸ごと差し替える。
  借り物の本文が1行でも残ると他社の事実が混ざるので、`donorTokens` に書いた語が
  残っていないかを検査して、残っていたら**書かずに落とす**
- `payScaleEn`（等級表）は**公開されている社だけ書く。** 書かなければ節ごと出ない
- `.section-badge` の語はタブ振り分け（[airlines/airline-reviews-ui.js](../airlines/airline-reviews-ui.js) の
  `secSalary` / `secJobs`）と年収の枠の位置の**両方**を決める。
  `概要 / 年収データ / 運航環境 / 訓練環境 / 福利厚生 / 募集要項 / よくある質問` から変えない

**本文は調査して書く。** テンプレの穴埋めで水増ししない。

⚠️ **外部リンクは必ず実物を叩いてから貼る。**
アシアナで `recruit.asiana.com` / `asiana.com` が **200 を返すのに本物でない**（Joken のパーキングドメイン）
ことが分かった。`curl -sI` のステータスだけでは判定できない。**リダイレクト先と DNS まで見る。**
`flyasiana.com/I/KO/RecruitMain.do` のように 200 を返してサイト直下へ黙って飛ばす URL もある。

⚠️ **[currency.js:22](../currency.js#L22) に無い通貨は、レートをページ本文に明記する。**
KRW は入っていないので、アシアナでは `₩1＝¥0.11` を脚注に書いた（先例＝Eurowings の `¥172/EUR`）。

### 4. パイプラインを流す（順序を変えない）

```bash
node gen-airline-codes.mjs && node gen-salary-json.mjs && node patch-site-salaries.mjs && \
node gen-countries.mjs && node gen-faq.mjs && node link-countries.mjs && \
node gen-en-manifest.mjs && node seo-normalize.mjs && node gen-sitemap.mjs && \
node inject-salary-gate.mjs
```

⚠️ **`seo-normalize.mjs` は必ず `gen-countries.mjs` より後。** 順序を変えると PV-SEO 管理ブロックが消える。

⚠️ **`inject-salary-gate.mjs` を忘れない。** 新しいページの年収の詳細を
`premium-gate`（給与明細で90日解放）で包む。流し忘れると、その社だけ年収が最初から丸見えになり
「明細を出す理由」が消える。冪等なので何度流しても同じ。

**1ページに複数の枠を置く。** 包む見出しの組は `inject-salary-gate.mjs` の `groups` に書いてある
（日本語＝`年収データ＋年収推移` / `手取り計算＋機種別データ＋詳細比較` / `手取り比較` / `ANA比較`、
英語＝`Salary Data＋Career Ladder`）。**組の中の見出しは、ページ上で連続していないと1つにまとまらない**
（あいだに別のカードが挟まると、先頭の1枚だけが包まれる）。
新しい種類の年収カードを本文に足すなら、`groups` と
[airlines/airline-reviews-ui.js](../airlines/airline-reviews-ui.js) の `secSalary` を**両方**広げる。
片方だけだと、枠が企業トップのタブに残るか、年収タブが空になる。

⚠️ **初回だけ2周する。** `gen-new-airline.mjs` が `<!--/PV-FAQ-->` の直後に空行を出し、
`gen-faq.mjs` がそれを畳むため、1周目で `en/airlines/{slug}.html` に1行の差分が残る。
**もう1周流して差分が消えることを確認する**（以降は何度流しても差分0）。

### 5. OG画像を焼く（⚠️ 3種類ある。1社ぶんだけでは足りない）

```bash
node gen-og-images.mjs {slug}          # その社の日英2枚
node gen-og-images.mjs default         # 共通カード（「世界112社の」と社数を焼いている）
node gen-og-images.mjs c-{国コード小文字}  # その国のカード（掲載社数・機長平均を焼いている）
```

**`default` と `c-*` を忘れやすい。** 画像は `seo-normalize.mjs` の社数補正が効かないので、
忘れると共通カードが「世界111社」のまま、国カードが「掲載1社」のまま残る
（アシアナ追加時に実際に取りこぼした）。国コードは [airline-countries.mjs](../airline-countries.mjs) の値。

### 6. 検証する

```bash
node serve.mjs                # すでに動いていれば不要。file:/// は開かない
node check-salary.mjs         # 新社が pass・❓ page not found が0・❌0（出力を目視）
node assert-seo.mjs           # 0件
node assert-links.mjs         # 0件（← ページを置き忘れるとここが落ちる）
node assert-jp.mjs
node assert-currency.mjs
node assert-langtoggle.mjs    # allowlist 漏れの検出
```

localhost でスクリーンショットを撮って目視する。**1回撮って終わりにしない。**
**タブの奥は既定では写らない。** `年収データ` と `募集要項` は「年収・給与」「求人情報」タブに
振り分けられるので、`[data-tab="salary"]` / `[data-tab="jobs"]` をクリックしてから撮る。
日本語（ライト／ダーク）・英語の3面を見る。

### 7. Supabase に流す（⚠️ 自動では反映されない）

`gen-airline-codes.mjs` が `db/airlines.generated.sql` を書き直すが、**適用は手動。**
流すまで、**投稿フォームでその社を選んでも保存側で弾かれる。**

**オーナー作業:**
1. `https://supabase.com/dashboard/project/vzgmnkrggrwtsrpqndsm/sql/new` を開く
2. [db/airlines.generated.sql](../db/airlines.generated.sql) を全文コピペして Run
3. 末尾の検算 `有効 N / 全件 N` が、ファイル末尾のコメントの件数と一致すること

### 8. コミットして push

**オーナー承認を得てから** `main` へ push（[CLAUDE.md](../CLAUDE.md)）。
公開後に実URLで 200 を確認する。

---

## 完了条件
- [ ] `node check-salary.mjs` が `0 fail` かつ `salary-data.json` 一致（**出力を目視**）
- [ ] `assert-seo` / `assert-links` が 0件
- [ ] `assert-jp` / `assert-currency` / `assert-langtoggle` が pass
- [ ] パイプラインをもう1周流して差分0（冪等）
- [ ] OG画像を **3種類**（社・default・国）焼き直した
- [ ] localhost で日（ライト／ダーク）・英・年収タブ・求人タブを目視
- [ ] 外部リンクを実際に叩いて実在を確認した
- [ ] `db/airlines.generated.sql` をオーナーが Supabase に適用し、件数が一致した
- [ ] オーナー承認を得て push し、本番URLが 200

## エッジケース
- **SSOT に居ない slug で生成器を叩いた** → `✗ salary-data.mjs（SSOT）に居ない` で止まる。正常。先に工程1
- **`donorTokens` 検査で落ちた** → 借り元の本文が残っている。`CONTENT` の該当節を埋めれば通る。
  **`--force` や検査の削除で回避しない**（他社の事実が混ざる）
- **その国が初掲載** → 国別ページが日英とも新規に生える。`gen-sitemap` の `<loc>` が
  1社につき4本（日英のページ＋国ページ）増える。sitemap の件数で確認できる
- **`patch-site-salaries.mjs` が何も出力しない** → ランキングは上位21社だけ。圏外なら正常
- **数年内に消える会社（統合・破綻）** → 消滅日をページに書き、SSOT のコメントに ⚠️ で見直し期限を残す。
  実例＝アシアナ航空（2026-12-17 に大韓航空へ統合）

## この手順書のメンテ
- **`airlines-meta.js` の `salary` がハードコード**なのは、この配列が SSOT 化されていないため。
  `salary-data.json` を実行時 fetch する方式へ寄せれば手作業が1つ減る（未着手）。
- **国別ページと OG画像で機長平均が 5万円ずれることがある**（例：韓国はページ `¥2,320万`／OG `2,315万円`）。
  `gen-countries.mjs` が節目に丸め、`gen-og-images.mjs` は丸めない。どちらも SSOT 由来で誤りではないが、
  揃えるならどちらかに寄せる。全カ国に及ぶ話なので単独では触っていない。

---
*2026-08-08 作成。Eurowings（`6396e60`）とアシアナ航空（`91b5238`）で2回通して確定させた。
工程5の「OG画像は3種類」と工程4の「初回だけ2周」は、アシアナのときに実際に取りこぼして分かったもの。*
