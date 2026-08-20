-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/notify-admin-webhooks.sql
--
-- Database Webhook（3本）を SQL だけで作る。ダッシュボードの
-- Database Webhooks 画面に辿り着けないときの代替手段。
-- 画面から作った場合はこのファイルを流す必要はない（流しても二重には
-- ならない — 同名のトリガが既にあれば作成を飛ばす）。
--
-- Supabase の「Database Webhook」の正体は、supabase_functions.http_request を
-- 呼ぶ普通のトリガ。なので、既に本番で動いている translate-review の
-- トリガを「ひな型」として読み取り、
--   ・呼び先を notify-admin に差し替え
--   ・対象テーブルを contacts / profiles / reviews_v2 に差し替え
--   ・イベントを INSERT のみに固定
-- した3本を作る。
--
-- ひな型から複製するので、**認証ヘッダやプロジェクト URL を自分で
-- 打ち込む必要がない**（キーを画面に出さずに済む）。
--
-- 使い方: Supabase → SQL Editor → New query に全文を貼って Run。
-- 冪等（何度流しても安全）。
-- ════════════════════════════════════════════════════════════════

do $$
declare
  tmpl   text;
  tbl    text;
  hook   text;
  newdef text;
  made   int := 0;
begin
  -- ── ひな型を探す ──────────────────────────────────────────
  select pg_get_triggerdef(t.oid)
    into tmpl
    from pg_trigger t
   where not t.tgisinternal
     and pg_get_triggerdef(t.oid) like '%/functions/v1/translate-review%'
   limit 1;

  if tmpl is null then
    raise exception using
      message = 'translate-review の Webhook トリガが見つかりません。',
      hint    = 'このファイルは既存の Webhook を複製する方式です。1本も無い場合は、'
                'ダッシュボードの Database Webhooks 画面から作ってください。';
  end if;

  -- ── 3本作る ───────────────────────────────────────────────
  foreach tbl in array array['contacts', 'profiles', 'reviews_v2'] loop
    hook := 'notify_admin_' || tbl;

    -- 対象テーブルが無ければ飛ばす（contacts 未作成のまま流した場合など）。
    -- ::regclass は存在しない名前で例外を投げるので、必ずこの判定を先に置く。
    if to_regclass('public.' || tbl) is null then
      raise notice 'テーブルがありません: public.%. 先に db/contacts.sql を実行してください。', tbl;
      continue;
    end if;

    -- 既にあれば飛ばす（作り直さない＝画面から作った分を壊さない）
    if exists (
      select 1 from pg_trigger tg
       where tg.tgname = hook
         and tg.tgrelid = to_regclass('public.' || tbl)
    ) then
      raise notice '既にあります: % (%). 作成を飛ばしました。', hook, tbl;
      continue;
    end if;

    -- 名前・イベント・対象テーブルを一括で差し替える。
    -- ひな型が AFTER INSERT OR UPDATE でも、ここで INSERT のみに矯正される。
    -- （口コミの自動翻訳が走ったときの UPDATE で通知が二重に飛ぶのを防ぐ）
    newdef := regexp_replace(
      tmpl,
      '^CREATE TRIGGER \S+ AFTER [A-Z ]+ ON \S+',
      'CREATE TRIGGER ' || hook || ' AFTER INSERT ON public.' || tbl
    );

    -- 呼び先の関数だけ差し替える。URL・認証ヘッダはひな型のまま使う。
    newdef := replace(newdef, '/functions/v1/translate-review', '/functions/v1/notify-admin');

    -- タイムアウトを 5000ms に。既定の 1000ms だと、DB 読み直し＋Resend 送信が
    -- 間に合わずに切られることがある（切られるとメールだけ落ちる）。
    newdef := regexp_replace(newdef, ', ''\d+''\)$', ', ''5000'')');

    -- 差し替えが効いたことを確認してから実行する（効いていなければ
    -- translate-review を別テーブルに増やしてしまうので必ず止める）
    if newdef not like '%/functions/v1/notify-admin%'
       or newdef like '%/functions/v1/translate-review%' then
      raise exception 'ひな型の差し替えに失敗しました。画面から作成してください。定義: %',
        left(regexp_replace(newdef, 'Bearer [A-Za-z0-9._-]+', 'Bearer ***'), 200);
    end if;

    execute newdef;
    made := made + 1;
    raise notice '作成しました: % on public.%', hook, tbl;
  end loop;

  raise notice '完了。新規作成 % 本。', made;
end;
$$;

-- ── 確認（キーは表示しない）──────────────────────────────────
select tg.tgname                                    as webhook,
       c.relname                                    as "table",
       case
         when pg_get_triggerdef(tg.oid) like '%notify-admin%'     then 'notify-admin'
         when pg_get_triggerdef(tg.oid) like '%translate-review%' then 'translate-review'
         else 'その他'
       end                                          as "呼び先",
       case when pg_get_triggerdef(tg.oid) like '%AFTER INSERT ON%' then 'Insert のみ'
            else 'Insert 以外も含む' end             as "イベント"
  from pg_trigger tg
  join pg_class c on c.oid = tg.tgrelid
 where not tg.tgisinternal
   and pg_get_triggerdef(tg.oid) like '%supabase_functions.http_request%'
 order by 2, 1;
