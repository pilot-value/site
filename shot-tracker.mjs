/* shot-tracker.mjs — 明細トラッカーを localhost の実ページで撮る。

   my_pay_reports() はまだ本番に入っていないので（オーナーが SQL を実行する前）、
   Supabase クライアントごと差し替えて、合成データで実物の profile.html を描かせる。
   ★ ここで使う数字は全部でたらめ。実物の明細の数値はこのリポジトリに1つも無い。

   実行: node shot-tracker.mjs <scene> <lang> <theme>
     scene: empty | one | many | bench | hand | simple
            hand … かんたん入力（額面1本＋パーディアム＋住宅手当＋今月の賞与）。
                   内訳の節が「入っている分だけ色＋残りは灰色」で出ることの確認
     lang : ja | en
     theme: dark | light
   保存先は screenshot.mjs と同じ ./temporary screenshots/
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

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const label = `tracker-${scene}-${lang}-${theme}` + (vw !== 1440 ? `-${vw}` : '');
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}profile.html`;

/* ★ headless:'new'（＝いまの Chrome 本体のヘッドレス）はこの環境で
   page.screenshot() が永久に返ってこない。CDP を直接叩いても同じなので
   puppeteer 側ではなく Chrome 側の問題。args を振っても直らない（実測:
   baseline / --disable-gpu / swiftshader / headless:true すべて TIMEOUT、
   headless:'shell' だけ OK）。よって chrome-headless-shell を使う。 */
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: vw, height: 1000 });

/* ★ setRequestInterception は使わない。有効にすると page.screenshot() が返ってこない
   （CDP のデッドロック。撮る直前に false に戻しても解けない＝実測）。
   CDN の supabase-js に差し替えクライアントを上書きさせない目的は、
   window.supabase を書き換え不可にすることで達成する（下の defineProperty）。 */
