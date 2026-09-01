/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — db/usage.mjs  v1.0
   「いま何人が登録して、何人が実際に使っているか」を1コマンドで出す。

   ── なぜ要るか ────────────────────────────────────────────────
   2026-08-15、「サイトを新しくしてから登録した人・使った人はいるか」を
   その場で手書きのクエリで数えた。素の数字を見て分かったのは、
   **給与レポート3件が全部、動作確認用のテストアカウントのものだった**こと。
   つまり素の合計を見ると、動作確認を実績と読み違える。
   毎回同じクエリを書き直すのも無駄なので、数え方をここに固定する。

   ── 設計上の約束 ──────────────────────────────────────────────
   1. **読むだけ。** ファイルを1つも書かない。
      RESEND_API_KEY を読まない＝メールを送る道を最初から持たない。
      投げるのは GET と、**読み取り専用の関数を呼ぶ POST だけ**。
      後者は /rest/v1/rpc/… で、呼べる関数名を下の RPC_READONLY に**列挙**してある
      （表への POST は書き込みになるので、この道からは投げられない）。
   2. **テスト用アカウントを除外して数える。** 除外リストは mail-bot/.env に置く
      （このリポジトリは PUBLIC。実在のメールアドレスをコミットしない）。
      未設定なら黙って全部を実績にせず、冒頭で警告する。
   3. メールアドレスは既定でマスクする。--emails のときだけ全部出す。

   ── 使い方 ────────────────────────────────────────────────────
     node db/usage.mjs                     直近30日
     node db/usage.mjs --days 7
     node db/usage.mjs --since=2026-08-11  その日から今日まで
     node db/usage.mjs --all               開設以来
     node db/usage.mjs --emails            メールをマスクしない
     node db/usage.mjs --founding          FOUNDING PILOT 100 の番号（誰が何番か＋貼るSQL）

   ── 要るもの（mail-bot/.env・gitignore 済み）────────────────────
     SUPABASE_URL / SUPABASE_SERVICE_KEY … 必須
     PV_TEST_EMAILS … 任意。テスト用アカウントをカンマ区切りで。
                      * は任意の文字列（例: pv.test+*@example.com）

   ── ここで分からないこと（数字の横にも出す）────────────────────
   ・**訪問者数（PV/UU）は出せない。** DB に残るのは「登録した・投稿した」だけ。
     訪問は GA4（index.html の G-… ）でしか見られない。
   ・**明細の読み取り回数は、誰の分か切り分けられない。** pv_parse_quota.subject は
     Supabase 側の secret（PV_IP_SALT）で HMAC した値で、手元では復元できない。
     オーナー自身の動作確認も同じ数に混ざる。
   ・**その回数は「試した回数」であって「読めた回数」ではない。** AI に投げる前に数えて
     いて、失敗しても戻さない（supabase/functions/parse-payslip/index.ts）。
     つまり読み取り失敗も1回として入っている。
   ・**どこで諦めたかは DB では分からない。** 明細を載せた・送った・読めた、の途中経過は
     DB に残らない。GA4 の payslip_* の目印で見る。
   ・**profiles.created_at は登録日ではない。** 移行時にまとめて作られた行があるので、
     登録日は auth.users を正とする。
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

/* 絶対パスを書かない（公開リポジトリ：ログイン名がそのまま漏れる）。 */
const ROOT = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');

/* ── .env（db/eval-payslip.mjs と同じ読み方）── */
const envPath = path.join(ROOT, 'mail-bot/.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const [k, ...v] = s.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY がありません（mail-bot/.env）。');
  process.exit(1);
}
const H = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY };

/* ── 引数 ── */
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => {
  const i = argv.findIndex((a) => a === f || a.startsWith(f + '='));
  if (i < 0) return null;
  return argv[i].includes('=') ? argv[i].slice(argv[i].indexOf('=') + 1) : (argv[i + 1] ?? null);
};
const SHOW_EMAIL = has('--emails');
let sinceIso = null, spanLabel = '';
if (has('--all')) {
  spanLabel = '開設以来';
} else if (val('--since')) {
  const d = new Date(val('--since'));
  if (Number.isNaN(+d)) { console.error('❌ --since の日付が読めません（例: --since=2026-08-11）'); process.exit(1); }
  sinceIso = d.toISOString();
  spanLabel = `${val('--since')} 以降`;
} else {
  const days = Math.max(1, Number(val('--days') ?? 30) || 30);
  sinceIso = new Date(Date.now() - days * 86400_000).toISOString();
  spanLabel = `直近${days}日`;
}

/* ── テスト用アカウント（* は任意の文字列。pv.test+*@example.com のように途中でも使える）
   ★末尾だけの前方一致にしていて実際に取りこぼした。Gmail の +別名は
     「local+なにか@gmail.com」＝ * が真ん中に来るので、前方一致では当たらない。 ── */
