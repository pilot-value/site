/* shot-value.mjs — 市場価値レポート（my-value.html）を localhost の実ページで撮る。

   shot-tracker.mjs と同型。my_pay_reports() はオーナーが SQL を流すまで本番に
   入らないので、Supabase クライアントごと差し替えて合成データで実物を描かせる。
   ★ ここで使う数字は全部でたらめ。実物の明細の数値はこのリポジトリに1つも無い。

   実行: node shot-value.mjs <scene> <lang> <theme>
     scene: empty  … 0件（★2026-08-25 に作り直した最初の画面）
            empty-nostat … 0件 かつ db/pay-rows.sql を貼る前＝数字カードが1枚も出ない
            empty-ready  … 0件 だが先に内訳を出した人＝DEEP PAY の札が「✓」側になる
            one    … 1件（折れ線が点1つ）
            many   … 5件・同社連続（推移・リマインドON・§6 は先月との差）
            thin   … 明細由来の列が無い（手入力だけ）＝§2 Duty無し / §4 手取り無し
            nobd   … 内訳が読めない＝§3 と §5 が枠だけになる
            simple … かんたん入力で手当を1つも入れなかった月＝§3 と §4 が「見本（ぼかし）」
            hand   … かんたん入力の実態（額面1本＋パーディアム＋住宅手当＋今月の賞与）
                     ＝§3 の円グラフが「入っている分だけ色＋残りは灰色」で出る
            both   … ★2026-08-26 以降の既定。額面と内訳の両方が入っている
                     ＝§3 は内訳の色が全部出て、説明できない残りだけが灰色
            new    … many を ?new=1 で開く（文言だけ変わることの確認）
            gap    … 同社だが間隔があいている（2月と6月）＝§6 に「4ヶ月あいています」
            job    … 転職（ZIPAIR 3枚 → エミレーツ 1枚）＝§6 は差を出さず、
                     §7 の線から前職の月が落ちる
            cur    … 同社で支給通貨が変わった＝§6 は金額を出さず時間だけ
            total  … 会社も通貨もまたぐ8枚（ZIPAIR円建て3枚 → エミレーツAED建て5枚）
                     ＝§7b の累計に全部入る（§7 の線は同社5点のまま）
            partial… 8枚中3枚しか手取り・控除が読めていない
                     ＝§7b に「8枚中 3枚」の断り書きが出る
     lang : ja | en
     theme: dark | light
   保存先は screenshot.mjs と同じ ./temporary screenshots/

   第6引数に open を付けると、撮らずに**見える窓で開いたまま**にする。
     node shot-value.mjs hand ja dark 1440 open
   自分の目で確かめたいとき用。窓を閉じると終わる。

   gate を付けると、撮る前に左メニューの DEEP PAY を押して説明を出す。
     node shot-value.mjs many ja dark 1440 gate
   DEEP PAY の札（「N / 100人」）はここでしか画面に出ない。open と一緒にも書ける。
*/
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scene = process.argv[2] || 'many';
const lang  = process.argv[3] || 'ja';
const theme = process.argv[4] || 'dark';
/* 第5引数＝ビューポート幅。pay-viz.css の @media(max-width:520px) で
   統計行が 4-up → 2-up に落ちるところは、幅を変えないと確かめられない。 */
const vw    = Number(process.argv[5]) || 1440;
// 第6引数 open ＝撮らずに見える窓で開いたままにする（自分の目で見る用）
const open  = process.argv.includes('open');
/* gate ＝撮る前に左メニューの DEEP PAY を押して説明を出す（札の「N / 100人」を見る用）。
   ★ここでしか見えない。札は押して初めて出る要素の中にある。 */
