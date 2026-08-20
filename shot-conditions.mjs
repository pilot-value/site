/* shot-conditions.mjs — 待遇のモーダルと、マイページの二次カードを撮る。

   本物の画面は「給与を出した直後」に出るが、そこまで通すには明細の投稿が要る。
   モーダルは画面いっぱいに被さる作りなので、下に敷くページは何でも絵が変わらない。
   ここではログインが要る実ページ（profile.html）に立って、
   pay-report.html が呼ぶのと同じ入口（PVConditions.afterReport）をそのまま呼ぶ。
   描画は本物の pv-conditions.js ＝撮った絵がそのまま本番の絵になる。

   本番にはまだテーブルが無い（オーナーが SQL を流す前）ので、
   shot-tracker.mjs と同じやり方で Supabase クライアントごと差し替える。

   実行: node shot-conditions.mjs <scene> <lang> <theme> <width> [open|page]
     scene: q1    … 1問目（3問中）
            q2    … 2問目（1問目に答えたあと）
            done  … 3問答え終わったあと
            again … 再確認（前回の答えを見せて「今も同じか」だけ聞く）
            fail  … 保存できなかった
            cta   … マイページの二次カード（★モーダルは開かないのが正しい）
            nopay … 給与をまだ1件も出していない（★何も出ないのが正しい）
            detail… 詳細ページ（airline-conditions.html）26問ぜんぶ
            pick  … 詳細ページで会社が決まっていない人（会社を選ばせる）
            dead  … 詳細ページの読み込みに失敗したとき（★真っ白にせず短い文を出す）
     lang : ja | en    theme: dark | light    width: 390 / 1280 など
     第5引数 open ＝撮らずに見える窓で開いたままにする（自分の目で見る用）
     第5引数 page ＝モーダル単体でなくページ全体を撮る
              （detail / pick は既定が1画面ぶん。page で縦に全部つなげる）
     第6引数 ＝ detail / pick のとき、何px下へ送ってから撮るか（既定 0）
   保存先は screenshot.mjs と同じ ./temporary screenshots/
*/
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scene = process.argv[2] || 'q1';
const lang  = process.argv[3] || 'ja';
const theme = process.argv[4] || 'dark';
const vw    = Number(process.argv[5] || 1280);
const open  = process.argv[6] === 'open';
const full  = process.argv[6] === 'page';
/* 詳細ページは縦に長い。既定は1画面ぶんを撮り、見たい場所へ送ってから撮れるようにする */
const scrollY = Number(process.argv[7] || 0);

const SCENES = ['q1', 'q2', 'done', 'again', 'fail', 'cta', 'nopay', 'detail', 'pick', 'dead'];
if (SCENES.indexOf(scene) < 0) {
  console.error(`場面は ${SCENES.join(' / ')} のどれか（渡された値: ${scene}）`);
  process.exit(2);
}
/* 詳細ページ（airline-conditions.html）を撮る場面。ここはモーダルを使わない */
const DETAIL = scene === 'detail' || scene === 'pick' || scene === 'dead';
/* モーダルが開かないのが正しい場面 */
const NO_MODAL = scene === 'cta' || scene === 'nopay' || DETAIL;

const dir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const label = `cond-${scene}-${lang}-${theme}-${vw}` + (scrollY ? `-y${scrollY}` : '');
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}-${label}.png`);

const url = `http://localhost:3000/${lang === 'en' ? 'en/' : ''}`
  + (DETAIL ? 'airline-conditions.html' : 'profile.html');

/* ★ headless:'new' はこの環境で page.screenshot() が返ってこない（shot-tracker.mjs 参照）。 */
const browser = await puppeteer.launch(open
  ? { headless: false, defaultViewport: null, args: ['--no-sandbox', `--window-size=${vw},1100`] }
  : { headless: 'shell', args: ['--no-sandbox'] });
const page = (await browser.pages())[0] || await browser.newPage();
if (!open) await page.setViewport({ width: vw, height: 1100 });

