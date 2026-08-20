/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — mail-bot/admin-notify.mjs  v1.0
   新規会員登録・新規口コミ投稿を検知し、管理者（info@pilot-value.com）へ
   要約メールを送る。会員向け配信と違い「自社アドレス宛」なので
   特定電子メール法のオプトイン対象外＝同意不要で先行実装できる。

   設計:
     - 依存追加なし。Supabase REST と Resend API を fetch のみで叩く（Node18+）。
     - 前回実行時刻を .admin-notify-state.json に保存し、それ以降の新規のみ通知。
     - 初回実行は「今」を基準にし過去分は送らない（--backfill で全件、--since=ISO で指定）。
     - 投稿本文に品質フラグ（連打/反復/水増し）を付す＝API直投稿のすり抜けを管理者が気付ける。
     - tweet-bot/post.mjs と同型（.env 手動読込＋状態json＋.gitignore）。

   使い方:
     node mail-bot/admin-notify.mjs            # 新規があれば通知
     node mail-bot/admin-notify.mjs --dry-run  # 送らず対象と本文プレビュー
     node mail-bot/admin-notify.mjs --backfill # 状態を無視し全件対象（初回まとめ通知）
     node mail-bot/admin-notify.mjs --since=2026-07-01T00:00:00Z
   cron 例（15分毎）: 0,15,30,45 * * * * cd /path/to/repo && node mail-bot/admin-notify.mjs
════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

/* ── .env 手動読込（tweet-bot と同型） ── */
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
const RESEND_KEY   = process.env.RESEND_API_KEY;
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL || 'info@pilot-value.com';
const FROM_EMAIL   = process.env.FROM_EMAIL  || 'PILOT VALUE <noreply@pilot-value.com>';

const args     = process.argv.slice(2);
const DRY      = args.includes('--dry-run');
const BACKFILL = args.includes('--backfill');
const sinceArg = (args.find(a => a.startsWith('--since=')) || '').split('=')[1];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY が未設定です。');
  process.exit(1);
}
if (!DRY && !RESEND_KEY) {
  console.error('❌ RESEND_API_KEY が未設定です（--dry-run 以外では必須）。');
  process.exit(1);
}

/* ── 口コミ品質チェック（submit-review.html と同一ロジック・reason は管理用に簡潔化）
   ⚠️ 同じ関数が5か所にある（submit-review.html / en/submit-review.html / ここ /
   delete-review.mjs / supabase/functions/notify-admin/index.ts）。直すときは5つとも直す。
   一致は node assert-review-quality.mjs が5か所すべてを実際に動かして確かめる。 ── */
function assessReviewQuality(raw) {
  const t = (raw || '').replace(/\s+/g, ' ').trim();
  const len = t.length;
  if (len === 0) return { ok: true, reason: '' };
  // 1) 同一文字の連打
  if (/(.)\1{4,}/u.test(t)) return { ok: false, reason: '同一文字の連打' };
  // 2) 同一語句の反復
  const rep = t.match(/(.{2,}?)\1{2,}/u);
  if (rep && rep[0].length >= Math.max(12, len * 0.5)) return { ok: false, reason: '同一語句の反復' };
  // 3) 文字種過少（水増し）
  const uniq = new Set(t.replace(/\s/g, '')).size;
  if (len >= 40 && uniq < 10) return { ok: false, reason: '文字種過少（水増し）' };
  // 4) ラテン乱打（母音欠落）：英字12文字以上で母音率15%未満
  const latin = t.match(/[A-Za-z]/g) || [];
  if (latin.length >= 12) {
    const vowels = t.match(/[AEIOUaeiou]/g) || [];
    if (vowels.length / latin.length < 0.15) return { ok: false, reason: 'ラテン乱打（母音欠落）' };
  }
  // 5) 二連字多様性の欠落（機械的な反復パターン）
  //    ⚠️ 多様性を全長で割ってはいけない。異なり2連字はアルファベットの大きさで頭打ちになる一方、
  //    分母は長さに比例して伸び続けるので、本物の文章ほど必ず比率が下がる。固定長の窓の最悪値で見る。
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
    if (ns.length > WIN) worst = Math.min(worst, diversity(ns.slice(-WIN)));   // 刻みが届かない末尾も見る
    if (worst < 0.35) return { ok: false, reason: '低多様性の反復' };
  }
  return { ok: true, reason: '' };
}

