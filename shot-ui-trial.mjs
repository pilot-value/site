/* shot-ui-trial.mjs — shot-value.mjs の写し（すりガラスの試作用・ポート 3210・UI=v22|glass・ACT/MID）。本体は shot-value.mjs。
   shot-value.mjs — 市場価値レポート（MY PAGE の ③ YOUR PAY）を localhost の実ページで撮る。
   ★2026-09-06、レポートは profile.html の中の1節になった（my-value.html は転送1枚）。

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
            simple … かんたん入力で手当を1つも入れなかった月
                     ＝§3 は**灰色1色の円**（2026-09-02 に反転。それまでは見本のぼかし）、
                       §4 手取りは「見本（ぼかし）」のまま
            hand   … かんたん入力の実態（額面1本＋パーディアム＋住宅手当＋今月の賞与）
                     ＝§3 の円グラフが「入っている分だけ色＋残りは灰色」で出る
            both   … ★2026-08-26 以降の既定。額面と内訳の両方が入っている
                     ＝§3 は内訳の色が全部出て、説明できない残りだけが灰色
            union  … ★2026-09-02。組合が総支給の**外**で払っている人（乗員代表）
                     ＝§3 の円ぜんぶは「受け取った額」（総支給 ＋ 組合）で、組合も
                       スライスとして出る。「基本給が総支給に占める割合」の分母だけは
                       組合の分を引いて総支給に戻す。組合の額は §2 にも
                       「組合から別に受け取った分」＋「合わせて受け取った額」の2行で出る。
                       直す前はこの形の行で §3 の円が丸ごと消えていた
            new    … many を ?new=1 で開く（文言だけ変わることの確認）
            gap    … 同社だが間隔があいている（2月と6月）＝§6 に「4ヶ月あいています」
            job    … 転職（ZIPAIR 3枚 → エミレーツ 1枚）＝§6 は差を出さず、
                     §7 の線から前職の月が落ちる
            cur    … 同社で支給通貨が変わった＝§6 は金額を出さず時間だけ
            total  … 会社も通貨もまたぐ8枚（ZIPAIR円建て3枚 → エミレーツAED建て5枚）
                     ＝§7b の累計に全部入る（§7 の線は同社5点のまま）
            partial… 8枚中3枚しか手取り・控除が読めていない
                     ＝§7b に「8枚中 3枚」の断り書きが出る
            real   … ★ここだけ合成ではない。**本番から1行だけ読んで**その会員の画面を
                       そのまま描く（2026-09-02）。my_pay_reports() は本人の行しか
                       返さない＝サービスキーでも他人としては呼べないので、
                       「この会員にいま何が見えているか」を確かめる道がほかに無い。
                       既定は「組合が絡む一番新しい1件」。第6引数に PostgREST の
                       絞り込みを書くと変えられる（例: airline=eq.jal）。
                       ⚠️ 読むだけ。数字はこのファイルに1つも書かない。
                       ⚠️ 本番DBを叩くので check.mjs には入れない（db/usage.mjs と同じ）。
                       ⚠️ mail-bot/.env の SUPABASE_URL / SUPABASE_SERVICE_KEY が要る。
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
const label = `ui-${process.env.UI || 'now'}-${(process.env.PAGE || '').replace(/\.html$/, '').replace(/\//g, '_')}${process.env.PAGE ? '-' : ''}${process.env.HASH ? process.env.HASH.replace(/[^a-z0-9]+/gi, '') + '-' : ''}${scene}-${lang}-${theme}` + (vw !== 1440 ? `-${vw}` : '') + (process.env.BG ? '-bg' + process.env.BG : '') + (process.env.VIEW ? '-view' : '') + (process.env.ACT ? '-' + process.env.ACT.replace(/[^a-z0-9]+/gi, '_') + (process.env.MID ? '-' + process.env.MID : '') : '');
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const UI = process.env.UI || '';
/* 会社ページ（PAGE=airlines/<slug>.html）も開ける。#your-pay は MY PAGE の印なので、PAGE を渡したら付けない。
   HASH=work などで会社ページのタブ（overview / pay / reviews / work / life / stay）を開いた状態から撮れる。 */
