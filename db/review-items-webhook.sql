-- ════════════════════════════════════════════════════════════════
-- PILOT VALUE — db/review-items-webhook.sql
--
-- 口コミの本文が書き足されたら、Edge Function translate-review をもう一度呼ぶ Database Webhook を **1本** 作る（2026-11-20）。
-- 口コミを1項目ずつ聞く板（db/review-items.sql の submit_review_item）は、同じ口コミに項目を1つずつ書き足す。
-- 今の translate-review の Webhook は INSERT だけなので、2項目目から先は訳されず、AI の判定（保留）も通らない。
-- これを貼った時点から、項目を足すたびに：訳し直す（足すときに訳を消してある）・判定し直す（本文の指紋が変わる）。
--
-- ⚠️ 貼るのは db/review-items.sql の後。
--
-- やり方は db/review-judge-webhook.sql と同じ ── 本番で動いている reviews_v2 の translate-review の INSERT の Webhook を
-- 「ひな型」として読み取り、名前とイベントだけを差し替えた1本を作る。呼び先・URL・認証ヘッダ・待ち時間はひな型のまま
-- （**キーやプロジェクト URL を打ち込む必要がない**）。
--
-- いつ呼ぶか（WHEN）: 7つの本文のどれかが変わり、かつ訳が空になったとき。
--   ・submit_review_item / submit_review_finish は本文が変わると訳を消す → 呼ばれる。
--   ・translate-review が訳を書く（translations と orig_lang だけを変える）→ 本文の列ではないので呼ばれない（輪にならない）。
--   ・運営の「載せる」（airline = airline）も呼ばれない。
--
-- ★reviews_v2 の translate-review の INSERT のトリガには触らない（読むだけ）。作る前と後で定義が1文字でも
--   違っていたら、例外を投げて全部を巻き戻す。
--
-- 使い方: Supabase → SQL Editor → New query に全文を貼って Run。冪等（既に在れば作成を飛ばす）。
-- 最後に確認の表が出る（キーは出ない）。止め方は末尾のコメント。
-- ════════════════════════════════════════════════════════════════

do $hook$
declare
  hook     constant text := 'translate_review_items_update';
  head     constant text := 'CREATE TRIGGER translate_review_items_update'
    || ' AFTER UPDATE OF culture_comment, salary_comment, benefits_comment, wlb_comment, ops_comment, training_comment, mgmt_comment'
    || ' ON public.reviews_v2 FOR EACH ROW WHEN ((new.translations IS NULL) AND ('
    || '(old.culture_comment IS DISTINCT FROM new.culture_comment) OR (old.salary_comment IS DISTINCT FROM new.salary_comment)'
    || ' OR (old.benefits_comment IS DISTINCT FROM new.benefits_comment) OR (old.wlb_comment IS DISTINCT FROM new.wlb_comment)'
    || ' OR (old.ops_comment IS DISTINCT FROM new.ops_comment) OR (old.training_comment IS DISTINCT FROM new.training_comment)'
    || ' OR (old.mgmt_comment IS DISTINCT FROM new.mgmt_comment))) ';
  tmpl_oid oid;
  tmpl     text;
  newdef   text;
  existing text;
  shown    text;
