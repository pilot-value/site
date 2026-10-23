/* ══════════════════════════════════════════════════════════════════
   assert-career-live.mjs — 比較（career.html?view=compare）の生きた欄の場面（2026-10-22）

   守っているもの（口コミの区域の場面。給与の区域（cmp-pay）も、自分の場面をこのファイルに足す）
     ・外へは1本も出ない（場面 net）── 手元の口と LIBS のほかは門が止めて数える。すり抜けは0。ブラウザは名前も引けない。
     ・返事を用意していない自分の呼び出しを見逃さない（場面 unknown）── 黙って「準備中」に見せない。
     ・口コミの行のほかの列（昔の口コミに書かれた給与・職位）を、画面にも保存領域にも出さない。サーバーの抜粋は抜粋の場所にだけ（場面 leak）。
     ・6角形の名前は会社ページの図と同じ正本から（島 #crl-cats・static）。点数は誰にでも・6分類ぜんぶに点数がある会社だけ点数で塗る・
       塗れない会社は 3.0 の淡い面で数字なし・読めなかった会社は空（場面 radar）。
     ・新しい投稿の抜粋は誰にでも。続きは口コミの Give & Get（給与の入口と混ぜない）── 鍵の無い人にだけ1つ（場面 clip）。
     ・投稿が無い2社に、数字も2つの文も出さない。1つの文の下に、会社ごとの 3.0 の淡い6角形（数字なし）（場面 zero）。
     ・会社ページと比較が、同じ上限の件数で口コミを数え、同じ1つの数え方（realRated）で評価を出す（static）。
     ・比較の評価は会社ページと同じ数（星・点数・「n件の評価」、次の行に「会員の投稿 n件」）。点の低い投稿も数える（場面 rate）。
     ・点数の無い会社・投稿の無い会社に、0 も空の星も置かない（場面 unrated）。
     ・片方の会社が読めなくても、もう片方は出す。やり直すのは読めなかった方だけ（場面 side）。
     ・1社の概要（career.html?airline=…）も同じ数え方（場面 overview）。
     ・比較の口コミの要約（cmp-summary）：読む人の1行は枠に1回だけ ── ゲストは「ログインが必要です」と「ログイン」1つ（評価の読み込みを
       待たない・場面 sumlogin）、口コミの鍵の無い会員は「要約は口コミの投稿で開きます」だけ・リンク0・返事に植えた点は画面にも保存領域にも
       出ない・給与の鍵では開かない（場面 sumkey）。別のタブで読む人が替わったら、前の人の文を1字も残さず次の人の顔へ（場面 sumtwo・static S9）。
       関数がまだ無いときは「準備中」を1回・数字なし・点数の付いた投稿の無い2社の下には何も見せない（場面 sumoff）。
       [B] 開いた要約は各社2点まで・足元・欄にリンク無し（sumopen）／静かな1行の出し方（sumquiet）／読めないときの顔と「やり直す」1つ
       （混ざった失敗 ── 片方の欄は2社とも・もう片方は1社だけ ── でも帯は1本・「やり直す」はその帯の1つ）（sumfail）。
     ・[REAL LOCAL] ブラウザの「戻る」で比較が手元から戻ったら、投稿で変わる数をその場で取り直す（骨組みに戻さない・読み込み直さない）。
       離れているあいだにほかのタブで別の会員が入っていたら、前の人の本文の字をどの瞬間にも出さずに今の人の形へ（場面 local-back ── L7。
       本当に手元から戻ったかを毎回確かめ、5回とも戻らなければ赤。別の会員の回は画面の出入りの知らせ visibilitychange を黙らせて、
       pageshow の中の読む人の確かめだけで止まることを見る ── 理由は場面の中の注記）。
     ・[REAL LOCAL] 手元の SQL が答える比較と会社ページ（どの場面も自分の使い捨ての保存先・会員の投稿は via・修正と削除は q() で直接）：
       評価と件数が、比較で選べる主要5社で会社ページと同じ（古い会社コードの口コミも数える・場面 local-eq ── L1）／投稿の追加・修正・削除の
       あと2つの画面が一緒に動く（local-post ── L2）／要約の門を返事の字で：ゲストは login・鍵の無い会員と給与の鍵だけ（期限切れも）は locked、
       口コミの鍵の人には会社ページと同じ文・口コミの鍵では月の働き方と待遇は開かない（local-sum ── L3）／別のタブで読む人が替わる
       （local-two ── L4）／要約は口コミの変化に付いてくる：追加では前の要約のまま・修正で消える・預け直しで新しい点・少なくなれば「少ない」
       （local-change ── L5）／会社ごとの答え：自分の会社は開き、ほかの会社は「5つ答えると開きます」、期限切れで全部閉じる（local-mix ── L6）／
       2つの鍵は自分の欄だけを閉じる（local-both ── L8）。給与の鍵の期限切れは場面が作り、終わりに種をまいた直後の値へ戻す。
     ・口コミの鍵のある人は、会社のマスの中でほかの人の投稿を本文のまま新しい順にスクロールして読める（5件ずつ・キーボードで）。
       ゲスト・給与の鍵だけの会員には本文が1字も出ない（返事に植えた本文の列も読まない）・読む人が替わったら消える（場面 revkey）。
     ・[B] 欄の「やり直す」のあと、待つあいだに読み手が動いた先からフォーカスを引き戻さない（場面 refocus）。
     給与の区域（cmp-pay ── 比較の「提出された年収」。返事の材料は cmp-stubs.mjs の payFix）
     ・鍵の無い人（ゲスト・会員・期限切れ）には、会社ごとの件数だけ。行・額・板を描かず、返事に植えた列は画面にも保存領域にも出ない。
       中央値（pv_company_pay）も DEEP PAY も聞かない。錠の1行と入口（Give & Get）は1つずつ・「ログイン」はゲストにだけ（場面 pay-lock）。
     ・鍵の開いた人：職位ごとに会社の列・5行まで見せて6行目からは畳む・REAL PAY の行（職位は繰り返さない）・住所は air= と pos= だけ・
       選ぶ欄も入力欄も置かない・給与の入口は出さない（場面 pay-open）。
     ・中央値は開いた答えからだけ・額のそばに人数を書かない・鍵の無い人と行の無い2社には聞きもしない（場面 pay-med）。
     ・2社を選び直し・入れ替えても、一覧は1回だけ読む・欄はいつも見えている2社のもの。前の2社へ遅れて届いた答え（一覧も中央値も）は
       画面のどこにも入らない（場面 pay-move）。
     ・通貨を替えても通信しない・円のほかで「¥」「万」を出さない・円に戻すと1文字も違わない・開けた畳みは開いたまま（場面 pay-fit）。
     ・読めない（500）・口がまだ無い（404・PGRST202）でも給与の入口は残る。中央値だけ読めないときは器の中だけで言い、
       「やり直す」は中央値だけを聞き直す。押した人のキーボードの居場所は、器の見出しか次の「やり直す」（場面 pay-fail）。
     ・返事の来ない一覧は、上限（career-live.js の REQ_LIMIT_MS）を本当に待って「いま読み出せません」・その1本は取り消す（場面 pay-stall）。
   どの場面も、終わりに3つを確かめる：本番の supabase への要求 0・外へすり抜けた要求 0・（MOCK）自分の呼び出しに全部返事があった。

   実行: node assert-career-live.mjs [--scenes a,b] [--shots <folder>] [--via form|call] [--sql <file>]
     --scenes  場面を選ぶ（static・net・unknown・leak・zero … sumopen・sumlogin・sumkey・sumtwo・sumoff・sumquiet・sumfail・revkey・refocus …
               pay-lock・pay-open・pay-med・pay-move・pay-fit・pay-fail・pay-stall … local-back・local-eq・local-post・local-sum・
               local-two・local-change・local-mix・local-both）。
               付けなければ全部（static → MOCK → REAL LOCAL の順）。⚠️ pay-stall は上限まで本当に待つ（15秒あまり）
     --shots   場面の確かめのあと、口コミ・月の働き方・待遇の箱を、その場面の大きさで撮って置く（置き場は打った場所。ファイルに書かない）。
               場面 pay-fit・pay-fail は「提出された年収」の箱を撮る（ディルハム・読めない・準備中・中央値の失敗と準備中）
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

  /* S7 比較の回答の欄が並べる質問（gen-career.mjs の CMP_KEYS）。正本は質問の台帳（pv-conditions.mjs の QUESTIONS）。
       ・勤務・訓練（work）と給与・待遇（pay）は重ならず、合わせると「やめていない・額の質問（通貨つき）でない」質問ちょうど全部
       ・額の質問は1つも無い（会社ページの箱と同じ ── 箱は通貨なしで数字だけを出す）
       ・どちらの並びも、会社ページの面の順（勤務予定 → 通勤 → Staff Travel → 昇格・訓練 → ほか）、その中は台帳の順
       ・合わせて 120 まで（pv_contrib_facts が1回で受け取る上限）
       ・ページの1回の読み（career-live.js の pageKeys）が、比較の回答の欄（cmp-facts）の鍵も聞く */
  const { CMP_KEYS, tabOfKey } = await import('./gen-career.mjs');
  const { QUESTIONS } = await import('./pv-conditions.mjs');
  const W = CMP_KEYS.work, P = CMP_KEYS.pay, U = [...W, ...P];
  const want = QUESTIONS.filter((q) => !q.retired && !q.currency).map((q) => q.id);
  const cur = new Set(QUESTIONS.filter((q) => q.currency).map((q) => q.id));
  ok(W.length > 0 && P.length > 0 && !W.some((k) => P.includes(k)) && new Set(U).size === U.length
    && W.every((k) => tabOfKey(k) === 'work') && P.every((k) => tabOfKey(k) === 'pay'),
  `比較の回答の質問：勤務・訓練 ${W.length}・給与・待遇 ${P.length} は重ならない（tabOfKey と同じ側）`, JSON.stringify({ W, P }));
  ok(U.length === want.length && want.every((k) => U.includes(k)),
    `2つを合わせると、やめていない・額でない質問ちょうど全部（${want.length}）`, JSON.stringify({ missing: want.filter((k) => !U.includes(k)), extra: U.filter((k) => !want.includes(k)) }));
  ok(!U.some((k) => cur.has(k)), '比較の回答の質問に、額の質問（通貨つき）が1つも無い', U.filter((k) => cur.has(k)).join(','));
  const surf = (q) => (q.section === 'roster' ? 0 : q.topic === 'taxi' ? 1 : q.topic === 'staff_travel' ? 2 : q.section === 'career' ? 3 : 4);
  const at = (k) => QUESTIONS.findIndex((q) => q.id === k);
  const inOrder = (list) => list.every((k, i) => i === 0 || (() => {
    const a = QUESTIONS[at(list[i - 1])], b = QUESTIONS[at(k)];
    return surf(a) < surf(b) || (surf(a) === surf(b) && at(list[i - 1]) < at(k));
  })());
  ok(inOrder(W) && inOrder(P), 'どちらの並びも、会社ページの面の順（勤務予定 → 通勤 → Staff Travel → 昇格・訓練）、その中は台帳の順', JSON.stringify({ W, P }));
  ok(U.length <= 120, `比較が1回で聞く質問は 120 まで（${U.length}）`);
  const pk = (LJ.match(/function pageKeys\(\) \{[\s\S]*?\n {2}\}/) || [''])[0];
  ok(pk.includes(`.crl[data-live="cmp-facts"][data-keys]`) && pk.includes(`.crl[data-live="fact"][data-keys]`),
    'ページの1回の読み（pageKeys）は、集計の欄（fact）と比較の回答の欄（cmp-facts）の鍵を合わせて聞く', pk.slice(0, 400));

  /* S8 career.html の比較の回答の欄はちょうど2つ：「月の働き方」の欄（cmp-work）のすぐ次に data-quiet="1" で勤務・訓練の質問、
     「待遇」の見出しの下に給与・待遇の質問（data-quiet なし）。鍵の並びは CMP_KEYS のまま（生成し忘れ・入れ違いは赤） */
  const tagsOf = (kind) => [...CH.matchAll(/<div class="crl"[^>]*>/g)].filter((m) => m[0].includes(` data-live="${kind}"`))
    .map((m) => ({ at: m.index, end: m.index + m[0].length, tag: m[0] }));
  const attrOf = (t, a) => { const m = new RegExp(` data-${a}="([^"]*)"`).exec(t); return m ? m[1] : null; };
  const CF = tagsOf('cmp-facts'), CW = tagsOf('cmp-work'), ben = CH.indexOf('id="cr-cmp-h-ben"');
  const wEnd = CW.length === 1 ? CH.indexOf('</div>', CW[0].end) + '</div>'.length : -1;
  ok(CF.length === 2 && CW.length === 1 && CH.split('data-live="cmp-facts"').length === 3,
    'career.html の比較の回答の欄（data-live="cmp-facts"）はちょうど2つ・月の働き方の欄（cmp-work）は1つ', JSON.stringify({ CF: CF.length, CW: CW.length }));
  const [Q, Pz] = CF.length === 2 ? CF : [{ tag: '' }, { tag: '' }];
  ok(CF.length === 2 && wEnd > 0 && /^\s*$/.test(CH.slice(wEnd, Q.at)) && attrOf(Q.tag, 'quiet') === '1' && attrOf(Q.tag, 'keys') === CMP_KEYS.work.join(','),
    '月の働き方の欄のすぐ次の欄は data-quiet="1"・聞く質問は勤務・訓練（CMP_KEYS.work）のまま', Q.tag.slice(0, 300));
  ok(CF.length === 2 && ben > 0 && Pz.at > ben && attrOf(Pz.tag, 'quiet') === null && attrOf(Pz.tag, 'keys') === CMP_KEYS.pay.join(','),
    '「待遇」の見出しの下の欄は data-quiet なし・聞く質問は給与・待遇（CMP_KEYS.pay）のまま', Pz.tag.slice(0, 300));

  /* S9 比較の口コミの要約（cmp-summary）は、読む人が替わったら空にして取り直す欄の1つ（setUid の reset の並びに在る ── 同じ所で 'sum:' の
     答えも捨てる）。時計や画面の出入りで取り直す仕掛けは持たない。career.html では、評価の欄（cmp-stars）のすぐ次の欄（CSS が隣の印を読む） */
  const su = (LJ.match(/function setUid\(v\) \{[\s\S]*?\n {2}\}/) || [''])[0];
  const rl = (su.match(/reset\(\[([^\]]*)\]\)/) || ['', ''])[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  ok(rl.includes('cmp-summary') && /drop\('sum:'\)/.test(su),
    '読む人が替わったら、比較の要約の欄（cmp-summary）も空にして取り直す（setUid の reset の並び・同じ所で要約の答え sum: を捨てる）', JSON.stringify({ rl, sum: /drop\('sum:'\)/.test(su) }));
  const tick = ['visibilitychange', 'setInterval', 'GATED_KEYS', 'function stale('].filter((w) => LJ.includes(w));
  ok(tick.length === 0, '時計・画面の出入りで取り直す仕掛けを持たない（visibilitychange・setInterval・GATED_KEYS・stale が無い）', tick.join(','));
  const slotLines = CH.split('\n').map((l) => l.trim()).filter((l) => /^<div class="crl" data-live="cmp-(stars|summary)"/.test(l));
  const chLines = CH.split('\n').map((l) => l.trim());
  const starsAt = chLines.findIndex((l) => l.startsWith('<div class="crl" data-live="cmp-stars"'));
  ok(slotLines.length === 2 && starsAt >= 0 && chLines[starsAt + 1].startsWith('<div class="crl" data-live="cmp-summary"'),
    'career.html：比較の要約の欄（cmp-summary）はちょうど1つで、評価の欄（cmp-stars）の行のすぐ次の行', JSON.stringify(slotLines));
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

/* 2026-10-22 LEAD AMENDMENT (2)（オーナー「必ず多角形のレーダーの図を載せて」P12.95／96／97）で、1つの文の下に会社ごとの 3.0 の淡い6角形が
   加わった。前の決まり「欄に在るのは1つの文だけ」「欄の字はその1文だけ」は、同じ強さで次へ移した（X0）：
   欄の子は 文 ＋ 2社の格子 の2つだけ／格子を除いた字はその1文だけ／格子は社名の札と6角形の行だけ／図は2つとも 3.0 の淡い面（数字なし）／欄の字に数字が無い */
scene('zero', '2社とも投稿が無いとき、数字も2つの文も出さない・1つの文の下に会社ごとの 3.0 の淡い6角形（数字なし）', 'mock', async () => {
  const { page } = await open('pc', { url: PAIR_URL('jal', 'etihad') });
  ok(await settled(page, 'cmp-stars', 'jal|etihad'), '口コミの欄が読み終わった');
  const s = await slot(page, 'cmp-stars');
  ok(!!s && s.state === 'empty', '欄は「まだ無い」の顔（data-state empty）', s && s.state);
  const z = await page.evaluate(() => {
    const b = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
    if (!b) return null;
    const g = b.querySelector(':scope > .crl-cmp');
    const rest = b.cloneNode(true), rg = rest.querySelector(':scope > .crl-cmp');
    if (rg) rg.remove();
    return {
      kids: [...b.children].map((c) => `${c.tagName.toLowerCase()}.${c.className}`),
      grid: g ? [...g.children].map((c) => c.className) : [],
      head: g ? [...g.querySelectorAll(':scope > .crl-cmp-head > .crl-co')].map((c) => c.textContent.trim()) : [],
      extra: b.querySelectorAll('.crl-avg, .crl-cnt, .crl-posts, .crl-score, .crl-rate, .crl-stars, .crl-revs, .crl-lock, .crl-cmp-row, .crl-radar-dot, [data-radar="real"]').length,
      rest: rest.textContent.trim(),
    };
  });
  const F = await figs(page);
  ok(!!z && JSON.stringify(z.kids) === JSON.stringify(['p.crl-msg', 'div.crl-cmp']),
    '欄に在るのは、1つの文（2社それぞれの文を並べない）と、その下の2社の格子だけ（文が先）', JSON.stringify(z && z.kids));
  /* 会社ページと同じ言葉（海外の評判の引用もある「口コミ」とは言わない ── 会員の投稿が無い、が本当のこと） */
  ok(!!z && z.rest === '会員からの投稿はまだありません', 'その1文は「会員からの投稿はまだありません」（格子のほかに字は無い）', z && z.rest);
  ok(!!z && JSON.stringify(z.grid) === JSON.stringify(['crl-cmp-head', 'crl-cmp-sub crl-rate-fig'])
    && JSON.stringify(z.head) === JSON.stringify([NAME.jal, NAME.etihad]) && z.extra === 0,
    '格子は社名の札（JAL・エティハドの順）と6角形の行だけ（星・点数・件数・抜粋・錠の1行・比べる行・点数で塗った図が無い）',
    JSON.stringify(z && { grid: z.grid, head: z.head, extra: z.extra }));
  ok(F.rows === 1 && F.cells.length === 2 && F.cells.every((c) => isPh(c, F.island)),
    '2社とも、会社ページと同じ 3.0 の淡い面（is-ph）・6つの名前（島の順）・点の丸も分類ごとの点も無い・読み上げない', JSON.stringify(F));
  ok(!!s && s.text.trim().length > 0 && !/\d/.test(s.text), '数字を1つも出さない（0件を 0 と書かない・3.0 を字にしない）', s && s.text);
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

/* ══ 比較の口コミの要約（cmp-summary）と、口コミの鍵のある人の読む枠 ══════════════
   字は決めごと（比較の口コミの設計 E6・状態の表 B）なので、ページのコードから借りずにここへ書く。 */
const SUM_SEL = '#cr [data-view="compare"] .crl[data-live="cmp-summary"]';
const REV_BOX = '#cr [data-view="compare"] .cr-cmp-rev';
const SUMW = { title: '口コミの要約', login: 'ログインが必要です', key: '要約は口コミの投稿で開きます', few: '口コミがまだ少ないため、要約はありません',
  none: '口コミの要約は、まだありません', off: '準備中', err: 'いま読み出せません', retry: 'やり直す',
  foot: ['AI 要約', '会員の口コミ 3件から', '2026-10-01 更新'] };
const SUM_OPEN = (co) => ({ ok: true, state: 'open', n: 3, as_of: '2026-10-01',
  good: [{ text: `${co} 良い点その一`, cat: 'training' }, { text: `${co} 良い点その二`, cat: 'wlb' }, { text: `${co} 良い点その三`, cat: 'ops' }],
  concern: [{ text: `${co} 気になる点その一`, cat: 'benefits' }] });
/* 鍵の無い人への返事に、わざと点と件数を植えたもの（画面は状態の1語しか読まない） */
const SUM_LEAK = { ok: true, state: 'locked', n: 7, as_of: '2026-10-01', good: [{ text: 'LEAK-GOOD 点', cat: 'ops' }], concern: [{ text: 'LEAK-CONCERN 点' }] };
const SUM_FAIL = { status: 500, body: { code: 'XX000', details: null, hint: null, message: '検査のわざとの失敗' } };
const SUM_NOFN = { status: 404, body: { code: 'PGRST202', details: null, hint: null, message: 'Could not find the function public.pv_review_summary' } };
/* 会社ごとの要約の返事（{ slug: body | { status, body } }）。聞かれた会社は p.airline */
const sumBy = (map, dflt = { ok: true, state: 'few' }) => (p) => {
  const r = map[p && p.airline];
  if (r && r.status) return r;
  return { status: 200, body: r || dflt };
};
/* 送ってきたログインが誰か（serve-local.mjs の MEMBERS の key。ログインしていなければ 'anon'）── 場面 mixtwo と同じ読み方 */
const { MEMBERS: LOCAL_MEMBERS } = await import('./serve-local.mjs');
const MEMBER_OF = Object.fromEntries(LOCAL_MEMBERS.map((m) => [m.id, m.key]));
const whoOf = (auth) => {
  try { const t = String(auth || '').replace(/^Bearer /, ''); return MEMBER_OF[JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sub] || 'anon'; }
  catch { return 'anon'; }
};
/* 要約の欄と口コミの箱の、見えている顔（見えている字・錠前の1行・「やり直す」・「ログイン」）と、画面と保存領域の全部の字 */
const sumFace = (page) => page.evaluate((SUM_SEL, REV_BOX) => {
  const b = document.querySelector(SUM_SEL), box = document.querySelector(REV_BOX);
  if (!b || !box) return null;
  const vis = (n) => { if (!n || !n.getClientRects().length) return false; const r = n.getBoundingClientRect(), s = getComputedStyle(n);
    return s.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
  const seen = (root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), out = [];
    for (let t = w.nextNode(); t; t = w.nextNode()) { const p = t.parentElement; if (t.nodeValue.trim() && p && !p.closest('.crl-sr') && vis(p)) out.push(t.nodeValue.trim()); }
    return out; };
  const store = [];
  for (const S of [localStorage, sessionStorage]) for (let i = 0; i < S.length; i++) { const k = S.key(i); store.push(`${k}=${S.getItem(k)}`); }
  const r = b.getBoundingClientRect();
  return {
    state: b.getAttribute('data-state'), part: b.getAttribute('data-part'), h: Math.round(r.height),
    why: [...b.querySelectorAll('[data-why]')].map((x) => x.getAttribute('data-why')), seen: seen(b),
    titles: [...b.querySelectorAll('.crl-sum-title')].filter(vis).map((x) => x.textContent),
    cells: [...b.querySelectorAll('.crl-sum2-c')].map((c) => ({ col: c.getAttribute('data-col'), quiet: c.hasAttribute('data-quiet'), shown: vis(c),
      tag: (c.querySelector(':scope > .crl-co') || {}).textContent || null,
      good: [...c.querySelectorAll('.crl-sum-col[data-kind="good"] .crl-sum-t')].map((x) => x.textContent),
      concern: [...c.querySelectorAll('.crl-sum-col[data-kind="concern"] .crl-sum-t')].map((x) => x.textContent),
      foot: [...c.querySelectorAll('.crl-sum-by > span')].map((x) => x.textContent), seen: seen(c) })),
    links: b.querySelectorAll('a').length,
    boxLocks: [...box.querySelectorAll('.crl-lock')].filter(vis).map((x) => x.textContent.trim()),
    boxRetries: [...box.querySelectorAll('.crl-retry')].filter(vis).length,
    boxLogin: [...box.querySelectorAll('a')].filter((a) => vis(a) && a.textContent.trim() === 'ログイン').map((a) => a.getAttribute('href')),
    boxGG: [...box.querySelectorAll('a.pv-gg')].filter(vis).length,
    boxErrs: seen(box).filter((t) => t === 'いま読み出せません').length,
    /* 箱に見える失敗の帯（欄ごと読めなかった顔）の数と、帯・「やり直す」がどの欄のものか（1つずつの時だけ名前） */
    boxBars: [...box.querySelectorAll('.crl[data-state="error"]')].filter(vis).length,
    barIn: ((x) => (x.length === 1 ? x[0].getAttribute('data-live') : null))([...box.querySelectorAll('.crl[data-state="error"]')].filter(vis)),
    retryIn: ((x) => (x.length === 1 ? x[0].closest('.crl').getAttribute('data-live') : null))([...box.querySelectorAll('.crl-retry')].filter(vis)),
    html: (document.querySelector('#cr [data-view="compare"]') || {}).outerHTML || '', store: store.join('\n'),
  };
}, SUM_SEL, REV_BOX);
const sumDone = (page, want) => settled(page, 'cmp-summary', want);
const pressSumRetry = async (page) => {
  const h = await page.evaluateHandle((REV_BOX) => [...document.querySelectorAll(`${REV_BOX} .crl-retry`)]
    .find((x) => x.getClientRects().length && x.getBoundingClientRect().height > 1) || null, REV_BOX);
  const b = h.asElement();
  if (!b) return false;
  await b.focus();
  await page.keyboard.press('Enter');
  return true;
};
const sumCalls = (st, n0 = 0) => st.calls.slice(n0).filter((c) => c.name === 'pv_review_summary').map((c) => (c.p && c.p.airline) || '?');
const revCalls = (st, n0 = 0) => st.calls.slice(n0).filter((c) => c.name === 'pv_reviews').map((c) => (c.p && c.p.airlines ? c.p.airlines[0] : '?'));
/* 評価の欄に抜粋の行（鍵の無い人の返事 ── 錠前の1行と口コミの Give & Get が出る）を作るための、字のある行 */
const RATED_CLIPS = {
  jal: [...FIX.JAL.slice(0, 2), lockedRow('jc1', '2026-10-02T00:00:00Z', 'ops', 'CLIP-SUM 運航の段取りは丁寧。')],
  ana: FIX.ANA,
};

scene('sumopen', '[B] 要約が2社とも開いている：見出しは1回・各社 良い点と気になる点を2つまで（3つ目は出さない）・足元・欄の中にリンクを置かない', 'mock', async () => {
  for (const size of ['pc', 'sp']) {
    const { page } = await open(size, { url: PAIR_URL('jal', 'ana'), stub: {
      pv_reviews: reviewsBy({ jal: FIX.JAL, ana: FIX.ANA }), pv_review_summary: sumBy({ jal: SUM_OPEN('JAL'), ana: SUM_OPEN('ANA') }) } });
    ok(await sumDone(page, 'jal|ana'), `（${size}）要約の欄が読み終わった`);
    const F = await sumFace(page), [A, B] = F && F.cells.length === 2 ? F.cells : [{}, {}];
    ok(!!F && F.state === 'open' && JSON.stringify(F.titles) === JSON.stringify([SUMW.title]),
      `（${size}）欄は開いた顔・見出し「${SUMW.title}」は1回だけ`, JSON.stringify(F && { state: F.state, titles: F.titles }));
    const two = (c, co) => c.tag === NAME[co.toLowerCase()] && c.shown && JSON.stringify(c.good) === JSON.stringify([`${co} 良い点その一`, `${co} 良い点その二`])
      && JSON.stringify(c.concern) === JSON.stringify([`${co} 気になる点その一`]) && JSON.stringify(c.foot) === JSON.stringify(SUMW.foot);
    ok(two(A, 'JAL') && two(B, 'ANA') && !F.seen.some((t) => t.includes('その三')),
      `（${size}）各社の札の下に、良い点はその一・その二（その三は出さない）・気になる点はその一・足元「${SUMW.foot.join('」「')}」`, JSON.stringify(F && F.cells));
    ok(!!F && F.links === 0, `（${size}）要約の欄の中にリンク（矢印・入口）は1つも無い`, String(F && F.links));
    await shots(page, size);
  }
});

scene('sumlogin', 'ログインしていない人：要約の欄は1行「ログインが必要です」と「ログイン」1つだけ（会社ごとのマスを描かない）・評価の読み込みを待たない', 'mock', async () => {
  const { page, st } = await open('pc', { url: PAIR_URL('jal', 'ana'), holdIf: (name) => name === 'pv_reviews',
    stub: { pv_reviews: reviewsBy(RATED_CLIPS), pv_review_summary: sumBy({ jal: { ok: true, state: 'login' }, ana: { ok: true, state: 'few' } }) } });
  ok(await sumDone(page, 'jal|ana'), '要約の欄が読み終わった（口コミの行の読みは止めたまま）');
  const s0 = await slot(page, 'cmp-stars'), F = await sumFace(page);
  ok(!!s0 && s0.state === 'loading' && (st.held.pv_reviews || []).length >= 1, '（前提）評価の欄は、止めた口コミの行を待っている', JSON.stringify(s0 && s0.state));
  ok(!!F && F.state === 'locked' && JSON.stringify(F.why) === '["login"]' && F.cells.length === 0 && JSON.stringify(F.seen) === JSON.stringify([SUMW.login, 'ログイン']),
    `要約の欄は1行「${SUMW.login}」と「ログイン」だけ（会社ごとのマス・社名の札・数・文を描かない）`, JSON.stringify(F && { state: F.state, why: F.why, seen: F.seen, cells: F.cells.length }));
  const back = F && F.boxLogin.length === 1 ? loginTo(F.boxLogin[0]) : null;
  ok(!!F && F.boxLogin.length === 1 && back === 'career.html?view=compare&a=jal&b=ana',
    '口コミの箱の「ログイン」は1つだけ・押すと同じ2社の比較へ戻る', JSON.stringify(F && { login: F.boxLogin, back }));
  /* 止めておいた口コミの行（鍵の無い人の返事 ── 抜粋つき）を、聞かれた会社ごとの返事で流す：評価の欄の錠前の1行は、要約の欄の1行と重ねない */
  st.holdIf = null;
  for (const r of (st.held.pv_reviews || []).splice(0)) {
    let p = null;
    try { const b = JSON.parse(r.postData() || 'null'); p = b && typeof b === 'object' && 'p' in b ? b.p : b; } catch { p = null; }
    const x = reviewsBy(RATED_CLIPS)(p);
    await r.respond({ status: x.status, contentType: 'application/json; charset=utf-8', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(x.body) });
  }
  ok(await settled(page, 'cmp-stars', 'jal|ana'), '止めていた口コミの行が届き、評価の欄が読み終わった');
  const G = await sumFace(page);
  ok(!!G && JSON.stringify(G.boxLocks) === JSON.stringify([SUMW.login]) && G.boxLogin.length === 1 && G.boxGG === 1,
    `口コミの箱に見えている錠前の1行は「${SUMW.login}」の1つだけ・「ログイン」1つ・口コミの Give & Get 1つ`, JSON.stringify(G && { locks: G.boxLocks, login: G.boxLogin, gg: G.boxGG }));
});

scene('sumkey', '口コミの鍵の無い会員（給与の鍵は在る）：要約の欄は1行「要約は口コミの投稿で開きます」だけ・リンク0・返事に植えた点は画面にも保存領域にも出ない', 'mock', async () => {
  const P = H.payFix.open([H.payRowFix('jal')], [H.payRowFix('ana')]);
  const { page } = await open('pc', { who: 'pay', url: PAIR_URL('jal', 'ana'), stub: {
    pv_reviews: reviewsBy(RATED_CLIPS), pv_review_summary: () => ({ status: 200, body: SUM_LEAK }),
    pv_pay_rows: () => ({ status: 200, body: P }) } });
  ok(await sumDone(page, 'jal|ana') && await settled(page, 'cmp-stars', 'jal|ana') && await settled(page, 'cmp-pay', 'jal|ana'), '要約・評価・提出された年収の欄が読み終わった');
  const pay = await slot(page, 'cmp-pay');
  ok(!!pay && pay.state === 'open', '（前提）この人の給与の鍵は開いている（提出された年収の欄が開いた顔）', pay && pay.state);
  const F = await sumFace(page);
  ok(!!F && F.state === 'locked' && JSON.stringify(F.why) === '["key"]' && JSON.stringify(F.seen) === JSON.stringify([SUMW.key]) && F.cells.length === 0,
    `要約の欄は1行「${SUMW.key}」だけ（給与の鍵では開かない）`, JSON.stringify(F && { state: F.state, why: F.why, seen: F.seen }));
  ok(!!F && F.links === 0 && JSON.stringify(F.boxLocks) === JSON.stringify([SUMW.key]) && F.boxGG === 1,
    '要約の欄にリンクは0・口コミの箱に見えている錠前の1行はこの1つだけ（評価の欄の同じ意味の1行を重ねない）・入口は口コミの Give & Get 1つ', JSON.stringify(F && { links: F.links, locks: F.boxLocks, gg: F.boxGG }));
  ok(!!F && !F.html.includes('LEAK-') && !F.store.includes('LEAK-'), '鍵の無い人への返事に植えた点（LEAK-）は、画面のどこにも保存領域にも出ない',
    JSON.stringify({ html: F && F.html.includes('LEAK-'), store: F && F.store.includes('LEAK-') }));
});

scene('sumtwo', '別のタブで読む人が替わる：口コミの鍵のある人の要約 → 給与だけの会員の1行 → ログアウトの1行（前の人の文は1字も残らない）', 'mock', async () => {
  const stub = { pv_reviews: reviewsBy({ jal: FIX.JAL, ana: FIX.ANA }),
    pv_review_summary: (p, auth) => {
      const w = whoOf(auth);
      if (w === 'a') return { status: 200, body: SUM_OPEN(p && p.airline === 'jal' ? 'JAL' : 'ANA') };
      return { status: 200, body: { ok: true, state: w === 'anon' ? 'login' : 'locked' } };
    } };
  const { page, st, ctx } = await open('pc', { who: 'a', url: PAIR_URL('jal', 'ana'), stub });
  ok(await sumDone(page, 'jal|ana'), '口コミの鍵のある人（会員 a）として、要約の欄が読み終わった');
  const F0 = await sumFace(page);
  const MINE_TXT = ['JAL 良い点その一', 'ANA 良い点その一', 'JAL 気になる点その一', '会員の口コミ 3件から'];
  ok(!!F0 && F0.state === 'open' && MINE_TXT.every((t) => F0.seen.includes(t)), '切り替える前：会員 a の要約が出ている（確かめが空振りしていない）', JSON.stringify(F0 && F0.seen));
  await H.watch(page, 'cmp-summary');
  const mark = await page.evaluate(() => { window.__crlNoReload = 1; return (window.__crlSeen || []).length; });
  const n0 = st.calls.length;
  const t = await H.otherTab(ctx, CUR.env.local);
  await H.loginIn(t, CUR.env.local, 'pay');
  const turned = await until(page, ([sel, line]) => { const b = document.querySelector(sel); return !!b && b.getAttribute('data-state') === 'locked' && b.innerText.trim() === line; }, [SUM_SEL, SUMW.key]);
  const F1 = await sumFace(page);
  const after = st.calls.slice(n0).filter((c) => c.name === 'pv_review_summary');
  ok(turned && !!F1 && JSON.stringify(F1.seen) === JSON.stringify([SUMW.key]) && after.length === 2 && after.every((c) => whoOf(c.auth) === 'pay'),
    `別のタブで給与だけの会員（pay）が入ると、読み込み直さずに「${SUMW.key}」の1行へ（2社とも pay のログインで聞き直した）`,
    JSON.stringify({ turned, seen: F1 && F1.seen, after: after.map((c) => `${c.p && c.p.airline}:${whoOf(c.auth)}`) }));
  const left = (await H.seen(page)).slice(mark).filter((s) => MINE_TXT.some((x) => s.includes(x)));
  ok(left.length === 0 && !!F1 && !MINE_TXT.some((x) => F1.html.includes(x) || F1.store.includes(x)),
    '切り替えたあと要約の欄が取ったどの顔にも、画面にも保存領域にも、会員 a の文は1字も無い', JSON.stringify(left.slice(0, 4)));
  await H.logoutIn(t);
  const out = await until(page, ([sel, line]) => { const b = document.querySelector(sel); return !!b && b.getAttribute('data-state') === 'locked' && b.innerText.trim().startsWith(line); }, [SUM_SEL, SUMW.login]);
  const F2 = await sumFace(page);
  ok(out && !!F2 && JSON.stringify(F2.seen) === JSON.stringify([SUMW.login, 'ログイン']) && await page.evaluate(() => window.__crlNoReload === 1),
    `別のタブでログアウトすると、読み込み直さずに「${SUMW.login}」と「ログイン」へ`, JSON.stringify({ out, seen: F2 && F2.seen }));
  await t.close();
});

scene('sumoff', '要約の関数がまだ無い（PGRST202 が2社とも）：点数の付いた2社の下に「準備中」を1回だけ・数字なし／投稿の無い2社の下には何も見せない', 'mock', async () => {
  const { page } = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FIX.JAL, ana: FIX.ANA }), pv_review_summary: () => SUM_NOFN } });
  ok(await sumDone(page, 'jal|ana') && await settled(page, 'cmp-stars', 'jal|ana'), '（JAL・ANA：どちらも点数あり）要約と評価の欄が読み終わった');
  const F = await sumFace(page);
  ok(!!F && JSON.stringify(F.seen) === JSON.stringify([SUMW.off]) && JSON.stringify(F.why) === '["off"]' && F.cells.length === 0,
    `「${SUMW.off}」が1回だけ（会社ごとに繰り返さない・社名の札を付けない）`, JSON.stringify(F && { seen: F.seen, why: F.why, cells: F.cells.length }));
  ok(!!F && !F.seen.join('').match(/\d/), '要約の欄に数字が1つも無い（「0件」にしない）', JSON.stringify(F && F.seen));
  for (const [a, b, what] of [['eva-air', 'etihad', '点数の無い投稿だけ・投稿なし'], ['jal', 'etihad', '2社とも投稿なし（淡い6角形の格子）']]) {
    const e = await open('pc', { url: PAIR_URL(a, b), stub: { pv_reviews: reviewsBy({ 'eva-air': FIX.EVA, etihad: FIX.ETD, jal: [] }), pv_review_summary: () => SUM_NOFN } });
    ok(await sumDone(e.page, `${a}|${b}`) && await settled(e.page, 'cmp-stars', `${a}|${b}`), `（${what}）要約と評価の欄が読み終わった`);
    const G = await sumFace(e.page);
    ok(!!G && G.seen.length === 0 && G.h === 0, `（${what}）要約の欄は何も見せない（高さ 0）`, JSON.stringify(G && { seen: G.seen, h: G.h, state: G.state }));
  }
});

