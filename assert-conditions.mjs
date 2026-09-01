/* assert-conditions.mjs — 待遇のモーダルが「約束どおりに閉じられる」ことを機械で確かめる。

   絵（shot-conditions.mjs）では分からないところだけを見る:
     ・通常ログインでは出ない（給与を出した直後にしか出さない）
     ・× ・背景・ESC のどれでも閉じる。閉じても下のページは残る
     ・1問ごとにその場で保存される。1問目で閉じても、答えた分は残る
     ・× で閉じたときは「見せていた1問」だけスキップとして残す（残りは記録しない）
     ・「今回はスキップ」はその1問だけ飛ばす＝閉じない
     ・初回は3問・2回目以降は1問。その次の問は出ない
     ・モーダルに数値入力・プルダウンを出さない
     ・role=dialog / aria-modal / 開いた瞬間のフォーカス / 背後のスクロール停止と復帰

   本番にはまだテーブルが無いので、shot-conditions.mjs と同じやり方で
   Supabase クライアントごと差し替える。描くのは本物の pv-conditions.js。

   そのあと待遇の詳細ページ（airline-conditions.html）も日英で実際に開く:
     ・読み込み中の骨組みが消える（真っ白のまま止まらない）
     ・節と質問がバンク（pv-conditions.json）の数だけそろう
     ・「あなたが答えた項目：0／◯」だけを出す（進捗バーで急かさない）
     ・最後に口コミへの導線がある／会社が決まっていない人には会社を選ばせる
   ⚠️ 偽物 Supabase の rpc は本物と同じ「then だけを持つ箱」にしてある。async に
      戻すと本番に無い .catch が生えて、2026-08-19 の真っ白事故をまた見逃す。

   実行: node assert-conditions.mjs            日英 × 初回/2回目 の4通り
         node assert-conditions.mjs ja 0       1通りだけ（lang, 既に答えている数）
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない。
*/
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';

const only = process.argv[2];
const CASES = only
  ? [{ lang: only, mine: Number(process.argv[3] || 0) }]
  : [{ lang: 'ja', mine: 0 }, { lang: 'en', mine: 0 },
     { lang: 'ja', mine: 7 }, { lang: 'en', mine: 7 }];

/* 期待値は生成物から取る。固定値を書くと、質問を1つ足すたびにここが嘘になる */
const BANK = JSON.parse(readFileSync(new URL('./pv-conditions.json', import.meta.url), 'utf8'));
const N_SEC = BANK.sections.length;
const N_Q = BANK.questions.length;
const N_ROOT = BANK.questions.filter((q) => !q.parent).length;

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e)); };

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

