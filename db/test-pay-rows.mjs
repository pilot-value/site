/* db/pay-rows.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-pay-rows.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-referrals.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles）。既定権限を先に全付与してあるから
   こそ pay-rows.sql の revoke が意味を持つ。無いと「元から権限が無いだけ」を
   「revoke が効いた」と誤読する。

   ★2026-08-24、マイページを3枚に分けた（REAL PAY / DEEP PAY / VERIFIED PAY）。
     この画面（REAL PAY）は **機材も支給の内訳も返さない**。個人特定を避けるため、
     画面で隠すのではなく**そもそも送らない**。返るのは会社・職位・年収・検証の4つだけ。
     pv_pay_comp / pv_pct5 / pv_pending_comp は定義だけ残してある（DEEP PAY 用）ので、
     その3つ単体の検査は下の「▼ 7-b」に残してある。消さないこと。

   ★2026-08-23、オーナー判断で k≧5 の門・30日の遅延・p10-p90 のクリップを外した。
     ＝ 出した人は全員そのまま行になる。だからこのファイルが見ているのは
     「出るか出ないか」ではなく、**出たあとで何が漏れないか**に移っている。
     落ちたら画面を作ってはいけない本命は次の5本：

       ・同じ人の12か月が1行に畳まれること      … 出した回数から常連が割れないこと
       ・返り値の文字列に準識別子が1語も無いこと  … 基地・年代・投稿月・原本通貨など
       ・自由入力の社名が返り値に出ないこと      … 打ち込まれた文字列そのものが識別子
       ・並びが投稿順でも金額順でもないこと      … 並び順から「誰が最近出したか」が読めない
       ・pv_pay_rows('ana') が落ちること         … 引数の面が存在しないこと
       ・fleet と comp のキーごと無いこと         … 機材と内訳は REAL PAY の役目ではない

   行を作るときは必ず submit_pay_report() を通す。proof_hash を手で作らない
   （式は2か所にしか無い、が CLAUDE.md の約束）。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { OPS } from '../airline-ops.mjs';

/* ★公開の日（db/pay-rows.sql の person が持つ l0 の境目）を、このテストを始めた時刻に
     差し替えて流す。本物の日付のままだと「何日前に戻した行が公開前か」が
     テストを走らせた日で変わる。差し替えた後は、
       ・このテストで出した行（created_at = now()）… 公開の後
       ・日付を戻した行 …………………………………………… 公開の前
     と、走らせる日に関係なく決まる。
   ⚠️ 境目の文字列が見つからなければ止める（黙って本物の日付で走らせない）。 */
const LAUNCH_LIT = `timestamptz '2026-09-19 00:00:00+09'`;
const LAUNCH = new Date().toISOString();
const read = (f) => {
  const s = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  if (f !== 'db/pay-rows.sql') return s;
  if (s.split(LAUNCH_LIT).length !== 2)
    throw new Error('db/pay-rows.sql に公開の日の境目が1つだけ無い（test-pay-rows.mjs の LAUNCH_LIT を直す）');
  return s.replace(LAUNCH_LIT, () => `timestamptz '${LAUNCH}'`);
};

const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
};
const one  = async (sql, params) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const boom = async (sql, params) => {
  try { await db.query(sql, params); return null; } catch (e) { return String(e.message || e); }
};

// ── 器 ───────────────────────────────────────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;

  create table public.profiles (
    id uuid primary key, email text, name text,
    email_opt_in boolean not null default false
  );

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;

  /* 口コミの表（このファイルが触る列だけの最小形）。
     ★db/pay-rows.sql は口コミに書かれた給与も一覧に混ぜるので、
       流す前にこれが無いと落ちる（本番では元からある表）。
     ★airline に外部キーを張らない。pv_airlines はこの下で作られるので順番が逆。 */
  create table public.reviews_v2 (
    id         uuid primary key default gen_random_uuid(),
    proof_hash text not null,
    airline    text not null,
    "position" text,
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
               'db/pay-reports.sql', 'db/pay-report-pending.sql', 'db/pay-rows.sql'];

