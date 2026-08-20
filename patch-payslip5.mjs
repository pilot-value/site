/* 明細を読んだあとの画面を作り直す。実測でこうなっていた：

     結果テーブル  573px  ← 読み取り直後にここへスクロールされる
     時給カード   3398px  ← 商品。2,800px 下。見えない
     送信ボタン   3737px

   つまり「読み取りました」の直後に読み取り専用の表を見せて、
   商品（時給）も次の行動もはるか下に置いていた。直すのは4つ：

     ① 時給を結果のいちばん上に出す（表より先。落とした理由がこれだから）
     ② 乗務時間が読めなかったときは、その場で1つだけ聞く
        （block hours が無いと「乗務時間あたり」が出ない＝商品が半分になる）
     ③ 金額をその場で直せるようにする（表の下のフォームまで探しに行かせない）
     ④ 次の行動を出す（会社・職位・機材はAIには分からない。ここだけ人が選ぶ）

   ついでに「乗務日数 JPY 14」の誤表示も直す（日数に通貨を付けていた）。
   実行: node patch-payslip5.mjs                                            */
import { readFileSync, writeFileSync } from 'fs';

const FILE = 'payslip.js';
let src = readFileSync(FILE, 'utf8');
const before = src.length;

/* ── 1. 文言 ──────────────────────────────────────────── */
const T_JA_ANCHOR = `      unmappedTitle: 'これはどれですか？',`;
const T_JA_ADD = `      askBlockT: '乗務時間（block hours）が読み取れませんでした',
      askBlockL: '1つ入れるだけで「乗務時間あたりの時給」が出ます。明細の block / 乗務時間の欄です。',
      askBlockF: '明細から拾いました。合っていれば、このままで大丈夫です。',
      editHint: '金額はこの表で直せます。直すと下のフォームと時給に反映されます。',
      nextT: 'あと{n}つで送信できます',
      nextL: '会社・職位・機材は明細に書いていないので、ここだけ選んでください。',
      nextB: '会社と職位を選ぶ →',
      nextOkT: '送信できます',
      nextOkL: '内容を確かめてから送ってください。押すまで投稿されません。',
      nextOkB: '送信ボタンへ →',
      days: '乗務日数',
      unmappedTitle: 'これはどれですか？',`;

const T_EN_ANCHOR = `      unmappedTitle: 'What are these?',`;
const T_EN_ADD = `      askBlockT: 'Block hours could not be read',
      askBlockL: 'Add this one number and you get pay per block hour. It is the block / flight time line on your slip.',
      askBlockF: 'Picked up from your slip. Leave it if it looks right.',
      editHint: 'You can fix the amounts right here. Edits flow into the form below and into your hourly pay.',
      nextT: '{n} more to go',
      nextL: 'Airline, seat and fleet are not on the slip, so pick those yourself.',
      nextB: 'Pick airline and seat →',
      nextOkT: 'Ready to send',
      nextOkL: 'Check it over first. Nothing is posted until you press send.',
      nextOkB: 'Go to send →',
      days: 'Flight days',
      unmappedTitle: 'What are these?',`;

for (const [a, add] of [[T_JA_ANCHOR, T_JA_ADD], [T_EN_ANCHOR, T_EN_ADD]]) {
  if (src.split(a).length - 1 !== 1) throw new Error('文言のアンカーが1箇所でない: ' + a);
  src = src.replace(a, add);
}

/* ── 2. 結果表示と時給を作り直す（606行目〜701行目を差し替え）───── */
const lines = src.split('\n');
const from = lines.findIndex((l) => l.startsWith('  function renderResult(res, trace) {'));
const to   = lines.findIndex((l) => l.startsWith('  // 手で直したら時給もついてくる'));
if (from < 0 || to < 0 || to <= from) throw new Error('差し替え範囲が見つからない');

