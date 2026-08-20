# Verified Pilot / Give to Get / 市場価値レポート — 設計と実装計画

Version: 1.0 ／ 確定日: 2026-08-06
前提: [VISION.md](VISION.md) v1.0（Phase 2「一次データ取得」の KPI = Verified Primary Data）

---

# Part 1. 設計（オーナー原文）

## 基本方針

Verifiedは「投稿内容が100%正しい」ことを保証するものではない。

Verified Pilotとは、

> Pilot Valueが、一定の方法により「このユーザーは実在する現役または直近の民航パイロットである可能性が高い」と確認したユーザー

を意味する。

Verifiedはユーザーに付与する。

投稿ごとにVerified SalaryやVerified Reviewなどは作らない。

---

## Verified Pilot取得条件

以下のいずれかを満たした場合、Verified Pilot候補とする。

### 方法1（最優先）

給与明細アップロード

条件

・ブラウザ側で個人情報を自動マスク
・黒塗り後画像のみ送信
・画像はStorage・DB・ログへ保存しない
・AI解析後に即時破棄
・ユーザーが抽出結果を確認して投稿

---

### 方法2

航空会社ドメインメール認証

※会社メール認証は任意

会社側へ通知されない保証はできないため、その旨を表示する。

---

### 方法3

ライセンス・Type Rating等の確認

必要最小限の確認のみ。

番号や画像は長期保存しない。

---

## 公開画面での表示

認証方法は表示しない。

表示は統一する。

✓ Verified Pilot

口コミ・給与投稿・プロフィールなど全て同じ表示とする。

---

## 内部管理

保持する項目

verified_at

verification_method

verification_status

last_verified_at

revoked_at

revoke_reason

---

## Verified失効

以下の場合のみ失効可能

・虚偽投稿
・不正利用
・アカウント売買
・資格失効
・運営判断

月次更新をしないことだけでは失効しない。

---

# Active Contributor

Verifiedとは別概念。

継続投稿者に付与する。

例

Active Contributor

条件（例）

・直近90日以内に有効投稿
または
・直近6か月以内に3件以上投稿

Verified＝本人確認

Active Contributor＝継続貢献

役割を分ける。

---

# Give to Get

## 口コミ投稿

・Premium閲覧 14日

---

## 給与詳細手入力

・Premium閲覧 30日

・簡易市場価値レポート

・同条件比較

・時給計算

---

## 給与明細アップロード

・Premium閲覧 60日

・Verified Pilot取得候補

・完全版市場価値レポート

・AIによる給与内訳解析

・将来のスカウト対象候補

給与明細アップロードは「サイトへの協力」ではなく、「自分専用レポートを作るための材料」と位置付ける。

---

# 市場価値レポート（MVP）

市場価値レポートは「データ一覧」ではない。

目的

・給与明細アップロード直後に価値を返す
・同条件比較を返す
・翌月も更新したくなる
・Pilot Valueだけが作れるレポートにする

会社ごとの総合スコア（82.1点など）は作らない。

まずは「会社の評価」ではなく「自分の市場価値」を返す。

---

## レポート構成

### 1. レポート概要

・航空会社
・機種
・Position
・Base
・対象年月
・比較対象件数
・データ更新日

---

### 2. 実質時給

必須

・Block Hour単価

・Duty Hour単価

両方表示する。

---

### 3. 同条件比較

比較対象

・Position

・機種

・飛行時間

・経験年数

・地域

表示

あなた

中央値

平均との差

---

### 4. パーセンタイル

例

アジア　副操縦士 上位18%

---

### 5. 給与内訳

給与明細から取得した

・基本給

・Flight Pay

・Duty Pay

・Housing

・Transport

・Bonus

・その他手当

をグラフ表示。

---

### 6. 額面と手取り

表示

Gross

Net

Tax

Deduction

年初来累計

年収実績ペース

---

### 7. 比較グラフ

MVPでは以下のみ

・あなた vs 同条件中央値

・給与内訳

・月次推移

---

### 8. 先月比較

表示

・総支給

・Block Hour単価

・Duty Hour単価

・Block Hours

・Duty Hours

前月との差を表示する。

---

### 9. AI要約

