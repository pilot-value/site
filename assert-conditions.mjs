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

   最後に、質問へ直接来る入口（airline-conditions.html?airline=…&q=<鍵>）を日英で歩く（2026-10-04）:
     ・目当ての行に印が1つだけ付き、閉じて出る節が開き、画面に入る
     ・親に答えていない子は、親の行へ運ぶ。親が2段なら、いちばん上から1段ずつ下りる
     ・いちばん上を条件の外へ答え直すと、子も孫も隠れ、「答えた項目」からも外れる
     ・知らない鍵は q なしと1文字も違わない／未ログインの戻り先に airline と q が残る
   見る点の一覧は、その節の頭の注記。

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
/* ★一覧に出るのは topicOnly でない質問だけ（話題の入口から来た人にだけ出す質問は数えない）。
   下の「鍵をバンクから選ぶ」所も、一覧に出る質問（LISTED）から選ぶ。 */
const LISTED = BANK.questions.filter((q) => !q.topicOnly);
const TOPIC_ONLY = BANK.questions.filter((q) => q.topicOnly);
const N_Q = LISTED.length;
const N_ROOT = LISTED.filter((q) => !q.parent).length;

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
  /* ★もう一段固くする（2026-09-06）── 50ms ごとに覗く形でもまだ取りこぼした。
       46本を並列で走らせた回に、押してから最初に覗けるまで 2.6秒 以上止まることがあり、
       そのときには**もうモーダルごと消えている**（{"open":false,"opts":-1} が出た）。
       覗きに行く形は「隙間がある」限りいつか必ず負ける。
     → 押す**前に**見張りを仕掛け、DOM が変わったその場で控えを取る。
       ⚠️ 見張りは「これから起きる変化」しか見ない。押した直後にもう終わっていた場合は
          1度も呼ばれないので、押した直後に**手で1回**見る（これが無いと必ず落ちる）。
       ⚠️ お礼と「もっと詳しく」が別々の変化で入ることがあるので、
          もっと詳しくは**一度でも見えたら true のまま**にする。 */
  await page.evaluate(() => {
    window.__pvcDone = null;
    window.__pvcGrab = () => {
      const m = document.querySelector('[data-pvc]');
      if (!m || m.querySelectorAll('.pvc-opt').length) return;
      if (!window.__pvcDone) window.__pvcDone = { open: true, opts: 0, more: false };
      if (m.querySelector('.pvc-more')) window.__pvcDone.more = true;
    };
    window.__pvcObs = new MutationObserver(window.__pvcGrab);
    window.__pvcObs.observe(document.body, { childList: true, subtree: true });
  });
  await page.evaluate(() => { const b = document.querySelector('[data-pvc] .pvc-opt'); if (b) b.click(); });
  await page.evaluate(() => { window.__pvcGrab(); });
  const done = await page.waitForFunction(
    () => (window.__pvcDone && window.__pvcDone.more ? window.__pvcDone : null),
    { timeout: 8000, polling: 50 })
    .then((h) => h.jsonValue())
    .catch(async () => await page.evaluate(() => {
      if (window.__pvcDone) return window.__pvcDone;
      const m = document.querySelector('[data-pvc]');
      return { open: !!m, opts: m ? m.querySelectorAll('.pvc-opt').length : -1,
               more: !!(m && m.querySelector('.pvc-more')) };
    }));
  await page.evaluate(() => { if (window.__pvcObs) window.__pvcObs.disconnect(); });
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

/* ── 質問へ直接来る入口（?airline=<コード>&q=<鍵>）──────────────────────
   会社の概要などで「まだ分からない」と出した項目から、答える場所へ1回で運ぶ入口（2026-10-04）。
   ★ここが壊れても画面は普通に開く（先頭の節が出るだけ）ので、ここでしか気づけない。
   見ること:
     ・目当ての行に印（.is-target）が1つだけ付き、閉じて出る節が開き、画面に入る
     ・子の質問は、親に答えるまで画面に無い → 親の行へ運び、答えたら子へ移る
     ・★親が2段（staff_travel → staff_travel_booking → 券の種類ごとの質問）のとき、
       いちばん上の答えていない親へ運び、答えるたびに1段ずつ下りる。
       あいだの親の答えが条件から外れたら、その親に印を残して止まる
     ・★いちばん上を条件の外へ答え直すと、子も孫も隠れ、「答えた項目」からも外れる。
       古い答えは消さない（元に戻すと、前の答えのまま戻る）。
       サーバ側の同じ決まりは db/airline-conditions.sql の 4b（pv_condition_links）
     ・★あいだの親が「複数選ぶ」質問のとき（commuting_transport → commuting_transport_method
       → 手段ごとの質問）。選んだ手段の質問だけが出て、目当ての手段を選ぶまで印は手段の質問に残る。
       両方を選んだ人には両方の質問が出て、答えはそれぞれの鍵で別々に送られる（下の H）
     ・知らない鍵・無くなった鍵・悪い鍵は q なしと1文字も違わない
     ・会社が決まっていない人は、会社を選んだあとでその質問へ
     ・未ログインの戻り先に airline と q が残る
   ⚠️ 待つのは全部「条件」。時間で待たない（印が移るときは滑らかに動くので、
      途中の位置を読むと混んだ回に嘘の赤が出る）。
   ⚠️ 鍵と選択肢はバンクから選ぶ。質問を足しても引いても、ここを書き直さずに済むように。
      ただし「親が2段の質問」が1つも無くなったら落とす（2段の検査が黙って空振りになるため）。 */
const BY = Object.fromEntries(BANK.questions.map((q) => [q.id, q]));
const has = (id) => Object.prototype.hasOwnProperty.call(BY, id);
/* 親の答えのうち、子を出す答え／出さない答え（「わからない」は使わない） */
const inCode = (child) => child.parentWhen[0];
const outCode = (parent, child) => ((parent.choices || [])
  .find((c) => c.code !== 'unknown' && !child.parentWhen.includes(c.code)) || {}).code;
