# レポートに足す4項目 — Days Off / 住居 / フライト数 / Verified バッジ

モックにあって、いまの給与レポートに無い4つ。**設計だけ。まだ1行も実装していない。**
オーナー承認の後に、下の「実装の順番」どおりに進める。

関連: [VERIFIED-PILOT.md](VERIFIED-PILOT.md)（Verified の付与条件・オーナー原文） /
[db/pay-reports.sql](db/pay-reports.sql)（テーブルと集計の実体） /
[VISION.md](VISION.md)（作るかどうかの判断基準）

---

## 0. 先に：4つは正体が違う

「列を足す」で片づくのは半分だけだった。実際に調べた結果はこう。

| モックの項目 | いまの状態 | やること |
|---|---|---|
| **Days Off** | 列が無い。フォームも聞いていない | **列を1本足す**（`days_off`） |
| **フライト数** | 列が無い。フォームも聞いていない | **列を1本足す**（`sectors`） |
| **住居** | **列は前からある**（`housing_type` / `housing_amount`）。フォームも集めている | 列は足さない。**画面に出していないだけ**＋比較用の集計に無い |
| **Verified バッジ** | **列は前からある**（`pay_reports.verify_level` / `profiles.verify_level` / `badge`）。**誰も書き込んでいない** | 列は足さない。**配線が要る**（3段・別フェーズ） |

つまり新しい列は **2本だけ**。残り2つは「持っているのに使っていない」状態を解く作業。

---

## 1. なぜ足すのか（[VISION.md](VISION.md) の4問）

| 問い | 答え |
|---|---|
| 一次データが増えるか | **増える。** 世界のどの給与サイトも持っていない軸（休日・セクター）。公開情報からは絶対に作れない＝真似されない |
| 毎月戻る理由になるか | **なる。** 金額は年1回しか動かないが、休日とセクターは毎月違う。「先月より3日多く休めて、支給は同じ」は毎月見に来る理由になる |
| 信頼を高めるか | **高める。** いまは現物支給の社宅が現金報酬から外れていて（意図どおり）、社宅ありの人が実際より安く見える。住居を別軸で出すとこの歪みが消える |
| 企業価値を高めるか | **高める。** 法人が本当に欲しいのは金額よりも「うちの条件で人が採れるか」。休日とセクターはそこに直接効く |

4問すべて YES。作る。

**この4つが1つの塊である理由。** 金額だけでは「良い会社」を決められない。
`+¥2,700万` の隣に「ただし休日は月8日、セクターは月62本」が並んで初めて、
本人が自分で判断できる。金額単体を大きく出すほど、この事業は転職斡旋に近づいて
信頼を落とす。**休日とセクターは、金額の意味を薄めるためにこそ足す。**

---

## 2. 設計の要 — 人数は「集計ごとに」数える

これが今回いちばん危ない罠。

いまの公開集計 [pay_benchmarks](db/pay-reports.sql) は最後に `having count(*) >= 5` が付いていて、
「5人未満の区分は行ごと消える」ようになっている。だから安全だと思いがちだが、
**これはセル全体の人数しか見ていない。**

新しい2列は**任意入力**なので、5人のセルでも「休日を書いたのは1人」ということが起きる。
そのまま `median(days_off)` を出すと、名前は中央値でも**中身はその1人の実数**が
そのまま公開される。5人いるから安全、にはならない。

**だから、新しい集計は1つずつ「その項目を書いた人が5人以上いるか」を見る。**

```sql
case when count(days_off) >= 5
     then percentile_cont(0.5) within group (order by days_off) end
```

`count(列名)` は null を数えない。これで「書いた人が5人未満なら null（＝画面に出ない）」になる。
住居の割合・住宅手当の中央値も同じ形で書く。**この形を崩さない。**

もう一つ。**新しい列を `group by` に入れない。** 区分を細かくすると n が割れて、
`会社 × 職位 × 機材 × 年 × 休日8日` まで絞れた瞬間に個人が透ける。
基地（`base_iata`）を集計に出していないのと同じ理由で、休日もセクターも
**集計値としてだけ**出す。粒度は今のまま動かさない。

---

## 3. SQL（オーナーが Supabase の SQL Editor で流す）

承認が出たら `db/pay-extras.sql` として置く。冪等（何度流しても同じ）。
**push では反映されない。** 流すまで画面には1つも出ない（全部 nullable なので既存は無傷）。

