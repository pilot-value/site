# mail-bot — PILOT VALUE メール自動化

依存追加ゼロ（Node 18+ の `fetch` のみ）。Supabase REST と Resend API を直接叩く。
`tweet-bot/` と同型で、`.env` は手動読込・状態は json 保存・`.env` と状態ファイルは `.gitignore` 済み。

- `admin-notify.mjs` … 新規登録・新規口コミを**管理者**（info@pilot-value.com）へ要約通知。**会員の同意不要**（自社アドレス宛＝特定電子メール法の対象外）。
- `send.mjs` … **会員向け**配信。`welcome`（歓迎）／`digest`（新着ダイジェスト）。**オプトインした会員のみ**・全メールに解除リンク。

> ⚠️ **管理者通知の主役は Edge Function に移りました。**
> 日常の通知は `supabase/functions/notify-admin/index.ts` が Database Webhook から
> 呼ばれて**投稿・登録・問い合わせの瞬間**に飛びます。2026-08-23 から**6本**です:
> reviews_v2 / profiles / contacts / pay_reports / pay_reports_pending / airline_conditions。
> `admin-notify.mjs` は消していません。**まとめ通知・過去分の `--backfill`・
> `--dry-run` での下見**という手動ツールとして残しています。
> ⚠️ ただし `admin-notify.mjs` が扱うのは **reviews_v2 と profiles の2つだけ**です。
> 給与レポート・預かり・待遇アンケートは**この手動ツールでは出ません**（Edge Function 側だけ）。
> 増やさないのは意図的で、ビルダーのコピーが増えると必ず本体とずれるためです。
> 両方を動かすと同じ新着が二重に届くので、**cron には登録しないでください**
> （Edge Function 側だけで足ります）。品質フラグのロジックは
> `submit-review.html` / `admin-notify.mjs` / `notify-admin/index.ts` の3箇所に
> 同じものがあります。直すときは3つとも直してください。

---


## ログイン用メールの本文（Supabase の Email Templates）

**原本は [auth-emails/signin-code.html](auth-emails/signin-code.html) の1枚だけ。**
これを Supabase ダッシュボードの **2枚**に貼る（中身は同じでよい）。

Authentication → Emails → Templates →

| テンプレート | 誰に飛ぶか |
|---|---|
| **Confirm sign up** | **初めての人**。`signInWithOtp({shouldCreateUser:true})` で新規が作られたとき |
| **Magic link or OTP** | 既に登録がある人 |

同じ「コードを送る」1つのボタンでも、**相手が新規か既存かで飛ぶテンプレートが変わる。**
片方だけ直すと、直っていないほうを踏んだ人にだけ古いメールが行く。

**件名（2枚とも同じ）:**

```
{{ .Token }} — ログインコード / Login code
```

件名に6桁を入れてあるのは、**スマホの通知バナーだけ見てブラウザに戻れるようにするため。**

### ⚠️ `{{ .ConfirmationURL }}` を書き足さない

これがこのファイルの存在理由。**2026-08-22 まで本文に「このままログイン / Log in」という
リンクのボタンが入っていて、実際に給与データが4件消えた。**

押すとメールアプリの中の別ブラウザが開く。給与レポートの預かり証（`pv_pay_claim`）は
**提出したブラウザの localStorage にしかない**ので、そちらには無い。
本人は登録を終えたつもりで、データだけ置き去りになる。

サイト側の文言も「6桁のコードを送ります」に統一済み（`login.html` / `signup.html` /
`en/login.html` / `en/signup.html` / `pay-login.js`）。**リンクを戻すと説明のほうが嘘になる。**
`node db/test-pay-gate.mjs` の ⑧ がこの原本と5ファイルを両方見ている。

### 有効期限の数字は勝手に書かない

本文の「10分で無効になります / expires in 10 minutes」は
**Authentication → Sign In / Providers → Email → `Email OTP expiration`** の値
（2026-08-22 時点で `600` 秒）と一致させてある。
サイト側は期限の数字をどこにも表示していないので、**合わせる先はこの設定だけ**。
設定を変えたらこのファイルも直す。

### 貼ったあとに必ず確認すること

ダッシュボードの中身はリポジトリから検査できない。**現物で見るしかない。**

