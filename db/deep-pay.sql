-- ════════════════════════════════════════════════════════════════════════
-- db/deep-pay.sql — DEEP PAY（給与の中身を集計して見る画面）のサーバ側
--
-- 貼る順番：db/pay-reports.sql → db/pay-rows.sql → **このファイル**
--   （pv_sig2 / pv_my_give / pv_deep_contributors / pv_pay_person_map を使う）
--
-- ════════════════════════════════════════════════════════════════════════
-- この画面が答えるのは5つだけ。
--   ① この会社・この役職はいくらもらうのか
--   ② そのうち固定はどれくらいで、変動はどれくらいか
--   ③ どれだけ働いてその額なのか
--   ④ 変動給は何で増えているのか
--   ⑤ この数字はどれくらい信じてよいのか
--
-- ★ REAL PAY（pv_pay_rows）は「1行＝1人」を返す。こちらは**1人も返さない。**
--   返すのは区分（cohort）ごとに束ねた中央値と割合だけ。
--   ★2026-10-11 から、**その区分に何人いるかも返さない**（オーナー判断）。
--     隠すのではなく、最初から渡さない。画面に渡すのは信頼度の3段（cohort.trust）だけ。
--
-- ★2026-10-11、このファイルに関数を2つ足した。
--     pv_deep_step      … 見出しの数字を刻みに寄せる小さな道具（2-b 章・誰にも開かない）
--     pv_pay_breakdown  … 総支給だけ出した本人が、**その月に内訳だけ足す**口（4章）
--   ⚠️ 下の約束①〜⑦は集計の関数（pv_deep_pay）のもの。pv_pay_breakdown は集計ではなく
--      **呼んだ本人の1行**だけを扱うので、守るものは4章の頭に別に書いてある。
--
-- ════════════════════════════════════════════════════════════════════════
-- 守っている約束（db/pay-rows.sql の①〜⑦をこの画面の形に写したもの）
--
--   ① Give → Get   鍵（access_until）と、本人が内訳を出していること（detailed）の
--                  両方が要る。REAL PAY より深い画面が、より弱い鍵で開いてはいけない。
--   ② 割合で返す    内訳は**割合**が主。金額は「画面に出ている丸めた年収 × 割合」でしか
--                  作れない形にする。1人ずつの実額を組み立てられないようにするため。
--   ③ 丸めて返す    1円まで合う数字は個票の証拠になる。**丸める前の中央値は1つも返さない。**
--                  ★2026-10-11 から、丸め方は2通り（オーナー判断）──
--                    ・見出しの2つだけは**刻み**に寄せる（pv_deep_step）。
--                        年収の中央値       … $50 刻み （円でおよそ ¥8,000）
--                        Pay / Block Hour  … $0.5 刻み（円でおよそ ¥80）
--                      前はこの2つも有効数字2桁だった（$148,140 → $150,000）。
--                      刻みにしたので、画面が 万円の位・¥100 の位まで出せる。
--                    ・それ以外の金額（給与構成の月額）は今までどおり pv_sig2
--                      ＝有効数字2桁。**こちらは細かくしていない。**
--                  ⚠️ 刻みをこれ以上細かくしない。細かくするほど、少人数の区分で
--                     「中央値からその人の実額を割り戻す」幅が狭くなる。
--   ④ 1行＝1人      proof_hash で束ねてから中央値を取る。同じ人の6か月分は1人。
--   ⑤ 語彙の中だけ  pv_deep_pay(p jsonb) は会社・役職・機材を受け取る。
--                  ★2026-08-30 に引数ゼロから変えた。初めは「呼んだ本人の区分」しか
--                    出さなかったが、REAL PAY（pv_pay_rows）が既に**全社の行**を
--                    見せている以上、DEEP PAY だけ自分の区分に閉じているのは
--                    筋が通らない（オーナー判断）。
--                  引数が増えたぶんは、この2つで守る ──
--                    (a) 受け取った値は pv_airlines / pv_positions / pv_fleets に
--                        **在るものだけ**通す。無い値は空を返す。知らない値を
--                        「広い区分」に読み替えない。読み替えると、打ち間違いに
--                        別の区分の数字が出て、読み手はそれと気づけない。
--                    (b) 手で選んだ区分は**はしごを登らない**。人数の壁（v_min。
--                        3章の頭を読む）に届かなければそのまま「まだ出せません」。
--                        広い区分の数字を、狭い区分の見出しのまま出すことをしない。
--                  人数の壁は誰が選んでも同じに掛かる。引数では緩められない。
--   ⑥ 準識別子ゼロ  投稿月・作成日時・proof_hash・自由入力の社名・年代・在籍年数は
--                  返さない。返すのは会社・役職・機材（＝選んだ本人が渡した値、
--                  または呼んだ本人が既に知っている自分の値）だけ。
--   ⑦ 常識の幅      年 $10,000〜$700,000 の外は数えない。
--
-- ════════════════════════════════════════════════════════════════════════
-- ★★ pv_pay_comp / pv_pct5 / pv_pending_comp（db/pay-rows.sql 3章）は使わない。★★
--
--   あちらの頭に「DEEP PAY を作る回に内訳優先へ直すこと」と書いてあるが、直さなかった。
--   理由は3つで、どれも直すほうが危ない。
--
--     1. assert-pay-rows.mjs が pv_pay_comp の**本文を切り出して grep している**。
--        本文を1行変えるとあの検査が落ちる。
--     2. db/pay-rows.sql の自己点検が **20個の型を並べた署名文字列**で
--        to_regprocedure している。引数を1つ増やすと null になって❌になる。
--     3. そもそも5バケツ {m,b,d,h,o} では、この画面が要る9区分を表現できない。
--        あちらは**年額・賞与込み**、こちらは**月額・賞与抜き**。分母も分子も別物。
--
--   だから pv_pay_comp は**1バイトも触らず、誰からも呼ばれないまま**残す。
--   ⚠️ 将来ここを「共通化」したくなっても、あちらを配線しないこと。
--      同じ数字を2か所で計算していたのが、あの o = 0 のバグが誰にも気づかれずに
--      残った理由そのもの。
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 1. pv_my_keys — 呼んだ本人の proof_hash を作り直す
--
-- pv_my_give()（db/pay-rows.sql 1-e）の中に同じ式が埋まっているが、
-- あちらは language sql で本文の中に閉じていて切り出せない。**写しが2つある。**
-- 片方を直したらもう片方も直すこと。db/test-deep-pay.mjs が
-- 「2つが同じ人の行を拾う」ことを検査して固定している。
--
-- 引き方は my_pay_reports()（db/pay-reports.sql 5-b）と同じ。**式を変えないこと。**
-- ★誰にも grant しない。security definer の中からだけ呼ぶ。
-- ════════════════════════════════════════════════════════════════
drop function if exists public.pv_my_keys();

create or replace function public.pv_my_keys()
returns setof text
language sql
security definer
stable
set search_path = public, extensions
as $fn$
  -- 一覧から選んだ会社：コードは有限なので総当たりでハッシュを作れる
  select encode(extensions.digest(
           auth.uid()::text || '::pv_pay::' || a.code, 'sha256'), 'hex')
    from public.pv_airlines a
   where auth.uid() is not null
  union
  -- 「一覧にない会社」：ハッシュに自由入力の社名が入っているので総当たりでは
  -- 引けない。実在する社名だけを候補にして作り直す。ここで他人の書いた社名を
  -- 読むが、使うのはハッシュの材料としてだけで、関数の外へは1文字も出ない。
  select encode(extensions.digest(
           auth.uid()::text || '::pv_pay::other::' || o.nm, 'sha256'), 'hex')
    from (select distinct lower(airline_other) as nm
            from public.pay_reports
           where airline = 'other' and airline_other is not null) o
   where auth.uid() is not null;
$fn$;

revoke all on function public.pv_my_keys() from public, anon, authenticated;

comment on function public.pv_my_keys() is
  '呼んだ本人の pay_reports.proof_hash を作り直して返す。'
  'pv_my_give() の中の同じ式の写し（あちらは切り出せない）。両方を同時に直すこと。'
  '★誰にも grant しない。pv_deep_pay() の中からだけ呼ぶ。';


-- ════════════════════════════════════════════════════════════════
-- 2. pv_deep_pct — 割合の配列を「合計ちょうど100」の整数にする
--
-- 中央値をそれぞれ取ると合計は100にならない（別々の人の中央値なので当然）。
-- そのまま出すと「62 + 20 + 8 + 5 + 3 + 2」が100にならず、
-- 読む人が数え直して「壊れている」と思う。最大剰余法で配る。
--
-- pv_pct5（db/pay-rows.sql 3-b）を n 個に一般化したもの。
-- ★pv_pct5 そのものは触らない（署名が db/pay-rows.sql の自己点検で固定されている）。
--
-- 入力は割合の配列（合計は1でなくてよい）。null と負は 0 として扱う。
-- 出力は同じ長さの整数配列。全部 0 なら null を返す（＝画面は描かない）。
-- ★誰にも grant しない。
-- ════════════════════════════════════════════════════════════════
drop function if exists public.pv_deep_pct(numeric[]);

create or replace function public.pv_deep_pct(p numeric[])
returns int[]
language plpgsql
immutable
as $fn$
declare
  n     int := coalesce(array_length(p, 1), 0);
  tot   numeric := 0;
  i     int;
  v     numeric;
  out_a int[] := '{}';
  frac  numeric[] := '{}';
  sum_i int := 0;
  rest  int;
  bi    int;
  bf    numeric;
  live  boolean;
begin
  if n = 0 then return null; end if;

  for i in 1 .. n loop
    tot := tot + greatest(coalesce(p[i], 0), 0);
  end loop;
  if tot <= 0 then return null; end if;

  -- 100 を掛けて整数部と小数部に分ける
  for i in 1 .. n loop
    v := greatest(coalesce(p[i], 0), 0) / tot * 100;
    out_a := out_a || floor(v)::int;
    frac  := frac  || (v - floor(v));
    sum_i := sum_i + floor(v)::int;
  end loop;

  rest := 100 - sum_i;

  -- 余りを、小数部の大きい区分から1ずつ配る（最大剰余法）
  while rest > 0 loop
    bi := 0; bf := -1;
    for i in 1 .. n loop
      if frac[i] > bf then bf := frac[i]; bi := i; end if;
    end loop;
    exit when bi = 0;                 -- ありえないが、無限ループにしない
    out_a[bi] := out_a[bi] + 1;
    frac[bi]  := -1;                  -- 同じ区分に二度配らない
    rest := rest - 1;

    -- 配り切る前に候補が尽きたら、いちばん大きい区分へ残りを寄せる
    if rest > 0 then
      live := false;
      for i in 1 .. n loop
        if frac[i] >= 0 then live := true; end if;
      end loop;
      if not live then
        bi := 1;
        for i in 1 .. n loop
          if out_a[i] > out_a[bi] then bi := i; end if;
        end loop;
        out_a[bi] := out_a[bi] + rest;
        rest := 0;
      end if;
    end if;
  end loop;

  return out_a;
end;
$fn$;

revoke all on function public.pv_deep_pct(numeric[]) from public, anon, authenticated;

comment on function public.pv_deep_pct(numeric[]) is
  '割合の配列を、合計ちょうど100の整数％にする（最大剰余法）。'
  'pv_pct5 を n 個に一般化したもの。★誰にも grant しない。';


-- ════════════════════════════════════════════════════════════════
-- 2-b. pv_deep_step — 金額を「刻み」のいちばん近い倍数に寄せる（2026-10-11）
--
--   148140 を 50 刻みで → 148150      92.59 を 0.5 刻みで → 92.5
--
-- 使うのは pv_deep_pay の**見出しの2つだけ**（年収の中央値＝$50・
-- Pay / Block Hour＝$0.5）。なぜこの2つだけ刻みなのかは、ファイル冒頭の約束③。
-- ★pv_sig2（db/pay-rows.sql）は触っていない。あちらは REAL PAY の1行＝1人の額を
--   丸めている道具で、桁を増やすと個票の証拠になる。**あちらに刻みを持ち込まない。**
-- ★null と 0 以下は null（pv_sig2 と同じ。0 を置いて埋めない）。
-- ★刻みは呼ぶ側が定数で渡す。利用者の入力から刻みを決める道を作らないこと
--   （刻みを 0.01 にされれば、丸めていないのと同じになる）。
-- ★誰にも grant しない。security definer の中からだけ呼ぶ。
-- ════════════════════════════════════════════════════════════════
drop function if exists public.pv_deep_step(numeric, numeric);

create or replace function public.pv_deep_step(v numeric, p_step numeric)
returns numeric
language sql
immutable
as $fn$
  select case when v is null or v <= 0 then null
              else round(v / p_step) * p_step
         end;
$fn$;

