/* shot-actual-pay.mjs — 「他のパイロットの実給与を見る」を目で見るためだけのスクリプト
     （判定は assert-pay-rows.mjs が持つ。こちらは絵を出すだけ）

   この画面はログインしていないと login.html へ飛ぶ。素の localhost URL では
   中身が出ないので、ここで Supabase ごと差し替えて開く。

   実行: node shot-actual-pay.mjs <scene> <lang> [open]
     scene = locked   鍵が無い人（金額が1つも出ない・骨組みと導線だけ）
             locked-nostat ★サーバをまだ貼り替えていない＝数字カードが1枚も出ない
             locked-panel ★左メニューの DEEP PAY を押して説明を出したところ
             locked-ready ★先に内訳を出してくれた人（✓ 準備は完了しています）
             empty    鍵はあるが1件も無い（正直な1枚）
             rows     SQL を貼る前（明細だけの13人・全員が手入力＝✓ は付かない）
             merged   ★SQL を貼った後（口コミ由来の7人が混ざって20人になる）
             many     もっと集まった状態（2ページ目・数字のページ番号が出る）
             picked   会社で絞った状態（絞り込みが効いているところ）
             find     会社を打ち込んで絞ったところ
             nostat   ★サーバがまだ古い（stats を返さない）＝カードが1枚だけ出る
             drawer   ★行を押して開いた面（2026-09-03）。その1人ぶんの帯が出る
             drawer-lock ★自分の内訳をまだ出していない人が同じ面を開いたところ
                         （報酬の内訳が閉じている。帯は**サーバから届いていない**）
     lang  = ja | en
     第3引数以降  open  撮らずに見える窓で開いたままにする
                  dark  暗いほうで撮る
                  w=900 幅を変えて撮る（既定 1440）。★カードと6列の表が畳まれる幅を見る
                        ★720px 未満で面は右からではなく**下から**出る（別物になる）
                  row=7 drawer のとき、どの行を押すか（既定 0）。
                        0=内訳も勤務もある人 / 1=内訳だけ / 2=勤務だけ /
                        7=年収だけ（口コミ由来）── 空の面にならないことを見る
                  gate  drawer のとき、面の主 CTA まで押す（面が閉じて
                        左メニューと同じ DEEP PAY の説明パネルが出るところ）

   ★2026-08-24、この画面から図を全部外した。右の棒も「あなた」の破線も無い。
     だから本人の明細（my_pay_reports）はもう引いていない＝ここでも作らない。

   ★行の中身はこのファイルが作った作り物。本番の数字ではない。
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない（Supabase ごと差し替える）。
*/
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT  = fileURLToPath(new URL('.', import.meta.url));
const BASE  = 'http://localhost:3000';
const scene = process.argv[2] || 'rows';
const lang  = process.argv[3] === 'en' ? 'en' : 'ja';
const show  = process.argv.slice(4).includes('open');
/* ★暗いほうも撮る。カードも表も、暗い側でだけ崩れることがある。 */
const theme = process.argv.slice(4).includes('dark') ? 'dark' : 'light';
/* 幅。★カード3枚は 760px で1列に畳まれ、.mr-side は 960px で横並びになる。
   表は6列あるので、狭いほうから先に「投稿時期」が詰まる。
   「畳まれた側」を見ないと崩れに気づけない。 */
const wArg = process.argv.slice(4).find((a) => /^w=\d+$/.test(a));
const W = wArg ? Number(wArg.slice(2)) : 1440;
/* drawer のとき、どの行を押すか。★1ページ目に載っている行しか押せない（10件で改頁）。 */
const rArg = process.argv.slice(4).find((a) => /^row=\d+$/.test(a));
/* drawer のとき、面の主 CTA まで押す。★飛び先は DEEP PAY ではなく、
   左メニューと同じ「まだ開けていない」の説明パネル（#mr-gate）。 */
const gate = process.argv.slice(4).includes('gate');

const UID = '00000000-0000-4000-8000-00000000c001';

