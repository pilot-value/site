-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/review-pending.sql（2026-10-29）
--
-- ログインせずに口コミを出してもらい、あとでログインした人が自分の口コミにする口。
-- オーナー指示「口コミはログインなしでもかけるようにして（給与提出と同じ構造）」。
-- 手本は db/pay-report-pending.sql（給与の預かり）。形も約束も同じにしてある。
--
-- ★ このファイルは自動では流れない。オーナーが SQL Editor で実行する。
-- ★ 先に db/reviews-gate.sql を流すこと（預かりの表 pv_review_pending と
--    pv_review_hash がそちらにある）。冪等（何度流しても安全）。
--
-- ── 流れ ───────────────────────────────────────────────────
--   書く（未ログイン）→ submit_review_pending → 預かり証を端末に保存
--   → ログイン → claim_review_pending → reviews_v2 に本人の口コミとして入る → 鍵が開く
--
-- ── 守っている約束 ──────────────────────────────────────────
--  1. 表には誰も直接触れない（RLS・ポリシー0本・権限なし）。出入口はこの2つの関数と、
--     読む側の pv_reviews / pv_vote_latest（db/reviews-gate.sql）だけ。
--  2. 預かっただけでは何も開かない（本文を読む鍵は引き取ったときに開く）。給与と同じ。
--  3. 一覧には預かった時点で出る（2026-10-29 オーナー決定）。本文の見せ方は普通の口コミと同じ規則
--     （鍵の無い人には本文を返さない）。⚠️ ログインせずに書けて、すぐ人目に触れる口なので、
--     受け取れる形をサーバーでも確かめ、同じ回線からは1日5件まで（給与は20件）にしてある。
--  4. 返すのは預かり証だけ。
-- ════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.pv_review_pending') is null then
    raise exception '先に db/reviews-gate.sql を実行してください（預かりの表 pv_review_pending が無い）';
  end if;
  if to_regprocedure('public.pv_review_hash(uuid, text)') is null then
    raise exception '先に db/reviews-gate.sql を実行してください（pv_review_hash が無い）';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 1. pv_validate_review_payload — 受け取れる口コミか（画面の決まりと同じ）
--
-- 画面（submit-review.html）が止めるものを、サーバーでも止める。
-- 品質の判定（連打・同じ語の繰り返しなど）は画面の5か所の関数のまま（ここには写さない）。
-- 誰にも grant しない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.pv_validate_review_payload(p jsonb)
returns void
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  k     text;
  v     text;
  n     int;
  total int := 0;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception '入力の形式が不正です' using errcode = '22023';
  end if;
  v := btrim(coalesce(p->>'airline', ''));
  if v = '' or char_length(v) > 80 then
    raise exception '航空会社を選んでください' using errcode = '22023';
  end if;
  if coalesce(p->>'position', '') not in ('captain', 'fo') then
    raise exception '職位を選んでください' using errcode = '22023';
  end if;
  if coalesce(p->>'tenure_bucket', '') not in ('1-5', '5-10', '10-15', '15-20', '20+') then
    raise exception '勤務年数を選んでください' using errcode = '22023';
  end if;
  if coalesce(p->>'age_bucket', '') !~ '^([2-5][0-9]-[2-5][0-9]|60\+)$' then
    raise exception '年代を選んでください' using errcode = '22023';
  end if;
  if nullif(p->>'fleet', '') is not null and (p->>'fleet') !~ '^[a-z0-9-]{1,40}$' then
    raise exception '機材の形が不正です' using errcode = '22023';
  end if;
  if nullif(p->>'job_role', '') is not null and (p->>'job_role') !~ '^[a-z,]{1,120}$' then
    raise exception '役割の形が不正です' using errcode = '22023';
  end if;
  -- 6項目の点は必須（1〜5）。経営陣への提案（mgmt）は任意。
  foreach k in array array['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'] loop
    v := p->>(k || '_score');
    if v is null or v = '' then
      if k <> 'mgmt' then raise exception '評価（1〜5）を選んでください' using errcode = '22023'; end if;
    elsif v !~ '^[1-5]$' then
      raise exception '評価は1〜5です' using errcode = '22023';
    end if;
    n := char_length(btrim(coalesce(p->>(k || '_comment'), '')));
    if n > 300 then
      raise exception 'コメントは1項目300字までです' using errcode = '22023';
    end if;
    total := total + n;
  end loop;
  if total < 300 then
    raise exception 'コメントの合計が300字に足りません' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.pv_validate_review_payload(jsonb) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 2. submit_review_pending — ログインせずに預ける（anon に開ける口）
