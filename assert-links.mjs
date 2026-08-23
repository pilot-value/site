/* ══════════════════════════════════════════════════════════════
   assert-links.mjs — 内部リンクの構造を検査する

   なぜ要るか
     assert-seo.mjs は1枚ずつの <head> を見る。だが順位を落とす欠陥の
     多くは「ページ単体は正しいが、繋がり方が壊れている」型で、1枚ずつ
     見ていると絶対に出てこない。

     1) hreflang の相互参照（return tag）
        ja が en を指していても、en が ja を指し返していないと Google は
        そのペアの hreflang を**丸ごと無視する**。片側だけ直すと「指定した
        つもりで効いていない」状態になり、日本語版と英語版が重複扱いに
        なって共倒れする。assert-seo.mjs は「指す先のファイルが存在するか」
        までしか見ていないので、ここは別に要る。

     2) 孤立ページ（どこからもリンクされていない）
        sitemap に載っていればクロールはされるが、内部リンクがゼロだと
        重要度が伝わらない。110社ぶん作っても、辿り着けなければ順位は付か
        ない。

     3) クリック深さ
        トップから何回で着くか。深いページほど評価が薄まる。

     4) 内部リンク切れ
        存在しないファイルを指しているリンク。クロールの無駄。

     5) H1
        無い／複数あるページ。何のページか機械に伝わらない。

   ★ 静的な href しか見ない
     search.js などが実行時に組み立てるドロワーのリンクは数えない。
     Google は JS を実行するが「実行しないと辿れないページ」は評価が
     遅れるので、静的リンクだけで到達できることを見たい。つまりここで
     孤立と出たら、それは実際に弱い。

     6) 外部リンクの生存（--online のときだけ）
        各社の採用ページなど、外へ出て行くリンクを実際に叩く。
        相手のサイトは勝手に作り替えられるので、こちらが何もしなくても
        いつの間にか 404 になる。「応募する」を押して「ページがありません」
        が出るのは、数字の間違いと同じくらい信用を削る。
        ⚠️ 相手の一時的な不調でも落ちるので、デプロイ前チェックには入れない。
           月に一度くらい手で流す。

   実行: node assert-links.mjs            内部リンクだけ（ネット不要）
         node assert-links.mjs --online   外部リンクも叩く（数分かかる）
   ══════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://pilot-value.com';

const dirs = ['.', 'airlines', 'countries', 'en', 'en/airlines', 'en/countries'];
const files = dirs.flatMap((d) => {
  const abs = path.join(__dirname, d);
  return fs.existsSync(abs)
    ? fs.readdirSync(abs).filter((f) => f.endsWith('.html')).map((f) => (d === '.' ? f : `${d}/${f}`))
    : [];
}).sort();

const doc = new Map();
for (const rel of files) {
  const html = fs.readFileSync(path.join(__dirname, rel), 'utf8');
  const robots = (html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i) || [])[1] || '';
  doc.set(rel, {
    html,
    noindex: /noindex/i.test(robots),
    h1: (html.match(/<h1[\s>]/gi) || []).length,
  });
}

/* href をリポジトリ内の相対パスに正規化する。外部・アンカー・mailto は捨てる。 */
const resolve = (from, href) => {
  if (!href) return null;
  const h = href.trim();
  if (/^(https?:|mailto:|tel:|#|javascript:|data:)/i.test(h)) {
    /* 自サイト絶対URLだけは内部として扱う */
    if (!h.startsWith(ORIGIN)) return null;
    return resolve(from, h.slice(ORIGIN.length) || '/');
  }
  const clean = h.split('#')[0].split('?')[0];
  if (!clean) return null;
  let p = clean.startsWith('/')
    ? clean.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(from), clean));
  if (p === '' || p.endsWith('/')) p += 'index.html';
  if (!p.endsWith('.html')) return null;   /* 画像やCSSは対象外 */
  return p;
};

