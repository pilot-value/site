/* ════════════════════════════════════════════════════════════════
   assert-claims.mjs — サイトが「本当のことだけ」を言っているか（ブラウザ不要・1秒未満）

   VISION.md の信用の原則（数字を盛らない／検証できないものを Verified と表示しない）を、
   実際に破った2つの形だけ見張る。どちらも **画面は普通に動いたまま静かに嘘をつく**。

     A) 明細の扱い ── 「画像は送らない」と書く（本当は送っている）
     B) 画面に出る数 ── HTML に数字を直書きし、JS が一度も書き換えない
     C) ホテルの欄のまわりの言い方 ── 見る人・足す人の決まりと違うことを書く（2026-10-16）
     D) ログインせずに出した人の控えの鍵と回線の印 ── 個人データのページに書いていない（2026-10-17）
     E) 会社ページの出どころの無い数（日本の税の1つの率・目安の数・台帳に無い飛行時間・推定年収の幅）（2026-10-26）
     F) 英語のページの英国式のつづり／G) 英語のページの冠詞（2026-10-26）
     H) 会社ページの手で書いた所（生成器の段の外）の出どころの無い数（機数・税率・設立の年・概数…）（2026-10-26）

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

   ログインせずに回答する・ホテルやレストランや場所を足す・パイロットに人気の街を足すと、サーバーが控えの鍵を作って
   その端末に置く（db/stays.sql の pv_stay_keys・db/contrib.sql の pv_contrib_keys。表には鍵の sha256 だけ）。
   同じ回線から1日に作れる鍵を数えるために、IP から作った値を1日だけ持ち、毎時の片づけで消す（どちらのファイルも）。
   その扱いを、個人データのページ（日英）に書いておく。書く文は決めた1文そのまま（1文字でも違えば落ちる）。
     D3  端末の鍵の表がある（db/stays.sql に pv_stay_keys か、db/contrib.sql に pv_contrib_keys）
         → personal-data.html と en/personal-data.html の両方に、その1文が1回ずつ在る
   ※ 文を変えるときは、先にオーナーの言葉で決めてから、ここと2枚を一緒に直す。
     （2026-10-19：日本語の1文の「住みやすい街」だけを、その機能の新しい名前「パイロットに人気の街」に替えた ── オーナーの
      「パイロットに人気の街を追加、にして」（2026-10-18）。英語の1文は機能の名前を書いていない（a … town）ので、そのまま）
   ════════════════════════════════════════════════════════════════ */
console.log('\n── D) ログインせずに出した人の鍵と回線の印を、個人データのページに書いている ─────');
{
  const DEVICE_KEY = {
    'personal-data.html': 'ログインせずに回答したり、ホテル・レストラン・場所やパイロットに人気の街を追加したりした場合、あなたの投稿をあなたの端末にだけ見せるための鍵を、この端末のブラウザに保存します（サーバーには、その鍵から作った復元できない値だけを置きます）。同じ回線からの回数を数えるため、IPアドレスを変換した値を1日だけ保持し、その後削除します。メールアドレス・氏名・位置情報は伺いません。',
    'en/personal-data.html': 'If you answer questions or add a hotel, restaurant, place or town without signing in, a key that lets only your device see your own posts is stored in this browser (the server keeps only an irreversible value made from it). To count additions from one connection, a value derived from your IP address is kept for one day and then deleted. We do not ask for an e-mail address, a name or a location.',
  };
  const keyTable = /\bpv_stay_keys\b/.test(readFileSync(path.join(ROOT, 'db/stays.sql'), 'utf8'))
                || /\bpv_contrib_keys\b/.test(readFileSync(path.join(ROOT, 'db/contrib.sql'), 'utf8'));
  const seenN = Object.entries(DEVICE_KEY).map(([rel, s]) => [rel, strip(readFileSync(path.join(ROOT, rel), 'utf8')).split(s).length - 1]);
  ok('D3 端末の鍵の表がある（db/stays.sql・db/contrib.sql）→ 個人データのページ（日英）の両方に、控えの鍵と回線の印の1文が1回ずつ在る',
    !keyTable || seenN.every(([, n]) => n === 1), seenN.map(([rel, n]) => `${rel}: ${n} か所`).join(' ／ '));
}

/* ════════════════════════════════════════════════════════════════
   E) 会社ページの「よくある質問」が、出どころの無い数を言っていない（2026-10-26 WP-compare-all-16）

   ★CLAUDE.md「数字を盛らない。確認できない数値を推測で埋めない」。英語の見直し（EN-11b）の検査役が、会社ページの古い
     「よくある質問」の答え（画面の字と FAQPage の構造化データの両方）に、出どころの無い数が3種類残っているのを見つけた。
       ・応募条件の答えの「（目安）」「(guideline)」の飛行時間（約60社）── 当サイトが置いた目安で、会社の募集の数ではない
       ・比較の答えの「日本は所得税 約33%」（22社）── 累進課税を1つの率では言えない・出どころも無い
       ・2026-09-30 に画面から外した推定年収の幅（lo〜hi）を、答えだけがまだ言っている
   見る範囲 ＝ 会社ページ（SALARY の会社の airlines/{slug}.html と en/airlines/{slug}.html）の「よくある質問」の答えのぜんぶ
   （画面の <details>・スターラックスの script の faqs・FAQPage の答え）。比較の読み物（…-hikaku・ana-vs-… など）は見ない。
     E1  日本の税を1つの率（%）で言わない
     E2  「目安」「(guideline)」「(guide)」の付いた数を書かない
     E3  応募条件の飛行時間（応募条件の答えの「N hours」・どの答えでも「N時間以上」「N+ hours」「at least N hours」「Min…」）は、
         その会社の台帳（research-ledger.mjs の FACTS・salary-basis.mjs の BASIS・salary-sources.mjs の SOURCES）に
         時間の数として在るものだけ
     E4  新しい形の会社ページ（SWITCH）の答えに、その会社の推定年収の幅（機長の lo〜hi・副操縦士の lo〜hi・副操縦士の lo〜機長の hi）
         が無い ── ページが幅を出していないので、答えだけが幅を言うと、ページに無い数を言うことになる（gen-faq.mjs は幅を書かない）。
         SWITCH の外（古い形のスピリット航空）は手で書いた答えと表が今も幅を出しているので、ここでは見ない
   ※ 数を足すときは、先に台帳へ出どころつきで入れる（入れてから答えに書く）。ここを緩めて通さない。

   ★2026-10-26（WP-compare-all-17）E2 と E3 を「よくある質問」の外へ広げた ── 同じページの上の段（古い「募集要項」の枠・
     「訓練・審査」の札など、手で書いた所）が「機長5,000h以上（目安）」と言ったまま、下の答えだけが「確認できていません」になっていた。
     見る所 ＝ 会社ページのぜんぶ（画面の字・構造化データのすべての字・スターラックスの script の faqs）。
       E2  「（目安）」「(guideline)」「(guide)」「目安：」の札は、ページのどこにも書かない（生成器の「ひと目で」の段も含めて）。
           数に付いた「目安」「guideline」は、生成器の「ひと目で」の段（<!--PV-GLANCE-->）の外で見る ── あの段の「目安」は
           airline-display.mjs が台帳の行から書く資料の言葉（「京急が示す目安」「Google マップが表示した目安の時間」「相場の目安」・
           会社が公表した「目安年次」「機長への昇格の目安」）で、出どころがその場に付いている（台帳との突き合わせは airline-display.mjs --check）
       E3  応募条件の飛行時間 ──「以上」「最低」「必要」「資格」「+」「at least」「minimum」「required」「R-ATP」などの近くの
           N時間・N h・N hours・N flight hours・N factored hours・N-hour（幅は両端とも）── は、その会社の台帳に時間として在る数だけ。
           1日・月・週あたりの時間（機体の稼働・月の乗務時間）は応募条件ではないので見ない。
           米国の「1,500時間ルール」は法律の名前とその説明で、会社の募集の数ではない（WP-16 と同じく残す。近くに上の語が無いので当たらない）
   ════════════════════════════════════════════════════════════════ */