### 3-1. 列を2本足す

```sql
alter table public.pay_reports
  add column if not exists days_off smallint,
  add column if not exists sectors  smallint;

-- add column if not exists は check を後付けしないので、制約はここで冪等に張る
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pay_reports_days_off_chk') then
    alter table public.pay_reports add constraint pay_reports_days_off_chk
      check (days_off is null or days_off between 0 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pay_reports_sectors_chk') then
    alter table public.pay_reports add constraint pay_reports_sectors_chk
      check (sectors is null or sectors between 0 and 400);
  end if;
end $$;

comment on column public.pay_reports.days_off is
  'ロスターで OFF と指定された日数。年休・スタンバイ・訓練・病欠は含めない。'
  '★「月の日数 − 乗務日数」で作らない。年休を10日取った月が「10日休めた」に化ける。';
comment on column public.pay_reports.sectors is
  '有償フライトの区間数（離陸〜着陸で1本）。デッドヘッドは含めない。'
  '★ block hours だけでは「長距離8本」と「短距離80本」が同じ数字になる。'
  '疲労と拘束の量はここにしか出ない。';
```

**なぜ休日を引き算で作らないか。** 一見「31 − 乗務日数」で足りそうに見えるが、
その間には年休・スタンバイ・訓練・病欠が入る。引き算で作ると、
**年休を取った月ほど「よく休めた月」に見える**という、実感と正反対の数字になる。
休みの質を測るのが目的なので、ここは本人に聞く。

**なぜセクターの上限が400か。** 短距離の最繁忙で月80〜100本。400は
「打ち間違いを弾くが、実在する人を弾かない」線。31日 × 1日13本が理論上限。

### 3-2. 本人の履歴に返す（`my_pay_reports`）

`r.duty_days,` の隣に2行足すだけ。

```sql
           r.duty_days, r.days_off, r.sectors,
```

本人の行しか返さない関数なので、公開集計側の匿名性ルールとは無関係
（`duty_days` を足したときと同じ理屈）。

### 3-3. 投稿で受け取る（`submit_pay_report`）

3か所に足す。既存のキーは1つも変えない。

```sql
-- ① insert の列一覧（duty_days の隣）
    base_pay, hourly_rate, guaranteed_hours, block_hours, duty_days, days_off, sectors, per_diem,

-- ② values（同じ位置）
    nullif(p->>'duty_days','')::smallint,
    nullif(p->>'days_off','')::smallint,
    nullif(p->>'sectors','')::smallint,
    nullif(p->>'per_diem','')::numeric,

-- ③ on conflict の update（＝訂正で消えないように）
    days_off = excluded.days_off, sectors = excluded.sectors,
```

③を忘れると、**同じ月を出し直しても休日とセクターだけ古い値のまま残る**
（＝この2つだけ訂正が効かない画面になる）。

### 3-4. 公開集計に足す（`pay_benchmarks` は view なので作り直すだけ）

```sql
drop view if exists public.pay_benchmarks;
create view public.pay_benchmarks as
select airline, "position", fleet, period_year,
       count(*)                                                        as n,
       percentile_cont(0.5)  within group (order by annual_total_usd)   as median_usd,
       percentile_cont(0.25) within group (order by annual_total_usd)   as p25_usd,
       percentile_cont(0.75) within group (order by annual_total_usd)   as p75_usd,
       percentile_cont(0.5)  within group (order by usd_per_block_hour) as median_usd_per_bh,

       -- ★ ここから下は「その項目を書いた人が5人以上いるとき」だけ値を出す。
       --   having count(*) >= 5 はセル全体の人数しか見ていないので、
       --   5人のうち1人しか書いていない項目をそのまま出すと、
       --   中央値と名乗ったままその1人の実数が公開される。
       case when count(days_off) >= 5
            then round(percentile_cont(0.5) within group (order by days_off)::numeric)
       end                                                              as median_days_off,
       case when count(sectors) >= 5
            then round(percentile_cont(0.5) within group (order by sectors)::numeric)
       end                                                              as median_sectors,
       -- 住居は「額」ではなく「形」が先。社宅か・手当か・無しか。
       -- 10%刻みに丸める＝5人中1人を 20% と出しても、誰の話かは絞れない。
       case when count(housing_type) >= 5
            then round(100.0 * count(*) filter (where housing_type = 'provided')
                       / count(housing_type) / 10) * 10
       end                                                              as housing_provided_pct,
       -- 現金の住宅手当だけの中央値。現物支給（社宅）は金額が無いので混ぜない。
       -- ここも「手当を書いた人が5人以上」が条件。
       case when count(*) filter (where housing_type = 'allowance'
                                    and housing_amount is not null) >= 5
            then round(percentile_cont(0.5) within group (
                   order by case when housing_type = 'allowance'
                                 then housing_amount * fx_to_usd end), 2)
       -- ★ 名前に _mo を入れる。上の median_usd は年額、これは月額。
       --    同じ「usd」でも桁が2つ違うので、列名だけ見て同じ段に並べると嘘になる。
       end                                                              as median_housing_usd_mo,

       count(*) filter (where verify_level >= 1)                        as n_verified,
       max(period_month)                                                as latest_month
  from public.pay_reports
 where annual_total_usd is not null and airline_other is null
 group by 1, 2, 3, 4
having count(*) >= 5;

grant select on public.pay_benchmarks to anon, authenticated;
```