scene('sumquiet', '[B] 要約の静かな1行：点数の付いた2社の下に出す・同じ文なら1回・違えば会社ごと・点数の無い会社の下には出さない', 'mock', async () => {
  const S = (j, a) => sumBy({ jal: { ok: true, state: j }, ana: { ok: true, state: a }, 'eva-air': { ok: true, state: j }, etihad: { ok: true, state: a } });
  const ROWS = { jal: FIX.JAL, ana: FIX.ANA, 'eva-air': FIX.EVA, etihad: FIX.ETD };
  for (const size of ['pc', 'sp']) {
    const { page } = await open(size, { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy(ROWS), pv_review_summary: S('few', 'few') } });
    ok(await sumDone(page, 'jal|ana') && await settled(page, 'cmp-stars', 'jal|ana'), `（JAL・ANA 2社とも少ない・${size}）読み終わった`);
    const F = await sumFace(page);
    ok(!!F && JSON.stringify(F.seen) === JSON.stringify([SUMW.few]) && F.cells.length === 0, `（${size}）「${SUMW.few}」を1回だけ・社名の札なし`, JSON.stringify(F && F.seen));
  }
  const two = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy(ROWS), pv_review_summary: S('none', 'few') } });
  ok(await sumDone(two.page, 'jal|ana') && await settled(two.page, 'cmp-stars', 'jal|ana'), '（JAL まだ無い・ANA 少ない）読み終わった');
  const T2 = await sumFace(two.page), [A, B] = T2 && T2.cells.length === 2 ? T2.cells : [{}, {}];
  ok(A.shown && B.shown && JSON.stringify(A.seen) === JSON.stringify([NAME.jal, SUMW.none]) && JSON.stringify(B.seen) === JSON.stringify([NAME.ana, SUMW.few]),
    '違う文なら会社ごと：JAL の札の下に「まだありません」・ANA の札の下に「少ないため」', JSON.stringify(T2 && T2.cells));
  const ev = await open('pc', { url: PAIR_URL('eva-air', 'etihad'), stub: { pv_reviews: reviewsBy(ROWS), pv_review_summary: S('few', 'few') } });
  ok(await sumDone(ev.page, 'eva-air|etihad') && await settled(ev.page, 'cmp-stars', 'eva-air|etihad'), '（エバー 点数の無い投稿だけ・エティハド 投稿なし）読み終わった');
  const E = await sumFace(ev.page);
  ok(!!E && E.seen.length === 0 && E.h === 0, '点数の付いた投稿が2社とも無ければ、要約の欄は何も見せない（高さ 0）', JSON.stringify(E && { seen: E.seen, h: E.h }));
  const je = await open('pc', { url: PAIR_URL('jal', 'etihad'), stub: { pv_reviews: reviewsBy({ jal: FIX.JAL, etihad: [] }), pv_review_summary: S('none', 'few') } });
  ok(await sumDone(je.page, 'jal|etihad') && await settled(je.page, 'cmp-stars', 'jal|etihad'), '（JAL 点数あり・エティハド 投稿なし）読み終わった');
  const JE = await sumFace(je.page), [JA, JB] = JE && JE.cells.length === 2 ? JE.cells : [{}, {}];
  ok(JA.shown && JSON.stringify(JA.seen) === JSON.stringify([NAME.jal, SUMW.none]) && JB.shown === false,
    'JAL の札の下には「まだありません」・投稿の無いエティハドの文は出さない', JSON.stringify(JE && JE.cells));
});