const TEST_PATTERNS = String(process.env.PV_TEST_EMAILS ?? '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  .map((p) => new RegExp('^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'));
const isTestEmail = (email) => {
  const e = String(email ?? '').toLowerCase();
  return !!e && TEST_PATTERNS.some((re) => re.test(e));
};

/* ── 表示 ── */
const mask = (e) => {
  const s = String(e ?? '');
  if (SHOW_EMAIL) return s || '(メールなし)';
  const i = s.indexOf('@');
  return i < 1 ? '(メールなし)' : s.slice(0, 2) + '***' + s.slice(i);
};
const day = (t) => String(t ?? '').slice(0, 10);
const inSpan = (t) => !sinceIso || (t && t >= sinceIso);
/* 見出しの幅は文字数でなく見た目で揃える（日本語は2つぶんの幅を取る）。 */
const width = (s) => [...String(s)].reduce((n, c) => n + (c.codePointAt(0) < 0x100 ? 1 : 2), 0);
const line = (label, ...rest) => console.log('   ' + label + ' '.repeat(Math.max(1, 26 - width(label))) + rest.join(''));

/* ── Supabase REST（読むだけ）── */
async function rest(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: H });
  if (!res.ok) throw new Error(`${table} ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.json();
}
/* ── 読み取り専用の関数を呼ぶ（約束1）───────────────────────────
   なぜ POST が要るか。REAL PAY の画面に出る数を確かめるには、金額の出し方を
   知っている必要がある。それを**ここに書き写すと本物からずれる**（預かりの
   年換算は住居手当や時間給まで見る長い式で、db/pay-reports.sql が正）。
   だから式は書かず、DB にある本物の関数をそのまま呼ぶ。どれも stable＝読むだけ。
   ★呼べる名前をここに列挙する。表への POST（＝書き込み）はこの道を通らない。 */
const RPC_READONLY = new Set(['pv_pending_usd', 'pv_airline_resolve']);
async function rpcRead(fn, args) {
  if (!RPC_READONLY.has(fn)) throw new Error(`rpcRead: ${fn} は読み取り専用の一覧にありません`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn} ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

/* auth.users は REST に出ないので Admin API。1000人を超えたら頁を送る。 */
async function authUsers() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200&page=${page}`, { headers: H });
    if (!res.ok) throw new Error(`auth ${res.status} ${(await res.text()).slice(0, 160)}`);
    const j = await res.json();
    const us = j.users ?? [];
    out.push(...us);
    if (us.length < 200) break;
  }
  return out;
}

/* 口コミも給与レポートも user_id を持たない（本人が特定されない設計）。
   代わりに proof_hash があり、**式に秘密の塩が入っていない**ので手元でも作れる。
   これでテストアカウントの投稿だけを正確に外せる。突き合わせの手段はこれしかない。
     給与レポート  sha256(uid || '::pv_pay::'  || airline [|| '::' || lower(airline_other)])
                   … db/pay-reports.sql:925（submit_pay_report）
     口コミ        sha256(uid || '::pv_anon::' || airline || '::2026')
                   … submit-review.html:1227（airline は「その他」なら自由入力の社名）
   ★口コミは航空会社コードを付け替えた移行（db/migrate-airline-codes.sql）より前の行だと
     hash が旧コードのままなので一致しない。古い自分の投稿は落としきれないことがある。
   ⚠️ 下の「3-c」も同じ写し取りをしている。あちらは db/pay-rows.sql の
      数え方（sane / person / tally / airs / contrib）を写している。
      contrib だけは pv_deep_contributors()（＝実際の人数）と同じ数え方。
      **pay-rows.sql の数え方を変えたら 3-c も直す**（金額の出し方は写していない。
      本物の関数を呼んでいる＝上の rpcRead）。 */
const payHash = (uid, airline, other) =>
  createHash('sha256')
    .update(`${uid}::pv_pay::${airline}${other ? '::' + String(other).toLowerCase() : ''}`)
    .digest('hex');
const reviewHash = (uid, airline) =>
  createHash('sha256').update(`${uid}::pv_anon::${airline}::2026`).digest('hex');

/* ════════════════════════════════════════════════════════════════
   --founding — FOUNDING PILOT 100（創設メンバー）の番号を出す。読むだけ。

   称号の順番は「登録した順」ではなく「一次データを最初に出した順」。
   ・登録順は使えない。profiles.created_at は移行でまとめて作られた行があり、
     auth.users.created_at も「登録しただけの人」を先頭に並べてしまう。
   ・出した順なら VISION.md の North Star（月間一次データ投稿数）と同じ向きを向く。

   ここが出すのは2つだけ:
     1. 誰が何番になるか（メールは既定でマスク。--emails で全部出る）
     2. オーナーが Supabase の SQL Editor にそのまま貼れる backfill の1行

   ★ uuid はリポジトリに書かない。標準出力にしか出さない（PUBLIC リポジトリ）。
   ════════════════════════════════════════════════════════════════ */