const BODY = `  /* 表で直した金額を反映するために、読み取り結果を持っておく。
     同じ欄に行く行が複数ある（変動付加乗務手当・深夜割増・乗務回数手当→その他手当）ので、
     1行直したら、その欄に行く全部を足し直す。 */
  var lastTrace = [];

  function writeField(id, v) {
    var e2 = document.getElementById(id);
    if (!e2) return;
    e2.value = String(v);
    e2.classList.remove('ai-filled');        // 人が触った欄は「AIが入れた」印を外す
    e2.dispatchEvent(new Event('input', { bubbles: true }));
    e2.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pushTrace() {
    var sums = {};
    lastTrace.forEach(function (t) { sums[t.field] = (sums[t.field] || 0) + (t.amount || 0); });
    Object.keys(sums).forEach(function (id) { writeField(id, Math.round(sums[id])); });
    if (typeof recalc === 'function') recalc();
    renderRate();
  }

  /* 明細のラベルに「78:12」のような時分表記が混じっていることがある
     （Flying Pay (78:12 @ 210.00) など）。乗務時間が読めなかったときの
     候補として拾う。★勝手に入れない。入力欄に置いて本人に確かめてもらう。 */
  function guessBlock(res) {
    var all = (res.earnings || []).concat(res.unmapped || []);
    for (var i = 0; i < all.length; i++) {
      var m = String(all[i].label || '').match(/(\\d{1,3}):([0-5]\\d)/);
      if (m) {
        var v = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
        if (v >= 10 && v <= 150) return Math.round(v * 10) / 10;   // 月間の乗務時間として妥当な範囲だけ
      }
    }
    return 0;
  }

  function missingForSubmit() {
    var need = [];
    ['f-airline', 'f-position', 'f-fleet'].forEach(function (id) {
      var e2 = document.getElementById(id);
      if (e2 && !String(e2.value).trim()) need.push(id);
    });
    return need;
  }

  function renderResult(res, trace) {
    lastTrace = trace;
    clearPanel();
    /* ★通貨は「明細に書いてあった通貨」をそのまま出す。ここで換算しない。
       換算した数字を明細の隣に並べると、どちらが実額か分からなくなる。 */
    var cur = res.currency ? esc2(res.currency) + ' ' : '';
    var box = el('div', 'ps-res');
    box.appendChild(el('div', 'ps-res-title', esc2(T.resultTitle)));
    box.appendChild(el('p', 'ps-res-lead', T.resultLead));
    if (res.confidence === 'low') box.appendChild(el('p', 'ps-warn', esc2(T.lowConf)));

    /* ★時給を表より先に出す。明細を落とした人が見たいのはこれ1つ。
       前は送信ブロックの中（2,800px 下）に入れていたので誰も見なかった。 */
    box.appendChild(rateCard(guessBlock(res)));

    if (trace.length) {
      var rows = trace.map(function (t, i) {
        return '<tr><td>' + esc2(t.label) + '</td><td class="ps-to">' + esc2(lbl(t.field)) +
               '</td><td class="ps-amt"><span class="ps-cur">' + cur.trim() + '</span>' +
               '<input class="ps-edit" type="number" step="any" inputmode="decimal" data-i="' + i +
               '" value="' + Math.round(t.amount) + '"></td></tr>';
      }).join('');
      var tbl = el('table', 'ps-tbl ps-tbl-edit',
        '<thead><tr><th>' + esc2(T.col1) + '</th><th>' + esc2(T.col2) + '</th><th>' + esc2(T.col3) +
        '</th></tr></thead><tbody>' + rows + '</tbody>');
      tbl.addEventListener('input', function (ev) {
        var t2 = ev.target;
        if (!t2.classList.contains('ps-edit')) return;
        var i = Number(t2.getAttribute('data-i'));
        if (!lastTrace[i]) return;
        lastTrace[i].amount = Number(t2.value) || 0;
        pushTrace();
      });
      box.appendChild(tbl);
      box.appendChild(el('p', 'ps-note', esc2(T.editHint)));
    }

    // 読めたが保存先がまだ無いもの＝画面に出すだけ。黙って捨てない。
    var extra = [];
    if (res.deductions_total > 0) extra.push([T.deduct, cur + nf.format(Math.round(res.deductions_total))]);
    if (res.net_pay > 0) extra.push([T.net, cur + nf.format(Math.round(res.net_pay))]);
    ['duty', 'night', 'credit'].forEach(function (k) {
      if (lastHours[k]) extra.push([T[k + 'H'], nf1.format(lastHours[k]) + ' h']);
    });
    if (extra.length) {
      box.appendChild(el('table', 'ps-tbl ps-tbl-dim', '<tbody>' + extra.map(function (p) {
        return '<tr><td colspan="2">' + esc2(p[0]) + '</td><td class="ps-amt">' + esc2(p[1]) + '</td></tr>';
      }).join('') + '</tbody>'));
      box.appendChild(el('p', 'ps-note', T.notStored));
    }

    if (res.unmapped && res.unmapped.length) {
      box.appendChild(el('div', 'ps-res-title ps-sm', esc2(T.unmappedTitle)));
      box.appendChild(el('p', 'ps-note', esc2(T.unmappedLead)));
      box.appendChild(el('table', 'ps-tbl ps-tbl-dim', '<tbody>' + res.unmapped.map(function (u) {
        /* ★「乗務日数 14」に JPY を付けていた。金額でないものに通貨を付けると
             読み手はまず「壊れている」と思う。日数・回数は通貨なしで出す。 */
        var isCount = /日数|回数|days|count|sectors|legs/i.test(String(u.label));
        return '<tr><td colspan="2">' + esc2(u.label) + '</td><td class="ps-amt">' +
               (isCount ? nf.format(Math.round(u.amount)) : cur + nf.format(Math.round(u.amount))) +
               '</td></tr>';
      }).join('') + '</tbody>'));
    }

    box.appendChild(nextCard());

    panel.appendChild(box);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── 次の行動 ───────────────────────────────────────────
     「読み取りました」で止めない。送信ボタンはページのいちばん下にあるので、
     ここから連れて行く。会社・職位・機材は明細に書いていないので人が選ぶ。 */
  function nextCard() {
    var need = missingForSubmit();
    var card = el('div', 'ps-next');
    var ok = need.length === 0;
    card.innerHTML =
      '<div class="ps-next-t">' + esc2(ok ? T.nextOkT : T.nextT.replace('{n}', need.length)) + '</div>' +
      '<p class="ps-next-l">' + esc2(ok ? T.nextOkL : T.nextL) + '</p>';
    var b = el('button', 'btn-orange', esc2(ok ? T.nextOkB : T.nextB));
    b.type = 'button';
    b.addEventListener('click', function () {
      var target = document.getElementById(need[0] || 'submit-block') ||
                   document.getElementById('submit-block');
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (need[0] && target.focus) setTimeout(function () { target.focus(); }, 400);
    });
    card.appendChild(b);
    return card;
  }

  // ════════════════════════════════════════════════════════
  // 時給 ── 商品そのもの
  //   ★煽らない。パーディアムは非課税の実費補填なので既定では分子に入れない。
  //   ★乗務時間あたりと総勤務時間あたりを両方出す。差そのものが発見。
  // ════════════════════════════════════════════════════════
  var pdOn = false;

  function monthlyCash() {
    if (typeof annualTotal !== 'function' || typeof num !== 'function') return 0;
    var m = (annualTotal() - num('f-bonus') - num('f-profit')) / 12;
    return pdOn ? m : m - num('f-perdiem');
  }

  /* カードの骨組みは1回だけ作る。数字の部分（#ps-rate-body）だけ描き直す。
     ★全部描き直すと、乗務時間の入力中にフォーカスが飛ぶ。
       #ps-panel は #form-wrap の中にあるので、ここで input を出すと
       フォーム側の再描画ハンドラが必ず走る。 */
  function rateCard(guess) {
    var card = el('div', 'ps-rate');
    card.id = 'ps-rate';
    card.innerHTML =
      '<div class="ps-rate-t">' + esc2(T.rate) + '</div>' +
      '<div id="ps-rate-body"></div>' +
      '<div class="ps-ask" id="ps-ask" hidden>' +
        '<div class="ps-ask-t">' + esc2(T.askBlockT) + '</div>' +
        '<p class="ps-ask-l">' + esc2(T.askBlockL) + '</p>' +
        '<div class="ps-ask-in"><input type="number" step="any" min="0" max="200" ' +
          'inputmode="decimal" id="ps-ask-block" placeholder="78.5"><span>h</span></div>' +
        '<p class="ps-note" id="ps-ask-f" hidden>' + esc2(T.askBlockF) + '</p>' +
      '</div>' +
      '<label class="ps-pd"><input type="checkbox" id="ps-pd"><span>' + esc2(T.pdOn) + '</span></label>' +
      '<p class="ps-note">' + esc2(T.pdNote) + '</p>';

    var ask = card.querySelector('#ps-ask-block');
    ask.addEventListener('input', function () {
      writeField('f-block', ask.value);        // f-block に直接入れる＝送信にも乗る
      renderRate();
    });
    if (guess && typeof num === 'function' && !num('f-block')) {
      ask.value = String(guess);
      card.querySelector('#ps-ask-f').hidden = false;
      writeField('f-block', guess);
    }
    var cb = card.querySelector('#ps-pd');
    cb.checked = pdOn;
    cb.addEventListener('change', function () { pdOn = cb.checked; renderRate(); });

    setTimeout(renderRate, 0);                 // DOM に入ってから数字を描く
    return card;
  }

  function renderRate() {
    var body = document.getElementById('ps-rate-body');
    if (!body || typeof num !== 'function') return;
    var cur = (document.getElementById('f-currency') || {}).value || '';
    var m = monthlyCash();
    var block = Math.max(num('f-block'), num('f-guar'));
    var duty = lastHours && lastHours.duty ? lastHours.duty : 0;

    var askBox = document.getElementById('ps-ask');
    if (askBox) askBox.hidden = !!block;       // 乗務時間が入ったら質問を引っ込める

    if (m <= 0 || (!block && !duty)) { body.innerHTML = ''; return; }

    var big = function (v, hours, key, hint) {
      if (!hours) return '';
      var per = v / hours;
      return '<div class="ps-rate-row"><div><div class="ps-rate-k">' + esc2(T[key]) + '</div>' +
        '<div class="ps-rate-h">' + esc2(hint) + '</div></div>' +
        '<div class="ps-rate-v">' + esc2(cur) + ' ' + nf.format(Math.round(per)) +
        '<span class="ps-rate-min">' + esc2(T.perMin) + ' ' + nf1.format(per / 60) + '</span></div></div>';
    };

    body.innerHTML =
      big(m, block, 'perBlock', T.blockHint) +
      big(m, duty, 'perDuty', T.dutyHint) +
      (duty ? '' : '<p class="ps-note">' + esc2(T.needDuty) + '</p>');
  }

`;

src = lines.slice(0, from).join('\n') + '\n' + BODY + lines.slice(to).join('\n');

/* ── 3. 検算 ───────────────────────────────────────────── */
const must = ['function rateCard(', 'ps-rate-body', 'ps-edit', 'function nextCard(',
              'function guessBlock(', 'lastTrace', 'isCount'];
must.forEach((s) => { if (!src.includes(s)) throw new Error('入っていない: ' + s); });
if (src.includes(`host.insertBefore(card, host.firstChild)`)) throw new Error('古い時給カードの差し込みが残っている');
if ((src.match(/function renderRate\(/g) || []).length !== 1) throw new Error('renderRate が1つでない');
new Function(src);                                             // 構文検査

writeFileSync(FILE, src);
console.log(`✅ ${FILE}  ${before} → ${src.length} bytes`);
