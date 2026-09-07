/* assert-unlock.mjs — 「出したものと、返るものが一致する」を機械で確かめる。
 *
 *   鍵は2つあり、意味が違う。
 *     口コミ枠  pv_unlock_expiry         ← 口コミを1件出すと開く。**期限なし**
 *     年収枠    pv_salary_unlock_expiry  ← 給与明細を1枚出すと開く。**90日で本当に切れる**
 *
 *   2026-08-22、口コミ枠の期限を外した。サーバが覚えているのは「この人は口コミを
 *   出したことがあるか」（reviews_v2 の proof_hash）だけ＝永久の事実で、30日は端末に
 *   置いた付箋の寿命にすぎず、ログインのたびに書き直されていた＝実質もう期限なしだった。
 *   ここで守るのは、期限を外したことで壊れうる5つ：
 *
 *     ① 口コミしか出していない人に、年収枠が開かない
 *        ★これが一番危ない。以前 pv-session.js に grandfatherSalaryUnlock() という
 *          「口コミの鍵の期限を年収の鍵へ書き写す」引き継ぎがあった（昔は口コミ1件で
 *          年収まで見えたため）。口コミを「ずっと」にした状態でこれが残っていると
 *          **口コミ1件で年収データが永久に開く**。同じコミットで削除した。戻さない。
 *     ② 口コミの鍵を書く8か所が、全部「遠い未来」を書く
 *        1か所でも30日に戻ると、そこを通った人だけ黙って締め出される
 *     ③ 明細を出した人の年収枠は開き、その期限は90日のまま（100年にしない）
 *     ④ pv-session.js に grandfatherSalaryUnlock / pv_salary_grandfathered が復活していない
 *     ⑤ 画面に「30日／1ヶ月」という口コミ解放の約束が残っていない（日英）
 *        実態より小さく見せるのも嘘。ただし本当に30日/1ヶ月のもの（台湾のホテル・
 *        IPハッシュの保持・預かり証・ログイン最長・退会後の削除）は ALLOW に理由つきで置く
 *
 *   実行: node assert-unlock.mjs
 *   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない（Supabase ごと差し替える）。
 */
import puppeteer from 'puppeteer';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const BASE = 'http://localhost:3000';
const DAY = 86400000;
const YEAR = 365 * DAY;

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + ' ' + e)); };

/* 説明文まで grep すると「なぜそうしたか」を書いた人が赤くなる。実体だけ見る。 */
const nojs   = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const nohtml = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const strip  = (f, s) => /\.html$/.test(f) ? nojs(nohtml(s)) : nojs(s);