async function foundingReport(users, testIds, real) {
  console.log('');
  console.log('━━ FOUNDING PILOT 100（創設メンバー）' + '━'.repeat(24));
  console.log('   給与レポートか口コミを**最初に出した順**に 1 番から振ります。');
  console.log('   登録順ではありません（登録しただけの人には番号が入らない）。');
  if (!TEST_PATTERNS.length) {
    console.log('');
    console.log('   ⚠️  PV_TEST_EMAILS が未設定です。このまま貼ると**動作確認用の');
    console.log('      アカウントに番号が入ります**。mail-bot/.env に足してから流し直してください。');
  }

  const [rv, pr] = await Promise.all([
    rest('reviews_v2', 'select=created_at,proof_hash,airline&limit=5000'),
    rest('pay_reports', 'select=created_at,proof_hash,airline,airline_other&limit=5000'),
  ]);

  /* proof_hash は行の airline から作るので、ユーザー × 行の総当たりで突き合わせる。
     いま 31人 × 25行。1万人になっても backfill は SQL 側でやるので、ここは確認用。 */
  const first = new Map();                       // uid -> { at, src }
  const put = (uid, at, src) => {
    const cur = first.get(uid);
    if (!cur || String(at) < String(cur.at)) first.set(uid, { at, src });
  };
  for (const u of users) {
    for (const r of rv) if (reviewHash(u.id, r.airline) === r.proof_hash) put(u.id, r.created_at, 'review');
    for (const r of pr) if (payHash(u.id, r.airline, r.airline_other) === r.proof_hash) put(u.id, r.created_at, 'pay');
  }

  const byTime = (a, b) => {
    const x = first.get(a.id).at, y = first.get(b.id).at;
    if (x !== y) return x < y ? -1 : 1;
    return a.id < b.id ? -1 : 1;                 // 同時刻は uuid 順（SQL 側と同じ決め方）
  };
  const ranked = real.filter((u) => first.has(u.id)).sort(byTime);
  const testContrib = [...testIds].filter((id) => first.has(id));

  /* ── いま DB に入っている番号（表がまだ無ければ、まだ流していないだけ）── */
  let awarded = null;
  try {
    awarded = await rest('founding_members', 'select=user_id,no,first_source,awarded_at&order=no.asc&limit=200');
  } catch (e) {
    if (!/\b404\b|PGRST205|does not exist/i.test(e.message)) throw e;
  }
  const noById = new Map((awarded ?? []).map((r) => [r.user_id, r.no]));

  console.log('');
  console.log('■ 番号が入る人（' + ranked.length + '人）');
  if (!ranked.length) {
    console.log('   まだ1人もいません。');
  } else {
    console.log('   No.   最初に出した日   入れ方   いまDBに   メール');
    ranked.forEach((u, i) => {
      const f = first.get(u.id);
      const want = i + 1;
      const got = noById.get(u.id);
      const mark = awarded === null ? '  −  '
        : got === undefined ? ' なし '
        : got === want ? '  ✅ '
        : ' ⚠️ ' + got;
      console.log('   ' + String(want).padStart(3) + '   ' + day(f.at)
        + '       ' + (f.src === 'review' ? '口コミ' : '給与  ')
        + '   ' + mark + '    ' + mask(u.email));
    });
  }

  if (testContrib.length) {
    console.log('');
    console.log('   （動作確認用として ' + testContrib.length + 'アカウントを番号から外しました）');
  }

  /* ── 貼る1行 ─────────────────────────────────────────────── */
  /* ★uuid は標準出力にだけ出す。リポジトリには1文字も書かない（PUBLIC）。 */
  const backfillLine = () => {
    if (!testIds.size) { console.log('   select public.pv_backfill_founding();'); return; }
    console.log('   select public.pv_backfill_founding(array[');
    console.log([...testIds].map((id) => "     '" + id + "'").join(',\n'));
    console.log('   ]::uuid[]);');
  };

  console.log('');
  if (awarded === null) {
    /* 表がまだ無い。★それでも1行は出す ―― 出さないと
       「SQL を貼る → ここを流し直す → もう一度貼る」と2往復になる。
       中身は表の有無に関係なく決まる（動作確認用アカウントの id だけ）。 */
    console.log('■ まだ置き場がありません');
    console.log('   Supabase の SQL Editor で、この順に流してください。');
    console.log('');
    console.log('   ① db/founding.sql を丸ごと貼って実行');
    console.log('   ② 続けてこの1行を貼って実行（動作確認用のアカウントを外します）');
    console.log('');
    backfillLine();
    console.log('');
    console.log('   ※ ②は何度流しても同じ結果になります（すでに番号がある人は触りません）。');
  } else if (ranked.every((u, i) => noById.get(u.id) === i + 1) && noById.size === ranked.length) {
    console.log('■ 済んでいます（' + ranked.length + '人に番号が入っています）');
  } else {
    console.log('■ Supabase の SQL Editor に貼る1行（動作確認用のアカウントを外します）');
    console.log('');
    backfillLine();
    console.log('');
    console.log('   ※ 何度流しても同じ結果になります（すでに番号がある人は触りません）。');
  }
  console.log('');
}

