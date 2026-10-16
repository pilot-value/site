/* ════════════════════════════════════════════════════════════════
   assert-claims.mjs — サイトが「本当のことだけ」を言っているか（ブラウザ不要・1秒未満）

   VISION.md の信用の原則（数字を盛らない／検証できないものを Verified と表示しない）を、
   実際に破った2つの形だけ見張る。どちらも **画面は普通に動いたまま静かに嘘をつく**。

     A) 明細の扱い ── 「画像は送らない」と書く（本当は送っている）
     B) 画面に出る数 ── HTML に数字を直書きし、JS が一度も書き換えない
     C) ホテルの欄のまわりの言い方 ── 見る人・足す人の決まりと違うことを書く（2026-10-16）
     D) ログインせずに出した人の控えの鍵と回線の印 ── 個人データのページに書いていない（2026-10-17）

   ※ どちらも 2026-09-20 にオーナーの指摘で見つかった。経緯は各節の頭にある。

   ── 本当は何が起きているか ──────────────────────────────
     ① 端末の中で「送る枠」の外を**画像ごと切り落とす**
     ② 端末の中で氏名・社員番号・口座を**画素ごと黒く塗る**
     ③ 本人が見て確認する
     ④ **枠の中だけを送る**（Edge Function → Anthropic の API）
     ⑤ 読み取ったら捨てる。ストレージにも DB にもログにも書かない

   つまり「画像は送らない」は**嘘**で、「黒塗りしてから送る・保存しない」が本当。
   端末を出ないのは**枠の外**と**塗った部分**であって、画像そのものではない。

   ── この検査がある理由 ──────────────────────────────────
   2026-08-13、pay-report.html の入口カードに「画像は送りません」と書いた。
   嘘だったので消し、db/test-payslip-redact.mjs に「二度と書かない」検査を置いた。
   **ところがその検査は pay-report.html の2枚しか見ていなかった。**

   2026-09-20、オーナーの指摘でサイト全体を見たら、同じ嘘が4か所に残っていた：
     ・index.html / en/index.html §4 …… 「画像は送りません」
       （同じページの §7・§8 は「黒塗りしてから送信・保存しません」と正しく
         書いてある＝**1枚の中で矛盾していた**）
     ・actual-pay.js（REAL PAY の錠前）… 「サーバーには送られません」
     ・airlines/premium-auth-lock.js …… 「画像は端末から出ません」（**226枚に出る**）
     ・my-value.html / personal-data.html の meta …「端末内で処理され」

   匿名性を気にする人に給与を出してもらう場面で、この食い違いは離脱の理由になる。
   だから検査を **pay-report.html の2枚から、サイト全体（HTML＋共有 JS）へ広げた。**

   ⚠️ 「枠の外は端末を出ません」「the un-redacted image never leaves your device」は
      **事実なので禁止しない**。下の禁則は、主語が「画像そのもの」のときだけ当たるよう
      主語を固定してある（`the image never leaves` は当たるが
      `the un-redacted image never leaves` は当たらない）。

   使い方: node assert-claims.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) pass++; else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
};

/* ★コメントは外して見る。消した理由を書き残したコメントには、禁止した文言そのものが
   引用として入っている（入っていてほしい）。画面に出るのはコメントの外だけ。
   `//` は `https://` を巻き込まないよう、直前が : ' " ` のときは外さない。 */
const strip = (t) => t
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:'"`])\/\/[^\n]*/gm, (m, head) => head);

/* ── 見る範囲 ──────────────────────────────────────────────
   画面に出る文字が入るもの＝HTML と、全ページが読む共有 JS。
   .mjs（生成・検査スクリプト）は画面に出ないので見ない。ただし meta を書く
   seo-normalize.mjs の COPY が腐ったら、書き込まれた HTML の側で捕まる。 */
const SKIP_DIR = new Set(['node_modules', '.git', 'temporary screenshots', 'sources-raw', 'baland_ass']);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(html|js)$/.test(name)) files.push(full);
  }
})(ROOT);

