// check-salary.mjs — 全ページを salary-data.mjs と突き合わせて整合検証。
// node check-salary.mjs
//
// パス1: 各航空会社ページに、その会社の「機長平均」「副操縦士平均」が載っているか。
// パス2: サイト全 HTML から「社名＋役職＋金額」の並びを拾って SSOT と突き合わせる。
//
// ★ パス2 を足した理由: パス1 は SALARY を回して airlines/{slug}.html しか見ないため、
//   トップ・記事・比較ページが SSOT と一度も照合されていなかった。他社の年収を語る
//   ページは、その他社のページを直しても直らない。実際にこれで見つかった例:
//     world-jobs.html    Cathay Pacific「機長年収2,500万円〜」（SSOT のレンジ下限3,000万すら下回る）
//     pilot-vs-isha.html ANA「機長 ¥4,200万」（SSOT は2,700万）
//     index.html         LCC の FAQ が3社とも平均より高い数字
//   いずれも JSON-LD の FAQ や比較表＝検索結果に出る場所だった。
//
// ★ パス1・パス2 の両方に「根拠の等級」が入っている（2026-09-29／向きは 2026-10-01 に裏返した）。
//   salary-basis.mjs で等級を決めた会社・職位には、**公開情報から出した推定年収を出す**。
//   公式募集例・求人の掲載額・条件つきの給与例が取れている職位は、その額を**推定の隣に併記する**
//   （オーナー指示「基本全て推定でいいじゃん」）。前は逆で、根拠の強い額が1つ取れていれば
//   推定を画面から外していた（25社×2職位のうち36件が金額ごと消えた）。
//   判定は2本立て ── 掲載額は salary-basis.mjs（原貨が正本）と、推定は SALARY と突き合わせる。
//   どちらにも当たらない数字だけを ❌ にする。
//   ⚠️ 等級を決めていない会社は今までどおり SALARY と突き合わせる（振る舞いは変わらない）。
//   ⚠️ 運航乗務員（会社が職位で分けていない1数字）と訓練生は SALARY に無いので、台帳だけで見る。
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SALARY, buildSalaryJson } from './salary-data.mjs';
import { BASIS, TIERS, figures as basisFigures } from './salary-basis.mjs';
/* 英語ページの金額は HTML の時点でドルに焼き込んである（bake-en-currency.mjs）。
   元の円表記は span の data-orig に残っているが、**タグの中なので下の正規表現からは
   見えない**。戻さずに読むと、英語ページ 183枚が照合から黙って外れる。 */
import { unbake } from './cur-core.mjs';

// ── 生成物 salary-data.json が buildSalaryJson() と完全一致しているか（サラリーエンジン供給の整合） ──
// json は gen-salary-json.mjs の生成物（{spine, airlines:{slug:{...SALARY,ladder}}}）。
// 手編集や再生成漏れ・ラダー導出のズレをここで検出する。
function checkSalaryJson() {
  const p = 'salary-data.json';
  if (!existsSync(p)) return { ok: false, msg: `${p} が無い（node gen-salary-json.mjs を実行）` };
  let json;
  try { json = JSON.parse(readFileSync(p, 'utf8')); }
  catch { return { ok: false, msg: `${p} が壊れている（JSON parse 失敗）` }; }
  const a = JSON.stringify(buildSalaryJson());
  const b = JSON.stringify(json);
  if (a !== b) return { ok: false, msg: `${p} が salary-data.mjs と不一致（node gen-salary-json.mjs で再生成）` };
  const nAir = Object.keys(json.airlines || {}).length;
  return { ok: true, msg: `${p} == buildSalaryJson()（${nAir}社／背骨${(json.spine||[]).length}段）` };
}

const man = (n) => n.toLocaleString('en-US') + '万';

// 既知の「これが残っていたら誤り」な陳腐化文字列（そのページ固有）
const STALE = {
  'skymark': ['2,900万', '2,400万'],
  'delta': ['9,000万'],
  'united': ['8,500万'],
  'american': ['8,000万'],
  'cathay-pacific': ['7,000万'],
  'singapore-airlines': ['5,800万'],
  'emirates': ['5,100万'],
  'qatar-airways': ['5,100万'],
  'jal': ['900万〜2,700万', '900万〜¥2,700万'],
};

/* ── 根拠の等級（salary-basis.mjs）─────────────────────────────────
   その会社・その職位について「画面に出していい万円の数値」の集合を作る。
   原貨の金額から man() で毎回計算するので、レートを取り直せばここも一緒に動く。 */
