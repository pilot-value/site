/* ════════════════════════════════════════════════════════════════
   db/proof-notice.sql — パイロット確認の画像が届いたら、運営にメールを1通（2026-11-03）

   ★オーナー指示「verified pilot になるための画像とか申請してきた人いたら、その時点でメールもらえる？」
     → 「通知メールたして」。それまでは届かず、管理画面を見に行くしかなかった。

   画像が届く道は2つ。どちらも一度だけ pv_proof の state が 'submitted' になるので、そこで印を1行置く。
     required … 運営が「証明を求める」を押した会員が出した（db/pilot-proof.sql の pv_proof_submit）
                → 管理画面の「資格確認」のタブ
     offered  … 会員が自分から申請した（db/proof-offer.sql の pv_proof_offer・db/stays.sql 10-c）
                → 管理画面の「申請してきた人」（オーナーだけ）
   印の表 pv_proof_notice への INSERT を、Database Webhook が notify-admin へ渡す
   （db/notify-admin-webhooks.sql の配列に入っている。このファイルの後に貼る）。

   ★印に入れるのは「いつ・どちらの道か・確認待ちが全部で何人か」の3つだけ。
     ⚠️ 誰が出したか（user_id）を入れない ── Webhook の中身は Supabase の送信の記録に残る。
     ⚠️ 画像の表（pv_proof_images）に Webhook を付けない ── 行に画像そのものが入っていて、
        付けると画像が丸ごと notify-admin へ送られる（画像はほかの関数から読まない約束）。
   ★出し直し（確認待ちのまま上書き）も1通。新しい画像を見る必要があるので。連投は元の
     tries の上限（10回）で止まる。
   ★画像が通らなかった回は印も残らない（同じ取引の中。申請の道は途中の失敗で巻き戻る）。
   ★印は30日で消す（メールを組み立てるのは届いてから数秒のうち。それより長く持たない）。

   ★貼る順 ── db/pay-rows.sql → … → db/pilot-proof.sql → db/proof-offer.sql → これ → db/notify-admin-webhooks.sql
   冪等（何度流しても安全）。
   ════════════════════════════════════════════════════════════════ */

do $pre$
begin
  if to_regclass('public.pv_proof') is null then
    raise exception '先に db/pay-rows.sql と db/pilot-proof.sql を実行してください（pv_proof が無い）';
  end if;
end
$pre$;

-- ── 1. 印の表 ──────────────────────────────────────────────
create table if not exists public.pv_proof_notice (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind       text not null check (kind in ('required', 'offered')),
  -- 印を置いた時点の確認待ち（required の道の submitted ＋ 申請の offered）の合計
  waiting    integer not null default 0
);

alter table public.pv_proof_notice enable row level security;
revoke all on table public.pv_proof_notice from public, anon, authenticated;

comment on table public.pv_proof_notice is
  'パイロット確認の画像が届いた印（いつ・どちらの道か・確認待ちの合計だけ）。INSERT を Webhook が notify-admin へ渡す。'
  '★誰が出したか・画像は入れない。RLS 有効・ポリシー無し・grant 無し。30日で消える。';

-- ── 2. 印を置く引き金 ─────────────────────────────────────────
create or replace function public.pv_proof_notice_tg()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $fn$
begin
  if new.state = 'submitted'
     and (tg_op = 'INSERT'
          or old.state is distinct from 'submitted'
          or old.submitted_at is distinct from new.submitted_at) then
    delete from public.pv_proof_notice n where n.created_at < now() - interval '30 days';
    insert into public.pv_proof_notice (kind, waiting)
    values (case when tg_op = 'INSERT' or old.state = 'offered' then 'offered' else 'required' end,
            (select count(*)::int from public.pv_proof b where b.state in ('submitted', 'offered')));
  end if;
  return null;
end
$fn$;

revoke all on function public.pv_proof_notice_tg() from public, anon, authenticated;

drop trigger if exists pv_proof_notice on public.pv_proof;
create trigger pv_proof_notice
  after insert or update of state, submitted_at on public.pv_proof
  for each row execute function public.pv_proof_notice_tg();
