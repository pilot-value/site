/* ════════════════════════════════════════════════════════════════
   assert-i18n-pay.mjs — 言語を変えても、送る給与の中身が1つも変わらない（2026-11-02・多言語化の段2）

   いちばん大事な合格条件（計画「確かめ方」）
     同じ架空の給与を 日本語・英語・スペイン語 の給与フォームに入れると、
     サーバーへ送る中身（buildPayload の答え）が、言語の印（lang）のほかは1文字も違わない。
     ＝ 会社・職位・機材・金額・通貨・期間・区分・内訳が言語で変わらない。

   ほかに見ること
     ・スペイン語のページだけ「3500,50」を 3500.5 と読む（スペイン・中南米の多くは , が小数点）。英語・日本語は今までどおり。
     ・「3.500,50」はどの言語でも 3500.5（点とカンマが両方あれば後ろが小数点）。
     ・スペイン語のページは lang='es' を送る。英語は 'en'、日本語は今までの値のまま。
     ・スペイン語のページで画面の台本がエラーを出さない。

   使うサーバー：serve-local.mjs を使い捨ての保存先で自分で立てる（本番には1本もつながらない・3000 番は使わない）。
   実行: node assert-i18n-pay.mjs
   ════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';
import { start } from './serve-local.mjs';

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + String(e).slice(0, 600) : ''))); };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-i18n-pay-'));
const srv = await start({ port: 3471, dir, quiet: true, reset: true });
if (srv.port === 3000) throw new Error('3000 番は使わない');
const browser = await puppeteer.launch({ headless: 'new' });

/* 同じ架空の給与（measure-pay.mjs と同じ値・どの段の必須も満たす） */
async function fill(page, money = {}) {
  await page.evaluate((money) => {
    localStorage.clear();
    const em = document.getElementById('entry-manual');
    if (em) em.click();
    const put = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    put('f-airline', 'emirates'); put('f-position', 'cap'); put('f-fleet', 'b777');
    put('f-jobrole', 'line');
    if (typeof syncRoleBoxes === 'function') syncRoleBoxes();
    put('f-age', '40-49');
    put('f-block', '86.5'); put('f-stay', '12');
    put('f-currency', 'AED');
    put('f-gross', money.gross ?? '77800'); put('f-netpay', '71600');
    put('f-perdiem', '6200');
    put('f-housing', 'allowance'); put('f-housing-amt', '17500');
    put('f-contract', 'direct'); put('f-taxcountry', 'AE');
    put('f-seniority', '12'); put('f-rankyears', '4');
    put('f-base', money.base ?? '48500');
    const d = document.getElementById('pay-detail');
    if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); }
    if (typeof pdAdd === 'function') pdAdd('var', true);
    const va = document.querySelector('#pd-var-rows .pd-amt:not(:disabled)');
    if (va) { va.value = '1000'; va.dispatchEvent(new Event('input', { bubbles: true })); va.dispatchEvent(new Event('change', { bubbles: true })); }
    /* 欄を離れたときの読み直し（moneySettle）も、人が操作したときと同じく通す */
    for (const el of document.querySelectorAll('input.money')) el.dispatchEvent(new Event('blur'));
  }, money);
  await new Promise((r) => setTimeout(r, 300));
}
async function payloadOf(rel, money) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  await page.emulateTimezone('Asia/Tokyo');
  await page.goto(`${srv.url}/${rel}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await fill(page, money);
  const p = await page.evaluate(() => {
    try { return { ok: true, v: buildPayload() }; } catch (e) { return { ok: false, v: String(e && e.message) }; }
  });
  const lang = await page.evaluate(() => ({ PV_LANG: window.PV_LANG, html: document.documentElement.lang }));
  await page.close();
  return { ...p, errs, lang };
}
/* 送る中身の金額は文字（"77800.5"）。欄の名前は buildPayload のまま（総支給 gross_monthly・基本給 base_pay） */
const grossOf = (v) => Number(v && v.gross_monthly);
const baseOf = (v) => Number(v && v.base_pay);
const strip = (v) => { const o = JSON.parse(JSON.stringify(v)); delete o.lang; return o; };
const diff = (a, b) => {
  const out = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(`${k}: ${JSON.stringify(a[k])} ≠ ${JSON.stringify(b[k])}`);
  return out;
};

console.log('\n▼ 同じ給与を3つの言語で入れる');
const ja = await payloadOf('pay-report.html');
const en = await payloadOf('en/pay-report.html');
const es = await payloadOf('es/pay-report.html');
for (const [n, r] of [['日本語', ja], ['英語', en], ['スペイン語', es]]) {
  ok(r.ok && r.v && typeof r.v === 'object', `${n}：送る中身を作れた`, r.ok ? '' : r.v);
  ok(!r.errs.length, `${n}：画面の台本のエラーが無い`, r.errs.join(' | '));
}
ok(es.lang.PV_LANG === 'es' && /^es/.test(es.lang.html), 'スペイン語のページだと分かっている（PV_LANG と <html lang>）', JSON.stringify(es.lang));
if (ja.ok && en.ok && es.ok) {
  const dJE = diff(strip(ja.v), strip(en.v));
  const dES = diff(strip(en.v), strip(es.v));
  ok(!dES.length, '★英語とスペイン語で、送る中身が言語の印のほかは1文字も違わない', dES.join('\n     '));
  ok(!dJE.length, '★日本語と英語で、送る中身が言語の印のほかは1文字も違わない', dJE.join('\n     '));
  ok(es.v.lang === 'es', 'スペイン語のページは lang=es を送る', es.v.lang);
  ok(en.v.lang === 'en', '英語のページは今までどおり lang=en', en.v.lang);
  ok(grossOf(es.v) === 77800 && baseOf(es.v) === 48500, '総支給 77800・基本給 48500 が入っている', JSON.stringify({ g: es.v.gross_monthly, b: es.v.base_pay }));
}

console.log('\n▼ 金額の書き方（言語ごとの読み方）');
const esComma = await payloadOf('es/pay-report.html', { gross: '77800,50' });
ok(esComma.ok && grossOf(esComma.v) === 77800.5, '★スペイン語：「77800,50」は 77800.5（100倍にならない）', esComma.ok ? grossOf(esComma.v) : esComma.v);
const enComma = await payloadOf('en/pay-report.html', { gross: '77800,50' });
ok(enComma.ok && grossOf(enComma.v) === 7780050, '英語：「77800,50」は今までどおり 7780050（カンマはけた区切り・2026-09-15 オーナー決定）', enComma.ok ? grossOf(enComma.v) : enComma.v);
for (const [rel, n] of [['es/pay-report.html', 'スペイン語'], ['en/pay-report.html', '英語']]) {
  const r = await payloadOf(rel, { base: '3.500,50' });
  ok(r.ok && baseOf(r.v) === 3500.5, `${n}：「3.500,50」は 3500.5（点とカンマが両方あれば後ろが小数点）`, r.ok ? baseOf(r.v) : r.v);
}

await browser.close();
await srv.close?.();
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n==== ${pass}/${pass + fail} passed ====`);
process.exit(fail ? 1 : 0);