const RANKS = { cap: '機長', fo: '副', crew: '運航乗務員', trainee: '訓練生' };
function basis(slug, rank) {
  const r = BASIS[slug]?.[rank];
  if (!r) return null;
  /* 金額の作り方は salary-basis.mjs の figures() 1か所。ここに写さない
     （欄を足したときに、片方だけ古くなって黙って検査から外れるのを防ぐ）。 */
  const allowed = new Set(basisFigures(slug, rank).map((f) => f.man));
  return { tier: r.tier, ja: TIERS[r.tier].ja, allowed, was: r.held?.was ?? null };
}

let pass = 0, warn = 0, fail = 0;
const lines = [];
for (const [slug, d] of Object.entries(SALARY)) {
  const p = `airlines/${slug}.html`;
  if (!existsSync(p)) { lines.push(`❓ ${slug}: page not found`); warn++; continue; }
  /* ★ 「同じ国の他社」リンク（link-countries.mjs の PV-CLINK ブロック）には
        他社の年収が入っている。そこを一緒に読むと、たとえば skymark のページに
        あるジェットスター・ジャパンの¥2,400万を skymark の古い数値と誤検知する
        （実際に stale:2,400万 の誤報が出た）。このページ自身の主張だけを見る。 */
  const html = unbake(readFileSync(p, 'utf8'))
    .replace(/<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->/g, '')
    /* ★2026-09-30、比較の一文も落とす。gen-faq.mjs が全社の FAQ に
         「ANA・JALの機長は推定約¥2,700万、副操縦士は推定約¥1,800万です。」を入れるので、
         そこに出ている ANA・JAL の額を**そのページの会社の額**と読んでしまう。
         実際にサウディアで起きた ── 旧平均が偶然 ANA・JAL の副操縦士と同じ 1,800万 で、
         「旧平均が残っている」と誤報した。PV-CLINK と同じ理屈で、このページ自身の主張だけを見る。 */
    .replace(/ANA・JALの機長は[^。]*?です。/g, '')
    .replace(/ANA and JAL captains[^.]*?\./g, '');
  /* 職位ごとに「出ていないと困るもの」と「残っていたら困るもの」を組む。
     等級を決めていない会社 = 今までどおり SALARY の平均が出ていること。
     等級のある会社         = その等級の掲載額のどれかが出ていること。

     ★2026-09-30、推定（estimate）の向きを裏返した。
       オーナー指示「確認中じゃなくて推定とかにすりゃいいじゃん」で、元の平均は
       「推定」として画面に**戻す**ことになった。前はここが逆で、旧平均が
       ページに残っていたら落としていた（gone）。いまは estimate の職位では
       **出ていないと落とす**。

     ★2026-10-01、公式募集例・求人の掲載額・過去の募集広告・条件つきの給与例の職位も
       同じ向きに裏返した。オーナー指示「**なぜ半分以上確認中なの？基本全て推定でいいじゃん**」で、
       根拠の強い額が1つ取れている職位でも、**推定年収を併記する**ことになった
       （画面はもうそうなっている。実際にオマーン航空は「2017年の募集広告 1,951万」の隣に
       「推定 2,500万」を出している）。
       前はここで旧平均が残っていたら落としていた（`gone`）ので、画面が先に進んだぶん
       **18件が赤く出て、製品のほうが正しい**状態だった。
       ⚠️ 旧平均の見張りを外しただけにしない。`held.was.avg` は50件すべて
          `salary-data.mjs` の現在の avg と一致している（実測）ので、**その avg が
          出ていること**を代わりに求める。数字が古くなったページは今までどおり捕まる。 */
  const needAny = [], shown = [];
  for (const [rank, nm] of Object.entries(RANKS)) {
    const B = basis(slug, rank);
    /* crew（運航乗務員＝機長と副操縦士をあわせた会社公表の平均）と trainee（訓練生）は、
       その資料がある会社にだけ置いてある。無い会社では何も求めない。 */
    if (!B) { if (!d[rank]) continue; const s = man(d[rank].avg); needAny.push([nm, [s]]); shown.push(nm + s); continue; }
    if (B.tier === 'estimate') {
      const s = man(B.was?.avg ?? d[rank]?.avg);
      needAny.push([`${nm}(推定)`, [s]]); shown.push(`${nm}推定${s}`); continue;
    }
    if (B.tier === 'held') { needAny.push([nm, ['確認中']]); shown.push(`${nm}確認中`); continue; }
    const list = [...B.allowed].sort((x, y) => y - x).map(man);
    /* ★ 推定年収も「出ていてよい額」に入れる（要求はしない）。
         会社自身が出している額が取れている職位では、推定を**併記してもしなくてもよい**。
         併記しているページ（オマーン航空・ピーチ・スターラックスなど）はこれで通り、
         会社の額だけで組んでいるページ（エミレーツ ── 公式の現金給与と総待遇の2つを
         並べていて、推定を足すと機長の金額が3つになる／エティハド）も通る。
         ⚠️ 「出ていなくてよい」は「何でも出せる」ではない。ページに出ている金額が
            SSOT と食い違っていれば、下のパス2（全ページ × SSOT）が ❌ にする。
            ここは「その職位に何か出ているか」・あちらは「出ている額が正しいか」。 */
    if (d[rank]) list.push(man(d[rank].avg));
    needAny.push([`${nm}(${B.ja})`, list]);
    shown.push(`${nm}${B.ja}${man([...B.allowed].sort((x, y) => y - x)[0])}`);
  }
  const miss = needAny.filter(([, list]) => !list.some((s) => html.includes(s)));
  const stale = (STALE[slug] || []).filter((s) => html.includes(s));
  let status = '✅', tag = '';
  if (miss.length) {
    status = '❌'; fail++;
    tag = miss.map(([n, l]) => `missing:${n}[${l.join('/')}]`).join(' ');
  } else if (stale.length) { status = '⚠️ '; warn++; tag = `stale:${stale.join(',')}`; }
  else { pass++; }
  lines.push(`${status} ${slug.padEnd(20)} ${shown.join(' ')}   ${tag}`);
}
console.log(lines.join('\n'));
console.log(`\n${pass} pass · ${warn} warn · ${fail} fail  (of ${Object.keys(SALARY).length})`);

