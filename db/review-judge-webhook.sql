-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/review-judge-webhook.sql
--
-- ログインせずに出した口コミの預かり（public.pv_review_pending）に行が入ったら、
-- Edge Function translate-review を呼ぶ Database Webhook を **1本** 作る（2026-11-15）。
-- これを貼った時点から、預かりの口コミも AI の判定（何語か・意味のある文か・パイロットの勤務の話か・
-- 宣伝でないか）を通る。怪しい（hold）とした預かりは、運営が「載せる」を押すまで一覧に出ない。
-- 預かりは判定するだけで、訳さない（引き取ると reviews_v2 に新しい id で入り、そこで訳される）。
--
-- ⚠️ 貼るのは最後。先に済ませておくこと:
--      1. db/reviews-gate.sql を貼ってある（表 pv_review_judge と、判定を読む・書く2つの関数。
--         無ければ、このファイルは作らずに止まる）
--      2. Edge Function translate-review を、預かりを知っている版（2026-11-15 以降）で Deploy してある
--         ⚠️ 古い版のまま貼ると、預かりの id を reviews_v2 の id として読みに行き not_found で終わる
--            （壊れはしないが、預かりが判定されない）。
--
-- Supabase の「Database Webhook」の正体は、supabase_functions.http_request を
-- 呼ぶ普通のトリガ。なので db/review-summary-webhook.sql と同じやり方で、
-- 既に本番で動いている translate-review のトリガ（reviews_v2 に付いている）を「ひな型」として読み取り、
--   ・名前を translate_review_pv_review_pending に
--   ・イベントを INSERT だけに・表を pv_review_pending に
-- 差し替えた1本を作る。呼び先（translate-review）・URL・認証ヘッダ・待ち時間はひな型のまま。
-- ひな型から複製するので、**認証ヘッダやプロジェクト URL を自分で打ち込む必要がない**（キーを画面に出さずに済む）。
--
-- なぜ INSERT だけか:
--   預かりの行が UPDATE されるのは「引き取ったとき」だけで、そのとき中身（本文）は消える
--   （db/review-pending.sql の claim_review_pending）。判定するものが無い。
--   関数の側でも、引き取り済みの預かりは読んだ時点で何もしない。
--
-- 待ち時間をひな型から変えない:
--   判定は数秒かかるが、Webhook が待ちきれずに切っても関数は最後まで動く
--   （reviews_v2 の翻訳は数十秒かかり、同じひな型の待ち時間で毎日動いている）。
--   結果は関数のログに出る（Edge Functions → translate-review → Logs。預かりは src: "q"）。
--
-- ★reviews_v2 の translate-review のトリガには触らない（読むだけ）。
--   このファイルに drop / alter は1つも無い。作る前と後で定義が1文字でも
--   違っていたら、例外を投げて全部を巻き戻す。
--
-- 使い方: Supabase → SQL Editor → New query に全文を貼って Run。
-- 冪等（何度流しても安全。既に在れば作成を飛ばす）。
-- 最後に確認の表が出る（キーは出ない）。止め方は末尾のコメント。
-- ════════════════════════════════════════════════════════════════

do $hook$
declare
  hook     constant text := 'translate_review_pv_review_pending';
  head     constant text := 'CREATE TRIGGER translate_review_pv_review_pending AFTER INSERT ON public.pv_review_pending ';
  tmpl_oid oid;
  tmpl     text;
  newdef   text;
  existing text;
  shown    text;
