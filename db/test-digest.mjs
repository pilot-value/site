/* db/weekly-digest.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-digest.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-pay-rows.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles、reviews_v2）。
   ★既定権限を先に全付与してあるからこそ weekly-digest.sql の revoke が意味を持つ。
     無いと「元から権限が無いだけ」を「revoke が効いた」と誤読する。

   ── このファイルが本当に見ている3本 ───────────────────────────
   ★1. 関数が行そのものを返さないこと。
        返るのは件数と社名だけ。金額・職位・機材・口コミ本文は、SQL の時点で
        組み立てられていない＝メール側が何をしても本文に出しようが無い。
        「そういう語が無い」ではなく、**返り値の鍵の集合そのもの**を固定する。

   ★2. 打ち込まれた自由入力の社名が1文字も出ないこと。
        会社は自由入力で、語彙に当たらないものは pv_airline_resolve が 'other' を返す。
        ここを取りこぼすと「ヒミツ航空」がそのまま会員67人の受信箱に届く。

   ★3. 手で流す側（mail-bot/announce-mail.mjs の digestStats）と
        自動で送る側（この SQL）が、同じ週を同じに数えること。
        数え方が2つある状態そのものは避けられない（Edge Function に行を渡さない、
        という設計を取ったため）。せめて**ズレたらここで赤くなる**ようにしてある。
        社名も突き合わせる ── DB の pv_airlines と手元の pv-airlines.json は別物で、
        片方だけ古いと「同じ会社が2つの名前で届く」。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { digestStats, DIGEST_MIN } from '../mail-bot/announce-mail.mjs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? '\n     ' + extra : ''}`); }
};
const one  = async (sql, params) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params) => (await db.query(sql, params)).rows;

// ── 器 ───────────────────────────────────────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  /* ★送る側。weekly-digest.sql が grant する先なので、流す前に居ないといけない
     （本番では Supabase が最初から持っている）。 */
  create role service_role;
  grant usage on schema public, extensions to anon, authenticated, service_role;
  /* ★本番（Supabase）と同じ既定。service_role も入れる。
     入れないと「送る側も呼べない」が正しく見えてしまう。 */
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

  /* ★profiles は本番の列のうち、まとめメールが触るものだけ。
     email_opt_in（希望した人だけに送る）・unsub_token（解除の口）・
     company（勤務先＝自由入力）・country / name（言語の手がかり）。 */
  create table public.profiles (
    id uuid primary key, email text, name text,
    country text, company text,
    email_opt_in boolean not null default false,
    unsub_token  text,
    created_at   timestamptz not null default now(),
    pay_reports_today integer not null default 0
  );

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;

  /* 口コミの表（このファイルが触る列だけの最小形）。
     ★本文の列（body）まで作ってある。「作ってあるのに出てこない」ことを
       見たいため。無い列は、漏れようが無いので証拠にならない。 */
  create table public.reviews_v2 (
    id         uuid primary key default gen_random_uuid(),
    proof_hash text not null,
    airline    text not null,
    "position" text,
    body       text,
    annual_salary            integer,
    base_annual              integer,
    flight_allowance_annual  integer,
    monthly_salary           integer,
    bonus                    integer,
    created_at timestamptz not null default now()
  );
`);

// ── 適用（順番も含めて本番と同じ手順）────────────────────────
const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/pay-reports.sql', 'db/pay-report-pending.sql', 'db/pay-rows.sql',
               'db/weekly-digest.sql'];

console.log('\n▼ SQL の適用');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}

console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f + ' 再適用OK'); }
  catch (e) { ok(false, f + ' 再適用で失敗', e.message); }
}

// ── 道具 ─────────────────────────────────────────────────────
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asUser = async (n, extra = {}) => {
  await db.query(
    `insert into profiles(id,email,name,country,company,email_opt_in,unsub_token)
     values($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
    [uid(n), `p${n}@example.com`, extra.name ?? null, extra.country ?? null,
     extra.company ?? null, extra.opt ?? false, extra.tok ?? `tok-${n}`]);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(n)]);
};
const asAnon = () => db.query(`select set_config('pv.uid', '', false)`);

const YEAR = new Date().getFullYear() - 1;
const BASE = { currency: 'USD', lang: 'en', tax_rate_pct: 0 };

/* 給与を1件出す。★本物の口（submit_pay_report）を通す。
   airline の入り方（語彙に寄るのか自由入力のまま残るのか）まで本番と同じにする。 */
let seat = 1000;
const payFor = async (air, month) => {
  const u = ++seat;
  await asUser(u);
  await db.query(`select submit_pay_report($1::jsonb)`, [JSON.stringify({
    ...BASE, airline: air, position: 'cap', fleet: 'b777',
    period_year: YEAR, period_month: month, gross_monthly: 12000,
  })]);
  await db.query(`update profiles set pay_reports_today = 0`);
  return u;
};

