/* shot-compare.mjs — 会社比較（deep-pay-compare.html）を localhost の実ページで撮る。

   shot-deep.mjs と同型。違いは1つだけ ── **会社コードごとに違う答えを返す**
   偽クライアントを入れる。1つの payload を返す偽物では左右が同じ数字になり、
   「差がつくポイント」も「トレードオフ」も出ないので配置の確認にならない。

   ★ ここで使う数字は全部でたらめ。実物の給与はこのリポジトリに1つも無い。
   ⚠️ shot-*.mjs の見本は**腐る**（CLAUDE.md の ST_LOCK と同じ）。
      「本番でもこう出る」と読まないこと。確かめるのは**配置だけ**。
   ⚠️ 画面は**2社そろうまで何も出さない**。だからここも
      「開く → 選択肢が生えるのを待つ → 2社選ぶ → 描き終わるのを待つ」まで
      やってから撮る。選ばずに撮ると、どの scene も同じ「2社選んでください」が写る。

   ★★2026-10-12（オーナー判断「会社比較はまだ出さないでよ」）── 会社比較は閉じている。
     **本番で出るのは scene: closed の1枚だけ**（「会社比較は準備中です」の板）。
     それ以外の scene は、閉じているあいだも**手元でだけ**本体を動かして撮る ── ページの
     どの script よりも先に window.__PV_COMPARE_OPEN = true を置く（deep-pay-compare.js の
     compareOpen() が、localhost で開いたときだけこの印を読む。本番の住所では効かない）。
     ＝ full 以下の絵は「出した日にこう出る」の確認で、いま本番に出ている絵ではない。

   実行: node shot-compare.mjs <scene> <lang> <theme> <幅> [通貨] [h=高さ] [open]
     scene: closed … ★いま本番で出ている画面。印を置かずに開く（＝配っているファイルのまま）。
                    誰が来ても板が1枚（題とリンクの2つの字だけ）。撮ったあとの「閉じている:」の
                    行で、rpc を1本も呼ばなかったこと・選ぶ欄や表が DOM に無いことを字でも
                    確かめられる。
            full … 両側そろった状態（モック2枚目と同じ配置。既定）
                   ★JAL 側が年収も Block Hours も上回るので**トレードオフが出る**
            thin … 片側が人数の壁に届かなかった状態（右だけ「まだ出せません」・左は普通に出る）
            drop … 片側にパーディアムが無い状態（★その行だけ表から消える。0 と書かない）
            nocomp … 片側（右）が、年収は出ているが給与構成が無い区分（2026-10-12。総支給だけの
                   人が集まった区分 ── サーバは comp・var・head.fixed_pct を null で返す）。
                   ★年収・Pay / Block Hour・Block Hours・ステイの行は並ぶ。固定・変動・手当・賞与の
                     行は表から消え、右の棒は「まだ出せません」。壊れた答えではない。
            two  … 片側（右）の給与構成が2行だけ（2026-10-12。基本給 60% ＋「その他・未分類」40%
                   ── ほかの項目は持つ人が足りず、サーバが未分類へ畳んだ形）。
            same … サーバの値は違うのに、円では同じ字になる行が在る状態
                   （★年収・Pay / Block Hour・固定・保証給比率の3行に差が付かない。
                     通貨を変えると、刻みの境目をまたぐ行だけ差が出る）
            ask  … まだ2社そろっていない（入口の板）
            dup  … 左右に同じ会社を選んだ
            few  … 比べられる会社が1社しか無い（★選択欄ごと出ない）
            lock … 鍵がまだ無い（給与を1件も出していない）＝板は3行＋断り
            det  … 鍵はあるが、答えていない項目が残っている＝板は2行（答え・100人）
                   ★「まだ答えていない項目」の一覧が出る（作り物：2026年9月分・6項目）
                   ★ボタンは給与フォームの内訳の節（#pay-detail）を指す
                   ★ボタンの上に断り（虚偽・不正確な情報について）が出る
            det0 … det と同じだが、残りの一覧が来ていない＝行と断りだけ・一覧の箱は出ない
            goal … 鍵も答えもそろっていて、100人だけが未達＝板は1行（断りは出ない）
                   （★前はここで「内訳を出すと開きます」と出ていた。直した不具合の絵）
            anon … ログインしていない人（2026-10-11・オーナー判断）。前はログイン画面へ
                   送っていた。いまは、会員の閉じた画面と**同じ**「ぼかした影絵＋板」が出る
                   ── 板は2行（鍵・答え）＋断り。一覧も100人の行も無い。
                   ★この scene だけ、偽のクライアントが「セッションなし」を返す。撮ったあとの
                     「未ログイン:」の行で、rpc を1本も呼ばなかったことを字でも確かめられる。
            ★lock / det / det0 / goal / anon は、板の後ろに**ぼかした影絵**が出る（2026-10-11・
              オーナー判断）。影絵は字も数字も無い形だけで、ここの見本の数字とは関係が無い。
              開いた scene（full / thin / ask / few …）と err には出ない。撮ったあとの
              「影絵:」の行で、ぼかしの強さと「字が0文字」を字でも確かめられる。
            err  … サーバが返らなかった
     lang : ja | en
     theme: light | dark
     通貨 : JPY | USD | EUR | GBP | AUD | SGD | AED（省くと、その言語の既定のまま）
            ★円のままでは見えない崩れがある ── 通貨を変えると字数が変わる。
              額の入る欄を触った回は、円以外でも1枚撮る。
            ⚠️ 英語ページの既定は**この機械のタイムゾーン**で決まる。英語の絵を
               人に見せるときは通貨を名指しする（省くと置き場所で絵が変わる）。
            位置は問わない（open / measure と同じく、引数のどこに書いてもよい）。
     h=   : 窓の高さ（px）。h=760 のように書く。省くと今までどおり 1000。位置は問わない。
            ★閉じた scene（lock / det / det0 / goal / anon）の板は、**窓の高さで置き場所が決まる**
              （2026-10-11。窓の縦の真ん中あたり ── deep-pay.css の .dp-stage）。幅だけ変えても
              確かめたことにならないので、ノートの高さ（760 前後）でも撮れるようにしてある。
            ★撮れる絵は今までどおりページ全体。上から h px が「開いた直後に見えている範囲」。
   保存先は screenshot.mjs と同じ ./temporary screenshots/

   末尾に open を付けると、撮らずに**見える窓で開いたまま**にする。
     node shot-compare.mjs full ja light 1440 open
     node shot-compare.mjs full en light 1440 EUR
*/
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scene = process.argv[2] || 'full';
const lang  = process.argv[3] || 'ja';
const theme = process.argv[4] || 'light';
const vw    = Number(process.argv[5]) || 1440;
const open  = process.argv.includes('open');
const measure = process.argv.includes('measure');
/* ★表示通貨（省略可）。通貨コードの形をした引数を、位置を問わず1つ拾う
   ＝ 今までの呼び方（scene lang theme 幅 [open|measure]）は1つも変わらない。
   効かせ方は shot-deep.mjs と同じ ──「その言語の保存先に、選んだ通貨として
   書いておく」（日本語＝pv-currency ／ 英語＝pv-currency-en）。currency.js が
   起動時に読む本物の道を通すので、切り替えの描き直しを待つ必要が無い。
   ⚠️ 通る通貨は currency.js の RATES に在るものだけ。無い通貨を渡すと既定のまま
      描かれるので、撮ったあとに実際の通貨を突き合わせて知らせる（下の「通貨」の行）。 */
