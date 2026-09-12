-- ════════════════════════════════════════════════════════════════
-- db/pay-reports.roundtrip.sql — 貼ったあとに「本当に保存されるか」を1回で見る
--
-- pay-reports.verify.sql（16行）は**関数の計算**しか見ていない。
-- 列を1つ足したときに実際に起きるのは、そこではなく
--   「保存はされたが、その鍵だけ黙って消えている」
-- という壊れ方で、画面はどこも壊れない。pay_items はサーバ側で
-- jsonb_build_object の**白リスト**を通って作り直されるため、
-- 鍵を足し忘れると中身だけが消える。それを見るのがこのファイル。
--
-- ★**ここで作る行は1件も残らない。** 最後にわざと例外を投げて巻き戻している
--   （PostgreSQL は例外でトランザクション全体が巻き戻る）。
--   ＝ 検証用のデータが REAL PAY・DEEP PAY・公開集計に1件も混ざらない。
--   ⚠️ 表示される赤い枠は**エラーではない**。結果表がその中に出る。
--
-- 使い方：Supabase ダッシュボード → SQL Editor に丸ごと貼って Run。
-- 期待：メッセージの中の判定がすべて ✅
--
-- ⚠️ 貼る順番は db/pay-reports.sql → db/deep-pay.sql → **このファイル**。
-- ════════════════════════════════════════════════════════════════

do $rt$
declare
  -- 運営の口座を借りる（他人の行には一切触れない）。巻き戻すので痕跡も残らない。
  v_uid    uuid;
  v_res    jsonb;
  v_row    public.pay_reports%rowtype;
  v_mine   jsonb;
  v_m      jsonb;
  v_shape  jsonb;
  v_items  jsonb;
  v_nums   int;
  v_out    text := '';
  n        int := 0;

  -- 検証用の1か月ぶん。★2015年1月＝誰の実データとも重ならない古い月。
  -- 金額の作りは「印字の総支給 54,250」「変動給 3,200」「その他手当 4,100」
  -- （＝変動給3,200 ＋ 家族手当900）に、**不就労減額 −1,800** を足したもの。
  -- 総支給は減額後の額として印字されている前提なので、どの金額の列からも引かない。
  v_payload constant jsonb := jsonb_build_object(
    'airline', 'emirates', 'position', 'cap', 'fleet', 'b777', 'job_role', 'line',
    'period_year', 2015, 'period_month', 1, 'currency', 'AED',
    'gross_monthly', 54250,
    'flight_variable_pay', 3200,
    'other_allowance', 4100,
    'source', 'manual', 'lang', 'ja',
    'pay_items', jsonb_build_object(
      'v', 2,
      'variable', jsonb_build_array(
        jsonb_build_object('label', 'Flying Pay', 'amount', 3200, 'basis', 'block')),
      'other', jsonb_build_array(
        jsonb_build_object('label', 'Family Allowance', 'amount', 900)),
      'absence', jsonb_build_array(
        jsonb_build_object('label', 'Unpaid leave', 'amount', -1800))
    )
  );