/* 作り物の行。★ana / jal は実在の会社だが、この金額は作った数字。
   サーバは有効数字2桁で返すので、こちらもその形にそろえてある。
   ★1行＝1人。同じ人の複数月はサーバ側で1行に畳まれているので、ここも1人1行。
   ★自由入力の社名の人は airline:'other' で来る（打ち込まれた文字列は来ない）。
   ★2026-09-03、機材・在籍の段・報酬の内訳・勤務が返るようになった（行を押すと出る面の中身）。
     2026-08-24 に「返さない」と書いてあったのはこの日に取り消した。
       fleet … 語彙のコード（pv-vocab.json の fleets）。表の職位セルの2行目に出る
       ten  … 在籍の**段**だけ。fo は 0〜1（1〜5年 / 5年以上）、
              cap は 0〜2（1〜10年 / 10〜20年 / 20年以上）。年そのものは来ない
       pay  … [{ k: 区分, r: [下端, 上端] }] ── **両端の2つだけ**。中間の位置は無い
       work … { bh / dd / off: [下端, 上端] } ── この3つだけ（便数もステイも来ない）
     ⚠️ 帯の刻みは**年収から決まる**（年収 ÷ 40 を 1/2/5 へ切り上げ ＝ pv_band_grid）。
        両端がその倍数でない数をここに書くと、サーバが作れない帯を絵にしてしまう。
        下の checkRows が起動時に全部を検算して、外れていたら止める。
     ⚠️ 口コミ由来の行（FROM_REVIEWS）には**何も足さない**。元データに無いので、
        本番でも機材も内訳も勤務も付かない。押すと「年収だけ」の面が出る。
   ★age ＝ 投稿時期の段。0=1ヶ月以内 / 1=3ヶ月以内 / 2=6ヶ月以内 / 3=1年以内 / 4=それより前。
     サーバが返すのはこの番号だけで、日付も年月も返らない。ここでも番号しか作らない。
   ⚠️ **段 3・4 をここで作らないこと**（2026-08-25 オーナー指摘
      「このサイト始めたの4ヶ月前くらいなんだけど。それより前とかあるはずがない」）。
      いちばん古い会員登録が 2026-05-04＝約4ヶ月前なので、本番にありうるのは 0〜2 だけ。
      3・4 の言葉が画面に出ていたら、それは作り物を見せているということ。
      （サーバ側は5段のまま。来年になれば普通に届く。）
   ★並びは**新しい順（新しいほうが上）**（2026-08-25 オーナー指示）。
      段は同じ時刻から出るので、上から下へ段は 0→2 の向きにしか動かない。
      ここで作る行も必ずその向きに並べる。逆流させると本番に無い絵になる。 */
const R = (air, pos, usd, vf, age, x) => Object.assign({
  airline: air, pos: pos, annual_usd: usd, verified: !!vf, age: age || 0 }, x || {});

/* 面の中身を書くための2つ。★キーの並びがそのまま画面の並びになる。 */
const P  = (o) => Object.keys(o).map((k) => ({ k: k, r: o[k] }));
const WK = (bh, dd, off) => ({ bh: bh, dd: dd, off: off });

/* ★帯の検算（起動時に1回）。サーバ（pv_band_grid）と同じ式をここに写してある。
     grid ＝ 年収 ÷ 40 を {1,2,5}×10ⁿ の直上へ切り上げ
   両端がその倍数でなければ、本番のサーバには作れない帯＝作り物を絵にしている。
   ⚠️ この関数を db/pay-rows.sql と食い違わせない（向こうが正）。 */
const gridOf = (annual) => {
  const raw = annual / 40;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  return raw <= p ? p : raw <= p * 2 ? p * 2 : raw <= p * 5 ? p * 5 : p * 10;
};
const W_GRID = { bh: 10, dd: 2, off: 2 };
const FLEETS = new Set((JSON.parse(
  readFileSync(path.join(ROOT, 'pv-vocab.json'), 'utf8')).fleets || []).map((f) => f.code));
