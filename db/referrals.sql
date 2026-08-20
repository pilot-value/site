-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/referrals.sql
--
-- 「1人だけ仲間を誘うと、自分の比較が正確になる」ための土台。
--
-- ★ このファイルは自動では流れない。オーナーの明示承認後に SQL Editor で実行する。
-- ★ 先に db/pay-reports.sql を流すこと（my_pay_reports をこのファイルが呼ぶ）。
-- 冪等（何度流しても安全）。
--
-- ── なぜ要るのか ────────────────────────────────────────────
-- 給与レポートは「同じ会社・職位・機材・年で5人」そろわないと比較を出さない。
-- 5人未満の人には灰色の一文が出て、そこで終わる＝行き止まりだった。
-- ここを「あと2人で詳細比較 → パイロット仲間を1人招待」に変える。
-- 誘う理由は報酬ではなく、自分のデータが良くなること。
--
-- ── この設計が守っている約束 ────────────────────────────────
--  1. 人数はサーバから出さない。my_cohort_gap が返すのは状態を表す言葉で、
--     整数は「あと2人／あと1人」の 2 と 1 しか外へ出ない（下の 4. を読むこと）。
--  2. 誰にも直接は読ませない。両テーブルとも RLS 有効・ポリシー0本。
--     出入口は下の4つの関数だけ。このファイルは anon に何も渡さない。
--  3. db/pay-reports.sql を1行も触らない。紹介の成立は「記録」ではなく
--     profiles.pay_report_count との差から「導出」する（下の 3. を読むこと）。
--  4. 招待した相手が誰かは、招待した側にも渡さない。返すのは件数だけ。
--
-- ── 意図的に作っていないもの ────────────────────────────────
--  ・ポイント／ランキング／報酬／解放期間の延長（access_until と badge は触らない）
--  ・招待された人の投稿と pay_reports の行を結ぶ紐付け
--    ＝「あなたが招待した人のおかげで増えました」とは構造的に言えない。言わない。
--  ・anon が呼べる関数（＝コードの実在を試せる窓口を作らない）
-- ════════════════════════════════════════════════════════════════

do $$
begin
  -- ★to_regproc ではなく to_regprocedure（引数の型を受け取らないと必ず null になる）。
  if to_regprocedure('public.my_pay_reports()') is null then
    raise exception '先に db/pay-reports.sql を実行してください（my_pay_reports が無い）';
  end if;
  if to_regclass('public.pay_reports') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports が無い）';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'profiles がありません。先に db/schema-additions.sql を実行してください';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. 招待コード
--
-- 8文字・30種類の英数字（0 1 I L O U を抜いてある）＝ 30^8 ≒ 6.6×10^11。
-- クルーバスで読み上げても、スマホで打っても間違えない字だけにしてある。
-- ★連番でもUUID由来でもメール由来でもない。乱数から作る（下の 5. を読むこと）。
-- ════════════════════════════════════════════════════════════════
create table if not exists public.referral_codes (
  code       text primary key,
  owner_id   uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 失効。押せるのはオーナーが手で SQL を叩くときだけ（画面は作らない）。
  revoked_at timestamptz
);

comment on table public.referral_codes is
  '招待コード。1人1つ、初めて必要になったときだけ作る（カードを見ない人には行ができない）。'
  'コードは乱数から作る＝ユーザーIDやメールから逆算できない。';


-- ════════════════════════════════════════════════════════════════
-- 2. 帰属（誰が誰を招待したか）
--
-- ★ invitee_id が主キーであること自体が「招待された人の紹介者は一生1人」。
--   あとから足す unique index でもアプリのロジックでもなく、テーブルの形で決める。
-- ★ check (invitee_id <> inviter_id) が自己招待の最後の砦。
--   関数側でも見るが（きれいな返事を返すため）、効いているのはこちら。
-- ════════════════════════════════════════════════════════════════
create table if not exists public.referrals (
  invitee_id       uuid primary key references public.profiles(id) on delete cascade,
  inviter_id       uuid not null      references public.profiles(id) on delete cascade,
  code             text not null      references public.referral_codes(code),
  created_at       timestamptz not null default now(),

  -- 帰属した瞬間の profiles.pay_report_count。紹介が成立したかどうかは
  -- 「いまの pay_report_count がこれより大きいか」で決まる（下の 3. を読むこと）。
  baseline_reports int not null default 0,

  -- 成立に気づいた時刻の控え。書かれなくても答えは変わらない。
  converted_at     timestamptz,

  constraint referrals_no_self check (invitee_id <> inviter_id)
);

