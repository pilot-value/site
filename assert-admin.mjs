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
     E) 仕上げ（WP-towns-13p。2026-10-17）── 断られた理由はサイトに在る一言で（status の名前を出さない）・
        英語のページは英語の字だけ（会社の名前・Google Maps・「1 member」）・空の部分ごとに「確認待ちはありません」・
        ホテルの会社と空港は「追加」で足せるものを候補に・「追加」に打った字はこのタブに30分（打った人にだけ戻す）
     F) オーナーだけの部分（WP-towns-13v。2026-10-17）── オーナーでない運営には「申請してきた人」「会員一覧」が1字も出ない・
        オーナーには返ってきた順のまま字として出る・申請の画像は押したときに1回だけ読み、閉じたら DOM にも保存領域にも残らない・
        「verified」「見送り」は画像の面の中だけ・送るのは {id, state, via} だけ・数（承認の横）に入れない・
        マイページと管理ページの「ログアウト」は、このタブの打ちかけ（街・ステイ先・管理ページ）を全部消す

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
  const RPCS = ['pv_stay_add', 'pv_stay_airports', 'pv_stay_moderate', 'pv_stay_photo', 'pv_stay_queue',
                'pv_town_admin_add', 'pv_town_moderate', 'pv_town_queue',
                /* オーナーだけの部分（WP-towns-13v）：2つの一覧・申請の画像・verified */
                'pv_stay_applicants', 'pv_stay_members', 'pv_stay_applicant_image', 'pv_stay_viewer_verify'].sort();
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

  /* ★ホテルを足せなかったときの一言（WP-towns-13p・G2）── career-stay.js の SAY_ADD と、理由の鍵も字も1つも違わない
       （ステイ先の欄が同じ理由に出す字。T.needName のように T を指す行は、T の字に解いて比べる） */
  const csT = block(stay, 'var T = {');
  const csAdd = Object.fromEntries([...block(stay, 'var SAY_ADD = {').matchAll(/^\s*([a-z_]+):\s*(?:'([^']*)'|T\.([A-Za-z]+))/gm)]
    .map((m) => [m[1], m[2] !== undefined ? m[2] : val(csT, m[3])]));
  const aqAdd = Object.fromEntries([...block(aq, 'var SAY_ADD = EN ? { exists: SAY.exists } : {').matchAll(/^\s*([a-z_]+):\s*'([^']*)'/gm)]
    .map((m) => [m[1], m[2]]));
  const sortJ = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
  ok(Object.keys(csAdd).length >= 12 && Object.values(csAdd).every((v) => typeof v === 'string' && v) && sortJ(aqAdd) === sortJ(csAdd),
     `同じ字：career-stay.js SAY_ADD（${Object.keys(csAdd).length}の理由）と admin-queue.js の SAY_ADD が、鍵も字も同じ`,
     JSON.stringify(Object.keys(csAdd).filter((k) => aqAdd[k] !== csAdd[k]).map((k) => [k, csAdd[k], aqAdd[k] || null])));
  ok(!/notAdded|追加できませんでした（|Could not add \(/.test(aq), 'サーバーの status の名前を字に混ぜて出す道が無い（「追加できませんでした（…）」を使わない）');

  /* ★英語のページ（WP-towns-13p・G5）── 見出し・ボタン・一言・地図のリンクの英語の表に、日本語が1字も無い */
  const enOf = (h) => { const i = aq.indexOf(h); return i < 0 ? '' : aq.slice(i, aq.indexOf('} : {', i)); };
  const EN_PARTS = { T: enOf('var T = EN ? {'), SAY: enOf('var SAY = EN ? {'),
    FAIL: (aq.match(/var FAIL = EN \? '([^']*)'/) || [])[1] || '', SAY_ADD: (aq.match(/var SAY_ADD = EN \? (\{[^}]*\})/) || [])[1] || '' };
  const JP = /[぀-ヿ㐀-鿿＀-￯]/;
  const jpIn = Object.entries(EN_PARTS).filter(([, s]) => !s || JP.test(s)).map(([k, s]) => [k, (s.match(new RegExp('.{0,24}' + JP.source + '.{0,8}')) || ['（見つからない）'])[0]]);
  ok(jpIn.length === 0, '英語のページの表（T・SAY・FAIL・SAY_ADD）に日本語が1字も無い（「Google マップ」→ Google Maps）', JSON.stringify(jpIn));

  /* ★オーナーだけの部分（WP-towns-13v）の字 ── オーナーの言葉（申請してきた人・会員一覧・verified）と決めた字は1字も違わない。
       ほかはサイトに在る字の写し（元の字が変わると、ここが赤くなる） */
  const tEN = EN_PARTS.T;
  const tJA = (() => { const i = aq.indexOf('} : {', aq.indexOf('var T = EN ? {')); return i < 0 ? '' : aq.slice(i, aq.indexOf('};', i)); })();
  const listOf = (b, k) => { const m = b.match(new RegExp('^\\s*' + k + ':\\s*\\[([^\\]]*)\\]', 'm')); return m ? [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]) : null; };
  const mapOf = (b, k) => { const m = b.match(new RegExp('^\\s*' + k + ':\\s*\\{([^}]*)\\}', 'm')); return m ? Object.fromEntries([...m[1].matchAll(/([a-z]+):\s*'([^']*)'/g)].map((x) => [x[1], x[2]])) : null; };
  const RULED = {
    ja: { apps: '申請してきた人', members: '会員一覧', verified: 'verified', view: '画像を見る', applied: '申請あり' },
    en: { apps: 'Applicants', members: 'Members', verified: 'verified', view: 'View image', applied: 'Applied', decline: 'Decline', revoke: 'Revoke' }
  };
  for (const [lang, b] of [['ja', tJA], ['en', tEN]]) {
    const bad = Object.entries(RULED[lang]).filter(([k, v]) => val(b, k) !== v).map(([k, v]) => [k, v, val(b, k)]);
    ok(bad.length === 0, `オーナーの言葉と決めた字（${lang}）：${Object.values(RULED[lang]).map((v) => '「' + v + '」').join('')}が1字も違わない`, JSON.stringify(bad));
  }
  const apAge = [...read('actual-pay.js').matchAll(/^\s*age:\s*\[([^\]]*)\]/gm)].map((m) => [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]));
  const proofT = [...read('pv-proof-offer.js').matchAll(/^\s*close:\s*'([^']*)'/gm)].map((m) => m[1]);
  const emptyU = (f) => (read(f).match(/\$\{q\?'[^']*':'([^']*)'\}/) || [])[1] || null;
  const posOf = (f) => { const m = read(f).match(/const POS_LABEL\s*=\s*\{([^}]*)\}/); return m ? Object.fromEntries([...m[1].matchAll(/([a-z]+):'([^']*)'/g)].map((x) => [x[1], x[2]])) : null; };
  const SAME_OWN = {
    ja: [['career-stay.js T.rejected', val(block(stay, 'var T = {'), 'rejected'), val(tJA, 'decline')],
         ['roadmap.js の「取り消す」', read('roadmap.js').includes('取り消す') ? '取り消す' : null, val(tJA, 'revoke')],
         ['pv-proof-offer.js close（日本語）', proofT[0] || null, val(tJA, 'close')],
         ['admin.html 会員の表が空のとき', emptyU('admin.html'), val(tJA, 'noUsers')],
         ['actual-pay.js 投稿時期の段 0〜3（日本語）', JSON.stringify((apAge[0] || []).slice(0, 4)), JSON.stringify(listOf(tJA, 'age'))],
         ['admin.html POS_LABEL', JSON.stringify(posOf('admin.html')), JSON.stringify(mapOf(tJA, 'pos'))]],
    en: [['pv-proof-offer.js close（英語）', proofT[1] || null, val(tEN, 'close')],
         ['en/admin.html 会員の表が空のとき', emptyU('en/admin.html'), val(tEN, 'noUsers')],
         ['actual-pay.js 投稿時期の段 0〜3（英語）', JSON.stringify((apAge[1] || []).slice(0, 4)), JSON.stringify(listOf(tEN, 'age'))],
         ['en/admin.html POS_LABEL', JSON.stringify(posOf('en/admin.html')), JSON.stringify(mapOf(tEN, 'pos'))]]
  };
  for (const lang of ['ja', 'en']) {
    const bad = SAME_OWN[lang].filter(([, want, got]) => !want || want === '[]' || want === 'null' || want !== got);
    ok(bad.length === 0 && apAge.length === 2 && proofT.length === 2, `同じ字（${lang}・オーナーの部分）：${SAME_OWN[lang].map((x) => x[0]).join('・')}`, JSON.stringify(bad));
  }

  /* ★「ログアウト」は、このタブの打ちかけを全部消す（WP-towns-13v・P12.45 c）── マイページ（日英）と管理ページ（日英）の
       ログアウトの1行は、街・ステイ先・管理ページの3つの打ちかけを消し、ほかの鍵は残す（その1行を、作り物の保存領域で実際に走らせる） */
  const LOGOUT = /try \{ Object\.keys\(sessionStorage\)\.forEach\(function \(k\) \{ if \(\/\^pv_\([a-z|]+\)_draft:\/\.test\(k\)\) sessionStorage\.removeItem\(k\); \}\); \} catch \(e\) \{\}/g;
  const runLine = (line) => {
    const fake = {};
    for (const k of ['pv_admin_draft:town', 'pv_admin_draft:hotel', 'pv_contrib_draft:jal:roster', 'pv_stay_draft:jal|HNL', 'pv_other_keep']) fake[k] = '1';
    Object.defineProperty(fake, 'removeItem', { value: (k) => { delete fake[k]; }, enumerable: false });
    try { new Function('sessionStorage', line)(fake); } catch (e) { return ['ERR ' + e.message]; }
    return Object.keys(fake).sort();
  };
  for (const [f, fn] of [['profile.html', 'handleLogout'], ['en/profile.html', 'handleLogout'], ['admin.html', 'adminLogout'], ['en/admin.html', 'adminLogout']]) {
    const s = read(f);
    const body = (s.match(new RegExp('async function ' + fn + '\\(\\) \\{[\\s\\S]*?\\n\\s*\\}\\n')) || [''])[0];
    const lines = body.match(LOGOUT) || [];
    const left = lines.length === 1 ? runLine(lines[0]) : null;
    ok(lines.length === 1 && s.split('Object.keys(sessionStorage).forEach').length === 2 && JSON.stringify(left) === '["pv_other_keep"]',
       `${f} の「ログアウト」（${fn}）は、このタブの打ちかけ（街・ステイ先・管理ページの3つ）を全部消し、ほかの鍵は残す`, JSON.stringify({ n: lines.length, left }));
  }
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
  { key: 'usd',      label: '6. 通貨を USD にしてから開く',          session: true,  admin: true,  err: false, usd: true },
  { key: 'refuse',   label: '7. 足す・通すがサーバーに断られる（理由ごと）', session: true, admin: true, err: false },
  { key: 'draft',    label: '8. 「追加」に打った字（読み直し・戻る・30分・ログアウト・別の人）', session: true, admin: true, err: false },
  /* ★ここだけがオーナー。ほかの管理者の場面は全部「オーナーではない運営」（2つの一覧に forbidden が返る） */
  { key: 'owner',    label: '9. オーナー（申請してきた人・会員一覧・申請の画像・verified）', session: true, admin: true, err: false, owner: true }
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
      count: (q.querySelectorAll('li[data-adm="town"][data-id="11"] .adm-row-k')[1] || {}).textContent || '',
      count1: (q.querySelectorAll('li[data-adm="town"][data-id="12"] .adm-row-k')[1] || {}).textContent || '',
      /* 会社の名前（WP-towns-13p・G5）：街の行もステイ先の行も、そのページの言葉の会社名 */
      kTown: (q.querySelector('li[data-adm="town"][data-id="11"] .adm-row-k') || {}).textContent || '',
      kPlace: (q.querySelector('li[data-adm="place"] .adm-row-k') || {}).textContent || ''
    };
  }, HOSTILE, QUOTED, RENT);
  ok(v.first && v.bar, 'AQ1 「承認」「追加」の帯が、ダッシュボードの一番上（見出しより上）に見えている', JSON.stringify(v));
  ok(v.n === '4', 'AQ2 数は待っている名前2つ＋文1つ＋ステイ先の場所1つの合計「4」', v.n);
  ok(v.open, 'AQ3 待っているものがあれば、承認の面は押さなくても開いている');
  ok(v.imgs === 0 && !v.born && !v.hit && v.name && v.quoted && v.rent && v.place,
     'AQ4/AQ14 会員が打った街・ホテルの名前のタグ・文の引用符は、字として出るだけ（絵も属性も生えない）', JSON.stringify(v));
  ok(v.tag === (EN ? 'Waiting' : '確認待ち') && v.count === (EN ? '2 members' : '回答 2人'),
     'AQ4 文の行には街が確認待ちの印、名前の行には回答の人数', JSON.stringify({ tag: v.tag, count: v.count }));
  ok(v.count1 === (EN ? '1 member' : '回答 1人'), `G5 回答が1人の行は「${EN ? '1 member' : '回答 1人'}」`, v.count1);
  const JAL = EN ? 'Japan Airlines (JAL)' : '日本航空（JAL）';
  ok(v.kTown === JAL + ' · HND' && v.kPlace === JAL + ' · HND · ' + (EN ? 'Hotel' : 'ホテル'),
     `G5 街の行もステイ先の行も、会社はそのページの言葉の名前（「${JAL}」。小文字の符号・別の言葉の名前を出さない）`, JSON.stringify({ kTown: v.kTown, kPlace: v.kPlace }));
  ok(!!v.map && v.map.href === 'https://maps.google.com/?q=haneda' && v.map.target === '_blank' && v.map.rel === 'noopener'
     && v.map.text === (EN ? 'Google Maps' : 'Google マップ') && v.hours.includes(EN ? '26 h' : '26時間') && v.hours.includes('東京都大田区羽田空港'),
     `ステイ先の行に住所・都市・ステイ時間と「${EN ? 'Google Maps' : 'Google マップ'}」（別の窓）が出る`, JSON.stringify({ map: v.map, hours: v.hours }));

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
  /* G6 ステイ先が空になった ── その見出しの下にだけ「確認待ちはありません」（街はまだ待っている） */
  const none1 = await page.evaluate(() => [...document.querySelectorAll('#adm-q [data-adm="none"]')]
    .map((p) => ({ part: p.getAttribute('data-adm-part'), text: p.textContent, after: (p.previousElementSibling || {}).getAttribute && p.previousElementSibling.getAttribute('data-adm-list') })));
  ok(none1.length === 1 && none1[0].part === 'stay' && none1[0].after === 'stay' && none1[0].text === (EN ? 'Nothing is waiting' : '確認待ちはありません'),
     'G6 ステイ先が片づくと、ステイ先の一覧のすぐ下にだけ「確認待ちはありません」（待っている街の側には出ない）', JSON.stringify(none1));

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
    says: [...document.querySelectorAll('#adm-q [data-adm="none"]')].map((p) => [p.getAttribute('data-adm-part'), p.textContent,
      (p.previousElementSibling && p.previousElementSibling.getAttribute('data-adm-list')) || null,
      (() => { let h = p.previousElementSibling; while (h && h.tagName !== 'H2') h = h.previousElementSibling; return h ? h.firstChild.textContent : null; })()]) }));
  const NONE = EN ? 'Nothing is waiting' : '確認待ちはありません';
  ok(none.n === '0' && JSON.stringify(none.says) === JSON.stringify([['town', NONE, 'town', EN ? 'Towns' : '住みやすい街'], ['stay', NONE, 'stay', EN ? 'Stays' : 'ステイ先']]),
     `G6 全部片づくと数は「0」・街とステイ先の見出しの下にそれぞれ「${NONE}」`, JSON.stringify(none));

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
  /* G3 会社の欄は「追加」で足せる会社だけ（サーバーが返した就航地の会社）・空港の欄には、選んだ会社の就航地が候補に出る */
  const hint = await page.evaluate(() => {
    const f = document.querySelector('#adm-a form[data-adm="add-hotel"]'), i = f.querySelector('input[data-k="iata"]');
    const list = i.getAttribute('list') && document.getElementById(i.getAttribute('list'));
    return { airlines: [...f.querySelectorAll('select[data-k="airline"] option')].map((o) => o.value),
             iata: list ? [...list.querySelectorAll('option')].map((o) => o.value) : null };
  });
  await page.select('#adm-a form[data-adm="add-hotel"] select[data-k="airline"]', 'jal');
  const hintJal = await page.evaluate(() => { const i = document.querySelector('#adm-a form[data-adm="add-hotel"] input[data-k="iata"]');
    const list = document.getElementById(i.getAttribute('list') || ''); return list ? [...list.querySelectorAll('option')].map((o) => o.value) : null; });
  ok(hint.airlines[0] === '' && JSON.stringify(hint.airlines.slice(1).sort()) === JSON.stringify(['ana', 'jal']) && JSON.stringify(hint.iata) === '[]' && JSON.stringify(hintJal) === JSON.stringify(['HNL', 'LAX'])
     && (await callsOf(page, 'pv_stay_airports')).length === 1,
     'G3 ホテルの会社の欄は足せる会社だけ・会社を選ぶと空港の候補はその会社の就航地（足せる空港は1回だけ読む）', JSON.stringify({ hint, hintJal }));
  await page.type('#adm-a form[data-adm="add-hotel"] input[data-k="iata"]', 'hnl');
  await page.type('#adm-a form[data-adm="add-hotel"] input[data-k="name"]', 'ホテル見本3');
  await page.click('#adm-a form[data-adm="add-hotel"] button[type="submit"]');
  await page.waitForFunction(() => { const p = document.querySelector('#adm-a form[data-adm="add-hotel"] [data-adm="add-say"]'); return p && !p.hidden; }, { timeout: 10000 }).catch(() => {});
  const a15 = await page.evaluate(() => ({ say: (document.querySelector('#adm-a form[data-adm="add-hotel"] [data-adm="add-say"]') || {}).textContent || '',
    sent: window.__args.filter((x) => x[0] === 'pv_stay_add').map((x) => x[1]),
    town: !document.querySelector('#adm-a [data-adm="add-town-box"]').hidden }));
  ok(a15.sent.length === 1 && canon(a15.sent[0]) === canon({ p: { airline: 'jal', iata: 'HNL', kind: 'hotel', name: 'ホテル見本3', publish: true } })
     && a15.say === (EN ? 'Added.' : '追加しました。') && !a15.town,
     'AQ15 ホテルは {airline, iata, kind:hotel, name, publish:true} だけを送り（打っていない欄は送らない）「追加しました。」', JSON.stringify(a15));
}

