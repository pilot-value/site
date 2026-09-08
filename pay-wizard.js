/* pay-wizard.js — 給与フォームを5ステップで歩かせる（Phase 5・2026-09-08）
   ═══════════════════════════════════════════════════════════════════
   日英で**この1本を共有する**。pay-report.html と en/pay-report.html は
   それぞれ自分のインライン script から PVPayWizard.init() を呼ぶだけ。
   文言だけがここの T にあり、計算・保存・匿名化の判断は1つも持たない。

   ★給与の計算をここに書かない。年換算は今までどおりページ側の annualTotal()
     ／サーバの pv_annual_total が正で、ここはその答えを**受け取るだけ**。
     ここで足し算を始めた瞬間、同じ数字の出どころが3つになる。

   ★下の「公開イメージ」だけは例外で、SQL の式を写している（写す以外に道が無い
     ── 出す前の人の行は、まだサーバのどこにも無い）。写した先は
     db/test-pay-preview.mjs が SQL と突き合わせている。式を直すときは
     必ずそちらも一緒に流すこと。

   中身は3つ：
     ① 公開イメージの数値処理（DOM を1つも触らない純関数）
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
    pubTitle:  '匿名で公開されるイメージ',
    pubSub:    'REAL PAY の一覧には、この形の1行だけが出ます。入れた実額はそのままでは出ません。',
    pubNotYet: '会社・職位・その月の総支給を入れると、ここに公開イメージが出ます。',
    pubHedge:  'この形で出る見込みです。最終的な値はサーバー側で決まります。',
    pubShown:  '出るもの',
    pubHidden: '出さないもの',
    hiddenList: '基地／年代／国籍／契約形態／納税地／原本の通貨／レポートの番号／提出した日そのもの／自由入力した社名',
    lblAirline: '会社',
    lblPos:     '職位',
    lblFleet:   '機材',
    lblAnnual:  '年収（有効数字2桁）',
    lblAge:     '投稿の時期',
    lblTen:     '在籍',
    lblWork:    '勤務',
    lblComp:    '支給の内訳',
    age0:       '1ヶ月以内',
    tenFo:      ['5年未満', '5年以上'],
    tenCap:     ['10年未満', '10〜20年', '20年以上'],
    bh:         '乗務時間',
    dd:         '乗務日数',
    hours:      '時間',
    days:       '日',
    seg: { fixed: '固定・保証給', variable: '変動給', command: '職位手当', role: '役割手当',
           perdiem: 'パーディアム', housing: '住宅手当', other: 'その他の現金', rest: 'その他',
           bonus: '賞与・プロフィットシェア' },
    noComp:    '内訳を書いていないので、この行は年収だけの1行として出ます。',
    overComp:  '内訳の合計が総支給を超えているので、内訳の帯は付きません（年収の行はそのまま出ます）。',
    noFx:      '為替はサーバー側のレートで確定します。この通貨のレートがまだ無いときは、レートが入るまで一覧に出ません。',
    manyMonths:'複数の月を出している人は、月ごとの年換算の**中央値**が公開値になります（この1ヶ月の値ではありません）。',
    outLow:    '年換算が低すぎます（年 $10,000 未満）。打ち間違いでなければそのまま出せますが、この行は一覧には出ません。',
    outHigh:   '年換算が高すぎます（年 $700,000 超）。打ち間違いでなければそのまま出せますが、この行は一覧には出ません。',
    bandNote:  '内訳と勤務は、下端と上端の**幅**だけが出ます。生の額や割合は出ません。',
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
    pubTitle:  'How it appears anonymously',
    pubSub:    'REAL PAY publishes one row in this shape. The exact amounts you typed are not published.',
    pubNotYet: 'Enter the airline, position and monthly gross to see the anonymous preview.',
    pubHedge:  'This is how it is expected to appear. The final values are decided on the server.',
    pubShown:  'Published',
    pubHidden: 'Never published',
    hiddenList: 'Base · age band · nationality · contract type · tax country · original currency · report id · the exact submission date · any airline name you typed in',
    lblAirline: 'Airline',
    lblPos:     'Position',
    lblFleet:   'Fleet',
    lblAnnual:  'Annual (2 significant figures)',
    lblAge:     'Posted',
    lblTen:     'Tenure',
    lblWork:    'Workload',
    lblComp:    'Pay composition',
    age0:       'within 1 month',
    tenFo:      ['under 5 yrs', '5 yrs or more'],
    tenCap:     ['under 10 yrs', '10–20 yrs', '20 yrs or more'],
    bh:         'Block hours',
    dd:         'Duty days',
    hours:      'h',
    days:       'd',
    seg: { fixed: 'Fixed / guarantee', variable: 'Variable', command: 'Command', role: 'Role',
           perdiem: 'Per diem', housing: 'Housing', other: 'Other cash', rest: 'Other',
           bonus: 'Bonus / profit share' },
    noComp:    'You did not enter a breakdown, so this row is published as an annual figure only.',
    overComp:  'Your breakdown adds up to more than the gross, so no composition bars are attached (the annual row still appears).',
    noFx:      'The exchange rate is fixed on the server. If there is no rate for this currency yet, the row stays out of the list until one is added.',
    manyMonths:'If you submit several months, the published figure is the **median** of the annualised months — not this single month.',
    outLow:    'The annualised total is below $10,000/yr. You can still submit, but this row will not appear in the list.',
    outHigh:   'The annualised total is above $700,000/yr. You can still submit, but this row will not appear in the list.',
    bandNote:  'Composition and workload are published as a range only — never as a raw amount or a percentage.',
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

/* 公開イメージ1行ぶん。
   p    … submitPayReport() が組むのと同じ形の payload
   opt  … { annualOrig: 原本通貨の年換算, fx: to_usd（無ければ null）}
   ★年換算はここで作らない。ページ側の annualTotal()（＝サーバの
     pv_annual_total と同じ式）が出した数を受け取るだけ。 */
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

