-- ════════════════════════════════════════════════════════════════
-- 「情報を追加」── 未ログインの回答を預かる／ログイン後に引き継ぐ／補足を資格者へ返す
-- ════════════════════════════════════════════════════════════════
-- 2026-10-07 オーナー指定:
--   「情報を追加」は未ログインでも回答・保存できる。
--   本人は自分の回答・補足を確認／修正できる。
--   他人の勤務回答・補足は、ログイン＋給与提出資格が要る。一般の追加結果はログイン後。
-- 2026-10-11 オーナー指定（上の「一般の追加結果はログイン後」を置き換える）:
--   「他の人が出した情報は、給与提出後に見れる形。」
--   「給与を提出していて、やっぱり5つにしよう。さらに自分の会社に5つ以上答えた人（両方）」
--
-- ■ 貼る順（必ずこの順）
--     db/pay-rows.sql → db/conditions.generated.sql → db/airline-conditions.sql
--     → db/work-months.sql → db/towns.sql → db/towns.generated.sql → **このファイル**
--   検品（pv_work_month_clean / pv_condition_clean）と、対になる額の2つ（pv_condition_range_other /
--   pv_condition_range_bad）と、見ている人の立場（pv_work_level）は
--   前のファイルに在るものを**呼ぶ**。ここに写しを作らない。
--
-- ■ このファイルの約束
--   1. **預かった回答は、鍵を持っている端末にしか返さない。**
--      鍵はサーバが作る（192ビットの乱数）。表に残すのはその sha256 だけ ＝ 表を覗いても鍵は分からない。
--      鍵の行には、鍵を作った回線の印も置く（「IP と日付」の sha256。秘密の値は混ぜていない）。
--      使うのは1日だけ（同じ回線から新しく作られた鍵を数えるため）。鍵を作って1日たったら消す
--      ── そのあと、誰かが未ログインで保存するか、引き継ぐ時に空にする。誰も来ない日も、毎時の片づけ（3-d2。
--      pg_cron が在るときだけ）が空にする ＝ 作って1日たった印は、遅くとも1時間あとには消えている。
--      社名・自己申告・公開 URL は本人の証拠にしない。画面が作った鍵も受け付けない
--      （表に無い鍵は「知らない鍵」＝ 新しい鍵を作って返す）。
--   2. **預かっているあいだは、集計にも、他人の画面にも出さない。**
--      集計（3人以上で幅を出す・集計のビュー）が数えるのは会員の行だけ。
--      未ログインの回答を数えると、1人が鍵を3つ作るだけで「3人の壁」を破れる。
--      ログインして引き継いだ時に、はじめて会員の行になり、集計に入る。
--   3. **預かる時の検品は、会員の入口と同じ関数。** 預かった時に通ったものが、
--      引き継ぐ時に別の決まりで落ちることが無い（給与の預かりと同じ考え方）。
--   4. **引き継ぎは、ログインした本人が、鍵を出して行う。** 鍵を知らない会員は
--      何も引き取れない。引き継いだ行は、会員の入口（submit_work_month /
--      submit_airline_conditions）をそのまま通って入る ＝ 連投の制限も、親の条件も同じ。
--   5. **ここは資格を1つも付けない。** 給与の鍵・口コミの鍵・確認済みの印のどれにも触らない。
--      勤務や補足を出しただけの人は、今までどおり何も開かない。
--   6. **他人の補足は、立場をサーバが見てから返す。** 返すのは文と質問の名前だけ
--      （いつ・誰が・職位・機種・選んだ答えは返さない ＝ 3人の壁の外へ個票を出さない）。
--        未ログイン                               … 1文字も返さない
--        ログインしただけ（給与の鍵が無い・切れた）  … 1文字も返さない
--        給与の鍵が生きている ＋ 自分の会社          … 全部
--        給与の鍵が生きている ＋ ほかの会社          … 自分の会社に5つ答えた人にだけ、全部
--      決めるのは 6-b の pv_contrib_sees の1か所。
--      「見せます」と書いた画面から送られた補足（text_shared）だけ。昔の補足は本人だけのまま。
--   7. **他人の回答の集計も、同じ決まりで返す。** 集計のビュー（airline_condition_facts）は
--      誰にも直接読ませない。読む口は pv_contrib_facts の1つで、「誰に何を見せるか」は
--      補足と同じ pv_contrib_sees の1か所。3人の壁はその上に乗ったまま（代わりにはしない）。
--
-- ■ 何度流しても同じ結果になる（冪等）。

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regprocedure('public.pv_work_month_clean(jsonb)') is null
     or to_regprocedure('public.pv_work_level()') is null then
    raise exception '先に db/work-months.sql を実行してください（pv_work_month_clean / pv_work_level が無い）';
  end if;
  if to_regprocedure('public.pv_condition_clean(text, jsonb)') is null then
    raise exception '先に db/airline-conditions.sql を実行してください（pv_condition_clean が無い）';
  end if;
  if to_regprocedure('public.pv_condition_range_other(text)') is null
     or to_regprocedure('public.pv_condition_range_bad(text, numeric, text, numeric, text)') is null then
    raise exception '先に db/airline-conditions.sql を実行してください（pv_condition_range_other / pv_condition_range_bad が無い）';
  end if;
  if to_regclass('public.pay_reports') is null then
    raise exception '先に db/pay-reports.sql を実行してください（pay_reports が無い）';
  end if;
  if to_regprocedure('public.pv_airline_resolve(text)') is null
     or to_regprocedure('public.pv_is_operator()') is null then
    raise exception '先に db/pay-rows.sql を実行してください（pv_airline_resolve / pv_is_operator が無い）';
  end if;
  if to_regprocedure('public.pv_work_hash(uuid, text, text)') is null then
    raise exception '先に db/work-months.sql を実行してください（pv_work_hash が無い）';
  end if;
  if to_regclass('public.airline_condition_facts') is null then
    raise exception '先に db/airline-conditions.sql を実行してください（airline_condition_facts が無い）';
  end if;
  if to_regprocedure('public.pv_town_clean(jsonb)') is null
     or to_regprocedure('public.submit_town_post(jsonb)') is null
     or to_regprocedure('public.pv_town_held_json(jsonb)') is null
     or to_regprocedure('public.pv_town_newer(uuid, jsonb, timestamp with time zone)') is null then
    raise exception '先に db/towns.sql を実行してください（pv_town_clean / submit_town_post / pv_town_held_json / pv_town_newer が無い）';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. 表（どちらも、誰にも読ませない）
-- ════════════════════════════════════════════════════════════════
-- 1-a. 鍵。1端末＝1本。鍵そのものは持たない（sha256 だけ）。
create table if not exists public.pv_contrib_keys (
  key_hash    text primary key,
  created_at  timestamptz not null default now(),
  -- 最後に保存した時刻。ここから 90日（pv_contrib_ttl）で預かりごと消える
  last_at     timestamptz not null default now(),
  -- 鍵を作った回線の印。使うのは1日だけ（同じ回線から新しく作られた鍵を数えるためだけ）。
  --   鍵を作って1日たったら消す ── そのあと、誰かが未ログインで保存するか、引き継ぐ時か、毎時の片づけ（3-d2）で空にする。
  --   中身は「IP と日付」の sha256 で、秘密の値は混ぜていない。
  ip_day_hash text,
  -- 連投の数え（1本の鍵で1日に保存できる件数）
  saves_day   date,
  saves_today int not null default 0
);
alter table public.pv_contrib_keys drop constraint if exists pv_contrib_keys_hash_ck;
alter table public.pv_contrib_keys add constraint pv_contrib_keys_hash_ck check (
  key_hash ~ '^[0-9a-f]{64}$');

