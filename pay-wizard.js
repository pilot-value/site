/* pay-wizard.js — 給与フォームを5ステップで歩かせる（Phase 5・2026-09-08）
   ═══════════════════════════════════════════════════════════════════
   日英で**この1本を共有する**。pay-report.html と en/pay-report.html は
   それぞれ自分のインライン script から PVPayWizard.init() を呼ぶだけ。
   文言だけがここの T にあり、計算・保存・匿名化の判断は1つも持たない。

   ★給与の計算をここに書かない。年換算は今までどおりページ側の annualTotal()
     ／サーバの pv_annual_total が正で、ここはその答えを**受け取るだけ**。
     ここで足し算を始めた瞬間、同じ数字の出どころが3つになる。

   ★8区分への切り分け（shelf）だけは例外で、SQL の式を写している
     （写す以外に道が無い ── 出す前の人の行は、まだサーバのどこにも無い）。
     写した先は db/test-pay-preview.mjs が SQL と突き合わせている。
     式を直すときは必ずそちらも一緒に流すこと。

   中身は3つ：
     ① 公開される1行ぶんの数値処理（DOM を1つも触らない純関数）
     ② 下書き（localStorage の pv_pay_draft）
     ③ ウィザード本体（ステップ移動・進捗・確認画面の描画）        */
