/* ══════════════════════════════════════════════════════════════════
   assert-career-live.mjs — 比較（career.html?view=compare）の生きた欄の場面（2026-10-22）

   守っているもの（口コミの区域の場面。給与の区域（cmp-pay）も、自分の場面をこのファイルに足す）
     ・外へは1本も出ない（場面 net）── 手元の口と LIBS のほかは門が止めて数える。すり抜けは0。ブラウザは名前も引けない。
     ・返事を用意していない自分の呼び出しを見逃さない（場面 unknown）── 黙って「準備中」に見せない。
     ・口コミの行のほかの列（昔の口コミに書かれた給与・職位）を、画面にも保存領域にも出さない。サーバーの抜粋は抜粋の場所にだけ（場面 leak）。
     ・6角形の名前は会社ページの図と同じ正本から（島 #crl-cats・static）。点数は誰にでも・6分類ぜんぶに点数がある会社だけ点数で塗る・
       塗れない会社は 3.0 の淡い面で数字なし・読めなかった会社は空（場面 radar）。
     ・新しい投稿の抜粋は誰にでも。続きは口コミの Give & Get（給与の入口と混ぜない）── 鍵の無い人にだけ1つ（場面 clip）。
     ・投稿が無い2社に、数字も2つの文も出さない（場面 zero）。
     ・会社ページと比較が、同じ上限の件数で口コミを数え、同じ1つの数え方（realRated）で評価を出す（static）。
     ・比較の評価は会社ページと同じ数（星・点数・「n件の評価」、次の行に「会員の投稿 n件」）。点の低い投稿も数える（場面 rate）。
     ・点数の無い会社・投稿の無い会社に、0 も空の星も置かない（場面 unrated）。
     ・片方の会社が読めなくても、もう片方は出す。やり直すのは読めなかった方だけ（場面 side）。
     ・1社の概要（career.html?airline=…）も同じ数え方（場面 overview）。
     給与の区域（cmp-pay ── 比較の「提出された年収」。返事の材料は cmp-stubs.mjs の payFix）
     ・鍵の無い人（ゲスト・会員・期限切れ）には、会社ごとの件数だけ。行・額・板を描かず、返事に植えた列は画面にも保存領域にも出ない。
       中央値（pv_company_pay）も DEEP PAY も聞かない。錠の1行と入口（Give & Get）は1つずつ・「ログイン」はゲストにだけ（場面 pay-lock）。
     ・鍵の開いた人：職位ごとに会社の列・5行まで見せて6行目からは畳む・REAL PAY の行（職位は繰り返さない）・住所は air= と pos= だけ・
       選ぶ欄も入力欄も置かない・給与の入口は出さない（場面 pay-open）。
     ・中央値は開いた答えからだけ・額のそばに人数を書かない・鍵の無い人と行の無い2社には聞きもしない（場面 pay-med）。
   どの場面も、終わりに3つを確かめる：本番の supabase への要求 0・外へすり抜けた要求 0・（MOCK）自分の呼び出しに全部返事があった。

   実行: node assert-career-live.mjs [--scenes a,b] [--shots <folder>] [--via form|call] [--sql <file>]
     --scenes  場面を選ぶ（static・net・unknown・leak・zero … pay-lock・pay-open・pay-med）。付けなければ全部（static → MOCK → REAL LOCAL の順）
     --shots   場面の確かめのあと、口コミ・月の働き方・待遇の箱を、その場面の大きさで撮って置く（置き場は打った場所。ファイルに書かない）
     --via     REAL LOCAL の場面で、会員の投稿を画面から入れるか（form）・関数で入れるか（call）。結果の行に書く
     --sql     REAL LOCAL の場面だけ：種をまいたあと、そのファイルの SQL を流す（壊したサーバーの写しを試す。リポジトリの SQL は直さない）
   MOCK ＝ 返事を検査が作る場面／REAL LOCAL ＝ 手元の SQL が答える場面。結果の行にどちらかを必ず書く
     [STATIC] ファイルを読むだけ（つながりについては何も言わない）
     [MOCK] 返事を検査が作った画面
     [REAL LOCAL CONNECTION] 手元の SQL とつながった画面（serve-local.mjs）
     [REAL LOCAL SQL] 手元の SQL の返事の字だけを見る
   本番については何も言わない（本番は 未確認）。
   check.mjs には入っていない。手で流す。
   ══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import * as H from './cmp-stubs.mjs';

const { slot, until, release, BASE_STUB } = H;
const ROOT = H.ROOT;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
void release;

const argv = process.argv.slice(2);
const argOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const WANT = argOf('--scenes') ? argOf('--scenes').split(',').map((s) => s.trim()).filter(Boolean) : null;
const SHOTS = argOf('--shots');
const VIA = argOf('--via') || 'call';
const SQL = argOf('--sql');
if (!['form', 'call'].includes(VIA)) { console.error('--via は form か call'); process.exit(2); }
if (SQL && !fs.existsSync(SQL)) { console.error('--sql のファイルが無い: ' + SQL); process.exit(2); }

/* ── 数え方と書き方 ─────────────────────────────────────────── */
let pass = 0, fail = 0, CUR = null;
const TAG = { static: '[STATIC]', mock: '[MOCK]', sql: '[REAL LOCAL SQL]', local: '[REAL LOCAL CONNECTION]' };
const tag = () => {
  const m = CUR ? CUR.mode : 'static';
  return m === 'local' || m === 'sql' ? `${TAG[m]} VIA=${VIA}` : TAG[m];
};
const ok = (cond, label, detail = '') => {
  const who = CUR ? `${CUR.key}: ` : '';
  if (cond) { pass++; console.log(`${tag()} ✓ ${who}${label}`); }
  else { fail++; console.log(`${tag()} ✗ ${who}${label}${detail ? `\n      ${String(detail).slice(0, 600)}` : ''}`); }
};
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(4, 44 - t.length))}`);
/* 検査の側の条件が満たされるまで待つ（時間では待たない） */
const waitFor = async (fn, ms = 8000) => {
  const t0 = Date.now();
  while (!fn()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 20)); }
  return true;
};
/* コメントを外した JavaScript（assert-airline-glance.mjs の noJsCmt と同じ式） */
const noJsCmt = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/gm, (m, h) => h);

/* ── 場面の登録と、場面の終わりの確かめ ───────────────────────── */
const SCENES = [];
const scene = (key, label, mode, fn) => SCENES.push({ key, label, mode, fn });

/* 場面の終わりに赤くする理由（どの場面もこの1つで判定する ── 場面 unknown が、この関数そのものを確かめる）。
   expected ＝ 場面がわざと返事を用意しなかった1枚（st.unknown を自分で確かめた）。 */
function sceneFaults(mode, sts) {
  const all = (k) => sts.flatMap((s) => s[k]);
  return {
    supa: all('supa'),
    through: all('through'),
    unknown: mode === 'mock' ? sts.filter((s) => !s.expected).flatMap((s) => s.unknown) : [],
  };
}

let browser = null, mockEnv = null;
const NET = { through: 0, supa: 0, blocked: 0 };
/* 場面の中の open(size, opt)：この検査のブラウザと、その場面のサーバーで開く（cmp-stubs.mjs の open） */
const open = async (size, opt = {}) => {
  const o = await H.open(browser, CUR.env.local, size, { mode: CUR.mode === 'mock' ? 'mock' : 'local', ...opt });
  CUR.pages.push(o);
  return o;
};
/* REAL LOCAL の場面が、種をまいたあとに呼ぶ（--sql の写しを流す） */
const afterSeed = async () => { if (SQL) await CUR.env.exec(fs.readFileSync(SQL, 'utf8')); };
void afterSeed;
/* --shots：口コミ・月の働き方・待遇の箱を撮る */
async function shots(page, size) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [box, sel] of [['rev', '.cr-cmp-rev'], ['work', '.cr-cmp-work'], ['ben', '.cr-cmp-ben']]) {
    const h = await page.$(`#cr [data-view="compare"] ${sel}`);
    if (h) await h.screenshot({ path: path.join(SHOTS, `${CUR.key}-${size}-${box}.png`) });
  }
}

/* ── 比較の画面の道具 ───────────────────────────────────────── */
const PAIR_URL = (a, b) => `/career.html?view=compare&a=${a}&b=${b}`;
const CMP_SLOTS = ['cmp-stars', 'cmp-work', 'cmp-facts'];
/* その欄が、その2社について読み終わった（待ちの顔でも、まだ何もしていない顔でもない） */
const settled = (page, kind, want) => until(page, ([kind, want]) => {
  const b = document.querySelector(`#cr [data-view="compare"] .crl[data-live="${kind}"]`);
  return !!b && b.getAttribute('data-for') === want && !['idle', 'loading'].includes(b.getAttribute('data-state'));
}, [kind, want]);
const settledAll = async (page, want) => {
  for (const k of CMP_SLOTS) if (!(await settled(page, k, want))) return false;
  return true;
};

/* ── 返事の材料（字は検査が持つ。ページのコードで作り直さない）────────── */
/* 口コミの1行。6つの点数のほかに、画面に出してはいけない列を植えておく（場面 leak が探す） */
const row = (id, [c, s, b, w, o, t], extra = {}) => ({
  id, airline: 'x', created_at: '2026-09-01T00:00:00Z',
  culture_score: c, salary_score: s, benefits_score: b, wlb_score: w, ops_score: o, training_score: t,
  cats: ['salary'], position: 'PLANTED_POS', annual_salary: 98765432, monthly_salary: 7654321, bonus: 4443332,
  base_annual: 2221110, flight_allowance_annual: 9990001, clip: { k: 'salary', o: 'PLANTED-CLIP-TEXT', t: {} }, ...extra,
});
const NUL = [null, null, null, null, null, null];
const FIX = {
  /* → 「3.5」・星 70%・「2件の評価」・「会員の投稿 3件」 */
  JAL: [row(1, [5, 4, 3, 4, 5, 3]), row(2, [3, 3, 3, 3, 3, 3]), row(3, NUL)],
  /* → 「4.2」・星 84%・「1件の評価」・「会員の投稿 1件」（1つの分類に点が無い） */
  ANA: [row(4, [4, null, 4, 5, 4, 4])],
  /* → 「評価未取得」・「会員の投稿 2件」・星の形は無い */
  EVA: [row(5, NUL), row(6, NUL)],
  /* → 「会員からの投稿はまだありません」 */
  ETD: [],
  /* → 「3.0」・「2件の評価」・「会員の投稿 2件」（点の低い行も数える） */
  TWO: [row(7, [5, 5, 5, 5, 5, 5]), row(8, [1, 1, 1, 1, 1, 1])],
};
const CLIP_MARK = 'PLANTED-CLIP-TEXT';
const PLANTED = ['98765432', '7654321', '4443332', '2221110', '9990001', 'PLANTED_POS', CLIP_MARK];
/* 会社ごとの口コミの返事（{ slug: rows | { status, body } }）。聞かれた会社は p.airlines の先頭 */
const reviewsBy = (map) => (p) => {
  const a = p && Array.isArray(p.airlines) ? p.airlines[0] : '';
  const r = map[a];
  if (r && !Array.isArray(r)) return r;
  return { status: 200, body: { ok: true, unlocked: false, rows: r || [] } };
};