await page.evaluateOnNewDocument((scene, theme) => {
  localStorage.setItem('pv-theme', theme);
  localStorage.removeItem('pv_unlock_expiry');

  const UID = '00000000-0000-4000-8000-00000000a001';
  const FX = 40.8;                                  // AED → JPY（合成）
  /* ★ annual_total_orig は「毎月の支給の合計 × 12 ＋ 賞与」から作る。
     手で別の数字を置くと、画面上で内訳ドーナツの合計と時給の分子が食い違って
     見え、レイアウトの検分ができなくなる（DB 側の pv_annual_total と同じ組み方）。
     flight_variable_pay は other_allowance の内訳なので足さない。
     ★2026-09-02、サーバ側にだけ例外が1つ増えた ── 組合が総支給の外で払った行
       （union_outside_gross が真）は、年収に組合の分を足す。ここの見本は
       どれもその列を持たないので、今までどおりの組み方でよい。 */
  const mk = (y, m, over = {}) => {
    const r = Object.assign({
      airline: 'emirates', airline_other: null, position: 'cap', fleet: 'b777', job_role: null,
      period_year: y, period_month: m, period_ym: y * 12 + m,
      currency: 'AED', fx_to_jpy: FX, fx_to_usd: 0.272,
      net_pay_actual: 54600, ytd_taxable: 374400, deduction_total: 3600,
      base_pay: 25500, command_pay: 11000, housing_type: 'allowance', housing_amount: 12000,
      flight_variable_pay: 5800, per_diem: 4200, transport: 1500, other_allowance: 8200,
      bonus_annual: 0, profit_share_annual: 0,
      block_hours: 86.5, duty_hours: 158.2, night_hours: 12.4, credit_hours: null,
      source: 'payslip', verify_level: 1, created_at: '2026-0' + m + '-05T00:00:00Z'
    }, over);
    const monthly = r.base_pay + r.command_pay + r.housing_amount + r.transport +
                    r.other_allowance + r.per_diem;
    r.annual_total_orig = Math.round(monthly * 12 + r.bonus_annual);
    r.annual_total_jpy  = Math.round(r.annual_total_orig * FX);
    r.annual_total_usd  = Math.round(r.annual_total_orig * r.fx_to_usd);
    r.net_annual_jpy    = Math.round(r.annual_total_jpy * 0.99);   // 湾岸なので税はほぼ無い
    r.usd_per_block_hour = +((r.annual_total_usd / 12 - r.per_diem * r.fx_to_usd) / r.block_hours).toFixed(1);
    return r;
  };

  // 月ごとに変えるのは「その月の実績」＝乗務変動手当と時間、実手取り。
  const SCENES = {
    empty: [],
    one:   [mk(2026, 6)],
    many:  [mk(2026, 2, { other_allowance: 6100, flight_variable_pay: 3900, block_hours: 74.0, duty_hours: 141.0, net_pay_actual: 52400 }),
            mk(2026, 3, { other_allowance: 9400, flight_variable_pay: 7000, block_hours: 91.2, duty_hours: 163.4, net_pay_actual: 55700 }),
            mk(2026, 4, { other_allowance: 5600, flight_variable_pay: 3400, block_hours: 68.5, duty_hours: 128.9, net_pay_actual: 51900 }),
            mk(2026, 5, { other_allowance: 10200, flight_variable_pay: 7800, block_hours: 88.1, duty_hours: 155.7, net_pay_actual: 56600 }),
            mk(2026, 6)],
    /* 手で入れた月（2026-08-13 以降のかんたん入力）。基本給だけが分からない。
       この節は 2026-08-18 まで丸ごと消えていた。 */
    hand:  [(function () {
      const r = mk(2026, 6, {
        gross_monthly: 54250, bonus_month: 6000,
        base_pay: null, command_pay: null, other_allowance: null,
        flight_variable_pay: null, transport: null,
        net_pay_actual: null, ytd_taxable: null, deduction_total: null,
        duty_hours: null, night_hours: null, source: 'web'
      });
      r.annual_total_orig = (54250 - 6000) * 12;   // サーバの pv_annual_total と同じ組み方（組合の例外は mk() の★）
      r.annual_total_jpy = Math.round(r.annual_total_orig * FX);
      r.annual_total_usd = Math.round(r.annual_total_orig * r.fx_to_usd);
      r.net_annual_jpy = Math.round(r.annual_total_jpy * 0.99);
      r.usd_per_block_hour = +((r.annual_total_usd / 12) / r.block_hours).toFixed(1);
      return r;
    })()],
    /* 総支給1本だけの月（かんたん入力で手当を1つも入れなかった人）。
       ★2026-09-02、ここも灰色1色の円を出すようになった（オーナー指示）。
         円の下に「手当ごとに入れると分かれます」の1行が出ていること、
         その下の「今月ぶんを追加する →」と重なって見えないことを、この1枚で見る。 */
    simple: [(function () {
      const r = mk(2026, 6, {
        gross_monthly: 54250, bonus_month: null,
        base_pay: null, command_pay: null, other_allowance: null,
        flight_variable_pay: null, transport: null, per_diem: null,
        housing_amount: null, housing_type: null,
        net_pay_actual: null, ytd_taxable: null, deduction_total: null,
        duty_hours: null, night_hours: null, source: 'web'
      });
      r.annual_total_orig = 54250 * 12;   // サーバの pv_annual_total と同じ組み方
      r.annual_total_jpy = Math.round(r.annual_total_orig * FX);
      r.annual_total_usd = Math.round(r.annual_total_orig * r.fx_to_usd);
      r.net_annual_jpy = Math.round(r.annual_total_jpy * 0.99);
      r.usd_per_block_hour = +((r.annual_total_usd / 12) / r.block_hours).toFixed(1);
      return r;
    })()]
  };
  SCENES.bench = SCENES.many;

  const REPORTS = SCENES[scene] || [];
  const BENCH = scene === 'bench'
    ? { n: 7, median_usd: 190000, p25_usd: 172000, p75_usd: 208000, median_usd_per_bh: 178.4 }
    : null;

  const RPC = {
    my_pay_reports: () => ({
      ok: true, reports: REPORTS,
      report_count: REPORTS.length,
      streak_months: REPORTS.length,
      access_until: new Date(Date.now() + 62 * 86400000).toISOString(),
      badge: 'silver', badge_state: 'active',
      mail_optin: scene === 'bench',
      pay_day_of_month: 5
    })
  };

  // 差し替えクライアント。profile.html / pv-reunlock.js / pay-tracker.js が
  // 実際に呼ぶ形（thenable なチェーン）だけを満たす最小の作り。
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
        gender: 'male', birthdate: '1988-04-12', country: '日本',
        company: 'Emirates', position: 'captain',
        created_at: '2026-01-11T00:00:00Z', email_opt_in: true
      }]);
      if (t === 'pay_benchmarks') return q(BENCH ? [BENCH] : []);
      return q([]);
    },
    rpc: async (name) => ({ data: RPC[name] ? RPC[name]() : { ok: true }, error: null })
  };
  /* 後から読まれる CDN の supabase-js は `global.supabase = …` で上書きしてくるので、
     書き換え不可にして跳ね返す（向こうの代入が黙って落ちるか例外になるかは
     どちらでもよく、こちらの FAKE が残ることだけが要る）。 */
  Object.defineProperty(window, 'supabase', {
    value: { createClient: () => FAKE }, writable: false, configurable: false
  });
}, scene, theme);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(outPath);