const TEN_MAX = { fo: 1, cap: 2 };
function checkRows(list, tag) {
  const bad = [];
  list.forEach((r, i) => {
    const at = tag + '[' + i + '] ' + r.airline + ' ' + r.pos;
    if (r.fleet && !FLEETS.has(r.fleet)) bad.push(at + ' 機材 ' + r.fleet + ' は語彙に無い');
    if (typeof r.ten === 'number' && r.ten > (TEN_MAX[r.pos] === undefined ? -1 : TEN_MAX[r.pos]))
      bad.push(at + ' 在籍の段 ' + r.ten + ' は ' + r.pos + ' に無い');
    const g = gridOf(r.annual_usd);
    (r.pay || []).forEach((p) => {
      if (p.r[0] % g || p.r[1] % g) bad.push(at + ' ' + p.k + ' が刻み ' + g + ' の倍数でない');
      if (p.r[0] === p.r[1]) bad.push(at + ' ' + p.k + ' の両端が同じ数');
      if (p.r[0] === 0 && p.r[1] !== g * 2) bad.push(at + ' ' + p.k + ' の畳み方が違う');
    });
    if (r.work) Object.keys(W_GRID).forEach((k) => {
      const v = r.work[k]; if (!v) return;
      if (v[0] % W_GRID[k] || v[1] % W_GRID[k]) bad.push(at + ' ' + k + ' が刻みの倍数でない');
    });
  });
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
}

/* 数え上げ。★サーバ（pv_pay_rows）の stats と同じ形。
   reports ＝ 提出の件数（同じ人の複数月もそれぞれ1件）、month ＝ 直近1ヶ月に入った件数。
   ⚠️ 必ず reports ≧ 行数。ここを行数より小さくすると、
      「126件なのに表は60行」の逆＝説明のつかない絵になる。
   ⚠️ **month ≧ 段0（「1ヶ月以内」）の行数**（2026-08-25）。カードの窓と表のいちばん右の
      段0は同じ境目（now() - interval '1 month'）なので、month を段0の行数より小さくすると
      「1ヶ月以内 4件」と書いてある下に「1ヶ月以内」の行が10本並ぶ絵になる。
      本番ではありえない形なので、見本でも作らない。 */
const ST = (reports, month) => ({ reports: reports, month: month });

/* ★鍵が無い人にも来る数え上げ（2026-08-25 オーナー判断）。
   行が1件も返らないので、社数もサーバーが数えて渡す。
   contributors ＝ 給与を出したユニークな人数（DEEP PAY の「N / 100人」の分子）。
   ⚠️ ここは絵を見るための**見本**であって、本番の値そのものではない。
      2026-08-26 に `node db/usage.mjs --all` の「REAL PAY の画面に出る数」を写した
      （オーナーが動作確認ぶんを本番から消したあとの実測）。
      **腐る。** 数字の当たりを見たいときは、写す前にもう一度その節を走らせる。
      分子を大きく作ると、本番に無い絵を見ることになる。 */
const ST_LOCK = { reports: 27, month: 22, airlines: 12, contributors: 17 };

/* ★いまの本番をそのまま写した13行（2026-08-23 に読んで確認した実測）。
   内訳は 本棚8人 ＋ 登録前の預かり5人。会社は7社。
   ・全員が手入力（verify_level 0）なので ✓ Verified は1行も付かない。そこを絵で確かめる。
   ・オーナーの動作確認4行は消してもらう前提なので入れていない。
   ・預かりのうち1件（月額の欄に年額 ¥1,200万）は「常識の幅」で落ちるので入れていない。
   ・10件で1ページなので、この13行で2ページ目が出る。
   ⚠️ 実測なのは金額と会社と職位まで。**時期の段はこちらで振った作り物**
      （本番の投稿日は読んでいない）。給与レポートも預かりも 2026-08 に入ってからの
      ものばかりなので 0（1ヶ月以内）に寄せ、少しだけ 1 を混ぜてある。
   ★並びは新しい順なので、段の小さいほう（新しいほう）から先に置く。
   ★13人の内訳は 本棚（pay_reports）8人 ＋ 登録前の預かり（pending）5人。
      サーバは出どころで分けずに時刻だけで並べるので、ここでも混ぜて置く
      （出どころごとに固めると、本番に無い並びの絵になる）。 */
