/* ════════════════════════════════════════════════════════════════
   db/profile-lang.sql — 会員がどの言語で登録したかを覚える（2026-11-02・多言語化の段2）

   なぜ要るか
     メールの言語を、今は氏名と国から推測している（mail-bot/announce-mail.mjs の langModeOf など）。
     スペイン語のページから登録した人に、日本語や英語のメールが届かないよう、登録した画面の言語を残す。

   形
     ・profiles.lang … 'ja' | 'en' | 'es'。空（null）は「分からない」＝今までどおり推測する。
     ・書く口は pv_set_lang(p_lang) の1本だけ。本人の行だけ・言語の一覧に無い値は黙って捨てる。
       ★profiles の列の書き込み許可（db/admin.sql の grant update (…)）には足さない。
         登録の upsert に混ぜると、この SQL を貼る前は登録そのものが失敗する。
         画面は upsert のあとに別に呼び、失敗しても無視する（en/signup.html）。
     ・言語の一覧は langs.mjs と同じ（ja・en・es）。言語を足したら下の2か所（制約と関数）も足す。

   貼る順：どこに貼ってもよい（profiles があれば足りる）。何度貼っても同じ。
   ════════════════════════════════════════════════════════════════ */

alter table public.profiles add column if not exists lang text;
alter table public.profiles drop constraint if exists profiles_lang_ck;
alter table public.profiles add constraint profiles_lang_ck check (lang is null or lang in ('ja', 'en', 'es'));
comment on column public.profiles.lang is '登録した画面の言語 ja|en|es（null は分からない）。書くのは pv_set_lang だけ';

create or replace function public.pv_set_lang(p_lang text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;                        -- 未ログインは何もしない
  if p_lang is null or p_lang not in ('ja', 'en', 'es') then return; end if;
  update public.profiles set lang = p_lang
   where id = auth.uid() and lang is distinct from p_lang;          -- 同じなら書かない（書き込みを増やさない）
end;
$$;

revoke all on function public.pv_set_lang(text) from public, anon;
grant execute on function public.pv_set_lang(text) to authenticated;

/* 検算（貼ったあと、この3行が ✅ なら完了） */
select case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'lang')
            then '✅ profiles.lang がある' else '❌ profiles.lang が無い' end as check_1
union all
select case when exists (select 1 from pg_proc where proname = 'pv_set_lang')
            then '✅ pv_set_lang がある' else '❌ pv_set_lang が無い' end
union all
select case when not has_function_privilege('anon', 'public.pv_set_lang(text)', 'execute')
            then '✅ 未ログインからは呼べない' else '❌ 未ログインから呼べてしまう' end;