/* ══ static ══════════════════════════════════════════════════════ */
scene('static', 'ファイルの約束（口コミの読み方）', 'static', async () => {
  /* S2 会社ページ（airline-reviews-ui.js）と比較（career-live.js）が同じ上限で読み、サーバーの上限もそれと同じ
     ＝ どちらのページも同じ行で止まる（「会員の投稿 n件」が2つの画面で同じ数になる前提） */
  const LIM = [
    ['career-live.js', /fetchRows\(a\[0\], \{ airlines: codes, limit: (\d+) \}\)/g],
    ['airlines/airline-reviews-ui.js', /PVReviewI18n\.fetchRows\(sb, \{ airlines: airlineCodes\(\), limit: (\d+) \}\)/g],
    ['db/reviews-gate.sql', /v_limit int\s+:= least\(greatest\(coalesce\(\(p->>'limit'\)::int, \d+\), 1\), (\d+)\);/g],
  ].map(([f, re]) => [f, [...read(f).matchAll(re)].map((m) => m[1])]);
  ok(LIM.every(([, v]) => v.length === 1), '口コミの上限の件数が、3か所に1つずつ書いてある（career-live.js・airline-reviews-ui.js・db/reviews-gate.sql）',
    JSON.stringify(LIM));
  ok(LIM.every(([, v]) => v[0] === LIM[0][1][0]), `会社ページと比較が同じ上限で口コミを読み、サーバーの上限もそれと同じ（${LIM.map(([f, v]) => `${f}=${v.join('/')}`).join('・')}）`,
    JSON.stringify(LIM));

  /* S3 評価を数えるのは realRated() の1つだけ。昔の数え方（score / scoreLine と「口コミ n件」）は残さない。
     評価件数（revRated）と口コミ件数（revPosts）を1行に並べない（2つの数を同じ数に見せない）。
     片方の会社だけ読めなかった時の部品は、ファイルに1つずつ（給与・カードの区域も同じものを使う） */
  const LJ = noJsCmt(read('career-live.js'));
  const old = ['function score(', 'scoreLine', 'revCount'].filter((w) => LJ.includes(w));
  ok(old.length === 0, '昔の数え方が残っていない（score() ・ scoreLine ・ 「口コミ n件」の revCount）', old.join(','));
  const both = LJ.split('\n').filter((l) => l.includes('T.revPosts(') && l.includes('T.revRated('));
  ok(both.length === 0, '評価件数（T.revRated）と口コミ件数（T.revPosts）を、同じ1行で組み立てない', both.join(' ／ '));
  const ONE = ['both', 'needOne', 'sideFail', 'partial', 'retryBtn'].map((n) => [n, LJ.split(`function ${n}(`).length - 1]);
  ok(ONE.every(([, c]) => c === 1), '片方だけ読めなかった時の部品（both・needOne・sideFail・partial・retryBtn）が、1つずつだけ在る', JSON.stringify(ONE));

  /* S4 口コミ件数の字は、会社ページ（gen-airline-glance.mjs）と比較（career-live.js の revPosts）で同じ言葉 */
  ok(read('gen-airline-glance.mjs').includes('会員の投稿 <b data-pvg-n="posts">'), '会社ページの口コミ件数は「会員の投稿 n 件」（gen-airline-glance.mjs）');
  const rp = LJ.match(/revPosts:\s*(function\s*\(n\)\s*\{[^}]*\})/);
  let said = null;
  try { said = rp ? new Function(`return (${rp[1]});`)()(7) : null; } catch { said = null; }
  ok(typeof said === 'string' && said.startsWith('会員の投稿 ') && said.endsWith('件') && said.includes('7'),
    '比較の口コミ件数も「会員の投稿 」で始まり「件」で終わる（revPosts）', String(said));

  /* S5 比較の6角形に添える6分類の名前は、career.html の島（#crl-cats）にちょうど1つ。中身は口コミの部品の正本（CAT_FULL）と
     同じ6つを同じ順で ── 会社ページの評価スコアの図と同じ言葉（名前をページのコードに打たない・生成し忘れたら赤） */
  const CH = read('career.html');
  const isl = [...CH.matchAll(/<script type="application\/json" id="crl-cats">([^<]*)<\/script>/g)];
  let islNames = null;
  try { islNames = isl.length === 1 ? JSON.parse(isl[0][1]) : null; } catch { islNames = null; }
  const full = (read('airlines/airline-reviews-data.js').match(/const CAT_FULL\s*=\s*\[([^\]]*)\];/) || [])[1];
  const CATS = full ? [...full.matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
  ok(CH.split('id="crl-cats"').length === 2 && isl.length === 1, 'career.html に6分類の名前の島（id="crl-cats"）がちょうど1つ', `島 ${isl.length}`);
  ok(CATS.length === 6 && JSON.stringify(islNames) === JSON.stringify(CATS),
    `島の名前は、口コミの部品の正本（airlines/airline-reviews-data.js の CAT_FULL）の6つと同じ順で同じ（${CATS.join('・')}）`,
    JSON.stringify([islNames, CATS]));

  /* 比較の口コミの入口の言葉は、会社ページの概要の口コミの入口（gen-airline-glance.mjs の RV_CTA.overview）と1文字も違わない */
  const rv = (read('gen-airline-glance.mjs').match(/export const RV_CTA = \{ overview: (\[[^\]]*\])/) || [])[1];
  const ru = LJ.match(/revUnlock:\s*(\[[^\]]*\])/);
  let ov = null, mine = null;
  try { ov = rv ? JSON.parse(rv.replace(/'/g, '"')) : null; mine = ru ? JSON.parse(ru[1].replace(/'/g, '"')) : null; } catch { ov = mine = null; }
  ok(Array.isArray(ov) && ov.length > 0 && JSON.stringify(mine) === JSON.stringify(ov),
    `比較の口コミの入口（T.revUnlock）は、会社ページの概要の口コミの入口と同じ言葉（「${(ov || []).join('')}」）`, JSON.stringify([mine, ov]));
});

/* ══ MOCK ════════════════════════════════════════════════════════ */
scene('net', '外へは1本も出ない（手元の口と LIBS のほかは止めて数える・名前も引けない）', 'mock', async () => {
  const m = read('assert-admin.mjs').match(/const NO_NAMES = ((?:'[^']*'\s*(?:\+\s*)?)+);/);
  const theirs = m ? [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]).join('') : null;
  ok(!!theirs && theirs === H.NO_NAMES, 'ブラウザが名前を引けるのは localhost と LIBS だけ（assert-admin.mjs の NO_NAMES と1文字も違わない）',
    JSON.stringify([theirs, H.NO_NAMES]));
  const args = (browser.process() && browser.process().spawnargs) || [];
  ok(args.includes(H.NO_NAMES), 'この検査のブラウザは、その網を付けて立ち上がっている', args.filter((a) => /resolver/.test(a)).join(' ') || '（付いていない）');
  const { page, st } = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FIX.JAL, ana: FIX.ANA }) } });
  ok(await settledAll(page, 'jal|ana'), '比較の3つの欄が読み終わった（口コミ・月の働き方・待遇）');
  /* 試しに、外の住所（本番の解析）へ2本投げる ── 門が止めて数え、どちらも外へ出ない */
  const PROBE = ['www.googletagmanager.com', 'www.google-analytics.com'];
  await page.evaluate(() => {
    new Image().src = 'https://www.googletagmanager.com/gtag/js?id=G-PVPROBE';
    fetch('https://www.google-analytics.com/g/collect?v=2&tid=G-PVPROBE', { mode: 'no-cors' }).catch(() => {});
  });
  const done = await waitFor(() => PROBE.every((h) => st.blocked.some((b) => b.endsWith(' ' + h))) && st.inflight.size === 0);
  ok(done, '試しに外へ投げた2本（解析の住所）を、門が止めて書き留めた', JSON.stringify({ blocked: st.blocked, through: st.through, inflight: st.inflight.size }));
  ok(st.through.length === 0, '止めた2本は、どちらも外へ出ていない（すり抜け 0）', JSON.stringify(st.through));
});

scene('unknown', '自分の担当の呼び出しに返事が無ければ、場面ごと赤くなる', 'mock', async () => {
  const a = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_work_view: null } });
  await settled(a.page, 'cmp-work', 'jal|ana');
  ok(a.st.unknown.includes('pv_work_view'), '返事を用意していない pv_work_view が呼ばれると、門が st.unknown に書き留める', JSON.stringify(a.st.unknown));
  ok(sceneFaults('mock', [a.st]).unknown.includes('pv_work_view'), 'そのままなら、場面の終わりの確かめ（sceneFaults）が赤にする');
  a.st.expected = true;                              // わざと用意しなかった1枚（ここで確かめた。終わりの確かめからは外す）
  const b = await open('pc', { url: PAIR_URL('jal', 'ana') });
  ok(await settledAll(b.page, 'jal|ana'), '既定の返事（BASE_STUB）で開き直すと、3つの欄が読み終わる');
  ok(b.st.unknown.length === 0, '既定の返事で開いた画面では、st.unknown は空', JSON.stringify(b.st.unknown));
  const missing = H.MINE.filter((n) => typeof BASE_STUB[n] !== 'function');
  ok(missing.length === 0, `BASE_STUB は、この区域の呼び出し${H.MINE.length}つ全部に既定の返事を持つ`, missing.join(','));
});

