-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/review-summary-webhook.sql
--
-- 口コミ（public.reviews_v2）に行が入った・変わった・消えたら、
-- Edge Function summarize-reviews を呼ぶ Database Webhook を **1本** 作る。
-- これを貼った時点から、会社ページの「口コミの要約」が自動で作り直される。
--
-- ⚠️ 貼るのは最後。先に済ませておくこと（順番は
--    supabase/functions/summarize-reviews/index.ts の冒頭に在る）:
--      1. db/review-summary.sql を貼ってある（無ければ、このファイルは作らずに止まる）
--      2. Edge Function summarize-reviews を Deploy してある
--      3. {"dry":true} と {} を1回ずつ POST して、動くことを見てある
--    関数を置く前にこれだけ貼っても壊れはしない（呼び先が無くて空振りするだけ）が、
--    口コミが入るたびに失敗の記録が残る。
--
-- Supabase の「Database Webhook」の正体は、supabase_functions.http_request を
-- 呼ぶ普通のトリガ。なので db/notify-admin-webhooks.sql と同じやり方で、
-- 既に本番で動いている translate-review のトリガを「ひな型」として読み取り、
--   ・名前を summarize_reviews_reviews_v2 に
--   ・呼び先を summarize-reviews に
--   ・イベントを INSERT・UPDATE・DELETE の3つに
--   ・待ち時間を 5000ms に
-- 差し替えた1本を作る。
-- ひな型から複製するので、**認証ヘッダやプロジェクト URL を自分で
-- 打ち込む必要がない**（キーを画面に出さずに済む）。
--
-- ★translate-review のトリガには触らない（読むだけ）。
--   このファイルに drop / alter は1つも無い。作る前と後で定義が1文字でも
--   違っていたら、例外を投げて全部を巻き戻す。
--
-- なぜ3つのイベントか:
--   INSERT … 口コミが増えた
--   DELETE … 口コミが消えた（3件を割ったら、預かっている要約も消す）
--   UPDATE … 会社コードの付け替えなど、数える集合が変わることがある。
--            UPDATE のたびに呼ばれるが、作り直すかどうかは DB が決める。本文が書き換わった・要約の言語の訳が
--            （ほかの言語で書かれた口コミに）入った、のときだけ1回作り直す。点数だけ・ほかの言語の訳だけなら
--            **モデルは呼ばれない**（課金なし）。
--
-- 待ち時間（5000ms）を伸ばさない:
--   この webhook は結果を待たない。関数は先に「受け取った」とだけ返し、
--   仕事を後ろで続ける。結果は関数のログに出る
--   （Edge Functions → summarize-reviews → Logs）。
--
-- 使い方: Supabase → SQL Editor → New query に全文を貼って Run。
-- 冪等（何度流しても安全。既に在れば作成を飛ばす）。
-- 確認は末尾のコメントの SQL。止め方もそこに在る。
-- ════════════════════════════════════════════════════════════════

do $hook$
declare
  hook     constant text := 'summarize_reviews_reviews_v2';
  head     constant text := 'CREATE TRIGGER summarize_reviews_reviews_v2 AFTER INSERT OR DELETE OR UPDATE ON public.reviews_v2 ';
  tmpl_oid oid;
  tmpl     text;
  newdef   text;
  existing text;
  shown    text;