const cur = process.argv.slice(2).find((a) => /^[A-Z]{3}$/.test(a)) || '';

/* ★窓の高さ（省略可・2026-10-11）。h=760 のように書く。省くと今までどおり 1000
   ＝ 今までの呼び方で撮れる絵は1つも変わらない。使いどころは冒頭の「h=」。 */
const winH = Number(((process.argv.slice(2).find((a) => /^h=\d+$/.test(a)) || '').split('=')[1])) || 1000;

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const label = `cmp-${scene}-${lang}-${theme}` + (vw !== 1440 ? `-${vw}` : '')
  + (winH !== 1000 ? `-h${winH}` : '') + (cur ? `-${cur}` : '');
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}deep-pay-compare.html`;

/* scene ごとに「窓の中で何を選ぶか」。★2社そろうまで何も出ないので、
   これが無いと撮れるのは入口の板だけになる。ask / lock / det / det0 / goal / anon / err は選ばない。 */
/* ★機材は左右**別々**（2026-09-01）。会社が違えば飛ばす機材も違うので、
   full は左右で違う機材を選ぶ ── 「それぞれの会社で選べる」がそのまま絵になる。 */
const PICK = {
  full: { a: 'ana', b: 'jal', pos: 'cap', fltA: 'b787', fltB: 'b777' },
  thin: { a: 'ana', b: 'sas' },
  drop: { a: 'ana', b: 'lufthansa' },
  /* nocomp / two は、右（JAL）の答えだけを scene に合わせて差し替える（下の pv_deep_pay）。 */
  nocomp: { a: 'ana', b: 'jal' },
  two:    { a: 'ana', b: 'jal' },
  same: { a: 'ana', b: 'emirates' },
  dup:  { a: 'ana', b: 'ana' }
}[scene] || null;

/* ★ headless:'new' はこの環境で page.screenshot() が返ってこない
   （shot-tracker.mjs に実測の経緯あり）。chrome-headless-shell を使う。 */
const browser = await puppeteer.launch(open
  ? { headless: false, defaultViewport: null, args: ['--no-sandbox', `--window-size=${vw},${winH}`] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = (await browser.pages())[0] || await browser.newPage();
if (!open) await page.setViewport({ width: vw, height: winH });

page.on('pageerror', (e) => console.log('❌ page error:', e.message));

/* ★ setRequestInterception は使わない（CDP デッドロック。shot-tracker.mjs 参照）。 */
await page.evaluateOnNewDocument((scene, theme, lang, cur) => {
  localStorage.setItem('pv-theme', theme);
  /* ★会社比較は閉じている（2026-10-12）。closed のほかの scene は、手元でだけ本体を動かす
       印を置く（deep-pay-compare.js の compareOpen()。localhost でしか効かない）。
     ⚠️ closed には置かない ── あの scene は「配っているファイルのまま」を撮る。 */
  if (scene !== 'closed') window.__PV_COMPARE_OPEN = true;
  /* ★撮影で解析に足あとを残さない（2026-10-11）。ページは load のあと gtag を読むので、
     立てておかないと、撮るたびに localhost の閲覧が本物の GA4 に1件ずつ入る
     （検査の側 ── assert-*.mjs ── は前からこの1行を立てている）。 */
  window['ga-disable-G-3XYF69VQ3X'] = true;
  if (cur) localStorage.setItem(lang === 'en' ? 'pv-currency-en' : 'pv-currency', cur);
  const UID = '00000000-0000-4000-8000-00000000a001';
  const STATS = { reports: 58, month: 12, airlines: 19, contributors: 37 };

  /* 会社ごとの見本。★合計はちょうど100（本番は pv_deep_pct が最大剰余法で揃える）。
     ⚠️ night / weekend / holiday は3つのまま。1行にまとめない（仕様の明示的な禁止）。
     ★形は db/deep-pay.sql の返り値（2026-10-11）──
       ・区分の人数は**入れない**（cohort.n / head.detailed_n / head.verified_n /
         comp.n / comp.bonus.n はサーバが返さなくなった）。代わりは信頼度の段（trust）。
       ・見出しの2つは刻み（annual_usd は $50・per_block_usd は $0.5）。
         給与構成の月額（avg_usd）と月換算（month_usd）は有効数字2桁。
       ・★2026-10-12 の形 ── head は { annual_usd, per_block_usd, month_usd, fixed_pct,
         bonus_est, bonus_gap }。給与構成は内訳を書いた人の**平均**で、金額の鍵は avg_usd
         （未分類にも金額が来る）。年収が出ていて comp が null の区分も在る。
         ⚠️ この画面（会社比較）は、足された month_usd と賞与の目印を**まだ読まない**
            （閉じている。deep-pay-compare.js の MET の bonus の注）。見本に入れてあるのは、
            本物と同じ形の答えで描いても何も崩れないことを見るため。 */
  const AIR = {
    ana: {
      trust: 'high',
      head: { annual_usd: 119700, per_block_usd: 103.5, month_usd: 9500, fixed_pct: 62,
              bonus_est: true, bonus_gap: false },
      comp: { total_kind: 'monthly_cash', bonus: { pct_of_annual: 5 },
        segs: [
          { k: 'base',     pct: 52, avg_usd: 4800 },
          { k: 'variable', pct: 24, avg_usd: 2200 },
          { k: 'command',  pct: 8,  avg_usd: 730 },
          { k: 'perdiem',  pct: 7,  avg_usd: 640 },
          { k: 'housing',  pct: 5,  avg_usd: 460 },
          { k: 'other',    pct: 4,  avg_usd: 370 }
        ] },
      work: { block_h: 74.0, duty_h: 141.0, duty_days: 18, stay_nights: 9 }
    },
    /* ★年収も Block Hours もステイも上回る＝**トレードオフの文が出る**側。
       「たくさん飛んでたくさんもらう」がひと目で分かる形にしてある。 */
    jal: {
      trust: 'mid',
      head: { annual_usd: 127950, per_block_usd: 105.5, month_usd: 9800, fixed_pct: 55,
              bonus_est: true, bonus_gap: false },
      comp: { total_kind: 'monthly_cash', bonus: { pct_of_annual: 8 },
        segs: [
          { k: 'base',     pct: 46, avg_usd: 4900 },
          { k: 'variable', pct: 31, avg_usd: 3300 },
          { k: 'command',  pct: 9,  avg_usd: 950 },
          { k: 'perdiem',  pct: 6,  avg_usd: 640 },
          { k: 'housing',  pct: 4,  avg_usd: 420 },
          { k: 'rest',     pct: 4,  avg_usd: 430 }
        ] },
      work: { block_h: 79.5, duty_h: 152.0, duty_days: 19, stay_nights: 12 }
    },
    /* ★パーディアムの区分が無い会社。表の「パーディアム比率」の行が
       **まるごと消える**ことを見るための見本。0% と書いたら負け。 */
    lufthansa: {
      trust: 'mid',
      head: { annual_usd: 96050, per_block_usd: 84.5, month_usd: 7500, fixed_pct: 71,
              bonus_est: false, bonus_gap: true },
      comp: { total_kind: 'monthly_cash', bonus: null,
        segs: [
          { k: 'base',     pct: 68, avg_usd: 5100 },
          { k: 'variable', pct: 19, avg_usd: 1400 },
          { k: 'housing',  pct: 8,  avg_usd: 600 },
          { k: 'other',    pct: 5,  avg_usd: 380 }
        ] },
      work: { block_h: 66.0, duty_h: 124.0, duty_days: 16, stay_nights: 6 }
    },
    /* ★丸めた後の**表示文字列**が ANA と同じになる見本（年収・Pay / Block Hour・
       固定・保証給比率の3行）。年収と Pay / Block Hour は、サーバの値は違うのに円では同じ字になる
       （$119,700 と $119,750 → どちらも ¥1,903万／$103.5 と $104 → どちらも ¥16,500）。
       ここで差の数値を書いたら、同じ数字が2つ並んでいるのに違うと言うことになる。
       ★ユーロで撮ると年収だけ €102K と €103K に割れて差が出る（刻みの境目をまたぐ）。
         それで正しい ── どの通貨でも、画面の2つの字と差は辻褄が合っている。 */
    emirates: {
      trust: 'low',
      head: { annual_usd: 119750, per_block_usd: 104, month_usd: 9500, fixed_pct: 62,
              bonus_est: false, bonus_gap: false },
      comp: { total_kind: 'monthly_cash', bonus: { pct_of_annual: 5 },
        segs: [
          { k: 'base',     pct: 49, avg_usd: 5200 },
          { k: 'variable', pct: 21, avg_usd: 2200 },
          { k: 'perdiem',  pct: 12, avg_usd: 1250 },
          { k: 'housing',  pct: 14, avg_usd: 1480 },
          { k: 'other',    pct: 4,  avg_usd: 420 }
        ] },
      work: { block_h: 74.2, duty_h: 138.0, duty_days: 17, stay_nights: 13 }
    }
  };

  /* ★選べる組み合わせ（2026-09-01）。画面はこれで選択肢を絞る。形は
     db/deep-pay.sql の avail と同じ ── 会社 / 会社ごとの職位 /「会社|職位」ごとの機材。
     空文字の鍵は「そこで絞っていない」。
     ★**会社ごとに機材を変えてある。** 会社を変えると機材の欄が入れ替わるのが
       窓の中で踏める（「会社が違うんだから機種もそれぞれ」を絵にしたもの）。
     ⚠️ 本番のどの会社・どの機材が出るかとは何の関係も無い（この一覧も作り物）。 */
  const FL = {
    ana:             { cap: ['a320', 'b777', 'b787'], fo: ['a320', 'b787'] },
    jal:             { cap: ['b767', 'b777', 'b787'], fo: ['b737', 'b787'] },
    lufthansa:       { cap: ['a320', 'a350', 'b747'], fo: ['a320'] },
    emirates:        { cap: ['a380', 'b777'],         fo: ['b777'] },
    /* ★sas は「人数の壁に届かなかった」側の見本（AIR に見本を持たない）。
       **thin の絵を撮る回だけ**一覧に入れる ── 本来の約束（選べる＝必ず
       数字が返る）をわざと破って、空の板を窓の中で踏めるようにするための細工。
       他の scene では入れない＝窓の中の選択肢はどれを選んでも数字が返る。 */
    sas:             { cap: ['a320'],                 fo: ['a320'] },
    /* ★名前が一番長い2社（下の WIDE）。**絵のためではなく measure のため。**
       欄の幅は「一番長い選択肢」で決まるので、見本4社だけで測ると
       本番より 150px ほど短く見え、足りない幅を「足りている」と読み違える。 */
    swiss:           { cap: ['a320', 'a330'],         fo: ['a320'] },
    'shin-central':  { cap: ['dhc8'],                 fo: ['dhc8'] }
  };
  /* ★一覧に出る会社のうち、名前が一番長い2社 ── ja の最長
     「スイス インターナショナル エアラインズ」と en の最長
     「Shin Chuo Airlines (Shin Nichi Aviation)」。本番の一覧にもこの2社は
     普通に出得るので、**欄の幅はここまで含めて測らないと足りない。**
     数字は右側の見本を使い回す（「選べる＝必ず数字が返る」を破らないため）。 */
  const WIDE = { swiss: 'lufthansa', 'shin-central': 'lufthansa' };
  const PICKS = (function () {
    /* ★一覧は AIR（見本を持っている会社）からしか作らない。ここに見本の無い
       会社を書くと、窓の中で選べるのに空の板が出る＝直したはずの不具合が
       絵の中だけ再発する。 */
    const air = scene === 'few' ? ['ana']
      : Object.keys(AIR).concat(Object.keys(WIDE))
          .concat(scene === 'thin' ? ['sas'] : []).sort();
    const uniq = (l) => [...new Set(l)].sort();
    const pos = { '': ['cap', 'fo'] }, flt = {};
    const all = [];
    for (const c of air) {
      pos[c] = Object.keys(FL[c]).sort();
      const mine = [];
      for (const k of pos[c]) { flt[c + '|' + k] = FL[c][k].slice().sort(); mine.push(...FL[c][k]); }
      flt[c + '|'] = uniq(mine);
      all.push(...mine);
    }
    flt['|'] = uniq(all);
    for (const k of pos['']) flt['|' + k] = uniq(air.flatMap((c) => FL[c][k] || []));
    return { air, pos, flt };
  })();
  /* ★gate.crowd ＝「みんなの側」の門（100人以上 or 手動の公開フラグ）。
       37 / 100 人のまま開いている見本は「手動フラグで開けた日」の形＝ crowd:true。
     ★gate.ready / gate.todo ＝本人の側の門（2026-10-11）。ready ＝自分に当てはまる項目を
       ぜんぶ答えた月を持っているか。todo ＝足りない人にだけ { year, month, items:[コード…] }。
       **前の鍵 detailed は gate に無い**（外の give.detailed は別物 ── pv_my_give の答え。
       読んでいた3段の表の DEEP PAY の札は 2026-10-11 に外したので、いま画面でこれを使う所は無い）。 */
  const OPEN = { key: true, ready: true, todo: null, crowd: true, contributors: 37, goal: 100 };
  const BOOT = { ok: true, state: 'open', stats: STATS, give: { detailed: true },
                 gate: OPEN,
                 picks: PICKS,
                 cohort: null, head: null, comp: null, work: null, var: null };
  /* 錠前の板。当てはまる行だけが出る（deep-pay-compare.js の lockLines）。
       lock … 鍵が無く、答えきってもおらず、100人も未達＝3行。残りの一覧は無い
       det  … 鍵は在るが答えきっていない＝2行（答え・100人）。**残っている項目の一覧つき**。
              ボタンは給与フォームの内訳の節へ
       det0 … det と同じで、一覧だけが来ていない（todo が null）
       goal … 鍵も答えもそろっていて、100人だけが未達＝1行
              （★前はこの人に「内訳を出すと開きます」と出ていた）
     ★「答えきっていない」の行が出る3つ（lock / det / det0）には、ボタンの上に断りが出る。
     ★一覧の中身は作り物（2026年9月分・6項目）。shot-deep.mjs の TODO と同じ。 */
  const TODO = { year: 2026, month: 9,
                 items: ['command', 'bonus', 'profit', 'duty_h', 'duty_days', 'instructor'] };
  const LOCK = Object.assign({}, BOOT, { state: 'locked', give: { detailed: false }, picks: null,
                 gate: { key: false, ready: false, todo: null, crowd: false, contributors: 37, goal: 100 } });
  const GOAL = Object.assign({}, BOOT, { state: 'locked', give: { detailed: true }, picks: null,
                 gate: { key: true, ready: true, todo: null, crowd: false, contributors: 37, goal: 100 } });
  const DET  = Object.assign({}, BOOT, { state: 'locked', give: { detailed: true }, picks: null,
                 gate: { key: true, ready: false, todo: TODO, crowd: false, contributors: 37, goal: 100 } });
  const DET0 = Object.assign({}, BOOT, { state: 'locked', give: { detailed: false }, picks: null,
                 gate: { key: true, ready: false, todo: null, crowd: false, contributors: 37, goal: 100 } });

  /* 人数の壁に届かなかった側。★広い区分に登らないので、出るものが何も無い。
     「あと1人」とも、壁が何人かとも書かない（書くと人数が1人単位で読める）。
     本物も head / comp / work / var を返り値ごと null にする（trust も null）。 */
  function thin(code, q) {
    return { ok: true, state: 'open', stats: STATS, give: { detailed: true },
      gate: OPEN,
      cohort: { level: 'none', manual: true, airline: code,
                pos: q.position || null, fleet: q.fleet || null, trust: null },
      head: null, comp: null, work: null, var: null };
  }

  /* ★職位・機材で数字が動く（2026-09-01）。前はここが会社しか見ておらず、
     窓の中で役職や機材を変えても1円も動かなかった ── オーナーが最初に
     気づいたのがこれ。本番は db/deep-pay.sql の0段が3つとも見て絞っている。
     ⚠️ 係数はでたらめ。「機長は副操縦士の何倍」を読み取らないこと。 */
  const POSK = { cap: 1, fo: 0.66, cadet: 0.4 };
  const FLTK = { a380: 1.14, b747: 1.12, b777: 1.1, b787: 1.06, a350: 1.05,
                 b767: 0.97, a330: 1.02, a320: 0.92, b737: 0.9 };
  const RPC = {
    /* ★引数なし＝入口の1回（state と鍵を取りに行くだけ）。
       会社を渡されたら**その会社の見本**に、職位・機材の係数を掛けて返す。
       ここを1つの payload に潰すと左右が同じ数字になり、確かめたい配置が
       全部消える。
       ⚠️ 一覧に無い会社は「人数の壁に届かなかった」を返す ── 空の状態を窓の中で
          実際に踏めるようにするための細工で、本番の人数とは何の関係も無い。 */
    pv_deep_pay: (a) => {
      const q = (a && a.p) || {};
      if (!q.airline) return scene === 'lock' ? LOCK : scene === 'goal' ? GOAL
        : scene === 'det' ? DET : scene === 'det0' ? DET0 : BOOT;
      const src = AIR[q.airline] || AIR[WIDE[q.airline]];
      if (!src) return thin(q.airline, q);
      const k = (POSK[q.position] || 1) * (FLTK[q.fleet] || 1);
      const r2 = (v) => (v == null ? v : Math.round(v * k * 10) / 10);
      /* ★見出しの2つは本物と同じ刻みで返す（db/deep-pay.sql の pv_deep_step）──
           年収 $50・Pay / Block Hour $0.5。丸い数で返すと、画面が刻みで出していることが
           絵から分からない。 */
      const st = (v, p) => (v == null ? v : Math.round(v * k / p) * p);
      /* ★月換算（month_usd）と給与構成の月額（avg_usd）は、本物と同じ有効数字2桁で返す
           （db/deep-pay.sql の pv_sig2）。null は null のまま。 */
      const sg = (v) => {
        if (v == null) return v;
        const x = v * k;
        if (!(x > 0)) return x;
        const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
        return Math.round(x / p) * p;
      };
      /* ★区分の人数は返さない。返すのは信頼度の段だけ（会社ごとの見本の trust）。
         本物は人数と区分の広さの低いほうで段を決める（db/deep-pay.sql の trust）。
         ここは絞っても段を動かさない ── 左右の札が違う絵を撮るための作り物。 */
      /* ★割合（pct）は係数を掛けない ── 合計 100 が崩れる。動かすのは金額と時間だけ。 */
      let comp = src.comp && Object.assign({}, src.comp, {
        segs: src.comp.segs.map((g) => Object.assign({}, g, { avg_usd: sg(g.avg_usd) })) });
      let fixed = src.head.fixed_pct, vari = [];
      /* ★nocomp / two（2026-10-12）── 右（JAL）の答えだけを差し替える。
           nocomp … 給与構成の母集団（内訳を書いた人）が壁に届かない形。本物と同じく
                    comp・var・head.fixed_pct が null（年収・Pay / Block Hour・働き方は出たまま）
           two    … 給与構成が2行だけ（基本給 60% ＋ 未分類 40%。固定・保証給比率は基本給の 60） */
      if (scene === 'nocomp' && q.airline === 'jal') { comp = null; fixed = null; vari = null; }
      if (scene === 'two' && q.airline === 'jal') {
        comp = { total_kind: 'monthly_cash', bonus: null,
                 segs: [{ k: 'base', pct: 60, avg_usd: sg(6000) }, { k: 'rest', pct: 40, avg_usd: sg(4000) }] };
        fixed = 60;
        vari = [{ k: 'block', pct: 80 }, { k: 'rest', pct: 20 }];
      }
      const work = src.work && { block_h: r2(src.work.block_h), duty_h: r2(src.work.duty_h),
                                 duty_days: src.work.duty_days, stay_nights: src.work.stay_nights };
      return { ok: true, state: 'open', stats: STATS, give: { detailed: true },
        gate: OPEN,
        cohort: { level: 'selected', manual: true, airline: q.airline,
                  pos: q.position || null, fleet: q.fleet || null, trust: src.trust },
        head: Object.assign({}, src.head, { annual_usd: st(src.head.annual_usd, 50),
                                            per_block_usd: st(src.head.per_block_usd, 0.5),
                                            month_usd: sg(src.head.month_usd), fixed_pct: fixed }),
        /* ★var は、この画面では描かない（変動給の中身は DEEP PAY の側）。形だけ本物に合わせる ──
             null（給与構成が無い）か配列（鍵に rest が来ることがある）。 */
        comp: comp, work: work, var: vari };
    },
    pv_pay_rows: () => ({ ok: true, state: 'open', rows: [], stats: STATS,
                          give: { detailed: true } }),
    pv_give_progress: () => ({ ok: true, contributors: STATS.contributors,
                               give: { detailed: true } }),
    pv_my_referral: () => ({ ok: true, code: 'SAMPLE', tier: 0 })
  };

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
  /* ★anon だけ「セッションなし」を返す（2026-10-11）。画面はログイン画面へ送らず、
       会員の閉じた画面と同じ器を、サーバに聞かずに描く。rpc を呼んだ回数を数えておく
       （__shotRpc。anon で 0 のままなら、聞きに行っていない）。 */
  window.__shotRpc = 0;
  const FAKE = {
    auth: {
      getSession: async () => ({ data: { session: scene === 'anon' ? null
        : { user: { id: UID, email: 'pilot@example.com' } } } }),
      getUser:    async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
      signOut:    async () => ({ error: null })
    },
    from: (t) => {
      if (t === 'profiles') return q([{ id: UID, name: 'Sample Pilot',
        email: 'pilot@example.com', company: 'ANA', position: 'fo' }]);
      return q([]);
    },
    /* err のときだけ error を返す。★画面が「読み込めませんでした」を出すか、
       それとも 0 を並べるかは、ここでしか見分けられない。 */
    rpc: async (name, a) => {
      window.__shotRpc++;
      return (scene === 'err' && name === 'pv_deep_pay')
        ? { data: null, error: { message: 'synthetic failure' } }
        : { data: RPC[name] ? RPC[name](a) : { ok: true }, error: null };
    }
  };
  Object.defineProperty(window, 'supabase', {
    value: { createClient: () => FAKE }, writable: false, configurable: false
  });
}, scene, theme, lang, cur);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
/* ★時間で待たない（混んだ回に嘘の結果が出る）。「描き終わった」条件で待つ。
   deep-pay-compare.js は必ず #dc-hd に <h1> を書き込んでから他を描く。
   ★closed（2026-10-12）は別 ── 器の中身が板1枚に置き換わる（見出しの器も骨組みも無い）。 */
if (scene === 'closed') {
  await page.waitForFunction(
    () => !!document.querySelector('#dc-root .dc-closed') && !document.querySelector('#dc-root .mr-skel'),
    { timeout: 15000 });
} else {
  await page.waitForFunction(
    () => !!document.querySelector('#dc-hd h1'), { timeout: 15000 });
  await page.waitForFunction(
    () => !document.querySelector('#dc-sides .mr-skel'), { timeout: 15000 });
}

if (PICK) {
  const IDS = { a: 'dc-pk-a', b: 'dc-pk-b', pos: 'dc-pk-pos',
                fltA: 'dc-pk-fa', fltB: 'dc-pk-fb' };
  /* ★2段に分けて入れる（2026-09-01）。機材の選択肢は「選んだ会社 × 役職」で
     入れ替わるので、会社を入れる前に機材を入れても**選択肢がまだ生えていない**。
     value に無い値を入れると空文字のまま静かに素通りし、「選んだのに何も
     出ない」という嘘の絵になる。本物の操作と同じ順番でしか踏めない。 */
  const put = async (part) => {
    /* 選択肢が生えるのを待つ。語彙（pv-vocab.json / pv-airlines.json）は
       RPC より遅れて着くことがある。 */
    await page.waitForFunction((p, ids) => Object.keys(p).every((k) =>
      !!document.querySelector('#' + ids[k] + ' option[value="' + p[k] + '"]')),
      { timeout: 15000 }, part, IDS);
    await page.evaluate((p, ids) => {
      let last = null;
      for (const k of Object.keys(p)) {
        const e = document.getElementById(ids[k]);
        if (e) { e.value = p[k]; last = e; }
      }
      /* まとめて入れてから change を1回。★1つずつ投げると、途中の
         「片方だけ選んだ対」で余計な RPC が走る。 */
      if (last) last.dispatchEvent(new Event('change', { bubbles: true }));
    }, part, IDS);
  };
  const step1 = {}, step2 = {};
  for (const k of Object.keys(PICK)) (k === 'fltA' || k === 'fltB' ? step2 : step1)[k] = PICK[k];
  await put(step1);
  if (Object.keys(step2).length) await put(step2);
  /* 描き終わり＝表・カード・板のどれかが在って骨が消えたこと。
     ⚠️ カード（#dc-sides .dc-side）だけを待たない。2026-08-31 から、
        **両方読めるときはカードが出ない**（表の見出しが受け持つ）ので、
        正常な画面ほど待ち続けて 15秒でタイムアウトする。 */
  await page.waitForFunction(
    () => !document.querySelector('#dc-sides .mr-skel') &&
          !!document.querySelector('#dc-diff .dc-tbl, #dc-sides .dc-side, #dc-sides .dp-msg'),
    { timeout: 15000 });
}

/* ★測る前にフォントが載り切るのを待つ。Inter は外から読むので、載る前に測ると
   代替フォント（横に広い）の幅で数えてしまい、**同じ CSS なのに回ごとに違う答え**
   が出る（実測で 570px→920 / 580px→938 / 610px→950 と単調でない並びになった）。
   ⚠️ sleep で待たない。混んだ回に足りなくなって、また同じ揺れが戻る。 */
await page.evaluate(() => document.fonts.ready);
/* ── 実測（`measure` を付けたとき）────────────────────────────────
   ★スクショを目で見て「詰まっている気がする」で直さない。ここで数える。
     <select> は中身が入り切らなくても**黙って端で切る**（省略記号すら出ない）ので、
     選択肢の実幅を canvas で測り、欄の内寸と突き合わせる。 */
if (measure) {
  const rep = await page.evaluate(() => {
    const px = (v) => Math.round(v * 10) / 10;
    const cv = document.createElement('canvas').getContext('2d');
    const sels = [...document.querySelectorAll('.dp-pick-s')].map((e) => {
      const cs = getComputedStyle(e);
      cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const widest = [...e.options].reduce(
        (a, o) => Math.max(a, cv.measureText(o.text).width), 0);
      const inner = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const selw = cv.measureText(e.selectedOptions[0]?.text || '').width;
      return { id: e.id, font: cs.fontSize, box: px(e.getBoundingClientRect().width),
               inner: px(inner), widest: px(widest), sel: e.selectedOptions[0]?.text || '',
               /* ★見えているのは「選んだ1つ」。落ちるのはそれが切れたときだけ。
                  いちばん長い選択肢は、開いた一覧の中でしか出ない（端末側の描画）。 */
               cut: px(inner - 18 - selw),
               short: px(inner - 18 - widest) };   // 18px ≒ 端末の▼
    });
    const box = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { sel, x: px(r.left), y: px(r.top + scrollY), w: px(r.width), h: px(r.height) };
    };
    const cond = [...document.querySelectorAll('#dc-cond .dp-cond > *')].map((e) => {
      const r = e.getBoundingClientRect();
      return `${e.className || e.tagName} ${px(r.left)}..${px(r.right)}`;
    });

    /* ★たて ── この画面の主題。「収まっていない」はここ1本で数える。
       innerHeight は窓の高さ。中身の底がそれを超えたらスクロールが要る。 */
    const rows = [];
    (function walk(el, d) {                 /* ★段だけでは「どこが厚いか」が分からない。
                                               カードの中も3段だけ降りる（それ以上は読めない）。 */
      for (const c of el.children) {
        const q = c.getBoundingClientRect();
        if (q.height < 6) continue;
        const nm = c.id ? '#' + c.id
          : (typeof c.className === 'string' && c.className.trim()
              ? '.' + c.className.trim().split(/\s+/)[0] : c.tagName.toLowerCase());
        rows.push({ id: '  '.repeat(d) + nm, y: px(q.top + scrollY),
                    h: px(q.height), b: px(q.bottom + scrollY) });
        if (d < 3) walk(c, d + 1);
      }
    })(document.getElementById('dc-root'), 0);
    return { sels, cond, rows, vh: innerHeight,
      bottom: rows.reduce((a, r) => Math.max(a, r.b), 0),
      boxes: ['#dc-pick .dp-pick', '#dc-cond .dp-cond', '#dc-trade .mr-card',
              '#dc-diff .mr-card', '#dc-mix .mr-card'].map(box).filter(Boolean) };
  });
  console.log(`── ${scene} / ${lang} / ${theme} / ${vw}px ──`);
  for (const s of rep.sels)
    console.log(`  ${s.cut < 0 ? '❌' : (s.short < 0 ? '△' : '✓ ')} ${s.id.padEnd(10)} `
      + `欄 ${String(s.box).padStart(6)}px 内寸 ${String(s.inner).padStart(6)} / `
      + `いま出ている ${String(s.cut).padStart(6)} / 最長 ${String(s.short).padStart(6)}  [${s.sel}]`);
  console.log('  条件バー: ' + (rep.cond.join(' | ') || '（無し）'));
  console.log(`  ─ たて（窓 ${vw}x${rep.vh}）─`);
  for (const r of rep.rows)
    console.log(`    ${r.id.padEnd(30)} y${String(r.y).padStart(6)} h${String(r.h).padStart(6)}`
      + ` → ${String(r.b).padStart(6)}`);
  {
    const gap = Math.round((rep.vh - rep.bottom) * 10) / 10;
    console.log(`    ${gap >= 0 ? '✓ 1画面に収まる' : '❌ はみ出す'}`
      + ` ── 底 ${rep.bottom} / 窓 ${rep.vh}`
      + `（${gap >= 0 ? '余り ' + gap : 'あと ' + -gap + ' 縮める'}）`);
  }
  for (const b of rep.boxes)
    console.log(`  ${b.sel.padEnd(24)} x${String(b.x).padStart(6)} y${String(b.y).padStart(6)} `
      + `w${String(b.w).padStart(6)} h${String(b.h).padStart(6)}`);
  await browser.close();
  process.exit(0);
}

if (open) {
  console.log(`開きました（${scene} / ${lang} / ${theme}）。窓を閉じると終わります。`);
  await new Promise((r) => browser.on('disconnected', r));
  process.exit(0);
}
await page.screenshot({ path: outPath, fullPage: true });

/* ★横スクロールはスクショに写らない。幅を指定して撮ったら必ず数えて出す。 */
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

/* ★撮った画面の見出しの数字を、字でも出す（絵から読み取ると1桁を読み違える）。
   通貨も一緒に出す ── 名指しした通貨が currency.js に無いと既定のまま描かれるので、
   「頼んだ通貨」と「実際の通貨」が違えばここで分かる。 */
const said = await page.evaluate(() => {
  const cell = (e) => {
    if (!e) return '';
    const n = e.querySelector('.dc-c-a');
    let x = e.textContent || '';
    if (n) x = x.replace(n.textContent, '');
    return x.replace(/\s+/g, ' ').trim();
  };
  return {
    cur: (window.PVCurrency && window.PVCurrency.get) ? window.PVCurrency.get() : '',
    cond: ((document.querySelector('#dc-cond .dp-cond') || {}).innerText || '').replace(/\n/g, ' '),
    chips: [...document.querySelectorAll('#dc-root .dc-side-c')].map((e) => e.textContent.trim()),
    rows: [...document.querySelectorAll('#dc-diff .dc-tr:not(.dc-th)')].slice(0, 2).map((r) =>
      ((r.querySelector('.dc-c1') || {}).textContent || '') + ' ' +
      cell(r.querySelector('.dc-c2')) + ' ／ ' + cell(r.querySelector('.dc-c3'))),
    card: [...document.querySelectorAll('#dc-sides .dc-kv')].slice(0, 2)
      .map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
    /* 板の行（1行ずつ <p>。2026-10-11 から）。 */
    lock: [...document.querySelectorAll('#dc-sides .dp-msg--lock .dp-msg-s')]
      .map((e) => e.innerText.replace(/\n/g, ' ')),
    /* まだ答えていない項目の一覧（見出しと札）と、ボタンの上の断り。出ていなければ空。 */
    todoH: ((document.querySelector('.dp-msg--lock .dp-todo-h') || {}).textContent || ''),
    todo: [...document.querySelectorAll('.dp-msg--lock .dp-todo-i')].map((e) => e.textContent),
    warn: ((document.querySelector('.dp-msg--lock .dp-msg-w') || {}).textContent || ''),
    /* 板のボタンの行き先（足りない物に合わせて変わる。deep-pay-compare.js の lockHref）。 */
    cta: [...document.querySelectorAll('.dp-msg--lock a.dp-cta')].map((e) => e.getAttribute('href')).join(','),
  };
});
console.log(`通貨: ${said.cur}` + (cur && said.cur !== cur ? `  ❌ 頼んだのは ${cur}（currency.js に無い通貨）` : ''));
if (said.cond) console.log('条件バー: ' + said.cond);
if (said.chips.length) console.log('信頼度の札: ' + said.chips.join(' ｜ '));
if (said.rows.length) console.log('見出し: ' + said.rows.join(' ｜ '));
if (said.card.length) console.log('カード: ' + said.card.join(' ｜ '));
if (said.lock.length) console.log('板の行: ' + said.lock.join(' ／ '));   // 錠前の板と「まだ出せません」の板は同じ器
if (said.todoH) console.log('板の一覧: ' + said.todoH + ' ── ' + said.todo.join(' ｜ '));
if (said.warn) console.log('板の断り: ' + said.warn);
if (said.cta) console.log('板のボタンの先: ' + said.cta);

/* ★板の後ろの影絵（2026-10-11）。閉じた scene にだけ出る・字は1文字も入っていない、を
   絵と一緒に字でも出す（ぼかしの下に字が在っても、絵からは見分けられない）。 */
const ghost = await page.evaluate(() => {
  const g = document.querySelector('.dp-ghost');
  const blurred = [...document.querySelectorAll('main *')]
    .filter((e) => getComputedStyle(e).filter !== 'none').length;
  if (!g) return { on: false, blurred };
  return { on: true, blurred, blur: getComputedStyle(g).filter, chars: g.textContent.length,
           inert: g.inert === true, hidden: g.getAttribute('aria-hidden') };
});
{
  const shut = ['lock', 'det', 'det0', 'goal', 'anon'].includes(scene);
  if (ghost.on)
    console.log(`${shut && ghost.chars === 0 && ghost.inert && ghost.hidden === 'true' && ghost.blurred === 1 ? '✓' : '❌'} 影絵: `
      + `${ghost.blur}・字 ${ghost.chars} 文字・inert=${ghost.inert}・aria-hidden=${ghost.hidden}`
      + `・ぼかしの効いた要素 ${ghost.blurred}` + (shut ? '' : '  ← 閉じていない scene に影絵が在る'));
  else if (shut) console.log('❌ 影絵が無い（閉じた scene なのに、板の後ろに何も出ていない）');
  else if (ghost.blurred) console.log(`❌ 開いた scene に、ぼかしの効いた要素が ${ghost.blurred} つ在る`);
}

/* ★closed（2026-10-12）だけ：板の字と行き先・聞きに行かなかったこと・比較の部品が DOM に
   無いことを、絵と一緒に字でも出す。見本の会員は「開いている会員」── その人にも出ない。 */
if (scene === 'closed') {
  const c = await page.evaluate(() => {
    const b = document.querySelector('#dc-root .dc-closed');
    const a = b && b.querySelector('a');
    return {
      title: ((b && b.querySelector('h1')) || {}).textContent || '',
      go: a ? a.textContent.trim() : '',
      to: a ? new URL(a.getAttribute('href'), location.href).pathname : '',
      kids: document.getElementById('dc-root').children.length,
      parts: document.querySelectorAll('#dc-root select, #dc-root .dc-tbl, #dc-root .dc-bar, '
        + '#dc-root .dc-to-li, #dc-root .dp-pick, .dp-ghost, .dp-stage, .dp-pop').length,
      rpc: window.__shotRpc, api: typeof window.PVDeepPayCompare,
      mark: localStorage.getItem('pv_deep_was_locked')
    };
  });
  console.log(`${c.kids === 1 && c.parts === 0 && c.rpc === 0 && c.api === 'undefined' && c.mark === null ? '✓' : '❌'} 閉じている: `
    + `「${c.title}」／「${c.go}」→ ${c.to}・器の中は ${c.kids} 枚・比較の部品 ${c.parts} 個・`
    + `rpc ${c.rpc} 回・試験用の入口は${c.api === 'undefined' ? '無い' : '在る'}・クラッカーの印は${c.mark === null ? '無い' : '在る'}`);
}

/* ★anon（ログインしていない人）だけ：聞きに行かなかったこと・よそへ運ばれなかったこと・端末に
   印を置かなかったことを、絵と一緒に字でも出す（どれもスクショには写らない）。 */
if (scene === 'anon') {
  const a = await page.evaluate(() => ({
    rpc: window.__shotRpc, at: location.pathname,
    mark: localStorage.getItem('pv_deep_was_locked'),
    stage: document.querySelectorAll('#dc-sides .dp-stage').length
  }));
  console.log(`${a.rpc === 0 && a.stage === 1 && a.mark === null && a.at.endsWith('/' + url.split('/').pop()) ? '✓' : '❌'} 未ログイン: `
    + `rpc ${a.rpc} 回・住所 ${a.at}・器 ${a.stage}・クラッカーの印は${a.mark === null ? '無い' : '在る'}`);
}

await browser.close();
console.log(outPath);