console.log('\n── E) 会社ページ（「よくある質問」とページのほかの所）が、出どころの無い数を言っていない ─────');
/* G（英語の冠詞）が同じ「よくある質問」の読み方を使う */
let faqOf = null;
{
  const { SALARY } = await import('./salary-data.mjs');
  const { SWITCH } = await import('./airline-rollout.mjs');
  const { BASIS } = await import('./salary-basis.mjs');
  const { SOURCES } = await import('./salary-sources.mjs');
  const { LEDGER } = await import('./research-ledger.mjs');
  const { unbake, curCore } = await import('./cur-core.mjs');
  const C_EN = await curCore('USD', 'en');
  const txt = (s) => String(s).replace(/<span[^>]*class="[^"]*text-muted text-xl[^"]*"[^>]*>[\s\S]*?<\/span>/g, () => '').replace(/<[^>]*>/g, () => ' ')
    .replace(/&amp;/g, () => '&').replace(/&quot;/g, () => '"').replace(/&nbsp;/g, () => ' ').replace(/\s+/g, () => ' ').trim();
  /* 1枚の答えのぜんぶ（画面の字は unbake で元の円の字へ・構造化データはそのまま） */
  const answers = (rel) => {
    const raw = readFileSync(path.join(ROOT, rel), 'utf8'), html = unbake(raw), out = [];
    const at = html.search(/<h2[^>]*>[^<]*(?:よくある質問|Frequently Asked Questions)[^<]*<\/h2>/);
    if (at >= 0) for (const m of html.slice(at).matchAll(/<details[^>]*>([\s\S]*?)<\/details>/g)) {
      const s = m[1].match(/<summary[^>]*>([\s\S]*?)<\/summary>/); if (!s) continue;
      out.push({ where: '画面', q: txt(s[1]), a: txt(m[1].slice(s.index + s[0].length)) });
    }
    for (const m of html.matchAll(/\{\s*q:\s*"((?:[^"\\]|\\.)*)"\s*,\s*a:\s*"((?:[^"\\]|\\.)*)"\s*\}/g)) out.push({ where: '画面（script）', q: m[1], a: m[2] });
    for (const m of raw.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let j; try { j = JSON.parse(m[1]); } catch { continue; }
      for (const x of (Array.isArray(j) ? j : [j])) if (x && x['@type'] === 'FAQPage') for (const it of x.mainEntity || []) out.push({ where: 'FAQPage', q: String(it.name || ''), a: String(it.acceptedAnswer?.text || '') });
    }
    return out;
  };
  faqOf = answers;
  /* ページのぜんぶの字（WP-17）。withGlance が false なら、生成器の「ひと目で」の段を外して読む */
  const GLANCE_BLOCK = /<!--PV-GLANCE-->[\s\S]*?<!--\/PV-GLANCE-->/g;
  const pageTexts = (rel, withGlance) => {
    let raw = readFileSync(path.join(ROOT, rel), 'utf8');
    if (!withGlance) raw = raw.replace(GLANCE_BLOCK, () => ' ');
    const html = unbake(raw), out = [];
    const strs = (v, acc) => { if (typeof v === 'string') acc.push(v); else if (v && typeof v === 'object') for (const x of Object.values(v)) strs(x, acc); return acc; };
    for (const m of raw.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let j; try { j = JSON.parse(m[1]); } catch { continue; }
      for (const s of strs(j, [])) out.push({ where: '構造化データ', t: s });
    }
    for (const m of html.matchAll(/\{\s*q:\s*"((?:[^"\\]|\\.)*)"\s*,\s*a:\s*"((?:[^"\\]|\\.)*)"\s*\}/g)) out.push({ where: '画面（script）', t: `${m[1]} ${m[2]}` });
    out.push({ where: '画面', t: txt(html.replace(/<!--[\s\S]*?-->/g, () => ' ').replace(/<style\b[\s\S]*?<\/style>/g, () => ' ').replace(/<script\b[\s\S]*?<\/script>/g, () => ' ')) });
    return out;
  };
  const num = (s) => String(s).replace(/(\d),\s?(?=\d{3}\b)/g, (_, d) => d);
  /* その会社の台帳に「時間」として在る数（字の中の「N時間」「N hours」「Nh」・単位が時間の行の値） */
  const ledgerHours = (slug) => {
    const set = new Set();
    const allNums = (v) => {
      if (v == null) return;
      if (typeof v === 'object') { for (const x of Object.values(v)) allNums(x); return; }
      for (const m of num(v).matchAll(/\d+/g)) set.add(m[0]);
    };
    const walk = (v) => {
      if (v == null) return;
      /* 台帳の字は乗員の略語でも書く（「5000TT・1000PIC」＝総飛行5,000時間・機長1,000時間／「command150」＝機長として150時間） */
      if (typeof v === 'string') {
        for (const m of num(v).matchAll(/(\d+)\s*(?:\+\s*)?(?:時間|hours?\b|hrs?\b|h\b|H\b|TT\b|PIC\b)|(?:command|PIC|TT)\s*(\d+)/g)) set.add(m[1] || m[2]);
        return;
      }
      if (typeof v !== 'object') return;
      /* 単位が時間の行は、値そのもの（数・字・数の組）も時間の数 */
      if (!Array.isArray(v) && /hour|時間/i.test(String(v.unit || ''))) { allNums(v.value); allNums(v.value_text); }
      for (const x of Object.values(v)) walk(x);
    };
    walk((LEDGER.FACTS || {})[slug]); walk(BASIS[slug]); walk(SOURCES[slug]);
    return set;
  };
  const JP_RATE = /(?:Japan|日本)[^.。]{0,60}?\d+(?:\.\d+)?\s*[%％]|\d+(?:\.\d+)?\s*[%％][^.。]{0,60}?(?:Japan|日本)/;
  const GUIDE = /\d[\d,]*[^。.;]{0,25}(?:目安|\(guideline\)|\(guide\))|目安[^。.;]{0,6}\d/i;
  const HOURS = /(\d[\d,]*)\s*(?:\+\s*)?(?:hours?\b|hrs?\b|h\b|時間)/g;
  const REQ_CTX = /以上|\+|at least|or more|\bmin(?:imum|\.)?\b/i;
  /* ページのぜんぶを見るときの形（WP-17）。数の頭は英字の続き（B777・A320）でないこと */
  const LABEL = /（\s*目安|\(\s*目安|目安\s*[：:]|\(\s*(?:guidelines?|guide)\s*\)/i;
  const GUIDE_PAGE = /(?<![A-Za-z\d])\d[\d,.]*[^。.;]{0,25}(?:目安|\bguidelines?\b|\(guide\))|(?:目安|\bguidelines?\b|\(guide\))[^。.;]{0,12}(?<![A-Za-z\d])\d/i;
  const HOURS_PAGE = /(?<![A-Za-z\d.,])(\d[\d,]*)(?:\s*(?:〜|~|～|–|-|to)\s*(\d[\d,]*))?\s*(?:\+\s*)?(?:(?:total\s+|factored\s+|flight\s+|flying\s+){0,2}hours?\b|hrs?\b|h\b|時間|ファクタードアワー|-hours?\b)/g;
  /* 「min」だけは分（15 min）と同じ字なので、minimum・min.・Min Hours の形に限る */
  /* ★WP-18：募集要項の行（「募集要項では、総飛行3,500時間…」「asks captains for…」「asked for…」）も応募条件として見る */
  const REQ_PAGE = /以上|最低|\+|＋|at least|or more|\bmin(?:imum\b|\.|\s+(?:flight\s+)?hours?\b)|必要|要件|条件|資格|募集要項|required|requires?|requirements?|ask(?:s|ed)? (?:[a-z]+ )?for|licen[cs]e|\bR?-?ATPL?\b/i;
  const RATE_BEFORE = /(?:1日|一日|毎日|月間?|毎月|暦月|週|年間)\s*(?:に|あたり|平均|に平均|の|平均で)?\s*$/;
  const RATE_AFTER = /^\s*(?:\+\s*)?(?:\/\s*(?:day|month|week|year|日|月|週)|(?:a|per|each)\s+(?:calendar\s+)?(?:day|month|week|year)|あたり)/i;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
  /* 円の額の書き方（「¥2,490万」「2,490万円」「¥24.9M」）を1つの正規表現の部品にする */
  const yenRe = (v) => `(?:¥?${esc(Math.round(v).toLocaleString('en-US'))}万円?|¥${esc(String(Math.round(v) / 100))}M)`;
  const bad = { E1: [], E2: [], E3: [], E4: [] };
  let nAns = 0, nHours = 0, nPage = 0;
  for (const slug of Object.keys(SALARY)) {
    const d = SALARY[slug], led = ledgerHours(slug);
    const pairs = [[d.cap.lo, d.cap.hi], [d.fo.lo, d.fo.hi], [d.fo.lo, d.cap.hi]];
    const rangeRe = pairs.flatMap(([lo, hi]) => [
      new RegExp(`${yenRe(lo)}\\s*(?:〜|~|～|–|-|to)\\s*${yenRe(hi)}`),
      new RegExp(`${esc(C_EN.fmt(lo * 10000))}\\s*(?:–|-|to)\\s*${esc(C_EN.fmt(hi * 10000))}`)]);
    for (const rel of [`airlines/${slug}.html`, `en/airlines/${slug}.html`]) {
      let list; try { list = answers(rel); } catch { continue; }
      for (const { where, q, a } of list) {
        nAns++;
        const at = `${rel}（${where}）「${q.slice(0, 40)}」`;
        if (JP_RATE.test(a)) bad.E1.push(`${at}: ${a.match(JP_RATE)[0]}`);
        if (GUIDE.test(a)) bad.E2.push(`${at}: ${a.match(GUIDE)[0]}`);
        const reqQ = /requirements to become/i.test(q);
        for (const m of a.matchAll(HOURS)) {
          const ctx = a.slice(Math.max(0, m.index - 25), m.index + m[0].length + 12);
          if (!reqQ && !REQ_CTX.test(ctx)) continue;
          nHours++;
          if (!led.has(num(m[1]))) bad.E3.push(`${at}: 「${m[0]}」（台帳に無い）`);
        }
        if (SWITCH.includes(slug)) for (const re of rangeRe) if (re.test(a)) { bad.E4.push(`${at}: ${a.match(re)[0]}`); break; }
      }
      /* ページのぜんぶ（WP-17）── 札の「（目安）」は「ひと目で」の段も含めて・数に付いた「目安」はその段の外で・応募条件の飛行時間はぜんぶで */
      for (const { where, t } of pageTexts(rel, true)) {
        const lb = t.match(LABEL);
        if (lb) bad.E2.push(`${rel}（${where}・札）: …${t.slice(Math.max(0, lb.index - 24), lb.index + 16)}…`);
        for (const m of t.matchAll(HOURS_PAGE)) {
          const before = t.slice(Math.max(0, m.index - 25), m.index), after = t.slice(m.index + m[0].length, m.index + m[0].length + 12);
          if (!REQ_PAGE.test(before + m[0] + after)) continue;
          if (RATE_BEFORE.test(t.slice(Math.max(0, m.index - 8), m.index)) || RATE_AFTER.test(after)) continue;
          nPage++;
          for (const n of [m[1], m[2]].filter(Boolean)) if (!led.has(num(n))) bad.E3.push(`${rel}（${where}）: 「${m[0]}」（台帳に無い）`);
        }
      }
      for (const { where, t } of pageTexts(rel, false)) {
        const g = t.match(GUIDE_PAGE);
        if (g) bad.E2.push(`${rel}（${where}）: ${g[0]}`);
      }
    }
  }
  ok(`E1 会社ページの「よくある質問」${nAns} 件の答えに、日本の税を1つの率で言う字が無い`, !bad.E1.length, bad.E1.slice(0, 6).join(' ／ '));
  ok('E2 会社ページのどこにも（「よくある質問」の答え・募集要項の枠・訓練の札・構造化データ）、「目安」「(guideline)」の付いた数が無い', !bad.E2.length, bad.E2.slice(0, 6).join(' ／ '));
  ok(`E3 応募条件の飛行時間（よくある質問 ${nHours} か所・ページのぜんぶ ${nPage} か所）は、どれもその会社の台帳に時間として在る数`, nHours > 0 && nPage > 0 && !bad.E3.length, bad.E3.slice(0, 8).join(' ／ '));
  ok('E4 新しい形の会社ページ（SWITCH）の答えに、推定年収の幅（lo〜hi）が無い（ページが幅を出していない）', !bad.E4.length, bad.E4.slice(0, 6).join(' ／ '));
}

/* ════════════════════════════════════════════════════════════════
   F) 英語の会社ページと比較の1枚は、米国のつづりで書く（2026-10-26 WP-compare-all-16 T4）

   英語の見直し（EN-11b）の検査役：英語のページの15枚で licence／license が1枚の中で混ざっていた（台帳の英語は英国式・
   古い節は米国式）。サイトの英語は米国式にそろえる（license・program・center）。
   見る範囲 ＝ en/airlines/*.html と en/career.html の、画面の字と構造化データの字（属性・コメント・style・script は見ない）。
   ★資料の題（かぎかっこ “…” や引用符の中）と、名前そのもの（下の PROPER）は、その資料・その名前のつづりのまま残す。
     PROPER に足してよいのは「固有の名前」だけ（制度・建物・会社の名前）。ふつうの語を足して通さない。
   ★2026-10-26（WP-compare-all-17）見る範囲を en/ の HTML のぜんぶ（en/index.html・国・地域・一覧のページを含む）へ広げた
     ── トップの英語の答えに「cadet programme」が3つ残っていた。
   ════════════════════════════════════════════════════════════════ */
console.log('\n── F) 英語のページ（en/ のぜんぶ）は、米国のつづり（license・program・center）で書く ─────');
{
  const PROPER = ['Future Pilot Programme', 'Cadet Pilot Programme', 'Cadet Pilot Training Programme', 'Assessment Centre', 'Centre for Aviation'];
  const UK = /\b(?:licen[c]es?|programmes?|centres?)\b/i;
  const walkEn = (d) => readdirSync(path.join(ROOT, d), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walkEn(`${d}/${e.name}`) : e.name.endsWith('.html') ? [`${d}/${e.name}`] : []));
  const pages = walkEn('en');
  const hits = [];
  for (const rel of pages) {
    const raw = readFileSync(path.join(ROOT, rel), 'utf8');
    const ld = [...raw.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1].replace(/“[^”]*”|\\"(?:[^"\\]|\\.)*?\\"/g, () => ' '));
    const vis = raw.replace(/<!--[\s\S]*?-->/g, () => ' ').replace(/<style\b[\s\S]*?<\/style>/g, () => ' ').replace(/<script\b[\s\S]*?<\/script>/g, () => ' ')
      .replace(/<[^>]+>/g, () => ' ').replace(/&quot;/g, () => '"').replace(/“[^”]*”|"[^"<>{}]*"/g, () => ' ');
    for (let t of [vis, ...ld]) {
      for (const p of PROPER) t = t.split(p).join(' ');
      const m = t.match(UK);
      if (m) hits.push(`${rel}: …${t.slice(Math.max(0, m.index - 40), m.index + 30).replace(/\s+/g, () => ' ')}…`);
    }
  }
  ok(`F ${pages.length} 枚の英語のページ（en/ のぜんぶ）に、引用の外の licence・programme・centre が無い`, pages.includes('en/index.html') && pages.length > 122 && !hits.length, hits.slice(0, 8).join(' ／ '));
}

