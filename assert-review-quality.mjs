// 口コミの自動品質判定（assessReviewQuality / assessReviewSet）を、実際にページに載っている
// 関数そのままで検証する。コピーを持つと本体と乖離するので、ブラウザ内の関数を呼ぶ。
//
// この検査を作った理由:
//   判定5（bigram の多様性）が「異なり2連字 ÷ 全長」だったため、長い文章ほど必ず比率が下がり、
//   英語で丁寧に書いた口コミが合計1,100字あたりから全部弾かれていた（日本語も約1,400字）。
//   投稿は合計300字以上が必須なので、いちばん価値のある投稿だけが落ちる作りになっていた。
//   長さを変えても本物が通ることを、以後ずっと機械で確かめる。
// ★2026-11-15 外国語の口コミ（アラビア語・中国語・韓国語・タイ語・ロシア語）、略語の多い欄
//   （PC/LPC・CRM・MCC・TRI/TRE…）、金額（100000 AED・¥5000000）、句読点やアラビア文字を伸ばす線の連続で
//   本物が止まっていた（判定1と判定4）。その本物が通ることと、今までの乱打が今までどおり落ちることを見る。
//   ⚠️ 英字以外の文字の乱打は、この規則では捕まえなくてよい（翻訳の AI が見る）＝その答えは縛らない。
//   あわせて、投稿画面の字数の数え方・サーバーの断りの文の訳・入力欄の dir も見る（同じ投稿画面の話なのでここ）。
//
// localhost 必須。使い方: node serve.mjs を起動してから node assert-review-quality.mjs
// 本番の Supabase には1本も出さない（*.supabase.co への通信は止める。送信は rpc を差し替えて確かめる）。
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:3000';
const ROOT = fileURLToPath(new URL('.', import.meta.url));

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
// ★2026-11-15 スペイン語の画面（es/）用。中南米の会社の副操縦士を模した作り物。
const ES = [
  'La cultura de la empresa es profesional y muy multicultural; en la cabina conviven pilotos de muchos países. La comunicación con la gerencia mejoró en los últimos años, aunque las decisiones siguen siendo bastante jerárquicas.',
  'El sueldo base más las horas de vuelo es competitivo frente a otras aerolíneas de la región. El bono anual depende de los resultados de la compañía y el pago llega siempre puntual.',
  'Seguro médico para toda la familia, boletos de staff travel con buena prioridad y un bono de vivienda razonable. El plan de retiro es mejor que el de la mayoría de las aerolíneas locales.',
  'El rol sale con un mes de anticipación y los días libres se respetan casi siempre. En temporada alta hay muchos vuelos nocturnos y la fatiga se acumula, sobre todo en las rotaciones largas.',
  'Flota moderna de A320neo y B787 con buen mantenimiento. Los procedimientos (SOP) están bien definidos y el despacho apoya mucho en los días de mal clima.',
  'El entrenamiento en simulador es exigente pero justo. Los chequeos PC/LPC son cada seis meses y los instructores tienen mucha experiencia en CRM y en la evaluación.',
  'Sugiero mejorar la previsibilidad de los roles y escuchar más a los pilotos de línea antes de cambiar las políticas de descanso.',
];