const hash = process.env.HASH ? '#' + process.env.HASH.replace(/^#/, '')
           : (process.env.PG === 'page' || process.env.PAGE) ? '' : '#your-pay';
const url = `http://localhost:${process.env.PV_PORT || 3210}/${lang === 'en' ? 'en/' : ''}${process.env.PAGE || 'profile.html'}` +
            '?' + (UI ? 'ui=' + UI + '&' : '') + (process.env.BG ? 'bg=' + process.env.BG + '&' : '') + (process.argv.includes('open') ? '' : 'sw=0') + hash;

/* ★ headless:'new' はこの環境で page.screenshot() が永久に返ってこない
   （shot-tracker.mjs に実測の経緯あり）。chrome-headless-shell を使う。 */
const browser = await puppeteer.launch(open
  ? { headless: false, defaultViewport: null, args: ['--no-sandbox', `--window-size=${vw},900`, '--window-position=40,40'] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = (await browser.pages())[0] || await browser.newPage();
/* ★本番の Supabase へは1本も出さない保険（2026-11-12）。差し替えクライアント（下の FAKE）を通らない通信 ──
   ページが自分で fetch する口・後から読む supabase-js ── が在っても、ブラウザがその場で止める。
   setRequestInterception は使わない（CDP デッドロック）。止めるのはブラウザの「この住所は読まない」の一覧だけ。
   止めた通信は数えて最後に出す（0 でなければ、どこかが差し替えの外から本番へ出ようとした）。 */
const GUARD = await page.createCDPSession();
await GUARD.send('Network.enable');
await GUARD.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
const BLOCKED = [];
page.on('requestfailed', (r) => { if (/supabase\.co/.test(r.url())) BLOCKED.push(r.url().replace(/\?.*$/, '')); });
/* ページの console のエラーと、捕まらなかった例外。撮ったあとに出す */
const ERRS = [];
page.on('console', (m) => { if (m.type() === 'error') ERRS.push(m.text().slice(0, 240)); });
page.on('pageerror', (e) => ERRS.push('pageerror: ' + String(e && e.message || e).slice(0, 240)));
if (!open) await page.setViewport(process.env.REC
  /* スマホは「780px の画面に、390px の幅で組んだページを2倍で描く」（コマの絵が 780px の鮮明さで来る。下の meta viewport の差し替えと対） */
  ? (vw < 600 ? { width: vw * 2, height: 1688, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { width: vw, height: 800, deviceScaleFactor: 1 })
  : { width: vw, height: 1000 });

/* ★ setRequestInterception は使わない（CDP デッドロック。shot-tracker.mjs 参照）。
   CDN の supabase-js に上書きさせない目的は defineProperty で達成する。 */
/* ── scene='real' だけ、本番の実物を1行だけ読む（2026-09-02）──────────
   なぜ要るか：my_pay_reports() は**本人の行しか返さない**（サービスキーでも
   他人としては呼べない）ので、「この会員の画面がいまどう見えているか」を
   確かめる道が、合成データ以外に1つも無かった。合成で議論すると、実在しない
   組み合わせ（組合を持たない会社に組合手当、など）を本物と取り違える。
   ⚠️ 読むだけ。**数字はこのファイルに1つも書かない**（実行のたびに取り直す）。
   ⚠️ 本番DBを叩くので check.mjs には入れない（db/usage.mjs と同じ扱い）。 */
let REALROW = null;
if (scene === 'real') {
  const envPath = path.join(__dirname, 'mail-bot/.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ mail-bot/.env がありません（SUPABASE_URL / SUPABASE_SERVICE_KEY が要ります）。');
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
  }
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
  /* 第7引数に絞り込みを書ける（PostgREST の書式そのまま）。
     既定は「組合が絡む一番新しい1件」＝いま調べている形。 */
  const filter = process.argv[6] && process.argv[6].includes('=')
    ? process.argv[6] : 'union_pay=gt.0';
  const rows = await (await fetch(process.env.SUPABASE_URL +
    '/rest/v1/pay_reports?select=*&' + filter + '&order=created_at.desc&limit=1',
    { headers: H })).json();
  if (!Array.isArray(rows) || !rows.length) {
    console.error('❌ 該当する行がありません:', filter);
    process.exit(1);
  }
  REALROW = rows[0];
  /* my_pay_reports() が計算して足す列。REST は素の表を返すので手で足す。
     規則は pv_union_outside_gross と同じ（extra='yes' かつ source='union'）。
     ⚠️ あちらを変えたらここも直す。ズレると本番と違う絵を見ることになる。 */
  const u = REALROW.pay_items && REALROW.pay_items.union;
  REALROW.union_outside_gross = !!(u && u.extra === 'yes' && u.source === 'union');
  REALROW.period_ym = REALROW.period_year * 12 + REALROW.period_month;
  console.log('本番から1行:', REALROW.airline, REALROW.position, REALROW.fleet,
              REALROW.period_year + '年' + REALROW.period_month + '月',
              '／ 組合が総支給の外 =', REALROW.union_outside_gross);
}

await page.evaluateOnNewDocument((scene, theme, REALROW) => {
  localStorage.setItem('pv-theme', theme);
  localStorage.removeItem('pv_unlock_expiry');

  const UID = '00000000-0000-4000-8000-00000000a001';
  const FX = 40.8;                                  // AED → JPY（合成）
  /* ★ annual_total_orig は「毎月の支給の合計 × 12 ＋ 賞与」から作る。
     手で別の数字を置くと、内訳ドーナツの合計と時給の分子が画面上で食い違って
     見え、レイアウトの検分ができなくなる（DB の pv_annual_total と同じ組み方）。
     flight_variable_pay は other_allowance の内訳なので足さない。
     ★2026-09-02、サーバ側にだけ例外が1つ増えた ── 組合が総支給の外で払った行
       （union_outside_gross が真）は、年収に組合の分を足す。この見本で
       その列を持つのは union シーンだけで、ほかは今までどおりの組み方でよい。 */
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
    /* ★本番から読んだ実物の1行（scene='real'）。ここだけ合成ではない。 */
    real: REALROW ? [REALROW] : [],
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
       → §4 手取り が「見本（ぼかし）」になる唯一の経路。
       ★§3 支給構成は 2026-09-02 から**灰色1色の円**を出す（オーナー指示）。
         給与を出した人の画面に、自分の数字が1つも無い図を置かない。
         円の下に「手当ごとに入れると分かれます」の1行と入口が付く。
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
      r.annual_total_orig = (54250 - 6000) * 12 + 130000;   // サーバの pv_annual_total と同じ組み方（組合の例外は mk() の★）
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
       ★年換算は総支給ベース。内訳を足さない（サーバの pv_annual_total と同じ）。
         組合手当も**会社が払っている**ので総支給の中＝足さない。外で払う形は union シーン。 */
    both: [(function () {
      const r = mk(2026, 6, Object.assign({}, THIN, {
        /* ★総支給は内訳の合計より少しだけ大きい数にしておく。小さいと
           pay-viz が「手当の合計が総支給を超える行は正しい図を描けない」で
           図ごと降りる（見本のまま出る）＝色の見比べができない。 */
        gross_monthly: 66000, guaranteed_hours: 75, bonus_annual: 130000, bonus_month: 0,
        /* ★保証給（2026-08-26）。基本給とは別の切れが出ることを、この1枚で見る。
           灰色に落ちていたら pay-viz の segments に guarantee を足し忘れている。 */
        base_pay: 20000, guarantee_pay: 3000, command_pay: 3200,
        /* ★教官・訓練の手当（2026-08-26 その3）。other_allowance には**入っていない**
           （別の入れ物）。ここが灰色に混ざっていたら pay-viz の segments に
           instructor を足し忘れている。 */
        instructor_pay: 2200,
        /* ★審査・査察の手当（2026-08-26 その4）。教官の隣に自分の色で出る。
           隣と見分けられない・灰色に落ちる、のどちらかなら pay-viz の SEG を直す。 */
        examiner_pay: 1800,
        /* ★組合・乗員代表の手当（2026-08-26 その5）。教官・審査の隣に自分の色で出る。
           ⚠️ ここを足したら総支給も一緒に上げる（上の★の理由）。 */
        union_pay: 1500,
        /* ★管理・マネジメントの手当（2026-08-26 その6）。組合の隣に自分の色（ブロンズ）で出る。
           ⚠️ ここを足したら総支給も一緒に上げる（上の★の理由。60500 → 63000 にした）。 */
        management_pay: 2500,
        /* ★その他の兼務・配属の手当（2026-08-27 その7）。管理職の隣に自分の色（濃紺）で出る。
           ⚠️ ここを足したら総支給も一緒に上げる（上の★の理由。63000 → 66000 にした）。 */
        nonline_pay: 3000,
        flight_variable_pay: 11000, other_allowance: 11900,
        per_diem: 4200, transport: 0,
        housing_type: 'allowance', housing_amount: 12000,
      }));
      r.annual_total_orig = 66000 * 12 + 130000;
      r.annual_total_jpy = Math.round(r.annual_total_orig * r.fx_to_jpy);
      r.annual_total_usd = Math.round(r.annual_total_orig * r.fx_to_usd);
      r.net_annual_jpy = Math.round(r.annual_total_jpy * 0.99);
      r.usd_per_block_hour = +((r.annual_total_usd / 12) / r.block_hours).toFixed(1);
      return r;
    })()],
    /* ★2026-09-02、組合が総支給の**外**で払っている人（乗員代表）。
       会社の明細に印字されるのは gross_monthly だけで、組合の分はそこに載らない。
       union_outside_gross（サーバの pv_union_outside_gross が付ける）が真なので、
       §3 の円ぜんぶは「受け取った額」＝ 780,000 ＋ 520,000 ＝ 1,300,000。
       組合の 520,000 はスライスとして出る（40%）。
       灰色は 780,000 − 715,000 ＝ 65,000（5%）。**組合の分ではない。**
       ★「基本給が総支給に占める割合」だけは分母が違う ── 円ぜんぶから組合の
         520,000 を引いて総支給に戻すので 370,000 / 780,000 ＝ 47%。
         引き忘れると 370,000 / 1,300,000 ＝ 28% と刷られる（my-value.js の basePc）。
       ⚠️ この列を落とすと組合の 520,000 が「総支給の中にある」扱いになり、
          known（1,235,000）が円ぜんぶ（780,000）を超えて rest < -1
          ＝ §3 の円が丸ごと消える。直す前の画面がこれ。
       ★このシーンだけ**円建ての日本の会社**にしてある。ほかは AED 建てのエミレーツだが、
         組合を持たない会社に組合手当を付けた絵は現実にあり得ず、桁もレート倍で
         読みにくい（実際に「月 228万？」と読み違える形になった）。
       ⚠️ 数字は全部でたらめ。実物の明細の額はこのリポジトリに1つも無い。 */
    union: [(function () {
      const r = mk(2026, 6, Object.assign({}, JP, THIN, {
        position: 'fo', fleet: 'b787',
        gross_monthly: 780000, guaranteed_hours: 75, bonus_annual: 2600000, bonus_month: 0,
        base_pay: 370000, command_pay: 0,
        // 総支給（780,000）の3分の2。会社が払っていないから成り立つ額
        union_pay: 520000, union_outside_gross: true,
        /* ★変動給は「その他手当」の**内訳**（pay-viz.js の約束・フォームも
           payslip.js もその形で送る）。ここを逆転させると pay-viz が
           「別欄に入れた人」とみなして変動給をスライスにせず、その額が丸ごと
           灰色（どの項目にも入れていない分）に落ちる＝本番に無い絵になる。
           その他手当 240,000 の内訳が 変動給 180,000 ＋ その他 60,000。 */
        flight_variable_pay: 180000, other_allowance: 240000,
        per_diem: 45000, transport: 0,
        housing_type: 'allowance', housing_amount: 60000,
        // 組合活動でその月ほとんど飛んでいない＝時給が跳ねることも1枚で見る
        block_hours: 15.5, duty_hours: 42.0
      }));
      // 年換算も「総支給＋組合」×12＋賞与。サーバの pv_annual_total と同じ組み方
      r.annual_total_orig = (780000 + 520000) * 12 + 2600000;
      r.annual_total_jpy = Math.round(r.annual_total_orig * r.fx_to_jpy);
      r.annual_total_usd = Math.round(r.annual_total_orig * r.fx_to_usd);
      r.net_annual_jpy = Math.round(r.annual_total_jpy * 0.79);
      /* ★乗務1時間あたりだけは、組合の分を**分子から抜く**（サーバの
         pv_block_hour_usd と同じ）。あれは「飛んだことへの対価」で年収ではない。
         ここを annual_total_usd のまま割ると、画面の見本だけがサーバより高く出る。 */
      r.usd_per_block_hour = +(((r.annual_total_orig - 520000 * 12) * r.fx_to_usd)
                               / (12 * r.block_hours)).toFixed(2);
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

  /* ── 会社ページ（/airlines/<slug>.html・/en/airlines/<slug>.html）だけの見本（2026-11-12 すりガラスの試作）──────────
     給与の鍵が開いた会員として、会社ページの図（年収の幅の棒・年数の点・内訳の円・月の勤務の帯・評価の6角形・口コミの要約）を
     全部描かせるための答え。★数字も文も全部でたらめ（本物の提出・口コミは1つも写していない・人の名前は書かない）。
     額はキャセイの機長 USD 20万〜30万・副操縦士 USD 10万〜15万の幅に収めてある。どの会社のページでも同じ見本を、
     聞かれた会社（引数の slug ／ pv_pay_rows は住所の slug）の行として返す。
     MY PAGE・REAL PAY・ROADMAP・INVITE ではこの表を1つも見ない（AIR が空）＝ 今までと1文字も同じ答え。 */
  const AIR = (location.pathname.match(/\/airlines\/([a-z0-9-]+)\.html$/) || [])[1] || '';
  const P = (a) => (a && a.p) || {};
  const slugOf = (a) => P(a).airline || (Array.isArray(P(a).airlines) && P(a).airlines[0]) || AIR;
  const AIR_PAY = (s) => [
    /* 機長：昇格後の年数の5段（ten 0〜4・tenk 'r'）に散らす ＝ 年数の図に点が並ぶ */
    { pos: 'cap', fleet: 'a350', ten: 0, annual_usd: 212000, verified: true,  age: 1 },
    { pos: 'cap', fleet: 'b777', ten: 1, annual_usd: 228000, verified: false, age: 2 },
    { pos: 'cap', fleet: 'a350', ten: 1, annual_usd: 241000, verified: true,  age: 0 },
    { pos: 'cap', fleet: 'a330', ten: 2, annual_usd: 252000, verified: false, age: 3 },
    { pos: 'cap', fleet: 'b777', ten: 3, annual_usd: 268000, verified: true,  age: 4 },
    { pos: 'cap', fleet: 'a350', ten: 4, annual_usd: 287000, verified: false, age: 5 },
    { pos: 'fo',  fleet: 'a330', ten: 0, annual_usd: 104000, verified: true,  age: 0 },
    { pos: 'fo',  fleet: 'a350', ten: 1, annual_usd: 116000, verified: false, age: 1 },
    { pos: 'fo',  fleet: 'b777', ten: 2, annual_usd: 128000, verified: true,  age: 2 },
    { pos: 'fo',  fleet: 'a350', ten: 3, annual_usd: 139000, verified: false, age: 3 },
    { pos: 'fo',  fleet: 'b777', ten: 4, annual_usd: 147000, verified: true,  age: 6 }
  ].map((r) => Object.assign({ airline: s, tenk: 'r', far: false }, r));
  const AIR_PER = { from: '2024-11', to: '2026-10' };
  /* 職位ごとの中央値と 25%・75%（pv_company_pay の開いた答えの形）。人数は返さない */
  const AIR_MED = { cap: { s: 'ok', median_usd: 250000, p25_usd: 228000, p75_usd: 268000 },
                    fo:  { s: 'ok', median_usd: 128000, p25_usd: 116000, p75_usd: 139000 } };
  /* 月の給与の内訳（pv_company_comp）── 割合は整数で合計 100・額は月の平均 USD */
  const AIR_COMP = {
    cap: { s: 'ok', segs: [{ k: 'base', pct: 50, avg_usd: 10400 }, { k: 'variable', pct: 22, avg_usd: 4600 }, { k: 'command', pct: 8, avg_usd: 1700 },
                           { k: 'perdiem', pct: 9, avg_usd: 1900 }, { k: 'other', pct: 7, avg_usd: 1500 }, { k: 'rest', pct: 4, avg_usd: 800 }] },
    fo:  { s: 'ok', segs: [{ k: 'base', pct: 56, avg_usd: 6000 }, { k: 'variable', pct: 24, avg_usd: 2600 }, { k: 'perdiem', pct: 10, avg_usd: 1100 },
                           { k: 'other', pct: 6, avg_usd: 640 }, { k: 'rest', pct: 4, avg_usd: 430 }] }
  };
  /* 月の勤務（pv_work_view）── 時間は 0〜240・日と泊は 0〜31 の目盛に収まる幅 */
  const AIR_WORK = {
    cap: { block_hours: { lo: 68, hi: 82 }, duty_hours: { lo: 150, hi: 185 }, work_days: { lo: 15, hi: 18 },
           duty_days: { lo: 14, hi: 17 }, days_off: { lo: 10, hi: 13 }, stay_nights: { lo: 6, hi: 10 } },
    fo:  { block_hours: { lo: 72, hi: 88 }, duty_hours: { lo: 160, hi: 195 }, work_days: { lo: 16, hi: 19 },
           duty_days: { lo: 15, hi: 18 }, days_off: { lo: 9, hi: 12 }, stay_nights: { lo: 7, hi: 11 } }
  };
  /* 口コミ（pv_reviews の、鍵を持つ人への形）。6分類ぜんぶに点数 ＝ 6角形が塗られる。英語のページ用に訳も付ける */
  const REV_ID = (i) => '00000000-0000-4000-8000-0000000000b' + i;
  const AIR_REVS = (s) => [
    { position: 'captain', tenure_bucket: '10-15', fleet: 'a350', created_at: '2026-10-18T00:00:00Z', sc: [4, 4, 3, 3, 4, 5],
      c: { training: ['シミュレーターの教官が丁寧で、機種移行の準備がしやすい。', 'Simulator instructors are thorough, so type conversions are well prepared.'],
           wlb: ['長距離が中心で、月のブロックタイムは安定している。', 'Mostly long-haul, and monthly block time is steady.'] } },
    { position: 'fo', tenure_bucket: '5-10', fleet: 'b777', created_at: '2026-09-27T00:00:00Z', sc: [3, 3, 4, 3, 4, 4],
      c: { salary: ['基本給より乗務の手当の割合が大きく、月によって差が出る。', 'Flying pay makes up a large share, so it varies month to month.'],
           culture: ['先任順がはっきりしていて、昇格の見通しは立てやすい。', 'Seniority is clear, so upgrade timing is predictable.'] } },
    { position: 'fo', tenure_bucket: '1-5', fleet: 'a330', created_at: '2026-09-02T00:00:00Z', sc: [4, 3, 4, 4, 3, 4],
      c: { ops: ['運航管理との連携がよく、遅延時の判断がしやすい。', 'Good coordination with dispatch makes delay decisions easier.'],
           benefits: ['社員の航空券は使いやすいが、繁忙期は取りにくい。', 'Staff travel is handy, but hard to get in peak season.'] } },
    { position: 'captain', tenure_bucket: '15-20', fleet: 'b777', created_at: '2026-08-14T00:00:00Z', sc: [3, 4, 3, 3, 4, 4],
      c: { wlb: ['夜間の出発が続く月は、休みの日も疲れが残る。', 'Months with many night departures leave you tired even on days off.'],
           salary: ['機長になると手当が増え、年収の伸びははっきりしている。', 'Pay rises clearly once you upgrade to captain.'] } }
  ].map((r, i) => {
    const o = { id: REV_ID(i + 1), airline: s, orig_lang: 'ja', position: r.position, tenure_bucket: r.tenure_bucket,
                fleet: r.fleet, job_role: '', created_at: r.created_at, translations: { en: {} } };
    ['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score', 'training_score'].forEach((k, j) => { o[k] = r.sc[j]; });
    ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'].forEach((k) => {
      o[k + '_comment'] = r.c[k] ? r.c[k][0] : '';
      if (r.c[k]) o.translations.en[k] = r.c[k][1];
    });
    return o;
  });
  /* 口コミの要約（pv_review_summary の開いた答え）。「話題：説明」の形・短い見本の文 */
  const SUM = {
    ja: { overview: '訓練の質と長距離中心の働き方を評価する声が多い一方、昇格までの年数と拠点の住居費を気にする声が目立ちます。',
          good: [['訓練：シミュレーターの教官が丁寧で、機種移行の準備がしやすいという声。', 'training'],
                 ['勤務：長距離が中心で、月のブロックタイムが安定しているという声。', 'wlb'],
                 ['給与：機長に昇格すると手当が増え、年収の伸びがはっきりしているという声。', 'salary']],
          concern: [['昇格：機長への昇格まで年数がかかるという声が複数あります。', 'culture'],
                    ['生活費：拠点の家賃が高く、手当だけでは足りないという声。', 'benefits']] },
    en: { overview: 'Pilots praise the training and the long-haul pattern, while the wait for command and the cost of housing near base come up often.',
          good: [['Training: Simulator instructors are thorough, which makes type conversions easier.', 'training'],
                 ['Rostering: Mostly long-haul, with steady monthly block time.', 'wlb'],
                 ['Pay: Allowances rise clearly after the command upgrade.', 'salary']],
          concern: [['Command upgrade: Several pilots say the wait for command is long.', 'culture'],
                    ['Cost of living: Rent near base is high relative to allowances.', 'benefits']] }
  };
  const AIR_RPC = {
    /* 給与の鍵が開いた会員への一覧（state 'open'）。会社ページの給与の欄は、この会社の行だけを数えて図にする */
    pv_pay_rows: () => ({ ok: true, state: 'open', stats: ST_LOCK,
                          give: { basic: true, detailed: true, payslip: false, full: false }, rows: AIR_PAY(AIR) }),
    pv_company_pay: (a) => ({ ok: true, state: 'open', floor: 3, period: AIR_PER,
      airlines: Object.fromEntries((P(a).airlines || [AIR]).map((s) => [s, AIR_MED])) }),
    pv_company_comp: (a) => ({ ok: true, state: 'open', period: AIR_PER,
      airlines: Object.fromEntries((P(a).airlines || [AIR]).map((s) => [s, AIR_COMP])) }),
    pv_work_view: () => ({ ok: true, state: 'open', months: 12, by: AIR_WORK }),
    pv_reviews: (a) => ({ unlocked: true, rows: AIR_REVS(slugOf(a)) }),
    pv_review_summary: (a) => {
      const L = SUM[P(a).lang === 'en' || P(a).lang === 'es' ? 'en' : 'ja'];
      const ids = [REV_ID(1), REV_ID(2), REV_ID(3), REV_ID(4)];
      return { ok: true, state: 'open', n: 4, as_of: '2026-11-01', as_of_at: '2026-11-01T03:00:00Z', overview: L.overview,
               good: L.good.map(([text, cat], i) => ({ text, cat, ids: ids.slice(i, i + 2) })),
               concern: L.concern.map(([text, cat], i) => ({ text, cat, ids: ids.slice(i + 1, i + 3) })) };
    },
    /* 会員の中央値で書き込みを差し替えない（ページに出荷した額のまま） */
    pv_member_medians: () => [],
    /* 待遇の集計・補足・街：開いた会員への「まだ集まっていない」答え（欄は「まだ集計がありません」・補足と街は畳む） */
    pv_contrib_facts: () => ({ ok: true, state: 'open', facts: [] }),
    pv_contrib_notes: () => ({ ok: true, state: 'open', notes: [] }),
    pv_contrib_give: () => ({ ok: true, state: 'open' }),
    pv_town_board: () => ({ ok: true, state: 'open', towns: [] }),
    pv_town_options: () => ({ ok: true, towns: [] }),
    my_town_posts: () => ({ ok: true, posts: [] }),
    pv_stays: () => ({ ok: true, state: 'locked' })
  };

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
    /* 試作：ROADMAP の見本（数字も要望の文もでたらめ・実在の名前は書かない） */
    pv_give_growth: () => Array.from({ length: 10 }, (_, i) => ({ d: new Date(Date.UTC(2026, 8, 1 + i * 7)).toISOString().slice(0, 10), n: [2, 3, 4, 6, 7, 9, 11, 13, 15, 17][i] })),
    pv_requests_list: () => ({ total: 4, items: [
      { id: 1, body: "機種ごとの月間フライトタイムを会社別に見たい", category: "data", status: "considering", like_count: 9, liked_by_me: false, comment_count: 2, created_at: "2026-10-20T00:00:00Z", is_hidden: false, image: null, visibility: "public" },
      { id: 2, body: "副操縦士の昇格までの年数を比べたい", category: "data", status: "planned", like_count: 6, liked_by_me: true, comment_count: 1, created_at: "2026-10-28T00:00:00Z", is_hidden: false, image: null, visibility: "public" },
      { id: 3, body: "給与明細を毎月リマインドしてほしい", category: "feature", status: "building", like_count: 4, liked_by_me: false, comment_count: 0, created_at: "2026-11-02T00:00:00Z", is_hidden: false, image: null, visibility: "public" },
      { id: 4, body: "ダークモードの文字をもう少し大きく", category: "ui", status: "new", like_count: 2, liked_by_me: false, comment_count: 0, created_at: "2026-11-08T00:00:00Z", is_hidden: false, image: null, visibility: "public" }
    ] }),
    // 本番と同じく、オンにすると親（email_opt_in）も一緒に立てて返す
    set_mail_optin: (a) => {
      OPTIN.on = !!(a && a.p_on);
      return { ok: true, mail_optin: OPTIN.on, email_opt_in: OPTIN.on || false };
    }
  };

  // 差し替えクライアント。profile.html / currency.js / lang-toggle.js が実際に
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
      /* 会社ページの口コミの枠（premium-auth-lock.js）は「この会社に口コミを出したか」をここで見る ＝ 出した会員として開く */
      if (AIR && t === 'reviews_v2') return q([{ id: REV_ID(9) }]);
      return q([]);
    },
    rpc: async (name, a) => {
      const fn = (AIR && AIR_RPC[name]) || RPC[name];
      return { data: fn ? fn(a) : { ok: true }, error: null };
    }
  };
  /* 会社ページの部品（career-live.js・career-stay.js・pv-contrib.js）はログインの知らせも聞く。会社ページでだけ口を足す */
  if (AIR) FAKE.auth.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } });
  /* 後から読まれる CDN の supabase-js は `global.supabase = …` で上書きしてくるので、
     書き換え不可にして跳ね返す。 */
  Object.defineProperty(window, 'supabase', {
    value: { createClient: () => FAKE }, writable: false, configurable: false
  });
}, scene, theme, REALROW);

