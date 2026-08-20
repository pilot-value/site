/* parse-payslip の疎通確認。
   デプロイ直後に「本当に動いているのか」を推測でなく実測で決める。

   ★段1〜3は API を1回も呼ばない＝**費用ゼロ**。
     関数の中で Anthropic を叩くより手前で弾かれる経路だけを踏むため。
     しかも返ってくる理由コードが状態を一意に決める：
       404              → デプロイされていない
       500 server_misconfigured → デプロイ済みだが secret が足りない
       400 no_image     → デプロイ＋secret どちらも入っている（＝正常）

   段4だけ本物の画像を送るので **1枚あたり ≒ $0.02 かかる**。
   既定では走らない。--live を付けたときだけ。

   実行:
     node db/smoke-parse-payslip.mjs             # 費用ゼロ。ここまでで十分
     node db/smoke-parse-payslip.mjs --live      # 実画像1枚（≒$0.02）
     node db/smoke-parse-payslip.mjs --live-cap  # ★上限まで回す（≒$0.60）

   ★2026-08-14 に1人あたりの上限を「ログインの有無によらず1日30回」へ変えた。
     以前の --live は「2回目が 429 で止まる」を見ていたが、いまは2回目も通る
     （＝もう1枚ぶん課金される）ので、上限の確認は --live-cap に分けてある。
   ★--live はこの回線の今日の枠を1回、--live-cap は残り全部を使う。
     同じ回線のブラウザから未ログインで試すぶんが今日は減るので注意。 */
import { readFileSync } from 'fs';

const LIVE_CAP = process.argv.includes('--live-cap');
const LIVE = LIVE_CAP || process.argv.includes('--live');

/* URL と anon キーはページから読む（＝本番のブラウザと同じものを使う。
   ここに書き写すと、片方だけ差し替わったときに気づけない）。 */
const html = readFileSync(new URL('../pay-report.html', import.meta.url), 'utf8');
const URL_ = (html.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
const ANON = (html.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/) || [])[0];
if (!URL_ || !ANON) { console.error('❌ pay-report.html から URL / anon キーを取れない'); process.exit(1); }

const FN = `${URL_}/functions/v1/parse-payslip`;
let pass = 0, fail = 0;
const ok = (c, msg, extra = '') => { c ? (pass++, console.log(`  ✅ ${msg}`)) : (fail++, console.log(`  ❌ ${msg}${extra ? '\n     ' + extra : ''}`)); };

async function call(body) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* 本文が JSON でないこともある */ }
  return { status: res.status, json };
}

console.log(`\n${FN}\n`);

// ── 段1：そもそも生きているか（費用ゼロ）─────────────────────
console.log('段1 デプロイと secret');
const r1 = await call({});
if (r1.status === 404) {
  console.log('  ❌ 404 — parse-payslip がデプロイされていない');
  process.exit(1);
}
if (r1.status === 500 && r1.json?.reason === 'server_misconfigured') {
  console.log('  ❌ 500 server_misconfigured — デプロイはされているが secret が足りない');
  console.log('     Edge Functions → Secrets に ANTHROPIC_API_KEY と PV_IP_SALT があるか確認');
  process.exit(1);
}
ok(r1.status === 400 && r1.json?.reason === 'no_image',
   `画像なし → 400 no_image（デプロイ＋secret 両方OK）`,
   `実際: ${r1.status} ${JSON.stringify(r1.json)}`);

// ── 段2：入口の門番（費用ゼロ・回数も消費しない）──────────────
console.log('段2 入口の検査（Anthropic を呼ぶ手前で弾く）');
const r2 = await call({ image_b64: 'x'.repeat(8_500_001), mime: 'image/jpeg' });
ok(r2.status === 413 && r2.json?.reason === 'image_too_large', '大きすぎる画像 → 413',
   `実際: ${r2.status} ${JSON.stringify(r2.json)}`);

const r3 = await call({ image_b64: 'AAAA', mime: 'application/pdf' });
ok(r3.status === 415 && r3.json?.reason === 'bad_mime', 'PDF → 415 bad_mime',
   `実際: ${r3.status} ${JSON.stringify(r3.json)}`);

// ── 段3：GET は通さない（費用ゼロ）──────────────────────────
const r4 = await fetch(FN, { method: 'GET', headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
ok(r4.status === 405 || r4.status === 401, `GET → ${r4.status}（POST 以外を通さない）`);

// ── 段4：本物を1枚（--live のときだけ・課金あり）───────────────
if (LIVE) {
  console.log('\n段4 実画像1枚（≒$0.02）');
  const png = readFileSync(new URL('./fixtures/payslip-jp-major.png', import.meta.url));
  const b64 = png.toString('base64');

  const a = await call({ image_b64: b64, mime: 'image/png', lang: 'ja' });
  ok(a.status === 200 && a.json?.ok === true, '1回目 → 200 ok:true',
     `実際: ${a.status} ${JSON.stringify(a.json).slice(0, 300)}`);
  if (a.json?.ok) {
    const r = a.json.result;
    ok(Array.isArray(r.earnings) && r.earnings.length > 0, `earnings ${r.earnings?.length} 行`);
    ok(Array.isArray(r.hours), `hours ${r.hours?.length} 行`);
    ok(r.earnings?.every((e) => typeof e.kind === 'string' && e.kind), 'すべての行に kind が付いている');
    ok(!('deductions' in r), '控除の内訳を返していない（合計だけ）');
    console.log('     ' + JSON.stringify({ currency: r.currency, period: r.period,
      earnings: r.earnings?.map((e) => `${e.label}=${e.amount}(${e.kind})`),
      hours: r.hours?.map((h) => `${h.label}=${h.value}(${h.kind})`),
      deductions_total: r.deductions_total, net_pay: r.net_pay, unmapped: r.unmapped }, null, 0));
  }

  /* ★上限が本当に止まるか。ここが効いていないと、公開されている anon キーで
     全体の1日ぶん（既定 200回 ≒ $4）を短時間に使い切られ、そのあと来た人が
     全員使えなくなる。守っているのは財布ではなく可用性。
     ただし確かめるには上限の回数だけ実際に読ませることになるので、
     既定では走らせない（≒$0.60）。 */
  if (LIVE_CAP) {
    console.log('\n段5 1人あたりの上限（残り全部を使う・最大 ≒$0.60）');
    let last = null, calls = 1;              // 段4 の1回ぶんを数えに入れる
    for (; calls < 40; calls++) {
      last = await call({ image_b64: b64, mime: 'image/png', lang: 'ja' });
      if (last.status === 429) break;
    }
    ok(last?.status === 429 && last.json?.reason === 'rate_limited',
       `${calls} 回目 → 429 rate_limited（1人あたりの上限で止まる）`,
       `実際: ${last?.status} ${JSON.stringify(last?.json)}`);
    ok(typeof last?.json?.limit === 'number' && last.json.limit > 0,
       `返ってきた上限は ${last?.json?.limit} 回/日`);
  } else {
    console.log('\n段5 上限 … skip（--live-cap で実行。上限の回数ぶん課金 ≒$0.60）');
  }
} else {
  console.log('\n段4 実画像 … skip（--live で実行。1枚 ≒ $0.02）');
}

console.log(`\n${pass} pass / ${fail} fail\n`);
process.exit(fail ? 1 : 0);
