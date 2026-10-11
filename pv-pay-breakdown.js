/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — pv-pay-breakdown.js
   総支給だけ出した月に、足りない内訳だけを足す入力
   （DEEP PAY と会社比較の、錠前の板の中に出る）

   なぜ要るか（2026-10-11・オーナー指示）:
     DEEP PAY を見られるのは、内訳まで出した会員だけ。総支給だけ出した人が内訳を
     足す道は、給与フォームを最初から出し直すしか無かった（会社・対象月・総支給・
     乗務時間…を全部打ち直す）。聞きたいのは、その人にまだ足りない分だけ（いまは
     基本給／保証手当・職務手当／変動給）。だからそれだけを、その場で聞く。
     サーバ側の口は db/deep-pay.sql の pv_pay_breakdown（頭の注に約束が全部ある）。

   ★呼ぶのは pv_pay_breakdown の1本だけ。読む（何も渡さない）→ 書く（読んだ月の鍵を
     そのまま返して、欄ごとの答えを添える）。
       ・読む … 足せる月が無ければ target は null。そのときは何も描かず、呼んだ側へ
                'none' と知らせる（板は今までどおりフォームへのボタンを出す）。
                読めなかったときも同じ ──「在る」と決めつけない。
       ・書く … ボタンを押した1回だけ。送っているあいだはボタンを止める。
                通ったあとも止めたまま（呼んだ側が画面を開き直すまで、二度送らない）。
   ★書けるのは内訳の列だけ（サーバが決めている）。ここは総支給も対象月も送らない
     ── 送るのは「どの月か」を指す鍵と、聞いた欄の答えだけ。

   ★金額の読み方は給与フォームと1文字も違えない。
     下の grp / readMoney は pay-report.html の本体を**コメントごと**写したもの。
     手で打つ欄の「,」は常にけた区切り・1.000 のような二通りに読める形は本人に聞く。
     ⚠️ ここだけ直さない。直すのは pay-report.html と en/pay-report.html で、
        ここへは写す（assert-deep-pay.mjs が3つを突き合わせている）。
     小数の桁は通貨で決まる（JPY は 0・KWD は 3）。出どころはフォームと同じ語彙
     （pv-vocab.mjs → pv-vocab.json の currencies[].dec。フォームの CUR_META も
     同じ語彙から gen-vocab.mjs が書いている）。取れなければ桁を渡さない＝
     readMoney の既定（1.000 は聞く）に落ちる。推測しない側。

   ★聞く欄は、下の FIELDS の**一覧1つ**から出る（2026-10-11）。描くのも・確かめるのも・
     送る中身を組むのも、全部この一覧を回すだけ ── 欄ごとの分岐をほかの場所に書かない。
     聞く物は増える予定なので、増やすときに触るのは一覧（と、その字の出どころの検査）だけ
     になるようにしてある。いま一覧に在るのは3つ（サーバの口がいま受け取る3つ）。
   ★一覧の欄を**全部**答えてから送る。答えは「金額（0 も答え）」か「該当なし」。
     空のままの欄は「未入力」と印を付けて止める（サーバにも同じ門がある）。
     内訳の合計が総支給を超えるかどうかは**サーバだけが決める** ── 合計には、
     この画面が知らない保存済みの手当（パーディアム・住宅手当…）も入る。

   ★文言は給与フォームの写し（欄の名前・補足・「該当なし」・超過の1文・読めない
     金額の1文・「未入力」）。言い換えない。新しく書いたのは、どの給与に足すかの
     見出しとボタンと、1日の上限の英語だけ。
     欄の名前と補足は FIELDS の中に在る（form ＝ フォームのどの欄の字か。検査が
     その id でフォームのラベルと突き合わせる）。

   ★社名は呼んだ画面の辞書（opts.airName）で引く。ここで社名の表を持たない。
     一覧に無い会社は、本人が打った社名（airline_other）をそのまま出す。
   ★サーバから来た字（社名・通貨・金額）は textContent でしか入れない。
     innerHTML に通すのは、このファイルに書いてある定数の文だけ。
   ★金額は本人の行の通貨のまま出す（換算しない）。器に pv-no-cur を付けてある。
   ★端末には何も残さない（localStorage / sessionStorage を使わない）。
     見られるかどうかを決めるのはサーバだけで、ここは鍵に触らない。
   ★見た目は自分で <style> を入れる（pv-pay-fix.js と同じ理由 ── 既存の CSS に
     足すと、古い CSS が残る最大4時間のあいだ素の文字が出る）。色は pv-tokens.css の
     変数。赤だけは変数が無いので、給与フォームの注意（.pd-warn）と同じ値を
     この器の中だけの変数（--pb-*）に写してある。
     ⚠️ ぼかし・マスクを置かない。入力欄は 16px を下回らせない（iOS の自動拡大）。
