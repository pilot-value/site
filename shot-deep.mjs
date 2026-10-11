/* shot-deep.mjs — DEEP PAY（deep-pay.html）を localhost の実ページで撮る。

   shot-value.mjs と同型。pv_deep_pay() はオーナーが db/deep-pay.sql を
   Supabase に貼るまで本番に入らないので、クライアントごと差し替えて
   合成データで実物を描かせる。
   ★ ここで使う数字は全部でたらめ。実物の給与はこのリポジトリに1つも無い。
   ⚠️ shot-*.mjs の見本は**腐る**（CLAUDE.md の ST_LOCK と同じ）。
      「本番でもこう出る」と読まないこと。ここで確かめるのは**配置だけ**。
   ⚠️ 2026-08-30 以降、画面は**区分を選ぶまで何も出さない**。だからここも
      「開く → 選択肢が生えるのを待つ → 選ぶ → 描き終わるのを待つ」まで
      やってから撮る。選ばずに撮ると、どの scene も同じ空の板が写る。

   実行: node shot-deep.mjs <scene> <lang> <theme> <幅> [通貨] [open]
     scene: full  … 全部そろった状態（モックと同じ配置。既定）
            day1  … 現実の初日。KPI は3枚中1枚・給与構成は出ない・
                    働き方は1行しか無いので節ごと消える・変動給も出ない
            fold  … 人数の壁に満たない項目が「その他・未分類」に畳まれた状態
                    （灰色の意味が変わるので but 書きが1行増える）
            ask   … 開いた直後。まだ何も選んでいない（★これが入口の見た目）
            pos   … 役職だけ選んで会社を選ばなかった状態
            pick  … 自分の区分ではない区分を手で選んだ状態（JAL / 機長 / B787）
            thin  … 手で選んだ区分が人数の壁に届かなかった状態
                    （★広い区分の数字で埋めない。何も出ないのが正しい）
            nolist… 選べる組み合わせが1つも届いていない
                    （★選択欄ごと出ない。全社を並べる逃げ道は置かない）
            lock  … 鍵がまだ無い（給与を1件も出していない）＝板は3行＋断り
            det   … 鍵はあるが、答えていない項目が残っている＝板は2行（答え・100人）
                    ★「まだ答えていない項目」の一覧が出る（作り物：2026年9月分・6項目）
                    ★ボタンは給与フォームの内訳の節（#pay-detail）を指す
                    ★ボタンの上に断り（虚偽・不正確な情報について）が出る
            det0  … det と同じだが、残りの一覧が来ていない（窓の中に自分の行が無い人・
                    一覧を返さない古いサーバ）＝行と断りだけ・一覧の箱は出ない
            goal  … 鍵も答えもそろっていて、100人だけが未達＝板は1行（断りは出ない）
            ★lock / det / det0 / goal は、板の後ろに**ぼかした影絵**が出る（2026-10-11・
              オーナー判断）。影絵は字も数字も無い形だけで、ここの見本の数字とは関係が無い。
              開いた scene（full / ask / thin …）と err には出ない。撮ったあとの「影絵:」の
              行で、ぼかしの強さと「字が0文字」を字でも確かめられる。
            err   … サーバが返らなかった
     lang : ja | en
     theme: light | dark
     通貨 : JPY | USD | EUR | GBP | AUD | SGD | AED（省くと、その言語の既定のまま）
            ★円のままでは見えない崩れがある ── 通貨を変えると字数が変わる
              （¥1,903万 → AED 440K）。額の入る欄を触った回は、円以外でも1枚撮る。
            ⚠️ 英語ページの既定は**この機械のタイムゾーン**で決まる。英語の絵を
               人に見せるときは通貨を名指しする（省くと置き場所で絵が変わる）。
            位置は問わない（open / measure と同じく、引数のどこに書いてもよい）。
   保存先は screenshot.mjs と同じ ./temporary screenshots/

   末尾に open を付けると、撮らずに**見える窓で開いたまま**にする。
     node shot-deep.mjs full ja light 1440 open
     node shot-deep.mjs full en light 1440 USD
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
   効かせ方は「その言語の保存先に、選んだ通貨として書いておく」── currency.js が
   起動時に読む本物の道を通す（日本語＝pv-currency ／ 英語＝pv-currency-en）。
   描いたあとに PVCurrency.set() で切り替えると、切り替えの描き直しが済む前を撮りうる。
   ⚠️ 通る通貨は currency.js の RATES に在るものだけ。無い通貨を渡すと既定のまま
      描かれるので、撮ったあとに実際の通貨を突き合わせて知らせる（下の「通貨」の行）。 */