(function () {
'use strict';

/* ═══ 0. 言葉 ══════════════════════════════════════════════════════
   ★日英で**鍵を完全に同じ**にする。片方にしか無い鍵を作らない
     （assert-pay-report-sync.mjs と同じ考え方）。 */
var T = {
  ja: {
    stepOf:    function (i, n) { return 'ステップ ' + i + '/' + n; },
    next:      '次へ',
    back:      '戻る',
    toReview:  '入力内容を確認する',
    edit:      '編集',
    draftOk:   function (hm) { return 'このブラウザに下書きを保存しました（' + hm + '）'; },
    draftNg:   'このブラウザには下書きを保存できませんでした（プライベートモードなどでは保存されません）',
    draftBack: 'このブラウザに保存した下書きから続けています。',
    draftDrop: '下書きを消す',
    revTitle:  '入力内容の確認',
    revSub:    '出す前に、入れた内容をひととおり見てください。直すところは各節の「編集」から戻れます。',
    lblComp:    '支給の内訳（今月）',
    seg: { fixed: '固定・保証給', variable: '変動給', command: '職位手当', role: '役割手当',
           perdiem: 'パーディアム', housing: '住宅手当', other: 'その他の現金', rest: 'その他',
           bonus: '賞与・プロフィットシェア' },
    empty:     '（未入力）'
  },
  en: {
    stepOf:    function (i, n) { return 'Step ' + i + ' of ' + n; },
    next:      'Next',
    back:      'Back',
    toReview:  'Review your entry',
    edit:      'Edit',
    draftOk:   function (hm) { return 'Draft saved in this browser (' + hm + ')'; },
    draftNg:   'Could not save a draft in this browser (private mode blocks it)',
    draftBack: 'Continuing from a draft saved in this browser.',
    draftDrop: 'Discard draft',
    revTitle:  'Review your entry',
    revSub:    'Check what you entered before you submit. Use "Edit" on any section to go back.',
    lblComp:    'Pay composition (this month)',
    seg: { fixed: 'Fixed / guarantee', variable: 'Variable', command: 'Command', role: 'Role',
           perdiem: 'Per diem', housing: 'Housing', other: 'Other cash', rest: 'Other',
           bonus: 'Bonus / profit share' },
    empty:     '(blank)'
  }
};

/* ═══ 1. 公開イメージの数値処理 ═════════════════════════════════════
   ★★ ここから下の式は db/pay-rows.sql の写しである。★★
      pv_sig2 / pv_band_grid / pv_band … 3つの純関数
      shelf の a_fixed 〜 a_other / cash_m / det … 「命綱の引き算」
      listed の age / ten / work … 段と帯
   同じ式は既に SQL 側の2か所（db/pay-rows.sql の shelf と db/deep-pay.sql の
   sane）にあり、CLAUDE.md がそのことを警告している。ここは**3つ目**になる。
   3つ目を置く理由はひとつだけ ── 出す前の人の行は、まだサーバのどこにも無い。
   歯止めとして db/test-pay-preview.mjs が、同じ入力を JS と PGlite の両方へ
   通して**1つずつ突き合わせている**。式を直すなら必ず両方を直して流すこと。  */

/* 10 の何乗か。Math.log10 の丸め誤差を踏まないよう、指数表記から素直に取る。 */
function exp10(v) { return Number(String(Number(v).toExponential()).split('e')[1]); }
/* v × 10^e を、桁をずらすだけで出す（浮動小数の掛け算を挟まない）。 */
function shift(v, e) {
  var s = String(Number(v).toExponential()).split('e');
  return Number(s[0] + 'e' + (Number(s[1]) + e));
}
/* 小数 d 桁で四捨五入。d は負も取る（＝小数点より左で丸める）。
   Postgres の round(numeric, int) と同じ「0 から遠いほうへ」。v > 0 でしか呼ばない。 */
function roundTo(v, d) { return shift(Math.round(shift(v, d)), -d); }

/* pv_sig2 ── 有効数字2桁（REAL PAY の約束③）。 */
function sig2(v) {
  if (v == null || !(v > 0)) return null;
  return roundTo(v, 1 - exp10(v));
}
/* pv_band_grid ── 帯の刻み。年収の 1/40 を {1,2,5}×10ⁿ の直上へ切り上げる。
   ★刻みは**その人の年収から1つだけ**決まる。区分ごとに変えない。 */
function bandGrid(annual) {
  if (annual == null || !(annual > 0)) return null;
  var raw = annual / 40;
  var p = shift(1, exp10(raw));
  if (raw <= p) return p;
  if (raw <= p * 2) return p * 2;
  if (raw <= p * 5) return p * 5;
  return p * 10;
}
/* pv_band ── 下端と上端の2つだけを返す。 */
function band(v, grid, collapse) {
  if (v == null || grid == null || !(grid > 0) || !(v > 0)) return null;
  if (collapse && v < grid * 2) return [0, grid * 2];
  /* floor(v/grid) は割り算の誤差で1段ずれることがある。両側から押さえる。 */
  var k = Math.floor(v / grid);
  while ((k + 1) * grid <= v) k += 1;
  while (k > 0 && k * grid > v) k -= 1;
  return [k * grid, k * grid + grid];
}

/* payload の値は文字列か null。SQL の coalesce(x,0) と揃える。 */
function n0(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }
function nOrNull(x) {
  if (x == null || String(x).trim() === '') return null;
  var v = parseFloat(x); return isFinite(v) ? v : null;
}
/* pv_union_outside_gross ── 組合が総支給の外で払ったか。組合のときだけ真。 */
function unionOutside(items) {
  var u = items && items.union;
  return !!(u && u.extra === 'yes' && u.source === 'union');
}

/* 「中身のある内訳か」── db/pay-reports.sql の**空の殻の判定**と同じ条件。
   行も「該当なし」も役割モジュールも無い pay_items は、サーバが保存の時点で
   null に潰す。ここで潰さないと、画面だけが「内訳が出ます」と約束して
   実際には出ない、という食い違いになる（どちらも普通に動いたまま）。 */
function hasItems(items) {
  if (!items || typeof items !== 'object') return false;
  return !!(items.variable || items.other || items.instructor || items.examiner
            || items.union || items.management || items.nonline
            || items.fixed_none === true || items.guarantee_none === true
            || items.variable_none === true);
}

/* shelf の8区分＋賞与＋現金＋「内訳を書いたか」。順番は SQL の ord と同じ。 */
function shelf(p) {
  var items = hasItems(p.pay_items) ? p.pay_items : null;
  var hours = Math.max(n0(p.block_hours), n0(p.guaranteed_hours));
  var fvp = nOrNull(p.flight_variable_pay);
  var house = p.housing_type === 'allowance' ? n0(p.housing_amount) : 0;
  var gross = nOrNull(p.gross_monthly);
  var a = {
    fixed:    n0(p.base_pay) + n0(p.guarantee_pay),
    variable: fvp != null ? fvp : n0(p.hourly_rate) * hours,
    command:  n0(p.command_pay),
    role:     n0(p.instructor_pay) + n0(p.examiner_pay) + n0(p.union_pay)
              + n0(p.management_pay) + n0(p.nonline_pay),
    perdiem:  n0(p.per_diem),
    housing:  house,
    /* ★この引き算が命綱。フォームが変動給の合計を flight_variable_pay と
         other_allowance の**両方**へ写すので、素直に足すと二重に数える。 */
    other:    Math.max(n0(p.other_allowance) - n0(p.flight_variable_pay), 0) + n0(p.transport)
  };
  var cash;
  if (gross != null && gross !== 0) {
    cash = Math.max(gross - n0(p.bonus_month), 0)
         + (unionOutside(items) ? n0(p.union_pay) : 0);
  } else {
    cash = n0(p.base_pay) + n0(p.guarantee_pay) + n0(p.hourly_rate) * hours
         + n0(p.per_diem) + house + n0(p.transport) + n0(p.command_pay)
         + n0(p.other_allowance) + n0(p.instructor_pay) + n0(p.examiner_pay)
         + n0(p.union_pay) + n0(p.management_pay) + n0(p.nonline_pay);
  }
  return {
    a: a,
    cash_m: cash,
    bonus_y: n0(p.bonus_annual) + n0(p.profit_share_annual),
    /* db/deep-pay.sql の det と1文字ずつ同じ条件。 */
    det: (nOrNull(p.base_pay) != null || nOrNull(p.guarantee_pay) != null
          || nOrNull(p.command_pay) != null || items != null)
  };
}

var SEG_ORDER = ['fixed', 'variable', 'command', 'role', 'perdiem', 'housing', 'other'];

/* REAL PAY に公開される1行ぶんを、そのまま JS で作る。
   p    … submitPayReport() が組むのと同じ形の payload
   opt  … { annualOrig: 原本通貨の年換算, fx: to_usd（無ければ null）}
   ★年換算はここで作らない。ページ側の annualTotal()（＝サーバの
     pv_annual_total と同じ式）が出した数を受け取るだけ。
   ⚠️ **画面はもうこれを描かない**（確認画面の「公開イメージ」は 2026-09-09 に
      オーナー指示で廃止）。それでも残してあるのは、db/test-pay-preview.mjs の
      B) が**これと本物の pv_pay_rows() を突き合わせる**ため。
      消すと、確認画面の帯を描く shelf() が SQL の写しとして腐ったことに
      気づく仕掛けが**1つも無くなる**（CLAUDE.md の「写しが腐ったことに
      気づく仕掛けはこれ1本だけ」がこれ）。消さないこと。 */
function publicRow(p, opt) {
  var s = shelf(p);
  var fx = opt && opt.fx != null ? Number(opt.fx) : null;
  var ann = opt ? nOrNull(opt.annualOrig) : null;
  var usd = (ann != null && fx != null) ? roundTo(ann * fx, 2) : null;
  var out = {
    airline: p.airline || null,
    pos: p.position || null,
    fleet: p.fleet || null,
    annual_usd: sig2(usd),
    verified: false,
    age: 0,                    // 出したばかり＝いちばん新しい段
    ten: null, pay: null, work: null,
    /* 画面が「なぜ帯が出ないのか」を1行で言うための理由。行には入らない。 */
    why: null,
    /* 常識の幅（⑦）。外は一覧に出ない。 */
    inRange: usd != null && usd >= 10000 && usd <= 700000,
    usd: usd
  };
  /* 在籍は段だけ。年そのものは出さない。 */
  var sen = nOrNull(p.seniority_years);
  if (sen != null) {
    if (p.position === 'fo') out.ten = sen < 5 ? 0 : 1;
    else if (p.position === 'cap') out.ten = sen < 10 ? 0 : (sen < 20 ? 1 : 2);
  }
  /* 勤務は3つだけ。刻みは固定（年収の刻みに連動させない）。 */
  var work = {};
  var bh = band(nOrNull(p.block_hours), 10, false);
  var dd = band(nOrNull(p.duty_days), 2, false);
  var off = band(nOrNull(p.days_off), 2, false);
  if (bh) work.bh = bh;
  if (dd) work.dd = dd;
  if (off) work.off = off;
  out.work = Object.keys(work).length ? work : null;
  /* 支給の内訳。門は db/deep-pay.sql の ok と同じ。 */
  var grid = bandGrid(out.annual_usd);
  var sum = 0;
  for (var i = 0; i < SEG_ORDER.length; i++) sum += s.a[SEG_ORDER[i]];
  if (!s.det) { out.why = 'nodetail'; return out; }
  if (fx == null || !(s.cash_m > 0)) { out.why = 'nofx'; return out; }
  if (sum > s.cash_m * 1.02) { out.why = 'over'; return out; }
  if (grid == null) { out.why = 'nofx'; return out; }
  var rest = Math.max(s.cash_m - sum, 0);
  var segs = [];
  for (var j = 0; j < SEG_ORDER.length; j++) {
    var k = SEG_ORDER[j], amt = s.a[k] * 12 * fx;
    if (amt > 0) segs.push({ k: k, r: band(amt, grid, true) });
  }
  if (rest * 12 * fx > 0) segs.push({ k: 'rest', r: band(rest * 12 * fx, grid, true) });
  if (s.bonus_y * fx > 0) segs.push({ k: 'bonus', r: band(s.bonus_y * fx, grid, true) });
  /* ★「余り」1本だけの内訳は出さない。本人が書いた内訳ではないため。 */
  var real = segs.filter(function (x) { return x.k !== 'rest'; });
  if (!real.length) { out.why = 'nodetail'; return out; }
  out.pay = segs;
  return out;
}

/* ═══ 2. 下書き（localStorage の pv_pay_draft）═════════════════════
   ★入れないもの：明細の画像・PDF・OCR の原文。保存対象は**許可リスト**で
     濾す（除外リストにしない ── 欄が増えたとき黙って漏れる）。
   ★別のアカウントの下書きを戻さない。押してあるのは uid の指紋だけで、
     秘密を守るためのものではない（同じ端末の中で「同じ人か」を見るだけ）。 */
var DRAFT_KEY = 'pv_pay_draft';
var DRAFT_V = 1;

/* ★指紋は pv-session.js（PVPayLocal.fp）に1本だけ置く。下書き・前回の内容・
   預かり証の3つが**同じ印**でなければ、同じ人なのに片方だけ捨てられる。
   下は pv-session.js を読んでいない画面（検査の器など）のための同じ式の控え。 */
function fp(uid) {                       // FNV-1a。短く畳むだけ。
  var P = typeof window !== 'undefined' && window.PVPayLocal;
  if (P && P.fp) return P.fp(uid);
  var h = 0x811c9dc5, s = String(uid || '');
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(16);
}
/* ★預かり（pv_pay_pending）と同じ14日。ts は前から書いていたが**読んでいなかった**
   （2026-09-09 に気づいた）。無期限だと、半年前に途中でやめた人が、今月の話として
   半年前の総支給・飛んだ時間を持ったまま 3/5 から再開する。値はそれらしく埋まっていて、
   本人も「前に入れたやつだ」としか思わないので、目でも検査でも気づけない。 */
var DRAFT_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
/* ★匿名のまま置いてある下書きを、いま画面を見ている人のものと見てよいか
   （2026-09-11）。共有端末で、A が匿名で書きかけて帰ったあと B が開くと、
   A の会社・職位・総支給が入った状態の 3/5 から始まっていた。
   判定は pv-session.js の owns() 1か所（預かり証・前回の内容と同じ規則）。
   下は pv-session.js を読んでいない画面のための、同じ意味の控え。

   ★ただし下書きだけは1つ緩める ── **見ている人も匿名なら、14日はそのまま戻す。**
     理由は2つ。
     ① ここには「14日は残す」という約束があり（DRAFT_MAX_AGE・帯にも日時が出る）、
        タブの合言葉で切ると、匿名で書きかけて数日後に戻ってきた人の下書きが、
        期限内なのに黙って消えたようにしか見えない。
     ② 見ている人も匿名なら、A と B を見分ける手がかりがそもそも無い。
        どちらに転んでも当て推量になる。
     危ないのは「**名前のある口座**が、匿名の書きかけを勝手に受け継ぐ」ほうなので、
     そこだけは同じタブの続きに限る（setUid は uidFp を入れてからここを呼ぶ）。 */
function ownsDraft(d) {
  if (!d) return false;
  var me = uidFp || 'anon';
  if (d.uid === 'anon' && me === 'anon') return true;
  var P = typeof window !== 'undefined' && window.PVPayLocal;
  if (P && P.owns) return P.owns(d.uid, me, d.ts, d.tab);
  if (d.uid && d.uid !== 'anon') return d.uid === uidFp;
  return true;
}
function draftRead() {
  var d = null;
  try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; }
  /* ts を持たない形は歳が分からないので捨てない（v=1 は必ず持っている）。 */
  if (d && Number(d.ts) && Date.now() - Number(d.ts) > DRAFT_MAX_AGE) { draftClear(); return null; }
  return d;
}
/* ★戻り値は成否。呼び手はこれを見てから「保存しました」と出す。
     握り潰すと、プライベートモードの人に嘘の安心を出すことになる。 */
function draftWrite(o) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(o)); return true; }
  catch (e) { return false; }
}
function draftClear() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