════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (w.PVPayBreakdown) return;

  /* pv-vocab.json はこのファイルと同じ階層にある。ページからの相対で引くと
     /en/ の下で 404 になるので、自分の置き場所から解く（読み込み時にしか取れない）。 */
  var SELF = (d.currentScript && d.currentScript.src) || '';
  var RPC = 'pv_pay_breakdown';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];
  /* ★「写し」と書いた行は、給与フォーム（pay-report.html / en/pay-report.html）に
       在る字そのまま。hint の <b> もあちらのまま（定数なので innerHTML で入れる）。
     ★limit の日本語はサーバが給与フォームの道で返す文（db/pay-reports.sql 5章）。
       英語は無かったので書いた。fail は pv-conditions.js の「保存できませんでした」。
     ★欄の名前と補足はここに無い。下の FIELDS が持つ。 */
  var TEXT = {
    ja: {
      to:    '内訳を追加する給与',
      gross: 'その月の総支給額',                                        // 写し
      none:  '該当なし',                                                // 写し
      cta:   '匿名で内訳を追加する',
      miss:  '未入力',                                                  // 写し
      over:  '内訳の合計（{sum}）が、上の総支給額（{gross}）を超えています。どちらかを見直してください。',   // 写し
      bad:   function (v) { return '「' + v + '」は金額として読めません。半角の数字で入れ直してください。'; },   // 写し
      ask:   function (v) { return '「' + v + '」は、どちらの金額ですか？'; },                                   // 写し
      badNum: function (v) { return '「' + v + '」は数字として読めません。半角の数字で入れ直してください。'; },  // 写し（readNum）
      rule:  '桁区切りは , 　小数点は .',                               // 写し
      limit: '1日に投稿できる件数の上限に達しました。明日また続きをどうぞ。',
      fail:  '保存できませんでした。時間をおいてもう一度お試しください。',
      month: function (y, m) { return y + '年' + m + '月分'; }
    },
    en: {
      to:    'Adding a breakdown to',
      gross: 'Gross pay that month',
      none:  'None of this applies',
      cta:   'Add your breakdown anonymously',
      miss:  'Missing',
      over:  'The breakdown ({sum}) adds up to more than the gross pay above ({gross}). Please check one of the two.',
      bad:   function (v) { return '“' + v + '” is not a number we can read. Please type it again in digits.'; },
      ask:   function (v) { return 'Which amount is “' + v + '”?'; },
      badNum: function (v) { return '“' + v + '” is not a number we can read. Please type it again in digits.'; },
      rule:  'Comma groups thousands · dot is the decimal point',
      limit: 'You have reached today’s limit for pay reports. Please continue tomorrow.',
      fail:  'Could not save. Please try again later.',
      month: function (y, m) { return (MONTHS[m - 1] || '') + ' ' + y; }
    }
  };
  /* ── 聞く物の一覧（欄は**ここにしか**書かない）──────────────────────
     描く・確かめる・送る中身を組む、は全部この一覧を回すだけ。欄を足す・減らすときは
     この一覧に1行足す／消す（と、サーバの口が同じ鍵を受け取ること）。
       id    … サーバへ送る鍵。金額は { id: '285000' }、「該当なし」は { id_none: true }
       kind  … 'amount-with-none' ＝ 金額（本人の行の通貨）＋「該当なし」の札
               'number'           ＝ 数（時間・日数など）。通貨も「該当なし」も付かない
       form  … 給与フォームのどの欄の字を写したか（フォームの入力の id）。
               assert-deep-pay.mjs が、この id でフォームのラベル・補足と突き合わせる
       label … 欄の名前（日英）。フォームの字そのまま
       hint  … 補足（日英・無ければ書かない）。フォームの字そのまま（<b> も）
     ★いま在る3つの並びと鍵は、サーバ（db/deep-pay.sql の v_k）と同じ。
     ⚠️ ここに欄を足しただけでは保存されない。サーバの口（pv_pay_breakdown）が
        その鍵を読むようになってから足す（知らない鍵は、いまの口では黙って捨てられる）。
     ⚠️ 'number' の欄はまだ1つも無い（器だけ）。足す回に、下の readNumber の注を読む。 */
  var FIELDS = [
    { id: 'base', kind: 'amount-with-none', form: 'f-base',
      label: { ja: '基本給', en: 'Base pay' } },
    { id: 'guarantee', kind: 'amount-with-none', form: 'f-guarantee',
      label: { ja: 'Flight time 保証手当 / 職務手当', en: 'Flight time guarantee / Duty allowance' },
      hint:  { ja: '基本給とは<b>別に金額として明細に出ている</b>場合だけ（Minimum Guarantee・保証給・職務手当）。',
               en: 'Only if it appears on your payslip <b>as an amount separate from base pay</b> (Minimum Guarantee, guaranteed pay, duty allowance).' } },
    { id: 'variable', kind: 'amount-with-none', form: 'f-var-sum',
      label: { ja: '変動給', en: 'Variable pay' } }
  ];
  /* いま出す欄。★ここが「足りない物だけを出す」ための1か所の継ぎ目。
       いまは一覧ぜんぶ（サーバが返す月は「内訳が1つも無い月」だけなので、3つとも足りない）。
       聞く物が増えて「その行にまだ無い物だけ」を出すようになったら、サーバが返す答えを
       見てここで絞る ── 描く側・送る側は、ここが返した欄だけを回す。 */
  function wanted(target) {
    return target ? FIELDS.slice() : [];
  }

  /* ── 金額の読み取り（pay-report.html の grp / readMoney をコメントごと写した）──
     ⚠️ この2つは**行頭から**書いてある（字下げしていない）。字下げを足すと、
        assert-deep-pay.mjs の「1文字も違わない」が落ちる。
     ⚠️ 中のコメントが指している amtConfirmNeeded / fmtMoneyLive / .ma-rule は
        **給与フォームの側**の話。このファイルには無い ── ここで張っている網は、
        読めない・二通りに読める額を送らないこと（settle / send）と、サーバの検品。 */