/* ── カテゴリ間の同一段落コピペ検知（submit-review.html assessReviewSet と同一） ── */
function assessReviewSet(cats) {
  const norm = s => (s || '').replace(/【[^】]*】/g, '').replace(/\s+/g, '').toLowerCase();
  const items = Object.values(cats).map(c => norm(c.comment)).filter(n => n.length >= 20);
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

/* ── 1行分のレビューから cats 形式を組み立てる（assessReviewSet 用） ── */
function reviewCats(r) {
  const cats = {};
  for (const k of ['culture','salary','benefits','wlb','ops','training','mgmt']) cats[k] = { comment: r[k + '_comment'] || '' };
  return cats;
}

/* ── Supabase REST ── */
async function sbSelect(table, select, sinceIso) {
  const params = new URLSearchParams();
  params.set('select', select);
  params.set('order', 'created_at.asc');
  if (sinceIso) params.append('created_at', 'gt.' + sinceIso);
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
  });
  if (!res.ok) throw new Error(`${table} REST ${res.status}: ${await res.text()}`);
  return res.json();
}

/* ── 状態（前回実行時刻） ── */
const stateFile = join(__dir, '.admin-notify-state.json');
let state = { lastReviewAt: null, lastProfileAt: null };
if (existsSync(stateFile)) { try { state = { ...state, ...JSON.parse(readFileSync(stateFile, 'utf8')) }; } catch {} }

const nowIso = new Date().toISOString();
const firstRun = !state.lastReviewAt && !state.lastProfileAt;
// 判定基準：--backfill=全件 / --since=指定 / 状態あり=前回 / 初回=now（過去分は送らない）
const reviewSince  = BACKFILL ? null : (sinceArg || state.lastReviewAt  || nowIso);
const profileSince = BACKFILL ? null : (sinceArg || state.lastProfileAt || nowIso);

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
const POS = { captain:'機長', fo:'副操縦士', cadet:'訓練生' };

const REVIEW_SELECT = [
  'airline','position','age_bucket','tenure_bucket','monthly_salary','annual_salary',
  'culture_comment','salary_comment','benefits_comment','wlb_comment','ops_comment','training_comment','mgmt_comment',
  'created_at'
].join(',');
const PROFILE_SELECT = ['name','email','company','position','country','created_at'].join(',');

function reviewCombined(r) {
  return ['culture','salary','benefits','wlb','ops','training','mgmt']
    .map(k => r[k + '_comment']).filter(Boolean).join(' ');
}

