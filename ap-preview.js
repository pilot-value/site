/* ════════════════════════════════════════════════════════════════
   ap-preview.js — REAL PAY の「プレビュー」に出す5行

   まだ給与を出していない人（未ログイン・登録しただけ）に見せる一覧。
   actual-pay.js は S.mode === 'preview' のときだけ、ここを読む。

   ── なぜ独立したファイルなのか ────────────────────────────────
   ★ここに置いたものは**本物の投稿と1バイトも混ざらない**。
     混ぜないことを目で確かめられるように、ファイルごと分けてある。
     actual-pay.js 側は pv_pay_rows() を**1回も投げずに**この5行を描く
     ＝ 鍵の無いブラウザへ本物の個別給与が渡る経路そのものが無い。
   ★逆に、ここに本物を1行でも写さないこと。加工しても流用しない。

   ── 金額はどこから来たか（いちばん大事）────────────────────────
   ★実在の航空会社の名前を出す（オーナー指示 2026-09-13）。
     社名の隣に数字が出る以上、**その数字を作り話にしない**。
     金額は salary-data.mjs（サイトが既に公開している年収の SSOT）の
       SALARY[code].cap.avg / fo.avg
     を、currency.js の RATES.USD（1ドル＝158.95円）で USD に直し、
     サーバと同じ有効数字2桁に丸めたもの。
     元の万円を _man に、どちらの段かを _rank に書き留めてある
     ── assert-pay-rows.mjs が salary-data.mjs を読んで突き合わせる。
     ＝ **SSOT が動いたら検査が赤くなる。**
   ★金額が読めるのは最初の2行だけ。3行目以降は annual_usd を**持たない**
     （null）。隠すのではなく、最初から入れていない。
     CSS でぼかす・ゼロ幅で隠すたぐいは1つも使わない。

   ── 「誰かが実際に出した」と読めるものを1つも置かない ──────────
   ★verified（Verified の印）も、age（投稿時期）も**持たない**。
     どちらも「実際に提出された」という事実の主張になる。
     actual-pay.js のプレビュー側も、その2列を描かない。
   ★この5行を件数として数えない。数え上げのカード（stats）はサーバの数字だけで、
     プレビューは1件も足さない。

   ── 形は本物の行と同じ ────────────────────────────────────────
   airline / pos / fleet / ten / annual_usd / paylock / work
   ＝ actual-pay.js の logoHtml・posName・fleetName・tenName・payLockHTML・
      workHTML がそのまま効く（プレビュー用の描画を別に作らない）。
   ⚠️ pay（金額の入った内訳）は持たせない。持たせると帯と％が描かれ、
      作り話の構成比を公開することになる。持つのは paylock ＝**項目名だけ**。
   ════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';
  if (!w) return;

  /* ★並びは本物と同じ意味を持たせない（本物は「新しい順」）。
       ここは金額が読める2行が先、というだけの並び。 */
  var ROWS = [
    /* 'jal' cap.avg = 2700万円（salary-data.mjs）→ 27,000,000 / 158.95 ≒ $169,865 → 2桁 */
    { airline: 'jal', pos: 'cap', fleet: 'b787', ten: 1,
      annual_usd: 170000, _man: 2700, _rank: 'cap', _p: 1, lock: false,
      paylock: ['base', 'variable', 'command', 'perdiem'],
      work: { bh: [60, 70], dd: [12, 14], off: [10, 12] } },

    /* 'etihad' cap.avg = 3400万円 → 34,000,000 / 158.95 ≒ $213,904
         ⚠️ ここを $210,000 に丸めてはいけない。画面の円は sig2(usd × 158.95) で
            作られるので、210,000 だと ¥3,300万 になり**サイトの公開値と食い違う**。
            214,000 なら 34,015,300 → 有効数字2桁で 34,000,000 ＝ ¥3,400万。
            ドル表示側は画面が2桁に丸めるので $210K のまま。 */
    { airline: 'etihad', pos: 'cap', fleet: 'b787', ten: 0,
      annual_usd: 214000, _man: 3400, _rank: 'cap', _p: 1, lock: false,
      paylock: ['base', 'variable', 'command', 'housing', 'perdiem'],
      work: { bh: [70, 80], dd: [14, 16], off: [10, 12] } },

    /* ここから下は annual_usd を持たない（null）。隠しているのではなく、
       最初から金額が入っていない。 */
    { airline: 'ana', pos: 'fo', fleet: 'b777', ten: 0,
      annual_usd: null, _p: 1, lock: true,
      paylock: ['base', 'variable', 'perdiem'],
      work: { bh: [60, 70], dd: [12, 14], off: [10, 12] } },

    { airline: 'cathay-pacific', pos: 'cap', fleet: 'a350', ten: 2,
      annual_usd: null, _p: 1, lock: true,
      paylock: ['base', 'variable', 'command', 'housing'],
      work: { bh: [70, 80], dd: [14, 16], off: [8, 10] } },

    { airline: 'singapore-airlines', pos: 'fo', fleet: 'a350', ten: 1,
      annual_usd: null, _p: 1, lock: true,
      paylock: ['base', 'variable', 'perdiem', 'housing'],
      work: { bh: [60, 70], dd: [12, 14], off: [10, 12] } }
  ];

  /* プレビューのときだけ出る言葉。
     ★見出しそのもの（「解放後の一覧イメージ」）と主 CTA（「匿名で給与を追加する」）は
       actual-pay.js の T をそのまま借りる。ここで書き直さない。
     ★「ダミーデータ」「架空データ」とは書かない。小さな「プレビュー」の札を添える。
     ★「実際に提出された」「明細確認済み」「2時間前に投稿」のような、
       事実を装う語をここに足さない。 */
  var T = {
    ja: {
      h: '給与レポート',
      tag: 'プレビュー',
      /* 狭い幅の絞り込みシートの主ボタン。★件数を入れない
           （この5行は投稿ではないので「◯件の実給与」は嘘になる）。 */
      fGo: 'プレビューを見る',
      lkA: 'ロック中',
      unT: 'あなたの1件で、他のパイロットの給与が見えます',
      unS: '給与を共有したパイロット同士で、実際の待遇を比較できます',
      msgT: '給与を1件共有すると、実際の投稿を航空会社で絞り込めます',
      msgS: 'いま出ているのはプレビューです。この一覧に実際の投稿は入っていません。',
      have: 'すでにアカウントをお持ちの方',
      signIn: 'ログイン'
    },
    en: {
      h: 'Pay reports',
      tag: 'Preview',
      fGo: 'See the preview',
      lkA: 'Locked',
      unT: 'Share one record and other pilots’ pay opens up',
      unS: 'Pilots who share their pay can compare real packages with each other',
      msgT: 'Share one record to filter real submissions by airline',
      msgS: 'This is a preview. No real submissions are included in this list.',
      have: 'Already have an account?',
      signIn: 'Sign in'
    }
  };

  w.PV_AP_PREVIEW = { rows: ROWS, t: T };
})(window);