1. **まだ登録の無いアドレス**で1通（→ Confirm sign up）
2. **既に登録があるアドレス**で1通（→ Magic link or OTP）

両方について ①件名に6桁が出ている ②コードが最上段にある
③**押せるリンクが1つも無い** ④「10分」と書いてある、を見る。
1通しか送らないと必ずどちらかを見落とす。

### ⚠️ Supabase はテンプレートを言語で出し分けられない

種類ごとに1枚しか持てないので、`/en` から来た人にも同じ1通が飛ぶ。だから**日英併記**にしてある。
`{{ if }}` での分岐は使わない。判定材料（`user_metadata`）が**新規ユーザーにしか入らない**うえ、
テンプレートが壊れると**メールが1通も出なくなる**。

---
## 返信経路（⚠️ Gmail からそのまま返信しないこと）

**問題。** MX は Cloudflare Email Routing ＝**転送専用で、返信機能を持たない。**
`info@pilot-value.com` に来た問い合わせは個人の Gmail に転送されてくるので、
そこで「返信」を押すと **個人アドレスと Gmail の表示名がそのまま相手に渡る。**
リポジトリ・Git履歴・GitHub アカウントから身元を消した作業（CLAUDE.md「⚠️ 公開リポジトリであること」）が、
**1通の返信で無意味になる。**

**解決。** Gmail の送信元に `info@pilot-value.com` を追加し、**外部の SMTP リレー経由**で送る。

> 宛先の心配は要らない。`notify-admin` が問い合わせ通知に `reply_to: <問い合わせ者>` を入れているので、
> 通知メールで「返信」を押せば宛先は自動的に問い合わせ者になる。**直すのは差出人だけ。**

### 現状（2026-08-20 に Gmail の設定画面と実際の送信で実測）

- ✅ `PILOT VALUE <info@pilot-value.com>` が**登録されている。**
  経由サーバーは **`smtp-relay.brevo.com`（TLS・ポート587）**。
  DNS の `brevo1/2._domainkey` と DMARC の `rua=…@dmarc.brevo.com` はこのための本物。
  **通知メールの Resend とは別系統だが、これで正しく動く。作り直さない。**
  → Gmail はこの差出人のとき必ず Brevo から出す。`Return-Path` に個人アドレスは入らない。
- ✅ **「デフォルトの返信モード」＝「メールを受信したアドレスから返信する」に修正済み**
  （2026-08-10 時点では「常にデフォルトのアドレスから返信する」＝返信が毎回 個人アドレスから出る状態だった）。
  **「デフォルトに設定」は押していない。** 既定は個人アドレスのままで正しい。
- ✅ **PC・スマホの両方から実際に返信し、`check-reply-headers.mjs` で本文・署名・差出人を確認済み。**
  差出人は `PILOT VALUE <info@pilot-value.com>`、本文と署名に氏名なし。
- ⚠️ 残っている小さな点: この送信元は **「エイリアスではありません」** 設定。
  外部 SMTP 経由なので `Sender` は付かないはずで、実際に送信控えにも入っていなかったが、
  **届いた側の控えでは未確認。** 設定を編集すると Brevo の SMTP パスワード再入力を求められ、
  いま動いているものを壊しうるので触らない。確かめるときは届いた控えを1通取る。

### やること

**1. 返信モードを変える（必須。これだけで穴は塞がる）**
設定 → アカウントとインポート → 「名前:」欄の下
→ **「メールを受信したアドレスから返信する」** を選ぶ。

問い合わせ通知の `To:` は `info@pilot-value.com` なので、返信は自動的にそこから出る。

> **「デフォルトに設定」は押さないこと。** この Gmail は個人利用も兼ねている。
> 既定を `info@pilot-value.com` にすると、**私信まで PILOT VALUE 名義で出て**
> 個人の知人にサイトの運営者だと知られる。漏れの向きが逆になるだけで、同じ事故。
> 既定は個人アドレスのまま、**返信だけ受信アドレスに追従させる**のが正しい設定。

**2. 署名とスマホを確かめる**
- **署名を送信元ごとに分け、`info@` 側には氏名を書かない**（`PILOT VALUE 運営` など）。
  設定 → 全般 → 署名。送信元アドレスごとに既定を割り当てられる。
