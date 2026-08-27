/* pay-report.html の検品用スクショ。
   フォームは未ログインでも最初から見える（ログインは送信のときだけ）。
   ただし S2〜S4 は埋めるまで出ないので、1枚目は「S1 だけ」が正しい状態。
   結果パネルは renderResult() を直接呼ぶ＝RPC が本番に無くても見た目は確認できる。
   使い方: node shot-pay.mjs        （出力は ./temporary screenshots/ ではなく round ディレクトリ）
           node shot-pay.mjs open detail   撮らずに、見える窓で #pay-detail を開く

   撮る状態（2026-08-13 に 3〜5 を追加、同日その2で 0 を追加）:
     0  entry       開いた直後＝入口の2択（明細から自動入力／手で入力）だけ
     0b payslip     明細を選んだ状態＝ステップ 1/2（読まずに手で入力する逃げ道つき）
     1  empty       手入力に入った直後＝S1 だけ（上に明細の細い帯が残る）
     2 simple       かんたん入力（通貨＋その月の額面）で送信まで開いた状態
     3 detail-open  「＋給与の内訳を追加」を開いた状態
                    ★2026-08-26 から、額面の欄は**本人の入力のまま**（読み取り専用にしない）。
                      変動給・その他の現金手当は行で足す
     3b detail-over 内訳の合計が額面を超えた状態＝注意の1行が出る（送信は止めない）
     3c instructor  教官・訓練の手当を埋めた状態（§1で教官を選んだ人にだけ出る節）
                    ★変動給・その他・額面のどれも増えていないことをログで見る
     3d instructor-off 教官を外した状態＝節ごと消えて中身も消える
     3e examiner    審査・査察の手当を埋めた状態（§1で審査を選んだ人にだけ出る節）
                    ★教官の額まで含めて、どの合計も増えていないことをログで見る
     3f examiner-off 審査を外した状態＝節ごと消えて中身も消える
     3g union      組合・乗員代表の手当を埋めた状態（§1で組合を選んだ人にだけ出る節）
                   ★支給元を「組合」にしてあるので、額面との突き合わせ（#pd-over）が
                     動かないこともログで見る（会社の明細に無いお金なので）
     3h union-off  組合を外した状態＝節ごと消えて中身も消える（教官・審査は残る）
     3i mgmt       管理・マネジメントの手当を埋めた状態（§1で管理職を選んだ人にだけ出る節）
                   ★組合とは逆に、この額は会社が払う＝額面の中にある。だから
                     内訳の合計（#pd-over の材料）には**足される**ことをログで見る
     3j mgmt-off   管理職を外した状態＝節ごと消えて中身も消える（教官・審査・組合は残る）
     3k nonline    その他の兼務・配属の手当を埋めた状態（§1で兼務・配属を選んだ人にだけ出る節）
                   ★聞くのは3つだけ（分野・日数・追加報酬）。部署名も出向先も聞かない
     3l nonline-off 兼務・配属を外した状態＝節ごと消えて中身も消える（ほかの4つは残る）
     3m over-slot  ★超過の注意が「打った欄のすぐ下」に出る（2026-08-27 オーナー指摘
                   「なんか変なところに出るよこれ」）。管理職の額で超えさせて、
                   pd-over-mgmt だけが出て既定の pd-over が出ないことをログで見る
     3n sticky-miss ★常設の「匿名で提出」を途中で押した状態＝足りない必須の欄まで飛んで
                   赤く囲い、右横に「未入力」の札が出る（2026-08-27 オーナー指示で
                   箇条書きから作り直した。年換算の総額もバーに一緒に出ている）
     4 detail-shut  閉じた状態 ★額面も内訳も消えずに残っている
     5 second       2回目の訪問（プリセットあり）★飛んだ時間が空なので §3 以降は出ない
     6 result       送信後の結果パネル */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* 自分の位置から解く。絶対パスを書くと macOS のユーザー名が公開リポジトリに載る */
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const ROUND = process.argv[2] || 'r1';
const dir = path.join(ROOT, 'temporary screenshots', `pay-${ROUND}`);
fs.mkdirSync(dir, { recursive: true });

