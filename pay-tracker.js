/* ════════════════════════════════════════════════════════════════
   pay-tracker.js — マイページの「明細トラッカー」

   profile.html / en/profile.html の #pay-tracker に載る。
   ページ側の inline script より **後**に読むこと（sb を借りている）。
   ★ pay-viz.js（数字と図）と pay-viz.css（見た目）が先に要る。
     どちらも my-value.html と共有しているので、ここへ書き戻さないこと。

   ── なぜこれを作るか ────────────────────────────────────────
   この事業の資産は「月次で更新され続けるデータ」。だが今までは、
   明細を出したあとに **戻ってくる理由が1つも無かった**。
   解放は submit_pay_report が配るが、それが見える場所がどこにも無く、
   自分の推移も見られなかった＝出す側から見れば「投げっぱなし」。

   ここで返すのは期間ではなく **深さ**（db/pay-reports.sql の解放は90日固定）。
   月を重ねた人ほど線が伸び、内訳が積み上がる。それが戻る理由になる。

   ── 数字の作り方 ────────────────────────────────────────────
   時給の分子・内訳の分け方・通貨は pay-viz.js に1箇所だけある（そこの頭に
   理由を全部書いた）。ここでは持たない。

   このファイルが単独で持っている決めごとはこれだけ：
   ・比較は pay_benchmarks（n≧5 でしか行が返らないビュー）だけ。
     ★ n<5 の件数は絶対に出さない。「誰が出したか」自体が機微な情報で、
       会社側がアカウントを1つ作れば全セルを総当たりできてしまう。

   ── 通貨 ────────────────────────────────────────────────────
   カード全体に pv-no-cur を付け、金額は自前で PVViz.fmt() を通す。
   currency.js の自動スキャンは text を span で包むので、SVG の中では使えない。
   salary-leveling.js と同じ方式。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  var root = d.getElementById('pay-tracker');
  if (!root) return;

  // ページ側の inline script が作った Supabase クライアントを借りる。
  // 先に落ちていたら（TDZ / 未定義）このカードは黙って出さない。
  var SB = null;
  try { SB = sb; } catch (e) { SB = null; }
  if (!SB) return;

  var L = (d.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';

  // ── 文言 ──────────────────────────────────────────────────
  var T = {
    ja: {
      title: '明細トラッカー',
      lead: '出した明細が、毎月ここに積み上がります。',
      unlockOn: '解放中', unlockOff: '未解放',
      daysLeft: '解放の残り', days: '日',
      streak: '連続提出', months: 'ヶ月',
      count: '出した明細', sheets: '枚',
      /* ★「累計年収」「生涯年収」とは書かない。足しているのは出した明細ぶんだけで、
         出していない月は1円も入っていない。数え上げたものの名前で言う。 */
      onRecord: '記録した額面',
      /* ★ 行き先のページ名に合わせる。my-value.html は「マイレポート」に作り替えた
         （「市場価値」という言い方はもう使わない）。ここだけ古い名前だと、
         押した先の見出しと違う名前が出て「別のページに来た」と感じさせる。 */
      report: 'マイレポートを見る →',
      latest: 'いちばん新しい月',
      perBlock: '乗務時間あたり', perDuty: '総勤務時間あたり',
      trend: '月ごとの推移',
      mHourly: '時給（乗務）', mAnnual: '年収（12ヶ月換算）', mNet: '差引支給額（月）',
      onePoint: '点が1つだけです。来月の明細を1枚落とすと、ここに線が引けます。',
      noMetric: 'この指標に使える月がまだありません。',
      breakdown: 'いちばん新しい月の内訳',
      segBase: '基本給', segGuarantee: '保証手当・職務手当', segCommand: '機長・役職手当',
      segInstructor: '教官・訓練手当', segExaminer: '審査・査察手当',
      segUnion: '組合・乗員代表手当', segManagement: '管理・マネジメント手当',
      segNonline: 'その他の兼務・配属手当',
      segFlight: '乗務変動手当',
      segOther: 'その他手当', segHousing: '住宅手当', segTransport: '交通費', segPerDiem: 'パーディアム',
      /* ★下の2つは総支給が入っている行にしか出ない（pay-viz.js の segments()）。
         ★2026-08-26、総支給と内訳が両立するようになったので「内訳を入れていない分」
           という言い方をやめた。内訳を書いた人にも残りは出る＝それは
           「どの項目にも入れていない分」であって「内訳が無い」ではない。 */
      segBonus: '今月の賞与', segRest: 'どの項目にも入れていない分',
      housingNote: '※ 社宅（現物支給）は現金ではないので内訳に入れていません。',
      /* ★組合が総支給の外で払った分も、受け取った額としてこの円に入れている。
         会社の明細には載らない額なので、その1点だけ断る（2026-09-02）。 */
      unionOutNote: '※ 組合から別に受け取った分は、会社の明細には印字されません。受け取った額としてこの円に入れています。',
      cmpTitle: '同じ会社・同じ機材・同じ職位の中央値との差',
      // 「+8% 中央値より」は日本語にならない。語順ごと言語側で持つ。
      cmpTxt: function (p) {
        return Math.abs(p) < 2 ? '中央値とほぼ同じ'
          : '中央値より ' + (p > 0 ? '+' : '−') + Math.abs(p) + '%';
      },
      cmpN: '人ぶんの中央値',
      cmpLocked: '比較はまだ開いていません。同じ会社・機材・職位で5人以上そろうと自動で開きます。',
      cmpWhy: '5人未満で出すと、その1人が誰かに絞られてしまうため出していません。',
      remind: '明細のリマインドを受け取る',
      remindOn: 'あなたの給料日ごろに、月1回だけ届きます。',
      remindOff: '現在オフ。リマインドは届きません。',
      remindWhen: function (dd) { return '目安：毎月 ' + dd + '日ごろ'; },
      remindNote: 'メール本文に明細の項目名や金額は書きません。解除リンクは毎回入ります。',
      ctaFirst: '明細を1枚落とすと、あなたの時給が出ます',
      ctaFirstSub: '画像は端末の中で黒塗りしてから送られ、保存はされません。判定結果だけが残ります。',
      ctaBtn: '明細から入力する →',
      ctaMore: '今月ぶんを追加する →',
      err: 'トラッカーを読み込めませんでした。',
      /* sfo / tri_tre は 2026-08-18 に選択肢から外した旧コード。過去の投稿がまだ持っているので、
         ラベルだけ残す（消すと本人のマイページに生の 'sfo' が出る）。 */
      cap: '機長', fo: '副操縦士', cadet: '訓練生',
      sfo: 'シニア副操縦士', tri_tre: '教官機長',
      ym: function (y, m) { return y + '年' + m + '月'; },
      ymShort: function (y, m) { return m + '月'; }
    },
    en: {
      title: 'Payslip tracker',
      lead: 'Every payslip you submit stacks up here, month by month.',
      unlockOn: 'Unlocked', unlockOff: 'Locked',
      daysLeft: 'Access left', days: 'days',
      streak: 'Streak', months: 'mo',
      count: 'Payslips filed', sheets: '',
      onRecord: 'Gross on record',
      report: 'See my report →',
      latest: 'Latest month',
      perBlock: 'per block hour', perDuty: 'per duty hour',
      trend: 'Month by month',
      mHourly: 'Hourly (block)', mAnnual: 'Annual (×12)', mNet: 'Net pay (month)',
      onePoint: 'Only one point so far. Drop next month’s payslip and this becomes a line.',
      noMetric: 'No month has the data this metric needs yet.',
      breakdown: 'Latest month, broken down',
      segBase: 'Base pay', segGuarantee: 'Guarantee / duty',
      segCommand: 'Command / position', segInstructor: 'Instructor / training',
      segExaminer: 'Examiner / check',
      segUnion: 'Union / representative', segManagement: 'Management / leadership',
      segNonline: 'Other / non-line assignment',
      segFlight: 'Flight variable',
      segOther: 'Other allowances', segHousing: 'Housing', segTransport: 'Transport', segPerDiem: 'Per diem',
      /* ★The two below only appear on a row filed as one gross figure (see segments() in pay-viz.js). */
      segBonus: 'Bonus this month', segRest: 'Not itemised',
      housingNote: '※ Company-provided housing is not cash, so it is left out of the breakdown.',
      unionOutNote: '※ Money your union pays you directly is not printed on the company payslip. It is included here as pay you received.',
      cmpTitle: 'Versus the median for your airline, fleet and seat',
      // 負のとき「-8% below the median」は二重否定になる。絶対値で言う。
      cmpTxt: function (p) {
        return Math.abs(p) < 2 ? 'Right at the median'
          : (p > 0 ? '+' + p + '% above the median' : Math.abs(p) + '% below the median');
      },
      cmpN: 'pilots in that median',
      cmpLocked: 'Comparison is not open yet. It opens automatically once 5 pilots share the same airline, fleet and seat.',
      cmpWhy: 'Below 5, publishing it could narrow down who those pilots are — so we do not.',
      remind: 'Remind me when my payslip lands',
      remindOn: 'Once a month, around your own payday.',
      remindOff: 'Off. No reminders will be sent.',
      remindWhen: function (dd) { return 'Around the ' + ORD(dd) + ' of each month'; },
      remindNote: 'The email never contains payslip line items or amounts, and always carries a one-click unsubscribe link.',
      ctaFirst: 'Drop one payslip and you get your real hourly pay',
      ctaFirstSub: 'The image is redacted on your own device before it is sent, and it is never stored. Only the reading is kept.',
      ctaBtn: 'Start from a payslip →',
      ctaMore: 'Add this month →',
      err: 'Could not load the tracker.',
      /* sfo / tri_tre are retired codes (removed from the form 2026-08-18). Old reports still carry
         them, so keep the labels — otherwise the raw code shows up on the member's own page. */
      cap: 'Captain', fo: 'First Officer', cadet: 'Cadet',
      sfo: 'Senior First Officer', tri_tre: 'Instructor Captain',
      ym: function (y, m) { return MON[m - 1] + ' ' + y; },
      ymShort: function (y, m) { return MON[m - 1]; }
    }
  }[L];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // 給料日は 1〜31 なので 11/12/13 の例外だけ見れば足りる
  function ORD(n) {
    var v = Number(n) || 0;
    var s = (v % 100 >= 11 && v % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th');
    return v + s;
  }

  /* ── 数字と図は pay-viz.js（唯一の定義）────────────────────
     ★ calc() をここに書き戻さないこと。時給の分子（年額 − 賞与 ÷12 −
       パーディアム）が2箇所にあると、片方だけ直したときに画面とDBの定義が
       静かにずれる。db/test-form-contract.mjs が見張っているのがその事故。
     見た目は pay-viz.css。ページ側で両方読み込むこと。 */
  var V = w.PVViz;
  if (!V) return;                       // 読み込み順が崩れたらカードごと出さない
  var esc = V.esc, num = V.num, yen = V.fmt;
  var calc = V.calc, metricOf = V.metricOf;

  // 内訳の名前（色は pay-viz.js が持つ）
  var SEGNAME = {
    base:    T.segBase,    guarantee: T.segGuarantee,
    command: T.segCommand, instructor: T.segInstructor,
    examiner: T.segExaminer, union: T.segUnion, management: T.segManagement,
    nonline: T.segNonline,
    flight:  T.segFlight,
    other:   T.segOther,   housing:   T.segHousing,   transport: T.segTransport,
    perdiem: T.segPerDiem,
    bonus:   T.segBonus,   rest:      T.segRest
  };

  var state = { data: null, metric: 'hourly', bench: null, busy: false };

  /* ── 図（中身は pay-viz.js。ここは文言を渡すだけ）──────────── */
  function donut(r) {
    return V.donut(r, {
      title: T.breakdown,
      name: SEGNAME,
      notes: { housing: T.housingNote, unionOut: T.unionOutNote }
    });
  }

  /* 幅は実測してから渡す。viewBox を伸縮させると文字まで拡大縮小されて
     スマホで読めなくなるので、コンテナの実寸で組む（resize で組み直す）。 */
  function chart(rows, key) {
    return V.chart(rows, key, {
      width:   V.widthOf(root.querySelector('.pt-chart'), root),
      labelOf: function (r) { return T.ymShort(r.period_year, r.period_month); },
      aria:    T.trend,
      onePoint: T.onePoint,
      noMetric: T.noMetric
    });
  }

  // ── 比較（n≧5 のセルしか存在しないビューを引くだけ）──────────
  function compare(r) {
    var body;
    if (state.bench && state.bench.n >= 5) {
      var mine = num(r.annual_total_usd), med = num(state.bench.median_usd);
      if (mine != null && med > 0) {
        var pct = Math.round((mine / med - 1) * 100);
        var col = Math.abs(pct) < 2 ? '#9ca3af' : (pct > 0 ? '#48c78e' : '#f5c842');
        body = '<div class="pt-cmp"><b style="color:' + col + '">' + esc(T.cmpTxt(pct)) + '</b>' +
               '<span>' + state.bench.n + ' ' + esc(T.cmpN) + '</span></div>';
      }
    }
    if (!body) {
      body = '<div class="pt-locked">' + esc(T.cmpLocked) +
             '<div class="pt-note" style="margin-top:6px">' + esc(T.cmpWhy) + '</div></div>';
    }
    return '<div class="pt-sec"><div class="pt-h">' + esc(T.cmpTitle) + '</div>' + body + '</div>';
  }

  // ── 空の状態（まだ1枚も出していない人）────────────────────
  function renderEmpty(dat) {
    root.innerHTML =
      '<div class="pt-top"><div class="pt-title">' + esc(T.title) + '</div></div>' +
      '<div class="pt-first">' +
        '<div class="pt-first-h">' + esc(T.ctaFirst) + '</div>' +
        '<div class="pt-first-s">' + esc(T.ctaFirstSub) + '</div>' +
        '<a class="pt-btn" href="' + payHref() + '">' + esc(T.ctaBtn) + '</a>' +
      '</div>' + remindBlock(dat);
    bind();
  }

  function payHref() { return 'pay-report.html#ps'; }

  function remindBlock(dat) {
    var on = !!(dat && dat.mail_optin);
    var day = dat && dat.pay_day_of_month;
    var when = (on && day) ? '<div class="pt-note">' + esc(T.remindWhen(day)) + '</div>' : '';
    return '<div class="pt-sec pt-remind">' +
      '<div class="pt-remind-row">' +
        '<div><div class="pt-remind-h">' + esc(T.remind) + '</div>' +
        '<div class="pt-note" id="pt-remind-hint">' + esc(on ? T.remindOn : T.remindOff) + '</div></div>' +
        '<button id="pt-remind-sw" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" ' +
          'aria-label="' + esc(T.remind) + '" class="pt-sw' + (on ? ' on' : '') + '"><span></span></button>' +
      '</div>' + when +
      '<div class="pt-note" style="margin-top:8px">' + esc(T.remindNote) + '</div></div>';
  }

  // ── 本体 ──────────────────────────────────────────────────
  function render() {
    var dat = state.data;
    if (!dat) return;
    var rows = dat.reports || [];
    if (!rows.length) return renderEmpty(dat);

    var last = rows[rows.length - 1];
    var c = calc(last);
    var until = dat.access_until ? new Date(dat.access_until) : null;
    var left = until ? Math.max(0, Math.ceil((until - Date.now()) / 86400000)) : 0;
    var unlocked = left > 0;

    var stat = function (v, lab, accent, cls) {
      return '<div class="pt-stat' + (cls ? ' ' + cls : '') + '">' +
             '<b' + (accent ? ' style="color:' + accent + '"' : '') + '>' + v + '</b>' +
             '<span>' + esc(lab) + '</span></div>';
    };

    /* これまでに記録した額面。出した明細ぶんの足し算（pay-viz.js の totals）で、
       会社をまたいで足す。詳しい内訳と断り書きは市場価値レポート側にあるので、
       ここは数字1つに留めてレポートへ送る。読めた明細が1枚も無ければ出さない
       （4つ目を「¥0」で埋めると「稼いでいない」に読める）。 */
    var tot = V.totals(rows);

    var big = function (v, lab) {
      return '<div class="pt-big"><b>' + esc(v == null ? '—' : yen(v)) + '</b><span>' + esc(lab) + '</span></div>';
    };

    var METRICS = [
      { k: 'hourly', nm: T.mHourly }, { k: 'annual', nm: T.mAnnual }, { k: 'net', nm: T.mNet }
    ].filter(function (m) {
      return rows.some(function (r) { var v = metricOf(r, m.k); return v != null && v > 0; });
    });
    if (!METRICS.some(function (m) { return m.k === state.metric; })) {
      state.metric = METRICS.length ? METRICS[0].k : 'hourly';
    }

    root.innerHTML =
      '<div class="pt-top">' +
        '<div><div class="pt-title">' + esc(T.title) + '</div>' +
        '<div class="pt-lead">' + esc(T.lead) + '</div></div>' +
        '<span class="pt-pill' + (unlocked ? ' on' : '') + '">' + esc(unlocked ? T.unlockOn : T.unlockOff) + '</span>' +
      '</div>' +

      /* マイページからレポートへの唯一の入口。ここが無いと、明細を出した直後の
         完了カードからしか市場価値レポートへ行けない＝翌月また見に来られない。 */
      '<a class="pt-btn" href="my-value.html" style="margin-top:0;margin-bottom:18px">' +
        esc(T.report) + '</a>' +

      '<div class="pt-stats' + (tot.gross != null ? ' four' : '') + '">' +
        stat(left + '<i>' + esc(T.days) + '</i>', T.daysLeft, unlocked ? '#48c78e' : '') +
        stat((dat.streak_months || 0) + '<i>' + esc(T.months) + '</i>', T.streak) +
        stat((dat.report_count || rows.length) + (T.sheets ? '<i>' + esc(T.sheets) + '</i>' : ''), T.count) +
        (tot.gross != null ? stat(esc(yen(tot.gross)), T.onRecord, '', 'money') : '') +
      '</div>' +

      '<div class="pt-sec">' +
        '<div class="pt-h">' + esc(T.latest) + '<span class="pt-sub">' +
          esc(T.ym(last.period_year, last.period_month)) +
          (last.fleet ? ' ・ ' + esc(String(last.fleet).toUpperCase()) : '') +
          (T[last.position] ? ' ・ ' + esc(T[last.position]) : '') + '</span></div>' +
        '<div class="pt-bigs">' +
          big(c.hourlyBlock, T.perBlock + (c.blockH ? ' / ' + c.blockH + 'h' : '')) +
          big(c.hourlyDuty,  T.perDuty  + (c.dutyH  ? ' / ' + c.dutyH  + 'h' : '')) +
        '</div>' +
      '</div>' +

      '<div class="pt-sec">' +
        '<div class="pt-h">' + esc(T.trend) + '</div>' +
        '<div class="pt-tabs">' + METRICS.map(function (m) {
          return '<button class="pt-tab' + (m.k === state.metric ? ' on' : '') + '" data-m="' + m.k + '">' +
                 esc(m.nm) + '</button>';
        }).join('') + '</div>' +
        '<div class="pt-chart"></div>' +
      '</div>' +

      donut(last) +
      compare(last) +
      '<a class="pt-btn ghost" href="' + payHref() + '">' + esc(T.ctaMore) + '</a>' +
      remindBlock(dat);

    // .pt-chart の実寸が要るので、DOM に入れてから描く
    var box = root.querySelector('.pt-chart');
    if (box) box.innerHTML = chart(rows, state.metric);
    bind();
  }

  function bind() {
    root.querySelectorAll('.pt-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        state.metric = b.getAttribute('data-m');
        render();
      });
    });
    var sw = d.getElementById('pt-remind-sw');
    if (sw) sw.addEventListener('click', toggleRemind);
  }

  async function toggleRemind() {
    if (state.busy || !state.data) return;
    state.busy = true;
    var next = !state.data.mail_optin;
    var hint = d.getElementById('pt-remind-hint');
    try {
      var res = await SB.rpc('set_mail_optin', { p_on: next });
      if (res.error) throw res.error;
      state.data.mail_optin = next;
      /* ★ このページには同意のスイッチが2つある（上の「メール通知」＝email_opt_in と、
         ここ＝mail_optin）。送信条件は両方 true なので、リマインドをオンにすると
         サーバ側で親（email_opt_in）も立つ（set_mail_optin）。それを上のスイッチに
         伝えないと、実際はオンなのに上だけオフのまま残る。 */
      var parent = res.data && res.data.email_opt_in;
      if (parent != null) {
        state.data.email_opt_in = parent;
        if (typeof w.PVOptInSync === 'function') w.PVOptInSync(!!parent);
      }
      render();
    } catch (e) {
      if (hint) hint.textContent = L === 'en'
        ? 'Could not save that setting. Please try again in a moment.'
        : '設定を保存できませんでした。時間をおいて再度お試しください。';
    } finally { state.busy = false; }
  }

  async function load() {
    var res;
    try { res = await SB.rpc('my_pay_reports'); } catch (e) { res = { error: e }; }
    // 関数がまだ本番に無い（SQL 未実行）ときは、カードごと出さない。
    // 半端なエラー文をマイページに残さないため。
    if (!res || res.error || !res.data) { root.style.display = 'none'; return; }
    state.data = res.data;

    var rows = state.data.reports || [];
    if (rows.length) {
      var last = rows[rows.length - 1];
      // n≧5 のセルしか行が無いビュー。無ければ null のまま＝比較は出さない。
      try {
        var b = await SB.from('pay_benchmarks')
          .select('n,median_usd,p25_usd,p75_usd,median_usd_per_bh')
          .eq('airline', last.airline).eq('position', last.position)
          .eq('fleet', last.fleet).eq('period_year', last.period_year)
          .maybeSingle();
        if (!b.error && b.data) state.bench = b.data;
      } catch (e) { /* 比較が引けなくてもトラッカー本体は出す */ }
    }
    root.style.display = '';
    render();
    revealIfLinked();
  }

  /* 明細を出した直後の「自分の記録を見る →」は profile.html#pay-tracker で来る。
     だがこのカードは my_pay_reports が返るまで display:none なので、
     ブラウザのアンカー跳びは**まだ場所を持たない要素**に対して起きて空振りする
     ＝せっかく出した人がページの一番上に落ちて、自分の記録を自力で探す羽目になる。
     描き終わった今、こちらから合わせに行く。
     nav が position:sticky（profile.html:16）なので、その下に潜らないよう
     上に余白を取る。 */
  function revealIfLinked() {
    if (w.location.hash !== '#pay-tracker') return;
    var nav = d.querySelector('nav');
    var pad = (nav ? nav.getBoundingClientRect().height : 0) + 16;
    var y = root.getBoundingClientRect().top + (w.pageYOffset || 0) - pad;
    var still = w.matchMedia && w.matchMedia('(prefers-reduced-motion:reduce)').matches;
    try { w.scrollTo({ top: Math.max(0, y), behavior: still ? 'auto' : 'smooth' }); }
    catch (e) { w.scrollTo(0, Math.max(0, y)); }
  }

  /* 上の「メール通知」（email_opt_in）が切られたら、こちらのリマインドも切れる。
     切るのは DB のトリガー profiles_mail_consent_sync（db/pay-reminder.sql）なので、
     画面はその結果に合わせるだけ。★ここで RPC を呼び直さない
     ＝画面の都合でもう一度書きに行くと、真の値がどちらか分からなくなる。 */
  w.PVRemindSync = function (parentOn) {
    if (!state.data) return;
    state.data.email_opt_in = !!parentOn;
    if (!parentOn) state.data.mail_optin = false;
    render();
  };

  // 通貨を切り替えたら、SVG の中の数字も追随させる（自動スキャンは届かない）
  w.addEventListener('pv-currency-change', function () { if (state.data) render(); });

  // 幅が変わったら折れ線を組み直す（viewBox を伸ばさない代わり）
  var rt = null;
  w.addEventListener('resize', function () {
    if (!state.data || !(state.data.reports || []).length) return;
    clearTimeout(rt);
    rt = setTimeout(function () {
      var box = root.querySelector('.pt-chart');
      if (box) box.innerHTML = chart(state.data.reports, state.metric);
    }, 160);
  });

  load();
})(window, document);
