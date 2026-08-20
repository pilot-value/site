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
    '.pvcf-lab{font-size:.92rem;font-weight:700;line-height:1.7;color:#e8edf2}',
    '.pvcf-help{font-size:.78rem;line-height:1.7;color:#6b7d93;margin-top:6px}',
    '.pvcf-row{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-top:12px}',
    '.pvcf-row[hidden]{display:none}',
    '.pvcf-num{min-height:44px;width:120px;padding:11px 12px;border-radius:12px;',
      'font-family:inherit;font-size:.9rem;font-weight:700;color:#e8edf2;background:rgba(255,255,255,.04);',
      'border:1px solid rgba(255,255,255,.14);transition:border-color .2s,background .2s}',
    '.pvcf-num:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}',
    '.pvcf-sel{min-height:44px;padding:11px 12px;border-radius:12px;',
      'font-family:inherit;font-size:.85rem;font-weight:700;',
      'color:#e8edf2;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.14)}',
    '.pvcf-sel:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}',
    '.pvcf-unit{font-size:.8rem;font-weight:700;color:#6b7d93}',
    '.pvcf-note{width:100%;min-height:76px;margin-top:10px;padding:12px 14px;border-radius:12px;',
      'font:inherit;font-size:.85rem;line-height:1.7;color:#e8edf2;background:rgba(255,255,255,.04);',
      'border:1px solid rgba(255,255,255,.14);resize:vertical}',
    '.pvcf-note:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}',
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
    '[data-theme="light"] .pvcf-state.is-bad{color:#a97e00}',
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
        '<div class="pvc-eyebrow" id="pvc-eyebrow">' + lines(T.eyebrow) + '</div>' +
        (ctx.airlineName ? '<div class="pvc-air">' + esc(ctx.airlineName) + '</div>' : '') +
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

    var opts = it.reconfirm
      ? [{ code: '__same', label: T.same }, { code: '__changed', label: T.changed },
         { code: UNKNOWN, label: T.dunno }]
      : (q.choices || []).map(function (c) { return { code: c.code, label: c[L] }; });

    var head = it.reconfirm
      ? lines(T.again(labelOf(q, it.mine_code)))
      : esc(q[L].label);
    var help = (!it.reconfirm && q[L] && q[L].help)
      ? '<div class="pvc-help">' + esc(q[L].help) + '</div>' : '';
    var step = this.items.length > 1
      ? '<span class="pvc-step">' + esc(T.step(this.i + 1, this.items.length)) + '</span>' : '<span></span>';

    this.body.innerHTML =
      '<div class="pvc-q">' + head + '</div>' + help +
      '<div class="pvc-opts">' +
        opts.map(function (o) {
          return '<button type="button" class="pvc-opt" data-code="' + esc(o.code) + '">' +
                   esc(o.label) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="pvc-foot">' + step +
        '<button type="button" class="pvc-skip">' + esc(T.skip) + '</button>' +
      '</div>';

    var btns = this.body.querySelectorAll('.pvc-opt');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () { self.pick(b, btns, b.getAttribute('data-code')); });
    });
    this.body.querySelector('.pvc-skip').addEventListener('click', function () { self.skip(); });

    /* 開いたことは1回だけ数える（1問ごとに数えると開封率が3倍に見える）。
       どの質問を出したかは question_number と question_id で追える。 */
    if (!this._shown) { this._shown = true; this.evt('condition_modal_shown'); }
    /* 1問目だけフォーカスを移す。2問目以降で毎回移すと、キーボードの人の
       読み位置が飛ぶ（aria-live が読み上げるので移す必要も無い）。 */
    if (this.i === 0 && btns[0]) btns[0].focus();
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
        self.i++;
        self.step();
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
    this.body.innerHTML =
      '<div class="pvc-done">' + lines(T.thanks(this.ctx.airlineName)) + '</div>' +
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
      if (!el || !ctx || !ctx.sb) return;
      if (el.querySelector('[data-pvc-cta]')) return;
      ctx.sb.rpc('my_pay_reports')
        .then(function (res) {
          if (!res || res.error || !res.data) return;            // 関数がまだ本番に無い等
          var rows = res.data.reports || [];
          if (!rows.length) return;
          var last = rows[rows.length - 1];                       // period_ym の昇順で返る
          if (!last || !last.airline) return;
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
            if (!got) return;                                     // 聞くことが無い
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
          });
        })
        .catch(function () {});
    } catch (e) {}
  }

  /* ════════════════════════════════════════════════════════════
     詳細ページ（airline-conditions.html）。26問すべてを節ごとに並べる。
     ★「◯% 完成」の進捗は出さない。埋めさせる圧力＝推測で埋める動機になる。
       出すのは「あなたが答えた項目：7／26」という事実だけ。
     ★親に答えていない子の質問は、そもそも画面に出さない
       （サーバも parent_missing で弾くので、出しても保存できない）。
     ════════════════════════════════════════════════════════════ */

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
    var qs = bank.raw.questions || [];
    var secs = bank.raw.sections || [];
    var byId = bank.byId;
    var state = {};     // question_id → { code, codes, num, currency, text }

    /* 金額の質問があるときだけ通貨の一覧を読む（今は training_bond_amount の1問） */
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
    function visible(q) {
      if (!q.parent) return true;
      var v = state[q.parent];
      if (!v) return false;
      var have = v.codes && v.codes.length ? v.codes : (v.code ? [v.code] : []);
      return q.parentWhen.some(function (c) { return have.indexOf(c) >= 0; });
    }

    function curOptions(sel) {
      var list = (_vocab && _vocab.currencies) || [];
      return list.map(function (c) {
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
                 ' aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(c[L]) + '</button>';
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
        body += '<div class="pvcf-row">' +
          '<input class="pvcf-num" type="number" inputmode="decimal"' +
            ' min="' + esc(n.min) + '" max="' + esc(n.max) + '" step="' + esc(n.step || 1) + '"' +
            ' value="' + esc(v.num == null ? '' : v.num) + '"' +
            ' aria-label="' + esc(q[L].label) + '"/>' +
          (q.currency
            ? '<select class="pvcf-sel" data-cur aria-label="' + esc(T.fullCur) + '">' +
                curOptions(v.currency) + '</select>'
            : '') +
          (n[L] ? '<span class="pvcf-unit">' + esc(n[L]) + '</span>' : '') +
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
        '<div class="pvcf-lab">' + esc(q[L].label) + '</div>' +
        (q[L].help ? '<div class="pvcf-help">' + esc(q[L].help) + '</div>' : '') +
        body +
        '<div class="pvcf-state" aria-live="polite"></div>' +
      '</div>';
    }

    function countHtml() {
      var n = qs.filter(function (q) { return answered(q.id); }).length;
      return T.fullCount(n, qs.length);
    }

    function draw() {
      var first = true;
      var body = secs.map(function (sec) {
        var mine = qs.filter(function (q) { return q.section === sec.code; });
        if (!mine.length) return '';
        var done = mine.filter(function (q) { return answered(q.id); }).length;
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
    }

    /* 保存できたら、その行の中だけを描き直す。
       画面全体を作り直すと、入力中の欄からフォーカスが飛び、開いた節も閉じる。 */
    function redrawRow(q) {
      var row = el.querySelector('[data-qid="' + q.id + '"]');
      if (!row) return;
      var tmp = d.createElement('div');
      tmp.innerHTML = qHtml(q);
      row.parentNode.replaceChild(tmp.firstChild, row);
      bindRow(q);
    }

    function refreshCounts() {
      var c = el.querySelector('#pvcf-count');
      if (c) c.textContent = countHtml();
      secs.forEach(function (sec) {
        var b = el.querySelector('[data-sec="' + sec.code + '"]');
        if (!b) return;
        var mine = qs.filter(function (q) { return q.section === sec.code; });
        b.textContent = mine.filter(function (q) { return answered(q.id); }).length + ' / ' + mine.length;
      });
      /* 親の答えが変わると、ぶら下がる質問の出る/出ないが変わる */
      qs.forEach(function (q) {
        if (!q.parent) return;
        var row = el.querySelector('[data-qid="' + q.id + '"]');
        if (row) row.hidden = !visible(q);
      });
    }

    function say(q, ok) {
      var row = el.querySelector('[data-qid="' + q.id + '"]');
      if (!row) return;
      var s = row.querySelector('.pvcf-state');
      if (!s) return;
      s.textContent = ok ? T.fullSaved : T.fullFail;
      s.className = 'pvcf-state' + (ok ? '' : ' is-bad');
    }

    /* 1問ぶんを送る。まとめて送らない＝途中で閉じても答えたぶんは残る。 */
    function save(q, ans, keep) {
      ans.question_id = q.id;
      return sb.rpc('submit_airline_conditions', { p: payload(ctx, [ans]) })
        .then(function (res) {
          if (res.error || !res.data || res.data.saved !== 1) throw new Error('not saved');
          state[q.id] = {
            code: ans.code || null, codes: ans.codes || null,
            num: ans.num == null ? null : Number(ans.num),
            currency: ans.currency || null,
            text: ans.text != null ? ans.text : (state[q.id] && state[q.id].text) || null
          };
          track('condition_answered', {
            trigger: 'detail_page', question_id: q.id, airline_code: ctx.airline
          });
          if (!keep) redrawRow(q);
          say(q, true);
          refreshCounts();
        })
        .catch(function () { say(q, false); });
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
          if (cur) a.currency = cur.value;
          save(q, a);
        };
        go.addEventListener('click', send);
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
})(window, document);
