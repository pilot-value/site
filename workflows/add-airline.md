# 航空会社・運航会社を1社追加する

## まず道を選ぶ（ここを間違えると全部ずれる）

「会社の一覧」と「年収の一覧」は、**2026-09-13 まで同じ1つの物**でした。
そのため年収の出典が無い会社は、そもそも投稿フォームの選択肢に置けませんでした
（小規模航空会社・チャーター会社・ビジネスジェット運航会社が全部これ）。
いまは会社の置き場が2つに分かれています。**足す前にどちらの道か決めてください。**

| | 道A「掲載社を増やす」 | 道B「投稿先だけ増やす」 |
|---|---|---|
| **足す場所** | [salary-data.mjs](../salary-data.mjs) の `SALARY` | [airline-ops.mjs](../airline-ops.mjs) の `OPS` |
| **年収の出典** | **要る**（無いなら足さない） | **要らない** |
| **会社ページ** | 日英2枚を起こす | **作らない** |
| **投稿フォームの選択肢** | 出る | 出る |
| **REAL PAY の社名・絞り込み** | 出る | 出る |
| **DEEP PAY の会社別集計** | 入る | 入る |
| **年収の帯・レベリング図・国別ページ・OG画像・sitemap** | 出る | 出ない |
| **作業量** | 工程1〜8（半日） | 工程B1〜B4（15分） |

- **迷ったら道B。** 年収の出典が揃ったら、あとから道Aへ**コードを変えずに**昇格できます
  （下の「B5. 道Aへの昇格」）。過去の投稿が全部そのままついてきます。
- 逆はできません。**出典が無いのに道Aへ入れない。** 数字を作ることになります（[VISION.md](../VISION.md)）。

---

# 道A ── 掲載社を増やす（年収あり）

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
（道Bで足した会社は `SALARY` に居ないので `gen-countries.mjs` が拾わない＝404 は生えない。）

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

## 手で足す5箇所

残りはパイプラインが拾う。**この5つ以外を手で編集しない。**

| ファイル | 中身 |
|---|---|
| [salary-data.mjs](../salary-data.mjs) | `ja / en / region / cap{avg,lo,hi} / fo{avg,lo,hi} / taxFree / conf`。単位は**万円** |
| [airline-countries.mjs](../airline-countries.mjs) | `'asiana': 'KR'` の1行 |
| [airlines-meta.js](../airlines-meta.js) | 一覧・レベリング図用。`code / color / flag / type / alliance / salary`。⚠️ `salary` はハードコードなので SSOT と手で揃える |
| [search.js](../search.js) | サイト内検索。`t:[...]` に IATA / ICAO / ひらがな / 国名を入れる |
| [gen-new-airline.mjs](../gen-new-airline.mjs) の `CONTENT[slug]` | ページ本文。下記「本文の書き方」 |

⚠️ **投稿フォームの `<option>` を手で書かない（2026-09-13 に訂正）。**
`submit-review.html` / `pay-report.html` の**日英4枚**の `#f-airline` と `AIRLINE_LABELS` は、
いまは [gen-airline-codes.mjs](../gen-airline-codes.mjs) の**生成物**です。
手で1行足すと、[assert-generated.mjs](../assert-generated.mjs) が
「生成器を流し忘れて古くなっている」と判定して**必ず落ちます**（逆向きでも落ちる）。
足すのは `SALARY` か `OPS` の側だけで、フォームは工程4のパイプラインが書き直します。

**自動で入る（手で触らない）:**
[lang-toggle.js](../lang-toggle.js) の EN allowlist（`gen-en-manifest.mjs` が `en/airlines/` を走査）、
`airline-codes.json` / `pv-airlines.json` / `db/airlines.generated.sql` /
投稿フォーム日英4枚の `#f-airline` / [pv-reunlock.js](../pv-reunlock.js) の FALLBACK_CODES
（以上すべて `gen-airline-codes.mjs`）、`salary-data.json`、`index.html` のランキング配列、
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

### 2. 残り4箇所を足す
上の表のとおり（`airline-countries.mjs` / `airlines-meta.js` / `search.js` /
`gen-new-airline.mjs` の `CONTENT`）。**投稿フォームには触らない。**

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

⚠️ **ここに焼かれる社数は「年収を載せている社数」＝`SALARY` の件数。**
道Bで足した会社は数に入らない（入れると「112社の年収」が嘘になる）。

### 6. 検証する