const firstCode = (q) => ((q.choices || []).find((c) => c.code !== 'unknown') || {}).code;
/* その質問の下にぶら下がる全部（子・孫） */
const under = (top) => LISTED.filter((q) => {
  for (let p = q.parent; p; p = BY[p] && BY[p].parent) if (p === top.id) return true;
  return false;
}).map((q) => q.id);

const Q_ROOT = LISTED.find((q) => !q.parent && q.section !== BANK.sections[0].code);
const Q_ONE  = LISTED.filter((q) => q.parent && !BY[q.parent].parent && BY[q.parent].kind === 'choice').pop();
const Q_DEEP = LISTED.find((q) => q.parent && BY[q.parent].parent
  && q.kind === 'choice' && BY[q.parent].kind === 'choice' && BY[BY[q.parent].parent].kind === 'choice');
/* あいだの親が「複数選ぶ」質問で、親が2段の質問（H で使う）。
   Q_MULTI ＝ 目当て。Q_OTHER ＝ 同じ親の下で、別の選択肢のときにだけ開く質問。 */
const MULTI_KIDS = LISTED.filter((q) => q.parent && q.kind === 'choice'
  && BY[q.parent].kind === 'multi' && BY[q.parent].parent && BY[BY[q.parent].parent].kind === 'choice');
const Q_MULTI = MULTI_KIDS.filter((q) => q.parentWhen.join() === MULTI_KIDS[0].parentWhen.join()).pop();
const Q_OTHER = Q_MULTI && MULTI_KIDS.find((q) => q.parent === Q_MULTI.parent
  && !q.parentWhen.some((c) => Q_MULTI.parentWhen.includes(c)));

console.log('\n════ 質問へ直接来る入口（?q=）の下ごしらえ ════');
ok(!!Q_ROOT, '閉じて出る節に、親を持たない質問が在る', '');
ok(!!Q_ONE, '親が1段の質問が在る', '');
ok(!!Q_DEEP, '親が2段の質問が在る（無くなったら、下の2段の検査が黙って空振りになる）', '');
ok(!!Q_MULTI && !!Q_OTHER,
   'あいだの親が「複数選ぶ」質問で、選んだものごとに別の質問が開く組が在る（無くなったら、下の H が黙って空振りになる）', '');

