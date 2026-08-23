/* assert-founding.mjs — FOUNDING PILOT 100（創設メンバー）の板の約束を機械で確かめる。

   称号は飾りだが、飾りだからこそ壊れ方が静かで、壊れても誰も文句を言わない。
   見るのはこの5つ：

     ① 板に数字が1文字も出ない。★持っている人にも、持っていない人にも。
        ★ワードマークの "FOUNDING PILOT 100" だけは別（あれは題名で、数ではない）。
        通し番号はサーバー側が100人で締めるための道具であって、本人に見せるものではない
        （2026-08-23 オーナー判断で画面から外した）。
        no=1 / 7 / 100 のどれで描いても**表示が1文字も変わらない**ことで確かめる
     ② 「あと86枠」を出すと、そこから会員の規模が読める。
        人数を出さないのは db/referrals.sql:19 と同じ約束
     ③ 答えが取れないとき（SQL をまだ貼っていない・RPC が落ちた）は
        何も描かない。★沈んだ板を出すと、番号を持っている人に
        「まだ持っていません」と見せることになる
     ④ 待遇モーダル（pv-conditions.js）・招待（pv-referral.js）とぶつからない
        ＝そもそも覆いを作らない。position:fixed も role="dialog" も書かない
     ⑤ マイページの本体（プロフィールカード）を1mm も壊さない。
        板が落ちてもページは動く

   ついでにテーマも見る。★このリポジトリに prefers-color-scheme は1つも無く、
   テーマは [data-theme] 属性だけで決まる。#f5c842 を白地に置くと
   コントラスト比 1.65 で読めないので、明るい側で金を文字色に使わない。

   ⚠️ 偽物 Supabase の rpc は本物と同じ「then だけを持つ箱」。async に戻さない
      （assert-referral.mjs / assert-conditions.mjs と同じ罠）。

   実行: node assert-founding.mjs
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない。
*/
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const BASE = 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const nocomment = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const nohtml = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