/* ════════════════════════════════════════════════════════════════
   G) 英語の会社ページの「よくある質問」の冠詞は、音で決める（2026-10-26 WP-compare-all-17 T3）

   EN-11b の検査役：英語の問が32社で「What are the requirements to become a Air Canada pilot?」になっていた（古い一括生成の型の名残）。
   生成器 gen-faq.mjs も等級の名前の前で「we publish a official posting」と書いていた。
   ★母音の音で始まる語の前は an（an Air Canada・an Emirates・an easyJet・an IndiGo・an ITA・an IBEX・an Oman Air・an HK Express）。
     子音の音で始まる語の前は a のまま（a oneworld・a European・a United・a US・a UK）── one・once・eu・uni・U＋大文字は外して見る。
   見る範囲 ＝ en/airlines/{slug}.html（SALARY の会社）の「よくある質問」の問と答え（画面の <details> と FAQPage）。
   ★2026-10-26（WP-compare-all-18 S4）見る範囲を en/ の HTML のぜんぶへ広げた ── 画面の字・<title>・検索向けの説明文（meta の
     description・og・twitter）・構造化データのすべての字。説明文が「We estimate a Air India captain」「a All Nippon Airways」、本文が
     「a LHCC」のまま残っていた。頭字語を1字ずつ読む語（HK・LHCC・SAS）も母音の音で始まる＝ an。
     かぎかっこ “…” の中（資料の題）は、その資料のつづりのまま残すので見ない。
   ════════════════════════════════════════════════════════════════ */