scene('leak', '口コミの行のほかの列を、画面にも保存領域にも出さない（サーバーの抜粋は抜粋の場所にだけ）', 'mock', async () => {
  const { page } = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FIX.JAL, ana: FIX.ANA }) } });
  ok(await settled(page, 'cmp-stars', 'jal|ana'), '口コミの欄が読み終わった');
  const s = await slot(page, 'cmp-stars');
  ok(!!s && s.state === 'open', '2社の口コミの行を受け取って、欄を描いた（確かめが空振りしていない）', s && s.state);
  const got = await page.evaluate((mark) => {
    const v = document.querySelector('#cr [data-view="compare"]');
    const store = [];
    for (const S of [localStorage, sessionStorage]) for (let i = 0; i < S.length; i++) { const k = S.key(i); store.push(`${k}=${S.getItem(k)}`); }
    const clipsAt = v ? [...v.querySelectorAll('.crl[data-live="cmp-stars"] .crl-rate-rv .crl-rev-clip')].filter((x) => x.textContent === mark).length : 0;
    return { html: v ? v.outerHTML : '', store: store.join('\n'), clipsAt };
  }, CLIP_MARK);
  const NEVER = PLANTED.filter((x) => x !== CLIP_MARK);
  const inHtml = NEVER.filter((x) => got.html.includes(x)), inStore = PLANTED.filter((x) => got.store.includes(x));
  ok(got.html.length > 0 && inHtml.length === 0, '昔の口コミに書かれた給与・職位が、比較の画面に1文字も出ない（行から読むのは 6つの点数・行の数・サーバーの抜粋だけ）', inHtml.join(','));
  /* 抜粋（2026-10-22 オーナー P12.97：誰にでも）は、抜粋の行の .crl-rev-clip の字としてだけ出る ── 属性・ほかのマスに写さない。
     JAL は新しい2件・ANA は1件 ＝ 3か所（FIX の行は、どれも鍵の無い人への返事：本文の列が無く、抜粋だけ） */
  const anywhere = got.html.split(CLIP_MARK).length - 1;
  ok(got.clipsAt === 3 && anywhere === got.clipsAt, 'サーバーの抜粋は、抜粋の行の抜粋の場所にだけ出る（JAL 2件・ANA 1件 ＝ 3か所。ほかの場所・属性には無い）',
    JSON.stringify({ clipsAt: got.clipsAt, anywhere }));
  ok(inStore.length === 0, '抜粋も含めて同じものが、ブラウザの保存領域（localStorage・sessionStorage）に入らない', inStore.join(','));
  await shots(page, 'pc');
});

scene('zero', '2社とも投稿が無いとき、数字も2つの文も出さない', 'mock', async () => {
  const { page } = await open('pc', { url: PAIR_URL('jal', 'etihad') });
  ok(await settled(page, 'cmp-stars', 'jal|etihad'), '口コミの欄が読み終わった');
  const s = await slot(page, 'cmp-stars');
  ok(!!s && s.state === 'empty', '欄は「まだ無い」の顔（data-state empty）', s && s.state);
  const kids = await page.evaluate(() => {
    const b = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
    return b ? [...b.children].map((c) => `${c.tagName.toLowerCase()}.${c.className}`) : [];
  });
  ok(kids.length === 1 && kids[0] === 'p.crl-msg', '欄に在るのは1つの文だけ（2社それぞれの文を並べない）', JSON.stringify(kids));
  ok(!!s && s.text.trim().length > 0 && !/\d/.test(s.text), '数字を1つも出さない（0件を 0 と書かない）', s && s.text);
  /* 会社ページと同じ言葉（海外の評判の引用もある「口コミ」とは言わない ── 会員の投稿が無い、が本当のこと） */
  ok(!!s && s.text.trim() === '会員からの投稿はまだありません', 'その1文は「会員からの投稿はまだありません」', s && s.text);
  await shots(page, 'pc');
});

/* 比較の口コミの1社ぶんのマス（ページの中で読む）。列の順は 2社の並び順 */
const cells = (page) => page.evaluate(() => {
  const box = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
  const g = box && box.querySelector('.crl-cmp');
  const cs = g ? [...g.querySelectorAll('.crl-cmp-row .crl-cmp-c')] : [];
  const tx = (n) => (n ? n.textContent.trim() : null);
  return {
    rated: g ? g.getAttribute('data-rated') : null,
    view: (document.querySelector('#cr [data-view="compare"]') || {}).innerText || '',
    retry: box ? [...box.querySelectorAll('.crl-retry')].map((b) => Math.round(b.getBoundingClientRect().height)) : [],
    cells: cs.map((c) => {
      const score = c.querySelector('.crl-score'), posts = c.querySelector('.crl-posts'), st = c.querySelector('.crl-stars');
      const first = c.firstElementChild && c.firstElementChild.firstElementChild;
      const sr = c.querySelector('.crl-sr');
      return {
        text: c.textContent.replace(sr ? sr.textContent : '', '').trim(),
        first: first ? `${first.tagName.toLowerCase()}.${first.className}|${first.textContent}` : null,
        kids: c.firstElementChild ? [...c.firstElementChild.children].map((k) => `${k.tagName.toLowerCase()}.${k.className}`) : [],
        avg: tx(c.querySelector('.crl-avg')), cnt: tx(c.querySelector('.crl-cnt')), posts: tx(posts), none: tx(c.querySelector('.crl-none')),
        fill: st ? st.style.getPropertyValue('--crl-fill') : null, stars: c.querySelectorAll('.crl-stars').length,
        html: c.innerHTML,
        scoreText: tx(score), postsInScore: !!(score && posts && score.contains(posts)),
        below: !!(score && posts) && posts.getBoundingClientRect().top >= score.getBoundingClientRect().bottom - 0.5,
      };
    }),
  };
});
const NAME = { jal: '日本航空（JAL）', ana: '全日本空輸（ANA）', 'eva-air': 'エバー航空', etihad: 'エティハド航空' };
const OLD_COUNT = /(?<!会員の)口コミ \d/;                 // 昔の「口コミ n件」（要約の「会員の口コミ N件から」は別の数・別の言葉）

scene('rate', '比較の評価は会社ページと同じ数え方（星・点数・「n件の評価」、次の行に「会員の投稿 n件」）', 'mock', async () => {
  const { page } = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FIX.JAL, ana: FIX.ANA }) } });
  ok(await settled(page, 'cmp-stars', 'jal|ana'), '口コミの欄が読み終わった');
  const C = await cells(page), [A, B] = C.cells.length === 2 ? C.cells : [{}, {}];
  ok(A.avg === '3.5' && A.fill === '70%' && A.cnt === '2件の評価' && A.posts === '会員の投稿 3件',
    'JAL：点数 3.5・星 70%・「2件の評価」・次の行に「会員の投稿 3件」（点の無い投稿は評価に数えず、投稿には数える）', JSON.stringify(A));
  ok(B.avg === '4.2' && B.fill === '84%' && B.cnt === '1件の評価' && B.posts === '会員の投稿 1件',
    'ANA：点数 4.2・星 84%・「1件の評価」・次の行に「会員の投稿 1件」', JSON.stringify(B));
  ok([A, B].every((c) => c.below && !c.postsInScore && !/会員の投稿/.test(c.scoreText || '')),
    '「会員の投稿 n件」は、星と点数の行の下の別の行（同じ行に並べない）', JSON.stringify([A, B].map((c) => [c.below, c.postsInScore, c.scoreText])));
  ok(!OLD_COUNT.test(C.view), '比較の画面のどこにも、昔の「口コミ n件」が無い', (C.view.match(/.{0,12}口コミ \d.{0,6}/) || [''])[0]);
  ok(A.first === `span.crl-sr|${NAME.jal}` && B.first === `span.crl-sr|${NAME.ana}`, '各社のマスは、読み上げ用の社名から始まる', JSON.stringify([A.first, B.first]));
  ok(C.rated === '11', '評価の格子の印 data-rated は "11"（2社とも点数の付いた投稿が在る）', C.rated);
  await shots(page, 'pc');
  /* 点の低い投稿も、ほかの投稿と同じに数える（間引かない・重みを付けない） */
  const t = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FIX.TWO, ana: FIX.ANA }) } });
  ok(await settled(t.page, 'cmp-stars', 'jal|ana'), '（点の高い投稿と低い投稿の2件）口コミの欄が読み終わった');
  const T2 = (await cells(t.page)).cells[0] || {};
  ok(T2.avg === '3.0' && T2.cnt === '2件の評価' && T2.posts === '会員の投稿 2件', '5点と1点の2件 → 点数 3.0・「2件の評価」・「会員の投稿 2件」（どの投稿も数える）', JSON.stringify(T2));
});

scene('unrated', '点数の無い会社・投稿の無い会社に、0 も空の星も置かない', 'mock', async () => {
  const { page } = await open('pc', { url: PAIR_URL('eva-air', 'etihad'), stub: { pv_reviews: reviewsBy({ 'eva-air': FIX.EVA, etihad: FIX.ETD }) } });
  ok(await settled(page, 'cmp-stars', 'eva-air|etihad'), '口コミの欄が読み終わった');
  const C = await cells(page), [E, D] = C.cells.length === 2 ? C.cells : [{}, {}];
  ok(E.cnt === '評価未取得' && E.posts === '会員の投稿 2件', 'エバー：「評価未取得」・次の行に「会員の投稿 2件」', JSON.stringify(E));
  ok(E.stars === 0 && !/--crl-fill/.test(E.html || '') && !/0/.test(E.text || '0'),
    'エバー：星の形を置かない（隣の会社の星と並ぶと0点に見える）・0 の字も無い', JSON.stringify({ stars: E.stars, text: E.text }));
  ok(JSON.stringify(D.kids) === JSON.stringify(['span.crl-sr', 'span.crl-none']) && D.none === '会員からの投稿はまだありません',
    'エティハド：「会員からの投稿はまだありません」だけ（ほかに何も置かない）', JSON.stringify(D));
  ok(C.rated === '00', '評価の格子の印 data-rated は "00"（2社とも点数の付いた投稿が無い）', C.rated);
  await shots(page, 'pc');
});

/* 6角形の行（評価の格子の続きの行 .crl-rate-fig）の2つのマス。列の順は 2社の並び順。頂点は まんなか(100,100) からの距離 ÷ 半径 92 */
const figs = (page) => page.evaluate(() => {
  const box = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
  const rows = box ? [...box.querySelectorAll('.crl-rate-fig')] : [];
  const isl = document.getElementById('crl-cats');
  let island = null;
  try { island = isl ? JSON.parse(isl.textContent) : null; } catch { island = null; }
  return {
    rows: rows.length, island,
    text: rows.map((r) => r.textContent).join(' '),
    cells: rows[0] ? [...rows[0].children].map((c) => {
      const f = c.querySelector('.crl-radar'), shape = c.querySelector('.crl-radar-shape');
      const pts = shape ? shape.getAttribute('points').split(' ').map((q) => q.split(',').map(Number)) : [];
      return {
        figs: c.querySelectorAll('.crl-radar').length, svg: c.querySelectorAll('svg').length, text: c.textContent.trim(),
        kind: f ? f.getAttribute('data-radar') : null, ph: !!shape && shape.classList.contains('is-ph'),
        label: f ? f.getAttribute('aria-label') : null, hidden: f ? f.getAttribute('aria-hidden') : null,
        names: f ? [...f.querySelectorAll('.crl-radar-l')].map((l) => (l.querySelector('span') || {}).textContent || '') : [],
        vals: f ? [...f.querySelectorAll('.crl-radar-l')].map((l) => { const b = l.querySelector('b'); return b ? b.textContent : null; }) : [],
        dots: c.querySelectorAll('.crl-radar-dot').length,
        radii: pts.map(([x, y]) => Math.hypot(x - 100, y - 100) / 92),
      };
    }) : [],
  };
});
const nearAll = (radii, want) => radii.length === 6 && radii.every((r, i) => Math.abs(r * 92 - want[i] / 5 * 92) <= 0.2);
const isPh = (c, island) => c.figs === 1 && c.kind === 'ph' && c.ph && c.dots === 0 && c.vals.every((v) => v === null) && !/\d/.test(c.text)
  && JSON.stringify(c.names) === JSON.stringify(island) && nearAll(c.radii, [3, 3, 3, 3, 3, 3]) && c.hidden === 'true';