// ★2026-11-15 本物として通るべきもの（外国語・略語・金額・句読点の連続）。どれも作り物（実在の投稿ではない）。
//   判定1か判定4を元に戻すと、ここのどれかが落ちる（下の「壊す証明」で毎回確かめる）。
const WORLD = {
  'アラビア語の口コミ': 'الراتب جيد مقارنة بشركات الطيران الأخرى في المنطقة، وبدل الطيران يُحسب حسب الساعات الفعلية كل شهر. جدول الرحلات يصدر قبل شهر تقريباً، لكن في موسم الذروة تكثر الرحلات الليلية ويقل وقت الراحة. التدريب على جهاز المحاكاة منظم والمدربون ذوو خبرة. نتمنى أن تستمع الإدارة إلى آراء الطيارين أكثر.',
  '中国語の口コミ': '公司的薪资在亚洲同行里算中上水平，飞行小时费按月结算，年终奖跟公司业绩挂钩。排班整体比较稳定，但旺季红眼航班偏多，休息时间有时不够。培训体系很完整，模拟机复训每半年一次，教员都很专业。希望管理层能多听一线飞行员的意见。',
  '韓国語の口コミ': '급여는 국내 다른 항공사와 비교하면 괜찮은 편이고, 비행수당은 월별 비행시간에 따라 달라집니다. 스케줄은 한 달 전에 나오지만 성수기에는 야간 비행이 많아 피로가 쌓입니다. 시뮬레이터 훈련은 체계적이고 교관들의 수준도 높습니다. 회사가 조종사의 의견을 좀 더 들어주면 좋겠습니다.',
  'タイ語の口コミ': 'เงินเดือนอยู่ในระดับที่ดีเมื่อเทียบกับสายการบินอื่นในภูมิภาค ค่าชั่วโมงบินจ่ายตามจริงทุกเดือน ตารางบินค่อนข้างแน่นในช่วงไฮซีซั่น แต่บริษัทให้วันหยุดตามที่กำหนด การฝึกในเครื่องจำลองการบินมีมาตรฐานสูงและครูการบินใส่ใจ อยากให้ฝ่ายบริหารรับฟังความเห็นของนักบินมากกว่านี้',
  'ロシア語の口コミ': 'Зарплата выше средней по рынку, лётные начисляются за фактический налёт, а годовая премия зависит от результатов компании. Расписание публикуют за месяц, но летом много ночных рейсов и отдых иногда сокращается. Подготовка на тренажёре организована хорошо, инструкторы опытные. Хотелось бы, чтобы руководство чаще прислушивалось к пилотам.',
  '略語の多い本物（日本語）': '訓練はCBTとFFSで、PC/LPCは年2回。CRM・MCC・TEMの座学もある。FMSとMCDUの操作、RNP・PBNの進入、TCAS・GPWSの手順まで確認される。TRI/TREの質は高い。',
  '略語の多い本物（英語）': 'PC/LPC 2x/yr in FFS. CBT, CRM, MCC, TEM. TRI/TRE ok. FMS/MCDU, RNP/PBN, TCAS, GPWS on B787-9.',
  '略語の多い本物（アラビア語）': 'التدريب في FFS ممتاز، وفحوصات PC/LPC مرتين في السنة، ودورات CBT وCRM وMCC وTEM إلزامية. المدربون TRI/TRE محترفون، ونتدرب على FMS وMCDU وRNP/PBN وTCAS وGPWS على B787-9.',
  '金額「100000 AED」': '100000 AED',
  '金額「¥5000000」': '¥5000000',
  '金額を含む文（AED）': '月の総支給はおよそ100000 AEDで、住宅手当は別に出る。昇格すると基本給が大きく上がる。',
  '金額を含む文（円）': '入社時の年収は¥5000000ほどで、機長に昇格すると倍以上になる。賞与は年2回。',
  '数字の連続「55555」': 'Flight 55555 was a ferry; the base pays 300000 per month before overtime.',
  '句点の連続「。。。。。」': '正直、給与は物足りない。。。。。でも同僚には恵まれていて、乗務は楽しい。',
  'アラビア文字を伸ばす線「ـــــ」': 'الطاقم رائـــــع والجو العام في الشركة جميـــــل، والسكن قريب من المطار.',
};

// 落とすべきもの
const MASH = {
  '同じ文字の連続':       'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '「あああああ」':        '給料はあああああ',
  '「aaaaa」':             'salary is aaaaa',
  'dk 系の機械的な反復':  'dkdkddkkdkdkkdkdkdkddkkdkdkkdkdkdkddkkdkdkkdkdkdkddkkdkdkkdkdkdkddkkdkdkkdkdkdkddkkdkdkkdk',
  'asdf 連打':            'asdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdf',
  'かな3文字の反復':      'あいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいうあいう',
  '同じ文の反復':         '給与は悪くないと思います。'.repeat(12),
  '母音の無いローマ字乱打': 'ksmkskdmnbvcxzlkjhgfdszxcvbnmlkjhgfdszxcvbnmqwrtyp',
  '小文字の乱打（asdfghjkl qwrtp…）': 'asdfghjkl qwrtp zxcvbnm lkjhgfd mnbvcxz qwrtp',
  '本物の後ろに乱打の塊':  EN[0] + ' ' + EN[1] + ' ' + 'dkdkddkkdkdkkdk'.repeat(20),
};

let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = got === want;
  if (ok) pass++; else { fail++; console.log(`  ✗ ${name}\n      got  ${got}\n      want ${want}`); }
};
const J = (x) => JSON.stringify(x);

/* サーバー（db/review-pending.sql）が、ログインせずに送った口コミを断るときの文。
   pv_validate_review_payload と submit_review_pending の raise をそのまま読む（写しを持たない）。 */