console.log('\n── G) 英語のページ（en/ のぜんぶ）の冠詞が、音に合っている ─────');
{
  const { SALARY } = await import('./salary-data.mjs');
  const ART = /\b[Aa] (?!(?:[Oo]n[ec]|[Ee]u|[Uu]ni|U[A-Z]))(?:[AEIOaeio]|[Uu]n|(?:HK|LHCC|SAS)\b)[\w’-]*/g;
  const hits = []; let nItems = 0;
  for (const slug of Object.keys(SALARY)) {
    const rel = `en/airlines/${slug}.html`;
    for (const { where, q, a } of faqOf(rel)) {
      nItems++;
      for (const [k, t] of [['問', q], ['答え', a]]) for (const m of t.matchAll(ART)) hits.push(`${rel}（${where}・${k}）: …${t.slice(Math.max(0, m.index - 30), m.index + 30)}…`);
    }
  }
  /* en/ のぜんぶ（S4）── 画面の字・題名・説明文・構造化データ */
  const walkEn = (d) => readdirSync(path.join(ROOT, d), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walkEn(`${d}/${e.name}`) : e.name.endsWith('.html') ? [`${d}/${e.name}`] : []));
  const strs = (v, acc) => { if (typeof v === 'string') acc.push(v); else if (v && typeof v === 'object') for (const x of Object.values(v)) strs(x, acc); return acc; };
  const pages = walkEn('en'); let nMeta = 0;
  for (const rel of pages) {
    const raw = readFileSync(path.join(ROOT, rel), 'utf8'), texts = [];
    for (const m of raw.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { texts.push(['構造化データ', strs(JSON.parse(m[1]), []).join(' ¦ ')]); } catch { /* 読めない塊は B 以外では見ない */ } }
    for (const m of raw.matchAll(/<meta\b[^>]*\b(?:name|property)="(?:description|og:description|og:title|twitter:description|twitter:title)"[^>]*\bcontent="([^"]*)"/g)) { nMeta++; texts.push(['説明文', m[1]]); }
    const tt = raw.match(/<title>([^<]*)<\/title>/); if (tt) texts.push(['題名', tt[1]]);
    texts.push(['画面', raw.replace(/<!--[\s\S]*?-->/g, () => ' ').replace(/<style\b[\s\S]*?<\/style>/g, () => ' ').replace(/<script\b[\s\S]*?<\/script>/g, () => ' ')
      .replace(/<[^>]+>/g, () => ' ').replace(/&quot;/g, () => '"').replace(/&amp;/g, () => '&')]);
    for (const [where, t0] of texts) {
      const t = t0.replace(/“[^”]*”/g, () => ' ');
      for (const m of t.matchAll(ART)) hits.push(`${rel}（${where}）: …${t.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, () => ' ')}…`);
    }
  }
  ok(`G 英語のページ ${pages.length} 枚（画面の字・題名・説明文 ${nMeta} か所・構造化データ。会社ページの「よくある質問」${nItems} 件を含む）に、音に合わない冠詞（a Air・a All Nippon・a LHCC・a official…）が無い`,
    nItems > 0 && pages.includes('en/index.html') && pages.length > 122 && nMeta > 0 && !hits.length, hits.slice(0, 8).join(' ／ '));
}