- **スマホの Gmail アプリでも差出人が切り替わるか確かめる。** アプリは既定アドレスに戻りやすく、
  実際に返信するのはスマホからのことが多い。ここが一番の穴になる。

**3. 実際に送ったものを機械的に検証する**
**Gmail から** `info@pilot-value.com` 宛に手で1通返信テストする。
（普段どおりの操作＝スレッドを開いて「返信」で送る。新規作成ではなく返信で試すこと。
　スマホからも1通送っておく。）

**⚠️ 落とすのは「受信トレイに届いた方」。「送信済み」の控えではない。**
送信済みの控えには `Received` が1行も無い＝**どのサーバから出て行ったかが写っていない。**
`Return-Path`・`Sender`・`X-Google-Original-From` は受信側で付くヘッダなので、
送信控えでは全部「空」になり、素直に判定すると**通っていないのに合格に見える**
（2026-08-20、実際に送信控え2通が `9/10` と出た。いまは `⊘ 判定不能` と表示して落とす）。

届いた方を開く → ︙ → メッセージのソースを表示 → 元のメッセージをダウンロード
```sh
node mail-bot/check-reply-headers.mjs ~/Downloads/保存した.eml
```
`10/10 passed`・判定不能ゼロなら合格。落ちたら表示された項目だけ直す。

> **自分宛に返信すると、届いた控えが手に入らないことがある。**
> Gmail は同じ Message-ID の受信コピーを表示しないので、`info@pilot-value.com` へ返信すると
> 送信済みの控えしか残らない。そのときは経路を別の方法で確かめる:
>
> 1. 設定 → アカウントとインポート → `info@pilot-value.com` の行に
>    **「（smtp-relay.brevo.com 経由）」** と出ているか。出ていれば Gmail は必ずそのサーバから出す
>    ＝ `Return-Path` は Brevo のものになり、個人アドレスは相手に渡らない
> 2. Brevo → Transactional → Logs に、その時刻の送信が残っているか

> `node mail-bot/smtp-check.mjs --send` は **Resend の経路**を叩くもので、
> 実際の返信が通る Brevo リレーとは別。Resend 側（通知メール）が生きているかの確認には使えるが、
> **返信経路の合否はあくまで上の「Gmail から手で送った1通」で判定する。**

> **なぜ目視では足りないのか。** Gmail の画面に「PILOT VALUE」と出ていても、
> ヘッダには個人アドレスが残ることがある。さらに**表示名も署名も MIME で base64 に包まれる**ので、
> `.eml` を `grep` しても日本語の氏名は1文字も引っかからない（実測で確認済み）。
> `check-reply-headers.mjs` は encoded-word と本文の base64 / quoted-printable を復号してから当てる。
> 判定語は `assert-no-pii.mjs` と同じ [pii-rules.mjs](../pii-rules.mjs) ＋ `.pii-denylist`
> ＋ `.employer-denylist`（社内語彙）を共有している。片方だけ緩くならないようにしてある。

`check-reply-headers.mjs` が見るもの:

| 分類 | 扱い |
|---|---|
| 相手に渡る（`From` / `Sender` / `Reply-To` / `Return-Path` / `Message-ID` / `Subject` / 本文 / 添付名） | ❌ 1件でも落とす |
| 受信側で後から付く（`Delivered-To` / `Received` / `To` / `ARC-*` / `X-Gm-*`） | ℹ️ 表示のみ。転送された自分の控えなので相手には渡らない |
| `X-Google-Original-From` | ❌ **`X-Google-` で始まるが例外。** Gmail が差出人を書き換えた証跡そのもの |

### 送信元を登録し直す場合（Brevo が使えなくなったとき）

Resend でも同じことができる。ドメイン認証は済んでいる（`resend._domainkey` ＋ `send.pilot-value.com` の SPF/MX）。

1. Resend → API Keys → Create → Permission `Sending access` / Domain `pilot-value.com`
2. Gmail に貼る前に、その資格情報だけで認証が通るか確かめる:
   ```sh
   RESEND_API_KEY=re_あたらしいキー node mail-bot/smtp-check.mjs
   ```
   `✓ 認証に成功した（235）` が出れば、あとで Gmail が失敗しても原因を Gmail 側の設定に絞れる。
   **Gmail は認証に失敗しても「認証できませんでした」としか言わない**ので、先に切り分けておく。
