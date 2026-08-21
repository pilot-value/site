/* assert-my-posts.mjs — マイページの「あなたが出したもの」が本当のことを言うか。

   2026-08-20、会員から「アカウントを作って口コミを投稿したのに、口コミが
   アカウントに紐づかなかった」という報告が来た。本番のDBを読むと、口コミも
   給与レポートも本人の proof_hash と1件残らず一致していた＝データは正しかった。
   壊れていたのはマイページの表示だけで、profile.html が一覧を **ゼロ件で固定**
   していた（renderReviews([]) がハードコード）。しかも同じ画面の少し上には
   「口コミ解放中（…まで）」のバッジが出る。

     「解放中」＋「投稿はありません」＝ 出したものが消えた、と読める。

   だからここで守る約束は「一覧が本当のことを言う」の一点：

     ① 出した人には、口コミも給与も**両方**出る
     ② 出していない人にだけ「まだ出していません」と言う
     ③ **引けなかったときは「0件」と言わない**（これが上の報告の作り方そのもの。
        通信や権限で落ちただけの人に「まだ投稿していません」と言い切らない）
     ④ 他人の proof_hash の行が1件も混ざらない
     ⑤ 「口コミ解放中」なのに一覧が空、という組み合わせがデータの道筋から作れない
     ⑥ 金額が1文字も出ない（マイページは人に見せる場面がある。実額は my-value.html）
     ⑦ orig_lang / translations がまだ無い環境でも口コミが消えない
     ⑧ 本人の uid そのものは1度も問い合わせに乗らない（載るのはハッシュだけ）

   ⚠️ 偽物 Supabase の rpc は本物と同じ「then だけを持つ箱」にしてある。
      async にすると本番に無い .catch が生えて、2026-08-19 の真っ白事故と
      同じ穴がまた開く（assert-referral.mjs / assert-conditions.mjs に経緯あり）。

   実行: node assert-my-posts.mjs
         node assert-my-posts.mjs --open [ja|en]   ← 撮らずに窓で開く（目で見る用）
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない。
*/
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const BASE = 'http://localhost:3000';
const OPEN = process.argv.includes('--open');
const OPEN_LANG = process.argv.includes('en') ? 'en' : 'ja';

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ★実在しない uid。この台本が作った文字列。
   proof_hash は塩なしで再現できる（submit-review.html:1183 と同じ式）ので、
   ここで作ったハッシュはブラウザ側の pv-reunlock.js が作るものと必ず一致する。
   一致しなければ式が割れたということ＝この検査の本体でもある。 */
const UID      = '00000000-0000-4000-8000-00000000a001';
const STRANGER = '00000000-0000-4000-8000-00000000a002';
const H = (uid, code) => createHash('sha256').update(uid + '::pv_anon::' + code + '::2026').digest('hex');