/* ════════════════════════════════════════════════════════════════
   H) 会社ページの手で書いた所（生成器の段の外）が、出どころの無い数を言っていない（2026-10-26 WP-compare-all-18 S1・S5）

   ★CLAUDE.md「数字を盛らない。確認できない数値を推測で埋めない」。WP-16（よくある質問）と WP-17（募集要項の枠）のあと、同じページの
     ほかの手で書いた所（概要・路線と機材・訓練・福利厚生・米国の高給の理由の札・検索向けの説明文の出どころ）に、最初の一括生成の型が
     置いた数が残っていた ── 46社に「約200機」の形の機数、24社に「最高45%」の税率、10社に「年2〜4ヶ月分」の賞与と「年間20〜30日」の休暇、
     ピーチの「1機あたり1日10時間以上」、カタールの「月間75時間の飛行時間保証」、ユナイテッドの「$417/h × 900h」、米国4社の「日本の3〜5倍・
     月80〜90時間」、ウィズエアの「平均3.5〜5年」、台帳と食い違う設立の年（ソラシドエアの2002年 ⇔ 台帳の1997年など）。どれも台帳に無い数で、
     外した（言い換えの数は作らない）。
   見る所 ＝ 会社ページ（SALARY の会社）の生成器の段（<!--PV-X-->…<!--/PV-X-->）の外の画面の字・構造化データ（FAQPage を除く。答えは E が見る）・
   スターラックスの script の faqs ・検索向けの説明文の出どころ（PV-SEO の中の <!--PV-SRC …-->）。
     H1  外した型の数が戻っていない（既知の例と、型の言い回し：「通常N〜Nレグ」「年N〜N回の」「年N〜Nヶ月分」「年間N〜N日」「最大N〜N%のマッチング」
         「$N〜N/時間」「最高N%」の税率・席数・「N都市以上」の形の就航地の数・「N–N days」「1–2x per year」「once or twice a year」…）。
         残してよいのは台帳の会社概要に在る席数（ジェイエア・天草エアライン）と、台帳の資料の題に在る数（KLM「over 160 destinations」）と、
         同じ文に名前を並べた数（SAS の3か国）だけ。
         ★数字ではなく字で書いた数も同じ（2026-10-26 WP-18 の検品：ウィズエアの日本語「年2回実施」・ブエリングの英語「One to two checks
         per year」・LATAM の説明文の出どころ「across six countries」が、数字だけを探した1回目をすり抜けていた）── 審査の近くの「年N回」、
         「one to two checks」「two times a year」の形の回数、「six countries」「三カ国」の形の国・都市・路線の数
     H2  概数・下限つきの数（約N・~N・approx./about/around/roughly N・N以上・N超・N+・N程度）は、その会社の台帳の字に同じ数が在る
         （金額・英語の等級 ICAO Level・年は見ない ── 金額は check-salary.mjs と台帳の換算が見る）
     H3  設立の年（「N年設立」「N年に…設立」「founded / established (in) N」・設立の欄）は、その会社の台帳の設立の年（research-ledger の
         profile.founded）と同じ。台帳に無い会社は書かない
     H4  退職年齢の欄は、台帳に年齢の行がある会社（ZIPAIR：60〜65歳は契約社員）にだけ在る
     H5  免許・審査の当局の名前は、その会社の国のものだけ（sheet の S3。2026-10-26 WP-18 の検品）。最初の一括生成の型が、メキシコ・
         コロンビア・パナマ・チリの4社に「ANAC/Aerocivil/DGAC等…FAA/EASA準拠」、スペイン・イタリア・オランダ・ポーランド・英国の5社に
         「CAA UK/DGAC/LBA等」、ケニア・南アフリカに「ECAA/SACAA/KCAA」とエチオピア航空の文、ニュージーランド・フィジー・ジェットスターに
         「CASA/CAA NZ」、英国の2社に EASA、ベトジェットに「DGCA」、スターラックスに「CAAC TW」を置いていた。台帳に当局の言い方が在る
         会社はその言い方（ウィズエアUK・英国航空の UK CAA、ケニアの KCAA、南アフリカの SACAA）、無い会社は外した（推測で置き換えない）。
         「その会社の国のもの」は airline-countries.mjs の国の当局（auth）と、米国の FAA の制度の名前・英国の UK CAA・NZ の CAA NZ・
         カナダの Transport Canada。ほかの国の当局の名前が残ってよいのは、下の許す表の言い回し（読む人の免許の書き換え・英国の会社の
         EASA からの書き換え・easyJet の EU の子会社・欧州のチャーター・台帳の募集例の FAA 型式限定・その国の当局の名前）の中だけ
   ※ 数を足すときは、先に台帳へ出どころつきで入れる。ここを緩めて通さない（下の許す表に足してよいのは、台帳に在る数か、名前を並べた数だけ）。
   ════════════════════════════════════════════════════════════════ */
