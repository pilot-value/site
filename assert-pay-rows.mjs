/* assert-pay-rows.mjs — 「他のパイロットの実給与を見る」（actual-pay）の約束を機械で確かめる。

   この画面は、このサイトで初めて **他人の一次データを1行ずつ見せる** 場所。
   1行＝1人で、しかも **給与を出した人は全員出る**（人数の門は無い）。

   ★2026-08-23、オーナー判断で次の3つが無くなった。
       ・k≧5 の門（5人そろった区分だけ出す）
       ・30日の遅延
       ・公開情報からの推定レンジの節（青）と、右の「選んだ区分」パネル
     だから守りは残る6つに全部かかっている。ここはその6つを見る：

     ① 鍵の無い人には金額が1文字も出ない
        （db/pay-rows.sql が state:'locked' を返す。画面のモザイクではない）
     ② 準識別子が1つも画面に出ない
        基地・在籍年数・年代・投稿月・原本の通貨・契約形態・国籍・本人を指す識別子、
        そして**自由入力で打ち込まれた社名**。
        ★この検査では、サーバが返さないはずのこれらを **わざと混ぜた行** を流し込み、
          画面のどこにも出ないことを見る。将来 r.base_iata を1つ足した人が即座に赤くなる
     ③ 金額はすべて有効数字2桁（表示通貨に換算したあとも）
     ④ 1行＝1人。表は1枚だけ
        ⚠️ 粒度を2つに分けた形へ戻さない（同じ人が両方に出て二重に数えたように見える）
     ⑤ 数え上げを見せない
        合計件数・カバー社数・「◯人」を結果の中に出さない。行を数えれば人数は読めるが、
        総数を明示すると会員規模そのものが出る
     ⑥ 通貨を切り替えても pv_pay_rows() を引き直さない
        （データは state に持つ。引き直すと切替のたびにサーバを叩く）

   ★もう1つ、消えたものが戻っていないことを見る：
     青のバッジ・推定レンジ・「5人」「30日」の約束・招待カードの差込口。
     文言は特に静かに戻る（「5人そろうと出ます」は、今は嘘）。

   ⚠️ 偽物 Supabase の rpc は本物と同じ「then だけを持つ箱」にしてある。
      async にすると本番に無い .catch が生えて、本番だけ真っ白になる穴が開く
      （assert-referral.mjs / assert-conditions.mjs に経緯あり）。

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
   ★どのファイルも「何を消したか・何を戻さないか」をコメントで説明している。
     素朴に grep すると、説明を書いた人が赤くなる（＝説明を消すのが直し方になる）。 */
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, ' ');
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
     金額を触らせない（通貨ごとに2桁へ丸め直すのはこちらの仕事）。 */
  const m = html.match(/<div[^>]*id="ap-rows"[^>]*>/);
  ok(!!m && /\bpv-no-cur\b/.test(m[0]),
     `${name}: #ap-rows の開始タグに pv-no-cur が付いている`, m ? m[0] : '(タグが無い)');

  /* ★消したものが戻っていないこと。 */
  ok(!/id="ap-pub"/.test(html), `${name}: ★公開情報からの推定レンジの節が無い`);
  ok(!/ap-badge--pub/.test(html), `${name}: ★青（推定）のバッジが無い`);
  ok(!/ap-ref-slot/.test(html), `${name}: ★招待カードの差込口が無い`);

  /* 絞り込みは帯1つに3つ。機材だけ②の中に置く形はやめた（効く範囲が同じなので）。 */
  ok(/id="ap-filter"[^>]*\shidden/.test(html) || /\shidden[^>]*id="ap-filter"/.test(html),
     `${name}: 絞り込みの帯は既定で隠れている（行が無いときに空の選択肢を出さない）`);
  for (const id of ['ap-air', 'ap-pos', 'ap-fleet', 'ap-clear']) {
    ok(html.includes('id="' + id + '"'), `${name}: #${id} がある`);
  }

  /* 読み込み順。pv-referral.js が lang-toggle.js より後だと、
     英語設定の人が /en/ へ飛ばされる時に ?ref= が丸ごと消える。
     ★この画面にカードは出さないが、?ref= を持ち回る仕事は残っている。 */
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
   前者はこの画面をランキングにする。後者は絞った行数＝検証済みの人数という生カウントになる。 */
{
  const j = decomment(JS);
  ok(!/sort[^)]*annual_usd|annual_usd[^)]*sort|sortBy|data-sort/.test(j),
     '金額で並べ替える仕掛けが無い');
  ok(!/filter[^)]*\.verified|verified[^)]*filter|ap-vf-only|onlyVerified/.test(j),
     '「Verified だけ」の絞り込みが無い');
  ok(/localeCompare/.test(j), '絞り込みの選択肢は名前順（localeCompare）である');
  ok(!/PVReferral|mountInvite|mountCohort/.test(j),
     '★招待カードをこの画面に描かない（my_cohort_gap の「あと2人で見える」はもう合わない）');
  ok(!/renderPub|ap-range|ap-plist|salaryRange/.test(j),
     '★推定レンジを描く関数が残っていない');
  ok(!/grain|ap-panel|ap-tcol/.test(j), '★2粒度と右パネルの部品が残っていない');
}

