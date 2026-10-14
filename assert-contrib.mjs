/* assert-contrib.mjs — 会社ページの上で開く「情報を追加」の面（pv-contrib.js / pv-contrib.css）。

   会社ページから離れずに情報を1つ足す面。画面は普通に動いたまま、静かに嘘になる形が
   いくつもあるので、ここで1つずつ押さえる：

     ① 開く・閉じる ── 押して開く／?add= で開く／「戻る」・Esc・暗い所で閉じる。
        開いたまま読み直した人を、履歴の1段ぶん取り残さない。
     ② 会社を選び直させない（会社ページの上で開いているのだから）。
     ③ 月の勤務 ── **空欄は未回答（null）・0 は 0**。0 で埋めない・0 を消さない。
        1項目だけで保存できる。読み直すとその1項目だけが戻り、残りは「未回答」。
        サーバが断った理由はそのまま出し、打った字は1文字も消さない。
     ④ 送れなかったとき ── 「送れていません」と言い、打った内容を残し、
        読み直してももう一度送れる。送れたら控えを消す。
     ⑤ 未ログイン ── ★ログインなしで保存できる（2026-10-07 オーナー指定）。
        保存先はサーバの預かりで、本人のしるしは「サーバが作った推測できない鍵」。
        同じ端末からは読み直して直せる。鍵を持たない端末・ほかの会員には何も返らない。
        ログインすると本人の投稿として引き継がれ、預かりにも鍵にも何も残らない。
        ⚠️ ブラウザの中にだけ置いたものを「保存しました」と言わない。
     ⑥ 通勤・タクシー ── 親と子の答えを1回で送る。読み直すと答えが戻る。上書きできる。
        どの質問にも任意の補足を添えられる。ただし補足は「追加の説明」で、
        選ぶ質問の代わりにしない（8問とも選ぶ形のまま残す）。
     ⑦ 「あなたの投稿 N件」は、サーバが本人について返した行数だけ。
        まだ何も出していない人には1つも出さない。質問の数を答えの数として出さない。
     ⑧ 勤務を保存しても、給与の鍵は1つも動かない（預けても・引き継いでも）。
     ⑨ 3つの大きさ（390×680・768×950・1440×820）で、押せる所が 44px 未満にならない・
        入力欄が 16px 未満にならない・面が横に溢れない。
     ⑩ 本番へ1本も投げない。
     ⑪ 一覧の7つの話題は全部この面の中で開く（質問の分け方は会社ページの入口と同じ）。
        会社ページの質問の名前を押すと、その質問を開いた状態で出る（ほかの画面へ行かない）。
     ⑫ 面を開いたまま読む人が替わったら（別の会員・ログアウト・期限切れ・ほかのタブ）、前の人が保存したものを
        出さない・数えない・送らない。打って、まだ送っていない入力は残す。自分の一覧が読めている時（12-b）も、
        読めない時（12）も。読む人が替わっていない時は、何も消さない。
     ⑬ 開いている面と「いま読んでいる人」の残り（12-c）。ログイン前の回答を引き継いだ知らせ
        （「…あなたの投稿として引き継ぎました」）は、引き継ぎを始めた人にだけ出す ── 返事が届く前に読む人が
        もう一度替わった時も、面を閉じたまま引き継いだあとで別の人が面を開いた時も。
        ログインは保存されているのに会員の id が読めないあいだは、保存したものを誰のものとしても扱わない
        ── 読まない・数えない・入力に入れない・保存後のカードを出さない・預かりを引き継がない
        （面は「読み込めませんでした」の形。打った内容は残り、そのまま送れる）。
        自分の一覧を読みに行く前の待ち（預けた回答の引き継ぎ）のあいだに、同じタブのまま読む人が替わっても、
        前の人が入れた確認のチェックを残さない。同じタブのまま誰も触らないうちにログインが切れても、
        面の時計（ログインの部品と同じ間隔）が気づいて、前の人の答えを消す。
        読む人が替わったあとで打ち始めた入力に今の人の一覧が届いたら、今の人が前に保存した値を、打っていない欄に
        だけ入れる（打った欄には書かない。月の勤務は1か月が1行 ＝ 入れないまま送ると、保存してあった欄が空で
        置き換わる）。送っている最中に読む人が替わって送れなかった時、端末に残す1件に前の人の保存した値を入れない。
     ⑭ 保存後のカード（14）。「自分の回答を見る」は、いま保存した質問の所まで送る（長い項目では、保存した答えが
        最初の1画面の下に在る。畳んである質問は開けて見せる。指した質問は1回送ったら忘れる）。
        返事だけが届かなかった回を「もう一度送る」で送り直した見出しは、会員・ログインなし・月の勤務のどれでも
        「保存しました」（前の送信が届いていたかは分からない ＝ 増えたとも直したとも言い切らない）。失敗の無い回・
        破棄したあとの回・ほかの項目やほかの月の1件が残っているだけの回は、今までどおり。
        サイトの通貨をほかの通貨にしていても、カードは打った額と補足を打ったとおりに出す。
        背の低い画面（360×540・375×548・341×540）でも、スクロールせずに2つのボタンに届く。
     ⑮ 質問の入力が断る時（15）。低いほう・高いほうの対（台帳の rangeLow）は、食い違う対を送る前に止める
        （低いほうが大きい・通貨が違う。比べるのは「この送信のあと」に並ぶ2つの額 ＝ 触っていない端は、保存してある額）。
        断った欄は面の見えている所へ送り（畳んである質問なら、畳みを開けて）、その欄に値が入ったら断りを消す
        （あとから出た別の断りは消さない）。
        返事だけが届かなかった回を、読み直してから送り直して「同じです」になったら、端末の控えも消す
        （入力が違う時は消さない）。親を前に保存した人が続きの質問だけをあとから送ると、職位と機種は親の行のもの。
     ⑰ 待遇の一覧のページ（airline-conditions.html ＝ pv-conditions.js。17）。画面が読んだあとで相手の額がほかの所で
        変わっていた対を、本物のサーバが断り、画面がその理由の文をその行に出す（「保存できませんでした」ではない）。
        保存先は動かない。画面の中の確かめ（送る前）は、assert-conditions.mjs が偽物のサーバで見ている。

   実行: node assert-contrib.mjs
   ⚠️ 自分で手元の保存先（serve-local.mjs）を空いているポートで起こし、終わったら丸ごと捨てる。
      3000 番（本番の DB につながっている）は使わない。
   ⚠️ 会社ページがまだ pv-contrib を読み込んでいない間は、この検査が自分で差し込む
      （ページ側が読み込むようになったら、そちらをそのまま使う）。
*/
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e)); };
const J = (v) => { try { return JSON.stringify(v).slice(0, 300); } catch { return String(v); } };

const SIZES = {
  small:  { w: 320,  h: 568, touch: true },   // いちばん狭い画面（保存後のカードだけ、ここでも測る）
  phone:  { w: 390,  h: 680, touch: true },
  tablet: { w: 768,  h: 950, touch: true },
  desk:   { w: 1440, h: 820, touch: false },
  /* 質問の入力の見た目（16）だけが使う幅。折り返しは幅で決まるので、スマホの幅を4つ（320・360・390・430）測る */
  w360:   { w: 360,  h: 640, touch: true },
  w430:   { w: 430,  h: 800, touch: true },
  w1280:  { w: 1280, h: 800, touch: false },
};
const LIBS = /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.tailwindcss\.com)$/;
const NONE = '未回答';
const NUM_KEYS = ['block_hours', 'duty_hours', 'work_days', 'duty_days', 'days_off', 'stay_nights'];

// ═══════════════════════════════════════════════════════════════
// 0. ソースの検査（ブラウザを開かなくても分かること）
// ═══════════════════════════════════════════════════════════════
/* 「出頭から解放まで」は拘束時間の数え方の選択肢（サーバの report_to_release ＝「出頭〜解放」の字）。
   勤務から解かれる意味の「解放」で、年収の鍵の話ではないので、その1語だけ除いてから見る
   （ソースの検査と、保存後の画面の検査の両方で使う）。 */
const DUTY_TERM = /出頭から解放まで/g;

console.log('\n════ ソース ════');
{
  const css = read('pv-contrib.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const js = read('pv-contrib.js');
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, (m, a) => a);
  const tokens = read('pv-tokens.css');

  /* どの規則も .pvc で始まる（ページのほかの部品に1つも当たらない） */
  const sels = [];
  {
    const stack = [];
    let buf = '';
    for (const ch of css) {
      if (ch === '{') {
        const pre = buf.trim(); buf = '';
        const at = pre.startsWith('@');
        const inKf = stack.some((s) => /^@(-webkit-)?keyframes/.test(s));
        if (!at && !inKf) {
          let depth = 0, cur = '';
          for (const c of pre) {
            if (c === '(') depth++;
            if (c === ')') depth--;
            if (c === ',' && depth === 0) { sels.push(cur.trim()); cur = ''; } else cur += c;
          }
          if (cur.trim()) sels.push(cur.trim());
        }
        stack.push(pre);
      } else if (ch === '}') { stack.pop(); buf = ''; } else if (ch === ';') buf = ''; else buf += ch;
    }
  }
  const stray = sels.filter((s) => !s.startsWith('.pvc'));
  ok(sels.length > 50 && stray.length === 0, `CSS のどの規則も .pvc で始まる（${sels.length} 個）`, J(stray.slice(0, 5)));
  ok(!/#[0-9a-fA-F]{3,8}\b/.test(css) && !/\b(rgba?|hsla?)\(/.test(css), 'CSS に色の直書き（hex・rgb・hsl）が無い',
    J((css.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/g) || []).slice(0, 5)));
  ok(!/prefers-color-scheme/.test(css), 'CSS に prefers-color-scheme が無い（明暗は data-theme で決まる）');
  const used = [...new Set(css.match(/var\(\s*(--pv-[a-z0-9-]+)/g) || [])].map((s) => s.replace(/var\(\s*/, ''));
  const missing = used.filter((t) => !new RegExp(t.replace(/[-]/g, '\\-') + '\\s*:').test(tokens));
  ok(used.length > 5 && missing.length === 0, `使っている色・影の名前は全部 pv-tokens.css に在る（${used.length} 個）`, J(missing));
  const trans = [...css.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/g)].map((m) => m[1].trim());
  const badTrans = trans.filter((t) => t.split(',').some((p) => !/^(transform|opacity|none)\b/.test(p.trim())));
  ok(trans.length > 0 && badTrans.length === 0 && !/transition-all/.test(css), '動かすのは transform と opacity だけ（transition: all が無い）', J(badTrans.slice(0, 4)));
  /* 上の行が見ているのは transition だけ。保存できた合図の紙片は @keyframes で動くので、その中も同じ決まりで見る
     （left や top を動かすと、面の組み直しが毎コマ走る）。 */
  const frames = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)]
    .flatMap((m) => [...m[1].matchAll(/([\w-]+)\s*:/g)].map((x) => x[1]));
  ok(frames.length > 0 && frames.every((p) => ['transform', 'opacity'].includes(p)), '@keyframes の中で動かすのも transform と opacity だけ', J([...new Set(frames)]));
  /* 動きを減らす設定の人には、紙片の層そのものを出さない（JS が足さないのが1枚目・ここが2枚目の網） */
  const calmCss = (css.match(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{((?:[^{}]*\{[^{}]*\})*)/) || [])[1] || '';
  ok(/\.pvc-root \.pvc-pop\s*\{\s*display\s*:\s*none\s*\}/.test(calmCss), '動きを減らす設定のときは、保存できた合図の紙片を出さない（CSS 側の網）', calmCss.replace(/\s+/g, ' ').slice(-120));
  const smallFont = [...css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]).filter((n) => n < 12);
  ok(smallFont.length === 0, 'CSS に 12px 未満の文字が無い', J(smallFont));
  for (const st of [':hover', ':focus-visible', ':active']) {
    const need = ['.pvc-close', '.pvc-tile', '.pvc-send', '.pvc-ghost', '.pvc-talk', '.pvc-fold-b', '.pvc-prev'];
    const lack = need.filter((n) => !sels.some((s) => s.includes(n + st)));
    ok(lack.length === 0, `押せる部品に ${st} の見た目が在る`, J(lack));
  }

  ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.write\(/.test(code),
    'JS は innerHTML・insertAdjacentHTML・document.write を使わない（文字は textContent でしか入れない）');
  ok(/textContent/.test(code), 'JS は textContent で文字を入れている');
  ok(!/[¥￥€£＄]|[$]\s?\d|\d\s?(万円|万|円)|\b(JPY|USD|AED|HKD|TWD)\b/.test(code), 'JS に金額が1つも書かれていない',
    J((code.match(/.{0,20}(?:[¥￥€£＄]|[$]\s?\d|\d\s?(?:万円|万|円)|\b(?:JPY|USD|AED|HKD|TWD)\b).{0,20}/g) || []).slice(0, 3)));
  ok(!/supabase\.co/.test(js) && !/\/Users\//.test(js + css), 'JS・CSS に本番の住所も、この Mac の中の場所も書かれていない');
  /* 呼ぶ関数は7つ ── 会員の「出す」「自分の分を読む」が2つずつ、ログインしていない人の
     「預ける」「預けた分を読む」、ログインしたあとの「引き継ぐ」。
     会員の「出す」2つは名前の表（MEMBER_FN）を通して呼ぶので、表の中身も一緒に数える。
     それ以外の形で名前を渡している呼び出しが在れば、ここで見落とすことになるので落とす。 */
  const rpcLit = [...code.matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1]);
  const rpcTbl = [...((code.match(/var MEMBER_FN = \{([^}]*)\}/) || [])[1] || '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const rpcDyn = [...new Set([...code.matchAll(/rpc\(([^'\s][^,)]*)/g)].map((m) => m[1].trim()))].sort();
  const rpcs = [...new Set([...rpcLit, ...rpcTbl])].sort();
  ok(J(rpcs) === J(['claim_contrib', 'my_airline_conditions', 'my_contrib_anon', 'my_work_months',
    'submit_airline_conditions', 'submit_contrib_anon', 'submit_work_month']),
    '呼ぶ関数は7つだけ（会員の「出す」「読む」×2・未ログインの「預ける」「読む」・ログイン後の「引き継ぐ」）', J(rpcs));
  ok(J(rpcDyn) === J(['MEMBER_FN[kind]', 'name']), '名前を表から引いて呼ぶのは、会員の「出す」の1か所だけ（ほかに見えない呼び出しが無い）', J(rpcDyn));
  ok(!/pv_work_view|pv_contrib_notes|pv_pay_rows|pv_reviews|pv_contrib_facts|airline_condition_facts|pv_contrib_give|pv_contrib_sees/.test(code), '「情報を追加」の面は、ほかの人の回答・給与・口コミを読む口を1つも呼ばない');

  /* サーバの決まりを写している値（預かりの日数）が、正本と同じか。
     「消える日」を決めているのはサーバで、ここが違っていても
     動きは変わらない ── 変わるのは、書く前に画面が言う断りの文だけ（＝嘘の約束になる）。 */
  const sqlC = read('db/contrib.sql');
  const held = +((code.match(/var HELD_DAYS = (\d+);/) || [])[1] || 0);
  const ttl = +((sqlC.match(/function public\.pv_contrib_ttl\(\)[\s\S]{0,160}?interval '(\d+) days'/) || [])[1] || 0);
  ok(held > 0 && held === ttl, `預かりの日数が、画面の文とサーバで同じ（${held}日 ⇄ ${ttl}日）`);
  /* 補足を誰に見せるかは、サーバの1か所（pv_contrib_sees）が決める。面は区分の写しを持たず、断りの文は1つだけ
     （2026-10-11：ほかの人の回答を見られるのは、給与を提出した会員だけ）。
     見るのは shareLine の中身（コメントを除いた字）── 文がちょうど1回・ほかの相手の名前が無い・区分の表を引いていない。 */
  const SHARE_TEXT = '補足を書いた場合は、質問の名前と一緒に、給与を提出した会員に表示されます（名前は出ません）。';
  const oneAudience = (src) => { const fn = (src.match(/function shareLine\(qs\) \{[\s\S]*?\n  \}/) || [''])[0]; return fn.split(SHARE_TEXT).length === 2 && !/ログインした会員/.test(fn) && !/PAY_SECTIONS/.test(fn); };
  ok(oneAudience(code), '補足を誰に見せると書くかは1つだけ ── 給与を提出した会員', (code.match(/function shareLine\(qs\) \{[\s\S]*?\n  \}/) || ['shareLine が見つからない'])[0].replace(/\s+/g, ' ').slice(0, 300));
  ok(!/REAL PAY|解放|アンロック|unlock/i.test(code.replace(DUTY_TERM, '')), 'JS は「REAL PAY が開く」と1文字も言わない',
    J((code.replace(DUTY_TERM, '').match(/.{0,16}(?:REAL PAY|解放|アンロック|unlock).{0,16}/gi) || []).slice(0, 3)));
  ok(!/機内弁当|住まい・家族/.test(code), '保存先の無い項目（機内弁当・食事／住まい・家族）のタイルを置いていない');

  /* 保存できた合図（cue）を出すのは、保存後の画面を出した直後の2か所だけ。
     保存後の画面を組む所（savedShell）や 'pvc:saved' の合図に掛けると、描き直し・一部だけ保存できた回・
     ログイン後の引き継ぎでも鳴る ＝「保存できた時に1度だけ」が崩れる。名前を渡すだけの形（, cue)）も数える。 */
  const cueUse = (code.match(/(?<![\w-])cue\b/g) || []).length;
  const savedShows = (code.match(/show\((?:'work-saved'|topic \+ '-saved')\);/g) || []).length;
  const savedCued = (code.match(/show\((?:'work-saved'|topic \+ '-saved')\);\s*cue\(\);/g) || []).length;
  ok(cueUse === 3 && savedShows === 2 && savedCued === 2,
    '保存できた合図を出すのは、保存後の画面を出した直後の2か所だけ（ほかのどこからも呼んでいない）', J({ cue: cueUse, shows: savedShows, cued: savedCued }));
  ok(!/['"](?:修正する|別の項目を追加)['"]/.test(code), '保存後のボタンに、前の言い方（「修正する」「別の項目を追加」）が残っていない');

  /* ── ほかの会社について開く（PVContrib.openFor）── ここは字を読むだけ。動きは、いちばん下の場面「別の会社について開く」が見る。
     このページの会社ではなく、読む人自身の会社（＝ 勤め先。本人のこと）について開く入口なので、
     片方の会社について打った・保存したものが、もう片方へ渡らないこと・勤め先がこの面の外へ出ないことを、字の上でも押さえる。
     どの式も、面のファイルの字（コメントを除いたもの）を1つ受け取る形 ＝ 1か所だけ変えた字に当てて、偽になることを確かめられる。 */
  const cnt = (src, s) => src.split('\n').filter((l) => l.includes(s)).length;
  const fnOf = (src, name) => (src.match(new RegExp('\\n  function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}')) || [''])[0];
  const coOne = (src) => { const os = fnOf(src, 'openSheet'), at = os.indexOf('setCo(o);'); return cnt(src, 'function setCo(') === 1 && at > 0 && at < os.indexOf('build();') && cnt(src, "getAttribute('data-airline')") === 1 && /\n  function pageSlug\(\) \{ return trim\(d\.body && d\.body\.getAttribute\('data-airline'\)\); \}\n/.test(src) && /^\n  function readerTurn\(\) \{\n    if \(CO && CO\.u !== uid\(\)\) \{ coEnd\(\); return true; \}\n/.test(fnOf(src, 'readerTurn')); };
  const coGuard = (src) => { const L = src.split('\n'), isSend = (l) => /^\s*send\('[a-z]+', pl\)\.then\(function \(r\) \{$/.test(l || ''), at = L.map((l, i) => (l.includes('if (was !== coTurn) return;') ? i : -1)).filter((i) => i >= 0); return cnt(src, 'coTurn++') === 1 && fnOf(src, 'setCo').includes('coTurn++;') && L.filter(isSend).length === 2 && at.length === 2 && at.every((i) => isSend(L[i - 1]) && /^\s*var was = coTurn;$/.test(L[i - 2] || '')); };
  const coTrack = (src) => cnt(src, 'gtag(') === 1 && cnt(src, 'airline_code') === 1 && cnt(src, "w.gtag('event', name, { topic: topic, airline_code: CO ? '' : slug() });") === 1;
  const coOutbox = (src) => cnt(src, 'lset(OUTBOX,') === 1 && /\n  function keepOutbox\(topic\) \{\n    if \(CO\) return;\n    lset\(OUTBOX,/.test(src) && cnt(src, '入力した内容はこの端末に残しています。') === 1 && cnt(src, "(CO ? '' : '入力した内容はこの端末に残しています。')") === 1;
  const coSend = (src) => /\n  function send\(kind, data\) \{\n    if \(CO\) return rpc\(MEMBER_FN\[kind\], data\);\n/.test(src) && cnt(src, 'keepDraft(') === 4 && cnt(src, "if (!noDraft && !CO) keepDraft(topic, 'login');") === 1;
  ok(coOne(code), '★別の会社について開く：面がこのページの会社を読むのは1か所だけ（pageSlug）。どの会社について開くかは、開く時の頭の1か所（setCo）で決め直し、読む人が替わっていたら最初にそれを終える（readerTurn の頭）',
    J({ setCo: cnt(code, 'function setCo('), page: cnt(code, "getAttribute('data-airline')"), turn: fnOf(code, 'readerTurn').split('\n').slice(1, 3).join(' ').trim().slice(0, 120) }));
  ok(coGuard(code), '★別の会社について開く：送ったあとで会社が替わっていたら、届いた返事では何もしない（月の勤務・質問の2つの送信のどちらも、返事の頭で確かめる）',
    J({ turn: cnt(code, 'coTurn++'), guard: cnt(code, 'if (was !== coTurn) return;') }));
  ok(coTrack(code), '★別の会社について開く：そのあいだは、計測に会社の符号を送らない（符号を送る所は、この1か所だけ）', J({ gtag: cnt(code, 'gtag('), code: cnt(code, 'airline_code') }));
  ok(coOutbox(code), '★別の会社について開く：そのあいだは、送れなかった1件を端末に残さない（残していないものを「この端末に残しています」と言わない）', J({ write: cnt(code, 'lset(OUTBOX,') }));
  ok(coSend(code), '★別の会社について開く：そのあいだは、ログインなしの預かりへ送らない。ログインへ送り出す時にも、下書きを残さない', J({ drafts: cnt(code, 'keepDraft(') }));
}

// ═══════════════════════════════════════════════════════════════
// 1. 手元の保存先とブラウザ
// ═══════════════════════════════════════════════════════════════
const { start, MEMBERS } = await import('./serve-local.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-contrib-'));
let local = null, browser = null;
const supa = new Set(), blocked = new Set(), pageErrs = [];

async function main() {
  local = await start({ port: 0, dir: tmp, quiet: true });
  const base = local.url;
  const q = (sql, params) => local.locked(() => local.db.query(sql, params));
  const memberOf = (key) => MEMBERS.find((m) => m.key === key);
  browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

  /* ── 道具 ─────────────────────────────────────────────── */
  function gate(req, st) {
    let u;
    try { u = new URL(req.url()); } catch { return req.continue(); }
    if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return req.continue();
    if (u.origin === base) {
      const m = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
      if (m) {
        st.calls.push(m[1]);
        /* 止めておく通信（st.hold）。流すのは場面の側（release）。返事が遅れて届く回を作るのに使う */
        if (st.hold && st.hold.name === m[1]) { st.hold.reqs.push(req); return; }
        if (st.fake && st.fake.name === m[1]) {
          const f = st.fake; st.fake = null;
          return req.respond({ status: f.status || 200, contentType: 'application/json', body: JSON.stringify(f.body) });
        }
      }
      return req.continue();
    }
    if (LIBS.test(u.hostname)) return req.continue();
    if (/supabase\.(co|in|com)$/.test(u.hostname)) supa.add(`${req.method()} ${u.hostname}${u.pathname}`);
    else blocked.add(`${req.method()} ${u.hostname}`);
    return req.abort();
  }

  /* 保存できた合図の紙片の層が片づくまでの時間の幅（ミリ秒）。設計は 動き0.9秒・片づけ1.4秒。
     使い方と、遅いほうを長さで決めない理由は、下の popGone に書いてある。 */
  const POP_MIN = 900, POP_MAX = 2500;

  /* 1枚開く。who を渡すと手元の会員として入った状態で始める。
     calm は「動きを減らす」設定の人として開く（保存できた合図が静かな形になるかを見る）。
     pre は、ページのどの部品よりも（下の、この検査の差し込みよりも）先に走らせる関数
     （欄に出た字を最初から見張る・保存領域への書き込みを控える）。時計を動かすのには使わない。 */
  async function open(sizeKey, { who = null, theme = null, calm = false, pre = null } = {}) {
    const size = SIZES[sizeKey];
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const st = { calls: [], fake: null, ctx };
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1, isMobile: size.touch, hasTouch: size.touch });
    if (calm) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setRequestInterception(true);
    page.on('request', (req) => gate(req, st));
    page.on('pageerror', (e) => pageErrs.push(String(e.message).slice(0, 160)));
    let seed = null;
    if (who) {
      seed = await (await fetch(`${base}/__local/login?member=${who}`)).json();
      if (!seed || !seed.session) throw new Error(`手元の会員 ${who} で入れない`);
    }
    if (pre) await page.evaluateOnNewDocument(pre);
    await page.evaluateOnNewDocument((origin, s, th, popMax) => {
      if (location.origin !== origin) return;
      try {
        /* 保存できたときの合図を控える */
        window.__pvcSaved = [];
        document.addEventListener('pvc:saved', (e) => window.__pvcSaved.push(e.detail));
        /* 保存できた合図（紙片・静かな完了）が「いつ・何回」出たかを控える。
           紙片は1.4秒で片づくので、あとから画面を見ても数えられない ＝ 出た瞬間に書き留める。
           'pop'／'quiet' ＝ 保存後のカードに印が付いた・'pop:10' ＝ 紙片10枚の層が足された・
           'ins:…' ＝ 印の付いたカードが丸ごと描き直された（＝ 保存していないのに合図が戻った）。 */
        window.__pvcCue = [];
        /* 紙片の層が「足されてから、層だけが外されるまで」の時間（ミリ秒）。ページの中の時計で測る
           ＝ 検査の側の待ち時間が混ざらない。カードごと描き直されて消えた回は数えない（自分で片づいた回だけ）。 */
        window.__pvcPopMs = [];
        /* 「設計から大きく遅れた」は、測った長さでは決めない ── 機械が混んでページが止まると、正しい製品の1.4秒の時計も
           遅れて鳴り、長さだけ見ると製品は正しいのに赤くなる。層が足された時に、同じページの中で popMax の時計を1本かけ、
           それが鳴った時に層がまだ在ったかを控える。同じページの時計は、先に掛けた短いほうが必ず先に鳴る
           ＝ ページが何秒止まっても、製品が正しければ false。片づけがそれより長く掛けてあった回・片づけない回だけが true。
           （この setTimeout は検査が待つための時計ではない。検査は下の popGone で「層が消えた」ことを待つ。） */
        window.__pvcPopLate = [];
        let popAt = 0;
        new MutationObserver((list) => {
          /* カードを置くのと印を付けるのは同じ一息の中 ＝ 知らせが届く頃には、置かれたカードにもう印が付いている。
             その回に印が付いたカードは「描き直し」に数えない（数えると、正しい保存がぜんぶ二重に見える）。 */
          const marked = new Set(list.filter((m) => m.type === 'attributes').map((m) => m.target));
          for (const m of list) {
            if (m.type === 'attributes') { window.__pvcCue.push(m.target.getAttribute('data-pvc-cue')); continue; }
            for (const n of m.addedNodes) {
              if (n.nodeType !== 1) continue;
              if (n.classList.contains('pvc-pop')) {
                window.__pvcCue.push('pop:' + n.children.length); popAt = performance.now();
                const layer = n, at = window.__pvcPopLate.push(null) - 1;
                setTimeout(() => { window.__pvcPopLate[at] = layer.isConnected; }, popMax);
              }
              else if (n.hasAttribute('data-pvc-cue') && !marked.has(n)) window.__pvcCue.push('ins:' + n.getAttribute('data-pvc-cue'));
            }
            for (const n of m.removedNodes) {
              if (n.nodeType === 1 && n.classList.contains('pvc-pop')) window.__pvcPopMs.push(Math.round(performance.now() - popAt));
            }
          }
        }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-pvc-cue'] });
        /* ページがまだ読み込んでいなければ、ここで差し込む（読み込んでいればそのまま使う） */
        const add = () => {
          if (!document.body || !document.body.getAttribute('data-airline')) return;
          if (!document.querySelector('link[href*="pv-contrib.css"]')) {
            const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/pv-contrib.css'; l.setAttribute('data-test-injected', '');
            document.head.appendChild(l);
          }
          if (!document.querySelector('script[src*="pv-contrib.js"]')) {
            const sc = document.createElement('script'); sc.src = '/pv-contrib.js'; sc.setAttribute('data-test-injected', '');
            document.head.appendChild(sc);
          }
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();

        if (localStorage.getItem('pv_local_seeded')) return;
        localStorage.setItem('pv_local_ui', '0');          // 会員を切り替える札は隠す（左下に重なる）
        if (th) localStorage.setItem('pv-theme', th);
        if (s) {
          const now = String(Date.now());
          localStorage.setItem('sb-local-auth-token', JSON.stringify(s.session));
          localStorage.setItem('pv_user', JSON.stringify(s.pv_user));
          localStorage.setItem('pv_last_active', now);
          localStorage.setItem('pv_session_start', now);
          /* Give → Get の板は「さっき見た」ことにする（板ではなく、その上の面を見たい） */
          const at = Date.parse((s.session.user || {}).last_sign_in_at || '');
          localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now(), s: String(isNaN(at) ? now : at) }));
        }
        localStorage.setItem('pv_local_seeded', '1');
      } catch (e) { /* 保存領域に触れない画面はそのまま */ }
    }, base, seed, theme, POP_MAX);
    return { page, st, size, sizeKey };
  }
  const go = async (p, urlPath) => {
    await p.page.goto(base + urlPath, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (/^\/airlines\//.test(urlPath)) {
      await p.page.waitForFunction(() => !!window.PVContrib
        && [...document.styleSheets].some((s) => s.href && s.href.includes('pv-contrib.css')), { timeout: 30000 });
    }
  };
  /* 面が目当ての画面を出し、入力できる状態になるまで待つ */
  const waitView = (p, what) => p.page.waitForFunction((w) => {
    const r = document.querySelector('.pvc-root');
    if (!r || r.hidden || !r.classList.contains('is-in')) return false;
    const s = r.querySelector('.pvc-sheet').getBoundingClientRect();
    if (Math.abs(s.right - document.documentElement.clientWidth) > 1 || Math.abs(s.bottom - window.innerHeight) > 1) return false;
    if (w === 'list') return !!r.querySelector('.pvc-tiles');
    if (w === 'counted') {
      const st = r.querySelector('[data-pvc-state]');
      return !!st && /^(ok|anon|off|fail) (ok|anon|off|fail)$/.test(st.getAttribute('data-pvc-state'));
    }
    if (w === 'saved') return !!r.querySelector('[data-pvc-saved]');
    const f = r.querySelector('form[data-pvc-form="' + w + '"]');
    const set = f && f.querySelector('fieldset.pvc-set');
    return !!set && !set.disabled;
  }, {}, what);
  const waitClosed = (p) => p.page.waitForFunction(() => {
    const r = document.querySelector('.pvc-root');
    return (!r || !r.classList.contains('is-in')) && !(history.state && history.state.pvc);
  });
  const api = (p, topic) => p.page.evaluate((t) => window.PVContrib.open({ topic: t }), topic);
  const snap = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root');
    const f = r && r.querySelector('form[data-pvc-form]');
    return {
      open: !!(r && !r.hidden && r.classList.contains('is-in')),
      title: r ? r.querySelector('.pvc-title').textContent : '',
      form: f ? f.getAttribute('data-pvc-form') : '',
      saved: !!(r && r.querySelector('[data-pvc-saved]')),
      href: location.pathname + location.search, len: history.length,
      mark: !!(history.state && history.state.pvc),
      lock: getComputedStyle(document.documentElement).overflowY,
      inside: !!(r && r.contains(document.activeElement)),
    };
  });
  /* 押して開く。ページに本物の入口が在ればそれを、無ければ同じ属性の試験用ボタンを押す。 */
  async function press(p, topic) {
    const real = await p.page.evaluate((t) => {
      for (const n of document.querySelectorAll('[data-test-hit]')) n.removeAttribute('data-test-hit');
      const all = [...document.querySelectorAll('[data-pvc-open]')].filter((n) => !n.hasAttribute('data-test-trigger'));
      let n = all.find((x) => (x.getAttribute('data-pvc-open') || '') === t && x.getClientRects().length);
      const found = !!n;
      if (!n) {
        n = document.querySelector('[data-test-trigger="' + t + '"]');
        if (!n) {
          n = document.createElement('button');
          n.type = 'button'; n.textContent = '情報を追加';
          n.setAttribute('data-pvc-open', t); n.setAttribute('data-test-trigger', t);
          n.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9000;min-width:120px;min-height:44px';
          document.body.appendChild(n);
        }
      }
      n.setAttribute('data-test-hit', '1');
      return found;
    }, topic);
    await p.page.click('[data-test-hit="1"]');
    return real;
  }
  const fill = async (p, name, v) => {
    await p.page.$eval(`.pvc-root [name="${name}"]`, (n) => { n.focus(); if (n.select) n.select(); });
    await p.page.keyboard.press('Backspace');
    if (v !== '') await p.page.keyboard.type(String(v));
  };
  const pick = (p, name, v) => p.page.select(`.pvc-root select[name="${name}"]`, v);
  const chip = async (p, qid, code) => {
    const h = await p.page.$(`.pvc-root [data-q="${qid}"] input[value="${code}"]`);
    const lab = await h.evaluateHandle((n) => n.closest('label'));
    await lab.click();
  };
  const tick = async (p) => {
    const on = await p.page.$eval('.pvc-root input[name="own"]', (n) => n.checked);
    if (!on) await p.page.click('.pvc-root label.pvc-own');
  };
  const send = (p) => p.page.click('.pvc-root form .pvc-send[type="submit"]');
  const vals = (p) => p.page.evaluate(() => {
    const o = {};
    for (const n of document.querySelectorAll('.pvc-root form [name]')) {
      if (n.type === 'checkbox') { if (n.name === 'own') o.own = n.checked; else if (n.checked) (o[n.name] = o[n.name] || []).push(n.value); } else o[n.name] = n.value;
    }
    return o;
  });
  const summary = (p) => p.page.evaluate(() => {
    const o = {};
    for (const r of document.querySelectorAll('.pvc-root .pvc-sum-r')) {
      const v = r.querySelector('.pvc-sum-v');
      o[r.getAttribute('data-k')] = { v: v.textContent, none: v.classList.contains('is-none') };
    }
    const h = document.querySelector('.pvc-root .pvc-saved-h');
    return { head: h ? h.textContent : '', rows: o, text: document.querySelector('.pvc-root .pvc-main').innerText };
  });
  const msg = (p, kind) => p.page.evaluate((k) => {
    const n = document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="' + k + '"]');
    return n ? n.innerText : null;
  }, kind);
  const waitMsg = (p, kind) => p.page.waitForSelector(`.pvc-root .pvc-msg[data-pvc-msg="${kind}"]`);
  const outboxOf = (p) => p.page.evaluate(() => localStorage.getItem('pv_contrib_outbox'));
  const failNext = (match, mode, n = 1) => fetch(`${base}/__local/fail?n=${n}&match=${match}${mode ? '&mode=' + mode : ''}`);
  const failOff = () => fetch(`${base}/__local/fail?n=0`);
  const hits = (p, name) => p.st.calls.filter((c) => c === name).length;
  /* 保存できた合図の控え（open が仕掛けたもの）と、いま画面に残っている合図 */
  const cueLog = (p) => p.page.evaluate(() => window.__pvcCue.slice());
  const cueNow = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root');
    const c = r && r.querySelector('[data-pvc-cue]');
    return { mark: c ? c.getAttribute('data-pvc-cue') : null, pop: !!(r && r.querySelector('.pvc-pop')) };
  });
  const POP = ['pop', 'pop:10'];                         // 保存1回ぶんの合図（印が付く → 紙片10枚の層が足される）
  /* 紙片10枚の散る向き（横・縦・回り）。幅341px から上の画面の見た目 ＝ ここを変えるのは、見た目を変えると決めた時だけ。
     頭の3枚は左（負の横）へ飛ぶ ── いちばん狭い画面では見出しの字を横切るので、そこだけ右へ向け直してある。 */
  const POP_PATH = ['-54px -22px -160deg', '-32px -25px 120deg', '-10px -23px -90deg', '10px -26px 200deg', '30px -20px -40deg',
    '50px -12px 150deg', '56px 4px 80deg', '40px 16px -210deg', '20px 18px 110deg', '4px 14px -130deg'];
  /* 紙片が片づくのを待つ（片づかなくても先へ進み、そこで赤くする ＝ 場面ごと止めない）。
     返すのは ms ＝ 層が足されてから自分で片づくまでの時間（ミリ秒）と、late ＝ ページの中の POP_MAX の時計が
     鳴った時に層がまだ在ったか（どちらも open が仕掛けた、ページの中の時計。検査の側の待ち時間は混ざらない）。
     設計は 動き0.9秒・片づけ1.4秒。「いつか消えればよい」にしない ── 散り終わる前（POP_MIN）に消えても、
     設計から大きく遅れても（POP_MAX）赤くする。前は8秒まで待っていた ＝ 片づけが数倍遅くなっても通っていた。
     ⚠️ 遅いほうを ms の長さで決めない（ms <= POP_MAX と書かない）。機械が混んでページが1秒あまり止まると、
     製品は正しいのに赤くなる。早いほうは長さで決めてよい ── 混んでも、時計が早く鳴ることは無い。
     待つのは「層が消えた」か「POP_MAX の時計が、層が残っていると言った」のどちらか先まで（下の 20秒 は、
     ページごと止まった時に場面を終わらせるための上限で、合否には使わない）。 */
  const popGone = async (p) => {
    await p.page.waitForFunction(() => !document.querySelector('.pvc-root .pvc-pop') || window.__pvcPopLate[window.__pvcPopLate.length - 1] === true, { timeout: 20000 }).catch(() => null);
    return p.page.evaluate(() => {
      const ms = window.__pvcPopMs, late = window.__pvcPopLate;
      return { ms: ms.length ? ms[ms.length - 1] : null, late: late.length ? late[late.length - 1] === true : null };
    });
  };
  /* 紙片がいちばん遠くまで散ったときの位置を測る支度（送る直前に仕掛ける。結果は farOf で読む）。
     紙片は出た瞬間はまだ出発点に重なっていて、0.9秒かけて散る ＝ あとから測ると、もう動いているか消えている。
     なので層が足された瞬間に、1枚ずつ動きを終点まで送って位置を控え、すぐ元の時刻へ戻して続きを走らせる
     （見る側の支度だけ。製品の動きは変えていない）。
     card・sheet … カードの外・面の外へ出た紙片。
     over … 散り終わりの位置で、見出しの字・チェックの印・2つのボタンのどれかに重なった紙片
            （カードの中に収まっていても、字やボタンの上に止まるなら「収まっている」とは言えない）。
     cross … 飛んでいる途中で、見出しの字に重なった紙片と時刻（over は散り終わりだけ ＝ 字の上を横切って
            飛んでいく紙片は見えない）。動きを 20ms 刻みで終わりまで送って測る ＝ 時間を待たない
            （動きの時刻を書き換えるだけ。測り終えたら元の時刻へ戻して続きを走らせる）。steps はその刻みの数。
     path … 紙片ごとの散る向き（--pvc-x・--pvc-y・--pvc-r の、その画面での値）。 */
  const farWatch = (p) => p.page.evaluate(() => {
    window.__pvcFar = null;
    const mo = new MutationObserver(() => {
      const pop = document.querySelector('.pvc-root .pvc-saved .pvc-pop');
      if (!pop) return;
      mo.disconnect();
      const cardEl = pop.parentNode, card = cardEl.getBoundingClientRect(), sheet = document.querySelector('.pvc-root .pvc-sheet').getBoundingClientRect();
      const lay = pop.getBoundingClientRect(), cs = getComputedStyle(pop);
      const out = { n: pop.children.length, still: 0, card: [], sheet: [], over: [], parts: 0, clip: cs.overflowX + ' ' + cs.overflowY, touch: cs.pointerEvents,
        fill: Math.abs(lay.left - card.left) < 1.5 && Math.abs(lay.right - card.right) < 1.5 && Math.abs(lay.top - card.top) < 1.5 && Math.abs(lay.bottom - card.bottom) < 1.5,
        hidden: pop.getAttribute('aria-hidden') };
      /* 見出しの字は、字そのものの範囲で測る（見出しの箱はカードの幅いっぱいなので、箱で測ると右の余白まで「字」になる） */
      const head = cardEl.querySelector('.pvc-saved-h'), words = document.createRange();
      if (head && head.lastChild) words.selectNodeContents(head.lastChild);
      const parts = [
        ['見出しの字', head && head.lastChild ? words.getBoundingClientRect() : null],
        ['チェックの印', head && head.querySelector('svg') ? head.querySelector('svg').getBoundingClientRect() : null],
        ['「自分の回答を見る」', cardEl.querySelector('[data-pvc-act="edit"]') ? cardEl.querySelector('[data-pvc-act="edit"]').getBoundingClientRect() : null],
        ['「もう1項目を答える」', cardEl.querySelector('[data-pvc-act="more"]') ? cardEl.querySelector('[data-pvc-act="more"]').getBoundingClientRect() : null],
      ].filter((x) => x[1] && x[1].width > 0 && x[1].height > 0);
      out.parts = parts.length;
      [...pop.children].forEach((n, i) => {
        const an = n.getAnimations()[0];
        if (!an) { out.still++; return; }
        const t0 = an.currentTime;
        an.pause(); an.currentTime = an.effect.getComputedTiming().endTime;
        const r = n.getBoundingClientRect();
        an.currentTime = t0; an.play();
        const at = `${i + 1}枚目 ${Math.round(r.left - card.left)}〜${Math.round(r.right - card.left)} × ${Math.round(r.top - card.top)}〜${Math.round(r.bottom - card.top)}`;
        if (r.left < card.left - 0.5 || r.right > card.right + 0.5 || r.top < card.top - 0.5 || r.bottom > card.bottom + 0.5) out.card.push(at);
        if (r.left < sheet.left - 0.5 || r.right > sheet.right + 0.5) out.sheet.push(at);
        for (const [name, b] of parts) {
          if (r.left < b.right - 0.5 && r.right > b.left + 0.5 && r.top < b.bottom - 0.5 && r.bottom > b.top + 0.5) out.over.push(`${at} が ${name} の上`);
        }
      });
      const kids = [...pop.children], ans = kids.map((n) => n.getAnimations()[0] || null), word = parts.find((x) => x[0] === '見出しの字');
      out.cross = []; out.steps = 0;
      if (word && ans.every(Boolean)) {
        const at0 = ans.map((an) => an.currentTime), end = Math.max(...ans.map((an) => an.effect.getComputedTiming().endTime)), b = word[1];
        ans.forEach((an) => an.pause());
        for (let t = 0; t <= end; t += 20) {
          out.steps++;
          ans.forEach((an) => { an.currentTime = t; });
          kids.forEach((n, i) => {
            const r = n.getBoundingClientRect();
            if (r.left < b.right - 0.5 && r.right > b.left + 0.5 && r.top < b.bottom - 0.5 && r.bottom > b.top + 0.5) out.cross.push(`${i + 1}枚目 ${t}ms`);
          });
        }
        ans.forEach((an, i) => { an.currentTime = at0[i]; an.play(); });
      }
      out.path = kids.map((n) => { const s = getComputedStyle(n); return ['--pvc-x', '--pvc-y', '--pvc-r'].map((k) => s.getPropertyValue(k).trim()).join(' '); });
      out.w = Math.round(card.width); out.h = Math.round(card.height);
      window.__pvcFar = out;
    });
    mo.observe(document.querySelector('.pvc-root .pvc-main'), { childList: true, subtree: true });
  });
  const farOf = (p) => p.page.evaluate(() => window.__pvcFar);
  /* 保存後のカードの2つのボタンが、スクロールしない最初の1画面のどこに在るか */
  const reachOf = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), main = r.querySelector('.pvc-main');
    const fold = Math.min(main.getBoundingClientRect().bottom, window.innerHeight);
    const box = (sel) => { const n = r.querySelector(sel); if (!n) return null; const x = n.getBoundingClientRect(); return { top: Math.round(x.top), bottom: Math.round(x.bottom), h: Math.round(x.height) }; };
    return { scroll: main.scrollTop, top: Math.round(main.getBoundingClientRect().top), fold: Math.round(fold),
      edit: box('.pvc-saved [data-pvc-act="edit"]'), more: box('.pvc-saved [data-pvc-act="more"]'), sum: box('.pvc-saved .pvc-sum'),
      held: box('.pvc-saved [data-pvc-held]'), rows: r.querySelectorAll('.pvc-saved .pvc-sum .pvc-sum-r').length };
  });
  const reached = (x) => x.scroll === 0 && !!x.edit && !!x.more && [x.edit, x.more].every((b) => b.top >= x.top && b.bottom <= x.fold && b.h >= 44);
  /* いま焦点が在る所（保存後は見出し。そこから Tab 1回でボタンへ行けるか、を見るのに使う） */
  const focusAt = (p) => p.page.evaluate(() => {
    const n = document.activeElement;
    return { head: !!(n && n.matches && n.matches('.pvc-root .pvc-saved-h')), inCard: !!(n && n.closest && n.closest('.pvc-root .pvc-saved')),
      tag: n ? n.tagName.toLowerCase() : '', text: n ? (n.textContent || '').trim().slice(0, 20) : '' };
  });

  const workRows = async (slug) => (await q(
    `select period_year as y, period_month as m, "position" as pos, fleet, block_hours::float8 as block_hours,
            duty_hours::float8 as duty_hours, work_days, duty_days, days_off, stay_nights,
            duty_hours_basis, commute_included, note
       from public.pv_work_months where airline = $1 order by period_year desc, period_month desc`, [slug])).rows;
  const condRows = async (slug) => {
    const o = {};
    for (const r of (await q(
      `select question_id as q, answer_code as c, answer_codes as cs, answer_text as t
         from public.airline_conditions where airline = $1`, [slug])).rows) {
      (o[r.q] = o[r.q] || []).push({ c: r.c, cs: r.cs ? [...r.cs].sort() : null, t: r.t });
    }
    return o;
  };
  const payKey = async (id) => J((await q(
    `select access_until, pay_report_count, last_pay_report_at, badge, verify_level,
            (select count(*)::int from public.pay_reports) as reports
       from public.profiles where id = $1`, [id])).rows[0]);

  /* 大きさと溢れを測る */
  const measure = (p) => p.page.evaluate(() => {
    const root = document.querySelector('.pvc-root'), sheet = root.querySelector('.pvc-sheet'), main = root.querySelector('.pvc-main');
    const sr = sheet.getBoundingClientRect();
    const out = {
      small: [], tiny: [], font: [], over: [],
      sheet: { x: sr.left, y: sr.top, w: sr.width, h: sr.height },
      vw: document.documentElement.clientWidth, vh: window.innerHeight,
      mainX: main.scrollWidth - main.clientWidth, sheetX: sheet.scrollWidth - sheet.clientWidth,
      docX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
    const name = (n) => n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : '') + (n.name ? '[' + n.name + ']' : '');
    const vis = (n) => {
      if (n.closest('[hidden]')) return false;
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    for (const n of sheet.querySelectorAll('a[href], button, select, textarea, input:not([type="checkbox"]), label.pvc-chip, label.pvc-own')) {
      if (!vis(n)) continue;
      const r = n.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) out.small.push(`${name(n)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (const n of sheet.querySelectorAll('select, textarea, input:not([type="checkbox"])')) {
      if (!vis(n)) continue;
      const fs = parseFloat(getComputedStyle(n).fontSize);
      if (fs < 16) out.font.push(`${name(n)} ${fs}px`);
    }
    const w = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = w.nextNode())) {
      if (!t.nodeValue.trim()) continue;
      const el = t.parentElement;
      if (!el || el.closest('option') || !vis(el)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) out.tiny.push(`${name(el)} ${fs}px「${t.nodeValue.trim().slice(0, 12)}」`);
    }
    for (const n of sheet.querySelectorAll('*')) {
      if (n.closest('svg') && n.tagName.toLowerCase() !== 'svg') continue;
      if (!vis(n)) continue;
      const r = n.getBoundingClientRect();
      if (r.left < sr.left - 0.5 || r.right > sr.right + 0.5) out.over.push(`${name(n)} ${Math.round(r.left)}〜${Math.round(r.right)}`);
    }
    return out;
  });
  function checkSize(m, label) {
    ok(m.small.length === 0, `${label}：押せる所が 44px 未満になっていない`, J(m.small.slice(0, 6)));
    ok(m.font.length === 0, `${label}：入力欄の文字が 16px 以上`, J(m.font.slice(0, 6)));
    ok(m.tiny.length === 0, `${label}：12px 未満の文字が無い`, J(m.tiny.slice(0, 6)));
    ok(m.over.length === 0 && m.mainX <= 0 && m.sheetX <= 0 && m.docX <= 0, `${label}：面が横に溢れていない`,
      J({ over: m.over.slice(0, 5), mainX: m.mainX, sheetX: m.sheetX, docX: m.docX }));
  }
  /* 1つの場面が途中で止まっても、残りの場面は見る */
  async function scene(title, fn) {
    console.log(`\n════ ${title} ════`);
    try { await fn(); } catch (e) { ok(false, `「${title}」が最後まで進んだ`, String(e && e.message || e).split('\n')[0].slice(0, 220)); }
  }

  const A = memberOf('a'), B = memberOf('b');
  const JAL = '/airlines/jal.html', EY = '/airlines/etihad.html';
  const nameOf = (p) => p.page.evaluate(() => (document.body.getAttribute('data-pvc-name') || '').trim()
    || (document.querySelector('.hero-airline h1') || {}).textContent.trim());

  // ═════════════════════════════════════════════════════════════
  // 2. 開く・閉じる・履歴（日本航空・1440×820・会員A）
  // ═════════════════════════════════════════════════════════════
  const a = await open('desk', { who: 'a' });
  let jalName = '';
  await scene('開く・閉じる・履歴', async () => {
    await go(a, '/pv-vocab.json');                       // 「前に居たページ」の役
    await go(a, JAL);
    jalName = await nameOf(a);
    const before = await snap(a);
    const real = await press(a, '');
    console.log(`  （入口：${real ? 'ページに在る data-pvc-open' : 'ページにまだ無いので、同じ属性の試験用ボタン'}）`);
    await waitView(a, 'list');
    let s = await snap(a);
    ok(s.open && s.title === `${jalName}に情報を追加`, '入口を押すと面が開き、見出しが「{会社}に情報を追加」', J(s));
    ok(s.len === before.len + 1 && s.href === before.href && s.mark, '開くと履歴を1段だけ積む（住所は同じ）', J({ before: before.len, after: s.len, href: s.href }));
    ok(s.lock === 'hidden' && s.inside, '開いている間は下のページが動かず、焦点が面の中に在る', J(s));
    const asked = await a.page.evaluate(() => {
      const sh = document.querySelector('.pvc-sheet');
      return { field: !!sh.querySelector('[name="airline"], [name="company"], [name="airline_other"]'), dialog: sh.getAttribute('role') === 'dialog' && sh.getAttribute('aria-modal') === 'true' };
    });
    ok(!asked.field && asked.dialog, '会社を選ぶ欄が無い（会社ページの会社がそのまま使われる）', J(asked));

    let escaped = false;
    for (let i = 0; i < 14; i++) {
      await a.page.keyboard.press('Tab');
      if (!(await a.page.evaluate(() => document.querySelector('.pvc-sheet').contains(document.activeElement)))) escaped = true;
    }
    for (let i = 0; i < 3; i++) {
      await a.page.keyboard.down('Shift'); await a.page.keyboard.press('Tab'); await a.page.keyboard.up('Shift');
      if (!(await a.page.evaluate(() => document.querySelector('.pvc-sheet').contains(document.activeElement)))) escaped = true;
    }
    ok(!escaped, 'Tab を何度押しても、焦点が面の外へ出ない');

    await a.page.keyboard.press('Escape');
    await waitClosed(a);
    s = await snap(a);
    const back = await a.page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-test-hit'));
    ok(!s.open && !s.mark && s.lock !== 'hidden' && s.href === before.href, 'Esc で閉じる（履歴の印も、ページの固定も残らない）', J(s));
    ok(back, '閉じると、焦点が押した入口へ戻る');

    await press(a, '');
    await waitView(a, 'list');
    await a.page.mouse.click(60, 400);                   // 面の外（暗い所）
    await waitClosed(a);
    ok(!(await snap(a)).open, '暗い所を押すと閉じる');

    await press(a, '');
    await waitView(a, 'list');
    await a.page.click('.pvc-root .pvc-close');
    await waitClosed(a);
    ok(!(await snap(a)).open, '× で閉じる');

    await press(a, '');
    await waitView(a, 'list');
    await a.page.goBack({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    await waitClosed(a);
    s = await snap(a);
    ok(!s.open && s.href === before.href, '★ブラウザの「戻る」で閉じる（ページからは出ない）', J(s));
    await a.page.goForward({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    await waitView(a, 'list');
    ok((await snap(a)).open, '「進む」で同じ面へ戻れる');
    await a.page.goBack({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    await waitClosed(a);

    /* 開いたまま読み直す → 面は閉じていて、「戻る」1回で前のページへ出られる */
    await press(a, '');
    await waitView(a, 'list');
    await a.page.reload({ waitUntil: 'domcontentloaded' });
    await a.page.waitForFunction(() => !!window.PVContrib && !(history.state && history.state.pvc));
    s = await snap(a);
    ok(!s.open && !s.mark, '開いたまま読み直すと、面は閉じていて履歴の印も残っていない', J(s));
    await a.page.goBack({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    await a.page.waitForFunction(() => location.pathname !== '/airlines/jal.html', { timeout: 8000 }).catch(() => {});
    const where = await a.page.evaluate(() => location.pathname);
    ok(where === '/pv-vocab.json', '★読み直したあと「戻る」1回で前のページへ出る（1段取り残さない）', where);

    /* 住所の ?add= で開く。開いたら住所から外す。 */
    await go(a, JAL + '?add=work');
    await waitView(a, 'work');
    s = await snap(a);
    ok(s.open && s.form === 'work' && s.href === JAL, '?add=work で月の勤務が開き、住所から add が外れる', J(s));
    await a.page.goBack({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    await waitClosed(a);
    s = await snap(a);
    ok(!s.open && s.href === JAL, '?add= で開いた面も「戻る」で閉じ、add は戻ってこない', J(s));
    await go(a, JAL + '?x=1&add=taxi');
    await waitView(a, 'taxi');
    s = await snap(a);
    ok(s.form === 'taxi' && s.href === JAL + '?x=1', '?add=taxi で通勤・タクシーが開く（ほかの印は残す）', J(s));
  });

  /* ページが自分で読み込むようになっても、検査が差し込んでも、部品は1つだけ。
     何かの拍子に2回読まれても、面も履歴の段も2つにならない。 */
  await scene('部品は1つだけ（2回読み込まれても）', async () => {
    await go(a, JAL);
    const one = await a.page.evaluate(() => ({
      js: document.querySelectorAll('script[src*="pv-contrib.js"]').length,
      css: document.querySelectorAll('link[href*="pv-contrib.css"]').length,
      byPage: !document.querySelector('script[src*="pv-contrib.js"][data-test-injected]'),
    }));
    console.log(`  （部品：${one.byPage ? 'ページが自分で読み込んでいる' : 'ページはまだ読み込んでいないので、検査が差し込んだ'}）`);
    ok(one.js === 1 && one.css === 1, '★pv-contrib.js と pv-contrib.css は1枚に1つずつ（検査が二重に差し込んでいない）', J(one));
    await a.page.evaluate(() => { window.__pvcApi = window.PVContrib; });
    await a.page.addScriptTag({ url: base + '/pv-contrib.js?again=1' });
    const same = await a.page.evaluate(() => window.__pvcApi === window.PVContrib);
    const before = await snap(a);
    await press(a, 'work');
    await waitView(a, 'work');
    const s = await snap(a);
    const roots = await a.page.evaluate(() => document.querySelectorAll('.pvc-root').length);
    ok(same && roots === 1 && s.len === before.len + 1, '★2回読み込まれても、面は1つ・履歴の段も1つ', J({ same, roots, before: before.len, after: s.len }));
    await a.page.keyboard.press('Escape');
    await waitClosed(a);
    const end = await snap(a);
    ok(!end.open && !end.mark && end.href === before.href, '2回読み込まれたあとも、Esc 1回で閉じて履歴の印が残らない', J(end));
  });

  // ═════════════════════════════════════════════════════════════
  // 3. 月の勤務（日本航空・会員A）
  // ═════════════════════════════════════════════════════════════
  let keyBefore = '', lsBefore = null, ym = '';
  await scene('月の勤務 ── 1項目だけ・0 と未回答・直す', async () => {
    keyBefore = await payKey(A.id);
    await go(a, JAL);
    lsBefore = await a.page.evaluate(() => localStorage.getItem('pv_salary_unlock_expiry'));
    await api(a, 'list');
    await waitView(a, 'list');
    await a.page.click('.pvc-root [data-pvc-tile="work"]');
    await waitView(a, 'work');
    const f = await a.page.evaluate(() => {
      const r = document.querySelector('.pvc-root'), sel = r.querySelector('select[name="ym"]');
      const n = new Date(), y = n.getFullYear(), m = n.getMonth();
      const pad = (x) => String(x).padStart(2, '0');
      return {
        title: r.querySelector('.pvc-title').textContent, line: r.querySelector('.pvc-ctx-line').textContent,
        ym: sel.value, last: m === 0 ? `${y - 1}-12` : `${y}-${pad(m)}`, now: `${y}-${pad(m + 1)}`,
        first: sel.options[0].value, tail: sel.options[sel.options.length - 1].value,
        nums: [...r.querySelectorAll('form input.pvc-input')].map((x) => x.name),
        sels: [...r.querySelectorAll('form select')].map((x) => x.name),
        send: r.querySelector('.pvc-send').disabled, sendText: r.querySelector('.pvc-send').textContent,
        prev: !r.querySelector('.pvc-prev').hidden, tag: !r.querySelector('[data-pvc-own-row]').hidden,
        firstOpt: ['duty_hours_basis', 'commute_included', 'fleet'].map((k) => r.querySelector(`select[name="${k}"]`).options[0].textContent),
        fleets: r.querySelector('select[name="fleet"]').options.length - 1,
        noteMax: r.querySelector('textarea[name="note"]').getAttribute('maxlength'),
        own: r.querySelector('.pvc-own').innerText.trim(),
      };
    });
    ym = f.ym;
    const vocab = JSON.parse(read('pv-vocab.json'));
    ok(f.title === '月の勤務' && f.line.includes(jalName) && f.line.includes(`${+ym.slice(0, 4)}年${+ym.slice(5)}月`), '見出しは「月の勤務」。会社と対象月が上に出ている', J(f.line));
    ok(f.ym === f.last && f.first === f.now && f.tail === '2015-01', '対象月は先月が既定。未来の月と 2015年より前は選べない', J({ ym: f.ym, first: f.first, tail: f.tail }));
    ok(J(f.nums) === J(NUM_KEYS), '数字の欄はちょうど6つ（乗務時間・勤務/拘束時間・勤務した日・乗務した日・公休日・ステイ）', J(f.nums));
    ok(J(f.sels) === J(['ym', 'fleet', 'position', 'duty_hours_basis', 'commute_included']), '選ぶ欄は 対象月・機種・職位・数え方・通勤 の5つ（会社は無い）', J(f.sels));
    ok(f.firstOpt.every((t) => t === '回答しない'), '任意の選ぶ欄は、先頭が「回答しない」', J(f.firstOpt));
    ok(f.fleets === vocab.fleets.filter((x) => !x.retired).length, '機種の選択肢はサイトの語彙（pv-vocab.json）と同じ数', `${f.fleets}`);
    ok(f.noteMax === '500' && f.own === '本人が直接経験した内容です', 'ひとことは 500字まで。「本人が直接経験した内容です」の確認が在る', J({ max: f.noteMax, own: f.own }));
    ok(f.send && f.sendText === '匿名で追加する' && !f.tag && f.prev, '確認を入れるまで送れない。ボタンは「匿名で追加する」', J(f));

    await pick(a, 'position', 'cap');
    await tick(a);
    ok(!(await a.page.$eval('.pvc-root .pvc-send', (n) => n.disabled)), '確認を入れると送れるようになる');
    await send(a);
    await waitMsg(a, 'said');
    ok(/1つ以上/.test(await msg(a, 'said')) && hits(a, 'submit_work_month') === 0, '数字が1つも無いまま送ると、その場で言う（サーバへは投げない）', J(await msg(a, 'said')));

    /* ── 1項目だけ ── */
    await fill(a, 'block_hours', '62.5');
    await send(a);
    await waitView(a, 'saved');
    let sm = await summary(a);
    let rows = await workRows('jal');
    ok(sm.head === '情報を追加しました' && sm.rows.block_hours.v === '62.5時間' && !sm.rows.block_hours.none, '★1項目だけで保存できる。見出しは「情報を追加しました」・保存した値がそのまま出る', J({ head: sm.head, v: sm.rows.block_hours }));
    ok(NUM_KEYS.filter((k) => k !== 'block_hours').every((k) => sm.rows[k].none && sm.rows[k].v === NONE), '★入れていない5項目は「未回答」と出る（0 と出ない）', J(sm.rows));
    ok(rows.length === 1 && rows[0].block_hours === 62.5 && NUM_KEYS.filter((k) => k !== 'block_hours').every((k) => rows[0][k] === null),
      '★保存先でも、入れていない5項目は空（null）のまま ── 0 で埋めていない', J(rows));
    ok(rows.length === 1 && `${rows[0].y}-${String(rows[0].m).padStart(2, '0')}` === ym && rows[0].pos === 'cap' && rows[0].fleet === null && rows[0].note === null,
      '保存された月・職位が画面のとおり。選ばなかった機種・ひとことは空', J(rows[0]));
    const ev = await a.page.evaluate(() => window.__pvcSaved);
    ok(ev.length === 1 && ev[0].topic === 'work' && ev[0].slug === 'jal', "保存できたら 'pvc:saved'（topic・slug）がページに流れる", J(ev));
    ok(!/REAL PAY|解放|アンロック/.test(sm.text.replace(DUTY_TERM, '')), '保存後の画面は「REAL PAY が開く」と言わない');
    const acts = await a.page.evaluate(() => [...document.querySelectorAll('.pvc-root .pvc-saved-a button')].map((n) => n.getAttribute('data-pvc-act') + ':' + n.textContent));
    ok(J(acts) === J(['edit:自分の回答を見る', 'more:もう1項目を答える']), '保存後に「自分の回答を見る」「もう1項目を答える」が、この順で在る', J(acts));

    /* ── 保存できた合図（短いクラッカー）── 保存1回につき1度だけ ── */
    let cues = await cueLog(a);
    ok(J(cues) === J(POP), '★保存できたら、合図（紙片10枚）が1度だけ出る', J(cues));
    const f1 = await focusAt(a);
    await a.page.keyboard.press('Tab');
    const f2 = await focusAt(a);
    ok(f1.head && f2.inCard && f2.tag === 'button' && f2.text === '自分の回答を見る',
      '保存後は焦点が「情報を追加しました」の見出しへ移り、Tab 1回で「自分の回答を見る」に届く', J({ f1, f2 }));
    /* 閉じて、同じ項目をもう一度開く ── 出るのは入力の画面で、合図は戻らない（保存していないので） */
    await a.page.evaluate(() => window.PVContrib.close());
    await waitClosed(a);
    await api(a, 'work');
    await waitView(a, 'work');
    cues = await cueLog(a);
    let now = await cueNow(a);
    ok(J(cues) === J(POP) && now.mark === null && !now.pop, '★閉じて同じ項目を開き直しただけでは、合図は鳴らない', J({ cues, now }));

    /* ── 読み直す ── */
    await go(a, JAL);
    await api(a, 'work');
    await waitView(a, 'work');
    cues = await cueLog(a);
    now = await cueNow(a);
    ok(cues.length === 0 && now.mark === null && !now.pop, '★ページを読み直しただけでは、合図は鳴らない', J({ cues, now }));
    let v = await vals(a);
    const ph = await a.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.pvc-root form input.pvc-input')].map((n) => [n.name, n.placeholder])));
    const meta = await a.page.evaluate(() => ({ tag: !document.querySelector('.pvc-root [data-pvc-own-row]').hidden, send: document.querySelector('.pvc-root .pvc-send').textContent }));
    ok(parseFloat(v.block_hours) === 62.5 && v.position === 'cap' && v.ym === ym, '★読み直すと、保存した1項目が戻っている', J(v));
    ok(NUM_KEYS.filter((k) => k !== 'block_hours').every((k) => v[k] === '' && ph[k] === NONE), '★残りの5項目は空欄で「未回答」と出ている（0 が入っていない）', J({ v, ph }));
    ok(meta.tag && meta.send === '匿名で更新する', '自分の投稿には「あなたの投稿」の札。ボタンは「匿名で更新する」', J(meta));

    /* ── 0 を足す ── */
    await fill(a, 'days_off', '0');
    await tick(a);
    await send(a);
    await waitView(a, 'saved');
    sm = await summary(a);
    rows = await workRows('jal');
    ok(sm.rows.days_off.v === '0日' && !sm.rows.days_off.none, '★0 は「0日」と出る（未回答にならない）', J(sm.rows.days_off));
    ok(rows.length === 1 && rows[0].days_off === 0 && rows[0].block_hours === 62.5 && rows[0].stay_nights === null,
      '★保存先でも 0 は 0・未回答は空のまま。同じ月は1行のまま置き換わる', J(rows));
    /* 同じ月を置き換えた回 ── 行は増えていないので「追加しました」とは言わない。合図は同じ形で1度 */
    cues = await cueLog(a);
    ok(sm.head === '情報を更新しました' && J(cues) === J(POP), '★置き換えた回の見出しは「情報を更新しました」（「追加しました」と言わない）。合図はこの回も1度だけ', J({ head: sm.head, cues }));
    await a.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(a, 'work');
    v = await vals(a);
    ok(v.days_off === '0' && parseFloat(v.block_hours) === 62.5 && v.stay_nights === '', '「自分の回答を見る」で開き直すと、0 は 0・未回答は空欄で入っている', J(v));
    cues = await cueLog(a);
    ok(J(cues) === J(POP), '「自分の回答を見る」で入力の画面へ戻っても、合図は増えない', J(cues));

    /* ── 月を変える ── */
    const other = await a.page.evaluate(() => document.querySelector('.pvc-root select[name="ym"]').options[3].value);
    await pick(a, 'ym', other);
    await waitView(a, 'work');
    v = await vals(a);
    const m2 = await a.page.evaluate(() => ({ tag: !document.querySelector('.pvc-root [data-pvc-own-row]').hidden, send: document.querySelector('.pvc-root .pvc-send').textContent }));
    ok(v.ym === other && NUM_KEYS.every((k) => v[k] === '') && v.position === 'cap' && !m2.tag && m2.send === '匿名で追加する',
      '投稿の無い月へ移ると数字は空・札は消える（職位は引き継ぐ）', J({ v, m2 }));
    await pick(a, 'ym', ym);
    await waitView(a, 'work');
    v = await vals(a);
    ok(v.days_off === '0' && parseFloat(v.block_hours) === 62.5, '投稿した月へ戻すと、保存した内容がまた出る', J(v));
  });

  await scene('月の勤務 ── サーバが断ったとき・送れなかったとき', async () => {
    const cue0 = J(await cueLog(a));                      // ここから先は1度も保存できない ＝ 合図の控えが1つも増えないこと
    /* ── サーバが断る ── */
    await fill(a, 'block_hours', '250');
    await tick(a);
    let n0 = hits(a, 'submit_work_month');
    await send(a);
    await waitMsg(a, 'said');
    let v = await vals(a);
    let rows = await workRows('jal');
    const m1 = await msg(a, 'said');
    const inv = await a.page.$eval('.pvc-root input[name="block_hours"]', (n) => n.getAttribute('aria-invalid'));
    ok(hits(a, 'submit_work_month') === n0 + 1 && /乗務時間/.test(m1) && /範囲/.test(m1), '★範囲の外の数字は、サーバの言った理由がそのまま出る', J(m1));
    ok(v.block_hours === '250' && v.days_off === '0' && inv === 'true', '★断られても、打った字は1文字も消えない（どの欄かも分かる）', J(v));
    ok(rows.length === 1 && rows[0].block_hours === 62.5, '断られた回は、保存先が1文字も変わっていない', J(rows));

    await fill(a, 'block_hours', '70');
    await fill(a, 'duty_hours', 'abc');
    await send(a);
    await a.page.waitForFunction(() => {
      const n = document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="said"]');
      return !!n && /数字/.test(n.textContent);
    });
    v = await vals(a);
    ok(v.duty_hours === 'abc' && v.block_hours === '70', '数字に読めない字は、こちらで直さずサーバに断らせる（打った字は残る）', J({ m: await msg(a, 'said'), v }));

    await fill(a, 'duty_hours', '');
    await fill(a, 'work_days', '20');
    await fill(a, 'days_off', '20');
    await send(a);
    await a.page.waitForFunction(() => {
      const n = document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="said"]');
      return !!n && /合計/.test(n.textContent);
    });
    ok(true, '欄をまたぐ断り（勤務日数＋公休日数がその月の日数を超える）も、そのまま出る');
    rows = await workRows('jal');
    ok(rows[0].block_hours === 62.5 && rows[0].days_off === 0 && rows[0].work_days === null, '断られ続けても、保存先は元のまま', J(rows));

    /* ── 送れない（サーバが落ちている） ── */
    await fill(a, 'work_days', '');
    await fill(a, 'days_off', '0');
    await failNext('submit_work_month');
    await send(a);
    await waitMsg(a, 'fail');
    const m2 = await msg(a, 'fail');
    v = await vals(a);
    rows = await workRows('jal');
    let ob = await outboxOf(a);
    ok(/送れていません/.test(m2) && /もう一度送る/.test(m2), '★サーバが落ちていたら「送れていません」と言い、「もう一度送る」を出す', J(m2));
    ok(v.block_hours === '70' && v.days_off === '0' && v.work_days === '' && v.position === 'cap', '★送れなかった回も、打った内容がそのまま残っている', J(v));
    ok(!!ob && rows[0].block_hours === 62.5, '送れなかった内容はこの端末に控えてある。保存先は変わっていない（保存したふりをしない）', J({ ob: !!ob, rows }));
    ok(!(await a.page.$('.pvc-root [data-pvc-saved]')), '送れなかった回に、保存後の画面を出していない');
    ok(J(await cueLog(a)) === cue0 && !(await cueNow(a)).pop, '★断られた回・送れなかった回には、保存できた合図を1度も出していない', J({ before: cue0, after: await cueLog(a) }));

    /* ── 読み直しても、もう一度送れる ── */
    await go(a, JAL);
    await api(a, 'list');
    await waitView(a, 'list');
    await waitMsg(a, 'unsent');
    ok(/送れていない回答/.test(await msg(a, 'unsent')), '★読み直しても「送れていない回答があります」と出る', J(await msg(a, 'unsent')));
    await a.page.click('.pvc-root [data-pvc-act="resume"]');
    await waitView(a, 'work');
    await waitMsg(a, 'fail');
    v = await vals(a);
    ok(v.block_hours === '70' && v.days_off === '0' && v.ym === ym && v.own === true, '「続きを開く」で、送れなかった内容がそのまま戻る', J(v));
    await a.page.click('.pvc-root [data-pvc-act="retry"]');
    await waitView(a, 'saved');
    rows = await workRows('jal');
    ob = await outboxOf(a);
    ok(rows.length === 1 && rows[0].block_hours === 70 && rows[0].days_off === 0, '★「もう一度送る」で保存される', J(rows));
    ok(ob === null, '送れたら、端末の控えは消える', String(ob));
    /* 読み直してからここまで、合図は1つも出ていなかった（控えを開いただけ）。送れたこの回に、初めて1度だけ出る */
    ok(J(await cueLog(a)) === J(POP), '★送れなかった控えを開いただけでは鳴らず、「もう一度送る」で保存できた回に1度だけ鳴る', J(await cueLog(a)));
    await go(a, JAL);
    await api(a, 'list');
    await waitView(a, 'counted');
    ok((await msg(a, 'unsent')) === null, '送れたあとは「送れていない回答」と言わない');

    /* ── 鍵 ── */
    const keyAfter = await payKey(A.id);
    const lsAfter = await a.page.evaluate(() => localStorage.getItem('pv_salary_unlock_expiry'));
    ok(keyAfter === keyBefore && lsAfter === lsBefore, '★勤務を何度保存しても、給与の鍵は1つも動かない（期限・件数・バッジ・給与の行数）', J({ keyBefore, keyAfter, lsBefore, lsAfter }));
  });

  // ═════════════════════════════════════════════════════════════
  // 4. 通勤・タクシー（日本航空・会員A）
  // ═════════════════════════════════════════════════════════════
  const TAXI = ['commuting_transport', 'commuting_transport_method', 'commuting_taxi_when', 'commuting_taxi_where',
    'commuting_taxi_cost', 'commuting_taxi_cap', 'commuting_bus_when', 'commuting_bus_cost'];
  const shown = (p) => p.page.evaluate(() => {
    const o = {};
    for (const n of document.querySelectorAll('.pvc-root form [data-q]')) o[n.getAttribute('data-q')] = !n.closest('[hidden]');
    const fold = document.querySelector('.pvc-root [data-q-fold]');
    o.fold = !!fold && !fold.hidden;
    o.panel = !!fold && !fold.querySelector('.pvc-fold-p').hidden;
    return o;
  });
  await scene('通勤・タクシー ── 親と子を1回で・読み直す・上書き', async () => {
    const conds = JSON.parse(read('pv-conditions.json'));
    const taxiIds = conds.questions.filter((x) => x.topic === 'taxi').map((x) => x.id);
    ok(J([...taxiIds].sort()) === J([...TAXI].sort()), '通勤・タクシーの質問は、サイトの質問表（pv-conditions.json）の8問', J(taxiIds));

    await go(a, JAL);
    await api(a, 'taxi');
    await waitView(a, 'taxi');
    let sh = await shown(a);
    const shape = await a.page.evaluate(() => {
      const f = document.querySelector('.pvc-root form[data-pvc-form="taxi"]');
      const ta = [...f.querySelectorAll('textarea')];
      return {
        title: document.querySelector('.pvc-root .pvc-title').textContent, line: f.querySelector('.pvc-ctx-line').textContent,
        text: f.querySelectorAll('input[type="text"], input:not([type])').length,
        ta: ta.map((n) => n.name), req: ta.filter((n) => n.required).length,
        /* 補足は必ず、選ぶ質問に付いている（その質問の枠の中か、同じ畳みの中。補足だけが独りで立っていない） */
        owned: ta.every((n) => {
          const q = f.querySelector('[data-q="' + n.name.replace(/_note$/, '') + '"]');
          if (!q || !q.querySelector('select, input[type="checkbox"], input[type="radio"]')) return false;
          const fold = n.closest('.pvc-fold');
          return q.contains(n) || (!!fold && fold === q.closest('.pvc-fold'));
        }),
        choice: [...f.querySelectorAll('[data-q]')].filter((n) => n.querySelector('select, input[type="checkbox"], input[type="radio"]')).map((n) => n.getAttribute('data-q')),
        capInFold: !!f.querySelector('[name="commuting_taxi_cap_note"]').closest('.pvc-fold'),
        fold: f.querySelector('.pvc-fold-b').textContent, exp: f.querySelector('.pvc-fold-b').getAttribute('aria-expanded'),
        send: f.querySelector('.pvc-send').textContent, dis: f.querySelector('.pvc-send').disabled,
        company: !!f.querySelector('[name="airline"], [name="company"]'),
      };
    });
    ok(shape.title === '通勤・タクシー' && shape.line.includes(jalName) && !shape.company, '見出しは「通勤・タクシー」。会社は上に出ていて、選ぶ欄は無い', J(shape));
    ok(sh.commuting_transport && TAXI.slice(1).every((k) => !sh[k]) && !sh.fold, '最初に出るのは親の質問だけ（子は親の答えが決まってから）', J(sh));
    /* 2026-10-07 オーナー指定：選んだ答えに、任意の補足を添えられる。
       ただし自由記述は「追加の説明」で、選ぶ質問の代わりにはしない ── 8問とも選ぶ形のまま残っていること。 */
    ok(J([...shape.choice].sort()) === J([...TAXI].sort()), '★タクシーの具体的な質問は8つとも「選ぶ質問」のまま残っている（自由記述に置き換えていない）', J(shape.choice));
    ok(shape.text === 0 && J([...shape.ta].sort()) === J(TAXI.map((k) => k + '_note').sort()) && shape.owned && shape.req === 0,
      '★自由記述は「質問ごとの補足」だけ。どれも任意で、選ぶ質問の枠の中に在る（何でも受ける独立の欄は無い）', J(shape));
    ok(shape.capInFold, '上限の補足は、今までどおり畳んだ中に在る', J(shape));
    ok(shape.fold.includes('回数・金額の上限を追加') && shape.exp === 'false' && shape.dis && shape.send === '匿名で追加する', '上限は「回数・金額の上限を追加」で畳んである。確認を入れるまで送れない', J(shape));

    await pick(a, 'commuting_transport', 'no');
    sh = await shown(a);
    ok(TAXI.slice(1).every((k) => !sh[k]), '「提供されない」を選ぶと、子の質問は出ない', J(sh));
    await pick(a, 'commuting_transport', 'conditional');
    sh = await shown(a);
    ok(sh.commuting_transport_method && !sh.commuting_taxi_when && !sh.commuting_bus_when && !sh.fold, '条件つきで提供 → 「どの形で」だけが出る', J(sh));
    await chip(a, 'commuting_transport_method', 'company_taxi');
    sh = await shown(a);
    ok(sh.commuting_taxi_when && sh.commuting_taxi_where && sh.commuting_taxi_cost && sh.fold && !sh.commuting_bus_when && !sh.commuting_bus_cost,
      'タクシーを選ぶと タクシーの いつ・どこまで・誰の負担・上限 が出る（バスは出ない）', J(sh));
    await chip(a, 'commuting_transport_method', 'crew_bus');
    sh = await shown(a);
    ok(sh.commuting_bus_when && sh.commuting_bus_cost, 'クルーバスも選ぶと、バスの質問も出る', J(sh));

    await chip(a, 'commuting_taxi_when', 'unknown');
    await chip(a, 'commuting_taxi_when', 'no_public_transport');
    await chip(a, 'commuting_taxi_when', 'standby_callout');
    let v = await vals(a);
    ok(J([...v.commuting_taxi_when].sort()) === J(['no_public_transport', 'standby_callout']), '「わからない」は、ほかの答えと一緒には残らない', J(v.commuting_taxi_when));
    await chip(a, 'commuting_bus_when', 'any_time');
    await pick(a, 'commuting_taxi_where', 'within_area');
    await pick(a, 'commuting_taxi_cost', 'company_full');
    await a.page.click('.pvc-root .pvc-fold-b');
    sh = await shown(a);
    ok(sh.panel && (await a.page.$eval('.pvc-root .pvc-fold-b', (n) => n.getAttribute('aria-expanded'))) === 'true', '「回数・金額の上限を追加」を押すと開く', J(sh));
    await pick(a, 'commuting_taxi_cap', 'per_month');
    await fill(a, 'commuting_taxi_cap_note', '月の回数に上限があります');
    /* バスの費用はわざと答えない（質問は8つ・答えは7つ ＝ 件数が質問の数にならないことを見る） */
    await tick(a);
    const n0 = hits(a, 'submit_airline_conditions');
    await a.page.evaluate(() => { window.__pvcSaved = []; });
    await send(a);
    await waitView(a, 'saved');
    let db = await condRows('jal');
    const sm = await summary(a);
    ok(hits(a, 'submit_airline_conditions') === n0 + 1, '★親と子の答えを、1回の送信でまとめて送る', `${hits(a, 'submit_airline_conditions') - n0} 回`);
    ok(Object.keys(db).length === 7 && Object.values(db).every((x) => x.length === 1) && !db.commuting_bus_cost,
      '★答えた7問がそれぞれ1行ずつ保存された（答えていない1問は入っていない）', J(Object.keys(db)));
    ok(db.commuting_transport[0].c === 'conditional' && J(db.commuting_transport_method[0].cs) === J(['company_taxi', 'crew_bus'])
      && J(db.commuting_taxi_when[0].cs) === J(['no_public_transport', 'standby_callout']) && J(db.commuting_bus_when[0].cs) === J(['any_time'])
      && db.commuting_taxi_where[0].c === 'within_area' && db.commuting_taxi_cost[0].c === 'company_full'
      && db.commuting_taxi_cap[0].c === 'per_month' && db.commuting_taxi_cap[0].t === '月の回数に上限があります',
      '保存された答えが、画面で選んだとおり（上限の補足も）', J(db));
    ok(sm.head === '情報を追加しました' && Object.keys(sm.rows).filter((k) => TAXI.includes(k)).length === 7 && !!sm.rows.commuting_taxi_cap_note,
      '保存後の画面に、保存した答えが並ぶ（初めて答えた回の見出しは「情報を追加しました」）', J({ head: sm.head, rows: Object.keys(sm.rows) }));
    const ev = await a.page.evaluate(() => window.__pvcSaved);
    ok(ev.length === 1 && ev[0].topic === 'taxi' && ev[0].slug === 'jal', "保存できたら 'pvc:saved'（topic: taxi）が流れる", J(ev));
    let cues = await cueLog(a);
    const f1 = await focusAt(a);
    await a.page.keyboard.press('Tab');
    const f2 = await focusAt(a);
    ok(J(cues) === J(POP), '★質問に答えて保存できた回も、合図は1度だけ出る', J(cues));
    ok(f1.head && f2.inCard && f2.tag === 'button' && f2.text === '自分の回答を見る', '保存後は焦点が見出しへ移り、Tab 1回で「自分の回答を見る」に届く（質問の項目でも）', J({ f1, f2 }));

    /* ── 読み直す ── */
    await go(a, JAL + '?add=taxi');
    await waitView(a, 'taxi');
    v = await vals(a);
    const tags = await a.page.evaluate(() => ({
      n: document.querySelectorAll('.pvc-root form [data-q] .pvc-label .pvc-mine').length,
      fold: !!document.querySelector('.pvc-root .pvc-fold-b .pvc-mine'),
      send: document.querySelector('.pvc-root .pvc-send').textContent,
    }));
    ok(v.commuting_transport === 'conditional' && J([...v.commuting_transport_method].sort()) === J(['company_taxi', 'crew_bus'])
      && J([...v.commuting_taxi_when].sort()) === J(['no_public_transport', 'standby_callout']) && v.commuting_taxi_where === 'within_area'
      && v.commuting_taxi_cost === 'company_full' && v.commuting_taxi_cap === 'per_month' && v.commuting_taxi_cap_note === '月の回数に上限があります'
      && v.commuting_bus_cost === '', '★読み直すと、保存した答えが入った状態で開く（答えていない質問は空のまま）', J(v));
    ok(tags.n === 7 && tags.fold && tags.send === '匿名で更新する', '答えた質問には「あなたの投稿」の札。ボタンは「匿名で更新する」', J(tags));

    await tick(a);
    let n1 = hits(a, 'submit_airline_conditions');
    await send(a);
    await waitMsg(a, 'same');
    ok(hits(a, 'submit_airline_conditions') === n1, '何も変えずに送ると「保存済みの内容と同じです」と言う（サーバへは投げない）', J(await msg(a, 'same')));
    cues = await cueLog(a);
    ok(cues.length === 0 && !(await cueNow(a)).pop, '★読み直しただけ・「保存済みの内容と同じ」と言われただけでは、合図は鳴らない', J(cues));

    /* ── 上書き ── */
    await pick(a, 'commuting_taxi_cost', 'partial');
    await send(a);
    await waitView(a, 'saved');
    db = await condRows('jal');
    ok(db.commuting_taxi_cost.length === 1 && db.commuting_taxi_cost[0].c === 'partial' && Object.keys(db).length === 7 && db.commuting_taxi_where[0].c === 'within_area',
      '★答え直すと上書きされる（行は増えない・ほかの答えはそのまま）', J(db.commuting_taxi_cost));
    /* 答えを1つ直しただけ ── 行は増えていないので「追加しました」とは言わない */
    const head2 = (await summary(a)).head;
    cues = await cueLog(a);
    ok(head2 === '情報を更新しました' && J(cues) === J(POP), '★答え直しただけの回の見出しは「情報を更新しました」（「追加しました」と言わない）。合図は1度だけ', J({ head2, cues }));

    /* ── 送れない（通信が切れる） ── */
    await a.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(a, 'taxi');
    await pick(a, 'commuting_taxi_where', 'door_to_door');
    await tick(a);
    /* ★1回だけ切ると、この失敗は画面まで届かない ── 使い回していた接続が切れたとき、ブラウザは同じ要求を
         黙ってもう1回だけ送り直す（サーバの記録には「切れた・200」の2本が残り、ページからは1本にしか見えない）。
         なので、切れ続ける状態にしてから送り、「送れていません」が出たところで元へ戻す。 */
    await failNext('submit_airline_conditions', 'drop', 9);
    await send(a);
    await waitMsg(a, 'fail');
    await failOff();
    v = await vals(a);
    db = await condRows('jal');
    ok(/送れていません/.test(await msg(a, 'fail')) && v.commuting_taxi_where === 'door_to_door' && db.commuting_taxi_where[0].c === 'within_area' && !!(await outboxOf(a)),
      '★通信が切れた回は「送れていません」。選んだ答えは残り、保存先は変わらず、端末に控えが在る', J({ v: v.commuting_taxi_where, db: db.commuting_taxi_where }));
    cues = await cueLog(a);
    ok(J(cues) === J(POP), '★通信が切れた回には、合図を出していない（控えは前の1回ぶんのまま）', J(cues));
    await a.page.click('.pvc-root [data-pvc-act="retry"]');
    await waitView(a, 'saved');
    db = await condRows('jal');
    ok(db.commuting_taxi_where[0].c === 'door_to_door' && (await outboxOf(a)) === null, '「もう一度送る」で保存され、控えが消える', J(db.commuting_taxi_where));
    cues = await cueLog(a);
    ok(J(cues) === J([...POP, ...POP]), '★同じ画面のまま保存を2回 ＝ 合図も2回（保存1回につき1度・多くも少なくもない）', J(cues));

    /* ── サーバが一部だけ断ったとき（返事を試験用に差し替えて、画面の言い方だけを見る） ── */
    await a.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(a, 'taxi');
    await pick(a, 'commuting_taxi_where', 'to_set_point');
    await pick(a, 'commuting_taxi_cost', 'self_full');
    await tick(a);
    a.st.fake = { name: 'submit_airline_conditions', body: { ok: true, airline: 'jal', saved: 1, skipped: 0,
      rejected: [{ question_id: 'commuting_taxi_cost', reason: 'parent_missing' }], answered_total: 7, questions_total: 48 } };
    await send(a);
    await waitMsg(a, 'rej');
    const rj = await msg(a, 'rej');
    const label = conds.questions.find((x) => x.id === 'commuting_taxi_cost').ja.label;
    ok(/保存できなかった項目があります/.test(rj) && rj.includes(label) && /上の質問の答えと合わない/.test(rj) && !/parent_missing/.test(rj),
      '★一部だけ断られたら、どの質問がなぜ保存されなかったかを普通の言葉で言う（記号のまま出さない）', J(rj));
    ok(!(await a.page.$('.pvc-root [data-pvc-saved]')) && (await vals(a)).commuting_taxi_cost === 'self_full', '断られた答えは画面に残っていて、保存後の画面は出さない');
    /* 一部は保存できているので 'pvc:saved' は流れる（下のページの数字を取り直すため）。それでも成功の合図にはしない
       ── 目の前に「保存できなかった項目があります」と出ているのに、紙片が散るのは嘘になる。 */
    cues = await cueLog(a);
    ok(J(cues) === J([...POP, ...POP]) && !(await cueNow(a)).pop, '★一部だけ断られた回には、保存できた合図を出さない', J(cues));
  });

  // ═════════════════════════════════════════════════════════════
  // 5. 件数（サーバが返した本人の行数だけ）
  // ═════════════════════════════════════════════════════════════
  await scene('「あなたの投稿 N件」', async () => {
    await go(a, JAL);
    await api(a, 'list');
    await waitView(a, 'counted');
    const scr = await a.page.evaluate(() => {
      const o = {};
      for (const n of document.querySelectorAll('.pvc-root [data-pvc-count]')) o[n.getAttribute('data-pvc-count')] = n.hidden ? null : n.textContent;
      return { counts: o, state: document.querySelector('.pvc-root [data-pvc-state]').getAttribute('data-pvc-state') };
    });
    const srv = await a.page.evaluate(async () => {
      const sb = await window.PVCareer.client();
      const w = await sb.rpc('my_work_months', { p: { airline: 'jal' } });
      const c = await sb.rpc('my_airline_conditions', { p: { airline: 'jal' } });
      return { work: w.data.rows.length, ids: c.data.answers.filter((x) => !x.airline || x.airline === 'jal').map((x) => x.question_id) };
    });
    const taxiN = srv.ids.filter((id) => TAXI.includes(id)).length;
    ok(scr.state === 'ok ok' && scr.counts.work === `あなたの投稿 ${srv.work}件` && srv.work === (await workRows('jal')).length,
      '★勤務の件数 ＝ サーバが本人について返した行数', J({ scr: scr.counts.work, srv: srv.work }));
    ok(scr.counts.taxi === `あなたの投稿 ${taxiN}件` && taxiN === 7 && TAXI.length === 8,
      '★通勤・タクシーの件数 ＝ 本人の答えの数（7）。質問の数（8）ではない', J({ scr: scr.counts.taxi, taxiN }));
    ok(['staff_travel', 'upgrade', 'roster', 'career', 'benefits', 'stay'].every((k) => scr.counts[k] === null),
      '★答えていない項目には件数を出さない（質問が何問あっても）', J(scr.counts));
  });

  /* 保存の口がまだ無い（関数が貼られていない・呼ぶ権限が無い）ときは「準備中です」。
     保存したふりも、「送れていません（もう一度送る）」もしない。返事は試験用に差し替える。 */
  await scene('まだ用意されていないとき（準備中）', async () => {
    const MISSING = { code: 'PGRST202', message: 'Could not find the function in the schema cache', details: null, hint: null };
    const DENIED = { code: '42501', message: 'permission denied for function', details: null, hint: null };
    const w0 = J(await workRows('jal')), c0 = J(await condRows('jal'));

    await go(a, JAL);
    await api(a, 'work');
    await waitView(a, 'work');
    await fill(a, 'stay_nights', '6');
    await tick(a);
    a.st.fake = { name: 'submit_work_month', status: 404, body: MISSING };
    await send(a);
    await waitMsg(a, 'off');
    let m = await msg(a, 'off');
    let v = await vals(a);
    ok(/準備中/.test(m) && !/もう一度送る/.test(m), '★保存の口がまだ無いときは「準備中です」と言う（「もう一度送る」は出さない）', J(m));
    ok(v.stay_nights === '6' && !(await a.page.$('.pvc-root [data-pvc-saved]')) && (await outboxOf(a)) === null && J(await workRows('jal')) === w0,
      '★準備中の回も、打った字は残る。保存後の画面を出さず、保存先も端末の控えも変わらない', J(v));
    ok((await cueLog(a)).length === 0 && !(await cueNow(a)).pop, '★準備中の回（月の勤務）には、保存できた合図を出していない', J(await cueLog(a)));

    await go(a, JAL);
    await api(a, 'taxi');
    await waitView(a, 'taxi');
    const cur = (await vals(a)).commuting_taxi_where;
    const next = cur === 'within_area' ? 'door_to_door' : 'within_area';
    await pick(a, 'commuting_taxi_where', next);
    await tick(a);
    a.st.fake = { name: 'submit_airline_conditions', status: 403, body: DENIED };
    await send(a);
    await waitMsg(a, 'off');
    m = await msg(a, 'off');
    v = await vals(a);
    ok(/準備中/.test(m) && v.commuting_taxi_where === next && !(await a.page.$('.pvc-root [data-pvc-saved]')) && J(await condRows('jal')) === c0,
      '★通勤・タクシーも同じ（呼ぶ権限が無いとき）。選んだ答えは残り、保存先は変わらない', J({ m, v: v.commuting_taxi_where }));
    ok((await cueLog(a)).length === 0 && !(await cueNow(a)).pop, '★準備中の回（通勤・タクシー）にも、保存できた合図を出していない', J(await cueLog(a)));

    /* 読む側の口が無いとき：件数を 0 とも言わず、数も出さない */
    a.st.fake = { name: 'my_work_months', status: 404, body: MISSING };
    await go(a, JAL);
    await api(a, 'list');
    await waitView(a, 'counted');
    const scr = await a.page.evaluate(() => {
      const st = document.querySelector('.pvc-root [data-pvc-state]'), c = document.querySelector('.pvc-root [data-pvc-count="work"]');
      return { state: st.getAttribute('data-pvc-state'), text: st.hidden ? '' : st.textContent, work: c.hidden ? null : c.textContent };
    });
    ok(scr.state === 'off ok' && /準備中/.test(scr.text) && scr.work === null && !/0件|まだありません/.test(scr.text),
      '★読む側の口が無いときは、勤務の件数を出さず「準備中」と言う（0件とも「まだありません」とも言わない）', J(scr));
    a.st.fake = null;
  });

  /* 保存はできたが、「足したのか・置き換えたのか」をサーバが言わなかったとき（その答えを返さない古い版）。
     分からないものを「追加しました」と言い切らない ── 見出しは「保存しました」のまま。保存はできているので合図は同じ形で1度。
     返事は試験用に差し替える（＝ この回は保存先へ届かない。画面の言い方だけを見る）。 */
  await scene('足したのか置き換えたのか、サーバが言わなかったとき', async () => {
    const w0 = J(await workRows('jal'));
    await go(a, JAL);
    await api(a, 'work');
    await waitView(a, 'work');
    await a.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [data-pvc-own-row]'); return !!n && !n.hidden; });
    await fill(a, 'stay_nights', '6');
    await tick(a);
    a.st.fake = { name: 'submit_work_month', body: { ok: true, saved: true, year: +ym.slice(0, 4), month: +ym.slice(5) } };
    await send(a);
    await waitView(a, 'saved');
    const sm = await summary(a);
    const cues = await cueLog(a);
    ok(sm.head === '保存しました' && sm.rows.stay_nights.v === '6泊', '★足したのか置き換えたのか分からない回の見出しは「保存しました」（「追加しました」と言い切らない）', J({ head: sm.head, v: sm.rows.stay_nights }));
    ok(J(cues) === J(POP), '分からない回も保存はできている ＝ 合図は1度だけ出る', J(cues));
    ok(J(await workRows('jal')) === w0, '（差し替えた返事なので、保存先は1文字も変わっていない）');
    a.st.fake = null;
  });

  // ═════════════════════════════════════════════════════════════
  // 6. 未ログイン（エティハド・390×680）
  // ═════════════════════════════════════════════════════════════
  const b = await open('phone');
  let eyName = '';
  await scene('未ログイン ── ログインなしで保存・同じ端末から読み直して直す・ログインで引き継ぐ', async () => {
    const keyB0 = await payKey(B.id);
    await go(b, EY + '?add=list');
    await waitView(b, 'counted');
    eyName = await nameOf(b);
    const L = await b.page.evaluate(() => {
      const r = document.querySelector('.pvc-root');
      const tiles = [...r.querySelectorAll('[data-pvc-tile]')].map((n) => ({
        k: n.getAttribute('data-pvc-tile'), tag: n.tagName, t: n.querySelector('.pvc-tile-t').textContent, d: n.querySelector('.pvc-tile-d').textContent,
        to: n.tagName === 'A' ? new URL(n.href).pathname + new URL(n.href).search + new URL(n.href).hash : '',
      }));
      const talk = r.querySelector('.pvc-talk');
      return {
        title: r.querySelector('.pvc-title').textContent, cap: r.querySelector('.pvc-cap').textContent, lead: r.querySelector('.pvc-lead').textContent,
        talk: talk.textContent.trim(), talkTo: new URL(talk.href).pathname + new URL(talk.href).search, tiles,
        counts: [...r.querySelectorAll('[data-pvc-count]')].filter((n) => !n.hidden || n.textContent).length,
        state: r.querySelector('[data-pvc-state]').getAttribute('data-pvc-state'), stateShown: !r.querySelector('[data-pvc-state]').hidden,
        held: !r.querySelector('[data-pvc-heldslot]').hidden,
        text: r.querySelector('.pvc-main').innerText, under: r.querySelector('.pvc-under').textContent, href: location.pathname + location.search,
      };
    });
    ok(L.title === `${eyName}に情報を追加` && L.href === EY, '?add=list で項目の一覧が開く（未ログインでも）', J({ t: L.title, href: L.href }));
    ok(L.cap === 'BUILD IT TOGETHER' && L.lead === `${eyName}のこと、ひとつ教えて。` && L.talk === '匿名で話す' && L.talkTo === '/submit-review.html?airline=etihad',
      '見本どおりの入口の箱（BUILD IT TOGETHER／ひとつ教えて。／匿名で話す → 口コミの画面）', J({ cap: L.cap, lead: L.lead, talk: L.talkTo }));
    const by = Object.fromEntries(L.tiles.map((t) => [t.k, t]));
    const INSIDE = ['work', 'taxi', 'staff_travel', 'upgrade', 'roster', 'career', 'benefits'];
    ok(J(L.tiles.map((t) => t.k)) === J([...INSIDE, 'stay']),
      'タイルは 勤務・通勤/タクシー・Staff Travel・機長昇格・勤務スケジュール・訓練/キャリア・休暇/手当・ホテル/ステイ の8つ', J(L.tiles.map((t) => t.t)));
    ok(INSIDE.every((k) => by[k].tag === 'BUTTON') && by.stay.tag === 'A'
      && by.stay.to === EY + '#stay' && by.stay.d === 'パイロット限定',
      '★答えられる7つは全部、面の中で開く（ほかの画面へ送り出さない＝会社を選び直させない）。ホテル・ステイは、このページの「ステイ先」のタブへ行く', J(L.tiles));
    ok(L.counts === 0 && L.state === 'anon anon' && !L.stateShown && !L.held && !/\d+\s*件/.test(L.text) && !/あなたの投稿/.test(L.text),
      '★まだ何も出していない人には件数を1つも出さない（「あなたの投稿」の字も、預かりの案内も出ない）', J({ counts: L.counts, state: L.state }));
    ok(hits(b, 'my_work_months') === 0 && hits(b, 'my_airline_conditions') === 0 && hits(b, 'my_contrib_anon') === 0,
      '鍵を持たない端末は、何も読みに行かない（通信ゼロ）', J(b.st.calls));
    ok(/ひとつ/.test(L.under) && /ログインは要りません/.test(L.under), '「ひとつの項目から追加できます。ログインは要りません。」の一言が在る', L.under);
    checkSize(await measure(b), '390×680 一覧（未ログイン・エティハド）');

    /* ── 打つ → 送る → その場で保存（ログインへ行かない） ── */
    await b.page.click('.pvc-root [data-pvc-tile="work"]');
    await waitView(b, 'work');
    const hint = await b.page.$eval('.pvc-root [data-pvc-wait]', (n) => (n.hidden ? '' : n.textContent));
    ok(/ログインなしで保存できます/.test(hint) && /この端末から確認・修正できます/.test(hint), '送る前に「ログインなしで保存できます。この端末から確認・修正できます」と言う', hint);
    const ym2 = (await vals(b)).ym;
    await pick(b, 'position', 'fo');
    await fill(b, 'block_hours', '0');
    await fill(b, 'stay_nights', '3');
    await fill(b, 'note', '夏ダイヤの月');
    checkSize(await measure(b), '390×680 月の勤務（入力中）');
    const cols = await b.page.evaluate(() => {
      const f = [...document.querySelectorAll('.pvc-root form .pvc-grid > .pvc-field')].slice(0, 2).map((n) => n.getBoundingClientRect());
      return { sameRow: Math.abs(f[0].top - f[1].top) < 2, sameLeft: Math.abs(f[0].left - f[1].left) < 2 };
    });
    ok(!cols.sameRow && cols.sameLeft, '390px では入力欄が1列に並ぶ（見本の2列を1列に）', J(cols));
    ok(await b.page.$eval('.pvc-root .pvc-send', (n) => n.disabled), '「本人が直接経験した内容です」を入れるまで送れない（未ログインでも同じ）');
    await tick(b);
    await farWatch(b);   // 紙片がいちばん遠くまで散ったときの位置を測る支度
    await send(b);
    await waitView(b, 'saved');
    const pend = async () => (await q(`select kind, airline, item_key, payload from public.pv_contrib_pending where airline = 'etihad' order by id`)).rows;
    const keys = async () => (await q(`select key_hash from public.pv_contrib_keys`)).rows.map((r) => r.key_hash);
    const devKey = () => b.page.evaluate(() => localStorage.getItem('pv_contrib_key') || '');
    const held = async (key) => (await (await fetch(`${base}/rest/v1/rpc/my_contrib_anon`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ p: { key, airline: 'etihad' } }),
    })).json());
    let pd = await pend();
    const k1 = await devKey();
    const kh = await keys();
    ok((await snap(b)).href === EY && hits(b, 'submit_contrib_anon') === 1 && hits(b, 'submit_work_month') === 0,
      '★送ってもログインへ行かない。同じ会社ページのまま、預かりの口へ1回だけ送る', J({ href: (await snap(b)).href, calls: b.st.calls }));
    ok(pd.length === 1 && pd[0].kind === 'work' && (await workRows('etihad')).length === 0,
      '★保存先はサーバの預かり（1件）。会員の表にはまだ入らない ＝ 引き継ぐまで会社ごとの集計に入らない', J(pd.map((r) => [r.kind, r.item_key])));
    ok(k1.length >= 32 && kh.length === 1 && kh[0] !== k1 && !J(pd).includes(k1) && !kh.join().includes(k1),
      '★本人のしるしは、サーバが作った推測できない鍵。端末にだけ在り、サーバは鍵そのものを持たない', J({ len: k1.length, keys: kh.length }));
    let mine = await held(k1);
    const r0 = (mine.rows || [])[0] || {};
    ok(mine.ok && mine.known && (mine.rows || []).length === 1 && r0.block_hours === 0 && r0.stay_nights === 3 && r0.duty_hours === null && r0.days_off === null,
      '★乗務時間 0 は 0 のまま・入れていない欄は未回答のまま預かっている', J(r0));
    const sm = await summary(b);
    ok(sm.head === '情報を追加しました' && sm.rows.block_hours.v === '0時間' && !sm.rows.block_hours.none && sm.rows.duty_hours.none && sm.rows.stay_nights.v === '3泊',
      '保存後の画面でも「0時間」と「未回答」が別のものとして出る（ログインなしで初めて預けた回も「情報を追加しました」）', J({ head: sm.head, rows: sm.rows }));
    ok(/ログインなしで保存しました/.test(sm.text) && /この端末から確認・修正できます/.test(sm.text) && /ログインして引き継いだあと/.test(sm.text) && /90日で消えます/.test(sm.text),
      '★保存後に、どこに残り・いつ集計に入り・いつ消えるかを言う（「サーバに保存した」ことをブラウザ内の保存と混ぜない）', sm.text.replace(/\s+/g, ' ').slice(0, 200));
    ok(await b.page.$('.pvc-root [data-pvc-act="claim"]') && await b.page.$('.pvc-root [data-pvc-act="edit"]') && await b.page.$('.pvc-root [data-pvc-act="more"]'),
      '保存後に「ログインして引き継ぐ」「自分の回答を見る」「もう1項目を答える」が在る');

    /* ── 保存できた合図（390×680・ログインなし ＝ いちばん狭く、断りの箱も入る回）── */
    let cues = await cueLog(b);
    ok(J(cues) === J(POP), '★ログインなしで保存できた回も、合図は1度だけ出る', J(cues));
    const far = await farOf(b);
    ok(!!far && far.n === 10 && far.still === 0 && far.card.length === 0 && far.sheet.length === 0,
      '★紙片は10枚とも、いちばん遠くまで散ってもカードの中に収まる（見出しの外・面の外へ出ない）', J(far));
    ok(!!far && far.clip === 'hidden hidden' && far.fill && far.touch === 'none' && far.hidden === 'true',
      '紙片の層はカードの形で切り、押せず、読み上げにも出ない（下の見出しとボタンにそのまま触れる）', J(far));
    ok(!!far && far.n === 10 && far.still === 0 && far.parts === 4 && far.over.length === 0,
      '★紙片は10枚とも、散り終わりの位置で見出しの字・チェックの印・2つのボタンのどれにも重ならない（390×680）', J(far && { parts: far.parts, over: far.over }));
    /* いちばん狭い画面（幅340pxまで）では、左へ飛ぶ3枚を右上へ向け直してある（下の 13 が見る）。
       その直しは狭い画面だけのもの ＝ これより広い画面の散り方は、今までの向きのまま。 */
    ok(!!far && J(far.path) === J(POP_PATH) && far.path.filter((x) => /^-/.test(x)).length === 3,
      '★390×680 では、紙片10枚の散る向きは今までのまま（いちばん狭い画面だけの向きの直しが、広い画面へ漏れていない）', J(far && far.path));
    /* 2つのボタンは、保存した内容（10行）より先。スクロールしなくても最初の1画面で両方に届く */
    const reach = await reachOf(b);
    ok(reached(reach),
      '★390×680 では、スクロールしなくても「自分の回答を見る」「もう1項目を答える」の両方に届く（断りの箱が在っても）', J(reach));
    ok(!!reach.sum && reach.rows >= 10 && !!reach.more && !!reach.edit && reach.sum.top >= Math.max(reach.edit.bottom, reach.more.bottom),
      '保存した内容の一覧は、2つのボタンの下に並ぶ（一覧が長くてもボタンを押し下げない）', J(reach));
    /* 紙片は 0.9秒で消え、1.4秒で層ごと片づく。片づいたあとも「保存できた」の印はカードに残る（描き直していない証拠） */
    const gone = await popGone(b);
    const settled = await cueNow(b);
    ok(!settled.pop && settled.mark === 'pop', '★紙片の層は、散り終わったら自分で片づく（画面に残り続けない）', J(settled));
    ok(gone.ms !== null && gone.ms >= POP_MIN && gone.late === false,
      '★片づくのは散り終わったあと・設計の1.4秒から大きく遅れない（0.9秒〜2.5秒のあいだ。「いつか消えればよい」にしない）', J({ ms: gone.ms, late: gone.late, min: POP_MIN, max: POP_MAX }));
    checkSize(await measure(b), '390×680 月の勤務（保存後）');
    const geo = await measure(b);
    ok(Math.abs(geo.sheet.w - geo.vw) < 1 && Math.abs(geo.sheet.y + geo.sheet.h - geo.vh) < 1 && geo.sheet.h >= geo.vh * 0.9 && geo.sheet.h < geo.vh,
      '390px では下から上がってくる面（幅いっぱい・高さはほぼ全面）', J(geo.sheet));

    /* ── 読み直す（同じ端末） → 直す ── */
    await go(b, EY + '?add=work');
    await waitView(b, 'work');
    await b.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [name="stay_nights"]'); return !!n && n.value === '3'; });
    let v = await vals(b);
    ok(v.block_hours === '0' && v.stay_nights === '3' && v.position === 'fo' && v.ym === ym2 && v.note === '夏ダイヤの月' && v.duty_hours === '',
      '★読み直すと、預けた内容がサーバから戻っている（0 は 0・空欄は空欄・ひとことも）', J(v));
    ok(hits(b, 'my_contrib_anon') >= 1 && hits(b, 'my_work_months') === 0 && hits(b, 'my_airline_conditions') === 0,
      '読み直しは預かりの口から（会員の口は呼ばない）', J(b.st.calls));
    cues = await cueLog(b);
    ok(cues.length === 0 && !(await cueNow(b)).pop, '★読み直して預けた内容が戻っただけでは、合図は鳴らない（ログインなしでも）', J(cues));
    await fill(b, 'stay_nights', '4');
    await tick(b);
    await send(b);
    await waitView(b, 'saved');
    pd = await pend();
    mine = await held(k1);
    ok(pd.length === 1 && (mine.rows || []).length === 1 && mine.rows[0].stay_nights === 4 && mine.rows[0].block_hours === 0 && (await devKey()) === k1 && (await keys()).length === 1,
      '★本人が直せる（同じ1件が置き換わる。行も鍵も増えない）', J(mine.rows));
    const head2 = (await summary(b)).head;
    cues = await cueLog(b);
    ok(head2 === '情報を更新しました' && J(cues) === J(POP), '★預けた1件を直した回の見出しは「情報を更新しました」（件数は増えていない）。合図は1度だけ', J({ head2, cues }));

    /* ── 通信が切れた回 → もう一度送る ── */
    await b.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(b, 'work');
    await fill(b, 'work_days', '18');
    await tick(b);
    await failNext('submit_contrib_anon', 'drop', 9);
    await send(b);
    await waitMsg(b, 'fail');
    await failOff();
    v = await vals(b);
    mine = await held(k1);
    ok(/送れていません/.test(await msg(b, 'fail')) && v.work_days === '18' && mine.rows[0].work_days === null && !!(await outboxOf(b)),
      '★送れなかった回は「送れていません」。入れた字は残り、預かりは変わらず、端末に控えが在る', J({ v: v.work_days, held: mine.rows[0].work_days }));
    cues = await cueLog(b);
    ok(J(cues) === J(POP), '★送れなかった回には、合図を出していない（控えは前の1回ぶんのまま）', J(cues));
    await b.page.click('.pvc-root [data-pvc-act="retry"]');
    await waitView(b, 'saved');
    mine = await held(k1);
    ok(mine.rows[0].work_days === 18 && mine.rows[0].stay_nights === 4 && (await outboxOf(b)) === null, '「もう一度送る」で保存され、控えが消える', J(mine.rows[0]));
    cues = await cueLog(b);
    ok(J(cues) === J([...POP, ...POP]), '★同じ画面のまま保存を2回 ＝ 合図も2回（ログインなしでも、保存1回につき1度）', J(cues));

    /* ── ほかの端末・ほかの人には見えない ── */
    const o = await open('phone');
    await go(o, EY + '?add=list');
    await waitView(o, 'counted');
    const oc = await o.page.evaluate(() => ({
      counts: [...document.querySelectorAll('.pvc-root [data-pvc-count]')].filter((n) => !n.hidden).length,
      held: !document.querySelector('.pvc-root [data-pvc-heldslot]').hidden, key: localStorage.getItem('pv_contrib_key'),
    }));
    await o.page.click('.pvc-root [data-pvc-tile="work"]');
    await waitView(o, 'work');
    const ov = await vals(o);
    ok(oc.counts === 0 && !oc.held && oc.key === null && ov.block_hours === '' && ov.stay_nights === '' && ov.note === '' && hits(o, 'my_contrib_anon') === 0,
      '★鍵を持たないほかの端末には、件数も中身も出ない（読みにも行かない）', J({ oc, ov: [ov.block_hours, ov.stay_nights, ov.note] }));
    await o.st.ctx.close();
    const guess = await held('x'.repeat(k1.length));
    const noKey = await held('');
    const asMember = await (await fetch(`${base}/rest/v1/rpc/my_work_months`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${(await (await fetch(`${base}/__local/login?member=c`)).json()).session.access_token}` },
      body: JSON.stringify({ p: { airline: 'etihad' } }),
    })).json();
    ok(!(guess.rows || []).length && !(guess.answers || []).length && !(noKey.rows || []).length && !((asMember && asMember.rows) || []).length,
      '★当て推量の鍵・鍵なし・ログインしただけの別の会員 ── どれにも預かりの中身は返らない', J({ guess, noKey }).slice(0, 200));

    /* ── ログインして引き継ぐ ── */
    await go(b, EY + '?add=list');
    await waitView(b, 'counted');
    await b.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [data-pvc-count="work"]'); return !!n && !n.hidden; });
    const before = await b.page.evaluate(() => ({
      work: document.querySelector('.pvc-root [data-pvc-count="work"]').textContent,
      held: !document.querySelector('.pvc-root [data-pvc-heldslot]').hidden,
      text: document.querySelector('.pvc-root [data-pvc-heldslot]').innerText.replace(/\s+/g, ' '),
    }));
    ok(before.work === 'あなたの投稿 1件' && before.held && /ログインなしで保存した回答があります/.test(before.text) && /引き継がれ/.test(before.text),
      '読み直した一覧に「あなたの投稿 1件」と、ログインなしで保存した旨・引き継ぎの案内が出る', J(before));
    await b.page.click('.pvc-root [data-pvc-act="claim"]');
    await b.page.waitForFunction(() => location.pathname === '/login.html');
    const ret = await b.page.evaluate(() => new URLSearchParams(location.search).get('return'));
    ok(ret === EY + '?add=list' && (await workRows('etihad')).length === 0 && (await pend()).length === 1 && (await devKey()) === k1,
      '「ログインして引き継ぐ」でログインへ（戻り先は同じ会社ページ）。この時点では何も動かしていない', J(ret));
    await b.page.waitForSelector('#email');
    await b.page.type('#email', B.email);
    await b.page.type('#password', 'local-pass-1');
    await b.page.click('#login-btn');
    await b.page.waitForFunction((p) => location.pathname === p && !!window.PVContrib, { timeout: 30000 }, EY);
    await b.page.waitForFunction(() => (window.__pvcSaved || []).some((x) => x && x.topic === 'claim'), { timeout: 20000 });
    await waitView(b, 'counted');
    await b.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [data-pvc-count="work"]'); return !!n && !n.hidden; });
    const rows = await workRows('etihad');
    const after = await b.page.evaluate(() => ({
      work: document.querySelector('.pvc-root [data-pvc-count="work"]').textContent,
      held: !document.querySelector('.pvc-root [data-pvc-heldslot]').hidden,
      note: (document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="claim"]') || {}).innerText || '',
      key: localStorage.getItem('pv_contrib_key'), board: !!document.querySelector('.pvgf-back'),
    }));
    ok(hits(b, 'claim_contrib') >= 1 && rows.length === 1 && rows[0].block_hours === 0 && rows[0].stay_nights === 4 && rows[0].work_days === 18
      && rows[0].duty_hours === null && rows[0].pos === 'fo' && rows[0].note === '夏ダイヤの月',
      '★ログインすると、預けた回答が本人の投稿として引き継がれる（0 は 0・未回答は未回答・ひとこともそのまま）', J(rows));
    ok((await pend()).length === 0 && (await keys()).length === 0 && after.key === null,
      '★引き継いだあと、預かりにも鍵にも何も残らない（端末の鍵も捨てる）', J({ pend: (await pend()).length, key: after.key }));
    ok(after.work === 'あなたの投稿 1件' && !after.held && /引き継ぎました/.test(after.note),
      '引き継いだ一覧は会員としての投稿から数え、「ログイン前の回答を引き継ぎました」と知らせる（預かりの案内は消える）', J(after));
    ok(!after.board, '登録だけの会員でも、入力の面を開いている間は Give → Get の板が覆わない');
    /* 引き継ぎでも 'pvc:saved' は流れる（下のページの数字を取り直すため）。ただし、いま新しく保存したものは無い
       ── ログインして戻っただけで紙片が散ると、「保存できた時に1度」の意味が薄まる。 */
    cues = await cueLog(b);
    const back = await cueNow(b);
    ok(cues.length === 0 && back.mark === null && !back.pop, '★ログインして引き継いだだけでは、合図は鳴らない（知らせるのは「引き継ぎました」の一言）', J({ cues, back }));
    const keyB1 = await payKey(B.id);
    ok(keyB1 === keyB0 && /"access_until":null/.test(keyB1),
      '★預けても・引き継いでも、給与の鍵は1つも動かない（期限・件数・バッジ・確認済みの印・給与の行数）', J({ keyB0, keyB1 }));
    ok((await workRows('jal')).length === 1, 'ほかの会社・ほかの会員の行は1つも増えていない');
  });

  // ═════════════════════════════════════════════════════════════
  // 6-b. 話題ごとの質問と、会社ページの質問の名前からの入口（日本航空・会員A）
  // ═════════════════════════════════════════════════════════════
  await scene('話題の分け方 ── 会社ページの入口と同じ・質問の名前から直接開く', async () => {
    const { askGroup } = await import('./gen-career.mjs');
    const conds = JSON.parse(read('pv-conditions.json'));
    const GROUPS6 = ['taxi', 'staff_travel', 'upgrade', 'roster', 'career', 'benefits'];
    const want = Object.fromEntries(GROUPS6.map((g) => [g, conds.questions.filter((x) => askGroup(x.id) === g).map((x) => x.id).sort()]));
    const all = conds.questions.filter((x) => !x.retired).map((x) => x.id);
    ok(all.length >= 40 && all.every((id) => GROUPS6.includes(askGroup(id))), `質問表の ${all.length} 問は、どれも6つの話題のどれかに入る（面で答えられない質問が無い）`,
      J(all.filter((id) => !GROUPS6.includes(askGroup(id)))));
    await go(a, JAL);
    const got = {};
    for (const g of GROUPS6) {
      await api(a, g);
      await waitView(a, g);
      got[g] = await a.page.evaluate(() => [...new Set([...document.querySelectorAll('.pvc-root form [data-q]')].map((n) => n.getAttribute('data-q')))].sort());
      await a.page.evaluate(() => window.PVContrib.close());
      await waitClosed(a);
    }
    const diff = GROUPS6.filter((g) => J(got[g]) !== J(want[g]));
    ok(diff.length === 0, '★6つの話題に出る質問が、会社ページの入口の決め方（askGroup）と1問も違わない', J(diff.map((g) => ({ g, got: got[g], want: want[g] }))));
    ok(['commuting_taxi_cap', 'upgrade_order', 'upgrade_min_hours', 'upgrade_min_tenure'].every((id) => Object.values(got).some((l) => l.includes(id))),
      '★これまで答える場所が無かった4問（タクシー代の上限・昇格の3問）も、面の中に在る', J(got.upgrade));

    /* 会社ページの質問の名前 ── 押すとこの面が、その質問を開いた状態で出る（質問の画面へ行かない） */
    const QID = 'upgrade_order';
    const link = await a.page.evaluate((qid) => {
      const n = document.querySelector('.pvg a[data-pvc-q="' + qid + '"]');
      if (!n) return null;
      const o = { href: n.getAttribute('href'), open: n.getAttribute('data-pvc-open') };
      n.click();
      return o;
    }, QID);
    ok(!!link && link.open === askGroup(QID) && link.href === `../airline-conditions.html?airline=jal&q=${QID}`,
      '会社ページの質問の名前は、面を開く入口になっている（部品が読めない時の行き先も同じ会社・同じ質問）', J(link));
    await waitView(a, askGroup(QID));
    const at = await a.page.evaluate((qid) => {
      const ta = document.querySelector('#pvc-n-' + qid), bt = document.querySelector('.pvc-root [data-q-more="' + qid + '"]');
      const box = document.querySelector('.pvc-root form [data-q="' + qid + '"]'), mn = document.querySelector('.pvc-root .pvc-main').getBoundingClientRect();
      const r = box ? box.getBoundingClientRect() : null;
      return {
        href: location.pathname, noteOpen: !!ta && ta.getClientRects().length > 0, moreHidden: !!bt && bt.hidden,
        seen: !!r && r.top < mn.bottom && r.bottom > mn.top, prev: !document.querySelector('.pvc-root .pvc-prev').hidden,
      };
    }, QID);
    ok(at.href === JAL && at.seen && at.noteOpen && at.moreHidden,
      '★押してもページを離れない。その質問が見えていて、補足の欄はもう開いている', J(at));
    await a.page.evaluate(() => window.PVContrib.close());
    await waitClosed(a);
  });

  // ═════════════════════════════════════════════════════════════
  // 7. 3つの大きさ（日本航空・会員A ── 答えが入った状態）
  // ═════════════════════════════════════════════════════════════
  for (const sizeKey of ['phone', 'tablet', 'desk']) {
    const size = SIZES[sizeKey], tag = `${size.w}×${size.h}`;
    await scene(`大きさ ${tag}`, async () => {
      const p = sizeKey === 'desk' ? a : await open(sizeKey, { who: 'a' });
      await go(p, JAL);
      await api(p, 'list');
      await waitView(p, 'counted');
      let m = await measure(p);
      checkSize(m, `${tag} 一覧`);
      if (size.w >= 768) {
        ok(Math.abs(m.sheet.w - 560) < 1 && Math.abs(m.sheet.x + m.sheet.w - m.vw) < 1 && m.sheet.y < 1 && Math.abs(m.sheet.h - m.vh) < 1,
          `${tag}：右から出る面（幅 560px・高さいっぱい）`, J(m.sheet));
      } else {
        ok(Math.abs(m.sheet.w - m.vw) < 1 && Math.abs(m.sheet.y + m.sheet.h - m.vh) < 1 && m.sheet.h >= m.vh * 0.9 && m.sheet.h < m.vh,
          `${tag}：下から出る面（幅いっぱい・高さはほぼ全面）`, J(m.sheet));
      }
      const dim = await p.page.evaluate(() => {
        const s = document.querySelector('.pvc-root .pvc-scrim'), r = s.getBoundingClientRect(), cs = getComputedStyle(s);
        return { cover: r.left <= 0 && r.top <= 0 && r.right >= document.documentElement.clientWidth && r.bottom >= window.innerHeight, bg: cs.backgroundColor, op: cs.opacity };
      });
      ok(dim.cover && !/^rgba?\(0, 0, 0, 0\)$|transparent/.test(dim.bg), `${tag}：下のページが暗くなる`, J(dim));
      const tiles = await p.page.evaluate(() => {
        const t = [...document.querySelectorAll('.pvc-root .pvc-tiles > li')].slice(0, 2).map((n) => n.getBoundingClientRect());
        return Math.abs(t[0].top - t[1].top) < 2;
      });
      ok(tiles === (size.w >= 768), `${tag}：タイルは${size.w >= 768 ? '2列' : '1列'}`);
      /* 見本では「匿名で話す」が見出しの右。社名が長いと見出しが折れるので、折れるのは塊のあいだだけにしてある */
      const head = await p.page.evaluate(() => {
        const h = document.querySelector('.pvc-root .pvc-lead');
        const parts = [...h.querySelectorAll('.pvc-lead-p')];
        const lead = h.getBoundingClientRect();
        const talk = document.querySelector('.pvc-root .pvc-talk').getBoundingClientRect();
        const lh = parseFloat(getComputedStyle(h).lineHeight);
        return {
          parts: parts.map((n) => n.textContent),
          oneLine: parts.map((n) => n.getBoundingClientRect().height <= lh * 1.5),
          right: talk.left >= lead.right - 1 && talk.top < lead.bottom && talk.bottom > lead.top,
        };
      });
      ok(head.parts.length === 2 && head.parts[1] === 'ひとつ教えて。' && head.oneLine.every(Boolean),
        `${tag}：見出しは「…のこと、」と「ひとつ教えて。」のあいだでしか折れない（語の途中で切れない）`, J(head));
      if (size.w >= 768) ok(head.right, `${tag}：「匿名で話す」は見出しの右に並ぶ（見本どおり）`, J(head));

      await p.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(p, 'work');
      checkSize(await measure(p), `${tag} 月の勤務`);
      const cols = await p.page.evaluate(() => {
        const f = [...document.querySelectorAll('.pvc-root form .pvc-grid > .pvc-field')].slice(0, 2).map((n) => n.getBoundingClientRect());
        return Math.abs(f[0].top - f[1].top) < 2;
      });
      ok(cols === (size.w >= 768), `${tag}：入力欄は${size.w >= 768 ? '2列' : '1列'}`);
      /* 断りが出た状態（数字を全部消して送る） */
      for (const k of NUM_KEYS) await fill(p, k, '');
      await tick(p);
      await send(p);
      await waitMsg(p, 'said');
      checkSize(await measure(p), `${tag} 月の勤務（断りが出た状態）`);
      /* 断りの文は2か所に出る ── 送るボタンの上の箱と、指された欄のすぐ下（同じ文）。
         面は指された欄へ動くので、長い画面では下の箱は画面の外に残る。見るのは
         「同じ文が、どちらかで丸ごと画面の中に在るか」と「指された欄そのものが見えているか」。 */
      const seen = await p.page.evaluate(() => {
        const mn = document.querySelector('.pvc-root .pvc-main').getBoundingClientRect();
        const top = Math.max(mn.top, 0), bottom = Math.min(mn.bottom, window.innerHeight);
        const whole = (n) => { const r = n.getBoundingClientRect(); return r.height > 0 && r.top >= top - 1 && r.bottom <= bottom + 1; };
        const box = document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="said"]');
        const said = box ? box.innerText.replace(/\s+/g, '') : '';
        const errs = [...document.querySelectorAll('.pvc-root .pvc-err')].filter((n) => !n.hidden && n.textContent.trim());
        const bad = document.querySelector('.pvc-root [aria-invalid="true"]');
        return {
          box: !!box && whole(box),
          inline: errs.some((n) => whole(n) && said.includes(n.textContent.replace(/\s+/g, ''))),
          field: !!bad && whole(bad), focus: !!bad && document.activeElement === bad, n: errs.length,
        };
      });
      ok((seen.box || seen.inline) && seen.field && seen.focus, `${tag}：断りの文が、送ったあと画面の中に見えている（指された欄と、その下の同じ文）`, J(seen));

      await p.page.click('.pvc-root .pvc-prev');
      await waitView(p, 'list');
      await p.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(p, 'taxi');
      await p.page.click('.pvc-root .pvc-fold-b');
      await p.page.waitForFunction(() => !document.querySelector('.pvc-root .pvc-fold-p').hidden);
      checkSize(await measure(p), `${tag} 通勤・タクシー（上限を開いた状態）`);
      if (p !== a) await p.st.ctx.close();
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 7-b. 着陸手当 ── 上の答えで出てくる額・数え方（全日本空輸・会員C ／ キャセイ・未ログイン）
  // ═════════════════════════════════════════════════════════════
  /* 2026-10-09。「着陸回数に応じた手当」に「ある」と答えた人にだけ、その場で額と数え方を聞く。
     見るのは5つ ── 上の答えで出る・消える／通貨は本人に選ばせる（円と決めつけない）／
     会社・職位・機種を聞き直さない（月の勤務で出したものを引き継ぐ）／読み直しても戻る／
     上の質問を「ない」に答え直したら、残っている古い額を「あなたの投稿」に数えない・保存した内容として出さない。
     ⚠️ ここで入れる額と文は検査のための作りもの。どの会社の着陸手当でもない。
     会員Aと日本航空を使わないのは、上の場面が「休暇・手当にはまだ1件も無い」ことを見ているため。 */
  const LAND = ['landing_pay_amount', 'landing_pay_unit', 'landing_pay_from', 'landing_pay_to', 'landing_pay_varies_by'];
  const ANA = '/airlines/ana.html', CX = '/airlines/cathay-pacific.html';
  /* サーバへ送った中身を控える（数えるだけの gate では、何を送ったかが分からない） */
  const tap = (p, name) => {
    const sent = [];
    p.page.on('request', (req) => {
      if (!req.url().endsWith('/rest/v1/rpc/' + name)) return;
      try { sent.push(JSON.parse(req.postData() || '{}').p || {}); } catch (e) { /* 読めない本文は控えない */ }
    });
    return sent;
  };
  /* y・m ＝ 適用時期（答えた月）。who を渡すと、その会員の行だけ（渡さなければ、その会社の全員の行）。 */
  const landRows = async (slug, who = null) => (await q(
    `select question_id as q, "position" as pos, fleet, effective_year as y, effective_month as m, answer_num::float8 as num, answer_currency as cur,
            answer_code as c, answer_text as t, text_shared as sh
       from public.airline_conditions where airline = $1::text and question_id like 'landing_pay%'
        and ($2::uuid is null or proof_hash = public.pv_condition_hash($2::uuid, $1::text, null)) order by question_id`, [slug, who ? who.id : null])).rows;
  const benefitsCount = async (p, urlPath) => {
    await go(p, urlPath + '?add=list');
    await waitView(p, 'counted');
    return p.page.evaluate(() => { const n = document.querySelector('.pvc-root [data-pvc-count="benefits"]'); return n.hidden ? null : n.textContent; });
  };
  const famRows = (sm) => Object.keys(sm.rows).filter((k) => /^landing_pay/.test(k)).sort();
  const ids = (pl) => ((pl && pl.answers) || []).map((x) => x.question_id).sort();

  await scene('着陸手当 ── 上の答えで出る・通貨を選ぶ・1回で送る・読み直す・答え直す', async () => {
    const conds = JSON.parse(read('pv-conditions.json'));
    const labelOf = (id) => conds.questions.find((x) => x.id === id).ja.label;
    const c = await open('desk', { who: 'c' });
    const sent = tap(c, 'submit_airline_conditions');

    /* ── まず月の勤務を1件（職位と機種は、ここで出したものを引き継ぐ） ── */
    await go(c, ANA);
    const anaName = await nameOf(c);
    await api(c, 'work');
    await waitView(c, 'work');
    const FLEET = await c.page.$eval('.pvc-root select[name="fleet"]', (n) => n.options[1].value);
    await pick(c, 'position', 'fo');
    await pick(c, 'fleet', FLEET);
    await fill(c, 'block_hours', '60');
    await tick(c);
    await send(c);
    await waitView(c, 'saved');

    /* ── 開く：最初に出るのは上の質問だけ ── */
    await go(c, ANA + '?add=benefits');
    await waitView(c, 'benefits');
    let sh = await shown(c);
    const shape = await c.page.evaluate((fam) => {
      const f = document.querySelector('.pvc-root form[data-pvc-form="benefits"]');
      const order = [...f.querySelectorAll('[data-q]')].map((n) => n.getAttribute('data-q'));
      const at = order.indexOf('landing_pay');
      const cur = f.querySelector('select[name="landing_pay_amount_cur"]');
      return {
        line: f.querySelector('.pvc-ctx-line').textContent,
        again: [...f.querySelectorAll('[name="airline"], [name="company"], [name="position"], [name="fleet"], [name="ym"]')].map((n) => n.name),
        next: order.slice(at + 1, at + 1 + fam.length),
        labels: fam.map((k) => f.querySelector('[data-q="' + k + '"] .pvc-label').textContent),
        cur: cur.value, curFirst: cur.options[0].textContent, curN: cur.options.length - 1,
        curName: cur.getAttribute('aria-label'),
        unit: f.querySelector('[data-q="landing_pay_amount"] .pvc-unit').textContent,
      };
    }, LAND);
    ok(sh.landing_pay && LAND.every((k) => k in sh && !sh[k]), '最初に出るのは「着陸回数に応じた手当はありますか？」だけ（額・数え方はまだ出ない）', J(LAND.map((k) => [k, sh[k]])));
    ok(shape.line.includes(anaName) && shape.line.includes('副操縦士') && shape.again.length === 0,
      '★会社・職位・機種・時期を選び直す欄が無い（会社と職位は上に出ている）', J({ line: shape.line, again: shape.again }));
    ok(J([...shape.next].sort()) === J([...LAND].sort()), '★額・数え方の質問は、着陸手当の質問のすぐ下に並ぶ（離れた所に出ない）', J(shape.next));
    ok(shape.labels.every((t) => t.includes('着陸手当')), '★下の質問は、それだけ読んでも「着陸手当の」額・数え方だと分かる', J(shape.labels));
    ok(shape.cur === '' && shape.curFirst === '通貨を選ぶ' && shape.curN === JSON.parse(read('pv-vocab.json')).currencies.length && shape.curName === labelOf('landing_pay_amount') + 'の通貨',
      '★通貨は最初から何も選ばれていない（円と決めつけない）。選べるのはサイトの通貨の一覧', J({ cur: shape.cur, first: shape.curFirst, n: shape.curN }));
    ok(shape.unit === '（1回あたり）', '額の欄に「（1回あたり）」と出ている', shape.unit);

    /* ── 上の答えで出る・消える（通信しない） ── */
    const calls0 = c.st.calls.length;
    await pick(c, 'landing_pay', 'no');
    sh = await shown(c);
    ok(LAND.every((k) => !sh[k]), '★「ない」を選ぶと、額・数え方は1つも出ない', J(sh));
    await pick(c, 'landing_pay', 'unknown');
    sh = await shown(c);
    ok(LAND.every((k) => !sh[k]), '★「わからない」を選んでも出ない', J(sh));
    await pick(c, 'landing_pay', 'variable');
    sh = await shown(c);
    const noteOpen = await c.page.$eval('.pvc-root textarea[name="landing_pay_varies_by_note"]', (n) => n.getClientRects().length > 0);
    ok(sh.landing_pay_from && sh.landing_pay_to && sh.landing_pay_varies_by && !sh.landing_pay_amount && !sh.landing_pay_unit && noteOpen,
      '★「あり・一定額ではない」→ 低いほう・高いほう・何で変わるか と、その補足の欄がその場に出る（一定額の質問は出ない）', J(sh));
    await pick(c, 'landing_pay', 'fixed');
    sh = await shown(c);
    ok(sh.landing_pay_amount && sh.landing_pay_unit && !sh.landing_pay_from && !sh.landing_pay_to && !sh.landing_pay_varies_by,
      '★「あり・1回あたり一定額」→ 額（通貨つき）と数え方がその場に出る（幅の質問は出ない）', J(sh));
    ok(c.st.calls.length === calls0, '選び直しているあいだは、サーバへ1本も投げない', J(c.st.calls.slice(calls0)));

    /* ── 通貨を選ばずに送る ── */
    await fill(c, 'landing_pay_amount', '1500');
    await tick(c);
    await send(c);
    /* 文が出なくても、ここでは止まらない（下の行を赤くする）。止まると、止めずに送る形に壊れたとき
       「場面が最後まで進まなかった」としか出ず、どの約束が破れたのかが分からない。 */
    await waitMsg(c, 'said').catch(() => null);
    const said = (await msg(c, 'said')) || '';
    const at = await c.page.evaluate(() => document.activeElement && document.activeElement.name);
    ok(said.includes(labelOf('landing_pay_amount')) && /通貨を選んでください/.test(said) && at === 'landing_pay_amount_cur',
      '★額だけ入れて通貨を選ばずに送ると、その場で「通貨を選んでください」と言い、通貨の欄へ移る', J({ said, at }));
    ok(sent.length === 0 && hits(c, 'submit_airline_conditions') === 0 && (await landRows('ana')).length === 0, '   その回は、サーバへ1本も投げていない（通貨の無い額を預けない）', J(sent));

    /* ── 一定額：親・額・数え方を1回で ── */
    await pick(c, 'landing_pay_amount_cur', 'JPY');
    await pick(c, 'landing_pay_unit', 'per_landing');
    await send(c);
    await waitView(c, 'saved');
    let db = await landRows('ana');
    let sm = await summary(c);
    const p1 = sent[0] || {};
    const amt = (p1.answers || []).find((x) => x.question_id === 'landing_pay_amount') || {};
    ok(sent.length === 1 && J(ids(p1)) === J(['landing_pay', 'landing_pay_amount', 'landing_pay_unit']) && amt.num === 1500 && amt.currency === 'JPY',
      '★着陸手当・額（通貨つき）・数え方の3つを、1回の送信でまとめて送る', J(p1.answers));
    ok(p1.airline === 'ana' && p1.position === 'fo' && p1.fleet === FLEET,
      '★1回の送信に、月の勤務で出した職位と機種が付いている', J({ airline: p1.airline, position: p1.position, fleet: p1.fleet }));
    /* 1回の送信は、その送信の条件を全部の行に書く ＝ ここで言えるのは「1回で送った3行は同じ」まで。
       親を前に保存した人が続きだけをあとから送る回（親の条件を引き継ぐか）は、下の 15 の場面が見る。 */
    ok(db.length === 3 && db.every((r) => r.pos === 'fo' && r.fleet === FLEET) && Number.isInteger(db[0].y) && Number.isInteger(db[0].m)
      && db.every((r) => r.y === db[0].y && r.m === db[0].m),
      '★1回の送信で保存した3行は、同じ職位・機種・適用時期を持つ', J(db.map((r) => [r.q, r.pos, r.fleet, r.y, r.m])));
    ok(db.length === 3 && db.find((r) => r.q === 'landing_pay_amount').num === 1500
      && db.find((r) => r.q === 'landing_pay_amount').cur === 'JPY' && db.find((r) => r.q === 'landing_pay_unit').c === 'per_landing',
      '   保存先の額と通貨と数え方が、画面で入れたとおり', J(db.map((r) => [r.q, r.num, r.cur, r.c])));
    ok(sm.head === '情報を追加しました' && J(famRows(sm)) === J(['landing_pay', 'landing_pay_amount', 'landing_pay_unit'])
      && sm.rows.landing_pay_amount.v === 'JPY 1,500（1回あたり）' && sm.rows.landing_pay_unit.v === '着陸1回ごと',
      '★保存後の画面に、自分の答えが通貨つきで出る（JPY 1,500（1回あたり）・着陸1回ごと）', J(sm.rows));

    /* ── 読み直す ── */
    await go(c, ANA + '?add=benefits');
    await waitView(c, 'benefits');
    let v = await vals(c);
    let tags = await c.page.evaluate(() => [...document.querySelectorAll('.pvc-root form [data-q]')]
      .filter((n) => n.querySelector('.pvc-label .pvc-mine')).map((n) => n.getAttribute('data-q')).sort());
    sh = await shown(c);
    ok(v.landing_pay === 'fixed' && v.landing_pay_amount === '1500' && v.landing_pay_amount_cur === 'JPY' && v.landing_pay_unit === 'per_landing'
      && sh.landing_pay_amount && sh.landing_pay_unit, '★読み直すと、着陸手当・額・通貨・数え方が入った状態で開く', J(v));
    ok(J(tags) === J(['landing_pay', 'landing_pay_amount', 'landing_pay_unit']), '答えた3つに「あなたの投稿」の札が付いている', J(tags));
    ok((await benefitsCount(c, ANA)) === 'あなたの投稿 3件', '一覧の「休暇・手当」は「あなたの投稿 3件」', '');

    /* ── 額だけ直す ── */
    await c.page.click('.pvc-root [data-pvc-tile="benefits"]');
    await waitView(c, 'benefits');
    await fill(c, 'landing_pay_amount', '1800');
    await tick(c);
    await send(c);
    await waitView(c, 'saved');
    db = await landRows('ana');
    ok(sent.length === 2 && J(ids(sent[1])) === J(['landing_pay_amount']) && db.length === 3
      && db.find((r) => r.q === 'landing_pay_amount').num === 1800 && db.find((r) => r.q === 'landing_pay_amount').cur === 'JPY',
      '★額を直すと、その1件だけが置き換わる（行は増えない・通貨はそのまま）', J({ sent: ids(sent[1]), db: db.map((r) => [r.q, r.num]) }));

    /* ── 「一定額ではない」に答え直す：低いほうだけ入れる ── */
    await c.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(c, 'benefits');
    await pick(c, 'landing_pay', 'variable');
    await fill(c, 'landing_pay_from', '10');
    await pick(c, 'landing_pay_from_cur', 'USD');
    v = await vals(c);
    ok(v.landing_pay_from_cur === 'USD' && v.landing_pay_to_cur === 'USD',
      '★通貨は1回選べば足りる ── 低いほうで選んだ通貨が、高いほうにも入っている', J({ from: v.landing_pay_from_cur, to: v.landing_pay_to_cur }));
    await pick(c, 'landing_pay_varies_by', 'airport');
    await fill(c, 'landing_pay_varies_by_note', '空港によって違う');
    await tick(c);
    await send(c);
    await waitView(c, 'saved');
    db = await landRows('ana');
    sm = await summary(c);
    const p3 = sent[2] || {};
    const vb = (p3.answers || []).find((x) => x.question_id === 'landing_pay_varies_by') || {};
    ok(sent.length === 3 && J(ids(p3)) === J(['landing_pay', 'landing_pay_from', 'landing_pay_varies_by']) && vb.text === '空港によって違う' && vb.share === true,
      '★額は片方だけでも送れる（入れていない「高いほう」は送らない ＝ 0 や同じ額で埋めない）。補足も一緒に送る', J(p3.answers));
    ok(J(famRows(sm)) === J(['landing_pay', 'landing_pay_from', 'landing_pay_varies_by', 'landing_pay_varies_by_note'])
      && sm.rows.landing_pay_from.v === 'USD 10（1回あたり）' && sm.rows.landing_pay_varies_by.v === '空港・路線' && sm.rows.landing_pay_varies_by_note.v === '空港によって違う',
      '★答え直したあとの保存後の画面に、前の枝の額（JPY 1,800）と数え方が出ていない', J(sm.rows));
    ok(db.length === 5 && db.find((r) => r.q === 'landing_pay_amount').num === 1800 && db.find((r) => r.q === 'landing_pay_unit').c === 'per_landing',
      '   前の額と数え方の行そのものは、保存先に残っている（消していない ＝ 答え直せば戻せる）', J(db.map((r) => r.q)));
    ok((await benefitsCount(c, ANA)) === 'あなたの投稿 3件', '★「あなたの投稿」は3件のまま（残っている前の2行を数えない。保存先は5行）', '');

    /* ── 高いほうを足す：通貨は借りる ── */
    await c.page.click('.pvc-root [data-pvc-tile="benefits"]');
    await waitView(c, 'benefits');
    v = await vals(c);
    ok(v.landing_pay_from === '10' && v.landing_pay_to === '' && v.landing_pay_to_cur === 'USD',
      '読み直すと、まだ入れていない「高いほう」は空欄のまま（通貨は、保存した「低いほう」と同じものが入っている）', J(v));
    await pick(c, 'landing_pay_from_cur', 'EUR');
    const follow = (await vals(c)).landing_pay_to_cur;
    await pick(c, 'landing_pay_from_cur', 'USD');
    v = await vals(c);
    ok(follow === 'EUR' && v.landing_pay_to_cur === 'USD',
      '★保存したあとも、「高いほう」の通貨は自分で選ぶまで「低いほう」に付いて動く（前に見せただけの通貨が居残っていない）', J({ follow, back: v.landing_pay_to_cur }));
    await fill(c, 'landing_pay_to', '25');
    await tick(c);
    await send(c);
    await waitView(c, 'saved');
    db = await landRows('ana');
    const p4 = sent[3] || {};
    ok(sent.length === 4 && J(p4.answers) === J([{ question_id: 'landing_pay_to', num: 25, currency: 'USD' }]),
      '★「高いほう」は、借りた通貨を付けて送る（通貨を選び直させない）。変えていない答えは送り直さない', J(p4.answers));
    ok(db.find((r) => r.q === 'landing_pay_to').cur === 'USD' && db.find((r) => r.q === 'landing_pay_from').num === 10 && db.find((r) => r.q === 'landing_pay_from').cur === 'USD',
      '   保存先でも「高いほう」は USD。「低いほう」は元のまま', J(db.filter((r) => /_from|_to/.test(r.q))));

    /* ── 「ない」に答え直す ── */
    await c.page.click('.pvc-root [data-pvc-act="edit"]');
    await waitView(c, 'benefits');
    await pick(c, 'landing_pay', 'no');
    await tick(c);
    await send(c);
    await waitView(c, 'saved');
    db = await landRows('ana');
    sm = await summary(c);
    const srv = await c.page.evaluate(async () => {
      const sb = await window.PVCareer.client();
      const r = await sb.rpc('my_airline_conditions', { p: { airline: 'ana' } });
      return r.data.answers.filter((x) => !x.airline || x.airline === 'ana').map((x) => x.question_id).filter((k) => /^landing_pay/.test(k)).sort();
    });
    ok(J(ids(sent[4])) === J(['landing_pay']) && db.length === 6 && db.find((r) => r.q === 'landing_pay').c === 'no' && srv.length === 6,
      '「ない」に直しても、下の5行は保存先に残っていて、サーバは本人に6件とも返す（ここまでが前提）', J({ db: db.map((r) => r.q), srv }));
    ok(J(famRows(sm)) === J(['landing_pay']) && sm.rows.landing_pay.v === 'ない' && !/1,800|USD|JPY|空港/.test(sm.text),
      '★「ない」に直したあとの保存後の画面に、古い額・数え方・補足が1つも出ない', J(sm.rows));
    ok((await benefitsCount(c, ANA)) === 'あなたの投稿 1件', '★「あなたの投稿」は1件（「ない」の答えだけ）── 残っている古い額を数えない', '');
    await c.page.click('.pvc-root [data-pvc-tile="benefits"]');
    await waitView(c, 'benefits');
    sh = await shown(c);
    tags = await c.page.evaluate(() => [...document.querySelectorAll('.pvc-root form [data-q]')]
      .filter((n) => !n.closest('[hidden]') && /^landing_pay/.test(n.getAttribute('data-q')) && n.querySelector('.pvc-label .pvc-mine')).map((n) => n.getAttribute('data-q')));
    ok(LAND.every((k) => !sh[k]) && J(tags) === J(['landing_pay']), '   開き直した画面にも、古い額の欄は出ていない（札は「ない」の1つだけ）', J({ sh: LAND.map((k) => sh[k]), tags }));

    /* ── サーバがまだ下の質問を知らないとき（返事を試験用に差し替えて、画面の言い方だけを見る） ──
       画面を先に出して SQL を貼り忘れると、本番はこの形で返す。親だけ保存され、下の3つは断られる。 */
    await pick(c, 'landing_pay', 'fixed');
    v = await vals(c);
    ok(v.landing_pay_amount === '1800' && v.landing_pay_amount_cur === 'JPY', '「一定額」に戻すと、前に入れた額が入った状態で出る（消していないので打ち直さずに済む）', J(v));
    await fill(c, 'landing_pay_amount', '2000');
    await pick(c, 'landing_pay_unit', 'per_leg');
    await tick(c);
    c.st.fake = { name: 'submit_airline_conditions', body: { ok: true, airline: 'ana', saved: 1, skipped: 0,
      rejected: [{ question_id: 'landing_pay_amount', reason: 'unknown_question' }, { question_id: 'landing_pay_unit', reason: 'unknown_question' }],
      answered_total: 1, questions_total: 48 } };
    await send(c);
    await waitMsg(c, 'rej');
    const rj = await msg(c, 'rej');
    v = await vals(c);
    ok(/保存できなかった項目があります/.test(rj) && rj.includes(labelOf('landing_pay_amount')) && rj.includes(labelOf('landing_pay_unit'))
      && /この質問はいま受け付けていません/.test(rj) && /ほかの1件は保存しました/.test(rj) && !/unknown_question/.test(rj),
      '★下の質問だけ断られたら、どの質問が保存されなかったかを普通の言葉で言い、上の1件は保存したと言う', J(rj));
    ok(!(await c.page.$('.pvc-root [data-pvc-saved]')) && v.landing_pay_amount === '2000' && v.landing_pay_unit === 'per_leg',
      '★断られた額と数え方は画面に残っていて、保存後の画面は出さない', J(v));
    await c.st.ctx.close();
  });

  for (const theme of [null, 'dark']) {
    const tone = theme ? '暗い表示' : '明るい表示';
    await scene(`着陸手当 ── 390×680（${tone}）で欄が切れない`, async () => {
      const p = await open('phone', { who: 'c', theme });
      await go(p, ANA + '?add=benefits');
      await waitView(p, 'benefits');
      if (theme) ok(await p.page.$eval('.pvc-root', (n) => n.classList.contains('is-dark')), '暗い表示で開いている');
      await pick(p, 'landing_pay', 'fixed');
      await p.page.$eval('.pvc-root [data-q="landing_pay_amount"]', (n) => n.scrollIntoView({ block: 'center' }));
      const row = await p.page.evaluate(() => {
        const f = document.querySelector('.pvc-root [data-q="landing_pay_amount"]'), fr = f.getBoundingClientRect();
        /* 額と単位は1つの組に入っている（行の直下ではない）＝ 4つの部品を、行の中から名前で拾う */
        const parts = [...f.querySelectorAll('.pvc-numrow .pvc-selw, .pvc-numrow .pvc-input, .pvc-numrow .pvc-unit, .pvc-numrow .pvc-chip')].map((n) => n.getBoundingClientRect());
        return { n: parts.length, inside: parts.every((r) => r.width > 0 && r.left >= fr.left - 0.5 && r.right <= fr.right + 0.5) };
      });
      ok(row.n === 4 && row.inside, `390×680（${tone}）：通貨・額・「（1回あたり）」・「わからない」が、額の質問の枠の中に収まっている`, J(row));
      checkSize(await measure(p), `390×680（${tone}） 着陸手当・一定額を選んだ状態`);
      await pick(p, 'landing_pay', 'variable');
      await p.page.$eval('.pvc-root [data-q="landing_pay_varies_by"]', (n) => n.scrollIntoView({ block: 'center' }));
      checkSize(await measure(p), `390×680（${tone}） 着陸手当・一定額ではないを選んだ状態`);
      await p.st.ctx.close();
    });
  }

  await scene('着陸手当 ── ログインなしで預ける・読み直す・「ない」に直す（古い額を数えない）', async () => {
    const n = await open('phone');
    const sent = tap(n, 'submit_contrib_anon');
    const held = async () => (await (await fetch(`${base}/rest/v1/rpc/my_contrib_anon`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ p: { key: await n.page.evaluate(() => localStorage.getItem('pv_contrib_key') || ''), airline: 'cathay-pacific' } }),
    })).json());
    const heldFam = async () => ((await held()).answers || []).map((x) => x.question_id).filter((k) => /^landing_pay/.test(k)).sort();

    await go(n, CX + '?add=benefits');
    await waitView(n, 'benefits');
    await pick(n, 'landing_pay', 'fixed');
    await fill(n, 'landing_pay_amount', '1500');
    await pick(n, 'landing_pay_amount_cur', 'HKD');
    await pick(n, 'landing_pay_unit', 'per_leg');
    await tick(n);
    await send(n);
    await waitView(n, 'saved');
    let sm = await summary(n);
    const d1 = (sent[0] || {}).data || {};
    ok(sent.length === 1 && (sent[0] || {}).kind === 'cond' && d1.airline === 'cathay-pacific' && J(ids(d1)) === J(['landing_pay', 'landing_pay_amount', 'landing_pay_unit'])
      && (await snap(n)).href === CX && hits(n, 'submit_airline_conditions') === 0,
      '★ログインなしでも、着陸手当・額・数え方を1回で預けられる（ログインへ行かない・同じ会社ページのまま）', J({ kind: (sent[0] || {}).kind, ids: ids(d1) }));
    ok(sm.head === '情報を追加しました' && J(famRows(sm)) === J(['landing_pay', 'landing_pay_amount', 'landing_pay_unit'])
      && sm.rows.landing_pay_amount.v === 'HKD 1,500（1回あたり）' && sm.rows.landing_pay_unit.v === 'レグ（区間）1つごと' && /ログインなしで保存しました/.test(sm.text),
      '★保存後の画面に、自分の答えが通貨つきで出る。「ログインなしで保存しました」と言う', J(sm.rows));

    /* ── 読み直す（同じ端末） ── */
    await go(n, CX + '?add=benefits');
    await waitView(n, 'benefits');
    await n.page.waitForFunction(() => { const x = document.querySelector('.pvc-root [name="landing_pay_amount"]'); return !!x && x.value === '1500'; });
    let v = await vals(n);
    const sh = await shown(n);
    ok(v.landing_pay === 'fixed' && v.landing_pay_amount === '1500' && v.landing_pay_amount_cur === 'HKD' && v.landing_pay_unit === 'per_leg' && sh.landing_pay_amount && sh.landing_pay_unit,
      '★読み直すと、預けた額・通貨・数え方がサーバから戻っている', J(v));
    ok((await benefitsCount(n, CX)) === 'あなたの投稿 3件', '一覧の「休暇・手当」は「あなたの投稿 3件」', '');

    /* ── 「ない」に直す ── */
    await n.page.click('.pvc-root [data-pvc-tile="benefits"]');
    await waitView(n, 'benefits');
    await pick(n, 'landing_pay', 'no');
    await tick(n);
    await send(n);
    await waitView(n, 'saved');
    sm = await summary(n);
    const left = await heldFam();
    ok(J(ids((sent[1] || {}).data)) === J(['landing_pay']) && left.length === 3,
      '「ない」に直しても、預かりには額と数え方の行が残っている（ここまでが前提）', J(left));
    ok(J(famRows(sm)) === J(['landing_pay']) && sm.rows.landing_pay.v === 'ない' && !/1,500|HKD/.test(sm.text),
      '★「ない」に直したあとの保存後の画面に、古い額と数え方が出ない（ログインなしでも同じ）', J(sm.rows));
    ok((await benefitsCount(n, CX)) === 'あなたの投稿 1件', '★「あなたの投稿」は1件 ── 預かりに残っている古い額を数えない', '');
    await n.st.ctx.close();
  });

  /* 上の場面と同じ道を、ログインまで歩く（2026-10-11）。
     「あり・1回あたり一定額」＋額＋数え方を預けたあとで「ない」に直した人がログインすると、引き継ぎの知らせに
     「2件は、いまの形式では受け取れず、引き継げませんでした。」と出ていた。どの答えの形も悪くない・本人は何も
     失っていない（自分で「ない」に直しただけ）。知らせるのは、引き継いだ1件だけ。
     件数を決めるのはサーバ（db/contrib.sql の claim_contrib。数え方は db/test-contrib.mjs の 8-2 が見ている）。
     ここが見るのは、その件数が、本人の画面でどの言葉になるか。 */
  await scene('着陸手当 ── ログインなしで預けて「ない」に直した人が、ログインして引き継ぐ（直して要らなくなった額を「引き継げませんでした」と言わない）', async () => {
    const n = await open('phone');
    await go(n, CX + '?add=benefits');
    await waitView(n, 'benefits');
    await pick(n, 'landing_pay', 'fixed');
    await fill(n, 'landing_pay_amount', '1500');
    await pick(n, 'landing_pay_amount_cur', 'HKD');
    await pick(n, 'landing_pay_unit', 'per_leg');
    await tick(n);
    await send(n);
    await waitView(n, 'saved');
    await go(n, CX + '?add=benefits');
    await waitView(n, 'benefits');
    await n.page.waitForFunction(() => { const x = document.querySelector('.pvc-root [name="landing_pay_amount"]'); return !!x && x.value === '1500'; });
    await pick(n, 'landing_pay', 'no');
    await tick(n);
    await send(n);
    await waitView(n, 'saved');

    const key = await n.page.evaluate(() => localStorage.getItem('pv_contrib_key') || '');
    const heldNow = async () => (await q(
      `select item_key as k, payload->>'code' as c from public.pv_contrib_pending
        where key_hash = public.pv_contrib_key_hash($1) order by item_key`, [key])).rows;
    const h0 = await heldNow();
    ok(!!key && J(h0.map((x) => x.k)) === J(['landing_pay', 'landing_pay_amount', 'landing_pay_unit']) && h0[0].c === 'no'
      && (await landRows('cathay-pacific')).length === 0,
      '（ここまでが前提）預かりは3件 ── 「ない」に直した着陸手当と、残っている古い額・数え方。会員の行は、この会社にまだ1件も無い', J(h0));

    /* ── 同じ端末でログインして、同じ会社ページを開き直す（下の 12 の loginAs と同じやり方。あちらは、この場面より
          あとで定義される。開き直すので、open が入れるのと同じ印もそろえる）。
          ログインを書く前に、会社ページを離れる ── この人はログインの画面へ行って戻ってくるので、ログインが保存される時に
          面の開いたページは無い。開いたまま書くと、保存のあとの読み直しが遅れて届いた回に、去っていくページが引き継ぎを
          始めてしまい、開き直したページは知らせを言えない（保存後のカードが待っているのは保存の返事だけ）。 ── */
    await go(n, '/pv-vocab.json');
    await n.page.waitForFunction(() => location.pathname === '/pv-vocab.json' && !window.PVContrib);
    const s = await (await fetch(`${base}/__local/login?member=b`)).json();
    await n.page.evaluate((x) => {
      const now = String(Date.now());
      localStorage.setItem('sb-local-auth-token', JSON.stringify(x.session));
      localStorage.setItem('pv_user', JSON.stringify(x.pv_user));
      localStorage.setItem('pv_last_active', now);
      localStorage.setItem('pv_session_start', now);
      const at = Date.parse((x.session.user || {}).last_sign_in_at || '');
      localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now(), s: String(isNaN(at) ? now : at) }));
    }, s);
    if (hits(n, 'claim_contrib') !== 0) throw new Error('前提が崩れた（開き直す前に、引き継ぎが始まっている）');
    await go(n, CX + '?add=list');
    await waitView(n, 'counted');
    await waitMsg(n, 'claim');
    const said = await n.page.evaluate(() => {
      const b = document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="claim"]');
      const c = document.querySelector('.pvc-root [data-pvc-count="benefits"]');
      return { text: b.innerText.replace(/\s+/g, ' '), lines: [...b.querySelectorAll('.pvc-msg-l li')].map((x) => x.textContent),
        count: c && !c.hidden ? c.textContent : null, key: localStorage.getItem('pv_contrib_key') };
    });
    ok(hits(n, 'claim_contrib') >= 1 && said.lines.includes('1件を、あなたの投稿として引き継ぎました。'),
      '★ログインすると、「ない」の1件が引き継がれ、知らせは「1件を、あなたの投稿として引き継ぎました。」と言う', J(said.lines));
    ok(!/引き継げませんでした/.test(said.text) && said.lines.length === 1,
      '★自分で「ない」に直して要らなくなった額と数え方を、「引き継げませんでした」と言わない（知らせは、引き継いだ1件の1行だけ）', said.text);
    const rows = await landRows('cathay-pacific');
    ok(rows.length === 1 && rows[0].q === 'landing_pay' && rows[0].c === 'no',
      '★会員の回答になったのは「ない」の1件だけ（古い額と数え方は、会員の回答にしていない）', J(rows.map((x) => [x.q, x.c, x.num])));
    ok((await heldNow()).length === 0 && said.key === null && said.count === 'あなたの投稿 1件',
      '引き継いだあと、預かりにも端末にも何も残らない。「休暇・手当」は「あなたの投稿 1件」', J({ held: (await heldNow()).length, key: said.key, count: said.count }));
    await n.st.ctx.close();
  });

  await scene('ホテル・ステイの入口 ── このページの「ステイ先」のタブへ（ほかの画面へ送り出さない）', async () => {
    const s = await open('phone');
    await go(s, EY);
    await s.page.waitForFunction(() => !!window.PVGlance);
    const before = await s.page.evaluate(() => ({ at: window.PVGlance.at(), len: history.length }));
    await s.page.evaluate(() => window.PVContrib.open({ topic: 'list' }));
    await waitView(s, 'list');
    await s.page.click('.pvc-root [data-pvc-tile="stay"]');
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay' && !window.PVContrib.isOpen()
      && document.querySelector('.pvc-root').hidden, { timeout: 8000 }).catch(() => {});
    const after = await s.page.evaluate(() => {
      const box = document.getElementById('pvg-stay'), r = box.getBoundingClientRect();
      return {
        at: window.PVGlance.at(), open: window.PVContrib.isOpen(), hidden: document.querySelector('.pvc-root').hidden,
        href: location.pathname + location.search + location.hash, shown: r.width > 0 && r.height > 0,
        list: !!box.querySelector('#pvg-st-list li'), lock: document.documentElement.classList.contains('pvc-lock'), len: history.length,
      };
    });
    ok(before.at !== 'stay' && after.at === 'stay' && after.href === EY + '#stay' && after.shown && after.list,
      '★「ホテル・ステイ」を押すと、同じページの「ステイ先」のタブが開く（会社を選び直させない・別の画面へ行かない）', J({ before, after }));
    ok(!after.open && after.hidden && !after.lock, '面は閉じている（ページが動かせる）', J(after));
    ok(after.len === before.len + 1, '履歴に残るのはタブの1段だけ（面のために積んだ段は降りている）', J({ before: before.len, after: after.len }));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction((t) => window.PVGlance.at() === t, { timeout: 8000 }, before.at).catch(() => {});
    const back = await s.page.evaluate(() => ({ at: window.PVGlance.at(), open: window.PVContrib.isOpen(), href: location.pathname + location.search + location.hash }));
    ok(back.at === before.at && !back.open && back.href === EY, '「戻る」1回で、開く前のタブへ戻る（面は開き直さない）', J(back));
    await s.st.ctx.close();
  });

  /* ページの深い所で押したとき。面のために積んだ段を降りてからタブを替えると、降りた先の位置をブラウザが
     あとから置き直して、替えたタブが途中から始まった（100枚ある就航地の一覧のまんなかに出る）。
     いまは、面の段をそのまま行き先のタブの段に書き換える ＝ 降りない。 */
  const tabProbe = (s) => ({
    where: () => s.page.evaluate(() => {
      const bar = document.querySelector('.pvg-tabbar').getBoundingClientRect(), box = document.getElementById('pvg-stay').getBoundingClientRect();
      const more = document.querySelector('.pvg-more[aria-expanded="true"]'), f = document.activeElement;
      return {
        at: window.PVGlance.at(), y: Math.round(scrollY), len: history.length, open: window.PVContrib.isOpen(),
        lock: document.documentElement.classList.contains('pvc-lock'), href: location.pathname + location.search + location.hash,
        bar: Math.round(bar.bottom), head: Math.round(box.top), shown: box.height > 0, vh: innerHeight,
        /* 開いている板（概要で「もっと見る」を押した先）と、いま焦点の在る所 */
        panel: more ? more.getAttribute('aria-controls') : '', focus: f && f !== document.body ? String(f.getAttribute('class') || f.tagName).slice(0, 40) : '',
      };
    }),
    /* 置き直しが落ち着く（3コマ続けて同じ位置）まで待つ。時間では待たない */
    still: () => s.page.evaluate(() => new Promise((res) => {
      const t0 = performance.now(); let last = -1, n = 0;
      const tick = () => { n = scrollY === last ? n + 1 : 0; last = scrollY; if (n >= 3 || performance.now() - t0 > 3000) return res(); requestAnimationFrame(tick); };
      tick();
    })),
    /* 実データの欄（口コミ・REAL PAY …）と字の形が届いて、ページの高さが決まるまで待つ（3コマ続けて同じ高さ）。時間では待たない。
       届く前に測り始めると、あとで欄が縮んだ分だけページが短くなる（スマホのエティハドの概要で約145px）。
       控えた位置がページの底より下になり、「戻る」でブラウザがそこへ置けない ＝ 製品は正しいのに赤くなる。
       2026-10-09、ほかの場面と続けて流した回にだけ実際に踏んだ（この場面だけ流すと緑のままで、気づけない）。
       ⚠️ 字の形は「届いたか」だけでは足りない ── 「頼んだか」まで見る（2026-10-10）。
       字の形の指定（外の CSS）は、あとから当てる書き方で読んでいる（media="print" → 読めたら all）。
       当たる前は、頼んだ字の形が1つも無い ＝ document.fonts.status は何もしなくても 'loaded' と答える。
       そこで「届いた」と数えて測り始めると、面を開いたあとで字の形が届き、うしろのページが 1〜19px 動く
       ＝ 製品は正しいのに赤くなる（外の回線が遅い回にだけ。実際に踏んだ：開く前 1735 → 開いた後 1736）。
       なので、ページの読み込みが終わり（＝ その CSS が届いたか、届かないと決まった）、字の形が指定されているなら
       少なくとも1つは頼み終えている（届いた・届かなかった）ことまで待つ。CSS が届かない回は、字の形の指定が
       1つも無いまま ＝ 今までどおり先へ進む（回線が無い所で流しても、ここで止めない）。 */
    ready: async () => {
      const got = await s.page.evaluate(() => new Promise((res) => {
        const t0 = performance.now(); let last = -1, n = 0;
        const tick = () => {
          const wait = [...document.querySelectorAll('.pvg .crl, .pvg-hero .crl')]
            .filter((b) => b.getClientRects().length && /^(idle|loading)$/.test(b.dataset.state)).map((b) => b.getAttribute('data-live'));
          const fonts = document.fonts.status, h = document.documentElement.scrollHeight;
          const faces = [...document.fonts], asked = faces.filter((f) => f.status === 'loaded' || f.status === 'error').length;
          const shaped = document.readyState === 'complete' && fonts === 'loaded' && (!faces.length || asked > 0);
          n = !wait.length && shaped && h === last ? n + 1 : 0; last = h;
          if (n >= 3 || performance.now() - t0 > 15000) return res({ ok: n >= 3, wait, fonts, h, page: document.readyState, faces: faces.length, asked });
          requestAnimationFrame(tick);
        };
        tick();
      }));
      ok(got.ok, '（前提）測り始める前に、実データの欄と字の形が届いて、ページの高さが決まっている', J(got));
    },
  });
  await scene('ホテル・ステイの入口を、ページの深い所から押す ── 行き先は頭から・戻ると元の深さ・進んでも面は開き直さない', async () => {
    const s = await open('phone');
    await go(s, EY);
    await s.page.waitForFunction(() => !!window.PVGlance);
    const { where, still, ready } = tabProbe(s);
    await ready();
    const headOk = (x) => x.head >= x.bar - 2 && x.head <= x.bar + 120;
    await s.page.evaluate(() => window.scrollTo({ top: Math.round((document.documentElement.scrollHeight - innerHeight) * 0.6), behavior: 'instant' }));
    await s.page.waitForFunction(() => scrollY > 600, { timeout: 8000 }).catch(() => {});
    await still();
    const before = await where();
    await s.page.click('.pvg-tabbar .pvg-add');
    await waitView(s, 'list');
    const opened = await where();
    ok(before.at !== 'stay' && before.y > 600 && opened.y === before.y && opened.open,
      '（前提）概要の深い所で、上に貼り付いた「情報を追加」から一覧を開いた・開いてもページは動かない', J({ before, opened }));
    await s.page.click('.pvc-root [data-pvc-tile="stay"]');
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay' && !window.PVContrib.isOpen()
      && document.querySelector('.pvc-root').hidden, { timeout: 8000 }).catch(() => {});
    await still();
    const after = await where();
    ok(after.at === 'stay' && after.shown && !after.open && !after.lock && after.href === EY + '#stay',
      '深い所から押しても「ステイ先」のタブが開き、面は閉じている（ページが動かせる）', J(after));
    ok(headOk(after), '★替えたタブは頭から始まる（一覧の頭が、タブの帯のすぐ下に在る。途中から始まらない）', J({ bar: after.bar, head: after.head, y: after.y }));
    ok(after.len === before.len + 1, '履歴に増えるのは、タブの1段だけ', J({ before: before.len, after: after.len }));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction((t, y) => window.PVGlance.at() === t && Math.abs(scrollY - y) <= 2, { timeout: 8000 }, before.at, before.y).catch(() => {});
    await still();
    const back = await where();
    ok(back.at === before.at && !back.open && !back.lock && back.href === EY, '「戻る」1回で、開く前のタブへ戻る（面は開き直さない）', J(back));
    ok(Math.abs(back.y - before.y) <= 2, '★戻った先は、押す前と同じ深さ（頭へ飛ばされない）', J({ before: before.y, back: back.y }));
    await s.page.goForward().catch(() => {});
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay', { timeout: 8000 }).catch(() => {});
    await still();
    const fwd = await where();
    ok(fwd.at === 'stay' && !fwd.open && !fwd.lock && fwd.href === EY + '#stay', '「進む」で「ステイ先」へ・面は開き直さない', J(fwd));
    ok(fwd.shown && fwd.head < fwd.vh && fwd.head >= fwd.bar - 2, '進んだ先でも、一覧の頭が画面の中に在る', J({ bar: fwd.bar, head: fwd.head, y: fwd.y }));
    await s.st.ctx.close();
  });

  /* 概要の「ホテル・レストラン」は、同じページの就航地の欄（#pvg-stay）へ寄るだけの素のリンク。
     この欄は概要にもステイ先にも出るので、住所の # だけでは「どちらのタブで見ていたか」が決まらない。
     そこからホテル・ステイへ行って「戻る」と、ステイ先のタブのまま（概要へ戻れない）だった。
     ⚠️ 寄った所から先まで読んでから離れる。寄った所のままだと、「戻る」でブラウザが自分で節の頭へ
        寄せ直しても数pxしか違わず、読んでいた所を失くしていることが見えない（2026-10-08 に実際にそうだった）。 */
  await scene('概要の「ホテル・レストラン」から寄ったあとでホテル・ステイへ ── 「戻る」は概要の同じ所へ', async () => {
    const s = await open('phone');
    await go(s, EY);
    await s.page.waitForFunction(() => !!window.PVGlance);
    const { where, still, ready } = tabProbe(s);
    await ready();
    /* リンクを押した瞬間の位置を、ページの中で控える（押す道具が先にリンクを画面の中へ寄せるので、外から先に読むとずれる） */
    await s.page.evaluate(() => {
      document.querySelector('.pvg a.pvg-topic-a[href="#pvg-stay"]').addEventListener('click', () => { window.__pvPressedAt = scrollY; }, { capture: true, once: true });
    });
    await s.page.click('.pvg a.pvg-topic-a[href="#pvg-stay"]');
    await s.page.waitForFunction(() => location.hash === '#pvg-stay', { timeout: 8000 }).catch(() => {});
    await still();
    const pressedAt = await s.page.evaluate(() => window.__pvPressedAt);
    const before = await where();
    ok(before.at === 'overview' && before.href === EY + '#pvg-stay' && before.shown && before.head >= before.bar - 2 && before.head < before.vh,
      '（前提）概要のまま、就航地の欄が画面の中へ寄っている', J(before));
    /* 寄った所から、その先まで読む（滑らせずに置く） */
    await s.page.evaluate(() => { const el = document.documentElement, was = el.style.scrollBehavior; el.style.scrollBehavior = 'auto'; window.scrollBy(0, 320); el.style.scrollBehavior = was; });
    await s.page.waitForFunction((y) => scrollY >= y + 300, { timeout: 8000 }, before.y).catch(() => {});
    await still();
    const deep = await where();
    ok(deep.at === 'overview' && deep.y >= before.y + 300, '（前提）寄った所から、その先まで読んでいる', J({ landed: before.y, read: deep.y }));
    await s.page.click('.pvg-tabbar .pvg-add');
    await waitView(s, 'list');
    await s.page.click('.pvc-root [data-pvc-tile="stay"]');
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay' && !window.PVContrib.isOpen(), { timeout: 8000 }).catch(() => {});
    await still();
    const after = await where();
    ok(after.at === 'stay' && after.href === EY + '#stay' && !after.open, '「ステイ先」のタブへ移る', J(after));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction((y) => window.PVGlance.at() === 'overview' && Math.abs(scrollY - y) <= 2, { timeout: 8000 }, deep.y).catch(() => {});
    await still();
    /* ブラウザがあとから寄せ直すなら、ここから滑って動く。動き終わるまで見る（止まって見えるコマが続いても、書き留めが追いつくまで待つ） */
    await s.page.waitForFunction(() => { const h = history.state; return !!h && typeof h.pvgY === 'number' && Math.abs(h.pvgY - scrollY) <= 1; }, { timeout: 8000 }).catch(() => {});
    await still();
    const back = await where();
    ok(back.at === 'overview' && !back.open && !back.lock,
      '★「戻る」で概要へ戻る（同じ欄が2つのタブに出ていても、見ていたタブへ）', J(back));
    ok(Math.abs(back.y - deep.y) <= 2, '★戻った先は、読んでいた深さ（節の頭へ引き戻されない）', J({ landed: before.y, read: deep.y, back: back.y }));
    ok(back.href === EY, '戻った段の住所に、節の id が残っていない（残っていると、ブラウザが節の頭へ寄せ直す）', J({ href: back.href }));
    await s.page.goForward().catch(() => {});
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay', { timeout: 8000 }).catch(() => {});
    await still();
    const fwd = await where();
    ok(fwd.at === 'stay' && fwd.href === EY + '#stay' && !fwd.open, '「進む」で「ステイ先」へ', J(fwd));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction(() => window.PVGlance.at() === 'overview', { timeout: 8000 }).catch(() => {});
    await s.page.goBack().catch(() => {});
    /* リンクを押す前の段には、押した瞬間の位置が書き留めてある（住所はどちらも # なしなので、住所では見分けられない。
       読み進めた深さとは 300px 以上違うので、書き留めの位置で見分ける） */
    await s.page.waitForFunction((y) => { const h = history.state; return location.hash === '' && !!h && typeof h.pvgY === 'number' && Math.abs(h.pvgY - y) <= 2 && Math.abs(scrollY - y) <= 2; }, { timeout: 8000 }, pressedAt).catch(() => {});
    await still();
    const top = await where();
    const topMark = await s.page.evaluate(() => { const h = history.state; return h && typeof h.pvgY === 'number' ? h.pvgY : null; });
    ok(typeof pressedAt === 'number' && Math.abs(pressedAt - deep.y) > 100, '（前提）リンクを押した所と、読み進めた所は別の深さ', J({ pressedAt, read: deep.y }));
    ok(top.at === 'overview' && top.href === EY && !top.open && topMark !== null && Math.abs(topMark - pressedAt) <= 2 && Math.abs(top.y - pressedAt) <= 2,
      'もう1回「戻る」と、リンクを押す前の概要（# の無い住所・リンクを押した所）', J({ pressedAt, mark: topMark, y: top.y, at: top.at, href: top.href }));
    await s.st.ctx.close();
  });

  /* 概要で板（勤務・待遇・暮らしの「もっと見る」）を開いて読んでいる途中から行って戻る。
     位置だけ戻して板を閉じたままにすると、ページが板の分だけ短くなって、同じ位置に別の中身が来る。 */
  await scene('概要で板を開いたままホテル・ステイへ ── 「戻る」と板が開いたまま・同じ深さ', async () => {
    const s = await open('phone');
    await go(s, EY);
    await s.page.waitForFunction(() => !!window.PVGlance);
    const { where, still, ready } = tabProbe(s);
    await ready();
    await s.page.click('.pvg .pvg-more[aria-controls="pvg-p-work"]');
    await s.page.waitForFunction(() => { const p = document.getElementById('pvg-p-work'); return !!p && !p.hidden && p.getBoundingClientRect().height > 200; }, { timeout: 8000 }).catch(() => {});
    await still();
    /* 板の中ほどまで読み進める（板が閉じると、この位置はページの別の所になる） */
    await s.page.evaluate(() => { const r = document.getElementById('pvg-p-work').getBoundingClientRect(); window.scrollTo({ top: Math.round(scrollY + r.top + Math.min(r.height * 0.5, 600) - 160), behavior: 'instant' }); });
    await still();
    const before = await where();
    ok(before.at === 'overview' && before.panel === 'pvg-p-work' && before.y > 300, '（前提）概要で「勤務」の板を開いて、中ほどまで読んでいる', J(before));
    await s.page.click('.pvg-tabbar .pvg-add');
    await waitView(s, 'list');
    await s.page.click('.pvc-root [data-pvc-tile="stay"]');
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay' && !window.PVContrib.isOpen(), { timeout: 8000 }).catch(() => {});
    await still();
    const after = await where();
    ok(after.at === 'stay' && after.panel === '', '「ステイ先」へ移る（概要の板は閉じる）', J(after));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction((y) => window.PVGlance.at() === 'overview' && Math.abs(scrollY - y) <= 2, { timeout: 8000 }, before.y).catch(() => {});
    await still();
    const back = await where();
    ok(back.at === 'overview' && back.panel === 'pvg-p-work', '★「戻る」と、開いていた板が開いたまま', J(back));
    ok(Math.abs(back.y - before.y) <= 2, '★同じ深さ（読んでいた所）へ戻る', J({ before: before.y, back: back.y }));
    /* 戻ってきたあとで板を閉じ、別の所まで読んでから「進む」で離れて、もう一度戻る。
       「進む」はタブの切り替えを通らないので、書き留めが古いままだと、閉じたはずの板が開いて前の位置へ飛ぶ。 */
    await s.page.keyboard.press('Escape');
    await s.page.waitForFunction(() => !document.querySelector('.pvg-more[aria-expanded="true"]'), { timeout: 8000 }).catch(() => {});
    await s.page.evaluate(() => window.scrollTo({ top: 420, behavior: 'instant' }));
    await still();
    /* 書き留めが今の位置に追いつくまで待つ（時間では待たない） */
    await s.page.waitForFunction(() => { const h = history.state; return !!h && h.pvgOpen === '' && typeof h.pvgY === 'number' && Math.abs(h.pvgY - scrollY) < 1; }, { timeout: 8000 }).catch(() => {});
    const mid = await where();
    ok(mid.at === 'overview' && mid.panel === '' && mid.y > 100 && Math.abs(mid.y - before.y) > 50, '（前提）戻ったあと板を閉じて、別の所まで読む', J({ mid, before: before.y }));
    await s.page.goForward().catch(() => {});
    await s.page.waitForFunction(() => window.PVGlance.at() === 'stay', { timeout: 8000 }).catch(() => {});
    await still();
    const fwd = await where();
    ok(fwd.at === 'stay' && !fwd.open, '「進む」で「ステイ先」へ（面は開き直さない）', J(fwd));
    await s.page.goBack().catch(() => {});
    await s.page.waitForFunction((y) => window.PVGlance.at() === 'overview' && Math.abs(scrollY - y) <= 2, { timeout: 8000 }, mid.y).catch(() => {});
    await still();
    const again = await where();
    ok(again.at === 'overview' && again.panel === '', '★もう一度「戻る」と、閉じた板は閉じたまま（古い書き留めで開け直さない）', J(again));
    ok(Math.abs(again.y - mid.y) <= 2, '★最後に読んでいた所へ戻る（前の位置へ飛ばない）', J({ mid: mid.y, again: again.y }));
    await s.st.ctx.close();
  });

  /* もう「ステイ先」の一覧に居るときは、行き先が無い ＝ 面を閉じるだけ。
     焦点は開いたボタンへ返す（返さないと、キーボードの人はページの頭からやり直しになる）。 */
  await scene('「ステイ先」の一覧に居るときに「ホテル・ステイ」を押す ── 面が閉じ、開いたボタンへ焦点が戻る', async () => {
    const s = await open('phone');
    await go(s, EY + '#stay');
    await s.page.waitForFunction(() => !!window.PVGlance && window.PVGlance.at() === 'stay');
    const { where, still, ready } = tabProbe(s);
    await ready();
    await still();
    const before = await where();
    await s.page.focus('.pvg-tabbar .pvg-add');
    await s.page.keyboard.press('Enter');
    await waitView(s, 'list');
    await s.page.click('.pvc-root [data-pvc-tile="stay"]');
    await s.page.waitForFunction(() => !window.PVContrib.isOpen() && document.querySelector('.pvc-root').hidden, { timeout: 8000 }).catch(() => {});
    await still();
    const after = await where();
    ok(after.at === 'stay' && after.href === EY + '#stay' && !after.open && !after.lock, '面が閉じて、「ステイ先」の一覧のまま', J(after));
    ok(/\bpvg-add\b/.test(after.focus), '★焦点は、開いた「情報を追加」のボタンへ戻る（ページの頭へ落ちない）', J({ focus: after.focus }));
    ok(Math.abs(after.y - before.y) <= 2, 'ページは動かない', J({ before: before.y, after: after.y }));
    await s.st.ctx.close();
  });

  await scene('暗い表示', async () => {
    const light = await a.page.evaluate(() => getComputedStyle(document.querySelector('.pvc-root .pvc-sheet')).backgroundColor);
    const d = await open('phone', { who: 'a', theme: 'dark' });
    await go(d, JAL);
    await api(d, 'work');
    await waitView(d, 'work');
    const dk = await d.page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'), cls: document.querySelector('.pvc-root').classList.contains('is-dark'),
      bg: getComputedStyle(document.querySelector('.pvc-root .pvc-sheet')).backgroundColor,
      ink: getComputedStyle(document.querySelector('.pvc-root .pvc-title')).color,
      field: getComputedStyle(document.querySelector('.pvc-root .pvc-input')).backgroundColor,
    }));
    ok(dk.theme === 'dark' && dk.cls && dk.bg !== light && dk.ink !== dk.bg && dk.field !== 'rgb(255, 255, 255)',
      'ページが暗い表示のときは、面も暗い表示になる（白い板が残らない）', J({ light, dk }));
    await d.st.ctx.close();
  });

  /* 「動きを減らす」設定の人には、紙片を1枚も出さない。完了は 見出しの字 と チェックの印 で静かに伝える。
     合図そのものを無くすのではない ── カードには「静かな完了」の印（quiet）が付く。 */
  await scene('動きを減らす設定 ── 紙片を出さず、静かな完了表示', async () => {
    const r = await open('phone', { who: 'a', calm: true });
    await go(r, JAL);
    await api(r, 'work');
    await waitView(r, 'work');
    await r.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [data-pvc-own-row]'); return !!n && !n.hidden; });
    const set = await r.page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    await fill(r, 'stay_nights', '2');
    await tick(r);
    await send(r);
    await waitView(r, 'saved');
    const cues = await cueLog(r);
    const now = await cueNow(r);
    const fc = await focusAt(r);
    const done = await r.page.evaluate(() => {
      const h = document.querySelector('.pvc-root .pvc-saved-h'), sv = h && h.querySelector('svg');
      const b = sv ? sv.getBoundingClientRect() : null;
      return { head: h ? h.textContent : '', mark: !!b && b.width >= 16 && b.height >= 16, moving: document.querySelector('.pvc-root .pvc-saved').getAnimations({ subtree: true }).length };
    });
    ok(set && J(cues) === J(['quiet']) && !now.pop && now.mark === 'quiet', '★動きを減らす設定では、紙片の層を1度も足さない（カードに付くのは「静かな完了」の印だけ）', J({ set, cues, now }));
    ok(done.head === '情報を更新しました' && done.mark && done.moving === 0 && fc.head,
      '★静かな完了表示 ── 見出しの字とチェックの印が出て、焦点は見出しに在る。動くものは1つも無い', J({ done, fc }));
    ok(!!(await r.page.$('.pvc-root .pvc-saved [data-pvc-act="edit"]')) && !!(await r.page.$('.pvc-root .pvc-saved [data-pvc-act="more"]')), '静かな完了表示でも、2つのボタンは同じように在る');
    /* 「在る」だけでは足りない ── 紙片を出さない回も、見出しからキーボードで2つのボタンへ進めること
       （見えない・押せない形で在っても、上の検査は通ってしまう）。 */
    await r.page.keyboard.press('Tab');
    const t1 = await focusAt(r);
    await r.page.keyboard.press('Tab');
    const t2 = await focusAt(r);
    ok(fc.head && t1.inCard && t1.tag === 'button' && t1.text === '自分の回答を見る' && t2.inCard && t2.tag === 'button' && t2.text === 'もう1項目を答える',
      '★静かな完了表示でも、見出しから Tab を2回押すと「自分の回答を見る」→「もう1項目を答える」の順に届く', J({ fc, t1, t2 }));
    await r.st.ctx.close();
  });

  // ═════════════════════════════════════════════════════════════
  // 12. 自分の一覧が読めない会員（エバー航空・390×680）
  // ═════════════════════════════════════════════════════════════
  /* 保存の口は生きているのに、「自分のこれまでの投稿」を読む口だけが落ちている会員（サーバの不調・通信の切れ目）。
     保存できた直後の「自分の回答を見る」は、いま送った内容を見せる ── 読めないからといって空の入力に戻さない。
     空で出すと本人には「消えた」に見え、そこから1つ足して送ると、前に入れた欄が空で上書きされる（実際にそうなっていた）。
     ただし、いま送った内容の写しは 件数 には数えない（件数はサーバが返した数だけ）・読む人が替わったら捨てる。
     読む口は、手元のサーバの「わざと落とす」仕掛けで落とす（場面の終わりに必ず戻す）。 */
  const EVA = '/airlines/eva-air.html';
  /* 自分の一覧の読み直しが終わるまで待つ（「確認しています」の字が消えるまで） */
  const settle = (p) => p.page.waitForFunction(() => { const n = document.querySelector('.pvc-root [data-pvc-wait]'); return !n || !/確認しています/.test(n.textContent); });
  const formFace = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), tag = r.querySelector('form [data-pvc-own-row]'), w = r.querySelector('[data-pvc-wait]');
    return { btn: (r.querySelector('form .pvc-send[type="submit"]') || {}).textContent || '', tag: tag ? !tag.hidden : null,
      mine: r.querySelectorAll('form .pvc-label .pvc-mine').length, wait: w && !w.hidden ? w.textContent : '' };
  });
  const listFace = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), st = r.querySelector('[data-pvc-state]');
    return { state: st.getAttribute('data-pvc-state'), text: st.hidden ? '' : st.textContent,
      counts: [...r.querySelectorAll('[data-pvc-count]')].filter((n) => !n.hidden).map((n) => n.getAttribute('data-pvc-count') + '：' + n.textContent) };
  });
  /* 同じページを開いたまま、ログインだけを別の会員のものに入れ替える */
  const loginAs = async (p, key) => {
    const s = await (await fetch(`${base}/__local/login?member=${key}`)).json();
    await p.page.evaluate((x) => { localStorage.setItem('sb-local-auth-token', JSON.stringify(x.session)); localStorage.setItem('pv_user', JSON.stringify(x.pv_user)); }, s);
  };

  await scene('自分の勤務の一覧が読めない会員 ── 保存 →「自分の回答を見る」→ 1つ足して送る', async () => {
    await failNext('my_work_months', null, 99);
    const u = await open('phone', { who: 'op' });
    try {
      await go(u, EVA);
      await api(u, 'list');
      await waitView(u, 'counted');
      const l0 = await listFace(u);
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(u, 'work');
      await settle(u);
      const f0 = await formFace(u);
      const ymU = (await vals(u)).ym;
      await pick(u, 'position', 'cap');
      await fill(u, 'block_hours', '55');
      await fill(u, 'stay_nights', '4');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s1 = await summary(u);
      const c1 = await cueLog(u);
      /* 前提：この場面が見ているのは「読む口だけが落ちていて、保存はできた」回。崩れていたら、下は別のものを見ることになる */
      if (l0.state !== 'fail ok' || !/読み込めませんでした/.test(f0.wait) || s1.head !== '情報を追加しました' || J(c1) !== J(POP)) {
        throw new Error('前提が崩れた（読む口だけを落として保存できた回になっていない）: ' + J({ l0, wait: f0.wait, head: s1.head, c1 }));
      }

      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(u, 'work');
      await settle(u);
      const v1 = await vals(u), f1 = await formFace(u);
      ok(v1.ym === ymU && v1.position === 'cap' && v1.block_hours === '55' && v1.stay_nights === '4' && v1.duty_hours === ''
        && f1.tag === true && f1.btn === '匿名で更新する' && /読み込めませんでした/.test(f1.wait),
        '★自分の勤務の一覧が読めない会員が、保存した直後に「自分の回答を見る」を押すと、いま送った内容が入力に入っている（月・職位・乗務時間・ステイ泊数。空の入力に戻さない）',
        J({ ym: v1.ym, position: v1.position, block_hours: v1.block_hours, stay_nights: v1.stay_nights, duty_hours: v1.duty_hours, f1 }));

      /* そこから1つ足して送る。入力が空で出ていた頃は、ここで前の2つ（乗務時間・ステイ泊数）が空で上書きされていた */
      if (!v1.position) await pick(u, 'position', 'cap');   // 入力が空で出た回（＝上が赤い回）も、先へ進めて保存先を見る
      await fill(u, 'duty_hours', '120');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s2 = await summary(u);
      const c2 = await cueLog(u);
      const rows = await workRows('eva-air');
      const row = rows.find((x) => `${x.y}-${String(x.m).padStart(2, '0')}` === ymU) || {};
      ok(rows.length === 1 && row.pos === 'cap' && row.block_hours === 55 && row.duty_hours === 120 && row.stay_nights === 4,
        '★そこから1つ足して送っても、前に入れた欄は空で上書きされない（保存先の同じ月に 乗務55時間・勤務120時間・ステイ4泊 が揃う）', J(rows));
      ok(s2.head === '情報を更新しました' && s2.rows.block_hours.v === '55時間' && s2.rows.duty_hours.v === '120時間' && s2.rows.stay_nights.v === '4泊' && J(c2) === J([...POP, ...POP]),
        '足して送った回の見出しは「情報を更新しました」。保存した内容に3つとも出て、合図はその保存で1度（合わせて2度）', J({ head: s2.head, block: s2.rows.block_hours, duty: s2.rows.duty_hours, stay: s2.rows.stay_nights, c2 }));

      /* もう一度「自分の回答を見る」（いま送った内容から起こした、手を付けていない入力ができる）→ 一覧へ戻る */
      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(u, 'work');
      await settle(u);
      await u.page.click('.pvc-root .pvc-prev');
      await waitView(u, 'list');
      await waitView(u, 'counted');
      const l1 = await listFace(u);
      ok(l1.state === 'fail ok' && l1.counts.length === 0 && /取得できませんでした/.test(l1.text) && !/\d\s*件/.test(l1.text),
        '★読めなかった一覧の代わりに、いま送った内容を件数に数えない（「あなたの投稿 N件」を出さず「取得できませんでした」のまま。件数はサーバが返した数だけ）', J(l1));

      /* 読む人が替わる：同じページのまま、別の会員のログインに替わる */
      await loginAs(u, 'pilot');
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(u, 'work');
      await settle(u);
      const v3 = await vals(u), f3 = await formFace(u);
      ok(v3.position === '' && v3.block_hours === '' && v3.duty_hours === '' && v3.stay_nights === '' && f3.tag === false && f3.btn === '匿名で追加する',
        '★自分の一覧が読めない時の控えでも、読む人が替わったら（同じページのまま別の会員のログインに替わる）、前の人が送った内容を入力に出さない（そのまま送れば、その人の投稿になってしまう。読めている一覧は 12-b）',
        J({ position: v3.position, block_hours: v3.block_hours, duty_hours: v3.duty_hours, stay_nights: v3.stay_nights, f3 }));
    } finally {
      await failOff();
      await u.st.ctx.close();
    }
  });

  /* 上の場面の最後は「入力を開き直したら空で出る」まで。ここは、いま送った内容から起こした入力（手を付けていない）が
     画面に出ているまま、読む人が替わる回 ── もう一方のタブでログアウトした・ログインが切れた・別の会員が入った。
     前の人の値を出したままにすると、(1) そのあと打った字が、捨てた写しへ入って送られない
     （職位が見えている画面で「職位を選んでください」と止まり、選び直しても進めなかった）
     (2) 手を付けずに送ると、前の人の内容が今の人の投稿になる。
     なので、今の人が最初に触れた時（確認のチェック・欄に入る・送る）に入力を作り直す。打った字は必ず保存へ届く。 */
  await scene('控えから起こした入力が出ているまま、読む人が替わる ── チェック・欄に入る・送る のどれが先でも', async () => {
    await failNext('my_work_months', null, 99);
    const u = await open('phone', { who: 'op' });
    /* 送ったあと、保存後の画面か、欄の断り（職位を選んでください 等）のどちらかが出るまで待つ */
    const settled = (p) => p.page.waitForFunction(() => {
      const r = document.querySelector('.pvc-root');
      return !!r.querySelector('[data-pvc-saved]') || [...r.querySelectorAll('.pvc-err')].some((n) => !n.hidden && n.textContent.trim());
    }, { timeout: 20000 }).then(() => true, () => false);
    const face = (p) => p.page.evaluate(() => {
      const r = document.querySelector('.pvc-root'), f = r.querySelector('form[data-pvc-form="work"]'), a = document.activeElement;
      const v = (n) => { const x = f && f.querySelector('[name="' + n + '"]'); return x ? x.value : null; };
      return { saved: !!r.querySelector('[data-pvc-saved]'), position: v('position'), block_hours: v('block_hours'), duty_hours: v('duty_hours'),
        own: f ? f.querySelector('[name="own"]').checked : null, at: a && a.getAttribute ? a.getAttribute('name') || a.tagName.toLowerCase() : '',
        errs: [...r.querySelectorAll('.pvc-err')].filter((n) => !n.hidden && n.textContent.trim()).map((n) => n.id.replace('pvc-e-', '') + '：' + n.textContent.trim()) };
    });
    const months = async () => (await workRows('eva-air')).map((x) => ({ ym: `${x.y}-${String(x.m).padStart(2, '0')}`, pos: x.pos, block: x.block_hours, duty: x.duty_hours })).sort((x, y) => (x.pos < y.pos ? -1 : 1));
    const heldRows = async () => (await q('select payload from public.pv_contrib_pending where airline = $1 and kind = $2 order by id', ['eva-air', 'work'])).rows
      .map((x) => ({ pos: x.payload.position, block: x.payload.block_hours == null ? null : Number(x.payload.block_hours), duty: x.payload.duty_hours == null ? null : Number(x.payload.duty_hours) }));
    /* いま送った内容から起こした、手を付けていない入力を出す（保存 →「自分の回答を見る」）。出ていなければ、下は別のものを見ることになる */
    const fromCopy = async (want) => {
      await send(u);
      await waitView(u, 'saved');
      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(u, 'work');
      await settle(u);
      const f = await face(u), w = (await formFace(u)).wait;
      if (f.position !== want.position || f.block_hours !== want.block_hours || f.duty_hours !== want.duty_hours || !/読み込めませんでした/.test(w)) {
        throw new Error('前提が崩れた（読めない一覧の代わりに、いま送った内容から起こした入力が出ていない）: ' + J({ want, f, w }));
      }
    };
    try {
      await go(u, EVA);
      await api(u, 'work');
      await waitView(u, 'work');
      await settle(u);
      const ymU = (await vals(u)).ym;
      const h0 = await heldRows();

      /* ① チェックが先：会員（運営）の入力が出ているまま、別の会員のログインに替わる → 確認のチェックを入れる */
      await pick(u, 'position', 'cap');
      await fill(u, 'block_hours', '55');
      await tick(u);
      await fromCopy({ position: 'cap', block_hours: '55', duty_hours: '' });
      await loginAs(u, 'c');   // この会社へ、ほかの場面で1件も送らない会員（次の場面の会員の件数を動かさない）
      await tick(u);
      const a1 = await face(u), b1 = await formFace(u);
      ok(a1.position === '' && a1.block_hours === '' && a1.own === true && b1.tag === false && b1.btn === '匿名で追加する',
        '★控えから起こした入力が出ているまま読む人が替わったら、確認のチェックを入れた時に入力を作り直す（前の人の職位・乗務時間を残さない。入れたチェックは消さない）', J({ a1, b1 }));
      await fill(u, 'duty_hours', '80');
      await pick(u, 'position', 'fo');
      await send(u);
      await settled(u);
      const a2 = await face(u), m2 = await months();
      ok(a2.saved && J(m2) === J([{ ym: ymU, pos: 'cap', block: 55, duty: null }, { ym: ymU, pos: 'fo', block: null, duty: 80 }]),
        '★作り直したあとに打った内容は、そのまま保存へ届く（捨てた写しへ入って「職位を選んでください」で止まらない）。前の人の行は変わらず、前の人の値は今の人の行に混ざらない', J({ a2, m2 }));

      /* ② 送るが先：チェックを入れたあとで読む人が替わり、何も触らずに送る */
      if (a2.saved) {
        await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
        await waitView(u, 'work');
        await settle(u);
      }
      await tick(u);
      const p3 = await face(u);
      if (p3.position !== 'fo' || p3.duty_hours !== '80' || p3.own !== true) throw new Error('前提が崩れた（②：いま送った内容から起こした入力に、チェックだけを入れた形になっていない）: ' + J(p3));
      await loginAs(u, 'op');
      await send(u);
      await settled(u);
      const a3 = await face(u), m3 = await months(), h3 = await heldRows();
      ok(!a3.saved && a3.position === '' && a3.duty_hours === '' && a3.errs.length === 1 && /^position：/.test(a3.errs[0]) && J(m3) === J(m2) && h3.length === h0.length,
        '★自分の一覧が読めない時の控えでも、読む人が替わったあと、何も触らずに送っても、前の人の内容は今の人の投稿として保存されない（入力を作り直し、空の職位に「職位を選んでください」と出す。保存先は1行も変わらない。読めている一覧は 12-b）', J({ a3, m3, held: h3.length - h0.length }));

      /* ③ 欄に入るのが先：会員（運営）の入力が出ているまま、ログアウトする（ログインが切れる）→ 欄に入って打つ */
      await pick(u, 'position', 'cap');
      await fill(u, 'block_hours', '60');
      await tick(u);
      await fromCopy({ position: 'cap', block_hours: '60', duty_hours: '' });
      await u.page.evaluate(() => { localStorage.removeItem('sb-local-auth-token'); localStorage.removeItem('pv_user'); });
      await fill(u, 'duty_hours', '90');
      const a4 = await face(u), b4 = await formFace(u);
      ok(a4.position === '' && a4.block_hours === '' && a4.duty_hours === '90' && a4.at === 'duty_hours' && b4.tag === false && b4.btn === '匿名で追加する',
        '★読む人が替わったあと、欄に入った時にも入力を作り直す（打ち始める前に前の人の値が消え、打った字は入った欄にそのまま入る）', J({ a4, b4 }));
      await pick(u, 'position', 'cap');
      await tick(u);
      await send(u);
      await settled(u);
      const a5 = await face(u), m5 = await months(), h5 = await heldRows();
      ok(a5.saved && h5.length === h0.length + 1 && J(h5[h5.length - 1]) === J({ pos: 'cap', block: null, duty: 90 })
        && J(m5) === J([{ ym: ymU, pos: 'cap', block: 60, duty: null }, { ym: ymU, pos: 'fo', block: null, duty: 80 }]),
        '★ログアウトしたあとに打って送った内容は、ログインなしの預かりに、打った分だけで入る（前の人の乗務時間が混ざらない。会員2人の行は変わらない）', J({ a5, held: h5.slice(h0.length), m5 }));
      const cues = await cueLog(u);
      ok(J(cues) === J([...POP, ...POP, ...POP, ...POP]),
        '入力を作り直しただけでは合図は出ない（合図は、保存できた4回に1度ずつ）', J(cues));
    } finally {
      await failOff();
      await u.st.ctx.close();
    }
  });

  /* 質問の項目（通勤・タクシー）でも同じ。こちらはサーバが「足したのか・置き換えたのか」を答えごとに返さないので、
     自分の答えの一覧が読めない会員には、足したのかどうかが分からない ── 見出しは「保存しました」のまま（「追加しました」と言い切らない）。
     保存はできているので、合図は同じ形で1度。 */
  await scene('自分の答えの一覧が読めない会員 ── 質問の項目（通勤・タクシー）', async () => {
    const FOUR = ['commuting_taxi_cost', 'commuting_taxi_where', 'commuting_transport', 'commuting_transport_method'];
    await failNext('my_airline_conditions', null, 99);
    const u = await open('phone', { who: 'pilot' });
    try {
      await go(u, EVA);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      const f0 = await formFace(u);
      if (!/読み込めませんでした/.test(f0.wait)) throw new Error('前提が崩れた（自分の答えの一覧を読む口が落ちていない）: ' + J(f0));
      await pick(u, 'commuting_transport', 'conditional');
      await chip(u, 'commuting_transport_method', 'company_taxi');
      await pick(u, 'commuting_taxi_where', 'within_area');
      await pick(u, 'commuting_taxi_cost', 'company_full');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s1 = await summary(u);
      const c1 = await cueLog(u);
      ok(s1.head === '保存しました' && J(c1) === J(POP),
        '★質問の項目でも、足したのか置き換えたのか分からない回（自分の答えの一覧が読めない会員）の見出しは「保存しました」。合図は1度だけ出る', J({ head: s1.head, c1 }));
      ok(J(Object.keys(s1.rows).sort()) === J(FOUR) && FOUR.every((k) => s1.rows[k].v && !s1.rows[k].none),
        '★自分の答えの一覧が読めなくても、保存後の画面の「保存した内容」に、いま送った4問が出る（空の一覧にしない）', J(s1.rows));

      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(u, 'taxi');
      await settle(u);
      const v1 = await vals(u), f1 = await formFace(u);
      ok(v1.commuting_transport === 'conditional' && J(v1.commuting_transport_method || []) === J(['company_taxi'])
        && v1.commuting_taxi_where === 'within_area' && v1.commuting_taxi_cost === 'company_full' && f1.mine === 4 && f1.btn === '匿名で更新する',
        '★質問の項目でも「自分の回答を見る」を押すと、いま送った4問が答えの入った形で出る（「あなたの投稿」の札が4つ・ボタンは「匿名で更新する」。空の入力に戻さない）',
        J({ transport: v1.commuting_transport, method: v1.commuting_transport_method, where: v1.commuting_taxi_where, cost: v1.commuting_taxi_cost, f1 }));

      /* そこから1問だけ直して送る */
      const filled = !!v1.commuting_taxi_cost;
      if (!filled) {   // 入力が空で出た回（＝上が赤い回）も、答え直して先へ進める
        await pick(u, 'commuting_transport', 'conditional');
        await chip(u, 'commuting_transport_method', 'company_taxi');
        await pick(u, 'commuting_taxi_where', 'within_area');
      }
      await pick(u, 'commuting_taxi_cost', 'partial');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s2 = await summary(u);
      const d2 = await condRows('eva-air');
      const one = (k) => (d2[k] || []).length === 1 ? d2[k][0] : {};
      ok(filled && J(Object.keys(s2.rows).sort()) === J(FOUR) && !!s2.rows.commuting_taxi_cost && s2.rows.commuting_taxi_cost.v !== s1.rows.commuting_taxi_cost.v
        && one('commuting_taxi_cost').c === 'partial' && one('commuting_taxi_where').c === 'within_area' && one('commuting_transport').c === 'conditional'
        && J(one('commuting_transport_method').cs) === J(['company_taxi']) && Object.keys(d2).length === 4,
        '★そこから1問だけ直して送っても、ほかの3問は消えない（保存した内容に4問・保存先も1問1行で4問。直した1問だけが変わる）', J({ filled, rows: s2.rows, d2 }));

      /* 上の質問を「ない」へ答え直す → 下の質問の前の答えは、保存した内容に出さない */
      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(u, 'taxi');
      await settle(u);
      await pick(u, 'commuting_transport', 'no');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s3 = await summary(u);
      ok(J(Object.keys(s3.rows)) === J(['commuting_transport']) && s3.rows.commuting_transport.v !== s1.rows.commuting_transport.v,
        '★一覧が読めない会員でも、上の質問を「ない」に答え直すと、下の質問の前の答えは「保存した内容」に出ない（読めたときと同じ見せ方）', J(s3.rows));

      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="more"]');
      await waitView(u, 'list');
      await waitView(u, 'counted');
      const l1 = await listFace(u);
      ok(l1.state === 'ok fail' && l1.counts.length === 0 && /取得できませんでした/.test(l1.text) && !/\d\s*件/.test(l1.text),
        '★質問の項目でも、読めなかった一覧の代わりに いま送った答えを件数に数えない（「あなたの投稿 N件」を出さない）', J(l1));

      /* ログアウトした（ログインが切れた）あと：同じページのまま、前に送った答えを入力に出さない */
      await u.page.evaluate(() => { localStorage.removeItem('sb-local-auth-token'); localStorage.removeItem('pv_user'); });
      await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(u, 'taxi');
      await settle(u);
      const v4 = await vals(u), f4 = await formFace(u);
      ok(v4.commuting_transport === '' && !v4.commuting_transport_method && f4.mine === 0 && f4.btn === '匿名で追加する',
        '★自分の一覧が読めない時の控えでも、ログアウトしたあと（ログインが切れたあと）は、同じページのままでも、前に送った答えを入力に出さない（読めている一覧は 12-b）', J({ transport: v4.commuting_transport, method: v4.commuting_transport_method, f4 }));
    } finally {
      await failOff();
      await u.st.ctx.close();
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 12-b. 自分の一覧が読めている会員 ── 面を開いたまま、読む人が替わる（全日本空輸・390×680）
  // ═════════════════════════════════════════════════════════════
  /* 上の3つの場面は、自分の一覧を読む口を落としてある ＝ 読めない時だけ使う「控え」の道だけを見ている。
     ここは、一覧が普通に読めている、ふつうの会員の状態（前の人の一覧を読む口は、1つも落とさない）。
     面を開いたまま読む人が替わる ── 別の会員が入る・ログアウトする・ログインが切れる・ほかのタブで替わる。
     このページは読み直されないので、何もしなければ、前の人が保存した答えが、次の人の画面に出て・数えられて・送られる。
     決まり：前の人が保存したもの・前の人について読んだものは、全部手放す（一覧・件数・保存した値から入った入力・
             保存後のカード・確認のチェック・知らせ）。打って、まだ送っていない入力は残す。
     どの場面も、画面と、手元の保存先の両方を見る。前の人＝給与提出者・今の人＝会員B。
     （この会社へは、ほかの場面でどちらも1件も送っていない。念のため、場面の頭で2人の行を消してから、前の人の投稿を置く。） */
  const PREV = memberOf('pay'), NEXT = memberOf('b');
  const FLEET = JSON.parse(read('pv-vocab.json')).fleets.find((x) => !x.retired).code;
  const LAST = (() => { const n = new Date(); let y = n.getFullYear(), m = n.getMonth(); if (m === 0) { y -= 1; m = 12; } return { y, m }; })();
  const NOTE_W = '試験：前の人の月のメモ', NOTE_Q = '試験：前の人だけの補足';
  const rpcAs = async (key, fn, p) => {
    const s = await (await fetch(`${base}/__local/login?member=${key}`)).json();
    return (await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${s.session.access_token}` }, body: JSON.stringify({ p }),
    })).json();
  };
  /* その会員の、この会社の行（保存先から直接。行に会員の id は無いので、サーバと同じ式の印で引く） */
  const mineOf = async (id) => ({
    work: (await q(
      `select period_year as y, period_month as m, "position" as pos, fleet, block_hours::float8 as block, duty_hours::float8 as duty, stay_nights as stay, note
         from public.pv_work_months where airline = 'ana' and proof_hash = public.pv_work_hash($1::uuid, 'ana', null) order by 1, 2`, [id])).rows,
    cond: (await q(
      `select question_id as q, answer_code as c, answer_codes as cs, answer_text as t, "position" as pos, fleet
         from public.airline_conditions where airline = 'ana' and proof_hash = public.pv_condition_hash($1::uuid, 'ana', null) order by 1`, [id])).rows,
  });
  const heldAna = async () => (await q(`select kind, item_key as k, payload from public.pv_contrib_pending where airline = 'ana' order by id`)).rows;
  /* 2人の行と預かりを消して、前の人の投稿を置く：月の勤務1か月（機長・機種・乗務時間・ステイ・メモ）と、
     通勤・タクシーの3問（1問目には補足つき）。置くのは会員の入口から（画面は通さない）。 */
  const seedPrev = async () => {
    await q(`delete from public.pv_work_months where airline = 'ana' and proof_hash in (public.pv_work_hash($1::uuid, 'ana', null), public.pv_work_hash($2::uuid, 'ana', null))`, [PREV.id, NEXT.id]);
    await q(`delete from public.airline_conditions where airline = 'ana' and proof_hash in (public.pv_condition_hash($1::uuid, 'ana', null), public.pv_condition_hash($2::uuid, 'ana', null))`, [PREV.id, NEXT.id]);
    await q(`delete from public.pv_contrib_pending where airline = 'ana'`);
    /* 1日に送れる件数の数えも戻す（場面を重ねると、置くだけで上限に届く。上限そのものは db/test-*.mjs が見ている） */
    await q(`update public.profiles set cond_answers_today = 0, work_months_today = 0 where id in ($1::uuid, $2::uuid)`, [PREV.id, NEXT.id]);
    const w = await rpcAs('pay', 'submit_work_month', { airline: 'ana', year: LAST.y, month: LAST.m, position: 'cap', fleet: FLEET, block_hours: 61.5, stay_nights: 7, note: NOTE_W, lang: 'ja' });
    const c = await rpcAs('pay', 'submit_airline_conditions', { airline: 'ana', lang: 'ja', position: 'cap', fleet: FLEET, answers: [
      { question_id: 'commuting_transport', code: 'conditional', text: NOTE_Q, share: true },
      { question_id: 'commuting_transport_method', codes: ['company_taxi'] },
      { question_id: 'commuting_taxi_cost', code: 'company_full' },
    ] });
    if (!w || !w.ok || !c || !c.ok || (c.rejected || []).length) throw new Error('前提が崩れた（前の人の投稿を置けない）: ' + J({ w, c }));
  };
  const COUNTS0 = ['work：あなたの投稿 1件', 'taxi：あなたの投稿 3件'];
  /* 通勤・タクシーの入力に、いま出ているもの */
  const qFace = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), f = r.querySelector('form[data-pvc-form="taxi"]'), a = document.activeElement;
    if (!f) return { form: false, saved: !!r.querySelector('[data-pvc-saved]'), list: !!r.querySelector('.pvc-tiles') };
    const v = (n) => { const x = f.querySelector('[name="' + n + '"]'); return x ? x.value : null; };
    const b = f.querySelector('.pvc-send[type="submit"]');
    return { form: true, transport: v('commuting_transport'), note: v('commuting_transport_note'), cost: v('commuting_taxi_cost'),
      method: [...f.querySelectorAll('[name="commuting_transport_method"]')].filter((x) => x.checked).map((x) => x.value),
      own: f.querySelector('[name="own"]').checked, mine: f.querySelectorAll('.pvc-mine').length, btn: b.textContent, dis: b.disabled,
      off: f.querySelector('fieldset.pvc-set').disabled,
      at: a && f.contains(a) ? a.getAttribute('name') || a.tagName.toLowerCase() : '',
      msg: [...f.querySelectorAll('.pvc-msg')].map((n) => n.getAttribute('data-pvc-msg')) };
  });
  /* 月の勤務の入力に、いま出ているもの */
  const wFace = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), f = r.querySelector('form[data-pvc-form="work"]');
    if (!f) return { form: false, saved: !!r.querySelector('[data-pvc-saved]'), list: !!r.querySelector('.pvc-tiles') };
    const v = (n) => { const x = f.querySelector('[name="' + n + '"]'); return x ? x.value : null; };
    const b = f.querySelector('.pvc-send[type="submit"]');
    return { form: true, position: v('position'), fleet: v('fleet'), block_hours: v('block_hours'), duty_hours: v('duty_hours'), stay_nights: v('stay_nights'), note: v('note'),
      own: f.querySelector('[name="own"]').checked, tag: !f.querySelector('[data-pvc-own-row]').hidden, btn: b.textContent, dis: b.disabled,
      errs: [...f.querySelectorAll('.pvc-err')].filter((n) => !n.hidden && n.textContent.trim()).map((n) => n.id.replace('pvc-e-', '')),
      msg: [...f.querySelectorAll('.pvc-msg')].map((n) => n.getAttribute('data-pvc-msg')) };
  });
  const emptyQ = (x) => x.form && x.transport === '' && x.note === '' && x.cost === '' && x.method.length === 0 && x.mine === 0 && x.btn === '匿名で追加する';
  const emptyW = (x) => x.form && x.position === '' && x.fleet === '' && x.block_hours === '' && x.duty_hours === '' && x.stay_nights === '' && x.note === ''
    && x.tag === false && x.btn === '匿名で追加する';
  const fullQ = (x, cost) => x.form && x.transport === 'conditional' && x.note === NOTE_Q && x.cost === cost && J(x.method) === J(['company_taxi']) && x.mine === 3 && x.btn === '匿名で更新する';
  const fullW = (x) => x.form && x.position === 'cap' && x.fleet === FLEET && x.block_hours === '61.5' && x.stay_nights === '7' && x.note === NOTE_W && x.tag === true && x.btn === '匿名で更新する';
  /* 画面の上の条件が満たされるまで待つ（満たされないまま時間が来たら false。時間で待つのではない） */
  const seen = (p, fn, arg) => p.page.waitForFunction(fn, { timeout: 8000, polling: 100 }, arg).then(() => true, () => false);
  const taxiCleared = () => {
    const f = document.querySelector('.pvc-root form[data-pvc-form="taxi"]');
    return !!f && f.querySelector('[name="commuting_transport_note"]').value === '' && f.querySelectorAll('.pvc-mine').length === 0;
  };
  /* 閉じている「情報を追加」の面の中（画面には出ていない所）に、いま在るもの。
     open・up ＝ 面が開いている・出ている（どちらも false のはず）／text ＝ 面の中の字ぜんぶ（題・頭の会社の名前の行・本文）／
     kids ＝ 題と本文の中に在るものの数／ctl ＝ 入力欄の数／vals ＝ 入力欄に入っている値／mine ＝「あなたの投稿」の印の数／
     saved ＝ 保存後のカードが在る／whose ＝ 頭の会社の名前の行の字／html ＝ 面の中身そのもの（字でない所も） */
  const shutSheet = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), t = r && r.querySelector('.pvc-title'), m = r && r.querySelector('.pvc-main');
    if (!r || !t || !m) return null;
    const ctl = [...m.querySelectorAll('input, select, textarea')];
    return { open: window.PVContrib.isOpen(), up: r.classList.contains('is-in'), text: r.textContent, kids: t.childNodes.length + m.childNodes.length,
      ctl: ctl.length, vals: ctl.filter((n) => n.type !== 'checkbox' && n.type !== 'radio').map((n) => n.value).filter(Boolean),
      mine: m.querySelectorAll('.pvc-mine').length, saved: !!m.querySelector('[data-pvc-saved]'),
      whose: [...t.querySelectorAll('.pvc-whose')].map((n) => n.textContent).join('｜'), html: r.outerHTML };
  });
  /* 閉じた面の題にも本文にも、何も入っていない（seen に渡して、そうなるまで待つ） */
  const sheetBare = () => {
    const r = document.querySelector('.pvc-root'), t = r && r.querySelector('.pvc-title'), m = r && r.querySelector('.pvc-main');
    return !!t && !!m && t.childNodes.length === 0 && m.childNodes.length === 0;
  };
  /* 閉じたままの面が、空になっている：字が1つも無い・入力欄も印も無い。面は開いていない */
  const shutBare = (x) => !!x && !x.open && !x.up && x.text === '' && x.kids === 0 && x.ctl === 0 && x.mine === 0 && !x.saved && x.whose === '';
  /* 検査の側の条件が満たされるまで待つ（止めた通信が届いたか、など） */
  const until = async (fn) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > 8000) return false; await new Promise((r) => setTimeout(r, 20)); } return true; };
  /* 送るボタンを、ほかの何にも触れずに押す（焦点も動かさない ＝ 止められるのは、送る所の確かめだけ） */
  const pressSend = (p) => p.page.evaluate(() => document.querySelector('.pvc-root form .pvc-send[type="submit"]').click());
  /* 同じブラウザの、もう1枚のタブ（保存領域は同じ。こちらで書くと、最初のタブに「書かれた」という合図が届く） */
  const otherTab = async (p) => {
    const t = await p.st.ctx.newPage();
    await t.setRequestInterception(true);
    t.on('request', (req) => gate(req, { calls: [], fake: null }));
    await t.goto(base + '/pv-vocab.json', { waitUntil: 'domcontentloaded' });
    await p.page.bringToFront();                       // 最初のタブを前へ戻す（裏のタブでは、描画に合わせた待ちが進まない）
    return t;
  };
  const loginIn = async (tab, key) => {
    const s = await (await fetch(`${base}/__local/login?member=${key}`)).json();
    await tab.evaluate((x) => { localStorage.setItem('sb-local-auth-token', JSON.stringify(x.session)); localStorage.setItem('pv_user', JSON.stringify(x.pv_user)); }, s);
  };
  const subs = (p, from) => p.st.calls.slice(from).filter((c) => /^(submit_|claim_)/.test(c));
  /* 止めておいた通信を流す */
  const release = (p) => { const h = p.st.hold; p.st.hold = null; for (const r of (h ? h.reqs : [])) r.continue(); };
  /* 止めておいた通信を、届かなかったことにする（送っている最中に通信が切れた回を作る） */
  const cutHeld = (p) => { const h = p.st.hold; p.st.hold = null; for (const r of (h ? h.reqs : [])) r.abort(); };
  /* ── 12-c で使う ──
     この会社のページに1件も持っていない会員にする（その会員の行と、この会社の預かりを消す。1日の数えも戻す）。
     12-c の場面は、頭と終わりの両方で呼ぶ ＝ あとの場面が見るこの会社のページは、12-b が残した形のまま。 */
  const noRows = async (...ms) => {
    for (const m of ms) {
      await q(`delete from public.pv_work_months where airline = 'ana' and proof_hash = public.pv_work_hash($1::uuid, 'ana', null)`, [m.id]);
      await q(`delete from public.airline_conditions where airline = 'ana' and proof_hash = public.pv_condition_hash($1::uuid, 'ana', null)`, [m.id]);
      await q(`update public.profiles set cond_answers_today = 0, work_months_today = 0 where id = $1::uuid`, [m.id]);
    }
    await q(`delete from public.pv_contrib_pending where airline = 'ana'`);
  };
  /* 会社ページを離れてから、ログインを書く（ログインの画面へ行って戻ってくる人と同じ ＝ ログインが保存される時に、
     面の開いたページは無い）。このあとページを開き直すので、open が入れるのと同じ印もそろえる。 */
  const loginAway = async (p, key) => {
    const s = await (await fetch(`${base}/__local/login?member=${key}`)).json();
    await go(p, '/pv-vocab.json');
    await p.page.waitForFunction(() => location.pathname === '/pv-vocab.json' && !window.PVContrib);
    await p.page.evaluate((x) => {
      const now = String(Date.now());
      localStorage.setItem('sb-local-auth-token', JSON.stringify(x.session));
      localStorage.setItem('pv_user', JSON.stringify(x.pv_user));
      localStorage.setItem('pv_last_active', now);
      localStorage.setItem('pv_session_start', now);
      const at = Date.parse((x.session.user || {}).last_sign_in_at || '');
      localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now(), s: String(isNaN(at) ? now : at) }));
    }, s);
  };
  /* ほかのタブで書いたログインが、このタブからも読めるようになるまで待つ（タブの間の保存領域は、少し遅れて届く） */
  const readsAs = (p, m) => seen(p, (id) => {
    try { return JSON.parse(localStorage.getItem('sb-local-auth-token')).user.id === id; } catch (e) { return false; }
  }, m.id);
  /* 会員の id が読めないログイン（ログインは保存されていて使えるが、面からは会員の id が読めない）を作る。
     面が id を読む口は PVSession.readStoredSession の1つだけ（pv-contrib.js の uid()。ほかの台本は、この口を呼ばない）。
     そこに1枚かぶせ、スイッチが入っているあいだだけ、本物が返した中身から user.id を抜いて返す。
     保存されているログインそのものには触らない ＝ ログインの部品が id を書き戻さない・会員はサーバで読めて保存できる
     （保存領域のほうを id なしにする形は、部品が書き戻すので保てなかった）。hasToken() は本物のまま。
     ページの台本が1本も動く前に仕掛ける（open のあと・最初の go の前に呼ぶ）。スイッチは、このタブの sessionStorage に置く
     ＝ 同じタブで開き直しても残る・場面の途中で入れ替えられる（noId）。
     あわせて、ページを開いて少しあとの引き継ぎ（1500ミリ秒の時計）の中身を控える。時計は今までどおり自分でも鳴る（ran）。
     場面は、時計を待たずにその中身を呼ぶ（bootClaim）。
     面が「いま読む人」を自分で聞き直す時計（pv-contrib.js が仕掛ける setInterval。ログインの部品 pv-session.js も
     同じ長さの時計を持つので、仕掛けた台本で見分ける）も、中身と間隔を控える（__pvcTick。場面は tickFire で呼ぶ。こちらも待たない）。 */
  const idless = (p, on) => p.page.evaluateOnNewDocument((origin, on0) => {
    if (location.origin !== origin) return;
    try { if (sessionStorage.getItem('__pvc_noid') === null) sessionStorage.setItem('__pvc_noid', on0 ? '1' : '0'); } catch (e) { /* 置けなければ、場面の頭の確かめが止める */ }
    const isOn = () => { try { return sessionStorage.getItem('__pvc_noid') === '1'; } catch (e) { return false; } };
    let real;
    Object.defineProperty(window, 'PVSession', {
      configurable: true,
      get: () => real,
      set: (o) => {
        if (o && typeof o.readStoredSession === 'function') {
          const read = o.readStoredSession;
          o.readStoredSession = function () {
            const s = read.apply(this, arguments);
            if (!isOn() || !s || !s.user) return s;
            const user = Object.assign({}, s.user);
            delete user.id;
            return Object.assign({}, s, { user });
          };
        }
        real = o;
      },
    });
    const timer = window.setTimeout;
    window.__pvcBoot = { fn: null, ran: false };
    window.setTimeout = function (fn, ms) {
      if (ms !== 1500 || typeof fn !== 'function' || window.__pvcBoot.fn || !/claim\(\)/.test(String(fn))) return timer.apply(window, arguments);
      const args = Array.prototype.slice.call(arguments);
      window.__pvcBoot.fn = fn;
      args[0] = function () { window.__pvcBoot.ran = true; return fn.apply(this, arguments); };
      return timer.apply(window, args);
    };
    const every = window.setInterval;
    window.__pvcTick = { fn: null, ms: null };
    window.setInterval = function (fn, ms) {
      if (typeof fn === 'function' && !window.__pvcTick.fn && /\/pv-contrib\.js/.test(String(new Error().stack))) { window.__pvcTick.fn = fn; window.__pvcTick.ms = ms; }
      return every.apply(window, arguments);
    };
  }, base, on);
  const noId = (p, on) => p.page.evaluate((v) => { sessionStorage.setItem('__pvc_noid', v ? '1' : '0'); }, on);
  /* ［ログインが保存されている, 会員の id が読める］ */
  const whoState = (p) => p.page.evaluate(() => [window.PVSession.hasToken(), !!((window.PVSession.readStoredSession() || {}).user || {}).id]);
  const mustBeIdless = async (p, at) => {
    const s = await whoState(p);
    if (J(s) !== J([true, false])) throw new Error(`前提が崩れた（${at}：ログインは保存されていて、会員の id が読めない形になっていない）: ` + J(s));
  };
  const bootClaim = async (p) => {
    if (!(await seen(p, () => !!(window.__pvcBoot && window.__pvcBoot.fn)))) return false;
    await p.page.evaluate(() => { window.__pvcBoot.fn(); });
    return true;
  };
  const bootRan = (p) => seen(p, () => !!(window.__pvcBoot && window.__pvcBoot.ran));
  /* 面の時計の中身を呼ぶ（時計は待たない）。返すのは、その時計の間隔（ミリ秒）。時計が無ければ null。 */
  const tickFire = (p) => p.page.evaluate(() => { const t = window.__pvcTick; if (!t || typeof t.fn !== 'function') return null; t.fn(); return t.ms; });
  /* ページが1往復の通信を終えるまで待つ（「出ていかなかった」を見る前に。時間では待たない） */
  const roundTrip = (p) => p.page.evaluate(() => fetch('/pv-vocab.json', { cache: 'no-store' }).then((r) => r.text()).then((t) => t.length > 0, () => false));
  /* 自分の投稿を読みに行く通信・引き継ぎの通信 */
  const reads = (p, from) => p.st.calls.slice(from).filter((c) => /^(my_work_months|my_airline_conditions|my_contrib_anon|claim_contrib)$/.test(c));
  /* 面に見えている字。all を付けると、入力欄に入っている値も足す */
  const sheetText = (p, all) => p.page.evaluate((a) => {
    const s = document.querySelector('.pvc-root .pvc-sheet');
    return s.innerText + (a ? '\n' + [...s.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]),textarea')].map((n) => n.value).join('\n') : '');
  }, !!all);
  /* 「保存しました」の知らせ（入力の中）。in ＝ 面の見えている範囲に、全部入っている */
  const savedSaid = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), m = r.querySelector('.pvc-main').getBoundingClientRect();
    return [...r.querySelectorAll('form .pvc-msg[data-pvc-msg="saved"]')].map((n) => {
      const b = n.getBoundingClientRect(), t = n.querySelector('.pvc-msg-t');
      return { title: t ? t.textContent : '', text: n.innerText.trim(), in: b.height > 0 && b.top >= m.top - 0.5 && b.bottom <= Math.min(m.bottom, window.innerHeight) + 0.5 };
    });
  });
  /* 送ったあと、保存後のカードか、入力の中の知らせが出るまで待つ */
  const afterSend = (p) => seen(p, () => { const r = document.querySelector('.pvc-root'); return !!r.querySelector('[data-pvc-saved]') || !!r.querySelector('form .pvc-msg'); });
  const NOREAD_L = 'あなたの投稿の件数を取得できませんでした。';
  const NOREAD_W = 'これまでの投稿を読み込めませんでした。このまま送れます（同じ月の投稿があれば、今回の内容に置き換わります）。';
  const NOREAD_Q = 'これまでの投稿を読み込めませんでした。このまま送れます（同じ質問の答えがあれば、今回の内容に置き換わります）。';

  /* B1：前の人が1問を保存し、保存後のカードが出ているまま、読む人が替わる。あとは本物のクリックだけ。 */
  const LEAVE = {
    member: { t: '別の会員がログインする', state: 'ok ok', text: /まだありません/, go: (u) => loginAs(u, 'b') },
    logout: { t: 'ログアウトする', state: 'anon anon', text: /^$/, go: (u) => u.page.evaluate(() => { window.PVSession.wipe(); }) },
    expire: { t: 'ログインの期限が切れる', state: 'anon anon', text: /^$/, go: async (u) => {
      const r = await u.page.evaluate(() => { localStorage.setItem('pv_last_active', String(Date.now() - 8 * 24 * 60 * 60 * 1000)); return [window.PVSession.check(), window.PVSession.hasToken()]; });
      if (J(r) !== J([true, false])) throw new Error('前提が崩れた（ログインの期限切れを作れていない）: ' + J(r));
    } },
  };
  for (const kind of ['member', 'logout', 'expire']) {
    const L = LEAVE[kind];
    await scene(`読めている一覧のまま、読む人が替わる ── ${L.t}（一覧へ戻る → 同じ項目を開く）`, async () => {
      await seedPrev();
      const u = await open('phone', { who: 'pay' });
      try {
        await go(u, ANA);
        await api(u, 'list');
        await waitView(u, 'counted');
        const l0 = await listFace(u);
        await u.page.click('.pvc-root [data-pvc-tile="work"]');
        await waitView(u, 'work');
        await settle(u);
        const w0 = await wFace(u);
        await tick(u);                                   // 前の人の確認のチェック（送らない）
        await u.page.click('.pvc-root .pvc-prev');
        await waitView(u, 'list');
        await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
        await waitView(u, 'taxi');
        await settle(u);
        const q0 = await qFace(u);
        await pick(u, 'commuting_taxi_cost', 'partial');
        await tick(u);
        await send(u);
        await waitView(u, 'saved');
        const s0 = await summary(u);
        if (l0.state !== 'ok ok' || J(l0.counts) !== J(COUNTS0) || !fullW(w0) || !fullQ(q0, 'company_full') || s0.head !== '情報を更新しました' || !s0.rows.commuting_transport_note) {
          throw new Error('前提が崩れた（前の人の一覧が読めていて、1問を保存した直後のカードが出ている形になっていない）: ' + J({ l0, w0, q0, head: s0.head }));
        }
        const before = { prev: await mineOf(PREV.id), next: await mineOf(NEXT.id) };
        /* 保存のあと、ページの側（career-live.js）が自分の集計を1回読み直す（pvc:saved）。その1本が出てから数え始める
           ── 出る前に数え始めると、面とは関係のないその1本が「読む人が替わったあとの通信」に数えられる。時間では待たない。 */
        const sentAt = u.st.calls.lastIndexOf('submit_airline_conditions');
        if (!(await until(() => u.st.calls.indexOf('pv_contrib_facts', sentAt) > sentAt))) throw new Error('前提が崩れた（保存のあと、ページが集計を読み直していない）');
        const n0 = u.st.calls.length;

        await L.go(u);
        await u.page.click('.pvc-root .pvc-saved [data-pvc-act="more"]');
        await waitView(u, 'list');
        await waitView(u, 'counted');
        const l1 = await listFace(u);
        ok(l1.counts.length === 0 && l1.state === L.state && L.text.test(l1.text),
          `★${L.t}：一覧へ戻ると、前の人の「あなたの投稿 N件」は1つも出ない（読めている一覧でも）`, J(l1));

        await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
        await waitView(u, 'taxi');
        await settle(u);
        const q1 = await qFace(u);
        ok(emptyQ(q1) && !q1.own,
          `★${L.t}：同じ項目を開くと、前の人の答えも補足も入っていない（「あなたの投稿」の札なし・ボタンは「匿名で追加する」・保存後のカードも出ない）`, J(q1));

        await u.page.click('.pvc-root .pvc-prev');
        await waitView(u, 'list');
        await u.page.click('.pvc-root [data-pvc-tile="work"]');
        await waitView(u, 'work');
        await settle(u);
        const w1 = await wFace(u);
        ok(emptyW(w1), `★${L.t}：月の勤務を開くと、前の人の職位・機種・乗務時間・ステイ・メモが入っていない`, J(w1));
        ok(w1.own === false, `★${L.t}：前の人が入れた確認のチェック（本人が直接経験した内容です）は外れている`, J({ own: w1.own }));

        const after = { prev: await mineOf(PREV.id), next: await mineOf(NEXT.id) };
        const calls = u.st.calls.slice(n0);
        ok(subs(u, n0).length === 0 && J(after) === J(before) && (kind === 'member' || calls.length === 0),
          `${L.t}：ここまでで、送る通信は1本も出ていない。保存先は2人とも1行も変わらない${kind === 'member' ? '' : '（ログインなしの人は、読みにも行かない）'}`, J({ calls, same: J(after) === J(before) }));

        /* 前の人が、同じページのままログインし直す → 一覧へ戻ると、その人の件数が戻る（ログインなしの人から会員への入れ替わりにも気づく） */
        await loginAs(u, 'pay');
        await u.page.click('.pvc-root .pvc-prev');
        await waitView(u, 'list');
        await waitView(u, 'counted');
        const l2 = await listFace(u);
        ok(l2.state === 'ok ok' && J(l2.counts) === J(COUNTS0),
          `${L.t}：そのあと前の人がログインし直すと、一覧にその人の件数が戻る`, J(l2));
      } finally {
        await u.st.ctx.close();
      }
    });
  }

  /* B2：送るボタンだけが押される。前の人が1つ打って、確認のチェックも入れてある入力のまま、読む人が替わる。 */
  await scene('読めている一覧のまま、読む人が替わる ── ほかに何も触れずに送るボタンが押される（質問の項目）', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    const sentQ = tap(u, 'submit_airline_conditions');
    try {
      await go(u, ANA);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      await tick(u);
      const p0 = await qFace(u);
      if (!fullQ(p0, 'company_full') || !p0.own) throw new Error('前提が崩れた（前の人の保存した答えが入り、チェックだけを入れた入力になっていない）: ' + J(p0));
      const before = { prev: await mineOf(PREV.id), next: await mineOf(NEXT.id) };

      /* ① 何も打っていない */
      await loginAs(u, 'b');
      let n0 = u.st.calls.length;
      await pressSend(u);
      await seen(u, () => { const r = document.querySelector('.pvc-root'); return !r.querySelector('form .pvc-mine') || !!r.querySelector('form .pvc-msg') || !!r.querySelector('[data-pvc-saved]'); });
      const q1 = await qFace(u);
      ok(subs(u, n0).length === 0 && emptyQ(q1) && !q1.own && q1.msg.length === 0,
        '★読む人が替わったあと、ほかに何も触れずに送るボタンが押されても、その1回では何も送らない（入力を作り直すだけ。前の人の答え・補足・チェックは消える）', J({ sent: subs(u, n0), q1 }));
      await api(u, 'list');
      await waitView(u, 'counted');
      await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(u, 'taxi');
      await settle(u);
      await tick(u);
      await send(u);
      await waitMsg(u, 'said');
      ok(/1つ以上答えてください/.test(await msg(u, 'said')) && subs(u, n0).length === 0 && J(await mineOf(NEXT.id)) === J(before.next),
        '★何も打っていない今の人がチェックを入れて送っても、何も保存されない（「1つ以上答えてください」。前の人の答えが今の人の投稿にならない）', J({ sent: subs(u, n0), said: await msg(u, 'said') }));

      /* ② 前の人が1つだけ打ってある */
      await loginAs(u, 'pay');
      await api(u, 'list');
      await waitView(u, 'counted');
      await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(u, 'taxi');
      await settle(u);
      const p2 = await qFace(u);
      if (!fullQ(p2, 'company_full')) throw new Error('前提が崩れた（②：前の人に戻して、保存した答えが入った入力になっていない）: ' + J(p2));
      await pick(u, 'commuting_transport', 'always');     // 打った1つ
      await tick(u);
      await loginAs(u, 'b');
      n0 = u.st.calls.length;
      const sent0 = sentQ.length;
      await pressSend(u);
      await seen(u, () => { const r = document.querySelector('.pvc-root'); return !r.querySelector('form .pvc-mine') || !!r.querySelector('form .pvc-msg') || !!r.querySelector('[data-pvc-saved]'); });
      const q3 = await qFace(u);
      ok(subs(u, n0).length === 0 && q3.form && q3.transport === 'always' && q3.note === '' && q3.method.length === 0 && q3.mine === 0 && !q3.own && q3.msg.length === 0,
        '★1つ打ってあった入力でも、その1回では何も送らない。打った1つは残り、前の人の補足・ほかの答え・チェックは消える', J({ sent: subs(u, n0), q3 }));
      await api(u, 'list');
      await waitView(u, 'counted');
      await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(u, 'taxi');
      await settle(u);
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s4 = await summary(u);
      const pl = sentQ[sentQ.length - 1] || {};
      const after = { prev: await mineOf(PREV.id), next: await mineOf(NEXT.id) };
      ok(sentQ.length === sent0 + 1 && J(pl.answers) === J([{ question_id: 'commuting_transport', code: 'always' }]) && !('position' in pl) && !('fleet' in pl),
        '★今の人がチェックを入れて押し直すと、出ていくのは打った1つだけ（前の人の補足・職位・機種が入らない）', J(pl));
      ok(J(after.next.cond) === J([{ q: 'commuting_transport', c: 'always', cs: null, t: null, pos: null, fleet: null }]) && after.next.work.length === 0 && J(after.prev) === J(before.prev),
        '★保存先：今の人の行はその1つだけ（補足・職位・機種は空）。前の人の行は1つも変わらない', J(after.next));
      ok(s4.head === '情報を追加しました' && J(Object.keys(s4.rows)) === J(['commuting_transport']),
        '★保存後のカードは「情報を追加しました」で、出るのはその1つだけ', J({ head: s4.head, rows: Object.keys(s4.rows) }));
    } finally {
      await u.st.ctx.close();
    }
  });

  await scene('読めている一覧のまま、読む人が替わる ── ほかに何も触れずに送るボタンが押される（月の勤務）', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    const sentW = tap(u, 'submit_work_month');
    try {
      await go(u, ANA);
      await api(u, 'work');
      await waitView(u, 'work');
      await settle(u);
      const w0 = await wFace(u);
      if (!fullW(w0)) throw new Error('前提が崩れた（前の人の保存した月が入った入力になっていない）: ' + J(w0));
      /* 前の人が打ったのは、職位と勤務時間の2つ（送れる形がそろっている ＝ 止めるのは、送る所の確かめだけ） */
      await pick(u, 'position', 'fo');
      await fill(u, 'duty_hours', '120');
      await tick(u);
      const before = { prev: await mineOf(PREV.id), next: await mineOf(NEXT.id) };
      await loginAs(u, 'b');
      const n0 = u.st.calls.length;
      await pressSend(u);
      await seen(u, () => { const r = document.querySelector('.pvc-root'), f = r.querySelector('form[data-pvc-form="work"]'); return !f || f.querySelector('[name="block_hours"]').value === '' || !!r.querySelector('[data-pvc-saved]'); });
      const w1 = await wFace(u);
      ok(subs(u, n0).length === 0 && w1.form && w1.position === 'fo' && w1.duty_hours === '120' && w1.fleet === '' && w1.block_hours === '' && w1.stay_nights === '' && w1.note === ''
        && !w1.own && w1.tag === false && w1.errs.length === 0,
        '★月の勤務でも、その1回では何も送らない。打った欄（職位・勤務時間）だけが残り、前の人の機種・乗務時間・ステイ・メモ・チェックは消える', J({ sent: subs(u, n0), w1 }));
      await api(u, 'list');
      await waitView(u, 'counted');
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(u, 'work');
      await settle(u);
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s2 = await summary(u);
      const pl = sentW[sentW.length - 1] || {};
      const after = { prev: await mineOf(PREV.id), next: await mineOf(NEXT.id) };
      ok(sentW.length === 1 && pl.position === 'fo' && pl.duty_hours === 120 && pl.fleet === null && pl.base_iata === null && pl.block_hours === null && pl.stay_nights === null && pl.note === null,
        '★今の人がチェックを入れて押し直すと、出ていくのは打った欄だけ（前の人の機種・拠点・乗務時間・ステイ・メモが入らない）', J(pl));
      ok(J(after.next.work) === J([{ y: LAST.y, m: LAST.m, pos: 'fo', fleet: null, block: null, duty: 120, stay: null, note: null }]) && J(after.prev) === J(before.prev) && s2.head === '情報を追加しました',
        '★保存先：今の人の月は打った欄だけ。前の人の月は変わらない。見出しは「情報を追加しました」', J({ next: after.next.work, head: s2.head }));
    } finally {
      await u.st.ctx.close();
    }
  });

  /* B3：ほかのタブで替わる。最初のタブには触らない。 */
  await scene('読めている一覧のまま、読む人が替わる ── ほかのタブで別の会員がログインする（こちらには触らない）', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    try {
      const tab = await otherTab(u);
      await go(u, ANA);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      await pick(u, 'commuting_transport', 'always');     // 打った1つ
      await tick(u);
      const p0 = await qFace(u);
      if (p0.transport !== 'always' || p0.note !== NOTE_Q || !p0.own || p0.mine < 1) throw new Error('前提が崩れた（前の人の保存した補足が出ていて、1つだけ打ってある入力になっていない）: ' + J(p0));
      let n0 = u.st.calls.length;
      await loginIn(tab, 'b');
      const got = await seen(u, taxiCleared);
      const q1 = await qFace(u);
      ok(got && q1.transport === 'always' && q1.note === '' && q1.method.length === 0 && q1.mine === 0 && !q1.own && subs(u, n0).length === 0,
        '★ほかのタブで別の会員がログインしたら、こちらのタブには触らなくても、前の人の補足・答え・チェックが消える（打った1つは残る・何も送らない）', J({ got, q1 }));

      /* 保存後のカードが出ているまま、ほかのタブで替わる */
      await loginIn(tab, 'pay');
      await api(u, 'list');
      await waitView(u, 'counted');
      await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(u, 'taxi');
      await settle(u);
      await pick(u, 'commuting_taxi_cost', 'partial');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s2 = await summary(u);
      if (!/^情報を(更新|追加)しました$/.test(s2.head) || !s2.rows.commuting_taxi_cost) throw new Error('前提が崩れた（前の人の保存後のカードが出ていない）: ' + J({ head: s2.head, rows: Object.keys(s2.rows) }));
      n0 = u.st.calls.length;
      await loginIn(tab, 'b');
      const gone = await seen(u, () => { const r = document.querySelector('.pvc-root'); return !r.querySelector('[data-pvc-saved]') && !!r.querySelector('.pvc-tiles'); });
      if (gone) await waitView(u, 'counted');
      const l2 = gone ? await listFace(u) : null;
      const shown2 = await u.page.evaluate(() => document.querySelector('.pvc-root .pvc-main').innerText);
      ok(gone && l2.counts.length === 0 && l2.state === 'ok ok' && !shown2.includes('試験：') && subs(u, n0).length === 0,
        '★保存後のカードが出ているまま、ほかのタブで読む人が替わったら、カードは消えて一覧に戻る（前の人が保存した内容を「あなたの投稿」として出したままにしない）', J({ gone, l2 }));
    } finally {
      await u.st.ctx.close();
    }
  });

  await scene('ログインなしで預けた回答が出ているまま、控えの鍵が外から替わる（ほかのタブ）', async () => {
    await seedPrev();
    const v = await open('phone');
    try {
      const tab = await otherTab(v);
      await go(v, ANA);
      await api(v, 'taxi');
      await waitView(v, 'taxi');
      await settle(v);
      await pick(v, 'commuting_transport', 'no');
      await tick(v);
      await send(v);
      await waitView(v, 'saved');
      await v.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(v, 'taxi');
      await settle(v);
      const p0 = await qFace(v);
      const k0 = await v.page.evaluate(() => localStorage.getItem('pv_contrib_key'));
      if (p0.transport !== 'no' || p0.mine !== 1 || !/^[0-9a-f]{48}$/.test(k0 || '')) throw new Error('前提が崩れた（ログインなしで預けた答えが、入力に入って出ていない）: ' + J({ p0, key: !!k0 }));
      await tab.evaluate(() => localStorage.setItem('pv_contrib_key', 'f'.repeat(48)));
      const got = await seen(v, () => { const f = document.querySelector('.pvc-root form[data-pvc-form="taxi"]'); return !!f && f.querySelector('[name="commuting_transport"]').value === '' && f.querySelectorAll('.pvc-mine').length === 0; });
      const q1 = await qFace(v);
      ok(got && emptyQ(q1),
        '★ログインなしで預けた回答が出ているまま、控えの鍵が外から替わったら、その回答を入力に出したままにしない（預かりは、鍵を持つ人のもの）', J({ got, q1 }));
    } finally {
      await v.st.ctx.close();
    }
  });

  /* B4：同じページのまま替わったあと、質問の欄に入る。 */
  await scene('読めている一覧のまま、読む人が替わる ── 質問の欄に入った時（前の人の補足が入っていた欄）', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      /* 前の人が、何も変えずに送ってある（「保存済みの内容と同じです」の知らせと、確認のチェックが出たまま）。そのあとで1つ打つ */
      await tick(u);
      await send(u);
      await waitMsg(u, 'same');
      await pick(u, 'commuting_transport', 'always');     // 打った1つ
      const p0 = await qFace(u);
      if (p0.transport !== 'always' || p0.note !== NOTE_Q || p0.mine < 1 || !p0.own || J(p0.msg) !== J(['same'])) throw new Error('前提が崩れた（前の人の保存した補足・知らせ・チェックが出ていて、1つだけ打ってある入力になっていない）: ' + J(p0));
      await loginAs(u, 'b');
      const n0 = u.st.calls.length;
      await fill(u, 'commuting_transport_note', '今の人の補足');
      const q1 = await qFace(u);
      ok(q1.form && q1.transport === 'always' && q1.method.length === 0 && q1.mine === 0 && subs(u, n0).length === 0,
        '★読む人が替わったあと、質問の欄に入った時に入力を作り直す（前の人の答えと「あなたの投稿」の札が消え、打ってあった1つは残る）', J(q1));
      ok(!q1.own && q1.msg.length === 0,
        '★前の人の送信についての知らせ（保存済みの内容と同じです）と、前の人の確認のチェックも消える', J({ own: q1.own, msg: q1.msg }));
      ok(q1.note === '今の人の補足' && q1.at === 'commuting_transport_note',
        '★入ろうとした補足の欄は、前の人の補足だけが消えて、そのまま打てる（空になって畳まれた欄を開け直して渡す。前の人の字に続けて打たせない）', J({ note: q1.note, at: q1.at }));
    } finally {
      await u.st.ctx.close();
    }
  });

  /* B5：読む人が替わっていない時は、上のどの確かめも何も消さない。 */
  await scene('読む人が替わっていない会員 ── 保存 → 一覧 → 開き直す（何も消えない）', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    try {
      const tab = await otherTab(u);
      await go(u, ANA);
      await api(u, 'list');
      await waitView(u, 'counted');
      await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(u, 'taxi');
      await settle(u);
      await pick(u, 'commuting_taxi_cost', 'partial');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const s1 = await summary(u);
      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="more"]');
      await waitView(u, 'list');
      await waitView(u, 'counted');
      const l1 = await listFace(u);
      await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(u, 'taxi');
      await settle(u);
      const q1 = await qFace(u);
      ok(s1.head === '情報を更新しました' && J(Object.keys(s1.rows).sort()) === J(['commuting_taxi_cost', 'commuting_transport', 'commuting_transport_method', 'commuting_transport_note'])
        && J(l1.counts) === J(COUNTS0) && l1.state === 'ok ok' && fullQ(q1, 'partial'),
        '★読む人が替わっていなければ、保存後のカードに保存した内容が出て、一覧に「あなたの投稿 N件」が出て、開き直すと答えと補足が入っている', J({ head: s1.head, l1, q1 }));
      /* 上の確かめが通る所を、ひととおり踏む：ほかのタブの関係の無い書き込み・タブへ戻った合図・欄に入る・チェック・何も変えずに送る */
      await tab.evaluate(() => { localStorage.setItem('pv_test_other', '1'); localStorage.setItem('pv_last_active', String(Date.now())); });
      await u.page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
      await u.page.focus('.pvc-root [name="commuting_transport_note"]');
      await tick(u);
      await send(u);
      await waitMsg(u, 'same');
      const q2 = await qFace(u);
      await u.page.click('.pvc-root .pvc-prev');
      await waitView(u, 'list');
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(u, 'work');
      await settle(u);
      const w2 = await wFace(u);
      ok(fullQ(q2, 'partial') && q2.own && J(q2.msg) === J(['same']) && fullW(w2),
        '★同じ人のままなら、ほかのタブの書き込み・タブへ戻る・欄に入る・チェック・送る のどれでも、入力は消えない（何も変えずに送ると「保存済みの内容と同じです」）', J({ q2, w2 }));
    } finally {
      await u.st.ctx.close();
    }
  });

  await scene('読む人が替わっていない、ログインなしの人 ── はじめての保存で控えの鍵が付く → 見る → もう1度保存', async () => {
    await seedPrev();
    const v = await open('phone');
    try {
      await go(v, ANA);
      const k0 = await v.page.evaluate(() => localStorage.getItem('pv_contrib_key'));
      if (k0) throw new Error('前提が崩れた（控えの鍵をまだ持っていない端末になっていない）');
      await api(v, 'taxi');
      await waitView(v, 'taxi');
      await settle(v);
      await pick(v, 'commuting_transport', 'no');
      await tick(v);
      await send(v);
      await waitView(v, 'saved');
      const s1 = await summary(v);
      const k1 = await v.page.evaluate(() => localStorage.getItem('pv_contrib_key'));
      ok(s1.head === '情報を追加しました' && J(Object.keys(s1.rows)) === J(['commuting_transport']) && /^[0-9a-f]{48}$/.test(k1 || ''),
        '★ログインなしの人のはじめての保存（控えの鍵がここで付く）のあと、保存後のカードがそのまま出て、保存した答えが載っている（鍵が付いたことを「読む人が替わった」と取り違えない）', J({ head: s1.head, rows: Object.keys(s1.rows), key: !!k1 }));
      await v.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(v, 'taxi');
      await settle(v);
      const q1 = await qFace(v);
      await pick(v, 'commuting_transport', 'unknown');
      await tick(v);
      await send(v);
      await waitView(v, 'saved');
      const s2 = await summary(v);
      await v.page.click('.pvc-root .pvc-saved [data-pvc-act="more"]');
      await waitView(v, 'list');
      await waitView(v, 'counted');
      const l2 = await listFace(v);
      const held = (await heldAna()).map((x) => [x.kind, x.k, x.payload.code]);
      ok(q1.transport === 'no' && q1.mine === 1 && q1.btn === '匿名で更新する' && s2.head === '情報を更新しました'
        && J(l2.counts) === J(['taxi：あなたの投稿 1件']) && J(held) === J([['cond', 'commuting_transport', 'unknown']]),
        '★そのまま「自分の回答を見る」に答えが入っていて、同じ面からもう1度保存できる（一覧は「あなたの投稿 1件」・預かりは1件で、直した答えになっている）', J({ q1, head: s2.head, l2, held }));
    } finally {
      await v.st.ctx.close();
    }
  });

  /* 会員なのに、引き継げなかった控えの鍵が端末に残っていることがある（引き継ぎの口が落ちていた回・残りが在る回）。
     会員は会員の id で同じ人 ＝ 鍵が在っても「読む人が替わった」と取り違えない。取り違えると、確かめるたびに
     自分の一覧を手放して読み直し、保存した答えがいつまでも入力に出ない。
     鍵を残すために、この場面だけ、引き継ぎの口を落とす（自分の一覧を読む口は落とさない）。 */
  await scene('読む人が替わっていない会員 ── 引き継げなかった控えの鍵が端末に残っている（何も消えない）', async () => {
    await seedPrev();
    await failNext('claim_contrib', null, 99);
    const u = await open('phone', { who: 'pay' });
    try {
      const tab = await otherTab(u);
      await go(u, ANA);
      await u.page.evaluate(() => localStorage.setItem('pv_contrib_key', 'e'.repeat(48)));
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      const q0 = await qFace(u);
      const key = await u.page.evaluate(() => localStorage.getItem('pv_contrib_key'));
      if (key !== 'e'.repeat(48) || hits(u, 'claim_contrib') < 1) throw new Error('前提が崩れた（引き継ぎを試みて、控えの鍵が残った会員になっていない）: ' + J({ key: !!key, claims: hits(u, 'claim_contrib') }));
      ok(fullQ(q0, 'company_full'),
        '★控えの鍵が端末に残っている会員でも、自分が保存した答えと補足が入力に入って出る（鍵が在ることを「読む人が替わった」と取り違えない）', J(q0));
      /* 確かめが通る所を、ひととおり踏む：チェック・ほかのタブの書き込み・タブへ戻った合図・欄に入る・何も変えずに送る */
      await tick(u);
      await tab.evaluate(() => { localStorage.setItem('pv_last_active', String(Date.now())); });
      await u.page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
      await u.page.focus('.pvc-root [name="commuting_transport_note"]');
      await send(u);
      await waitMsg(u, 'same');
      const q1 = await qFace(u);
      ok(fullQ(q1, 'company_full') && q1.own && J(q1.msg) === J(['same']),
        '★そのまま チェック・ほかのタブの書き込み・タブへ戻る・欄に入る・送る を踏んでも、入力もチェックも消えない（何も変えずに送ると「保存済みの内容と同じです」）', J(q1));
    } finally {
      await failOff();
      await u.st.ctx.close();
    }
  });

  /* 読んでいる・送っている最中に、読む人が替わる（返事は、前の人のものが遅れて届く）。 */
  await scene('自分の投稿を読み直している最中に、ログインが切れる ── 遅れて届いた前の人の一覧を出さない', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'list');
      await waitView(u, 'counted');
      const l0 = await listFace(u);
      await u.page.evaluate(() => window.PVContrib.close());
      await waitClosed(u);
      u.st.hold = { name: 'my_airline_conditions', reqs: [] };
      await api(u, 'list');
      await waitView(u, 'list');
      const held = await until(() => u.st.hold.reqs.length === 1);
      if (J(l0.counts) !== J(COUNTS0) || !held) throw new Error('前提が崩れた（前の人の件数が出ていて、読み直しの返事を止めた形になっていない）: ' + J({ l0, held }));
      await u.page.evaluate(() => { window.PVSession.wipe(); });
      release(u);
      const got = await seen(u, () => { const r = document.querySelector('.pvc-root'), st = r.querySelector('[data-pvc-state]'); return !!st && st.getAttribute('data-pvc-state') === 'anon anon'; });
      const l1 = await listFace(u);
      ok(got && l1.counts.length === 0 && l1.text === '',
        '★読み直しの返事が届く前にログインが切れたら、届いた一覧（前の人のもの）を件数に出さない', J({ got, l1 }));
    } finally {
      release(u);
      await u.st.ctx.close();
    }
  });

  for (const topic of ['taxi', 'work']) {
    const fn = topic === 'taxi' ? 'submit_airline_conditions' : 'submit_work_month';
    await scene(`送っている最中に、ほかのタブで読む人が替わる（${topic === 'taxi' ? '質問の項目' : '月の勤務'}）── 遅れて届いた返事で、前の人の内容をカードに出さない`, async () => {
      await seedPrev();
      const u = await open('phone', { who: 'pay' });
      try {
        const tab = await otherTab(u);
        await go(u, ANA);
        await api(u, topic);
        await waitView(u, topic);
        await settle(u);
        if (topic === 'taxi') await pick(u, 'commuting_taxi_cost', 'partial'); else await fill(u, 'duty_hours', '120');
        await tick(u);
        u.st.hold = { name: fn, reqs: [] };
        await send(u);
        const held = await until(() => u.st.hold.reqs.length === 1);
        await loginIn(tab, 'b');
        /* こちらのタブが気づいて、今の人の分を読み終わるまで待つ（送っている最中の印が出たまま、前の人の値が消える） */
        const turned = await seen(u, (t) => {
          const f = document.querySelector('.pvc-root form[data-pvc-form="' + t + '"]');
          return !!f && (t === 'taxi' ? f.querySelectorAll('.pvc-mine').length === 0 : f.querySelector('[name="block_hours"]').value === '');
        }, topic);
        if (!held || !turned) throw new Error('前提が崩れた（送る通信を止めたまま、ほかのタブの切り替えに気づいた形になっていない）: ' + J({ held, turned }));
        release(u);
        const back = await seen(u, () => { const r = document.querySelector('.pvc-root'); return !!r.querySelector('.pvc-tiles') || !!r.querySelector('[data-pvc-saved]'); });
        const card = await u.page.evaluate(() => !!document.querySelector('.pvc-root [data-pvc-saved]'));
        if (!card) await waitView(u, 'counted');
        const l1 = card ? null : await listFace(u);
        const cues = await cueLog(u);
        const after = { prev: await mineOf(PREV.id), next: await mineOf(NEXT.id) };
        ok(back && !card && !!l1 && l1.counts.length === 0 && cues.length === 0,
          '★送っている最中に読む人が替わったら、遅れて届いた返事で、前の人が保存した内容を今の人のカードに出さない（一覧へ戻る。保存できた合図も出さない）', J({ back, card, l1, cues }));
        const kept = topic === 'taxi' ? (after.prev.cond.find((x) => x.q === 'commuting_taxi_cost') || {}).c === 'partial' : (after.prev.work[0] || {}).duty === 120;
        ok(kept && after.next.work.length === 0 && after.next.cond.length === 0,
          '保存そのものは、送った人（前の人）の行に入っている。今の人の行は1つも増えない', J(after));
      } finally {
        release(u);
        await u.st.ctx.close();
      }
    });
  }

  await scene('面を閉じているあいだに読む人が替わり、開き直す', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'work');
      await waitView(u, 'work');
      await settle(u);
      await tick(u);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      await tick(u);
      const w0 = await u.page.evaluate(() => document.querySelector('.pvc-root [name="own"]').checked);
      await u.page.evaluate(() => window.PVContrib.close());
      await waitClosed(u);
      /* 面は閉じたまま（まだ開き直さない）。読む人を入れ替えて、タブが見える側へ戻った合図だけを流す ＝ 面が、読む人が替わったと気づく所 */
      const s0 = await shutSheet(u);
      await loginAs(u, 'b');
      await u.page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
      const bare = await seen(u, sheetBare), s1 = await shutSheet(u);
      ok(!!s0 && !s0.open && !s0.up && s0.mine === 3 && s0.vals.includes(NOTE_Q) && bare && shutBare(s1),
        '★面を閉じているあいだに読む人が替わると、開き直さなくても、閉じた面の中から、前の人の答え・補足・「あなたの投稿」の印が消える（字が1つも無い・入力欄も無い。替わる前には、面の中に在った）',
        J({ before: s0 && [s0.open, s0.up, s0.mine, s0.ctl, s0.vals.slice(0, 3)], bare, after: s1 && [s1.open, s1.up, s1.kids, s1.ctl, s1.mine, s1.text.slice(0, 80)] }));
      await api(u, 'work');
      await waitView(u, 'work');
      await settle(u);
      const w1 = await wFace(u);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      const q1 = await qFace(u);
      ok(w0 && emptyW(w1) && !w1.own && emptyQ(q1) && !q1.own,
        '★面を閉じているあいだに読む人が替わって開き直した時も、前の人の値・確認のチェックが入っていない（月の勤務・質問の項目）', J({ w1, q1 }));
      /* 続けて、その場でログアウトする（ページ自身のログインの部品で）。開いているタブは、この1枚だけ ＝ ほかのタブからの合図は来ない。
         面には、今の人が打って、まだ送っていない答えが1つ入っている。面は閉じてある（開き直すのは、消えたのを見たあと）。 */
      await pick(u, 'commuting_transport', 'always');
      await u.page.evaluate(() => window.PVContrib.close());
      await waitClosed(u);
      const t0 = await shutSheet(u), tabs = (await u.st.ctx.pages()).length;
      const outErr = await u.page.evaluate(() => window.PVCareer.client().then((sb) => sb.auth.signOut()).then((r) => (r && r.error ? String(r.error.message || r.error) : '')));
      const bare2 = await seen(u, sheetBare), t1 = await shutSheet(u);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      const q2 = await qFace(u);
      ok(tabs === 1 && outErr === '' && !!t0 && !t0.open && !t0.up && t0.ctl > 0 && t0.vals.includes('always') && bare2 && shutBare(t1)
        && q2.form && q2.transport === 'always' && q2.mine === 0 && !q2.own,
        '★開いているタブがこの1枚だけの時に、その場でログアウトすると、開き直さなくても、閉じた面の中の字が消える（字が1つも無い・入力欄も無い）。打って、まだ送っていない答えは、開き直すと残っている',
        J({ tabs, outErr, before: t0 && [t0.open, t0.up, t0.ctl, t0.vals.slice(0, 3)], bare2, after: t1 && [t1.open, t1.up, t1.kids, t1.ctl, t1.text.slice(0, 80)], q2 }));
    } finally {
      await u.st.ctx.close();
    }
  });

  await scene('ログインが切れていたタブへ戻ってくる ── 触らなくても、前の人の答えが消える', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      const p0 = await qFace(u);
      if (!fullQ(p0, 'company_full')) throw new Error('前提が崩れた（前の人の保存した答えが入った入力になっていない）: ' + J(p0));
      /* 7日より長く触っていなかったことにして、「タブが見える状態に戻った」合図を流す（pv-session.js がここで切れたログインを片づける） */
      const vis = await u.page.evaluate(() => {
        localStorage.setItem('pv_last_active', String(Date.now() - 8 * 24 * 60 * 60 * 1000));
        document.dispatchEvent(new Event('visibilitychange'));
        return [document.visibilityState, window.PVSession.hasToken()];
      });
      const got = await seen(u, taxiCleared);
      const q1 = await qFace(u);
      ok(J(vis) === J(['visible', false]) && got && emptyQ(q1) && !q1.own,
        '★ログインが切れていたタブへ戻ってきた時は、どこにも触らなくても、前の人の答え・補足が消える', J({ vis, got, q1 }));
    } finally {
      await u.st.ctx.close();
    }
  });

  /* その場で作り直した入力は、今の人の分を読み直しているあいだも止めない（今の人は、もう欄に入っている）。
     読み直しが届いて入力が作り直されても、居た欄に居たまま。読み直しの返事を止めて、そのあいだを見る。 */
  await scene('読む人が替わったあと欄に入り、まだ何も打たないうちに今の人の一覧が届く ── 入力は止まらず、居た欄に居たまま', async () => {
    await seedPrev();
    /* 今の人にも、この項目の答えを1つ置いておく（届いたら入力に入る ＝ 作り直しが起きる） */
    const c = await rpcAs('b', 'submit_airline_conditions', { airline: 'ana', lang: 'ja', answers: [{ question_id: 'commuting_transport', code: 'no' }] });
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      const p0 = await qFace(u);
      await loginAs(u, 'b');
      u.st.hold = { name: 'my_airline_conditions', reqs: [] };
      await u.page.focus('.pvc-root [name="commuting_transport"]');     // 欄に入る（まだ打たない）
      const held = await until(() => u.st.hold.reqs.length === 1);
      if (!c || !c.ok || !fullQ(p0, 'company_full') || !held) throw new Error('前提が崩れた（前の人の答えが入った入力のまま、今の人の読み直しを止めた形になっていない）: ' + J({ c, p0, held }));
      const q1 = await qFace(u);
      await u.page.evaluate(() => document.querySelector('.pvc-root form[data-pvc-form="taxi"]').setAttribute('data-test-old', '1'));
      release(u);
      const redrawn = await seen(u, () => { const f = document.querySelector('.pvc-root form[data-pvc-form="taxi"]'); return !!f && !f.hasAttribute('data-test-old'); });
      const q2 = await qFace(u);
      ok(emptyQ(q1) && q1.off === false && q1.at === 'commuting_transport',
        '★欄に入った時に作り直した入力は、今の人の分を読み直しているあいだも止まらない（前の人の答えは無く、入力でき、入った欄に居る）', J(q1));
      ok(redrawn && q2.transport === 'no' && q2.mine === 1 && q2.btn === '匿名で更新する' && q2.at === 'commuting_transport',
        '★今の人の一覧が届いて入力が作り直されても、居た欄に居たまま（今の人が前に保存した答えが入る）', J({ redrawn, q2 }));
    } finally {
      release(u);
      await u.st.ctx.close();
    }
  });

  /* 今の人の一覧が空のまま（まだ何も出していない・読めなかった）届いた時は、その場で作り直した入力を、もう一度は作り直さない。
     作り直すと、欄に入って打ち始めた人の足元で、入力がもう1回入れ替わる。知らせの字だけを直す。
     届いたことを画面で知るために、この場面だけ、今の人の勤務の一覧を読む口を落とす（入力の下に断りの字が出る）。 */
  await scene('読む人が替わったあと欄に入り、今の人の一覧が空のまま届く ── 入力をもう一度は作り直さない', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'work');
      await waitView(u, 'work');
      await settle(u);
      const w0 = await wFace(u);
      await loginAs(u, 'b');
      await failNext('my_work_months', null, 99);
      u.st.hold = { name: 'my_airline_conditions', reqs: [] };
      await u.page.focus('.pvc-root [name="block_hours"]');     // 欄に入る（まだ打たない）
      const held = await until(() => u.st.hold.reqs.length === 1);
      if (!fullW(w0) || !held) throw new Error('前提が崩れた（前の人の月が入った入力のまま、今の人の読み直しを止めた形になっていない）: ' + J({ w0, held }));
      await u.page.evaluate(() => document.querySelector('.pvc-root form[data-pvc-form="work"]').setAttribute('data-test-old', '1'));
      release(u);
      const arrived = await seen(u, () => { const n = document.querySelector('.pvc-root [data-pvc-wait]'); return !!n && !n.hidden && /読み込めませんでした/.test(n.textContent); });
      const kept = await u.page.evaluate(() => { const f = document.querySelector('.pvc-root form[data-pvc-form="work"]'), a = document.activeElement; return [f.hasAttribute('data-test-old'), a ? a.getAttribute('name') : '']; });
      const w1 = await wFace(u);
      ok(arrived && J(kept) === J([true, 'block_hours']) && emptyW(w1),
        '★今の人の一覧が空のまま届いた時は、その場で作り直した入力を、もう一度は作り直さない（同じ入力のまま・入った欄に居たまま。断りの字だけが出る）', J({ arrived, kept, w1 }));
    } finally {
      release(u);
      await failOff();
      await u.st.ctx.close();
    }
  });

  await scene('ログイン前の回答を引き継いだ知らせが出ているまま、ほかのタブで読む人が替わる', async () => {
    await seedPrev();
    const v = await open('phone');
    try {
      const tab = await otherTab(v);
      await go(v, ANA);
      await api(v, 'taxi');
      await waitView(v, 'taxi');
      await settle(v);
      await pick(v, 'commuting_transport', 'no');
      await tick(v);
      await send(v);
      await waitView(v, 'saved');
      /* 保存のあとの読み直しが届き終わるまで待つ（一覧の印が「読めた・読めた」になる）。届く前にログインを入れると、
         遅れて届いた返事で「読む人が替わった」と気づいたこのページが、開き直す前に引き継ぎを始める（それは正しい動き）。 */
      await v.page.click('.pvc-root .pvc-saved [data-pvc-act="more"]');
      await waitView(v, 'list');
      await v.page.waitForFunction(() => { const st = document.querySelector('.pvc-root [data-pvc-state]'); return !!st && st.getAttribute('data-pvc-state') === 'ok ok'; });
      /* 同じ端末で会員Bがログインして、同じページを開き直す（預けた1件が引き継がれ、知らせが出る） */
      const s = await (await fetch(`${base}/__local/login?member=b`)).json();
      await v.page.evaluate((x) => {
        const now = String(Date.now());
        localStorage.setItem('sb-local-auth-token', JSON.stringify(x.session));
        localStorage.setItem('pv_user', JSON.stringify(x.pv_user));
        localStorage.setItem('pv_last_active', now);
        localStorage.setItem('pv_session_start', now);
        const at = Date.parse((x.session.user || {}).last_sign_in_at || '');
        localStorage.setItem('pv_give_seen', JSON.stringify({ t: Date.now(), s: String(isNaN(at) ? now : at) }));
      }, s);
      /* ページを離れる時にも「見え方が変わった」合図は流れる（隠れる側）。そこでは読み直さない ── 去っていくページが
         引き継ぎを始めると、次に開いたページは「引き継ぎました」を言えない。隠れる側の合図を作って、一覧がそのままなのを見る
         （読み直しを始めると、その場で一覧の印が「確認しています」に変わる） */
      const stays = await v.page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.visibilityState;
        return [document.visibilityState, document.querySelector('.pvc-root [data-pvc-state]').getAttribute('data-pvc-state')];
      });
      ok(J(stays) === J(['visible', 'ok ok']) && hits(v, 'claim_contrib') === 0,
        '★ページが隠れる側の合図（ページを離れる時にも流れる）では、読み直さない・引き継ぎを始めない', J({ stays, claims: hits(v, 'claim_contrib') }));
      await go(v, ANA + '?add=list');
      await waitView(v, 'counted');
      await waitMsg(v, 'claim');
      const c0 = await msg(v, 'claim');
      const l0 = await listFace(v);
      if (!/引き継ぎました/.test(c0 || '') || J(l0.counts) !== J(['taxi：あなたの投稿 1件'])) throw new Error('前提が崩れた（引き継ぎの知らせが出ている形になっていない）: ' + J({ c0, l0 }));
      await loginIn(tab, 'pay');
      const got = await seen(v, () => {
        const r = document.querySelector('.pvc-root'), st = r.querySelector('[data-pvc-state]');
        return !r.querySelector('.pvc-msg[data-pvc-msg="claim"]') && !!st && st.getAttribute('data-pvc-state') === 'ok ok' && [...r.querySelectorAll('[data-pvc-count]')].filter((n) => !n.hidden).length === 2;
      });
      const l1 = await listFace(v);
      ok(got && J(l1.counts) === J(COUNTS0) && (await msg(v, 'claim')) === null,
        '★引き継ぎの知らせは、引き継いだ人のもの。ほかのタブで読む人が替わったら、知らせは消え、件数は今の人のものになる', J({ got, l1 }));
    } finally {
      await v.st.ctx.close();
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 12-c. 開いている面と「いま読んでいる人」── 12-b の残り（全日本空輸・390×680）
  // ═════════════════════════════════════════════════════════════
  /* 引き継ぎの知らせ「ログイン前の回答を引き継ぎました／N件を、あなたの投稿として引き継ぎました。」は、引き継ぎを始めた人のもの。
     12-b の確かめは「一覧を読み始めた時の印」で動く。その印がまだ無い時に書かれた知らせは、すり抜けて次の人に出ていた：
       ・引き継ぎの返事を待っているあいだに、読む人がもう一度替わる（返事が届いた時に読んでいるのは、別の会員）
       ・面を閉じたまま、ページを開いて少しあとの引き継ぎが済み、そのあとで別の人が面を開く
     どちらも、知らせを描く所で「引き継ぎを始めた人 ＝ いま読む人」を確かめて止める（確かめるのは、その1か所だけ）。
     ここの会員は、この会社のページに1件も持っていない2人（会員A・運営）。前の人の投稿を置く seedPrev は使わない
     （給与提出者には、同じ質問の答えを置いてしまう）。 */
  const M1 = memberOf('a'), M2 = memberOf('op');
  const claimSaid = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root');
    return { box: !!r.querySelector('.pvc-msg[data-pvc-msg="claim"]'), said: /引き継ぎました/.test(r.querySelector('.pvc-sheet').innerText),
      key: localStorage.getItem('pv_contrib_key') };
  });

  await scene('ログイン前の回答の引き継ぎが届く前に、読む人がもう一度替わる ── 引き継いでいない人に「引き継ぎました」と言わない', async () => {
    await noRows(M1, M2);
    const v = await open('phone');
    try {
      const tab = await otherTab(v);
      await go(v, ANA);
      await api(v, 'taxi');
      await waitView(v, 'taxi');
      await settle(v);
      await pick(v, 'commuting_transport', 'no');
      await tick(v);
      await send(v);
      await waitView(v, 'saved');
      /* 保存のあとの読み直しが届き終わるまで待つ（月の勤務の印は、はじめての保存の前は「ログインなし」。届くと「読めた」になる） */
      await v.page.click('.pvc-root .pvc-saved [data-pvc-act="more"]');
      await waitView(v, 'list');
      await v.page.waitForFunction(() => { const st = document.querySelector('.pvc-root [data-pvc-state]'); return !!st && st.getAttribute('data-pvc-state') === 'ok ok'; });
      /* ほかのタブで1人目がログインする ＝ このタブが気づいて、預けた1件の引き継ぎを始める。その返事を止めておく。 */
      v.st.hold = { name: 'claim_contrib', reqs: [] };
      await loginIn(tab, 'a');
      const held = await until(() => v.st.hold.reqs.length === 1);
      /* 返事が届く前に、同じタブで2人目がログインする。このタブから2人目のログインが読めるようになってから、返事を流す。 */
      await loginIn(tab, 'op');
      const second = await readsAs(v, M2);
      const before = (await listFace(v)).state;
      if (!held || !second || before === 'ok ok') throw new Error('前提が崩れた（引き継ぎの返事を止めたまま、読む人がもう一度替わった形になっていない）: ' + J({ held, second, before }));
      release(v);
      const arrived = await seen(v, () => { const st = document.querySelector('.pvc-root [data-pvc-state]'); return !!st && st.getAttribute('data-pvc-state') === 'ok ok'; });
      const c1 = await claimSaid(v), l1 = await listFace(v);
      const m1 = await mineOf(M1.id), m2 = await mineOf(M2.id), h1 = await heldAna();
      if (hits(v, 'claim_contrib') !== 1) throw new Error('前提が崩れた（このページから出ていった引き継ぎは、ちょうど1本のはず）: ' + J(hits(v, 'claim_contrib')));
      ok(arrived && !c1.box && !c1.said && l1.state === 'ok ok' && l1.counts.length === 0,
        '★引き継ぎの返事が届く前に読む人がもう一度替わったら、今の人に「引き継ぎました」と言わない（知らせを出さない・件数も出さない）', J({ arrived, c1, l1 }));
      ok(m1.cond.length === 1 && m1.cond[0].q === 'commuting_transport' && m1.cond[0].c === 'no' && m1.work.length === 0
        && m2.cond.length === 0 && m2.work.length === 0 && h1.length === 0 && c1.key === null,
        '引き継いだ1件は、引き継ぎを始めた会員のもの。今の人の行は1件も無い。預かりにも端末にも何も残らない', J({ m1, m2, held: h1.length, key: c1.key }));
    } finally {
      release(v);
      await v.st.ctx.close();
      await noRows(M1, M2);
    }
  });

  await scene('面を閉じたまま引き継いだ知らせを、あとから来た別の人に出さない', async () => {
    await noRows(M1, M2);
    const v = await open('phone');
    try {
      await go(v, ANA);
      await api(v, 'taxi');
      await waitView(v, 'taxi');
      await settle(v);
      await pick(v, 'commuting_transport', 'no');
      await tick(v);
      await send(v);
      await waitView(v, 'saved');
      /* 1人目がログインして、同じ会社ページを開き直す。面は開かない ＝ 引き継ぐのは、ページを開いて少しあとの引き継ぎ（面は閉じたまま）。
         待つのは時間ではなく、引き継ぎが出ていったことと、済んだ合図（知らせは、その合図の直前に書かれる）。 */
      await loginAway(v, 'a');
      if (hits(v, 'claim_contrib') !== 0) throw new Error('前提が崩れた（開き直す前に、引き継ぎが始まっている）');
      await go(v, ANA);
      const left = await until(() => hits(v, 'claim_contrib') >= 1);
      const done = await seen(v, () => (window.__pvcSaved || []).some((x) => x && x.topic === 'claim'));
      const m0 = await mineOf(M1.id), h0 = await heldAna();
      const shut = await v.page.evaluate(() => !document.querySelector('.pvc-root'));
      if (!left || !done || m0.cond.length !== 1 || m0.cond[0].c !== 'no' || h0.length !== 0 || !shut) {
        throw new Error('前提が崩れた（面を1度も開かないまま、1人目が預けた1件を引き継いだ形になっていない）: ' + J({ left, done, m0, held: h0.length, shut }));
      }
      /* ほかのタブで2人目がログインする（面が閉じているあいだ、このタブは何もしない）。そのあと、このタブで面を開く。 */
      const tab = await otherTab(v);
      await loginIn(tab, 'op');
      if (!(await readsAs(v, M2))) throw new Error('前提が崩れた（ほかのタブで入れた2人目のログインが、このタブから読めない）');
      await api(v, 'list');
      await waitView(v, 'counted');
      const c1 = await claimSaid(v), l1 = await listFace(v);
      const m1 = await mineOf(M1.id), m2 = await mineOf(M2.id);
      ok(!c1.box && !c1.said && l1.state === 'ok ok' && l1.counts.length === 0
        && m1.cond.length === 1 && m1.cond[0].c === 'no' && m2.cond.length === 0 && m2.work.length === 0,
        '★面を閉じたまま引き継いだあとで、ほかのタブで別の会員が入り、その人が面を開いても、「引き継ぎました」と言わない（知らせを出さない・件数も出さない。引き継いだ1件は、引き継いだ会員のもののまま）', J({ c1, l1, m1, m2 }));
    } finally {
      await v.st.ctx.close();
      await noRows(M1, M2);
    }
  });

  /* ── ログインは保存されているのに、会員の id が読めない ──
     12-b の確かめは「会員の id」で人を見分ける。id が読めないあいだは、どの会員も同じ印になり、別の会員に替わっても
     気づけなかった ＝ 前の人の答え・補足・「あなたの投稿 N件」が、次の人に出ていた。
     決まり：このあいだは、保存したものを誰のものとしても扱わない ── 読まない・数えない・入力に入れない・
             保存後のカードを出さない・預かりを引き継がない。面は「読み込めませんでした」の形。打った内容は残り、送れる。
     その形は idless（上）で作る。割れた控えの場面だけは、本物の読み口のまま（保存領域を割る）。
     どの場面も、頭と終わりで「ログインは保存されていて、id は読めない」ことを確かめる（崩れていたら、場面ごと赤くする）。 */
  await scene('会員の id が読めないログイン ── 前の人の投稿を、読まない・数えない・入力に入れない（別の会員に替わっても）', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    await idless(u, true);
    try {
      await go(u, ANA);
      await mustBeIdless(u, '場面の頭');
      await api(u, 'list');
      await waitView(u, 'counted');
      const l1 = await listFace(u), r1 = reads(u, 0);
      ok(l1.counts.length === 0 && l1.state === 'fail fail' && l1.text === NOREAD_L && r1.length === 0,
        '★会員の id が読めないあいだ、一覧に「あなたの投稿 N件」は出ない（「件数を取得できませんでした」）。自分の投稿を読む通信も、引き継ぎの通信も、1本も出ていかない', J({ l1, r1 }));

      await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(u, 'taxi');
      await settle(u);
      const q1 = await qFace(u), fq1 = await formFace(u), t1 = await sheetText(u, true);
      await u.page.click('.pvc-root .pvc-prev');
      await waitView(u, 'list');
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(u, 'work');
      await settle(u);
      const w1 = await wFace(u), fw1 = await formFace(u), t1w = await sheetText(u, true);
      ok(emptyQ(q1) && fq1.wait === NOREAD_Q && emptyW(w1) && fw1.wait === NOREAD_W && !/試験：/.test(t1 + t1w),
        '★質問の項目も月の勤務も、空の入力で出る（保存してある答え・補足・月の値は入らない）。送るボタンの下は「これまでの投稿を読み込めませんでした。このまま送れます…」', J({ q1, wait: fq1.wait, w1, waitW: fw1.wait }));

      /* 同じページのまま、別の会員のログインに替わる（その人の id も読めない）。欄に入り、一覧へ戻り、同じ項目を開く。 */
      await loginAs(u, 'b');
      await mustBeIdless(u, '別の会員に替わったあと');
      const n3 = u.st.calls.length;
      await u.page.focus('.pvc-root [name="block_hours"]');
      await u.page.click('.pvc-root .pvc-prev');
      await waitView(u, 'list');
      await waitView(u, 'counted');
      const l3 = await listFace(u);
      await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(u, 'taxi');
      await settle(u);
      const q3 = await qFace(u), t3 = await sheetText(u, true);
      await u.page.click('.pvc-root .pvc-prev');
      await waitView(u, 'list');
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(u, 'work');
      await settle(u);
      const w3 = await wFace(u), t3w = await sheetText(u, true);
      await mustBeIdless(u, 'id が読めるようになる前');
      ok(l3.counts.length === 0 && l3.state === 'fail fail' && emptyQ(q3) && emptyW(w3) && !/試験：/.test(t3 + t3w) && u.st.calls.slice(n3).length === 0,
        '★id が読めないまま別の会員に替わっても、前の人の件数・答え・補足・月の値は、どこにも出ない（読みにも行かない）', J({ l3, q3, w3, calls: u.st.calls.slice(n3) }));

      /* 前の人がログインし直し、id も読めるようになる → 一覧へ戻ると、その人の件数が戻る（この形から出たことに気づく） */
      await loginAs(u, 'pay');
      await noId(u, false);
      const s4 = await whoState(u);
      if (J(s4) !== J([true, true])) throw new Error('前提が崩れた（id が読めるログインに戻っていない）: ' + J(s4));
      await u.page.click('.pvc-root .pvc-prev');
      await waitView(u, 'list');
      const back = await seen(u, () => { const st = document.querySelector('.pvc-root [data-pvc-state]'); return !!st && st.getAttribute('data-pvc-state') === 'ok ok'; });
      const l4 = await listFace(u);
      ok(back && J(l4.counts) === J(COUNTS0),
        'id が読めるログインに戻ると、一覧にその人の件数が戻る（読めない形から出たことに気づいて、読み直す）', J({ back, l4 }));
    } finally {
      await u.st.ctx.close();
    }
  });

  await scene('会員の id が読めないログイン ── 送ると打った答えだけが保存され、保存後のカードは出ない', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'b' });
    await idless(u, true);
    const sentW = tap(u, 'submit_work_month'), sentQ = tap(u, 'submit_airline_conditions');
    try {
      await go(u, ANA);
      await mustBeIdless(u, '場面の頭');
      const prev0 = await mineOf(PREV.id);
      await api(u, 'list');
      await waitView(u, 'counted');
      /* 先に月の勤務（職位と数字1つ）。あとの質問の送信に、この月の職位・機種が付いていかないことまで見る。 */
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(u, 'work');
      await settle(u);
      await pick(u, 'position', 'fo');
      await fill(u, 'block_hours', '70');
      await tick(u);
      await send(u);
      const backW = await afterSend(u);
      const w1 = await wFace(u), nW = await savedSaid(u), tW = await sheetText(u);
      await u.page.click('.pvc-root .pvc-prev');
      await waitView(u, 'list');
      await u.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(u, 'taxi');
      await settle(u);
      await pick(u, 'commuting_transport', 'no');
      await tick(u);
      await send(u);
      const backQ = await afterSend(u);
      const q1 = await qFace(u), nQ = await savedSaid(u), tQ = await sheetText(u);
      const cues = await cueLog(u);
      const mine = await mineOf(NEXT.id), prev1 = await mineOf(PREV.id);
      const pw = sentW[0] || {}, pq = sentQ[0] || {};
      ok(sentW.length === 1 && pw.position === 'fo' && pw.block_hours === 70 && pw.fleet === null && pw.stay_nights === null && pw.note === null
        && sentQ.length === 1 && J(pq.answers) === J([{ question_id: 'commuting_transport', code: 'no' }]) && !('position' in pq) && !('fleet' in pq)
        && mine.work.length === 1 && mine.work[0].y === LAST.y && mine.work[0].m === LAST.m && mine.work[0].pos === 'fo' && mine.work[0].block === 70 && mine.work[0].fleet === null && mine.work[0].note === null
        && mine.cond.length === 1 && mine.cond[0].q === 'commuting_transport' && mine.cond[0].c === 'no' && mine.cond[0].pos === null && mine.cond[0].fleet === null
        && J(prev1) === J(prev0),
        '★会員の id が読めないあいだに送ると、打った内容だけが出ていき、その会員の行として保存される（質問の送信に、月の勤務の職位・機種を付けない。前の人の行は1つも変わらない）', J({ pw, pq, mine, same: J(prev1) === J(prev0) }));
      ok(backW && emptyW(w1) && !w1.own && nW.length === 1 && nW[0].title === '保存しました' && nW[0].text === '保存しました' && !/あなたの投稿/.test(tW)
        && backQ && emptyQ(q1) && !q1.own && nQ.length === 1 && nQ[0].title === '保存しました' && nQ[0].text === '保存しました' && !/あなたの投稿/.test(tQ)
        && cues.length === 0,
        '★送ったあと、保存後のカードは出ない。同じ項目の入力が空で出て、「保存しました」とだけ知らせる（「あなたの投稿」の札なし・ボタンは「匿名で追加する」・確認のチェックは外れている・保存できた合図も出さない）', J({ w1, nW, q1, nQ, cues }));
      ok(nW.length === 1 && nW[0].in,
        '★月の勤務（長い入力）で送ったあとの「保存しました」は、面の見えている範囲に入っている（390×680）', J(nW));
      await u.page.click('.pvc-root .pvc-prev');
      await waitView(u, 'list');
      await waitView(u, 'counted');
      const l2 = await listFace(u), box = await u.page.evaluate(() => !!document.querySelector('.pvc-root [data-pvc-held]'));
      await mustBeIdless(u, '場面の終わり');
      ok(l2.counts.length === 0 && l2.state === 'fail fail' && l2.text === NOREAD_L && !box && reads(u, 0).length === 0,
        '★一覧へ戻っても、いま保存した分を「あなたの投稿 N件」に数えない（読めていないものは数にしない。「ログインなしで保存した回答があります。」の箱も出ない）', J({ l2, box, reads: reads(u, 0) }));
    } finally {
      await u.st.ctx.close();
      await noRows(NEXT);
    }
  });

  await scene('ログインの控えが割れている（id を読めない）── 本物の読み口のまま、自分の投稿を読みに行かない', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    const split = () => u.page.evaluate(() => [window.PVSession.hasToken(), window.PVSession.readStoredSession()]);
    try {
      await go(u, ANA);
      /* 保存されているログインを、割れた形（….0）だけにする。ログインの部品は「まだ在る」と数え、読み口は見つけられない。 */
      await u.page.evaluate(() => {
        const v = localStorage.getItem('sb-local-auth-token');
        localStorage.setItem('sb-local-auth-token.0', v);
        localStorage.removeItem('sb-local-auth-token');
      });
      const s0 = await split();
      if (J(s0) !== J([true, null])) throw new Error('前提が崩れた（場面の頭：ログインは「在る」と数えられ、読み口からは読めない形になっていない）: ' + J(s0));
      const n0 = u.st.calls.length;
      await api(u, 'list');
      await waitView(u, 'counted');
      const l1 = await listFace(u);
      await roundTrip(u);
      const r1 = reads(u, n0), s1 = await split();
      if (J(s1) !== J([true, null])) throw new Error('前提が崩れた（場面の終わり：割れた控えの形が保たれていない）: ' + J(s1));
      ok(l1.state === 'fail fail' && l1.counts.length === 0 && l1.text === NOREAD_L && r1.length === 0,
        '★ログインの控えが割れていて id を読めない時（本物の読み口のまま）、一覧は「件数を取得できませんでした」。自分の投稿を読む通信も、引き継ぎの通信も出ていかない', J({ l1, r1 }));
    } finally {
      await u.st.ctx.close();
    }
  });

  for (const topic of ['work', 'taxi']) {
    const fn = topic === 'taxi' ? 'submit_airline_conditions' : 'submit_work_month', tn = topic === 'taxi' ? '質問の項目' : '月の勤務';
    await scene(`会員の id が読めないログイン ── 会員の入口に断られて預かりへ入った保存も、自分の投稿として戻さない（${tn}）`, async () => {
      await seedPrev();
      const u = await open('phone', { who: 'b' });
      await idless(u, true);
      try {
        await go(u, ANA);
        await mustBeIdless(u, '場面の頭');
        await api(u, 'list');
        await waitView(u, 'counted');
        await u.page.click(`.pvc-root [data-pvc-tile="${topic}"]`);
        await waitView(u, topic);
        await settle(u);
        if (topic === 'taxi') await pick(u, 'commuting_transport', 'no');
        else { await pick(u, 'position', 'fo'); await fill(u, 'block_hours', '70'); }
        await tick(u);
        /* 会員の入口が、この1回だけ「ログインが要る」と断る ＝ 同じ内容が、ログインなしの預かりへ入る */
        u.st.fake = { name: fn, status: 401, body: { code: 'PGRST301', message: 'JWT expired', details: null, hint: null } };
        await send(u);
        const back = await afterSend(u);
        const h1 = await heldAna();
        if (hits(u, 'submit_contrib_anon') !== 1 || h1.length !== 1) {
          throw new Error('前提が崩れた（会員の入口に断られて、預かりへ1件入った形になっていない）: ' + J({ anon: hits(u, 'submit_contrib_anon'), held: h1.length }));
        }
        const f1 = topic === 'taxi' ? await qFace(u) : await wFace(u), n1 = await savedSaid(u), t1 = await sheetText(u);
        await u.page.click('.pvc-root .pvc-prev');
        await waitView(u, 'list');
        await waitView(u, 'counted');
        const l1 = await listFace(u), box = await u.page.evaluate(() => !!document.querySelector('.pvc-root [data-pvc-held]'));
        await mustBeIdless(u, '場面の終わり');
        ok(back && (topic === 'taxi' ? emptyQ(f1) : emptyW(f1)) && !f1.own && n1.length === 1 && n1[0].title === '保存しました' && !/あなたの投稿/.test(t1)
          && l1.counts.length === 0 && l1.state === 'fail fail' && !box && hits(u, 'my_contrib_anon') === 0,
          `★${tn}：預かりへ入った保存も、カードにせず、入力にも一覧にも戻さない（空の入力に「保存しました」。「あなたの投稿」の札なし・ボタンは「匿名で追加する」・件数なし・「ログインなしで保存した回答があります。」の箱なし・預かりを読みにも行かない）`, J({ back, f1, n1, l1, box, anonReads: hits(u, 'my_contrib_anon') }));
      } finally {
        u.st.fake = null;
        await u.st.ctx.close();
        await noRows(NEXT);
      }
    });
  }

  /* ログインなしの人が、通勤・タクシーの1問を保存する（控えの鍵が付き、預かりに1件入る） */
  const lodge = async (p) => {
    await go(p, ANA);
    await api(p, 'taxi');
    await waitView(p, 'taxi');
    await settle(p);
    await pick(p, 'commuting_transport', 'no');
    await tick(p);
    await send(p);
    await waitView(p, 'saved');
  };

  await scene('会員の id が読めないログイン ── ページを開いただけでは、預けた回答の引き継ぎを始めない', async () => {
    await noRows(M1);
    const c = await open('phone');
    await idless(c, false);
    let v = null;
    try {
      /* 比べる相手（id が読める会員）。ページを開いて少しあとの時計は、ログインが無いうちに自分で鳴らせておく（何も始めない）。
         そのあとで会員がログインし、控えておいた時計の中身を呼ぶ ＝ 出ていった引き継ぎは、呼んだ1回のもの。 */
      await lodge(c);
      await go(c, ANA);
      const ran0 = await bootRan(c);
      if (!ran0 || hits(c, 'claim_contrib') !== 0) throw new Error('前提が崩れた（ログインが無いうちに時計が鳴り、何も始めなかった形になっていない）: ' + J({ ran0, claims: hits(c, 'claim_contrib') }));
      await loginAs(c, 'a');
      const s0 = await whoState(c), shut0 = await c.page.evaluate(() => !document.querySelector('.pvc-root'));
      if (J(s0) !== J([true, true]) || !shut0) throw new Error('前提が崩れた（面を閉じたまま、id が読める会員が入った形になっていない）: ' + J({ s0, shut0 }));
      const fired0 = await bootClaim(c);
      const left0 = await until(() => hits(c, 'claim_contrib') >= 1);
      /* 引き継ぎが済むまで待ってから閉じる（済む前に閉じて行を消すと、あとから届いた引き継ぎが行を作る） */
      const done0 = await seen(c, () => (window.__pvcSaved || []).some((x) => x && x.topic === 'claim'));
      ok(fired0 && left0 && done0 && hits(c, 'claim_contrib') === 1,
        '（比べる相手）id が読める会員なら、ページを開いて少しあとの引き継ぎは始まる（控えた時計の中身を呼ぶと、引き継ぎの通信が1本出ていく）', J({ fired0, left0, done0, claims: hits(c, 'claim_contrib') }));
      await c.st.ctx.close();
      await noRows(M1);

      /* id が読めない会員：預けたあと、ログインして会社ページを開き直す（面は開かない）。時計の中身を呼び、時計が自分でも鳴るのを待つ。 */
      v = await open('phone');
      await idless(v, true);
      await lodge(v);
      await loginAway(v, 'a');
      if (hits(v, 'claim_contrib') !== 0) throw new Error('前提が崩れた（開き直す前に、引き継ぎが始まっている）');
      await go(v, ANA);
      await mustBeIdless(v, '場面の頭');
      const fired = await bootClaim(v), ran = await bootRan(v), trip = await roundTrip(v);
      const key = await v.page.evaluate(() => localStorage.getItem('pv_contrib_key')), h1 = await heldAna(), m1 = await mineOf(M1.id);
      const shut = await v.page.evaluate(() => !document.querySelector('.pvc-root'));
      await mustBeIdless(v, '場面の終わり');
      if (!fired || !ran || !trip || !shut) throw new Error('前提が崩れた（面を閉じたまま、時計の中身を呼び、時計も自分で鳴った形になっていない）: ' + J({ fired, ran, trip, shut }));
      ok(hits(v, 'claim_contrib') === 0 && /^[0-9a-f]{48}$/.test(key || '') && h1.length === 1 && m1.cond.length === 0,
        '★会員の id が読めないあいだは、ページを開いただけでは引き継ぎを始めない（引き継ぎの通信は出ていかない・控えの鍵は端末に残る・預けた1件は預かりのまま）', J({ claims: hits(v, 'claim_contrib'), key: !!key, held: h1.length, mine: m1.cond.length }));
    } finally {
      await c.st.ctx.close().catch(() => {});
      if (v) await v.st.ctx.close();
      await noRows(M1);
    }
  });

  await scene('読めている一覧のまま、ログインの控えから id が読めなくなる ── 打った答えは残り、保存してあった答えは消える', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    await idless(u, false);
    try {
      await go(u, ANA);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      const q0 = await qFace(u);
      await pick(u, 'commuting_taxi_cost', 'partial');
      await tick(u);
      const p0 = await qFace(u);
      if (!fullQ(q0, 'company_full') || p0.cost !== 'partial' || !p0.own) throw new Error('前提が崩れた（保存した答えが入った入力に、1つ打ってチェックを入れた形になっていない）: ' + J({ q0, p0 }));
      const n0 = u.st.calls.length;
      await noId(u, true);
      await mustBeIdless(u, '場面の頭（id が読めなくなった直後）');
      await u.page.focus('.pvc-root [name="commuting_transport_note"]');
      const gone = await seen(u, taxiCleared);
      const q1 = await qFace(u), f1 = await formFace(u);
      await roundTrip(u);
      const calls = u.st.calls.slice(n0);
      await mustBeIdless(u, '場面の終わり');
      ok(gone && q1.form && q1.transport === '' && q1.note === '' && q1.method.length === 0 && q1.mine === 0 && q1.cost === 'partial' && !q1.own && f1.wait === NOREAD_Q && calls.length === 0,
        '★読めていた一覧のまま id が読めなくなったら、欄に入った時に、保存してあった答え・補足・札・確認のチェックは消え、打った答えは残る（送るボタンの下は「これまでの投稿を読み込めませんでした…」。通信は1本も出ていかない）', J({ gone, q1, wait: f1.wait, calls }));
    } finally {
      await u.st.ctx.close();
    }
  });

  await scene('引き継ぎの返事を待っているあいだに、ログインの控えから id が読めなくなる ── 届いた一覧を、出さない・数えない', async () => {
    await noRows(M1);
    const v = await open('phone');
    await idless(v, false);
    try {
      await lodge(v);
      await loginAway(v, 'a');
      if (hits(v, 'claim_contrib') !== 0) throw new Error('前提が崩れた（開き直す前に、引き継ぎが始まっている）');
      /* 質問の入力を開いた形で開き直す。面は、預けた1件の引き継ぎを始めて、その返事を待つ（返事は止めておく）。
         質問の欄は読み込み中で止まっているが、確認のチェックはその外に在る ＝ 押せる。 */
      v.st.hold = { name: 'claim_contrib', reqs: [] };
      await go(v, ANA + '?add=taxi');
      const held = await until(() => v.st.hold.reqs.length === 1);
      await v.page.waitForFunction(() => {
        const r = document.querySelector('.pvc-root');
        if (!r || r.hidden || !r.classList.contains('is-in')) return false;
        const s = r.querySelector('.pvc-sheet').getBoundingClientRect();
        if (Math.abs(s.right - document.documentElement.clientWidth) > 1 || Math.abs(s.bottom - window.innerHeight) > 1) return false;
        return !!r.querySelector('form[data-pvc-form="taxi"] input[name="own"]');
      });
      await v.page.click('.pvc-root label.pvc-own');
      const ticked = await v.page.$eval('.pvc-root input[name="own"]', (n) => n.checked);
      const s0 = await whoState(v);
      await noId(v, true);
      await mustBeIdless(v, '場面の頭（id が読めなくなった直後）');
      if (!held || !ticked || J(s0) !== J([true, true]) || hits(v, 'claim_contrib') !== 1 || !v.st.hold || v.st.hold.reqs.length !== 1) {
        throw new Error('前提が崩れた（引き継ぎの返事を止め、チェックを入れてから、id が読めなくなった形になっていない）: ' + J({ held, ticked, s0, claims: hits(v, 'claim_contrib') }));
      }
      /* 返事を流す。待つのは、そのあとに出ていく2本の読み取りの返事そのものと、ページの1往復（入力が使えるようになった、では足りない） */
      const n0 = v.st.calls.length;
      const got = (name) => v.page.waitForResponse((r) => r.url().endsWith('/rest/v1/rpc/' + name), { timeout: 8000 }).then(() => true, () => false);
      const gotC = got('my_airline_conditions'), gotW = got('my_work_months');
      release(v);
      const arrived = [await gotC, await gotW], trip = await roundTrip(v);
      if (!arrived[0] || !arrived[1] || !trip || hits(v, 'claim_contrib') !== 1) {
        throw new Error('前提が崩れた（引き継ぎの返事のあとに、2本の読み取りが出ていって戻った形になっていない）: ' + J({ arrived, trip, calls: v.st.calls.slice(n0) }));
      }
      const q1 = await qFace(v), f1 = await formFace(v), c1 = await claimSaid(v);
      ok(emptyQ(q1) && !q1.off && !q1.own && f1.wait === NOREAD_Q && !c1.box && !c1.said,
        '★引き継ぎの返事を待つあいだに id が読めなくなったら、届いた一覧を入力に出さない（空の入力・「あなたの投稿」の札なし・「匿名で追加する」・「これまでの投稿を読み込めませんでした…」・前に入れた確認のチェックは外れる・「引き継ぎました」も言わない）', J({ q1, wait: f1.wait, c1 }));
      await api(v, 'list');
      await waitView(v, 'counted');
      const l1 = await listFace(v);
      await mustBeIdless(v, '場面の終わり');
      ok(l1.state === 'fail fail' && l1.counts.length === 0 && l1.text === NOREAD_L,
        '★一覧でも数えない（「あなたの投稿 N件」なし・「件数を取得できませんでした」）', J(l1));
    } finally {
      release(v);
      await v.st.ctx.close();
      await noRows(M1);
    }
  });

  /* ── 自分の一覧を読みに行く前の待ち（預けた回答の引き継ぎ）のあいだに、同じタブのまま読む人が替わる ──
     控えの鍵を持った会員は、一覧を読む前に引き継ぎの返事を待つ。待っているあいだは、まだ何も読んでいない ＝ 印が無い。
     そこで読む人が替わると（同じタブのまま、ログインが切れる・入れ替わる。このタブに合図は来ない）、続く読み取りは
     今の人の印で始まるので、12-b の確かめ（読み始めた時の印 ≠ 今の人）には掛からなかった
     ＝ 前の人が入れた確認のチェックが、今の人の答えが入った入力に残っていた（押すだけで送れる）。
     決まり：読み始める時に「誰の分を読み始めたか」を控えて、一覧が届いた所で今の人と比べる。違えば、前の人の分を手放して
             読み直す。会員の id が読めなくなった時（上の場面）も、この同じ1行が止める。
     1人目＝この会社に1件も無い会員A（預けた1件を引き継ぐ）。2人目＝給与提出者（seedPrev の投稿を持っている）。 */
  const tickShown = (p) => p.page.waitForFunction(() => {
    const r = document.querySelector('.pvc-root');
    if (!r || r.hidden || !r.classList.contains('is-in')) return false;
    const s = r.querySelector('.pvc-sheet').getBoundingClientRect();
    if (Math.abs(s.right - document.documentElement.clientWidth) > 1 || Math.abs(s.bottom - window.innerHeight) > 1) return false;
    return !!r.querySelector('form[data-pvc-form="taxi"] input[name="own"]');
  });

  await scene('引き継ぎの返事を待っているあいだに、同じタブのまま別の会員に替わる ── 前の人が入れた確認のチェックを残さない', async () => {
    await seedPrev();
    await noRows(M1);
    const pay0 = JSON.stringify(await mineOf(PREV.id));
    const v = await open('phone');
    try {
      await lodge(v);
      await loginAway(v, 'a');
      if (hits(v, 'claim_contrib') !== 0) throw new Error('前提が崩れた（開き直す前に、引き継ぎが始まっている）');
      /* 質問の入力を開いた形で開き直す。面は、預けた1件の引き継ぎを始めて、その返事を待つ（返事は止めておく）。
         1人目が、読み込み中の入力の外に在る確認のチェックを入れる。 */
      v.st.hold = { name: 'claim_contrib', reqs: [] };
      await go(v, ANA + '?add=taxi');
      const held = await until(() => v.st.hold.reqs.length === 1);
      await tickShown(v);
      await v.page.click('.pvc-root label.pvc-own');
      const ticked = await v.page.$eval('.pvc-root input[name="own"]', (n) => n.checked);
      /* 同じページのまま、ログインだけを2人目のものに入れ替える（このタブには合図が届かない。どこにも触らない） */
      await loginAs(v, 'pay');
      const now = await v.page.evaluate(() => String(((window.PVSession.readStoredSession() || {}).user || {}).id || ''));
      if (!held || !ticked || now !== PREV.id || hits(v, 'claim_contrib') !== 1 || !v.st.hold || v.st.hold.reqs.length !== 1) {
        throw new Error('前提が崩れた（引き継ぎの返事を止め、1人目がチェックを入れてから、同じタブのまま2人目に替わった形になっていない）: ' + J({ held, ticked, now: now === PREV.id, claims: hits(v, 'claim_contrib') }));
      }
      /* 返事を流す。待つのは、2人目の保存した答えが入力に入ること（直す前も直したあとも、最後はこの形になる）と、ページの1往復 */
      const n0 = v.st.calls.length;
      release(v);
      const arrived = await seen(v, () => {
        const f = document.querySelector('.pvc-root form[data-pvc-form="taxi"]'), set = f && f.querySelector('fieldset.pvc-set');
        return !!set && !set.disabled && f.querySelectorAll('.pvc-mine').length === 3;
      });
      const trip = await roundTrip(v);
      if (!arrived || !trip || hits(v, 'claim_contrib') !== 1) {
        throw new Error('前提が崩れた（引き継ぎの返事のあと、2人目の答えが入力に入った形になっていない）: ' + J({ arrived, trip, calls: v.st.calls.slice(n0) }));
      }
      const q1 = await qFace(v), c1 = await claimSaid(v);
      ok(!q1.own && fullQ(q1, 'company_full') && !q1.off && !c1.box && !c1.said,
        '★引き継ぎの返事を待つあいだに同じタブのまま別の会員に替わったら、前の人が入れた確認のチェックは外れる（入力に入るのは今の人が保存した答え。押すだけでは送れない。「引き継ぎました」も言わない）', J({ own: q1.own, dis: q1.dis, c1, q1 }));
      await api(v, 'list');
      await waitView(v, 'counted');
      const l1 = await listFace(v);
      const m1 = await mineOf(M1.id), pay1 = JSON.stringify(await mineOf(PREV.id)), h1 = await heldAna();
      ok(l1.state === 'ok ok' && J(l1.counts) === J(COUNTS0)
        && m1.cond.length === 1 && m1.cond[0].q === 'commuting_transport' && m1.cond[0].c === 'no' && m1.work.length === 0
        && pay1 === pay0 && h1.length === 0 && c1.key === null && subs(v, n0).length === 0,
        '一覧の件数は今の人のもの。引き継いだ1件は、引き継ぎを始めた会員のもの。今の人の行は1つも変わらず、何も送られていない', J({ l1, m1, same: pay1 === pay0, held: h1.length, key: c1.key, sent: subs(v, n0) }));
    } finally {
      release(v);
      await v.st.ctx.close();
      await noRows(M1);
    }
  });

  /* ── 同じタブのまま、誰も触らないうちにログインが切れる ──
     ログインの部品（pv-session.js）は、開きっぱなしのタブを自分の時計で見張り、切れたログインを片づける。合図は出さない。
     面が確かめていたのは、ほかのタブからの合図・タブへ戻った時・面の中を触った時だけ ＝ 誰も触らなければ、
     前の人の答えが出たままだった。面も、同じ長さの時計で「いま読む人」を聞き直す
     （読む人が同じ時は、何もしない。面が閉じている時は、描いてあった字を消すだけ ＝ どちらも、通信は1本も出ない）。
     場面は時計を待たない：控えておいた時計の中身を呼ぶ（idless が控える。tickFire）。 */
  const TICK = (() => {
    const m = /var TICK_MS\s*=\s*([\d\s*]+);/.exec(read('pv-session.js'));
    return m ? m[1].split('*').reduce((a, x) => a * Number(x.trim()), 1) : NaN;
  })();

  await scene('同じタブのまま、誰も触らないうちにログインが切れる ── 面の時計が気づいて、前の人の答えを消す（打った答えは残る）', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    await idless(u, false);
    try {
      await go(u, ANA);
      await api(u, 'taxi');
      await waitView(u, 'taxi');
      await settle(u);
      const q0 = await qFace(u);
      /* 打つのは、いちばん上の質問（続きの質問は、上の答えが消えると畳まれて見えなくなる ＝ 「打った答えが見えたまま残る」を見るには上の質問で） */
      await pick(u, 'commuting_transport', 'always');
      await tick(u);
      const p0 = await qFace(u);
      if (!fullQ(q0, 'company_full') || p0.transport !== 'always' || p0.note !== NOTE_Q || p0.cost !== 'company_full' || !p0.own) {
        throw new Error('前提が崩れた（保存した答えが入った入力で、いちばん上の質問を打ち直してチェックを入れた形になっていない）: ' + J({ q0, p0 }));
      }
      /* 読む人が同じあいだ：時計の中身を呼んでも、入力は作り直されない・通信は1本も出ていかない */
      await u.page.evaluate(() => { document.querySelector('.pvc-root form[data-pvc-form="taxi"]').setAttribute('data-test-old', '1'); });
      const n0 = u.st.calls.length;
      const ms0 = await tickFire(u), trip0 = await roundTrip(u);
      const s1 = await qFace(u), kept = await u.page.evaluate(() => !!document.querySelector('.pvc-root form[data-pvc-form="taxi"][data-test-old]'));
      ok(ms0 === TICK && trip0 && kept && JSON.stringify(s1) === JSON.stringify(p0) && u.st.calls.length === n0,
        '面の時計は、ログインの部品が自分のログインを確かめる時計と同じ長さ。読む人が同じあいだは、鳴っても何もしない（入力を作り直さない・通信は1本も出ていかない）', J({ ms0, TICK, kept, calls: u.st.calls.slice(n0), s1 }));
      /* 同じタブのまま、ログインが片づく（このタブに合図は来ない）。どこにも触らない ＝ この時点では、前の人の答えが出たまま。 */
      const out = await u.page.evaluate(() => { window.PVSession.wipe(); return window.PVSession.hasToken(); });
      const q1 = await qFace(u);
      if (out !== false || q1.transport !== 'always' || q1.note !== NOTE_Q || q1.cost !== 'company_full' || q1.mine === 0 || !q1.own) {
        throw new Error('前提が崩れた（ログインが片づいた直後で、まだ誰も気づいていない形になっていない）: ' + J({ out, q1 }));
      }
      const ms = await tickFire(u);
      const gone = await seen(u, taxiCleared);
      const q2 = await qFace(u);
      const shown = await u.page.evaluate(() => { const x = document.querySelector('.pvc-root form [name="commuting_transport"]'); return !!x && x.getClientRects().length > 0; });
      ok(ms !== null && gone && q2.form && q2.transport === 'always' && shown && q2.note === '' && q2.method.length === 0 && !q2.cost && q2.mine === 0 && !q2.own,
        '★同じタブのままログインが切れたら、どこにも触らなくても、面の時計が鳴った時に、前の人の答え・補足・札・確認のチェックが消える（打った答えは、見えたまま残る）', J({ ms, gone, shown, q2 }));
    } finally {
      await u.st.ctx.close();
    }
  });

  /* ── 読む人が替わったあとで打ち始めた入力に、今の人の一覧が届く ──
     12-b の決まり（打って、まだ送っていない入力は残す・その場で作り直した入力は、読み直しを待つあいだも止めない）の続き。
     打っている入力は、今の人の一覧が届いても作り直していなかった ＝
       質問の項目 … 今の人が前に保存した答えが出ないまま、ボタンも「匿名で追加する」のまま（送る中身は正しい）。
       月の勤務   … 札とボタンだけが「あなたの投稿／匿名で更新する」に替わり、打っていない欄は空のまま。
                    月は1か月が1行で、保存は全部の欄を入れ替える ＝ そのまま送ると、今の人が保存していた
                    その月の職位・機種・時間・メモが、空で置き換わる。入力を開き直しても直らない（打ちかけの月の写しが残る）。
     決まり：今の人の保存した値が分かった時点で、打っていない欄にだけ入れる。打った欄には書かない。
             質問の項目は、今の人にこの項目の答えが在る時だけ、その場で1回描き直す（無ければ、同じ入力のまま）。
     前の人＝給与提出者・今の人＝会員B。今の人の行は場面ごとに置き、終わりに消す（12-c のあとの形を変えない）。 */
  const NOTE_N = '試験：今の人の月のメモ';
  /* 今の人にも、前の人と同じ月の勤務を置く（副操縦士・機種・乗務時間・ステイ・メモ。勤務・拘束時間は入れない） */
  const seedNextMonth = () => rpcAs('b', 'submit_work_month', { airline: 'ana', year: LAST.y, month: LAST.m, position: 'fo', fleet: FLEET, block_hours: 40, stay_nights: 3, note: NOTE_N, lang: 'ja' });
  const nextW = (x, duty) => x.form && x.position === 'fo' && x.fleet === FLEET && x.block_hours === '40' && x.stay_nights === '3' && x.note === NOTE_N
    && x.duty_hours === duty && x.tag === true && x.btn === '匿名で更新する';
  const atName = (p) => p.page.evaluate(() => { const a = document.activeElement; return a ? a.getAttribute('name') || '' : ''; });
  /* 休暇・手当の入力に、いま出ているもの（上から、病気休暇・Peer Support の2問を見る） */
  const bFace = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), f = r.querySelector('form[data-pvc-form="benefits"]'), a = document.activeElement;
    if (!f) return { form: false };
    const v = (n) => { const x = f.querySelector('[name="' + n + '"]'); return x ? x.value : null; };
    return { form: true, old: f.hasAttribute('data-test-old'), sick: v('sick_leave'), peer: v('peer_support'),
      peerTag: !!f.querySelector('[data-q="peer_support"] .pvc-label .pvc-mine'), mine: f.querySelectorAll('.pvc-mine').length,
      btn: f.querySelector('.pvc-send[type="submit"]').textContent, own: f.querySelector('[name="own"]').checked,
      off: f.querySelector('fieldset.pvc-set').disabled, at: a && f.contains(a) ? a.getAttribute('name') || a.tagName.toLowerCase() : '' };
  });
  const markOld = (p, topic) => p.page.evaluate((t) => { document.querySelector('.pvc-root form[data-pvc-form="' + t + '"]').setAttribute('data-test-old', '1'); }, topic);

  await scene('読む人が替わったあと打ち始めた質問の入力に、今の人の一覧が届く ── 前に保存した答えが入り、打った答えは残る', async () => {
    await seedPrev();
    /* 今の人は、この項目（休暇・手当）に答えを1つだけ持っている */
    const c = await rpcAs('b', 'submit_airline_conditions', { airline: 'ana', lang: 'ja', answers: [{ question_id: 'peer_support', code: 'internal' }] });
    const u = await open('phone', { who: 'pay' });
    const sent = tap(u, 'submit_airline_conditions');
    try {
      await go(u, ANA);
      await api(u, 'benefits');
      await waitView(u, 'benefits');
      await settle(u);
      const f0 = await bFace(u);
      const before = JSON.stringify(await mineOf(PREV.id));
      await loginAs(u, 'b');
      u.st.hold = { name: 'my_airline_conditions', reqs: [] };
      await u.page.focus('.pvc-root [name="sick_leave"]');     // 欄に入る ＝ 読む人が替わったと気づいて、入力がその場で作り直される
      const held = await until(() => u.st.hold.reqs.length === 1);
      await pick(u, 'sick_leave', 'unlimited');                // 今の人が保存していない、別の質問に答える
      const f1 = await bFace(u);
      if (!c || !c.ok || (c.rejected || []).length || !f0.form || f0.mine !== 0 || f0.btn !== '匿名で追加する' || !held
        || f1.sick !== 'unlimited' || f1.peer !== '' || f1.mine !== 0 || f1.off || f1.at !== 'sick_leave') {
        throw new Error('前提が崩れた（前の人には答えの無い項目で、読む人が替わったあと1問を打ち、今の人の読み直しを止めた形になっていない）: ' + J({ c, f0, held, f1 }));
      }
      await markOld(u, 'benefits');
      release(u);
      const shown = await seen(u, () => { const f = document.querySelector('.pvc-root form[data-pvc-form="benefits"]'); return !!f && f.querySelectorAll('.pvc-mine').length > 0; });
      const f2 = await bFace(u);
      ok(shown && f2.peer === 'internal' && f2.peerTag && f2.mine === 1 && f2.btn === '匿名で更新する' && f2.sick === 'unlimited' && f2.at === 'sick_leave' && !f2.off,
        '★打っている質問の入力に今の人の一覧が届いたら、今の人が前に保存した答えが、札「あなたの投稿」つきで入る（ボタンは「匿名で更新する」。打った答えは残り、居た欄に居たまま）', J({ shown, f2 }));
      await tick(u);
      await send(u);
      const done = await afterSend(u);
      const pl = sent[sent.length - 1] || {}, got = (await mineOf(NEXT.id)).cond.map((x) => x.q + '=' + x.c), after = JSON.stringify(await mineOf(PREV.id));
      ok(done && sent.length === 1 && J(ids(pl)) === J(['sick_leave']) && pl.answers[0].code === 'unlimited'
        && J(got) === J(['peer_support=internal', 'sick_leave=unlimited']) && after === before,
        '送ると、出ていくのは打った答えだけ。保存先には、今の人の前の答えと打った答えの両方が在り、前の人の行は変わらない', J({ ids: ids(pl), got, same: after === before, n: sent.length }));
    } finally {
      release(u);
      await u.st.ctx.close();
      await noRows(NEXT);
    }
  });

  await scene('読む人が替わったあと打ち始めた質問の入力に、今の人の一覧が届く ── 今の人に、この項目の答えが無い ── 打っている入力は作り直さない', async () => {
    await seedPrev();
    /* 今の人が持っているのは、月の勤務と、ほかの項目（通勤・タクシー）の答えだけ ＝ 届く一覧は空ではない */
    const sw = await seedNextMonth();
    const c = await rpcAs('b', 'submit_airline_conditions', { airline: 'ana', lang: 'ja', answers: [{ question_id: 'commuting_transport', code: 'no' }] });
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'benefits');
      await waitView(u, 'benefits');
      await settle(u);
      await loginAs(u, 'b');
      u.st.hold = { name: 'my_airline_conditions', reqs: [] };
      await u.page.focus('.pvc-root [name="sick_leave"]');
      const held = await until(() => u.st.hold.reqs.length === 1);
      await pick(u, 'sick_leave', 'unlimited');
      const f1 = await bFace(u);
      if (!sw || !sw.ok || !c || !c.ok || (c.rejected || []).length || !held || f1.sick !== 'unlimited' || f1.mine !== 0 || f1.off || f1.at !== 'sick_leave') {
        throw new Error('前提が崩れた（読む人が替わったあと1問を打ち、今の人の読み直しを止めた形になっていない）: ' + J({ sw, c, held, f1 }));
      }
      await markOld(u, 'benefits');
      /* ここでは、一覧が届いても画面は何も変わらない ＝ 届いたことそのもの（止めていた返事）と、ページの1往復を待つ */
      const got = u.page.waitForResponse((r) => r.url().endsWith('/rest/v1/rpc/my_airline_conditions'), { timeout: 8000 }).then(() => true, () => false);
      release(u);
      const arrived = await got, trip = await roundTrip(u);
      const f2 = await bFace(u);
      await api(u, 'list');
      await waitView(u, 'counted');
      const l2 = await listFace(u);
      if (!arrived || !trip || l2.state !== 'ok ok' || J(l2.counts) !== J(['work：あなたの投稿 1件', 'taxi：あなたの投稿 1件'])) {
        throw new Error('前提が崩れた（今の人の、空でない一覧が届いた形になっていない）: ' + J({ arrived, trip, l2 }));
      }
      ok(f2.form && f2.old && f2.sick === 'unlimited' && f2.at === 'sick_leave' && f2.mine === 0 && f2.btn === '匿名で追加する',
        '★今の人にこの項目の答えが無ければ、一覧が届いても、打っている入力は作り直さない（同じ入力のまま・打った答えと居た欄はそのまま・札は出ない）', J(f2));
    } finally {
      release(u);
      await u.st.ctx.close();
      await noRows(NEXT);
    }
  });

  /* 上の作り直しは、読む人が替わったあとの入力に限る。読む人が替わっていない時の読み直し（面を開き直すたびに読む）では、
     打っている入力を今までどおり作り直さない ── ほかのタブ・ほかの端末で自分の答えが増えていても、同じ入力のまま
     （こちらの読み直しは、居た欄と位置を戻す仕掛けを通らない ＝ 作り直すと、打っている欄から焦点が外れる）。 */
  await scene('読む人が替わっていない会員 ── 打っている質問の入力に、読み直した一覧が届く（自分の答えが増えていても、入力は作り直さない）', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'benefits');
      await waitView(u, 'benefits');
      await settle(u);
      const f0 = await bFace(u);
      await u.page.evaluate(() => window.PVContrib.close());
      await waitClosed(u);
      /* 面を閉じているあいだに、同じ会員の、この項目の答えが1つ増える（画面は通さない ＝ ほかの所で保存した） */
      const c = await rpcAs('pay', 'submit_airline_conditions', { airline: 'ana', lang: 'ja', answers: [{ question_id: 'peer_support', code: 'internal' }] });
      /* 開き直す。読めていた一覧はそのまま使われ（入力はすぐ使える）、裏で読み直しが走る。その返事を止めて、1問を打つ */
      u.st.hold = { name: 'my_airline_conditions', reqs: [] };
      await api(u, 'benefits');
      await waitView(u, 'benefits');
      const held = await until(() => u.st.hold.reqs.length === 1);
      await u.page.focus('.pvc-root [name="sick_leave"]');
      await pick(u, 'sick_leave', 'unlimited');
      const f1 = await bFace(u);
      if (!c || !c.ok || (c.rejected || []).length || !f0.form || f0.mine !== 0 || !held || f1.sick !== 'unlimited' || f1.mine !== 0 || f1.off || f1.at !== 'sick_leave') {
        throw new Error('前提が崩れた（読む人は同じまま、開き直した入力で1問を打ち、読み直しの返事を止めた形になっていない）: ' + J({ c, f0, held, f1 }));
      }
      await markOld(u, 'benefits');
      const got = u.page.waitForResponse((r) => r.url().endsWith('/rest/v1/rpc/my_airline_conditions'), { timeout: 8000 }).then(() => true, () => false);
      release(u);
      const arrived = await got, trip = await roundTrip(u);
      const f2 = await bFace(u);
      await api(u, 'list');
      await waitView(u, 'counted');
      const l2 = await listFace(u);
      if (!arrived || !trip || l2.state !== 'ok ok' || J(l2.counts) !== J([...COUNTS0, 'benefits：あなたの投稿 1件'])) {
        throw new Error('前提が崩れた（読み直した一覧に、増えた答えが入って届いた形になっていない）: ' + J({ arrived, trip, l2 }));
      }
      ok(f2.form && f2.old && f2.sick === 'unlimited' && f2.at === 'sick_leave' && f2.mine === 0 && f2.btn === '匿名で追加する',
        '★読む人が替わっていない時の読み直しでは、この項目の答えが増えて届いても、打っている入力は作り直さない（同じ入力のまま・打った答えと居た欄はそのまま）', J(f2));
    } finally {
      release(u);
      await u.st.ctx.close();
      await q(`delete from public.airline_conditions where airline = 'ana' and question_id = 'peer_support' and proof_hash = public.pv_condition_hash($1::uuid, 'ana', null)`, [PREV.id]);
    }
  });

  await scene('読む人が替わったあと打ち始めた月の勤務に、今の人の同じ月が届く ── 打っていない欄に保存した値が入る', async () => {
    await seedPrev();
    const sw = await seedNextMonth();
    const u = await open('phone', { who: 'pay' });
    const sentW = tap(u, 'submit_work_month');
    try {
      await go(u, ANA);
      await api(u, 'work');
      await waitView(u, 'work');
      await settle(u);
      const w0 = await wFace(u);
      const before = JSON.stringify(await mineOf(PREV.id));
      await loginAs(u, 'b');
      u.st.hold = { name: 'my_work_months', reqs: [] };
      await u.page.focus('.pvc-root [name="duty_hours"]');     // 欄に入る ＝ 入力がその場で作り直される（前の人の月は消える）
      const held = await until(() => u.st.hold.reqs.length === 1);
      await u.page.keyboard.type('12');                         // 鍵盤で打つ（fill は欄を選び直すので、描き直しをまたいで同じ欄に居るかを見られない）
      const w1 = await wFace(u), at1 = await atName(u);
      if (!sw || !sw.ok || !fullW(w0) || !held || !w1.form || w1.duty_hours !== '12' || w1.position !== '' || w1.fleet !== '' || w1.block_hours !== '' || w1.stay_nights !== ''
        || w1.note !== '' || w1.tag !== false || at1 !== 'duty_hours') {
        throw new Error('前提が崩れた（前の人の月が消えた入力に 12 と打ち、今の人の読み直しを止めた形になっていない）: ' + J({ sw, held, at1, w1 }));
      }
      release(u);
      /* 待つのは「あなたの投稿」の札（直す前も、札とボタンだけは替わっていた ＝ 直す前もここは通る）。そのあと、同じ欄に続きを打つ */
      const tagged = await seen(u, () => { const t = document.querySelector('.pvc-root form[data-pvc-form="work"] [data-pvc-own-row]'); return !!t && !t.hidden; });
      await u.page.keyboard.type('0');
      const w2 = await wFace(u), at2 = await atName(u);
      ok(tagged && nextW(w2, '120') && at2 === 'duty_hours',
        '★打っている月の勤務に今の人の同じ月が届いたら、打っていない欄（職位・機種・乗務時間・ステイ・メモ）に今の人の保存した値が入る（打った欄は 12 のあとに 0 が続いて 120 ＝ 同じ欄に居たまま。前の人の値は無い）', J({ tagged, at2, w2 }));
      await tick(u);
      await send(u);
      const done = await afterSend(u);
      const s2 = await summary(u), next = (await mineOf(NEXT.id)).work, after = JSON.stringify(await mineOf(PREV.id));
      ok(done && sentW.length === 1 && s2.head === '情報を更新しました'
        && J(next) === J([{ y: LAST.y, m: LAST.m, pos: 'fo', fleet: FLEET, block: 40, duty: 120, stay: 3, note: NOTE_N }]) && after === before,
        '★送ると、今の人のその月は、前に保存した値と打った 120 の両方を持つ（保存してあった欄が空で置き換わらない）。前の人の月は変わらない。見出しは「情報を更新しました」', J({ head: s2.head, n: sentW.length, next, same: after === before }));
    } finally {
      release(u);
      await u.st.ctx.close();
      await noRows(NEXT);
    }
  });

  /* 今の人の同じ月が、最初の読み直しには無く、あとの読み直し（面を開き直した時）で届く。
     「今の人の月を知らないまま」の印は、その月の行が分かるまで残る。こちらの読み直しは、読む人が替わった時の
     「居た欄と位置を戻す」仕掛けを通らないので、描き直す所が自分で戻す。 */
  await scene('読む人が替わったあと打ち始めた月の勤務に、今の人の同じ月が、あとの読み直しで届く ── 打っていない欄に入り、居た欄に居たまま', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'work');
      await waitView(u, 'work');
      await settle(u);
      const w0 = await wFace(u);
      await loginAs(u, 'b');
      /* 欄に入る ＝ 入力がその場で作り直され、今の人の一覧（まだ空）が読まれる。その2本の返事と、ページの1往復を待つ */
      const got = (name) => u.page.waitForResponse((r) => r.url().endsWith('/rest/v1/rpc/' + name), { timeout: 8000 }).then(() => true, () => false);
      const gotW = got('my_work_months'), gotC = got('my_airline_conditions');
      await u.page.focus('.pvc-root [name="duty_hours"]');
      const first = [await gotW, await gotC], trip = await roundTrip(u);
      await u.page.keyboard.type('12');
      await u.page.evaluate(() => window.PVContrib.close());
      await waitClosed(u);
      /* 面を閉じているあいだに、今の人の同じ月が保存される（画面は通さない ＝ ほかの所で保存した） */
      const sw = await seedNextMonth();
      /* 開き直す。読めていた（空の）一覧のまま入力はすぐ使え、裏で読み直しが走る。その返事を止めて、同じ欄に入る */
      u.st.hold = { name: 'my_work_months', reqs: [] };
      await api(u, 'work');
      await waitView(u, 'work');
      const held = await until(() => u.st.hold.reqs.length === 1);
      await u.page.focus('.pvc-root [name="duty_hours"]');
      const w1 = await wFace(u), at1 = await atName(u);
      if (!fullW(w0) || !first[0] || !first[1] || !trip || !sw || !sw.ok || !held || !w1.form || w1.duty_hours !== '12' || w1.position !== '' || w1.block_hours !== '' || w1.note !== ''
        || w1.tag !== false || at1 !== 'duty_hours') {
        throw new Error('前提が崩れた（読む人が替わったあと 12 と打ち、面を開き直して、今の人の同じ月が入った読み直しを止めた形になっていない）: ' + J({ first, trip, sw, held, at1, w1 }));
      }
      release(u);
      const tagged = await seen(u, () => { const t = document.querySelector('.pvc-root form[data-pvc-form="work"] [data-pvc-own-row]'); return !!t && !t.hidden; });
      await u.page.keyboard.type('0');
      const w2 = await wFace(u), at2 = await atName(u);
      ok(tagged && nextW(w2, '120') && at2 === 'duty_hours',
        '★今の人の同じ月が、あとの読み直しで届いた時も、打っていない欄に保存した値が入る（打った欄は 12 のあとに 0 が続いて 120 ＝ 同じ欄に居たまま）', J({ tagged, at2, w2 }));
    } finally {
      release(u);
      await u.st.ctx.close();
      await noRows(NEXT);
    }
  });

  /* 上の描き直しは、「今の人の月を知らないまま」の印が付いた写しに限る。読む人が替わっていない時の読み直しでは、
     その月の保存した値がほかの所で替わって届いても、打っている月の勤務を今までどおり作り直さない（札とボタンの字だけ直す）。
     印を見ずに描き直すと、打っている最中の入力が、読み直しのたびに作り直される（変換の途中の字・欄の中の位置が切れる）。 */
  await scene('読む人が替わっていない会員 ── 打っている月の勤務に、読み直した一覧が届く（その月の保存した値が替わっていても、入力は作り直さない）', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'work');
      await waitView(u, 'work');
      await settle(u);
      const w0 = await wFace(u);
      await u.page.evaluate(() => window.PVContrib.close());
      await waitClosed(u);
      /* 面を閉じているあいだに、同じ会員の同じ月の値が1つ替わる（画面は通さない ＝ ほかの所で保存し直した。ステイ 7 → 9） */
      const c = await rpcAs('pay', 'submit_work_month', { airline: 'ana', year: LAST.y, month: LAST.m, position: 'cap', fleet: FLEET, block_hours: 61.5, stay_nights: 9, note: NOTE_W, lang: 'ja' });
      /* 開き直す。読めていた一覧のまま入力はすぐ使え、裏で読み直しが走る。その返事を止めて、1つ打つ */
      u.st.hold = { name: 'my_work_months', reqs: [] };
      await api(u, 'work');
      await waitView(u, 'work');
      const held = await until(() => u.st.hold.reqs.length === 1);
      await u.page.focus('.pvc-root [name="duty_hours"]');
      await u.page.keyboard.type('12');
      const w1 = await wFace(u), at1 = await atName(u);
      if (!c || !c.ok || !fullW(w0) || !held || !fullW(w1) || w1.duty_hours !== '12' || at1 !== 'duty_hours') {
        throw new Error('前提が崩れた（読む人は同じまま、開き直した月の勤務に 12 と打ち、読み直しの返事を止めた形になっていない）: ' + J({ c, held, at1, w1 }));
      }
      await markOld(u, 'work');
      /* 待つのは、止めていた読み直しの返事そのもの（中身に、替わったステイ 9 が入っている）と、ページの1往復 */
      const got = u.page.waitForResponse((r) => r.url().endsWith('/rest/v1/rpc/my_work_months'), { timeout: 8000 }).then((r) => r.text(), () => '');
      release(u);
      const body = await got, trip = await roundTrip(u);
      if (!/"stay_nights":\s*9\b/.test(body) || !trip) {
        throw new Error('前提が崩れた（読み直した一覧に、替わった値が入って届いた形になっていない）: ' + J({ body: body.slice(0, 200), trip }));
      }
      const old = await u.page.evaluate(() => document.querySelector('.pvc-root form[data-pvc-form="work"]').hasAttribute('data-test-old'));
      await u.page.keyboard.type('0');
      const w2 = await wFace(u), at2 = await atName(u);
      ok(old && fullW(w2) && w2.duty_hours === '120' && at2 === 'duty_hours',
        '★読む人が替わっていない時の読み直しでは、その月の保存した値が替わって届いても、打っている月の勤務は作り直さない（同じ入力のまま・打った 12 に 0 が続いて 120・居た欄はそのまま）', J({ old, at2, w2 }));
    } finally {
      release(u);
      await u.st.ctx.close();
      await seedPrev();
    }
  });

  await scene('打ちかけの月を残したまま読む人が替わり、あとで月の勤務を開く ── その月の保存した値が入る', async () => {
    await seedPrev();
    const sw = await seedNextMonth();
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'list');
      await waitView(u, 'counted');
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(u, 'work');
      await settle(u);
      const w0 = await wFace(u);
      await fill(u, 'duty_hours', '120');                       // 前の人が、保存した値の入った月に 120 と打つ
      await u.page.click('.pvc-root .pvc-prev');                // 一覧へ（本物のクリック）
      await waitView(u, 'list');
      await waitView(u, 'counted');
      if (!sw || !sw.ok || !fullW(w0)) throw new Error('前提が崩れた（前の人の保存した月が入った入力に打ってから、一覧へ戻った形になっていない）: ' + J({ sw, w0 }));
      await loginAs(u, 'b');
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      /* 待つのは、入力が使えるようになって札が出ること（今の人の一覧が届いた。直す前も、札とボタンだけは出ていた） */
      const ready = await seen(u, () => {
        const f = document.querySelector('.pvc-root form[data-pvc-form="work"]'), set = f && f.querySelector('fieldset.pvc-set'), t = f && f.querySelector('[data-pvc-own-row]');
        return !!set && !set.disabled && !!t && !t.hidden;
      });
      const w1 = await wFace(u);
      ok(ready && nextW(w1, '120') && !w1.own,
        '★打ちかけの月を残したまま読む人が替わり、あとで月の勤務を開いた時も、打った 120 はそのまま、ほかの欄には今の人がその月に保存した値が入る（前の人の値は無い。確認のチェックは外れている）', J({ ready, w1 }));
    } finally {
      await u.st.ctx.close();
      await noRows(NEXT);
    }
  });

  /* ── 送っている最中に読む人が替わり、その送信が届かない ──
     送れなかった入力は、端末に1件残す（次に開いた時に続きを出す）。残す1件には、いまの人の印が付く。
     ここで、前の人が保存していた値まで残すと、それが次の会員の「送れていない回答」として出て、送ればその人の投稿になる。
     決まり：返事を受けた所でも、まず読む人を確かめる（前の人の分を手放す）── 残すのは、そのあと。
             残るのは、打って、まだ送っていない入力だけ（読む人が替わっても残す、と決めてあるもの）。 */
  await scene('送っている最中に読む人が替わり、その送信が届かない ── 端末に残す1件に、前の人が保存していた値を入れない', async () => {
    await seedPrev();
    const u = await open('phone', { who: 'pay' });
    try {
      await go(u, ANA);
      await api(u, 'work');
      await waitView(u, 'work');
      await settle(u);
      const w0 = await wFace(u);
      await fill(u, 'duty_hours', '120');
      await tick(u);
      const before = JSON.stringify({ prev: await mineOf(PREV.id), next: await mineOf(NEXT.id) });
      u.st.hold = { name: 'submit_work_month', reqs: [] };
      await send(u);
      const held = await until(() => u.st.hold.reqs.length === 1);
      await loginAs(u, 'b');                                    // 同じページのまま（このタブに合図は届かない）
      if (!fullW(w0) || !held) throw new Error('前提が崩れた（前の人の月に 120 と打って送り、その通信を止めた形になっていない）: ' + J({ w0, held }));
      cutHeld(u);
      await waitMsg(u, 'fail');
      /* 残した1件の、月の写しの欄（印の類は除く）。値が入っている欄の名前だけを並べる */
      const kept = (raw) => {
        let o = null;
        try { o = JSON.parse(raw); } catch (e) { /* 読めなければ空 */ }
        const dr = (o && o.draft) || {}, months = Object.keys(dr.bufs || {}), m = (dr.bufs || {})[months[0]] || {};
        return { uid: o ? o.uid : null, topic: o ? o.topic : null, own: dr.own, months: months.length,
          set: Object.keys(m).filter((k) => !['dirty', 'by', 'bare'].includes(k) && m[k] !== '' && m[k] != null).map((k) => k + '=' + m[k]) };
      };
      const ob = kept(await outboxOf(u)), w1 = await wFace(u), said = (await msg(u, 'fail')) || '';
      const after = JSON.stringify({ prev: await mineOf(PREV.id), next: await mineOf(NEXT.id) });
      ok(ob.uid === NEXT.id && ob.topic === 'work' && ob.months === 1 && J(ob.set) === J(['duty_hours=120']) && ob.own === false
        && /送れていません/.test(said) && w1.duty_hours === '120' && w1.position === '' && w1.fleet === '' && w1.block_hours === '' && w1.stay_nights === '' && w1.note === '' && !w1.own
        && after === before,
        '★送っている最中に読む人が替わって送れなかった時、端末に残す1件は今の人のもので、入っているのは打った 120 だけ（前の人が保存していた職位・機種・乗務時間・ステイ・メモは無い。確認のチェックも外れる）。画面も同じ。保存先は誰の行も変わらない', J({ ob, said: said.slice(0, 12), same: after === before, w1 }));
      await go(u, ANA + '?add=list');
      await waitView(u, 'list');
      await waitMsg(u, 'unsent');
      const un = (await msg(u, 'unsent')) || '';
      await u.page.click('.pvc-root [data-pvc-act="resume"]');
      await waitView(u, 'work');
      await waitMsg(u, 'fail');
      const w2 = await wFace(u);
      ok(/送れていない回答があります/.test(un) && w2.duty_hours === '120' && w2.position === '' && w2.fleet === '' && w2.block_hours === '' && w2.stay_nights === '' && w2.note === '' && w2.tag === false,
        '今の人が開き直すと「送れていない回答があります」と出て、「続きを開く」の先に在るのは 120 だけ（前の人の値は無い）', J({ un: un.slice(0, 16), w2 }));
    } finally {
      cutHeld(u);
      await u.st.ctx.close();
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 13. いちばん狭い画面（エバー航空・320×568・ログインなし）
  // ═════════════════════════════════════════════════════════════
  /* ログインなしで保存した直後のカードは、「ログインなしで保存しました。」の断りの箱が入るぶん、いちばん高い。
     幅320×高さ568 では、その箱が2つ目のボタン（もう1項目を答える）を最初の1画面の外へ押し出していた。
     390×680 だけを測っていると、ここは見えない（390 では余りが 100px 以上ある）。 */
  await scene('ログインなしで保存した直後 ── 320×568 でも2つのボタンに届く', async () => {
    const s = await open('small');
    try {
      await go(s, EVA);
      await api(s, 'work');
      await waitView(s, 'work');
      await settle(s);
      /* 月が2けた（10〜12月）だと会社名と月の行が折り返し、カードがいちばん高くなる ＝ 選べるならその月で測る */
      const wide = await s.page.$eval('.pvc-root select[name="ym"]', (n) => ([...n.options].find((x) => /-1[0-2]$/.test(x.value)) || {}).value || '');
      if (wide) { await pick(s, 'ym', wide); await waitView(s, 'work'); await settle(s); }
      await pick(s, 'position', 'fo');
      await fill(s, 'block_hours', '61');
      await tick(s);
      await farWatch(s);
      await send(s);
      await waitView(s, 'saved');
      const sm = await summary(s);
      const reach = await reachOf(s);
      const far = await farOf(s);
      const cues = await cueLog(s);
      if (sm.head !== '情報を追加しました' || !reach.held || J(cues) !== J(POP)) {
        throw new Error('前提が崩れた（ログインなしで保存でき、断りの箱が出た回になっていない）: ' + J({ head: sm.head, held: reach.held, cues }));
      }
      ok(reached(reach),
        '★320×568 でも、ログインなしで保存した直後（断りの箱が在る回）に、スクロールしなくても「自分の回答を見る」「もう1項目を答える」の両方に届く', J({ ym: wide || '（既定の月）', reach }));
      ok(!!far && far.n === 10 && far.still === 0 && far.card.length === 0 && far.sheet.length === 0 && far.parts === 4 && far.over.length === 0,
        '★320×568 でも、紙片は10枚ともカードの中に収まり、散り終わりの位置で見出しの字・チェックの印・2つのボタンのどれにも重ならない', J(far));
      /* この幅では、散る場所が見出しの字の終わりのすぐ右に来る。左へ飛ぶ紙片は「した」の上を横切っていた
         （散り終わりの位置だけを見る上の行では見えない ＝ 飛んでいる途中を、時刻を送って測る）。 */
      ok(!!far && far.steps >= 40 && far.cross.length === 0 && far.path.every((x) => !/^-/.test(x)),
        '★320×568 では、紙片は飛んでいる途中も、見出しの字（「情報を追加しました」）に1枚も重ならない（動きを 20ms 刻みで終わりまで送って測る）',
        J(far && { steps: far.steps, cross: far.cross.slice(0, 8), path: far.path }));
    } finally {
      await s.st.ctx.close();
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 14. 保存後のカード（「自分の回答を見る」の行き先・送り直したあとの見出し・通貨の切替・背の低い画面）
  // ═════════════════════════════════════════════════════════════
  const CARD = memberOf('c');
  /* この会社のページに、この会員が1件も持っていない形にする（1日の数えも戻す）
     ＝ 場面を単独で流しても、通しで流しても、同じ出発点になる。 */
  const bare = async (slug, m) => {
    await q(`delete from public.pv_work_months where airline = $2::text and proof_hash = public.pv_work_hash($1::uuid, $2::text, null)`, [m.id, slug]);
    await q(`delete from public.airline_conditions where airline = $2::text and proof_hash = public.pv_condition_hash($1::uuid, $2::text, null)`, [m.id, slug]);
    await q(`update public.profiles set cond_answers_today = 0, work_months_today = 0 where id = $1::uuid`, [m.id]);
  };
  /* その会員の、この会社の行（保存先から直接。サーバと同じ式の印で引く） */
  const ownConds = async (slug, m) => (await q(
    `select question_id as q, answer_code as c from public.airline_conditions
      where airline = $2::text and proof_hash = public.pv_condition_hash($1::uuid, $2::text, null) order by 1`, [m.id, slug])).rows;
  const ownMonths = async (slug, m) => (await q(
    `select period_year::text || '-' || lpad(period_month::text, 2, '0') as ym, block_hours::float8 as block from public.pv_work_months
      where airline = $2::text and proof_hash = public.pv_work_hash($1::uuid, $2::text, null) order by 1`, [m.id, slug])).rows;
  /* 面の中で、その質問（畳んである質問は、畳みごと）が見えている所に在るか（ページの中で動かす）。
     見えている ＝ 頭が面の見えている範囲に在り、下まで入っている（入りきらない高さのものは、頭が上端のすぐ下に在る）。 */
  const inView = (id) => {
    const r = document.querySelector('.pvc-root'), main = r && r.querySelector('.pvc-main');
    const n = r && (r.querySelector('[data-q-fold="' + id + '"]') || r.querySelector('form[data-pvc-form] [data-q="' + id + '"]'));
    if (!main || !n) return false;
    const m = main.getBoundingClientRect(), b = n.getBoundingClientRect();
    return b.height > 0 && b.top >= m.top - 1 && (b.bottom <= m.bottom + 1 || b.top - m.top <= 13);
  };
  /* その質問の、いまの位置と中身（scroll ＝ 面の中の送り・h ＝ 見えている高さ・top ＝ 見えている範囲の上端からの距離） */
  const spot = (p, id) => p.page.evaluate((qid) => {
    const r = document.querySelector('.pvc-root'), main = r.querySelector('.pvc-main'), m = main.getBoundingClientRect();
    const f = r.querySelector('form[data-pvc-form]');
    const fold = r.querySelector('[data-q-fold="' + qid + '"]'), n = fold || r.querySelector('form[data-pvc-form] [data-q="' + qid + '"]');
    const b = n ? n.getBoundingClientRect() : null, c = r.querySelector('form[data-pvc-form] [name="' + qid + '"]');
    return { form: f ? f.getAttribute('data-pvc-form') : '', scroll: Math.round(main.scrollTop), h: Math.round(m.height),
      top: b && b.height ? Math.round(b.top - m.top) : null, val: c ? c.value : null, mine: !!(n && n.querySelector('.pvc-mine')),
      open: fold ? fold.querySelector('.pvc-fold-b').getAttribute('aria-expanded') === 'true' && !fold.querySelector('.pvc-fold-p').hidden : null };
  }, id);
  /* その面から送った質問の名前を、送信1回ごとに控える（「続きの質問だけを送った」ことを確かめるのに使う。見るだけで、通信には触らない） */
  const sentLog = (p) => {
    const log = [];
    p.page.on('request', (req) => {
      let u;
      try { u = new URL(req.url()); } catch { return; }
      if (!/^\/rest\/v1\/rpc\/submit_(contrib_anon|airline_conditions)$/.test(u.pathname)) return;
      log.push([...String(req.postData() || '').matchAll(/"question_id":"([a-z0-9_]+)"/g)].map((m) => m[1]));
    });
    return log;
  };
  /* 返事だけが届かなかった回を作る：ページの送信を止め、同じ中身を検査の側からサーバへ届け（＝ 保存される）、
     ページの側の通信は切る（＝ 返事は届かない）。返すのは、サーバがその送信に返した答え（ページは知らない）。
     ⚠️ failNext の drop は、サーバが読む前に切る ＝ 保存されない。こちらは「保存されたのに、返事だけが無い」回。 */
  const lostReply = async (p, name) => {
    p.st.hold = { name, reqs: [] };
    await send(p);
    if (!(await until(() => p.st.hold.reqs.length === 1))) { cutHeld(p); return null; }
    const req = p.st.hold.reqs[0], hs = req.headers(), keep = {};
    for (const k of ['content-type', 'authorization', 'apikey', 'accept', 'content-profile', 'accept-profile', 'prefer', 'x-client-info']) if (hs[k]) keep[k] = hs[k];
    let body = null;
    try { body = await (await fetch(req.url(), { method: 'POST', headers: keep, body: req.postData() })).json(); } catch (e) { body = null; }
    cutHeld(p);
    return body;
  };
  const headOf = async (p) => (await summary(p)).head;
  const seeMine = async (p, topic) => { await p.page.click('.pvc-root [data-pvc-act="edit"]'); await waitView(p, topic); };

  /* ── 「自分の回答を見る」の行き先 ──
     長い項目（休暇・手当）では、保存した答えが最初の1画面より下に在る。頭から出すと、未回答の質問だけが見えて、
     保存した答えが消えたように見える（390×680 で、着陸手当の質問は面の見えている高さ 596px に対して 679px 下）。
     決まり：その回に送った最初の質問の所まで送る（畳んである質問は、畳みを開けて）。指した質問は、1回送ったら忘れる。 */
  await scene('保存後のカード ──「自分の回答を見る」は、いま保存した質問の所まで送る（390×680・ログインなし）', async () => {
    const p = await open('phone');
    const sent = sentLog(p);
    try {
      await go(p, CX);
      await api(p, 'list');
      await waitView(p, 'list');
      await p.page.click('.pvc-root [data-pvc-tile="benefits"]');
      await waitView(p, 'benefits');
      await settle(p);
      const s0 = await spot(p, 'landing_pay');
      if (s0.scroll !== 0 || s0.top === null || s0.top < s0.h) throw new Error('前提が崩れた（着陸手当の質問が、開いた時の最初の1画面より下に無い）: ' + J(s0));
      await pick(p, 'landing_pay', 'fixed');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      await seeMine(p, 'benefits');
      const got1 = await seen(p, inView, 'landing_pay');
      const s1 = await spot(p, 'landing_pay');
      ok(got1 && s1.val === 'fixed' && s1.mine && J(sent) === J([['landing_pay']]),
        '★長い項目の下のほうの質問を1つ保存して「自分の回答を見る」を押すと、その質問が面の見えている所に出る（保存した答えと「あなたの投稿」の札が付いている）', J({ before: s0, after: s1, sent }));

      /* 比べる相手：一覧へ戻って同じ項目を開き直した時は、頭から（指した質問を覚えたままにしない） */
      await p.page.click('.pvc-root .pvc-prev');
      await waitView(p, 'list');
      await p.page.click('.pvc-root [data-pvc-tile="benefits"]');
      await waitView(p, 'benefits');
      await settle(p);
      const s3 = await spot(p, 'landing_pay');
      ok(s3.scroll === 0 && !(await p.page.evaluate(inView, 'landing_pay')) && s3.val === 'fixed',
        '★そのあと一覧から同じ項目を開き直すと、頭から出る（指した質問を覚えたままにしない）', J(s3));

      /* 続きの質問だけを、あとから答える（上の質問は前に保存済み ＝ 送るのは続きの1問だけ） */
      await pick(p, 'landing_pay_unit', 'per_landing');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      await seeMine(p, 'benefits');
      const got2 = await seen(p, inView, 'landing_pay_unit');
      const s2 = await spot(p, 'landing_pay_unit');
      ok(got2 && s2.val === 'per_landing' && s2.mine && J(sent[1]) === J(['landing_pay_unit']),
        '★続きの質問だけをあとから保存した回も、その続きの質問の所へ出る（送ったのは続きの1問だけ）', J({ s2, sent: sent[1] }));

      /* 畳んである質問（通勤・タクシーの「回数・金額の上限」）。上の2問を先に保存し、上限だけをあとから答える。
         答えたあとで畳みを閉じてから送る ＝ 「自分の回答を見る」が、畳みを開けて見せるかを見る。 */
      await p.page.click('.pvc-root .pvc-prev');
      await waitView(p, 'list');
      await p.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(p, 'taxi');
      await settle(p);
      await pick(p, 'commuting_transport', 'always');
      await chip(p, 'commuting_transport_method', 'company_taxi');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      await seeMine(p, 'taxi');
      const gotT = await seen(p, (id) => {
        const r = document.querySelector('.pvc-root'), n = r && r.querySelector('form[data-pvc-form="taxi"] [data-q="' + id + '"]');
        const d = n ? n.getBoundingClientRect().top - r.querySelector('.pvc-main').getBoundingClientRect().top : -99;
        return d >= -1 && d <= 13;
      }, 'commuting_transport');
      const t1 = await spot(p, 'commuting_transport');
      ok(gotT && t1.val === 'always' && t1.mine && J(sent[2]) === J(['commuting_transport', 'commuting_transport_method']),
        '★2問を1回で送った回は、送った最初の質問を面の上端へ出す（続きの質問は、そのすぐ下に続く）', J({ t1, sent: sent[2] }));
      const FOLD = '.pvc-root [data-q-fold="commuting_taxi_cap"] .pvc-fold-b';
      const f0 = await spot(p, 'commuting_taxi_cap');
      await p.page.click(FOLD);
      await pick(p, 'commuting_taxi_cap', 'per_month');
      await p.page.click(FOLD);
      const f1 = await spot(p, 'commuting_taxi_cap');
      if (f0.open !== false || f1.open !== false || f0.top === null || f0.top + f0.scroll < f0.h) {
        throw new Error('前提が崩れた（上限の畳みが、閉じたまま、頭から出した時の最初の1画面より下に在る形になっていない）: ' + J({ f0, f1 }));
      }
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      await seeMine(p, 'taxi');
      const got3 = await seen(p, inView, 'commuting_taxi_cap');
      const f2 = await spot(p, 'commuting_taxi_cap');
      ok(got3 && f2.open === true && f2.val === 'per_month' && f2.mine && J(sent[3]) === J(['commuting_taxi_cap']),
        '★畳んである質問だけを保存した回は、畳みを開けて、その所へ出る', J({ f0, f2, sent: sent[3] }));
    } finally {
      await p.st.ctx.close();
    }
  });

  /* ── 送り直したあとの見出し ──
     見出しは、増えた＝「情報を追加しました」／直した＝「情報を更新しました」／分からない＝「保存しました」。
     サーバには保存されたのに返事だけが届かなかった回を「もう一度送る」で送り直すと、2回目は置き換えになる。
     直す前は、会員の質問は「追加しました」・月の勤務は「更新しました」（はじめての月なのに）・ログインなしは「追加しました」
     と、同じ出来事に道ごとの違う見出しが出ていた。前の送信が届いていたかは、画面からは分からない。
     決まり：送れなかった回の送り直し（端末に残した1件が、その項目・その月のもの）の見出しは、どの道でも「保存しました」。
             失敗の無い回・破棄したあとの回・ほかの項目（ほかの月）の1件が残っているだけの回は、今までどおり。 */
  await scene('返事が届かなかった回を送り直す（会員・質問の項目）── 見出しは「保存しました」', async () => {
    await bare('cathay-pacific', CARD);
    const p = await open('phone', { who: 'c' });
    try {
      await go(p, CX);
      await api(p, 'benefits');
      await waitView(p, 'benefits');
      await settle(p);
      /* 比べる相手：失敗の無い、はじめての保存と、その直し */
      await pick(p, 'peer_support', 'internal');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      const h1 = await headOf(p);
      await seeMine(p, 'benefits');
      await pick(p, 'peer_support', 'external');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      const h2 = await headOf(p);
      ok(h1 === '情報を追加しました' && h2 === '情報を更新しました',
        '（比べる相手）失敗の無い回は今までどおり ── はじめての答えは「情報を追加しました」・直した回は「情報を更新しました」', J({ h1, h2 }));
      /* 返事だけが届かない → 「送れていません」→「もう一度送る」 */
      await seeMine(p, 'benefits');
      await pick(p, 'landing_pay', 'no');
      await tick(p);
      const lost = await lostReply(p, 'submit_airline_conditions');
      await waitMsg(p, 'fail');
      const said = (await msg(p, 'fail')) || '', db1 = (await ownConds('cathay-pacific', CARD)).filter((x) => x.q === 'landing_pay');
      if (!lost || !lost.ok || (lost.rejected || []).length || !/送れていません/.test(said) || !(await outboxOf(p)) || J(db1) !== J([{ q: 'landing_pay', c: 'no' }])) {
        throw new Error('前提が崩れた（サーバには保存されたのに、ページには「送れていません」と出ている形になっていない）: ' + J({ lost, said: said.slice(0, 12), db1 }));
      }
      await p.page.click('.pvc-root [data-pvc-act="retry"]');
      await waitView(p, 'saved');
      const sm = await summary(p), db2 = (await ownConds('cathay-pacific', CARD)).filter((x) => x.q === 'landing_pay');
      ok(sm.head === '保存しました' && J(db2) === J([{ q: 'landing_pay', c: 'no' }]) && (await outboxOf(p)) === null && !!sm.rows.landing_pay && sm.rows.landing_pay.v === 'ない',
        '★返事だけが届かなかった回を「もう一度送る」で送り直すと、見出しは「保存しました」（増えたとも直したとも言い切らない）。保存先はその答えが1行・端末の控えは消える', J({ head: sm.head, db2 }));
    } finally {
      cutHeld(p);
      await p.st.ctx.close();
    }
  });

  await scene('返事が届かなかった回を送り直す（ログインなし）── 見出しは「保存しました」', async () => {
    const p = await open('phone');
    try {
      await go(p, CX);
      await api(p, 'benefits');
      await waitView(p, 'benefits');
      await settle(p);
      await pick(p, 'landing_pay', 'no');
      await tick(p);
      const lost = await lostReply(p, 'submit_contrib_anon');
      await waitMsg(p, 'fail');
      const said = (await msg(p, 'fail')) || '', key0 = await p.page.evaluate(() => localStorage.getItem('pv_contrib_key'));
      if (!lost || !lost.ok || !lost.key || key0 || !/送れていません/.test(said) || !(await outboxOf(p))) {
        throw new Error('前提が崩れた（サーバは預かって鍵まで返したのに、ページには届いていない形になっていない）: ' + J({ ok: lost && lost.ok, key: !!(lost && lost.key), key0, said: said.slice(0, 12) }));
      }
      await p.page.click('.pvc-root [data-pvc-act="retry"]');
      await waitView(p, 'saved');
      const h0 = await headOf(p);
      ok(h0 === '保存しました' && (await outboxOf(p)) === null,
        '★ログインなしでも、返事だけが届かなかった回を送り直した見出しは「保存しました」（会員と同じ言い方）', J({ h0 }));
      /* 比べる相手：そのあとの、失敗の無い回は今までどおり（「分からない」が次の回に残らない） */
      await seeMine(p, 'benefits');
      await pick(p, 'peer_support', 'internal');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      const h1 = await headOf(p);
      await seeMine(p, 'benefits');
      await pick(p, 'peer_support', 'external');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      const h2 = await headOf(p);
      ok(h1 === '情報を追加しました' && h2 === '情報を更新しました',
        '（比べる相手）送り直したあとの、失敗の無い回は今までどおり ── 新しい答えは「情報を追加しました」・直した回は「情報を更新しました」', J({ h1, h2 }));
    } finally {
      cutHeld(p);
      await p.st.ctx.close();
    }
  });

  await scene('返事が届かなかった回を送り直す（月の勤務）── 見出しは「保存しました」', async () => {
    await bare('cathay-pacific', CARD);
    const p = await open('phone', { who: 'c' });
    try {
      await go(p, CX);
      await api(p, 'work');
      await waitView(p, 'work');
      await settle(p);
      const months = await p.page.$$eval('.pvc-root select[name="ym"] option', (os) => os.map((o) => o.value).filter((v) => /^\d{4}-\d{2}$/.test(v)));
      const mA = await p.page.$eval('.pvc-root select[name="ym"]', (n) => n.value), [mB, mC] = months.filter((m) => m !== mA);
      if (!mA || !mB || !mC) throw new Error('前提が崩れた（選べる月が3つ無い）: ' + J(months));
      await pick(p, 'position', 'fo');
      await fill(p, 'block_hours', '61');
      await tick(p);
      const lost = await lostReply(p, 'submit_work_month');
      await waitMsg(p, 'fail');
      const said = (await msg(p, 'fail')) || '', db1 = await ownMonths('cathay-pacific', CARD);
      if (!lost || !lost.ok || lost.replaced !== false || !/送れていません/.test(said) || !(await outboxOf(p)) || J(db1) !== J([{ ym: mA, block: 61 }])) {
        throw new Error('前提が崩れた（はじめての月がサーバには保存されたのに、ページには「送れていません」と出ている形になっていない）: ' + J({ lost, said: said.slice(0, 12), db1 }));
      }
      await p.page.click('.pvc-root [data-pvc-act="retry"]');
      await waitView(p, 'saved');
      const h0 = await headOf(p), db2 = await ownMonths('cathay-pacific', CARD);
      ok(h0 === '保存しました' && J(db2) === J([{ ym: mA, block: 61 }]) && (await outboxOf(p)) === null,
        '★月の勤務でも、返事だけが届かなかった回を送り直した見出しは「保存しました」（はじめての月を「更新しました」と言わない）。保存先はその月が1行', J({ h0, db2 }));
      /* 比べる相手：そのあとの、失敗の無い回は今までどおり */
      await seeMine(p, 'work');
      await fill(p, 'block_hours', '62');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      const h1 = await headOf(p);
      await seeMine(p, 'work');
      await pick(p, 'ym', mB);
      await waitView(p, 'work');
      await settle(p);
      await pick(p, 'position', 'fo');
      await fill(p, 'block_hours', '50');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      const h2 = await headOf(p);
      ok(h1 === '情報を更新しました' && h2 === '情報を追加しました',
        '（比べる相手）送り直したあとの、失敗の無い回は今までどおり ── 同じ月を直した回は「情報を更新しました」・ほかの月のはじめての保存は「情報を追加しました」', J({ h1, h2 }));
      /* ほかの月の送れなかった1件が端末に残っているだけの回（その月は送り直していない）── 見出しは、サーバの答えのまま */
      await seeMine(p, 'work');
      await fill(p, 'block_hours', '51');
      await tick(p);
      await failNext('submit_work_month', 'drop', 9);
      await send(p);
      await waitMsg(p, 'fail');
      await failOff();
      const ob = JSON.parse((await outboxOf(p)) || 'null');
      await pick(p, 'ym', mC);
      await waitView(p, 'work');
      await settle(p);
      await pick(p, 'position', 'fo');
      await fill(p, 'block_hours', '40');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      const h3 = await headOf(p), db3 = await ownMonths('cathay-pacific', CARD);
      if (!ob || ob.topic !== 'work' || !ob.draft || ob.draft.ym !== mB) throw new Error('前提が崩れた（ほかの月の送れなかった1件が、端末に残っている形になっていない）: ' + J(ob).slice(0, 160));
      ok(h3 === '情報を追加しました' && db3.some((x) => x.ym === mC && x.block === 40) && db3.some((x) => x.ym === mB && x.block === 50),
        '★ほかの月の送れなかった1件が残っているだけの回は、見出しを変えない ── はじめての月は「情報を追加しました」（送れなかった月は、保存先では元のまま）', J({ h3, db3 }));
    } finally {
      await failOff();
      cutHeld(p);
      await p.st.ctx.close();
    }
  });

  await scene('送れなかった1件を破棄したあと・ほかの項目の1件が残っている時 ── 見出しは今までどおり', async () => {
    await bare('cathay-pacific', CARD);
    const p = await open('phone', { who: 'c' });
    try {
      await go(p, CX);
      await api(p, 'list');
      await waitView(p, 'list');
      await p.page.click('.pvc-root [data-pvc-tile="benefits"]');
      await waitView(p, 'benefits');
      await settle(p);
      /* 送れない（サーバへ届く前に切れる ＝ 保存されていない）→「破棄する」→ あらためて送る */
      await pick(p, 'sick_leave', 'unlimited');
      await tick(p);
      await failNext('submit_airline_conditions', 'drop', 9);
      await send(p);
      await waitMsg(p, 'fail');
      await failOff();
      await p.page.click('.pvc-root .pvc-msg[data-pvc-msg="fail"] [data-pvc-act="drop"]');
      await p.page.waitForFunction(() => !document.querySelector('.pvc-root .pvc-msg[data-pvc-msg="fail"]'));
      await waitView(p, 'benefits');
      const ob0 = await outboxOf(p);
      await pick(p, 'sick_leave', 'none');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      const h1 = await headOf(p);
      ok(ob0 === null && h1 === '情報を追加しました',
        '★送れなかった1件を「破棄する」で捨てたあとの回は、送り直しではない ── はじめての答えは「情報を追加しました」', J({ ob0, h1 }));
      /* この項目で送れなかった1件を残したまま、ほかの項目を送る */
      await seeMine(p, 'benefits');
      await pick(p, 'peer_support', 'both');
      await tick(p);
      await failNext('submit_airline_conditions', 'drop', 9);
      await send(p);
      await waitMsg(p, 'fail');
      await failOff();
      await p.page.click('.pvc-root .pvc-prev');
      await waitView(p, 'list');
      await waitMsg(p, 'unsent');
      await p.page.click('.pvc-root [data-pvc-tile="taxi"]');
      await waitView(p, 'taxi');
      await settle(p);
      await pick(p, 'commuting_transport', 'no');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      const h2 = await headOf(p), ob2 = JSON.parse((await outboxOf(p)) || 'null');
      ok(h2 === '情報を追加しました' && !!ob2 && ob2.topic === 'benefits',
        '★ほかの項目の送れなかった1件が残っているだけの回は、見出しを変えない（残っている1件も消さない）', J({ h2, left: ob2 && ob2.topic }));
    } finally {
      await failOff();
      await p.st.ctx.close();
    }
  });

  /* ── 通貨の切替 ──
     サイトの通貨をほかの通貨にしている人には、ページの円の額が書き換わる（currency.js が文字を走査する）。
     保存後のカードは「あなたが保存した内容」＝ 打ったとおりに出す。直す前は、補足に書いた「¥1,500」が「$9」になり、
     すぐ上の額の行は「JPY 1,500」のまま ＝ 自分の答えが、打った字と違う通貨で返ってきていた。
     通貨は、サイト自身の切替（PVCurrency.set）で選ぶ ＝ 保存先の鍵をこちらで決め打ちしない。
     面の外に円の1行を置いて、それが書き換わるのを待ってからカードを読む（＝ カードを置いたあとに走査が1回は走った）。 */
  const NOTE_YEN = '着陸1回 ¥1,500・月に2万円ほど', WORK_YEN = '深夜の手当は1回 ¥1,500';
  const SYMBOL = { USD: '$', EUR: '€' };
  const withCurrency = async (p, urlPath, cur) => {
    await go(p, urlPath);
    await p.page.waitForFunction(() => !!(window.PVCurrency && window.PVCurrency.set));
    await p.page.evaluate((c) => window.PVCurrency.set(c), cur);
    await go(p, urlPath);                                    // 開き直す（保存された選択が、開いた時から効いている形にする）
    await p.page.waitForFunction(() => !!(window.PVCurrency && window.PVCurrency.get));
  };
  /* 面の外に置いた円の1行が、走査されるまで待つ。返すのは、その1行の字・ページのほかの額で書き換わっている数・カードの中で書き換えの印が付いた数 */
  const scanned = async (p) => {
    await p.page.evaluate(() => {
      const n = document.createElement('p');
      n.setAttribute('data-test-yen', ''); n.textContent = '¥1,500';
      n.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none';
      document.body.appendChild(n);
    });
    const done = await seen(p, () => !!document.querySelector('[data-test-yen] .pv-cur'));
    return p.page.evaluate((d) => ({
      done: d, now: window.PVCurrency.get(), probe: document.querySelector('[data-test-yen]').textContent,
      page: [...document.querySelectorAll('span.pv-cur[data-cur-on]')].filter((n) => !n.closest('.pvc-root') && !n.closest('[data-test-yen]')).length,
      card: document.querySelectorAll('.pvc-root .pvc-saved .pv-cur').length,
    }), done);
  };
  for (const cur of ['USD', 'EUR']) {
    await scene(`保存後のカード ── サイトの通貨が ${cur} でも、打った額と補足をそのまま出す`, async () => {
      const p = await open('phone');
      try {
        await withCurrency(p, CX, cur);
        await api(p, 'benefits');
        await waitView(p, 'benefits');
        await settle(p);
        await pick(p, 'landing_pay', 'fixed');
        await pick(p, 'landing_pay_amount_cur', 'JPY');
        await fill(p, 'landing_pay_amount', '1500');
        await p.page.click('.pvc-root [data-q-more="landing_pay_amount"]');
        await fill(p, 'landing_pay_amount_note', NOTE_YEN);
        await tick(p);
        await send(p);
        await waitView(p, 'saved');
        const sc = await scanned(p), sm = await summary(p);
        ok(sc.done && sc.now === cur && sc.probe !== '¥1,500' && sc.probe.includes(SYMBOL[cur]) && sc.page > 0,
          `（比べる相手）${cur} を選んでいる時、面の外の円の額は書き換わっている（切替が本当に効いている）`, J(sc));
        ok(!!sm.rows.landing_pay_amount && sm.rows.landing_pay_amount.v === 'JPY 1,500（1回あたり）'
          && !!sm.rows.landing_pay_amount_note && sm.rows.landing_pay_amount_note.v === NOTE_YEN && sc.card === 0,
          `★${cur} を選んでいても、保存後のカードは、打った額（JPY 1,500）と補足（「¥1,500」「2万円」）を打ったとおりに出す（書き換えの印が1つも付かない）`,
          J({ amount: sm.rows.landing_pay_amount, note: sm.rows.landing_pay_amount_note, card: sc.card }));
        if (cur !== 'USD') return;
        /* 月の勤務のカードも同じ行の作り ── 「ほかに伝えたいこと」に書いた円の額 */
        await p.page.click('.pvc-root [data-pvc-act="more"]');
        await waitView(p, 'list');
        await p.page.click('.pvc-root [data-pvc-tile="work"]');
        await waitView(p, 'work');
        await settle(p);
        await pick(p, 'position', 'fo');
        await fill(p, 'block_hours', '61');
        await fill(p, 'note', WORK_YEN);
        await tick(p);
        await send(p);
        await waitView(p, 'saved');
        await p.page.evaluate(() => { const n = document.querySelector('[data-test-yen]'); if (n) n.remove(); });
        const sc2 = await scanned(p), sm2 = await summary(p);
        ok(sc2.done && sc2.probe !== '¥1,500' && !!sm2.rows.note && sm2.rows.note.v === WORK_YEN && sc2.card === 0,
          `★月の勤務のカードも同じ ── 「ほかに伝えたいこと」に書いた「¥1,500」を、${cur} を選んでいても打ったとおりに出す`, J({ note: sm2.rows.note, sc2 }));
      } finally {
        await p.st.ctx.close();
      }
    });
  }

  /* ── 背の低い画面 ──
     保存後のカードのすき間を詰める規則は、幅（340pxまで）だけで決まっていた。幅が341px以上で背の低い画面
     （幅375×高さ548 ＝ ブラウザのバーを引いた小さい iPhone・幅360×高さ540）は広いすき間のままで、ログインなしで
     保存した直後（断りの箱が在る、いちばん高いカード）に、2つ目のボタンの下が最初の1画面の外へ切れていた
     （375×548 で 2px・360×540 で 10px・341×540 で 31px）。
     決まり：高さ600px未満の、下から出る面では、幅340pxまでと同じだけ詰める。高さ600px以上と、右から出る面
             （幅768px以上）は今までどおり。字の大きさ・ボタンの高さは変えない・何も隠さない。 */
  const openAt = async (w, h, o) => {
    const p = await open('small', o);
    await p.page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    return p;
  };
  /* エバー航空の月の勤務を1か月保存して、保存後のカードを出す（月が2けたの回 ＝ 会社名と月の行が折り返して、いちばん高い） */
  const saveMonth = async (s, block) => {
    await go(s, EVA);
    await api(s, 'work');
    await waitView(s, 'work');
    await settle(s);
    const wide = await s.page.$eval('.pvc-root select[name="ym"]', (n) => ([...n.options].find((x) => /-1[0-2]$/.test(x.value)) || {}).value || '');
    if (wide) { await pick(s, 'ym', wide); await waitView(s, 'work'); await settle(s); }
    await pick(s, 'position', 'fo');
    await fill(s, 'block_hours', String(block));
    await tick(s);
    await send(s);
    await waitView(s, 'saved');
    return wide || '（既定の月）';
  };
  /* カードの中の、詰める対象のすき間（会社と月の行の上・断りの箱の上と内側・箱の中の行とボタンの上・2つのボタンの上とあいだ） */
  const gapsOf = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), cs = (sel, k) => { const n = r.querySelector(sel); return n ? getComputedStyle(n)[k] : '無い'; };
    return [cs('.pvc-saved-s', 'marginTop'), cs('.pvc-saved-s', 'rowGap'), cs('.pvc-saved .pvc-held', 'marginTop'), cs('.pvc-saved .pvc-held', 'paddingTop'),
      cs('.pvc-saved .pvc-held-d', 'marginTop'), cs('.pvc-saved .pvc-held .pvc-ghost', 'marginTop'), cs('.pvc-saved-a', 'marginTop'), cs('.pvc-saved-a', 'rowGap')].join(' ');
  });
  const sizeTo = async (p, w, h) => {
    await p.page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await p.page.waitForFunction((a, b) => window.innerWidth === a && window.innerHeight === b, {}, w, h);
    return gapsOf(p);
  };
  await scene('保存後のカード ── 背の低い画面（360×540・375×548・341×540）でも、2つのボタンに届く', async () => {
    await bare('eva-air', CARD);
    let n = 0;
    for (const [w, h] of [[360, 540], [375, 548], [341, 540]]) {
      for (const who of [null, 'c']) {
        const s = await openAt(w, h, who ? { who } : {});
        try {
          const ym = await saveMonth(s, 61 + (n++));
          const head = await headOf(s), reach = await reachOf(s);
          const vp = await s.page.evaluate(() => [window.innerWidth, window.innerHeight]);
          if (J(vp) !== J([w, h]) || !/^情報を(追加|更新)しました$/.test(head) || !!reach.held !== !who) {
            throw new Error('前提が崩れた（その大きさで保存でき、ログインなしの回にだけ断りの箱が出た形になっていない）: ' + J({ vp, head, held: reach.held }));
          }
          ok(reached(reach),
            `★${w}×${h}・${who ? '会員' : 'ログインなしで保存した直後（断りの箱が在る回）'}：スクロールしなくても「自分の回答を見る」「もう1項目を答える」の両方に届く（どちらも高さ 44px 以上）`, J({ ym, reach }));
        } finally {
          await s.st.ctx.close();
        }
      }
    }
    /* どこまで詰めるか（同じ1枚のカードで、画面の大きさだけを変えて、すき間を読む） */
    const s = await openAt(375, 599);
    try {
      await saveMonth(s, 70);
      const at599 = await gapsOf(s);
      /* narrow は 320×640 で読む ＝ 高さ600px以上なので、幅340pxまでの規則だけが当たる。
         320×568 で読むと背の低い画面の規則も当たって後勝ちになり、新しい規則を新しい規則と比べるだけになる
         （2つの規則の中身がずれても緑のまま）。 */
      const narrow = await sizeTo(s, 320, 640), normal = await sizeTo(s, 390, 844), at600 = await sizeTo(s, 375, 600);
      const wideShort = await sizeTo(s, 768, 560), wideTall = await sizeTo(s, 768, 950);
      if (narrow === normal || /無い/.test(narrow + normal)) throw new Error('前提が崩れた（幅340pxまでの詰めたすき間と、ふつうのすき間を読み分けられていない）: ' + J({ narrow, normal }));
      ok(at599 === narrow, '★高さ599pxの画面（幅375px）のすき間は、幅340pxまでの画面と同じだけ詰まっている', J({ at599, narrow }));
      ok(at600 === normal, '★高さ600px以上の画面は、今までどおりのすき間（375×600 が 390×844 と同じ）', J({ at600, normal }));
      ok(wideShort === wideTall && wideShort === normal, '★右から出る面（幅768px以上）は、背が低くても今までどおりのすき間（768×560 が 768×950 と同じ）', J({ wideShort, wideTall, normal }));
    } finally {
      await s.st.ctx.close();
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 15. 質問の入力が断る時（低いほう・高いほうの対／断った欄を見せる／送れなかった1件の片づけ／親の条件を引き継ぐ）
  // ═════════════════════════════════════════════════════════════
  /* ⚠️ ここで入れる額は検査のための作りもの。どの会社の着陸手当でもない。 */
  const ORDER = '低いほうの額が、高いほうの額より大きくなっています。', CURR = '低いほうと高いほうは、同じ通貨で入れてください。';
  const ETI = '/airlines/etihad.html';
  /* 送るボタンを押したあと、結果が出るまで待つ：保存後のカードか、入力の知らせ（送っている最中は待つ）。
     断りは押した一息の中で出るので、すぐ返る。出なかった時は、そのまま先へ進んで下の行を赤くする。 */
  const sentOut = (p) => seen(p, () => {
    const r = document.querySelector('.pvc-root'), f = r && r.querySelector('form[data-pvc-form]');
    if (r && r.querySelector('[data-pvc-saved]')) return true;
    const b = f && f.querySelector('.pvc-send[type="submit"]');
    return !!b && !/送っています/.test(b.textContent) && !!f.querySelector('.pvc-msg');
  });
  /* いま出ている結果：保存後のカードか・どの知らせか・焦点の在る欄の名前 */
  const faceOf = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), f = r.querySelector('form[data-pvc-form]'), a = document.activeElement;
    const m = (k) => { const n = r.querySelector('.pvc-msg[data-pvc-msg="' + k + '"]'); return n ? n.innerText : ''; };
    return { saved: !!r.querySelector('[data-pvc-saved]'), said: m('said'), rej: m('rej'), same: m('same'), fail: m('fail'),
      at: (a && f && f.contains(a) && a.getAttribute('name')) || '' };
  });
  const pressOut = async (p) => { await send(p); await sentOut(p); return faceOf(p); };
  /* 数の質問の「わからない」を、入れる（on）・外す（off）。もうその形なら押さない */
  const unkOf = async (p, id, on) => {
    const h = await p.page.$(`.pvc-root input[name="${id}_unk"]`);
    if ((await h.evaluate((n) => n.checked)) === on) return;
    const lab = await h.evaluateHandle((n) => n.closest('label'));
    await lab.click();
  };
  /* 低いほう・高いほうの、保存先の行（会員 ＝ 本人の印で引く／ログインなし ＝ その会社の預かり） */
  const pairOf = async (slug, m) => (await q(
    `select question_id as q, answer_num::float8 as num, answer_currency as cur, answer_code as c from public.airline_conditions
      where airline = $2::text and proof_hash = public.pv_condition_hash($1::uuid, $2::text, null)
        and question_id in ('landing_pay_from', 'landing_pay_to') order by 1`, [m.id, slug])).rows;
  const pairHeld = async (slug) => (await q(
    `select item_key as q, (payload->>'num')::float8 as num, payload->>'currency' as cur, payload->>'code' as c from public.pv_contrib_pending
      where airline = $1 and item_key in ('landing_pay_from', 'landing_pay_to') order by item_key`, [slug])).rows;
  const openForm = async (p, urlPath, topic) => { await go(p, urlPath + '?add=' + topic); await waitView(p, topic); await settle(p); };

  /* ── 低いほう・高いほうの対 ──
     「あり・一定額ではない」の2つの額は、対（台帳の rangeLow）。低いほうが高いほうより大きい対・通貨の違う対は、
     保存する前に入力が止める（サーバも同じ決まりで断る ＝ 止めたのが入力かどうかは「通信が出ていない」ことでしか分からない）。
     比べるのは、2つの端が「この送信のあと」に持つ額 ── 触っていない端は、保存してある額。 */
  for (const who of ['c', null]) {
    await scene(`低いほう・高いほうの対 ── 食い違う対は、送る前に止める（${who ? '会員' : 'ログインなし'}）`, async () => {
      if (who) await bare('etihad', CARD);
      const fn = who ? 'submit_airline_conditions' : 'submit_contrib_anon';
      const held0 = who ? 0 : (await pairHeld('etihad')).length;
      const stored = async () => (who ? pairOf('etihad', CARD) : (await pairHeld('etihad')).slice(held0));
      const p = await open('phone', who ? { who } : {});
      try {
        await openForm(p, ETI, 'benefits');
        /* s1：低い 300・高い 200（同じ通貨） */
        await pick(p, 'landing_pay', 'variable');
        await fill(p, 'landing_pay_from', '300');
        await pick(p, 'landing_pay_from_cur', 'USD');
        await fill(p, 'landing_pay_to', '200');
        await tick(p);
        let h0 = hits(p, fn);
        let f1 = await pressOut(p);
        ok(f1.said.includes(ORDER) && /保存できませんでした/.test(f1.said) && f1.at === 'landing_pay_to',
          '★s1 低いほう 300・高いほう 200 を送ると、「低いほうの額が、高いほうの額より大きくなっています。」と断り、高いほうの額の欄へ移る', J(f1));
        ok(hits(p, fn) === h0 && (await stored()).length === 0, '★s1 その回は、サーバへ1本も投げていない（どちらの端も保存されていない）', J({ sent: hits(p, fn) - h0, rows: await stored() }));
        /* s2：低い 100 USD・高い 200 EUR */
        await fill(p, 'landing_pay_from', '100');
        await pick(p, 'landing_pay_to_cur', 'EUR');
        h0 = hits(p, fn);
        f1 = await pressOut(p);
        ok(f1.said.includes(CURR) && !f1.said.includes(ORDER) && f1.at === 'landing_pay_to_cur',
          '★s2 低いほう USD・高いほう EUR を送ると、「低いほうと高いほうは、同じ通貨で入れてください。」と断り、高いほうの通貨の欄へ移る', J(f1));
        ok(hits(p, fn) === h0 && (await stored()).length === 0, '★s2 その回も、サーバへ1本も投げていない', J({ sent: hits(p, fn) - h0, rows: await stored() }));
        /* s2 の続き：通貨も大小も食い違う対（300 USD・200 EUR）は、通貨の文で断る（通貨が先） */
        await fill(p, 'landing_pay_from', '300');
        h0 = hits(p, fn);
        f1 = await pressOut(p);
        ok(f1.said.includes(CURR) && !f1.said.includes(ORDER) && f1.at === 'landing_pay_to_cur' && hits(p, fn) === h0,
          '★s2 通貨も大小も食い違う対（300 USD・200 EUR）は、通貨の文で断る（通貨を先に見る）', J(f1));
        /* s3：直す（100・200 USD） */
        await fill(p, 'landing_pay_from', '100');
        await pick(p, 'landing_pay_to_cur', 'USD');
        h0 = hits(p, fn);
        f1 = await pressOut(p);
        let rows = await stored();
        ok(f1.saved && hits(p, fn) === h0 + 1 && J(rows) === J([{ q: 'landing_pay_from', num: 100, cur: 'USD', c: null }, { q: 'landing_pay_to', num: 200, cur: 'USD', c: null }]),
          '★s3 100・200（どちらも USD）に直して送ると、2つとも保存される', J({ f1, rows }));
        if (!who) return;

        /* s4：保存してある 100／200 のまま、低いほうだけを 250 に（高いほうには触らない） */
        await openForm(p, ETI, 'benefits');
        let v = await vals(p);
        if (v.landing_pay_from !== '100' || v.landing_pay_to !== '200') throw new Error('前提が崩れた（開き直した入力に、保存した 100／200 が入っていない）: ' + J(v));
        await fill(p, 'landing_pay_from', '250');
        await tick(p);
        h0 = hits(p, fn);
        f1 = await pressOut(p);
        rows = await stored();
        ok(f1.said.includes(ORDER) && f1.at === 'landing_pay_to', '★s4 保存してある 100／200 の、低いほうだけを 250 に直して送ると、同じ文で断る（触っていない高いほうは、保存してある 200）', J(f1));
        ok(hits(p, fn) === h0 && rows[0].num === 100 && rows[1].num === 200, '★s4 その回は、サーバへ1本も投げていない（保存先の低いほうは 100 のまま）', J({ sent: hits(p, fn) - h0, rows }));
        /* 断りは、対のどちらの端を直しても消える（高いほうへ焦点を移したが、直すのは打ち間違えた低いほうのことが多い） */
        await fill(p, 'landing_pay_from', '150');
        const f1b = await faceOf(p);
        ok(f1.said.includes(ORDER) && f1b.said === '' && f1b.rej === '', '★その断りは、対のもう一方の端（低いほう）を直しても消える', J({ before: f1.said, after: f1b }));
        /* s4b：高いほうだけを 50 に（低いほうには触らない） */
        await openForm(p, ETI, 'benefits');
        await fill(p, 'landing_pay_to', '50');
        await tick(p);
        h0 = hits(p, fn);
        f1 = await pressOut(p);
        rows = await stored();
        ok(f1.said.includes(ORDER) && f1.at === 'landing_pay_to' && hits(p, fn) === h0 && rows[0].num === 100 && rows[1].num === 200,
          '★s4b 高いほうだけを 50 に直して送っても、同じ文で断る（サーバへ1本も投げていない・保存先は 100／200 のまま）', J({ f1, sent: hits(p, fn) - h0, rows }));
        /* s5：2つとも打ち直す（300／400）── 比べる相手は、保存してある端ではなく、いま打った端 */
        await openForm(p, ETI, 'benefits');
        await fill(p, 'landing_pay_from', '300');
        await fill(p, 'landing_pay_to', '400');
        await tick(p);
        f1 = await pressOut(p);
        rows = await stored();
        ok(f1.saved && rows[0].num === 300 && rows[1].num === 400, '★s5 保存してある 100／200 を 300／400 に打ち直すと、2つとも保存される（打った低いほうを、保存してある高いほうと比べない）', J({ f1, rows }));
        /* s7：200／1000（字で比べると "200" のほうが大きい） */
        await openForm(p, ETI, 'benefits');
        await fill(p, 'landing_pay_from', '200');
        await fill(p, 'landing_pay_to', '1000');
        await tick(p);
        f1 = await pressOut(p);
        rows = await stored();
        ok(f1.saved && rows[0].num === 200 && rows[1].num === 1000, '★s7 200／1000 は保存される（数として比べている。字で比べると "200" のほうが大きい）', J({ f1, rows }));
        /* 同じ額は通す（断るのは、低いほうが「より大きい」時だけ） */
        await openForm(p, ETI, 'benefits');
        await fill(p, 'landing_pay_from', '1000');
        await tick(p);
        f1 = await pressOut(p);
        rows = await stored();
        ok(f1.saved && rows[0].num === 1000 && rows[1].num === 1000, '★同じ額（1000／1000）は保存される', J({ f1, rows }));
        /* s6：片方が「わからない」── 低いほうが「わからない」・高いほう 200 */
        await openForm(p, ETI, 'benefits');
        await unkOf(p, 'landing_pay_from', true);
        await fill(p, 'landing_pay_to', '200');
        await tick(p);
        f1 = await pressOut(p);
        rows = await stored();
        ok(f1.saved && rows[0].c === 'unknown' && rows[0].num === null && rows[1].num === 200, '★s6 低いほうが「わからない」・高いほうが 200 は、保存される', J({ f1, rows }));
        /* s6：低いほう 300・高いほうが「わからない」（「わからない」を 0 と読むと、300 > 0 で断ってしまう） */
        await openForm(p, ETI, 'benefits');
        await unkOf(p, 'landing_pay_from', false);
        await fill(p, 'landing_pay_from', '300');
        await pick(p, 'landing_pay_from_cur', 'USD');
        await unkOf(p, 'landing_pay_to', true);
        await tick(p);
        f1 = await pressOut(p);
        rows = await stored();
        ok(f1.saved && rows[0].num === 300 && rows[1].c === 'unknown' && rows[1].num === null, '★s6 低いほうが 300・高いほうが「わからない」も、保存される（「わからない」は 0 ではない）', J({ f1, rows }));

        /* s8：入力の確かめは通るが、サーバが断る回（入力を描いたあとで、保存先の高いほうが替わっていた）。
           サーバの理由（range_order）が、同じ文で本人に届く。 */
        await openForm(p, ETI, 'benefits');
        await unkOf(p, 'landing_pay_to', false);
        await fill(p, 'landing_pay_from', '100');
        await fill(p, 'landing_pay_to', '200');
        await pick(p, 'landing_pay_to_cur', 'USD');
        await tick(p);
        f1 = await pressOut(p);
        rows = await stored();
        if (!f1.saved || rows[0].num !== 100 || rows[1].num !== 200 || rows[0].cur !== 'USD' || rows[1].cur !== 'USD') throw new Error('前提が崩れた（100／200 USD を保存できていない）: ' + J({ f1, rows }));
        await openForm(p, ETI, 'benefits');
        await q(`update public.airline_conditions set answer_num = 120 where airline = 'etihad' and question_id = 'landing_pay_to'
                  and proof_hash = public.pv_condition_hash($1::uuid, 'etihad', null)`, [CARD.id]);
        await fill(p, 'landing_pay_from', '150');
        await tick(p);
        h0 = hits(p, fn);
        f1 = await pressOut(p);
        rows = await stored();
        const lowName = JSON.parse(read('pv-conditions.json')).questions.find((x) => x.id === 'landing_pay_from').ja.label;
        ok(hits(p, fn) === h0 + 1 && !f1.saved && f1.rej.includes('「' + lowName + '」：' + ORDER) && !/保存できませんでした。/.test(f1.rej) && rows[0].num === 100,
          '★s8 入力の確かめを通ってサーバが断った回も、同じ文で伝える（「保存できませんでした。」だけにしない。保存先の低いほうは 100 のまま）', J({ sent: hits(p, fn) - h0, f1, rows }));

        /* 出ていない端は比べない：上の質問を「一定額」に答え直すと、低いほう・高いほうは出なくなる。
           打ちかけの額（500 ＝ 保存してある高いほう 120 より大きい）が残っていても、上の質問の答えは保存される。 */
        await openForm(p, ETI, 'benefits');
        await fill(p, 'landing_pay_from', '500');
        await pick(p, 'landing_pay', 'fixed');
        await tick(p);
        h0 = hits(p, fn);
        f1 = await pressOut(p);
        rows = await stored();
        ok(f1.saved && hits(p, fn) === h0 + 1 && rows[0].num === 100 && rows[1].num === 120,
          '★上の質問を答え直して出なくなった対は、比べない（打ちかけの額が残っていても、上の答えは保存される。対の行は動かない）', J({ f1, sent: hits(p, fn) - h0, rows }));
      } finally {
        await p.st.ctx.close();
      }
    });
  }

  /* ── 断った欄を見せる・直したら断りを消す（390×680）──
     断りの知らせは入力のいちばん下に出る。名指しした欄は、長い項目ではずっと上 ＝ 焦点だけ移しても画面の外。
     決まり：名指しした欄を、面の見えている高さのまんなかへ送る（動かすのは面の中だけ）。その欄に値が入ったら、断りを消す
             （消すのは、その断りだけ。あとから出た別の断りは消さない）。 */
  /* その欄と知らせが、面の見えている範囲に在るか（mid ＝ 欄のまんなかと、見えている高さのまんなかの差） */
  const fieldSpot = (p, name) => p.page.evaluate((nm) => {
    const r = document.querySelector('.pvc-root'), main = r.querySelector('.pvc-main'), m = main.getBoundingClientRect();
    const c = r.querySelector('form[data-pvc-form] [name="' + nm + '"]'), b = c.getBoundingClientRect();
    const n = r.querySelector('form[data-pvc-form] .pvc-msg'), nb = n ? n.getBoundingClientRect() : null;
    const inside = (x) => !!x && x.height > 0 && x.top >= m.top - 0.5 && x.bottom <= m.bottom + 0.5;
    return { field: inside(b), mid: Math.round((b.top + b.height / 2) - (m.top + m.height / 2)), note: inside(nb),
      noteTop: nb ? Math.round(nb.top - m.top) : null, h: Math.round(m.height), scroll: Math.round(main.scrollTop), pageY: Math.round(window.scrollY) };
  }, name);
  await scene('断った欄を見せる ── 欄は面の見えている所へ・値を入れたら断りが消える（390×680・ログインなし）', async () => {
    const p = await open('phone');
    const where = (name) => fieldSpot(p, name);
    try {
      /* 一覧から開く（あとで、一覧へ戻ってもう一度開く） */
      await go(p, EVA + '?add=list');
      await waitView(p, 'list');
      await p.page.click('.pvc-root [data-pvc-tile="benefits"]');
      await waitView(p, 'benefits');
      await settle(p);
      const y0 = await p.page.evaluate(() => Math.round(window.scrollY));
      /* 断りを2つ仕込む：額に通貨が無い（上のほうの質問）・補足だけ書いて答えを選んでいない（いちばん下の質問） */
      await pick(p, 'landing_pay', 'fixed');
      await fill(p, 'landing_pay_amount', '1500');
      await fill(p, 'ground_duty_pay_note', '試験：補足だけ');          // この質問の補足の欄は、はじめから開いている
      await tick(p);
      const h0 = hits(p, 'submit_contrib_anon');
      let f1 = await pressOut(p);
      const w1 = await where('landing_pay_amount_cur');
      if (!/通貨を選んでください/.test(f1.said) || f1.at !== 'landing_pay_amount_cur' || w1.noteTop === null) throw new Error('前提が崩れた（通貨の無い額を、通貨の欄を名指しして断っていない）: ' + J({ f1, w1 }));
      ok(w1.field && Math.abs(w1.mid) <= 2 && w1.pageY === y0,
        '★v1 断った欄（通貨）が、面の見えている高さのまんなかに出る（うしろのページは動かない）', J(w1));
      /* v2：値を入れるまでは残る・入れたら消える */
      await fill(p, 'annual_leave_days', '20');
      const before = (await faceOf(p)).said;
      await pick(p, 'landing_pay_amount_cur', 'JPY');
      const after = (await faceOf(p)).said;
      ok(/通貨を選んでください/.test(before) && after === '', '★v2 ほかの欄を触っても断りは残り、断った欄に値を入れると消える', J({ before, after }));
      /* v4：続けて別の欄の断り。前の欄をもう一度変えても、新しい断りは消えない */
      f1 = await pressOut(p);
      const w2 = await where('ground_duty_pay');
      const saidY = f1.said;
      await pick(p, 'landing_pay_amount_cur', 'USD');
      const still = (await faceOf(p)).said;
      ok(/補足を残すには/.test(saidY) && f1.at === 'ground_duty_pay' && w2.field && hits(p, 'submit_contrib_anon') === h0,
        '★v4 直して送り直すと、次の断り（別の欄）が出て、その欄が見えている所に出る（まだ1本も投げていない）', J({ saidY, at: f1.at, w2 }));
      ok(/補足を残すには/.test(still), '★v4 前に断られた欄をもう一度変えても、新しい断りは消えない', J({ still }));
      /* 項目を出て戻ると、入力は描き直される（欄は新しい部品になる）。断りは残っていて、戻ったあとに値を入れても消える */
      await p.page.click('.pvc-root .pvc-prev');
      await waitView(p, 'list');
      await p.page.click('.pvc-root [data-pvc-tile="benefits"]');
      await waitView(p, 'benefits');
      await settle(p);
      const back1 = (await faceOf(p)).said, val1 = (await vals(p)).ground_duty_pay;
      await pick(p, 'ground_duty_pay', await p.page.$eval('.pvc-root select[name="ground_duty_pay"]', (n) => [...n.options].map((o) => o.value).filter(Boolean)[0]));
      const gone = (await faceOf(p)).said;
      ok(/補足を残すには/.test(back1) && val1 === '' && gone === '',
        '★v4 項目を出て戻ってきたあと（入力は描き直されている）でも、新しく断られた欄に値を入れると、その断りが消える', J({ back1, val1, gone }));
      /* v3：そのあと送ると保存できる。保存後のカードは、そのまま出ている */
      f1 = await pressOut(p);
      const pop = await popGone(p);
      const sm = await summary(p);
      ok(f1.saved && hits(p, 'submit_contrib_anon') === h0 + 1 && pop.late !== true && /^情報を(追加|更新)しました$/.test(sm.head) && !!sm.rows.landing_pay_amount && !!sm.rows.ground_duty_pay,
        '★v3 断りを直したあとの送信は保存され、保存後のカードがそのまま出ている', J({ f1, head: sm.head, rows: Object.keys(sm.rows) }));
    } finally {
      await p.st.ctx.close();
    }
  });

  /* 畳んである質問（通勤・タクシーの「回数・金額の上限」）。補足だけ書いて畳みを閉じ、答えを選ばずに送ると、
     断りが名指しする欄は畳みの中 ＝ 閉じたままでは、焦点も移せず、見える所へも送れない。 */
  await scene('断った欄が畳みの中に在る時 ── 畳みを開けて、その欄へ移る（390×680・ログインなし）', async () => {
    const p = await open('phone');
    const FOLD = '.pvc-root [data-q-fold="commuting_taxi_cap"] .pvc-fold-b';
    const foldOpen = () => p.page.evaluate(() => {
      const f = document.querySelector('.pvc-root [data-q-fold="commuting_taxi_cap"]');
      return f.querySelector('.pvc-fold-b').getAttribute('aria-expanded') === 'true' && !f.querySelector('.pvc-fold-p').hidden;
    });
    try {
      await openForm(p, EVA, 'taxi');
      await pick(p, 'commuting_transport', 'always');
      await chip(p, 'commuting_transport_method', 'company_taxi');
      await p.page.click(FOLD);
      await fill(p, 'commuting_taxi_cap_note', '試験：上限の補足だけ');
      await p.page.click(FOLD);
      const closed = !(await foldOpen());
      await tick(p);
      const h0 = hits(p, 'submit_contrib_anon');
      const f1 = await pressOut(p);
      if (!closed || !/補足を残すには/.test(f1.said)) throw new Error('前提が崩れた（畳みを閉じたまま、畳みの中の質問を名指しして断った形になっていない）: ' + J({ closed, f1 }));
      const w = await fieldSpot(p, 'commuting_taxi_cap');
      ok((await foldOpen()) && f1.at === 'commuting_taxi_cap' && w.field && hits(p, 'submit_contrib_anon') === h0,
        '★畳んである質問の欄を名指しして断った時は、畳みを開けて、その欄を見えている所に出す（焦点もその欄。何も送っていない）', J({ f1, w }));
    } finally {
      await p.st.ctx.close();
    }
  });

  /* 断りに付けた聞き手が、使われないまま残ることがある（名指しした欄には触らず、ほかの道で通した回）。
     そのあとに出た別の知らせ ── ここでは「送れていません」と「もう一度送る」── を、前に名指しした欄に値が入っただけで消さない。
     聞き手が消してよいのは、付けた時の断りだけ（上の v4 は、聞き手が1度使われて外れたあとを見ている ＝ この見分けは通らない）。 */
  await scene('断った欄に値を入れても、あとから出た別の知らせは消えない ── 「送れていません」は残る（390×680・ログインなし）', async () => {
    const p = await open('phone');
    try {
      await openForm(p, EVA, 'benefits');
      await pick(p, 'landing_pay', 'fixed');
      await fill(p, 'landing_pay_amount', '1500');
      await tick(p);
      const f0 = await pressOut(p);
      if (!/通貨を選んでください/.test(f0.said) || f0.at !== 'landing_pay_amount_cur') throw new Error('前提が崩れた（通貨の欄を名指しして断っていない）: ' + J(f0));
      /* 名指しされた通貨の欄には触らず、額を「わからない」にして送る → 届かない ＝ 知らせが「送れていません」に替わる */
      await unkOf(p, 'landing_pay_amount', true);
      await failNext('submit_contrib_anon', 'drop', 9);
      await send(p);
      await waitMsg(p, 'fail');
      await failOff();
      const before = await faceOf(p);
      await pick(p, 'landing_pay_amount_cur', 'JPY');
      const after = await faceOf(p);
      const retry = !!(await p.page.$('.pvc-root .pvc-msg[data-pvc-msg="fail"] [data-pvc-act="retry"]'));
      ok(/送れていません/.test(before.fail) && before.said === '' && /送れていません/.test(after.fail) && retry,
        '★前に断られた欄（通貨）に値を入れても、あとから出た「送れていません」と「もう一度送る」は消えない', J({ before: before.fail, after: after.fail, retry }));
    } finally {
      await failOff();
      await p.st.ctx.close();
    }
  });

  /* ── 送れなかった1件の片づけ ──
     返事だけが届かなかった回は、サーバには保存されている。読み直したあとで「もう一度送る」を押すと、
     「保存済みの内容と同じです」になる（送るものが無い）。直す前は、端末の控えが残ったまま ＝ 一覧が
     「送れていない回答があります」と言い続けた（件数には、もう入っているのに）。
     決まり：端末に残した1件が、いま送ろうとした入力そのものなら、その1件を消す。
             入力が違うなら消さない（ほかのタブで開いていた入力から「同じです」になっても、送れていない1件は残る）。 */
  for (const who of ['c', null]) {
    const fn = who ? 'submit_airline_conditions' : 'submit_contrib_anon', tag = who ? '会員' : 'ログインなし';
    const unsent = (p) => msg(p, 'unsent');
    const countOf = (p) => p.page.evaluate(() => { const n = document.querySelector('.pvc-root [data-pvc-count="benefits"]'); return !n || n.hidden ? null : n.textContent; });
    /* この人の、この会社の「休暇・手当」の行（会員 ＝ 本人の印／ログインなし ＝ この端末の控えの鍵） */
    const mine = async (p) => {
      if (who) return ownConds('cathay-pacific', CARD);
      const key = await p.page.evaluate(() => localStorage.getItem('pv_contrib_key') || '');
      return (await q(`select item_key as q, payload->>'code' as c from public.pv_contrib_pending
                        where key_hash = public.pv_contrib_key_hash($1) and airline = 'cathay-pacific' order by item_key`, [key])).rows;
    };
    /* はじめに1件、ふつうに保存する（ログインなしの人は、ここで控えの鍵が付く ＝ 読み直したあとも自分の分を読める） */
    const first = async (p) => {
      await openForm(p, CX, 'benefits');
      await pick(p, 'peer_support', 'internal');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
    };

    await scene(`返事が届かなかった回を、読み直してから送り直す ── 「同じです」になったら、端末の控えも消える（${tag}）`, async () => {
      if (who) await bare('cathay-pacific', CARD);
      const p = await open('phone', who ? { who } : {});
      try {
        await first(p);
        await seeMine(p, 'benefits');
        await pick(p, 'sick_leave', 'unlimited');
        await tick(p);
        const lost = await lostReply(p, fn);
        await waitMsg(p, 'fail');
        const db1 = await mine(p);
        if (!lost || !lost.ok || (lost.rejected || []).length || !(await outboxOf(p)) || J(db1) !== J([{ q: 'peer_support', c: 'internal' }, { q: 'sick_leave', c: 'unlimited' }])) {
          throw new Error('前提が崩れた（サーバには保存されたのに、ページには「送れていません」と出ている形になっていない）: ' + J({ lost, db1 }));
        }
        /* 読み直す ＝ 自分の一覧に、届いていた答えが入る */
        await go(p, CX + '?add=list');
        await waitView(p, 'counted');
        const l1 = { unsent: await unsent(p), count: await countOf(p) };
        if (!/送れていない回答があります/.test(l1.unsent || '') || l1.count !== 'あなたの投稿 2件') throw new Error('前提が崩れた（一覧が「送れていない回答があります」と「あなたの投稿 2件」を並べていない）: ' + J(l1));
        await p.page.click('.pvc-root .pvc-msg[data-pvc-msg="unsent"] [data-pvc-act="resume"]');
        await waitView(p, 'benefits');
        await settle(p);
        /* 入力の中身ではないもの（補足の欄を開く）を1つ変えてから送り直す ── それでも「同じ入力」 */
        await p.page.click('.pvc-root [data-q-more="peer_support"]');
        const h0 = hits(p, fn);
        await p.page.click('.pvc-root .pvc-msg[data-pvc-msg="fail"] [data-pvc-act="retry"]');
        await waitMsg(p, 'same');
        const f2 = await faceOf(p);
        await p.page.click('.pvc-root .pvc-prev');
        await waitView(p, 'counted');
        const l2 = { unsent: await unsent(p), count: await countOf(p), outbox: await outboxOf(p) }, db2 = await mine(p);
        ok(/保存済みの内容と同じです/.test(f2.same) && f2.fail === '' && hits(p, fn) === h0,
          '★u1 読み直してから「もう一度送る」を押すと、「保存済みの内容と同じです」に替わる（「送れていません」は消える・何も送らない）', J(f2));
        ok(l2.unsent === null && l2.outbox === null && l2.count === 'あなたの投稿 2件' && J(db2) === J(db1),
          '★u1 一覧に戻ると「送れていない回答があります」が消えている（件数は 2件のまま・保存先は答えごとに1行）', J({ l2, db2 }));
      } finally {
        cutHeld(p);
        await p.st.ctx.close();
      }
    });

    await scene(`本当に届かなかった1件が残っているとき、ほかのタブの入力から「同じです」になっても、その1件は消えない（${tag}）`, async () => {
      if (who) await bare('cathay-pacific', CARD);
      const p = await open('phone', who ? { who } : {});
      try {
        /* 1枚目：ふつうに保存して、同じ項目を開いておく（何も変えていない入力） */
        await first(p);
        await seeMine(p, 'benefits');
        await settle(p);
        /* 2枚目（同じブラウザ）：同じ項目で1つ答えを足して送る → 届かない ＝ 端末に1件残る */
        const t2 = await p.st.ctx.newPage();
        const p2 = { page: t2, st: { calls: [], fake: null } };
        t2.setDefaultTimeout(20000);
        await t2.setViewport({ width: 390, height: 680, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        await t2.setRequestInterception(true);
        t2.on('request', (req) => gate(req, p2.st));
        await t2.bringToFront();
        await openForm(p2, CX, 'benefits');
        await pick(p2, 'sick_leave', 'unlimited');
        await tick(p2);
        await failNext(fn, 'drop', 9);
        await send(p2);
        await waitMsg(p2, 'fail');
        await failOff();
        const db1 = await mine(p);
        const ob1 = JSON.parse((await outboxOf(p2)) || 'null');
        if (!ob1 || ob1.topic !== 'benefits' || ob1.draft.vals.sick_leave !== 'unlimited' || J(db1) !== J([{ q: 'peer_support', c: 'internal' }])) {
          throw new Error('前提が崩れた（2枚目の送信が届かず、端末に1件残った形になっていない）: ' + J({ ob1, db1 }));
        }
        /* 1枚目へ戻り、何も変えずに送る */
        await p.page.bringToFront();
        await tick(p);
        await send(p);
        await waitMsg(p, 'same');
        const ob2 = JSON.parse((await outboxOf(p)) || 'null');
        ok(!!ob2 && ob2.topic === 'benefits' && ob2.draft.vals.sick_leave === 'unlimited',
          '★u2 何も変えていない入力から「保存済みの内容と同じです」になっても、端末に残っている別の1件は消えない', J(ob2 && ob2.draft && ob2.draft.vals));
        /* 読み直すと、一覧はまだ知らせていて、「続きを開く」で送れなかった入力が戻る */
        await go(p, CX + '?add=list');
        await waitView(p, 'counted');
        const l3 = await msg(p, 'unsent');
        await p.page.click('.pvc-root .pvc-msg[data-pvc-msg="unsent"] [data-pvc-act="resume"]').catch(() => null);
        const back = await seen(p, () => {
          const f = document.querySelector('.pvc-root form[data-pvc-form="benefits"]'), x = f && f.querySelector('[name="sick_leave"]');
          return !!x && x.value === 'unlimited' && !!f.querySelector('.pvc-msg[data-pvc-msg="fail"] [data-pvc-act="retry"]');
        });
        ok(/送れていない回答があります/.test(l3 || '') && back,
          '★u2 読み直した一覧は「送れていない回答があります」と言い、「続きを開く」で送れなかった入力（と「もう一度送る」）が戻る', J({ l3, back }));
      } finally {
        await failOff();
        await p.st.ctx.close();
      }
    });
  }

  /* ── 親の条件を引き継ぐ（2回の送信）──
     上の「着陸手当」の場面は、親と続きの質問を1回で送る ＝ 3行が同じ職位・機種になるのは当たり前。
     ここは、親を前に（別の月に・職位と機種つきで）保存してある人が、続きの質問だけをあとから送る回。
     月の勤務を1件も出していない会員なので、面は職位も機種も送らない ＝ 続きの行の職位・機種は、サーバが親の行から取る。
     適用時期は「答えた月」＝ 親の月ではなく、この送信の月。 */
  await scene('親を前に保存した人が、続きの質問だけをあとから送る ── 職位と機種は親の行のもの・時期はこの送信の月', async () => {
    await bare('eva-air', CARD);
    const now = (await q(`select extract(year from current_date)::int as y, extract(month from current_date)::int as m`)).rows[0];
    const prev = now.m === 1 ? { y: now.y - 1, m: 12 } : { y: now.y, m: now.m - 1 };
    const seeded = await rpcAs('c', 'submit_airline_conditions', { airline: 'eva-air', lang: 'ja', position: 'cap', fleet: FLEET, year: prev.y, month: prev.m,
      answers: [{ question_id: 'landing_pay', code: 'fixed' }] });
    const p = await open('phone', { who: 'c' });
    const sent = tap(p, 'submit_airline_conditions');
    try {
      await openForm(p, EVA, 'benefits');
      const v0 = await vals(p), line = await p.page.$eval('.pvc-root .pvc-ctx-line', (n) => n.textContent);
      const row0 = await landRows('eva-air', CARD);
      if (!seeded || !seeded.ok || (seeded.rejected || []).length || v0.landing_pay !== 'fixed' || /機長|副操縦士/.test(line) || (await ownMonths('eva-air', CARD)).length
        || J(row0.map((r) => [r.q, r.pos, r.fleet, r.y, r.m])) !== J([['landing_pay', 'cap', FLEET, prev.y, prev.m]])) {
        throw new Error('前提が崩れた（月の勤務が無く、親だけが前の月に職位・機種つきで保存されている形になっていない）: ' + J({ seeded, v0: v0.landing_pay, line, row0 }));
      }
      await fill(p, 'landing_pay_amount', '1500');
      await pick(p, 'landing_pay_amount_cur', 'JPY');
      await pick(p, 'landing_pay_unit', 'per_landing');
      await tick(p);
      await send(p);
      await waitView(p, 'saved');
      const p1 = sent[0] || {}, rows = await landRows('eva-air', CARD);
      const par = rows.find((r) => r.q === 'landing_pay'), kids = rows.filter((r) => r.q !== 'landing_pay');
      ok(sent.length === 1 && J(ids(p1)) === J(['landing_pay_amount', 'landing_pay_unit']) && !('position' in p1) && !('fleet' in p1) && !('year' in p1) && !('month' in p1),
        '★続きの質問だけを送る（親は送り直さない）。その送信は、職位も機種も時期も運んでいない', J(p1));
      ok(kids.length === 2 && kids.every((r) => r.pos === 'cap' && r.fleet === FLEET),
        '★保存先の続きの2行は、親の行の職位と機種を持つ（空で保存しない）', J(kids));
      ok(kids.length === 2 && kids.every((r) => r.y === now.y && r.m === now.m) && !!par && par.y === prev.y && par.m === prev.m && par.pos === 'cap' && par.fleet === FLEET,
        '★続きの2行の適用時期は、この送信の月（親の行は、前の月・職位・機種のまま動かない）', J({ now, rows }));
    } finally {
      await p.st.ctx.close();
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 16. 質問の入力の見た目（日本航空・ログインなし・幅 320／360／390／430／768／1280）
  // ═════════════════════════════════════════════════════════════
  /* 着陸手当の続きの質問を足して、面の見た目に4つの粗が出た（どれも画面は普通に動いたまま）：
       ・スマホの幅で、単位の「（1回あたり）」だけが次の行へ落ち、「わからない」の前に並んでいた
       ・続きの質問が上の質問と同じ見た目で並び、どの質問の続きなのかが形で分からなかった
       ・選んだ通貨の名前が「AED（UAEディ…」と途中で切れていた（欄の内側が、名前より狭い）
       ・質問の名前や説明の最後の1〜2文字だけが、次の行に残っていた（「…そのまま入れてくださ／い。」）
     ここは、ブラウザが実際に描いた箱と行を測る（クラスの名前が付いているかどうかは見ない）。
     どれが「続きの質問」かは、質問表（pv-conditions.json）の parent から決める ＝ 製品の付けた印を当てにしない。
     保存はしない（選ぶだけ・打つだけ）。 */
  const BANK = JSON.parse(read('pv-conditions.json')).questions;
  const bankOf = (id) => BANK.find((x) => x.id === id) || {};
  const LANDING = ['landing_pay', ...LAND];
  const V_CUR = JSON.parse(read('pv-vocab.json')).currencies.length;
  /* 数字の行：単位は額と同じ行・額のすぐ右に在るか（行の中に収まっているか・額の欄がつぶれていないか） */
  const numLook = (p) => p.page.evaluate(() => [...document.querySelectorAll('.pvc-root form [data-q]')]
    .filter((f) => !f.closest('[hidden]') && f.querySelector('.pvc-numrow')).map((f) => {
      const row = f.querySelector('.pvc-numrow'), i = row.querySelector('input[type="text"]'), u = row.querySelector('.pvc-unit');
      const rr = row.getBoundingClientRect(), ir = i.getBoundingClientRect(), ur = u ? u.getBoundingClientRect() : null;
      const mid = ur ? (ur.top + ur.bottom) / 2 : 0;
      return { q: f.getAttribute('data-q'), cur: !!row.querySelector('select'), unit: u ? u.textContent : '', inW: Math.round(ir.width),
        same: !!ur && mid > ir.top && mid < ir.bottom, gap: ur ? Math.round((ur.left - ir.right) * 10) / 10 : null,
        inside: !!ur && ir.left >= rr.left - 0.5 && ur.right <= rr.right + 0.5 && ur.width > 0 };
    }));
  const numBad = (rows) => rows.filter((x) => x.unit && !(x.same && x.gap >= 0 && x.gap <= 12 && x.inside && x.inW >= 120));
  /* 質問の枠（入力の格子の直下）：左の線と字下げ。線は擬似要素なので、計算済みの値から位置と大きさを取る */
  const kidLook = (p) => p.page.evaluate(() => {
    const grid = document.querySelector('.pvc-root form .pvc-grid'), gl = grid.getBoundingClientRect().left;
    return {
      sheet: getComputedStyle(document.querySelector('.pvc-root .pvc-sheet')).backgroundColor, gw: Math.round(grid.getBoundingClientRect().width),
      rows: [...grid.children].filter((n) => !n.hidden).map((n) => {
        const fold = n.matches('.pvc-fold'), r = n.getBoundingClientRect(), bf = getComputedStyle(n, '::before');
        const on = bf.content !== 'none' && bf.content !== 'normal' && bf.display !== 'none';
        const body = fold ? r : n.querySelector('.pvc-label').getBoundingClientRect();
        /* 線の左端：擬似要素の left は枠の内側（縁の内がわ）から測った値 */
        const x = on ? r.left + parseFloat(getComputedStyle(n).borderLeftWidth) + parseFloat(bf.left) - gl : null;
        /* room ＝ 字下げのあとに残る、中身の幅（続きの続きで下げ幅を重ねると、狭い画面でここが足りなくなる） */
        return { id: n.getAttribute('data-q') || n.getAttribute('data-q-fold'), fold, line: on, x: on ? Math.round(x * 10) / 10 : null,
          w: on ? parseFloat(bf.width) : 0, tall: on ? parseFloat(bf.height) >= r.height - 1 : false, color: on ? bf.backgroundColor : '',
          indent: Math.round((body.left - gl) * 10) / 10, room: Math.round(r.right - body.left) };
      }),
    };
  });
  /* その項目の中に上の質問が在る質問だけが「続き」（質問表から決める）。
     続き ＝ 枠の左端に幅2pxの線が枠の高さいっぱいに在り、中身が1段（10〜16px）下がっている。下げ幅はどの続きも同じ。
     上の質問 ＝ 線も字下げも無い。 */
  const kidBad = (k) => {
    const ids = k.rows.map((x) => x.id), step = k.rows.filter((x) => ids.includes(bankOf(x.id).parent)).map((x) => x.indent);
    return k.rows.filter((x) => (ids.includes(bankOf(x.id).parent)
      ? !(x.line && x.w === 2 && Math.abs(x.x) <= 0.5 && x.tall && x.indent >= 10 && x.indent <= 16 && x.indent === step[0] && x.room >= k.gw - 16)
      : !(!x.line && x.indent === 0 && x.room === k.gw)));
  };
  /* 色の明るさの比（線が、面の地に対して見えるか）。'rgb(r, g, b)' / 'rgba(…)' を読む */
  const ratio = (fg, bg) => {
    const rgb = (s) => (String(s).match(/[\d.]+/g) || []).map(Number);
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const b = rgb(bg), a = rgb(fg), al = a.length > 3 ? a[3] : 1, mix = [0, 1, 2].map((k) => a[k] * al + b[k] * (1 - al));
    if (a.length < 3 || b.length < 3 || (b.length > 3 && b[3] < 1)) return 0;
    const [hi, lo] = [lum(mix), lum(b)].sort((x, y) => y - x);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  /* 通貨の欄：一覧の名前を1つずつ選び、その字の幅（同じ書体で測る）と、欄の内側の幅を比べる。
     名前は欄から取る（ここに書かない）。選んだ印は元に戻す（change は流れない ＝ 入力の中身は動かない）。 */
  const curLook = (p) => p.page.evaluate(() => {
    const root = document.querySelector('.pvc-root'), probe = document.createElement('span'), out = [];
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;margin:0;padding:0;border:0';
    root.appendChild(probe);
    for (const s of root.querySelectorAll('form .pvc-numrow select')) {
      if (s.closest('[hidden]')) continue;
      const cs = getComputedStyle(s), keep = s.selectedIndex, o = { name: s.name, n: 0, cut: [], spare: null, widest: 0 };
      for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontKerning', 'fontFeatureSettings', 'fontVariant', 'letterSpacing', 'textTransform']) probe.style[k] = cs[k];
      for (let i = 0; i < s.options.length; i++) {
        s.selectedIndex = i;
        probe.textContent = s.options[i].textContent;
        const c = getComputedStyle(s), inner = s.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight), w = probe.getBoundingClientRect().width;
        o.n++; o.widest = Math.max(o.widest, Math.round(w * 10) / 10);
        o.spare = o.spare === null ? inner - w : Math.min(o.spare, inner - w);
        if (w > inner) o.cut.push(`${s.options[i].textContent} ${Math.round(w)}>${Math.round(inner)}`);
      }
      s.selectedIndex = keep;
      o.spare = Math.round(o.spare * 10) / 10;
      out.push(o);
    }
    probe.remove();
    return out;
  });
  /* 質問の名前と説明：最後の行に何文字あるか（ブラウザが実際に描いた行で数える）と、入っている字 */
  const endLook = (p) => p.page.evaluate(() => {
    const read = (n) => {
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), tops = [];
      let t, text = '';
      while ((t = w.nextNode())) {
        let i = 0;
        for (const ch of Array.from(t.nodeValue)) {
          const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + ch.length); i += ch.length;
          const b = r.getClientRects()[0];
          if (b && ch.trim()) { tops.push(Math.round(b.top)); text += ch; }
        }
      }
      const lines = [...new Set(tops)].sort((x, y) => x - y), n1 = tops.filter((x) => x === lines[lines.length - 1]).length;
      const tails = [...n.querySelectorAll('.pvc-tail')];
      return { text: n.textContent, lines: lines.length, last: n1, end: Array.from(text).slice(-n1).join('').slice(-6),
        kids: [...n.childNodes].map((c) => (c.nodeType === 3 ? 't' : c.className)).join('+'), tail: tails.length === 1 ? tails[0].textContent : null,
        style: getComputedStyle(n).textWrapStyle || getComputedStyle(n).textWrap || '' };
    };
    const out = [];
    for (const f of document.querySelectorAll('.pvc-root form [data-q]')) {
      if (f.closest('[hidden]')) continue;
      const q = f.getAttribute('data-q'), lb = f.querySelector('.pvc-label > span:not(.pvc-mine)');
      if (lb) out.push({ q, k: 'label', ...read(lb) });
      f.querySelectorAll('.pvc-tip').forEach((n, i) => out.push({ q, k: 'help' + (i ? i + 1 : ''), ...read(n) }));
    }
    return out;
  });
  const endShort = (list) => list.filter((x) => x.lines > 1 && x.last < 3).map((x) => `${x.q} ${x.k}「…${x.end}」（最後の行 ${x.last}文字）`);
  /* 入っている字が質問表と1文字も違わないか・最後の3文字だけが1つの塊になっているか */
  const endWrong = (list) => list.filter((x) => {
    const bank = x.k === 'label' ? bankOf(x.q).ja.label : (x.k === 'help' && bankOf(x.q).ja.help ? bankOf(x.q).ja.help : null);
    if (bank === null) return false;                       // 「当てはまるものをすべて…」は面の決まった文（質問表の字ではない）
    const ch = Array.from(bank);
    return x.text !== bank || (ch.length > 3 ? (x.kids !== 't+pvc-tail' || x.tail !== ch.slice(-3).join('')) : x.kids !== 't');
  }).map((x) => `${x.q} ${x.k}「${x.text.slice(-8)}」[${x.kids}｜${x.tail}]`);
  const wide = (m) => m.over.length === 0 && m.mainX <= 0 && m.sheetX <= 0 && m.docX <= 0 && m.small.length === 0 && m.font.length === 0;
  const landingSet = async (p, v) => { await pick(p, 'landing_pay', v); return shown(p); };
  /* 開いている面のまま、ほかの項目へ（?add= で直接開いた面には「戻る」が無いので、面の入口を呼ぶ） */
  const toTopic = async (p, topic) => { await api(p, topic); await waitView(p, topic); await settle(p); };

  for (const sizeKey of ['small', 'w360', 'phone', 'w430', 'tablet', 'w1280']) {
    const size = SIZES[sizeKey], tag = `幅${size.w}`, narrow = size.w < 768;
    await scene(`質問の入力の見た目（${tag}）── 単位は額のすぐ右・続きの質問の線と字下げ・通貨の名前が切れない${narrow ? '・最後の行に1〜2文字だけ残らない' : ''}`, async () => {
      const p = await open(sizeKey);
      try {
        await openForm(p, JAL, 'benefits');
        await p.page.evaluate(() => document.fonts.ready);
        const nums = [], kids = [], curs = [], sizes = [], ends = [], endsOff = [], seen = new Set();
        let offStyle = '';
        for (const v of ['fixed', 'variable']) {
          const sh = await landingSet(p, v);
          LANDING.filter((k) => sh[k]).forEach((k) => seen.add(k));
          nums.push(...await numLook(p));
          kids.push(await kidLook(p));
          curs.push(...await curLook(p));
          sizes.push(await measure(p));
          const on = await endLook(p);
          ends.push(...on);
          if (narrow) {
            /* 同じ測りを、text-wrap を切った状態でもう一度（text-wrap:pretty を知らないブラウザの見え方）。
               切るのは2つのクラスだけ ＝ 最後の3文字の塊（その子）の nowrap には触れない。 */
            const tagEl = await p.page.addStyleTag({ content: '.pvc-root .pvc-label,.pvc-root .pvc-tip{text-wrap:wrap !important}' });
            const off = await endLook(p);
            endsOff.push(...off);
            offStyle = [...new Set(off.map((x) => x.style))].join('|');
            await tagEl.evaluate((n) => n.remove());
          }
        }
        if (LANDING.some((k) => !seen.has(k))) throw new Error('前提が崩れた（着陸手当の6問が出そろっていない）: ' + J([...seen]));

        /* ── ほかの項目：訓練・キャリア（通貨つきの額と、通貨の無い年数）／ 通勤・タクシー（続きの続き・畳んだ質問） ── */
        await toTopic(p, 'career');
        await pick(p, 'training_bond', 'yes');
        const career = await numLook(p);
        nums.push(...career);
        kids.push(await kidLook(p));
        curs.push(...await curLook(p));
        sizes.push(await measure(p));
        await toTopic(p, 'taxi');
        await pick(p, 'commuting_transport', 'always');
        await chip(p, 'commuting_transport_method', 'company_taxi');
        await chip(p, 'commuting_transport_method', 'crew_bus');
        await p.page.click('.pvc-root .pvc-fold-b');
        await p.page.waitForFunction(() => !document.querySelector('.pvc-root .pvc-fold-p').hidden);
        const taxi = await kidLook(p);
        kids.push(taxi);
        sizes.push(await measure(p));

        const land = nums.filter((x) => /^landing_pay/.test(x.q)), money = career.filter((x) => x.cur), bad = numBad(nums);
        ok(land.length === 3 && land.every((x) => x.cur && x.unit === '（1回あたり）') && money.length === 1 && nums.some((x) => !x.cur && x.unit) && bad.length === 0,
          `★${tag}：単位は、額と同じ行・額のすぐ右に在る（着陸手当の額3つ・訓練費用の額・通貨の無い数字の質問。「わからない」の前へ落ちない）`,
          J(bad.length ? bad : nums.map((x) => [x.q, x.inW, x.gap])));
        const kb = kids.flatMap((k) => kidBad(k)), all = kids.flatMap((k) => k.rows), ids = all.map((x) => x.id);
        const deep = taxi.rows.filter((x) => bankOf(bankOf(x.id).parent).parent);
        ok(LANDING.every((k) => ids.includes(k)) && TAXI.every((k) => taxi.rows.some((x) => x.id === k)) && deep.length === 6 && deep.some((x) => x.fold) && kb.length === 0,
          `★${tag}：続きの質問には左に線が1本あり、1段下がっている。上の質問には線も字下げも無い（着陸手当の6問・訓練費用・通勤の続きの続きも同じ1段）`,
          J(kb.length ? kb : { step: [...new Set(all.filter((x) => x.line).map((x) => x.indent))], lines: all.filter((x) => x.line).length, tops: all.filter((x) => !x.line).length }));
        const cut = curs.filter((x) => x.cut.length);
        ok(curs.length === 4 && curs.every((x) => x.n === V_CUR + 1 && x.widest > 150) && cut.length === 0,
          `★${tag}：通貨の名前は、どれを選んでも途中で切れない（一覧の ${V_CUR} 通貨を1つずつ選び、字の幅と欄の内側の幅を比べる）`,
          J(cut.length ? cut.map((x) => [x.name, x.cut.length, x.cut.slice(0, 3)]) : curs.map((x) => [x.name, x.widest, x.spare])));
        ok(sizes.length === 4 && sizes.every(wide),
          `${tag}：どの状態でも面が横に溢れず、押せる所は 44px 以上・入力欄の字は 16px 以上（着陸手当の2つの枝・訓練・キャリア・通勤の上限を開いた状態）`,
          J(sizes.filter((m) => !wide(m)).map((m) => ({ over: m.over.slice(0, 4), mainX: m.mainX, small: m.small.slice(0, 4), font: m.font.slice(0, 4) }))));
        const wrong = endWrong(ends);
        ok(ends.length >= 20 && wrong.length === 0,
          `${tag}：質問の名前と説明の字は、質問表と1文字も違わない（最後の3文字だけが、折り返しで離れない1つの塊）`, J(wrong.slice(0, 5)));
        if (narrow) {
          const s1 = endShort(ends), s2 = endShort(endsOff);
          ok(ends.some((x) => x.lines > 1) && s1.length === 0 && ends.every((x) => !/pretty|balance/.test(x.style)),
            `★${tag}：質問の名前と説明の最後の行に、1〜2文字だけが残っていない（休暇・手当の全部の質問。着陸手当の6問を含む）`, J(s1));
          ok(endsOff.length === ends.length && !/pretty|balance/.test(offStyle) && s2.length === 0,
            `★${tag}：text-wrap を切っても同じ（text-wrap:pretty を知らないブラウザでも、最後の行は3文字以上）`, J({ style: offStyle, short: s2 }));
        }
        if (sizeKey === 'phone') {
          /* 線の色：面の地に対して 3:1 以上（細い線1本なので、薄い色だと見えない）。キーボードの順は 通貨 → 額 → わからない */
          const line = taxi.rows.find((x) => x.line) || {}, r = ratio(line.color, taxi.sheet);
          ok(r >= 3, '★続きの質問の線は、面の地に対して 3:1 以上の濃さ（明るい表示）', J({ line: line.color, sheet: taxi.sheet, ratio: r }));
          await toTopic(p, 'benefits');
          await landingSet(p, 'fixed');
          await p.page.focus('.pvc-root select[name="landing_pay_amount_cur"]');
          const order = [];
          for (let i = 0; i < 2; i++) { await p.page.keyboard.press('Tab'); order.push(await p.page.evaluate(() => document.activeElement && document.activeElement.name)); }
          ok(J(order) === J(['landing_pay_amount', 'landing_pay_amount_unk']), '額の行のキーボードの順は、通貨 → 額 → 「わからない」のまま', J(order));
        }
      } finally {
        await p.st.ctx.close();
      }
    });
  }

  await scene('質問の入力の見た目（暗い表示・390×680）── 続きの質問の線が見える', async () => {
    const p = await open('phone', { theme: 'dark' });
    try {
      await openForm(p, JAL, 'benefits');
      await landingSet(p, 'variable');
      const k = await kidLook(p), line = k.rows.find((x) => x.line) || {}, r = ratio(line.color, k.sheet);
      const dark = await p.page.$eval('.pvc-root', (n) => n.classList.contains('is-dark'));
      ok(dark && kidBad(k).length === 0 && r >= 3, '★続きの質問の線は、暗い表示でも面の地に対して 3:1 以上の濃さ', J({ dark, line: line.color, sheet: k.sheet, ratio: r, bad: kidBad(k) }));
      const cut = (await curLook(p)).filter((x) => x.cut.length);
      ok(cut.length === 0 && wide(await measure(p)), '暗い表示でも、通貨の名前は切れず、面は横に溢れない', J(cut));
    } finally {
      await p.st.ctx.close();
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 17. 待遇の一覧のページ（airline-conditions.html）── 本物のサーバが断った対を、その行に、その理由で言う
  // ═════════════════════════════════════════════════════════════
  /* 一覧のページを描くのは pv-conditions.js（この検査のほかの場面は、会社ページの上の面 ＝ pv-contrib.js）。
     一覧のページは、送る前に「保存してある相手の額」と比べて止める ── そこは assert-conditions.mjs が偽物のサーバで見ている。
     ここは、その確かめを通り抜けた送信を見る：画面が読んだあとで、相手の額がほかの所で変わっていた
     （別のタブ・別の端末・会社ページの面）。画面は前の額のつもりで送り、**本物のサーバ**が断る。
     そのとき画面は「保存できませんでした」ではなく、断られた理由の文を、その行に出す。保存先は動かない。
     ⚠️ 相手の額は、この検査の手元の保存先を直に書き換えて変える。入れる額は検査のための作りもので、どの会社の額でもない。
     ⚠️ この場面だけは偽物のサーバに置き換えない（置き換えると、サーバが本当にこの理由を返すことを誰も見なくなる）。 */
  await scene('待遇の一覧のページ ── 画面が読んだあとで相手の額が変わっていた対を、本物のサーバが断る', async () => {
    const SLUG = 'emirates', M = memberOf('c');
    const token = (await (await fetch(`${base}/__local/login?member=c`)).json()).session.access_token;
    const seed = async () => (await fetch(`${base}/rest/v1/rpc/submit_airline_conditions`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ p: { airline: SLUG, answers: [{ question_id: 'landing_pay', code: 'variable' },
        { question_id: 'landing_pay_from', num: 100, currency: 'USD' }, { question_id: 'landing_pay_to', num: 200, currency: 'USD' }] } }),
    })).json();
    const LOW = '[data-qid="landing_pay_from"]', HIGH = '[data-qid="landing_pay_to"]';
    for (const [lang, file, sentence, general] of [
      ['ja', '/airline-conditions.html', ORDER, '保存できませんでした'],
      ['en', '/en/airline-conditions.html', 'The lowest amount is larger than the highest amount.', 'Could not save']]) {
      const s0 = await seed();
      const p = await open('desk', { who: 'c' });
      try {
        const sent = tap(p, 'submit_airline_conditions'), replies = [];
        p.page.on('response', (res) => {
          if (res.url().endsWith('/rest/v1/rpc/submit_airline_conditions')) res.json().then((j) => replies.push(j), () => replies.push(null));
        });
        await p.page.goto(`${base}${file}?airline=${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await p.page.waitForFunction((sel) => !!document.querySelector(sel + ' .pvcf-num'), { timeout: 30000 }, LOW);
        await p.page.evaluate((sel) => { document.querySelector(sel).closest('details').open = true; }, LOW);
        const drawn = await p.page.evaluate((lo, hi) => ({
          path: location.pathname, lang: document.documentElement.lang,
          lo: document.querySelector(lo + ' .pvcf-num').value + ' ' + document.querySelector(lo + ' [data-cur]').value,
          hi: document.querySelector(hi + ' .pvcf-num').value + ' ' + document.querySelector(hi + ' [data-cur]').value,
        }), LOW, HIGH);
        ok(s0 && s0.saved === 3 && !(s0.rejected || []).length && drawn.path === file && drawn.lang === lang && drawn.lo === '100 USD' && drawn.hi === '200 USD',
          `${lang}：下ごしらえ ── 低いほう 100 USD／高いほう 200 USD を保存してある会員が、一覧のページを開いた`, J({ s0, drawn }));

        /* 画面が描かれたあとで、保存先の高いほうを 50 に変える（画面は 200 のまま） */
        await q(`update public.airline_conditions set answer_num = 50
                  where airline = $2::text and question_id = 'landing_pay_to' and proof_hash = public.pv_condition_hash($1::uuid, $2::text, null)`, [M.id, SLUG]);
        const moved = await pairOf(SLUG, M);
        await p.page.focus(LOW + ' .pvcf-num');
        await p.page.evaluate((sel) => document.querySelector(sel + ' .pvcf-num').select(), LOW);
        await p.page.keyboard.type('150');
        /* 押す前に、ボタンを画面のまんなかへ送る（上に貼り付いたヘッダーの下に入ったボタンを押すと、ヘッダーの部品を押してしまう） */
        await p.page.$eval(LOW + ' [data-num]', (b) => b.scrollIntoView({ block: 'center' }));
        await p.page.click(LOW + ' [data-num]');
        await p.page.waitForFunction((sel) => document.querySelector(sel + ' .pvcf-state').textContent !== '', { timeout: 20000 }, LOW);
        /* 返事の本文は、画面の文が出たあとで検査の側へ届く。届くまで、画面のコマを送りながら待つ（時間では待たない） */
        for (let i = 0; i < 600 && !replies.length; i++) await p.page.evaluate(() => new Promise((go) => requestAnimationFrame(go)));
        const shown = await p.page.evaluate((lo, hi) => {
          const s = document.querySelector(lo + ' .pvcf-state');
          return { said: s.textContent, bad: s.classList.contains('is-bad'), typed: document.querySelector(lo + ' .pvcf-num').value,
            hi: document.querySelector(hi + ' .pvcf-num').value, hiSaid: document.querySelector(hi + ' .pvcf-state').textContent };
        }, LOW, HIGH);
        const a = (sent[0] && sent[0].answers) || [], r = replies[0] || {};
        ok(J(moved) === J([{ q: 'landing_pay_from', num: 100, cur: 'USD', c: null }, { q: 'landing_pay_to', num: 50, cur: 'USD', c: null }])
          && shown.hi === '200' && sent.length === 1 && a.length === 1 && a[0].question_id === 'landing_pay_from' && Number(a[0].num) === 150 && a[0].currency === 'USD',
          `${lang}：保存先の高いほうを 50 に変えたあと、画面（高いほう 200 のまま）で低いほうを 150 にして押す → 画面の確かめは通り、1問ぶんを送る`,
          J({ moved, hi: shown.hi, sent: a }));
        const rej = Array.isArray(r.rejected) ? r.rejected : [];
        ok(replies.length === 1 && r.saved === 0 && rej.length === 1 && rej[0].question_id === 'landing_pay_from' && rej[0].reason === 'range_order',
          `★${lang}：本物のサーバが、その答えを range_order で断る（保存した数は 0）`, J(r));
        ok(shown.said === sentence && shown.said !== general && shown.bad && shown.typed === '150' && shown.hiSaid === '',
          `★${lang}：低いほうの行に「${sentence}」（「${general}」ではない）。打った 150 は残る。高いほうの行には何も書かない`, J(shown));
        ok(J(await pairOf(SLUG, M)) === J(moved), `★${lang}：保存先は動いていない（低いほうは 100 のまま）`, J(await pairOf(SLUG, M)));
      } finally {
        await p.st.ctx.close();
      }
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 18. 別の会社について開く（PVContrib.openFor）
  //     このページの会社ではなく、読む人自身の会社（＝ 勤め先。本人のこと）について、同じ面を開く入口。
  //     ページはキャセイ・開く相手は JAL・会員A。
  // ═════════════════════════════════════════════════════════════
  /* 面が開いているか・どの会社の名前を出しているか */
  const coFace = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), f = r && r.querySelector('form[data-pvc-form]'), l = r && r.querySelector('.pvc-ctx-line');
    return { open: window.PVContrib.isOpen(), up: !!(r && !r.hidden && r.classList.contains('is-in')),
      title: r ? r.querySelector('.pvc-title').textContent : '', text: r ? r.querySelector('.pvc-main').innerText : '',
      line: l ? l.textContent : '', form: f ? f.getAttribute('data-pvc-form') : '', els: r ? r.querySelectorAll('img, [onerror]').length : 0 };
  });
  /* 面の動かない頭に出ている、会社の名前の行（.pvc-whose。ほかの会社について開いているあいだだけ在る）。
     n ＝ 頭の中の、その行の数／fixed ＝ 送られる所（.pvc-main）の外に在る／
     seen ＝ 最初の画面の中に、隠れずに出ている（その行のまんなかの、いちばん手前に在るのが、その行）／
     head ＝ 頭に出ている字の全部／topic ＝ そのうち、題そのものの字（会社の名前の行を除く） */
  const whoseOf = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), h = r && r.querySelector('.pvc-head'), all = h ? [...h.querySelectorAll('.pvc-whose')] : [], n = all[0] || null;
    const b = n ? n.getBoundingClientRect() : null, hit = b ? document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2) : null;
    const t = r && r.querySelector('.pvc-title');
    return { n: all.length, name: n ? n.textContent : '', head: h ? h.textContent : '',
      topic: t ? [...t.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('') : '',
      fixed: !!n && !r.querySelector('.pvc-main').contains(n),
      seen: !!b && b.width > 0 && b.height > 0 && b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && !!hit && (hit === n || n.contains(hit)),
      at: innerWidth + 'x' + innerHeight };
  });
  /* 質問の台帳（面が開く前に読むもの）が届き、そのあと画面が2コマ進むまで待つ ＝「何も開かなかった」と言ってよい所まで（時間では待たない） */
  const coIdle = (p) => p.page.evaluate(() => fetch('/pv-conditions.json').then((r) => r.text()).then(() => new Promise((go) => requestAnimationFrame(() => requestAnimationFrame(go)))));
  /* 面が自分で出す通信（自分の一覧を読む・送る・引き継ぐ）。ページの側の集計の読み出しは数えない */
  const coCalls = (p, from) => p.st.calls.slice(from).filter((c) => /^(my_work_months|my_airline_conditions|my_contrib_anon|submit_|claim_)/.test(c));

  await scene('別の会社について開く ── 入口に渡された字を、そのまま信じない', async () => {
    const u = await open('phone', { who: 'a' });
    try {
      await go(u, CX);
      const cx = await nameOf(u), errs0 = pageErrs.length, n0 = u.st.calls.length;
      const BAD = ['JAL!', '', 'j'.repeat(200), 'other'], got = [];
      for (const x of BAD) got.push(await u.page.evaluate((v) => window.PVContrib.openFor({ airline: v, name: 'JAL', ask: ['reserve_duty'] }), x));
      got.push(await u.page.evaluate(() => window.PVContrib.openFor()));
      await coIdle(u);
      const f0 = await coFace(u);
      ok(got.length === 5 && got.every((v) => v === false) && !f0.open && !f0.up && coCalls(u, n0).length === 0,
        '★会社の符号の形をしていない字（「JAL!」・空・200字・「other」・何も渡さない）には false を返す。何も開かない・自分の一覧も読みに行かない',
        J({ got, open: f0.open, up: f0.up, calls: coCalls(u, n0) }));

      const NAME = '<img src=x onerror=1>';
      const r1 = await u.page.evaluate((n) => window.PVContrib.openFor({ airline: 'jal', name: n, ask: [] }), NAME);
      await waitView(u, 'list');
      const f1 = await coFace(u);
      ok(r1 === true && f1.title === NAME + 'に情報を追加' && f1.text.includes(NAME + 'のこと、') && !f1.title.includes(cx) && f1.els === 0 && pageErrs.length === errs0,
        '★渡された名前は、字としてしか入らない（「<img src=x onerror=1>」が、そのままの字で見出しに出る。要素は1つも出来ない・ページのエラーも出ない）',
        J({ r1, title: f1.title, els: f1.els, errs: pageErrs.slice(errs0) }));
      ok(/ひとつ教えて。/.test(f1.text) && !/ログインは要りません/.test(f1.text),
        '★別の会社について開いた一覧には「ログインは要りません」と書かない（その面は、ログインしている会員にしか開かない ＝ 当てはまらないことを言わない）', J(f1.text.slice(-80)));
      await u.page.evaluate(() => window.PVContrib.close());
      await waitClosed(u);

      await u.page.evaluate(() => { window.PVSession.wipe(); });
      const n1 = u.st.calls.length;
      const r2 = await u.page.evaluate(() => window.PVContrib.openFor({ airline: 'jal', name: 'JAL', ask: ['reserve_duty'] }));
      await coIdle(u);
      const f2 = await coFace(u);
      ok(r2 === false && !f2.open && !f2.up && coCalls(u, n1).length === 0,
        '★ログインしていない人には false を返す。何も開かない（別の会社について開くのは、ログインしている会員だけ）', J({ r2, open: f2.open, up: f2.up, calls: coCalls(u, n1) }));
    } finally {
      await u.st.ctx.close();
    }
  });

  /* ── JAL について開く（会員A・キャセイのページ）── */
  const FOR_JAL = { airline: 'jal', name: 'JAL', ask: ['reserve_duty'] };
  const callFor = (p) => p.page.evaluate((o) => window.PVContrib.openFor(o), FOR_JAL);
  /* このタブに残っている下書きの鍵（pv_contrib_draft:<会社の符号>:<項目>） */
  const draftKeys = (p) => p.page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('pv_contrib_draft:')).sort());
  const histOf = (p) => p.page.evaluate(() => history.state);
  /* 面を閉じて、積んだ1段を降り終わるまで待つ */
  const shut = async (p) => { await p.page.evaluate(() => window.PVContrib.close()); await waitClosed(p); };
  /* このページに在る、ふつうの入口（その質問の名前）を押す ＝ このページの会社について、同じ項目・同じ質問で開く */
  const pageEntry = async (p) => {
    const hit = await p.page.evaluate(() => { const n = document.querySelector('.pvg a[data-pvc-open="roster"][data-pvc-q="reserve_duty"]'); if (n) n.click(); return !!n; });
    if (!hit) throw new Error('前提が崩れた（このページに、その質問の入口が無い）');
  };
  const codes = (pl) => ((pl && pl.answers) || []).map((x) => [x.question_id, x.code]);

  await scene('別の会社について開く ── 自分の会社の回答を、ほかの会社のページから', async () => {
    await bare('jal', A); await bare('cathay-pacific', A);
    const u = await open('phone', { who: 'a' });
    try {
      const sent = tap(u, 'submit_airline_conditions');
      await go(u, CX);
      const cx = await nameOf(u);
      const behind = () => u.page.evaluate(() => ({ at: location.pathname + location.search + location.hash, slug: document.body.getAttribute('data-airline'),
        h1: document.querySelector('.hero-airline h1').textContent.trim(), title: document.title }));
      const b0 = await behind();
      if (!cx || cx.includes('JAL') || b0.slug !== 'cathay-pacific') throw new Error('前提が崩れた（キャセイのページを開けていない）: ' + J({ cx, b0 }));
      const both = async () => ({ duty: await spot(u, 'reserve_duty'), off: await spot(u, 'days_off_request') });

      /* D1：その質問の項目が、その質問の所で開く。出る会社の名前は JAL だけ */
      const r1 = await callFor(u);
      await waitView(u, 'roster');
      await settle(u);
      const at1 = await seen(u, inView, 'reserve_duty');
      const f1 = await coFace(u), s1 = await spot(u, 'reserve_duty'), b1 = await behind();
      ok(r1 === true && f1.form === 'roster' && at1 && s1.scroll > 0 && f1.line.startsWith('JAL · ') && !f1.text.includes(cx) && !f1.title.includes(cx) && J(b1) === J(b0),
        '★JAL について開くと、その質問の項目が、その質問の所で開く。面に出る会社の名前は JAL だけ（このページの会社の名前は出ない）。うしろのページは変わらない',
        J({ r1, form: f1.form, at1, scroll: s1.scroll, top: s1.top, line: f1.line, behind: J(b1) === J(b0) }));

      /* 面の動かない頭（題の上）が、その会社の名前を出している。質問の所まで送って開いた回は、入力の頭の会社の行が
         画面の外へ出ている（上の scroll > 0）＝ 頭に無ければ、どの会社について答えるのかが、最初の画面のどこにも出ない。
         390×680（この面）と 1440×820（もう1枚開く）の両方で見る。このページの会社について開いた頭には、その行そのものが無い
         （JAL について開いて閉じたあとの、同じ面で見る ＝ 前の行が残っていない）。 */
      const w1 = await whoseOf(u);
      let w2 = null, w3 = null;
      const v = await open('desk', { who: 'a' });
      try {
        await go(v, CX);
        await callFor(v);
        await waitView(v, 'roster');
        await settle(v);
        if (!(await seen(v, inView, 'reserve_duty'))) throw new Error('前提が崩れた（1440×820 で、その質問の所で開いていない）');
        w2 = await whoseOf(v);
        await shut(v);
        await pageEntry(v);
        await waitView(v, 'roster');
        await settle(v);
        w3 = await whoseOf(v);
      } finally {
        await v.st.ctx.close();
      }
      const named = (x, at) => x.n === 1 && x.name === 'JAL' && !!x.topic && x.head === 'JAL' + x.topic && x.fixed && x.seen && x.at === at;
      ok(named(w1, '390x680') && named(w2, '1440x820') && w3.n === 0 && w3.topic === w2.topic && w3.head === w3.topic && w3.at === '1440x820',
        '★JAL について開いているあいだ、面の動かない頭（題の上）に「JAL」と出ている：質問の所まで送って開いても、最初の画面の中に在る（390×680・1440×820）。このページの会社について開いた頭には、その行そのものが無い（頭の字は題だけ）',
        J({ w1, w2, w3 }));

      /* D2・D3：送る中身・保存先・保存できた合図が、どれも JAL */
      await pick(u, 'reserve_duty', 'yes');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const sm = await summary(u), ev = await u.page.evaluate(() => window.__pvcSaved.slice());
      const jal1 = await ownConds('jal', A), cx1 = await ownConds('cathay-pacific', A);
      ok(sent.length === 1 && sent[0].airline === 'jal' && J(codes(sent[0])) === J([['reserve_duty', 'yes']]) && J(jal1) === J([{ q: 'reserve_duty', c: 'yes' }]) && cx1.length === 0
        && sm.text.includes('JAL') && !sm.text.includes(cx),
        '★答えて送ると、送る中身の会社は jal。保存先には JAL の答えとして入り、このページの会社には1行も入らない（保存後のカードの会社名も JAL）',
        J({ sent: sent.map((x) => [x.airline, codes(x)]), jal1, cx1 }));
      ok(ev.length === 1 && ev[0].topic === 'roster' && ev[0].slug === 'jal', '★保存できた合図（pvc:saved）は1回で、会社は jal', J(ev));

      /* D4：閉じて、このページの入口から同じ項目を開く。JAL に保存した答えも、JAL について打って送らなかった答えも、持ち越さない。
         自分の一覧の返事は止めておく ── 届く前の入力に、前の会社の答えが出ていないことを見る（届いたあとは、どのみち入れ替わる）。 */
      await u.page.click('.pvc-root .pvc-saved [data-pvc-act="edit"]');
      await waitView(u, 'roster');
      await settle(u);
      await pick(u, 'days_off_request', 'partial');                // JAL について打って、送らない
      const j2 = await both();
      if (j2.duty.val !== 'yes' || !j2.duty.mine || j2.off.val !== 'partial') throw new Error('前提が崩れた（JAL に保存した答えと、打って送っていない答えが、入力に出ていない）: ' + J(j2));
      await shut(u);
      u.st.hold = { name: 'my_airline_conditions', reqs: [] };
      await pageEntry(u);
      await u.page.waitForFunction(() => { const r = document.querySelector('.pvc-root'); return !!r && r.classList.contains('is-in') && !!r.querySelector('form[data-pvc-form="roster"]'); });
      if (!(await until(() => u.st.hold.reqs.length === 1))) throw new Error('前提が崩れた（このページの会社の、自分の一覧を読みに行っていない）');
      const keys = await draftKeys(u);
      ok(!keys.some((k) => k.startsWith('pv_contrib_draft:jal')), '★JAL について打って送らなかった入力は、このタブに下書きとして残らない（JAL の符号の付いた鍵が1つも無い）', J(keys));
      const f3 = await coFace(u), h3 = await both();
      ok(f3.line.startsWith(cx + ' · ') && !f3.text.includes('JAL') && h3.duty.val === '' && !h3.duty.mine && h3.off.val === '',
        '★閉じて、このページの入口から同じ項目を開く：面の会社はこのページの会社。JAL に保存した答えも、JAL について打った答えも、入力に入っていない', J({ line: f3.line, h3 }));
      release(u);
      await waitView(u, 'roster');
      await settle(u);
      const h4 = await both();
      await pick(u, 'reserve_duty', 'no');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const jal2 = await ownConds('jal', A), cx2 = await ownConds('cathay-pacific', A);
      ok(h4.duty.val === '' && !h4.duty.mine && h4.off.val === '' && sent.length === 2 && sent[1].airline === 'cathay-pacific' && J(codes(sent[1])) === J([['reserve_duty', 'no']])
        && J(jal2) === J(jal1) && J(cx2) === J([{ q: 'reserve_duty', c: 'no' }]),
        '★自分の一覧が届いたあとも空のまま。選んで送ると、送る中身の会社は cathay-pacific で、入っているのはいま選んだ1問だけ（JAL の行は動かない）',
        J({ h4, sent: sent.map((x) => [x.airline, codes(x)]), jal2, cx2 }));

      /* D5：同じ会員の「戻る」→「進む」は、もう一度 JAL について開く */
      await shut(u);
      await callFor(u);
      await waitView(u, 'roster');
      await settle(u);
      const hs0 = await histOf(u);
      await u.page.goBack().catch(() => {});
      await waitClosed(u);
      await u.page.goForward().catch(() => {});
      await waitView(u, 'roster');
      await settle(u);
      const f5 = await coFace(u), hs1 = await histOf(u), d5 = await spot(u, 'reserve_duty');
      ok(hs0 && hs0.a === 'jal' && hs1 && hs1.a === 'jal' && f5.line.startsWith('JAL · ') && !f5.text.includes(cx) && d5.val === 'yes' && d5.mine,
        '★「戻る」で閉じて「進む」で戻ると、同じ会員には、もう一度 JAL について開く（JAL に保存した答えが入っている）', J({ hs0, hs1, line: f5.line, d5 }));

      /* D8：このページの会社について打って送らなかった入力は、JAL について開いて閉じたあとも戻る */
      await shut(u);
      await pageEntry(u);
      await waitView(u, 'roster');
      await settle(u);
      await pick(u, 'days_off_request', 'no');                     // このページの会社について打って、送らない
      await tick(u);
      await shut(u);
      await callFor(u);
      await waitView(u, 'roster');
      await settle(u);
      const j8 = { off: (await spot(u, 'days_off_request')).val, own: (await vals(u)).own, line: (await coFace(u)).line };
      await shut(u);
      await pageEntry(u);
      await waitView(u, 'roster');
      await settle(u);
      const c8 = { ...(await both()), own: (await vals(u)).own, line: (await coFace(u)).line };
      ok(j8.line.startsWith('JAL · ') && j8.off === '' && j8.own === false && c8.line.startsWith(cx + ' · ') && c8.off.val === 'no' && c8.duty.val === 'no' && c8.duty.mine && c8.own === false,
        '★このページの会社について打って送らなかった入力は、JAL について開いて閉じたあとも戻る（JAL の入力には出ない）。確認のチェックは戻さない ＝ 入れ直してから送る',
        J({ j8, c8: { off: c8.off.val, duty: c8.duty.val, mine: c8.duty.mine, own: c8.own, line: c8.line } }));

      /* D8b：開いたままの面を、JAL について開き直す（閉じない）。JAL の自分の一覧を読み直して、入力できるようになる */
      const n8 = u.st.calls.length;
      const r8 = await callFor(u);
      const ready = await seen(u, () => {
        const f = document.querySelector('.pvc-root form[data-pvc-form="roster"]'), set = f && f.querySelector('fieldset.pvc-set'), l = f && f.querySelector('.pvc-ctx-line');
        return !!set && !set.disabled && !!l && l.textContent.indexOf('JAL · ') === 0;
      });
      const f8 = await coFace(u), d8 = await spot(u, 'reserve_duty');
      ok(r8 === true && ready && !f8.text.includes(cx) && d8.val === 'yes' && d8.mine && subs(u, n8).length === 0,
        '開いたままの面を JAL について開き直すと、面の会社は JAL に替わり、JAL の自分の一覧を読み直して、入力できるようになる（何も送らない）',
        J({ r8, ready, line: f8.line, d8: { val: d8.val, mine: d8.mine }, sent: subs(u, n8) }));
    } finally {
      await u.st.ctx.close();
      await bare('jal', A); await bare('cathay-pacific', A);
    }
  });

  await scene('別の会社について開いたまま、読む人が替わる', async () => {
    for (const m of [A, B]) { await bare('jal', m); await bare('cathay-pacific', m); }
    const u = await open('phone', { who: 'a' });
    try {
      const sent = tap(u, 'submit_airline_conditions');
      await go(u, CX);
      const cx = await nameOf(u);
      await callFor(u);
      await waitView(u, 'roster');
      await settle(u);
      await pick(u, 'reserve_duty', 'yes');                        // 会員A が JAL について打って、送らない
      const f0 = await coFace(u), h0 = await histOf(u), d0 = await spot(u, 'reserve_duty');
      if (!f0.line.startsWith('JAL · ') || d0.val !== 'yes' || !h0 || h0.a !== 'jal' || h0.u !== A.id) {
        throw new Error('前提が崩れた（会員A が JAL について開いて、1つ打った形になっていない）: ' + J({ line: f0.line, val: d0.val, h0 }));
      }
      const n0 = u.st.calls.length;

      /* (a) ほかのタブで会員B がログインする。このタブには触らない */
      const tab = await otherTab(u);
      await loginIn(tab, 'b');
      const closed = await seen(u, () => {
        const r = document.querySelector('.pvc-root');
        return !window.PVContrib.isOpen() && !!r && !r.classList.contains('is-in') && !(history.state && history.state.pvc);
      });
      const a1 = await u.page.evaluate(() => { const r = document.querySelector('.pvc-root'); return { text: r.textContent, fields: r.querySelectorAll('form, select, input, textarea').length }; });
      const keys = await draftKeys(u);
      ok(closed && !a1.text.includes('JAL') && a1.fields === 0 && !keys.some((k) => k.startsWith('pv_contrib_draft:jal')) && coCalls(u, n0).length === 0,
        '★ほかのタブで別の会員がログインすると、このタブに触らなくても面が閉じる。面の中に、JAL の名前も打ちかけの入力も残らない（JAL の符号の付いた下書きも無い・何も送らない）',
        J({ closed, jal: a1.text.includes('JAL'), fields: a1.fields, keys, calls: coCalls(u, n0) }));

      /* (b)「進む」で面の段へ戻っても、前の人の会社については開かない */
      await u.page.goForward().catch(() => {});
      /* 面が出て、一覧か入力のどちらかが描かれるまで待つ（どちらが出たかは、下の行が見る ＝ 違うものが出た回も、その行で赤くなる） */
      const up2 = await seen(u, () => {
        const r = document.querySelector('.pvc-root');
        return !!r && !r.hidden && r.classList.contains('is-in') && !!(r.querySelector('.pvc-tiles') || r.querySelector('form[data-pvc-form]'));
      });
      const f2 = await coFace(u), h2 = await histOf(u);
      ok(up2 && f2.title === cx + 'に情報を追加' && !f2.text.includes('JAL') && !!h2 && h2.pvc === 1 && h2.t === 'list' && !('a' in h2) && !('n' in h2) && !('u' in h2),
        '★「進む」で戻っても、前の人の会社（JAL）については開かない：このページの会社の一覧が開き、履歴の段からも、JAL と前の人の印が消える', J({ title: f2.title, h2 }));

      /* (c) 次の人が選んで送る（一覧が滑り込み終わってから押す） */
      await waitView(u, 'list');
      await u.page.click('.pvc-root [data-pvc-tile="roster"]');
      await waitView(u, 'roster');
      await settle(u);
      const d3 = await spot(u, 'reserve_duty'), l3 = (await coFace(u)).line;
      await pick(u, 'reserve_duty', 'no');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const db = { aJal: await ownConds('jal', A), bJal: await ownConds('jal', B), aCx: await ownConds('cathay-pacific', A), bCx: await ownConds('cathay-pacific', B) };
      ok(l3.startsWith(cx + ' · ') && d3.val === '' && !d3.mine && sent.length === 1 && sent[0].airline === 'cathay-pacific' && J(codes(sent[0])) === J([['reserve_duty', 'no']])
        && db.aJal.length === 0 && db.bJal.length === 0 && db.aCx.length === 0 && J(db.bCx) === J([{ q: 'reserve_duty', c: 'no' }]),
        '★次の人が選んで送ると、送る中身の会社は cathay-pacific。前の人が JAL について打った答えは入力に無く、JAL へは誰の分も1行も入らない',
        J({ line: l3, d3: { val: d3.val, mine: d3.mine }, sent: sent.map((x) => [x.airline, codes(x)]), db }));
    } finally {
      await u.st.ctx.close();
      for (const m of [A, B]) { await bare('jal', m); await bare('cathay-pacific', m); }
    }
  });

  /* 月の勤務は、別の会社について開いた一覧の「月の勤務」から入る。1回だけ、保存後のカードまで歩く
     （入口は質問の入力と同じ関数を通る。ここは、その道が月の勤務でも最後まで通ることを見る）。 */
  await scene('別の会社について開く ── 月の勤務も、その会社の月として保存される', async () => {
    await bare('jal', A); await bare('cathay-pacific', A);
    const u = await open('phone', { who: 'a' });
    try {
      const sent = tap(u, 'submit_work_month');
      await go(u, CX);
      const cx = await nameOf(u), errs0 = pageErrs.length;
      const r1 = await u.page.evaluate(() => window.PVContrib.openFor({ airline: 'jal', name: 'JAL', ask: [] }));
      await waitView(u, 'list');
      await u.page.click('.pvc-root [data-pvc-tile="work"]');
      await waitView(u, 'work');
      await settle(u);
      const f1 = await coFace(u), w1 = await whoseOf(u);
      await pick(u, 'position', 'fo');
      await fill(u, 'block_hours', '61.5');
      await tick(u);
      await send(u);
      await waitView(u, 'saved');
      const sm = await summary(u), ev = await u.page.evaluate(() => window.__pvcSaved.slice());
      const jal = await ownMonths('jal', A), cxm = await ownMonths('cathay-pacific', A);
      ok(r1 === true && f1.form === 'work' && f1.line.startsWith('JAL · ') && !f1.text.includes(cx) && w1.n === 1 && w1.name === 'JAL' && w1.fixed && w1.seen
        && sent.length === 1 && sent[0].airline === 'jal' && jal.length === 1 && jal[0].block === 61.5 && cxm.length === 0
        && sm.text.includes('JAL') && !sm.text.includes(cx) && ev.length === 1 && ev[0].topic === 'work' && ev[0].slug === 'jal' && pageErrs.length === errs0,
        '月の勤務も、JAL について開ける（一覧の「月の勤務」から）：頭と入力の会社は JAL。送ると JAL の月として保存され、このページの会社には1行も入らない（保存後のカードの会社名も JAL・ページのエラーは出ない）',
        J({ r1, form: f1.form, line: f1.line, whose: w1.name, sent: sent.map((x) => x.airline), jal, cxm, ev, errs: pageErrs.slice(errs0) }));
    } finally {
      await u.st.ctx.close();
      await bare('jal', A); await bare('cathay-pacific', A);
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 19. ほかの人の回答の集計を、誰が読めるか（本物の手元のサーバー・キャセイのページ）
  //     見せてよいかを決めるのはサーバー（db/contrib.sql の pv_contrib_sees の1か所）。
  //     ここは、通信の上の返事と、画面に出た字を見るだけ（ページの部品には手を入れない）。
  //     読む人 ── 未ログイン／会員（給与の鍵なし）／このページの会社に給与を出した会員（鍵が生きている時・切れた時）。
  //     読み口が落ちた時・まだ無い時だけは、その1本を偽の返事にして見る（ほかの通信は本物のまま）。
  //     月の勤務の欄は、ページの上の箱（data-live="work"）で指す（読み口の名前では指さない）。
  //     終わりに、決まりそのものを通しで見る（JAL のページ・読む人は、キャセイに給与を出した会員）：
  //     自分の会社に、要る数まで答えると、ほかの会社が開く。読む人が替わると、答えるカードも回答の行も、その人のものに替わる。
  // ═════════════════════════════════════════════════════════════
  await scene('他人の回答の集計 ── 未ログイン・会員・給与の鍵・期限切れ・読めない時', async () => {
    const SLUG = 'cathay-pacific', PAYER = memberOf('pay');
    const LEDGER = JSON.parse(read('pv-conditions.json')).questions;
    const asked = (id) => LEDGER.find((x) => x.id === id);
    /* 置く回答：2問とも、台帳のいちばん上の選択肢（符号は台帳から読む。打ち込まない） */
    const SEED = ['reserve_duty', 'staff_travel'].map((id) => ({ question_id: id, code: asked(id).choices[0].code }));
    const DUTY = asked('reserve_duty').ja.label, TRAVEL = asked('staff_travel').ja.label;
    /* 画面に出るはずの字。検査が自分で持つ（career-live.js から読み込まない ＝ あちらを変えたら、ここで赤くなる） */
    const LOGIN_LINE = 'ログインと給与の提出で開きます', LOGIN_GO = 'ログイン', PAY_LINE = '給与の提出で開きます', PAY_GO = '匿名で給与を提出する';
    const TABS = ['work', 'pay', 'life', 'overview'];          // 集計の欄か月の勤務の欄を持つタブ（歩く順）
    const TAB_NAME = { work: '勤務・訓練', pay: '給与・待遇', life: '暮らし・家族', overview: '概要' };
    const SLOT_AT = { got: '集まった回答', 'pvg-p-work': '勤務の集計', 'pvg-p-benefits': '待遇の集計', 'pvg-p-living': '通勤の集計' };
    const GATED = (x) => x.live === 'fact' || x.live === 'work';
    const slotName = (x) => (x.live === 'work' ? '月の勤務' : (SLOT_AT[x.at] || x.at || '?'));
    const ALL_SLOTS = ['月の勤務', ...Object.values(SLOT_AT)].sort();

    /* 集計が数えた人数（運営の読み口で、ビューから直接）。画面の人数は、必ずこれと比べる（数字を打ち込まない） */
    const nOf = async (id) => {
      const r = (await q('select n from public.airline_condition_facts where airline = $1 and question_id = $2', [SLUG, id])).rows[0];
      return r ? Number(r.n) : undefined;
    };
    /* 同じ数を、JAL について（決まりの通しで、ほかの会社のページとして開くのが JAL） */
    const nOfJal = async (id) => {
      const r = (await q('select n from public.airline_condition_facts where airline = $1 and question_id = $2', ['jal', id])).rows[0];
      return r ? Number(r.n) : undefined;
    };
    /* その会員が、自分の会社（＝ 給与を出した会社）について答えた、別々の質問の数。サーバーが決まりに使うのと同じ数え方で、運営の読み口から読む
       （数を打ち込まない）。その会社が、その会員の給与の会社でなければ null。 */
    const haveOf = async (m, code) => {
      const r = (await q('select o_have from public.pv_contrib_own($1) where o_code = $2', [m.id, code])).rows[0];
      return r ? Number(r.o_have) : null;
    };
    /* 答えるカードの字。これも検査が自分で持つ（要る数・答えた数・社名は、サーバーと保存先から読んだものを入れる） */
    const GIVE_LINE = (need) => `自分の会社に${need}つ答えると開きます`, GIVE_HEAD = (name) => `${name}の待遇情報を、足りない情報から埋める`;
    const GIVE_COUNT = (have, need) => `あなたが答えた項目：${have}／${need}`, GIVE_GO = '匿名で答える';
    /* 返事を、鍵の順をそろえた全文の字にする。返事どうしは、いつも全文で比べる（J は 300字で切るので、比べるのには使わない） */
    const full = (v) => JSON.stringify(v, (k, x) => ((x && typeof x === 'object' && !Array.isArray(x))
      ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));
    /* 通信の上の返事が、その字だけか（読めた形の全文と、空白を除いた生の字の両方） */
    const only = (r, text) => !!r && r.status === 200 && full(r.body) === text && String(r.text).replace(/\s+/g, '') === text;
    /* この場面の1区切り。途中で止まっても、あとの区切りは見る（止まった区切りは、その名前で赤くなる） */
    const part = async (name, fn) => {
      try { await fn(); } catch (e) { ok(false, `${name} が最後まで進んだ`, String(e && e.message || e).split('\n')[0].slice(0, 220)); }
    };

    /* この場面が自分で付ける耳（開いた1枚ごと・ページへ移る前に付けて、最後に外す）：
       集計の読み口の返事（replies）と、答えるカードの材料の返事（gives）── どちらも、生の字と、読めた形 ── と、出ていった通信の行き先ぜんぶ。 */
    const listen = (p) => {
      const ear = { replies: [], gives: [], urls: [], waits: [] };
      const onRes = (res) => {
        const into = res.url().endsWith('/rest/v1/rpc/pv_contrib_facts') ? ear.replies : (res.url().endsWith('/rest/v1/rpc/pv_contrib_give') ? ear.gives : null);
        if (!into) return;
        const status = res.status();
        ear.waits.push(res.text().then((text) => {
          let body = null;
          try { body = JSON.parse(text); } catch (e) { body = null; }
          into.push({ status, text, body });
        }, () => { into.push({ status, text: null, body: null }); }));
      };
      const onReq = (req) => { ear.urls.push(req.url()); };
      p.page.on('response', onRes);
      p.page.on('request', onReq);
      ear.all = async () => { await Promise.all(ear.waits); return ear.replies; };
      ear.off = () => { p.page.off('response', onRes); p.page.off('request', onReq); };
      return ear;
    };
    /* ページのどの部品よりも先に入れる見張り（open の pre）：鍵の掛かる欄（回答の集計・月の勤務）に「ログイン」の字が出た瞬間を書き留める。
       ログインしている人の欄に、いっときでも未ログインの1行と入口が出ていないかを見る（あとから画面を読んでも、消えた字は見えない）。 */
    const watchLogin = () => {
      window.__pvFactSaw = [];
      new MutationObserver(() => {
        if (window.__pvFactSaw.length >= 20) return;
        for (const n of document.querySelectorAll('.crl[data-live="fact"], .crl[data-live="work"]')) {
          const t = n.textContent || '';
          if (t.indexOf('ログイン') >= 0) window.__pvFactSaw.push(n.getAttribute('data-live') + '：' + t.trim().slice(0, 40));
        }
      }).observe(document, { subtree: true, childList: true, characterData: true });
    };
    const sawLogin = (p) => p.page.evaluate(() => (window.__pvFactSaw || ['見張りが入っていない']).slice());
    /* 見えている生きた欄（.crl[data-live]）を、欄ごとに読む（ページの中で動く・外の変数を使わない）。
       at ＝ 欄の居場所（「集まった回答」は got・板の中の欄は板の id）。字は詰めない（「回答 3人」の空白を残す）。 */
    const slotsNow = () => {
      const vis = (e) => !!e && e.getClientRects().length > 0, tx = (e) => (e ? e.textContent : '').trim();
      return [...document.querySelectorAll('.crl[data-live]')].filter(vis).map((e) => ({
        live: e.getAttribute('data-live'), state: e.getAttribute('data-state'), entry: e.getAttribute('data-entry'),
        at: e.closest('.pvg-got') ? 'got' : ((e.closest('.pvg-panel') || {}).id || ''),
        text: tx(e), lock: [...e.querySelectorAll('.crl-lock')].map(tx),
        rows: [...e.querySelectorAll('.crl-fact')].map((r) => ({ k: tx(r.querySelector('.crl-fact-k')), meta: [...r.querySelectorAll('.crl-ans-m > span')].map(tx) })),
        links: [...e.querySelectorAll('a')].filter(vis).map((a) => ({ text: tx(a), href: a.getAttribute('href') || '', login: a.hasAttribute('data-crl-login') })),
        retry: [...e.querySelectorAll('.crl-retry')].filter(vis).map(tx),
        /* 答えるカード（見出し・答えた数の行・入口の字） */
        give: [...e.querySelectorAll('.crl-give')].map((c) => ({ h: tx(c.querySelector('.crl-give-h')), n: tx(c.querySelector('.crl-give-n')), go: [...c.querySelectorAll('a')].filter(vis).map(tx) })),
      }));
    };
    /* ページのどの部品よりも先に入れる、もう1つの見張り：鍵の掛かる欄（回答の集計・月の勤務。隠れているタブの欄も）が取った
       形と字を、替わるたびに順に書き留める（at ＝ 欄の居場所・s ＝ 欄の形・t ＝ 字・rows ＝ 回答の行の数）。同じ欄の同じ形・同じ字は重ねない。
       場面は、読む人を替える直前に印（mark）を置き、印よりあとに書き留めたものだけを読む ＝「替わったあとに、欄がいっときでも出した字」。
       読む人が替わると、欄はいったん手つかずの形（idle）へ戻る ＝ 印のあとに idle が在ることで、ページが替わったことに気づいたと分かる。 */
    const watchSlots = () => {
      const log = window.__pvSlotLog = [], last = new Map();
      new MutationObserver(() => {
        for (const n of document.querySelectorAll('.crl[data-live="fact"], .crl[data-live="work"]')) {
          const s = n.getAttribute('data-state') || '', t = (n.textContent || '').trim(), key = s + '\n' + t;
          if (last.get(n) === key || log.length >= 800) continue;
          last.set(n, key);
          log.push({ at: (n.closest('.pvg-got') ? 'got' : ((n.closest('.pvg-panel') || {}).id || '')) + ':' + n.getAttribute('data-live'), s, t, rows: n.querySelectorAll('.crl-fact').length });
        }
      }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-state'] });
    };
    const markSlots = (p, name) => p.page.evaluate((m) => { (window.__pvSlotLog || []).push({ mark: m }); }, name);
    /* その印よりあとに書き留めたもの（印が無ければ null ＝ 見張りが入っていない） */
    const sinceMark = async (p, name) => {
      const log = await p.page.evaluate(() => (window.__pvSlotLog || []).slice()), i = log.map((x) => x.mark).lastIndexOf(name);
      return i < 0 ? null : { before: log.slice(0, i).filter((x) => !x.mark), after: log.slice(i + 1).filter((x) => !x.mark) };
    };
    /* ページの中身ぜんぶ（隠れている所も、字でない所も）に、その字が何回出るか */
    const domCount = (p, text) => p.page.evaluate((s) => document.documentElement.outerHTML.split(s).length - 1, text);
    /* いま見えている、鍵の掛かる欄が、どれも落ち着く（手つかずでも読み込み中でもなくなる）まで待つ。時間では待たない */
    const slotsCalm = (p) => seen(p, () => {
      const all = [...document.querySelectorAll('.crl[data-live="fact"], .crl[data-live="work"]')].filter((e) => e.getClientRects().length > 0);
      return all.length > 0 && all.every((e) => !/^(idle|loading)$/.test(e.getAttribute('data-state') || 'idle'));
    });
    const toTab = async (p, id) => {
      await p.page.evaluate((t) => document.querySelector('.pvg-tabs [data-pvg-tab="' + t + '"]').click(), id);
      return (await seen(p, (t) => document.body.classList.contains('pvg-at-' + t), id)) && (await slotsCalm(p));
    };
    /* 4つのタブを歩いて、タブごとに欄を読む。移れなかった・欄が落ち着かなかったタブは lost に入る（下の行で赤くなる） */
    const walk = async (p) => {
      const out = { lost: [] };
      for (const id of TABS) {
        if (await toTab(p, id)) out[id] = await p.page.evaluate(slotsNow);
        else { out[id] = []; out.lost.push(id); }
      }
      return out;
    };
    /* 開いていない人の画面：どのタブでも、見えている集計の欄と月の勤務の欄は、鍵の形で、その1行と（欄が自分で出す）入口だけ。
       回答の行も数字も無い。返すのは、破れている所の文（空なら守れている）と、見た欄の名前（1つも見ずに緑、を防ぐ）。 */
    const lockedBad = (w, line) => {
      const bad = w.lost.map((id) => `${TAB_NAME[id]}：タブへ移れない・欄が落ち着かない`), saw = new Set();
      for (const id of TABS) for (const x of w[id].filter(GATED)) {
        const at = `${TAB_NAME[id]}・${slotName(x)}`;
        saw.add(slotName(x));
        if (x.state !== 'locked') bad.push(`${at}：欄が ${x.state}（鍵の形のはず）`);
        if (x.lock.length !== 1 || x.lock[0] !== line) bad.push(`${at}：1行「${x.lock.join('｜')}」（あるべき「${line}」）`);
        if (x.rows.length) bad.push(`${at}：回答の行が ${x.rows.length}つ`);
        if (x.text !== line + x.links.map((a) => a.text).join('')) bad.push(`${at}：1行と入口のほかの字が在る「${x.text.slice(0, 50)}」`);
        if (/[0-9０-９]/.test(x.text)) bad.push(`${at}：数字が在る「${x.text.slice(0, 50)}」`);
      }
      return { bad, saw: [...saw].sort() };
    };
    const factRows = (w) => TABS.flatMap((id) => w[id].flatMap((x) => x.rows.map((r) => `${TAB_NAME[id]}・${slotName(x)}・${r.k}`)));
    /* 読み直したページが、タブを押せる形になるまで待つ（go が待つのと同じ条件） */
    const ready = (p) => p.page.waitForFunction(() => !!window.PVContrib
      && [...document.styleSheets].some((s) => s.href && s.href.includes('pv-contrib.css')), { timeout: 30000 });
    /* open の pre：端末の保存領域（localStorage・sessionStorage）の、ページが始まる時の中身を写し（s0）、setItem の呼び出しを
       [置き場・鍵・値・呼んだ所] で、全部控える。ページのどの部品よりも、この検査の差し込みよりも、先に入る。 */
    const recordStore = () => {
      const snap = () => {
        const o = { local: {}, session: {} };
        try {
          for (const [at, st] of [['local', window.localStorage], ['session', window.sessionStorage]]) {
            for (let i = 0; i < st.length; i++) { const k = st.key(i); o[at][k] = st.getItem(k); }
          }
        } catch (e) { /* 保存領域に触れない画面は、空のまま */ }
        return o;
      };
      const rec = window.__pvStore = { s0: snap(), log: [], snap };
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function pvRecSet(k, v) {
        try { rec.log.push([this === window.sessionStorage ? 'session' : 'local', String(k), String(v), String(new Error().stack || '')]); } catch (e) { /* 控えられなくても、書き込みは通す */ }
        return real.apply(this, arguments);
      };
    };
    /* いまの中身（s1）と、ページが始まった時の中身（s0）と、控えた書き込み */
    const storeNow = (p) => p.page.evaluate(() => { const R = window.__pvStore; return R ? { s0: R.s0, s1: R.snap(), log: R.log.slice() } : null; });
    /* 控えた「呼んだ所」から、じかに書いた部品（控えの関数のすぐ外の段）を取り出す。deep ＝ じかに書いたのは別の部品で、その奥に career-live.js が居る。
       ページの部品でない段（この検査が open で差し込んだもの）は「検査の差し込み」。 */
    const writerOf = (stack) => {
      const frames = String(stack).split('\n').slice(1).filter((l) => !l.includes('pvRecSet'));
      const fileOf = (l) => {
        const m = /(https?:\/\/[^\s()]+)/.exec(l || '');
        if (!m) return '';
        try { return new URL(m[1]).pathname.replace(/:\d+(:\d+)?$/, '').replace(/^\//, ''); } catch (e) { return ''; }
      };
      const by = fileOf(frames[0]) || '検査の差し込み';
      return { by, deep: by !== 'career-live.js' && frames.slice(1).some((l) => fileOf(l) === 'career-live.js'), top: frames.slice(0, 3).map((l) => l.trim()).join(' ← ') };
    };
    /* 端末の保存領域の、2つの見方（C5b と、決まりの通しの終わりで、同じ式を使う）。S ＝ storeNow が返したもの・WORDS ＝ 写しが在れば入っているはずの字。
       held … (i) で見たものの数（いまの中身と、控えた書き込み。0 なら、何も見ていない）／hits … そのうち、鍵か値に WORDS のどれかを持つもの（置き場:鍵）
       wrote … (ii) ページが始まった時から今までに、新しく出来た・値が替わった鍵と、じかに書いた部品／direct … そのうち、じかに書いたのが career-live.js のもの
       sawSession … 控えが、ログインの書き込みを見ている（見ていなければ、見張りが働かないまま緑になる） */
    const storeLegs = (S, WORDS) => {
      const held = [...['local', 'session'].flatMap((at) => Object.entries(S.s1[at]).map(([k, v]) => [at, k, v])), ...S.log.map((x) => [x[0] + '（控え）', x[1], x[2]])];
      const hits = [...new Set(held.filter(([, k, v]) => WORDS.some((t) => String(k).includes(t) || String(v).includes(t))).map(([at, k]) => `${at}:${k}`))];
      const moved = ['local', 'session'].flatMap((at) => Object.keys(S.s1[at]).filter((k) => S.s0[at][k] !== S.s1[at][k]).map((k) => [at, k]));
      const wrote = moved.map(([at, k]) => {
        const ws = S.log.filter((x) => x[0] === at && x[1] === k).map((x) => writerOf(x[3]));
        return { key: `${at}:${k}`, by: [...new Set(ws.map((x) => x.by))], deep: ws.some((x) => x.deep), top: (ws.find((x) => x.by === 'career-live.js') || {}).top };
      });
      return { held: held.length, hits, wrote, direct: wrote.filter((x) => x.by.includes('career-live.js')), sawSession: wrote.some((x) => x.key === 'local:sb-local-auth-token' && x.by.length > 0) };
    };

    /* 証拠の絵（頼まれた時だけ）。PV_FACT_SHOTS=S1,S2 のように状態の名前を渡すと、その状態の欄を撮って ./temporary screenshots/ に置く。
       渡さなければ何もしない（1枚も開かない・1枚も書かない）。合否には使わない（撮れなくても、検査の行は1つも増えない・減らない）。
       撮るのは、集計の欄か月の勤務の欄を持つカード（タブごとに1枚）。ファイルの名前は 状態・色・会社・タブ・幅。 */
    const SHOTS = String(process.env.PV_FACT_SHOTS || '').split(',').map((s) => s.trim()).filter(Boolean);
    /* S5 と書けば、S5a と S5b の両方 */
    const wants = (state) => SHOTS.includes(state) || SHOTS.includes(state.replace(/[ab]$/, ''));
    const SHOT_DIR = path.join(ROOT, 'temporary screenshots');
    const shotName = (state, theme, tab, w, more = '', co = SLUG) => path.join(SHOT_DIR, `fact-${state}-${theme || 'light'}-${co}-${tab}-${w}${more}.png`);
    /* カードの場所は、ページをいちばん上へ戻してから測る ＝ 画面の上に貼り付くヘッダーとタブの帯が、カードの上に重ならない */
    const cardBox = (p) => p.page.evaluate(() => {
      const e = [...document.querySelectorAll('.crl[data-live="fact"], .crl[data-live="work"]')].find((n) => n.getClientRects().length > 0);
      const c = e ? e.closest('.pvg-card') : null;
      if (!c) return null;
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const r = c.getBoundingClientRect();
      return { x: Math.max(0, Math.floor(r.left)), y: Math.max(0, Math.floor(r.top + window.scrollY)), width: Math.ceil(r.width), height: Math.ceil(r.height) };
    });
    const shootCard = async (p, file) => {
      const clip = await cardBox(p);
      if (clip) { await p.page.screenshot({ path: file, clip, captureBeyondViewport: true }); console.log('  （絵）' + path.basename(file)); }
    };
    /* state ＝ 状態の名前（S1 …）・who ＝ 読む人・theme ＝ 色・sizes ＝ 大きさ・before ＝ ページへ移る前にすること（そのページの st を受け取る）
       ・focus ＝ Tab で焦点を当てる入口の字（勤務・訓練のタブで1枚）・career ＝ 2社の比較（career.html）も1枚（1440 だけ）
       ・at ＝ 開くページ（言わなければ、この場面の会社のページ）・co ＝ そのページの会社の符号（ファイルの名前に入る） */
    const shoot = async (state, { who = null, theme = null, sizes = ['desk', 'tablet', 'phone'], tabs = TABS, before = null, focus = null, career = false, at = CX, co = SLUG } = {}) => {
      if (!wants(state)) return;
      try {
        fs.mkdirSync(SHOT_DIR, { recursive: true });
        for (const size of sizes) {
          const p = await open(size, { who, theme });
          try {
            if (before) await before(p.st);
            await go(p, at);
            for (const id of tabs) {
              if (await toTab(p, id)) await shootCard(p, shotName(state, theme, id, p.size.w, '', co));
            }
            if (focus && size === 'desk' && (await toTab(p, 'work'))) {
              /* 入口へは Tab キーで着く（輪が出る形）：キーボードの操作にしてから、1つ手前へ戻って Tab を1回 */
              await p.page.keyboard.press('Tab');
              const hit = await p.page.evaluate((t) => {
                const a = [...document.querySelectorAll('.crl[data-live] a')].find((n) => n.getClientRects().length > 0 && n.textContent.trim() === t);
                if (a) { a.setAttribute('data-shot-focus', '1'); a.focus(); }
                return !!a;
              }, focus);
              if (hit) {
                await p.page.keyboard.down('Shift'); await p.page.keyboard.press('Tab'); await p.page.keyboard.up('Shift');
                await p.page.keyboard.press('Tab');
                const on = await p.page.evaluate(() => !!document.activeElement && document.activeElement.hasAttribute('data-shot-focus'));
                await shootCard(p, shotName(state, theme, 'work', p.size.w, on ? '-focus' : '-focus-miss'));
              }
            }
            if (career && size === 'desk') {
              await go(p, `/career.html?view=compare&a=${SLUG}&b=jal`);
              await seen(p, () => {
                const all = [...document.querySelectorAll('.crl[data-live="cmp-facts"], .crl[data-live="cmp-work"]')].filter((e) => e.getClientRects().length > 0);
                return all.length > 0 && all.every((e) => !/^(idle|loading)$/.test(e.getAttribute('data-state') || 'idle'));
              });
              const file = shotName(state, theme, 'career-compare', p.size.w);
              await p.page.screenshot({ path: file, fullPage: true });
              console.log('  （絵）' + path.basename(file));
            }
          } finally {
            await p.st.ctx.close();
          }
        }
      } catch (e) {
        console.log(`  （絵 ${state} は撮れなかった：${String(e && e.message || e).split('\n')[0].slice(0, 160)}）`);
      }
    };
    /* S4 ＝ 3人そろっていない欄（開いている人にも「まだ集計がありません」）。撮る直前に、その欄のどの質問も3人未満であることを、
       集計そのものから確かめる。そういう欄がこのページに無ければ、いちばん少ない欄を撮って、その名前と数を書き出す。 */
    const shootThin = async () => {
      if (!wants('S4')) return;
      try {
        fs.mkdirSync(SHOT_DIR, { recursive: true });
        for (const size of ['desk', 'tablet', 'phone']) {
          const p = await open(size, { who: 'pay' });
          try {
            await go(p, CX);
            let best = null;
            for (const id of TABS) {
              if (!(await toTab(p, id))) continue;
              const keys = await p.page.evaluate(() => {
                const e = [...document.querySelectorAll('.crl[data-live="fact"]')].find((n) => n.getClientRects().length > 0);
                return e ? (e.getAttribute('data-keys') || '').split(',').map((k) => k.trim()).filter(Boolean) : [];
              });
              if (!keys.length) continue;
              const have = (await q('select count(*)::int as c from public.airline_condition_facts where airline = $1 and question_id = any($2::text[])', [SLUG, keys])).rows[0].c;
              if (!best || have < best.have) best = { id, have, keys: keys.length };
            }
            if (!best || !(await toTab(p, best.id))) continue;
            console.log(`  （絵 S4：${TAB_NAME[best.id]}の集計の欄。${best.keys}問のうち、3人そろっている質問は ${best.have}問${best.have ? ' ＝ 3人未満だけの欄は、このページに無い' : ''}）`);
            await shootCard(p, shotName('S4', null, best.id, p.size.w));
          } finally {
            await p.st.ctx.close();
          }
        }
      } catch (e) {
        console.log(`  （絵 S4 は撮れなかった：${String(e && e.message || e).split('\n')[0].slice(0, 160)}）`);
      }
    };
    /* S5b ＝ 開いたまま切れて、読み直す：前（鍵が生きている）と、後（鍵が切れて、読み直したあと）の、勤務の集計のカード。
       大きさごとに、鍵を生き返らせて（arm）から撮り、切って（cut）読み直して、もう1枚。撮れても撮れなくても、鍵は切れた形で終える。 */
    const shootTurn = async (arm, cut) => {
      if (!wants('S5b')) return;
      try {
        fs.mkdirSync(SHOT_DIR, { recursive: true });
        for (const size of ['desk', 'tablet', 'phone']) {
          await arm();
          const p = await open(size, { who: 'pay' });
          try {
            await go(p, CX + '#work');
            if (await toTab(p, 'work')) await shootCard(p, shotName('S5b', null, 'work', p.size.w, '-before'));
            await cut();
            await p.page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
            await ready(p);
            if (await toTab(p, 'work')) await shootCard(p, shotName('S5b', null, 'work', p.size.w, '-after'));
          } finally {
            await p.st.ctx.close();
          }
        }
      } catch (e) {
        console.log(`  （絵 S5b は撮れなかった：${String(e && e.message || e).split('\n')[0].slice(0, 160)}）`);
      } finally {
        await cut();
      }
    };
    /* 読めない時の、偽の返事（1回ぶん。gate が、その名前の通信を1本だけ、これで返す） */
    const FAILED = () => ({ name: 'pv_contrib_facts', status: 500, body: { message: 'x' } });
    const MISSING_FN = () => ({ name: 'pv_contrib_facts', status: 404, body: { code: 'PGRST202', message: 'x', details: null, hint: null } });
    /* C2（未ログイン）と C3（会員）で歩いた4つのタブの読み。C9 が、同じ読みで入口の数と置き場を見る */
    let outWalk = null, pilotWalk = null;

    try {
      /* ── 準備：会員A・B・C が、本物の口で2問に答える。給与提出者が、本物の口で、このページの会社に先月ぶんの給与を出す ── */
      const seeded = [];
      for (const k of ['a', 'b', 'c']) seeded.push([k, await rpcAs(k, 'submit_airline_conditions', { airline: SLUG, answers: SEED })]);
      const saved = seeded.every(([, r]) => !!r && r.ok === true && r.saved === SEED.length && Array.isArray(r.rejected) && r.rejected.length === 0);
      ok(saved, '準備：会員A・B・C が、キャセイについて2問（スタンバイ勤務・社員の航空券）に答えた（3人とも2問とも保存・1日の上限に当たっていない）',
        J(seeded.map(([k, r]) => [k, r && r.saved, r && r.rejected, r && r.message])));
      if (!saved) throw new Error('前提が崩れた（3人の回答を置けていない）');
      const n1 = await nOf('reserve_duty'), n2 = await nOf('staff_travel');
      ok(n1 >= 3, `準備：集計が数えた「スタンバイ勤務」の人数は3人以上（読めた数 ${n1}）`);
      ok(n2 >= 3, `準備：集計が数えた「社員の航空券」の人数は3人以上（読めた数 ${n2}）`);
      if (!(n1 >= 3 && n2 >= 3)) throw new Error('前提が崩れた（集計に3人そろっていない）');
      /* 先月 ＝ 保存先の時計の今月の、1つ前（この Mac の時計は使わない・月を打ち込まない・未来の月にしない） */
      const NOW = (await q('select extract(year from current_date)::int as y, extract(month from current_date)::int as m')).rows[0];
      const MONTH = (() => { const t = NOW.y * 12 + (NOW.m - 1) - 1; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; })();
      /* 給与の中身は db/test-work-months.mjs の PAY と同じ（勤務の数字は入れない）。機材は、このファイルの FLEET */
      const reportAs = (key, airline) => rpcAs(key, 'submit_pay_report', {
        currency: 'USD', lang: 'en', tax_rate_pct: 0, position: 'cap', fleet: FLEET,
        base_pay: 9000, flight_variable_pay: 4000, other_allowance: 4400, command_pay: 2000, per_diem: 1000, housing_type: 'allowance', housing_amount: 600,
        airline, period_year: MONTH.y, period_month: MONTH.m,
      });
      const fileReport = () => reportAs('pay', SLUG);
      const filed = await fileReport();
      const armed = !!filed && filed.ok === true && filed.access_until != null;
      ok(armed, `準備：給与提出者が、キャセイに先月（${MONTH.y}年${MONTH.m}月）ぶんの給与を、本物の口で出した（返事に給与の鍵の期限が入っている）`,
        J({ ok: filed && filed.ok, until: filed && filed.access_until, message: filed && filed.message }));
      if (!armed) throw new Error('前提が崩れた（給与を出せていない）');

      /* ── C1：集計のビューは、通信の上で閉じている ── */
      await part('C1', async () => {
        const url = `${base}/rest/v1/airline_condition_facts?select=question_id&airline=eq.${SLUG}`;
        const tok = (await (await fetch(`${base}/__local/login?member=c`)).json()).session.access_token;
        const anon = await fetch(url), anonText = await anon.text();
        const mem = await fetch(url, { headers: { authorization: `Bearer ${tok}` } }), memText = await mem.text();
        const rowsIn = (t) => { try { const v = JSON.parse(t); return Array.isArray(v) ? v.length : 0; } catch (e) { return 0; } };
        ok(anon.status === 401 && mem.status === 403 && [anonText, memText].every((t) => !t.includes('reserve_duty') && rowsIn(t) === 0),
          '★C1 集計のビュー（airline_condition_facts）は、直接は読めない：鍵なしは 401・会員の鍵でも 403。どちらの返事にも、行も「reserve_duty」も無い',
          J({ anon: anon.status, member: mem.status, anonText: anonText.slice(0, 90), memText: memText.slice(0, 90) }));
      });

      /* ── C2：未ログイン（390×680・勤務・訓練のタブから）── */
      await part('C2', async () => {
        const p = await open('phone', { pre: watchLogin });
        const ear = listen(p);
        try {
          await go(p, CX + '#work');
          const w = await walk(p), replies = await ear.all(), L = lockedBad(w, LOGIN_LINE), sawOut = await sawLogin(p);
          outWalk = w;
          ok(L.bad.length === 0 && J(L.saw) === J(ALL_SLOTS),
            `★C2 未ログイン：どのタブでも、集計の欄（4つ）と月の勤務の欄は、鍵の形で「${LOGIN_LINE}」の1行だけ（回答の行も数字も無い）`, J({ bad: L.bad.slice(0, 4), saw: L.saw }));
          const got = w.overview.filter((x) => x.at === 'got');
          ok(got.length === 1 && got[0].lock.length === 1 && got[0].lock[0] === LOGIN_LINE && got[0].links.length === 0,
            '★C2 未ログイン：概要の「集まった回答」も同じ1行で、リンクを1つも持たない', J(got.map((x) => ({ lock: x.lock, links: x.links }))));
          ok(replies.length >= 1 && replies.every((r) => only(r, '{"ok":true,"state":"login"}')),
            '★C2 未ログイン：集計の読み口の返事は、字として {"ok":true,"state":"login"} だけ（ほかの鍵も、行も、数字も付いていない）', J(replies.map((r) => [r.status, r.text])));
          ok(ear.urls.length > 0 && !ear.urls.some((u) => u.includes('airline_condition_facts')),
            '★C2 未ログイン：集計のビューへは、1本も聞きに行っていない（出ていった通信の行き先に airline_condition_facts が無い）', J(ear.urls.filter((u) => u.includes('airline_condition_facts')).slice(0, 3)));
          /* 押すのは最後（ここから先はログインの画面）。ほかは全部、押す前に読んである */
          const logins = w.work.flatMap((x) => x.links).filter((a) => a.login);
          let landed = null;
          if ((await toTab(p, 'work')) && logins.length === 1) {
            await Promise.all([
              p.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
              p.page.evaluate(() => { [...document.querySelectorAll('.crl[data-live] a[data-crl-login]')].find((n) => n.getClientRects().length > 0).click(); }),
            ]);
            landed = await p.page.evaluate(() => ({ path: location.pathname, redirect: new URLSearchParams(location.search).get('redirect') }));
          }
          ok(logins.length === 1 && logins[0].text === LOGIN_GO && logins[0].href.endsWith('%23work') && !!landed && landed.path === '/login.html' && landed.redirect === 'airlines/cathay-pacific.html#work',
            '★C2 未ログイン：勤務・訓練のタブに見えている「ログイン」は1つで、行き先の終わりは %23work。押すとログインの画面に着き、戻り先は airlines/cathay-pacific.html#work（同じタブ）',
            J({ logins, landed }));
          /* 見張りの確かめ（上の行を全部判定してから見る）：未ログインの欄の「ログイン」の字を、見張りが1度は見ているはず。
             見ていなければ、C3・C4 の「いっときも出ていない」は、見張りが働かないまま緑になる */
          if (!sawOut.length) throw new Error('前提が崩れた（見張りが、未ログインの欄の「ログイン」の字を1度も見ていない ＝ 見張りが働いていない）');
        } finally {
          ear.off();
          await p.st.ctx.close();
        }
      });
      await shoot('S1', { focus: LOGIN_GO, career: true });
      await shoot('S1', { theme: 'dark' });

      /* ── C3：会員（確認済みパイロット・給与の鍵なし・1440×820）── */
      let pilotText = null;        // 会員が受け取った返事の、生の字（期限の切れた人の返事と、全文で比べるのに使う）
      await part('C3', async () => {
        const p = await open('desk', { who: 'pilot', pre: watchLogin });
        const ear = listen(p);
        try {
          await go(p, CX + '#work');
          const w = await walk(p), replies = await ear.all(), L = lockedBad(w, PAY_LINE), saw = await sawLogin(p);
          pilotWalk = w;
          pilotText = replies.length ? replies[0].text : null;
          ok(L.bad.length === 0 && J(L.saw) === J(ALL_SLOTS),
            `★C3 会員（給与の鍵なし）：どのタブでも、集計の欄（4つ）と月の勤務の欄は、鍵の形で「${PAY_LINE}」の1行だけ（回答の行も数字も無い）`, J({ bad: L.bad.slice(0, 4), saw: L.saw }));
          const goes = TABS.map((id) => [id, w[id].flatMap((x) => x.links).filter((a) => a.text === PAY_GO)]);
          ok(goes.every(([id, a]) => (id === 'overview' ? a.length <= 1 : a.length === 1) && a.every((x) => x.href.endsWith('pay-report.html?airline=' + SLUG))),
            `★C3 会員：見えている「${PAY_GO}」は、勤務・訓練／給与・待遇／暮らし・家族 のどのタブでも1つだけ（概要では多くて1つ）。行き先は、このページの会社の給与の提出`,
            J(goes.map(([id, a]) => [id, a.map((x) => x.href)])));
          const got = w.overview.filter((x) => x.at === 'got'), rows = factRows(w);
          const named = TABS.flatMap((id) => w[id].filter((x) => x.text.includes(DUTY) || x.text.includes(TRAVEL)).map((x) => `${TAB_NAME[id]}・${slotName(x)}`));
          ok(got.length === 1 && got[0].rows.length === 0 && rows.length === 0 && named.length === 0,
            '★C3 会員：「集まった回答」に回答の行が無い。どのタブのどの欄にも、回答の行が1つも無い（スタンバイ勤務・社員の航空券の質問の名前も出ない）', J({ rows: rows.slice(0, 4), named }));
          ok(replies.length >= 1 && replies.every((r) => only(r, '{"ok":true,"state":"locked"}')),
            '★C3 会員：集計の読み口の返事は、字として {"ok":true,"state":"locked"} だけ（ほかの鍵も、行も、数字も付いていない）', J(replies.map((r) => [r.status, r.text])));
          ok(saw.length === 0, '★C3 会員：集計の欄にも月の勤務の欄にも、「ログイン」の字が、いっときも出ていない（未ログインの1行を、先に出していない）', J(saw.slice(0, 3)));
        } finally {
          ear.off();
          await p.st.ctx.close();
        }
      });
      await shoot('S2', { who: 'pilot', focus: PAY_GO, career: true });
      await shoot('S2', { who: 'pilot', theme: 'dark' });

      /* ── C4：このページの会社に給与を出した会員（自分の会社のページ・自分では1問も答えていない・1440×820）── */
      await part('C4', async () => {
        const p = await open('desk', { who: 'pay', pre: watchLogin });
        const ear = listen(p);
        try {
          await go(p, CX + '#work');
          const w = await walk(p), replies = await ear.all(), saw = await sawLogin(p), n = await nOf('reserve_duty');
          /* 「スタンバイ勤務」を持つ欄は2つ（勤務・訓練のタブの集計・概要の「集まった回答」）。その行を、欄ごとに取り出す */
          const holders = [...w.work.filter((x) => x.at === 'pvg-p-work' && x.live === 'fact'), ...w.overview.filter((x) => x.at === 'got')];
          const duty = holders.map((x) => x.rows.filter((r) => r.k === DUTY));
          ok(replies.length >= 1 && replies.every((r) => r.status === 200 && !!r.body && r.body.state === 'open') && holders.length === 2
            && holders.every((x) => x.state === 'open') && duty.every((rs) => rs.length === 1),
            '★C4 給与を出した会員が、自分の会社のページを開く：返事は open。「スタンバイ勤務」の行が、その質問を持つ2つの欄（勤務の集計・集まった回答）に1つずつ出る',
            J({ states: replies.map((r) => r.body && r.body.state), holders: holders.map((x) => [slotName(x), x.state, x.rows.map((r) => r.k)]) }));
          /* CM3：自分の会社は、答えが要らない ── この時点で、給与提出者がこの会社について答えた質問の数（サーバーと同じ数え方）は 0。開いたのは、給与を出したことだけで */
          const mine = await haveOf(PAYER, SLUG);
          ok(mine === 0 && replies.length >= 1 && replies.every((r) => r.status === 200 && !!r.body && r.body.state === 'open') && holders.length === 2 && holders.every((x) => x.state === 'open'),
            '★CM3 自分の会社のページは、自分では1問も答えていなくても開いている：この時点で、給与提出者がこの会社について答えた質問の数は 0（開いたのは、給与を出したことだけで）',
            J({ have: mine, states: replies.map((r) => r.body && r.body.state), holders: holders.map((x) => [slotName(x), x.state]) }));
          ok(duty.length === 2 && duty.every((rs) => rs.length === 1 && rs[0].meta.filter((t) => t === `回答 ${n}人`).length === 1 && rs[0].meta.filter((t) => /人/.test(t)).length === 1),
            `★C4 その行の人数は「回答 ${n}人」── 集計が数えた人数そのまま（行に1つだけ）`, J(duty.map((rs) => rs.map((r) => r.meta))));
          ok(duty.length === 2 && duty.every((rs) => rs.length === 1 && rs[0].meta.filter((t) => /^\d{4}年\d{1,2}月$/.test(t)).length === 1),
            '★C4 その行に、最後に確かめられた月（YYYY年M月）が出ている', J(duty.map((rs) => rs.map((r) => r.meta))));
          const shut = TABS.flatMap((id) => w[id].filter(GATED).filter((x) => x.lock.length || !/^(open|empty)$/.test(x.state)).map((x) => `${TAB_NAME[id]}・${slotName(x)}（${x.state}）`));
          const sawSlots = [...new Set(TABS.flatMap((id) => w[id].filter(GATED).map(slotName)))].sort();
          ok(shut.length === 0 && w.lost.length === 0 && J(sawSlots) === J(ALL_SLOTS),
            '★C4 どのタブの集計の欄にも月の勤務の欄にも、鍵の1行が無い（開いた形か「まだ集計がありません」）', J({ shut, lost: w.lost, saw: sawSlots }));
          ok(saw.length === 0, '★C4 集計の欄にも月の勤務の欄にも、「ログイン」の字が、いっときも出ていない', J(saw.slice(0, 3)));
        } finally {
          ear.off();
          await p.st.ctx.close();
        }
      });
      await shoot('S3', { who: 'pay' });
      await shootThin();
      /* ここまで、給与提出者の鍵は生きたまま */

      /* 給与の鍵の期限を、過去にする（保存先の時計で。ページの時計は動かさない） */
      const expire = () => q("update public.profiles set access_until = now() - interval '1 minute' where id = $1", [PAYER.id]);
      /* 期限の切れた人の、返事と画面（C5a と、C5b の読み直しのあとで、同じ3つを見る） */
      const expiredFace = (tag, w, replies) => {
        const L = lockedBad(w, PAY_LINE), rows = factRows(w);
        const named = TABS.flatMap((id) => w[id].filter((x) => x.text.includes(DUTY)).map((x) => `${TAB_NAME[id]}・${slotName(x)}`));
        ok(pilotText !== null && replies.length >= 1 && replies.every((r) => r.text === pilotText && only(r, '{"ok":true,"state":"locked"}')),
          `★${tag}：集計の読み口の返事は、会員（給与の鍵なし）が受け取った返事と、全文で同じ字（{"ok":true,"state":"locked"}）`,
          J({ pilot: pilotText, got: replies.map((r) => [r.status, r.text]) }));
        ok(L.bad.length === 0 && J(L.saw) === J(ALL_SLOTS),
          `★${tag}：どのタブでも、集計の欄（4つ）と月の勤務の欄は、鍵の形で「${PAY_LINE}」の1行だけ（数字が無い）`, J({ bad: L.bad.slice(0, 4), saw: L.saw }));
        ok(w.lost.length === 0 && rows.length === 0 && named.length === 0,
          `★${tag}：「スタンバイ勤務」の行は、どのタブのどの欄にも無い（回答の行が1つも無い）`, J({ rows: rows.slice(0, 4), named, lost: w.lost }));
      };

      /* ── C5a：期限の切れた人が開く（390×680）── */
      await part('C5a', async () => {
        await expire();
        const p = await open('phone', { who: 'pay' });
        const ear = listen(p);
        try {
          await go(p, CX + '#work');
          const w = await walk(p);
          expiredFace('C5a 期限の切れた人が開く', w, await ear.all());
        } finally {
          ear.off();
          await p.st.ctx.close();
        }
      });
      await shoot('S5a', { who: 'pay' });

      /* ── C5b：開いたまま切れて、読み直す（1440×820）。保存領域は、開いた形が出ている1回の読み込みの中で見る ── */
      await part('C5b', async () => {
        /* 鍵を生き返らせる：同じ会社・同じ月の給与を、本物の口でもう一度出す（行は置き換わり、鍵は今から先へ延びる） */
        const again = await fileReport();
        const live = (await q('select access_until > now() as live from public.profiles where id = $1', [PAYER.id])).rows[0];
        if (!(again && again.ok === true && again.access_until != null && live && live.live === true)) {
          throw new Error('前提が崩れた（給与を出し直しても、給与の鍵が生き返っていない）: ' + J({ ok: again && again.ok, until: again && again.access_until, live }));
        }
        const p = await open('desk', { who: 'pay', pre: recordStore });
        const ear = listen(p);
        try {
          await go(p, CX + '#work');
          const n = await nOf('reserve_duty');
          const drawn = await seen(p, (a) => [...document.querySelectorAll('.crl[data-live="fact"] .crl-fact')].some((r) => r.getClientRects().length > 0
            && (r.querySelector('.crl-fact-k') || {}).textContent === a.k && [...r.querySelectorAll('.crl-ans-m > span')].some((s) => s.textContent === a.n)), { k: DUTY, n: `回答 ${n}人` });
          if (!drawn) throw new Error('前提が崩れた（鍵が生きている人に、開いた形が描かれていない）');
          const S = await storeNow(p);
          if (!S) throw new Error('前提が崩れた（保存領域の控えが入っていない）');
          /* (i) 値を見る：いまの中身と、控えた書き込みの、どの鍵にも値にも、集計を写した字が無い */
          const { held, hits, wrote, direct, sawSession } = storeLegs(S, ['pv_contrib_facts', '"median_num"', '"lead"', 'fact:']);
          ok(held > 0 && hits.length === 0,
            '★C5b 開いた形が出ているあいだ、端末の保存領域（localStorage・sessionStorage・控えた書き込み）のどの鍵にも値にも、集計を写した字（pv_contrib_facts・"median_num"・"lead"・fact:）が無い',
            J(hits.slice(0, 6)));
          /* (ii) 前と後：ページが始まった時から、開いた形が出た時までに、新しく出来た・値が替わった鍵。じかに書いたのが career-live.js のものは無い */
          ok(sawSession && direct.length === 0,
            '★C5b ページが始まってから開いた形が出るまでに、新しく出来た・値が替わった保存領域の鍵のうち、career-live.js がじかに書いたものは1つも無い',
            J(direct.length ? direct.map((x) => [x.key, x.top]) : wrote.map((x) => x.key)));
          /* 鍵の名前と、じかに書いた部品（値は出さない）。合否には使わない */
          console.log('    （C5b：そのあいだに出来た・替わった鍵 ← じかに書いた部品 ── ' + wrote.map((x) => `${x.key} ← ${x.by.join('・') || '控えに無い（setItem を通らない書き方）'}${x.deep ? '（奥に career-live.js）' : ''}`).join('／') + '）');

          /* 鍵を切って、読み直す */
          const before = (await ear.all()).length;
          await expire();
          await p.page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
          await ready(p);
          const w = await walk(p);
          expiredFace('C5b 開いたまま切れて、読み直す', w, (await ear.all()).slice(before));
        } finally {
          ear.off();
          await p.st.ctx.close();
        }
      });
      await shootTurn(fileReport, expire);
      /* ここから先、給与提出者の鍵は切れたまま */

      /* ── C6：集計の読み口が落ちた時（会員・390×680・概要の「集まった回答」）── */
      const gotNow = async (p) => (await p.page.evaluate(slotsNow)).filter((x) => x.at === 'got');
      await part('C6', async () => {
        const p = await open('phone', { who: 'pilot' });
        try {
          p.st.fake = FAILED();
          await go(p, CX);
          const calm = await slotsCalm(p), g0 = await gotNow(p);
          ok(calm && g0.length === 1 && g0[0].state === 'error' && g0[0].text === 'いま読み出せません' + 'やり直す' && J(g0[0].retry) === J(['やり直す']) && g0[0].rows.length === 0 && g0[0].lock.length === 0,
            '★C6 集計の読み口が落ちた時（500）：「集まった回答」は「いま読み出せません」と「やり直す」だけ（「まだ集計がありません」とも、鍵とも言わない）', J(g0.map((x) => [x.state, x.text, x.retry])));
          const pressed = await p.page.evaluate(() => { const b = document.querySelector('.pvg-got .crl-retry'); if (b) b.click(); return !!b; });
          const back = pressed && (await seen(p, () => { const e = document.querySelector('.pvg-got .crl[data-live="fact"]'); return !!e && e.getAttribute('data-state') === 'locked'; }));
          const g1 = await gotNow(p);
          ok(back && g1.length === 1 && J(g1[0].lock) === J([PAY_LINE]) && g1[0].retry.length === 0 && g1[0].text === PAY_LINE,
            `★C6 「やり直す」を押すと、本物の返事が描かれる（会員には「${PAY_LINE}」の1行）`, J({ pressed, got: g1.map((x) => [x.state, x.text]) }));
        } finally {
          await p.st.ctx.close();
        }
      });
      await shoot('S6', { who: 'pilot', tabs: ['overview'], before: (st) => { st.fake = FAILED(); } });

      /* ── C7：集計の読み口が、まだ無い時（会員・390×680・概要の「集まった回答」）── */
      await part('C7', async () => {
        const p = await open('phone', { who: 'pilot' });
        try {
          p.st.fake = MISSING_FN();
          await go(p, CX);
          const calm = await slotsCalm(p), g = await gotNow(p);
          ok(calm && g.length === 1 && g[0].state === 'off' && g[0].text === '準備中' && g[0].retry.length === 0 && g[0].rows.length === 0 && g[0].lock.length === 0,
            '★C7 集計の読み口がまだ無い時（404）：「集まった回答」は「準備中」だけ（「まだ集計がありません」とも言わない・数字も無い）', J(g.map((x) => [x.state, x.text, x.retry])));
        } finally {
          await p.st.ctx.close();
        }
      });
      await shoot('S7', { who: 'pilot', before: (st) => { st.fake = MISSING_FN(); } });

      /* ── C9：入口の数と置き場（未ログイン・会員）。C2 と C3 で歩いた4つのタブの読みを、そのまま使う（開き直さない）──
         a「匿名で給与を提出する」は、1つのタブに見えているものが、多くて1つ
         b 入口を自分では出さない欄（印 data-entry が "0" か "give"）が鍵の1行を出しているタブには、
           見えている欄のどれかに、その人の入口が在る（未ログイン ＝ ログインの画面へ／会員 ＝ このページの会社の、給与の提出へ） */
      const entryBad = (w, who) => {
        if (!w) return { bad: ['4つのタブを歩いた読みが無い'], stamped: [] };
        const bad = [], stamped = [];
        for (const id of TABS) {
          const on = w[id].flatMap((x) => x.links), goes = on.filter((a) => a.text === PAY_GO);
          if (goes.length > 1) bad.push(`${TAB_NAME[id]}：「${PAY_GO}」が ${goes.length}つ見えている`);
          const has = on.some((a) => a.href.includes(who === 'login' ? 'login.html' : 'pay-report.html?airline=' + SLUG));
          for (const x of w[id].filter((s) => (s.entry === '0' || s.entry === 'give') && s.lock.length)) {
            stamped.push(slotName(x));
            if (!has) bad.push(`${TAB_NAME[id]}：${slotName(x)}（印 ${x.entry}）が鍵の1行を出しているのに、同じタブの見えている欄に、${who === 'login' ? 'ログイン' : '給与の提出'}の入口が無い`);
          }
        }
        return { bad, stamped: stamped.sort() };
      };
      const STAMPED = ['勤務の集計', '集まった回答'].sort();
      const eOut = entryBad(outWalk, 'login'), eIn = entryBad(pilotWalk, 'locked');
      ok(eOut.bad.length === 0 && J(eOut.stamped) === J(STAMPED),
        `C9 未ログイン：どのタブでも、見えている「${PAY_GO}」は多くて1つ。入口を自分では出さない欄（勤務の集計・集まった回答）が鍵の1行を出しているタブには、見えている欄のどれかに、ログインの入口が在る`,
        J(eOut));
      ok(eIn.bad.length === 0 && J(eIn.stamped) === J(STAMPED),
        `C9 会員：どのタブでも、見えている「${PAY_GO}」は多くて1つ。入口を自分では出さない欄（勤務の集計・集まった回答）が鍵の1行を出しているタブには、見えている欄のどれかに、このページの会社の給与の提出の入口が在る`,
        J(eIn));

      /* ══ ここから、決まりそのものの通し ── 自分の会社に、要る数まで答えると、ほかの会社が開く ══
         読む人は給与提出者（自分の会社 ＝ キャセイ）。開くのは、ほかの会社（JAL）のページ。390×680。
         要る数も、答えた数も、会社の名前も、サーバーと保存先から読む（打ち込まない）。行を消して合わせることもしない
         ── 前提が合わなければ、その数を名指しして止まる。
         CM1 → CM4b → CM2 → CM4 は、同じ1枚の上で続く（読み直さない）。前の区切りが残した形が崩れていれば、あとの区切りも止まる。
         この通しの中で、通信の本数を数える行は無い（保存のあとは、開いた返事が届くことを、届くまで待って見る）。 */
      const OWN = SLUG, B_OWN = 'ana', BEE = memberOf('b');
      const { OTP } = await import('./serve-local.mjs');
      const nameIn = async (code) => String(((await q('select name_ja from public.pv_airlines where code = $1', [code])).rows[0] || {}).name_ja || '');
      const OWN_NAME = await nameIn(OWN), JAL_NAME = await nameIn('jal'), B_NAME = await nameIn(B_OWN);
      if (!OWN_NAME || !JAL_NAME || !B_NAME || new Set([OWN_NAME, JAL_NAME, B_NAME]).size !== 3) throw new Error('前提が崩れた（会社の一覧から、3社の名前が読めない）: ' + J([OWN_NAME, JAL_NAME, B_NAME]));

      /* ── 準備 ── 給与提出者の鍵は、C5b のあと切れたまま ＝ 同じ会社・同じ月の給与を、本物の口でもう一度出して生き返らせる。
         会員B は、ANA に先月ぶんの給与を、本物の口で出す（CM4b と CM5 の読む人 ＝ 自分の会社が ANA の人）。 */
      const rearmed = await fileReport(), bFiled = await reportAs('b', B_OWN);
      const liveOf = async (m) => { const r = (await q('select access_until > now() as live from public.profiles where id = $1', [m.id])).rows[0]; return !!r && r.live === true; };
      const keysLive = !!rearmed && rearmed.ok === true && !!bFiled && bFiled.ok === true && (await liveOf(PAYER)) && (await liveOf(BEE));
      ok(keysLive, `準備：給与提出者が、同じ月の給与を出し直した。会員B が、ANA に先月（${MONTH.y}年${MONTH.m}月）ぶんの給与を、本物の口で出した（2人とも、給与の鍵の期限は今より先）`,
        J({ pay: rearmed && [rearmed.ok, rearmed.access_until, rearmed.message], b: bFiled && [bFiled.ok, bFiled.access_until, bFiled.message] }));
      if (!keysLive) throw new Error('前提が崩れた（給与の鍵を用意できていない）');
      const NEED = Number((await q('select public.pv_contrib_need() as n')).rows[0].n);
      const have0 = await haveOf(PAYER, OWN), B_HAVE = await haveOf(BEE, B_OWN);
      if (B_HAVE === null || B_HAVE >= NEED) throw new Error(`前提が崩れた（会員B が、自分の会社（ANA）について答えた数が ${B_HAVE}。要る数 ${NEED} より少ないはず。行は消さない）`);
      if (have0 === null || have0 >= NEED) throw new Error(`前提が崩れた（給与提出者が、自分の会社について答えた数が ${have0}。要る数 ${NEED} より少ないはず。行は消さない）`);
      /* 給与提出者が、自分の会社について、親を持たない「選ぶ」質問に、要る数の1つ手前まで答える
         （本物の口から。まだ触っていない質問だけ・「わからない」でない最初の選択肢 ＝ 数えられる答え） */
      const touched = new Set((await ownConds(OWN, PAYER)).map((r) => r.q));
      const fillUp = LEDGER.filter((x) => !x.parent && x.kind === 'choice' && x.active !== false && !touched.has(x.id)).slice(0, NEED - 1 - have0)
        .map((x) => ({ question_id: x.id, code: x.choices.find((c) => c.code !== 'unknown').code }));
      const filled = fillUp.length ? await rpcAs('pay', 'submit_airline_conditions', { airline: OWN, answers: fillUp }) : { ok: true, saved: 0, rejected: [] };
      for (const x of fillUp) touched.add(x.question_id);
      const HAVE = await haveOf(PAYER, OWN);
      if (!(filled && filled.ok === true && filled.saved === fillUp.length && (filled.rejected || []).length === 0 && HAVE === NEED - 1)) {
        throw new Error('前提が崩れた（給与提出者の答えた数を、要る数の1つ手前にできていない）: ' + J({ have0, HAVE, NEED, sent: fillUp.length, reply: filled && [filled.saved, filled.rejected, filled.message] }));
      }
      ok(NEED === 5 && HAVE === NEED - 1 && HAVE < NEED,
        `CM0 要る数は 5（サーバーの1か所から読んだ数）。給与提出者が、自分の会社について答えた数は、その1つ手前（読めた数 ${HAVE}／${NEED}）`, J({ NEED, HAVE, have0 }));
      /* 会員A・B・C が、JAL について「スタンバイ勤務」に答える（ほかの会社のページに、3人そろった行を1つ作る） */
      const jalSeed = [];
      for (const k of ['a', 'b', 'c']) jalSeed.push([k, await rpcAs(k, 'submit_airline_conditions', { airline: 'jal', answers: [SEED[0]] })]);
      const N_JAL = await nOfJal('reserve_duty');
      const jalOk = jalSeed.every(([, r]) => !!r && r.ok === true && Array.isArray(r.rejected) && r.rejected.length === 0) && N_JAL >= 3;
      ok(jalOk, `準備：会員A・B・C が、JAL について「スタンバイ勤務」に答えた。JAL の集計が数えた人数は3人以上（読めた数 ${N_JAL}）`,
        J(jalSeed.map(([k, r]) => [k, r && r.saved, r && r.rejected, r && r.message])));
      if (!jalOk) throw new Error('前提が崩れた（JAL の集計に3人そろっていない）');

      const GIVE_TEXT = '{"ok":true,"state":"give"}', WALK = 'pv-walk';
      /* 字の中の数（字として書かれた所 "…" の中は数えない）。返事が運んでいる数が、どれとどれかを見る */
      const numsIn = (text) => (String(text).replace(/"(?:[^"\\]|\\.)*"/g, '""').match(/\d+/g) || []).map(Number).sort((x, y) => x - y);
      const gotOf = async (p) => (await gotNow(p))[0] || null;
      /* 「集まった回答」が、その人の答えるカードの形か：1行（要る数）と、カード（その会社の名前・答えた数／要る数・入口1つ）だけ */
      const cardIs = (x, name, have) => !!x && x.state === 'locked' && J(x.lock) === J([GIVE_LINE(NEED)]) && x.rows.length === 0 && x.give.length === 1
        && x.give[0].h === GIVE_HEAD(name) && x.give[0].n === GIVE_COUNT(have, NEED) && J(x.give[0].go) === J([GIVE_GO])
        && x.text === GIVE_LINE(NEED) + GIVE_HEAD(name) + GIVE_COUNT(have, NEED) + GIVE_GO;
      const cardSeen = (p, name, have) => seen(p, (a) => {
        const e = document.querySelector('.pvg-got .crl[data-live="fact"]'), h = e && e.querySelector('.crl-give-h'), n = e && e.querySelector('.crl-give-n');
        return !!h && !!n && h.textContent.trim() === a.h && n.textContent.trim() === a.n;
      }, { h: GIVE_HEAD(name), n: GIVE_COUNT(have, NEED) });
      const sameLoad = (p) => p.page.evaluate(() => ({ mark: window.__pvWalk, origin: performance.timeOrigin, navs: performance.getEntriesByType('navigation').length }));
      /* 同じブラウザの、もう1枚のタブ。サイトのページ（ANA のページ）を開いておき、ログインは、そのページ自身のログインの部品で、
         本物の口から行う（メールのコード ＝ ログインの画面がしているのと同じ呼び出し）。こうして入ったログインは、最初のタブのページにも
         「読む人が替わった」と伝わる。
         ⚠️ このファイルの loginIn（保存領域へじかに書く）は、ここでは使わない ── じかに書いたログインは、「情報を追加」の面には伝わるが、
            ページの欄（career-live.js）には伝わらない（欄は、ログインの部品の知らせでだけ、読む人が替わったことを知る）。 */
      const siteTab = async (p) => {
        const t = await otherTab(p);
        await t.goto(base + ANA, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await t.waitForFunction(() => !!(window.PVCareer && typeof window.PVCareer.client === 'function'), { timeout: 30000 });
        await p.page.bringToFront();
        return t;
      };
      const signInTab = async (tab, key) => {
        const m = memberOf(key), s = await (await fetch(`${base}/__local/login?member=${key}`)).json();
        const r = await tab.evaluate((email, code, name) => window.PVCareer.client()
          .then((sb) => sb.auth.verifyOtp({ email, token: code, type: 'email' }))
          .then((x) => {
            const id = x && x.data && x.data.user ? x.data.user.id : null;
            if (id) localStorage.setItem('pv_user', JSON.stringify(name));
            return { id, err: x && x.error ? String(x.error.message || x.error) : '' };
          }), m.email, OTP, s.pv_user);
        if (r.id !== m.id) throw new Error(`前提が崩れた（もう1枚のタブで、${m.ja}としてログインできていない）: ` + J(r));
      };

      let wk = null;                 // 通しの1枚 ＝ { p, ear, sent, tab, origin, fileN, first }（first ＝ CM2 が画面から答えた、5つ目の質問）
      try {
        /* ── CM1：最後の1問の手前（要る数に1つ足りない人が、ほかの会社のページを開く）── */
        await part('CM1', async () => {
          const p = await open('phone', { who: 'pay', pre: recordStore });
          wk = { p, ear: listen(p), sent: tap(p, 'submit_airline_conditions'), tab: null, origin: null, fileN: null, first: null };
          await p.page.evaluateOnNewDocument(watchSlots);
          await go(p, JAL);
          /* 配られたページそのものに、自分の会社の名前が何回書いてあるか（誰が開いても同じ数。カードが足したぶんと分けるのに使う） */
          wk.fileN = (await (await fetch(base + JAL)).text()).split(OWN_NAME).length - 1;
          const w = await walk(p);                       // 4つのタブを歩く。終わりは概要
          wk.origin = await p.page.evaluate((m) => { window.__pvWalk = m; return performance.timeOrigin; }, WALK);
          const replies = await wk.ear.all(), gives = wk.ear.gives.slice();
          ok(replies.length >= 1 && replies.every((r) => only(r, GIVE_TEXT) && !/[0-9]/.test(String(r.text))),
            '★CM1 給与は出したが、自分の会社への回答が要る数に1つ足りない人が、ほかの会社（JAL）のページを開く：集計の読み口の返事は、字として {"ok":true,"state":"give"} だけ（数字が1つも無い）',
            J(replies.map((r) => [r.status, r.text])));
          const askOk = (ask) => Array.isArray(ask) && ask.length >= 1 && ask.length <= 8 && new Set(ask).size === ask.length
            && ask.every((id) => typeof id === 'string' && /^[a-z0-9_]{1,64}$/.test(id) && !!asked(id) && !touched.has(id));
          ok(gives.length >= 1 && gives.every((g) => g.status === 200 && !!g.body && askOk(g.body.ask)
            && full(g.body) === full({ ok: true, state: 'give', airline: OWN, name: OWN_NAME, have: HAVE, need: NEED, ask: g.body.ask })
            && J(numsIn(g.text)) === J([HAVE, NEED].sort((x, y) => x - y))),
            `★CM1 答えるカードの材料の返事は、読む人自身のことだけ：会社は自分の会社（${OWN}）・名前は会社の一覧の名前・答えた数 ${HAVE}・要る数 ${NEED}・次に聞く質問は、まだ触っていない質問の id の並び（8つまで）。数は、その2つのほかに1つも無い`,
            J(gives.map((g) => [g.status, g.text])));
          const got = w.overview.filter((x) => x.at === 'got');
          ok(got.length === 1 && cardIs(got[0], OWN_NAME, HAVE),
            `★CM1 概要の「集まった回答」は、1行「${GIVE_LINE(NEED)}」と、答えるカード（「${GIVE_HEAD(OWN_NAME)}」・「${GIVE_COUNT(HAVE, NEED)}」・「${GIVE_GO}」が1つ）だけ`,
            J(got.map((x) => ({ state: x.state, lock: x.lock, give: x.give, text: x.text.slice(0, 90) }))));
          const all = TABS.flatMap((id) => w[id].map((x) => [`${TAB_NAME[id]}・${GATED(x) ? slotName(x) : x.live}`, x]));
          const rowsAt = all.filter(([, x]) => x.rows.length).map(([at]) => at), countAt = all.filter(([, x]) => x.text.includes(`${N_JAL}人`)).map(([at]) => at);
          const gated = all.filter(([, x]) => GATED(x)), offLine = gated.filter(([, x]) => x.state !== 'locked' || J(x.lock) !== J([GIVE_LINE(NEED)])).map(([at, x]) => `${at}（${x.state}）`);
          ok(w.lost.length === 0 && rowsAt.length === 0 && countAt.length === 0 && offLine.length === 0 && J([...new Set(gated.map(([, x]) => slotName(x)))].sort()) === J(ALL_SLOTS),
            `★CM1 どのタブのどの欄にも、回答の行が無い。JAL の集計が数えた人数（${N_JAL}人）の字も無い。集計の欄（4つ）と月の勤務の欄は、どれも鍵の形で、同じ1行`,
            J({ rowsAt, countAt, offLine, lost: w.lost, slots: all.length }));
        });
        await shoot('S8', { who: 'pay', at: JAL, co: 'jal' });
        await shoot('S8', { who: 'pay', theme: 'dark', at: JAL, co: 'jal' });

        /* ── CM4b：カードは、読む人と一緒に替わる（もう1枚のタブで、会員B がログインする。こちらは読み直さない）── */
        await part('CM4b', async () => {
          if (!wk) throw new Error('前提が崩れた（通しの1枚が開いていない）');
          const { p, ear } = wk;
          const g0 = await gotOf(p), dom0 = await domCount(p, OWN_NAME);
          if (!cardIs(g0, OWN_NAME, HAVE) || !(dom0 > wk.fileN)) throw new Error('前提が崩れた（給与提出者のカードが出ていない）: ' + J({ got: g0 && [g0.state, g0.text.slice(0, 70)], dom0, file: wk.fileN }));
          wk.tab = await siteTab(p);
          await ear.all();
          const v0 = ear.gives.length;
          await markSlots(p, 'CM4b');
          await signInTab(wk.tab, 'b');
          const turned = await cardSeen(p, B_NAME, B_HAVE);
          await ear.all();
          const g1 = await gotOf(p), dom1 = await domCount(p, OWN_NAME), log = await sinceMark(p, 'CM4b'), kept = await sameLoad(p);
          const gives1 = ear.gives.slice(v0);
          ok(turned && cardIs(g1, B_NAME, B_HAVE) && kept.mark === WALK && kept.origin === wk.origin && kept.navs === 1
            && gives1.length >= 1 && gives1.every((g) => !!g.body && g.body.airline === B_OWN && g.body.name === B_NAME && g.body.have === B_HAVE && g.body.need === NEED),
            `★CM4b もう1枚のタブで別の会員（会員B）がログインすると、読み直さなくても、カードはその人のものに替わる：会社の名前は ANA のもの・答えた数はその人の数（${B_HAVE}／${NEED}）`,
            J({ turned, got: g1 && { lock: g1.lock, give: g1.give }, kept, gives: gives1.map((g) => g.body && [g.body.airline, g.body.have]) }));
          const inPage = await p.page.evaluate((s) => ({
            slots: [...document.querySelectorAll('.crl')].filter((n) => (n.textContent || '').includes(s)).length,
            sheet: [...document.querySelectorAll('.pvc-root')].filter((n) => n.outerHTML.includes(s)).length,
          }), OWN_NAME);
          ok(dom1 === wk.fileN && inPage.slots === 0 && inPage.sheet === 0
            && !!log && log.before.some((x) => x.t.includes(OWN_NAME)) && log.after.some((x) => x.s === 'idle') && !log.after.some((x) => x.t.includes(OWN_NAME)),
            `★CM4b 前の人の会社の名前（${OWN_NAME}）は、ページのどこにも残っていない（どの欄にも・「情報を追加」の面にも無い。ページの中の数は、配られたページそのものの数に戻る）。替わったあと、欄がいっときでも出した字の控えにも無い`,
            J({ dom: [dom0, dom1], file: wk.fileN, inPage, after: log && log.after.filter((x) => x.t.includes(OWN_NAME)).slice(0, 3), idle: log && log.after.some((x) => x.s === 'idle') }));
          /* 給与提出者が、もう1枚のタブでログインし直す → カードは、その人のものに戻る */
          await signInTab(wk.tab, 'pay');
          const back = await cardSeen(p, OWN_NAME, HAVE);
          const g2 = await gotOf(p);
          ok(back && cardIs(g2, OWN_NAME, HAVE) && (await sameLoad(p)).mark === WALK,
            `★CM4b そのあと、もう1枚のタブで給与提出者がログインし直すと、カードは、自分の会社（${OWN_NAME}）と自分の数（${HAVE}／${NEED}）に戻る（読み直さない）`,
            J({ back, got: g2 && { lock: g2.lock, give: g2.give } }));
        });

        /* ── CM2：最後の1問を、画面から答える（カードの入口 →「情報を追加」の面 → 送る）。読み直さずに、ほかの会社が開く ── */
        await part('CM2', async () => {
          if (!wk) throw new Error('前提が崩れた（通しの1枚が開いていない）');
          const { p, ear, sent } = wk;
          const g0 = await gotOf(p);
          if (!cardIs(g0, OWN_NAME, HAVE)) throw new Error('前提が崩れた（給与提出者のカードが出ていない）: ' + J(g0 && [g0.state, g0.text.slice(0, 70)]));
          await ear.all();
          const r0 = ear.replies.length, s0 = sent.length;
          /* カードがいちばん先に挙げた、この面で答えられる質問（いちばん新しい、カードの材料の返事から）。
             種類はサーバーの並びが決める ＝ 選ぶ質問でも、いくつも選ぶ質問でも、数の質問でも、数えられる答えを入れる */
          const lastGive = ear.gives.filter((g) => !!g.body && g.body.airline === OWN && Array.isArray(g.body.ask)).pop();
          const canAsk = (x) => !!x && (((x.kind === 'choice' || x.kind === 'multi') && Array.isArray(x.choices) && x.choices.some((c) => c.code !== 'unknown')) || (x.kind === 'num' && !!x.num && x.num.min != null));
          const first = lastGive ? lastGive.body.ask.map(asked).find(canAsk) : null;
          if (!first) throw new Error('前提が崩れた（カードが、この面で答えられる質問を1つも挙げていない）: ' + J(lastGive && lastGive.body.ask));
          wk.first = first;
          await p.page.click('.pvg-got .crl[data-live="fact"] a[data-crl-give]');
          const up = await seen(p, () => { const r = document.querySelector('.pvc-root'); return !!r && !r.hidden && r.classList.contains('is-in') && !!r.querySelector('form[data-pvc-form]'); });
          if (!up) throw new Error('前提が崩れた（カードの入口を押しても、質問の入力の面が開かない）');
          await waitView(p, await p.page.evaluate(() => document.querySelector('.pvc-root form[data-pvc-form]').getAttribute('data-pvc-form')));
          await settle(p);
          const at = await seen(p, inView, first.id);
          const f = await coFace(p), wz = await whoseOf(p), hs = await histOf(p), pageName = await nameOf(p);
          ok(at && wz.n === 1 && wz.name === OWN_NAME && wz.fixed && wz.seen && f.line.startsWith(OWN_NAME + ' · ')
            && ![JAL_NAME, pageName].some((nm) => !nm || f.text.includes(nm) || f.title.includes(nm)) && !!hs && hs.a === OWN && hs.u === PAYER.id,
            `★CM2 カードの「${GIVE_GO}」を押すと、「情報を追加」の面は、自分の会社（${OWN_NAME}）について開く：頭と入力の会社はその名前で、このページの会社（JAL）の名前は出ない。カードがいちばん先に挙げた質問の所で開く`,
            J({ q: first.id, kind: first.kind, at, whose: wz.name, line: f.line, title: f.title, page: pageName, hist: hs && [hs.a, hs.u === PAYER.id] }));
          if (first.kind === 'num') {
            await fill(p, first.id, String(first.num.min));
            if (first.currency) await pick(p, first.id + '_cur', await p.page.$eval(`.pvc-root select[name="${first.id}_cur"]`, (n) => ([...n.options].find((o) => o.value) || {}).value || ''));
          } else {
            const code = first.choices.find((c) => c.code !== 'unknown').code;
            if (first.kind === 'multi') await chip(p, first.id, code); else await pick(p, first.id, code);
          }
          await tick(p);
          await send(p);
          /* 保存後のカードが出るまで待つ（出なかった回も先へ進み、下の行で赤くする） */
          const savedUp = await waitView(p, 'saved').then(() => true, () => false);
          /* 画面を見る前に、保存先を見る：答えた数は、ちょうど1つ増えて、要る数に届いている */
          const have2 = await haveOf(PAYER, OWN), posted = sent.slice(s0);
          ok(savedUp && posted.length === 1 && posted[0].airline === OWN && J((posted[0].answers || []).map((x) => x.question_id)) === J([first.id]) && have2 === HAVE + 1 && have2 === NEED,
            `★CM2 その質問に答えて送ると、送る中身の会社は ${OWN} で、入っているのはその1問だけ。保存先の「答えた数」は、ちょうど1つ増えて、要る数に届く（${HAVE} → ${NEED}）`,
            J({ savedUp, sent: posted.map((x) => [x.airline, (x.answers || []).map((y) => y.question_id)]), have: [HAVE, have2], NEED }));
          /* 読み直さずに、開いた返事が届く（時間では待たない ＝ 届くまで待つ） */
          const opened = await until(() => ear.replies.slice(r0).some((r) => !!r.body && r.body.state === 'open'));
          await ear.all();
          const since = ear.replies.slice(r0), kept = await sameLoad(p);
          ok(opened && since.length >= 1 && since.every((r) => r.status === 200 && !!r.body && r.body.state === 'open') && kept.mark === WALK && kept.origin === wk.origin && kept.navs === 1,
            '★CM2 保存のあと、読み直さずに（同じ1回の読み込みのまま）、ページが集計の読み口へ聞き直し、開いた返事（open）が届く',
            J({ states: since.map((r) => r.body && r.body.state), kept }));
          await shut(p);
          const n = await nOfJal('reserve_duty');
          const drawn = await seen(p, (a) => {
            const e = document.querySelector('.pvg-got .crl[data-live="fact"]');
            return !!e && [...e.querySelectorAll('.crl-fact')].some((r) => (r.querySelector('.crl-fact-k') || {}).textContent === a.k && [...r.querySelectorAll('.crl-ans-m > span')].some((s) => s.textContent === a.n));
          }, { k: DUTY, n: `回答 ${n}人` });
          const g3 = await gotOf(p), cards = await p.page.evaluate(() => document.querySelectorAll('.crl-give').length);
          const row = g3 ? g3.rows.filter((r) => r.k === DUTY) : [];
          ok(drawn && !!g3 && g3.state === 'open' && g3.lock.length === 0 && row.length === 1 && row[0].meta.filter((t) => t === `回答 ${n}人`).length === 1 && row[0].meta.filter((t) => /人/.test(t)).length === 1 && cards === 0,
            `★CM2 面を閉じると、「集まった回答」に「スタンバイ勤務」の行が、人数「回答 ${n}人」（JAL の集計が数えた人数そのまま）つきで出ている。答えるカードは、ページのどこにも無い`,
            J({ got: g3 && [g3.state, g3.lock, g3.rows.map((r) => [r.k, r.meta])], cards }));
          const w = await walk(p);                       // 4つのタブを歩く（隠れていた欄にも、開いた形を描かせる）。終わりは概要
          const holders = [...w.work.filter((x) => x.at === 'pvg-p-work' && x.live === 'fact'), ...w.overview.filter((x) => x.at === 'got')];
          const closed = TABS.flatMap((id) => w[id].filter(GATED).filter((x) => x.lock.length || x.give.length || !/^(open|empty)$/.test(x.state)).map((x) => `${TAB_NAME[id]}・${slotName(x)}（${x.state}）`));
          ok(w.lost.length === 0 && closed.length === 0 && J([...new Set(TABS.flatMap((id) => w[id].filter(GATED).map(slotName)))].sort()) === J(ALL_SLOTS)
            && holders.length === 2 && holders.every((x) => x.rows.filter((r) => r.k === DUTY && r.meta.includes(`回答 ${n}人`)).length === 1),
            '★CM2 どのタブの集計の欄にも月の勤務の欄にも、鍵の1行も答えるカードも無い（開いた形か「まだ集計がありません」）。「スタンバイ勤務」の行は、勤務・訓練のタブの集計にも出ている',
            J({ closed, lost: w.lost, holders: holders.map((x) => [slotName(x), x.state, x.rows.map((r) => r.k)]) }));
        });

        /* ── CM4：2人が、同じ1枚を使う（開いた形が出ているまま、ログアウトする → 別の会員がログインする）── */
        await part('CM4', async () => {
          if (!wk || !wk.tab) throw new Error('前提が崩れた（通しの1枚か、もう1枚のタブが無い）');
          const { p, ear, tab } = wk;
          const g0 = await gotOf(p), rows0 = await p.page.evaluate(() => document.querySelectorAll('.crl-fact').length);
          if (!(g0 && g0.state === 'open' && g0.rows.some((r) => r.k === DUTY) && rows0 >= 2)) throw new Error('前提が崩れた（給与提出者に、JAL の回答の行が出ていない）: ' + J({ got: g0 && [g0.state, g0.text.slice(0, 70)], rows0 }));
          const noisy = (x) => x.rows > 0 || /[0-9０-９]/.test(x.t);
          /* (a) その場でログアウトする（ページ自身のログインの部品で） */
          await ear.all();
          let r0 = ear.replies.length;
          await markSlots(p, 'CM4-out');
          /* 閉じている「情報を追加」の面：5つ目の答えを保存したあとのカード（自分の会社の名前と、保存した答え）が、中に残っている */
          const sh0 = await shutSheet(p);
          const outErr = await p.page.evaluate(() => window.PVCareer.client().then((sb) => sb.auth.signOut()).then((r) => (r && r.error ? String(r.error.message || r.error) : '')));
          if (outErr) throw new Error('前提が崩れた（その場でログアウトできていない）: ' + outErr);
          const outSeen = await seen(p, (line) => { const e = document.querySelector('.pvg-got .crl[data-live="fact"]'); return !!e && e.getAttribute('data-state') === 'locked' && e.textContent.trim() === line; }, LOGIN_LINE);
          await ear.all();
          const g1 = await gotOf(p), rows1 = await p.page.evaluate(() => document.querySelectorAll('.crl-fact').length), outReplies = ear.replies.slice(r0), logA = await sinceMark(p, 'CM4-out');
          const bareOut = await seen(p, sheetBare), sh1 = await shutSheet(p);
          ok(outSeen && !!g1 && J(g1.lock) === J([LOGIN_LINE]) && g1.text === LOGIN_LINE && g1.links.length === 0 && rows1 === 0
            && outReplies.length >= 1 && outReplies.every((r) => only(r, '{"ok":true,"state":"login"}')),
            `★CM4 開いた形が出ているまま、その場でログアウトすると、読み直さなくても、「集まった回答」は「${LOGIN_LINE}」の1行だけになる。回答の行は、ページのどこにも（隠れているタブにも）残らない。聞き直した返事は {"ok":true,"state":"login"} だけ`,
            J({ outSeen, got: g1 && [g1.state, g1.text.slice(0, 60)], rows: [rows0, rows1], replies: outReplies.map((r) => [r.status, r.text]) }));
          ok(!!logA && logA.before.some((x) => x.rows > 0) && logA.after.some((x) => x.s === 'idle') && !logA.after.some(noisy),
            '★CM4 ログアウトのあと、集計の欄にも月の勤務の欄にも、回答の行も数字も、いっときも出ていない（前の人の行を、もう一度描いていない）',
            J(logA && { after: logA.after.filter(noisy).slice(0, 3).map((x) => [x.at, x.s, x.t.slice(0, 50)]), idle: logA.after.some((x) => x.s === 'idle'), n: logA.after.length }));
          const heldOut = !!sh0 && !sh0.open && !sh0.up && sh0.saved && sh0.mine >= 1 && sh0.text.includes(OWN_NAME) && !!wk.first && sh0.text.includes(wk.first.ja.label);
          ok(heldOut && bareOut && shutBare(sh1) && !sh1.html.includes(OWN_NAME),
            `★CM4 その場でログアウトすると、閉じている「情報を追加」の面の中にも、前の人のものが残らない（開き直さなくても、その場で）：自分の会社の名前（${OWN_NAME}）も、保存した答えも無い ＝ 字が1つも無い・入力欄も無い。ログアウトの前には、どちらも面の中に在った`,
            J({ before: sh0 && [sh0.open, sh0.up, sh0.saved, sh0.mine, sh0.text.slice(0, 60)], bareOut, after: sh1 && [sh1.open, sh1.up, sh1.kids, sh1.ctl, sh1.mine, sh1.html.includes(OWN_NAME), sh1.text.slice(0, 80)] }));
          /* (b) もう1枚のタブで、別の会員（給与の鍵なし）がログインする */
          await ear.all();
          r0 = ear.replies.length;
          await markSlots(p, 'CM4-in');
          await signInTab(tab, 'pilot');
          const inSeen = await seen(p, (line) => { const e = document.querySelector('.pvg-got .crl[data-live="fact"]'); return !!e && e.getAttribute('data-state') === 'locked' && e.textContent.trim() === line; }, PAY_LINE);
          const w = await walk(p);
          await ear.all();
          const L = lockedBad(w, PAY_LINE), inReplies = ear.replies.slice(r0), logB = await sinceMark(p, 'CM4-in');
          ok(inSeen && L.bad.length === 0 && J(L.saw) === J(ALL_SLOTS) && inReplies.length >= 1 && inReplies.every((r) => only(r, '{"ok":true,"state":"locked"}')) && (await sameLoad(p)).mark === WALK,
            `★CM4 そのあと、もう1枚のタブで別の会員（給与の鍵なし）がログインすると、読み直さなくても、どのタブでも、集計の欄（4つ）と月の勤務の欄は「${PAY_LINE}」の1行だけ。その人への返事は {"ok":true,"state":"locked"} だけ`,
            J({ inSeen, bad: L.bad.slice(0, 4), saw: L.saw, replies: inReplies.map((r) => [r.status, r.text]) }));
          ok(!!logB && logB.after.some((x) => x.s === 'idle') && !logB.after.some(noisy),
            '★CM4 その人に替わったあとも、集計の欄にも月の勤務の欄にも、回答の行も数字も、いっときも出ていない',
            J(logB && { after: logB.after.filter(noisy).slice(0, 3).map((x) => [x.at, x.s, x.t.slice(0, 50)]), idle: logB.after.some((x) => x.s === 'idle'), n: logB.after.length }));
          /* (c) 端末の保存領域。この1回の読み込みの、はじめから終わりまで（答えるカード → 開いた形 → ログアウト → 別の会員）を通して見る */
          const S = await storeNow(p);
          if (!S) throw new Error('前提が崩れた（保存領域の控えが入っていない）');
          const legs = storeLegs(S, ['pv_contrib_facts', '"median_num"', '"lead"', 'fact:', 'pv_contrib_give', '"have"']);
          ok(legs.held > 0 && legs.hits.length === 0,
            '★CM4 読む人が替わるまでを通して、端末の保存領域（localStorage・sessionStorage・控えた書き込み）のどの鍵にも値にも、集計や答えるカードの材料を写した字（pv_contrib_facts・"median_num"・"lead"・fact:・pv_contrib_give・"have"）が無い',
            J(legs.hits.slice(0, 6)));
          ok(legs.sawSession && legs.direct.length === 0,
            '★CM4 そのあいだに、新しく出来た・値が替わった保存領域の鍵のうち、career-live.js がじかに書いたものは1つも無い',
            J(legs.direct.length ? legs.direct.map((x) => [x.key, x.top]) : legs.wrote.map((x) => x.key)));
          /* (d) 閉じている「情報を追加」の面と、もう1枚のタブでのログイン。
             給与提出者が、もう1枚のタブでログインし直す → 自分の会社について面を開く（5つ目の質問の所。保存した答えが入っている）→ 閉じる
             → もう1枚のタブで、別の会員（会員B）がログインする。こちらのタブには触らない・面は開き直さない。 */
          await signInTab(tab, 'pay');
          const payBack = await seen(p, (id) => { try { return window.PVSession.hasToken() && window.PVSession.readStoredSession().user.id === id; } catch (e) { return false; } }, PAYER.id);
          const asked2 = payBack && !!wk.first && await p.page.evaluate((o) => window.PVContrib.openFor(o), { airline: OWN, name: OWN_NAME, ask: [wk.first.id] });
          const up2 = asked2 && await seen(p, () => { const r = document.querySelector('.pvc-root'); return !!r && !r.hidden && r.classList.contains('is-in') && !!r.querySelector('form[data-pvc-form]'); });
          if (!up2) throw new Error('前提が崩れた（給与提出者がログインし直しても、自分の会社についての面が開かない）: ' + J({ payBack, asked2, up2 }));
          await waitView(p, await p.page.evaluate(() => document.querySelector('.pvc-root form[data-pvc-form]').getAttribute('data-pvc-form')));
          await settle(p);
          const mineIn = await seen(p, () => document.querySelectorAll('.pvc-root form .pvc-mine').length > 0);
          await shut(p);
          const sh2 = await shutSheet(p);
          await signInTab(tab, 'b');
          const bareIn = await seen(p, sheetBare), sh3 = await shutSheet(p);
          const heldIn = mineIn && !!sh2 && !sh2.open && !sh2.up && sh2.whose === OWN_NAME && sh2.mine >= 1 && sh2.ctl >= 1 && sh2.text.includes(OWN_NAME) && sh2.text.includes(wk.first.ja.label);
          ok(heldIn && bareIn && shutBare(sh3) && !sh3.html.includes(OWN_NAME) && (await sameLoad(p)).mark === WALK,
            `★CM4 自分の会社について開いた面を閉じたあと、もう1枚のタブで別の会員（会員B）がログインすると、開き直さなくても、閉じた面の中に、前の人のものが残らない：自分の会社の名前（${OWN_NAME}）も、保存した答えも無い ＝ 字が1つも無い・入力欄も無い。替わる前には、どちらも面の中に在った（読み直さない）`,
            J({ before: sh2 && [sh2.open, sh2.up, sh2.whose, sh2.mine, sh2.ctl, sh2.text.slice(0, 60)], mineIn, bareIn, after: sh3 && [sh3.open, sh3.up, sh3.kids, sh3.ctl, sh3.mine, sh3.html.includes(OWN_NAME), sh3.text.slice(0, 80)] }));
        });
      } finally {
        if (wk) { wk.ear.off(); await wk.p.st.ctx.close(); }
      }

      /* ── CM5：開いていない人への返事は、その会社に何が在っても、同じ字（会員B ＝ 自分の会社が ANA・要る数に届いていない人）──
         回答が在る会社（JAL）・回答が1つも無い会社（保存先に聞いて選ぶ。打ち込まない）・一覧に無い会社。画面は通さない（通信の上の返事を、全文で比べる）。 */
      await part('CM5', async () => {
        const tok = (await (await fetch(`${base}/__local/login?member=b`)).json()).session.access_token;
        const ask = async (fn, airline) => {
          const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
            body: JSON.stringify({ p: fn === 'pv_contrib_facts' ? { airline, keys: ['reserve_duty'] } : { airline } }),
          });
          const text = await res.text();
          let body = null;
          try { body = JSON.parse(text); } catch (e) { body = null; }
          return { status: res.status, text, body };
        };
        const heldIn = async (s) => (await q('select ((select count(*) from public.airline_conditions where airline = $1) + (select count(*) from public.pv_work_months where airline = $1))::int as n', [s])).rows[0].n;
        /* 回答（質問への答え・月の勤務）が1行も無い、一覧の会社。先行5社（会社ページが集計の欄を持つ会社）の中に在れば、それを使う。
           通しで流した回は、前の場面が5社とも何か残している ＝ その時は、一覧のほかの会社から選ぶ（行を消して作らない） */
        const empties = (await q(`select a.code from public.pv_airlines a where a.code <> 'other'
            and not exists (select 1 from public.airline_conditions c where c.airline = a.code)
            and not exists (select 1 from public.pv_work_months w where w.airline = a.code) order by a.code`)).rows.map((r) => r.code).filter((s) => s !== 'jal' && s !== B_OWN);
        const leads = fs.readdirSync(path.join(ROOT, 'airlines')).filter((f) => f.endsWith('.html') && read('airlines/' + f).includes('data-pv-glance="1"')).map((f) => f.slice(0, -5));
        const quiet = empties.find((s) => leads.includes(s)) || empties[0] || null;
        const jalHeld = await heldIn('jal');
        if (quiet === null || (await heldIn(quiet)) !== 0 || !(jalHeld > 0)) throw new Error('前提が崩れた（回答が1つも無い一覧の会社が無い・または JAL に回答が無い）: ' + J({ empties: empties.length, jalHeld }));
        for (const [fn, what] of [['pv_contrib_facts', '集計'], ['pv_contrib_notes', '補足']]) {
          const got = [];
          for (const s of ['jal', quiet, 'no-such-airline']) got.push(await ask(fn, s));
          ok(got.every((r) => r.status === 200 && r.text === got[0].text && only(r, GIVE_TEXT)),
            `★CM5 開いていない人（要る数に届いていない会員）への、${what}の読み口の返事は、回答が在る会社（JAL）・1つも無い会社・一覧に無い会社で、全文が同じ字（{"ok":true,"state":"give"}）`,
            J({ quiet, got: got.map((r) => [r.status, r.text]) }));
        }
      });
    } finally {
      /* 後始末：給与の鍵を、無い形へ戻す（出した給与の行は、この回かぎりの保存先に残る）。会員B も、この場面の終わりで給与を出している */
      await q('update public.profiles set access_until = null where id = $1', [PAYER.id]);
      await q('update public.profiles set access_until = null where id = $1', [memberOf('b').id]);
      const left = (await q('select access_until from public.profiles where id = $1', [PAYER.id])).rows[0];
      ok(!!left && left.access_until === null, '後始末：給与提出者の給与の鍵を、無い形へ戻してある（ほかの場面へ、鍵を持ち越さない）', J(left));
      const leftB = (await q('select access_until from public.profiles where id = $1', [memberOf('b').id])).rows[0];
      ok(!!leftB && leftB.access_until === null, '後始末：会員B の給与の鍵も、無い形へ戻してある（ほかの場面は、会員B を、給与の鍵の無い会員として使う）', J(leftB));
    }
  });

  console.log('\n════ 通信 ════');
  ok(supa.size === 0, '★本番（*.supabase.co）へ1本も投げていない', J([...supa].slice(0, 5)));
  ok(blocked.size === 0, '手元と書体・部品の配信元のほかへ、1本も投げていない', J([...blocked].slice(0, 5)));
  ok(pageErrs.length === 0, 'ページの中でエラーが1件も出ていない', J([...new Set(pageErrs)].slice(0, 4)));
}

try {
  await main();
} catch (e) {
  ok(false, '検査が最後まで走った', String(e && e.stack || e).split('\n').slice(0, 3).join(' / '));
} finally {
  try { if (browser) await browser.close(); } catch (e) { /* もう閉じている */ }
  try { if (local) await local.close(); } catch (e) { /* もう止まっている */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 消せなくても次の回には関係ない */ }
}
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
