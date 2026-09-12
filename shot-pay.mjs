/* pay-report.html の検品用スクショ。
   フォームは未ログインでも最初から見える（ログインは送信のときだけ）。
   ただし S2〜S4 は埋めるまで出ないので、1枚目は「S1 だけ」が正しい状態。
   結果パネルは renderResult() を直接呼ぶ＝RPC が本番に無くても見た目は確認できる。
   使い方: node shot-pay.mjs        （出力は ./temporary screenshots/ ではなく round ディレクトリ）
           node shot-pay.mjs open detail   撮らずに、見える窓で #pay-detail を開く

   撮る状態（2026-08-13 に 3〜5 を追加、同日その2で 0 を追加。
             2026-09-08、5ステップのウィザードに合わせて組み直した）:
     0  entry       開いた直後＝入口の2択（明細から自動入力／手で入力）だけ
     0b payslip     明細を選んだ状態＝「明細を読み込む（任意）」（読まずに手で入力する逃げ道つき）
     1  empty       手入力に入った直後＝1/5「会社と職務」が空のまま
     1b s2-empty    2/5「対象月と乗務」が空のまま
     1c s3-empty    3/5「報酬」が空のまま ★下端に年換算の帯が出る唯一の段
     1d s4-empty    4/5「契約と税」が空のまま
     2 simple       かんたん入力（通貨＋その月の額面）まで全部埋めた 3/5
     3a detail-plus 「＋給与の内訳を追加」を開いた直後
                    ★出ているのは基本給だけで、保証給・変動給・職位手当・その他の現金は
                      「＋」で足す（オーナー指示の Progressive Disclosure）
     3 detail-open  内訳を開いて埋めた状態
                    ★2026-08-26 から、額面の欄は**本人の入力のまま**（読み取り専用にしない）。
                      変動給・その他の現金手当は行で足す
     3b detail-over 内訳の合計が額面を超えた状態＝注意の1行が出る（送信は止めない）
     3c instructor  教官・訓練の手当を埋めた状態（1/5で教官を選んだ人にだけ出る節）
                    ★変動給・その他・額面のどれも増えていないことをログで見る
     3d instructor-off 教官を外した状態＝節ごと消えて中身も消える
     3e examiner    審査・査察の手当を埋めた状態（1/5で審査を選んだ人にだけ出る節）
                    ★教官の額まで含めて、どの合計も増えていないことをログで見る
     3f examiner-off 審査を外した状態＝節ごと消えて中身も消える
     3g union      組合・乗員代表の手当を埋めた状態（1/5で組合を選んだ人にだけ出る節）
                   ★支給元を「組合」にしてあるので、額面との突き合わせ（#pd-over）が
                     動かないこともログで見る（会社の明細に無いお金なので）
     3h union-off  組合を外した状態＝節ごと消えて中身も消える（教官・審査は残る）
     3i mgmt       管理・マネジメントの手当を埋めた状態（1/5で管理職を選んだ人にだけ出る節）
                   ★組合とは逆に、この額は会社が払う＝額面の中にある。だから
                     内訳の合計（#pd-over の材料）には**足される**ことをログで見る
     3j mgmt-off   管理職を外した状態＝節ごと消えて中身も消える（教官・審査・組合は残る）
     3k nonline    その他の兼務・配属の手当を埋めた状態（1/5で兼務・配属を選んだ人にだけ出る節）
                   ★聞くのは3つだけ（分野・日数・追加報酬）。部署名も出向先も聞かない
     3l nonline-off 兼務・配属を外した状態＝節ごと消えて中身も消える（ほかの4つは残る）
     3m over-slot  ★超過の注意が「打った欄のすぐ下」に出る（2026-08-27 オーナー指摘
                   「なんか変なところに出るよこれ」）。管理職の額で超えさせて、
                   pd-over-mgmt だけが出て既定の pd-over が出ないことをログで見る
     3n miss-jump  ★必須が3つ空いたまま 5/5 の送信を押した状態。足りない欄すべてが
                   赤く囲われて右横に「未入力」の札が付き、先頭の欄のある段（3/5）まで
                   本人が運ばれる（確認の段に居座らせない）。
                   ★2026-09-08、常設バーの「匿名で提出」は廃止した ── 帯に残るのは
                     年換算の合計の表示だけで、押す口は 5/5 の送信ただ1つ
     4 detail-shut  内訳を閉じた状態 ★額面も内訳も消えずに残っている
     4b review      ★5/5 の確認（Phase 5）。上＝本人が入れた実額の読み返し（節ごとに
                    「変更する」でその段へ戻る）／下＝匿名で公開される見込みの形
                    （REAL PAY の1行と同じ粗さ。入れた実額をそのまま公開の姿にしない）
     5a second-entry 2回目の訪問の入口
     5 second       2回目 1/5 ★前回の会社・職位が入ったまま出る
     5b second-hours 2回目 2/5 ★飛んだ時間とステイ日数は持ち越さない（毎月変わる）
     6 result       送信後の結果パネル
     7a detail-link DEEP PAY の「給与内訳を追加する」で来たときの着地
     7b detail-open 1/5・2/5 を埋めて 3/5 に着いたところ（内訳が開いた状態で現れる） */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* 自分の位置から解く。絶対パスを書くと macOS のユーザー名が公開リポジトリに載る */
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const ROUND = process.argv[2] || 'r1';
const dir = path.join(ROOT, 'temporary screenshots', `pay-${ROUND}`);
fs.mkdirSync(dir, { recursive: true });

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

/* 入力のサンプル（湾岸＝最初の主戦場を想定）。ラベル溢れを見たいので長めの値を使う。
   ★f-nationality（国籍）と f-paytype（払われ方）は 2026-08-12 に欄ごと廃止。
   ★f-hourly は hidden（明細からしか入らない）。ここで入れると内訳の合計が
     時給×時間で膨らんで、映した額面が現実的でない額になるので入れない。 */
const SIMPLE = {   // 誰にでも聞く欄（2026-08-13 に手取り・今月のボーナス・ステイ日数が増えた）
  /* ★役職・区分は 2026-08-26 から複数選べる。カンマ区切りで hidden に入れると
       put() が絵のチェックまで戻す（本物のページと同じ syncRoleBoxes を呼ぶ）。 */
  'f-airline': 'emirates', 'f-position': 'cap', 'f-fleet': 'b777', 'f-jobrole': 'line,instructor,examiner,union,management,nonline',
  'f-age': '40-49',
  'f-block': '86.5', 'f-stay': '12', 'f-duty-h': '158.2',
  'f-currency': 'AED', 'f-gross': '77800', 'f-netpay': '71600', 'f-bonus-mo': '0',
  'f-perdiem': '6200', 'f-housing': 'allowance', 'f-housing-amt': '17500',
  'f-bonus': '52000',
  'f-contract': 'direct', 'f-seniority': '12', 'f-taxcountry': 'AE', 'f-tax': '0',
  'f-duty': '17', 'f-base-iata': 'DXB',
};
/* ★「前回の内容」＝翌月のフォームに引き継がれるもの（2026-09-12・open second 専用）。
   ★ここに**その月の実績を1つも置かない**のが要点 ── 総支給・手取り・乗務時間・日当・
     当月賞与・変動給の金額・役割の月次手当は、翌月のひな型には保存しない側。
     置くと「先月の実績が今月の欄に残る」という、この作り直しが直した形そのものになる。
   ★変動給は**項目名と支給単位だけ**（金額は持たない）。
   ⚠️ 金額は架空。実在の人の明細ではない。 */
const LAST_MONTH = {
  'f-airline': 'emirates', 'f-position': 'cap', 'f-fleet': 'b777', 'f-currency': 'AED',
  'f-age': '40-49', 'f-jobrole': 'line,instructor,union', 'f-housing': 'allowance',
  'f-contract': 'direct', 'f-seniority': '12', 'f-taxcountry': 'AE', 'f-tax': '0',
  'f-base': '36000', 'f-guarantee': '0', 'f-command': '3200', 'f-housing-amt': '17500',
  'f-payitems': JSON.stringify({
    v: 1,
    variable: [{ label: 'Flight Pay', basis: 'block' },
               { label: 'Layover Allowance', basis: 'day' }],
  }),
};

/* <details id="pay-detail"> の中（パーディアムと住居はもう外）。
   ★2026-08-26、交通とその他の専用欄は無くなった（hidden ＝明細読み取り専用）。
     人が打つのは下の VAR / OTH の行。 */
const DETAIL = {
  'f-base': '36000', 'f-guarantee': '2500', 'f-guar': '80', 'f-command': '3200',
  'f-profit': '18000', 'f-pension': '12',
};
/* 変動給・その他の現金手当。会社ごとに名前も本数も違うので行で足す。
   ★合計が総支給（f-gross）を超えないようにしておく。超えると注意の1行が出て、
     それはそれで正しい絵だが「普通の状態」の見本ではなくなる。 */
/* ★2026-08-26、支給単価・ルールの欄は消えた（オーナー指示「単価計算をユーザーにさせない」）。
   ここに rule を書き戻すと、消したはずの欄がある前提の絵になる。 */
const VAR = [
  { amount: '9800', basis: 'block', label: 'Flight Pay' },
  { amount: '1200', basis: 'reserve', label: 'Standby Allowance' },
];
const OTH = [{ amount: '900', label: 'Transport Allowance' }];

/* 教官・訓練の手当（2026-08-26 その3）。§1で「教官・訓練担当」を選んだ人にだけ出る節。
   ★ここに入れた額は変動給・その他の現金手当・職位手当のどれにも足し込まれない。
     絵で確かめたいのはそこ（下のログが3つの数を並べる）。 */
const INSTR = {
  train: ['line', 'sim'],
  'f-instr-label': 'Training Captain (TRI)',
  'f-instr-extra': 'separate',
  'f-instr-method': 'session',
  'f-instructor': '4200', 'f-instr-qty': '3',
};

/* 審査・査察の手当（2026-08-26 その4）。§1で「審査・査察」を選んだ人にだけ出る節。
   ★教官の額にも変動給・その他・職位手当にも足し込まれない。絵で見たいのはそこ。 */
const EXAM = {
  checks: ['sim', 'line'],
  'f-exam-label': 'TRE',
  'f-exam-extra': 'separate',
  'f-exam-method': 'check',
  'f-examiner': '3600', 'f-exam-qty': '2',
};

/* 組合・乗員代表の手当（2026-08-26 その5）。§1で「組合・乗員代表」を選んだ人にだけ出る節。
   ★支給元をわざと「組合（union）」にしてある。会社の明細に載らないお金なので、
     額面との突き合わせ（#pd-over）に足してはいけない ── 絵とログで見たいのはそこ。 */
const UNION = {
  'f-union-days': '12',
  'f-union-extra': 'yes',
  'f-union-pay': '3000',
  'f-union-src': 'union',
};