/* 下書きを捨てて帯を畳む。呼ぶだけ（外へは知らせない）。 */
function dropDraft() {
  draftClear();
  var box = $('wz-draft');
  if (box) box.hidden = true;
}
/* ★「下書きを消す」を押した人の言う「前回の内容」は pv_pay_draft だけではない。
     pay-report.html は同じ入力を pv_pay_last にも控えている。片方だけ消すと、
     消したはずの会社・職位・総支給が**再読み込みで戻ってくる**（2026-09-11）。
     押した本人には消し方が分からないので、以後この画面は信用されない。
   ★ここから localStorage を直接触らない（キーの名前を2か所に持たない）。
     知らせるだけにして、消すのは持ち主のページに任せる。 */
function dropDraftFromUser() {
  dropDraft();
  try { window.dispatchEvent(new CustomEvent('pv-pay-draft-drop')); } catch (e) {}
}

/* ═══ 3. ウィザード本体 ════════════════════════════════════════════ */
var C = null;          // init() で受け取る設定
var L = null;          // 言葉
var cur = 0;           // 今のステップ（0 始まり）
var started = false;
var saveTimer = null;
/* 提出が通ったあとは、もう控えない（下の clearDraft の但し書き）。 */
var doneSaving = false;
var uidFp = 'anon';
/* ★init() より先に start() が呼ばれることがある（2026-09-08 に踏んだ）。
   pay-report.html#pay-detail で来た人は、器を起こす行より**上**の
   openDetailFromHash() が enterMode('manual') を呼ぶ。順番を直す代わりに
   ここで覚えておく ── 呼ぶ側の並びに、器の生死を預けない。 */