/* ── 断られたとき（WP-towns-13p・G2）── サーバーが返しうる status を SQL から集め、1つずつ返させて、出る字を見る ──
   ★出る字は、サイトに在る一言そのもの（ステイ先の欄と同じ字・管理ページの断りの字）。status の名前は1字も出さない。
     英語のページで英語の字がまだ無い理由は、管理ページの FAIL（「Something went wrong. Please try again.」）。 */
const sqlBody = (f, n) => (read(f).match(new RegExp('create or replace function public\\.' + n + '\\([\\s\\S]*?\\$fn\\$;')) || [''])[0];
const grab = (body, re) => [...body.matchAll(re)].map((m) => m[1]);
const ST_IS = /'status',\s*'([a-z_]+)'/g;
const STATUS = {
  add:  [...new Set([...grab(sqlBody('db/stays.sql', 'pv_stay_add'), ST_IS), ...grab(sqlBody('db/stays.sql', 'pv_stay_clean'), /status := '([a-z_]+)'/g),
                     ...grab(sqlBody('db/stays.sql', 'pv_stay_clash'), /then '([a-z_]+)'/g)])].sort(),
  town: [...new Set(grab(sqlBody('db/towns.sql', 'pv_town_admin_add'), ST_IS))].sort(),
  tmod: [...new Set(grab(sqlBody('db/towns.sql', 'pv_town_moderate'), ST_IS))].sort(),
  smod: [...new Set(grab(sqlBody('db/stays.sql', 'pv_stay_moderate'), ST_IS))].sort()
};
/* 街の名前の検品が止めるときの日本語の文（db/towns.sql の pv_town_clean。運営の「追加」→ 街 が受け取りうる） */
const TOWN_MSG = (sqlBody('db/towns.sql', 'pv_town_clean').match(/raise exception '(街・最寄駅は[^']*)'/) || [])[1] || null;
const CS = (() => {
  const stay = read('career-stay.js');
  const block = (h) => { const i = stay.indexOf(h); return i < 0 ? '' : stay.slice(i, stay.indexOf('};', i)); };
  const T0 = block('var T = {');
  const val = (b, k) => { const m = b.match(new RegExp('^\\s*' + k + ":\\s*'([^']*)'", 'm')); return m ? m[1] : null; };
  const map = (h) => Object.fromEntries([...block(h).matchAll(/^\s*([a-z_]+):\s*(?:'([^']*)'|T\.([A-Za-z]+))/gm)].map((m) => [m[1], m[2] !== undefined ? m[2] : val(T0, m[3])]));
  return { add: map('var SAY_ADD = {'), mod: map('var SAY_MOD = {'), fail: (stay.match(/var SAY_FAIL = '([^']*)';/) || [])[1] || null };
})();
/* 管理ページの英語の断り（C9 で決めた字） */
const EN_SAY = {
  changed: 'The author changed it. The current content was loaded - check it and press again.',
  final: 'A rejected item cannot be published again.', own_post: 'Your own item is checked by another operator.',
  not_found: 'This can no longer be shown.', forbidden: 'Only the operator can do this.', exists: 'The same name is already registered.'
};
const EN_FAIL = 'Something went wrong. Please try again.';
const ALL_ST = [...new Set([...STATUS.add, ...STATUS.town, ...STATUS.tmod, ...STATUS.smod])];
async function refusalChecks(page, lang) {
  const EN = lang === 'en';
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const wantMod = (s) => EN ? (has(EN_SAY, s) ? EN_SAY[s] : EN_FAIL) : (has(CS.mod, s) ? CS.mod[s] : CS.fail);
  /* status の名前（と、名前に見える英小文字の塊）が出ていないか。日本語のページは英小文字3字以上の塊も無いこと。
     （英語の文には changed・final のような普通の語が入るので、英語のページは「_ を含む塊」と「status の名前だけの字」を見る。
      どちらのページも、出た字が決めた一言と1字も違わないことを別に見ている） */
  const codeIn = (t) => t == null || /[a-z]+_[a-z]+/.test(t) || ALL_ST.some((s) => t.trim() === s || t.includes('（' + s) || t.includes('(' + s))
    || (!EN && /[a-z_]{3,}/.test(t));
  ok(STATUS.add.length >= 13 && ['locked', 'bad_iata', 'bad_name', 'too_fast', 'rate_limited', 'queue_full', 'duplicate', 'exists'].every((s) => STATUS.add.includes(s))
     && STATUS.town.includes('forbidden') && STATUS.tmod.length >= 6 && STATUS.smod.length >= 6 && !!TOWN_MSG && Object.keys(CS.add).length >= 12 && !!CS.fail,
     '断りの理由を SQL から集められた（ホテルの追加・街の追加・街の承認・ステイ先の承認）', JSON.stringify(STATUS));
  await page.waitForFunction(() => document.getElementById('adm-n').getAttribute('data-state') === 'ok', { timeout: 10000 });
  const H = '#adm-a form[data-adm="add-hotel"]', TW = '#adm-a form[data-adm="add-town"]';
  const say = (f) => page.evaluate((s) => { const p = document.querySelector(s + ' [data-adm="add-say"]'); return p && !p.hidden ? p.textContent : null; }, f);
  const send = async (f, fn, set) => {
    const n0 = (await callsOf(page, fn)).length;
    await page.evaluate((x) => { window.__q.refuse = x.refuse || null; window.__q.raise = x.raise || null; }, set);
    await page.click(f + ' button[type="submit"]');
    await page.waitForFunction((fn2, n, f2) => window.__args.filter((x) => x[0] === fn2).length > n
      && document.querySelector(f2).getAttribute('aria-busy') === 'false', { timeout: 10000 }, fn, n0, f);
    return say(f);
  };
  /* AQ16 ホテルの「追加」── 理由ごとに */
  await page.click('#adm-b-a');
  await page.click('#adm-a input[name="adm-kind"][value="hotel"]');
  await page.waitForFunction((h) => document.querySelectorAll(h + ' select[data-k="airline"] option').length > 1, { timeout: 10000 }, H);
  await page.select(H + ' select[data-k="airline"]', 'jal');
  await page.type(H + ' input[data-k="iata"]', 'zzq');
  await page.type(H + ' input[data-k="name"]', '断られるホテル');
  const badAdd = [];
  for (const s of STATUS.add) {
    const t = await send(H, 'pv_stay_add', { refuse: { pv_stay_add: s } });
    const want = EN ? (s === 'exists' ? EN_SAY.exists : EN_FAIL) : (has(CS.add, s) ? CS.add[s] : CS.fail);
    if (t !== want || codeIn(t)) badAdd.push([s, t]);
  }
  const keptH = await page.evaluate((h) => document.querySelector(h + ' input[data-k="name"]').value, H);
  ok(badAdd.length === 0 && keptH === '断られるホテル',
     `AQ16 ホテルの「追加」が断られたとき（${STATUS.add.length}の理由）、出る字は${EN ? '「The same name is already registered.」か「Something went wrong. Please try again.」' : ' career-stay.js の SAY_ADD（無ければ SAY_FAIL）'}と同じ・status の名前は出ない・打った字は残る`,
     JSON.stringify(badAdd));
  /* AQ16 街の「追加」── forbidden と、検品の日本語の文 */
  await page.evaluate(() => { window.__q.refuse = null; });
  await page.click('#adm-a input[name="adm-kind"][value="town"]');
  await page.waitForSelector(TW);
  await page.select(TW + ' select[data-k="scope"]', '0');
  await page.type(TW + ' input[data-k="name"]', '断られる街');
  const badTown = [];
  for (const s of STATUS.town) {
    const t = await send(TW, 'pv_town_admin_add', { refuse: { pv_town_admin_add: s } });
    if (t !== wantMod(s) || codeIn(t)) badTown.push([s, t]);
  }
  const tMsg = await send(TW, 'pv_town_admin_add', { raise: { pv_town_admin_add: TOWN_MSG } });
  if (tMsg !== (EN ? EN_FAIL : TOWN_MSG) || codeIn(tMsg)) badTown.push(['raise', tMsg]);
  ok(badTown.length === 0, `AQ16 街の「追加」が断られたとき（${STATUS.town.join('・')}・検品の文）、出る字は決めた一言${EN ? '（検品の文は英語がまだ無いので FAIL）' : '（検品の文はサーバーの日本語のまま）'}・status の名前は出ない`, JSON.stringify(badTown));
  await page.evaluate(() => { window.__q.refuse = null; window.__q.raise = null; });
  /* AQ16 承認 ── 街の名前の行・ステイ先の場所の行。理由ごとに、その行の一言（読み直したあとの同じ行） */
  await page.click('#adm-b-q');
  const modOne = async (row, fn, s) => {
    await page.evaluate((r) => { const li = document.querySelector(r); if (li) li.setAttribute('data-test-old', '1'); }, row);
    const n0 = (await callsOf(page, fn)).length;
    await page.evaluate((f, st) => { window.__q.refuse = { [f]: st }; }, fn, s);
    await page.click(row + ' [data-act="ok"]');
    await page.waitForFunction((r, f, n) => {
      const li = document.querySelector(r), p = li && li.querySelector('[data-adm="say"]');
      return window.__args.filter((x) => x[0] === f).length > n && li && !li.hasAttribute('data-test-old') && p && !p.hidden;
    }, { timeout: 10000 }, row, fn, n0);
    return page.evaluate((r) => document.querySelector(r + ' [data-adm="say"]').textContent, row);
  };
  const badMod = [];
  for (const s of STATUS.tmod) { const t = await modOne('#adm-q li[data-adm="town"][data-id="11"]', 'pv_town_moderate', s); if (t !== wantMod(s) || codeIn(t)) badMod.push(['town', s, t]); }
  for (const s of STATUS.smod) { const t = await modOne('#adm-q li[data-adm="place"]', 'pv_stay_moderate', s); if (t !== wantMod(s) || codeIn(t)) badMod.push(['place', s, t]); }
  await page.evaluate(() => { window.__q.refuse = null; });
  ok(badMod.length === 0, `AQ16 「承認」が断られたとき（街 ${STATUS.tmod.length}・ステイ先 ${STATUS.smod.length} の理由）、行に出る字は${EN ? '管理ページの英語の断り（無ければ FAIL）' : ' career-stay.js の SAY_MOD（無ければ SAY_FAIL）'}と同じ・status の名前は出ない`, JSON.stringify(badMod));
}

/* ── 「追加」に打った字（WP-towns-13p・G4）── 給与以外の入力と同じ決まり（WP-keep-1）──
   読み直し・戻る・面を開き直す → 同じ字／自動のログアウト → 残り、同じ人が戻ると同じ字／30分を過ぎたら消える／
   このページの「ログアウト」→ このタブに1つも残らない／別の人 → 戻さずに消す。どれも条件で待つ（時間では待たない） */
const OTHER = '00000000-0000-4000-8000-00000000b002';
async function draftChecks(page, lang, url) {
  const EN = lang === 'en';
  const TF = '#adm-a form[data-adm="add-town"]', HF = '#adm-a form[data-adm="add-hotel"]';
  const ready = () => page.waitForFunction(() => document.getElementById('adm-n').getAttribute('data-state') === 'ok', { timeout: 10000 });
  const reload = async () => { await page.reload({ waitUntil: 'networkidle0' }); };
  /* 追加の面を開いて、2つの面がそろう（会社の欄が並ぶ）まで待つ */
  const openAdd = async () => {
    await ready();
    if (await page.$eval('#adm-a', (e) => e.hidden)) await page.click('#adm-b-a');
    await page.waitForFunction((t) => !!document.querySelector(t), { timeout: 10000 }, TF);
    if (!(await page.$(HF))) {
      const k = await page.$eval('#adm-a input[name="adm-kind"]:checked', (e) => e.value);
      await page.click('#adm-a input[name="adm-kind"][value="hotel"]');
      await page.waitForFunction((h) => !!document.querySelector(h), { timeout: 10000 }, HF);
      if (k === 'town') await page.click('#adm-a input[name="adm-kind"][value="town"]');
    }
    await page.waitForFunction((h) => document.querySelectorAll(h + ' [data-k="airline"] option').length > 1, { timeout: 10000 }, HF);
  };
  const vals = () => page.evaluate((t, h) => {
    const v = (s) => { const e = document.querySelector(s); return e ? e.value : null; };
    return { kind: (document.querySelector('#adm-a input[name="adm-kind"]:checked') || {}).value || null,
      scope: v(t + ' [data-k="scope"]'), town: v(t + ' [data-k="name"]'), air: v(h + ' [data-k="airline"]'), iata: v(h + ' [data-k="iata"]'),
      name: v(h + ' [data-k="name"]'), addr: v(h + ' [data-k="address"]'), map: v(h + ' [data-k="maps_url"]'), note: v(h + ' [data-k="note"]') };
  }, TF, HF);
  const stored = () => page.evaluate(() => { try { return Object.keys(sessionStorage).filter((k) => /^pv_admin_draft:/.test(k)).sort().map((k) => [k, sessionStorage.getItem(k)]); } catch (e) { return null; } });
  const tab = (k, v) => page.evaluate((a, b) => { if (b === null) sessionStorage.removeItem(a); else sessionStorage.setItem(a, b); }, k, v);
  const W = { scope: '0', town: '勝どき下書き', air: 'jal', iata: 'HNL', name: 'ホテル下書き', addr: '住所下書き', map: '', note: 'メモ下書き' };
  const same = (v) => Object.keys(W).every((k) => v[k] === W[k]);
  const empty = (v) => ['town', 'iata', 'name', 'addr', 'map', 'note'].every((k) => !v[k]) && !v.scope && !v.air;
  const typeAll = async () => {
    await openAdd();
    await page.click('#adm-a input[name="adm-kind"][value="town"]');
    await page.select(TF + ' [data-k="scope"]', W.scope);
    await page.type(TF + ' [data-k="name"]', W.town);
    await page.click('#adm-a input[name="adm-kind"][value="hotel"]');
    await page.select(HF + ' [data-k="airline"]', W.air);
    await page.type(HF + ' [data-k="iata"]', W.iata);
    await page.type(HF + ' [data-k="name"]', W.name);
    await page.type(HF + ' [data-k="address"]', W.addr);
    await page.type(HF + ' [data-k="note"]', W.note);
  };

  /* KD1 打つと、このタブに2つ（街・ホテル）。印は会員の id の指紋だけ（id そのものは置かない） */
  await typeAll();
  const s1 = await stored();
  const recs = (s1 || []).map(([, j]) => { try { return JSON.parse(j); } catch (e) { return null; } });
  ok(!!s1 && JSON.stringify(s1.map(([k]) => k)) === '["pv_admin_draft:hotel","pv_admin_draft:town"]'
     && recs.every((o) => o && o.v === 1 && /^m:[0-9a-f]+$/.test(o.by) && typeof o.at === 'number') && recs[0].by === recs[1].by
     && s1.every(([, j]) => !j.includes(UID) && !j.includes('@')),
     'KD1 「追加」に打った字は、このタブに街とホテルの2つだけ置く（打った人の印は指紋・id もメールも置かない）', JSON.stringify(s1));

  /* KD2 読み直す → 同じ字・最後に打っていた方（ホテル）の面で開く */
  await reload(); await openAdd();
  const v2 = await vals();
  ok(same(v2) && v2.kind === 'hotel', 'KD2 読み直しても、街とホテルに打った字はそのまま（最後に打っていたホテルの面で開く）', JSON.stringify(v2));

  /* KD3 ほかのページへ移って「戻る」→ 同じ字 */
  await page.goto('about:blank');
  await page.goBack({ waitUntil: 'networkidle0' });
  await openAdd();
  const v3 = await vals();
  ok(same(v3), 'KD3 ほかのページへ移って「戻る」でも、打った字はそのまま', JSON.stringify(v3));

  /* KD4 面を閉じて開き直す → 同じ字 */
  await page.click('#adm-b-a');
  const closed = await page.$eval('#adm-a', (e) => e.hidden);
  await page.click('#adm-b-a');
  const v4 = await vals();
  ok(closed && same(v4), 'KD4 「追加」を閉じて開き直しても、打った字はそのまま', JSON.stringify(v4));

  /* KD5 ログインが知らせなく切れた（自動のログアウト）→ 置いたまま → 同じ人が戻ると同じ字 */
  await tab('pv-test-nosession', '1');
  await reload();
  const gate = await page.evaluate(() => getComputedStyle(document.getElementById('dashboard')).display === 'none' && getComputedStyle(document.getElementById('gate')).display !== 'none');
  const s5 = await stored();
  await tab('pv-test-nosession', null);
  await reload(); await openAdd();
  const v5 = await vals();
  ok(gate && JSON.stringify(s5) === JSON.stringify(s1) && same(v5),
     'KD5 ログインが知らせなく切れても打った字は消えない（画面は入口だけ）・同じ人がまた入ると、そのまま戻る', JSON.stringify({ gate, kept: JSON.stringify(s5) === JSON.stringify(s1), v5 }));

  /* KD6 最後に打ってから29分 → 戻る／31分 → 戻らず、このタブからも消える */
  const age = (min) => page.evaluate((m) => {
    for (const k of Object.keys(sessionStorage)) if (/^pv_admin_draft:/.test(k)) {
      const o = JSON.parse(sessionStorage.getItem(k)); o.at = Date.now() - m * 60 * 1000; sessionStorage.setItem(k, JSON.stringify(o));
    }
  }, min);
  await age(29); await reload(); await openAdd();
  const v29 = await vals();
  await age(31); await reload(); await openAdd();
  const v31 = await vals(), s31 = await stored();
  ok(same(v29) && empty(v31) && JSON.stringify(s31) === '[]',
     'KD6 最後に打ってから29分なら戻り、31分を過ぎたら戻らない（このタブからも消える）', JSON.stringify({ v29, v31, s31 }));

  /* KD7 別の人がこのタブでログインしている → 前の人の字は出さず、このタブからも消す */
  await typeAll();
  const s7a = await stored();
  await tab('pv-test-uid', OTHER);
  await reload(); await openAdd();
  const v7 = await vals(), s7 = await stored();
  await tab('pv-test-uid', null);
  ok(s7a.length === 2 && empty(v7) && JSON.stringify(s7) === '[]',
     'KD7 別の人がこのタブで入ると、前の人が打った字は出ない・このタブからも消える', JSON.stringify({ before: s7a.length, v7, s7 }));

  /* KD8 このページの「ログアウト」→ このタブに1つも残らない・同じ人が入り直しても戻らない */
  await reload(); await typeAll();
  const s8a = await stored();
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }), page.click('#tab-users .btn-logout-a')]);
  const s8 = await stored();
  await page.goto(url, { waitUntil: 'networkidle0' });
  await openAdd();
  const v8 = await vals();
  ok(s8a.length === 2 && JSON.stringify(s8) === '[]' && empty(v8),
     'KD8 このページの「ログアウト」を押すと、打った字はこのタブから全部消える（同じ人が入り直しても戻らない）', JSON.stringify({ before: s8a.length, s8, v8 }));
}

