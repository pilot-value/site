/* assert-pay-rows.mjs — 「他のパイロットの実給与を見る」（actual-pay）の約束を機械で確かめる。

   この画面は、このサイトで初めて **他人の一次データを1行ずつ見せる** 場所。
   1行＝1人なので、守りは見た目ではなく次の6つに全部かかっている：

     ① 鍵の無い人には金額が1つも出ない
        （db/pay-rows.sql が state:'locked' を返し、画面は導線だけを出す）
     ② ①公開情報（青）と ②本人記録（オレンジ）が混ざらない
        1つの表に入れない・足さない・引かない。0件のときも①は必ず中身がある
     ③ 準識別子が1つも画面に出ない
        基地・在籍年数・年代・投稿月・原本の通貨・契約形態・国籍・本人を指す識別子。
        ★この検査では、サーバが返さないはずのこれらを **わざと混ぜた行** を流し込み、
          画面のどこにも出ないことを見る。将来 r.base_iata を1つ足した人が即座に赤くなる
     ④ 金額はすべて有効数字2桁（②のみ）
        ①は公開されている値そのもの（¥1,956万 など）で、こちらで丸め直すと出典と食い違う。
        だから2桁の検査は②の中だけに掛ける
     ⑤ 数え上げを見せない
        合計件数・カバー社数・「◯人」を②の結果の中に出さない。行を数えれば
        n≧5 の区分の人数は読めるが、それはオーナーが承知のうえで選んだ形。
        総数を明示すると会員規模そのものが出る
     ⑥ 通貨を切り替えても pv_pay_rows() を引き直さない
        （データは state に持つ。引き直すと切替のたびにサーバを叩く）

   ⚠️ 偽物 Supabase の rpc は本物と同じ「then だけを持つ箱」にしてある。
      async にすると本番に無い .catch が生えて、本番だけ真っ白になる穴が開く
      （assert-referral.mjs / assert-conditions.mjs に経緯あり）。

   ⚠️「②に数字が1文字も無い」は #ap-rows（結果の入れ物）に対して掛ける。
      節の見出しには「5人以上そろった区分だけ」という説明が要り、招待カードは
      n=3・4 のときだけ「あと2人」を出す（これは referral 側の約束で、
      assert-referral.mjs が別に見ている）。ここで見るのは **金額の形をした文字** が
      出ないこと。

   実行: node assert-pay-rows.mjs
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない。
*/
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const BASE = 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* CSS / JS のコメントを落としてから中身を見る。
   ★actual-pay.css は「lp.css の .pv-badge--pub と同じ見た目だがセレクタは分ける」と
     コメントで説明しているので、素朴に grep すると説明を書いた人が赤くなる。 */
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, ' ');
/* HTML も同じ。actual-pay.html には「★pay-viz.css は読まない」「pv-referral.js は
   lang-toggle.js より前」という注意書きそのものが書いてあるので、素朴に探すと
   説明を書いた人が赤くなる（＝説明を消すのが直し方になる）。実体だけを見る。 */
const nohtmlcomment = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ');

// ════════════════════════════════════════════════════════════════
// 0. ソースの検査（ブラウザを開かなくても分かること）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ソース ════');

const JA = read('actual-pay.html');
const EN = read('en/actual-pay.html');
const JS = read('actual-pay.js');
const CSS = read('actual-pay.css');
const SQL = read('db/pay-rows.sql');