`percentile_cont` は null を無視する（PostgreSQL の順序集合集約の仕様）ので、
`case when … end` で外した行はそのまま計算から落ちる。
`fx_to_usd` は `where annual_total_usd is not null` の時点で必ず入っている
（`annual_total_usd` はレートがある通貨でしか作られない）。

### 3-5. 検算（流した後にこれだけ流す）

```sql
-- ① 列が入ったこと（期待：2行）
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='pay_reports'
   and column_name in ('days_off','sectors');

-- ② 公開集計に準識別子が出ていないこと（期待：0行）
select column_name from information_schema.columns
 where table_schema='public' and table_name='pay_benchmarks'
   and column_name in ('base_iata','seniority_years','proof_hash','airline_other',
                       'period_month','days_off','sectors','housing_type');

-- ③ 「書いた人が5人未満」の区分で、値が漏れていないこと（期待：0行）
--    左が生データ側の人数、右がビューが出している値。
--    人数が1〜4なのに値が入っている行が1つでもあれば、その1人の実数が公開されている。
select b.airline, b."position", b.fleet, b.period_year,
       s.n_days_off, b.median_days_off, s.n_sectors, b.median_sectors
  from public.pay_benchmarks b
  join (select airline, "position", fleet, period_year,
               count(days_off) as n_days_off, count(sectors) as n_sectors
          from public.pay_reports
         where annual_total_usd is not null and airline_other is null
         group by 1,2,3,4) s
    on (s.airline, s."position", s.fleet, s.period_year)
     = (b.airline, b."position", b.fleet, b.period_year)
 where (s.n_days_off between 1 and 4 and b.median_days_off is not null)
    or (s.n_sectors  between 1 and 4 and b.median_sectors  is not null);

-- ④ 本人の履歴が新しい2列を返すこと（期待：2行とも true）
select k as 必要な項目, position(k in pg_get_functiondef(p.oid)) > 0 as 返している
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
       unnest(array['days_off','sectors']) as k
 where n.nspname='public' and p.proname='my_pay_reports';
```

---

## 4. フォーム（[pay-report.html](pay-report.html)）— チップを2つ足すだけ

必須項目を増やさない。いま「乗務日数」「基地」がそうなっているように、
**畳んだ任意欄（チップ）**として足す。必須が増えると投稿が減る＝一次データが減る。

```html
<div class="opt-fld" id="opt-f-daysoff" hidden>
  <div class="fld">
    <label class="form-label" for="f-daysoff">休日数（月）</label>
    <input type="number" id="f-daysoff" class="form-input" min="0" max="31" step="1" inputmode="numeric"/>
    <p class="fld-hint">ロスターで <b>OFF</b> と指定された日数。年休・スタンバイ・訓練は含めません。</p>
  </div>
</div>
<div class="opt-fld" id="opt-f-sectors" hidden>
  <div class="fld">
    <label class="form-label" for="f-sectors">フライト数（月・セクター）</label>
    <input type="number" id="f-sectors" class="form-input" min="0" max="400" step="1" inputmode="numeric"/>
    <p class="fld-hint">離陸から着陸までで<b>1本</b>。デッドヘッド（移動のための搭乗）は含めません。</p>
  </div>
</div>
```