revoke all on function public.pv_deep_step(numeric, numeric) from public, anon, authenticated;

comment on function public.pv_deep_step(numeric, numeric) is
  '金額を刻み（p_step）のいちばん近い倍数に寄せる。null と 0 以下は null。'
  'pv_deep_pay の見出しの2つ（年収の中央値＝$50・Pay / Block Hour＝$0.5）だけが使う。'
  '★誰にも grant しない。pv_sig2 の代わりではない（あちらは触っていない）。';


-- ════════════════════════════════════════════════════════════════
-- 3. pv_deep_pay — 画面がこれ1つだけを呼ぶ
--
-- 引数ゼロ（約束⑤）。区分は**呼んだ本人の最新の1行**からサーバが決める。
--
-- ── 区分のはしご ──────────────────────────────────────────
--   1  会社 × 役職 × 機材
--   2  会社 × 役職 × 機材区分（fleet_cat = r / n / w）
--   3  会社 × 役職
--   4  役職のみ（全社）
--   5  全体
-- 別々の人が v_min 人以上そろう**最初の段**を採る。
--
-- ★ cohort.level を必ず返して画面に出すこと。隠すと読み手は
--   「自分の会社の数字だ」と思い込む。段4の数字を段1だと思って
--   転職を決める人が出る。**この画面でいちばん危ないのはそこ。**
-- ★ 返す会社・役職・機材は**呼んだ本人自身の値**。落ちてきた元の段の
--   会社名は返さない（約束⑥）。
--
-- ── 人数の壁（v_min）──────────────────────────────────────
-- ★2026-10-11、壁を 3人 → **2人** に下げた（オーナー判断）。
--   数字が在るのは関数の頭の定数 v_min の**1か所だけ**。本文のどこにも
--   人数を直書きしない（片方だけ直すと「選べるのに選ぶと空」が黙って起きる）。
--   ★数え方は変えていない ──「内訳を書いた月を持つ実人物」（下の lvl / avail）。
-- 書いた人が1人のセルで percentile を取ると、「中央値」と名乗ったまま
-- その1人の実数が公開される（db/pay-reports.sql の pay_benchmarks に
-- 同じ理由が書いてある）。**1人のセルは今も1つも出さない。**
-- **区分ごと・列ごと・内訳の項目ごとに、それぞれ v_min を掛ける。**
-- ⚠️ 2人のセルの中央値は、その2人の平均。自分がその1人なら、もう1人の額を
--    割り戻せる。壁を下げたぶん、外側の守りは次の2つになった ──
--      ・その区分に何人いるかを返さない（下の「人数は返さない」）
--      ・金額は丸めてから返す（ファイル冒頭の約束③。刻みを細かくしないこと）
-- ⚠️ 待遇アンケート（db/airline-conditions.sql）の壁は 3人のまま。前は
--    「あちらと同じ閾値」だったが、いまは**別の数**。そろえ直すならオーナーに聞く。
--
-- ── 人数は返さない（2026-10-11・オーナー判断）────────────────
-- 前は cohort / head / comp / 賞与の4か所で、その区分の人数を返していた。
-- 全部やめた。**隠すのではなく、最初から渡さない**（画面で伏せるだけだと、
-- 関数を直接叩けば取れる）。
-- かわりに返すのは cohort.trust の3段（high / mid / low）だけ。
--   式は、2026-10-11 まで画面（deep-pay.js）が人数から出していたものをそのまま
--   ここへ移した（画面の側の式はもう無い ── 画面は返ってきた段を読むだけ）。
--   中身は、人数の段（10人以上・5人以上・それ未満）と、区分の狭さ
--   （会社×役職×機材まで絞れているか）の、**低いほう**を採る。
--   区分が広いほど「自分の給与」から遠いので、人数が多くても「高」にしない。
-- ⚠️ gate.contributors / gate.goal / stats.* は**サイト全体**の数で、区分の人数ではない。
--    左メニューの札と Give の誘いが使っているので、これは返し続ける。
--
-- ── 預かりと口コミを混ぜない ──────────────────────────────
-- 預かり（pay_reports_pending）は payload に機材も検証段階も無く、
-- ip_day_hash は日をまたぐと変わる＝同じ人を2人に数えて約束④を壊す。
-- 口コミ由来の給与は内訳を1つも持たない＝分母だけ増やして分子に何も足さない。
-- どちらも人数（stats.contributors）にだけ使い、集計には入れない。
--
-- ── 内訳を書いた人だけを数える ────────────────────────────
-- この画面は「給与の中身」の画面なので、総支給しか書いていない人は
-- 区分（coh）に入れない。入れると全員が未分類100%になり、
-- ドーナツが灰色一色になる。人数表示（stats）とは別の数であることに注意。
-- ════════════════════════════════════════════════════════════════
drop function if exists public.pv_deep_pay();          -- 引数ゼロだった頃のもの
drop function if exists public.pv_deep_pay(jsonb);

