/* ════════════════════════════════════════════════════════════════
   pv-conditions.js — 待遇・働き方の質問（給与レポートの直後に出すモーダル）

   日英で1本。<html lang> を見て文言を切り替える＝2ファイルに散らさない。

   ── いつ出すか ──────────────────────────────────────────────
   入口は年収のまま。待遇の質問を給与フォームの前にも中にも入れない。
   ★出すのは「給与が保存され、レポートが画面に出たあと」だけ。
     ログインしただけの人には出さない。まだ何も渡していない相手に質問するのは
     通行料に見える。レポートを渡した直後だけが、頼んでよい唯一の瞬間。
   ★給与の保存・レポートの表示・アカウント作成を1ミリも止めない。
     ここが落ちても、落ちたことに気づかせない（モーダルが出ないだけ）。
   ★マイページ（profile.html）には質問を出しっぱなしにしない。
     「1問だけ答える →」を置き、押した人にだけ同じモーダルを1問開く。
   ★例外が1つ（2026-10-30 オーナー指示）── 戻ってきた会員に「〇〇のこと、ひとつ教えて。」（askReturn）。
     聞くのは**給与か口コミを出した会員だけ**（もう渡してくれた人＝通行料にはならない）・2日に1回・3問まで。
     誰に・何を・どの順・いつかは全部サーバ（db/ask-own-airline.sql）。出してよいページかは pv-session.js の askDue。
     この板だけ、数字の欄と「複数選ぶ」を描く（給与の後の板・マイページの1問は今までどおり1タップだけ）。

   ── 何問出すか ──────────────────────────────────────────────
   「初めての給与提出か」では分けない。**その会社でその人が何問答えたか**で分ける。
     まだ3問未満  → 残り（最大3問）  … 最初の3問で1社の骨格が立つ
     3問以上      → 1問              … 毎月戻る理由を、負担にならない大きさで置き続ける
   会社を変えた人（ANA→Emirates）は proof_hash が別なので自動でまた3問に戻る。
   数字は pv-conditions.json の settings から読む（生成元は pv-conditions.mjs の SETTINGS）。
   ★言った問数で必ず終わる。3問と言ったら4問目を出さない。

   ── 出す質問は DB が決める ──────────────────────────────────
   next_condition_questions が
     ① boost（まだ0問の人だけ）→ ② Tier（A→B→C）→ ③ その会社で答えた人が少ない順
     → ④ 最終確認が古い順 → ⑤ 質問の並び順
   で返す。★ 親を持つ質問は、その人自身が親に答えているときだけ返る
   （「Reserve はありますか？」に答えていない人に「自宅待機ですか？」は出ない）。
   親にも親がある質問は、いちばん上の親まで条件が続いているときだけ返る。

   ── 守ること ────────────────────────────────────────────────
   ・出せない理由（未ログイン・テーブルがまだ無い・聞くことが無い・通信失敗）は
     すべて「黙って何も出さない」。
   ・× と「今回はスキップ」が必ずある。強制しない。閉じてもレポートは残る。
   ・全問に「わからない」がある。推測を促す文言を書かない。
   ・「◯%完成」を出さない。埋めさせる圧力＝推測入力の動機になる。
   ・1問ごとに即保存する。最後にまとめて送らない（途中で閉じた分も残る）。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d) return;
  /* 2度読まれても1つだけ（戻ってきた会員に聞く板は pv-session.js が後から読み込む。profile.html は最初から読んでいる） */
  if (w.PVConditions && w.PVConditions.askReturn) return;

  /* 質問文の在り処。★ページ相対で書くと /en/ から /en/pv-conditions.json を
     見に行って 404 になる。このスクリプト自身の URL を基準に解く
     （my-value.js の PUB_URL と同じやり方）。currentScript は同期実行中しか
     取れないので、ここ（IIFE の冒頭）で確定させる。 */
  var BANK_URL  = 'pv-conditions.json';
  var VOCAB_URL = 'pv-vocab.json';     // 通貨の一覧（金額を聞く質問だけが使う）
  try {
    var _self = (d.currentScript && d.currentScript.src) || '';
    if (_self) {
      BANK_URL  = new URL('pv-conditions.json', _self).href;
      VOCAB_URL = new URL('pv-vocab.json', _self).href;
    }
  } catch (e) {}

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  /* 詳細ページ（airline-conditions.html / en/airline-conditions.html）が
     あるかどうか。無い間は「もっと詳しく答える →」を1回も出さない
     （404 へのリンクを1コミットの間でも本番に置かない）。 */
  var DETAIL_READY = true;

  /* 設定が読めなかったときだけ使う控えの値。正は pv-conditions.json の settings。 */
  var FALLBACK = { initial_limit: 3, recurring_limit: 1, profile_limit: 1, modal_delay_ms: 700 };

  var UNKNOWN = 'unknown';

  /* ── 計測 ────────────────────────────────────────────────────
     GA4 の gtag だけ。DB のテーブルは作らない（payslip.js / pay-login.js と同じ）。
     送るのは trigger / question_id / question_number / airline_code だけ。
     金額・自由記述・メールアドレスは1つも送らない。 */
  function track(name, params) {
    try { if (typeof w.gtag === 'function') w.gtag('event', name, params || {}); } catch (e) {}
  }

  /* ── 文言 ────────────────────────────────────────────────────
     ★ 文は「意味の切れ目」の配列で持つ。日本語は行末でどこでも折り返せるので、
     1行の文字列で書くと「…教えてくださ／い」のように語の途中で切れる。
     lines() が各要素を inline-block の箱にして、折り返しを切れ目だけに限る。 */
  var T = {
    ja: {
      eyebrow: ['あと10秒だけ、', '教えてください'],
      close: '閉じる',
      skip: '今回はスキップ',
      more: 'もっと詳しく答える →',
      step: function (i, n) { return i + ' / ' + n; },
      thanks: function (name) {
        return ['ありがとうございます。', (name || 'この会社') + ' の待遇情報が', '更新されました。'];
      },
      failed: ['保存できませんでした。', '時間をおいてもう一度お試しください。'],
      /* 再確認。前回の答えを見せてから「今も同じか」だけを聞く */
      again: function (label) { return ['以前「' + label + '」と回答しました。', '現在も同じですか？']; },
      same: '変わっていない',
      changed: '変わった',
      dunno: 'わからない',
      /* 戻ってきた会員に聞く板（askReturn・2026-10-30 オーナー指示）。見出しはオーナーの言葉のまま */
      askHead: function (name) { return [(name || 'あなたの会社') + 'のこと、', 'ひとつ教えて。']; },
      next: '次へ',
      multiHint: 'あてはまるものを全部選んでください。',
      /* 1つの塊にする（「の続き」だけが次の行へ落ちないように。長い質問は塊の中で折り返す） */
      followUp: function (label) { return ['「' + label + '」の続き']; },
      numBad: function (min, max) { return [min + '〜' + max + ' の数字で', '入れてください。']; },
      /* マイページの二次導線。★勝手に質問を出さない。押した人にだけ開く */
      ctaTitle: function (name) { return (name ? name + ' の' : '') + '待遇情報'; },
      ctaSub: ['まだ答えていない質問があります。', '1問だけでも、次の人の役に立ちます。'],
      ctaBtn: '1問だけ答える →',
      /* 詳細ページ（airline-conditions.html）。ここだけ全部の質問を出す */
      fullTitle: '待遇・働き方',
      fullCount: function (n, all) { return 'あなたが答えた項目：' + n + '／' + all; },
      fullPick: '会社を選んでください',
      fullPickHelp: ['待遇は会社ごとに違うので、', 'どこの話かが決まらないと保存できません。'],
      fullOther: '一覧にない会社',
      fullOtherPh: '会社名',
      fullGo: 'この会社で始める',
      fullNeedLogin: ['ログインすると、答えた内容が残ります。'],
      fullSaved: '保存しました',
      fullFail: '保存できませんでした',
      fullNote: '補足（任意・300字まで）',
      fullNum: '入力する',
      fullSkip: 'スキップ',
      fullCur: '通貨',
      fullCurPick: '通貨を選ぶ',
      fullCurNeed: '通貨を選んでください。',
      /* 低いほう・高いほうの対（質問の一覧の rangeLow）。送る前に止めた時も、サーバが断った時も、この2つの文で言う
         （会社ページの面 pv-contrib.js の WHY.range_order / WHY.range_currency と同じ文） */
      fullRangeOrder: '低いほうの額が、高いほうの額より大きくなっています。',
      fullRangeCur: '低いほうと高いほうは、同じ通貨で入れてください。',
      /* 読み込みそのものに失敗したとき。★骨組みのまま黙って止めない
         （2026-08-19、詳細ページが本番で真っ白のまま誰も気づけなかった） */
      fullDeadTitle: '質問を読み込めませんでした',
      fullDead: ['通信が不安定なときや、', '読み込みの途中で切れたときに起きます。'],
      fullRetry: 'もう一度読み込む',
      /* 最後に置く口コミへの導線。会社の事実ではないものは、口コミ側で集める */
      voicesTitle: '社内の雰囲気については',
      voicesBody: ['パイロット同士の関係・Management・訓練の文化・Work-Life Balance は、',
                   '点数と文章で口コミに集めています。'],
      voicesLink: '匿名で口コミを書く →'
    },
    en: {
      eyebrow: ['Ten more seconds,', 'if you have them'],
      close: 'Close',
      skip: 'Skip this one',
      more: 'Tell us more →',
      step: function (i, n) { return i + ' / ' + n; },
      thanks: function (name) {
        return ['Thank you.', 'Conditions for ' + (name || 'this airline') + ' have been updated.'];
      },
      failed: ['Could not save.', 'Please try again later.'],
      again: function (label) { return ['You previously answered "' + label + '".', 'Is that still the case?']; },
      same: 'Still the same',
      changed: 'It changed',
      dunno: 'I do not know',
      askHead: function (name) { return ['Tell us one thing about ' + (name || 'your airline') + '.']; },
      next: 'Next',
      multiHint: 'Choose all that apply.',
      followUp: function (label) { return ['Follow-up to:', '“' + label + '”']; },
      numBad: function (min, max) { return ['Please enter a number', 'from ' + min + ' to ' + max + '.']; },
      ctaTitle: function (name) { return 'Working conditions' + (name ? ' at ' + name : ''); },
      ctaSub: ['There are questions you have not answered yet.', 'Even one helps the next pilot.'],
      ctaBtn: 'Answer one question →',
      fullTitle: 'Working conditions',
      fullCount: function (n, all) { return 'You have answered ' + n + ' of ' + all; },
      fullPick: 'Choose your airline',
      fullPickHelp: ['Conditions differ by airline,', 'so nothing can be saved until we know which one.'],
      fullOther: 'Not in the list',
      fullOtherPh: 'Airline name',
      fullGo: 'Start with this airline',
      fullNeedLogin: ['Sign in and your answers are kept.'],
      fullSaved: 'Saved',
      fullFail: 'Could not save',
      fullNote: 'Note (optional, up to 300 characters)',
      fullNum: 'Enter',
      fullSkip: 'Skip',
      fullCur: 'Currency',
      fullCurPick: 'Choose currency',
      fullCurNeed: 'Please choose a currency.',
      fullRangeOrder: 'The lowest amount is larger than the highest amount.',
      fullRangeCur: 'Use the same currency for the lowest and the highest amount.',
      fullDeadTitle: 'Could not load the questions',
      fullDead: ['This happens when the connection is unstable,', 'or when loading was interrupted.'],
      fullRetry: 'Reload',
      voicesTitle: 'What the place feels like',
      voicesBody: ['Relationships between pilots, management, training culture and work-life balance',
                   'are collected in reviews, as scores and in your own words.'],
      voicesLink: 'Write a review anonymously →'
    }
  }[L];

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* 切れ目の配列 → 折り返しが切れ目でしか起きない HTML。
     英語は箱の間に空白が要る（日本語は要らない）。 */
  var lines = function (parts) {
    return [].concat(parts).map(function (t) {
      return '<span class="pvc-nb">' + esc(t) + '</span>';
    }).join(L === 'en' ? ' ' : '');
  };

  /* 文の最後の3文字を、折り返さない1つの塊（.pvcf-tail）にした HTML（2026-10-12）。一覧の、質問の名前と説明に使う。
     「…ありますか？」が、狭い画面で「か？」だけ次の行へ残っていた。text-wrap を知らないブラウザでも残らない。
     字は足さない・並びも変えない ＝ 画面の字（textContent）は渡した文と1文字も違わない。読み上げにも何も足さない。
     塊の手前で折ってよいかは、ブラウザの禁則がそのまま決める（塊は nowrap。inline-block にしない）。
     数えるのは文字（サロゲートの対を割らない）。3文字以下の文はそのまま。日英で同じ道を通る
     （英語は語の途中で折れないので、何も変わらない）。同じ決まりが pv-contrib.js の endKept にも在る。 */
  var endKept = function (s) {
    var ch = String(s == null ? '' : s).match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) || [];
    if (ch.length <= 3) return esc(ch.join(''));
    return esc(ch.slice(0, -3).join('')) + '<span class="pvcf-tail">' + esc(ch.slice(-3).join('')) + '</span>';
  };

  /* 選択肢の字を「・」の後ろで分け、2つめからの分を1つずつ折り返しの単位（.pvc-nb ＝ 上の lines と同じ箱）にした
     HTML（2026-10-12）。一覧の選択肢に使う。狭い画面で「いくつかの条件で変わる・そ／の他」と、語の途中で折れていた。
     字は足さない・並びも変えない（「・」は前の分の最後に残る）＝ 画面の字は渡した字と1文字も違わない。
     箱は自分の字の幅までしか広がらず、1行に入らない箱の中の字は今までどおり折り返す ＝ はみ出さない。
     ★最初の分は箱に入れない。行の頭から始まるので、箱にしなくても、途中で折れるのは1行に入らないときだけ。
       箱にすると、選んだ印（✓ と、そのあとの空き）のすぐ後ろが字でなく箱になり、空きの幅が 3px ほど変わる
       ＝「・」の在る選択肢と無い選択肢で、✓ と字のあいだが違って見える（実測）。
     「・」の無い字（英語は全部）は、今までと1文字も違わない HTML。
     ⚠️ 選択肢を探すのは data-code。字や子の並びで探さない（箱が入るので、子は字1つとは限らない）。 */
  var dotParts = function (s) {
    var t = String(s == null ? '' : s), parts = [], at = 0, i;
    for (i = 0; i < t.length - 1; i++) {
      if (t.charAt(i) === '・') { parts.push(t.slice(at, i + 1)); at = i + 1; }
    }
    parts.push(t.slice(at));
    return parts.map(function (p, k) { return k ? '<span class="pvc-nb">' + esc(p) + '</span>' : esc(p); }).join('');
  };

  /* ── 見た目 ──────────────────────────────────────────────────
     PC もスマホも同じ1枚のモーダル。ボトムシートを別に作らない。
     色はレポートのカード（.res）と同じ緑＋ブランドの金。影は色を持たせて3層。 */
  var CSS = [
    '.pvc-back{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;',
      'padding:16px;background:rgba(6,10,16,.74);opacity:0;',
      'transition:opacity .3s cubic-bezier(.16,1,.3,1)}',
    '.pvc-back.is-in{opacity:1}',
    '.pvc-modal{position:relative;width:100%;max-width:520px;max-height:calc(100vh - 32px);',
      'overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:22px;padding:30px 26px 20px;',
      'border:1px solid rgba(52,211,153,.28);',
      'background:radial-gradient(130% 170% at 0% 0%,rgba(52,211,153,.13),transparent 60%),#111620;',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 18px 40px -20px rgba(52,211,153,.34),',
      '0 46px 90px -44px rgba(6,10,16,.95);',
      'opacity:0;transform:translateY(10px) scale(.985);',
      'transition:opacity .36s cubic-bezier(.16,1,.3,1),transform .36s cubic-bezier(.16,1,.3,1)}',
    '.pvc-back.is-in .pvc-modal{opacity:1;transform:none}',
    '@media (prefers-reduced-motion:reduce){.pvc-back,.pvc-modal{opacity:1;transform:none;transition:none}}',
    /* × は指の当たる大きさを確保する（見た目の記号は小さいまま） */
    '.pvc-x{position:absolute;top:8px;right:8px;width:44px;height:44px;display:grid;place-items:center;',
      'border:0;background:none;color:#6b7d93;font-size:1.35rem;line-height:1;cursor:pointer;border-radius:12px;',
      'transition:color .2s,background .2s}',
    '.pvc-x:hover{color:#e8edf2;background:rgba(255,255,255,.06)}',
    '.pvc-x:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}',
    '.pvc-x:active{transform:scale(.94)}',
    '.pvc-eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.06em;color:#34d399;padding-right:36px}',
    /* 社名は添えるだけ。主役は質問文 */
    '.pvc-air{font-size:.74rem;font-weight:700;color:#6b7d93;margin-top:6px}',
    '.pvc-q{font-size:1.06rem;font-weight:800;letter-spacing:-.01em;color:#e8edf2;line-height:1.6;',
      'margin-top:16px}',
    '.pvc-help{font-size:.78rem;line-height:1.7;color:#6b7d93;margin-top:8px}',
    '.pvc-opts{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}',
    '.pvc-opt{min-height:44px;padding:11px 18px;border-radius:999px;font-size:.85rem;font-weight:700;',
      'color:#e8edf2;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.14);cursor:pointer;',
      'transition:border-color .2s,background .2s,color .2s,transform .18s cubic-bezier(.16,1,.3,1)}',
    '.pvc-opt:hover{border-color:rgba(52,211,153,.5);background:rgba(52,211,153,.08)}',
    '.pvc-opt:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}',
    '.pvc-opt:active{transform:scale(.97)}',
    '.pvc-opt[disabled]{cursor:default;opacity:.45}',
    /* 選んだ印は色だけに頼らない（✓ を足す） */
    '.pvc-opt.is-picked{opacity:1;color:#34d399;border-color:rgba(52,211,153,.55);background:rgba(52,211,153,.12)}',
    '.pvc-opt.is-picked::before{content:"\\2713\\a0"}',
    /* 選んだ選択肢に置いたとき（2026-10-12）。選んだ選択肢も押せる（一覧では、複数選ぶ質問で外せる）のに、
       置いても見た目が動かなかった ── 上の :hover は、同じ強さで後ろに在る .is-picked に負ける。
       枠は選んだ字の色・地は1段濃く。押せないあいだ（1問だけ聞くカードで、保存の返事を待つあいだ）は動かさない。
       置ける端末だけ（hover:hover）＝ 指で触る端末で、押したばかりの選択肢だけが濃いまま残らない。 */
    '@media (hover:hover){.pvc-opt.is-picked:not([disabled]):hover{border-color:#34d399;background:rgba(52,211,153,.18)}}',
    '.pvc-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:22px;',
      'padding-top:4px;border-top:1px solid rgba(255,255,255,.06)}',
    '.pvc-step{font-size:.72rem;font-weight:700;letter-spacing:.08em;color:#6b7d93}',
    '.pvc-skip{min-height:44px;padding:11px 2px;border:0;background:none;font-size:.78rem;font-weight:700;',
      'color:#6b7d93;cursor:pointer;text-decoration:underline;text-decoration-thickness:1px;',
      'text-underline-offset:4px;text-decoration-color:rgba(107,125,147,.35);',
      'transition:color .2s,text-decoration-color .2s}',
    '.pvc-skip:hover{color:#e8edf2;text-decoration-color:rgba(232,237,242,.6)}',
    '.pvc-skip:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:3px;border-radius:6px}',
    '.pvc-nb{display:inline-block}',
    /* 戻ってきた会員に聞く板（2026-10-30）。見出しが主役の1行目、数字の欄、「次へ」 */
    '.pvc-eyebrow.is-ask{font-size:1rem;font-weight:800;letter-spacing:-.01em;line-height:1.5}',
    '.pvc-numrow{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:20px}',
    /* 16px 未満だと iPhone が欄に入った瞬間に画面を拡大する */
    '.pvc-num{font-size:16px;width:132px}',
    '.pvc-unit{font-size:.82rem;font-weight:700;color:#6b7d93}',
    '.pvc-go{display:flex;justify-content:flex-end;margin-top:16px}',
    '.pvc-ctx{font-size:.74rem;font-weight:700;line-height:1.6;color:#6b7d93;margin-top:14px}',
    '.pvc-ctx + .pvc-q{margin-top:6px}',
    /* 終わりは静かに。紙吹雪もゲーム感も出さない */
    '.pvc-done{font-size:.95rem;font-weight:700;line-height:1.75;color:#34d399;padding:16px 0 10px}',
    '.pvc-warn{font-size:.8rem;line-height:1.7;color:#f5c842;margin-top:14px}',
    '.pvc-more{display:inline-flex;align-items:center;min-height:44px;margin-top:2px;',
      'padding:12px 0;font-size:.82rem;font-weight:700;',
      'color:#f5c842;text-decoration:underline;text-decoration-thickness:1px;',
      'text-underline-offset:4px;text-decoration-color:rgba(245,200,66,.35);',
      'transition:color .2s,text-decoration-color .2s}',
    '.pvc-more:hover{text-decoration-color:rgba(245,200,66,.9)}',
    '.pvc-more:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:3px}',
    '.pvc-more:active{transform:translateY(1px)}',
    /* リンクと同じ見た目をボタンでも使う（読み直しは遷移ではないのでボタンが正しい） */
    'button.pvc-more{background:none;border:0;font-family:inherit;cursor:pointer}',
    /* マイページの二次導線（押されたときだけモーダルを開く小さなカード） */
    '.pvc-cta{margin-top:20px}',
    '.pvc-cta-t{font-size:.9rem;font-weight:800;color:#e8edf2;letter-spacing:-.01em}',
    '.pvc-cta-s{font-size:.78rem;line-height:1.7;color:#6b7d93;margin-top:6px}',
    '.pvc-cta-b{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}',
    '.pvc-btn{min-height:44px;padding:11px 18px;border-radius:999px;font-size:.82rem;font-weight:700;',
      'color:#0b1017;background:#f5c842;border:1px solid rgba(245,200,66,.5);cursor:pointer;',
      'box-shadow:0 10px 24px -14px rgba(245,200,66,.7);',
      'transition:background .2s,border-color .2s,transform .18s cubic-bezier(.16,1,.3,1)}',
    '.pvc-btn:hover{background:#ffd75c}',
    '.pvc-btn[disabled]{cursor:default;opacity:.4;box-shadow:none}',
    '.pvc-btn[disabled]:hover{background:#f5c842}',
    '.pvc-btn:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:3px}',
    '.pvc-btn:active{transform:scale(.97)}',
    /* 明るいテーマ。暗いほうを既定にしているので、ここは差分だけ上書きする */
    '[data-theme="light"] .pvc-back{background:rgba(15,23,42,.5)}',
    '[data-theme="light"] .pvc-modal{background:radial-gradient(130% 170% at 0% 0%,rgba(13,138,99,.09),transparent 60%),#fff;',
      'border-color:rgba(13,138,99,.28);',
      'box-shadow:0 18px 40px -20px rgba(13,138,99,.3),0 46px 90px -44px rgba(15,23,42,.45)}',
    '[data-theme="light"] .pvc-eyebrow,[data-theme="light"] .pvc-done{color:#0d8a63}',
    '[data-theme="light"] .pvc-q,[data-theme="light"] .pvc-cta-t{color:#0f172a}',
    '[data-theme="light"] .pvc-help,[data-theme="light"] .pvc-air,',
      '[data-theme="light"] .pvc-step,[data-theme="light"] .pvc-cta-s{color:#64748b}',
    '[data-theme="light"] .pvc-x,[data-theme="light"] .pvc-skip{color:#64748b}',
    '[data-theme="light"] .pvc-x:hover,[data-theme="light"] .pvc-skip:hover{color:#0f172a}',
    '[data-theme="light"] .pvc-foot{border-top-color:rgba(15,23,42,.1)}',
    '[data-theme="light"] .pvc-opt{color:#0f172a;background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.14)}',
    '[data-theme="light"] .pvc-opt:hover{border-color:rgba(13,138,99,.45);background:rgba(13,138,99,.07)}',
    '[data-theme="light"] .pvc-opt.is-picked{color:#0d8a63;border-color:rgba(13,138,99,.5);background:rgba(13,138,99,.1)}',
    '@media (hover:hover){[data-theme="light"] .pvc-opt.is-picked:not([disabled]):hover{',
      'border-color:#0d8a63;background:rgba(13,138,99,.16)}}',
    '[data-theme="light"] .pvc-more,[data-theme="light"] .pvc-warn{color:#a97e00}',
    /* ── 詳細ページ（airline-conditions.html）──────────────────
       モーダルと同じ部品を使うが、こちらは全部の質問を一度に並べる。
       進捗バーは出さない（埋めさせる圧力＝推測入力の動機になる）。 */
    '.pvcf-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px 16px}',
    '.pvcf-t{font-size:1.5rem;font-weight:900;letter-spacing:-.03em;color:#e8edf2}',
    '.pvcf-air{font-size:.86rem;font-weight:700;color:#34d399}',
    '.pvcf-lead{font-size:.84rem;line-height:1.8;color:#6b7d93;margin-top:10px}',
    '.pvcf-count{font-size:.76rem;font-weight:700;letter-spacing:.04em;color:#6b7d93;margin-top:16px}',
    '.pvcf-sec{margin-top:18px;border:1px solid rgba(255,255,255,.08);border-radius:18px;',
      'background:rgba(255,255,255,.02);overflow:hidden}',
    '.pvcf-sum{display:flex;align-items:center;justify-content:space-between;gap:12px;',
      'min-height:56px;padding:14px 20px;cursor:pointer;list-style:none;',
      'font-size:.95rem;font-weight:800;letter-spacing:-.01em;color:#e8edf2;',
      'transition:background .2s,color .2s}',
    '.pvcf-sum::-webkit-details-marker{display:none}',
    '.pvcf-sum:hover{background:rgba(52,211,153,.06)}',
    '.pvcf-sum:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:-2px}',
    '.pvcf-badge{font-size:.72rem;font-weight:700;letter-spacing:.06em;color:#6b7d93}',
    '.pvcf-sec[open] .pvcf-sum{border-bottom:1px solid rgba(255,255,255,.07)}',
    '.pvcf-body{padding:4px 20px 20px}',
    '.pvcf-q{padding:18px 0;border-bottom:1px solid rgba(255,255,255,.05)}',
    '.pvcf-q:last-child{border-bottom:0}',
    '.pvcf-q[hidden]{display:none}',
    /* 親の答えから開いた子は、ぶら下がりが見えるように少し下げる */
    '.pvcf-q.is-child{padding-left:16px;border-left:2px solid rgba(52,211,153,.28);margin-left:2px}',
    /* ?q=<鍵> で運ばれてきた行。行の高さも字の位置も動かさず、後ろに板を1枚敷くだけ
       （余白を足して目立たせると、前後の行と字の頭がずれる）。
       色は pv-tokens.css のものをそのまま使う＝ライトとダークを書き分けない。 */
    '.pvcf-q.is-target{position:relative;z-index:0}',
    '.pvcf-q.is-target:focus{outline:none}',
    '.pvcf-q.is-target::before{content:"";position:absolute;z-index:-1;top:6px;bottom:6px;left:-12px;right:-12px;',
      'border-radius:12px;background:var(--pv-green-soft);border:1px solid var(--pv-green-line);pointer-events:none}',
    '.pvcf-lab{font-size:.92rem;font-weight:700;line-height:1.7;color:#e8edf2}',
    '.pvcf-help{font-size:.78rem;line-height:1.7;color:#6b7d93;margin-top:6px}',
    /* 質問の名前と説明の、最後の3文字（上の endKept が包む）。折り返しで離さない
       ＝ 最後の行に1〜2文字だけが残らない。どのブラウザでも同じ。
       ★上の2つに text-wrap:pretty を戻さない（2026-10-12）。併せて使うと「…払われる手／当です。」と語の途中で折れた。 */
    '.pvcf-tail{white-space:nowrap}',
    '.pvcf-row{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-top:12px}',
    '.pvcf-row[hidden]{display:none}',
    '.pvcf-num{min-height:44px;width:120px;padding:11px 12px;border-radius:12px;',
      'font-family:inherit;font-size:.9rem;font-weight:700;color:#e8edf2;background:rgba(255,255,255,.04);',
      'border:1px solid rgba(255,255,255,.14);transition:border-color .2s,background .2s}',
    '.pvcf-num:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}',
    /* max-width:100% ＝ 行より広がらせない。通貨の欄はいちばん長い選択肢の字の幅まで広がるので、
       狭い画面（日本語は幅343未満）で右の端と矢印が節の枠に切られていた（2026-10-09）。 */
    '.pvcf-sel{min-height:44px;max-width:100%;padding:11px 12px;border-radius:12px;',
      'font-family:inherit;font-size:.85rem;font-weight:700;',
      'color:#e8edf2;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.14);',
      'transition:border-color .2s,background .2s}',
    '.pvcf-sel:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}',
    /* 置いたとき・押したときの見た目（2026-10-12）。額の欄と通貨の欄（会社を選ぶ画面の欄も同じ部品）には、
       フォーカスの輪しか無かった。色は、選択肢の :hover（置いたとき）と、選んだ選択肢（押したとき）のものをそのまま使う。
       動かすのは枠と地の色だけ ＝ 大きさは変えない。
       ★置いたときの見た目は、置ける端末だけ（hover:hover）。指で触る端末は、触ったあとも「置いた」ままになるので、
         触り終わった欄が、触っていない欄と違う見た目のまま残る。
       ★下の aria-invalid の規則より前に置く ＝ 断りの元になった欄は、置いても押しても、枠が断りの色のまま。 */
    '@media (hover:hover){.pvcf-num:hover,.pvcf-sel:hover{border-color:rgba(52,211,153,.5);background:rgba(52,211,153,.08)}}',
    '.pvcf-num:active,.pvcf-sel:active{border-color:rgba(52,211,153,.55);background:rgba(52,211,153,.12)}',
    /* 断りの元になった欄（pv-conditions.js の say が aria-invalid を付ける）は、枠を断りの文と同じ色にする */
    '.pvcf-num[aria-invalid="true"],.pvcf-sel[aria-invalid="true"]{border-color:#f5c842}',
    '.pvcf-unit{font-size:.8rem;font-weight:700;color:#6b7d93}',
    /* 額の欄と単位は1つの塊。行が折り返しても、あいだでは折り返さない ＝ 単位が額から離れて次の行へ落ちない。
       狭いときは額の欄が縮む。単位は縮めない・折り返さない。 */
    '.pvcf-amt{display:inline-flex;align-items:center;gap:9px;min-width:0;max-width:100%}',
    '.pvcf-amt .pvcf-num{flex:0 1 120px;min-width:0}',
    '.pvcf-amt .pvcf-unit{flex:none;white-space:nowrap}',
    '.pvcf-note{width:100%;min-height:76px;margin-top:10px;padding:12px 14px;border-radius:12px;',
      'font:inherit;font-size:.85rem;line-height:1.7;color:#e8edf2;background:rgba(255,255,255,.04);',
      'border:1px solid rgba(255,255,255,.14);resize:vertical}',
    '.pvcf-note:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}',
    /* ★iOS は 16px 未満の入力欄に触れるとページごと拡大し、戻らない（2026-08-27 実測）。⚠️ 16px を下げない。 */
    '@media (pointer:coarse),(max-width:820px){.pvcf-num,.pvcf-sel,.pvcf-note{font-size:16px}}',
    '.pvcf-notelab{display:block;font-size:.74rem;font-weight:700;color:#6b7d93;margin-top:12px}',
    /* 保存の合図は静かに。色だけに頼らないので文字でも書く */
    '.pvcf-state{font-size:.74rem;font-weight:700;color:#34d399;margin-top:10px;min-height:1em}',
    '.pvcf-state.is-bad{color:#f5c842}',
    '.pvcf-voices{margin-top:26px;padding:22px 24px;border-radius:18px;',
      'border:1px solid rgba(245,200,66,.22);background:rgba(245,200,66,.05)}',
    '.pvcf-voices-t{font-size:.95rem;font-weight:800;letter-spacing:-.01em;color:#e8edf2}',
    '.pvcf-voices-s{font-size:.8rem;line-height:1.8;color:#6b7d93;margin-top:8px}',
    '.pvcf-pick{max-width:460px}',
    '.pvcf-pick .pvcf-sel{width:100%;margin-top:14px}',
    '.pvcf-pick .pvcf-num{width:100%}',
    '[data-theme="light"] .pvcf-t,[data-theme="light"] .pvcf-lab,',
      '[data-theme="light"] .pvcf-sum,[data-theme="light"] .pvcf-voices-t{color:#0f172a}',
    '[data-theme="light"] .pvcf-lead,[data-theme="light"] .pvcf-help,',
      '[data-theme="light"] .pvcf-count,[data-theme="light"] .pvcf-badge,',
      '[data-theme="light"] .pvcf-unit,[data-theme="light"] .pvcf-notelab,',
      '[data-theme="light"] .pvcf-voices-s{color:#64748b}',
    '[data-theme="light"] .pvcf-air,[data-theme="light"] .pvcf-state{color:#0d8a63}',
    /* 置いたとき・押したとき（明るいテーマ）。この下の aria-invalid の規則より前に置く（暗いほうと同じ理由）。 */
    '@media (hover:hover){[data-theme="light"] .pvcf-num:hover,[data-theme="light"] .pvcf-sel:hover{',
      'border-color:rgba(13,138,99,.45);background:rgba(13,138,99,.07)}}',
    '[data-theme="light"] .pvcf-num:active,[data-theme="light"] .pvcf-sel:active{',
      'border-color:rgba(13,138,99,.5);background:rgba(13,138,99,.1)}',
    /* 断りの文は小さい字（約12px）なので、白い地に対して 4.5:1 以上の色にする（#a97e00 は 3.7:1 だった）。
       #8a6e00 ＝ サイトの金のインク（pv-tokens.css の --pv-gold-ink）。断りの元になった欄の枠も同じ色。 */
    '[data-theme="light"] .pvcf-state.is-bad{color:#8a6e00}',
    '[data-theme="light"] .pvcf-num[aria-invalid="true"],[data-theme="light"] .pvcf-sel[aria-invalid="true"]{border-color:#8a6e00}',
    /* フォーカスの輪。暗い地のための淡い金（rgba(245,200,66,.6)）は、白い地の上では 1.3:1 でほとんど見えない。
       明るいテーマでは、この明るいほうの見た目がもう使っている金のインクにする（白い地に対して 3:1 以上）。
       額の欄・通貨の欄（会社を選ぶ画面の欄も同じ部品）と、一覧の行の中の選択肢だけ。 */
    '[data-theme="light"] .pvcf-num:focus-visible,[data-theme="light"] .pvcf-sel:focus-visible,',
      '[data-theme="light"] .pvcf-q .pvc-opt:focus-visible{outline-color:#a97e00}',
    '[data-theme="light"] .pvcf-sec{border-color:rgba(15,23,42,.1);background:#fff}',
    '[data-theme="light"] .pvcf-sec[open] .pvcf-sum{border-bottom-color:rgba(15,23,42,.08)}',
    '[data-theme="light"] .pvcf-q{border-bottom-color:rgba(15,23,42,.07)}',
    '[data-theme="light"] .pvcf-num,[data-theme="light"] .pvcf-sel,[data-theme="light"] .pvcf-note{',
      'color:#0f172a;background:#fff;border-color:rgba(15,23,42,.16)}',
    '[data-theme="light"] .pvcf-voices{border-color:rgba(169,126,0,.28);background:rgba(245,200,66,.09)}'
  ].join('');

  function ensureStyle() {
    if (d.getElementById('pvc-style')) return;
    var s = d.createElement('style');
    s.id = 'pvc-style';
    s.textContent = CSS;
    (d.head || d.documentElement).appendChild(s);
  }

  var _bank = null;
  function loadBank() {
    if (_bank) return Promise.resolve(_bank);
    return fetch(BANK_URL, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.questions) return null;
        var by = {};
        j.questions.forEach(function (q) { by[q.id] = q; });
        _bank = { raw: j, byId: by, settings: j.settings || FALLBACK };
        return _bank;
      })
      .catch(function () { return null; });
  }

  /* 詳細ページへの導線。/en/ からは同じ階層の英語版を指す（相対で正しく解ける）。 */
  function detailHref(ctx) {
    var q = ctx && ctx.airline ? '?airline=' + encodeURIComponent(ctx.airline) : '';
    return 'airline-conditions.html' + q;
  }
  function moreLink(ctx) {
    if (!DETAIL_READY) return '';
    return '<a class="pvc-more" href="' + esc(detailHref(ctx)) + '" data-pvc-more>' + esc(T.more) + '</a>';
  }

  function payload(ctx, answers) {
    return {
      airline: ctx.airline,
      airline_other: ctx.airline_other || null,
      year: ctx.year, month: ctx.month,
      position: ctx.position || null,
      fleet: ctx.fleet || null,
      base_iata: ctx.base_iata || null,
      contract_type: ctx.contract_type || null,
      lang: L,
      answers: answers
    };
  }

  /* 会社コード → 表示名。airlines-meta.js（w.PV_AIRLINES）が読めていれば使う。
     読めていなければ社名なしの文言に落ちる（ctaTitle(null) がその形を持つ）。 */
  function airlineNameOf(code, other) {
    if (code === 'other') return other || '';
    var list = w.PV_AIRLINES, slug = w.PV_slugOf;
    if (!list || !list.length || typeof slug !== 'function') return '';
    for (var i = 0; i < list.length; i++) {
      if (slug(list[i]) === code) return (L === 'en' ? list[i].en : list[i].name) || '';
    }
    return '';
  }

  function labelOf(q, code) {
    var cs = q.choices || [];
    for (var i = 0; i < cs.length; i++) if (cs[i].code === code) return cs[i][L];
    return code;
  }

  /* ════════════════════════════════════════════════════════════
     モーダル。1つだけ。開いている間は背後をスクロールさせない。
     ════════════════════════════════════════════════════════════ */
  function Modal(ctx, items, trigger) {
    var self = this;
    this.ctx = ctx;
    this.items = items;          // [{ q（質問の実体）, mine_code（前回の答え） }]
    this.trigger = trigger;
    this.i = 0;
    this.answered = 0;
    this.closed = false;

    ensureStyle();
    this.prevFocus = d.activeElement;
    this.prevOverflow = d.body.style.overflow;

    var back = d.createElement('div');
    back.className = 'pvc-back';
    back.setAttribute('data-pvc', '1');
    back.innerHTML =
      '<div class="pvc-modal" role="dialog" aria-modal="true" aria-labelledby="pvc-eyebrow">' +
        '<button type="button" class="pvc-x" aria-label="' + esc(T.close) + '">&times;</button>' +
        (trigger === 'return_visit'
          /* 戻ってきた会員に聞く板。社名は見出しの中にあるので、下の1行は出さない */
          ? '<div class="pvc-eyebrow is-ask" id="pvc-eyebrow">' + lines(T.askHead(ctx.airlineName)) + '</div>'
          : '<div class="pvc-eyebrow" id="pvc-eyebrow">' + lines(T.eyebrow) + '</div>' +
            (ctx.airlineName ? '<div class="pvc-air">' + esc(ctx.airlineName) + '</div>' : '')) +
        '<div class="pvc-body" aria-live="polite"></div>' +
      '</div>';
    this.back = back;
    this.modal = back.querySelector('.pvc-modal');
    this.body = back.querySelector('.pvc-body');

    /* 閉じ方は3つ（× ・オーバーレイ・ESC）。どれでも同じところへ行く。
       強制モーダルにしない＝レポートを人質にしない。 */
    back.querySelector('.pvc-x').addEventListener('click', function () { self.close('close_button'); });
    back.addEventListener('mousedown', function (e) { if (e.target === back) self._downOnBack = true; });
    back.addEventListener('click', function (e) {
      if (e.target === back && self._downOnBack) self.close('overlay');
      self._downOnBack = false;
    });
    this.onKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); self.close('escape'); return; }
      if (e.key === 'Tab') self.trap(e);
    };
    d.addEventListener('keydown', this.onKey, true);

    d.body.appendChild(back);
    d.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { back.classList.add('is-in'); });
    this.step();
  }

  /* フォーカスをモーダルの中から出さない（背後のフォームへ Tab で抜けない） */
  Modal.prototype.trap = function (e) {
    var f = this.modal.querySelectorAll('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  Modal.prototype.evt = function (name, extra) {
    var it = this.items[this.i];
    var p = {
      trigger: (it && it.reconfirm) ? 'reconfirmation' : this.trigger,
      question_id: it ? it.q.id : null,
      question_number: this.i + 1,
      airline_code: this.ctx.airline
    };
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) p[k] = extra[k];
    track(name, p);
  };

  Modal.prototype.step = function () {
    var self = this;
    if (this.i >= this.items.length) return this.finish();
    var it = this.items[this.i];
    var q = it.q;

    /* 再確認：前回の答えを見せて「今も同じか」だけを聞く。
       ★「わからない」だった質問は普通に聞き直す（“以前わからないと回答しました”は意味がない）。 */
    it.reconfirm = !!(it.mine_code && it.mine_code !== UNKNOWN && !it.expanded);

    /* 形は3つ。給与の後の板・マイページの1問は「1つ選ぶ」だけ（fetchItems が選択肢の無い質問を外している）。
       数字と複数選ぶを描くのは、戻ってきた会員に聞く板（askReturn）だけ。 */
    var mode = it.reconfirm ? 'choice' : (q.kind === 'multi' || q.kind === 'num' ? q.kind : 'choice');

    var opts = it.reconfirm
      ? [{ code: '__same', label: T.same }, { code: '__changed', label: T.changed },
         { code: UNKNOWN, label: T.dunno }]
      : mode === 'num'
        ? [{ code: UNKNOWN, label: T.dunno }]
        : (q.choices || []).map(function (c) { return { code: c.code, label: c[L] }; });
    /* 複数選ぶ：「わからない」は他と一緒に選べない1つ（押したらすぐ保存）。選択肢に無ければ足す */
    if (mode === 'multi' && !opts.some(function (o) { return o.code === UNKNOWN; })) {
      opts.push({ code: UNKNOWN, label: T.dunno });
    }

    var head = it.reconfirm
      ? lines(T.again(labelOf(q, it.mine_code)))
      : esc(q[L].label);
    var helpText = (!it.reconfirm && q[L] && q[L].help) ? q[L].help : '';
    /* 複数選ぶ：説明が無い質問にだけ「全部選んでください」を添える（説明に同じことが書いてある質問で二重にしない） */
    if (mode === 'multi' && !helpText) helpText = T.multiHint;
    var help = helpText ? '<div class="pvc-help">' + esc(helpText) + '</div>' : '';
    var step = this.items.length > 1
      ? '<span class="pvc-step">' + esc(T.step(this.i + 1, this.items.length)) + '</span>' : '<span></span>';

    var optsHtml = '<div class="pvc-opts">' +
        opts.map(function (o) {
          var multi = mode === 'multi' && o.code !== UNKNOWN;
          return '<button type="button" class="pvc-opt" data-code="' + esc(o.code) + '"' +
                   (multi ? ' aria-pressed="false" data-multi="1"' : '') + '>' +
                   esc(o.label) + '</button>';
        }).join('') +
      '</div>';
    var numHtml = '';
    if (mode === 'num') {
      var nm = q.num || {};
      numHtml = '<div class="pvc-numrow">' +
          '<input type="number" class="pvcf-num pvc-num" inputmode="numeric"' +
            (nm.min != null ? ' min="' + esc(nm.min) + '"' : '') +
            (nm.max != null ? ' max="' + esc(nm.max) + '"' : '') +
            ' step="' + esc(nm.step || 1) + '" aria-label="' + esc(q[L].label) + '">' +
          (nm[L] ? '<span class="pvc-unit">' + esc(nm[L]) + '</span>' : '') +
          '<button type="button" class="pvc-btn" data-next disabled>' + esc(T.next) + '</button>' +
        '</div>';
    }
    var goHtml = mode === 'multi'
      ? '<div class="pvc-go"><button type="button" class="pvc-btn" data-next disabled>' + esc(T.next) + '</button></div>'
      : '';

    /* 続きの質問は、親の質問を小さく上に添える（2日後の板の1問目に来ても、何の続きか分かるように） */
    var ctxLine = (!it.reconfirm && it.parentLabel)
      ? '<div class="pvc-ctx">' + lines(T.followUp(it.parentLabel)) + '</div>' : '';

    this.body.innerHTML =
      ctxLine + '<div class="pvc-q">' + head + '</div>' + help + numHtml + optsHtml + goHtml +
      '<div class="pvc-foot">' + step +
        '<button type="button" class="pvc-skip">' + esc(T.skip) + '</button>' +
      '</div>';

    var btns = this.body.querySelectorAll('.pvc-opt');
    var next = this.body.querySelector('[data-next]');
    var input = this.body.querySelector('.pvc-num');
    var all = function () {
      var a = Array.prototype.slice.call(btns);
      if (next) a.push(next);
      if (input) a.push(input);
      return a;
    };
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        var code = b.getAttribute('data-code');
        if (b.getAttribute('data-multi')) {             // 複数選ぶ：押すたびに付け外し。保存は「次へ」
          var on = !b.classList.contains('is-picked');
          b.classList.toggle('is-picked', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          next.disabled = !self.body.querySelector('.pvc-opt.is-picked[data-multi]');
          return;
        }
        if (mode === 'choice') { self.pick(b, btns, code); return; }
        self.send({ code: code }, all(), b);               // 数字・複数選ぶの「わからない」
      });
    });
    if (mode === 'multi') {
      next.addEventListener('click', function () {
        var codes = Array.prototype.map.call(
          self.body.querySelectorAll('.pvc-opt.is-picked[data-multi]'),
          function (x) { return x.getAttribute('data-code'); });
        if (codes.length) self.send({ codes: codes }, all(), null);
      });
    }
    if (mode === 'num') {
      var nm2 = q.num || {};
      var read = function () {
        var t = String(input.value || '').trim();
        if (!t) return null;
        var v = Number(t);
        return isFinite(v) ? v : null;
      };
      var submit = function () {
        var v = read();
        if (v == null) return;
        var lo = nm2.min != null ? Number(nm2.min) : -Infinity;
        var hi = nm2.max != null ? Number(nm2.max) : Infinity;
        /* 範囲の外・刻みに合わない数は送らない（サーバも受け取らない）。何が違うかをその場に書く */
        var stepN = Number(nm2.step || 1);
        var offStep = stepN > 0 && Math.abs(v / stepN - Math.round(v / stepN)) > 1e-9;
        if (v < lo || v > hi || offStep) { self.warn(T.numBad(nm2.min, nm2.max)); input.focus(); return; }
        self.send({ num: v }, all(), null);
      };
      input.addEventListener('input', function () { next.disabled = read() == null; self.warn(null); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
      next.addEventListener('click', submit);
    }
    this.body.querySelector('.pvc-skip').addEventListener('click', function () { self.skip(); });

    /* 開いたことは1回だけ数える（1問ごとに数えると開封率が3倍に見える）。
       どの質問を出したかは question_number と question_id で追える。 */
    if (!this._shown) { this._shown = true; this.evt('condition_modal_shown'); }
    /* 1問目だけフォーカスを移す。2問目以降で毎回移すと、キーボードの人の
       読み位置が飛ぶ（aria-live が読み上げるので移す必要も無い）。
       数字の質問は欄へ（打ち始められるように）。 */
    if (this.i === 0) {
      if (input) input.focus();
      else if (btns[0]) btns[0].focus();
    }
  };

  /* 注意の1行を出す（null で消す）。保存の失敗と、数字の範囲の外で使う */
  Modal.prototype.warn = function (parts) {
    var old = this.body.querySelector('.pvc-warn');
    if (old) old.parentNode.removeChild(old);
    if (!parts) return;
    var el = d.createElement('div');
    el.className = 'pvc-warn';
    el.innerHTML = lines(parts);
    var foot = this.body.querySelector('.pvc-foot');
    this.body.insertBefore(el, foot || null);
  };

  /* 数字・複数選ぶ・その「わからない」を保存する（1つ選ぶは下の pick）。
     ★1問ごとに即保存する。保存できてから次へ進む。 */
  Modal.prototype.send = function (answer, els, btn) {
    var self = this;
    var it = this.items[this.i];
    var a = { question_id: it.q.id };
    for (var k in answer) if (answer.hasOwnProperty(k)) a[k] = answer[k];
    els.forEach(function (x) { x.disabled = true; });
    if (btn) btn.classList.add('is-picked');
    this.warn(null);
    this.ctx.sb.rpc('submit_airline_conditions', { p: payload(this.ctx, [a]) })
      .then(function (res) {
        if (res.error || !res.data || res.data.saved !== 1) throw new Error('not saved');
        self.answered++;
        self.evt(a.code === UNKNOWN ? 'condition_unknown' : 'condition_answered');
        self.advance();
      })
      .catch(function () {
        self.warn(T.failed);
        if (btn) btn.classList.remove('is-picked');
        els.forEach(function (x) { x.disabled = false; });
        /* 「次へ」は、押せる中身があるときだけ押せる形に戻す */
        var nx = self.body.querySelector('[data-next]');
        if (nx) {
          var inp = self.body.querySelector('.pvc-num');
          nx.disabled = inp ? !String(inp.value || '').trim()
                            : !self.body.querySelector('.pvc-opt.is-picked[data-multi]');
        }
      });
  };

  /* 答えが保存できたあと、次の1問へ。
     戻ってきた会員に聞く板（ctx.refill がある）だけ、残りをサーバに聞き直す ──
     いま「ある」と答えた制度の中身（子の質問）を、同じ板の中で続けて聞くため。
     聞き直せなくても、最初にもらった残りのまま進む（止めない）。 */
  Modal.prototype.advance = function () {
    var self = this;
    var go = function () { if (self.closed) return; self.i++; self.step(); };
    if (typeof this.ctx.refill !== 'function') { go(); return; }
    this.ctx.refill(this).then(go, go);
  };

  Modal.prototype.pick = function (btn, btns, code) {
    var self = this;
    var it = this.items[this.i];

    /* 「変わった」＝ここでは保存しない。同じ質問の本来の選択肢を出し直す */
    if (code === '__changed') {
      it.expanded = true;
      this.evt('condition_reconfirmed', { changed: true });
      this.step();
      return;
    }
    var save = (code === '__same') ? it.mine_code : code;

    Array.prototype.forEach.call(btns, function (x) { x.disabled = true; });
    btn.classList.add('is-picked');
    var warn = this.body.querySelector('.pvc-warn');
    if (warn) warn.parentNode.removeChild(warn);

    /* ★1問ごとに即保存する。まとめて送らない＝途中で閉じても答えた分は残る。 */
    this.ctx.sb.rpc('submit_airline_conditions',
      { p: payload(this.ctx, [{ question_id: it.q.id, code: save }]) })
      .then(function (res) {
        if (res.error || !res.data || res.data.saved !== 1) throw new Error('not saved');
        self.answered++;
        if (code === '__same') self.evt('condition_reconfirmed', { changed: false });
        self.evt(save === UNKNOWN ? 'condition_unknown' : 'condition_answered');
        self.advance();
      })
      .catch(function () {
        var el = d.createElement('div');
        el.className = 'pvc-warn';
        el.innerHTML = lines(T.failed);
        self.body.appendChild(el);
        btn.classList.remove('is-picked');
        Array.prototype.forEach.call(btns, function (x) { x.disabled = false; });
      });
  };

  /* 「今回はスキップ」＝この1問だけ飛ばして次へ進む（× は残り全部を終わらせる）。
     いつ飛ばしたかを DB に残す。残さないと次の提出でまた同じ質問が出る。 */
  Modal.prototype.skip = function (thenClose) {
    var it = this.items[this.i];
    this.evt('condition_skipped');
    try {
      this.ctx.sb.rpc('submit_airline_conditions',
        { p: payload(this.ctx, [{ question_id: it.q.id, skip: true }]) })
        .then(function () {}).catch(function () {});
    } catch (e) {}
    if (thenClose) return;
    this.i++;
    this.step();
  };

  Modal.prototype.finish = function () {
    var self = this;
    /* ★「…の待遇情報が更新されました」と言うのは、保存できた答えが1つでも在るときだけ。
         全部スキップした人にも出していた（1問も足していないのに、足したと言っていた）。
         そのときは1行目（お礼）だけを出す。板を出す長さも閉じ方も変えない。 */
    this.body.innerHTML =
      '<div class="pvc-done">' + lines(T.thanks(this.ctx.airlineName).slice(0, this.answered ? undefined : 1)) + '</div>' +
      moreLink(this.ctx);
    var more = this.body.querySelector('[data-pvc-more]');
    if (more) more.addEventListener('click', function () { self.evt('condition_detail_clicked'); });
    /* 3問終わったら4問目を出さない。読める間だけ置いて、静かに閉じる。 */
    if (this.answered >= this.items.length && this.trigger === 'first_salary') {
      track('condition_first_flow_completed',
        { trigger: this.trigger, airline_code: this.ctx.airline, question_number: this.items.length });
    }
    this.doneTimer = w.setTimeout(function () { self.close('completed'); }, 2600);
  };

  Modal.prototype.close = function (how) {
    var self = this;
    if (this.closed) return;
    this.closed = true;
    /* × で閉じたときは、いま出していた1問だけスキップとして残す。
       見せた質問に「今は答えたくない」が返ってきたのは事実なので、翌月また出さない。
       見せていない残りには何も残さない（意思表示が無いものを勝手に記録しない）。 */
    if ((how === 'close_button' || how === 'overlay' || how === 'escape')
        && this.i < this.items.length) this.skip(true);
    track('condition_modal_closed', {
      trigger: this.trigger, airline_code: this.ctx.airline,
      question_number: this.i + 1, how: how
    });
    if (this.doneTimer) w.clearTimeout(this.doneTimer);
    d.removeEventListener('keydown', this.onKey, true);
    d.body.style.overflow = this.prevOverflow || '';
    this.back.classList.remove('is-in');
    w.setTimeout(function () {
      if (self.back.parentNode) self.back.parentNode.removeChild(self.back);
      try { if (self.prevFocus && self.prevFocus.focus) self.prevFocus.focus(); } catch (e) {}
    }, 320);
  };

  /* ════════════════════════════════════════════════════════════
     出す側
     ════════════════════════════════════════════════════════════ */

  /* 次の質問を取り、実体（選択肢つき）に直して返す。
     出せない理由はすべて null で返す＝呼んだ側は何もしない。 */
  function fetchItems(ctx, want) {
    return ctx.sb.rpc('next_condition_questions',
      { p: { airline: ctx.airline, airline_other: ctx.airline_other || null,
             micro: true, limit: Math.max(want, 1) } })
      .then(function (res) {
        if (res.error || !res.data) return null;                 // 未ログイン／未適用
        var qs = res.data.questions || [];
        if (!qs.length) return null;                             // 聞くことが無い人には出さない
        return loadBank().then(function (bank) {
          if (!bank) return null;
          var out = [];
          for (var i = 0; i < qs.length && out.length < want; i++) {
            var q = bank.byId[qs[i].id];
            /* 選択肢が無い質問（数値・自由記述）はモーダルに出さない。
               DB 側の micro でも弾いているが、画面側でももう一度確かめる。 */
            if (!q || !q.choices || !q.choices.length) continue;
            out.push({ q: q, mine_code: qs[i].mine_code || null });
          }
          return out.length ? { items: out, mine_count: res.data.mine_count || 0, bank: bank } : null;
        });
      })
      .catch(function () { return null; });
  }

  /* 給与レポートが出たあとに呼ぶ。ここが唯一の入口。
     ★保存・レポート・アカウント作成のどれも止めない。失敗しても黙って何もしない。 */
  function afterReport(ctx) {
    try {
      if (!ctx || !ctx.sb || !ctx.airline) return;
      if (d.querySelector('[data-pvc]')) return;                 // 二重に開かない
      loadBank().then(function (bank) {
        var s = (bank && bank.settings) || FALLBACK;
        var init = s.initial_limit || FALLBACK.initial_limit;
        return fetchItems(ctx, init).then(function (got) {
          if (!got) return;
          /* まだ3問未満なら残りを埋める。3問以上答えている人には1問だけ。
             「初めての給与提出か」では分けない（会社を変えた人がまた3問に戻る）。 */
          var want = got.mine_count < init
            ? Math.max(init - got.mine_count, 1)
            : (s.recurring_limit || FALLBACK.recurring_limit);
          var items = got.items.slice(0, want);
          if (!items.length) return;
          var trigger = got.mine_count < init ? 'first_salary' : 'recurring_salary';
          var delay = s.modal_delay_ms == null ? FALLBACK.modal_delay_ms : s.modal_delay_ms;
          /* レポートを読む時間を先に渡す。0 だと結果の上にすぐ被さる。 */
          w.setTimeout(function () {
            if (d.querySelector('[data-pvc]')) return;
            new Modal(ctx, items, trigger);
          }, delay);
        });
      }).catch(function () {});
    } catch (e) {}
  }

  /* ════════════════════════════════════════════════════════════
     戻ってきた会員に聞く板「〇〇のこと、ひとつ教えて。」（2026-10-30 オーナー指示）
     ════════════════════════════════════════════════════════════
     呼ぶのは pv-session.js の askLoad だけ（全ページ。出してよいかの判定は向こう）。
     ★誰に・どの会社・どの質問・どの順・2日に1回かは、全部サーバ（db/ask-own-airline.sql の pv_ask_next）。
       ここは描くだけ。給与か口コミを出した会員にしか、サーバは質問を返さない。
     ★板を開いたら pv_ask_seen を1回呼ぶ（次に聞いてよいのは48時間後）。開けなかった回は呼ばない。
     o.rpc(name, args) → Promise<data>（失敗は reject）。pv-session.js の PVSession.rpc を渡す。
     返すのは Promise<{ shown, why?, next_at? }>（呼んだ側が、次にこの端末で聞きに行く時刻を決める）。
       why … 'login' 'blocked' 'none' 'wait' 'done'（サーバの答え）／ 'busy'（ほかの板が開いている）／ 'fail' */
  function askReturn(o) {
    var no = function (why, next) { return { shown: false, why: why, next_at: next || null }; };
    try {
      if (!o || typeof o.rpc !== 'function') return Promise.resolve(no('fail'));
      /* ほかの板（パイロット確認・Give & Get・情報を追加）が開いていたら重ねない。次のページでもう一度 */
      /* 数えるのは画面に見えている板だけ（「情報を追加」のシートは閉じていても DOM に残る） */
      var busy = function () {
        if (d.querySelector('[data-pvc]')) return true;
        if (w.PVContrib && typeof w.PVContrib.isOpen === 'function' && w.PVContrib.isOpen()) return true;
        return Array.prototype.some.call(d.querySelectorAll('[aria-modal="true"]'), function (el) {
          return el.getClientRects().length > 0;
        });
      };
      if (busy()) return Promise.resolve(no('busy'));
      var call = function (name, args) {
        return Promise.resolve().then(function () { return o.rpc(name, args); })
          .then(function (data) { return { data: data }; }, function (e) { return { error: e || true }; });
      };
      return loadBank().then(function (bank) {
        if (!bank) return no('fail');
        var lim = (bank.settings && bank.settings.ask_limit) || 3;
        var toItems = function (qs, want) {
          var out = [];
          for (var i = 0; i < (qs || []).length && out.length < want; i++) {
            var q = bank.byId[qs[i].id];
            if (!q || q.currency) continue;
            if ((q.kind === 'choice' || q.kind === 'multi') && !(q.choices && q.choices.length)) continue;
            if (q.kind === 'num' && !q.num) continue;
            if (q.kind !== 'choice' && q.kind !== 'multi' && q.kind !== 'num') continue;
            var par = q.parent && bank.byId[q.parent];
            out.push({ q: q, mine_code: q.kind === 'choice' ? (qs[i].mine_code || null) : null,
                       parentLabel: par && par[L] ? par[L].label : '' });
          }
          return out;
        };
        return call('pv_ask_next', { p: { limit: lim } }).then(function (res) {
          var g = res.data;
          if (res.error || !g || !g.ok) return no('fail');
          if (!g.due) return no(g.why || 'wait', g.next_at);
          var items = toItems(g.questions, lim);
          if (!items.length) return no('done');
          if (busy()) return no('busy');
          var name = airlineNameOf(g.airline, null) || (L === 'en' ? g.name_en : g.name_ja) || '';
          var ctx = {
            sb: { rpc: call },
            airline: g.airline, airline_other: null, airlineName: name,
            /* 年と月は送らない ＝ サーバが今日の日付で埋める（端末の時計に頼らない） */
            year: null, month: null,
            /* 1問答えるたびに、残りを聞き直す（子の質問を同じ板で続けて聞く） */
            refill: function (m) {
              var need = lim - (m.i + 1);
              if (need <= 0) return Promise.resolve();
              var shown = m.items.slice(0, m.i + 1).map(function (x) { return x.q.id; });
              return call('pv_ask_next', { p: { cont: true, limit: need, not: shown } }).then(function (r) {
                var n = r.data;
                if (r.error || !n || !n.ok) return;                 // 聞き直せない ＝ 最初の残りのまま
                var more = n.due ? toItems(n.questions, need) : [];
                m.items = m.items.slice(0, m.i + 1).concat(more);   // 聞くことが尽きたら、ここで終わる
              });
            }
          };
          new Modal(ctx, items, 'return_visit');
          return call('pv_ask_seen', {}).then(function (r) {
            return { shown: true, next_at: (r.data && r.data.next_at) || null };
          });
        });
      }).catch(function () { return no('fail'); });
    } catch (e) { return Promise.resolve(no('fail')); }
  }

  /* マイページの二次導線から。押されたときだけ1問開く（勝手には出さない）。 */
  function openOne(ctx) {
    try {
      if (!ctx || !ctx.sb || !ctx.airline) return;
      if (d.querySelector('[data-pvc]')) return;
      loadBank().then(function (bank) {
        var s = (bank && bank.settings) || FALLBACK;
        var want = s.profile_limit || FALLBACK.profile_limit;
        return fetchItems(ctx, want).then(function (got) {
          if (!got) return;
          track('condition_secondary_prompt_opened',
            { trigger: 'profile_secondary', airline_code: ctx.airline });
          new Modal(ctx, got.items.slice(0, want), 'profile_secondary');
        });
      }).catch(function () {});
    } catch (e) {}
  }

  /* マイページ（profile.html）の二次導線。
     ★ここで質問を出しっぱなしにしない。押されるまで何も開かない。
     会社は「その人が自分で出した給与レポート」から引く（my_pay_reports）。
     マイページの『在籍企業』は自由記述で会社コードにならないので使えない。
     ＝給与をまだ1件も出していない人には、このカードごと出ない。これは正しい：
       待遇の回答は proof_hash が要り、それは会社コードが決まって初めて作れる。
     ★聞くことが無い人にも出さない（押しても何も開かないボタンを置かない）。 */
  function secondaryCTA(el, ctx) {
    try {
      if (!el || !ctx || !ctx.sb) return Promise.resolve(false);
      if (el.querySelector('[data-pvc-cta]')) return Promise.resolve(false);
      /* ★問い合わせは pv-reunlock.js のキャッシュを通す。直に rpc を投げない。
           MY PAGE では ①②③④とここが同じ答えを見ている（2026-09-06 の統合）。
           キャッシュが無い画面のために、素の rpc へ落ちる道は残す。
         ★戻り値は「入口を出したか」。② NEXT ACTION がこれを待って順位を決める
           （出していないのに「1問だけ答える」と書かないため）。 */
      var ask = (typeof w.pvMyPayReports === 'function')
        ? w.pvMyPayReports(ctx.sb).then(function (data) { return { data: data }; })
        : ctx.sb.rpc('my_pay_reports');
      return ask
        .then(function (res) {
          if (!res || res.error || !res.data) return false;       // 関数がまだ本番に無い等
          var rows = res.data.reports || [];
          if (!rows.length) return false;
          var last = rows[rows.length - 1];                       // period_ym の昇順で返る
          if (!last || !last.airline) return false;
          var c = {
            sb: ctx.sb,
            airline: last.airline,
            airline_other: last.airline_other || null,
            airlineName: airlineNameOf(last.airline, last.airline_other),
            year: last.period_year, month: last.period_month,
            position: last.position, fleet: last.fleet,
            base_iata: last.base_iata, contract_type: last.contract_type
          };
          return fetchItems(c, 1).then(function (got) {
            if (!got) return false;                               // 聞くことが無い
            ensureStyle();
            var box = d.createElement('div');
            box.className = (ctx.cardClass || 'glass') + ' pvc-cta';
            box.setAttribute('data-pvc-cta', '1');
            box.innerHTML =
              '<div class="pvc-cta-t">' + esc(T.ctaTitle(c.airlineName)) + '</div>' +
              '<div class="pvc-cta-s">' + lines(T.ctaSub) + '</div>' +
              '<div class="pvc-cta-b">' +
                '<button type="button" class="pvc-btn">' + esc(T.ctaBtn) + '</button>' +
                moreLink(c) +
              '</div>';
            el.appendChild(box);
            box.querySelector('.pvc-btn').addEventListener('click', function () { openOne(c); });
            var more = box.querySelector('[data-pvc-more]');
            if (more) more.addEventListener('click', function () {
              track('condition_detail_clicked',
                { trigger: 'profile_secondary', airline_code: c.airline });
            });
            return true;                                          // 入口を出した
          });
        })
        .catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  /* ════════════════════════════════════════════════════════════
     詳細ページ（airline-conditions.html）。全部の質問を節ごとに並べる。
     ★「◯% 完成」の進捗は出さない。埋めさせる圧力＝推測で埋める動機になる。
       出すのは「あなたが答えた項目：7／全問数」という事実だけ。
     ★親に答えていない子の質問は、そもそも画面に出さない
       （サーバも parent_missing で弾くので、出しても保存できない）。
       親にも親があるときは、いちばん上まで条件が続いているときだけ出す（renderFull の visible）。
     ★ ?airline=<コード>&q=<質問の鍵> で、その質問まで直接来られる（2026-10-04）。
       会社の概要などで「まだ分からない」と出した項目から、答える場所へ1回で運ぶため。
       q が無い・知らない鍵のときは何もしない＝今までどおり先頭の節が開くだけ。
     ════════════════════════════════════════════════════════════ */

  /* ?q= の鍵。質問の一覧に在るものだけを通す。
     ★通した値はそのまま属性セレクタに入れるので、ここで必ず一覧と突き合わせる
       （一覧の鍵は英小文字・数字・_ だけと gen-conditions.mjs が検品している）。 */
  function wantedQuestion(byId) {
    var id = '';
    try { id = new URL(w.location.href).searchParams.get('q') || ''; } catch (e) {}
    return Object.prototype.hasOwnProperty.call(byId, id) ? id : '';
  }

  var _vocab = null;
  function loadVocab() {
    if (_vocab) return Promise.resolve(_vocab);
    return fetch(VOCAB_URL, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { _vocab = j || {}; return _vocab; })
      .catch(function () { _vocab = {}; return _vocab; });
  }

  /* この人の会社を決める。?airline= が最優先、次に本人の最新の給与レポート。
     どちらも無ければ null を返し、画面が会社を選ばせる。 */
  function resolveAirline(sb, opts) {
    var wanted = opts.airline || '';
    if (!wanted) {
      try { wanted = new URL(w.location.href).searchParams.get('airline') || ''; } catch (e) {}
    }
    return sb.rpc('my_pay_reports')
      .then(function (res) {
        var rows = (res && !res.error && res.data && res.data.reports) || [];
        var last = rows.length ? rows[rows.length - 1] : null;
        /* 給与を出している会社なら、そのときの文脈（機種・Base・契約）も一緒に持つ。
           回答が割れた理由を後から説明するために保存する列で、公開の粒度には出さない。 */
        if (last && (!wanted || wanted === last.airline)) {
          return {
            airline: last.airline, airline_other: last.airline_other || null,
            airlineName: airlineNameOf(last.airline, last.airline_other),
            position: last.position, fleet: last.fleet,
            base_iata: last.base_iata, contract_type: last.contract_type
          };
        }
        if (wanted && airlineNameOf(wanted, null)) {
          return { airline: wanted, airline_other: null, airlineName: airlineNameOf(wanted, null) };
        }
        return null;
      })
      .catch(function () { return null; });
  }

  /* 会社が決まっていない人に選ばせる。ここで決まらないと1問も保存できない
     （待遇は会社ごとに違い、proof_hash も会社コードから作るため）。 */
  function pickAirline(el, sb, bank) {
    var list = (w.PV_AIRLINES || []).slice();
    var slug = w.PV_slugOf;
    var opts = '';
    if (typeof slug === 'function') {
      list.sort(function (a, b) {
        var x = (L === 'en' ? a.en : a.name) || '', y = (L === 'en' ? b.en : b.name) || '';
        return x < y ? -1 : x > y ? 1 : 0;
      });
      opts = list.map(function (a) {
        return '<option value="' + esc(slug(a)) + '">' + esc((L === 'en' ? a.en : a.name) || '') + '</option>';
      }).join('');
    }
    el.innerHTML =
      '<div class="pvcf-head"><h1 class="pvcf-t">' + esc(T.fullTitle) + '</h1></div>' +
      '<div class="pvcf-lead">' + lines(T.fullPickHelp) + '</div>' +
      '<div class="pvcf-pick">' +
        '<select class="pvcf-sel" id="pvcf-air" aria-label="' + esc(T.fullPick) + '">' +
          '<option value="">' + esc(T.fullPick) + '</option>' + opts +
          '<option value="other">' + esc(T.fullOther) + '</option>' +
        '</select>' +
        '<div class="pvcf-row" id="pvcf-other" hidden>' +
          '<input class="pvcf-num" id="pvcf-othertxt" type="text" maxlength="60" ' +
                 'placeholder="' + esc(T.fullOtherPh) + '" aria-label="' + esc(T.fullOtherPh) + '"/>' +
        '</div>' +
        '<div class="pvcf-row">' +
          '<button type="button" class="pvc-btn" id="pvcf-go" disabled>' + esc(T.fullGo) + '</button>' +
        '</div>' +
      '</div>';

    var sel = el.querySelector('#pvcf-air');
    var box = el.querySelector('#pvcf-other');
    var txt = el.querySelector('#pvcf-othertxt');
    var go  = el.querySelector('#pvcf-go');
    function sync() {
      var v = sel.value;
      box.hidden = v !== 'other';
      go.disabled = !v || (v === 'other' && !txt.value.trim());
    }
    sel.addEventListener('change', sync);
    txt.addEventListener('input', sync);
    go.addEventListener('click', function () {
      var v = sel.value;
      var other = v === 'other' ? txt.value.trim() : null;
      renderFull(el, sb, {
        airline: v, airline_other: other,
        airlineName: v === 'other' ? other : airlineNameOf(v, null)
      }, bank);
    });
  }

  /* 口コミへの導線。会社の「事実」でないもの（雰囲気・Management・訓練の文化・
     Work-Life Balance）は待遇DBに同じ物差しを作らず、口コミ側に集める。
     同じ人が両方に違う点を付けたとき、どちらを出すか決められなくなるため。 */
  function voicesCard() {
    var href = 'submit-review.html';
    return '<div class="pvcf-voices">' +
      '<div class="pvcf-voices-t">' + esc(T.voicesTitle) + '</div>' +
      '<div class="pvcf-voices-s">' + lines(T.voicesBody) + '</div>' +
      '<a class="pvc-more" href="' + esc(href) + '" data-pvcf-voices>' + esc(T.voicesLink) + '</a>' +
      '</div>';
  }

  /* 読み込みそのものが失敗したときの最後の砦。骨組みのまま黙って止めない。
     ★モーダル（afterReport）には出さない。あちらは「黙って出ない」が正しい振る舞いで、
       給与レポートの邪魔をしない約束のほうが優先する。 */
  function showDead(el) {
    if (!el || el.querySelector('[data-pvcf-dead]')) return;
    ensureStyle();
    el.innerHTML = '<div class="pvcf-voices" data-pvcf-dead>' +
      '<div class="pvcf-voices-t">' + esc(T.fullDeadTitle) + '</div>' +
      '<div class="pvcf-voices-s">' + lines(T.fullDead) + '</div>' +
      '<button type="button" class="pvc-more" data-pvcf-retry>' + esc(T.fullRetry) + '</button>' +
      '</div>';
    var b = el.querySelector('[data-pvcf-retry]');
    if (b) b.addEventListener('click', function () { w.location.reload(); });
  }

  function renderFull(el, sb, ctx, bank) {
    var secs = bank.raw.sections || [];
    var byId = bank.byId;
    /* ★話題の入口から来た人にだけ出す質問（topicOnly）は、この一覧に混ぜない（2026-10-04 オーナー決定）。
         混ぜると「答えた項目：◯／全問数」の分母が増え、1問あたりの回答も薄まる。
         ?q= がその1問を名指ししているとき ＝ 話題の入口から来た人にだけ、同じ話題の分を一緒に出す
         （出さないと、入口を押した先に目当ての質問が無い）。 */
    var cameFor = byId[wantedQuestion(byId)];
    var cameTopic = cameFor && cameFor.topicOnly ? cameFor.topic : '';
    var qs = (bank.raw.questions || []).filter(function (q) {
      return !q.topicOnly || (!!cameTopic && q.topic === cameTopic);
    });
    var state = {};     // question_id → { code, codes, num, currency, text }

    /* 金額の質問があるときだけ通貨の一覧を読む（training_bond_amount と、着陸手当の額の3問） */
    var needCur = qs.some(function (q) { return q.currency; });

    Promise.all([
      /* ★ sb.rpc(...) が返すのは Promise ではなく then だけを持つ箱（supabase-js の作り）。
         .catch を直に付けると TypeError になり、mountFull の catch が黙って飲み込むので、
         画面は読み込み中の骨組みのまま止まる（2026-08-19 に本番で発生）。
         Promise.resolve で包むと本物の Promise になり、はじめて .catch が使える。 */
      Promise.resolve(sb.rpc('my_airline_conditions',
        { p: { airline: ctx.airline, airline_other: ctx.airline_other || null } }))
        .catch(function () { return { error: true }; }),
      needCur ? loadVocab() : Promise.resolve({})
    ]).then(function (r) {
      var res = r[0];
      /* ★読めなかったときは描かない。描くと「あなたが答えた項目：0／全問数」と出て、前の答えが在る人にも
           全部が「まだ答えていない」形で並ぶ（読めなかった ≠ 0）。本当に1つも答えていない人には、
           サーバが空の一覧（answers: []）を返す ＝ それは読めているので、今までどおり 0 で描く。 */
      if (!res || res.error || !res.data || !Array.isArray(res.data.answers)) { showDead(el); return; }
      if (res && !res.error && res.data && res.data.answers) {
        res.data.answers.forEach(function (a) {
          state[a.question_id] = {
            code: a.code, codes: a.codes || null, num: a.num,
            currency: a.currency, text: a.text
          };
        });
      }
      draw();
    }).catch(function () { showDead(el); });

    function answered(id) {
      var v = state[id];
      if (!v) return false;
      return !!(v.code || (v.codes && v.codes.length) || v.num != null || v.text);
    }
    /* ★親にも親がある（staff_travel → staff_travel_booking → 券の種類ごとの4問）。
         出すのは、**いちばん上の親まで**条件が続いているときだけ。
         すぐ上の親だけを見ると、いちばん上を「ない」に答え直したとき、あいだの親は
         隠れるのに、その下だけが古い答えを持ったまま画面に残る
         （サーバも同じ決め方で受け取る・数える ＝ db/airline-conditions.sql の 4b）。
         state の古い答えは消さない。親を答え直せば、前の答えのまま戻ってくる。 */
    function visible(q) {
      if (!q.parent) return true;
      var p = byId[q.parent];
      if (!p || !visible(p)) return false;
      var v = state[q.parent];
      if (!v) return false;
      var have = v.codes && v.codes.length ? v.codes : (v.code ? [v.code] : []);
      return q.parentWhen.some(function (c) { return have.indexOf(c) >= 0; });
    }
    /* 「答えた項目」に数えるのは、いま画面に出ている質問の答えだけ。
       親を答え直して隠れた質問の古い答えを数え続けると、見えている数と合わなくなる。 */
    function counted(q) { return answered(q.id) && visible(q); }

    /* ── ?q=<鍵> で来た人を、その質問まで運ぶ ──────────────────────
       ★子の質問は、親に答えるまで画面に無い。そのときは**親の行**へ運ぶ
         （隠れた行を無理に出しても、サーバが parent_missing で弾く）。
         親に答えて子が出たら、印を子へ移して運び直す。
       ★親が2段のときは、**いちばん上の答えていない親**へ運び、答えるたびに1段ずつ下りる。
         あいだの親の答えが条件から外れたら、その親に印を残して止まる
         （例: 空席待ちの券の回数を目当てに来た人が「座席を確保できる」と答えた）。
       ★目当ての質問に答えたら印を外す（want を空にする）。
         答えたあとも色が残ると「まだ何か足りない」と読める。 */
    var want = wantedQuestion(byId);
    function targetRow() {
      var q = byId[want];
      while (q && !visible(q)) q = byId[q.parent];
      return q ? el.querySelector('[data-qid="' + q.id + '"]') : null;
    }
    function mark(arrive) {
      var old = el.querySelector('.pvcf-q.is-target');
      var row = want ? targetRow() : null;
      if (old && old !== row) { old.classList.remove('is-target'); old.removeAttribute('tabindex'); }
      if (!row || row === old) return;
      row.classList.add('is-target');
      /* 2つ目より後の節は閉じて出る。閉じたままだと、運んだ先に何も見えない */
      var sec = row.parentNode;
      while (sec && sec !== el && sec.tagName !== 'DETAILS') sec = sec.parentNode;
      if (sec && sec.tagName === 'DETAILS') sec.open = true;
      /* キーボードで来た人の次の Tab が、この行の選択肢から始まるようにする */
      row.setAttribute('tabindex', '-1');
      try { row.focus({ preventScroll: true }); } catch (e) {}
      /* 着いたとき（arrive）は必ず画面のまんなかへ。答えたあとで印が移ったときは、
         もう見えているなら動かさない（押した直後に画面が勝手に動くと行き先を見失う）。 */
      var box = row.getBoundingClientRect();
      var vh = w.innerHeight || d.documentElement.clientHeight || 0;
      if (!arrive && box.top >= 0 && box.bottom <= vh) return;
      var calm = false;
      try { calm = w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
      try { row.scrollIntoView({ block: 'center', behavior: (arrive || calm) ? 'auto' : 'smooth' }); }
      catch (e) { try { row.scrollIntoView(); } catch (e2) {} }
    }

    /* ── 対になる額（低いほう・高いほう）──────────────────────────
       どの2問が対かは、質問の一覧（pv-conditions.json）の rangeLow の1か所 ── 高いほうの質問が、低いほうの鍵を持つ。
       2つは別々の質問・別々の行だが、2つで1つの幅。食い違う2つ（低いほうが大きい・通貨が違う）は保存しない。
       サーバも同じ決め方で断る（db/airline-conditions.sql の 4d）。ここは、送る前に本人へ言うための写し。 */
    var pairs = {};     // question_id → { low: 低いほうの鍵, high: 高いほうの鍵 }
    (bank.raw.questions || []).forEach(function (q) {
      if (!q.rangeLow || !byId[q.rangeLow]) return;
      pairs[q.id] = pairs[q.rangeLow] = { low: q.rangeLow, high: q.id };
    });
    function mateOf(q) {
      var p = pairs[q.id];
      return p ? byId[p.low === q.id ? p.high : p.low] : null;
    }
    /* 額1つぶん { num, cur, raw }。額が無いとき（空・「わからない」・数として読めない）は null。
       ★無い額を 0 と読まない（Number(null) も Number('') も 0 になる）。 */
    function amount(num, cur) {
      if (num == null || num === '') return null;
      var n = Number(num);
      return isFinite(n) ? { num: n, cur: cur || '', raw: String(num) } : null;
    }
    /* その質問について保存してある額（この人の答えとして、このページが読んだもの・保存できたもの） */
    function storedOf(q) {
      var v = state[q.id] || {};
      return amount(v.num, v.currency);
    }
    /* その質問の行に、いま入っている額。額と通貨がそろっているときだけ返す */
    function typedOf(q) {
      var row = el.querySelector('[data-qid="' + q.id + '"]');
      var n = row && row.querySelector('.pvcf-num'), c = row && row.querySelector('[data-cur]');
      if (!n || (q.currency && !(c && c.value))) return null;
      return amount(n.value.trim(), c ? c.value : '');
    }
    /* 食い違いの理由（'' ＝ 食い違っていない）。名前はサーバの理由と同じ。
       ★どちらかの額が無ければ比べない（片方だけは、いつでもよい）。
       ★通貨が先・大小があと（通貨の違う額どうしの大小は、意味を持たない）。同じ額はよい。
       ★数として比べる（字のまま比べると、200 は 1000 より大きい）。 */
    function judge(low, high) {
      if (!low || !high) return '';
      if (low.cur && high.cur && low.cur !== high.cur) return 'range_currency';
      return low.num > high.num ? 'range_order' : '';
    }
    /* この質問の額 a と、相手の額 b を、低いほう・高いほうの順に直して比べる */
    function clash(q, a, b) {
      return pairs[q.id].low === q.id ? judge(a, b) : judge(b, a);
    }
    /* 理由 → その行に出す文。対の2つの理由のほかは ''（＝ 今までどおりの「保存できませんでした」） */
    function whyText(reason) {
      return reason === 'range_order' ? T.fullRangeOrder : reason === 'range_currency' ? T.fullRangeCur : '';
    }
    /* 理由 → 直す欄（'num' ＝ 額の欄／'cur' ＝ 通貨の欄）。対の2つの理由のほかは ''（どの欄とも言えない） */
    function whyAt(reason) {
      return reason === 'range_order' ? 'num' : reason === 'range_currency' ? 'cur' : '';
    }
    var inPair = {};    // 2問ぶんを1回で送って、返事を待っている質問
    /* 対の相手の通貨を借りる（高いほうの行が、低いほうで保存した通貨から始まる。逆も同じ）。
       借りるのは、この質問にまだ通貨が無いあいだだけ ── 保存した通貨が在る・本人が通貨を選んだ、のどちらかなら触らない。
       借りた通貨は選んだ形になっているだけで、「入力する」を押すまで何も保存しない。 */
    var lent = {};      // question_id → その行の通貨の欄に出ているのは、相手から借りた通貨（本人は選んでいない）
    function lendable(q) {
      var m = mateOf(q);
      return m ? ((state[m.id] || {}).currency || '') : '';
    }
    /* 相手が保存できたあとで呼ぶ。この質問にまだ通貨が無ければ、相手の通貨に合わせる。
         通貨の欄が空                 … 相手の通貨を入れる
         借りた通貨が出ている         … 相手の通貨に付いていく。ただし、もう額を打ってあるなら動かさない
                                        （打った額の横の通貨を黙って変えると、額の意味が変わる）
         本人が選んだ通貨が出ている   … 触らない */
    function lend(q) {
      var cur = lendable(q);
      if (!cur || !q.currency || (state[q.id] || {}).currency) return;
      var row = el.querySelector('[data-qid="' + q.id + '"]');
      var sel = row && row.querySelector('[data-cur]'), num = row && row.querySelector('.pvcf-num');
      if (!sel) return;
      if (sel.value !== '') {
        if (!lent[q.id]) return;
        if (num && num.value.trim() !== '') return;
      }
      sel.value = cur;
      lent[q.id] = sel.value === cur;
    }

    /* ★先頭は空の選択肢（「通貨を選ぶ」）。これが無いと、何も選んでいない人の額に
         一覧のいちばん上の通貨が黙って付いて保存される（2026-10-09 まで、そうなっていた）。 */
    function curOptions(sel) {
      var list = (_vocab && _vocab.currencies) || [];
      return '<option value=""' + (sel ? '' : ' selected') + '>' + esc(T.fullCurPick) + '</option>' +
             list.map(function (c) {
        return '<option value="' + esc(c.code) + '"' + (c.code === sel ? ' selected' : '') + '>' +
               esc(c.code + ' — ' + (c[L] || '')) + '</option>';
      }).join('');
    }

    /* 1問ぶんの見た目。kind ごとに出すものが違う。
       数値と複数選択には「わからない」が選択肢に無いので、こちらで足す
       （SSOT の choice には最初から入っている）。 */
    function qHtml(q) {
      var v = state[q.id] || {};
      var body = '';
      if (q.kind === 'choice' || q.kind === 'multi') {
        var picked = q.kind === 'multi' ? (v.codes || []) : (v.code ? [v.code] : []);
        body += '<div class="pvcf-row">' + (q.choices || []).map(function (c) {
          var on = picked.indexOf(c.code) >= 0;
          return '<button type="button" class="pvc-opt' + (on ? ' is-picked' : '') + '"' +
                 ' data-code="' + esc(c.code) + '"' +
                 ' aria-pressed="' + (on ? 'true' : 'false') + '">' + dotParts(c[L]) + '</button>';
        }).join('');
        if (q.kind === 'multi') {
          var unk = v.code === UNKNOWN;
          body += '<button type="button" class="pvc-opt' + (unk ? ' is-picked' : '') + '"' +
                  ' data-code="' + UNKNOWN + '" aria-pressed="' + (unk ? 'true' : 'false') + '">' +
                  esc(T.dunno) + '</button>';
        }
        body += '</div>';
      } else if (q.kind === 'num') {
        var n = q.num || {};
        /* 並びは、会社ページの上の面と同じ ── 通貨 → 額 → 単位（通貨の無い質問は、額 → 単位）。
           額の欄と単位は1つの塊（.pvcf-amt）で、あいだでは折り返さない。
           ★対になる額で、この質問にまだ通貨が無い（保存していない）ときは、相手の保存した通貨を選んだ形で出す。
             選んだ形にするだけで、「入力する」を押すまで何も保存しない（lent ＝ 本人が選んだ通貨ではない印）。 */
        var mine = v.currency || '';
        var from = (!mine && q.currency) ? lendable(q) : '';
        lent[q.id] = !!from;
        body += '<div class="pvcf-row">' +
          (q.currency
            ? '<select class="pvcf-sel" data-cur aria-label="' + esc(T.fullCur) + '">' +
                curOptions(mine || from) + '</select>'
            : '') +
          '<span class="pvcf-amt">' +
            '<input class="pvcf-num" type="number" inputmode="decimal"' +
              ' min="' + esc(n.min) + '" max="' + esc(n.max) + '" step="' + esc(n.step || 1) + '"' +
              ' value="' + esc(v.num == null ? '' : v.num) + '"' +
              ' aria-label="' + esc(q[L].label) + '"/>' +
            (n[L] ? '<span class="pvcf-unit">' + esc(n[L]) + '</span>' : '') +
          '</span>' +
          '<button type="button" class="pvc-opt" data-num>' + esc(T.fullNum) + '</button>' +
          '<button type="button" class="pvc-opt' + (v.code === UNKNOWN ? ' is-picked' : '') + '"' +
            ' data-code="' + UNKNOWN + '">' + esc(T.dunno) + '</button>' +
          '</div>';
      }
      if (q.note) {
        body += '<label class="pvcf-notelab" for="pvcf-n-' + esc(q.id) + '">' + esc(T.fullNote) + '</label>' +
          '<textarea class="pvcf-note" id="pvcf-n-' + esc(q.id) + '" maxlength="' +
            esc((bank.raw.limits && bank.raw.limits.textMax) || 300) + '" data-note>' +
            esc(v.text || '') + '</textarea>';
      }
      return '<div class="pvcf-q' + (q.parent ? ' is-child' : '') + '" data-qid="' + esc(q.id) + '"' +
             (visible(q) ? '' : ' hidden') + '>' +
        '<div class="pvcf-lab">' + endKept(q[L].label) + '</div>' +
        (q[L].help ? '<div class="pvcf-help">' + endKept(q[L].help) + '</div>' : '') +
        body +
        '<div class="pvcf-state" aria-live="polite"></div>' +
      '</div>';
    }

    function countHtml() {
      var n = qs.filter(counted).length;
      return T.fullCount(n, qs.length);
    }

    function draw() {
      var first = true;
      var body = secs.map(function (sec) {
        var mine = qs.filter(function (q) { return q.section === sec.code; });
        if (!mine.length) return '';
        var done = mine.filter(counted).length;
        var open = first ? ' open' : '';
        first = false;
        return '<details class="pvcf-sec"' + open + '>' +
          '<summary class="pvcf-sum">' + esc(sec[L]) +
            '<span class="pvcf-badge" data-sec="' + esc(sec.code) + '">' + done + ' / ' + mine.length + '</span>' +
          '</summary>' +
          '<div class="pvcf-body">' + mine.map(qHtml).join('') + '</div>' +
        '</details>';
      }).join('');

      el.innerHTML =
        '<div class="pvcf-head">' +
          '<h1 class="pvcf-t">' + esc(T.fullTitle) + '</h1>' +
          (ctx.airlineName ? '<span class="pvcf-air">' + esc(ctx.airlineName) + '</span>' : '') +
        '</div>' +
        '<div class="pvcf-count" id="pvcf-count" aria-live="polite">' + esc(countHtml()) + '</div>' +
        body + voicesCard();

      bind();
      mark(true);
    }

    /* 保存できたら、その行の中だけを描き直す。
       画面全体を作り直すと、入力中の欄からフォーカスが飛び、開いた節も閉じる。
       ★行を作り直すと、フォーカスが在った部品もいっしょに消え、フォーカスがページへ落ちる
         （キーボードの人は行の頭からやり直し・読み上げは場所を見失う）。
         作り直す前に「どの部品か」を覚え、作り直した行の同じ部品へ戻す。画面は動かさない。
         覚え方 ── 選択肢と「わからない」は鍵（data-code）で、額の欄・通貨・「入力する」・補足は種類で。
         同じ部品が無くなっていたら、その行の最初の部品へ。
       ★フォーカスがこの行の中に無いときは何もしない
         （保存の返事を待つあいだに次の行へ進んだ人から、フォーカスを奪わない）。 */
    function redrawRow(q) {
      var row = el.querySelector('[data-qid="' + q.id + '"]');
      if (!row) return;
      var KINDS = ['.pvc-opt[data-code]', '.pvcf-num', '[data-cur]', '[data-num]', '[data-note]'];
      var had = d.activeElement;
      var inside = !!(had && had !== row && row.contains(had));
      var kind = -1, i;
      for (i = 0; inside && i < KINDS.length && kind < 0; i++) if (had.matches(KINDS[i])) kind = i;
      var code = kind === 0 ? had.getAttribute('data-code') : null;

      var tmp = d.createElement('div');
      tmp.innerHTML = qHtml(q);
      var fresh = tmp.firstChild;
      row.parentNode.replaceChild(fresh, row);
      bindRow(q);

      if (!inside) return;
      var to = null;
      if (kind === 0) {
        Array.prototype.forEach.call(fresh.querySelectorAll(KINDS[0]), function (b) {
          if (!to && b.getAttribute('data-code') === code) to = b;
        });
      } else if (kind > 0) {
        to = fresh.querySelector(KINDS[kind]);
      }
      if (!to) to = fresh.querySelector('button,input,select,textarea');
      if (to) { try { to.focus({ preventScroll: true }); } catch (e) {} }
    }

    function refreshCounts() {
      var c = el.querySelector('#pvcf-count');
      if (c) c.textContent = countHtml();
      secs.forEach(function (sec) {
        var b = el.querySelector('[data-sec="' + sec.code + '"]');
        if (!b) return;
        var mine = qs.filter(function (q) { return q.section === sec.code; });
        b.textContent = mine.filter(counted).length + ' / ' + mine.length;
      });
      /* 親の答えが変わると、ぶら下がる質問の出る/出ないが変わる */
      qs.forEach(function (q) {
        if (!q.parent) return;
        var row = el.querySelector('[data-qid="' + q.id + '"]');
        if (row) row.hidden = !visible(q);
      });
      /* 出る/出ないが決まってから、?q= の印を付け直す（親 → 子へ移ることがある） */
      mark(false);
    }

    /* その行の状態の1行と、断りの元になった欄の印（aria-invalid）は、ここだけが書く。
       ok  … true ＝ 保存できた／false ＝ 断り／null ＝ 片づける（文も印も消す）
       msg … 決まった2つの文（保存しました／保存できませんでした）の代わりに出す文。無ければ今までどおり。
       at  … 断りの元になった欄（'num' ＝ 額の欄／'cur' ＝ 通貨の欄）。その欄に aria-invalid を付ける
             （見た目は枠の色。読み上げは「入力が正しくない」と伝える）。渡さない断りは、どの欄にも印を付けない。
             印は、この行に次の何か（保存しました・別の断り・片づけ）を書くときに外れる。 */
    function say(q, ok, msg, at) {
      var row = el.querySelector('[data-qid="' + q.id + '"]');
      if (!row) return;
      var s = row.querySelector('.pvcf-state');
      if (!s) return;
      s.textContent = ok === null ? '' : (msg || (ok ? T.fullSaved : T.fullFail));
      s.className = 'pvcf-state' + (ok === false ? ' is-bad' : '');
      var bad = ok === false ? (at === 'cur' ? '[data-cur]' : at === 'num' ? '.pvcf-num' : '') : '';
      Array.prototype.forEach.call(row.querySelectorAll('.pvcf-num,[data-cur]'), function (c) {
        if (bad && c.matches(bad)) c.setAttribute('aria-invalid', 'true');
        else c.removeAttribute('aria-invalid');
      });
    }

    /* 対の断り（「低いほうの額が…」「…同じ通貨で…」）が出ていたら消す。
       相手の額が保存し直されたら、その文はもう、いま保存してある2つの額の話ではない。ほかの文には触らない。 */
    function unsay(q) {
      var row = el.querySelector('[data-qid="' + q.id + '"]');
      var s = row && row.querySelector('.pvcf-state');
      if (!s || (s.textContent !== T.fullRangeOrder && s.textContent !== T.fullRangeCur)) return;
      say(q, null);
    }

    /* 1問ぶんを送る。まとめて送らない＝途中で閉じても答えたぶんは残る。
       ★対になる額の2つを直すときだけ、相手の行に入っている額（also）もいっしょに、2問ぶんを1回で送る。
         1問ずつ送ると、先に送った側が「相手の前の額」と食い違って必ず断られる（100／200 を 300／400 に直せない）。
       ★返事は1問ずつ読む。サーバが保存した答えは、その行を描き直して「保存しました」。
         サーバが断った答え（返事の rejected に、質問と理由が1件ずつ入る）は、その行に理由を書く。打った字は残す。
         保存できた答えを失敗と出さない・断られた答えを保存したと出さない。
         数が合わない返事（保存した数 ≠ 送った数 − 断った数）は、どれが保存されたか分からない ＝ 保存したと言わない。 */
    function save(q, ans, keep, also) {
      ans.question_id = q.id;
      var sent = [{ q: q, ans: ans, keep: keep }];
      if (also) {
        also.ans.question_id = also.q.id;
        sent.push(also);
        inPair[q.id] = inPair[also.q.id] = true;
      }
      var free = function () { if (also) inPair[q.id] = inPair[also.q.id] = false; };
      return sb.rpc('submit_airline_conditions', { p: payload(ctx, sent.map(function (s) { return s.ans; })) })
        .then(function (res) {
          free();
          if (res.error || !res.data) throw new Error('not saved');
          var no = {};
          (Array.isArray(res.data.rejected) ? res.data.rejected : []).forEach(function (r) {
            if (r && r.question_id) no[r.question_id] = r.reason || 'refused';
          });
          var kept = sent.filter(function (s) { return !no[s.q.id]; });
          var sure = res.data.saved === kept.length;
          sent.forEach(function (s) {
            if (no[s.q.id] || !sure) { say(s.q, false, whyText(no[s.q.id]), whyAt(no[s.q.id])); return; }
            var a = s.ans, old = state[s.q.id];
            state[s.q.id] = {
              code: a.code || null, codes: a.codes || null,
              num: a.num == null ? null : Number(a.num),
              currency: a.currency || null,
              text: a.text != null ? a.text : (old && old.text) || null
            };
            track('condition_answered', {
              trigger: 'detail_page', question_id: s.q.id, airline_code: ctx.airline
            });
            if (s.q.id === want) want = '';
            if (!s.keep) redrawRow(s.q);
            say(s.q, true);
          });
          if (!sure || !kept.length) return;
          /* 保存できた額の、相手の行 ── 前の額との食い違いの文が残っていたら消す（unsay）。
             まだ通貨の無い相手の行には、いま保存できた通貨を選んだ形で出しておく（lend）。
             相手もいま保存できた回（2問ぶん）は、どちらも何もしない。 */
          kept.forEach(function (s) { var m = mateOf(s.q); if (m) { unsay(m); lend(m); } });
          refreshCounts();
        })
        .catch(function () { free(); sent.forEach(function (s) { say(s.q, false); }); });
    }

    function bindRow(q) {
      var row = el.querySelector('[data-qid="' + q.id + '"]');
      if (!row) return;

      Array.prototype.forEach.call(row.querySelectorAll('.pvc-opt[data-code]'), function (b) {
        b.addEventListener('click', function () {
          var code = b.getAttribute('data-code');
          if (q.kind === 'multi' && code !== UNKNOWN) {
            var cur = (state[q.id] && state[q.id].codes) || [];
            var next = cur.indexOf(code) >= 0
              ? cur.filter(function (x) { return x !== code; })
              : cur.concat([code]);
            /* 全部外したら「答えていない」に戻す。空配列はサーバが missing_code で弾く */
            if (!next.length) { state[q.id] = {}; redrawRow(q); refreshCounts(); return; }
            save(q, { codes: next });
            return;
          }
          /* 補足を書いてから選択肢を押した人の文章を捨てない
             （描き直しで textarea が作り直されるため、ここで一緒に送る）。
             「わからない」のときは補足を送らない＝答えの無い補足を残さない。 */
          var a = { code: code };
          var nt = row.querySelector('[data-note]');
          if (nt && code !== UNKNOWN && nt.value.trim()) a.text = nt.value.trim();
          save(q, a);
        });
      });

      var num = row.querySelector('.pvcf-num');
      var go  = row.querySelector('[data-num]');
      if (num && go) {
        var send = function () {
          var v = num.value.trim();
          if (!v) return;
          var a = { num: v };
          var cur = row.querySelector('[data-cur]');
          /* 通貨を選んでいない額は送らない（サーバも bad_currency で受け取らない）。
             何が足りないかをその行に書いて、通貨の欄へ運ぶ。 */
          if (cur) {
            if (!cur.value) { say(q, false, T.fullCurNeed, 'cur'); cur.focus(); return; }
            a.currency = cur.value;
          }
          /* 対になる額（低いほう・高いほう）。相手と食い違う額は送らない（サーバも受け取らない）。
               相手に保存した額が無い（まだ答えていない・「わからない」）… 比べない。今までどおり1問ぶん
               相手の保存した額と合っている                              … 今までどおり1問ぶん
               食い違っている … 相手の行を見る。保存した額とは違う額と通貨が入っていて、それとなら合っている
                                 ＝ 2つとも直している途中 → 2問ぶんを1回で送る（save の also）。
                                 そうでなければ、何が食い違っているかをこの行に書いて、直す欄へ運ぶ。何も送らない。
             ★比べる相手は、まず「保存した額」。相手の行に打ってあるだけの額は、送るまでは答えではない。
             ★2問ぶんを送って返事を待っているあいだは、その2行からは送らない（返事が来ると2行とも描き直す。
               そのあいだに打ち直した額へ、前の送信の返事を重ねない）。 */
          var mate = mateOf(q), also = null;
          if (mate) {
            if (inPair[q.id]) return;
            var mine = amount(v, a.currency), was = storedOf(mate);
            var why = clash(q, mine, was);
            if (why) {
              var now = typedOf(mate);
              if (now && (now.num !== was.num || now.cur !== was.cur)) why = clash(q, mine, now);
              else now = null;
              if (why) {
                say(q, false, whyText(why), whyAt(why));
                (whyAt(why) === 'cur' ? cur : num).focus();
                return;
              }
              also = { q: mate, ans: { num: now.raw } };
              if (now.cur) also.ans.currency = now.cur;
            }
          }
          save(q, a, false, also);
        };
        go.addEventListener('click', send);
        /* 断りの元になった欄の値を変えたら、その断りを片づける（文も欄の印も。その文は、変える前の値の話）。
           通貨の欄を本人が触ったら、相手から借りた通貨ではなくなる。 */
        var cur0 = row.querySelector('[data-cur]');
        num.addEventListener('input', function () {
          if (num.getAttribute('aria-invalid') === 'true') say(q, null);
        });
        if (cur0) cur0.addEventListener('change', function () {
          lent[q.id] = false;
          if (cur0.getAttribute('aria-invalid') === 'true') say(q, null);
        });
        /* Enter でも送れるようにする（数値欄で毎回ボタンへ手を伸ばさせない） */
        num.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); send(); }
        });
      }

      var note = row.querySelector('[data-note]');
      if (note) {
        note.addEventListener('blur', function () {
          var v = note.value.trim();
          var st = state[q.id] || {};
          /* 補足だけでは保存できない（その質問の答えが先に要る）。
             サーバが missing_code で弾くので、こちらで黙って待つ。 */
          if (!st.code || st.code === UNKNOWN) return;
          if ((st.text || '') === v) return;
          save(q, { code: st.code, text: v }, true);
        });
      }
    }

    function bind() {
      qs.forEach(bindRow);
      var link = el.querySelector('[data-pvcf-voices]');
      if (link) link.addEventListener('click', function () {
        track('condition_review_clicked', { trigger: 'detail_page', airline_code: ctx.airline });
      });
    }
  }

  /* 詳細ページの入口。ページ側は「ログイン済みであること」だけ保証して呼ぶ。 */
  function mountFull(el, opts) {
    try {
      if (!el || !opts || !opts.sb) return;
      ensureStyle();
      loadBank().then(function (bank) {
        if (!bank) throw new Error('bank');
        return resolveAirline(opts.sb, opts).then(function (ctx) {
          if (ctx) renderFull(el, opts.sb, ctx, bank);
          else pickAirline(el, opts.sb, bank);
        });
      }).catch(function () { showDead(el); });
    } catch (e) { showDead(el); }
  }

  w.PVConditions = w.PVConditions || {};
  w.PVConditions.afterReport = afterReport;
  w.PVConditions.openOne = openOne;
  w.PVConditions.secondaryCTA = secondaryCTA;
  w.PVConditions.mountFull = mountFull;
  w.PVConditions.askReturn = askReturn;
})(window, document);
