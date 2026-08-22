/* patch-unlock-wording.mjs — 口コミ解放の「30日間 / 1ヶ月」という約束を画面から消す
 *
 * なぜ:
 *   口コミ枠の鍵は、サーバ側にもともと期限が無い。DB が覚えているのは
 *   「この人は口コミを出したことがあるか」（reviews_v2 の proof_hash）だけで、これは永久の事実。
 *   30日は端末に置いた付箋の寿命にすぎず、ログインのたび・航空会社ページを開くたびに
 *   30日へ書き直されていた＝実質すでに期限なしだった。
 *   2026-08-22、オーナー判断で期限を正式に外した（pv-session.js の PVUnlock）。
 *   画面に残った「30日間 / 1ヶ月」は、実態より小さく見せる嘘になるので消す。
 *
 * 方針:
 *   期間を別の数字に置き換えない。**期間の語だけ落として文を成立させる。**
 *   例: 「全社の口コミが30日間読めます」→「全社の口コミが読めます」
 *
 * 触らないもの（本当に30日/1ヶ月のもの）:
 *   台湾入国後のホテル30日 / IPハッシュ30日保持 / 預かり証30日 / ログイン最長30日 /
 *   招待TTL / 退会後30日で削除 / 「有給 15–30日」 / 「1ヶ月ぶんの明細」 /
 *   **年収枠の90日はすべて**（あちらはサーバの access_until が正で、本当に切れる）
 *
 * 使い方:
 *   node patch-unlock-wording.mjs --check   … 変えずに差分だけ見る
 *   node patch-unlock-wording.mjs           … 適用する
 *
 * 冪等。何度流しても同じ結果になる（適用済みは「・済」と出るだけ）。
 * 1件でも数が合わなければ **1ファイルも書かない**（途中まで書いた状態を作らない）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT  = fileURLToPath(new URL('.', import.meta.url));
const CHECK = process.argv.includes('--check');

// [ファイル, 今の文字列, 置き換え後, 期待する出現回数]
const EDITS = [

  /* ── 共有JS（1本直せば航空会社224ページに効く） ───────────────── */

  // 鍵のオーバーレイ（EN）
  // ★ソース中は 'airline\\'s' と \\ で逃がしてある。その \\ ごと一致させる
  ['airlines/premium-auth-lock.js',
   "unlock every airline\\'s reviews for 30 days — completely free.",
   "unlock every airline\\'s reviews — completely free.", 1],
  ['airlines/premium-auth-lock.js',
   "unlock every airline\\'s reviews for 30 days.",
   "unlock every airline\\'s reviews.", 1],
  ['airlines/premium-auth-lock.js',
   "'Anonymous · No name required · 30-day access'",
   "'Anonymous · No name required'", 1],
  // 鍵のオーバーレイ（JA）— descAnon と descLogged の2か所が同じ文末を持つ
  ['airlines/premium-auth-lock.js',
   '全社の口コミが30日間読めるようになります。',
   '全社の口コミが読めるようになります。', 2],
  ['airlines/premium-auth-lock.js',
   "'完全匿名 · 名前不要 · 30日間アクセス'",
   "'完全匿名 · 名前不要'", 1],

  // 口コミカードのゲート（JA）
  ['airlines/airline-reviews-ui.js',
   '全社の口コミが30日間まるごと読めます。',
   '全社の口コミがまるごと読めます。', 1],
  ['airlines/airline-reviews-ui.js',
   "'完全匿名 · 名前不要 · 30日間アクセス'",
   "'完全匿名 · 名前不要'", 1],
  ['airlines/airline-reviews-ui.js',
   '全てのレビュー全文を<strong style="color:#e8edf2">1ヶ月間</strong>閲覧できます',
   '全てのレビュー全文を<strong style="color:#e8edf2">閲覧できます</strong>', 1],
  ['airlines/airline-reviews-ui.js',
   '全カテゴリの口コミを<strong style="color:#e8edf2">1ヶ月間無料</strong>で閲覧できます。',
   '全カテゴリの口コミを<strong style="color:#e8edf2">無料</strong>で閲覧できます。', 1],
  // 口コミカードのゲート（EN）
  ['airlines/airline-reviews-ui.js',
   'reviews open up for a full month.',
   'reviews open up.', 1],
  ['airlines/airline-reviews-ui.js',
   "'Completely anonymous · No name required · 30-day access'",
   "'Completely anonymous · No name required'", 1],
  ['airlines/airline-reviews-ui.js',
   'to read every review in full for <strong style="color:#e8edf2">a month</strong>',
   'to read <strong style="color:#e8edf2">every review in full</strong>', 1],
  ['airlines/airline-reviews-ui.js',
   'read every category <strong style="color:#e8edf2">free for a month</strong>.',
   'read every category <strong style="color:#e8edf2">for free</strong>.', 1],

  // 英語の航空会社ページのゲートは airline-reviews-ui.js ではなくこちらが描く
  ['en/airlines/en-airline-reviews.js',
   'Post one anonymous review and every detail<br>unlocks for a full month.',
   'Post one anonymous review and every detail<br>unlocks.', 1],

  /* ── マイページ ───────────────────────────────────────────── */

  ['profile.html',    '<b>全社の口コミが30日間</b>読めます', '<b>全社の口コミが読めます</b>', 2],
  ['en/profile.html', '<b>reviews unlock for 30 days</b>',   '<b>reviews unlock</b>',        2],

  /* ── 登録完了 ─────────────────────────────────────────────── */

  ['signup.html',
   '<b style="color:#f5c842">全社の口コミが30日間解放</b>されます。',
   '<b style="color:#f5c842">全社の口コミが解放</b>されます。', 1],
  ['en/signup.html',
   '<b style="color:#f5c842">every airline\'s reviews unlock for 30 days</b>.',
   '<b style="color:#f5c842">every airline\'s reviews unlock</b>.', 1],

  /* ── 転職ガイド ───────────────────────────────────────────── */

  ['pilot-tenshoku.html',
   '口コミを1件出すと全社の口コミが30日間読めます',
   '口コミを1件出すと全社の口コミが読めます', 1],
  ['en/pilot-tenshoku.html',
   'every airline&rsquo;s reviews open for 30 days',
   'every airline&rsquo;s reviews open up', 1],

  /* ── 口コミ投稿 ───────────────────────────────────────────── */

  ['submit-review.html',
   '全社の口コミが<strong class="text-text">30日間</strong>読めるようになります。',
   '全社の口コミが<strong class="text-text">読めるようになります</strong>。', 1],
  ['submit-review.html',
   '全社の口コミが<strong class="text-text" style="color:#f5c842">30日間</strong>読めるようになりました。',
   '全社の口コミが<strong class="text-text" style="color:#f5c842">読めるようになりました</strong>。', 1],
  // meta（description / og / twitter の3枚）
  ['submit-review.html',
   '1件の投稿で全社の口コミが30日間読めます。',
   '1件の投稿で全社の口コミが読めます。', 3],
  ['en/submit-review.html',
   "One review unlocks every airline's reviews for 30 days.",
   "One review unlocks every airline's reviews.", 3],
  ['en/submit-review.html',
   'reviews for <strong class="text-text">30 days</strong>. No personally identifiable',
   'reviews. No personally identifiable', 1],
  ['en/submit-review.html',
   'are now open to you for <strong class="text-text" style="color:#f5c842">30 days</strong>.',
   'are now <strong class="text-text" style="color:#f5c842">open to you</strong>.', 1],

  /* ── 口コミ一覧 ───────────────────────────────────────────── */

  ['community.html',
   '口コミを1件投稿すれば、全社の口コミを1ヶ月間読めます。',
   '口コミを1件投稿すれば、全社の口コミを読めます。', 1],
  ['community.html',
   'すべての口コミが<strong>1ヶ月間</strong>読めるようになります。',
   'すべての口コミが<strong>読めるようになります</strong>。', 1],
  ['community.html',
   '<span class="privacy-badge">🔓 1ヶ月アクセス有効</span>',
   '<span class="privacy-badge">🔓 口コミ解放中</span>', 1],
  ['community.html',
   '全社の口コミを<strong class="text-text">1ヶ月間無料で</strong>読めます',
   '全社の口コミを<strong class="text-text">無料で</strong>読めます', 1],
  ['community.html',   // meta 3枚
   '1件投稿すると全社の口コミが1か月開きます。',
   '1件投稿すると全社の口コミが開きます。', 3],

  ['en/community.html',
   'you can read every airline&rsquo;s reviews for a month.',
   'you can read every airline&rsquo;s reviews.', 1],
  ['en/community.html',
   'Every airline&rsquo;s reviews open up for <strong>one month</strong>.',
   'Every airline&rsquo;s <strong>reviews open up</strong>.', 1],
  ['en/community.html',
   '<span class="privacy-badge">🔓 1-month access active</span>',
   '<span class="privacy-badge">🔓 Reviews unlocked</span>', 1],
  ['en/community.html',
   'reviews <strong class="text-text">free for one month</strong>',
   'reviews <strong class="text-text">for free</strong>', 1],

  /* ── スターラックス（唯一、本文を鍵で隠しているページ） ───────── */

  ['airlines/starlux-tenshoku.html',
   '<strong style="color:#f5c842">この先 約12,000文字</strong> が30日間解放されます',
   '<strong style="color:#f5c842">この先 約12,000文字</strong> が解放されます', 1],
  ['en/airlines/starlux-tenshoku.html',
   '<strong style="color:#f5c842">the remaining ~12,000 characters</strong> for 30 days',
   '<strong style="color:#f5c842">the remaining ~12,000 characters</strong>', 1],

  /* ── メール ───────────────────────────────────────────────── */

  ['mail-bot/send.mjs',
   '<strong>全社の口コミが30日間解放</strong>されます',
   '<strong>全社の口コミが解放</strong>されます', 1],
  /* ★これは期間だけの問題ではない。年収データは「口コミ」ではなく「給与明細」で開く枠。
       口コミ枠と年収枠を分けた時点でこの1文は事実と違っていたので、中身ごと直す。 */
  ['mail-bot/send.mjs',
   '※ 詳細な年収データは、いずれか1社に口コミを投稿すると30日間解放されます。',
   '※ 詳細な年収データは、給与明細を1枚出すと90日間解放されます。', 1],

  /* ── SEO の元表（seo-normalize.mjs は再実行される。ここを直さないと meta が戻る） ── */

  ['seo-normalize.mjs',
   '1件投稿すると全社の口コミが1か月開きます。',
   '1件投稿すると全社の口コミが開きます。', 1],
  ['seo-normalize.mjs',
   '1件の投稿で全社の口コミが30日間読めます。',
   '1件の投稿で全社の口コミが読めます。', 1],
  ['seo-normalize.mjs',   // ここも \\ 逃がし
   "One review unlocks every airline\\'s reviews for 30 days.",
   "One review unlocks every airline\\'s reviews.", 1],
];

