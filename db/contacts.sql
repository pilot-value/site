-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/contacts.sql
-- お問い合わせフォームの保存先。Supabase → SQL Editor に貼り付けて実行。
-- 冪等（何度流しても安全）。
--
-- これまで contact.html は mailto: を開くだけで、ブラウザで Gmail を
-- 使っている人やメールアプリ未設定の端末では何も起きなかった。
-- それでも画面は 800ms 後に無条件で「送信完了」を出していたので、
-- 届いていない問い合わせが届いたことになっていた。
-- この表に INSERT して初めて「送信完了」を出すようにする。
--
-- INSERT を Database Webhook が拾い、Edge Function notify-admin が
-- info@pilot-value.com へ即時にメールする（返信先は送信者のアドレス）。
-- ════════════════════════════════════════════════════════════════

create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text,
  tel        text,
  message    text,
  lang       text default 'ja',              -- どちらのページから送られたか（ja | en）
  user_agent text,                           -- いたずら送信の切り分け用
  created_at timestamptz not null default now()
);

comment on table  public.contacts         is 'お問い合わせフォームの受信箱。通知は Edge Function notify-admin が送る。';
comment on column public.contacts.lang    is '送信元ページの言語 ja|en';

create index if not exists contacts_created_at_idx on public.contacts (created_at desc);

-- ── RLS ────────────────────────────────────────────────────────
-- 訪問者はログインしていないので anon の INSERT だけを明示的に許可する。
-- SELECT / UPDATE / DELETE のポリシーは作らない＝anon からは
-- 他人の問い合わせを1件も読めないし、消せない。
-- 管理者は service_role（RLS を無視する）か Supabase の Table editor で見る。
alter table public.contacts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'contacts' and policyname = 'contacts_insert_anon'
  ) then
    create policy contacts_insert_anon
      on public.contacts for insert
      to anon, authenticated
      with check (true);
  end if;
end;
$$;

-- 確認用（使うときは下の2行から -- を「まとめて」外す。1行だけ外すと
-- 文が途中で終わって 42601 syntax error at end of input になる）:
-- select id, name, email, lang, left(message, 60) as message_head, created_at
--   from public.contacts order by created_at desc limit 20;