-- ════════════════════════════════════════════════════════════════
create or replace function public.submit_review_pending(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ip      text;
  v_iph     text;
  v_n       int;
  v_token   text;
  v_id      uuid;
  v_dup_id  uuid;
  v_dup_tok text;
  v_air     text;
  v_lang    text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 20000 then
    raise exception '入力の形式が不正です' using errcode = '22023';
  end if;
  perform public.pv_validate_review_payload(p);
  v_air  := btrim(p->>'airline');
  v_lang := case when p->>'lang' = 'en' then 'en' else 'ja' end;

  -- ── 同じ回線から1日5件まで（給与の預かりと同じ数え方。IP が取れない手元の検査では数えない）
  begin
    v_ip := split_part(
      coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_ip := btrim(v_ip);
  if v_ip <> '' then
    v_iph := encode(extensions.digest(v_ip || '::' || current_date::text, 'sha256'), 'hex');
    select count(*) into v_n
      from public.pv_review_pending
     where ip_day_hash = v_iph and created_at > now() - interval '1 day';

    -- 同じ回線・同じ日・同じ会社の未引き取りは、弾かずに上書きして同じ預かり証を返す
    -- （給与の預かりと同じ。新しい証を出すと、端末に古い1枚が宙に浮く）。
    perform pg_advisory_xact_lock(hashtext(v_iph || '|review|' || lower(v_air)));
    select id, claim_token into v_dup_id, v_dup_tok
      from public.pv_review_pending
     where ip_day_hash = v_iph
       and claimed_at is null
       and created_at > now() - interval '1 day'
       and lower(airline) = lower(v_air)
     order by created_at desc
     limit 1;
    if v_dup_tok is not null then
      update public.pv_review_pending
         set "position" = p->>'position', tenure_bucket = p->>'tenure_bucket', age_bucket = p->>'age_bucket',
             fleet = nullif(p->>'fleet', ''), job_role = nullif(p->>'job_role', ''),
             culture_score = (p->>'culture_score')::int, salary_score = (p->>'salary_score')::int,
             benefits_score = (p->>'benefits_score')::int, wlb_score = (p->>'wlb_score')::int,
             ops_score = (p->>'ops_score')::int, training_score = (p->>'training_score')::int,
             mgmt_score = nullif(p->>'mgmt_score', '')::int,
             culture_comment = nullif(btrim(p->>'culture_comment'), ''), salary_comment = nullif(btrim(p->>'salary_comment'), ''),
             benefits_comment = nullif(btrim(p->>'benefits_comment'), ''), wlb_comment = nullif(btrim(p->>'wlb_comment'), ''),
             ops_comment = nullif(btrim(p->>'ops_comment'), ''), training_comment = nullif(btrim(p->>'training_comment'), ''),
             mgmt_comment = nullif(btrim(p->>'mgmt_comment'), ''),
             orig_lang = v_lang, created_at = now()
       where id = v_dup_id;
      return jsonb_build_object('ok', true, 'claim_token', v_dup_tok, 'id', v_dup_id);
    end if;

    if v_n >= 5 then
      raise exception 'しばらくしてからもう一度お試しください' using errcode = '54000';
    end if;
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.pv_review_pending
    (claim_token, ip_day_hash, airline, "position", tenure_bucket, age_bucket, fleet, job_role,
     culture_score, salary_score, benefits_score, wlb_score, ops_score, training_score, mgmt_score,
     culture_comment, salary_comment, benefits_comment, wlb_comment, ops_comment, training_comment, mgmt_comment,
     orig_lang)
  values
    (v_token, v_iph, v_air, p->>'position', p->>'tenure_bucket', p->>'age_bucket',
     nullif(p->>'fleet', ''), nullif(p->>'job_role', ''),
     (p->>'culture_score')::int, (p->>'salary_score')::int, (p->>'benefits_score')::int,
     (p->>'wlb_score')::int, (p->>'ops_score')::int, (p->>'training_score')::int,
     nullif(p->>'mgmt_score', '')::int,
     nullif(btrim(p->>'culture_comment'), ''), nullif(btrim(p->>'salary_comment'), ''),
     nullif(btrim(p->>'benefits_comment'), ''), nullif(btrim(p->>'wlb_comment'), ''),
     nullif(btrim(p->>'ops_comment'), ''), nullif(btrim(p->>'training_comment'), ''),
     nullif(btrim(p->>'mgmt_comment'), ''),
     v_lang)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'claim_token', v_token, 'id', v_id);
end;
$$;
revoke all on function public.submit_review_pending(jsonb) from public;
grant execute on function public.submit_review_pending(jsonb) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 3. claim_review_pending — ログインした人が、預けた口コミを自分の口コミにする
--
-- ★proof_hash はサーバーが作る（pv_review_hash ＝ 画面の makeProofHash と同じ式）。
--   入れた瞬間に pv_has_review_key が true になる＝口コミの鍵が開く。
-- ★同じ会社の口コミがもうある人は、入れずに「引き取り済み」にして dup を返す
--   （画面の「この航空会社にはすでに投稿済みです」と同じ。1社1件）。
-- ★トークンだけで引く。「無い」「もう済んでいる」「切れた」を分けて返す
--   （給与の預かりで、応答が届かなかった再試行が「無い」に見えて2重になった教訓）。
-- ★1トランザクション。口コミへの書き込みが落ちれば claimed_at も戻る。
-- ════════════════════════════════════════════════════════════════
create or replace function public.claim_review_pending(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid  uuid := auth.uid();
  v_row  public.pv_review_pending%rowtype;
  v_hash text;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;
  if p_token is null or length(btrim(p_token)) not between 16 and 200 then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select * into v_row
    from public.pv_review_pending
   where claim_token = btrim(p_token)
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_row.claimed_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;
  if v_row.created_at <= now() - interval '30 days' then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  v_hash := public.pv_review_hash(v_uid, v_row.airline);
  if exists (select 1 from public.reviews_v2 where proof_hash = v_hash) then
    update public.pv_review_pending set claimed_at = now() where id = v_row.id;
    return jsonb_build_object('ok', true, 'dup', true, 'airline', v_row.airline);
  end if;

  insert into public.reviews_v2
    (proof_hash, airline, "position", tenure_bucket, age_bucket, fleet, job_role,
     culture_score, culture_comment, salary_score, salary_comment, benefits_score, benefits_comment,
     wlb_score, wlb_comment, ops_score, ops_comment, training_score, training_comment,
     mgmt_score, mgmt_comment)
  values
    (v_hash, v_row.airline, v_row."position", v_row.tenure_bucket, v_row.age_bucket, v_row.fleet, v_row.job_role,
     v_row.culture_score, v_row.culture_comment, v_row.salary_score, v_row.salary_comment,
     v_row.benefits_score, v_row.benefits_comment, v_row.wlb_score, v_row.wlb_comment,
     v_row.ops_score, v_row.ops_comment, v_row.training_score, v_row.training_comment,
     v_row.mgmt_score, v_row.mgmt_comment);

  update public.pv_review_pending set claimed_at = now() where id = v_row.id;
  return jsonb_build_object('ok', true, 'airline', v_row.airline, 'position', v_row."position");
end;
$$;
revoke all on function public.claim_review_pending(text) from public, anon;
grant execute on function public.claim_review_pending(text) to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 4. 自己点検（読むだけ。1本の SELECT。期待：5行すべて ✅）
-- ════════════════════════════════════════════════════════════════
select n as "#", case when ok then '✅' else '❌' end as 結果, 見るところ
  from (values
    (1, to_regprocedure('public.submit_review_pending(jsonb)') is not null
        and has_function_privilege('anon', 'public.submit_review_pending(jsonb)', 'execute'),
        '未ログインでも預けられる（submit_review_pending が anon に開いている）'),
    (2, to_regprocedure('public.claim_review_pending(text)') is not null
        and not has_function_privilege('anon', 'public.claim_review_pending(text)', 'execute')
        and has_function_privilege('authenticated', 'public.claim_review_pending(text)', 'execute'),
        '引き取りはログインした人だけ（claim_review_pending）'),
    (3, (select count(*) from pg_policies where schemaname = 'public' and tablename = 'pv_review_pending') = 0,
        '預かりの表にポリシーが1本も無い（足すと預かった本文を誰でも読める）'),
    (4, not has_table_privilege('anon', 'public.pv_review_pending', 'select')
        and not has_table_privilege('authenticated', 'public.pv_review_pending', 'select'),
        '預かりの表を直接読めない'),
    (5, not has_function_privilege('anon', 'public.pv_validate_review_payload(jsonb)', 'execute'),
        '判定の関数は外から呼べない')
  ) t(n, ok, 見るところ)
 order by n;