for (const kase of CASES) {
  const { lang, mine } = kase;
  /* 出す問数 ＝ mine_count < 3 ? 3 - mine_count : 1（画面が決める） */
  const want = mine >= 3 ? 1 : 3 - mine;
  const url = 'http://localhost:3000/' + (lang === 'en' ? 'en/' : '') + 'profile.html';
  console.log(`\n════ ${lang} / 既に答えている数 ${mine} → ${want}問出るはず ════`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1100 });

  await page.evaluateOnNewDocument((mineCount, nQ) => {
    localStorage.setItem('pv-theme', 'dark');
    window.__rpc = [];
    const UID = '00000000-0000-4000-8000-00000000a001';
    /* ★テスト用の架空プロフィール。ZIPAIR は A380 を運航しておらず、ITM は国内線専用で A380 が入れない。
       この組み合わせに当てはまる実在のパイロットは居ない。実在しそうな組み合わせに「直さない」こと。 */
    const REPORT = { airline: 'zipair', airline_other: null, position: 'cap', fleet: 'a380',
      base_iata: 'ITM', period_year: 2026, period_month: 8, period_ym: 2026 * 12 + 8,
      contract_type: 'direct', currency: 'JPY', fx_to_jpy: 1, fx_to_usd: 0.0067,
      annual_total_orig: 27000000, annual_total_jpy: 27000000, annual_total_usd: 180900,
      source: 'payslip', created_at: '2026-08-05T00:00:00Z' };
    const Q = (id, mineCode) => ({ id: id, mine_code: mineCode || null });
    /* 2回目以降は1問。再確認の場合は前回の答え（mine_code）が付いて返る */
    const QS = mineCount >= 3
      ? { questions: [Q('days_off_request', 'yes')], mine_count: mineCount }
      : { questions: [Q('days_off_request'), Q('schedule_bidding'), Q('external_hiring')],
          mine_count: mineCount };
    const RPC = {
      my_airline_conditions: () => ({ ok: true, answers: [], answered_total: 0, questions_total: nQ }),
      my_pay_reports: () => ({ ok: true, reports: [REPORT], report_count: 1, streak_months: 1,
        access_until: new Date(Date.now() + 62 * 86400000).toISOString(),
        badge: 'silver', badge_state: 'active', mail_optin: false, pay_day_of_month: 5 }),
      next_condition_questions: () => Object.assign({ ok: true, airline: 'zipair' }, QS),
      submit_airline_conditions: () => ({ ok: true, airline: 'zipair', saved: 1, skipped: 0, rejected: [] })
    };
    function q(rows) {
      const o = { data: rows, error: null,
        select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
        update: () => o, insert: () => o,
        single: async () => ({ data: Array.isArray(rows) ? rows[0] : rows, error: null }),
        maybeSingle: async () => ({ data: Array.isArray(rows) ? (rows[0] || null) : rows, error: null }),
        then: (res) => res({ data: Array.isArray(rows) ? rows : [rows].filter(Boolean), error: null }) };
      return o;
    }
    const FAKE = {
      auth: { getSession: async () => ({ data: { session: { user: { id: UID, email: 'pilot@example.com' } } } }),
              getUser: async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
              signOut: async () => ({ error: null }) },
      from: (t) => t === 'profiles' ? q([{ id: UID, name: 'Sample Pilot', email: 'pilot@example.com',
        gender: 'male', birthdate: '1988-04-12', country: '日本', company: 'ZIPAIR', position: 'captain',
        created_at: '2026-01-11T00:00:00Z', email_opt_in: true }]) : q([]),
      /* ★本物の supabase-js が返すのは「then だけを持つ箱」で、catch も finally も無い。
         async にすると本物の Promise になり .catch が生えて本番より優しくなる。
         2026-08-19、それで詳細ページが本番だけ真っ白になるのを見逃した。
         偽物は本物と同じ形（then だけ）に保つこと。 */
      rpc: (name, args) => { window.__rpc.push({ name: name, args: args });
        const res = { data: RPC[name] ? RPC[name]() : { ok: true }, error: null };
        return { then: (ok, ng) => Promise.resolve(res).then(ok, ng) }; }
    };
    /* 後から読まれる CDN の supabase-js が上書きしてくるので跳ね返す */
    Object.defineProperty(window, 'supabase',
      { value: { createClient: () => FAKE }, writable: false, configurable: false });
  }, mine, N_Q);

  /* ★本番と同じ入口。pay-report.html の renderResult 末尾が渡すのと同じ形。 */
  const openModal = async () => {
    await page.evaluate(() => {
      window.__rpc = [];
      const sb = window.supabase.createClient();
      const en = document.documentElement.getAttribute('lang') === 'en';
      const hit = (window.PV_AIRLINES || []).filter((a) => window.PV_slugOf(a) === 'zipair')[0];
      window.PVConditions.afterReport({ sb: sb, airline: 'zipair', airline_other: null,
        airlineName: hit ? (en ? hit.en : hit.name) : '',
        year: 2026, month: 8, position: 'cap', fleet: 'a380',
        base_iata: 'ITM', contract_type: 'direct' });
    });
    await new Promise((r) => setTimeout(r, 1400));   // modal_delay_ms(700) ＋ 描画
  };
  const state = () => page.evaluate(() => {
    const m = document.querySelector('[data-pvc]');
    const dlg = m && m.querySelector('.pvc-modal');
    return {
      open: !!m,
      role: dlg ? dlg.getAttribute('role') : null,
      aria: dlg ? dlg.getAttribute('aria-modal') : null,
      step: m ? ((m.querySelector('.pvc-step') || {}).textContent || '') : '',
      fields: m ? m.querySelectorAll('input,select,textarea').length : -1,
      bodyOverflow: document.body.style.overflow,
      pageAlive: !!document.querySelector('main'),
      saves: window.__rpc.filter((r) => r.name === 'submit_airline_conditions').length,
      focusInside: !!(m && m.contains(document.activeElement))
    };
  });
  const clickOpt = async () => {
    await page.evaluate(() => { const b = document.querySelector('[data-pvc] .pvc-opt'); if (b) b.click(); });
    await new Promise((r) => setTimeout(r, 700));
  };

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2200));

  let s = await state();
  ok(!s.open, '通常ログインではモーダルが開かない');
  ok(await page.evaluate(() => !!document.querySelector('[data-pvc-cta]')),
     'マイページには「押したときだけ開く」二次カードだけがある');

  await openModal();
  s = await state();
  ok(s.open, '給与レポートの直後に開く');
  ok((await page.evaluate(() => document.querySelectorAll('[data-pvc]').length)) === 1,
     'モーダルは1つだけ（二重に開かない）');
  ok(s.role === 'dialog' && s.aria === 'true', 'role=dialog と aria-modal がある', s.role + '/' + s.aria);
  ok(s.focusInside, '開いた瞬間のフォーカスがモーダルの中にある');
  ok(s.fields === 0, 'モーダルに入力欄・プルダウンが1つも無い（押すだけで終わる）', String(s.fields));
  ok(s.bodyOverflow === 'hidden', '開いている間だけ背後のスクロールが止まる');
  ok(want === 1 ? s.step === '' : /1\s*\/\s*3/.test(s.step),
     want === 1 ? '2回目以降は1問だけ（何問中かを出さない）' : '初回は3問（1 / 3 と出る）',
     JSON.stringify(s.step));

  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 400));
  s = await state();
  ok(!s.open, 'ESC で閉じる');
  ok(s.bodyOverflow !== 'hidden', '閉じたら背後のスクロールが戻る');
  ok(s.pageAlive, '閉じても下のページは残る');

  await openModal();
  /* 背景は「押した場所と離した場所が両方とも背景」のときだけ閉じる
     （文字をなぞって外で離しただけでは閉じない）。 */
  await page.evaluate(() => {
    const ov = document.querySelector('[data-pvc]');
    ov.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 400));
  ok(!(await state()).open, '背景のクリックで閉じる');

  await openModal();
  await clickOpt();
  ok((await state()).saves === 1, '1問ごとにその場で保存される');
  await page.evaluate(() => { const x = document.querySelector('[data-pvc] .pvc-x'); if (x) x.click(); });
  await new Promise((r) => setTimeout(r, 400));
  s = await state();
  ok(!s.open, '× で閉じる');
  ok(s.saves === (want > 1 ? 2 : 1), '1問目で閉じても、答えた分は保存済み', String(s.saves));
  const last = await page.evaluate(() => {
    const c = window.__rpc.filter((r) => r.name === 'submit_airline_conditions');
    return JSON.stringify(c[c.length - 1] && c[c.length - 1].args);
  });
  ok(want > 1 ? /"skip":\s*true/.test(last) : !/"skip":\s*true/.test(last),
     want > 1 ? '× で閉じると、見せていた1問だけスキップとして残る'
              : '答え終わってから閉じたときは、スキップを残さない', last);
  ok((last.match(/question_id/g) || []).length === 1, '見せていない残りの質問は勝手に記録しない', last);

  await openModal();
  await page.evaluate(() => { const k = document.querySelector('[data-pvc] .pvc-skip'); if (k) k.click(); });
  await new Promise((r) => setTimeout(r, 700));
  s = await state();
  ok(s.open, '「今回はスキップ」ではモーダルを閉じない');
  ok(want === 1 ? !s.step : /2\s*\/\s*3/.test(s.step),
     want === 1 ? 'スキップしても1問のまま（次が無い）' : 'スキップで次の問へ進む（2 / 3）',
     JSON.stringify(s.step));
  ok(s.saves >= 1, 'スキップもサーバに預ける（いつ飛ばしたかを覚える）');

  await openModal();
  for (let k = 0; k < want - 1; k++) await clickOpt();
  /* ★最後の1問だけ待ち方を変える（2026-09-01）。答え終わるとお礼が出て、
       2600ms でモーダルが自分から閉じる（pv-conditions.js の doneTimer）。
       固定の sleep で読むと、混んだ回に「もう閉じていた」を掴んで嘘の赤が出る
       （実際に 2026-09-01 の 46本走行で {"open":false,"opts":-1} が出た）。
     ★お礼が出た瞬間に読む。sleep ではなく条件で待つ。 */
  await page.evaluate(() => { const b = document.querySelector('[data-pvc] .pvc-opt'); if (b) b.click(); });
  const done = await page.waitForFunction(() => {
    const m = document.querySelector('[data-pvc]');
    if (!m || m.querySelectorAll('.pvc-opt').length) return null;
    return { open: true, opts: 0, more: !!m.querySelector('.pvc-more') };
  }, { timeout: 8000, polling: 50 })
    .then((h) => h.jsonValue())
    .catch(async () => await page.evaluate(() => {
      const m = document.querySelector('[data-pvc]');
      return { open: !!m, opts: m ? m.querySelectorAll('.pvc-opt').length : -1,
               more: !!(m && m.querySelector('.pvc-more')) };
    }));
  ok(done.open && done.opts === 0, `${want}問答えたら質問は出ず、お礼だけになる`, JSON.stringify(done));
  ok(done.more, '最後に「もっと詳しく答える →」が1つだけ出る');

  await page.close();
}

