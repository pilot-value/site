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
        5. 承認の入口がまだ無い → 数は「—」、面の見出しの横に「準備中」（半分の数を出さない）
        6. 通貨を USD にしても、承認の面の「20万円」は打たれた字のまま（運営は見た字を通す）
     D) 承認・追加（admin-queue.js。2026-10-17）── 字は字のまま出る・通すときは見た版（rev）を添える・
        選ぶだけでは送らない・数は全部読めたときだけ・上限まで来たら「以上」

   実行: node assert-admin.mjs
   ⚠️ localhost が要る（node serve.mjs）。本番の DB には触らない（Supabase ごと差し替える）。
*/
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const BASE = 'http://localhost:3000';
const read = (p) => readFileSync(new URL('./' + p, import.meta.url), 'utf8');
/* 中身の指紋（assert-links.mjs と同じ式：sha256 の頭8字）。HTML が読む ?v= と合っていなければ、古い部品が最長4時間残る */
const fp = (p) => createHash('sha256').update(readFileSync(new URL('./' + p, import.meta.url))).digest('hex').slice(0, 8);
const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');

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

  /* ★承認・追加（2026-10-17）。部品は2つの共有ファイル。指紋が古いと、新しい HTML に古い JS が最長4時間付く */
  const pre = f.startsWith('en/') ? '../' : '';
  for (const asset of ['admin-queue.css', 'admin-queue.js']) {
    const want = fp(asset);
    const m = s.match(new RegExp('"' + reEsc(pre + asset) + '\\?v=([0-9a-f]+)"'));
    ok(!!m && m[1] === want, `${asset} を ?v=指紋 付きで読んでいる`,
       m ? `${asset} の指紋が古い（?v=${m[1]} → ?v=${want} に直す）` : `${asset} を ?v= 付きで読んでいない（?v=${want}）`);
  }
  const head = s.slice(0, s.indexOf('</head>'));
  ok(head.includes('<link rel="stylesheet" href="' + pre + 'admin-queue.css?v='), '見た目（admin-queue.css）は <head> で読む');
  ok(new RegExp('<script src="' + reEsc(pre) + 'admin-queue\\.js\\?v=[0-9a-f]+"></script>\\s*<script>\\s*const SB_URL').test(s),
     'admin-queue.js はページの script の直前で読む（後ろだと、ログイン済みのとき start がまだ無い）');
  const show = (s.match(/function showDashboard\(\) \{[\s\S]*?\n  \}/) || [''])[0];
  ok(/loadData\(\);\s*if \(window\.PVAdminQueue\) PVAdminQueue\.start\(sb\);/.test(show)
     && s.split('PVAdminQueue.start(').length === 2,
     '承認の読み出しは、管理者と分かったあと（showDashboard の中）の1か所からだけ始まる');
  const bar = (s.match(/<div id="dashboard">\s*(<div class="adm-top" id="adm-top">[\s\S]*?<\/div>)/) || [])[1] || '';
  const labels = [...bar.matchAll(/<button [^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
  const L = f.startsWith('en/') ? ['Approve—', 'Add'] : ['承認—', '追加'];
  ok(!!bar && labels.length === 2 && labels[0] === L[0] && labels[1] === L[1]
     && bar.includes('<span class="adm-n" id="adm-n" data-state="idle">—</span>'),
     `ダッシュボードの最初の子が「${L[0].slice(0, -1)}」（数は「—」で出荷）と「${L[1]}」の2つのボタン`, JSON.stringify(labels));
  ok(/<section class="adm-panel pv-no-cur" id="adm-q"/.test(s) && /<section class="adm-panel pv-no-cur" id="adm-a"/.test(s),
     '承認と追加の面は両方 pv-no-cur（通貨の書き換えを受けない）');
}

/* ── D) admin-queue.js のソース ───────────────────────────────── */
console.log('\n════ D) admin-queue.js（承認・追加）のソース ════');
{
  const aq = read('admin-queue.js');
  /* 呼んでよい入口（この組がちょうど。名前は呼ぶ場所に字のまま） */
  const RPCS = ['pv_stay_add', 'pv_stay_moderate', 'pv_stay_photo', 'pv_stay_queue',
                'pv_town_admin_add', 'pv_town_moderate', 'pv_town_queue'];
  ok(!/\.from\(/.test(aq), 'テーブルを直接読まない（.from( が無い）');
  ok(!/innerHTML|insertAdjacentHTML|outerHTML|document\.write/.test(aq),
     '会員が打った字を HTML として入れる道が無い（innerHTML ・ insertAdjacentHTML ・ outerHTML ・ document.write が無い）');
  const named = [...aq.matchAll(/sb\.rpc\('([a-z_]+)'/g)].map((m) => m[1]);
  ok(aq.split('.rpc(').length - 1 === named.length && [...new Set(named)].sort().join(',') === RPCS.join(','),
     '呼ぶ入口は決めた組だけ・名前は呼ぶ場所に字のまま', [...new Set(named)].sort().join(','));
  const townQ = (read('db/towns.sql').match(/create or replace function public\.pv_town_queue\([\s\S]*?\$fn\$;/) || [''])[0];
  const stayQ = (read('db/stays.sql').match(/create or replace function public\.pv_stay_queue\([\s\S]*?\$fn\$;/) || [''])[0];
  ok(aq.split('var CAP = 200;').length === 2 && townQ.split('limit 200').length === 3 && stayQ.split('limit 200').length === 3,
     '上限の数（CAP 200）が、待ち行列の SQL の limit 200（街の2つ・ステイ先の2つ）と同じ');
  /* 同じ字（写したもの）── 元の字が変わる・鍵の名前が変わると、ここが赤くなる（黙って緑にならない） */
  const stay = read('career-stay.js'), live = read('career-live.js');
  const block = (src, h) => { const i = src.indexOf(h); return i < 0 ? '' : src.slice(i, src.indexOf('};', i)); };
  const val = (b, k) => { const m = b.match(new RegExp('^\\s*' + k + ":\\s*'([^']*)'", 'm')); return m ? m[1] : null; };
  const SAME = [
    ...['forbidden', 'own_post', 'final', 'not_found', 'changed']
      .map((k) => ['career-stay.js SAY_MOD.' + k, val(block(stay, 'var SAY_MOD = {'), k)]),
    ['career-stay.js SAY_FAIL', (stay.match(/var SAY_FAIL = '([^']*)';/) || [])[1] || null],
    ['career-stay.js T.rej', val(block(stay, 'var T = {'), 'rej')],
    ['career-stay.js T.pending', val(block(stay, 'var T = {'), 'pending')],
    ['career-live.js T.sumGood', val(block(live, 'var T = {'), 'sumGood')],
    ['career-live.js T.sumConcern', val(block(live, 'var T = {'), 'sumConcern')],
    ['career-live.js T.off', val(block(live, 'var T = {'), 'off')],
    /* ステイ先と「追加」の面（ホテルの欄の名前・種類・写真・同じ名前） */
    ['career-stay.js SAY_ADD.exists', val(block(stay, 'var SAY_ADD = {'), 'exists')],
    ['career-stay.js SAY_MOD.exists', val(block(stay, 'var SAY_MOD = {'), 'exists')],
    ...['photoErr', 'fName', 'fAddr', 'fMap', 'fNote', 'map']
      .map((k) => ['career-stay.js T.' + k, val(block(stay, 'var T = {'), k)]),
    ...[0, 1, 2].map((i) => ['career-stay.js KINDS[' + i + ']',
      (stay.match(/var KINDS = \[\['hotel', '([^']+)'\], \['food', '([^']+)'\], \['spot', '([^']+)'\]\];/) || [])[i + 1] || null]),
    ['pv-contrib.js 街の欄の名前', (read('pv-contrib.js').match(/el\('label', 'pvc-label', '([^']+)', \{ id: 'pvc-l-town'/) || [])[1] || null],
  ];
  for (const [src, v] of SAME)
    ok(v !== null && aq.includes("'" + v + "'"), `同じ字：${src}（${v}）`, v === null ? '元の字が見つからない' : 'admin-queue.js に同じ字が無い');
  const ANS = "return '回答 ' + n + '人';";
  ok(live.split(ANS).length === 2 && aq.split(ANS).length === 2, `同じ字：回答の人数（${ANS}）が career-live.js と admin-queue.js に1つずつ`);
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
/* 職位は会員が自分で書ける列。口コミの本文も会員が書く。どちらも管理者の画面に出るので、
   タグや引用符を書かれても「字として出るだけ」でなければならない（働くと、管理者の画面で動く）。 */
const HOSTILE = '<img src=x onerror=__pvHit=1>';
const QUOTED  = 'ok" onmouseover="__pvHit=1';
/* CSV に書き出したとき、表計算ソフトが式として読む頭の字（= と @）。字のまま出ることを見る */
const FORMULA = ['=1+1', '@SUM(1)'];

const CASES = [
  { key: 'logout',   label: '1. ログアウトのまま開く',              session: false, admin: false, err: false },
  { key: 'notadmin', label: '2. ログイン済みだが管理者ではない',      session: true,  admin: false, err: false },
  { key: 'admin',    label: '3. 管理者',                            session: true,  admin: true,  err: false },
  { key: 'nosql',    label: '4. まだ db/admin.sql を流していない',   session: true,  admin: true,  err: true  },
  { key: 'noqueue',  label: '5. 承認の入口がまだ無い（関数が無い）', session: true,  admin: true,  err: false, queue: 'off' },
  { key: 'usd',      label: '6. 通貨を USD にしてから開く',          session: true,  admin: true,  err: false, usd: true }
];
/* 承認の面に並ぶ待ち行列の作り物（名前・文・会社と基地）。文の1つは引用符入り・もう1つは「20万円」 */
const RENT = '家賃は20万円くらい';
const TEXT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
/* 行の中身を、鍵の並びに左右されずに比べる */
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
const callsOf = (page, n) => page.evaluate((x) => window.__args.filter((a) => a[0] === x).map((a) => a[1]), n);
/* 管理者の画面の「承認」：開いた時点の形 → 押したときに送るもの（どれも条件で待つ。時間では待たない） */
async function queueChecks(page, lang) {
  const EN = lang === 'en';
  await page.waitForFunction(() => document.getElementById('adm-n').getAttribute('data-state') === 'ok', { timeout: 10000 });
  const v = await page.evaluate((hostile, quoted, rent) => {
    const top = document.getElementById('adm-top'), h1 = document.querySelector('#dashboard h1');
    const rt = top.getBoundingClientRect(), rh = h1.getBoundingClientRect();
    const q = document.getElementById('adm-q');
    const born = [...q.querySelectorAll('*')].some((e) => [...e.attributes].some((a) => /^on/i.test(a.name)));
    const town = q.querySelector('li[data-adm="town"][data-id="11"] .adm-row-v');
    const place = q.querySelector('li[data-adm="place"] .adm-row-v');
    const map = q.querySelector('li[data-adm="place"] a.adm-act');
    return {
      place: place ? place.textContent === hostile && !place.children.length : false,
      map: map ? { href: map.getAttribute('href'), target: map.getAttribute('target'), rel: map.getAttribute('rel'), text: map.textContent } : null,
      hours: [...q.querySelectorAll('li[data-adm="place"] .adm-row-t')].map((e) => e.textContent),
      first: document.getElementById('dashboard').firstElementChild === top,
      bar: rt.height > 0 && getComputedStyle(top).display !== 'none' && rt.bottom <= rh.top,
      n: document.getElementById('adm-n').textContent,
      open: !q.hidden && document.getElementById('adm-b-q').getAttribute('aria-expanded') === 'true',
      imgs: q.querySelectorAll('img').length, born, hit: !!window.__pvHit,
      name: town ? town.textContent === hostile && !town.children.length : false,
      quoted: [...q.querySelectorAll('.adm-row-t')].some((e) => e.textContent === quoted && !e.children.length),
      rent: [...q.querySelectorAll('.adm-row-t')].some((e) => e.textContent === rent),
      tag: (q.querySelector('li[data-adm="text"] .adm-tag') || {}).textContent || '',
      count: (q.querySelectorAll('li[data-adm="town"][data-id="11"] .adm-row-k')[1] || {}).textContent || ''
    };
  }, HOSTILE, QUOTED, RENT);
  ok(v.first && v.bar, 'AQ1 「承認」「追加」の帯が、ダッシュボードの一番上（見出しより上）に見えている', JSON.stringify(v));
  ok(v.n === '4', 'AQ2 数は待っている名前2つ＋文1つ＋ステイ先の場所1つの合計「4」', v.n);
  ok(v.open, 'AQ3 待っているものがあれば、承認の面は押さなくても開いている');
  ok(v.imgs === 0 && !v.born && !v.hit && v.name && v.quoted && v.rent && v.place,
     'AQ4/AQ14 会員が打った街・ホテルの名前のタグ・文の引用符は、字として出るだけ（絵も属性も生えない）', JSON.stringify(v));
  ok(v.tag === (EN ? 'Waiting' : '確認待ち') && v.count === (EN ? '2 members' : '回答 2人'),
     'AQ4 文の行には街が確認待ちの印、名前の行には回答の人数', JSON.stringify({ tag: v.tag, count: v.count }));
  ok(!!v.map && v.map.href === 'https://maps.google.com/?q=haneda' && v.map.target === '_blank' && v.map.rel === 'noopener'
     && v.map.text === 'Google マップ' && v.hours.includes(EN ? '26 h' : '26時間') && v.hours.includes('東京都大田区羽田空港'),
     'ステイ先の行に住所・都市・ステイ時間と「Google マップ」（別の窓）が出る', JSON.stringify({ map: v.map, hours: v.hours }));

  /* AQ5 文を通す ── 送るのは id と見た版（rev）だけ。行が消え、数が1つ減る */
  await page.click('#adm-q li[data-adm="text"] [data-act="ok"]');
  await page.waitForFunction(() => !document.querySelector('#adm-q li[data-adm="text"]'), { timeout: 10000 });
  const m5 = await callsOf(page, 'pv_town_moderate');
  const n5 = await page.$eval('#adm-n', (e) => e.textContent);
  ok(m5.length === 1 && canon(m5[0]) === canon({ p: { target: 'text', id: TEXT_ID, state: 'public', rev: 'r-1' } }) && n5 === '3',
     'AQ5 文の「承認」は {target:text, id, state:public, rev} を1回だけ送り、行が消えて数が1つ減る', JSON.stringify({ m5, n5 }));

  /* AQ14 ステイ先の場所を通す ── 送るのは id と見た版（rev）だけ。行が消え、数が1つ減る */
  await page.click('#adm-q li[data-adm="place"] [data-act="ok"]');
  await page.waitForFunction(() => !document.querySelector('#adm-q li[data-adm="place"]'), { timeout: 10000 });
  const m14 = await callsOf(page, 'pv_stay_moderate');
  const n14 = await page.$eval('#adm-n', (e) => e.textContent);
  ok(m14.length === 1 && canon(m14[0]) === canon({ p: { target: 'place', id: 'bbbbbbbb-0000-4000-8000-000000000001', state: 'public', rev: 'p-1' } })
     && n14 === '2',
     'AQ14 場所の「承認」は {target:place, id, state:public, rev} を1回だけ送り、行が消えて数が1つ減る', JSON.stringify({ m14, n14 }));

  /* AQ12 同じ街として承認 ── 矢印キーでもマウスでも、選ぶだけでは送らない。ボタンを押して初めて送る */
  const row12 = '#adm-q li[data-adm="town"][data-id="12"]';
  await page.focus(row12 + ' select[data-act="into"]');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.select(row12 + ' select[data-act="into"]', '21');
  const m12a = await callsOf(page, 'pv_town_moderate');
  const enabled = await page.evaluate((r) => { const b = document.querySelector(r); return b ? !b.disabled : null; }, row12 + ' [data-act="merge"]');
  ok(m12a.length === 1 && enabled, 'AQ12 街を選んだだけでは何も送らない（束ねるボタンが押せるようになるだけ）',
     JSON.stringify({ sent: m12a.length - 1, enabled }));
  const reads0 = (await callsOf(page, 'pv_town_queue')).length;
  await page.click(row12 + ' [data-act="merge"]');
  await page.waitForFunction((r) => !document.querySelector(r), { timeout: 10000 }, row12);
  const m12 = await callsOf(page, 'pv_town_moderate');
  ok(m12.length === 2 && canon(m12[1]) === canon({ p: { target: 'town', id: 12, state: 'public', into: 21 } })
     && (await callsOf(page, 'pv_town_queue')).length === reads0 + 1,
     'AQ12 「同じ街として承認」を押すと {target:town, id, state:public, into} を送り、待ち行列を読み直す', JSON.stringify(m12[1]));

  /* AQ6 名前を却下 ── 送って、読み直して、行が消える */
  const row11 = '#adm-q li[data-adm="town"][data-id="11"]';
  await page.click(row11 + ' [data-act="no"]');
  await page.waitForFunction((r) => !document.querySelector(r), { timeout: 10000 }, row11);
  const m6 = await callsOf(page, 'pv_town_moderate');
  ok(m6.length === 3 && canon(m6[2]) === canon({ p: { target: 'town', id: 11, state: 'rejected' } })
     && (await callsOf(page, 'pv_town_queue')).length === reads0 + 2,
     'AQ6 名前の「却下」は {target:town, id, state:rejected} を送り、読み直すと行が無い', JSON.stringify(m6[2]));
  await page.waitForFunction(() => document.getElementById('adm-n').textContent === '0', { timeout: 10000 }).catch(() => {});
  const none = await page.evaluate(() => ({ n: document.getElementById('adm-n').textContent,
    say: (document.querySelector('#adm-q [data-adm="none"]') || {}).textContent || '' }));
  ok(none.n === '0' && none.say === (EN ? 'Nothing is waiting' : '確認待ちはありません'),
     '全部片づくと数は「0」・面には「確認待ちはありません」', JSON.stringify(none));

  /* AQ14 写真 ── 待ち行列に写真が入ったら、面が開いているあいだに1枚ずつ取りにいく（1枚につき1回）。読めない写真は一言で */
  const PH1 = 'cccccccc-0000-4000-8000-000000000001', PH2 = 'cccccccc-0000-4000-8000-0000000000bad';
  await page.evaluate((a, b) => {
    window.__q.photos = [
      { id: a, mine: false, place: 'bbbbbbbb-0000-4000-8000-000000000002', airline: 'jal', iata: 'HND', kind: 'hotel', name: 'ホテル見本', place_state: 'public' },
      { id: b, mine: false, place: 'bbbbbbbb-0000-4000-8000-000000000003', airline: 'jal', iata: 'HND', kind: 'hotel', name: 'ホテル見本2', place_state: 'pending' }];
    return window.PVAdminQueue.reload();
  }, PH1, PH2);
  await page.waitForFunction((a, b) => document.querySelector(`#adm-q li[data-adm="photo"][data-id="${a}"] img`)
    && document.querySelector(`#adm-q li[data-adm="photo"][data-id="${b}"] .adm-ph .adm-say`), { timeout: 10000 }, PH1, PH2).catch(() => {});
  await page.evaluate(() => window.PVAdminQueue.reload());
  const ph = await page.evaluate((a, b) => {
    const img = document.querySelector(`#adm-q li[data-adm="photo"][data-id="${a}"] img`);
    const bad = document.querySelector(`#adm-q li[data-adm="photo"][data-id="${b}"] .adm-ph`);
    return { calls: window.__args.filter((x) => x[0] === 'pv_stay_photo' && x[1] && x[1].p && x[1].p.id === a).map((x) => x[1]),
             src: img ? img.getAttribute('src').slice(0, 15) : null, alt: img ? img.getAttribute('alt') : null,
             bad: bad ? bad.textContent : null, n: document.getElementById('adm-n').textContent };
  }, PH1, PH2);
  ok(ph.calls.length === 1 && canon(ph.calls[0]) === canon({ p: { id: PH1 } }) && ph.src === 'data:image/png;' && ph.alt === 'ホテル見本',
     'AQ14 写真は {id} で1回だけ読み、data:image/ の絵（alt は場所の名前）で出す（読み直しても取りにいかない）', JSON.stringify(ph));
  ok(ph.bad === (EN ? 'The photo cannot be shown' : '写真を表示できません') && ph.n === '2',
     `AQ14 読めない写真の枠には「${EN ? 'The photo cannot be shown' : '写真を表示できません'}」、数は写真2枚の「2」`, JSON.stringify(ph));

  /* AQ10 ステイ先だけ読めない ── 数は「—」（街の数だけを出さない）。街の行はそのまま。ステイ先の見出しに「読み込めませんでした」「更新」 */
  await page.evaluate(() => {
    window.__q.photos = [];
    window.__q.towns = [{ id: 13, airline: 'ana', base: 'NRT', name: 'なりた', posts: 1 }];
    window.__q.stayFail = true;
    return window.PVAdminQueue.reload();
  });
  const half = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('#adm-q h2.adm-h')];
    return { n: document.getElementById('adm-n').textContent, st: document.getElementById('adm-n').getAttribute('data-state'),
             town: !!document.querySelector('#adm-q li[data-adm="town"][data-id="13"]'),
             parts: hs.map((h) => ({ part: (h.querySelector('.adm-part') || {}).textContent || null,
                                      btn: (h.querySelector('[data-act="reload"]') || {}).textContent || null })) };
  });
  ok(half.n === '—' && half.st === 'part' && half.town && half.parts.length === 2 && half.parts[0].part === null
     && half.parts[1].part === (EN ? 'Could not loadRefresh' : '読み込めませんでした更新') && half.parts[1].btn === (EN ? 'Refresh' : '更新'),
     'AQ10 ステイ先だけ読めないときも数は「—」・街の行はそのまま・ステイ先の見出しに「読み込めませんでした」と「更新」', JSON.stringify(half));
  await page.evaluate(() => { window.__q.stayFail = false; });
  await page.click('#adm-q [data-act="reload"]');
  await page.waitForFunction(() => document.getElementById('adm-n').getAttribute('data-state') === 'ok', { timeout: 10000 }).catch(() => {});
  const back = await page.$eval('#adm-n', (e) => e.textContent);
  ok(back === '1', '「更新」を押すと読み直し、読めたら数が戻る（街の名前1つ）', back);

  /* AQ13 一覧が上限（200件）まで来た ── 本当の数は分からないので「以上」を付ける */
  await page.evaluate((id) => {
    window.__q.towns = [];
    window.__q.texts = Array.from({ length: 200 }, (_, i) => ({ id: id.slice(0, -3) + String(100 + i), airline: 'jal', base: 'HND',
      town: '品川', town_state: 'public', good: 'g' + i, concern: null, rev: 'r' + i }));
    return window.PVAdminQueue.reload();
  }, TEXT_ID);
  const n13 = await page.$eval('#adm-n', (e) => e.textContent);
  ok(n13 === (EN ? '200+' : '200以上'), `AQ13 200件まで来たら「${EN ? '200+' : '200以上'}」`, n13);

  /* AQ8 帯の2つのボタンはキーボードで使える（Tab・Enter。面の中で Escape を押すと閉じて、ボタンに戻る） */
  const st8 = () => page.evaluate(() => ({ f: document.activeElement && document.activeElement.id,
    q: !document.getElementById('adm-q').hidden, a: !document.getElementById('adm-a').hidden }));
  await page.focus('#adm-b-q');
  await page.keyboard.press('Tab');
  const k1 = await st8();
  await page.keyboard.press('Enter');
  const k2 = await st8();
  await page.keyboard.press('Tab');
  const inA = await page.evaluate(() => document.getElementById('adm-a').contains(document.activeElement));
  await page.keyboard.press('Escape');
  const k3 = await st8();
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  await page.keyboard.press('Enter');
  const k4 = await st8();
  ok(k1.f === 'adm-b-a' && k2.a && !k2.q && inA && k3.f === 'adm-b-a' && !k3.a && !k3.q && k4.f === 'adm-b-q' && k4.q && !k4.a,
     'AQ8 「承認」「追加」は Tab と Enter で開き、面の中の Escape で閉じてボタンに戻る', JSON.stringify({ k1, k2, inA, k3, k4 }));

  /* AQ7 「追加」→ 街 ── 選んだ会社・基地と打った名前だけを送り、「追加しました。」のあと待ち行列を読み直す */
  await page.click('#adm-b-a');
  await page.waitForFunction(() => document.querySelector('#adm-a form[data-adm="add-town"]'), { timeout: 10000 }).catch(() => {});
  const r7 = (await callsOf(page, 'pv_town_queue')).length;
  const o7 = await page.evaluate(() => ({ a: !document.getElementById('adm-a').hidden, q: !document.getElementById('adm-q').hidden,
    pick: (document.querySelector('#adm-a input[name="adm-kind"]:checked') || {}).value || null }));
  await page.select('#adm-a form[data-adm="add-town"] select', '0');
  await page.type('#adm-a form[data-adm="add-town"] input[data-k="name"]', '勝どき');
  await page.click('#adm-a form[data-adm="add-town"] button[type="submit"]');
  await page.waitForFunction(() => { const p = document.querySelector('#adm-a form[data-adm="add-town"] [data-adm="add-say"]'); return p && !p.hidden; }, { timeout: 10000 }).catch(() => {});
  await page.waitForFunction((n) => window.__args.filter((x) => x[0] === 'pv_town_queue').length > n, { timeout: 10000 }, r7).catch(() => {});
  const a7 = await page.evaluate(() => ({ say: (document.querySelector('#adm-a form[data-adm="add-town"] [data-adm="add-say"]') || {}).textContent || '',
    sent: window.__args.filter((x) => x[0] === 'pv_town_admin_add').map((x) => x[1]), reads: window.__args.filter((x) => x[0] === 'pv_town_queue').length }));
  ok(o7.a && !o7.q && o7.pick === 'town' && a7.sent.length === 1 && canon(a7.sent[0]) === canon({ p: { airline: 'jal', base: 'HND', name: '勝どき' } })
     && a7.say === (EN ? 'Added.' : '追加しました。') && a7.reads === r7 + 1,
     'AQ7 「追加」は承認の面を閉じて開き、街は {airline, base, name} だけを送って「追加しました。」、待ち行列を読み直す', JSON.stringify({ o7, a7 }));

  /* AQ15 「追加」→ ホテル ── 打ったものと publish:true だけを送る（打っていない欄は送らない） */
  await page.click('#adm-a input[name="adm-kind"][value="hotel"]');
  await page.waitForFunction(() => document.querySelectorAll('#adm-a form[data-adm="add-hotel"] select[data-k="airline"] option').length > 1, { timeout: 10000 }).catch(() => {});
  await page.select('#adm-a form[data-adm="add-hotel"] select[data-k="airline"]', 'jal');
  await page.type('#adm-a form[data-adm="add-hotel"] input[data-k="iata"]', 'hnd');
  await page.type('#adm-a form[data-adm="add-hotel"] input[data-k="name"]', 'ホテル見本3');
  await page.click('#adm-a form[data-adm="add-hotel"] button[type="submit"]');
  await page.waitForFunction(() => { const p = document.querySelector('#adm-a form[data-adm="add-hotel"] [data-adm="add-say"]'); return p && !p.hidden; }, { timeout: 10000 }).catch(() => {});
  const a15 = await page.evaluate(() => ({ say: (document.querySelector('#adm-a form[data-adm="add-hotel"] [data-adm="add-say"]') || {}).textContent || '',
    sent: window.__args.filter((x) => x[0] === 'pv_stay_add').map((x) => x[1]),
    town: !document.querySelector('#adm-a [data-adm="add-town-box"]').hidden }));
  ok(a15.sent.length === 1 && canon(a15.sent[0]) === canon({ p: { airline: 'jal', iata: 'HND', kind: 'hotel', name: 'ホテル見本3', publish: true } })
     && a15.say === (EN ? 'Added.' : '追加しました。') && !a15.town,
     'AQ15 ホテルは {airline, iata, kind:hotel, name, publish:true} だけを送り（打っていない欄は送らない）「追加しました。」', JSON.stringify(a15));
}

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

for (const lang of ['ja', 'en']) {
  const url = BASE + '/' + (lang === 'en' ? 'en/' : '') + 'admin.html';
  for (const c of CASES) {
    console.log(`\n════ C) ${lang} — ${c.label} ════`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.evaluateOnNewDocument((cfg, uid, name, hostile, quoted, formula, rent, textId, lang) => {
      localStorage.setItem('pv-theme', 'dark');
      if (cfg.usd) localStorage.setItem(lang === 'en' ? 'pv-currency-en' : 'pv-currency', 'USD');
      window.__rpc = [];   // 呼んだ入口の名前
      window.__args = [];  // 呼んだ入口と、渡した中身
      window.__from = [];  // 直接触ったテーブルの名前（1つでも入ったら負け）
      /* 待ち行列（運営の確認待ち）。名前の1つは HOSTILE、文の1つは引用符入りと「20万円」 */
      const SCOPES = [
        { airline: 'jal', name: '日本航空', base: 'HND', towns: [{ id: 21, name: '品川' }, { id: 22, name: '大崎' }] },
        { airline: 'ana', name: '全日空', base: 'NRT', towns: [{ id: 31, name: '成田' }] }];
      window.__q = {
        towns: [{ id: 11, airline: 'jal', base: 'HND', name: hostile, posts: 2 },
                { id: 12, airline: 'jal', base: 'HND', name: 'しながわ', posts: 1 }],
        texts: [{ id: textId, airline: 'jal', base: 'HND', town: 'しながわ', town_state: 'pending',
                  good: quoted, concern: rent, rev: 'r-1' }],
        /* ステイ先の確認待ち（場所の名前は HOSTILE）。写真は最初は無い（呼ぶ入口の並びを5つのままにするため） */
        places: [{ id: 'bbbbbbbb-0000-4000-8000-000000000001', kind: 'hotel', name: hostile, address: '東京都大田区羽田空港',
                   maps_url: 'https://maps.google.com/?q=haneda', note: null, city: 'Tokyo', stay_hours: 26, age: 0, mine: false,
                   state: 'pending', photos: [], airline: 'jal', iata: 'HND', rev: 'p-1' }],
        photos: [],
        stayFail: false
      };
      const QUEUES = ['pv_town_queue', 'pv_stay_queue'];
      /* 1×1 の PNG（写真の作り物） */
      const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const SESSION = cfg.session
        ? { user: { id: uid, email: 'pilot@example.com' } } : null;
      const ROWS = [{ id: uid, name: name, email: 'pilot@example.com', gender: 'male',
        birthdate: '1988-04-12', country: '日本', company: 'ZIPAIR', position: 'captain',
        created_at: '2026-01-11T00:00:00Z' },
        { id: uid.slice(0, -1) + '2', name: 'Second Pilot', email: 'second@example.com', gender: 'female',
        birthdate: '1990-01-01', country: '日本', company: formula[0], position: hostile,
        created_at: '2026-01-12T00:00:00Z' }];
      const REVIEWS = [{ id: 1, airline: 'ana', position: hostile, tenure_bucket: '3-5',
        monthly_salary: 100, bonus: 200, salary_note: formula[1], culture_score: 4, culture_comment: quoted,
        created_at: '2026-02-01T00:00:00Z' }];
      const RPC = {
        pv_is_admin: () => cfg.admin,
        admin_list_profiles: () => ROWS,
        admin_list_reviews: () => REVIEWS,
        pv_town_queue: () => ({ ok: true, scopes: SCOPES, towns: window.__q.towns.slice(), texts: window.__q.texts.slice() }),
        /* 本物のサーバーと同じく、通した・見送ったものは待ち行列から抜ける（読み直すと消えている） */
        pv_town_moderate: (a) => {
          const p = (a && a.p) || {};
          if (p.target === 'town') window.__q.towns = window.__q.towns.filter((t) => t.id !== p.id);
          if (p.target === 'text') window.__q.texts = window.__q.texts.filter((t) => t.id !== p.id);
          return { ok: true, target: p.target, id: p.id, state: p.state };
        },
        pv_town_admin_add: (a) => ({ ok: true, id: 99, name: ((a && a.p) || {}).name, state: 'public', existed: false }),
        pv_stay_queue: () => ({ ok: true, places: window.__q.places.slice(), photos: window.__q.photos.slice() }),
        pv_stay_moderate: (a) => {
          const p = (a && a.p) || {};
          if (p.target === 'place') window.__q.places = window.__q.places.filter((t) => t.id !== p.id);
          if (p.target === 'photo') window.__q.photos = window.__q.photos.filter((t) => t.id !== p.id);
          return { ok: true, target: p.target, id: p.id };
        },
        /* 写真を1枚読む。id が …bad で終わる写真は読めない（運営の画面は「写真を表示できません」を出す） */
        pv_stay_photo: (a) => {
          const id = String(((a && a.p) || {}).id || '');
          return /bad$/.test(id) ? { ok: false, status: 'not_found' } : { ok: true, mime: 'image/png', w: 1, h: 1, state: 'pending', b64: PNG };
        },
        pv_stay_add: (a) => ({ ok: true, item: Object.assign({ id: 'dddddddd-0000-4000-8000-000000000001', state: 'public' }, (a && a.p) || {}) })
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
          window.__args.push([n, a === undefined ? null : JSON.parse(JSON.stringify(a))]);
          const isList = n === 'admin_list_profiles' || n === 'admin_list_reviews';
          const res = (cfg.err && isList)
            ? { data: null, error: { message: 'function does not exist' } }
            : (cfg.queue === 'off' && QUEUES.includes(n))
              ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + n }, status: 404 }
              : (n === 'pv_stay_queue' && window.__q.stayFail)
                ? { data: null, error: { code: 'XX000', message: 'boom' }, status: 500 }
                : { data: RPC[n] ? RPC[n](a) : null, error: null };
          return { then: (o2, n2) => Promise.resolve(res).then(o2, n2) };
        }
      };
      Object.defineProperty(window, 'supabase',
        { value: { createClient: () => FAKE }, writable: false, configurable: false });
    }, c, UID, FAKE_NAME, HOSTILE, QUOTED, FORMULA, RENT, TEXT_ID, lang);

    await page.goto(url, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));

    const seen = await page.evaluate((hostile, quoted) => {
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
        text: document.body.innerText,
        /* 書かれたタグと引用符 ── 表の中に絵が生えていない・字として2か所に出ている・title の外へ出ていない */
        imgs: document.querySelectorAll('#users-tbody img, #reviews-tbody img').length,
        asText: [...document.querySelectorAll('#users-tbody .pos-tag, #reviews-tbody .pos-tag')]
          .filter(e => e.textContent === hostile && !e.children.length).length,
        title: (() => {
          const td = document.querySelector('#reviews-tbody td[title]');
          return td ? { same: td.getAttribute('title') === quoted, extra: td.hasAttribute('onmouseover') } : null;
        })(),
        hit: !!window.__pvHit
      };
    }, HOSTILE, QUOTED);

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
      ok(seen.rows === 2, '一覧が出ている', '行数 ' + seen.rows);
      ok(seen.imgs === 0 && seen.asText === 2 && !seen.hit,
         '職位に書かれたタグは、字として出るだけ（会員の表と口コミの表の両方）',
         `表の中の絵 ${seen.imgs}・字として出た数 ${seen.asText}・動いた ${seen.hit}`);
      ok(!!seen.title && seen.title.same && !seen.title.extra,
         '口コミの本文に書かれた引用符で、title の外へ出られない', JSON.stringify(seen.title));
      /* CSV の書き出し ── 保存の窓は出さず、作られた中身だけを読む */
      const csv = await page.evaluate(async () => {
        const got = [];
        URL.createObjectURL = (b) => { got.push(b); return 'blob:pv-test'; };
        URL.revokeObjectURL = () => {};
        HTMLAnchorElement.prototype.click = function () {};
        downloadCSV('users'); downloadCSV('reviews');
        return Promise.all(got.map((b) => b.text()));
      });
      const cells = (t, v) => String(t || '').split('"' + v + '"').length - 1;   // その字だけが入ったセルの数
      ok(csv.length === 2
         && cells(csv[0], "'" + FORMULA[0]) === 1 && cells(csv[0], FORMULA[0]) === 0
         && cells(csv[1], "'" + FORMULA[1]) === 1 && cells(csv[1], FORMULA[1]) === 0,
         "CSV に書き出しても、= や @ で始まる字が式にならない（頭に ' が付く）",
         JSON.stringify(csv.map((t) => String(t).split('\n').slice(1).join(' / ').slice(0, 200))));
      ok(/,"100","200",/.test(csv[1] || ''), "CSV の数はそのまま（' を付けない）",
         String(csv[1] || '').split('\n').slice(1).join(' / ').slice(0, 200));
      ok(seen.rpc.join(',') === 'pv_is_admin,admin_list_profiles,admin_list_reviews,pv_town_queue,pv_stay_queue',
         'サーバーの入口だけを使っている', seen.rpc.join(','));
      ok(seen.from.length === 0, '管理者でもテーブルは直接触らない', seen.from.join(','));
      /* 途中で行が見つからない等で止まったら、黙って落ちずに ❌ の1行で出す（後ろの場面は続けて見る） */
      await queueChecks(page, lang).catch((e) => ok(false, 'D) 承認の面の操作が途中で止まった', String(e && e.message || e).slice(0, 200)));
    }
    if (c.key === 'noqueue') {
      await page.waitForFunction(() => document.getElementById('adm-n').getAttribute('data-state') !== 'idle', { timeout: 10000 }).catch(() => {});
      const q = await page.evaluate(() => ({
        dash: getComputedStyle(document.getElementById('dashboard')).display !== 'none',
        rows: document.querySelectorAll('#users-tbody tr').length,
        n: document.getElementById('adm-n').textContent, st: document.getElementById('adm-n').getAttribute('data-state'),
        closed: document.getElementById('adm-q').hidden,
        add: (document.getElementById('adm-b-a') || {}).textContent || ''
      }));
      await page.click('#adm-b-q');
      const part = await page.evaluate(() => ({ open: !document.getElementById('adm-q').hidden,
        parts: [...document.querySelectorAll('#adm-q h2.adm-h')].map((h) => (h.querySelector('.adm-part') || {}).textContent || null),
        rows: document.querySelectorAll('#adm-q li.adm-row').length }));
      ok(q.dash && q.rows === 2, 'AQ10 承認の入口が無くても、ダッシュボードと会員の表（2行）はそのまま出る', JSON.stringify(q));
      ok(q.n === '—' && q.st === 'part' && !/\d/.test(q.n), 'AQ10 数は「—」（半分しか読めないときに数を出さない）', JSON.stringify(q));
      ok(q.closed && part.open && part.parts.length === 2 && part.parts.every((x) => x === (lang === 'en' ? 'Not connected yet' : '準備中'))
         && part.rows === 0,
         'AQ10 面は閉じたまま。開くと、街とステイ先の見出しの横にそれぞれ「準備中」', JSON.stringify(part));
      ok(q.add === (lang === 'en' ? 'Add' : '追加'), 'AQ10 「追加」はそのまま出ている', q.add);
    }
    if (c.key === 'usd') {
      /* 通貨が本当に動いていることを、面の外に置いた同じ字で確かめてから、面の中を見る（空振りの緑にしない） */
      await page.waitForFunction(() => document.querySelector('#adm-q li[data-adm="text"]'), { timeout: 10000 }).catch(() => {});
      await page.evaluate((rent) => { const p = document.createElement('p'); p.id = 'pv-test-probe'; p.textContent = rent; document.body.appendChild(p); }, RENT);
      await page.waitForFunction(() => !!document.querySelector('#pv-test-probe .pv-cur'), { timeout: 10000 }).catch(() => {});
      const u = await page.evaluate((rent) => ({
        probe: !!document.querySelector('#pv-test-probe .pv-cur'),
        same: [...document.querySelectorAll('#adm-q .adm-row-t')].some((e) => e.textContent === rent && !e.children.length),
        cur: document.querySelectorAll('#adm-q .pv-cur').length
      }), RENT);
      ok(u.probe && u.same && u.cur === 0, `AQ11 USD でも、承認の面の「${RENT}」は打たれた字のまま（書き換えの span が無い）`, JSON.stringify(u));
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
