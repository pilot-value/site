-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/notify-admin-webhooks.sql
--
-- Database Webhook（6本）を SQL だけで作る。ダッシュボードの
-- Database Webhooks 画面に辿り着けないときの代替手段。
-- 画面から作った場合はこのファイルを流す必要はない（流しても二重には
-- ならない — その表に notify-admin を呼ぶトリガが既にあれば作成を飛ばす）。
--
-- Supabase の「Database Webhook」の正体は、supabase_functions.http_request を
-- 呼ぶ普通のトリガ。なので、既に本番で動いている translate-review の
-- トリガを「ひな型」として読み取り、
--   ・呼び先を notify-admin に差し替え
--   ・対象テーブルを下の6つに差し替え
--   ・イベントを INSERT のみに固定
-- した6本を作る。
--
-- 6つの内訳:
--   contacts / profiles / reviews_v2   … お問い合わせ・新規会員・新着口コミ
--   pay_reports                        … 給与レポート（★金額はメールに載せない）
--   pay_reports_pending                … 会員登録せずに出した給与レポート（預かり）
--   airline_conditions                 … 待遇アンケートの回答（1問＝1通）
--
-- ⚠️ ここの配列と supabase/functions/notify-admin/index.ts の builders は
--    同じ顔ぶれでなければならない。片方だけ足すと「実装は正しく見えるのに
--    一通も届かない」という静かな壊れ方をする。
--    手元の `node assert-admin-notify.mjs` が両者の一致を見張っている。
--
-- ひな型から複製するので、**認証ヘッダやプロジェクト URL を自分で
-- 打ち込む必要がない**（キーを画面に出さずに済む）。
--
-- 使い方: Supabase → SQL Editor → New query に全文を貼って Run。
-- 冪等（何度流しても安全）。
--
-- Run のあとに出る表で確認すること:
--   ・「呼び先」が notify-admin の行が **6本ちょうど**（同じ table が2行出ない）
--   ・その6本すべて「イベント」が **Insert のみ**
-- ════════════════════════════════════════════════════════════════

do $$
declare
  tmpl     text;
  tbl      text;
  hook     text;
  newdef   text;
  existing text;
  made     int := 0;
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

  -- ── 7本作る ───────────────────────────────────────────────
  -- ⚠️ pv_request_likes は入れない。♡ を1押しするたびにメールが飛ぶ。
  foreach tbl in array array['contacts', 'profiles', 'reviews_v2',
                             'pay_reports', 'pay_reports_pending', 'airline_conditions',
                             'pv_requests'] loop
    hook := 'notify_admin_' || tbl;

    -- 対象テーブルが無ければ飛ばす（contacts 未作成のまま流した場合など）。
    -- ::regclass は存在しない名前で例外を投げるので、必ずこの判定を先に置く。
    if to_regclass('public.' || tbl) is null then
      raise notice 'テーブルがありません: public.%. 先に対応する db/*.sql を実行してください。', tbl;
      continue;
    end if;

    -- 既にあれば飛ばす（作り直さない＝画面から作った分を壊さない）。
    -- ⚠️ トリガ名ではなく「呼び先」で見る。画面から作った分は別の名前が
    --    付いていることがあり（notify_admin_reviews と notify_admin_reviews_v2 が
    --    2026-08-23 に実際に並んだ）、名前で照合すると同じ表に2本生えて
    --    Edge Function が1件につき2回呼ばれる。
    --    ※ もし既に名前違いで二重になっている表があれば、このファイルは
    --      飛ばすだけで畳まない。ファイル末尾のコメントの SQL で手で外す。
    select tg.tgname into existing
      from pg_trigger tg
     where not tg.tgisinternal
       and tg.tgrelid = to_regclass('public.' || tbl)
       and pg_get_triggerdef(tg.oid) like '%/functions/v1/notify-admin%'
     limit 1;

    if existing is not null then
      raise notice '既にあります: % (%). 作成を飛ばしました。', existing, tbl;
      continue;
    end if;

    -- 名前・イベント・対象テーブルを一括で差し替える。
    -- ひな型が AFTER INSERT OR UPDATE でも、ここで INSERT のみに矯正される。
    -- （口コミの自動翻訳が走ったときの UPDATE で通知が二重に飛ぶのを防ぐ。
    --   給与レポートの出し直しと待遇の答え直しも on conflict do update ＝ UPDATE
    --   なので、INSERT のみに固定してあることで通知が増えない）
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

-- ── もし同じ表に2本並んでいたら（手で外す）──────────────────
-- 上の確認クエリで、同じ table の行が2つ出た場合だけ実行する。
-- 名前違いで二重になった表を1本に畳む（2026-08-23、reviews_v2 で起きた）。
-- メールは Idempotency-Key で1通に畳まれるので届く数は変わらないが、
-- Edge Function が1件につき2回呼ばれる状態を残さない。
-- タイムアウトが長いほうを残す（短いと送信の途中で切られて通知だけ落ちる。
-- このファイルが作る分は 5000ms、画面の既定は 1000ms）。
-- ⚠️ 'public.reviews_v2' の部分を、二重になっている表の名前に置き換えて使う。
--
--   do $dedup$
--   declare keep text; victim record;
--   begin
--     select x.tgname into keep from (
--       select tg.tgname,
--              coalesce((regexp_match(pg_get_triggerdef(tg.oid), ', ''(\d+)''\)'))[1]::int, 1000) as ms
--         from pg_trigger tg
--        where not tg.tgisinternal
--          and tg.tgrelid = 'public.reviews_v2'::regclass
--          and pg_get_triggerdef(tg.oid) like '%/functions/v1/notify-admin%'
--     ) x order by x.ms desc, x.tgname limit 1;
--
--     for victim in
--       select tg.tgname from pg_trigger tg
--        where not tg.tgisinternal
--          and tg.tgrelid = 'public.reviews_v2'::regclass
--          and pg_get_triggerdef(tg.oid) like '%/functions/v1/notify-admin%'
--          and tg.tgname <> keep
--     loop
--       execute format('drop trigger %I on public.reviews_v2', victim.tgname);
--       raise notice '外しました: %（% を残しました）', victim.tgname, keep;
--     end loop;
--   end;
--   $dedup$;
