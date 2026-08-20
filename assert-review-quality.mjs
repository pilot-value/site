// 口コミの自動品質判定（assessReviewQuality / assessReviewSet）を、実際にページに載っている
// 関数そのままで検証する。コピーを持つと本体と乖離するので、ブラウザ内の関数を呼ぶ。
//
// この検査を作った理由:
//   判定5（bigram の多様性）が「異なり2連字 ÷ 全長」だったため、長い文章ほど必ず比率が下がり、
//   英語で丁寧に書いた口コミが合計1,100字あたりから全部弾かれていた（日本語も約1,400字）。
//   投稿は合計300字以上が必須なので、いちばん価値のある投稿だけが落ちる作りになっていた。
//   長さを変えても本物が通ることを、以後ずっと機械で確かめる。
//
// localhost 必須。使い方: node serve.mjs を起動してから node assert-review-quality.mjs
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:3000';

// 実在の投稿を模した文章（エミレーツ機長・7カテゴリ）。日英とも1カテゴリ約150〜250字。
const EN = [
  'Emirates has a truly multicultural cockpit with over 140 nationalities. The company culture is professional and performance-driven, though it can feel corporate and hierarchical at times. Communication from management has improved in recent years.',
  'Base pay plus flying pay and a tax-free environment in Dubai makes the overall package very competitive compared to European and Asian carriers.',
  'Top-tier benefit package in the aviation industry. Includes high-quality company villa or generous housing allowance, full medical coverage, school fee reimbursement for children, and excellent staff travel privileges (Cat A/C).',
  'Rosters can be demanding due to long-haul, multi-time-zone flights across a massive global network. Rostering stability varies, and fatigue management is a constant factor on ultra-long-haul trips.',
  'World-class, modern wide-body fleet (B777 and A380) with very high maintenance standards. Standard Operating Procedures (SOPs) are strict and well-defined, ensuring high operational safety across all destinations.',
  'State-of-the-art training facilities and full-flight simulators in Dubai. Recurrent checks (PC/LPC) are rigorous and thorough. Standard of instruction is consistently high across the department.',
  'Recommend continuing improvements in roster predictability and fatigue risk management, especially for ultra-long-haul pairings, to maintain long-term crew retention and well-being.',
];
const JA = [
  '多国籍のクルーが一緒に飛ぶ環境で、出身国の違いを前提に運航が組まれている。会社としては数字を重視する文化で、上下関係ははっきりしている。ここ数年は経営からの説明が以前より丁寧になった。',
  '基本給に飛行手当が乗り、ドバイは所得税が無いため手取りで見るとヨーロッパやアジアの会社より条件は良い。為替の影響は受けるので、円で見ると年によって差が出る。',
  '住居は会社が用意するヴィラか住宅手当のどちらかを選べる。医療は家族まで含めてカバーされ、子供の学費も補助が出る。スタッフチケットの優先度も高い。',
  '長距離路線が中心で時差をまたぐ勤務が続くため、体調管理は自分でやる必要がある。月によってスケジュールの安定度に差があり、超長距離の組み合わせでは疲労が溜まりやすい。',
  '機材はB777とA380が中心で整備の水準は高い。手順書がよく整理されていて、どの路線でも同じ基準で運航できるようになっている。',
  'ドバイの訓練施設は最新で、フルフライトシミュレーターが揃っている。定期審査は厳しいが、教官の水準は部門を通して安定している。',
  '超長距離のペアリングについて、スケジュールの予見性と疲労リスクの管理をもう一段進めてほしい。長く働き続けられる環境にしてほしい。',
];

// 落とすべきもの
const MASH = {
  '同じ文字の連続':       'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'dk 系の機械的な反復':  'dkdkddkkdkdkkdkdkdkddkkdkdkkdkdkdkddkkdkdkkdkdkdkddkkdkdkkdkdkdkddkkdkdkkdkdkdkddkkdkdkkdk',
  'asdf 連打':            'asdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdf',
  'かな3文字の反復':      'あいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいう',
  '同じ文の反復':         '給与は悪くないと思います。'.repeat(12),
  '母音の無いローマ字乱打': 'ksmkskdmnbvcxzlkjhgfdszxcvbnmlkjhgfdszxcvbnmqwrtyp',
  '本物の後ろに乱打の塊':  EN[0] + ' ' + EN[1] + ' ' + 'dkdkddkkdkdkkdk'.repeat(20),
};

let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = got === want;
  if (ok) pass++; else { fail++; console.log(`  ✗ ${name}\n      got  ${got}\n      want ${want}`); }
};

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();