-- 1-b. 預かっている回答。1行＝1か月の勤務、または1つの質問への答え。
--   kind     … 'work'（月の勤務）／'cond'（待遇・働き方の質問）／'town'（住みやすい街）
--   item_key … work は 'YYYY-MM'／cond は質問の id／town は 基地の3字 ＋ ':' ＋ 街の鍵。同じものを出し直したら上書き（行は増えない）
--   payload  … 検品を通した形そのまま（引き継ぐ時に、会員の入口へそのまま渡す）
create table if not exists public.pv_contrib_pending (
  id          bigint generated always as identity primary key,
  key_hash    text not null references public.pv_contrib_keys(key_hash) on delete cascade,
  kind        text not null,
  airline     text not null references public.pv_airlines(code),
  item_key    text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.pv_contrib_pending drop constraint if exists pv_contrib_pending_kind_ck;
alter table public.pv_contrib_pending drop constraint if exists pv_contrib_pending_airline_ck;
alter table public.pv_contrib_pending drop constraint if exists pv_contrib_pending_size_ck;
alter table public.pv_contrib_pending add constraint pv_contrib_pending_kind_ck check (
  kind in ('work', 'cond', 'town'));
-- 自由入力の社名（other）は預からない。名前の表記で人が分かれ、引き継ぎ先が決まらない
alter table public.pv_contrib_pending add constraint pv_contrib_pending_airline_ck check (
  airline <> 'other');
alter table public.pv_contrib_pending add constraint pv_contrib_pending_size_ck check (
  jsonb_typeof(payload) = 'object' and char_length(payload::text) <= 6000);

create unique index if not exists pv_contrib_pending_item_idx
  on public.pv_contrib_pending (key_hash, kind, airline, item_key);

comment on table public.pv_contrib_keys is
  '未ログインの回答を預かる鍵（鍵は sha256 だけ）。回線の印は、鍵を作って1日たったあと、次の未ログインの保存か引き継ぎの時か、毎時の片づけ（pg_cron が在るとき）で消す。誰にも読ませない。入口は db/contrib.sql の関数だけ。';
comment on table public.pv_contrib_pending is
  '未ログインの回答の預かり。集計にも他人の画面にも出さない。ログイン後に claim_contrib で会員の行になる。';


-- ════════════════════════════════════════════════════════════════
-- 2. 権限：誰にも読ませない・書かせない（入口は下の関数だけ）
-- ════════════════════════════════════════════════════════════════
alter table public.pv_contrib_keys    enable row level security;
alter table public.pv_contrib_pending enable row level security;
revoke all on public.pv_contrib_keys    from public, anon, authenticated;
revoke all on public.pv_contrib_pending from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 3. 鍵
-- ════════════════════════════════════════════════════════════════
-- 3-a. 預かる長さ。★「90日」はこの1か所だけ。
create or replace function public.pv_contrib_ttl()
returns interval
language sql
immutable
as $$ select interval '90 days' $$;
revoke all on function public.pv_contrib_ttl() from public, anon, authenticated;

-- 3-b. 鍵 → 表に置く形。形が違うもの（サーバが作った形でないもの）は null。
create or replace function public.pv_contrib_key_hash(v_key text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case when v_key ~ '^[0-9a-f]{48}$'
              then encode(extensions.digest('pv_contrib::' || v_key, 'sha256'), 'hex') end
$$;
revoke all on function public.pv_contrib_key_hash(text) from public, anon, authenticated;

-- 3-c. 生きている鍵なら、その表の形を返す。知らない鍵・期限の切れた鍵は null。
create or replace function public.pv_contrib_key_live(v_key text)
returns text
language sql
security definer
stable
set search_path = public, extensions
as $$
  select k.key_hash
    from public.pv_contrib_keys k
   where k.key_hash = public.pv_contrib_key_hash(v_key)
     and k.last_at > now() - public.pv_contrib_ttl()
$$;
revoke all on function public.pv_contrib_key_live(text) from public, anon, authenticated;

-- 3-d. 回線の印の片付け。★鍵を作って1日たった行の印を空にする文は、この1か所だけ。
--   印を読むのは「同じ回線から1日に作れる鍵は20本まで」の数えだけで、数えるのは作って1日以内の行だけ
--   ＝ ここで空にする行は、もう数えの外に在る（上限は今までどおり）。
--   ほかの呼び出しが掴んでいる行は、待たずに飛ばす（飛ばした行は、次の呼び出しが空にする）。
--   ⚠️ このあと自分の鍵の行を待つ呼び出しは、**その行を掴んだあと**に呼ぶ（鍵の行を待たずに終わる呼び出しは、
--      いつ呼んでもよい）。掴む前に呼ぶと、同時に来た2つの呼び出しが
--      互いの鍵の行を先に掴み合い、片方が1秒ほどで断られることがある（保存は消えないが、送り直しになる）。
--      先に自分の行を掴んでおけば、相手はその行を飛ばすので、掴み合いにならない。
create or replace function public.pv_contrib_mark_sweep()
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update public.pv_contrib_keys k
     set ip_day_hash = null
   where k.key_hash in (
           select x.key_hash
             from public.pv_contrib_keys x
            where x.ip_day_hash is not null
              and x.created_at <= now() - interval '1 day'
            order by x.key_hash
              for update skip locked)
$$;
revoke all on function public.pv_contrib_mark_sweep() from public, anon, authenticated;

-- 3-d2. 毎時の片づけ（★pg_cron が在るときだけ登録する。無ければ何もしない）
--   3-d の片づけを、誰も未ログインで保存しない日・誰も引き継がない日にも流す。
--   1時間に1回 ＝ 作って1日たった印は、遅くとも1時間あとに消える（1日に1回だと、最長で2日近く残る）。
--   空にする文は 3-d の1か所のまま（ここはそれを呼ぶだけ）。預かりと鍵の行は消さない（印の欄を空にするだけ）。
--   ★ pg_cron は本番（Supabase）には在る。手元の検査（PGlite）には無い ＝ ここは飛ばす。
--   ★ 同じ名前で登録し直すだけなので、何度流しても1本のまま（pg_cron は同じ名前の登録を置き換える）。
--   止めるとき: select cron.unschedule('pv-contrib-mark-sweep');
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute format('select cron.schedule(%L, %L, %L)',
                   'pv-contrib-mark-sweep', '47 * * * *', 'select public.pv_contrib_mark_sweep()');
  end if;
end
$cron$;


-- ════════════════════════════════════════════════════════════════
-- 4. 預かる（未ログインのまま保存する）
-- ════════════════════════════════════════════════════════════════
-- 受け取る形:
--   { key?: '…', kind: 'work', data: { submit_work_month と同じ形 } }
--   { key?: '…', kind: 'cond', data: { submit_airline_conditions と同じ形 } }
-- 返す形（会員の入口と同じ形に、key を足しただけ）:
--   work … { ok, saved:true, year, month, replaced, key? }
--   cond … { ok, airline, saved, skipped:0, rejected:[{question_id, reason}], key? }
-- ★key は、**この呼び出しで新しく作ったときだけ**返す。画面はそれを端末に置く。
--   2回目からは画面が key を付けて呼ぶ ＝ 同じ預かりに足される。
-- ★「スキップ」は預からない（スキップは「同じ質問を3か月聞かない」ための会員の印）。
-- ★ここに資格の列の名前を書かない（末尾の検算が、関数の中身を文字で見ている）。
create or replace function public.submit_contrib_anon(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_kind    text;
  v_data    jsonb;
  v_key     text;
  v_kh      text;
  v_new     boolean := false;
  v_ip      text;
  v_iph     text;
  v_n       int;
  v_krow    record;
  v_left    int;
  -- work
  v_c       jsonb;
  v_item    text;
  v_rep     boolean;
  -- cond
  v_airline text;
  v_pos     text;
  v_fleet   text;
  v_base    text;
  v_ctype   text;
  v_lang    text;
  v_year    int;
  v_month   int;
  v_a       record;
  v_one     jsonb;
  -- cond：職位・機種・基地・契約（4つで1組）
  v_no_ctx  boolean;   -- この呼び出しが、4つを1つも運んでいない
  -- cond：対になる額（db/airline-conditions.sql の 4d）
  v_pair    text;      -- 対の相手の質問
  v_plast   boolean;   -- この答えが、この呼び出しの中で、その質問の最後の答えか
  v_pans    jsonb;     -- 同じ呼び出しに入っている相手の答え
  v_pone    jsonb;     -- それを検品した形
  v_pnum    numeric;   -- この呼び出しが終わったあとに、この鍵の預かりに残る相手の額と通貨
  v_pcur    text;
  v_why     text;
  v_pord    bigint;                -- 同じ呼び出しに入っている相手の答えの、呼び出しの中での位置
  v_punit   boolean;               -- この答えと、同じ呼び出しの相手とで「1組」になっている
  v_held    bigint[] := '{}';      -- 1組の、あとから回ってくる端のために取っておいた1件ぶん（その答えの位置）
  v_saved   int := 0;
  v_rej     jsonb := '[]'::jsonb;
  v_out     jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 20000 then
    raise exception '入力の形式が不正です' using errcode = '22023';
  end if;
  v_kind := nullif(btrim(p->>'kind'), '');
  v_data := p->'data';
  v_key  := nullif(btrim(p->>'key'), '');
  if v_kind is null or v_kind not in ('work', 'cond', 'town') or jsonb_typeof(v_data) is distinct from 'object' then
    raise exception '入力の形式が不正です' using errcode = '22023';
  end if;

  -- ── 先に中身を確かめる（おかしい入力のために鍵を作らない）────────
  if v_kind = 'work' then
    v_c := public.pv_work_month_clean(v_data);          -- おかしければ、ここが日本語で止める
    if v_c->>'airline' = 'other' then
      raise exception '一覧に無い会社の回答は、ログインしてから保存してください' using errcode = '22023';
    end if;
    v_airline := v_c->>'airline';
    v_item    := (v_c->>'year') || '-' || lpad(v_c->>'month', 2, '0');
  elsif v_kind = 'town' then
    v_c       := public.pv_town_clean(v_data);            -- 会員の入口と同じ検品。おかしければ、ここが日本語で止める
    v_airline := v_c->>'airline';
    v_item    := (v_c->>'base_iata') || ':' || (v_c->>'tkey');
  else
    v_airline := nullif(btrim(v_data->>'airline'), '');
    if v_airline is null
       or not exists (select 1 from public.pv_airlines where code = v_airline) then
      raise exception '航空会社が正しくありません' using errcode = '22023';
    end if;
    if v_airline = 'other' then
      raise exception '一覧に無い会社の回答は、ログインしてから保存してください' using errcode = '22023';
    end if;
    if jsonb_typeof(v_data->'answers') is distinct from 'array'
       or jsonb_array_length(v_data->'answers') = 0 then
      raise exception '回答がありません' using errcode = '22023';
    end if;
    if jsonb_array_length(v_data->'answers') > 60 then
      raise exception '一度に送れる回答は60件までです' using errcode = '22023';
    end if;
    -- 文脈は会員の入口と同じ決まり（語彙に無ければ黙って落とす）
    v_pos   := nullif(btrim(v_data->>'position'), '');
    v_fleet := nullif(btrim(v_data->>'fleet'), '');
    v_base  := upper(nullif(btrim(v_data->>'base_iata'), ''));
    v_ctype := nullif(btrim(v_data->>'contract_type'), '');
    v_lang  := lower(coalesce(nullif(btrim(v_data->>'lang'), ''), 'ja'));
    if coalesce(v_data->>'year', '')  !~ '^\s*[0-9]{0,4}\s*$'
       or coalesce(v_data->>'month', '') !~ '^\s*[0-9]{0,2}\s*$' then
      raise exception '年月が正しくありません' using errcode = '22023';
    end if;
    v_year  := coalesce(nullif(btrim(v_data->>'year'), '')::int,  extract(year  from current_date)::int);
    v_month := coalesce(nullif(btrim(v_data->>'month'), '')::int, extract(month from current_date)::int);
    if v_year not between 2015 and 2100 or v_month not between 1 and 12 then
      raise exception '年月が正しくありません' using errcode = '22023';
    end if;
    if v_lang not in ('ja', 'en') then v_lang := 'ja'; end if;
    if v_pos   is not null and not exists (select 1 from public.pv_positions      where code = v_pos)   then v_pos   := null; end if;
    if v_fleet is not null and not exists (select 1 from public.pv_fleets         where code = v_fleet) then v_fleet := null; end if;
    if v_ctype is not null and not exists (select 1 from public.pv_contract_types where code = v_ctype) then v_ctype := null; end if;
    if v_base  is not null and v_base !~ '^[A-Z]{3}$' then v_base := null; end if;

    /* ★職位・機種・基地・契約は、4つで「1組」（会員の入口と同じ決まり。2026-10-11）。
         この呼び出しが1つでも運んでいれば … 預かりの行の組を、この呼び出しの組に丸ごと替える（欠けた分は空）
         1つも運んでいなければ           … もう預けてある行の組は動かさない（下の on conflict）
       前は、直すたびに行を丸ごと入れ替えていた。4つを運ばない画面で答えだけ直すと、預かりの行から
       職位も機種も消え、ログインして引き継いだ会員の行も空になった。
       ⚠️ 1つずつ残さない。新しい職位に、前の機種がくっ付く（どの時点の組でもなくなる）。
       ⚠️ 初めて預ける行は、運んできたまま（空なら空）。親の行の組を写すのは、引き継ぐときの
          会員の入口の役目（同じ決まりを、ここにもう1つ書かない）。
       ⚠️ 年月と lang は、この組に入れない（今までどおり、直すたびにこの呼び出しのものを書く）。 */
    v_no_ctx := v_pos is null and v_fleet is null and v_base is null and v_ctype is null;
  end if;

  -- ── 鍵（生きていればそれ・無ければ作る）────────────────────
  v_kh := public.pv_contrib_key_live(v_key);
  if v_kh is null then
    -- 期限の切れた預かりは、ここで片付ける（鍵を消すと、預かりも一緒に消える）
    delete from public.pv_contrib_keys where last_at <= now() - public.pv_contrib_ttl();

    -- 同じ回線から1日に作れる鍵は20本まで。
    -- ★IP が取れない環境（手元の検査など）では数えない（給与の預かりと同じ）。
    begin
      v_ip := split_part(
        coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''),
        ',', 1);
    exception when others then
      v_ip := '';
    end;
    v_ip := btrim(v_ip);
    if v_ip <> '' then
      v_iph := encode(extensions.digest(v_ip || '::' || current_date::text, 'sha256'), 'hex');
      select count(*) into v_n
        from public.pv_contrib_keys
       where ip_day_hash = v_iph and created_at > now() - interval '1 day';
      if v_n >= 20 then
        raise exception 'しばらくしてからもう一度お試しください' using errcode = '54000';
      end if;
    end if;

    v_key := encode(extensions.gen_random_bytes(24), 'hex');
    v_kh  := public.pv_contrib_key_hash(v_key);
    insert into public.pv_contrib_keys (key_hash, ip_day_hash) values (v_kh, v_iph);
    v_new := true;
  end if;

  -- ── 連投（1本の鍵で1日80件）と、預かれる数（1本の鍵で200件）────────
  select * into v_krow from public.pv_contrib_keys where key_hash = v_kh for update;

  -- ── 回線の印は、1日だけ ──────────────────────────────
  -- ★鍵を作って1日たった行の「回線の印」を、ここで空にする（3-d）。鍵が生きている呼び出しも、新しい鍵を
  --   作った呼び出しも、**どちらもここを通る**。自分の鍵の行を掴んだ「あと」に置く（理由は 3-d）。
  --   このあと断って終わった呼び出しの分は、保存と一緒に取り消される ＝ 次の呼び出しが空にする。
  perform public.pv_contrib_mark_sweep();
  if v_krow.saves_day is distinct from current_date then
    v_krow.saves_day   := current_date;
    v_krow.saves_today := 0;
  end if;
  select 200 - count(*) into v_left from public.pv_contrib_pending where key_hash = v_kh;

  if v_kind = 'work' then
    v_rep := exists (select 1 from public.pv_contrib_pending
                      where key_hash = v_kh and kind = 'work'
                        and airline = v_airline and item_key = v_item);
    if v_krow.saves_today >= 80 then
      raise exception 'しばらくしてからもう一度お試しください' using errcode = '54000';
    end if;
    if not v_rep and v_left <= 0 then
      raise exception 'ログインせずに保存できる件数の上限です。ログインすると続きを保存できます'
        using errcode = '54000';
    end if;

    insert into public.pv_contrib_pending (key_hash, kind, airline, item_key, payload)
    values (v_kh, 'work', v_airline, v_item, v_c)
    on conflict (key_hash, kind, airline, item_key) do update set
      payload = excluded.payload, updated_at = now();
    v_saved := 1;

    v_out := jsonb_build_object(
      'ok', true, 'saved', true,
      'year', (v_c->>'year')::int, 'month', (v_c->>'month')::int,
      'replaced', v_rep);

  elsif v_kind = 'town' then
    v_rep := exists (select 1 from public.pv_contrib_pending
                      where key_hash = v_kh and kind = 'town'
                        and airline = v_airline and item_key = v_item);
    if v_krow.saves_today >= 80 then
      raise exception 'しばらくしてからもう一度お試しください' using errcode = '54000';
    end if;
    if not v_rep and v_left <= 0 then
      raise exception 'ログインせずに保存できる件数の上限です。ログインすると続きを保存できます'
        using errcode = '54000';
    end if;
    -- 街を直した回：前の街の預かりを外してから置く（外れたら、置き換えたと数える）
    if v_c ? 'was' then
      delete from public.pv_contrib_pending
       where key_hash = v_kh and kind = 'town' and airline = v_airline
         and item_key = (v_c->>'base_iata') || ':' || public.pv_town_key(v_c->>'was');
      if found then v_rep := true; end if;
    end if;
    -- 1本の鍵・1つの会社で預かる街は10か所まで（会員の入口と同じ数）
    if not v_rep and (select count(*) from public.pv_contrib_pending
                       where key_hash = v_kh and kind = 'town' and airline = v_airline) >= 10 then
      raise exception '1つの会社に出せる街は10か所までです' using errcode = '22023';
    end if;
    insert into public.pv_contrib_pending (key_hash, kind, airline, item_key, payload)
    values (v_kh, 'town', v_airline, v_item, v_c - 'was')
    on conflict (key_hash, kind, airline, item_key) do update set
      payload = excluded.payload, updated_at = now();
    v_saved := 1;
    v_out := jsonb_build_object('ok', true, 'saved', true, 'replaced', v_rep,
                                'post', public.pv_town_held_json(v_c));

  else
    -- ★priority の昇順で回す（親は必ず子より前。会員の入口と同じ）
    for v_a in
      select e.v as ans, e.ord, q.id, q.version
        from jsonb_array_elements(v_data->'answers') with ordinality as e(v, ord)
        left join public.pv_condition_questions q
               on q.id = e.v->>'question_id' and q.active
       order by coalesce(q.priority, 32767), e.ord
    loop
      if v_a.id is null then
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.ans->>'question_id', 'reason', 'unknown_question'));
        continue;
      end if;
      /* 1日の上限（1本の鍵で80件）。
         ★v_held … 対になる額の「あとから回ってくる端」のために取っておいた1件ぶん（下の「★1組」）。
           取っておいた端そのものは、ここを通す。ほかの答えは、取っておいた分を使えない。 */
      if not (v_a.ord = any(v_held))
         and v_krow.saves_today + v_saved + cardinality(v_held) >= 80 then
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.id, 'reason', 'rate_limited'));
        continue;
      end if;
      if coalesce(v_a.ans->>'skip', '') = 'true' then
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.id, 'reason', 'skip_needs_login'));
        continue;
      end if;

      -- 親に答えていない人の子の回答は受けない（いちばん上の親まで見る）。
      -- 見るのは、**この鍵が預けている答え**。
      if exists (
           select 1 from public.pv_condition_links k
            where k.question_id = v_a.id
              and not exists (
                select 1 from public.pv_contrib_pending c
                 where c.key_hash = v_kh and c.kind = 'cond'
                   and c.airline = v_airline and c.item_key = k.parent
                   and (c.payload->>'code' = any(k.parent_when)
                        or (jsonb_typeof(c.payload->'codes') = 'array'
                            and exists (select 1 from jsonb_array_elements_text(c.payload->'codes') x
                                         where x = any(k.parent_when)))))) then
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.id, 'reason', 'parent_missing'));
        continue;
      end if;

      -- 1件ぶんの検品（会員の入口と同じ関数）
      v_one := public.pv_condition_clean(v_a.id, v_a.ans);
      if not coalesce((v_one->>'ok')::boolean, false) then
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.id, 'reason', v_one->>'reason'));
        continue;
      end if;

      /* ★対になる額（低いほう・高いほう）。相手と食い違う額は預からない（2026-10-11）。
           どの2問が対か・大小と通貨の比べ方は、会員の入口と同じ2つの関数
           （db/airline-conditions.sql の 4d）。ここは「相手の額」を探して渡すだけ。
         相手の額 ＝ **この呼び出しが終わったあとに、この鍵の預かりに残る**額。
           ・同じ呼び出しに相手の答えが入っている（複数あれば最後のもの）
                額が在る              … その額と通貨
                額が無い（わからない） … 相手は無い（比べない）
                検品で落ちる          … その答えは預からないので、いま預かっている額
           ・入っていない … いま預かっている額
         こうしておくと、1回の呼び出しで 100／200 を 300／400 に直せる（低いほうが先に回るので、
         300 を前の 200 と比べたら通らない）。2つが互いに食い違う呼び出しは、2つとも断る。
         ⚠️ いま預かっている額は、**この鍵の・この会社の**行からだけ読む。ほかの鍵の預かり・
            同じ鍵のほかの会社・会員の行とは比べない。
         ⚠️ スキップは、この入口では必ず断る（上の skip_needs_login）＝ 預かりを1文字も変えない。
            だから、同じ呼び出しのスキップは相手の答えに数えない（数えると、スキップに額を添えた
            呼び出しで、預からないその額と比べてしまう）。相手は、いま預かっている額のまま。
            会員の入口と違い、預かりの行にスキップの印は無い（印の扱いは、ここには要らない）。
         ⚠️ 同じ呼び出しの相手と比べてよいのは、**その質問の最後の答え**だけ。同じ質問を2回入れて
            きた呼び出し（画面は送らない）の先の答えは、あとの答えに上書きされる側なので、その時点で
            預かっている相手と比べる（会員の入口と同じ理由）。
         ⚠️ 断った答えは v_saved に数えない（預かった数にも、1日の上限にも入れない）。預かりの行を
            作らない・直さない。断った答えしか無かった新しい鍵は、下の「1件も預からなかった
            新しい鍵は残さない」で消える。
         ★1組 ── 同じ呼び出しに、互いに「その質問の最後の答え」で、検品を通る相手が居る2件は、1組（2026-10-11）。
           1組の2件は、1日の上限（80件）に対しては、**2つとも預かるか、2つとも預からない**
           （額の無い「わからない」の端も、組に入る）。会員の入口と同じ決まり（db/airline-conditions.sql の「★1組」）。
           相手があとで上限に当たって預からなければ、先に預かった端だけが残って食い違う
           （100／200 を預けた端末が、残り1件の日に 300／400 を送る → 300／200）。
           ・先に回ってきた端で、2件ぶんの空きを見る。無ければ、この端を rate_limited で断る（何も取っておかない）。
             あとから回ってくる相手も、同じ所で同じ理由で断られる（数は増えるだけなので、答えは変わらない）。
           ・空きが在れば、相手の1件ぶんを取っておいて（v_held）、この端を預かる。取っておいた相手は、
             1日の上限を通す（親の筋・検品・対の比べ方は、2つの端で同じ答え）。
           ⚠️ 預かりの数の上限（200件）は、この決まりに入れない。その理由で断る端には、まだ行が無い ＝
              残るのは片方だけで、食い違いは残らない（今までどおり。すぐ下の検査）。取っておいた端が
              そこで断られたら、取っておいた1件ぶんは返す（そのあとの答えを、使われない1件ぶんのせいで断らない）。 */
      v_pair := public.pv_condition_range_other(v_a.id);
      if v_pair is not null then
        v_pone := null;
        v_pord := null;
        v_plast := not exists (
          select 1 from jsonb_array_elements(v_data->'answers') with ordinality as e(v, ord)
           where e.v->>'question_id' = v_a.id and e.ord > v_a.ord
             and coalesce(e.v->>'skip', '') <> 'true');
        if v_plast then
          select e.v, e.ord into v_pans, v_pord
            from jsonb_array_elements(v_data->'answers') with ordinality as e(v, ord)
           where e.v->>'question_id' = v_pair
             and coalesce(e.v->>'skip', '') <> 'true'
           order by e.ord desc
           limit 1;
          if found then
            v_pone := public.pv_condition_clean(v_pair, v_pans);
          end if;
        end if;
        -- 同じ呼び出しに、預かる形の相手が居る ＝ この2件は1組
        v_punit := coalesce((v_pone->>'ok')::boolean, false);

        if (v_one->>'num') is not null then
          if v_punit then
            v_pnum := (v_pone->>'num')::numeric;
            v_pcur := v_pone->>'currency';
          else
            v_pnum := null;
            v_pcur := null;
            select (c.payload->>'num')::numeric, c.payload->>'currency' into v_pnum, v_pcur
              from public.pv_contrib_pending c
             where c.key_hash = v_kh and c.kind = 'cond'
               and c.airline = v_airline and c.item_key = v_pair;
          end if;
          v_why := public.pv_condition_range_bad(
            v_a.id, (v_one->>'num')::numeric, v_one->>'currency', v_pnum, v_pcur);
          if v_why is not null then
            v_rej := v_rej || jsonb_build_array(jsonb_build_object(
              'question_id', v_a.id, 'reason', v_why));
            continue;
          end if;
        end if;

        -- ★1組の先の端。1日の上限に2件ぶんの空きが無ければ、この端を預からない（相手も、あとで同じ所で断られる）
        if v_punit and not (v_a.ord = any(v_held)) then
          if v_krow.saves_today + v_saved + cardinality(v_held) + 2 > 80 then
            v_rej := v_rej || jsonb_build_array(jsonb_build_object(
              'question_id', v_a.id, 'reason', 'rate_limited'));
            continue;
          end if;
          v_held := v_held || v_pord;
        end if;
      end if;

      /* 預かりの数の上限（1本の鍵で200件）。断るのは、新しい行が要る答えだけ（もう預けてある質問を直すのは通す）。
         ★理由は pending_full。1日の上限と同じ rate_limited で返さない（2026-10-11）── 画面（pv-contrib.js）は
           rate_limited を「1日に送れる件数の上限に達しました。明日また続きをどうぞ。」と伝える。この上限は
           1日の数ではなく、明日になっても空かない ＝ その文は本当でない。画面は、自分の表に無い理由を
           「保存できませんでした。」とだけ伝える。 */
      if v_left <= 0 and not exists (
           select 1 from public.pv_contrib_pending
            where key_hash = v_kh and kind = 'cond'
              and airline = v_airline and item_key = v_a.id) then
        v_held := array_remove(v_held, v_a.ord);   -- 取っておいた端がここで断られたら、その1件ぶんを返す
        v_rej := v_rej || jsonb_build_array(jsonb_build_object(
          'question_id', v_a.id, 'reason', 'pending_full'));
        continue;
      end if;

      insert into public.pv_contrib_pending (key_hash, kind, airline, item_key, payload)
      values (v_kh, 'cond', v_airline, v_a.id,
              (v_one - 'ok') || jsonb_build_object(
                'question_id', v_a.id,
                'year', v_year, 'month', v_month,
                'position', v_pos, 'fleet', v_fleet, 'base_iata', v_base,
                'contract_type', v_ctype, 'lang', v_lang))
      on conflict (key_hash, kind, airline, item_key) do update set
        -- 4つを1つも運ばない呼び出しは、預けてある行の組を動かさない（4つとも同じ条件 ＝ 1組）。
        -- 前の行から残すのは、この4つだけ。答え・補足・年月・lang は、この呼び出しのもの。
        -- 右辺の pv_contrib_pending.payload は、この上書きの前の行。
        payload = case when v_no_ctx
                       then excluded.payload || jsonb_build_object(
                              'position',      pv_contrib_pending.payload->'position',
                              'fleet',         pv_contrib_pending.payload->'fleet',
                              'base_iata',     pv_contrib_pending.payload->'base_iata',
                              'contract_type', pv_contrib_pending.payload->'contract_type')
                       else excluded.payload end,
        updated_at = now();
      v_saved := v_saved + 1;
      v_held := array_remove(v_held, v_a.ord);   -- 取っておいた端なら、その1件ぶんはここで使い終わり
      select 200 - count(*) into v_left from public.pv_contrib_pending where key_hash = v_kh;
    end loop;

    v_out := jsonb_build_object(
      'ok', true, 'airline', v_airline,
      'saved', v_saved, 'skipped', 0, 'rejected', v_rej);
  end if;

  update public.pv_contrib_keys set
    last_at     = case when v_saved > 0 then now() else last_at end,
    saves_day   = v_krow.saves_day,
    saves_today = v_krow.saves_today + v_saved
  where key_hash = v_kh;

  -- ★1件も預からなかった新しい鍵は残さない（空の鍵を端末に配らない）
  if v_new and v_saved = 0 then
    delete from public.pv_contrib_keys where key_hash = v_kh;
    v_new := false;
  end if;

  if v_new then
    v_out := v_out || jsonb_build_object('key', v_key);
  end if;
  return v_out;