// ════════════════════════════════════════════════════════════════
// 0. ソース（ブラウザを開かなくても分かること）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ソース ════');
{
  /* ★言葉ではなく実体を見る。ヘッダーのコメントには「position:fixed を書かない」
     という説明そのものが書いてあるので、素朴に grep すると説明を消して直すことになる。 */
  const js = nocomment(read('./pv-founding.js'));

  for (const [pat, why] of [
    ['position:fixed',      '画面に貼り付く箱を作らない'],
    ['aria-modal',          'モーダルにしない'],
    ['role="dialog"',       'ダイアログにしない'],
    ["role='dialog'",       'ダイアログにしない（引用符違い）'],
    ['body.style.overflow', '背後のスクロールを止めない']
  ]) ok(js.split(pat).length - 1 === 0, `pv-founding.js に ${pat} が無い（${why}）`);

  /* ★テーマの決め方。ここに prefers-color-scheme を1行書くと、
     [data-theme] で明るくしている人の板だけが暗いまま残る。 */
  ok(!js.includes('prefers-color-scheme'),
     '★pv-founding.js に prefers-color-scheme が無い（テーマは [data-theme] だけ）');
  ok(js.includes('[data-theme="light"]'), 'pv-founding.js が [data-theme="light"] で明るい側を上書きする');

  /* ★本物の supabase-js の rpc() は「then だけを持つ箱」で .catch を持たない。
     直に .catch を生やすと本番で TypeError になる（2026-08-19 の真っ白事故）。 */
  ok(/Promise\.resolve\(\s*sb\.rpc\(/.test(js),
     '★rpc の戻りを Promise.resolve で包む（then だけの箱に .catch を生やさない）');

  /* 引くのは自分の番号だけ。名簿を直に select する道を作らない
     （RLS が自分の行しか返さないとはいえ、画面から表を触る癖をつけない）。 */
  const rpcs = [...js.matchAll(/sb\.rpc\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
  ok(rpcs.length === 1 && rpcs[0] === 'my_founding',
     '★引くのは my_founding だけ（総数も他人の番号も引かない）', rpcs.join(','));
  ok(!/from\(\s*['"]founding_members/.test(js),
     'pv-founding.js が founding_members を直に読まない');

  /* ★番号を画面に流し込まない。no は「持っているか」の判定にだけ使う。
     持っている人の板に一文を添えるのも取りやめた（称号だけを出す）。 */
  ok(!/pvf-no(?!te)/.test(js), '★番号を出す欄そのものが無い');  // pvf-note に当てない
  ok(!/tabular-nums/.test(js), '★等幅数字の指定も残っていない（番号を出す名残）');
}

{
  /* 日英2ファイルの罠。片方だけ入れる事故がこのリポジトリでは何度も起きている。 */
  for (const [f, src] of [['profile.html', 'pv-founding.js'], ['en/profile.html', '../pv-founding.js']]) {
    const raw = read('./' + f);
    const h = nohtml(raw);
    ok(h.includes('id="pv-founding-slot"'), `${f} に差込口がある`);
    ok(h.includes('PVFounding.mount'), `${f} が mount を呼ぶ`);
    const tag = h.indexOf(`<script src="${src}">`);
    ok(tag > 0 && tag < h.indexOf('PVFounding.mount'),
       `${f} は pv-founding.js を mount を呼ぶスクリプトより前に読む`, String(tag));
    /* 落ちてもページを止めない（他の3か所と同じ作法）。 */
    ok(/try\s*\{[^}]*PVFounding\.mount[\s\S]{0,140}?catch/.test(h),
       `${f} の mount が try で囲われている`);
    /* ★板は <main> のいちばん上。プロフィールカードより後ろに落ちると
       「上にカッコよく」ではなくなる。 */
    ok(raw.indexOf('id="pv-founding-slot"') < raw.indexOf('id="profile-card"'),
       `${f} の板がプロフィールカードより上にある`);
    /* 口コミ・給与の画面には出さない（母集団が十数人なので特定に近づく）。 */
  }
  for (const f of ['submit-review.html', 'en/submit-review.html', 'pay-report.html', 'en/pay-report.html',
                   'my-value.html', 'en/my-value.html', 'actual-pay.html', 'en/actual-pay.html',
                   'index.html', 'en/index.html']) {
    ok(!read('./' + f).includes('pv-founding'),
       `★${f} に称号を出さない（母集団が小さく、投稿の横に番号が出ると書き手が絞れる）`);
  }
}

{
  /* SQL 側。詳しくは db/test-founding.mjs が pglite で回すが、
     「誰に実行させるか」だけはここでも見る（貼るのはオーナーで、貼る前に落としたい）。 */
  const sql = read('./db/founding.sql');
  ok(/grant\s+execute\s+on\s+function\s+public\.my_founding\(\)\s+to\s+authenticated/i.test(sql),
     'my_founding はログインした人だけが呼べる');
  for (const fn of ['pv_award_founding', 'pv_backfill_founding']) {
    const g = new RegExp('grant\\s+execute[^;]*\\b' + fn + '\\b[^;]*to\\s+[^;]*(anon|authenticated)', 'i');
    ok(!g.test(sql), `★${fn} は画面から呼べない（grant しない）`);
  }
  ok(!/grant[^;]*\b(insert|update|delete)\b[^;]*founding_members[^;]*to/i.test(sql),
     '★本人は名簿に書き込めない（insert/update/delete を grant しない）');
  ok(/create\s+policy[^;]*founding_select_self[\s\S]*?user_id\s*=\s*auth\.uid\(\)/i.test(sql),
     '名簿は自分の行しか読めない');
}

// ════════════════════════════════════════════════════════════════
// 偽物 Supabase
// ════════════════════════════════════════════════════════════════
/* payload = my_founding() が返す中身。null を渡すとエラーを返す
   （＝まだ db/founding.sql を貼っていないとき・関数が落ちたとき）。 */
const FAKE = function (payload, theme) {
  localStorage.setItem('pv-theme', theme || 'dark');
  window['ga-disable-G-3XYF69VQ3X'] = true;
  const UID = '00000000-0000-4000-8000-00000000a001';
  const RPC = {
    my_founding: () => payload,
    my_pay_reports: () => ({ ok: true, reports: [], report_count: 0, streak_months: 0,
      access_until: null, badge: 'none', badge_state: 'none', mail_optin: false, pay_day_of_month: 5 }),
    my_cohort_gap: () => ({ ok: true, state: 'none' }),
    my_referral_code: () => ({ ok: true, code: 'K7QD3XZM', invited: 0, converted: 0 }),
    claim_referral: () => ({ ok: true, status: 'none' }),
    my_airline_conditions: () => ({ ok: true, answers: [], answered_total: 0, questions_total: 32 }),
    next_condition_questions: () => ({ ok: true, airline: 'zipair', mine_count: 0, questions: [] })
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
      getUser:    async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
      signOut:    async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: (t) => t === 'profiles'
      ? q([{ id: UID, name: 'Sample Pilot', email: 'pilot@example.com',
             company: 'ZIPAIR', position: 'captain', email_opt_in: false }])
      : q([]),
    /* ★then だけを持つ箱。async に戻さない。 */
    rpc: (name) => {
      const has = Object.prototype.hasOwnProperty.call(RPC, name);
      const val = has ? RPC[name]() : { ok: true };
      const res = (name === 'my_founding' && val === null)
        ? { data: null, error: { message: 'function public.my_founding() does not exist', code: '42883' } }
        : { data: val, error: null };
      return { then: (y, n) => Promise.resolve(res).then(y, n) };
    }
  };
  Object.defineProperty(window, 'supabase',
    { value: { createClient: () => CLIENT }, writable: false, configurable: false });
};

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const jars = [];
async function open(lang, payload, theme, width) {
  const jar = await browser.createBrowserContext();
  jars.push(jar);
  const page = await jar.newPage();
  await page.setViewport({ width: width || 1280, height: 1100 });
  await page.evaluateOnNewDocument(FAKE, payload, theme || 'dark');
  await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'profile.html',
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1600);
  return page;
}

/* 板の中身を読む。★題名の "FOUNDING PILOT 100" は数ではないので、
   数字の検査をする前に取り除く。 */
const look = () => ({
  found:   !!document.querySelector('.pvf'),
  state:   (document.querySelector('.pvf') || {}).getAttribute
             ? document.querySelector('.pvf').getAttribute('data-pvf') : '',
  text:    document.querySelector('.pvf') ? document.querySelector('.pvf').innerText : '',
  digits:  document.querySelector('.pvf')
             ? document.querySelector('.pvf').innerText.replace(/FOUNDING\s*PILOT\s*100/gi, '').replace(/[^\d]/g, '')
             : '',
  pos:     document.querySelector('.pvf') ? getComputedStyle(document.querySelector('.pvf')).position : '',
  logoCol: document.querySelector('.pvf-logo') ? getComputedStyle(document.querySelector('.pvf-logo')).color : '',
  /* ワードマークは「文字」ではなく「題字」として立たせる（太さと字間で分ける）。
     以前は番号をセリフ体にしてここを担保していたが、番号ごと外した。 */
  logoW:   document.querySelector('.pvf-logo') ? getComputedStyle(document.querySelector('.pvf-logo')).fontWeight : '',
  logoLs:  document.querySelector('.pvf-logo') ? getComputedStyle(document.querySelector('.pvf-logo')).letterSpacing : '',
  logoFam: document.querySelector('.pvf-logo') ? getComputedStyle(document.querySelector('.pvf-logo')).fontFamily : '',
  subCol:  document.querySelector('.pvf-sub') ? getComputedStyle(document.querySelector('.pvf-sub')).color : '',
  bodyFam: getComputedStyle(document.body).fontFamily,
  noteCount: document.querySelectorAll('.pvf-note').length,
  bodyOv:  getComputedStyle(document.body).overflow,
  card:    !!document.getElementById('profile-card'),
  cardTxt: (document.getElementById('profile-card') || { innerText: '' }).innerText.length,
  invite:  !!document.querySelector('.pvr'),
  /* 重なりを見る。板・プロフィールカード・招待カード・nav の4つ。 */
  hits:    (function () {
    const p = document.querySelector('.pvf');
    if (!p) return [];
    const a = p.getBoundingClientRect();
    const over = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return false;
      const b = e.getBoundingClientRect();
      if (!b.width || !b.height) return false;
      return !(a.right <= b.left + 0.5 || a.left >= b.right - 0.5 ||
               a.bottom <= b.top + 0.5 || a.top >= b.bottom - 0.5);
    };
    return ['nav', '#profile-card', '.pvr', '[data-pvc]'].filter(over);
  })(),
  /* 板が <main> のいちばん上にあるか（プロフィールカードより上） */
  first:   (function () {
    const p = document.querySelector('.pvf'), c = document.getElementById('profile-card');
    if (!p || !c) return false;
    return p.getBoundingClientRect().bottom <= c.getBoundingClientRect().top + 0.5;
  })()
});

// ════════════════════════════════════════════════════════════════
// 1. 称号を持っている人 — ★称号だけを出す。番号も説明の一文も出さない
// ════════════════════════════════════════════════════════════════
const seen = {};
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / 称号あり ════`);
  const page = await open(lang, { ok: true, no: 7 });
  const v = await page.evaluate(look);

  ok(v.found, '板が出る');
  ok(v.state === 'has', '「持っている」姿で出る', v.state);
  ok(/FOUNDING PILOT 100/.test(v.text), 'ワードマークが出る', JSON.stringify(v.text));
  ok(v.digits === '', '★数字が1文字も出ない（通し番号は本人にも見せない）', JSON.stringify(v.text));
  ok(lang === 'ja' ? /創設メンバー/.test(v.text) : /Founding Member/.test(v.text),
     'ページの言語の文面が出る', JSON.stringify(v.text));
  /* ★持っている人に説明の一文を添えない（オーナー判断）。称号は説明しないから称号になる。 */
  ok(v.noteCount === 0, '★持っている人の板に説明文を足さない', String(v.noteCount));
  ok(v.first, '★プロフィールカードより上に出る（マイページのいちばん上）');
  ok(v.hits.length === 0, '★何とも重ならない（nav・カード・招待・待遇）', v.hits.join(','));
  ok(v.pos !== 'fixed', '画面に貼り付かない', v.pos);
  ok(v.bodyOv !== 'hidden', '背後のスクロールを止めない', v.bodyOv);
  /* 番号をセリフ体にして本文と分けていたが、番号ごと外した。
     いまは太さと字間でワードマークを題字として立たせている。 */
  ok(Number(v.logoW) >= 800, 'ワードマークが本文と同じ見え方にならない（太さ）', v.logoW);
  ok(parseFloat(v.logoLs) > 0.5, 'ワードマークの字間が開いている（題字として読める）', v.logoLs);
  ok(v.card && v.cardTxt > 40, 'プロフィールカードが今までどおり出る', String(v.cardTxt));
  /* 招待の常設入口が板に押し出されて消えていないか（2026-08-19 に消えた前科がある）。 */
  ok(v.invite, '★招待の常設入口が消えていない');
  seen[lang] = v.text;
  await page.close();
}

/* ★番号が画面に一切効いていないことを、いちばん強い形で確かめる。
   no=1 / 7 / 100 のどれで描いても表示が1文字も変わらない。
   将来うっかり番号を出す実装に戻すと、ここが真っ先に落ちる。 */
for (const no of [1, 100]) {
  const page = await open('ja', { ok: true, no });
  const t = (await page.evaluate(look)).text;
  ok(t === seen.ja, `★no=${no} でも表示が変わらない（番号が画面に出ていない証拠）`, JSON.stringify(t));
  await page.close();
}

// ════════════════════════════════════════════════════════════════
// 2. 番号がまだ無い人 — ★数字が1文字も出ないこと
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / 番号なし ════`);
  const page = await open(lang, { ok: true, no: null });
  const v = await page.evaluate(look);

  ok(v.found, '板は出る（何が入るのかが分かる姿で）');
  ok(v.state === 'none', '「まだ無い」姿で出る', v.state);
  ok(v.digits === '', '★数字が1文字も出ない（残り枠・会員数を漏らさない）', JSON.stringify(v.text));
  ok(lang === 'ja' ? /給与か口コミをひとつ出すと/.test(v.text) : /Share one pay report or one review/.test(v.text),
     '入れ方だけを1行で言う', JSON.stringify(v.text));
  ok(!/(残り|あと|slots? left|remaining)/i.test(v.text), '★「残り◯枠」を書かない', JSON.stringify(v.text));
  ok(v.first, 'プロフィールカードより上に出る');
  ok(v.hits.length === 0, '何とも重ならない', v.hits.join(','));
  ok(v.card && v.cardTxt > 40, 'プロフィールカードが今までどおり出る');
  await page.close();
}

// ════════════════════════════════════════════════════════════════
// 3. 答えが取れないとき — ★何も描かない
// ════════════════════════════════════════════════════════════════
/* db/founding.sql をまだ Supabase に貼っていない状態がこれ。
   沈んだ板を出すと、既に番号を持っている14人に
   「あなたはまだ持っていません」と嘘を見せることになる。 */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / RPC が答えない（SQL 未適用） ════`);
  const page = await open(lang, null);
  const v = await page.evaluate(look);
  ok(!v.found, '★板を1枚も描かない（持っている人に「まだ」と見せない）', v.text);
  ok(v.card && v.cardTxt > 40, 'ページは止まらない（プロフィールカードは出る）', String(v.cardTxt));
  ok(v.invite, '招待の常設入口も出る');
  await page.close();
}

// ════════════════════════════════════════════════════════════════
// 4. テーマ — ★明るい側で金を文字色に使わない
// ════════════════════════════════════════════════════════════════
console.log('\n════ テーマ ════');
{
  const rgb = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
  const lum = (c) => {
    const f = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  const ratio = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  for (const theme of ['dark', 'light']) {
    const page = await open('ja', { ok: true, no: 7 }, theme);
    const v = await page.evaluate(look);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    ok(v.found, `${theme} でも板が出る`);
    /* ★#f5c842 = rgb(245,200,66)。白地に置くとコントラスト 1.65 で読めない。 */
    const isBrandGold = (s) => rgb(s).join(',') === '245,200,66';
    if (theme === 'light') {
      ok(!isBrandGold(v.logoCol), '★明るい側でワードマークに #f5c842 を使わない', v.logoCol);
      ok(!isBrandGold(v.subCol), '★明るい側で副題にも #f5c842 を使わない', v.subCol);
    }
    /* 板の背景ではなくページの背景と比べる（板は半透明の重ねなので実測が要る）。 */
    ok(ratio(v.logoCol, bg) >= 3.0, `${theme} でワードマークが読める（3.0以上）`,
       ratio(v.logoCol, bg).toFixed(2));
      ok(ratio(v.subCol, bg) >= 3.0, `${theme} で副題が読める（3.0以上）`, ratio(v.subCol, bg).toFixed(2));
    await page.close();
  }
}

// ════════════════════════════════════════════════════════════════
// 5. 狭い画面 — ワードマークが2行に折れない・説明文が語の途中で切れない
// ════════════════════════════════════════════════════════════════
console.log('\n════ 390px ════');
/* ★称号あり・称号なしの両方を見る。沈んだ板のほうが説明文が長い。 */
for (const [scene, payload] of [['称号あり', { ok: true, no: 100 }], ['称号なし', { ok: true, no: null }]]) {
  console.log('  — ' + scene);
  const page = await open('ja', payload, 'dark', 390);
  const v = await page.evaluate(() => {
    const p = document.querySelector('.pvf');
    const logo = document.querySelector('.pvf-logo');
    const a = p.getBoundingClientRect(), l = logo.getBoundingClientRect();
    /* ★FOUNDING PILOT 100 は長い。1行に収まらないと題字に見えない。
       行高で割って行数を数える（scrollWidth では折れたことが分からない）。 */
    const lh = parseFloat(getComputedStyle(logo).lineHeight) || l.height;
    const note = document.querySelector('.pvf-note');
    const nw = note ? note.getBoundingClientRect().width : 0;
    const bad = note
      ? [...p.querySelectorAll('.pvf-nb')].filter((e) => e.getBoundingClientRect().width > nw + 0.5)
      : [];
    return { over: l.right > a.right + 0.5 || l.left < a.left - 0.5,
             lines: Math.round(l.height / lh),
             scroll: document.documentElement.scrollWidth > window.innerWidth + 1,
             wrap: bad.length > 0, wrapAt: bad.map((e) => e.textContent).join(' / '),
             text: p.innerText };
  });
  ok(!v.over, '★ワードマークが板からはみ出さない');
  ok(v.lines === 1, '★FOUNDING PILOT 100 が2行に折れない', String(v.lines));
  ok(!v.scroll, '横スクロールが出ない');
  /* ★日本語はどこでも折れる。390px で「100人のひ／とりです。」と語の途中で
     切れていた（実際に切れた）。折る場所は .pvf-nb でこちらが決める。 */
  ok(!v.wrap, '★説明文が語の途中で折れない（塊が入りきっている）', v.wrapAt);
  ok(v.text.replace(/FOUNDING\s*PILOT\s*100/gi, '').replace(/[^\d]/g, '') === '',
     '★狭い画面でも数字が1文字も出ない', JSON.stringify(v.text));
  await page.close();
}

for (const j of jars) { try { await j.close(); } catch (e) {} }
await browser.close();
console.log(`\n──── ${pass} pass / ${fail} fail ────\n`);
process.exit(fail ? 1 : 0);