AIは分析ではなく要約。

表示例

・同条件平均よりDuty Hour単価が高い

・拘束時間は平均より長い

・Housing Allowanceが平均より少ない

存在しないデータは推測しない。

---

### 10. 他社比較

比較項目

・総支給

・Block Hour単価

・Duty Hour単価

・基本給比率

・Housing

・Bonus

---

# データ不足時

データ不足時はAIで補完しない。

表示例

「現在、同条件データは3件です。

比較データが十分集まり次第、パーセンタイル等を表示します。」

---

# MVPで最初に実装するもの

優先順位

① Block Hour単価

② Duty Hour単価

③ 給与内訳

④ 同条件中央値

⑤ あなたとの差

⑥ Gross / Net

⑦ 比較対象件数

⑧ AI要約

会社スコアや複雑な指数は後回しにする。

---

# Part 2. 決定事項（2026-08-06）

既存コードと突き合わせた結果、上の設計と実装が食い違う4点をオーナーが決めた。

### 決定1 — 解放日数

| 貢献 | 解放 | 備考 |
|---|---|---|
| 口コミ投稿 | **14日** | 新設（現行は localStorage 30日のみ） |
| 給与手入力 | **30日** | 現行90日から変更 |
| 給与明細アップロード | **90日（据え置き）** | 設計書の60日から変更 |

**理由：** 現行の `submit_pay_report` は種別に関係なく一律90日。設計どおり60日にすると
明細を出した人だけ30日短くなる。`greatest()` で既存保持者は縮まないため、
新規だけが不利になる歪みが出る。**誰の解放も今より短くしない**方針で90日据え置き。

### 決定2 — Verified を行に刻む

`pay_reports.verify_level` に**投稿時点の値を刻む**。失効しても過去行は遡って書き換えない。

**理由：** 「その時点では確認できていた」は事実であり、遡ると North Star の
「検証済みデータ比率」が過去に向かって動く指標になる。
設計書の「投稿ごとに Verified Salary を作らない」は**表示の話**として守る
（画面に "Verified Salary" とは出さない）。行の刻印は内部の抽出用。

### 決定3 — 解放の鍵をサーバ1本に

`profiles.access_until` を唯一の正とする。localStorage は表示キャッシュに降格。

**理由：** 現在3つの期限が併存している。

```
localStorage pv_unlock_expiry         30日  ← 口コミ枠（口コミを1件出すと開く）
localStorage pv_salary_unlock_expiry  90日  ← 給与枠（access_until の写し）
profiles.access_until                 90日  ← サーバ（給与明細を出すと延びる）
```

（2026-08-16 に「口コミ→口コミ枠／明細→給与枠」へ分けた。給与枠は
`access_until` から書き写すだけになったので、残る食い違いは下の1本化だけ。）

判定にブラウザ側を使う箇所が多く、**サーバが90日と言っているのに31日目でロックされる**。
別端末・シークレットでも解放が消える。設計書の「Premium閲覧」という単一概念に合わせて1本化する。

### 決定4 — 最初に実装する確認方法

**方法1（給与明細アップロード）のみ。** 方法2（会社ドメインメール）・方法3（ライセンス）は今回やらない。

**方法2 を後回しにする追加理由：** `verified_airline` に会社が入ると、
`proof_hash = sha256(uid + '::pv_pay::' + airline)` を1回計算するだけで
その人の給与レポートが特定できる。会社アドレス（`first.last@airline.com`）自体も
個人特定情報。実装する場合は**検証後にドメインだけ残しアドレスは破棄**する前提。

---

# Part 3. 実装対応

## 3-1. すでに実装済み（新規に作らない）

| 設計の項目 | 実装 |
|---|---|
| Verified はユーザーに付与 | `profiles.verify_level` / `verified_airline` / `verified_at`（列はあるが誰も書き込んでいない） |
| Active Contributor | `profiles.badge_state`（active/inactive）＋ `pv_refresh_badge_states()` が90日で失効 |
| ①Block Hour単価 ②Duty Hour単価 ③給与内訳 ⑥Gross/Net | `payslip.js` の `perBlock` / `perDuty` / 編集可能な内訳表 |
| ④同条件中央値 ⑤あなたとの差 ⑦比較対象件数 | `submit_pay_report` の `benchmark` 戻り値 → `pay-report.html:1788` |
| 年収実績ペース | `renderAha`（`ytd_taxable` から算出） |
| 明細を保存しない | `parse-payslip` は Storage にも DB にも書いていない |
| 本人の履歴取得 | `my_pay_reports()` が `access_until` / `badge` / `badge_state` まで返す |