const SQL = readFileSync(join(ROOT, 'db/review-pending.sql'), 'utf8');
const sqlBody = SQL.slice(SQL.indexOf('create or replace function public.pv_validate_review_payload'),
                          SQL.indexOf('create or replace function public.claim_review_pending'));
const SERVER_MSGS = [...new Set([...sqlBody.matchAll(/raise exception '([^']+)'/g)].map((m) => m[1]))];

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
let blocked = 0;

const PAGES = [['EN', `${BASE}/en/submit-review.html`, EN, 'en'],
               ['JA', `${BASE}/submit-review.html`,    JA, 'ja'],
               ['ES', `${BASE}/es/submit-review.html`, ES, 'es']];
const enMsgs = {};   // 英語の画面に出たサーバーの文（スペイン語の画面と比べる）
for (const [tag, url, arr, lang] of PAGES) {
  console.log(`\n── ${tag} ${url.replace(BASE, '')} ─────────────────────────`);
  /* ⚠️ ページごとに新しい窓（保存領域が空）で開く。同じ窓で英語のあとに日本語を開くと、覚えた言語で
     英語のページへ移され、日本語の画面を見ていないのに通ってしまう（2026-11-15 に気づいた）。 */
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setRequestInterception(true);
  page.on('request', (rq) => {
    if (/\.supabase\.co$/.test(new URL(rq.url()).hostname)) { blocked++; rq.abort(); } else rq.continue();
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof assessReviewQuality === 'function' && typeof window.PV_LANG === 'string', { timeout: 10000 });
  ck(`${tag} のページそのものを見ている（住所と PV_LANG）`, await page.evaluate(() => location.pathname + ' ' + window.PV_LANG), url.replace(BASE, '') + ' ' + lang);

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

  // ★外国語・略語・金額・句読点の連続の本物
  for (const [name, s] of Object.entries(WORLD)) ck(`本物を通す: ${name}`, await q(s), true);

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

  /* ── ★2026-11-15 字数（サーバーの char_length(btrim(…)) と同じ＝前後の空白を外したコードポイントの数）── */
  const cnt = await page.evaluate(() => {
    const keys = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];
    for (const k of keys) document.getElementById('fc-' + k).value = '';
    document.getElementById('fc-culture').value = '  ' + 'あ😀'.repeat(10) + '\n ';   // 20字・UTF-16 では30
    document.getElementById('fc-salary').value = ' 👨‍✈️ ok ';                         // 結合の絵文字は4コードポイント＋空白＋ok＝7字
    updateTotalChars();
    return { shown: document.getElementById('char-total-display').textContent, total: totalCommentChars(getVals()) };
  });
  ck('★字数は前後の空白を外したコードポイントで数える（画面の表示）', cnt.shown.trim().split(' ')[0], '27');
  ck('★字数は前後の空白を外したコードポイントで数える（判定に使う数）', cnt.total, 27);

  /* 1欄が300字を超えたら（maxlength をすり抜けた値）、その画面の言葉で止める＝次の段へ進まない */
  const over = await page.evaluate((arr) => {
    const sel = document.getElementById('f-airline'); sel.value = 'zipair';
    const r = document.querySelector('input[name="f-pos"][value="fo"]'); r.checked = true;
    for (const k of ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training']) document.querySelector(`.star-group[data-cat="${k}"]`).dataset.score = '4';
    const keys = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];
    keys.forEach((k, i) => { document.getElementById('fc-' + k).value = arr[i]; });
    document.getElementById('fc-culture').value = '😀' + 'あ'.repeat(300);   // 301字（UTF-16 では302）
    goStep(3);
    return { err: document.getElementById('err2').textContent.trim(), step3: getComputedStyle(document.getElementById('step3')).display };
  }, arr);
  const OVER = { ja: '「企業文化」のコメントは300文字までです（現在301文字）。',
                 en: 'The comment on "Company culture" can be up to 300 characters (currently 301).',
                 es: 'El comentario sobre "Cultura de la empresa" puede tener hasta 300 caracteres (actualmente 301).' }[lang];
  ck('★1欄が300字を超えたら、その画面の言葉で止める', J(over), J({ err: OVER, step3: 'none' }));

  /* ── ★2026-11-15 サーバーの断りの文：英西の画面はその言葉に置き換える・日本語の画面はそのまま ── */
  if (lang === 'ja') {
    ck('日本語の画面には置き換えの表を置かない', await page.evaluate(() => typeof serverMsg), 'undefined');
  } else {
    const got = await page.evaluate((list) => Object.fromEntries(list.map((m) => [m, serverMsg(m)])), SERVER_MSGS);
    for (const m of SERVER_MSGS) {
      const t = got[m];
      ck(`${tag}: サーバーの「${m}」を置き換える（日本語の字が残らない）`, !!t && !/[぀-ヿ㐀-鿿]/.test(t), true);
      if (lang === 'en') enMsgs[m] = t;
      if (lang === 'es') ck(`ES: 「${m}」は英語の画面と別の字（スペイン語）`, t !== enMsgs[m], true);
    }
    ck(`${tag}: 知らない文は置き換えない（そのまま出す）`, await page.evaluate(() => serverMsg('知らないエラーの文')), '');
  }
  /* 送信の通し：rpc を差し替えて、サーバーが「1項目300字まで」と断ったときに出る字を見る（本物のサーバーへは出さない） */
  const shown = await page.evaluate(async (arr) => {
    const keys = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];
    keys.forEach((k, i) => { document.getElementById('fc-' + k).value = arr[i]; });
    _sb.auth.getSession = async () => ({ data: { session: null } });
    _sb.rpc = async () => ({ data: null, error: { code: '22023', message: 'コメントは1項目300字までです' } });
    await submitReview();
    return document.getElementById('err3').textContent.trim();
  }, arr);
  const EXPECT = { ja: 'コメントは1項目300字までです', en: 'Each comment can be up to 300 characters.',
                   es: 'Cada comentario puede tener hasta 300 caracteres.' }[lang];
  ck(`★ログインなしで送ってサーバーに断られたら、${tag} の画面の言葉で出す`, shown, EXPECT);

  /* ── ★2026-11-15 7つの入力欄は dir="auto"（右から左へ書く言語の口コミ） ── */
  ck('7つの入力欄が dir="auto"', await page.evaluate(() =>
    [...document.querySelectorAll('textarea[id^="fc-"]')].filter((t) => t.getAttribute('dir') === 'auto').length), 7);
  await ctx.close();
}
ck('サーバーの断りの文を SQL から読めている', SERVER_MSGS.length >= 10, true);
ck('本番の Supabase へ1本も出していない', blocked, 0);

await browser.close();

/* ────────────────────────────────────────────────────────────────────────────
   同じ判定がサイト以外にも3か所ある（管理者への通知メールと運用スクリプト）。
   フォームだけ直して残りを直し忘れると、投稿は通るのに管理者メールに
   「⚠️ 低多様性の反復 ― 内容をご確認ください」が付く。実際に一度そうなった。
   ここでは各ファイルから assessReviewQuality の実体を切り出してそのまま動かし、
   6か所（日英西の投稿画面＋この3つ）すべてが同じ答えを返すことを確かめる。コピーを持たないのは上と同じ理由。
   ──────────────────────────────────────────────────────────────────────── */
const SERVER_COPIES = [
  'mail-bot/admin-notify.mjs',
  'mail-bot/delete-review.mjs',
  'supabase/functions/notify-admin/index.ts',
];
/* ★2026-11-20 口コミを1項目ずつ聞く板（日英西で1本）。送る前に同じ判定をかける＝7か所目。上のブラウザでは流していないので、ケースもここで流す。 */
const BOARD_COPIES = ['pv-review-board.js'];
const ALL_COPIES = ['submit-review.html', 'en/submit-review.html', 'es/submit-review.html', ...SERVER_COPIES, ...BOARD_COPIES];

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
const build = (code) => new Function(`${code}; return assessReviewQuality;`)();

// ★6か所が同じ式であること（判定1と判定4の式は1文字も違わない）。文の中身（reason）は言語ごとに違ってよい。
const R1 = '/([^\\p{N}\\p{P}\\p{S}\\p{Z}\\s\\u0640])\\1{4,}/u.test(t)';
const R4 = "const bare = t.replace(/\\b[A-Z0-9]{2,10}(?:[\\/-][A-Z0-9]{1,10})*\\b/g, ' ');";

// 期待値。上のブラウザ側と同じ考え方で、本物は長さによらず通り、乱打は落ちる。
const CASES = [];
for (const [tag, arr] of [['EN', EN], ['JA', JA], ['ES', ES]]) {
  let buf = '';
  for (let i = 0; i < 21; i++) {
    buf += (buf ? ' ' : '') + arr[i % arr.length];
    if (i % 4 === 0 || i === 20) CASES.push([`${tag} 本物 ${String(buf.length).padStart(4)}字`, buf, true]);
  }
}
for (const [name, s] of Object.entries(WORLD)) CASES.push([`本物: ${name}`, s, true]);
for (const [name, s] of Object.entries(MASH)) CASES.push([`乱打: ${name}`, s, false]);
CASES.push(['空文字', '', true]);

// 同じ答えかを見るための、種を固定した混ぜ物（期待値は縛らない＝6か所が同じ答えを返すことだけを見る）
const PIECES = [...EN, ...JA, ...ES, ...Object.values(WORLD), ...Object.values(MASH),
  'PC/LPC', 'B787-9', 'A350', 'ATPL', 'TRI/TRE', 'CRM', 'qwrtp', 'zxcvb', 'AAAAA', 'あああああ', '00000', '!!!!!', '😀😀😀😀😀',
  'ـــــ', '。。。。。', 'ーーーーー', 'ababababab', 'Cat A/C', 'SOPs', 'x', ' ', '\n'];
let seed = 20261115;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const FUZZ = [];
for (let i = 0; i < 400; i++) {
  let s = '';
  const parts = 1 + rnd(4);
  for (let j = 0; j < parts; j++) {
    const p = PIECES[rnd(PIECES.length)];
    s += (rnd(2) ? ' ' : '') + (rnd(3) ? p : p.slice(rnd(Math.max(1, p.length))));
  }
  FUZZ.push(s);
}

const FNS = {};
for (const rel of ALL_COPIES) {
  console.log(`\n── ${rel} ─────────────────────────`);
  let code;
  try {
    code = extract(readFileSync(join(ROOT, rel), 'utf8'), rel);
    FNS[rel] = build(code);
  } catch (e) {
    fail++;
    console.log(`  ✗ ${rel} の assessReviewQuality を取り出せない: ${e.message}`);
    console.log('     （型注釈を足したなら stripTypes を直す。判定そのものが壊れている可能性もある）');
    continue;
  }
  ck('判定1の式が7か所と同じ（1回だけ）', code.split(R1).length - 1, 1);
  ck('判定4の式が7か所と同じ（1回だけ）', code.split(R4).length - 1, 1);
  if (!SERVER_COPIES.includes(rel) && !BOARD_COPIES.includes(rel)) continue;   // 投稿画面の3枚は上のブラウザで同じケースを流している
  for (const [name, text, want] of CASES) ck(`${name}`, FNS[rel](text).ok, want);
}

console.log('\n── 7か所が同じ答えを返すか（決めたケース＋混ぜ物400本）─────────────────────────');
{
  const names = Object.keys(FNS);
  let diff = 0;
  for (const s of [...CASES.map((c) => c[1]), ...FUZZ]) {
    const ans = names.map((n) => FNS[n](s).ok);
    if (ans.some((a) => a !== ans[0])) { if (diff++ < 3) console.log(`  ✗ 答えが割れた: ${J(s).slice(0, 80)} → ${J(Object.fromEntries(names.map((n, i) => [n, ans[i]])))}`); }
  }
  ck(`7か所すべてを動かせた`, names.length, 7);
  ck(`7か所の答えが割れた入力の数（${CASES.length + FUZZ.length}本中）`, diff, 0);
}

/* ── 壊す証明：判定1か判定4を元に戻すと、足した本物のケースが赤くなる（ケースが変更を本当に見ている） ── */
console.log('\n── 壊す証明 ─────────────────────────');
{
  const base = extract(readFileSync(join(ROOT, 'mail-bot/admin-notify.mjs'), 'utf8'), 'mail-bot/admin-notify.mjs');
  const MUT = {
    '判定1を元の /(.)\\1{4,}/ に戻す': base.split(R1).join('/(.)\\1{4,}/u.test(t)'),
    '判定4で略語を外さない': base.split(R4).join('const bare = t;'),
  };
  for (const [name, code] of Object.entries(MUT)) {
    ck(`${name}：式を差し替えられた`, code !== base, true);
    const fn = build(code);
    const red = Object.entries(WORLD).filter(([, s]) => !fn(s).ok).map(([n]) => n);
    console.log(`  ${name} → 赤くなるケース: ${red.join(' / ') || '（なし）'}`);
    ck(`${name}と、足したケースが赤くなる`, red.length > 0, true);
  }
}

console.log(`\n==== ${pass} pass / ${fail} fail ====`);
if (fail) process.exitCode = 1;