if (process.env.RM) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
/* REC=<フォルダ> … 画面の動きを1コマずつ撮る（Page.startScreencast）。動画にするのは scratchpad の encode.mjs */
const REC = { frames: [], cdp: null };
async function recStart() {
  REC.cdp = await page.createCDPSession();
  REC.cdp.on('Page.screencastFrame', (f) => {
    REC.frames.push({ t: f.metadata.timestamp, data: f.data });
    REC.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await REC.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1, maxWidth: 1600, maxHeight: 1800 });
}
if (process.env.REC) {
  /* 動画には試作の切り替え（右下の帯）を写さない。ページを移ると ?sw=0 が付いてこないので、ここで隠す */
  if (vw < 600) await page.evaluateOnNewDocument((w) => {
    const fix = () => { const m = document.querySelector('meta[name="viewport"]'); if (m && m.content !== 'width=' + w) m.content = 'width=' + w; return !!m; };
    if (!fix()) { const mo = new MutationObserver(() => { if (fix()) mo.disconnect(); }); mo.observe(document, { childList: true, subtree: true }); }
  }, vw);
  await page.evaluateOnNewDocument(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ut-sw{display:none!important}'; document.head.appendChild(s); }); });
  await recStart();
  page.on('framenavigated', (fr) => { if (fr === page.mainFrame()) REC.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1, maxWidth: 1600, maxHeight: 1800 }).catch(() => {}); });
}
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
/* 試作：ACT=year（今月｜1年の「1年」）/ tab2・tab3（大きいタブ）/ page（MY PAGE｜MY PAY）を押す。
   MID=ミリ秒 を付けると、押してからその時間で撮る（切り替えの途中の絵）。 */