console.log('\n▼ SQL の適用');
for (const f of FILES) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f}`); pass++; }
  catch (e) { console.log(`  ❌ ${f}\n     ${e.message}`); fail++; process.exit(1); }
}

console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); console.log(`  ✅ ${f} 再適用OK`); pass++; }
  catch (e) { console.log(`  ❌ ${f} 再適用で失敗\n     ${e.message}`); fail++; }
}

// ── 道具 ─────────────────────────────────────────────────────
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asUser = async (n) => {
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(n), `p${n}@example.com`]);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(n)]);
};
const asAnon = () => db.query(`select set_config('pv.uid', '', false)`);

/* ★1日10件の上限（db/pay-reports.sql の submit_pay_report）に当たらないよう、
   1件ごとに当日カウンタを戻す。上限そのものは db/test-pay-reports.mjs が見ている。
   ここで見たいのは「12か月ぶんが1行に畳まれるか」なので、上限は邪魔なだけ。 */
const submit = async (payload) => {
  const r = await one(`select submit_pay_report($1::jsonb) r`, [JSON.stringify(payload)]);
  await db.query(`update profiles set pay_reports_today = 0`);
  return r;
};

/* 対象年は去年に固定する。今年だと「未来の月は投稿できません」で 9〜12月が落ちる。
   年は区分の材料に入っていないので（会社×職位×機材まで）、結果には影響しない。 */
const YEAR = new Date().getFullYear() - 1;
const BASE = { currency: 'USD', lang: 'en', tax_rate_pct: 0 };

/* 1人ぶん作る。months = [{fleet, month, gross}]
   gross_monthly を使うので 年収 = gross × 12（USD は to_usd = 1.000000）。
   狙った額をそのまま作れるので、丸めの検算が読める形になる。 */
let seat = 1000;
const person = async (air, pos, months) => {
  const u = ++seat;
  await asUser(u);
  for (const m of months) {
    await submit({ ...BASE, airline: air, position: pos, fleet: m.fleet,
                   period_year: YEAR, period_month: m.month, gross_monthly: m.gross });
  }
  return u;
};

/* 登録前の「預かり」を1件作る。★本物の口（submit_pay_report_pending）を通す。
   ip_day_hash は IP ヘッダから作られるが、ローカルでは取れないので null になる。
   「同じ人」を作り分けたいので、入れてから書き換える。 */
const pend = async (air, opts) => {
  await asAnon();
  const res = (await one(`select submit_pay_report_pending($1::jsonb) r`,
    [JSON.stringify({ ...BASE, airline: air, position: opts.pos || 'cap', fleet: opts.fleet || 'b777',
                      period_year: YEAR, period_month: opts.month, gross_monthly: opts.gross })])).r;
  if (opts.iph !== null)
    await db.query(`update pay_reports_pending set ip_day_hash = $2 where id = $1::uuid`,
      [res.id, opts.iph]);
  return res;
};

const backdateAirline = (air, days) =>
  db.query(`update pay_reports set created_at = now() - ($2 || ' days')::interval where airline = $1`,
    [air, String(days)]);

const VIEWER = 9002;
const asViewer = () => db.query(`select set_config('pv.uid', $1, false)`, [uid(VIEWER)]);
const payRows = async () => (await one(`select pv_pay_rows() r`)).r;
const only = (rs, f) => rs.filter(f);
// 画面に出るのと同じ丸め（有効数字2桁）。畳んだ額の検算に使う。
const pv2 = (v) => Number(v.toPrecision(2));

/* ── 鍵の無い人の一覧（2026-09-18）─────────────────────────────
   ★開いた一覧から「こうなるはず」を組み立て直し、本物の返り値と1行ずつ比べる。
   ★型は人のキーから決まるが、開いた一覧はキーを返さない。そこで本物の関数の
     定義を読み、行にキーを1つ足しただけの複製（pv_pay_rows_k）をこのテストの
     中にだけ作る。式を書き写さないので、本物を直せば複製も同じに直る。
     ⚠️ pay-rows.sql を流し直したら作り直す（呼ぶたびに作り直している）。 */
const { createHash: hashOf } = await import('node:crypto');
const withKeys = async () => {
  const d = (await one(`select pg_get_functiondef('public.pv_pay_rows()'::regprocedure) d`)).d;
  const at = `'airline',    p.airline,`;
  if (d.split(at).length !== 2)
    throw new Error('本物の一覧の行の組み立てが見つからない（test-pay-rows.mjs の withKeys を直す）');
  await db.exec(d.replace('public.pv_pay_rows()', () => 'public.pv_pay_rows_k()')
                 .replace(at, () => `'k', p.pkey, 'l0', p.l0, ` + at));
  await asViewer();                       // 開いた一覧（鍵のある人）として引く
  const r = (await one(`select pv_pay_rows_k() r`)).r.rows;
  /* 写しは使い終えたら消す（残すと、下の「anon に開いている関数が無い」に引っかかる）。 */
  await db.exec(`drop function public.pv_pay_rows_k()`);
  return r;
};
const TZ = ['a', 'f', 'c'];               // 年収型・機種型・会社型
const tzOf = (k) => TZ[hashOf('md5').update('pv-tz:' + k).digest()[0] % 3];
const MK_KEYS = { a: ['annual_usd', 'ten', 'tenk', 'verified', 'age'],
                  f: ['annual_usd', 'pos', 'fleet', 'verified', 'age'],
                  c: ['airline', 'pos', 'verified', 'age'] };
const keep = (x, ks) => Object.fromEntries(ks.filter(k => x[k] != null).map(k => [k, x[k]]));
const isPend = (x) => x.k.startsWith('p:');
const md5hex = (k) => hashOf('md5').update(k).digest('hex');
const eliOf = (x) => (x.pos === 'cap' || x.pos === 'fo') && !isPend(x);
/* 8行を選ぶ（xs は並べ終えた順）。機長の枠は、副操縦士が4人に満たなければ増やす。 */
const pick8 = (xs) => {
  const caps = xs.filter(x => x.pos === 'cap');
  const fos  = xs.filter(x => x.pos === 'fo');
  const qc = Math.min(caps.length, Math.max(4, 8 - fos.length));
  const qf = Math.min(fos.length, 8 - qc);
  const top = [];
  for (let i = 0; i < Math.max(qc, qf); i++) {
    if (i < qc) top.push(caps[i]);
    if (i < qf) top.push(fos[i]);
  }
  return top;
};
const maskSpec = (open) => {
  /* ★2026-09-19 公開年収から大きく外れた人（far）は8行の候補から外す。
     9行目以降で会社を伏せるかどうか（eliOf）と公開の日の8行（top0）は変えない。 */
  const top = pick8(open.filter(x => eliOf(x) && !x.far));
  /* 公開の日の8行 ── 公開前の提出（l0）だけで並べ直す。同じ時刻は md5 の順。 */
  const top0 = pick8(open.filter(x => eliOf(x) && x.l0).sort((a, b) =>
    Date.parse(b.l0) - Date.parse(a.l0) || (md5hex(a.k) < md5hex(b.k) ? -1 : 1)));
  /* 見せる型。公開前からいて、公開の日の8行にいなかった人は会社型。 */
  const ty = (x) => (x.l0 && !top0.includes(x)) ? 'c' : tzOf(x.k);
  /* 9行目以降で会社を伏せる人 ＝ 預かりと、8行から下がってきた人（会社型を除く）。 */
  const hideAir = (x) => isPend(x) || (eliOf(x) && ty(x) !== 'c');
  const rest = open.filter(x => !top.includes(x));
  return { top, top0, rest, ty, hideAir, rows: [
    ...top.map(x => ({ ...keep(x, MK_KEYS[ty(x)]), t: ty(x) })),
    ...rest.map(x => keep(x, hideAir(x) ? ['age'] : ['airline', 'age'])),
  ] };
};
const canonRow = (r) => JSON.stringify(Object.fromEntries(Object.entries(r).sort()));
const firstDiff = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (!a[i] || !b[i] || canonRow(a[i]) !== canonRow(b[i]))
      return `${i}行目 本物 ${a[i] && canonRow(a[i])} / 期待 ${b[i] && canonRow(b[i])}`;
  return '';
};

// 会社コードは語彙から取る（このテストのために特定の社名を覚えない）
const VOCAB = (await rows(
  `select code, name_ja, name_en from pv_airlines
    where code <> 'other' and active order by code limit 49`
));
const AIR = VOCAB.map(r => r.code);
const [A_ONE, A_M12, A_MIX, A_OLD, A_ORD, A_VF, A_OUT, A_FOTHER,
       A_BAND, A_PEND, A_CLAIMED, A_NULLIP, A_CROSS, A_COMP, A_STAT,
       A_RV_MON, A_RV_ANN, A_RV_SUM, A_RV_DUP, A_RV_NONE, A_AGE,
       A_AGE2, A_EDGE, A_NM_JA, A_NM_EN, A_NM_CODE, A_RV_FREE,
       A_GV_BASIC, A_GV_DET, A_GV_PS, A_GV_OTHER, A_GV_ITEMS, A_GV_GUAR,
       A_CROSS2,
       // ★2026-09-03 に足した3社（帯・在籍の段・勤務の材料）
       A_BND, A_TEN, A_WRK,
       // ★2026-09-03 に足した7社（報酬の内訳の門）。1社＝1人にして、
       //   その人の投稿時刻だけを動かせるようにしてある（12-i）。
       A_GT_FULL, A_GT_NONE, A_GT_M1, A_GT_M2, A_GT_M3,
       A_GT_ROW, A_GT_OLD, A_GT_PLAIN,
       // ★1区分だけの内訳（基本給＝総支給）。閉じている面に名前も渡さない側。
       A_GT_1SEG,
       // ★2026-09-10。本人の依頼で一覧から下ろす（pay_hidden）。1社＝1人。
       A_HIDE,
       // ★2026-09-11。引き取りに失敗したまま新規保存された人（N-2）。1社＝1人。
       A_N2,
       // ★2026-09-12。不就労減額のあった月（帯が消えないこと）。1社＝1人。
       A_ABS] = AIR;
const nameOf = (code) => VOCAB.find(r => r.code === code);

/* ★2026-09-19 見本の額は、社ごとの公開年収に合わせて作っていない（社は語彙の先頭から
   順に割り当てているだけ）。幅を残すと、年収の数字を直しただけで「公開年収から大きく
   外れた人」（far）が入れ替わり、伏せた一覧の検査が本題と無関係に落ちる。
   ここで使う社の幅は空にして判定から切り離す。far そのものは 12-j で、幅と為替を
   決め打ちして見る。 */
await db.query(`update pv_airlines set cap_lo = null, cap_hi = null, fo_lo = null, fo_hi = null
                 where code = any($1::text[])`, [AIR]);

// ════════════════════════════════════════════════════════════
console.log('\n▼ 1. 鍵（ログインと access_until）');
// ════════════════════════════════════════════════════════════
/* ★2026-09-16 に向きが反転した（オーナー判断）。登録していない人にも
   「伏せた行」（会社・職位・出典・投稿時期の4つだけ）を返す。
   何が返るかの検査は下の 12-b ⑤。ここでは呼べることと権限だけを見る。 */
await asAnon();
const an = await payRows();
ok(an && an.state === 'locked',
   '★ログインしていない人も呼べる（locked が返る）', JSON.stringify(an && an.state));
ok((await one(`select has_function_privilege('anon','public.pv_pay_rows()','execute') b`)).b,
   '★anon に execute が渡っている');
ok((await one(`select has_function_privilege('authenticated','public.pv_pay_rows()','execute') b`)).b,
   'ログインした人には execute が渡っている');
/* ⚠️ いちばん静かな壊れ方 ── revoke … from public を落として grant … to anon
   だけ足すと、PUBLIC の既定の EXECUTE が残って全ロールが呼べる。画面は無変化。 */
ok(!(await one(`select exists(
       select 1 from pg_proc p,
            lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.oid = 'public.pv_pay_rows()'::regprocedure
          and a.grantee = 0 and a.privilege_type = 'EXECUTE') b`)).b,
   '★PUBLIC には渡っていない（anon と登録者だけ）');

await asUser(9001);                       // 一度も給与を出していない人
let r = await payRows();
ok(r.state === 'locked', '鍵を持っていない人は locked', JSON.stringify(r.state));
await db.query(`update profiles set access_until = now() - interval '1 day' where id = $1`, [uid(9001)]);
r = await payRows();
ok(r.state === 'locked', '鍵が切れている人も locked', JSON.stringify(r.state));

/* 見る人は自分では1件も出していない。出させると、その1行が下の行数の検算に混ざる。
   鍵だけ直接開ける。 */
await db.query(`insert into profiles(id,email,access_until) values($1,$2, now() + interval '90 days')
                on conflict (id) do update set access_until = excluded.access_until`,
  [uid(VIEWER), `viewer@example.com`]);

// ════════════════════════════════════════════════════════════
console.log('\n▼ 2. データを作る');
// ════════════════════════════════════════════════════════════
// (a) たった1人。しかも今日出したばかり（★門も遅延も無いので出るはず）
await person(A_ONE, 'cap', [{ fleet: 'b777', month: 3, gross: 15000 }]);

// (b) 3人 × 12か月
for (let i = 0; i < 3; i++)
  await person(A_M12, 'fo', Array.from({ length: 12 },
    (_, m) => ({ fleet: 'a320', month: m + 1, gross: 8000 + m * 100 })));

// (c) 1人が 787 と 330 の両方
await person(A_MIX, 'cap', [{ fleet: 'b787', month: 1, gross: 10000 },
                            { fleet: 'a330', month: 2, gross: 20000 }]);

// (d) 2人ぶん。あとで 800 日前にする（24ヶ月の窓）
for (let i = 0; i < 2; i++)
  await person(A_OLD, 'cap', [{ fleet: 'a350', month: 4, gross: 15000 }]);

// (e) 並びを見るための6人。投稿順に金額が増えていく
const ORD_GROSS = [10000, 11000, 12000, 13000, 14000, 15000];
for (const g of ORD_GROSS) await person(A_ORD, 'cap', [{ fleet: 'b737', month: 7, gross: g }]);

// (f) 検証済みが1人・していない人が1人
const VF_UID = await person(A_VF, 'cap', [{ fleet: 'b787', month: 8, gross: 15000 }]);
await person(A_VF, 'cap', [{ fleet: 'b787', month: 8, gross: 16000 }]);
await db.query(
  `update pay_reports set verify_level = 1 where airline = $1
     and proof_hash in (select proof_hash from pay_reports where airline = $1 order by created_at limit 1)`,
  [A_VF]);

// (g) 中央値の5倍を出した1人＋ふつうの4人（★クリップを外したので、この人は出る）
//     ★ここで見たいのはクリップが無いことなので、5倍にしても「常識の幅」（年 $70万）
//       に当たらない額にしてある。ふつうの4人が年 $12万、5倍の人が年 $60万。
for (const g of [10000, 10000, 10000, 10000, 50000])
  await person(A_OUT, 'cap', [{ fleet: 'b777', month: 9, gross: g }]);

// (h) 「一覧にない会社」2人（★全員出すので、この2人も出る。ただし社名は出ない）
const OTHER_NAME = 'Somewhere Air';
for (let i = 0; i < 2; i++) {
  const u = ++seat; await asUser(u);
  await submit({ ...BASE, airline: 'other', airline_other: OTHER_NAME,
                 position: 'cap', fleet: 'b737', period_year: YEAR, period_month: 5,
                 gross_monthly: 15000 });
}

/* (i) 機材が「その他」の行。★投稿側（pv_validate_pay_payload）は区分の無い機材を
   弾くので、submit では作れない。読み側が 'other' をそのまま返すことを見たいので
   入れてから書き換える。 */
await person(A_FOTHER, 'cap', [{ fleet: 'b737', month: 6, gross: 15000 }]);
await db.query(`update pay_reports set fleet = 'other', fleet_cat = null where airline = $1`, [A_FOTHER]);

/* (j) 常識の幅の材料。3人とも投稿としては正しいので、保存されたあとの額だけ書き換える。
   ★桁を打ち損ねた行と、月額の欄に年額を入れた行。本番で実際にあった2つの形。 */
for (const g of [15000, 16000, 17000])
  await person(A_BAND, 'cap', [{ fleet: 'b777', month: 10, gross: g }]);
await db.query(`update pay_reports set annual_total_usd = 0.75
                 where airline = $1 and annual_total_usd = $2`, [A_BAND, 16000 * 12]);
await db.query(`update pay_reports set annual_total_usd = 12000000
                 where airline = $1 and annual_total_usd = $2`, [A_BAND, 17000 * 12]);

/* (k) 預かり（登録前に出されたぶん）*/
// 同じ人が同じ日に2か月ぶん出した → 1行に畳まれるはず
await pend(A_PEND, { fleet: 'b777', month: 3, gross: 15000, iph: 'iph-aaa' });
await pend(A_PEND, { fleet: 'b777', month: 4, gross: 17000, iph: 'iph-aaa' });
// 別の人 → もう1行
await pend(A_PEND, { fleet: 'b777', month: 3, gross: 20000, iph: 'iph-bbb' });
// 語彙に無い会社コードに書き換えた行 → 出さない（画面の辞書に無い＝コードが素で出る）
{
  const bogus = await pend(A_PEND, { fleet: 'b777', month: 5, gross: 15000, iph: 'iph-ccc' });
  await db.query(`update pay_reports_pending set airline = 'zzz-bogus' where id = $1::uuid`, [bogus.id]);
}
// 本棚へ移したぶん → 出さない（移した先に同じ人が居る＝二重計上）
{
  const claimed = await pend(A_CLAIMED, { fleet: 'b787', month: 3, gross: 15000, iph: 'iph-ddd' });
  await db.query(`update pay_reports_pending set claimed_at = now() where id = $1::uuid`, [claimed.id]);
}
// IP が取れなかったぶん → 出さない（誰の行かまとめられないので畳めない）
await pend(A_NULLIP, { fleet: 'b787', month: 3, gross: 15000, iph: null });
// レートの無い通貨 → 出さない（本棚側の annual_total_usd が null になるのと同じ扱い）
{
  await asAnon();
  await one(`select submit_pay_report_pending($1::jsonb) r`, [JSON.stringify({
    ...BASE, currency: 'ZZZ', airline: A_NULLIP, position: 'cap', fleet: 'b787',
    period_year: YEAR, period_month: 4, gross_monthly: 15000 })]);
  await db.query(`update pay_reports_pending set ip_day_hash = 'iph-eee'
                   where airline = $1 and payload->>'currency' = 'ZZZ'`, [A_NULLIP]);
}

/* (l) 支給の内訳（割合）の材料。6人ぶん、機材で見分けられるようにしてある。
   ★機材は「▼ 7-b」でどの行を取るかに使うだけ。返り値には機材は出ない。
   ★手計算は下の「▼ 7-b」に書いてある。ここは形を作るだけ。 */
{
  const put = async (fleet, p) => {
    const u = ++seat; await asUser(u);
    for (const m of [].concat(p)) 
      await submit({ ...BASE, airline: A_COMP, position: 'cap', fleet,
                     period_year: YEAR, ...m });
  };
  // ① 総支給1本＋パーディアム＋住宅手当＋年1回の賞与（本番でいちばん多い形）
  await put('b777', { period_month: 1, gross_monthly: 9000, per_diem: 400,
                      housing_type: 'allowance', housing_amount: 70, bonus_annual: 26000 });
  // ② 内訳を全部入れた形
  await put('b787', { period_month: 1, base_pay: 9000, per_diem: 1200,
                      housing_type: 'allowance', housing_amount: 2500,
                      transport: 300, command_pay: 800, other_allowance: 200,
                      bonus_annual: 20000, profit_share_annual: 5000 });
  // ③ 社宅が現物支給（住宅は現金ではないので割合に入らない）
  await put('a320', { period_month: 1, base_pay: 9000,
                      housing_type: 'provided', housing_amount: 2500 });
  // ④ 手当が総支給を超えている（入力違い）→ 内訳を出さない
  await put('a330', { period_month: 1, gross_monthly: 1000, per_diem: 2000 });
  // ⑤ 同じ人の2か月。割合が月ごとに違う → 平均される
  await put('a350', [{ period_month: 1, gross_monthly: 10000 },
                     { period_month: 2, gross_monthly: 10000, bonus_annual: 120000 }]);
  // ⑥ 2か月のうち1か月が入力違い → その人の内訳は丸ごと出さない
  await put('b737', [{ period_month: 3, gross_monthly: 1000, per_diem: 2000 },
                     { period_month: 4, gross_monthly: 10000 }]);
}

/* (m) ★帯の材料（2026-09-03）。オーナーが書いた完成イメージを**そのまま**作る。
   Qantas / First Officer / A320 · 1-5 years / 約 185K
     Base 130,000–135,000 / Flight Pay 30,000–35,000
     Allowances 10,000–15,000 / Bonus < 10,000
     Block Hours 60–70 / Duty Days 14–16 / Days Off 12–14
   ここが落ちたら、画面に出る帯がオーナーの指定と違うということ。

   ⚠️ other_allowance に 3,600 と入れているのは打ち間違いではない。
      給与フォームは変動の合計（2,600）を flight_variable_pay と
      other_allowance の**両方**に写す。実際の「その他」は 1,000。
      サーバ側の引き算（命綱）が効いていれば 12,000/年 の帯になる。 */
{
  const u = ++seat; await asUser(u);
  await submit({ ...BASE, airline: A_BND, position: 'fo', fleet: 'a320',
                 period_year: YEAR, period_month: 6,
                 gross_monthly: 14600, base_pay: 11000,
                 flight_variable_pay: 2600, other_allowance: 3600,
                 bonus_annual: 7000,
                 block_hours: 65, duty_days: 15, days_off: 13,
                 seniority_years: 3, rank_years: 3 });
}

/* (n) 年数の段。5年幅で5段・**職位で分けない**（2026-09-16 オーナー指示）。
   境目のちょうどの値を入れる ── 5年・10年・15年・20年はどれも上の段。
   ⚠️ **下の7人は在籍年数を全員 40 に揃えてある。** 段が在籍年数から作られていたら、
      全員が最上段（4）になって下の検査がまとめて落ちる ── つまりこの1行が
      「行に出ているのが昇格後年数のほうだ」という証拠になっている。
      2026-09-16 までは、まさにその在籍年数が行に出ていた。
   ★そのあとに2人足してある ──
       ・在籍だけ書いた人（＝昇格後年数の欄ができる前の投稿）
         → 段は在籍年数から作り、tenk='s' を添えて今までどおり出す
           （オーナー指示「これまで提出してもらったものは今まで通り出して」）
       ・どちらも書いていない人 → 段そのものが出ない（0 で埋めない） */
{
  const ten = async (pos, years, month) => {
    const u = ++seat; await asUser(u);
    await submit({ ...BASE, airline: A_TEN, position: pos, fleet: 'b777',
                   period_year: YEAR, period_month: month, gross_monthly: 15000,
                   seniority_years: 40, rank_years: years });
  };
  await ten('fo',   4, 1);   // → 0
  await ten('fo',   5, 2);   // → 1（境目は上の段）
  await ten('cap',  9, 3);   // → 1
  await ten('cap', 10, 4);   // → 2
  await ten('cap', 14, 5);   // → 2
  await ten('cap', 15, 6);   // → 3
  await ten('cap', 20, 7);   // → 4
  /* 昇格後年数を書いていない古い行 → 在籍12年から段2を作り、tenk='s' を添える。
     ★ここを 40 にしない。40 だと上の「全員 4 ではない」検査と見分けが付かない。 */
  {
    const u = ++seat; await asUser(u);
    await submit({ ...BASE, airline: A_TEN, position: 'cap', fleet: 'b777',
                   period_year: YEAR, period_month: 8, gross_monthly: 15000,
                   seniority_years: 12 });
  }
  // 年数をどちらも書いていない人 → 段そのものが出ない（「不明」を置かない）
  {
    const u = ++seat; await asUser(u);
    await submit({ ...BASE, airline: A_TEN, position: 'cap', fleet: 'b777',
                   period_year: YEAR, period_month: 9, gross_monthly: 15000 });
  }
}

/* (o) 勤務だけ書いた人・総支給だけの人。
   ★総支給だけの人に「その他1本」の帯を作らないことを見る。 */
{
  const u = ++seat; await asUser(u);
  await submit({ ...BASE, airline: A_WRK, position: 'cap', fleet: 'b787',
                 period_year: YEAR, period_month: 6, gross_monthly: 20000,
                 block_hours: 72 });
  const u2 = ++seat; await asUser(u2);
  await submit({ ...BASE, airline: A_WRK, position: 'fo', fleet: 'b787',
                 period_year: YEAR, period_month: 6, gross_monthly: 8000 });
}

/* (p) ★不就労減額のあった月（2026-09-12）。印字の総支給は減額を引いたあと、
   内訳は引く前なので、そのままだと内訳の合計が総支給を超えて
   **帯がまるごと出なくなる**（画面は普通に動いたまま、その人だけ内訳が無い）。
   組合の分と同じ理由で、cash_m に減額を足し戻す。
   基本給3,600／変動2,240／その他80／日当90 ＝ 6,010、印字の総支給 5,830。 */
{
  const u = ++seat; await asUser(u);
  await submit({ ...BASE, airline: A_ABS, position: 'fo', fleet: 'b737',
                 period_year: YEAR, period_month: 6,
                 gross_monthly: 5830, base_pay: 3600,
                 flight_variable_pay: 2240, other_allowance: 2320, per_diem: 90,
                 pay_items: { v: 2,
                              absence: [{ label: 'Unpaid leave', amount: -180 }] } });
}

/* ★2026-09-03、報酬の内訳に Give & Get の門が入った。
   見る人が自分の内訳を出していないと、下の 7-c で読む帯が**返ってこない**。
   会社は A_OLD ── この直後に2年より前へ送るので、**行にも件数にも出てこない**。
   「見る人は自分の行を一覧に持たない」という元の前提はそのまま守られる。 */
await asViewer();
await submit({ ...BASE, airline: A_OLD, position: 'cap', fleet: 'b777',
               period_year: YEAR, period_month: 1, gross_monthly: 15000,
               base_pay: 9000, guarantee_pay: 3000, flight_variable_pay: 2000 });

await backdateAirline(A_OLD, 800);        // ★この会社だけ2年より前にする
await asViewer();
r = await payRows();
ok(r.ok === true && r.state === 'open', '鍵のある人には open が返る', JSON.stringify(r.state));
const R = r.rows;

// ════════════════════════════════════════════════════════════
console.log('\n▼ 3. ★全員出る（門も遅延も無い）');
// ════════════════════════════════════════════════════════════
ok(only(R, x => x.airline === A_ONE).length === 1,
   '★その会社に1人しかいなくても、その1人が行になる', `= ${only(R, x => x.airline === A_ONE).length}行`);
ok(only(R, x => x.airline === A_ONE)[0]?.annual_usd == 15000 * 12,
   '　額もそのまま（丸めた形で）', JSON.stringify(only(R, x => x.airline === A_ONE)));
{
  const fresh = await one(`select min(created_at) > now() - interval '1 hour' b
                             from pay_reports where airline = $1`, [A_ONE]);
  ok(fresh.b === true, '　（その行は今日出したもの＝30日の遅延が本当に無い）');
}
ok(only(R, x => x.airline === 'other').length === 2,
   '★「一覧にない会社」の人も出る（2人）', `= ${only(R, x => x.airline === 'other').length}行`);
ok(only(R, x => x.airline === A_OLD).length === 0,
   '2年より前の行は出ない（24ヶ月の窓は残っている）');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 4. ★同じ人の複数月が1行に畳まれる');
// ════════════════════════════════════════════════════════════
const m12 = only(R, x => x.airline === A_M12);
ok(m12.length === 3, '3人が12か月ずつ出しても3行（36行にならない）', `= ${m12.length}行`);
ok((await one(`select count(*)::int c from pay_reports where airline = $1`, [A_M12])).c === 36,
   '　（元の表には36行ちゃんと入っている）');
ok(new Set(m12.map(x => String(x.annual_usd))).size === 1,
   '　3人とも同じ12か月なので同じ額に落ちる', JSON.stringify(m12.map(x => x.annual_usd)));

/* ★機材を返さなくなったので、同じ人が2機材ぶん出しても1行に畳まれる。
   前は機材ごとに1行だった。「1人＝1行」に近づいた側の変化。 */
const mix = only(R, x => x.airline === A_MIX);
ok(mix.length === 1, '★1人が2機材を出しても1行（機材で行が割れない）', `= ${mix.length}行`);
ok((await one(`select count(*)::int c from pay_reports where airline = $1`, [A_MIX])).c === 2,
   '　（元の表には2行ちゃんと入っている）');
ok(Number(mix[0]?.annual_usd) === pv2((10000 * 12 + 20000 * 12) / 2),
   '　額は2つの中央値（どちらの機材の額とも違う）', JSON.stringify(mix.map(x => x.annual_usd)));

// ════════════════════════════════════════════════════════════
console.log('\n▼ 5. 丸め（k≧5 の門を外した今、いちばん外側の守り）');
// ════════════════════════════════════════════════════════════
const notRounded = await rows(
  `select v from (
     select (e->>'annual_usd')::numeric v from jsonb_array_elements(pv_pay_rows()->'rows') e
   ) q where pv_sig2(v) is distinct from v`);
ok(notRounded.length === 0, '画面に出るすべての額が有効数字2桁',
   JSON.stringify(notRounded.slice(0, 3)));
ok((await one(`select pv_sig2(183456::numeric) v`)).v == 180000, 'pv_sig2(183456) = 180000');
ok((await one(`select pv_sig2(0::numeric) v`)).v === null, 'pv_sig2(0) は null');
{
  /* ★クリップを外したので、極端に高い1人はそのままの桁で出る。
     これは仕様（オーナー判断）。**黙って戻さない**ために、出ることを検査で固定しておく。
     戻すなら pay-rows.sql の冒頭ごと直すこと。 */
  const outs = only(R, x => x.airline === A_OUT).map(x => Number(x.annual_usd));
  ok(outs.length === 5, '外れ値の会社は5人ぶん出る', `= ${outs.length}行`);
  ok(Math.max(...outs) === 50000 * 12,
     '★中央値の5倍の人はクリップされずに出る（丸めだけが効く）', JSON.stringify(outs));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 6. ★並びは新しい順（2026-08-25。前は md5 順だった）');
// ════════════════════════════════════════════════════════════
/* ★オーナー指示で md5 順をやめ、新しい順（新しいほうが上）にした。
   A_ORD の6人は「投稿順に金額が増える」ように作ってあるので、
   新しい順に並んでいれば金額は降順になる。 */
{
  const got = only(R, x => x.airline === A_ORD).map(x => Number(x.annual_usd));
  // ★丸めたあとの額で比べる。生の額で比べると、丸めのせいで
  //   「並びが違う」といつでも言えてしまい、検査が何も見なくなる。
  const desc = ORD_GROSS.map(g => pv2(g * 12)).reverse();
  ok(got.length === 6, '並びを見る会社は6人ぶん出る', `= ${got.length}行`);
  ok(new Set(got).size === 6, '　6人の額はすべて違う（並びが読める形になっている）',
     JSON.stringify(got));
  ok(got.join() === desc.join(), '★新しい順（新しいほうが上）に並んでいる',
     JSON.stringify(got));
}
{
  // 2回呼んでも同じ並び（同着でも md5 が第2キーで押さえる）
  const a = (await payRows()).rows.map(x => `${x.airline}/${x.pos}/${x.annual_usd}`).join('|');
  const b = (await payRows()).rows.map(x => `${x.airline}/${x.pos}/${x.annual_usd}`).join('|');
  ok(a === b, '何度呼んでも同じ並び（同着は md5 で固定）');
}
{
  /* ★並びと右端の列が食い違わないこと。
     新しい順（新しいほうが上）に並び、段はその同じ時刻から決まるので、
     上から下へ段は必ず 0→4 の向きにしか動かない。逆流したら、
     並べるのに使った時刻と段を出した時刻が別物になっている。 */
  const ages = R.map(x => x.age);
  const bad  = ages.findIndex((a, i) => i > 0 && a < ages[i - 1]);
  ok(bad === -1, '★上から下へ段が逆流しない（並びと投稿時期が同じ時刻から出ている）',
     bad === -1 ? '' : `${bad}行目 ${ages[bad - 1]} → ${ages[bad]}`);
}
{
  // 並べるのに使う時刻は返していない（返すと秒単位の提出時刻がそのまま漏れる）
  const t = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!t.includes('last_at'), '★並べるのに使う時刻（last_at）を行に入れていない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7. ★返り値に何が入っているか');
// ════════════════════════════════════════════════════════════
/* ★2026-09-03、オーナー判断で機材・年数の段・内訳の帯・勤務の帯を返すようにした。
   （2026-08-24 に「返さない」と決めたのを取り消したもの。経緯は db/pay-rows.sql の冒頭）
   ここの検査は「返すか返さないか」から **「返るのが帯と段だけか」** に移っている。
   ⚠️ ALLOWED に語を足すのは設計判断。足す前に db/pay-rows.sql の②を読むこと。 */
/* ★2026-09-19 far を足した（公開年収から大きく外れた本人申告の行。値は true だけ）。 */
const ALLOWED = ['airline', 'pos', 'annual_usd', 'verified', 'age',
                 'fleet', 'ten', 'tenk', 'pay', 'paylock', 'work', 'far'];
const extra = [...new Set(R.flatMap(x => Object.keys(x)))].filter(k => !ALLOWED.includes(k));
ok(extra.length === 0, '返す項目は12個だけ', JSON.stringify(extra));
ok(R.every(x => !('far' in x) || x.far === true),
   '★far は true のときだけ入る（false や null で全行に鍵を生やさない）');
ok(R.every(x => !('comp' in x)),
   '★どの行にも支給の「割合」のキーが無い（割合は今も DEEP PAY の役目）');
ok(R.every(x => !('fleet_cat' in x)),
   '★機材の区分（狭胴・中型・広胴）は返していない（2粒度を揃えない）');

const raw = (await one(`select pv_pay_rows()::text t`)).t;
const BANNED = ['proof_hash', 'base_iata', 'seniority', 'rank_years', 'age_bucket', 'period_month',
                'period_year', 'created_at', 'annual_total_orig', 'currency',
                'contract_type', 'tax_country', 'nationality', 'verify_level',
                'base_pay', 'housing_amount', 'housing_type', 'per_diem',
                'block_hours', 'duty_days', 'days_off', 'airline_other'];
const hit = BANNED.filter(w => raw.includes(w));
ok(hit.length === 0, '準識別子・列名そのものが返り値の文字列に1つも無い', JSON.stringify(hit));
ok(!raw.includes(OTHER_NAME) && !raw.toLowerCase().includes('somewhere'),
   '★打ち込まれた自由入力の社名が返り値に1文字も無い');
ok(only(R, x => x.airline === 'other')
     .every(x => Object.keys(x).every(k => ALLOWED.includes(k))),
   '　その人たちの行にも余分な欄が1つも無い（打ち込まれた社名の置き場が無い）');
ok(R.every(x => Number.isInteger(x.age) && x.age >= 0 && x.age <= 4),
   '★投稿の時期は0〜4の段だけ（日付も年月も入っていない）');
ok(!/\d{4}-\d{2}/.test(raw),
   '★返り値の文字列に年月の形をした数字が1つも無い');

/* ★機材は**語彙のコードだけ**。打ち込まれた文字列がそのまま出る道が無いこと。 */
{
  const codes = (await rows(`select code from pv_fleets where active`)).map(x => x.code);
  const bad = [...new Set(R.map(x => x.fleet).filter(Boolean))]
                .filter(c => !codes.includes(c));
  ok(bad.length === 0, '★機材は語彙にあるコードだけ', JSON.stringify(bad));
  ok(R.some(x => x.fleet), '　機材が実際に出ている（キーごと消えていない）');
}
ok(only(R, x => x.airline === A_FOTHER).length === 1,
   '　機材の区分が無い行も、機材そのものは出るので普通に1行として出る');
ok(R.every(x => x.airline && x.pos), 'ラベルの無い列が1つも無い');
ok(R.every(x => typeof x.verified === 'boolean'), '検証は true/false の1つだけ（段階を持たない）');
{
  const vf = only(R, x => x.airline === A_VF);
  ok(vf.length === 2 && vf.filter(x => x.verified).length === 1,
     '検証済みの人だけ verified が true', JSON.stringify(vf.map(x => x.verified)));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7-c. ★帯（2026-09-03。行を押すと見えるもの）');
// ════════════════════════════════════════════════════════════
/* ★ここが落ちたら画面を作ってはいけない本命は4つ：
     ・帯の両端が刻みの倍数であること      … 端が生の額になっていない
     ・両端が違う数であること              … 幅0の帯＝実額をそのまま出している
     ・総支給しか書いていない人に帯が無いこと … 年収を写しただけの偽の内訳
     ・在籍が段だけであること              … 年が混ざると1人に当たる          */
{
  const b = only(R, x => x.airline === A_BND)[0];
  ok(!!b, '★帯の材料になる行が出ている');

  /* ── オーナーが書いた完成イメージ、そのまま ────────────── */
  const seg = (k) => (b && b.pay || []).find(x => x.k === k);
  const same = (k, lo, hi) => {
    const g = seg(k);
    return !!g && Number(g.r[0]) === lo && Number(g.r[1]) === hi;
  };
  ok(b && b.fleet === 'a320' && b.pos === 'fo' && b.ten === 0,
     '★オーナーの例：A320 / First Officer / 昇格後5年未満の段',
     JSON.stringify(b && { fleet: b.fleet, pos: b.pos, ten: b.ten }));
  ok(same('base', 130000, 135000),
     '★オーナーの例：Base 130,000〜135,000', JSON.stringify(seg('base')));
  ok(same('variable', 30000, 35000),
     '★オーナーの例：Flight Pay 30,000〜35,000', JSON.stringify(seg('variable')));
  ok(same('other', 10000, 15000),
     '★オーナーの例：Allowances 10,000〜15,000（命綱の引き算が効いている）',
     JSON.stringify(seg('other')));
  ok(same('bonus', 0, 10000),
     '★オーナーの例：Bonus は「10,000 未満」に畳まれる（下端が 0）',
     JSON.stringify(seg('bonus')));
  ok(b && b.work && Number(b.work.bh[0]) === 60 && Number(b.work.bh[1]) === 70
       && Number(b.work.dd[0]) === 14 && Number(b.work.dd[1]) === 16
       && Number(b.work.off[0]) === 12 && Number(b.work.off[1]) === 14,
     '★オーナーの例：60〜70時間 / 14〜16日 / 休み12〜14日',
     JSON.stringify(b && b.work));

  /* ── 全行にかかる約束 ──────────────────────────────── */
  const all = R.flatMap(x => (x.pay || []).map(p => ({ air: x.airline, ...p })));
  ok(all.length > 0, '　帯が実際に出ている行がある', String(all.length));
  ok(all.every(p => Array.isArray(p.r) && p.r.length === 2),
     '★帯は必ず「下端と上端」の2つ（1つの数を返していない）');
  ok(all.every(p => Number(p.r[1]) > Number(p.r[0])),
     '★★ 幅0の帯が1つも無い（＝実額をそのまま出していない）★★',
     JSON.stringify(all.filter(p => Number(p.r[1]) <= Number(p.r[0])).slice(0, 3)));

  /* 両端が刻みの倍数であること。刻みはその人の年収から決まる（pv_band_grid）。 */
  const bad = [];
  for (const x of R) {
    if (!x.pay) continue;
    const g = Number((await one(`select pv_band_grid($1::numeric) g`, [x.annual_usd])).g);
    for (const p of x.pay)
      if (Number(p.r[0]) % g !== 0 || Number(p.r[1]) % g !== 0)
        bad.push({ air: x.airline, k: p.k, r: p.r, g });
  }
  ok(bad.length === 0, '★帯の両端が刻みの倍数（端が生の額になっていない）',
     JSON.stringify(bad.slice(0, 3)));

  /* 勤務の刻みは固定（年収に連動させない）。 */
  const w = R.map(x => x.work).filter(Boolean);
  ok(w.length > 0, '　勤務の帯が実際に出ている行がある', String(w.length));
  ok(w.every(v => (!v.bh  || (v.bh[0]  % 10 === 0 && v.bh[1]  % 10 === 0))
                && (!v.dd  || (v.dd[0]  %  2 === 0 && v.dd[1]  %  2 === 0))
                && (!v.off || (v.off[0] %  2 === 0 && v.off[1] %  2 === 0))),
     '★勤務の刻みは 10時間 / 2日 / 2日で固定（年収に連動していない）');
  ok(w.every(v => Object.keys(v).every(k => ['bh', 'dd', 'off'].includes(k))),
     '★勤務は3つだけ（便数・ステイ日数・拘束時間などが増えていない）',
     JSON.stringify([...new Set(w.flatMap(v => Object.keys(v)))]));

  /* ── 不就労減額のあった月（2026-09-12）───────────────── */
  {
    const a = only(R, x => x.airline === A_ABS)[0];
    ok(a && Array.isArray(a.pay) && a.pay.length > 0,
       '★★ 減額のあった月にも帯が出る（足し戻さないと内訳ごと消える）★★',
       JSON.stringify(a && { air: a.airline, pay: a.pay }));
    ok(a && (a.pay || []).some(x => x.k === 'base'),
       '　基本給の帯が出ている（内訳を書いた人として扱われる）',
       JSON.stringify(a && a.pay));
  }

  /* ── 総支給しか書いていない人 ───────────────────────── */
  {
    const only1 = only(R, x => x.airline === A_WRK && x.pos === 'fo')[0];
    ok(only1 && !('pay' in only1),
       '★★ 総支給しか書いていない人に帯を作っていない（キーごと無い）★★',
       JSON.stringify(only1));
    ok(only1 && !('work' in only1) && !('ten' in only1) && !('tenk' in only1),
       '　勤務も年数も書いていなければキーごと出ない（「不明」を置かない）');
    const wOnly = only(R, x => x.airline === A_WRK && x.pos === 'cap')[0];
    ok(wOnly && !('pay' in wOnly) && wOnly.work && Number(wOnly.work.bh[0]) === 70,
       '　勤務だけ書いた人は勤務だけ出る（内訳は作らない）',
       JSON.stringify(wOnly && wOnly.work));
  }

  /* ── 年数の段 ─────────────────────────────────────── */
  {
    const t = only(R, x => x.airline === A_TEN);
    const rk = t.filter(x => x.tenk === 'r');
    const fo  = rk.filter(x => x.pos === 'fo').map(x => x.ten).sort();
    const cap = rk.filter(x => x.pos === 'cap').map(x => x.ten).sort();
    ok(fo.join(',') === '0,1',
       '★FO：4年→0 / 5年→1（境目は上の段）', fo.join(','));
    ok(cap.join(',') === '1,2,2,3,4',
       '★CAP：9→1 / 10→2 / 14→2 / 15→3 / 20→4（刻みは FO と同じ5年幅）',
       cap.join(','));
    ok(!cap.includes(0) && !fo.includes(4),
       '★★職位で段を変えていない（同じ年数なら FO も CAP も同じ段）★★',
       `fo=${fo.join(',')} cap=${cap.join(',')}`);
    ok(R.every(x => x.ten === undefined || [0, 1, 2, 3, 4].includes(x.ten)),
       '★段は 0〜4 だけ（年そのものが混ざっていない）');
    /* ★★ 段の材料が在籍年数に戻っていないこと。上の7人は全員
           seniority_years: 40（＝最上段）で出しているので、戻っていれば全部 4 になる。 */
    ok(!rk.every(x => x.ten === 4),
       '★★昇格後年数を書いた人の段は、在籍年数ではなく昇格後年数から作られている★★',
       JSON.stringify(rk.map(x => x.ten)));

    /* ★昇格後年数の欄ができる前の投稿（2026-09-16・オーナー指示で今までどおり出す）。
         ⚠️ **段だけ渡して札を1種類にしない。** tenk が無いと画面が
            「昇格後20年以上」と書いてしまい、この日直した嘘がそのまま戻る。 */
    const sn = t.filter(x => x.tenk === 's');
    ok(sn.length === 1 && sn[0].ten === 2,
       '★★昇格後が空の古い行は、在籍12年から段2を作って今までどおり出る★★',
       JSON.stringify(sn.map(x => [x.ten, x.tenk])));
    ok(rk.length === 7 && rk.every(x => x.ten !== undefined),
       '　昇格後を書いた人の札は r（在籍40年に引きずられていない）',
       JSON.stringify(rk.map(x => [x.ten, x.tenk])));

    const none = t.filter(x => !('ten' in x));
    ok(none.length === 1 && !('tenk' in none[0]),
       '★どちらの年数も書いていない人は段も札もキーごと無い（「不明」を置かない）',
       JSON.stringify(none));
    ok(R.every(x => x.tenk === undefined || x.tenk === 'r' || x.tenk === 's'),
       '★tenk は r か s だけ（年数そのものを1文字も混ぜていない）',
       JSON.stringify([...new Set(R.map(x => x.tenk))]));
  }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 7-b. ★支給の内訳（DEEP PAY 用。REAL PAY からは呼ばれない）');
// ════════════════════════════════════════════════════════════
/* 2026-08-24。内訳は REAL PAY では出さないことにしたが、pv_pay_comp / pv_pct5 の
   **定義は残してある**（DEEP PAY で「この給与は何で構成されているか」を集計する材料）。
   使う側が居ないと検査ごと消えて、次に使うときに誰も正しさを知らない状態になるので、
   ここで関数を直に呼んで確かめておく。★消さないこと。

   内訳の**金額**を返すと有効数字2桁の丸めをすり抜けて実額の個票になるので、
   返すのは割合だけ（db/pay-rows.sql の3つとも金額を1つも返さない）。

   ★ここが落ちたら DEEP PAY を作ってはいけない本命は3つ：
     ・値がすべて 0〜100 の整数であること（金額が混ざっていない）
     ・合計がちょうど 100 になること（99 や 101 だと円グラフに隙間が出る）
     ・足し算が pv_annual_total と同じであること（下の手計算） */
{
  /* pay_reports の1行を、そのまま pv_pay_comp → pv_pct5 に通す。
     ★機材は「どの行を取るか」に使っているだけ。返り値には出ない。 */
  const cmAt = async (fleet, month) => (await one(`
    select public.pv_pct5(public.pv_pay_comp(
             gross_monthly, base_pay, hourly_rate, guaranteed_hours, block_hours,
             per_diem, housing_type, housing_amount, transport, command_pay,
             other_allowance, bonus_annual, profit_share_annual, bonus_month)) c
      from pay_reports where airline = $1 and fleet = $2 and period_month = $3`,
    [A_COMP, fleet, month])).c;
  const cm = (fleet) => cmAt(fleet, 1);
  const KEYS = ['m', 'b', 'd', 'h', 'o'];
  const eq = (c, e) => c !== null && c !== undefined
    && KEYS.every(k => c[k] === e[k]);

  const comps = (await Promise.all(
    ['b777', 'b787', 'a320', 'a350'].map(f => cm(f)))).filter(c => c !== null);
  ok(comps.length === 4, '　内訳が出る行が実際にある', String(comps.length));
  ok(comps.every(c => Object.keys(c).length === 5
                   && KEYS.every(k => Number.isInteger(c[k]))),
     '★内訳は m/b/d/h/o の5つだけ。値は整数（金額が混ざっていない）',
     JSON.stringify(comps.find(c => Object.keys(c).length !== 5
                                 || !KEYS.every(k => Number.isInteger(c[k])))));
  ok(comps.every(c => KEYS.every(k => c[k] >= 0 && c[k] <= 100)),
     '　どの値も 0〜100 の中（額がそのまま入っていない）');
  ok(comps.every(c => KEYS.reduce((s, k) => s + c[k], 0) === 100),
     '★合計がちょうど 100（丸めの端数を最大の成分で吸収している）',
     JSON.stringify(comps.map(c => KEYS.reduce((s, k) => s + c[k], 0)).filter(v => v !== 100)));

  /* ★以下の①〜④は「1行ぶん」の手計算。前は pv_pay_rows が返す comp を見ていたが、
     今は関数を直に呼んでいる。期待値は1つも変えていない。 */

  /* ① 総支給9000＋パーディアム400＋住宅手当70＋年1回の賞与26000
        年収 = 12×9000 + 26000 = 134,000（pv_annual_total と同じ）
        m = 12×(9000−400−70) = 102,360 → 76.4% → 76
        b = 26,000 → 19.4% → 19 ／ d = 4,800 → 3.6% → 4 ／ h = 840 → 0.6% → 1 */
  ok(eq(await cm('b777'), { m: 76, b: 19, d: 4, h: 1, o: 0 }),
     '① 総支給＋パーディアム＋住宅手当＋賞与（手計算と一致）', JSON.stringify(await cm('b777')));

  /* ② 内訳を全部入れた形。年収 = 12×14,000 + 25,000 = 193,000
        m = 108,000 → 56 ／ b = 25,000 → 13 ／ d = 14,400 → 7
        h = 30,000 → 16 ／ o = 12×1,300 = 15,600 → 8 */
  ok(eq(await cm('b787'), { m: 56, b: 13, d: 7, h: 16, o: 8 }),
     '② 内訳を全部入れた形（手計算と一致）', JSON.stringify(await cm('b787')));

  /* ③ 社宅が現物支給。pv_annual_total が足さないので、割合にも入らない */
  ok(eq(await cm('a320'), { m: 100, b: 0, d: 0, h: 0, o: 0 }),
     '★③ 現物支給の社宅は住宅手当に入らない（金額に入れていないので割合にも入れない）',
     JSON.stringify(await cm('a320')));

  /* ④ パーディアム2000 が総支給1000 を超えている＝入力違い。
        嘘の円を描くより描かない方がよい。 */
  ok(await cm('a330') === null,
     '★④ 手当が総支給を超えている行は内訳を出さない（null）', JSON.stringify(await cm('a330')));

  /* ⑤ 同じ人の2か月。1月は 100/0、2月は 50/50。
        ★「平均して 75/25 にする」側の足し算は pv_pay_rows の中にあったので、
          機材と内訳を落としたときに一緒に消えた。DEEP PAY で書き直すことになる。
          ここでは、その材料になる**月ごとの値**が正しいことだけを見ておく。 */
  ok(eq(await cmAt('a350', 1), { m: 100, b: 0, d: 0, h: 0, o: 0 }),
     '⑤ 同じ人の1月ぶん（賞与なし）', JSON.stringify(await cmAt('a350', 1)));
  ok(eq(await cmAt('a350', 2), { m: 50, b: 50, d: 0, h: 0, o: 0 }),
     '　同じ人の2月ぶん（賞与が出た月）', JSON.stringify(await cmAt('a350', 2)));

  /* ⑥ 2か月のうち1か月が入力違い。
        ★DEEP PAY で平均するときは、この人を丸ごと落とすこと（半分だけの円を描かない）。 */
  ok(await cmAt('b737', 3) === null,
     '★⑥ 手当が総支給を超えている月は null（この人は丸ごと落とす材料になる）',
     JSON.stringify(await cmAt('b737', 3)));
  ok(eq(await cmAt('b737', 4), { m: 100, b: 0, d: 0, h: 0, o: 0 }),
     '　同じ人のもう1か月は普通に出る（だから「丸ごと落とす」を忘れると混ざる）');

  /* 端数の吸収が「たまたま」でないことを、総当たりで見る。 */
  const badSum = await rows(`
    select a, public.pv_pct5(a) c
      from (select array[i::numeric, j::numeric, k::numeric, l::numeric, m::numeric] a
              from generate_series(0, 7) i, generate_series(0, 7) j, generate_series(0, 7) k,
                   generate_series(0, 7) l, generate_series(0, 7) m
             where i + j + k + l + m > 0) t
     where (public.pv_pct5(a)->>'m')::int + (public.pv_pct5(a)->>'b')::int
         + (public.pv_pct5(a)->>'d')::int + (public.pv_pct5(a)->>'h')::int
         + (public.pv_pct5(a)->>'o')::int <> 100
     limit 5`);
  ok(badSum.length === 0,
     '★5本の割合を 8×8×8×8×8 通り試して、合計が 100 でないものが1つも無い',
     JSON.stringify(badSum));
  const negPct = await rows(`
    select a from (select array[i::numeric, j::numeric, k::numeric, l::numeric, m::numeric] a
              from generate_series(0, 7) i, generate_series(0, 7) j, generate_series(0, 7) k,
                   generate_series(0, 7) l, generate_series(0, 7) m
             where i + j + k + l + m > 0) t
     where least((public.pv_pct5(a)->>'m')::int, (public.pv_pct5(a)->>'b')::int,
                 (public.pv_pct5(a)->>'d')::int, (public.pv_pct5(a)->>'h')::int,
                 (public.pv_pct5(a)->>'o')::int) < 0 limit 5`);
  ok(negPct.length === 0, '　端数を吸収しても負の割合が出ない', JSON.stringify(negPct));

  ok((await one(`select public.pv_pct5(null::numeric[]) c`)).c === null,
     '　材料が無ければ null（画面は円グラフを出さない）');
  ok((await one(`select public.pv_pct5(array[0,0,0,0,0]::numeric[]) c`)).c === null,
     '　全部ゼロでも null（0で割らない）');

  /* ⑦ 保証給・教官・審査・組合・管理職の手当（2026-08-26）と、その他の兼務・配属（2026-08-27）。
     pv_pay_comp は「引数の並びが pv_annual_total と 1文字も違わない」
     「6本の合計があちらの返り値と一致する」を約束している。
     片方だけに引数を足すと、その2つが黙って破れる。 */
  const nc = await one(`select p.pronargs n from pg_proc p join pg_namespace s on s.oid=p.pronamespace
                         where s.nspname='public' and p.proname='pv_pay_comp'`);
  ok(Number(nc.n) === 20, `★pv_pay_comp も20引数（pv_annual_total と同じ並び）→ ${nc.n}`);
  const gcomp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, 5000, null)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, 5000, null) v`);
  ok(gcomp.c && gcomp.c.m === 100 && Number(gcomp.v) === 300000,
     '★保証給は「月々の支給（m）」に入る（灰色にも賞与にも落ちない）',
     JSON.stringify(gcomp));

  const icomp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600) v`);
  /* 教官の手当は「その他の手当（o）」の側。保証給（m）と行き先が違うのは、
     保証給が基本給と同じ「毎月の下限」なのに対し、教官の手当は職位手当や
     交通費と同じ手当だから。o に入れておくと DEEP PAY で
     「基本給の割合」を出したときに教官の分が混ざらない。 */
  ok(icomp.c && icomp.c.m === 97 && icomp.c.o === 3 && Number(icomp.v) === 247200,
     '★教官の手当は「その他の手当（o）」に入る（賞与にも住宅にも落ちない）',
     JSON.stringify(icomp));

  /* ★審査・査察の手当（2026-08-26 その4）。教官と同じ「その他の手当（o）」。
     m（月々の支給）に混ぜると DEEP PAY の「基本給の割合」が審査の手当で汚れる。 */
  const xcomp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, null, 600)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, null, 600) v`);
  ok(xcomp.c && xcomp.c.m === 97 && xcomp.c.o === 3 && Number(xcomp.v) === 247200,
     '★審査の手当も「その他の手当（o）」に入る（教官と同じ扱い）',
     JSON.stringify(xcomp));
  /* ★教官と審査を両方入れても、片方に吸われず両方 o に積まれる。
     年額 240,000（基本給）＋7,200（教官）＋7,200（審査）＝254,400 のうち
     o は 14,400 ＝ 5.66% → 丸めて 6%。片方だけしか積まれていなければ 3% になる。 */
  const bcomp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600, 600)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600, 600) v`);
  ok(bcomp.c && bcomp.c.o === 6 && bcomp.c.m === 94 && Number(bcomp.v) === 254400,
     '★教官と審査は別々に積まれる（o に両方ぶん）', JSON.stringify(bcomp));

  /* ★管理・マネジメントの手当（2026-08-26 その6）。教官・審査・組合と同じ
     「その他の手当（o）」。m（月々の支給）に混ぜると DEEP PAY の
     「基本給の割合」が管理職の手当で汚れる。 */
  const mcomp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, null, null, null, 600)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, null, null, null, 600) v`);
  ok(mcomp.c && mcomp.c.m === 97 && mcomp.c.o === 3 && Number(mcomp.v) === 247200,
     '★管理職の手当も「その他の手当（o）」に入る（教官・審査と同じ扱い）',
     JSON.stringify(mcomp));
  /* ★4つ（教官・審査・組合・管理職）を同時に入れても互いに吸われない。
     年額 240,000（基本給）＋7,200×4 ＝ 268,800 のうち o は 28,800 ＝ 10.71% → 11%。
     どれか1つでも落ちていれば 8% 以下になる。 */
  const acomp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600, 600, 600, 600)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600, 600, 600, 600) v`);
  ok(acomp.c && acomp.c.o === 11 && acomp.c.m === 89 && Number(acomp.v) === 268800,
     '★教官・審査・組合・管理職が4つとも別々に積まれる（o に4つぶん）', JSON.stringify(acomp));

  /* ★その他の兼務・配属の手当（2026-08-27 その7）。20番目。
     教官・審査・組合・管理職と同じ「その他の手当（o）」。m に混ぜない。 */
  const ncomp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, null, null, null, null, 600)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, null, null, null, null, 600) v`);
  ok(ncomp.c && ncomp.c.m === 97 && ncomp.c.o === 3 && Number(ncomp.v) === 247200,
     '★兼務・配属の手当も「その他の手当（o）」に入る（教官・審査・管理職と同じ扱い）',
     JSON.stringify(ncomp));
  /* ★5つ（教官・審査・組合・管理職・兼務）を同時に入れても互いに吸われない。
     年額 240,000（基本給）＋7,200×5 ＝ 276,000 のうち o は 36,000 ＝ 13.04% → 13%。
     どれか1つでも落ちていれば 11% 以下になる。 */
  const a5comp = await one(`
    select public.pv_pct5(public.pv_pay_comp(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600, 600, 600, 600, 600)) c,
           public.pv_annual_total(null, 20000, null, null, null, null,
             null, null, null, null, null, null, null, null, null, 600, 600, 600, 600, 600) v`);
  ok(a5comp.c && a5comp.c.o === 13 && a5comp.c.m === 87 && Number(a5comp.v) === 276000,
     '★教官・審査・組合・管理職・兼務が5つとも別々に積まれる（o に5つぶん）', JSON.stringify(a5comp));

  /* ★REAL PAY が返すのは「帯」であって「割合」ではない。
     割合は {"m":87,"b":0,"d":0,"h":0,"o":13} という**1文字キーに整数**の形をしている。
     REAL PAY 側は {"k":"base","r":[130000,135000]} ＝ 区分名と2つの数の配列。
     ⚠️ 帯のキーに 'b' を使わないこと。使うとこの検査が当たらなくなる
        （検査は緑のまま意味を失う）。db/pay-rows.sql の listed にも同じ注意がある。 */
  const rawC = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!/"(m|b|d|h|o)":\s*\d/.test(rawC),
     '★REAL PAY の返り値に「割合」が1つも無い（割合は DEEP PAY の担当のまま）');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 8. ★引数の面が無い');