/* pay-viz.js が root で1回だけ持つ2式（db/test-form-contract.mjs が見張っている）。
   この画面に写すと、あちらが「2回ある」と言って落ちる。 */
{
  const j = decomment(JS);
  ok(!/\(\s*ann\s*-\s*bonus\s*\)\s*\/\s*12/.test(j), '(ann - bonus) / 12 を写していない');
  ok(!/\bn\s*\+\s*d\b/.test(j), 'n + d を写していない');
}

/* バッジは .ap-* で持つ。lp.css の .pv-badge を2ファイルで定義するとドリフトする。 */
{
  const c = decomment(CSS);
  ok(!/\.pv-badge/.test(c), 'actual-pay.css が .pv-badge 系を再定義していない');
  ok(/\.ap-badge--actual/.test(c), '本人記録（橙）のバッジを .ap-* で持っている');
  ok(!/\.ap-badge--pub/.test(c) && !/--pv-blue/.test(c),
     '★青（推定）の見た目がこの画面に1つも残っていない');
  ok(!/transition\s*:\s*all/.test(c), 'transition-all を使っていない');
  ok(/--pv-orange-ink/.test(c), '色はトークンから取っている（ブランド色を発明していない）');
  /* display:flex は UA の [hidden]{display:none} に勝つ。帯と枠の両方に要る。 */
  ok(/\.ap-filter\[hidden\]/.test(c) && /\.ap-f\[hidden\]/.test(c),
     '★[hidden] を明示している（flex は UA の hidden に勝つ）');
}