function fp(uid) {                       // FNV-1a。短く畳むだけ。
  var h = 0x811c9dc5, s = String(uid || '');
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(16);
}
function draftRead() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; }
}
/* ★戻り値は成否。呼び手はこれを見てから「保存しました」と出す。
     握り潰すと、プライベートモードの人に嘘の安心を出すことになる。 */
function draftWrite(o) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(o)); return true; }
  catch (e) { return false; }
}
function draftClear() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

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
  return { v: DRAFT_V, uid: uidFp, step: C.steps[cur].id, ts: Date.now(), fields: f };
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
  b.addEventListener('click', function () { draftClear(); box.hidden = true; });
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
    b.addEventListener('click', function () { draftClear(); box.hidden = true; });
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
    return out.join('、');
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
function renderReview() {
  var host = $(C.reviewId);
  if (!host) return;
  host.textContent = '';
  var h = el('h3', 'wz-h', L.revTitle);
  var p = el('p', 'wz-p', L.revSub);
  host.append(h, p);
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

function fmtBand(r, unit) {
  if (!r) return '';
  var f = function (x) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(x); };
  return f(r[0]) + '–' + f(r[1]) + (unit ? ' ' + unit : '');
}
function renderPublic(row, notes) {
  var host = $(C.publicId);
  if (!host) return;
  host.textContent = '';
  host.append(el('h3', 'wz-h', L.pubTitle), el('p', 'wz-p', L.pubSub));
  if (!row || row.annual_usd == null) {
    host.appendChild(el('p', 'wz-note', L.pubNotYet));
    return;
  }
  var card = el('div', 'wz-pub');
  var add = function (k, v) {
    if (v == null || v === '') return;
    var r = el('div', 'wz-pub-row');
    r.append(el('span', 'wz-pub-k', k), el('span', 'wz-pub-v', v));
    card.appendChild(r);
  };
  add(L.lblAirline, C.nameOf('f-airline'));
  add(L.lblPos, C.nameOf('f-position'));
  add(L.lblFleet, C.nameOf('f-fleet'));
  add(L.lblAnnual, '$' + new Intl.NumberFormat('en-US').format(row.annual_usd));
  add(L.lblAge, L.age0);
  if (row.ten != null) {
    add(L.lblTen, (row.pos === 'fo' ? L.tenFo : L.tenCap)[row.ten]);
  }
  if (row.work) {
    var w = [];
    if (row.work.bh) w.push(L.bh + ' ' + fmtBand(row.work.bh, L.hours));
    if (row.work.dd) w.push(L.dd + ' ' + fmtBand(row.work.dd, L.days));
    if (w.length) add(L.lblWork, w.join(' / '));
  }
  host.appendChild(card);

  if (row.pay) {
    var comp = el('div', 'wz-pub-comp');
    comp.appendChild(el('p', 'wz-pub-comp-t', L.lblComp));
    row.pay.forEach(function (s) {
      var r = el('div', 'wz-pub-seg');
      r.append(el('span', 'wz-seg-dot ' + 'is-' + s.k),
               el('span', 'wz-seg-k', L.seg[s.k] || s.k),
               el('span', 'wz-seg-v', '$' + fmtBand(s.r)));
      comp.appendChild(r);
    });
    comp.appendChild(emph('p', 'wz-note', L.bandNote));
    host.appendChild(comp);
  } else if (row.why === 'nodetail') {
    host.appendChild(el('p', 'wz-note', L.noComp));
  } else if (row.why === 'over') {
    host.appendChild(el('p', 'wz-note', L.overComp));
  }

  /* 出さないものを、名前で並べて見せる。 */
  var no = el('div', 'wz-pub-no');
  no.append(el('span', 'wz-pub-no-t', L.pubHidden), el('span', 'wz-pub-no-v', L.hiddenList));
  host.appendChild(no);

  /* サーバ側で変わる部分を、確定した結果として書かない。 */
  var hedge = el('ul', 'wz-hedge');
  var lines = [L.pubHedge, L.manyMonths, L.noFx];
  if (row.usd != null && row.usd < 10000) lines.push(L.outLow);
  if (row.usd != null && row.usd > 700000) lines.push(L.outHigh);
  (notes || []).forEach(function (x) { lines.push(x); });
  lines.forEach(function (x) { hedge.appendChild(emph('li', null, x)); });
  host.appendChild(hedge);
}