/* 管理・マネジメントの手当（2026-08-26 その6）。§1で「管理・マネジメント」を選んだ人にだけ出る節。
   ★組合とは逆に、この額は会社が払う＝額面の中にある。だから内訳の合計には足される
     ── 絵とログで見たいのはそこ。★数量の欄は無い（日数がそのまま数量）。 */
const MGMT = {
  'f-mgmt-days': '8',
  'f-mgmt-extra': 'separate',
  'f-mgmt-pay': '50000',
  'f-mgmt-method': 'monthly',
};

/* その他の兼務・配属の手当（2026-08-27 その7）。§1で「その他の兼務・配属」を選んだ人にだけ出る節。
   ★聞くのは3つだけ（分野・日数・追加報酬。あるときだけ金額）。
     部署名・出向先の会社名・プロジェクト名・勤務割合は**欄そのものが無い**（オーナー明記）。
   ★分野に「社外への出向」を混ぜてある。出向の額は出向先が払っていて会社の明細に
     載っていないことがあるが、支給元は聞かない仕様なので内訳の合計には素直に足す
     （管理職と同じ・組合とは違う）。 */
const NONLINE = {
  areas: ['safety', 'secondment'],
  'f-nonline-days': '8',
  'f-nonline-extra': 'separate',
  'f-nonline-pay': '30000',
};

/* 送信後に返る想定の値（db/pay-reports.sql の submit_pay_report の戻り値と同じ形） */
const RESULT = {
  annual_total_orig: 1055400, annual_total_usd: 287300, annual_total_jpy: 43100000,
  usd_per_block_hour: 276.7, net_annual_jpy: 43100000, fx_at: '2026-08-01',
  fx_missing: false, is_new: true, streak_months: 3,
  access_until: '2027-08-03T00:00:00Z',
  benchmark: { n: 38, median_usd: 271000, p25_usd: 244000, p75_usd: 299000,
               median_usd_per_bh: 258.0, percentile: 76 },
};

const shotNames = new Set();   // この回で実際に撮った名前（末尾の見張りが使う）