/* サーバ側。1行＝人の粒度なので anon には絶対に開かない。 */
{
  const i0 = SQL.indexOf('create or replace function public.pv_pay_rows()');
  const i1 = SQL.indexOf('revoke all on function public.pv_pay_rows()');
  const FN = i0 > -1 && i1 > i0 ? SQL.slice(i0, i1) : '';
  ok(!!FN, 'pv_pay_rows の定義が読めた');
  ok(/create or replace function public\.pv_pay_rows\(\)/.test(SQL),
     'pv_pay_rows は引数を1つも取らない（総当たり面を作らない）');
  ok(/grant execute on function public\.pv_pay_rows\(\) to authenticated/.test(SQL),
     'ログインした人だけが実行できる');
  ok(!/grant\s+execute[^;]*to[^;]*\banon\b/i.test(SQL),
     '★anon には1つも実行させない（pay_benchmarks と違って粒度が人なので開けない）');
  ok(/access_until/.test(FN), '鍵（access_until）を見ている');
  ok(/pv_sig2\(/.test(FN), '有効数字2桁に丸めている');
  ok(/order by md5\(/.test(FN),
     '★並びは md5(proof_hash) 順（投稿順に並べると「誰が最近出したか」が漏れる）');
  ok(!/order by[^;]*created_at/.test(FN), '★投稿順に並べていない');
  ok(!/>=\s*5|having\s+count/.test(FN), '★人数の門が残っていない（全員出す）');
  ok(!/interval\s*'30 days'|30 day/.test(FN), '★30日の遅延が残っていない');
  ok(!/percentile_cont\(0\.[19]\)/.test(FN), '★p10-p90 のクリップが残っていない');
  ok(!/airline_other/.test(FN), '★自由入力の社名の列は読んでも返してもいない');
  ok(/group by airline, pos, fleet, proof_hash/.test(FN), '★1行＝1人にまとめている');
  /* 集計側（pay_benchmarks）の k≧5 は今も生きている。こちらを一緒に外さない。 */
  ok(/pg_get_viewdef\(bench\) like '%>= 5%'/.test(SQL),
     '★集計（pay_benchmarks）の k≧5 は今も見張っている');
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
const FAKE = function (payload) {
  window.__rpc = [];
  const UID = '00000000-0000-4000-8000-00000000a001';
  const RPC = {
    pv_pay_rows: () => payload,
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
   ZQX は実在しない3文字（実在の空港コードを使うと、たまたま本文に出て誤検知する）。
   ★Somewhere Air は「自由入力で打ち込まれた社名」。これが画面に出たら、
     その人の勤務先が本人の書いた文字列そのままで他人に見えている。 */
const POISON = {
  base_iata: 'ZQX', seniority_years: 137, age_bucket: '40s',
  period_year: 2026, period_month: 8, created_at: '2026-08-05T00:00:00Z',
  proof_hash: 'deadbeefcafe0001', contract_type: 'direct', tax_country: 'JP',
  nationality: 'JP', annual_total_orig: 19440000, currency: 'JPY', verify_level: 2,
  airline_other: 'Somewhere Air'
};
/* ★字面がぶつからないものを選ぶ。'17' や '2026' のような短い数字は
   年号にたまたま出るので、毒として使えない。 */
const POISON_VALUES = ['ZQX', '137', '40s', 'deadbeefcafe0001',
                       '19,440,000', '19440000', '2026-08-05', 'Somewhere Air'];

const row = (airline, pos, fleet, usd, vf, extra) => Object.assign(
  { airline: airline, pos: pos, fleet: fleet, annual_usd: usd, verified: vf }, extra || {});

/* 本番に近い形（2026-08-23 時点は8人・全員が手入力＝verified はほぼ付かない）。
   ★1人目にだけ毒を混ぜる。★自由入力の社名の人は airline:'other' で来る。 */
const ROWS = [
  row('ana', 'cap', 'b787', 180000, true, POISON),
  row('ana', 'fo', 'b787', 120000, false),
  row('ana', 'cap', 'b777', 190000, false),
  row('jal', 'cap', 'a350', 170000, false),
  row('jal', 'fo', 'b737', 110000, false),
  row('emirates', 'cap', 'a380', 250000, false),
  row('other', 'cap', 'b737', 130000, false, { airline_other: 'Somewhere Air' }),
  row('other', 'fo', 'a320', 90000, false)
];

const LOCKED = { ok: true, state: 'locked', rows: [] };
const EMPTY = { ok: true, state: 'open', rows: [] };
const OPEN = { ok: true, state: 'open', rows: ROWS };

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

/* 結果の入れ物に出てはいけない「金額の形をした文字」。 */
const MONEY = /[¥$€£＄]|万|\d[\d,]{2,}/;

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const jars = [];
async function fresh() {
  const jar = await browser.createBrowserContext();
  jars.push(jar);
  const page = await jar.newPage();
  await page.setViewport({ width: 1360, height: 1200 });
  await page.evaluateOnNewDocument(() => { window['ga-disable-G-3XYF69VQ3X'] = true; });
  return page;
}

async function open(lang, payload) {
  const page = await fresh();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.evaluateOnNewDocument(FAKE, payload);
  await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'actual-pay.html',
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2600);
  return { page, errs };
}

/* 画面から一度に読み取るもの。★毎回同じ形で取る（ケースごとに見方を変えない）。 */
const SNAP = () => {
  const q = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const rows = document.getElementById('ap-rows');
  const bar = document.getElementById('ap-filter');
  const main = document.querySelector('.mr-main');
  const opts = (id) => {
    const s = document.getElementById(id);
    return s ? Array.prototype.slice.call(s.options).map((o) => o.textContent) : [];
  };
  const txt = (e) => (e ? e.innerText : '');
  return {
    url: location.pathname,
    rowsText: txt(rows),
    mainText: txt(main),
    bodyText: document.body.innerText,
    trs: q('tbody tr', rows).length,
    tables: q('table', rows).length,
    amounts: q('.ap-amt', rows).map((e) => e.textContent),
    vf: q('.ap-vf', rows).length,
    lock: q('.ap-msg--lock', rows).length,
    msg: q('.ap-msg', rows).length,
    cta: q('.ap-cta', rows).map((e) => e.getAttribute('href')),
    /* 消したものが実行時にも戻っていないこと。 */
    pub: document.getElementById('ap-pub') ? 1 : 0,
    bluePresent: q('.ap-badge--pub').length,
    orange: q('.ap-badge--actual').length,
    h1: q('h1').map((e) => e.innerText).join(' | '),
    h2: q('h2').length,
    ranges: q('.ap-range').length,
    plist: q('.ap-plist').length,
    panels: q('.ap-panel').length,
    pvr: q('.pvr').length,
    refSlot: document.getElementById('ap-ref-slot') ? 1 : 0,
    /* 絞り込み */
    barHidden: bar ? bar.hidden : null,
    fleetHidden: (function () {
      const w = document.getElementById('ap-fleet-wrap');
      return w ? w.hidden : null;
    })(),
    airOpts: opts('ap-air'), posOpts: opts('ap-pos'), fleetOpts: opts('ap-fleet'),
    calls: (window.__rpc || []).map((r) => r.name),
    withArgs: (window.__rpc || []).filter((r) => r.hasArgs).map((r) => r.name),
    tblTexts: q('table', rows).map((t) => t.innerText)
  };
};

/* ★消したものが戻っていないか（全ケースで同じことを見る）。 */
function gone(v, tag) {
  ok(v.pub === 0 && v.bluePresent === 0 && v.ranges === 0 && v.plist === 0,
     `${tag}: ★推定レンジの節が実行時にも無い`,
     `${v.pub}/${v.bluePresent}/${v.ranges}/${v.plist}`);
  ok(v.panels === 0, `${tag}: ★右の「選んだ区分」パネルが無い`, String(v.panels));
  ok(v.pvr === 0 && v.refSlot === 0, `${tag}: ★招待カードがこの画面に出ない`,
     `${v.pvr}/${v.refSlot}`);
  /* ★見出しは1つ。節が1つしか無いので、h1 とほぼ同じ h2 を並べない。
     札（本人記録）はその1つの見出しの行に付く。 */
  ok(v.h2 === 0 && v.orange === 1, `${tag}: ★見出しは1つ・「本人記録」の札も1つ`,
     `h2=${v.h2} / badge=${v.orange} / ${v.h1}`);
}

/* ★文言の約束。外した3つが本文に残っていると、そこだけ嘘になる。 */
function promises(v, lang, tag) {
  const t = v.mainText;
  const bad = lang === 'ja'
    ? (t.match(/5人|５人|30日|特定されません|公開情報|推定/g) || [])
    : (t.match(/five (?:or more|records|pilots)|30 days|30-day|cannot be identified|public sources|estimate/gi) || []);
  ok(bad.length === 0, `${tag}: ★外した約束（5人・30日・推定）が本文に残っていない`,
     bad.join(','));
}

// ════════════════════════════════════════════════════════════════
// A. 鍵が無い人（state:'locked'）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / A 鍵が無い（locked）════`);
  const { page, errs } = await open(lang, LOCKED);
  const v = await page.evaluate(SNAP);

  ok(v.lock === 1, '「明細を1枚出すと開きます」の1枚だけ', String(v.lock));
  ok(v.trs === 0 && v.amounts.length === 0, '★行も金額も1つも描かない',
     `${v.trs} 行 / ${v.amounts.length} 金額`);
  ok(!MONEY.test(v.rowsText), '★結果の中に金額の形をした文字が1つも無い',
     JSON.stringify(v.rowsText).slice(0, 160));
  ok(v.cta.some((h) => /pay-report\.html#ps/.test(h)),
     'Give & Get の導線（匿名で給与を追加）が出る', v.cta.join(','));
  ok(v.barHidden === true, '★絞り込みの帯ごと隠れる（空の選択肢を3つ並べない）',
     String(v.barHidden));
  gone(v, lang);
  promises(v, lang, lang);
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// B. 鍵はあるが1件も無い（state:'open', rows:[]）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / B 鍵はあるが0件 ════`);
  const { page, errs } = await open(lang, EMPTY);
  const v = await page.evaluate(SNAP);

  ok(v.msg === 1 && v.lock === 0, '「まだ1行もありません」の正直な1枚（鍵の案内ではない）',
     `${v.msg} / ${v.lock}`);
  ok(v.trs === 0 && v.tables === 0, '空の表を出さない', `${v.trs} / ${v.tables}`);
  ok(!MONEY.test(v.rowsText), '★0件のとき金額が1つも出ない',
     JSON.stringify(v.rowsText).slice(0, 160));
  ok(!/1,?247|68社|872|直近30日/.test(v.bodyText), '★件数・カバー社数の作り話を置かない');
  ok(v.barHidden === true, '★0件のときも絞り込みの帯は隠れる', String(v.barHidden));
  ok(v.cta.some((h) => /pay-report\.html#ps/.test(h)), '投稿への導線が出る', v.cta.join(','));
  gone(v, lang);
  promises(v, lang, lang);
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// C. 行がある（1行＝1人・全員）
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / C 行がある ════`);
  const { page, errs } = await open(lang, OPEN);
  const v = await page.evaluate(SNAP);

  ok(v.tables === 1, '★表は1枚だけ（粒度を2つに分けない）', String(v.tables));
  ok(v.trs === ROWS.length, `★返ってきた ${ROWS.length} 人が ${ROWS.length} 行そのまま出る`,
     String(v.trs));
  ok(v.amounts.length === ROWS.length, `金額が ${ROWS.length} つ`, String(v.amounts.length));

  /* ★③有効数字2桁。 */
  const bad2 = v.amounts.filter((s) => !isSig2(amountDigits(s)));
  ok(bad2.length === 0, '★金額がすべて有効数字2桁', bad2.join(' / ') || v.amounts.join(' / '));

  /* ★②準識別子。行に混ぜた毒がどこにも出ていないこと。 */
  const leaked = POISON_VALUES.filter((s) => v.bodyText.includes(s));
  ok(leaked.length === 0,
     '★基地・在籍年数・年代・投稿月・原本額・proof_hash・自由入力の社名が画面に出ない',
     leaked.join(','));
  ok(!/20\d\d年\s*\d+月|20\d\d-\d\d-\d\d/.test(v.rowsText), '★投稿の年月が出ない',
     JSON.stringify(v.rowsText).slice(0, 120));

  /* 自由入力の社名の人は、固定の札に置き換わる。 */
  const othLabel = lang === 'en' ? 'Other airline' : 'その他の航空会社';
  ok(v.rowsText.includes(othLabel), `★自由入力の社名は「${othLabel}」という固定の札になる`,
     JSON.stringify(v.rowsText).slice(0, 160));

  /* 検証済みは1人だけ。★verified の無い人に ✓ を付けない。 */
  ok(v.vf === 1, '★✓ Verified は verified:true の1人だけ', String(v.vf));

  /* ★⑤数え上げ。表そのものに数え方の言葉を1つも置かない。 */
  const tblAll = v.tblTexts.join('\n');
  ok(!/(件|人|reports?|pilots?)/i.test(tblAll),
     '★表の中に「件」「人」が1つも無い', JSON.stringify(tblAll).slice(0, 160));
  const counts = (v.rowsText.match(/(\d+)\s*(件|人|reports?|pilots?)/gi) || []);
  ok(counts.length === 0, '★合計件数・カバー社数を出さない', counts.join(','));
  ok(!/パーセンタイル|上位\s*\d|percentile|top\s*\d+\s*%/i.test(v.bodyText),
     '★「上位◯パーセンタイル」を出さない（本人を採点しない）');

  gone(v, lang);
  promises(v, lang, lang);

  /* ★絞り込みは「実際に行がある区分」だけ。112社を並べない。 */
  ok(v.barHidden === false, '行があるときは絞り込みの帯が出る', String(v.barHidden));
  ok(v.airOpts.length === 5, '航空会社は「すべて」＋実在する4つだけ', v.airOpts.join(','));
  ok(v.airOpts.some((s) => s === othLabel), '「その他の航空会社」も選べる', v.airOpts.join(','));
  ok(v.posOpts.length === 3, '職位は「すべて」＋2つ', v.posOpts.join(','));

  /* 会社 → 職位 と絞ると、下の段は上の段に追随する。 */
  const step = await page.evaluate(() => {
    const set = (id, v) => {
      const s = document.getElementById(id);
      const o = Array.prototype.slice.call(s.options).find((x) => x.value === v);
      s.value = o ? o.value : s.value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const q = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
    set('ap-air', 'ana');
    const afterAir = { trs: q('#ap-rows tbody tr').length,
                       pos: document.getElementById('ap-pos').options.length,
                       fleetHidden: document.getElementById('ap-fleet-wrap').hidden };
    set('ap-pos', 'cap');
    const afterPos = { trs: q('#ap-rows tbody tr').length,
                       fleet: document.getElementById('ap-fleet').options.length,
                       fleetHidden: document.getElementById('ap-fleet-wrap').hidden };
    document.getElementById('ap-clear').click();
    const afterClear = { trs: q('#ap-rows tbody tr').length,
                         air: document.getElementById('ap-air').value };
    return { afterAir, afterPos, afterClear };
  });
  ok(step.afterAir.trs === 3, '会社で絞ると3行', JSON.stringify(step.afterAir));
  ok(step.afterAir.pos === 3, '職位の選択肢はその会社にある2つ＋すべて',
     JSON.stringify(step.afterAir));
  ok(step.afterPos.trs === 2, '会社＋職位で絞ると2行', JSON.stringify(step.afterPos));
  ok(step.afterPos.fleet === 3 && step.afterPos.fleetHidden === false,
     '機材は2機種あるので選ばせる', JSON.stringify(step.afterPos));
  ok(step.afterClear.trs === ROWS.length && step.afterClear.air === '',
     '★解除で全員に戻る', JSON.stringify(step.afterClear));

  /* ⑥通貨を切り替えても引き直さない。 */
  const before = v.calls.filter((n) => n === 'pv_pay_rows').length;
  await page.evaluate(() => window.PVCurrency.set('USD'));
  await sleep(600);
  const u = await page.evaluate(SNAP);
  ok(u.calls.filter((n) => n === 'pv_pay_rows').length === before,
     '★通貨を切り替えても pv_pay_rows() を引き直さない',
     `${before} → ${u.calls.filter((n) => n === 'pv_pay_rows').length}`);
  ok(u.amounts.length === ROWS.length && u.amounts.every((s) => /\$/.test(s)),
     '金額はドル表記に変わる', u.amounts.join(' / '));
  const badU = u.amounts.filter((s) => !isSig2(amountDigits(s)));
  ok(badU.length === 0, '★換算後も有効数字2桁（端数の残った数字を出さない）',
     badU.join(' / ') || u.amounts.join(' / '));

  ok(u.calls.filter((n) => n === 'pv_pay_rows').length === 1,
     'pv_pay_rows() は1回だけ引く', String(u.calls.filter((n) => n === 'pv_pay_rows').length));
  ok(!u.withArgs.includes('pv_pay_rows'), '★引数を渡さない（総当たり面を作らない）',
     u.withArgs.join(','));
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// D. 絞り込みが行き止まりにならない
// ════════════════════════════════════════════════════════════════
/* 選択肢は「実際に行がある区分」からしか作らず、上の段を変えたら下の段は落とす。
   だから **どう選んでも0件にはならない**。0件が出る画面は「隠されている」に見える。
   ここでは総当たりでそれを確かめ、そのうえで
   万一そこへ落ちたときの受け皿（絞り込み用の正直な1枚）が正しいことも見る。 */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / D 行き止まりが無い ════`);
  const { page, errs } = await open(lang, OPEN);

  const sweep = await page.evaluate(() => {
    const g = (id) => document.getElementById(id);
    const set = (id, v) => {
      const s = g(id); s.value = v;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const vals = (id) => Array.prototype.slice.call(g(id).options).map((o) => o.value);
    const n = () => document.querySelectorAll('#ap-rows tbody tr').length;
    const dead = [];
    let combos = 0;
    for (const a of vals('ap-air')) {
      set('ap-air', a);
      if (!n()) dead.push('air=' + a);
      for (const p of vals('ap-pos')) {
        set('ap-air', a); set('ap-pos', p);
        if (!n()) dead.push('air=' + a + ',pos=' + p);
        for (const f of vals('ap-fleet')) {
          set('ap-air', a); set('ap-pos', p); set('ap-fleet', f);
          combos++;
          if (!n()) dead.push('air=' + a + ',pos=' + p + ',fleet=' + f);
        }
      }
    }
    g('ap-clear').click();
    return { dead: dead, combos: combos, back: n() };
  });
  ok(sweep.dead.length === 0,
     `★どう絞っても0件にならない（${sweep.combos} 通り試した）`, sweep.dead.join(' / '));
  ok(sweep.back === ROWS.length, '解除で全員に戻る', String(sweep.back));

  /* 受け皿。★選択肢に無い値を差し込んで、わざとそこへ落とす。
     ここで「まだ1行もありません／最初の1人になれます」と言うと、
     絞り込みのせいで空なだけなのに「誰も出していない」という嘘になる。 */
  const net = await page.evaluate(() => {
    const s = document.getElementById('ap-air');
    const o = document.createElement('option');
    o.value = 'zzz-not-an-airline'; o.textContent = 'zzz';
    s.appendChild(o); s.value = o.value;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    const rows = document.getElementById('ap-rows');
    return { trs: rows.querySelectorAll('tbody tr').length,
             msg: rows.querySelectorAll('.ap-msg').length,
             lock: rows.querySelectorAll('.ap-msg--lock').length,
             cta: rows.querySelectorAll('.ap-cta').length,
             text: rows.innerText,
             barHidden: document.getElementById('ap-filter').hidden };
  });
  ok(net.trs === 0 && net.msg === 1 && net.lock === 0, '正直な1枚が出る',
     `${net.trs}/${net.msg}/${net.lock}`);
  ok(net.barHidden === false, '★絞り込みの帯は出したまま（外せないと閉じ込めになる）',
     String(net.barHidden));
  const first = lang === 'en' ? 'the first' : '最初の1人';
  ok(!net.text.includes(first) && net.cta === 0,
     '★「最初の1人になれます」と言わない（絞り込みのせいで0件なだけ）',
     JSON.stringify(net.text).slice(0, 160));
  ok(!MONEY.test(net.text), '金額が1つも出ない', JSON.stringify(net.text).slice(0, 120));

  const undo = await page.evaluate(() => {
    document.getElementById('ap-clear').click();
    return document.querySelectorAll('#ap-rows tbody tr').length;
  });
  ok(undo === ROWS.length, '★そこからも「絞り込みを解除」で戻れる', String(undo));
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

for (const jar of jars) { try { await jar.close(); } catch (e) {} }
await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
