/* 口コミの訳の埋め戻し（言語を足したとき）── translate-review を少しずつ呼ぶ。
   2026-11-02 にスペイン語を足した。それより前の口コミは日英の訳しか持っていないので、
   スペイン語のページでは英語の訳が出る（review-i18n.js が英語へ落とす）。これを流すとスペイン語の訳が足される。

   ⚠️ 本番の DB に書き込み、AI を呼ぶ（1件あたり2回）＝課金される。check.mjs に入れない。オーナーの OK のあとに流す。
   ⚠️ 先に translate-review（日英西にしたもの）を Deploy しておく。古い版は backfill を知らないので何もしない（0件で止まる）。

   使い方
     node db/backfill-review-lang.mjs es            残りの件数だけ出す（AI を呼ばない・費用ゼロ）
     node db/backfill-review-lang.mjs es --run      3件ずつ、残りが無くなるまで訳す
     node db/backfill-review-lang.mjs es --run --max 30   最大30件で止める

   関数に PV_WEBHOOK_SECRET を入れてあるときは、同じ値を環境変数 PV_WEBHOOK_SECRET で渡す
   （例：node --env-file=<mail-bot/.env の場所> db/backfill-review-lang.mjs es --run）。

   決まり（関数の側）
     ・前からある訳は書き換えない。足すのは、その言語の訳がまだ無い行だけ。
     ・本文は関数が DB から読む。ここからは本文を1文字も送らない。 */
import { readFileSync } from 'fs';

const [LANG = ''] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const RUN = process.argv.includes('--run');
const MAX = Number((process.argv[process.argv.indexOf('--max') + 1]) || 0) || Infinity;
if (!['ja', 'en', 'es'].includes(LANG)) { console.error('使い方: node db/backfill-review-lang.mjs <ja|en|es> [--run] [--max N]'); process.exit(1); }

/* URL と anon キーはページから読む（smoke-parse-payslip.mjs と同じ。書き写さない） */
const html = readFileSync(new URL('../pay-report.html', import.meta.url), 'utf8');
const URL_ = (html.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
const ANON = (html.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/) || [])[0];
if (!URL_ || !ANON) { console.error('❌ pay-report.html から URL / anon キーを取れない'); process.exit(1); }
const FN = `${URL_}/functions/v1/translate-review`;

async function call(body) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}`, apikey: ANON };
  if (process.env.PV_WEBHOOK_SECRET) headers['x-pv-webhook-secret'] = process.env.PV_WEBHOOK_SECRET;
  const r = await fetch(FN, { method: 'POST', headers, body: JSON.stringify(body) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* 下で出す */ }
  if (!r.ok || !j) throw new Error(`関数が ${r.status} を返した: ${t.slice(0, 200)}`);
  return j;
}

const c = await call({ backfill: LANG, count: true });
if (typeof c.remaining !== 'number') {
  console.error('❌ 残りの件数が返らない（関数が古い版のまま＝日英西の版を Deploy していない？）', JSON.stringify(c).slice(0, 200));
  process.exit(1);
}
console.log(`${LANG} の訳がまだ無い口コミ: ${c.remaining} 件`);
if (!RUN) { console.log('（訳すときは --run。1件あたり AI を2回呼ぶ）'); process.exit(0); }

let done = 0, skip = 0;
while (done < MAX) {
  const j = await call({ backfill: LANG, offset: skip, limit: Math.min(3, MAX - done) });
  const res = Array.isArray(j.results) ? j.results : [];
  if (!res.length) break;
  for (const x of res) {
    if (x.status === 'translated') done++;
    else skip++;            // 訳せなかった行は飛ばして先へ（次の呼び出しで同じ行を取り直さない）
    console.log(`  ${x.status.padEnd(18)} ${x.id}${x.detail ? '  ' + String(x.detail).slice(0, 100) : ''}`);
  }
}
const after = await call({ backfill: LANG, count: true });
console.log(`訳した ${done} 件 / 飛ばした ${skip} 件 / 残り ${after.remaining} 件`);