let rv = 0;
const reviewFor = (air, body = '待遇は良いが、ステイ先のホテルが遠い。') =>
  db.query(`insert into reviews_v2(proof_hash, airline, "position", body)
            values($1,$2,'cap',$3)`, [`rv-${++rv}`, air, body]);

// 会社コードは語彙から取る（このテストのために特定の社名を覚えない）
const VOCAB = await rows(
  `select code, name_ja, name_en from pv_airlines where code <> 'other' and active order by code limit 6`);
const [A1, A2, A3] = VOCAB.map((r) => r.code);
// 日本の会社を1つ（⑥で「勤務先から日本の会員と分かる」を見るため）
const JP_AIR = (await one(
  `select code from pv_airlines where region = 'japan' and active order by code limit 1`)).code;

const week = async (since) => (await one(`select pv_digest_week($1::timestamptz) r`, [since])).r;
const since0 = async () => (await one(`select pv_digest_since() r`)).r;

// ════════════════════════════════════════════════════════════
console.log('\n▼ ① 記録の置き場が誰にも開いていない');
{
  const r = await one(`select count(*)::int n from pg_policies
                        where schemaname='public' and tablename='pv_mail_state'`);
  ok(r.n === 0, 'pv_mail_state にポリシーを1つも作っていない（＝ PostgREST から見えない）', `policies=${r.n}`);
}
for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`);
  let err = null;
  try { await db.query(`select count(*) from public.pv_mail_state`); } catch (e) { err = String(e.message || e); }
  ok(!!err, `${role} は pv_mail_state を読めない`, err ? '' : '読めてしまった');
  err = null;
  try { await db.query(`insert into public.pv_mail_state(key) values('x')`); } catch (e) { err = String(e.message || e); }
  ok(!!err, `${role} は pv_mail_state に書けない`, err ? '' : '書けてしまった');
  await db.exec(`reset role`);
}

console.log('\n▼ ② 4つの関数は会員から呼べない（service_role だけ）');
{
  const CALLS = [
    ['pv_digest_since',      `select public.pv_digest_since()`],
    ['pv_digest_week',       `select public.pv_digest_week(now() - interval '7 days')`],
    ['pv_digest_recipients', `select * from public.pv_digest_recipients()`],
    ['pv_digest_mark',       `select public.pv_digest_mark(now())`],
  ];
  for (const role of ['anon', 'authenticated']) {
    for (const [name, sql] of CALLS) {
      await db.exec(`set role ${role}`);
      let err = null;
      try { await db.query(sql); } catch (e) { err = String(e.message || e); }
      await db.exec(`reset role`);
      ok(!!err && /permission denied|denied|許可/i.test(err),
        `${role} は ${name}() を呼べない`, err || '呼べてしまった');
    }
  }
  /* ★「誰も呼べない」だけでは足りない。送る側（service_role）は呼べないといけない。 */
  for (const [name, sql] of CALLS) {
    await db.exec(`set role service_role`);
    let err = null;
    try { await db.query(sql); } catch (e) { err = String(e.message || e); }
    await db.exec(`reset role`);
    ok(!err, `service_role は ${name}() を呼べる`, err || '');
  }
}

console.log('\n▼ ③ 返るのは件数と社名だけ（行そのものは1件も外へ出ない）');
await payFor(A1, 1);
await payFor(A1, 2);
await payFor(A2, 3);
await reviewFor(A1, '機長の年収は2,400万円くらい。B777の路線手当が厚い。');
await reviewFor(A3);
{
  const w = await week(new Date(Date.now() - 7 * 864e5).toISOString());
  const keys = Object.keys(w).sort().join(',');
  ok(keys === 'airlines,pay,reviews,since,total,until',
    '返り値の鍵は since / until / pay / reviews / total / airlines の6つだけ', keys);
  /* ★until は「数えた瞬間」。送り終えたあとの now() で記録すると、
     数えてから送るまでの数十秒に届いた投稿が今週にも来週にも入らない。 */
  const gap = Date.now() - new Date(w.until).getTime();
  ok(gap >= -1000 && gap < 5000, '★until は数えた瞬間（記録はここまで進める）', `${w.until}`);
  const ak = Object.keys(w.airlines[0] || {}).sort().join(',');
  ok(ak === 'en,ja,n,slug', '社ごとの鍵は slug / n / ja / en の4つだけ（金額も職位も無い）', ak);

  const j = JSON.stringify(w);
  ok(!/2,400|2400|12000|144000/.test(j), '★金額が1つも入っていない', j.slice(0, 200));
  ok(!/ホテル|路線手当|B777|b777|cap|機長/.test(j), '★口コミの本文・職位・機材が入っていない', j.slice(0, 200));
  ok(w.pay === 3 && w.reviews === 2 && w.total === 5, '件数が合っている', JSON.stringify(w));
}

console.log('\n▼ ④ 打ち込まれた自由入力の社名は出ない');
{
  /* 語彙に無い社名で1件。pv_airline_resolve が 'other' を返す＝名前を出さない。 */
  await db.query(`insert into reviews_v2(proof_hash, airline, "position")
                  values('rv-other','ヒミツ航空','cap')`);
  await db.query(`insert into reviews_v2(proof_hash, airline, "position")
                  values('rv-zzz','zzz-not-in-table','cap')`);
  const w = await week(new Date(Date.now() - 7 * 864e5).toISOString());
  const j = JSON.stringify(w);
  ok(!j.includes('ヒミツ航空') && !j.includes('zzz-not-in-table'),
    '★語彙に当たらない社名は1文字も返らない', j.slice(0, 300));
  ok(!j.includes('"other"'), "★'other' も社名として返らない", j.slice(0, 300));
  ok(w.reviews === 4 && w.total === 7,
    'ただし件数には入る（「何件届いたか」は嘘にならない）', JSON.stringify({ r: w.reviews, t: w.total }));
}

console.log('\n▼ ⑤ 手で流す側と同じに数える（mail-bot/announce-mail.mjs の digestStats）');
{
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const w = await week(since);
  /* 同じ週を、手元の数え方にも通す。行は airline だけ渡す（あちらが使うのもそれだけ）。 */
  const payRows = await rows(`select airline from pay_reports where created_at > $1::timestamptz`, [since]);
  const revRows = await rows(`select airline from reviews_v2   where created_at > $1::timestamptz`, [since]);
  const st = digestStats({ pay: payRows, reviews: revRows });

  ok(st.pay === w.pay && st.reviews === w.reviews && st.total === w.total,
    '件数が SQL と一致する', `js=${JSON.stringify([st.pay, st.reviews, st.total])} sql=${JSON.stringify([w.pay, w.reviews, w.total])}`);

  /* ★手元の digestStats は「語彙に当たらない社」も持ったまま返し、
     名前が引けないものを落とすのはメールの文面側（digestCopy）。
     なので突き合わせるのは**名前の引けた社だけ**。 */
  const jsNamed  = st.airlines.filter((a) => a.ja || a.en);
  const sqlNamed = w.airlines;
  ok(jsNamed.map((a) => a.slug).join(',') === sqlNamed.map((a) => a.slug).join(','),
    '★名前の出る社と、その並びが SQL と一致する',
    `js=[${jsNamed.map((a) => a.slug)}] sql=[${sqlNamed.map((a) => a.slug)}]`);
  ok(jsNamed.every((a, i) => a.n === sqlNamed[i].n), '社ごとの件数も一致する');

  /* ★社名そのものも突き合わせる。DB の pv_airlines と手元の pv-airlines.json は
     別の生成物で、片方だけ古いと「同じ会社が2つの名前で届く」。 */
  const nameMismatch = jsNamed.filter((a, i) =>
    (a.ja || '') !== (sqlNamed[i].ja || '') || (a.en || '') !== (sqlNamed[i].en || ''));
  ok(nameMismatch.length === 0,
    '★表示名（日本語・英語）も一致する（pv-airlines.json ⇄ pv_airlines）',
    nameMismatch.map((a, i) => `${a.slug}: js=${a.ja}/${a.en} sql=${sqlNamed[i]?.ja}/${sqlNamed[i]?.en}`).join(' / '));
}

console.log('\n▼ ⑥ 送る相手は「通知を希望した人」だけ');
{
  await asAnon();
  await db.query(`update profiles set email_opt_in = false`);
  await asUser(2001, { opt: true,  name: '高橋 蓮', country: '日本',   company: JP_AIR });
  await asUser(2002, { opt: true,  name: 'Alex Mercer', country: 'アラブ首長国連邦', company: 'ヒミツ航空' });
  await asUser(2003, { opt: false, name: 'Pat Lee', country: 'アメリカ合衆国' });
  await asAnon();

  const rs = await rows(`select * from pv_digest_recipients()`);
  const ids = rs.map((r) => r.id);
  ok(ids.includes(uid(2001)) && ids.includes(uid(2002)), '希望した2人が入っている');
  ok(!ids.includes(uid(2003)), '★希望していない人は入らない');
  ok(rs.every((r) => r.email && r.email.includes('@')), 'メールアドレスの無い行は返らない');

  const j = JSON.stringify(rs);
  ok(!j.includes('ヒミツ航空'),
    '★打ち込まれた勤務先そのものは渡らない（語彙に寄せた地域だけ）', j.slice(0, 300));
  const jp = rs.find((r) => r.id === uid(2001));
  ok(jp && jp.airline_region === 'japan', '語彙に当たる勤務先は地域が渡る（言語の手がかり）', JSON.stringify(jp));
  const ke = Object.keys(rs[0] || {}).sort().join(',');
  ok(ke === 'airline_region,country,email,id,name,unsub_token',
    '渡る列は6つだけ（給与も口コミも紐づかない）', ke);
}

console.log('\n▼ ⑦ どこまで送ったかの記録');
{
  await db.query(`delete from pv_mail_state`);
  const s = await since0();
  const ago = (Date.now() - new Date(s).getTime()) / 864e5;
  ok(ago > 6.9 && ago < 7.1, '記録が無い初回は「直近7日」（いきなり全期間を数えない）', `${ago.toFixed(2)}日前`);

  const at = new Date(Date.now() - 3 * 864e5).toISOString();
  await db.query(`select pv_digest_mark($1::timestamptz)`, [at]);
  const s2 = await since0();
  ok(Math.abs(new Date(s2).getTime() - new Date(at).getTime()) < 1000,
    '記録したらそこが次の起点になる', `${s2}`);

  await db.query(`select pv_digest_mark($1::timestamptz)`, [new Date().toISOString()]);
  const n = await one(`select count(*)::int n from pv_mail_state`);
  ok(n.n === 1, '何度記録しても1行のまま（週ごとに溜まらない）', `rows=${n.n}`);

  /* ★送らなかった週の分が消えないこと。記録しなければ起点は動かない。 */
  const before = await since0();
  const w = await week(before);
  const after = await since0();
  ok(w.total >= 0 && new Date(after).getTime() === new Date(before).getTime(),
    '★数えるだけでは起点が動かない（送れなかった週は翌週に合流する）', `${before} → ${after}`);
}

console.log('\n▼ ⑦-b 数えた窓の外に落ちる投稿が無い');
{
  /* 窓は (since, until]。次の週は until より後だけを数えるので、
     ★until ちょうどの1件が二度数えられたり、落ちたりしないこと。 */
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const w1 = await week(since);
  const n1 = w1.total;
  await reviewFor(A1);                       // 数えたあとに1件届いた体
  const w1b = await week(since);
  ok(w1b.total === n1 + 1, '同じ起点で数え直せば、後から届いた1件も入る', `${n1} → ${w1b.total}`);

  const w2 = await week(w1.until);           // until を起点に次の週を数える
  ok(w2.total === 1, '★until を起点にすると、後から届いた1件だけが入る（重複も欠落も無い）',
    `total=${w2.total}`);
}

console.log('\n▼ ⑧ しきい値は手で流す側と同じ数字');
{
  /* ★DIGEST_MIN そのものは Edge Function（supabase/functions/weekly-digest/index.ts）が持つ。
     SQL 側は数えるだけで、送るか送らないかは決めない ── 決める場所を2つにしないため。
     ここでは「SQL にしきい値が書かれていないこと」を見る。 */
  const src = read('db/weekly-digest.sql');
  const body = src.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  ok(!/total\s*[<>]=?\s*\d/.test(body),
    '★SQL の中でしきい値の判定をしていない（判定は Edge Function の1か所）');
  ok(DIGEST_MIN === 4, '手で流す側のしきい値は4件（3件以下の週は送らない）', `DIGEST_MIN=${DIGEST_MIN}`);
}

console.log('\n▼ ⑨ 貼る順を間違えたときに黙って半分だけ作らない');
{
  const db2 = new PGlite({ extensions: { pgcrypto } });
  await db2.waitReady;
  await db2.exec(`
    create schema if not exists auth;
    create table public.profiles (id uuid primary key, email text, name text,
      country text, company text, email_opt_in boolean, unsub_token text,
      created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('pv.uid', true), '')::uuid $$;
  `);
  let msg = null;
  try { await db2.exec(read('db/weekly-digest.sql')); } catch (e) { msg = String(e.message || e); }
  ok(!!msg, '★pv_airlines / pv_airline_resolve が無いと落ちる（貼る順の間違いに気づける）',
    msg ? '' : '通ってしまった');
  await db2.close();
}

// ════════════════════════════════════════════════════════════
console.log(`\n${fail === 0 ? '✅' : '❌'} 合計 ${pass} 件成功 / ${fail} 件失敗`);
await db.close();
process.exit(fail === 0 ? 0 : 1);