if (Q_ROOT && Q_ONE && Q_DEEP) {
  const MID = BY[Q_DEEP.parent];          // あいだの親
  const TOP = BY[MID.parent];             // いちばん上の親
  const TOP_IN = inCode(MID), TOP_OUT = outCode(TOP, MID);
  const MID_IN = inCode(Q_DEEP), MID_OUT = outCode(MID, Q_DEEP);
  const DEEP_ANS = firstCode(Q_DEEP);
  /* あいだの親を MID_IN と答えたときに、出る孫・出ない孫 */
  const SIB_IN  = LISTED.filter((q) => q.parent === MID.id && q.parentWhen.includes(MID_IN)).map((q) => q.id);
  const SIB_OUT = LISTED.filter((q) => q.parent === MID.id && !q.parentWhen.includes(MID_IN)).map((q) => q.id);
  const UNDER_TOP = under(TOP);
  const SEC_LEN = LISTED.filter((q) => q.section === TOP.section).length;
  ok(!!TOP_OUT && !!MID_OUT && !!DEEP_ANS, '条件の内と外の答えをバンクから選べる',
     JSON.stringify({ TOP_IN, TOP_OUT, MID_IN, MID_OUT, DEEP_ANS }));
  ok([Q_DEEP.id, MID.id].every((id) => BY[id].section === TOP.section), '3段とも同じ節に在る（節の数を1つで見るため）');
  console.log(`  （目当て: ${TOP.id} → ${MID.id} → ${Q_DEEP.id} ／ 1段: ${Q_ONE.parent} → ${Q_ONE.id} ／ 親なし: ${Q_ROOT.id}）`);

  const A = (id, code) => ({ question_id: id, code: code, codes: null, num: null, currency: null, text: null });

  /* 詳細ページを開く。偽物 Supabase の rpc は上と同じ「then だけを持つ箱」。 */
  const openFull = async ({ lang, query, answers = [], hasReport = true, login = true,
                            vp = { width: 1280, height: 900 } }) => {
    const page = await browser.newPage();
    await page.setViewport(vp);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
    await page.evaluateOnNewDocument((hasReport, answers, login, nQ, lang) => {
      try { localStorage.setItem('pv-theme', 'dark'); } catch (e) {}
      /* ★言語の記憶を、いま見ている言語に固定する。この検査は1つのブラウザで日英を順に開くので、
         英語の画面が残した記憶（lang-toggle.js の STICKY_EN）が次の日本語の画面を英語へ移す。
         固定しないと「ja」と名乗る回が英語の画面を見ていても、どこも赤くならない。 */
      try { localStorage.setItem('pv-lang', lang); } catch (e) {}
      window.__rpc = [];
      const UID = '00000000-0000-4000-8000-00000000a001';
      /* ★テスト用の架空プロフィール（上と同じ。実在しそうな組み合わせに「直さない」こと） */
      const REPORT = { airline: 'zipair', airline_other: null, position: 'cap', fleet: 'a380',
        base_iata: 'ITM', contract_type: 'direct', period_year: 2026, period_month: 8,
        period_ym: 2026 * 12 + 8, source: 'payslip', created_at: '2026-08-05T00:00:00Z' };
      const RPC = {
        my_pay_reports: () => ({ ok: true, reports: hasReport ? [REPORT] : [],
          report_count: hasReport ? 1 : 0 }),
        my_airline_conditions: () => ({ ok: true, answers: answers,
          answered_total: answers.length, questions_total: nQ }),
        submit_airline_conditions: () => ({ ok: true, saved: 1, skipped: 0, rejected: [] })
      };
      function q(rows) {
        const o = { data: rows, error: null,
          select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
          single: async () => ({ data: rows[0] || null, error: null }),
          maybeSingle: async () => ({ data: rows[0] || null, error: null }),
          then: (res) => res({ data: rows, error: null }) };
        return o;
      }
      const sess = login ? { user: { id: UID, email: 'pilot@example.com' } } : null;
      const FAKE = {
        auth: { getSession: async () => ({ data: { session: sess } }),
                getUser: async () => ({ data: { user: sess ? sess.user : null } }),
                signOut: async () => ({ error: null }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
        from: () => q([]),
        /* ★本物と同じ「then だけを持つ箱」。async にしない（冒頭の注記のとおり） */
        rpc: (name, args) => { window.__rpc.push({ name: name, args: args });
          const res = { data: RPC[name] ? RPC[name]() : { ok: true }, error: null };
          return { then: (ok, ng) => Promise.resolve(res).then(ok, ng) }; }
      };
      Object.defineProperty(window, 'supabase',
        { value: { createClient: () => FAKE }, writable: false, configurable: false });
    }, hasReport, answers, login, N_Q, lang);
    const base = 'http://localhost:3000/' + (lang === 'en' ? 'en/' : '') + 'airline-conditions.html';
    const go = (query) => page.goto(base + query, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await go(query);
    return { page, errs, go };
  };

  /* 描き終わるまで待つ（質問の行が出るか、会社選びが出るか）。
     行を置くのと印を付けるのは同じ1回の処理なので、行が在れば印も付き終わっている。 */
  const ready = (page) => page.waitForFunction(
    () => document.querySelectorAll('[data-qid]').length > 0 || !!document.getElementById('pvcf-air'),
    { timeout: 15000 }).then(() => true, () => false);

  const look = (page) => page.evaluate(() => {
    const t = document.querySelectorAll('.pvcf-q.is-target');
    const row = t[0] || null;
    const r = row ? row.getBoundingClientRect() : null;
    const sec = row ? row.closest('details') : null;
    const picked = {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-qid]'), (x) => {
      const b = x.querySelector('.pvc-opt.is-picked');
      if (b) picked[x.getAttribute('data-qid')] = b.getAttribute('data-code');
    });
    return {
      n: t.length,
      path: location.pathname,
      qid: row ? row.getAttribute('data-qid') : '',
      hidden: row ? row.hidden : null,
      open: sec ? sec.open : null,
      inView: r ? (r.top >= 0 && r.bottom <= window.innerHeight) : false,
      focus: row ? document.activeElement === row : null,
      y: Math.round(window.scrollY),
      opens: Array.prototype.map.call(document.querySelectorAll('.pvcf-sec'), (s) => (s.open ? 1 : 0)).join(''),
      shown: Array.prototype.filter.call(document.querySelectorAll('[data-qid]'), (x) => !x.hidden)
        .map((x) => x.getAttribute('data-qid')),
      picked: picked,
      /* 「答えた項目：n／全問」の数字だけ（日英で文が違うので、数字で比べる） */
      count: (((document.getElementById('pvcf-count') || {}).textContent || '').match(/\d+/g) || []).join('/'),
      badges: Array.prototype.map.call(document.querySelectorAll('.pvcf-badge'),
        (b) => b.getAttribute('data-sec') + '=' + b.textContent.replace(/\s+/g, '')).join(' ')
    };
  });

  const press = (page, qid, code) => page.evaluate((qid, code) => {
    const b = document.querySelector('[data-qid="' + qid + '"] .pvc-opt[data-code="' + code + '"]');
    if (b) b.click();
    return !!b;
  }, qid, code);
  /* 印がその行に1つだけ付き、その行が画面に入り終わるまで待つ */
  const markOn = (page, qid) => page.waitForFunction((qid) => {
    const t = document.querySelectorAll('.pvcf-q.is-target');
    if (t.length !== 1 || t[0].getAttribute('data-qid') !== qid || t[0].hidden) return false;
    const r = t[0].getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  }, { timeout: 8000 }, qid).then(() => true, () => false);
  /* その行の保存が終わるまで待つ（押した答えが選ばれた形になり、「保存しました」が出る）。
     描き直し・文言・数え直し・印の付け直しは同じ1回の処理なので、これが見えれば全部終わっている。 */
  const settled = (page, qid, code) => page.waitForFunction((qid, code) => {
    const row = document.querySelector('[data-qid="' + qid + '"]');
    const b = row && row.querySelector('.pvc-opt[data-code="' + code + '"]');
    const s = row && row.querySelector('.pvcf-state');
    return !!(b && b.classList.contains('is-picked') && s && s.textContent);
  }, { timeout: 8000 }, qid, code).then(() => true, () => false);
  const noMark = (page) => page.waitForFunction(
    () => document.querySelectorAll('.pvcf-q.is-target').length === 0, { timeout: 8000 })
    .then(() => true, () => false);
  const sentIds = (page) => page.evaluate(() => window.__rpc
    .filter((r) => r.name === 'submit_airline_conditions')
    .map((r) => r.args.p.answers.map((a) => a.question_id + '=' + a.code).join(',')));

  for (const lang of (only ? [only] : ['ja', 'en'])) {
    console.log(`\n════ ${lang} / 質問へ直接来る入口（?q=）════`);

    /* A. 親を持たない質問・閉じて出る節 */
    {
      const { page, errs } = await openFull({ lang, query: '?airline=ana&q=' + Q_ROOT.id });
      await ready(page);
      const v = await look(page);
      ok(v.path === (lang === 'en' ? '/en/' : '/') + 'airline-conditions.html',
         'A 開いているのがこの言語の画面（もう片方の言語へ移されていない）', v.path);
      ok(v.n === 1 && v.qid === Q_ROOT.id, 'A 目当ての行に印が1つだけ付く', JSON.stringify(v));
      ok(v.open === true, 'A 閉じて出る節が開いている', v.opens);
      ok(v.inView && v.y > 0, 'A その行が画面の中に入っている（先頭から運ばれた）', JSON.stringify(v));
      ok(v.focus === true, 'A フォーカスがその行に在る（次の Tab が選択肢から始まる）');
      ok(v.shown.length === N_ROOT, 'A 隠れている子を無理に出していない', String(v.shown.length));
      await press(page, Q_ROOT.id, 'unknown');
      ok(await noMark(page), 'A 目当ての質問に答えたら印が外れる');
      ok(errs.length === 0, 'A ページのエラーが1件も出ない', errs.join(' | '));
      await page.close();
    }

    /* B. 親が1段の質問・親にまだ答えていない → 親へ運ぶ → 親に答えたら子へ移る */
    {
      const P1 = BY[Q_ONE.parent];
      const { page, errs } = await openFull({ lang, query: '?airline=ana&q=' + Q_ONE.id,
        vp: { width: 390, height: 680 } });
      await ready(page);
      let v = await look(page);
      ok(v.n === 1 && v.qid === P1.id && v.open === true && v.inView,
         `B 親に答えていなければ、親の行（${P1.id}）へ運ぶ`, JSON.stringify(v));
      ok(!v.shown.includes(Q_ONE.id), 'B 目当ての子はまだ出していない');
      await press(page, P1.id, inCode(Q_ONE));
      ok(await markOn(page, Q_ONE.id), 'B 親に答えると印が子へ移り、画面に入る', JSON.stringify(await look(page)));
      await press(page, Q_ONE.id, 'unknown');
      ok(await noMark(page), 'B 子に答えたら印が外れる');
      const sent = await sentIds(page);
      ok(sent.length === 2 && sent[0] === P1.id + '=' + inCode(Q_ONE) && sent[1] === Q_ONE.id + '=unknown',
         'B 押した答えが、その質問の鍵のまま保存へ送られる', JSON.stringify(sent));
      ok(errs.length === 0, 'B ページのエラーが1件も出ない', errs.join(' | '));
      await page.close();
    }

    /* C. 親が2段の質問・何も答えていない → いちばん上へ → 1段ずつ下りる */
    {
      const { page, errs } = await openFull({ lang, query: '?airline=ana&q=' + Q_DEEP.id,
        vp: { width: 390, height: 680 } });
      await ready(page);
      let v = await look(page);
      ok(v.n === 1 && v.qid === TOP.id && v.open === true && v.inView,
         `C 何も答えていなければ、いちばん上の親（${TOP.id}）へ運ぶ`, JSON.stringify(v));
      ok(v.shown.length === N_ROOT && UNDER_TOP.every((id) => !v.shown.includes(id)),
         'C 子も孫もまだ出していない', JSON.stringify(v.shown));

      await press(page, TOP.id, TOP_IN);
      ok(await markOn(page, MID.id), `C いちばん上に答えると、印が1段下りる（${MID.id}）`,
         JSON.stringify(await look(page)));
      v = await look(page);
      ok(!v.shown.includes(Q_DEEP.id) && SIB_OUT.concat(SIB_IN).every((id) => !v.shown.includes(id)),
         'C あいだの親に答えるまで、孫は1つも出ない', JSON.stringify(v.shown));

      await press(page, MID.id, MID_OUT);
      ok(await settled(page, MID.id, MID_OUT), 'C あいだの親を「条件の外」で答える（保存される）');
      v = await look(page);
      ok(v.n === 1 && v.qid === MID.id, 'C ★条件から外れたら、その親に印を残して止まる', JSON.stringify(v));
      ok(!v.shown.includes(Q_DEEP.id), 'C    目当ての孫は出ない');

      await press(page, MID.id, MID_IN);
      ok(await markOn(page, Q_DEEP.id), `C 条件に合う答えに直すと、印が目当て（${Q_DEEP.id}）へ下りて画面に入る`,
         JSON.stringify(await look(page)));
      v = await look(page);
      ok(SIB_IN.every((id) => v.shown.includes(id)) && SIB_OUT.every((id) => !v.shown.includes(id)),
         'C ★出るのは答えた種類の孫だけ（別の種類の孫は出ない）', JSON.stringify(v.shown));

      await press(page, Q_DEEP.id, DEEP_ANS);
      ok(await noMark(page), 'C 目当てに答えたら印が外れる');
      const sent = await sentIds(page);
      ok(JSON.stringify(sent) === JSON.stringify([TOP.id + '=' + TOP_IN, MID.id + '=' + MID_OUT,
           MID.id + '=' + MID_IN, Q_DEEP.id + '=' + DEEP_ANS]),
         'C 押した4回が、その順で1問ずつ保存へ送られる', JSON.stringify(sent));
      v = await look(page);
      ok(v.count === '3/' + N_Q && v.badges.includes(TOP.section + '=3/' + SEC_LEN),
         `C 「答えた項目」が 3／${N_Q}・節の札が 3/${SEC_LEN}`, v.count + ' ' + v.badges);

      /* いちばん上を「条件の外」へ答え直す → 子も孫も隠れ、数からも外れる */
      await press(page, TOP.id, TOP_OUT);
      ok(await settled(page, TOP.id, TOP_OUT), 'C いちばん上を「条件の外」へ答え直す（保存される）');
      v = await look(page);
      ok(UNDER_TOP.every((id) => !v.shown.includes(id)),
         'C ★いちばん上が条件から外れたら、子も孫も全部隠れる', JSON.stringify(v.shown));
      ok(v.count === '1/' + N_Q && v.badges.includes(TOP.section + '=1/' + SEC_LEN),
         `C ★隠れた質問の古い答えを「答えた項目」に数えない（1／${N_Q}・節の札 1/${SEC_LEN}）`,
         v.count + ' ' + v.badges);
      ok(v.n === 0, 'C    印は付け直さない（目当てには答え終わっている）');

      /* 元に戻す → 前の答えのまま戻る（消していない） */
      await press(page, TOP.id, TOP_IN);
      ok(await settled(page, TOP.id, TOP_IN), 'C いちばん上を元に戻す（保存される）');
      v = await look(page);
      ok(v.shown.includes(MID.id) && v.shown.includes(Q_DEEP.id)
         && v.picked[MID.id] === MID_IN && v.picked[Q_DEEP.id] === DEEP_ANS,
         'C ★元に戻すと、子も孫も前の答えのまま戻る', JSON.stringify(v.picked));
      ok(v.count === '3/' + N_Q, `C    数も 3／${N_Q} に戻る`, v.count);
      ok(errs.length === 0, 'C ページのエラーが1件も出ない', errs.join(' | '));
      await page.close();
    }

    /* D. 前に答えた人が来たとき（サーバから返る答えで決まる） */
    {
      let r = await openFull({ lang, query: '?airline=ana&q=' + Q_DEEP.id,
        answers: [A(TOP.id, TOP_IN), A(MID.id, MID_IN)] });
      await ready(r.page);
      let v = await look(r.page);
      ok(v.n === 1 && v.qid === Q_DEEP.id && v.hidden === false && v.open === true && v.inView,
         'D 親に2段とも答え済みなら、目当ての行へ直接', JSON.stringify(v));
      ok(r.errs.length === 0, 'D ページのエラーが1件も出ない', r.errs.join(' | '));
      await r.page.close();

      r = await openFull({ lang, query: '?airline=ana&q=' + Q_DEEP.id,
        answers: [A(TOP.id, TOP_IN), A(MID.id, MID_OUT)] });
      await ready(r.page);
      v = await look(r.page);
      ok(v.n === 1 && v.qid === MID.id && !v.shown.includes(Q_DEEP.id),
         'D あいだの親が条件の外なら、その親に印（孫は出さない）', JSON.stringify(v));
      await r.page.close();

      /* いちばん上だけ条件の外・その下に古い答えが残っている人 */
      r = await openFull({ lang, query: '?airline=ana&q=' + Q_DEEP.id,
        answers: [A(TOP.id, TOP_OUT), A(MID.id, MID_IN), A(Q_DEEP.id, DEEP_ANS)] });
      await ready(r.page);
      v = await look(r.page);
      ok(v.n === 1 && v.qid === TOP.id, 'D いちばん上が条件の外なら、いちばん上に印', JSON.stringify(v));
      ok(UNDER_TOP.every((id) => !v.shown.includes(id)),
         'D ★あいだの親に古い答えが残っていても、孫を出さない', JSON.stringify(v.shown));
      ok(v.count === '1/' + N_Q, `D ★古い答えを数えない（1／${N_Q}）`, v.count);
      await r.page.close();
    }

    /* E. q が無い・知らない鍵・無くなった鍵・悪い鍵 → q なしと1文字も違わない */
    {
      const { page, errs, go } = await openFull({ lang, query: '?airline=ana' });
      await ready(page);
      const html = () => page.evaluate(() => document.getElementById('pv-conditions').innerHTML);
      const base = { v: await look(page), html: await html() };
      ok(base.v.n === 0 && base.v.y === 0 && base.v.opens === '1' + '0'.repeat(N_SEC - 1),
         'E q なし: 印なし・先頭のまま・最初の節だけ開く', JSON.stringify(base.v));
      const BAD = ['nope', 'constructor', '__proto__', 'toString', Q_DEEP.id.toUpperCase(),
                   Q_DEEP.id + '"]', '', 'staff_travel_trips', 'staff_travel_cost',
                   /* 手段ごとの質問に作り直す前の鍵（2026-10-04 に無くした） */
                   'commuting_transport_when', 'commuting_transport_where', 'commuting_transport_cost']
                   .filter((k) => !has(k));
      for (const bad of BAD) {
        await go('?airline=ana&q=' + encodeURIComponent(bad));
        await ready(page);
        const v = await look(page);
        ok(v.n === 0 && v.y === 0 && v.opens === base.v.opens && (await html()) === base.html,
           `E q=${JSON.stringify(bad)}: q なしと1文字も違わない`, JSON.stringify(v));
      }
      ok(errs.length === 0, 'E ページのエラーが1件も出ない', errs.join(' | '));
      await page.close();
    }

    /* F. 会社が決まっていない人 → 会社を選んでから、その質問へ */
    {
      const { page, errs } = await openFull({ lang, query: '?q=' + Q_ROOT.id, hasReport: false });
      await ready(page);
      ok(await page.evaluate(() => !!document.getElementById('pvcf-air')
           && document.querySelectorAll('[data-qid]').length === 0),
         'F 会社が決まるまでは会社選び（質問は出さない）');
      await page.evaluate(() => {
        const sel = document.getElementById('pvcf-air');
        sel.value = sel.options[1].value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('pvcf-go').click();
      });
      ok(await markOn(page, Q_ROOT.id), 'F 会社を選んだあと、その質問へ運ばれる', JSON.stringify(await look(page)));
      ok(errs.length === 0, 'F ページのエラーが1件も出ない', errs.join(' | '));
      await page.close();
    }

    /* G. 未ログイン → ログインへ送るときに airline と q を落とさない。
          画面が移る途中は中を読めないので、読めるようになるまで繰り返す（時間では待たない）。 */
    {
      const { page } = await openFull({ lang, query: '?airline=ana&q=' + Q_DEEP.id, login: false });
      let href = '';
      for (let i = 0; i < 40 && !/login\.html/.test(href); i++) {
        href = await page.waitForFunction(() => (/login\.html/.test(location.pathname) ? location.href : false),
          { timeout: 15000 }).then((h) => h.jsonValue(), (e) => (/timeout|waiting failed/i.test(String(e.message)) ? 'timeout' : ''));
        if (href === 'timeout') break;
      }
      let back = '';
      try { back = new URL(href).searchParams.get('redirect') || ''; } catch (e) {}
      ok(/login\.html/.test(href) && back === 'airline-conditions.html?airline=ana&q=' + Q_DEEP.id,
         'G 未ログインの戻り先に airline と q が残る', back || href);
      ok(new URL(href, 'http://localhost:3000/').pathname === (lang === 'en' ? '/en/login.html' : '/login.html'),
         'G 送られた先がこの言語のログイン画面', href);
      await page.close();
    }

    /* H. あいだの親が「複数選ぶ」質問（手段ごとに別の質問が開く）。
          ★ここが壊れると、片方の手段しか選んでいない人にもう片方の質問が出る／
            両方を選んだ人の答えが1つの鍵に混ざる。画面は普通に動くので、ここでしか気づけない。
          「複数選ぶ」質問は、押すたびに1つ足す・もう1度押すと外す（押すたびに保存される）。 */
    if (Q_MULTI && Q_OTHER) {
      const M_MID = BY[Q_MULTI.parent], M_TOP = BY[M_MID.parent];
      const M_TOP_IN = inCode(M_MID);
      const M_IN = inCode(Q_MULTI), M_OTHER = inCode(Q_OTHER);
      const KIDS = LISTED.filter((q) => q.parent === M_MID.id);
      const KIDS_IN = KIDS.filter((q) => q.parentWhen.includes(M_IN)).map((q) => q.id);
      const KIDS_OTHER = KIDS.filter((q) => q.parentWhen.includes(M_OTHER)).map((q) => q.id);
      const M_UNDER = under(M_TOP);
      /* 2つの手段に、わざと違う答えを入れる（混ざったら分かるように） */
      const OTHER_ANS = firstCode(Q_OTHER);
      const MULTI_ANS = (Q_MULTI.choices.find((c) => c.code !== 'unknown' && c.code !== OTHER_ANS) || {}).code;
      const AM = (id, codes) => ({ question_id: id, code: null, codes: codes, num: null, currency: null, text: null });
      const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
      const pickedOf = (page, qid) => page.evaluate((qid) => Array.prototype.map.call(
        document.querySelectorAll('[data-qid="' + qid + '"] .pvc-opt.is-picked'),
        (b) => b.getAttribute('data-code')), qid);
      /* 外した保存が終わるまで待つ（その選択肢が選ばれていない形に戻り、「保存しました」が出る） */
      const unpicked = (page, qid, code) => page.waitForFunction((qid, code) => {
        const row = document.querySelector('[data-qid="' + qid + '"]');
        const b = row && row.querySelector('.pvc-opt[data-code="' + code + '"]');
        const s = row && row.querySelector('.pvcf-state');
        return !!(b && !b.classList.contains('is-picked') && s && s.textContent);
      }, { timeout: 8000 }, qid, code).then(() => true, () => false);
      const sentAll = (page) => page.evaluate(() => window.__rpc
        .filter((r) => r.name === 'submit_airline_conditions')
        .map((r) => r.args.p.answers.map((a) => a.question_id + '='
          + (a.codes ? a.codes.join('+') : a.code)).join(',')));
      if (lang === (only || 'ja')) {
        console.log(`  （H の目当て: ${M_TOP.id} → ${M_MID.id}［${M_IN}］→ ${Q_MULTI.id} ／ 別の手段: ［${M_OTHER}］→ ${Q_OTHER.id}）`);
      }
      ok(M_IN !== M_OTHER && !!MULTI_ANS && !!OTHER_ANS && MULTI_ANS !== OTHER_ANS
         && KIDS_IN.every((id) => !KIDS_OTHER.includes(id)),
         'H 2つの手段と、手段ごとに違う答えをバンクから選べる',
         JSON.stringify({ M_IN, M_OTHER, MULTI_ANS, OTHER_ANS }));

      const { page, errs } = await openFull({ lang, query: '?airline=ana&q=' + Q_MULTI.id,
        vp: { width: 390, height: 680 } });
      await ready(page);
      let v = await look(page);
      ok(v.n === 1 && v.qid === M_TOP.id && v.open === true && v.inView,
         `H 何も答えていなければ、いちばん上の親（${M_TOP.id}）へ運ぶ`, JSON.stringify(v));
      ok(M_UNDER.every((id) => !v.shown.includes(id)), 'H 手段の質問も、その下の質問もまだ出していない',
         JSON.stringify(v.shown));

      await press(page, M_TOP.id, M_TOP_IN);
      ok(await markOn(page, M_MID.id), `H いちばん上に答えると、印が手段を選ぶ質問（${M_MID.id}）へ下りる`,
         JSON.stringify(await look(page)));
      v = await look(page);
      ok(KIDS.every((q) => !v.shown.includes(q.id)), 'H 手段を選ぶまで、その下の質問は1つも出ない',
         JSON.stringify(v.shown));

      await press(page, M_MID.id, M_OTHER);
      ok(await settled(page, M_MID.id, M_OTHER), 'H 別の手段だけを選ぶ（保存される）');
      v = await look(page);
      ok(v.n === 1 && v.qid === M_MID.id, 'H ★目当ての手段を選んでいなければ、手段の質問に印を残して止まる',
         JSON.stringify(v));
      ok(KIDS_OTHER.every((id) => v.shown.includes(id)) && KIDS_IN.every((id) => !v.shown.includes(id)),
         'H ★出るのは選んだ手段の質問だけ（選んでいない手段の質問は出ない）', JSON.stringify(v.shown));

      await press(page, M_MID.id, M_IN);
      ok(await markOn(page, Q_MULTI.id), `H 目当ての手段も選ぶと、印が目当て（${Q_MULTI.id}）へ下りて画面に入る`,
         JSON.stringify(await look(page)));
      v = await look(page);
      ok(KIDS.every((q) => v.shown.includes(q.id)), 'H ★両方を選んだ人には、両方の手段の質問が全部出る',
         JSON.stringify(v.shown));
      ok(sameSet(await pickedOf(page, M_MID.id), [M_OTHER, M_IN]), 'H    選んだ2つが、両方とも選ばれた形で残る',
         JSON.stringify(await pickedOf(page, M_MID.id)));

      await press(page, Q_MULTI.id, MULTI_ANS);
      ok(await noMark(page), 'H 目当てに答えたら印が外れる');
      await press(page, Q_OTHER.id, OTHER_ANS);
      ok(await settled(page, Q_OTHER.id, OTHER_ANS), 'H もう片方の手段の質問にも答える（保存される）');
      const sent = await sentAll(page);
      ok(JSON.stringify(sent) === JSON.stringify([M_TOP.id + '=' + M_TOP_IN, M_MID.id + '=' + M_OTHER,
           M_MID.id + '=' + M_OTHER + '+' + M_IN, Q_MULTI.id + '=' + MULTI_ANS, Q_OTHER.id + '=' + OTHER_ANS]),
         'H ★手段ごとの答えが、それぞれの質問の鍵で別々に保存へ送られる', JSON.stringify(sent));
      v = await look(page);
      ok(v.picked[Q_MULTI.id] === MULTI_ANS && v.picked[Q_OTHER.id] === OTHER_ANS,
         'H ★2つの手段の答えが、画面でも別々の行に残る（片方がもう片方を上書きしない）', JSON.stringify(v.picked));
      ok(v.count === '4/' + N_Q, `H    「答えた項目」が 4／${N_Q}`, v.count);

      /* 目当ての手段を外す → その手段の質問だけが隠れ、数からも外れる。選び直すと前の答えのまま戻る */
      await press(page, M_MID.id, M_IN);
      ok(await unpicked(page, M_MID.id, M_IN), 'H 手段を1つ外す（保存される）');
      v = await look(page);
      ok(KIDS_IN.every((id) => !v.shown.includes(id)) && KIDS_OTHER.every((id) => v.shown.includes(id)),
         'H ★外した手段の質問だけが隠れる（もう片方の手段の質問は残る）', JSON.stringify(v.shown));
      ok(v.count === '3/' + N_Q, `H ★隠れた質問の古い答えを数えない（3／${N_Q}）`, v.count);
      await press(page, M_MID.id, M_IN);
      ok(await settled(page, M_MID.id, M_IN), 'H 外した手段を選び直す（保存される）');
      v = await look(page);
      ok(v.shown.includes(Q_MULTI.id) && v.picked[Q_MULTI.id] === MULTI_ANS && v.count === '4/' + N_Q,
         `H ★選び直すと、前の答えのまま戻る（4／${N_Q}）`, JSON.stringify(v.picked) + ' ' + v.count);
      ok(errs.length === 0, 'H ページのエラーが1件も出ない', errs.join(' | '));
      await page.close();

      /* 前に答えた人が来たとき（サーバから返る答えで決まる） */
      let r = await openFull({ lang, query: '?airline=ana&q=' + Q_MULTI.id,
        answers: [A(M_TOP.id, M_TOP_IN), AM(M_MID.id, [M_OTHER, M_IN])] });
      await ready(r.page);
      v = await look(r.page);
      ok(v.n === 1 && v.qid === Q_MULTI.id && v.hidden === false && v.open === true && v.inView,
         'H 手段を2つとも選んである人は、目当ての行へ直接', JSON.stringify(v));
      ok(r.errs.length === 0, 'H    ページのエラーが1件も出ない', r.errs.join(' | '));
      await r.page.close();

      r = await openFull({ lang, query: '?airline=ana&q=' + Q_MULTI.id,
        answers: [A(M_TOP.id, M_TOP_IN), AM(M_MID.id, [M_OTHER])] });
      await ready(r.page);
      v = await look(r.page);
      ok(v.n === 1 && v.qid === M_MID.id && !v.shown.includes(Q_MULTI.id),
         'H 別の手段しか選んでいない人は、手段の質問に印（目当ては出さない）', JSON.stringify(v));
      await r.page.close();
    }

    /* I. 話題の入口から来た人にだけ出す質問（topicOnly・2026-10-04 オーナー決定）
          ふだんの一覧には1問も混ぜない（分母を増やさない）。
          ?q= がその1問を名指ししたときだけ、同じ話題の分が一緒に出る ── ほかの話題の分は出ない。 */
    if (TOPIC_ONLY.length) {
      const rowsOf = (page) => page.evaluate(() =>
        Array.prototype.map.call(document.querySelectorAll('[data-qid]'), (x) => x.getAttribute('data-qid')));
      const T1 = TOPIC_ONLY[0];
      const SAME = TOPIC_ONLY.filter((q) => q.topic === T1.topic).map((q) => q.id);
      const ELSE = TOPIC_ONLY.filter((q) => q.topic !== T1.topic).map((q) => q.id);

      let r = await openFull({ lang, query: '?airline=ana' });
      await ready(r.page);
      let ids = await rowsOf(r.page);
      ok(TOPIC_ONLY.every((q) => !ids.includes(q.id)) && ids.length === N_Q,
         `I ★ふだんの一覧に、話題の入口だけの質問が1問も無い（${N_Q} 問のまま）`, String(ids.length));
      await r.page.close();

      r = await openFull({ lang, query: '?airline=ana&q=' + T1.id });
      await ready(r.page);
      ids = await rowsOf(r.page);
      const v = await look(r.page);
      ok(SAME.every((id) => ids.includes(id)) && ids.length === N_Q + SAME.length,
         `I ★入口から来た人には、その話題の ${SAME.length} 問が一緒に出る`, String(ids.length));
      ok(ELSE.every((id) => !ids.includes(id)), 'I    ほかの話題の分は出ない', ELSE.filter((id) => ids.includes(id)).join(','));
      ok(v.n === 1, 'I    目当て（か、その親）に印が1つ付く', JSON.stringify({ n: v.n, qid: v.qid }));
      ok(r.errs.length === 0, 'I    ページのエラーが1件も出ない', r.errs.join(' | '));
      await r.page.close();
    }

    /* J. 額の質問（通貨つき）── 通貨は本人に選ばせる（2026-10-09）
          ★2026-10-09 まで、通貨の欄は一覧のいちばん上の通貨が選ばれた形で出ていた。
            何も選んでいない人の額に、その通貨が黙って付いて保存されていた（画面は普通に「保存しました」と出る）。
          見るのは3つ ── 最初は何も選ばれていない／選ばずに送ると送らずにその場で言う／選べばその通貨で送る。
          ⚠️ 下で入れる額は検査のための作りもの。どの会社の額でもない。 */
    {
      const MONEY = LISTED.filter((q) => q.kind === 'num' && q.currency && q.parent && !BY[q.parent].parent
        && BY[q.parent].kind === 'choice');
      const PICKS = [MONEY.find((q) => q.id === 'training_bond_amount'), MONEY.find((q) => q.id === 'landing_pay_amount')];
      const PICK_TEXT = lang === 'en' ? 'Choose currency' : '通貨を選ぶ';
      const NEED_TEXT = lang === 'en' ? 'Please choose a currency.' : '通貨を選んでください。';
      const N_CUR = JSON.parse(readFileSync(new URL('./pv-vocab.json', import.meta.url), 'utf8')).currencies.length;
      ok(PICKS.every(Boolean), 'J 訓練費の返還額と着陸手当の額が、どちらも「通貨つきの額」の質問としてバンクに在る',
         JSON.stringify(MONEY.map((q) => q.id)));
      const sentNum = (page) => page.evaluate(() => window.__rpc
        .filter((r) => r.name === 'submit_airline_conditions').map((r) => r.args.p.answers[0]));
      const curOf = (page, qid) => page.evaluate((qid) => {
        const s = document.querySelector('[data-qid="' + qid + '"] select[data-cur]');
        return s ? { v: s.value, first: s.options[0].textContent, firstV: s.options[0].value, n: s.options.length - 1,
          focus: document.activeElement === s } : null;
      }, qid);
      /* その行に、うまくいった／いかなかったの文が出るまで待つ */
      const stateOf = (page, qid, bad) => page.waitForFunction((qid, bad) => {
        const s = document.querySelector('[data-qid="' + qid + '"] .pvcf-state');
        return s && s.textContent && s.classList.contains('is-bad') === bad ? s.textContent : false;
      }, { timeout: 8000 }, qid, bad).then((h) => h.jsonValue(), () => '');

      for (const Q of PICKS.filter(Boolean)) {
        const UP = BY[Q.parent];
        const row = '[data-qid="' + Q.id + '"]';
        const { page, errs } = await openFull({ lang, query: '?airline=ana&q=' + Q.id, answers: [A(UP.id, inCode(Q))],
          vp: { width: 390, height: 680 } });
        await ready(page);
        ok(await markOn(page, Q.id), `J ${Q.id}：上の質問に答えてある人は、額の行へ直接`, JSON.stringify(await look(page)));
        let c = await curOf(page, Q.id);
        ok(!!c && c.v === '' && c.firstV === '' && c.first === PICK_TEXT && c.n === N_CUR,
           `J ★${Q.id}：通貨は最初から何も選ばれていない（先頭は「${PICK_TEXT}」。一覧のいちばん上の通貨が入っていない）`, JSON.stringify(c));

        await page.type(row + ' .pvcf-num', '1500');
        await page.click(row + ' [data-num]');
        let said = await stateOf(page, Q.id, true);
        c = await curOf(page, Q.id);
        ok(said === NEED_TEXT && c.focus, `J ★${Q.id}：通貨を選ばずに送ると、その行に「${NEED_TEXT}」と出て、通貨の欄へ移る`,
           JSON.stringify({ said, focus: c.focus }));
        await page.focus(row + ' .pvcf-num');
        await page.keyboard.press('Enter');
        ok((await sentNum(page)).length === 0 && (await page.$eval(row + ' .pvcf-num', (n) => n.value)) === '1500',
           `J ★${Q.id}：ボタンでも Enter でも、通貨の無い額は1本も送っていない（入れた額は消えない）`, JSON.stringify(await sentNum(page)));

        await page.select(row + ' select[data-cur]', 'USD');
        await page.click(row + ' [data-num]');
        said = await stateOf(page, Q.id, false);
        const sent = await sentNum(page);
        c = await curOf(page, Q.id);
        ok(!!said && sent.length === 1 && sent[0].question_id === Q.id && Number(sent[0].num) === 1500 && sent[0].currency === 'USD',
           `J ★${Q.id}：通貨を選べば、その通貨を付けて1回だけ送る`, JSON.stringify(sent));
        ok(c.v === 'USD' && (await page.$eval(row + ' .pvcf-num', (n) => n.value)) === '1500',
           `J    ${Q.id}：保存後の行に、額と選んだ通貨がそのまま残る`, JSON.stringify(c));
        ok(errs.length === 0, `J    ${Q.id}：ページのエラーが1件も出ない`, errs.join(' | '));
        await page.close();

        /* 前に答えた人が来たとき（サーバから返る通貨で開く。空に戻さない） */
        const r = await openFull({ lang, query: '?airline=ana&q=' + Q.id,
          answers: [A(UP.id, inCode(Q)), { question_id: Q.id, code: null, codes: null, num: 1500, currency: 'AED', text: null }] });
        await ready(r.page);
        c = await curOf(r.page, Q.id);
        ok(!!c && c.v === 'AED' && c.firstV === '' && (await r.page.$eval(row + ' .pvcf-num', (n) => n.value)) === '1500',
           `J ★${Q.id}：前に答えた人には、保存してある額と通貨（AED）が入った状態で出る`, JSON.stringify(c));
        await r.page.close();
      }

      /* いちばん狭い画面（幅320）でも、通貨の欄が行（入れ物）の中に収まっている（2026-10-09）
         通貨の欄は、いちばん長い選択肢の字の幅まで広がる。行より広くなり、右の端と矢印が節の枠で切れていた
         （日本語は幅343未満で切れ、幅320で23px。英語は幅320で9px。選べはするが、欄が欠けて見える）。
         通貨つきの額の質問を全部測る（同じ答えで一緒に出るものは1回で開く）。 */
      {
        const ALL_CUR = LISTED.filter((q) => q.kind === 'num' && q.currency);
        const groups = {};
        for (const q of MONEY) { const k = q.parent + '=' + inCode(q); (groups[k] = groups[k] || []).push(q); }
        const seen = [], over = [];
        for (const G of Object.values(groups)) {
          const r = await openFull({ lang, query: '?airline=ana&q=' + G[0].id, answers: [A(G[0].parent, inCode(G[0]))],
            vp: { width: 320, height: 640 } });
          await ready(r.page);
          await markOn(r.page, G[0].id);
          const got = await r.page.evaluate((ids) => ids.map((id) => {
            const s = document.querySelector('[data-qid="' + id + '"] select[data-cur]');
            if (!s || !s.getClientRects().length) return null;
            const a = s.getBoundingClientRect(), b = s.closest('.pvcf-row').getBoundingClientRect();
            return { id: id, sel: Math.round(a.left) + '〜' + Math.round(a.right), row: Math.round(b.left) + '〜' + Math.round(b.right),
              out: a.left < b.left - 0.5 || a.right > b.right + 0.5 };
          }).filter(Boolean), G.map((q) => q.id));
          for (const m of got) { seen.push(m.id); if (m.out) over.push(m); }
          await r.page.close();
        }
        ok(ALL_CUR.length > 0 && seen.length === ALL_CUR.length && over.length === 0,
           `J ★幅320で、通貨の欄（${ALL_CUR.length}問ぜんぶ）が入れ物からはみ出さない`, JSON.stringify({ seen, over }));
      }
    }
  }
}

await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
