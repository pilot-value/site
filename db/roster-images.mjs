/* ════════════════════════════════════════════════════════════════
   roster-images.mjs — 読めなかった勤務表の画像（pv_roster_images）を運営が見る道具（2026-11-16）
   オーナー「読めないなら保存して今後に使え」。parse-roster が、読めない所があったページと
   読み取りに失敗したページの画像を残す（90日で消える）。ここはそれを一覧・取り出し・削除するだけ。

   使い方（本番の DB を service key で読む・書くのは --drop だけ）:
     node db/roster-images.mjs                     一覧（番号・日時・理由・ページ・欠けの数・大きさ）。誰の画像かは出ない（持っていない）
     node db/roster-images.mjs --get <番号|all>   画像を取り出す（既定はリポジトリの外の一時フォルダ・--out <フォルダ> で変えられる）
                                                   名前は「<番号>-p1.jpg」＝ db/eval-roster.mjs --dir でそのまま読める
     node db/roster-images.mjs --drop <番号>      その画像を消す（読み取りを直し終えたら消す）

   要るもの: mail-bot/.env の SUPABASE_URL / SUPABASE_SERVICE_KEY（--env で別の .env を指せる）
   ⚠️ 画像には氏名・社員番号・ほかの乗員の名前が写る。**リポジトリの中に置かない**（--out がリポジトリの中なら止める）。
      使い終わったら取り出したファイルも消す。チャットやメールに貼らない。
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const envPath = opt('--env', path.join(ROOT, 'mail-bot/.env'));
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY がありません（mail-bot/.env）。'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const rest = async (q, init = {}) => {
  const res = await fetch(`${URL_}/rest/v1/${q}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
};
const COLS = 'id,created_at,why,page,pages,gaps,mime,byte_len,build';

const getArg = opt('--get', null), dropArg = opt('--drop', null);
if (dropArg) {
  if (!/^\d+$/.test(dropArg)) { console.error('❌ --drop には番号を1つ'); process.exit(1); }
  await rest(`pv_roster_images?id=eq.${dropArg}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  console.log(`消した: ${dropArg}`);
} else if (getArg) {
  const out = path.resolve(opt('--out', path.join(os.tmpdir(), 'pv-roster-images')));
  if (out === ROOT || out.startsWith(ROOT + path.sep)) { console.error('❌ リポジトリの中には取り出さない（--out を外のフォルダに）'); process.exit(1); }
  mkdirSync(out, { recursive: true });
  const q = getArg === 'all' ? '' : /^\d+$/.test(getArg) ? `&id=eq.${getArg}` : null;
  if (q === null) { console.error('❌ --get には番号か all'); process.exit(1); }
  const rows = await rest(`pv_roster_images?select=id,mime,bytes${q}&order=id`);
  for (const r of rows) {
    const ext = r.mime === 'image/png' ? 'png' : r.mime === 'image/webp' ? 'webp' : 'jpg';
    const hex = String(r.bytes || '').replace(/^\\x/, '');
    const f = path.join(out, `${r.id}-p1.${ext}`);
    writeFileSync(f, Buffer.from(hex, 'hex'));
    console.log(f);
  }
  console.log(`${rows.length}枚 → ${out}（使い終わったら消す）`);
} else {
  const rows = await rest(`pv_roster_images?select=${COLS}&order=id.desc&limit=200`);
  if (!rows.length) console.log('残っている画像はありません。');
  for (const r of rows) {
    const g = r.gaps && typeof r.gaps === 'object'
      ? Object.entries(r.gaps).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join('・') : '';
    console.log(`${String(r.id).padStart(5)}  ${r.created_at.slice(0, 16).replace('T', ' ')}  ${r.why.padEnd(14)} ${r.page}/${r.pages}枚目  ${Math.round(r.byte_len / 1024)}KB  ${r.build || '-'}  ${g}`);
  }
}
