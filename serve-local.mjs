#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   serve-local.mjs — 手元だけで動く「保存先つき」のサーバー（2026-10-04）

   何のためか
     会社ページの「不足している項目から、その場で投稿する」を、
     投稿 → 保存 → 再読み込み → 本人の修正 まで本当に動かして確かめるため。
     本番の Supabase とは1回も通信しない。回答はこの Mac の中のファイル
     （.local-db/ ・gitignore 済み）に残り、立ち上げ直しても消えない。

   serve.mjs との違い
     serve.mjs（3000番）は静的ファイルだけ。check.mjs の画面検査が使うので触らない。
     こちら（3100番）は同じファイルを配りつつ、3つを足す。
       1) db/*.sql を本番に貼る順で流した DB（PGlite をファイルに置く）
       2) supabase-js が話す口の最小限（/rest/v1 ・ /auth/v1）
       3) 配る HTML の先頭にだけ差し込む小さなスクリプト
          （supabase-js の向き先を手元へ変える・解析タグを止める・会員の切替）
     ★公開するファイルには切替を1文字も入れない。差し込むのは配る瞬間だけ。

   使い方
     node serve-local.mjs               http://localhost:3100
     node serve-local.mjs --port 3200
     node serve-local.mjs --reset       保存先を空に戻してから立ち上げる
     node serve-local.mjs --db <dir>    別の保存先（検査が使い捨てで立てる用）

   ⚠️ ここで確かめられるのは「SQL と画面が手元で動くこと」まで。
      本番のサーバーに入ったこと・資格のある会員で通ったことの証拠にはならない。
      「確認済みパイロット」は手元の DB で verify_level を立てただけ ＝ 模擬。
   ⚠️ 作り物の回答は最初から入れない。入っているのは会員の枠だけ。
   ⚠️ SQL を足したら SQL_FILES に足す（並びは本番に貼る順）。
   ══════════════════════════════════════════════════════════════════ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/* 本番に貼る順。どれも冪等なので、立ち上げるたびに全部流す
   （＝ SQL を直したら、立ち上げ直すだけで手元へ入る）。 */
export const SQL_FILES = [
  'db/airlines.generated.sql',
  'db/vocab.generated.sql',
  'db/schema-additions.sql',
  'db/pay-reports.sql',
  'db/pay-report-pending.sql',
  'db/pay-rows.sql',
  'db/admin.sql',
  'db/conditions.generated.sql',
  'db/airline-conditions.sql',
  'db/reviews-gate.sql',
  'db/review-summary.sql',
  'db/deep-pay.sql',
  'db/requests.sql',
  'db/referrals.sql',
  'db/founding.sql',
  'db/proof-store.sql',
  'db/proof-offer.sql',
  'db/stays.sql',
  'db/work-months.sql',
  'db/towns.sql',
  'db/towns.generated.sql',
  'db/contrib.sql',
];

/* Supabase が最初から持っているもの（auth・役・既定の権限）と、
   リポジトリの SQL に無い2つの表（ダッシュボードで作ったもの）。
   各テストが手で作っていたものを1か所へ集めた。 */
const BOOT = `
create schema if not exists extensions;
create schema if not exists auth;
create role anon;
create role authenticated;
grant usage on schema public, extensions, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb,
  created_at timestamptz not null default now());
create unique index auth_users_email on auth.users (lower(email));
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('pv.uid', true), '')::uuid $$;

create table public.profiles (
  id uuid primary key, email text, name text,
  email_opt_in boolean not null default false,
  gender text, birthdate date, country text, company text, "position" text,
  created_at timestamptz not null default now());

create table public.reviews_v2 (
  id uuid primary key default gen_random_uuid(),
  proof_hash text not null, airline text not null, "position" text,
  tenure_bucket text, age_bucket text, fleet text, job_role text,
  monthly_salary integer, bonus integer, annual_salary integer, base_annual integer,
  flight_allowance_annual integer,
  culture_score integer, salary_score integer, benefits_score integer,
  wlb_score integer, ops_score integer, training_score integer, mgmt_score integer,
  culture_comment text, salary_comment text, benefits_comment text,
  wlb_comment text, ops_comment text, training_comment text, mgmt_comment text,
  orig_lang text, translations jsonb,
  created_at timestamptz not null default now());
-- 本番と同じ：未ログインからの直接の書き込みは通らない
alter table public.reviews_v2 enable row level security;
revoke all on public.reviews_v2 from anon;
create policy reviews_v2_insert_member on public.reviews_v2
  for insert to authenticated with check (true);
`;

/* 手元の会員。枠だけで、回答も給与も入れない。
   「給与提出者」は、この会員で給与フォームから実際に出すと提出者になる。 */
