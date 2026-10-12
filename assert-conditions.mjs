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

   2026-10-12 に足したもの（見る点の一覧は、それぞれの頭の注記）:
     ・t1〜t3（モーダルの節の最後）お礼の板が「更新されました」と言うのは、保存できた答えが1つでも在るときだけ
     ・K  自分の回答を読めなかったときは「0／全問数」と出さず、「読み込めませんでした」の箱だけを出す
     ・L  キーボードだけで答えたあと、フォーカスがその行の同じ部品に残る
     ・どの節も、開いているのが名乗った言語の画面であること（言語の記憶を固定する）
     ・t・K・L の画面が、本物のサーバへ向かう要求を1本も出していないこと
     ・M  対になる額（低いほう・高いほう）── 食い違う2つを保存しない・2つとも直す人を止めない（2問ぶんを1回で送る）
     ・N  数の行の見た目と並び ── 断りの文とフォーカスの輪の濃さ・断りの元になった欄の印・通貨 → 額 → 単位の順・
          単位が額から離れない・高いほうの行が低いほうの通貨から始まる
     ・O  一覧の仕上げ ── 額の欄・通貨の欄・選んだ選択肢に、置いたとき／押したときの見た目が在る（大きさは変わらない・
          指で触る端末では残らない）・選択肢が「・」の後ろの語の途中で折れない・質問の名前と説明の最後の行に1〜2文字だけ残らない
     ・版スタンプ（ブラウザを立ち上げる前）── pv-conditions.js を読む4枚が、今の中身の指紋を付けて読んでいる

   実行: node assert-conditions.mjs            日英 × 初回/2回目 の4通り
         node assert-conditions.mjs ja 0       1通りだけ（lang, 既に答えている数）
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない。
*/
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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

/* 本物のサーバ（Supabase）へ向かう要求かどうか（2026-10-12）。
   この検査は、サーバへの呼び出しを全部この中の偽物に差し替えて走る。3000番の画面は本番につながっているので、
   差し替えをすり抜けた呼び出しが1本でも在れば、検査が本番を読む・本番へ書くことになる。
   t・K・L の場面は、画面が出した要求を全部これに通し、1本も無いことを確かめる。 */
const toRealServer = (url) => { try { return /(^|\.)supabase\.(co|in)$/.test(new URL(url).hostname); } catch (e) { return false; } };
const LEAKS = [];   // 詳細ページを開く場面（openFull）が出した、本物のサーバへ向かう要求。K と L が、自分の場面のぶんを見る

/* ── 版スタンプ（pv-conditions.js を読む4枚）── ブラウザを立ち上げる前に見る（2026-10-12）
   GitHub Pages が返す寿命は、HTML が10分・.js が4時間。スタンプ（?v=中身の指紋）の無い読み方だと、出した直後の4時間は
   「新しい質問表（pv-conditions.json は毎回取り直す）＋ 端末に残った古い pv-conditions.js」が成立する。
   古い pv-conditions.js は通貨の欄を一覧のいちばん上の通貨（USD）が選ばれた形で出していたので、その組み合わせでは、
   新しく足した額の質問に入れた円の額が、通貨を聞かれないまま USD で保存された（実測）。
   指紋の作り方は assert-links.mjs の版スタンプと同じ ── ファイルの sha256 の先頭8文字。
   ★pv-conditions.js を1文字でも直したら、この4枚のスタンプを書き直す。
     スタンプを書く道具は無い ── 下の赤い行が出す値を、4枚のタグへ手で写す（1枚につき1か所）。
   ⚠️ pay-report.html（日英）も同じ pv-conditions.js を読むが、スタンプは無い。あの2枚と assert-links.mjs の一覧は
      別の作業の持ち物なので、ここでは見ていない（あの2枚から出るのは選ぶだけの質問で、通貨つきの額の質問は出ない）。 */
{
  const fp = createHash('sha256').update(readFileSync(new URL('./pv-conditions.js', import.meta.url))).digest('hex').slice(0, 8);
  console.log('\n════ 版スタンプ（pv-conditions.js ＝ ?v=' + fp + '）════');
  for (const [file, pre] of [['airline-conditions.html', ''], ['en/airline-conditions.html', '../'], ['profile.html', ''], ['en/profile.html', '../']]) {
    const html = readFileSync(new URL('./' + file, import.meta.url), 'utf8');
    /* この名前を読む <script> を全部拾う（引用符の書き方やほかの属性が違っても拾う）。src は書いてある字のまま比べる */
    const srcs = (html.match(/<script\b[^>]*pv-conditions\.js(?!on)[^>]*>/g) || []).map((tag) => {
      const m = tag.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/);
      return m ? (m[1] || m[2] || m[3] || '') : tag;
    });
    ok(srcs.length === 1 && srcs[0] === pre + 'pv-conditions.js?v=' + fp,
       `版スタンプ ${file}: pv-conditions.js を読むタグは1つだけで、今の中身の指紋を付けている（"${pre}pv-conditions.js?v=${fp}"）`,
       '今のタグ: ' + JSON.stringify(srcs));
  }
}

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