/* ★見える窓で開いたままにする（撮らない）。ほかの shot-*.mjs と同じ open。
     node shot-pay.mjs open            手入力の入口から
     node shot-pay.mjs open detail     DEEP PAY の「給与内訳を追加する」で来たとき
     node shot-pay.mjs open detail en  英語で
   このページはログイン不要なので素の URL でも出るが、ほかの画面と同じ渡し方に揃える。 */
if (process.argv.includes('open')) {
  const lang = process.argv.includes('en') ? 'en' : 'ja';
  const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}pay-report.html`
            + (process.argv.includes('detail') ? '#pay-detail' : '');
  const b = await puppeteer.launch({
    headless: false, defaultViewport: null, args: ['--no-sandbox', '--window-size=1440,1000'],
  });
  const [pg] = await b.pages();
  await pg.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  console.log(`見える窓で開いた（${url}）。閉じるとこのコマンドも終わる。`);
  /* ★時間で待たない。待つのは「窓が閉じられたこと」＝接続が切れたこと
     （時間で待つと、誰も触っていないのに 30 秒で勝手に消える）。 */
  await new Promise((r) => b.on('disconnected', r));
  process.exit(0);
}

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

async function shoot(page, name) {
  const out = path.join(dir, `${name}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log('  → ' + path.basename(out));
}

async function open(url, width, theme) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  if (theme) {
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('pv-theme', t); } catch (e) {} }, theme);
  }
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  /* ja と en は同一オリジン。前の言語が savePreset() した内容が残っていると
     「開いた直後＝S1 だけ」の画面を撮れない。 */
  await page.evaluate((t) => {
    localStorage.clear();
    try { localStorage.setItem('pv-theme', t); } catch (e) {}
  }, theme || 'light');
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
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

/* 段階表示を順に開けながら埋める。まとめて入れると「生えていく様子」ではなく
   最終形しか撮れないので、ゲートの順に3回に分ける。 */