/* ── オーナーだけの部分（WP-towns-13v）──────────────────────────────────────────
   ★オーナーでない運営には、申請してきた人・会員一覧の見出しも行も数もボタンも出ない（サーバーが forbidden を返す）。
   ★オーナーには2つの一覧が返ってきた順のまま字として出る。「verified」「見送り」は申請の画像の面の中にだけ。
     画像は「画像を見る」を押したときに1回だけ読み、閉じたら画像は DOM にも保存領域にも残らない。
     送るのは {id, state, via} だけ。決めたら2つの一覧を読み直す。数（承認の横）には入れない。 */
const OWN_WORDS = { ja: ['申請してきた人', '会員一覧', '画像を見る', '申請あり', '取り消す', '見送り'],
                    en: ['Applicants', 'Members', 'View image', 'Applied', 'Revoke', 'Decline'] };
async function notOwnerChecks(page, lang) {
  const EN = lang === 'en';
  await page.waitForFunction(() => document.getElementById('adm-n').getAttribute('data-state') === 'ok', { timeout: 10000 });
  const v = await page.evaluate((W) => {
    const q = document.getElementById('adm-q'), all = document.body.textContent;
    return { owner: q.querySelectorAll('[data-adm-owner], li[data-adm="app"], li[data-adm="member"], .adm-sheet, img').length,
             acts: q.querySelectorAll('[data-act="view"], [data-act="verify"], [data-act="decline"], [data-act="revoke"]').length,
             heads: [...q.querySelectorAll('h2.adm-h')].map((h) => h.firstChild.textContent),
             words: W.filter((w) => all.includes(w)), verified: /verified/.test(all),
             asked: window.__rpc.filter((n) => n === 'pv_stay_applicants' || n === 'pv_stay_members').length,
             pressed: window.__rpc.filter((n) => n === 'pv_stay_applicant_image' || n === 'pv_stay_viewer_verify').length,
             n: document.getElementById('adm-n').textContent };
  }, OWN_WORDS[lang]);
  ok(v.owner === 0 && v.acts === 0 && JSON.stringify(v.heads) === JSON.stringify(EN ? ['Towns', 'Stays'] : ['住みやすい街', 'ステイ先'])
     && v.words.length === 0 && !v.verified && v.asked === 2 && v.pressed === 0 && v.n === '4',
     '★O0 オーナーでない運営（2つの一覧に forbidden）：申請してきた人・会員一覧の見出しも行も数もボタンも出ない・画像も verified も呼ばない（数は待ち行列の「4」だけ）',
     JSON.stringify(v));
}