comment on table public.referrals is
  '招待の帰属。invitee_id が主キー＝招待された人の紹介者は一生1人（作り直せない）。'
  '成立（converted）は列に書くのではなく profiles.pay_report_count との差から導出する。';
comment on column public.referrals.baseline_reports is
  '帰属した時点の投稿数。成立の定義は profiles.pay_report_count > baseline_reports。'
  '★クライアントからは動かせない（この列を書くのは claim_referral だけ）。';

create index if not exists referrals_inviter_idx on public.referrals (inviter_id);


-- ════════════════════════════════════════════════════════════════
-- 3. 紹介の成立を、submit_pay_report を触らずに判定する
--
-- db/pay-reports.sql は1448行あり、本番では SQL Editor で手で流している。
-- 1行足すために全部を流し直させるのは割に合わない。だから触らない。
--
--   成立は「記録」ではなく「導出」する。
--   submit_pay_report は成功時に profiles.pay_report_count を増やす
--   （db/pay-reports.sql:847 の `case when v_inserted then 1 else 0 end`
--     ＝ 同じ月の出し直しでは増えない）。帰属した瞬間にその値を
--   baseline_reports へ写しておけば、成立は
--     profiles.pay_report_count > baseline_reports
--   というサーバ側の突き合わせになる。クライアントからは動かせない。
--
-- ── この割り切りで受け入れていること ────────────────────────
--  1. converted_at は遅れる。次にどちらかがページを開いたときに押される。
--     真実は導出なので、ずれるのは時刻だけで件数は狂わない。
--  2. 二重計上は起きない。スナップショットは帰属の insert と同じ
--     トランザクションで取る。
--  3. 数え落としは起こりうる。それでいい。帰属より先に投稿が入ってしまったら、
--     その人は次の投稿で成立する。外れる方向は常に「自分の成果を少なく見る」側で、
--     「無かった成立を数える」側には倒れない。
--     ★代案の「pay_report_count = 0 のときだけ帰属を許す」は却下した。
--       呼び出し順が正しさを左右するので、ゲスト→預け→紐付けの経路
--       （pay-report.html の afterSignedIn → claimPending → submit_pay_report）で
--       順序を保証できない。
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 4. 権限：誰にも直接は触らせない
-- ════════════════════════════════════════════════════════════════
alter table public.referral_codes enable row level security;
alter table public.referrals      enable row level security;

-- SELECT / INSERT / UPDATE / DELETE いずれのポリシーも作らない。
-- ＝ anon も authenticated も直接は1行も読めない・書けない。
-- ★ここにポリシーを足さないこと。referrals に SELECT を1本開けると
--   「誰が誰を招待したか」が誰でも引ける。
revoke all on public.referral_codes from anon, authenticated;
revoke all on public.referrals      from anon, authenticated;

-- 既に作ってしまったポリシーがあれば落とす（冪等・事故防止）
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
            where schemaname = 'public'
              and tablename in ('referral_codes', 'referrals') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 5. my_referral_code — 自分の招待コードを取る（無ければ作る）
