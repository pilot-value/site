-- ════════════════════════════════════════════════════════════════
-- 通し確認で本番に入った pay_reports の行を、投稿前の状態へ戻す
--
-- 2026-08-05、動作確認で pay-report.html を通しで試した。
-- そのとき本番の pay_reports に1行入り、profiles 側にも
-- 「連続1ヶ月・解放日・バッジ contributor」が刻まれた。
-- 動作確認のための1回なので、実データとして残さない。
-- ★金額はここに書かない。①の出力を自分の目で見て確認する。
--
-- ★アカウントは消さない。消すのは「明細を1枚出した」という事実だけ。
--   auth.users には触れない。
--
-- ────────────────────────────────────────────────────────────────
-- ★2026-08-06 の失敗から作り直した。前の版は「メールアドレスから uid を引く」
--   作りだったが、それには2つの穴があった。
--
--   穴1（実際に踏んだ）：**投稿したときのログインが、いま思っているアカウント
--        とは限らない。** 実際この行は、想定していたのとは別の口座（動作確認用）
--        から入っていた。メールを起点にすると永久に見つからない。
--   穴2：`with me as (select id from auth.users where email = '…')` が0行だと
--        `(select id from me)` は NULL になり、ハッシュも全部 NULL になって、
--        **エラーも警告も出さずに静かに0行を返す**。「消す行が無い」のか
--        「メールが違う」のか区別がつかない＝いちばん悪い失敗の仕方。
--
--   だから **メールを一切使わない形に変えた。**①で総当たりして
--   「どの行が どの uid のものか」を先に確定させ、②はその id だけを名指しする。
--   ＝このファイルに個人を特定する値を1つも書かなくて済む（PUBLIC リポジトリなので重要）。
-- ────────────────────────────────────────────────────────────────
--
-- 実行: Supabase → SQL Editor に貼って RUN（①→②→③の順に）
-- ════════════════════════════════════════════════════════════════


-- ── ① どの行が誰のものかを、総当たりで確定する（読むだけ）────────
-- proof_hash = sha256(uid::text || '::pv_pay::' || 航空会社コード)
--            （一覧にない会社は '::pv_pay::other::' || lower(自由入力社名)）
-- ＝ db/pay-reports.sql の submit_pay_report(395-399) / my_pay_reports(614-628) と同じ式。
-- uid も会社コードも有限なので、全員×全社を作って突き合わせれば逆引きできる。
-- （21人 × 111社 = 2,331通り。一瞬で終わる）
--
-- ★金額（annual_total_orig）は出さない。誰のどの行かが分かればいいので。
with cand as (
  select u.id as uid,
         encode(extensions.digest(u.id::text || '::pv_pay::' || a.code, 'sha256'), 'hex') as h
    from auth.users u
   cross join public.pv_airlines a
  union all
  select u.id,
         encode(extensions.digest(u.id::text || '::pv_pay::other::' || o.nm, 'sha256'), 'hex')
    from auth.users u
   cross join (select distinct lower(airline_other) as nm
                 from public.pay_reports
                where airline = 'other' and airline_other is not null) o
)
select r.id                                             as レポートid,
       r.airline, r.period_year, r.period_month, r.created_at,
       c.uid                                            as 作成者uid,
       regexp_replace(u2.email, '(.).*(@.*)', '\1***\2') as 作成者のぼかしアドレス
  from public.pay_reports r
  left join cand c        on c.h   = r.proof_hash
  left join auth.users u2 on u2.id = c.uid
 order by r.created_at;
--
-- 読み方：
--   ・消したい行が **1行だけ** 出ることを確認する
--   ・`作成者uid` が null → 21人×111社のどれとも一致しない＝ハッシュの材料が
--     想定と違う。そこで止めて材料を突き合わせる（②へ進まない）
--   ・`レポートid` と `作成者uid` を写して②の先頭に貼る


-- ── ② 消す＋profiles を投稿前へ戻す（まとめて成功か、まとめて何もしないか）──
-- ★①の出力から2つの uuid を貼る。ここに実物を書いたまま保存しない
--   （このリポジトリは PUBLIC。commit → push したものは後から消しても履歴に残る）。
do $$
declare
  v_report uuid := '00000000-0000-0000-0000-000000000000';  -- ①の レポートid
  v_uid    uuid := '00000000-0000-0000-0000-000000000000';  -- ①の 作成者uid
  v_n      int;
begin
  if v_report = '00000000-0000-0000-0000-000000000000'::uuid
     or v_uid = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception '①の出力から uuid を2つ貼ること。まだ既定値のまま';
  end if;

  delete from public.pay_reports where id = v_report;
  get diagnostics v_n = row_count;
  -- ちょうど1行でなければ全部なかったことにする（do ブロックごと巻き戻る）
  if v_n <> 1 then
    raise exception 'pay_reports が1行のはずが % 行だった。何もせずに戻した', v_n;
  end if;

  -- submit_pay_report が書いた列を、投稿前の既定値へ戻す
  -- （db/pay-reports.sql の 526-545 と 202-227 の default を突き合わせた）
  update public.profiles set
    last_pay_report_at = null,
    pay_report_count   = 0,
    pay_streak_months  = 0,
    last_pay_period_ym = null,
    pay_reports_day    = null,   -- 1日あたりの投稿数カウンタ
    pay_reports_today  = 0,
    -- ★解放を取り上げる。access_until を書くのは submit_pay_report だけ
    --   （db/*.sql を grep して確認済み。口コミ側は書いていない）
    access_until       = null,
    -- ★ここが今回いちばん忘れやすい。給料日は「初回の提出日」からしか
    --   入らない列なので、残すと**消したはずのレポートから学習した給料日**で
    --   毎月のリマインドが飛ぶ。必ず null に戻す。
    pay_day_of_month   = null,
    -- バッジは contributor が付いただけ（verified 以上は検証でしか付かない）
    badge       = 'none',
    badge_state = 'none'
  where id = v_uid;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'profiles が1行のはずが % 行だった。何もせずに戻した', v_n;
  end if;

  raise notice '消した: pay_reports 1行 / profiles を投稿前へ戻した';
end $$;


-- ── ③ 戻ったことを2つの数字で確認 ──────────────────────────────
-- ★uid を書かなくていい形にしてある（誰かに痕跡が残っていれば数が増える）
select
  (select count(*) from public.pay_reports) as レポート総数,
  (select count(*) from public.profiles
    where pay_report_count > 0 or pay_streak_months > 0
       or access_until is not null or pay_day_of_month is not null) as 痕跡が残っている人数;
-- → 両方 0 なら完了。
--   「レポート総数 0」が正しいのは、実ユーザーの投稿がまだ無い時点だけ。
--   本番に実データが入ったあとにこのファイルを使うときは、①で対象を1行に
--   絞ったうえで、ここは「実データの件数」と読み替えること。


-- ── ④ 読み取り回数のカウンタ ────────────────────────────────
-- parse-payslip の1日あたり上限は HMAC で持っているので名指しできない。
-- 30日で自然に落ちる。今すぐ掃除したいときだけ：
-- select public.pv_parse_quota_sweep();
