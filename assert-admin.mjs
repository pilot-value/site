/* assert-admin.mjs — 管理者ページが「ログインした管理者にしか見えない」ことを機械で確かめる。

   2026-08-20 以前、このページには合言葉がそのまま書いてあった（admin.html の中に
   const ADMIN_PASSWORD = '…'）。ページはサイトから誰でも読めるので、合言葉は
   最初から公開されているのと同じだった。さらに画面が profiles テーブルを直接
   読んでいたので、合言葉を知らなくても、ブラウザの開発者ツールから会員の
   氏名・メール・生年月日・在籍企業が全部取れた。

   直した形:
     ・ページは合言葉を持たない。ログインしているかを見て、管理者かはサーバーに聞く
     ・表の中身は admin_list_profiles / admin_list_reviews からしか来ない。
       この2つは名簿（pv_admins）に載っている人にしか答えない
     ・profiles / reviews_v2 を画面から直接読まない（DB 側でも anon から権限を外す）

   ここで見るもの:
     A) 2つの HTML に合言葉・パスワード入力・テーブル直読みが残っていないこと
     B) db/admin.sql が「名簿・入口・profiles の締め」を全部持っていること
     C) 実際にブラウザで開いて、
        1. ログアウト  → 表が出ない・DB を1回も叩かない・氏名が1文字も出ない
        2. 管理者でない → pv_is_admin までで止まり、一覧の RPC を呼ばない
        3. 管理者      → 一覧が出る。ただし from() は一度も使わない
        4. SQL 未適用   → 黙って空の表を出さず、入口に戻して理由を出す

   実行: node assert-admin.mjs
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない（Supabase ごと差し替える）。
*/
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('./' + p, import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? ' → ' + e : ''))); };