/* ── 詳細ページ（airline-conditions.html）を実際に開く ───────────────
   ★ここを1度も開いていなかったせいで、2026-08-19 に本番だけ真っ白になった。
     sb.rpc(...) に .catch を直付けしていて（本物の箱は then しか持たない）、
     投げられた TypeError を外側の catch が黙って飲んでいた。
     上の偽物 Supabase を本物と同じ形（then だけ）に保つこと。甘くすると同じ穴がまた開く。 */
for (const lang of (only ? [only] : ['ja', 'en'])) {
  for (const hasReport of [true, false]) {
    console.log(`\n════ ${lang} / 詳細ページ（給与レポート ${hasReport ? 'あり' : 'なし'}）════`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1400 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));

    await page.evaluateOnNewDocument((hasReport, nQ) => {
      localStorage.setItem('pv-theme', 'dark');
      window.__rpc = [];
      const UID = '00000000-0000-4000-8000-00000000a001';
      /* ★テスト用の架空プロフィール。ZIPAIR は A380 を運航しておらず、ITM は国内線専用で A380 が入れない。
       この組み合わせに当てはまる実在のパイロットは居ない。実在しそうな組み合わせに「直さない」こと。 */
    const REPORT = { airline: 'zipair', airline_other: null, position: 'cap', fleet: 'a380',
        base_iata: 'ITM', contract_type: 'direct', period_year: 2026, period_month: 8,
        period_ym: 2026 * 12 + 8, source: 'payslip', created_at: '2026-08-05T00:00:00Z' };
      const RPC = {
        my_pay_reports: () => ({ ok: true, reports: hasReport ? [REPORT] : [],
          report_count: hasReport ? 1 : 0 }),
        my_airline_conditions: () => ({ ok: true, airline: 'zipair', answers: [],
          answered_total: 0, questions_total: nQ }),
        submit_airline_conditions: () => ({ ok: true, airline: 'zipair', saved: 1, skipped: 0, rejected: [] })
      };
      function q(rows) {
        const o = { data: rows, error: null,
          select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
          single: async () => ({ data: rows[0] || null, error: null }),
          maybeSingle: async () => ({ data: rows[0] || null, error: null }),
          then: (res) => res({ data: rows, error: null }) };
        return o;
      }
      const FAKE = {
        auth: { getSession: async () => ({ data: { session: { user: { id: UID, email: 'pilot@example.com' } } } }),
                getUser: async () => ({ data: { user: { id: UID, email: 'pilot@example.com' } } }),
                signOut: async () => ({ error: null }) },
        from: () => q([]),
        /* ★本物と同じ「then だけを持つ箱」。async にしない（上の注記のとおり） */
        rpc: (name, args) => { window.__rpc.push({ name: name, args: args });
          const res = { data: RPC[name] ? RPC[name]() : { ok: true }, error: null };
          return { then: (ok, ng) => Promise.resolve(res).then(ok, ng) }; }
      };
      Object.defineProperty(window, 'supabase',
        { value: { createClient: () => FAKE }, writable: false, configurable: false });
    }, hasReport, N_Q);

    const url = 'http://localhost:3000/' + (lang === 'en' ? 'en/' : '') +
      'airline-conditions.html' + (hasReport ? '?airline=ana' : '');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1800));

    const v = await page.evaluate(() => ({
      path: location.pathname,
      skel: document.querySelectorAll('.mr-skel').length,
      dead: !!document.querySelector('[data-pvcf-dead]'),
      secs: document.querySelectorAll('.pvcf-sec').length,
      rows: document.querySelectorAll('[data-qid]').length,
      shown: document.querySelectorAll('[data-qid]:not([hidden])').length,
      count: (document.getElementById('pvcf-count') || {}).textContent || '',
      voices: !!document.querySelector('[data-pvcf-voices]'),
      bars: document.querySelectorAll('progress,.pvcf-bar,.pvc-bar').length,
      picker: !!document.getElementById('pvcf-air')
    }));

    ok(!/login\.html/.test(v.path), 'ログイン済みなら追い返されない', v.path);
    ok(v.skel === 0, '読み込み中の骨組みが消える（真っ白のまま止まらない）', JSON.stringify(v));
    ok(!v.dead, '「読み込めませんでした」ではなく中身が出る');
    if (hasReport) {
      ok(v.secs === N_SEC, `節が ${N_SEC} つ出る`, String(v.secs));
      ok(v.rows === N_Q, `質問が ${N_Q} 問そろう`, String(v.rows));
      ok(v.shown === N_ROOT, `親に答えていない子は出さない（見えるのは ${N_ROOT} 問）`, String(v.shown));
      ok(v.count.indexOf('0') >= 0 && v.count.indexOf(String(N_Q)) >= 0,
         `「答えた項目：0／${N_Q}」が出る`, v.count);
      ok(v.bars === 0, '「◯%完成」の進捗バーは出さない（急かさない約束）');
      ok(v.voices, '最後に口コミへの導線カードが出る');
      ok(!v.picker, '会社が決まっている人に会社選びを出さない');
    } else {
      ok(v.picker, '会社が決まっていない人には会社を選ぶ画面が出る');
      ok(v.secs === 0 && v.rows === 0, '会社が決まるまで質問は出さない', JSON.stringify(v));
    }
    ok(errs.length === 0, 'ページのエラーが1件も出ない', errs.join(' | '));
    await page.close();
  }
}

await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