scene('radar', '6角形：点数は誰にでも・6分類ぜんぶに点数がある会社はその点数で塗る・塗れない会社は 3.0 の淡い面で数字なし・読めなかった会社は空', 'mock', async () => {
  const VALS = ['4.0', '3.5', '3.0', '3.5', '4.0', '3.0'];             // FIX.JAL：分類ごとに、その分類に点数を付けた投稿だけの平均
  const a = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FIX.JAL, ana: FIX.ANA }) } });
  ok(await settled(a.page, 'cmp-stars', 'jal|ana'), '（JAL｜ANA）口コミの欄が読み終わった');
  const A = await figs(a.page), [J, N] = A.cells.length === 2 ? A.cells : [{}, {}];
  ok(A.rows === 1 && J.figs === 1 && J.kind === 'real' && !J.ph && J.dots === 6, 'JAL（6分類ぜんぶに点数）：図が1つ・点数で塗った面と点の丸6つ', JSON.stringify({ rows: A.rows, J }));
  ok(Array.isArray(A.island) && A.island.length === 6 && JSON.stringify(J.names) === JSON.stringify(A.island),
    'JAL の図の6つの名前は、島（#crl-cats）の名前を同じ順で', JSON.stringify([J.names, A.island]));
  ok(JSON.stringify(J.vals) === JSON.stringify(VALS) && nearAll(J.radii, VALS.map(Number)),
    `JAL：分類ごとの点数は ${VALS.join(' ')}、面の頂点はどれも 点数/5 × 半径92（±0.2）`, JSON.stringify({ vals: J.vals, radii: J.radii }));
  ok(J.label === NAME.jal, 'JAL の図の読み上げの名前は会社の名前', J.label);
  ok(isPh(N, A.island), 'ANA（点数の無い分類が1つ）：会社ページと同じ 3.0 の淡い面（is-ph）・6つの名前・字に数字も点の丸も無い・読み上げない', JSON.stringify(N));
  const b = await open('pc', { url: PAIR_URL('eva-air', 'etihad'), stub: { pv_reviews: reviewsBy({ 'eva-air': FIX.EVA, etihad: FIX.ETD }) } });
  ok(await settled(b.page, 'cmp-stars', 'eva-air|etihad'), '（エバー｜エティハド）口コミの欄が読み終わった');
  const B = await figs(b.page);
  ok(B.rows === 1 && B.cells.length === 2 && B.cells.every((c) => isPh(c, B.island)) && !/\d/.test(B.text),
    'エバー（点数の無い投稿だけ）・エティハド（投稿なし）：どちらも 3.0 の淡い面で、図の行に数字が1つも無い', JSON.stringify(B));
  const c = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FAIL500, ana: FIX.TWO }) } });
  ok(await settled(c.page, 'cmp-stars', 'jal|ana'), '（JAL が読めない｜5点と1点の2件）口コミの欄が読み終わった');
  const C = await figs(c.page), [F, W] = C.cells.length === 2 ? C.cells : [{}, {}];
  ok(F.figs === 0 && F.svg === 0 && F.text === '', 'JAL（読めなかった）：図のマスは空（輪も軸も字も無い ── 分からないものを図にしない）', JSON.stringify(F));
  ok(W.kind === 'real' && JSON.stringify(W.vals) === JSON.stringify(['3.0', '3.0', '3.0', '3.0', '3.0', '3.0']) && !W.ph,
    'ANA（5点と1点の2件）：点数で塗った面・どの分類も 3.0（低い点も数える）', JSON.stringify(W));
});

/* 抜粋の行（.crl-rate-rv）と、その下の入口。列の順は 2社の並び順 */
const clips = (page) => page.evaluate(() => {
  const box = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
  const rows = box ? [...box.querySelectorAll('.crl-rate-rv')] : [];
  const tx = (n) => (n ? n.textContent : null);
  return {
    rows: rows.length,
    cells: rows[0] ? [...rows[0].children].map((c) => ({
      text: c.textContent.trim(),
      items: [...c.querySelectorAll('.crl-rev')].map((li) => ({ when: tx(li.querySelector('.crl-rev-when')),
        clip: [...li.querySelectorAll('.crl-rev-clip')].map((x) => x.textContent), full: [...li.querySelectorAll('.crl-rev-text:not(.crl-rev-clip)')].map((x) => x.textContent),
        chips: [...li.querySelectorAll('.crl-chip')].map((x) => x.textContent) })),
    })) : [],
    lock: box ? [...box.children].filter((x) => x.matches('.crl-lock')).map((x) => x.textContent.trim()) : [],
    gg: box ? [...box.querySelectorAll('a.pv-gg')].map((a) => ({ href: a.getAttribute('href'), k: tx(a.querySelector('.crl-cta-k')), m: tx(a.querySelector('.crl-cta-m')) })) : [],
    links: box ? [...box.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')) : [],
    view: (document.querySelector('#cr [data-view="compare"]') || {}).innerText || '',
  };
});
/* 鍵の無い人への返事（本文の列は無い。サーバーは最初に書かれた1欄の先頭40字を clip で付ける）と、鍵のある人への返事（本文の列が在る） */
const lockedRow = (id, at, k, o, cats) => row(id, NUL, { created_at: at, cats: cats || [k], clip: { k, o, t: {} } });
const CLIPS = {
  jal: [row('j0', NUL, { created_at: '2026-10-15T00:00:00Z', cats: [], clip: undefined }),      // 点数だけ（字が無い）── 飛ばす
    lockedRow('j1', '2026-10-01T00:00:00Z', 'training', 'CLIP-J1 訓練は丁寧で、教官の質も高い。シミュレーターの…', ['training', 'salary']),
    lockedRow('j2', '2026-09-12T00:00:00Z', 'wlb', 'CLIP-J2 乗務のパターンが読みやすい。'),
    lockedRow('j3', '2026-08-01T00:00:00Z', 'ops', 'CLIP-J3 3件目（出さない）')],
};
const BODY = {
  jal: [row('k1', NUL, { created_at: '2026-10-01T00:00:00Z', cats: undefined, training_comment: 'BODY-K1 訓練は丁寧で、教官の質も高い。', clip: undefined })],
};
scene('clip', '新しい投稿の抜粋は誰にでも・続きは口コミの Give & Get（鍵の無い人にだけ1つ・給与の入口と混ぜない）', 'mock', async () => {
  const { page } = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: CLIPS.jal, ana: [] }) } });
  ok(await settled(page, 'cmp-stars', 'jal|ana'), '（鍵の無い人）口コミの欄が読み終わった');
  const L = await clips(page), [J, N] = L.cells.length === 2 ? L.cells : [{}, {}];
  ok(L.rows === 1 && (J.items || []).length === 2 && JSON.stringify(J.items.map((x) => x.clip)) === JSON.stringify([[CLIPS.jal[1].clip.o], [CLIPS.jal[2].clip.o]])
    && J.items.every((x) => x.full.length === 0),
    'JAL：字のある新しい投稿2件の、サーバーの抜粋だけ（新しい順・1件に1つ・本文の字は無い）', JSON.stringify(J));
  ok(JSON.stringify(J.items.map((x) => x.when)) === JSON.stringify(['2026年10月', '2026年9月']) && !L.view.includes('CLIP-J3'),
    '抜粋は新しい順の2件まで（投稿の年月を添える・3件目は出さない・点数だけの投稿は飛ばす）', JSON.stringify({ when: J.items.map((x) => x.when) }));
  ok(N.text === '', 'ANA（投稿なし）：抜粋のマスは空（「投稿はまだありません」は上の評価のマスが1回だけ言う）', JSON.stringify(N));
  ok(JSON.stringify(L.lock) === JSON.stringify(['口コミの投稿で開きます']) && L.gg.length === 1,
    '欄の下に「口コミの投稿で開きます」と、口コミの Give & Get が1つだけ', JSON.stringify({ lock: L.lock, gg: L.gg }));
  ok(L.gg.length === 1 && L.gg[0].href === 'submit-review.html' && L.gg[0].k === 'Give & Get' && L.gg[0].m === '口コミを解放する'
    && !L.links.some((h) => /pay-report|actual-pay/.test(h)),
    '入口は口コミの投稿（submit-review.html）の「Give & Get／口コミを解放する」── 給与の入口・給与の鍵の言葉ではない', JSON.stringify({ gg: L.gg, links: L.links }));
  await shots(page, 'pc');
  /* 鍵のある人：本文（会社ページの口コミの箱と同じ1件）。入口も錠前の1行も出さない */
  const k = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: (p) => {
    const a = p && Array.isArray(p.airlines) ? p.airlines[0] : '';
    return { status: 200, body: { ok: true, unlocked: true, rows: a === 'jal' ? BODY.jal : [] } };
  } } });
  ok(await settled(k.page, 'cmp-stars', 'jal|ana'), '（口コミの鍵のある人）口コミの欄が読み終わった');
  const K = await clips(k.page), KJ = K.cells[0] || {};
  ok((KJ.items || []).length === 1 && JSON.stringify(KJ.items[0].full) === JSON.stringify([BODY.jal[0].training_comment]) && KJ.items[0].clip.length === 0,
    '鍵のある人には、本文（会社ページの口コミの箱と同じ形）', JSON.stringify(KJ));
  ok(K.lock.length === 0 && K.gg.length === 0, '鍵のある人には、錠前の1行も Give & Get も出さない（開いている人に開け方を見せない）', JSON.stringify({ lock: K.lock, gg: K.gg }));
});