for (const [name, raw] of [['ja', JA], ['en', EN]]) {
  const html = nohtmlcomment(raw);
  ok(/<meta\s+name="robots"\s+content="noindex/.test(html),
     `${name}: 検索に出さない（noindex）`);
  ok(/<link\s+rel="icon"/.test(html), `${name}: favicon を宣言している`);
  ok(/fonts\.googleapis\.com\/css2/.test(html), `${name}: Inter を読んでいる`);
  ok(/<title>[^<]+<\/title>/.test(html), `${name}: title が空でない`);
  ok(!/pv-founding/.test(html), `${name}: FOUNDING の板を置かない（あれは profile.html だけ）`);
  ok(!/pay-viz\.css/.test(html), `${name}: pay-viz.css を読まない（図を描かないので契約に触れない）`);

  /* 結果の入れ物は「開始タグ自体」に pv-no-cur。currency.js の自動走査に
     金額を触らせない（②は通貨ごとに2桁へ丸め直す・①は出典どおりの値を出す）。 */
  for (const id of ['ap-rows', 'ap-pub']) {
    const m = html.match(new RegExp('<div[^>]*id="' + id + '"[^>]*>'));
    ok(!!m && /\bpv-no-cur\b/.test(m[0]),
       `${name}: #${id} の開始タグに pv-no-cur が付いている`, m ? m[0] : '(タグが無い)');
  }

  /* 読み込み順。pv-referral.js が lang-toggle.js より後だと、
     英語設定の人が /en/ へ飛ばされる時に ?ref= が丸ごと消える。 */
  const iRef = html.indexOf('pv-referral.js');
  const iLang = html.indexOf('lang-toggle.js');
  ok(iRef > -1 && iLang > -1 && iRef < iLang,
     `${name}: pv-referral.js を lang-toggle.js より前に読む`, `${iRef} / ${iLang}`);
}

/* ★準識別子を受け取る場所がソースに1つも無いこと。
   実行時の検査（下）と二重にしてある。あちらは「出ていない」、こちらは「持っていない」。 */
{
  const bad = decomment(JS).match(
    /base_iata|seniority|age_bucket|period_month|period_year|created_at|proof_hash|airline_other|contract_type|tax_country|nationality|annual_total_orig|verify_level/g);
  ok(!bad, '準識別子の名前が actual-pay.js に1つも無い', bad ? bad.join(',') : '');
}

/* 金額での並べ替えと「Verified だけ」の絞り込みを作らない。
   前者はこの画面をランキングにする。後者は絞った行数＝その区分の検証済み人数という
   生カウントになる（区分あたり5人未満の情報が出る）。 */
{
  const j = decomment(JS);
  ok(!/sort[^)]*annual_usd|annual_usd[^)]*sort|sortBy|data-sort/.test(j),
     '金額で並べ替える仕掛けが無い');
  ok(!/filter[^)]*\.verified|verified[^)]*filter|ap-vf-only|onlyVerified/.test(j),
     '「Verified だけ」の絞り込みが無い');
  ok(/localeCompare/.test(j), '並びは名前順（localeCompare）である');
  ok(/surface:\s*'actual_pay'/.test(j) && !/surface:\s*'my_value'/.test(j),
     "★招待カードの surface は 'actual_pay'（この画面を開くだけでレポート側の勧誘が止まらない）");
  ok(/variant:\s*'card'/.test(j), "招待カードは 'card' 姿（bench / profile はダーク固定で浮く）");
  ok(!/mountInvite|PVReferral\.claim/.test(j),
     '常設入口（mountInvite）も着地（claim）もこの画面には置かない');
}

/* pay-viz.js が root で1回だけ持つ2式（db/test-form-contract.mjs が見張っている）。
   この画面に写すと、あちらが「2回ある」と言って落ちる。 */
{
  const j = decomment(JS);
  ok(!/\(\s*ann\s*-\s*bonus\s*\)\s*\/\s*12/.test(j), '(ann - bonus) / 12 を写していない');
  ok(!/\bn\s*\+\s*d\b/.test(j), 'n + d を写していない');
}

/* バッジは .ap-* で持つ。lp.css の .pv-badge--pub を2ファイルで定義するとドリフトする。 */
{
  const c = decomment(CSS);
  ok(!/\.pv-badge/.test(c), 'actual-pay.css が .pv-badge 系を再定義していない');
  ok(/\.ap-badge--pub/.test(c) && /\.ap-badge--actual/.test(c),
     '青（公開情報）と橙（本人記録）のバッジを .ap-* で持っている');
  ok(!/transition\s*:\s*all/.test(c), 'transition-all を使っていない');
  ok(/--pv-blue-ink/.test(c) && /--pv-orange-ink/.test(c),
     '色はトークンから取っている（ブランド色を発明していない）');
}