(async () => {
  const [users, profiles] = await Promise.all([
    authUsers(),
    rest('profiles', 'select=id,email_opt_in,pay_report_count&limit=5000'),
  ]);

  const testIds = new Set(users.filter((u) => isTestEmail(u.email)).map((u) => u.id));
  const real = users.filter((u) => !testIds.has(u.id));
  const profById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  if (has('--founding')) { await foundingReport(users, testIds, real); return; }

  console.log('');
  console.log('━━ PILOT VALUE 利用状況 ' + '━'.repeat(30));
  console.log(`   期間: ${spanLabel}（${new Date().toISOString().slice(0, 10)} 時点）`);
  if (!TEST_PATTERNS.length) {
    console.log('');
    console.log('   ⚠️  テスト用アカウントの除外リスト（PV_TEST_EMAILS）が未設定です。');
    console.log('      いま出ている数には**あなた自身の動作確認が実績として混ざっています**。');
    console.log('      mail-bot/.env に 1行足してください（例）:');
    console.log('        PV_TEST_EMAILS=jibun@example.com,pv.test+*@example.com');
  } else {
    console.log(`   テスト用として除外: ${testIds.size}アカウント`);
  }

  /* ── 1. 会員 ───────────────────────────────────────────── */
  console.log('\n■ 会員（登録日は auth.users が正）');
  const fresh = real.filter((u) => inSpan(u.created_at)).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  line('期間内の新規登録', `${fresh.length}人`);
  const byDay = {};
  for (const u of fresh) (byDay[day(u.created_at)] ??= []).push(u);
  for (const d of Object.keys(byDay).sort()) {
    line('  ' + d, `${byDay[d].length}人  `, byDay[d].map((u) => mask(u.email)).join(', '));
  }
  line('累計（実ユーザー）', `${real.length}人`, testIds.size ? `　＋テスト用 ${testIds.size}人` : '');
  /* 「登録した日より後にログインした」＝一度は戻ってきた人。
     フライホイールが回っているかは、登録数よりこちらで見る。 */
  const returned = real.filter((u) => u.last_sign_in_at && day(u.last_sign_in_at) > day(u.created_at));
  line('戻ってきた人（累計）', `${returned.length}人 / ${real.length}人`);
  const activeInSpan = real.filter((u) => inSpan(u.last_sign_in_at));
  line('期間内のログイン', `${activeInSpan.length}人`);
  line('メールを受け取る', `${real.filter((u) => profById[u.id]?.email_opt_in).length}人`);

  /* ── 2. 口コミ ─────────────────────────────────────────── */
  console.log('\n■ 口コミ');
  try {
    const rv = await rest('reviews_v2', 'select=created_at,proof_hash,airline&order=created_at.desc&limit=5000');
    const testRvHashes = new Set();
    for (const id of testIds) for (const r of rv) testRvHashes.add(reviewHash(id, r.airline));
    const realRv = rv.filter((r) => !testRvHashes.has(r.proof_hash));
    line('期間内', `${realRv.filter((r) => inSpan(r.created_at)).length}件`);
    line('累計（実ユーザー）', `${realRv.length}件`, rv.length - realRv.length ? `　＋テスト ${rv.length - realRv.length}件` : '');
    line('最後の投稿', realRv.length ? day(realRv[0].created_at) : '（まだ無し）');
    const byAir = {};
    for (const r of realRv) byAir[r.airline] = (byAir[r.airline] ?? 0) + 1;
    const top = Object.entries(byAir).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (top.length) line('航空会社別（累計）', top.map(([a, n]) => `${a} ${n}`).join(' / '));
  } catch (e) { line('取得できず', e.message); }

  /* ── 3. 給与レポート ───────────────────────────────────── */
  /* まとめの1行で「読ませようとした人／保存まで届いた人」を並べるため、
     3と4の結果をここで受ける（取得できなかったときは null のまま出さない）。 */
  let paidPeople = null;   // 給与レポートを保存できた実人数（累計）
  let tryPeople = null;    // 明細を読ませようとした人（累計・のべ端末）
  console.log('\n■ 給与レポート（一次データ。ここが増えないと事業は前に進まない）');
  try {
    const pr = await rest('pay_reports', 'select=created_at,airline,airline_other,source,proof_hash&order=created_at.desc&limit=5000');
    /* テストアカウントの投稿を proof_hash で正確に落とす。 */
    const testHashes = new Set();
    for (const id of testIds) for (const r of pr) testHashes.add(payHash(id, r.airline, r.airline_other));
    const realPr = pr.filter((r) => !testHashes.has(r.proof_hash));
    const testPr = pr.length - realPr.length;
    line('期間内', `${realPr.filter((r) => inSpan(r.created_at)).length}件`);
    line('累計（実ユーザー）', `${realPr.length}件`, testPr ? `　＋あなたのテスト ${testPr}件` : '');
    paidPeople = new Set(realPr.map((r) => r.proof_hash)).size;
    line('出した実人数', `${paidPeople}人`);
    const bySrc = {};
    for (const r of realPr) bySrc[r.source] = (bySrc[r.source] ?? 0) + 1;
    if (realPr.length) line('入れ方', Object.entries(bySrc).map(([s, n]) => `${s === 'payslip' ? '明細から' : '手入力'} ${n}`).join(' / '));
  } catch (e) { line('取得できず', e.message); }

  /* ── 3-b. アカウントを作る前に預かった給与データ ─────────────
     2026-08-17 から、送信を押した時点でサーバに保存される（db/pay-report-pending.sql）。
     ★ここの「まだ紐付いていない」＝**出したのに会員にならなかった人**。
       この事業でいちばん知りたい数字なので、上の給与レポート件数だけを見て
       「増えた／増えない」を判断しないこと。 */
  let pendTotal = null, pendOpen = null;
  console.log('\n■ 預かり（アカウントを作る前に出された給与データ）');
  try {
    const pd = await rest('pay_reports_pending', 'select=created_at,claimed_at,airline,lang,ip_day_hash&order=created_at.desc&limit=5000');
    pendTotal = pd.length;
    const done = pd.filter((r) => r.claimed_at);
    pendOpen = pd.length - done.length;
    line('期間内に預かった', `${pd.filter((r) => inSpan(r.created_at)).length}件`);
    line('累計', `${pendTotal}件`, `　うち本人に紐付いた ${done.length}件`);
    line('まだ紐付いていない', `${pendOpen}件`, pendTotal ? `　（出した人の ${Math.round((pendOpen / pendTotal) * 100)}%）` : '');
    const byLang = {};
    for (const r of pd) byLang[r.lang ?? '?'] = (byLang[r.lang ?? '?'] ?? 0) + 1;
    if (pendTotal) line('言語', Object.entries(byLang).map(([l, n]) => `${l} ${n}`).join(' / '));
    console.log('   ※ 誰の分かは切り分けられません（あなたの動作確認も同じ数に入ります）。');
    console.log('   ※ 紐付いていない分は公開の中央値には入りません（別のテーブルにあるため）。');

    /* ★まだ紐付いていない分の内訳。同じ日・同じ端末から出たものをまとめて出す。
       件数だけを見ていた間、2026-08-21 に**1人が2件出して登録まで済ませたのに
       1件も紐付いていない**ことに気づけなかった。塊で見えれば、次に同じことが
       起きたとき「何人ぶんが宙に浮いているか」がそのまま読める。
       ⚠️ ip_day_hash は IP と日付から作るので**日が変わると別の値になる**。
          日をまたいだ同じ人は別の塊として出る＝塊の数は人数の上限であって人数ではない。 */
    const open = pd.filter((r) => !r.claimed_at);
    if (open.length) {
      const groups = new Map();
      for (const r of open) {
        const k = r.ip_day_hash || '(不明)';
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      const blocks = [...groups.values()]
        .map((rows) => rows.slice().sort((x, y) => String(x.created_at).localeCompare(String(y.created_at))))
        .sort((x, y) => String(y[0].created_at).localeCompare(String(x[0].created_at)));
      console.log(`   ── 内訳（同じ日・同じ端末でまとめています。${blocks.length}かたまり／時刻は UTC）`);
      for (const rows of blocks) {
        const day = String(rows[0].created_at).slice(0, 10);
        const times = rows.map((r) => String(r.created_at).slice(11, 16)).join(' ');
        line('  ' + day, `${rows.length}件`, `　${rows.map((r) => r.airline || '?').join(' / ')}`, `　${times}`);
      }
      console.log('   ※ 本人がそのブラウザでアカウントを作れば、今でもそのまま紐付きます');
      console.log('     （預かり証は30日で切れます。db/pay-report-pending.sql:231）。');
    }
  } catch (e) {
    /* まだ SQL を流していないだけなら、それと分かる形で出す（エラーに見せない）。 */
    if (/\b404\b|PGRST205|does not exist/i.test(e.message)) {
      line('まだ置き場がありません', 'db/pay-report-pending.sql を Supabase で流すと出ます');
    } else line('取得できず', e.message);
  }

  /* ── 3-c. REAL PAY の画面に出る数 ───────────────────────────
     2026-08-25、オーナーから「実際の値、違くない？ 本当に14人しか居ないの？」。
     そのとおりで、見本は手で書き写した古い値だった。**確かめる先が無かった**のが
     本当の問題なので、ここに置く。本番の画面（actual-pay.html / my-value.html）の
     カードに出るはずの数を、同じ材料・同じ数え方で出す。

     ⚠️ 数え方は db/pay-rows.sql（pv_pay_rows）を**手で写している**。
        あちらを変えたらここも直す。写しているのは「どれを数に入れるか」だけで、
        金額の出し方は写していない（本物の関数を呼ぶ。上の rpcRead）。
     ⚠️ 画面は**ログインした本人**として関数を呼ぶ。ここはサービスキーなので同じ
        呼び方ができない（pv_pay_rows はログインを求めて 42501 を返す）。だから写す。

     材料は3つ。db/pay-rows.sql の 本棚 / 預かり / 口コミ由来 と同じ。 */
  console.log('');
  console.log('■ REAL PAY の画面に出る数（3枚のカード ＋ DEEP PAY の分子）');
  try {
    /* Postgres の now() - interval 'N months' は**暦の月**を引く（月末は繰り上がらず
       その月の末日に丸まる）。30日で引くと境目が数日ずれて件数が食い違うので、
       同じ引き方をする。 */
    const monthsAgo = (n) => {
      const d = new Date();
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() - n);
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      return d.toISOString();
    };
    const MONTHS24 = monthsAgo(24);
    const MONTH1 = monthsAgo(1);
    const [prAll, pdAll, rvAll, vocab, poss, fx, links] = await Promise.all([
      rest('pay_reports', 'select=created_at,airline,airline_other,position,annual_total_usd,proof_hash&limit=5000'),
      rest('pay_reports_pending', 'select=created_at,claimed_at,airline,ip_day_hash,payload&limit=5000'),
      rest('reviews_v2', 'select=id,created_at,airline,position,proof_hash,annual_salary,base_annual,flight_allowance_annual,monthly_salary,bonus&limit=5000'),
      rest('pv_airlines', 'select=code&limit=500'),
      rest('pv_positions', 'select=code&limit=100'),
      rest('fx_rates', 'select=to_usd&code=eq.JPY'),
      rest('pv_review_person', 'select=review_id,pkey&limit=5000'),
    ]);
    const codes = new Set(vocab.map((a) => a.code));
    const posOk = new Set(poss.map((p) => p.code));
    const jpy = fx[0] ? Number(fx[0].to_usd) : null;

    /* 打ち込まれた社名は本物の関数に当ててもらう（同じ文字列は1回だけ聞く）。 */
    const resolved = new Map();
    const resolve = async (typed) => {
      const k = String(typed ?? '');
      if (!resolved.has(k)) resolved.set(k, await rpcRead('pv_airline_resolve', { p_typed: k }));
      return resolved.get(k);
    };

    /* テストアカウントの投稿を見分ける（上の2・3節と同じ写し取り）。
       ★預かりだけは持ち主が分からない（ip_day_hash しか無い）。 */
    const testPay = new Set(), testRv = new Set();
    for (const id of testIds) {
      for (const r of prAll) testPay.add(payHash(id, r.airline, r.airline_other));
      for (const r of rvAll) testRv.add(reviewHash(id, r.airline));
    }

    const src = [];                          // { pkey, airline, pos, usd, cat, from, test }
    /* ① 本棚（会員が出したぶん） */
    const shelfKeys = new Set();
    for (const r of prAll) {
      if (r.annual_total_usd == null || r.created_at < MONTHS24) continue;
      shelfKeys.add('r:' + r.proof_hash);
      src.push({
        pkey: 'r:' + r.proof_hash,
        airline: r.airline === 'other' ? await resolve(r.airline_other) : r.airline,
        pos: r.position, usd: Number(r.annual_total_usd), cat: r.created_at,
        from: 'shelf', test: testPay.has(r.proof_hash),
      });
    }
    /* ② 預かり（まだ本棚に移っていないぶんだけ） */
    for (const q of pdAll) {
      if (q.claimed_at || !q.ip_day_hash || q.created_at < MONTHS24 || !codes.has(q.airline)) continue;
      const usd = await rpcRead('pv_pending_usd', { p: q.payload });
      src.push({
        pkey: 'p:' + q.ip_day_hash,
        airline: q.airline === 'other' ? await resolve(q.payload && q.payload.airline_other) : q.airline,
        pos: q.payload && q.payload.position, usd: usd == null ? null : Number(usd), cat: q.created_at,
        from: 'pending', test: null,         // 誰の分か切り分けられない
      });
    }
    /* ③ 昔の口コミに書かれた給与。金額の順は口コミカードと1文字も違えない
       （総額 ＞ 基本給＋乗務手当＋賞与 ＞ 月給×12＋賞与。0 は「入っていない」と読む）。 */
    const linkBy = Object.fromEntries(links.map((l) => [l.review_id, l.pkey]));
    const POS = { captain: 'cap', sfo: 'fo', tri_tre: 'cap' };
    const nz = (x) => (Number(x) || 0) || null;
    for (const v of rvAll) {
      const pkey = linkBy[v.id];
      if (!pkey || v.created_at < MONTHS24 || shelfKeys.has(pkey)) continue;
      const pos = POS[v.position] ?? v.position;
      if (!posOk.has(pos)) continue;
      const man = nz(v.annual_salary)
        ?? ((nz(v.base_annual) || nz(v.flight_allowance_annual))
              ? (Number(v.base_annual) || 0) + (Number(v.flight_allowance_annual) || 0) + (Number(v.bonus) || 0)
              : null)
        ?? (nz(v.monthly_salary) ? Number(v.monthly_salary) * 12 + (Number(v.bonus) || 0) : null);
      if (man == null || jpy == null) continue;
      src.push({
        pkey, airline: await resolve(v.airline), pos,
        usd: Math.round(man * 10000 * jpy * 100) / 100, cat: v.created_at,
        from: 'review', test: testRv.has(v.proof_hash),
      });
    }

    /* 常識の幅（⑦）。打ち間違いだけを落とす。 */
    const sane = src.filter((r) => r.usd != null && r.usd >= 10000 && r.usd <= 700000);
    const dropped = src.length - sane.length;

    /* 1行＝1人。社数はここから数える（＝表に実際に出てくる会社）。 */
    const seen = new Set();
    for (const r of sane) seen.add([r.pkey, r.airline, r.pos].join(' '));
    const airlines = new Set(sane.map((r) => r.airline));

    /* 出したパイロット（DEEP PAY の分子）。★ここだけ sane から数えない。

       ★2026-09-01、proof_hash ではなく **実際の人数** で数えるようにした。
         proof_hash は（本人 × 会社）で1つなので、2社に出した1人が2人に見えていた。
         db/pay-rows.sql の pv_deep_contributors() と同じ数え方にそろえる
         ── 名簿（profiles）の id から proof_hash を作り直して人に戻す。
         **当たらない行は数えない**（fail closed。あちらの join と同じ）。
       ⚠️ あちらの数え方を変えたらここも直す。
       ⚠️ 会社は「実際に投稿のある会社」だけで総当たりする（全110社ではない）。
          profiles 5000行 × 会社数ぶんの sha256 で済ませるため。 */
    const airSeen = new Map();
    for (const r of prAll) {
      const k = r.airline === 'other'
        ? 'other::' + String(r.airline_other || '').toLowerCase() : r.airline;
      if (!airSeen.has(k)) airSeen.set(k, r);
    }
    const hashToUid = new Map();
    for (const pf of profiles)
      for (const r of airSeen.values())
        hashToUid.set(payHash(pf.id, r.airline, r.airline_other), pf.id);
    const contribReal = new Set(), contribTest = new Set();
    let unmapped = 0;
    for (const r of prAll) {
      const u = hashToUid.get(r.proof_hash);
      if (!u) { unmapped++; continue; }
      (testIds.has(u) ? contribTest : contribReal).add(u);
    }
    const pendPeople = new Set(pdAll.filter((q) => !q.claimed_at && q.ip_day_hash).map((q) => q.ip_day_hash));

    const inMonth = sane.filter((r) => r.cat >= MONTH1);
    const mine = (list) => list.filter((r) => r.test === true).length;
    const both = (list, unit) => {
      const my = mine(list);
      return my ? `　（うちあなたの動作確認 ${my}${unit} → 素の値 ${list.length - my}${unit}）` : '';
    };

    line('実給与の投稿', `${sane.length}件`, both(sane, '件'));
    line('航空会社', `${airlines.size}社`);
    line('1ヶ月以内の新規投稿', `${inMonth.length}件`, both(inMonth, '件'));
    const contribAll = contribReal.size + contribTest.size + pendPeople.size;
    line('出したパイロット', `${contribAll}人`, contribTest.size
      ? `　（うちあなたの動作確認 ${contribTest.size}人 → 素の値 ${contribAll - contribTest.size}人）` : '');

    console.log('   ── 材料の内訳（上の「実給与の投稿」の中身）');
    const FROM = [['shelf', '本棚（会員が出した）'], ['pending', '預かり（登録前）'], ['review', '昔の口コミの給与']];
    for (const [k, label] of FROM) line('  ' + label, `${sane.filter((r) => r.from === k).length}件`);
    if (dropped) line('  常識の幅で落とした', `${dropped}件`, '　（年 $10,000〜$700,000 の外＝打ち間違い）');
    if (unmapped) {
      console.log(`   ※ 名簿に当たらなかった給与レポートが ${unmapped}件あります（人数に入れていません）。`);
      console.log(`      退会などで profiles 行が消えた人の投稿です。画面の数え方（fail closed）と同じ扱いです。`);
    }
    if (pendPeople.size) {
      console.log(`   ※ 「出したパイロット」に入っている預かり ${pendPeople.size}人ぶんは、誰の分か切り分けられません。`);
    }
    console.log('   ※ 画面にこの数が出るのは db/pay-rows.sql を Supabase に貼ったあとです');
    console.log('      （貼るまでカードは1枚も出ません。0 を並べない作りにしてあります）。');
  } catch (e) {
    if (/\b404\b|PGRST205|PGRST202|does not exist/i.test(e.message)) {
      line('まだ数えられません', 'db/pay-rows.sql を Supabase で流すと出ます');
    } else line('取得できず', e.message);
  }

  /* ── 3-d. 整合（データのズレを見つける）─────────────────────
     2026-08-27、オーナーから「給与を出していないのに REAL PAY が見えている人が
     居ないか」。調べたら **4人居た**。門（pv_pay_rows）は正しくて、原因は
     データのズレだった ── 過去に SQL Editor で pay_reports の行だけ手で消し、
     profiles 側に残る「1件出した」という記録（pay_report_count / access_until /
     badge / pay_day_of_month）を戻し忘れた形。

     行を消すときは db/cleanup-test-payslip-row.sql（1人ぶん）か
     db/repair-orphan-unlock.sql（総当たりで全員ぶん）を通す。どちらも10列まとめて
     戻すので、通していればこの節は0のままになる。

     ⚠️ **本番を読む道具はこれ1つしかない。再発はここでしか気づけない。**
        ①と②は正常なら必ず0。1人でも出たら上の SQL を流す。
     ⚠️ ①は「REAL PAY が開いてしまう」ズレ、②は「開くべきなのに開いていない」ズレ。
        向きが逆なので、片方だけ見ても足りない。 */
  console.log('\n■ 整合（①と②は 0人 が正常。0人でなければ下に書いた SQL を流す）');
  try {
    const [prLink, profLink] = await Promise.all([
      rest('pay_reports', 'select=proof_hash,airline,airline_other&limit=5000'),
      rest('profiles', 'select=id,pay_report_count,pay_streak_months,access_until,'
         + 'last_pay_report_at,pay_day_of_month,last_pay_period_ym&limit=5000'),
    ]);
    /* 行の持ち主を総当たりで確定する（db/repair-orphan-unlock.sql の① と同じ考え方）。
       proof_hash の式に秘密の塩が入っていないので手元でも作れる。 */
    const ownerOf = new Set();
    for (const u of users) {
      for (const r of prLink) {
        if (payHash(u.id, r.airline, r.airline_other) === r.proof_hash) { ownerOf.add(u.id); break; }
      }
    }
    const emailOf = Object.fromEntries(users.map((u) => [u.id, u.email]));
    /* submit_pay_report が書く列。1つでも残っていれば「出した痕跡」がある。 */
    const marks = (p) => !!(p.pay_report_count > 0 || p.pay_streak_months > 0 || p.access_until
                         || p.last_pay_report_at || p.pay_day_of_month || p.last_pay_period_ym);
    const orphan  = profLink.filter((p) => !ownerOf.has(p.id) && marks(p));
    const missing = profLink.filter((p) => ownerOf.has(p.id) && (!p.access_until || !(p.pay_report_count > 0)));
    const now = new Date().toISOString();
    const expired = profLink.filter((p) => ownerOf.has(p.id) && p.access_until && p.access_until < now);

    line('① 痕跡だけ残っている人', `${orphan.length}人`,
         orphan.length ? '　← 給与を出していないのに REAL PAY が開く' : '');
    for (const p of orphan.slice(0, 10)) {
      line('  ' + mask(emailOf[p.id]), `解放 ${day(p.access_until) || '(無し)'}`,
           `　件数 ${p.pay_report_count ?? 0}`, p.pay_day_of_month ? `　給料日 ${p.pay_day_of_month}日` : '');
    }
    if (orphan.length) {
      console.log('   → db/repair-orphan-unlock.sql を Supabase の SQL Editor に貼ります');
      console.log('     （①で人数を目で見る → ②で戻す → ③が0行になる。何度流しても同じ結果）。');
      console.log('   ※ 給料日を戻すのを忘れると、消えたレポートから学習した日で毎月のメールが飛び続けます。');
    }
    line('② 行はあるのに記録が無い人', `${missing.length}人`,
         missing.length ? '　← マイレポートには出るのに鍵が開いていない' : '');
    for (const p of missing.slice(0, 10)) {
      line('  ' + mask(emailOf[p.id]), `解放 ${day(p.access_until) || '(無し)'}`, `　件数 ${p.pay_report_count ?? 0}`);
    }
    /* ③はズレではない。90日たてば普通に起きる（もう1件出せば立て直る）。 */
    line('③ 解放が切れている人', `${expired.length}人`, '　（90日たてば普通に起きる。ズレではない）');
  } catch (e) { line('取得できず', e.message); }

  /* ── 3-e. 引き取られていない預かり（期限つき）───────────────
     預かり証は30日で切れる（db/pay-report-pending.sql）。切れると本人でも
     引き取れないので、**残り日数**まで出す。3-b は件数と塊を出すだけで、
     「あと何日で消えるか」は出していない。 */
  console.log('\n■ 預かりの期限（本人が引き取れるのは出してから30日）');
  try {
    const pdEx = await rest('pay_reports_pending', 'select=created_at,claimed_at,airline&order=created_at.asc&limit=5000');
    const open = pdEx.filter((r) => !r.claimed_at);
    line('まだ引き取られていない', `${open.length}件`);
    for (const r of open) {
      const due = new Date(Date.parse(r.created_at) + 30 * 86400_000);
      const left = Math.ceil((due - Date.now()) / 86400_000);
      line('  ' + day(r.created_at) + ' ' + (r.airline || '?'),
           left > 0 ? `期限 ${day(due.toISOString())}（あと${left}日）` : `期限切れ（${day(due.toISOString())}）`);
    }
    if (open.length) {
      console.log('   ※ 本人が「そのブラウザで」アカウントを作れば今でも紐付きます。');
      console.log('     端末が変わって預かり証を失った人には、');
      console.log('     https://pilot-value.com/pay-report.html?claim=<そのレポートの claim_token>');
      console.log('     をログイン中に開いてもらえば引き取れます（トークンは本人以外に渡さない）。');
    }
  } catch (e) {
    if (/\b404\b|PGRST205|does not exist/i.test(e.message)) {
      line('まだ置き場がありません', 'db/pay-report-pending.sql を Supabase で流すと出ます');
    } else line('取得できず', e.message);
  }

  /* ── 4. 明細の読み取り ─────────────────────────────────── */
  console.log('\n■ 明細の読み取り（AIに読ませようと「試した」回数。失敗も1回に入ります）');
  try {
    const q = await rest('pv_parse_quota', 'select=day,subject,n&order=day.desc&limit=2000');
    const sinceDay = sinceIso ? sinceIso.slice(0, 10) : '0000-00-00';
    const days = {};
    const everyone = new Set();
    let allCalls = 0;
    for (const r of q) {
      const isGlobal = String(r.subject).startsWith('global');
      if (r.subject === 'global') allCalls += r.n;
      if (!isGlobal) everyone.add(r.subject);
      if (r.day < sinceDay) continue;
      const d = (days[r.day] ??= { calls: 0, people: 0 });
      if (isGlobal) { if (r.subject === 'global') d.calls = r.n; }
      else d.people++;
    }
    tryPeople = everyone.size;
    const keys = Object.keys(days).sort();
    if (!keys.length) line('期間内', '0回');
    for (const d of keys) line('  ' + d, `${days[d].calls}回 / ${days[d].people}人`);
    line('累計', `${allCalls}回 / ${tryPeople}人`);
    console.log('   ※ 誰の分かは切り分けられません（あなたの動作確認も同じ数に入ります）');
    console.log('   ※ 読めた回数ではありません。読み取りに失敗した分もここに入っています。');
  } catch (e) { line('取得できず', e.message); }

  /* ── 5. お問い合わせ ───────────────────────────────────── */
  console.log('\n■ お問い合わせ');
  try {
    const ct = await rest('contacts', 'select=created_at&order=created_at.desc&limit=5000');
    line('期間内', `${ct.filter((c) => inSpan(c.created_at)).length}件`, `　累計 ${ct.length}件`);
  } catch (e) { line('取得できず', e.message); }

  /* ── まとめ ────────────────────────────────────────────── */
  console.log('\n━━ まとめ ' + '━'.repeat(43));
  console.log(`   ${spanLabel}で、新しく登録した人は ${fresh.length}人 です。`);
  console.log(`   会員は全部で ${real.length}人（あなたのテスト用を除く）、`);
  console.log(`   そのうち登録した日より後にもう一度来た人は ${returned.length}人 です。`);
  if (tryPeople !== null && paidPeople !== null) {
    console.log('');
    console.log(`   明細を読ませようとした人は累計 ${tryPeople}人、そのうち給与レポートの`);
    console.log(`   保存まで届いたのは ${paidPeople}人 です。`);
    if (tryPeople > 0 && paidPeople === 0) {
      console.log('   → 途中で全員が離脱しています。どこで諦めたかは GA4 の payslip_* で見ます。');
    }
  }
  if (pendTotal !== null && pendTotal > 0) {
    console.log('');
    console.log(`   給与データを出した人は累計 ${pendTotal}人ぶん、そのうち ${pendTotal - pendOpen}人ぶんが`);
    console.log(`   アカウントまで進みました（残り ${pendOpen}人ぶんは出したまま会員になっていません）。`);
  }
  console.log('');
  console.log('   ※ 「サイトを見に来た人の数」はここには出ません。DB には残らないので、');
  console.log('      訪問者数は GA4（Google アナリティクス）の画面で見てください。');
  console.log('');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