/* ── 禁則 ────────────────────────────────────────────────
   ⚠️ 言い換えを足すときは「主語が画像そのものか」を確かめる。
      枠の外・塗った部分・氏名について「出ない」と書くのは事実。 */
const NEVER_SAY = [
  // ── 日本語 ──
  [/画像は(?:どこにも)?送りません/,                        '「画像は送りません」'],
  [/画像は(?:どこにも)?送信されません/,                    '「画像は送信されません」'],
  [/画像は[^。]{0,24}サーバー?[にへ]は?送(?:られ|り)ません/, '「画像はサーバーには送られません」'],
  [/明細[^。]{0,24}サーバー?[にへ]は?送(?:られ|り)ません/,   '「明細はサーバーには送られません」'],
  [/画像は端末(?:内|の中)(?:だけ)?で(?:処理|完結)/,        '「画像は端末内で処理され（＝送らない）」'],
  [/画像は端末(?:から|を)(?:出ません|出ない)/,             '「画像は端末から出ません」'],
  [/(?:明細|画像)の?処理が端末(?:内|の中)で完結/,           '「処理が端末内で完結する」'],
  [/端末の中で数字だけ/,                                   '「端末の中で数字だけ取り出します」'],
  // ── 英語 ──
  [/\bthe image is (?:not|never) sent\b/i,                 '"the image is not sent"'],
  [/\bimages? (?:is|are) (?:not|never) sent\b/i,           '"images are never sent"'],
  [/\bimages? (?:is|are) processed on your own device\b/i, '"images are processed on your own device"'],
  [/\bthe image never leaves your (?:device|phone)\b/i,    '"the image never leaves your device"'],
  /* ★「payslip … stays on your own device」＝ meta description にあった形。
       主語を payslip に固定する（「塗る前の画像は端末に残る」は事実なので当てない）。 */
  [/\bpayslips?[^.]{0,40}stays? on your own device\b/i,    '"payslip processing stays on your own device"'],
  [/\b(?:figures|numbers) are read on(?: this| your)? device\b/i, '"read on this device"'],
];

console.log('\n── A) 明細の扱いについて、事実と違う言い方を書いていない ─────');
const hits = [];
for (const full of files) {
  const rel = path.relative(ROOT, full);
  const s = strip(readFileSync(full, 'utf8'));
  for (const [re, label] of NEVER_SAY) if (re.test(s)) hits.push(`${rel}: ${label}`);
}
ok(`サイト全体 ${files.length} ファイル（HTML＋共有 JS）`,
  hits.length === 0, hits.join('\n      '));

/* ── 言うべきことが、いちばん効く場所に書いてあること ──────────
   禁則だけだと「何も書かない」で通ってしまう。送る直前の確認画面と、
   扱いを説明したページには、正しい説明が**在る**ことを要求する。 */
console.log('\n── A) 正しい説明が、要る場所に在る ───────────────────────');
const MUST_SAY = [
  ['payslip.js', [
    ['枠の外は端末から出ません', '送る直前の確認画面（日）：枠の外は出ないと書いてある'],
    ['解析にだけ使い、保存しません', '送る直前の確認画面（日）：保存しないと書いてある'],
    ['Nothing outside the frame leaves your device', '送る直前の確認画面（英）：枠の外は出ない'],
    ['is never stored', '送る直前の確認画面（英）：保存しない'],
  ]],
  ['personal-data.html', [
    ['ご本人が確認した「送る枠」の中だけ', '扱いのページ（日）：送るのは枠の中だけ'],
    ['ストレージにもデータベースにも保存せず', '扱いのページ（日）：保存しない'],
  ]],
  ['en/personal-data.html', [
    ['only what is inside the “sent area” frame you approved', '扱いのページ（英）：送るのは枠の中だけ'],
    ['never written to storage or to a database', '扱いのページ（英）：保存しない'],
  ]],
];
for (const [rel, needles] of MUST_SAY) {
  const s = readFileSync(path.join(ROOT, rel), 'utf8');
  for (const [needle, label] of needles) ok(`${rel}: ${label}`, s.includes(needle));
}