/* サーバ側。1行＝人の粒度なので anon には絶対に開かない。 */
{
  ok(/create or replace function public\.pv_pay_rows\(\)/.test(SQL),
     'pv_pay_rows は引数を1つも取らない（総当たり面を作らない）');
  ok(/grant execute on function public\.pv_pay_rows\(\) to authenticated/.test(SQL),
     'ログインした人だけが実行できる');
  ok(!/grant\s+execute[^;]*to[^;]*\banon\b/i.test(SQL),
     '★anon には1つも実行させない（pay_benchmarks と違って粒度が人なので開けない）');
  ok(/>=\s*5/.test(SQL), 'k≧5 の門が残っている');
  ok(/airline_other is null/.test(SQL), '自由入力の社名は出さない');
  ok(/access_until/.test(SQL), '鍵（access_until）を見ている');
}

/* サイドナビは patch-side-nav.mjs が1か所から書く。手で足すとドリフトする。 */
{
  let out = '', code = 0;
  try { out = execFileSync(process.execPath, ['patch-side-nav.mjs', '--check'],
                           { cwd: new URL('.', import.meta.url), encoding: 'utf8' }); }
  catch (e) { code = 1; out = String((e.stdout || '') + (e.stderr || '')); }
  ok(code === 0, '★サイドナビが全ページで1バイトも食い違わない（patch-side-nav.mjs --check）',
     out.trim().split('\n').slice(-3).join(' / '));
}

// ════════════════════════════════════════════════════════════════
// 共通：偽物 Supabase
// ════════════════════════════════════════════════════════════════
/* ★本物の supabase-js の rpc が返すのは「then だけを持つ箱」。catch も finally も無い。 */
const FAKE = function (payload, gap) {
  window.__rpc = [];
  const UID = '00000000-0000-4000-8000-00000000a001';
  const RPC = {
    pv_pay_rows: () => payload,
    my_cohort_gap: () => gap,
    my_referral_code: () => ({ ok: true, code: 'K7QD3XZM', invited: 0, converted: 0 }),
    pv_referral_settle: () => ({ ok: true })
  };
  function q(rows) {
    const o = { data: rows, error: null,
      select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
      update: () => o, insert: () => o,
      single: async () => ({ data: rows[0] || null, error: null }),
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      then: (res) => res({ data: rows, error: null }) };
    return o;
  }
  const CLIENT = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: UID, email: 'pilot@example.com' } } } }),
      getUser: async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => q([]),
    rpc: (name, args) => {
      window.__rpc.push({ name: name, hasArgs: args !== undefined });
      const res = { data: RPC[name] ? RPC[name](args) : { ok: true }, error: null };
      return { then: (y, n) => Promise.resolve(res).then(y, n) };   // ★then だけ
    }
  };
  Object.defineProperty(window, 'supabase',
    { value: { createClient: () => CLIENT }, writable: false, configurable: false });
};

/* ★サーバが返さないはずの列を、わざと行に混ぜておく。
   画面のどこかに出たら、その瞬間に赤くなる。
   ZQX は実在しない3文字（実在の空港コードを使うと、たまたま本文に出て誤検知する）。 */
const POISON = {
  base_iata: 'ZQX', seniority_years: 137, age_bucket: '40s',
  period_year: 2026, period_month: 8, created_at: '2026-08-05T00:00:00Z',
  proof_hash: 'deadbeefcafe0001', contract_type: 'direct', tax_country: 'JP',
  nationality: 'JP', annual_total_orig: 19440000, currency: 'JPY', verify_level: 2
};
/* ★字面がぶつからないものを選ぶ。'17' や '2026' のような短い数字は
   公開情報の表や年号にたまたま出るので、毒として使えない。 */
const POISON_VALUES = ['ZQX', '137', '40s', 'deadbeefcafe0001',
                       '19,440,000', '19440000', '2026-08-05'];

const fleetRow = (usd, vf, extra) => Object.assign(
  { airline: 'ana', pos: 'cap', grain: 'fleet', bucket: 'b787',
    annual_usd: usd, verified: vf, cohort_median_usd: 180000 }, extra || {});