const VERIFY_ST = [...new Set(grab(sqlBody('db/stays.sql', 'pv_stay_viewer_verify'), ST_IS))].sort();
async function ownerChecks(page, lang) {
  const EN = lang === 'en';
  const OW = 'eeeeeeee-0000-4000-8000-00000000000';
  const A1 = OW + '1', A2 = OW + '2', M3 = OW + '3', M4 = OW + '4';
  const Q = '#adm-q';
  const appSel = (id) => `${Q} li[data-adm="app"][data-id="${id}"]`, memSel = (id) => `${Q} li[data-adm="member"][data-id="${id}"]`;
  await page.waitForFunction(() => document.querySelector('#adm-q [data-adm-owner="members"]') && document.getElementById('adm-n').getAttribute('data-state') === 'ok', { timeout: 10000 });
  const calls = (n) => page.evaluate((x) => window.__args.filter((a) => a[0] === x).map((a) => a[1]), n);
  const reads = async () => ({ a: (await calls('pv_stay_applicants')).length, m: (await calls('pv_stay_members')).length });
  const info = (sel) => page.evaluate((s) => {
    const li = document.querySelector(s);
    if (!li) return null;
    const v = li.querySelector('.adm-row-v');
    return { v: v && v.firstChild ? v.firstChild.textContent : null, vKids: v ? v.querySelectorAll(':scope > :not(.adm-tag)').length : -1,
             tags: [...li.querySelectorAll('.adm-row-v .adm-tag')].map((t) => t.textContent),
             k: [...li.querySelectorAll(':scope > .adm-row-k')].map((e) => e.textContent),
             btns: [...li.querySelectorAll('button')].map((b) => [b.getAttribute('data-act'), b.textContent]) };
  }, sel);
  const W = EN ? { view: 'View image', verified: 'verified', decline: 'Decline', revoke: 'Revoke', close: 'Close', applied: 'Applied',
                   cap: 'Sample Air · Captain', fo: 'Other Air · First Officer', cadet: 'Trainee', age0: 'Within 1 month', none: 'Nothing is waiting', noUsers: 'No users',
                   err: 'Could not loadRefresh', photoErr: 'The photo cannot be shown' }
               : { view: '画像を見る', verified: 'verified', decline: '見送り', revoke: '取り消す', close: '閉じる', applied: '申請あり',
                   cap: 'Sample Air · 機長', fo: 'Other Air · 副操縦士', cadet: '訓練生', age0: '1ヶ月以内', none: '確認待ちはありません', noUsers: 'ユーザーなし',
                   err: '読み込めませんでした更新', photoErr: '写真を表示できません' };

  /* O1 2つの一覧は返ってきた順のまま・字として出る。申請の行のボタンは「画像を見る」だけ。数には入らない */
  const o1 = await page.evaluate(() => {
    const q = document.getElementById('adm-q');
    return { heads: [...q.querySelectorAll('h2.adm-h')].map((h) => h.firstChild.textContent),
             apps: [...q.querySelectorAll('li[data-adm="app"]')].map((li) => li.getAttribute('data-id')),
             members: [...q.querySelectorAll('li[data-adm="member"]')].map((li) => li.getAttribute('data-id')),
             born: [...q.querySelectorAll('*')].some((e) => [...e.attributes].some((a) => /^on/i.test(a.name))),
             imgs: q.querySelectorAll('img').length, hit: !!window.__pvHit, n: document.getElementById('adm-n').textContent,
             open: !q.hidden };
  });
  const [a1, a2, m1, m3, m4] = [await info(appSel(A1)), await info(appSel(A2)), await info(memSel(A1)), await info(memSel(M3)), await info(memSel(M4))];
  const HEADS = EN ? ['Towns', 'Stays', 'Applicants', 'Members'] : ['住みやすい街', 'ステイ先', '申請してきた人', '会員一覧'];
  ok(JSON.stringify(o1.heads) === JSON.stringify(HEADS) && JSON.stringify(o1.apps) === JSON.stringify([A1, A2])
     && JSON.stringify(o1.members) === JSON.stringify([A2, A1, M3, M4]) && o1.open && o1.n === '4',
     `★O1 オーナーには「${HEADS[2]}」「${HEADS[3]}」が待ち行列の下に出る・行は返ってきた順のまま・数は待ち行列の「4」のまま（申請も会員も数えない）`, JSON.stringify(o1));
  ok(!o1.born && !o1.hit && o1.imgs === 0 && a1 && a1.v === HOSTILE && a1.vKids === 0 && m1 && m1.v === HOSTILE
     && JSON.stringify(a1.k) === JSON.stringify([QUOTED + '@example.com', W.cap, W.age0]) && a2 && a2.v === 'app-second@example.com' && JSON.stringify(a2.k) === '[]',
     '★O1 名前のタグ・メールの引用符は字として出るだけ（絵も属性も生えない）・メール・会社と職位・申請した時期（段4は字を出さない）', JSON.stringify({ a1, a2 }));
  ok(JSON.stringify(a1.btns) === JSON.stringify([['view', W.view]]) && JSON.stringify(a2.btns) === JSON.stringify([['view', W.view]])
     && JSON.stringify(m1.tags) === JSON.stringify([W.applied]) && JSON.stringify(m1.btns) === JSON.stringify([['verify', W.verified]])
     && JSON.stringify(m3.tags) === JSON.stringify([W.verified]) && JSON.stringify(m3.btns) === JSON.stringify([['revoke', W.revoke]]) && m3.k.includes(W.fo)
     && JSON.stringify(m4.tags) === '[]' && JSON.stringify(m4.btns) === JSON.stringify([['verify', W.verified]]) && m4.k.includes(W.cadet),
     `★O2 申請の行のボタンは「${W.view}」だけ（「${W.verified}」「${W.decline}」は画像の面の中だけ）・会員一覧は「${W.applied}」の印・verified の人は印と「${W.revoke}」・ほかは「${W.verified}」`,
     JSON.stringify({ a1: a1.btns, m1, m3, m4 }));
  ok((await calls('pv_stay_applicant_image')).length === 0 && (await calls('pv_stay_viewer_verify')).length === 0,
     '★O7 開いた時点では、申請の画像も verified も呼ばない（押したときだけ）');

  /* O2・O3 「画像を見る」→ 画像は1回だけ読み、その行の下の面にだけ。面の中に「verified」「見送り」「閉じる」 */
  const openSheet = async (id) => {
    await page.click(appSel(id) + ' [data-act="view"]');
    /* 決めるボタンが出た（画像が描けた）か、読めないときの一言が出た（読み込み中の「…」ではない）まで待つ */
    await page.waitForFunction((s) => {
      const b = document.querySelector(s + ' .adm-sheet');
      if (!b) return false;
      if (b.querySelector('[data-act="verify"]')) return true;
      const say = b.querySelector('.adm-say');
      return !b.querySelector('img') && !!say && !/…$/.test(say.textContent) && !!b.querySelector('[data-act="close"]');
    }, { timeout: 10000 }, appSel(id));
  };
  await openSheet(A1);
  const s2 = await page.evaluate((s) => {
    const li = document.querySelector(s), box = li.querySelector('.adm-sheet'), img = box && box.querySelector('img');
    const q = document.getElementById('adm-q');
    return { src: img ? img.getAttribute('src') : null, w: img ? img.naturalWidth : 0, link: !!(img && img.closest('a')) || box.querySelectorAll('a').length,
             inRow: !!box && box.parentNode === li, btns: [...box.querySelectorAll('button')].map((b) => [b.getAttribute('data-act'), b.textContent]),
             outside: [...q.querySelectorAll('[data-act="verify"], [data-act="decline"]')].filter((b) => !b.closest('.adm-sheet') && !b.closest('li[data-adm="member"]')).length,
             sheets: q.querySelectorAll('.adm-sheet').length, b64: window.__o.lastB64,
             expanded: li.querySelector('[data-act="view"]').getAttribute('aria-expanded') };
  }, appSel(A1));
  const img2 = await calls('pv_stay_applicant_image');
  ok(img2.length === 1 && canon(img2[0]) === canon({ p: { id: A1 } }) && !!s2.b64 && /\n/.test(s2.b64)
     && s2.src === 'data:image/jpeg;base64,' + s2.b64.replace(/\s+/g, '') && s2.w > 1 && !s2.link && s2.inRow && s2.sheets === 1 && s2.expanded === 'true',
     '★O2 「画像を見る」で申請の画像を {id} で1回だけ読み、その行の下の面にだけ出す（data:image/jpeg;base64・改行を外す・リンクにしない）',
     JSON.stringify({ img2, src: (s2.src || '').slice(0, 40), w: s2.w, link: s2.link, inRow: s2.inRow, sheets: s2.sheets }));
  ok(JSON.stringify(s2.btns) === JSON.stringify([['verify', W.verified], ['decline', W.decline], ['close', W.close]]) && s2.outside === 0,
     `★O2 「${W.verified}」「${W.decline}」は画像の面の中にだけある（面の中は「${W.verified}」「${W.decline}」「${W.close}」）`, JSON.stringify(s2.btns));
  /* 閉じたら画像はどこにも残らない（DOM・保存領域）。フォーカスは「画像を見る」へ */
  const gone = () => page.evaluate((s, b64) => {
    const frag = String(b64 || '').replace(/\s+/g, '').slice(10, 60);
    const store = (st) => { try { return Object.keys(st).some((k) => String(st.getItem(k)).includes(frag)); } catch (e) { return false; } };
    return { sheets: document.querySelectorAll('#adm-q .adm-sheet').length, imgs: document.querySelectorAll('#adm-q img').length,
             html: document.documentElement.outerHTML.includes('data:image/jpeg') || document.documentElement.outerHTML.includes(frag),
             store: store(localStorage) || store(sessionStorage), focus: document.activeElement && document.activeElement.getAttribute('data-act'),
             focusRow: document.activeElement && document.activeElement.closest('li') ? document.activeElement.closest('li').getAttribute('data-id') : null,
             expanded: (document.querySelector(s + ' [data-act="view"]') || {}).getAttribute && document.querySelector(s + ' [data-act="view"]').getAttribute('aria-expanded'),
             open: !document.getElementById('adm-q').hidden };
  }, appSel(A1), s2.b64);
  await page.click(appSel(A1) + ' .adm-sheet [data-act="close"]');
  /* 待つのは面が消えるまで（消えないまま残ったら、下の1行が赤くなる ── ここで止めない） */
  await page.waitForFunction(() => !document.querySelector('#adm-q .adm-sheet'), { timeout: 10000 }).catch(() => {});
  const g3 = await gone();
  ok(g3.sheets === 0 && g3.imgs === 0 && !g3.html && !g3.store && g3.focus === 'view' && g3.focusRow === A1 && g3.expanded === 'false' && g3.open,
     `★O3 「${W.close}」で面ごと消える：画像は DOM にも data: の字にも保存領域にも残らない・フォーカスは「${W.view}」へ戻る`, JSON.stringify(g3));
  /* 承認の面を閉じても、画像は残らない */
  await openSheet(A1);
  await page.click('#adm-b-q');
  const g3b = await gone();
  await page.click('#adm-b-q');
  const g3c = await gone();
  ok(g3b.sheets === 0 && g3b.imgs === 0 && !g3b.html && !g3b.open && g3c.sheets === 0 && g3c.open,
     '★O3 画像を開いたまま承認の面を閉じても、画像は消える（開き直しても面は閉じたまま）', JSON.stringify({ g3b, g3c }));
  /* O10 キーボード：「画像を見る」で Enter → 面に入る → Tab で verified → Escape で面だけ閉じ、「画像を見る」に戻る */
  await page.focus(appSel(A1) + ' [data-act="view"]');
  await page.keyboard.press('Enter');
  await page.waitForFunction((s) => document.querySelector(s + ' .adm-sheet [data-act="verify"]'), { timeout: 10000 }, appSel(A1));
  const k1 = await page.evaluate(() => !!(document.activeElement && document.activeElement.closest('.adm-sheet')));
  await page.keyboard.press('Tab');
  const k2 = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-act'));
  await page.keyboard.press('Escape');
  const k3 = await gone();
  ok(k1 && k2 === 'verify' && k3.sheets === 0 && k3.imgs === 0 && k3.focus === 'view' && k3.open,
     'O10 キーボード：Enter で画像の面に入り・Tab で「verified」・Escape で画像の面だけが閉じて「画像を見る」へ戻る（承認の面は開いたまま）', JSON.stringify({ k1, k2, k3 }));

  /* O4 画像の面の「verified」→ {id, state:'approved', via:'applicant'} だけ・2つの一覧を読み直す・申請の行は消え、会員一覧で verified */
  const r0 = await reads();
  await openSheet(A1);
  await page.click(appSel(A1) + ' .adm-sheet [data-act="verify"]');
  await page.waitForFunction((s) => !document.querySelector(s), { timeout: 10000 }, appSel(A1));
  await page.waitForFunction((s) => { const li = document.querySelector(s); return li && li.querySelector('[data-act="revoke"]'); }, { timeout: 10000 }, memSel(A1));
  const v4 = await calls('pv_stay_viewer_verify'), r4 = await reads(), m1b = await info(memSel(A1)), g4 = await gone();
  ok(v4.length === 1 && canon(v4[0]) === canon({ p: { id: A1, state: 'approved', via: 'applicant' } }) && r4.a === r0.a + 1 && r4.m === r0.m + 1,
     '★O4 画像の面の「verified」は {id, state:approved, via:applicant} だけを1回送り、2つの一覧を1回ずつ読み直す', JSON.stringify({ v4, r0, r4 }));
  ok(m1b && JSON.stringify(m1b.tags) === JSON.stringify([W.verified]) && JSON.stringify(m1b.btns) === JSON.stringify([['revoke', W.revoke]])
     && g4.imgs === 0 && !g4.html && g4.focusRow === A1,
     `O4 決めたあと：申請の行は消え、会員一覧のその人は「${W.verified}」の印と「${W.revoke}」・画像は残らない・フォーカスはその人の行`, JSON.stringify({ m1b, g4 }));

  /* O5 画像の面の「見送り」→ {id, state:'denied', via:'applicant'} */
  await openSheet(A2);
  await page.click(appSel(A2) + ' .adm-sheet [data-act="decline"]');
  await page.waitForFunction((s) => !document.querySelector(s), { timeout: 10000 }, appSel(A2));
  const v5 = await calls('pv_stay_viewer_verify');
  const none5 = await page.evaluate(() => [...document.querySelectorAll('#adm-q [data-adm="none"]')].map((p) => [p.getAttribute('data-adm-part'), p.textContent]));
  ok(v5.length === 2 && canon(v5[1]) === canon({ p: { id: A2, state: 'denied', via: 'applicant' } })
     && JSON.stringify(none5.filter((x) => x[0] === 'apps')) === JSON.stringify([['apps', W.none]]),
     `★O5 画像の面の「${W.decline}」は {id, state:denied, via:applicant} だけ・申請が無くなると「${W.none}」`, JSON.stringify({ v5: v5[1], none5 }));

  /* O6 会員一覧：「verified」→ {id, state:'approved', via:'member'}／「取り消す」→ {id, state:'revoked', via:'member'} */
  await page.click(memSel(M4) + ' [data-act="verify"]');
  await page.waitForFunction((s) => { const li = document.querySelector(s); return li && li.querySelector('[data-act="revoke"]'); }, { timeout: 10000 }, memSel(M4));
  await page.click(memSel(M3) + ' [data-act="revoke"]');
  await page.waitForFunction((s) => { const li = document.querySelector(s); return li && li.querySelector('[data-act="verify"]'); }, { timeout: 10000 }, memSel(M3));
  const v6 = await calls('pv_stay_viewer_verify');
  ok(v6.length === 4 && canon(v6[2]) === canon({ p: { id: M4, state: 'approved', via: 'member' } }) && canon(v6[3]) === canon({ p: { id: M3, state: 'revoked', via: 'member' } }),
     `★O6 会員一覧の「${W.verified}」は {id, state:approved, via:member}・「${W.revoke}」は {id, state:revoked, via:member} だけ`, JSON.stringify(v6.slice(2)));

  /* O8 断られたとき（pv_stay_viewer_verify が返しうる理由ごと）── サイトに在る一言（無ければ FAIL）。status の名前は出ない */
  const NF = EN ? EN_SAY.not_found : CS.mod.not_found, FL = EN ? EN_FAIL : CS.fail;
  const bad8 = [];
  for (const s of VERIFY_ST) {
    await page.evaluate((r) => { const li = document.querySelector(r); if (li) li.setAttribute('data-test-old', '1'); }, memSel(M3));
    await page.evaluate((st) => { window.__q.refuse = { pv_stay_viewer_verify: st }; }, s);
    await page.click(memSel(M3) + ' [data-act="verify"]');
    await page.waitForFunction((r) => { const li = document.querySelector(r), p = li && li.querySelector('[data-adm="say"]'); return li && !li.hasAttribute('data-test-old') && p && !p.hidden; }, { timeout: 10000 }, memSel(M3));
    const t = await page.evaluate((r) => document.querySelector(r + ' [data-adm="say"]').textContent, memSel(M3));
    const want = s === 'not_found' || s === 'no_image' ? NF : FL;
    const codeIn = /[a-z]+_[a-z]+/.test(t) || VERIFY_ST.some((x) => t.trim() === x || t.includes('（' + x) || t.includes('(' + x)) || (!EN && /[a-z_]{3,}/.test(t));
    if (t !== want || codeIn) bad8.push([s, t]);
  }
  await page.evaluate(() => { window.__q.refuse = null; });
  ok(VERIFY_ST.length >= 5 && ['forbidden', 'self', 'not_found', 'bad_state', 'no_image'].every((s) => VERIFY_ST.includes(s)) && bad8.length === 0,
     `★O8 verified ・取り消すが断られたとき（${VERIFY_ST.join('・')}）、出る字は「もう無い」だけサイトの一言（${NF}）・ほかは FAIL・status の名前は出ない`, JSON.stringify({ VERIFY_ST, bad8 }));

  /* O11 画像が読めない申請 ── 「写真を表示できません」と「閉じる」だけ（決めるボタンは出ない） */
  await page.evaluate((id) => {
    window.__o.apps = [{ id: id + 'bad', email: 'gone@example.com', name: 'Gone Image', company: null, position: null, size: 1, asked: 1 }];
    window.__o.members.push({ id: id + 'bad', email: 'gone@example.com', name: 'Gone Image', company: null, position: null, state: 'none', applied: true });
    return window.PVAdminQueue.reload();
  }, OW);
  await page.waitForFunction((s) => document.querySelector(s), { timeout: 10000 }, appSel(OW + 'bad'));
  await openSheet(OW + 'bad');
  const s11 = await page.evaluate((s) => { const b = document.querySelector(s + ' .adm-sheet');
    return { say: (b.querySelector('.adm-say') || {}).textContent || null, imgs: b.querySelectorAll('img').length, btns: [...b.querySelectorAll('button')].map((x) => x.getAttribute('data-act')) }; }, appSel(OW + 'bad'));
  ok(s11.say === W.photoErr && s11.imgs === 0 && JSON.stringify(s11.btns) === '["close"]',
     `★O11 画像が読めない申請は「${W.photoErr}」と「${W.close}」だけ（「${W.verified}」「${W.decline}」は出ない）`, JSON.stringify(s11));
  await page.click(appSel(OW + 'bad') + ' .adm-sheet [data-act="close"]');

  /* O9 一度読めたオーナーの一覧があとで読めない → 2つの見出しの横に「読み込めませんでした」「更新」（行は出さない）。更新で戻る */
  await page.evaluate(() => { window.__o.fail = true; return window.PVAdminQueue.reload(); });
  const f9 = await page.evaluate(() => [...document.querySelectorAll('#adm-q h2[data-adm-owner]')].map((h) => [h.getAttribute('data-adm-owner'), (h.querySelector('.adm-part') || {}).textContent || null])
    .concat([['rows', document.querySelectorAll('#adm-q li[data-adm="app"], #adm-q li[data-adm="member"]').length]]));
  await page.evaluate(() => { window.__o.fail = false; });
  await page.click('#adm-q h2[data-adm-owner="apps"] [data-act="reload"]');
  await page.waitForFunction(() => document.querySelectorAll('#adm-q li[data-adm="member"]').length > 0, { timeout: 10000 });
  ok(JSON.stringify(f9) === JSON.stringify([['apps', W.err], ['members', W.err], ['rows', 0]]),
     `O9 一度読めたあとで読めないときは、2つの見出しの横に「${W.err.replace(EN ? 'Refresh' : '更新', '')}」と「${EN ? 'Refresh' : '更新'}」（行は出さない）・押すと戻る`, JSON.stringify(f9));

  /* O8b 空のとき ── 申請してきた人の下に「確認待ちはありません」・会員一覧の下に「ユーザーなし」 */
  await page.evaluate(() => { window.__o.apps = []; window.__o.members = []; return window.PVAdminQueue.reload(); });
  const e8 = await page.evaluate(() => [...document.querySelectorAll('#adm-q [data-adm="none"]')].filter((p) => /apps|members/.test(p.getAttribute('data-adm-part')))
    .map((p) => [p.getAttribute('data-adm-part'), p.textContent, (p.previousElementSibling || {}).getAttribute && p.previousElementSibling.getAttribute('data-adm-list')]));
  ok(JSON.stringify(e8) === JSON.stringify([['apps', W.none, 'apps'], ['members', W.noUsers, 'members']]),
     `O8b 空のとき：申請してきた人の下に「${W.none}」・会員一覧の下に「${W.noUsers}」`, JSON.stringify(e8));
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
      /* オーナーだけの2つの一覧（WP-towns-13v）。並びはわざとメールの順と違う（返ってきた順のまま出すことを見る）。
         1人目は名前が HOSTILE・メールが引用符入り。申請の画像は、呼ばれたときに作る「FIXTURE」の字の絵（本物の画像は使わない） */
      const OW = 'eeeeeeee-0000-4000-8000-00000000000';
      window.__o = {
        apps: [{ id: OW + '1', email: quoted + '@example.com', name: hostile, company: 'Sample Air', position: 'captain', size: 4000, asked: 0 },
               { id: OW + '2', email: 'app-second@example.com', name: null, company: null, position: null, size: 3000, asked: 4 }],
        members: [{ id: OW + '2', email: 'app-second@example.com', name: null, company: null, position: null, state: 'none', applied: true },
                  { id: OW + '1', email: quoted + '@example.com', name: hostile, company: 'Sample Air', position: 'captain', state: 'none', applied: true },
                  { id: OW + '3', email: 'approved@example.com', name: 'Approved Pilot', company: 'Other Air', position: 'fo', state: 'approved', applied: false },
                  { id: OW + '4', email: 'plain@example.com', name: 'Plain Member', company: null, position: 'cadet', state: 'revoked', applied: false }],
        fail: false, lastB64: null
      };
      /* 「FIXTURE」と書いた絵を JPEG にし、サーバー（encode(…, 'base64')）と同じく76字ごとに改行を入れて返す */
      const fixture = () => {
        const c = document.createElement('canvas');
        c.width = 320; c.height = 120;
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, 320, 120);
        g.fillStyle = '#000000'; g.font = 'bold 40px sans-serif'; g.fillText('FIXTURE', 60, 75);
        const b = c.toDataURL('image/jpeg', 0.8).split(',')[1];
        return b.replace(/.{1,76}/g, (s) => s + '\n');
      };
      const FORBID = { ok: false, status: 'forbidden' };
      const QUEUES = ['pv_town_queue', 'pv_stay_queue'];
      /* 1×1 の PNG（写真の作り物） */
      const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      /* 8. の場面だけが使う2つの切り替え（このタブの保存領域）：別の人として入る・ログインが知らせなく切れた */
      const tab = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
      const SESSION = cfg.session && tab('pv-test-nosession') !== '1'
        ? { user: { id: tab('pv-test-uid') || uid, email: 'pilot@example.com' } } : null;
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
        pv_stay_add: (a) => ({ ok: true, item: Object.assign({ id: 'dddddddd-0000-4000-8000-000000000001', state: 'public' }, (a && a.p) || {}) }),
        /* 運営の「追加」で足せる空港（会社の符号 → 3字）。この作り物では2社だけ */
        pv_stay_airports: () => ({ ok: true, airports: { jal: ['HNL', 'LAX'], ana: ['HNL'] } }),
        /* オーナーだけの4つ（db/stays.sql 10-c と同じ形）。オーナーでない運営には forbidden だけ */
        pv_stay_applicants: () => cfg.owner ? { ok: true, rows: window.__o.apps.slice() } : FORBID,
        pv_stay_members: () => cfg.owner ? { ok: true, rows: window.__o.members.slice() } : FORBID,
        /* id が …bad で終わる申請は、画像がもう無い（{ok:false, status:'none'}） */
        pv_stay_applicant_image: (a) => {
          if (!cfg.owner) return FORBID;
          const id = String(((a && a.p) || {}).id || '');
          if (/bad$/.test(id) || !window.__o.apps.some((x) => x.id === id)) return { ok: false, status: 'none' };
          window.__o.lastB64 = fixture();
          return { ok: true, mime: 'image/jpeg', b64: window.__o.lastB64 };
        },
        /* サーバーと同じ決め方：申請の道は画像があるときだけ・見送りで verified を取り上げない・どの決定でも申請は終わる */
        pv_stay_viewer_verify: (a) => {
          if (!cfg.owner) return FORBID;
          const p = (a && a.p) || {}, o = window.__o, m = o.members.find((x) => x.id === p.id);
          if (!m) return { ok: false, status: 'not_found' };
          const app = o.apps.some((x) => x.id === p.id);
          if (p.via === 'applicant' && !app) return { ok: false, status: 'no_image' };
          let to = p.state;
          if (to === 'denied' && m.state === 'approved') to = 'approved';
          m.state = to; m.applied = false;
          o.apps = o.apps.filter((x) => x.id !== p.id);
          return { ok: true, state: to, discarded: app ? 1 : 0 };
        }
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
          /* 7. の場面：その入口だけ、決めた status で断る（refuse）／日本語の文の例外で止まる（raise） */
          const refuse = window.__q.refuse && window.__q.refuse[n], raise = window.__q.raise && window.__q.raise[n];
          const res = raise ? { data: null, error: { code: '22023', message: raise } }
            : refuse ? { data: { ok: false, status: refuse }, error: null }
            : (cfg.err && isList)
            ? { data: null, error: { message: 'function does not exist' } }
            : (cfg.queue === 'off' && QUEUES.includes(n))
              ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + n }, status: 404 }
              : ((n === 'pv_stay_queue' && window.__q.stayFail) || (window.__o.fail && (n === 'pv_stay_applicants' || n === 'pv_stay_members')))
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
      ok(seen.rpc.join(',') === 'pv_is_admin,admin_list_profiles,admin_list_reviews,pv_town_queue,pv_stay_queue,pv_stay_applicants,pv_stay_members',
         'サーバーの入口だけを使っている（オーナーの2つの一覧も、管理者と分かったあとに読むだけ）', seen.rpc.join(','));
      ok(seen.from.length === 0, '管理者でもテーブルは直接触らない', seen.from.join(','));
      await notOwnerChecks(page, lang).catch((e) => ok(false, 'O0 オーナーでない運営の場面が途中で止まった', String(e && e.message || e).slice(0, 200)));
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
    if (c.key === 'refuse') await refusalChecks(page, lang).catch((e) => ok(false, 'AQ16 断られたときの場面が途中で止まった', String(e && e.message || e).slice(0, 200)));
    if (c.key === 'draft') await draftChecks(page, lang, url).catch((e) => ok(false, 'KD 打った字の場面が途中で止まった', String(e && e.message || e).slice(0, 200)));
    if (c.key === 'owner') {
      await page.waitForFunction(() => document.querySelector('#adm-q [data-adm-owner="members"]'), { timeout: 10000 }).catch(() => {});
      const rpc0 = await page.evaluate(() => window.__rpc.slice());
      ok(rpc0.join(',') === 'pv_is_admin,admin_list_profiles,admin_list_reviews,pv_town_queue,pv_stay_queue,pv_stay_applicants,pv_stay_members',
         '★O7 オーナーも、開いたときに呼ぶのはこの7つだけ（申請してきた人 → 会員一覧は管理者と分かったあと・画像と verified は押したときだけ）', rpc0.join(','));
      await ownerChecks(page, lang).catch((e) => ok(false, 'O オーナーの場面が途中で止まった', String(e && e.message || e).slice(0, 200)));
    }

    await page.close();
  }
}

await browser.close();
console.log(`\n════ ${pass} 件 通過 / ${fail} 件 失敗 ════`);
process.exitCode = fail ? 1 : 0;