/* 片方の会社だけ読めなかった：その会社のマスに1回だけ「いま読み出せません」、もう片方はそのまま、欄の下に「やり直す」を1つ */
const FAIL500 = { status: 500, body: { code: 'XX000', details: null, hint: null, message: '検査のわざとの失敗' } };
const NOFN = { status: 404, body: { code: 'PGRST202', details: null, hint: null, message: 'Could not find the function public.pv_reviews' } };
const pressRetry = async (page) => {
  const b = await page.$('#cr [data-view="compare"] .crl[data-live="cmp-stars"] .crl-retry');
  if (!b) return false;
  await b.focus();
  await page.keyboard.press('Enter');                // キーボードで押す（フォーカスの戻り先を見る）
  return true;
};
const focusInSlot = (page) => page.evaluate(() => {
  const box = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
  return !!box && !!document.activeElement && document.activeElement !== document.body && box.contains(document.activeElement);
});
scene('side', '片方の会社が読めなくても、もう片方は出す（やり直すのは読めなかった方だけ）', 'mock', async () => {
  const { page, st } = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FAIL500, ana: FIX.ANA }) } });
  ok(await settled(page, 'cmp-stars', 'jal|ana'), '口コミの欄が読み終わった');
  const s = await slot(page, 'cmp-stars');
  const C = await cells(page), [A, B] = C.cells.length === 2 ? C.cells : [{}, {}];
  ok(!!s && s.state === 'open' && s.part === '1', '欄は開いた顔のまま、片方だけ読めなかった印（data-part="1"）', JSON.stringify(s && [s.state, s.part]));
  ok((A.text || '').split('いま読み出せません').length === 2 && !/\d/.test(A.text || '') && !/会員からの投稿はまだありません/.test(A.text || ''),
    'JAL（読めなかった）：マスに「いま読み出せません」が1回だけ・数字も「投稿はまだありません」も無い', JSON.stringify(A));
  ok(B.avg === '4.2' && B.cnt === '1件の評価' && B.posts === '会員の投稿 1件', 'ANA（読めた）：いつもどおり描く', JSON.stringify(B));
  ok(C.retry.length === 1 && C.retry[0] >= 44, '「やり直す」は欄に1つだけ（高さ 44px 以上）', JSON.stringify(C.retry));
  ok(C.rated === 'x1', '評価の格子の印 data-rated は "x1"（JAL は読めなかった・ANA は点数あり）', C.rated);
  await shots(page, 'pc');
  /* 次は読める。キーボードで「やり直す」→ JAL だけ聞き直して埋まる */
  st.stub.pv_reviews = reviewsBy({ jal: FIX.JAL, ana: FIX.ANA });
  const n0 = st.calls.length;
  ok(await pressRetry(page), '「やり直す」をキーボードで押した');
  ok(await until(page, () => {
    const c = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"] .crl-cmp-c .crl-avg');
    return !!c && c.textContent === '3.5';
  }), 'JAL のマスが埋まった（点数 3.5）');
  const again = st.calls.slice(n0).filter((c) => c.name === 'pv_reviews').map((c) => (c.p && c.p.airlines ? c.p.airlines[0] : '?'));
  ok(JSON.stringify(again) === '["jal"]', '聞き直したのは読めなかった JAL だけ（ANA は手元の答えを使う）', JSON.stringify(again));
  const s2 = await slot(page, 'cmp-stars');
  ok(!!s2 && s2.state === 'open' && s2.part === null && (await cells(page)).retry.length === 0, '埋まったあとは、印も「やり直す」も消える', JSON.stringify(s2 && [s2.state, s2.part]));
  ok(await focusInSlot(page), '[B] 押した人のフォーカスは欄の中に戻る（ページの頭へ飛ばない）・PC');
  /* 口が無い返事（PGRST202）でも、口コミは「準備中」ではなく読めなかった顔（fetchRows が null を返す ＝ 取れなかった） */
  const n = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: NOFN, ana: FIX.ANA }) } });
  ok(await settled(n.page, 'cmp-stars', 'jal|ana'), '（関数が無いという返事）口コミの欄が読み終わった');
  const N = (await cells(n.page)).cells[0] || {};
  ok(/^いま読み出せません$/.test(N.text || ''), 'JAL の口コミの関数が無いという返事でも、マスは「いま読み出せません」', JSON.stringify(N));
  /* [B] 2社とも読めない → 欄ごと今までの失敗の顔（帯と「やり直す」1つ）。狭い画面と広い画面で1回ずつ */
  for (const size of ['pc', 'sp']) {
    const f = await open(size, { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FAIL500, ana: FAIL500 }) } });
    ok(await settled(f.page, 'cmp-stars', 'jal|ana'), `（2社とも失敗・${size}）口コミの欄が読み終わった`);
    const e = await slot(f.page, 'cmp-stars'), E = await cells(f.page);
    ok(!!e && e.state === 'error' && /^いま読み出せません/.test(e.text.trim()) && E.retry.length === 1,
      `[B] 2社とも読めなければ、欄ごと失敗の顔（「いま読み出せません」と「やり直す」1つ）・${size}`, JSON.stringify(e && [e.state, e.text, E.retry]));
    if (size === 'sp') {
      f.st.stub.pv_reviews = reviewsBy({ jal: FIX.JAL, ana: FIX.ANA });
      ok(await pressRetry(f.page), '（sp）「やり直す」をキーボードで押した');
      ok(await settled(f.page, 'cmp-stars', 'jal|ana') && await until(f.page, () => !!document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"] .crl-cmp')),
        '（sp）2社とも埋まった');
      ok(await focusInSlot(f.page), '[B] 押した人のフォーカスは欄の中に戻る・スマホ');
    }
  }
});

/* 1社の概要（career.html?airline=…）も、会社ページと同じ数え方：星の横は評価件数、その下の行が口コミ件数 */
const overview = (page) => page.evaluate(() => {
  const b = document.querySelector('#cr .crl[data-live="stars"][data-airline="etihad"]');
  if (!b) return null;
  const score = b.querySelector('.crl-score'), posts = b.querySelector('.crl-posts');
  return { state: b.getAttribute('data-state'), text: b.innerText, cnt: (b.querySelector('.crl-cnt') || {}).textContent || null,
    posts: posts ? posts.textContent : null, next: !!(score && posts && score.nextElementSibling === posts),
    outline: b.querySelectorAll('.crl-stars[data-none]').length, filled: b.querySelectorAll('.crl-stars:not([data-none])').length };
});
const overviewDone = (page) => until(page, () => {
  const b = document.querySelector('#cr .crl[data-live="stars"][data-airline="etihad"]');
  return !!b && b.getAttribute('data-for') === 'etihad' && !['idle', 'loading'].includes(b.getAttribute('data-state'));
});
scene('overview', '1社の概要の評価も同じ数え方（「n件の評価」の下に「会員の投稿 n件」）', 'mock', async () => {
  const { page } = await open('pc', { url: '/career.html?airline=etihad', stub: { pv_reviews: reviewsBy({ etihad: FIX.JAL }) } });
  ok(await overviewDone(page), '概要の評価の欄が読み終わった');
  const o = await overview(page);
  ok(!!o && o.cnt === '2件の評価' && o.posts === '会員の投稿 3件' && o.next && o.filled === 1,
    '星と点数の横に「2件の評価」、その下の行に「会員の投稿 3件」', JSON.stringify(o));
  ok(!!o && !OLD_COUNT.test(o.text), '昔の「口コミ 3件」が無い', o && o.text);
  const e = await open('pc', { url: '/career.html?airline=etihad', stub: { pv_reviews: reviewsBy({ etihad: FIX.EVA }) } });
  ok(await overviewDone(e.page), '（点数の無い投稿だけ）概要の評価の欄が読み終わった');
  const u = await overview(e.page);
  ok(!!u && u.outline === 1 && u.filled === 0 && u.cnt === '評価未取得' && u.posts === '会員の投稿 2件' && u.next,
    '点数の無い投稿だけなら、輪郭の星（1社だけで立っている）・「評価未取得」・その下に「会員の投稿 2件」', JSON.stringify(u));
});

/* ══ 給与の区域（cmp-pay）── 比較の「提出された年収」══════════════════════
   返事の材料は cmp-stubs.mjs の payFix（I-9）。額はどれも検査が選んだ印（271828・314159 …）で、本物の額ではない。
   字は決めごと（比較の給与の設計・P9.7・A17）なので、ページのコードから借りずにここへ書く。 */
const PAY = ['pv_pay_rows', 'pv_company_pay'];
const PRF = H.payRowFix;
const payReply = (body) => () => ({ status: 200, body });
const PAY_SEL = '#cr [data-view="compare"] .crl[data-live="cmp-pay"]';
const W_PAY = {
  lock: '給与の提出で開きます', expired: '年収データの解放が切れています', empty: 'まだ記録がありません', gg: 'Give & Get',
  ggMain: '全ての給与情報を解放する', all: 'REAL PAY で全部見る', median: '中央値', none: '未取得',
  more: (n) => `続きを見る（全${n}件）`,
  c2: 'REAL PAY と同じ一覧（直近24か月の提出）。月の支給額を年に直した額と、口コミに書かれた年収の両方が入っています。',
  c3: (from, to, floor) => `中央値は、給与を提出した人ごとのまんなかの額から出しています（給与の月が${from}〜${to}のもの・${floor}人以上の区分だけ）。`
    + '口コミに書かれた年収と、登録前に預かった提出は入りません。',
  ten: ['昇格後5年未満', '昇格後5〜10年', '昇格後10〜15年', '昇格後15〜20年', '昇格後20年以上'],
};
/* ページのどのスクリプトよりも先に置く書き留め役：ページが投げた関数の呼び出しの名前（fetch を呼んだその時に）と、
   中央値の返事の中身を読み終えた回数（読み終えたあとの次の順番で数える ＝ その答えをページが使い終わったあと） */