const ROWS = [
  R('ana', 'fo', 110000, false, 0,                  // 預かり
    { fleet: 'a320', ten: 0,
      pay: P({ fixed: [70000, 75000], variable: [25000, 30000],
               perdiem: [5000, 10000], bonus: [0, 10000] }),
      work: WK([60, 70], [14, 16], [12, 14]) }),
  R('singapore-airlines', 'cap', 330000, false, 0,  // 預かり ── 内訳だけ（勤務は書いていない）
    { fleet: 'a380', ten: 2,
      pay: P({ fixed: [190000, 200000], variable: [70000, 80000],
               perdiem: [20000, 30000], bonus: [0, 20000] }) }),
  R('ana', 'fo',  94000, false, 0,                  // 預かり ── 勤務だけ
    { fleet: 'b787', ten: 0, work: WK([70, 80], [16, 18], [10, 12]) }),
  R('air-canada', 'cap', 240000, false, 0,          // 預かり
    { fleet: 'b777', ten: 1,
      pay: P({ fixed: [140000, 150000], variable: [50000, 60000],
               perdiem: [10000, 20000], bonus: [0, 20000] }),
      work: WK([60, 70], [12, 14], [14, 16]) }),
  /* ★預かり ── 総支給しか書かなかった人。機材と在籍は出るが、面には内訳も勤務も出ない。 */
  R('zipair', 'fo', 82000, false, 0, { fleet: 'b787', ten: 0 }),
  R('eva-air', 'cap', 170000, false, 0,
    { fleet: 'a330', ten: 1,
      pay: P({ fixed: [95000, 100000], variable: [35000, 40000],
               housing: [10000, 15000], bonus: [0, 10000] }),
      work: WK([50, 60], [12, 14], [14, 16]) }),
  R('ana', 'cap', 180000, false, 0,
    { fleet: 'b787', ten: 1,
      pay: P({ fixed: [100000, 105000], variable: [35000, 40000],
               command: [15000, 20000], bonus: [0, 10000] }),
      work: WK([60, 70], [14, 16], [12, 14]) }),
  R('lufthansa', 'fo', 140000, false, 0,
    { fleet: 'a320', ten: 1,
      pay: P({ fixed: [85000, 90000], variable: [30000, 35000],
               other: [10000, 15000], bonus: [0, 10000] }) }),
  R('ana', 'fo', 110000, false, 0,
    { fleet: 'b737', ten: 0,
      pay: P({ fixed: [70000, 75000], variable: [25000, 30000],
               perdiem: [5000, 10000], bonus: [0, 10000] }),
      work: WK([60, 70], [14, 16], [12, 14]) }),
  R('jal', 'fo',  81000, false, 0,
    { fleet: 'e-jet', ten: 0, work: WK([40, 50], [12, 14], [14, 16]) }),
  R('ana', 'fo',  95000, false, 1,
    { fleet: 'a320', ten: 0,
      pay: P({ fixed: [60000, 65000], variable: [20000, 25000],
               perdiem: [5000, 10000], bonus: [0, 10000] }),
      work: WK([50, 60], [12, 14], [14, 16]) }),
  R('jal', 'fo',  99000, false, 1,
    { fleet: 'b767', ten: 0,
      pay: P({ fixed: [65000, 70000], variable: [20000, 25000],
               other: [5000, 10000], bonus: [0, 10000] }) }),
  R('ana', 'fo', 110000, false, 1,
    { fleet: 'b787', ten: 1,
      pay: P({ fixed: [70000, 75000], variable: [25000, 30000],
               housing: [10000, 15000], bonus: [0, 10000] }),
      work: WK([60, 70], [14, 16], [12, 14]) }),
];