create or replace function public.pv_deep_pay(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_until timestamptz;
  v_give  jsonb;
  v_key   boolean;
  v_det   boolean;
  v_open  boolean;
  v_air   text := nullif(btrim(coalesce(p ->> 'airline',  '')), '');
  v_pos   text := nullif(btrim(coalesce(p ->> 'position', '')), '');
  v_flt   text := nullif(btrim(coalesce(p ->> 'fleet',    '')), '');
  v_man   boolean;   -- 手で選んだか（＝本人の区分ではないか）
  v_bad   boolean := false;   -- 語彙に無い値が来たか
  -- 解放に要る人数。返り値の goal もここから出す。
  -- ★ここが唯一の場所（2026-09-01）。前は pv_deep_goal() から取っていたが、
  --   数字を見る場所がこの1か所だけになったので直書きに戻した。
  v_goal  constant int := 100;
  -- 区分ごとの人数の壁（内訳を書いた実人物が、この人数に届かない区分は出さない）。
  -- ★ここが唯一の場所（2026-10-11・オーナー判断で 3 → 2）。本文の比較は全部
  --   この名前で書いてある。**数字を本文に直書きしない**（自己点検 9 が見ている）。
  -- ⚠️ 100人の門（v_goal）とは別物。あちらはサイト全体・こちらは区分ごと。
  -- ⚠️ 下の宣言は字面のまま検査が見ている（空白を足して桁をそろえない）。
  v_min constant int := 2;
  v_ctb   int;       -- 今までに給与を出したユニークな人数（今の実数）
  v_lch   boolean;   -- 正式公開の手動フラグが立っているか
  v_byp   boolean;   -- 試験だけの抜け道（本番では立たない。下の注を読む）
  v_crd   boolean;   -- 「みんなの側」の条件が満たされているか（100人 or 手動フラグ）
  v_out   jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select p.access_until into v_until from public.profiles p where p.id = v_uid;
  v_give := public.pv_my_give();

  -- ★門は3つとも要る（約束①）。
  --   access_until … REAL PAY と同じ90日の鍵。
  --   detailed     … 本人が内訳まで出していること。pv-gates.js に条件として
  --                  書いてあるが、今まで JS にしかなかった＝devtools で素通しできた。
  --                  ここが唯一の実装場所。
  --   100人        … 「給与を出したパイロットが100人に達したら開く」という
  --                  プロダクトの約束（2026-09-01）。今までは画面に札を出すだけで
  --                  **どこも強制していなかった**（JS にも無い）。ここが唯一の実装場所。
  -- ★人数は pv_deep_contributors()（db/pay-rows.sql 1-h）＝**札と同じ関数**。
  --   ここに数え方を書き写すと「画面は 100 / 100 人なのに開かない」が起きる。
  --   proof_hash をそのまま数えないこと（本人 × 会社で1つ＝2社に出した1人が2人になる）。
  -- ★ここで raise しない。投げると画面がエラーになり、
  --   「1枚出せば開く」という肝心の伝え方ができなくなる（pv_pay_rows と同じ）。
  -- ★運営（pv_admins）は鍵が無くても開く（2026-09-03。REAL PAY 側と同じ理由）。
  --   内訳の側（v_det）は pv_my_give が既に運営を通しているので、この1行で両方そろう。
  v_key  := (v_until is not null and v_until > now()) or public.pv_is_operator();
  v_det  := coalesce((v_give ->> 'detailed')::boolean, false);
  v_ctb  := public.pv_deep_contributors();

  /* ★試験だけの抜け道（オーナー確定 2026-09-01）
     「本番では強制する。ただし開発・検証ができなくなるのは困る。
       本番で管理者だけ静かに迂回できる隠し例外は作らない。」

     だから合言葉ひとつでは開けない。**2つとも**要る：
       ① auth.users が存在しないこと ── 試験の器（PGlite）は auth.uid() の
          代役だけ作って auth.users を作らない。本番の Supabase には必ず在る。
          ＝**本番ではこの条件が立てようがない。** 誰が何を設定しても開かない。
       ② そのうえで pv.deep_bypass を明示的に立てること。
     管理者フラグも合言葉も見ない。見ると「本番の管理者だけ迂回できる」形になる。 */
  v_byp  := (to_regclass('auth.users') is null
             and coalesce(current_setting('pv.deep_bypass', true), '') = 'on');

  /* ★解放条件はこの2つだけ（オーナー確定 2026-09-01）。
       ・今のユニークな人数が100人以上
       ・正式公開の手動フラグが立っている（db/pay-rows.sql の pv_deep_launch）
     フラグは**管理者が一度だけ手で立てる。** 自動では立たないし、自動では降りない。
     ⚠️ フラグを立てるまでは、100人 → 99人 に落ちれば普通に閉じる。
        （前の版は100人到達をトリガで自動記録していた。取りやめた。）
     ⚠️ フラグを立てたあとは人数が減っても開いたまま ── でないと
        「100人を保つために消してほしい人のデータを残す」という
        やってはいけない動機が生まれる。**削除依頼が来た人のデータは普通に消す。**
     ⚠️ 区分ごとの人数の壁（v_min）はこれとは別物で、今のデータで毎回判定する
        （壁を割ればその区分は消える。下の thin を見る）。
     ⚠️ gate.contributors は今の実数を出し続ける（99 と出たまま開いているのが正しい）。 */
  v_lch  := exists (select 1 from public.pv_deep_launch);
  /* ★「みんなの側」の条件を1つの値にまとめ、gate.crowd としても返す（2026-10-11）。
       閉じている理由は3つある（鍵が無い／本人の内訳が無い／まだ100人に届かない）。
       前は3つめを、画面が contributors と goal を比べて自分で判定していた。
       それだと手動フラグで開けたあと（99人のまま開いている日）にも、鍵の無い人へ
       「100人に届いたら開く」の行が出る ── その人を止めているのは人数ではないのに。
       **門と同じ式の答え**をそのまま渡し、本当にそれが理由のときだけ出せるようにする。
     ⚠️ 式を2か所に書かない。v_open が読むのも、返すのも、この v_crd の1つ。 */
  v_crd  := (v_lch or v_ctb >= v_goal or v_byp);
  v_open := v_key and v_det and v_crd;

  -- ★選べるのは語彙に在るものだけ（約束⑤a）。
  --   'other'（自由入力の社名）は選ばせない。別々の会社が other という1社に
  --   潰れて混ざるので、その見出しで数字を出すと嘘になる。
  --   ★語彙に無い値を null に読み替えて「広い区分」を返さないこと。
  --     打ち間違いに別の区分の数字が出て、読み手はそれと気づけない。
  --     v_bad は下の lvl で 0段を丸ごと消し、空の区分として返る。
  v_man := (v_air is not null or v_pos is not null or v_flt is not null);
  if v_air is not null and not exists (
       select 1 from public.pv_airlines a where a.code = v_air and a.code <> 'other')
    then v_bad := true; end if;
  if v_pos is not null and not exists (
       select 1 from public.pv_positions q where q.code = v_pos)
    then v_bad := true; end if;
  if v_flt is not null and not exists (
       select 1 from public.pv_fleets f where f.code = v_flt)
    then v_bad := true; end if;

  with
  -- ── 呼んだ本人の行 ──────────────────────────────────────
  keys as (select h from public.pv_my_keys() h),
  me as (
    select r.airline as airline, r."position" as pos,
           r.fleet as fleet, r.fleet_cat as cat
      from public.pay_reports r
     where r.proof_hash in (select h from keys)
     order by r.period_year desc, r.period_month desc, r.created_at desc
     limit 1
  ),

  -- ── 本棚（直近24か月・常識の幅の中だけ）────────────────────
  -- ★ここで選んだ列がすべて。増やす前にファイル冒頭の約束⑥を読む。
  sane as (
    select r.proof_hash                     as pkey,
           r.airline                        as airline,
           r."position"                     as pos,
           r.fleet                          as fleet,
           r.fleet_cat                      as cat,
           r.annual_total_usd               as usd,
           r.usd_per_block_hour             as ubh,
           r.block_hours                    as block_h,
           r.duty_hours                     as duty_h,
           r.duty_days                      as duty_d,
           r.stay_nights                    as stay_n,
           r.pay_items                      as items,
           /* ★2026-10-11、ここに在った「明細の裏付けがあるか」の列を外した。
              使い道は「うち明細あり◯人」という**人数**を返すことだけで、
              人数を返すのをやめたので読む場所が無くなった。 */
           -- 内訳を書いたか。pv_my_give の detailed と**同じ条件**にそろえる
           (r.base_pay is not null or r.guarantee_pay is not null
            or r.command_pay is not null or r.pay_items is not null) as det,
           /* ★内訳のうち、金額を書いていない行がある月（2026-09-12）。
              画面が pay_items.partial に立てる。ここで拾わないと、
              「変動給を1行だけ書いて、残りは分からないので空にした」月が
              **全額が揃った内訳**として割合の母集団に入り、固定給の割合が
              実際より高く出る。det と同じ考え方で、観測していないものを
              0% と読まないための印。
              ⚠️ これは**閲覧の資格ではない**（pv_my_give の門はこれを読まない）。
                 その人の REAL PAY / DEEP PAY は今までどおり開く。 */
           coalesce((r.pay_items->>'partial')::boolean, false)          as part,
           /* ── その月の現金（賞与ぬき）──────────────────────
              総支給がある人はそこから当月賞与を引く。無い人は
              pv_annual_total の第2分岐と**同じ並び**を12で割った形。
              ★あちらと1行ずつ揃えること。揃えないとドーナツの合計と
                年収カードが食い違う。 */
           case when nullif(r.gross_monthly, 0) is not null
                then greatest(r.gross_monthly - coalesce(r.bonus_month, 0), 0)
                     /* ★組合が直接払った分だけは総支給の外にある（2026-09-02）。
                        会社の明細に印字されないので、足さないと分母が小さいまま
                        ④役割手当だけが膨らみ、下の 1.02 倍の関所でこの行が
                        まるごと集計から落ちる。pv_annual_total と同じ1行。 */
                   + case when public.pv_union_outside_gross(r.pay_items)
                          then coalesce(r.union_pay, 0) else 0 end
                   /* ★不就労減額（欠勤控除など）も足し戻す（2026-09-12）。
                      印字の総支給は減額を**引いたあと**、下の9区分は引く**前**。
                      足さないと分母だけ小さく、同じ理由で 1.02 倍の関所に
                      引っかかってこの行がまるごと集計から落ちる。
                      年収（pv_annual_total）には1円も足さない。 */
                   + public.pv_absence_total(r.pay_items)
                else coalesce(r.base_pay, 0)
                   + coalesce(r.guarantee_pay, 0)
                   + coalesce(r.hourly_rate, 0)
                     * greatest(coalesce(r.block_hours, 0), coalesce(r.guaranteed_hours, 0))
                   + coalesce(r.per_diem, 0)
                   + case when r.housing_type = 'allowance'
                          then coalesce(r.housing_amount, 0) else 0 end
                   + coalesce(r.transport, 0)
                   + coalesce(r.command_pay, 0)
                   + coalesce(r.other_allowance, 0)
                   + coalesce(r.instructor_pay, 0)
                   + coalesce(r.examiner_pay, 0)
                   + coalesce(r.union_pay, 0)
                   + coalesce(r.management_pay, 0)
                   + coalesce(r.nonline_pay, 0)
           end                              as cash_m,
           /* ①基本給 ②保証手当・職務手当
              ★2026-09-15、1つだった a_fixed を2つに割った（オーナー指示）。
                フォームでは別々の欄なのに、図では同じ緑の1本に見えていた。
                足した数は1円も変わらない（cash_m も未分類の引き算も両方を足す）。
              ★★ db/pay-rows.sql の shelf と pv_pending_detail も同じに直す。★★ */
           coalesce(r.base_pay, 0)                                     as a_base,
           coalesce(r.guarantee_pay, 0)                                as a_gtee,
           -- ③ 変動給。書いていない人は「時給 × 実績と保証時間の大きい方」で見る
           --    （pv_annual_total と同じ建て付け）
           coalesce(r.flight_variable_pay,
                    coalesce(r.hourly_rate, 0)
                    * greatest(coalesce(r.block_hours, 0),
                               coalesce(r.guaranteed_hours, 0)))       as a_var,
           -- ④ 職位手当
           coalesce(r.command_pay, 0)                                  as a_cmd,
           -- ⑤ 役割手当（教官・審査・組合・管理・兼務）。どれも other_allowance の
           --    外にある別の入れ物なので、まとめてここで数える
           coalesce(r.instructor_pay, 0) + coalesce(r.examiner_pay, 0)
           + coalesce(r.union_pay, 0) + coalesce(r.management_pay, 0)
           + coalesce(r.nonline_pay, 0)                                as a_role,
           -- ⑤ パーディアム
           coalesce(r.per_diem, 0)                                     as a_pd,
           -- ⑥ 住宅手当。現物支給の社宅は現金ではないので数えない
           case when r.housing_type = 'allowance'
                then coalesce(r.housing_amount, 0) else 0 end          as a_house,
           /* ⑦ その他の現金手当
              ★★ この引き算が命綱。★★
              db/pay-reports.sql（5章）が pay_items.variable の合計を
              flight_variable_pay **と** other_allowance の**両方**に写している。
              素直に足すと変動給を二重に数える。
              pay-viz.js の segments() も split = (fv > 0 && fv <= other) で
              同じ罠を避けている。**外さないこと。**

              ★★ 直したら db/pay-rows.sql の2か所も同じに直す（2026-09-03）。★★
                 ・shelf CTE の a_other（本棚）
                 ・pv_pending_detail の 'other'（登録前の預かり）
              同じ式が**3か所**にある。片方だけ直すと、DEEP PAY のドーナツと
              REAL PAY の帯が**同じ人について違う内訳**を出す。どちらの画面も
              普通に動いたまま、数字だけが食い違う。
              ★共有関数にしていないのは、pay-rows.sql が deep-pay.sql より
                **先に**貼られるファイルだから（依存させると適用順が逆転する）。 */
           greatest(coalesce(r.other_allowance, 0)
                    - coalesce(r.flight_variable_pay, 0), 0)
           + coalesce(r.transport, 0)                                  as a_other,
           /* 賞与は**ドーナツに入れない**（オーナー確定）。年収に対する割合を
              別行で1つだけ出すので、ここで1行ぶんの割合にしておく。
              年収は本人の通貨に戻してから割る（USD どうしでも同じ値になるが、
              fx_to_usd が無い行を確実に外すためこの形にする）。

              ★★ bonus_month をここに足さない（2026-09-01 に直した）。★★
              その月の賞与は**総支給の中に既に入っている**。上の cash_m が
              総支給から1回引いていて、年収（pv_annual_total）も同じ理由で
              引いてから12倍している（db/pay-reports.sql 4章）。
              ここで ×12 して足すと、同じ賞与を年に2回数えることになり、
              賞与比率が実際より大きく・月額（ucm）が実際より小さく出る。
              足さないことで **年収 ×(1 − b_share) ÷ 12 ＝ cash_m** が
              恒等式になる（db/test-deep-pay.mjs が固定している）。 */
           case when r.fx_to_usd is not null and r.fx_to_usd > 0
                 and r.annual_total_usd is not null and r.annual_total_usd > 0
                then (coalesce(r.bonus_annual, 0) + coalesce(r.profit_share_annual, 0))
                     / (r.annual_total_usd / r.fx_to_usd)
           end                                                          as b_share
      from public.pay_reports r
     where r.annual_total_usd is not null    -- レートの無い通貨は落ちる
       and r.annual_total_usd between 10000 and 700000   -- 約束⑦
       /* ★「直近24か月」は**その報酬がいつのものか**で見る（2026-09-01 に直した）。
          投稿された日で見ていたので、2020年の給与を昨日書いた行が「直近」に入り、
          去年書いた去年の給与が今年落ちていた。
          db/pay-reports.sql の期間の列にも「created_at では"いつ時点の報酬か"が
          消える」と書いてあり、コードだけが食い違っていた。
          当月を含めて暦の24か月ちょうど（2026-09 なら 2024-10〜2026-09）。
          上限は保険 ── 未来の月は投稿時に既に弾いている
          （pv_validate_pay_payload の「未来の月は投稿できません」）。 */
       and make_date(r.period_year, r.period_month, 1)
             between (date_trunc('month', now()) - interval '23 months')::date
                 and  date_trunc('month', now())::date
  ),

  /* ── ここから下の並びを2026-09-01に組み替えた ────────────────
     前は「人に潰す → 区分で絞る」だった。だから
       ・FO のときの給与が、今 CAP の人の CAP の数字に混ざっていた
         （人を1行にした時点で、月ごとの役職が消えていた）
       ・人数の壁を proof_hash で数えていた＝**本人 × 会社**で1つなので、
         2社に出した1人が2人になり、壁に届いていないセルで中央値が出ていた
     今は「月次で絞る → 人に潰す」。順番を入れ替えただけで両方直る。

     hum → ok → tag → lvl → pick → mrow → person → coh
     ★過去の給与は1行も捨てない。FO だった月は FO の統計に残り、
       CAP になった月は CAP の統計に入る（オーナー確定 2026-09-01）。 */

  -- ── 月次行に「同じ人」を貼る ────────────────────────────
  -- ★当たらない行は落とす（fail closed）。「たぶん別人」として数え上げると
  --   壁に届いていないセルが届いたように見えて中央値が出る＝匿名性が破れる方向。
  --   落とすと数字が出ないだけで、誰の実額も漏れない。
  --   投稿のたびに profiles 行ができる（db/pay-reports.sql 6章）ので、
  --   正常に出した人がここで落ちることは無い。
  -- ★human はこの関数の中だけの連番。**返り値に入れないこと。**
  hum as (
    select s.*, m.human
      from sane s
      join public.pv_pay_person_map() m on m.h = s.pkey
  ),

  -- ── 1行ぶんの検品 ──────────────────────────────────────
  /* 現金が無い／内訳が現金をはみ出している行は割合に混ぜない。
     はみ出しは本人の書き間違いで、こちらで按分すると嘘の内訳になる。
     2%までは丸めの誤差として通す（給与フォームも合計一致を強制していない）。
     落とした数はどこにも出さない（出すと「何人が変な書き方をしたか」が漏れる）。 */
  ok as (
    select * from hum
     where cash_m is not null and cash_m > 0
       and (a_base + a_gtee + a_var + a_cmd + a_role + a_pd + a_house + a_other)
           <= cash_m * 1.02
  ),

  -- ── 選べる組み合わせ（会社・職位・機材）────────────────
  /* 画面の選択肢をこれで絞る。約束は1つ ── **選べる ＝ 必ず数字が返る**
     （オーナー確定 2026-09-01）。110社・3職位・19機材を素で並べると、中身が
     あるのは一握りで、選んだ先が「まだ出せません」しか無い選択肢が大半になる。

     ★**ここで閾値を決め直しているのではない。** 下の lvl と同じ数え方を、
       段ではなく「会社・職位・機材の絞り方」で割っただけ。材料も ok で同じ
       （直近24か月・約束⑦の幅・現金の検品まで通った行）。
       lvl は `group by lv, human having bool_or(det)` ＝「その区分の中に、
       内訳を書いた月を持つ人が何人いるか」。ここは先に where o.det で絞って
       count(distinct human) を数える。**同じことを別の書き方でしている**
       （どちらも「内訳の月を1つ以上持つ人」を1人と数える）。
       ⬆ ズレると「選択肢に出ているのに選ぶと空」が**画面は普通に動いたまま**起きる。
       自己点検 21 が、ここと lvl 側の両方が同じ v_min で比べていることを見ている。

     ★0段（tag の lv=0）と**同じ絞り方**を8通りぜんぶ数える。0段は
       「渡された v_air / v_pos / v_flt のうち、null でないものだけで絞る」
       ので、選択肢の組み合わせはちょうど 2×2×2 = 8通りしか無い。
       grouping sets で1回のなめで全部出す。

     ⚠️ **空文字は「絞っていない」の意味だけに使う。** coalesce(fleet,'') では
        書かないこと。いまは pay_reports の airline / position / fleet が3つとも
        not null（db/pay-reports.sql の表）なので当たらないが、当たった日には
        「機材を書かなかった人」と「機材で絞らない」が同じ鍵に潰れて、選択肢に
        出ていない機材が選べるようになる。grouping() で見分ける（下の3行）。

     ★'other'（一覧に無い航空会社）は**会社としては**選ばせない。別々の会社の
       答えが1社に潰れて混ざるため（tag の1〜3段・pay_benchmarks と同じ理由）。
       会社で絞らない側（grouping=1）には混ぜたまま ── 0段も v_air が null の
       ときは other を混ぜているので、そこと同じにする。 */
  /* ⚠️ 列名を a / p / f にしない。**p は関数の引数の名前**なので
        「column reference "p" is ambiguous」で落ちる（実際に踏んだ）。 */
  avail as (
    select case when grouping(airline) = 1 then '' else airline end as qa,
           case when grouping(pos)     = 1 then '' else pos     end as qp,
           case when grouping(fleet)   = 1 then '' else fleet   end as qf
      from ok o
     where o.det
     group by grouping sets ((airline, pos, fleet), (airline, pos), (airline, fleet),
                             (airline), (pos, fleet), (pos), (fleet), ())
    having count(distinct o.human) >= v_min
       and (grouping(airline) = 1 or airline is not null)
       and (grouping(pos)     = 1 or pos     is not null)
       and (grouping(fleet)   = 1 or fleet   is not null)
       and (grouping(airline) = 1 or airline <> 'other')
  ),
  /* 画面が引く形に組み直す。'' ＝「その軸で絞っていない」。
       air              … 会社を選ぶだけで数字が返る会社
       pos["ana"]       … ANA を選んだとき数字が返る職位（pos[""] は会社なし）
       flt["ana|cap"]   … ANA × 機長で数字が返る機材（flt["ana|"] / flt["|"] も同じ形）
     ★行き止まりが構造的に無い。air に居る会社は「会社だけ」で必ず返るので、
       職位・機材の「指定なし」はいつでも有効。
     ★名前を picks にしない。すぐ下に段の pick が居て1文字違いになる。 */
  avail_j as (
    select jsonb_build_object(
      'air', (select coalesce(jsonb_agg(qa order by qa), '[]'::jsonb)
                from avail where qp = '' and qf = '' and qa <> ''),
      'pos', (select coalesce(jsonb_object_agg(kk, vv), '{}'::jsonb)
                from (select qa as kk, jsonb_agg(qp order by qp) as vv
                        from avail where qf = '' and qp <> '' group by qa) t),
      'flt', (select coalesce(jsonb_object_agg(kk, vv), '{}'::jsonb)
                from (select qa || '|' || qp as kk, jsonb_agg(qf order by qf) as vv
                        from avail where qf <> '' group by qa, qp) t)
    ) as j
  ),

  -- ── その月がどの段に属するかの札 ────────────────────────
  /* ★役職・機材は**その月の行に書いてある値**で判定する（約束⑧・2026-09-01）。
     FO 検索には FO だった月だけ、CAP 検索には CAP だった月だけが入る。
     昇進した人の過去の給与を捨てるのではなく、**その頃の区分に残す**。
     機材を変えた人も同じ。
     ★自由入力の社名（airline = 'other'）は 1〜3段では外す。
       別々の会社の答えが other という1社に潰れて混ざるため
       （db/pay-reports.sql の pay_benchmarks に同じ理由が書いてある）。
     ★me を left join にする。呼んだ本人がまだ1枚も出していないとき、
       cross join だと段5（全体）まで空になる。
     ★条件を書くのはここ1か所だけ。前は数える側（lvl）と集める側（coh）に
       同じ条件が2つあり、ずれると「壁に届いたと数えた段に、実際は届いていない」が
       起きる作りだった。**その写しが消えた。** */
  tag as (
    select o.*, l.lv
      from ok o
      cross join (values (0),(1),(2),(3),(4),(5)) l(lv)
      left join me m on true
     where case l.lv
             -- 0段 ＝ 手で選んだ区分。★v_air は語彙に在るコードなので
             --   'other' は最初から入らない。会社を選んでいないときは
             --   4段・5段と同じく other も混ぜる。
             when 0 then v_man and not v_bad
                     and (v_air is null or o.airline = v_air)
                     and (v_pos is null or o.pos     = v_pos)
                     and (v_flt is null or o.fleet   = v_flt)
             -- 1〜5段 ＝ 何も選んでいないときだけ。本人の区分から順に落とす
             when 1 then not v_man and o.airline = m.airline and o.pos = m.pos
                     and o.fleet is not distinct from m.fleet
                     and o.airline <> 'other'
             when 2 then not v_man and o.airline = m.airline and o.pos = m.pos
                     and o.cat is not distinct from m.cat
                     and o.airline <> 'other'
             when 3 then not v_man and o.airline = m.airline and o.pos = m.pos
                     and o.airline <> 'other'
             when 4 then not v_man and o.pos = m.pos
             when 5 then not v_man
           end
  ),

  -- ── はしごを1段ずつ数える ────────────────────────────────
  /* ★数えるのは**実人物**（human）。proof_hash ではない。
       proof_hash は本人 × 会社で1つなので、2社に出した1人が2人になり、
       実は1人しか居ないセルで中央値が出る＝その人の実額がそのまま出る。
     ★数えるのは「その段の中に、内訳を書いた月を持つ人」＝下の person と同じ条件。 */
  lvl as (
    select lv, count(*) as n
      from (select lv, human from tag group by lv, human having bool_or(det)) z
     group by lv
  ),
  -- ★壁（v_min）に届く段が1つも無ければ -1（空）。5段（全体）にも落とさない
  --   （約束⑤b）。落として広い区分の数字を狭い見出しのまま出すことはしない。
  -- ★2026-09-01、手で選んでいないときの落ち先も -1 にした（オーナー確定）。
  --   前は 5（全体）へ落ちていたので、壁に届く段が1つも無いほど人が少なくても
  --   「全体の年収中央値」が出た＝ほぼその数人の年収そのもの。
  pick as (select coalesce(min(lv), -1) as lv from lvl where n >= v_min),

  -- ── 採った段の月次行 ────────────────────────────────────
  -- ★-1（選んだ区分が壁に届かなかった）のときは1行も残らない。
  --   pick.lv = -1 に当たる tag が無いので自然にそうなる。
  mrow as (
    select t.* from tag t cross join pick k where t.lv = k.lv
  ),

  -- ── 1行＝1人（約束④）──────────────────────────────────
  -- 同じ人の複数月は、ここで中央値にして1行に潰す。
  -- ★割合は「1人ごとの割合」を先に出してから中央値にする。
  --   金額の中央値どうしを割ると、通貨の違う人が混ざったときに壊れる。
  --   割合なら各人が自分の通貨のまま計算できて、為替が1度も入らない（約束②）。
  -- ★group by は human。前は pkey（本人 × 会社）だったので、2社に出した人が
  --   2行になって「1行＝1人」が破れていた。
  -- ★会社・役職・機材はもう持たない。区分の判定は上の tag で終わっていて、
  --   ここから下の CTE はどれも使わない。持たせると「人の代表値で絞る」
  --   古いやり方に戻す入口になる。
  person as (
    select human,
           (percentile_cont(0.5) within group (order by usd))::numeric     as usd_y,
           (percentile_cont(0.5) within group (order by ubh))::numeric     as ubh,
           (percentile_cont(0.5) within group (order by block_h))::numeric as block_h,
           (percentile_cont(0.5) within group (order by duty_h))::numeric  as duty_h,
           (percentile_cont(0.5) within group (order by duty_d))::numeric  as duty_d,
           (percentile_cont(0.5) within group (order by stay_n))::numeric  as stay_n,
           (percentile_cont(0.5) within group (order by b_share))::numeric as b_share,
           /* その月の現金を USD にしたもの（賞与ぬき）。給与構成の
              「月額（中央値）」の材料はこれ1つだけ。
              ★割合は通貨をまたげるが金額はまたげない。annual_total_usd は
                投稿した瞬間のレートで確定していて後から動かないので、
                同じ人の割合と同じ土俵に乗る（約束②を壊さない）。
              ★賞与の割合が出せない人（fx_to_usd が無い）は null にして
                金額の集計から外す。0 とみなすと賞与のぶんだけ月額が太る。 */
           case when (percentile_cont(0.5) within group (order by b_share)) is null
                then null
                else (percentile_cont(0.5) within group (order by usd))::numeric
                     * greatest(1 - (percentile_cont(0.5)
                                     within group (order by b_share))::numeric, 0)
                     / 12
           end                                                             as ucm,
           /* ── 給与構成の割合（8本）────────────────────────────
              ★ここだけ filter (where det and not part) を掛ける
                （det は 2026-09-01・part は 2026-09-12）。
                内訳を書いていない月は「固定給 0%」ではなく**観測していない**。
                混ぜると、内訳を書いた月が少ない人ほど割合が低く出て、
                「1人が3か月出して内訳は1か月だけ」で固定給が 100% → 33% に化ける。
                会社どうしの比較が静かに壊れる（画面は普通に動いたまま）。
              ⚠️ 上の年収（usd_y）・Pay per Block Hour（ubh）・働き方（block_h /
                 duty_h / duty_d / stay_n）・賞与（b_share / ucm）には**掛けない。**
                 総支給しか書いていない月も、**内訳を一部だけ書いた月**も、
                 そちらの統計には引き続き使う（年収は総支給から出ていて欠けていない）。
              ⚠️ having は bool_or(det) のまま。part で母集団から人を落とすと、
                 その人の年収・時間あたりまで DEEP PAY から消える。
                 落とすのは**割合の計算に使う月**だけ。 */
           (percentile_cont(0.5) within group (order by a_base / cash_m)
              filter (where det and not part))::numeric as s_base,
           (percentile_cont(0.5) within group (order by a_gtee / cash_m)
              filter (where det and not part))::numeric as s_gtee,
           (percentile_cont(0.5) within group (order by a_var   / cash_m)
              filter (where det and not part))::numeric as s_var,
           (percentile_cont(0.5) within group (order by a_cmd   / cash_m)
              filter (where det and not part))::numeric as s_cmd,
           (percentile_cont(0.5) within group (order by a_role  / cash_m)
              filter (where det and not part))::numeric as s_role,
           (percentile_cont(0.5) within group (order by a_pd    / cash_m)
              filter (where det and not part))::numeric as s_pd,
           (percentile_cont(0.5) within group (order by a_house / cash_m)
              filter (where det and not part))::numeric as s_house,
           (percentile_cont(0.5) within group (order by a_other / cash_m)
              filter (where det and not part))::numeric as s_other,
           (percentile_cont(0.5) within group (order by
              greatest(cash_m - (a_base + a_gtee + a_var + a_cmd + a_role
                                 + a_pd + a_house + a_other), 0) / cash_m)
              filter (where det and not part))::numeric as s_rest
      from mrow
     group by human
    having bool_or(det)          -- 総支給だけの人は「給与の中身」の母集団に入れない
  ),

  -- ── 採った段の人たち ────────────────────────────────────
  -- ★名前だけ残してある（下の CTE 群が全部 coh を見ている）。
  coh as (select * from person),

  -- ── 見出しの数字 ────────────────────────────────────────
  /* ★この2つだけ pv_deep_step（刻み）を通す（2026-10-11・ファイル冒頭の約束③）。
       年収の中央値      … $50 刻み
       Pay / Block Hour … $0.5 刻み
     前は2つとも pv_sig2（有効数字2桁）だった。**丸める前の中央値は今も返さない。**
     ⚠️ 下の cnorm の月額（pv_sig2）まで刻みに替えない。あちらは項目ごとに
        人数の壁を掛け直している細かい数で、細かくするほど割り戻しやすくなる。
     ★n は**返さない**（2026-10-11）。使うのは下の thin（壁）と trust（信頼度の段）だけ。
       前はここで「明細の裏付けがある人数」も数えて返していた。それもやめた。 */
  hagg as (
    select public.pv_deep_step((percentile_cont(0.5) within group (order by usd_y))::numeric, 50) as annual,
           case when count(ubh) >= v_min
                then public.pv_deep_step((percentile_cont(0.5) within group (order by ubh))::numeric, 0.5) end as ubh,
           count(*) as n
      from coh
  ),

  /* ── 人数の門（オーナー必須修正2・2026-09-01）──────────────
     ★v_min 人に満たないときは「画面で隠す」のではなく**返り値に入れない。**
       関数を直接叩いても、壁に届かない区分の集計値は1つも取れない。
     ★伏せるのは head / comp / work / var の4つ。
       返してよいのは「非公開だと画面が判断するための材料」だけ ──
       ok / state / gate / give / stats / cohort（level・本人が渡した区分。
       信頼度の段 trust は、このとき null）。
     ★pick が -1 のときも人数が 0 でここが立つ。門が二重なのは意図的で、
       はしごの式を将来1行変えたときの最後の壁として残す。 */
  thin as (select coalesce((select n from hagg), 0) < v_min as x),

  /* ── 信頼度の段（2026-10-11）── 人数のかわりに返す、たった1つの値 ──
     式は、それまで画面（deep-pay.js）が持っていたものを**そのまま**移した
     （画面の側の式はもう無い。画面は返ってきた段を読むだけ）。
       人数の段   … 10人以上＝3 ／ 5人以上＝2 ／ それ未満＝1
       区分の上限 … 会社×役職×機材（段1）・会社×役職×機材区分（段2）＝3
                     会社×役職（段3）＝2 ／ 役職のみ（段4）・全体（段5）＝1
                     手で選んだ区分（段0）は、選んだ軸の数で同じに決める
                     （3つ＝3 ／ 2つ＝2 ／ 1つ＝1）
       低いほうを採って 3＝high ／ 2＝mid ／ 1＝low。
     ★人数だけで決めない。段4に12人そろっても、それは全社の副操縦士12人であって
       自分の会社の数字ではない（そうしないと、いちばんあてにならない状態が
       「信頼度 高」と出る）。
     ★壁に届かない区分・段が無いとき（none）は null。数字を1つも出していない
       区分に「信頼度 低」と付けると、低いなりに数字が在るように読める。
     ⚠️ ここの 10 と 5 は**段の境目**で、人数の壁（v_min）ではない。
        境目を増やさないこと ── 段が細かくなるほど、段から人数が読める。 */
  trust as (
    select case when (select x from thin) or k.lv = -1 then null
                else case least(
                            case when h.n >= 10 then 3 when h.n >= 5 then 2 else 1 end,
                            case k.lv
                              when 0 then case (v_air is not null)::int
                                               + (v_pos is not null)::int
                                               + (v_flt is not null)::int
                                            when 3 then 3 when 2 then 2 else 1 end
                              when 1 then 3
                              when 2 then 3
                              when 3 then 2
                              else 1 end)
                       when 3 then 'high' when 2 then 'mid' else 'low' end
           end as t
      from hagg h cross join pick k
  ),

  -- ── 給与構成 ────────────────────────────────────────────
  -- 生の中央値と「何人が書いたか」を並べて出しておき、門は次の CTE で掛ける。
  -- ★区分ぜんたいの人数はここで数えない（2026-10-11。返すのをやめたので使い道が無い）。
  --   下の b_n … u_an は**項目ごとの壁**に使う数で、どれも返り値には入らない。
  cagg as (
    select (percentile_cont(0.5) within group (order by s_base))::numeric  as b_raw,
           (percentile_cont(0.5) within group (order by s_gtee))::numeric  as g_raw,
           (percentile_cont(0.5) within group (order by s_var))::numeric   as v_raw,
           (percentile_cont(0.5) within group (order by s_cmd))::numeric   as c_raw,
           (percentile_cont(0.5) within group (order by s_role))::numeric  as r_raw,
           (percentile_cont(0.5) within group (order by s_pd))::numeric    as p_raw,
           (percentile_cont(0.5) within group (order by s_house))::numeric as h_raw,
           (percentile_cont(0.5) within group (order by s_other))::numeric as o_raw,
           (percentile_cont(0.5) within group (order by s_rest))::numeric  as u_raw,
           count(*) filter (where s_base  > 0) as b_n,
           count(*) filter (where s_gtee  > 0) as g_n,
           count(*) filter (where s_var   > 0) as v_n,
           count(*) filter (where s_cmd   > 0) as c_n,
           count(*) filter (where s_role  > 0) as r_n,
           count(*) filter (where s_pd    > 0) as p_n,
           count(*) filter (where s_house > 0) as h_n,
           count(*) filter (where s_other > 0) as o_n,
           /* 金額（月額・USD）。割合と違って通貨をまたげないので ucm で数える。
              ★人数の門は割合とは別に掛ける。ucm を持つ人だけで数え直すと
                壁（v_min）を割ることがあり、そのとき「1人の中央値＝その人の実額」になる。 */
           count(*) filter (where s_base  > 0 and ucm is not null) as b_an,
           count(*) filter (where s_gtee  > 0 and ucm is not null) as g_an,
           count(*) filter (where s_var   > 0 and ucm is not null) as v_an,
           count(*) filter (where s_cmd   > 0 and ucm is not null) as c_an,
           count(*) filter (where s_role  > 0 and ucm is not null) as r_an,
           count(*) filter (where s_pd    > 0 and ucm is not null) as p_an,
           count(*) filter (where s_house > 0 and ucm is not null) as h_an,
           count(*) filter (where s_other > 0 and ucm is not null) as o_an,
           count(*) filter (where s_rest  > 0 and ucm is not null) as u_an,
           (percentile_cont(0.5) within group (order by s_base  * ucm)
              filter (where ucm is not null))::numeric as b_amt,
           (percentile_cont(0.5) within group (order by s_gtee  * ucm)
              filter (where ucm is not null))::numeric as g_amt,
           (percentile_cont(0.5) within group (order by s_var   * ucm)
              filter (where ucm is not null))::numeric as v_amt,
           (percentile_cont(0.5) within group (order by s_cmd   * ucm)
              filter (where ucm is not null))::numeric as c_amt,
           (percentile_cont(0.5) within group (order by s_role  * ucm)
              filter (where ucm is not null))::numeric as r_amt,
           (percentile_cont(0.5) within group (order by s_pd    * ucm)
              filter (where ucm is not null))::numeric as p_amt,
           (percentile_cont(0.5) within group (order by s_house * ucm)
              filter (where ucm is not null))::numeric as h_amt,
           (percentile_cont(0.5) within group (order by s_other * ucm)
              filter (where ucm is not null))::numeric as o_amt,
           (percentile_cont(0.5) within group (order by s_rest  * ucm)
              filter (where ucm is not null))::numeric as u_amt
      from coh
  ),
  /* ★項目ごとにも人数の壁（v_min）。満たさない区分は **0 として並べず、未分類へ畳む。**
     比例配分で他の区分へ配ると、たとえば「住宅手当を書いたのが1人」というだけで
     固定給の割合が水増しされる。畳めば増えるのは灰色だけで、
     「まだ分けられていない」という正しい意味になる。
     ★畳んだぶん未分類の意味が変わるので、画面の凡例は
       「集計できなかった分を含む」と書くこと（書かないと灰色が嘘になる）。 */
  cnorm as (
    select public.pv_deep_pct(array[
             case when b_n >= v_min then coalesce(b_raw, 0) else 0 end,
             case when g_n >= v_min then coalesce(g_raw, 0) else 0 end,
             case when v_n >= v_min then coalesce(v_raw, 0) else 0 end,
             case when c_n >= v_min then coalesce(c_raw, 0) else 0 end,
             case when r_n >= v_min then coalesce(r_raw, 0) else 0 end,
             case when p_n >= v_min then coalesce(p_raw, 0) else 0 end,
             case when h_n >= v_min then coalesce(h_raw, 0) else 0 end,
             case when o_n >= v_min then coalesce(o_raw, 0) else 0 end,
             coalesce(u_raw, 0)
             + case when b_n >= v_min then 0 else coalesce(b_raw, 0) end
             + case when g_n >= v_min then 0 else coalesce(g_raw, 0) end
             + case when v_n >= v_min then 0 else coalesce(v_raw, 0) end
             + case when c_n >= v_min then 0 else coalesce(c_raw, 0) end
             + case when r_n >= v_min then 0 else coalesce(r_raw, 0) end
             + case when p_n >= v_min then 0 else coalesce(p_raw, 0) end
             + case when h_n >= v_min then 0 else coalesce(h_raw, 0) end
             + case when o_n >= v_min then 0 else coalesce(o_raw, 0) end
           ]) as pc,
           /* 金額は割合の「おまけ」。出す条件は割合より1つ厳しく、
              その区分に金額を書いた人が v_min 人以上いるときだけ。
              ★出ない区分は 0 ではなく null を返す（画面は「—」と出す）。
                0 と書くと「その手当が無い」と読めてしまう。
              ★ここは今も pv_sig2（有効数字2桁）。2026-10-11 に刻みへ替えたのは
                見出しの2つ（hagg）だけで、**月額は細かくしていない。** */
           case when b_n >= v_min and b_an >= v_min then public.pv_sig2(b_amt) end as b_usd,
           case when g_n >= v_min and g_an >= v_min then public.pv_sig2(g_amt) end as g_usd,
           case when v_n >= v_min and v_an >= v_min then public.pv_sig2(v_amt) end as v_usd,
           case when c_n >= v_min and c_an >= v_min then public.pv_sig2(c_amt) end as c_usd,
           case when r_n >= v_min and r_an >= v_min then public.pv_sig2(r_amt) end as r_usd,
           case when p_n >= v_min and p_an >= v_min then public.pv_sig2(p_amt) end as p_usd,
           case when h_n >= v_min and h_an >= v_min then public.pv_sig2(h_amt) end as h_usd,
           case when o_n >= v_min and o_an >= v_min then public.pv_sig2(o_amt) end as o_usd,
           /* ★未分類の金額は「1つも畳まれていない」ときしか出さない。
              畳んだ区分があるときの u_raw は畳むぶんを含んでいるが u_amt は
              含んでいない＝画面の割合と桁が合わない金額になる。 */
           case when u_an >= v_min
                 and b_n >= v_min and g_n >= v_min and v_n >= v_min and c_n >= v_min and r_n >= v_min
                 and p_n >= v_min and h_n >= v_min and o_n >= v_min
                then public.pv_sig2(u_amt) end as u_usd
      from cagg
  ),
  -- ★キーの並びは cnorm の配列と1対1。片方だけ足すと色と名前がずれる。
  cseg as (
    select coalesce(jsonb_agg(jsonb_build_object('k', t.k, 'pct', t.p,
                                                'med_usd', t.a)
                              order by t.p desc, t.i), '[]'::jsonb) as j
      from cnorm,
           unnest(array['base','guarantee','variable','command','role',
                        'perdiem','housing','other','rest'],
                  cnorm.pc,
                  array[cnorm.b_usd, cnorm.g_usd, cnorm.v_usd, cnorm.c_usd,
                        cnorm.r_usd, cnorm.p_usd, cnorm.h_usd, cnorm.o_usd,
                        cnorm.u_usd],
                  array[1,2,3,4,5,6,7,8,9]) as t(k, p, a, i)
     where t.p > 0
  ),
  /* 固定・保証給比率 ── 乗務量に左右されにくい現金だけ（基本給・保証手当・職位・役割）。
     パーディアムと変動給は飛んだぶんだけ動くので変動側。
     未分類は**変動側に数える**（分からないものを固定と言わない）。
     ★2026-09-01、ここから**住宅手当を外した**（オーナー確定）。
       住宅手当は働きに対する報酬ではなく住居の補填で、会社が現物の社宅を出す国では
       同じ待遇でも 0 になる。固定側に混ぜると「住宅手当が手厚い会社ほど固定給が高い」
       という読み違いが出て、会社どうしの比較が成り立たなくなる。
       ⚠️ 戻さない。戻すと db/test-deep-pay.mjs の
          「★固定・保証給比率＝基本給＋保証手当＋職位＋役割（住宅は入らない）」が落ちる。
     ★2026-09-15、区分を9つに割ったので**添字が1つずつ後ろへずれた**
       （旧 pc[1]+pc[3]+pc[4] ＝ 固定・職位・役割）。中身は同じもの。
     ★画面は「固定・保証給比率」と「変動給比率」の2つを出すが、
       **足して100にはならない**（住宅・パーディアム・その他が残る）。
       だから変動側は 100 − 固定 では出さず、配列の variable をそのまま読んでいる。 */
  cfix as (
    select case when pc is null then null
                else pc[1] + pc[2] + pc[4] + pc[5] end as pct
      from cnorm
  ),
  -- 賞与（ドーナツの外・オーナー確定）
  -- ★賞与を貰った人数は返さない（2026-10-11）。壁に使うだけ。
  bagg as (
    select case when count(b_share) filter (where b_share > 0) >= v_min
                then round((percentile_cont(0.5)
                            within group (order by b_share))::numeric * 100, 0) end as pct
      from coh
  ),

  -- ── 働き方（列ごとに v_min 人）─────────────────────────────
  wagg as (
    select case when count(block_h) >= v_min
                then round((percentile_cont(0.5) within group (order by block_h))::numeric, 1) end as block_h,
           case when count(duty_h) >= v_min
                then round((percentile_cont(0.5) within group (order by duty_h))::numeric, 1) end as duty_h,
           case when count(duty_d) >= v_min
                then round((percentile_cont(0.5) within group (order by duty_d))::numeric, 0) end as duty_d,
           case when count(stay_n) >= v_min
                then round((percentile_cont(0.5) within group (order by stay_n))::numeric, 0) end as stay_n
      from coh
  ),

  -- ── 変動給の中身 ────────────────────────────────────────
  -- pay_items.variable は [{amount, basis, label, rule}]。
  -- ★basis はサーバで検証していない（db/pay-reports.sql 5章は jsonb の型と
  --   長さしか見ない）。だから許可リストはここに置く。
  --   pay-report.html の option の値そのまま。
  -- ★許可リストに無い値は other へ寄せずに**捨てる**。
  --   打ち間違いを本物の答えに見せないため。
  -- ★★ night / weekend / holiday を1つにまとめないこと。★★
  --   まとめれば人数の壁を通りやすくなるので「整理」したくなるが、
  --   3つは別の働き方の対価で、混ぜると何が効いているのか分からなくなる。
  -- ★読むのは mrow（採った段の月次行）。sane 全体ではない（2026-09-01）。
  --   前は人のキーで sane を引き直していたので、CAP の人の FO だった月の
  --   変動給の内訳まで CAP の円グラフに入っていた。上の tag と同じ月だけを見る。
  vraw as (
    select s.human,
           it ->> 'basis'                          as basis,
           greatest((it ->> 'amount')::numeric, 0) as amt
      from mrow s
           cross join lateral jsonb_array_elements(
             case when jsonb_typeof(s.items -> 'variable') = 'array'
                  then s.items -> 'variable' else '[]'::jsonb end) it
     where it ->> 'basis' in ('block','duty','sector','overtime','reserve',
                              'night','weekend','holiday','other','unknown')
       and (it ->> 'amount') ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  -- ★人の単位も human。pkey（本人 × 会社）で割ると、2社に出した1人が
  --   2人ぶんの重みで円グラフに効く。
  vper as (
    select human, basis, sum(amt) as amt,
           sum(sum(amt)) over (partition by human) as tot
      from vraw group by human, basis
  ),
  vagg as (
    select basis,
           count(*) as n,
           (percentile_cont(0.5) within group (order by amt / tot))::numeric as sh
      from vper where tot > 0 group by basis
  ),
  -- v_min 人未満の区分は**配列ごと落とす**（pct 0 で並べない）
  vord as (
    select basis, sh, row_number() over (order by basis) as i
      from vagg where n >= v_min
  ),
  vpa as (
    select public.pv_deep_pct((select array_agg(sh order by i) from vord)) as a
  ),
  vpct as (
    select coalesce(jsonb_agg(jsonb_build_object('k', o.basis, 'pct', (vpa.a)[o.i])
                              order by (vpa.a)[o.i] desc, o.basis), '[]'::jsonb) as j
      from vord o, vpa
     where (vpa.a)[o.i] > 0
  ),

  -- ── 数え上げ（鍵が無い人にも返す）────────────────────────
  -- ★ここの日付は投稿された日でよい。「いつ投稿されたか」という別の問いで、
  --   上の sane（いつ時点の報酬か）とは違う（2026-09-01）。
  st as (
    select (select count(*) from public.pay_reports
             where created_at >= now() - interval '24 months')            as reports,
           (select count(*) from public.pay_reports
             where created_at >= now() - interval '30 days')              as month,
           (select count(distinct airline) from public.pay_reports
             where created_at >= now() - interval '24 months')            as airlines,
           v_ctb                                                          as contributors
  )

  select jsonb_build_object(
    'ok',    true,
    'state', case when v_open then 'open' else 'locked' end,
    /* ★gate は閉じているときも返す（画面が「何を出せば開くか」を言うための材料）。
         crowd … 「みんなの側」の条件（100人以上 or 手動フラグ）が満たされているか。
                  false のときだけ、画面は「100人に届いたら開く」の行を出してよい。
                  ⚠️ 画面が contributors と goal を比べて自分で決めないこと
                     （手動フラグで開けた日に食い違う。上の v_crd の注を読む）。
         contributors / goal は**サイト全体**の数。区分の人数ではない。 */
    'gate',  jsonb_build_object(
               'key',          v_key,
               'detailed',     v_det,
               'crowd',        v_crd,
               'contributors', (select contributors from st),
               'goal',         v_goal),
    'give',  v_give,
    'stats', jsonb_build_object(
               'reports',      (select reports from st),
               'month',        (select month from st),
               'airlines',     (select airlines from st),
               'contributors', (select contributors from st)),

    /* ★選べる組み合わせ（画面の選択肢を絞るためだけの値）。
         鍵が開いているときだけ返す ── 閉じた画面は選択欄ごと出さないので
         要らないし、**渡していないものは隠せない**（pv_pay_rows の rows と同じ）。
       ★入っているのはコードだけ。人数も、どの組み合わせが何人かも返さない。
         鍵を持つ人は選択肢を1つずつ叩けば同じことが分かるので、新しく漏れる
         ものは無い（会社×職位×機材は pay_benchmarks が k≧5 で anon に公開済み）。
       ★選んだ区分（p）に影響されない。選ぶたびに一覧が入れ替わると、
         選び直しの途中で自分が今選んでいる値が消える。 */
    'picks', case when not v_open then null else (select j from avail_j) end,

    'cohort', case when not v_open then null else jsonb_build_object(
               'level',   (select case lv when 0 then 'selected'
                                          when 1 then 'airline_pos_fleet'
                                          when 2 then 'airline_pos_cat'
                                          when 3 then 'airline_pos'
                                          when 4 then 'pos'
                                          when 5 then 'all'
                                          else 'none' end from pick),
               'manual',  v_man,
               -- ★返すのは「選んだ本人が渡した値」か「呼んだ本人自身の値」だけ
               --   （約束⑥）。落ちてきた元の段の会社名は返さない。
               --   語彙に無い値が来たときは echo もしない。
               'airline', case when v_man then (case when v_bad then null else v_air end)
                               else (select airline from me) end,
               'pos',     case when v_man then (case when v_bad then null else v_pos end)
                               else (select pos from me) end,
               'fleet',   case when v_man then (case when v_bad then null else v_flt end)
                               else (select fleet from me) end,
               /* ★ここに在った人数を、信頼度の段に替えた（2026-10-11）。
                    high / mid / low。壁に届かない区分・段が無いときは null。
                  ⚠️ 人数のキーを足し戻さない（cohort にも head にも comp にも）。
                     自己点検 22 が、この関数のどこにも人数のキーが無いことを見ている。 */
               'trust',   (select t from trust)) end,

    /* ★ここから下の4つは「人が v_min 人に満たなければ1つも返さない」（thin）。
         年収中央値・Pay per Block Hour・給与構成・賞与率・Block Hours まで、
         個人の推定につながる値は**返り値そのものに入れない。**
         画面で隠すだけでは、関数を直接叩けば取れてしまう。 */
    'head', case when not v_open or (select x from thin) then null
                 else jsonb_build_object(
               'annual_usd',    (select annual from hagg),
               'per_block_usd', (select ubh from hagg),
               'fixed_pct',     (select pct from cfix)) end,

    'comp', case when not v_open or (select x from thin) then null else (
               select case when pc is null then null else jsonb_build_object(
                        'total_kind', 'monthly_cash',
                        'segs',       (select j from cseg),
                        'bonus',      (select case when pct is null then null
                                                   else jsonb_build_object(
                                                     'pct_of_annual', pct) end
                                         from bagg)
                      ) end from cnorm) end,

    'work', case when not v_open or (select x from thin) then null else (
               select jsonb_build_object(
                        'block_h',     block_h,
                        'duty_h',      duty_h,
                        'duty_days',   duty_d,
                        'stay_nights', stay_n) from wagg) end,

    'var',  case when not v_open or (select x from thin) then null
                 else (select j from vpct) end
  ) into v_out;

  return v_out;
end;
$fn$;

-- ★順番を変えないこと。revoke してから grant する。
revoke all on function public.pv_deep_pay(jsonb) from public, anon;
grant execute on function public.pv_deep_pay(jsonb) to authenticated;

comment on function public.pv_deep_pay(jsonb) is
  'DEEP PAY の画面が呼ぶ唯一の関数。会社・役職・機材を選べる（語彙に在る値だけ）。'
  '区分（会社×役職×機材から順に落とすはしご）ごとの中央値と、給与構成の割合を返す。'
  '個人の行は1件も返さない。その区分に何人いるかも返さない（返すのは信頼度の3段 cohort.trust だけ）。'
  '人数の壁は定数 v_min（2026-10-11 から2人）で、区分・列・項目ごとに掛かる。'
  '金額は丸めて返す ── 見出しの2つだけ刻み（年収の中央値＝$50・Pay / Block Hour＝$0.5。'
  '円でおよそ ¥8,000・¥80）、それ以外の金額は有効数字2桁。丸める前の中央値は返さない。'
  '内訳は割合で返す。'
  '鍵（access_until）と本人の内訳（pv_my_give の detailed）の両方が要る。'
  '足りないときは例外にせず state = locked を返す（画面が「何を出せば開くか」を出せるように）。'
  'gate.crowd は「100人以上 or 正式公開フラグ」が満たされているか（門と同じ式の答え）。';


-- ════════════════════════════════════════════════════════════════
-- 4. pv_pay_breakdown — 総支給だけ出した月に、内訳だけを足す（2026-10-11）
--
-- なぜ要るか
--   DEEP PAY の個人条件は「本人が内訳まで出していること」（pv_my_give の detailed）。
--   総支給だけ出した人が内訳を足す道は、今まで給与フォームを最初から出し直す
--   submit_pay_report しか無かった。あれは**行をまるごと置き換える**ので、
--   総支給・勤務時間・年代…を全部打ち直させるうえ、投稿日まで今日に書き換わる。
--   聞きたいのは3つだけ（基本給／保証手当・職務手当／変動給）なので、
--   その3つだけを受け取って、**既に在る1行の内訳の列だけ**を埋める口を作った。
--
-- 使い方（引数は jsonb 1つ）
--   読む … 何も渡さない。足せる月が在れば、その月の「会社・自由入力の社名・年・月・
--          通貨・総支給」を返す（＝本人が自分で出した値だけ）。無ければ target は null。
--   書く … 読んで受け取った月の鍵（airline / airline_other / year / month）をそのまま
--          返し、3つの答えを添える。答えは**金額**か、はっきりした**「該当なし」**：
--            base      | base_none        基本給
--            guarantee | guarantee_none   保証手当・職務手当
--            variable  | variable_none    変動給
--          金額は文字列（'285000' / '1234.5'）。0 は「支給なし」という回答で、
--          空は未回答（フォームと同じ区別）。金額と「該当なし」が両方来たら金額を採る
--          （フォームの pdSync と同じ ── 古い「該当なし」を、いま入れた額に勝たせない）。
--
-- 足せる月（target）＝ 呼んだ本人の行のうち、次を全部満たす**いちばん新しい月**
--   ・内訳が1つも無い（pv_deep_pay の det の裏返し ── 基本給・保証手当・職位手当・
--     内訳の行が4つとも空）
--   ・総支給が在る（0 でない）。総支給の無い行は、内訳を足すと年収が動く
--   ・変動給の列が空
--   ・明細の裏付けが付いていない行（付いた行は読み取りが内訳を埋めている。
--     **裏付けのある行を手で書き換えさせない** ── Verified の意味が無くなる）
--
-- 断るときは例外にせず、理由を返す（画面がそのまま言葉にできるように）
--   moved       返ってきた鍵が、いまの target ではない（別の端末で先に足した／
--               その間に新しい月を出した）。画面は読み直す
--   unanswered  3つのどれかが未回答。**3つとも**答えて初めて書く
--   over        内訳の合計が総支給を超えている。比べた2つの額（sum / gross）も返す
--   limit       1日の上限（給与フォームと**同じ数え**。下の注）
--   ⚠️ 読めない金額（数字でない・マイナス・桁あふれ）だけは例外にする。画面が先に
--      整えて送るので、ここへ届くのは壊れた呼び出しだけ（フォームの道も例外で落ちる）。
--
-- ★★ 書くのは内訳の列だけ。次のものには1バイトも触らない。★★
--     投稿日 ／ 総支給 ／ 年収（原通貨・USD・円）／ 時間あたり ／ 手取りの推計 ／
--     レートとその日付 ／ 明細の裏付け ／ 会員の鍵の期限
--   ・年収が動かない根拠は pv_annual_total（db/pay-reports.sql 4章）── 総支給が在る
--     行では、基本給・保証手当・変動給・その他手当を**1つも読まない**
--     （coalesce の第1引数が総支給）。target は「総支給が在る」行だけなので、
--     この関数が書く4列で年収は1円も動かない。時間あたりも年収とレートと
--     乗務時間からしか出ないので動かない。＝**作り直す派生の列が無い。**
--   ・投稿日を動かさないのは、REAL PAY の並びと「投稿時期」の段（db/pay-rows.sql）・
--     週のまとめ（db/weekly-digest.sql）・経過措置の締切（pv_my_give の full）が
--     全部その日付を見ているため。内訳を足しただけの人を「今週出した人」に数えない。
--   ・鍵の期限を伸ばさないのは、**新しい月を出したわけではない**から。伸ばすと、
--     昔に出した総支給だけの月が残っている人は、新しい月を1つも出さないまま
--     その月の数だけ鍵を延ばせる（「毎月出すと90日ずつ開く」が崩れる）。
--   ⚠️ 上の列の名前は、関数の**本文には1つも出てこない**（説明はこの頭にだけ書く）。
--      自己点検 26 が本文を字として見ているので、注意書きのつもりで本文に書くと
--      注意書きだけで赤くなる。
--
-- ★書いたあとの行は、「同じ月を給与フォームで、同じ3つの答えで出した行」と同じ形。
--   フォーム（pay-report.html の buildPayload / pdSync）と submit_pay_report を
--   突き合わせて写した。db/test-deep-pay.mjs が、フォームの道で作った行と
--   **列ごとに一致する**ことを見ている。
--     基本給・保証手当   → base_pay / guarantee_pay（「該当なし」なら空のまま）
--     変動給             → flight_variable_pay **と** other_allowance の両方
--                          （変動給はその他手当の内訳、という昔からの約束。
--                           pv_deep_pay の a_other の「命綱の引き算」が前提にしている。
--                           片方にしか書かないと、ドーナツで変動給が消えるか二重になる）
--     「該当なし」の3つ  → pay_items の fixed_none / guarantee_none / variable_none
--     変動給の行         → pay_items.variable に金額だけの1行
--   ⚠️ フォームは変動給の行ごとに「何に連動する支給か」を必ず聞く。ここは聞いていない
--      ので、行に**連動先を書かない**（「わからない」を勝手に選ばない ── 本人が
--      答えていないことを答えたことにしない）。だから pv_deep_pay の「変動給の中身」
--      （vraw）には数えられない。年収・給与構成の割合・月額には普通に入る。
--
-- ★1日の上限は submit_pay_report と**同じ数え**（profiles の同じ2列・同じ 10 件）。
--   2つ目の数えを作らない ── 作ると、フォームで10件・ここで10件と倍になる。
--   ⚠️ 10 は db/pay-reports.sql 5章の写し。あちらを変えたらここも直す。
--   ★先に本人の profiles 行を掴む（for update）。submit_pay_report が最初に掴むのと
--     同じ行なので、同じ人の2つの書き込みは必ず順番に並ぶ ── 掴んだあとで
--     target を引くから、「読んだ直後に別の口が同じ行を書き換えた」が起きない。
--
-- ★誰の行かは pv_my_keys()（1章）で引く。pv_deep_pay の me と同じ引き方。
--   行の鍵（ハッシュ）は受け取らないし、返さない。
-- ★UPDATE では何も鳴らない。リポジトリの SQL が pay_reports に付けるトリガは2本で、
--   どちらも**追加のときだけ**（db/founding.sql の称号の付与／
--   db/notify-admin-webhooks.sql の管理者通知）。＝内訳を足しても運営にメールは飛ばない。
--   ⚠️ ダッシュボードから手で作った Webhook はリポジトリからは見えない。
--      db/notify-admin-webhooks.sql の末尾の確認クエリで、pay_reports の行が
--      「Insert のみ」と出ていることを見る（「Insert 以外も含む」なら、内訳を
--      足すたびに通知が飛ぶ）。
-- ════════════════════════════════════════════════════════════════
drop function if exists public.pv_pay_breakdown(jsonb);

create or replace function public.pv_pay_breakdown(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_in    jsonb := case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end;
  v_write boolean;
  v_has   boolean;
  v_row   public.pay_reports%rowtype;
  v_prof  public.profiles%rowtype;
  -- 3つの答え。並びは 基本給 / 保証手当・職務手当 / 変動給 で固定
  v_k     constant text[] := array['base', 'guarantee', 'variable'];
  v_amt   numeric[]  := array[null, null, null]::numeric[];
  v_none  boolean[]  := array[false, false, false];
  v_s     text;
  v_i     int;
  v_oth   numeric;   -- 書いたあとの「その他手当」（変動給を足したもの）
  v_sum   numeric;   -- 書いたあとの内訳の合計（フォームの monthlyDetail と同じ顔ぶれ）
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  /* ★鍵か答えが1つでも来ていれば「書く」。何も来ていなければ「読む」。
       鍵だけ来て答えが無い呼び出しを「読む」に倒さない ── 画面が空のまま
       送ったときに、成功の形（target）が返って「足せた」と読み違える。 */
  v_write := v_in ?| array['airline', 'airline_other', 'year', 'month',
                           'base', 'base_none', 'guarantee', 'guarantee_none',
                           'variable', 'variable_none'];

  -- ── 書くときは、先に本人の行を掴む（頭の「1日の上限」の注）────
  if v_write then
    select * into v_prof from public.profiles where id = v_uid for update;
    if not found then
      -- submit_pay_report と同じ救い方。取りこぼした人をここで詰まらせない。
      begin
        insert into public.profiles (id) values (v_uid);
      exception when others then
        raise exception 'プロフィールが作成されていません。一度ログインし直してください。'
          using errcode = '23503';
      end;
      select * into v_prof from public.profiles where id = v_uid for update;
    end if;
  end if;

  -- ── 足せる月を1つ引く ───────────────────────────────────
  /* ★条件を書くのはここ1か所だけ（読むときも書くときも、この同じ1文を通る）。
     ★内訳が無い ＝ pv_deep_pay の det・pv_my_give の detailed の**裏返し**。
       あちらの4つを変えたら、ここも同じに直す。 */
  select r.* into v_row
    from public.pay_reports r
   where r.proof_hash in (select h from public.pv_my_keys() h)
     and r.base_pay is null and r.guarantee_pay is null
     and r.command_pay is null and r.pay_items is null
     and nullif(r.gross_monthly, 0) is not null
     and r.flight_variable_pay is null
     and r.verify_level = 0
   order by r.period_year desc, r.period_month desc, r.created_at desc
   limit 1;
  v_has := found;

  -- ── 読む ───────────────────────────────────────────────
  -- ★返すのは本人が自分で出した6つだけ。行のほかの中身は何も返さない。
  if not v_write then
    return jsonb_build_object(
      'ok', true,
      'target', case when not v_has then null else jsonb_build_object(
                  'airline',       v_row.airline,
                  'airline_other', v_row.airline_other,
                  'year',          v_row.period_year,
                  'month',         v_row.period_month,
                  'currency',      v_row.currency,
                  'gross',         v_row.gross_monthly) end);
  end if;

  -- ── 書く：返ってきた鍵が、いまの target か ─────────────────
  /* ★年と月は字のまま比べる。数に直してから比べると、数でない値が来たときに
       例外になる（断る理由を返せなくなる）。読んだ値をそのまま返せば必ず一致する。 */
  if not v_has
     or v_row.airline            is distinct from nullif(btrim(v_in->>'airline'), '')
     or v_row.airline_other      is distinct from nullif(btrim(v_in->>'airline_other'), '')
     or v_row.period_year::text  is distinct from btrim(v_in->>'year')
     or v_row.period_month::text is distinct from btrim(v_in->>'month') then
    return jsonb_build_object('ok', false, 'code', 'moved');
  end if;

  -- ── 3つの答えを読む ─────────────────────────────────────
  /* ★読み方は給与フォームの道（submit_pay_report）と同じ ── 空文字は「来ていない」、
       それ以外は数として読む。その前に、このファイルの vraw が変動給の行の金額に
       使っているのと同じ型（数字と小数点だけ）を通す。素の変換は指数表記や
       「数でない」を表す特別な値まで通してしまうので、型で先に止める。
     ★上限は列の型（整数12桁・小数2桁）そのもの。フォームの道も同じ所で落ちる。 */
  for v_i in 1 .. 3 loop
    v_s := nullif(btrim(v_in->>v_k[v_i]), '');
    if v_s is not null then
      if v_s !~ '^[0-9]+(\.[0-9]+)?$' then
        raise exception '金額が読めません / The amount could not be read.'
          using errcode = '22023';
      end if;
      begin
        v_amt[v_i] := v_s::numeric(14,2);
      exception when numeric_value_out_of_range then
        raise exception '金額が大きすぎます / The amount is too large.'
          using errcode = '22023';
      end;
    elsif jsonb_typeof(v_in->(v_k[v_i] || '_none')) = 'boolean'
          and (v_in->>(v_k[v_i] || '_none'))::boolean then
      v_none[v_i] := true;
    else
      -- 金額も「該当なし」も無い ＝ 未回答。1つでも在れば、どの列にも書かない
      return jsonb_build_object('ok', false, 'code', 'unanswered');
    end if;
  end loop;

  -- ── 内訳の合計が総支給を超えていないか ────────────────────
  /* ★給与フォームの settleOver()（pay-report.html）をそのまま写した ──
         総支給 > 0  かつ  内訳の合計 > 総支給 ＋ 不就労減額 ＋ 1
       合計の顔ぶれは monthlyDetail() と同じ並びで、**保存済みの列**から作る。
       画面の「その他」3欄（f-other / f-var-sum / f-oth-sum）は、保存すると
       other_allowance の1列になる。変動給はその中に入っている（別に足さない）。
     ★式を緩めも締めもしない。ここだけ違う線にすると、「フォームでは出せた内訳が
       ここでは断られる」か、その逆になる。
     ★組合の手当は、支給元が会社側（会社・両方・その他）のときだけ合計に入る
       （画面の unionInGross）。支給元は内訳の行の中に在るので、target（内訳の行が
       空）では必ず 0。不就労減額も同じ理由で必ず 0。**写しとして**残してある。 */
  v_oth := case when v_amt[3] is not null
                then coalesce(v_row.other_allowance, 0) + v_amt[3]
                else v_row.other_allowance end;
  v_sum := coalesce(v_amt[1], 0)
         + coalesce(v_amt[2], 0)
         + coalesce(v_row.hourly_rate, 0)
           * greatest(coalesce(v_row.block_hours, 0), coalesce(v_row.guaranteed_hours, 0))
         + coalesce(v_row.per_diem, 0)
         + case when v_row.housing_type = 'allowance'
                then coalesce(v_row.housing_amount, 0) else 0 end
         + coalesce(v_row.transport, 0)
         + coalesce(v_row.command_pay, 0)
         + coalesce(v_oth, 0)
         + coalesce(v_row.instructor_pay, 0)
         + coalesce(v_row.examiner_pay, 0)
         + case when (v_row.pay_items->'union'->>'extra') = 'yes'
                 and (v_row.pay_items->'union'->>'source') in ('airline', 'both', 'other')
                then coalesce(v_row.union_pay, 0) else 0 end
         + coalesce(v_row.management_pay, 0)
         + coalesce(v_row.nonline_pay, 0);
  if v_sum > v_row.gross_monthly + public.pv_absence_total(v_row.pay_items) + 1 then
    -- 比べた2つをそのまま返す（どちらも本人の値。画面が文の中に出す）
    return jsonb_build_object('ok', false, 'code', 'over',
                              'sum', v_sum, 'gross', v_row.gross_monthly);
  end if;

  -- ── 1日の上限（submit_pay_report と同じ数え・同じ件数）──────
  if v_prof.pay_reports_day is distinct from current_date then
    v_prof.pay_reports_day   := current_date;
    v_prof.pay_reports_today := 0;
  end if;
  if v_prof.pay_reports_today >= 10 then
    return jsonb_build_object('ok', false, 'code', 'limit');
  end if;

  -- ── 内訳の列だけを埋める ─────────────────────────────────
  /* ★set に並べるのはこの5つだけ。**1つも増やさない**（頭の ★★ を読む）。
     ★pay_items の形はフォームが送る物と同じ（v: 2・「該当なし」3つ・変動給の行・
       空の「その他」の行）。false も書く ── フォームの道が false を残すので、
       片方だけ鍵が無い行を作らない。
     ★変動給の行の金額は、末尾の 0 を落として入れる（285000.00 → 285000）。
       フォームの道は画面の数をそのまま入れるので、同じ見た目にそろえる。 */
  update public.pay_reports set
    base_pay            = v_amt[1],
    guarantee_pay       = v_amt[2],
    flight_variable_pay = v_amt[3],
    other_allowance     = v_oth,
    pay_items           = jsonb_build_object(
                            'v',              2,
                            'fixed_none',     v_none[1],
                            'guarantee_none', v_none[2],
                            'variable_none',  v_none[3],
                            'variable',       case when v_amt[3] is null then '[]'::jsonb
                                                   else jsonb_build_array(jsonb_build_object(
                                                          'amount', trim_scale(v_amt[3]))) end,
                            'other',          '[]'::jsonb)
   where id = v_row.id;

  -- ★数えを1つ進めるだけ。この行のほかの列には触らない。
  update public.profiles set
    pay_reports_day   = v_prof.pay_reports_day,
    pay_reports_today = v_prof.pay_reports_today + 1
   where id = v_uid;

  return jsonb_build_object('ok', true, 'done', true);
end;
$fn$;

-- ★順番を変えないこと。revoke してから grant する。
revoke all on function public.pv_pay_breakdown(jsonb) from public, anon;
grant execute on function public.pv_pay_breakdown(jsonb) to authenticated;

comment on function public.pv_pay_breakdown(jsonb) is
  '総支給だけ出した本人が、その月に内訳（基本給／保証手当・職務手当／変動給）だけを足す口。'
  '何も渡さなければ、足せる月（本人のいちばん新しい・内訳なし・総支給あり・裏付けなしの月）を返す。'
  '書くのは内訳の列だけ ── 投稿日・総支給・年収・時間あたり・レート・裏付け・鍵の期限には触らない'
  '（総支給が在る行では、内訳で年収は1円も動かない）。'
  '3つとも「金額」か「該当なし」で答えて初めて書く。断るときは例外にせず code を返す'
  '（moved / unanswered / over / limit）。1日の上限は submit_pay_report と同じ数え。'
  '行の鍵（ハッシュ）は受け取らないし、返さない。';


-- ════════════════════════════════════════════════════════════════
-- 自己点検 — オーナーが Supabase の SQL Editor に貼ったとき、
-- ここが全部 ✅ になっていれば貼れている。
-- ★1つの select にまとめる（SQL Editor は最後の結果しか出さない）。
-- ════════════════════════════════════════════════════════════════
with d as (select pg_get_functiondef('public.pv_deep_pay(jsonb)'::regprocedure) as s),
     -- 内訳を足す口の本文（2026-10-11。25・26 番が読む）
     b as (select pg_get_functiondef('public.pv_pay_breakdown(jsonb)'::regprocedure) as s),
     -- ★db/pay-rows.sql:1240 の自己点検が使っている文字列と1字も違わないこと
     --   （numeric×6 → text → numeric×13）。写し間違えると、あちらを触っていないのに
     --   13番が ❌ になり、オーナーが「貼れていない」と誤解する。
     c as (select 'public.pv_pay_comp(numeric,numeric,numeric,numeric,numeric,'
                || 'numeric,text,numeric,numeric,numeric,numeric,numeric,'
                || 'numeric,numeric,numeric,numeric,numeric,numeric,numeric,'
                || 'numeric)' as sig)
select * from (
  select  1 as "#", '受け取る引数は jsonb 1つだけ（約束⑤）' as "見るもの",
          case when (select pronargs from pg_proc
                      where oid = 'public.pv_deep_pay(jsonb)'::regprocedure) = 1
               then '✅' else '❌' end as "答え"
  union all select  2, 'security definer で動く',
          case when (select prosecdef from pg_proc
                      where oid = 'public.pv_deep_pay(jsonb)'::regprocedure)
               then '✅' else '❌' end
  union all select  3, '未ログイン（anon）は呼べない',
          case when not has_function_privilege('anon', 'public.pv_deep_pay(jsonb)', 'execute')
               then '✅' else '❌' end
  union all select  4, 'ログイン済みは呼べる',
          case when has_function_privilege('authenticated', 'public.pv_deep_pay(jsonb)', 'execute')
               then '✅' else '❌' end
  union all select  5, '本人の鍵づくりは誰にも開いていない',
          case when not has_function_privilege('authenticated', 'public.pv_my_keys()', 'execute')
                and not has_function_privilege('anon', 'public.pv_my_keys()', 'execute')
               then '✅' else '❌' end
  union all select  6, '割合の正規化は誰にも開いていない',
          case when not has_function_privilege('authenticated', 'public.pv_deep_pct(numeric[])', 'execute')
                and not has_function_privilege('anon', 'public.pv_deep_pct(numeric[])', 'execute')
               then '✅' else '❌' end
  union all select  7, '鍵（access_until）を見ている',
          case when (select s from d) like '%access_until%' then '✅' else '❌' end
  union all select  8, '本人が内訳を出したかを見ている',
          case when (select s from d) like '%pv_my_give%' then '✅' else '❌' end
  union all select  9, '人数の壁は定数 v_min（＝2人）の1か所だけで、本文に人数の直書きが無い',
          -- 静かに壊れる。1か所だけ数字のまま残ると、その列だけ別の壁で出る
          -- （「選べるのに選ぶと空」か、壁に届かない列の実額が出るか）。見るのは3つ。
          --   ① 宣言が字面どおり（2026-10-11 から 2）
          --   ② 壁の比較が全部 v_min を見ている（「以上」が50か所・thin の「未満」が1か所）
          --   ③ 2 や 3 という数と直に比べている所が、本文に1つも無い
          --      （信頼度の段の境目 10 と 5 は壁ではないので当たらない）
          case when (select s from d) like '%v_min constant int := 2;%'
                and (length((select s from d))
                     - length(replace((select s from d), '>= v_min', ''))) / 8 >= 50
                and (select s from d) like '%< v_min as x%'
                and (select s from d) !~ '(>=|<=|<|>) *[23]\M'
               then '✅' else '❌' end
  union all select 10, '投稿月・作成日時を返していない（約束⑥）',
          case when (select s from d) not like '%''period_month''%'
                and (select s from d) not like '%''created_at''%'
                and (select s from d) not like '%''proof_hash''%'
               then '✅' else '❌' end
  union all select 11, '自由入力の社名を返していない（約束⑥）',
          case when (select s from d) not like '%''airline_other''%' then '✅' else '❌' end
  union all select 12, '選べる区分は語彙の中だけ（約束⑤a）',
          case when (select s from d) like '%pv_airlines%'
                and (select s from d) like '%pv_positions%'
                and (select s from d) like '%pv_fleets%'
               then '✅' else '❌' end
  union all select 13, '給与構成の月額は有効数字2桁を通している（約束③）',
          -- ★見出しの2つ（年収の中央値・Pay / Block Hour）は 2026-10-11 から刻み。
          --   そちらは 23 番が見ている。ここは「月額まで刻みに替えていない」の側。
          case when (length((select s from d))
                     - length(replace((select s from d), 'public.pv_sig2(', ''))) / 15 = 9
               then '✅' else '❌' end
  union all select 14, '旧 pv_pay_comp は 20 引数のまま（触っていない）',
          case when to_regprocedure((select sig from c)) is not null
               then '✅' else '❌' end
  union all select 15, '旧 pv_pay_comp は今も誰にも開いていない',
          case when to_regprocedure((select sig from c)) is null
                 or not has_function_privilege('authenticated', (select sig from c), 'execute')
               then '✅' else '❌' end
  union all select 16, '本番では試験用の抜け道が効かない',
          case when to_regclass('auth.users') is not null then '✅' else '❌' end
  union all select 17, '門に「100人に達したか」が入っている',
          case when (select s from d) like '%pv_deep_contributors%' then '✅' else '❌' end
  union all select 18, '人の対応表は誰にも開いていない',
          case when not has_function_privilege('authenticated', 'public.pv_pay_person_map()', 'execute')
                and not has_function_privilege('anon', 'public.pv_pay_person_map()', 'execute')
               then '✅' else '❌' end
  -- ── 2026-09-01 に足した3つ ────────────────────────────────
  union all select 19, '正式公開の手動フラグが門に入っている',
          -- 静かに壊れる。ここが抜けても100人以上の間は普通に開くので気づけず、
          -- 正式公開したあとに99人へ落ちた日、DEEP PAY が丸ごと消える。
          case when (select s from d) like '%pv_deep_launch%' then '✅' else '❌' end
  union all select 20, '人数の壁（v_min）に満たない区分では集計値を返さない（返り値そのもので伏せる）',
          -- 画面で隠すだけでは、関数を直接叩けば取れてしまう。
          case when (select s from d) like '%thin%'
                and (length((select s from d))
                     - length(replace((select s from d), 'from thin', ''))) / 9 >= 4
               then '✅' else '❌' end
  union all select 21, '★選べる組み合わせは、区分と同じ数え方で出している（閾値の写しが無い）',
          -- 静かに壊れる。ここがズレると「選択肢に出ているのに選ぶと空」になり、
          -- 画面は普通に動いたままなので誰も気づけない。見るのは4つ。
          --   ① 鍵が閉じているときは一覧そのものを渡していない
          --   ② 8通りの絞り方を1回で数えている（grouping sets）＝0段と同じ絞り方
          --   ③ 数え上げが「内訳を書いた月を持つ実人物」（行数でも proof_hash でもない）
          --   ④ 人数の壁が、選択肢の側（avail）と区分の側（lvl→pick）の
          --      両方で**同じ v_min** を見ている。片方だけ書き換えると落ちる。
          case when (select s from d) like '%''picks'', case when not v_open then null%'
                and (select s from d) like '%group by grouping sets%'
                and (select s from d) like '%where o.det%'
                and (select s from d) like '%count(distinct o.human) >= v_min%'
                and (select s from d) like '%where n >= v_min%'
               then '✅' else '❌' end
  -- ── 2026-10-11 に足した5つ ────────────────────────────────
  union all select 22, '★その区分に何人いるかを返していない（隠すのではなく渡さない）',
          -- 静かに戻る。画面は人数が来なくても動くので、キーを1つ足し戻しても
          -- どこも赤くならない。見るのは返り値のキーの字 ── 人数を運んでいた
          -- 3つの名前（区分・見出しの2つ）が、関数のどこにも無いこと。
          case when (select s from d) not like '%''n'',%'
                and (select s from d) not like '%''detailed_n''%'
                and (select s from d) not like '%''verified_n''%'
               then '✅' else '❌' end
  union all select 23, '見出しの2つ（年収の中央値・Pay / Block Hour）は刻みを通している（約束③）',
          -- $50 と $0.5。刻みの道具は誰にも開いていない。
          case when (select s from d) like '%public.pv_deep_step((percentile_cont(0.5) within group (order by usd_y))::numeric, 50)%'
                and (select s from d) like '%public.pv_deep_step((percentile_cont(0.5) within group (order by ubh))::numeric, 0.5)%'
                and not has_function_privilege('authenticated', 'public.pv_deep_step(numeric,numeric)', 'execute')
                and not has_function_privilege('anon', 'public.pv_deep_step(numeric,numeric)', 'execute')
               then '✅' else '❌' end
  union all select 24, '人数のかわりに信頼度の段（cohort.trust）と、門の理由（gate.crowd）を返している',
          -- crowd は門と**同じ値**（v_crd）を返していること。式を写して返すと、
          -- 門だけ直した日に「開いているのに 100人待ち と出る」が黙って起きる。
          case when (select s from d) ~ '''trust'',\s+\(select t from trust\)'
                and (select s from d) ~ '''crowd'',\s+v_crd,'
                and (select s from d) like '%v_crd  := (v_lch or v_ctb >= v_goal or v_byp);%'
                and (select s from d) like '%v_open := v_key and v_det and v_crd;%'
               then '✅' else '❌' end
  union all select 25, '内訳を足す口（pv_pay_breakdown）はログイン済みだけが呼べる',
          case when has_function_privilege('authenticated', 'public.pv_pay_breakdown(jsonb)', 'execute')
                and not has_function_privilege('anon',   'public.pv_pay_breakdown(jsonb)', 'execute')
                and not has_function_privilege('public', 'public.pv_pay_breakdown(jsonb)', 'execute')
                and (select prosecdef from pg_proc
                      where oid = 'public.pv_pay_breakdown(jsonb)'::regprocedure)
               then '✅' else '❌' end
  union all select 26, '★内訳を足す口は、内訳の列しか書かない（投稿日・総支給・年収・レート・鍵の期限に触らない）',
          -- 静かに壊れる。set に1列足しても画面は普通に動く。足した列が投稿日なら
          -- 「今週出した人」が増え、鍵の期限なら新しい月を出さずに鍵が延びる。
          --   ① pay_reports を書き換える文は1つだけ・足す文と消す文は無い
          --   ② 触ってはいけない列の名前が、本文に1つも出てこない
          --   ③ 投稿日・総支給・裏付けの段・行の鍵に代入していない（読むだけ）
          --   ④ profiles に書くのは1日の数えの2列だけ
          case when (length((select s from b))
                     - length(replace((select s from b), 'update public.pay_reports', ''))) / 25 = 1
                and (select s from b) not like '%insert into public.pay_reports%'
                and (select s from b) not like '%delete from%'
                and (select s from b) !~ '(access_until|annual_total|usd_per_block_hour|net_annual|fx_to|fx_at|verified_at|verify_method|last_pay_report_at|pay_report_count|pay_streak|badge)'
                and (select s from b) !~ '(?n)(^|,|\mset\M)\s*(created_at|gross_monthly|verify_level|proof_hash)\s*='
                and (select s from b) ~ 'update public\.profiles set\s+pay_reports_day\s+= v_prof\.pay_reports_day,\s+pay_reports_today = v_prof\.pay_reports_today \+ 1\s+where id = v_uid;'
               then '✅' else '❌' end
) t order by "#";