end;
$$;

revoke all on function public.submit_contrib_anon(jsonb) from public;
grant execute on function public.submit_contrib_anon(jsonb) to anon, authenticated;

comment on function public.submit_contrib_anon(jsonb) is
  '未ログインの回答を預かる。検品は会員の入口と同じ関数。返す key は新しく作った時だけ。集計にも他人の画面にも出さない。';


-- ════════════════════════════════════════════════════════════════
-- 5. 自分が預けた回答（鍵を持っている端末にだけ）
-- ════════════════════════════════════════════════════════════════
-- 受け取る形: { key: '…', airline: 'jal' }
-- 返す形:     { ok, known, rows:[…], answers:[…] }
--   rows    … my_work_months の rows と**同じ形**（新しい月から24件）
--   answers … my_airline_conditions の answers と**同じ形**
--   towns   … my_town_posts の posts と**同じ形**（town_state は 'held'）
--   known   … 鍵が生きているか。false なら、画面は端末の鍵を捨てる
-- ★知らない鍵には、空を返すだけ（在る・無いの手がかりを、鍵を知らない人に渡さない。
--   known:false は「あなたの出した鍵は使えない」と言っているだけで、他人の鍵のことは何も言わない）。
create or replace function public.my_contrib_anon(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_kh      text := public.pv_contrib_key_live(nullif(btrim(p->>'key'), ''));
  v_airline text := nullif(btrim(p->>'airline'), '');
begin
  if v_kh is null then
    return jsonb_build_object('ok', true, 'known', false,
                              'rows', '[]'::jsonb, 'answers', '[]'::jsonb, 'towns', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'known', true,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'year',             (z.payload->>'year')::int,
               'month',            (z.payload->>'month')::int,
               'position',         z.payload->>'position',
               'fleet',            z.payload->>'fleet',
               'base_iata',        z.payload->>'base_iata',
               'block_hours',      z.payload->'block_hours',
               'duty_hours',       z.payload->'duty_hours',
               'work_days',        z.payload->'work_days',
               'duty_days',        z.payload->'duty_days',
               'days_off',         z.payload->'days_off',
               'stay_nights',      z.payload->'stay_nights',
               'duty_hours_basis', z.payload->>'duty_hours_basis',
               'commute_included', z.payload->>'commute_included',
               'note',             z.payload->>'note')
             order by z.item_key desc)
        from (select c.item_key, c.payload
                from public.pv_contrib_pending c
               where c.key_hash = v_kh and c.kind = 'work'
                 and (v_airline is null or c.airline = v_airline)
               order by c.item_key desc
               limit 24) z
    ), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'airline',     c.airline,
               'question_id', c.item_key,
               'code',        c.payload->>'code',
               'codes',       case when jsonb_typeof(c.payload->'codes') = 'array' then c.payload->'codes' end,
               'num',         c.payload->'num',
               'currency',    c.payload->>'currency',
               'text',        c.payload->>'text',
               'shared',      coalesce(c.payload->>'share', '') = 'true',
               'json',        case when jsonb_typeof(c.payload->'json') in ('array', 'object') then c.payload->'json' end,
               'year',        (c.payload->>'year')::int,
               'month',       (c.payload->>'month')::int,
               'updated_at',  c.updated_at)
             order by c.airline, q.priority)
        from public.pv_contrib_pending c
        join public.pv_condition_questions q on q.id = c.item_key
       where c.key_hash = v_kh and c.kind = 'cond'
         and (v_airline is null or c.airline = v_airline)
    ), '[]'::jsonb),
    'towns', coalesce((
      select jsonb_agg(public.pv_town_held_json(c.payload) order by c.item_key collate "C")
        from public.pv_contrib_pending c
       where c.key_hash = v_kh and c.kind = 'town'
         and (v_airline is null or c.airline = v_airline)
    ), '[]'::jsonb));