function grp(s) {
  const t = String(s == null ? '' : s).replace(/[^0-9.]/g, '');
  const i = t.split('.')[0];
  const d = t.indexOf('.') >= 0 ? '.' + t.split('.').slice(1).join('') : '';
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + d;
}
function readMoney(s, dec) {
  const raw = String(s == null ? '' : s).trim();
  if (!raw) return { n: null, canon: '', state: 'empty', alts: [] };
  /* 全角・空白・通貨記号は落とす。残りが数字と区切りだけでなければ読まない。 */
  const t = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[．｡。]/g, '.').replace(/[，、､]/g, ',')
    .replace(/[\s\u00A0'’_]/g, '')
    .replace(/^[¥￥$＄€£₩]+/, '');
  const bad = { n: null, canon: raw, state: 'bad', alts: [] };
  if (!/^[0-9.,]+$/.test(t) || !/[0-9]/.test(t)) return bad;

  const asDec = (str, sep) => {            // sep を小数点として読む
    const i = str.lastIndexOf(sep);
    const ip = str.slice(0, i).replace(/[.,]/g, ''), dp = str.slice(i + 1);
    if (/[.,]/.test(dp)) return null;
    const v = parseFloat((ip || '0') + '.' + (dp || '0'));
    return isFinite(v) ? v : null;
  };
  const asPlain = (str) => { const v = parseFloat(str.replace(/[.,]/g, '')); return isFinite(v) ? v : null; };
  const grouped = (str, sep) => new RegExp('^\\d{1,3}(\\' + sep + '\\d{3})+$').test(str);
  const ok = (n) => ({ n: n, canon: grp(String(n)), state: 'ok', alts: [] });
  const ask = (a, b) => (a == null || b == null || a === b) ? bad
    : { n: null, canon: raw, state: 'ambiguous', alts: [{ n: a, canon: grp(String(a)) }, { n: b, canon: grp(String(b)) }] };

  const dot = t.indexOf('.') >= 0, com = t.indexOf(',') >= 0;

  /* 1) 区切りが2種類 ── 後ろに出たほうが小数点。ここに曖昧さは無い。
        1,234.56（英米式）も 1.234,56（欧州式）も、これ1本で正しく読める。 */
  if (dot && com) {
    const d = t.lastIndexOf('.') > t.lastIndexOf(',') ? '.' : ',';
    const g = d === '.' ? ',' : '.';
    if (t.split(d).length > 2) return bad;
    if (!grouped(t.slice(0, t.lastIndexOf(d)), g)) return bad;
    const v = asDec(t, d);
    return v == null ? bad : ok(v);
  }
  /* 2) カンマだけ ── **常に桁区切り**（2026-09-15 オーナー決定）────────────
        このサイトの書き方は「, が桁区切り・. が小数点」で、二択の中の .ma-rule にも
        そう出している。読み取りもその1本に揃える。**書式（3桁に割れるか）は見ない。**
        ・1,150,000 → 1150000
        ・200,00    → 20000    ← 200,000 から 0 を1つ消した形
        ・1,100,00  → 110000
        ・1,23,456  → 123456
        ⚠️ 2026-09-11 は逆にしていた（3桁に割れないカンマ＝小数点）。狙いは、ヨーロッパ式に
           3500,50 と書く人の額が 350,050（100倍）になるのを防ぐこと。2026-09-15、オーナーが
           「3500,00 は 350,000 でいい」と決めてこちらへ戻した。100倍の網は、提出直前の
           amtConfirmNeeded（「この額で合っていますか」）が張っている。
        ★この規則だから「カンマを落として組み直す」操作が**可逆**になり、打鍵中の桁区切り
          （fmtMoneyLive）を戻せた。**片方だけ戻さないこと。** 詳しくは下の fmtMoneyLive の節。 */
  if (com) {
    const v = asPlain(t);
    return v == null ? bad : ok(v);
  }
  /* 3) ピリオドだけ */
  if (dot) {
    /* 1.234.567 は小数点が2つある数にはなり得ない＝桁区切りしかない。 */
    if (t.split('.').length > 2) return grouped(t, '.') ? ok(asPlain(t)) : bad;
    const ip = t.slice(0, t.indexOf('.')), dp = t.slice(t.indexOf('.') + 1);
    const v = asDec(t, '.');
    if (v == null) return bad;
    /* 1.000 / 500.000 だけは 1000 とも 1.0 とも読める。**ここだけ聞く。**
       ★先頭が 0 の 0.500 は外す。500 を 0.500 と書く人は居ない＝桁区切りとしては
         成立しない書式なので、聞かずに 0.5 と読む。
       ★ただし小数が無い通貨（JPY/KRW/ISK/HUF/IDR/VND/CLP ＝ CUR_META の第1要素が 0）では
         1.0 という額そのものが有り得ない＝聞く意味が無い。推測ではなく消去法。
         サーバ側（supabase/functions/parse-payslip）は最初からこの方式で決めている
         （あちらは聞き返せないので dec===3 側も同じ理屈で倒している）。
         dec を渡していないとき（既定 undefined）は今までどおり聞く。 */
    if (/^[1-9]\d{0,2}$/.test(ip) && /^\d{3}$/.test(dp)) {
      if (dec === 0) return ok(asPlain(t));
      return ask(asPlain(t), v);
    }
    return ok(v);
  }
  /* 4) 区切り無し */
  const v = asPlain(t);
  return v == null ? bad : ok(v);
}

  /* 数（時間・日数など）の読み方。★**仮の読み手**。いま 'number' の欄は1つも無い。
     給与フォームでは、時間・日数の欄は readNum という**別の読み手**が読む ── 金額と
     違って「,」も「.」も小数点で、欄ごとの範囲（data-min / data-max）と整数だけの印
     （data-dec="0"）も見る。しかも断りの文が関数の中に在り、日英で本体の字が違う。
     'number' の欄を足す回に、その readNum を写してここを差し替える（金額の読み手と
     同じく、写しがずれていないことを検査で突き合わせる）。
     それまでは推測しない側 ── 半角の数字と小数点1つだけを数として読み、ほかは全部
     「読めない」（「,」をどちらにも倒さない）。 */
  function readNumber(s) {
    var raw = String(s == null ? '' : s).trim();
    if (!raw) return { n: null, canon: '', state: 'empty', alts: [] };
    if (!/^[0-9]+(\.[0-9]+)?$/.test(raw)) return { n: null, canon: raw, state: 'bad', alts: [] };
    return { n: Number(raw), canon: raw, state: 'ok', alts: [] };
  }
  /* 1欄ぶんの答えを読む（画面に触らない＝検査がそのまま呼べる）。
       def  … FIELDS の1行 ／ raw … 欄の字 ／ none … 「該当なし」が付いているか
       dec  … 通貨の小数の桁（金額の欄だけが使う）
     返す state は 'none'（該当なし）/ 'ok' / 'empty' / 'bad' / 'ambiguous'。
     ★サーバへ送れる形（数字と小数点だけ）にならない額は、読めない額として扱う。 */
  function answer(def, raw, none, dec) {
    if (def.kind === 'amount-with-none' && none) return { n: null, canon: '', state: 'none', alts: [] };
    var r = (def.kind === 'number') ? readNumber(raw) : readMoney(raw, dec);
    if (r.state === 'ok' && !/^[0-9]+(\.[0-9]+)?$/.test(String(r.n)))
      return { n: null, canon: String(raw == null ? '' : raw), state: 'bad', alts: [] };
    return r;
  }
  /* 答えを、送る中身へ足す。★鍵の組み方はここ1か所（金額は字で・「該当なし」は true）。
     答えていない欄（empty / bad / ambiguous）は何も足さず false を返す。 */
  function put(p, def, a) {
    if (a.state === 'none') { p[def.id + '_none'] = true; return true; }
    if (a.state === 'ok') { p[def.id] = String(a.n); return true; }
    return false;
  }

  /* ── 通貨ごとの小数の桁（語彙から。取れなければ undefined）──────────── */
  var _vocab = null;
  function decOf(code) {
    if (!_vocab) {
      _vocab = fetch(SELF ? new URL('pv-vocab.json', SELF).href : 'pv-vocab.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return (j && j.currencies) || []; })
        .catch(function () { return []; });
    }
    return _vocab.then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].code === code && typeof list[i].dec === 'number') return list[i].dec;
      }
      return undefined;
    });
  }

  var CSS = ''
    + '.pv-pb{--pb-ink:#9c3535;--pb-bg:rgba(214,92,92,.08);--pb-line:rgba(214,92,92,.3);'
    +   'container-type:inline-size;min-width:0;max-width:820px;margin:16px 0 0;padding:18px;text-align:left;'
    +   'border:1px solid var(--pv-line);border-radius:var(--pv-r);'
    +   'background:var(--pv-surface-2);color:var(--pv-ink)}'
    /* color-scheme ── 端末が描く部品（チェックの箱）を、テーマの明暗に合わせる。
       書かないと、暗いテーマの中に真っ白な箱が3つ並ぶ。 */
    + '[data-theme="dark"] .pv-pb{--pb-ink:#f0b8b8;--pb-bg:rgba(214,92,92,.1);--pb-line:rgba(214,92,92,.32);'
    +   'color-scheme:dark}'
    + '.pv-pb *{box-sizing:border-box}'
    + '.pv-pb-k{margin:0;font-size:.68rem;font-weight:700;letter-spacing:.04em;line-height:1.5;color:var(--pv-ink-3)}'
    /* 社名・月・総支給。狭い器では1つずつ縦に積む（横に並べて折り返すと、区切りの
       「·」が行の頭に来る）。広い器でだけ1行に並べて「·」で区切る（下の @container）。 */
    + '.pv-pb-w{margin:3px 0 0;display:grid;gap:1px;'
    +   'font-size:.84rem;line-height:1.6;color:var(--pv-ink-2);overflow-wrap:anywhere}'
    + '.pv-pb-w>*{min-width:0}'
    + '.pv-pb-w b{font-weight:800;letter-spacing:-.01em;color:var(--pv-ink)}'
    + '.pv-pb-g{font-variant-numeric:tabular-nums}'
    + '.pv-pb-fs{margin:16px 0 0;padding:16px 0 0;border-top:1px solid var(--pv-line-soft);display:grid;gap:16px}'
    + '.pv-pb-f{min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:8px}'
    + '.pv-pb-l{min-width:0}'
    + '.pv-pb-l label{font-size:.82rem;font-weight:700;line-height:1.5;color:var(--pv-ink)}'
    + '.pv-pb-h{margin:3px 0 0;font-size:.72rem;line-height:1.6;color:var(--pv-ink-3)}'
    + '.pv-pb-h b{font-weight:700;color:var(--pv-ink-2)}'
    /* 入力の側（金額の欄・「該当なし」・読み方を聞く箱）は1つの列にまとめる。
       聞く箱を欄の名前の列と同じ段組みに並べると、補足が2行ある欄では
       箱が入力から離れて下へ落ちる（1001px の絵で実際に離れた）。 */
    + '.pv-pb-r{min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:8px}'
    + '.pv-pb-c{min-width:0;display:flex;flex-wrap:wrap;gap:8px;align-items:center}'
    + '.pv-pb-in{flex:1 1 160px;min-width:0;display:flex;align-items:center;min-height:44px;'
    +   'border:1px solid var(--pv-line);border-radius:var(--pv-r-sm);background:var(--pv-surface)}'
    + '.pv-pb-in:hover{border-color:var(--pv-ink-3)}'
    + '.pv-pb-in:focus-within{border-color:var(--pv-orange);box-shadow:0 0 0 3px var(--pv-orange-soft)}'
    + '.pv-pb-in:active{border-color:var(--pv-orange)}'
    + '.pv-pb-cur{flex:none;padding-left:12px;font-size:.7rem;font-weight:700;letter-spacing:.05em;color:var(--pv-ink-3)}'
    /* ★16px を下回らせない（iOS が焦点を当てた瞬間に拡大する境目）。 */
    + '.pv-pb-in input{flex:1 1 auto;min-width:0;width:100%;height:42px;margin:0;padding:0 12px 0 8px;'
    +   'border:0;outline:0;border-radius:var(--pv-r-sm);background:transparent;'
    +   'font:inherit;font-size:16px;font-weight:600;line-height:1.3;color:var(--pv-ink);'
    +   'font-variant-numeric:tabular-nums}'
    + '.pv-pb-in.is-off{background:var(--pv-line-soft);border-color:var(--pv-line)}'
    + '.pv-pb-in.is-off:hover{border-color:var(--pv-line)}'
    + '.pv-pb-in.is-off input{cursor:not-allowed;color:var(--pv-ink-3)}'
    + '.pv-pb-in.is-ask{border-color:var(--pv-gold-line)}'
    + '.pv-pb-none{flex:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;'
    +   'border:1px solid var(--pv-line);border-radius:var(--pv-r-sm);background:var(--pv-surface);'
    +   'font-size:.78rem;font-weight:600;line-height:1.3;color:var(--pv-ink-2);cursor:pointer;'
    +   'transition:transform .18s var(--pv-ease),opacity .18s var(--pv-ease)}'
    + '.pv-pb-none:hover{border-color:var(--pv-ink-3);color:var(--pv-ink)}'
    + '.pv-pb-none:active{transform:translateY(1px)}'
    + '.pv-pb-none input{flex:none;width:16px;height:16px;margin:0;accent-color:var(--pv-orange);cursor:pointer}'
    + '.pv-pb-none input:focus-visible{outline:2px solid var(--pv-orange-ink);outline-offset:3px}'
    + '.pv-pb-none.is-on{border-color:var(--pv-orange);background:var(--pv-orange-soft);color:var(--pv-orange-ink)}'
    + '.pv-pb-miss{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;vertical-align:1px;'
    +   'font-size:.62rem;font-weight:700;letter-spacing:.04em;line-height:1.5;'
    +   'color:var(--pb-ink);background:var(--pb-bg);border:1px solid var(--pb-line)}'
    + '.pv-pb-f.is-miss .pv-pb-in{border-color:var(--pb-ink);background:var(--pb-bg)}'
    + '.pv-pb-f.is-miss .pv-pb-none{border-color:var(--pb-line)}'
    + '.pv-pb-ask{min-width:0;padding:10px 12px;border-radius:var(--pv-r-sm);'
    +   'background:var(--pv-gold-soft);border:1px solid var(--pv-gold-line)}'
    + '.pv-pb-aq{margin:0;font-size:.8rem;font-weight:700;line-height:1.6;color:var(--pv-gold-ink);overflow-wrap:anywhere}'
    + '.pv-pb-ar{margin:2px 0 0;font-size:.72rem;line-height:1.6;color:var(--pv-ink-3)}'
    + '.pv-pb-aa{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}'
    + '.pv-pb-ab{min-height:44px;padding:0 16px;border:1px solid var(--pv-gold-line);border-radius:var(--pv-r-sm);'
    +   'background:var(--pv-surface);color:var(--pv-ink);cursor:pointer;'
    +   'font:inherit;font-size:.86rem;font-weight:700;font-variant-numeric:tabular-nums;'
    +   'transition:transform .18s var(--pv-ease),opacity .18s var(--pv-ease)}'
    + '.pv-pb-ab:hover{border-color:var(--pv-gold-ink)}'
    + '.pv-pb-ab:focus-visible{outline:2px solid var(--pv-gold-ink);outline-offset:2px}'
    + '.pv-pb-ab:active{transform:translateY(1px)}'
    + '.pv-pb-warn{margin:16px 0 0;padding:11px 14px;border-radius:var(--pv-r-sm);'
    +   'font-size:.8rem;line-height:1.6;overflow-wrap:anywhere;'
    +   'color:var(--pb-ink);background:var(--pb-bg);border:1px solid var(--pb-line)}'
    /* ⚠️ [hidden] を書いて消す（UA の [hidden]{display:none} は作者側の display に負ける）。 */
    + '.pv-pb-warn[hidden]{display:none}'
    + '.pv-pb-go{margin:16px 0 0}'
    + '.pv-pb-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 22px;'
    +   'border:0;border-radius:999px;background:var(--pv-orange);color:#fff;cursor:pointer;'
    +   'font:inherit;font-size:.86rem;font-weight:800;letter-spacing:.01em;line-height:1.3;'
    +   'box-shadow:0 1px 2px rgba(194,65,12,.2),0 10px 20px -12px rgba(249,115,22,.6);'
    +   'transition:transform .18s var(--pv-ease),opacity .18s var(--pv-ease)}'
    + '.pv-pb-btn:hover{transform:translateY(-1px)}'
    + '.pv-pb-btn:focus-visible{outline:2px solid var(--pv-orange-ink);outline-offset:3px}'
    + '.pv-pb-btn:active{transform:translateY(0) scale(.98);opacity:.9}'
    + '.pv-pb-btn:disabled{cursor:default;opacity:.55;transform:none}'
    /* 器が広いときだけ、欄の名前を左・入力を右に並べる（器＝.pv-pb の幅で決める。
       画面の幅では決めない ── 左メニューが出る幅では、画面が広くても器は狭い）。
       ★名前の列を伸ばさない（1fr にしない）。伸ばすと名前と入力が板の両端に離れ、
         どの欄の入力なのかを目で追えなくなる（1440px で実際に約700px 離れた）。 */
    + '@container (min-width:640px){'
    +   '.pv-pb-w{display:flex;flex-wrap:wrap;gap:1px 0;align-items:baseline}'
    +   '.pv-pb-w>*+*::before{content:"\\00b7";margin:0 .6em;color:var(--pv-ink-3)}'
    +   '.pv-pb-f{grid-template-columns:minmax(0,320px) minmax(0,400px);column-gap:24px;'
    +     'justify-content:start;align-items:start}'
    +   '.pv-pb-l{padding-top:12px}}'
    /* 狭い画面ではボタンを器いっぱいに。英語の「Add your breakdown anonymously」は
       390px で1行に入り切らないことがあるので、左右の余白を詰め、折れるときは
       2行を同じ長さに割る（1語だけ下に落ちる形にしない）。 */
    + '@media (max-width:560px){.pv-pb{padding:16px 14px}'
    +   '.pv-pb-btn{width:100%;padding:8px 12px;text-align:center;text-wrap:balance}}'
    + '@media (prefers-reduced-motion:reduce){.pv-pb-btn,.pv-pb-none,.pv-pb-ab{transition:none}}';

  function css() {
    if (d.getElementById('pv-pay-breakdown-css')) return;
    var s = d.createElement('style');
    s.id = 'pv-pay-breakdown-css';
    s.textContent = CSS;
    d.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var e = d.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ── 1つの器に1つ ───────────────────────────────────────────────
     返すもの { ready, refresh, state }
       ready   … 読み終えたときに 'ready'（入力を出した）か 'none'（出さない）で決着する
       refresh … 社名を引き直す（呼んだ画面の辞書があとから届いたとき）
       state   … いまの状態（'pending' / 'ready' / 'none'）
     opts { lang, airName(code), onState(state), onDone() }
       onState … 'ready' か 'none' に変わるたびに呼ぶ。**必ず mount の外で**呼ぶ
                 （同期では呼ばない ── 呼んだ側が描いている途中に割り込まない）。
       onDone  … 書けたときに1回。呼んだ側が画面を開き直す。 */
  function mount(host, client, opts) {
    opts = opts || {};
    var T = TEXT[opts.lang === 'en' ? 'en' : (opts.lang === 'ja' ? 'ja'
              : (/^\/en\//.test(location.pathname) ? 'en' : 'ja'))];
    var LANG = (T === TEXT.en) ? 'en' : 'ja';
    var st = 'pending', target = null, dec, busy = false, sent = false;
    /* LIST ＝ いま出している欄（FIELDS の行＋その欄の部品）。描く・確かめる・送る、は
       全部これを回す。 */
    var LIST = [], nameEl = null, warnEl = null, btn = null;

    function tell(s) {
      st = s;
      try { if (typeof opts.onState === 'function') opts.onState(s); } catch (e) {}
      return s;
    }
    function none() {
      target = null;
      host.textContent = '';
      return tell('none');
    }

    /* ★社名。一覧に在る会社は呼んだ画面の辞書で、無い会社は本人が打った字で。 */
    function airText() {
      var a = target && target.airline, o = String((target && target.airline_other) || '').trim();
      var look = (typeof opts.airName === 'function') ? opts.airName : function (c) { return c; };
      if (a && a !== 'other') return String(look(a) || a);
      return o || String(look('other') || '');
    }
    /* 本人の行の通貨のまま出す（換算しない）。形は給与フォームの fmtCur と同じ
       ── 通貨コード＋けた区切り。小数は、その通貨に在る桁まで。 */
    function own(v) {
      var n = Number(v);
      if (!isFinite(n)) return '';
      var s;
      try {
        s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0,
              maximumFractionDigits: (typeof dec === 'number' ? dec : 2) }).format(n);
      } catch (e) { s = String(n); }
      return (target && target.currency ? target.currency + ' ' : '') + s;
    }

    function warn(text) {
      if (!warnEl) return;
      warnEl.textContent = text || '';
      warnEl.hidden = !text;
    }

    // ── 欄ごとの印（読み方を聞く箱・「未入力」）────────────────────
    function clearAsk(f) {
      f.wrap.classList.remove('is-ask');
      if (f.askEl && f.askEl.parentNode) f.askEl.parentNode.removeChild(f.askEl);
      f.askEl = null;
    }
    function clearMiss(f) {
      f.box.classList.remove('is-miss');
      if (f.missEl && f.missEl.parentNode) f.missEl.parentNode.removeChild(f.missEl);
      f.missEl = null;
    }
    function markMiss(f) {
      if (f.missEl) return;
      f.box.classList.add('is-miss');
      f.missEl = el('span', 'pv-pb-miss', T.miss);
      f.lab.appendChild(f.missEl);
    }
    /* 読めない／二通りに読める額。二通りのときだけ、本人に選んでもらう
       （給与フォームの askMoney と同じ出し方・同じ文）。 */
    function ask(f, r) {
      clearAsk(f);
      var box = el('div', 'pv-pb-ask');
      box.setAttribute('role', 'alert');
      var num = f.def.kind === 'number';
      box.appendChild(el('p', 'pv-pb-aq',
        (r.state === 'bad' ? (num ? T.badNum : T.bad) : T.ask)(f.inp.value)));
      /* 「, は桁区切り」は金額の欄の決まり。数の欄には書かない（あちらは決まりが違う）。 */
      if (!num) box.appendChild(el('p', 'pv-pb-ar', T.rule));
      if (r.state === 'ambiguous') {
        var row = el('div', 'pv-pb-aa');
        r.alts.forEach(function (a) {
          var b = el('button', 'pv-pb-ab', a.canon);
          b.type = 'button';
          b.addEventListener('click', function () {
            f.inp.value = a.canon;
            f.inp.dataset.moneyRaw = a.canon;
            f.inp.dataset.moneyN = String(a.n);
            clearAsk(f);
            try { f.inp.focus({ preventScroll: true }); } catch (e) {}
          });
          row.appendChild(b);
        });
        box.appendChild(row);
      }
      f.right.appendChild(box);
      f.askEl = box;
      f.wrap.classList.add('is-ask');
    }
    /* 欄そのものを読む。本人が読み方を選んだ欄は、その選択を使う
       （控えた字がいまの字と同じあいだだけ。給与フォームの moneyRead と同じ）。
       それ以外は answer() ── 欄の種類ごとの読み方は、あちらの1か所。 */
    function read1(f) {
      var raw = String(f.inp.value == null ? '' : f.inp.value);
      var none = !!(f.none && f.none.checked);
      if (!none && f.inp.dataset.moneyRaw === raw && f.inp.dataset.moneyN != null) {
        var v = parseFloat(f.inp.dataset.moneyN);
        if (isFinite(v)) return { n: v, canon: raw, state: 'ok', alts: [] };
      }
      return answer(f.def, raw, none, dec);
    }
    /* 欄を離れたときに読み方を確定する。読めたら正規の形へ書き直す。 */
    function settle(f) {
      var raw = String(f.inp.value == null ? '' : f.inp.value);
      if (f.inp.dataset.moneyRaw === raw) return;      // 本人が選んだ読み方はそのまま
      delete f.inp.dataset.moneyN;
      delete f.inp.dataset.moneyRaw;
      var r = read1(f);
      clearAsk(f);
      if (r.state === 'ok') { if (f.inp.value !== r.canon) f.inp.value = r.canon; return; }
      if (r.state === 'empty') return;
      ask(f, r);
    }

    /* 欄を1つ組む。★種類ごとの違いはここだけ ── 金額の欄には通貨の札と「該当なし」が
       付き、数の欄には付かない。名前・補足は一覧（def）から。 */
    function field(def) {
      var f = { def: def, askEl: null, missEl: null, none: null, noneLab: null };
      var id = 'pv-pb-' + def.id;
      var amount = def.kind === 'amount-with-none';
      var hint = def.hint ? def.hint[LANG] : '';
      f.box = el('div', 'pv-pb-f');
      f.box.setAttribute('data-id', def.id);
      f.lab = el('div', 'pv-pb-l');
      var lb = el('label', '', def.label[LANG]);
      lb.htmlFor = id;
      f.lab.appendChild(lb);
      if (hint) {
        var h = el('p', 'pv-pb-h');
        h.id = id + '-h';
        h.innerHTML = hint;                    // このファイルの定数だけ。外から来た字は通さない
        f.lab.appendChild(h);
      }
      var c = el('div', 'pv-pb-c');
      f.wrap = el('div', 'pv-pb-in');
      if (amount) f.wrap.appendChild(el('span', 'pv-pb-cur', String((target && target.currency) || '')));
      f.inp = el('input');
      f.inp.type = 'text';
      f.inp.id = id;
      f.inp.setAttribute('inputmode', 'decimal');
      f.inp.setAttribute('autocomplete', 'off');
      if (hint) f.inp.setAttribute('aria-describedby', id + '-h');
      f.wrap.appendChild(f.inp);
      c.appendChild(f.wrap);
      if (amount) {
        f.noneLab = el('label', 'pv-pb-none');
        f.none = el('input');
        f.none.type = 'checkbox';
        f.none.id = id + '-none';
        f.noneLab.appendChild(f.none);
        f.noneLab.appendChild(el('span', '', T.none));
        c.appendChild(f.noneLab);
        /* 「該当なし」＝その項目が無い（0円ではない）。欄は空にして触れなくする。 */
        f.none.addEventListener('change', function () {
          var on = f.none.checked;
          f.inp.disabled = on;
          if (on) { f.inp.value = ''; delete f.inp.dataset.moneyN; delete f.inp.dataset.moneyRaw; clearAsk(f); }
          f.wrap.classList.toggle('is-off', on);
          f.noneLab.classList.toggle('is-on', on);
          clearMiss(f); warn('');
        });
      }
      f.right = el('div', 'pv-pb-r');
      f.right.appendChild(c);
      f.box.appendChild(f.lab);
      f.box.appendChild(f.right);

      f.inp.addEventListener('input', function () {
        if (f.inp.dataset.moneyRaw !== String(f.inp.value)) {
          delete f.inp.dataset.moneyN; delete f.inp.dataset.moneyRaw; clearAsk(f);
        }
        clearMiss(f); warn('');
      });
      f.inp.addEventListener('change', function () { settle(f); });
      return f;
    }

    function draw() {
      css();
      host.textContent = '';
      LIST = []; busy = false; sent = false;
      var box = el('section', 'pv-pb pv-no-cur');
      box.setAttribute('aria-labelledby', 'pv-pb-t');
      var k = el('p', 'pv-pb-k', T.to);
      k.id = 'pv-pb-t';
      box.appendChild(k);
      var wl = el('p', 'pv-pb-w');
      nameEl = el('b', '', airText());
      wl.appendChild(nameEl);
      wl.appendChild(el('span', '', T.month(Number(target.year), Number(target.month))));
      wl.appendChild(el('span', 'pv-pb-g', T.gross + ' ' + own(target.gross)));
      box.appendChild(wl);

      var fs = el('div', 'pv-pb-fs');
      wanted(target).forEach(function (def) {
        var f = field(def);
        LIST.push(f);
        fs.appendChild(f.box);
      });
      box.appendChild(fs);

      warnEl = el('p', 'pv-pb-warn');
      warnEl.setAttribute('role', 'alert');
      warnEl.hidden = true;
      box.appendChild(warnEl);

      var go = el('div', 'pv-pb-go');
      btn = el('button', 'pv-pb-btn', T.cta);
      btn.type = 'button';
      btn.addEventListener('click', send);
      go.appendChild(btn);
      box.appendChild(go);
      host.appendChild(box);
    }

    // ── 読む ─────────────────────────────────────────────────────
    /* ★rpc() が返すのは「then だけを持つ箱」で Promise ではない。then の中から返して
         Promise に包む（こうしておけば、rpc() が同期で投げても下の catch に落ちる）。 */
    function call(p) {
      return Promise.resolve().then(function () { return client.rpc(RPC, { p: p }); });
    }
    function load() {
      return call({}).then(function (res) {
        var v = res && !res.error && res.data;
        var t = v && v.ok !== false && v.target;
        /* 足せる月が無い／答えの形が違う ── どちらも「出さない」。 */
        if (!t || typeof t !== 'object' || !(Number(t.gross) > 0)
            || !(Number(t.year) > 2000) || !(Number(t.month) >= 1 && Number(t.month) <= 12)
            || !(t.airline || t.airline_other)) return none();
        target = t;
        return decOf(t.currency).then(function (n) {
          dec = n;
          draw();
          return tell('ready');
        });
      }).catch(function () { return none(); });
    }

    // ── 書く ─────────────────────────────────────────────────────
    function send() {
      if (busy || sent || !target) return;
      warn('');
      LIST.forEach(clearMiss);                 // 前に付けた印は、押すたびに付け直す
      var p = { airline: target.airline, airline_other: target.airline_other,
                year: target.year, month: target.month };
      var stop = null;
      LIST.forEach(function (f) {
        var a = read1(f);
        if (put(p, f.def, a)) return;
        if (a.state === 'empty') markMiss(f); else ask(f, a);
        if (!stop) stop = f;
      });
      /* ★出している欄が全部答えられるまで送らない。足りない欄・読めない欄へ運ぶ。 */
      if (stop) { try { stop.inp.focus(); } catch (e) {} return; }

      busy = true;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      call(p).then(function (res) {
        if (!res || res.error) throw new Error('rpc');
        var v = res.data || {};
        if (v.ok === true && v.done === true) {
          /* ★ボタンは止めたまま（呼んだ側が画面を開き直すまで、二度送らない）。 */
          sent = true;
          try { if (typeof opts.onDone === 'function') opts.onDone(); } catch (e) {}
          return;
        }
        /* 別の端末で先に足した／そのあいだに新しい月を出した ── 読み直して描き直す。 */
        if (v.code === 'moved') return load();
        busy = false;
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        if (v.code === 'over' && isFinite(Number(v.sum)) && isFinite(Number(v.gross))) {
          warn(T.over.split('{sum}').join(own(v.sum)).split('{gross}').join(own(v.gross)));
        } else if (v.code === 'unanswered') {
          /* サーバはどの欄かを言わない。空の欄が在ればそこ、無ければ出している欄ぜんぶ。 */
          var open = LIST.filter(function (f) { return read1(f).state === 'empty'; });
          (open.length ? open : LIST).forEach(markMiss);
        } else if (v.code === 'limit') {
          warn(T.limit);
        } else {
          warn(T.fail);
        }
      }).catch(function () {
        /* ★サーバの生の文は出さない（読めない金額の 22023・通信の失敗）。 */
        busy = false;
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
        warn(T.fail);
      });
    }

    return {
      ready: load(),
      refresh: function () { if (nameEl && target) nameEl.textContent = airText(); },
      state: function () { return st; }
    };
  }

  /* FIELDS / answer / put は検査のために出してある（画面はここを通らずに mount を呼ぶ）。
     ⚠️ 外から FIELDS を書き換えても、出る欄は変わる ── だが保存されるかどうかを決めるのは
        サーバの口。ここは鍵（解放）に関わる物を1つも持っていない。 */
  w.PVPayBreakdown = { RPC: RPC, FIELDS: FIELDS, answer: answer, put: put, mount: mount };
})(window, document);