var wantStart = false;

function $(id) { return document.getElementById(id); }
function el(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}
/* 文言の中の **…** だけを太字にする。innerHTML は使わない
   （文言は日英の表から来るが、いつか本人の入力が混ざったときに穴を開けない）。
   ★textContent に投げっぱなしにすると、画面に ** がそのまま出る。 */
function emph(tag, cls, txt) {
  var e = el(tag, cls);
  String(txt == null ? '' : txt).split('**').forEach(function (part, i) {
    if (part === '') return;
    e.appendChild(i % 2 ? el('strong', null, part) : document.createTextNode(part));
  });
  return e;
}
function stepEls(i) {
  var s = C.steps[i], out = [$(s.id)];
  (s.also || []).forEach(function (id) { var e = $(id); if (e) out.push(e); });
  return out.filter(Boolean);
}

/* ── 器を組む ────────────────────────────────────────────────── */
function buildChrome() {
  /* 進捗（カラムの幅いっぱい・上に貼り付く）。 */
  var top = el('div', 'wz-top');
  top.id = 'wz-top';
  var track = el('div', 'wz-bar');
  var fill = el('i'); fill.id = 'wz-bar-fill';
  track.appendChild(fill);
  var meta = el('p', 'wz-meta');
  var cnt = el('span', 'wz-count'); cnt.id = 'wz-count';
  var nm = el('span', 'wz-name'); nm.id = 'wz-name';
  meta.append(cnt, nm);
  top.append(track, meta);
  var body = $(C.bodyId);
  body.insertBefore(top, body.firstChild);

  /* 下書きの状態。**「このブラウザに」を必ず書く**（保存範囲が読めば分かる形）。 */
  var d = el('p', 'wz-draft'); d.id = 'wz-draft'; d.hidden = true;
  top.after(d);

  /* 各ステップの末尾に 戻る／次へ。日英で同じ形になるよう JS が組む。 */
  C.steps.forEach(function (s, i) {
    var box = $(s.id);
    if (!box) return;
    var nav = el('div', 'wz-nav');
    if (i > 0) {
      var b = el('button', 'wz-back', L.back);
      b.type = 'button';
      b.addEventListener('click', function () { go(i - 1); });
      nav.appendChild(b);
    }
    if (i < C.steps.length - 1) {
      var nx = el('button', 'wz-next', i === C.steps.length - 2 ? L.toReview : L.next);
      nx.type = 'button';
      nx.addEventListener('click', function () { forward(i); });
      nav.appendChild(nx);
    }
    box.appendChild(nav);
  });
}