/* ★口コミに書かれていた給与（2026-08-24 に合流させたぶん）。
   本番は8件あるが、うち1人は同じ会社・同じ職位で明細も出していたのでサーバ側で落ちる＝7行。
   内訳は ana 3 / jal 2 / emirates 1 / other 1。
   ・口コミフォームはもう金額を集めていないので、**この7行が打ち止め**。将来増えない
   ・給与レポートより前の時期のものなので、段は 1〜2 に寄る。
     ⚠️ 3・4 にしないこと。サイトはまだ約4ヶ月しか経っていない（上の ⚠️）
   ・出典は明細と同じ「本人申告」（札を3種類に増やさない＝オーナー決定）
   ・1行は airline:'other'＝打ち込まれた社名が語彙に当たらなかった人。
     画面は「一覧にない航空会社」と書く（2026-08-25 オーナー指示。前は「その他の航空会社」）
   ⚠️ 金額は作り物。実際の8件の額はここに写していない。 */
const FROM_REVIEWS = [
  R('ana', 'fo',  100000, false, 1),
  R('jal', 'fo',   96000, false, 1),
  R('ana', 'cap', 170000, false, 1),
  R('emirates', 'cap', 230000, false, 2),
  R('other', 'fo',  88000, false, 2),
  R('jal', 'cap', 180000, false, 2),
  R('ana', 'cap', 160000, false, 2),
];

/* 合流した後の20行。★並びは**新しい順（新しいほうが上）**。
   口コミ由来は給与レポートより古いので、自然と後ろのほうに来る。
   ここを混ぜ返さないこと＝本番と違う絵になる。 */
const MERGED = [...ROWS, ...FROM_REVIEWS];
/* もっと集まったら、という絵。★並びは新しい順（新しいほうが上）なので、
   段は上から 0 → 1 → 2 の向きにしか動かない。
   会社と金額はばらけさせる（会社ごとに固めると絞り込みの絵が読めない）。
   ★段は 0〜2 だけ。サイトはまだ約4ヶ月なので 3・4 は本番にありえない（上の ⚠️）。
   ★ここは表と頁送りを見るための場面なので、機材と在籍の段までしか持たせていない
     （面は開かない ＝ 内訳と勤務は絵に出ない）。面を見たいときは drawer を使う。 */
const MANY = [
  R('cathay-pacific', 'fo', 125000, false, 0, { fleet: 'a350', ten: 0 }),
  R('korean-air', 'cap', 175000, false, 0, { fleet: 'b777', ten: 1 }),
  R('ana', 'fo', 98000, false, 0, { fleet: 'b737', ten: 0 }),
  R('emirates', 'fo', 150000, false, 0, { fleet: 'b777', ten: 1 }),
  R('qatar-airways', 'cap', 260000, true, 0, { fleet: 'a350', ten: 1 }),
  R('jal', 'fo', 105000, false, 0, { fleet: 'b767', ten: 0 }),
  R('ana', 'cap', 180000, true, 0, { fleet: 'b787', ten: 1 }),
  R('eva-air', 'fo', 105000, false, 1, { fleet: 'a330', ten: 0 }),
  R('other', 'fo', 90000, false, 1, { fleet: 'a320', ten: 0 }),
  R('zipair', 'fo', 86000, false, 1, { fleet: 'b787', ten: 0 }),
  R('jal', 'fo', 112000, false, 1, { fleet: 'a350', ten: 1 }),
  R('lufthansa', 'fo', 110000, false, 1, { fleet: 'a320', ten: 1 }),
  R('ana', 'cap', 195000, false, 1, { fleet: 'b777', ten: 2 }),
  R('cathay-pacific', 'cap', 200000, false, 1, { fleet: 'a350', ten: 1 }),
  R('emirates', 'cap', 240000, false, 1, { fleet: 'a380', ten: 2 }),
  R('jal', 'cap', 185000, true, 2, { fleet: 'b787', ten: 1 }),
  R('other', 'cap', 130000, false, 2, { fleet: 'b737', ten: 0 }),
  R('korean-air', 'fo', 95000, false, 2, { fleet: 'a320', ten: 0 }),
  R('jal', 'cap', 190000, false, 2, { fleet: 'b777', ten: 2 }),
  R('ana', 'fo', 120000, false, 2, { fleet: 'b787', ten: 1 }),
  R('lufthansa', 'cap', 160000, false, 2, { fleet: 'a350', ten: 0 }),
  R('singapore-airlines', 'fo', 130000, false, 2, { fleet: 'b787', ten: 1 }),
];