console.log('\n── H) 会社ページの手で書いた所が、出どころの無い数を言っていない ─────');
{
  const { SALARY } = await import('./salary-data.mjs');
  const { unbake } = await import('./cur-core.mjs');
  const { LEDGER } = await import('./research-ledger.mjs');
  const { why } = await import('./airline-rollout.mjs');
  const { BASIS } = await import('./salary-basis.mjs');
  const { SOURCES } = await import('./salary-sources.mjs');
  /* 手で書いた所 ＝ 生成器の段を外す（PV-SEO の中の PV-SRC だけは残す）・style と script を外す（FAQPage 以外の構造化データとスターラックスの faqs は残す） */
  const hand = (raw) => raw.replace(/<!--(PV-[A-Z0-9-]+)-->[\s\S]*?<!--\/\1-->/g, (m) => { const s = m.match(/<!--PV-SRC [\s\S]*?-->/); return ` ${s ? s[0] : ''} `; })
    .replace(/<style\b[\s\S]*?<\/style>/g, () => ' ')
    .replace(/<script\b[\s\S]*?<\/script>/g, (m) => (/faqs/.test(m) || (/ld\+json/.test(m) && !/"FAQPage"/.test(m)) ? m : ' '));
  const text = (h) => unbake(h).replace(/<!--PV-SRC([\s\S]*?)-->/g, (m, a) => ` ${a} `).replace(/<!--[\s\S]*?-->/g, () => ' ').replace(/<[^>]+>/g, () => ' ')
    .replace(/&quot;/g, () => '"').replace(/&amp;/g, () => '&').replace(/&#39;/g, () => "'").replace(/\s+/g, () => ' ');
  const KNOWN = [/1機あたり1日10時間|10h\+\/day/, /月間75時間の飛行時間保証|75h\/month guaranteed/, /月75時間超過分/, /\$417\/h|× ?900h/, /日本の3〜5倍|月80〜90時間/,
    /平均3\.5〜5年|average of 3\.5–5 years/, /約4,000人の日本人/, /1日最大1,000便|1,000\+ daily departures/,
    /通常\d+〜\d+レグ|\d+\s?(?:–|-|to)\s?\d+ (?:legs|sectors)/, /年\d+〜\d+回の|\d+–\dx per year|\d+–\d times (?:a|per) year|once or twice a year|one to two times (?:a|per) year/,
    /(?:Check|チェック|審査|OPC|LPC)[^。.]{0,40}?年\d+回|\b(?:[Oo]ne|[Tt]wo|[Tt]hree)(?: to (?:two|three|four))? (?:checks?|times) (?:per|a) year/,
    /\b(?:[Tt]wo|[Tt]hree|[Ff]our|[Ff]ive|[Ss]ix|[Ss]even|[Ee]ight|[Nn]ine|[Tt]en|[Dd]ozens of) (?:countries|nations|cities|routes|destinations)\b|[二三四五六七八九十]+(?:カ国|か国|ヶ国|都市|路線)/,
    /（年\d+〜\d+ヶ月分|\d+–\d+ months' pay/, /年間\d+〜\d+日|\d+\s?(?:–|-|to)\s?\d+ days(?: per year)?\b/, /最大\d+〜\d+%のマッチング|up to \d+–\d+%/,
    /\$\d+〜\d+\/時間|\$\d+–\d+ per hour/, /（最高\d+(?:\.\d+)?%|最高\d+(?:\.\d+)?%（|\((?:up to|max|top rate|federal top rate|top federal rate) \d+(?:\.\d+)?%/, /\d+席|\d+[- ]seats?\b|\(\d+ seats/,
    /\d+(?:〜\d+)?(?:都市|カ国|路線)(?:以上|超)?|\d+\+? (?:cities|countries|routes|destinations)\b|more than \d+ (?:cities|countries|routes|destinations)/];
  /* 許す表（台帳に在る数・名前を並べた数だけ） */
  const ALLOW_SEATS = { 'j-air': ['76', '95'], amx: ['48'] };
  const ALLOW_COUNT = { klm: ['160都市以上', 'more than 160 cities'], sas: ['3カ国', 'three countries'] };
  const ALLOW_APPROX = { spirit: ['25+ yrs'] };   // 古い形のページの年次の表の段（上の年収の幅から組んだ「推定」と表に書いてある）
  /* H5 免許・審査の当局の名前。その会社の国のもの ＝ airline-countries.mjs の auth（EU の国は EASA）＋ 下の OWN_EXTRA */
  const { AIRLINE_COUNTRY, BY_CODE } = await import('./airline-countries.mjs');
  const AUTH = /\b(?:FAA|EASA|JCAB|CAAK|MOLIT|CASA|CAA ?NZ|CAA New Zealand|UK CAA|CAA UK|DGAC|LBA|ANAC|Aerocivil|AFAC|GCAA|GACA|QCAA|BCAA|ECAA|SACAA|KCAA|DGCA|CAAC|CAAS|CAAT|CAAP|CAAV|CAAM|HKCAD|Transport Canada|TCCA|SHGM|CARC|CAAF|ENAC|AESA|ULC|R-ATP|Part[- ]1(?:21|35|42)|Check Airman)\b/g;
  const OWN_EXTRA = { US: ['FAA', 'R-ATP', 'Part 121', 'Part 135', 'Part 142', 'Check Airman'], GB: ['UK CAA', 'CAA UK'], NZ: ['CAA NZ', 'CAA New Zealand'], CA: ['Transport Canada', 'TCCA'] };
  const ownAuth = (cc) => new Set([BY_CODE[cc]?.auth, ...(OWN_EXTRA[cc] || [])].filter(Boolean));
  /* 許す言い回し（ほかの国の当局の名前が、その言い回しの中でだけ残ってよい） */
  /* H5 の続き：アフリカの型がケニア・南アフリカに置いていた、別の会社（エチオピア航空）の文 */
  const OTHER_AIRLINE = /エチオピア航空は自社(?:訓練センター|養成)|Ethiopian Airlines (?:operates its own in-house|relies mainly on in-house)/g;
  const ALLOW_AUTH = {
    qantas: ['JCAB-to-CASA'],                                   // 読む人（日本の免許）の書き換え
    'british-airways': ['conversion from EASA'], 'virgin-atlantic': ['converted from EASA'],   // 英国の会社の、EASA からの書き換え
    easyjet: ['UK CAA/EASA ATPL', 'UK CAA / EASA ATPL'],         // 同じページが書く EU の子会社（easyJet Europe）
    'eagle-jet': ['EASA'],                                       // 欧州のチャーター（国は特定できない）
    saudia: ['FAA type rating'],                                 // 年収の台帳の 2005 年の募集例（BASIS）
    iberia: ['AESA-issued'], vueling: ['AESA-approved'], 'ita-airways': ['ENAC-certified'], lot: ['ULC-certified'], tap: ['ANAC-approved'],   // その国の当局
  };
  /* その会社の台帳の字のぜんぶ。単位を別の欄に持つ行（値 38・単位「機」）は「38機」の形も足す（数と単位を並べて照らすため） */
  const ledText = (slug) => {
    const unitOf = Object.values((LEDGER.FACTS || {})[slug] || {}).flat().filter((r) => r.unit)
      .flatMap((r) => [...String(r.value_text ?? r.value ?? '').replace(/(\d),(?=\d{3})/g, (_, d) => d).matchAll(/\d+(?:\.\d+)?/g)].map((x) => `${x[0]}${r.unit}`));
    return [JSON.stringify((LEDGER.FACTS || {})[slug] || {}), JSON.stringify(BASIS[slug] || {}), JSON.stringify(SOURCES[slug] || {}),
      ...['SOURCES', 'LIVING', 'NETWORK'].map((k) => JSON.stringify((LEDGER[k] || {})[slug] || {})), ...unitOf].join(' ').replace(/(\d),(?=\d{3})/g, (_, d) => d);
  };
  /* 単位の組（ページの数の後ろの単位 → 台帳で同じ数の隣に在るべき単位） */
  const UNITS = [['機|aircraft|planes?'], ['都市|cities|destinations'], ['路線|routes?'], ['か国|カ国|ヶ国|countries'], ['日|days?'], ['時間|h|hrs?|hours?'],
    ['%|％|percent'], ['年|years?|yrs?'], ['歳'], ['人|名|pilots?|people'], ['席|seats?|人乗り'], ['ヶ月|か月|カ月|months?'], ['週|weeks?'], ['回|times'], ['便|flights|departures']]
    .map(([u]) => [new RegExp(`^(?:${u})(?![a-z])`, 'i'), u]);
  const founded = (slug) => {
    const ys = new Set();
    for (const r of Object.values((LEDGER.FACTS || {})[slug] || {}).flat()) {
      if (r.key !== 'founded' || why(r)) continue;
      const v = String(r.value || r.value_text || ''), g = v.match(/(1[89]\d\d|20\d\d)/), h = v.match(/平成(\d+)年/), s = v.match(/昭和(\d+)/);
      ys.add(g ? g[1] : h ? String(1988 + +h[1]) : s ? String(1925 + +s[1]) : '');
    }
    return ys;
  };
  const APPROX = /(?:約|およそ|概ね|おおむね|~|approx\.?|approximately|about|around|roughly|nearly)\s?(\d[\d,.]*)\s*([^\s\d。.,;:）)]{0,10})|(\d[\d,.]*)\s*(以上|超|\+|強|程度)/gi;
  const MONEY_AFTER = /^(?:万|円|M\b|K\b)/;
  const FOUND = /((?:19|20)\d\d)年([^。<]{0,30}?)(?:設立|創業|創立)|(?:[Ff]ounded|[Ee]stablished)(?: in| on)?(?: \d{1,2} \w+)? ((?:19|20)\d\d)/g;
  const CELL = /<div><div class="text-xs text-muted uppercase tracking-widest mb-1">([^<]*)<\/div><div class="[^"]*">([\s\S]*?)<\/div><\/div>/g;
  const bad = { H1: [], H2: [], H3: [], H4: [], H5: [] }; let nApprox = 0, nFound = 0, nPages = 0, nAuth = 0;
  for (const slug of Object.keys(SALARY)) {
    const L = ledText(slug), F = founded(slug), OWN = ownAuth(AIRLINE_COUNTRY[slug]);
    for (const rel of [`airlines/${slug}.html`, `en/airlines/${slug}.html`]) {
      const h = hand(readFileSync(path.join(ROOT, rel), 'utf8')), t = text(h); nPages++;
      for (const re of KNOWN) for (const m of t.matchAll(new RegExp(re.source, 'g'))) {
        if (/席|seat/.test(m[0]) && (ALLOW_SEATS[slug] || []).some((n) => m[0].includes(n))) continue;
        if ((ALLOW_COUNT[slug] || []).some((a) => a.includes(m[0]) || t.slice(m.index, m.index + a.length).includes(a))) continue;
        bad.H1.push(`${rel}: …${t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 10)}…`);
      }
      for (const m of t.matchAll(APPROX)) {
        const n = (m[1] || m[3]).replace(/,/g, () => '').replace(/\.$/, () => '');
        const at = m.index + m[0].indexOf(m[1] || m[3]);
        if (m[1] && MONEY_AFTER.test(m[2] || '')) continue;
        if (/(?:¥|\$|USD|AED|SAR|GBP|EUR|HK\$|NTD|OMR|BHD)\s?$/.test(t.slice(Math.max(0, at - 5), at))) continue;
        if (/(?:Level|レベル|ICAO)\s?$/.test(t.slice(Math.max(0, at - 14), at))) continue;
        if (/^(?:19|20)\d\d$/.test(n)) continue;
        if ((ALLOW_APPROX[slug] || []).some((a) => t.slice(m.index, m.index + a.length) === a)) continue;
        nApprox++;
        /* 単位が付いていれば、台帳でも同じ数がその単位と並んでいること（「約200機」は台帳の「A330-200」では通らない） */
        const after = t.slice(at + (m[1] || m[3]).length, at + (m[1] || m[3]).length + 30).replace(/^\s*(?:以上|超|\+|強|程度)?\s*/, () => '').replace(/^(?:(?:total|flight|flying|factored)\s+)+/i, () => '');
        const u = UNITS.find(([re]) => re.test(after));
        const N = n.replace('.', () => '\\.');
        const has = u ? new RegExp(`(?<![\\d.])${N}(?!\\d)\\s*(?:\\+|以上|超|程度)?\\s*(?:(?:total|flight|flying|factored|civil aviation)\\s*)*(?:${u[1]})|(?:${u[1]})[^\\d"]{0,10}(?<![\\d.])${N}(?!\\d)`, 'i').test(L)
          : new RegExp(`(?<![\\d.])${N}(?!\\d)`).test(L);
        if (!has) bad.H2.push(`${rel}: 「${m[0].trim()}」（台帳に${u ? '同じ単位で' : ''}無い） …${t.slice(Math.max(0, m.index - 24), m.index + m[0].length + 8)}…`);
      }
      for (const m of t.matchAll(FOUND)) {
        if (m[2] && /就航|破綻|刷新|運航開始|加盟|上場|申請|撤退|統合/.test(m[2])) continue;
        nFound++; const y = m[1] || m[3];
        if (!F.has(y)) bad.H3.push(`${rel}: ${y}（台帳 ${[...F].join('/') || 'なし'}） …${t.slice(Math.max(0, m.index - 16), m.index + 36)}…`);
      }
      for (const m of h.matchAll(CELL)) {
        const label = m[1], v = m[2].replace(/<[^>]*>/g, () => '');
        if (/^(?:設立|Founded|設立・就航|Founded \/ Launched)$/.test(label)) { nFound++; const y = (v.match(/(?:19|20)\d\d/) || [''])[0]; if (!F.has(y)) bad.H3.push(`${rel}（${label}の欄）: ${v}（台帳 ${[...F].join('/') || 'なし'}）`); }
        if (/^(?:退職年齢|Ret\. Age|Retirement Age)$/.test(label) && slug !== 'zipair') bad.H4.push(`${rel}（${label}の欄）: ${v}`);
      }
      for (const m of t.matchAll(AUTH)) {
        nAuth++;
        const k = m[0].replace(/^CAA ?NZ$/, () => 'CAA NZ').replace(/^Part[- ]/, () => 'Part ');
        if (OWN.has(k)) continue;
        if ((ALLOW_AUTH[slug] || []).some((p) => p.includes(m[0]) && t.slice(Math.max(0, m.index - p.length), m.index + m[0].length + p.length).includes(p))) continue;
        bad.H5.push(`${rel}: 「${m[0]}」（${AIRLINE_COUNTRY[slug] || '国なし'}） …${t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 20)}…`);
      }
      if (slug !== 'ethiopian-airlines') for (const m of t.matchAll(OTHER_AIRLINE)) bad.H5.push(`${rel}: 別の会社の文 …${t.slice(m.index, m.index + m[0].length + 20)}…`);
    }
  }
  ok(`H1 会社ページ ${nPages} 枚の手で書いた所に、外した型の数（機数・税率・レグ数・審査の回数・賞与の月数・休暇の日数・席数・就航地の数・既知の例）が戻っていない`, nPages === Object.keys(SALARY).length * 2 && !bad.H1.length, bad.H1.slice(0, 8).join(' ／ '));
  ok(`H2 手で書いた所の概数・下限つきの数（${nApprox} か所）は、どれもその会社の台帳に同じ数が在る`, nApprox > 0 && !bad.H2.length, bad.H2.slice(0, 8).join(' ／ '));
  ok(`H3 設立の年（${nFound} か所・本文と欄）は、どれもその会社の台帳の設立の年と同じ`, nFound > 0 && !bad.H3.length, bad.H3.slice(0, 8).join(' ／ '));
  ok('H4 退職年齢の欄は、台帳に年齢の行がある会社（ZIPAIR）にだけ在る', !bad.H4.length, bad.H4.slice(0, 8).join(' ／ '));
  ok(`H5 免許・審査の当局の名前（${nAuth} か所）は、その会社の国のもの（ほかの国の名前は許す言い回しの中だけ）・別の会社（エチオピア航空）の文が無い`, nAuth > 0 && !bad.H5.length, bad.H5.slice(0, 8).join(' ／ '));
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