/* ── 移動 ─────────────────────────────────────────────────────── */
/* 段の頭へ運ぶ。
   ⚠️ 進捗バー（#wz-top）を scrollIntoView しない。あれは position:sticky ＝
      貼り付いているあいだ「今いる場所」が自分の位置なので、頭に合わせろと言うと
      **貼り付いている高さのぶんだけ下へ**動く。押すたびに少しずつ流れ、
      速い回には一気に流れる（2026-09-08、英語版で 398px → 1224px まで落ちた。
      日本語版も毎回 59px ずつ下がっていた ── 目には「少しズレる」としか映らない）。
   貼り付かない親（フォーム本体）の文書上の位置から出して、そこへ運ぶ。 */
function scrollToTop() {
  var top = $('wz-top');
  var host = top && top.parentNode;
  if (!host || !host.getBoundingClientRect) return;
  var off = parseFloat((window.getComputedStyle ? getComputedStyle(top).top : '') || '') || 0;
  var y = Math.max(0, host.getBoundingClientRect().top + (window.pageYOffset || 0) - off);
  try { window.scrollTo({ top: y, behavior: 'smooth' }); }
  catch (e) { window.scrollTo(0, y); }
}
function show(i) {
  C.steps.forEach(function (s, k) {
    stepEls(k).forEach(function (e) { e.hidden = k !== i; });
  });
  cur = i;
  /* ★エラーの箱を、今出ている段の中へ引っ越す。置きっぱなしにすると、
     1/5 で Next を押して止まった人のエラーが画面のずっと下（5/5 の中）に出て、
     本人には「押しても何も起きない」ようにしか見えない。
     置き場所は .wz-err-here があればその直前（＝提出ボタンの真上）、
     無ければ 戻る／次へ の直前（＝押したボタンの真上）。 */
  var err = C.errId ? $(C.errId) : null;
  if (err) {
    var ebox = $(C.steps[i].id);
    var anchor = ebox.querySelector('.wz-err-here') || ebox.querySelector('.wz-nav');
    if (anchor) ebox.insertBefore(err, anchor); else ebox.appendChild(err);
  }
  /* 報酬の段だけ、下端に年換算の合計を出す（ボタンは置かない）。 */
  var st = $(C.totalBarId);
  if (st) st.hidden = !C.steps[i].totalBar;
  document.body.classList.toggle('has-cta', !!C.steps[i].totalBar);
  sync();
  if (C.onStep) C.onStep(C.steps[i].id, i);
}
function go(i, opt) {
  if (i < 0 || i >= C.steps.length) return;
  if (i === cur && started) return;
  show(i);
  /* ★控えるのは show() の**あと**。前に書くと「今いた段」が残り、
     再開したとき必ず1つ手前から始まる（値は全部あるのに、もう一度 Next を押す）。 */
  saveDraft();
  if (!opt || !opt.quiet) {
    scrollToTop();
    var first = $(C.steps[i].id).querySelector('.form-input:not([type="hidden"]), .rolebox input');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) {} }
  }
}
/* Next。押した段の未入力だけを見て、あれば**その場**で赤く示す（次へ進めない）。 */
function forward(i) {
  var miss = C.missing().filter(function (f) { return $(C.steps[i].id).contains(f); });
  if (miss.length) { C.markMissing(miss); return; }
  C.clearErr();
  go(i + 1);
}
/* その欄のあるステップへ運ぶ（送信で止まったときに使う）。 */
function goToField(node) {
  if (!C) return -1;
  for (var i = 0; i < C.steps.length; i++) {
    var box = $(C.steps[i].id);
    if (box && box.contains(node)) { if (i !== cur) go(i, { quiet: true }); return i; }
  }
  return -1;
}

/* ── 進捗バー ─────────────────────────────────────────────────── */
function sync() {
  if (!started) return;
  var n = C.steps.length;
  var fill = $('wz-bar-fill');
  /* ★width ではなく scaleX で伸ばす（動かすのは transform と opacity だけ、が家のきまり）。 */
  if (fill) fill.style.transform = 'scaleX(' + ((cur + 1) / n) + ')';
  var cnt = $('wz-count');
  if (cnt) cnt.textContent = L.stepOf(cur + 1, n);
  var nm = $('wz-name');
  if (nm) {
    var t = $(C.steps[cur].id).querySelector('.sec-title');
    nm.textContent = t ? String(t.textContent).replace(/^\s*\d+\.\s*/, '') : '';
  }
  var top = $('wz-top');
  if (top) top.setAttribute('aria-label', L.stepOf(cur + 1, n));
}

