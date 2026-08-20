# Apple ログインを追加する（保留中・着手条件つき）

作成 2026-08-19。**まだ実装していない。** ルフトハンザの同期からの要望を受けて調べた結果を、
着手を決めた日にそのまま実行できる形で残したもの。

---

## なぜ今やらないか

- Apple ログインには **Apple Developer Program（$99/年）が必須**。無料の道は存在しない。
- 現状の入口は Google と メール（パスワード / 6桁コード）の2系統。
  6桁コードはパスワード不要なので、「パスワードを作りたくない」という不便は既に解消済み。
  Apple が足すのは **iPhone でのワンタップ（Face ID）** の速さだけ。
- オーナー判断（2026-08-19）: **採用する方向。ただし今は払わない。**
  Google + メールで海外ユーザー 30〜100人を先に検証し、
  要望または登録離脱が確認できた段階で追加する。

[VISION.md](../VISION.md) の Decision Framework: 一次データを増やすか＝YES（投稿ゲートの摩擦を下げる）。
毎月戻る理由になるか＝間接的にYES。信頼＝中立。よって「作らない」ではなく「まだ作らない」。

---

## 着手の判定（これが出たら実行してよい）

いま計測できるもので判定する。新しい計装は要らない。

1. **登録離脱** — GA4 の `pay_login_start` と `pay_login_done` の差。
   [pay-login.js:177](../pay-login.js#L177) の `track()` が `method`（`google_new` / `google_existing` /
   `code_new` …）付きで GA4（`G-3XYF69VQ3X`）へ送っている。
   **始めた人の3割以上が完了していない**なら摩擦が実在する。
2. **会員数** — `node db/usage.mjs --all`（`PV_TEST_EMAILS` で自分を除外）。
   海外ユーザーが 30人を超えていること。母数が無い状態の離脱率は読めない。
3. **明示の要望** — 問い合わせか口コミで、同期以外からもう1件出たら。

**1 と 2 が同時に満たされる**、または **3 が満たされる**なら実行する。
どれも無いまま $99 を払うのは、VISION.md の「流行だから作る機能」に当たる。

---

## 費用

| | |
|---|---|
| 初期 | $99（Apple Developer Program・年額） |
| 継続 | $99/年 ＋ **6か月ごとの鍵の貼り替え作業**（罠4） |
| コード変更 | 5か所（小さい） |
| オーナー作業 | Apple 側の設定 30〜60分（初回のみ） |

---

## 工程1: Apple 側の設定（オーナー作業・コードより先）

Apple Developer に登録すると Apple には本名が渡るが、**利用者に見えるのは同意画面のアプリ名だけ**で、
本名は公開されない。[CLAUDE.md](../CLAUDE.md) の匿名化方針と矛盾しない。

1. Apple Developer Program に加入（個人・$99/年）
2. **App ID** を作る（例 `com.pilotvalue.web`）。Capabilities で「Sign in with Apple」を有効化。
   Server-to-Server notification endpoint は **空のまま**（Supabase は非対応）。
   ここに入れる名前が同意画面に出るので **`PILOT VALUE`** にする。
3. **Services ID** を作る（例 `com.pilotvalue.web.signin`）。「Sign in with Apple」を Configure して:
   - Domains and Subdomains: `supabase.co,vzgmnkrggrwtsrpqndsm.supabase.co`
   - Return URLs: `https://vzgmnkrggrwtsrpqndsm.supabase.co/auth/v1/callback`
   - ※ `pilot-value.com` はここには入れない。Apple から戻る先は Supabase であって当サイトではない。
4. **Keys** で Sign in with Apple 用の鍵を作り、`AuthKey_XXXXXXXXXX.p8` を落とす。
   **`.p8` はリポジトリに入れない**（PUBLIC ＋ GitHub Pages でそのまま配信される）。
   **1回しかダウンロードできない。** バックアップは iCloud の Claude-Backup へ。
5. **Sign in with Apple for Email Communication** に送信元を登録（罠1・必須）
6. Supabase ダッシュボード → Authentication → Providers → Apple を有効化し、
   Team ID / Key ID / Services ID / `.p8` の中身を入れる。

**Redirect URLs の追加は不要。** Apple から戻ったあとの転送先は Google と同じ
`https://pilot-value.com/auth-callback.html` で、既に許可済み。

---

## 工程2: コード変更（5か所）

現状 `signInWithOAuth` は5か所。**すべて `provider: 'google'` を `'apple'` にした同型を1つ足すだけ。**
`redirectTo` の式・`?next=` の運び方・着地先は Google とまったく同じにする。

[auth-callback.html](../auth-callback.html) は **変更不要**。プロバイダを見ておらず、
[auth-callback.html:107](../auth-callback.html#L107) が `full_name || name || メールの@前` と既に落ちてくれる。
`flowType: 'pkce'` も login / signup の4枚に既に入っている。

| ファイル | ボタン | 呼び出し |
|---|---|---|
| [login.html](../login.html) | 150-153（`.btn-google`） | 563-583 `handleGoogle()` |
| [en/login.html](../en/login.html) | 150-153 | 562-579 |
| [signup.html](../signup.html) | 168-171（`.btn-oauth`） | 423 `signupGoogle()` |
| [en/signup.html](../en/signup.html) | 168-171 | 423 |
| [pay-login.js](../pay-login.js) | 232 / 245（`.pl-google`） | 336-340 `google()` |

やり方:

- **Apple のロゴ SVG は [pay-login.js](../pay-login.js) の `GOOGLE_SVG`（101-107行）と同じく定数にする。**
  Google の G アイコンは既に5ファイルにコピペされている。Apple で同じ轍を踏まない。
- 見た目は既存の `.btn-google` / `.btn-oauth` / `.pl-google` をそのまま使い、
  ロゴだけ白の Apple マークにする（暗い半透明ピル＝Apple の黒ボタンとほぼ同じ見え方）。
  ブランド色は発明しない。`transition-all` は使わない。
- 文言は Apple の公式表記に合わせる:
  日本語 **「Appleでサインイン」**、英語 **"Sign in with Apple"**。
  ※サイト内の他は「ログイン」で統一しているので**ここだけ「サインイン」になる**。
  Apple のガイドラインが公式文言を求めているため、そちらを優先する（実行時にオーナー確認）。
- 並び順は各画面の既存ルールに従う: `login.html` は Google の下、`signup.html` は Google の下、
  `pay-login.js` は各ブロックの Google の直下。
- `pay-login.js` の `track()` の method に `apple_new` / `apple_existing` を足す。

### ⚠️ 同じコミットで直さないと落ちるテスト

[db/test-form-contract.mjs:245](../db/test-form-contract.mjs#L245) が `pay-login.js` の
`stashOptIn()` の出現回数が **ちょうど3回**（定義1＋呼び出し2）であることを検査している。
Apple の「登録」ボタンからも同意を預けるので **4回になり、このテストが落ちる。**
期待値を 4 に上げ、コメントの「会員登録の2経路」も直す。

逆に **ログイン側（`pl-a-in` 相当）からは `stashOptIn()` を呼ばない。**
既に決めてある人の設定を、レポートを見に来ただけの操作で書き換えないため
（同ファイル 246-247行の検査が効いている）。

ボタンのクラス名・SVG・文言・並び順を変えて落ちるテストは他に無い（2026-08-19 に確認）。

---

## 4つの罠（どれも黙って壊れる種類のもの）

### 罠1: 「メールを非公開」を選ばれるとリマインドが全部バウンスする ★最重要

Apple には「メールを非公開」があり、選ばれると `xxx@privaterelay.appleid.com` になる。
Apple はこの中継アドレス宛のメールを、**登録されていない送信元からは問答無用で弾く。**

当サイトの月次リマインド（[supabase/functions/remind-payslip/index.ts:247](../supabase/functions/remind-payslip/index.ts#L247)）も
お知らせメール（[mail-bot/announce-mail.mjs](../mail-bot/announce-mail.mjs)）も Resend 経由で送っている。
Apple が見るのは**封筒の差出人ドメイン**で、実測すると:

```
send.pilot-value.com   TXT  "v=spf1 include:amazonses.com ~all"
send.pilot-value.com   MX   10 feedback-smtp.ap-northeast-1.amazonses.com
```

→ Apple Developer → Services → **Sign in with Apple for Email Communication** に
**`send.pilot-value.com` を登録する**（SPF は既に通っているので、登録するだけでよい）。
`pilot-value.com` の SPF は Cloudflare Email Routing 用で SES を含まないため、こちらでは通らない。

登録を忘れると、Apple で入った人には**リマインドが一通も届かない。**
月次更新は North Star の2番目（月次継続率）そのものなので、これは機能の停止と同じ。
しかも送信側からは成功に見える。

### 罠2: 既存ユーザーが Apple で入ると別アカウントになる

Supabase が同一ユーザーに繋げるのは **メールアドレスが一致し、かつ検証済みのとき**だけ。
「メールを非公開」を選ぶとアドレスが変わるので、
**Google やメールで登録済みの人が Apple で入ると新規アカウントになり、
これまでの投稿・解放（`access_until`）・連続月数（`streak_months`）が引き継がれない。**

新規の人（＝ルフトハンザの同期）には起きない。既存ユーザーだけの問題。
**オーナー判断は保留。実行時に決める。** 選択肢は2つ:

- **(A) Apple ボタンの下に1行だけ注記**
  「すでに登録済みの方は、Apple でもメールアドレスを共有してください」。実装コストほぼゼロ。
  普段は UI に注記を足さない方針だが、**黙っていると投稿データが失われる**ので例外に当たる。
- **(B) プロフィール画面から後で連結できるようにする**
  Supabase の手動連結（`linkIdentity`）を有効にし、[profile.html](../profile.html) に導線を足す。
  注記は要らないが、画面が1つ増える。

### 罠3: Apple は氏名を初回しかくれない

Apple が氏名を渡すのは**一番最初の1回だけ**で、2回目以降は空。
[db/schema-additions.sql:88](../db/schema-additions.sql#L88) の `handle_new_user` は
`raw_user_meta_data->>'name'` しか見ていないので、Apple 経由だと `profiles.name` が空になりうる。

実害はメールの言語判定に出る。
[supabase/functions/remind-payslip/index.ts:104](../supabase/functions/remind-payslip/index.ts#L104) の `langOf()` は
**氏名に漢字・かなが入っているか**で日本語かを決めている。氏名が空だと居住国で判定され、
ドバイ在住の日本人パイロット（＝中心的な読者）に**英語のリマインドが飛ぶ。**

対処は2段:
- `handle_new_user` を `coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name')` にする。
  **SQL は Supabase の SQL Editor で手で流すまで反映されない。**
- Apple から入った人は必ず [profile.html](../profile.html)（氏名欄は264行）に着地させる。
  `login.html` / `signup.html` 経由は既定で profile.html に行くので問題なし。
  **`pay-login.js` だけは pay-report.html に戻す**設計なので、ここは氏名が空のまま残る。

### 罠4: 6か月ごとに鍵を貼り替えないと、黙ってログインできなくなる

Apple のクライアント秘密鍵は**最長6か月で失効**する。Supabase は自動更新しない。
切れると Apple ログインだけが止まり、**利用者には「ログインに失敗しました」としか出ない。**

2026-08-10 に `parse-payslip` で同じ形の事故が起きている（鍵が死んで、利用者には
「読み取れませんでした」としか出ないまま止まっていた）。同じ罠を作らない。

実行時に必ず一緒にやること:
- `.p8` を iCloud の Claude-Backup に置く（再ダウンロード不可）
- **カレンダーに5か月後の貼り替えリマインドを入れる**
- 貼り替えの手順をこのファイルに追記する

---

## 検証

OAuth は localhost では完結しない（`redirectTo` が本番URLに固定されている）。ただし
**Apple 側は Supabase のコールバックしか見ていない**ので、localhost からボタンを押しても
Apple のサインイン画面までは正しく出て、認証後は本番の `auth-callback.html` に着地する。
＝ **localhost 起点でも通しで確認できる。**

1. `node serve.mjs` を起動
2. `http://localhost:3000/login.html` で Apple ボタンを押す
   → Apple のサインイン画面が出る → 認証 → `pilot-value.com/profile.html` に着地する
3. **「メールを共有」と「メールを非公開」の両方で1回ずつ試す**（罠1・2の実地確認）
4. 非公開で作ったアカウント宛に `node mail-bot/send.mjs`（`--dry-run` を外す）で1通送り、
   **バウンスしないこと**を Resend のダッシュボードで確認する ← 罠1の唯一の確かめ方
5. `node screenshot.mjs http://localhost:3000/login.html apple` で日英・ライト/ダーク両方を撮り、
   Read で読んで既存ボタンとの余白・角丸・文字サイズのズレを実測で比べる
6. デプロイ前チェック（[CLAUDE.md](../CLAUDE.md)）のうち最低限:
   - `node db/test-form-contract.mjs` ← 上の「落ちるテスト」
   - `node db/test-login-redirect.mjs`
   - `node db/test-session-expiry.mjs`
   - `node assert-langtoggle.mjs`
   - `node assert-no-pii.mjs`
7. push はオーナー承認後。push 後に本番で 2〜4 をもう一度通す

---

## やらないこと

- Apple のためだけに `auth-callback.html` を書き換えない（プロバイダ非依存のまま保つ）
- `.p8` と Team ID / Key ID をリポジトリに入れない
- Apple のロゴ SVG を各 HTML にコピペしない（Google の G で既に5枚に増えている）
- 判定条件が満たされないうちに $99 を払わない