scene('sumfail', '[B] 要約が読めない：片方なら その会社の札と「いま読み出せません」・もう片方は出す・「やり直す」は箱に1つ（押すと読めなかった方だけ聞き直す）', 'mock', async () => {
  const { page, st } = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FIX.JAL, ana: FIX.ANA }),
    pv_review_summary: sumBy({ jal: SUM_FAIL, ana: SUM_OPEN('ANA') }) } });
  ok(await sumDone(page, 'jal|ana') && await settled(page, 'cmp-stars', 'jal|ana'), '（JAL の要約だけ 500）読み終わった');
  const F = await sumFace(page), [A, B] = F && F.cells.length === 2 ? F.cells : [{}, {}];
  ok(!!F && F.state === 'open' && F.part === '1' && JSON.stringify(A.seen) === JSON.stringify([NAME.jal, SUMW.err]) && B.good.length === 2,
    'JAL の札の下に「いま読み出せません」・ANA の要約はいつもどおり', JSON.stringify(F && { state: F.state, part: F.part, A: A.seen, B: B.good }));
  ok(!!F && F.boxRetries === 1, '口コミの箱に見えている「やり直す」は1つ', String(F && F.boxRetries));
  st.stub.pv_review_summary = sumBy({ jal: SUM_OPEN('JAL'), ana: SUM_OPEN('ANA') });
  const n0 = st.calls.length;
  ok(await pressSumRetry(page), '「やり直す」をキーボードで押した');
  ok(await until(page, (sel) => { const b = document.querySelector(sel); return !!b && b.getAttribute('data-state') === 'open' && !b.getAttribute('data-part')
    && b.innerText.includes('JAL 良い点その一'); }, SUM_SEL), 'JAL の要約が埋まった');
  ok(JSON.stringify(sumCalls(st, n0)) === '["jal"]' && revCalls(st, n0).length === 0, '聞き直したのは JAL の要約だけ（ANA の要約・口コミの行は聞かない）',
    JSON.stringify({ sum: sumCalls(st, n0), rev: revCalls(st, n0) }));
  /* 2社とも評価も要約も読めない → 箱に見える失敗の帯と「やり直す」は1つずつ（狭い画面と広い画面で1回ずつ） */
  for (const size of ['pc', 'sp']) {
    const f = await open(size, { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FAIL500, ana: FAIL500 }), pv_review_summary: () => SUM_FAIL } });
    ok(await sumDone(f.page, 'jal|ana') && await settled(f.page, 'cmp-stars', 'jal|ana'), `（2社とも全部 500・${size}）読み終わった`);
    const G = await sumFace(f.page);
    ok(!!G && G.state === 'error' && G.boxErrs === 1 && G.boxRetries === 1 && G.h === 0,
      `（${size}）口コミの箱に見える「いま読み出せません」と「やり直す」は1つずつ（要約の欄の失敗は評価の欄の帯に畳む）`, JSON.stringify(G && { state: G.state, errs: G.boxErrs, retries: G.boxRetries, h: G.h }));
  }
  /* 混ざった失敗（片方の欄は2社とも・もう片方は1社だけ読めない）→ 箱に見える失敗の帯は1本・「やり直す」はその帯の1つだけ
     （1社だけ読めなかった会社の所の「いま読み出せません」はそのまま）。狭い画面と広い画面で1回ずつ */
  const MIX = {
    '評価は2社とも・要約は JAL だけ読めない': { pv_reviews: reviewsBy({ jal: FAIL500, ana: FAIL500 }), pv_review_summary: sumBy({ jal: SUM_FAIL, ana: SUM_OPEN('ANA') }) },
    '評価は JAL だけ・要約は2社とも読めない': { pv_reviews: reviewsBy({ jal: FAIL500, ana: FIX.ANA }), pv_review_summary: () => SUM_FAIL },
  };
  const mixed = [];
  for (const [what, stub] of Object.entries(MIX)) {
    for (const size of ['pc', 'sp']) {
      const f = await open(size, { url: PAIR_URL('jal', 'ana'), stub });
      const done = await sumDone(f.page, 'jal|ana') && await settled(f.page, 'cmp-stars', 'jal|ana');
      const G = await sumFace(f.page);
      mixed.push({ what, size, done, bars: G && G.boxBars, retries: G && G.boxRetries, bar: G && G.barIn, retry: G && G.retryIn });
    }
  }
  ok(mixed.every((m) => m.done && m.bars === 1 && m.retries === 1 && m.retry === m.bar),
    '混ざった失敗（評価は2社とも・要約は1社だけ／評価は1社だけ・要約は2社とも）でも、口コミの箱に見える失敗の帯は1本・「やり直す」はその帯の1つだけ', J(mixed));
  /* JAL だけ両方読めない → JAL の列に各欄1回ずつ・「やり直す」は箱に1つ・押すと JAL の2つを聞き直す */
  const j = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FAIL500, ana: FIX.ANA }),
    pv_review_summary: sumBy({ jal: SUM_FAIL, ana: SUM_OPEN('ANA') }) } });
  ok(await sumDone(j.page, 'jal|ana') && await settled(j.page, 'cmp-stars', 'jal|ana'), '（JAL だけ評価も要約も 500）読み終わった');
  const J1 = await sumFace(j.page);
  ok(!!J1 && J1.boxErrs === 2 && J1.boxRetries === 1, 'JAL の列に「いま読み出せません」が欄ごとに1回（評価と要約）・見えている「やり直す」は1つ', JSON.stringify(J1 && { errs: J1.boxErrs, retries: J1.boxRetries }));
  j.st.stub.pv_reviews = reviewsBy({ jal: FIX.JAL, ana: FIX.ANA });
  j.st.stub.pv_review_summary = sumBy({ jal: SUM_OPEN('JAL'), ana: SUM_OPEN('ANA') });
  const m0 = j.st.calls.length;
  ok(await pressSumRetry(j.page), '「やり直す」をキーボードで押した');
  ok(await until(j.page, (sel) => { const b = document.querySelector(sel); return !!b && b.getAttribute('data-state') === 'open' && !b.getAttribute('data-part'); }, SUM_SEL)
    && await settled(j.page, 'cmp-stars', 'jal|ana'), '評価と要約が埋まった');
  ok(JSON.stringify(sumCalls(j.st, m0)) === '["jal"]' && JSON.stringify(revCalls(j.st, m0)) === '["jal"]', '聞き直したのは JAL の2つだけ（要約と口コミの行）',
    JSON.stringify({ sum: sumCalls(j.st, m0), rev: revCalls(j.st, m0) }));
});

/* 口コミの鍵のある人の読む枠（2026-10-22 オーナー P12.97「投稿済みの人はそのカードで他の人の投稿スクロール可能にして」）。
   返事は送ってきたログインで決める：会員 a（口コミの鍵）だけ本文つき（unlocked）・ほかの人は鍵の無い返事。鍵の無い返事にも本文の列を
   わざと植えておく（KEY-PLANT）── 画面はサーバーの1語（unlocked）で決め、列の有る無しで決めない */
const KEYM = (co, i) => `KEYBODY-${co}-${i}`;
const keyRow = (co, i) => row(`${co}${i}`, NUL, { created_at: `2026-${String(10 - Math.floor(i / 3)).padStart(2, '0')}-${String(25 - i).padStart(2, '0')}T00:00:00Z`,
  cats: undefined, clip: undefined, training_comment: `${KEYM(co, i)} 訓練は丁寧で、教官の質も高い。`, wlb_comment: i % 2 ? `${KEYM(co, i)}w 休みは取りやすい。` : null });
const KEY_ROWS = { jal: Array.from({ length: 12 }, (_, i) => keyRow('J', i)), ana: [keyRow('A', 0), keyRow('A', 1)] };
const KEYLESS = { jal: [lockedRow('jk1', '2026-10-01T00:00:00Z', 'training', 'CLIPKEY-J1 訓練は丁寧で…', ['training']),
  { ...lockedRow('jk2', '2026-09-01T00:00:00Z', 'wlb', 'CLIPKEY-J2 休みは…', ['wlb']), wlb_comment: 'KEY-PLANT 鍵の無い返事に植えた本文' }],
ana: [lockedRow('ak1', '2026-10-01T00:00:00Z', 'ops', 'CLIPKEY-A1 運航は…', ['ops'])] };
const keyStub = (p, auth) => {
  const a = p && Array.isArray(p.airlines) ? p.airlines[0] : '';
  const k = whoOf(auth) === 'a';
  return { status: 200, body: { ok: true, unlocked: k, rows: (k ? KEY_ROWS : KEYLESS)[a] || [] } };
};
const RV_SEL = '#cr [data-view="compare"] .crl[data-live="cmp-stars"] .crl-rate-rv';
const rvFace = (page) => page.evaluate((RV_SEL, REV_BOX) => {
  const rv = document.querySelector(RV_SEL), box = document.querySelector(REV_BOX);
  const store = [];
  for (const S of [localStorage, sessionStorage]) for (let i = 0; i < S.length; i++) { const k = S.key(i); store.push(`${k}=${S.getItem(k)}`); }
  const regions = rv ? [...rv.querySelectorAll('.crl-rv-scroll')].map((r) => ({ role: r.getAttribute('role'), label: r.getAttribute('aria-label'), tab: r.tabIndex,
    scroll: getComputedStyle(r).overflowY, items: [...r.querySelectorAll('.crl-rev')].map((li) => ({ when: (li.querySelector('.crl-rev-when') || {}).textContent || '',
      text: [...li.querySelectorAll('.crl-rev-text')].map((x) => x.textContent) })),
    more: [...r.querySelectorAll('button')].map((b) => b.textContent.trim()) })) : [];
  const a = document.activeElement;
  return { regions, clips: rv ? [...rv.querySelectorAll('.crl-rev-clip')].map((x) => x.textContent) : [],
    gg: box ? box.querySelectorAll('a.pv-gg').length : 0, locks: box ? box.querySelectorAll('.crl-lock').length : 0,
    focus: a && a.matches && a.matches('.crl-rev') ? [...a.closest('.crl-rv-scroll').querySelectorAll('.crl-rev')].indexOf(a) : (a ? a.tagName : null),
    html: (document.querySelector('#cr [data-view="compare"]') || {}).outerHTML || '', store: store.join('\n') };
}, RV_SEL, REV_BOX);
const anyKey = (s) => /KEYBODY-|KEY-PLANT/.test(s);

scene('revkey', '口コミの鍵のある人は会社のマスの中で本文をスクロールして読める（新しい順・5件ずつ・キーボードで）── 鍵の無い人・給与の鍵だけの人には本文が1字も出ない・読む人が替わったら消える', 'mock', async () => {
  const P = H.payFix.open([H.payRowFix('jal')], [H.payRowFix('ana')]);
  /* 鍵の無い2人：ゲストと、給与の鍵だけの会員（pay） */
  for (const who of [null, 'pay']) {
    const label = who ? '給与の鍵だけの会員（pay）' : 'ゲスト';
    const { page, st } = await open('pc', { who, url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: keyStub, pv_pay_rows: () => ({ status: 200, body: who ? P : H.payFix.guest() }) } });
    ok(await settled(page, 'cmp-stars', 'jal|ana') && await settled(page, 'cmp-pay', 'jal|ana'), `（${label}）口コミと提出された年収の欄が読み終わった`);
    const pay = await slot(page, 'cmp-pay'), R = await rvFace(page);
    if (who) ok(!!pay && pay.state === 'open', '（前提）この人の給与の鍵は開いている（提出された年収の欄が開いた顔）', pay && pay.state);
    ok(R.regions.length === 0 && JSON.stringify(R.clips) === JSON.stringify(['CLIPKEY-J1 訓練は丁寧で…', 'CLIPKEY-J2 休みは…', 'CLIPKEY-A1 運航は…']) && R.gg === 1,
      `（${label}）読む枠は無い・出るのはサーバーの抜粋だけ（JAL 2件・ANA 1件）と、口コミの Give & Get 1つ`, JSON.stringify({ regions: R.regions.length, clips: R.clips, gg: R.gg }));
    const sent = st.calls.map((c) => JSON.stringify(c.p || '')).join(' ');
    ok(!anyKey(R.html) && !anyKey(R.store) && !anyKey(sent), `（${label}）本文（返事にわざと植えた列も）は、画面にも保存領域にも、ページが送った要求にも1字も無い`,
      JSON.stringify({ html: anyKey(R.html), store: anyKey(R.store), sent: anyKey(sent) }));
  }
  /* 口コミの鍵のある会員 a */
  const { page, st, ctx } = await open('pc', { who: 'a', url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: keyStub } });
  ok(await settled(page, 'cmp-stars', 'jal|ana'), '（口コミの鍵のある会員 a）口コミの欄が読み終わった');
  const K = await rvFace(page), [RJ, RA] = K.regions.length === 2 ? K.regions : [{}, {}];
  const want = (co, n) => KEY_ROWS[co].slice(0, n).map((r) => r.training_comment);
  ok(K.regions.length === 2 && RJ.role === 'region' && RJ.label === NAME.jal && RJ.tab === 0 && RA.label === NAME.ana && ['auto', 'scroll'].includes(RJ.scroll),
    '会社ごとに読む枠が1つ（スクロールできる・キーボードで入れる・読み上げは会社の名前の区切り）', JSON.stringify(K.regions.map((r) => ({ ...r, items: r.items && r.items.length }))));
  ok((RJ.items || []).length === 5 && JSON.stringify(RJ.items.map((x) => x.text[0])) === JSON.stringify(want('jal', 5))
    && RJ.items.every((x, i) => x.text.length === (i % 2 ? 2 : 1)) && JSON.stringify(RJ.more) === '["続きを見る（全12件）"]',
  'JAL：新しい順に5件・本文は書かれた区分を全部（切らない）・続きは「続きを見る（全12件）」', JSON.stringify({ items: RJ.items, more: RJ.more }));
  ok((RA.items || []).length === 2 && (RA.more || []).length === 0 && K.gg === 0 && K.locks === 0,
    'ANA：2件で全部（続きのボタンなし）・鍵のある人には錠前の1行も Give & Get も出さない', JSON.stringify({ ana: RA.items && RA.items.length, more: RA.more, gg: K.gg, locks: K.locks }));
  const more = async () => { const b = await page.$(`${RV_SEL} .crl-rv-scroll button`); if (!b) return false; await b.focus(); await page.keyboard.press('Enter'); return true; };
  ok(await more(), '「続きを見る（全12件）」をキーボードで押した');
  const K2 = await rvFace(page);
  ok(K2.regions[0].items.length === 10 && K2.focus === 5 && JSON.stringify(K2.regions[0].items.map((x) => x.text[0])) === JSON.stringify(want('jal', 10)),
    '次の5件が新しい順のまま続き、フォーカスは新しく出た1件目へ', JSON.stringify({ n: K2.regions[0].items.length, focus: K2.focus }));
  ok(await more(), 'もう一度押した');
  const K3 = await rvFace(page);
  ok(K3.regions[0].items.length === 12 && K3.regions[0].more.length === 0 && K3.focus === 10, '12件で全部・ボタンは消え、フォーカスは11件目へ', JSON.stringify({ n: K3.regions[0].items.length, more: K3.regions[0].more, focus: K3.focus }));
  ok(!anyKey(K3.store), '読んだ本文は保存領域に入らない', '');
  /* 読む人が替わる（別のタブで、給与の鍵だけの会員 pay が入る）→ 読み込み直さずに、本文の枠が消えて抜粋へ */
  await H.watch(page, 'cmp-stars');
  const mark = await page.evaluate(() => { window.__crlNoReload = 1; return (window.__crlSeen || []).length; });
  const n0 = st.calls.length;
  const t = await H.otherTab(ctx, CUR.env.local);
  await H.loginIn(t, CUR.env.local, 'pay');
  const gone = await until(page, ([sel, rv]) => { const b = document.querySelector(sel); return !!b && b.getAttribute('data-state') === 'open'
    && !!document.querySelector(rv) && !document.querySelector(`${rv} .crl-rv-scroll`) && !!document.querySelector(`${rv} .crl-rev-clip`); },
  ['#cr [data-view="compare"] .crl[data-live="cmp-stars"]', RV_SEL]);
  const Z = await rvFace(page);
  const asked = st.calls.slice(n0).filter((c) => c.name === 'pv_reviews');
  ok(gone && Z.regions.length === 0 && asked.length === 2 && asked.every((c) => whoOf(c.auth) === 'pay'),
    '別のタブで pay が入ると、読み込み直さずに読む枠が消えて抜粋へ（2社の口コミを pay のログインで聞き直した）', JSON.stringify({ gone, regions: Z.regions.length, asked: asked.map((c) => whoOf(c.auth)) }));
  const left = (await H.seen(page)).slice(mark).filter((s) => anyKey(s));
  ok(left.length === 0 && !anyKey(Z.html) && !anyKey(Z.store) && await page.evaluate(() => window.__crlNoReload === 1),
    '入れ替わったあと、評価の欄が取ったどの顔にも、画面にも保存領域にも、会員 a が読んだ本文は1字も無い', JSON.stringify(left.slice(0, 3)));
  await t.close();
});