## 3-2. A. Verified Pilot の付与

### A-1. 付与は `parse-payslip` でやる（★設計の要）

**`submit_pay_report` で付与してはいけない。** あの RPC は `source` を
クライアントから受け取り `('web','payslip')` を素通しする（`db/pay-reports.sql:311,365`）。
明細を1枚も出さずに `source:'payslip'` と送れば Verified が取れてしまう。

付与するのは `supabase/functions/parse-payslip/index.ts` の**成功地点だけ**。
ここは SERVICE_ROLE を持ち `userIdFrom()` で `uid` を自分で検証済み（`index.ts:217`）。

```
index.ts:488-492  not_a_payslip チェックの直後、return json({ok:true,...}) の直前
  ↓ uid があり、earnings と hours の両方が取れている場合のみ
  service_role で  pv_mark_verified(uid, 'payslip')  を呼ぶ
  ↓ 失敗しても解析結果は返す（検証の失敗で明細の読み取りを潰さない）
```

判定は「earnings **かつ** hours」。現行の `not_a_payslip` は
`!earnings.length && !hours.length`（**or**）なので、Verified はそれより厳しくする。

### A-2. `db/verified-pilot.sql`（新規・冪等）

`profiles` に足りない列だけ追加（`verify_level` / `verified_at` は既存）:

```sql
verify_method     text          -- 'payslip' / 'domain' / 'license'
verify_status     text not null default 'none'
                  check (verify_status in ('none','verified','revoked'))
last_verified_at  timestamptz
revoked_at        timestamptz
revoke_reason     text
```

- **`pv_mark_verified(p_uid uuid, p_method text)`** — `security definer`、
  `revoke ... from public, anon, authenticated`（service_role だけが呼べる）。
  `verify_level=1` / `verify_method` / `verified_at`（初回のみ）/ `last_verified_at=now()` /
  `verify_status='verified'` / `badge='verified'` / `badge_state='active'`。
  **`verify_status='revoked'` の人は再付与しない**（失効を自動で巻き戻さない）
- **`pv_revoke_verified(p_uid uuid, p_reason text)`** — 運営が手で叩く。
  `verify_status='revoked'` / `revoked_at=now()` / `badge` を `contributor` に戻す。
  **`pay_reports` は1行も触らない**（決定2）

`badge` の check は既に `('none','contributor','verified','gold')`。`gold` は今回使わない。

### A-3. 行への刻印 — `submit_pay_report` の insert に3列足すだけ

`v_prof` は既に `select * into v_prof from public.profiles` で読んでいる（`db/pay-reports.sql:380`）。

```
verify_level  ← coalesce(v_prof.verify_level, 0)
verify_method ← v_prof.verify_method
verified_at   ← v_prof.verified_at
```

`on conflict do update` 側には**入れない**（訂正で過去の検証状態が書き換わらないように）。

これで `pay_reports.verify_level` のコメント
「法人に売り物になるのは verify_level >= 1 の行だけ」が初めて機能する。

### A-4. 表示

- 公開画面は認証方法を出さず **`✓ Verified Pilot`** で統一。出す場所は口コミカード・給与投稿・`profile.html`
- **`verified-pilot.html`（新規）**「Verified Pilot とは」を必ず作り、バッジから常にリンクする。
  VISION.md の「検証できないものを検証済みと表示しない」を守るため、
  **「投稿内容が100%正しいことの保証ではない」**を設計書の文言のまま書く。
  これが無いと閲覧者は「金額まで検証済み」と読む
- **`verified_airline` は画面に一切出さない**（決定4の理由と同じ）

## 3-3. B. Give to Get の日数と鍵の1本化

### B-1. 日数（決定1）