async function shoot(page, name) {
  shotNames.add(name + '.png');
  const out = path.join(dir, `${name}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log('  → ' + path.basename(out));
}

async function open(url, width, theme) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  /* ja と en は同一オリジン。前の回が savePreset() した内容が残っていると
     「開いた直後＝S1 だけ」の画面を撮れない。

     ⚠️ 開いてから消して読み直す、では消えない。読み直しの瞬間に**古いほうの画面**が
     pagehide で savePreset() を呼び（pay-report.html の saveDraftOnLeave）、
     さっき消したはずの pv_pay_last を、まだ埋まっている欄から書き戻す。
     2026-09-08、これで役割手当が次の回へ持ち越され、内訳の合計が 77,300 のはずの絵で
     165,100 と出ていた（画面は普通に動いたまま、絵だけ嘘になる）。
     だから**最初の1枚が走り出す前**に消す。あとの読み直し（2回目の訪問の絵）では
     消さない ── sessionStorage の目印で1回だけにする。 */
  await page.evaluateOnNewDocument((t) => {
    try {
      if (!sessionStorage.getItem('pv-shot-wiped')) {
        localStorage.clear();
        sessionStorage.setItem('pv-shot-wiped', '1');
      }
      if (t) localStorage.setItem('pv-theme', t);
    } catch (e) {}
  }, theme || '');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));
  return page;
}

const put = (page, o) => page.evaluate((obj) => {
  for (const [id, v] of Object.entries(obj)) {
    const el = document.getElementById(id);
    if (!el) { console.warn('no such id: ' + id); continue; }
    el.value = v;
    /* ★役職・区分の値を持つのは hidden。絵のチェックはページ側の関数に戻させる
       （ここで自前に書くと、本物とズレたまま撮れてしまう）。 */
    if (id === 'f-jobrole' && typeof syncRoleBoxes === 'function') syncRoleBoxes();
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    /* select は選択肢に無い値を黙って捨てる。捨てられたまま撮ると空欄が写る。
       ★金額の欄は input のたびに桁区切りが付くので、比べる前にカンマを落とす。 */
    if (el.value.replace(/,/g, '') !== String(v)) console.warn(`  ⚠ ${id}: '${v}' は選択肢に無い`);
  }
}, o);
const pick = (o, ...ids) => Object.fromEntries(ids.map((k) => [k, o[k]]));

/* ★段を1つ出す（2026-09-08）。撮るのが目的なので Next の判定は通さず直接運ぶ。
   ウィザードが読めなかったときは1枚ものに戻るので、その回は何もしない
   ── 同じ台本が新旧どちらの画面でも走る。 */
const goStep = async (page, i) => {
  const moved = await page.evaluate((n) => {
    if (!window.PVPayWizard) return false;
    window.PVPayWizard.go(n, { quiet: true });
    return true;
  }, i);
  if (moved) await new Promise((r) => setTimeout(r, 300));
  return moved;
};

/* 「4. 契約と税」は、前回の内容が入っていると要約1行に畳まれている（foldContract）。
   撮る前に開く ── 畳んだままだと中の欄が1つも写らない。 */
const unfoldContract = (page) => page.evaluate(() => {
  const b = document.getElementById('s4-body'), e = document.getElementById('s4-edit');
  if (b && b.hidden && e) e.click();
});

/* 段を順に歩きながら埋める。まとめて入れると「進んでいく様子」ではなく
   最終形しか撮れないので、段の区切りで4回に分ける。
   ★ウィザードでは値を入れても段は動かない。go() で1つずつ運ぶ。 */
async function fillSimple(page) {
  await goStep(page, 0);
  await put(page, pick(SIMPLE, 'f-airline', 'f-position', 'f-fleet', 'f-jobrole', 'f-age'));
  await goStep(page, 1);
  await put(page, pick(SIMPLE, 'f-block', 'f-stay'));
  await goStep(page, 2);
  await put(page, pick(SIMPLE, 'f-currency', 'f-gross', 'f-netpay', 'f-bonus-mo',
                               'f-perdiem', 'f-housing', 'f-housing-amt'));
  await goStep(page, 3);
  await unfoldContract(page);
  await put(page, pick(SIMPLE, 'f-contract', 'f-taxcountry', 'f-seniority'));
  /* 任意項目はチップを押して初めて欄が出る。検品では全部開けて溢れを見る。
     ★内訳（#pay-detail）の中のチップはここでは押さない。開いた直後は「基本給だけ ＋
       4つの『＋』」が正しい絵なので、それを 3a で撮ってから押す。 */
  await page.evaluate(() => {
    for (const c of [...document.querySelectorAll('.chip[data-open]')]) {
      if (!c.closest('#pay-detail')) c.click();
    }
  });
  await put(page, SIMPLE);
  /* 撮るのは「3. 報酬」の段（内訳・役割モジュール・下端の帯が全部ここにある）。 */
  await goStep(page, 2);
  await new Promise((r) => setTimeout(r, 400));
}

/* open=true/false を <details> に流す。toggle は open を代入すれば出るが、
   headless では取りこぼすことがあるので明示的に投げる（テストと同じやり方）。 */
/* 入口の2択（2026-08-13）。「手で入力」を押すまでフォームは出ない。
   ここを押さずに撮ると、以降ぜんぶ2択の画面になる。 */
const startManual = async (page) => {
  await page.click('#entry-manual');
  await new Promise((r) => setTimeout(r, 350));
};

/* 変動給・その他の行を埋める。行はページの pdAdd() が作る（型は <template>）。 */
const putRows = (page, kind, list) => page.evaluate((k, items) => {
  const box = document.getElementById('pd-' + k + '-rows');
  while (box.children.length) box.firstElementChild.remove();
  for (const it of items) {
    const row = pdAdd(k, true);
    const set = (sel, v) => {
      const e = row.querySelector(sel);
      /* ★change も出す。金額の欄が桁区切りに整うのは change のときだけで、
         出さないと本人が打った行だけ 12400 と素の数字で絵に残る。 */
      if (e && v) {
        e.value = v;
        e.dispatchEvent(new Event('input', { bubbles: true }));
        e.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    set('.pd-amt', it.amount); set('.pd-basis', it.basis);
    set('.pd-label', it.label);
  }
  pdSync();
}, kind, list);

/* 教官の節を開いて埋める。担当している訓練はチェックボックス群なので、
   本物のページと同じ change を投げて instrSync() を走らせる。 */
const fillInstr = (page, o) => page.evaluate((v) => {
  const d = document.getElementById('instr-detail');
  d.open = true; d.dispatchEvent(new Event('toggle'));
  for (const b of document.querySelectorAll('input[name="f-instr-train"]')) {
    b.checked = v.train.indexOf(b.value) >= 0;
    b.dispatchEvent(new Event('change', { bubbles: true }));
  }
  for (const id of ['f-instr-label', 'f-instr-extra', 'f-instr-method',
                    'f-instructor', 'f-instr-qty']) {
    const e = document.getElementById(id);
    e.value = v[id];
    e.dispatchEvent(new Event('change', { bubbles: true }));
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }
}, o);

/* 審査の節を開いて埋める。担当している Check はチェックボックス群なので、
   本物のページと同じ change を投げて examSync() を走らせる。 */
const fillExam = (page, o) => page.evaluate((v) => {
  const d = document.getElementById('exam-detail');
  d.open = true; d.dispatchEvent(new Event('toggle'));
  for (const b of document.querySelectorAll('input[name="f-exam-check"]')) {
    b.checked = v.checks.indexOf(b.value) >= 0;
    b.dispatchEvent(new Event('change', { bubbles: true }));
  }
  for (const id of ['f-exam-label', 'f-exam-extra', 'f-exam-method',
                    'f-examiner', 'f-exam-qty']) {
    const e = document.getElementById(id);
    e.value = v[id];
    e.dispatchEvent(new Event('change', { bubbles: true }));
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }
}, o);

/* 組合の節を開いて埋める。チェックボックス群は無い（聞くのは4欄だけ）。
   ★f-union-extra を先に入れないと金額と支給元の欄がまだ出ていないので、
     この並び（日数 → 有無 → 金額 → 支給元）のまま入れる。 */
const fillUnion = (page, o) => page.evaluate((v) => {
  const d = document.getElementById('union-detail');
  d.open = true; d.dispatchEvent(new Event('toggle'));
  for (const id of ['f-union-days', 'f-union-extra', 'f-union-pay', 'f-union-src']) {
    const e = document.getElementById(id);
    e.value = v[id];
    e.dispatchEvent(new Event('change', { bubbles: true }));
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }
}, o);

/* 管理職の節を開いて埋める。チェックボックス群は無い（聞くのは4欄だけ）。
   ★f-mgmt-extra を先に入れないと金額と支給単位の欄がまだ出ていないので、
     この並び（日数 → 有無 → 金額 → 支給単位）のまま入れる。 */
const fillMgmt = (page, o) => page.evaluate((v) => {
  const d = document.getElementById('mgmt-detail');
  d.open = true; d.dispatchEvent(new Event('toggle'));
  for (const id of ['f-mgmt-days', 'f-mgmt-extra', 'f-mgmt-pay', 'f-mgmt-method']) {
    const e = document.getElementById(id);
    e.value = v[id];
    e.dispatchEvent(new Event('change', { bubbles: true }));
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }
}, o);

/* 兼務・配属の節を開いて埋める。★分野はチェックボックス群（教官の「担当している訓練」と同じ形）。
   f-nonline-extra を先に入れないと金額の欄がまだ出ていないので、この並びのまま入れる。 */
const fillNonline = (page, o) => page.evaluate((v) => {
  const d = document.getElementById('nonline-detail');
  d.open = true; d.dispatchEvent(new Event('toggle'));
  for (const code of v.areas) {
    const b = document.querySelector(`input[name="f-nonline-area"][value="${code}"]`);
    b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true }));
  }
  for (const id of ['f-nonline-days', 'f-nonline-extra', 'f-nonline-pay']) {
    const e = document.getElementById(id);
    e.value = v[id];
    e.dispatchEvent(new Event('change', { bubbles: true }));
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }
}, o);

/* 役職・区分の1つを外す。節ごと消えて中身も消えるのが正しい。 */
const untickRole = (page, code) => page.evaluate((v) => {
  const b = document.querySelector(`input[name="f-jobrole"][value="${v}"]`);
  b.checked = false; b.dispatchEvent(new Event('change', { bubbles: true }));
}, code);

const setDetail = async (page, open) => {
  await page.evaluate((o) => {
    const d = document.getElementById('pay-detail');
    d.open = o;
    d.dispatchEvent(new Event('toggle'));
  }, open);
  await new Promise((r) => setTimeout(r, 250));
};

/* ★見える窓で開いたままにする（撮らない）。ほかの shot-*.mjs と同じ open。
     node shot-pay.mjs open              手入力の入口から
     node shot-pay.mjs open detail       DEEP PAY の「給与内訳を追加する」で来たとき
     node shot-pay.mjs open gate         匿名で提出したあとの「登録の箱」まで進めて渡す
     node shot-pay.mjs open fallback     その箱が描けなかったとき（pay-login.js を落とす）
     node shot-pay.mjs open done         会員登録まで済んだ結果カード（祝いが鳴るところ）
     node shot-pay.mjs open second       ★2回目以降（今月の入力 → 確認の2画面）
     node shot-pay.mjs open second slip  ★2回目以降で明細を落とした人の画面
     node shot-pay.mjs open absence      ★不就労減額のある明細を読ませたところ（2026-09-12）
     どれも en を足すと英語（例: node shot-pay.mjs open gate en）
   このページはログイン不要なので素の URL でも出るが、ほかの画面と同じ渡し方に揃える。
   ★gate / fallback は5段を全部埋めて送信まで押す。そこまで手で歩かせないための道。
   ⚠️ その2つでは Supabase 宛ての通信を1本残らず横取りする。素通しにすると
      **本番に架空の給与が1件入る**（localhost が見ている Supabase は本番）。 */
if (process.argv.includes('open')) {
  await browser.close();                    // 撮影用の頭は要らない
  const lang = process.argv.includes('en') ? 'en' : 'ja';
  const wantFb   = process.argv.includes('fallback');
  /* ★done は gate の続き。5段を埋めて匿名で提出したところまで同じ道を歩き、
     そのあと「会員登録が済んだ」結果カードを出す。祝いはそこで鳴る。
     ⚠️ 通信は gate と同じく1本残らず横取りしている＝本番には1件も入らない。 */
  const wantDone = process.argv.includes('done');
  const wantGate = wantFb || wantDone || process.argv.includes('gate');
  /* ★2回目以降（2026-09-12）。「前回の内容」を端末に置いてから開く。
     ⚠️ 本番の DB は読まない。置くのは localStorage だけ＝この窓を閉じれば消える。
     ★slug を足すと、その入口から入ったところで渡す：
        second        → 手入力（1画面に畳まれた「今月の入力」）
        second slip   → 明細の入口（前回使ったほうが先に並ぶ）
     ⚠️ 金額は架空。実在の人の明細ではない。 */
  const wantSecond = process.argv.includes('second');
  const wantSlip   = wantSecond && process.argv.includes('slip');
  /* ★不就労減額（2026-09-12）。読み取りの応答だけを横取りして、減額のある明細を
     読ませたところで渡す。見るのは2つ ──
       ① 読み取り結果の面に「− 18,000 欠勤控除（減額）」が薄い行で出る
       ② 5/5 の確認に「減額：欠勤控除」が1行出る
     ⚠️ 横取りするのは読み取り（parse-payslip）だけ。提出は押さないので
        本番には1件も入らない。金額は架空（db/fixtures の jp-compact と同じ勘定）。 */
  const wantAbsence = process.argv.includes('absence');
  const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}pay-report.html`
            + (process.argv.includes('detail') ? '#pay-detail' : '');
  const b = await puppeteer.launch({
    headless: false, defaultViewport: null, args: ['--no-sandbox', '--window-size=1440,1000'],
  });
  const [pg] = await b.pages();
  if (wantGate) {
    await pg.setRequestInterception(true);
    pg.on('request', (r) => {
      const u = r.url();
      if (wantFb && /\/pay-login\.js/.test(u)) return r.abort();
      if (!/vzgmnkrggrwtsrpqndsm\.supabase\.co/.test(u)) return r.continue();
      const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*',
                  'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS' };
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: H, body: '' });
      const json = (o) => r.respond({ status: 200, headers: H, contentType: 'application/json', body: JSON.stringify(o) });
      if (/submit_pay_report_pending/.test(u)) return json({ ok: true, claim_token: 'a'.repeat(48), id: '0'.repeat(8) });
      if (/\/rest\/v1\//.test(u)) return json([]);
      return json({});
    });
  }
  if (wantSecond) {
    /* ⚠️ 置くのは evaluateOnNewDocument（次の文書が動き出す前）。素の evaluate で
       書いてから reload すると、離れる拍子の savePreset() が空のフォームで上書きする
       ── db/test-form-contract.mjs と同じ順。 */
    await pg.evaluateOnNewDocument((f, t) => {
      try {
        localStorage.setItem('pv_pay_last',
          JSON.stringify(Object.assign({}, f, { _own: 'anon', _ts: t, _tab: '' })));
      } catch (e) {}
    }, Object.assign({}, LAST_MONTH, { _entry: wantSlip ? 'payslip' : 'manual' }), Date.now());
  }
  if (wantAbsence) {
    /* 読み取りの応答だけを作る。Edge Function の本物の後処理（sanitize / reconcile /
       applyChecks）をそのまま import して通す ── ここを手で写すと、あちらが変わった
       ときに窓だけ古い形を出し続ける。 */
    globalThis.Deno = globalThis.Deno || { env: { get: () => '' }, serve: () => {} };
    const { sanitize, reconcile, applyChecks } =
      await import('./supabase/functions/parse-payslip/index.ts');
    const RAW = {
      currency: 'JPY', period: { year: 2026, month: 7 },
      earnings: [
        { label: '基本給',   amount: 360000, kind: 'base' },
        { label: '乗務手当', amount: 224000, kind: 'flight_variable', basis: 'block' },
        { label: '家族手当', amount:   8000, kind: 'other' },
        { label: '欠勤控除', amount: -18000, kind: 'absence' },
        { label: '日当',     amount:   9000, kind: 'per_diem' },
      ],
      hours: [{ label: '乗務時間', value: 70, kind: 'block' }],
      gross_total: 583000, deductions_total: 120000, net_pay: 463000,
      unmapped: [], confidence: 'high',
    };
    const q = sanitize(RAW);
    const FAKE = { ok: true, result: applyChecks(q, reconcile(q)) };
    await pg.setRequestInterception(true);
    pg.on('request', (r) => {
      const u = r.url();
      if (!u.includes('/functions/v1/parse-payslip')) return r.continue();
      const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*',
                  'Access-Control-Allow-Methods': 'POST, OPTIONS' };
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: H, body: '' });
      r.respond({ status: 200, headers: H, contentType: 'application/json',
                  body: JSON.stringify(FAKE) });
    });
  }
  await pg.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  if (wantAbsence) {
    await pg.evaluate(() => localStorage.clear());
    await pg.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await pg.click('#entry-payslip');
    await pg.waitForFunction(() => {
      const n = document.getElementById('ps');
      return !!n && !n.hidden && n.offsetHeight > 0;
    }, { timeout: 10000 });
    const f = await pg.$('#ps-file');
    await f.uploadFile(path.join(ROOT, 'db/fixtures/payslip-pdf-gulf.pdf'));
    await pg.waitForFunction(() => {
      const b = document.getElementById('ps-confirm');
      return !!b && !b.disabled;
    }, { timeout: 60000 });
    await pg.click('#ps-confirm');
    await pg.click('#ps-send');
    await pg.waitForFunction(() => {
      const e = document.getElementById('f-gross');
      return !!e && Math.abs(Number(String(e.value).replace(/[^0-9.]/g, '')) - 583000) < 0.5;
    }, { timeout: 60000 });
    /* ★減額の行は「読み取った明細の内訳を見る」の中。畳んだまま渡すと
       「出ていない」と読まれるので、開いた状態で渡す。 */
    await pg.evaluate(() => {
      document.querySelectorAll('#ps-panel details').forEach((d) => { d.open = true; });
      const p = document.getElementById('ps-panel');
      if (p) p.scrollIntoView({ block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 300));
    const seen = await pg.evaluate(() => {
      const t = (document.getElementById('ps-panel') || {}).textContent || '';
      const a = document.getElementById('f-absence');
      return { panel: t.indexOf('欠勤控除') >= 0, hidden: a ? a.value : null };
    });
    console.log('不就労減額のある明細を読ませた（金額は架空・提出は押していない＝本番には1件も入らない）。');
    console.log(`  読み取り結果の面に「欠勤控除」が出ている: ${seen.panel ? 'はい' : 'いいえ'}`);
    console.log(`  送信まで運ぶ隠し欄 f-absence: ${seen.hidden}`);
    /* ★オーナーが赤い注意を見たのはここ（3/5・報酬）。読ませたまま渡すと
       「直ったのか」が画面から読めないので、その段まで運んでから渡す。 */
    await pg.evaluate(() => { if (window.PVPayWizard) window.PVPayWizard.go(2); });
    await new Promise((r) => setTimeout(r, 500));
    const warn = await pg.evaluate(() => {
      const on = [...document.querySelectorAll('[id^="pd-over"], #pd-over')]
        .filter((e) => !e.hidden && e.offsetHeight > 0).map((e) => e.id);
      const g = document.getElementById('f-gross');
      if (g) g.scrollIntoView({ block: 'center' });
      return on;
    });
    console.log(`  3/5（報酬）で「内訳の合計が総支給を超えています」: ${warn.length ? '出ている（' + warn.join(',') + '）' : '出ていない'}`);
    console.log('  5/5 の確認は、右下の「次へ」で最後まで進むと「減額：欠勤控除」が1行出る。');
  }
  if (wantSecond) {
    await new Promise((r) => setTimeout(r, 500));
    if (!wantSlip) await startManual(pg);
    await new Promise((r) => setTimeout(r, 400));
    const n = await pg.evaluate(() => (window.PVPayWizard ? PVPayWizard.count() : 0));
    console.log(wantSlip
      ? '2回目以降・明細の入口（前回使ったほうが先に並ぶ）。前回の内容は端末に置いただけ＝本番は読んでいない。'
      : `2回目以降の手入力。段は ${n} 枚（初回は5枚）。前回の内容は端末に置いただけ＝本番は読んでいない。`);
  }
  if (wantGate) {
    await startManual(pg);
    await fillSimple(pg);
    await pg.evaluate(() => { if (window.PVPayWizard) window.PVPayWizard.goLast(); });
    await new Promise((r) => setTimeout(r, 600));
    await pg.evaluate(() => document.getElementById('submit-btn').click());
    /* 逃げ道は5秒で出る。出るまでは高さ34pxの空枠のままなので、待たずに渡すと
       「何も無い」画面を見せることになる。 */
    await new Promise((r) => setTimeout(r, wantFb ? 7500 : 2000));
    await pg.evaluate(() => {
      const g = document.getElementById('login-gate');
      if (g) g.scrollIntoView({ block: 'center' });
    });
    if (wantDone) {
      /* ★ページ自身の renderResult をそのまま呼ぶ。見せたいのは「登録が済んだ
         あとに出る画面」で、そこへ至る経路（引き取り）が正しいかは
         db/test-pay-gate.mjs が見ている。ここは絵を渡すためだけの窓。 */
      await pg.evaluate(() => {
        renderResult(
          { ok: true, is_new: true, currency: 'JPY', annual_total_orig: 14400000,
            annual_total_usd: 96000, annual_total_jpy: 14400000,
            access_until: new Date(Date.now() + 90 * 864e5).toISOString() },
          { airline: 'ana', period_year: 2026, period_month: 8,
            position: 'fo', fleet: 'b787', currency: 'JPY' });
      });
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log(wantDone
      ? '匿名で提出 → 会員登録まで済んだ結果カードを出した（祝いが鳴るところ）。本番には1件も入っていない。'
      : wantFb
      ? '匿名で提出 → 登録の箱が描けなかったとき（逃げ道）まで進めた。本番には1件も入っていない。'
      : '匿名で提出 → 登録の箱まで進めた。本番には1件も入っていない。');
  }
  console.log(`見える窓で開いた（${url}）。閉じるとこのコマンドも終わる。`);
  /* ★時間で待たない。待つのは「窓が閉じられたこと」＝接続が切れたこと
     （時間で待つと、誰も触っていないのに 30 秒で勝手に消える）。 */
  await new Promise((r) => b.on('disconnected', r));
  process.exit(0);
}

/* ══ node shot-pay.mjs second ── 2か月目を通しで撮る（2026-09-12・指摘1）══
   オーナー指摘「2か月分の操作を、実際の画面で通して確認する」に答えるための回。
   ⚠️ **実機ではない。** ブラウザのスマホ表示（幅390px）。実機での確認は宿題に残す。

   撮るもの（日英 × 手入力／明細アップロードの2本立て）
     1 entry        2か月目の入口（前回使ったほうが先に並ぶ）
     2 input        今月の入力（1画面）★基本給・保証給が「前回の 0」で出る
                                        ★変動給は**未回答のまま**（前月の「なし」を持ち込まない）
     3 review       確認（5/5 相当）
     4 result       提出後の結果 ＝ 戻り先
     5 slip-entry   明細アップロードの入口
     6 slip-read    読み取り結果 ★家族手当・株式積立奨励金が**行として**出る
     7 slip-input   読み取りを受けた今月の入力
     8 slip-review  確認
     9 slip-result  提出後の結果

   ⚠️ **本番には1件も入らない。** Supabase 宛ての通信は1本残らず横取りする。
      明細も db/fixtures/ の合成 PDF で、読み取りの応答はこちらで作る
      （ただし**本物のサーバ実装に通してから**返す ── 写経した複製で作ると、
        サーバ側の金額の読み方が腐っても絵は正しいまま出てしまう）。
   ⚠️ 金額は架空。実在の人の明細ではない。 */
if (ROUND === 'second') {
  await browser.close();

  /* 本物の parse-payslip を読むための最小の Deno（db/test-form-contract.mjs と同じ手）。
     読むだけ＝ネットにも Anthropic にも触らない。 */
  globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
  const { sanitize, reconcile, applyChecks } =
    await import('./supabase/functions/parse-payslip/index.ts');

  /* 前月ぶん。★その月の実績は1つも置かない。
     ★「基本給なし・保証給なし・変動給なし」を全部立ててある ── 2つは「前回の 0」として
       金額欄に出て、変動給だけは持ち込まれない、という指摘2の直しを1枚で見るため。 */
  const LAST_NONE = {
    'f-airline': 'emirates', 'f-position': 'cap', 'f-fleet': 'b777', 'f-currency': 'AED',
    'f-age': '40-49', 'f-jobrole': 'line', 'f-housing': 'allowance',
    'f-contract': 'direct', 'f-seniority': '12', 'f-taxcountry': 'AE', 'f-tax': '0',
    'f-command': '3200', 'f-housing-amt': '17500',
    'f-payitems': JSON.stringify({
      v: 1, fixed_none: true, guarantee_none: true, variable_none: true,
      variable: [{ label: 'Flight Pay', basis: 'block' }],
    }),
  };

  /* モデルの生の出力（日本の明細を想定）。★家族手当は語彙に無い＝unmapped へ、
     株式積立奨励金は other へ落ちる ── 指摘3で「行として出す」ようにした2つ。 */
  const RAW = {
    currency: 'JPY', period: { year: 2026, month: 8 },
    earnings: [
      { label: '基本給', amount: 420000, kind: 'base' },
      { label: '職務手当', amount: 185000, kind: 'command' },
      { label: '変動付加乗務手当', amount: 148200, kind: 'flight_variable' },
      { label: '住宅手当', amount: 60000, kind: 'housing' },
      { label: '日当（非課税）', amount: 42000, kind: 'per_diem' },
      { label: '株式積立奨励金', amount: 1000, kind: 'other' },
    ],
    /* ★時間は value（金額は amount）── サーバ側の型がそうなっている。 */
    hours: [{ label: '乗務時間', value: 78.2, kind: 'block' },
            { label: '総勤務時間', value: 168.5, kind: 'duty' }],
    gross_total: 884200,          // 明細に印字された総支給（内訳の合計と1円まで合う）
    deductions_total: 221354, net_pay: 662846,
    unmapped: [{ label: '家族手当', amount: 28000 }],
  };
  const FAKE = (() => { const p = sanitize(RAW); return { ok: true, result: applyChecks(p, reconcile(p)) }; })();
  const FN = '/functions/v1/parse-payslip';
  /* ★authorization はワイルドカードの対象外（仕様）。名指ししないと、送信の
     preflight だけがブラウザに止められて「Failed to fetch」になる。 */
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, apikey, content-type, content-profile, accept-profile, prefer, '
      + 'range, x-client-info, x-supabase-api-version, *',
    'Access-Control-Allow-Methods': '*',
  };
  const PDF = path.join(ROOT, 'db/fixtures/payslip-pdf-gulf.pdf');

  const b2 = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
  /* 今月ぶんに、本人が打ち直す分だけ。★基本給は「前回の 0」を打ち替える（指摘2）。 */
  const NOW = { 'f-year': '2026', 'f-month': '8', 'f-block': '81.4', 'f-stay': '9',
                'f-gross': '68400', 'f-netpay': '68400',
                'f-perdiem': '4200', 'f-bonus-mo': '0' };

  for (const lang of ['ja', 'en']) {
    const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}pay-report.html`;

    /* 1つの窓を開いて、前月ぶんを置き、通信を横取りするところまで。 */
    const openSecond = async (entry) => {
      const p = await b2.newPage();
      await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      p.on('pageerror', (e) => console.log('  ⚠ ページ例外: ' + e.message));
      /* ★落ちた通信は黙って「送信できませんでした」になるだけ。理由をここで出す。 */
      p.on('requestfailed', (r) => /google-analytics|googletagmanager|\/g\/collect/.test(r.url()) ? 0
        : console.log('  ⚠ 通信が落ちた: ' + r.method() + ' '
        + r.url().replace(/^https?:\/\/[^/]+/, '') + ' — ' + ((r.failure() || {}).errorText || '?')));
      await p.setRequestInterception(true);
      p.on('request', (r) => {
        const u = r.url();
        const J = { ...CORS, 'Content-Type': 'application/json' };
        if (u.includes(FN)) {
          if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: CORS, body: '' });
          return r.respond({ status: 200, headers: J, body: JSON.stringify(FAKE) });
        }
        /* ★ここを素通しにすると、本番に架空の給与が1件入る（localhost が
           見ている Supabase は本番）。1本残らず横取りする。 */
        if (!/supabase\.co/.test(u)) return r.continue();
        if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: CORS, body: '' });
        /* ★本物の submit_pay_report は { ok: true, … } を返す。ok が無いと画面は
           「サーバから結果が返りませんでした」で止まる（結果パネルまで撮れない）。 */
        if (/submit_pay_report/.test(u)) {
          return r.respond({ status: 200, headers: J,
            body: JSON.stringify(Object.assign({ ok: true }, RESULT)) });
        }
        if (/\/rest\/v1\//.test(u)) return r.respond({ status: 200, headers: J, body: '[]' });
        return r.respond({ status: 200, headers: J, body: '{}' });
      });
      await p.evaluateOnNewDocument((o, t, e2) => {
        try {
          localStorage.clear();
          localStorage.setItem('pv-theme', 'light');
          localStorage.setItem('pv_pay_last',
            JSON.stringify(Object.assign({}, o, { _own: 'anon', _ts: t, _tab: '', _entry: e2 })));
        } catch (err) {}
      }, LAST_NONE, Date.now(), entry);
      await p.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 900));
      /* 送信のときだけログイン済みにする（結果パネルまで撮るため）。 */
      await p.evaluate(() => {
        _sb.auth.getSession = async () => ({
          data: { session: { user: { id: '00000000-0000-4000-8000-00000000ff01' } } } });
      });
      return p;
    };

    /* 最後の段まで運んで確認を撮り、送信して結果まで撮る。 */
    const finish = async (p, tag) => {
      await p.evaluate(() => { if (window.PVPayWizard) window.PVPayWizard.goLast(); });
      await new Promise((r) => setTimeout(r, 600));
      await shoot(p, `${lang}-${tag}-review`);
      const miss = await p.evaluate(() => (typeof missingAll !== 'function' ? ['?'] :
        missingAll().map((x) => {
          const e = x.querySelector('input,select,textarea');
          return e ? (e.id || e.className) : (x.id || '?');
        })));
      if (miss.length) console.log(`  ⚠ 足りない必須: ${miss.join(' / ')}（送信は止まる）`);
      await p.evaluate(() => document.getElementById('submit-btn').click());
      await new Promise((r) => setTimeout(r, 1600));
      await shoot(p, `${lang}-${tag}-result`);
    };

    /* ── A. 手入力 ───────────────────────────────────────── */
    console.log(`\n${lang} / 2か月目・手入力（幅390px＝ブラウザのスマホ表示）`);
    {
      const p = await openSecond('manual');
      await shoot(p, `${lang}-1-entry`);
      await startManual(p);
      await new Promise((r) => setTimeout(r, 500));
      await shoot(p, `${lang}-2-input`);
      const st = await p.evaluate(() => {
        const g = (id) => { const e = document.getElementById(id); return e ? String(e.value) : null; };
        const c = (id) => { const e = document.getElementById(id); return e ? !!e.checked : null; };
        const mk = (id) => { const e = document.getElementById(id);
                             return e && e.classList.contains('pv-carried'); };
        return { base: g('f-base'), guar: g('f-guarantee'), carried: mk('f-base') && mk('f-guarantee'),
                 vnone: c('f-variable-none'), vsum: g('f-var-sum'),
                 vbtn: !!document.getElementById('pd-var').disabled,
                 steps: window.PVPayWizard ? PVPayWizard.count() : 0 };
      });
      console.log(`     段 ${st.steps} 枚 / 基本給 '${st.base}'・保証給 '${st.guar}'`
                  + `（引き継ぎの印 ${st.carried ? 'あり' : '—'}）`);
      console.log(`     ★変動給: チェック ${st.vnone ? '入ってしまっている' : '入っていない'}`
                  + ` / 合計 '${st.vsum}' / 「追加」ボタン ${st.vbtn ? '塞がっている' : '押せる'}`
                  + '（＝今月も聞く。指摘2の直しが効いている証拠）');
      await put(p, NOW);
      await put(p, { 'f-base': '38000' });      // 「前回の 0」を打ち替える
      await putRows(p, 'var', [{ amount: '12400', label: 'Flight Pay', basis: 'block' }]);
      await new Promise((r) => setTimeout(r, 400));
      await finish(p, '3');
      await p.close();
    }

    /* ── B. 明細アップロード ──────────────────────────────── */
    console.log(`${lang} / 2か月目・明細アップロード`);
    {
      const p = await openSecond('payslip');
      await shoot(p, `${lang}-5-slip-entry`);
      /* ★前回使ったほうが先に並ぶだけで、押すのは今までどおり本人。 */
      await p.click('#entry-payslip');
      await new Promise((r) => setTimeout(r, 400));
      await p.waitForFunction(() => {
        const n = document.getElementById('ps');
        return !!n && !n.hidden && n.offsetHeight > 0;
      }, { timeout: 10000 });
      const input = await p.$('#ps-file');
      await input.uploadFile(PDF);
      await p.waitForSelector('.ps-edit', { timeout: 40000 });
      await p.waitForFunction(() => {
        const b3 = document.getElementById('ps-confirm');
        return !!b3 && !b3.disabled;
      }, { timeout: 60000 });
      await p.click('#ps-confirm');
      await p.click('#ps-send');
      await p.waitForFunction(() => !!document.querySelector('.ps-res, .ps-msg-warn'),
        { timeout: 30000 });
      await new Promise((r) => setTimeout(r, 700));
      await shoot(p, `${lang}-6-slip-read`);
      /* ★指摘3の証拠 ── 家族手当（語彙に無い）と株式積立奨励金（その他）が、
         隠し欄に合算されずに**行として**出ているか。 */
      const oth = await p.evaluate(() => {
        const box = document.getElementById('pd-oth-rows');
        const rows = [...box.querySelectorAll('.pd-row')].map((r) => ({
          label: (r.querySelector('.pd-label') || {}).value,
          amount: (r.querySelector('.pd-amt') || {}).value,
        }));
        const h = document.getElementById('f-other');
        return { rows: rows, sum: document.getElementById('f-oth-sum').value,
                 hidden: h ? String(h.value) : null };
      });
      console.log('     ★その他の現金手当の行: '
                  + (oth.rows.length ? oth.rows.map((r) => `${r.label}=${r.amount}`).join(' / ') : 'なし'));
      console.log(`     合計 '${oth.sum}' / 隠し欄 f-other '${oth.hidden}'（空でないと二重計上）`);
      /* 明細に載らないもの（ステイ日数・当月賞与）だけ本人が足してから撮る。
         ★日当は明細から入っている＝ここでは触らない。
         ★先に撮ると6枚目と1ドットも変わらない絵になる（読み取り結果と同じ画面）。 */
      await put(p, { 'f-stay': '9', 'f-bonus-mo': '0' });
      await new Promise((r) => setTimeout(r, 400));
      await shoot(p, `${lang}-7-slip-input`);
      await finish(p, '8');
      await p.close();
    }
  }
  await b2.close();
  console.log('\n保存先: ' + dir);
  console.log('⚠ 実機ではない ── ブラウザのスマホ表示（幅390px）で通した絵。');
  console.log('⚠ 本番の給与には1件も入っていない（Supabase 宛ては1本残らず横取りした）。');
  const st2 = fs.readdirSync(dir).filter((f2) => f2.endsWith('.png') && !shotNames.has(f2));
  if (st2.length) console.log(`\n⚠ この回で撮っていない絵が ${st2.length} 枚 残っている: ` + st2.sort().join(' '));
  process.exit(0);
}

for (const [lang, url] of [['ja', 'http://localhost:3000/pay-report.html'],
                           ['en', 'http://localhost:3000/en/pay-report.html']]) {
  for (const [wname, w] of [['desktop', 1440], ['mobile', 390]]) {
    for (const theme of ['dark', 'light']) {
      // モバイルのライトは1枚に絞る（枚数を増やしても読めない）
      if (wname === 'mobile' && theme === 'light') continue;
      const page = await open(url, w, theme);
      const tag = `${lang}-${wname}-${theme}`;
      console.log(`${lang} / ${wname} / ${theme}`);
      await shoot(page, `${tag}-0-entry`);
      /* 明細側（ステップ 1/2）も1枚撮り、そこから「読まずに手で入力する」で抜ける。
         逃げ道が生きていないと、明細が読めない人はここで行き止まりになる。 */
      await page.click('#entry-payslip');
      await new Promise((r) => setTimeout(r, 350));
      await shoot(page, `${tag}-0b-payslip`);
      await page.click('#ps-skip');
      await new Promise((r) => setTimeout(r, 350));
      /* ★空のまま4つの段を歩く（2026-09-08）。「これから埋める姿」が段ごとに
         どう見えるかは、Marit と突き合わせるときの土台になる。
         あわせて、下端の帯が「3. 報酬」の段でしか出ないことをログで見る
         ── ほかの段で出ていたら、入力欄と Next を隠す物が増えたということ。 */
      const WALK = [['1', 0, 'empty'], ['1b', 1, 's2-empty'],
                    ['1c', 2, 's3-empty'], ['1d', 3, 's4-empty']];
      const barSeen = [];
      for (const [n, i, name] of WALK) {
        await goStep(page, i);
        if (i === 3) await unfoldContract(page);
        await shoot(page, `${tag}-${n}-${name}`);
        const on = await page.evaluate(() => !document.getElementById('sticky-submit').hidden);
        barSeen.push(`${name}=${on ? '帯' : '—'}`);
      }
      console.log(`     下端の帯: ${barSeen.join(' / ')}（s3-empty だけ「帯」が正しい）`);

      await fillSimple(page);
      await shoot(page, `${tag}-2-simple`);

      // 3. くわしく入れるを開く＝額面は残ったまま「下の内訳の合計」になる
      await setDetail(page, true);
      /* ★3a. 開いた直後。出ているのは基本給だけで、保証給・変動給・職位手当・
         その他の現金手当は「＋」で足す（オーナー指示の Progressive Disclosure）。 */
      await shoot(page, `${tag}-3a-detail-plus`);
      await page.evaluate(() => {
        for (const c of [...document.querySelectorAll('#pay-detail .chip[data-open]')]) c.click();
      });
      await put(page, DETAIL);
      await putRows(page, 'var', VAR);
      await putRows(page, 'oth', OTH);
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3-detail-open`);
      const mirrored = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        ro: document.getElementById('f-gross').readOnly,
        sum: typeof monthlyDetail === 'function' ? monthlyDetail() : null,
        over: document.getElementById('pd-over').offsetParent !== null,
      }));
      console.log(`     額面の欄 = ${mirrored.gross}（本人の入力のまま / 読み取り専用 ${mirrored.ro}）`);
      console.log(`     内訳の合計 = ${mirrored.sum} / 超過の注意 = ${mirrored.over ? '出' : '—'}`);

      /* 3b. わざと超えさせる。注意は**超えたときだけ**出る（足りないときは何も言わない
             ＝説明できない残りは普通のこと）。出ても送信は止めない。 */
      await put(page, { 'f-base': String(Number(SIMPLE['f-gross']) + 1000) });
      await new Promise((r) => setTimeout(r, 250));
      await shoot(page, `${tag}-3b-detail-over`);
      const over = await page.evaluate(() => ({
        over: document.getElementById('pd-over').offsetParent !== null,
        /* ★注意が出ても送信は止めない。5ステップでは「送信ボタンが出ているか」では
           見えない（ボタンは 5/5 の中に常にある）ので、送信をふさぐ空欄の数で見る。 */
        block: typeof missingAll === 'function' ? missingAll().length : -1,
      }));
      console.log(`     超えさせたとき: 注意 = ${over.over ? '出' : '—'}`
                  + ` / 送信をふさぐ空欄 = ${over.block} 件（0 が正しい）`);
      await put(page, { 'f-base': DETAIL['f-base'] });
      await new Promise((r) => setTimeout(r, 200));

      /* 3c. 教官・訓練の手当。★変動給・その他の合計が1円も増えていないこと、
             額面（f-gross）が書き換わっていないことを絵とログの両方で見る。 */
      /* ★読むのは f-var-sum / f-oth-sum。f-flightvar と f-other は明細読み取り専用の
         隠し欄で、人が足した行の合計はこちらに入る（payload もこちらを足している）。 */
      const sums = () => ({
        gross: document.getElementById('f-gross').value,
        vari: document.getElementById('f-var-sum').value,
        oth: document.getElementById('f-oth-sum').value,
      });
      const beforeInstr = await page.evaluate(sums);
      await fillInstr(page, INSTR);
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3c-instructor`);
      const afterInstr = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        vari: document.getElementById('f-var-sum').value,
        oth: document.getElementById('f-oth-sum').value,
        pay: document.getElementById('f-instructor').value,
        unit: document.getElementById('instr-unit').offsetParent !== null,
        items: (() => { try { return JSON.parse(document.getElementById('f-payitems').value).instructor; }
                        catch (e) { return null; } })(),
      }));
      console.log(`     教官の額 = ${afterInstr.pay} / 回数の欄 = ${afterInstr.unit ? '出' : '—'}`);
      console.log(`     額面 ${beforeInstr.gross} → ${afterInstr.gross}`
                  + ` / 変動給 ${beforeInstr.vari} → ${afterInstr.vari}`
                  + ` / その他 ${beforeInstr.oth} → ${afterInstr.oth}`
                  + `（3つとも動かないのが正しい）`);
      console.log(`     pay_items.instructor = ${JSON.stringify(afterInstr.items)}`);

      /* 3d. 教官を外す＝節ごと消えて、中身も消える（画面に無いものを黙って送らない）。 */
      await untickRole(page, 'instructor');
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3d-instructor-off`);
      const offInstr = await page.evaluate(() => ({
        shown: document.getElementById('s3-instr').offsetParent !== null,
        pay: document.getElementById('f-instructor').value,
        items: (() => { try { return JSON.parse(document.getElementById('f-payitems').value).instructor; }
                        catch (e) { return null; } })(),
      }));
      console.log(`     外したあと: 節 = ${offInstr.shown ? '出' : '—'}`
                  + ` / 額 = '${offInstr.pay}' / pay_items.instructor = ${JSON.stringify(offInstr.items)}`);
      await put(page, { 'f-jobrole': SIMPLE['f-jobrole'] });
      await fillInstr(page, INSTR);
      await new Promise((r) => setTimeout(r, 200));

      /* 3e. 審査・査察の手当。★ここでの本題は「教官の額（f-instructor）まで含めて
             どの合計も増えていない」こと。教官と審査の両方をやっている人が
             同じ手当を2回入れる道が無いか、絵とログで見る。 */
      const beforeExam = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        vari: document.getElementById('f-var-sum').value,
        oth: document.getElementById('f-oth-sum').value,
        instr: document.getElementById('f-instructor').value,
      }));
      await fillExam(page, EXAM);
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3e-examiner`);
      const afterExam = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        vari: document.getElementById('f-var-sum').value,
        oth: document.getElementById('f-oth-sum').value,
        instr: document.getElementById('f-instructor').value,
        pay: document.getElementById('f-examiner').value,
        unit: document.getElementById('exam-unit').offsetParent !== null,
        items: (() => { try { return JSON.parse(document.getElementById('f-payitems').value).examiner; }
                        catch (e) { return null; } })(),
      }));
      console.log(`     審査の額 = ${afterExam.pay} / 回数の欄 = ${afterExam.unit ? '出' : '—'}`);
      console.log(`     額面 ${beforeExam.gross} → ${afterExam.gross}`
                  + ` / 変動給 ${beforeExam.vari} → ${afterExam.vari}`
                  + ` / その他 ${beforeExam.oth} → ${afterExam.oth}`
                  + ` / 教官 ${beforeExam.instr} → ${afterExam.instr}`
                  + `（4つとも動かないのが正しい）`);
      console.log(`     pay_items.examiner = ${JSON.stringify(afterExam.items)}`);

      /* 3f. 審査を外す＝節ごと消えて中身も消える。教官の側は残ったまま。 */
      await untickRole(page, 'examiner');
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3f-examiner-off`);
      const offExam = await page.evaluate(() => ({
        shown: document.getElementById('s3-exam').offsetParent !== null,
        pay: document.getElementById('f-examiner').value,
        instr: document.getElementById('f-instructor').value,
        items: (() => { try { return JSON.parse(document.getElementById('f-payitems').value); }
                        catch (e) { return null; } })(),
      }));
      console.log(`     外したあと: 節 = ${offExam.shown ? '出' : '—'}`
                  + ` / 額 = '${offExam.pay}' / 教官は残っている = ${offExam.instr}`
                  + ` / pay_items.examiner = ${JSON.stringify(offExam.items && offExam.items.examiner)}`);
      await put(page, { 'f-jobrole': SIMPLE['f-jobrole'] });
      await fillExam(page, EXAM);
      await new Promise((r) => setTimeout(r, 200));

      /* 3g. 組合・乗員代表の手当。★ここでの本題は2つ。
             ① 教官・審査の額まで含めて、どの合計も増えていないこと
             ② 支給元が「組合」なので、額面との突き合わせ（#pd-over）が動かないこと
                ── 会社の明細に載っていないお金を足すと、注意が嘘で出る。 */
      const beforeUnion = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        vari: document.getElementById('f-var-sum').value,
        oth: document.getElementById('f-oth-sum').value,
        instr: document.getElementById('f-instructor').value,
        exam: document.getElementById('f-examiner').value,
        sum: typeof monthlyDetail === 'function' ? monthlyDetail() : null,
      }));
      await fillUnion(page, UNION);
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3g-union`);
      const afterUnion = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        vari: document.getElementById('f-var-sum').value,
        oth: document.getElementById('f-oth-sum').value,
        instr: document.getElementById('f-instructor').value,
        exam: document.getElementById('f-examiner').value,
        pay: document.getElementById('f-union-pay').value,
        src: document.getElementById('f-union-src').value,
        sum: typeof monthlyDetail === 'function' ? monthlyDetail() : null,
        inGross: typeof unionInGross === 'function' ? unionInGross() : null,
        items: (() => { try { return JSON.parse(document.getElementById('f-payitems').value).union; }
                        catch (e) { return null; } })(),
      }));
      console.log(`     組合の額 = ${afterUnion.pay} / 支給元 = ${afterUnion.src}`);
      console.log(`     額面 ${beforeUnion.gross} → ${afterUnion.gross}`
                  + ` / 変動給 ${beforeUnion.vari} → ${afterUnion.vari}`
                  + ` / その他 ${beforeUnion.oth} → ${afterUnion.oth}`
                  + ` / 教官 ${beforeUnion.instr} → ${afterUnion.instr}`
                  + ` / 審査 ${beforeUnion.exam} → ${afterUnion.exam}`
                  + `（5つとも動かないのが正しい）`);
      console.log(`     支給元が組合なので額面と突き合わせない = ${afterUnion.inGross === 0}`
                  + ` / 額面と比べる内訳の合計 ${beforeUnion.sum} → ${afterUnion.sum}`
                  + `（増えないのが正しい）`);
      console.log(`     pay_items.union = ${JSON.stringify(afterUnion.items)}`);

      /* 3h. 組合を外す＝節ごと消えて中身も消える。教官・審査の側は残ったまま。 */
      await untickRole(page, 'union');
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3h-union-off`);
      const offUnion = await page.evaluate(() => ({
        shown: document.getElementById('s3-union').offsetParent !== null,
        pay: document.getElementById('f-union-pay').value,
        days: document.getElementById('f-union-days').value,
        instr: document.getElementById('f-instructor').value,
        exam: document.getElementById('f-examiner').value,
        items: (() => { try { return JSON.parse(document.getElementById('f-payitems').value); }
                        catch (e) { return null; } })(),
      }));
      console.log(`     外したあと: 節 = ${offUnion.shown ? '出' : '—'}`
                  + ` / 額 = '${offUnion.pay}' / 日数 = '${offUnion.days}'`
                  + ` / 教官 ${offUnion.instr}・審査 ${offUnion.exam} は残っている`
                  + ` / pay_items.union = ${JSON.stringify(offUnion.items && offUnion.items.union)}`);
      await put(page, { 'f-jobrole': SIMPLE['f-jobrole'] });
      await fillUnion(page, UNION);
      await new Promise((r) => setTimeout(r, 200));

      /* 3i. 管理・マネジメントの手当。★ここでの本題は組合と**逆**の1点。
             この額は会社が払う＝額面の中にあるので、内訳の合計には足される。
             足されないと「内訳の合計が額面を超えています」が出るべきときに出ない。
             ほかの列（変動給・その他・職位手当・教官・審査・組合）は1円も増えない。 */
      const beforeMgmt = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        vari: document.getElementById('f-var-sum').value,
        oth: document.getElementById('f-oth-sum').value,
        cmd: document.getElementById('f-command').value,
        instr: document.getElementById('f-instructor').value,
        exam: document.getElementById('f-examiner').value,
        uni: document.getElementById('f-union-pay').value,
        sum: typeof monthlyDetail === 'function' ? monthlyDetail() : null,
      }));
      await fillMgmt(page, MGMT);
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3i-mgmt`);
      const afterMgmt = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        vari: document.getElementById('f-var-sum').value,
        oth: document.getElementById('f-oth-sum').value,
        cmd: document.getElementById('f-command').value,
        instr: document.getElementById('f-instructor').value,
        exam: document.getElementById('f-examiner').value,
        uni: document.getElementById('f-union-pay').value,
        pay: document.getElementById('f-mgmt-pay').value,
        days: document.getElementById('f-mgmt-days').value,
        sum: typeof monthlyDetail === 'function' ? monthlyDetail() : null,
        items: (() => { try { return JSON.parse(document.getElementById('f-payitems').value).management; }
                        catch (e) { return null; } })(),
      }));
      console.log(`     管理職の額 = ${afterMgmt.pay} / 管理業務日数 = ${afterMgmt.days}日`);
      console.log(`     額面 ${beforeMgmt.gross} → ${afterMgmt.gross}`
                  + ` / 変動給 ${beforeMgmt.vari} → ${afterMgmt.vari}`
                  + ` / その他 ${beforeMgmt.oth} → ${afterMgmt.oth}`
                  + ` / 職位手当 ${beforeMgmt.cmd} → ${afterMgmt.cmd}`
                  + ` / 教官 ${beforeMgmt.instr} → ${afterMgmt.instr}`
                  + ` / 審査 ${beforeMgmt.exam} → ${afterMgmt.exam}`
                  + ` / 組合 ${beforeMgmt.uni} → ${afterMgmt.uni}`
                  + `（7つとも動かないのが正しい）`);
      console.log(`     ★額面と比べる内訳の合計 ${beforeMgmt.sum} → ${afterMgmt.sum}`
                  + `（組合と違い ${Number(MGMT['f-mgmt-pay'])} 増えるのが正しい`
                  + ` / 実際 ${Number(afterMgmt.sum) - Number(beforeMgmt.sum)}）`);
      console.log(`     管理職に支給元の条件は無い = ${await page.evaluate(
        () => typeof mgmtInGross === 'undefined')}`);
      console.log(`     pay_items.management = ${JSON.stringify(afterMgmt.items)}`);

      /* 3j. 管理職を外す＝節ごと消えて中身も消える。教官・審査・組合の側は残ったまま。 */
      await untickRole(page, 'management');
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3j-mgmt-off`);
      const offMgmt = await page.evaluate(() => ({
        shown: document.getElementById('s3-mgmt').offsetParent !== null,
        pay: document.getElementById('f-mgmt-pay').value,
        days: document.getElementById('f-mgmt-days').value,
        instr: document.getElementById('f-instructor').value,
        exam: document.getElementById('f-examiner').value,
        uni: document.getElementById('f-union-pay').value,
        sum: typeof monthlyDetail === 'function' ? monthlyDetail() : null,
        items: (() => { try { return JSON.parse(document.getElementById('f-payitems').value); }
                        catch (e) { return null; } })(),
      }));
      console.log(`     外したあと: 節 = ${offMgmt.shown ? '出' : '—'}`
                  + ` / 額 = '${offMgmt.pay}' / 日数 = '${offMgmt.days}'`
                  + ` / 教官 ${offMgmt.instr}・審査 ${offMgmt.exam}・組合 ${offMgmt.uni} は残っている`
                  + ` / 内訳の合計 ${offMgmt.sum}（${beforeMgmt.sum} に戻るのが正しい）`
                  + ` / pay_items.management = ${JSON.stringify(offMgmt.items && offMgmt.items.management)}`);
      await put(page, { 'f-jobrole': SIMPLE['f-jobrole'] });
      await fillMgmt(page, MGMT);
      await new Promise((r) => setTimeout(r, 200));

      /* 3k. その他の兼務・配属の手当（2026-08-27 その7）。★見たいのは2つ。
             ① 聞いているのが3つだけ（分野・日数・追加報酬）で、部署名・出向先・
                プロジェクト名の欄が1つも無いこと ── 絵で確かめる。
             ② ほかの6つの合計（変動給・その他・職位手当・教官・審査・組合・管理職）が
                1円も増えず、額面も書き換わらないこと ── ログで確かめる。 */
      const beforeNol = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        vari: document.getElementById('f-var-sum').value,
        oth: document.getElementById('f-oth-sum').value,
        cmd: document.getElementById('f-command').value,
        instr: document.getElementById('f-instructor').value,
        exam: document.getElementById('f-examiner').value,
        uni: document.getElementById('f-union-pay').value,
        mgt: document.getElementById('f-mgmt-pay').value,
        sum: typeof monthlyDetail === 'function' ? monthlyDetail() : null,
      }));
      await fillNonline(page, NONLINE);
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3k-nonline`);
      const afterNol = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        vari: document.getElementById('f-var-sum').value,
        oth: document.getElementById('f-oth-sum').value,
        cmd: document.getElementById('f-command').value,
        instr: document.getElementById('f-instructor').value,
        exam: document.getElementById('f-examiner').value,
        uni: document.getElementById('f-union-pay').value,
        mgt: document.getElementById('f-mgmt-pay').value,
        pay: document.getElementById('f-nonline-pay').value,
        days: document.getElementById('f-nonline-days').value,
        sum: typeof monthlyDetail === 'function' ? monthlyDetail() : null,
        /* ★具体名を聞く欄が1つも無いこと（部署名・出向先・プロジェクト名・支給単位・数量）。 */
        asked: ['dept', 'company', 'project', 'label', 'name', 'ratio', 'hours',
                'term', 'reason', 'method', 'qty', 'rate']
          .filter((k) => document.getElementById('f-nonline-' + k)),
        items: (() => { try { return JSON.parse(document.getElementById('f-payitems').value).nonline; }
                        catch (e) { return null; } })(),
      }));
      console.log(`     兼務の額 = ${afterNol.pay} / 関連業務日数 = ${afterNol.days}日`);
      console.log(`     額面 ${beforeNol.gross} → ${afterNol.gross}`
                  + ` / 変動給 ${beforeNol.vari} → ${afterNol.vari}`
                  + ` / その他 ${beforeNol.oth} → ${afterNol.oth}`
                  + ` / 職位手当 ${beforeNol.cmd} → ${afterNol.cmd}`
                  + ` / 教官 ${beforeNol.instr} → ${afterNol.instr}`
                  + ` / 審査 ${beforeNol.exam} → ${afterNol.exam}`
                  + ` / 組合 ${beforeNol.uni} → ${afterNol.uni}`
                  + ` / 管理職 ${beforeNol.mgt} → ${afterNol.mgt}`
                  + `（8つとも動かないのが正しい）`);
      console.log(`     ★額面と比べる内訳の合計 ${beforeNol.sum} → ${afterNol.sum}`
                  + `（管理職と同じで ${Number(NONLINE['f-nonline-pay'])} 増えるのが正しい`
                  + ` / 実際 ${Number(afterNol.sum) - Number(beforeNol.sum)}）`);
      console.log(`     ★聞いていない欄 = ${afterNol.asked.length === 0 ? 'ゼロ（正しい）'
                                            : afterNol.asked.join(',')}`);
      console.log(`     pay_items.nonline = ${JSON.stringify(afterNol.items)}`);

      /* 3l. 兼務・配属を外す＝節ごと消えて中身も消える。ほかの4つは残ったまま。 */
      await untickRole(page, 'nonline');
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3l-nonline-off`);
      const offNol = await page.evaluate(() => ({
        shown: document.getElementById('s3-nonline').offsetParent !== null,
        pay: document.getElementById('f-nonline-pay').value,
        days: document.getElementById('f-nonline-days').value,
        instr: document.getElementById('f-instructor').value,
        exam: document.getElementById('f-examiner').value,
        uni: document.getElementById('f-union-pay').value,
        mgt: document.getElementById('f-mgmt-pay').value,
        sum: typeof monthlyDetail === 'function' ? monthlyDetail() : null,
        items: (() => { try { return JSON.parse(document.getElementById('f-payitems').value); }
                        catch (e) { return null; } })(),
      }));
      console.log(`     外したあと: 節 = ${offNol.shown ? '出' : '—'}`
                  + ` / 額 = '${offNol.pay}' / 日数 = '${offNol.days}'`
                  + ` / 教官 ${offNol.instr}・審査 ${offNol.exam}・組合 ${offNol.uni}`
                  + `・管理職 ${offNol.mgt} は残っている`
                  + ` / 内訳の合計 ${offNol.sum}（${beforeNol.sum} に戻るのが正しい）`
                  + ` / pay_items.nonline = ${JSON.stringify(offNol.items && offNol.items.nonline)}`);
      await put(page, { 'f-jobrole': SIMPLE['f-jobrole'] });
      await fillNonline(page, NONLINE);
      await new Promise((r) => setTimeout(r, 200));

      /* 3m. ★A（2026-08-27 オーナー指摘「なんか変なところに出るよこれ。
             『今月の追加支給額』の下に出すべきじゃない？」）。
             注意は今までどおり**1つだけ**出す。変わったのは出る場所で、
             最後に額を打った欄のすぐ下に出る。ここでは管理職の額で超えさせる。 */
      await put(page, { 'f-mgmt-pay': String(Number(SIMPLE['f-gross']) * 2) });
      await new Promise((r) => setTimeout(r, 300));
      await shoot(page, `${tag}-3m-over-slot`);
      const slot = await page.evaluate(() => ({
        on: ['pd-over', 'pd-over-instr', 'pd-over-exam',
             'pd-over-union', 'pd-over-mgmt', 'pd-over-nonline']
          .filter((id) => !document.getElementById(id).hidden),
        block: typeof missingAll === 'function' ? missingAll().length : -1,
      }));
      console.log(`     ★管理職の額で超えさせたとき: 出ている注意 = ${slot.on.join(',') || '—'}`
                  + `（pd-over-mgmt の1つだけが正しい）`
                  + ` / 送信をふさぐ空欄 = ${slot.block} 件（止めないので 0 が正しい）`);
      /* 内訳の欄を触ったら既定の受け皿へ戻る（受け皿は常に1つだけ）。 */
      await put(page, { 'f-base': String(Number(SIMPLE['f-gross']) + 1000) });
      await new Promise((r) => setTimeout(r, 250));
      const slotBack = await page.evaluate(() => ['pd-over', 'pd-over-instr', 'pd-over-exam',
        'pd-over-union', 'pd-over-mgmt', 'pd-over-nonline']
        .filter((id) => !document.getElementById(id).hidden));
      console.log(`     内訳の欄を触ったあと: 出ている注意 = ${slotBack.join(',') || '—'}`
                  + `（既定の pd-over の1つだけが正しい）`);
      await put(page, { 'f-base': DETAIL['f-base'], 'f-mgmt-pay': MGMT['f-mgmt-pay'] });
      await new Promise((r) => setTimeout(r, 250));

      /* 3n. ★必須が3つ空いたまま、5/5 の確認画面の送信を押す（2026-09-08 に作り直し）。
             2026-08-27 の「常設の『匿名で提出』」は、5ステップ化に合わせてオーナーが
             廃止した ── 下端の帯に残るのは年換算の合計の**表示だけ**で、押す口は
             5/5 の送信ただ1つ。ここで見たいのは3つ。
             ① 足りない欄すべてが赤く囲われ、右横に「未入力」の札が付く
             ② 先頭の欄のある段（3/5）まで本人が運ばれる＝確認の段に居座らせない
                （「押しても何も起きない」に見せない）
             ③ 帯の中に押す物が生き返っていない
             ★押したあとに撮るので、絵には赤い欄が画面の真ん中に写る。 */
      const MISS = ['f-netpay', 'f-contract', 'f-seniority'];
      await put(page, { 'f-netpay': '', 'f-contract': '', 'f-seniority': '' });
      await new Promise((r) => setTimeout(r, 200));
      await goStep(page, 4);                      // 5/5 確認まで歩く
      await new Promise((r) => setTimeout(r, 400));
      await page.evaluate(() => document.getElementById('submit-btn').click());
      await new Promise((r) => setTimeout(r, 700));   // scrollIntoView({behavior:'smooth'}) の着地を待つ
      await shoot(page, `${tag}-3n-miss-jump`);
      const missShot = await page.evaluate(() => {
        const miss = [...document.querySelectorAll('.fld.is-miss')];
        const box = (id) => {
          const e = document.getElementById(id);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return Math.round(r.top + r.height / 2);
        };
        return {
          step: window.PVPayWizard ? window.PVPayWizard.current() : '—',
          onLast: !document.getElementById('s5').hidden,
          bar: !document.getElementById('sticky-submit').hidden,
          total: document.getElementById('sticky-total').textContent.trim(),
          /* ★押す物が帯に戻っていないか（廃止した口が生き返っていないか）。 */
          btnInBar: !!document.querySelector('#sticky-submit button, #sticky-submit a'),
          marked: miss.map((f) => (f.querySelector('input, select') || {}).id || ''),
          tags: miss.map((f) => {
            const t = f.querySelector('.form-label .miss-tag');
            return t ? t.textContent.trim() : '—';
          }),
          focused: (document.activeElement || {}).id || '—',
          /* 赤いのか、金のままなのかを実際の色で見る（クラス名を変えても逃げられない）。 */
          border: getComputedStyle(document.getElementById('f-netpay')).borderColor,
          title: (document.querySelector('#err .fa-title') || { textContent: '—' }).textContent.trim(),
          ul: !!document.querySelector('#err ul'),
          mid: box('f-netpay'),
          half: Math.round(window.innerHeight / 2),
        };
      });
      console.log(`     ★運ばれた先 = ${missShot.step}（期待 s3）`
                  + ` / 確認の段に居座っていない = ${missShot.onLast === false}`);
      console.log(`     下端の帯 = ${missShot.bar ? '出' : '—'} / 年換算の総額 = ${missShot.total}`
                  + ` / 帯の中の押す物 = ${missShot.btnInBar ? '★ある（廃止したはず）' : '無し（正しい）'}`);
      console.log(`     ★赤くなった欄 ${missShot.marked.length} 件（期待 ${MISS.length}）`
                  + ` = ${missShot.marked.join(' / ')}`
                  + ` / 右横の札 = ${missShot.tags.join(' / ')}`);
      console.log(`     ★飛んだ先 = ${missShot.focused}（期待 ${MISS[0]}）`
                  + ` / その欄の枠の色 = ${missShot.border}（赤のはず）`
                  + ` / 画面の中央から ${Math.abs(missShot.mid - missShot.half)}px`);
      console.log(`     ★#err = 「${missShot.title}」`
                  + ` / 箇条書き = ${missShot.ul ? '★出ている（やめたはず）' : '無し'}`);
      await put(page, pick(SIMPLE, 'f-netpay', 'f-contract', 'f-seniority'));
      await new Promise((r) => setTimeout(r, 250));

      // 4. 閉じる＝額面も内訳も残ったまま
      await setDetail(page, false);
      await shoot(page, `${tag}-4-detail-shut`);
      const back = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        base: document.getElementById('f-base').value,
        items: !!document.getElementById('f-payitems').value,
      }));
      console.log(`     閉じたあと: 額面 = ${back.gross}（期待 ${SIMPLE['f-gross']}）`
                  + ` / 基本給 = ${back.base}（期待 ${DETAIL['f-base']}）`
                  + ` / 行 = ${back.items ? '残' : '—'}`);

      /* 4b. ★5/5 の確認（Phase 5）。出すのは**本人が入れた実額**だけ。
             一番上に「支給の内訳（今月）」の横棒と明細、その下に打った欄の読み返し。
             節ごとに「変更する」でその段へ戻る（入れ直させない）。
             ⚠️ 2026-09-09 に「匿名で公開されるイメージ」を廃止した（オーナー指示）。
                あちらは**年額の帯**で、すぐ上の月額と桁が違って別の話に読めた。
                公開の形は REAL PAY 側で見せる（ここで二度説明しない）。 */
      /* ★撮る前に、辻褄の合う1人にしておく。3c〜3l は役割モジュールを順に足していく
         台本なので、ここまで来ると「月 77,800 の人に管理職手当 50,000」という
         あり得ない形で残っている。管理職だけ外し、総支給を内訳と揃えてから撮る
         ── ここで見たいのは版面であって、超過の注意は 3b・3m の2枚が受け持っている。 */
      await untickRole(page, 'management');
      await untickRole(page, 'nonline');
      await new Promise((r) => setTimeout(r, 300));
      /* 総支給は固定の数字で書かない ── 上の台本に1行足すたびに内訳だけが増えて、
         ある日また帯が消える。そのときの内訳の合計をそのまま総支給に写す
         （組合ぶんは monthlyDetail() の側で既に外れている）。 */
      await page.evaluate(() => {
        const g = document.getElementById('f-gross');
        g.value = String(Math.round(monthlyDetail()));
        g.dispatchEvent(new Event('input', { bubbles: true }));
        g.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await new Promise((r) => setTimeout(r, 300));

      await goStep(page, 4);
      await new Promise((r) => setTimeout(r, 700));
      await shoot(page, `${tag}-4b-review`);
      const rv = await page.evaluate(() => {
        const R = document.getElementById('wz-review');
        const comp = R ? R.querySelector('.wz-rev-comp') : null;
        const sec = R ? R.querySelector('.wz-rev-sec') : null;
        return {
          secs: R ? R.querySelectorAll('.wz-rev-sec').length : 0,
          rows: R ? R.querySelectorAll('.wz-rev-row').length : 0,
          edits: R ? R.querySelectorAll('.wz-rev-edit').length : 0,
          segs: R ? R.querySelectorAll('.wz-rev-seg').length : 0,
          bars: comp ? (comp.querySelector('.wz-cbar') || { children: [] }).children.length : 0,
          /* ★内訳が読み返しより**上**にあること（2026-09-09 オーナー指示）。 */
          compFirst: (comp && sec)
            ? !!(comp.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING) : null,
          /* ★廃止した公開イメージが復活していないこと。 */
          pubBox: !!document.getElementById('wz-public'),
          /* 内訳が1区分に潰れていないかを切り分けるための2つ。 */
          sum: typeof monthlyDetail === 'function' ? monthlyDetail() : null,
          gross: document.getElementById('f-gross').value,
        };
      });
      console.log(`     ★入力内容の確認: 節 ${rv.secs} / 行 ${rv.rows} / 「変更する」${rv.edits} 個`
                  + `（節の数と同じが正しい）`);
      console.log(`     ★支給の内訳（今月）: 明細 ${rv.segs} 行 / 帯 ${rv.bars} 欠片`
                  + `（内訳の合計 ${rv.sum} / 総支給 ${rv.gross}）`
                  + ` / 読み返しより上 = ${rv.compFirst}`
                  + `${rv.pubBox ? ' ★廃止した公開イメージが復活している' : ''}`);

      /* 5. 2回目の訪問。savePreset() は送信が通ったときに走るので、ここでは
            直接呼んで同じ状態を作る。
            ★下書き（pv_pay_draft）は「出しきれなかった人」のもの。ここで見たいのは
              先月ちゃんと出した人の2回目なので、提出が通ったときと同じに消す
              （消さないと下書きから再開して、居た段の途中から始まる）。
            ★プリセットは対象月と飛んだ時間を保存しない＝2/5 は空で出るのが正しい。 */
      await page.evaluate(() => {
        if (typeof savePreset === 'function') savePreset();
        if (window.PVPayWizard) window.PVPayWizard.clearDraft();
      });
      await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 900));
      /* ★2回目でも入口の2択から始まる（オーナー決定）。「手で入力」側に
         「前回の内容が入ります」が出ているかを、この1枚で見る。 */
      await shoot(page, `${tag}-5a-second-entry`);
      await startManual(page);
      await shoot(page, `${tag}-5-second`);
      /* 5b. 2回目の 2/5。★飛んだ時間とステイ日数だけは持ち越さない（毎月変わる）。
             打ち直させないもの（会社・職位）と、打ち直してもらうもの（時間）が
             1枚で分かるかを見る。 */
      await goStep(page, 1);
      await shoot(page, `${tag}-5b-second-hours`);
      const sec2 = await page.evaluate(() => ({
        step: window.PVPayWizard ? window.PVPayWizard.current() : '—',
        restore: document.getElementById('restore-bar').offsetParent !== null,
        airline: document.getElementById('f-airline').value,
        pos: document.getElementById('f-position').value,
        block: document.getElementById('f-block').value,
        stay: document.getElementById('f-stay').value,
        fold: document.getElementById('s4-body').hidden,
      }));
      console.log(`     2回目: 段 = ${sec2.step} / 「前回の内容」の知らせ = ${sec2.restore ? '出' : '—'}`);
      console.log(`     ★持ち越す = 会社 '${sec2.airline}'・職位 '${sec2.pos}'`
                  + ` / ★持ち越さない = 飛んだ時間 '${sec2.block}'・ステイ '${sec2.stay}'`
                  + `（この2つが空なのが正しい）`);
      console.log(`     「4. 契約と税」は要約1行に畳まれている = ${sec2.fold}（2回目は畳むのが正しい）`);
      await goStep(page, 0);

      // 6. 結果パネル（RPC 不要。表示の検品だけ）
      const ok = await page.evaluate((d) => {
        if (typeof renderResult !== 'function') return 'renderResult が無い';
        try {
          renderResult(d, { currency: 'AED', airline: 'emirates', position: 'cap', fleet: 'b777', period_year: 2026, period_month: 7 });
          document.getElementById('form-wrap').style.display = 'none';
          return true;
        } catch (e) { return String(e && e.message || e); }
      }, RESULT);
      if (ok !== true) console.log('  ⚠ 結果パネル: ' + ok);
      else { await new Promise((r) => setTimeout(r, 350)); await shoot(page, `${tag}-6-result`); }
      await page.close();

      /* 7. DEEP PAY の説明から「給与内訳を追加する」で来たとき（#pay-detail）。
            ★着いた瞬間に内訳の欄は出ない。誰が来ても必ず 1/5 から始まるうえ、
              飛んだ時間は前回の値を持ち越さないので、報酬の段はまだ先。
              ここでやっているのは「先に開いておく」ことなので、2枚で見る。
              7a = 着地（入口の2択を越えて 1/5 に居る）
              7b = 1/5・2/5 を埋めて 3/5 に着いたところ（もう開いた状態で現れる） */
      const dp = await open(url + '#pay-detail', w, theme);
      await shoot(dp, `${tag}-7a-detail-link`);
      await put(dp, pick(SIMPLE, 'f-airline', 'f-position', 'f-fleet', 'f-jobrole', 'f-age'));
      await goStep(dp, 1);
      await put(dp, pick(SIMPLE, 'f-block', 'f-stay'));
      await goStep(dp, 2);
      await new Promise((r) => setTimeout(r, 350));
      await shoot(dp, `${tag}-7b-detail-open`);
      const arrived = await dp.evaluate(() => ({
        open: document.getElementById('pay-detail').open,
        base: document.getElementById('f-base').getBoundingClientRect().height > 0,
      }));
      console.log(`     #pay-detail: くわしく入れる=${arrived.open ? '開' : '閉'} / 内訳の欄=${arrived.base ? '出' : '—'}`);
      await dp.close();
    }
  }
}

await browser.close();
console.log('\n保存先: ' + dir);

/* ★同じ回（pay-r1）へ撮り直すと、前の版が作った名前の絵がそのまま残る。
   2026-09-11、5週間前の -3-result.png を今日の絵だと思って読み、
   「undefined年undefined月」「上位 NaN%」を今の不具合として報告しかけた。
   絵には日付が写らないので、見る側には古いかどうかが分からない。名指しで言う。 */
const stale = fs.readdirSync(dir).filter((f) => f.endsWith('.png') && !shotNames.has(f));
if (stale.length) {
  console.log(`\n⚠ この回で撮っていない絵が ${stale.length} 枚 残っている（前の版の置き土産。読むと古い画面を今の画面だと思う）:`);
  console.log('  ' + stale.sort().join('\n  '));
  console.log('  消すなら: rm ' + JSON.stringify(dir) + '/*.png してから撮り直す');
}