3. 設定 → アカウントとインポート → 「他のメールアドレスを追加」

| 項目 | 値 |
|---|---|
| 名前 | `PILOT VALUE`（**実名を入れない**） |
| メールアドレス | `info@pilot-value.com` |
| **送信方法** | **「SMTP サーバー経由で送信」を選ぶ** ← ここが最重要 |
| SMTP サーバー | `smtp.resend.com` |
| ポート | `587` |
| ユーザー名 | `resend`（固定文字列。メールアドレスではない） |
| パスワード | 手順1の API キー |
| 接続 | TLS（推奨） |

> ⚠️ **「Gmail 経由で送信」を選ぶと台無しになる。** Gmail が自前のサーバから送り、
> 元の個人アドレスを `X-Google-Original-From` に残したうえで、受信側に「…経由」と表示する。
> 相手が「元のメッセージを表示」を押せば個人アドレスが読める。

確認コードは `info@pilot-value.com` 宛に届き、Cloudflare が Gmail に転送する。

---

## セットアップ（オーナー作業）

### 1. Supabase に SQL を適用（1回だけ）
`db/schema-additions.sql` を Supabase → SQL Editor に貼り付けて実行（冪等なので何度流しても安全）。
これで `profiles` に `email_opt_in` / `email_opt_in_at` / `unsub_token` 列、解除 RPC（`unsubscribe` / `resubscribe`）、登録トリガ更新が入る。
確認：`select id, email, email_opt_in, unsub_token from public.profiles limit 5;`

> 適用前でもフロントは壊れない（signup は列が無ければ opt-in を落として登録継続）。ただし**配信・解除は SQL 適用が前提**。

### 2. Resend アカウント＋送信ドメイン認証
1. https://resend.com でアカウント作成。
2. **Domains → Add Domain** で `pilot-value.com` を追加。
3. 表示される **DNS レコード（SPF / DKIM、任意で DMARC）** をドメインの DNS に登録。
   - GitHub Pages とは別に、DNS 管理側（レジストラ / Cloudflare 等）で TXT/CNAME を追加。
   - 認証が **Verified** になるまで待つ（反映に数分〜数時間）。
4. **API Keys** で送信用キーを発行。
5. 送信元 `FROM_EMAIL`（例 `PILOT VALUE <noreply@pilot-value.com>`）は**認証済みドメイン**であること。未認証だと届かない／迷惑メール行き。

### 3. `.env` を作成
```
cp mail-bot/.env.example mail-bot/.env
```
`mail-bot/.env` を開いて埋める：
- `SUPABASE_SERVICE_KEY` … Supabase → Settings → API → **service_role secret**（⚠️ RLS を無視する強力キー。絶対に公開・コミットしない）
- `RESEND_API_KEY` … 手順2で発行したキー
- `FROM_EMAIL` / `ADMIN_EMAIL` / `SITE_URL` は既定のままで可

---

## 使い方

### 管理者通知（admin-notify.mjs）
```
node mail-bot/admin-notify.mjs            # 新規があれば info@pilot-value.com へ通知
node mail-bot/admin-notify.mjs --dry-run  # 送らず、対象件数と件名をプレビュー
node mail-bot/admin-notify.mjs --backfill # 状態を無視して全件（初回まとめ通知）
node mail-bot/admin-notify.mjs --since=2026-07-01T00:00:00Z
```
- **初回実行は「今」を基準に監視開始**し、過去分は送らない（backlog スパム防止）。全件通知したい時だけ `--backfill`。
- 口コミ本文に品質フラグ（連打／反復／水増し）を付す＝API 直投稿のすり抜けを管理者が気付ける。
- 状態：`.admin-notify-state.json`（`lastReviewAt` / `lastProfileAt`）。

### 会員配信（send.mjs）
```
node mail-bot/send.mjs welcome            # 新規オプトイン会員へ歓迎メール
node mail-bot/send.mjs digest             # オプトイン会員へ新着ダイジェスト
node mail-bot/send.mjs welcome --dry-run  # 送らずプレビュー
node mail-bot/send.mjs digest  --backfill # 初回：直近7日ぶんをまとめて
```
- `welcome` も**初回は監視開始**（既存会員には送らない）。既存全員へ送るなら `--backfill`。
- `digest` は既定で**前回実行以降**（初回は直近7日）の新着口コミを、`email_opt_in=true` の全員へ。
- 状態：`.send-state.json`（`lastWelcomeAt` / `lastDigestAt`）。