/* 欄ごとの「やり直す」（refocus）── 返事を待つあいだに読み手が自分で別の所へ動いたら、届いた時に引き戻さない（cmp-pay-5 の medBack と同じ守り） */
scene('refocus', '[B] 「やり直す」を押して待つあいだに読み手が動いた先から、届いた時にフォーカスを引き戻さない', 'mock', async () => {
  const { page, st } = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: { pv_reviews: reviewsBy({ jal: FAIL500, ana: FIX.ANA }) } });
  ok(await settled(page, 'cmp-stars', 'jal|ana'), '（JAL が読めない）口コミの欄が読み終わった');
  st.stub.pv_reviews = reviewsBy({ jal: FIX.JAL, ana: FIX.ANA });
  st.holdIf = (name, p) => name === 'pv_reviews' && !!p && Array.isArray(p.airlines) && p.airlines[0] === 'jal';
  ok(await pressRetry(page), '「やり直す」をキーボードで押した');
  ok(await waitFor(() => (st.held.pv_reviews || []).length === 1), 'JAL の口コミの読みを止めた（答えを待っている）');
  await page.focus('#cr-a');
  st.holdIf = null;
  release(st, 'pv_reviews', { status: 200, body: { ok: true, unlocked: false, rows: FIX.JAL } });
  ok(await until(page, () => { const c = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"] .crl-cmp-c .crl-avg'); return !!c && c.textContent === '3.5'; }),
    'JAL のマスが埋まった（3.5）');
  const at = await page.evaluate(() => (document.activeElement && document.activeElement.id) || (document.activeElement && document.activeElement.tagName));
  ok(at === 'cr-a', '[B] 待つあいだに読み手が移った先（1社目を選ぶ欄）に、フォーカスはそのまま', String(at));
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
  err: 'いま読み出せません', retry: 'やり直す', off: '準備中',
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

/* ── 給与の区域：選び直す・通貨を替える・読めない・返事が来ない（WP-cmp-pay-5。どれも MOCK）────────────
   中央値の答えは、組ごとに字の違う2つ（人数の下限と期間が違う ＝ 定義の1行（C-3）を読めば、どちらの組の答えか分かる）。
     jal|ana     2つの職位とも2社の額（4つ）・下限 7・2023年1月〜2024年12月
     jal|etihad  JAL の機長だけ額（ほかは人数が足りない）・下限 3・2024年10月〜2026年9月 */
const ROWS5 = ['jal', 'ana', 'etihad', 'eva-air', 'cathay-pacific'].flatMap((s) => [PRF(s), PRF(s, { pos: 'fo' })]);
const MED_P1 = { ok: true, state: 'open', period: { from: '2023-01', to: '2024-12' }, floor: 7, airlines: {
  jal: { cap: { s: 'ok', median_usd: 314159 }, fo: { s: 'ok', median_usd: 161803 } }, ana: { cap: { s: 'ok', median_usd: 141421 }, fo: { s: 'ok', median_usd: 173205 } } } };
const MED_P2 = { ok: true, state: 'open', period: { from: '2024-10', to: '2026-09' }, floor: 3, airlines: {
  jal: { cap: { s: 'ok', median_usd: 271828 }, fo: { s: 'few' } }, etihad: { cap: { s: 'few' }, fo: { s: 'few' } } } };
const DEF_P1 = W_PAY.c3('2023年1月', '2024年12月', 7), DEF_P2 = W_PAY.c3('2024年10月', '2026年9月', 3);
const NOFN_PAY = (fn, status = 404) => ({ status, body: { code: 'PGRST202', details: null, hint: null, message: `Could not find the function public.${fn}` } });
/* 中央値の返事を、聞かれた2社の組（並びを問わない）で選ぶ。表に無い組には開いていない答え（何も描かない） */
const pairKey = (p) => (p && Array.isArray(p.airlines) ? p.airlines.slice().sort().join('|') : '');
const medBy = (map) => (p) => ({ status: 200, body: map[pairKey(p)] || { ok: true, state: 'locked' } });
/* 欄が見せている2社：data-for・会社の札・欄の中の data-airline（重ねない）。社名はページの島（#crc-data）の字 */
const pairFace = (page) => page.evaluate((SEL) => {
  const b = document.querySelector(SEL);
  let co = {};
  try { co = JSON.parse(document.getElementById('crc-data').textContent).airlines || {}; } catch (e) { co = {}; }
  return { for: b ? b.getAttribute('data-for') : null, state: b ? b.getAttribute('data-state') : null,
    tags: b ? [...b.querySelectorAll('.crl-cmp > .crl-cmp-head > .crl-co')].map((x) => x.textContent.trim()) : [],
    airlines: b ? [...new Set([...b.querySelectorAll('[data-airline]')].map((x) => x.getAttribute('data-airline')))] : [],
    names: Object.fromEntries(Object.entries(co).map(([k, v]) => [k, v && v.ja])) };
}, PAY_SEL);
const pairOk = (f, want) => {
  const [a, b] = want.split('|');
  return !!f && f.for === want && !!f.names[a] && !!f.names[b] && JSON.stringify(f.tags) === JSON.stringify([f.names[a], f.names[b]])
    && f.airlines.length === 2 && f.airlines.includes(a) && f.airlines.includes(b);
};
const pairOf = (f) => f && { for: f.for, state: f.state, tags: f.tags, airlines: f.airlines };
/* 中央値の器（と、ページ全体の中央値の印）を読む */
const medFace = (page) => page.evaluate((SEL) => {
  const b = document.querySelector(SEL), ag = b && b.querySelector('.crl-agg');
  const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : null);
  return { html: document.documentElement.outerHTML, hidden: !ag || ag.hidden, text: ag ? tx(ag) || '' : '',
    defs: [...document.querySelectorAll('[data-def="median"]')].map((p) => ({ t: tx(p), inAgg: !!ag && ag.contains(p) })),
    meds: [...document.querySelectorAll('[data-med]')].map((r) => ({ k: r.getAttribute('data-med'), inAgg: !!ag && ag.contains(r) })),
    aggs: document.querySelectorAll('[data-agg]').length,
    h: ag ? [...ag.querySelectorAll('h3.crl-agg-h')].map(tx) : [], msg: ag ? [...ag.querySelectorAll('p.crl-msg')].map(tx) : [],
    retry: ag ? [...ag.querySelectorAll('.crl-retry')].map(tx) : [], allRetry: b ? b.querySelectorAll('.crl-retry').length : -1 };
}, PAY_SEL);
const medOf = (M) => M && { ...M, html: undefined };
/* 新しい2社（jal|etihad）の答えだけ：定義の1行は器の中に1つ（その組の字）・中央値の行は JAL の機長の1行・額は1つ */
const onlyP2 = (M) => !!M && M.defs.length === 1 && M.defs[0].inAgg && M.defs[0].t === DEF_P2
  && JSON.stringify(M.meds) === JSON.stringify([{ k: 'cap', inAgg: true }]) && M.aggs === 1;
/* その組の定義の1行が、欄の中に出た */
const medDrawn = (page, def) => until(page, ([SEL, def]) => {
  const b = document.querySelector(SEL);
  return !!b && [...b.querySelectorAll('[data-def="median"]')].some((p) => p.textContent.replace(/\s+/g, ' ').trim() === def);
}, [PAY_SEL, def]);
/* ページが投げた中央値の要求の答えを、全部読み終わった（読み終えたあとの次の順番まで ── PAY_WATCH） */
const medAllRead = (page) => until(page, () => {
  const asked = (window.__payAsked || []).filter((n) => n === 'pv_company_pay').length;
  return asked >= 1 && window.__payRead() >= asked;
});
const callsN = (st, name) => st.calls.filter((c) => c.name === name).length;
/* 欄の「やり直す」（中央値の器の中かどうか） */
const payRetry = (page) => page.evaluate((SEL) => [...document.querySelectorAll(`${SEL} .crl-retry`)]
  .map((x) => ({ t: x.textContent.trim(), inAgg: !!x.closest('.crl-agg'), h: Math.round(x.getBoundingClientRect().height) })), PAY_SEL);
/* その「やり直す」をキーボードで押す（フォーカスの戻り先を見る） */
const pressKey = async (page, sel) => {
  const b = await page.$(sel);
  if (!b) return false;
  await b.focus();
  await page.keyboard.press('Enter');
  return true;
};
/* いまキーボードの居場所（フォーカス）が在るところ */
const focusAt = (page) => page.evaluate((SEL) => {
  const a = document.activeElement, b = document.querySelector(SEL);
  return { tag: a ? a.tagName.toLowerCase() : null, cls: a ? String(a.className) : null, text: a ? a.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : null,
    inSlot: !!(b && a && a !== document.body && b.contains(a)), inAgg: !!(a && a.closest && a.closest('.crl-agg')) };
}, PAY_SEL);
/* --shots：比較の「提出された年収」の箱を撮る（見た目の確かめのため。検査ではない） */
async function payShot(page, size, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const h = await page.$('#cr [data-view="compare"] .cr-subpay[data-kind="submitted"]');
  if (h) await h.screenshot({ path: path.join(SHOTS, `${CUR.key}-${size}-${name}.png`) });
}

scene('pay-move', '給与：選び直し・入れ替えても一覧は1回だけ読む・欄はいつも見えている2社のもの・前の2社へ遅れて届いた答え（一覧・中央値）はどこにも出ない', 'mock', async () => {
  /* M5（B）3回の選び直しと1回の入れ替え */
  const { page, st } = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, stub: { pv_pay_rows: payReply(H.payFix.open(ROWS5)) } });
  ok(await payDone(page, 'jal|ana'), '（jal|ana）給与の欄が読み終わった');
  const STEPS = [['#cr-b', 'etihad', 'jal|etihad'], ['#cr-a', 'eva-air', 'eva-air|etihad'], ['#cr-b', 'cathay-pacific', 'eva-air|cathay-pacific'],
    ['#cr-swap', null, 'cathay-pacific|eva-air']];
  const went = [];
  for (const [sel, v, want] of STEPS) {
    if (v) await page.select(sel, v); else await page.click(sel);
    const done = await payDone(page, want);
    const f = await pairFace(page);
    went.push({ want, ok: done && f.state === 'open' && pairOk(f, want), ...pairOf(f) });
  }
  ok(went.every((x) => x.ok), `[M5][B] 3回の選び直しと1回の入れ替え（${STEPS.map((s) => s[2]).join(' → ')}）：欄はいつも見えている2社（data-for・会社の札・欄の中の data-airline）`,
    JSON.stringify(went));
  const inPage = await page.evaluate(() => (window.__payAsked || []).filter((n) => n === 'pv_pay_rows').length);
  ok(inPage === 1 && callsN(st, 'pv_pay_rows') === 1, '[M5][B] そのあいだに給与の一覧（pv_pay_rows）を読んだのは1回だけ（ページの中でも門でも1本）',
    JSON.stringify({ inPage, atGate: callsN(st, 'pv_pay_rows') }));

  /* M5b（A）一覧の返事を止めたまま2社目を選び直し、そのあとで流す → 欄は新しい2社だけ。前の2社の中央値は、どこにも出ない。
     ページは止めていた一覧が届いたとき、前の2社の中央値も聞く（その答えが入るのは、もう画面に無い器 ── どこにも見えない） */
  const h = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, holdIf: (name) => name === 'pv_pay_rows',
    stub: { pv_company_pay: medBy({ 'ana|jal': MED_P1, 'etihad|jal': MED_P2 }) } });
  const held = await waitFor(() => (h.st.held.pv_pay_rows || []).length === 1);
  await h.page.select('#cr-b', 'etihad');
  const moved = await until(h.page, (SEL) => { const b = document.querySelector(SEL); return !!b && b.getAttribute('data-for') === 'jal|etihad'; }, PAY_SEL);
  ok(held && moved, '（M5b）一覧の返事を止めたまま、2社目をエティハドに選び直した（欄は jal|etihad を待っている）', JSON.stringify({ held, moved }));
  release(h.st, 'pv_pay_rows', { status: 200, body: H.payFix.open(ROWS5) });
  const doneH = (await payDone(h.page, 'jal|etihad')) && (await medDrawn(h.page, DEF_P2)) && (await medAllRead(h.page));
  const PH = await pairFace(h.page), MH = await medFace(h.page);
  const askedH = h.st.calls.filter((c) => c.name === 'pv_company_pay').map((c) => pairKey(c.p));
  ok(doneH && PH.state === 'open' && pairOk(PH, 'jal|etihad'), '[M5b] 流したあと、欄は新しい2社（jal|etihad）の一覧だけ（data-for・会社の札・欄の中の data-airline）',
    JSON.stringify({ doneH, ...pairOf(PH) }));
  ok(doneH && !MH.html.includes(DEF_P1), `[M5b] 前の2社（jal|ana）の中央値の答えは、ページのどこにも入らない（定義の1行「…下限 7」が無い・中央値に聞いた組 ${askedH.join(' と ')}）`,
    JSON.stringify({ doneH, defs: MH.defs, asked: askedH }));
  ok(doneH && onlyP2(MH), '[M5b] 中央値の器には新しい2社の答えだけ（定義の1行は器の中に1つ・中央値の行は JAL の機長の1行・額は1つ）', JSON.stringify(medOf(MH)));

  /* M10 c（A）前の2社の中央値の答えを止めたまま選び直し、新しい2社の中央値が出たあとで、止めておいた答えを流す */
  const c = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, holdIf: (name, p) => name === 'pv_company_pay' && pairKey(p) === 'ana|jal',
    stub: { pv_pay_rows: payReply(H.payFix.open(ROWS5)), pv_company_pay: medBy({ 'etihad|jal': MED_P2 }) } });
  ok(await payDone(c.page, 'jal|ana'), '（M10 c）jal|ana の給与の欄が読み終わった');
  const heldC = await waitFor(() => (c.st.held.pv_company_pay || []).length === 1);
  await c.page.select('#cr-b', 'etihad');
  const drewC = (await payDone(c.page, 'jal|etihad')) && (await medDrawn(c.page, DEF_P2));
  ok(heldC && drewC, '（M10 c）jal|ana の中央値の答えを止めたまま選び直し、jal|etihad の中央値が出た', JSON.stringify({ heldC, drewC }));
  const sent = release(c.st, 'pv_company_pay', { status: 200, body: MED_P1 });
  const delivered = sent && (await until(c.page, () => window.__payRead() >= 2));
  const PC = await pairFace(c.page), MC = await medFace(c.page);
  ok(delivered && !MC.html.includes(DEF_P1), '[M10 c] 止めておいた前の2社（jal|ana）の中央値の答えは、届いて読まれたあとも、ページのどこにも出ない',
    JSON.stringify({ sent, delivered, defs: MC.defs, meds: MC.meds }));
  ok(delivered && PC.state === 'open' && pairOk(PC, 'jal|etihad') && onlyP2(MC), '[M10 c] 新しい2社の中央値の器は、新しい2社の額だけ（JAL の機長の1行・定義の1行は器の中に1つ）',
    JSON.stringify({ ...pairOf(PC), ...medOf(MC) }));
  payAnswered([st, h.st, c.st]);
});

scene('pay-fit', '給与：通貨を替えても通信しない・円のほかで「¥」「万」を出さない・円に戻すと1文字も違わない・開けた畳みは開いたまま・中央値も描き直す（390 で1往復）', 'mock', async () => {
  /* M6 ＋ M10 g（B）390 で 円 → ドル → ディルハム → 円 の1往復（A18：大きさ・幅ごとの確かめは見た目の確かめに移した） */
  const A = [0, 1, 2, 3, 4, 5, 6].map((i) => PRF('jal', { ten: i % 5, annual_usd: 271828 + i * 31416 })), B = [PRF('ana'), PRF('ana', { pos: 'fo' })];
  const MED = { ok: true, state: 'open', period: { from: '2024-10', to: '2026-09' }, floor: 3, airlines: {
    jal: { cap: { s: 'ok', median_usd: 314159 }, fo: { s: 'few' } }, ana: { cap: { s: 'ok', median_usd: 141421 }, fo: { s: 'few' } } } };
  const { page, st } = await open('sp', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH,
    stub: { pv_pay_rows: payReply(H.payFix.open(A, B)), pv_company_pay: payReply(MED) } });
  ok((await payDone(page, 'jal|ana')) && (await medDrawn(page, DEF_P2)), '（390・円）給与の欄と中央値が出た');
  const SUM = `${PAY_SEL} .crl-pc[data-airline="jal"][data-pos="cap"] > details.crl-more > summary`;
  await page.click(SUM);
  const fit = () => page.evaluate((SEL) => {
    const b = document.querySelector(SEL), ag = b && b.querySelector('.crl-agg');
    const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
    return { cur: window.PVCurrency ? window.PVCurrency.get() : null, state: b && b.getAttribute('data-state'), text: tx(b),
      fold: !!b && !!b.querySelector('.crl-pc[data-airline="jal"][data-pos="cap"] > details.crl-more[open]'),
      med: ag && !ag.hidden ? [...ag.querySelectorAll('b.crl-amt[data-agg]')].map(tx) : [] };
  }, PAY_SEL);
  const J0 = await fit();
  const legs = [];
  for (const cur of ['USD', 'AED', 'JPY']) {
    await page.evaluate((c) => window.PVCurrency.set(c), cur);
    /* 描き直し終わるまで待つ（その通貨になり・欄は開いたまま・中央値の額の字が替わった ／ 円は最初の字に戻った） */
    const done = await until(page, ([SEL, cur, med0, text0]) => {
      const b = document.querySelector(SEL), ag = b && b.querySelector('.crl-agg');
      if (!b || b.getAttribute('data-state') !== 'open' || !ag || ag.hidden || !window.PVCurrency || window.PVCurrency.get() !== cur) return false;
      const m = [...ag.querySelectorAll('b.crl-amt[data-agg]')].map((n) => n.textContent.replace(/\s+/g, ' ').trim());
      return cur === 'JPY' ? b.textContent.replace(/\s+/g, ' ').trim() === text0 : m.length === med0.length && m.every((t, i) => t !== med0[i]);
    }, [PAY_SEL, cur, J0.med, J0.text]);
    legs.push({ cur, done, ...(await fit()) });
    if (cur === 'AED') await payShot(page, 'sp', 'aed');
  }
  const [U, E, Jb] = legs;
  ok(J0.fold && J0.med.length === 2 && U.done && E.done && [U, E].every((x) => !/[¥万]/.test(x.text)),
    '[M6][B] ドルとディルハムでは、欄に「¥」も「万」も無い（一覧の額も中央値の額も）', JSON.stringify(legs.map((x) => ({ cur: x.cur, done: x.done, yen: (x.text.match(/.{0,8}[¥万].{0,4}/) || [''])[0] }))));
  ok(Jb.done && Jb.text === J0.text, '[M6][B] 円 → ドル → ディルハム → 円：円に戻すと、欄の字は最初と1文字も違わない', JSON.stringify({ done: Jb.done, first: J0.text.slice(0, 160), last: Jb.text.slice(0, 160) }));
  ok(J0.fold && legs.every((x) => x.fold), '[M6][B] 通貨を替える前に開けた畳み（JAL の機長）は、替えたあとも開いたまま', JSON.stringify([J0.fold, ...legs.map((x) => x.fold)]));
  const PAYN = await page.evaluate(() => (window.__payAsked || []).filter((n) => n === 'pv_pay_rows' || n === 'pv_company_pay').length);
  ok(U.med.length === 2 && E.med.length === 2 && JSON.stringify(Jb.med) === JSON.stringify(J0.med)
    && callsN(st, 'pv_pay_rows') === 1 && callsN(st, 'pv_company_pay') === 1 && PAYN === 2,
    '[M10 g][B] 中央値の額も通貨ごとに描き直す（ドル・ディルハムで字が替わり、円で元に戻る）── そのあいだ通信は1本も増えない（一覧1本・中央値1本のまま）',
    JSON.stringify({ med: [J0.med, U.med, E.med, Jb.med], rows: callsN(st, 'pv_pay_rows'), median: callsN(st, 'pv_company_pay'), inPage: PAYN }));
  payAnswered([st]);
});

scene('pay-fail', '給与：読めない（500）は「いま読み出せません」「やり直す」と入口・口がまだ無いは「準備中」と入口・中央値だけ読めないときは器の中だけ（押すと中央値だけ聞き直し、居場所は器の見出しへ）', 'mock', async () => {
  /* M7（B）一覧が 500 → 「いま読み出せません」「やり直す」と給与の入口・「ログイン」は出さない → 次は読める・「やり直す」で行が出る */
  const f = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, stub: { pv_pay_rows: () => FAIL500 } });
  ok(await payDone(f.page, 'jal|ana'), '（一覧が 500）給与の欄が読み終わった');
  const F = await payFace(f.page), RF = await payRetry(f.page);
  ok(!!F && F.state === 'error' && F.text.includes(W_PAY.err) && JSON.stringify(RF.map((x) => x.t)) === JSON.stringify([W_PAY.retry]) && RF[0].h >= 44
    && F.entry.length === 1 && F.login.length === 0 && F.rows === 0,
    `[M7][B] 一覧が読めない（500）：「${W_PAY.err}」と「${W_PAY.retry}」1つ（44px 以上）・給与の入口は残る・「ログイン」は出さない（誰が読んでいるか分からない）`,
    JSON.stringify(F && { state: F.state, text: F.text, retry: RF, entry: F.entry.length, login: F.login }));
  await payShot(f.page, 'pc', 'error');
  f.st.stub.pv_pay_rows = payReply(H.payFix.open(ROWS5));
  ok(await pressKey(f.page, `${PAY_SEL} .crl-retry`), '（M7）「やり直す」をキーボードで押した');
  const back = await until(f.page, (SEL) => { const b = document.querySelector(SEL); return !!b && b.getAttribute('data-state') === 'open' && b.querySelectorAll('li.crl-row').length > 0; }, PAY_SEL);
  const F2 = await payFace(f.page), at7 = await focusAt(f.page);
  ok(back && callsN(f.st, 'pv_pay_rows') === 2 && !!F2 && F2.rows > 0 && F2.entry.length === 0 && at7.inSlot,
    '[M7][B] 押すと一覧をもう一度だけ読み（2本目）、行が出る（入口は消える）・押した人のフォーカスは欄の中に戻る',
    JSON.stringify({ back, n: callsN(f.st, 'pv_pay_rows'), rows: F2 && F2.rows, entry: F2 && F2.entry.length, at7 }));

  /* M8（B）口がまだ無い：404（符号なし）と、それとは別に符号 PGRST202（状態の数ではなく符号だけで決まることを見るため 400 で返す） */
  const sts = [f.st];
  for (const [why, reply] of [['404', { status: 404, body: { message: 'Not Found' } }], ['PGRST202', NOFN_PAY('pv_pay_rows', 400)]]) {
    const o = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH, stub: { pv_pay_rows: () => reply } });
    sts.push(o.st);
    ok(await payDone(o.page, 'jal|ana'), `（一覧が ${why}）給与の欄が読み終わった`);
    const O = await payFace(o.page), RO = await payRetry(o.page);
    ok(!!O && O.state === 'off' && O.text.includes(W_PAY.off) && O.entry.length === 1 && !O.text.includes(W_PAY.empty) && !/\d/.test(O.text)
      && RO.length === 0 && O.login.length === 0,
      `[M8][B] 口がまだ無い（${why}）：「${W_PAY.off}」と給与の入口・「${W_PAY.empty}」も数字も「${W_PAY.retry}」も「ログイン」も出さない`,
      JSON.stringify(O && { state: O.state, text: O.text, entry: O.entry.length, retry: RO, login: O.login }));
    if (why === '404') await payShot(o.page, 'pc', 'off');
  }

  /* M10 e（B）中央値だけ読めない（500）→ 一覧の行はそのまま・器に「中央値」「いま読み出せません」「やり直す」。
     押すと中央値だけ聞き直す（一覧は聞き直さない）。もう一度読めなければ次の「やり直す」、読めたら額 */
  const e = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH,
    stub: { pv_pay_rows: payReply(H.payFix.open(ROWS5)), pv_company_pay: () => FAIL500 } });
  sts.push(e.st);
  ok(await payDone(e.page, 'jal|ana'), '（中央値が 500）給与の欄が読み終わった');
  const AGG_RETRY = `${PAY_SEL} .crl-agg:not([hidden]) .crl-retry`;
  const shownE = await until(e.page, (s) => !!document.querySelector(s), AGG_RETRY);
  const E1 = await payFace(e.page), M1 = await medFace(e.page);
  ok(shownE && !!E1 && E1.state === 'open' && E1.rows > 0 && JSON.stringify(M1.h) === JSON.stringify([W_PAY.median])
    && JSON.stringify(M1.msg) === JSON.stringify([W_PAY.err]) && JSON.stringify(M1.retry) === JSON.stringify([W_PAY.retry]) && M1.allRetry === 1 && M1.meds.length === 0,
    `[M10 e][B] 中央値が読めない（500）：一覧の行はそのまま・中央値の器に「${W_PAY.median}」「${W_PAY.err}」「${W_PAY.retry}」（欄ごとの失敗の顔にしない）`,
    JSON.stringify({ shownE, state: E1 && E1.state, rows: E1 && E1.rows, ...medOf(M1) }));
  await payShot(e.page, 'pc', 'med-error');
  /* まだ読めないまま押す → 中央値だけ1本聞き直し、次の「やり直す」。キーボードの居場所はその新しい「やり直す」 */
  ok(await pressKey(e.page, AGG_RETRY), '（M10 e）中央値の「やり直す」をキーボードで押した（まだ読めない）');
  const again = await until(e.page, ([s, n]) => (window.__payAsked || []).filter((x) => x === 'pv_company_pay').length >= n && !!document.querySelector(s), [AGG_RETRY, 2]);
  const at1 = await focusAt(e.page);
  /* 次は読める → 押すと額が出る。居場所は額の出た器の見出し「中央値」 */
  e.st.stub.pv_company_pay = payReply(MED_P1);
  ok(again && (await pressKey(e.page, AGG_RETRY)), '（M10 e）もう一度、中央値の「やり直す」をキーボードで押した（次は読める）');
  const came = await medDrawn(e.page, DEF_P1);
  const M2 = await medFace(e.page), at2 = await focusAt(e.page);
  ok(again && came && callsN(e.st, 'pv_company_pay') === 3 && callsN(e.st, 'pv_pay_rows') === 1 && M2.meds.length === 2 && M2.retry.length === 0 && M2.msg.length === 0,
    '[M10 e][B] 押すたびに中央値だけを1本聞き直す（一覧は聞き直さない）・読めたら額が出て「やり直す」は消える',
    JSON.stringify({ again, came, median: callsN(e.st, 'pv_company_pay'), rows: callsN(e.st, 'pv_pay_rows'), ...medOf(M2) }));
  ok(at1.inSlot && at1.inAgg && at1.tag === 'button' && at1.text === W_PAY.retry && at2.inSlot && at2.inAgg && at2.tag === 'h3' && at2.text === W_PAY.median,
    `[M10 e][B] 押した人のキーボードの居場所は、まだ読めなければ次の「${W_PAY.retry}」・読めたら額の出た器の見出し「${W_PAY.median}」（ページの頭へ飛ばない）`,
    JSON.stringify({ at1, at2 }));
  /* 口がまだ無い（PGRST202）→ 器に「中央値」「準備中」・「やり直す」は無い・描き直しても（通貨を替えても）もう聞かない */
  const o2 = await open('pc', { url: PAIR_URL('jal', 'ana'), before: PAY_WATCH,
    stub: { pv_pay_rows: payReply(H.payFix.open(ROWS5)), pv_company_pay: () => NOFN_PAY('pv_company_pay') } });
  sts.push(o2.st);
  ok(await payDone(o2.page, 'jal|ana'), '（中央値の口が無い）給与の欄が読み終わった');
  const offMsg = (cur) => until(o2.page, ([SEL, cur, off]) => {
    const b = document.querySelector(SEL), ag = b && b.querySelector('.crl-agg');
    return !!ag && !ag.hidden && !!window.PVCurrency && window.PVCurrency.get() === cur
      && [...ag.querySelectorAll('p.crl-msg')].some((p) => p.textContent.trim() === off);
  }, [PAY_SEL, cur, W_PAY.off]);
  const off1 = await offMsg('JPY');
  const MO1 = await medFace(o2.page), EO = await payFace(o2.page);
  await payShot(o2.page, 'pc', 'med-off');
  await o2.page.evaluate(() => window.PVCurrency.set('USD'));
  const redrawn = await until(o2.page, (SEL) => { const b = document.querySelector(SEL); return !!b && b.getAttribute('data-state') === 'open' && !/[¥万]/.test(b.textContent); }, PAY_SEL);
  const off2 = redrawn && (await offMsg('USD'));
  const MO2 = await medFace(o2.page);
  ok(off1 && off2 && !!EO && EO.rows > 0 && [MO1, MO2].every((M) => JSON.stringify(M.h) === JSON.stringify([W_PAY.median])
      && JSON.stringify(M.msg) === JSON.stringify([W_PAY.off]) && M.allRetry === 0 && M.meds.length === 0 && !M.text.includes(W_PAY.none) && !/\d/.test(M.text))
    && callsN(o2.st, 'pv_company_pay') === 1,
    `[M10 e][B] 中央値の口がまだ無い（PGRST202）：器に「${W_PAY.median}」「${W_PAY.off}」だけ（「${W_PAY.retry}」も「${W_PAY.none}」も数字も無い）・通貨を替えて描き直しても、もう聞かない（1本のまま）`,
    JSON.stringify({ off1, off2, rows: EO && EO.rows, median: callsN(o2.st, 'pv_company_pay'), before: medOf(MO1), after: medOf(MO2) }));
  payAnswered(sts);
});