await page.evaluateOnNewDocument((scene, theme) => {
  localStorage.setItem('pv-theme', theme);

  const UID = '00000000-0000-4000-8000-00000000a001';
  const REPORT = {
    airline: 'zipair', airline_other: null, position: 'cap', fleet: 'a380',
    base_iata: 'ITM', period_year: 2026, period_month: 8, period_ym: 2026 * 12 + 8,
    contract_type: 'direct',
    currency: 'JPY', fx_to_jpy: 1, fx_to_usd: 0.0067,
    annual_total_orig: 27000000, annual_total_jpy: 27000000, annual_total_usd: 180900,
    source: 'payslip', created_at: '2026-08-05T00:00:00Z'
  };

  /* 仕様どおり、最初の3問は boost の3問（希望休 → Bidding → 中途採用）。
     再確認の場面だけ、前回の答え（mine_code）を付けて1問返す。 */
  const Q = (id, mine_code) => ({ id: id, mine_code: mine_code || null });
  const QUESTIONS = scene === 'again'
    ? { questions: [Q('days_off_request', 'yes')], mine_count: 7 }
    : { questions: [Q('days_off_request'), Q('schedule_bidding'), Q('external_hiring')],
        mine_count: 0 };

  /* 詳細ページの初期表示。★親（days_off_request / training_bond）に答えた形にして、
     ぶら下がる子（日数・拘束年数・金額）が出ているところまで撮れるようにする。 */
  const A = (question_id, o) => Object.assign({
    airline: 'zipair', question_id: question_id, code: null, codes: null, num: null,
    currency: null, text: null, json: null, year: 2026, month: 8,
    updated_at: '2026-08-18T00:00:00Z'
  }, o);
  const MINE = [
    A('days_off_request', { code: 'yes' }),
    A('days_off_request_limit', { num: 4 }),
    A('reserve_duty', { code: 'no' }),
    A('training_bond', { code: 'yes' }),
    A('training_bond_years', { num: 5 }),
    A('training_bond_amount', { num: 3000000, currency: 'JPY' }),
    A('annual_leave_days', { num: 20 })
  ];

  const RPC = {
    my_airline_conditions: () => ({
      ok: true, answers: scene === 'pick' ? [] : MINE,
      answered_total: scene === 'pick' ? 0 : MINE.length, questions_total: 26
    }),
    my_pay_reports: () => ({
      ok: true, reports: (scene === 'nopay' || scene === 'pick') ? [] : [REPORT],
      report_count: (scene === 'nopay' || scene === 'pick') ? 0 : 1,
      streak_months: 1, access_until: new Date(Date.now() + 62 * 86400000).toISOString(),
      badge: 'silver', badge_state: 'active', mail_optin: false, pay_day_of_month: 5
    }),
    next_condition_questions: () => Object.assign({ ok: true, airline: 'zipair' }, QUESTIONS),
    submit_airline_conditions: () => ({ ok: true, airline: 'zipair', saved: 1, skipped: 0, rejected: [] })
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
      if (t === 'profiles') return q([{
        id: UID, name: 'Sample Pilot', email: 'pilot@example.com',
        gender: 'male', birthdate: '1988-04-12', country: '日本',
        company: 'ZIPAIR', position: 'captain',
        created_at: '2026-01-11T00:00:00Z', email_opt_in: true
      }]);
      return q([]);
    },
    /* ★本物の supabase-js が返すのは「then だけを持つ箱」で、catch も finally も無い。
       async にすると本物の Promise になり、本番には無い .catch が生えてしまう
       （2026-08-19、それで詳細ページが本番だけ真っ白になるのを撮り逃した）。
       ここは本物と同じ形に保つ。assert-conditions.mjs の偽物も同じ。 */
    rpc: (name) => {
      // 保存だけ失敗させる（保存できなかったときの見た目を撮るため）
      const res = (name === 'submit_airline_conditions' && scene === 'fail')
        ? { data: null, error: { message: 'stub' } }
        : { data: RPC[name] ? RPC[name]() : { ok: true }, error: null };
      return { then: (ok, ng) => Promise.resolve(res).then(ok, ng) };
    }
  };
  /* 後から読まれる CDN の supabase-js が上書きしてくるので跳ね返す（shot-tracker.mjs と同じ）。 */
  Object.defineProperty(window, 'supabase', {
    value: { createClient: () => FAKE }, writable: false, configurable: false
  });
}, scene, theme);

/* 読み込みそのものを失敗させて、そのときの見た目を撮る。
   質問の台帳（pv-conditions.json）が届かない＝通信が切れたときと同じ状態。 */
if (scene === 'dead') {
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (/pv-conditions\.json/.test(r.url())) r.abort().catch(() => {});
    else r.continue().catch(() => {});
  });
}

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2200));   // init → my_pay_reports → 二次カード

/* 詳細ページは全部の節を開いて撮る（既定では先頭の1節しか開いていない）。 */
if (scene === 'detail') {
  await page.evaluate(() => {
    document.querySelectorAll('.pvcf-sec').forEach((x) => { x.open = true; });
  });
  await new Promise((r) => setTimeout(r, 300));
}