/* ── 下書き ───────────────────────────────────────────────────── */
function draftState() {
  var f = {};
  C.draftIds.forEach(function (id) { var v = C.read(id); if (v) f[id] = v; });
  /* ★タブの合言葉も残す（2026-09-11）。匿名で書いたものを引き継げるのは
     同じタブの続きだけ ── 別のタブの人には渡さない。 */
  var tab = '';
  try { if (window.PVPayLocal && window.PVPayLocal.markTab) tab = window.PVPayLocal.markTab(); } catch (e) {}
  return { v: DRAFT_V, uid: uidFp, step: C.steps[cur].id, ts: Date.now(), tab: tab, fields: f };
}
function saveDraft() {
  if (!started || doneSaving) return;
  var ok = draftWrite(draftState());
  var box = $('wz-draft');
  if (!box) return;
  box.hidden = false;
  box.className = ok ? 'wz-draft is-ok' : 'wz-draft is-ng';
  if (!ok) { box.textContent = L.draftNg; return; }
  var d = new Date();
  var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  box.textContent = '';
  box.append(document.createTextNode(L.draftOk(hm) + ' '));
  var b = el('button', 'wz-draft-drop', L.draftDrop);
  b.type = 'button';
  b.addEventListener('click', dropDraftFromUser);
  box.appendChild(b);
}
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 2000);
}
/* 戻す。戻せたら true。 */
function restoreDraft(d) {
  if (!d || d.v !== DRAFT_V || !d.fields) return false;
  var n = C.restore(d.fields);
  if (!n) return false;
  var i = C.steps.findIndex(function (s) { return s.id === d.step; });
  show(i > 0 ? i : 0);
  var box = $('wz-draft');
  if (box) {
    box.hidden = false;
    box.className = 'wz-draft is-ok';
    box.textContent = L.draftBack + ' ';
    var b = el('button', 'wz-draft-drop', L.draftDrop);
    b.type = 'button';
    b.addEventListener('click', dropDraftFromUser);
    box.appendChild(b);
  }
  return true;
}

/* ═══ 4. 確認画面（5/5）══════════════════════════════════════════
   上：入力内容の確認（本人用・実額そのまま）
   下：匿名で公開されるイメージ（帯と段だけ）
   ★ラベルも値も**画面の DOM から**取る。ここに日英の対照表を持たない
     （持った瞬間、片方だけ直された文言とズレる）。 */
function fieldLabel(fld) {
  var lab = fld.querySelector('.form-label');
  if (!lab) return '';
  var c = lab.cloneNode(true);
  c.querySelectorAll('.req-tag, .opt-tag, .auto-tag, .miss-tag').forEach(function (t) { t.remove(); });
  return c.textContent.trim();
}
function fieldValue(fld) {
  var out = [];
  var boxes = fld.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  if (boxes.length) {
    boxes.forEach(function (b) {
      if (!b.checked) return;
      var lab = b.closest('label');
      out.push(lab ? lab.textContent.trim() : b.value);
    });
    /* ★区切りは言語で変える。英語ページに「、」を出すと日本語の文字が混ざる
       （2026-09-09。確認画面の『役職・区分』が Line pilot、Instructor と出ていた）。 */
    return out.join(C.lang === 'en' ? ', ' : '、');
  }
  /* ★1つの欄が入力を2つ以上持つことがある（「対象月」＝年と月の2つ、
     内訳の行＝連動・金額・呼び名の3つ）。先頭だけ読むと、確認画面から
     月が丸ごと消える。全部つないで出す。 */
  var parts = [];
  fld.querySelectorAll('select, input:not([type="hidden"]), textarea').forEach(function (e) {
    if (e.disabled || e.type === 'checkbox' || e.type === 'radio') return;
    if (e.tagName === 'SELECT') {
      var o = e.options[e.selectedIndex];
      if (e.value && o) parts.push(o.textContent.trim());
    } else if (String(e.value || '').trim() !== '') {
      parts.push(String(e.value).trim());
    }
  });
  return parts.join(' ');
}
/* ── 内訳の横棒 ────────────────────────────────────────────────
   長さの出どころは呼ぶ側が決める（本人用は生の月額・公開イメージは帯の中点）。
   ここは並んだ数を横幅へ割るだけ。作りは REAL PAY の帯（actual-pay.js の
   .ap-dw-st）の写しで、`flex:N 1 0` と `min-width:6px` まで同じにしてある。
   ★色をここで持たない。欠片に `.wz-seg-dot.is-<区分>` を付けて、下の一覧の丸と
     **同じ CSS 規則**から取る。2画面で色がズレない形はこれだけ
     （db/test-pay-preview.mjs の C) が9色の一致を見張っている）。
   ★aria-hidden。同じ内訳を、すぐ下の一覧が項目名と数字で出している。 */
function barEl(parts) {
  var sum = 0;
  parts.forEach(function (x) { if (x.w > 0) sum += x.w; });
  if (!(sum > 0)) return null;
  var bar = el('div', 'wz-cbar');
  bar.setAttribute('aria-hidden', 'true');
  parts.forEach(function (x) {
    if (!(x.w > 0)) return;
    var seg = el('span', 'wz-seg-dot is-' + x.k);
    seg.style.flex = (x.w / sum).toFixed(4) + ' 1 0';
    bar.appendChild(seg);
  });
  return bar;
}
/* 本人用の内訳＝shelf の**生の月額**。公開イメージ（帯の中点）とは別物。
   ★丸めも帯も掛けない。ここは本人しか見ない面なので、打った額のままでよい。
   ★内訳を書いていない人にも出す ── 総支給ぜんぶが「その他」1色になるだけだが、
     「受け取った額はこれです」が見える（2026-09-02 オーナー指示の
     「給与を出した人には支給構成を必ず出す」と同じ扱い）。 */
