/* db/stays.sql を本物の Postgres（PGlite = PG17 の WASM ビルド）に流して確かめる。

   実行: node db/test-stays.mjs   （または npm run test:sql）
   ネットワーク不要・本番に一切触らない。SQL を直したら必ずこれを通してから
   オーナーに実行を依頼すること。

   器は db/test-requests.mjs と同じ（anon / authenticated ロール、既定権限を
   全付与した状態、auth.uid() の代役、profiles、auth.users）。
   ★既定権限を先に全付与してあるからこそ stays.sql の revoke が意味を持つ。
     ここでは**関数にも**既定で実行権を配ってある（Supabase の本番がそうなっている）。
     無いと「元から権限が無いだけ」を「revoke が効いた」と誤読する。

   ここでいちばん大事な3行:
     ★ 資格の無い人には1文字も返らない。
       「名前が無い」だけでなく、返った JSON が決まった数種類の定型文の
       **どれかと完全に同じ**であることまで見る（最後の「全部の返事」の節）。
     ★ 通れるのは profiles.verify_level >= 1 の人と運営だけ。
       給与の鍵・バッジ・プロフィールの会社と職位では通れない。
     ★ author_hash が画面へ1回も出ないこと。A さんの実際のハッシュ値が
       JSON のどこにも無いことまで見る。
     ★ 写真の撮影情報は、**画面を通さずに関数を直接呼んでも**残らない。
       場所（GPS）・日時・機種の入った JPEG をこのファイルの中で組み立てて
       pv_stay_photo_add へそのまま渡し、表の中身と pv_stay_photo の返事の両方を見る
       （「写真の撮影情報」の節）。表へ直接入れる道は CHECK が止める。

   ⚠️ 撮影情報の入った見本は全部ここで組み立てる（検査のために写真のファイルを足さない）。
      撮影情報の中の場所は空港の標点（公表されている値）で、誰かの居場所ではない。
      リポジトリに元から在る写真（assets/ の、描き直して書き出したもの）は
      「画面から来る普通の写真が通ること」を見るために読むだけ（撮影情報は元から無い）。

   ⚠️ set_config の第3引数は **false**（＝セッション全体）でなければならない。
      true にすると次の文では auth.uid() が null に戻り、
      「権限で弾かれた」という判定が全部空振りのまま緑になる。

   ⚠️ ここに出てくるホテル・店の名前は全部作り物（「テスト用ホテルA」など）。
      実在のステイ先を1つも書かない。
*/
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const STAYS_SQL = read('db/stays.sql');
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + e : ''))); };
const J = (v) => JSON.stringify(v);
const keys = (o) => Object.keys(o || {}).sort().join(',');

const ANON  = Symbol('anon');                               // 未ログイン
const V1    = '00000000-0000-4000-8000-0000000000a1';       // 確認の印あり（1）
const V2    = '00000000-0000-4000-8000-0000000000a2';       // 確認の印あり（2）
const V3    = '00000000-0000-4000-8000-0000000000a3';       // 印を付けたあとで外される人
const U     = '00000000-0000-4000-8000-0000000000b1';       // 登録しただけ
const PAY   = '00000000-0000-4000-8000-0000000000b2';       // 給与を出した（鍵が生きている）
const PROF  = '00000000-0000-4000-8000-0000000000b3';       // プロフィールに会社と職位を書いた
const BADGE = '00000000-0000-4000-8000-0000000000b4';       // バッジと鍵だけ持っている（印は無い）
const GHOST = '00000000-0000-4000-8000-0000000000b5';       // ログインはあるが profiles の行が無い
const REV   = '00000000-0000-4000-8000-0000000000b6';       // 口コミを出した（口コミの鍵を持つ）
const OP    = '00000000-0000-4000-8000-00000000ad11';       // 運営その1
const OP2   = '00000000-0000-4000-8000-00000000ad22';       // 運営その2
const NAMES = new Map([[V1, 'V1'], [V2, 'V2'], [V3, 'V3'], [U, 'U'], [PAY, 'PAY'], [PROF, 'PROF'],
                       [BADGE, 'BADGE'], [GHOST, 'GHOST'], [REV, 'REV'], [OP, 'OP'], [OP2, 'OP2'], [ANON, 'ANON']]);
/* 資格の無い人たち（未ログインを含む）。この人たちへの返事は最後にまとめて見る。 */
const OUTSIDERS = [ANON, U, PAY, PROF, BADGE, GHOST, REV];

/* サーバと同じ式を手元で作る（返事にハッシュが混ざっていないかを見るため） */
const hashOf = (uid, sep = '::pv_hotel::') => createHash('sha256').update(uid + sep).digest('hex');

// ── 器 ───────────────────────────────────────────────────────
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;

  create table public.profiles (
    id uuid primary key, email text, name text,
    gender text, birthdate date, country text, company text, "position" text
  );
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('pv.uid', true), '')::uuid $$;
  /* 口コミの表（db/pay-rows.sql が触る列まで含めた最小形）。
     ★db/test-requests.mjs から写した。あちらを増やしたらここも増やす。 */
  create table public.reviews_v2 (
    id uuid primary key default gen_random_uuid(),
    proof_hash text not null, airline text not null, "position" text,
    annual_salary            integer,
    base_annual              integer,
    flight_allowance_annual  integer,
    monthly_salary           integer,
    bonus                    integer,
    created_at timestamptz not null default now()
  );