begin
  if to_regclass('public.reviews_v2') is null then
    raise exception 'public.reviews_v2 がありません。';
  end if;

  -- ── 受け皿が先 ────────────────────────────────────────────
  -- db/review-summary.sql の「自動の道」が入っていないうちは作らない
  -- （関数が DB に聞きに行っても、答える側が居ない）。
  if to_regprocedure('public.pv_review_summary_due(jsonb)') is null
     or to_regprocedure('public.pv_review_summary_take(jsonb)') is null
     or to_regprocedure('public.pv_review_summary_set_auto(jsonb)') is null
     or to_regprocedure('public.pv_review_summary_done(jsonb)') is null then
    raise exception using
      message = '口コミの要約の「自動の道」がまだ入っていません。',
      hint    = '先に db/review-summary.sql の全文を SQL Editor に貼ってください。';
  end if;

  -- ── ひな型を探す（reviews_v2 に付いている translate-review の webhook）──
  select t.oid, pg_get_triggerdef(t.oid)
    into tmpl_oid, tmpl
    from pg_trigger t
   where not t.tgisinternal
     and t.tgrelid = to_regclass('public.reviews_v2')
     and pg_get_triggerdef(t.oid) like '%supabase_functions.http_request(%'
     and pg_get_triggerdef(t.oid) like '%/functions/v1/translate-review%'
   order by t.tgname
   limit 1;

  if tmpl is null then
    raise exception using
      message = 'translate-review の Webhook トリガが見つかりません。',
      hint    = 'このファイルは既存の Webhook を複製する方式です。1本も無い場合は、'
                'ダッシュボードの Database Webhooks 画面から作ってください'
                '（表 reviews_v2・Insert / Update / Delete・呼び先 summarize-reviews）。';
  end if;

  -- ── 既にあれば飛ばす（作り直さない＝画面から作った分を壊さない）──
  -- ⚠️ トリガ名ではなく「呼び先」で見る（画面から作った分は別の名前が付く。
  --    名前で照合すると同じ表に2本生えて、関数が1件につき2回呼ばれる）。
  select tg.tgname into existing
    from pg_trigger tg
   where not tg.tgisinternal
     and tg.tgrelid = to_regclass('public.reviews_v2')
     and pg_get_triggerdef(tg.oid) like '%/functions/v1/summarize-reviews%'
   order by tg.tgname
   limit 1;

  if existing is not null then
    raise notice '既にあります: %（public.reviews_v2）。作成を飛ばしました。', existing;
    return;
  end if;

  -- ── 複製して差し替える ────────────────────────────────────
  -- 名前・イベント・対象テーブル。
  -- ひな型の名前は、画面から作ると "Translate review" のように引用符つき・空白入りの
  -- ことがある（\S+ だけでは空白で切れて、差し替えが効かない）。両方の形を読む。
  newdef := regexp_replace(
    tmpl,
    '^CREATE TRIGGER (?:"(?:[^"]|"")+"|\S+) AFTER [A-Z ]+ ON \S+',
    'CREATE TRIGGER ' || hook || ' AFTER INSERT OR DELETE OR UPDATE ON public.reviews_v2'
  );

  -- 呼び先の関数だけ差し替える。URL・認証ヘッダはひな型のまま使う。
  newdef := replace(newdef, '/functions/v1/translate-review', '/functions/v1/summarize-reviews');

  -- 待ち時間を 5000ms に（db/notify-admin-webhooks.sql と同じ値）。
  newdef := regexp_replace(newdef, ', ''\d+''\)$', ', ''5000'')');

  -- 差し替えが効いたことを確認してから実行する。
  --   ・頭（名前・イベント・表）が決めた字と1文字も違わない
  --   ・そのすぐ後ろが FOR EACH ROW EXECUTE（＝ひな型に WHEN の条件や列の指定が
  --     付いていない。付いていると、条件ごと写って「呼ばれるはずの回に呼ばれない」）
  --   ・呼び先が summarize-reviews で、translate-review が残っていない
  if left(newdef, length(head)) is distinct from head
     or position('FOR EACH ROW EXECUTE ' in newdef) <> length(head) + 1
     or newdef not like '%/functions/v1/summarize-reviews%'
     or newdef like '%/functions/v1/translate-review%' then
    -- ⚠️ 出すのは EXECUTE より前（名前・イベント・表）だけ。引数（URL・ヘッダ）は出さない。
    shown := case when position(' EXECUTE ' in newdef) > 0
                  then left(left(newdef, position(' EXECUTE ' in newdef) - 1), 200)
                  else '（読めない形）' end;
    raise exception using
      message = 'ひな型の差し替えに失敗しました。何も作っていません。',
      detail  = '差し替えた定義の頭: ' || shown,
      hint    = 'ダッシュボードの Database Webhooks 画面から作ってください'
                '（表 reviews_v2・Insert / Update / Delete・呼び先 summarize-reviews）。';
  end if;

  execute newdef;

  -- ── translate-review のトリガが作る前と同じであることを確かめる ──
  -- 違っていたら例外 ＝ このブロックが丸ごと巻き戻る（作った1本も残らない）。
  if not exists (select 1 from pg_trigger t where t.oid = tmpl_oid)
     or pg_get_triggerdef(tmpl_oid) is distinct from tmpl then
    raise exception 'translate-review のトリガが変わってしまいました。巻き戻します。';
  end if;

  raise notice '作成しました: % on public.reviews_v2', hook;
end;
$hook$;


-- ── 確認（キーは表示しない。使うときは行頭の「-- 」を外して流す）──────
-- 見ること:
--   ・「呼び先」が summarize-reviews の行が **1本ちょうど**
--   ・その行の「イベント」が INSERT OR DELETE OR UPDATE、「待ち時間ms」が 5000
--   ・translate-review・notify-admin の行が、貼る前と同じまま残っている
--
-- ▼確認ここから
-- select tg.tgname                                    as webhook,
--        c.relname                                    as "table",
--        case
--          when pg_get_triggerdef(tg.oid) like '%/functions/v1/summarize-reviews%' then 'summarize-reviews'
--          when pg_get_triggerdef(tg.oid) like '%/functions/v1/translate-review%'  then 'translate-review'
--          when pg_get_triggerdef(tg.oid) like '%/functions/v1/notify-admin%'      then 'notify-admin'
--          else 'その他'
--        end                                          as "呼び先",
--        substring(pg_get_triggerdef(tg.oid) from ' AFTER ([A-Z ]+) ON ') as "イベント",
--        (regexp_match(pg_get_triggerdef(tg.oid), ', ''(\d+)''\)$'))[1]   as "待ち時間ms"
--   from pg_trigger tg
--   join pg_class c on c.oid = tg.tgrelid
--  where not tg.tgisinternal
--    and c.relname = 'reviews_v2'
--    and pg_get_triggerdef(tg.oid) like '%supabase_functions.http_request%'
--  order by 3, 1;
-- ▲確認ここまで


-- ── 止めるとき（自動の作り直しだけを止める）────────────────────
-- 預かっている要約はそのまま残り、会社ページに出続ける
-- （新しい口コミを反映しなくなるだけ）。もう一度このファイルを貼れば戻る。
-- translate-review・notify-admin のトリガには触らない。
--
--   drop trigger if exists summarize_reviews_reviews_v2 on public.reviews_v2;
--
-- ── 遅れているぶんを手で拾うとき ──────────────────────────────
-- この webhook は「口コミが動いた会社」しか見ない。モデルが落ちた回・手が回らなかった回
-- （ログの state が model_failed / deferred / superseded）は、その会社に次の口コミが入るか、
-- 関数に {} を POST するまで古いまま残る。定期の見回りは**置いていない**（オーナー判断）。
