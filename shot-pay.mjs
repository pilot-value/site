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
  'f-airline': 'emirates', 'f-position': 'cap', 'f-fleet': 'b777', 'f-jobrole': 'line,instructor',
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
  'f-base': '36000', 'f-guar': '80', 'f-command': '3200',
  'f-profit': '18000', 'f-pension': '12',
};
/* 変動給・その他の現金手当。会社ごとに名前も本数も違うので行で足す。
   ★合計が総支給（f-gross）を超えないようにしておく。超えると注意の1行が出て、
     それはそれで正しい絵だが「普通の状態」の見本ではなくなる。 */
const VAR = [
  { amount: '9800', basis: 'block', label: 'Flight Pay', rule: 'AED 113 / Block Hour' },
  { amount: '1200', basis: 'reserve', label: 'Standby Allowance', rule: '' },
];
const OTH = [{ amount: '900', label: 'Transport Allowance' }];

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
  // 任意項目はチップを押して初めて欄が出る。検品では全部開けて溢れを見る。
  await page.evaluate(() => {
    for (const c of [...document.querySelectorAll('.chip[data-open]')]) c.click();
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
    set('.pd-label', it.label); set('.pd-rule', it.rule);
  }
  pdSync();
}, kind, list);

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

      // 4. 閉じる＝額面も内訳も残ったまま
      await setDetail(page, false);
      await shoot(page, `${tag}-4-detail-shut`);
      const back = await page.evaluate(() => ({
        gross: document.getElementById('f-gross').value,
        base: document.getElementById('f-base').value,
        items: !!document.getElementById('f-payitems').value,
      }));
      console.log(`     閉じたあと: 額面 = ${back.gross}（期待 ${SIMPLE['f-gross']}）`
                  + ` / 固定・保証給 = ${back.base}（期待 ${DETAIL['f-base']}）`
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