const PAY_WATCH = () => {
  const asked = window.__payAsked = [];
  let read = 0;
  window.__payRead = () => read;
  const F = window.fetch;
  window.fetch = function (input) {
    try {
      const m = String((input && input.url) || input).match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/);
      if (m) asked.push(m[1]);
    } catch (e) { /* 数えられない形の呼び出しは、門の記録（st.calls）が数える */ }
    return F.apply(this, arguments);
  };
  for (const k of ['text', 'json']) {
    const f = Response.prototype[k];
    Response.prototype[k] = function () {
      const p = f.apply(this, arguments);
      if (/\/rest\/v1\/rpc\/pv_company_pay(?:[?#]|$)/.test(this.url)) p.then(() => setTimeout(() => { read++; }, 0), () => {});
      return p;
    };
  }
};
/* 欄が読み終わり、そのあとの順番が1つ回るまで待つ（その間に始まった呼び出しは、もう __payAsked に入っている） */
const payDone = async (page, want) => {
  const done = await settled(page, 'cmp-pay', want);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
  return done;
};
const askedOf = async (page, st, names) => {
  const inPage = await page.evaluate(() => (window.__payAsked || []).slice());
  return [...inPage, ...st.calls.map((c) => c.name)].filter((n) => names.includes(n));
};
/* 給与の欄の顔（ページの中で読む） */
const payFace = (page) => page.evaluate((SEL) => {
  const b = document.querySelector(SEL);
  if (!b) return null;
  const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : null);
  const own = (c, sel) => [...c.children].filter((k) => k.matches(sel));
  /* 閉じた畳みの中身は、箱を持ったまま見えない（Chrome は content-visibility で隠す）── checkVisibility で見る */
  const seen = (n) => (n.checkVisibility ? n.checkVisibility() : n.getClientRects().length > 0);
  return {
    state: b.getAttribute('data-state'), text: b.innerText || '', html: b.outerHTML,
    rows: b.querySelectorAll('li.crl-row').length, amt: b.querySelectorAll('.crl-amt').length, plate: b.querySelectorAll('.crl-plate').length,
    lock: [...b.querySelectorAll('p.crl-lock')].map(tx),
    entry: [...b.querySelectorAll('a[href^="pay-report.html"]')].map((a) => ({ cls: a.className, k: tx(a.querySelector('.crl-cta-k')),
      m: tx(a.querySelector('.crl-cta-m')), h: Math.round(a.getBoundingClientRect().height) })),
    login: [...b.querySelectorAll('a[data-crl-login]')].map((a) => a.getAttribute('href')),
    heads: [...b.querySelectorAll('h3.crl-pr-h')].map((h) => `${h.getAttribute('data-pos')}:${tx(h)}`),
    defs: [...b.querySelectorAll('p.crl-def')].map((p) => ({ k: p.getAttribute('data-def'), t: tx(p) })),
    cells: [...b.querySelectorAll('.crl-pc[data-airline]')].map((c) => ({
      co: c.getAttribute('data-airline'), pos: c.getAttribute('data-pos'),
      count: tx(own(c, 'p.crl-count')[0]), msg: tx(own(c, 'p.crl-msg')[0]),
      shown: c.querySelectorAll(':scope > ul.crl-rows > li.crl-row').length,
      seen: [...c.querySelectorAll('li.crl-row')].filter(seen).length,
      fold: own(c, 'details.crl-more').map((x) => ({ open: x.open, s: tx(x.querySelector(':scope > summary')),
        n: x.querySelectorAll(':scope > ul.crl-rows > li.crl-row').length })),
      links: [...c.querySelectorAll('a.crl-link')].map((a) => ({ href: a.getAttribute('href'), label: a.getAttribute('aria-label'), t: tx(a) })),
      lis: [...c.querySelectorAll('li.crl-row')].map((li) => ({ fleet: tx(li.querySelector('.crl-sub')), chip: tx(li.querySelector('.crl-chip')),
        amt: tx(li.querySelector('.crl-amt')), vf: tx(li.querySelector('.crl-vf')), age: tx(li.querySelector('.crl-age')),
        pos: li.querySelectorAll('.crl-pos').length, text: tx(li),
        aH: (() => { const a = li.querySelector('.crl-row-a'); return a ? Math.round(a.getBoundingClientRect().height) : -1; })() })),
    })),
  };
}, PAY_SEL);
/* 場面の終わり：給与の2つの呼び出しには、全部この場面が返事を作った（ほかの担当の呼び出しとして「準備中」で返したものが無い） */
const payAnswered = (sts) => {
  const miss = [...new Set(sts.flatMap((s) => s.foreign).filter((n) => PAY.includes(n)))];
  ok(miss.length === 0, '給与の呼び出し（pv_pay_rows・pv_company_pay）には、全部この場面が返事を作った', miss.join(','));
};
const loginTo = (href) => { try { return new URL(href, 'http://x/').searchParams.get('redirect'); } catch { return null; } };

scene('pay-lock', '給与：鍵の無い人には会社ごとの件数だけ（行・額・板を描かない・植えた列を出さない・中央値も DEEP PAY も聞かない）・錠の1行と入口は1つ・「ログイン」はゲストにだけ', 'mock', async () => {
  const A = [PRF('jal'), PRF('jal', { pos: 'fo' }), PRF('jal')], B = [PRF('ana')];
  /* M1 ゲスト。返事の行に、開いていない人へは来ないはずの列を植えておく（職位・機材・年数の段・年収・外れの印） */
  const plant = (r) => ({ ...r, pos: 'cadet', fleet: 'a380', ten: 4, tenk: 's', annual_usd: 271828, far: true });
  const guest = H.payFix.guest(A, B);
  guest.rows = guest.rows.map(plant);
  const g = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, stub: { pv_pay_rows: payReply(guest) } });
  ok(await payDone(g.page, 'jal|ana'), '（ゲスト）給与の欄が読み終わった');
  const F = await payFace(g.page);
  const seenAll = await g.page.evaluate(() => {
    const store = [];
    for (const S of [localStorage, sessionStorage]) for (let i = 0; i < S.length; i++) { const k = S.key(i); store.push(`${k}=${S.getItem(k)}`); }
    return { doc: document.documentElement.outerHTML, store: store.join('\n') };
  });
  /* M1 a 植えた値は、画面の字にも属性にも保存領域にも無い */
  const SHOWN = ['Airbus A380', 'a380', '在籍20年以上', '⚠', '同じ会社・同じ職位の公開年収から大きく外れた金額です。', '訓練生'];
  const inSlot = F ? SHOWN.filter((x) => F.html.includes(x)) : ['（欄が無い）'];
  const amount = F ? (F.text.match(/[¥$€]\s?[\d,.]+|[\d,.]+\s?万/) || [''])[0] : '';
  ok(!!F && F.state === 'locked' && !inSlot.length && !amount && !seenAll.doc.includes('271828'),
    '[M1 a] 植えた職位・機材・年数の段・外れの印・年収が、欄の字にも属性にも出ない（ページのどこにも 271828 が無い・欄に額の字が無い）',
    JSON.stringify({ state: F && F.state, inSlot, amount, raw: seenAll.doc.includes('271828') }));
  ok(!/271828|a380/.test(seenAll.store), '[M1 a] 植えた値は、ブラウザの保存領域（localStorage・sessionStorage）にも無い', seenAll.store.slice(0, 300));
  const asked = await askedOf(g.page, g.st, ['pv_company_pay', 'pv_deep_pay']);
  ok(asked.length === 0, '[M1 a] 鍵の無い人の画面からは、中央値（pv_company_pay）も DEEP PAY（pv_deep_pay）も聞かない', asked.join(','));
  /* M1 b 形：行・額・板が無い・会社ごとの件数・錠の1行と入口が1つずつ・ゲストの「ログイン」は今の2社へ戻る */
  const C = F ? F.cells : [];
  ok(!!F && F.rows === 0 && F.amt === 0 && F.plate === 0, '[M1 b] 欄に行（li.crl-row）も額の箱（.crl-amt）も板（.crl-plate）も無い',
    JSON.stringify(F && { rows: F.rows, amt: F.amt, plate: F.plate }));
  ok(C.length === 2 && C[0].co === 'jal' && C[0].count === '3件の提出' && C[1].co === 'ana' && C[1].count === '1件の提出',
    '[M1 b] 会社ごとに、返ってきた行の本数だけ（JAL「3件の提出」・ANA「1件の提出」）', JSON.stringify(C.map((c) => [c.co, c.count, c.msg])));
  ok(!!F && JSON.stringify(F.lock) === JSON.stringify([W_PAY.lock]), `[M1 b] 錠の1行は欄に1つ「${W_PAY.lock}」`, JSON.stringify(F && F.lock));
  const E = F ? F.entry : [];
  ok(E.length === 1 && /\bpv-gg\b/.test(E[0].cls) && E[0].k === W_PAY.gg && E[0].m === W_PAY.ggMain && E[0].h >= 44,
    `[M1 b] 給与の入口は1つ（pay-report.html・サイト共通の Give & Get「${W_PAY.gg}／${W_PAY.ggMain}」・高さ 44px 以上）`, JSON.stringify(E));
  ok(!!F && F.login.length === 1 && loginTo(F.login[0]) === 'career.html?view=compare&a=jal&b=ana',
    '[M1 b] ゲストにだけ「ログイン」が1つ・ログインのあとは今の2社の比較へ戻る', JSON.stringify(F && F.login));
  await shots(g.page, 'pc');
  /* M2 会員（給与を出していない）／M3 期限切れ：「ログイン」は無い・錠の1行はそれぞれの字 */
  for (const [who, body, line] of [['会員', H.payFix.member(A, B), W_PAY.lock], ['期限切れ', H.payFix.expired(A, B), W_PAY.expired]]) {
    const m = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, stub: { pv_pay_rows: payReply(body) } });
    ok(await payDone(m.page, 'jal|ana'), `（${who}）給与の欄が読み終わった`);
    const M = await payFace(m.page);
    ok(!!M && M.state === 'locked' && M.login.length === 0 && JSON.stringify(M.lock) === JSON.stringify([line]) && M.entry.length === 1 && M.rows === 0,
      `[${who === '会員' ? 'M2' : 'M3'}] ${who}：「ログイン」は無い・錠の1行は「${line}」・入口は1つ・行は無い`,
      JSON.stringify(M && { state: M.state, login: M.login, lock: M.lock, entry: M.entry.length, rows: M.rows }));
  }
  /* M1e（B）開いていない・2社とも行が無い（ほかの会社の行だけ在る）：2つの「まだ記録がありません」・入口は残る・錠の1行は無い（開くものが無い） */
  const z = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, stub: { pv_pay_rows: payReply(H.payFix.guest([], [PRF('eva-air')])) } });
  ok(await payDone(z.page, 'jal|ana'), '（ゲスト・2社とも行なし）給与の欄が読み終わった');
  const Z = await payFace(z.page);
  ok(!!Z && Z.state === 'empty' && Z.cells.length === 2 && Z.cells.every((c) => c.msg === W_PAY.empty && c.count === null)
    && Z.lock.length === 0 && Z.entry.length === 1 && Z.login.length === 1 && !/\d/.test(Z.text),
    `[M1e] 2社とも行が無い：2社それぞれ「${W_PAY.empty}」・錠の1行は無い・入口と「ログイン」は残る・数字を出さない`,
    JSON.stringify(Z && { state: Z.state, cells: Z.cells.map((c) => [c.co, c.msg, c.count]), lock: Z.lock, entry: Z.entry.length, login: Z.login.length }));
  payAnswered([g.st, z.st, ...CUR.pages.map((o) => o.st)]);
});