```bash
node serve.mjs                # すでに動いていれば不要。file:/// は開かない
node check-salary.mjs         # 新社が pass・❓ page not found が0・❌0（出力を目視）
node assert-seo.mjs           # 0件
node assert-links.mjs         # 0件（← ページを置き忘れるとここが落ちる）
node assert-jp.mjs
node assert-currency.mjs
node assert-langtoggle.mjs    # allowlist 漏れの検出
node assert-generated.mjs     # 生成器の流し忘れ（フォーム4枚・sitemap・語彙）
```

localhost でスクリーンショットを撮って目視する。**1回撮って終わりにしない。**
**タブの奥は既定では写らない。** `年収データ` と `募集要項` は「年収・給与」「求人情報」タブに
振り分けられるので、`[data-tab="salary"]` / `[data-tab="jobs"]` をクリックしてから撮る。
日本語（ライト／ダーク）・英語の3面を見る。

### 7. Supabase に流す（⚠️ 自動では反映されない）

`gen-airline-codes.mjs` が `db/airlines.generated.sql` を書き直すが、**適用は手動。**
流すまで、**投稿フォームでその社を選んでも保存側で弾かれる。**

**★DB が先、公開が後。** 新しいコードを含む HTML を先に公開すると、
その会社を選んだ人の投稿が外部キー違反で落ちる。

**オーナー作業:**
1. `https://supabase.com/dashboard/project/vzgmnkrggrwtsrpqndsm/sql/new` を開く
2. [db/airlines.generated.sql](../db/airlines.generated.sql) を全文コピペして Run
3. 末尾の検算 `有効 N / 全件 N` が、ファイル末尾のコメントの件数と一致すること

### 8. コミットして push

**オーナー承認を得てから** `main` へ push（[CLAUDE.md](../CLAUDE.md)）。
公開後に実URLで 200 を確認する。

---

## 道A の完了条件
- [ ] `node check-salary.mjs` が `0 fail` かつ `salary-data.json` 一致（**出力を目視**）
- [ ] `assert-seo` / `assert-links` / `assert-generated` が 0件
- [ ] `assert-jp` / `assert-currency` / `assert-langtoggle` が pass
- [ ] パイプラインをもう1周流して差分0（冪等）
- [ ] OG画像を **3種類**（社・default・国）焼き直した
- [ ] localhost で日（ライト／ダーク）・英・年収タブ・求人タブを目視
- [ ] 外部リンクを実際に叩いて実在を確認した
- [ ] `db/airlines.generated.sql` をオーナーが Supabase に適用し、件数が一致した
- [ ] オーナー承認を得て push し、本番URLが 200

---

# 道B ── 投稿先だけ増やす（年収なし・2026-09-13 新設）

## 目的
年収の公開レンジが無い会社（小規模航空会社・チャーター会社・ビジネスジェット運航会社・
貨物・リージョナル）を、**給与フォームで選べて REAL PAY に正しい社名で出る**ところまで通す。
会社ページも年収の帯も作らない。

## ⚠️ 足す前に確かめる3つ

1. **実在と正式名称を公式情報で確認する。** 確認できないものは足さない。
   `src` に確認元と日付を必ず残す（[DATA-PROVENANCE.md](../DATA-PROVENANCE.md) と同じ考え方）。
2. **運航区分・一般名詞を会社として登録しない。**
   「Part 91 Corporate」「Private Airlines」「プライベートジェット」のような語は
   **会社を指していない**ので登録も名寄せもしない。未特定のまま `'other'` に残す
   （そこに落ちた行は公開集計にも DEEP PAY にも入らない＝安全側）。
3. **名前が似ているだけの別法人・子会社を1社にまとめない。**
   実例：`honda-airways`（ホンダエアウェイズ＝社用機の運航）と Honda Aircraft Company（機体メーカー）は別。
   `executive-jet-management` を `netjets` に寄せない（同じ傘の下だが別の運航会社・別の給与）。
   `fuji-business-jet` と FDA（フジドリームエアラインズ）は**同じ鈴与グループの別会社**。
   `royal-jet` と `royal-jordanian` は別。
   **まとめると、片方の会社の給与がもう片方の中央値に黙って混ざる。**

## B1. [airline-ops.mjs](../airline-ops.mjs) に1件足す（**手で書くのはここだけ**）

```js
  'example-ops': {
    ja: '正式名称（略称）',        // ★括弧の外と中の両方が pv_airline_resolve に効く
    en: 'Official Name (ABBR)',
    region: 'japan',              // gen-airline-codes.mjs の8地域のいずれか
    kind: 'bizjet',               // bizjet / charter / regional / cargo
    alias: ['略称', 'よみがな'],   // ★画面の検索欄だけが読む。DB には出さない
    src: '会社公式サイト 2026-09-13',
  },
```