--
-- ★返すのは件数だけ。招待した相手のID・メール・氏名・会社・職位・金額・日付は
--   1つも返さない。招待した人が知れるのは「2人招待して1人が記録した」まで。
-- ★invited / converted は V1 では画面に出さない（ポイントやランキングに
--   地続きなので）。DB とこの関数には持つが、pv-referral.js は表示しない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.my_referral_code()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  -- 0 1 I L O U を抜いた30種類。読み上げても打ち間違えない字だけ。
  c_alpha    constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_uid      uuid := auth.uid();
  v_code     text;
  v_bytes    bytea;
  v_b        int;
  v_i        int;
  v_try      int;
  v_invited  int;
  v_conv     int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select code into v_code
    from public.referral_codes
   where owner_id = v_uid and revoked_at is null;

  if v_code is null then
    -- profiles 行が無い人（トリガーの取りこぼし）でも詰まらせない。
    insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

    for v_try in 1..12 loop
      -- ★乱数から作る。剰余の偏りを避けるため 240 以上のバイトは捨てる
      --   （256 = 8×30 + 16 なので、そのまま % 30 すると先頭の字が出やすくなる）。
      v_code := '';
      loop
        v_bytes := extensions.gen_random_bytes(32);
        for v_i in 0..31 loop
          v_b := get_byte(v_bytes, v_i);
          if v_b < 240 then
            v_code := v_code || substr(c_alpha, 1 + (v_b % 30), 1);
            exit when length(v_code) >= 8;
          end if;
        end loop;
        exit when length(v_code) >= 8;
      end loop;

      begin
        insert into public.referral_codes (code, owner_id) values (v_code, v_uid);
        exit;
      exception when unique_violation then
        -- owner_id 側でぶつかったなら、同時に走った呼び出しが先に作っている。
        -- code 側でぶつかったなら（6.6×10^11 分の1）作り直す。
        select code into v_code
          from public.referral_codes
         where owner_id = v_uid and revoked_at is null;
        exit when v_code is not null;
        v_code := null;
      end;
    end loop;

    if v_code is null then
      raise exception '招待コードを作れませんでした' using errcode = '55000';
    end if;
  end if;

  -- 成立に気づいたら控えを押しておく（answer は導出なので、押せなくても狂わない）。
  update public.referrals r
     set converted_at = now()
    from public.profiles pr
   where r.inviter_id = v_uid
     and r.converted_at is null
     and pr.id = r.invitee_id
     and coalesce(pr.pay_report_count, 0) > r.baseline_reports;

  select count(*),
         count(*) filter (where coalesce(pr.pay_report_count, 0) > r.baseline_reports)
    into v_invited, v_conv
    from public.referrals r
    left join public.profiles pr on pr.id = r.invitee_id
   where r.inviter_id = v_uid;

  return jsonb_build_object(
    'ok',        true,
    'code',      v_code,
    'invited',   coalesce(v_invited, 0),
    'converted', coalesce(v_conv, 0)
  );
end;
$$;

revoke all on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated;

comment on function public.my_referral_code() is
  '自分の招待コード。無ければその場で作る。返すのは code と件数だけで、'
  '招待した相手の識別子・メール・氏名・会社・職位・金額・日付は1つも返さない。';