async function fillSimple(page) {
  await put(page, pick(SIMPLE, 'f-airline', 'f-position', 'f-fleet', 'f-jobrole', 'f-age'));
  await put(page, pick(SIMPLE, 'f-block', 'f-stay'));
  await put(page, pick(SIMPLE, 'f-currency', 'f-gross', 'f-netpay', 'f-bonus-mo',
                               'f-perdiem', 'f-housing', 'f-housing-amt'));
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
      if (e && v) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
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
      await shoot(page, `${tag}-1-empty`);
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
        submit: document.getElementById('submit-block').offsetParent !== null,
      }));
      console.log(`     超えさせたとき: 注意 = ${over.over ? '出' : '—'}`
                  + ` / 送信ボタン = ${over.submit ? '出' : '—'}`);
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
        submit: document.getElementById('submit-block').offsetParent !== null,
      }));
      console.log(`     ★管理職の額で超えさせたとき: 出ている注意 = ${slot.on.join(',') || '—'}`
                  + `（pd-over-mgmt の1つだけが正しい）`
                  + ` / 送信ボタン = ${slot.submit ? '出' : '—'}（止めないのが正しい）`);
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

      /* 3n. ★B（2026-08-27 オーナー指示 → 同日その2で作り直し）。常設の「匿名で提出」を、
             必須が3つ空いている状態で押す。箇条書きは組まず、足りない欄すべてを赤く囲って
             右横に「未入力」を出し、先頭の欄まで運ぶ。
             ★バーには「年換算の総額」も一緒に出ている（押す前に金額が見えている）。
             ★押したあとに撮るので、絵には赤い欄が画面の真ん中に写る。 */
      const MISS = ['f-netpay', 'f-contract', 'f-seniority'];
      await put(page, { 'f-netpay': '', 'f-contract': '', 'f-seniority': '' });
      await new Promise((r) => setTimeout(r, 200));
      await page.evaluate(() => document.getElementById('sticky-btn').click());
      await new Promise((r) => setTimeout(r, 700));   // scrollIntoView({behavior:'smooth'}) の着地を待つ
      await shoot(page, `${tag}-3n-sticky-miss`);
      const missShot = await page.evaluate(() => {
        const miss = [...document.querySelectorAll('.fld.is-miss')];
        const box = (id) => {
          const e = document.getElementById(id);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return Math.round(r.top + r.height / 2);
        };
        return {
          bar: !document.getElementById('sticky-submit').hidden,
          total: document.getElementById('sticky-total').textContent.trim(),
          btn: document.getElementById('sticky-btn').textContent.trim(),
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
          steps: ['s2', 's3', 's4'].map((id) => !document.getElementById(id).hidden),
          block: !document.getElementById('submit-block').hidden,
        };
      });
      console.log(`     常設バー = ${missShot.bar ? '出' : '—'}`
                  + ` / 年換算の総額 = ${missShot.total} / 文言 = ${missShot.btn}`);
      console.log(`     ★赤くなった欄 ${missShot.marked.length} 件（期待 ${MISS.length}）`
                  + ` = ${missShot.marked.join(' / ')}`
                  + ` / 右横の札 = ${missShot.tags.join(' / ')}`);
      console.log(`     ★飛んだ先 = ${missShot.focused}（期待 ${MISS[0]}）`
                  + ` / その欄の枠の色 = ${missShot.border}（赤のはず）`
                  + ` / 画面の中央から ${Math.abs(missShot.mid - missShot.half)}px`);
      console.log(`     ★#err = 「${missShot.title}」`
                  + ` / 箇条書き = ${missShot.ul ? '★出ている（やめたはず）' : '無し'}`);
      console.log(`     押したあとの段 = ${missShot.steps.map((v) => (v ? '出' : '—')).join('')}`
                  + `（§2〜§4 は全部出る）`
                  + ` / 送信ボタンの枠 = ${missShot.block ? '出' : '—'}`
                  + `（この場面では先に出ていたもの。この経路が開けたのではない`
                  + ` ── revealSteps() が submit-block を触らないことは db/test-form-contract.mjs が見る）`);
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

      /* 5. 2回目の訪問。savePreset() は送信が通ったときに走るので、ここでは
            直接呼んで同じ状態を作る。★プリセットは対象月と飛んだ時間を
            保存しないので、§3 以降は出ないのが正しい。 */
      await page.evaluate(() => { if (typeof savePreset === 'function') savePreset(); });
      await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 900));
      /* ★2回目でも入口の2択から始まる（オーナー決定）。「手で入力」側に
         「前回の内容が入ります」が出ているかを、この1枚で見る。 */
      await shoot(page, `${tag}-5a-second-entry`);
      await startManual(page);
      await shoot(page, `${tag}-5-second`);
      const steps = await page.evaluate(() => ['s1', 's2', 's3', 's4', 'submit-block']
        .map((id) => id + '=' + (document.getElementById(id).offsetParent !== null ? '出' : '—')).join(' '));
      console.log(`     2回目: ${steps}`);

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
            ★着いた瞬間に内訳の欄は出ない。段階表示が §1・§2 を先に求めるうえ、
              飛んだ時間は前回の値を持ち越さないので、誰が来ても必ず §1 から。
              ここでやっているのは「先に開いておく」ことなので、2枚で見る。
              7a = 着地（入口の2択を越えてフォームの先頭に居る）
              7b = §1・§2 を埋めて §3 が出たところ（もう開いた状態で現れる） */
      const dp = await open(url + '#pay-detail', w, theme);
      await shoot(dp, `${tag}-7a-detail-link`);
      await put(dp, pick(SIMPLE, 'f-airline', 'f-position', 'f-fleet', 'f-jobrole', 'f-age'));
      await put(dp, pick(SIMPLE, 'f-block', 'f-stay'));
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