(async () => {
  let reviews = [], profiles = [];
  try { reviews  = await sbSelect('reviews_v2', REVIEW_SELECT, reviewSince); }  catch (e) { console.error('reviews_v2 取得失敗:', e.message); }
  try { profiles = await sbSelect('profiles',   PROFILE_SELECT, profileSince); } catch (e) { console.error('profiles 取得失敗:', e.message); }

  console.log(`基準時刻  reviews:${reviewSince || '(全件)'}  profiles:${profileSince || '(全件)'}`);
  console.log(`新規口コミ: ${reviews.length}件 / 新規会員: ${profiles.length}件${firstRun && !BACKFILL && !sinceArg ? '（初回=監視開始。過去分は送信しません）' : ''}`);

  if (reviews.length === 0 && profiles.length === 0) {
    // 新規なし。初回だけは基準時刻を保存して監視を開始する。
    if (firstRun) { writeFileSync(stateFile, JSON.stringify({ lastReviewAt: nowIso, lastProfileAt: nowIso }, null, 2)); console.log('✓ 監視開始（基準時刻を保存）'); }
    console.log('通知対象なし。終了。');
    return;
  }

  const flagged = reviews.map(r => {
    // 全文の品質判定＋カテゴリ間コピペ判定のどちらかで NG ならフラグ
    const qText = assessReviewQuality(reviewCombined(r));
    const qSet  = assessReviewSet(reviewCats(r));
    const q = qText.ok ? qSet : qText;
    return { r, q };
  });
  const suspicious = flagged.filter(x => !x.q.ok).length;

  const subject = `【PILOT VALUE】新着 口コミ${reviews.length}・会員${profiles.length}${suspicious ? `（要確認${suspicious}）` : ''}`;

  const reviewRows = flagged.map(({ r, q }) => {
    const salary = r.annual_salary ? `${r.annual_salary}万円/年` : (r.monthly_salary ? `${r.monthly_salary}万円/月` : '—');
    const excerpt = reviewCombined(r).slice(0, 120);
    const flag = q.ok ? '' : ` <span style="color:#b91c1c;font-weight:700">⚠️ ${esc(q.reason)}</span>`;
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap">${esc(r.airline)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap">${esc(POS[r.position] || r.position || '—')} / ${esc(r.age_bucket || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap">${esc(salary)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee">${esc(excerpt)}${excerpt.length >= 120 ? '…' : ''}${flag}</td>
    </tr>`;
  }).join('');

  const profileRows = profiles.map(p => `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee">${esc(p.name || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee">${esc(p.email || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee">${esc(p.company || '—')} / ${esc(POS[p.position] || p.position || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee">${esc(p.country || '—')}</td>
    </tr>`).join('');

  const html = `<div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:720px;margin:0 auto;color:#111">
    <h2 style="font-size:18px;margin:0 0 4px">PILOT VALUE 管理通知</h2>
    <p style="color:#666;font-size:13px;margin:0 0 20px">${esc(new Date().toLocaleString('ja-JP'))} 時点の新着です。${suspicious ? `<b style="color:#b91c1c">品質フラグ ${suspicious}件</b> は内容をご確認ください。` : ''}</p>
    ${reviews.length ? `<h3 style="font-size:15px;margin:18px 0 8px">🆕 新着口コミ（${reviews.length}件）</h3>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead><tr style="background:#f5f5f5;text-align:left">
        <th style="padding:8px 10px">航空会社</th><th style="padding:8px 10px">職位/年代</th><th style="padding:8px 10px">年収</th><th style="padding:8px 10px">本文抜粋</th>
      </tr></thead><tbody>${reviewRows}</tbody></table>` : ''}
    ${profiles.length ? `<h3 style="font-size:15px;margin:22px 0 8px">👤 新規会員（${profiles.length}名）</h3>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead><tr style="background:#f5f5f5;text-align:left">
        <th style="padding:8px 10px">氏名</th><th style="padding:8px 10px">メール</th><th style="padding:8px 10px">在籍/職位</th><th style="padding:8px 10px">居住国</th>
      </tr></thead><tbody>${profileRows}</tbody></table>` : ''}
    <p style="color:#999;font-size:11px;margin-top:24px">このメールは管理者宛の自動通知です（mail-bot/admin-notify.mjs）。</p>
  </div>`;

  if (DRY) {
    console.log('\n──── DRY RUN（送信しません）────');
    console.log('To     :', ADMIN_EMAIL);
    console.log('Subject:', subject);
    console.log('品質フラグ:', suspicious, '件');
    console.log('（HTML本文は生成済み。実送信は --dry-run を外してください）');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [ADMIN_EMAIL], subject, html })
  });
  if (!res.ok) { console.error('❌ Resend 送信失敗', res.status, await res.text()); process.exit(1); }
  console.log('✓ 送信完了 →', ADMIN_EMAIL, '（口コミ' + reviews.length + '・会員' + profiles.length + '）');

  // 状態更新（最新の created_at を保存。無ければ now）
  const last = arr => arr.length ? arr[arr.length - 1].created_at : null;
  writeFileSync(stateFile, JSON.stringify({
    lastReviewAt:  last(reviews)  || state.lastReviewAt  || nowIso,
    lastProfileAt: last(profiles) || state.lastProfileAt || nowIso,
  }, null, 2));
})();