const cur = process.argv.slice(2).find((a) => /^[A-Z]{3}$/.test(a)) || '';

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const label = `deep-${scene}-${lang}-${theme}` + (vw !== 1440 ? `-${vw}` : '')
  + (cur ? `-${cur}` : '');
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}deep-pay.html`;

/* scene ごとに「窓の中で何を選ぶか」。★画面は選ぶまで何も出さないので、
   これが無いと撮れるのは「区分を選んでください」の板だけになる。
   lock / err / 未登録の scene は選ばない（選べる欄がそもそも出ない）。 */
const PICK = {
  /* ★ask は載せない（＝何も選ばない）。それが開いた直後の見た目そのもの。 */
  full: { airline: 'ana', position: 'cap', fleet: 'b787' },
  day1: { airline: 'ana' },
  fold: { airline: 'ana', position: 'cap' },
  pos:  { position: 'cap' },
  pick: { airline: 'jal', position: 'cap', fleet: 'b787' },
  thin: { airline: 'sas' }
  /* lock / det / det0 / goal は錠前の板。**何も選ばない**（鍵が閉じている画面では
     picker() が欄ごと隠す ── 隠れた欄へ値を入れても、写る板は変わらない）。 */
}[scene] || null;

/* ★ headless:'new' はこの環境で page.screenshot() が返ってこない
   （shot-tracker.mjs に実測の経緯あり）。chrome-headless-shell を使う。 */
const browser = await puppeteer.launch(open
  ? { headless: false, defaultViewport: null, args: ['--no-sandbox', `--window-size=${vw},1000`] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = (await browser.pages())[0] || await browser.newPage();
if (!open) await page.setViewport({ width: vw, height: 1000 });

page.on('pageerror', (e) => console.log('❌ page error:', e.message));

/* ★ setRequestInterception は使わない（CDP デッドロック。shot-tracker.mjs 参照）。
   CDN の supabase-js に上書きさせない目的は defineProperty で達成する。 */
await page.evaluateOnNewDocument((scene, theme, lang, cur) => {
  localStorage.setItem('pv-theme', theme);
  /* ★撮影で解析に足あとを残さない（2026-10-11）。ページは load のあと gtag を読むので、
     立てておかないと、撮るたびに localhost の閲覧が本物の GA4 に1件ずつ入る
     （検査の側 ── assert-*.mjs ── は前からこの1行を立てている）。 */
  window['ga-disable-G-3XYF69VQ3X'] = true;
  if (cur) localStorage.setItem(lang === 'en' ? 'pv-currency-en' : 'pv-currency', cur);
  const UID = '00000000-0000-4000-8000-00000000a001';

  const STATS = { reports: 58, month: 12, airlines: 19, contributors: 37 };

  /* ★見本の形は db/deep-pay.sql の返り値（2026-10-11）──
       ・区分の人数は**どこにも入れない**（cohort.n / head.detailed_n / head.verified_n /
         comp.n / comp.bonus.n はサーバが返さなくなった）。代わりは cohort.trust。
       ・gate.crowd ＝「みんなの側」の門（100人以上 or 手動の公開フラグ）。
         37 / 100 人のまま開いている見本は「手動フラグで開けた日」の形＝ crowd:true。
       ・見出しの2つは刻み（annual_usd は $50・per_block_usd は $0.5）。
         給与構成の med_usd は有効数字2桁のまま。
       ・gate は { key, ready, todo, crowd, contributors, goal }。ready ＝本人が、自分に
         当てはまる項目をぜんぶ答えた月を持っているか。todo ＝足りない人にだけ
         { year, month, items:[コード…] }。**前の鍵 detailed は gate に無い**
         （外の give.detailed は別物 ── 左メニューの札が読む）。 */
  /* 段1（会社×役職×機材）まで届いた状態。★合計はちょうど100。
     サーバ（db/deep-pay.sql の pv_deep_pct）が最大剰余法で揃えて返すため。 */
  const FULL = {
    ok: true, state: 'open',
    gate: { key: true, ready: true, todo: null, crowd: true, contributors: 37, goal: 100 },
    give: { detailed: true },
    stats: STATS,
    cohort: { level: 'airline_pos_fleet', airline: 'ana', pos: 'fo', fleet: 'a320', trust: 'high' },
    head: { annual_usd: 119700, per_block_usd: 102.5, fixed_pct: 62 },
    comp: {
      total_kind: 'monthly_cash',
      segs: [
        { k: 'base',     pct: 52, med_usd: 4800 },
        { k: 'variable', pct: 24, med_usd: 2200 },
        { k: 'command',  pct: 8,  med_usd: 730 },
        { k: 'perdiem',  pct: 7,  med_usd: 640 },
        { k: 'housing',  pct: 5,  med_usd: 460 },
        { k: 'other',    pct: 4,  med_usd: 370 }
      ],
      bonus: { pct_of_annual: 5 }
    },
    work: { block_h: 74.0, duty_h: 141.0, duty_days: 18, stay_nights: 9 },
    /* ⚠️ night / weekend / holiday は3つのまま。1行にまとめない（仕様の明示的な禁止）。 */
    var: [
      { k: 'block',    pct: 46 }, { k: 'sector',  pct: 21 },
      { k: 'overtime', pct: 13 }, { k: 'night',   pct: 11 },
      { k: 'weekend',  pct: 6 },  { k: 'holiday', pct: 3 }
    ]
  };

  /* 現実の初日。10〜30人が30社×4役職に散っているので、届くのは段4だけ。
     ★ここで「出ない」ことが正しい出力。0 を並べた画面と見比べるために撮る。 */
  const DAY1 = Object.assign({}, FULL, {
    cohort: { level: 'pos', airline: 'ana', pos: 'fo', fleet: 'a320', trust: 'low' },
    head: { annual_usd: 119700, per_block_usd: null, fixed_pct: null },
    comp: null,
    work: { block_h: 74.0, duty_h: null, duty_days: null, stay_nights: null },
    var: []
  });

  // 人数の壁に満たない項目が未分類に畳まれた状態（灰色の意味が変わる）
  const FOLD = Object.assign({}, FULL, {
    cohort: { level: 'airline_pos_cat', airline: 'ana', pos: 'fo', fleet: 'a320', trust: 'mid' },
    head: { annual_usd: 96050, per_block_usd: 78.5, fixed_pct: 58 },
    comp: {
      total_kind: 'monthly_cash',
      segs: [
        { k: 'base',     pct: 58, med_usd: 2900 },
        { k: 'variable', pct: 26, med_usd: 1300 },
        { k: 'perdiem',  pct: 7,  med_usd: 350 },
        { k: 'rest',     pct: 9,  med_usd: null }
      ],
      bonus: null
    },
    work: { block_h: 68.5, duty_h: 128.0, duty_days: null, stay_nights: 7 },
    var: [{ k: 'block', pct: 62 }, { k: 'duty', pct: 38 }]
  });

  const POS = Object.assign({}, FULL, {
    cohort: { level: 'pos', airline: 'ana', pos: 'fo', fleet: 'a320', trust: 'low' }
  });

  /* 錠前の板。閉じている理由は3つ（鍵／本人が答えきったか／みんなの側＝100人）で、
     当てはまる行だけが出る（deep-pay.js の lockLines）。
       lock … 3つとも当てはまる＝3行。まだ1件も出していないので、残りの一覧は無い
       det  … 鍵は在る＝2行（答え・100人）。**残っている項目の一覧つき**。
              ボタンは給与フォームの内訳の節へ
       det0 … det と同じで、一覧だけが来ていない（todo が null）
       goal … 鍵も答えもそろっている＝1行（100人だけ）
     ★「答えきっていない」の行が出る3つ（lock / det / det0）には、ボタンの上に
       断り（虚偽・不正確な情報について）が出る。goal には出ない。
     ★一覧の中身は作り物（2026年9月分・6項目）。サーバが返すのはコードだけで、
       画面が給与フォームの見出しと同じ名前に直す（deep-pay.js の todoNames）。 */
  const TODO = { year: 2026, month: 9,
                 items: ['command', 'bonus', 'profit', 'duty_h', 'duty_days', 'instructor'] };
  const LOCK = { ok: true, state: 'locked', stats: STATS, give: { detailed: false },
                 gate: { key: false, ready: false, todo: null, crowd: false, contributors: 37, goal: 100 },
                 cohort: null, head: null, comp: null, work: null, var: null };
  const DET  = Object.assign({}, LOCK, { give: { detailed: true },
                 gate: { key: true, ready: false, todo: TODO, crowd: false, contributors: 37, goal: 100 } });
  const DET0 = Object.assign({}, LOCK, { give: { detailed: false },
                 gate: { key: true, ready: false, todo: null, crowd: false, contributors: 37, goal: 100 } });
  const GOAL = Object.assign({}, LOCK, { give: { detailed: true },
                 gate: { key: true, ready: true, todo: null, crowd: false, contributors: 37, goal: 100 } });

  /* 手で選んだ区分（2026-08-30）。自分は ANA の FO なのに JAL の機長・787 を見ている。
     ★信頼度は「中」で返す。3つとも選んでいても人数で頭打ちになる、という形
       （段を決めるのはサーバ。画面は来た段をそのまま出す）。 */
  const PICK = Object.assign({}, FULL, {
    cohort: { level: 'selected', manual: true, airline: 'jal', pos: 'cap', fleet: 'b787',
              trust: 'mid' },
    head: { annual_usd: 211350, per_block_usd: 180.5, fixed_pct: 71 }
  });
  /* 選んだ区分が人数の壁に届かなかった状態。★広い区分に登らないので、出るものが何も無い。
     「あと1人」とも、壁が何人かとも書かない（書くと人数が1人単位で読める）。
     本物も head / comp / work / var を返り値ごと null にする（trust も null）。 */
  const THIN = { ok: true, state: 'open', stats: STATS, give: { detailed: true },
    gate: { key: true, ready: true, todo: null, crowd: true, contributors: 37, goal: 100 },
    cohort: { level: 'none', manual: true, airline: 'sas', pos: null, fleet: null, trust: null },
    head: null, comp: null, work: null, var: null };

  /* 選べる組み合わせが1つも届いていない状態（2026-09-01）。まだ誰も内訳を
     書いていない日か、SQL を貼る前がこれ。★**全社を並べる逃げ道は置かない**
     ので、選択欄ごと出ないのが正しい（選べるのに数字が出ない状態を作らない）。 */
  const NOLIST = { ok: true, state: 'open', stats: STATS, give: { detailed: true },
    gate: { key: true, ready: true, todo: null, crowd: true, contributors: 37, goal: 100 },
    cohort: null, head: null, comp: null, work: null, var: [] };

  const SCENES = { full: FULL, day1: DAY1, fold: FOLD, pos: POS,
                   pick: PICK, thin: THIN, lock: LOCK, det: DET, det0: DET0,
                   goal: GOAL, nolist: NOLIST };
  const DEEP = SCENES[scene] || FULL;

  /* ★選べる組み合わせ（2026-09-01）。画面はこれで選択肢を絞る。形は
     db/deep-pay.sql の avail と同じ ── 会社 / 会社ごとの職位 /「会社|職位」ごとの機材。
     空文字の鍵は「そこで絞っていない」。
     ★**会社ごとに機材を変えてある。** 会社を変えると機材の欄が入れ替わるのが
       窓の中で踏める（本番も会社ごとに飛ばす機材が違う）。
     ⚠️ この一覧も作り物。本番のどの会社・どの機材が出るかとは関係が無い。 */
  const FL = {
    ana:                  { cap: ['a320', 'b777', 'b787'], fo: ['a320', 'b787'] },
    jal:                  { cap: ['b767', 'b777', 'b787'], fo: ['b737', 'b787'] },
    emirates:             { cap: ['a380', 'b777'],         fo: ['b777'] },
    'qatar-airways':      { cap: ['a350', 'b787'],         fo: ['a320'] },
    'singapore-airlines': { cap: ['a350', 'b777', 'b787'], fo: ['a350'] },
    lufthansa:            { cap: ['a320', 'a350', 'b747'], fo: ['a320'] },
    'cathay-pacific':     { cap: ['a330', 'a350', 'b777'], fo: ['a330'] },
    'delta-air-lines':    { cap: ['a320', 'b737', 'b767'], fo: ['b737'] },
    /* ★名前が一番長い2社。**絵のためではなく measure のため。** 欄の幅は
       「一番長い選択肢」で決まるので、短い社名だけで測ると本番より
       150px ほど短く出て、足りない幅を「足りている」と読み違える。 */
    swiss:                { cap: ['a320', 'a330'],         fo: ['a320'] },
    'shin-central':       { cap: ['dhc8'],                 fo: ['dhc8'] },
    /* ★sas は「人数の壁に届かなかった」側。**thin の絵を撮る回だけ**一覧に入れる ──
       本来の約束（選べる＝必ず数字が返る）をわざと破って、空の板を窓の中で
       踏めるようにするための細工。他の scene では入れない。 */
    sas:                  { cap: ['a320'],                 fo: ['a320'] }
  };
  const PICKS = (function () {
    const air = Object.keys(FL).filter((c) => c !== 'sas' || scene === 'thin').sort();
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

  /* ★職位・機材で数字が動く（2026-09-01）。前は3つとも選んだときにしか
     動かず、窓の中で役職や機材を変えても1円も動かなかった ── オーナーが
     最初に気づいたのがこれ。本番は db/deep-pay.sql の0段が3つとも見て絞っている。
     ⚠️ 係数はでたらめ。「機長は副操縦士の何倍」を読み取らないこと。 */
  const POSK = { cap: 1, fo: 0.66, cadet: 0.4 };
  const FLTK = { a380: 1.14, b747: 1.12, b777: 1.1, b787: 1.06, a350: 1.05,
                 a330: 1.02, b767: 0.97, dhc8: 0.72, a320: 0.92, b737: 0.9 };
  /* 金額と時間だけ動かす。★割合（pct）は掛けない ── 合計 100 が崩れる。
     ★null は null のまま返す（day1 の「まだ出せない」欄を潰さないため）。 */
  function scale(src, k) {
    const r1 = (v) => (v == null ? v : Math.round(v * k));
    const r2 = (v) => (v == null ? v : Math.round(v * k * 10) / 10);
    /* ★見出しの2つは本物と同じ刻みで返す（db/deep-pay.sql の pv_deep_step）──
         年収 $50・Pay / Block Hour $0.5。丸い数で返すと、画面が刻みで出していることが
         絵から分からない。 */
    const st = (v, p) => (v == null ? v : Math.round(v * k / p) * p);
    const o = Object.assign({}, src);
    if (src.head) o.head = Object.assign({}, src.head, {
      annual_usd: st(src.head.annual_usd, 50), per_block_usd: st(src.head.per_block_usd, 0.5) });
    if (src.comp) o.comp = Object.assign({}, src.comp, {
      segs: src.comp.segs.map((g) => Object.assign({}, g, { med_usd: r1(g.med_usd) })) });
    if (src.work) o.work = { block_h: r2(src.work.block_h), duty_h: r2(src.work.duty_h),
                             duty_days: src.work.duty_days, stay_nights: src.work.stay_nights };
    return o;
  }

  const RPC = {
    /* ★選んだ区分に答える（2026-08-30）。ここを () => DEEP のままにすると、
       窓の中でセレクタを動かしても**答えが1つも変わらない**＝
       「壊れている」ように見えて、配置の確認にならない。
       返す数字はでたらめだが、**選んだ値をそのまま映す**ところは本物と同じ。
       ⚠️ sas（スカンジナビア航空）だけは「人数の壁に届かなかった」を返す。
          空の状態を窓の中で実際に踏めるようにするための細工で、
          本番の人数とは何の関係も無い。 */
    pv_deep_pay: (a) => {
      const q = (a && a.p) || {};
      /* 選んでいない＝その scene のまま。★一覧はここで渡す（画面は一度届いた
         一覧を持ち続けるので、選んだ後の答えに毎回入れる必要は無い）。
         ⚠️ nolist だけ渡さない＝選択欄ごと出ない。 */
      if (!q.airline && !q.position && !q.fleet)
        return Object.assign(scene === 'nolist' ? {} : { picks: PICKS }, DEEP);
      const echo = { manual: true, airline: q.airline || null,
                     pos: q.fleet && !q.position ? null : (q.position || null),
                     fleet: q.fleet || null };
      if (q.airline === 'sas')
        return Object.assign({}, THIN,
          { cohort: Object.assign({ level: 'none', trust: null }, echo) });
      /* ★土台は**その scene の payload**。FULL に潰すと day1（薄い初日）や
         fold（畳まれた状態）が選んだ瞬間に満杯へ化けて、確かめたい配置が消える。 */
      /* ★信頼度の段は、選んだ軸の数で変える（3つ＝高・2つ＝中・1つ＝低）。
         本物は人数と区分の広さの低いほうで決めて段だけを返す（db/deep-pay.sql の trust）。
         ここは3段とも窓の中で踏めるようにするための細工で、本物の式ではない。 */
      const k = (q.airline ? 1 : 0) + (q.position ? 1 : 0) + (q.fleet ? 1 : 0);
      const trust = k >= 3 ? 'high' : k === 2 ? 'mid' : 'low';
      return Object.assign(
        scale(DEEP, (POSK[q.position] || 1) * (FLTK[q.fleet] || 1)),
        { cohort: Object.assign({ level: 'selected', trust: trust }, echo) });
    },
    pv_pay_rows: () => ({ ok: true, state: 'open', rows: [], stats: STATS,
                          give: { detailed: !!(DEEP.give && DEEP.give.detailed) } }),
    pv_give_progress: () => ({ ok: true, contributors: STATS.contributors,
                               give: DEEP.give || { detailed: false } }),
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
   deep-pay.js は必ず #dp-hd に <h1> を書き込んでから他を描く。 */
await page.waitForFunction(
  () => !!document.querySelector('#dp-hd h1'), { timeout: 15000 });
await page.waitForFunction(
  () => !document.querySelector('#dp-kpi .mr-skel'), { timeout: 15000 });

if (PICK) {
  const IDS = { airline: 'dp-pk-air', position: 'dp-pk-pos', fleet: 'dp-pk-flt' };
  /* ★会社 → 役職 → 機材 の順に、1つずつ「選択肢が生えるのを待つ → 入れる →
     change」を繰り返す（2026-09-01）。機材の選択肢は**選んだ会社×役職**で
     入れ替わるので、会社を入れる前に機材を入れてもまだ生えていない。
     value に無い値を入れると空文字のまま静かに素通りし、「選んだのに何も
     出ない」という嘘の結果になる。本物の操作と同じ順番でしか踏めない。
     ⚠️ 時間で待たない（混んだ回に嘘の結果が出る）。条件で待つ。 */
  for (const k of ['airline', 'position', 'fleet']) {
    if (!PICK[k]) continue;
    await page.waitForFunction((id, v) =>
      !!document.querySelector('#' + id + ' option[value="' + v + '"]'),
      { timeout: 15000 }, IDS[k], PICK[k]);
    await page.evaluate((id, v) => {
      const e = document.getElementById(id);
      e.value = v;
      e.dispatchEvent(new Event('change', { bubbles: true }));
    }, IDS[k], PICK[k]);
  }
  /* 描き終わり＝KPI か「まだ出せません」の板のどちらかが在ること。 */
  await page.waitForFunction(
    () => !!document.querySelector('#dp-kpi .dp-kpi, #dp-kpi .dp-msg'), { timeout: 15000 });
}

/* ★測る前にフォントが載り切るのを待つ。Inter は外から読むので、載る前に測ると
   代替フォント（横に広い）の幅で数えてしまい、**同じ CSS なのに回ごとに違う答え**
   が出る（実測で 570px→920 / 580px→938 / 610px→950 と単調でない並びになった）。
   ⚠️ sleep で待たない。混んだ回に足りなくなって、また同じ揺れが戻る。 */
await page.evaluate(() => document.fonts.ready);
/* ── 実測（`measure` を付けたとき）────────────────────────────────
   ★<select> は中身が入り切らなくても黙って端で切る（省略記号すら出ない）。
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
      return { id: e.id, box: px(e.getBoundingClientRect().width), inner: px(inner),
               widest: px(widest), sel: e.selectedOptions[0]?.text || '',
               /* ★見えているのは「選んだ1つ」。落ちるのはそれが切れたときだけ。
                  いちばん長い選択肢は、開いた一覧の中でしか出ない（端末側の描画）。 */
               cut: px(inner - 18 - selw),
               short: px(inner - 18 - widest) };   // 18px ≒ 端末の▼
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
    })(document.getElementById('dp-root'), 0);
    /* ★条件バー（表示中: …）。en は語が長くて信頼度の札が2段目へ落ちやすく、
       落ちると見出しの段が丸ごと約27px 伸びる＝1画面の約束に直に効く。
       「あと何px 足りないか」を出す（勘で font-size を触らないため）。 */
    let cond = null;
    {
      const c = document.querySelector('.dp-cond');
      const l = c && c.querySelector('.dp-cond-l');
      const t = c && c.querySelector('.dp-trust');
      if (c && l && t) {
        const cs = getComputedStyle(c);
        const room = c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const need = l.scrollWidth + t.getBoundingClientRect().width
          + parseFloat(cs.columnGap || 0);
        cond = { room: px(room), need: px(need), slack: px(room - need),
                 rows: Math.round(c.getBoundingClientRect().height) > 40 ? 2 : 1 };
      }
    }
    return { sels, rows, cond, vh: innerHeight,
             bottom: rows.reduce((a, r) => Math.max(a, r.b), 0) };
  });
  console.log(`── ${scene} / ${lang} / ${theme} / ${vw}px ──`);
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
  if (rep.cond)
    console.log(`  ${rep.cond.slack < 0 ? '△' : '✓ '} 条件バー   `
      + `幅 ${String(rep.cond.room).padStart(6)}px / 中身 ${String(rep.cond.need).padStart(6)} / `
      + `余り ${String(rep.cond.slack).padStart(6)}  [${rep.cond.rows}段]`);
  for (const s of rep.sels)
    console.log(`  ${s.cut < 0 ? '❌' : (s.short < 0 ? '△' : '✓ ')} ${s.id.padEnd(10)} `
      + `欄 ${String(s.box).padStart(6)}px 内寸 ${String(s.inner).padStart(6)} / `
      + `いま出ている ${String(s.cut).padStart(6)} / 最長 ${String(s.short).padStart(6)}  [${s.sel}]`);
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
const said = await page.evaluate(() => ({
  cur: (window.PVCurrency && window.PVCurrency.get) ? window.PVCurrency.get() : '',
  kpi: [...document.querySelectorAll('#dp-kpi .dp-kpi')].map((e) =>
    ((e.querySelector('.dp-kpi-k') || {}).textContent || '') + ' ' +
    ((e.querySelector('.dp-kpi-v') || {}).textContent || '')),
  cond: ((document.querySelector('#dp-hd .dp-cond') || {}).innerText || '').replace(/\n/g, ' '),
  /* 板の行（1行ずつ <p>。2026-10-11 から）。 */
  lock: [...document.querySelectorAll('#dp-kpi .dp-msg--lock .dp-msg-s')]
    .map((e) => e.innerText.replace(/\n/g, ' ')),
  /* まだ答えていない項目の一覧（見出しと札）と、ボタンの上の断り。出ていなければ空。 */
  todoH: ((document.querySelector('.dp-msg--lock .dp-todo-h') || {}).textContent || ''),
  todo: [...document.querySelectorAll('.dp-msg--lock .dp-todo-i')].map((e) => e.textContent),
  warn: ((document.querySelector('.dp-msg--lock .dp-msg-w') || {}).textContent || ''),
  /* 板のボタンの行き先（足りない物に合わせて変わる。deep-pay.js の lockHref）。 */
  cta: [...document.querySelectorAll('.dp-msg--lock a.dp-cta')].map((e) => e.getAttribute('href')).join(','),
}));
console.log(`通貨: ${said.cur}` + (cur && said.cur !== cur ? `  ❌ 頼んだのは ${cur}（currency.js に無い通貨）` : ''));
if (said.cond) console.log('条件バー: ' + said.cond);
if (said.kpi.length) console.log('見出し: ' + said.kpi.join(' ｜ '));
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
  const shut = ['lock', 'det', 'det0', 'goal'].includes(scene);
  if (ghost.on)
    console.log(`${shut && ghost.chars === 0 && ghost.inert && ghost.hidden === 'true' && ghost.blurred === 1 ? '✓' : '❌'} 影絵: `
      + `${ghost.blur}・字 ${ghost.chars} 文字・inert=${ghost.inert}・aria-hidden=${ghost.hidden}`
      + `・ぼかしの効いた要素 ${ghost.blurred}` + (shut ? '' : '  ← 閉じていない scene に影絵が在る'));
  else if (shut) console.log('❌ 影絵が無い（閉じた scene なのに、板の後ろに何も出ていない）');
  else if (ghost.blurred) console.log(`❌ 開いた scene に、ぼかしの効いた要素が ${ghost.blurred} つ在る`);
}

await browser.close();
console.log(outPath);