const catRow = (usd, vf) => (
  { airline: 'ana', pos: 'cap', grain: 'cat', bucket: 'w',
    annual_usd: usd, verified: vf, cohort_median_usd: 175000 });

/* 5人ちょうどの区分。1人目にだけ毒を混ぜる。 */
const ROWS5 = [
  fleetRow(170000, true, POISON), fleetRow(180000, false), fleetRow(180000, true),
  fleetRow(190000, false), fleetRow(200000, true)
];
/* 粒度A（機材別5人）と粒度B（機材をまとめて7人）が同時にある形。
   同じ人が両方に出るのは設計どおり。だから2つの表に分けて、1つに混ぜない。 */
const ROWSMIX = ROWS5.concat([
  catRow(150000, false), catRow(160000, true), catRow(170000, false),
  catRow(180000, true), catRow(190000, false), catRow(200000, true), catRow(210000, false)
]);

const LOCKED = { ok: true, state: 'locked', rows: [] };
const EMPTY = { ok: true, state: 'open', rows: [] };
const OPEN5 = { ok: true, state: 'open', rows: ROWS5 };
const OPENMIX = { ok: true, state: 'open', rows: ROWSMIX };
const GAP = { ok: true, state: 'near', remaining: 2, gained: 0, crossed: false };

/* 表示された金額の文字から数字だけを取り出す。
   単位（万 / K / M）は 10 のべき乗なので、有効数字の桁数を変えない。
     ¥2,700万 → 2700   $180K → 180   $1.9M → 1.9   ¥29,000,000 → 29000000 */
function amountDigits(s) {
  const m = String(s).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}
function isSig2(v) {
  if (!isFinite(v) || v <= 0) return false;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.abs(Math.round(v / p) * p - v) < p * 1e-6;
}

/* ②に出てはいけない「金額の形をした文字」。数字そのものは禁じない
   （「5人そろうと」のような説明が要る）。 */
const MONEY = /[¥$€£＄]|万|\d[\d,]{2,}/;

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const jars = [];
async function fresh(seed) {
  const jar = await browser.createBrowserContext();
  jars.push(jar);
  const page = await jar.newPage();
  await page.setViewport({ width: 1360, height: 1200 });
  await page.evaluateOnNewDocument(() => { window['ga-disable-G-3XYF69VQ3X'] = true; });
  if (seed) await page.evaluateOnNewDocument(seed);
  return page;
}

async function open(lang, payload, gap) {
  const page = await fresh();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.evaluateOnNewDocument(FAKE, payload, gap || GAP);
  await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'actual-pay.html',
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2600);
  return { page, errs };
}

/* 画面から一度に読み取るもの。★毎回同じ形で取る（ケースごとに見方を変えない）。 */
const SNAP = () => {
  const q = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const rows = document.getElementById('ap-rows');
  const pub = document.getElementById('ap-pub');
  const secs = q('.ap-sec');
  const txt = (e) => (e ? e.innerText : '');
  return {
    url: location.pathname,
    pubText: txt(pub),
    pubRows: q('tr', pub).length,
    pubRanges: q('.ap-range', pub).map((e) => e.textContent),
    rowsText: txt(rows),
    bodyText: document.body.innerText,
    trs: q('.ap-tr', rows).length,
    tables: q('table', rows).length,
    amounts: q('.ap-amt', rows).map((e) => e.textContent),
    panelVals: q('.ap-panel .ap-v', rows).map((e) => e.textContent),
    lock: q('.ap-msg--lock', rows).length,
    msg: q('.ap-msg', rows).length,
    cta: q('.ap-cta', rows).map((e) => e.getAttribute('href')),
    blueIn1: secs[0] ? q('.ap-badge--pub', secs[0]).length : -1,
    orangeIn1: secs[0] ? q('.ap-badge--actual', secs[0]).length : -1,
    blueIn2: secs[1] ? q('.ap-badge--pub', secs[1]).length : -1,
    orangeIn2: secs[1] ? q('.ap-badge--actual', secs[1]).length : -1,
    both: q('.ap-badge--pub.ap-badge--actual').length,
    pvr: q('.pvr').length,
    /* ★pv-referral.js の card() は差込口そのものを書き換える（子を足さない）。
       だから見るのは「#ap-ref-slot の中」ではなく「#ap-ref-slot 自身」。 */
    slotIsCard: q('#ap-ref-slot.pvr').length,
    refInSec2: !!(secs[1] && document.getElementById('ap-ref-slot')
                  && secs[1].contains(document.getElementById('ap-ref-slot'))),
    refInSec1: !!(secs[0] && document.getElementById('ap-ref-slot')
                  && secs[0].contains(document.getElementById('ap-ref-slot'))),
    cap: localStorage.getItem('pv_ref_cap') || '',
    calls: (window.__rpc || []).map((r) => r.name),
    withArgs: (window.__rpc || []).filter((r) => r.hasArgs).map((r) => r.name),
    tblTexts: q('table', rows).map((t) => t.innerText),
    /* ①の「まだ下がある」の影。本当に下があるときだけ付いていること。 */
    cue: (() => {
      const l = document.querySelector('.ap-plist');
      if (!l) return null;
      return { on: l.classList.contains('is-more'),
               over: l.scrollHeight - l.clientHeight - l.scrollTop > 2 };
    })()
  };
};