end;
$$;

revoke all on function public.my_contrib_anon(jsonb) from public;
grant execute on function public.my_contrib_anon(jsonb) to anon, authenticated;

comment on function public.my_contrib_anon(jsonb) is
  '預けた回答を、鍵を持っている端末にだけ返す。形は my_work_months / my_airline_conditions と同じ。';


-- ════════════════════════════════════════════════════════════════
-- 6. 引き継ぐ（ログインした本人が、鍵を出して行う）
-- ════════════════════════════════════════════════════════════════
-- 受け取る形: { key: '…' }
-- 返す形:     { ok, known, moved, kept, dropped, stale, left }
--   moved   … 会員の行になった件数（ここで初めて集計に入る）
--   kept    … 会員の側に、もっと新しい同じ回答が在ったので、預かりを捨てた件数
--   dropped … 会員の入口が受け取らなかったので捨てた件数（質問が無くなった、など）
--   stale   … 親の答えを本人が直したため、もう聞かれない質問の古い答え。会員の回答にしない・「引き継げなかった」とも数えない
--   left    … 連投の制限に当たって、預かりに残した件数（あとでもう一度呼べば続きが入る）
--             ★制限で断られた答えでも、行き先がもう決まっているもの（下の「★stale と dropped の分け方」）は残さない
--   5つを足すと、引き継ぐ前に預かっていた件数になる（1件を2回数えない・どこにも数えない件を作らない）。
-- ★入れるのは会員の入口（submit_work_month / submit_airline_conditions）だけ。
--   ここで表へ直接書かない ＝ 検品・連投の制限・親の条件を二重に持たない。
-- ★残りが0になったら鍵ごと消す（同じ鍵を、別の会員がもう一度使えない）。
-- ★stale と dropped の分け方（2026-10-11）。画面は dropped を「引き継げませんでした」と伝える。
--   会員の入口が「親の条件が続いていない」（parent_missing）と断った答えのうち、
--     ・その質問より上の質問のどれかに、**この会員が、下を開かない答えをしている** … stale
--       （「あり」と答えて額を預けたあとで「ない」に直した人。預かりの「ない」は先に引き継がれて、
--         会員の行になっている。会員としてあとから「ない」と答えた人も同じ）
--     ・上の質問が、この引き継ぎの中で dropped になった／上の質問に、この会員の答えが無い … dropped
--       （本人が直したのではなく、上が受け取れなかったせいで落ちる答え。黙って消さない）
--   1日の上限（rate_limited）で断られた答えも、上の質問のどれかに、この会員が下を開かない答えをしていれば、
--   同じ分け方で、その場で数える（預かりに残さない）。会員の入口は、上限を親の筋より先に見る。残すと、
--   「まだ引き継げていません。次に続きを引き継ぎます」と告げたあと、次の回に黙って stale にすることになる。
--   ほかの理由（検品で落ちる・対の相手と食い違う、など）で断られた答えは、今までどおり dropped。
-- ★対になる額（低いほう・高いほう）は、**2件を1回の呼び出しで**会員の入口へ出す（2026-10-11）。
--   1件ずつ出すと、100／200 を持つ会員が 300／400 を引き継ぐとき、低いほうの 300 が前の 200 と
--   比べて断られ、高いほうだけが入って 100／400 になる（入れた額が半分消える）。
--   どの2問が対かは、会員の入口と同じ pv_condition_range_other（db/airline-conditions.sql の 4d）に聞く。
--   一緒に出すのは、次の全部が成り立つときだけ。1つでも外れたら、今までどおり1件ずつ。
--     ・相手が、**この鍵の・同じ会社の**預かりに在る（ほかの鍵・ほかの会社の行と組にしない）
--     ・相手の側に、会員のもっと新しい答えが無い（在れば、相手は kept になる行）
--     ・2件の 年・月・職位・機種・基地・契約・lang が同じ（1回の呼び出しが運べる文脈は1組。
--       片方の答えに、もう片方の文脈を付けない）
--     ・2件とも、預かりの行の質問と、中身が名乗る質問が同じ（預かる入口は必ず同じにして書く。手で作った行だけが外れる）
--   まとめた呼び出しの返事は、質問ごとに読む（rejected に名前の在るほうはその理由・無いほうは保存された）。
--   ⚠️ そう読めるのは、返事が2件ぶんのとき（saved ＋ 2件のうち断られた数 ＝ 2）だけ。合わなければ、
--      まとめた呼び出しを取り消して1件ずつ出し直す（保存されていない答えを moved に数えない）。
--   ⚠️ 1日の上限に2件ぶんの空きが無いとき、会員の入口は、対の2件を**2つとも** rate_limited で断る
--      （db/airline-conditions.sql の「★1組」。2026-10-11）。ここは2件とも残して止まる（left）。
--      入口が片方だけ入れて返す形（低いほうは入り、高いほうは rate_limited）は、いまの入口からは返らない。
--      それでもその形が返ったら、まとめた呼び出しを取り消して2件とも残す（下の PVC01）。片方だけ入れると
--      会員の額が食い違う（300／前の 200）ので、入口の決まりが外れたときの2つ目の網として残してある。
--   分かっている端の場合: 2件の文脈が違う預かり（別の月に答えた・片方だけ機種を変えて答え直した）は
--   1件ずつ出す。片方が、会員の前の額と比べて断られることがある。その1件は dropped（告げる）。
-- ★住みやすい街（kind 'town'）は、いちばん最後に、街だけの止め印（v_tstop）で回す。街の上限・想定外の失敗は、
--   先に済んだ月の勤務・質問の引き継ぎを止めも取り消しもしない。月の勤務・質問の止め印（v_stop）も、街を止めない。
create or replace function public.claim_contrib(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_kh      text;
  v_r       record;
  v_res     jsonb;
  v_moved   int := 0;
  v_kept    int := 0;
  v_dropped int := 0;
  v_stale   int := 0;
  v_left    int := 0;
  v_stop    boolean := false;
  v_tstop   boolean := false;    -- 街の引き継ぎだけを止める（月の勤務・質問の v_stop とは別）
  v_newer   boolean;
  v_why     text;
  -- 待遇・働き方の質問を引き継ぐときの作業用
  v_hash    text;                 -- この会員の、その会社の印（会員の行を読むのに使う）
  v_mid     bigint;               -- 対になる額の相手の預かり（一緒に出すときだけ入る）
  v_mkey    text;
  v_mpay    jsonb;
  v_joint   boolean;              -- この回は、相手と1回の呼び出しで出した
  v_nrej    int;                  -- まとめた呼び出しで、2件のうち断られた数
  v_nlim    int;                  -- そのうち、1日の上限で断られた数
  v_done    bigint[] := '{}';     -- 相手として、もう扱った預かり（ループがそこへ来たら飛ばす）
  v_lost    text[]   := '{}';     -- この引き継ぎで dropped に数えた質問（[会社, 質問] の形）
  v_e       record;               -- いま結果を数えている1件
  v_ok      boolean;              -- その1件は、会員の行になった
  v_shut    boolean;              -- この1件より上の質問のどれかに、この会員が「下を開かない答え」をしている
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception '入力の形式が不正です' using errcode = '22023';
  end if;

  v_kh := public.pv_contrib_key_live(nullif(btrim(p->>'key'), ''));
  if v_kh is null then
    -- ★回線の印は、1日だけ（3-d）。何も引き継がない呼び出しも、ここで空にしてから返る
    --   （この呼び出しは、このあと鍵の行を1つも待たずに終わるので、掴み合いにならない）。
    perform public.pv_contrib_mark_sweep();
    return jsonb_build_object('ok', true, 'known', false,
                              'moved', 0, 'kept', 0, 'dropped', 0, 'stale', 0, 'left', 0);
  end if;
  -- 同じ鍵を2つの画面から同時に引き継がせない
  perform 1 from public.pv_contrib_keys where key_hash = v_kh for update;
  -- ★回線の印は、1日だけ（3-d）。自分の鍵の行を掴んだ「あと」に空にする。
  perform public.pv_contrib_mark_sweep();

  -- ── 月の勤務（古い月から）──────────────────────────────
  for v_r in
    select c.id, c.airline, c.payload, c.updated_at
      from public.pv_contrib_pending c
     where c.key_hash = v_kh and c.kind = 'work'
     order by c.item_key
  loop
    exit when v_stop;
    -- 会員の側に、もっと新しい同じ月が在れば、そちらを残す
    v_newer := exists (
      select 1 from public.pv_work_months w
       where w.proof_hash = public.pv_work_hash(v_uid, v_r.airline, null)
         and w.period_year  = (v_r.payload->>'year')::int
         and w.period_month = (v_r.payload->>'month')::int
         and w.updated_at >= v_r.updated_at);
    if v_newer then
      delete from public.pv_contrib_pending where id = v_r.id;
      v_kept := v_kept + 1;
      continue;
    end if;
    begin
      perform public.submit_work_month(v_r.payload);
      delete from public.pv_contrib_pending where id = v_r.id;
      v_moved := v_moved + 1;
    exception
      when sqlstate '54000' then
        v_stop := true;                      -- 連投の制限。残りは次の回に
      when sqlstate '22023' then
        delete from public.pv_contrib_pending where id = v_r.id;
        v_dropped := v_dropped + 1;          -- いまの決まりでは受け取れない形
    end;
  end loop;

  -- ── 待遇・働き方の質問（親から）──────────────────────────
  for v_r in
    select c.id, c.airline, c.item_key, c.payload, c.updated_at
      from public.pv_contrib_pending c
      left join public.pv_condition_questions q on q.id = c.item_key
     where c.key_hash = v_kh and c.kind = 'cond'
     order by c.airline, coalesce(q.priority, 32767), c.id
  loop
    exit when v_stop;
    -- 対の相手として、先に来たほうと一緒にもう扱った行（2回数えない・kept にも数えない）
    continue when v_r.id = any(v_done);
    v_hash := public.pv_condition_hash(v_uid, v_r.airline, null);
    v_newer := exists (
      select 1 from public.airline_conditions a
       where a.proof_hash = public.pv_condition_hash(v_uid, v_r.airline, null)
         and a.question_id = v_r.item_key
         and a.updated_at >= v_r.updated_at
         and num_nonnulls(a.answer_code, a.answer_codes, a.answer_num,
                          a.answer_text, a.answer_json) > 0);
    if v_newer then
      delete from public.pv_contrib_pending where id = v_r.id;
      v_kept := v_kept + 1;
      continue;
    end if;

    -- 対になる額の相手（一緒に出せるのは、上の「★対になる額」の4つが全部成り立つときだけ）。
    -- 対でない質問は、相手の名前が null ＝ 1行も当たらない。
    v_mid := null; v_mkey := null; v_mpay := null;
    select c.id, c.item_key, c.payload into v_mid, v_mkey, v_mpay
      from public.pv_contrib_pending c
     where c.key_hash = v_kh and c.kind = 'cond'
       and c.airline = v_r.airline
       and c.item_key = public.pv_condition_range_other(v_r.item_key)
       -- 2件とも、行の質問（item_key）と、中身が名乗る質問が同じ（預かる入口は、必ず同じにして書く）。
       -- 手で作った行だけが外れる。外れた行を組にすると、入口には同じ質問が2回届き、返事の「断った数」が
       -- 2 でも、2つの端のことではなくなる（名前の出なかった端を、保存されたと読んでしまう）。
       and c.payload->>'question_id' = c.item_key
       and v_r.payload->>'question_id' = v_r.item_key
       and c.id <> all(v_done)
       and not exists (
         select 1 from public.airline_conditions a
          where a.proof_hash = v_hash
            and a.question_id = c.item_key
            and a.updated_at >= c.updated_at
            and num_nonnulls(a.answer_code, a.answer_codes, a.answer_num,
                             a.answer_text, a.answer_json) > 0)
       and jsonb_build_array(c.payload->'year', c.payload->'month', c.payload->'position',
                             c.payload->'fleet', c.payload->'base_iata',
                             c.payload->'contract_type', c.payload->'lang')
         = jsonb_build_array(v_r.payload->'year', v_r.payload->'month', v_r.payload->'position',
                             v_r.payload->'fleet', v_r.payload->'base_iata',
                             v_r.payload->'contract_type', v_r.payload->'lang');
    v_joint := v_mid is not null;

    if v_joint then
      begin
        v_res := public.submit_airline_conditions(jsonb_build_object(
          'airline',       v_r.airline,
          'year',          v_r.payload->'year',
          'month',         v_r.payload->'month',
          'position',      v_r.payload->'position',
          'fleet',         v_r.payload->'fleet',
          'base_iata',     v_r.payload->'base_iata',
          'contract_type', v_r.payload->'contract_type',
          'lang',          v_r.payload->'lang',
          'answers',       jsonb_build_array(v_r.payload, v_mpay)));
        select count(*), count(*) filter (where e->>'reason' = 'rate_limited')
          into v_nrej, v_nlim
          from jsonb_array_elements(v_res->'rejected') e
         where e->>'question_id' in (v_r.item_key, v_mkey);
        if coalesce((v_res->>'saved')::int, 0) + v_nrej <> 2 then
          raise exception sqlstate 'PVC02';    -- 返事が2件ぶんに読めない
        end if;
        if v_nlim = 1 then
          raise exception sqlstate 'PVC01';    -- 1日の上限が、ちょうど2件のあいだで切れた
        end if;
        v_done := v_done || v_mid;
      exception
        -- ここへ来た時点で、まとめた呼び出しが書いたものは全部取り消されている
        when sqlstate '22023' or sqlstate 'PVC02' then
          v_joint := false;                    -- 今までどおり1件ずつ（相手は、ループがそこへ来た時に）
        when sqlstate 'PVC01' then
          v_stop := true;                      -- 2件とも残す。残りは次の回に
      end;
      exit when v_stop;
    end if;

    if not v_joint then
      v_mid := null; v_mkey := null;
      begin
        v_res := public.submit_airline_conditions(jsonb_build_object(
          'airline',       v_r.airline,
          'year',          v_r.payload->'year',
          'month',         v_r.payload->'month',
          'position',      v_r.payload->'position',
          'fleet',         v_r.payload->'fleet',
          'base_iata',     v_r.payload->'base_iata',
          'contract_type', v_r.payload->'contract_type',
          'lang',          v_r.payload->'lang',
          'answers',       jsonb_build_array(v_r.payload)));
      exception
        when sqlstate '22023' then
          v_res := jsonb_build_object('saved', 0, 'rejected',
                     jsonb_build_array(jsonb_build_object('reason', 'bad_request')));
      end;
    end if;

    -- この1件（まとめて出した回は2件）が、それぞれどうなったか
    for v_e in
      select x.id, x.qid
        from unnest(array[v_r.id, v_mid], array[v_r.item_key, v_mkey]) as x(id, qid)
       where x.id is not null
    loop
      if v_joint then
        select e->>'reason' into v_why
          from jsonb_array_elements(v_res->'rejected') e
         where e->>'question_id' = v_e.qid
         limit 1;
        v_ok := not found;
      else
        v_ok  := coalesce((v_res->>'saved')::int, 0) > 0;
        v_why := v_res->'rejected'->0->>'reason';
      end if;

      if v_ok then
        delete from public.pv_contrib_pending where id = v_e.id;
        v_moved := v_moved + 1;
      else
        -- 上の質問のどれかに、この会員が、下を開かない答えをしている
        -- （＝ 会員の入口は、この答えをいつ出しても parent_missing で断る。会員が上の質問を答え直すまで変わらない）
        v_shut := exists (
          select 1
            from public.pv_condition_links k
            join public.airline_conditions a
              on a.proof_hash = v_hash and a.question_id = k.parent
           where k.question_id = v_e.qid
             and num_nonnulls(a.answer_code, a.answer_codes) > 0
             and (a.answer_code = any(k.parent_when)
                  or a.answer_codes && k.parent_when) is not true);
        if v_why = 'rate_limited' and not v_shut then
          v_stop := true;                      -- 残す。次の回に続きを出す
        else
          /* 行き先が決まった答え。1日の上限で断られた答えも、v_shut ならここへ来る ──
             入口は上限を親の筋より先に見るので rate_limited と返すが、上限が無くても parent_missing で
             断られる答え。残して「次に続きを引き継ぎます」と告げると、次の回に黙って消えることになる。 */
          delete from public.pv_contrib_pending where id = v_e.id;
          if (v_why = 'parent_missing' or v_why = 'rate_limited')
             and v_shut
             -- 上の質問が、この引き継ぎの中で dropped になったのではない
             and not exists (
               select 1 from public.pv_condition_links k
                where k.question_id = v_e.qid
                  and jsonb_build_array(v_r.airline, k.parent)::text = any(v_lost)) then
            v_stale := v_stale + 1;
          else
            v_dropped := v_dropped + 1;
            v_lost := v_lost || jsonb_build_array(v_r.airline, v_e.qid)::text;
          end if;
        end if;
      end if;
    end loop;
  end loop;

  -- ── 住みやすい街（★いちばん最後に回す。街の上限は、月の勤務・質問の引き継ぎを止めない。その逆も止めない）──
  for v_r in
    select c.id, c.airline, c.item_key, c.payload, c.updated_at
      from public.pv_contrib_pending c
     where c.key_hash = v_kh and c.kind = 'town'
     order by c.airline, c.item_key, c.id
  loop
    exit when v_tstop;
    -- 会員の側に、同じ街のもっと新しい投稿が在れば、そちらを残す
    v_newer := public.pv_town_newer(v_uid, v_r.payload, v_r.updated_at);
    if v_newer then
      delete from public.pv_contrib_pending where id = v_r.id;
      v_kept := v_kept + 1;
      continue;
    end if;
    begin
      perform public.submit_town_post(v_r.payload);
      delete from public.pv_contrib_pending where id = v_r.id;
      v_moved := v_moved + 1;
    exception
      when sqlstate '54000' then
        get stacked diagnostics v_why = pg_exception_detail;
        if v_why is distinct from 'names' then
          v_tstop := true;                   -- 1日の件数の上限。街の残りは次の回に
        end if;                              -- 'names' ＝ 候補に無い名前の上限。この1件だけ残して、次の街へ進む
      when sqlstate '22023' then
        delete from public.pv_contrib_pending where id = v_r.id;
        v_dropped := v_dropped + 1;          -- いまの決まりでは受け取れない形（見送られた街の名前など）
      when others then
        v_tstop := true;                     -- 想定外の失敗：この街から先は次の回に（月の勤務・質問の引き継ぎは取り消さない）
    end;
  end loop;

  select count(*) into v_left from public.pv_contrib_pending where key_hash = v_kh;
  if v_left = 0 then
    delete from public.pv_contrib_keys where key_hash = v_kh;
  end if;

  return jsonb_build_object(
    'ok', true, 'known', true,
    'moved', v_moved, 'kept', v_kept, 'dropped', v_dropped, 'stale', v_stale, 'left', v_left);
end;
$$;

revoke all on function public.claim_contrib(jsonb) from public, anon;
grant execute on function public.claim_contrib(jsonb) to authenticated;

comment on function public.claim_contrib(jsonb) is
  '預けた回答を、ログインした本人が鍵を出して引き継ぐ。入れるのは会員の入口だけ。資格は何も付けない。';


-- ════════════════════════════════════════════════════════════════
-- 6-b. 誰に見せるか（補足も、集計も、月の勤務も、ここ1か所）
-- ════════════════════════════════════════════════════════════════
-- 2026-10-11 オーナー指定:
--   「他の人が出した情報は、給与提出後に見れる形。」
--   「給与を提出していて、やっぱり5つにしよう。さらに自分の会社に5つ以上答えた人（両方）」
--
--   未ログイン                              … 'login'   何も返さない
--   ログインしただけ（給与の鍵が無い・切れた） … 'locked'  何も返さない
--   給与の鍵が生きている
--     自分の会社                            … 'open'
--     ほかの会社 ＋ 自分の会社に5つ答えた      … 'open'
--     ほかの会社 ＋ まだ5つに届かない          … 'give'    何も返さない
--   運営                                    … 'open'
-- ★「自分の会社」＝ 自分が給与を出した会社（pay_reports の行。サーバが作り直せる印でしか引けない）。
--   プロフィールの「在籍企業」は読まない ── 本人がいつでも書き換えられる字なので、会社を1つずつ
--   「自分の会社」に書き換えれば、5つ答えずに全社を読めてしまう。
-- ★「答えた」＝ 3人の集計が、その人の1件として数えるのと同じ決め方の行（db/airline-conditions.sql の 9）。
--   「ない」も 0 も答え。「わからない」・スキップ・上の質問を答え直して外れた答えは数えない。
--   ログインせずに預けた回答は、引き継いで会員の行になってから数える。
-- ★何も書き込まない・何も覚えない（stable）。読むたびに数え直す ＝ 資格を1つも付けない。
-- ⚠️ 決まりを動かすときは、ここの関数だけを直す。読む口（このファイルの pv_contrib_facts / pv_contrib_notes ／
--    db/work-months.sql の pv_work_view / pv_work_month_stats ／ db/airline-conditions.sql の
--    next_condition_questions）と、カードの材料（pv_contrib_give）は、pv_contrib_sees を**呼ぶ**。
--    立場や会社や数の条件を、そちらに書き足さない（片方だけ開く）。

-- 6-b-1. 自分の会社に答える数。★「5」はこの1か所だけ。
create or replace function public.pv_contrib_need()
returns int
language sql
immutable
as $$ select 5 $$;
revoke all on function public.pv_contrib_need() from public, anon, authenticated;

-- 6-b-2. 自分の会社（＝ 自分が給与を出した会社）と、その会社について答えた質問の数。1社＝1行。
--   o_code  … 会社の code。打ち込んだ社名が一覧の会社に当たれば、その code。当たらなければ 'other'
--   o_name  … 一覧に無い会社のときだけ、打ち込んだ社名（小文字。回答の印を作る材料）
--   o_label … 一覧に無い会社のときだけ、打ち込んだままの社名（本人の画面に字として出すだけ）
--   o_ym    … その会社でいちばん新しい給与の対象月（YYYYMM）／ o_at … その行を出した時刻
--   o_have  … その会社について答えた、別々の質問の数
--   o_hs    … その会社についての、その人の回答の印（外へは出さない。数えるのと、カードの並びに使うだけ）
--             一覧の会社 … code の印 ＋ 社名を打ち込んで給与を出したことがあれば、その社名の印
--             （一覧に載る前に、打ち込んだ社名のまま答えた分を、載ったあとも数えるため）
--             一覧に無い会社 … 打ち込んだ社名の印
-- ★誰にも渡さない。p_uid は呼ぶ側が auth.uid() を渡す（外から人を名指しして呼ぶ口は無い）。
create or replace function public.pv_contrib_own(p_uid uuid)
returns table (o_code text, o_name text, o_label text, o_ym int, o_at timestamptz, o_have int, o_hs text[])
language sql
security definer
stable
set search_path = public, extensions
as $fn$
  with mine as (
    -- 一覧から選んだ会社：code は有限なので、総当たりで印を作れる（pv_my_give と同じ引き方）
    select a.code as code, null::text as nm,
           public.pv_work_hash(p_uid, a.code, null) as h
      from public.pv_airlines a
     where a.code <> 'other'
    union all
    -- 打ち込んだ社名：実在する社名だけを候補にして作り直す。使うのは印の材料としてだけ
    select public.pv_airline_resolve(o.nm), o.nm,
           public.pv_work_hash(p_uid, 'other', o.nm)
      from (select distinct lower(r.airline_other) as nm
              from public.pay_reports r
             where r.airline = 'other' and r.airline_other is not null) o
  ),
  paid as (
    select m.code                                                   as code,
           case when m.code = 'other' then m.nm end                 as nm,
           max(case when m.code = 'other' then r.airline_other end) as label,
           max(r.period_year * 100 + r.period_month)::int           as ym,
           max(r.created_at)                                        as last_at,
           coalesce(array_agg(distinct public.pv_condition_hash(p_uid, 'other', m.nm))
                      filter (where m.nm is not null), '{}'::text[])
             || case when m.code <> 'other'
                     then array[public.pv_condition_hash(p_uid, m.code, null)]
                     else '{}'::text[] end                          as hs
      from mine m
      join public.pay_reports r on r.proof_hash = m.h
     where p_uid is not null
     group by m.code, case when m.code = 'other' then m.nm end
  )
  select p.code, p.nm, p.label, p.ym, p.last_at,
         (select count(distinct c.question_id)::int
            from public.airline_conditions c
            join public.pv_condition_questions q on q.id = c.question_id and q.active
           where c.proof_hash = any(p.hs)
             and c.answer_code is distinct from 'unknown'
             and num_nonnulls(c.answer_code, c.answer_codes, c.answer_num,
                              c.answer_text, c.answer_json) > 0
             and not exists (
                   select 1 from public.pv_condition_links k
                    where k.question_id = c.question_id
                      and not exists (
                        select 1 from public.airline_conditions u
                         where u.proof_hash = c.proof_hash and u.question_id = k.parent
                           and (u.answer_code = any(k.parent_when)
                                or u.answer_codes && k.parent_when)))),
         p.hs
    from paid p
$fn$;
revoke all on function public.pv_contrib_own(uuid) from public, anon, authenticated;

-- 6-b-3. 決める所。返すのは 'login' / 'locked' / 'give' / 'open' の1語。
-- ★立場が先。未ログインと、給与の鍵が無い人には、聞かれた会社を見ずに返す
--   ＝ 在る会社・無い会社・引数なしで、返事が1文字も違わない。
-- ★'give' を決めるときに読むのは、読む人自身の行だけ（聞かれた会社の回答は1行も読まない
--   ＝ 回答が在る会社と無い会社で、返事も、かかる時間も変わらない）。
-- ★給与の鍵は生きているのに、給与の行が1つも無い人（鍵を手で立てた場合だけ）は 'locked'
--   ＝ 鍵の無い会員と同じ返事。会社は給与の提出で決まる。
-- ★会社を指さずに呼ぶ（null）と、「どこかの会社が開くか」ではなく「ほかの会社が開くか」を答える
--   （自分の会社の枝は null に当たらない）。pv_contrib_give はこの形で呼ぶ。
-- ★誰にも渡さない。security definer の関数の中からだけ呼ぶ。
create or replace function public.pv_contrib_sees(p_airline text)
returns text
language plpgsql
security definer
stable
set search_path = public, extensions
as $fn$
declare
  v_level text := public.pv_work_level();
  v_n     int;
  v_ok    boolean;
begin
  if v_level is distinct from 'pay' then
    return case when v_level = 'member' then 'locked' else 'login' end;
  end if;
  if public.pv_is_operator() then
    return 'open';
  end if;
  select count(*),
         coalesce(bool_or(o.o_have >= public.pv_contrib_need()
                          or (o.o_code <> 'other' and o.o_code = p_airline)), false)
    into v_n, v_ok
    from public.pv_contrib_own(auth.uid()) o;
  if v_n = 0 then
    return 'locked';
  end if;
  return case when v_ok then 'open' else 'give' end;
end;
$fn$;
revoke all on function public.pv_contrib_sees(text) from public, anon, authenticated;

comment on function public.pv_contrib_sees(text) is
  '他人の補足・集計・月の勤務を、いま読んでいる人に、その会社について見せてよいか。決まりはここ1か所。外からは呼べない。';

-- 6-b-4. 読む人自身のいまの数と、次に答える質問（「見るためのカード」の材料）。何も決めない。
-- 受け取る形: {}（引数は読まない）
-- 返す形:
--   未ログイン                     … { ok, state:'login' }
--   鍵が無い／給与の行が無い        … { ok, state:'locked' }
--   もう足りている・運営            … { ok, state:'open' }
--   まだ足りない                   … { ok, state:'give', airline, name, have, need, ask:[id…] }
--     airline … カードが聞く会社 ＝ いちばん新しい給与の会社（code。一覧に無い会社は 'other'）
--     name    … その社名（一覧の会社は pv_airlines の名前。一覧に無い会社は、本人が打ち込んだ字）
--     have    … その会社について、その人が答えた別々の質問の数 ／ need … pv_contrib_need()
--     ask     … 次に答える質問の id（8件まで）。その会社で答えた人が少ない質問が先。
-- ★状態の1語は pv_contrib_sees(null) の答えをそのまま返す。ここで立場・運営・数を見直さない
--   （見直すと、決まりの写しが2つになる）。
-- ★返す数字は have と need の2つだけ ＝ どちらも本人の数。ほかの人の回答の数は、並べる順にだけ使い、
--   数としては1つも返さない。
-- ★一覧に無い会社は ask が空（会社ページも集計も無い。答える場所は質問の画面）。
create or replace function public.pv_contrib_give(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $fn$
declare
  v_sees  text := public.pv_contrib_sees(null);
  v_uid   uuid := auth.uid();
  v_own   record;
  v_ask   jsonb := '[]'::jsonb;
begin
  if v_sees is distinct from 'give' then
    return jsonb_build_object('ok', true, 'state', coalesce(v_sees, 'login'));
  end if;

  -- カードが聞く会社 ＝ いちばん新しい給与の会社
  select o.* into v_own
    from public.pv_contrib_own(v_uid) o
   order by o.o_ym desc, o.o_at desc, o.o_code
   limit 1;
  if not found then                              -- 起きない（上と同じ時点の表を読む）。起きたら閉じる側へ
    return jsonb_build_object('ok', true, 'state', 'locked');
  end if;

  if v_own.o_code <> 'other' then
    select coalesce(jsonb_agg(z.id order by z.rn), '[]'::jsonb)
      into v_ask
      from (
        select y.id, row_number() over (order by y.n asc, y.priority asc, y.id asc) as rn
          from (
            select q.id, q.priority,
                   (select count(distinct c.proof_hash)
                      from public.airline_conditions c
                     where c.airline = v_own.o_code and c.airline_other is null
                       and c.question_id = q.id
                       and c.answer_code is distinct from 'unknown'
                       and num_nonnulls(c.answer_code, c.answer_codes, c.answer_num,
                                        c.answer_text, c.answer_json) > 0) as n
              from public.pv_condition_questions q
             where q.active
               and q.kind <> 'lines'
               -- まだ1度も触っていない質問だけ（答えた・わからない・スキップした質問は出さない）
               and not exists (select 1 from public.airline_conditions m
                                where m.proof_hash = any(v_own.o_hs) and m.question_id = q.id)
               -- 親の条件が、その人自身の答えで、いちばん上まで続いている質問だけ
               and not exists (
                     select 1 from public.pv_condition_links k
                      where k.question_id = q.id
                        and not exists (select 1 from public.airline_conditions m
                                         where m.proof_hash = any(v_own.o_hs) and m.question_id = k.parent
                                           and (m.answer_code = any(k.parent_when)
                                                or m.answer_codes && k.parent_when)))
          ) y
      ) z
     where z.rn <= 8;
  end if;

  return jsonb_build_object(
    'ok', true, 'state', 'give',
    'airline', v_own.o_code,
    'name', case when v_own.o_code = 'other' then v_own.o_label
                 else (select a.name_ja from public.pv_airlines a where a.code = v_own.o_code) end,
    'have', v_own.o_have,
    'need', public.pv_contrib_need(),
    'ask', v_ask);
end;
$fn$;
revoke all on function public.pv_contrib_give(jsonb) from public;
grant execute on function public.pv_contrib_give(jsonb) to anon, authenticated;

comment on function public.pv_contrib_give(jsonb) is
  '読む人自身の、自分の会社への回答の数（have／need）と、次に答える質問の並び。状態は pv_contrib_sees の答え。ほかの人の回答は数としては返さない。何も書かない。';


-- ════════════════════════════════════════════════════════════════
-- 7. 他人の補足（立場をサーバが見てから返す）
-- ════════════════════════════════════════════════════════════════
-- 受け取る形: { airline: 'jal' }
-- 返す形:
--   開いていない人 … { ok, state:'login' | 'locked' | 'give' }     ← 状態の1語だけ。1文字も返さない
--   開いている人   … { ok, state:'open', notes:[…] }
--   notes の1件 … { topic, q, text, mine }
--     topic … 話題（'work'＝月の勤務／それ以外は質問の節: roster / career / time_off / benefits）
--     q     … 質問の id（月の勤務のひとことは null）。名前は画面が質問の表から引く
--     mine  … 自分が書いたものか（画面が「あなたの投稿」の札を付ける）
-- ★返さないもの ── いつ書いたか・職位・機種・基地・選んだ答え・書いた人の印。
--   並びも時刻にしない（新しい順にすると「さっき出した人」が分かる）。
-- ★返すのは会員の行だけ（預かり＝未ログインのままの回答は出さない）。自由入力の社名も出さない。
-- ★1社につき40件まで（並びは行ごとに決まった順 ＝ 開くたびに入れ替わらない）。
create or replace function public.pv_contrib_notes(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_airline text := nullif(btrim(p->>'airline'), '');
  v_sees    text := public.pv_contrib_sees(v_airline);
  v_ch      text;
  v_wh      text;
  v_notes   jsonb;
begin
  -- 開いていない人には、ここまで（会社が在るかどうかにも答えない）
  if v_sees is distinct from 'open' then
    return jsonb_build_object('ok', true, 'state', coalesce(v_sees, 'login'));
  end if;
  if v_airline is null or v_airline = 'other'
     or not exists (select 1 from public.pv_airlines where code = v_airline) then
    raise exception '航空会社が正しくありません' using errcode = '22023';
  end if;

  v_ch := public.pv_condition_hash(v_uid, v_airline, null);
  v_wh := public.pv_work_hash(v_uid, v_airline, null);

  with pool as (
    -- 質問への補足（「見せます」と書いた画面から送られたものだけ）
    select q.section as topic, c.question_id as q, c.answer_text as body,
           (c.proof_hash = v_ch) as mine,
           md5(c.proof_hash || '::' || c.question_id) as ord
      from public.airline_conditions c
      join public.pv_condition_questions q on q.id = c.question_id and q.active
     where c.airline = v_airline
       and c.airline_other is null
       and c.text_shared
       and c.answer_text is not null
       -- ★親の条件が、いちばん上まで続いている回答の補足だけを見せる（2026-10-09）。
       --   上の質問を「ない」に答え直した人の、その下の質問への古い補足を見せ続けない
       --   （公開集計と同じ決め方 ＝ db/airline-conditions.sql の 9）。行は消していないので、
       --   答え直せばまた見える。
       and not exists (
             select 1 from public.pv_condition_links k
              where k.question_id = c.question_id
                and not exists (
                  select 1 from public.airline_conditions p
                   where p.proof_hash = c.proof_hash and p.question_id = k.parent
                     and (p.answer_code = any(k.parent_when)
                          or p.answer_codes && k.parent_when)))
    union all
    -- 月の勤務のひとこと
    select 'work', null, w.note,
           (w.proof_hash = v_wh),
           md5(w.proof_hash || '::' || w.period_year || '-' || w.period_month)
      from public.pv_work_months w
     where w.airline = v_airline
       and w.airline_other is null
       and w.note is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'topic', z.topic, 'q', z.q, 'text', z.body, 'mine', z.mine)
           order by z.topic, z.q nulls first, z.ord), '[]'::jsonb)
    into v_notes
    from (select * from pool order by mine desc, ord limit 40) z;

  return jsonb_build_object('ok', true, 'state', 'open', 'notes', v_notes);
end;
$$;

revoke all on function public.pv_contrib_notes(jsonb) from public;
grant execute on function public.pv_contrib_notes(jsonb) to anon, authenticated;

comment on function public.pv_contrib_notes(jsonb) is
  '他人の補足。見せてよいかは pv_contrib_sees が決める（開いていない人には状態の1語だけ）。返すのは文と質問の id だけ。';


-- ════════════════════════════════════════════════════════════════
-- 7-b. 他人の回答の集計（立場をサーバが見てから返す）
-- ════════════════════════════════════════════════════════════════
-- 受け取る形: { airline: 'jal', keys: ['reserve_duty', 'staff_travel', …] }   keys は 1〜120
-- 返す形:
--   開いていない人 … { ok, state:'login' | 'locked' | 'give' }   ← 状態の1語だけ。facts は鍵ごと無い
--   開いている人   … { ok, state:'open', facts:[…] }
--   facts の1件 … { question_id, kind, n, lead, median_num, ym }
--     lead … 「最多」と書いてよい答えの符号の並び（決め方は、関数の中の説明の1か所）。null ＝ 数の質問など／空 ＝ 回答が分かれている
--     ym … 最後に確かめられた月（'YYYY-MM'）。日時は返さない（「さっき出した人」が分かる）
-- ★見せてよいかは pv_contrib_sees が決める。ここは、その1語を聞いてから先へ進むだけ。
-- ★開いていない人には、会社が在るか・質問の指定が正しいかにも答えない・止めない
--   ＝ 在る会社・無い会社・引数なしで、返事が1文字も違わない。
-- ★3人そろっていない質問は、開いている人にも返さない（行が無い ＝ 誰も答えていないのと同じ返事）。
--   3人の壁・親の条件・通貨つきの額の扱いは、ビュー（db/airline-conditions.sql の 9）が決めたまま。
--   ここは回答の表を直接読まない。
-- ★返さないもの ── 答えごとの人数（分布）・割合・top_code・「わからない」の数・節・日時。
-- ★読むだけ（stable）。資格は1つも付けない・1つも書かない。
create or replace function public.pv_contrib_facts(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_airline text := nullif(btrim(p->>'airline'), '');
  v_sees    text := public.pv_contrib_sees(v_airline);
  v_keys_ok boolean;
  v_keys    text[] := '{}'::text[];
  v_facts   jsonb;
begin
  -- 開いていない人には、ここまで（会社が在るか・質問の指定が正しいかにも答えない・止めない）
  if v_sees is distinct from 'open' then
    return jsonb_build_object('ok', true, 'state', coalesce(v_sees, 'login'));
  end if;

  v_keys_ok := case when jsonb_typeof(p->'keys') = 'array'
                    then jsonb_array_length(p->'keys') between 1 and 120
                    else false end;
  if not v_keys_ok then
    raise exception '質問の指定が正しくありません' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct k.v), '{}'::text[])
    into v_keys
    from jsonb_array_elements_text(p->'keys') as k(v)
   where k.v ~ '^[a-z0-9_]{1,64}$';
  if v_airline is null or v_airline = 'other'
     or not exists (select 1 from public.pv_airlines where code = v_airline) then
    raise exception '航空会社が正しくありません' using errcode = '22023';
  end if;

  -- ★lead ＝ 画面が「最多」と書いてよい答え（符号の並び）。決めるのは、ここ1か所（画面は数えない・決めない）。
  --   もとにするのは、ビューが数えたもの（answer_dist と n）だけ ＝「わからない」・スキップだけの行・
  --   親の条件から外れた回答・社名を打った行は、ここでも数に入らない。
  --     いちばん多い答えが1つ                         → その1つ
  --     2つ以上並んだ                                 → 空の並び（画面は「回答が分かれています」）
  --     ただし「選べるだけ選ぶ」質問で並んだ時は、先に台帳を見る ──
  --       並んだ答えに台帳に無い符号が混じる（半分より多くても、少なくても） → null（画面は名前の引けない答えを出さない）
  --       どれも、答えた人の半分より多く（かつ人数以下）が選んだ             → 並んだ答えぜんぶ
  --     数の質問・数えた答えが1つも無い行             → null（数の質問は median_num）
  --   並びは符号の順（collate "C"）＝ 同じ集計からは、いつも同じ字の返事。画面は台帳の順で出す（この順に頼らない）。
  --   ⚠️ 答えごとの人数・割合・top_code は返さない。返すのは、決めた結果だけ。
  select coalesce(jsonb_agg(jsonb_build_object(
                    'question_id', f.question_id,
                    'kind',        f.kind,
                    'n',           f.n,
                    'lead',        l.lead,
                    'median_num',  f.median_num,
                    'ym',          to_char(f.last_confirmed_at at time zone 'utc', 'YYYY-MM'))
                  order by f.question_id), '[]'::jsonb)
    into v_facts
    from public.airline_condition_facts f
    join public.pv_condition_questions q on q.id = f.question_id and q.active
    left join lateral (
      select case
               when count(*) = 0 then null
               when count(*) = 1 then jsonb_agg(t.code)
               when f.kind <> 'multi' then '[]'::jsonb
               when not bool_and(t.code = any(q.choice_codes)) then null
               when max(t.c) * 2 > f.n and max(t.c) <= f.n
                 then jsonb_agg(t.code order by t.code collate "C")
               else '[]'::jsonb
             end as lead
        from (select e.key as code, e.value::int as c,
                     max(e.value::int) over () as top
                from jsonb_each_text(f.answer_dist) as e) t
       where t.c = t.top
    ) l on true
   where f.airline = v_airline
     and f.question_id = any(v_keys);

  return jsonb_build_object('ok', true, 'state', 'open', 'facts', v_facts);