### 一度だけのお知らせ（send.mjs announce）

給与レポートを公開したことを、登録済みの会員に1通だけ知らせる。
文面は [announce-mail.mjs](announce-mail.mjs)。**cron には登録しない**（一度きり）。

```
node mail-bot/send.mjs announce                       # 送らない。誰に何が届くかだけ出す
node shot-remind.mjs --announce                       # 本文を絵で見る（5通り）
node mail-bot/send.mjs announce --to=info@pilot-value.com --send   # ★自分の受信箱で現物を見る
node mail-bot/send.mjs announce --send                # 本番
```

- **送る前に必ず `--to=` で1通、自分の受信箱に出して見る。** 絵では Gmail の折り返し・
  迷惑メール判定・リンクの見え方までは分からない。`--to=` は会員を1人も見に行かないので、
  誤って全員に飛ぶことがない。件名の頭に `[preview]` が付く。
  出し分けを変えて見るときは `--filed`（提出済みの側）と `--lang=ja|en|both`。

- **`announce` だけは既定が「送らない」。** 実際に飛ぶのは `--send` を書いたときだけ
  （`--dry-run` の付け忘れで全員に届く事故が起きない側に倒してある）。
- **1人1通。** 送った相手は `.send-state.json` の `announceSent` に控える。
  二度流しても同じ人には行かない。Resend 側にも `Idempotency-Key` を渡してある。
- 出し分けは2つ。**明細を出したことがあるか**（無い人には「できました」、
  ある人には「入力が短くなった」）と、**言語**。
  言語の判定は `remind-payslip/index.ts` の `langOf` をそのまま使う（判定を2本持たない）。
  氏名も居住国も手がかりが無い人には、**日英を1通に両方**入れる。
  当てずっぽうで英語に決めて読めない1通を送るより、そのほうがよい。
- **金額・会社名・明細の項目名は1つも入れない。** `node db/test-announce.mjs` が固定している
  （サイト側の文言・スキーマの「90日」とも突き合わせる。ネットも鍵も使わない）。
- 解除は受信箱のワンクリック（`List-Unsubscribe`）と本文のリンクの両方。
  押した先は本番で動いている `remind-payslip?u=` で、`email_opt_in` が落ちる。

---

## 定期実行（cron 例）
リポジトリを clone 済みのマシン（またはサーバ）で：
```cron
# 管理者通知は Edge Function（notify-admin）が即時に飛ばすので cron 不要。
# 二重に届くため、下の行は入れないこと（残してあるのは手動実行の書式の参考）。
#   0,15,30,45 * * * * cd /path/to/PILOT-VALUE && /usr/bin/node mail-bot/admin-notify.mjs >> mail-bot/admin.log 2>&1

# 歓迎メール：10分毎に新規オプトイン会員へ
*/10 * * * * cd /path/to/PILOT-VALUE && /usr/bin/node mail-bot/send.mjs welcome >> mail-bot/send.log 2>&1

# ダイジェスト：毎週月曜 9:00
0 9 * * 1 cd /path/to/PILOT-VALUE && /usr/bin/node mail-bot/send.mjs digest >> mail-bot/send.log 2>&1
```
`node` の絶対パスは `which node` で確認。`/path/to/PILOT-VALUE` は実際の clone 先に置換。

---

## 導入手順（推奨フロー）
1. `db/schema-additions.sql` を適用。
2. Resend でドメイン認証（Verified）＋ API キー発行。
3. `.env` を作成して値を投入。
4. `node mail-bot/admin-notify.mjs --dry-run` → 対象と件名を確認。
5. Resend で自分宛にテスト送信できたら（`--dry-run` を外す）、cron 登録。
6. `send.mjs` も同様に `--dry-run` → テスト送信 → cron。

## 注意
- `.env` と `.admin-notify-state.json` / `.send-state.json` は **`.gitignore` 済**。コミットしないこと。
- `service_role` キーはサーバ／手元のみ。フロント（HTML）には絶対に置かない（フロントは anon キーのみ）。
- 送信ドメイン未認証のまま本送信しない（到達率が落ち、ドメイン評価も毀損する）。
