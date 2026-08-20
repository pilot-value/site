/* ════════════════════════════════════════════════════════════════
   pv-referral.js — 「1人だけ仲間を誘うと、自分の比較が正確になる」

   日英で1本。<html lang> を見て文言を切り替える＝2ファイルに散らさない。

   ── これはシェアボタンではない ──────────────────────────────
   給与レポートは、同じ会社・職位・機材・年で5人そろわないと比較を出さない。
   5人未満の人には灰色の一文が出て、そこで終わっていた。行き止まりだった。
   ここを「あと2人で、より詳しい比較 → パイロット仲間を1人招待」に変える。
   誘う理由は報酬ではなく、自分のデータが良くなることだけ。
   「PILOT VALUE を広めてください」とは1文字も書かない。

   ── 文言を支えている制約（これを知らずに文を書き換えないこと）──
   ★誰でもいいから招待しても、自分の区分は動かない。動くのは
     同じ会社×職位×機材×年に記録した人だけ。だから副文は必ず
     「同じ会社・職位・機種・年で記録した人が」と書く。
     「誰か1人招待すれば埋まります」とは書かない（嘘になる）。
   ★送る文面（T.msg）は、このサービスを外から見る唯一の入口。
     だから機能の説明ではなく VISION.md の使命を書く（情報の非対称性を
     なくす／本人の一次データだけで作る／職業そのものの価値を上げる）。
     「便利なサイトがある」だけの文面に戻さない。
     文面の変種は置かない。選択肢を増やしても招待は増えず、
     勤務先名が文面に入る道が生えるだけ（2026-08-19 に3つ消した）。

   ── 置き場所は4つ。うち1つだけが「常設」──────────────────
   文脈カード（条件がそろったときだけ出る）:
     ・マイレポートの「機会」節   ・給与を出した直後のレポート内
   常設カード（ログインしていれば必ず出る）:
     ・マイページ（mountInvite）
   招待された側:
     ・トップページの着地の1枚（mountStrip）
   ★2026-08-19 に常設カードを足した。文脈カードは gap の状態と回数制限に
     縛られていて、給与を1件も出していない人には1つも出ない＝「招待したい」と
     思った人が行ける場所がサイトに無かった（オーナーが本番で気づいた）。
     常設カードを消すと入口がゼロに戻る。

   ── 出さないもの ────────────────────────────────────────────
   ・生の人数。サーバ（my_cohort_gap）が返すのは状態を表す言葉で、
     整数は n=3・4 のときの「2」「1」しか外へ出ない。n≦2 では数字がゼロ個。
   ・自分の給与額。送る文面にもURLにも入れない。
   ・招待した人／された人の名前。着地の帯は既定で「あるパイロットから」。
   ・招待した人数・成立数。DB と my_referral_code() は持っているが、
     画面には出さない（ポイントやランキングに地続きなので V1 では見せない）。
   ・「あなたが招待した人のおかげで増えました」。招待された人の投稿と
     pay_reports の行を結ぶ紐付けをそもそも作っていないので、
     これは文言の好みではなく構造上言えない。

   ── 待遇モーダル（pv-conditions.js）とぶつからない理由 ──────
   ★このファイルは position:fixed も role="dialog" も aria-modal も
     body.style.overflow も1つも書かない。assert-referral.mjs がソースを
     grep して、あとから誰かが本物のモーダルにするのを禁じている
     （同じ瞬間に2枚の覆いが出ると、どちらも閉じられなくなる）。

     着地の1枚（mountStrip）は画面の中央に出て見た目はモーダルだが、
     中身は body に absolute で置いた 100vh の箱でしかない。だから
       ・スクロールを止めない＝下へ動かせば必ず抜けられる
       ・ヒーローと一緒に上へ流れて消える
       ・nav（z-index:200 の fixed）は覆わない
     ＝「閉じられなくなる」が起こらない。さらに mountStrip は他の覆いが
     開いていたら出ない（occluded）。カードの側（mountCohort /
     mountAfterReport）は今までどおり決められた箱の中に描くだけ。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  /* ── 運び手 ──────────────────────────────────────────────────
     ★?ref= は URL では運べない。クエリを捨てる場所が4つある：
       pay-login.js の CALLBACK（クエリ無しの定数）／login.html の既定の行き先／
       lang-toggle.js の location.replace()／pv-session.js の期限切れリダイレクト。
     だから localStorage に写す。書くのはこの IIFE の中＝何かが遷移する前。
     ★pv-session.js の wipe() は sb-* と明示キーだけを消すので pv_ref は残る
       （接頭辞一括ではない）。除外指定は要らない。 */
  var K_REF = 'pv_ref';        // {"c":"XXXXXXXX","ts":<ms>}
  var K_CAP = 'pv_ref_cap';    // {"n":..,"last":..,"off":<ms>,"dismiss":..}
  var K_STRIP = 'pv_ref_strip';

  /* 30日は pay-report.html の CLAIM_MAX_AGE と claim_pending_report の
     サーバ側30日に合わせる＝ゲストの預かりと招待が同時に切れる。 */
  var TTL_MS  = 30 * 24 * 60 * 60 * 1000;
  var REST_MS = 30 * 24 * 60 * 60 * 1000;   // 出しすぎたあと休む長さ
  var GAP_MS  =  7 * 24 * 60 * 60 * 1000;   // 次に出すまで空ける長さ

  /* コードの字種は db/referrals.sql と同じ（0 1 I L O U を使わない）。
     ★片方だけ変えると、正しいコードを画面が弾く。 */
  var CODE_RE = /^[2-9A-HJ-NP-Z]{8}$/;

  var HOME = (L === 'en') ? 'https://pilot-value.com/en/' : 'https://pilot-value.com/';

  var LS = {
    get: function (k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { w.localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { w.localStorage.removeItem(k); } catch (e) {} }
  };

  /* ── 計測 ────────────────────────────────────────────────────
     GA4 の gtag だけ。DB のテーブルは作らない（pv-conditions.js と同じ）。
     ★金額・会社名・会社コード・メール・自由記述・招待相手の識別子は1つも送らない。
       remaining は 2 / 1 / 0 しか取らない（few は必ず 0）＝GA4 にも生の n は渡らない。
       pv-conditions.js が airline_code を送っているのとは意図的に変える。
       「この人は招待した」＋「この人は X 社」は、片方ずつより特定に近づく。 */
  function track(name, params) {
    try { if (typeof w.gtag === 'function') w.gtag('event', name, params || {}); } catch (e) {}
  }

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* 切れ目の配列 → 折り返しが切れ目でしか起きない HTML。
     日本語は行末でどこでも折り返せるので、1行の文字列で書くと
     「…数字で出ま／す」のように語の途中で切れる（pv-conditions.js と同じ作法）。 */
  var lines = function (parts) {
    return [].concat(parts).map(function (t) {
      return '<span class="pvr-nb">' + esc(t) + '</span>';
    }).join(L === 'en' ? ' ' : '');
  };

  // ── 文言 ──────────────────────────────────────────────────────
  var T = {
    ja: {
      eyebrow: '比較をもっと正確にする',
      /* ★順位の言い方をしない。「あなたの位置が数字で出ます」は
         ランキングに聞こえるので 2026-08-19 にやめた（オーナー指摘）。
         増えるのは順位ではなく、比べる相手が公開情報から本人の記録に変わること。 */
      nearH: function (k) { return 'あと' + k + '人で、より詳しい比較'; },
      nearS: function (k) {
        return ['同じ会社・職位・機種・年で記録した人が',
                'あと' + k + '人そろうと、実際に記録された数字で比べられます。'];
      },
      fewH: 'この区分はまだ記録が少ないです',
      fewS: ['同じ会社・職位・機種・年で記録した人が5人そろうと、',
             '実際に記録された数字で比べられます。'],
      cta: 'パイロット仲間を1人招待',
      copy: 'リンクをコピー',
      copied: 'コピーしました',
      privacy: ['招待した相手が誰かは、こちらでは分かりません。',
                'あなたの給与も相手には見えません。'],
      gained: function (k) { return '前回あなたが記録してから、この区分に' + k + '件増えました。'; },
      crossed: 'この区分に5人そろいました。詳細な比較が出ています。',
      close: '閉じる',
      /* ★送る文面。オーナーが書いた原文で、勝手に言い換えない。
         引数を取らない＝勤務先名を文面へ入れる経路が構造上ない。 */
      msg: function () {
        return ['PILOT VALUEは、パイロット自身の匿名の実データで給与・待遇・働き方を透明にし、',
                '最終的にパイロットという職業の価値そのものを高めることを目指しています。',
                '完全匿名制、パイロットのみ招待しています。',
                'Know your value. Raise our value.'];
      },
      stripE: 'Invitation',
      stripH: '匿名のパイロットから招待されています',
      /* ★オーナーが書いた原文。VISION そのものなので言い換えない。
         配列なのは lines() が1要素ずつ .pvr-nb で包む＝この位置で折り返させるため。
         広い画面ではオーナーが書いた2行に組まれ、狭い画面ではここで足した
         切れ目（「…価値を／高めることを」）で折れる。1つの塊にすると
         「目指し／ています。」と動詞の途中で切れる（実測）。 */
      stripV: ['PILOT VALUEは、パイロットが自分の価値を正しく知り、',
               '最終的にパイロットという職業の価値を',
               '高めることを目指しています。'],
      stripS: '招待した人が誰かは表示されません。あなたが記録した内容も、その人には見えません。',
      stripGo: 'サイトを見る',
      /* ★マイページの常設入口。人数も順位も1文字も入れない
         （ここは区分の話をしない＝gap を引かないカード）。 */
      invE: '招待',
      invH: 'パイロットの仲間を招待する',
      invS: ['記録するパイロットが増えるほど、給与・待遇の比較は正確になります。',
             '招待できるのはパイロットだけです。'],
      invGo: '招待する'
    },
    en: {
      eyebrow: 'Improve your comparison',
      /* ★日本語と同じ。順位の言い方（your position appears as a number）はやめた。 */
      nearH: function (k) {
        return (k === 1) ? 'One more pilot for a more detailed comparison'
                         : k + ' more pilots for a more detailed comparison';
      },
      nearS: function (k) {
        return ['When ' + k + ' more pilot' + (k === 1 ? '' : 's') + ' on the same airline, rank, fleet',
                'and year record their pay, you can compare against real recorded figures.'];
      },
      fewH: 'This segment has very few records yet',
      fewS: ['When five pilots on the same airline, rank, fleet and year record their pay,',
             'you can compare against real recorded figures.'],
      cta: 'Invite one pilot',
      copy: 'Copy link',
      copied: 'Copied',
      privacy: ['We never tell you who accepted an invitation,',
                'and they never see your pay.'],
      gained: function (k) {
        return k + ' new record' + (k === 1 ? '' : 's') +
               ' have been added to this segment since you last recorded yours.';
      },
      crossed: 'This segment has reached five pilots. Your detailed comparison is now showing.',
      close: 'Close',
      /* ★日本語版と同じことを英語で言うだけ。タグラインは訳さない。
         「完全匿名」はトップページと同じ Fully anonymous に揃える。 */
      msg: function () {
        return ['PILOT VALUE makes pilot pay, benefits and working conditions transparent,',
                "built only from pilots' own anonymous records, and ultimately raises the value",
                'of the profession itself.',
                'Fully anonymous, and we invite pilots only.',
                'Know your value. Raise our value.'];
      },
      stripE: 'Invitation',
      stripH: 'An anonymous pilot invited you',
      stripV: ['PILOT VALUE helps pilots know',
               'what they are really worth \u2014',
               'and raise the value of the profession itself.'],
      stripS: 'We do not show who invited you, and they never see what you record.',
      stripGo: 'Enter the site',
      /* ★日本語と同じ。件数も順位も言わない。 */
      invE: 'Invite',
      invH: 'Invite one pilot',
      invS: ['The more pilots record their pay, the more accurate every comparison becomes.',
             'We invite pilots only.'],
      invGo: 'Invite'
    }
  }[L];

  /* ★招待された人が受け取った文面の最後の1行（T.msg の末尾）。
     着地の1枚に同じ行を置くと、送られた紙とここが地続きになる。
     日英で1文字も変えないので、言葉の表ではなく定数で持つ（訳す対象ではない）。 */
  var TAGLINE = 'Know your value. Raise our value.';

  /* ── 見た目 ──────────────────────────────────────────────────
     2つの姿を1つのモジュールで持つ。
       variant:'card'  … index / my-value。pv-tokens.css の --pv-* を使う。
                         ダークは [data-theme="dark"] から自動で追随する。
       variant:'bench' … pay-report.html。あちらの .res / .bench は
                         [data-theme] と無関係に暗い色を直書きしているので、
                         トークンを使うと明るいページの中に白いカードが出てしまう。
     ★prefers-color-scheme は1行も書かない（このリポジトリに1つも無い。
       テーマは [data-theme] 属性だけで決まる）。
     ★動くのは transform と opacity だけ。transition-all は使わない。 */
  var CSS = [
    '.pvr-nb{display:inline-block}',
    '.pvr{border-radius:14px;padding:18px 20px;margin-top:18px;',
      'opacity:0;transform:translateY(6px);',
      'transition:opacity .38s cubic-bezier(.16,1,.3,1),transform .38s cubic-bezier(.16,1,.3,1)}',
    '.pvr.is-in{opacity:1;transform:none}',
    '@media (prefers-reduced-motion:reduce){.pvr{opacity:1;transform:none;transition:none}}',
    '.pvr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}',
    '.pvr-eyebrow{font-size:.7rem;font-weight:800;letter-spacing:.06em}',
    '.pvr-h{font-size:1.02rem;font-weight:800;letter-spacing:-.01em;line-height:1.5;margin-top:6px}',
    '.pvr-s{font-size:.79rem;line-height:1.75;margin-top:8px}',
    '.pvr-note{font-size:.72rem;line-height:1.7;margin-top:14px}',
    /* 「良くなりました」の1行。これは勧誘ではなく、稼いだ情報なので回数制限の外 */
    '.pvr-win{font-size:.79rem;font-weight:700;line-height:1.7;padding:10px 12px;border-radius:10px;',
      'margin-bottom:14px}',
    /* 5人そろった人にはこの1行しか出さない（招待は頼まない）。
       そのとき下の余白だけが残って、箱の中が空っぽに見える。 */
    '.pvr-win:last-child{margin-bottom:0}',
    /* ★チップ（送る文面の選択）はここに在った。2026-08-19 に消した。
       文面は1つだけ＝勤務先名が入る道が無い。戻さない。 */
    '.pvr-btns{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}',
    '.pvr-btn{min-height:44px;padding:12px 20px;border-radius:999px;font-size:.83rem;font-weight:800;',
      'cursor:pointer;border:0;transition:opacity .2s,transform .2s,box-shadow .2s}',
    '.pvr-btn:active{transform:scale(.97)}',
    '.pvr-btn2{min-height:44px;padding:12px 18px;border-radius:999px;font-size:.83rem;font-weight:700;',
      'cursor:pointer;background:none;transition:background .2s,border-color .2s,color .2s,transform .2s}',
    '.pvr-btn2:active{transform:scale(.97)}',
    '.pvr-x{width:34px;height:34px;flex:none;display:grid;place-items:center;border:0;background:none;',
      'font-size:1.1rem;line-height:1;cursor:pointer;border-radius:10px;',
      'transition:color .2s,background .2s}',
    /* ── カード姿（index / my-value）──────────────────────── */
    '.pvr[data-v="card"]{background:var(--pv-surface-2,#fbfcfe);border:1px solid var(--pv-line,#e3e9f0);',
      'box-shadow:var(--pv-shadow,0 1px 2px rgba(15,23,42,.04))}',
    '.pvr[data-v="card"] .pvr-eyebrow{color:var(--pv-orange-ink,#c2410c)}',
    '.pvr[data-v="card"] .pvr-h{color:var(--pv-ink,#0f172a)}',
    '.pvr[data-v="card"] .pvr-s{color:var(--pv-ink-2,#475569)}',
    '.pvr[data-v="card"] .pvr-note{color:var(--pv-ink-3,#64748b)}',
    '.pvr[data-v="card"] .pvr-win{color:var(--pv-green-ink,#047857);',
      'background:var(--pv-green-soft,rgba(5,150,105,.09));',
      'border:1px solid var(--pv-green-line,rgba(5,150,105,.24))}',
    '.pvr[data-v="card"] .pvr-btn{color:#fff;background:var(--pv-orange,#f97316);',
      'box-shadow:0 6px 18px -10px rgba(249,115,22,.75)}',
    '.pvr[data-v="card"] .pvr-btn:hover{opacity:.92;box-shadow:0 10px 24px -12px rgba(249,115,22,.85)}',
    '.pvr[data-v="card"] .pvr-btn:focus-visible{outline:2px solid var(--pv-orange,#f97316);outline-offset:3px}',
    '.pvr[data-v="card"] .pvr-btn2{color:var(--pv-ink-2,#475569);border:1px solid var(--pv-line,#e3e9f0)}',
    '.pvr[data-v="card"] .pvr-btn2:hover{color:var(--pv-ink,#0f172a);border-color:var(--pv-orange,#f97316)}',
    '.pvr[data-v="card"] .pvr-btn2:focus-visible{outline:2px solid var(--pv-orange,#f97316);outline-offset:2px}',
    '.pvr[data-v="card"] .pvr-x{color:var(--pv-ink-3,#64748b)}',
    '.pvr[data-v="card"] .pvr-x:hover{color:var(--pv-ink,#0f172a);background:var(--pv-line-soft,#eef2f7)}',
    '.pvr[data-v="card"] .pvr-x:focus-visible{outline:2px solid var(--pv-orange,#f97316);outline-offset:2px}',
    /* ── 結果カード姿（pay-report）────────────────────────── */
    '.pvr[data-v="bench"]{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.08)}',
    '.pvr[data-v="bench"] .pvr-eyebrow{color:#34d399}',
    '.pvr[data-v="bench"] .pvr-h{color:#e8edf2}',
    '.pvr[data-v="bench"] .pvr-s{color:#9ca3af}',
    '.pvr[data-v="bench"] .pvr-note{color:#6b7d93}',
    '.pvr[data-v="bench"] .pvr-win{color:#34d399;background:rgba(52,211,153,.10);',
      'border:1px solid rgba(52,211,153,.28)}',
    '.pvr[data-v="bench"] .pvr-btn{color:#0a1628;background:#f5c842;',
      'box-shadow:0 6px 18px -10px rgba(245,200,66,.8)}',
    '.pvr[data-v="bench"] .pvr-btn:hover{opacity:.92}',
    '.pvr[data-v="bench"] .pvr-btn:focus-visible{outline:2px solid rgba(245,200,66,.7);outline-offset:3px}',
    '.pvr[data-v="bench"] .pvr-btn2{color:#a8b3c2;border:1px solid rgba(255,255,255,.16)}',
    '.pvr[data-v="bench"] .pvr-btn2:hover{color:#e8edf2;border-color:rgba(245,200,66,.5)}',
    '.pvr[data-v="bench"] .pvr-btn2:focus-visible{outline:2px solid rgba(245,200,66,.7);outline-offset:2px}',
    '.pvr[data-v="bench"] .pvr-x{color:#6b7d93}',
    '.pvr[data-v="bench"] .pvr-x:hover{color:#e8edf2;background:rgba(255,255,255,.06)}',
    '.pvr[data-v="bench"] .pvr-x:focus-visible{outline:2px solid rgba(245,200,66,.7);outline-offset:2px}',
    /* ★結果カードは明るい方の姿も持っている。pay-report.html:563-572 が
       [data-theme="light"] で .res / .bench を白基調に塗り替えるので、上の
       暗い色だけだと明るいテーマで文字がほとんど読めない（実際にそうなった）。
       色はあちらの明るい方の値をそのまま使う＝金は #a97e00、緑は #0d8a63。 */
    '[data-theme="light"] .pvr[data-v="bench"]{background:rgba(0,0,0,.02);border-color:rgba(0,0,0,.08)}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-eyebrow{color:#0d8a63}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-h{color:#0f172a}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-s{color:#475569}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-note{color:#64748b}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-win{color:#0d8a63;background:rgba(13,138,99,.08);',
      'border-color:rgba(13,138,99,.28)}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-btn{color:#fff;background:#a97e00;',
      'box-shadow:0 6px 18px -10px rgba(169,126,0,.7)}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-btn:focus-visible{outline-color:rgba(200,149,0,.85)}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-btn2{color:#475569;border-color:rgba(0,0,0,.15)}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-btn2:hover{color:#0f172a;border-color:rgba(200,149,0,.5)}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-btn2:focus-visible{outline-color:rgba(200,149,0,.85)}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-x{color:#64748b}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-x:hover{color:#0f172a;background:rgba(0,0,0,.05)}',
    '[data-theme="light"] .pvr[data-v="bench"] .pvr-x:focus-visible{outline-color:rgba(200,149,0,.85)}',
    /* ── 常設の入口姿（profile ＝ マイページ）──────────────
       ★profile.html は pv-tokens.css を読んでいない（読むのは pay-viz.css だけ）。
         data-v="card" は var(--pv-surface-2,#fbfcfe) のように明るい色を
         fallback に持つので、そのまま使うと暗いマイページに白いカードが出る。
         だから3つ目の姿を持つ。pay-report で踏んだのと同じ罠。
       ★箱を描かない。.glass の中に居るので、上に1本線を引いて
         .info-row の区切りと同じ見え方にするだけ。左右の padding も 0 にして
         登録情報の行と縦を揃える。
       ★暗い方と明るい方を両方書く。暗い色だけ書くと明るいテーマで読めない
         （pay-report で実際にそうなった）。値は profile.html 自身から採る。 */
    '.pvr[data-v="profile"]{border-radius:0;padding:18px 0 2px;margin-top:2px;',
      'border-top:1px solid rgba(255,255,255,.06)}',
    /* ★着地の1枚（.pvr-strip）が .pvr-eyebrow を**スコープ無しで**上書きしていて、
       中央寄せ＋両脇に金の細線が付く。あれは招待状の飾りで、ここでは
       見出しが左揃えなのに小見出しだけ真ん中に浮く。登録情報の
       .info-label と同じ「左端の小さな見出し」に戻す（値もそこから採る）。 */
    '.pvr[data-v="profile"] .pvr-eyebrow{color:#f5c842;justify-content:flex-start;',
      'font-size:.72rem;letter-spacing:.08em;padding-left:0}',
    '.pvr[data-v="profile"] .pvr-eyebrow::before,',
      '.pvr[data-v="profile"] .pvr-eyebrow::after{display:none}',
    '.pvr[data-v="profile"] .pvr-h{color:#e8edf2}',
    '.pvr[data-v="profile"] .pvr-s{color:#9ca3af}',
    '.pvr[data-v="profile"] .pvr-note{color:#6b7d93}',
    /* ボタンは GIVE & GET の .pv-cta-fill / .pv-cta-ghost と同じ見た目にする。
       ★あちらのクラスを直接使わない。モジュールがページの CSS に寄りかかると、
         profile.html を直した日にここが黙って崩れる。値だけ写す。 */
    '.pvr[data-v="profile"] .pvr-btn{color:#000;background:#f5c842;border-radius:9px;',
      'box-shadow:0 4px 14px rgba(245,200,66,.18)}',
    '.pvr[data-v="profile"] .pvr-btn:hover{background:#f7d25e;',
      'box-shadow:0 6px 20px rgba(245,200,66,.28)}',
    '.pvr[data-v="profile"] .pvr-btn:focus-visible{outline:2px solid rgba(245,200,66,.65);',
      'outline-offset:3px}',
    '.pvr[data-v="profile"] .pvr-btn2{color:#f5c842;border:1px solid rgba(245,200,66,.35);',
      'border-radius:9px}',
    '.pvr[data-v="profile"] .pvr-btn2:hover{background:rgba(245,200,66,.1);',
      'border-color:rgba(245,200,66,.6)}',
    '.pvr[data-v="profile"] .pvr-btn2:focus-visible{outline:2px solid rgba(245,200,66,.65);',
      'outline-offset:3px}',
    '[data-theme="light"] .pvr[data-v="profile"]{border-top-color:rgba(0,0,0,.06)}',
    '[data-theme="light"] .pvr[data-v="profile"] .pvr-eyebrow{color:#a07200}',
    '[data-theme="light"] .pvr[data-v="profile"] .pvr-h{color:#0f172a}',
    '[data-theme="light"] .pvr[data-v="profile"] .pvr-s{color:#475569}',
    '[data-theme="light"] .pvr[data-v="profile"] .pvr-note{color:#64748b}',
    '[data-theme="light"] .pvr[data-v="profile"] .pvr-btn{box-shadow:0 4px 14px rgba(161,114,0,.22)}',
    '[data-theme="light"] .pvr[data-v="profile"] .pvr-btn2{color:#a07200;',
      'border-color:rgba(161,114,0,.35)}',
    '[data-theme="light"] .pvr[data-v="profile"] .pvr-btn2:hover{background:rgba(161,114,0,.08);',
      'border-color:rgba(161,114,0,.55)}',
    /* ── 着地（トップページ）──────────────────────────────
       ★nav の top も #hero-section の height:100vh も触らない。どちらも
         触ると CLS が動く（lp.css:857 に 123px のマーキーで 0.0996 を出した記録がある）。
         body の最後に置いて absolute で浮かせる＝フローの高さを1px も占めない。

       ★2026-08-19、上端の細い帯から画面中央のカードに変えた（オーナー指示
         「特別感を出す」）。招待された人がこのサービスを見る最初の1秒なので、
         お知らせではなく招待状として出す。

       ★見た目はモーダルだが、モーダルとして作っていない。
         position:fixed でも role="dialog" でもなく、body に absolute で置いた
         100vh の箱。だから
           ・スクロールを止めない＝下へ動かせば必ず抜けられる（閉じ込めが不可能）
           ・ヒーローと一緒に上へ流れて消える
           ・nav（z-index:200 の fixed）は覆わない＝ロゴも操作も生きている
         待遇モーダルと重なり得ないのは index.html が pv-conditions.js を
         読んでいないからで、この「覆いを作らない」性質はその保険。
         assert-referral.mjs がソースを grep して戻されるのを禁じている。 */
    '.pvr-strip{position:absolute;top:0;left:0;width:100%;height:100vh;z-index:150;',
      'display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;',
      'background:radial-gradient(58% 46% at 50% 44%,rgba(245,200,66,.11),transparent 72%),',
      'rgba(4,7,12,.84);',
      'backdrop-filter:blur(3px) saturate(.92);',
      'transition:opacity .5s cubic-bezier(.16,1,.3,1)}',
    '@supports (height:100svh){.pvr-strip{height:100svh}}',
    '.pvr-strip.is-in{opacity:1}',
    /* 招待状のカード。角の丸み・金の縁・多層の影はサイトの他のカードと同じ流儀。 */
    '.pvr-card{position:relative;width:min(520px,100%);padding:38px 34px 32px;',
      'border-radius:22px;text-align:center;border:1px solid rgba(245,200,66,.26);',
      'background:radial-gradient(118% 138% at 50% 0%,rgba(245,200,66,.13),transparent 58%),',
      'linear-gradient(180deg,rgba(16,21,32,.975),rgba(8,11,18,.975));',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 2px 6px -2px rgba(2,4,8,.7),',
      '0 18px 42px -22px rgba(245,200,66,.32),0 56px 96px -52px rgba(0,0,0,.95);',
      'transform:translateY(16px) scale(.984);',
      'transition:transform .55s cubic-bezier(.16,1,.3,1)}',
    '.pvr-strip.is-in .pvr-card{transform:none}',
    /* 上辺に走る金の一本線。封蝋のかわりの「開いた」合図。 */
    '.pvr-card::before{content:"";position:absolute;left:24%;right:24%;top:-1px;height:1px;',
      'background:linear-gradient(90deg,transparent,rgba(245,200,66,.9),transparent)}',
    '.pvr-eyebrow{display:flex;align-items:center;justify-content:center;gap:12px;',
      'font-size:.6rem;font-weight:800;letter-spacing:.36em;text-transform:uppercase;',
      'color:rgba(245,200,66,.8);padding-left:.36em}',
    '.pvr-eyebrow::before,.pvr-eyebrow::after{content:"";width:34px;height:1px;',
      'background:linear-gradient(90deg,transparent,rgba(245,200,66,.45),transparent)}',
    /* 見出しはヒーローと同じ金のグラデーション文字にして、続きの画面だと分からせる。 */
    '.pvr-strip-t{margin:15px 0 0;font-size:clamp(1.2rem,3.1vw,1.6rem);font-weight:900;',
      'letter-spacing:-.03em;line-height:1.42;text-wrap:balance;',
      'background:linear-gradient(180deg,#ffe9a8,#f5c842 54%,#e0952a);',
      '-webkit-background-clip:text;background-clip:text;color:transparent}',
    '.pvr-tag{margin:13px 0 0;font-size:.76rem;font-weight:700;letter-spacing:.06em;',
      'color:#d7c79a}',
    /* VISION の2行。濃さはタグライン #d7c79a と但し書き #9fb0c4 のあいだに置く
       （主役は見出しのまま）。max-width は .pvr-strip-s と同じで「折り返す位置を
       決めるための幅」であって、箱の幅ではない。日本語は1行目
       「…正しく知り、」のうしろで切れる 420px、英語は 432px。 */
    '.pvr-strip-v{margin:14px auto 0;max-width:432px;font-size:.78rem;line-height:1.85;',
      'color:#b9c6d6;text-wrap:pretty}',
    'html[lang="ja"] .pvr-strip-v{max-width:420px}',
    '.pvr-rule{margin:20px auto;width:44px;height:1px;',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)}',
    /* ★max-width は折り返す位置を決めるためのもの。英語は1行で収まる 432px、
       日本語は句点のうしろ（「…内容も、／その人には見えません。」）で切れる 352px。
       広いままだと「その人には見え／ません。」と動詞の途中で切れる。 */
    '.pvr-strip-s{margin:0 auto;max-width:432px;font-size:.74rem;line-height:1.8;color:#9fb0c4;',
      'text-wrap:pretty}',
    'html[lang="ja"] .pvr-strip-s{max-width:352px}',
    '.pvr-go{margin-top:24px;display:inline-flex;align-items:center;gap:9px;',
      'padding:12px 27px;border-radius:999px;border:1px solid rgba(245,200,66,.5);',
      'background:linear-gradient(135deg,#f5c842,#e0952a);color:#1b1305;',
      'font:inherit;font-size:.82rem;font-weight:800;cursor:pointer;',
      'box-shadow:0 10px 26px -15px rgba(245,200,66,.95);',
      'transition:transform .28s cubic-bezier(.16,1,.3,1),filter .28s cubic-bezier(.16,1,.3,1),',
      'box-shadow .28s cubic-bezier(.16,1,.3,1)}',
    '.pvr-go:hover{transform:translateY(-2px);filter:brightness(1.07);',
      'box-shadow:0 18px 34px -15px rgba(245,200,66,1)}',
    '.pvr-go:active{transform:translateY(0)}',
    '.pvr-go:focus-visible{outline:2px solid rgba(245,200,66,.9);outline-offset:3px}',
    '.pvr-strip .pvr-x{position:absolute;top:12px;right:12px;color:#7d8ea6}',
    '.pvr-strip .pvr-x:hover{color:#e8edf2;background:rgba(255,255,255,.07)}',
    '.pvr-strip .pvr-x:focus-visible{outline:2px solid rgba(245,200,66,.7);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){.pvr-strip,.pvr-strip .pvr-card{opacity:1;',
      'transform:none;transition:none}}',
    /* ★スマホでは見出しを 1.1rem まで落とす。1.2rem のままだと
       17文字の見出しが幅を1文字だけ超えて「す」1文字が2行目に落ちる（実際に落ちた）。
       いまの見出しは18文字（「匿名のパイロットから招待されています」）で、
       390px・1.1rem のとき本文幅 303px にちょうど1行で収まっている（実測）。
       ここを1文字でも伸ばすなら必ず `node shot-referral.mjs strip ja dark 390` を撮る。 */
    '@media (max-width:640px){.pvr-strip{padding:18px}',
      '.pvr-card{padding:32px 22px 26px;border-radius:19px}',
      '.pvr-strip-t{font-size:1.1rem}',
      /* ★VISION も 1文字ぶん落とす。.78rem のままだと日本語の1行目が
         328px 必要で本文幅 303px に入らず、「知り、」だけが2行目に落ちる
         （実測。英語は語の切れ目で折り返すので3行になっても読める）。 */
      '.pvr-strip-v{font-size:.7rem;line-height:1.8}',
      '.pvr-eyebrow{letter-spacing:.26em;padding-left:.26em}',
      '.pvr-eyebrow::before,.pvr-eyebrow::after{width:22px}}'
  ].join('');

  function ensureStyle() {
    if (d.getElementById('pvr-style')) return;
    var s = d.createElement('style');
    s.id = 'pvr-style';
    s.textContent = CSS;
    (d.head || d.documentElement).appendChild(s);
  }

  // ══════════════════════════════════════════════════════════════
  // 1. ?ref= を捕まえる
  // ══════════════════════════════════════════════════════════════
  function stored() {
    var raw = LS.get(K_REF);
    if (!raw) return null;
    var o = null;
    try { o = JSON.parse(raw); } catch (e) { o = null; }
    if (!o || !CODE_RE.test(String(o.c || ''))) { LS.del(K_REF); return null; }
    if (!(Number(o.ts) > 0) || (Date.now() - Number(o.ts)) > TTL_MS) { LS.del(K_REF); return null; }
    return String(o.c);
  }

  function capture() {
    var raw = '';
    try {
      raw = new URLSearchParams(w.location.search || '').get('ref') || '';
    } catch (e) {
      var m = /[?&]ref=([^&#]*)/.exec(w.location.search || '');
      raw = m ? decodeURIComponent(m[1]) : '';
    }
    var code = String(raw || '').trim().toUpperCase();
    if (!CODE_RE.test(code)) return stored();
    /* ★実在確認はしない。ここで RPC を呼ぶと「コードが実在するか」を
       誰でも試せる窓口になる（db/referrals.sql は anon に何も渡していない）。
       形さえ合っていれば預かる。でたらめなコードは、ログイン後の
       claim_referral が静かに invalid を返して終わる。 */
    LS.set(K_REF, JSON.stringify({ c: code, ts: Date.now() }));
    return code;
  }

  // ══════════════════════════════════════════════════════════════
  // 2. ログインした本人に結びつける（冪等・どこから呼んでもよい）
  // ══════════════════════════════════════════════════════════════
  var _claimed = false;
  function claim(sb) {
    if (_claimed || !sb || !sb.rpc) return Promise.resolve(null);
    var code = stored();
    if (!code) return Promise.resolve(null);
    _claimed = true;
    /* ★sb.rpc(...) が返すのは Promise ではなく then だけを持つ箱（supabase-js の作り）。
       Promise.resolve で包まないと .catch が無くて落ちる。 */
    return Promise.resolve(sb.rpc('claim_referral', { p_code: code }))
      .then(function (res) {
        var st = (res && res.data && res.data.status) || null;
        if (res && res.error) return null;              // 通信の失敗。鍵は残して次のページで再試行
        /* サーバが確定的な答えを返したら消す（pv_pay_claim と同じ作法）。
           attributed / already / self / invalid / rate_limited はどれも
           「もうこのコードで起きることは無い」を意味する。 */
        if (st) { LS.del(K_REF); track('referral_claim', { status: st }); }
        return st;
      })
      .catch(function () { _claimed = false; return null; });   // 例外では消さない
  }

  function settle(sb) {
    if (!sb || !sb.rpc) return Promise.resolve(null);
    return Promise.resolve(sb.rpc('pv_referral_settle')).then(function () { return true; })
      .catch(function () { return null; });
  }

  // ══════════════════════════════════════════════════════════════
  // 3. 出しすぎない仕組み
  // ══════════════════════════════════════════════════════════════
  function cap() {
    var o = null;
    try { o = JSON.parse(LS.get(K_CAP) || 'null'); } catch (e) { o = null; }
    if (!o || typeof o !== 'object') o = {};
    return { n: Number(o.n) || 0, last: Number(o.last) || 0,
             off: Number(o.off) || 0, dismiss: Number(o.dismiss) || 0 };
  }
  function saveCap(c) { LS.set(K_CAP, JSON.stringify(c)); }
  function rest(c) { c.off = Date.now() + REST_MS; saveCap(c); }

  /* 1つの置き場所につき1ページ1回まで。★「1回描いたら二度と描かない」に
     してはいけない。my-value.js の render() は pv-currency-change のたびに
     innerHTML を作り直す＝箱ごと新しくなる。そこで描くのをやめると、
     通貨を切り替えただけで招待の導線が消える。描き直すのは同じ1回として扱い、
     数えるのと上限を進めるのだけを1回に抑える。 */
  var _askedOn = {};
  var _countedOn = {};
  var _wonOn = {};
  var _openOn = {};
  function mayAsk(surface) {
    if (_askedOn[surface]) return true;             // 同じ場所の描き直し
    var c = cap();
    if (c.off && Date.now() < c.off) return false;
    if (c.last && (Date.now() - c.last) < GAP_MS) return false;
    return true;
  }
  /* 何かの覆い（待遇モーダルなど）が開いている間は「見えた」に数えない。
     ★このファイルは覆いを作らないが、覆われることはある。 */
  function occluded() {
    try { return !!d.querySelector('[aria-modal="true"]'); } catch (e) { return false; }
  }
  /* ★「見えた」で数える。マウントでは数えない。待遇モーダルの覆いの裏で
     出ていた回を1回に数えると、実際には一度も読まれないまま上限に達する。 */
  function counted(surface, state, remaining) {
    if (_countedOn[surface]) return;
    _countedOn[surface] = true;
    var c = cap();
    c.n += 1; c.last = Date.now();
    if (c.n >= 4) c.off = Date.now() + REST_MS;     // 4回見せて何も起きなければ休む
    saveCap(c);
    track('referral_prompt_shown',
      { surface: surface, state: state, remaining: Number(remaining) || 0 });
  }

  // ══════════════════════════════════════════════════════════════
  // 4. my_cohort_gap() — 1ページ1回だけ引く
  // ══════════════════════════════════════════════════════════════
  var _gapP = null;
  function gap(sb) {
    /* ★メモ化は必須。my-value.js の render() は pv-currency-change のたびに
       走り直す。毎回引くと「あと2人」がちらつくうえ、RPC を無駄に叩く。 */
    if (_gapP) return _gapP;
    if (!sb || !sb.rpc) return Promise.resolve(null);
    _gapP = Promise.resolve(sb.rpc('my_cohort_gap'))
      .then(function (res) { return (res && !res.error && res.data) ? res.data : null; })
      .catch(function () { return null; });
    return _gapP;
  }

  // ══════════════════════════════════════════════════════════════
  // 5. 送る
  // ══════════════════════════════════════════════════════════════
  var _codeP = null;
  function myLink(sb) {
    if (_codeP) return _codeP;
    if (!sb || !sb.rpc) return Promise.resolve(null);
    _codeP = Promise.resolve(sb.rpc('my_referral_code'))
      .then(function (res) {
        var c = (res && !res.error && res.data && res.data.code) ? String(res.data.code) : null;
        return CODE_RE.test(c || '') ? (HOME + '?ref=' + c) : null;
      })
      .catch(function () { return null; });
    return _codeP;
  }

  /* ★金額も、自分のレポートのURLも、勤務先の名前も、文面に入れない。
     入るのは招待コードだけ（8文字の乱数。ユーザーIDからは逆算できない）。
     T.msg は引数を取らないので、ここに何かを足さない限り増えようがない。
     URL の前は空行1つ。LINE / WhatsApp で本文とリンクが分かれて読める。 */
  function shareText(url) {
    return T.msg().join('\n') + '\n\n' + url;
  }

  function copyText(text) {
    if (w.navigator && w.navigator.clipboard && w.navigator.clipboard.writeText) {
      return w.navigator.clipboard.writeText(text).then(function () { return true; })
        .catch(function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try {
      var ta = d.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      d.body.appendChild(ta);
      ta.select();
      var okc = d.execCommand && d.execCommand('copy');
      d.body.removeChild(ta);
      return !!okc;
    } catch (e) { return false; }
  }

  // ══════════════════════════════════════════════════════════════
  // 6. カード本体（my-value と pay-report で同じものを描く）
  // ══════════════════════════════════════════════════════════════
  /* ── 「招待する」と「リンクをコピー」の配線 ─────────────────
     ★文脈カード（card）と常設カード（mountInvite）の両方がここを呼ぶ。
       同じ処理をもう1組持つと patch-payslip*.mjs と同じ増え方をして、
       片方だけ直した瞬間に送られる文面が2種類になる。1つに保つ。
     ★rest(cap()) は残す。マイページから招待した直後にレポート側が
       「1人招待しませんか」と言うのはおかしいので、30日休むのが正しい。 */
  function wireShare(el, sb, surface) {
    // ── 招待する ──────────────────────────────────────────────
    var go = el.querySelector('[data-pvr-go]');
    go.addEventListener('click', function () {
      track('referral_share_opened', { surface: surface });
      myLink(sb).then(function (url) {
        if (!url) return;
        var text = shareText(url);
        if (w.navigator && w.navigator.share) {
          /* キャンセル（reject）ではイベントを出さない・回数も数えない。
             「共有しようとした」を「共有した」に数えると、実績が水増しされる。 */
          w.navigator.share({ text: text }).then(function () {
            track('referral_shared', { surface: surface, method: 'web_share' });
            rest(cap());
          }).catch(function () {});
          return;
        }
        copyText(text).then(function (okc) {
          if (!okc) return;
          track('referral_shared', { surface: surface, method: 'copy' });
          rest(cap());
        });
      });
    });

    /* コピーは navigator.share がある端末でも必ず出す。
       PC のシェアシートは使いにくく、クルーの WhatsApp に貼るのは PC からのことも多い。 */
    var cp = el.querySelector('[data-pvr-copy]');
    cp.addEventListener('click', function () {
      track('referral_share_opened', { surface: surface });
      myLink(sb).then(function (url) {
        if (!url) return;
        copyText(shareText(url)).then(function (okc) {
          if (!okc) return;
          var was = cp.textContent;
          cp.textContent = T.copied;                       // ★textContent。innerHTML は使わない
          setTimeout(function () { cp.textContent = was; }, 2400);
          track('referral_shared', { surface: surface, method: 'copy' });
          rest(cap());
        });
      });
    });
  }

  function card(el, sb, g, opts) {
    var variant = (opts && opts.variant) === 'bench' ? 'bench' : 'card';
    var surface = (opts && opts.surface) || 'my_value';
    var state   = g.state;
    var rem     = (state === 'near') ? Number(g.remaining) : 0;
    var gained  = Number(g.gained) || 0;

    /* 稼いだ情報。勧誘ではないので回数制限の外に置く。
       ★因果は主張しない。「この区分の記録が増えた」であって
         「あなたが招待した人のおかげで」ではない（そう言える紐付けを作っていない）。 */
    var win = '';
    if (g.crossed === true)      win = T.crossed;
    else if (gained > 0)         win = T.gained(gained);

    var ask = (state === 'near' || state === 'few') && mayAsk(surface);
    if (!win && !ask) return false;      // 出すものが何も無い

    ensureStyle();
    var head = (state === 'near') ? T.nearH(rem) : T.fewH;
    var sub  = (state === 'near') ? T.nearS(rem) : T.fewS;

    el.setAttribute('data-pvr', '1');
    el.setAttribute('data-v', variant);
    el.className = 'pvr';
    el.innerHTML =
      (win ? '<div class="pvr-win">' + esc(win) + '</div>' : '') +
      (ask
        ? '<div class="pvr-head">' +
            '<div><div class="pvr-eyebrow">' + esc(T.eyebrow) + '</div>' +
            '<div class="pvr-h">' + esc(head) + '</div></div>' +
            '<button type="button" class="pvr-x" data-pvr-x aria-label="' + esc(T.close) + '">&times;</button>' +
          '</div>' +
          '<div class="pvr-s">' + lines(sub) + '</div>' +
          '<div class="pvr-btns">' +
            '<button type="button" class="pvr-btn" data-pvr-go>' + esc(T.cta) + '</button>' +
            '<button type="button" class="pvr-btn2" data-pvr-copy>' + esc(T.copy) + '</button>' +
          '</div>' +
          '<div class="pvr-note">' + lines(T.privacy) + '</div>'
        : '');

    requestAnimationFrame(function () { el.classList.add('is-in'); });

    /* 描き直しでは撃たない（通貨を切り替えるたびに1件増えると実績が水増しされる）。 */
    if (win && !_wonOn[surface]) {
      _wonOn[surface] = true;
      track('referral_cohort_gained', { surface: surface, crossed: g.crossed === true ? 1 : 0 });
    }
    if (!ask) return true;

    _askedOn[surface] = true;

    wireShare(el, sb, surface);

    // ── 閉じる ────────────────────────────────────────────────
    el.querySelector('[data-pvr-x]').addEventListener('click', function () {
      var c = cap();
      c.dismiss += 1;
      if (c.dismiss >= 2) c.off = Date.now() + REST_MS;
      saveCap(c);
      track('referral_prompt_dismissed', { surface: surface, state: state });
      el.classList.remove('is-in');
      setTimeout(function () { el.innerHTML = ''; el.removeAttribute('data-pvr'); }, 260);
    });

    // ── 「見えた」を数える ────────────────────────────────────
    /* threshold 0.25 は lp.js の data-pv-view と同じ。
       ★ただし交差監視は「画面の中に入ったか」しか見ない。何かの覆いの裏に
         隠れているかは見ない。待遇モーダルが開いている間に数えてしまうと、
         一度も読まれないまま上限（4回）に達する。だから覆いが閉じるまで待つ。
         pv-conditions.js の名前ではなく aria-modal で見る＝どの覆いにも効く。 */
    if (_countedOn[surface]) return true;
    if (w.IntersectionObserver) {
      var seen = false, timer = null, io = null;
      var fire = function () {
        if (!seen || occluded()) return false;
        if (io) io.disconnect();
        if (timer) { clearInterval(timer); timer = null; }
        counted(surface, state, rem);
        return true;
      };
      io = new w.IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          seen = true;
          if (!fire() && !timer) timer = setInterval(fire, 400);
        });
      }, { threshold: 0.25 });
      io.observe(el);
    } else if (!occluded()) {
      counted(surface, state, rem);
    }
    return true;
  }

  // ══════════════════════════════════════════════════════════════
  // 7. 置き場所
  // ══════════════════════════════════════════════════════════════
  function mountCohort(el, opts) {
    if (!el || el.getAttribute('data-pvr')) return;          // 二重描画の番人
    var o = opts || {};
    gap(o.sb).then(function (g) {
      if (!g || !g.state || g.state === 'none') return;
      var sf = o.surface || 'my_value';
      if (g.state === 'open' && !_openOn[sf]) {
        _openOn[sf] = true;
        track('referral_cohort_open', { surface: sf });
        /* 比較が出ているので勧誘はしない。増えた分の1行だけ出す。 */
      }
      card(el, o.sb, g, o);
    });
  }

  /* マイページ（profile.html）の常設入口。
     ★ここは「招待したい」と思った人が行ける唯一の場所。文脈カード（上）は
       ・自分で給与を1件も記録していないと my_cohort_gap が 'none' を返して出ない
       ・5人そろっている区分（'open'）でも勧誘しない
       ・7日あける／4回で30日休む、の回数制限が乗る
       ＝機械が「いま聞くべきだ」と判断したときしか出ない。それだけだと、
       自分から誘いたい人（最初の何人かを自分で誘う立場の人）に入口が無い。

     文脈カードとはっきり違う3点：
       ・gap() を呼ばない ＝ 区分も人数も関係ない。給与ゼロの人にも出る
       ・mayAsk() / counted() を通らない ＝ 自分で見に来た画面なので、
         「4回見せたら30日休む」の予算を食わない（文脈カード側は減らない）
       ・× を置かない ＝ 常設の入口であって割り込みではない
     ★myLink は押されて初めて my_referral_code() を引く。開くだけでは
       招待コードを作らない。 */
  function mountInvite(el, opts) {
    if (!el || el.getAttribute('data-pvr')) return;
    var o = opts || {};
    var surface = o.surface || 'profile';
    ensureStyle();
    el.setAttribute('data-pvr', '1');
    el.setAttribute('data-v', 'profile');
    el.className = 'pvr';
    el.innerHTML =
      '<div class="pvr-eyebrow">' + esc(T.invE) + '</div>' +
      '<div class="pvr-h">' + esc(T.invH) + '</div>' +
      '<div class="pvr-s">' + lines(T.invS) + '</div>' +
      '<div class="pvr-btns">' +
        '<button type="button" class="pvr-btn" data-pvr-go>' + esc(T.invGo) + '</button>' +
        '<button type="button" class="pvr-btn2" data-pvr-copy>' + esc(T.copy) + '</button>' +
      '</div>' +
      '<div class="pvr-note">' + lines(T.privacy) + '</div>';
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    wireShare(el, o.sb, surface);
    track('referral_invite_shown', { surface: surface });
  }

  function mountAfterReport(opts) {
    var o = opts || {};
    var el = d.getElementById(o.slot || 'bench-gap');
    if (!el) return;
    /* ★いまの「まだ5人に届いていません」の一文を床として残したまま、
       あとから上書きする。RPC が落ちても、PVReferral が読めなくても、
       state が 'none' でも、床は抜けない。 */
    gap(o.sb).then(function (g) {
      if (!g || !g.state || g.state === 'none') return;
      if (g.state === 'open' && !_openOn.after_report) {
        _openOn.after_report = true;
        track('referral_cohort_open', { surface: 'after_report' });
      }
      var box = d.createElement('div');
      var drew = card(box, o.sb, g, { variant: 'bench', surface: 'after_report' });
      if (!drew) return;
      box.style.marginTop = '0';
      el.parentNode.replaceChild(box, el);
    });
  }

  // ══════════════════════════════════════════════════════════════
  // 8. 着地の1枚（トップページ）
  //
  // ★閉じ方を3つ置く（× ・カードの外 ・ESC）。どれか1つしか無い覆いは、
  //   その1つが押せない状況で詰む。待遇モーダルで同じ3つを揃えてある。
  // ★スクロールは止めない。下へ動かせば絶対に抜けられる＝閉じ込めが起きない。
  // ══════════════════════════════════════════════════════════════
  function mountStrip() {
    if (d.querySelector('.pvr-strip')) return;
    if (!stored()) return;
    try { if (w.sessionStorage.getItem(K_STRIP) === '0') return; } catch (e) {}
    /* ★他の覆いが先に開いていたら出さない。index.html は pv-conditions.js を
       読んでいないので今は起きないが、あとで読み込まれた日にここが効く。 */
    if (occluded()) return;
    ensureStyle();
    var box = d.createElement('div');
    box.className = 'pvr-strip';
    box.setAttribute('data-pvr-strip', '1');
    box.innerHTML =
      '<div class="pvr-card">' +
        '<button type="button" class="pvr-x" data-pvr-x aria-label="' + esc(T.close) + '">&times;</button>' +
        '<div class="pvr-eyebrow">' + esc(T.stripE) + '</div>' +
        '<div class="pvr-strip-t">' + esc(T.stripH) + '</div>' +
        '<div class="pvr-tag">' + esc(TAGLINE) + '</div>' +
        '<div class="pvr-strip-v">' + lines(T.stripV) + '</div>' +
        '<div class="pvr-rule"></div>' +
        '<div class="pvr-strip-s">' + esc(T.stripS) + '</div>' +
        '<button type="button" class="pvr-go" data-pvr-x>' + esc(T.stripGo) +
          ' <span aria-hidden="true">&rarr;</span></button>' +
      '</div>';
    d.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add('is-in'); });
    track('referral_land', {});

    var gone = false;
    function dismiss() {
      if (gone) return;
      gone = true;
      /* ★閉じても pv_ref は消さない。この1枚を閉じることは招待を断ることではない。 */
      try { w.sessionStorage.setItem(K_STRIP, '0'); } catch (e) {}
      track('referral_strip_dismissed', {});
      d.removeEventListener('keydown', onKey);
      box.classList.remove('is-in');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 520);
    }
    function onKey(e) { if (e.key === 'Escape' || e.key === 'Esc') dismiss(); }

    /* × も「サイトを見る」も同じ [data-pvr-x]＝閉じるという1つの動きにまとめる。 */
    var i, xs = box.querySelectorAll('[data-pvr-x]');
    for (i = 0; i < xs.length; i++) xs[i].addEventListener('click', dismiss);
    /* カードの外（暗い部分）を押しても閉じる。カードの中は素通し。 */
    box.addEventListener('click', function (e) { if (e.target === box) dismiss(); });
    d.addEventListener('keydown', onKey);
  }

  // ══════════════════════════════════════════════════════════════
  w.PVReferral = {
    capture: capture,
    claim: claim,
    settle: settle,
    mountStrip: mountStrip,
    mountCohort: mountCohort,
    mountInvite: mountInvite,
    mountAfterReport: mountAfterReport,
    _gap: gap,
    _text: shareText,
    _T: T
  };

  /* ★ここで同期的に捕まえる。lang-toggle.js より前に読み込むこと
     （あちらは pv-lang==='en' の人を location.replace() で /en/ へ飛ばし、
       そのときクエリを丸ごと捨てる）。 */
  capture();
})(typeof window !== 'undefined' ? window : null,
   typeof document !== 'undefined' ? document : null);