end;
$$;

revoke all on function public.pv_contrib_facts(jsonb) from public;
grant execute on function public.pv_contrib_facts(jsonb) to anon, authenticated;

comment on function public.pv_contrib_facts(jsonb) is
  '他人の回答の集計。見せてよいかは pv_contrib_sees が決める（開いていない人には状態の1語だけ）。3人そろった質問だけ。';

-- ★集計のビューは、誰にも直接読ませない（db/airline-conditions.sql でも閉じている。
--   あちらを古い版で貼り直した直後でも、このファイルを貼れば閉じる）。
revoke all on public.airline_condition_facts from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 8. 検算（貼ったあとに出る1行。ポリシー数は 0・それ以外は全部 true が正しい）
-- ════════════════════════════════════════════════════════════════
-- ★「資格に触らない」は、関数の中身を文字で見ている。預かる・返す・引き継ぐ関数の**中に**、
--   資格の列の名前を注意書きとしても書かないこと（書くと注意書きだけで false になる）。
select (select count(*) from pg_policies
         where schemaname = 'public'
           and tablename in ('pv_contrib_keys', 'pv_contrib_pending'))            as ポリシー数,
       (select bool_and(relrowsecurity) from pg_class
         where oid in ('public.pv_contrib_keys'::regclass,
                       'public.pv_contrib_pending'::regclass))                    as 表は閉じている,
       not has_table_privilege('anon', 'public.pv_contrib_pending', 'select')
         and not has_table_privilege('authenticated', 'public.pv_contrib_pending', 'select')
         and not has_table_privilege('authenticated', 'public.pv_contrib_keys', 'select')
                                                                                  as 預かりは誰も直接読めない,
       has_function_privilege('anon', 'public.submit_contrib_anon(jsonb)', 'execute')
         and has_function_privilege('anon', 'public.my_contrib_anon(jsonb)', 'execute')
                                                                                  as 未ログインで預けて読める,
       not has_function_privilege('anon', 'public.claim_contrib(jsonb)', 'execute')
                                                                                  as 引き継ぎはログインが要る,
       pg_get_functiondef('public.pv_contrib_notes(jsonb)'::regprocedure) like '%pv_contrib_sees(%'
                                                                                  as 補足は立場を見てから返す,
       (pg_get_functiondef('public.submit_contrib_anon(jsonb)'::regprocedure)
          || pg_get_functiondef('public.my_contrib_anon(jsonb)'::regprocedure)
          || pg_get_functiondef('public.claim_contrib(jsonb)'::regprocedure))
         !~ '(access_until|pay_report|pay_streak|last_pay|badge|verify_level|founding|review_unlock)'
                                                                                  as 資格に触らない,
       not has_table_privilege('anon', 'public.airline_condition_facts', 'select')
         and not has_table_privilege('authenticated', 'public.airline_condition_facts', 'select')
                                                                                  as 集計は誰も直接読めない,
       pg_get_functiondef('public.pv_contrib_facts(jsonb)'::regprocedure) like '%pv_contrib_sees(%'
         and pg_get_functiondef('public.pv_contrib_notes(jsonb)'::regprocedure) like '%pv_contrib_sees(%'
         and pg_get_functiondef('public.pv_contrib_give(jsonb)'::regprocedure) like '%pv_contrib_sees(%'
         and pg_get_functiondef('public.pv_work_view(jsonb)'::regprocedure) like '%pv_contrib_sees(%'
         and pg_get_functiondef('public.pv_work_month_stats(jsonb)'::regprocedure) like '%pv_contrib_sees(%'
         and pg_get_functiondef('public.next_condition_questions(jsonb)'::regprocedure) like '%pv_contrib_sees(%'
         and pg_get_functiondef('public.pv_town_board(jsonb)'::regprocedure) like '%pv_contrib_sees(%'
         and pg_get_functiondef('public.pv_contrib_sees(text)'::regprocedure) like '%pv_work_level()%'
                                                                                  as 集計と補足は同じ決まりで返す,
       not has_function_privilege('anon', 'public.pv_contrib_sees(text)', 'execute')
         and not has_function_privilege('authenticated', 'public.pv_contrib_sees(text)', 'execute')
         and not has_function_privilege('authenticated', 'public.pv_contrib_own(uuid)', 'execute')
         and (select bool_and(provolatile = 's') from pg_proc
               where oid in ('public.pv_contrib_facts(jsonb)'::regprocedure,
                             'public.pv_contrib_give(jsonb)'::regprocedure,
                             'public.pv_contrib_sees(text)'::regprocedure,
                             'public.pv_contrib_own(uuid)'::regprocedure))
                                                                                  as 集計の口は読むだけ;