function reviewComp(p) {
  var s = shelf(p), parts = [], sum = 0;
  for (var i = 0; i < SEG_ORDER.length; i++) {
    var k = SEG_ORDER[i];
    if (s.a[k] > 0) { parts.push({ k: k, w: s.a[k] }); sum += s.a[k]; }
  }
  var rest = Math.max(s.cash_m - sum, 0);
  if (rest > 0) parts.push({ k: 'rest', w: rest });
  return parts;
}
/* 本人用の額。原本の通貨のまま出す（換算はサーバの仕事）。 */
function moneyOrig(v) {
  var cur = C.read ? String(C.read('f-currency') || '').trim() : '';
  var n = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(v));
  return cur ? cur + ' ' + n : n;
}

function renderReview(pay) {
  var host = $(C.reviewId);
  if (!host) return;
  host.textContent = '';
  var h = el('h3', 'wz-h', L.revTitle);
  var p = el('p', 'wz-p', L.revSub);
  host.append(h, p);
  /* ★入れた額が、どの区分にどれだけ乗っているかを1本で見せる。
     ★置き場所は**一番上**（2026-09-09 オーナー指示・Marit と同じ並び）。
       下に置くと、打った欄の読み返しを全部抜けないと全体像に届かない。
     ★出すのは**その月の額**。年額に直さない ── 直すと、すぐ下に並ぶ
       「総支給」「パーディアム」等の月額と桁が変わって別の話に見える。 */
  var parts = pay ? reviewComp(pay) : [];
  if (parts.length) {
    var comp = el('div', 'wz-rev-comp');
    comp.appendChild(el('p', 'wz-rev-comp-t', L.lblComp));
    var cb = barEl(parts);
    if (cb) comp.appendChild(cb);
    parts.forEach(function (x) {
      var cr = el('div', 'wz-rev-seg');
      cr.append(el('span', 'wz-seg-dot is-' + x.k),
                el('span', 'wz-seg-k', L.seg[x.k] || x.k),
                el('span', 'wz-seg-v', moneyOrig(x.w)));
      comp.appendChild(cr);
    });
    host.appendChild(comp);
  }
  /* ★読むあいだだけ全部の段を出す。他の段は隠れていて offsetParent が無く、
     「条件で隠れている欄」と「別の段に居る欄」の区別が付かない。区別しないと、
     住居を『社宅』に変えた人の確認画面に、前に打った住宅手当の額がまだ出る。
     出しっぱなしにはしない（この関数の中で開いて閉じる＝画面は一度も2段見えない）。 */
  var back = C.steps.map(function (s) { var e = $(s.id); return [e, e.hidden]; });
  back.forEach(function (x) { if (x[0]) x[0].hidden = false; });
  C.steps.forEach(function (s, i) {
    if (i >= C.steps.length - 1) return;
    var box = $(s.id);
    if (!box) return;
    var sec = el('section', 'wz-rev-sec');
    var head = el('div', 'wz-rev-head');
    var t = box.querySelector('.sec-title');
    head.appendChild(el('span', 'wz-rev-t', t ? t.textContent : ''));
    var ed = el('button', 'wz-rev-edit', L.edit);
    ed.type = 'button';
    ed.addEventListener('click', function () { go(i); });
    head.appendChild(ed);
    sec.appendChild(head);
    var rows = 0;
    box.querySelectorAll('.fld').forEach(function (fld) {
      if (!fld.offsetParent) return;                   // 条件で隠れている欄は出さない
      var v = fieldValue(fld);
      if (!v) return;
      var lab = fieldLabel(fld);
      if (!lab) return;
      var r = el('div', 'wz-rev-row');
      r.append(el('span', 'wz-rev-k', lab), el('span', 'wz-rev-v', v));
      sec.appendChild(r);
      rows++;
    });
    if (rows) host.appendChild(sec);
  });
  back.forEach(function (x) { if (x[0]) x[0].hidden = x[1]; });
}