-- ════════════════════════════════════════════════════════════════
-- 6. claim_referral — 招待されて登録した人を、紹介者に結びつける
--
-- ★冪等。すでに帰属していれば黙って 'already' を返す。
--   これがあるから pv-referral.js は4か所（profile / pay-report ×2 / my-value）
--   から気にせず呼べる。
-- ★存在しないコードと失効したコードは同じ 'invalid'。
--   区別して返すと「そのコードは実在するが失効している」を教える窓口になる。
-- ════════════════════════════════════════════════════════════════
create or replace function public.claim_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text;
  v_owner uuid;
  v_base  int;
  v_n     int;
  v_rows  int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  -- ★形の検査をテーブルに触る前に済ませる（返るまでの時間差から
  --   「実在するコードかどうか」が漏れないようにする）。
  v_code := upper(btrim(coalesce(p_code, '')));
  if v_code !~ '^[2-9A-HJ-NP-Z]{8}$' then
    return jsonb_build_object('ok', false, 'status', 'invalid');
  end if;

  -- すでに紹介者が決まっている人は、何度呼ばれても変えない（一生1人）。
  if exists (select 1 from public.referrals where invitee_id = v_uid) then
    return jsonb_build_object('ok', true, 'status', 'already');
  end if;

  select owner_id into v_owner
    from public.referral_codes
   where code = v_code and revoked_at is null;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'status', 'invalid');
  end if;

  if v_owner = v_uid then
    return jsonb_build_object('ok', false, 'status', 'self');
  end if;

  -- ── 荒らし避け（招待した側で数える）──────────────────────
  -- ★招待された人の画面には何も出さない。超えた分だけ静かに断る。
  -- ★数えているのは「送った数」ではなく「そのリンクから実際に登録した人の数」。
  --   リンクを何人に配ったかは、こちらからは見えないし数えていない。
  --
  --   1つめ＝同じ日に登録した人。大人数のグループへ1本貼る使い方を
  --   止めないための 50（2026-08-19 に 20 から引き上げ。20 のままだと、
  --   その日に21人目が登録した瞬間から黙って招待に数えられなくなる）。
  --
  --   2つめ＝未成立（登録はしたが給与をまだ記録していない）の通算。
  --   登録しても記録しない人のほうが多いので、実際にはこちらが先に効く。
  --   1日ぶん（50）が4回たまるまでは止めない＝200。
  --   50 のままだと、招待が50人に届いた時点でリンクが永久に死ぬ。
  --
  --   V1 には報酬もポイントも順位も無い＝招待を稼ぐ動機がそもそも無いので、
  --   この2つは「万一の荒らしの天井」であって、目標でも推奨値でもない。
  select count(*) into v_n
    from public.referrals
   where inviter_id = v_owner and created_at > now() - interval '1 day';
  if v_n >= 50 then
    return jsonb_build_object('ok', false, 'status', 'rate_limited');
  end if;

  select count(*) into v_n
    from public.referrals
   where inviter_id = v_owner and converted_at is null;
  if v_n >= 200 then
    return jsonb_build_object('ok', false, 'status', 'rate_limited');
  end if;

  -- profiles 行が無い人でも詰まらせない（submit_pay_report と同じ姿勢）。
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  -- ★ここで写した値が、そのまま成立の判定基準になる（上の 3. を読むこと）。
  select coalesce(pay_report_count, 0) into v_base
    from public.profiles where id = v_uid;

  insert into public.referrals (invitee_id, inviter_id, code, baseline_reports)
  values (v_uid, v_owner, v_code, coalesce(v_base, 0))
  on conflict (invitee_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    -- 同時に2回呼ばれた。先に入ったほうが正。
    return jsonb_build_object('ok', true, 'status', 'already');
  end if;

  return jsonb_build_object('ok', true, 'status', 'attributed');
end;
$$;

revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

comment on function public.claim_referral(text) is
  '招待コードを自分に結びつける。冪等（二度目以降は always already）。'
  '自己招待・存在しないコード・失効したコードは行を作らない。'
  '存在しないコードと失効コードは同じ invalid を返す（失効を教える窓口にしない）。';


-- ════════════════════════════════════════════════════════════════
-- 7. pv_referral_settle — 自分の帰属行の「成立」の控えを押す
--
-- 給与を出した直後に呼ぶ。押せなくても成立は導出なので答えは変わらない
-- ＝失敗しても何も起きない（画面も止めない）。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_referral_settle()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', true);
  end if;

  update public.referrals r
     set converted_at = now()
    from public.profiles pr
   where r.invitee_id = v_uid
     and r.converted_at is null
     and pr.id = r.invitee_id
     and coalesce(pr.pay_report_count, 0) > r.baseline_reports;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.pv_referral_settle() from public, anon;
grant execute on function public.pv_referral_settle() to authenticated;

comment on function public.pv_referral_settle() is
  '自分の帰属行の converted_at を押すだけ。行が無くても投げない。'
  '成立の真実は profiles.pay_report_count > baseline_reports から導出するので、'
  'この関数が一度も呼ばれなくても件数は正しい。';


-- ════════════════════════════════════════════════════════════════
-- 8. my_cohort_gap — 「あと○人で詳細比較」
--
-- ★★ この関数はプライバシーの例外そのものなので、変える前に必ずここを読む。
--
-- 2026-08 オーナー判断で、本人がその区分に自分で記録している場合に限り、
-- n=3・4 のときだけ「あと2人／あと1人」を返す。n≦2 では数字を1つも返さない。
--
--   自分の区分の n | 返る中身                                  | 画面
--   0〜2           | {state:'few'}  ★整数はゼロ個              | この区分はまだ記録が少ないです
--   3              | {state:'near', remaining:2, gained:k}      | あと2人で詳細比較
--   4              | {state:'near', remaining:1, gained:k}      | あと1人で詳細比較
--   5以上          | {state:'open', gained:k, crossed:bool}     | 普通の比較（招待の導線なし）
--   自分の投稿が無い| {state:'none'}                            | 何も出さない
--
-- ★まだ禁じていること：
--   ・生の n を返すこと
--   ・他人の区分の n を引けること
--   ・引数で区分を指定できるようにすること（この関数は引数を取らない）
--   ・pay_benchmarks の having count(*) >= 5 を緩めること
--   ・匿名クライアントにこの関数を開けること
--   pay-tracker.js:23-25 と index.html:652-654 の「件数を出さない」は据え置き。
--   あちらは「他人の区分」の話で、こちらは「自分が記録した区分」の話。
--
-- ★引数を取らないので、総当たりで他人の区分を引く対象が存在しない。
--   ＝「自分で投稿した人にだけ見せる」がチェックではなく設計の帰結になっている。
-- ════════════════════════════════════════════════════════════════
create or replace function public.my_cohort_gap()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid    uuid := auth.uid();
  v_mine   jsonb;
  v_air    text;
  v_pos    text;
  v_fleet  text;
  v_year   int;
  v_since  timestamptz;
  v_n      int;
  v_before int;
  v_gained int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  -- ── 自分の区分を割り出す ────────────────────────────────
  -- ★pay_reports に user_id は無い。「どれが自分の行か」は
  --   sha256(uid || '::pv_pay::' || 会社コード) の総当たりで解いていて、
  --   その式は my_pay_reports が既に持っている（db/pay-reports.sql:932-946）。
  --   だから入れ子で呼ぶ。claim_pending_report が submit_pay_report を
  --   入れ子で呼んでいるのと同じで、auth.uid() は JWT から読まれるので
  --   内側でも「いま呼んでいる本人」のまま。
  --   ★式をここへ書き写さないこと。CLAUDE.md が「この式は2か所にある」と
  --     警告している通りで、3つ目を作ると、式がずれた瞬間に全員が 'none' に
  --     なって機能が黙って死ぬ（どこも赤くならない）。
  v_mine := public.my_pay_reports();

  select e->>'airline', e->>'position', e->>'fleet',
         (e->>'period_year')::int, (e->>'created_at')::timestamptz
    into v_air, v_pos, v_fleet, v_year, v_since
    from jsonb_array_elements(coalesce(v_mine->'reports', '[]'::jsonb)) e
   where e->>'airline_other' is null
     and e->>'annual_total_usd' is not null
     and coalesce(btrim(e->>'airline'),  '') <> ''
     and coalesce(btrim(e->>'position'), '') <> ''
     and coalesce(btrim(e->>'fleet'),    '') <> ''
     and e->>'period_year' is not null
   order by (e->>'period_ym')::int desc, (e->>'created_at')::timestamptz desc
   limit 1;

  if v_air is null then
    return jsonb_build_object('ok', true, 'state', 'none');
  end if;

  -- ── 人数を数える ────────────────────────────────────────
  -- ★この where 句は db/pay-reports.sql:871-874（submit_pay_report が
  --   ベンチマークを返すかどうかを決めている条件）と1文字同じにしてある。
  --   ここがずれると「あと2人」と実際に比較が出るタイミングが食い違う。
  select count(*), count(*) filter (where created_at <= v_since)
    into v_n, v_before
    from public.pay_reports
   where airline = v_air and "position" = v_pos and fleet = v_fleet
     and period_year = v_year
     and annual_total_usd is not null and airline_other is null;

  -- ── 「前回あなたが記録してから増えた件数」──────────────
  -- ★基準は「前回見てから」ではなく「前回あなたが記録してから」。
  --   基準がユーザーの書けないテーブルの created_at なので、偽造する対象も
  --   端末を替えて失う対象も無い。投稿直後の初回表示は必ず 0 になる
  --   ＝ 嘘の「増えました」が表現できない。
  --   既知のずれ：先に入っていた行の金額があとから埋まった場合、それは
  --   v_before 側に入るので gained を少なく見せる。多く見せることはありえない。
  --   この非対称性が「増えてないのに増えたと言わない」の保証そのもの。
  v_gained := greatest(coalesce(v_n, 0) - coalesce(v_before, 0), 0);

  if coalesce(v_n, 0) >= 5 then
    return jsonb_build_object(
      'ok', true, 'state', 'open',
      'gained',  v_gained,
      'crossed', (coalesce(v_before, 0) < 5)
    );
  end if;

  if coalesce(v_n, 0) in (3, 4) then
    return jsonb_build_object(
      'ok', true, 'state', 'near',
      'remaining', 5 - v_n,     -- ★2 か 1 しか入らない
      'gained',    v_gained,
      'crossed',   false
    );
  end if;

  -- ── n ≦ 2 ────────────────────────────────────────────────
  -- ★整数を1つも返さない。gained も返さない
  --   （state:'few' が n≦2 を意味するので、gained:2 は n を 2 に確定させてしまう）。
  return jsonb_build_object('ok', true, 'state', 'few');
end;
$$;

revoke all on function public.my_cohort_gap() from public, anon;
grant execute on function public.my_cohort_gap() to authenticated;

comment on function public.my_cohort_gap() is
  '本人が記録した区分（会社・職位・機材・年）に、あと何人で比較が出るか。'
  '★n≦2 では整数を1つも返さない（state=few だけ）。n=3・4 のときだけ remaining を返す。'
  '★引数を取らない＝他人の区分は引けない。生の n はどの経路でも外へ出ない。';


-- ════════════════════════════════════════════════════════════════
-- 9. 自己点検（読むだけ。何も書き換えない）
--
-- ★1本の SELECT にしてある。Supabase の SQL Editor は複数文を流すと
--   最後の1本の結果しか出さないので、分けて書くと上から順に消えていく。
-- 期待：12行すべて ✅。1つでも ❌ なら、そこが効いていない。
--
-- 特に 2・5・11 は「静かに壊れる」種類のもの。ポリシーを1本足しただけで
-- 誰が誰を招待したかが誰でも引けるようになり、画面には何も出ない。
-- ════════════════════════════════════════════════════════════════
with f as (
  select to_regclass('public.referral_codes')                as t_codes,
         to_regclass('public.referrals')                     as t_ref,
         to_regclass('public.pay_benchmarks')                as bench,
         to_regprocedure('public.my_referral_code()')        as f_code,
         to_regprocedure('public.claim_referral(text)')      as f_claim,
         to_regprocedure('public.pv_referral_settle()')      as f_settle,
         to_regprocedure('public.my_cohort_gap()')           as f_gap
)
select n as "#", case when ok then '✅' else '❌' end as 結果, 見るところ
from (
  select 1 as n, '招待コードの表と帰属の表がある' as 見るところ,
         (t_codes is not null and t_ref is not null) as ok from f
  union all
  select 2, '2つの表とも直接は誰も読めない（RLS 有効・ポリシー0本）',
         coalesce((select bool_and(c.relrowsecurity) from pg_class c
                    where c.oid in (f.t_codes, f.t_ref)), false)
         and (select count(*) from pg_policies
               where schemaname = 'public'
                 and tablename in ('referral_codes','referrals')) = 0
    from f
  union all
  select 3, '4つの関数がそろっている',
         (f_code is not null and f_claim is not null
          and f_settle is not null and f_gap is not null) from f
  union all
  select 4, '4つとも security definer で動く',
         coalesce((select bool_and(p.prosecdef) from pg_proc p
                    where p.oid in (f.f_code, f.f_claim, f.f_settle, f.f_gap)), false) from f
  union all
  select 5, '登録していない人は4つとも呼べない（このファイルは anon に何も渡さない）',
         case when f_code is null or f_claim is null
                or f_settle is null or f_gap is null then false else
           not has_function_privilege('anon', f_code,   'execute')
       and not has_function_privilege('anon', f_claim,  'execute')
       and not has_function_privilege('anon', f_settle, 'execute')
       and not has_function_privilege('anon', f_gap,    'execute') end from f
  union all
  select 6, 'ログインした人は4つとも呼べる',
         case when f_code is null or f_claim is null
                or f_settle is null or f_gap is null then false else
           has_function_privilege('authenticated', f_code,   'execute')
       and has_function_privilege('authenticated', f_claim,  'execute')
       and has_function_privilege('authenticated', f_settle, 'execute')
       and has_function_privilege('authenticated', f_gap,    'execute') end from f
  union all
  select 7, '招待された人の紹介者は一生1人（invitee_id が主キー）',
         exists (select 1 from pg_constraint c
                  where c.conrelid = f.t_ref and c.contype = 'p'
                    and (select array_agg(a.attname::text order by a.attname)
                           from pg_attribute a
                          where a.attrelid = f.t_ref
                            and a.attnum = any(c.conkey)) = array['invitee_id']) from f
  union all
  select 8, '自分で自分を招待できない（check 制約がある）',
         exists (select 1 from pg_constraint
                  where conrelid = f.t_ref and conname = 'referrals_no_self'
                    and contype = 'c') from f
  union all
  select 9, '「あと○人」の関数は引数を取らない（他人の区分を引けない）',
         case when f_gap is null then false
              else (select p.pronargs from pg_proc p where p.oid = f.f_gap) = 0 end from f
  union all
  select 10, '「あと○人」は生の n を返さない（返すのは remaining だけ）',
         case when f_gap is null then false
              else pg_get_functiondef(f.f_gap) not like '%''n'', v_n%' end from f
  union all
  select 11, '公開する中央値は今まで通り5人未満を出さない（このファイルは緩めていない）',
         case when bench is null then false
              else pg_get_viewdef(bench) like '%>= 5%' end from f
  union all
  select 12, '招待の表に金額・メール・氏名の列が無い',
         not exists (select 1 from information_schema.columns
                      where table_schema = 'public'
                        and table_name in ('referral_codes','referrals')
                        and column_name in ('email','name','salary','amount',
                                            'annual_total_usd','airline')) from f
) t
order by n;