チップ（[pay-report.html:779](pay-report.html#L779) の並び）に2つ追加：

```html
<button type="button" class="chip" data-open="f-daysoff"><span class="p">+</span>休日数</button>
<button type="button" class="chip" data-open="f-sectors"><span class="p">+</span>フライト数</button>
```

送信の payload（[pay-report.html:1834](pay-report.html#L1834) の `duty_days` の隣）：

```js
    duty_days:           val('f-duty'),
    days_off:            val('f-daysoff'),
    sectors:             val('f-sectors'),
```

**入力の見張り（弾かずに注意だけ）**
乗務日数 + 休日数 がその月の日数を超えたら、赤字ではなく注記で
「合計が◯日を超えています。年休やスタンバイは休日に含めていませんか？」と出す。
**送信は止めない。** 会社によって日の数え方が違う（時差で日をまたぐ）ので、
こちらの定義でパイロットの実感を否定しない。

**英語版も同時に。** フォームは日英で同じファイル構成なので、
`en/pay-report.html` にも同じ2欄を足す（Days off / Sectors flown）。

**明細からの自動読み取りはやらない。** 休日もセクターも、**給与明細ではなく
ロスターに書いてある**。[parse-payslip](supabase/functions/parse-payslip/index.ts) は
明細1枚しか見ないので、埋められない。無理に読ませると「AIが推測した数字」が
一次データに混ざる（VISION の禁止事項）。手入力のまま置く。

---

## 5. 画面（[my-value.js](my-value.js)）

### 5-1. 今月の実績 — ミニ枠に2つ足す

`block hours` / `duty hours` / `乗務日数` が並んでいる帯（[my-value.js:643](my-value.js#L643)）に、
`休日 ◯日` と `フライト ◯本` を足す。既存の規約をそのまま踏襲：
**読めた数字だけ並べる。無い枠は 0 で埋めない**（0本と未入力は別のこと）。

### 5-2. 新しい2つの物差し（分母が変わると見えるものが変わる）

| 物差し | 式 | 何が分かるか |
|---|---|---|
| 1フライトあたりの報酬 | 総支給 ÷ セクター数 | 短距離と長距離を同じ土俵に乗せる |
| 1休日あたりの拘束 | 総勤務時間 ÷ 休日数 | 「よく稼ぐ」と「休めない」の距離 |

★ どちらも**セクター数・休日数が入っている月だけ**出す。
★ **良い・悪いを付けない。** 既存の「増減に色で優劣を付けない」規約と同じ。

### 5-3. 住居 — 「支給構成」の下に事実を1行

いま住居はドーナツの1切れにしかなっていない。しかも**現物支給の社宅は
現金報酬に足していない**（[pv_annual_total](db/pay-reports.sql#L269) が意図的にそうしている）。
正しい扱いだが、**画面がそれを言っていない**ので、社宅の人は自分の年収が
不当に低く出ていると感じる。1行足すだけで解ける。

- 社宅（現物）→ 「住居：会社支給（現物）。**現金報酬には含めていません。**」
- 住宅手当（現金）→ 「住居：住宅手当 ¥◯◯（現金報酬に含めています）」
- なし → 「住居：手当なし」

### 5-4. 機会カードに3行足す（会員の記録が5人集まった区分だけ）

いまの札は「年間報酬の差」と「時間あたりの差」だけ。ここに
`median_days_off` / `median_sectors` / `housing_provided_pct` を足す。

★ **null の行は出さない。**「—」も出さない（項目名だけ並ぶと、
データがあるのに0だと読める）。3-4 の `case when … >= 5` が null を返してくる
のが唯一の判断材料で、画面側で人数を数え直さない。

★ **金額と同じ大きさにしない。** 差額が主、条件は従。

### 5-5. 公開情報にもとづく札（いまの本番）はそのまま

[salary-data.mjs](salary-data.mjs) には休日もセクターも無い。
無いものを「掲載平均」として出さない。会員の記録が5人集まった区分でだけ、
3行が生える。

---

## 6. Verified バッジ — 列ではなく配線

### 6-1. いま起きていること

- `pay_reports.verify_level`（0〜3）も `profiles.verify_level` / `verified_airline` / `verified_at` も**列は前からある**。
- **どこからも書き込まれていない。** [submit_pay_report](db/pay-reports.sql#L434) の insert に `verify_level` が無い。
- 結果、`pay_benchmarks.n_verified` は**構造的に常に0**。
- [db/test-form-contract.mjs:123](db/test-form-contract.mjs#L123) が
  「`my-value.js` に verified という語を書かない」を守らせている
  ＝**まだ動いていないものを表示しないための、意図的な足かせ**。

### 6-2. 3段の配線（順番を守る。逆から作ると偽の Verified が出る）

**① 付ける — [parse-payslip](supabase/functions/parse-payslip/index.ts) が付与する**

明細を実際に読み切ったときだけ、サーバが `profiles.verify_level = 1` を立てる。
この関数はすでに（a）呼び出し元のトークンから本人の `user.id` を取り
（[parse-payslip/index.ts:287](supabase/functions/parse-payslip/index.ts#L287)）、
（b）サービスロールで RPC を叩いている（`pv_parse_quota_take_v2`）。
同じ形で `pv_mark_verified(p_uid uuid, p_method text)` を1本足すだけ。

```sql
create or replace function public.pv_mark_verified(p_uid uuid, p_method text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set
    verify_level  = greatest(coalesce(verify_level, 0), 1),
    verify_method = coalesce(verify_method, p_method),
    verified_at   = coalesce(verified_at, now()),   -- 初回だけ
    badge         = case when badge in ('none','','contributor') then 'verified' else badge end
  where id = p_uid;
end $$;
revoke all on function public.pv_mark_verified(uuid, text) from public, anon, authenticated;
```

**★ anon にも authenticated にも渡さない。** サービスロール（Edge Function）だけが呼べる。
ここを開けると、画面から直接叩いて誰でも Verified になる。

**② 刻む — [submit_pay_report](db/pay-reports.sql#L434) が行に写す**

```sql
verify_level  ← coalesce(v_prof.verify_level, 0)
verify_method ← v_prof.verify_method
verified_at   ← v_prof.verified_at
```

投稿時点の値を刻む。**後から失効しても過去の行は書き換えない**
（VERIFIED-PILOT 決定2）。これで初めて
「法人に売り物になるのは verify_level >= 1 の行だけ」というコメントが機能する。

**③ 出す — レポートの見出しの横に**

```
◯◯さんの報酬レポート   ✓ Verified Pilot
```

- 表示は**1種類だけ**（VERIFIED-PILOT「認証方法は表示しない。表示は統一する」）。
- **付いていない人には何も出さない。**「未検証」と書かない。
  大多数が未検証なので、書いた瞬間にサイト全体が「疑われている場」になる。
- `badge_state` が `inactive`（90日更新なし）でも**バッジは消さない**
  （VERIFIED-PILOT「月次更新をしないことだけでは失効しない」）。
  鮮度は Active Contributor 側の概念で、そちらとは別に扱う。

### 6-3. 契約テストの書き換え（③と同じコミットで）

[db/test-form-contract.mjs:123](db/test-form-contract.mjs#L123) の1行を、
「出すな」から「**出どころを間違えるな**」に変える。

```js
/* ④ Verified は verify_level（サーバが立てた値）からしか出さない。
   source はクライアントの自己申告なので、明細を1枚も出さずに 'payslip' と
   送れてしまう。ここで分岐させたら Verified は名前だけのものになる。 */
ok(!/\bsource\b/.test(MV), `my-value.js は source（自己申告）で分岐していない`);
ok(!/verified/i.test(MV) || /verify_level|\bbadge\b/.test(MV),
   `Verified を出すなら verify_level / badge からしか出していない`);
```

**★ ①②が本番に入るまで、この行は今のまま変えない。** テストを先に緩めると、
「誰にも付かないバッジ」を表示する余地がその日から空く。

### 6-4. 正直に書いておく限界

明細は**端末内で氏名を落としてから**送る設計なので、
サーバは「この明細がこの人のものか」を確認できない。
つまりここでの Verified は
**「この account が機械で読める給与明細を1枚提出した」**という意味であって、
本人確認ではない。VERIFIED-PILOT の方法1はこれを承知で最優先に置いている。
**画面でそれ以上のことを言わない。**

### 6-5. 明細の会社名とフォームの会社が食い違ったとき（オーナー決定・2026-08-11）

**黙って記録する。** 投稿は通す。画面には何も出さない。

理由：読み違えるのはほぼ**こちら側**だから。ロゴだけの明細・持株会社名（"Japan Airlines Co., Ltd." と
"JAL"）・地域子会社（"Cathay Dragon"）・派遣会社経由（明細の差出人が乗務先と違う）。
ここで弾くと、**正しく申告した人ほど投稿できない**。警告を出すのも同じで、
「間違っているのはあなたです」と読める文言をこちらの誤読で出すことになる。

具体的にどうするか：

| | |
|---|---|
| `pay_reports.airline` | **フォームで本人が選んだ会社**。ここは動かさない。集計もページもこれで動く |
| `profiles.verified_airline` | **明細から読めた会社**。サーバが確認できたのはこちらだけなので、こちらを入れる |
| 画面 | 何も言わない。バッジも普通に付く（Verified の意味は「機械で読める明細を出した」なので会社の一致は条件ではない） |
| 記録 | 下の集計テーブルに「読めた会社／選ばれた会社」の組と件数だけを残す |

記録先は**件数だけの小さなテーブル**にする。`user_id` も `proof_hash` も時刻も持たない
（日付までで丸める）ので、投稿と突き合わせて個人に戻せない。
これは**読み取り精度を測るための運用データ**であって、会員のデータではない。

```sql
create table if not exists public.pv_airline_mismatch (
  seen_on        date not null default current_date,
  parsed_airline text,          -- 明細から読めた方
  chosen_airline text,          -- 本人が選んだ方
  n              int  not null default 1,
  primary key (seen_on, parsed_airline, chosen_airline)
);
alter table public.pv_airline_mismatch enable row level security;   -- ポリシーは作らない
revoke all on public.pv_airline_mismatch from anon, authenticated;
```

書き込むのは security definer の関数だけ（`pv_mark_verified` に相乗りさせる）。
**溜まったら上位の組を語彙の別名表に入れる。** 弾くのではなく、読めるようにするのが直し方。

⚠️ このテーブルは**今日の2列の SQL には入れない**。書く側（parse-payslip）が
本番に入るまで空のまま残るだけなので、下の実装順の 4 で一緒に流す。

---

## 7. やらないこと（理由つき）

| やらないこと | なぜ |
|---|---|
| 休日・セクターを明細から自動で読む | ロスターにしか書いていない。AIに推測させたら一次データではなくなる |
| 休日を「月の日数 − 乗務日数」で作る | 年休を取った月ほど「よく休めた」に化ける |
| 新しい2列を公開集計の `group by` に入れる | 区分が細かくなり n が割れる。基地を出していないのと同じ理由 |
| 航空会社ページに休日・セクターを載せる | 会員の記録が5人集まった区分がまだ1つも無い。集まってから |
| 年金・税の比較 | 中央値がどこにも無い。推測で埋めない（今回の4項目の外） |
| Verified を投稿回数・継続で付ける | 自己申告を3回繰り返しても本物の証明にならない（[db/pay-reports.sql:246](db/pay-reports.sql#L246) のコメント） |

---

## 8. 実装の順番

| # | 何を | 誰が | 前提 |
|---|---|---|---|
| 1 | **`db/pay-reports.sql` を丸ごと流し直す**（3-1〜3-4 を反映済み・冪等） | **オーナー**（SQL Editor） | 承認 |
| 2 | フォームに欄2つ（日英） | Claude | 1 が済んでいなくても壊れない（無視される） |
| 3 | レポートの表示（5-1〜5-4） | Claude | 1 |
| 4 | Verified ①付与（`pv_mark_verified` ＋ 6-5 の集計テーブル ＋ parse-payslip 差し替え） | **オーナー**（SQL ＋ Edge Function を Deploy） | 承認 |
| 5 | Verified ②刻印（`submit_pay_report` 差し替え） | **オーナー**（SQL Editor） | 4 |
| 6 | Verified ③表示＋契約テスト書き換え | Claude | 4・5 が本番に入ってから |

1〜3 と 4〜6 は独立している。**片方だけ進めても壊れない。**

⚠️ `supabase/functions/` は push では本番に反映されない。
ダッシュボード → Edge Functions → コードを貼り替えて Deploy（オーナー作業）。