// ════════════════════════════════════════════════════════════════
// 0. ソースの検査（ブラウザを開かなくても分かること）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ソース ════');
{
  const nohtml = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
  const nocomment = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const ru = nocomment(read('./pv-reunlock.js'));
  ok(ru.includes('window.pvFindMyReviews'), 'pv-reunlock.js が pvFindMyReviews を出す');
  ok(ru.includes('window.pvMyPayReports'), 'pv-reunlock.js が pvMyPayReports を出す');
  /* ★総当たりの結果を捨てない。.limit(1) が戻ると「1件でもあるか」しか分からなくなり、
     マイページはまたゼロ件固定に戻るしかなくなる。 */
  ok(!/\.limit\(1\)/.test(ru), 'pv-reunlock.js に .limit(1) が戻っていない（行を捨てない）');
  /* ★引けなかったときは null。[] と同じにすると「まだ投稿していません」と言い切る。 */
  ok(/if \(!r2 \|\| r2\.error\) return null;/.test(ru),
     '★1つでも失敗した塊があれば null（＝0件と言わない）');
  ok(/if \(reviews && reviews\.length > 0\)/.test(ru),
     '引けなかった（null）ときに解放を消さない');

  for (const [f, i18n, locale] of [
    ['profile.html', 'review-i18n.js', 'ja-JP'],
    ['en/profile.html', '../review-i18n.js', 'en-US'],
  ]) {
    const raw = read('./' + f);
    const s = nohtml(raw);
    ok(raw.includes(`<script src="${i18n}"></script>`), `${f} が review-i18n.js を読む`);
    ok(!s.includes('renderReviews([])'), `★${f} のゼロ件固定が消えている`);
    ok(s.includes('pvFindMyReviews'), `${f} が本人の口コミを引く`);
    ok(s.includes('pvMyPayReports'), `${f} が本人の給与レポートを引く`);
    ok(s.includes('id="my-pay-list"'), `${f} に給与レポートの置き場がある`);
    ok(s.includes(`toLocaleDateString('${locale}')`), `${f} の日付が ${locale}`);

    /* ★金額を出さない。カードの中で使う列名を実体で見る（言葉では守れない）。 */
    const block = s.slice(s.indexOf('function renderMyPay'), s.indexOf('function startEdit'));
    ok(block.length > 100, `${f} の renderMyPay を読めた`, String(block.length));
    ok(!/annual_total|base_pay|net_annual|gross_monthly|net_pay_actual|bonus_/.test(block),
       `★${f} の給与一覧が金額の列を1つも触らない`);
    /* ★引けなかったときの言い方が別にある（0件と混ぜない）。 */
    ok((block.match(/if \(!reports\)/g) || []).length === 1,
       `${f} が「引けなかった」と「0件」を分けている`);
  }

  /* ★口コミの投稿側。持ち主が居ないまま投稿が通ると、全員が同じ
     sha256('null::pv_anon::…') になり、持ち主不明の行が1つできる。 */
  for (const f of ['submit-review.html', 'en/submit-review.html']) {
    const raw = read('./' + f);
    const s = nohtml(raw);
    ok(raw.includes('<div id="form-wrap" style="display:none">'),
       `${f} のフォームは既定で閉じている（通ったときだけ出す）`);
    ok(/try \{ \(\{ data: \{ session \} \} = await _sb\.auth\.getSession\(\)\); \} catch \(e\) \{ session = null; \}/.test(s),
       `${f} が getSession の例外を握る（例外でフォームが開いたままにならない）`);
    ok(s.includes("if (!userId) throw new Error('not signed in')"),
       `★${f} は持ち主が無いとハッシュを作らない`);
    ok(s.includes("'login.html?next=' + encodeURIComponent('submit-review.html' + location.search)"),
       `${f} はログインの往復で ?airline= を落とさない`);
    ok(/other\.style\.display = \(sel\.value === 'other'\) \? '' : 'none'/.test(s),
       `${f} は知らない会社コードで自由入力欄を出す（行き止まりにしない）`);
  }
}

// ════════════════════════════════════════════════════════════════
// 見本のデータ
// ════════════════════════════════════════════════════════════════
/* ★どれも実在の投稿ではない。この台本が作った文字列。
   'jal' は総当たりの先頭の塊、'westjet' は最後の塊に入る＝分割して投げた結果を
   ちゃんと1つに繋いでいるかも同時に見る。 */
const REV_JAL = {
  id: 'rev-jal', proof_hash: H(UID, 'jal'), airline: 'jal',
  created_at: '2026-08-20T14:24:00Z',
  culture_comment: '路線の入れ替えが多く、月ごとの生活リズムが読みにくい。',
  salary_comment: '', benefits_comment: '', wlb_comment: '',
  ops_comment: '', training_comment: '', mgmt_comment: '',
  orig_lang: 'ja',
  translations: { en: { culture: 'Route changes are frequent, so the monthly rhythm is hard to read.' } },
};
const REV_WJ = {
  id: 'rev-wj', proof_hash: H(UID, 'westjet'), airline: 'westjet',
  created_at: '2026-08-21T09:00:00Z',
  culture_comment: '', salary_comment: '', benefits_comment: '', wlb_comment: '',
  ops_comment: '冬の運航は遅れが出やすいが、地上との連携は良い。',
  training_comment: '', mgmt_comment: '',
  orig_lang: 'ja',
  translations: { en: { ops: 'Winter operations run late often, but coordination with the ground is good.' } },
};
/* ★他人の行。同じテーブルに置いておく。出てきたら匿名設計ごと壊れている。 */
const REV_OTHER = {
  id: 'rev-x', proof_hash: H(STRANGER, 'ana'), airline: 'ana',
  created_at: '2026-08-19T00:00:00Z',
  culture_comment: 'ヨソノヒトノクチコミ', salary_comment: '', benefits_comment: '',
  wlb_comment: '', ops_comment: '', training_comment: '', mgmt_comment: '',
  orig_lang: 'ja', translations: { en: { culture: 'SomebodyElsesReview' } },
};