/* ═══ 5. 外へ出す口 ════════════════════════════════════════════════ */
var API = {
  /* cfg = { lang, bodyId, totalBarId, reviewId, publicId, steps:[{id, also, totalBar}],
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
    if (d && d.uid === 'anon') { this._pending = null; this._resume = d; }
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
    if (d.uid === 'anon') { d.uid = f; draftWrite(d); }   // 同じブラウザで本人が認証しただけ
    else if (d.uid !== f) { draftClear(); this._pending = null; this._resume = null; return; }
    if (this._pending) {
      this._pending = null;
      /* まだ入口の2択に居るなら、戻すのは start() のとき。ここで戻すと
         画面に出ていない段へ値を入れて、そのまま忘れられる。 */
      if (started) restoreDraft(d); else this._resume = d;
    }
  },
  sync: function () { if (!C) return; sync(); saveSoon(); },
  go: go,
  goLast: function () { if (C) go(C.steps.length - 1); },
  goToField: goToField,
  current: function () { return C ? C.steps[cur].id : null; },
  isLast: function () { return !!C && cur === C.steps.length - 1; },
  saveDraft: saveDraft,
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
  render: function (notes) {
    renderReview();
    var p = C.payload ? C.payload() : null;
    var row = p ? publicRow(p, { annualOrig: C.annualOrig(), fx: C.fx() }) : null;
    renderPublic(row, notes);
    return row;
  },
  /* db/test-pay-preview.mjs が呼ぶ純関数（DOM を1つも触らない）。 */
  preview: { sig2: sig2, bandGrid: bandGrid, band: band, shelf: shelf, row: publicRow,
             unionOutside: unionOutside, hasItems: hasItems }
};

if (typeof window !== 'undefined') window.PVPayWizard = API;

/* Node（検査）からも同じ関数を呼べるようにする。ブラウザでは何も起きない。 */
if (typeof module === 'object' && module.exports) {
  module.exports = { sig2: sig2, bandGrid: bandGrid, band: band, shelf: shelf,
                     row: publicRow, unionOutside: unionOutside, hasItems: hasItems };
}
})();