`);

console.log('\n▼ SQL の適用');
/* 並びは本番でオーナーが貼る順番。stays.sql が要るのは
   会社の名簿（airlines）・確認の印の列（pay-reports）・運営の判定（pay-rows）・運営の名簿（admin）。 */
const FILES = ['db/airlines.generated.sql', 'db/vocab.generated.sql',
               'db/schema-additions.sql', 'db/pay-reports.sql',
               'db/pay-report-pending.sql', 'db/pay-rows.sql',
               'db/admin.sql', 'db/stays.sql'];
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f); }
  catch (e) { ok(false, f, e.message); process.exit(1); }
}

console.log('\n▼ 冪等性（もう一度そのまま流す）');
for (const f of FILES) {
  try { await db.exec(read(f)); ok(true, f + ' 再適用OK'); }
  catch (e) { ok(false, f + ' 再適用で失敗', e.message); }
}

// ── 出入り口 ─────────────────────────────────────────────────
const as = async (who) => {
  await db.exec(who === ANON ? `set role anon` : `set role authenticated`);
  await db.query(`select set_config('pv.uid', $1, false)`, [who === ANON ? '' : who]);
};
const asOwner = async () => {
  await db.exec(`reset role`);
  await db.query(`select set_config('pv.uid', '', false)`);
};
/* その人として1文だけ走らせる。返り値は {v} か {err}。 */
const call = async (who, sql, params = []) => {
  await as(who);
  try { return { v: (await db.query(sql, params)).rows[0] }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await asOwner(); }
};
/* 関数を呼ぶ。返った JSON は全部ためておく（最後に漏れを見る）。
   p === undefined は SQL の NULL。それ以外は JSON にして渡す。 */
const seen = [];
const rpc = async (who, fn, p) => {
  const r = await call(who, `select public.${fn}($1::jsonb) as v`, [p === undefined ? null : J(p)]);
  if (r.err) return { __err: r.err };
  seen.push({ who, fn, json: J(r.v.v) });
  return r.v.v;
};
const denied = (r) => !!(r && r.__err && /permission denied/i.test(r.__err));
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

const stays    = (who, airline = 'etihad', iata = 'NRT') => rpc(who, 'pv_stays', { airline, iata });
const add      = (who, o) => rpc(who, 'pv_stay_add', o);
const upd      = (who, o) => rpc(who, 'pv_stay_update', o);
const photoAdd =(who, place, b64, w, h) => rpc(who, 'pv_stay_photo_add', { place, b64, w, h });
const photo    = (who, id) => rpc(who, 'pv_stay_photo', { id });
/* rev ＝ 運営が見た版の印。直された場所を公開へ戻すときだけ要る（添えない呼び出しは今までと同じ形） */
const moderate = (who, target, id, state, rev) =>
  rpc(who, 'pv_stay_moderate', rev === undefined ? { target, id, state } : { target, id, state, rev });
const del      = (who, target, id) => rpc(who, 'pv_stay_delete', { target, id });
const queue    = (who) => rpc(who, 'pv_stay_queue', {});
const find     = (v, id) => ((v && v.places) || []).find((x) => x.id === id);

/* ★時計を進める代わりに、書けた行を過去へずらす（オーナーとして）。
   30秒の連投制限に毎回引っかかると、以降の検査が全部「連投」で緑にも赤にもならない。
   25時間ずらすので、1日の上限にも数えられなくなる（上限そのものは専用の節で見る）。 */
const ageOut = async () => {
  await db.exec(`
    update public.pv_stay_places set created_at = created_at - interval '25 hours'
     where created_at > now() - interval '24 hours';
    update public.pv_stay_photos set created_at = created_at - interval '25 hours'
     where created_at > now() - interval '24 hours';`);
};
const addFresh = async (who, o) => { await ageOut(); return add(who, o); };
const P = (airline, iata, kind, name, more = {}) => ({ airline, iata, kind, name, ...more });

/* 定型の返事（資格の無い人へ返ってよいのはこの形だけ） */
const LOCKED_READ = '{"ok":true,"state":"locked"}';
const LOCKED      = '{"ok":false,"status":"locked"}';
const FORBIDDEN   = '{"ok":false,"status":"forbidden"}';
const NOT_FOUND   = '{"ok":false,"status":"not_found"}';
const BAD_TARGET  = '{"ok":false,"status":"bad_target"}';
const status = (v) => (v && v.__err) ? 'ERR ' + v.__err : (v && v.ok === false ? v.status : (v && v.ok === true ? 'ok' : J(v)));

// ── 画像の見本 ───────────────────────────────────────────────
/* 1×1 の JPEG（160バイト）と PNG。db/test-requests.mjs と同じもの。 */
const JPEG_SRC = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS'
               + 'Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAB'
               + 'AAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAA'
               + 'AAD/2gAIAQEAAD8AKp//2Q==';
const PNG  = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
/* 元の見本（JFIF の頭が「版 1.1・密度 96」）。サーバーは頭を書き直すので、これはそのままでは保存されない。 */
const srcBuf = Buffer.from(JPEG_SRC, 'base64');
/* ★サーバーが保存するのは「決まった形に作り直した JPEG」だけ（db/stays.sql の 3-i）。
     頭は毎回同じ18バイト（JFIF・版 1.1・密度の単位なし 1×1・縮小画像なし）。
     ふだん使う見本は、最初からその形にしておく ＝ 送ったものと保存されたものが1バイトも違わない。 */
const J_SOI  = Buffer.from([0xff, 0xd8]);
const J_APP0 = Buffer.from('ffe000104a46494600010100000100010000', 'hex');
const jpegBuf = Buffer.concat([J_SOI, J_APP0, srcBuf.subarray(20)]);
const JPEG = jpegBuf.toString('base64');
/* 見本の JPEG の中の場所（0 から数える）:
     0-1 頭（SOI）／2-19 JFIF（APP0）／20-88 量子化表（DQT）／89-101 大きさ（SOF0）／
     102-145 ハフマン表（DHT）×2／146-155 画像データの印（SOS）／156-157 画像データ／158-159 終わり（EOI）
     大きさ（SOF0）の中: 93 精度／94-95 高さ／96-97 幅 */
const J_BODY = jpegBuf.subarray(20);          // 量子化表から終わりの印まで
const J_HEAD = jpegBuf.subarray(0, 156);      // 頭から画像データの印まで
const J_EOI  = Buffer.from([0xff, 0xd9]);
/* 中身が1枚ずつ違う JPEG。量子化表の中の3バイトを変える。
   ⚠️ 末尾に足す形に戻さない。サーバーは終わりの印より後ろを切り落とすので、全部「同じ写真」になる。 */
const jpegN = (n) => {
  const b = Buffer.from(jpegBuf);
  b[40] = 1 + (n % 250); b[41] = 1 + (Math.floor(n / 250) % 250); b[42] = 0xee;
  return b.toString('base64');
};
/* 指定したバイト数ちょうどの、JPEG として読める形のデータ
   （頭は見本と同じ・画像データを 0x41 で埋めて、終わりの印で閉じる） */
const sizedBuf = (bytes) => Buffer.concat([J_HEAD, Buffer.alloc(bytes - J_HEAD.length - 2, 0x41), J_EOI]);
const sized = (bytes) => sizedBuf(bytes).toString('base64');
/* JPEG の顔をしているだけのデータ（先頭4バイトだけ JPEG・あとは埋め草） */
const junk = (bytes) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
                                       Buffer.alloc(bytes - 4, 0x41)]).toString('base64');
/* JPEG の入れ物を1つ作る（印 ＋ 長さ2バイト ＋ 中身） */
const seg = (marker, payload) => {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
  const l = body.length + 2;
  return Buffer.concat([Buffer.from([0xff, marker, l >> 8, l & 255]), body]);
};
/* 見本の JPEG の頭に、入れ物を挟んだもの */
const withSegs = (...segs) => Buffer.concat([J_SOI, J_APP0, ...segs, J_BODY]);
/* 撮影情報の入れ物の見本（中身は全部作り物。目印の文字列が保存後に残っていないかを見る） */
const SEG = {
  exif:  seg(0xe1, Buffer.concat([Buffer.from('Exif\0\0II*\0', 'latin1'),
                                  Buffer.from('GPS-TEST 35.000N 139.000E / 2026:01:02 03:04:05 / TEST-CAMERA-MODEL')])),
  xmp:   seg(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>XMP-TEST-MARK</x:xmpmeta>'),
  iptc:  seg(0xed, 'Photoshop 3.0\0' + '8BIM IPTC-TEST-MARK'),
  com:   seg(0xfe, 'COMMENT-TEST-MARK'),
  jfxx:  seg(0xe0, Buffer.concat([Buffer.from('JFXX\0', 'latin1'), Buffer.from([0x13, 1, 1, 0xaa, 0xbb, 0xcc]), Buffer.from('JFXX-TEST-MARK')])),
  mpf:   seg(0xe2, Buffer.concat([Buffer.from('MPF\0II*\0', 'latin1'), Buffer.from('MPF-TEST-MARK')])),
  c2pa:  seg(0xeb, Buffer.concat([Buffer.from('JP\0\0', 'latin1'), Buffer.from('jumb C2PA-TEST-MARK')])),
  /* 色の決まり。前は残していたが、いまは落とす（頭の APPn は1つも写さない） */
  icc:   seg(0xe2, Buffer.concat([Buffer.from('ICC_PROFILE\0', 'latin1'), Buffer.from([1, 1]), Buffer.alloc(40, 0x33)])),
  adobe: seg(0xee, Buffer.concat([Buffer.from('Adobe', 'latin1'), Buffer.from([0, 100, 0, 0, 0, 0, 1])])),
};
const MARKS = ['Exif', 'GPS-TEST', 'TEST-CAMERA-MODEL', 'XMP-TEST-MARK', 'IPTC-TEST-MARK', 'COMMENT-TEST-MARK',
               'JFXX', 'MPF-TEST-MARK', 'C2PA-TEST-MARK', 'ICC_PROFILE', 'Adobe', 'TRAILER-TEST-MARK'];

/* ── 場所・日時・機種の入った Exif を、ここで組み立てる（TIFF・リトルエンディアン） ──
   ★本物の写真から写したものではない。値は全部作り物。
     場所は成田空港の標点（公表値 北緯35度45分55秒・東経140度23分08秒）＝ 誰の居場所でもない。 */
const GPS = { lat: [35, 45, 55], lon: [140, 23, 8], when: '2026:01:02 03:04:05',
              make: 'TEST-CAMERA-MAKER', model: 'TEST-CAMERA-MODEL-X1' };
const u16le = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32le = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const ratLE = (a) => Buffer.concat(a.flatMap((n) => [u32le(n), u32le(1)]));       // 度・分・秒（分母は 1）
const GPS_LAT_BYTES = ratLE(GPS.lat);
const GPS_LON_BYTES = ratLE(GPS.lon);
const exifGps = () => {
  const asc = (s) => Buffer.from(s + '\0', 'latin1');
  const make = asc(GPS.make), model = asc(GPS.model), when = asc(GPS.when);
  const ent = (tag, type, count, val) => Buffer.concat([u16le(tag), u16le(type), u32le(count),
    Buffer.isBuffer(val) ? Buffer.concat([val, Buffer.alloc(4 - val.length)]) : u32le(val)]);
  const dataAt = 8 + 2 + 4 * 12 + 4;                    // TIFF の頭 ＋ 0番の表（4行）
  const makeAt = dataAt, modelAt = makeAt + make.length, whenAt = modelAt + model.length;
  const gpsAt = whenAt + when.length;                   // GPS の表（4行）
  const latAt = gpsAt + 2 + 4 * 12 + 4, lonAt = latAt + 24;
  const tiff = Buffer.concat([
    Buffer.from('II*\0', 'latin1'), u32le(8),
    u16le(4), ent(0x010f, 2, make.length, makeAt), ent(0x0110, 2, model.length, modelAt),
              ent(0x0132, 2, when.length, whenAt), ent(0x8825, 4, 1, gpsAt), u32le(0),
    make, model, when,
    u16le(4), ent(1, 2, 2, asc('N')), ent(2, 5, 3, latAt), ent(3, 2, 2, asc('E')), ent(4, 5, 3, lonAt), u32le(0),
    GPS_LAT_BYTES, GPS_LON_BYTES]);
  return seg(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]));
};
/* 上の Exif から場所を読み戻す（見本に本当に場所が入っていることを確かめるための、素朴な読み手） */
const readGps = (buf) => {
  const at = buf.indexOf(Buffer.from('Exif\0\0', 'latin1'));
  if (at < 0) return null;
  const t = buf.subarray(at + 6);
  if (t.length < 14 || t.toString('latin1', 0, 2) !== 'II') return null;
  const dir = (off) => {
    const n = t.readUInt16LE(off), o = {};
    for (let i = 0; i < n; i++) { const e = off + 2 + 12 * i; o[t.readUInt16LE(e)] = t.readUInt32LE(e + 8); }
    return o;
  };
  const gps = dir(t.readUInt32LE(4))[0x8825];
  if (!gps) return null;
  const g = dir(gps);
  const dms = (off) => [0, 8, 16].map((d) => t.readUInt32LE(off + d) / t.readUInt32LE(off + d + 4));
  return { lat: dms(g[2]), lon: dms(g[4]) };
};
/* 場所を字で持つ XMP（Exif を消しても、こちらに同じ値が残っていることがある） */
const XMP_GPS = seg(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><rdf:Description exif:GPSLatitude="35,45.9167N" '
                        + 'exif:GPSLongitude="140,23.1333E" tiff:Model="' + GPS.model + '"/></x:xmpmeta>');
/* 保存後に1つでも残っていたら負け、という目印（字と、度分秒のバイト列） */
const GPS_MARKS = [Buffer.from('Exif'), Buffer.from('35,45.9167N'), Buffer.from('140,23.1333E'),
                   Buffer.from(GPS.make), Buffer.from(GPS.model), Buffer.from(GPS.when), Buffer.from('xmpmeta'),
                   Buffer.from('COMMENT-TEST-MARK'), Buffer.from('TRAILER-TEST-MARK'), GPS_LAT_BYTES, GPS_LON_BYTES];
const gpsMarksIn = (buf) => GPS_MARKS.filter((m) => buf.includes(m)).map((m) => m.toString('latin1').replace(/[^\x20-\x7e]/g, '.'));

/* 大きさ（SOF）の欄だけを書き換えた見本。量子化表も変えて、ほかの見本と中身が重ならないようにする */
const jpegWH = (w, h, n = 0) => {
  const b = Buffer.from(jpegBuf);
  b.writeUInt16BE(h, 94); b.writeUInt16BE(w, 96);
  b[43] = 1 + (n % 250); b[44] = 0xdd;
  return b;
};

/* ── 手元の物差し（SQL とは別に、いちばん素朴に書いた読み方） ──
   節に分ける。符号データは「FF の後ろが 00 でも RST でもない」所まで。 */
const jsParts = (buf) => {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out = [];
  let i = 2;
  for (;;) {
    while (buf[i] === 0xff && buf[i + 1] === 0xff) i++;
    if (buf[i] !== 0xff || i + 1 >= buf.length) return null;
    const m = buf[i + 1];
    if (m === 0xd9) return out;
    if (i + 4 > buf.length) return null;
    let end = i + 2 + buf.readUInt16BE(i + 2);
    if (m === 0xda) {
      while (end < buf.length - 1
             && !(buf[end] === 0xff && buf[end + 1] !== 0x00 && !(buf[end + 1] >= 0xd0 && buf[end + 1] <= 0xd7))) end++;
    }
    if (end > buf.length) return null;
    out.push({ m, bytes: buf.subarray(i, end) });
    i = end;
  }
};
/* 「落とすものを落として、決まった頭を付けたら、こうなるはず」 */
const jsStrip = (buf) => {
  const p = jsParts(buf);
  return p && Buffer.concat([J_SOI, J_APP0, ...p.filter((s) => !(s.m >= 0xe0 && s.m <= 0xef) && s.m !== 0xfe).map((s) => s.bytes), J_EOI]);
};
/* 符号データ（SOS から次の印の手前まで）だけを取り出す */
const scansOf = (buf) => { const p = jsParts(buf); return p ? Buffer.concat(p.filter((s) => s.m === 0xda).map((s) => s.bytes)) : null; };

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 人を作る');
for (const [uid, mail] of [[V1, 'v1@example.com'], [V2, 'v2@example.com'], [V3, 'v3@example.com'],
                           [U, 'u@example.com'], [PAY, 'pay@example.com'], [PROF, 'prof@example.com'],
                           [BADGE, 'badge@example.com'], [REV, 'rev@example.com'],
                           [OP, 'ops@example.com'], [OP2, 'ops2@example.com']]) {
  await db.query(`insert into auth.users(id,email) values($1,$2)`, [uid, mail]);
  await db.query(`insert into public.profiles(id,email) values($1,$2)
                  on conflict (id) do nothing`, [uid, mail]);
}
await db.query(`insert into auth.users(id,email) values($1,$2)`, [GHOST, 'ghost@example.com']);
await db.query(`delete from public.profiles where id = $1`, [GHOST]);
for (const uid of [OP, OP2]) {
  await db.query(`insert into public.pv_admins(user_id, note) values($1,'テスト')
                  on conflict (user_id) do nothing`, [uid]);
}
/* 確認の印はサーバー（＝ここではオーナー）だけが付ける */
await db.query(`update public.profiles set verify_level = 1, verified_at = now() where id = $1`, [V1]);
await db.query(`update public.profiles set verify_level = 2, verified_at = now() where id = $1`, [V2]);

{ /* 給与を出した人 ── 本物の口（submit_pay_report）を通して、鍵が生きている状態にする */
  const YEAR = new Date().getFullYear() - 1;   // 今年だと「未来の月」で落ちる月が出る
  const r = await call(PAY, `select public.submit_pay_report($1::jsonb) as v`,
    [J({ currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: 'b777', position: 'cap',
         airline: 'etihad', period_year: YEAR, period_month: 3, gross_monthly: 9000 })]);
  const p = await one(`select access_until > now() as live, verify_level from public.profiles where id = $1`, [PAY]);
  ok(p.live === true && Number(p.verify_level) === 0,
     '給与を出した人: 給与の鍵（access_until）は生きているが、確認の印は付いていない',
     J(p) + ' / ' + J(r));
}
{ /* プロフィールを書いた人 ── 会員として自分で会社と職位を書く */
  const a = await call(PROF, `update public.profiles set company = $2 where id = $1 returning id`, [PROF, 'etihad']);
  const b = await call(PROF, `update public.profiles set "position" = $2 where id = $1 returning id`, [PROF, 'cap']);
  const p = await one(`select company, "position", verify_level from public.profiles where id = $1`, [PROF]);
  ok(!a.err && !b.err && p.company === 'etihad' && p.position === 'cap' && Number(p.verify_level) === 0,
     'プロフィールを書いた人: 会社と職位は自分で書けた（印は 0 のまま）', J({ a, b, p }));
  /* ★ここが門の土台。会員が確認の印を自分で書けたら、あとの検査は全部意味が無い */
  const c = await call(PROF, `update public.profiles set verify_level = 2 where id = $1 returning id`, [PROF]);
  const d = await call(PROF, `update public.profiles set verify_level = 2, name = 'x' where id = $1 returning id`, [PROF]);
  const p2 = await one(`select verify_level from public.profiles where id = $1`, [PROF]);
  ok(/permission denied/i.test(c.err || '') && /permission denied/i.test(d.err || '') && Number(p2.verify_level) === 0,
     '会員は確認の印（verify_level）を自分で書けない', J({ c, d, p2 }));
}
/* バッジと鍵だけ持っている人 ── 印（verify_level）以外を全部「それらしく」しておく */
await db.query(`update public.profiles
                   set badge = 'gold', badge_state = 'active', verified_airline = 'etihad',
                       verified_at = now(), access_until = now() + interval '1 year',
                       company = 'etihad', "position" = 'cap'
                 where id = $1`, [BADGE]);
ok(Number((await one(`select verify_level from public.profiles where id = $1`, [BADGE])).verify_level) === 0,
   'バッジだけの人: badge=gold・verified_airline・鍵は在るが、確認の印は 0');
{ /* 口コミを出した人 ── 口コミの鍵は「reviews_v2 に自分の proof_hash の行が在る」こと
     （式は db/reviews-gate.sql の pv_review_hash と同じ: sha256(uid || '::pv_anon::' || 会社 || '::2026')） */
  const proof = createHash('sha256').update(REV + '::pv_anon::' + 'etihad' + '::2026').digest('hex');
  await db.query(`insert into public.reviews_v2 (proof_hash, airline, "position") values ($1, 'etihad', 'cap')`, [proof]);
  const p = await one(`select (select count(*)::int from public.reviews_v2 where proof_hash = $2) as n, verify_level
                         from public.profiles where id = $1`, [REV, proof]);
  ok(p.n === 1 && Number(p.verify_level) === 0, '口コミを出した人: 口コミの鍵の元（自分の proof_hash の行）は在るが、確認の印は 0', J(p));
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 表は閉じている（直接は1行も読めない・書けない）');
for (const t of ['pv_stay_places', 'pv_stay_photos']) {
  const c = await one(`select relrowsecurity as rls from pg_class where oid = ('public.' || $1)::regclass`, [t]);
  const pol = await one(`select count(*)::int as n from pg_policies where schemaname='public' and tablename=$1`, [t]);
  ok(c.rls === true && pol.n === 0, `${t}: RLS が有効で、ポリシーは 0 本`, J({ c, pol }));
  const privs = (await db.query(
    `select r, p, has_table_privilege(r, ('public.' || $1)::regclass, p) as has
       from unnest(array['anon','authenticated']) r,
            unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p`, [t])).rows;
  ok(privs.length === 14 && privs.every((x) => x.has === false),
     `${t}: anon にも authenticated にも権限が1つも無い`, J(privs.filter((x) => x.has)));
  const pub = await one(
    `select count(*)::int as n from pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      where c.oid = ('public.' || $1)::regclass and a.grantee = 0`, [t]);
  ok(pub.n === 0, `${t}: PUBLIC にも権限が無い`);
  /* 確認の印を持つ人でも、表は直接読めない（出入りは関数だけ） */
  const s = await call(V1, `select count(*) from public.${t}`);
  const i = await call(V1, `delete from public.${t}`);
  const a = await call(ANON, `select count(*) from public.${t}`);
  ok(/permission denied/i.test(s.err || '') && /permission denied/i.test(i.err || '') && /permission denied/i.test(a.err || ''),
     `${t}: 印を持つ人も未ログインも、直接は読めない・消せない`, J({ s, i, a }));
}
{
  const cols = (await db.query(
    `select table_name as t, column_name as c, data_type as d from information_schema.columns
      where table_schema = 'public' and table_name in ('pv_stay_places','pv_stay_photos')`)).rows;
  const uu = cols.filter((x) => x.d === 'uuid').map((x) => x.t + '.' + x.c).sort().join(',');
  ok(uu === 'pv_stay_photos.id,pv_stay_photos.place_id,pv_stay_places.id',
     'uuid の列は id と place_id だけ（生の user_id を入れる場所が無い）', uu);
  const bad = cols.filter((x) => /user|uid|owner|email|moderated_by|approved_by/i.test(x.c));
  ok(bad.length === 0, '会員を指す列（user_id・owner・moderated_by など）が無い', J(bad));
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 関数の配り方');
/* 期待: 画面から呼べるのは8本だけ。未ログインに配るのは pv_stays の1本だけ。 */
const GRANTS = {
  pv_stays: 'anon,auth',
  pv_stay_add: 'auth', pv_stay_update: 'auth', pv_stay_photo_add: 'auth', pv_stay_photo: 'auth',
  pv_stay_moderate: 'auth', pv_stay_delete: 'auth', pv_stay_queue: 'auth',
  pv_stay_hash: '', pv_is_verified_pilot: '', pv_stay_role: '', pv_stay_visible: '',
  pv_stay_age: '', pv_stay_uuid: '', pv_stay_maps_url: '', pv_stay_place_json: '',
  /* 場所の中身の検品と、同じ名前の判定（足す口と直す口が同じものを呼ぶ。誰にも配らない） */
  pv_stay_clean: '', pv_stay_clash: '',
  /* 運営が見た版の印（一覧と待ち行列が運営にだけ添える。誰にも配らない） */
  pv_stay_rev: '',
  /* 写真を作り直す部品（4本とも誰にも配らない） */
  pv_jpeg_read: '', pv_jpeg_strip: '', pv_jpeg_is_clean: '', pv_jpeg_dims: '',
};
const grantsNow = async () => (await db.query(
  `select p.proname as name, p.prosecdef as def, coalesce(array_to_string(p.proconfig, '|'), '') as cfg,
          has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
          exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                   where a.grantee = 0) as pub
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'pv\\_stay%' or p.proname like 'pv\\_jpeg%' or p.proname = 'pv_is_verified_pilot')
    order by p.proname, p.oid`)).rows;
const checkGrants = async (label) => {
  const rows = await grantsNow();
  ok(rows.length === 23 && rows.map((r) => r.name).join(',') === Object.keys(GRANTS).sort().join(','),
     `${label}関数は23本ちょうど（同じ名前の別署名が残っていない・前の部品 pv_stay_jpeg_clean は消えている）`, rows.map((r) => r.name).join(','));
  const wrong = rows.filter((r) => [r.anon && 'anon', r.auth && 'auth'].filter(Boolean).join(',') !== GRANTS[r.name]);
  ok(wrong.length === 0, `${label}呼べる人が期待どおり（未ログインは pv_stays だけ・部品は誰も呼べない）`, J(wrong));
  ok(rows.every((r) => r.pub === false), `${label}PUBLIC に実行権が残っていない`, J(rows.filter((r) => r.pub)));
  ok(rows.every((r) => /search_path=/.test(r.cfg)), `${label}どの関数にも search_path が付いている`,
     J(rows.filter((r) => !/search_path=/.test(r.cfg)).map((r) => r.name)));
  const needDef = ['pv_stays', 'pv_stay_add', 'pv_stay_update', 'pv_stay_photo_add', 'pv_stay_photo', 'pv_stay_moderate',
                   'pv_stay_delete', 'pv_stay_queue', 'pv_is_verified_pilot', 'pv_stay_role'];
  ok(rows.filter((r) => r.def).map((r) => r.name).sort().join(',') === needDef.sort().join(','),
     `${label}security definer は表を読む10本だけ`, rows.filter((r) => r.def).map((r) => r.name).join(','));
};
await checkGrants('');
{
  /* 部品は、確認の印を持つ人からも呼べない */
  const tries = [
    [`select public.pv_stay_hash($1::uuid) as v`, [V1]],
    [`select public.pv_is_verified_pilot() as v`, []],
    [`select public.pv_stay_role() as v`, []],
    [`select public.pv_stay_visible('pending', 'a', 'b', true) as v`, []],
    [`select public.pv_stay_age(now()) as v`, []],
    [`select public.pv_stay_uuid($1) as v`, [V1]],
    [`select public.pv_stay_maps_url('https://www.google.com/maps') as v`, []],
    [`select octet_length(public.pv_jpeg_strip(decode($1, 'base64'))) as v`, [JPEG]],
    [`select octet_length((public.pv_jpeg_read(decode($1, 'base64'))).body) as v`, [JPEG]],
    [`select public.pv_jpeg_is_clean(decode($1, 'base64')) as v`, [JPEG]],
    [`select public.pv_jpeg_dims(decode($1, 'base64')) as v`, [JPEG]],
    [`select public.pv_is_operator() as v`, []],
    [`select (public.pv_stay_clean('{"kind":"hotel","name":"テスト用ホテルQ"}'::jsonb)).status as v`, []],
    [`select public.pv_stay_clash('a', 'etihad', 'NRT', 'hotel', 'テスト用ホテルQ', null) as v`, []],
    [`select public.pv_stay_rev(null::public.pv_stay_places) as v`, []],
  ];
  for (const who of [V1, U, ANON]) {
    const res = [];
    for (const [sql, params] of tries) res.push(await call(who, sql, params));
    ok(res.length === 15 && res.every((r) => /permission denied/i.test(r.err || '')),
       `${NAMES.get(who)}: 中の部品（ハッシュ・印の判定・門・見える判定・中身の検品…）を直接は呼べない`,
       J(res.map((r) => r.err || r.v)));
  }
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 資格の無い人には何も返らない（まだ1件も無いとき）');
{
  const v = await stays(V1);
  ok(keys(v) === 'can_add,is_operator,ok,others,places,state' && v.ok === true && v.state === 'open'
     && v.can_add === true && v.is_operator === false && J(v.places) === '[]' && J(v.others) === '[]',
     '確認の印を持つ人: 開いていて空（欄は ok・state・can_add・is_operator・places・others の6つ）', J(v));
  const o = await stays(OP);
  ok(o.state === 'open' && o.is_operator === true && o.can_add === true, '運営: 開いている（is_operator が true）', J(o));
  for (const who of OUTSIDERS) {
    const r = await stays(who);
    ok(J(r) === LOCKED_READ, `${NAMES.get(who)}: 返るのは {ok:true, state:'locked'} だけ`, J(r));
  }
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 足す → 本人と運営にだけ見える → 運営が公開する');
let A;   // 場所A（V1 が書いたホテル・あとで公開）
{
  const r = await addFresh(V1, P('etihad', 'nrt', 'hotel', '  テスト用ホテルA  ', {
    address: 'テスト用の住所 1-2-3', maps_url: 'https://www.google.com/maps/place/Test+Hotel+A',
    note: 'テスト用のメモ。\n2行目。' }));
  A = r.item && r.item.id;
  ok(r.ok === true && keys(r) === 'item,ok'
     && keys(r.item) === 'address,age,city,id,kind,maps_url,mine,name,note,photos,state',
     '印を持つ人は足せる（返る欄は11個ちょうど）', J(r));
  ok(r.item.state === 'pending' && r.item.mine === true && r.item.name === 'テスト用ホテルA'
     && r.item.kind === 'hotel' && r.item.age === 0 && J(r.item.photos) === '[]'
     && r.item.maps_url === 'https://www.google.com/maps/place/Test+Hotel+A'
     && r.item.note === 'テスト用のメモ。\n2行目。',
     '入った時点では pending・自分の印つき・名前の前後の空白は落ちる・メモの改行は残る', J(r.item));
  const row = await one(`select author_hash, airline, iata, state from public.pv_stay_places where id = $1`, [A]);
  ok(row.author_hash === hashOf(V1) && row.iata === 'NRT' && row.airline === 'etihad' && row.state === 'pending',
     '表に入るのは sha256(uid || \'::pv_hotel::\')。空港は大文字3字にそろう', J(row));
  ok(hashOf(V1) !== hashOf(V1, '::pv_req::'), '要望（::pv_req::）のハッシュとは別の値になる');

  const mine = find(await stays(V1), A);
  ok(mine && mine.mine === true && mine.state === 'pending', '書いた本人には自分の確認前が見える（mine:true）', J(mine));
  const other = await stays(V2);
  ok(other.state === 'open' && J(other.places) === '[]', '★別の印を持つ人には、他人の確認前は見えない（空のまま）', J(other));
  const op = find(await stays(OP), A);
  ok(op && op.mine === false && op.state === 'pending', '運営には見える（mine:false・pending）', J(op));

  /* 運営でない人は公開できない */
  for (const who of [V1, V2, U, PAY, PROF, BADGE, GHOST]) {
    const m = await moderate(who, 'place', A, 'public');
    ok(J(m) === FORBIDDEN, `${NAMES.get(who)}: 公開できない（forbidden）`, J(m));
  }
  ok(denied(await moderate(ANON, 'place', A, 'public')), 'ANON: 公開の口そのものを呼べない');
  ok((await one(`select state from public.pv_stay_places where id = $1`, [A])).state === 'pending',
     '↑ のあとも pending のまま');

  /* 運営でも、変な指定は通らない */
  ok(status(await moderate(OP, 'place', A, 'pending')) === 'bad_state', '運営: pending へは戻せない（bad_state）');
  ok(status(await moderate(OP, 'place', A, 'weird')) === 'bad_state', '運営: 知らない状態は bad_state');
  ok(status(await moderate(OP, 'user', A, 'public')) === 'bad_target', '運営: 知らない対象は bad_target');
  ok(status(await moderate(OP, 'place', 'abc', 'public')) === 'not_found', '運営: uuid でない id は not_found');
  ok(status(await moderate(OP, 'place', '11111111-1111-4111-8111-111111111111', 'public')) === 'not_found',
     '運営: 無い id は not_found');

  const pub = await moderate(OP, 'place', A, 'public');
  ok(J(pub) === J({ id: A, ok: true, state: 'public', target: 'place' }) || (pub.ok === true && keys(pub) === 'id,ok,state,target' && pub.state === 'public'),
     '運営が公開する', J(pub));
  ok((await moderate(OP, 'place', A, 'public')).ok === true, '同じ状態をもう一度指定しても壊れない');
  const seenBy2 = find(await stays(V2), A);
  ok(seenBy2 && seenBy2.mine === false && seenBy2.state === 'public'
     && keys(seenBy2) === 'address,age,city,id,kind,maps_url,mine,name,note,photos,state',
     '公開されると、別の印を持つ人に見える（mine:false・欄は11個）', J(seenBy2));
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 資格の無い人には何も返らない（公開済みの1件が在るとき）');
for (const who of OUTSIDERS) {
  const n = NAMES.get(who);
  const r1 = await stays(who);
  const r2 = await stays(who, 'jal', 'KIX');
  const r3 = await stays(who, 'nope', 'X');          // 引数が変でも「変だ」とすら答えない
  const r4 = await rpc(who, 'pv_stays', undefined);
  ok([r1, r2, r3, r4].every((r) => J(r) === LOCKED_READ),
     `${n}: 一覧は {ok:true, state:'locked'} だけ（会社・空港・変な引数のどれでも同じ）`, J([r1, r2, r3, r4]));
  if (who === ANON) {
    const rs = [await add(who, P('etihad', 'NRT', 'hotel', 'テスト用ホテルZ')),
                await photoAdd(who, A, JPEG), await photo(who, A),
                await moderate(who, 'place', A, 'rejected'), await del(who, 'place', A), await queue(who),
                await upd(who, { id: A, name: 'テスト用ホテルZ' })];
    ok(rs.length === 7 && rs.every(denied), 'ANON: 足す・写真・公開・削除・待ち行列・直す は口そのものを呼べない', J(rs));
    continue;
  }
  const a = await add(who, P('etihad', 'NRT', 'hotel', 'テスト用ホテルZ'));
  const b = await photoAdd(who, A, JPEG);
  const c = await photo(who, A);
  const d = await queue(who);
  const e = await moderate(who, 'place', A, 'rejected');
  const f = await del(who, 'place', A);
  const g = await del(who, 'photo', A);
  const h = await del(who, 'x', A);
  /* 直す口 ── 在る id・無い id・id なし のどれでも同じ1行（在るかどうかを答えない） */
  const u = [await upd(who, { id: A, name: 'テスト用ホテルZ', city: 'テスト市' }),
             await upd(who, { id: '11111111-1111-4111-8111-111111111111', name: 'テスト用ホテルZ' }),
             await upd(who, {}), await rpc(who, 'pv_stay_update', undefined)];
  ok(u.every((r) => J(r) === LOCKED), `${n}: 直す も locked だけ（在る id・無い id・引数なし のどれでも同じ）`, J(u));
  ok(J(a) === LOCKED && J(b) === LOCKED && J(c) === LOCKED, `${n}: 足す・写真を足す・写真を読む は locked だけ`, J([a, b, c]));
  ok(J(d) === FORBIDDEN && J(e) === FORBIDDEN, `${n}: 待ち行列・公開／見送り は forbidden だけ`, J([d, e]));
  ok(J(f) === NOT_FOUND && J(g) === NOT_FOUND && J(h) === BAD_TARGET, `${n}: 他人のものは消せない（在っても not_found）`, J([f, g, h]));
}
{
  const n = await one(`select count(*)::int as n, min(state) as s, min(name) as nm,
                              count(updated_at)::int as u, sum(edit_n)::int as e from public.pv_stay_places`);
  ok(n.n === 1 && n.s === 'public', '↑ のあいだ、表は1行も増えず・減らず・状態も変わっていない', J(n));
  ok(n.nm === 'テスト用ホテルA' && n.u === 0 && n.e === 0, '↑ 名前も書き換わっていない（直した跡が1つも無い）', J(n));
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 自分の投稿を自分で公開できない（運営でも）');
let B, C;
{
  const b = await addFresh(OP, P('etihad', 'NRT', 'hotel', 'テスト用ホテルB'));
  B = b.item.id;
  ok(b.ok === true && b.item.state === 'pending' && b.item.mine === true, '運営が足しても pending で入る', J(b));
  ok(status(await moderate(OP, 'place', B, 'public')) === 'own_post', '★運営は自分が出した場所を自分で公開できない（own_post）');
  ok((await one(`select state from public.pv_stay_places where id = $1`, [B])).state === 'pending', '↑ のあとも pending のまま');
  ok((await moderate(OP2, 'place', B, 'public')).ok === true, '別の運営なら公開できる');

  const c = await addFresh(OP, P('etihad', 'NRT', 'hotel', 'テスト用ホテルC'));
  C = c.item.id;
  ok((await moderate(OP, 'place', C, 'rejected')).ok === true, '見送るのは自分のものでもできる');
  ok(status(await moderate(OP, 'place', C, 'public')) === 'final' && status(await moderate(OP2, 'place', C, 'public')) === 'final',
     '見送ったものは公開へ戻せない（final）');
  ok(!find(await stays(V1), C) && !find(await stays(V2), C), '見送られた場所は、ほかの人に見えない');
  const mineC = find(await stays(OP), C);
  ok(mineC && mineC.state === 'rejected', '書いた本人（と運営）には「見送り」として見える', J(mineC));
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 写真 ── 確認前は本人と運営だけ・公開は運営だけ・見送りで画素を消す');
let F1, D, E;
{
  const r = await photoAdd(V1, A, JPEG, 1200, 900);
  F1 = r.photo && r.photo.id;
  ok(r.ok === true && keys(r) === 'ok,photo' && J(r.photo) === J({ id: F1, mine: true, state: 'pending' }),
     '印を持つ人は写真を足せる（pending で入る・返るのは id・mine・state）', J(r));
  const row = await one(`select author_hash, byte_len, w, h, state, mime from public.pv_stay_photos where id = $1`, [F1]);
  ok(row.author_hash === hashOf(V1) && row.byte_len === jpegBuf.length && row.w === 1 && row.h === 1
     && row.state === 'pending' && row.mime === 'image/jpeg',
     '表には ハッシュ・バイト数・縦横・pending が入る（★縦横は送った 1200×900 ではなく、写真から読んだ 1×1）', J(row));

  ok(J(find(await stays(V1), A).photos) === J([{ id: F1, mine: true, state: 'pending' }]), '本人の一覧には出る（mine:true・pending）');
  ok(J(find(await stays(V2), A).photos) === '[]', '★別の人の一覧には、確認前の写真は「在る」ことも出ない');
  ok(J(find(await stays(OP), A).photos) === J([{ id: F1, mine: false, state: 'pending' }]), '運営の一覧には出る');

  ok(J(await photo(V2, F1)) === NOT_FOUND, '★別の人は確認前の写真を取り出せない（not_found）');
  const own = await photo(V1, F1);
  ok(own.ok === true && keys(own) === 'b64,h,mime,ok,state,w' && own.b64 === JPEG && own.mime === 'image/jpeg'
     && own.w === 1 && own.h === 1 && own.state === 'pending', '本人は取り出せる（base64 は改行なしで元と同じ・縦横は写真から読んだ値）', J(own).slice(0, 120));
  ok((await photo(OP, F1)).b64 === JPEG, '運営は取り出せる');
  ok(J(await photo(V1, 'abc')) === NOT_FOUND && J(await photo(V1, '11111111-1111-4111-8111-111111111111')) === NOT_FOUND,
     '無い写真・uuid でない id は not_found');

  ok(J(await moderate(V1, 'photo', F1, 'public')) === FORBIDDEN, '写真も、書いた本人は公開できない（forbidden）');
  ok((await moderate(OP, 'photo', F1, 'public')).ok === true, '運営が写真を公開する');
  ok(J(find(await stays(V2), A).photos) === J([{ id: F1, mine: false, state: 'public' }]), '公開されると別の人の一覧に出る');
  ok((await photo(V2, F1)).b64 === JPEG, '公開されると別の人も取り出せる');

  /* 運営の自分の写真 */
  const o = await photoAdd(OP, A, jpegN(1));
  ok(status(await moderate(OP, 'photo', o.photo.id, 'public')) === 'own_post', '★運営は自分が足した写真を自分で公開できない（own_post）');
  ok((await moderate(OP2, 'photo', o.photo.id, 'public')).ok === true, '別の運営なら公開できる');

  /* 見送り → 画素を消す */
  const x = await photoAdd(V2, A, jpegN(2));
  ok(x.ok === true, '公開済みの場所には、書いた本人でなくても写真を足せる', J(x));
  ok((await moderate(OP, 'photo', x.photo.id, 'rejected')).ok === true, '運営が写真を見送る');
  const gone = await one(`select bytes is null as nb, byte_len is null as nl, state from public.pv_stay_photos where id = $1`, [x.photo.id]);
  ok(gone.nb === true && gone.nl === true && gone.state === 'rejected', '★見送った写真は画素ごと消えている', J(gone));
  const v2ph = find(await stays(V2), A).photos.find((f) => f.id === x.photo.id);
  ok(v2ph && v2ph.mine === true && v2ph.state === 'rejected', '足した本人には「見送り」と出る', J(v2ph));
  ok(!find(await stays(V1), A).photos.some((f) => f.id === x.photo.id), '別の人の一覧には出ない');
  ok(J(await photo(V2, x.photo.id)) === NOT_FOUND && J(await photo(OP, x.photo.id)) === NOT_FOUND, '見送った写真は誰も取り出せない');
  ok(status(await moderate(OP, 'photo', x.photo.id, 'public')) === 'final', '見送った写真は公開へ戻せない（final）');

  /* 他人の確認前の場所には付けられない／場所が見えなければ写真も見えない */
  const d = await addFresh(V1, P('etihad', 'NRT', 'food', 'テスト用レストランD'));
  D = d.item.id;
  ok(J(await photoAdd(V2, D, jpegN(3))) === NOT_FOUND, '★他人の確認前の場所には写真を足せない（在るかどうかも答えない）');
  ok(J(await photoAdd(V2, '11111111-1111-4111-8111-111111111111', jpegN(3))) === NOT_FOUND
     && J(await photoAdd(V2, 'abc', jpegN(3))) === NOT_FOUND
     && J(await rpc(V2, 'pv_stay_photo_add', { b64: jpegN(3) })) === NOT_FOUND, '無い場所・変な id・場所の指定なし も同じ not_found');
  const dp = await photoAdd(V1, D, jpegN(3));
  ok((await moderate(OP, 'photo', dp.photo.id, 'public')).ok === true, '（運営が、確認前の場所に付いた写真だけ先に公開した）');
  ok(J(await photo(V2, dp.photo.id)) === NOT_FOUND && !find(await stays(V2), D),
     '★場所が確認前なら、写真だけ公開されていても別の人には出ない');

  /* 場所を見送ると写真も消える */
  ok((await moderate(OP, 'place', D, 'rejected')).ok === true, '運営が場所を見送る');
  const dz = await one(`select count(*)::int as n, count(bytes)::int as withbytes, min(state) as s
                          from public.pv_stay_photos where place_id = $1`, [D]);
  ok(dz.n === 1 && dz.withbytes === 0 && dz.s === 'rejected', '★場所を見送ると、付いていた写真も見送りになり画素が消える', J(dz));
  ok(J(await photoAdd(V1, D, jpegN(4))) === NOT_FOUND, '見送られた場所には、書いた本人も写真を足せない');

  /* 場所を公開しても写真は公開にならない */
  const e = await addFresh(V1, P('etihad', 'NRT', 'spot', 'テスト用スポットE'));
  E = e.item.id;
  const ep = await photoAdd(V1, E, jpegN(5));
  await moderate(OP, 'place', E, 'public');
  const eBy2 = find(await stays(V2), E);
  ok(eBy2 && J(eBy2.photos) === '[]' && J(await photo(V2, ep.photo.id)) === NOT_FOUND,
     '★場所を公開しても、写真は1枚ずつ見るまで公開にならない', J(eBy2));

  /* 並び: ホテル → 食べる所 → 行く所 */
  const order = (await stays(V1)).places.map((p) => p.kind);
  const rank = { hotel: 0, food: 1, spot: 2 };
  ok(order.length >= 3 && order.every((k, i) => i === 0 || rank[order[i - 1]] <= rank[k]),
     '並びは ホテル → 食べる所 → 行く所（時刻で並べない）', order.join(','));
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 写真の検品 ── JPEG でない・大きすぎる・壊れている は入らない');
{
  const before = (await one(`select count(*)::int as n from public.pv_stay_photos`)).n;
  const t = async (label, b64, want) => {
    const r = await rpc(V1, 'pv_stay_photo_add', b64 === undefined ? { place: A } : { place: A, b64 });
    ok(status(r) === want, `${label} → ${want}`, J(r));
  };
  ok(jpegBuf.length >= 100 && jpegBuf[0] === 0xff && jpegBuf[1] === 0xd8 && jpegBuf[2] === 0xff, '（見本の JPEG は 100バイト以上で JPEG の顔をしている）');
  await t('PNG', PNG, 'image_bad');
  await t('base64 でない文字列', '!!!これは base64 ではない!!!', 'image_bad');
  await t('空の文字列', '', 'image_bad');
  await t('写真なし', undefined, 'image_bad');
  await t('data: の頭が付いたまま', 'data:image/jpeg;base64,' + JPEG, 'image_bad');
  await t('JPEG の顔だが小さすぎる（24バイト）', junk(24), 'image_bad');
  /* ★先頭3バイトだけ JPEG、では通らない（中の形まで読む） */
  await t('JPEG の顔だが中身が JPEG の形をしていない（5,000バイト）', junk(5000), 'image_bad');
  await t('終わりの印（EOI）が無い', sizedBuf(4000).subarray(0, 3998).toString('base64'), 'image_bad');
  await t('大きさの印（SOF）が無い',
          Buffer.concat([jpegBuf.subarray(0, 89), jpegBuf.subarray(102)]).toString('base64'), 'image_bad');
  /* ★画像データの後ろ（終わりの印の手前）に置いた入れ物は、弾かずに落とす。
     落としたあとは V1 がもう足した写真（F1）と1バイトも違わないので、返事は duplicate ＝ 1行も増えない。
     （落とし切れていなければ別の写真として入り、下の「1行も入っていない」が赤くなる） */
  await t('画像データの後ろに撮影情報の入れ物がある（落とすと、もう在る写真と同じ）',
          Buffer.concat([jpegBuf.subarray(0, 158), SEG.exif, J_EOI]).toString('base64'), 'duplicate');
  await t('画像データの後ろにコメントがある（落とすと、もう在る写真と同じ）',
          Buffer.concat([jpegBuf.subarray(0, 158), SEG.com, J_EOI]).toString('base64'), 'duplicate');
  await t('入れ物の長さがファイルの外を指している',
          Buffer.concat([J_SOI, Buffer.from([0xff, 0xe1, 0xff, 0xff]), Buffer.alloc(300, 0x41), J_EOI]).toString('base64'), 'image_bad');
  await t('入れ物の長さが 1（在りえない）',
          Buffer.concat([J_SOI, Buffer.from([0xff, 0xe1, 0x00, 0x01]), J_BODY]).toString('base64'), 'image_bad');
  await t('頭の印が2回ある',
          Buffer.concat([J_SOI, J_APP0, J_SOI, J_BODY]).toString('base64'), 'image_bad');
  await t('撮影情報を外すと 100バイトに満たない',
          Buffer.concat([J_SOI, SEG.exif, SEG.xmp, jpegBuf.subarray(89, 102), jpegBuf.subarray(146)]).toString('base64'), 'image_bad');
  await t('HTML を base64 にしたもの', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'.repeat(4)).toString('base64'), 'image_bad');
  await t('base64 が 70万字を超える', 'A'.repeat(700004), 'image_too_big');
  await t('500,001バイト', sized(500001), 'image_too_big');
  await t('505,000バイト', sized(505000), 'image_too_big');
  const after = (await one(`select count(*)::int as n from public.pv_stay_photos`)).n;
  ok(after === before, '弾かれたものは1行も入っていない', `${before} → ${after}`);

  /* ★上限は「作り直したあと」の長さで測る。
       頭（JFIF）の無い 499,990バイト → 作り直すと頭の18バイトが付いて 500,008 → 入らない
       撮影情報で 51万バイトに膨れた写真 → 落としたあとが 45万バイトなら入る */
  const noHead = Buffer.concat([J_SOI, sizedBuf(500008).subarray(20)]);
  ok(noHead.length === 499990, '（頭の無い見本は 499,990バイト）', String(noHead.length));
  await t('頭（JFIF）の無い 499,990バイト（作り直すと 500,008）', noHead.toString('base64'), 'image_too_big');
  ok((await one(`select count(*)::int as n from public.pv_stay_photos`)).n === before, '↑ も1行も入っていない');

  /* ちょうど 50万バイトは入る。送られた縦横は使わない（例外にもしない） */
  const t0 = Date.now();
  const big = await rpc(V1, 'pv_stay_photo_add', { place: A, b64: sized(500000), w: 'abc', h: 99999 });
  const bigMs = Date.now() - t0;
  ok(big.ok === true, `ちょうど 500,000バイトは入る（作り直しを含めて ${bigMs} ミリ秒）`, J(big));
  ok(bigMs < 20000, '↑ 1枚の作り直しが 20秒を超えない（1バイトずつ回す形に戻っていない）', bigMs + ' ms');
  const bigId = (big.photo && big.photo.id) || null;
  const row = await one(`select byte_len, w, h from public.pv_stay_photos where id = $1`, [bigId]);
  ok(!!row && row.byte_len === 500000 && row.w === 1 && row.h === 1, '★送られた縦横（"abc"・99999）は捨てられ、写真から読んだ 1×1 が入る', J(row));
  const back = await photo(V1, bigId);
  ok(back.ok === true && back.b64 === sized(500000) && !/\s/.test(back.b64), '大きい写真も、取り出した base64 が元と1文字も違わない（改行なし）');

  /* 表の制約（関数を通らない道でも止まる） */
  const tryRaw = async (sql, params) => { try { await db.query(sql, params); return ''; } catch (e2) { return String(e2.message); } };
  const e1 = await tryRaw(`insert into public.pv_stay_photos (place_id, author_hash, bytes, byte_len, w, h)
                           values ($1, $2, decode($3,'base64'), octet_length(decode($3,'base64')), 1, 1)`,
                          [A, hashOf(V1), Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(60, 0x41)]).toString('base64')]);
  const e2 = await tryRaw(`insert into public.pv_stay_photos (place_id, author_hash, bytes, byte_len, w, h)
                           values ($1, $2, decode($3,'base64'), 5, 1, 1)`, [A, hashOf(V1), JPEG]);
  const e3 = await tryRaw(`insert into public.pv_stay_photos (place_id, author_hash, bytes, byte_len, w, h)
                           values ($1, $2, decode($3,'base64'), octet_length(decode($3,'base64')), 1, 1)`, [A, V1, JPEG]);
  const e4 = await tryRaw(`update public.pv_stay_photos set state = 'rejected' where id = $1`, [bigId]);
  ok(/pv_stay_photos_clean_ck/.test(e1) && /pv_stay_photos_body_ck/.test(e2), '表の制約: JPEG でない（100バイト以上の PNG）・バイト数が食い違う行は入らない', e1 + ' / ' + e2);
  ok(/pv_stay_photos_hash_ck/.test(e3), '表の制約: ハッシュの形でない値（生の uid）は author_hash に入らない', e3);
  ok(/pv_stay_photos_body_ck/.test(e4), '表の制約: 画素を残したまま「見送り」にできない', e4);
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 写真の連投 ── 同じ写真・1つの場所に4枚・24時間に30枚');
{
  /* この時点で V1 が A に付けた写真は2枚（1枚目と 50万バイトのもの） */
  ok(status(await photoAdd(V1, A, JPEG)) === 'duplicate', '同じ場所に同じ写真をもう一度 → duplicate');
  ok((await photoAdd(V1, A, jpegN(10))).ok === true && (await photoAdd(V1, A, jpegN(11))).ok === true, '3枚目・4枚目は入る');
  ok(status(await photoAdd(V1, A, jpegN(12))) === 'full', '5枚目 → full（1つの場所に自分の写真は4枚まで）');
  const v2 = await photoAdd(V2, A, jpegN(13));
  ok(v2.ok === true, '★上限は人ごと。他人が4枚付けていても自分は足せる（他人の確認前の枚数が返事から読めない）', J(v2));

  /* 24時間に30枚 ── 30枚ぶんを直接置いてから呼ぶ。
     ★表の CHECK が「作り直した形そのもの・縦横は写真のとおり」を求めるので、
       数合わせの行も、1枚ずつ中身の違う正しい形の JPEG（1×1）で置く。 */
  await ageOut();
  const filler = (await db.query(
    `insert into public.pv_stay_photos (place_id, author_hash, bytes, byte_len, w, h, created_at)
     select $1, $2, decode(b, 'base64'), octet_length(decode(b, 'base64')), 1, 1, now() - interval '1 hour'
       from jsonb_array_elements_text($3::jsonb) b
     returning id`, [E, hashOf(V2), J(Array.from({ length: 30 }, (_, g) => jpegN(1000 + g)))])).rows.map((x) => x.id);
  ok(filler.length === 30, '（数合わせの30枚を置いた）', String(filler.length));
  ok(status(await photoAdd(V2, B, jpegN(14))) === 'rate_limited', '24時間に30枚を超える → rate_limited');
  await db.query(`delete from public.pv_stay_photos where id::text in (select jsonb_array_elements_text($1::jsonb))`, [J(filler)]);
  ok((await photoAdd(V2, B, jpegN(14))).ok === true, '（数合わせを消せば入る）');
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 写真の撮影情報 ── 画面の焼き直しを当てにせず、サーバーで作り直す');
let S;
{
  /* 部品を直接呼ぶ（オーナーとして）。返るのは作り直したあとのバイト列か null */
  const b64of = (buf) => buf.toString('base64');
  const clean = async (buf) => {
    const r = await one(`select encode(public.pv_jpeg_strip(decode($1, 'base64')), 'base64') as v`, [b64of(buf)]);
    return r.v === null ? null : Buffer.from(r.v.replace(/\s/g, ''), 'base64');
  };
  const isClean = async (buf) => (await one(`select public.pv_jpeg_is_clean(decode($1, 'base64')) as v`, [b64of(buf)])).v;
  const dims = async (buf) => (await one(`select public.pv_jpeg_dims(decode($1, 'base64')) as v`, [b64of(buf)])).v;
  const same = (a, b) => a !== null && b !== null && Buffer.compare(a, b) === 0;
  const marksIn = (buf) => MARKS.filter((m) => buf.includes(Buffer.from(m)));
  const photoRows = async () => (await one(`select count(*)::int as n from public.pv_stay_photos`)).n;
  const tryRaw = async (sql, params) => { try { await db.query(sql, params); return ''; } catch (e2) { return String(e2.message); } };

  ok(same(await clean(jpegBuf), jpegBuf) && (await isClean(jpegBuf)) === true, '決まった形の JPEG は、1バイトも変わらずに通る');
  ok(same(await clean(srcBuf), jpegBuf) && (await isClean(srcBuf)) === false,
     '★元の JFIF の頭（版・密度の欄）は写さない。決まった18バイトに書き直す（＝頭に送り手の字が残らない）');
  ok(same(await clean(Buffer.concat([J_SOI, J_BODY])), jpegBuf), '頭（JFIF）が無い JPEG にも、同じ頭を付ける（18バイト増える）');

  /* 落とすもの 9種（撮影情報 7種 ＋ 前は残していた 色の決まり 2種）を全部混ぜる */
  const dirty = withSegs(SEG.exif, SEG.xmp, SEG.icc, SEG.iptc, SEG.adobe, SEG.com, SEG.jfxx, SEG.mpf, SEG.c2pa);
  const got = await clean(dirty);
  ok(marksIn(dirty).length === 11, '（見本には 撮った場所・日時・機種・XMP・IPTC・コメント・縮小画像・MPF・C2PA・ICC・Adobe の目印が入っている）', J(marksIn(dirty)));
  ok(same(got, jpegBuf),
     '★Exif・XMP・IPTC・コメント・JFXX・MPF・C2PA・ICC・Adobe を全部落とし、決まった頭と画素の節だけが残る',
     got === null ? 'null' : `${dirty.length} → ${got.length} バイト`);
  ok(got !== null && marksIn(got).length === 0, '↑ 目印の文字列が1つも残っていない', got === null ? 'null' : J(marksIn(got)));
  ok(same(jsStrip(dirty), jpegBuf) && same(jsStrip(jpegBuf), jpegBuf), '（手元の物差し jsStrip も同じ答えを出す）');

  /* 置き場所を変えても落ちる: 大きさの節の後ろ・ハフマン表の後ろ・画像データの後ろ */
  const mid = Buffer.concat([jpegBuf.subarray(0, 102), SEG.exif, jpegBuf.subarray(102, 146), SEG.com, jpegBuf.subarray(146)]);
  ok(same(await clean(mid), jpegBuf), '節のあいだ（大きさの後ろ・ハフマン表の後ろ）に挟んだ撮影情報・コメントも落ちる');
  {
    const tail = [];
    for (const [label, s] of [['Exif', SEG.exif], ['コメント', SEG.com], ['ICC', SEG.icc]]) {
      const r = await clean(Buffer.concat([jpegBuf.subarray(0, 158), s, J_EOI]));
      if (!(r === null || same(r, jpegBuf))) tail.push(label);
    }
    ok(tail.length === 0, '画像データの後ろ（終わりの印の手前）に置いたものは、落とすか丸ごと拒否（中身が残る形は無い）', J(tail));
  }

  /* JFIF の中の縮小画像（別の画像を1枚まるごと入れられる場所） */
  const thumb = Buffer.concat([J_SOI, seg(0xe0, Buffer.concat([J_APP0.subarray(4, 16), Buffer.from([1, 1, 0xaa, 0xbb, 0xcc])])), J_BODY]);
  ok(thumb.length === jpegBuf.length + 3 && same(await clean(thumb), jpegBuf), 'JFIF の中の縮小画像は落とす');

  /* 終わりの印より後ろ（2枚目の画像・付け足しの置き場） */
  ok(same(await clean(Buffer.concat([jpegBuf, Buffer.from('TRAILER-TEST-MARK')])), jpegBuf)
     && same(await clean(Buffer.concat([jpegBuf, Buffer.from(jpegN(77), 'base64')])), jpegBuf),
     '終わりの印（EOI）より後ろは切り落とす（付け足した文字列・2枚目の画像）');
  ok(same(await clean(Buffer.concat([J_SOI, Buffer.from([0xff, 0xff]), J_APP0, Buffer.from([0xff]), J_BODY])), jpegBuf), '節の前の詰め物（0xFF）は写さない');

  /* 画像データの中は触らない ── 0xFF 00・区切りの印（間隔を宣言してあるとき） */
  const stuffed = Buffer.concat([J_HEAD, Buffer.from([0x41, 0xff, 0x00, 0x42, 0xff, 0x00, 0xff, 0x00, 0x43]), J_EOI]);
  const DRI = Buffer.from([0xff, 0xdd, 0x00, 0x04, 0x00, 0x01]);
  const withRst = Buffer.concat([jpegBuf.subarray(0, 146), DRI, jpegBuf.subarray(146, 156),
                                 Buffer.from([0x41, 0xff, 0xd0, 0x42, 0xff, 0xd1, 0x43, 0xff, 0x00, 0x44]), J_EOI]);
  ok(same(await clean(stuffed), stuffed) && same(await clean(withRst), withRst),
     '画像データの中（0xFF 00・区切りの印）は1バイトも触らない');
  {
    /* 符号データの中の 0xFF を、まとめて読む窓の境目のあたりに置く */
    const bad = [];
    for (let n = 663; n <= 678; n++) { const b = sizedBuf(n); if (!same(await clean(b), b)) bad.push('EOI@' + n); }
    for (const off of [509, 510, 511, 512, 513, 1022, 1023, 1024, 1498]) {
      const data = Buffer.alloc(1500, 0x41); data[off] = 0xff; data[off + 1] = 0x00;
      const b = Buffer.concat([J_HEAD, data, J_EOI]);
      if (!same(await clean(b), b)) bad.push('FF00@' + off);
    }
    ok(bad.length === 0, '0xFF がどこに在っても読み違えない（終わりの印 16通り・0xFF 00 9通り）', J(bad));
  }

  /* 幅と高さは写真から読む */
  ok(J(await dims(jpegBuf)) === '[1,1]' && J(await dims(jpegWH(640, 480))) === '[640,480]' && J(await dims(jpegWH(8192, 8192))) === '[8192,8192]'
     && J(await dims(dirty)) === '[1,1]' && (await dims(Buffer.from(PNG, 'base64'))) === null,
     '幅と高さは大きさの節（SOF）から読む（{幅, 高さ}・読めなければ null）');

  /* ── 作り直せない形は null（部品を直接）＝ image_bad（関数を通して）。1行も入らない ── */
  const mut = (at, v) => { const b = Buffer.from(jpegBuf); b[at] = v; return b; };
  const BROKEN = [
    ['PNG', Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(60, 0x41)])],
    ['頭と終わりだけ', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xd9]), Buffer.alloc(120, 0x41)])],
    ['節のあいだにごみ', Buffer.concat([J_SOI, J_APP0, Buffer.from([0x00]), J_BODY])],
    ['知らない節（頭の部分）', withSegs(seg(0xf7, 'x'))],
    ['知らない節（画像データの後ろ）', Buffer.concat([jpegBuf.subarray(0, 158), seg(0xf7, 'x'), J_EOI])],
    ['画像データの途中に別の画像の頭', Buffer.concat([jpegBuf.subarray(0, 158), J_SOI, J_EOI])],
    ['0xFF で終わる', Buffer.concat([jpegBuf.subarray(0, 158), Buffer.from([0xff])])],
    ['途中で切れた（節の途中）', jpegBuf.subarray(0, 120)],
    ['途中で切れた（画像データの途中・終わりの印が無い）', sizedBuf(4000).subarray(0, 3998)],
    ['節の長さが嘘（量子化表が1バイト長い＝余りに字を置ける）',
      Buffer.concat([jpegBuf.subarray(0, 22), Buffer.from([0x00, 0x44]), jpegBuf.subarray(24, 89), Buffer.from('X'), jpegBuf.subarray(89)])],
    ['節の長さが嘘（大きさの節が1バイト長い）',
      Buffer.concat([jpegBuf.subarray(0, 91), Buffer.from([0x00, 0x0c]), jpegBuf.subarray(93, 102), Buffer.from('X'), jpegBuf.subarray(102)])],
    ['節の長さが嘘（画像データの印が1バイト長い）',
      Buffer.concat([jpegBuf.subarray(0, 148), Buffer.from([0x00, 0x09]), jpegBuf.subarray(150, 156), Buffer.from('X'), jpegBuf.subarray(156)])],
    ['節の長さがファイルの外を指している', Buffer.concat([J_SOI, Buffer.from([0xff, 0xe1, 0xff, 0xff]), Buffer.alloc(300, 0x41), J_EOI])],
    ['節の長さが 1（在りえない）', Buffer.concat([J_SOI, Buffer.from([0xff, 0xe1, 0x00, 0x01]), J_BODY])],
    ['大きさの節（SOF）が2つ', Buffer.concat([jpegBuf.subarray(0, 102), jpegBuf.subarray(89, 102), jpegBuf.subarray(102)])],
    ['大きさの節（SOF）が無い', Buffer.concat([jpegBuf.subarray(0, 89), jpegBuf.subarray(102)])],
    ['頭の印（SOI）が2回', Buffer.concat([J_SOI, J_APP0, J_SOI, J_BODY])],
    ['ロスレスの形（SOF3）', mut(90, 0xc3)],
    ['精度が 12', mut(93, 12)],
    ['幅が 9,000（上限は 8,192）', jpegWH(9000, 100)],
    ['高さが 0', jpegWH(100, 0)],
    ['使われない量子化表（中身が読まれない＝字の置き場）',
      Buffer.concat([jpegBuf.subarray(0, 89), Buffer.from([0xff, 0xdb, 0x00, 0x43, 0x01]), Buffer.alloc(64, 0x58), jpegBuf.subarray(89)])],
    ['同じ量子化表を2回', Buffer.concat([jpegBuf.subarray(0, 89), jpegBuf.subarray(20, 89), jpegBuf.subarray(89)])],
    ['同じハフマン表を、使う前にもう一度', Buffer.concat([jpegBuf.subarray(0, 146), jpegBuf.subarray(102, 146), jpegBuf.subarray(146)])],
    ['使われないハフマン表（画像データの後ろ）', Buffer.concat([jpegBuf.subarray(0, 158), jpegBuf.subarray(102, 146), J_EOI])],
    ['符号データの中に余分な 0xFF（FF FF 00）', Buffer.concat([J_HEAD, Buffer.from([0x41, 0xff, 0xff, 0x00, 0x42]), J_EOI])],
    ['区切りの印が、間隔の宣言なしに出てくる', Buffer.concat([J_HEAD, Buffer.from([0x41, 0xff, 0xd0, 0x42]), J_EOI])],
    ['区切りの印の番号が順でない', Buffer.concat([jpegBuf.subarray(0, 146), DRI, jpegBuf.subarray(146, 156),
                                                   Buffer.from([0x41, 0xff, 0xd1, 0x42]), J_EOI])],
    ['画像データが空', Buffer.concat([J_HEAD, J_EOI])],
    ['HTML', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'.repeat(4))],
  ];
  {
    const notNull = [];
    for (const [label, buf] of BROKEN) { if ((await clean(buf)) !== null || (await isClean(buf)) !== false || (await dims(buf)) !== null) notNull.push(label); }
    ok(notNull.length === 0, `作り直せない形 ${BROKEN.length} 種は、部品が null を返す（is_clean は false・幅と高さも null）`, J(notNull));
    ok((await clean(Buffer.alloc(0))) === null && (await one(`select public.pv_jpeg_strip(null) is null as a, public.pv_jpeg_is_clean(null) as b,
                                                                    public.pv_jpeg_dims(null) is null as c`)).a === true,
       '0バイト・空（NULL）は null');
    const n0 = await photoRows();
    const wrong = [];
    for (const [label, buf] of BROKEN) {
      const r = await rpc(V1, 'pv_stay_photo_add', { place: B, b64: b64of(buf), w: 1, h: 1 });
      if (J(r) !== '{"ok":false,"status":"image_bad"}') wrong.push([label, J(r)]);
    }
    const n1 = await photoRows();
    ok(wrong.length === 0, `★同じ ${BROKEN.length} 種を関数へ直接送る → 全部 image_bad（落とせないものは入れない）`, J(wrong));
    ok(n1 === n0, '↑ 1行も増えていない', `${n0} → ${n1}`);
  }

  /* ★canvas が書き出した本物の JPEG（リポジトリに在る、描き直して書き出した写真）で確かめる。
     落ちる・画素の節が変わるなら、画面から来る普通の写真が入らなくなる。
     前はそのまま通していた色の決まり（ICC）は、いまは落ちる。 */
  {
    const diff = [];
    let n = 0, icc = 0;
    for (const d of ['../assets/airlines/', '../assets/places/']) {
      const dir = new URL(d, import.meta.url);
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort() : [];
      for (const f of files) {
        const buf = readFileSync(new URL(f, dir));
        if (buf.length > 500000) continue;
        n++;
        if (buf.includes(Buffer.from('ICC_PROFILE'))) icc++;
        const out = await clean(buf);
        const want = jsStrip(buf);
        if (!(same(out, want) && same(scansOf(out), scansOf(buf)) && !out.includes(Buffer.from('ICC_PROFILE')) && (await isClean(out)) === true)) diff.push(d + f);
      }
    }
    ok(n > 0 && diff.length === 0,
       `★canvas が書き出した本物の JPEG ${n} 枚が全部通り、画素の節は1バイトも変わらない（色の決まりを持つ ${icc} 枚からは、それだけが落ちる）`, J(diff));
  }

  // ──────────────────────────────────────────────────────────────
  /* ★ここが本題（2026-10-04 の指摘）: 画面を通さず、場所の入った JPEG を関数へそのまま渡す。
     見本は上で組み立てた作り物（大きさの節は 640×480・Exif に場所と日時と機種・XMP・ICC・コメント・末尾に付け足し）。 */
  const g = await addFresh(V2, P('etihad', 'AUH', 'food', 'テスト用レストランG'));
  const G = g.item && g.item.id;
  ok((await moderate(OP, 'place', G, 'public')).ok === true, '（場所 G を公開した）');
  const pix = jpegWH(640, 480, 1);
  const raw = Buffer.concat([J_SOI, srcBuf.subarray(2, 20), exifGps(), XMP_GPS, SEG.icc, SEG.com, pix.subarray(20), Buffer.from('TRAILER-TEST-MARK')]);
  const where = readGps(raw);
  ok(where && J(where.lat) === J(GPS.lat) && J(where.lon) === J(GPS.lon) && gpsMarksIn(raw).length === GPS_MARKS.length,
     '（見本には 場所（度・分・秒）・日時・機種・XMP・コメント・末尾の付け足し が本当に入っている）', J([where, gpsMarksIn(raw)]));
  const nG = await photoRows();
  const up = await rpc(V2, 'pv_stay_photo_add', { place: G, b64: b64of(raw), w: 4000, h: 3000 });
  const GP = up.photo && up.photo.id;
  ok(up.ok === true && keys(up) === 'ok,photo' && keys(up.photo) === 'id,mine,state' && up.photo.state === 'pending' && (await photoRows()) === nG + 1,
     '場所の入った JPEG を関数へ直接送る → 入る（返事は id・mine・state だけ）', J(up));
  /* 入らなかったとき（行が無い）は、空のバイト列として下の検査を赤くする（例外で止めない） */
  const kept = (await one(`select encode(bytes, 'base64') as b, byte_len, w, h, state from public.pv_stay_photos where id = $1`, [GP || null])) || {};
  const keptBuf = Buffer.from(String(kept.b || '').replace(/\s/g, ''), 'base64');
  ok(keptBuf.length > 0 && gpsMarksIn(keptBuf).length === 0 && readGps(keptBuf) === null && marksIn(keptBuf).length === 0,
     '★表に入った行に、場所・日時・機種・Exif・XMP・ICC・コメント・末尾の付け足し が1つも無い', J([gpsMarksIn(keptBuf), marksIn(keptBuf)]));
  ok(same(keptBuf, pix) && kept.byte_len === pix.length && same(keptBuf, jsStrip(raw)),
     '★保存されたのは作り直した形そのもの（決まった頭 ＋ 画素の節 ＋ 終わりの印。それ以外は1バイトも無い）', `${raw.length} → ${keptBuf.length}`);
  ok(same(scansOf(keptBuf), scansOf(raw)) && scansOf(raw).length > 0, '★符号データ（画素）は元と1バイトも違わない');
  ok(kept.w === 640 && kept.h === 480, '★幅と高さは、送った 4000×3000 ではなく、写真から読んだ 640×480', J([kept.w, kept.h]));

  /* 取り出しても、返るのは保存したもの（作り直したあと）だけ */
  const readBack = async (who) => {
    const r = await photo(who, GP);
    const buf = r && typeof r.b64 === 'string' ? Buffer.from(r.b64, 'base64') : null;
    return { r, buf, fine: !!buf && r.ok === true && keys(r) === 'b64,h,mime,ok,state,w' && same(buf, pix) && r.w === 640 && r.h === 480
                              && gpsMarksIn(buf).length === 0 && readGps(buf) === null && !/\s/.test(r.b64) };
  };
  ok((await readBack(V2)).fine && (await readBack(OP)).fine,
     '★pv_stay_photo の返事（本人・運営）にも、場所・日時・機種は1つも無い。幅と高さは 640×480');

  /* 上限は「作り直したあと」で測る: 撮影情報で 51万バイトに膨れた写真は、落とすと 45万バイトなので入る */
  {
    const lean = sizedBuf(450000);
    const fat = Buffer.concat([J_SOI, J_APP0, seg(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), Buffer.alloc(60000, 0x45)])), lean.subarray(20)]);
    const r = await photoAdd(V2, G, b64of(fat), 1, 1);
    const row = await one(`select encode(bytes, 'base64') as b, byte_len from public.pv_stay_photos where id = $1`, [r.photo && r.photo.id]);
    ok(fat.length === 510010 && r.ok === true && row && row.byte_len === 450000
       && same(Buffer.from(String(row.b).replace(/\s/g, ''), 'base64'), lean),
       '撮影情報で 51万バイトに膨れた写真は、落としたあと（45万バイト）で測るので入る', J(r));
    await db.query(`delete from public.pv_stay_photos where id = $1`, [r.photo && r.photo.id]);
  }

  /* 確認前: 別の「確認の印を持つ人」にも出ない */
  const gBy1 = find(await stays(V1, 'etihad', 'AUH'), G);
  ok(J(await photo(V1, GP)) === NOT_FOUND && gBy1 && J(gBy1.photos) === '[]',
     '★確認前の写真は、別の「確認の印を持つ人」にも出ない（取り出せない・一覧にも在ることが出ない）', J(gBy1));

  /* 資格の無い人: 返事は locked の1種類だけ。写真・幅・高さ・件数の欄そのものが無い。表も直接は読めない */
  const goneId = (await one(`select id from public.pv_stay_photos where state = 'rejected' limit 1`)).id;
  const WHO = new Map([[ANON, '未ログイン'], [U, '登録だけの会員'], [PAY, '給与の鍵を持つ人'],
                       [PROF, 'プロフィールで会社と職位（パイロット）を申告しただけの人'], [BADGE, 'バッジと鍵だけ持つ人'],
                       [GHOST, 'プロフィールの行が無い人'], [REV, '口コミの鍵を持つ人']]);
  const lockedOut = async (label) => {
    const n0 = await photoRows();
    for (const who of OUTSIDERS) {
      const name = WHO.get(who) || NAMES.get(who);
      const reads = [await photo(who, GP), await photo(who, F1), await photo(who, goneId),
                     await photo(who, '11111111-1111-4111-8111-111111111111'), await photo(who, 'abc'), await rpc(who, 'pv_stay_photo', undefined)];
      const adds = [await rpc(who, 'pv_stay_photo_add', { place: G, b64: b64of(raw), w: 4000, h: 3000 }), await photoAdd(who, G, jpegN(900))];
      const list = [await stays(who, 'etihad', 'AUH'), await stays(who)];
      const direct = [await call(who, `select encode(bytes, 'base64') as v from public.pv_stay_photos where id = $1`, [GP]),
                      await call(who, `select count(*) as v from public.pv_stay_photos`),
                      await call(who, `select w, h, byte_len from public.pv_stay_photos limit 1`),
                      await call(who, `select public.pv_jpeg_strip(bytes) as v from public.pv_stay_photos limit 1`)];
      if (who === ANON) {
        ok(reads.every(denied) && adds.every(denied), `${label}${name}: 写真を読む口・足す口そのものを呼べない`, J([reads, adds]).slice(0, 300));
      } else {
        ok(reads.every((r) => J(r) === LOCKED && keys(r) === 'ok,status') && adds.every((r) => J(r) === LOCKED),
           `${label}${name}: 写真を読む・足す の返事は locked だけ（確認前・公開済み・見送り・無い id のどれでも同じ1文。b64・w・h・mime・state の欄が無い）`,
           J([reads, adds]).slice(0, 300));
      }
      ok(list.every((r) => J(r) === LOCKED_READ), `${label}${name}: 一覧も locked だけ（写真の枚数・id が出ない）`, J(list).slice(0, 200));
      ok(direct.every((r) => /permission denied/i.test(r.err || '')), `${label}${name}: 写真の表は直接読めない（画素・枚数・幅と高さのどれも）`, J(direct).slice(0, 300));
    }
    ok((await photoRows()) === n0, `${label}資格の無い人が送った写真は1行も入っていない`);
  };
  await lockedOut('確認前 ── ');
  ok((await moderate(OP, 'photo', GP, 'public')).ok === true, '運営が写真を公開する');
  const pubBack = await readBack(V1);
  ok(pubBack.fine && J(find(await stays(V1, 'etihad', 'AUH'), G).photos) === J([{ id: GP, mine: false, state: 'public' }]),
     '★公開後、別の「確認の印を持つ人」が取り出しても、場所・日時・機種は1つも無い（一覧に出るのは id・mine・state だけ）', J(pubBack.r).slice(0, 160));
  await lockedOut('公開後 ── ');

  /* ── 関数を通らない道（表の持ち主が直接入れる・あとから別の SQL が行を足す）は、表の CHECK が止める ── */
  {
    const n0 = await photoRows();
    const ins = (buf, w, h) => tryRaw(
      `insert into public.pv_stay_photos (place_id, author_hash, bytes, byte_len, w, h)
       values ($1, $2, decode($3, 'base64'), octet_length(decode($3, 'base64')), $4::int, $5::int)`, [G, hashOf(V1), b64of(buf), w, h]);
    const dirtyRows = [
      ['場所の入った JPEG（幅と高さは正しい）', await ins(raw, 640, 480)],
      ['元の JFIF の頭のまま', await ins(srcBuf, 1, 1)],
      ['コメントつき', await ins(withSegs(SEG.com), 1, 1)],
      ['ICC つき', await ins(withSegs(SEG.icc), 1, 1)],
      ['終わりの印の後ろに付け足し', await ins(Buffer.concat([pix, Buffer.from('TRAILER-TEST-MARK')]), 640, 480)],
      ['頭（JFIF）が無い', await ins(Buffer.concat([J_SOI, pix.subarray(20)]), 640, 480)],
      ['JPEG として読めない（5,000バイトの埋め草）', await ins(Buffer.from(junk(5000), 'base64'), 1, 1)],
    ];
    ok(dirtyRows.every(([, e]) => /pv_stay_photos_clean_ck/.test(e)),
       `★表へ直接入れても、作り直した形でない写真 ${dirtyRows.length} 種は入らない（pv_stay_photos_clean_ck）`,
       J(dirtyRows.filter(([, e]) => !/pv_stay_photos_clean_ck/.test(e)).map(([l, e]) => [l, e.slice(0, 80)])));
    const lieRows = [
      ['幅と高さが嘘（4000×3000）', await ins(pix, 4000, 3000)],
      ['幅と高さが逆（480×640）', await ins(pix, 480, 640)],
      ['幅と高さが空', await ins(pix, null, null)],
      ['高さだけ空', await ins(pix, 640, null)],
    ];
    ok(lieRows.every(([, e]) => /pv_stay_photos_dims_ck/.test(e)),
       `★表へ直接入れても、幅と高さが写真と違う行 ${lieRows.length} 種は入らない（pv_stay_photos_dims_ck）`,
       J(lieRows.filter(([, e]) => !/pv_stay_photos_dims_ck/.test(e)).map(([l, e]) => [l, e.slice(0, 80)])));
    const u1 = await tryRaw(`update public.pv_stay_photos set bytes = decode($2, 'base64'), byte_len = octet_length(decode($2, 'base64')) where id = $1`, [GP, b64of(raw)]);
    const u2 = await tryRaw(`update public.pv_stay_photos set w = 4000, h = 3000 where id = $1`, [GP]);
    ok(/pv_stay_photos_clean_ck/.test(u1) && /pv_stay_photos_dims_ck/.test(u2), '★在る行をあとから書き換える道も同じ（撮影情報入りに差し替える・幅と高さだけ変える）', u1.slice(0, 80) + ' / ' + u2.slice(0, 80));
    ok((await photoRows()) === n0, '↑ どれも1行も入っていない・変わっていない');
    /* 決まりが「何でも弾く」になっていないこと */
    const fine = jpegWH(640, 480, 2);
    const okIns = await tryRaw(
      `insert into public.pv_stay_photos (place_id, author_hash, bytes, byte_len, w, h)
       values ($1, $2, decode($3, 'base64'), octet_length(decode($3, 'base64')), 640, 480)`, [G, hashOf(V1), b64of(fine)]);
    ok(okIns === '' && (await photoRows()) === n0 + 1, '（作り直した形で、幅と高さが写真のとおりなら、直接でも入る）', okIns);
    await db.query(`delete from public.pv_stay_photos where place_id = $1 and author_hash = $2`, [G, hashOf(V1)]);
    /* 見送った写真（画素なし）は、決まりの対象の外 */
    const rj = await one(`select count(*)::int as n from public.pv_stay_photos where state = 'rejected' and bytes is null`);
    ok(rj.n >= 1, '（見送った写真は画素が無いまま表に居られる＝ CHECK は画素の在る行だけを見る）', J(rj));
  }

  /* 関数を通して: 撮影情報だけが違う写真は「同じ写真」 */
  const s = await addFresh(V2, P('etihad', 'DXB', 'hotel', 'テスト用ホテルS'));
  S = s.item.id;
  const up2 = await photoAdd(V2, S, b64of(Buffer.concat([withSegs(SEG.exif, SEG.xmp, SEG.iptc, SEG.com, SEG.mpf, SEG.icc), Buffer.from('TRAILER-TEST-MARK')])), 800, 600);
  const kept2 = await one(`select encode(bytes, 'base64') as b, w, h from public.pv_stay_photos where id = $1`, [up2.photo && up2.photo.id]);
  ok(up2.ok === true && String(kept2.b).replace(/\s/g, '') === JPEG && kept2.w === 1 && kept2.h === 1
     && (await photo(V2, up2.photo.id)).b64 === JPEG && (await photo(OP, up2.photo.id)).b64 === JPEG,
     '撮影情報つきの小さい見本でも同じ（保存も取り出しも、作り直したあとのもの）', J(up2));
  ok(status(await photoAdd(V2, S, b64of(withSegs(SEG.com)))) === 'duplicate'
     && status(await photoAdd(V2, S, JPEG)) === 'duplicate'
     && status(await photoAdd(V2, S, JPEG_SRC)) === 'duplicate',
     '撮影情報・頭の書き方だけが違う同じ写真 → duplicate（作り直したあとで比べる）');

  /* ★写真の並びは足した順ではない（id の順）。時刻をどう入れ替えても並びが変わらない */
  for (const n of [20, 21, 22]) await photoAdd(V2, S, jpegN(n));
  const listed = async () => find(await stays(V2, 'etihad', 'DXB'), S).photos.map((f) => f.id);
  const ids = await listed();
  const byId = [...ids].sort();
  ok(ids.length === 4 && J(ids) === J(byId), '写真の並びは id の順（4枚）', J(ids));
  const orders = [];
  for (const dir of [byId, [...byId].reverse(), [byId[2], byId[0], byId[3], byId[1]]]) {
    for (let i = 0; i < dir.length; i++) {
      await db.query(`update public.pv_stay_photos set created_at = now() - ($2::int * interval '1 minute') where id = $1`, [dir[i], 10 - i]);
    }
    orders.push(J(await listed()));
  }
  ok(orders.every((o) => o === J(byId)), '★足した時刻を 昇順・降順・ばらばら に入れ替えても、並びは1つも変わらない（足した順が読めない）', J(orders));

  /* 見送った場所に写真が残っていても（本来は残らない）、その写真は公開できない */
  const ghost = await one(
    `insert into public.pv_stay_photos (place_id, author_hash, bytes, byte_len, w, h)
     values ($1, $2, decode($3, 'base64'), octet_length(decode($3, 'base64')), 1, 1) returning id`, [D, hashOf(V2), jpegN(30)]);
  const pub = await moderate(OP, 'photo', ghost.id, 'public');
  const st = await one(`select state from public.pv_stay_photos where id = $1`, [ghost.id]);
  ok(status(pub) === 'final' && st.state === 'pending', '★見送った場所に付いている写真は公開できない（final）', J([pub, st]));
  ok((await moderate(OP, 'photo', ghost.id, 'rejected')).ok === true
     && (await one(`select bytes is null as nb from public.pv_stay_photos where id = $1`, [ghost.id])).nb === true, '見送ることはできる（画素が消える）');
  await db.query(`delete from public.pv_stay_photos where id = $1`, [ghost.id]);
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 場所の連投 ── 30秒・24時間に20件・同じ名前');
let X1;
{
  await ageOut();
  const x1 = await add(V2, P('etihad', 'SIN', 'hotel', 'テスト用ホテルX1'));
  X1 = x1.item.id;
  ok(x1.ok === true, '1件目は入る');
  ok(status(await add(V2, P('etihad', 'SIN', 'hotel', 'Test Hotel X2'))) === 'too_fast', '続けてすぐ → too_fast（30秒）');
  ok((await addFresh(V2, P('etihad', 'SIN', 'hotel', 'Test Hotel X2'))).ok === true, '時間を置けば入る');

  ok(status(await addFresh(V2, P('etihad', 'SIN', 'hotel', 'テスト用ホテルX1'))) === 'duplicate', '自分が出した名前をもう一度 → duplicate');
  ok(status(await addFresh(V2, P('etihad', 'sin', 'hotel', '  TEST   HOTEL x2 '))) === 'duplicate',
     '大文字小文字・空白の数が違うだけ → duplicate');
  ok((await addFresh(V2, P('etihad', 'SIN', 'food', 'テスト用ホテルX1'))).ok === true, '種類が違えば別もの（入る）');

  /* ★他人の確認前の行と比べない（比べると「誰かがそれを出したところだ」が分かる） */
  const leak = await addFresh(V1, P('etihad', 'SIN', 'hotel', 'テスト用ホテルX1'));
  ok(leak.ok === true && leak.item.state === 'pending', '★他人が確認前で同じ名前を出していても、exists とも duplicate とも返さない', J(leak));

  await moderate(OP, 'place', X1, 'public');
  ok(status(await addFresh(OP2, P('etihad', 'SIN', 'hotel', 'テスト用ホテルX1'))) === 'exists', '同じ名前が公開済み → exists');

  /* 見送られたものは出し直せる */
  const x3 = await addFresh(V1, P('etihad', 'SIN', 'hotel', 'テスト用ホテルX3'));
  await moderate(OP, 'place', x3.item.id, 'rejected');
  ok((await addFresh(V1, P('etihad', 'SIN', 'hotel', 'テスト用ホテルX3'))).ok === true, '見送られた名前は出し直せる');

  /* 24時間に20件 ── 20件ぶんを直接置いてから呼ぶ（目印は空港 ZZZ） */
  await ageOut();
  await db.query(
    `insert into public.pv_stay_places (author_hash, airline, iata, kind, name, created_at)
     select $1, 'etihad', 'ZZZ', 'spot', 'テスト用の数合わせ ' || g, now() - interval '1 hour'
       from generate_series(1, 20) g`, [hashOf(V2)]);
  ok(status(await add(V2, P('etihad', 'SIN', 'spot', 'テスト用スポットX4'))) === 'rate_limited', '24時間に20件を超える → rate_limited');
  await db.exec(`delete from public.pv_stay_places where iata = 'ZZZ' and name = 'テスト用の数合わせ 1'`);
  ok((await add(V2, P('etihad', 'SIN', 'spot', 'テスト用スポットX4'))).ok === true, '19件なら20件目は入る');
  await db.exec(`delete from public.pv_stay_places where iata = 'ZZZ'`);
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 入力の検品 ── 会社・空港・種類・文字数');
{
  const before = (await one(`select count(*)::int as n from public.pv_stay_places`)).n;
  const t = async (label, o, want) => { const r = await addFresh(V1, o); ok(status(r) === want, `${label} → ${want}`, J(r)); return r; };
  await t('会社が「その他」', P('other', 'FRA', 'hotel', 'テスト用ホテルF'), 'bad_airline');
  await t('名簿に無い会社', P('nope-air', 'FRA', 'hotel', 'テスト用ホテルF'), 'bad_airline');
  await t('会社が空', P('', 'FRA', 'hotel', 'テスト用ホテルF'), 'bad_airline');
  await t('会社の指定なし', { iata: 'FRA', kind: 'hotel', name: 'テスト用ホテルF' }, 'bad_airline');
  await t('空港が2字', P('etihad', 'FR', 'hotel', 'テスト用ホテルF'), 'bad_iata');
  await t('空港が4字', P('etihad', 'FRAA', 'hotel', 'テスト用ホテルF'), 'bad_iata');
  await t('空港に数字', P('etihad', 'F1A', 'hotel', 'テスト用ホテルF'), 'bad_iata');
  await t('空港が全角', P('etihad', 'ＦＲＡ', 'hotel', 'テスト用ホテルF'), 'bad_iata');
  await t('空港が空', P('etihad', '', 'hotel', 'テスト用ホテルF'), 'bad_iata');
  await t('種類が白リストの外', P('etihad', 'FRA', 'bar', 'テスト用ホテルF'), 'bad_kind');
  await t('種類が大文字', P('etihad', 'FRA', 'HOTEL', 'テスト用ホテルF'), 'bad_kind');
  await t('種類の指定なし', { airline: 'etihad', iata: 'FRA', name: 'テスト用ホテルF' }, 'bad_kind');
  await t('名前が1字', P('etihad', 'FRA', 'hotel', 'A'), 'bad_name');
  await t('名前が空', P('etihad', 'FRA', 'hotel', ''), 'bad_name');
  await t('名前が空白だけ', P('etihad', 'FRA', 'hotel', '     '), 'bad_name');
  await t('名前が全角の空白だけ', P('etihad', 'FRA', 'hotel', '　　　　'), 'bad_name');
  await t('名前が81字', P('etihad', 'FRA', 'hotel', 'あ'.repeat(81)), 'bad_name');
  await t('名前の指定なし', { airline: 'etihad', iata: 'FRA', kind: 'hotel' }, 'bad_name');
  await t('住所が201字', P('etihad', 'FRA', 'hotel', 'テスト用ホテルF', { address: 'あ'.repeat(201) }), 'too_long');
  await t('メモが501字', P('etihad', 'FRA', 'hotel', 'テスト用ホテルF', { note: 'あ'.repeat(501) }), 'too_long');
  await t('都市が61字', P('etihad', 'FRA', 'hotel', 'テスト用ホテルF', { city: 'あ'.repeat(61) }), 'bad_city');
  /* 弾く順番は 種別 → 名前 → 住所 → メモ → 都市（画面に出る一言がこの順で決まる） */
  await t('名前も都市もだめ（名前が先）', P('etihad', 'FRA', 'hotel', 'A', { city: 'あ'.repeat(61) }), 'bad_name');
  await t('住所も都市もだめ（住所が先）', P('etihad', 'FRA', 'hotel', 'テスト用ホテルF', { address: 'あ'.repeat(201), city: 'あ'.repeat(61) }), 'too_long');
  /* 無効にした会社には足せない（一覧は読める・can_add が false） */
  await db.exec(`update public.pv_airlines set active = false where code = 'jta'`);
  await t('無効にした会社', P('jta', 'FRA', 'hotel', 'テスト用ホテルF'), 'bad_airline');
  const off = await stays(V1, 'jta', 'FRA');
  ok(off.state === 'open' && off.can_add === false, '無効にした会社: 一覧は開くが can_add が false', J(off));
  await db.exec(`update public.pv_airlines set active = true where code = 'jta'`);
  const after = (await one(`select count(*)::int as n from public.pv_stay_places`)).n;
  ok(after === before, '弾かれたものは1行も入っていない', `${before} → ${after}`);

  /* 読む側の引数（資格のある人にだけ「変だ」と答える） */
  ok(status(await stays(V1, 'other', 'FRA')) === 'bad_airline' && status(await stays(V1, 'nope-air', 'FRA')) === 'bad_airline',
     '読む側: 「その他」・名簿に無い会社 → bad_airline');
  ok(status(await stays(V1, 'etihad', 'FR')) === 'bad_iata' && status(await stays(V1, 'etihad', 'F1A')) === 'bad_iata', '読む側: 空港が3字でない → bad_iata');
  ok((await stays(V1, '  Etihad ', 'nrt')).state === 'open' && find(await stays(V1, '  Etihad ', 'nrt'), A),
     '読む側: 会社の大文字・前後の空白、空港の小文字はそろえて読む');

  /* 通る側の端 */
  const lim = await t('名前80字・住所200字・メモ500字', P('etihad', 'FRA', 'hotel', 'テ'.repeat(80), { address: '住'.repeat(200), note: 'メ'.repeat(500) }), 'ok');
  ok(lim.item.name.length === 80 && lim.item.address.length === 200 && lim.item.note.length === 500, '↑ 1文字も削られずに入っている');
  await t('名前2字', P('etihad', 'FRA', 'food', 'テA'), 'ok');
  const c60 = await t('都市60字', P('etihad', 'FRA', 'food', 'テスト用レストランC60', { city: '都'.repeat(60) }), 'ok');
  ok(c60.item.city === '都'.repeat(60), '↑ 1文字も削られずに入っている', J(c60.item));
  const cn = await t('都市に改行・タブ・全角空白', P('etihad', 'FRA', 'food', 'テスト用レストランCN', { city: '  テスト\n\t市　中央  ' }), 'ok');
  const c0 = await t('都市が空白だけ', P('etihad', 'FRA', 'food', 'テスト用レストランC0', { city: ' 　 ' }), 'ok');
  const cx = await t('都市の指定なし', P('etihad', 'FRA', 'food', 'テスト用レストランCX'), 'ok');
  const cRow = async (id) => (await one(`select city from public.pv_stay_places where id = $1`, [id])).city;
  ok(cn.item.city === 'テスト 市 中央' && (await cRow(cn.item.id)) === 'テスト 市 中央', '都市の名前は1行にそろう（改行が入らない）', J(cn.item));
  ok(c0.item.city === null && cx.item.city === null && (await cRow(c0.item.id)) === null && (await cRow(cx.item.id)) === null,
     '都市を書かなければ null（空の文字列を保存しない）', J([c0.item, cx.item]));
  /* ★関数を通さずに表へ入れる道でも、都市の決まりは表の CHECK が止める */
  const direct = async (city) => {
    try {
      await db.query(`insert into public.pv_stay_places (author_hash, airline, iata, kind, name, city)
                      values ($1, 'etihad', 'FRA', 'spot', 'テスト用の直接書き込み', $2)`, [hashOf(V1), city]);
      return 'in';
    } catch (e) { return /pv_stay_places_city_ck/.test(String(e.message)) ? 'ck' : String(e.message); }
  };
  const dr = [await direct(''), await direct(' テスト市'), await direct('あ'.repeat(61)), await direct('テスト\n市'), await direct('テスト\t市')];
  ok(dr.every((x) => x === 'ck'), '★表に直接書いても、空・前後の空白・61字・改行やタブ入りの都市は入らない（CHECK）', J(dr));
  ok((await one(`select count(*)::int as n from public.pv_stay_places where name = 'テスト用の直接書き込み'`)).n === 0, '↑ 1行も入っていない');
  const norm = await t('名前に改行・タブ・全角空白', P('etihad', 'FRA', 'spot', 'テスト用\n\tスポット　N', { address: ' テスト用の\n住所 ', note: '  ' }), 'ok');
  ok(norm.item.name === 'テスト用 スポット N' && norm.item.address === 'テスト用の 住所' && norm.item.note === null,
     '名前と住所は1行にそろう・空白だけのメモは空になる', J(norm.item));

  /* 引数が JSON の入れ物でなくても例外にしない */
  for (const p of [undefined, null, [], 'x', 123]) {
    const r1 = await rpc(V1, 'pv_stays', p);
    const r2 = await rpc(V1, 'pv_stay_add', p);
    const r3 = await rpc(V1, 'pv_stay_photo_add', p);
    const r4 = await rpc(V1, 'pv_stay_photo', p);
    const r5 = await rpc(V1, 'pv_stay_delete', p);
    const r6 = await rpc(OP, 'pv_stay_moderate', p);
    const r7 = await rpc(V1, 'pv_stay_update', p);
    ok(status(r1) === 'bad_airline' && status(r2) === 'bad_airline' && status(r3) === 'not_found'
       && status(r4) === 'not_found' && status(r5) === 'not_found' && status(r6) === 'bad_state'
       && J(r7) === NOT_FOUND,
       `引数が ${p === undefined ? 'NULL' : J(p)} でも、例外ではなく定型の返事`, [r1, r2, r3, r4, r5, r6, r7].map(status).join(' / '));
  }
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 地図のリンク ── https で Google マップのホストだけ。それ以外は捨てる');
{
  const m = async (u) => (await one(`select public.pv_stay_maps_url($1) as v`, [u])).v;
  const PASS = [
    ['https://www.google.com/maps/place/Test+Hotel/@35.0,139.0,17z'],
    ['https://www.google.com/maps?q=35.0,139.0'],
    ['https://www.google.com/maps'],
    ['https://google.com/maps/search/?api=1&query=test'],
    ['https://www.google.co.jp/maps/place/x'],
    ['https://maps.google.com/?q=test'],
    ['https://maps.google.com'],
    ['https://maps.google.com/'],
    ['https://maps.google.com?q=test'],
    ['https://maps.google.com/maps'],
    ['https://maps.google.com/maps/place/x'],
    ['https://maps.google.co.jp/?q=x'],
    ['https://maps.google.co.jp/maps?q=x'],
    ['https://maps.app.goo.gl/AbC123xyz'],
    ['https://goo.gl/maps/AbC123xyz'],
    ['https://www.google.com/maps/place/A%2FB'],
    ['HTTPS://WWW.GOOGLE.COM/maps/place/x', 'https://www.google.com/maps/place/x'],
    ['  https://maps.app.goo.gl/AbC123xyz  ', 'https://maps.app.goo.gl/AbC123xyz'],
  ];
  const got = [];
  for (const [u, want] of PASS) got.push([u, await m(u), want === undefined ? u : want]);
  ok(got.every(([, g, w]) => g === w), `通すもの ${PASS.length} 本がそのまま（大文字と前後の空白だけそろえて）返る`,
     J(got.filter(([, g, w]) => g !== w)));

  const DROP = [
    'http://www.google.com/maps/place/x',                       // https でない
    'https://www.google.com/url?q=https://evil.example',        // よそへ飛ばす口
    'https://maps.google.com/url?q=https://evil.example',       // ★同じ口は maps.google.com にも在る
    'https://maps.google.co.jp/url?q=https://evil.example',
    'https://maps.google.com/URL?q=https://evil.example',
    'https://maps.google.com/url',
    'https://maps.google.com/mapsx',                            // 地図の下でない
    'https://maps.google.com/anything/else',
    'https://maps.google.com//evil.example/maps',
    'https://maps.google.co.jp/local_url?q=x',
    'https://www.google.com/',                                  // 地図の下でない
    'https://www.google.com/mapsx',
    'https://www.google.com/search?q=x',
    'https://www.google.com.evil.example/maps',                 // ホストの見せかけ
    'https://maps.google.com.evil.example/',
    'https://evil.example/maps',
    'https://maps.example.com/x',
    'https://www.google.com@evil.example/maps',                 // @ で本当のホストを隠す
    'https://evil.example@www.google.com/maps',
    'https://www.google.com:8443/maps',                         // ポート
    'https://www.google.com/maps/../url?q=x',                   // 上の階へ戻る
    'https://www.google.com/maps/%2e%2e/url',
    'https://www.google.com/maps/%2E%2E/url',
    'https://www.google.com/maps/.%2e/url',
    'https://www.google.com#@evil.example/maps',
    'https://www.google.com\\@evil.example/maps',               // バックスラッシュ
    'https://www.google.com/maps"onmouseover="x',               // 引用符
    "https://www.google.com/maps'x",
    'https://www.google.com/maps<script>',
    'https://www.google.com/maps`x',
    'https://www.google.com/maps x',                            // 空白
    'https://www.google.com/maps\nx',
    'https://www.google.com/maps\tx',
    'https://www.google.com/maps　x',                           // 全角の空白
    'https://maps.app.goo.gl/',                                 // 記号が無い
    'https://goo.gl/AbC123',                                    // 地図でない短縮
    'https://www.google.de/maps/place/x',                       // 一覧に無い国のホスト
    'https://www.gооgle.com/maps',                              // 見た目が似た別の文字
    'https://xn--ggle-55da.com/maps',
    '//www.google.com/maps',
    'www.google.com/maps',
    'javascript:alert(1)',
    'data:text/html,<b>x</b>',
    'ftp://maps.google.com/x',
    'https://',
    '',
    'https://www.google.com/maps/' + 'a'.repeat(480),           // 500字を超える
  ];
  const leaked = [];
  for (const u of DROP) { const g = await m(u); if (g !== null) leaked.push([u, g]); }
  ok(leaked.length === 0, `捨てるもの ${DROP.length} 本が全部 null になる`, J(leaked));
  ok((await m(null)) === null, '空（NULL）は null');

  /* 関数を通して: リンクだけ捨てて、投稿は通す */
  const a = await addFresh(V1, P('etihad', 'FRA', 'hotel', 'テスト用ホテルM1', { maps_url: 'http://evil.example/x' }));
  const b = await addFresh(V1, P('etihad', 'FRA', 'hotel', 'テスト用ホテルM2', { maps_url: 'https://www.google.com/url?q=https://evil.example' }));
  const c = await addFresh(V1, P('etihad', 'FRA', 'hotel', 'テスト用ホテルM3', { maps_url: 'HTTPS://Maps.App.Goo.Gl/AbC123' }));
  ok(a.ok === true && a.item.maps_url === null && b.ok === true && b.item.maps_url === null,
     '通らないリンクは捨てる（投稿そのものは入る・maps_url は null で返る）', J([a, b]));
  ok(c.ok === true && c.item.maps_url === 'https://maps.app.goo.gl/AbC123', '通るリンクはホストを小文字にそろえて入る', J(c));
  let e = '';
  try { await db.query(`update public.pv_stay_places set maps_url = 'https://evil.example/' where id = $1`, [a.item.id]); }
  catch (err) { e = String(err.message); }
  ok(/pv_stay_places_maps_ck/.test(e), '表の制約: 関数を通らない道でも、よそのホストは入らない', e);

  /* ★ホストは合っているが、よそへ飛ばす口 */
  const d = await addFresh(V1, P('etihad', 'FRA', 'hotel', 'テスト用ホテルM4', { maps_url: 'https://maps.google.com/url?q=https://evil.example' }));
  ok(d.ok === true && d.item.maps_url === null, '★maps.google.com/url?q=… は捨てる（投稿は入る・maps_url は null）', J(d));

  /* 決まりを厳しくする前に入っていたリンクは、貼り直したときに当て直す。
     （表の制約はホストしか見ないので、古い形の行はそのまま残っている、を作る） */
  await db.query(`update public.pv_stay_places set maps_url = 'https://maps.google.com/url?q=https://evil.example' where id = $1`, [a.item.id]);
  const before = await one(`select count(*)::int as n from public.pv_stay_places`);
  let e2 = '';
  try { await db.exec(STAYS_SQL); } catch (err) { e2 = String(err.message); }
  const old = await one(`select maps_url, name from public.pv_stay_places where id = $1`, [a.item.id]);
  const good = await one(`select maps_url from public.pv_stay_places where id = $1`, [c.item.id]);
  const after = await one(`select count(*)::int as n from public.pv_stay_places`);
  ok(e2 === '' && old.maps_url === null && old.name === 'テスト用ホテルM1' && before.n === after.n,
     '★貼り直すと、前から入っていた通らないリンクだけが消える（場所は残る）', e2 || J(old));
  ok(good.maps_url === 'https://maps.app.goo.gl/AbC123', '↑ 通るリンクは1文字も変わらない', J(good));
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 同じ空港で他社が使うホテル（others）');
let N1;
{
  const j1 = await addFresh(V2, P('jal', 'NRT', 'hotel', 'テスト用ホテルJ1'));
  const j2 = await addFresh(V2, P('jal', 'NRT', 'food', 'テスト用レストランJ2'));
  const n1 = await addFresh(V2, P('ana', 'NRT', 'hotel', 'テスト用ホテルN1'));
  const j3 = await addFresh(V2, P('jal', 'KIX', 'hotel', 'テスト用ホテルJ3'));
  N1 = n1.item.id;
  for (const id of [j1.item.id, j2.item.id, j3.item.id]) await moderate(OP, 'place', id, 'public');

  const v1 = await stays(V1);
  ok(v1.others.length === 1 && keys(v1.others[0]) === 'airline,places' && v1.others[0].airline === 'jal'
     && v1.others[0].places.length === 1 && v1.others[0].places[0].name === 'テスト用ホテルJ1'
     && keys(v1.others[0].places[0]) === 'address,age,city,id,kind,maps_url,mine,name,note,photos,state',
     '他社のホテルが会社ごとに出る（食べる所・別の空港・他人の確認前は出ない）', J(v1.others));
  const v2 = await stays(V2);
  ok(v2.others.map((o) => o.airline).join(',') === 'ana,jal' && v2.others[0].places[0].mine === true
     && v2.others[0].places[0].state === 'pending', '自分の確認前は、others でも自分にだけ出る', J(v2.others));
  const jal = await stays(V1, 'jal', 'NRT');
  const flat = jal.others.flatMap((o) => o.places);
  ok(jal.places.length === 2 && !jal.others.some((o) => o.airline === 'jal')
     && jal.others.some((o) => o.airline === 'etihad') && flat.every((p) => p.kind === 'hotel')
     && flat.some((p) => p.id === A) && !flat.some((p) => p.id === C || p.id === D || p.id === E || p.id === N1),
     '見ている会社は others に入らない・others はホテルだけ・見送り／他人の確認前は入らない', J(jal));
  for (const who of OUTSIDERS) ok(J(await stays(who)) === LOCKED_READ, `${NAMES.get(who)}: others が在っても locked だけ`);
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 運営の待ち行列');
{
  const q = await queue(OP);
  ok(q.ok === true && keys(q) === 'ok,photos,places', '運営: 待ち行列が返る（欄は ok・places・photos）', keys(q));
  const n1 = q.places.find((p) => p.id === N1);
  ok(n1 && n1.airline === 'ana' && n1.iata === 'NRT' && q.places.every((p) => p.state === 'pending')
     && keys(n1) === 'address,age,airline,city,iata,id,kind,maps_url,mine,name,note,photos,rev,state',
     '確認待ちの場所だけが、会社と空港つきで並ぶ（版の印 rev つき）', J(n1));
  ok(q.photos.length > 0 && q.photos.every((f) => keys(f) === 'airline,iata,id,kind,mine,name,place,place_state'),
     '確認待ちの写真が、どの場所のものかと一緒に並ぶ', J(q.photos[0]));
  const q0 = await call(OP, `select public.pv_stay_queue() as v`);
  ok(q0.v && q0.v.v.ok === true, '引数なしでも呼べる');
  seen.push({ who: OP, fn: 'pv_stay_queue', json: J(q0.v.v) });
  for (const who of [V1, V2]) ok(J(await queue(who)) === FORBIDDEN, `${NAMES.get(who)}: 印を持っていても待ち行列は見えない（forbidden）`);
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 確認の印の列がもし会員に書ける状態へ戻ったら、門は閉じる');
{
  /* db/stays.sql は貼るときに「会員が印を書けない」ことを確かめて止まるが、それは貼った瞬間の話。
     あとから別の SQL が profiles の書き込みを配り直すと、登録しただけの人が自分に印を付けて
     ホテルの名前を読めてしまう。なので門そのものが、呼ばれるたびにその権限を見る。
     ⚠️ ここでは列の単位でだけ配る・取り上げる。表の単位で revoke すると、
        db/admin.sql が返した10列ぶんの書き込みまで一緒に消える。 */
  const isOpen = async (who) => { const v = await stays(who); return v.state === 'open' && !!find(v, A); };
  ok(await isOpen(V1) && await isOpen(V2), '（いまは、印を持つ人に開いている）');
  const base = (await one(`select count(*)::int as n from public.pv_stay_places`)).n
             + (await one(`select count(*)::int as n from public.pv_stay_photos`)).n;

  for (const [role, priv] of [['authenticated', 'update'], ['authenticated', 'insert'], ['anon', 'update'], ['anon', 'insert']]) {
    await db.exec(`grant ${priv} (verify_level) on public.profiles to ${role};`);
    const r = [J(await stays(V1)), J(await stays(V2)), J(await photo(V1, F1)),
               J(await add(V1, P('etihad', 'NRT', 'hotel', 'テスト用ホテルG'))), J(await photoAdd(V2, A, jpegN(90))),
               J(await upd(V1, { id: A, name: 'テスト用ホテルG' }))];
    const op = await stays(OP);
    const out = [J(await stays(U)), J(await stays(ANON))];
    await db.exec(`revoke ${priv} (verify_level) on public.profiles from ${role};`);
    ok(r[0] === LOCKED_READ && r[1] === LOCKED_READ && r[2] === LOCKED && r[3] === LOCKED && r[4] === LOCKED && r[5] === LOCKED,
       `★${role} が verify_level を ${priv} できる間は、印を持つ人にも locked（読む・足す・写真・直す）`, J(r));
    ok(op.state === 'open' && op.is_operator === true && !!find(op, A) && out.every((x) => x === LOCKED_READ),
       '↑ その間も運営は見える（直すための画面は生きている）・資格の無い人は locked のまま', J([op.state, out]));
  }
  const now = (await one(`select count(*)::int as n from public.pv_stay_places`)).n
            + (await one(`select count(*)::int as n from public.pv_stay_photos`)).n;
  ok(now === base, '閉じていた間に、行は1つも増えていない', `${base} → ${now}`);
  ok(await isOpen(V1) && await isOpen(V2), '権限を取り上げたら、元どおり開く');

  /* 実際の攻め方 ── 権限が配り直された間に、印の無い会員が自分で印を書く */
  await db.exec(`grant update (verify_level) on public.profiles to authenticated;`);
  const w = await call(U, `update public.profiles set verify_level = 2 where id = $1 returning id`, [U]);
  const lv = await one(`select verify_level from public.profiles where id = $1`, [U]);
  ok(!w.err && Number(lv.verify_level) === 2, '（権限が配られると、会員は自分の印を書けてしまう ── これが塞ぐ相手）', J({ w, lv }));
  const got = [J(await stays(U)), J(await stays(U, 'jal', 'NRT')), J(await add(U, P('etihad', 'NRT', 'hotel', 'テスト用ホテルG2'))),
               J(await photo(U, F1)), J(await photoAdd(U, A, JPEG)), J(await queue(U)), J(await moderate(U, 'place', A, 'rejected')),
               J(await upd(U, { id: A, name: 'テスト用ホテルG2' }))];
  ok(got[0] === LOCKED_READ && got[1] === LOCKED_READ && got[2] === LOCKED && got[3] === LOCKED && got[4] === LOCKED
     && got[5] === FORBIDDEN && got[6] === FORBIDDEN && got[7] === LOCKED,
     '★自分で印を書いた会員には、ホテル名も写真も1つも返らない（locked だけ）', J(got));
  /* 片付け。⚠️ 権限を取り上げても、その間に書かれた印は列に残る。印も戻す
     （本番でこうなったら、db/admin.sql を貼り直したあとに印の付いている人を見直す） */
  await db.exec(`revoke update (verify_level) on public.profiles from authenticated;`);
  await db.query(`update public.profiles set verify_level = 0 where id = $1`, [U]);
  const back = await call(U, `update public.profiles set verify_level = 2 where id = $1 returning id`, [U]);
  ok(/permission denied/i.test(back.err || '') && J(await stays(U)) === LOCKED_READ && await isOpen(V1),
     '片付けたあと: 会員は印を書けない・印の無い人は locked・印を持つ人には開く', J(back));
  ok((await one(`select state from public.pv_stay_places where id = $1`, [A])).state === 'public', '（場所は公開のまま。見送られていない）');
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 時刻は返さない（返すのは0〜4の段だけ）');
{
  /* 段は暦の月（UTC）で切る。「書いた時刻からちょうど1か月」で切ると、段が変わる瞬間を
     見張るだけで書いた時刻が秒まで分かる（直す前は、境目の前後2秒で 0 → 1 に変わった）。
     ★1つの文の中で全部を測る（now() が同じ値）ので、月をまたぐ瞬間に走っても答えは変わらない。 */
  const M = (k, back = '') =>
    `((date_trunc('month', now() at time zone 'utc') - interval '${k} months'${back}) at time zone 'utc')`;
  const rows = (await db.query(`
    select k, public.pv_stay_age(t) as age from (values
      ('いま',                 now()),
      ('今月の最初の1秒',       ${M(0)}),
      ('先月の最後の1秒',       ${M(0, ` - interval '1 second'`)}),
      ('2か月前の月の最初',     ${M(2)}),
      ('3か月前の月の最後',     ${M(2, ` - interval '1 second'`)}),
      ('5か月前の月の最初',     ${M(5)}),
      ('6か月前の月の最後',     ${M(5, ` - interval '1 second'`)}),
      ('11か月前の月の最初',    ${M(11)}),
      ('12か月前の月の最後',    ${M(11, ` - interval '1 second'`)}),
      ('5年前',                now() - interval '5 years'),
      ('来月（時計のずれ）',     ${M(-1)}),
      ('3日先',                now() + interval '3 days')
    ) v(k, t)`)).rows.map((r) => [r.k, Number(r.age)]);
  const want = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 0, 0];
  ok(rows.length === 12 && rows.every(([, a], i) => a === want[i]),
     '段の境目は月の変わり目だけ（今月 0／1〜2か月前の月 1／3〜5 2／6〜11 3／それより前 4／先の時刻 0）', J(rows));

  /* ★同じ月に書かれたものは、月の何日・何時でも同じ段 ＝ 段から日時を絞れない */
  const same = (await db.query(`
    select public.pv_stay_age(t) as age from (values
      (${M(1)}), (${M(1, ` + interval '1 second'`)}), (${M(1, ` + interval '9 days 4 hours'`)}),
      (${M(1, ` + interval '20 days 23 hours 59 minutes'`)}), (${M(0, ` - interval '1 second'`)})
    ) v(t)`)).rows.map((r) => Number(r.age));
  ok(same.length === 5 && same.every((a) => a === 1), '★先月のいつ書いても同じ段（1日の0時も、月末の最後の1秒も）', J(same));

  /* 画面へ返る値で確かめる。月をまたぐ瞬間に走っても答えが変わらない所だけを使う */
  const got = [];
  for (const [k, want2] of [[0, 1], [2, 2], [5, 3], [11, 4]]) {
    await db.query(`update public.pv_stay_places set created_at = ${M(k, ` - interval '1 second'`)} where id = $1`, [A]);
    got.push([k, find(await stays(V2), A).age, want2]);
  }
  ok(got.every(([, g, w]) => g === w), '一覧の age も同じ段で返る（先月 1／3か月前 2／6か月前 3／12か月前 4）', J(got));
  await db.query(`update public.pv_stay_places set created_at = now() - interval '2 days' where id = $1`, [A]);
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 消す ── 本人か運営だけ');
{
  ok(J(await del(V2, 'place', A)) === NOT_FOUND && J(await del(V2, 'photo', F1)) === NOT_FOUND,
     '★印を持つ別の人は、他人の場所も写真も消せない（not_found）');
  ok((await one(`select count(*)::int as n from public.pv_stay_places where id = $1`, [A])).n === 1
     && (await one(`select count(*)::int as n from public.pv_stay_photos where id = $1`, [F1])).n === 1, '↑ のあとも残っている');
  ok(J(await del(V1, 'x', A)) === BAD_TARGET && J(await del(V1, 'place', 'abc')) === NOT_FOUND
     && J(await del(V1, 'place', '11111111-1111-4111-8111-111111111111')) === NOT_FOUND, '知らない対象・変な id・無い id');

  const d1 = await del(V1, 'photo', F1);
  ok(J(d1) === J({ id: F1, ok: true, target: 'photo' }) || (d1.ok === true && keys(d1) === 'id,ok,target'), '本人は自分の写真を消せる', J(d1));
  ok((await one(`select count(*)::int as n from public.pv_stay_photos where id = $1`, [F1])).n === 0, '↑ 行ごと消えている');

  const others = (await db.query(`select id, author_hash from public.pv_stay_photos where place_id = $1`, [A])).rows;
  const v2photo = others.find((r) => r.author_hash === hashOf(V2) );
  ok(!!v2photo && (await del(OP, 'photo', v2photo.id)).ok === true, '運営は他人の写真を消せる');

  const left = (await one(`select count(*)::int as n from public.pv_stay_photos where place_id = $1`, [A])).n;
  ok(left > 0 && (await del(V1, 'place', A)).ok === true, '本人は自分の場所を消せる');
  ok((await one(`select count(*)::int as n from public.pv_stay_photos where place_id = $1`, [A])).n === 0
     && !find(await stays(V2), A), '場所を消すと、付いていた写真も一緒に消える');
  ok((await del(OP2, 'place', C)).ok === true, '運営は他人の場所を消せる');

  /* 印を外された人 ── もう見えないが、自分が出したものは消せる */
  await db.query(`update public.profiles set verify_level = 1 where id = $1`, [V3]);
  const mine = await addFresh(V3, P('etihad', 'BKK', 'hotel', 'テスト用ホテルV3'));
  ok(mine.ok === true && (await stays(V3, 'etihad', 'BKK')).places.length === 1, '（印を付けた直後は足せる・見える）');
  await db.query(`update public.profiles set verify_level = 0 where id = $1`, [V3]);
  ok(J(await stays(V3, 'etihad', 'BKK')) === LOCKED_READ, '★印を外されたら、その場で locked に戻る（自分が書いたものも見えない）');
  ok(J(await add(V3, P('etihad', 'BKK', 'hotel', 'テスト用ホテルV3b'))) === LOCKED
     && J(await photoAdd(V3, mine.item.id, JPEG)) === LOCKED && J(await photo(V3, F1)) === LOCKED, '印を外されたら、足す・写真 も locked');
  ok((await del(V3, 'place', mine.item.id)).ok === true
     && (await one(`select count(*)::int as n from public.pv_stay_places where id = $1`, [mine.item.id])).n === 0,
     '印を外されたあとでも、自分が出したものは自分で消せる');
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 直す ── 書いた本人だけ・直したら確認待ちへ戻る・運営が通すとまた出る');
{
  /* 表の行をそのまま読む（オーナーとして）。直す前後を1文字ずつ比べるため */
  const rowOf = async (id) => one(
    `select airline, iata, kind, name, address, maps_url, note, city, state, author_hash,
            created_at::text as c, moderated_at is not null as checked, updated_at is not null as touched,
            edit_from is not null as boxed, edit_n
       from public.pv_stay_places where id = $1`, [id]);
  const hel = (who) => stays(who, 'etihad', 'HEL');
  const FULL = { kind: 'hotel', name: 'テスト用ホテルH1', address: 'テスト用の住所 9-9-9',
                 maps_url: 'https://maps.app.goo.gl/TestH1', note: 'テスト用のメモH。\n2行目。', city: 'テスト市' };
  const ITEM11 = 'address,age,city,id,kind,maps_url,mine,name,note,photos,state';

  /* 都市つきで足す → 運営が公開 → 写真を1枚付けて、それも公開 */
  const h = await addFresh(V1, P('etihad', 'HEL', FULL.kind, FULL.name, FULL));
  const H = h.item && h.item.id;
  ok(h.ok === true && h.item.city === 'テスト市' && h.item.state === 'pending' && h.item.mine === true,
     '都市つきで足せる（確認待ちで入る・自分の印つき）', J(h));
  await moderate(OP, 'place', H, 'public');
  const hp = await photoAdd(V1, H, jpegN(2001));
  const FH = hp.photo && hp.photo.id;
  await moderate(OP, 'photo', FH, 'public');
  const pub0 = find(await hel(V2), H);
  ok(pub0 && pub0.state === 'public' && pub0.mine === false && pub0.city === 'テスト市' && pub0.photos.length === 1
     && (await photo(V2, FH)).b64 === jpegN(2001), '（公開済み: 別の印を持つ人に、都市と写真つきで見えている）', J(pub0));
  const r0 = await rowOf(H);

  /* 何も変えない送り直し ── 状態を戻さない */
  const same = [await upd(V1, { id: H, ...FULL }),
                await upd(V1, { id: H, name: '  テスト用ホテルH1 ', city: 'テスト市\n' }),   // そろえたら同じになる
                await upd(V1, { id: H }),                                                    // 欄を1つも送らない
                await upd(V1, { id: H, airline: 'jal', iata: 'KIX' })];                      // 会社と空港は読まない
  ok(same.every((r) => r.ok === true && r.changed === false && keys(r) === 'changed,item,ok'
                       && keys(r.item) === ITEM11 && r.item.id === H && r.item.state === 'public' && r.item.mine === true),
     '★何も変えない送り直しは changed:false（公開のまま。確認待ちへ戻さない）', J(same.map((r) => [r.ok, r.changed, r.item && r.item.state])));
  ok(J(await rowOf(H)) === J(r0) && r0.state === 'public' && r0.touched === false && r0.edit_n === 0
     && r0.airline === 'etihad' && r0.iata === 'HEL',
     '↑ 表の行は1文字も変わっていない（状態・回数・会社・空港。会社と空港を送っても変わらない）', J(r0));
  ok(!!find(await hel(V2), H), '↑ ほかの人にも出たまま');

  /* 直せない人たち */
  const no = { id: H, name: 'テスト用ホテルH1 書き換え', city: 'テスト別市' };
  const deny = [await upd(V2, no), await upd(OP, no), await upd(OP2, no),
                await upd(V1, { ...no, id: '11111111-1111-4111-8111-111111111111' }),
                await upd(V1, { ...no, id: 'abc' }), await upd(V1, { name: no.name })];
  ok(deny.length === 6 && deny.every((r) => J(r) === NOT_FOUND),
     '★他人は直せない（別の印を持つ人も・運営も not_found）／無い id・変な id・id なし も同じ答え', J(deny));
  ok(J(await upd(U, no)) === LOCKED && J(await upd(PAY, no)) === LOCKED && J(await upd(BADGE, no)) === LOCKED
     && denied(await upd(ANON, no)), '資格の無い会員は locked・未ログインは口そのものを呼べない');
  await db.query(`update public.profiles set verify_level = 0 where id = $1`, [V1]);
  const off = await upd(V1, no);
  await db.query(`update public.profiles set verify_level = 1 where id = $1`, [V1]);
  ok(J(off) === LOCKED, '★印を外された人は、自分が書いたものでも直せない（locked。資格の判定は門のまま）', J(off));
  ok(J(await rowOf(H)) === J(r0), '↑ どれのあとも、表の行は1文字も変わっていない');

  /* 本人が直す → 確認待ちへ戻る */
  const e1 = await upd(V1, { id: H, name: '  テスト用ホテルH1 新館 ', city: 'テスト新市' });
  ok(e1.ok === true && e1.changed === true && keys(e1) === 'changed,item,ok' && keys(e1.item) === ITEM11,
     '本人は直せる（返る欄は changed・item・ok／item は一覧と同じ11個）', J(e1));
  ok(e1.item.id === H && e1.item.state === 'pending' && e1.item.mine === true
     && e1.item.name === 'テスト用ホテルH1 新館' && e1.item.city === 'テスト新市'
     && e1.item.address === FULL.address && e1.item.maps_url === FULL.maps_url && e1.item.note === FULL.note
     && e1.item.kind === 'hotel' && e1.item.photos.length === 1,
     '★直したら確認待ち（pending）へ戻る・送った欄だけが変わり、送らなかった欄はそのまま', J(e1.item));
  const r1 = await rowOf(H);
  ok(r1.state === 'pending' && r1.checked === false && r1.touched === true && r1.boxed === true && r1.edit_n === 1
     && r1.airline === 'etihad' && r1.iata === 'HEL' && r1.c === r0.c && r1.author_hash === hashOf(V1),
     '表: pending・運営が見た時刻は空・直した時刻が入る・回数は1／会社・空港・足した時刻・持ち主は変わらない', J(r1));
  ok(!J(e1).includes(hashOf(V1)) && !/author|hash|_at"|edit_/.test(J(e1)), '★返り値に持ち主の印が無い（時刻も回数も無い）', J(e1));

  /* 確認待ちの間 ── ほかのパイロットには出ない・本人と運営には出る */
  const v2a = await hel(V2);
  ok(v2a.state === 'open' && !find(v2a, H), '★直したあとは、ほかのパイロットに出なくなる（運営が見るまで）', J(v2a.places));
  ok(!(await stays(V2, 'jal', 'HEL')).others.some((o) => o.places.some((p) => p.id === H)),
     '↑ 「同じ空港で他社が使うホテル」の側にも出ない');
  ok(J(await photo(V2, FH)) === NOT_FOUND && J(await photoAdd(V2, H, jpegN(2002))) === NOT_FOUND,
     '↑ 付いている公開済みの写真も取り出せない・写真も足せない（在るかどうかを答えない）');
  ok((await one(`select state from public.pv_stay_photos where id = $1`, [FH])).state === 'public',
     '（写真の状態そのものは書き換えていない）');
  const v1a = find(await hel(V1), H);
  ok(v1a && v1a.mine === true && v1a.state === 'pending' && v1a.name === 'テスト用ホテルH1 新館'
     && v1a.photos.length === 1 && (await photo(V1, FH)).b64 === jpegN(2001),
     '本人には出続ける（確認待ちと分かる・自分の印つき・写真も見える）', J(v1a));
  const opa = find(await hel(OP), H);
  const qa = (await queue(OP)).places.find((x) => x.id === H);
  ok(opa && opa.mine === false && opa.state === 'pending' && qa && qa.name === 'テスト用ホテルH1 新館'
     && qa.city === 'テスト新市' && qa.airline === 'etihad' && qa.iata === 'HEL' && qa.mine === false,
     '運営には見える・待ち行列に直した中身で並ぶ（mine は本人にしか付かない）', J([opa, qa]));

  /* 運営が通すと、また出る */
  ok(J(await moderate(V1, 'place', H, 'public')) === FORBIDDEN, '本人は自分で公開へ戻せない（forbidden）');
  /* ★公開へ戻すには、運営が見た版の印（rev）が要る ── 見ていない版を、id だけで通せない */
  ok(typeof opa.rev === 'string' && /^[0-9a-f]{16}$/.test(opa.rev) && qa.rev === opa.rev && v1a.rev === undefined,
     '★版の印は運営にだけ添えられる（一覧と待ち行列で同じ値・本人の返事には無い）', J([opa.rev, qa.rev, v1a.rev]));
  ok(status(await moderate(OP, 'place', H, 'public')) === 'changed'
     && status(await moderate(OP, 'place', H, 'public', '0000000000000000')) === 'changed'
     && (await one(`select state from public.pv_stay_places where id = $1`, [H])).state === 'pending',
     '★直された場所は、印なし・古い印では公開へ戻せない（changed・確認待ちのまま）');
  ok((await moderate(OP, 'place', H, 'public', opa.rev)).ok === true, '運営が通す（見た版の印を添える）');
  const v2b = find(await hel(V2), H);
  ok(v2b && v2b.state === 'public' && v2b.mine === false && v2b.name === 'テスト用ホテルH1 新館' && v2b.city === 'テスト新市'
     && v2b.photos.length === 1 && (await photo(V2, FH)).b64 === jpegN(2001),
     '★運営が通すと、直した中身でまた出る（写真も）', J(v2b));

  /* 欄を消す・地図のリンク・種別 */
  const e2 = await upd(V1, { id: H, address: null, note: '   ', city: '', maps_url: 'https://example.com/not-maps' });
  ok(e2.changed === true && e2.item.address === null && e2.item.note === null && e2.item.city === null
     && e2.item.maps_url === null && e2.item.name === 'テスト用ホテルH1 新館' && e2.item.state === 'pending',
     'null か空を送った欄は消える・通らない地図のリンクは捨てる（足すときと同じ）・公開済みからまた確認待ちへ', J(e2.item));
  const e3 = await upd(V1, { id: H, kind: 'food', maps_url: 'https://www.google.com/maps/place/Test+H1' });
  ok(e3.changed === true && e3.item.kind === 'food' && e3.item.maps_url === 'https://www.google.com/maps/place/Test+H1'
     && (await rowOf(H)).edit_n === 3, '種別と地図のリンクも直せる（確認待ちのまま直しても回数は進む）', J(e3.item));
  await upd(V1, { id: H, kind: 'hotel' });

  /* 検品は足す口と同じ */
  const rb = await rowOf(H);
  const bad = async (label, o, want) => {
    const r = await upd(V1, { id: H, ...o });
    ok(status(r) === want && keys(r) === 'ok,status', `直す: ${label} → ${want}`, J(r));
  };
  await bad('種別が白リストの外', { kind: 'bar' }, 'bad_kind');
  await bad('種別を null に', { kind: null }, 'bad_kind');
  await bad('名前が1字', { name: 'A' }, 'bad_name');
  await bad('名前を空に', { name: '' }, 'bad_name');
  await bad('名前を null に', { name: null }, 'bad_name');
  await bad('名前が81字', { name: 'あ'.repeat(81) }, 'bad_name');
  await bad('住所が201字', { address: 'あ'.repeat(201) }, 'too_long');
  await bad('メモが501字', { note: 'あ'.repeat(501) }, 'too_long');
  await bad('都市が61字', { city: 'あ'.repeat(61) }, 'bad_city');
  ok(J(await rowOf(H)) === J(rb), '↑ 弾かれたものは1文字も入っていない（状態も回数もそのまま）');
  const lim = await upd(V1, { id: H, name: 'テ'.repeat(80), address: '住'.repeat(200), note: 'メ'.repeat(500), city: '都'.repeat(60) });
  ok(lim.changed === true && lim.item.name.length === 80 && lim.item.address.length === 200
     && lim.item.note.length === 500 && lim.item.city.length === 60, '直す: 通る側の端（名前80字・住所200字・メモ500字・都市60字）', J(lim));
  const nm = await upd(V1, { id: H, name: 'テスト用\n\tホテル　H1', address: ' テスト用の\n住所 ', note: ' 1行目\n2行目 ', city: 'テスト\n市' });
  ok(nm.item.name === 'テスト用 ホテル H1' && nm.item.address === 'テスト用の 住所' && nm.item.note === '1行目\n2行目' && nm.item.city === 'テスト 市',
     '直す: 名前・住所・都市は1行にそろう・メモの改行は残る（足すときと同じ）', J(nm.item));

  /* 同じ名前 ── 足す口と同じ決まり */
  const m2 = await addFresh(V1, P('etihad', 'HEL', 'hotel', 'Test Hotel H2'));     // 自分の別の場所（確認前）
  const p3 = await addFresh(V2, P('etihad', 'HEL', 'hotel', 'Test Hotel H3'));     // 他人の場所（公開する）
  await moderate(OP, 'place', p3.item.id, 'public');
  const q4 = await addFresh(V2, P('etihad', 'HEL', 'hotel', 'Test Hotel H4'));     // 他人の場所（確認前のまま）
  ok(status(await upd(V1, { id: H, name: 'test  hotel h2' })) === 'duplicate', '直した先の名前を、自分がもう出している → duplicate');
  ok(status(await upd(V1, { id: H, name: 'TEST HOTEL H3' })) === 'exists', '直した先の名前が、もう公開されている → exists');
  const leak = await upd(V1, { id: H, name: 'Test Hotel H4' });
  ok(leak.ok === true && leak.changed === true, '★他人が確認前で同じ名前を出していても、exists とも duplicate とも返さない', J(leak));
  const cs = await upd(V1, { id: H, name: 'TEST HOTEL H4' });
  ok(cs.ok === true && cs.changed === true && cs.item.name === 'TEST HOTEL H4', '自分自身とは比べない（大文字小文字だけを直すのは通る）', J(cs));
  ok(J(await upd(V1, { id: q4.item.id, note: 'テスト用のメモ' })) === NOT_FOUND && J(await upd(V1, { id: p3.item.id, note: 'テスト用のメモ' })) === NOT_FOUND
     && (await rowOf(p3.item.id)).note === null, '他人の確認前も・公開済みも、どちらも同じ not_found（書き換わっていない）');

  /* 見送られたもの・消したもの */
  await moderate(OP, 'place', m2.item.id, 'rejected');
  const rj0 = await rowOf(m2.item.id);
  ok(status(await upd(V1, { id: m2.item.id, name: 'Test Hotel H2 改' })) === 'final' && J(await rowOf(m2.item.id)) === J(rj0)
     && rj0.state === 'rejected', '見送られたものは直せない（final。直しても公開へ戻る道が無いので、出し直してもらう）');
  await del(V1, 'place', m2.item.id);
  ok(J(await upd(V1, { id: m2.item.id, name: 'Test Hotel H2 改' })) === NOT_FOUND, '消したものは直せない（not_found）');

  /* 運営が自分で書いたもの */
  const o1 = await addFresh(OP, P('etihad', 'HEL', 'food', 'テスト用レストランO1'));
  await moderate(OP2, 'place', o1.item.id, 'public');
  const oe = await upd(OP, { id: o1.item.id, note: 'テスト用のメモO' });
  ok(oe.changed === true && oe.item.state === 'pending' && oe.item.mine === true,
     '運営が自分で書いたものは、書いた本人として直せる（同じく確認待ちへ戻る）', J(oe));
  ok(status(await moderate(OP, 'place', o1.item.id, 'public')) === 'own_post'
     && (await moderate(OP2, 'place', o1.item.id, 'public', find(await hel(OP2), o1.item.id).rev)).ok === true,
     '★直したあとも、運営は自分のものを自分で公開へ戻せない（own_post）。別の運営なら通せる');

  /* 24時間に20回 ── 回数の箱（edit_from・edit_n）を直接置いてから呼ぶ */
  const setBox = (id, n, ago) => db.query(
    `update public.pv_stay_places set edit_n = $2::int, edit_from = now() - $3::interval where id = $1`, [id, n, ago]);
  await db.query(`update public.pv_stay_places set edit_n = 0, edit_from = null where author_hash = $1`, [hashOf(V1)]);
  const other = (await addFresh(V1, P('etihad', 'HEL', 'spot', 'テスト用スポットH5'))).item.id;
  await setBox(other, 20, '1 hour');
  const lim0 = await rowOf(H);
  ok(status(await upd(V1, { id: H, note: 'テスト用のメモ 21回目' })) === 'rate_limited' && J(await rowOf(H)) === J(lim0),
     '24時間に20回を超える → rate_limited（別の場所で直した回数も合わせて数える・行は変わらない）');
  ok((await upd(V1, { id: H })).changed === false, '上限に達していても、何も変えない送り直しは今までどおり（changed:false）');
  ok((await upd(V2, { id: q4.item.id, note: 'テスト用のメモ' })).changed === true, '回数は人ごと（ほかの人の上限には響かない）');
  await setBox(other, 19, '1 hour');
  ok((await upd(V1, { id: H, note: 'テスト用のメモ 20回目' })).changed === true, '19回なら20回目は通る');
  ok(status(await upd(V1, { id: H, note: 'テスト用のメモ 21回目' })) === 'rate_limited', '↑ で20回に達したので、次は rate_limited');
  await setBox(other, 20, '25 hours');
  ok((await upd(V1, { id: H, note: 'テスト用のメモ 次の日' })).changed === true && (await rowOf(H)).edit_n === 2,
     '24時間より前に直した回数は数えない');
  await setBox(H, 20, '25 hours');
  const nx = await upd(V1, { id: H, note: 'テスト用のメモ 箱の切り替わり' });
  ok(nx.changed === true && (await rowOf(H)).edit_n === 1, '箱が24時間を過ぎていたら、回数は1から数え直す', J(await rowOf(H)));
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 全部の返事をまとめて見る（漏れが無いか）');
{
  /* 1) 資格の無い人へ返ったものは、決まった定型文のどれかと完全に同じ */
  const fixed = new Set([LOCKED_READ, LOCKED, FORBIDDEN, NOT_FOUND, BAD_TARGET]);
  const out = seen.filter((s) => OUTSIDERS.includes(s.who));
  const odd = out.filter((s) => !fixed.has(s.json));
  ok(out.length >= 60 && odd.length === 0,
     `★資格の無い人への返事 ${out.length} 本が、全部 定型文と1文字も違わない（名前も件数も id も無い）`,
     J(odd.slice(0, 3).map((s) => [NAMES.get(s.who), s.fn, s.json.slice(0, 200)])));
  ok(out.every((s) => !/テスト用|photos|places|others|can_add/.test(s.json)), '↑ ホテル名・欄の名前すら入っていない');

  /* 2) ハッシュ・生の uid・時刻が、誰への返事にも無い */
  const all = seen.map((s) => s.json).join('\n');
  const hashes = [V1, V2, V3, OP, OP2].map((u) => hashOf(u));
  const inDb = (await db.query(`select distinct author_hash as h from public.pv_stay_places
                                union select distinct author_hash from public.pv_stay_photos`)).rows.map((r) => r.h);
  ok(inDb.length >= 3 && inDb.every((h) => hashes.includes(h)), '（表に在るハッシュは、手元で作った式と同じ値）', J(inDb));
  ok(hashes.every((h) => !all.includes(h)) && inDb.every((h) => !all.includes(h)),
     `★実際のハッシュ値が、${seen.length} 本の返事のどこにも無い`);
  ok([V1, V2, V3, U, PAY, PROF, BADGE, GHOST, REV, OP, OP2].every((u) => !all.includes(u)), '生の uid がどこにも無い');
  ok(!/author_hash|created_at|moderated_at|byte_len|updated_at|edit_from|edit_n/.test(all), '表の列の名前（author_hash・created_at・updated_at…）がどこにも無い');
  ok(!/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(all), '日付と時刻の形をした文字列がどこにも無い');

  /* 3) 欄の名前は決めたものだけ（件数の欄を足していない） */
  const ALLOWED = new Set(['ok', 'state', 'status', 'can_add', 'is_operator', 'places', 'others', 'airline', 'iata',
    'id', 'kind', 'name', 'address', 'maps_url', 'note', 'city', 'age', 'mine', 'photos', 'item', 'photo',
    'mime', 'w', 'h', 'b64', 'target', 'place', 'place_state', 'changed', 'rev']);
  const used = new Set();
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const k of Object.keys(v)) { used.add(k); walk(v[k]); } };
  for (const s of seen) walk(JSON.parse(s.json));
  const extra = [...used].filter((k) => !ALLOWED.has(k));
  ok(extra.length === 0 && ![...used].some((k) => /count|total|hash|uid|user|_at$/.test(k)),
     '返事に出る欄は決めた30個の中だけ（件数・ハッシュ・時刻の欄が無い）', J(extra));
  ok(ALLOWED.size === 30 && used.has('city') && used.has('changed'), '（都市と「変わったか」の欄は、実際に返っている）', String(ALLOWED.size));
  ok(used.has('rev') && seen.filter((s) => /"rev"/.test(s.json)).every((s) => s.who === OP || s.who === OP2),
     '★版の印（rev）は、運営への返事にしか出ない');

  /* 4) 返した id は全部 乱数の uuid（v4）。時刻から作る形（v1・v7）だと、id そのものが時刻を運ぶ
        ＝ 写真を id の順に並べても足した順が分かってしまう */
  const ids = new Set();
  const walkIds = (v) => {
    if (Array.isArray(v)) v.forEach(walkIds);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      if ((k === 'id' || k === 'place') && typeof x === 'string') ids.add(x); else walkIds(x);
    }
  };
  for (const s of seen) walkIds(JSON.parse(s.json));
  const notV4 = [...ids].filter((x) => !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x));
  ok(ids.size >= 20 && notV4.length === 0, `★返した id ${ids.size} 個が全部 乱数の uuid（時刻から作る形ではない）`, J(notV4.slice(0, 3)));
  const defs = (await db.query(
    `select table_name as t, column_default as d from information_schema.columns
      where table_schema = 'public' and table_name in ('pv_stay_places','pv_stay_photos') and column_name = 'id'`)).rows;
  ok(defs.length === 2 && defs.every((x) => /^gen_random_uuid\(\)$/.test(String(x.d))), '↑ id の既定は gen_random_uuid()（2つの表とも）', J(defs));
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ SQL の書き方（読んで確かめる）');
{
  const code = STAYS_SQL.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
  ok(!/\bto_jsonb\s*\(|row_to_json/i.test(code), '行を丸ごと JSON にする書き方（to_jsonb・row_to_json）が無い');
  ok(!/'(author_hash|created_at|moderated_at|byte_len|bytes|updated_at|edit_from|edit_n)'/.test(code), 'ハッシュ・時刻・画素・直した回数を JSON の欄として名指ししていない');
  ok(!/create\s+policy/i.test(code) && !/force\s+row\s+level/i.test(code), 'ポリシーを作っていない');
  ok(!/grant\s[^;]*\bto\s+public\b/i.test(code), 'PUBLIC に何も配っていない');
  /* 門の根拠にしてはいけないものを、コードが1度も読んでいない */
  /* ⚠️ 「position」は職位の列の名前でもあり、バイト列の中を探す SQL の関数の名前でもある。
       写真を作り直す部品が次の 0xFF を探すのに使う1か所（position('\xff'::bytea in …)）だけを、
       その形のまま名指しで外してから見る。ほかの position は今までどおり全部引っかかる。 */
  const POS_FF = `position('\\xff'::bytea in `;
  ok(code.split(POS_FF).length === 2, '（バイト列を探す position(…) は、写真を作り直す部品の1か所だけ）', String(code.split(POS_FF).length - 1));
  const banned = code.split(POS_FF).join('').match(/access_until|pv_my_give|badge|founding|pay_reports|verified_airline|\bsource\b|company|"position"|\bposition\b/gi);
  ok(!banned, '★給与の鍵・バッジ・プロフィールの会社と職位・FOUNDING を、コードが1度も読んでいない', J(banned));
  ok(!/reviews_v2|pv_has_review_key|pv_review_hash|proof_hash/i.test(code), '★口コミの鍵（reviews_v2・pv_has_review_key）も、コードが1度も読んでいない');
  ok((code.match(/verify_level/g) || []).length >= 1 && /coalesce\(p\.verify_level, 0\) >= 1/.test(code), '印の判定は verify_level >= 1 の1か所');
  const fns = code.split(/create or replace function/).slice(1);
  ok(fns.length === 23 && fns.every((f) => /set search_path = public, extensions\s+as \$fn\$/.test(f)),
     '23本の関数すべてに set search_path = public, extensions', String(fns.length));
  const fn = (name) => fns.find((f) => f.trimStart().startsWith('public.' + name + '(')) || '';
  /* 印の判定は、毎回「会員がその列を書けない」ことも見ている（4通り全部） */
  const gate = fn('pv_is_verified_pilot');
  ok((gate.match(/not has_column_privilege\('(authenticated|anon)', 'public\.profiles', 'verify_level', '(UPDATE|INSERT)'\)/g) || []).length === 4,
     '★印の判定の中で、会員と未ログインが verify_level を書けないことを毎回確かめている（4通り）');
  /* 段を「書いた時刻からの長さ」で切っていない（切ると、段が変わる瞬間から書いた時刻が分かる） */
  const age = fn('pv_stay_age');
  ok(age !== '' && !/interval/i.test(age) && /at time zone 'utc'/.test(age), '★段は暦の月（UTC）で切っている（interval との比較で切っていない）');
  /* 写真を足した順に並べていない（並べると、自分の写真で挟んで他人の写真の時刻を絞れる） */
  const pj = fn('pv_stay_place_json');
  ok(pj !== '' && !/created_at/.test(pj.replace(/public\.pv_stay_age\(s\.created_at\)/, '')) && /order by f\.id\)/.test(pj),
     '★1件を返す形の中で、時刻を使うのは段（age）の1か所だけ・写真の並びは id の順');
  ok(!/updated_at|edit_from|edit_n|moderated_at/.test(pj) && /'city',\s+s\.city,/.test(pj)
     && /'mine',\s+coalesce\(s\.author_hash = p_me, false\)/.test(pj),
     '★1件を返す形に、直した時刻・直した回数が入っていない／都市は入っている／mine は「自分のか」の真偽だけ');
  /* 直す口 ── 資格は門をそのまま呼ぶ・検品の式を写していない・会社と空港に触れない・直したら確認待ち */
  const ad = fn('pv_stay_add'), up = fn('pv_stay_update'), cl = fn('pv_stay_clean'), cs = fn('pv_stay_clash');
  ok(up !== '' && /v_role := public\.pv_stay_role\(\);\s+if v_role is null then\s+return jsonb_build_object\('ok', false, 'status', 'locked'\);/.test(up)
     && up.indexOf('public.pv_stay_role()') < up.indexOf('from public.pv_stay_places'),
     '★直す口は、表を読む前に門（pv_stay_role）を通る');
  ok(/where id = v_id and author_hash = v_me\s+for update;/.test(up) && /v_me := public\.pv_stay_hash\(auth\.uid\(\)\);/.test(up),
     '★直す口が探すのは「自分のもの」だけ（持ち主の印は今ある式を呼んで作る）');
  ok(cl !== '' && cs !== '' && [ad, up].every((f) => /from public\.pv_stay_clean\(/.test(f) && /public\.pv_stay_clash\(/.test(f)
       && !/regexp_replace|char_length|pv_stay_maps_url|not in \('hotel'/.test(f)),
     '★足す口と直す口は、同じ検品（pv_stay_clean）と同じ「同じ名前」の判定（pv_stay_clash）を呼ぶ（式を写していない）');
  ok(!/p\s*->>?\s*'(airline|iata)'/.test(up) && !/\b(airline|iata)\s*=\s*v_/.test(up) && !/'(airline|iata)',/.test(up),
     '★直す口は、会社と空港を読まない・書き換えない');
  ok(/state\s+= 'pending',\s+moderated_at = null,\s+updated_at\s+= now\(\),/.test(up),
     '★直したら必ず pending へ戻し、運営が見た時刻を消し、直した時刻を進める');
  ok(up.indexOf('for update;') > 0 && up.indexOf('for update;') < up.indexOf('pg_advisory_xact_lock'),
     '直す口の錠の順番は「場所の行 → 人ごとの錠」（写真を足す口と同じ向き）');
  ok((code.match(/set state = v_state, moderated_at = now\(\)/g) || []).length === 1
     && (code.match(/^\s*(set\s+)?state\s*= 'pending',?\s*$/gm) || []).length === 1
     && /^\s*state\s+= 'pending',$/m.test(up) && !/'pending'/.test(fn('pv_stay_moderate')),
     '★場所を pending へ書き戻す所は、直す口の1か所だけ（運営の口には無い）', String((code.match(/^\s*(set\s+)?state\s*= 'pending',?\s*$/gm) || []).length));
  /* 会員が読む関数（一覧・1件・写真）の並びに時刻を使っていない。使うのは運営の待ち行列だけ */
  const byTime = fns.filter((f) => /order by[^;]*created_at/.test(f)).map((f) => f.trimStart().split('(')[0]);
  ok(byTime.join(',') === 'public.pv_stay_queue', '時刻で並べるのは運営の待ち行列だけ', byTime.join(','));
  /* 写真を足すとき、場所の行を錠つきで読んでいる（読んでから入れるまでの間に見送られても画素が残らない） */
  ok(/from public\.pv_stay_places where id = v_pid for share;/.test(fn('pv_stay_photo_add')),
     '写真を足すとき、場所の行を for share で読んでいる');
  /* 保存する前に、サーバーで作り直している（届いたバイト列をそのまま入れていない） */
  const pa = fn('pv_stay_photo_add');
  const REBUILD = 'select r.body, r.w, r.h into v_bytes, v_w, v_h from public.pv_jpeg_read(v_raw) r;';
  ok(pa.indexOf(REBUILD) > 0 && pa.indexOf(REBUILD) < pa.indexOf('insert into public.pv_stay_photos')
     && (code.match(/insert into public\.pv_stay_photos/g) || []).length === 1
     && /values \(v_pid, v_me, v_bytes, octet_length\(v_bytes\), v_w, v_h\)/.test(pa),
     '★写真を表に入れる所は1か所だけで、入れるのは作り直したバイト列と、写真から読んだ縦横');
  ok(!/p\s*->>\s*'(w|h)'/.test(pa) && (pa.match(/v_raw/g) || []).length === 4,
     '★送られてきた w・h を読んでいない／届いたままのバイト列（v_raw）は作り直しに渡したら捨てている', String((pa.match(/v_raw/g) || []).length));
  ok(!/pv_stay_jpeg_clean\s*\(/.test(code.replace(/drop function if exists public\.pv_stay_jpeg_clean\(bytea\);/, '')),
     '前の部品（pv_stay_jpeg_clean）は、消す1行のほかに1度も出てこない');
  ok(/add constraint pv_stay_photos_clean_ck check \(\s*bytes is null or public\.pv_jpeg_is_clean\(bytes\)\)/.test(code)
     && /add constraint pv_stay_photos_dims_ck check \(\s*bytes is null\s+or \(w is not null and h is not null and array\[w, h\] = public\.pv_jpeg_dims\(bytes\)\)\)/.test(code)
     && !/substring\(bytes from 1 for 3\)|get_byte\(bytes, 0\)/.test(code),
     '★表の CHECK は「作り直した形そのもの」と「縦横が写真のとおり」（先頭3バイトだけを見る形に戻っていない）');
  ok((await db.query(`select conname from pg_constraint where conrelid = 'public.pv_stay_photos'::regclass and contype = 'c' order by 1`)).rows
       .map((x) => x.conname).filter((c) => /clean_ck|dims_ck/.test(c)).join(',') === 'pv_stay_photos_clean_ck,pv_stay_photos_dims_ck',
     '↑ その2本が実際に表に付いている');
  ok(!/\/Users\/|\/home\//.test(STAYS_SQL), '絶対パスが書かれていない');
  ok(/自動では流れない/.test(STAYS_SQL) && /流す順番/.test(STAYS_SQL), '冒頭に「自動では流れない・流す順番」が書いてある');
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 冪等性（データが入った状態でもう一度流す）');
{
  const snap = async () => J({
    places: (await db.query(`select id, author_hash, airline, iata, kind, name, address, maps_url, note, city, state, created_at,
                                      moderated_at, updated_at, edit_from, edit_n
                               from public.pv_stay_places order by id`)).rows,
    photos: (await db.query(`select id, place_id, author_hash, md5(bytes) as m, byte_len, w, h, state, created_at
                               from public.pv_stay_photos order by id`)).rows,
  });
  const view = async () => J([await stays(V1), await stays(V2), await stays(OP), await stays(V2, 'etihad', 'SIN'),
                              await stays(U), await stays(ANON), await queue(OP)]);
  const s0 = await snap(), v0 = await view();
  let e = '';
  try { await db.exec(STAYS_SQL); } catch (err) { e = String(err.message); }
  ok(e === '', 'データが在っても、もう一度流せる', e);
  ok((await snap()) === s0, '表の中身が1文字も変わっていない');
  ok((await view()) === v0, '返事が1文字も変わっていない');
  await checkGrants('流し直したあと: ');
  const pol = await one(`select count(*)::int as n from pg_policies where schemaname='public' and tablename in ('pv_stay_places','pv_stay_photos')`);
  ok(pol.n === 0, '流し直したあと: ポリシーは 0 本のまま');
}

// ════════════════════════════════════════════════════════════════
console.log('\n▼ 前提が無ければ日本語で止まる（別の空の DB で）');
{
  const bare = new PGlite({ extensions: { pgcrypto } });
  await bare.waitReady;
  await bare.exec(`
    create schema if not exists extensions;
    create schema if not exists auth;
    create role anon;
    create role authenticated;
    grant usage on schema public, extensions to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  `);
  const stop = async (label, want) => {
    let e = null;
    try { await bare.exec(STAYS_SQL); } catch (err) { e = String(err.message || err); }
    ok(e !== null && want.every((w) => e.includes(w)) && /[ぁ-ん]/.test(e), label, e === null ? '止まらずに流れた' : e);
  };
  await stop('会社の名簿が無い → 「先に db/airlines.generated.sql」', ['db/airlines.generated.sql']);
  await bare.exec(`create table public.pv_airlines (code text primary key, active boolean not null default true);
                   create table public.profiles (id uuid primary key, company text);`);
  await stop('確認の印の列が無い → 「先に db/pay-reports.sql」', ['db/pay-reports.sql']);
  await bare.exec(`alter table public.profiles add column verify_level smallint not null default 0;`);
  await stop('運営の判定が無い → 「先に db/pay-rows.sql」', ['db/pay-rows.sql']);
  await bare.exec(`create function public.pv_is_operator() returns boolean language sql stable as $$ select false $$;`);
  await stop('運営の名簿が無い → 「先に db/admin.sql」', ['db/admin.sql']);
  await bare.exec(`create table public.pv_admins (user_id uuid primary key, note text);`);
  await stop('★会員が確認の印を自分で書ける状態 → 「先に db/admin.sql」で止まる', ['db/admin.sql', '自分で書ける']);
  const none = (await bare.query(`select to_regclass('public.pv_stay_places') is null as n`)).rows[0].n;
  ok(none === true, '止まったときは表を1つも作っていない');
  await bare.exec(`revoke all on public.profiles from anon;
                   revoke insert, update on public.profiles from authenticated;`);
  let e = '';
  try { await bare.exec(STAYS_SQL); } catch (err) { e = String(err.message || err); }
  ok(e === '', '前提がそろえば流れる', e);
  await bare.close();
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