scene('pay-stall', '給与：一覧の返事が来ないとき、上限（REQ_LIMIT_MS）を待って「いま読み出せません」「やり直す」と入口・その1本は本当に取り消す・自動では聞き直さない（本当に待つ）', 'mock', async () => {
  const LIMIT = Number((read('career-live.js').match(/\n {2}var REQ_LIMIT_MS = (\d+);/) || [])[1]);
  ok(Number.isFinite(LIMIT) && LIMIT >= 1000 && LIMIT <= 60000, `1本の通信の上限が career-live.js から読める（REQ_LIMIT_MS = ${LIMIT}）`);
  if (!(Number.isFinite(LIMIT) && LIMIT >= 1000)) return;
  /* ページの中で、欄が「読み込み中」になった時刻と、そこを抜けた時刻を書き留める（上限の時計は、読み込み中を描いたのと同じ順番で始まる） */
  const STALL_WATCH = () => {
    new MutationObserver((ms) => {
      for (const m of ms) {
        const b = m.target;
        if (!b.matches || !b.matches('.crl[data-live="cmp-pay"]') || !b.closest('[data-view="compare"]')) continue;
        const v = b.getAttribute('data-state');
        if (v === 'loading' && window.__payL0 == null) window.__payL0 = performance.now();
        else if (v !== 'loading' && v !== 'idle' && window.__payL0 != null && window.__payL1 == null) window.__payL1 = performance.now();
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
  };
  /* M-stall-pay（B）一覧の返事を、いつまでも返さない（時計は進めない ── 本当に待つ） */
  const s = await open('pc', { url: PAIR_URL('jal', 'ana'), before: STALL_WATCH, stub: { pv_pay_rows: () => 'hold' } });
  const gone = [];
  s.page.on('requestfailed', (r) => { if (/\/rest\/v1\/rpc\/pv_pay_rows(?:[?#]|$)/.test(r.url())) gone.push((r.failure() && r.failure().errorText) || '?'); });
  const left = await s.page.waitForFunction((SEL) => {
    const b = document.querySelector(SEL);
    return !!b && b.getAttribute('data-for') === 'jal|ana' && !['idle', 'loading'].includes(b.getAttribute('data-state'));
  }, { timeout: LIMIT + 10000, polling: 100 }, PAY_SEL).then(() => true, () => false);
  const took = await s.page.evaluate(() => (typeof window.__payL0 === 'number' && typeof window.__payL1 === 'number' ? Math.round(window.__payL1 - window.__payL0) : -1));
  ok(left && took >= LIMIT - 1000 && took <= LIMIT + 3000,
    `[M-stall-pay][B] 返事の来ない一覧は、上限を待ってから読み終わる（「読み込み中」から ${took}ms ── 上限 ${LIMIT}ms より前に見切らず、上限 ＋ 3秒のうちに）`, JSON.stringify({ left, took }));
  const F = await payFace(s.page), R = await payRetry(s.page);
  ok(!!F && F.state === 'error' && F.text.includes(W_PAY.err) && JSON.stringify(R.map((x) => x.t)) === JSON.stringify([W_PAY.retry]) && F.entry.length === 1 && F.login.length === 0 && F.rows === 0,
    `[M-stall-pay][B] 欄は「${W_PAY.err}」と「${W_PAY.retry}」・給与の入口は残る（「ログイン」は出さない）`,
    JSON.stringify(F && { state: F.state, text: F.text, retry: R, entry: F.entry.length, login: F.login }));
  const ended = await waitFor(() => gone.length >= 1, 3000);
  ok(callsN(s.st, 'pv_pay_rows') === 1 && ended && gone.length === 1 && /ERR_ABORTED/.test(gone[0]),
    '[M-stall-pay][B] 一覧の要求は1本だけ（自動では聞き直さない）・ブラウザはその1本を「取り消した」と言う（上限で本当に止めた）',
    JSON.stringify({ calls: callsN(s.st, 'pv_pay_rows'), gone }));
  payAnswered([s.st]);
});

/* ══ 比較の回答（月の働き方・待遇の3つの欄）── 口コミの区域の表 C ══════════════════
   W ＝ 月の働き方（cmp-work・pv_work_view）／Q ＝ そのすぐ下の回答の欄（cmp-facts・data-quiet）／P ＝ 待遇の回答の欄（cmp-facts）。
   Q と P は同じ1回の読み（pv_contrib_facts・1社1回）。会社ごとに、サーバーが返した状態で描く（見せてよいかはサーバーの1か所）。
   質問と答えの名前は、質問の台帳（pv-conditions.json）から検査が引く（ページのコードで作り直さない）。 */
const CK = (await import('./gen-career.mjs')).CMP_KEYS;
const QL = JSON.parse(read('pv-conditions.json')).questions;
const QOF = (id) => QL.find((q) => q.id === id);
const WK = CK.work[0], PK = CK.pay[0];                    // 勤務・訓練の最初の質問・給与・待遇の最初の質問
const factRow = (id, n = 4) => {
  const q = QOF(id);
  return q.kind === 'num' ? { question_id: id, kind: 'num', n, lead: null, median_num: 20, ym: '2026-09' }
    : { question_id: id, kind: q.kind, n, lead: [q.choices[0].code], median_num: null, ym: '2026-09' };
};
const ansOf = (id) => { const q = QOF(id); return q.kind === 'num' ? `20${(q.num && q.num.ja) || ''}` : q.choices[0].ja; };
const labelOf = (id) => QOF(id).ja.label;
const WORK_OPEN = { ok: true, state: 'open', by: { cap: { block_hours: { lo: 60, hi: 75 } }, fo: {} } };
const FACT_OPEN = { ok: true, state: 'open', facts: [factRow(WK), factRow(PK)] };
const GIVE = { ok: true, state: 'give', airline: 'jal', name: 'JAL', have: 3, need: 5, ask: ['reserve_duty'] };
/* 開いていない会社の返事に植えた値（ページは状態の1語のほかを読まない ＝ どこにも出ない）。字が画面のほかの数と重ならないもの */
const PLANT_W = { ok: true, state: 'give', by: { cap: { block_hours: { lo: 811, hi: 812 } } } };
const PLANT_F = { ok: true, state: 'give', facts: [factRow(WK, 899), factRow(PK, 899)] };
const PLANT_TXT = ['811', '812', '899'];
const one = (s) => ({ status: 200, body: { ok: true, state: s } });
/* 会社ごとの返事（{ slug: body | { status, body } }）。聞かれた会社は p.airline */
const byCo = (map, dflt = { ok: true, state: 'login' }) => (p) => {
  const r = map[p && p.airline];
  return r && r.status ? r : { status: 200, body: r || dflt };
};
const W_SEL = '#cr [data-view="compare"] .crl[data-live="cmp-work"]';
const F_SEL = '#cr [data-view="compare"] .crl[data-live="cmp-facts"]';
/* 3つの欄が、その2社について読み終わった */
const settled3 = (page, want) => until(page, ([ws, fs, want]) => {
  const all = [document.querySelector(ws), ...document.querySelectorAll(fs)];
  return all.length === 3 && all.every((b) => !!b && b.getAttribute('data-for') === want && !['idle', 'loading'].includes(b.getAttribute('data-state')));
}, [W_SEL, F_SEL, want]);
/* 3つの欄の顔（W・Q・P）。split ＝ 会社ごとに上下へ並べた形の列（会社の札・字・カード・錠の1行・リンク） */
const faces3 = (page) => page.evaluate(([ws, fs]) => {
  const one = (b) => {
    if (!b) return null;
    const cols = [...b.querySelectorAll(':scope > .crl-split > .crl-split-c')].map((c) => ({
      airline: c.getAttribute('data-airline'), tag: (c.querySelector(':scope > .crl-co') || {}).textContent || null, text: c.innerText,
      give: c.querySelectorAll('.crl-give').length, locks: [...c.querySelectorAll('.crl-lock')].map((l) => l.textContent.trim()),
      links: c.querySelectorAll('a').length, chip: [...c.querySelectorAll('.crl-side-err, .crl-none')].map((x) => x.textContent) }));
    return { state: b.getAttribute('data-state'), part: b.getAttribute('data-part'), text: b.innerText.trim(), html: b.outerHTML,
      h: b.getBoundingClientRect().height, cols, grid: !!b.querySelector('.crl-cmp'),
      give: b.querySelectorAll('.crl-give').length, giveN: [...b.querySelectorAll('.crl-give-n')].map((x) => x.textContent),
      locks: [...b.querySelectorAll('.crl-lock')].map((l) => l.textContent.trim()), links: [...b.querySelectorAll('a')].map((a) => a.textContent.trim()),
      login: b.querySelectorAll('a[data-crl-login]').length, retry: b.querySelectorAll('.crl-retry').length };
  };
  const f = document.querySelectorAll(fs);
  const V = document.querySelector('#cr [data-view="compare"]');
  const pay = V ? [...V.querySelectorAll('a[href^="pay-report.html"]')] : [];
  const login = V ? [...V.querySelectorAll('a[data-crl-login]')] : [];
  const inPay = (a) => !!a.closest('.crl[data-live="cmp-pay"]');
  return { W: one(document.querySelector(ws)), Q: one(f[0]), P: one(f[1]), view: V ? V.innerText : '',
    give: V ? V.querySelectorAll('.crl-give').length : -1,
    payEntry: { n: pay.length, inPay: pay.filter(inPay).length }, loginEntry: { n: login.length, inPay: login.filter(inPay).length } };
}, [W_SEL, F_SEL]);
const LINE = { login: 'ログインと給与の提出で開きます', locked: '給与の提出で開きます', give: '自分の会社に5つ答えると開きます' };
const J = (x) => JSON.stringify(x);
/* M-mix の返事（給与提出者として：JAL は開いている・ANA は自分の会社ではない＝答える数が足りない。ANA の返事には値を植えてある） */
const MIX = {
  pv_work_view: byCo({ jal: WORK_OPEN, ana: PLANT_W }),
  pv_contrib_facts: byCo({ jal: FACT_OPEN, ana: PLANT_F }),
  pv_contrib_give: () => ({ status: 200, body: GIVE }),
};

scene('keys', '比較の回答：1社1回の読み（pv_contrib_facts）が、2つの欄の質問をちょうど聞き、2つの欄がその答えから埋まる', 'mock', async () => {
  const { page, st } = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: {
    pv_work_view: () => ({ status: 200, body: WORK_OPEN }), pv_contrib_facts: () => ({ status: 200, body: FACT_OPEN }) } });
  ok(await settled3(page, 'jal|ana'), '3つの欄が読み終わった');
  const calls = st.calls.filter((c) => c.name === 'pv_contrib_facts');
  const want = [...CK.work, ...CK.pay].sort();
  const cards = [...read('career.html').matchAll(/<div class="crl" data-live="fact"[^>]*data-keys="([^"]*)"/g)].flatMap((m) => m[1].split(','));
  ok(calls.length === 2 && JSON.stringify(calls.map((c) => c.p && c.p.airline).sort()) === '["ana","jal"]',
    `比較の回答の読みは1社に1回だけ（2本）`, J(calls.map((c) => c.p && c.p.airline)));
  ok(calls.every((c) => Array.isArray(c.p.keys) && JSON.stringify([...new Set(c.p.keys)].sort()) === JSON.stringify(want) && c.p.keys.length === want.length),
    `どちらの読みも、聞く質問はちょうど CMP_KEYS の勤務・訓練 ${CK.work.length} と給与・待遇 ${CK.pay.length}（${want.length}）`,
    J(calls.map((c) => ({ n: c.p && c.p.keys && c.p.keys.length, extra: (c.p.keys || []).filter((k) => !want.includes(k)), missing: want.filter((k) => !(c.p.keys || []).includes(k)) }))));
  ok(cards.length > 0 && cards.every((k) => want.includes(k)), `ページの話題のカードの質問（${new Set(cards).size}）も、その中に在る`, cards.filter((k) => !want.includes(k)).join(','));
  const F = await faces3(page);
  ok(!!F.Q && F.Q.state === 'open' && F.Q.grid && F.Q.text.includes(labelOf(WK)) && F.Q.text.includes(ansOf(WK)) && !F.Q.text.includes(labelOf(PK)),
    `月の働き方の下の欄は、その答えから勤務・訓練の質問を描く（「${labelOf(WK)}」${ansOf(WK)}）`, J(F.Q && [F.Q.state, F.Q.text.slice(0, 200)]));
  ok(!!F.P && F.P.state === 'open' && F.P.grid && F.P.text.includes(labelOf(PK)) && F.P.text.includes(ansOf(PK)) && !F.P.text.includes(labelOf(WK)),
    `待遇の欄は、同じ答えから給与・待遇の質問を描く（「${labelOf(PK)}」${ansOf(PK)}）`, J(F.P && [F.P.state, F.P.text.slice(0, 200)]));
  await shots(page, 'pc');
});

scene('mix', '比較の回答：会社ごとにサーバーの状態で描く（開いている会社は値・もう片方は1行と答えるカード1枚・植えた値はどこにも出ない）', 'mock', async () => {
  for (const size of ['pc', 'sp']) {
    const { page } = await open(size, { who: 'pay', url: PAIR_URL('jal', 'ana'), stub: MIX });
    ok(await settled3(page, 'jal|ana'), `（${size}）3つの欄が読み終わった`);
    const F = await faces3(page);
    const [wj, wa] = (F.W && F.W.cols) || [];
    ok(!!F.W && F.W.state === 'open' && F.W.cols.length === 2 && !F.W.grid && wj && wa && wj.airline === 'jal' && wa.airline === 'ana'
      && wj.tag === NAME.jal && wa.tag === NAME.ana,
    `（${size}）月の働き方：2列をやめて、会社の札ごとに上下へ（JAL・ANA の順）`, J(F.W && { state: F.W.state, grid: F.W.grid, cols: F.W.cols.map((c) => [c.airline, c.tag]) }));
    ok(!!wj && wj.text.includes('60〜75') && wj.give === 0 && wj.locks.length === 0, `（${size}）月の働き方の JAL（開いている）：その会社の値（「60〜75」）・錠の1行もカードも無い`, J(wj));
    ok(!!wa && wa.locks.length === 1 && wa.locks[0] === LINE.give && wa.give === 1 && wa.text.includes('あなたが答えた項目：3／5'),
      `（${size}）月の働き方の ANA（答える数が足りない）：「${LINE.give}」の1行と、答えるカード1枚（「あなたが答えた項目：3／5」）`, J(wa));
    const [qj, qa] = (F.Q && F.Q.cols) || [];
    ok(!!F.Q && F.Q.state === 'open' && F.Q.cols.length === 1 && qj && qj.airline === 'jal' && !qa && qj.text.includes(labelOf(WK)) && qj.text.includes(ansOf(WK)) && F.Q.give === 0,
      `（${size}）月の働き方の下の回答：JAL の札の下に勤務・訓練の答え（「${labelOf(WK)}」）・ANA の分は描かない（すぐ上が言っている）・カード無し`, J(F.Q && { cols: F.Q.cols, give: F.Q.give }));
    const [pj, pa] = (F.P && F.P.cols) || [];
    ok(!!F.P && F.P.state === 'open' && F.P.cols.length === 2 && pj && pa && pj.text.includes(labelOf(PK)) && pj.text.includes(ansOf(PK))
      && pa.locks.length === 1 && pa.locks[0] === LINE.give && pa.give === 0 && pa.links === 0,
    `（${size}）待遇：JAL の札の下に給与・待遇の答え（「${labelOf(PK)}」）・ANA の札の下に「${LINE.give}」の1行だけ（カードもリンクも無い）`, J(F.P && F.P.cols));
    ok(F.give === 1, `（${size}）答えるカードは、比較の画面に1枚だけ（月の働き方の中）`, String(F.give));
    const html = [F.W, F.Q, F.P].map((x) => (x ? x.html : '')).join('\n');
    const hit = PLANT_TXT.filter((t) => F.view.includes(t) || html.includes(t));
    ok(hit.length === 0, `（${size}）ANA の返事に植えた値（${PLANT_TXT.join('・')}）は、画面の字にも3つの欄の HTML にも無い`, hit.join(','));
    await shots(page, size);
  }
});

scene('mixtwo', '比較の回答：別のタブで別の会員が入ったら、読み込み直さずに、その人の状態へ（前の人の値は1字も残らない）', 'mock', async () => {
  const { MEMBERS } = await import('./serve-local.mjs');
  const ID = Object.fromEntries(MEMBERS.map((m) => [m.id, m.key]));
  const who = (auth) => {
    try { const t = String(auth || '').replace(/^Bearer /, ''); return ID[JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sub] || 'anon'; }
    catch { return 'anon'; }
  };
  /* 返事は送ってきたログインで決める（給与提出者 pay だけが M-mix の返事・ほかの人は「給与の鍵が無い」） */
  const asPay = (fn) => (p, auth) => (who(auth) === 'pay' ? fn(p, auth) : one('locked'));
  const stub = { pv_work_view: asPay(MIX.pv_work_view), pv_contrib_facts: asPay(MIX.pv_contrib_facts), pv_contrib_give: asPay(MIX.pv_contrib_give) };
  const { page, st, ctx } = await open('pc', { who: 'pay', url: PAIR_URL('jal', 'ana'), stub });
  ok(await settled3(page, 'jal|ana'), '給与提出者として、3つの欄が読み終わった');
  const F0 = await faces3(page);
  const VALS = ['60〜75', ansOf(WK), ansOf(PK)];
  ok(!!F0.W && F0.W.text.includes('60〜75') && F0.Q.text.includes(ansOf(WK)) && F0.P.text.includes(ansOf(PK)),
    '切り替える前：給与提出者の値が出ている（確かめが空振りしていない）', J({ W: F0.W && F0.W.text.slice(0, 120), Q: F0.Q && F0.Q.text.slice(0, 80), P: F0.P && F0.P.text.slice(0, 80) }));
  for (const n of [0, 1]) await H.watch(page, 'cmp-facts', n);
  await H.watch(page, 'cmp-work');
  const mark = await page.evaluate(() => { window.__crlNoReload = 1; return (window.__crlSeen || []).length; });
  const n0 = st.calls.length;
  const t = await H.otherTab(ctx, CUR.env.local);
  await H.loginIn(t, CUR.env.local, 'a');
  const turned = await until(page, ([ws, fs, a, b]) => {
    const w = document.querySelector(ws), f = document.querySelectorAll(fs);
    const ok = (x, s) => !!x && x.getAttribute('data-state') === 'locked' && x.innerText.trim() === s;
    return ok(w, a) && ok(f[1], b) && !!f[0] && f[0].getAttribute('data-state') === 'locked';
  }, [W_SEL, F_SEL, LINE.locked, LINE.locked]);
  const F = await faces3(page);
  ok(turned && F.W.locks.length === 1 && F.W.links.length === 0 && F.P.text === LINE.locked && F.Q.text === '' && F.Q.h === 0,
    `別のタブで会員A が入ると、読み込み直さずに：月の働き方と待遇は「${LINE.locked}」・すぐ下の回答の欄は高さ 0`, J({ turned, W: F.W && F.W.text, P: F.P && F.P.text, Q: F.Q && [F.Q.state, F.Q.h] }));
  const still = await page.evaluate(() => window.__crlNoReload === 1);
  const after = st.calls.slice(n0);
  ok(still && after.length > 0 && after.every((c) => who(c.auth) === 'a'), '読み込み直していない・切り替えたあとの読みは、どれも会員A のログインで聞いた',
    J({ still, after: after.map((c) => `${c.name}:${who(c.auth)}`) }));
  const seenAfter = (await H.seen(page)).slice(mark);
  const leftV = VALS.filter((v) => seenAfter.some((s) => s.includes(v)) || F.view.includes(v));
  ok(seenAfter.length > 0 && leftV.length === 0, `切り替えたあと3つの欄が取ったどの顔にも、画面のどこにも、給与提出者の値（${VALS.join('・')}）が無い`,
    J({ left: leftV, seen: seenAfter.slice(0, 8) }));
  await t.close();
});

scene('closed', '比較の回答：2社とも開いていない時は欄に1行（語の順はログイン → 給与 → 答える）・答えるカードは月の働き方にだけ・給与の入口は「提出された年収」の欄に1つ', 'mock', async () => {
  const CASES = [
    ['give', 'give', 'give', H.payFix.member()],
    ['login', 'login', 'login', H.payFix.guest()],
    ['locked', 'locked', 'locked', H.payFix.member()],
    ['give', 'login', 'login', H.payFix.guest()],          // 食い違った2社：先に当たる語（ログイン）
  ];
  for (const [a, b, word, payBody] of CASES) {
    const AB = `jal ${a}・ana ${b}`;
    const { page } = await open('pc', { url: PAIR_URL('jal', 'ana'), stub: {
      pv_work_view: byCo({ jal: { ok: true, state: a }, ana: { ok: true, state: b } }),
      pv_contrib_facts: byCo({ jal: { ok: true, state: a }, ana: { ok: true, state: b } }),
      pv_contrib_give: () => ({ status: 200, body: GIVE }),
      pv_pay_rows: () => ({ status: 200, body: payBody }) } });
    ok(await settled3(page, 'jal|ana'), `（${AB}）3つの欄が読み終わった`);
    const F = await faces3(page);
    const card = word === 'give';
    ok(!!F.W && F.W.state === 'locked' && F.W.locks.length === 1 && F.W.locks[0] === LINE[word] && F.W.cols.length === 0
      && F.W.give === (card ? 1 : 0) && (card ? F.W.giveN[0] === 'あなたが答えた項目：3／5' : F.W.text === LINE[word]),
    `（${AB}）月の働き方：欄に1行「${LINE[word]}」${card ? 'と答えるカード1枚' : 'だけ'}`, J(F.W && { state: F.W.state, text: F.W.text, give: F.W.give }));
    ok(!!F.W && F.W.links.length === (card ? 1 : 0) && F.W.login === 0 && !F.W.text.includes('匿名で給与を提出する'),
      `（${AB}）月の働き方に、ログインも給与の入口も無い（リンクは${card ? '答えるカードの「匿名で答える」1つだけ' : '0'}）`, J(F.W && F.W.links));
    ok(!!F.Q && F.Q.state === 'locked' && F.Q.text === '' && F.Q.h === 0, `（${AB}）すぐ下の回答の欄は字が無く、高さ 0`, J(F.Q && [F.Q.state, F.Q.text, F.Q.h]));
    ok(!!F.P && F.P.state === 'locked' && F.P.text === LINE[word] && F.P.links.length === 0 && F.P.give === 0,
      `（${AB}）待遇：「${LINE[word]}」の1行だけ（リンクもカードも無い）`, J(F.P && { text: F.P.text, links: F.P.links, give: F.P.give }));
    const guest = !payBody.give;
    ok(F.payEntry.n === 1 && F.payEntry.inPay === 1 && F.loginEntry.n === (guest ? 1 : 0) && F.loginEntry.inPay === F.loginEntry.n,
      `（${AB}）比較の画面の給与の入口は1つで「提出された年収」の欄の中・「ログイン」は${guest ? 'ゲストにだけ1つ（同じ欄の中）' : '出ない（会員）'}`, J({ pay: F.payEntry, login: F.loginEntry }));
  }
});

scene('mixfail', '比較の回答：片方の会社が読めなくても、もう片方は出す（読めなかった会社は札と「いま読み出せません」・0 も「集計なし」も置かない）', 'mock', async () => {
  const NOFN2 = (fn) => ({ status: 404, body: { code: 'PGRST202', details: null, hint: null, message: `Could not find the function public.${fn}` } });
  /* 月の働き方：JAL が読めない・ANA は答える数が足りない */
  {
    const { page } = await open('pc', { who: 'pay', url: PAIR_URL('jal', 'ana'), stub: {
      pv_work_view: byCo({ jal: FAIL500, ana: { ok: true, state: 'give' } }), pv_contrib_give: () => ({ status: 200, body: GIVE }) } });
    ok(await settled3(page, 'jal|ana'), '（月の働き方の JAL が失敗）3つの欄が読み終わった');
    const F = await faces3(page), [j, a] = (F.W && F.W.cols) || [];
    ok(!!F.W && F.W.state === 'open' && F.W.part === '1' && F.W.retry === 1 && F.W.cols.length === 2,
      '月の働き方：会社ごとに上下へ・片方だけ読めなかった印（data-part="1"）・「やり直す」は1つ', J(F.W && { state: F.W.state, part: F.W.part, retry: F.W.retry, cols: F.W.cols.length }));
    ok(!!j && j.tag === NAME.jal && j.chip.length === 1 && j.chip[0] === 'いま読み出せません' && !/\d/.test(j.text) && j.give === 0 && j.locks.length === 0,
      'JAL（読めなかった）：札と「いま読み出せません」だけ（数字・錠の1行・カードを置かない ＝ 自分の会社かもしれない読みの失敗を隠さない）', J(j));
    ok(!!a && a.tag === NAME.ana && a.locks[0] === LINE.give && a.give === 1, `ANA：「${LINE.give}」とカード`, J(a));
  }
  /* 回答の欄：JAL が読めない・ANA は開いている */
  {
    const { page } = await open('pc', { who: 'pay', url: PAIR_URL('jal', 'ana'), stub: {
      pv_work_view: () => ({ status: 200, body: WORK_OPEN }), pv_contrib_facts: byCo({ jal: FAIL500, ana: FACT_OPEN }) } });
    ok(await settled3(page, 'jal|ana'), '（回答の JAL が失敗）3つの欄が読み終わった');
    const F = await faces3(page);
    for (const [k, x, key] of [['すぐ下の回答', F.Q, WK], ['待遇', F.P, PK]]) {
      const [j, a] = (x && x.cols) || [];
      ok(!!x && x.state === 'open' && x.part === '1' && x.retry === 1 && x.cols.length === 2 && j && a
        && j.chip.length === 1 && j.chip[0] === 'いま読み出せません' && !/集計なし|まだ集計がありません|\d/.test(j.text)
        && a.text.includes(labelOf(key)) && a.text.includes(ansOf(key)),
      `${k}：JAL は札と「いま読み出せません」だけ（「集計なし」「まだ集計がありません」を置かない）・ANA はその答え（「${labelOf(key)}」）・「やり直す」1つ`,
      J(x && { state: x.state, part: x.part, retry: x.retry, cols: x.cols }));
    }
  }
  /* 2社とも口が無い（PGRST202）→ 月の働き方と待遇は「準備中」・すぐ下の欄は畳む（同じ語を2回言わない） */
  for (const size of ['pc', 'sp']) {
    const { page } = await open(size, { url: PAIR_URL('jal', 'ana'), stub: {
      pv_work_view: () => NOFN2('pv_work_view'), pv_contrib_facts: () => NOFN2('pv_contrib_facts') } });
    ok(await settled3(page, 'jal|ana'), `（2社とも口が無い・${size}）3つの欄が読み終わった`);
    const F = await faces3(page);
    ok(!!F.W && F.W.state === 'off' && F.W.text === '準備中' && F.Q.state === 'off' && F.Q.h === 0 && F.P.state === 'off' && F.P.text === '準備中',
      `（${size}）月の働き方「準備中」・すぐ下の欄は高さ 0・待遇「準備中」`, J({ W: F.W && [F.W.state, F.W.text], Q: F.Q && [F.Q.state, F.Q.h], P: F.P && [F.P.state, F.P.text] }));
  }
});

/* ══ REAL LOCAL：ブラウザの「戻る」で手元から戻った比較（L7・2026-10-23）══════════════════════════════
   本当の「戻る」は、要求を横取りする上の open() では起きない（ブラウザがページを手元に置かない）。cmp-stubs.mjs の bfOpen
   （assert-keep.mjs の KA8 と同じ3つの置き方：headless true・横取りなし・名前は localhost と LIBS だけ・max-age の口）で開く。
   手元から戻ったか（離れる前に置いた印が残る・pageshow の persisted）を毎回確かめ、戻らなければ新しいタブで最初からやり直す
   （5回まで）。5回とも戻らなければ、その行は赤（「戻るで手元から戻らなかった（証明できない）」── 読み直しを「戻った」と数えない）。
   会員の投稿は makeReaders（via call）。足す1件は q() で保存先へ直接（JAL に点数つきの口コミ）。 */
const BF_OFF = 'a[href="world-airlines.html"]';                    // 比較の画面に在る、サイトのほかのページへのリンク
const BF_MARK = /ZZ[a-z]+-[a-z-]+-(salary|wlb)ZZ/;                  // 口コミの本文の終わりの印（抜粋の40字より後ろ ＝ 本文を受け取った人だけに出る）
const BF_TRIES = 5;
const bfTries = async (fn) => {
  const why = [];
  for (let i = 1; i <= BF_TRIES; i++) {
    const r = await fn(i);
    if (r.restored) return { ...r, tries: i, why };
    why.push(r.why || '?');
  }
  return { restored: false, tries: BF_TRIES, why };
};
/* 毎回1行の知らせ（検査の行ではない）：何回目で手元から戻ったか・読み直された回のブラウザの言い分 */
const bfNote = (tag, r) => console.log(`  ・${tag}：手元から戻るまで ${r.restored ? r.tries : 'ー'} 回（読み直された回の理由：${r.why.join(' / ') || 'ー'}）`);
const bfWait = (page, fn, arg) => page.waitForFunction(fn, { timeout: 30000, polling: 100 }, arg).then(() => true, () => false);
const bfNotProven = (label, r) => (r.restored ? label : `${label}：戻るで手元から戻らなかった（証明できない）`);
scene('local-back', '「戻る」で手元から戻った比較：投稿で変わる数を、骨組みに戻さずに取り直す（ゲスト）／離れているあいだに別の会員が入ったら、前の人の字を出さずに今の人の形へ', 'local', async () => {
  const env = CUR.env;
  const made = await H.makeReaders(env, { via: VIA });
  console.log(`  ・会員の投稿（via ${made.via}）: ${made.did.length} 件`);
  const front = await H.pagesFront(env.url);
  const bb = await H.bfLaunch();
  const STARS = '#cr [data-view="compare"] .crl[data-live="cmp-stars"]';
  try {
    /* ① ゲスト：比較（JAL は点数の付いた投稿2件）→ リンクでほかのページ → JAL に点数つきの口コミを1件 →「戻る」 */
    const r1 = await bfTries(async () => {
      const o = await H.bfOpen(bb, front, env.local, 'pc', { url: PAIR_URL('jal', 'ana') });
      CUR.pages.push(o);
      const { page } = o;
      const before = await bfWait(page, (sel) => { const b = document.querySelector(sel);
        return !!b && b.getAttribute('data-state') === 'open' && b.getAttribute('data-for') === 'jal|ana' && b.innerText.includes('2件の評価'); }, STARS);
      await H.watch(page, 'cmp-stars');
      await page.evaluate(() => { window.__l7 = 'L7-1'; if (window.__crlSeen) window.__crlSeen.length = 0; });
      await H.bfLeave(page, BF_OFF);
      const id = (await env.q(`insert into public.reviews_v2 (proof_hash, airline, culture_score, salary_score, benefits_score, wlb_score, ops_score, training_score)
        values (public.pv_review_hash(gen_random_uuid(), 'jal'), 'jal', 4, 4, 4, 4, 4, 4) returning id`)).rows[0].id;
      const b = await H.bfBack(page);
      const kept = await page.evaluate(() => window.__l7 === 'L7-1').catch(() => false);
      if (!b.persisted || !kept) {
        await env.q('delete from public.reviews_v2 where id = $1', [id]);     // やり直しは同じ数から（2件 → 3件）
        return { restored: false, why: b.why || 'mark gone' };
      }
      const three = await bfWait(page, (sel) => { const x = document.querySelector(sel);
        return !!x && x.getAttribute('data-state') === 'open' && x.innerText.includes('3件の評価'); }, STARS);
      const face = await slot(page, 'cmp-stars');
      return { restored: true, before, three, posts: !!face && face.text.includes('会員の投稿 4件'), seen: await H.seen(page) };
    });
    bfNote('ゲスト', r1);
    const sk = (r1.seen || []).filter((s) => /^(loading|idle)\|/.test(s));
    ok(r1.restored && r1.before && r1.three && r1.posts,
      bfNotProven('★L7 ゲスト：比較 → リンクでほかのページ → JAL に口コミ1件（手元の SQL）→「戻る」で手元から戻った（離れる前の印が残る・pageshow の persisted）：読み込み直さずに「3件の評価」・会員の投稿 4件', r1),
      J({ restored: r1.restored, tries: r1.tries, why: r1.why, before: r1.before, three: r1.three, posts: r1.posts }));
    ok(r1.restored && r1.three && (r1.seen || []).length > 0 && sk.length === 0,
      bfNotProven('★L7 取り直すあいだ、評価の欄は骨組み（loading）にも空（idle）にもならない（前の数を出したまま次の数へ）', r1),
      J({ restored: r1.restored, faces: (r1.seen || []).map((s) => s.split('|')[0]), skeleton: sk.length }));

    /* ② 口コミの鍵のある会員 a：比較（本文が読める）→ リンクでほかのページ → ほかのタブで pilot が入る →「戻る」。
       戻った瞬間（ページ自身の pageshow のあと）も、そのあとのどの瞬間も、どの欄にも a が受け取った本文の字（印）は出ない ── 静かに取り直さず、
       その場で空にしてから pilot の形（抜粋と口コミの Give & Get）へ。
       この回だけ、離れる前に画面の出入りの知らせ（visibilitychange）を検査のブラウザの中で黙らせる（window の捕まえる段で、ページの
       どの聞き手より先に止める。製品のファイルには何も足さない）。なぜ：Chromium では手元から戻るとき visibilitychange（見える）が
       pageshow より先に届き、supabase-js が自分でその場で保存されたログインを読み直して SIGNED_IN（pilot）を出し直す。その知らせで
       欄が pageshow の前に空になるので、pageshow の中の読む人の確かめ（A21 b）を外しても緑のまま ── 壊したのが見えなくなる。
       黙らせると、ほかのタブの書き込みの知らせ（storage）が pageshow のあとに届く順になる（Safari の手元のページが返しうる順）。
       その順で、前の人の字を止めているのが読む人の確かめだけであることを見る（外すと pageshow の時点で a の本文が出る ＝ 赤）。 */
    const KINDS = [['cmp-stars', 0], ['cmp-summary', 0], ['cmp-work', 0], ['cmp-facts', 0], ['cmp-facts', 1], ['cmp-pay', 0]];
    const r2 = await bfTries(async () => {
      const o = await H.bfOpen(bb, front, env.local, 'pc', { who: 'a', url: PAIR_URL('jal', 'ana') });
      CUR.pages.push(o);
      const { page } = o;
      const pre = await bfWait(page, ([sel, re]) => { const b = document.querySelector(sel);
        return !!b && b.getAttribute('data-state') === 'open' && new RegExp(re).test(b.innerText); }, [STARS, BF_MARK.source]);
      for (const [k, n] of KINDS) await H.watch(page, k, n);
      await page.evaluate((re) => {
        /* ページの台本が読み終わったあとに足す ＝ career-live.js の pageshow のあとに呼ばれる */
        window.addEventListener('pageshow', (e) => {
          const t = [...document.querySelectorAll('#cr [data-view="compare"] .crl[data-live]')].map((b) => b.innerText).join('\n');
          window.__l7b = { persisted: e.persisted, mark: new RegExp(re).test(t) };
        });
        /* 画面の出入りの知らせを黙らせる（上の注記）。黙らせた回数は __l7vis に数える（知らせの行の詳しい中身に出す） */
        window.__l7vis = 0;
        window.addEventListener('visibilitychange', (e) => { window.__l7vis++; e.stopImmediatePropagation(); }, true);
        window.__l7 = 'L7-2';
        if (window.__crlSeen) window.__crlSeen.length = 0;
      }, BF_MARK.source);
      await H.bfLeave(page, BF_OFF);
      const t = await o.ctx.newPage();
      await t.goto(front.base + '/pv-vocab.json', { waitUntil: 'load' });
      await H.loginIn(t, env.local, 'pilot');
      await t.close();
      const b = await H.bfBack(page);
      const kept = await page.evaluate(() => window.__l7 === 'L7-2').catch(() => false);
      if (!b.persisted || !kept) return { restored: false, why: b.why || 'mark gone' };
      const end = await bfWait(page, (sel) => { const x = document.querySelector(sel);
        return !!x && x.getAttribute('data-state') === 'open' && !!x.querySelector('.crl-rate-rv') && !!x.querySelector('a.pv-gg[href*="submit-review.html"]'); }, STARS);
      const now = await page.evaluate(() => [...document.querySelectorAll('#cr [data-view="compare"] .crl[data-live]')].map((x) => x.innerText).join('\n'));
      return { restored: true, pre, at: await page.evaluate(() => window.__l7b || null), vis: await page.evaluate(() => window.__l7vis), seen: await H.seen(page), end, now };
    });
    bfNote('a → pilot', r2);
    const marked = (r2.seen || []).filter((s) => BF_MARK.test(s));
    ok(r2.restored && r2.pre && !!r2.at && r2.at.persisted === true && r2.at.mark === false && (r2.seen || []).length > 0 && marked.length === 0,
      bfNotProven("★L7 a（口コミの鍵）の比較 → ほかのページ → ほかのタブで pilot が入る →（画面の出入りの知らせは黙らせて）「戻る」で手元から戻った：戻った瞬間（ページ自身の pageshow のあと）も、そのあとのどの瞬間も、どの欄にも a が受け取った本文の字が無い", r2),
      J({ restored: r2.restored, tries: r2.tries, why: r2.why, before: r2.pre, at: r2.at, vis: r2.vis, faces: (r2.seen || []).length, marked: marked.map((s) => s.slice(0, 80)) }));
    ok(r2.restored && r2.end && !BF_MARK.test(r2.now || ''),
      bfNotProven('★L7 そのあと比較は pilot の形（評価の下に抜粋と口コミの Give & Get）── 読み込み直さずに', r2),
      J({ restored: r2.restored, end: r2.end }));
  } finally {
    for (const o of CUR.pages) await o.close();
    await bb.close().catch(() => {});
    await front.close();
  }
});

/* ══ REAL LOCAL：比較と会社ページが同じ数・投稿の追加／修正／削除のあとも一緒に動く・5人の読む人・2つの鍵（L1〜L6・L8・2026-10-23）══════
   どの場面も自分の使い捨ての保存先（startLocal）で、手元の SQL がそのまま答える（返事を検査は作らない）。
   会員の投稿は via（いまは call ── 投稿の画面が手元で最後まで送れるかの試し P5.5 がまだ無い）。会員の画面の無い修正・削除と、
   どの画面でも作れない行（古い会社コードの口コミ）は q() で保存先へ直接書く。要約の文は検査の決めた字（GATES …・NEW …）で、
   運営（op）が預ける口（pv_review_summary_set）から入れる ── AI の作り直しはここでは走らない（MOCK／未確認）。
   返事の字は、ページが受け取ったまま書き留めて比べる（[REAL LOCAL SQL] の行）。画面は [REAL LOCAL CONNECTION] の行。
   給与の鍵の期限切れは場面が q() で作り、終わりに種をまいた直後の値へ戻す（keysBack）。 */
const L_ID = Object.fromEntries(LOCAL_MEMBERS.map((m) => [m.key, m.id]));
const L_SCORES = ['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score', 'training_score'];
const q1 = async (sql, p) => (await CUR.env.q(sql, p)).rows[0];
/* 返事の字だけを見る行（[REAL LOCAL SQL]） */
const okSql = (cond, label, detail) => { const m = CUR.mode; CUR.mode = 'sql'; try { ok(cond, label, detail); } finally { CUR.mode = m; } };
/* 返事の字が、その形ちょうどか（鍵・値・並びが同じで、ほかに何も無い。手元の SQL は jsonb の字 {"ok": true, …} で返す） */
const exact = (text, want) => { try { return JSON.stringify(JSON.parse(text)) === want; } catch { return false; } };

/* 口コミを1件、その会員として（makeReaders の via call と同じ口・同じ列：POST /rest/v1/reviews_v2・proof_hash はサーバーの式を q() で）。
   scores ＝ 6つ（null の分類は付けない）か null（点数なし）。ひとことは給与とワークライフバランス（readerText ── 印は抜粋の40字より後ろ）。 */
async function postAs(key, airline, scores) {
  if (VIA !== 'call') throw new Error("via 'form' はまだ無い（手元で投稿の画面が送れるかの試し P5.5 がまだ無い）。--via call で走らせる");
  const env = CUR.env;
  const h = (await q1('select public.pv_review_hash($1::uuid, $2) as h', [L_ID[key], airline])).h;
  const row = { proof_hash: h, airline, orig_lang: 'ja',
    salary_comment: H.readerText(key, airline, 'salary'), wlb_comment: H.readerText(key, airline, 'wlb') };
  (scores || []).forEach((v, i) => { if (v != null) row[L_SCORES[i]] = v; });
  const s = await H.seedOf(env.url, key);
  const r = await fetch(`${env.url}/rest/v1/reviews_v2`, { method: 'POST', body: JSON.stringify(row),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${s.session.access_token}`, prefer: 'return=minimal' } });
  const got = await q1('select id::text as id from public.reviews_v2 where proof_hash = $1 and airline = $2', [h, airline]);
  if (r.status !== 201 || !got) throw new Error(`${key} の口コミ（${airline}）が保存されない: ${r.status} ${(await r.text()).slice(0, 200)}`);
  console.log(`  ・${key}: 口コミ ${airline}（点数 ${scores ? scores.map((v) => (v == null ? '-' : v)).join(',') : 'なし'}）── その会員として POST /rest/v1/reviews_v2 → ${r.status}（via ${VIA}）`);
  return got.id;
}
const rowOf = async (key, airline) => (await q1('select id::text as id from public.reviews_v2 where proof_hash = public.pv_review_hash($1::uuid, $2)', [L_ID[key], airline])).id;

/* seedEq（L1・L2 ── 数だけを読む場面。鍵の状態はどこも読まない。MOCK の FIX.JAL・FIX.ANA と同じ点数）：
   jal ← a [5,4,3,4,5,3]・b [3,3,3,3,3,3]・c 点数なし（ひとことだけ）／ana ← pilot [4,-,4,5,4,4]／
   cathay-pacific ← a [5,5,5,5,5,5] と、古い会社コード 'cathay' の1行 [3,3,3,3,3,3]（どの画面でも作れない行 ＝ q() で直接。
   proof_hash はどの会員のものでもない字の sha256）／etihad・eva-air ← 投稿なし */
async function seedEq() {
  const ids = {};
  ids.a = await postAs('a', 'jal', [5, 4, 3, 4, 5, 3]);
  ids.b = await postAs('b', 'jal', [3, 3, 3, 3, 3, 3]);
  ids.c = await postAs('c', 'jal', null);
  await postAs('pilot', 'ana', [4, null, 4, 5, 4, 4]);
  await postAs('a', 'cathay-pacific', [5, 5, 5, 5, 5, 5]);
  await CUR.env.q(`insert into public.reviews_v2 (proof_hash, airline, culture_score, salary_score, benefits_score, wlb_score, ops_score, training_score)
    values (encode(extensions.digest('手元の検査の古い会社コードの行（どの会員のものでもない）', 'sha256'), 'hex'), 'cathay', 3, 3, 3, 3, 3, 3)`);
  console.log('  ・古い会社コードの行：cathay [3,3,3,3,3,3] ── q() で保存先へ直接（どの画面でも作れない行）');
  await afterSeed();
  return ids;
}

/* 要約の文（検査の字。数字を入れない ── 数字の入った文はサーバーが預からない） */
const GATES = { good: ['GATES 良い点その一 教官の指導が丁寧という声', 'GATES 良い点その二 休みの希望が通りやすいという声', 'GATES 良い点その三 運航の段取りが整っているという声'],
  concern: ['GATES 気になる点その一 手当の仕組みが分かりにくいという声'] };
const NEWSUM = { good: ['NEW 良い点その一 乗務の組み方が分かりやすいという声', 'NEW 良い点その二 有給を取りやすいという声', 'NEW 良い点その三 同僚に相談しやすいという声'],
  concern: ['NEW 気になる点その一 寮の決まりが細かいという声'] };
const SUM_TXT = (S) => [...S.good, ...S.concern];
/* 運営（op）が JAL の要約を預ける（db/test-review-summary.mjs の有効な形：良い点3つ・気になる点1つ）。どの点も、JAL のいま読める口コミ
   全部の id で支える（読める口コミの数え方はサーバーの pv_review_summary_ids）。分類は、どの口コミにも本文の在る 給与・ワークライフバランス。
   件数とその時刻はサーバーの字のまま渡す（JavaScript の時刻に直すと、千分の一秒より細かい所が落ちて「古い材料」で断られる） */
async function storeSum(S) {
  const ids = (await CUR.env.q("select x.id from public.pv_review_summary_ids(array['jal']::text[], null::timestamptz) as x(id) order by 1")).rows.map((r) => r.id);
  const newest = (await q1("select max(created_at)::text as t from public.reviews_v2 where id::text = any(string_to_array($1, ','))", [ids.join(',')])).t;
  const pt = (text, cat) => ({ text, cat, k: ids.length, ids });
  const p = { airline: 'jal', lang: 'ja', n: ids.length, newest,
    good: S.good.map((t, i) => pt(t, i % 2 ? 'wlb' : 'salary')), concern: S.concern.map((t) => pt(t, 'wlb')) };
  const r = await H.rpcAs(CUR.env.url, 'op', 'pv_review_summary_set', p);
  if (!r.body || r.body.state !== 'saved') throw new Error('運営が要約を預けられない: ' + r.text.slice(0, 200));
  console.log(`  ・運営（op）が JAL の要約を預けた（rpc pv_review_summary_set → saved・口コミ ${ids.length} 件で支える・良い点 ${S.good.length}・気になる点 ${S.concern.length}・文は検査の字「${S.good[0].split(' ')[0]} …」）`);
}

/* seedGates（L3〜L6・L8）＝ makeReaders（6人の表）＋ 運営が JAL の要約を預ける ＋ a・b・pilot が JAL の勤務・訓練の最初の質問に同じ答え
   （JAL に集計の行が1つできる）。どれも読む人の鍵を変えない（答えても鍵は増えない）。pay と c は何も答えない。 */
async function seedGates() {
  const made = await H.makeReaders(CUR.env, { via: VIA });
  made.did.forEach((l) => console.log('  ・' + l));
  await storeSum(GATES);
  const Q = QOF(WK);
  if (!Q || Q.kind !== 'choice') throw new Error(`勤務・訓練の最初の質問（${WK}）が選ぶ質問ではない ── 種を作り直す`);
  const fleet = (await q1('select code from public.pv_fleets where active order by code limit 1')).code;
  for (const key of ['a', 'b', 'pilot']) {
    const r = await H.rpcAs(CUR.env.url, key, 'submit_airline_conditions',
      { airline: 'jal', year: 2026, month: 9, position: 'cap', fleet, lang: 'ja', answers: [{ question_id: WK, code: Q.choices[0].code }] });
    if (!r.body || r.body.saved !== 1) throw new Error(`${key} の答えが保存されない: ${r.text.slice(0, 200)}`);
  }
  console.log(`  ・a・b・pilot：JAL の「${labelOf(WK)}」に同じ答え「${ansOf(WK)}」── その会員として rpc submit_airline_conditions（via ${VIA}）`);
  await afterSeed();
  return made;
}

/* 鍵の期限（profiles.access_until）。場面が期限切れを作ったら、終わりに種をまいた直後の値へ戻し、6人とも戻ったことを確かめる。
   ★設計の字は「null に戻す」。けれど種（makeReaders）のあとの c と pay は、給与の提出で開いた期限を持っている（null ＝ 給与の鍵が無い ──
     db/work-months.sql の pv_work_level）。null にすると「鍵を戻した」が「鍵を消した」になるので、種をまいた直後の値へ戻す
     （a・b・pilot・op は null のまま）。 */
const keysNow = async () => Object.fromEntries((await CUR.env.q("select id::text as id, access_until::text as t from public.profiles where id::text = any(string_to_array($1, ','))",
  [Object.values(L_ID).join(',')])).rows.map((r) => [r.id, r.t]));
const expire = (key) => CUR.env.q("update public.profiles set access_until = now() - interval '1 day' where id = $1", [L_ID[key]]);
const restoreKey = (at0, key) => CUR.env.q('update public.profiles set access_until = $2::timestamptz where id = $1', [L_ID[key], at0[L_ID[key]]]);
async function keysBack(at0) {
  let now = null, err = null;
  try {
    for (const key of Object.keys(L_ID)) await restoreKey(at0, key);
    now = await keysNow();
  } catch (e) { err = String(e && e.message); }
  const diff = now ? Object.entries(L_ID).filter(([, id]) => now[id] !== at0[id]).map(([k]) => k) : ['（読めない）'];
  ok(!err && diff.length === 0, '鍵の期限（profiles.access_until）は場面の終わりに、6人とも種をまいた直後の値へ戻った（期限切れは場面の中だけ）',
    J({ err, diff, keys: Object.fromEntries(Object.entries(L_ID).map(([k, id]) => [k, at0[id] ? '期限あり' : null])) }));
}
/* REAL LOCAL の場面の型：種（seedEq か seedGates）→（--sql の写し）→ 場面 → 終わりに鍵の期限を戻して確かめる */
const localScene = (key, label, seed, fn) => scene(key, label, 'local', async () => {
  const made = await (seed === 'eq' ? seedEq() : seedGates());
  const at0 = await keysNow();
  try { await fn(made, at0); } finally { await keysBack(at0); }
});

/* 1枚開く（手元の SQL が答える）。開く前から、ページが受け取った手元の関数の返事を、字のまま全部書き留める（got）。
   who ＝ serve-local.mjs の会員（null ＝ ログインしていない）。 */
async function lopen(size, who, url) {
  const o = await open(size, { who, url: '/pv-vocab.json' });
  const origin = new URL(CUR.env.url).origin, got = [];
  o.page.on('response', (r) => {
    let u;
    try { u = new URL(r.url()); } catch { return; }
    const m = u.origin === origin && u.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
    if (!m) return;
    let p = null;
    try { const b = JSON.parse(r.request().postData() || 'null'); p = b && typeof b === 'object' && 'p' in b ? b.p : b; } catch { p = null; }
    const e = { fn: m[1], air: p && (p.airline || (Array.isArray(p.airlines) ? p.airlines[0] : null)), status: r.status(), text: null };
    got.push(e);
    r.text().then((t) => { e.text = t; }, () => { e.text = '（読めない）'; });
  });
  await o.page.goto(CUR.env.url + url, { waitUntil: 'domcontentloaded' });
  return { ...o, got };
}
/* 読み直す（書き留めた返事は空にしてから）。 */
const reload = async (o) => { o.got.length = 0; await o.page.reload({ waitUntil: 'domcontentloaded' }); };
/* その関数がその会社について受け取った、いちばん新しい返事の字（届くまで待つ。来なければ null） */
const reply = async (o, fn, air) => {
  const pick = () => o.got.filter((e) => e.fn === fn && e.air === air && e.text != null).pop();
  await waitFor(() => !!pick(), 15000);
  const e = pick();
  return e ? e.text : null;
};
/* 会社ページの評価と要約：社名の横の星（点数・星の塗り・「n件の評価」）・評価スコアの箱の6つの点・「会員の投稿 n 件」・要約の欄。 */
const coFace = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s), tx = (e) => (e ? e.textContent.trim() : null);
  const hero = q('.pvg-hero .crl[data-live="stars"]'), sc = q('#pvg-score .crl[data-live="score"]'), sum = q('#pvg-score .crl[data-live="summary"]');
  const st = hero && hero.querySelector('.crl-stars:not([data-none])');
  const store = [];
  for (const S of [localStorage, sessionStorage]) for (let i = 0; i < S.length; i++) { const k = S.key(i); store.push(`${k}=${S.getItem(k)}`); }
  return {
    avg: tx(hero && hero.querySelector('.crl-avg')), cnt: tx(hero && hero.querySelector('.crl-cnt')), fill: st ? st.style.getPropertyValue('--crl-fill') : null,
    posts: [...document.querySelectorAll('[data-pvg-n="posts"]')].map((e) => e.textContent.trim()),
    vals: sc ? [...sc.querySelectorAll('.crl-radar-l b')].map((b) => b.textContent) : [],
    sum: !sum ? null : { state: sum.getAttribute('data-state'), why: [...sum.querySelectorAll('[data-why]')].map((x) => x.getAttribute('data-why')),
      text: sum.innerText.trim(),
      good: [...sum.querySelectorAll('.crl-sum-col[data-kind="good"] .crl-sum-t')].map((x) => x.textContent),
      concern: [...sum.querySelectorAll('.crl-sum-col[data-kind="concern"] .crl-sum-t')].map((x) => x.textContent),
      foot: [...sum.querySelectorAll('.crl-sum-by > span')].map((x) => x.textContent) },
    view: document.body.innerText, store: store.join('\n'),
  };
});
/* 会社ページの4つ（星・評価スコア・要約・「会員の投稿」の数）が、その会社について読み終わった */
const coDone = (page, slug) => page.waitForFunction((slug) => {
  const fin = (sel) => { const b = document.querySelector(sel); return !!b && b.getAttribute('data-for') === slug && !['idle', 'loading'].includes(b.getAttribute('data-state')); };
  const n = document.querySelector('[data-pvg-n="posts"]');
  return fin('.pvg-hero .crl[data-live="stars"]') && fin('#pvg-score .crl[data-live="score"]') && fin('#pvg-score .crl[data-live="summary"]')
    && !!n && n.textContent.trim() !== '—';
}, { timeout: 20000, polling: 100 }, slug).then(() => true, () => false);
/* 比較の評価のマス（列の順）と6角形の6つの点（点数で塗れない会社は []） */
const cmpRate = async (page) => {
  const C = await cells(page), F = await figs(page);
  return C.cells.map((c, i) => ({ avg: c.avg, fill: c.fill, cnt: c.cnt, posts: c.posts, none: c.none,
    vals: ((F.cells[i] || {}).vals || []).filter((v) => v !== null) }));
};
const cmpDone = (page, want) => page.waitForFunction((want) => {
  const b = document.querySelector('#cr [data-view="compare"] .crl[data-live="cmp-stars"]');
  return !!b && b.getAttribute('data-for') === want && !['idle', 'loading'].includes(b.getAttribute('data-state'));
}, { timeout: 20000, polling: 100 }, want).then(() => true, () => false);
/* 比較のマスと会社ページが、同じ点数・星の塗り・「n件の評価」・投稿の数・6つの点を出している */
const sameRate = (m, c) => !!m && !!c && m.avg === c.avg && m.fill === c.fill && m.cnt === c.cnt
  && m.posts === `会員の投稿 ${c.posts[0]}件` && c.posts.length === 1 && J(m.vals) === J(c.vals);

/* ── L1 ───────────────────────────────────────────────────── */
localScene('local-eq', '比較で選べる主要5社：評価と件数が、比較と会社ページで同じ（ゲスト・手元の SQL）', 'eq', async () => {
  const LIT = {
    jal: { avg: '3.5', fill: '70%', cnt: '2件の評価', posts: '会員の投稿 3件', vals: ['4.0', '3.5', '3.0', '3.5', '4.0', '3.0'] },
    ana: { avg: '4.2', fill: '84%', cnt: '1件の評価', posts: '会員の投稿 1件', vals: [] },
    'cathay-pacific': { avg: '4.0', fill: '80%', cnt: '2件の評価', posts: '会員の投稿 2件', vals: ['4.0', '4.0', '4.0', '4.0', '4.0', '4.0'] },
  };
  const isLit = (m, s) => !!m && m.avg === LIT[s].avg && m.fill === LIT[s].fill && m.cnt === LIT[s].cnt && m.posts === LIT[s].posts && J(m.vals) === J(LIT[s].vals);
  const co = {};
  for (const s of ['jal', 'ana', 'cathay-pacific', 'etihad', 'eva-air']) {
    const o = await lopen('pc', null, `/airlines/${s}.html`);
    ok(await coDone(o.page, s), `（前提）会社ページ airlines/${s}.html の評価・評価スコア・要約・「会員の投稿」の数が読み終わった`);
    co[s] = await coFace(o.page);
    await o.close();                                    // 読み終わったページは閉じる（この Mac は 8GB）
  }
  const cmp = await lopen('pc', null, PAIR_URL('jal', 'ana'));
  ok(await cmpDone(cmp.page, 'jal|ana'), '（前提）比較 JAL｜ANA の評価の欄が読み終わった');
  const [J1, A1] = await cmpRate(cmp.page);
  ok(isLit(J1, 'jal') && sameRate(J1, co.jal),
    '★L1 主要5社 JAL：比較と会社ページが同じ ── 3.5・星 70%・「2件の評価」・会員の投稿 3件・6つの点 4.0/3.5/3.0/3.5/4.0/3.0',
    J({ cmp: J1, co: co.jal && { avg: co.jal.avg, fill: co.jal.fill, cnt: co.jal.cnt, posts: co.jal.posts, vals: co.jal.vals } }));
  ok(isLit(A1, 'ana') && sameRate(A1, co.ana),
    '★L1 主要5社 ANA：比較と会社ページが同じ ── 4.2・星 84%・「1件の評価」・会員の投稿 1件・6つの点は無い（点の無い分類がある）',
    J({ cmp: A1, co: co.ana && { avg: co.ana.avg, fill: co.ana.fill, cnt: co.ana.cnt, posts: co.ana.posts, vals: co.ana.vals } }));
  /* ページの中で2社を選び直す：エティハド｜キャセイパシフィック、続けてエバー｜キャセイパシフィック */
  await cmp.page.select('#cr-a', 'etihad');
  await cmp.page.select('#cr-b', 'cathay-pacific');
  ok(await cmpDone(cmp.page, 'etihad|cathay-pacific'), '（前提）ページの中で選び直した エティハド｜キャセイパシフィック の評価の欄が読み終わった');
  const [E1, C1] = await cmpRate(cmp.page);
  ok(!!E1 && E1.none === '会員からの投稿はまだありません' && E1.avg === null && co.etihad.avg === null && J(co.etihad.posts) === '["0"]',
    '★L1 主要5社 エティハド：比較は「会員からの投稿はまだありません」・点数なし（会社ページも点数なし・会員の投稿 0 件）',
    J({ cmp: E1, co: co.etihad && { avg: co.etihad.avg, posts: co.etihad.posts } }));
  ok(isLit(C1, 'cathay-pacific') && sameRate(C1, co['cathay-pacific']),
    '★L1 主要5社 キャセイパシフィック（古い会社コード cathay の1件を含む）：比較と会社ページが同じ ── 4.0・星 80%・「2件の評価」・会員の投稿 2件・6つの点 4.0',
    J({ cmp: C1, co: co['cathay-pacific'] && { avg: co['cathay-pacific'].avg, fill: co['cathay-pacific'].fill, cnt: co['cathay-pacific'].cnt,
      posts: co['cathay-pacific'].posts, vals: co['cathay-pacific'].vals } }));
  await cmp.page.select('#cr-a', 'eva-air');
  ok(await cmpDone(cmp.page, 'eva-air|cathay-pacific'), '（前提）ページの中で選び直した エバー｜キャセイパシフィック の評価の欄が読み終わった');
  const [V1] = await cmpRate(cmp.page);
  ok(!!V1 && V1.none === '会員からの投稿はまだありません' && V1.avg === null && co['eva-air'].avg === null && J(co['eva-air'].posts) === '["0"]',
    '★L1 主要5社 エバー：比較は「会員からの投稿はまだありません」・点数なし（会社ページも点数なし・会員の投稿 0 件）',
    J({ cmp: V1, co: co['eva-air'] && { avg: co['eva-air'].avg, posts: co['eva-air'].posts } }));
  console.log('  ・評価と件数は、比較で選べる主要5社で会社ページと一致を確かめた（新しい形の会社ページは同じ部品・同じ数え方。比較で選べるのは今は主要5社）');
});

/* ── L2 ───────────────────────────────────────────────────── */
localScene('local-post', '投稿の追加・修正・削除のあと、比較と会社ページの評価と件数が一緒に動く（ゲスト・手元の SQL）', 'eq', async (ids) => {
  const co = await lopen('pc', null, '/airlines/jal.html');
  const cmp = await lopen('pc', null, PAIR_URL('jal', 'ana'));
  const both = async () => {
    const a = await coDone(co.page, 'jal'), b = await cmpDone(cmp.page, 'jal|ana');
    return { ready: a && b, co: await coFace(co.page), cmp: (await cmpRate(cmp.page))[0] };
  };
  const show = (x) => J({ cmp: x.cmp, co: { avg: x.co.avg, fill: x.co.fill, cnt: x.co.cnt, posts: x.co.posts, vals: x.co.vals } });
  const x0 = await both();
  ok(x0.ready && !!x0.cmp && x0.cmp.cnt === '2件の評価' && sameRate(x0.cmp, x0.co), '（前提）変える前：JAL は「2件の評価」・会員の投稿 3件で、2つの画面が同じ', show(x0));
  /* 追加：pilot が JAL に [4,4,4,4,4,4]（via） */
  await postAs('pilot', 'jal', [4, 4, 4, 4, 4, 4]);
  await reload(co); await reload(cmp);
  const x1 = await both();
  ok(x1.ready && !!x1.cmp && x1.cmp.avg === '3.7' && x1.cmp.fill === '73.3%' && x1.cmp.cnt === '3件の評価' && x1.cmp.posts === '会員の投稿 4件' && sameRate(x1.cmp, x1.co),
    '★L2 追加（pilot が JAL に1件・via）→ 読み直すと2つの画面が同じ：3.7・星 73.3%・「3件の評価」・会員の投稿 4件', show(x1));
  /* 修正：b の行を全部 5 に（会員の画面が無い ── q() で直接） */
  await CUR.env.q(`update public.reviews_v2 set ${L_SCORES.map((k) => `${k} = 5`).join(', ')} where id = $1`, [ids.b]);
  await reload(co); await reload(cmp);
  const x2 = await both();
  ok(x2.ready && !!x2.cmp && x2.cmp.avg === '4.3' && x2.cmp.fill === '86.7%' && x2.cmp.cnt === '3件の評価' && x2.cmp.posts === '会員の投稿 4件' && sameRate(x2.cmp, x2.co),
    '★L2 修正（b の行の点数を全部 5 に・q()）→ 読み直すと2つの画面が同じ：4.3・星 86.7%', show(x2));
  /* 削除：a の行（q() で直接） */
  await CUR.env.q('delete from public.reviews_v2 where id = $1', [ids.a]);
  await reload(co); await reload(cmp);
  const x3 = await both();
  ok(x3.ready && !!x3.cmp && x3.cmp.avg === '4.5' && x3.cmp.cnt === '2件の評価' && x3.cmp.posts === '会員の投稿 3件' && sameRate(x3.cmp, x3.co),
    '★L2 削除（a の行・q()）→ 読み直すと2つの画面が同じ：4.5・「2件の評価」・会員の投稿 3件', show(x3));
  console.log('  ・修正・削除は会員の画面が無いので、手元のデータベースを直接書き換えて確かめた');
});

/* ── L3 ───────────────────────────────────────────────────── */
const SUM_LOGIN = '{"ok":true,"state":"login"}', SUM_LOCKED = '{"ok":true,"state":"locked"}', SUM_FEW = '{"ok":true,"state":"few"}';
const C_LOCKED = '{"ok":true,"state":"locked"}', C_GIVE = '{"ok":true,"state":"give"}';
const noGates = (F) => !!F && !SUM_TXT(GATES).some((t) => F.html.includes(t) || F.store.includes(t));
/* 比較を1人として開き、要約・評価の欄が読み終わるまで待つ */
const sumOpen = async (who) => {
  const o = await lopen('pc', who, PAIR_URL('jal', 'ana'));
  const ready = await sumDone(o.page, 'jal|ana') && await settled(o.page, 'cmp-stars', 'jal|ana');
  return { ...o, ready };
};
localScene('local-sum', '要約の門を返事の字で：ゲスト・会員（鍵なし）・給与の鍵だけ（期限切れも）・口コミの鍵（手元の SQL）', 'gates', async () => {
  /* ゲスト */
  {
    const o = await sumOpen(null);
    const rj = await reply(o, 'pv_review_summary', 'jal'), ra = await reply(o, 'pv_review_summary', 'ana');
    okSql(exact(rj, SUM_LOGIN) && exact(ra, SUM_FEW), `★L3 ゲスト：比較が JAL の要約に聞いた返事は ${SUM_LOGIN} ちょうど（ANA は ${SUM_FEW}）`, J({ jal: rj, ana: ra }));
    const F = await sumFace(o.page);
    ok(o.ready && !!F && JSON.stringify(F.seen) === JSON.stringify([SUMW.login, 'ログイン']) && noGates(F),
      `★L3 ゲスト：要約の欄は「${SUMW.login}」と「ログイン」だけ・要約の文は画面にも保存領域にも1字も無い`, J(F && { seen: F.seen, gates: !noGates(F) }));
    await o.close();
  }
  /* 会員（どちらの鍵も無い）・給与の鍵だけ */
  for (const who of ['pilot', 'pay']) {
    const o = await sumOpen(who);
    const rj = await reply(o, 'pv_review_summary', 'jal');
    okSql(exact(rj, SUM_LOCKED), `★L3 ${who === 'pay' ? '給与の鍵だけ（給与提出者）：給与の鍵では開かない' : '会員（給与・口コミの鍵なし）'}：JAL の要約の返事は ${SUM_LOCKED} ちょうど`, J({ jal: rj }));
    const F = await sumFace(o.page);
    ok(o.ready && !!F && JSON.stringify(F.seen) === JSON.stringify([SUMW.key]) && noGates(F),
      `★L3 ${who}：要約の欄は「${SUMW.key}」の1行だけ・要約の文は画面にも保存領域にも1字も無い`, J(F && { seen: F.seen, gates: !noGates(F) }));
    await o.close();
  }
  /* 口コミの鍵（a） */
  {
    const o = await sumOpen('a');
    const settledW = await settled3(o.page, 'jal|ana');
    const F = await sumFace(o.page), [A, B] = F && F.cells.length === 2 ? F.cells : [{}, {}];
    ok(o.ready && !!F && F.state === 'open' && A.tag === NAME.jal && J(A.good) === J(GATES.good.slice(0, 2)) && J(A.concern) === J(GATES.concern)
      && A.foot.includes('会員の口コミ 3件から') && B.tag === NAME.ana && B.seen.includes(SUMW.few) && !F.store.includes('GATES'),
    `★L3 a（口コミの鍵）：JAL の札の下に良い点その一・その二と気になる点（会員の口コミ 3件から）・ANA の札の下に「${SUMW.few}」・保存領域に要約の文が無い`,
    J(F && { state: F.state, cells: F.cells.map((c) => ({ tag: c.tag, good: c.good, concern: c.concern, foot: c.foot, seen: c.seen })), store: F.store.includes('GATES') }));
    const W = {};
    for (const fn of ['pv_work_view', 'pv_contrib_facts']) for (const air of ['jal', 'ana']) W[`${fn}:${air}`] = await reply(o, fn, air);
    okSql(settledW && Object.values(W).every((t) => exact(t, C_LOCKED)),
      `★L3 a：月の働き方（pv_work_view）と待遇の答え（pv_contrib_facts）の返事は2社とも ${C_LOCKED} ちょうど（口コミの鍵では開かない）`, J(W));
    const co = await lopen('pc', 'a', '/airlines/jal.html');
    const done = await coDone(co.page, 'jal');
    const C = await coFace(co.page);
    ok(done && !!C.sum && C.sum.state === 'open' && J(C.sum.good.slice(0, 2)) === J(A.good) && J(C.sum.concern) === J(A.concern) && !C.store.includes('GATES'),
      '★L3 a：比較の JAL の2点と気になる点は、会社ページ airlines/jal.html の要約の最初の2点・気になる点と同じ文（保存領域には無い）',
      J({ co: C.sum && { state: C.sum.state, good: C.sum.good, concern: C.sum.concern }, cmp: { good: A.good, concern: A.concern } }));
    await o.close(); await co.close();
  }
  /* 最後に：給与の鍵の期限切れ（pay の access_until を過去へ）→ pay として読み直す */
  await expire('pay');
  {
    const o = await sumOpen('pay');
    const rj = await reply(o, 'pv_review_summary', 'jal');
    okSql(exact(rj, SUM_LOCKED), `★L3 給与の鍵が期限切れの pay：JAL の要約の返事は同じ ${SUM_LOCKED} ちょうど`, J({ jal: rj }));
    const F = await sumFace(o.page);
    ok(o.ready && !!F && JSON.stringify(F.seen) === JSON.stringify([SUMW.key]) && noGates(F), `★L3 期限切れの pay：同じ1行「${SUMW.key}」・要約の文は無い`, J(F && F.seen));
  }
});

/* ── L4 ───────────────────────────────────────────────────── */
localScene('local-two', '別のタブで読む人が替わる（サーバーが決める）：a の要約 → pilot の1行 → ログアウトの1行（前の人の文は1字も残らない）', 'gates', async () => {
  const o = await sumOpen('a');
  const F0 = await sumFace(o.page);
  ok(o.ready && !!F0 && F0.state === 'open' && SUM_TXT(GATES).slice(0, 2).every((t) => F0.seen.includes(t)),
    '（前提）切り替える前：a の比較に JAL の要約の点が出ている（確かめが空振りしていない）', J(F0 && F0.seen));
  await H.watch(o.page, 'cmp-summary');
  const mark = await o.page.evaluate(() => { window.__crlNoReload = 1; return (window.__crlSeen || []).length; });
  const n0 = o.st.calls.length;
  o.got.length = 0;                                     // 切り替えたあとの返事だけを見る
  const t = await H.otherTab(o.ctx, CUR.env.local);
  await H.loginIn(t, CUR.env.local, 'pilot');
  const turned = await o.page.waitForFunction(([sel, line]) => { const b = document.querySelector(sel);
    return !!b && b.getAttribute('data-state') === 'locked' && b.innerText.trim() === line; }, { timeout: 15000, polling: 100 }, [SUM_SEL, SUMW.key]).then(() => true, () => false);
  const F1 = await sumFace(o.page);
  const after = o.st.calls.slice(n0).filter((c) => c.name === 'pv_review_summary');
  const rj = await reply(o, 'pv_review_summary', 'jal');
  ok(turned && !!F1 && JSON.stringify(F1.seen) === JSON.stringify([SUMW.key]) && after.length >= 1 && after.every((c) => whoOf(c.auth) === 'pilot') && exact(rj, SUM_LOCKED),
    `★L4 別のタブで pilot が入ると、読み込み直さずに「${SUMW.key}」の1行へ（pilot のログインで聞き直し、サーバーの返事は ${SUM_LOCKED}）`,
    J({ turned, seen: F1 && F1.seen, after: after.map((c) => `${c.p && c.p.airline}:${whoOf(c.auth)}`), jal: rj }));
  const left = (await H.seen(o.page)).slice(mark).filter((s) => SUM_TXT(GATES).some((x) => s.includes(x)));
  ok(left.length === 0 && noGates(F1), '★L4 切り替えたあと要約の欄が取ったどの顔にも、画面にも保存領域にも、a が受け取った要約の文は1字も無い', J(left.slice(0, 3)));
  await H.logoutIn(t);
  const out = await o.page.waitForFunction(([sel, line]) => { const b = document.querySelector(sel);
    return !!b && b.getAttribute('data-state') === 'locked' && b.innerText.trim().startsWith(line); }, { timeout: 15000, polling: 100 }, [SUM_SEL, SUMW.login]).then(() => true, () => false);
  const F2 = await sumFace(o.page);
  ok(out && !!F2 && JSON.stringify(F2.seen) === JSON.stringify([SUMW.login, 'ログイン']) && await o.page.evaluate(() => window.__crlNoReload === 1) && noGates(F2),
    `★L4 別のタブでログアウトすると、読み込み直さずに「${SUMW.login}」と「ログイン」へ`, J({ out, seen: F2 && F2.seen }));
  await t.close();
});

/* ── L5 ───────────────────────────────────────────────────── */
localScene('local-change', '要約は口コミの変化に付いてくる（a が会社ページと比較で読む）：追加では前の要約のまま・修正で消える・預け直しで新しい点・少なくなれば「少ない」', 'gates', async () => {
  const co = await lopen('pc', 'a', '/airlines/jal.html');
  const cmp = await lopen('pc', 'a', PAIR_URL('jal', 'ana'));
  const read2 = async () => {
    const ready = await coDone(co.page, 'jal') && await sumDone(cmp.page, 'jal|ana') && await settled(cmp.page, 'cmp-stars', 'jal|ana');
    const C = await coFace(co.page), F = await sumFace(cmp.page), R = (await cmpRate(cmp.page))[0];
    return { ready, C, F, A: F && F.cells.length === 2 ? F.cells[0] : {}, R };
  };
  const show = (x) => J({ co: x.C.sum, cmp: x.A && { good: x.A.good, concern: x.A.concern, foot: x.A.foot, seen: x.A.seen }, posts: x.R && x.R.posts });
  const has = (x, S) => SUM_TXT(S).some((t) => x.C.view.includes(t) || (x.F && x.F.html.includes(t)));
  const x0 = await read2();
  ok(x0.ready && !!x0.C.sum && x0.C.sum.state === 'open' && J(x0.A.good) === J(GATES.good.slice(0, 2)), '（前提）変える前：2つの画面に JAL の要約（GATES）が出ている', show(x0));
  /* (0) pilot が JAL に1件（via）→ 要約はそのまま（指紋は要約のいちばん新しい口コミまでを見る ＝ あとの追加では崩れない） */
  await postAs('pilot', 'jal', [4, 4, 4, 4, 4, 4]);
  await reload(co); await reload(cmp);
  const x1 = await read2();
  ok(x1.ready && x1.C.sum.state === 'open' && J(x1.C.sum.good.slice(0, 2)) === J(GATES.good.slice(0, 2)) && x1.C.sum.foot.includes('会員の口コミ 3件から')
    && J(x1.A.good) === J(GATES.good.slice(0, 2)) && x1.A.foot.includes('会員の口コミ 3件から') && !!x1.R && x1.R.posts === '会員の投稿 4件' && J(x1.C.posts) === '["4"]',
  '★L5 (0) 追加（pilot・via）のあと：2つの画面とも要約はそのまま・足元は「会員の口コミ 3件から」・評価の側は会員の投稿 4件', show(x1));
  console.log('  ・追加のあと、要約が作り直されるまで「会員の口コミ N件から」は前の件数のまま。');
  /* (1) a の JAL の給与のひとことを書き換える（会員の画面が無い ── q()）→ 2つの画面とも「まだありません」 */
  await CUR.env.q("update public.reviews_v2 set salary_comment = '手元の検査で書き換えたひとことです（実在の投稿ではありません）。' where id = $1", [await rowOf('a', 'jal')]);
  await reload(co); await reload(cmp);
  const x2 = await read2();
  ok(x2.ready && J(x2.C.sum.why) === '["none"]' && x2.C.sum.text === SUMW.none && x2.A.seen.includes(SUMW.none) && !has(x2, GATES),
    `★L5 (1) 修正（a の給与のひとこと・q()）のあと：2つの画面とも「${SUMW.none}」・前の要約の文は1字も無い`, show(x2));
  /* (2) 運営が2つめの要約を預ける（同じ口・別の字・いまの口コミの id）→ 新しい2点・前の文は無い */
  await storeSum(NEWSUM);
  await reload(co); await reload(cmp);
  const x3 = await read2();
  ok(x3.ready && x3.C.sum.state === 'open' && J(x3.C.sum.good.slice(0, 2)) === J(NEWSUM.good.slice(0, 2)) && J(x3.A.good) === J(NEWSUM.good.slice(0, 2))
    && J(x3.A.concern) === J(NEWSUM.concern) && !has(x3, GATES),
  '★L5 (2) 運営が預け直したあと：2つの画面とも新しい要約の最初の2点（NEW …）・前の要約の文は1字も無い（預けると読むのは手元の SQL・AI の作り直しは走らせていない）', show(x3));
  /* (3) b と pilot の JAL の行を消す（q()）→ JAL の読める口コミは2件 →「少ない」 */
  await CUR.env.q("delete from public.reviews_v2 where id::text = any(string_to_array($1, ','))", [[await rowOf('b', 'jal'), await rowOf('pilot', 'jal')].join(',')]);
  await reload(co); await reload(cmp);
  const x4 = await read2();
  /* 比較は2社とも「少ない」になる（ANA は1件）── 同じ文なら欄に1回（会社の札を付けない・場面 sumquiet の決まり） */
  ok(x4.ready && J(x4.C.sum.why) === '["few"]' && x4.C.sum.text === SUMW.few && !!x4.F && JSON.stringify(x4.F.seen) === JSON.stringify([SUMW.few])
    && !has(x4, NEWSUM) && !has(x4, GATES),
  `★L5 (3) 削除（b と pilot の JAL の行・q()）のあと：2つの画面とも「${SUMW.few}」（比較は2社とも少ないので1回）・要約の文は1字も無い`,
  J({ co: x4.C.sum, cmp: x4.F && x4.F.seen }));
});

/* ── L6 ───────────────────────────────────────────────────── */
localScene('local-mix', '会社ごとの答え（サーバーが決める）：給与提出者（自分の会社 JAL・答えは5つ未満）→ 期限切れ', 'gates', async () => {
  const o = await lopen('pc', 'pay', PAIR_URL('jal', 'ana'));
  const ready = await settled3(o.page, 'jal|ana');
  const F = await faces3(o.page);
  const [wj, wa] = (F.W && F.W.cols) || [], [qj, qa] = (F.Q && F.Q.cols) || [], [pj, pa] = (F.P && F.P.cols) || [];
  ok(ready && !!wj && !!wa && wj.airline === 'jal' && wj.tag === NAME.jal && wj.text.includes('まだ集計がありません') && wj.locks.length === 0
    && wa.airline === 'ana' && wa.tag === NAME.ana && J(wa.locks) === J([LINE.give]) && wa.give === 1,
  `★L6 pay：月の働き方 ── JAL の札の下に「まだ集計がありません」（月の記録が無い）・ANA の札の下に「${LINE.give}」と答えるカード`, J(F.W && F.W.cols));
  ok(!!qj && !qa && qj.airline === 'jal' && qj.text.includes(labelOf(WK)) && qj.text.includes(ansOf(WK)) && qj.text.includes('3人'),
    `★L6 pay：すぐ下の回答 ── JAL の札の下に「${labelOf(WK)}」の答え（台帳の名前「${ansOf(WK)}」・3人）・ANA の分は描かない`, J(F.Q && F.Q.cols));
  ok(!!pj && !!pa && pj.text.includes('まだ集計がありません') && pj.locks.length === 0 && J(pa.locks) === J([LINE.give]) && pa.give === 0,
    `★L6 pay：待遇 ── JAL の札の下に「まだ集計がありません」・ANA の札の下に「${LINE.give}」の1行`, J(F.P && F.P.cols));
  const ra = { work: await reply(o, 'pv_work_view', 'ana'), facts: await reply(o, 'pv_contrib_facts', 'ana') };
  okSql(exact(ra.work, C_GIVE) && exact(ra.facts, C_GIVE), `★L6 pay：ANA についての返事は2つとも ${C_GIVE} ちょうど（値は1つも来ない）`, J(ra));
  /* 期限切れ（pay の access_until を過去へ）→ 読み直す */
  await expire('pay');
  await reload(o);
  const ready2 = await settled3(o.page, 'jal|ana');
  const G = await faces3(o.page);
  ok(ready2 && G.W.text === LINE.locked && G.P.text === LINE.locked && G.Q.text === '' && G.Q.h === 0,
    `★L6 期限切れの pay：月の働き方と待遇は「${LINE.locked}」・すぐ下の回答は畳む（高さ 0）`, J({ W: G.W && G.W.text, P: G.P && G.P.text, Q: G.Q && [G.Q.text, G.Q.h] }));
  const R4 = {};
  for (const fn of ['pv_work_view', 'pv_contrib_facts']) for (const air of ['jal', 'ana']) R4[`${fn}:${air}`] = await reply(o, fn, air);
  okSql(Object.values(R4).every((t) => exact(t, C_LOCKED)), `★L6 期限切れの pay：4つの返事（2つの口 × 2社）が全部 ${C_LOCKED} ちょうど`, J(R4));
});

/* ── L8 ───────────────────────────────────────────────────── */
localScene('local-both', '2つの鍵（c：JAL の口コミ・自分の会社 ANA の給与）── 鍵は自分の欄だけを閉じる（給与の鍵を外す／口コミの鍵を外す）', 'gates', async (made, at0) => {
  const faceOf = async (o) => {
    const ready = await sumDone(o.page, 'jal|ana') && await settled3(o.page, 'jal|ana');
    const S = await sumFace(o.page), F = await faces3(o.page);
    return { ready, S, F, A: S && S.cells.length === 2 ? S.cells[0] : {} };
  };
  const show = (x) => J({ sum: x.S && (x.S.state === 'open' ? x.A.good : x.S.seen), W: x.F.W && x.F.W.cols.map((c) => [c.airline, c.text.slice(0, 40), c.locks, c.give]),
    Q: x.F.Q && [x.F.Q.h, x.F.Q.cols.map((c) => c.airline)], P: x.F.P && x.F.P.cols.map((c) => [c.airline, c.text.slice(0, 40), c.locks]) });
  const sumOpenJal = (x) => !!x.S && x.S.state === 'open' && J(x.A.good) === J(GATES.good.slice(0, 2));
  const col = (x, k, air) => ((x.F[k] && x.F[k].cols) || []).find((c) => c.airline === air);
  /* c の顔：W と P は ANA（自分の会社）が開き JAL は1行・カードは W にだけ・Q は JAL を描かない */
  const cFace = (x) => {
    const wj = col(x, 'W', 'jal'), wa = col(x, 'W', 'ana'), pj = col(x, 'P', 'jal'), pa = col(x, 'P', 'ana');
    return !!wj && !!wa && J(wj.locks) === J([LINE.give]) && wj.give === 1 && wa.text.includes('まだ集計がありません') && wa.locks.length === 0
      && !col(x, 'Q', 'jal') && !!pj && !!pa && J(pj.locks) === J([LINE.give]) && pa.text.includes('まだ集計がありません') && pa.locks.length === 0;
  };
  /* pay の顔（給与の鍵・自分の会社 JAL）：JAL が開き ANA は1行 */
  const payFace = (x) => {
    const wj = col(x, 'W', 'jal'), wa = col(x, 'W', 'ana'), qj = col(x, 'Q', 'jal'), pj = col(x, 'P', 'jal'), pa = col(x, 'P', 'ana');
    return !!wj && !!wa && wj.locks.length === 0 && J(wa.locks) === J([LINE.give]) && !!qj && qj.text.includes(ansOf(WK)) && !col(x, 'Q', 'ana')
      && !!pj && !!pa && pj.locks.length === 0 && J(pa.locks) === J([LINE.give]);
  };
  const o = await lopen('pc', 'c', PAIR_URL('jal', 'ana'));
  const x0 = await faceOf(o);
  ok(x0.ready && sumOpenJal(x0) && cFace(x0),
    `★L8 c（2つの鍵）：要約の欄に JAL の点（口コミの鍵）・月の働き方と待遇は ANA（自分の会社）の「まだ集計がありません」と JAL の「${LINE.give}」（カードは月の働き方に1枚）・すぐ下の回答は JAL を描かない`, show(x0));
  /* (i) 給与の鍵を外す：c の access_until を過去へ */
  await expire('c');
  await reload(o);
  const x1 = await faceOf(o);
  ok(x1.ready && sumOpenJal(x1) && x1.F.W.text === LINE.locked && x1.F.P.text === LINE.locked,
    `★L8 (i) c の給与の鍵を外す：要約はそのまま開いている・月の働き方と待遇は「${LINE.locked}」`, show(x1));
  await restoreKey(at0, 'c');
  await reload(o);
  const x2 = await faceOf(o);
  ok(x2.ready && sumOpenJal(x2) && cFace(x2), '★L8 (i) 給与の鍵を戻して読み直すと、前と同じ顔', show(x2));
  /* (ii) 口コミの鍵を外す：JAL の3件には触らない（消すと JAL の要約が誰にとっても「少ない」になる ＝ 鍵の証明にならない）。
     pay が ANA に口コミを1件（via）→ pay は2つの鍵 → その ANA の行を消す（q()）→ pay の口コミの鍵だけが無くなる */
  const idAna = await postAs('pay', 'ana', [4, 4, 4, 4, 4, 4]);
  const p = await lopen('pc', 'pay', PAIR_URL('jal', 'ana'));
  const y0 = await faceOf(p);
  ok(y0.ready && sumOpenJal(y0) && payFace(y0),
    `★L8 (ii) pay が ANA に口コミ1件（via）→ 2つの鍵：要約の欄に JAL の点・月の働き方／回答／待遇は JAL（自分の会社）が開き ANA は「${LINE.give}」`, show(y0));
  await CUR.env.q('delete from public.reviews_v2 where id = $1', [idAna]);
  await reload(p);
  const y1 = await faceOf(p);
  ok(y1.ready && !!y1.S && JSON.stringify(y1.S.seen) === JSON.stringify([SUMW.key]) && noGates(y1.S) && payFace(y1),
    `★L8 (ii) その ANA の行を消す（q()）→ 要約の欄は「${SUMW.key}」の1行（JAL の預けた要約はそのまま）・月の働き方／回答／待遇は前と同じ`, show(y1));
  const rj = await reply(p, 'pv_review_summary', 'jal');
  okSql(exact(rj, SUM_LOCKED), `★L8 (ii) 給与の鍵が生きていても、口コミの鍵が無ければ JAL の要約の返事は ${SUM_LOCKED} ちょうど`, J({ jal: rj }));
  console.log('  ・2つの鍵は、それぞれ自分の欄だけを閉じる（給与の鍵 ＝ 月の働き方・待遇／口コミの鍵 ＝ 要約）');
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