/* ════════════════════════════════════════════════════════════════
   B) 画面に出る数を直書きしない（2026-09-20）

   community.html の上の帯には 247 / 17 / 1,203 が **HTML に直書き**されていた。
   JS は一度も書き換えていないので、実データと何の関係も無い数字がずっと出ていた。
   日本語版は直したが**英語版だけ直し忘れ**、2026-09-19 に
     上の帯「247 Reviews」「1,203 Registered members」
     すぐ下の見出し「38 reviews」（＝こちらが本物）
   という形で1枚の中で食い違っていた。

   守るのは3つ。
     ① JS が書き換える欄は、HTML に数字を持たせない（＝ JS が動かなければ「—」）
     ② 日英で欄の集合が同じ（片方だけ直すと、また今回の形になる）
     ③ 直書きしてよいのは SSOT から来る定数だけ（掲載社数＝ SALARY の社数）
   ════════════════════════════════════════════════════════════════ */
console.log('\n── B) 画面に出る数を直書きしていない ─────────────────────');
{
  const { SALARY } = await import('./salary-data.mjs');
  const AIRLINE_N = String(Object.keys(SALARY).length);   // 112社（SSOT）

  /* 直書きしてよい欄と、その値の出どころ。ここに無い stat-* は
     「JS が書く」と見なして、数字を持っていたら落とす。 */
  const CONST_OK = { 'stat-airlines': AIRLINE_N };
  const PLACEHOLDER = /^[—\-–…]*$/;                       // 空か「—」だけなら OK

  const PAIRS = [['community.html', 'en/community.html']];
  for (const pair of PAIRS) {
    const seen = [];
    for (const rel of pair) {
      const html = readFileSync(path.join(ROOT, rel), 'utf8');
      const stats = [...html.matchAll(/id="(stat-[a-z0-9-]+)"[^>]*>([^<]*)</g)]
        .map(m => [m[1], m[2].trim()]);
      seen.push([rel, stats.map(([id]) => id).sort().join(',')]);

      for (const [id, text] of stats) {
        if (id in CONST_OK) {
          ok(`${rel}: ${id} は SSOT の値（${CONST_OK[id]}）`,
            text === CONST_OK[id], `いま「${text}」`);
        } else {
          /* ★JS が実際にこの欄へ書いているか。書いていないのに数字が出ていたら
             それは誰も更新しない飾り＝今回の 1,203 と同じもの。 */
          const written = html.includes(`getElementById('${id}')`)
                       || html.includes(`getElementById("${id}")`);
          ok(`${rel}: ${id} を JS が実際に書き換えている`, written,
            written ? '' : 'HTML にあるだけで、誰も更新していない');
          ok(`${rel}: ${id} は数字を直書きしていない`,
            PLACEHOLDER.test(text), PLACEHOLDER.test(text) ? '' : `いま「${text}」`);
        }
      }
    }
    ok(`${pair[0]} と ${pair[1]} で欄の集合が同じ`,
      seen[0][1] === seen[1][1], `${seen[0][1]}  ≠  ${seen[1][1]}`);
  }

  /* ── トップの社数（2026-09-22）──────────────────────────────
     トップ（日英）は「112」を title・説明文・JSON-LD・FAQ・本文に何か所も書いている。
     本文の分には data-pv-n="airlines" の印があり、lp.js が salary-data.json の社数で
     上書きする。ただし HTML の「112」は JS を動かさない読み手（検索・AI のクローラ）に
     そのまま見えるので、社数が変わったら**ここで必ず落ちる**ようにしておく。
       ① 印の付いた要素が全部 SALARY の社数
       ② 3けたの「◯社」「◯ airlines」も全部 SALARY の社数（title・meta・JSON-LD・FAQ）
     ※「日本国内26社」のような2けたの数は別の事実なので見ない。 */
  const lpJs = readFileSync(path.join(ROOT, 'lp.js'), 'utf8');
  ok('lp.js: [data-pv-n="airlines"] を社数で上書きしている',
    lpJs.includes(`querySelectorAll('[data-pv-n="airlines"]')`));
  for (const [rel, countRe] of [
    ['index.html',    /(?<![\d,.])(\d{3})\s*社/g],
    ['en/index.html', /(?<![\d,.])(\d{3})\s+airlines\b/gi],
  ]) {
    const s = strip(readFileSync(path.join(ROOT, rel), 'utf8'));
    const marks = [...s.matchAll(/data-pv-n="airlines"[^>]*>([^<]*)</g)].map(m => m[1].trim());
    ok(`${rel}: 社数の印（data-pv-n="airlines"）がある`, marks.length > 0);
    const badMarks = marks.filter(t => t !== AIRLINE_N);
    ok(`${rel}: 印の付いた社数 ${marks.length} か所が SSOT の ${AIRLINE_N}`,
      badMarks.length === 0, `いま「${badMarks.join('」「')}」`);
    const counts = [...s.matchAll(countRe)].map(m => m[1]);
    const badCounts = counts.filter(n => n !== AIRLINE_N);
    ok(`${rel}: 3けたの社数の表記 ${counts.length} か所が SSOT の ${AIRLINE_N}`,
      counts.length > 0 && badCounts.length === 0,
      counts.length ? `いま「${badCounts.join('」「')}」` : '1つも見つからない（書き方が変わった？）');
  }
}