for (const [tag, url, arr] of [['EN', `${BASE}/en/submit-review.html`, EN],
                               ['JA', `${BASE}/submit-review.html`,    JA]]) {
  console.log(`\n── ${tag} ${url.replace(BASE, '')} ─────────────────────────`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof assessReviewQuality === 'function', { timeout: 10000 });

  const q = (s) => page.evaluate((x) => assessReviewQuality(x).ok, s);

  // 1カテゴリずつ
  for (let i = 0; i < arr.length; i++) ck(`本物 cat${i}（${arr[i].length}字）`, await q(arr[i]), true);

  // 全カテゴリを連結したもの＝実際に投稿ボタンで検査される文字列。
  // 長さを伸ばしても通ること（旧実装はここで必ず落ちた）。
  let buf = '';
  for (let i = 0; i < 21; i++) {
    buf += (buf ? ' ' : '') + arr[i % arr.length];
    if (i % 4 !== 0 && i !== 20) continue;
    ck(`本物を連結 ${String(buf.length).padStart(4)}字`, await q(buf), true);
  }

  // 落とすべきもの
  for (const [name, s] of Object.entries(MASH)) ck(`乱打を落とす: ${name}`, await q(s), false);

  // 空・短文は素通し（判定は40字以上から）
  ck('空文字は通す', await q(''), true);
  ck('短い一文は通す', await q(arr[0].slice(0, 30)), true);

  // カテゴリ間コピペ
  const cats = (list) => Object.fromEntries(list.map((c, i) => [`k${i}`, { comment: c }]));
  ck('全カテゴリ別々の文章は通す',
     await page.evaluate((c) => assessReviewSet(c).ok, cats(arr)), true);
  ck('同じ文章を2カテゴリに貼ると落ちる',
     await page.evaluate((c) => assessReviewSet(c).ok, cats([arr[0], arr[0], arr[2], arr[3], arr[4], arr[5], arr[6]])), false);
}

await browser.close();

/* ────────────────────────────────────────────────────────────────────────────
   同じ判定がサイト以外にも3か所ある（管理者への通知メールと運用スクリプト）。
   フォームだけ直して残りを直し忘れると、投稿は通るのに管理者メールに
   「⚠️ 低多様性の反復 ― 内容をご確認ください」が付く。実際に一度そうなった。
   ここでは各ファイルから assessReviewQuality の実体を切り出してそのまま動かし、
   5か所すべてが同じ答えを返すことを確かめる。コピーを持たないのは上と同じ理由。
   ──────────────────────────────────────────────────────────────────────── */
const SERVER_COPIES = [
  'mail-bot/admin-notify.mjs',
  'mail-bot/delete-review.mjs',
  'supabase/functions/notify-admin/index.ts',
];

// 型注釈を落として素の JavaScript にする（notify-admin だけ TypeScript）
const stripTypes = (s) => s
  .replace(/\)\s*:\s*\{[^}]*\}\s*(?=\{)/g, ') ')                       // 返り値がオブジェクト型
  .replace(/\)\s*:\s*[A-Za-z_$][\w$<>\[\]|]*\s*(?==>)/g, ') ')          // アロー関数の返り値
  .replace(/([(,]\s*[A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$<>\[\]|]*/g, '$1')  // 引数
  .replace(/(\bconst\s+[A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$<>\[\]|]*/g, '$1'); // 変数

// assessReviewQuality の宣言から、次に来る assessReviewSet の直前までを切り出す。
// 波括弧を数える方式は正規表現リテラル（/(.)\1{4,}/ など）で壊れるので使わない。
const extract = (src, file) => {
  const from = src.indexOf('function assessReviewQuality');
  const to   = src.indexOf('function assessReviewSet', from);
  if (from < 0 || to < 0) throw new Error(`${file}: assessReviewQuality / assessReviewSet が見つからない`);
  return stripTypes(src.slice(from, to).replace(/\/\*[\s\S]*?$/, '').replace(/(^|\n)\s*\/\/[^\n]*$/, ''));
};

// 期待値。上のブラウザ側と同じ考え方で、本物は長さによらず通り、乱打は落ちる。
const CASES = [];
for (const [tag, arr] of [['EN', EN], ['JA', JA]]) {
  let buf = '';
  for (let i = 0; i < 21; i++) {
    buf += (buf ? ' ' : '') + arr[i % arr.length];
    if (i % 4 === 0 || i === 20) CASES.push([`${tag} 本物 ${String(buf.length).padStart(4)}字`, buf, true]);
  }
}
for (const [name, s] of Object.entries(MASH)) CASES.push([`乱打: ${name}`, s, false]);
CASES.push(['空文字', '', true]);

const ROOT = fileURLToPath(new URL('.', import.meta.url));
for (const rel of SERVER_COPIES) {
  console.log(`\n── ${rel} ─────────────────────────`);
  let fn;
  try {
    fn = new Function(`${extract(readFileSync(join(ROOT, rel), 'utf8'), rel)}; return assessReviewQuality;`)();
  } catch (e) {
    fail++;
    console.log(`  ✗ ${rel} の assessReviewQuality を取り出せない: ${e.message}`);
    console.log('     （型注釈を足したなら stripTypes を直す。判定そのものが壊れている可能性もある）');
    continue;
  }
  for (const [name, text, want] of CASES) ck(`${name}`, fn(text).ok, want);
}

console.log(`\n==== ${pass} pass / ${fail} fail ====`);
if (fail) process.exitCode = 1;