scene('pay-open', '給与：鍵の開いた人には職位ごとの2社の列・5行まで見せて残りは畳む・REAL PAY の行（職位は繰り返さない）・住所は air= と pos= だけ・選ぶ欄も入力欄も置かない', 'mock', async () => {
  /* M4 JAL：機長7・副操縦士0／ANA：機長2・副操縦士1 */
  const A = [0, 1, 2, 3, 4, 5, 6].map((i) => PRF('jal', { ten: i % 5, verified: i % 2 === 0, age: i % 5, annual_usd: 271828 + i * 31416 }));
  const B = [PRF('ana', { annual_usd: 314159 }), PRF('ana', { annual_usd: 141421, verified: true }), PRF('ana', { pos: 'fo', annual_usd: 161803 })];
  const { page, st } = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, stub: { pv_pay_rows: payReply(H.payFix.open(A, B)) } });
  ok(await payDone(page, 'jal|ana'), '（鍵の開いた人）給与の欄が読み終わった');
  const F = await payFace(page);
  const cell = (co, pos) => (F ? F.cells.find((c) => c.co === co && c.pos === pos) : null) || {};
  const [JC, JF, AC, AF] = [cell('jal', 'cap'), cell('jal', 'fo'), cell('ana', 'cap'), cell('ana', 'fo')];
  ok(!!F && F.state === 'open' && JSON.stringify(F.heads) === JSON.stringify(['cap:機長', 'fo:副操縦士']),
    '[M4] 開いた顔・職位の見出しは「機長」「副操縦士」の順', JSON.stringify(F && { state: F.state, heads: F.heads }));
  ok(JC.count === '7件の提出' && AC.count === '2件の提出' && JF.msg === W_PAY.empty && JF.count === null && AF.count === '1件の提出',
    `[M4] 件数：JAL 機長「7件の提出」・ANA 機長「2件の提出」・JAL 副操縦士「${W_PAY.empty}」・ANA 副操縦士「1件の提出」`,
    JSON.stringify([JC, JF, AC, AF].map((c) => [c.co, c.pos, c.count, c.msg])));
  ok(JC.shown === 5 && JC.seen === 5 && JSON.stringify(JC.fold) === JSON.stringify([{ open: false, s: W_PAY.more(7), n: 2 }]) && AC.shown === 2 && !AC.fold.length,
    `[M4] JAL 機長は5行まで見せて、残り2行は畳む（「${W_PAY.more(7)}」・閉じている）・ANA 機長の2行は畳まない`,
    JSON.stringify({ JC: [JC.shown, JC.seen, JC.fold], AC: [AC.shown, AC.fold] }));
  const lisJ = JC.lis || [];
  ok(lisJ.length === 7 && lisJ.every((r, i) => r.fleet === 'Boeing 787 Dreamliner' && r.chip === W_PAY.ten[i % 5] && /^¥[\d,]+万$/.test(r.amt || '')
      && r.vf === (i % 2 === 0 ? '明細で確認済み' : '本人申告') && !!r.age && r.pos === 0 && !/機長|副操縦士/.test(r.text)),
    '[M4] 行は REAL PAY の行と同じ中身（機種・年数の段・年収・出典・投稿時期）を、返ってきた順に・職位は繰り返さない',
    JSON.stringify(lisJ.map((r) => [r.fleet, r.chip, r.amt, r.vf, r.age, r.pos])));
  const vfB = (AC.lis || []).map((r) => r.vf);
  ok(JSON.stringify(vfB) === JSON.stringify(['本人申告', '明細で確認済み']), '[M4] 出典の字は行ごと（ANA 機長：本人申告・明細で確認済み）', JSON.stringify(vfB));
  /* 畳みは、押して・Enter で・Space で開け閉めできる（フォーカスは要約の上のまま） */
  const SUM = `${PAY_SEL} .crl-pc[data-airline="jal"][data-pos="cap"] > details.crl-more > summary`;
  const foldState = () => page.evaluate((s) => {
    const sm = document.querySelector(s);
    const c = sm && sm.closest('.crl-pc');
    return { open: !!(sm && sm.parentNode.open), seen: c ? [...c.querySelectorAll('li.crl-row')].filter((n) => n.checkVisibility()).length : -1,
      focus: !!sm && document.activeElement === sm };
  }, SUM);
  await page.click(SUM);
  const k1 = await foldState();
  await page.click(SUM);
  const k2 = await foldState();
  await page.focus(SUM);
  await page.keyboard.press('Enter');
  const k3 = await foldState();
  await page.keyboard.press('Space');
  const k4 = await foldState();
  await page.keyboard.press('Space');
  const k5 = await foldState();
  ok(k1.open && k1.seen === 7 && !k2.open && k2.seen === 5 && k3.open && k3.seen === 7 && k3.focus && !k4.open && k4.focus && k5.open && k5.seen === 7 && k5.focus,
    '[M4] 畳みは押すと開いて7行・もう一度で閉じる・Enter と Space でも開け閉めでき、フォーカスは要約の上のまま',
    JSON.stringify([k1, k2, k3, k4, k5]));
  /* REAL PAY への入口：行の在る会社 × 職位に1つ・住所は air= と pos= だけ・読み上げは会社と職位を言う */
  const links = [JC, JF, AC, AF].map((c) => c.links || []);
  const keysOf = (h) => { try { return [...new URL(h, 'http://x/').searchParams.keys()].join(','); } catch { return '?'; } };
  ok(links[1].length === 0 && [[0, 'jal', 'cap', '機長'], [2, 'ana', 'cap', '機長'], [3, 'ana', 'fo', '副操縦士']].every(([i, co, pos, ja]) =>
      links[i].length === 1 && links[i][0].href === `actual-pay.html?air=${co}&pos=${pos}` && keysOf(links[i][0].href) === 'air,pos'
      && links[i][0].label === `${NAME[co]} ${ja} ${W_PAY.all}` && links[i][0].t === W_PAY.all),
    `[M4] 「${W_PAY.all}」は行の在る会社 × 職位に1つ（actual-pay.html?air=…&pos=… だけ・読み上げは会社と職位）・行の無い所には無い`,
    JSON.stringify(links));
  ok(!!F && JSON.stringify(F.defs) === JSON.stringify([{ k: 'rows', t: W_PAY.c2 }]), '[M4] 一覧の下に、一覧が何かの1行（C-2）が1回だけ', JSON.stringify(F && F.defs));
  ok(!!F && F.entry.length === 0 && F.login.length === 0 && F.lock.length === 0, '[M4] 開いた人には、給与の入口も「ログイン」も錠の1行も出さない',
    JSON.stringify(F && { entry: F.entry, login: F.login, lock: F.lock }));
  /* M9 選ぶ欄・入力欄を置かない（REAL PAY の機材の絞り込みを戻さない）・押せるのは要約とリンクだけ（やり直しのボタンのほか） */
  const ctl = await page.evaluate((SEL) => {
    const b = document.querySelector(SEL);
    if (!b) return null;
    const focus = [...b.querySelectorAll('a[href], button, summary, select, input, textarea, [tabindex]')];
    return { ctl: b.querySelectorAll('select, input, textarea').length, buttons: [...b.querySelectorAll('button')].filter((x) => !x.matches('.crl-retry')).length,
      kinds: [...new Set(focus.map((x) => x.tagName.toLowerCase()))], pos: focus.filter((x) => x.tabIndex > 0).length };
  }, PAY_SEL);
  ok(!!ctl && ctl.ctl === 0, '[M9] 開いた欄に、選ぶ欄も入力欄も無い（REAL PAY の機材の絞り込みは戻さない）', JSON.stringify(ctl));
  ok(!!ctl && ctl.buttons === 0 && ctl.pos === 0 && ctl.kinds.every((x) => x === 'a' || x === 'summary'),
    '[M9][B] 押せるのは要約とリンクだけ（やり直しのほかのボタンは無い・読む順を飛ばす tabindex も無い）', JSON.stringify(ctl));
  await shots(page, 'pc');
  /* M4b（B）職位の書いていない行は、どのマスにも入らない／口コミに書かれた年収の行（機種も年数も無い）は、空の1行目を作らない */
  const A2 = [PRF('jal'), PRF('jal', { fleet: null, ten: null, tenk: null, annual_usd: 314159 }), PRF('jal', { pos: null })];
  const B2 = [PRF('ana', { pos: 'fo' })];
  const b2 = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, stub: { pv_pay_rows: payReply(H.payFix.open(A2, B2)) } });
  ok(await payDone(b2.page, 'jal|ana'), '（職位の無い行・口コミの行）給与の欄が読み終わった');
  const G = await payFace(b2.page);
  const gc = (co, pos) => (G ? G.cells.find((c) => c.co === co && c.pos === pos) : null) || {};
  const rv = (gc('jal', 'cap').lis || [])[1] || {};
  ok(!!G && G.rows === 3 && gc('jal', 'cap').count === '2件の提出' && gc('ana', 'fo').count === '1件の提出'
    && G.cells.every((c) => c.pos === 'cap' || c.pos === 'fo'),
    '[M4b][B] 職位の書いていない行は、どの職位のマスにも数えない（JAL 機長「2件の提出」・欄の行は3つ）',
    JSON.stringify(G && { rows: G.rows, cells: G.cells.map((c) => [c.co, c.pos, c.count, c.msg]) }));
  ok(rv.fleet === null && rv.chip === null && rv.aH <= 0 && /^¥[\d,]+万$/.test(rv.amt || ''),
    '[M4b][B] 口コミに書かれた年収の行（機種も年数も無い）は、空の1行目を作らず、年収から始まる', JSON.stringify(rv));
  payAnswered([st, b2.st]);
});

