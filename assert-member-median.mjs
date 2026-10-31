/* ══════════════════════════════════════════════════════════════════
   assert-member-median.mjs — 会社ページが、会員の中央値をその場で差し替えるか（2026-10-31）
   ══════════════════════════════════════════════════════════════════
   オーナー：「提出のたびにすぐ変える」「中央値を出した航空会社は推定年収じゃなくて中央値に」。
   career-live.js が pv_member_medians（サーバーが書き込みのたびに数えて保存した表を引くだけ）を読んで、
   推定年収の欄を差し替える。決まりは台帳 salary-basis.mjs → HTML の data-*：
     always（ANA・JAL）＝ いつも中央値／higher（ほか）＝ 中央値が base（中央値に替える前の推定）を超えたときだけ。

   見るもの（サーバーの返事は、ここで作り物に置き換える。本番には1本も出さない）
     A) ANA：中央値をもらうと額・見出し「◯◯の中央値」・棒の下「会員が出した年収の中央値」・説明の「時点」が替わる
     B) スカイマーク：機長は中央値が推定を超えたので中央値／副操縦士は中央値が base より低いので推定に戻る（棒の下は職位ごと）
     C) 返事が失敗したら1文字も変えない（書き込んである額のまま）
     D) 2人に届く組が1つも無い返事：always はそのまま・higher の中央値の職位は推定に戻る
     E) 英語のページでは、差し替えた額もドルで出る（currency.js と同じ作り方）
     F) 差し替えたあとに通貨を替えても、額がその通貨になる
   使い方：node serve.mjs を立ててから node assert-member-median.mjs
   ══════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import { curCore } from './cur-core.mjs';
import { SALARY } from './salary-data.mjs';
import { BASIS } from './salary-basis.mjs';

const BASE = 'http://localhost:3000';
const LIBS = /(^|\.)(cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
let pass = 0, fail = 0;
const ok = (c, msg, got = '') => { if (c) { pass++; console.log(`  ✅ ${msg}`); } else { fail++; console.log(`  ❌ ${msg}${got !== '' ? `\n      ${got}` : ''}`); } };
const yenJa = m => `¥${m.toLocaleString('en-US')}万`;
const USD = await curCore('USD', 'en');

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
async function open(path, reply, cur) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 1000 });
  const seen = { asked: 0, body: null };
  await p.setRequestInterception(true);
  p.on('request', r => {
    let u; try { u = new URL(r.url()); } catch { return r.continue(); }
    if (['data:', 'blob:', 'about:'].includes(u.protocol)) return r.continue();
    if (u.origin === BASE || LIBS.test(u.hostname)) return r.continue();
    if (/\.supabase\.co$/.test(u.hostname)) {
      const cors = { 'access-control-allow-origin': '*' };
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': r.headers()['access-control-request-headers'] || '*' } });
      if (u.pathname.endsWith('/rpc/pv_member_medians')) {
        seen.asked++; try { seen.body = JSON.parse(r.postData() || 'null'); } catch { seen.body = null; }
        return reply.status === 200
          ? r.respond({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(reply.rows) })
          : r.respond({ status: reply.status, contentType: 'application/json', headers: cors, body: '{"code":"XX000","message":"stub"}' });
      }
      return r.respond({ status: 404, contentType: 'application/json', headers: cors, body: '{"code":"PGRST202","message":"stub"}' });
    }
    return r.abort();
  });
  /* 通貨はページごとに決めて置く（前の場面で替えた通貨を持ち越さない）。日本語は円・英語は渡したもの */
  await p.evaluateOnNewDocument(c => { try { localStorage.setItem('pv-currency', 'JPY'); localStorage.setItem('pv-currency-en', c); } catch {} }, cur || 'USD');
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !!document.querySelector('.pvg-pay .pvg-rank'), { timeout: 30000 });
  for (let i = 0; i < 100 && !seen.asked; i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 600));
  return { p, seen };
}
const read = p => p.evaluate(() => {
  const q = (sel, root = document) => root.querySelector(sel);
  const rank = rk => { const r = q(`.pvg-pay .pvg-rank[data-rank="${rk}"]`); return r && { big: q('.pvg-big', r).textContent.trim(), tail: q('.pvg-rk-s', r).textContent.trim(), bar: q('.pvg-bar', r).style.width, med: r.getAttribute('data-med') }; };
  const asOf = rk => { const d = q(`.pvg-dl [data-rank="${rk}"] dd`); return d ? [...d.querySelectorAll('small')].map(x => x.textContent.trim()) : null; };
  return { cap: rank('cap'), fo: rank('fo'), estk: (q('.pvg-pay .pvg-estk') || {}).textContent, asCap: asOf('cap'), asFo: asOf('fo') };
});
const topOf = async (p, rk) => Number(await p.$eval(`.pvg-pay .pvg-rank[data-rank="${rk}"]`, e => e.getAttribute('data-top')));
const w = (man, top) => Math.min(100, man / top * 100).toFixed(2);
const pct = s => Number.parseFloat(s).toFixed(2);   // 「75%」と「75.00%」は同じ