const gate  = process.argv.includes('gate');

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const label = `value-${scene}-${lang}-${theme}` + (vw !== 1440 ? `-${vw}` : '');
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}my-value.html` +
            (scene === 'new' ? '?new=1' : '');

/* ★ headless:'new' はこの環境で page.screenshot() が永久に返ってこない
   （shot-tracker.mjs に実測の経緯あり）。chrome-headless-shell を使う。 */
const browser = await puppeteer.launch(open
  ? { headless: false, defaultViewport: null, args: ['--no-sandbox', `--window-size=${vw},1000`] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = (await browser.pages())[0] || await browser.newPage();
if (!open) await page.setViewport({ width: vw, height: 1000 });

/* ★ setRequestInterception は使わない（CDP デッドロック。shot-tracker.mjs 参照）。
   CDN の supabase-js に上書きさせない目的は defineProperty で達成する。 */
await page.evaluateOnNewDocument((scene, theme) => {
  localStorage.setItem('pv-theme', theme);
  localStorage.removeItem('pv_unlock_expiry');

  const UID = '00000000-0000-4000-8000-00000000a001';
  const FX = 40.8;                                  // AED → JPY（合成）
  /* ★ annual_total_orig は「毎月の支給の合計 × 12 ＋ 賞与」から作る。
     手で別の数字を置くと、内訳ドーナツの合計と時給の分子が画面上で食い違って
     見え、レイアウトの検分ができなくなる（DB の pv_annual_total と同じ組み方）。
     flight_variable_pay は other_allowance の内訳なので足さない。 */
  const mk = (y, m, over = {}) => {
    const r = Object.assign({
      airline: 'emirates', airline_other: null, position: 'cap', fleet: 'b777',
      job_role: null, base_iata: 'DXB',
      period_year: y, period_month: m, period_ym: y * 12 + m,
      currency: 'AED', fx_to_jpy: FX, fx_to_usd: 0.272,
      net_pay_actual: 54600, deduction_total: 3600,
      base_pay: 25500, command_pay: 11000, housing_type: 'allowance', housing_amount: 12000,
      flight_variable_pay: 5800, per_diem: 4200, transport: 1500, other_allowance: 8200,
      bonus_annual: 0, profit_share_annual: 0,
      block_hours: 86.5, duty_hours: 158.2, night_hours: 12.4, credit_hours: null,
      /* ★ 年をまたぐシーン（total / partial は 2025年11月から始まる）があるので
         '2026-0'+m の決め打ちにしない。11月・12月で Invalid Date になり、
         §1 の「登録日」が壊れて画面の検分ができなくなる。 */
      source: 'payslip', verify_level: 1,
      created_at: y + '-' + String(m).padStart(2, '0') + '-05T00:00:00Z'
    }, over);
    const monthly = r.base_pay + r.command_pay +
                    (r.housing_type === 'allowance' ? r.housing_amount : 0) +
                    r.transport + r.other_allowance + r.per_diem;
    r.annual_total_orig = Math.round(monthly * 12 + r.bonus_annual);
    /* 年初来の「課税」支給額はパーディアム（非課税の実費補填）を含まない。
       ★ ここを monthly × 経過月にすると、§4 の2つの年収ペース
         （累計÷経過月×12 と 月額×12）が偶然ぴったり一致してしまい、
         「作り方が違う」という注記が確かめられない画面になる。 */
    if (!('ytd_taxable' in over)) {
      r.ytd_taxable = Math.round((monthly - (r.per_diem || 0)) * r.period_month);
    }
    /* ★ 行が持っているレートで換算する。ここを定数 FX にすると、通貨違いの行
       （job の円建て・cur の米ドル建て）だけ年額と月額が桁で食い違う。 */
    r.annual_total_jpy  = Math.round(r.annual_total_orig * r.fx_to_jpy);
    r.annual_total_usd  = Math.round(r.annual_total_orig * r.fx_to_usd);
    r.net_annual_jpy    = Math.round(r.annual_total_jpy * 0.99);   // 湾岸なので税はほぼ無い
    r.usd_per_block_hour = +((r.annual_total_usd / 12 - r.per_diem * r.fx_to_usd) / r.block_hours).toFixed(1);
    return r;
  };

  // 段0 より前に投稿された行＝明細由来の7列が null。ここが「枠だけ出る」経路。
  const THIN = { net_pay_actual: null, ytd_taxable: null, deduction_total: null,
                 duty_hours: null, night_hours: null, credit_hours: null, source: 'web' };
  // 内訳が1つも読めなかった行＝ §3 ドーナツと §5 構造が枠だけになる
  const NOBD = { base_pay: null, command_pay: null, housing_amount: null, housing_type: null,
                 flight_variable_pay: null, per_diem: null, transport: null, other_allowance: null };

  const MANY = [
    mk(2026, 2, { other_allowance: 6100,  flight_variable_pay: 3900, block_hours: 74.0, duty_hours: 141.0, net_pay_actual: 52400 }),
    mk(2026, 3, { other_allowance: 9400,  flight_variable_pay: 7000, block_hours: 91.2, duty_hours: 163.4, net_pay_actual: 55700 }),
    mk(2026, 4, { other_allowance: 5600,  flight_variable_pay: 3400, block_hours: 68.5, duty_hours: 128.9, net_pay_actual: 51900 }),
    mk(2026, 5, { other_allowance: 10200, flight_variable_pay: 7800, block_hours: 88.1, duty_hours: 155.7, net_pay_actual: 56600 }),
    mk(2026, 6)
  ];
  /* 前職＝円建て。§6/§7 が会社で絞れているかは、通貨も桁も違う行を
     混ぜたときにしか見えない（絞れていなければ AED と円が同じ線に乗る）。 */
  const JP = {
    airline: 'zipair', airline_other: null, base_iata: 'ITM',
    currency: 'JPY', fx_to_jpy: 1, fx_to_usd: 0.0068,
    base_pay: 1050000, command_pay: 180000, housing_type: 'allowance', housing_amount: 60000,
    flight_variable_pay: 210000, per_diem: 48000, transport: 22000, other_allowance: 260000,
    net_pay_actual: 1360000, deduction_total: 260000, block_hours: 71.5, duty_hours: 139.0
  };
  // 同じ会社で支給通貨が変わった月（ベース移動・契約の巻き直しで実際に起きる）
  const USD = {
    currency: 'USD', fx_to_jpy: 152, fx_to_usd: 1,
    base_pay: 6900, command_pay: 3000, housing_amount: 3270,
    flight_variable_pay: 1580, per_diem: 1140, transport: 410, other_allowance: 2230,
    net_pay_actual: 14870, deduction_total: 980, block_hours: 88.1, duty_hours: 155.7
  };

  const SCENES = {
    /* ★2026-08-25、まだ給与を1件も出していない人の画面を作り直した。
       empty 系はどれも「レポート0件」で、違うのは pv_pay_rows() が何を返すかだけ。
         empty        … 数え上げが返ってくる（サーバを貼り替えた後）
         empty-nostat … 数え上げが返らない（db/pay-rows.sql をまだ貼っていない）
                        ＝帯の1行と数字カードが丸ごと消える。0 を並べない、を絵で確かめる
         empty-ready  … 先に内訳まで出してくれた人（DEEP PAY の札が「✓」側になる） */
    empty: [],
    'empty-nostat': [],
    'empty-ready': [],
    one:   [mk(2026, 6)],
    many:  MANY,
    new:   MANY,
    gap:   [MANY[0], mk(2026, 6)],
    job:   [mk(2026, 2, JP), mk(2026, 3, JP), mk(2026, 4, JP), mk(2026, 6)],
    cur:   [mk(2026, 5, USD), mk(2026, 6)],
    thin:  [mk(2026, 6, THIN)],
    /* §7b 累計。会社も通貨もまたぐ8枚（ZIPAIR 円建て3枚 → エミレーツ AED 建て5枚）。
       ★ このシーンだけ §7 の線と §7b の線で点の数が変わる（線は同社5点・
         累計は全社8点）。会社の壁が「比較にだけ効いて足し算には効かない」
         ことは、これを並べて見ないと確かめられない。 */
    total: [mk(2025, 11, JP), mk(2025, 12, JP), mk(2026, 1, JP)].concat(MANY),
    /* 8枚中3枚しか手取り・控除が読めていない（残りは手入力の月）。
       「8枚中 3枚」の断り書きと、点が3つしかない折れ線が出る。 */
    partial: [mk(2025, 11, JP), mk(2025, 12, Object.assign({}, JP, THIN)),
              mk(2026, 1, Object.assign({}, JP, THIN))].concat(
              MANY.map((r, i) => i >= 3 ? r : Object.assign({}, r, THIN))),
    // NOBD だけだと annual_total_orig が 0 になって時給まで消えるので、
    // 「年額は分かるが内訳が読めない」形にする（実際に起きるのはこちら）。
    nobd:  [Object.assign(mk(2026, 6), NOBD)],
    /* かんたん入力（2026-08-12 以降の既定）＝ その月の額面1本だけ。
       内訳も明細由来の列も無く、保証時間だけ書いてある。
       → §3 支給構成 と §4 手取り が「見本（ぼかし）」になる唯一の経路。
       ★ annual_total_orig は mk() が内訳から作るので、ここで額面×12＋賞与に
         上書きする（サーバの pv_annual_total が総支給を優先するのと同じ）。 */
    simple: [(function () {
      const r = mk(2026, 6, Object.assign({}, THIN, NOBD, {
        gross_monthly: 54250, guaranteed_hours: 75, bonus_annual: 130000
      }));
      r.annual_total_orig = 54250 * 12 + 130000;
      r.annual_total_jpy = Math.round(r.annual_total_orig * r.fx_to_jpy);
      r.annual_total_usd = Math.round(r.annual_total_orig * r.fx_to_usd);
      r.net_annual_jpy = Math.round(r.annual_total_jpy * 0.99);
      r.usd_per_block_hour = +((r.annual_total_usd / 12) / r.block_hours).toFixed(1);
      return r;
    })()],
    /* かんたん入力の実態（2026-08-13 以降）。額面1本だが、パーディアム・住宅・
       今月の賞与は全員が聞かれる欄なので入っている。基本給だけが分からない。
       → §3 は「入っている分だけ色を付け、説明できない残りを灰色」で出る。
       ★このシーンでは「基本給が総支給に占める割合」の行が出てはいけない
         （基本給が分かっていないので 0% と刷ることになる）。 */
    hand: [(function () {
      const r = mk(2026, 6, Object.assign({}, THIN, NOBD, {
        gross_monthly: 54250, guaranteed_hours: 75, bonus_annual: 130000,
        per_diem: 4200, housing_type: 'allowance', housing_amount: 12000, bonus_month: 6000
      }));
      r.annual_total_orig = (54250 - 6000) * 12 + 130000;   // サーバの pv_annual_total と同じ組み方
      r.annual_total_jpy = Math.round(r.annual_total_orig * r.fx_to_jpy);
      r.annual_total_usd = Math.round(r.annual_total_orig * r.fx_to_usd);
      r.net_annual_jpy = Math.round(r.annual_total_jpy * 0.99);
      r.usd_per_block_hour = +((r.annual_total_usd / 12) / r.block_hours).toFixed(1);
      return r;
    })()],
    /* ★2026-08-26、フォームを作り直して**額面と内訳が両方入る**ようになった。
       これがこれから来る行の形。hand との違いは基本給が分かっていること
       ＝§3 に「基本給が総支給に占める割合」の行が出る（partial が false）。
       灰色は「説明できない残り」だけ。ここが総支給いっぱいに膨らんでいたら、
       内訳を入れたのに拾えていない＝pay-viz の segments が壊れている。
       ★年換算は総支給ベース。内訳を足さない（サーバの pv_annual_total と同じ）。 */
    both: [(function () {
      const r = mk(2026, 6, Object.assign({}, THIN, {
        gross_monthly: 57000, guaranteed_hours: 75, bonus_annual: 130000, bonus_month: 0,
        /* ★保証給（2026-08-26）。基本給とは別の切れが出ることを、この1枚で見る。
           灰色に落ちていたら pay-viz の segments に guarantee を足し忘れている。 */
        base_pay: 20000, guarantee_pay: 3000, command_pay: 3200,
        /* ★教官・訓練の手当（2026-08-26 その3）。other_allowance には**入っていない**
           （別の入れ物）。ここが灰色に混ざっていたら pay-viz の segments に
           instructor を足し忘れている。 */
        instructor_pay: 2200,
        flight_variable_pay: 11000, other_allowance: 11900,
        per_diem: 4200, transport: 0,
        housing_type: 'allowance', housing_amount: 12000,
      }));
      r.annual_total_orig = 57000 * 12 + 130000;
      r.annual_total_jpy = Math.round(r.annual_total_orig * r.fx_to_jpy);
      r.annual_total_usd = Math.round(r.annual_total_orig * r.fx_to_usd);
      r.net_annual_jpy = Math.round(r.annual_total_jpy * 0.99);
      r.usd_per_block_hour = +((r.annual_total_usd / 12) / r.block_hours).toFixed(1);
      return r;
    })()]
  };

  const REPORTS = SCENES[scene] || [];
  const OPTIN = { on: scene === 'many' || scene === 'new' };

  /* ★鍵が無い人にも来る数え上げ（2026-08-25 オーナー判断）。
     ⚠️ 絵を見るための**見本**であって、本番の値そのものではない。
        2026-08-26 に `node db/usage.mjs --all` の「REAL PAY の画面に出る数」を写した
        （オーナーが動作確認ぶんを本番から消したあとの実測）。
        **腐る。** 写す前にもう一度その節を走らせること。
        分子を大きく作ると、本番に無い絵を見ることになる。 */
  const ST_LOCK = { reports: 27, month: 22, airlines: 12, contributors: 17 };
  const PAY_ROWS = {
    'empty-nostat': { ok: true, state: 'locked', rows: [] },
    'empty-ready':  { ok: true, state: 'locked', rows: [], stats: ST_LOCK,
                      give: { basic: true, detailed: true, payslip: false } }
  }[scene] || { ok: true, state: 'locked', rows: [], stats: ST_LOCK,
                give: { basic: false, detailed: false, payslip: false } };

  const RPC = {
    my_pay_reports: () => ({
      ok: true, reports: REPORTS,
      report_count: REPORTS.length,
      streak_months: REPORTS.length,
      /* ★1件も出していない人に鍵は無い。ここを常に立てると、
         左メニューの REAL PAY が開いた見た目になって本番と食い違う。 */
      access_until: REPORTS.length
        ? new Date(Date.now() + 62 * 86400000).toISOString() : null,
      badge: 'silver', badge_state: 'active',
      mail_optin: OPTIN.on, email_opt_in: OPTIN.on,
      pay_day_of_month: 5
    }),
    /* 1件も出していない人の画面だけが引く。件数・社数・直近1ヶ月ぶん・出した人数を返す。 */
    pv_pay_rows: () => PAY_ROWS,
    /* ★札の口（2026-08-26）。数を渡されない画面 ── 給与を1件以上出した人の
       マイレポート・設定・待遇アンケート ── で、DEEP PAY を押したときだけ引かれる。
       ここは pv_pay_rows と同じ ST_LOCK を返す。**別の数を書かない**
       （画面によって違う数が出る、まさにその壊れ方を絵で見逃す）。 */
    pv_give_progress: () => ({
      ok: true, contributors: ST_LOCK.contributors, give: PAY_ROWS.give
    }),
    // 本番と同じく、オンにすると親（email_opt_in）も一緒に立てて返す
    set_mail_optin: (a) => {
      OPTIN.on = !!(a && a.p_on);
      return { ok: true, mail_optin: OPTIN.on, email_opt_in: OPTIN.on || false };
    }
  };

  // 差し替えクライアント。my-value.html / currency.js / lang-toggle.js が実際に
  // 呼ぶ形（thenable なチェーン）だけを満たす最小の作り。
  function q(rows) {
    const o = {
      data: rows, error: null,
      select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
      update: () => o, insert: () => o,
      single: async () => ({ data: Array.isArray(rows) ? rows[0] : rows, error: null }),
      maybeSingle: async () => ({ data: Array.isArray(rows) ? (rows[0] || null) : rows, error: null }),
      then: (res) => res({ data: Array.isArray(rows) ? rows : [rows].filter(Boolean), error: null })
    };
    return o;
  }
  const FAKE = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: UID, email: 'pilot@example.com' } } } }),
      getUser:    async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
      signOut:    async () => ({ error: null })
    },
    from: (t) => {
      if (t === 'profiles') return q([{
        id: UID, name: 'Sample Pilot', email: 'pilot@example.com',
        company: 'Emirates', position: 'captain', email_opt_in: OPTIN.on
      }]);
      return q([]);
    },
    rpc: async (name, a) => ({ data: RPC[name] ? RPC[name](a) : { ok: true }, error: null })
  };
  /* 後から読まれる CDN の supabase-js は `global.supabase = …` で上書きしてくるので、
     書き換え不可にして跳ね返す。 */
  Object.defineProperty(window, 'supabase', {
    value: { createClient: () => FAKE }, writable: false, configurable: false
  });
}, scene, theme);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
if (gate) {
  const hit = await page.evaluate(() => {
    const b = document.querySelector('[data-mr-gate="deep"]');
    if (!b) return false;
    b.click();
    return true;
  });
  if (!hit) console.log('※ 左メニューに DEEP PAY のボタンが見つかりませんでした');
  await new Promise((r) => setTimeout(r, 900));   // 押されてから1回だけ聞きに行く分
}
if (open) {
  console.log(`開きました（${scene} / ${lang} / ${theme}）。窓を閉じると終わります。`);
  /* ★ここを `browser.waitForTarget(() => false)` で待たない。
     puppeteer の待ち時間の既定は30秒で、時間切れの例外を握りつぶすと
     そのまま process.exit(0) に落ちて、**誰も触っていないのに窓が消える**
     （2026-08-19 に実際に起きた。渡した3つの窓が30秒で勝手に閉じた）。
     待つべきは時間ではなく「窓が閉じられたこと」＝ブラウザとの接続が切れたこと。 */
  await new Promise((r) => browser.on('disconnected', r));
  process.exit(0);
}
await page.screenshot({ path: outPath, fullPage: true });

/* ★横スクロールは狭い幅でしか出ないうえ、スクショを見ても気づけない
   （はみ出した分は写らない）。幅を指定して撮ったときは必ず数えて出す。
   はみ出している要素を名前で出さないと、どこを直すのか分からない。 */
const over = await page.evaluate(() => {
  const w = document.documentElement.clientWidth;
  const list = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || getComputedStyle(el).position === 'fixed') continue;
    if (r.right > w + 1 || r.left < -1) {
      list.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` +
                `${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}` +
                ` → ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
  }
  return { doc: document.documentElement.scrollWidth, view: w, list: list.slice(0, 8) };
});
console.log(over.doc > over.view + 1
  ? `❌ 横スクロールがある（文書 ${over.doc}px / 画面 ${over.view}px）\n   ${over.list.join('\n   ')}`
  : `✓ 横スクロールなし（${over.view}px）`);

await browser.close();
console.log(outPath);