const payReport = (year, month, created) => ({
  airline: 'jal', airline_other: null, position: 'fo', fleet: 'b787', base_iata: 'HND',
  period_year: year, period_month: month, period_ym: year * 12 + month,
  currency: 'JPY', fx_to_jpy: 1, fx_to_usd: 0.0067,
  base_pay: 1050000, command_pay: 0, housing_type: 'allowance', housing_amount: 60000,
  per_diem: 48000, transport: 22000, other_allowance: 260000, bonus_annual: 0,
  block_hours: 71.5, duty_hours: 139, net_pay_actual: 1360000, deduction_total: 260000,
  annual_total_orig: 19440000, annual_total_jpy: 19440000, annual_total_usd: 130248,
  net_annual_jpy: 15000000, usd_per_block_hour: 145.6,
  source: 'manual', verify_level: 0, contract_type: 'direct', created_at: created,
});
// my_pay_reports() は period_ym の昇順で返す（db/pay-reports.sql）
const REPORTS = [payReport(2026, 6, '2026-06-10T00:00:00Z'), payReport(2026, 8, '2026-08-20T14:28:00Z')];

const AIRLINES = [
  { code: 'jal', name_ja: '日本航空（JAL）', name_en: 'Japan Airlines (JAL)' },
  { code: 'westjet', name_ja: 'ウェストジェット航空', name_en: 'WestJet Airlines' },
  { code: 'ana', name_ja: '全日本空輸（ANA）', name_en: 'All Nippon Airways (ANA)' },
];

// ════════════════════════════════════════════════════════════════
// 偽物 Supabase
// ════════════════════════════════════════════════════════════════
const FAKE = function (cfg) {
  window.__q = [];      // 投げられた問い合わせの控え
  window.__rpc = [];

  const box = (res) => ({ then: (y, n) => Promise.resolve(res).then(y, n) });

  function table(name, rows) {
    const st = { rows: rows.slice(), error: null };
    const log = { t: name, cols: '', in: [] };
    window.__q.push(log);
    const o = {
      select: (c) => {
        log.cols = c || '';
        if (name === 'reviews_v2') {
          if (cfg.hardError) st.error = { code: '42501', message: 'permission denied for table reviews_v2' };
          else if (cfg.failExtra && log.cols.indexOf('orig_lang') >= 0)
            st.error = { code: '42703', message: 'column reviews_v2.orig_lang does not exist' };
        }
        return o;
      },
      eq: (k, v) => { st.rows = st.rows.filter((r) => r[k] === v); return o; },
      in: (k, list) => {
        log.in = log.in.concat(list);
        st.rows = st.rows.filter((r) => list.indexOf(r[k]) >= 0);
        return o;
      },
      order: () => o, limit: (n) => { st.rows = st.rows.slice(0, n); return o; },
      update: () => o, insert: () => o,
      single: async () => ({ data: st.rows[0] || null, error: st.error }),
      maybeSingle: async () => ({ data: st.rows[0] || null, error: st.error }),
      /* ★本物の supabase-js が返すのは「then だけを持つ箱」。catch も finally も無い。 */
      then: (res) => res(st.error ? { data: null, error: st.error } : { data: st.rows, error: null }),
    };
    return o;
  }

  const PROFILE = [{ id: cfg.uid, name: 'Sample Pilot', email: 'pilot@example.com',
                     company: 'Japan Airlines', position: 'fo', email_opt_in: false }];

  const RPC = {
    my_pay_reports: () => ({ ok: true, reports: cfg.reports, report_count: cfg.reports.length,
      streak_months: cfg.reports.length, access_until: cfg.accessUntil,
      badge: 'none', badge_state: 'none', mail_optin: false, pay_day_of_month: 5 }),
    my_referral_code: () => ({ ok: true, code: 'K7QD3XZM', invited: 0, converted: 0 }),
    claim_referral: () => ({ ok: true, status: 'none' }),
    pv_referral_settle: () => ({ ok: true }),
    my_cohort_gap: () => ({ ok: true, state: 'none' }),
    next_condition_questions: () => ({ ok: true, airline: 'jal', mine_count: 0, questions: [] }),
    my_airline_conditions: () => ({ ok: true, answers: [], answered_total: 0, questions_total: 32 }),
  };

  const CLIENT = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: cfg.uid, email: 'pilot@example.com' } } } }),
      getUser: async () => ({ data: { user: { id: cfg.uid, email: 'pilot@example.com' } } }),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: (t) => t === 'profiles' ? table(t, PROFILE)
               : t === 'reviews_v2' ? table(t, cfg.reviews)
               : t === 'pv_airlines' ? table(t, cfg.airlines)
               : table(t, []),
    rpc: (name) => {
      window.__rpc.push(name);
      if (name === 'my_pay_reports' && cfg.payError)
        return box({ data: null, error: { code: '42501', message: 'ログインが必要です' } });
      return box({ data: RPC[name] ? RPC[name]() : { ok: true }, error: null });
    },
  };
  Object.defineProperty(window, 'supabase',
    { value: { createClient: () => CLIENT }, writable: false, configurable: false });
};