/* ★行を押して出る面のための9行（2026-09-03）。
     ⚠️ 9行にしてあるのは、**1ページに全部載せるため**（10件で改頁するので、
        2ページ目の行は押せない ＝ 撮れない）。
     並びは新しい順。上の7行が給与フォーム由来（段0）、下の2行が口コミ由来（段1）。
     row= で選ぶ行の見え方：
       0 内訳も勤務もある（同じ会社・同じ職位の他の記録も2件出る）
       1 内訳だけ（勤務の節が丸ごと出ない）
       2 勤務だけ（内訳の節が丸ごと出ない）
       4 機材と在籍はあるが年収だけ
       7 口コミ由来 ── 機材も在籍も無い。**空の面にならないことを見る**  */
const DRAWER = [...ROWS.slice(0, 7), ...FROM_REVIEWS.slice(0, 2)];

/* ★報酬の内訳の門（2026-09-03）。自分の内訳を出した人どうしで見られる。
     サーバは閉じている行の**金額を1円も返さない** ── `pay` の鍵ごと消えて、
     代わりに `paylock` が来る。中身は**区分の名前だけ**で、
     区分が1つしか無い行は名前も渡さず真偽1つに落ちる
     （1つ＝その区分が内訳のほぼ全部。面に出ている年収から金額が読めてしまう）。
   ⚠️ 絵にするときも**ここで消してから**渡す。帯を残したまま上から霞ませない
      （それをやると、開発者ツールで1秒で剥がれるものを絵で承認することになる）。
   ★3行目（勤務だけの人）は pay を持たないので、門も出ない
     ＝「この投稿には給与内訳が含まれていません」のまま。row=2 で見られる。 */
const DRAWER_LOCK = DRAWER.map(function (r) {
  const c = Object.assign({}, r);
  if (c.pay) {
    const keys = c.pay.map(function (p) { return p.k; });
    delete c.pay;
    c.paylock = keys.length > 1 ? keys : true;
  }
  return c;
});

/* 起動する前に帯を検算する（作れない帯を絵にしない）。 */
[[ROWS, 'ROWS'], [FROM_REVIEWS, 'FROM_REVIEWS'], [MANY, 'MANY'], [DRAWER, 'DRAWER']]
  .forEach(([l, t]) => checkRows(l, t));