const cnt = (h, n) => h.split(n).length - 1;
const buf = new Map();
let bad = 0, done = 0, already = 0;

for (const [file, oldStr, newStr, want] of EDITS) {
  const abs = path.join(ROOT, file);
  if (!buf.has(file)) {
    if (!fs.existsSync(abs)) { console.log(`❌ ${file} — ファイルが無い`); bad++; continue; }
    buf.set(file, fs.readFileSync(abs, 'utf8'));
  }
  const src = buf.get(file);
  const n = cnt(src, oldStr);
  const m = cnt(src, newStr);

  if (n === 0 && m >= want) { already++; console.log(`・済 ${file} — ${oldStr.slice(0, 34)}…`); continue; }
  if (n !== want) {
    bad++;
    console.log(`❌ ${file} — ${want}件のはずが ${n}件: ${oldStr.slice(0, 50)}…`);
    continue;
  }
  buf.set(file, src.split(oldStr).join(newStr));
  done++;
  console.log(`✅ ${file} ×${want} — ${oldStr.slice(0, 40)}…`);
}

if (!CHECK && !bad) {
  for (const [file, out] of buf) fs.writeFileSync(path.join(ROOT, file), out);
}

console.log(`\n${CHECK ? '[--check] ' : ''}適用 ${done} / 済 ${already} / 不一致 ${bad}`);
if (bad) {
  console.log('不一致があるので 1ファイルも書いていない。上の❌を直してから流す。');
  process.exitCode = 1;
} else if (CHECK) {
  console.log('--check なので書いていない。--check を外すと適用する。');
}