- **コードは英小文字・数字・ハイフンだけ。** あとから変えられない（過去の投稿が付いてくる鍵）。
- `kind` と `alias` は **`pv_airlines` に出ない。** あの表は `(code, name_ja, name_en, region, active)` で、
  どの SQL も種別を使っていないため。
- `alias` は**画面の検索欄だけ**の道具。ここに書いた略称で `pv_airlines` に別名の行は作らない
  （`pv_airline_resolve` は完全一致だけの設計。広げると間違った社名に寄る）。

## B2. 生成器を流す（8つの成果物が一斉に更新される）

```bash
node gen-airline-codes.mjs
```

出力に `年収あり 112 ＋ 投稿先のみ N` が出る。ここで落ちる3つの検査：

| 落ちたとき | 意味 |
|---|---|
| `コードの衝突` | その code は既に `SALARY` に居る。道Bではなく道A（またはコードを変える） |
| `OPS の形` | `ja` / `en` / `region` / `kind` / `src` のどれかが無い・地域名が8種の外 |
| **`社名の衝突`** | **正規化すると別の会社と同じ名前になる。** `pv_airline_resolve` は
`order by c.code limit 1` で機械的に1つ選ぶので、ここで止めないと投稿が別会社に混ざる。
別法人なら名前を分ける（正式名称にする）。同じ会社なら片方を消す |

## B3. 検査を流す

```bash
node check.mjs        # fast + sql（約80秒）
```

画面の検索欄や `pay-report.html` を触ったなら `node check.mjs web` まで。

## B4. Supabase に貼る（⚠️ **貼ってから公開**）

**オーナー作業。道Aの工程7と同じ1本だけ。**

1. `https://supabase.com/dashboard/project/vzgmnkrggrwtsrpqndsm/sql/new`
2. [db/airlines.generated.sql](../db/airlines.generated.sql) を全文コピペして Run
3. 末尾の件数が想定どおりか確認。続けて確かめる：
   ```sql
   select public.pv_airline_resolve('打ち込まれそうな社名');
   ```
   新しいコードが返れば、**過去の「その他」の投稿も行を1行も書き換えないまま**
   REAL PAY で正しい社名になる（`pv_airline_resolve` は保存時ではなく**読むたび**に走る）。
4. **そのあとに** commit を push して画面を公開する。

⚠️ **`update pay_reports set airline = …` は絶対に流さない。**
`pay_reports` に `user_id` は無く、持ち主は `proof_hash` だけ。次の4か所が
`select distinct lower(airline_other) … where airline='other'` から鍵を総当たりしている ──
`my_pay_reports`（[db/pay-reports.sql](../db/pay-reports.sql)）／
`pv_my_give`・`pv_pay_person_map`（[db/pay-rows.sql](../db/pay-rows.sql)）／
`pv_my_keys`（[db/deep-pay.sql](../db/deep-pay.sql)）。
`airline` を実コードに書き換えると `pay_reports_other_chk` により `airline_other` を null に
せざるを得ず、**その瞬間に本人が自分の投稿を開けなくなる**（[db/usage.mjs](../db/usage.mjs) の
`payHash` も外れる）。**表示は読むたびに直る。行は触らない。**

## B5. 道Aへの昇格（年収の出典が揃ったら）

1. `airline-ops.mjs` から1件消す
2. `salary-data.mjs` の `SALARY` に**同じコードのまま**足す（道Aの工程1）
3. 道Aの工程2〜8をそのまま通す

**コードを変えないこと。** 変えると過去の投稿が古いコードのまま取り残され、
会社が2つに割れる（片方は会社ページ付き・片方は投稿だけ）。

## 道B の完了条件
- [ ] 公式情報で実在と正式名称を確認し、`src` に日付付きで書いた
- [ ] 運航区分・一般名詞を会社として登録していない
- [ ] `node gen-airline-codes.mjs` が3つの検査を通って件数が増えた
- [ ] `node check.mjs` が緑
- [ ] オーナーが `db/airlines.generated.sql` を貼り、`pv_airline_resolve` が新コードを返した
- [ ] **貼ったあとに** push した

## 道B で起きないこと（確認済み・直さなくてよい）
- **会社ページへの 404 は生えない。** `gen-countries.mjs` も `check-salary.mjs` も
  `gen-og-images.mjs` も `gen-sitemap.mjs` も `SALARY` しか数えないため。
  `my-value.js` がリンクを作るのも年収のある社だけ（`loadPub()` は `avg > 0` で絞る）