for (const kase of CASES) {
  const { lang, mine } = kase;
  /* 出す問数 ＝ mine_count < 3 ? 3 - mine_count : 1（画面が決める） */
  const want = mine >= 3 ? 1 : 3 - mine;
  const url = 'http://localhost:3000/' + (lang === 'en' ? 'en/' : '') + 'profile.html';
  console.log(`\n════ ${lang} / 既に答えている数 ${mine} → ${want}問出るはず ════`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1100 });
  const net = [];
  page.on('request', (r) => { if (toRealServer(r.url())) net.push(r.url().slice(0, 120)); });

  await page.evaluateOnNewDocument((mineCount, nQ, lang) => {
    localStorage.setItem('pv-theme', 'dark');
    /* ★言語の記憶を、いま見ている言語に固定する（2026-10-12）。この検査は1つのブラウザで日英を順に開く。
       英語の画面が残した記憶（lang-toggle.js の STICKY_EN）が、次の日本語の画面を英語へ移していた
       ＝「ja / 既に答えている数 7」と名乗る回が、ずっと英語の画面を見ていた（文を読まないので、どこも赤くならなかった）。 */
    try { localStorage.setItem('pv-lang', lang); } catch (e) {}
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
  }, mine, N_Q, lang);

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
  const here = await page.evaluate(() => location.pathname);
  ok(here === (lang === 'en' ? '/en/' : '/') + 'profile.html', '開いているのがこの言語の画面（もう片方の言語へ移されていない）', here);
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

  /* ── お礼の板が「更新されました」と言うのは、保存できた答えが1つでも在るときだけ（2026-10-12）──
     ★「今回はスキップ」だけで終わった人にも「◯◯ の待遇情報が更新されました。」と出ていた。
       1問も足していないのに、足したと言っていた（板は普通に出て普通に閉じるので、ここでしか気づけない）。
     見ること:
       t1 出た質問を全部スキップ          → お礼の1行だけ。「更新されました」も社名も出ない
       t2 1問だけ答えて、残りをスキップ   → 全部の行（1問は本当に足した）。出る質問が1問の回は t3 と同じなので省く
       t3 出た質問に全部答える            → 全部の行
     ⚠️ 期待する文は、ここに書いたもの。製品の文言の表を読まない（写しどうしを比べても何も分からない）。
     ⚠️ お礼の板は 2.6 秒で自分から閉じる。出たその場で見張りが控えを取る（時間を置いて覗かない）。
     ⚠️ 板は1回ごとに開き直す。前の板が残っていると afterReport は二重に開かず、前の板の続きを押すことになる。 */
  {
    const NAME = 'ZIPAIR Tokyo';
    const THANKS = lang === 'en' ? 'Thank you.' : 'ありがとうございます。';
    const WHOLE = lang === 'en'
      ? ['Thank you.', 'Conditions for ' + NAME + ' have been updated.']
      : ['ありがとうございます。', NAME + ' の待遇情報が', '更新されました。'];
    const WHOLE_TEXT = WHOLE.join(lang === 'en' ? ' ' : '');
    const card = async (acts) => {
      const gone = () => page.waitForFunction(() => !document.querySelector('[data-pvc]'), { timeout: 8000 })
        .then(() => true, () => false);
      if (!(await gone())) return { err: '前の板が閉じない' };
      await page.evaluate(() => {
        window.__rpc = [];
        window.__pvcCard = null;
        window.__pvcSee = () => {
          const dn = document.querySelector('[data-pvc] .pvc-done');
          if (!dn || window.__pvcCard) return;
          window.__pvcCard = {
            parts: Array.prototype.map.call(dn.querySelectorAll('.pvc-nb'), (x) => x.textContent),
            text: dn.textContent,
            more: document.querySelectorAll('[data-pvc] .pvc-more').length
          };
        };
        window.__pvcWatch = new MutationObserver(window.__pvcSee);
        window.__pvcWatch.observe(document.body, { childList: true, subtree: true });
        const sb = window.supabase.createClient();
        const en = document.documentElement.getAttribute('lang') === 'en';
        const hit = (window.PV_AIRLINES || []).filter((a) => window.PV_slugOf(a) === 'zipair')[0];
        window.PVConditions.afterReport({ sb: sb, airline: 'zipair', airline_other: null,
          airlineName: hit ? (en ? hit.en : hit.name) : '',
          year: 2026, month: 8, position: 'cap', fleet: 'a380',
          base_iata: 'ITM', contract_type: 'direct' });
      });
      let err = '';
      for (let k = 0; k < acts.length && !err; k++) {
        /* k+1 問目が出ているのを確かめてから押す（3問の回は「k+1 / 3」の札。1問の回は札が無い） */
        const shown = await page.waitForFunction((k, n) => {
          const m = document.querySelector('[data-pvc]');
          if (!m || !m.querySelector('.pvc-opt:not([disabled])')) return false;
          const st = ((m.querySelector('.pvc-step') || {}).textContent || '').replace(/\s+/g, '');
          return n === 1 ? st === '' : st === (k + 1) + '/' + n;
        }, { timeout: 8000 }, k, acts.length).then(() => true, () => false);
        if (!shown) { err = (k + 1) + '問目が出ない'; break; }
        await page.evaluate((act) => {
          const m = document.querySelector('[data-pvc]');
          m.querySelector(act === 'answer' ? '.pvc-opt' : '.pvc-skip').click();
          window.__pvcSee();
        }, acts[k]);
      }
      const got = err ? null : await page.waitForFunction(() => window.__pvcCard, { timeout: 8000, polling: 50 })
        .then((h) => h.jsonValue(), () => null);
      const sent = await page.evaluate(() => {
        if (window.__pvcWatch) window.__pvcWatch.disconnect();
        return window.__rpc.filter((r) => r.name === 'submit_airline_conditions').map((r) => r.args.p.answers[0]);
      });
      return { err: err || (got ? '' : 'お礼の板が出ない'), card: got, sent: sent, gone: gone };
    };
    const saved = (r) => (r.sent || []).filter((a) => !a.skip && a.code).length;
    const skipped = (r) => (r.sent || []).filter((a) => a.skip === true).length;
    const whole = (r) => !!r.card && JSON.stringify(r.card.parts) === JSON.stringify(WHOLE)
      && r.card.text === WHOLE_TEXT;

    let r = await card(Array(want).fill('skip'));
    ok(!r.err && saved(r) === 0 && skipped(r) === want,
       `t1 ${want}問とも「今回はスキップ」── 1問も保存していない（送ったのはスキップ ${want} 件だけ）`,
       r.err || JSON.stringify(r.sent));
    ok(!r.err && r.card.parts.length === 1 && r.card.text === THANKS,
       `t1 ★お礼の板に出るのは「${THANKS}」の1行だけ`, r.err || JSON.stringify(r.card));
    ok(!r.err && !/更新されました|have been updated|待遇情報|Conditions for/.test(r.card.text) && !r.card.text.includes(NAME),
       't1 ★1問も足していないのに「更新されました」と言わない（社名も出さない）', r.err || JSON.stringify(r.card));
    ok(!r.err && r.card.more === 1, 't1    「もっと詳しく答える →」は今までどおり1つ出る', r.err || JSON.stringify(r.card));
    ok(!r.err && await r.gone(), 't1    スキップだけのあとも、板は今までどおり自分から閉じる', r.err);

    if (want > 1) {
      r = await card(['answer'].concat(Array(want - 1).fill('skip')));
      ok(!r.err && saved(r) === 1 && skipped(r) === want - 1 && whole(r),
         `t2 ★1問だけ答えて残りをスキップ ── 全部の行が出る（「${WHOLE_TEXT}」）`,
         r.err || JSON.stringify({ card: r.card, sent: r.sent }));
    } else {
      console.log('  （t2 は出る質問が1問の回には無い ＝ t3 と同じ）');
    }

    r = await card(Array(want).fill('answer'));
    ok(!r.err && saved(r) === want && skipped(r) === 0 && whole(r),
       `t3 ★${want}問とも答える ── 全部の行が出る`, r.err || JSON.stringify({ card: r.card, sent: r.sent }));
    ok(net.length === 0, 't    この回の画面は、本物のサーバへ向かう要求を1本も出していない（答えたのは全部この検査の偽物）', net.join(' | '));
  }

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

    await page.evaluateOnNewDocument((hasReport, nQ, lang) => {
      localStorage.setItem('pv-theme', 'dark');
      /* ★言語の記憶を、いま見ている言語に固定する（上の節と同じ理由・2026-10-12）。固定する前は、上の節の
         最後の英語の回が残した記憶で、ここの「ja」の回も英語の画面を見ていた。 */
      try { localStorage.setItem('pv-lang', lang); } catch (e) {}
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
    }, hasReport, N_Q, lang);

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
    ok(v.path === (lang === 'en' ? '/en/' : '/') + 'airline-conditions.html',
       '開いているのがこの言語の画面（もう片方の言語へ移されていない）', v.path);
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

  /* 詳細ページを開く。偽物 Supabase の rpc は上と同じ「then だけを持つ箱」。
     read … 自分の回答を読む呼び出し（my_airline_conditions）を、このタブで最初の1回だけ失敗させる（K が使う）。
              'error'  返事は来たが中身がエラー（本物の supabase-js は、サーバのエラーも通信の失敗もこの形で返す）
              'reject' 箱そのものが失敗する（返事を待つあいだに投げられた）
              'blank'  エラーとは言わないが、中身も無い
            ★失敗の形も「then だけを持つ箱」のまま。ほかの場面（read を渡さない）は今までと1文字も違わない。
            ★失敗させた印は sessionStorage に置く。「もう一度読み込む」はページを読み直し、この差し替えも
              読み直しのたびに入れ直されるので、ページの中の変数で数えると毎回 0 に戻り、いつまでも失敗し続ける。
     hold … 保存の返事を、検査が window.__letGo() を呼ぶまで返さない（L が使う）。
            返事を待つあいだに次の欄へ進んだ人、を時間で待たずに作るため。
     judge … 保存の返事を、送られてきた答えから作る（M が使う）。渡さない場面の返事は、今までと1文字も違わない。
            ・window.__refuse（質問の鍵 → 理由）に在る答えは断る（返事の rejected に、鍵と理由を入れる）
            ・残りは保存した数（saved）に入れる ＝ 2問ぶんの送信には saved: 2 が返る
            ・window.__short（数）が在れば、保存した数をそのぶん少なく返す。断った一覧には何も足さない
              ＝ 数が合わない返事（どの答えが保存されなかったかが、返事のどこにも無い）
            ・画面が返事を読み終わるたびに window.__seen を1つ足す（「返事が届いて行が描き直された」を、時間で待たずに待つ）
            ★この偽物は、2つの額を比べない。比べるのは画面（送る前）と本物のサーバで、
              本物のサーバが断る所は assert-contrib.mjs の最後の場面が見る。
     theme … 画面の色（'dark' が今まで）。 */
  const openFull = async ({ lang, query, answers = [], hasReport = true, login = true,
                            vp = { width: 1280, height: 900 }, read = 'ok', hold = false, judge = false, theme = 'dark' }) => {
    const page = await browser.newPage();
    await page.setViewport(vp);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
    page.on('request', (r) => { if (toRealServer(r.url())) LEAKS.push(r.url().slice(0, 120)); });
    await page.evaluateOnNewDocument((hasReport, answers, login, nQ, lang, read, hold, judge, theme) => {
      try { localStorage.setItem('pv-theme', theme); } catch (e) {}
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
        submit_airline_conditions: (args) => {
          if (!judge) return { ok: true, saved: 1, skipped: 0, rejected: [] };
          const no = window.__refuse || {}, sent = args.p.answers;
          const rej = sent.filter((a) => no[a.question_id]).map((a) => ({ question_id: a.question_id, reason: no[a.question_id] }));
          const kept = sent.length - rej.length;
          return { ok: true, saved: kept - Math.min(window.__short || 0, kept), skipped: 0, rejected: rej };
        }
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
      const failRead = () => {
        if (read === 'ok') return false;
        try {
          if (sessionStorage.getItem('pvt-read-failed')) return false;
          sessionStorage.setItem('pvt-read-failed', '1');
        } catch (e) { return false; }
        return true;
      };
      const held = [];
      window.__heldN = () => held.length;
      window.__letGo = () => { held.splice(0).forEach((f) => f()); };
      const FAKE = {
        auth: { getSession: async () => ({ data: { session: sess } }),
                getUser: async () => ({ data: { user: sess ? sess.user : null } }),
                signOut: async () => ({ error: null }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
        from: () => q([]),
        /* ★本物と同じ「then だけを持つ箱」。async にしない（冒頭の注記のとおり） */
        rpc: (name, args) => { window.__rpc.push({ name: name, args: args });
          if (name === 'my_airline_conditions' && failRead()) {
            if (read === 'reject') return { then: (ok, ng) => Promise.reject(new Error('read rejected')).then(ok, ng) };
            const bad = { data: null, error: read === 'blank' ? null : { message: 'read failed' } };
            return { then: (ok, ng) => Promise.resolve(bad).then(ok, ng) };
          }
          const res = { data: RPC[name] ? RPC[name](args) : { ok: true }, error: null };
          if (judge && name === 'submit_airline_conditions') {
            /* 画面が返事を読み終わった（読んでいる途中で落ちた回も）ところで数える。落ちた回は、落ちたまま画面へ返す */
            const seen = () => { window.__seen = (window.__seen || 0) + 1; };
            const wait = hold ? new Promise((go) => { held.push(() => go(res)); }) : Promise.resolve(res);
            return { then: (ok, ng) => wait.then(ok, ng).then((x) => { seen(); return x; }, (e) => { seen(); throw e; }) };
          }
          if (hold && name === 'submit_airline_conditions') {
            return { then: (ok, ng) => new Promise((go) => { held.push(() => go(res)); }).then(ok, ng) };
          }
          return { then: (ok, ng) => Promise.resolve(res).then(ok, ng) }; }
      };
      Object.defineProperty(window, 'supabase',
        { value: { createClient: () => FAKE }, writable: false, configurable: false });
    }, hasReport, answers, login, N_Q, lang, read, hold, judge, theme);
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

    /* K. 自分の回答を読めなかったとき（2026-10-12）
          ★読めなかったのに「あなたが答えた項目：0／48」と出し、全部の質問を「まだ答えていない」形で並べていた。
            「読めなかった」は 0 ではない。そのまま1つ押すと、前に入れた額が本人に見えないまま、また数に入る。
          見ること:
            n1 返事がエラー／n2 返事そのものが失敗／n1b 返事に中身が無い
               → 「読み込めませんでした」の箱だけ。答えた数も、質問の行も、節も出さない。保存へ1本も送らない
            n3 「もう一度読み込む」→ ページを読み直し、読めたら一覧が出る（前の答えが1つ在る人 ＝ 1／N）
          n4（本当に1つも答えていない人 ＝ 空の一覧が返る ＝ 0／N と出すのが正しい）は、上の「詳細ページ」の節が見ている。
          ⚠️ 期待する文は、ここに書いたもの（製品の文言の表を読まない）。 */
    {
      const K_Q = LISTED.find((q) => !q.parent && q.kind === 'choice' && q.section === BANK.sections[0].code);
      const K_CODE = K_Q && firstCode(K_Q);
      const DEAD_T = lang === 'en' ? 'Could not load the questions' : '質問を読み込めませんでした';
      const RETRY_T = lang === 'en' ? 'Reload' : 'もう一度読み込む';
      ok(!!K_Q && !!K_CODE, 'K 「前に答えた1問」に使う質問を、バンクの最初の節から選べる', '');
      const leaks0 = LEAKS.length;
      /* 箱か、一覧か、会社選びか ── どれかが出るまで待つ */
      const landed = (page) => page.waitForFunction(
        () => !!document.querySelector('[data-pvcf-dead]') || document.querySelectorAll('[data-qid]').length > 0
          || !!document.getElementById('pvcf-air'), { timeout: 15000 }).then(() => true, () => false);
      for (const [read, how] of K_Q ? [['error', 'n1 返事がエラー'], ['reject', 'n2 返事そのものが失敗'], ['blank', 'n1b 返事に中身が無い']] : []) {
        const { page, errs } = await openFull({ lang, query: '?airline=ana', answers: [A(K_Q.id, K_CODE)], read });
        await landed(page);
        const v = await page.evaluate(() => {
          const box = document.getElementById('pv-conditions');
          const dead = box.querySelector('[data-pvcf-dead]');
          return {
            dead: !!dead,
            title: dead ? (dead.querySelector('.pvcf-voices-t') || {}).textContent || '' : '',
            retry: dead ? (dead.querySelector('button[data-pvcf-retry]') || {}).textContent || '' : '',
            skel: box.querySelectorAll('.mr-skel').length,
            count: (document.getElementById('pvcf-count') || {}).textContent || '',
            rows: document.querySelectorAll('[data-qid]').length,
            secs: document.querySelectorAll('.pvcf-sec').length,
            badges: document.querySelectorAll('.pvcf-badge').length,
            picked: document.querySelectorAll('.pvc-opt.is-picked').length,
            digits: (box.innerText.match(/\d+/g) || []).join(' '),
            reads: window.__rpc.filter((r) => r.name === 'my_airline_conditions').length,
            sent: window.__rpc.filter((r) => r.name === 'submit_airline_conditions').length,
            page: document.body.innerText
          };
        });
        const text = v.page;
        delete v.page;
        ok(v.dead && v.title === DEAD_T && v.retry === RETRY_T && v.skel === 0,
           `K ${how}: 「${DEAD_T}」の箱と「${RETRY_T}」が出る（骨組みのまま止まらない）`, JSON.stringify(v));
        ok(!v.count && v.rows === 0 && v.secs === 0 && v.badges === 0 && v.picked === 0 && v.digits === '',
           `K ★${how}: 答えた数も、質問の行も、節も出さない（「読めなかった」を 0 と書かない）`, JSON.stringify(v));
        ok(!text.includes('0／' + N_Q) && !text.includes('answered 0 of') && !/答えた項目|You have answered/.test(text),
           `K ★${how}: 画面のどこにも「0／${N_Q}」も 'answered 0 of' も無い`, JSON.stringify(v));
        ok(v.reads === 1 && v.sent === 0, `K    ${how}: 読みに行ったのは1回・保存へは1本も送っていない`, JSON.stringify(v));

        /* n3 「もう一度読み込む」をキーボードで押す → ページを読み直す → 今度は読める。
              箱が出ていない回（＝上がもう赤い）は、押す物が無いので待たずに赤にする。 */
        const moved = v.dead && await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).then(() => true, () => false),
          page.focus('[data-pvcf-retry]').then(() => page.keyboard.press('Enter'), () => {})
        ]).then((r) => r[0]);
        const listed = moved ? await ready(page) : false;
        const w = listed ? await look(page) : { picked: {} };
        const still = await page.evaluate(() => !!document.querySelector('[data-pvcf-dead]')).catch(() => null);
        ok(moved && listed && still === false && w.count === '1/' + N_Q && w.picked[K_Q.id] === K_CODE,
           `K ★${how.split(' ')[0]} → n3 「${RETRY_T}」で読み直し、読めたら一覧が出る（前の答えが1つ ＝ 1／${N_Q}）`,
           JSON.stringify({ moved, listed, still, count: w.count, picked: w.picked }));
        ok(errs.length === 0, `K    ${how}: ページのエラーが1件も出ない`, errs.join(' | '));
        await page.close();
      }
      ok(LEAKS.length === leaks0, 'K    どの場面も、本物のサーバへ向かう要求を1本も出していない（答えたのは全部この検査の偽物）',
         LEAKS.slice(leaks0).join(' | '));
    }

    /* L. キーボードだけで答えたあと、フォーカスがその行に残る（2026-10-12）
          ★保存できると、その行だけを作り直す。フォーカスが在った部品もいっしょに消えるので、フォーカスが
            ページへ落ちていた（次の Tab は行の頭からやり直し・読み上げは場所を見失う）。
          見ること:
            d1 選択肢を押す → 同じ行の同じ選択肢に残る（選ばれた形で）。続きの質問が下に出て、次の Tab は続きから
            d2 数の欄で Enter → 同じ欄に残る。「入力する」「わからない」を押しても、押したボタンに残る
               「複数選ぶ」質問は、選んでも外しても同じ選択肢に残る（全部外す回は、保存を通らない別の道）
            d3 保存の返事を待つあいだに次の行へ進んだ人のフォーカスは、動かさない。
               同じ行の中で進んだ人（額の欄 → 通貨の欄／選択肢 → 補足の欄）は、進んだ先に残る
               フォーカスはそのままで画面だけ先へ送った人は、フォーカスは戻るが、画面は押した行へ引き戻されない
          ⚠️ マウスは1度も使わない ── Tab で進み、Space か Enter で押す（通貨は字を打って選ぶ）。
          ⚠️ 押す選択肢は、先頭でないものを選ぶ（「行の最初の部品へ戻しただけ」と見分けるため）。
          ⚠️ 下で入れる数と額は検査のための作りもの。どの会社の数でもない。 */
    {
      const SEC0 = BANK.sections[0].code;
      const SAVED_T = lang === 'en' ? 'Saved' : '保存しました';
      const L_NUM = LISTED.find((q) => q.kind === 'num' && !q.currency && q.parent && !BY[q.parent].parent
        && BY[q.parent].kind === 'choice' && BY[q.parent].section === SEC0
        && q.parentWhen.some((c) => c !== BY[q.parent].choices[0].code));
      const L_P = L_NUM && BY[L_NUM.parent];
      const L_CODE = L_NUM && L_NUM.parentWhen.find((c) => c !== L_P.choices[0].code);
      const L_MULTI = LISTED.find((q) => q.kind === 'multi' && q.section === SEC0 && q.parent && !BY[q.parent].parent
        && BY[q.parent].kind === 'choice' && q.choices.length > 1);
      const L_CUR = LISTED.find((q) => q.kind === 'num' && q.currency && q.parent && !BY[q.parent].parent
        && BY[q.parent].kind === 'choice');
      const L_NOTE = LISTED.find((q) => q.note && q.kind === 'choice' && !q.parent && q.choices.length > 1);
      ok(!!L_NUM && !!L_CODE && !!L_MULTI && !!L_CUR && !!L_NOTE,
         'L 続きの質問（数）を持つ質問・「複数選ぶ」質問・通貨つきの額・補足つきの質問を、バンクから選べる',
         JSON.stringify([L_NUM, L_MULTI, L_CUR, L_NOTE].map((q) => q && q.id)));

      const optSel = (qid, code) => '[data-qid="' + qid + '"] .pvc-opt[data-code="' + code + '"]';
      /* フォーカスがその部品に乗るまで Tab を押す。押した回数を返す（届かなければ -1）。 */
      const tabTo = async (page, sel, cap = 400) => {
        for (let i = 0; i <= cap; i++) {
          if (await page.evaluate((sel) => { const a = document.activeElement; return !!(a && a.matches && a.matches(sel)); }, sel)) return i;
          await page.keyboard.press('Tab');
        }
        return -1;
      };
      /* 閉じて出る節は、見出しまで Tab で行って Enter で開く */
      const openSec = async (page, code) => {
        if (code === SEC0) return true;
        if (await tabTo(page, '.pvcf-sum:has([data-sec="' + code + '"])') < 0) return false;
        await page.keyboard.press('Enter');
        return page.waitForFunction((code) => document.querySelector('[data-sec="' + code + '"]').closest('details').open,
          { timeout: 8000 }, code).then(() => true, () => false);
      };
      const focusNow = (page) => page.evaluate(() => {
        const a = document.activeElement;
        const row = a && a.closest ? a.closest('[data-qid]') : null;
        const is = (s) => !!(a && a.matches && a.matches(s));
        return {
          tag: a ? a.tagName : '',
          qid: row ? row.getAttribute('data-qid') : '',
          kind: is('.pvcf-num') ? 'num' : is('[data-cur]') ? 'cur' : is('[data-num]') ? 'go' : is('[data-note]') ? 'note'
            : is('.pvc-opt[data-code]') ? 'opt' : '',
          code: is('.pvc-opt[data-code]') ? a.getAttribute('data-code') : null,
          picked: is('.is-picked'),
          pressed: a && a.getAttribute ? a.getAttribute('aria-pressed') : null,
          value: is('input,select,textarea') ? a.value : null,
          mine: !!(a && a.__mine),
          y: Math.round(window.scrollY)
        };
      });
      /* その行が作り直されるまで待つ。押す前に、いまの行へ印を置いておく（tagRow）── 作り直した行には印が無い。
         返すのは、作り直した行に出ている文（「保存しました」。保存を通らない道では空）。 */
      const tagRow = (page, qid) => page.evaluate((qid) => {
        const row = document.querySelector('[data-qid="' + qid + '"]');
        if (row) row.__old = true;      // 行が無い回（一覧が出ていない）は、下の redrawn が時間切れで赤にする
      }, qid);
      const redrawn = (page, qid) => page.waitForFunction((qid) => {
        const row = document.querySelector('[data-qid="' + qid + '"]');
        const s = row && !row.__old && row.querySelector('.pvcf-state');
        return s ? { said: s.textContent } : false;
      }, { timeout: 8000 }, qid).then((h) => h.jsonValue(), () => null);
      const heldOne = (page) => page.waitForFunction(() => window.__heldN() === 1, { timeout: 8000 }).then(() => true, () => false);
      const sentN = (page) => page.evaluate(() => window.__rpc.filter((r) => r.name === 'submit_airline_conditions').length);

      if (L_NUM && L_CODE && L_MULTI && L_CUR && L_NOTE) {
        const leaks0 = LEAKS.length;
        /* d1・d2 ── 返事はすぐ返る（ふつうの回） */
        {
          const { page, errs } = await openFull({ lang, query: '?airline=ana' });
          await ready(page);
          const numSel = '[data-qid="' + L_NUM.id + '"] .pvcf-num';
          const n = await tabTo(page, optSel(L_P.id, L_CODE));
          const at = await focusNow(page);
          await tagRow(page, L_P.id);
          await page.keyboard.press('Space');
          let rd = await redrawn(page, L_P.id);
          let f = await focusNow(page);
          ok(n > 0 && !!rd && rd.said === SAVED_T && f.qid === L_P.id && f.kind === 'opt' && f.code === L_CODE
             && f.picked && f.pressed === 'true',
             `L ★d1 選択肢（${L_P.id}＝${L_CODE}）を Space で押す → 保存のあと、フォーカスは同じ行の同じ選択肢に在る（選ばれた形で）`,
             JSON.stringify({ tabs: n, rd, f }));
          ok(f.y === at.y, 'L    d1 画面は動かない', at.y + ' → ' + f.y);
          ok(await page.evaluate((id) => { const r = document.querySelector('[data-qid="' + id + '"]'); return !!r && !r.hidden; }, L_NUM.id),
             `L    d1 続きの質問（${L_NUM.id}）が下に出ている`);
          const AFTER = L_P.choices.slice(L_P.choices.findIndex((c) => c.code === L_CODE) + 1).map((c) => c.code);
          await page.keyboard.press('Tab');
          f = await focusNow(page);
          const more = await tabTo(page, numSel, AFTER.length + 3);
          ok((AFTER.length ? f.qid === L_P.id && f.code === AFTER[0] : f.qid !== L_P.id) && more >= 0,
             'L ★d1 次の Tab は続きから（同じ行の次の選択肢 → 出てきた質問の欄。行の頭へ戻らない）',
             JSON.stringify({ f, more }));

          const VAL = String(Math.min(L_NUM.num.max, (L_NUM.num.min || 0) + 5));
          await page.keyboard.type(VAL);
          await tagRow(page, L_NUM.id);
          await page.keyboard.press('Enter');
          rd = await redrawn(page, L_NUM.id);
          f = await focusNow(page);
          ok(!!rd && rd.said === SAVED_T && f.qid === L_NUM.id && f.kind === 'num' && f.value === VAL,
             `L ★d2 数の欄（${L_NUM.id}）で Enter → 保存のあと、フォーカスは同じ欄に在る（入れた数も残る）`, JSON.stringify({ rd, f }));

          await page.keyboard.press('Tab');
          let was = await focusNow(page);
          await tagRow(page, L_NUM.id);
          await page.keyboard.press('Enter');
          rd = await redrawn(page, L_NUM.id);
          f = await focusNow(page);
          ok(was.kind === 'go' && !!rd && rd.said === SAVED_T && f.qid === L_NUM.id && f.kind === 'go',
             'L ★d2 「入力する」を Enter で押す → 押したボタンに残る', JSON.stringify({ was, rd, f }));

          await page.keyboard.press('Tab');
          was = await focusNow(page);
          await tagRow(page, L_NUM.id);
          await page.keyboard.press('Space');
          rd = await redrawn(page, L_NUM.id);
          f = await focusNow(page);
          ok(was.kind === 'opt' && was.code === 'unknown' && !!rd && rd.said === SAVED_T
             && f.qid === L_NUM.id && f.kind === 'opt' && f.code === 'unknown' && f.picked,
             'L ★d2 「わからない」を Space で押す → 押したボタンに残る（選ばれた形で）', JSON.stringify({ was, rd, f }));
          ok(errs.length === 0, 'L    d1・d2 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* 「複数選ぶ」質問 ── 選ぶ（保存する）／もう1度押して全部外す（保存を通らずに、行だけ作り直す） */
        {
          const MP = BY[L_MULTI.parent];
          const M_CODE = L_MULTI.choices[1].code;
          const { page, errs } = await openFull({ lang, query: '?airline=ana', answers: [A(MP.id, inCode(L_MULTI))] });
          await ready(page);
          const n = await tabTo(page, optSel(L_MULTI.id, M_CODE));
          await tagRow(page, L_MULTI.id);
          await page.keyboard.press('Space');
          let rd = await redrawn(page, L_MULTI.id);
          let f = await focusNow(page);
          ok(n > 0 && !!rd && rd.said === SAVED_T && f.qid === L_MULTI.id && f.code === M_CODE && f.picked && f.pressed === 'true',
             `L ★「複数選ぶ」質問（${L_MULTI.id}）で1つ選ぶ → 同じ選択肢に残る（選ばれた形で）`, JSON.stringify({ tabs: n, rd, f }));
          await tagRow(page, L_MULTI.id);
          await page.keyboard.press('Space');
          rd = await redrawn(page, L_MULTI.id);
          f = await focusNow(page);
          ok(!!rd && rd.said === '' && f.qid === L_MULTI.id && f.code === M_CODE && !f.picked && f.pressed === 'false'
             && (await sentN(page)) === 1,
             'L ★もう1度押して全部外す（保存へは送らない）→ 同じ選択肢に残る（選ばれていない形で）', JSON.stringify({ rd, f }));
          ok(errs.length === 0, 'L    「複数選ぶ」質問: ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* d3 ── 返事を止めておき、そのあいだに次の行へ進む */
        {
          const { page, errs } = await openFull({ lang, query: '?airline=ana', hold: true });
          await ready(page);
          await tabTo(page, optSel(L_P.id, L_CODE));
          await tagRow(page, L_P.id);
          await page.keyboard.press('Space');
          const waiting = await heldOne(page);
          const n = await tabTo(page, '[data-qid]:not([data-qid="' + L_P.id + '"]) *', 12);
          await page.evaluate(() => { document.activeElement.__mine = true; });
          const was = await focusNow(page);
          await page.evaluate(() => window.__letGo());
          const rd = await redrawn(page, L_P.id);
          const f = await focusNow(page);
          const picked = await page.evaluate((s) => { const b = document.querySelector(s); return !!b && b.classList.contains('is-picked'); },
            optSel(L_P.id, L_CODE));
          ok(waiting && n > 0 && !!was.qid && was.qid !== L_P.id && !!rd && rd.said === SAVED_T && picked,
             `L d3 返事を待つあいだに次の行（${was.qid}）へ進む → 返事が来て、押した行だけが作り直される`,
             JSON.stringify({ waiting, tabs: n, was, rd, picked }));
          ok(f.mine && f.qid === was.qid && f.kind === was.kind && f.code === was.code,
             'L ★d3 進んだ先のフォーカスは動かさない（作り直した行へ奪わない）', JSON.stringify({ was, f }));
          ok(errs.length === 0, 'L    d3 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* 返事を待つあいだに、フォーカスは押した選択肢に置いたまま、画面だけ先へ送った人
           ── 返事が来たら、フォーカスは同じ選択肢へ戻す。画面は、押した行へ引き戻さない。
           ★上の「d1 画面は動かない」は、戻す先がもう見えているので、戻し方が何であっても動かない。
             ここは戻す先を画面の外へ出してから返事を返す ＝ 画面を動かす戻し方なら、ここで見える所へ引き戻される。
           ⚠️ 画面を送るのは window.scrollTo（その場で着く）。キーや車輪で送ると動きが残り、位置を読む時が決まらない。
           ⚠️ 見るのは scrollY ではなく「戻した先が画面の外のままか」。続きの質問が出て上の高さが変わると、
              ブラウザが見えている所を保つために scrollY を足す（画面は動いていないのに数だけ変わる）。 */
        {
          const sel = optSel(L_P.id, L_CODE);
          const { page, errs } = await openFull({ lang, query: '?airline=ana', hold: true, vp: { width: 1280, height: 500 } });
          await ready(page);
          const n = await tabTo(page, sel);
          await tagRow(page, L_P.id);
          await page.keyboard.press('Space');
          const waiting = await heldOne(page);
          const away = await page.evaluate((sel) => {
            const out = () => { const b = document.querySelector(sel).getBoundingClientRect(); return b.bottom < 0 || b.top > window.innerHeight; };
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
            if (!out()) window.scrollTo({ top: 0, behavior: 'instant' });
            return { y: Math.round(window.scrollY), out: out() };
          }, sel);
          await page.evaluate(() => window.__letGo());
          const rd = await redrawn(page, L_P.id);
          const f = await focusNow(page);
          const still = await page.evaluate(() => {
            const b = document.activeElement.getBoundingClientRect();
            return { out: b.bottom < 0 || b.top > window.innerHeight, top: Math.round(b.top), h: window.innerHeight };
          });
          ok(n > 0 && waiting && away.out && !!rd && rd.said === SAVED_T && f.qid === L_P.id && f.code === L_CODE && f.picked && still.out,
             'L ★返事を待つあいだに画面を先へ送った人 → フォーカスは押した選択肢へ戻すが、画面は押した行へ引き戻さない',
             JSON.stringify({ tabs: n, waiting, away, rd, f, still }));
          ok(errs.length === 0, 'L    画面を先へ送った人: ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* 同じ行の中で進んだ人 ── 額の欄で Enter → 返事を待つあいだに通貨の欄へ
           ★並びは 通貨 → 額（2026-10-12 に、会社ページの上の面と同じ順にした）。通貨を字で選び、Tab で額の欄へ進んで
             Enter。返事を待つあいだに、Shift+Tab で1つ前の通貨の欄へ戻る。 */
        {
          const UP = BY[L_CUR.parent];
          const row = '[data-qid="' + L_CUR.id + '"]';
          const { page, errs } = await openFull({ lang, query: '?airline=ana', answers: [A(UP.id, inCode(L_CUR))], hold: true });
          await ready(page);
          const opened = await openSec(page, L_CUR.section);
          const n = await tabTo(page, row + ' [data-cur]');
          await page.keyboard.type('USD');
          const chose = await focusNow(page);
          await page.keyboard.press('Tab');
          const amount = await focusNow(page);
          await page.keyboard.type('1500');
          await tagRow(page, L_CUR.id);
          await page.keyboard.press('Enter');
          const waiting = await heldOne(page);
          await page.keyboard.down('Shift');
          await page.keyboard.press('Tab');
          await page.keyboard.up('Shift');
          const was = await focusNow(page);
          await page.evaluate(() => { document.activeElement.__mine = true; window.__letGo(); });
          const rd = await redrawn(page, L_CUR.id);
          const f = await focusNow(page);
          ok(opened && n > 0 && chose.kind === 'cur' && chose.value === 'USD' && amount.kind === 'num' && amount.qid === L_CUR.id && waiting && was.kind === 'cur'
             && !!rd && rd.said === SAVED_T && f.qid === L_CUR.id && f.kind === 'cur' && f.value === 'USD' && !f.mine,
             `L ★額の欄（${L_CUR.id}）で Enter → 返事を待つあいだに通貨の欄へ進んだ人は、作り直した行の通貨の欄に残る（選んだ通貨のまま）`,
             JSON.stringify({ opened, tabs: n, chose, amount, waiting, was, rd, f }));
          ok(errs.length === 0, 'L    通貨の欄: ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* 同じ行の中で進んだ人 ── 選択肢を押す → 返事を待つあいだに補足の欄へ */
        {
          const N_CODE = L_NOTE.choices[1].code;
          const { page, errs } = await openFull({ lang, query: '?airline=ana', hold: true });
          await ready(page);
          const opened = await openSec(page, L_NOTE.section);
          const n = await tabTo(page, optSel(L_NOTE.id, N_CODE));
          await tagRow(page, L_NOTE.id);
          await page.keyboard.press('Space');
          const waiting = await heldOne(page);
          const more = await tabTo(page, '[data-qid="' + L_NOTE.id + '"] [data-note]', L_NOTE.choices.length + 2);
          await page.evaluate(() => window.__letGo());
          const rd = await redrawn(page, L_NOTE.id);
          const f = await focusNow(page);
          ok(opened && n > 0 && waiting && more > 0 && !!rd && rd.said === SAVED_T && f.qid === L_NOTE.id && f.kind === 'note',
             `L ★選択肢（${L_NOTE.id}）を押す → 返事を待つあいだに補足の欄へ進んだ人は、作り直した行の補足の欄に残る`,
             JSON.stringify({ opened, tabs: n, waiting, more, rd, f }));
          ok(errs.length === 0, 'L    補足の欄: ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }
        ok(LEAKS.length === leaks0, 'L    どの場面も、本物のサーバへ向かう要求を1本も出していない（答えたのは全部この検査の偽物）',
           LEAKS.slice(leaks0).join(' | '));
      }
    }

    /* M. 対になる額（低いほう・高いほう）── 食い違う2つを保存しない・直せなくしない（2026-10-12）
          ★この画面は1回に1問ぶんしか送らず、2つの額を比べる所がどこにも無かった ＝「低いほう 300／高いほう 200」も
            「USD／EUR」も、黙って保存できていた。サーバが相手の保存した額と比べて断るようになると、今度は
            2つとも直したい人（100／200 → 300／400）が、どちらの端から送っても断られて直せなくなる。
          見ること（100／200 USD を保存してある人。期待する文は、ここに書いたもの ── 製品の文言の表を読まない）:
            p1 低いほうを 300 にして押す → その行に「低いほうの額が…」。1本も送らない。額の欄へ運ぶ
            p2 低いほうの通貨を変えて押す → 「…同じ通貨で…」（★大小より先に通貨）。1本も送らない。通貨の欄へ運ぶ
            p3 高いほうの行に 400 を打ち（押さない）、低いほうを 300 にして押す → 2問ぶんを1回で送る。2行とも
               保存した額と「保存しました」。答えた数は変わらない。フォーカスは押した行の押したボタンに残る
               （★この1本はキーボードだけで歩く ── Tab・Enter。押した行でない行も描き直される最初の場面）
               相手の行に通貨が無いあいだは、打ってあるだけの額を当てにしない（断って、送らない）
            p4 2行とも通貨を EUR に変えて片方を押す → 2問ぶんを1回で、どちらも EUR
            p5 低いほうを 150 にして押す → 1問ぶんだけを送る
            p6 サーバが断った理由 range_order ／ range_currency → その2つの文。ほかの理由 → 「保存できませんでした」
            p7 2問ぶんの送信で、片方だけ保存・片方は断られた返事 → 行ごとに、その行の結果を出す
               2つとも断られた返事 → 2行とも断りで、どちらも「保存しました」と出さない。打った額は残り、送り直せる
               数が合わない返事（保存した数が足りず、断った答えは無い）→ どの行にも「保存しました」と出さない
            p8 片方が「わからない」→ 比べない（「わからない」を押すのも、相手が「わからない」の人が額を入れるのも、1問ぶん）
            p9 低いほう 200／高いほう 1000 → 保存できる（字のまま比べると 200 は 1000 より大きい）
            q1 断りが出たあとで相手の額を保存し直したら、前の額との食い違いの文は消える（打った額は残り、押せば保存できる）
            q2 2問ぶんを送って返事を待つあいだは、その2行から重ねて送らない。返事が来たあとは、また送れる
          ⚠️ この節の偽物は2つの額を比べない（openFull の judge）。比べているのは画面。
             本物のサーバが断る所は、assert-contrib.mjs の最後の場面が見る。
          ⚠️ 下で入れる額は検査のための作りもの。どの会社の額でもない。 */
    {
      const P_HI = LISTED.find((q) => q.rangeLow && has(q.rangeLow));
      const P_LO = P_HI && BY[P_HI.rangeLow];
      const P_UP = P_HI && BY[P_HI.parent];
      const pairOk = !!P_HI && !!P_LO && !!P_UP && P_LO.parent === P_UP.id && !!P_HI.currency && !!P_LO.currency
        && P_HI.section === P_LO.section && P_HI.kind === 'num' && P_LO.kind === 'num';
      ok(pairOk, 'M 低いほう・高いほうの対（rangeLow）を、バンクから選べる（無くなったら、この節が黙って空振りになる）',
         JSON.stringify([P_LO, P_HI, P_UP].map((q) => q && q.id)));
      if (pairOk) {
        const ORDER_T = lang === 'en' ? 'The lowest amount is larger than the highest amount.' : '低いほうの額が、高いほうの額より大きくなっています。';
        const CUR_T = lang === 'en' ? 'Use the same currency for the lowest and the highest amount.' : '低いほうと高いほうは、同じ通貨で入れてください。';
        const FAIL_T = lang === 'en' ? 'Could not save' : '保存できませんでした';
        const SAVED_T = lang === 'en' ? 'Saved' : '保存しました';
        const LO = P_LO.id, HI = P_HI.id;
        const leaks0 = LEAKS.length;
        const N = (id, num, cur) => ({ question_id: id, code: null, codes: null, num: num, currency: cur, text: null });
        /* 保存してある答え（親 ＝ 続きの2問が出る答え・低いほう・高いほう）。答えた数は 3 */
        const STORED = (lo = [100, 'USD'], hi = [200, 'USD']) => [A(P_UP.id, inCode(P_HI)), N(LO, ...lo), N(HI, ...hi)];
        const COUNT0 = '3/' + N_Q;
        const row = (qid) => '[data-qid="' + qid + '"]';
        const openPair = async (answers, opt = {}) => {
          const r = await openFull({ lang, query: '?airline=ana', answers, judge: true, ...opt });
          await ready(r.page);
          /* 対の在る節は閉じて出る。開けるのは見たい所ではないので、ここで開けておく（p3 だけはキーボードで開ける） */
          if (!opt.shut) await r.page.evaluate((sec) => { document.querySelector('[data-sec="' + sec + '"]').closest('details').open = true; }, P_HI.section);
          return r;
        };
        /* 額の欄を選んでから打つ ＝ 前の額を打ち直す */
        const type = async (page, qid, text) => {
          await page.focus(row(qid) + ' .pvcf-num');
          await page.evaluate((s) => document.querySelector(s).select(), row(qid) + ' .pvcf-num');
          await page.keyboard.type(String(text));
        };
        const pick = (page, qid, cur) => page.select(row(qid) + ' [data-cur]', cur);
        /* 押す前に、押す物を画面のまんなかへ送る。上に貼り付いたヘッダーの下に入ったボタンは、ブラウザから見れば
           「見えている」ので、そのまま押すとヘッダーの部品（言語の切替）を押してしまう。 */
        const tap = async (page, sel) => {
          await page.$eval(sel, (b) => b.scrollIntoView({ block: 'center' }));
          await page.click(sel);
        };
        const pressGo = (page, qid) => tap(page, row(qid) + ' [data-num]');
        /* 送った呼び出しの一覧。1本ぶん ＝「鍵=額 通貨」を鍵の順に「 + 」でつないだ字 */
        const calls = (page) => page.evaluate(() => window.__rpc.filter((r) => r.name === 'submit_airline_conditions')
          .map((r) => r.args.p.answers.map((a) => a.question_id + '=' + (a.code || a.num) + (a.currency ? ' ' + a.currency : '')).sort().join(' + ')));
        const one = (qid, num, cur) => qid + '=' + num + ' ' + cur;
        const two = (lo, hi) => [one(LO, ...lo), one(HI, ...hi)].sort().join(' + ');
        /* 画面が n 本めの返事を読み終わるまで待つ（時間では待たない） */
        const seen = (page, n) => page.waitForFunction((n) => (window.__seen || 0) >= n, { timeout: 8000 }, n).then(() => true, () => false);
        const refuse = (page, table) => page.evaluate((t) => { window.__refuse = t; }, table);
        const tag = (page) => page.evaluate(() => { Array.prototype.forEach.call(document.querySelectorAll('[data-qid]'), (r) => { r.__old = true; }); });
        const at = (page, qid) => page.evaluate((qid) => {
          const r = document.querySelector('[data-qid="' + qid + '"]');
          const n = r.querySelector('.pvcf-num'), c = r.querySelector('[data-cur]'), s = r.querySelector('.pvcf-state');
          const a = document.activeElement, is = (x) => !!(a && a.matches && a.matches(x));
          return {
            num: n.value, cur: c ? c.value : null, said: s.textContent, bad: s.classList.contains('is-bad'),
            unk: r.querySelector('.pvc-opt[data-code="unknown"]').classList.contains('is-picked'),
            fresh: !r.__old,
            focus: r.contains(a) ? (is('.pvcf-num') ? 'num' : is('[data-cur]') ? 'cur' : is('[data-num]') ? 'go' : is('.pvc-opt[data-code]') ? 'opt' : '?') : ''
          };
        }, qid);
        const count = async (page) => (await look(page)).count;

        /* p1・p2・p5・p9 ── 1枚の画面で続けて */
        {
          const { page, errs } = await openPair(STORED());
          ok((await count(page)) === COUNT0 && (await at(page, LO)).num === '100' && (await at(page, HI)).cur === 'USD',
             `M    下ごしらえ: 低いほう 100 USD／高いほう 200 USD を保存してある人の画面（答えた数 ${COUNT0}）`, JSON.stringify([await at(page, LO), await at(page, HI)]));
          await type(page, LO, 300);
          await pressGo(page, LO);
          let lo = await at(page, LO), hi = await at(page, HI);
          ok(lo.said === ORDER_T && lo.bad && (await calls(page)).length === 0,
             `M ★p1 低いほうを 300 にして押す → その行に「${ORDER_T}」。サーバへ1本も送らない`, JSON.stringify({ lo, calls: await calls(page) }));
          ok(lo.focus === 'num' && lo.num === '300' && hi.said === '' && hi.num === '200',
             'M    p1 フォーカスは低いほうの額の欄へ。打った 300 は残る。高いほうの行には何も書かない', JSON.stringify({ lo, hi }));

          await pick(page, LO, 'EUR');
          await pressGo(page, LO);
          lo = await at(page, LO);
          ok(lo.said === CUR_T && lo.bad && (await calls(page)).length === 0,
             `M ★p2 低いほうの通貨を EUR に変えて押す（額は 300 のまま）→ 「${CUR_T}」（大小より先に通貨）。1本も送らない`,
             JSON.stringify({ lo, calls: await calls(page) }));
          ok(lo.focus === 'cur' && lo.cur === 'EUR', 'M    p2 フォーカスは低いほうの通貨の欄へ', JSON.stringify(lo));

          await pick(page, LO, 'USD');
          await type(page, LO, 150);
          await tag(page);
          await pressGo(page, LO);
          let got = await seen(page, 1);
          lo = await at(page, LO); hi = await at(page, HI);
          let sent = await calls(page);
          ok(got && sent.length === 1 && sent[0] === one(LO, 150, 'USD'),
             'M ★p5 低いほうを 150 にして押す（高いほう 200 と合っている）→ 1問ぶんだけを1回送る', JSON.stringify(sent));
          ok(lo.said === SAVED_T && !lo.bad && lo.fresh && lo.num === '150' && !hi.fresh && hi.said === '' && (await count(page)) === COUNT0,
             'M    p5 低いほうの行に「保存しました」。高いほうの行は触らない。答えた数は変わらない', JSON.stringify({ lo, hi }));

          await type(page, HI, 1000);
          await pressGo(page, HI);
          got = await seen(page, 2);
          await type(page, LO, 200);
          await pressGo(page, LO);
          got = got && await seen(page, 3);
          lo = await at(page, LO); hi = await at(page, HI);
          sent = await calls(page);
          ok(got && sent.length === 3 && sent[1] === one(HI, 1000, 'USD') && sent[2] === one(LO, 200, 'USD')
             && lo.said === SAVED_T && hi.said === SAVED_T && lo.num === '200' && hi.num === '1000',
             'M ★p9 高いほうを 1000、低いほうを 200 に → どちらも保存できる（字のまま比べると、200 は 1000 より大きい）',
             JSON.stringify({ sent, lo, hi }));
          ok(errs.length === 0, 'M    p1・p2・p5・p9 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* p3 ── キーボードだけ（Tab・Shift+Tab・Enter）。節も見出しで Enter を押して開ける */
        {
          const { page, errs } = await openPair(STORED(), { shut: true });
          const onIt = (sel) => page.evaluate((sel) => { const a = document.activeElement; return !!(a && a.matches && a.matches(sel)); }, sel);
          const tabTo = async (sel, cap, back) => {
            for (let i = 0; i <= cap; i++) {
              if (await onIt(sel)) return i;
              if (back) await page.keyboard.down('Shift');
              await page.keyboard.press('Tab');
              if (back) await page.keyboard.up('Shift');
            }
            return -1;
          };
          /* 欄の中身をキーだけで空にしてから打つ（Tab で入った欄は中身が選ばれているが、それを当てにしない） */
          const retype = async (text) => {
            for (let i = 0; i < 8; i++) await page.keyboard.press('Backspace');
            for (let i = 0; i < 8; i++) await page.keyboard.press('Delete');
            await page.keyboard.type(String(text));
          };
          const t0 = await tabTo('.pvcf-sum:has([data-sec="' + P_HI.section + '"])', 400);
          await page.keyboard.press('Enter');
          const opened = await page.waitForFunction((sec) => document.querySelector('[data-sec="' + sec + '"]').closest('details').open,
            { timeout: 8000 }, P_HI.section).then(() => true, () => false);
          const t1 = await tabTo(row(HI) + ' .pvcf-num', 400);
          await retype(400);
          const t2 = await tabTo(row(LO) + ' .pvcf-num', 12, true);
          await retype(300);
          const t3 = await tabTo(row(LO) + ' [data-num]', 4);
          const before = { lo: await at(page, LO), hi: await at(page, HI), count: await count(page) };
          await tag(page);
          await page.keyboard.press('Enter');
          const got = await seen(page, 1);
          const lo = await at(page, LO), hi = await at(page, HI), sent = await calls(page);
          ok(t0 >= 0 && opened && t1 > 0 && t2 > 0 && t3 > 0 && before.lo.num === '300' && before.hi.num === '400' && before.lo.focus === 'go',
             'M    p3 キーボードだけで、高いほうの行に 400 を打ち（押さない）、低いほうを 300 にして「入力する」へ', JSON.stringify({ t0, opened, t1, t2, t3, before }));
          ok(got && sent.length === 1 && sent[0] === two([300, 'USD'], [400, 'USD']),
             'M ★p3 低いほうの「入力する」を Enter で押す → 2問ぶん（300 と 400）を1回で送る', JSON.stringify(sent));
          ok(lo.said === SAVED_T && hi.said === SAVED_T && !lo.bad && !hi.bad && lo.fresh && hi.fresh && lo.num === '300' && hi.num === '400'
             && lo.cur === 'USD' && hi.cur === 'USD',
             'M ★p3 2行とも描き直され、保存した額と「保存しました」が出る', JSON.stringify({ lo, hi }));
          ok((await count(page)) === before.count && before.count === COUNT0, 'M    p3 答えた数は変わらない（2問とも、前から答えていた）', before.count + ' → ' + (await count(page)));
          ok(lo.focus === 'go' && hi.focus === '',
             'M ★p3 フォーカスは、押した行（低いほう）の押したボタンに残る（あとから描き直した相手の行へ移らない・ページへ落ちない）',
             JSON.stringify({ lo: lo.focus, hi: hi.focus }));
          ok(errs.length === 0, 'M    p3 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* p4 ── 2行とも通貨を変える */
        {
          const { page, errs } = await openPair(STORED());
          await pick(page, LO, 'EUR');
          await pick(page, HI, 'EUR');
          await tag(page);
          await pressGo(page, HI);
          const got = await seen(page, 1);
          const lo = await at(page, LO), hi = await at(page, HI), sent = await calls(page);
          ok(got && sent.length === 1 && sent[0] === two([100, 'EUR'], [200, 'EUR']),
             'M ★p4 2行とも通貨を EUR に変えて、高いほうを押す → 2問ぶんを1回で、どちらも EUR', JSON.stringify(sent));
          ok(lo.said === SAVED_T && hi.said === SAVED_T && lo.cur === 'EUR' && hi.cur === 'EUR' && lo.fresh && hi.fresh && hi.focus === 'go',
             'M    p4 2行とも「保存しました」・通貨は EUR。フォーカスは押した行に残る', JSON.stringify({ lo, hi }));
          ok(errs.length === 0, 'M    p4 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* p6 ── サーバが断った理由を、その行に書く（画面の確かめは通る額。断るのは偽物のサーバ） */
        {
          const { page, errs } = await openPair(STORED());
          await type(page, LO, 150);
          const said = [];
          for (const [i, why] of ['range_order', 'range_currency', 'out_of_range'].entries()) {
            await refuse(page, { [LO]: why });
            await tag(page);
            await pressGo(page, LO);
            const got = await seen(page, i + 1);
            said.push({ why, got, ...(await at(page, LO)) });
          }
          const sent = await calls(page);
          ok(sent.length === 3 && sent.every((s) => s === one(LO, 150, 'USD')) && said.every((s) => s.got && s.bad && !s.fresh && s.num === '150'),
             'M    p6 3回とも1問ぶんを送り、3回とも断られた（行は描き直さない・打った 150 は残る）', JSON.stringify({ sent, said }));
          ok(said[0].said === ORDER_T, `M ★p6 理由 range_order → 「${ORDER_T}」（「保存できませんでした」ではない）`, said[0].said);
          ok(said[1].said === CUR_T, `M ★p6 理由 range_currency → 「${CUR_T}」`, said[1].said);
          ok(said[2].said === FAIL_T, `M ★p6 ほかの理由（out_of_range）→ 今までどおり「${FAIL_T}」`, said[2].said);
          ok((await count(page)) === COUNT0, 'M    p6 答えた数は変わらない', await count(page));
          await refuse(page, {});
          await pressGo(page, LO);
          const got = await seen(page, 4);
          const lo = await at(page, LO);
          ok(got && lo.said === SAVED_T && !lo.bad && lo.fresh, 'M    p6 断られなくなったら、同じ額のまま押して保存できる', JSON.stringify(lo));
          ok(errs.length === 0, 'M    p6 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* p7 ── 2問ぶんの送信への返事を、行ごとに読む */
        {
          const { page, errs } = await openPair(STORED());
          await pick(page, HI, '');
          await type(page, HI, 400);
          await type(page, LO, 300);
          await pressGo(page, LO);
          let lo = await at(page, LO), hi = await at(page, HI);
          ok(lo.said === ORDER_T && lo.bad && (await calls(page)).length === 0 && hi.said === '',
             'M ★p3 相手の行に 400 と打ってあっても、通貨が選ばれていないあいだは当てにしない → 断って、1本も送らない', JSON.stringify({ lo, hi }));

          await pick(page, HI, 'USD');
          await refuse(page, { [HI]: 'out_of_range' });
          await tag(page);
          await pressGo(page, LO);
          let got = await seen(page, 1);
          lo = await at(page, LO); hi = await at(page, HI);
          let sent = await calls(page);
          ok(got && sent.length === 1 && sent[0] === two([300, 'USD'], [400, 'USD']), 'M    p7 2問ぶんを1回で送った', JSON.stringify(sent));
          ok(lo.said === SAVED_T && !lo.bad && lo.fresh && lo.num === '300',
             'M ★p7 片方だけ保存された返事 → 保存された行（低いほう）には「保存しました」', JSON.stringify(lo));
          ok(hi.said === FAIL_T && hi.bad && !hi.fresh && hi.num === '400',
             `M ★p7 断られた行（高いほう）には「${FAIL_T}」。保存したとは出さない。打った 400 は残る`, JSON.stringify(hi));

          await refuse(page, { [LO]: 'rate_limited', [HI]: 'rate_limited' });
          await tag(page);
          await pressGo(page, LO);
          got = await seen(page, 2);
          lo = await at(page, LO); hi = await at(page, HI);
          sent = await calls(page);
          ok(got && sent.length === 2 && sent[1] === two([300, 'USD'], [400, 'USD'])
             && lo.said === FAIL_T && hi.said === FAIL_T && lo.bad && hi.bad && !lo.fresh && !hi.fresh && lo.num === '300' && hi.num === '400',
             `M ★p7 2つとも断られた返事 → 2行とも「${FAIL_T}」。どちらも「保存しました」と出さない。打った額は残る`, JSON.stringify({ sent, lo, hi }));

          await refuse(page, { [LO]: 'range_order', [HI]: 'out_of_range' });
          await pressGo(page, LO);
          got = await seen(page, 3);
          lo = await at(page, LO); hi = await at(page, HI);
          ok(got && lo.said === ORDER_T && hi.said === FAIL_T && lo.bad && hi.bad,
             'M ★p7 2つとも断られ、理由が行ごとに違う返事 → 行ごとに、その行の理由の文', JSON.stringify({ lo, hi }));

          await refuse(page, {});
          await tag(page);
          await pressGo(page, LO);
          got = await seen(page, 4);
          lo = await at(page, LO); hi = await at(page, HI);
          ok(got && lo.said === SAVED_T && hi.said === SAVED_T && lo.fresh && hi.fresh && lo.num === '300' && hi.num === '400',
             'M    p7 断られなくなったら、同じ額のまま押して2つとも保存できる（直せなくならない）', JSON.stringify({ lo, hi }));
          ok(errs.length === 0, 'M    p7 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* p7（続き）── 数が合わない返事。保存した数（saved）が「送った数 − 断った数」に足りず、どれが保存されなかったかは
           返事のどこにも無い。画面は、どの行にも「保存しました」と出さない（保存されたか分からない額に、保存したと言わない）。
           ★本物のサーバは、保存しなかった答えを必ず断った一覧に入れる ＝ いまはこの返事を返さない。ここは、返事の形が
             変わった日のための網。外すと、保存されていない額に「保存しました」が付く（外しても、ほかの行は赤くならなかった）。 */
        {
          const { page, errs } = await openPair(STORED());
          const short = (n) => page.evaluate((n) => { window.__short = n; }, n);
          await short(1);
          await type(page, LO, 150);
          await tag(page);
          await pressGo(page, LO);
          let got = await seen(page, 1);
          let lo = await at(page, LO), hi = await at(page, HI), sent = await calls(page);
          ok(got && sent.length === 1 && sent[0] === one(LO, 150, 'USD') && lo.said === FAIL_T && lo.bad && !lo.fresh && lo.num === '150'
             && hi.said === '' && (await count(page)) === COUNT0,
             `M ★p7 1問ぶんを送り、返事が「保存した数 0・断った答えなし」→ 「${FAIL_T}」（「保存しました」と出さない）。打った 150 は残る`,
             JSON.stringify({ sent, lo, hi }));
          await type(page, HI, 400);
          await type(page, LO, 300);
          await tag(page);
          await pressGo(page, LO);
          got = await seen(page, 2);
          lo = await at(page, LO); hi = await at(page, HI); sent = await calls(page);
          ok(got && sent.length === 2 && sent[1] === two([300, 'USD'], [400, 'USD']) && lo.said === FAIL_T && hi.said === FAIL_T && lo.bad && hi.bad
             && !lo.fresh && !hi.fresh && lo.num === '300' && hi.num === '400',
             `M ★p7 2問ぶんを送り、返事が「保存した数 1・断った答えなし」→ どちらが保存されたか分からない ＝ 2行とも「${FAIL_T}」。どちらも「保存しました」と出さない`,
             JSON.stringify({ sent, lo, hi }));
          await short(0);
          await tag(page);
          await pressGo(page, LO);
          got = await seen(page, 3);
          lo = await at(page, LO); hi = await at(page, HI);
          ok(got && lo.said === SAVED_T && hi.said === SAVED_T && lo.fresh && hi.fresh && lo.num === '300' && hi.num === '400',
             'M    p7 数の合う返事に戻ったら、同じ額のまま押して2つとも保存できる', JSON.stringify({ lo, hi }));
          ok(errs.length === 0, 'M    p7（数が合わない返事）ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* p8 ── 片方が「わからない」 */
        {
          const { page, errs } = await openPair(STORED());
          await tag(page);
          await tap(page, row(HI) + ' .pvc-opt[data-code="unknown"]');
          let got = await seen(page, 1);
          let hi = await at(page, HI), sent = await calls(page);
          ok(got && sent.length === 1 && sent[0] === HI + '=unknown' && hi.unk && hi.said === SAVED_T && hi.fresh,
             'M ★p8 高いほうの「わからない」を押す → 今までどおり1問ぶんを送る（比べない）', JSON.stringify({ sent, hi }));
          await type(page, LO, 300);
          await pressGo(page, LO);
          got = await seen(page, 2);
          const lo = await at(page, LO);
          sent = await calls(page);
          ok(got && sent.length === 2 && sent[1] === one(LO, 300, 'USD') && lo.said === SAVED_T && !lo.bad,
             'M ★p8 相手が「わからない」の人が、低いほうを 300 にして押す → 保存できる（「わからない」を 0 と読まない）', JSON.stringify({ sent, lo }));
          ok(errs.length === 0, 'M    p8 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* q1 ── 断りが出たあとで、相手の額を保存し直す */
        {
          const { page, errs } = await openPair(STORED());
          await type(page, LO, 300);
          await pressGo(page, LO);
          const refused = await at(page, LO);
          await type(page, HI, 400);
          await pressGo(page, HI);
          let got = await seen(page, 1);
          let lo = await at(page, LO), hi = await at(page, HI), sent = await calls(page);
          ok(refused.said === ORDER_T && got && sent.length === 1 && sent[0] === one(HI, 400, 'USD') && hi.said === SAVED_T,
             'M    q1 低いほう 300 が断られたあと、高いほうを 400 にして高いほうを押す → 高いほうの1問ぶんが保存される', JSON.stringify({ refused, sent, hi }));
          ok(lo.said === '' && !lo.bad && lo.num === '300',
             'M ★q1 低いほうの行の「低いほうの額が…」は消える（いま保存してある高いほうは 400）。打った 300 は残る', JSON.stringify(lo));
          await pressGo(page, LO);
          got = await seen(page, 2);
          lo = await at(page, LO);
          sent = await calls(page);
          ok(got && sent.length === 2 && sent[1] === one(LO, 300, 'USD') && lo.said === SAVED_T, 'M    q1 そのまま低いほうを押すと、保存できる', JSON.stringify({ sent, lo }));
          ok(errs.length === 0, 'M    q1 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* q2 ── 返事を止めておき、そのあいだに同じ2行をもう一度押す */
        {
          const { page, errs } = await openPair(STORED(), { hold: true });
          const heldN = (n) => page.waitForFunction((n) => window.__heldN() === n, { timeout: 8000 }, n).then(() => true, () => false);
          await type(page, HI, 400);
          await type(page, LO, 300);
          await tag(page);
          await pressGo(page, LO);
          const waiting = await heldN(1);
          await pressGo(page, HI);
          await pressGo(page, LO);
          const during = { held: await page.evaluate(() => window.__heldN()), sent: await calls(page) };
          ok(waiting && during.held === 1 && during.sent.length === 1 && during.sent[0] === two([300, 'USD'], [400, 'USD']),
             'M ★q2 2問ぶんの返事を待つあいだに、同じ2行の「入力する」をもう一度ずつ押す → 重ねて送らない（送ったのは1本）', JSON.stringify(during));
          await page.evaluate(() => window.__letGo());
          let got = await seen(page, 1);
          const lo = await at(page, LO), hi = await at(page, HI);
          ok(got && lo.said === SAVED_T && hi.said === SAVED_T && lo.fresh && hi.fresh, 'M    q2 返事が来て、2行とも「保存しました」', JSON.stringify({ lo, hi }));
          await pressGo(page, LO);
          const again = await heldN(1);
          const sent = await calls(page);
          await page.evaluate(() => window.__letGo());
          got = await seen(page, 2);
          ok(again && got && sent.length === 2 && sent[1] === one(LO, 300, 'USD'), 'M ★q2 返事が来たあとは、また送れる（止めたままにならない）', JSON.stringify(sent));
          ok(errs.length === 0, 'M    q2 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* N. 数の行の見た目と並び（2026-10-12）
              ★明るいテーマで、断りの文が 3.7:1・フォーカスの輪が 1.3:1（暗い地のための淡い金のまま）で、ほとんど見えなかった。
                断りの元になった欄には、何の印も無かった。
              ★並びが会社ページの上の面と逆（額 → 通貨）で、スマホの幅では単位「（1回あたり）」が額から離れて
                「入力する」の前へ落ちていた。高いほうの行は、低いほうで選んだ通貨をもう一度選ばせていた。
              見ること:
                k1 断りの文の色 ── その行の地に対して 4.5:1 以上（明るい・暗い）。?q= で運ばれて緑の板が敷かれた行は、
                   暗いテーマで 4.5:1 以上。明るいテーマは 4.37:1 で届いていない（下の行が、そのまま書いている ──
                   そこで見ているのは「前の色へ戻っていない」＝ 4.3 以上だけ）
                k2 フォーカスの輪 ── 額の欄・通貨の欄・選択肢・「入力する」。輪が描かれる地に対して 3:1 以上（明るい・暗い）
                k3 断りの元になった欄にだけ aria-invalid が付き、枠が断りの色（3:1 以上）になる。
                   その欄の値を変えると、印も文も消える。保存できたら消える。どの欄とも言えない断りは、印を付けない
                b1 部品の並びと Tab の順 ── 通貨 → 額 → 単位 → 「入力する」→「わからない」（通貨の無い質問は、額から）
                b2 幅 320〜1280 で、単位は額と同じ行・額のすぐ右。額の欄はつぶれない。ページは横に溢れない
                c1 低いほうを USD で保存してある人の、まだ答えていない高いほうの行は USD から始まる（保存はしない）。
                   額を入れて押すと USD で送る。2問とも答えていない人が低いほうを保存すると、手つかずの高いほうの行が
                   その通貨になり、低いほうの通貨を保存し直すと付いていく
                c2 高いほうの行で本人が EUR を選んだあとで、低いほうを USD で保存しても、高いほうは EUR のまま
              ⚠️ 色は、ブラウザが計算した色（getComputedStyle）を読み、ここで重ねて比べる。製品の CSS の字は読まない。 */
        const NEED_T = lang === 'en' ? 'Please choose a currency.' : '通貨を選んでください。';
        const rgba = (s) => {
          const m = String(s).match(/rgba?\(([^)]+)\)/);
          if (!m) return [0, 0, 0, 0];
          const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
          return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
        };
        /* 上の色を下の色に重ねる。stack は近いものから順（すぐ後ろ → … → ページ）。いちばん下は白（ブラウザの地） */
        const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
        const flat = (stack) => stack.reduceRight((under, c) => over(rgba(c), under), [255, 255, 255, 1]);
        const lum = (c) => {
          const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const ratio = (a, b) => { const x = lum(a), y = lum(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100; };
        /* その部品の色と、その後ろに在る色（色の変わり目の動きが終わるのを待ってから読む） */
        const paint = async (page, sel) => {
          await page.waitForFunction((sel) => { const e = document.querySelector(sel); return !!e && e.getAnimations().length === 0; }, { timeout: 8000 }, sel)
            .catch(() => {});
          return page.evaluate((sel) => {
            const el = document.querySelector(sel), cs = getComputedStyle(el), under = [];
            for (let n = el.parentElement; n; n = n.parentElement) {
              if (n.classList.contains('is-target')) under.push(getComputedStyle(n, '::before').backgroundColor);
              under.push(getComputedStyle(n).backgroundColor);
            }
            return {
              color: cs.color, own: cs.backgroundColor, under,
              ring: cs.outlineStyle === 'none' ? '' : cs.outlineColor, ringW: parseFloat(cs.outlineWidth) || 0,
              border: cs.borderTopColor, sameBorder: [cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor].every((c) => c === cs.borderTopColor),
              invalid: el.getAttribute('aria-invalid'), seenFocus: el.matches(':focus-visible'), theme: document.documentElement.getAttribute('data-theme')
            };
          }, sel);
        };
        const marks = (page, qid) => page.evaluate((qid) => {
          const r = document.querySelector('[data-qid="' + qid + '"]');
          return { num: r.querySelector('.pvcf-num').getAttribute('aria-invalid'), cur: r.querySelector('[data-cur]').getAttribute('aria-invalid') };
        }, qid);

        for (const theme of ['light', 'dark']) {
          /* k1・k3 ── 断りを出して、色と印を読む */
          {
            const { page, errs } = await openPair(STORED(), { theme });
            const tone = { num: await paint(page, row(LO) + ' .pvcf-num'), cur: await paint(page, row(LO) + ' [data-cur]') };
            await pick(page, LO, '');
            await pressGo(page, LO);
            let lo = await at(page, LO), mk = await marks(page, LO);
            let b = await paint(page, row(LO) + ' [data-cur]');
            let surface = flat(b.under), r1 = ratio(flat([b.border, ...b.under]), surface), r2 = ratio(flat([b.border, ...b.under]), flat([b.own, ...b.under]));
            ok(b.theme === theme && lo.said === NEED_T && lo.bad && mk.cur === 'true' && mk.num === null && lo.focus === 'cur',
               `N ★k3 ${theme}: 通貨を選ばずに押す → 通貨の欄にだけ aria-invalid が付く（文は「${NEED_T}」）`, JSON.stringify({ lo, mk, theme: b.theme }));
            ok(b.border !== tone.cur.border && b.sameBorder && r1 >= 3 && r2 >= 3,
               `N ★k3 ${theme}: その欄の枠が断りの色になる（外の地に対して ${r1}:1・欄の中の地に対して ${r2}:1 ── どちらも 3:1 以上）`, JSON.stringify({ was: tone.cur.border, now: b.border }));
            await pick(page, LO, 'USD');
            lo = await at(page, LO); mk = await marks(page, LO);
            b = await paint(page, row(LO) + ' [data-cur]');
            ok(mk.cur === null && mk.num === null && lo.said === '' && !lo.bad && b.border === tone.cur.border && (await calls(page)).length === 0,
               `N ★k3 ${theme}: 通貨を選ぶと、印も枠の色も文も消える（まだ何も送っていない）`, JSON.stringify({ lo, mk, border: b.border }));

            await type(page, LO, 300);
            await pressGo(page, LO);
            lo = await at(page, LO); mk = await marks(page, LO);
            b = await paint(page, row(LO) + ' .pvcf-num');
            surface = flat(b.under); r1 = ratio(flat([b.border, ...b.under]), surface); r2 = ratio(flat([b.border, ...b.under]), flat([b.own, ...b.under]));
            const t = await paint(page, row(LO) + ' .pvcf-state');
            const rt = ratio(rgba(t.color), flat([t.own, ...t.under]));
            ok(lo.said === ORDER_T && rt >= 4.5,
               `N ★k1 ${theme}: 断りの文の色は、その行の地に対して ${rt}:1（4.5:1 以上）`, JSON.stringify({ color: t.color, under: t.under.filter((c) => rgba(c)[3] > 0) }));
            ok(mk.num === 'true' && mk.cur === null && b.border !== tone.num.border && r1 >= 3 && r2 >= 3,
               `N ★k3 ${theme}: 大小の断り → 額の欄にだけ印が付き、枠が断りの色（${r1}:1・${r2}:1）`, JSON.stringify({ mk, was: tone.num.border, now: b.border }));
            await page.focus(row(LO) + ' .pvcf-num');
            await page.keyboard.press('Backspace');
            lo = await at(page, LO); mk = await marks(page, LO);
            b = await paint(page, row(LO) + ' .pvcf-num');
            ok(lo.num === '30' && mk.num === null && lo.said === '' && !lo.bad && b.border === tone.num.border,
               `N ★k3 ${theme}: 額を1字でも直すと、印も枠の色も文も消える`, JSON.stringify({ lo, mk, border: b.border }));

            await type(page, LO, 300);
            await pick(page, LO, 'EUR');
            await pressGo(page, LO);
            mk = await marks(page, LO);
            lo = await at(page, LO);
            ok(lo.said === CUR_T && mk.cur === 'true' && mk.num === null, `N    k3 ${theme}: 通貨の違いの断り → 通貨の欄にだけ印が付く`, JSON.stringify({ lo, mk }));
            await type(page, LO, 301);
            mk = await marks(page, LO);
            lo = await at(page, LO);
            ok(lo.said === CUR_T && mk.cur === 'true', `N    k3 ${theme}: 断りの元でない欄（額）を直しても、通貨の欄の印と文は残る`, JSON.stringify({ lo, mk }));

            /* サーバが断った回（偽物）── 理由が大小なら額の欄。どの欄とも言えない理由なら、印は付けない */
            await pick(page, LO, 'USD');
            await type(page, LO, 150);
            await refuse(page, { [LO]: 'range_order' });
            await pressGo(page, LO);
            let got = await seen(page, 1);
            mk = await marks(page, LO);
            ok(got && mk.num === 'true' && mk.cur === null, `N    k3 ${theme}: サーバが range_order で断った → 額の欄に印`, JSON.stringify(mk));
            await refuse(page, { [LO]: 'out_of_range' });
            await pressGo(page, LO);
            got = await seen(page, 2);
            mk = await marks(page, LO);
            lo = await at(page, LO);
            ok(got && lo.said === FAIL_T && mk.num === null && mk.cur === null, `N    k3 ${theme}: 「${FAIL_T}」（どの欄とも言えない断り）は、どの欄にも印を付けない`, JSON.stringify({ lo, mk }));
            await refuse(page, { [LO]: 'range_currency' });
            await pressGo(page, LO);
            got = await seen(page, 3);
            mk = await marks(page, LO);
            await refuse(page, {});
            await pressGo(page, LO);
            got = got && await seen(page, 4);
            const after = await marks(page, LO);
            lo = await at(page, LO);
            ok(got && mk.cur === 'true' && mk.num === null && lo.said === SAVED_T && after.num === null && after.cur === null,
               `N ★k3 ${theme}: サーバが range_currency で断った → 通貨の欄に印。保存できたら、印は残らない`, JSON.stringify({ mk, after, lo }));
            ok(errs.length === 0, `N    k1・k3 ${theme}: ページのエラーが1件も出ない`, errs.join(' | '));
            await page.close();
          }

          /* k1（?q= で運ばれた行）・k2 ── 低いほうの行を名指しして開く ＝ その行の後ろに緑の板が敷かれる */
          {
            const r = await openFull({ lang, query: '?airline=ana&q=' + LO, answers: STORED(), judge: true, theme });
            const page = r.page;
            await ready(page);
            await markOn(page, LO);
            await type(page, LO, 300);
            await pressGo(page, LO);
            const lo = await at(page, LO);
            const t = await paint(page, row(LO) + ' .pvcf-state');
            const board = t.under.filter((c) => rgba(c)[3] > 0);
            const rt = ratio(rgba(t.color), flat([t.own, ...t.under]));
            /* ★明るいテーマの板（pv-tokens.css の --pv-green-soft）の上では、金のインクは 4.5:1 に届かない（4.37:1）。
                 板の色はこの画面だけのものではないので、ここでは動かしていない。届いていないことを、そのまま書く。
                 見るのは「前の色（板の上で 3.3:1）へ戻っていない」ことだけ ＝ 4.3 以上。暗いテーマは 4.5:1 以上。 */
            ok(lo.said === ORDER_T && board.length >= 2 && rt >= (theme === 'light' ? 4.3 : 4.5),
               theme === 'light'
                 ? `N    k1 light: ?q= で運ばれた行（後ろに緑の板）では、断りの文は ${rt}:1 ── 板の色のぶん 4.5:1 に届かない（4.3 以上であることだけを見る）`
                 : `N ★k1 dark: ?q= で運ばれた行（後ろに緑の板）でも、断りの文は ${rt}:1（4.5:1 以上）`,
               JSON.stringify({ color: t.color, board }));

            /* k2 ── キーボードで順に乗って、輪の色を読む */
            const onIt = (sel) => page.evaluate((sel) => { const a = document.activeElement; return !!(a && a.matches && a.matches(sel)); }, sel);
            const tabTo = async (sel, cap, back) => {
              for (let i = 0; i <= cap; i++) {
                if (await onIt(sel)) return i;
                if (back) await page.keyboard.down('Shift');
                await page.keyboard.press('Tab');
                if (back) await page.keyboard.up('Shift');
              }
              return -1;
            };
            const rings = [];
            for (const [name, sel, back] of [
              ['額の欄', row(LO) + ' .pvcf-num', false], ['通貨の欄', row(LO) + ' [data-cur]', true], ['「入力する」', row(LO) + ' [data-num]', false],
              ['「わからない」', row(LO) + ' .pvc-opt[data-code="unknown"]', false], ['選択肢', row(P_UP.id) + ' .pvc-opt[data-code="' + inCode(P_HI) + '"]', true]]) {
              const n = await tabTo(sel, 40, back);
              const p = await paint(page, sel);
              const surface = flat(p.under);
              rings.push({ name, n, seen: p.seenFocus, w: p.ringW, ring: p.ring, ratio: p.ring ? ratio(over(rgba(p.ring), surface), surface) : 0 });
            }
            ok(rings.every((x) => x.n >= 0 && x.seen && x.w >= 2 && x.ratio >= 3),
               `N ★k2 ${theme}: フォーカスの輪は、輪が描かれる地に対して 3:1 以上（${rings.map((x) => x.name + ' ' + x.ratio).join('・')}）`, JSON.stringify(rings));
            ok(r.errs.length === 0, `N    k1・k2 ${theme}: ページのエラーが1件も出ない`, r.errs.join(' | '));
            await page.close();
          }
        }

        /* b1・b2 ── 並びと折り返し */
        {
          const CUR_QS = LISTED.filter((q) => q.kind === 'num' && q.currency);
          const PLAIN = LISTED.find((q) => q.kind === 'num' && !q.currency && q.num && q.num[lang] && q.parent && !BY[q.parent].parent && BY[q.parent].kind === 'choice');
          const QS = [...CUR_QS, PLAIN].filter(Boolean);
          const ups = {};
          QS.forEach((q) => { if (!ups[q.parent]) ups[q.parent] = inCode(q); });
          const { page, errs } = await openFull({ lang, query: '?airline=ana', answers: Object.keys(ups).map((id) => A(id, ups[id])), judge: true });
          await ready(page);
          await page.evaluate(() => { Array.prototype.forEach.call(document.querySelectorAll('details.pvcf-sec'), (x) => { x.open = true; }); });
          const shape = (qid) => page.evaluate((qid) => {
            const r = document.querySelector('[data-qid="' + qid + '"]');
            const kind = (e) => e.matches('[data-cur]') ? 'cur' : e.matches('.pvcf-num') ? 'num' : e.matches('.pvcf-unit') ? 'unit' : e.matches('[data-num]') ? 'go' : 'unk';
            const parts = Array.prototype.map.call(r.querySelectorAll('[data-cur],.pvcf-num,.pvcf-unit,[data-num],.pvc-opt[data-code="unknown"]'), kind);
            const n = r.querySelector('.pvcf-num'), u = r.querySelector('.pvcf-unit');
            return { hidden: r.hidden, parts: parts.join(' '), group: !!u && u.parentElement === n.parentElement && n.parentElement !== r.querySelector('.pvcf-row') };
          }, qid);
          const tabs = async (qid, first, n) => {
            await page.focus(row(qid) + ' ' + first);
            const out = [];
            for (let i = 0; i < n; i++) {
              out.push(await page.evaluate((qid) => {
                const a = document.activeElement, r = a.closest('[data-qid]');
                if (!r || r.getAttribute('data-qid') !== qid) return 'out';
                return a.matches('[data-cur]') ? 'cur' : a.matches('.pvcf-num') ? 'num' : a.matches('[data-num]') ? 'go' : a.matches('.pvc-opt[data-code="unknown"]') ? 'unk' : '?';
              }, qid));
              await page.keyboard.press('Tab');
            }
            return out.join(' ');
          };
          const seenRows = [];
          let nSeen = 0;
          for (const q of QS) {
            let s = await shape(q.id);
            if (s.hidden) {
              await press(page, q.parent, inCode(q));
              nSeen++;
              await seen(page, nSeen);
              s = await shape(q.id);
            }
            const want = q.currency ? 'cur num unit go unk' : 'num unit go unk';
            const order = s.hidden ? '' : await tabs(q.id, q.currency ? '[data-cur]' : '.pvcf-num', q.currency ? 4 : 3);
            seenRows.push({ q: q.id, ...s, order, ok: !s.hidden && s.parts === want && s.group && order === want.replace(' unit', '') });
          }
          ok(CUR_QS.length >= 4 && !!PLAIN && seenRows.length === QS.length && seenRows.every((x) => x.ok),
             `N ★b1 部品の並びと Tab の順は 通貨 → 額（＋単位）→「入力する」→「わからない」（額の質問 ${CUR_QS.length} つと、通貨の無い ${PLAIN ? PLAIN.id : '—'}）。額の欄と単位は1つの塊`,
             JSON.stringify(seenRows.filter((x) => !x.ok).length ? seenRows.filter((x) => !x.ok) : seenRows.map((x) => x.q)));

          /* b2 ── 幅を変えながら測る（描き直さない。同じ画面の幅だけを変える） */
          const WIDTHS = [320, 360, 390, 430, 480, 520, 560, 600, 640, 700, 768, 1001, 1280];
          const bad = [], narrow = [];
          let rowsSeen = 0;
          for (const w of WIDTHS) {
            await page.setViewport({ width: w, height: 800 });
            const m = await page.evaluate(() => {
              const rows = Array.prototype.filter.call(document.querySelectorAll('[data-qid]'), (r) => !r.hidden && r.querySelector('.pvcf-unit'));
              return {
                over: document.documentElement.scrollWidth - window.innerWidth,
                rows: rows.map((r) => {
                  const n = r.querySelector('.pvcf-num').getBoundingClientRect(), u = r.querySelector('.pvcf-unit').getBoundingClientRect();
                  const line = r.querySelector('.pvcf-row').getBoundingClientRect(), mid = (u.top + u.bottom) / 2;
                  return { q: r.getAttribute('data-qid'), inW: Math.round(n.width), gap: Math.round((u.left - n.right) * 10) / 10,
                    same: mid > n.top && mid < n.bottom, inside: n.left >= line.left - 0.5 && u.right <= line.right + 0.5 && u.width > 0 };
                })
              };
            });
            rowsSeen += m.rows.length;
            if (m.over > 0) bad.push({ w, over: m.over });
            m.rows.forEach((x) => { if (!(x.same && x.gap >= 0 && x.gap <= 12 && x.inside && x.inW >= 88)) bad.push({ w, ...x }); });
            narrow.push(w + ':' + Math.min(...m.rows.map((x) => x.inW)));
          }
          ok(rowsSeen >= WIDTHS.length * 4 && bad.length === 0,
             `N ★b2 幅 ${WIDTHS[0]}〜${WIDTHS[WIDTHS.length - 1]} の ${WIDTHS.length} 通りで、単位は額と同じ行・額のすぐ右（額の欄は 88px 以上）。ページは横に溢れない`,
             JSON.stringify(bad.length ? bad.slice(0, 6) : narrow));
          ok(errs.length === 0, 'N    b1・b2 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* c1 ── 低いほうだけ保存してある人 */
        {
          const { page, errs } = await openPair([A(P_UP.id, inCode(P_HI)), N(LO, 100, 'USD')]);
          let hi = await at(page, HI);
          ok(hi.cur === 'USD' && hi.num === '' && hi.said === '' && (await calls(page)).length === 0 && (await count(page)) === '2/' + N_Q,
             'N ★c1 低いほうを USD で保存してある人の、まだ答えていない高いほうの行は USD から始まる（何も保存しない・答えた数も増えない）',
             JSON.stringify({ hi, count: await count(page) }));
          await type(page, HI, 200);
          await pressGo(page, HI);
          const got = await seen(page, 1);
          hi = await at(page, HI);
          const sent = await calls(page);
          ok(got && sent.length === 1 && sent[0] === one(HI, 200, 'USD') && hi.said === SAVED_T && (await count(page)) === COUNT0,
             'N ★c1 そのまま 200 を入れて押す → USD で送る', JSON.stringify({ sent, hi }));
          ok(errs.length === 0, 'N    c1 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }
        /* c1（続き）・c2 ── 2問とも答えていない人 */
        {
          const { page, errs } = await openPair([A(P_UP.id, inCode(P_HI))]);
          const start = await at(page, HI);
          await pick(page, LO, 'USD');
          await type(page, LO, 100);
          await pressGo(page, LO);
          let got = await seen(page, 1);
          const hi1 = await at(page, HI);
          await pick(page, LO, 'EUR');
          await pressGo(page, LO);
          got = got && await seen(page, 2);
          const hi2 = await at(page, HI), sent = await calls(page);
          ok(start.cur === '' && got && hi1.cur === 'USD' && hi1.num === '' && sent.length === 2 && sent.every((s) => s.startsWith(LO + '=')),
             'N ★c1 2問とも答えていない人が低いほうを USD で保存する → 手つかずの高いほうの行が USD になる（送ったのは低いほうだけ）', JSON.stringify({ start, hi1, sent }));
          ok(hi2.cur === 'EUR', 'N    c1 高いほうが手つかずのまま、低いほうを EUR で保存し直す → 高いほうも EUR に付いていく', JSON.stringify(hi2));
          await type(page, HI, 200);
          await pick(page, LO, 'USD');
          await pressGo(page, LO);
          got = await seen(page, 3);
          const hi3 = await at(page, HI);
          await pressGo(page, HI);
          const hi4 = await at(page, HI), sent2 = await calls(page);
          ok(got && hi3.cur === 'EUR' && hi3.num === '200' && sent2.length === 3 && hi4.said === CUR_T && hi4.focus === 'cur',
             'N ★c1 高いほうに額を打ったあとは、借りた通貨でも動かさない（低いほうを USD で保存し直しても EUR のまま）。そのまま押すと「…同じ通貨で…」で止まり、送らない',
             JSON.stringify({ hi3, hi4, sent: sent2 }));
          ok(errs.length === 0, 'N    c1（続き）ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }
        {
          const { page, errs } = await openPair([A(P_UP.id, inCode(P_HI))]);
          await pick(page, HI, 'EUR');
          await pick(page, LO, 'USD');
          await type(page, LO, 100);
          await pressGo(page, LO);
          const got = await seen(page, 1);
          const hi = await at(page, HI), lo = await at(page, LO);
          ok(got && lo.said === SAVED_T && lo.cur === 'USD' && hi.cur === 'EUR',
             'N ★c2 高いほうの行で本人が EUR を選んだあとで、低いほうを USD で保存する → 高いほうは EUR のまま（選んだ通貨を書き換えない）', JSON.stringify({ lo, hi }));
          ok(errs.length === 0, 'N    c2 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }
        ok(LEAKS.length === leaks0, 'M・N どの場面も、本物のサーバへ向かう要求を1本も出していない（答えたのは全部この検査の偽物）',
           LEAKS.slice(leaks0).join(' | '));
      }
    }

    /* O. 一覧の仕上げ ── 置いたとき・押したときの見た目／選択肢と、質問の名前の折り返し（2026-10-12）
          ★額の欄と通貨の欄には、フォーカスの輪しか無かった（置いても押しても見た目が同じ）。選んだ選択肢は、置いても動かなかった。
          ★幅 320 で、選択肢が「いくつかの条件で変わる・そ／の他」と語の途中で折れ、
            質問の名前が「…手当はあります／か？」と、最後の行に2文字だけ残していた。
          見ること:
            h1 額の欄・通貨の欄・選んだ選択肢 ── ポインタを置くと、枠と地の色が変わる。額の欄と通貨の欄は、押しているあいだ、
               置いただけのときとも違う色になる（明るい・暗い）。選んだ選択肢に置いたときの枠は、その選択肢の字の色（そのテーマの緑）
            h2 どの状態でも、大きさ（外の幅と高さ・4辺の枠の太さ）は変わらない
            h3 キーボードで乗った部品にポインタを置いても、フォーカスの輪は消えない ── 太さも色も、置く前のまま
               （輪の濃さは N の k2。あちらはポインタを置かずに測るので、置いたときに輪の色が変わっても気づけない）
            h4 置けない端末（指で触る端末）では、ブラウザが「置いた」扱いにしても、3つとも見た目が動かない
               ＝ 触り終わった欄・押したばかりの選択肢だけが、違う見た目のまま残らない
            h5 押せないあいだの選んだ選択肢（1問だけ聞くカードが、保存の返事を待つあいだの形）は、置いても動かない
            w1 幅 320 で、その選択肢の最後の行は「その他」（選んでいないとき・選んだとき）。幅 390 では1行
            w2 「・」の後ろの分は、どの選択肢でも1行にまとまっている。どの選択肢も行より広がらない。ページは横に溢れない。
               1行に入らない長さの分は、箱の中で折り返す（この画面の中で、検査が1つを長くして確かめる）
            w3 選択肢の字は質問表と1文字も違わない。箱に入るのは「・」の後ろの分だけ（「・」の無い字 ＝ 英語は全部、箱なし）。
               選んだ印（✓）と字のあいだは、箱の無いときと同じ
            t1 幅 320・360・390 で、着陸手当の6問（と、一覧の全部の質問）の名前と説明は、最後の行が3文字以上。
               text-wrap を切っても同じ。★名前と説明に text-wrap:pretty は付けていない（2026-10-12。併せて使うと
               「…払われる手／当です。」と語の途中で折れた）＝ 付いていたら落ちる
            t2 名前と説明の字は質問表と1文字も違わない。最後の3文字だけが1つの塊。塊を入れたせいで行が増えた文は無い（日英）
          ⚠️ 色と大きさは、ブラウザが計算したもの（getComputedStyle・描いた四角）を読む。製品の CSS の字は読まない。
          ⚠️ 行は、ブラウザが実際に描いた字の位置で数える。
          ⚠️ 置く・押すは本物のポインタ。h4 だけは、指の端末に「置く」が無いので、ブラウザに「置いた」扱いをさせる。
          ⚠️ 測っているのは、この検査のブラウザ（Chromium）だけ。 */
    {
      const leaks0 = LEAKS.length;
      const LAND = BY.landing_pay, VARY = BY.landing_pay_varies_by;
      const LAND_ALL = LAND ? [LAND.id, ...under(LAND)] : [];
      const MIXED = VARY && (VARY.choices || []).find((c) => c.code === 'mixed');
      /* 選択肢の親の答え（「一定額ではない」の枝）と、同じ枝で出る額の質問（通貨つき） */
      const BRANCH = VARY && VARY.parentWhen[0];
      const AMT = LAND && LISTED.find((q) => q.parent === LAND.id && q.kind === 'num' && q.currency && q.parentWhen.includes(BRANCH));
      const LAST = MIXED ? MIXED.ja.slice(MIXED.ja.lastIndexOf('・') + 1) : '';
      const landOk = !!LAND && !!VARY && VARY.parent === LAND.id && !!MIXED && !!AMT && LAND_ALL.length >= 6
        && MIXED.ja.indexOf('・') > 0 && LAST.length > 0 && (LAND.choices || []).some((c) => c.code === BRANCH && c.ja.indexOf('・') > 0);
      ok(landOk, `O 着陸手当の質問（親と、続きの ${Math.max(LAND_ALL.length - 1, 0)} 問・「・」の入った選択肢・通貨つきの額）を、バンクから選べる（無くなったら、この節が黙って空振りになる）`,
         JSON.stringify({ all: LAND_ALL, mixed: MIXED && MIXED.ja, amt: AMT && AMT.id }));
      if (landOk) {
        const row = (qid) => '[data-qid="' + qid + '"]';
        const NUM = row(AMT.id) + ' .pvcf-num', CUR = row(AMT.id) + ' [data-cur]';
        const PICKED = row(LAND.id) + ' .pvc-opt.is-picked', PLAIN = row(VARY.id) + ' .pvc-opt[data-code="' + MIXED.code + '"]';
        const openO = async (answers, opt = {}) => {
          const r = await openFull({ lang, query: '?airline=ana', answers, judge: true, ...opt });
          await ready(r.page);
          await r.page.evaluate(() => {
            Array.prototype.forEach.call(document.querySelectorAll('details.pvcf-sec'), (x) => { x.open = true; });
            /* その要素の字を、ブラウザが実際に描いた行ごとに返す（空白は数えない） */
            window.__lines = (n) => {
              if (!n) return [];
              const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), got = [];
              let t;
              while ((t = w.nextNode())) {
                let i = 0;
                for (const ch of Array.from(t.nodeValue)) {
                  const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + ch.length); i += ch.length;
                  const b = r.getClientRects()[0];
                  if (b && ch.trim()) got.push([b.top, ch]);
                }
              }
              const out = [];
              let top = null;
              got.sort((a, b) => a[0] - b[0]).forEach((x) => {
                if (top === null || x[0] - top > 3) { out.push(''); top = x[0]; }
                out[out.length - 1] += x[1];
              });
              return out;
            };
            /* 書体が届くのを待つ（届かない回に止まらないように、長くても4秒）。どの行も、同じ瞬間に測った2つを比べるか、
               書体によらない決まり（箱・塊）を見ているので、待ちきれなかった回も答えは変わらない。 */
            return Promise.race([document.fonts.ready, new Promise((go) => setTimeout(go, 4000))]).then(() => true);
          });
          return r;
        };
        const showAll = (page) => page.evaluate(() => { Array.prototype.forEach.call(document.querySelectorAll('[data-qid][hidden]'), (x) => { x.hidden = false; }); });
        const centre = (page, sel) => page.$eval(sel, (e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
        const seenO = (page, n) => page.waitForFunction((n) => (window.__seen || 0) >= n, { timeout: 8000 }, n).then(() => true, () => false);
        /* その部品の、いまの見た目。want ＝ その状態になるまで待つ（'rest'・'hover'・'active'。'any' は待たない）。
           どれも、色の変わり目の動きが終わってから読む。 */
        const face = async (page, sel, want) => {
          const got = await page.waitForFunction((sel, want) => {
            const e = document.querySelector(sel);
            if (!e) return false;
            const h = e.matches(':hover'), a = e.matches(':active');
            if (want === 'rest' ? (h || a) : want === 'hover' ? (!h || a) : want === 'active' ? !a : false) return false;
            return e.getAnimations().length === 0;
          }, { timeout: 8000 }, sel, want).then(() => true, () => false);
          const v = await page.evaluate((sel) => {
            const e = document.querySelector(sel);
            if (!e) return { paint: '（その部品が無い）', border: '', bg: '', ink: '', size: '', ring: 0, ringInk: '', fv: false, theme: '' };
            const cs = getComputedStyle(e), r = e.getBoundingClientRect();
            const px = (x) => Math.round(parseFloat(x) * 100) / 100, sides = ['Top', 'Right', 'Bottom', 'Left'];
            return {
              paint: sides.map((s) => cs['border' + s + 'Color']).join(' ') + ' / ' + cs.backgroundColor,
              border: cs.borderTopColor, bg: cs.backgroundColor, ink: cs.color,
              size: [px(r.width), px(r.height)].concat(sides.map((s) => px(cs['border' + s + 'Width']))).join(' '),
              ring: cs.outlineStyle === 'none' ? 0 : (parseFloat(cs.outlineWidth) || 0), fv: e.matches(':focus-visible'),
              ringInk: cs.outlineStyle === 'none' ? '' : cs.outlineColor,
              theme: document.documentElement.getAttribute('data-theme')
            };
          }, sel);
          return { got, ...v };
        };
        const onIt = (page, sel) => page.evaluate((sel) => { const a = document.activeElement; return !!(a && a.matches && a.matches(sel)); }, sel);
        const shiftTab = async (page) => { await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift'); };
        /* ブラウザに、その部品を「置いた」「押している」扱いにさせる（states が空なら、扱いを外す） */
        const forcer = async (page) => {
          const cdp = await page.createCDPSession();
          await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
          const { root } = await cdp.send('DOM.getDocument');
          return async (sel, states) => {
            const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
            await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: states });
          };
        };

        for (const theme of ['light', 'dark']) {
          /* h1〜h3 ── 本物のポインタで置く・押す。
                      通貨の欄の「押しているあいだ」だけは、ブラウザに扱いをさせる ── この検査のブラウザは、通貨の欄を押すと
                      すぐ一覧を開き、欄そのものは「押している」にならない（指で触る端末と、ほかのブラウザのための規則）。 */
          {
            const { page, errs } = await openO([A(LAND.id, BRANCH)], { theme });
            const force = await forcer(page);
            const seenFace = {};
            for (const [name, sel, press] of [['額の欄', NUM, 'mouse'], ['通貨の欄', CUR, 'forced'], ['選んだ選択肢', PICKED, '']]) {
              await centre(page, sel);
              await page.mouse.move(1, 1);
              const rest = await face(page, sel, 'rest');
              await page.hover(sel);
              const hov = await face(page, sel, 'hover');
              let act = null;
              if (press === 'mouse') {
                await page.mouse.down();
                act = await face(page, sel, 'active');
                await page.mouse.up();
              } else if (press === 'forced') {
                await force(sel, ['hover', 'active']);
                act = await face(page, sel, 'any');
                await force(sel, []);
              }
              await page.mouse.move(1, 1);
              seenFace[name] = { rest, hov, act };
              ok(rest.theme === theme && rest.got && hov.got && hov.border !== rest.border && hov.bg !== rest.bg,
                 `O ★h1 ${theme}: ${name}にポインタを置くと、枠と地の色が変わる`, JSON.stringify({ rest: rest.paint, hover: hov.paint, got: [rest.got, hov.got] }));
              if (press) {
                ok(act.got && act.paint !== rest.paint && act.paint !== hov.paint,
                   `O ★h1 ${theme}: ${name}を押しているあいだは、置いただけのときとも違う色になる`, JSON.stringify({ rest: rest.paint, hover: hov.paint, active: act.paint, got: act.got }));
              } else {
                ok(hov.border === hov.ink && rest.border !== rest.ink,
                   `O ★h1 ${theme}: ${name}に置いたときの枠は、その選択肢の字の色（そのテーマの緑）`, JSON.stringify({ border: hov.border, ink: hov.ink, rest: rest.border }));
              }
              ok(hov.size === rest.size && (!act || act.size === rest.size),
                 `O ★h2 ${theme}: ${name}は、置いても${press ? '押しても' : ''}大きさが変わらない（外の幅と高さ・4辺の枠の太さ ＝ ${rest.size}）`,
                 JSON.stringify({ rest: rest.size, hover: hov.size, active: act && act.size }));
            }
            /* h3 ── キーボードで乗ってから、ポインタを置く。
                     輪は、太さだけでなく色も、ポインタを置く前（ink0）と同じ ── 置いたときの規則が輪の色を透明にしても、
                     太さは 2px のまま残るので、太さだけでは気づけない（2026-10-12 検査した側が、そう壊して確かめた）。
                     置く前の色は、ポインタをその部品から離してから読む。 */
            const rings = [], ink0 = {};
            const ringInk = (sel) => page.$eval(sel, (e) => { const cs = getComputedStyle(e); return e.matches(':hover') || cs.outlineStyle === 'none' ? '' : cs.outlineColor; });
            await page.focus(CUR); await page.keyboard.press('Tab');
            rings.push(['額の欄', NUM, await onIt(page, NUM)]);
            ink0['額の欄'] = await ringInk(NUM);
            await page.hover(NUM); rings[0].push(await face(page, NUM, 'hover'));
            await shiftTab(page);
            rings.push(['通貨の欄', CUR, await onIt(page, CUR)]);
            ink0['通貨の欄'] = await ringInk(CUR);
            await page.hover(CUR); rings[1].push(await face(page, CUR, 'hover'));
            await page.focus(PICKED); await page.keyboard.press('Tab'); await shiftTab(page);
            rings.push(['選んだ選択肢', PICKED, await onIt(page, PICKED)]);
            await centre(page, PICKED);
            await page.mouse.move(1, 1);
            ink0['選んだ選択肢'] = await ringInk(PICKED);
            await page.hover(PICKED); rings[2].push(await face(page, PICKED, 'hover'));
            ok(rings.every((x) => x[2] && x[3].got && x[3].fv && x[3].ring >= 2 && x[3].paint === seenFace[x[0]].hov.paint
                 && ink0[x[0]] !== '' && x[3].ringInk === ink0[x[0]]),
               `O ★h3 ${theme}: キーボードで乗った部品にポインタを置いても、フォーカスの輪は消えない（${rings.map((x) => x[0] + ' ' + x[3].ring + 'px').join('・')}。色も置く前のまま）`,
               JSON.stringify(rings.map((x) => ({ name: x[0], on: x[2], fv: x[3].fv, ring: x[3].ring, hover: x[3].got, inkBefore: ink0[x[0]], inkOver: x[3].ringInk }))));
            /* h5 ── 押せない選択肢。1問だけ聞くカード（マイページ・給与を出した直後）は、押した選択肢を、保存の返事を待つあいだ
                     押せなくする（disabled）。一覧には押せない選択肢が無いので、この画面の中で1つを押せなくして確かめる。 */
            await page.mouse.move(1, 1);
            await page.$eval(PICKED, (b) => { b.blur(); b.disabled = true; });
            const off0 = await face(page, PICKED, 'rest');
            await page.hover(PICKED);
            const off1 = await face(page, PICKED, 'hover');
            await page.mouse.move(1, 1);
            await page.$eval(PICKED, (b) => { b.disabled = false; });
            ok(off0.got && off1.got && off1.paint === off0.paint && off0.paint === seenFace['選んだ選択肢'].rest.paint,
               `O ★h5 ${theme}: 押せないあいだの選んだ選択肢（1問だけ聞くカードの、返事を待つあいだの形）は、置いても見た目が動かない`,
               JSON.stringify({ rest: off0.paint, hover: off1.paint, got: [off0.got, off1.got] }));
            ok(errs.length === 0, `O    h1〜h3 ${theme}: ページのエラーが1件も出ない`, errs.join(' | '));
            await page.close();
          }

          /* h4 ── 指で触る端末（置けない端末）。ブラウザに「置いた」扱いをさせて、見た目が動かないことを見る。
                   同じやり方で、前から在る「選んでいない選択肢の :hover」は動く ＝ 「置いた」扱いは効いている。 */
          {
            const { page, errs } = await openO([A(LAND.id, BRANCH)], { theme, vp: { width: 390, height: 680, isMobile: true, hasTouch: true } });
            const canHover = await page.evaluate(() => matchMedia('(hover:hover)').matches);
            const force = await forcer(page);
            const moved = {};
            for (const [name, sel] of [['額の欄', NUM], ['通貨の欄', CUR], ['選んだ選択肢', PICKED], ['選んでいない選択肢', PLAIN]]) {
              const rest = await face(page, sel, 'any');
              await force(sel, ['hover']);
              const hov = await face(page, sel, 'any');
              await force(sel, []);
              moved[name] = hov.paint !== rest.paint;
            }
            ok(!canHover && !moved['額の欄'] && !moved['通貨の欄'] && !moved['選んだ選択肢'] && moved['選んでいない選択肢'],
               `O ★h4 ${theme}: 置けない端末では、「置いた」扱いになっても、額の欄・通貨の欄・選んだ選択肢の見た目は動かない（前から在る、選んでいない選択肢の :hover は動く ＝ 扱いは効いている）`,
               JSON.stringify({ canHover, moved }));
            /* 指で選択肢を押す → 保存されて、選んだ形になる。押したばかりの選択肢が、ほかの選んだ選択肢と同じ見た目 */
            const want = await face(page, PICKED, 'any');
            await centre(page, PLAIN);
            const at = await page.$eval(PLAIN, (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
            await page.touchscreen.tap(at.x, at.y);
            const got = await seenO(page, 1);
            const now = await face(page, PLAIN + '.is-picked', 'any');
            ok(got && now.paint === want.paint,
               `O    h4 ${theme}: 指で押して選んだばかりの選択肢は、前から選んである選択肢と同じ見た目（濃いまま残らない）`, JSON.stringify({ got, now: now.paint, want: want.paint }));
            ok(errs.length === 0, `O    h4 ${theme}: ページのエラーが1件も出ない`, errs.join(' | '));
            await page.close();
          }
        }

        /* w1〜w3 ── 選択肢の折り返し */
        {
          const { page, errs } = await openO([A(LAND.id, BRANCH)], { vp: { width: 320, height: 568 } });
          const linesOf = (sel) => page.evaluate((sel) => window.__lines(document.querySelector(sel)), sel);
          if (lang === 'ja') {
            let l = await linesOf(PLAIN);
            ok(l.length === 2 && l[1] === LAST, `O ★w1 幅320: 選択肢「${MIXED.ja}」（選んでいない）の最後の行は「${LAST}」`, l.join('／'));
            await centre(page, PLAIN);
            await page.click(PLAIN);
            const got = await seenO(page, 1);
            l = await linesOf(PLAIN + '.is-picked');
            ok(got && l.length === 2 && l[1] === LAST, `O ★w1 幅320: 選んだあと（✓ が付く）も、最後の行は「${LAST}」`, JSON.stringify({ got, l }));
            await page.setViewport({ width: 390, height: 680 });
            l = await linesOf(PLAIN + '.is-picked');
            /* ✓ と字のあいだ：箱を外した字だけの形と、選択肢の幅が同じ（比べるためにこの画面の中で外して、すぐ戻す） */
            const gap = await page.evaluate((sel) => {
              const b = document.querySelector(sel);
              if (!b) return { boxed: 0, plain: 0, boxes: 0 };
              const keep = b.innerHTML, boxed = b.getBoundingClientRect().width;
              b.textContent = b.textContent;
              const plain = b.getBoundingClientRect().width;
              b.innerHTML = keep;
              return { boxed: Math.round(boxed * 100) / 100, plain: Math.round(plain * 100) / 100, boxes: b.querySelectorAll('.pvc-nb').length };
            }, PLAIN + '.is-picked');
            ok(l.length === 1 && gap.boxes >= 1 && Math.abs(gap.boxed - gap.plain) < 0.5,
               `O ★w3 幅390: 同じ選択肢は1行。選んだ印（✓）と字のあいだは、箱の無いときと同じ（選択肢の幅 ${gap.boxed}px）`, JSON.stringify({ l, gap }));
            await page.setViewport({ width: 320, height: 568 });
          }

          /* 字と箱の形（この言語の全部の選択肢）。期待する分け方は、ここで質問表の字から作る */
          const split = (s) => { const out = []; let at = 0; for (let i = 0; i < s.length - 1; i++) if (s[i] === '・') { out.push(s.slice(at, i + 1)); at = i + 1; } out.push(s.slice(at)); return out; };
          const drawn = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('[data-qid]'), (r) => ({
            q: r.getAttribute('data-qid'),
            opts: Array.prototype.map.call(r.querySelectorAll('.pvc-opt[data-code]'), (b) => ({ code: b.getAttribute('data-code'), text: b.textContent,
              kids: Array.prototype.map.call(b.childNodes, (c) => (c.nodeType === 3 ? 't:' : (c.nodeType === 1 && c.tagName === 'SPAN' && c.className === 'pvc-nb'
                && c.childNodes.length === 1 && c.firstChild.nodeType === 3) ? 'b:' : '?:') + c.textContent) }))
          })));
          const wrong = [];
          let nOpt = 0, nDot = 0;
          drawn.forEach((r) => {
            const q = BY[r.q];
            (q.choices || []).forEach((c) => {
              const d = r.opts.find((o) => o.code === c.code), parts = split(c[lang]);
              nOpt++;
              if (parts.length > 1) nDot++;
              const want = parts.map((p, i) => (i ? 'b:' : 't:') + p);
              if (!d || d.text !== c[lang] || d.kids.join('|') !== want.join('|')) wrong.push(r.q + '/' + c.code + ' ' + JSON.stringify(d && d.kids));
            });
          });
          ok(drawn.length === N_Q && nOpt > 100 && wrong.length === 0 && (lang === 'ja' ? nDot >= 20 : nDot === 0),
             `O ★w3 選択肢 ${nOpt} 個の字は、質問表と1文字も違わない。箱に入っているのは「・」の後ろの分だけ（「・」の在る選択肢 ${nDot} 個${lang === 'en' ? ' ＝ 英語は箱なし' : ''}）`,
             JSON.stringify(wrong.slice(0, 5)));

          /* w2 ── 全部の質問を見せて、幅ごとに測る（続きの質問も測るために、この画面の中で隠してある行を出す） */
          await showAll(page);
          for (const w of [320, 390]) {
            await page.setViewport({ width: w, height: 680 });
            const m = await page.evaluate(() => {
              const out = { over: document.documentElement.scrollWidth - window.innerWidth, n: 0, wide: [], cut: [], boxes: 0, long: 0, widest: ['', 0] };
              Array.prototype.forEach.call(document.querySelectorAll('[data-qid] .pvc-opt'), (b) => {
                const line = b.closest('.pvcf-row').getBoundingClientRect(), r = b.getBoundingClientRect(), cs = getComputedStyle(b);
                const room = line.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
                out.n++;
                if (r.left < line.left - 0.5 || r.right > line.right + 0.5) out.wide.push(b.textContent + ' ' + Math.round(r.width) + '>' + Math.round(line.width));
                Array.prototype.forEach.call(b.querySelectorAll('.pvc-nb'), (s) => {
                  /* その分を1行で書いたときの幅（同じ書体の写しで測る） */
                  const c = s.cloneNode(true);
                  c.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
                  b.appendChild(c);
                  const need = c.getBoundingClientRect().width;
                  c.remove();
                  out.boxes++;
                  if (need > out.widest[1]) out.widest = [s.textContent, Math.round(need * 10) / 10, Math.round(room * 10) / 10];
                  if (need > room) { out.long++; return; }
                  const l = window.__lines(s);
                  if (l.length !== 1) out.cut.push(b.textContent + '「' + l.join('／') + '」');
                });
              });
              return out;
            });
            ok(m.n > 100 && m.wide.length === 0 && m.over <= 0,
               `O ★w2 幅${w}: 選択肢と「入力する」${m.n} 個は、どれも行より広がらない。ページは横に溢れない`, JSON.stringify({ over: m.over, wide: m.wide.slice(0, 4) }));
            if (lang === 'ja') {
              ok(m.boxes >= 20 && m.cut.length === 0,
                 `O ★w2 幅${w}: 「・」の後ろの分 ${m.boxes} 個は、どれも途中で折れていない（いちばん長い分「${m.widest[0]}」${m.widest[1]}px ／ 入る幅 ${m.widest[2] || 0}px。1行に入らない分 ${m.long} 個）`,
                 JSON.stringify(m.cut.slice(0, 4)));
            }
          }
          if (lang === 'ja') {
            /* 1行に入らない長さの分 ── いまの質問表には無いので、この画面の中で1つを長くして、箱の中で折り返すことを見る */
            await page.setViewport({ width: 320, height: 568 });
            const long = await page.evaluate((sel) => {
              const b = document.querySelector(sel), s = b && b.querySelector('.pvc-nb');
              if (!s) return { lines: 0, chars: 0, inside: false, over: 0, w: 0, row: 0 };
              const keep = s.textContent;
              s.textContent = keep.repeat(12);
              const line = b.closest('.pvcf-row').getBoundingClientRect(), r = b.getBoundingClientRect();
              const out = { lines: window.__lines(s).length, chars: Array.from(s.textContent).length, inside: r.left >= line.left - 0.5 && r.right <= line.right + 0.5,
                over: document.documentElement.scrollWidth - window.innerWidth, w: Math.round(r.width), row: Math.round(line.width) };
              s.textContent = keep;
              return out;
            }, PLAIN);
            ok(long.lines > 1 && long.inside && long.over <= 0,
               `O ★w2 幅320: 1行に入らない長さの分（${long.chars} 文字にして確かめる）は、箱の中で折り返す ＝ 選択肢は行より広がらず、ページも横に溢れない`, JSON.stringify(long));
          }
          ok(errs.length === 0, 'O    w1〜w3 ページのエラーが1件も出ない', errs.join(' | '));
          await page.close();
        }

        /* t1・t2 ── 質問の名前と説明の、最後の行 */
        {
          const PH = [320, 360, 390];
          const endLook = (page) => page.evaluate(() => {
            const out = [];
            Array.prototype.forEach.call(document.querySelectorAll('[data-qid]'), (r) => {
              if (r.hidden || !r.getClientRects().length) return;
              [['名前', '.pvcf-lab'], ['説明', '.pvcf-help']].forEach((k) => {
                const n = r.querySelector(k[1]);
                if (!n) return;
                const l = window.__lines(n), cs = getComputedStyle(n);
                out.push({ q: r.getAttribute('data-qid'), k: k[0], lines: l.length, last: Array.from(l[l.length - 1] || '').length,
                  end: (l.length > 1 ? l[l.length - 2].slice(-3) + '／' : '') + (l[l.length - 1] || '').slice(-8), wrap: cs.textWrapStyle || cs.textWrap || '' });
              });
            });
            return out;
          });
          const short = (list) => list.filter((x) => x.lines > 1 && x.last < 3).map((x) => `${x.q} ${x.k}「…${x.end}」`);
          const OFF = '.pvcf-lab,.pvcf-help{text-wrap:wrap !important}';
          if (lang === 'ja') {
            /* 着陸手当の6問 ── 親の答えで出る枝ごとに開く（会員が見るのと同じ出方） */
            const BRANCHES = Array.from(new Set(LISTED.filter((q) => q.parent === LAND.id).map((q) => q.parentWhen[0])));
            const ends = { ship: {}, off: {} };
            const allErrs = [];
            for (const code of BRANCHES) {
              const { page, errs } = await openO([A(LAND.id, code)], { vp: { width: 320, height: 568 } });
              for (const mode of ['ship', 'off']) {
                if (mode === 'off') await page.addStyleTag({ content: OFF });
                for (const w of PH) {
                  await page.setViewport({ width: w, height: 680 });
                  (ends[mode][w] = ends[mode][w] || []).push(...(await endLook(page)).filter((x) => LAND_ALL.includes(x.q)));
                }
              }
              allErrs.push(...errs);
              await page.close();
            }
            for (const w of PH) {
              const a = ends.ship[w], b = ends.off[w];
              const seenQ = (list) => LAND_ALL.every((id) => list.some((x) => x.q === id && x.k === '名前'));
              ok(seenQ(a) && a.every((x) => x.wrap !== 'pretty') && short(a).length === 0,
                 `O ★t1 幅${w}: 着陸手当の ${LAND_ALL.length} 問の名前と説明（${a.length} 文）は、最後の行が3文字以上`, JSON.stringify(short(a).length ? short(a) : a.filter((x) => x.wrap === 'pretty').slice(0, 3)));
              ok(seenQ(b) && b.every((x) => x.wrap !== 'pretty') && short(b).length === 0,
                 `O ★t1 幅${w}: text-wrap:pretty を切っても同じ（その字を知らないブラウザでも、最後の行は3文字以上）`, JSON.stringify(short(b).length ? short(b) : b.filter((x) => x.wrap === 'pretty').slice(0, 3)));
            }
            ok(allErrs.length === 0, 'O    t1 ページのエラーが1件も出ない', allErrs.join(' | '));
          }
          /* 一覧の全部の質問（続きの質問も測るために、この画面の中で隠してある行を出す） */
          {
            const { page, errs } = await openO([], { vp: { width: 320, height: 568 } });
            await showAll(page);
            const kept = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('[data-qid]'), (r) => {
              const one = (sel) => {
                const n = r.querySelector(sel);
                if (!n) return null;
                const tails = n.querySelectorAll('.pvcf-tail'), keep = n.innerHTML;
                const o = { text: n.textContent, kids: Array.prototype.map.call(n.childNodes, (c) => (c.nodeType === 3 ? 't' : c.className)).join('+'),
                  tail: tails.length === 1 ? tails[0].textContent : null, withTail: window.__lines(n).length };
                n.textContent = n.textContent;
                o.plain = window.__lines(n).length;
                n.innerHTML = keep;
                return o;
              };
              return { q: r.getAttribute('data-qid'), 名前: one('.pvcf-lab'), 説明: one('.pvcf-help') };
            }));
            const wrong = [], more = [];
            let nText = 0;
            kept.forEach((r) => ['名前', '説明'].forEach((k) => {
              const bank = k === '名前' ? BY[r.q][lang].label : BY[r.q][lang].help, x = r[k];
              if (!bank) { if (x) wrong.push(r.q + ' ' + k + '（質問表に無い文）'); return; }
              const ch = Array.from(bank);
              nText++;
              if (!x || x.text !== bank || (ch.length > 3 ? (x.kids !== 't+pvcf-tail' || x.tail !== ch.slice(-3).join('')) : x.kids !== 't')) wrong.push(`${r.q} ${k} [${x && x.kids}｜${x && x.tail}]`);
              if (x && x.withTail !== x.plain) more.push(`${r.q} ${k} ${x.plain}行 → ${x.withTail}行`);
            }));
            ok(kept.length === N_Q && nText > N_Q && wrong.length === 0,
               `O ★t2 質問の名前と説明 ${nText} 文の字は、質問表と1文字も違わない。最後の3文字だけが1つの塊`, JSON.stringify(wrong.slice(0, 5)));
            ok(more.length === 0, 'O ★t2 幅320: 塊を入れたせいで行が増えた文は無い（塊を外した字だけの形と、行の数が同じ）', JSON.stringify(more.slice(0, 5)));
            if (lang === 'ja') {
              for (const mode of ['ship', 'off']) {
                if (mode === 'off') await page.addStyleTag({ content: OFF });
                const bad = [];
                let n = 0, styleOk = true;
                for (const w of PH) {
                  await page.setViewport({ width: w, height: 680 });
                  const list = await endLook(page);
                  n += list.length;
                  styleOk = styleOk && list.every((x) => x.wrap !== 'pretty');
                  bad.push(...short(list).map((x) => w + ': ' + x));
                }
                ok(n >= PH.length * N_Q && styleOk && bad.length === 0,
                   `O ★t1 一覧の全部の質問（${N_Q} 問）の名前と説明は、幅 ${PH.join('・')} のどれでも、最後の行が3文字以上（${mode === 'ship' ? 'そのまま' : 'text-wrap:pretty を切って'}）`,
                   JSON.stringify(bad.length ? bad.slice(0, 5) : { n, styleOk }));
              }
            }
            ok(errs.length === 0, 'O    t1・t2 ページのエラーが1件も出ない', errs.join(' | '));
            await page.close();
          }
        }
        ok(LEAKS.length === leaks0, 'O どの場面も、本物のサーバへ向かう要求を1本も出していない（答えたのは全部この検査の偽物）',
           LEAKS.slice(leaks0).join(' | '));
      }
    }
  }
}

await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