const SCENES = {
  /* ★鍵が無い人の画面（2026-08-25 に作り直した）。
     数え上げは見せる。行は1件も返らないので、一覧は中身の無い骨組みで出る。
     ⚠️ 骨組みは**ぼかしではない**。隠しているのではなく、渡されていない。 */
  locked: { pay: { ok: true, state: 'locked', rows: [], stats: ST_LOCK,
                   give: { basic: false, detailed: false, payslip: false } } },
  /* ★サーバ（db/pay-rows.sql）をまだ貼り替えていないとき。
     数が1つも読めないので、カードは1枚も出ない＝埋めるための 0 を置かない。 */
  'locked-nostat': { pay: { ok: true, state: 'locked', rows: [] } },
  /* ★左メニューのロックを押したときの説明（2026-08-25）。
     覆いではないので、下のページが残ったまま上に1枚差し込まれる。
     DEEP PAY は条件が2つ（100人 ／ 本人の内訳）。まだ内訳を出していない人の絵。 */
  'locked-panel': { pay: { ok: true, state: 'locked', rows: [], stats: ST_LOCK,
                           give: { basic: false, detailed: false, payslip: false } },
                    gate: 'deep' },
  /* ★先に内訳を出してくれた人。「出し損」に見えないことを絵で確かめる。 */
  'locked-ready': { pay: { ok: true, state: 'locked', rows: [], stats: ST_LOCK,
                           give: { basic: true, detailed: true, payslip: false } },
                    gate: 'deep' },
  empty:  { pay: { ok: true, state: 'open', rows: [], stats: ST(0, 0) } },
  rows:   { pay: { ok: true, state: 'open', rows: ROWS,   stats: ST(17, 13) } },
  /* ★口コミ由来の7人が混ざった状態。行が13→20に増える。
     口コミのほうが古いので、下のほうに「6ヶ月以内」が並ぶ。 */
  merged: { pay: { ok: true, state: 'open', rows: MERGED, stats: ST(24, 13) } },
  many:   { pay: { ok: true, state: 'open', rows: MANY, stats: ST(58, 11) } },
  picked: { pay: { ok: true, state: 'open', rows: MANY, stats: ST(58, 11) }, pick: 'ana' },
  find:   { pay: { ok: true, state: 'open', rows: MANY, stats: ST(58, 11) }, q: 'jal' },
  /* ★サーバをまだ貼り替えていないとき。数えられるのは会社数だけなので
     カードは1枚になる。空いた分に 0 を置かない＝画面に嘘の数字を作らない、を絵で確かめる。 */
  nostat: { pay: { ok: true, state: 'open', rows: ROWS } },
  /* ★行を押して開いた面。どの行を押すかは row=N（既定 0）。 */
  drawer: { pay: { ok: true, state: 'open', rows: DRAWER, stats: ST(14, 9) }, open: 0 },
  /* ★まだ自分の内訳を出していない人が同じ行を押したところ。
       帯の代わりに骨組みと門が出る。row=2 は「内訳がそもそも無い人」で、門は出ない。 */
  'drawer-lock': { pay: { ok: true, state: 'open', rows: DRAWER_LOCK, stats: ST(14, 9),
                          give: { basic: true, detailed: false, full: false,
                                  payslip: false } },
                   open: 0 },
};
const S = SCENES[scene];
if (!S) { console.error('scene は ' + Object.keys(SCENES).join(' / ')); process.exit(1); }

/* assert-pay-rows.mjs と同じ差し替え。
   ⚠️ rpc は本物と同じ「then だけを持つ箱」＝ async にしない。 */
function stub(page, pay) {
  return page.evaluateOnNewDocument((uid, pay, theme) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('pv-theme', theme);
    /* ★my_pay_reports は置かない。この画面はもう本人の明細を引かないので、
       置くと「引いても気づかない」状態を自分で作ることになる。 */
    const RPC = {
      pv_pay_rows: pay,
      my_referral_code: { ok: true, code: 'K7QD3XZM', invited: 0, converted: 0 },
    };
    function q(rows) {
      const o = { data: rows, error: null,
        select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
        single: async () => ({ data: rows[0] || null, error: null }),
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then: (res) => res({ data: rows, error: null }) };
      return o;
    }
    const FAKE = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: uid, email: 'pilot@example.com' } } } }),
        getUser:    async () => ({ data: { user: { id: uid, email: 'pilot@example.com' } } }),
        signOut:    async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      rpc: (name) => {
        const res = { data: RPC[name] || { ok: true }, error: null };
        return { then: (y, n) => Promise.resolve(res).then(y, n) };
      },
      from: () => q([]),
    };
    Object.defineProperty(window, 'supabase',
      { value: { createClient: () => FAKE }, writable: false, configurable: false });
  }, UID, pay, theme);
}