if (process.env.ACT) {
  const act = process.env.ACT;
  await page.evaluate((act) => {
    const pick = {
      year: () => [...document.querySelectorAll('#pv-value .pt-tabs .pt-tab')].find(b => !b.classList.contains('on')),
      tab2: () => document.querySelectorAll('#pv-value .mv-tab')[1],
      tab3: () => document.querySelectorAll('#pv-value .mv-tab')[2],
      page: () => [...document.querySelectorAll('.mp-tab')].find(b => !b.classList.contains('on'))
    }[act];
    if (act === 'replay') { window.scrollTo(0, 0); window.PVUiTrial && window.PVUiTrial.replay(); return; }
    /* scroll:600 … 600px 下へ（見えたカードが動き出す）。nav:actual-pay … 左のメニューのその項目を押す（ページを移る） */
    if (act.startsWith('click:')) { const el = document.querySelector(act.slice(6)); if (el) el.click(); else console.log('no ' + act); return; }
    if (act.startsWith('scroll:')) { window.scrollTo(0, +act.slice(7)); return; }
    if (act.startsWith('nav:')) { const a = document.querySelector('.mr-side-a[href^="' + act.slice(4) + '"]'); if (a) a.click(); else console.log('no nav ' + act); return; }
    const b = pick && pick(); if (b) b.click(); else console.log('no target ' + act);
  }, act);
  await new Promise((r) => setTimeout(r, Number(process.env.MID) || 1500));
}
if (process.env.REC) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /* 押す所に小さな丸を出してから押す（動画で「どこを押したか」が分かるように） */
  const tap = (sel, nth = 0) => page.evaluate((sel, nth) => {
    const el = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length)[nth];
    if (!el) return false;
    const r = el.getBoundingClientRect(), dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;left:' + (r.left + r.width / 2 - 22) + 'px;top:' + (r.top + r.height / 2 - 22) + 'px;width:44px;height:44px;border-radius:50%;background:rgba(6,117,99,.28);border:2px solid rgba(6,117,99,.6);z-index:2147483647;pointer-events:none;transition:transform .55s ease,opacity .55s ease';
    document.documentElement.appendChild(dot);
    requestAnimationFrame(() => requestAnimationFrame(() => { dot.style.transform = 'scale(1.7)'; dot.style.opacity = '0'; }));
    setTimeout(() => dot.remove(), 700);
    setTimeout(() => el.click(), 120);
    return true;
  }, sel, nth).catch(() => false);
  /* なめらかにスクロール（指で送る速さ） */
  const glide = (to, ms) => page.evaluate(async (to, ms) => {
    const end = to === 'bottom' ? document.documentElement.scrollHeight - innerHeight : to;
    const from = scrollY, t0 = performance.now(), rs = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';   // 会社ページは scroll-behavior:smooth ＝ 1コマごとの scrollTo が打ち消し合って進まない
    await new Promise((res) => { const step = (t) => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, from + (end - from) * e); if (k < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    document.documentElement.style.scrollBehavior = rs;
  }, to, ms).catch(() => {});
  await page.evaluate(() => scrollTo(0, 0)).catch(() => {});
  await sleep(300);
  REC.start = Date.now() / 1000;   // 動画はここから（読み込みの途中は使わない）
  await page.evaluate(() => window.PVUiTrial && window.PVUiTrial.replay()).catch(() => {});
  await sleep(2600);
  /* 会社ページへは左メニューに入口が無い（AIRLINES は一覧）＝ ページの中から住所を変えて移る（ページまたぎの切り替えはそのまま起きる） */
  const go = (u) => page.evaluate((u) => { location.href = u; }, u).catch(() => {});
  const AIR = 'airlines/cathay-pacific.html?sw=0';
  if ((process.env.PAGE || '').startsWith('airlines/')) {
    /* 会社ページだけ（背景の2通りを比べる用）：開いた瞬間 → ゆっくり下まで → 上へ → 勤務・訓練 */
    await sleep(800);
    await glide('bottom', vw >= 600 ? 9000 : 12000); await sleep(1400); await glide(0, 1400); await sleep(600);
    await tap('a[data-pvg-tab="work"]'); await sleep(2400);
    await glide(vw >= 600 ? 900 : 1100, 2600); await sleep(1400);
  } else if (vw >= 600) {
    /* PC：開いた瞬間 → 1年 → 分析 → 給与サマリーを下へ（円・他社の年収）→ REAL PAY → ROADMAP → 会社ページ（題・評価・幅の棒・年数の点・円）→ 勤務・訓練（月の勤務の棒） */
    await tap('#pv-value .pt-tabs .pt-tab', 1); await sleep(2000);
    await glide(700, 1800); await sleep(1200); await glide(0, 900); await sleep(400);
    await tap('#pv-value .pt-tabs .pt-tab', 0); await sleep(1400);
    await tap('#pv-value .mv-tab', 2); await sleep(2400);
    await glide(520, 1600); await sleep(1200); await glide(0, 800); await sleep(400);
    await tap('#pv-value .mv-tab', 0); await sleep(1800);
    await glide('bottom', 5500); await sleep(1500); await glide(0, 1100); await sleep(500);
    await tap('.mr-side-a[href^="actual-pay"]'); await sleep(2600);
    await glide('bottom', 3000); await sleep(1200); await glide(0, 900); await sleep(400);
    await tap('.mr-side-a[href^="roadmap"]'); await sleep(3000);
    await glide(760, 2200); await sleep(1200);
    await go(AIR); await sleep(3600);
    await glide('bottom', 9000); await sleep(1600); await glide(0, 1400); await sleep(600);
    await tap('a[data-pvg-tab="work"]'); await sleep(2600);
    await glide(900, 2400); await sleep(1600);
  } else {
    /* スマホ：開いた瞬間 → ゆっくり下へ → 1年 → 分析 → ≡ から REAL PAY・ROADMAP → 会社ページを下まで → 勤務・訓練 */
    await glide('bottom', 8000); await sleep(1400); await glide(0, 1200); await sleep(600);
    await tap('#pv-value .pt-tabs .pt-tab', 1); await sleep(1800);
    await glide(1500, 3000); await sleep(1200); await glide(0, 900); await sleep(400);
    await tap('#pv-value .pt-tabs .pt-tab', 0); await sleep(1300);
    await tap('#pv-value .mv-tab', 2); await sleep(2200);
    await glide(900, 2200); await sleep(1200); await glide(0, 800); await sleep(400);
    await tap('.pv-ham-btn'); await sleep(1100);
    await tap('.mr-side-a[href^="actual-pay"]'); await sleep(2800);
    await glide('bottom', 3800); await sleep(1200); await glide(0, 900); await sleep(400);
    await tap('.pv-ham-btn'); await sleep(1100);
    await tap('.mr-side-a[href^="roadmap"]'); await sleep(2800);
    await glide(1300, 3000); await sleep(1200);
    await go(AIR); await sleep(3400);
    await glide('bottom', 11000); await sleep(1400); await glide(0, 1400); await sleep(600);
    await tap('a[data-pvg-tab="work"]'); await sleep(2400);
    await glide(1100, 2600); await sleep(1400);
  }
  await REC.cdp.send('Page.stopScreencast').catch(() => {});
  const dir = process.env.REC; fs.mkdirSync(dir, { recursive: true });
  const idx = REC.frames.map((f, i) => { const n = String(i).padStart(5, '0') + '.jpg'; fs.writeFileSync(path.join(dir, n), Buffer.from(f.data, 'base64')); return { f: n, t: f.t }; });
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ start: REC.start, frames: idx }));
  console.log('frames ' + idx.length + ' / ' + (idx.length ? (idx[idx.length - 1].t - idx[0].t).toFixed(1) : 0) + 's → ' + dir);
  await browser.close(); process.exit(0);
}
if (process.env.SAFE) {
  /* 一番下までスクロールしてから：動いている物の数・試作の印（ut-）の数・ページまたぎの切り替えの宣言があるか */
  const r = await page.evaluate(async () => {
    const H = document.documentElement.scrollHeight;
    for (let y = 0; y <= H; y += 200) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
    await new Promise((r) => setTimeout(r, 400));
    const ut = [...document.querySelectorAll("*")].filter((e) => [...e.classList].some((c) => c.startsWith("ut-") && c !== "ut-sw" && !c.startsWith("ut-sw"))).length;
    const vt = [...document.querySelectorAll("style")].some((s) => s.textContent.includes("@view-transition"));
    const running = document.getAnimations().filter((a) => a.playState === "running").length;
    return { ui: document.documentElement.getAttribute("data-ui"), running, utMarks: ut, pageVT: vt, pill: !!document.querySelector(".ut-rail-pill") };
  });
  console.log(JSON.stringify(r)); await browser.close(); process.exit(0);
}
if (process.env.WHAT) {
  const r = await page.evaluate((sel) => [...document.querySelectorAll(sel)].slice(0, 8).map((e) => { const s = e.closest("svg"); const b = s.getBoundingClientRect(); let p = s.parentElement; return e.tagName + " in svg " + Math.round(b.width) + "x" + Math.round(b.height) + " < " + p.tagName.toLowerCase() + "." + [...p.classList].join(".") + " < " + (p.parentElement.className || "").toString().split(" ")[0]; }), process.env.WHAT);
  r.forEach((x) => console.log("  " + x)); await browser.close(); process.exit(0);
}
if (process.env.ENDCHECK) {
  /* 一番下まで少しずつスクロールし、止まって4秒待つ → 棒・カードが本当の形で止まっているか（待ちの印が残っていないか） */
  const r = await page.evaluate(async () => {
    const H = document.documentElement.scrollHeight;
    for (let y = 0; y <= H; y += 180) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    await new Promise((r) => setTimeout(r, 4200));
    const vis = (e) => { const b = e.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight && b.width > 0; };
    const bars = [...document.querySelectorAll(".ut-hb,.ut-col,.ut-row,.ut-dot,.ut-hd,.ut-rad")];
    const bad = bars.filter((e) => { const cs = getComputedStyle(e), tf = cs.transform, sc = cs.scale; return (tf !== "none" && tf !== "matrix(1, 0, 0, 1, 0, 0)") || (sc !== "none" && sc !== "1"); });
    const lines = [...document.querySelectorAll(".ut-line")].filter((e) => { const cs = getComputedStyle(e); return cs.strokeDasharray !== "none" && parseFloat(cs.strokeDashoffset) !== 0; });
    const rings = [...document.querySelectorAll("svg.ut-pie circle[stroke-dasharray]")].filter((c) => c._utDash && c.getAttribute("stroke-dasharray") !== c._utDash);
    const pies = [...document.querySelectorAll("svg.ut-pie")].filter((e) => { const tf = getComputedStyle(e).transform; return tf !== "none" && tf !== "matrix(1, 0, 0, 1, 0, 0)"; });
    const faded = [...document.querySelectorAll(".ut-hf,.ut-leg-g>*,.ut-leg-w>*")].filter((e) => parseFloat(getComputedStyle(e).opacity) < 1);
    return { scrolled: scrollY, parts: bars.length, notFull: bad.length, lines: document.querySelectorAll(".ut-line").length, linesNotDrawn: lines.length, ringsShort: rings.length,
      pies: document.querySelectorAll("svg.ut-pie").length, piesTurned: pies.length, faded: faded.length,
      titlesSplit: document.querySelectorAll(".ut-split").length, legendsWaiting: document.querySelectorAll(".ut-leg-w").length,
      waiting: document.querySelectorAll(".ut-w").length, waitingVisible: [...document.querySelectorAll(".ut-w")].filter(vis).length, counting: document.querySelectorAll(".ut-counting").length };
  });
  console.log("止まったあと：" + JSON.stringify(r)); await browser.close(); process.exit(0);
}
if (process.env.CHAIN) {
  /* その字を含む一番内側の要素から、上へ向かって地の色・角・名前を並べる */
  const r = await page.evaluate((txt) => {
    const el = [...document.querySelectorAll("main *")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes(txt)))[0];
    if (!el) return ['not found'];
    const out = []; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); out.push(e.tagName.toLowerCase() + "." + [...e.classList].join(".") + " COLOR " + cs.color + " bg=" + cs.backgroundColor + " r=" + cs.borderTopLeftRadius); }
    return out;
  }, process.env.CHAIN);
  r.forEach((x) => console.log("  " + x)); await browser.close(); process.exit(0);
}
if (process.env.CARDS) {
  /* 角が丸く・地か枠があり・幅 200px 以上の箱（＝カードらしい物）を、名前ごとに数える */
  const r = await page.evaluate(() => {
    const m = new Map(); const main = document.querySelector("main") || document.body;
    for (const e of main.querySelectorAll("*")) {
      const cs = getComputedStyle(e), b = e.getBoundingClientRect();
      if (b.width < 200 || b.height < 60 || parseFloat(cs.borderTopLeftRadius) < 10) continue;
      if (cs.backgroundColor === "rgba(0, 0, 0, 0)" && cs.borderTopWidth === "0px") continue;
      const k = e.tagName.toLowerCase() + "." + [...e.classList].join(".") + " < " + (e.parentElement.className || e.parentElement.tagName).toString().split(" ")[0];
      m.set(k, (m.get(k) || 0) + 1);
    }
    return { url: location.pathname, main: !!document.querySelector("main"), list: [...m].slice(0, 30) };
  });
  console.log(r.url, "main=" + r.main); r.list.forEach(([k, n]) => console.log("  " + n + " × " + k));
  await browser.close(); process.exit(0);
}
if (process.env.DUMP) {
  const info = await page.evaluate(() => {
    const out = { big: [], bars: [], svg: [], cards: [] };
    const cn = (e) => e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).join(".") : (e.className && e.className.baseVal ? "." + e.className.baseVal : ""));
    for (const e of document.querySelectorAll("#pv-value *")) {
      const cs = getComputedStyle(e);
      if (e.children.length <= 2 && /\d/.test(e.textContent) && parseFloat(cs.fontSize) >= 22) out.big.push(cn(e) + " fs=" + cs.fontSize + " t=" + e.textContent.trim().slice(0, 30) + " < " + cn(e.parentElement));
    }
    for (const e of document.querySelectorAll("#pv-value .mv-pane:not([hidden]) :is(div,span,i,b)")) {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      if (r.height > 3 && r.height <= 14 && r.width > 20 && cs.backgroundColor !== "rgba(0, 0, 0, 0)" && !e.textContent.trim()) out.bars.push(cn(e) + " " + Math.round(r.width) + "x" + Math.round(r.height) + " < " + cn(e.parentElement));
    }
    for (const e of document.querySelectorAll("#pv-value .mv-pane:not([hidden]) svg")) out.svg.push(cn(e) + " kids=" + e.querySelectorAll("*").length + " " + [...new Set([...e.querySelectorAll("*")].map(x => x.tagName))].join(",") + " < " + cn(e.parentElement));
    for (const e of document.querySelectorAll("#pv-value .mr-card")) out.cards.push(cn(e) + " < " + cn(e.parentElement));
    return out;
  });
  const uniq = (a) => [...new Map(a.map(x => [x.replace(/\d+x\d+/, ""), x])).values()];
  for (const k of Object.keys(info)) { console.log("== " + k); uniq(info[k]).slice(0, 25).forEach(x => console.log("  " + x)); }
  await browser.close(); process.exit(0);
}
if (process.env.RMCHECK) {
  const r = await page.evaluate(async () => {
    const seen = { enter: 0, counting: 0, vt: 0, anim: 0 };
    const mo = new MutationObserver(() => { if (document.querySelector(".ut-enter")) seen.enter++; if (document.querySelector(".ut-counting")) seen.counting++; });
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
    const orig = document.startViewTransition; if (orig) document.startViewTransition = function () { seen.vt++; return orig.apply(this, arguments); };
    const b = [...document.querySelectorAll("#pv-value .mv-tab")][2]; b.click();
    await new Promise((r) => setTimeout(r, 900));
    seen.anim = document.getAnimations().filter((a) => a.playState === "running").length;
    seen.switched = b.classList.contains("on");
    mo.disconnect(); return seen;
  });
  console.log("動きを減らす設定：" + JSON.stringify(r));
  await browser.close(); process.exit(0);
}
if (process.env.CONTRAST) {
  /* 小さい字（14px 未満）と、その真後ろに実際に描かれている一番明るい色（＝地）との明暗の比。緑のカードの中は除く */
  await new Promise((r) => setTimeout(r, 2500));
  const shot = await page.screenshot({ encoding: "base64" });
  const res = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0);
    const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const out = []; const pane = document.querySelector("#pv-value .mv-pane:not([hidden])") || document.body;
    for (const el of pane.querySelectorAll("*")) {
      if (el.closest(".is-green") || el.closest("svg")) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join("");
      if (!own) continue;
      const cs = getComputedStyle(el); if (parseFloat(cs.fontSize) >= 14 || cs.visibility === "hidden") continue;
      const m = cs.color.match(/[\d.]+/g); if (!m || (m[3] && +m[3] < 1)) continue;
      const r = el.getBoundingClientRect(); if (r.width < 4 || r.bottom < 0 || r.top > innerHeight) continue;
      const x0 = Math.max(0, Math.floor(r.left)), y0 = Math.max(0, Math.floor(r.top)), ww = Math.min(Math.ceil(r.width), cv.width - x0), hh = Math.min(Math.ceil(r.height), cv.height - y0);
      if (ww < 1 || hh < 1) continue;
      const d = cx.getImageData(x0, y0, ww, hh).data;
      const Lt = lum(+m[0], +m[1], +m[2]);
      /* 地＝字の色から一番遠い明るさの画素（明るい字なら一番暗い所・暗い字なら一番明るい所） */
      let best = Lt; for (let i = 0; i < d.length; i += 4) { const L = lum(d[i], d[i + 1], d[i + 2]); if (Math.abs(L - Lt) > Math.abs(best - Lt)) best = L; } const c = (Math.max(best, Lt) + .05) / (Math.min(best, Lt) + .05);
      out.push({ c: Math.round(c * 100) / 100, t: own.slice(0, 18) });
    }
    out.sort((a, b) => a.c - b.c); return { n: out.length, low: out.filter((x) => x.c < 4.5), min: out[0] };
  }, shot);
  console.log("小さい字 " + res.n + " か所・いちばん低い " + JSON.stringify(res.min) + "・4.5 未満 " + res.low.length + " か所 " + JSON.stringify(res.low.slice(0, 8)));
  await browser.close(); process.exit(0);
}
if (process.env.LIVE) {
  /* 会社ページ用：上から下まで少しずつスクロールして、実データの欄（.crl[data-live]）が最後にどの形で止まったか・
     図の部品がいくつ描かれたか・console のエラー・止めた本番への通信を出す */
  const r = await page.evaluate(async () => {
    const H = document.documentElement.scrollHeight;
    for (let y = 0; y <= H; y += 240) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); }
    await new Promise((r) => setTimeout(r, 1200));
    window.scrollTo(0, 0);
    const slots = [...document.querySelectorAll('.crl[data-live]')].map((n) => n.dataset.live + '=' + n.dataset.state + (n.getClientRects().length ? '' : '(hidden)'));
    const n = (s) => document.querySelectorAll(s).length;
    return { slots, parts: { rangeBars: n('.crl-rg-t'), ydDots: n('.crl-yd-d'), ydBand: n('.crl-yd-bd'), donutArcs: n('.crl-dn-arc'),
      workBars: n('.crl-wb-b'), radarShape: n('.crl-radar-shape:not(.is-ph)'), radarDots: n('.crl-radar-dot'), sumItems: n('.crl-sum-li'),
      ghosts: n('.crl-ghost'), plates: n('.crl-plate'), payRows: n('.crl-row'), revCards: n('.crl-rev,.crl-revs > li') } };
  });
  console.log('欄：' + r.slots.join('  '));
  console.log('図：' + JSON.stringify(r.parts));
  console.log(ERRS.length ? 'console のエラー ' + ERRS.length + '件\n   ' + [...new Set(ERRS)].join('\n   ') : 'console のエラー 0件');
  console.log('止めた本番への通信 ' + BLOCKED.length + '件' + (BLOCKED.length ? '\n   ' + [...new Set(BLOCKED)].join('\n   ') : ''));
  await browser.close(); process.exit(0);
}
if (process.env.VIEW) await new Promise((r) => setTimeout(r, 1500));   // 1画面ぶんだけ撮る
if (!process.env.MID && !process.env.VIEW) {
  await new Promise((r) => setTimeout(r, process.env.UI ? 1500 : 0));   // 入る動きが終わるまで
  /* 背景とメニューは画面に固定 ＝ 長い1枚に撮ると上の1画面ぶんにしか出ない。画面の高さを中身に合わせてから撮る */
  const h = await page.evaluate(() => { window.scrollTo(0, 0); return document.documentElement.scrollHeight; });
  await page.setViewport({ width: vw, height: Math.min(h, 6000) });
  await new Promise((r) => setTimeout(r, 400));
}
await page.screenshot({ path: outPath, fullPage: false });

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

if (ERRS.length) console.log('console のエラー ' + ERRS.length + '件\n   ' + [...new Set(ERRS)].slice(0, 8).join('\n   '));
if (BLOCKED.length) console.log('止めた本番への通信 ' + BLOCKED.length + '件\n   ' + [...new Set(BLOCKED)].slice(0, 8).join('\n   '));
await browser.close();
console.log(outPath);