`submit_pay_report` の `v_until = greatest(既存, now() + 90 days)`（`db/pay-reports.sql:521`）を、
`source`（クライアント申告）ではなく**サーバが知っている事実**で分岐させる:

```
v_prof.verify_method = 'payslip' かつ last_verified_at が直近（24時間以内）
  → 90日
それ以外（手入力）
  → 30日
```

`greatest()` は**必ず残す**。既存の90日保持者から取り上げない。

口コミ側は `submit-review.html:1359` が `reviews_v2` へ**直接 insert** で RPC を経由しない。
→ **`reviews_v2` に `after insert` トリガを1つ足す**（RPC 化はしない。フロントの
insert 経路を変えずに済む）。トリガ内で `auth.uid()` は使える。
`access_until = greatest(access_until, now() + 14 days)` / `last_review_at = now()` /
`badge` が `none` なら `contributor` / `badge_state='active'`。

### B-2. 鍵のサーバ1本化（決定3）

- **軽量 RPC `pv_access()` を新設** — `{access_until, badge, badge_state, verify_status}` だけ返す
  （`my_pay_reports()` は全レポートを引くので重い）
- **判定を `airlines/premium-auth-lock.js` に集約**し `window.pvHasAccess()` を公開。
  他の15ファイルは localStorage 直読みをやめてこれを呼ぶ
- `data-gate-key`（`review` / `salary_detail`）の2通貨は**廃止**し単一 Premium に統一
  （属性は残すが判定に使わない＝既存HTMLを書き換えずに済む）
- キャッシュは**サーバ値を上書きできない**（サーバ値が短ければ短いほうを採る）
- `pv-reunlock.js` は役目を失う（サーバが持てば別端末で自動的に効く）が、
  既存ページが `pvCheckReunlock` を呼ぶため**関数名は残し、`pv_access()` を呼ぶ薄い実装に置換**

localStorage 直読み: 16ファイル33箇所。`premium-auth-lock.js` / `pv-reunlock.js` /
`submit-review.html` / `community.html` / `profile.html` / `pay-report.html` /
`index.html:623`（インライン onclick）/ `airlines/airline-reviews-ui.js` /
`airlines/starlux-tenshoku.html` ＋ `en/` 側の同名6ファイル。**置換パターンは1つ。**

### B-3. ★ この変更が「直さない」こと（正直な但し書き）

**サーバ1本化しても、devtools を開ける人はプレミアム内容を読める。**
`airlines/emirates.html` を見れば分かるとおり、年収テーブルの**中身は静的HTMLにそのまま入っていて**、
`airlines/airline-base.css:387` の `.pv-locked` で**ぼかしているだけ**。CSSクラスを1つ消せば読める。
localStorage を書き換えるまでもない。

本当に塞ぐには「プレミアム部分をHTMLに載せず認証後にRPCで取得する」形にする必要があり、
110社ぶんのページ生成を作り替える別フェーズ。**今回はやらない。**

今回1本化で実際に直るのは、①サーバ90日とブラウザ30日の食い違い（＝決めた日数が実際に効く）、
②別端末・シークレットで解放が消える、③期限の系統が3つに増える、の3点。

## 3-4. C. 市場価値レポート（MVP）

### 置き場所

部品が3箇所に散っている（`payslip.js` の解析直後 / `pay-report.html` の投稿直後 /
`profile.html` のマイページ）。**`my-value.html`（新規）に1枚のレポートとしてまとめる。**
明細アップロード直後とマイページからの再訪の両方でここに着地させる。

### 移植するだけの項目

①②③④⑤⑥⑦ は**すべて計算済み**。`my_pay_reports()` と `submit_pay_report` の
`benchmark` から取れる。新規計算は不要。Gross は列が無いが
**`net_pay_actual + deduction_total`** で出る（列は足さない）。

### 新規に作るもの

| 項目 | 作り方 |
|---|---|
| 先月比較（⑧） | `my_pay_reports()` は `period_ym` 順で全行返す。直近2件の差分をJSで出すだけ。DB変更なし |
| 月次推移グラフ | 同上。同じ配列から描く |
| 他社比較 | 公開ビュー `pay_benchmarks`（`db/pay-reports.sql:736`、anon に grant 済み） |
| AI要約 | 新規 Edge Function `summarize-value`。**数値はサーバで確定済みのものだけ渡し、AIには文章化しかさせない**（VISION「AIが勝手に推測しない」） |
| 地域別パーセンタイル | 現行の percentile は `airline + position + fleet + year` で**地域軸が無い**。**MVPでは出さない** |