begin
  if to_regclass('public.pv_review_pending') is null then
    raise exception using
      message = 'public.pv_review_pending がありません。',
      hint    = '先に db/reviews-gate.sql と db/review-pending.sql を貼ってください。';
  end if;

  -- ── 受け皿が先 ────────────────────────────────────────────
  -- 判定を書く表と関数が無いうちは作らない（関数が判定を書きに行っても、受ける側が居ない＝
  -- AI に払った判定が捨てられる。関数の側でも、読む関数が無ければ AI を呼ばずに止まる）。
  if to_regclass('public.pv_review_judge') is null
     or to_regprocedure('public.pv_review_judge_get(text, uuid)') is null
     or to_regprocedure('public.pv_review_judge_put(text, uuid, text, text, text, text, text)') is null then
    raise exception using
      message = '口コミの AI の判定の表（pv_review_judge）と関数がまだ入っていません。',
      hint    = '先に db/reviews-gate.sql の全文を SQL Editor に貼ってください。';
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
      message = 'reviews_v2 に translate-review の Webhook トリガが見つかりません。',
      hint    = 'このファイルは既存の Webhook を複製する方式です。1本も無い場合は、'
                'ダッシュボードの Database Webhooks 画面から作ってください'
                '（表 pv_review_pending・Insert のみ・呼び先 translate-review）。';
  end if;

  -- ── 既にあれば飛ばす（作り直さない＝画面から作った分を壊さない）──
  -- ⚠️ トリガ名ではなく「呼び先」で見る（画面から作った分は別の名前が付く。
  --    名前で照合すると同じ表に2本生えて、1件の預かりにつき2回判定される＝課金が倍）。
  select tg.tgname into existing
    from pg_trigger tg
   where not tg.tgisinternal
     and tg.tgrelid = to_regclass('public.pv_review_pending')
     and pg_get_triggerdef(tg.oid) like '%/functions/v1/translate-review%'
   order by tg.tgname
   limit 1;

  if existing is not null then
    raise notice '既にあります: %（public.pv_review_pending）。作成を飛ばしました。', existing;
    return;
  end if;

  -- ── 複製して差し替える ────────────────────────────────────
  -- 名前・イベント・対象テーブル。
  -- ひな型の名前は、画面から作ると "Translate review" のように引用符つき・空白入りの
  -- ことがある（\S+ だけでは空白で切れて、差し替えが効かない）。両方の形を読む。
  newdef := regexp_replace(
    tmpl,
    '^CREATE TRIGGER (?:"(?:[^"]|"")+"|\S+) AFTER [A-Z ]+ ON \S+',
    'CREATE TRIGGER ' || hook || ' AFTER INSERT ON public.pv_review_pending'
  );

  -- 差し替えが効いたことを確認してから実行する。
  --   ・頭（名前・イベント・表）が決めた字と1文字も違わない
  --   ・そのすぐ後ろが FOR EACH ROW EXECUTE（＝ひな型に WHEN の条件や列の指定が
  --     付いていない。付いていると、reviews_v2 の列で書いた条件ごと写って、作れないか
  --     「呼ばれるはずの回に呼ばれない」）
  --   ・呼び先が translate-review のまま
  if left(newdef, length(head)) is distinct from head
     or position('FOR EACH ROW EXECUTE ' in newdef) <> length(head) + 1
     or newdef not like '%/functions/v1/translate-review%' then
    -- ⚠️ 出すのは EXECUTE より前（名前・イベント・表）だけ。引数（URL・ヘッダ）は出さない。
    shown := case when position(' EXECUTE ' in newdef) > 0
                  then left(left(newdef, position(' EXECUTE ' in newdef) - 1), 200)
                  else '（読めない形）' end;
    raise exception using
      message = 'ひな型の差し替えに失敗しました。何も作っていません。',
      detail  = '差し替えた定義の頭: ' || shown,
      hint    = 'ダッシュボードの Database Webhooks 画面から作ってください'
                '（表 pv_review_pending・Insert のみ・呼び先 translate-review）。';
  end if;

  execute newdef;

  -- ── reviews_v2 の translate-review のトリガが作る前と同じであることを確かめる ──
  -- 違っていたら例外 ＝ このブロックが丸ごと巻き戻る（作った1本も残らない）。
  if not exists (select 1 from pg_trigger t where t.oid = tmpl_oid)
     or pg_get_triggerdef(tmpl_oid) is distinct from tmpl then
    raise exception 'reviews_v2 の translate-review のトリガが変わってしまいました。巻き戻します。';
  end if;

  raise notice '作成しました: % on public.pv_review_pending', hook;
end;
$hook$;


-- ── 確認（キーは表示しない）────────────────────────────────────
-- 見ること:
--   ・pv_review_pending の行で「呼び先」が translate-review の行が **1本ちょうど**・「イベント」が INSERT
--   ・reviews_v2 の translate-review の行が、貼る前と同じまま残っている
--   ・pv_review_pending の notify-admin の行（預かりの通知）も、そのまま残っている
select tg.tgname                                    as webhook,
       c.relname                                    as "table",
       case
         when pg_get_triggerdef(tg.oid) like '%/functions/v1/translate-review%'  then 'translate-review'
         when pg_get_triggerdef(tg.oid) like '%/functions/v1/notify-admin%'      then 'notify-admin'
         when pg_get_triggerdef(tg.oid) like '%/functions/v1/summarize-reviews%' then 'summarize-reviews'
         else 'その他'
       end                                          as "呼び先",
       substring(pg_get_triggerdef(tg.oid) from ' AFTER ([A-Z ]+) ON ') as "イベント",
       (regexp_match(pg_get_triggerdef(tg.oid), ', ''(\d+)''\)$'))[1]   as "待ち時間ms"
  from pg_trigger tg
  join pg_class c on c.oid = tg.tgrelid
 where not tg.tgisinternal
   and c.relname in ('reviews_v2', 'pv_review_pending')
   and pg_get_triggerdef(tg.oid) like '%supabase_functions.http_request%'
 order by 2, 3, 1;


-- ── 止めるとき（預かりの判定だけを止める）──────────────────────
-- 止めると、ログインせずに出した口コミは判定されないまま一覧に出る（判定の前と同じ）。
-- 引き取られたあとは、reviews_v2 の側で今までどおり判定される。もう一度このファイルを貼れば戻る。
-- reviews_v2 の translate-review・pv_review_pending の notify-admin のトリガには触らない。
--
--   drop trigger if exists translate_review_pv_review_pending on public.pv_review_pending;
