/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — mail-bot/delete-review.mjs  v1.0
   reviews_v2 の口コミを service_role で安全に「1件だけ」削除する手動ツール。
   admin.html は閲覧専用で削除できないため、乱打・テスト投稿などのゴミを
   オーナーが id 指定でピンポイント削除するために使う。

   設計:
     - 依存追加なし。Supabase REST を fetch のみで叩く（Node18+）。
     - service_role キーは mail-bot/.env のみ（gitignore 済）。フロントには絶対に置かない。
     - 一括削除は不可。--delete は id 1件のみ。--all 等は用意しない（誤消し防止）。

   使い方:
     node mail-bot/delete-review.mjs --list            # 直近50件を一覧（読み取りのみ・品質NGフラグ付き）
     node mail-bot/delete-review.mjs --list --ng       # 品質NGフラグが付いた行だけ一覧
     node mail-bot/delete-review.mjs --delete <id>     # 指定 id を1件だけ削除（削除前に対象を表示）
     node mail-bot/delete-review.mjs --delete <id> --yes  # 確認プロンプトなしで削除
   代替: Supabase ダッシュボードの Table editor から該当行を削除でも可。
════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInterface } from 'readline';

const __dir = dirname(fileURLToPath(import.meta.url));

/* ── .env 手動読込（admin-notify と同型） ── */
const envPath = join(__dir, '.env');
if (!existsSync(envPath)) {
  console.error('❌ mail-bot/.env がありません。mail-bot/.env.example をコピーして設定してください。');
  process.exit(1);
}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const s = line.trim();
  if (!s || s.startsWith('#')) continue;
  const [k, ...v] = s.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY が未設定です。');
  process.exit(1);
}

const args    = process.argv.slice(2);
const LIST    = args.includes('--list');
const NG_ONLY = args.includes('--ng');
const YES     = args.includes('--yes');
const delIdx  = args.indexOf('--delete');
const DELETE_ID = delIdx >= 0 ? args[delIdx + 1] : null;

const HEADERS = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY };
const CATS = ['culture','salary','benefits','wlb','ops','training','mgmt'];

/* ── 品質判定（submit-review.html / admin-notify.mjs と同一ロジック・reason 簡潔版）
   ⚠️ 同じ関数が5か所にある。直すときは5つとも直す。
   一致は node assert-review-quality.mjs が5か所すべてを実際に動かして確かめる。 ── */
function assessReviewQuality(raw) {
  const t = (raw || '').replace(/\s+/g, ' ').trim();
  const len = t.length;
  if (len === 0) return { ok: true, reason: '' };
  if (/(.)\1{4,}/u.test(t)) return { ok: false, reason: '同一文字の連打' };
  const rep = t.match(/(.{2,}?)\1{2,}/u);
  if (rep && rep[0].length >= Math.max(12, len * 0.5)) return { ok: false, reason: '同一語句の反復' };
  const uniq = new Set(t.replace(/\s/g, '')).size;
  if (len >= 40 && uniq < 10) return { ok: false, reason: '文字種過少（水増し）' };
  const latin = t.match(/[A-Za-z]/g) || [];
  if (latin.length >= 12) {
    const vowels = t.match(/[AEIOUaeiou]/g) || [];
    if (vowels.length / latin.length < 0.15) return { ok: false, reason: 'ラテン乱打（母音欠落）' };
  }
  // ⚠️ 多様性を全長で割らない（本物の長文ほど必ず比率が下がる）。固定長の窓の最悪値で見る。
  if (len >= 40) {
    const ns = t.replace(/\s/g, '');
    const WIN = 200, STEP = 100;
    const diversity = (s) => {
      const grams = [];
      for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
      return grams.length >= 8 ? new Set(grams).size / grams.length : 1;
    };
    let worst = ns.length <= WIN ? diversity(ns) : 1;
    for (let i = 0; i + WIN <= ns.length; i += STEP) worst = Math.min(worst, diversity(ns.slice(i, i + WIN)));
    if (ns.length > WIN) worst = Math.min(worst, diversity(ns.slice(-WIN)));
    if (worst < 0.35) return { ok: false, reason: '低多様性の反復' };
  }
  return { ok: true, reason: '' };
}
function assessReviewSet(r) {
  const norm = s => (s || '').replace(/【[^】]*】/g, '').replace(/\s+/g, '').toLowerCase();
  const items = CATS.map(k => norm(r[k + '_comment'])).filter(n => n.length >= 20);
  const bigrams = s => { const set = new Set(); for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2)); return set; };
  const sim = (a, b) => {
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length);
    const A = bigrams(a), B = bigrams(b); let inter = 0;
    for (const g of A) if (B.has(g)) inter++;
    const uni = A.size + B.size - inter;
    return uni ? inter / uni : 0;
  };
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (sim(items[i], items[j]) > 0.8) return { ok: false, reason: 'カテゴリ間コピペ' };
  return { ok: true, reason: '' };
}
function combined(r) { return CATS.map(k => r[k + '_comment']).filter(Boolean).join(' '); }
function flagOf(r) {
  const qText = assessReviewQuality(combined(r));
  const qSet  = assessReviewSet(r);
  return qText.ok ? qSet : qText;
}

