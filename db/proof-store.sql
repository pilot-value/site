/* ════════════════════════════════════════════════════════════════
   db/proof-store.sql — パイロットであることを示す画像の「置き場」（main の定義をそのまま・2026-10-16）

   ★このファイルの ▼ と ▲ のあいだは、main の2つのファイルの**切り出しそのまま**（1文字も変えていない）。
     ① main:db/pay-rows.sql 1-e2 … 表 pv_proof（2つに分けて切り出す。あいだの制約 pv_proof_state_ck の
        2文だけは持ってこない ── 状態の決まりは db/proof-offer.sql の 1. が置く）
     ② main:db/pilot-proof.sql 1.・2. … 画像の表 pv_proof_images と、2つの引き金
     同じかどうかは db/test-proof-offer.mjs が指紋で見ている（1文字でも違えば赤）。
   ★持ってこないもの ── 止める仕組み（pv_proof_blocked・pv_proof_held_keys・3つの門）、
     止まった会員の板と入口（pv_proof_state・pv_proof_submit）、運営の入口（admin_*）、検算。
     ＝ このブランチでは、誰も止められない・運営も画像を読めない。
   ★main を取り込むときに、このファイルは消す（main の2つのファイルが同じものを置く）。
   ⚠️ ここを直さない。直すなら main の側で、取り込んだあとに。
   ⚠️ 会員を名指しで書かない（公開リポジトリ）。
   貼る順 ── … → db/admin.sql → これ → db/proof-offer.sql → … → db/stays.sql
════════════════════════════════════════════════════════════════ */

-- ▼ main:db/pay-rows.sql 1-e2（その1）
create table if not exists public.pv_proof (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  state        text not null default 'required',
  required_at  timestamptz not null default now(),
  submitted_at timestamptz,
  -- 「出し直してください」と返した時刻。入っているあいだ、会員の板はその文を出す。
  rejected_at  timestamptz,
  decided_at   timestamptz,
  -- 画像を出した回数（置き場を埋める連投を止めるためだけ。db/pilot-proof.sql が数える）
  tries        integer not null default 0
);
-- ▲

-- （main ではここに制約 pv_proof_state_ck の2文がある。持ってこない ── db/proof-offer.sql の 1.）

-- ▼ main:db/pay-rows.sql 1-e2（その2）
alter table public.pv_proof enable row level security;
revoke all on table public.pv_proof from public, anon, authenticated;

comment on table public.pv_proof is
  'パイロットであることの確認を求めている会員。required / submitted のあいだ、'
  'REAL PAY・DEEP PAY・口コミ本文の3つの門が「鍵が無い人」と同じ答えを返す。'
  '★会員を名指しで書かない。入れるのは admin.html のボタンだけ。'
  'RLS 有効・ポリシー無し・grant 無し＝security definer の中からしか読めない。';
-- ▲


-- ▼ main:db/pilot-proof.sql 1.・2.
-- ── 1. 画像（1人につき1枚）────────────────────────────────────
--   主キーが user_id そのもの＝2枚目を入れる道が無い。出し直しは上書き。
create table if not exists public.pv_proof_images (
  user_id    uuid primary key references public.pv_proof(user_id) on delete cascade,
  mime       text not null default 'image/jpeg',
  bytes      bytea not null,
  byte_len   integer not null,
  created_at timestamptz not null default now()
);

alter table public.pv_proof_images drop constraint if exists pv_proof_images_len_ck;
alter table public.pv_proof_images add constraint pv_proof_images_len_ck check (
  byte_len = octet_length(bytes) and byte_len > 0 and byte_len <= 900000);
alter table public.pv_proof_images drop constraint if exists pv_proof_images_mime_ck;
-- ★JPEG だけ。画面は必ず canvas で焼き直してから送る（撮影地などの
--   付帯情報が落ちる・SVG のような「絵の顔をした HTML」が原理的に入らない）
alter table public.pv_proof_images add constraint pv_proof_images_mime_ck check (
  mime = 'image/jpeg' and substring(bytes from 1 for 3) = '\xffd8ff'::bytea);

alter table public.pv_proof_images enable row level security;
revoke all on table public.pv_proof_images from public, anon, authenticated;

comment on table public.pv_proof_images is
  'パイロットであることの確認のために会員が出した画像（1人1枚・JPEG）。'
  '★確認待ち（pv_proof.state = submitted）のあいだだけ在る。それ以外になった瞬間に引き金が消す。'
  'RLS 有効・ポリシー無し・grant 無し。読めるのは admin_proof_image（運営）だけ。';


-- ── 2. 約束①の実体：確認待ちでなくなったら、画像を消す ─────────
--   ★関数（承認・出し直し）の中にも delete を書かない。ここ1か所で足りるうえ、
--     2か所に書くと「片方だけ直して残る」ができる。
--   ★SQL Editor から手で state を 'approved' に書き換えても、ここが消す。
create or replace function public.pv_proof_discard_tg()
returns trigger
language plpgsql
as $fn$
begin
  if new.state <> 'submitted' then
    delete from public.pv_proof_images i where i.user_id = new.user_id;
  end if;
  return new;
end
$fn$;

drop trigger if exists pv_proof_discard on public.pv_proof;
create trigger pv_proof_discard
  after insert or update on public.pv_proof
  for each row execute function public.pv_proof_discard_tg();

revoke all on function public.pv_proof_discard_tg() from public, anon, authenticated;

-- 逆向きの網。確認待ちでない会員に画像を入れさせない（順番を間違えた関数や、
-- 手で入れた1行が「承認済みなのに画像が在る」を作らないように）。
create or replace function public.pv_proof_image_guard_tg()
returns trigger
language plpgsql
as $fn$
begin
  if not exists (select 1 from public.pv_proof b
                  where b.user_id = new.user_id and b.state = 'submitted') then
    raise exception '確認待ちではない会員の画像は置けません' using errcode = '23514';
  end if;
  return new;
end
$fn$;

drop trigger if exists pv_proof_image_guard on public.pv_proof_images;
create trigger pv_proof_image_guard
  before insert or update on public.pv_proof_images
  for each row execute function public.pv_proof_image_guard_tg();

revoke all on function public.pv_proof_image_guard_tg() from public, anon, authenticated;
-- ▲
