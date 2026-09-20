/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — ga-usage.mjs  v1.0
   「何人が来て、どこで諦めたか」を1コマンドで出す。

   ── なぜ要るか ────────────────────────────────────────────────
   db/usage.mjs は「出した数」しか分からない。2026-09-20、2日つづけて
   給与の投稿が0だったとき、それだけでは
     ・そもそも人が来ていないのか
     ・来たのに出さなかったのか
   を分けられなかった。**訪問は DB に一切残らない**（残るのは登録と投稿だけ）。
   打ち手は正反対になるので、ここを読めないと判断ができない。

   ── 設計上の約束 ──────────────────────────────────────────────
   1. **読むだけ。** GA4 の runReport を叩くだけで、何も書かない。
      鍵は GA4 の「閲覧者」権限しか持たない（課金も設定変更もできない）。
   2. **パッケージを足さない。** Node の crypto で JWT を署名してトークンを取る。
      このリポジトリにビルドツールを持ち込まないため。
   3. ★**素の訪問者数をそのまま実績にしない。** 下の BOT を見ること。

   ── ⚠️ 素の数字は水増しされている（2026-09-20 発見）──────────────
   シンガポールから毎日20〜60人が来ているが、見ているのは
   **英語の登録画面とログイン画面だけ**（9日間で336人・1人が1回ずつ開いて消える）。
   人ではなく自動化されたアクセス。登録は1件も成立していない。9/17 から急増した。
   素の数字で「増えた・減った」を語ると、この水増しがそのまま指標に乗る。
   **だから既定で除いて数え、素の数も併せて出す。**
   ⚠️ 国まるごとで除いているので、シンガポール在住の本物のパイロットも
      同時に落ちる。人数が動いたときは `--bot` で素の数と見比べること。

   ── 使い方 ────────────────────────────────────────────────────
     node ga-usage.mjs              直近14日
     node ga-usage.mjs --days 30
     node ga-usage.mjs --bot        ボットを除かない（素の数字）
     node ga-usage.mjs --pages      よく見られたページも出す

   ── 要るもの ──────────────────────────────────────────────────
     mail-bot/.env.ga.json … GA4 の読み取り鍵（gitignore 済み・.env.* に当たる）
     2026-09-20 にオーナーが発行。持ち主は pv-analytics-reader@…、権限は「閲覧者」だけ。
     無くした場合は Google Cloud Console でキーを作り直し、
     GA4 → 管理 → プロパティのアクセス管理 で閲覧者に追加する。

   ── ここで分からないこと ──────────────────────────────────────
   ・**誰が来たかは分からない。** GA4 は人を特定しない。本人と突き合わせるなら
     db/usage.mjs（登録・投稿）を見る。
   ・**GA4 の「投稿」と DB の件数は一致しない。** ここに出る pay_report_submit は
     ボタンが押された回数で、保存に失敗した分や動作確認も入る。
     ★**本当の投稿数は db/usage.mjs が正。**
   ・当日の数字は確定していない（GA4 の集計が追いつくまで数時間かかる）。
   ・⚠️ **デプロイ前チェック（check.mjs）に入れない。** ネットを叩くため。
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from 'fs';
import { createSign } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

/* 絶対パスを書かない（公開リポジトリ：ログイン名がそのまま漏れる）。 */
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const KEY_PATH = path.join(ROOT, 'mail-bot/.env.ga.json');
if (!existsSync(KEY_PATH)) {
  console.error('❌ GA4 の鍵がありません: mail-bot/.env.ga.json');
  console.error('   （このファイルは gitignore 済みなので clone には付いてきません。');
  console.error('     iCloud の Claude-Backup から戻すか、Google Cloud Console で作り直してください）');
  process.exit(1);
}
const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => {
  const i = argv.findIndex((a) => a === f || a.startsWith(f + '='));
  if (i < 0) return null;
  return argv[i].includes('=') ? argv[i].slice(argv[i].indexOf('=') + 1) : (argv[i + 1] ?? null);
};
const DAYS = Math.max(2, Number(val('--days') ?? 14) || 14);
const WITH_BOT = has('--bot');