// ── パス2: サイト全 HTML × SSOT のクロスチェック ─────────────────────────
// 「社名 …少し離れて… 役職 …少し離れて… 数値万」という並びを全部拾い、SSOT と比べる。
// 表のセル（<td>ANA</td><td>機長</td><td>2,700万</td>）も拾えるよう、隙間はタグを跨がせる。
//
// ❌ = その会社の [lo, hi] の外。反証の余地なく間違い。
// ⚠️ = レンジ内だが SSOT の節目（avg / lo / hi）でない。人が見る価値がある。
//      ⚠️ には原理的に消せない誤検知が1種類ある — 「中東（Emirates・Qatar など）では
//      機長の平均年収が2,900〜3,700万」のように、複数社の平均をまたぐ言い方。
//      1社の lo/hi と比べる作りなので区別できない。ALLOW に理由つきで置く。

const SKIP_DIR = new Set(['node_modules', '.git', 'temporary screenshots', 'baland_ass', 'supabase', 'db', '.github']);
function walkHtml(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIR.has(e) || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkHtml(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}

// 「全日本空輸（ANA）」→ ['全日本空輸（ANA）', '全日本空輸', 'ANA'] のように呼び名を展開。
// 2文字以下（「JAL」未満の断片）は普通の文中で誤爆するので捨てる。
function aliases(d) {
  const out = new Set();
  for (const raw of [d.ja, d.en]) {
    if (!raw) continue;
    out.add(raw);
    const m = raw.match(/^(.+?)\s*[（(]([^）)]+)[）)]\s*$/);
    if (m) { out.add(m[1].trim()); out.add(m[2].trim()); }
  }
  return [...out].filter((s) => s.length >= 3);
}
const ALIAS = [];
for (const [slug, d] of Object.entries(SALARY)) for (const a of aliases(d)) ALIAS.push({ slug, a });
ALIAS.sort((x, y) => y.a.length - x.a.length); // 長い呼び名を先に当てる
const ALL_ALIAS = ALIAS.map((x) => x.a);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ROLE = '(機長|副操縦士|Captain|Captains|First Officer|First Officers)';
const GAP = '(?:<[^>]*>|[^<>\\d]){0,24}';  // タグを跨ぐ。跨がないと表のセルが全部見えない
const NUM = '([\\d,]{3,6})';
// 年額そのものでない数値（手取り・月額・住宅手当込みの実質パッケージ）は SSOT と一致しなくて当然
const DERIVED = /手取|月収|月額|毎月|月あたり|税引|実質|パッケージ|take-?home|after[- ]tax|per month|monthly|effectively|package/i;
// 社名の直前がこれなら、より長い社名の一部（「日本航空」⊂「新日本航空」、「ANA」⊂「ANAウイングス」）
const NAME_CHAR = /[0-9A-Za-zぁ-ゖァ-ヺー一-鿿]/;