/* ═══ 5. 外へ出す口 ════════════════════════════════════════════════ */
var API = {
  /* cfg = { lang, bodyId, totalBarId, reviewId, steps:[{id, also, totalBar}],
             draftIds, read(id), restore(obj), missing(), markMissing(list), clearErr(),
             payload(), annualOrig(), fx(), nameOf(id), onStep(id,i) } */
  init: function (cfg) {
    C = cfg;
    L = T[cfg.lang] || T.ja;
    buildChrome();
    var d = draftRead();
    /* 未ログインで書いた下書きは、同じブラウザなのでそのまま戻す（ただし
       画面を出すのは start() ＝入口の2択を抜けてから。ここで出すと、
       まだ「どちらで入力しますか？」を選んでいない人の後ろで段が動く）。
       押印済みのものは setUid() が「今の人のものだ」と言うまで戻さない。 */
    /* ★ここではまだ誰も名乗っていない（uidFp は空）。匿名の下書きは
       14日そのまま戻す ── 同じブラウザで書きかけた本人が続きから入れる。
       名前のある口座が受け継いでよいかは setUid() が判定する（同じタブの続きだけ）。
       ⚠️ 消しはしない（A の書きかけを B のログインで捨てない）。使わないだけ。 */
    if (d && d.uid === 'anon') { this._pending = null; this._resume = ownsDraft(d) ? d : null; }
    else { this._pending = d; }
    /* 先に start() が来ていたら、ここで起こす（上の wantStart）。 */
    if (wantStart) { wantStart = false; this.start(); }
    return this;
  },
  start: function () {
    /* ★まだ init() が走っていない（呼ぶ側の並びの都合）。覚えておいて
       init() の最後で起こす。ここで先に進むと C が null のまま落ちる。 */
    if (!C) { wantStart = true; return; }
    if (started) return;
    started = true;
    var d = this._resume;
    this._resume = null;
    /* 戻せたら restoreDraft が段まで合わせる。戻せなければ 1/5 から。 */
    if (d && restoreDraft(d)) return;
    show(0);
  },
  /* ログインの結果が分かった時点で1回だけ呼ぶ。 */
  setUid: function (uid) {
    if (!uid) return;
    var f = fp(uid), d = this._pending || draftRead();
    uidFp = f;
    if (!d) return;
    /* ★匿名の下書きを本人のものにするのは、**同じタブの続き**のときだけ
       （2026-09-11）。前は無条件で、A が匿名で書いた下書きが、B が
       別のタブでログインした拍子に B のものになっていた。 */
    if (d.uid === 'anon') {
      if (!ownsDraft(d)) { this._pending = null; this._resume = null; return; }
      d.uid = f; draftWrite(d);                           // 同じタブで本人が認証しただけ
    }
    else if (d.uid !== f) { draftClear(); this._pending = null; this._resume = null; return; }
    if (this._pending) {
      this._pending = null;
      /* まだ入口の2択に居るなら、戻すのは start() のとき。ここで戻すと
         画面に出ていない段へ値を入れて、そのまま忘れられる。 */
      if (started) restoreDraft(d); else this._resume = d;
    }
  },
  /* ★預かり（pv_pay_pending）を戻した回は、下書きから戻さない。
     下書きは2秒の遅延保存（saveSoon）なので、最後の打鍵の直後に送信を押した人の
     下書きは**送った内容より古い**。あとから start() が上書きすると、本人には
     「送ったはずの値が勝手に古いものに戻った」ようにしか見えない。
     ★localStorage は消さない（この回だけ使わない）。預かりを送り切れずに
       帰った人が、次に普通に開いたときは下書きから続けられる。 */
  skipDraft: function () { this._resume = null; this._pending = null; },
  sync: function () { if (!C) return; sync(); saveSoon(); },
  go: go,
  goLast: function () { if (C) go(C.steps.length - 1); },
  goToField: goToField,
  current: function () { return C ? C.steps[cur].id : null; },
  isLast: function () { return !!C && cur === C.steps.length - 1; },
  saveDraft: saveDraft,
  /* ★下書きの押印。pay-report.html が pv_pay_last と pv_pay_claim に
     **同じ印**を押すために要る（別々に作ると同じ人に違う印が付く）。 */
  fp: fp,
  /* 「保存を消す」（pay-report.html）から呼ぶ。下書きも一緒に捨てる。 */
  dropDraft: dropDraft,
  /* ★提出が通ったあとの後始末（pay-report.html の afterSaved から呼ぶ）。
     控えを消すだけでなく、**これ以降は控えない**。消した直後に、直前の打鍵で
     仕掛かっていた2秒の遅延保存が発火して、出し切ったはずの下書きが黙って生き返る
     （2026-09-08 に踏んだ ── 次に開いた人に「まだ途中です」と出て、しかも
     5/5 から始まる。画面はどこも壊れていないので目では気づけない）。 */
  clearDraft: function () {
    doneSaving = true;
    clearTimeout(saveTimer);
    draftClear();
    var box = $('wz-draft');
    if (box) box.hidden = true;
  },
  render: function () {
    /* ★payload を先に作る。renderReview() が支給の内訳（8区分）を出すのに要る。
       renderReview() は段の hidden を開けて閉じるだけで元に戻すので、
       payload() をその前に呼んでも後に呼んでも同じ答えになる。 */
    renderReview(C.payload ? C.payload() : null);
  },
  /* db/test-pay-preview.mjs が呼ぶ純関数（DOM を1つも触らない）。 */
  preview: { sig2: sig2, bandGrid: bandGrid, band: band, shelf: shelf, row: publicRow,
             unionOutside: unionOutside, hasItems: hasItems }
};

if (typeof window !== 'undefined') window.PVPayWizard = API;

/* Node（検査）からも同じ関数を呼べるようにする。ブラウザでは何も起きない。 */
if (typeof module === 'object' && module.exports) {
  module.exports = { sig2: sig2, bandGrid: bandGrid, band: band, shelf: shelf,
                     row: publicRow, unionOutside: unionOutside, hasItems: hasItems,
                     /* 帯に出る区分の全部（固定順＋その他・未分類＋賞与）。
                        db/test-pay-preview.mjs の C) が、この並びぶんの色が
                        2つの CSS に同じ値であることを見る。 */
                     segKeys: SEG_ORDER.concat(['rest', 'bonus']) };
}
})();