scene('pay-med', '給与の中央値：開いた答えからだけ・職位の行の上に・額のそばに人数を書かない・鍵の無い人と行の無い2社には聞きもしない', 'mock', async () => {
  const A = [PRF('jal'), PRF('jal'), PRF('jal', { pos: 'fo' })], B = [PRF('ana'), PRF('ana', { pos: 'fo' })];
  const PER = { from: '2024-10', to: '2026-09' };
  /* jal 機長の箱には、人数（people）も植えておく ── 画面が人数を受け取らない・出さないことを見る */
  const MED = { ok: true, state: 'open', period: PER, floor: 3, airlines: {
    jal: { cap: { s: 'ok', median_usd: 314159, people: 5 }, fo: { s: 'ok', median_usd: 161803 } },
    ana: { cap: { s: 'few' }, fo: { s: 'ok', median_usd: 141421 } } } };
  const meds = (page) => page.evaluate((SEL) => {
    const b = document.querySelector(SEL);
    const ag = b && b.querySelector('.crl-agg');
    const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : null);
    const first = b && b.querySelector('h3.crl-pr-h');
    return {
      agg: !!ag, hidden: !ag || ag.hidden, kind: ag ? ag.getAttribute('data-kind') : null, h: ag ? [...ag.querySelectorAll('h3.crl-agg-h')].map(tx) : [],
      lines: ag ? [...ag.querySelectorAll('.crl-cmp-row[data-med]')].map((r) => ({ k: r.getAttribute('data-med'), key: tx(r.querySelector('.crl-cmp-k')),
        c: [...r.querySelectorAll('.crl-cmp-c')].map((c) => ({ amt: tx(c.querySelector('b.crl-amt.pv-no-cur[data-agg]')), none: tx(c.querySelector('.crl-none')) })) })) : [],
      linesText: ag ? [...ag.querySelectorAll('h3.crl-agg-h, .crl-cmp-row[data-med]')].map(tx).join(' ') : '',
      defs: [...document.querySelectorAll('[data-def="median"]')].map((p) => ({ t: tx(p), inAgg: !!ag && ag.contains(p),
        after: !!p.previousElementSibling && p.previousElementSibling.matches('.crl-cmp-row[data-med]') && p === p.parentNode.lastElementChild })),
      above: !!(ag && first) && !!(ag.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) && ag.getBoundingClientRect().bottom <= first.getBoundingClientRect().top + 0.5,
      aggInLi: document.querySelectorAll('li [data-agg]').length, ulInAgg: ag ? ag.querySelectorAll('ul').length : -1,
      anyAgg: document.querySelectorAll('[data-agg]').length, anyMed: document.querySelectorAll('[data-med]').length,
    };
  }, PAY_SEL);
  /* M10 a */
  const a = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH,
    stub: { pv_pay_rows: payReply(H.payFix.open(A, B)), pv_company_pay: payReply(MED) } });
  ok(await payDone(a.page, 'jal|ana'), '（鍵の開いた人）給与の欄が読み終わった');
  const drew = await until(a.page, (SEL) => !!document.querySelector(`${SEL} .crl-agg:not([hidden]) [data-def="median"]`), PAY_SEL);
  const M = await meds(a.page);
  const L = M.lines;
  ok(drew && M.kind === 'aggregate' && !M.hidden && JSON.stringify(M.h) === JSON.stringify([W_PAY.median]) && M.above,
    `[M10 a][B] 中央値の器（data-kind="aggregate"）に見出し「${W_PAY.median}」が1つ・職位ごとの行（提出の一覧）より上`, JSON.stringify({ drew, ...M, lines: undefined }));
  ok(L.length === 2 && L[0].k === 'cap' && L[0].key === '機長' && /^¥[\d,]+万$/.test(L[0].c[0].amt || '') && L[0].c[1].none === W_PAY.none && L[0].c[1].amt === null
    && L[1].k === 'fo' && L[1].key === '副操縦士' && L[1].c.every((c) => /^¥[\d,]+万$/.test(c.amt || '')),
    `[M10 a][B] 機長：JAL の額と ANA「${W_PAY.none}」（人数が足りない側）・副操縦士：2社の額`, JSON.stringify(L));
  ok(M.defs.length === 1 && M.defs[0].inAgg && M.defs[0].after && M.defs[0].t === W_PAY.c3('2024年10月', '2026年9月', 3),
    '[M10 a][B] 中央値の行のすぐ下に、定義の1行（C-3）が1回だけ ── 返事の期間と人数の下限（下限は決まりの数で、人数ではない）', JSON.stringify(M.defs));
  ok(!/\d+\s*人/.test(M.linesText), '[M10 a] 中央値の額のそばに人数を書かない（返事に人数が植えてあっても）', M.linesText);
  const askA = a.st.calls.filter((c) => c.name === 'pv_company_pay');
  ok(askA.length === 1 && JSON.stringify(askA[0].p) === JSON.stringify({ airlines: ['jal', 'ana'] }),
    '[M10 a][B] 中央値は2社の組に1回だけ聞く（{ airlines: [jal, ana] }）', JSON.stringify(askA.map((c) => c.p)));
  /* M10 f 額の印は中央値の器の中だけ・器は一覧を持たない */
  ok(M.aggInLi === 0 && M.ulInAgg === 0 && M.anyAgg === 3, '[M10 f] 中央値の額の印（data-agg）は器の中の3つだけ（行の li の中に無い）・器は一覧（ul）を持たない',
    JSON.stringify({ aggInLi: M.aggInLi, ulInAgg: M.ulInAgg, anyAgg: M.anyAgg }));
  await shots(a.page, 'pc');
  /* M10 f の続き：4つの箱が全部「人数が足りない」→ 器ごと出さない（見出しだけを立てない） */
  const FEW = { ok: true, state: 'open', period: PER, floor: 3, airlines: { jal: { cap: { s: 'few' }, fo: { s: 'few' } }, ana: { cap: { s: 'few' }, fo: { s: 'few' } } } };
  const f = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH,
    stub: { pv_pay_rows: payReply(H.payFix.open(A, B)), pv_company_pay: payReply(FEW) } });
  ok(await payDone(f.page, 'jal|ana'), '（4つとも人数が足りない）給与の欄が読み終わった');
  const readF = await until(f.page, () => window.__payRead() >= 1);
  const MF = await meds(f.page);
  ok(readF && MF.agg && MF.hidden && MF.h.length === 0 && MF.anyAgg === 0 && MF.anyMed === 0 && MF.defs.length === 0,
    '[M10 f] 4つとも人数が足りない答え：中央値の器は隠れたまま（見出しも定義の1行も出さない）', JSON.stringify({ readF, ...MF }));
  /* M10 b 鍵が途中で切れた答え（state locked）に中央値が植えてあっても、何も描かない */
  const PLANT = { ok: true, state: 'locked', period: PER, floor: 3, airlines: {
    jal: { cap: { s: 'ok', median_usd: 271828 }, fo: { s: 'ok', median_usd: 271828 } }, ana: { cap: { s: 'ok', median_usd: 271828 }, fo: { s: 'ok', median_usd: 271828 } } } };
  const rowsB = H.payFix.open(A.map((r) => ({ ...r, annual_usd: 314159 })), B.map((r) => ({ ...r, annual_usd: 314159 })));
  const b = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, stub: { pv_pay_rows: payReply(rowsB), pv_company_pay: payReply(PLANT) } });
  ok(await payDone(b.page, 'jal|ana'), '（中央値の答えが locked）給与の欄が読み終わった');
  const readB = await until(b.page, () => window.__payRead() >= 1);
  const MB = await meds(b.page);
  const docB = await b.page.evaluate(() => document.documentElement.outerHTML);
  ok(readB && MB.hidden && MB.h.length === 0 && MB.anyAgg === 0 && MB.anyMed === 0 && MB.defs.length === 0 && !docB.includes('271828'),
    '[M10 b] 開いていない（locked）中央値の答えからは何も描かない ── 植えた中央値は画面のどこにも無い', JSON.stringify({ readB, ...MB, raw: docB.includes('271828') }));
  /* M10 d 鍵の無い人（ゲスト・会員・期限切れ・口コミの鍵だけ）と、開いていても2社に行が無い人：中央値を1回も聞かない */
  const READERS_D = [
    ['ゲスト', H.payFix.guest(A, B), {}],
    ['会員', H.payFix.member(A, B), {}],
    ['期限切れ', H.payFix.expired(A, B), {}],
    ['口コミの鍵だけ', H.payFix.member(A, B), { pv_reviews: () => ({ status: 200, body: { ok: true, unlocked: true, rows: [] } }) }],
    ['開いた・2社とも行なし', H.payFix.open([], [PRF('eva-air')]), {}],
  ];
  const sts = [a.st, f.st, b.st];
  for (const [who, body, more] of READERS_D) {
    const r = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, stub: { pv_pay_rows: payReply(body), ...more } });
    sts.push(r.st);
    const done = await payDone(r.page, 'jal|ana');
    const asked = await askedOf(r.page, r.st, ['pv_company_pay']);
    const s = await slot(r.page, 'cmp-pay');
    ok(done && asked.length === 0 && !!s && s.state !== 'open', `[M10 d] ${who}：中央値（pv_company_pay）を1回も聞かない（欄は「${s && s.state}」）`, JSON.stringify({ done, asked }));
  }
  payAnswered(sts);
});

/* ══ 走らせる ═══════════════════════════════════════════════════ */
const KEYS = SCENES.map((s) => s.key);
const bad = (WANT || []).filter((k) => !KEYS.includes(k));
if (bad.length) { console.error(`知らない場面: ${bad.join(',')}（在るのは ${KEYS.join(',')}）`); process.exit(2); }
const t0 = Date.now();
try {
  for (const mode of ['static', 'mock', 'sql', 'local']) {
    for (const s of SCENES.filter((x) => x.mode === mode && (!WANT || WANT.includes(x.key)))) {
      CUR = { ...s, pages: [], env: null };
      head(`${TAG[mode]} ${s.key} ── ${s.label}`);
      try {
        if (mode !== 'static') {
          browser = browser || await H.launch();
          CUR.env = mode === 'mock' ? (mockEnv = mockEnv || await H.startLocal()) : await H.startLocal();
        }
        await s.fn();
      } catch (e) {
        ok(false, '場面が最後まで走らなかった', String((e && e.stack) || e).slice(0, 500));
      } finally {
        if (mode !== 'static') {
          for (const o of CUR.pages) await o.close();
          const sts = CUR.pages.map((o) => o.st);
          const F = sceneFaults(mode, sts);
          const blocked = sts.flatMap((x) => x.blocked);
          NET.through += F.through.length; NET.supa += F.supa.length; NET.blocked += blocked.length;
          ok(F.supa.length === 0, '本番の supabase への要求 0', F.supa.join('・'));
          ok(F.through.length === 0, `外へすり抜けた要求 0（門が止めた外への要求 ${blocked.length}）`, F.through.join('・'));
          if (mode === 'mock') ok(F.unknown.length === 0, '自分の担当の呼び出しには、全部この検査が返事を作った', F.unknown.join(','));
          const foreign = [...new Set(sts.flatMap((x) => x.foreign))];
          if (foreign.length) console.log(`  ・ほかの担当の呼び出し（準備中で返した）: ${foreign.join(', ')}`);
          const errs = [...new Set(sts.flatMap((x) => x.errs))];
          if (errs.length) console.log(`  ・ページの中のエラー: ${errs.join(' ／ ')}`);
          if (mode !== 'mock' && CUR.env) await CUR.env.stop();
        }
      }
    }
  }
} finally {
  CUR = null;
  if (browser) await browser.close();
  if (mockEnv) await mockEnv.stop();
}
const ran = SCENES.filter((s) => !WANT || WANT.includes(s.key)).map((s) => s.key);
console.log(`\n  場面: ${ran.join(', ')}${WANT ? '（--scenes で絞った。緑でも全部を見たことにはならない）' : ''}`);
console.log(`  ★外への通信（localhost と LIBS のほか）: すり抜け ${NET.through}・本番の supabase ${NET.supa}・門が止めた ${NET.blocked}`);
console.log(`\n══ ${pass} pass / ${fail} fail ══（MOCK と STATIC。本番は 未確認）  ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(fail ? 1 : 0);