// レンジ内だが節目でない ⚠️ のうち、人が見て正しいと判断したもの。
// 消すのではなく理由を残す（数字を動かしたとき、この理由ごと見直せるように）。
/* 2026-09-30、5件あった例外を**全部外した**。
   どれも「カタールの平均2,900」「エミレーツの平均3,700」「ANA副操縦士の
   1,400〜2,100」のように、**根拠を確認できず公開表示をやめた平均**を
   正しいものとして指していた。指していた文はページから消えている。
   残しておくと、同じ金額が別の形で戻ってきたときに黙って通す。
   新しく足すときは、指す文が今もページに在ることを確かめてから足す
   （在るかどうかは下の「使われていない許容」が毎回知らせる）。 */
const ALLOW = [];
/* 使われなくなった例外を知らせる。
   例外は「人が一度見て正しいと判断した」印なので、指している文がページから
   消えたあとも残ると、次に同じ金額が現れたときに黙って見逃す穴になる。
   2026-09-30、スターラックスの体験記の行がまさにそれだった
   （根拠の無いレンジを公開表示から外したので、指していた文ごと消えていた）。 */
const allowUsed = new Set();

const files = walkHtml('.');
let nHit = 0, nBad = 0, nWarn = 0;
const cross = [];
for (const f of files) {
  const html = unbake(readFileSync(f, 'utf8')).replace(/<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->/g, '');
  for (const { slug, a } of ALIAS) {
    const d = SALARY[slug];
    const re = new RegExp(esc(a) + GAP + ROLE + GAP + NUM + '(?:\\s*万?\\s*[〜~–—-]\\s*' + NUM + ')?\\s*万', 'g');
    let m;
    while ((m = re.exec(html)) !== null) {
      const span = m[0];
      // ① 社名がより長い社名の一部でないか
      if (m.index > 0 && NAME_CHAR.test(html[m.index - 1])) continue;
      if (ALL_ALIAS.some((x) => x.length > a.length && html.startsWith(x, m.index))) continue;
      // ② 社名と金額のあいだに、別の社名や行の切れ目が挟まっていないか
      //    （比較表で「ANA（参考）」の見出しから隣の会社のセルまで届いてしまう）
      const inner = span.slice(a.length);
      if (/<\/(?:tr|thead|tbody|table|section|article|li|ul|ol)>/.test(inner)) continue;
      if (ALL_ALIAS.some((x) => x !== a && !a.includes(x) && inner.includes(x))) continue;
      // ③ 手取り・月額・実質パッケージは年額ではない
      if (DERIVED.test(html.slice(Math.max(0, m.index - 40), m.index + span.length + 20))) continue;

      /* ★ 運航乗務員（機長と副操縦士をあわせた会社公表の平均）と訓練生の額を、
           機長・副操縦士の額として判定しない。会社が職位で分けていない数字なので、
           機長の掲載額と突き合わせると必ず食い違い、直せない ❌ が出続ける。
           「機長と副操縦士をあわせた運航乗務員の平均」のように書くと m[1] に機長が入るため、
           まわりの言葉を見て先に振り分ける。 */
      /* ★2026-10-01、見る範囲を「役職の語から金額まで」に狭めた。
           前は金額の前後80字を見ていたので、
           「当サイトの推定で機長 約¥2,700万…**会社公表は運航乗務員**全体の平均2,005万円」
           のように**金額より後ろ**に出てくる運航乗務員を拾い、推定の 2,700万 を
           「運航乗務員の平均」として判定していた（JAL・スカイマークで8件の ❌）。
           見るのは span（社名から金額まで）だけにする ── その金額に付いている語は
           必ずこの中に在る。「運航乗務員（機長＋副操縦士）平均 ¥2,005万」のように
           役職の語より**前**に出る書き方も、社名から見るのでちゃんと拾える
           （役職から後ろだけに狭めると、こちらが18件まとめて ⚠️ に落ちた）。 */
      const role = /運航乗務員/.test(span) && BASIS[slug]?.crew ? 'crew'
        : /訓練生|初任給|チャレンジ手当/.test(span) && BASIS[slug]?.trainee ? 'trainee'
        : /機長|Captain/.test(m[1]) ? 'cap' : 'fo';
      const lo = +m[2].replace(/,/g, '');
      const hi = m[3] ? +m[3].replace(/,/g, '') : null;
      nHit++;
      const text = span.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
      const lineNo = () => html.slice(0, m.index).split('\n').length;

      /* ★ 等級のある職位は SALARY ではなく salary-basis.mjs の掲載額と突き合わせる。
           SALARY の平均・レンジは公開表示から外した種類の数字なので、ここで一致を
           求めると「外したはずの数字」をページに戻す方向に働いてしまう。
           ALLOW（人が見て正しいと判断した例外）はこちらには効かせない ──
           あれは SSOT のレンジに対する例外で、等級の話ではないため。 */
      /* ★2026-09-30、推定（estimate）だけはこの枝を通さず下の SSOT 突き合わせへ落とす。
           推定の職位に載せる数字は salary-data.mjs の avg / lo / hi そのものなので、
           台帳には掲載額が1件も無い（＝ここで判定すると必ず食い違う）。
           判定の中身は等級を作る前と1文字も同じ ── avg / lo / hi のどれかなら正、
           レンジ表記なら lo〜hi と一致、外れていれば ❌。 */
      const B = basis(slug, role);
      if (B && B.tier !== 'estimate') {
        if (B.tier === 'held') {
          nBad++;
          cross.push(`❌ ${f}:${lineNo()}  «${text.slice(0, 56)}»  ${slug} ${role} は確認中（金額を出さない）`);
          continue;
        }
        if (hi === null ? B.allowed.has(lo) : B.allowed.has(lo) && B.allowed.has(hi)) continue;
        /* ★2026-10-01 ── 台帳の掲載額ではなかった。ここで落とさず、下の SSOT 突き合わせへ送る。
             オーナー指示「**基本全て推定でいいじゃん**」で、根拠の強い額が取れている職位にも
             **推定年収を併記する**ことになった（オマーン航空のページは「2017年の募集広告 1,951万」の
             隣に「推定 2,500万」を出している）。推定の数字は salary-data.mjs が正なので、
             台帳ではなく SSOT と突き合わせるのが正しい判定。
             ⚠️ 運航乗務員（crew）と訓練生（trainee）は SALARY に無い＝下に比べる相手がいないので、
                ここで落とす。あちらは会社が職位で分けていない数字・訓練期間中の額で、推定とは別物。 */
        if (!d[role]) {
          nBad++;
          const list = [...B.allowed].sort((x, y) => y - x).map(man).join('／');
          cross.push(`❌ ${f}:${lineNo()}  «${text.slice(0, 56)}»  ${slug} ${role} は「${B.ja}」で ${list}`);
          continue;
        }
      }

      if (!d[role]) continue;   // crew / trainee は SALARY に無い（等級の側で見ている）
      const S = d[role];
      // 単独の数値は avg / lo / hi のどれかであれば正。レンジ表記は lo〜hi と一致すべき。
      if (hi === null ? [S.avg, S.lo, S.hi].includes(lo) : lo === S.lo && hi === S.hi) continue;
      const skip = ALLOW.findIndex(([af, frag]) => f.replace(/^\.\//, '') === af && text.includes(frag));
      if (skip >= 0) { allowUsed.add(skip); continue; }
      const outside = hi === null ? (lo < S.lo || lo > S.hi) : (hi < S.lo || lo > S.hi);
      if (outside) nBad++; else nWarn++;
      const ln = html.slice(0, m.index).split('\n').length;
      cross.push(`${outside ? '❌' : '⚠️ '} ${f}:${ln}  «${text.slice(0, 56)}»  SSOT ${role} ${S.avg}（${S.lo}〜${S.hi}）`);
    }
  }
}
console.log(`\n── 全ページ × SSOT クロスチェック ──`);
if (cross.length) console.log(cross.sort().join('\n'));
console.log(`${files.length}ファイル・${nHit}件照合  ❌${nBad} ⚠️${nWarn}（許容${ALLOW.length}件は除外）`);
const dead = ALLOW.map((a, i) => [a, i]).filter(([, i]) => !allowUsed.has(i));
if (dead.length) {
  console.log(`\n⚠️ 使われていない許容が ${dead.length} 件（指していた文がページから消えている＝穴になる前に外す）`);
  for (const [[af, frag]] of dead) console.log(`   ${af}  «${frag}»`);
}

const js = checkSalaryJson();
console.log(`\n${js.ok ? '✅' : '❌'} salary-data.json: ${js.msg}`);

// ★ 以前は salary-data.json の不一致でしか exit 1 にならず、ページ側の ❌ が
//   出力に埋もれて本番まで抜けていた。ページの ❌ も落とす。
if (!js.ok || fail || nBad) process.exitCode = 1;