/* ════════════════════════════════════════════════════════════════
   C) ホテルの欄のまわりの言い方（2026-10-16）

   ホテル名・住所・写真を見られるのは、オーナーと、オーナーが確認したパイロットだけ（db/stays.sql）。
   足すのは、ログインしていなくても誰でもできる。給与の提出では、ホテルは開かない。
   その決まりと合わない言い方を、ホテルの欄のそばに置かない。
     (i)   見出しの小さい字「確認済みのパイロットが足したもの」── 足すのは誰でもなので、本当ではない。
           どのページにも、どのスクリプトにも書かない。名前を「VERIFIED PILOT」にしたあとの形
           「VERIFIED PILOT が足したもの」（間の空白なし・Only を付けた形も）も同じく書かない。
     (ii)  「情報を追加」の面のホテル・ステイの札は「就航地ごと」── 足すのは誰でもなので「パイロット限定」と書かない。
     (iii) career-stay.js の鍵の1行は「Only VERIFIED PILOT」の1つだけ（大文字は O だけ）。
           給与の提出で開くような言い方（「給与の提出で開きます」「ログインと給与の提出で開きます」）を書かない。
   ※ 概要の話題の札「就航地ごと・パイロット限定」は、見るほうの話なので本当（残す）。
   ════════════════════════════════════════════════════════════════ */