begin
  select id into v_uid from auth.users where lower(email) = 'info@pilot-value.com' limit 1;
  if v_uid is null then
    raise exception '運営の口座（info@pilot-value.com）が auth.users に見つかりません。'
                    'このファイルは運営の口座を借りて保存を試し、最後に巻き戻します。';
  end if;

  -- auth.uid() をこのトランザクションの中だけ差し替える（true = ローカル）
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);

  -- ── 保存 ──────────────────────────────────────────────
  v_res := public.submit_pay_report(v_payload);

  -- ★行の特定は返ってきた id で。月だけで引くと、万一ほかに同じ月の行があったとき
  --   他人の行を読んで「通った」と誤認する。
  select * into v_row from public.pay_reports where id = (v_res->>'id')::uuid;
  v_items := v_row.pay_items;

  -- ── 再取得 ────────────────────────────────────────────
  v_mine := public.my_pay_reports();
  select value into v_m
    from jsonb_array_elements(coalesce(v_mine->'reports', '[]'::jsonb))
    where (value->>'period_year')::int = 2015 and (value->>'period_month')::int = 1
    limit 1;
  v_shape := v_m->'pay_items_shape';
  -- 翌月のひな型に数字が1つでも残っていないか（v だけが数字であるはず）
  select count(*) into v_nums
    from jsonb_path_query(coalesce(v_shape, '{}'::jsonb), '$.**?(@.type() == "number")');

  -- ── 判定 ──────────────────────────────────────────────
  n := 0;
  v_out := v_out || E'\n  #  検査                                                  実際 / 期待   判定';
  v_out := v_out || E'\n  ─────────────────────────────────────────────────────────────────────';

  n := n + 1; v_out := v_out || E'\n  ' || n || '  保存：RPC が ok を返す                                '
    || coalesce((v_res->>'ok'), 'null') || ' / true   '
    || case when coalesce((v_res->>'ok')::boolean, false) then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  保存：その月の行ができた                              '
    || case when v_row.id is null then 'なし' else 'あり' end || ' / あり   '
    || case when v_row.id is not null then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  保存：印字の総支給がそのまま入る                      '
    || coalesce(v_row.gross_monthly::text, 'null') || ' / 54250   '
    || case when v_row.gross_monthly = 54250 then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  保存：その他手当から減額を引いていない                '
    || coalesce(v_row.other_allowance::text, 'null') || ' / 4100   '
    || case when v_row.other_allowance = 4100 then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  保存：不就労減額が pay_items に残る（白リストの鍵）   '
    || coalesce(jsonb_array_length(v_items->'absence')::text, 'なし') || ' / 1   '
    || case when jsonb_typeof(v_items->'absence') = 'array'
              and jsonb_array_length(v_items->'absence') = 1 then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  保存：減額の項目名がそのまま残る                      '
    || coalesce(v_items->'absence'->0->>'label', 'null') || ' / Unpaid leave   '
    || case when v_items->'absence'->0->>'label' = 'Unpaid leave' then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  保存：減額の符号がマイナスのまま残る                  '
    || coalesce(v_items->'absence'->0->>'amount', 'null') || ' / -1800   '
    || case when (v_items->'absence'->0->>'amount')::numeric = -1800 then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  保存：変動給の行も項目名つきで残る                    '
    || coalesce(v_items->'variable'->0->>'label', 'null') || ' / Flying Pay   '
    || case when v_items->'variable'->0->>'label' = 'Flying Pay' then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  保存：年換算は総支給×12（減額で動かない）            '
    || coalesce(v_row.annual_total_orig::text, 'null') || ' / 651000   '
    || case when v_row.annual_total_orig = 651000 then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  保存：集計に載る形（USD 換算が空でない）              '
    || case when v_row.annual_total_usd is null then 'null' else '値あり' end || ' / 値あり   '
    || case when v_row.annual_total_usd is not null then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  再取得：my_pay_reports がその月を返す                 '
    || case when v_m is null then 'なし' else 'あり' end || ' / あり   '
    || case when v_m is not null then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  表示：翌月のひな型に金額・数量が1つも無い             '
    || coalesce(v_nums::text, 'null') || ' / 1（版だけ）   '
    || case when v_nums = 1 then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  表示：ひな型に「変動給なし」を持ち込まない            '
    || case when v_shape ? 'variable_none' then 'ある' else 'ない' end || ' / ない   '
    || case when not coalesce(v_shape ? 'variable_none', false) then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  表示：ひな型に減額を持ち込まない（その月だけの事実）  '
    || case when v_shape ? 'absence' then 'ある' else 'ない' end || ' / ない   '
    || case when not coalesce(v_shape ? 'absence', false) then '✅' else '❌' end;

  n := n + 1; v_out := v_out || E'\n  ' || n || '  表示：ひな型に項目名は残る（次の月に手打ちさせない）  '
    || coalesce(v_shape->'variable'->0->>'label', 'null') || ' / Flying Pay   '
    || case when v_shape->'variable'->0->>'label' = 'Flying Pay' then '✅' else '❌' end;

  v_out := v_out || E'\n  ─────────────────────────────────────────────────────────────────────';
  v_out := v_out || E'\n  ' || n || ' 項目。1つでも通っていない行があれば db/pay-reports.sql を貼り直す。';

  raise exception E'\n\n  ★これはエラーではありません。検証用の行を残さないために、わざと巻き戻しています。\n  ★この Run で作った行は1件も残っていません（REAL PAY・DEEP PAY・公開集計に混ざりません）。\n%\n',
    v_out using errcode = '22023';
end;
$rt$;