// ════════════════════════════════════════════════════════════════
// A. 鍵が無い人（state:'locked'）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / A 鍵が無い（locked）════`);
  const { page, errs } = await open(lang, LOCKED);
  const v = await page.evaluate(SNAP);

  ok(v.lock === 1, '②は「明細を1枚出すと開きます」の1枚だけ', String(v.lock));
  ok(v.trs === 0 && v.amounts.length === 0, '★行も金額も1つも描かない',
     `${v.trs} 行 / ${v.amounts.length} 金額`);
  ok(!MONEY.test(v.rowsText), '★②の中に金額の形をした文字が1つも無い',
     JSON.stringify(v.rowsText).slice(0, 160));
  ok(v.cta.some((h) => /pay-report\.html#ps/.test(h)),
     'Give & Get の導線（匿名で給与を追加）が出る', v.cta.join(','));

  /* ★鍵が無くても①は読める。ここが空だと画面が真っ白に見えて、
     「何も無いサイト」として離脱する。 */
  ok(v.pubRows > 50, '★①公開情報は鍵が無くても中身がある', String(v.pubRows));
  ok(v.pubRanges.length > 50 && v.pubRanges.every((s) => /[¥$€£＄]/.test(s)),
     '①はレンジ（下限〜上限）で出る', String(v.pubRanges.length));

  ok(v.slotIsCard === 1 && v.pvr === 1, '招待カードは #ap-ref-slot 1枚だけ',
     `${v.pvr} / ${v.slotIsCard}`);
  ok(v.refInSec2 && !v.refInSec1, '★招待カードは②の中（①の隣に置くと話が混ざる）',
     `${v.refInSec2} / ${v.refInSec1}`);

  /* ★①の「まだ下がある」の影は、本当に下があるときだけ。
       112社を 360px に収めているので既定では7社ぶんしか見えず、
       手がかりが無いと「7社しか無い」に見える（実際にそう見えていた）。
       ただし1社に絞ると1行しか残らないので、出しっぱなしにすると嘘になる。 */
  ok(v.cue && v.cue.on && v.cue.over, '★全社のときは「まだ下がある」の影が出る',
     JSON.stringify(v.cue));

  const atEnd = await page.evaluate(() => {
    const l = document.querySelector('.ap-plist');
    l.scrollTop = l.scrollHeight;
    l.dispatchEvent(new Event('scroll'));
    return { on: l.classList.contains('is-more') };
  });
  ok(!atEnd.on, '★いちばん下まで送ると影が消える（終わったことも形で伝わる）',
     JSON.stringify(atEnd));

  const one = await page.evaluate(() => {
    const sel = document.getElementById('ap-air');
    sel.value = sel.options[1].value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const l = document.querySelector('.ap-plist');
    return { rows: l.querySelectorAll('tbody tr').length,
             on: l.classList.contains('is-more'),
             over: l.scrollHeight - l.clientHeight > 2 };
  });
  ok(one.rows === 1 && !one.over && !one.on,
     '★1社に絞って1行しか無いときは影を出さない（「もっとある」と嘘をつかない）',
     JSON.stringify(one));

  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// B. 鍵はあるが1件も無い（state:'open', rows:[]）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / B 鍵はあるが0件 ════`);
  const { page, errs } = await open(lang, EMPTY);
  const v = await page.evaluate(SNAP);

  ok(v.msg === 1 && v.lock === 0, '②は「まだありません」の正直な1枚（鍵の案内ではない）',
     `${v.msg} / ${v.lock}`);
  ok(v.trs === 0, '空の表を出さない', String(v.trs));
  ok(!MONEY.test(v.rowsText), '★0件のとき②に金額が1つも出ない',
     JSON.stringify(v.rowsText).slice(0, 160));
  ok(!/1,?247|68社|872|直近30日/.test(v.bodyText), '★件数・カバー社数の作り話を置かない');
  ok(v.pubRows > 50, '★②が0件でも①は満杯（画面が空にならない）', String(v.pubRows));
  ok(v.slotIsCard === 1, '★いちばん区分が薄い人にも招待カードが出る', String(v.slotIsCard));
  ok(v.refInSec2 && !v.refInSec1, '★0件のときも招待カードは②の中', `${v.refInSec2}`);
  ok(v.cta.some((h) => /pay-report\.html#ps/.test(h)), '投稿への導線が出る', v.cta.join(','));

  /* ①と②は別々の節。バッジが逆側に出たら、どちらの数字か読めなくなる。 */
  ok(v.blueIn1 === 1 && v.orangeIn1 === 0, '①には青（公開情報）のバッジだけ',
     `${v.blueIn1} / ${v.orangeIn1}`);
  ok(v.blueIn2 === 0 && v.orangeIn2 === 1, '②には橙（本人記録）のバッジだけ',
     `${v.blueIn2} / ${v.orangeIn2}`);
  ok(v.both === 0, '★両方のバッジを持つ要素がゼロ（推定と実データを1つにしない）', String(v.both));
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// C. 5人ちょうどの区分（1行＝1人）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / C 5人の区分 ════`);
  const { page, errs } = await open(lang, OPEN5);
  const v = await page.evaluate(SNAP);

  ok(v.trs === 5, '5人ぶん5行が出る', String(v.trs));
  ok(v.amounts.length === 5, '金額が5つ', String(v.amounts.length));

  /* ★④有効数字2桁。②の中だけに掛ける（①は公開されている値そのもの）。 */
  const bad2 = v.amounts.filter((s) => !isSig2(amountDigits(s)));
  ok(bad2.length === 0, '★②の金額がすべて有効数字2桁', bad2.join(' / ') || v.amounts.join(' / '));

  /* ★③準識別子。行に混ぜた毒がどこにも出ていないこと。 */
  const leaked = POISON_VALUES.filter((s) => v.rowsText.includes(s));
  ok(leaked.length === 0, '★基地・在籍年数・年代・投稿月・原本額・proof_hash が画面に出ない',
     leaked.join(','));
  ok(!/20\d\d年\s*\d+月|20\d\d-\d\d-\d\d/.test(v.rowsText), '★投稿の年月が出ない',
     JSON.stringify(v.rowsText).slice(0, 120));

  /* ★⑤数え上げ。②の結果の中に人数の言い方を置かない。 */
  /* ★⑤数え上げ。表そのものには数え方の言葉を1つも置かない。
     節の説明にある「5人以上そろった区分」だけは、しきい値であって
     データの数ではない（5 は db/pay-rows.sql の定数）。だから 5 だけ許す。 */
  const tblAll = v.tblTexts.join('\n');
  ok(!/(件|人|reports?|pilots?)/i.test(tblAll),
     '★表の中に「件」「人」が1つも無い', JSON.stringify(tblAll).slice(0, 160));
  const counts = (v.rowsText.match(/(\d+)\s*(件|人|reports?|pilots?)/gi) || [])
    .map((t) => t.match(/\d+/)[0]);
  ok(counts.every((n) => n === '5'),
     '★②に出る数え方は しきい値の5 だけ（合計件数・カバー社数を出さない）',
     counts.join(','));
  ok(!/パーセンタイル|上位\s*\d|percentile|top\s*\d+\s*%/i.test(v.bodyText),
     '★「上位◯パーセンタイル」を出さない（本人を採点しない）');

  /* 右のパネルは、行を選んだときにその区分の中央値だけを出す。 */
  ok(v.panelVals.length === 0, '選ぶ前は数字を出さない', v.panelVals.join(','));
  await page.evaluate(() => document.querySelector('.ap-tr').click());
  await sleep(400);
  const p = await page.evaluate(SNAP);
  ok(p.panelVals.length === 1, '★行を選ぶと出るのは1つ＝その区分の中央値だけ',
     p.panelVals.join(','));
  ok(isSig2(amountDigits(p.panelVals[0] || '')), '中央値も有効数字2桁', p.panelVals[0] || '');

  /* ⑥通貨を切り替えても引き直さない。 */
  const before = p.calls.filter((n) => n === 'pv_pay_rows').length;
  await page.evaluate(() => window.PVCurrency.set('USD'));
  await sleep(600);
  const u = await page.evaluate(SNAP);
  ok(u.calls.filter((n) => n === 'pv_pay_rows').length === before,
     '★通貨を切り替えても pv_pay_rows() を引き直さない',
     `${before} → ${u.calls.filter((n) => n === 'pv_pay_rows').length}`);
  ok(u.amounts.length === 5 && u.amounts.every((s) => /\$/.test(s)),
     '金額はドル表記に変わる', u.amounts.join(' / '));
  const badU = u.amounts.filter((s) => !isSig2(amountDigits(s)));
  ok(badU.length === 0, '★換算後も有効数字2桁（端数の残った数字を出さない）',
     badU.join(' / ') || u.amounts.join(' / '));

  ok(u.calls.filter((n) => n === 'pv_pay_rows').length === 1,
     'pv_pay_rows() は1回だけ引く', String(u.calls.filter((n) => n === 'pv_pay_rows').length));
  ok(!u.withArgs.includes('pv_pay_rows'), '★引数を渡さない（総当たり面を作らない）',
     u.withArgs.join(','));
  ok(u.slotIsCard === 1 && u.refInSec2, '★行があるときも招待カードは②の中に残る',
     `${u.slotIsCard} / ${u.refInSec2}`);
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// D. 粒度A（機材別）と粒度B（機材をまとめた区分）が両方ある
// ════════════════════════════════════════════════════════════════
/* 同じ人が「b787 の5人」と「ワイドボディの7人」の両方に出るのは設計どおり
   （フォールバックにすると、引き算で薄い機材の人数が1〜4に絞れてしまう）。
   だから1つの表に混ぜず、2つに分けて関係を1行で説明する。 */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / D 2つの粒度 ════`);
  const { page, errs } = await open(lang, OPENMIX);
  const v = await page.evaluate(SNAP);

  ok(v.tables === 2, '★2つの表に分かれている（1つに混ぜない）', String(v.tables));
  ok(v.trs === 12, '機材別5行 ＋ まとめ7行', String(v.trs));

  const catLabel = lang === 'en' ? 'Wide-body' : 'ワイドボディ';
  const t1 = v.tblTexts[0] || '', t2 = v.tblTexts[1] || '';
  ok(/787/.test(t1) && !t1.includes(catLabel), '上の表は機材別（787）だけ', t1.slice(0, 80));
  ok(t2.includes(catLabel) && !/787/.test(t2), '下の表はカテゴリ（ワイドボディ）だけ',
     t2.slice(0, 80));
  ok(/機材カテゴリ|Fleet category/.test(t2), '下の表の列名が「機材カテゴリ」である',
     t2.slice(0, 80));

  const bad2 = v.amounts.filter((s) => !isSig2(amountDigits(s)));
  ok(bad2.length === 0, '★12行すべて有効数字2桁', bad2.join(' / '));
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

for (const jar of jars) { try { await jar.close(); } catch (e) {} }
await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