// ════════════════════════════════════════════════════════════════
// 場面
// ════════════════════════════════════════════════════════════════
const AHEAD = new Date(Date.now() + 62 * 86400000).toISOString();
const base = { uid: UID, airlines: AIRLINES, reviews: [REV_JAL, REV_WJ, REV_OTHER],
               reports: REPORTS, accessUntil: AHEAD };
const SCENES = {
  both:      { ...base },
  none:      { ...base, reviews: [REV_OTHER], reports: [], accessUntil: null },
  failExtra: { ...base, failExtra: true },
  hardError: { ...base, hardError: true },
  payError:  { ...base, payError: true },
};

const browser = await puppeteer.launch(OPEN
  ? { headless: false, defaultViewport: null, args: ['--no-sandbox', '--window-size=1280,1100'] }
  : { headless: 'shell', args: ['--no-sandbox'] });

const jars = [];
/* ★1件ごとにまっさらな入れ物で開く。pv_unlock_expiry は localStorage に残るので、
   持ち越すと前の場面の解放が次の場面のバッジを点けてしまう（＝矛盾の検査が死ぬ）。 */
async function open(scene, lang) {
  const jar = await browser.createBrowserContext();
  jars.push(jar);
  const page = await jar.newPage();
  if (!OPEN) await page.setViewport({ width: 1280, height: 1100 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('pv-theme', 'dark');
    window['ga-disable-G-3XYF69VQ3X'] = true;      // 本番の GA4 に送らない
  });
  await page.evaluateOnNewDocument(FAKE, SCENES[scene]);
  await page.goto(BASE + (lang === 'en' ? '/en/' : '/') + 'profile.html',
                  { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2400);
  return { page, errs };
}

const look = (page) => page.evaluate(() => {
  const card = document.getElementById('my-reviews-card');
  const rev = document.getElementById('my-reviews-list');
  const pay = document.getElementById('my-pay-list');
  const badge = document.getElementById('unlock-status');
  const sal = document.getElementById('unlock-status-salary');
  const rows = (el) => el ? el.querySelectorAll(':scope > div').length : -1;
  return {
    cardText: card ? card.innerText : '',
    revText: rev ? rev.innerText : '', payText: pay ? pay.innerText : '',
    revRows: rows(rev), payRows: rows(pay),
    revBadge: !!(badge && badge.className.indexOf('unlock-active') >= 0),
    salBadge: !!(sal && sal.className.indexOf('unlock-active') >= 0),
    badgeText: badge ? badge.innerText : '',
    q: (window.__q || []).filter((x) => x.in.length).map((x) => ({ t: x.t, cols: x.cols, in: x.in })),
    airlineQ: (window.__q || []).filter((x) => x.t === 'pv_airlines' && x.in.length).length,
    rpc: window.__rpc || [],
  };
});

/* 2回目の呼び出しで通信が増えないか（pv-reunlock.js のキャッシュ）。
   ★ページ側の const sb は window に載っていないが、偽物の createClient() は
   毎回同じ箱を返すので、ここで取り直しても本物と同じ相手になる。 */
const probe = (page) => page.evaluate(async (uid) => {
  const sb = window.supabase.createClient();
  const count = () => (window.__q || []).filter((x) => x.t === 'reviews_v2' && x.in.length).length;
  const rpc0 = (window.__rpc || []).length, q0 = count();
  await window.pvMyPayReports(sb, uid);
  const extra = window.PVReviewI18n ? window.PVReviewI18n.EXTRA_COLS : '';
  const revs = await window.pvFindMyReviews(sb, uid, { extraCols: extra });
  return { rpcAdded: (window.__rpc || []).length - rpc0, qAdded: count() - q0,
           n: revs ? revs.length : -1 };
}, UID);

// ── 目で見る用 ────────────────────────────────────────────────
if (OPEN) {
  await open('both', OPEN_LANG);
  console.log(`開きました（口コミ2件・給与2件を持つ人 / ${OPEN_LANG}）。窓を閉じると終わります。`);
  /* ★時間で待たない。puppeteer の既定は30秒で、時間切れを握りつぶすと
     誰も触っていないのに窓が消える（shot-referral.mjs に経緯あり）。 */
  await new Promise((r) => browser.on('disconnected', r));
  process.exit(0);
}

// ════════════════════════════════════════════════════════════════
// 1. 出した人には、口コミも給与も両方出る
// ════════════════════════════════════════════════════════════════
const T = {
  ja: { noRev: 'まだ投稿していません', noPay: 'まだ出していません', failed: '読み込めませんでした',
        jal: '日本航空（JAL）', wj: 'ウェストジェット航空',
        body: '冬の運航は遅れが出やすい', period: '2026年8月分', old: '2026年6月分' },
  en: { noRev: 'You have not posted a review yet', noPay: 'You have not submitted a pay report yet',
        failed: 'Could not load', jal: 'Japan Airlines (JAL)', wj: 'WestJet Airlines',
        body: 'Winter operations run late often', period: 'Aug 2026', old: 'Jun 2026' },
};

for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / 出した人の画面 ════`);
  const { page, errs } = await open('both', lang);
  const v = await look(page);

  ok(v.revRows === 2, '★口コミが2件とも出る（分けて投げた結果を繋いでいる）', JSON.stringify(v.revText).slice(0, 160));
  ok(v.payRows === 2, '★給与レポートが2件とも出る', JSON.stringify(v.payText).slice(0, 160));
  ok(v.revText.indexOf(T[lang].wj) < v.revText.indexOf(T[lang].jal) && v.revText.includes(T[lang].jal),
     '新しい口コミが上に来る', JSON.stringify(v.revText).slice(0, 120));
  ok(v.revText.includes(T[lang].body), '本文が出る（ページの言語で）', JSON.stringify(v.revText).slice(0, 160));
  ok(v.payText.indexOf(T[lang].period) < v.payText.indexOf(T[lang].old),
     '新しい給与レポートが上に来る', JSON.stringify(v.payText).slice(0, 120));
  ok(v.payText.includes(T[lang].jal), '会社コードでなく社名で出る（pv_airlines から）', JSON.stringify(v.payText).slice(0, 120));

  /* ④ 他人の行が混ざらない。同じテーブルに置いてあるのに引けていないこと。 */
  ok(!/ヨソノヒトノクチコミ|SomebodyElsesReview|全日本空輸|All Nippon/.test(v.cardText),
     '★他人の proof_hash の行が1件も混ざらない', JSON.stringify(v.cardText).slice(0, 160));

  /* ⑥ 金額を1文字も出さない。 */
  ok(!/[¥$]|万円|19,?440,?000|130,?248|1,?050,?000|15,?000,?000/.test(v.cardText),
     '★金額が1文字も出ない', JSON.stringify(v.cardText).slice(0, 200));

  /* ⑤ 「解放中」と「投稿はありません」が同時に出ない。 */
  ok(v.revBadge && v.revRows > 0, '★口コミ解放中のバッジと一覧の中身が一致する', v.badgeText);
  ok(v.salBadge && v.payRows > 0, '年収データ解放中のバッジと給与一覧が一致する');

  /* ⑧ 問い合わせに乗るのはハッシュだけ。uid そのものは載らない。 */
  const rq = v.q.filter((x) => x.t === 'reviews_v2');
  ok(rq.length >= 2, '口コミは分けて投げている（URL 長の上限に触れない）', String(rq.length));
  const all = rq.flatMap((x) => x.in);
  ok(all.length > 100 && all.every((h) => /^[0-9a-f]{64}$/.test(h)),
     '★投げているのは64桁のハッシュだけ', String(all.length));
  ok(!JSON.stringify(v.q).includes(UID), '★本人の uid そのものは1度も乗らない');

  ok(v.airlineQ === 1, '社名は1回だけ引く（使うコードだけ）', String(v.airlineQ));

  /* ★解放の復活と一覧が同じ結果を使っていること＝もう一度呼んでも通信が増えないこと。
     ここが効かないと、マイページを開くたびに 119社ぶんの総当たりを二重に投げる。
     （ページ全体の回数では測れない。pv-conditions.js も自分の用で my_pay_reports を
       呼ぶので、数えると人のぶんまで数えてしまう。） */
  const again = await probe(page);
  ok(again.rpcAdded === 0, '★もう一度 pvMyPayReports を呼んでも問い合わせが増えない', JSON.stringify(again));
  ok(again.qAdded === 0, '★もう一度 pvFindMyReviews を呼んでも総当たりを投げ直さない', JSON.stringify(again));
  ok(again.n === 2, '2回目も同じ2件が返る', JSON.stringify(again));

  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// 2. 出していない人にだけ「まだ出していません」と言う
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / まだ出していない人 ════`);
  const { page, errs } = await open('none', lang);
  const v = await look(page);
  ok(v.revText.trim() === T[lang].noRev, '口コミは「まだ投稿していません」', JSON.stringify(v.revText));
  ok(v.payText.trim() === T[lang].noPay, '給与は「まだ出していません」', JSON.stringify(v.payText));
  ok(!v.revBadge && v.revRows <= 0, '★空の一覧のとき解放中バッジも出ていない', v.badgeText);
  ok(!v.salBadge, '年収データのバッジも出ていない');
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// 3. ★引けなかったときに「0件」と言わない
// ════════════════════════════════════════════════════════════════
/* これが今回の報告の作り方そのもの。出しているのに「投稿はありません」と
   言い切られると、データが消えたようにしか見えない。 */
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / 引けなかったとき ════`);
  {
    const { page } = await open('hardError', lang);
    const v = await look(page);
    ok(!v.revText.includes(T[lang].noRev), '★口コミを引けないとき「まだ投稿していません」と言わない', JSON.stringify(v.revText));
    ok(v.revText.includes(T[lang].failed), '引けなかったと分かる言い方をする', JSON.stringify(v.revText));
    ok(!v.revBadge, '引けなかったのに解放中にはしない', v.badgeText);
    ok(v.payRows === 2, '口コミが引けなくても給与の一覧は出る（片方で止まらない）', String(v.payRows));
  }
  {
    const { page } = await open('payError', lang);
    const v = await look(page);
    ok(!v.payText.includes(T[lang].noPay), '★給与を引けないとき「まだ出していません」と言わない', JSON.stringify(v.payText));
    ok(v.payText.includes(T[lang].failed), '引けなかったと分かる言い方をする', JSON.stringify(v.payText));
    ok(v.revRows === 2, '給与が引けなくても口コミの一覧は出る', String(v.revRows));
  }
}

// ════════════════════════════════════════════════════════════════
// 4. orig_lang / translations がまだ無い環境でも口コミが消えない
// ════════════════════════════════════════════════════════════════
for (const lang of ['ja', 'en']) {
  console.log(`\n════ ${lang} / 訳文の列がまだ無い環境 ════`);
  const { page, errs } = await open('failExtra', lang);
  const v = await look(page);
  ok(v.revRows === 2, '★42703（列が無い）でも口コミが消えない', JSON.stringify(v.revText).slice(0, 160));
  const cols = v.q.filter((x) => x.t === 'reviews_v2').map((x) => x.cols);
  ok(cols.some((c) => c.includes('orig_lang')) && cols.some((c) => !c.includes('orig_lang')),
     '訳文の列つきで1回試してから、外して引き直している', JSON.stringify(cols.length));
  ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
}

for (const jar of jars) { try { await jar.close(); } catch (e) {} }
await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