/* ★ここが本番と同じ入口。pay-report.html の renderResult 末尾が渡すのと同じ形。 */
if (!NO_MODAL) {
  await page.evaluate(() => {
    const sb = window.supabase.createClient();
    /* 社名は本番と同じところから引く（英語版では英語名になる）。
       pay-report.html は自分のフォームの select の表示文字を渡している。 */
    const en = document.documentElement.getAttribute('lang') === 'en';
    const hit = (window.PV_AIRLINES || []).filter((a) => window.PV_slugOf(a) === 'zipair')[0];
    window.PVConditions.afterReport({
      sb: sb, airline: 'zipair', airline_other: null,
      airlineName: hit ? (en ? hit.en : hit.name) : '',
      year: 2026, month: 8, position: 'cap', fleet: 'a380',
      base_iata: 'ITM', contract_type: 'direct'
    });
  });
  await new Promise((r) => setTimeout(r, 1400));   // modal_delay_ms(700) ＋ 描画
}

/* 答えを進める。1問ずつ即保存なので、押すたびに次の問へ移る。 */
const advance = async (times) => {
  for (let k = 0; k < times; k++) {
    await page.evaluate(() => {
      const b = document.querySelector('[data-pvc] .pvc-opt');
      if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 700));
  }
};
if (scene === 'q2')   await advance(1);
if (scene === 'done') await advance(3);
if (scene === 'fail') await advance(1);   // 保存が落ちるので1問目に留まったまま警告が出る

if (open) {
  console.log(`開きました（${scene} / ${lang} / ${theme} / ${vw}px）。窓を閉じると終わります。`);
  /* ★ここを `browser.waitForTarget(() => false)` で待たない。
     puppeteer の待ち時間の既定は30秒で、時間切れの例外を握りつぶすと
     そのまま process.exit(0) に落ちて、**誰も触っていないのに窓が消える**
     （2026-08-19 に実際に起きた。渡した3つの窓が30秒で勝手に閉じた）。
     待つべきは時間ではなく「窓が閉じられたこと」＝ブラウザとの接続が切れたこと。 */
  await new Promise((r) => browser.on('disconnected', r));
  process.exit(0);
}

/* ── 何が出ているべきかを先に判定する ───────────────────────── */
const found = await page.evaluate(() => ({
  modal: !!document.querySelector('[data-pvc]'),
  cta:   !!document.querySelector('[data-pvc-cta]')
}));

if (NO_MODAL && found.modal) {
  await browser.close();
  console.error(`❌ ${scene} なのにモーダルが開いている`);
  process.exit(1);
}
if (DETAIL) {
  const seen = await page.evaluate(() => ({
    q:    document.querySelectorAll('.pvcf-q:not([hidden])').length,
    hid:  document.querySelectorAll('.pvcf-q[hidden]').length,
    sec:  document.querySelectorAll('.pvcf-sec').length,
    pick: !!document.querySelector('#pvcf-air'),
    count: (document.querySelector('#pvcf-count') || {}).textContent || '',
    voices: !!document.querySelector('[data-pvcf-voices]'),
    dead: !!document.querySelector('[data-pvcf-dead]'),
    skel: document.querySelectorAll('.mr-skel').length
  }));
  const want = scene === 'pick';
  if (scene === 'dead') {
    if (!seen.dead || seen.skel) {
      await browser.close();
      console.error(`❌ 読み込みに失敗したのに知らせが出ていない（dead=${seen.dead} 骨組み=${seen.skel}）`);
      process.exit(1);
    }
  } else if (seen.pick !== want) {
    await browser.close();
    console.error(want ? '❌ 会社を選ぶ画面が出ていない' : '❌ 会社が決まっているのに選択画面が出ている');
    process.exit(1);
  }
  if (scene !== 'dead' && !want && (seen.sec !== 4 || !seen.voices)) {
    await browser.close();
    console.error(`❌ 節が4つ揃っていない（sec=${seen.sec} voices=${seen.voices}）`);
    process.exit(1);
  }
  if (scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await new Promise((r) => setTimeout(r, 250));
  }
  await page.screenshot({ path: outPath, fullPage: full });
  const over2 = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const list = [];
    for (const el of document.querySelectorAll('#pv-conditions, #pv-conditions *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > w + 1 || r.left < -1) list.push(el.className || el.tagName);
    }
    return list;
  });
  const tap2 = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(
      '#pv-conditions .pvc-opt, #pv-conditions .pvcf-num, #pv-conditions .pvcf-sel,'
      + ' #pv-conditions .pvcf-sum, #pv-conditions .pvc-more, #pv-conditions .pvc-btn')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 10) || el.className;
      out.push({ t: t, w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  });
  const type2 = await page.evaluate(() => {
    const out = [];
    for (const c of ['.pvcf-t', '.pvcf-air', '.pvcf-lead', '.pvcf-count', '.pvcf-sum',
                     '.pvcf-lab', '.pvcf-help', '.pvcf-unit', '.pvcf-voices-t', '.pvcf-voices-s']) {
      const el = document.querySelector('#pv-conditions ' + c);
      if (!el) continue;
      const s = getComputedStyle(el);
      out.push(`${c} ${Math.round(parseFloat(s.fontSize))}px/${s.lineHeight} w${s.fontWeight} ${s.color}`);
    }
    return out;
  });
  await browser.close();
  console.log(outPath);
  console.log('質問:', `出ている ${seen.q} / 隠れている ${seen.hid}`, '｜節', seen.sec, '｜', seen.count);
  console.log('はみ出し:', over2.length ? over2.join(' / ') : 'なし');
  const small2 = tap2.filter((x) => x.h < 44);
  console.log('タップ領域:', tap2.map((x) => `${x.t} ${x.w}×${x.h}`).join(' | '));
  console.log('44px未満:', small2.length ? small2.map((x) => `${x.t} h=${x.h}`).join(' / ') : 'なし');
  console.log('文字:', type2.join(' | '));
  process.exit(0);
}
if (scene === 'nopay' && found.cta) {
  await browser.close();
  console.error('❌ 給与が1件も無いのに二次カードが出ている');
  process.exit(1);
}
if (scene === 'cta' && !found.cta) {
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log(outPath);
  console.error('❌ 二次カードが出ていない');
  process.exit(1);
}
if (!NO_MODAL && !found.modal) {
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log(outPath);
  console.error('❌ モーダルが出ていない');
  process.exit(1);
}

