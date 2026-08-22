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
   1. **読むだけ。** GET しか投げない。ファイルを1つも書かない。
      RESEND_API_KEY を読まない＝メールを送る道を最初から持たない。
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
                   … db/pay-reports.sql:556-560
     口コミ        sha256(uid || '::pv_anon::' || airline || '::2026')
                   … submit-review.html:1374-1378（airline は「その他」なら自由入力の社名）
   ★口コミは航空会社コードを付け替えた移行（db/migrate-airline-codes.sql）より前の行だと
     hash が旧コードのままなので一致しない。古い自分の投稿は落としきれないことがある。 */
const payHash = (uid, airline, other) =>
  createHash('sha256')
    .update(`${uid}::pv_pay::${airline}${other ? '::' + String(other).toLowerCase() : ''}`)
    .digest('hex');
const reviewHash = (uid, airline) =>
  createHash('sha256').update(`${uid}::pv_anon::${airline}::2026`).digest('hex');

(async () => {
  const [users, profiles] = await Promise.all([
    authUsers(),
    rest('profiles', 'select=id,email_opt_in,pay_report_count&limit=5000'),
  ]);

  const testIds = new Set(users.filter((u) => isTestEmail(u.email)).map((u) => u.id));
  const real = users.filter((u) => !testIds.has(u.id));
  const profById = Object.fromEntries(profiles.map((p) => [p.id, p]));

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