// ════════════════════════════════════════════════════════════════
// ① 引き継ぎが復活していない（pv-session.js）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ① 口コミの鍵が年収の鍵へ書き写されない ════');
{
  const s = strip('pv-session.js', read('pv-session.js'));
  ok(!/grandfather/i.test(s),
     'pv-session.js に grandfatherSalaryUnlock が無い（口コミ1件で年収が開かない）');
  ok(!s.includes('pv_salary_grandfathered'),
     'pv-session.js に pv_salary_grandfathered が無い');
  /* 年収の鍵に値を書いてよいのは pay-report.html と premium-auth-lock.js だけ。
     pv-session.js は消す（removeItem）だけでよい。 */
  ok(!/setItem\(\s*(K_SALARY|['"]pv_salary_unlock_expiry['"])/.test(s),
     'pv-session.js が年収の鍵に書き込まない（消すだけ）');
}

// ════════════════════════════════════════════════════════════════
// ② 口コミの鍵を書く8か所が、全部「遠い未来」を書く
// ════════════════════════════════════════════════════════════════
console.log('\n════ ② 口コミの鍵は時間で切れない ════');
const WRITERS = [
  'airlines/premium-auth-lock.js',
  'pv-reunlock.js',
  'submit-review.html',
  'en/submit-review.html',
  'community.html',
  'en/community.html',
  'airlines/starlux-tenshoku.html',
  'en/airlines/starlux-tenshoku.html',
  /* 2026-09-07 追加 ── 本文をサーバ側で止めたので、鍵を持っているかを
     知っているのはサーバだけになった。返事が「持っている」なら端末の写しを合わせる。 */
  'airlines/airline-reviews-ui.js',
  'en/airlines/en-airline-reviews.js',
];
{
  /* 書いている場所を数え上げてから照合する。新しい書き手が増えたらここで気づく。
     （premium-auth-lock.js だけ定数 KEY_REVIEW 経由なので名前でも拾う） */
  const found = [];
  const scan = (dir, depth) => {
    for (const e of readdirSync(path.join(ROOT, dir || '.'), { withFileTypes: true })) {
      if (/^(node_modules|\.git|temporary screenshots|sources-raw)$/.test(e.name)) continue;
      const rel = dir ? dir + '/' + e.name : e.name;
      if (e.isDirectory()) { if (depth > 0) scan(rel, depth - 1); continue; }
      if (!/\.(html|js)$/.test(e.name)) continue;
      const s = strip(rel, read(rel));
      if (/setItem\(\s*(KEY_REVIEW|K_REVIEW|['"]pv_unlock_expiry['"])/.test(s)) found.push(rel);
    }
  };
  scan('', 2);
  /* pv-session.js は「元」。PVUnlock.setReview() の中で自分の定数を書くので、
     下の「reviewUntil() を通るか」の対象には入れず、定数そのものを見る。 */
  const KNOWN = WRITERS.concat(['pv-session.js']);
  const extra = found.filter((f) => !KNOWN.includes(f));
  ok(extra.length === 0, `口コミの鍵を書くのは既知の${KNOWN.length}か所だけ（見つかった ${found.length}）`, extra.join(' '));
  ok(found.includes('pv-session.js'), 'pv-session.js が PVUnlock の元を持っている');
  {
    const src = strip('pv-session.js', read('pv-session.js'));
    ok(/REVIEW_UNLOCK_MS\s*=\s*100 \* 365 \* 24 \* 60 \* 60 \* 1000/.test(src),
       'pv-session.js の口コミ解放は100年（＝実質ずっと）');
  }

  for (const f of WRITERS) {
    const s = strip(f, read(f));
    ok(s.includes('PVUnlock.reviewUntil'), `${f} は PVUnlock.reviewUntil() を通る`);
    ok(s.includes('100 * 365 * 24 * 60 * 60 * 1000'),
       `${f} の保険も遠い未来（読み込み順が崩れても解放を落とさない）`);
    ok(!/30\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.test(s) || f === 'pv-session.js',
       `${f} に30日の定数が戻っていない`);
  }
}

// ════════════════════════════════════════════════════════════════
// ③ 年収枠は90日のまま（口コミにつられて延びていない）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ③ 年収枠の90日は据え置き ════');
{
  const sql = read('db/pay-reports.sql');
  ok(/90/.test(sql) && /access_until/.test(sql), 'db/pay-reports.sql に access_until と 90 がある');
  const pr = strip('pay-report.html', read('pay-report.html'));
  ok(/pv_salary_unlock_expiry/.test(pr) && /access_until/.test(pr),
     'pay-report.html は年収の鍵をサーバの access_until から立てる');
  ok(!/PVUnlock/.test(pr), 'pay-report.html は口コミの鍵（PVUnlock）を使わない');
  const pal = strip('airlines/premium-auth-lock.js', read('airlines/premium-auth-lock.js'));
  ok(/KEY_SALARY[\s\S]{0,200}access_until|access_until[\s\S]{0,200}KEY_SALARY/.test(pal),
     'premium-auth-lock.js の年収枠も access_until 由来');

  /* ★2026-08-25。Give-to-Get の門（pv-gates.js）が読み手として増えた。
       あれがやるのは**左メニューに錠前の絵を出すか決めるだけ**。
       ⚠️ 書き手にしないこと。写しに書けるようにすると、
          端末の中の数字を変えるだけで開いたことにできてしまう
          （実データを止めているのはサーバの pv_pay_rows() だが、
            写しが増えると「どちらが正か」が分からなくなる）。 */
  const gates = strip('pv-gates.js', read('pv-gates.js'));
  ok(/pv_salary_unlock_expiry/.test(gates) && /getItem/.test(gates),
     'pv-gates.js は年収の鍵を読む（錠前を出すかの判断だけ）');
  ok(!/setItem\(|removeItem\(/.test(gates),
     '★pv-gates.js は年収の鍵に書かない・消さない（読み手を増やしただけ）');
  ok(!/PVUnlock/.test(gates), 'pv-gates.js は口コミの鍵（PVUnlock）を触らない');
}

// ════════════════════════════════════════════════════════════════
// ⑤ 画面に「30日／1ヶ月」の口コミ解放の約束が残っていない
// ════════════════════════════════════════════════════════════════
console.log('\n════ ⑤ 文言に期限が残っていない ════');

/* 「期間の語」と「口コミ解放の語」が同じ行に居るときだけ疑う。
   90日（年収枠）は本当に切れるので、ここでは期間の語に含めない。 */
/* ★裸の "a month" は入れない。FAQ の「月あたり約$17K」に当たって、
     期限の約束と月額給与の説明が区別できなくなる。 */
const DUR = /(30\s*日|30-day|30 days|1\s*ヶ月|1\s*か月|一ヶ月|1-month|a full month|for a month|for one month)/i;
const CTX = /(口コミ|レビュー|解放|読め|閲覧|アクセス有効|review|unlock|access|open up|read every)/i;

/* 本当に30日/1ヶ月のもの。消すと嘘になるので残す。 */
const ALLOW = [
  ['airlines/airline-reviews-data.js', null,
   'パイロット本人の口コミの原文（「1か月に8日オフ」等）。こちらの約束ではない'],
];

{
  const files = [];
  const push = (dir) => {
    if (!existsSync(path.join(ROOT, dir))) return;
    for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.isDirectory()) continue;
      if (/\.(html|js)$/.test(e.name)) files.push(dir === '.' ? e.name : dir + '/' + e.name);
    }
  };
  ['.', 'en', 'airlines', 'en/airlines'].forEach(push);
  files.push('mail-bot/send.mjs', 'seo-normalize.mjs');

  const hits = [];
  for (const f of files) {
    const fileAllow = ALLOW.filter((a) => a[0] === f);
    if (fileAllow.some((a) => a[1] === null)) continue;
    strip(f, read(f)).split('\n').forEach((line, i) => {
      if (!DUR.test(line) || !CTX.test(line)) return;
      if (fileAllow.some((a) => line.includes(a[1]))) return;
      hits.push(`${f}:${i + 1}  ${line.trim().slice(0, 120)}`);
    });
  }
  ok(hits.length === 0, `口コミ解放に期間を書いた行が0（日英・共有JS・メール・SEO元表）`,
     hits.length ? '\n      ' + hits.join('\n      ') : '');
}

// ════════════════════════════════════════════════════════════════
// ⑥ 口コミの本文は「表」からではなく「サーバの口」から来る
//    （db/reviews-gate.sql ── 鍵を持たない人には本文を送らない。
//     REAL PAY と同じ形＝ぼかすのではなく、そもそも返さない）
// ════════════════════════════════════════════════════════════════
console.log('\n════ ⑥ 本文はサーバ側で止まる ════');
{
  const gate = read('db/reviews-gate.sql');
  const arrs = [...gate.matchAll(/v_hide\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/g)]
    .map((m) => (m[1].match(/'[a-z_]+'/g) || []).map((x) => x.replace(/'/g, '')).sort());

  /* ★隠す列の表が SQL の中に2つある（本文を返す口 pv_reviews と、表の権限を
     配り直すブロック）。ズレると「RPC は隠すのに表からは読める」／その逆になり、
     どちらも画面は普通に動いたまま穴が開く。 */
  ok(arrs.length === 2 && JSON.stringify(arrs[0]) === JSON.stringify(arrs[1]),
     '★SQL の中の「隠す列」2か所が一致している', JSON.stringify(arrs));

  /* ★SQL が隠す列と、画面が「本文」と見なす列も同じでなければならない。
     カテゴリを1つ増やして片方だけ直すと、新しい欄の本文だけが誰にでも読める。 */
  const KEYS = ((read('review-i18n.js').match(/var KEYS\s*=\s*\[([\s\S]*?)\]/) || ['', ''])[1]
    .match(/'[a-z]+'/g) || []).map((x) => x.replace(/'/g, '') + '_comment');
  const want = KEYS.concat(['translations']).sort();
  ok(arrs[0] && JSON.stringify(arrs[0]) === JSON.stringify(want),
     '★SQL が隠す列と、review-i18n.js が本文と見なす列が同じ',
     `sql=${(arrs[0] || []).join(',')}  js=${want.join(',')}`);

  /* 読み手は全部「唯一の口」を通る。select('*') は表ぜんぶの権限を要求するので、
     鍵の SQL を貼った瞬間に画面が丸ごと落ちる（1件も出なくなる）。 */
  const DOORS = ['community.html', 'en/community.html',
                 'airlines/airline-reviews-ui.js', 'en/airlines/en-airline-reviews.js'];
  for (const f of DOORS) {
    const body = strip(f, read(f));
    ok(body.includes('PVReviewI18n.fetchRows'), `${f} が唯一の口を通っている`);
    /* ★表そのものに触らない。列名を変数に隠しても届かないように、
       .from('reviews_v2') が1つも無いことで見る（select('*') も当然消える）。 */
    ok(!/\.from\(\s*['"]reviews_v2/.test(body), `★${f} が表を直接引いていない`);
  }
  {
    const lp = strip('lp.js', read('lp.js'));
    ok(lp.includes('rpc/pv_review_voices'), 'トップの抜粋も専用の口（pv_review_voices）を通っている');
    /* トップだけは「新しい6件・1欄80字まで」を誰にでも見せる唯一の穴（オーナー決定）。
       ★穴が広がらないよう、本文の列名を自分で取りに行っていないことを見る。 */
    ok(!/reviews_v2\?select=[^'"`]*_comment/.test(lp),
       '★トップが本文の列を自分で取りに行っていない');
  }

  /* 本文の列名を自分で並べて表を引いてよいのは、pv-reunlock.js の
     「鍵の SQL を貼る前のための受け皿」だけ。貼ったあとは必ず落ちる側で、
     先にサーバへ聞くようになっている（askServer）。 */
  const BODY_COL = /culture_comment/;
  const files = [];
  for (const dir of ['.', 'en', 'airlines', 'en/airlines']) {
    if (!existsSync(path.join(ROOT, dir))) continue;
    for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.isDirectory() || !/\.(html|js)$/.test(e.name)) continue;
      files.push(dir === '.' ? e.name : dir + '/' + e.name);
    }
  }
  const leaks = files.filter((f) => {
    if (f === 'pv-reunlock.js') return false;            // 移行用の受け皿（下で別に見る）
    const b = strip(f, read(f));
    /* ★見るのは select の**引数**。投稿（insert の payload）と、サーバから
       返った行の描画（r.culture_comment）は本文の列名を使ってよい ──
       表から引いているのは「列名を並べて select したとき」だけ。 */
    return BODY_COL.test(b) && /\.select\(\s*['"`][^'"`]*_comment/.test(b);
  });
  ok(leaks.length === 0, '★本文の列を表から直接引いている画面が無い', leaks.join(', '));
  ok(strip('pv-reunlock.js', read('pv-reunlock.js')).includes("rpc(\"pv_reviews\""),
     'pv-reunlock.js は表を叩く前にサーバへ聞く（貼ったあとも自分の口コミが消えない）');
}

// ════════════════════════════════════════════════════════════════
// 実際に開く（localhost。本番の DB には触らない）
// ════════════════════════════════════════════════════════════════
const UID = '00000000-0000-4000-8000-00000000b001';

/* case: 'review' … 口コミだけ出した人 / 'payslip' … 明細だけ出した人 / 'none'
   preset: localStorage に先に置いておく鍵 */
function stub(page, { hasReview, accessUntil, preset, gated }) {
  return page.evaluateOnNewDocument((uid, hasReview, accessUntil, preset, gated) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('pv-theme', 'dark');
    localStorage.setItem('pv_user', JSON.stringify({ id: uid, name: 'Test Pilot', email: 'unlock-test@example.com' }));
    localStorage.setItem('pv_last_active', String(Date.now()));
    for (const [k, v] of Object.entries(preset || {})) localStorage.setItem(k, String(v));

    function q(rows) {
      const o = { data: rows, error: null,
        select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
        single: async () => ({ data: rows[0] || null, error: null }),
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then: (res) => res({ data: rows, error: null }) };
      return o;
    }
    /* 権限が無いときの本物の返り（列を取り上げた本番の reviews_v2 はこれを返す）。
       ★ data は null。空配列にすると「0件」と区別が付かなくなる。 */
    function qErr(code) {
      const o = { data: null, error: { code: code, message: 'permission denied' },
        select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
        single: async () => ({ data: null, error: { code: code } }),
        maybeSingle: async () => ({ data: null, error: { code: code } }),
        then: (res) => res({ data: null, error: { code: code } }) };
      return o;
    }
    const REPORTS = { ok: true, reports: [], report_count: 0,
      access_until: accessUntil || null, badge: null, badge_state: null };
    const FAKE = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: uid, email: 'unlock-test@example.com' } } } }),
        getUser:    async () => ({ data: { user: { id: uid, email: 'unlock-test@example.com' } } }),
        signOut:    async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      /* ★本物の supabase-js が返すのは「then だけを持つ箱」。async にすると本番に無い
         .catch が生えて、本番より優しくなる（assert-conditions.mjs に経緯あり）。 */
      rpc: (name) => {
        let data = { ok: true };
        if (name === 'my_pay_reports') data = REPORTS;
        /* ★鍵の SQL（db/reviews-gate.sql）を本番へ貼ったあとの形。
           本文の列は表から読めなくなり、自分の口コミはサーバが選んで返す。
           gated でないときは今までどおり ok だけ＝rows が無いので、
           画面は従来の proof_hash 総当たりに落ちる（貼る前と同じ動き）。 */
        if (name === 'pv_reviews' && gated) {
          data = { ok: true, unlocked: hasReview,
                   rows: hasReview ? [{ id: 'r1', airline: 'ana', cats: [] }] : [] };
        }
        const res = { data: data, error: null };
        return { then: (y, n) => Promise.resolve(res).then(y, n) };
      },
      /* 貼ったあとの表は、本文の列を含む読み取りが 42501 で落ちる。
         ★ここを空配列にしてはいけない ── 「権限が無い」と「0件」を
           取り違えると、落ちるはずの道が黙って通ってしまう。 */
      from: (t) => (t === 'reviews_v2' && gated) ? qErr('42501')
                 : q(t === 'reviews_v2' && hasReview ? [{ id: 'r1' }] : []),
    };
    Object.defineProperty(window, 'supabase',
      { value: { createClient: () => FAKE }, writable: false, configurable: false });
  }, UID, hasReview, accessUntil, preset || {}, !!gated);
}

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const FAR = Date.now() + 50 * YEAR;

const gateState = () => ({
  salaryLocked:   document.querySelectorAll('.premium-gate.pv-locked').length,
  salaryUnlocked: document.querySelectorAll('.premium-gate.pv-unlocked').length,
  reviewKey:      Number(localStorage.getItem('pv_unlock_expiry') || 0),
  salaryKey:      Number(localStorage.getItem('pv_salary_unlock_expiry') || 0),
});

for (const [lang, url] of [['ja', '/airlines/ana.html'], ['en', '/en/airlines/ana.html']]) {
  console.log(`\n════ 航空会社ページ（${lang}）— 年収枠は明細でしか開かない ════`);

  // ── A1: 端末に口コミの鍵だけある ──
  {
    const page = await browser.newPage();
    await stub(page, { hasReview: false, accessUntil: null, preset: { pv_unlock_expiry: FAR } });
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1000));
    const s = await page.evaluate(gateState);
    ok(s.salaryUnlocked === 0 && s.salaryLocked > 0,
       'A1 口コミの鍵だけ → 年収枠は閉じたまま', JSON.stringify(s));
    ok(s.salaryKey === 0, 'A1 年収の鍵が勝手に立たない', String(s.salaryKey));
    ok(s.reviewKey > Date.now() + 10 * YEAR, 'A1 口コミの鍵は消されない', String(s.reviewKey));
    await page.close();
  }

  // ── A2: 別の端末から戻ってきた人（localStorage 空・サーバに口コミがある） ──
  //     ★2026-08-22 まで、ここは1件も通っていなかった。premium-auth-lock.js は
  //       224ページ中222ページで <head> から読まれるので document.body がまだ無く、
  //       data-airline を定数で受けていたため常に '' → reviews_v2 の照合ごと素通り。
  {
    const page = await browser.newPage();
    await stub(page, { hasReview: true, accessUntil: null, preset: {} });
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    const s = await page.evaluate(gateState);
    ok(s.reviewKey > Date.now() + 10 * YEAR,
       'A2 サーバに口コミがある → 口コミの鍵が遠い未来で復活する', String(s.reviewKey));
    ok(s.salaryUnlocked === 0 && s.salaryLocked > 0,
       'A2 口コミがあっても年収枠は開かない', JSON.stringify(s));
    ok(s.salaryKey === 0, 'A2 年収の鍵に書き写されない（引き継ぎの復活を検知）', String(s.salaryKey));
    await page.close();
  }

  // ── A3: 鍵の SQL を本番へ貼ったあと（本文の列が表から読めない）──
  //     ★ここが今回の本題。貼ると pv-reunlock.js の proof_hash 総当たりは
  //       必ず 42501 で落ちる。サーバの口（pv_reviews）に聞き直せていないと、
  //       別端末から戻ってきた人の口コミ解放が**黙って復活しなくなる**。
  {
    const page = await browser.newPage();
    await stub(page, { hasReview: true, accessUntil: null, preset: {}, gated: true });
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    const s = await page.evaluate(gateState);
    ok(s.reviewKey > Date.now() + 10 * YEAR,
       'A3 ★表が読めなくても、サーバ経由で口コミの鍵が復活する', String(s.reviewKey));
    ok(s.salaryUnlocked === 0 && s.salaryLocked > 0,
       'A3 それでも年収枠は開かない', JSON.stringify(s));
    ok(s.salaryKey === 0, 'A3 年収の鍵に書き写されない', String(s.salaryKey));
    await page.close();
  }

  // ── A4: 貼ったあと・口コミを1件も出していない人 ──
  {
    const page = await browser.newPage();
    await stub(page, { hasReview: false, accessUntil: null, preset: {}, gated: true });
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    const s = await page.evaluate(gateState);
    ok(s.reviewKey === 0, 'A4 出していない人に口コミの鍵が立たない', String(s.reviewKey));
    ok(s.salaryUnlocked === 0 && s.salaryLocked > 0, 'A4 年収枠も閉じたまま', JSON.stringify(s));
    await page.close();
  }

  // ── B: 明細だけ出した人 ──
  {
    const page = await browser.newPage();
    await stub(page, { hasReview: false,
      accessUntil: new Date(Date.now() + 90 * DAY).toISOString(), preset: {} });
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    const s = await page.evaluate(gateState);
    ok(s.salaryUnlocked > 0 && s.salaryLocked === 0,
       'B 明細を出した人 → 年収枠が開く', JSON.stringify(s));
    ok(s.salaryKey > Date.now() + 80 * DAY && s.salaryKey < Date.now() + YEAR,
       'B 年収の鍵は90日のまま（100年になっていない）',
       String(Math.round((s.salaryKey - Date.now()) / DAY) + '日'));
    ok(s.reviewKey === 0, 'B 明細だけでは口コミの鍵は立たない', String(s.reviewKey));
    await page.close();
  }
}

// ── 口コミ一覧の見た目（ここが「口コミを出した人だけが読める」の本体） ──
/* 1件だけ手元の口コミを置いて、必ずカードが1枚描かれる状態にする。
   ★架空の投稿。実在の人物の投稿ではない。 */
const LOCAL_REVIEW = [{ ts: 1, airline: 'ana', position: 'captain', salary: 2000, avgRating: 4,
  payText: 'テスト用のダミー本文。', comment: 'テスト用のダミー本文。', date: '2026-08' }];

for (const [lang, url] of [['ja', '/community.html'], ['en', '/en/community.html']]) {
  console.log(`\n════ 口コミ一覧（${lang}）════`);
  const look = () => ({
    gate:  !!document.getElementById('gate-panel'),
    badge: (() => { const b = document.getElementById('unlock-badge'); return !!b && b.style.display !== 'none'; })(),
  });

  // 口コミを出した人
  {
    const page = await browser.newPage();
    await stub(page, { hasReview: true, accessUntil: null,
      preset: { pv_unlock_expiry: FAR, pv_reviews: JSON.stringify(LOCAL_REVIEW) } });
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));
    const v = await page.evaluate(look);
    ok(!v.gate, '口コミを出した人 → 鍵の壁が出ない', JSON.stringify(v));
    ok(v.badge, '口コミを出した人 → 解放中のバッジが出る', JSON.stringify(v));
    await page.close();
  }

  // 明細だけ出した人（年収の鍵はあるが口コミの鍵は無い）
  {
    const page = await browser.newPage();
    await stub(page, { hasReview: false,
      accessUntil: new Date(Date.now() + 90 * DAY).toISOString(),
      preset: { pv_salary_unlock_expiry: Date.now() + 90 * DAY, pv_reviews: JSON.stringify(LOCAL_REVIEW) } });
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));
    const v = await page.evaluate(look);
    ok(v.gate, '明細だけの人 → 口コミには鍵の壁が出る（年収の鍵では開かない）', JSON.stringify(v));
    ok(!v.badge, '明細だけの人 → 口コミ解放中のバッジは出ない', JSON.stringify(v));
    await page.close();
  }

  /* ── 鍵の SQL を貼ったあと ──
     端末には鍵の写しが1つも無い。開けてよいかを決めるのはサーバだけ。 */
  {
    const page = await browser.newPage();
    await stub(page, { hasReview: true, accessUntil: null, gated: true,
      preset: { pv_reviews: JSON.stringify(LOCAL_REVIEW) } });
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    const v = await page.evaluate(look);
    ok(!v.gate, '★端末に鍵の写しが無くても、サーバが「持っている」と言えば開く', JSON.stringify(v));
    ok(v.badge, '★そのとき解放中のバッジも点く', JSON.stringify(v));
    await page.close();
  }

  {
    const page = await browser.newPage();
    await stub(page, { hasReview: false, accessUntil: null, gated: true,
      preset: { pv_reviews: JSON.stringify(LOCAL_REVIEW) } });
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    const v = await page.evaluate(look);
    ok(v.gate, '★サーバが「持っていない」と言えば壁は出たまま', JSON.stringify(v));
    ok(!v.badge, '★そのときバッジも点かない', JSON.stringify(v));
    await page.close();
  }
}

// ── C: PVUnlock 本体が遠い未来を返す ──
console.log('\n════ PVUnlock 本体 ════');
{
  const page = await browser.newPage();
  await stub(page, { hasReview: false, accessUntil: null, preset: {} });
  await page.goto(BASE + '/community.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const v = await page.evaluate(() => ({
    has: !!(window.PVUnlock && window.PVUnlock.reviewUntil),
    until: window.PVUnlock ? window.PVUnlock.reviewUntil() : 0,
  }));
  ok(v.has, 'window.PVUnlock.reviewUntil() がある');
  ok(v.until > Date.now() + 10 * YEAR, '返す時刻は10年以上先',
     String(Math.round((v.until - Date.now()) / YEAR) + '年先'));
  await page.close();
}

// ── D: マイページのバッジ。口コミは日付を出さない／年収は出す ──
for (const [lang, url] of [['ja', '/profile.html'], ['en', '/en/profile.html']]) {
  console.log(`\n════ マイページのバッジ（${lang}） ════`);
  const page = await browser.newPage();
  await stub(page, { hasReview: true,
    accessUntil: new Date(Date.now() + 90 * DAY).toISOString(),
    preset: { pv_unlock_expiry: FAR, pv_salary_unlock_expiry: Date.now() + 90 * DAY } });
  await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await page.evaluate(() => {
    const t = (id) => { const e = document.getElementById(id); return e && e.offsetParent !== null ? e.textContent.trim() : ''; };
    return { review: t('unlock-status'), salary: t('unlock-status-salary') };
  });
  ok(b.review !== '' , '口コミバッジが出ている', JSON.stringify(b));
  ok(!/\d/.test(b.review), '口コミバッジに数字（日付）が出ない', JSON.stringify(b));
  ok(/\d/.test(b.salary), '年収バッジには期限の日付が出る（本当に切れるので）', JSON.stringify(b));
  await page.close();
}

await browser.close();
console.log(`\n${fail ? '❌' : '✅'} pass ${pass} / fail ${fail}\n`);
process.exitCode = fail ? 1 : 0;