// ════════════════════════════════════════════════════════════
ok((await boom(`select pv_pay_rows('${A_M12}')`)) !== null,
   '会社を指定して呼ぶことはできない');
ok((await one(`select pronargs::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                where s.nspname='public' and p.proname='pv_pay_rows'`)).n === 0,
   '関数は引数を1つも取らない');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 9. 公開集計（pay_benchmarks）の5人未満ルールは今も生きている');
// ════════════════════════════════════════════════════════════
ok((await one(`select pg_get_viewdef('public.pay_benchmarks'::regclass) like '%>= 5%' b`)).b,
   '★一覧の門を外しても、集計側の5人未満ルールは緩めていない');

// ════════════════════════════════════════════════════════════
console.log('\n▼ 10. ★常識の幅（打ち間違いだけを落とす）');
// ════════════════════════════════════════════════════════════
/* ★これは外した p10-p90 のクリップとは別物。クリップは「同じ区分の実データに寄せる」＝
   本物の値を書き換える処理だった。こちらは固定の幅で、実在しうる年収は1つも落ちない。
   落ちるのは打ち間違いだけ。幅を狭めると本物の高給・訓練生の低給が消えるので狭めないこと。 */
{
  const band = only(R, x => x.airline === A_BAND);
  ok(band.length === 1, '★3人のうち、打ち間違いの2人は出ない', `= ${band.length}行`);
  ok(Number(band[0]?.annual_usd) === 15000 * 12,
     '　残るのは普通の額の1人だけ', JSON.stringify(band));
  ok((await one(`select count(*)::int c from pay_reports where airline = $1`, [A_BAND])).c === 3,
     '　（元の表には3行とも残っている＝消していない、出さないだけ）');
  const amounts = R.map(x => Number(x.annual_usd));
  ok(amounts.every(v => v >= 10000 && v <= 700000),
     '★画面に出る額がすべて年 $10,000〜$700,000 の中',
     JSON.stringify(amounts.filter(v => v < 10000 || v > 700000)));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 11. ★登録前の預かりも出る（そして二重に出ない）');
// ════════════════════════════════════════════════════════════
/* 給与は会員登録の前にも出せる。出した人の多くはそのあと登録しない＝本棚に移らない。
   本番で実際に、出した11件のうち7件が移らないまま寝ていた。
   出してくれたのに1行も出ないのは Give & Get の約束と食い違うので、ここも一覧に出す。 */
{
  const pd = only(R, x => x.airline === A_PEND);
  ok(pd.length === 2, '★預かりも行になる（同じ日の同じ人は1行に畳んで2人ぶん）',
     `= ${pd.length}行`);
  ok((await one(`select count(*)::int c from pay_reports_pending where airline = $1`, [A_PEND])).c === 3,
     '　（預かりの表には3行入っている＝同じ人の2件が畳まれている）');
  const folded = pd.find(x => Number(x.annual_usd) !== 20000 * 12);
  ok(Number(folded?.annual_usd) === pv2((15000 * 12 + 17000 * 12) / 2),
     '　畳んだ人は2か月の中央値（どちらの月とも違う額）になる', JSON.stringify(pd.map(x => x.annual_usd)));
  ok(pd.every(x => x.verified === false),
     '★預かりに ✓ Verified は付かない（明細検証の経路を通っていない）');

  ok(only(R, x => x.airline === A_CLAIMED).length === 0,
     '★本棚へ移した預かりは出ない（同じ人が二重に出ない）');
  ok(only(R, x => x.airline === A_NULLIP).length === 0,
     '　IP が取れなかった預かりは出ない（誰の行かまとめられない）');
  ok(only(R, x => x.airline === 'zzz-bogus').length === 0,
     '　語彙に無い会社コードの預かりは出ない（画面の辞書に無い）');
  ok((await one(`select count(*)::int c from pay_reports_pending`)).c === 7,
     '　（預かりの表そのものは7行のまま＝消していない、出さないだけ）');

  const raw2 = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!raw2.includes('iph-') && !raw2.includes('claim_token') && !raw2.includes('ip_day_hash'),
     '★預かり証・回線のハッシュが返り値に1文字も無い');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12. ★預かりの年換算が、本棚に入れたときと1円まで一致する');
// ════════════════════════════════════════════════════════════
/* pv_pending_usd は年換算＋USD換算の2つめの実装になる（本棚は列に持っている）。
   定義そのもの（pv_annual_total）は共有しているが、payload の読み方と
   レートの掛け方はここが2つめ。片方だけ直されると静かにズレるので、
   同じ payload を submit_pay_report にも通して突き合わせる。 */
{
  const CROSS = [
    { m: 1,  label: '総支給だけ',           p: { gross_monthly: 15000 } },
    { m: 2,  label: '内訳だけ',             p: { base_pay: 9000, transport: 300, command_pay: 800,
                                                 other_allowance: 200, bonus_annual: 20000 } },
    { m: 3,  label: '時給＋保証時間＋実績', p: { hourly_rate: 200, guaranteed_hours: 75,
                                                 block_hours: 82, per_diem: 1200 } },
    { m: 4,  label: '住宅（手当）',         p: { base_pay: 9000, housing_type: 'allowance',
                                                 housing_amount: 2500 } },
    { m: 5,  label: '住宅（現物・足さない）', p: { base_pay: 9000, housing_type: 'provided',
                                                 housing_amount: 2500 } },
    { m: 6,  label: '★総支給と内訳の両方（内訳を捨てる側）',
                                            p: { gross_monthly: 15000, base_pay: 9000, transport: 300,
                                                 command_pay: 800, other_allowance: 200, per_diem: 1000,
                                                 housing_type: 'allowance', housing_amount: 2000 } },
    { m: 7,  label: 'ボーナスが出た月',     p: { gross_monthly: 40000, bonus_month: 25000 } },
    { m: 8,  label: '利益分配',             p: { base_pay: 9000, profit_share_annual: 5000 } },
    { m: 9,  label: '空文字が混ざる',       p: { gross_monthly: 15000, base_pay: '', transport: '',
                                                 housing_amount: '', bonus_annual: '' } },
    { m: 10, label: '円（レートを掛ける）', p: { currency: 'JPY', gross_monthly: 900000 } },
    { m: 11, label: 'ユーロ',               p: { currency: 'EUR', base_pay: 9000, bonus_annual: 15000 } },
    /* ★2026-08-26 に足した2列。どちらも「内訳だけの行」でしか効かない
       （総支給がある行は pv_annual_total が内訳を一切見ない）。
       だから内訳だけの形と、総支給と両方ある形の2通りを通す。 */
    { m: 12, label: '保証給（内訳だけ）',   p: { base_pay: 9000, guarantee_pay: 2000 } },
    /* 月は1〜12しか無く上で使い切ったので、ここから先は別の会社で数える
       （行の引き当ては「会社＋月」で、年では絞っていない）。 */
    { m: 1,  a: A_CROSS2, label: '★教官の手当（内訳だけ）',
                                            p: { base_pay: 9000, instructor_pay: 600 } },
    { m: 2,  a: A_CROSS2, label: '★教官の手当（総支給がある＝効かない側）',
                                            p: { gross_monthly: 15000, base_pay: 9000, instructor_pay: 600 } },
    { m: 3,  a: A_CROSS2, label: '★審査の手当（内訳だけ）',
                                            p: { base_pay: 9000, examiner_pay: 400 } },
    /* ★組合の手当。内訳だけの行では今までどおり無条件に足す。 */
    { m: 4,  a: A_CROSS2, label: '★組合の手当（内訳だけ）',
                                            p: { base_pay: 9000, union_pay: 1000 } },
    /* ★組合だけは総支給がある行でも効く（2026-09-02）。組合が直接払ったお金は
       会社の明細に印字されない＝本人が書いた総支給の中に無いため。
       ⚠️ 預かりと本棚で判定の書き方が違う（本棚は検品済みの v_items、預かりは
          payload を直に読む）。ここが2つとも pv_union_outside_gross を呼んでいる
          ことを、この2件が1円まで突き合わせて確かめる。 */
    { m: 11, a: A_CROSS2, label: '★組合の手当（総支給あり・支給元＝組合＝効く側）',
                                            p: { gross_monthly: 15000, union_pay: 1000,
                                                 pay_items: { v: 1, union: { days: 5, extra: 'yes',
                                                              source: 'union', amount: 1000 } } } },
    { m: 12, a: A_CROSS2, label: '★組合の手当（総支給あり・支給元＝会社＝効かない側）',
                                            p: { gross_monthly: 15000, union_pay: 1000,
                                                 pay_items: { v: 1, union: { days: 5, extra: 'yes',
                                                              source: 'airline', amount: 1000 } } } },
    /* ★管理・マネジメントの手当（2026-08-26 その6）。組合と違い、SQL 側は
       支給元の条件を持たない（条件つきなのは画面の突き合わせだけ）。 */
    { m: 6,  a: A_CROSS2, label: '★管理職の手当（内訳だけ）',
                                            p: { base_pay: 9000, management_pay: 5000 } },
    { m: 7,  a: A_CROSS2, label: '★管理職の手当（総支給がある＝効かない側）',
                                            p: { gross_monthly: 15000, base_pay: 9000, management_pay: 5000 } },
    { m: 5,  a: A_CROSS2, label: '★教官・審査・組合・管理職が4つとも（内訳だけ）',
                                            p: { base_pay: 9000, instructor_pay: 600,
                                                 examiner_pay: 400, union_pay: 1000,
                                                 management_pay: 5000 } },
    /* ★その他の兼務・配属の手当（2026-08-27 その7）。管理職と同じで条件を持たない。 */
    { m: 8,  a: A_CROSS2, label: '★兼務・配属の手当（内訳だけ）',
                                            p: { base_pay: 9000, nonline_pay: 3000 } },
    { m: 9,  a: A_CROSS2, label: '★兼務・配属の手当（総支給がある＝効かない側）',
                                            p: { gross_monthly: 15000, base_pay: 9000, nonline_pay: 3000 } },
    { m: 10, a: A_CROSS2, label: '★5つとも同時（教官・審査・組合・管理職・兼務）',
                                            p: { base_pay: 9000, instructor_pay: 600,
                                                 examiner_pay: 400, union_pay: 1000,
                                                 management_pay: 5000, nonline_pay: 3000 } },
    // ★レートの無い通貨は本棚側では作れない（currency に語彙の外部キーがある）。
    //   預かりは payload を寝かせるだけなので作れる。だから下で片側だけ見る。
  ];
  const u = ++seat; await asUser(u);
  for (const c of CROSS) {
    const air = c.a || A_CROSS;
    const payload = { ...BASE, airline: air, position: 'cap', fleet: 'b777',
                      period_year: YEAR, period_month: c.m, ...c.p };
    await submit(payload);
    const stored = (await one(
      `select annual_total_usd v from pay_reports where airline = $1 and period_month = $2`,
      [air, c.m])).v;
    const derived = (await one(`select pv_pending_usd($1::jsonb) v`, [JSON.stringify(payload)])).v;
    const same = (stored === null && derived === null)
              || (stored !== null && derived !== null && Number(stored) === Number(derived));
    ok(same, `${c.label}`, `本棚 ${stored} ≠ 預かり ${derived}`);

    /* ★内訳も同じ。pv_pending_comp は payload の読み方をもう一度書いている
       （額の pv_pending_usd とは別の関数）。片方だけ直されると静かにズレるので、
       同じ1件を本棚の列から作った割合と突き合わせる。 */
    const cmp = await one(`
      select public.pv_pending_comp($1::jsonb)::text a,
             (select public.pv_pay_comp(gross_monthly, base_pay, hourly_rate,
                       guaranteed_hours, block_hours, per_diem, housing_type,
                       housing_amount, transport, command_pay, other_allowance,
                       bonus_annual, profit_share_annual, bonus_month,
                       /* ★2026-08-26〜27 に足した6列。ここに渡し忘れると、本棚の側だけ
                          その額を持たない図になり、預かりと静かにズレる。 */
                       guarantee_pay, instructor_pay, examiner_pay, union_pay,
                       management_pay, nonline_pay)::text
                from pay_reports where airline = $2 and period_month = $3) b`,
      [JSON.stringify(payload), air, c.m]);
    ok(cmp.a === cmp.b, `　${c.label}（内訳の割合も一致）`,
       `預かり ${cmp.a} ≠ 本棚 ${cmp.b}`);
  }
  /* ★上の2件（月11・月12）は payload が支給元しか違わない。両方が同じ額のままだと
     「1円まで一致」は通るのに直っていないので、差そのものも見る。
     組合1,000×12 = 12,000（原本通貨）ぶんだけ月11 が大きいこと。 */
  const uog = await one(
    `select (select annual_total_orig from pay_reports where airline=$1 and period_month=11) a,
            (select annual_total_orig from pay_reports where airline=$1 and period_month=12) b`,
    [A_CROSS2]);
  ok(Number(uog.a) - Number(uog.b) === 12000,
     '★支給元が組合の行だけ、総支給があっても年換算が組合の分だけ大きい',
     `組合払い ${uog.a} − 会社払い ${uog.b}（期待 12000 差）`);

  const noFx = (await one(`select pv_pending_usd($1::jsonb) v`, [JSON.stringify(
    { ...BASE, currency: 'ZZZ', airline: A_CROSS, position: 'cap', fleet: 'b777',
      period_year: YEAR, period_month: 1, gross_monthly: 15000 })])).v;
  ok(noFx === null, '★レートの無い通貨は null（本棚の annual_total_usd と同じ扱い）', String(noFx));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-b. ★数え上げ（画面の上に並ぶ数字のうち、サーバから来る2つ）');
// ════════════════════════════════════════════════════════════
/* 2026-08-24 オーナー判断で「本当の数字だけ出す」ことになった。
   画面の4枚のうち2枚（表の行数・会社数）は rows を数えれば出るので、
   サーバが返すのは残り2つ（提出の件数・直近1ヶ月のぶん）だけ。

   ★いちばん大事なのは「行と同じ材料から数えていること」。
     別のところから数え直すと、画面に「126件」と出ているのに表が60行しかない
     理由を誰も説明できなくなる。だから下は全部**差分**で見る。 */
await asViewer();
{
  const s0 = await payRows();
  ok(s0.stats && typeof s0.stats === 'object' && !Array.isArray(s0.stats),
     '数え上げが返ってくる', JSON.stringify(s0.stats));
  ok(Number.isInteger(s0.stats.reports) && Number.isInteger(s0.stats.month),
     '2つとも整数（小数や文字列で返さない）', JSON.stringify(s0.stats));
  ok(s0.stats.reports >= s0.rows.length,
     '★件数は必ず表の行数以上（1人が何ヶ月ぶん出しても行は1つ）',
     `件数 ${s0.stats.reports} / 行 ${s0.rows.length}`);
  ok(s0.stats.reports - s0.rows.length >= 33,
     '　複数月を出した人のぶんだけ、件数のほうが多い（36件が3行に畳まれている）',
     `差 ${s0.stats.reports - s0.rows.length}`);
  ok(s0.stats.month <= s0.stats.reports, '　直近1ヶ月のぶんは件数を超えない');

  const b = { r: s0.stats.reports, m: s0.stats.month, n: s0.rows.length };

  // ① 新しい1人が1か月ぶん出す → 件数 +1・行 +1
  const U = await person(A_STAT, 'cap', [{ fleet: 'b777', month: 1, gross: 15000 }]);
  await asViewer();
  let t = await payRows();
  ok(t.stats.reports === b.r + 1 && t.rows.length === b.n + 1,
     '1人が1件出すと 件数 +1・行 +1', `件数 ${t.stats.reports} / 行 ${t.rows.length}`);
  ok(t.stats.month === b.m + 1, '　直近1ヶ月のぶんも +1', String(t.stats.month));

  // ② 同じ人がもう1か月ぶん出す → 件数だけ +1（行は増えない）
  await asUser(U);
  await submit({ ...BASE, airline: A_STAT, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2, gross_monthly: 15000 });
  await asViewer();
  t = await payRows();
  ok(t.stats.reports === b.r + 2 && t.rows.length === b.n + 1,
     '★同じ人がもう1か月出すと 件数だけ +1（行は増えない）',
     `件数 ${t.stats.reports} / 行 ${t.rows.length}`);

  /* ②-b ★窓は「暦の月」ではなく「直近1ヶ月」（2026-08-25 オーナー指示）。
        20日前に出した1件は、月の何日に走らせても必ず「直近1ヶ月」に入る。
        date_trunc('month', now()) に戻すと、**毎月20日より前に走らせた日だけ**
        この行が落ちてここが赤くなる（＝暦の月に戻したことに気づける）。 */
  await db.query(`update pay_reports set created_at = now() - interval '20 days'
                   where airline = $1 and period_month = 2`, [A_STAT]);
  t = await payRows();
  ok(t.stats.month === b.m + 2,
     '★20日前の1件も「直近1ヶ月」に入る（暦の月で数えていない）',
     `${t.stats.month} / 期待 ${b.m + 2}`);

  // ③ 打ち間違い（常識の幅の外）は、表からも件数からも落ちる
  await db.query(`update pay_reports set annual_total_usd = 0.75
                   where airline = $1 and period_month = 2`, [A_STAT]);
  t = await payRows();
  ok(t.stats.reports === b.r + 1,
     '★常識の幅の外は件数からも落ちる（表と同じ材料から数えている証拠）',
     `件数 ${t.stats.reports}`);

  // ④ 24ヶ月の窓の外も同じ
  await backdateAirline(A_STAT, 800);
  t = await payRows();
  ok(t.stats.reports === b.r && t.rows.length === b.n,
     '★24ヶ月の窓の外は件数からも落ちる', `件数 ${t.stats.reports} / 行 ${t.rows.length}`);
  ok(t.stats.month === b.m, '　直近1ヶ月のぶんにも入らない', String(t.stats.month));

  /* ⑤ 鍵が無い人に何が返るか。
        ★2026-08-25、オーナー判断でここが**反転した**。前は「数字も鍵の内側」として
          stats ごと落としていた。いまは数え上げだけ返す。
          出す前の人に「どれだけ集まっているか」が見えないと Give & Get を
          選びようがない、というのが理由。
        ⚠️ 2026-09-16 にもう一度動いた（オーナー指示）。行も返すようになった。
        ⚠️ 2026-09-18 に作り直した（オーナー指示）。上の8行は機長と副操縦士を
          交互に並べ、1人に固定の型で見せる欄を変える。勤務も内訳も今までどおり入らない。
        ⚠️ 2026-09-19（オーナー指示）。機種型にも年収を出す。9行目以降は会社と
          投稿時期 ── ただし上の8行から下がってきた人（会社型を除く）と預かりは
          投稿時期だけ。公開前から9行目以降にいた人は、ずっと会社型。 */
  await asUser(9001);
  const lk = await payRows();
  ok(lk.state === 'locked' && lk.rows.length === b.n,
     '★鍵の無い人にも行は返る（件数は開いている一覧と同じ＝抜き差ししていない）',
     `${lk.rows.length} / ${b.n}`);
  ok(typeof lk.stats === 'object' && lk.stats
     && typeof lk.stats.reports === 'number'
     && typeof lk.stats.airlines === 'number'
     && typeof lk.stats.contributors === 'number',
     '★鍵の無い人にも数え上げは返る（2026-08-25 に反転）', JSON.stringify(lk.stats));

  /* ★いちばん大事な1本。本物の返り値が「決めた形」と1行も違わないこと。
       開いた一覧（同じ人・同じ順）から組み立て直した期待値と比べる。 */
  const kOpen = await withKeys();
  const sp = maskSpec(kOpen);
  ok(lk.rows.length === sp.rows.length && !firstDiff(lk.rows, sp.rows),
     '★★伏せた一覧が決めた形と1行も違わない（8行は機長→副操縦士の交互・型ごとの欄・9行目以降は会社と時期／下がってきた人は時期だけ）',
     firstDiff(lk.rows, sp.rows));

  // ── ここから下は、上の1本が落ちたときに「何が崩れたか」を読むための検査 ──
  const nTop = (i => i < 0 ? lk.rows.length : i)(lk.rows.findIndex(x => !('t' in x)));
  ok(nTop === 8 && lk.rows.slice(nTop).every(x => !('t' in x)),
     '★型の印 t が付くのは先頭の8行だけ', String(nTop));
  ok(sp.top[0].pos === 'cap'
     && sp.top.every((x, i) => x.pos === (i % 2 ? 'fo' : 'cap'))
     && sp.top.every(x => !isPend(x)),
     '★上の8行は機長から始まる交互（この回は機長4・副操縦士4。訓練生・預かりは入らない）',
     sp.top.map(x => x.pos).join(','));
  ok(['cap', 'fo'].every(p => {
       const ks = sp.top.filter(x => x.pos === p).map(x => kOpen.indexOf(x));
       return ks.every((v, i) => i === 0 || ks[i - 1] < v);
     }),
     '★同じ職位の中は新しい順（開いた一覧の並びのまま）');
  ok(new Set(lk.rows.slice(0, nTop).map(x => x.t)).size === 3,
     '　（3つの型が全部出ている回で見ている）', lk.rows.slice(0, nTop).map(x => x.t).join(''));
  ok(lk.rows.every(x => Object.keys(x).every(k =>
       x.t ? k === 't' || MK_KEYS[x.t].includes(k) : ['airline', 'age'].includes(k))),
     '★型ごとに決めた欄の外のキーが1つも無い（9行目以降は会社と時期だけ）',
     JSON.stringify(lk.rows.find(x => Object.keys(x).some(k =>
       x.t ? k !== 't' && !MK_KEYS[x.t].includes(k) : !['airline', 'age'].includes(k)))));
  ok(!lk.rows.some(x => 'airline' in x && 'annual_usd' in x),
     '★★会社と年収が同じ行に1つも無い');
  ok(lk.rows.every(x => !('annual_usd' in x) || x.t === 'a' || x.t === 'f')
     && lk.rows.every(x => !('fleet' in x) || x.t === 'f')
     && lk.rows.every(x => !('ten' in x) || x.t === 'a'),
     '★年収は8行の中の年収型と機種型だけ、年数の段は年収型だけ、機材は機種型だけ');
  ok(lk.rows.slice(nTop).every((x, i) => ('airline' in x) === !sp.hideAir(sp.rest[i])),
     '★9行目以降で会社を伏せるのは、8行から下がってきた人（会社型を除く）と預かりだけ');
  ok(lk.rows.slice(nTop).some(x => 'airline' in x)
     && lk.rows.slice(nTop).some(x => !('airline' in x)),
     '　（9行目以降に会社の出る行と出ない行の両方がある回で見ている）');
  ok(lk.rows.slice(0, nTop).every((x, i) =>
       !('annual_usd' in x) || x.annual_usd === sp.top[i].annual_usd)
     && lk.rows.slice(0, nTop).some(x => x.t === 'f' && 'annual_usd' in x),
     '★上の8行の年収（年収型・機種型）は、開いた一覧の同じ人の値と同じ（有効数字2桁のまま）');
  ok(sp.rest.some(isPend) && sp.rest.filter(isPend).every(x =>
       canonRow(lk.rows[nTop + sp.rest.indexOf(x)]) === canonRow({ age: x.age })),
     '★預かり（登録前に出されたぶん）は8行に入らず、投稿時期だけ');
  /* ★金額以外の「読ませない」ものは、キーそのものが返り値に1つも出ないこと。 */
  const lkTxt = JSON.stringify(lk);
  ok(!/"(paylock|work|bh|dd|off|pay)"/.test(lkTxt),
     '★勤務・内訳・内訳の門のキーはどこにも無い', lkTxt.slice(0, 160));

  /* ★伏せたまま ── 8行から押し出されても、会社が出るのは会社型の人だけ。
       新しい機長4人・副操縦士4人を入れて8行を丸ごと入れ替える（入れた分は巻き戻す）。
       型を毎回引き直す作りや、8行の外で全員の会社を出す作りに戻すとここで落ちる。 */
  const vA = sp.top.find(x => sp.ty(x) === 'a');
  const vC = sp.top.find(x => sp.ty(x) === 'c');
  await db.exec('begin');
  try {
    for (let i = 0; i < 4; i++) {
      await person(A_ONE, 'cap', [{ fleet: 'b777', month: 5, gross: 15000 + i * 1000 }]);
      await person(A_ONE, 'fo',  [{ fleet: 'b777', month: 5, gross:  9000 + i * 1000 }]);
    }
    /* 預かりを1件、いちばん新しい行として置く。型は会社型を選ぶ
       （預かりは会社型でも会社を出さない ── 引き取られると匿名キーが変わって
       型が引き直され、引き取りの前後で見えた欄を足し合わせられるため）。 */
    let iph = 0;
    while (tzOf(`p:pv-test-${iph}`) !== 'c') iph++;
    await pend(A_ONE, { pos: 'cap', month: 6, gross: 20000, iph: `pv-test-${iph}` });
    await db.query(`update pay_reports_pending set created_at = now() + interval '1 minute'
                     where ip_day_hash = $1`, [`pv-test-${iph}`]);
    await asUser(9001);
    const lk2 = await payRows();
    const k2 = await withKeys();
    const sp2 = maskSpec(k2);
    const at = (v) => sp2.top.length + sp2.rest.findIndex(y => y.k === v.k);
    ok(!sp2.top.some(x => x.k === vA.k || x.k === vC.k) && at(vA) >= 8 && at(vC) >= 8,
       '　（年収型と会社型の1人ずつを8行の外へ押し出せた）');
    ok(canonRow(lk2.rows[at(vA)]) === canonRow({ age: vA.age }),
       '★★年収型の人は8行の外へ落ちても会社が出ない（投稿時期だけ）',
       JSON.stringify(lk2.rows[at(vA)]));
    ok(canonRow(lk2.rows[at(vC)]) === canonRow({ airline: vC.airline, age: vC.age }),
       '★会社型の人は8行の外では会社と投稿時期だけ（職位も出典も落ちる）',
       JSON.stringify(lk2.rows[at(vC)]));
    ok(isPend(k2[0]) && tzOf(k2[0].k) === 'c' && k2[0].pos === 'cap',
       '　（いちばん新しい1件が、会社型の機長の預かりになっている回で見ている）');
    ok(!sp2.top.includes(k2[0])
       && canonRow(lk2.rows[at(k2[0])]) === canonRow({ age: k2[0].age }),
       '★★いちばん新しい1件が預かりでも8行には入らず、会社型でも投稿時期だけ',
       JSON.stringify(lk2.rows[at(k2[0])]));
    ok(!firstDiff(lk2.rows, sp2.rows),
       '　押し出した後も決めた形と1行も違わない', firstDiff(lk2.rows, sp2.rows));
  } finally {
    await db.exec('rollback');
  }

  /* ★公開の前から9行目以降にいた人（2026-09-19）。
       この人たちは公開の時点で会社が出ている。出し直して8行に上がったときに
       本来の型（年収型・機種型）で出すと、「9行目以降から消えた会社」と
       「8行に増えた年収」が1人につながる。だから、ずっと会社型として出す。
       ── 公開の日の8行を埋める8人（機長4・副操縦士4）と、それより古い1人 X を
          公開前に置く。X は本来の型が年収型か機種型の人を選ぶ（入れた分は巻き戻す）。 */
  await db.exec('begin');
  try {
    const keyOf = async (air, usd) => (await one(
      `select distinct 'r:' || proof_hash k from pay_reports
        where airline = $1 and annual_total_usd = $2`, [air, usd])).k;
    const before = (air, usd, sec) => db.query(
      `update pay_reports set created_at = $3::timestamptz - ($4 || ' seconds')::interval
        where airline = $1 and annual_total_usd = $2`, [air, usd, LAUNCH, String(sec)]);
    let xu = 0, xk = '', xg = 0;
    for (let i = 0; i < 40 && !xu; i++) {
      const g = 31000 + i * 10;
      const u = await person(A_ONE, 'cap', [{ fleet: 'b777', month: 5, gross: g }]);
      const k = await keyOf(A_ONE, g * 12);
      if (tzOf(k) !== 'c') { xu = u; xk = k; xg = g; }
    }
    await before(A_ONE, xg * 12, 60);
    for (let i = 0; i < 4; i++) {
      await person(A_ONE, 'cap', [{ fleet: 'b777', month: 5, gross: 32000 + i * 10 }]);
      await before(A_ONE, (32000 + i * 10) * 12, 10 + i);
      await person(A_ONE, 'fo',  [{ fleet: 'b777', month: 5, gross: 12000 + i * 10 }]);
      await before(A_ONE, (12000 + i * 10) * 12, 20 + i);
    }
    /* 8行に入らない職位（訓練生）を1人。公開の後に出した人。
       ★訓練生はもう選べない（2026-09-02 から選択肢の外）ので、出してから職位を書き換える。 */
    await person(A_ONE, 'cap', [{ fleet: 'b777', month: 5, gross: 5010 }]);
    await db.query(`update pay_reports set "position" = 'cadet'
                     where airline = $1 and annual_total_usd = $2`, [A_ONE, 5010 * 12]);
    await asUser(9001);
    let lkx = await payRows();
    let spx = maskSpec(await withKeys());
    const at = (sp_, k) => (i => i < 0 ? -1 : sp_.top.length + i)(sp_.rest.findIndex(y => y.k === k));
    const X = spx.rest.find(y => y.k === xk);
    ok(!!X && !!X.l0 && !spx.top0.includes(X) && tzOf(xk) !== 'c'
       && spx.top0.length === 8 && spx.top0.every(y => y.k !== xk),
       `　（公開前からいて公開の日の8行に入らなかった1人を置けた。本来の型は ${tzOf(xk)}）`);
    ok(X && canonRow(lkx.rows[at(spx, xk)]) === canonRow({ airline: X.airline, age: X.age }),
       '★公開前から9行目以降にいた人は、本来の型が年収型・機種型でも会社と投稿時期が出る',
       X && JSON.stringify(lkx.rows[at(spx, xk)]));
    const d0 = spx.top0.filter(y => spx.rest.includes(y) && tzOf(y.k) !== 'c');
    ok(d0.length > 0 && d0.every(y => canonRow(lkx.rows[at(spx, y.k)]) === canonRow({ age: y.age })),
       '★公開の日の8行にいた人（会社型を除く）は、9行目以降では投稿時期だけ',
       `${d0.length}人`);
    const ne = spx.rest.filter(y => !eliOf(y) && !isPend(y));
    ok(ne.length > 0 && ne.every(y => canonRow(lkx.rows[at(spx, y.k)])
                                     === canonRow({ airline: y.airline, age: y.age })),
       '★8行に入らない職位（訓練生など）は、9行目以降で会社と投稿時期が出る', `${ne.length}人`);
    ok(!firstDiff(lkx.rows, spx.rows), '　公開前の人を置いても決めた形と1行も違わない',
       firstDiff(lkx.rows, spx.rows));

    // X が別の月を出し直す → いちばん新しい機長として8行に上がる
    await asUser(xu);
    await submit({ ...BASE, airline: A_ONE, position: 'cap', fleet: 'b777',
                   period_year: YEAR, period_month: 6, gross_monthly: xg });
    await asUser(9001);
    lkx = await payRows();
    spx = maskSpec(await withKeys());
    const ix = spx.top.findIndex(y => y.k === xk);
    ok(ix === 0, '　（出し直した X が8行の先頭＝いちばん新しい機長になった）', String(ix));
    const X2 = spx.top[ix] || {};
    ok(ix >= 0 && canonRow(lkx.rows[ix]) === canonRow(
         { airline: X2.airline, pos: X2.pos, verified: X2.verified, age: X2.age, t: 'c' }),
       '★★公開前から会社が出ていた人は、8行に上がっても会社型（年収も機材も年数も出ない）',
       JSON.stringify(lkx.rows[ix]));
    ok(!firstDiff(lkx.rows, spx.rows), '　出し直した後も決めた形と1行も違わない',
       firstDiff(lkx.rows, spx.rows));
  } finally {
    await db.exec('rollback');
  }

  /* ★未ログインと「登録しただけの人」で返り値が1バイト違わないこと。
       片方だけ広げると、伏せ方が2通りになって片方を直し忘れる。
       （口コミだけ出した人は、口コミを置いた後の 12-c で見る） */
  await asUser(9001);
  const lk3 = await payRows();
  await asAnon();
  const anon2 = await payRows();
  ok(JSON.stringify(anon2.rows) === JSON.stringify(lk3.rows)
     && JSON.stringify(lk3.rows) === JSON.stringify(lk.rows),
     '★未ログインと「鍵の無いログイン済み」で行がまったく同じ（巻き戻した後も元のまま）',
     JSON.stringify(anon2.rows).slice(0, 120));
  await asViewer();
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-c. ★昔の口コミに書かれた給与も一覧に混ざる');
// ════════════════════════════════════════════════════════════
/* 口コミの持ち主キーは submit-review.html が作る。塩をここに書き写すと、
   あちらを直したときにテストだけ通り続けて本番が黙って壊れる。
   だから**あちらから読み取って**、db/pay-rows.sql が同じ塩を使っていることも見る。 */
const SR = read('submit-review.html');
const SALT = SR.match(/encode\(\s*userId \+ '([^']+)' \+ airline \+ '([^']+)'\s*\)/);
ok(!!SALT, '口コミの持ち主キーの作り方を submit-review.html から読み取れた');
const PR_SRC = read('db/pay-rows.sql');
ok(!!SALT && PR_SRC.includes(`'${SALT[1]}'`) && PR_SRC.includes(`'${SALT[2]}'`),
   '★対応表が口コミと同じ塩を使っている（片方だけ直すとここで落ちる）',
   SALT ? `${SALT[1]} / ${SALT[2]}` : '');

const { createHash } = await import('node:crypto');
const revHash = (u, air) =>
  createHash('sha256').update(uid(u) + SALT[1] + air + SALT[2]).digest('hex');

/* 口コミを1件置く。金額は万円で入る（口コミは原本通貨を持たない）。 */
let revSeat = 3000;
const review = async (air, pos, cols, days = 5) => {
  const u = ++revSeat;
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(u), `r${u}@example.com`]);
  await db.query(
    `insert into reviews_v2(proof_hash, airline, "position", annual_salary, base_annual,
                            flight_allowance_annual, monthly_salary, bonus, created_at)
     values($1,$2,$3,$4,$5,$6,$7,$8, now() - ($9 || ' days')::interval)`,
    [revHash(u, air), air, pos, cols.ann ?? null, cols.base ?? null, cols.fa ?? null,
     cols.mon ?? null, cols.bon ?? null, String(days)]);
  return u;
};

/* 同じ人が給与明細も出している会社。明細が採られて口コミが落ちるはず。 */
const dupUid = await person(A_RV_DUP, 'cap', [{ fleet: 'b777', month: 4, gross: 10000 }]);
await db.query(
  `insert into reviews_v2(proof_hash, airline, "position", monthly_salary, bonus)
   values($1,$2,'captain',100,200)`, [revHash(dupUid, A_RV_DUP), A_RV_DUP]);

await review(A_RV_MON,  'captain', { mon: 100, bon: 200 });   // 月給×12＋賞与 = 1400万
await review(A_RV_ANN,  'fo',      { ann: 3000, mon: 999 });  // 総額が最優先 = 3000万
await review(A_RV_SUM,  'captain', { base: 2000, fa: 500, bon: 300 }); // 合算 = 2800万
await review(A_RV_NONE, 'fo',      {});                        // 金額が無い＝一覧に出ない

/* 対応表は pay-rows.sql を流したときに埋まる。口コミを足したので流し直す。
   ★ここで冪等性も一緒に確かめている（何度流しても同じ）。 */
await db.exec(read('db/pay-rows.sql'));

const JPY = Number((await one(`select to_usd from fx_rates where code = 'JPY'`)).to_usd);
const man2usd = (man) => pv2(Math.round(man * 10000 * JPY * 100) / 100);

await asViewer();
const RV = (await payRows()).rows;
const pick = (air) => only(RV, x => x.airline === air);

ok(pick(A_RV_MON).length === 1 && pick(A_RV_MON)[0].annual_usd == man2usd(1400),
   '月給×12＋賞与の口コミが1行になる（口コミカードと同じ式）',
   JSON.stringify(pick(A_RV_MON)));
ok(pick(A_RV_ANN).length === 1 && pick(A_RV_ANN)[0].annual_usd == man2usd(3000),
   '総額が入っている口コミは総額を採る（月給を足さない）',
   JSON.stringify(pick(A_RV_ANN)));
ok(pick(A_RV_SUM).length === 1 && pick(A_RV_SUM)[0].annual_usd == man2usd(2800),
   '基本給＋乗務手当＋賞与の口コミも1行になる',
   JSON.stringify(pick(A_RV_SUM)));
ok(pick(A_RV_NONE).length === 0, '金額の無い口コミは一覧に出ない');
ok(pick(A_RV_MON).every(x => x.verified === false),
   '★口コミ由来の行は verified が false（明細の裏付けは無い）');
ok(pick(A_RV_MON)[0].pos === 'cap' && pick(A_RV_SUM)[0].pos === 'cap',
   "★古い職位コード（captain）が cap に寄る", JSON.stringify(pick(A_RV_MON)[0]));

ok(pick(A_RV_DUP).length === 1 && pick(A_RV_DUP)[0].verified === false
   && pick(A_RV_DUP)[0].annual_usd == pv2(10000 * 12),
   '★同じ人が明細も出していたら明細を採り、口コミ側は落ちる（1行のまま）',
   JSON.stringify(pick(A_RV_DUP)));

ok((await one(`select count(*)::int n from pv_review_person`)).n === 4,
   '★対応表に入るのは金額を持つ口コミだけ（4件）',
   String((await one(`select count(*)::int n from pv_review_person`)).n));
ok(!(await one(`select has_table_privilege('anon','public.pv_review_person','select') b`)).b
   && !(await one(`select has_table_privilege('authenticated','public.pv_review_person','select') b`)).b,
   '★対応表は anon にも会員にも開いていない');

/* ★2026-09-14、オーナー指示で「昔の口コミに給与を書いただけの人」も
     DEEP PAY の分子（pv_deep_contributors）に数えるようにした。
     その人の給与は**上の表に1行出ている**のに、人数からは落ちていた
     ──「52件あるのに35人しか居ない」の、説明のつかないぶんがこれ。
   ⚠️ 静かに壊れる形。抜けても画面は普通に動き、数だけが小さく出る。
   ★会社は上で使い終えた2社を borrow する（1352行の SKIP に入っていて、
     ここから先はどの検査も件数を見ていない）。人は review() が毎回新しく作る。 */
{
  const heads = async () => Number((await one(`select pv_deep_contributors() n`)).n);
  const h0 = await heads();

  // (a) 金額つきの口コミを1件だけ足す → 人数が1つ増える
  const ru = await review(A_RV_MON, 'captain', { ann: 1800 });
  await db.exec(read('db/pay-rows.sql'));
  const h1 = await heads();
  ok(h1 === h0 + 1,
     '★口コミに給与を書いただけの人が、1人として人数に入る（2026-09-14）',
     `${h0} → ${h1}`);

  // (b) 金額の無い口コミしか書いていない人は数えない（表にも1行も出ていない）
  await review(A_RV_NONE, 'fo', {});
  await db.exec(read('db/pay-rows.sql'));
  ok((await heads()) === h1,
     '★金額の無い口コミしか書いていない人は数えない（表に出ていないため）',
     `${h1} → ${await heads()}`);

  /* (c) 口コミと給与の**両方**を出した人は1人。増えるのは1つだけ。
       ★給与のほうは A_RV_DUP（口コミ用ではない社）に出す。上の12-e(b) は
         口コミ用の社を突き合わせから外しているので、あちらに本棚の行を作らない。
       ★会社が違っても同じ人としてまとまること自体が、ここで見たいこと
         （proof_hash は 本人×会社 で1つなので、素直に数えると2になる）。 */
  const ru2 = await review(A_RV_MON, 'captain', { ann: 1900 });
  await asUser(ru2);
  await submit({ ...BASE, airline: A_RV_DUP, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 5, gross_monthly: 12000 });
  await db.exec(read('db/pay-rows.sql'));
  ok((await heads()) === h1 + 1,
     '★★口コミと給与の両方を出した人は1人（会社が違っても二重に数えない）',
     `${h1} → ${await heads()}`);
  await asViewer();
}

/* ★口コミだけ出した人（口コミでは給与の鍵は開かない）にも、未ログインと
     1バイトも違わない一覧が返ること。12-b では口コミがまだ無かったので、ここで見る。
     口コミから来た行が上の8行に入っても、決めた形は崩れないことも一緒に見る。 */
{
  await asUser(3001);
  const rv = await payRows();
  await asAnon();
  const an = await payRows();
  ok(rv.state === 'locked' && an.state === 'locked'
     && JSON.stringify(rv.rows) === JSON.stringify(an.rows),
     '★★口コミだけ出した人と未ログインで、返る行がまったく同じ',
     `${rv.state} / ${an.state}`);
  const sp3 = maskSpec(await withKeys());
  ok(!firstDiff(an.rows, sp3.rows),
     '　口コミから来た行が混ざっても、伏せた一覧は決めた形のまま', firstDiff(an.rows, sp3.rows));
  await asViewer();
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-d. ★投稿の時期は5段の粗い区分だけ');
// ════════════════════════════════════════════════════════════
/* 段の境目。1ヶ月／3ヶ月／6ヶ月／1年 の内と外に、余裕を持たせて置く。
   ★段は「その人のいちばん新しい提出」から決まる。 */
const AGE_CASES = [[20, 0], [40, 1], [100, 2], [200, 3], [400, 4]];
for (const [days, want] of AGE_CASES) {
  const u = await review(A_AGE, 'fo', { ann: 1000 + days }, days);
  ok(true, `　${days}日前の口コミを1件置いた（uid ${u % 1000}）`);
}
await db.exec(read('db/pay-rows.sql'));
await asViewer();
{
  const got = only((await payRows()).rows, x => x.airline === A_AGE)
    .map(x => x.age).sort((a, b) => a - b);
  ok(JSON.stringify(got) === JSON.stringify(AGE_CASES.map(c => c[1])),
     '★20/40/100/200/400日前が 0/1/2/3/4 の段に分かれる', JSON.stringify(got));
}
{
  /* 同じ人が古い月と新しい月を出していたら、新しいほうの段になる。 */
  const u = await person(A_OLD, 'fo', [{ fleet: 'b737', month: 6, gross: 4000 }]);
  await db.query(`update pay_reports set created_at = now() - interval '400 days'
                   where airline = $1 and created_at > now() - interval '1 day'`, [A_OLD]);
  await asUser(u);
  await submit({ ...BASE, airline: A_OLD, position: 'fo', fleet: 'b737',
                 period_year: YEAR, period_month: 7, gross_monthly: 4000 });
  await asViewer();
  const row = only((await payRows()).rows, x => x.airline === A_OLD && x.pos === 'fo');
  ok(row.length === 1 && row[0].age === 0,
     '★同じ人の古い月と新しい月は1行に畳まれ、段は新しいほうになる', JSON.stringify(row));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-e. ★段が「その人の本当の投稿日」と1つずつ合っている');
// ════════════════════════════════════════════════════════════
/* ★オーナー指示（2026-08-25）「投稿時期の列はちゃんと本人の投稿時期と
   正確にあってるかも一緒に検証して」。
   上の 12-d は「20日前は0、40日前は1」のように、境目から離れたところしか見ていない。
   ここでは (a) 境目そのものの内と外 (b) 一覧に出ている行を1つずつ生のテーブルと
   突き合わせる、の2つを見る。 */
{
  /* (a) 境目。「1ヶ月」はカレンダー基準（2月と8月で長さが違う）なので、
     日数ではなく**同じ interval を使って** 6時間だけ内と外にずらす。
     8人ぶんを金額で見分けられるようにしてある（丸めても重ならない額）。 */
  const IV = [['1 month', 0, 1], ['3 months', 1, 2], ['6 months', 2, 3], ['12 months', 3, 4]];
  const want = [];
  let g = 10000;
  for (const [iv, inner, outer] of IV) {
    for (const side of ['in', 'out']) {
      await person(A_EDGE, 'cap', [{ fleet: 'b777', month: 11, gross: g }]);
      const off = side === 'in' ? `interval '${iv}' - interval '6 hours'`
                                : `interval '${iv}' + interval '6 hours'`;
      await db.query(`update pay_reports set created_at = now() - (${off})
                       where airline = $1 and annual_total_usd = $2`, [A_EDGE, g * 12]);
      want.push({ usd: pv2(g * 12), age: side === 'in' ? inner : outer, iv, side });
      g += 1000;
    }
  }
  await asViewer();
  const got = only((await payRows()).rows, x => x.airline === A_EDGE);
  ok(got.length === 8, '境目に置いた8人が8行として出る', `= ${got.length}行`);
  for (const w of want) {
    const row = got.find(x => Number(x.annual_usd) === w.usd);
    ok(!!row && row.age === w.age,
       `　★${w.iv} の${w.side === 'in' ? '内側' : '外側'}6時間 → 段 ${w.age}`,
       row ? `= ${row.age}` : '行が見つからない');
  }
}
{
  /* (b) 一覧に出ている行を1つずつ、生の pay_reports から数え直したものと突き合わせる。
     関数の中の CTE を通らずに、テーブルから直接「人ごとのいちばん新しい提出」を出す。
     ・group by を間違えている（別の人の日付を貼っている）
     ・max ではなく min を見ている（初回の日付が出ている）
     ・口コミや預かりと取り違えている
     このどれが起きても、ここで金額と段の組が食い違う。
     ★預かり（人の単位が違う）と、打ち込まれた社名の行（12-e(a) の担当）は外す。 */
  const SKIP = [A_PEND, A_CLAIMED, A_NULLIP, 'other',
                A_RV_MON, A_RV_ANN, A_RV_SUM, A_RV_NONE, A_RV_FREE, A_AGE];
  const exp = await rows(`
    select r.airline,
           r."position" as pos,
           public.pv_sig2((percentile_cont(0.5) within group
             (order by r.annual_total_usd))::numeric) as usd,
           case when max(r.created_at) >= now() - interval '1 month'   then 0
                when max(r.created_at) >= now() - interval '3 months'  then 1
                when max(r.created_at) >= now() - interval '6 months'  then 2
                when max(r.created_at) >= now() - interval '12 months' then 3
                else 4 end as age
      from pay_reports r
     where r.annual_total_usd is not null
       and r.annual_total_usd between 10000 and 700000
       and r.created_at >= now() - interval '24 months'
       and r.airline <> 'other'
     group by r.proof_hash, r.airline, r."position"
  `);
  const key = (x) => `${x.airline}/${x.pos}/${Number(x.usd ?? x.annual_usd)}/${x.age}`;
  const mine = only((await payRows()).rows, x => !SKIP.includes(x.airline));
  const A = exp.map(key).sort();
  const B = mine.map(key).sort();
  ok(A.length === B.length && A.join('|') === B.join('|'),
     `★${B.length}行すべて、段が生のテーブルの「その人の最新の提出」と一致する`,
     A.join('|') === B.join('|') ? ''
       : `違い: ${A.filter(x => !B.includes(x)).slice(0, 3).join(' , ')}`);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-f. ★打ち込まれた社名を「知っている航空会社」に寄せる');
// ════════════════════════════════════════════════════════════
/* ★オーナー指示（2026-08-25）「REAL PAY の『その他の航空会社』ってなに？
   失礼じゃない？ちゃんと航空会社名書いて」。
   打ち込まれた文字列は外に出せない（準識別子になる）ので、語彙に当ててから出す。
   当たれば本当の社名、当たらなければ 'other'。 */
{
  const typeIn = async (air, typed) => {
    const u = ++seat; await asUser(u);
    await submit({ ...BASE, airline: 'other', airline_other: typed, position: 'cap',
                   fleet: 'b737', period_year: YEAR, period_month: 12, gross_monthly: 15000 });
    return u;
  };
  await typeIn(A_NM_JA,   nameOf(A_NM_JA).name_ja);              // 和名そのまま
  await typeIn(A_NM_EN,   nameOf(A_NM_EN).name_en.toUpperCase()); // 英名・大文字
  await typeIn(A_NM_CODE, ' ' + A_NM_CODE.replace(/-/g, ' ') + ' '); // コード・空白とハイフンのゆれ

  await asViewer();
  const RR = (await payRows()).rows;
  for (const [air, how] of [[A_NM_JA, '和名'], [A_NM_EN, '英名（大文字）'],
                            [A_NM_CODE, 'コード（空白・ハイフンのゆれ）']]) {
    ok(only(RR, x => x.airline === air).length === 1,
       `★「その他」に${how}を打った人が、その航空会社の行として出る（${air}）`,
       `= ${only(RR, x => x.airline === air).length}行`);
  }
  ok(only(RR, x => x.airline === 'other').length === 2,
     "★語彙に無い社名を打った人は 'other' のまま（画面が「一覧にない航空会社」と書く）",
     `= ${only(RR, x => x.airline === 'other').length}行`);
  const raw2 = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!raw2.includes(OTHER_NAME) && !raw2.toLowerCase().includes('somewhere'),
     '★寄せたあとも、打ち込まれた文字列そのものは1文字も返っていない');
  ok(!(await one(`select has_function_privilege('anon','public.pv_airline_resolve(text)','execute') b`)).b
     && !(await one(`select has_function_privilege('authenticated','public.pv_airline_resolve(text)','execute') b`)).b,
     '★社名を寄せる関数は誰にも開いていない（総当たりで語彙を舐められない）');
  ok((await one(`select public.pv_airline_resolve($1) c`, ['ぜんぜん違う会社'])).c === 'other'
     && (await one(`select public.pv_airline_resolve($1) c`, [''])).c === 'other'
     && (await one(`select public.pv_airline_resolve(null) c`)).c === 'other',
     "★当たらない・空・null はすべて 'other'（前方一致や部分一致で当てない）");
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-x. 年収の無い運航会社（小規模・チャーター・ビジネスジェット）');
/* ★2026-09-13。会社の一覧が年収の唯一の正（salary-data.mjs）と**同じ物**だったので、
   年収の出典が無い会社はそもそも選択肢に置けなかった。ビジネスジェットや
   チャーターのパイロットは「その他」しか道が無く、REAL PAY では
   「一覧にない航空会社」の札に置き換わっていた。
   airline-ops.mjs を**別のマスタ**として足し、gen-airline-codes.mjs が
   両方を db/airlines.generated.sql へ流し込む。ここで見るのは5つ ──
     ① 新しいコードでそのまま提出できる（pv_validate_pay_payload の active の門を通る）
     ② 既存の航空会社は今までどおり提出できる（道を塞いでいない）
     ③ ★行を1行も書き換えずに、過去の「その他」が新しい会社の行として出る
        （pay_reports.airline は other のまま・proof_hash も1文字も動かない）
     ④ 違う「一覧外」の会社が1社に混ざらない
     ⑤ 寄せても寄せなくても、打ち込まれた文字列そのものは返らない

   ⚠️ ③ が今回の土台。pv_pay_rows は**返すたびに** pv_airline_resolve を通すので、
      pv_airlines に会社が入った瞬間、過去の投稿が正しい社名で出る。
      逆に pay_reports.airline を実コードへ update すると、持ち主を割り出す4か所
      （my_pay_reports / pv_my_give / pv_my_keys / pv_pay_person_map）が
      lower(airline_other) から鍵を作り直しているので、**本人が自分の投稿を開けなくなる**。
      だからここは「行は触らない」ことそのものを検査にしている。 */
// ════════════════════════════════════════════════════════════
{
  /* 年収を持たない会社だけを取り出す。上の VOCAB（先頭49社）と重なると
     別の検査の座席を奪うので、重なった分は外す。 */
  const OPS_CODES = Object.keys(OPS).filter((c) => AIR.indexOf(c) < 0);
  ok(OPS_CODES.length >= 3,
     '年収の無い運航会社が3社以上 pv_airlines に入っている（airline-ops.mjs 経由）',
     ` = ${OPS_CODES.length}社`);
  const [O_NEW, O_RETRO, O_MIX] = OPS_CODES;

  // ── ① 新しいコードでそのまま提出できる ────────────────────
  const uNew = ++seat;
  await asUser(uNew);
  const rNew = (await submit({ ...BASE, airline: O_NEW, position: 'cap', fleet: 'b737',
                               period_year: YEAR, period_month: 11, gross_monthly: 21000 })).r;
  ok(rNew && rNew.ok === true,
     `★年収の無い会社でも、そのまま提出できる（${O_NEW}）`, JSON.stringify(rNew));

  // ── ② 既存の航空会社は今までどおり ───────────────────────
  const uOld = ++seat;
  await asUser(uOld);
  const rOld = (await submit({ ...BASE, airline: A_ONE, position: 'cap', fleet: 'b737',
                               period_year: YEAR, period_month: 10, gross_monthly: 22000 })).r;
  ok(rOld && rOld.ok === true,
     `既存の航空会社は今までどおり提出できる（${A_ONE}）`, JSON.stringify(rOld));

  // ── ③ 過去の「その他」が、行を書き換えずに正しい社名で出る ──
  /* マスタに入る**前**に打たれた投稿と同じ形を作る＝会社は other で、
     打ち込まれた社名だけが airline_other に入っている状態。 */
  const uRetro = ++seat;
  await asUser(uRetro);
  const typed = (await one(`select name_ja from pv_airlines where code = $1`, [O_RETRO])).name_ja;
  await submit({ ...BASE, airline: 'other', airline_other: typed, position: 'fo',
                 fleet: 'a320', period_year: YEAR, period_month: 9, gross_monthly: 13000 });
  const before = await one(
    `select airline, airline_other, proof_hash from pay_reports
      where airline = 'other' and lower(airline_other) = lower($1)`, [typed]);
  ok(!!before && before.airline === 'other' && before.airline_other === typed,
     '　保存された行は「その他」＋打ち込まれた社名のまま（保存の時点では寄せない）',
     JSON.stringify(before));

  await asViewer();
  const RX = (await payRows()).rows;
  ok(only(RX, (x) => x.airline === O_RETRO).length === 1,
     `★行を1行も書き換えずに、過去の「その他」が正しい会社の行として出る（${O_RETRO}）`,
     ` = ${only(RX, (x) => x.airline === O_RETRO).length}行`);

  const after = await one(
    `select airline, airline_other, proof_hash from pay_reports
      where airline = 'other' and lower(airline_other) = lower($1)`, [typed]);
  ok(!!after && after.airline === 'other' && after.airline_other === typed
     && after.proof_hash === before.proof_hash,
     '★表示のあとも行は「その他」のまま・proof_hash も動いていない（持ち主が外れない）');

  // ── ④ 違う「一覧外」の会社が1社に混ざらない ─────────────
  /* ★本番にある2件がこれ。どちらも運航区分・一般名詞であって会社名ではないので、
     マスタに入れていない（入れると別の人の給与が同じ会社の中央値に混ざる）。 */
  const uP91 = ++seat;
  await asUser(uP91);
  await submit({ ...BASE, airline: 'other', airline_other: 'Part 91 Corporate', position: 'cap',
                 fleet: 'b737', period_year: YEAR, period_month: 8, gross_monthly: 17000 });
  const uPriv = ++seat;
  await asUser(uPriv);
  await submit({ ...BASE, airline: 'other', airline_other: 'Private Airlines', position: 'cap',
                 fleet: 'b737', period_year: YEAR, period_month: 7, gross_monthly: 18000 });
  const hashes = await rows(
    `select distinct proof_hash from pay_reports
      where airline = 'other' and airline_other in ('Part 91 Corporate','Private Airlines')`);
  ok(hashes.length === 2,
     '★会社を特定できない2件は、別々の人・別々の行のまま（1社にまとめない）',
     ` = ${hashes.length}通り`);
  ok((await one(`select public.pv_airline_resolve('Part 91 Corporate') c`)).c === 'other'
     && (await one(`select public.pv_airline_resolve('Private Airlines') c`)).c === 'other',
     '★運航区分や一般名詞は寄せない（どちらも「その他」のまま）');

  // ── ⑤ 打ち込まれた文字列そのものは返らない ──────────────
  const uMix = ++seat;
  await asUser(uMix);
  const mixName = (await one(`select name_en from pv_airlines where code = $1`, [O_MIX])).name_en;
  await submit({ ...BASE, airline: 'other', airline_other: mixName.toLowerCase(), position: 'cap',
                 fleet: 'b777', period_year: YEAR, period_month: 6, gross_monthly: 19000 });
  await asViewer();
  const RY = (await payRows()).rows;
  ok(only(RY, (x) => x.airline === O_MIX).length === 1,
     `　英名を小文字で打っても寄る（${O_MIX}）`,
     ` = ${only(RY, (x) => x.airline === O_MIX).length}行`);
  const rawOps = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!rawOps.includes('Part 91 Corporate') && !rawOps.includes('Private Airlines')
     && !rawOps.includes('airline_other'),
     '★運航会社でも、打ち込まれた文字列そのものは1文字も返っていない');
}
{
  /* 口コミ側は社名の欄そのものが自由入力になりうる（submit-review.html の
     effectiveAirline）。素通しすると打ち込まれた文字列が画面に出る。 */
  await review(A_RV_FREE, 'captain', { ann: 1500 });
  await db.query(`insert into profiles(id,email) values($1,$2) on conflict do nothing`,
    [uid(3900), 'free@example.com']);
  await db.query(
    `insert into reviews_v2(proof_hash, airline, "position", annual_salary)
     values($1, $2, 'captain', 1600)`,
    [createHash('sha256').update(uid(3900) + SALT[1] + 'ぼくの会社' + SALT[2]).digest('hex'),
     'ぼくの会社']);
  await db.exec(read('db/pay-rows.sql'));
  await asViewer();
  const RF = (await payRows()).rows;
  ok(only(RF, x => x.airline === A_RV_FREE).length === 1,
     '★口コミの社名がコードのときは、そのまま その航空会社の行になる');
  const t = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!t.includes('ぼくの会社'),
     '★口コミの社名の欄に打ち込まれた文字列も、そのままでは1文字も返らない');
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-g. ★本人が何を出したか（DEEP PAY の個人条件）');
// ════════════════════════════════════════════════════════════
/* DEEP PAY が本人に開く条件は2つで、どちらも満たしたときだけ（オーナー決定・2026-08-25）。
     ① 給与を出したユニークな人が 100人 …… stats.contributors（上の 12-b）
     ② 本人が「くわしく」出している ……… ここで見る give.detailed
   ★①と②は別々に判定する。100人は Privacy Threshold ではなく、
     「DEEP PAY という機能を正式に開ける区切り」でしかない。

   ★DEEP PAY のために新しい列は1つも作っていない。総支給と内訳は 2026-08-26 から
     **両立する**ので、判定は「内訳の欄が1つでも埋まっているか」で見る。
     つまり**過去に内訳で出してくれた人は、さかのぼって条件を満たす**。 */
{
  const give = async () => (await payRows()).give;

  // (a) 一度も出していない人
  await asUser(9101);
  const g0 = await give();
  ok(g0 && g0.basic === false && g0.detailed === false && g0.payslip === false,
     '★一度も出していない人は3つとも false', JSON.stringify(g0));

  // (b) かんたん入力だけ（総支給1本）
  const uB = ++seat; await asUser(uB);
  await submit({ ...BASE, airline: A_GV_BASIC, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2, gross_monthly: 15000 });
  const gB = await give();
  ok(gB.basic === true && gB.detailed === false && gB.payslip === false,
     '★かんたん入力だけの人は basic だけ true（REAL PAY は開くが DEEP PAY の準備は未了）',
     JSON.stringify(gB));

  // (c) くわしく入力（内訳）。昔の形＝総支給の代わりに内訳を入れた人
  const uD = ++seat; await asUser(uD);
  await submit({ ...BASE, airline: A_GV_DET, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2,
                 base_pay: 9000, command_pay: 2000, per_diem: 1200,
                 transport: 300, other_allowance: 500 });
  const gD = await give();
  ok(gD.basic === true && gD.detailed === true && gD.payslip === false,
     '★内訳を出した人は detailed も true（DEEP PAY の個人条件はここで満たす）',
     JSON.stringify(gD));

  /* (c2) ★新しい形（2026-08-26）。総支給はそのまま残し、内訳は「変動給の行」で書く。
     固定・保証給は「該当なし」を選べるので base_pay が入らないことがある。
     判定を `gross_monthly is null and base_pay is not null` に戻すと、
     この人が丸ごと「内訳なし」に落ちる。画面は普通に動くので誰も気づけない。 */
  const uI = ++seat; await asUser(uI);
  await submit({ ...BASE, airline: A_GV_ITEMS, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2,
                 gross_monthly: 15000, base_pay: null, flight_variable_pay: 4000,
                 other_allowance: 4500,
                 pay_items: { v: 1, fixed_none: true,
                              variable: [{ amount: 4000, basis: 'block', label: 'Flight Pay' }],
                              other: [{ amount: 500, label: '通勤手当' }] } });
  const gI = await give();
  ok(gI.basic === true && gI.detailed === true,
     '★総支給を残したまま内訳の行を書いた人も detailed が true', JSON.stringify(gI));

  /* (c3) ★保証給だけを書いた人（2026-08-26）。米国型の会社には「基本給」という項目が
     無く、Minimum Guarantee が下限として1本立つだけのことがある。判定に
     guarantee_pay を入れ忘れると、この人が丸ごと「内訳なし」に落ちる。 */
  const uG = ++seat; await asUser(uG);
  await submit({ ...BASE, airline: A_GV_GUAR, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 2,
                 gross_monthly: 15000, base_pay: null, guarantee_pay: 8000 });
  const gG = await give();
  ok(gG.basic === true && gG.detailed === true,
     '★保証給だけを書いた人も detailed が true（基本給の無い会社を落とさない）',
     JSON.stringify(gG));

  // (d) 明細から。★読み取れた行は内訳の欄が埋まるので、detailed も自動で true になる。
  //     オーナー指示「Payslip を出した人に Detailed Form をもう一度入力させない」は
  //     特別扱いを書かなくても、この形のまま満たされる。
  const uP = ++seat; await asUser(uP);
  await submit({ ...BASE, airline: A_GV_PS, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 3,
                 base_pay: 9500, command_pay: 2100, per_diem: 1000 });
  await db.query(`update pay_reports set verify_level = 1 where airline = $1`, [A_GV_PS]);
  const gP = await give();
  ok(gP.basic === true && gP.detailed === true && gP.payslip === true,
     '★明細から出した人は3つとも true（もう一度フォームを入れさせない）',
     JSON.stringify(gP));

  // (e) 隣の人が出しても自分の条件は動かない
  await asUser(uB);
  const gB2 = await give();
  ok(gB2.basic === true && gB2.detailed === false,
     '★他人が内訳を出しても、自分の detailed は false のまま', JSON.stringify(gB2));

  // (f) 「一覧にない会社」に打ち込んだ人も、自分の行として拾える
  const uO = ++seat; await asUser(uO);
  await submit({ ...BASE, airline: 'other', airline_other: 'Nowhere Air', position: 'cap',
                 fleet: 'b737', period_year: YEAR, period_month: 4,
                 base_pay: 8800, command_pay: 1500 });
  const gO = await give();
  ok(gO.basic === true && gO.detailed === true,
     '★社名を打ち込んで出した人も、自分の条件として拾える', JSON.stringify(gO));

  // (g) 返っているのは真偽3つだけ。金額も件数も日付もここから出ない。
  const keys = Object.keys(gP).sort().join(',');
  ok(keys === 'basic,detailed,full,payslip', `★返るのは真偽4つだけ（= ${keys}）`);
  ok(Object.values(gP).every(v => typeof v === 'boolean'),
     '★4つとも真偽値（数を混ぜていない）', JSON.stringify(gP));

  // (h) 鍵が無い人にも返る。DEEP PAY の準備は REAL PAY を開ける前からできる。
  await asUser(9102);
  const lk = await payRows();
  ok(lk.state === 'locked' && lk.give && lk.give.basic === false,
     '★鍵が無い人にも give は返る（先に内訳を出した人が損をしないための表示に使う）',
     JSON.stringify(lk.give));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-h. ★DEEP PAY の札を、左メニューを持つどの画面でも同じ数にする');
// ════════════════════════════════════════════════════════════
/* 左メニュー（マイレポート／REAL PAY／DEEP PAY／VERIFIED PAY／設定）は4画面に
   同じものが出ていて、DEEP PAY を押すとどこでも同じ説明が開く。
   ところが数を持っているのは pv_pay_rows() を引く2画面だけで、残りは
   「準備中」のままだった＝**同じボタンなのに画面によって答えが違う**（2026-08-25）。

   ではなぜ全画面で pv_pay_rows() を引かないか。
   鍵を持つ人が引くと**一覧が丸ごと付いてくる**（あの関数の本体は行）。
   pv_give_progress() は札に要る2つだけを返す口で、行を1つも作らない。

   ★ここで見るのはただ1つ ── **一覧の数と札の数が必ず同じであること**。
     数え方を書き写すと静かにずれるので、両方が pv_contributors() を呼ぶ形にしてある。 */
{
  const prog = async () => (await one(`select pv_give_progress() r`)).r;

  // (a) 鍵を持つ人：一覧の数と札の数が1つも違わない
  await asViewer();
  const full = await payRows();
  const p1 = await prog();
  ok(p1 && p1.ok === true, '★札の口が返ってくる', JSON.stringify(p1));
  ok(p1.contributors === full.stats.contributors,
     '★札の人数が一覧の人数とぴったり同じ（数え方が1か所だから）',
     `札 ${p1 && p1.contributors} / 一覧 ${full.stats.contributors}`);
  ok(JSON.stringify(p1.give) === JSON.stringify(full.give),
     '★本人が何を出したかも一覧と同じ答え', JSON.stringify(p1.give));

  // (b) 鍵の無い人でも同じ。DEEP PAY の準備は REAL PAY を開ける前からできる。
  await asUser(9001);
  const lk = await payRows();
  const p2 = await prog();
  ok(p2 && p2.contributors === lk.stats.contributors,
     '★鍵の無い人でも、札の人数は一覧の数え上げと同じ',
     `札 ${p2 && p2.contributors} / 一覧 ${lk.stats.contributors}`);

  // (c) 返るのは整数1つと真偽3つだけ。行も金額も日付も社名も入らない。
  const keys = Object.keys(p2).sort().join(',');
  ok(keys === 'contributors,give,ok', `★返るのは3つだけ（= ${keys}）`);
  ok(Number.isInteger(p2.contributors), '　人数は整数', String(p2.contributors));
  ok(Object.values(p2.give).every((v) => typeof v === 'boolean'),
     '　本人の側は真偽だけ（数を混ぜていない）', JSON.stringify(p2.give));
  const txt = JSON.stringify(p2);
  ok(!/annual|usd|salary|airline|created|month|proof/i.test(txt),
     '★札の返り値に 金額・社名・日付らしき語が1つも無い', txt.slice(0, 160));
  ok(!/\d{4}-\d{2}-\d{2}/.test(txt), '　生の日付が1文字も入らない', txt.slice(0, 160));

  // (d) ログインしていない人には何も返さない（0 を置いて埋めない）
  await asAnon();
  ok((await prog()) === null,
     '★ログインしていない人には何も返さない（画面は「準備中」のまま）');

  // (e) 入口の開き方。anon には渡さない・ログインした人には渡す。
  ok(!(await one(`select has_function_privilege('anon','public.pv_give_progress()','execute') b`)).b,
     '★登録していない人（anon）は札の口を呼べない');
  ok((await one(`select has_function_privilege('authenticated','public.pv_give_progress()','execute') b`)).b,
     'ログインした人は札の口を呼べる');

  // (f) 人数の数え方そのものは、誰にも開いていない
  ok(!(await one(`select has_function_privilege('anon','public.pv_contributors()','execute') b`)).b
     && !(await one(`select has_function_privilege('authenticated','public.pv_contributors()','execute') b`)).b,
     '★人数を数える関数は誰にも開いていない（security definer の中からだけ）');

  await asViewer();
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-i. ★報酬の内訳の門（Give & Get・2026-09-03）');
// ════════════════════════════════════════════════════════════
/* オーナー指示 ──「自分の給与内訳を共有した人だけ、他人の給与内訳を見られる」。
   課金の門ではなく**相互性の門**。いちばん強い制約は
   **「ぼかすのではなく、実数そのものを返さない」**。
   DevTools でぼかしを外しても見えない ＝ 未 Unlock のブラウザには
   金額が1文字も届いていない、ということ。★ここが落ちたら画面を作ってはいけない。

   ⚠️ 経過措置の締切は pv_my_give の中の**定数**。この検査を書いた日
      （2026-09-03）は、いま作る行が全部その締切より前に入ってしまうので、
      **時計に頼らず投稿時刻を明示する**。時計に頼ると、日付が変わった翌日に
      「厳密3項目」の検査だけが静かに意味を失う。 */
{
  /* ★db/pay-rows.sql の pv_my_give に書いてある定数と同じ文字列。
     片方だけ動かさないこと（動かすと「欠けている」側が全部 true になる）。 */
  const CUT = '2026-09-04 00:00:00+09';
  const stamp = (air, when) =>
    db.query(`update pay_reports set created_at = $2::timestamptz where airline = $1`,
             [air, when]);
  const give = async () => (await one(`select pv_my_give() g`)).g;

  /* 1社＝1人。出したあとに、その人の投稿時刻を when にそろえる。
     既定の CUT は締切ちょうど ── 「より前」ではないので経過措置に入らない。 */
  const gate = async (air, extra, when = CUT) => {
    const u = ++seat; await asUser(u);
    await submit({ ...BASE, airline: air, position: 'cap', fleet: 'b777',
                   period_year: YEAR, period_month: 5, gross_monthly: 15000, ...extra });
    await stamp(air, when);
    return await give();
  };

  // ── (a) 3項目すべて金額 → 開く ────────────────────────────
  const gF = await gate(A_GT_FULL,
    { base_pay: 9000, guarantee_pay: 3000, flight_variable_pay: 2000 });
  ok(gF.full === true,
     '★基本給・保証手当・変動給を3つとも金額で答えた人は開く', JSON.stringify(gF));

  // ── (b) 3つとも「該当なし」でも開く ──────────────────────
  /* ★ブリーフ §11「0円と『該当なし』は意味が違う」。
     「うちの会社にその項目は無い」は**回答**であって未回答ではない。
     ここが false になると、単純な給与体系の会社の人が一生開かない。 */
  const gN = await gate(A_GT_NONE,
    { pay_items: { v: 1, fixed_none: true, guarantee_none: true, variable_none: true } });
  ok(gN.full === true,
     '★★ 3つとも「該当なし」でも開く（未回答ではなく回答）★★', JSON.stringify(gN));

  // ── (c) 1つでも空欄なら開かない（3通りとも）──────────────
  const g1 = await gate(A_GT_M1, { guarantee_pay: 3000, flight_variable_pay: 2000 });
  ok(g1.full === false, '　基本給だけ空欄 → 開かない', JSON.stringify(g1));
  const g2 = await gate(A_GT_M2, { base_pay: 9000, flight_variable_pay: 2000 });
  ok(g2.full === false, '　保証手当だけ空欄 → 開かない', JSON.stringify(g2));
  const g3 = await gate(A_GT_M3, { base_pay: 9000, guarantee_pay: 3000 });
  ok(g3.full === false, '　変動給だけ空欄 → 開かない', JSON.stringify(g3));
  ok(g1.detailed === true && g2.detailed === true && g3.detailed === true,
     '★1つ空欄でも detailed は true のまま（DEEP PAY の条件は動いていない）',
     JSON.stringify([g1.detailed, g2.detailed, g3.detailed]));

  // ── (d) 変動給は「行」で答えても回答済み ──────────────────
  /* フォームの変動給は1行ずつ足す形（pd-var-rows）で、合計が
     flight_variable_pay に写る。合計が写らない道が将来できても
     静かに閉じないよう、行そのものでも回答済みと数える。 */
  const gR = await gate(A_GT_ROW,
    { base_pay: 9000, guarantee_pay: 3000,
      pay_items: { v: 1, variable: [{ amount: 2000, basis: 'block', label: 'Flight Pay' }] } });
  ok(gR.full === true,
     '★変動給を「行」で書いた人も開く（合計欄が空でも回答済み）', JSON.stringify(gR));

  // ── (e) 経過措置 ── 門より前に内訳を出した人は開いたまま ────
  /* ブリーフ §10「既存ユーザーに再入力を求めない」。
     この人は基本給しか書いていない＝厳密3項目には届かないが、
     門を入れる前から出してくれていたので開いたままにする。 */
  const gO = await gate(A_GT_OLD, { base_pay: 9000 }, '2026-09-03 12:00:00+09');
  ok(gO.full === true,
     '★★ 門より前に内訳を出した人は、再入力なしで開いたまま ★★', JSON.stringify(gO));

  // ── (f) 総支給しか書いていない人は開かない ────────────────
  const gP2 = await gate(A_GT_PLAIN, {});
  ok(gP2.full === false && gP2.detailed === false && gP2.basic === true,
     '　総支給だけの人は開かない（basic は true・detailed も false のまま）',
     JSON.stringify(gP2));

  /* 小道具 ── 基本給＝総支給の人を 1 人作る。内訳は 1 区分だけになる
     （余りが 0 なので落ちる）。(g) で「名前も渡さない」を見るため。 */
  await gate(A_GT_1SEG, { base_pay: 15000 });

  /* ══ ここから「何がブラウザに届くか」══════════════════════════ */

  // ── (g) 未 Unlock ＋ 内訳のある行 → paylock だけ ──────────
  const NOGIVE = 9103;
  await db.query(
    `insert into profiles(id,email,access_until) values($1,$2, now() + interval '90 days')
       on conflict (id) do update set access_until = excluded.access_until`,
    [uid(NOGIVE), 'nogive@example.com']);
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(NOGIVE)]);

  const L = await payRows();
  ok(L.state === 'open' && L.give.full === false,
     '　鍵は持っているが内訳を出していない人（一覧そのものは今までどおり出る）',
     JSON.stringify({ state: L.state, give: L.give }));
  const lb = only(L.rows, x => x.airline === A_BND)[0];
  ok(!!lb && !('pay' in lb) && Array.isArray(lb.paylock),
     '★★ 未 Unlock の行に pay の鍵が無く、paylock（区分の名前だけ）が立つ ★★',
     JSON.stringify(lb && lb.paylock));
  ok(!!lb && Array.isArray(lb.paylock)
        && lb.paylock.every(k => typeof k === 'string'),
     '★★ 入っているのは文字列だけ（帯も金額も1つも混ざっていない）★★',
     JSON.stringify(lb && lb.paylock));
  ok(!!lb && JSON.stringify(lb.paylock)
        === JSON.stringify(['base', 'variable', 'other', 'bonus']),
     '★オーナーの例の行は「基本給・変動給・その他・賞与」の4つ（中身は帯と同じ）',
     JSON.stringify(lb && lb.paylock));
  /* ★並びは金額の大きい順ではなく **paid が組んだ固定順**。
     大きい順にすると「変動給 > 基本給」という順位が、
     数字を1文字も書かないまま漏れる。 */
  const SEGORD = ['base', 'guarantee', 'variable', 'command', 'role', 'perdiem',
                  'housing', 'other', 'rest', 'bonus'];
  const lord = (lb && lb.paylock || []).map(k => SEGORD.indexOf(k));
  ok(lord.length > 0 && lord.every(i => i >= 0)
        && lord.every((v, i) => i === 0 || lord[i - 1] < v),
     '★★ 並びは固定順（金額順に並べ替えていない）★★',
     JSON.stringify(lb && lb.paylock));

  ok(!!lb && !!lb.airline && !!lb.pos && !!lb.fleet && !!lb.work,
     '★門が掛かるのは「報酬の内訳」だけ（会社・職位・機材・勤務は今までどおり出る）',
     JSON.stringify(lb && Object.keys(lb)));

  /* ★区分が1つしか無い行は、その名前さえ渡さない。
     区分が1つ ＝ その区分が内訳のほぼ全部。面には年収が出ているので、
     名前を出した時点で「基本給 ≒ 年収」と読めてしまう。 */
  const l1 = only(L.rows, x => x.airline === A_GT_1SEG)[0];
  ok(!!l1 && !('pay' in l1) && l1.paylock === true,
     '★★ 区分が1つだけの行は真偽1つに落ちる（名前も渡さない）★★',
     JSON.stringify(l1 && { paylock: l1.paylock }));

  const lraw = (await one(`select pv_pay_rows()::text t`)).t;
  ok(!lraw.includes('"pay"'),
     '★★ 返り値の文字列に "pay" の鍵が1つも無い ★★');
  /* ★「130000 が無いこと」では見ない。あの数は年収の丸め（有効数字2桁）で
     ほかの行にも普通に出る（134,000 → 130,000）。実際にそれで一度赤くなった。
     見るのは**帯の形**と、帯にしか出ない上端の2つ。 */
  /* ★paylock に入るのは **裸の名前**（"base"）。帯は
     {"k":"base","r":[…]} という対なので、この3つは今も
     ゼロのままでなければならない。名前を渡しただけでここが
     赤くなったら、帯そのものを渡している。 */
  const bandLike = ['"r":[', '"k":"base"', '"k":"variable"'].filter(w => lraw.includes(w));
  ok(bandLike.length === 0,
     '★★ 帯の形（区分名と下端・上端の組）が返り値に1つも無い ── ぼかしではなく不在 ★★',
     JSON.stringify(bandLike));
  ok(!lraw.includes('135000'),
     '★★ 帯の上端の実数（135000）が返り値に1文字も無い ★★',
     lraw.slice(Math.max(0, lraw.indexOf('135000') - 60), lraw.indexOf('135000') + 20));
  ok(lraw.includes('paylock'),
     '　代わりに立つのは区分の名前だけ（どの区分があるか、まで）');

  // ── (h) 内訳の無い投稿は、未 Unlock でも門を出さない（状態C）──
  const lc = only(L.rows, x => x.airline === A_ONE)[0];
  ok(!!lc && !('pay' in lc) && !('paylock' in lc),
     '★★ 投稿に内訳が無い行は鍵が2つとも無い（門ではなく「内訳がありません」）★★',
     JSON.stringify(lc));

  // ── (i) Unlock 済みには今までどおり帯が返る ────────────────
  await asViewer();
  const V = await payRows();
  ok(V.give.full === true, '　見る人の門は開いている（自分の内訳を出しているので）',
     JSON.stringify(V.give));
  const vb = only(V.rows, x => x.airline === A_BND)[0];
  ok(!!vb && Array.isArray(vb.pay) && vb.pay.length > 0 && !('paylock' in vb),
     '★開いている人には帯が返り、paylock は立たない（2つが同時に出ない）',
     JSON.stringify(vb && { pay: vb.pay && vb.pay.length, paylock: vb.paylock }));

  // ── (j) REAL PAY の門は DEEP PAY を開けない（ブリーフ §13）──
  /* full が true になっても、DEEP PAY が読むのは今までどおり detailed と
     人数の2つだけ。ここが崩れると「片方を開けたらもう片方も開いた」になる。 */
  const prog = (await one(`select pv_give_progress() r`)).r;
  ok(prog.give.detailed === V.give.detailed && typeof prog.contributors === 'number',
     '★DEEP PAY の札が読む値（detailed と人数）は、この門で1つも動かない',
     JSON.stringify(prog.give));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 12-j. ★公開年収から大きく外れた本人申告の行（far・2026-09-19）');
// ════════════════════════════════════════════════════════════
/* ★オーナー指示（2026-09-19）。同じ会社・同じ職位の公開年収と比べて、上限の1.5倍を
   超える／下限の半分を下回る本人申告の行に印を付ける。数字は書き換えない・行も消さない。
   伏せた一覧では上の8行の候補から外し、印そのものは返さない。
   ── 幅と為替を決め打ちして、境目がちょうど読める額で見る（入れた分は巻き戻す）。
      1ドル＝150円にすると、機長の上限 2,000万 × 1.5 ＝ 3,000万 ＝ $200,000、
      下限 1,200万 × 0.5 ＝ 600万 ＝ $40,000 と、どちらも有効数字2桁の額になる。
      副操縦士は 1,000万 × 1.5 ＝ $100,000。 */
{
  const [F1, F2] = (await rows(
    `select code from pv_airlines
      where active and cap_hi is not null and code <> all($1::text[])
      order by code limit 2`, [AIR])).map(r => r.code);
  const O_FAR = Object.keys(OPS).find(c => AIR.indexOf(c) < 0);
  const keyOf = async (air, usd) => (await one(
    `select distinct 'r:' || proof_hash k from pay_reports
      where airline = $1 and annual_total_usd = $2`, [air, usd])).k;
  const typeIn = async (typed, gross) => {
    await asUser(++seat);
    await submit({ ...BASE, airline: 'other', airline_other: typed, position: 'cap',
                   fleet: 'b777', period_year: YEAR, period_month: 5, gross_monthly: gross });
  };
  await db.exec('begin');
  try {
    await db.query(`update fx_rates set to_jpy = 150 where code = 'USD'`);
    await db.query(`update pv_airlines set cap_lo = 1200, cap_hi = 2000, fo_lo = 600, fo_hi = 1000
                     where code = any($1::text[])`, [[F1, F2]]);
    await person(F1, 'cap', [{ fleet: 'b777', month: 5, gross: 17500 }]);   // $210,000
    await person(F1, 'cap', [{ fleet: 'b777', month: 5, gross: 16700 }]);   // $200,400 → $200,000
    await person(F1, 'cap', [{ fleet: 'b777', month: 5, gross:  3250 }]);   // $39,000
    await person(F1, 'cap', [{ fleet: 'b777', month: 5, gross:  3333 }]);   // $39,996 → $40,000
    await person(F1, 'fo',  [{ fleet: 'b777', month: 5, gross:  9000 }]);   // $108,000
    await person(F1, 'fo',  [{ fleet: 'b777', month: 5, gross:  8300 }]);   // $99,600 → $100,000
    await person(F1, 'cap', [{ fleet: 'b777', month: 5, gross: 20000 }]);   // $240,000 → 検証済みにする
    await db.query(`update pay_reports set verify_level = 1 where airline = $1 and annual_total_usd = 240000`, [F1]);
    await person(F1, 'cap', [{ fleet: 'b777', month: 5, gross: 21000 }]);   // $252,000 → 訓練生にする
    await db.query(`update pay_reports set "position" = 'cadet' where airline = $1 and annual_total_usd = 252000`, [F1]);
    await person(O_FAR, 'cap', [{ fleet: 'b777', month: 5, gross: 50000 }]); // 年収の無い会社
    await typeIn('Nowhere Charter Zeta', 55000);                              // 寄せられない自由入力
    await typeIn((await one(`select name_ja from pv_airlines where code = $1`, [F2])).name_ja, 50000);
    /* 同じ取引の中では投稿時刻が全員同じ（now() は取引の始まり）。印の付く4人を
       いちばん新しくして、印が無ければ8行に入る位置に置く。 */
    await db.query(`update pay_reports set created_at = now() + interval '1 minute'
                     where (airline = $1 and annual_total_usd in (210000, 39000, 108000))
                        or (airline = 'other' and annual_total_usd = 600000)`, [F1]);

    await asViewer();
    const RJ = (await payRows()).rows;
    const at = (air, pos, usd) => {
      const m = RJ.filter(x => x.airline === air && x.pos === pos && x.annual_usd === usd);
      return m.length === 1 ? m[0] : null;
    };
    const hasFar = (x) => !!x && x.far === true;
    const noFar  = (x) => !!x && !('far' in x);
    ok(hasFar(at(F1, 'cap', 210000)),
       '★本人申告で上限の1.5倍を超える機長に印が付く（$210K ＝ 3,150万 ＞ 3,000万）');
    ok(noFar(at(F1, 'cap', 200000)),
       '★上限の1.5倍ちょうどは付かない（比べるのは画面に出る有効数字2桁の額。生の $200,400 なら超えていた）',
       JSON.stringify(at(F1, 'cap', 200000)));
    ok(hasFar(at(F1, 'cap', 39000)),
       '★下限の半分を下回る機長に印が付く（$39K ＝ 585万 ＜ 600万）');
    ok(noFar(at(F1, 'cap', 40000)),
       '★下限の半分ちょうどは付かない（生の $39,996 なら下回っていた）',
       JSON.stringify(at(F1, 'cap', 40000)));
    ok(hasFar(at(F1, 'fo', 110000)) && noFar(at(F1, 'fo', 100000)),
       '★副操縦士は副操縦士の幅で見る（$108K に付き、1.5倍ちょうどの $100K には付かない）');
    ok(noFar(at(F1, 'cap', 240000)) && at(F1, 'cap', 240000).verified === true,
       '★明細の裏付けがある（Verified）行には付かない', JSON.stringify(at(F1, 'cap', 240000)));
    ok(noFar(at(F1, 'cadet', 250000)),
       '★機長・副操縦士以外には付かない（幅を持っていない）', JSON.stringify(at(F1, 'cadet', 250000)));
    ok(noFar(at(O_FAR, 'cap', 600000)),
       `★年収の無い会社（投稿先だけ）には付かない（${O_FAR}）`, JSON.stringify(at(O_FAR, 'cap', 600000)));
    ok(noFar(at('other', 'cap', 660000)),
       '★会社に寄せられなかった自由入力には付かない', JSON.stringify(at('other', 'cap', 660000)));
    ok(hasFar(at(F2, 'cap', 600000)),
       `★「その他」に打たれた社名も、会社に寄せてからその会社の幅で比べる（${F2}）`,
       JSON.stringify(at(F2, 'cap', 600000)));
    ok(RJ.every(x => !('far' in x) || x.far === true)
       && RJ.filter(hasFar).length === 4,
       '★印は当たった4行だけ（ほかの行にはキーごと無い）', String(RJ.filter(hasFar).length));

    /* 鍵の無い一覧。印の付いた人はいちばん新しいので、印が無ければ8行に入っていた。 */
    await asUser(9001);
    const lkF = await payRows();
    const kF = await withKeys();
    const spF = maskSpec(kF);
    ok(kF.filter(x => x.far).length === 4
       && kF.filter(x => x.far).every(x => pick8(kF.filter(eliOf)).includes(x)),
       '　（印の付いた4人とも、印が無ければ8行に入っていた回で見ている）');
    ok(spF.top.length === 8 && spF.top.every(x => !x.far),
       '★★印の付いた人は上の8行に入らない（9行目以降へ下がる）');
    ok(lkF.rows.length === kF.length,
       '★行は1つも消さない（伏せた一覧の行数は開いた一覧と同じ）', `${lkF.rows.length} / ${kF.length}`);
    ok(!JSON.stringify(lkF).includes('"far"'),
       '★伏せた一覧のどの行にも印（far）が無い');
    ok(!firstDiff(lkF.rows, spF.rows),
       '★★印の付いた人がいても、伏せた一覧が決めた形と1行も違わない', firstDiff(lkF.rows, spF.rows));

    /* ★8行で年収を見せていた人が、あとから印の対象になって9行目以降へ下がる
         （公開年収の幅を直した日など）。そこで会社が出ると、8行で見えていた年収と
         会社が1人につながる。年収を見せる型（年収型・機種型）の Y を1人置いて、幅を狭める。 */
    let yk = '', yg = 0;
    for (let i = 0; i < 40 && !yk; i++) {
      const gg = 12000 + i * 10;                                           // $144,000 前後 ＝ 幅の中
      await person(F1, 'cap', [{ fleet: 'b777', month: 5, gross: gg }]);
      const k = await keyOf(F1, gg * 12);
      if (tzOf(k) !== 'c') { yk = k; yg = gg; }
    }
    await db.query(`update pay_reports set created_at = now() + interval '2 minutes'
                     where airline = $1 and annual_total_usd = $2`, [F1, yg * 12]);
    await asUser(9001);
    let lkY = await payRows();
    let spY = maskSpec(await withKeys());
    const iy = spY.top.findIndex(x => x.k === yk);
    ok(iy === 0 && 'annual_usd' in lkY.rows[0] && !('airline' in lkY.rows[0]),
       '　（年収を見せる型の Y が、8行の先頭で年収を見せている回で見ている）', String(iy));
    await db.query(`update pv_airlines set cap_lo = 600, cap_hi = 900 where code = $1`, [F1]);
    await asUser(9001);
    lkY = await payRows();
    spY = maskSpec(await withKeys());
    const Y = spY.rest.find(x => x.k === yk);
    ok(!!Y && Y.far === true && !spY.top.some(x => x.k === yk),
       '　（幅を狭めて Y に印が付き、8行から外れた）');
    const ry = spY.top.length + spY.rest.indexOf(Y);
    ok(!!Y && canonRow(lkY.rows[ry]) === canonRow({ age: Y.age }),
       '★★8行で年収を見せていた人は、印で9行目以降へ下がっても会社が出ない（投稿時期だけ）',
       JSON.stringify(lkY.rows[ry]));
    ok(!firstDiff(lkY.rows, spY.rows),
       '　下がった後も決めた形と1行も違わない', firstDiff(lkY.rows, spY.rows));
  } finally {
    await db.exec('rollback');
  }
  await asViewer();
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 13. 自己点検 SQL（ファイル末尾のものをそのまま流す）');
// ════════════════════════════════════════════════════════════
{
  const src = read('db/pay-rows.sql');
  const q = src.slice(src.lastIndexOf('with f as ('));
  const res = await rows(q);
  ok(res.length === 68, `自己点検が68行ぜんぶ出る（= ${res.length}行）`);
  for (const row of res) {
    ok(row['結果'] === '✅', `${row['#']}. ${row['見るところ']}`);
  }
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 14. 8-20（pay_reports を読む関数が anon に開いていないこと）');
// ════════════════════════════════════════════════════════════
{
  const src = read('db/pay-reports.sql');
  /* ★1文だけ切り出す。「そこから最後まで」にすると、あのファイルの末尾に
     検査を1つ足しただけで「複数の文は流せない」で落ちる（実際に落ちた）。 */
  const cut = (tag) => {
    const from = src.lastIndexOf(tag);
    if (from < 0) return null;
    const tail = src.slice(from);
    const next = tail.indexOf('\n-- 8-', 1);
    const one = next < 0 ? tail : tail.slice(0, next);
    return one.slice(one.indexOf('select'));
  };
  const res = await rows(cut('-- 8-20.'));
  ok(res.length === 0, 'pay_reports を読む security definer 関数が anon に1つも開いていない',
     JSON.stringify(res));

  // 8-21 … 2026-08-26〜27 に足した8列（役職・区分の複数／内訳の行／保証給／教官／審査／組合／管理職／兼務）
  const cols = await rows(cut('-- 8-21.'));
  ok(cols.length === 8 && cols.every((c) => c['ある'] === true),
     '役職（複数）・内訳の行・保証給・教官・審査・組合・管理職・兼務の8列が入っている', JSON.stringify(cols));

  // 8-22 … 総支給と内訳の排他が復活していないこと
  const exc = await rows(cut('-- 8-22.'));
  ok(exc.length === 2 && exc.every((c) => c['内訳を捨てている'] === false),
     '総支給が来ても内訳を捨てていない（排他が復活していない）', JSON.stringify(exc));
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 15. 本人の依頼で一覧から下ろす（pay_hidden・2026-09-10）');
// ════════════════════════════════════════════════════════════
/* 「自分の年収情報を消してほしい」と言われたときの仕掛け。
   ★行は消さない。落ちるのは一覧の1行だけで、人数にも本人の鍵にも触らない。
   ★運営（pv_is_operator）には今までどおり出る。
   ⚠️ 静かに壊れる形が2つある ──
      ① 数え上げ側にも同じ絞りを書いてしまい、出してくれた人が
         「出していない人」に戻る（DEEP PAY の N/100 が黙って1つ減る）。
      ② shelf の側で落としてしまい、口コミの重複よけ（自己点検30）が
         効かなくなって、下ろしたはずの人が口コミ側から出てくる。 */
{
  const HID_U = await person(A_HIDE, 'cap', [{ fleet: 'b777', month: 6, gross: 12000 }]);
  await asViewer();

  const seen = async () => (await payRows()).rows.some((x) => x.airline === A_HIDE);
  const heads = async () => (await one(`select pv_deep_contributors() n`)).n;

  ok(await seen(), '下ろす前は一覧に出ている（前提）');
  const headsBefore = await heads();

  await db.query(
    `insert into public.pay_hidden(proof_hash, reason)
     select r.proof_hash, '本人の依頼' from public.pay_reports r
      where r.airline = $1 on conflict (proof_hash) do nothing`, [A_HIDE]);

  ok(!(await seen()), '★下ろすと一覧から消える（鍵を持っている人にも出ない）');

  /* ★出した本人自身にも出ないこと。
     除外は運営（pv_is_operator）の1つだけで、本人もその中に入らない。
     ☆本人の控え（my_pay_reports）はこの下で別に見ている。 */
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(HID_U)]);
  ok(!(await payRows()).rows.some((x) => x.airline === A_HIDE),
     '★★出した本人が見ても一覧から消えている');
  await asViewer();
  const headsAfter = await heads();
  ok(headsAfter === headsBefore,
     '★★下ろしても人数は1つも減らない（出してくれた事実は残す）',
     `${headsBefore} → ${headsAfter}`);

  // 本棚（DB）にはそのまま残っている
  ok((await one(`select count(*)::int n from pay_reports where airline = $1`, [A_HIDE])).n === 1,
     '★行はデータベースに残っている（消していない）');

  // 本人の鍵（Give & Get）も、本人のマイページも、今までどおり
  await db.query(`select set_config('pv.uid', $1, false)`, [uid(HID_U)]);
  const give = (await one(`select pv_my_give() g`)).g;
  ok(give.basic === true,
     '★下ろされた本人の鍵は開いたまま（アカウントは今までどおり使える）',
     JSON.stringify(give));
  const mine = (await one(`select my_pay_reports() j`)).j;
  ok((mine.reports || []).length === 1,
     '★本人のマイページには今までどおり出る（自分の控えは消さない）');

  /* ── 運営（pv_admins）だけは今までどおり見える ──
     この検査は db/admin.sql を流していないので、名簿をここで作る。
     pv_is_operator は to_regclass で名簿の実在を見ているので、後から作っても効く。 */
  await db.exec(`create table if not exists public.pv_admins (user_id uuid primary key)`);
  await db.query(`insert into public.pv_admins(user_id) values($1) on conflict do nothing`,
    [uid(VIEWER)]);
  await asViewer();
  ok(await seen(), '★★運営には今までどおり出る（下ろせたかを目で確かめられる）');

  await db.query(`delete from public.pv_admins where user_id = $1`, [uid(VIEWER)]);
  ok(!(await seen()), '運営を名簿から外すと、また消える（名簿ひとつで切り替わっている）');

  // 戻せる
  await db.query(`delete from public.pay_hidden`);
  ok(await seen(), '★名簿から消せば元どおり出る（片道の操作にしない）');

  await db.exec(`drop table if exists public.pv_admins`);
}

// ════════════════════════════════════════════════════════════
console.log('\n▼ 16. ★引き取れなかった預かりを残したまま新規保存すると二重になる（N-2）');
// ════════════════════════════════════════════════════════════
/* 2026-09-11 の監査で見つかった形。給与フォームは引き取りの通信が落ちた回を
   「預かりが無い」と同じ扱いにして、そのまま新規保存へ流れ、しかも祝っていた。
   預かり行は未引き取りのまま残るので ──
     ・REAL PAY の一覧に、**同じ人が2行**（本棚の行 ＋ 未引き取りの預かり）
     ・pv_contributors()（Give & Get の分母）に **2人** として載る
   どちらも画面は普通に動いたまま静かにずれる。★ここはその仕様を固定する節で、
   画面側の枝（showClaimState）と db/pay-report-pending.sql の
   already_claimed／expired／not_found が対になっている。 */
{
  const rowsFor = async (air) => only((await payRows()).rows, (x) => x.airline === air);
  const heads2 = async () => (await one(`select pv_contributors() n`)).n;

  // (a) 匿名で1件預ける（回線のハッシュがあるので一覧に出る）
  const p = await pend(A_N2, { fleet: 'b777', month: 7, gross: 16000, iph: 'iph-n2' });
  await asViewer();
  const h0 = await heads2();
  ok((await rowsFor(A_N2)).length === 1, '預かりが1行として出る（前提）');

  // (b) 同じ人が会員になり、**引き取らずに**同じ月を出し直す（＝落ちた回の挙動）
  const u = ++seat;
  await asUser(u);
  await submit({ ...BASE, airline: A_N2, position: 'cap', fleet: 'b777',
                 period_year: YEAR, period_month: 7, gross_monthly: 16000 });
  await asViewer();
  ok((await rowsFor(A_N2)).length === 2,
     '★引き取らずに保存すると、同じ人が一覧に2行出る（これが N-2 の見え方）',
     `= ${(await rowsFor(A_N2)).length}行`);
  ok((await heads2()) === h0 + 1,
     '★人数も1人ぶん増える（本棚の1人 ＋ 未引き取りの預かり1人 ＝ 同じ人を2回）',
     `${h0} → ${await heads2()}`);

  // (c) 預かりを引き取ると、1行・1人に戻る
  await asUser(u);
  const got = (await one(`select claim_pending_report($1) r`, [p.claim_token])).r;
  ok(got.ok === true, '　引き取れた', JSON.stringify(got).slice(0, 80));
  await asViewer();
  ok((await rowsFor(A_N2)).length === 1,
     '★引き取れば一覧は1行に戻る（本棚の側で上書きされる）');
  ok((await heads2()) === h0,
     '★人数も元どおり（同じ人が1人に戻る）', `= ${await heads2()}`);

  /* (d) ★応答だけ落ちた再試行。何度叩いても行も人数も動かない。
     ここが動いてしまうと、画面が「もう一度取り込む」を出す意味が無くなる。 */
  await asUser(u);
  for (let i = 0; i < 3; i++) {
    const again = (await one(`select claim_pending_report($1) r`, [p.claim_token])).r;
    ok(again.ok === false && again.reason === 'already_claimed',
       `　再試行 ${i + 1} 回目は「もう移してある」`, JSON.stringify(again));
  }
  await asViewer();
  ok((await rowsFor(A_N2)).length === 1, '★再試行しても一覧は1行のまま');
  ok((await heads2()) === h0, '★再試行しても人数は動かない');
}

// ── まとめ ───────────────────────────────────────────────────
console.log(`\n${fail === 0 ? '✅ 全部通った' : '❌ 落ちた項目がある'}  pass ${pass} / fail ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