console.log('A) ANA：中央値をもらうと、額・見出し・棒の下・説明の時点が替わる');
{
  const { p, seen } = await open('/airlines/ana.html', { status: 200, rows: [{ rank: 'cap', median_man: 3000 }, { rank: 'fo', median_man: 1500 }] });
  const x = await read(p), top = await topOf(p, 'cap');
  ok(seen.asked === 1 && seen.body && seen.body.p_airline === 'ana', '会社のコードを1回だけ渡して聞く', JSON.stringify(seen));
  ok(x.cap.big === yenJa(3000) && x.fo.big === yenJa(1500), '額が中央値になる（機長 ¥3,000万・副操縦士 ¥1,500万）', `${x.cap.big} / ${x.fo.big}`);
  ok(x.cap.tail === 'の中央値' && x.fo.tail === 'の中央値', '見出しは「◯◯の中央値」', `${x.cap.tail} / ${x.fo.tail}`);
  ok(x.estk === '会員が出した年収の中央値', '棒の下は「会員が出した年収の中央値」', x.estk);
  ok(pct(x.cap.bar) === w(3000, top) && pct(x.fo.bar) === w(1500, top), '棒の長さは中央値どおり', `${x.cap.bar} / ${x.fo.bar}`);
  ok(x.asCap && x.asCap[1] === '時点：最新の提出まで', '説明の「時点」は「最新の提出まで」', JSON.stringify(x.asCap));
  /* F) 通貨を替えると、差し替えた額もその通貨になる */
  await p.evaluate(() => window.PVCurrency.set('EUR'));
  await new Promise(r => setTimeout(r, 300));
  const e = await read(p);
  ok(/€/.test(e.cap.big) && !/万/.test(e.cap.big), 'F) 差し替えたあとに通貨を EUR にすると、額がユーロになる', e.cap.big);
  await p.close();
}

console.log('B) スカイマーク：機長は推定を超えたので中央値／副操縦士は base より低いので推定に戻る');
{
  const capBase = SALARY.skymark.cap.avg, foBase = BASIS.skymark.fo.base;
  const { p } = await open('/airlines/skymark.html', { status: 200, rows: [{ rank: 'cap', median_man: capBase + 100 }, { rank: 'fo', median_man: foBase - 50 }] });
  const x = await read(p);
  ok(x.cap.big === yenJa(capBase + 100) && x.cap.tail === 'の中央値', `機長：中央値 ${yenJa(capBase + 100)} が推定 ${yenJa(capBase)} を超えたので中央値`, `${x.cap.big} ${x.cap.tail}`);
  ok(x.fo.big === yenJa(foBase) && x.fo.tail === 'の推定年収' && x.fo.med === '0', `副操縦士：中央値が base ${yenJa(foBase)} より低いので、推定 ${yenJa(foBase)} に戻る`, `${x.fo.big} ${x.fo.tail} med=${x.fo.med}`);
  ok(x.estk === '副操縦士は当サイトの推定・機長は会員が出した年収の中央値', '棒の下は職位ごと', x.estk);
  await p.close();
}

console.log('C) 返事が失敗したら、1文字も変えない');
{
  const { p } = await open('/airlines/ana.html', { status: 500 });
  const x = await read(p);
  ok(x.cap.big === yenJa(SALARY.ana.cap.avg) && x.fo.big === yenJa(SALARY.ana.fo.avg), '書き込んである額のまま', `${x.cap.big} / ${x.fo.big}`);
  ok(x.cap.tail === 'の中央値' && x.estk === '会員が出した年収の中央値', '見出しと棒の下も書き込んであるまま', `${x.cap.tail} / ${x.estk}`);
  await p.close();
}

console.log('D) 2人に届く組が無い返事：always はそのまま・higher の中央値の職位は推定に戻る');
{
  const a = await open('/airlines/ana.html', { status: 200, rows: [] });
  const x = await read(a.p);
  ok(x.cap.big === yenJa(SALARY.ana.cap.avg) && x.cap.tail === 'の中央値', 'ANA（always）は書き込んである中央値のまま', `${x.cap.big} ${x.cap.tail}`);
  await a.p.close();
  const b = await open('/airlines/skymark.html', { status: 200, rows: [] });
  const y = await read(b.p);
  ok(y.fo.big === yenJa(BASIS.skymark.fo.base) && y.fo.tail === 'の推定年収', `スカイマークの副操縦士（higher）は推定 ${yenJa(BASIS.skymark.fo.base)} に戻る`, `${y.fo.big} ${y.fo.tail}`);
  ok(y.estk === '当サイトの推定', '棒の下は「当サイトの推定」', y.estk);
  await b.p.close();
}

console.log('E) 英語のページ：差し替えた額もドルで出る');
{
  const { p } = await open('/en/airlines/ana.html', { status: 200, rows: [{ rank: 'cap', median_man: 3000 }, { rank: 'fo', median_man: 1500 }] }, 'USD');
  const x = await read(p);
  ok(x.cap.big === USD.fmt(30000000) && x.fo.big === USD.fmt(15000000), `額は ${USD.fmt(30000000)}・${USD.fmt(15000000)}（currency.js と同じ作り方）`, `${x.cap.big} / ${x.fo.big}`);
  ok(/median pay/.test(x.cap.tail) && x.estk === 'Median of pay submitted by members', '読み上げは median pay・棒の下は Median of pay submitted by members', `${x.cap.tail} / ${x.estk}`);
  await p.close();
}

await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