const browser = await puppeteer.launch(show
  ? { headless: false, defaultViewport: null, args: ['--window-size=' + W + ',1100'] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
if (!show) await page.setViewport({ width: W, height: 1100 });
await stub(page, S.pay);
await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'actual-pay.html',
                { waitUntil: 'networkidle2', timeout: 40000 });
await new Promise((r) => setTimeout(r, 2200));

if (S.pick) {
  await page.evaluate((v) => {
    const s = document.getElementById('ap-air');
    if (!s) return;
    s.value = v;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  }, S.pick);
  await new Promise((r) => setTimeout(r, 500));
}

if (S.q) {
  await page.evaluate((v) => {
    const i = document.getElementById('ap-q');
    if (!i) return;
    i.value = v;
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }, S.q);
  await new Promise((r) => setTimeout(r, 500));
}

if (S.gate) {
  await page.evaluate((k) => {
    const b = document.querySelector('[data-mr-gate="' + k + '"]');
    if (b) b.click();
  }, S.gate);
  await new Promise((r) => setTimeout(r, 500));
}

/* ★行を押して面を開く（2026-09-03）。
     押すのは行の末尾の ›。行のどこを押しても同じところへ行くが、
     ここは**キーボードで辿れる入口**を押しておく（無ければ気づける）。 */
if (S.open !== undefined) {
  const i = rArg ? Number(rArg.slice(4)) : S.open;
  const hit = await page.evaluate((n) => {
    const tr = document.querySelector('#ap-rows tbody tr[data-ap-row="' + n + '"]');
    if (!tr) return 'no-row';
    const b = tr.querySelector('.ap-go');
    if (!b) return 'no-go';
    b.click();
    return 'ok';
  }, i);
  if (hit !== 'ok') {
    console.error('row=' + i + ' を押せなかった（' + hit
      + '）。1ページ目に無い行は押せない（10件で改頁）。');
    process.exit(1);
  }
  /* 面が滑り込むのを待つ（.32s）。★時間ではなく、出たことで待つ。 */
  await page.waitForFunction(
    () => { const d = document.querySelector('.ap-dw-back'); return !!(d && d.classList.contains('is-in')); },
    { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 500));

  /* gate ── 面の主 CTA を押す（2026-09-03）。面が閉じて、左メニューと同じ
     DEEP PAY の説明パネルが本文の頭に出るところまで。
     ★DEEP PAY へは飛ばない（あちらへの辺は2本だけと決めてある）。
     ★待つのは時間ではなく **#mr-gate が出たこと**。 */
  if (gate) {
    await page.evaluate(() => {
      const b = document.querySelector('.ap-dw-cta');
      if (b) b.click();
    });
    await page.waitForFunction(() => !!document.querySelector('#mr-gate'), { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));
  }
}

if (show) {
  console.log(`見える窓で開いた（${scene} / ${lang}）。閉じるとこのコマンドも終わる。`);
  await new Promise(() => {});
}

const dir = path.join(ROOT, 'temporary screenshots');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const n = readdirSync(dir).filter((f) => /^screenshot-\d+/.test(f))
  .reduce((m, f) => Math.max(m, Number(f.match(/^screenshot-(\d+)/)[1])), 0) + 1;
const out = path.join(dir,
  `screenshot-${n}-actualpay-${scene}${rArg ? '-' + rArg.replace('=', '') : ''}`
  + `-${lang}${W === 1440 ? '' : '-w' + W}${theme === 'dark' ? '-dark' : ''}.png`);

/* ページ全体を撮る（絞り込みの帯と表の関係が見たいので、要素で切り出さない）。
   ★面が開いているときは伸ばさない ── 面は画面の高さいっぱいに立つので、
     縦に伸ばすと**誰も見ることのない縦長の面**を撮ることになる。
     代わりに、面の中身が窓より長ければその分だけ伸ばす。 */
if (S.open !== undefined) {
  const h = await page.evaluate(() => {
    const b = document.querySelector('.ap-dw-b');
    return b ? Math.ceil(b.getBoundingClientRect().height) + 40 : 0;
  });
  await page.setViewport({ width: W, height: Math.min(Math.max(1100, h), 2000) });
} else {
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewport({ width: W, height: Math.min(full, 3200) });
}
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: out });
console.log(out.replace(ROOT, ''));
await browser.close();