/* ── 撮る ───────────────────────────────────────────────
   ★clip は使わない。マイページはスクロールするので、clip の座標系（文書基準）と
     boundingBox（フレーム基準）を取り違えて別の場所が写る。要素そのものを撮る。 */
const target = scene === 'cta' ? '[data-pvc-cta]' : '[data-pvc] .pvc-modal';
const el = await page.$(target);
if (full || scene === 'nopay') {
  await page.screenshot({ path: outPath, fullPage: scene === 'nopay' });
} else {
  await el.scrollIntoView();
  await new Promise((r) => setTimeout(r, 250));
  await el.screenshot({ path: outPath });
}

if (scene === 'nopay') {
  await browser.close();
  console.log(outPath);
  console.log('モーダルも二次カードも出ていない（この場面ではそれが正しい）');
  process.exit(0);
}

/* ★横はみ出しはスクショに写らない（はみ出した分は撮れない）ので数えて出す。 */
const root = scene === 'cta' ? '[data-pvc-cta]' : '[data-pvc]';
const over = await page.evaluate((root) => {
  const w = document.documentElement.clientWidth;
  const list = [];
  for (const el of document.querySelectorAll(root + ', ' + root + ' *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > w + 1 || r.left < -1) list.push(el.className || el.tagName);
  }
  return list;
}, root);

/* タップ領域は44px以上（仕様 §26）。押せるもの全部を測って出す。 */
const tap = await page.evaluate((root) => {
  const sel = ['.pvc-opt', '.pvc-skip', '.pvc-x', '.pvc-more', '.pvc-btn']
    .map((c) => root + ' ' + c).join(',');
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 12) || el.className;
    out.push({ t: t, w: Math.round(r.width), h: Math.round(r.height) });
  }
  return out;
}, root);

/* 文字の大きさは目で測らずブラウザに聞く（「見出しが32pxだが参照は24px」を言うため）。 */
const type = await page.evaluate((root) => {
  const out = [];
  for (const c of ['.pvc-eyebrow', '.pvc-air', '.pvc-q', '.pvc-help', '.pvc-opt',
                   '.pvc-step', '.pvc-skip', '.pvc-done', '.pvc-warn',
                   '.pvc-cta-t', '.pvc-cta-s']) {
    const el = document.querySelector(root + ' ' + c);
    if (!el) continue;
    const s = getComputedStyle(el);
    out.push(`${c} ${Math.round(parseFloat(s.fontSize))}px/${s.lineHeight} w${s.fontWeight} ${s.color}`);
  }
  return out;
}, root);

const box = await page.evaluate((t) => {
  const el = document.querySelector(t);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return `${Math.round(r.width)}×${Math.round(r.height)} padding ${s.padding} radius ${s.borderRadius}`;
}, target);

await browser.close();
console.log(outPath);
console.log('枠:', box);
console.log('はみ出し:', over.length ? over.join(' / ') : 'なし');
const small = tap.filter((x) => x.h < 44);
console.log('タップ領域:', tap.map((x) => `${x.t} ${x.w}×${x.h}`).join(' | '));
console.log('44px未満:', small.length ? small.map((x) => `${x.t} h=${x.h}`).join(' / ') : 'なし');
console.log('文字:', type.join(' | '));