/* ── リンクグラフを組む ─────────────────────────────────────── */
const outLinks = new Map();   // rel -> Set(rel)
const broken = [];
for (const [rel, d] of doc) {
  const set = new Set();
  for (const m of d.html.matchAll(/<a\b[^>]*\shref="([^"]*)"/gi)) {
    const t = resolve(rel, m[1]);
    if (!t) continue;
    if (!doc.has(t)) { broken.push({ from: rel, href: m[1], to: t }); continue; }
    if (t !== rel) set.add(t);
  }
  outLinks.set(rel, set);
}
const inCount = new Map([...doc.keys()].map((k) => [k, 0]));
for (const [, set] of outLinks) for (const t of set) inCount.set(t, inCount.get(t) + 1);

/* ── トップからの深さ（BFS）───────────────────────────────── */
const depth = new Map();
for (const root of ['index.html', 'en/index.html']) {
  if (!doc.has(root)) continue;
  const q = [[root, 0]];
  while (q.length) {
    const [n, dp] = q.shift();
    if (depth.has(n) && depth.get(n) <= dp) continue;
    depth.set(n, dp);
    for (const t of outLinks.get(n) || []) q.push([t, dp + 1]);
  }
}

/* ── hreflang の相互参照 ───────────────────────────────────── */
const altOf = (rel) => {
  const out = {};
  for (const m of doc.get(rel).html.matchAll(/<link\b[^>]*\srel="alternate"[^>]*>/gi)) {
    const hl = (m[0].match(/hreflang="([^"]*)"/i) || [])[1];
    const href = (m[0].match(/href="([^"]*)"/i) || [])[1];
    if (hl && href) out[hl] = resolve(rel, href);
  }
  return out;
};
const hreflangIssues = [];
for (const rel of doc.keys()) {
  if (doc.get(rel).noindex) continue;
  const mine = altOf(rel);
  for (const [hl, target] of Object.entries(mine)) {
    if (hl === 'x-default' || !target || !doc.has(target) || target === rel) continue;
    const theirs = altOf(target);
    /* 相手の alternate 群に自分が含まれているか（return tag） */
    const pointsBack = Object.values(theirs).includes(rel);
    if (!pointsBack) {
      hreflangIssues.push({ from: rel, to: target, hl, detail: `${target} は ${rel} を指し返していない` });
    }
  }
}