### ★ データ不足時（MVPの現実）

benchmark は **k≧5 のときだけ返す**（`db/pay-reports.sql:551`「ここだけ緩めると裏口になる」）。
設計書の「現在、同条件データは3件です」の文面はそのまま使えるが、**出るのは5件未満のとき**。
閾値5は動かさない。

**現在 `pay_reports` は実質0件。** 最初の数十人には ④⑤⑦・他社比較・パーセンタイルは
**1つも出ない**。最初の1人にも返せるのは:

```
① Block Hour単価  ② Duty Hour単価  ③ 給与内訳
⑥ Gross / Net / Tax / 控除 / 年初来累計 / 年収実績ペース
   ＋（2回目以降）先月比較・月次推移
```

**この5つがレポートの本体である**という前提で作る。比較系は
「集まり次第表示します」の枠を置き、埋まったら出す。

### 実装順

```
1. ①②③⑥ を my-value.html に集約（既存ロジックの移植）
2. 先月比較・月次推移（my_pay_reports の配列から）
3. ④⑤⑦（k≧5 のとき。データ不足の枠は先に置く）
4. 他社比較（pay_benchmarks）
5. AI要約
—— ここまでで MVP ——
6. 地域別パーセンタイル（region 軸の設計から）
```

会社ごとの総合スコア（82.1点など）は**作らない**（設計書の明記どおり）。

---

# Part 4. 先に片付ける（このフェーズの前提）

**本番反映 — 未 push の23コミット。** production = `origin/main` は `f933112`（2026-08-02）
で止まっており、**明細機能そのものがまだ世に出ていない**。上の A〜C は全部その上に乗る。

1. オーナー目視（PDF と画像の両方で枠の位置を確認）
2. `feature/payslip` → `main` マージ
3. **`git push origin main`** ← これが本番反映。マージだけでは何も起きない
4. `remind-payslip` を Dashboard → Edge Functions → **関数名をクリック → Deploy updates**
   （`Deploy a new function` は押さない）、`PV_CRON_SECRET` 登録、`db/pay-reminder.sql` で pg_cron

ローカル検証状態：`db/test-payslip-redact.mjs` 450 pass / 0 fail、
回帰5本（hours 40／form-contract 88／aha 49／remind 86／unlock-rule 38）0 fail。

---

# Part 5. 検証

- **`db/test-verified-pilot.mjs`（新規）** — PGlite で `db/test-unlock-rule.mjs` と同じ器を組む
  - `pv_mark_verified` は service_role 以外から呼べない
  - `submit_pay_report` は `source:'payslip'` を送られても verify_level を上げない
  - 検証済みユーザーの投稿行に verify_level=1 が刻まれる
  - `pv_revoke_verified` 後も**過去行の verify_level は 1 のまま**（決定2）
  - 失効した人は `pv_mark_verified` で自動復活しない
- **`db/test-unlock-rule.mjs` を拡張** — 口コミ14日／手入力30日／明細90日、
  および `greatest()` で既存の解放が縮まないこと
- **回帰5本を全部通す**（`test-form-contract.mjs` 88 が既存26キーの契約を見張っている）
- localhost 通し：`node serve.mjs` → 明細1枚 → `my-value.html` に着地 →
  ログアウト → 別ブラウザでログイン → **解放が効いている**こと
- `node check-salary.mjs`（110 pass）と `node audit-en-salary.mjs`（drift 0）

# Part 6. 触らないもの

- `gen_en_airlines.mjs` での**全再生成は禁止**（既存 EN ページが劣化する）
- Phase2-C 英語化は**完了済み**（全64社・`4b55717`・本番稼働中）
- 一括編集時は**サブエージェントに git を触らせない**＋事前チェックポイント commit
- `pay_reports` の**控除内訳は持たない**（組合費から所属組合が割れる）
- `mail-bot/admin-notify.mjs` を cron に入れない（二重送信）
