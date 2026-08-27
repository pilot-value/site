-- ════════════════════════════════════════════════════════════════
-- 【1／3】確認 — 誰が対象かを見る（読むだけ。1文字も書き換えない）
--
-- 「給与を出していないのに REAL PAY が開いている人」を投稿前へ戻す作業の1枚目。
-- 3枚に分かれている（オーナーが1枚ずつ貼れるように）:
--     db/repair-orphan-unlock-1.sql  ← いまここ（確認・読むだけ）
--     db/repair-orphan-unlock-2.sql     戻す
--     db/repair-orphan-unlock-3.sql     検算
--
-- 2026-08-27、オーナーから「給与を提出していないのに REAL PAY が見えている」
-- という報告。本番を全件読んで調べた結果、**門（pv_pay_rows）は正しかった**。
-- 開くのは profiles.access_until が未来のときだけで、口コミでも招待でも
-- 管理者でも開かない。
--
-- 原因はデータのズレだった。過去に SQL Editor で pay_reports の行だけを
-- 手で消し、profiles 側を戻していなかった人が4人いた。profiles には
-- 「1件出した」という記録（pay_report_count / access_until / badge /
-- pay_day_of_month）が残ったままなので、行が無いのに鍵だけ開いている。
--
-- 正しい消し方は db/cleanup-test-payslip-row.sql（1人ぶん・②が profiles も戻す）。
-- この3枚は**そのお掃除を、対象を総当たりで見つける形に一般化したもの**。
--
-- ★アカウントは消さない。auth.users には触れない。
-- ★pay_reports も pay_reports_pending も1行も消さない（もう行は無い）。
-- ★この3枚に uuid もメールアドレスも書かない
--   （このリポジトリは PUBLIC。commit したものは後から消しても履歴に残る）。
--
-- 実行: Supabase → SQL Editor に全部貼って RUN
-- ════════════════════════════════════════════════════════════════

-- proof_hash = sha256(uid::text || '::pv_pay::' || 航空会社コード)
--            （一覧にない会社は '::pv_pay::other::' || lower(自由入力社名)）
-- ＝ db/pay-reports.sql の submit_pay_report / my_pay_reports と同じ式。
-- uid も会社コードも有限なので、全員×全社を作って突き合わせれば逆引きできる。
--
-- ★金額は1つも出さない。誰が対象かが分かればいいので。
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
),
owner_of as (          -- いま実在する pay_reports の行を持っている人
  select distinct c.uid
    from public.pay_reports r
    join cand c on c.h = r.proof_hash
)
select regexp_replace(u.email, '(.).*(@.*)', '\1***\2') as ぼかしアドレス,
       p.pay_report_count                               as 出したことになっている件数,
       p.access_until                                   as 解放期限,
       p.badge,
       p.pay_day_of_month                               as 給料日,
       p.last_pay_report_at                             as 最後に出した日時
  from public.profiles p
  join auth.users u on u.id = p.id
 where p.id not in (select uid from owner_of)          -- 行を1つも持っていないのに
   and (   p.pay_report_count   > 0                    -- 痕跡が残っている
        or p.access_until       is not null
        or p.last_pay_report_at is not null
        or p.pay_day_of_month   is not null
        or p.last_pay_period_ym is not null
        or p.pay_streak_months  > 0 )
 order by p.access_until desc nulls last;

/* 読み方：
     ・**4行**出るはず（2026-08-27 に本番を読んで確認した数）。
       4行なら 2／3 へ進む。
     ・4行でなければ止める。2／3 は「ちょうど4行」でなければ
       1文字も書き換えずにエラーで巻き戻るので、勝手に壊れることはない。
     ・0行なら何もしなくてよい（もう直っている）。 */