/* ── 出力 ───────────────────────────────────────────────────── */
const indexable = [...doc.keys()].filter((k) => !doc.get(k).noindex);
const orphans = indexable.filter((k) => inCount.get(k) === 0 && k !== 'index.html' && k !== 'en/index.html');
const unreached = indexable.filter((k) => !depth.has(k));
const deep = indexable.filter((k) => (depth.get(k) ?? 99) >= 4).sort((a, b) => (depth.get(b) ?? 99) - (depth.get(a) ?? 99));
const noH1 = indexable.filter((k) => doc.get(k).h1 === 0);
const multiH1 = indexable.filter((k) => doc.get(k).h1 > 1);

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n═══ 内部リンク構造 — ${doc.size} ページ（うち index 対象 ${indexable.length}）═══\n`);

const show = (title, list, fmt, limit = 12) => {
  console.log(`── ${title}: ${list.length} ──`);
  list.slice(0, limit).forEach((x) => console.log('   ' + fmt(x)));
  if (list.length > limit) console.log(`   …ほか ${list.length - limit}`);
  if (!list.length) console.log('   ✓ なし');
  console.log('');
};

show('hreflang の相互参照が無い（Google は無視する）', hreflangIssues, (x) => `${pad(x.from, 34)} → ${x.to}`);
show('内部リンク切れ', broken, (x) => `${pad(x.from, 34)} href="${x.href}"`);
show('孤立ページ（内部リンクの被リンク 0）', orphans, (x) => x);
show('トップから静的リンクで辿り着けない', unreached, (x) => x);
show('クリック深さ 4以上', deep, (x) => `${pad(x, 40)} 深さ${depth.get(x)}`);
show('H1 が無い', noH1, (x) => x);
show('H1 が複数', multiH1, (x) => `${pad(x, 40)} ${doc.get(x).h1}個`);

/* ── 海外評判の一覧が overseas-rep/ と揃っているか ──
   航空会社ページは「一覧に載っている会社」の JSON だけ取りに行く。
   JSON を足して一覧を書き出し忘れると、その会社だけ画面に出ない（黙って消える）。
   逆に JSON を消して一覧に残すと 404 が復活する。どちらもここで止める。 */
const { codesOnDisk, codesInUi } = await import('./gen-overseas-rep-list.mjs');
const repDisk = codesOnDisk();
const repUi = codesInUi() || [];
const repIssues = [
  ...repDisk.filter((c) => !repUi.includes(c)).map((c) => `${c}: JSON はあるのに一覧に無い（画面に出ない）`),
  ...repUi.filter((c) => !repDisk.includes(c)).map((c) => `${c}: 一覧にあるのに JSON が無い（404 になる）`),
];
show(`海外評判の一覧のずれ（node gen-overseas-rep-list.mjs で直る／いま ${repDisk.length}社）`, repIssues, (x) => x);

/* ── スマホでメニューが開けるか ──
   ハンバーガーと引き出しを組み立てるのは search.js（航空会社の日本語ページだけ
   airline-base.js が同じことをする）。ヘッダーだけ置いて script を入れ忘れると、
   スマホでは他のページへ行く手段が丸ごと無くなる。実際に 271 ページで起きていた。
   ログイン・投稿など流れの途中の画面は、わざと出していないので対象外。 */
const APPFLOW = new Set([
  '404.html', 'admin.html', 'auth-callback.html', 'login.html', 'signup.html',
  'profile.html', 'my-value.html', 'actual-pay.html', 'pay-report.html', 'submit-review.html', 'unsubscribe.html',
]);
const noMenu = [...doc.keys()].filter((k) => {
  if (APPFLOW.has(path.basename(k))) return false;
  const h = doc.get(k).html;
  if (!/id="main-nav"/.test(h)) return false;
  return !/src="[^"]*(search|airline-base)\.js/.test(h);
});
show('スマホでメニューが出ない（ヘッダーはあるのに search.js が無い）', noMenu, (x) => x);

/* ── ファビコン ──
   宣言が無いとタブとブックマークが白紙のままになる。全ページで同じ物を指す。 */
const noIcon = [...doc.keys()].filter((k) => !/rel="icon"/.test(doc.get(k).html));
show('ファビコンの宣言が無い', noIcon, (x) => x);

/* ── 書体 ──
   CSS で 'Inter' を指定しているのに読み込む宣言が無いと、そのページだけ
   端末の既定書体（Helvetica / ヒラギノ）で出る。エラーにならないので
   気づけない。実際にログイン・登録・マイページ・404 の14枚がそうなっていた。 */
const noFont = [...doc.keys()].filter((k) => {
  const h = doc.get(k).html;
  return /font-family:\s*['"]Inter['"]/.test(h) && !/fonts\.googleapis\.com\/css2/.test(h);
});
show('Inter を指定しているのに読み込んでいない（端末の既定書体で出る）', noFont, (x) => x);

/* ── 外部リンクの生存（--online のときだけ）─────────────────────
   相手のサイトが作り替えられて 404 になっていないかを実際に叩く。
   ・HEAD にだけ 404 を返すサーバーがあるので、駄目なら GET でもう一度見る
   ・403 / 429 は「機械を弾かれた」だけで、人が開けば見えることが多い。分けて出す
   ・落ちるのは相手都合でも起きるので exitCode には足さない（＝デプロイは止めない） */
if (process.argv.includes('--online')) {
  const ext = new Map();   // url -> Set(page)
  for (const [rel, d] of doc) {
    for (const m of d.html.matchAll(/<a\b[^>]*\shref="(https?:\/\/[^"]+)"/gi)) {
      const u = m[1];
      if (/pilot-value\.com|fonts\.google|gstatic|jsdelivr|cdn\.tailwind|supabase\.co/.test(u)) continue;
      if (!ext.has(u)) ext.set(u, new Set());
      ext.get(u).add(rel);
    }
  }
  const urls = [...ext.keys()].sort();
  console.log(`\n── 外部リンクを叩く: ${urls.length}本 ──`);
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
  const HDR = { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9' };
  /* ⚠️ HEAD ではなく GET で取る。
        200 を返しながら中身が「ページがありません」のサイトがあり（実際にあった）、
        本文を読まないと見抜けない。 */
  const probe = async (u) => {
    try {
      const r = await fetch(u, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000), headers: HDR });
      const body = await r.text().catch(() => '');
      const title = ((body.match(/<title[^>]*>([\s\S]{0,140}?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
      return { status: r.status, final: r.url, title };
    } catch (e) {
      return { status: 0, err: String(e.cause?.code || e.name || e).slice(0, 30) };
    }
  };
  const res = [];
  let cur = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cur < urls.length) {
      const u = urls[cur++];
      res.push({ u, pages: [...ext.get(u)], ...(await probe(u)) });
      process.stdout.write('.');
    }
  }));
  console.log('\n');
  /* 200 でも中身が「ページがありません」のことがある（相手が404を200で返す型） */
  const NOTFOUND = /(page[- ]?not[- ]?found|no longer available|お探しのページ|ページが見つかり)/i;
  /* 401 と 503 も「切れている」ではなく「機械だと見て断られた」ことがある。
     実際 copaair.com は 401、emirates.com は 503 を返すが、人が開けば普通に見える。
     UND_ERR_HEADERS_OVERFLOW は相手ではなくこちら（Node）の上限。lot.com が該当し、
     curl では 200 が返る。落とすと「直しようのない指摘」が毎回残るので分けて出す。 */
  const blocked = res.filter((r) => [401, 403, 429, 503].includes(r.status) || r.err === 'UND_ERR_HEADERS_OVERFLOW');
  const dead = res.filter((r) => {
    if (blocked.includes(r)) return false;
    if (r.status === 0 || r.status >= 400) return true;
    return NOTFOUND.test(r.title);
  });
  const jaOnly = (ps) => ps.filter((p) => !p.startsWith('en/'));
  console.log(`── 切れている外部リンク: ${dead.length} ──`);
  dead.sort((a, b) => a.u.localeCompare(b.u)).forEach((r) => {
    console.log(`   [${r.status || r.err}] ${r.u}`);
    console.log(`        ${jaOnly(r.pages).join(', ')}${r.pages.length > jaOnly(r.pages).length ? '（英語版も同じ）' : ''}`);
  });
  console.log(`\n── 相手が機械を弾いた（人が開けば見えることが多い）: ${blocked.length} ──`);
  blocked.forEach((r) => console.log(`   [${r.status || r.err}] ${r.u}`));
  console.log(`\n生存 ${res.length - dead.length} / ${res.length}（切れているものは exitCode に足さない）\n`);
}

const dist = {};
indexable.forEach((k) => { const d = depth.get(k); dist[d ?? '到達不可'] = (dist[d ?? '到達不可'] || 0) + 1; });
console.log('── クリック深さの分布 ──');
Object.entries(dist).sort((a, b) => (a[0] === '到達不可' ? 1 : b[0] === '到達不可' ? -1 : a[0] - b[0]))
  .forEach(([d, n]) => console.log(`   深さ${pad(d, 8)} ${n}ページ`));

const total = hreflangIssues.length + broken.length + orphans.length + unreached.length + noH1.length + multiH1.length
  + repIssues.length + noMenu.length + noIcon.length + noFont.length;
console.log(`\n══ 合計 ${total} 件の指摘 ══\n`);
process.exitCode = total ? 1 : 0;