- **「世界112社」の表記はずれない。** 同じ理由
- **年収の帯が出ないのは正常。** 給与フォームの AHA は
  「この会社の公開レンジはまだありません（入力が間違っているわけではありません）」を出して
  REAL PAY へ導く（[payslip.js](../payslip.js) の `ahaNoRange`）。
  支給内訳・時間あたり・税の節は帯に依らないので今までどおり出る
- **ヘッダー検索（`search.js` の `PV_DB`）には足さない。** あの表の
  `f:'airlines/{slug}.html'` は会社ページへのリンクで、ページを持たない会社を入れると
  **ヘッダー検索から 404 が生える**。給与フォームの検索欄は `data-alias` を読むので別系統

## ⚠️ 道B で**直らない**もの（混同しない）
**過去の「その他」の投稿は、DEEP PAY の会社別集計には入りません。**
[db/deep-pay.sql](../db/deep-pay.sql) は `pv_airline_resolve` を一度も呼ばず、
`pay_reports.airline` をそのまま読んで `airline <> 'other'` で外しているためです。

| | REAL PAY の表示・詳細・絞り込み | DEEP PAY の会社別集計 |
|---|---|---|
| 登録**前**の投稿（`airline='other'` のまま） | ✅ 正しい社名で出る | ❌ 入らない |
| 登録**後**の新しい投稿 | ✅ 出る | ✅ 入る |

会社別集計はそもそも**同じ会社に3人**いないと出ないので、1〜2件が入っても表示は変わりません。
集計側も紐づけたい場合は、`deep-pay.sql` の母集団の作り方を変える別作業になります。

---

## エッジケース（道A）
- **SSOT に居ない slug で生成器を叩いた** → `✗ salary-data.mjs（SSOT）に居ない` で止まる。正常。先に工程1
- **`donorTokens` 検査で落ちた** → 借り元の本文が残っている。`CONTENT` の該当節を埋めれば通る。
  **`--force` や検査の削除で回避しない**（他社の事実が混ざる）
- **その国が初掲載** → 国別ページが日英とも新規に生える。`gen-sitemap` の `<loc>` が
  1社につき4本（日英のページ＋国ページ）増える。sitemap の件数で確認できる
- **`patch-site-salaries.mjs` が何も出力しない** → ランキングは上位21社だけ。圏外なら正常
- **数年内に消える会社（統合・破綻）** → 消滅日をページに書き、SSOT のコメントに ⚠️ で見直し期限を残す。
  実例＝アシアナ航空（2026-12-17 に大韓航空へ統合）

## エッジケース（道B）
- **会社が無くなった／取り違えて足した** → `airline-ops.mjs` から消して `gen-airline-codes.mjs` を
  流し直し、`db/airlines.generated.sql` を貼り直す。会社は削除されず `active=false` に落ちるだけなので、
  万一その社で投稿済みでも外部キーは生きたまま、新規投稿だけが止まる。
  **`delete from pv_airlines` は使わない**
- **本人が打ち込んだ表記と正式名称がずれている** → `pv_airline_resolve` は**完全一致だけ**。
  `ja` を「正式名称（略称）」の形にすると括弧の外と中の両方で当たる。
  それでも当たらない表記は**未解決として報告する。推測で寄せない**
- **同じ会社を道Aと道Bの両方に書いた** → `gen-airline-codes.mjs` が
  `コードの衝突` で落ちる（`OPS` 側を消す）

## この手順書のメンテ
- **`airlines-meta.js` の `salary` がハードコード**なのは、この配列が SSOT 化されていないため。
  `salary-data.json` を実行時 fetch する方式へ寄せれば手作業が1つ減る（未着手）。
- **国別ページと OG画像で機長平均が 5万円ずれることがある**（例：韓国はページ `¥2,320万`／OG `2,315万円`）。
  `gen-countries.mjs` が節目に丸め、`gen-og-images.mjs` は丸めない。どちらも SSOT 由来で誤りではないが、
  揃えるならどちらかに寄せる。全カ国に及ぶ話なので単独では触っていない。

---
*2026-08-08 作成。Eurowings（`6396e60`）とアシアナ航空（`91b5238`）で2回通して確定させた。
工程5の「OG画像は3種類」と工程4の「初回だけ2周」は、アシアナのときに実際に取りこぼして分かったもの。*
*2026-09-13 に道A／道Bへ分割。あわせて「手で足す6箇所」の表が投稿フォーム日英4枚を
「手で編集」と書いていた誤りを直した（いまは `gen-airline-codes.mjs` の生成物で、
手で編集すると `assert-generated.mjs` が落ちる）。*
