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

   実行: node shot-compare.mjs <scene> <lang> <theme> <幅> [通貨] [open]
     scene: full … 両側そろった状態（モック2枚目と同じ配置。既定）
                   ★JAL 側が年収も Block Hours も上回るので**トレードオフが出る**
            thin … 片側が人数の壁に届かなかった状態（右だけ「まだ出せません」・左は普通に出る）
            drop … 片側にパーディアムが無い状態（★その行だけ表から消える。0 と書かない）
            same … サーバの値は違うのに、円では同じ字になる行が在る状態
                   （★年収・Pay / Block Hour・固定・保証給比率の3行に差が付かない。
                     通貨を変えると、刻みの境目をまたぐ行だけ差が出る）
            ask  … まだ2社そろっていない（入口の板）
            dup  … 左右に同じ会社を選んだ
            few  … 比べられる会社が1社しか無い（★選択欄ごと出ない）
            lock … 鍵がまだ無い（給与を1件も出していない）＝板は3行
            det  … 鍵はあるが内訳を書いていない＝板は2行（内訳・100人）
                   ★板の中に「内訳だけを足す入力」（pv-pay-breakdown.js）が出る。
                     見本の月は ANA / 2026年9月 / JPY 1,150,000（作り物）
            over … det の板で3つ答えて送ったら、サーバが「内訳の合計が総支給を
                   超えています」と断った状態（★文の中に両方の額が出る）
            goal … 鍵も内訳もそろっていて、100人だけが未達＝板は1行
                   （★前はここで「内訳を出すと開きます」と出ていた。直した不具合の絵）
            err  … サーバが返らなかった
     lang : ja | en
     theme: light | dark
     通貨 : JPY | USD | EUR | GBP | AUD | SGD | AED（省くと、その言語の既定のまま）
            ★円のままでは見えない崩れがある ── 通貨を変えると字数が変わる。
              額の入る欄を触った回は、円以外でも1枚撮る。
            ⚠️ 英語ページの既定は**この機械のタイムゾーン**で決まる。英語の絵を
               人に見せるときは通貨を名指しする（省くと置き場所で絵が変わる）。
            位置は問わない（open / measure と同じく、引数のどこに書いてもよい）。
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

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const label = `cmp-${scene}-${lang}-${theme}` + (vw !== 1440 ? `-${vw}` : '')
  + (cur ? `-${cur}` : '');
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}deep-pay-compare.html`;

/* scene ごとに「窓の中で何を選ぶか」。★2社そろうまで何も出ないので、
   これが無いと撮れるのは入口の板だけになる。ask / lock / det / over / goal / err は選ばない。 */
/* ★機材は左右**別々**（2026-09-01）。会社が違えば飛ばす機材も違うので、
   full は左右で違う機材を選ぶ ── 「それぞれの会社で選べる」がそのまま絵になる。 */
const PICK = {
  full: { a: 'ana', b: 'jal', pos: 'cap', fltA: 'b787', fltB: 'b777' },
  thin: { a: 'ana', b: 'sas' },
  drop: { a: 'ana', b: 'lufthansa' },
  same: { a: 'ana', b: 'emirates' },
  dup:  { a: 'ana', b: 'ana' }
}[scene] || null;

/* ★ headless:'new' はこの環境で page.screenshot() が返ってこない
   （shot-tracker.mjs に実測の経緯あり）。chrome-headless-shell を使う。 */
const browser = await puppeteer.launch(open
  ? { headless: false, defaultViewport: null, args: ['--no-sandbox', `--window-size=${vw},1000`] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = (await browser.pages())[0] || await browser.newPage();
if (!open) await page.setViewport({ width: vw, height: 1000 });

page.on('pageerror', (e) => console.log('❌ page error:', e.message));

/* ★ setRequestInterception は使わない（CDP デッドロック。shot-tracker.mjs 参照）。 */
await page.evaluateOnNewDocument((scene, theme, lang, cur) => {
  localStorage.setItem('pv-theme', theme);
  if (cur) localStorage.setItem(lang === 'en' ? 'pv-currency-en' : 'pv-currency', cur);
  const UID = '00000000-0000-4000-8000-00000000a001';
  const STATS = { reports: 58, month: 12, airlines: 19, contributors: 37 };

  /* 会社ごとの見本。★合計はちょうど100（本番は pv_deep_pct が最大剰余法で揃える）。
     ⚠️ night / weekend / holiday は3つのまま。1行にまとめない（仕様の明示的な禁止）。
     ★形は db/deep-pay.sql の返り値（2026-10-11）──
       ・区分の人数は**入れない**（cohort.n / head.detailed_n / head.verified_n /
         comp.n / comp.bonus.n はサーバが返さなくなった）。代わりは信頼度の段（trust）。
       ・見出しの2つは刻み（annual_usd は $50・per_block_usd は $0.5）。
         給与構成の med_usd は有効数字2桁のまま。 */
  const AIR = {
    ana: {
      trust: 'high',
      head: { annual_usd: 119700, per_block_usd: 103.5, fixed_pct: 62 },
      comp: { total_kind: 'monthly_cash', bonus: { pct_of_annual: 5 },
        segs: [
          { k: 'base',     pct: 52, med_usd: 4800 },
          { k: 'variable', pct: 24, med_usd: 2200 },
          { k: 'command',  pct: 8,  med_usd: 730 },
          { k: 'perdiem',  pct: 7,  med_usd: 640 },
          { k: 'housing',  pct: 5,  med_usd: 460 },
          { k: 'other',    pct: 4,  med_usd: 370 }
        ] },
      work: { block_h: 74.0, duty_h: 141.0, duty_days: 18, stay_nights: 9 }
    },
    /* ★年収も Block Hours もステイも上回る＝**トレードオフの文が出る**側。
       「たくさん飛んでたくさんもらう」がひと目で分かる形にしてある。 */
    jal: {
      trust: 'mid',
      head: { annual_usd: 127950, per_block_usd: 105.5, fixed_pct: 55 },
      comp: { total_kind: 'monthly_cash', bonus: { pct_of_annual: 8 },
        segs: [
          { k: 'base',     pct: 46, med_usd: 4900 },
          { k: 'variable', pct: 31, med_usd: 3300 },
          { k: 'command',  pct: 9,  med_usd: 950 },
          { k: 'perdiem',  pct: 6,  med_usd: 640 },
          { k: 'housing',  pct: 4,  med_usd: 420 },
          { k: 'rest',     pct: 4,  med_usd: null }
        ] },
      work: { block_h: 79.5, duty_h: 152.0, duty_days: 19, stay_nights: 12 }
    },
    /* ★パーディアムの区分が無い会社。表の「パーディアム比率」の行が
       **まるごと消える**ことを見るための見本。0% と書いたら負け。 */
    lufthansa: {
      trust: 'mid',
      head: { annual_usd: 96050, per_block_usd: 84.5, fixed_pct: 71 },
      comp: { total_kind: 'monthly_cash', bonus: null,
        segs: [
          { k: 'base',     pct: 68, med_usd: 5100 },
          { k: 'variable', pct: 19, med_usd: 1400 },
          { k: 'housing',  pct: 8,  med_usd: 600 },
          { k: 'other',    pct: 5,  med_usd: 380 }
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
      head: { annual_usd: 119750, per_block_usd: 104, fixed_pct: 62 },
      comp: { total_kind: 'monthly_cash', bonus: { pct_of_annual: 5 },
        segs: [
          { k: 'base',     pct: 49, med_usd: 5200 },
          { k: 'variable', pct: 21, med_usd: 2200 },
          { k: 'perdiem',  pct: 12, med_usd: 1250 },
          { k: 'housing',  pct: 14, med_usd: 1480 },
          { k: 'other',    pct: 4,  med_usd: 420 }
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
       37 / 100 人のまま開いている見本は「手動フラグで開けた日」の形＝ crowd:true。 */
  const OPEN = { key: true, detailed: true, crowd: true, contributors: 37, goal: 100 };
  const BOOT = { ok: true, state: 'open', stats: STATS, give: { detailed: true },
                 gate: OPEN,
                 picks: PICKS,
                 cohort: null, head: null, comp: null, work: null, var: null };
  /* 錠前の板。当てはまる行だけが出る（deep-pay-compare.js の lockLines）。
       lock … 鍵も内訳も無く、100人も未達＝3行
       det  … 鍵は在るが内訳が無い＝2行。★内訳だけを足す入力はこの板に出る
               （over も同じ門。違うのは下の pv_pay_breakdown の答えだけ）
       goal … 鍵も内訳もそろっていて、100人だけが未達＝1行
              （★前はこの人に「内訳を出すと開きます」と出ていた） */
  const LOCK = Object.assign({}, BOOT, { state: 'locked', give: { detailed: false }, picks: null,
                 gate: { key: false, detailed: false, crowd: false, contributors: 37, goal: 100 } });
  const GOAL = Object.assign({}, BOOT, { state: 'locked', give: { detailed: true }, picks: null,
                 gate: { key: true, detailed: true, crowd: false, contributors: 37, goal: 100 } });
  const DET  = Object.assign({}, BOOT, { state: 'locked', give: { detailed: false }, picks: null,
                 gate: { key: true, detailed: false, crowd: false, contributors: 37, goal: 100 } });
  /* 内訳を足し終えたか（pv_pay_breakdown の「書く」が通ったら立つ）。 */
  let ADDED = false;

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
        : (scene === 'det' || scene === 'over') ? (ADDED ? GOAL : DET) : BOOT;
      const src = AIR[q.airline] || AIR[WIDE[q.airline]];
      if (!src) return thin(q.airline, q);
      const k = (POSK[q.position] || 1) * (FLTK[q.fleet] || 1);
      const r1 = (v) => (v == null ? v : Math.round(v * k));
      const r2 = (v) => (v == null ? v : Math.round(v * k * 10) / 10);
      /* ★見出しの2つは本物と同じ刻みで返す（db/deep-pay.sql の pv_deep_step）──
           年収 $50・Pay / Block Hour $0.5。丸い数で返すと、画面が刻みで出していることが
           絵から分からない。 */
      const st = (v, p) => (v == null ? v : Math.round(v * k / p) * p);
      /* ★区分の人数は返さない。返すのは信頼度の段だけ（会社ごとの見本の trust）。
         本物は人数と区分の広さの低いほうで段を決める（db/deep-pay.sql の trust）。
         ここは絞っても段を動かさない ── 左右の札が違う絵を撮るための作り物。 */
      /* ★割合（pct）は係数を掛けない ── 合計 100 が崩れる。動かすのは金額と時間だけ。 */
      const comp = src.comp && Object.assign({}, src.comp, {
        segs: src.comp.segs.map((g) => Object.assign({}, g, { med_usd: r1(g.med_usd) })) });
      const work = src.work && { block_h: r2(src.work.block_h), duty_h: r2(src.work.duty_h),
                                 duty_days: src.work.duty_days, stay_nights: src.work.stay_nights };
      return { ok: true, state: 'open', stats: STATS, give: { detailed: true },
        gate: OPEN,
        cohort: { level: 'selected', manual: true, airline: q.airline,
                  pos: q.position || null, fleet: q.fleet || null, trust: src.trust },
        head: Object.assign({}, src.head, { annual_usd: st(src.head.annual_usd, 50),
                                            per_block_usd: st(src.head.per_block_usd, 0.5) }),
        comp: comp, work: work, var: [] };
    },
    /* ★内訳だけを足す口（db/deep-pay.sql の pv_pay_breakdown）。pv-pay-breakdown.js が呼ぶ。
         何も渡さない＝読む → 足せる月を返す。鍵と答えを渡す＝書く。
         形は本物と同じ（target の6つ・断るときは code）。**数字は全部作り物。**
         ⚠️ 本物の「合計」には保存済みのほかの手当も入る。ここの sum は見本の定数で、
            窓の中で打った額を足したものではない（over の絵を撮るためだけの答え）。 */
    pv_pay_breakdown: (a) => {
      const q = (a && a.p) || {};
      const TARGET = { airline: 'ana', airline_other: null, year: 2026, month: 9,
                       currency: 'JPY', gross: 1150000 };
      if (!(scene === 'det' || scene === 'over') || ADDED) return { ok: true, target: null };
      if (!Object.keys(q).length) return { ok: true, target: TARGET };
      if (scene === 'over') return { ok: false, code: 'over', sum: 1262000, gross: 1150000 };
      /* 書けた ＝ 本人の内訳がそろった。次の pv_deep_pay から門が変わる
         （この見本は100人が未達のままなので、板は「100人」の1行だけになる）。 */
      ADDED = true;
      return { ok: true, done: true };
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
  const FAKE = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: UID, email: 'pilot@example.com' } } } }),
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
    rpc: async (name, a) => (scene === 'err' && name === 'pv_deep_pay')
      ? { data: null, error: { message: 'synthetic failure' } }
      : { data: RPC[name] ? RPC[name](a) : { ok: true }, error: null }
  };
  Object.defineProperty(window, 'supabase', {
    value: { createClient: () => FAKE }, writable: false, configurable: false
  });
}, scene, theme, lang, cur);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
/* ★時間で待たない（混んだ回に嘘の結果が出る）。「描き終わった」条件で待つ。
   deep-pay-compare.js は必ず #dc-hd に <h1> を書き込んでから他を描く。 */
await page.waitForFunction(
  () => !!document.querySelector('#dc-hd h1'), { timeout: 15000 });
await page.waitForFunction(
  () => !document.querySelector('#dc-sides .mr-skel'), { timeout: 15000 });

/* ── 内訳だけを足す入力（det / over）────────────────────────────────
   板は先に出て、入力は pv_pay_breakdown の答えが着いてから入る。器の data-state が
   'ready' になるまで待つ（時間で待たない）。 */
if (scene === 'det' || scene === 'over') {
  await page.waitForFunction(() => {
    const e = document.getElementById('dc-lock-add');
    return !!e && e.getAttribute('data-state') === 'ready';
  }, { timeout: 15000 });
}
if (scene === 'over') {
  /* いま在る3欄を全部答えて送る ── 基本給 620,000／保証手当は「該当なし」／変動給 642,000。
     ⚠️ 欄の id を名指ししている。pv-pay-breakdown.js の FIELDS が変わったら、ここも直す。
     ★本物の操作と同じ順（打つ → 欄を離れる → 押す）。値を代入しただけでは
       change が出ず、けた区切りに整う前の字を撮ることになる。 */
  await page.type('#pv-pb-base', '620000');
  await page.click('#pv-pb-guarantee-none');
  await page.type('#pv-pb-variable', '642000');
  await page.click('.pv-pb-btn');
  await page.waitForFunction(() => {
    const e = document.querySelector('.pv-pb-warn');
    return !!e && !e.hidden && e.textContent.length > 0;
  }, { timeout: 15000 });
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
    lock: [...document.querySelectorAll('#dc-sides .dp-msg--lock .dp-msg-s')]
      .map((e) => e.innerText.replace(/\n/g, ' ／ ')),
    /* 内訳だけを足す入力（det / over）。どの給与に足すかの1行と、出ている注意。 */
    add: [...document.querySelectorAll('.pv-pb-w > *')].map((e) => e.textContent.trim()).join(' · '),
    addWarn: ((document.querySelector('.pv-pb-warn:not([hidden])') || {}).textContent || ''),
    addCta: [...document.querySelectorAll('.dp-msg--lock a.dp-cta')].map((e) => e.getAttribute('href')).join(','),
  };
});
console.log(`通貨: ${said.cur}` + (cur && said.cur !== cur ? `  ❌ 頼んだのは ${cur}（currency.js に無い通貨）` : ''));
if (said.cond) console.log('条件バー: ' + said.cond);
if (said.chips.length) console.log('信頼度の札: ' + said.chips.join(' ｜ '));
if (said.rows.length) console.log('見出し: ' + said.rows.join(' ｜ '));
if (said.card.length) console.log('カード: ' + said.card.join(' ｜ '));
if (said.lock.length) console.log('板の行: ' + said.lock.join(''));   // 錠前の板と「まだ出せません」の板は同じ器
if (said.add) console.log('内訳の入力: ' + said.add);
if (said.addWarn) console.log('入力の注意: ' + said.addWarn);
if (said.addCta) console.log('板のボタンの先: ' + said.addCta);

await browser.close();
console.log(outPath);