/* ── 鍵でトークンを取る（依存ゼロ）── */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const iat = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: key.client_email,
  scope: 'https://www.googleapis.com/auth/analytics.readonly',
  aud: 'https://oauth2.googleapis.com/token',
  exp: iat + 3600, iat,
});
const jwt = unsigned + '.' + createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
})).json();
if (!tok.access_token) {
  console.error('❌ 鍵が通りませんでした:', JSON.stringify(tok).slice(0, 200));
  console.error('   GA4 側で「閲覧者」に追加されているか、鍵が失効していないか確認してください。');
  process.exit(1);
}
const AH = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };

/* ── プロパティは鍵から見えるものを使う（IDを書き写さない）── */
const sum = await (await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', { headers: AH })).json();
const P = (sum.accountSummaries ?? []).flatMap((a) => a.propertySummaries ?? [])[0]?.property;
if (!P) { console.error('❌ 見えるプロパティがありません（GA4 の閲覧者に入っていない可能性）'); process.exit(1); }

const d0 = new Date(Date.now() - (DAYS - 1) * 86400_000);
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const RANGE = [{ startDate: iso(d0), endDate: 'today' }];
/* ★ボットを外す。国まるごとなので、シンガポールの本物も一緒に落ちる（上の注意）。 */
const NOT_BOT = { notExpression: { filter: { fieldName: 'country', stringFilter: { matchType: 'EXACT', value: 'Singapore' } } } };
const andWith = (f) => (WITH_BOT ? f : (f ? { andGroup: { expressions: [NOT_BOT, f] } } : NOT_BOT));

const run = async (body) => {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/${P}:runReport`,
    { method: 'POST', headers: AH, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) { console.error('❌ GA4:', r.status, JSON.stringify(j).slice(0, 300)); process.exit(1); }
  return j.rows ?? [];
};
const pagePath = (v, m = 'EXACT') => ({ filter: { fieldName: 'pagePath', stringFilter: { matchType: m, value: v } } });
const dayKeys = [...Array(DAYS)].map((_, i) => iso(new Date(+d0 + i * 86400_000)).replace(/-/g, ''));
const WD = ['日', '月', '火', '水', '木', '金', '土'];

/* ── 1) 日別の人数 ── */
const pick = (rows, k = 0) => Object.fromEntries(rows.map((r) => [r.dimensionValues[0].value, r.metricValues[k].value]));
const [visit, rawVisit, realpay, form, events] = await Promise.all([
  run({ dateRanges: RANGE, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }], dimensionFilter: andWith(null) }),
  run({ dateRanges: RANGE, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }] }),
  run({ dateRanges: RANGE, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }], dimensionFilter: andWith(pagePath('actual-pay.html', 'CONTAINS')) }),
  run({ dateRanges: RANGE, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }], dimensionFilter: andWith(pagePath('pay-report.html', 'CONTAINS')) }),
  run({ dateRanges: RANGE, dimensions: [{ name: 'date' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: andWith(null), limit: 2000 }),
]);
const V = pick(visit), RV = pick(rawVisit), RP = pick(realpay), FM = pick(form);
const EV = {};
for (const r of events) (EV[r.dimensionValues[1].value] ??= {})[r.dimensionValues[0].value] = r.metricValues[0].value;
const ev = (name, d) => EV[name]?.[d] ?? '·';

console.log('\n━━ PILOT VALUE 訪問とつまずき（GA4）━━━━━━━━━━━━━━━━━');
console.log(`   期間: 直近${DAYS}日（${iso(Date.now())} 時点・日本時間）`);
console.log(WITH_BOT ? '   ⚠️ ボットを含む素の数字です' : '   シンガポール（ボット）を除いて数えています（--bot で素の数字）');
console.log('');
console.log('              訪問者  REAL PAY  フォーム  入力開始  最終画面  提出');
for (const d of dayKeys) {
  const label = `${d.slice(4, 6)}/${d.slice(6, 8)} ${WD[new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T12:00:00Z`).getUTCDay()]}`;
  const cell = (x) => String(x ?? '·').padStart(8);
  console.log('   ' + label + cell(V[d]) + cell(RP[d]) + cell(FM[d])
    + cell(ev('pay_step1_company', d)) + cell(ev('pay_step5_review', d)) + cell(ev('pay_report_submit', d)));
}
console.log('');
console.log('   訪問者   … サイトに来た人（1日に何度来ても1人）');
console.log('   REAL PAY … 実給与の一覧を見た人');
console.log('   フォーム … 給与を出す画面まで来た人');
console.log('   入力開始 … 会社を選んだ回数（5段の1段目）');
console.log('   最終画面 … 確認画面まで来た回数（5段目）');
console.log('   提出     … 送信ボタンが押された回数');
console.log('   ★提出の「本当の件数」は node db/usage.mjs が正（ここは押された回数）。');

/* ── 2) 素の数との差（水増しの大きさ）── */
if (!WITH_BOT) {
  const a = dayKeys.reduce((s, d) => s + Number(V[d] ?? 0), 0);
  const b = dayKeys.reduce((s, d) => s + Number(RV[d] ?? 0), 0);
  console.log(`\n   人でないものを除いた合計 ${a}人 ／ 素の合計 ${b}人`
    + (b ? `（水増し ${Math.round((1 - a / b) * 100)}%）` : ''));
}

/* ── 3) つまずきの形 ──
   ⚠️ **段どうしを割り算しない。** 目印（イベント）は足された日がばらばらで、
      pay_step1〜5 は 2026-09-17 から、pay_report_submit はもっと前から記録されている。
      割ると「送信16 ÷ 確認画面5 = 320%」のような、あり得ない数が出る。
      実際に v1.0 の草稿がそう出した。**数を並べるだけにして、いつから記録したかを添える。**
      （フォームにはトップページからも直接来るので、REAL PAY との割り算も意味が無い） */
const sum2 = (n) => dayKeys.reduce((s, d) => s + Number(EV[n]?.[d] ?? 0), 0);
const fm = dayKeys.reduce((s, d) => s + Number(FM[d] ?? 0), 0);
const rp = dayKeys.reduce((s, d) => s + Number(RP[d] ?? 0), 0);

/* 目印がいつから記録されているか（90日さかのぼって最初の日を見る） */
const firstSeen = {};
{
  const rows = await run({
    dateRanges: [{ startDate: '90daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }], limit: 5000,
  });
  for (const r of rows) {
    const [d, n] = [r.dimensionValues[0].value, r.dimensionValues[1].value];
    if (!firstSeen[n] || d < firstSeen[n]) firstSeen[n] = d;
  }
}
const since = (n) => {
  const d = firstSeen[n];
  if (!d) return '　（記録なし）';
  return d > dayKeys[0] ? `　★${d.slice(4, 6)}/${d.slice(6, 8)} から記録` : '';
};
console.log('\n■ この期間の数（★の付いた行は、途中から数え始めています）');
const stage = (label, n, mark = '') => console.log('   ' + label.padEnd(22) + String(n).padStart(5) + mark);
stage('REAL PAY を見た人', rp);
stage('給与フォームに来た人', fm);
stage('入力を始めた', sum2('pay_step1_company'), since('pay_step1_company'));
stage('確認画面まで来た', sum2('pay_step5_review'), since('pay_step5_review'));
stage('送信を押した', sum2('pay_report_submit'), since('pay_report_submit'));
const blocked = sum2('pay_form_blocked');
if (blocked) stage('※ 途中で止められた', blocked, since('pay_form_blocked') || '　（総支給を超えた等）');
console.log('   ─ 段どうしを割らないこと。記録を始めた日が段ごとに違うため、割ると 300% のような数が出ます。');

/* ── 4) おまけ：よく見られたページ ── */
if (has('--pages')) {
  const rows = await run({
    dateRanges: RANGE, dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
    dimensionFilter: andWith(null), orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 20,
  });
  console.log('\n■ よく見られたページ');
  for (const r of rows) console.log('   ' + String(r.metricValues[0].value).padStart(5) + '回 '
    + String(r.metricValues[1].value).padStart(4) + '人  ' + r.dimensionValues[0].value.slice(0, 60));
}
console.log('');