export const MEMBERS = [
  { key: 'a',     id: '00000000-0000-4000-8000-0000000000a1', email: 'member-a@example.com', ja: '会員A' },
  { key: 'b',     id: '00000000-0000-4000-8000-0000000000b2', email: 'member-b@example.com', ja: '会員B' },
  { key: 'c',     id: '00000000-0000-4000-8000-0000000000c3', email: 'member-c@example.com', ja: '会員C' },
  { key: 'pay',   id: '00000000-0000-4000-8000-0000000000d4', email: 'pay@example.com',      ja: '給与提出者' },
  { key: 'pilot', id: '00000000-0000-4000-8000-0000000000e5', email: 'pilot@example.com',    ja: '確認済みパイロット（模擬）', verified: true },
  { key: 'op',    id: '00000000-0000-4000-8000-0000000000f6', email: 'operator@example.com', ja: '運営', operator: true, owner: true },
];

export const OTP = '000000';                 // 手元のログインで使うメールのコード
const STORAGE_KEY = 'sb-local-auth-token';   // pv-session.js の AUTH_RE に当たる形
const IDENT = /^[a-z_][a-z0-9_]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/* ── 小道具 ─────────────────────────────────────────────── */
const b64u = (s) => Buffer.from(s).toString('base64url');
const lit = (v) => {
  const s = String(v);
  if (s.includes('\0')) throw bad('LOCAL400', 'bad value');
  return "'" + s.replace(/'/g, "''") + "'";
};
const q = (name) => {
  if (!IDENT.test(name)) throw bad('LOCAL400', 'この口が読めない名前: ' + String(name).slice(0, 60));
  return '"' + name + '"';
};
function bad(code, message, status = 400, details = null) {
  const e = new Error(message); e.local = { status, body: { code, details, hint: null, message } }; return e;
}
function jwtPayload(tok) {
  try { return JSON.parse(Buffer.from(String(tok).split('.')[1], 'base64url').toString('utf8')); }
  catch { return null; }
}
function whoOf(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  const claims = jwtPayload(m ? m[1] : req.headers.apikey || '');
  if (claims && claims.role === 'authenticated' && UUID.test(claims.sub || '')) {
    return { role: 'authenticated', uid: claims.sub, claims };
  }
  return { role: 'anon', uid: '', claims: { role: 'anon' } };
}
/* PostgREST と同じ対応。画面側の分岐（未定義の関数・検品の失敗・権限なし）が本番と同じに動く。 */
function pgStatus(code, role) {
  if (!code) return 500;
  if (code === '42501') return role === 'anon' ? 401 : 403;
  if (code === '42883' || code === '42P01') return 404;
  if (code === '23505' || code === '23503') return 409;
  if (/^(08|53|54|57|58|XX)/.test(code)) return 500;
  return 400;
}
function readBody(req, max = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > max) { reject(bad('LOCAL413', 'too large', 413)); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ── 差し込むスクリプト（ブラウザで動く。ここだけ別世界）──────
   toString() で文字にして HTML の <head> の直後へ入れる。
   ★ supabase-js 本体はそのまま使う（向き先だけ変える）＝ 画面のコードは本番と同じ道を通る。 */
function client(cfg) {
  var ORIGIN = location.origin, KEY = cfg.key, lib;
  function wrap(real) {
    if (!real || typeof real.createClient !== 'function' || real.__pvLocal) return real;
    var out = { __pvLocal: true };
    Object.getOwnPropertyNames(real).forEach(function (k) { try { out[k] = real[k]; } catch (e) {} });
    out.createClient = function (url, key, opts) {
      opts = opts || {};
      var auth = Object.assign({}, opts.auth, { storageKey: KEY });
      return real.createClient(ORIGIN, key, Object.assign({}, opts, { auth: auth }));
    };
    return out;
  }
  try {
    Object.defineProperty(window, 'supabase', {
      configurable: true, enumerable: true,
      get: function () { return lib; },
      set: function (v) { lib = wrap(v); }
    });
  } catch (e) {}

  /* 念のため：本番の住所へ直接 fetch する箇所も手元へ向ける */
  var RE = /^https:\/\/[a-z0-9-]+\.supabase\.co(?=[\/?#]|$)/i, F = window.fetch;
  if (F) window.fetch = function (input, init) {
    try {
      if (typeof input === 'string' && RE.test(input)) input = input.replace(RE, function () { return ORIGIN; });
      else if (input && input.url && RE.test(input.url)) input = new Request(input.url.replace(RE, function () { return ORIGIN; }), input);
    } catch (e) {}
    return F.call(this, input, init);
  };

  /* 解析タグは手元では動かさない（訪問数に混ざる） */
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) window.gtag = function () {};

  /* 会員の切替 */
  var KEEP = /^(pv_local_|pv-currency|pv_contrib_outbox|pv_contrib_key|pv-theme)/;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function wipe() {
    try {
      Object.keys(localStorage).forEach(function (k) { if (!KEEP.test(k)) localStorage.removeItem(k); });
      sessionStorage.clear();
    } catch (e) {}
  }
  function current() {
    try { var s = JSON.parse(get(KEY) || 'null'); return s && s.user ? s.user.email : null; } catch (e) { return null; }
  }
  function go(member) {
    if (!member) { wipe(); location.reload(); return Promise.resolve(); }
    return F.call(window, '/__local/login?member=' + encodeURIComponent(member))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.session) throw new Error('login failed');
        wipe();
        var now = String(Date.now());
        localStorage.setItem(KEY, JSON.stringify(d.session));
        localStorage.setItem('pv_user', JSON.stringify(d.pv_user));
        localStorage.setItem('pv_last_active', now);
        localStorage.setItem('pv_session_start', now);
        location.reload();
      });
  }
  window.PV_LOCAL = { members: cfg.members, otp: cfg.otp, login: go, current: current };

  function ui() {
    if (get('pv_local_ui') === '0' || !document.body) return;
    var email = current(), me = cfg.members.filter(function (m) { return m.email === email; })[0];
    var box = document.createElement('div');
    box.setAttribute('data-pv-local', '');
    box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483000;' +
      'font:12px/1.5 -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';
    var pill = 'display:block;box-sizing:border-box;border:0;margin:0;cursor:pointer;text-align:left;' +
      'font:inherit;color:#fff;background:rgba(17,24,39,.94);padding:6px 11px;border-radius:999px;' +
      'box-shadow:0 1px 2px rgba(0,0,0,.2),0 6px 18px rgba(0,0,0,.22)';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '手元 · ' + (me ? me.ja : email || '未ログイン');
    btn.style.cssText = pill;
    var list = document.createElement('div');
    list.hidden = true;
    list.style.cssText = 'margin-bottom:6px;padding:6px;border-radius:12px;background:rgba(17,24,39,.96);' +
      'box-shadow:0 1px 2px rgba(0,0,0,.2),0 10px 28px rgba(0,0,0,.3);min-width:190px';
    [{ key: '', ja: '未ログイン' }].concat(cfg.members).forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = (me && me.key === m.key) || (!email && !m.key) ? '● ' + m.ja : m.ja;
      b.style.cssText = pill + ';width:100%;background:transparent;box-shadow:none;border-radius:8px';
      b.addEventListener('click', function () { go(m.key); });
      list.appendChild(b);
    });
    var note = document.createElement('div');
    note.textContent = 'メールのコード ' + cfg.otp;
    note.style.cssText = 'color:rgba(255,255,255,.6);padding:6px 11px 2px';
    list.appendChild(note);
    btn.addEventListener('click', function () { list.hidden = !list.hidden; });
    box.appendChild(list); box.appendChild(btn);
    document.body.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ui); else ui();
}