/* ── A) ページに合言葉と直読みが残っていないか ───────────────── */
console.log('\n════ A) 管理者ページのソース ════');
for (const f of ['admin.html', 'en/admin.html']) {
  const s = read(f);
  console.log(`\n── ${f} ──`);
  ok(!/ADMIN_PASSWORD/.test(s), '合言葉の定数が無い');
  ok(!/pilotvalue\d{4}/i.test(s), '合言葉の文字列が無い');
  ok(!/type=["']password["']/.test(s), 'パスワード入力欄が無い');
  ok(!/function\s+checkPass/.test(s), '合言葉を照合する関数が無い');
  ok(!/sessionStorage\.(get|set)Item\(\s*['"]pv_admin['"]/.test(s),
     'ブラウザ側の「入った印」で通していない');
  ok(!/\.from\(\s*['"]profiles['"]/.test(s), 'profiles を直接読んでいない');
  ok(!/\.from\(\s*['"]reviews_v2['"]/.test(s), 'reviews_v2 を直接読んでいない');
  ok(/sb\.auth\.getSession\(\)/.test(s), 'ログインしているかを見ている');
  ok(/sb\.rpc\(\s*['"]pv_is_admin['"]\s*\)/.test(s), '管理者かをサーバーに聞いている');
  ok(/sb\.rpc\(\s*['"]admin_list_profiles['"]\s*\)/.test(s), '会員一覧はサーバーの入口から取る');
  ok(/sb\.rpc\(\s*['"]admin_list_reviews['"]\s*\)/.test(s), '口コミ一覧はサーバーの入口から取る');
  ok(/sb\.auth\.signOut\(\)/.test(s), 'ログアウトが本当にログアウトになっている');
}

/* ── B) DB 側（オーナーが SQL Editor で流すもの）─────────────── */
console.log('\n════ B) db/admin.sql ════');
const sql = read('db/admin.sql');
const has = (re) => re.test(sql);
ok(has(/create table if not exists public\.pv_admins/), '管理者の名簿テーブルを作る');
ok(has(/alter table public\.pv_admins\s+enable row level security/), '名簿に鍵がかかる');
ok(has(/revoke all on public\.pv_admins from anon, authenticated/), '名簿は誰からも直接読めない');
ok(has(/create or replace function public\.pv_is_admin\(\)[\s\S]*?security definer/),
   '管理者かを答える入口がある');
for (const fn of ['admin_list_profiles', 'admin_list_reviews']) {
  const body = (sql.match(new RegExp('create or replace function public\\.' + fn + '\\([\\s\\S]*?\\$\\$;')) || [''])[0];
  ok(!!body, `${fn} がある`);
  ok(/security definer/.test(body), `${fn} は呼んだ人の権限ではなく所有者の権限で動く`);
  ok(/if not public\.pv_is_admin\(\) then\s+raise exception/.test(body),
     `${fn} は最初に名簿を見て、載っていなければ止まる`);
  ok(new RegExp('revoke all on function public\\.' + fn + '\\([^)]*\\) from public, anon').test(sql),
     `${fn} は未ログインからは呼べない`);
}
ok(has(/alter table public\.profiles\s+enable row level security/), 'profiles に鍵がかかる');
ok(has(/revoke all on public\.profiles from anon/), 'profiles は未ログインから読めない');
ok(has(/create policy profiles_select_self[\s\S]*?using \(id = auth\.uid\(\)\)/),
   'ログインしていても、読めるのは自分の1行だけ');
ok(has(/pv_policy_backup/), '既存の設定を消す前に控えを取る');

/* ★2026-08-27 追加。RLS は「どの行か」しか見ないので、表ごと update を許すと
   ログインした人が自分の access_until（REAL PAY の解放）や verify_level
   （Verified の表示）を開発者ツールから書き換えられる。列で絞ってあることを見る。 */
const GRANTABLE = ['id', 'email', 'name', 'gender', 'birthdate', 'country',
                   'company', 'position', 'email_opt_in', 'email_opt_in_at'];
const FORBIDDEN = ['access_until', 'verify_level', 'verified_airline', 'verified_at',
                   'badge', 'badge_state', 'pay_report_count', 'pay_streak_months',
                   'pay_day_of_month', 'last_pay_report_at', 'mail_unsub_token', 'mail_optin'];
/* ★ここから下はコメントを外した字面で見る。上の説明文が「昔の悪い grant」を
   そのまま引用しているので、生の字面で探すと自分の説明で落ちる。 */
const bare = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
const colGrants = [...bare.matchAll(/grant\s+(insert|update)\s*\(([^)]*)\)\s*on public\.profiles to authenticated/gi)]
  .map((m) => ({ kind: m[1].toLowerCase(), cols: m[2].split(',').map((c) => c.trim()) }));

ok(!/grant\s+[a-z, ]*\b(insert|update)\b[a-z, ]*on public\.profiles to authenticated/i.test(bare),
   '会員に profiles を表ごと書かせていない（列を書かない grant が無い）');
ok(colGrants.some((g) => g.kind === 'insert') && colGrants.some((g) => g.kind === 'update'),
   '会員が書ける列を insert / update それぞれで名指ししている');
for (const g of colGrants) {
  ok(g.cols.every((c) => GRANTABLE.includes(c)),
     `grant ${g.kind} の列が許可リストの中だけ`, g.cols.filter((c) => !GRANTABLE.includes(c)).join(', '));
  ok(!g.cols.some((c) => FORBIDDEN.includes(c)),
     `grant ${g.kind} に自己付与できる列が混ざっていない`, g.cols.filter((c) => FORBIDDEN.includes(c)).join(', '));
  for (const need of ['id', 'email'])
    ok(g.cols.includes(need), `grant ${g.kind} に ${need} が残っている（登録の upsert が使う）`);
}
/* ⚠️ 順番の罠。Postgres は「表ごとの revoke」で列の許可も道連れに消すので、
   revoke を grant の後ろに書くと profiles に1文字も書けなくなる
   （＝登録もプロフィール保存も黙って失敗する）。位置で見る。 */
const iRevoke = bare.search(/revoke insert, update on public\.profiles from authenticated/);
const iGrant  = bare.search(/grant\s+(insert|update)\s*\([^)]*\)\s*on public\.profiles to authenticated/i);
ok(iRevoke >= 0, '表ごとの insert / update を revoke している');
ok(iRevoke >= 0 && iGrant >= 0 && iRevoke < iGrant,
   'revoke が列の grant より先に書かれている（逆だと列の許可ごと消える）');
ok(has(/⑦ 会員が書ける列/), '検算に「会員が書ける列」が出る（貼った人がその場で気づける）');
ok(!/[A-Za-z0-9._%+-]+@(?!pilot-value\.com|example\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(sql),
   '実在のメールアドレスが書かれていない');

/* ── C) 実際に開く ─────────────────────────────────────────── */
const UID = '00000000-0000-4000-8000-00000000a001';
const FAKE_NAME = 'Sample Pilot';

const CASES = [
  { key: 'logout',   label: '1. ログアウトのまま開く',              session: false, admin: false, err: false },
  { key: 'notadmin', label: '2. ログイン済みだが管理者ではない',      session: true,  admin: false, err: false },
  { key: 'admin',    label: '3. 管理者',                            session: true,  admin: true,  err: false },
  { key: 'nosql',    label: '4. まだ db/admin.sql を流していない',   session: true,  admin: true,  err: true  }
];

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

for (const lang of ['ja', 'en']) {
  const url = 'http://localhost:3000/' + (lang === 'en' ? 'en/' : '') + 'admin.html';
  for (const c of CASES) {
    console.log(`\n════ C) ${lang} — ${c.label} ════`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.evaluateOnNewDocument((cfg, uid, name) => {
      localStorage.setItem('pv-theme', 'dark');
      window.__rpc = [];   // 呼んだ入口の名前
      window.__from = [];  // 直接触ったテーブルの名前（1つでも入ったら負け）
      const SESSION = cfg.session
        ? { user: { id: uid, email: 'pilot@example.com' } } : null;
      const ROWS = [{ id: uid, name: name, email: 'pilot@example.com', gender: 'male',
        birthdate: '1988-04-12', country: '日本', company: 'ZIPAIR', position: 'captain',
        created_at: '2026-01-11T00:00:00Z' }];
      const RPC = {
        pv_is_admin: () => cfg.admin,
        admin_list_profiles: () => ROWS,
        admin_list_reviews: () => []
      };
      function q(t) {
        const o = { data: [], error: null,
          select: () => o, eq: () => o, order: () => o, limit: () => o,
          single: async () => ({ data: null, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
          then: (res) => res({ data: [], error: null }) };
        return o;
      }
      const FAKE = {
        auth: {
          getSession: async () => ({ data: { session: SESSION } }),
          getUser: async () => ({ data: { user: SESSION ? SESSION.user : null } }),
          signOut: async () => ({ error: null })
        },
        from: (t) => { window.__from.push(t); return q(t); },
        /* ★本物の supabase-js が返すのは then だけを持つ箱。async に戻さない */
        rpc: (n, a) => {
          window.__rpc.push(n);
          const isList = n === 'admin_list_profiles' || n === 'admin_list_reviews';
          const res = (cfg.err && isList)
            ? { data: null, error: { message: 'function does not exist' } }
            : { data: RPC[n] ? RPC[n]() : null, error: null };
          return { then: (o2, n2) => Promise.resolve(res).then(o2, n2) };
        }
      };
      Object.defineProperty(window, 'supabase',
        { value: { createClient: () => FAKE }, writable: false, configurable: false });
    }, c, UID, FAKE_NAME);

    await page.goto(url, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));

    const seen = await page.evaluate(() => {
      const vis = (id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        return getComputedStyle(el).display !== 'none';
      };
      const tb = document.getElementById('users-tbody');
      return {
        gate: vis('gate'), dash: vis('dashboard'),
        msg: (document.getElementById('gate-msg') || {}).textContent || '',
        loginShown: vis('gate-login'),
        rows: tb ? tb.querySelectorAll('tr td[colspan]').length ? 0 : tb.querySelectorAll('tr').length : -1,
        rpc: window.__rpc.slice(), from: window.__from.slice(),
        text: document.body.innerText
      };
    });

    const dashHidden = () => {
      ok(seen.gate && !seen.dash, '入口だけが出て、中身は出ない');
      ok(seen.rows === 0, '表に行が1つも出ていない', '行数 ' + seen.rows);
      ok(!seen.text.includes(FAKE_NAME) && !seen.text.includes('pilot@example.com'),
         '氏名もメールも画面に1文字も出ていない');
    };

    if (c.key === 'logout') {
      dashHidden();
      ok(seen.rpc.length === 0, 'DB の入口を1回も叩いていない', seen.rpc.join(','));
      ok(seen.from.length === 0, 'テーブルを1つも触っていない', seen.from.join(','));
      ok(seen.loginShown, 'ログインへの行き先が出ている');
      ok(/ログイン|logged in|log in/i.test(seen.msg), '理由が書いてある', seen.msg);
    }
    if (c.key === 'notadmin') {
      dashHidden();
      ok(seen.rpc.join(',') === 'pv_is_admin',
         '管理者か聞いたところで止まり、一覧は取りに行かない', seen.rpc.join(','));
      ok(seen.from.length === 0, 'テーブルを1つも触っていない', seen.from.join(','));
      ok(seen.loginShown, '別のアカウントで入り直せる');
    }
    if (c.key === 'admin') {
      ok(!seen.gate && seen.dash, '中身が出る');
      ok(seen.rows === 1, '一覧が出ている', '行数 ' + seen.rows);
      ok(seen.rpc.join(',') === 'pv_is_admin,admin_list_profiles,admin_list_reviews',
         'サーバーの入口だけを使っている', seen.rpc.join(','));
      ok(seen.from.length === 0, '管理者でもテーブルは直接触らない', seen.from.join(','));
    }
    if (c.key === 'nosql') {
      dashHidden();
      ok(seen.msg.length > 10, '黙って空の表を出さず、理由を出す', seen.msg);
    }

    await page.close();
  }
}

await browser.close();
console.log(`\n════ ${pass} 件 通過 / ${fail} 件 失敗 ════`);
process.exitCode = fail ? 1 : 0;