async function fetchRecent() {
  const params = new URLSearchParams();
  params.set('select', ['id','airline','position','created_at', ...CATS.map(k => k + '_comment')].join(','));
  params.set('order', 'created_at.desc');
  params.set('limit', '50');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews_v2?${params.toString()}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchOne(id) {
  const params = new URLSearchParams();
  params.set('select', ['id','airline','position','created_at', ...CATS.map(k => k + '_comment')].join(','));
  params.set('id', 'eq.' + id);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews_v2?${params.toString()}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

function confirm(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); });
  });
}

(async () => {
  if (LIST) {
    const rows = await fetchRecent();
    const shown = rows.map(r => ({ r, q: flagOf(r) })).filter(x => !NG_ONLY || !x.q.ok);
    console.log(`直近${rows.length}件中 ${shown.length}件を表示${NG_ONLY ? '（品質NGのみ）' : ''}\n`);
    for (const { r, q } of shown) {
      const excerpt = combined(r).replace(/\s+/g, ' ').slice(0, 60);
      const flag = q.ok ? '' : `  ⚠️ ${q.reason}`;
      console.log(`id=${r.id}  ${r.created_at}  [${r.airline}]${flag}`);
      console.log(`    ${excerpt}${excerpt.length >= 60 ? '…' : ''}`);
    }
    if (!shown.length) console.log('（該当なし）');
    console.log('\n削除するには: node mail-bot/delete-review.mjs --delete <id>');
    return;
  }

  if (DELETE_ID) {
    const row = await fetchOne(DELETE_ID);
    if (!row) { console.error(`❌ id=${DELETE_ID} の口コミが見つかりません。--list で確認してください。`); process.exit(1); }
    const q = flagOf(row);
    console.log('── 削除対象 ──');
    console.log(`id        : ${row.id}`);
    console.log(`airline   : ${row.airline}`);
    console.log(`created_at: ${row.created_at}`);
    console.log(`品質判定  : ${q.ok ? 'OK（通常の口コミ）' : 'NG（' + q.reason + '）'}`);
    console.log(`本文抜粋  : ${combined(row).replace(/\s+/g, ' ').slice(0, 120)}`);
    console.log('');

    if (!YES) {
      const ans = await confirm(`この1件を削除します。よろしいですか？ (yes/no): `);
      if (ans !== 'yes' && ans !== 'y') { console.log('中止しました。'); return; }
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews_v2?id=eq.${encodeURIComponent(DELETE_ID)}`, {
      method: 'DELETE',
      headers: { ...HEADERS, Prefer: 'return=representation' },
    });
    if (!res.ok) { console.error('❌ 削除失敗', res.status, await res.text()); process.exit(1); }
    const deleted = await res.json().catch(() => []);
    console.log(`✓ 削除完了（${Array.isArray(deleted) ? deleted.length : 1}件）: id=${DELETE_ID}`);
    return;
  }

  console.log('使い方:');
  console.log('  node mail-bot/delete-review.mjs --list          直近50件を一覧');
  console.log('  node mail-bot/delete-review.mjs --list --ng     品質NGの行だけ一覧');
  console.log('  node mail-bot/delete-review.mjs --delete <id>   指定id を1件だけ削除');
})();