/* ── 立ち上げ ───────────────────────────────────────────── */
export async function start(opt = {}) {
  const port = opt.port ?? 3100;
  const host = opt.host ?? '127.0.0.1';
  const dir = path.resolve(opt.dir ?? path.join(ROOT, '.local-db'));
  const say = opt.quiet ? () => {} : (s) => console.log(s);
  const pgDir = path.join(dir, 'pg');
  const lock = path.join(dir, 'serve-local.lock');

  /* 同じ保存先を2つのプロセスで開くと壊れる。先に居たら立ち上げない。 */
  if (fs.existsSync(lock)) {
    const pid = Number(fs.readFileSync(lock, 'utf8')) || 0;
    let alive = false;
    try { if (pid) { process.kill(pid, 0); alive = true; } } catch { alive = false; }
    if (alive) throw new Error(`この保存先はもう使われています（pid ${pid}）。二重に立ち上げない。`);
  }
  if (opt.reset && fs.existsSync(dir)) {
    /* 消す前に中身を見る。ここで作った保存先（か空）以外は消さない。 */
    const names = fs.readdirSync(dir).filter((n) => n !== '.DS_Store');
    const ours = names.every((n) => n === 'pg' || n === 'serve-local.lock');
    if (!ours) throw new Error('--reset：この場所には保存先以外のものがあるので消さない → ' + names.slice(0, 5).join(', '));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(lock, String(process.pid));

  const t0 = Date.now();
  const db = new PGlite(pgDir, { extensions: { pgcrypto } });
  await db.waitReady;
  await db.exec(`set timezone = 'UTC'`);   // 本番と同じ時計（now() ・ current_date ・返る時刻の形）
  const fresh = !(await db.query(`select to_regclass('public.profiles') as r`)).rows[0].r;
  if (fresh) await db.exec(BOOT);
  /* 前からある保存先（BOOT に登録日の列が無かった頃に作ったもの）にも、管理ページの会員の表が読む列を足す。
     冪等（新しい保存先では何もしない）。BOOT の外に置くのはこの1文だけ。 */
  await db.exec(`alter table public.profiles add column if not exists created_at timestamptz not null default now()`);
  for (const f of SQL_FILES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) throw new Error('SQL が無い: ' + f);
    try { await db.exec(fs.readFileSync(p, 'utf8')); }
    catch (e) { throw new Error(`${f} が流れない: ${String(e.message).slice(0, 300)}`); }
  }
  for (const m of MEMBERS) {
    // auth.users に入れると、db/schema-additions.sql のトリガが profiles の行を作る
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, ($3::text)::jsonb)
       on conflict (id) do nothing`, [m.id, m.email, JSON.stringify({ name: m.ja })]);
    if (m.verified) await db.query(`update public.profiles set verify_level = 1 where id = $1 and verify_level is distinct from 1`, [m.id]);
    if (m.operator) await db.query(`insert into public.pv_admins (user_id, note) values ($1, '運営（手元）') on conflict (user_id) do nothing`, [m.id]);
  }
  /* ステイ情報（db/stays.sql の約束 1）を見てよい人。★手元だけの模擬:
     owner: true の会員（'op'）＝ オーナー、verified: true の会員（'pilot'）＝ そのオーナーが承認した人。
     本番のオーナーの行は、オーナーが SQL Editor で自分のメールアドレスを入れたときだけ入る（このファイルは本番に触らない）。 */
  if ((await db.query(`select to_regclass('public.pv_stay_owner') as r`)).rows[0].r) {
    const owner = MEMBERS.find((m) => m.owner);
    await db.query(
      `insert into public.pv_stay_owner (user_id) values ($1)
       on conflict (one) do update set user_id = excluded.user_id, set_at = now()
        where public.pv_stay_owner.user_id is distinct from excluded.user_id`, [owner.id]);
    for (const m of MEMBERS.filter((x) => x.verified)) {
      await db.query(
        `insert into public.pv_stay_viewers (user_id, state, asked_at, decided_by, decided_at)
         values ($1, 'approved', now(), $2, now()) on conflict (user_id) do nothing`, [m.id, owner.id]);
    }
  }
  say(`  保存先 ${path.relative(ROOT, dir) || dir}（${fresh ? '新しく作った' : '前回の続き'}・${Date.now() - t0}ms）`);

  /* 接続は1本。要求を直列にして、毎回「誰として」を着せ替える。 */
  let chain = Promise.resolve();
  const locked = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  async function as(who, headers, fn) {
    await db.query(
      `select set_config('pv.uid', $1, false), set_config('request.jwt.claims', $2, false),
              set_config('request.headers', $3, false)`,
      [who.uid || '', JSON.stringify(who.claims || {}), JSON.stringify(headers || {})]);
    await db.exec(`set role ${who.role === 'authenticated' ? 'authenticated' : 'anon'}`);
    try { return await fn(); }
    finally {
      await db.exec('reset role');
      await db.query(`select set_config('pv.uid', '', false), set_config('request.jwt.claims', '', false)`);
    }
  }

  /* ── 会員（/auth/v1 が返す形）──────────────────────────── */
  const userRow = async (where, v) =>
    (await db.query(`select id, email, raw_user_meta_data as meta, created_at from auth.users where ${where}`, [v])).rows[0] || null;
  function userObj(u) {
    const at = new Date(u.created_at).toISOString();
    return {
      id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, phone: '',
      email_confirmed_at: at, confirmed_at: at, last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.meta || {},
      identities: [], created_at: at, updated_at: at, is_anonymous: false,
    };
  }
  function sessionOf(u) {
    const now = Math.floor(Date.now() / 1000);
    const claims = { sub: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, iat: now, exp: now + 3600 };
    return {
      access_token: `${b64u('{"alg":"none","typ":"JWT"}')}.${b64u(JSON.stringify(claims))}.local`,
      token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
      refresh_token: 'local.' + u.id, user: userObj(u),
    };
  }
  async function findOrCreate(email, data, create = true) {
    const e = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(e)) return null;
    const had = await userRow('lower(email) = $1', e);
    if (had || !create) return had;
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), $1, ($2::text)::jsonb)`,
      [e, JSON.stringify(data || {})]);
    return userRow('lower(email) = $1', e);
  }
  const authErr = (code, error_code, msg) => ({ status: code, body: { code, error_code, msg } });

  async function auth(req, url, bodyText) {
    const p = url.pathname.slice('/auth/v1/'.length);
    const who = whoOf(req);
    const body = bodyText ? JSON.parse(bodyText) : {};
    if (p === 'authorize') {
      return { status: 200, html: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>手元では使えません</title><body style="font:16px/1.8 -apple-system,'Hiragino Sans',sans-serif;max-width:32em;margin:15vh auto;padding:0 20px">
<p>手元のサーバーでは Google ログインは使えません。</p>
<p>前の画面で「メールにコードを送る」を選び、コード <b>${OTP}</b> を入れてください。左下の「手元」からも会員を選べます。</p>
<p><a href="javascript:history.back()">前の画面へ戻る</a></p>` };
    }
    if (p === 'settings') return { status: 200, body: { external: { email: true, google: false }, disable_signup: false, mailer_autoconfirm: true } };
    if (p === 'logout') return { status: 204 };
    if (p === 'recover') return { status: 200, body: {} };
    if (p === 'user') {
      const u = who.uid ? await userRow('id = $1', who.uid) : null;
      if (!u) return authErr(401, 'no_authorization', 'This endpoint requires a Bearer token');
      if (req.method === 'PUT' && body.data && typeof body.data === 'object') {
        await db.query(`update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || ($2::text)::jsonb where id = $1`,
          [u.id, JSON.stringify(body.data)]);
        return { status: 200, body: userObj(await userRow('id = $1', u.id)) };
      }
      return { status: 200, body: userObj(u) };   // パスワードは持たない（手元では何でも通す）
    }
    if (p === 'otp') {
      const u = await findOrCreate(body.email, body.data, false);
      if (!u && body.create_user === false) return authErr(422, 'otp_disabled', 'Signups not allowed for otp');
      return { status: 200, body: {} };            // メールは送らない。コードは OTP の固定値
    }
    if (p === 'verify') {
      if (String(body.token || '') !== OTP) return authErr(403, 'otp_expired', 'Token has expired or is invalid');
      const u = await findOrCreate(body.email, body.data);
      return u ? { status: 200, body: sessionOf(u) } : authErr(400, 'validation_failed', 'Invalid email');
    }
    if (p === 'signup') {
      if (await findOrCreate(body.email, null, false)) return authErr(422, 'user_already_exists', 'User already registered');
      const u = await findOrCreate(body.email, body.data);
      return u ? { status: 200, body: sessionOf(u) } : authErr(400, 'validation_failed', 'Invalid email');
    }
    if (p === 'token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'refresh_token') {
        const id = String(body.refresh_token || '').replace(/^local\./, '');
        const u = UUID.test(id) ? await userRow('id = $1', id) : null;
        return u ? { status: 200, body: sessionOf(u) } : authErr(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      }
      if (grant === 'password') {
        const u = body.password ? await findOrCreate(body.email, null, false) : null;
        return u ? { status: 200, body: sessionOf(u) } : authErr(400, 'invalid_credentials', 'Invalid login credentials');
      }
    }
    return authErr(404, 'not_found', '手元のサーバーには無い口: /auth/v1/' + p);
  }

  /* ── /rest/v1/rpc/<名前> ───────────────────────────────── */
  const encArg = (v, type) => {
    if (v === null || v === undefined) return null;
    if (type === 'json' || type === 'jsonb') return JSON.stringify(v);
    if (Array.isArray(v)) return '{' + v.map((x) => x === null ? 'NULL' : '"' + String(x).replace(/(["\\])/g, '\\$1') + '"').join(',') + '}';
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  };
  async function rpc(name, args, who, req) {
    if (!IDENT.test(name)) throw bad('PGRST202', `Could not find the function public.${name} in the schema cache`, 404);
    const keys = Object.keys(args || {});
    const procs = (await db.query(
      `select p.proretset as setof, (p.prorettype = 'void'::regtype) as is_void, p.pronargdefaults::int as ndef,
              coalesce(p.proargnames, '{}')::text[] as names, coalesce(p.proargmodes::text[], '{}') as modes,
              array(select format_type(t, null) from unnest(p.proargtypes::oid[]) with ordinality u(t, o) order by o) as types
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = $1`, [name])).rows
      .map((r) => {
        const inNames = r.modes.length ? r.names.filter((_, i) => 'ibv'.includes(r.modes[i])) : r.names;
        return { ...r, inNames, need: inNames.slice(0, r.types.length - r.ndef) };
      })
      .filter((r) => r.inNames.length === r.types.length
        && keys.every((k) => r.inNames.includes(k)) && r.need.every((k) => keys.includes(k)))
      .sort((a, b) => a.types.length - b.types.length);
    if (!procs.length) {
      throw bad('PGRST202', `Could not find the function public.${name}(${keys.join(', ')}) in the schema cache`, 404,
        `Searched for the function public.${name} with parameter${keys.length === 1 ? '' : 's'} ${keys.join(', ') || '(none)'}, but no matches were found in the schema cache.`);
    }
    const fn = procs[0];
    const vals = [];
    const call = `public.${q(name)}(` + keys.map((k) => {
      const type = fn.types[fn.inNames.indexOf(k)];
      vals.push(encArg(args[k], type));
      return `${q(k)} => ($${vals.length}::text)::${type}`;
    }).join(', ') + ')';
    return as(who, req.headers, async () => {
      if (fn.is_void) { await db.query(`select ${call}`, vals); return { status: 204 }; }
      const sql = fn.setof
        ? `select coalesce(json_agg(_t), '[]'::json)::text as body from ${call} _t`
        : `select to_json(${call})::text as body`;
      return { status: 200, text: (await db.query(sql, vals)).rows[0].body ?? 'null', setof: fn.setof };
    });
  }

  /* ── /rest/v1/<表・ビュー> ──────────────────────────────── */
  const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
  function selectList(s) {
    if (!s || s === '*') return '*';
    return s.split(',').map((raw) => {
      const item = raw.trim();
      if (item === '*') return '*';
      const m = /^(?:([a-z_][a-z0-9_]*):)?([a-z_][a-z0-9_]*)$/.exec(item);
      if (!m) throw bad('LOCAL400', '手元のサーバーが読めない select: ' + item.slice(0, 80));
      return m[1] ? `${q(m[2])} as ${q(m[1])}` : q(m[2]);
    }).join(', ');
  }
  function inList(s) {
    if (!/^\([\s\S]*\)$/.test(s)) throw bad('LOCAL400', 'in の形が読めない');
    const inner = s.slice(1, -1), out = [];
    let cur = '', quoted = false, any = false;
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (quoted) { if (ch === '\\' && i + 1 < inner.length) cur += inner[++i]; else if (ch === '"') quoted = false; else cur += ch; }
      else if (ch === '"') { quoted = true; any = true; }
      else if (ch === ',') { out.push(cur); cur = ''; any = false; }
      else { cur += ch; any = true; }
    }
    if (any || inner.length) out.push(cur);
    return out;
  }
  const CMP = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };
  function cond(col, raw) {
    let s = raw, neg = false;
    if (s.startsWith('not.')) { neg = true; s = s.slice(4); }
    const i = s.indexOf('.'), op = i < 0 ? s : s.slice(0, i), val = i < 0 ? '' : s.slice(i + 1), c = q(col);
    let sql;
    if (CMP[op]) sql = `${c} ${CMP[op]} ${lit(val)}`;
    else if (op === 'like' || op === 'ilike') sql = `${c} ${op} ${lit(val.replace(/\*/g, () => '%'))}`;
    else if (op === 'is' && /^(null|true|false|unknown)$/i.test(val)) sql = `${c} is ${val.toLowerCase()}`;
    else if (op === 'in') { const xs = inList(val); sql = xs.length ? `${c} in (${xs.map(lit).join(', ')})` : 'false'; }
    else throw bad('LOCAL400', `手元のサーバーが読めない絞り込み: ${col}=${raw.slice(0, 60)}`);
    return neg ? `not (${sql})` : sql;
  }
  function whereOf(sp) {
    const parts = [];
    for (const [k, v] of sp) {
      if (RESERVED.has(k)) continue;
      if (k === 'or' || k === 'and') throw bad('LOCAL400', '手元のサーバーは or / and をまだ読めない');
      parts.push(cond(k, v));
    }
    return parts.length ? ' where ' + parts.join(' and ') : '';
  }
  function orderOf(s) {
    if (!s) return '';
    return ' order by ' + s.split(',').map((item) => {
      const [col, ...mods] = item.trim().split('.');
      let out = q(col);
      for (const m of mods) {
        if (m === 'asc' || m === 'desc') out += ' ' + m;
        else if (m === 'nullsfirst') out += ' nulls first';
        else if (m === 'nullslast') out += ' nulls last';
        else throw bad('LOCAL400', '手元のサーバーが読めない order: ' + item.slice(0, 60));
      }
      return out;
    }).join(', ');
  }
  const intOf = (v) => (v !== null && /^\d+$/.test(v) ? Number(v) : null);

  async function rest(rel, req, url, bodyText, who) {
    const sp = url.searchParams, prefer = String(req.headers.prefer || ''), table = `public.${q(rel)}`;
    const cols = selectList(sp.get('select')), where = whereOf(sp);
    const want = /return=representation/.test(prefer);
    return as(who, req.headers, async () => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        let limit = intOf(sp.get('limit')), offset = intOf(sp.get('offset')) || 0;
        const range = /^(\d+)-(\d*)$/.exec(String(req.headers.range || ''));
        if (range) { offset = Number(range[1]); if (range[2] !== '') limit = Number(range[2]) - offset + 1; }
        const inner = `select ${cols} from ${table}${where}${orderOf(sp.get('order'))}` +
          (limit !== null ? ` limit ${limit}` : '') + (offset ? ` offset ${offset}` : '');
        const r = (await db.query(`select coalesce(json_agg(_t), '[]'::json)::text as body, count(*)::int as n from (${inner}) _t`)).rows[0];
        const total = /count=exact/.test(prefer)
          ? (await db.query(`select count(*)::int as n from ${table}${where}`)).rows[0].n : null;
        const cr = (r.n ? `${offset}-${offset + r.n - 1}` : '*') + '/' + (total === null ? '*' : total);
        return { status: 200, text: r.body, setof: true, headers: { 'Content-Range': cr } };
      }
      const data = bodyText ? JSON.parse(bodyText) : null;
      let sql, vals = [], status;
      if (req.method === 'POST') {
        const rows = Array.isArray(data) ? data : [data || {}];
        const keys = [...new Set(rows.flatMap((x) => Object.keys(x || {})))];
        const list = keys.map(q).join(', ');
        sql = keys.length
          ? `insert into ${table} (${list}) select ${list} from json_populate_recordset(null::${table}, ($1::text)::json)`
          : `insert into ${table} default values`;
        if (keys.length) vals = [JSON.stringify(rows)];
        const res = /resolution=(merge|ignore)-duplicates/.exec(prefer);
        if (res) {
          let target = (sp.get('on_conflict') || '').split(',').map((s) => s.trim()).filter(Boolean);
          if (!target.length) {
            target = (await db.query(
              `select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                where i.indrelid = '${table}'::regclass and i.indisprimary`)).rows.map((x) => x.attname);
          }
          const t = target.length ? ` (${target.map(q).join(', ')})` : '';
          sql += res[1] === 'merge' && target.length
            ? ` on conflict${t} do update set ${keys.map((k) => `${q(k)} = excluded.${q(k)}`).join(', ')}`
            : ` on conflict${t} do nothing`;
        }
        status = 201;
      } else if (req.method === 'PATCH') {
        const keys = Object.keys(data || {});
        if (!keys.length) return { status: 204 };
        const list = keys.map(q).join(', ');
        sql = `update ${table} set (${list}) = (select ${list} from json_populate_record(null::${table}, ($1::text)::json))${where}`;
        vals = [JSON.stringify(data)];
        status = want ? 200 : 204;
      } else if (req.method === 'DELETE') {
        sql = `delete from ${table}${where}`;
        status = want ? 200 : 204;
      } else throw bad('LOCAL405', 'method', 405);
      if (!want) { await db.query(sql, vals); return { status }; }
      const r = (await db.query(
        `with _w as (${sql} returning *) select coalesce(json_agg(_t), '[]'::json)::text as body from (select ${cols} from _w) _t`, vals)).rows[0];
      return { status, text: r.body, setof: true };
    });
  }

  /* ── 要求の入口 ─────────────────────────────────────────── */
  const state = { fail: { n: 0, match: '', mode: 'http' }, log: [] };
  const inject = '<script data-pv-local>(' + client.toString() + ')(' + JSON.stringify({
    key: STORAGE_KEY, otp: OTP, members: MEMBERS.map(({ key, ja, email }) => ({ key, ja, email })),
  }) + ');</script>';

  function sendJson(res, status, obj, headers = {}) {
    const text = obj === undefined ? '' : (typeof obj === 'string' ? obj : JSON.stringify(obj));
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(text);
  }

  async function api(req, res, url) {
    const who = whoOf(req);
    const note = (status) => { state.log.push({ m: req.method, p: url.pathname, role: who.role, status }); if (state.log.length > 400) state.log.shift(); };
    /* わざと失敗させる（送れなかった時の試験）。mode=drop は通信そのものを切る。 */
    if (state.fail.n > 0 && (!state.fail.match || req.url.includes(state.fail.match))) {
      state.fail.n--; note(state.fail.mode === 'drop' ? 0 : 503);
      if (state.fail.mode === 'drop') { req.socket.destroy(); return; }
      return sendJson(res, 503, { code: 'LOCAL503', details: null, hint: null, message: '手元の試験：わざと失敗させています' });
    }
    try {
      const bodyText = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : '';
      let out;
      if (url.pathname.startsWith('/auth/v1/')) {
        out = await locked(() => auth(req, url, bodyText));
        note(out.status);
        if (out.html) { res.writeHead(out.status, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' }); return res.end(out.html); }
        return out.status === 204 ? (res.writeHead(204), res.end()) : sendJson(res, out.status, out.body);
      }
      if (!url.pathname.startsWith('/rest/v1/')) throw bad('LOCAL404', '手元のサーバーには無い口: ' + url.pathname, 404);
      const rest1 = url.pathname.slice('/rest/v1/'.length);
      out = rest1.startsWith('rpc/')
        ? await locked(() => rpc(rest1.slice(4), bodyText ? JSON.parse(bodyText) : {}, who, req))
        : await locked(() => rest(rest1, req, url, bodyText, who));
      /* .single() ── 1行ちょうどでなければ 406（supabase-js が「0行」をこの形で見分ける） */
      if (out.text !== undefined && out.setof && /vnd\.pgrst\.object\+json/.test(String(req.headers.accept || ''))) {
        const rows = JSON.parse(out.text);
        if (rows.length !== 1) {
          note(406);
          return sendJson(res, 406, { code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null,
            message: 'JSON object requested, multiple (or no) rows returned' });
        }
        out.text = JSON.stringify(rows[0]);
      }
      note(out.status);
      if (out.text === undefined || req.method === 'HEAD') {
        res.writeHead(out.status, { 'Cache-Control': 'no-store', ...(out.headers || {}) }); return res.end();
      }
      return sendJson(res, out.status, out.text, out.headers);
    } catch (e) {
      if (e.local) { note(e.local.status); return sendJson(res, e.local.status, e.local.body); }
      if (e instanceof SyntaxError) { note(400); return sendJson(res, 400, { code: 'PGRST102', details: null, hint: null, message: 'Empty or invalid json' }); }
      const status = pgStatus(e.code, who.role);
      note(status);
      if (e.code === '42P01') {
        return sendJson(res, 404, { code: 'PGRST205', details: null, hint: null, message: String(e.message) });
      }
      return sendJson(res, status, { code: e.code || 'LOCAL500', details: e.detail || null, hint: e.hint || null, message: String(e.message || e) });
    }
  }

  async function local(req, res, url) {
    const p = url.pathname.slice('/__local/'.length), sp = url.searchParams;
    if (p === 'login') {
      const m = MEMBERS.find((x) => x.key === sp.get('member'));
      if (!m) return sendJson(res, 404, { ok: false });
      const out = await locked(async () => {
        const u = await userRow('id = $1', m.id);
        const prof = (await db.query(`select to_json(p)::text as j from public.profiles p where id = $1`, [m.id])).rows[0];
        return { session: sessionOf(u), pv_user: { ...(prof ? JSON.parse(prof.j) : { id: u.id }), email: u.email } };
      });
      return sendJson(res, 200, out);
    }
    if (p === 'fail') {
      state.fail = { n: Number(sp.get('n')) || 0, match: sp.get('match') || '', mode: sp.get('mode') === 'drop' ? 'drop' : 'http' };
      return sendJson(res, 200, { ok: true, fail: state.fail });
    }
    if (p === 'requests') return sendJson(res, 200, state.log);
    if (p === 'state') {
      const counts = await locked(async () => {
        const out = {};
        for (const t of ['profiles', 'airline_conditions', 'pay_reports', 'reviews_v2', 'pv_stay_places']) {
          out[t] = (await db.query(`select count(*)::int as n from public.${t}`)).rows[0].n;
        }
        return out;
      });
      return sendJson(res, 200, { ok: true, dir: path.relative(ROOT, dir) || '.', otp: OTP, fail: state.fail, counts,
        members: MEMBERS.map(({ key, ja, email }) => ({ key, ja, email })) });
    }
    return sendJson(res, 404, { ok: false });
  }

  function file(req, res, url) {
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
    let filePath = path.join(ROOT, rel);
    // ドット始まり（.local-db ・ .env ・ .git ・名簿）は配らない。ルートの外へも出ない。
    const hidden = rel.split('/').some((s) => s.length > 1 && s.startsWith('.'));
    if (hidden || !filePath.startsWith(ROOT)) { res.writeHead(404); return res.end('Not found'); }
    if (filePath.endsWith('/') || !path.extname(filePath)) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.html') {
        /* 配る瞬間にだけ ── 解析タグを外し、<head> の直後に切替を差し込む */
        let html = data.toString('utf8').replace(/<!--PV-3P-->[\s\S]*?<!--\/PV-3P-->/g, () => '');
        const before = html;
        html = html.replace(/<head[^>]*>/i, (m) => m + inject);
        if (html === before) html = inject + html;
        data = Buffer.from(html, 'utf8');
      }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://local');
    const p = url.pathname;
    if (p.startsWith('/__local/')) return local(req, res, url).catch((e) => sendJson(res, 500, { ok: false, message: String(e.message || e) }));
    if (/^\/(rest|auth|functions|storage|realtime)\/v1(\/|$)/.test(p)) return api(req, res, url);
    return file(req, res, url);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });

  let closed = false;
  async function close() {
    if (closed) return; closed = true;
    await new Promise((r) => { server.close(r); server.closeAllConnections?.(); });
    await chain; await db.close();
    try { fs.unlinkSync(lock); } catch {}
  }
  const at = server.address().port;
  return { port: at, url: `http://localhost:${at}`, db, locked, state, close, dir };
}

/* ── コマンドとして呼ばれたとき ──────────────────────────── */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  try {
    const srv = await start({
      port: Number(val('--port') || process.env.PV_LOCAL_PORT || 3100),
      host: val('--host'), dir: val('--db'), reset: argv.includes('--reset'),
    });
    console.log(`  手元のサーバー ${srv.url}（本番とは通信しない・メールのコードは ${OTP}）`);
    const stop = () => srv.close().then(() => process.exit(0), () => process.exit(1));
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  } catch (e) {
    console.error('✗ ' + String(e.message || e).slice(0, 400));
    process.exit(1);
  }
}