console.log('\n── C) ホテルの欄のまわりに、本当でない言い方を書いていない ─────');
{
  const ADDED_BY = '確認済みのパイロットが足したもの', LIMITED = 'パイロット限定', LOCKW = 'Only VERIFIED PILOT';
  const ADDED_BY_V = 'VERIFIED PILOT が足したもの', ADDED_BY_V_RE = /VERIFIED PILOT\s*が足したもの/i;
  const PAY_OPENS = ['給与の提出で開きます', 'ログインと給与の提出で開きます'];
  const held = files.filter(f => strip(readFileSync(f, 'utf8')).includes(ADDED_BY)).map(f => path.relative(ROOT, f));
  ok(`(i) サイト全体 ${files.length} ファイル（HTML＋共有 JS）に「${ADDED_BY}」が無い（足すのは誰でも）`, held.length === 0, held.join(' '));
  const heldV = files.filter(f => ADDED_BY_V_RE.test(strip(readFileSync(f, 'utf8')))).map(f => path.relative(ROOT, f));
  ok(`(i) サイト全体 ${files.length} ファイル（HTML＋共有 JS）に「${ADDED_BY_V}」も無い（名前を変えたあとの形）`, heldV.length === 0, heldV.join(' '));
  const pc = strip(readFileSync(path.join(ROOT, 'pv-contrib.js'), 'utf8'));
  const tile = [...pc.matchAll(/\{ k: 'stay', t: 'ホテル・ステイ', q: '([^']*)'/g)].map(m => m[1]);
  ok('(ii) pv-contrib.js：ホテル・ステイの札は1つ・字は「就航地ごと」', tile.length === 1 && tile[0] === '就航地ごと', `いま ${JSON.stringify(tile)}`);
  ok(`(ii) pv-contrib.js に「${LIMITED}」が無い（足すのは誰でも）`, !pc.includes(LIMITED));
  const cs = strip(readFileSync(path.join(ROOT, 'career-stay.js'), 'utf8'));
  const payWords = PAY_OPENS.filter(x => cs.includes(x));
  ok('(iii) career-stay.js に、給与の提出で開くような言い方が無い（給与ではホテルは開かない）', payWords.length === 0, payWords.join(' ／ '));
  const lockN = cs.split(LOCKW).length - 1;
  ok(`(iii) career-stay.js の鍵の1行「${LOCKW}」は1つだけ`, lockN === 1, `いま ${lockN} か所`);
}

/* ════════════════════════════════════════════════════════════════
   D) ログインせずに出した人の「控えの鍵」と「回線の印」（2026-10-17）

   ログインせずに回答する・ホテルやレストランや場所を足す・住みやすい街を足すと、サーバーが控えの鍵を作って
   その端末に置く（db/stays.sql の pv_stay_keys・db/contrib.sql の pv_contrib_keys。表には鍵の sha256 だけ）。
   同じ回線から1日に作れる鍵を数えるために、IP から作った値を1日だけ持ち、毎時の片づけで消す（どちらのファイルも）。
   その扱いを、個人データのページ（日英）に書いておく。書く文は決めた1文そのまま（1文字でも違えば落ちる）。
     D3  端末の鍵の表がある（db/stays.sql に pv_stay_keys か、db/contrib.sql に pv_contrib_keys）
         → personal-data.html と en/personal-data.html の両方に、その1文が1回ずつ在る
   ※ 文を変えるときは、先にオーナーの言葉で決めてから、ここと2枚を一緒に直す。
   ════════════════════════════════════════════════════════════════ */
console.log('\n── D) ログインせずに出した人の鍵と回線の印を、個人データのページに書いている ─────');
{
  const DEVICE_KEY = {
    'personal-data.html': 'ログインせずに回答したり、ホテル・レストラン・場所や住みやすい街を追加したりした場合、あなたの投稿をあなたの端末にだけ見せるための鍵を、この端末のブラウザに保存します（サーバーには、その鍵から作った復元できない値だけを置きます）。同じ回線からの回数を数えるため、IPアドレスを復元しにくい形に変換した値を1日だけ保持し、その後削除します。メールアドレス・氏名・位置情報は伺いません。',
    'en/personal-data.html': 'If you answer questions or add a hotel, restaurant, place or town without signing in, a key that lets only your device see your own posts is stored in this browser (the server keeps only an irreversible value made from it). To count additions from one connection, a value derived from your IP address that is hard to reverse is kept for one day and then deleted. We do not ask for an e-mail address, a name or a location.',
  };
  const keyTable = /\bpv_stay_keys\b/.test(readFileSync(path.join(ROOT, 'db/stays.sql'), 'utf8'))
                || /\bpv_contrib_keys\b/.test(readFileSync(path.join(ROOT, 'db/contrib.sql'), 'utf8'));
  const seenN = Object.entries(DEVICE_KEY).map(([rel, s]) => [rel, strip(readFileSync(path.join(ROOT, rel), 'utf8')).split(s).length - 1]);
  ok('D3 端末の鍵の表がある（db/stays.sql・db/contrib.sql）→ 個人データのページ（日英）の両方に、控えの鍵と回線の印の1文が1回ずつ在る',
    !keyTable || seenN.every(([, n]) => n === 1), seenN.map(([rel, n]) => `${rel}: ${n} か所`).join(' ／ '));
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