begin
  if to_regprocedure('public.submit_review_item(jsonb)') is null then
    raise exception using
      message = '1項目ずつ保存する関数（submit_review_item）がまだありません。',
      hint    = '先に db/review-items.sql の全文を SQL Editor に貼ってください。';
  end if;

  -- ── ひな型を探す（reviews_v2 に付いている translate-review の INSERT の webhook）──
  select t.oid, pg_get_triggerdef(t.oid)
    into tmpl_oid, tmpl
    from pg_trigger t
   where not t.tgisinternal
     and t.tgrelid = to_regclass('public.reviews_v2')
     and pg_get_triggerdef(t.oid) like '%supabase_functions.http_request(%'
     and pg_get_triggerdef(t.oid) like '%/functions/v1/translate-review%'
     and pg_get_triggerdef(t.oid) like '% AFTER INSERT ON %'
   order by t.tgname
   limit 1;

  if tmpl is null then
    raise exception using
      message = 'reviews_v2 に translate-review の INSERT の Webhook トリガが見つかりません。',
      hint    = 'このファイルは既存の Webhook を複製する方式です。';
  end if;

  -- ── 既にあれば飛ばす（名前ではなく「呼び先とイベント」で見る ── 2本生えると1回の書き足しで2回訳す＝課金が倍）──
  select tg.tgname into existing
    from pg_trigger tg
   where not tg.tgisinternal
     and tg.tgrelid = to_regclass('public.reviews_v2')
     and pg_get_triggerdef(tg.oid) like '%/functions/v1/translate-review%'
     and pg_get_triggerdef(tg.oid) like '% AFTER UPDATE %'
   order by tg.tgname
   limit 1;
  if existing is not null then
    raise notice '既にあります: %（public.reviews_v2 の UPDATE）。作成を飛ばしました。', existing;
    return;
  end if;

  -- ── 複製して差し替える（名前・イベント・条件）──
  newdef := regexp_replace(
    tmpl,
    '^CREATE TRIGGER (?:"(?:[^"]|"")+"|\S+) AFTER INSERT ON \S+ FOR EACH ROW ',
    head);

  if left(newdef, length(head)) is distinct from head
     or substr(newdef, length(head) + 1, 8) <> 'EXECUTE '
     or newdef not like '%/functions/v1/translate-review%' then
    shown := case when position(' EXECUTE ' in tmpl) > 0
                  then left(left(tmpl, position(' EXECUTE ' in tmpl) - 1), 200)
                  else '（読めない形）' end;
    raise exception using
      message = 'ひな型の差し替えに失敗しました。何も作っていません。',
      detail  = 'ひな型の頭: ' || shown;
  end if;

  execute newdef;

  if not exists (select 1 from pg_trigger t where t.oid = tmpl_oid)
     or pg_get_triggerdef(tmpl_oid) is distinct from tmpl then
    raise exception 'reviews_v2 の translate-review の INSERT のトリガが変わってしまいました。巻き戻します。';
  end if;

  raise notice '作成しました: % on public.reviews_v2（本文の書き足し）', hook;
end;
$hook$;


-- ── 確認（キーは表示しない）────────────────────────────────────
-- 見ること: reviews_v2 の translate-review が **2本**（INSERT と UPDATE OF …）。ほかの行は貼る前のまま。
select tg.tgname                                    as webhook,
       c.relname                                    as "table",
       case
         when pg_get_triggerdef(tg.oid) like '%/functions/v1/translate-review%'  then 'translate-review'
         when pg_get_triggerdef(tg.oid) like '%/functions/v1/notify-admin%'      then 'notify-admin'
         when pg_get_triggerdef(tg.oid) like '%/functions/v1/summarize-reviews%' then 'summarize-reviews'
         else 'その他'
       end                                          as "呼び先",
       substring(pg_get_triggerdef(tg.oid) from ' AFTER ([A-Z ]+?) (?:OF|ON) ') as "イベント",
       (regexp_match(pg_get_triggerdef(tg.oid), ', ''(\d+)''\)$'))[1]   as "待ち時間ms"
  from pg_trigger tg
  join pg_class c on c.oid = tg.tgrelid
 where not tg.tgisinternal
   and c.relname = 'reviews_v2'
   and pg_get_triggerdef(tg.oid) like '%supabase_functions.http_request%'
 order by 3, 4, 1;


-- ── 止めるとき ─────────────────────────────────────────────────
-- 止めると、板で書き足した2項目目から先は訳されず（原文で出る）、AI の判定も通らない。もう一度貼れば戻る。
--
--   drop trigger if exists translate_review_items_update on public.reviews_v2;
