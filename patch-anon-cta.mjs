/* patch-anon-cta.mjs — 「出す」ボタンの文字に「匿名で」／`anonymously` を入れる。

   なぜ: 書く直前にいちばん不安なのは「身元がバレるのか」で、いまそれに答えているのは
   ボタンから2〜3行離れた説明文の中だけ。押す瞬間の文字で言う。
   すでに pilot-tenshoku.html / privacy-pilot.html の2か所だけがそう書いてあって
   例外になっていたのを、サイト全体にそろえる（2026-08-19 オーナー指示）。

   再実行可能・冪等。node patch-anon-cta.mjs [--check]
     --check … 書き換えずに、いま何件当たるかだけ出す

   ★航空会社110社×日英のページは1枚も触らない。口コミ・給与のゲートは共有の JS
     （airlines/airline-reviews-ui.js / airlines/premium-auth-lock.js /
      en/airlines/en-airline-reviews.js）が描いているので、そこを直せば全社に効く。

   ★<title> / og:* / <h1> は触らない（検索順位を動かさないため・オーナー決定）。
     旧文字列を前後のタグごと持っているので、構造上それらには当たらない。

   ★英語は語順を変えて後ろに置く（Add your pay anonymously）。日本語は先頭。
     溢れたときは "anonymously" を消すのではなく、尻尾（and compare など）を削る。
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const CHECK = process.argv.includes('--check');

/* [ファイル, いまの文字列, あとの文字列, 期待する件数（既定1）] */
const EDITS = [
  // ── トップページ（日）
  ['index.html', 'data-pv-ev="nav_primary_cta">給与を追加</a>', 'data-pv-ev="nav_primary_cta">匿名で給与を追加</a>'],
  ['index.html', 'data-pv-ev="hero_primary_cta">\n        給与を追加\n', 'data-pv-ev="hero_primary_cta">\n        匿名で給与を追加\n'],
  ['index.html', 'data-pv-ev="payslip_upload_start">明細から追加</a>', 'data-pv-ev="payslip_upload_start">匿名で明細から追加</a>'],
  /* ★「匿名で手入力で追加」は「で」が2回で読めない。ここだけ言い方を変える。 */
  ['index.html', 'data-pv-ev="salary_contribution_start">手入力で追加</a>', 'data-pv-ev="salary_contribution_start">匿名で手入力して追加</a>'],
  ['index.html', 'data-pv-ev="actual_pay_contribute_cta">給与を追加してモザイクを外す</a>', 'data-pv-ev="actual_pay_contribute_cta">匿名で給与を追加してモザイクを外す</a>'],
  ['index.html', 'data-pv-ev="review_submit_start">自分の職場について書く</a>', 'data-pv-ev="review_submit_start">匿名で自分の職場について書く</a>'],
  ['index.html', 'data-pv-ev="salary_contribution_start">給与を追加</a>', 'data-pv-ev="salary_contribution_start">匿名で給与を追加</a>'],
  ['index.html', 'data-pv-ev="mobile_cta">給与を追加</a>', 'data-pv-ev="mobile_cta">匿名で給与を追加</a>'],
  // ── トップページ（英）
  ['en/index.html', 'data-pv-ev="nav_primary_cta">Add your pay</a>', 'data-pv-ev="nav_primary_cta">Add your pay anonymously</a>'],
  ['en/index.html', 'data-pv-ev="hero_primary_cta">\n        Add your pay and compare\n', 'data-pv-ev="hero_primary_cta">\n        Add your pay anonymously\n'],
  ['en/index.html', 'data-pv-ev="payslip_upload_start">Start from a payslip</a>', 'data-pv-ev="payslip_upload_start">Start from a payslip, anonymously</a>'],
  ['en/index.html', 'data-pv-ev="salary_contribution_start">Type it in instead</a>', 'data-pv-ev="salary_contribution_start">Type it in anonymously</a>'],
  /* ★尻尾の "and unlock" を落とした。付けたまま（33字）だと 390px で2行に折れ、
     48px の丸ボタンに2行が押し込まれる（実測: 文字が246pxの枠に入らない）。
     計画どおり "anonymously" ではなく尻尾を削る。1行に収まるのは 181px。
     解放される話は、すぐ上の錠前ピルと見出しが言っている。 */
  ['en/index.html', 'data-pv-ev="actual_pay_contribute_cta">Add my pay and unlock</a>', 'data-pv-ev="actual_pay_contribute_cta">Add my pay anonymously</a>'],
  ['en/index.html', 'data-pv-ev="review_submit_start">Write about your own airline</a>', 'data-pv-ev="review_submit_start">Write anonymously about your own airline</a>'],
  ['en/index.html', 'data-pv-ev="salary_contribution_start">Add your pay and compare</a>', 'data-pv-ev="salary_contribution_start">Add your pay anonymously</a>'],
  ['en/index.html', 'data-pv-ev="mobile_cta">Add your pay and compare</a>', 'data-pv-ev="mobile_cta">Add your pay anonymously</a>'],
  // ── マイページ
  ['profile.html', '\n          給与を追加 →\n', '\n          匿名で給与を追加 →\n'],
  ['profile.html', '\n          給与を追加\n', '\n          匿名で給与を追加\n'],
  ['profile.html', 'class="pv-cta-ghost">口コミを投稿する</a>', 'class="pv-cta-ghost">匿名で口コミを投稿する</a>', 2],
  ['en/profile.html', '\n          Submit your first payslip →\n', '\n          Submit your first payslip anonymously →\n'],
  ['en/profile.html', '\n          Submit a payslip\n', '\n          Submit a payslip anonymously\n'],
  ['en/profile.html', 'class="pv-cta-ghost">Post a review</a>', 'class="pv-cta-ghost">Post a review anonymously</a>', 2],
  // ── マイレポート／待遇ページのヘッダーボタン
  ['my-value.html', '<span>給与を追加</span>', '<span>匿名で給与を追加</span>'],
  ['en/my-value.html', '<span>Add pay</span>', '<span>Add pay anonymously</span>'],
  ['airline-conditions.html', '<span>給与を追加</span>', '<span>匿名で給与を追加</span>'],
  ['en/airline-conditions.html', '<span>Add pay</span>', '<span>Add pay anonymously</span>'],
  // ── マイレポート本体（日英1ファイル）
  ['my-value.js', "sampleBtn: '給与を追加する →'", "sampleBtn: '匿名で給与を追加する →'"],
  ['my-value.js', "nextAdd: '給与を追加する →'", "nextAdd: '匿名で給与を追加する →'"],
  ['my-value.js', "sampleBtn: 'Add pay →'", "sampleBtn: 'Add pay anonymously →'"],
  ['my-value.js', "nextAdd: 'Add pay →'", "nextAdd: 'Add pay anonymously →'"],
  // ── 口コミ一覧
  ['community.html', 'class="btn-orange py-2 px-5 text-sm">口コミを投稿</a>', 'class="btn-orange py-2 px-5 text-sm">匿名で口コミを投稿</a>'],
  ['community.html', 'class="btn-orange">口コミを投稿して解放する', 'class="btn-orange">匿名で口コミを投稿して解放する'],
  ['community.html', 'onclick="openModal()">口コミを投稿して解放する</button>', 'onclick="openModal()">匿名で口コミを投稿して解放する</button>'],
  /* ヘッダーの CTA。日本語は「匿名で口コミを投稿」になったのに、英語だけ
     "Post a Review" のまま残っていた（2026-08-20、ヘッダー整理中に発見）。 */
  ['en/community.html', 'class="btn-orange py-2 px-5 text-sm">Post a Review</a>', 'class="btn-orange py-2 px-5 text-sm">Post a review anonymously</a>'],
  ['en/community.html', 'class="btn-orange">Post a review to unlock', 'class="btn-orange">Post a review anonymously to unlock'],
  ['en/community.html', 'onclick="openModal()">Post a review to unlock</button>', 'onclick="openModal()">Post a review anonymously to unlock</button>'],
  // ── 転職・プライバシー・登録完了
  ['pilot-tenshoku.html', 'class="btn-orange py-2 px-4 text-sm">口コミを投稿</a>', 'class="btn-orange py-2 px-4 text-sm">匿名で口コミを投稿</a>'],
  ['en/pilot-tenshoku.html', 'class="btn-orange py-2 px-4 text-sm">Post a Review</a>', 'class="btn-orange py-2 px-4 text-sm">Post a Review Anonymously</a>'],
  ['privacy-pilot.html', 'class="btn-orange py-2 px-5 text-sm">口コミを投稿する →</a>', 'class="btn-orange py-2 px-5 text-sm">匿名で口コミを投稿する →</a>'],
  ['en/privacy-pilot.html', 'class="btn-orange py-2 px-5 text-sm">Submit a review →</a>', 'class="btn-orange py-2 px-5 text-sm">Submit a review anonymously →</a>'],
  ['signup.html', ">口コミを書く（約60秒）</button>", ">匿名で口コミを書く（約60秒）</button>"],
  ['en/signup.html', ">Write a review (about 60s)</button>", ">Write a review anonymously (about 60s)</button>"],
  // ── 待遇モーダルの中の導線（日英1ファイル）
  ['pv-conditions.js', "voicesLink: '口コミを書く →'", "voicesLink: '匿名で口コミを書く →'"],
  ['pv-conditions.js', "voicesLink: 'Write a review →'", "voicesLink: 'Write a review anonymously →'"],
  // ── ★航空会社110社×日英に効く共有 JS
  ['airlines/airline-reviews-ui.js', "postReview: '口コミを投稿する'", "postReview: '匿名で口コミを投稿する'"],
  ['airlines/airline-reviews-ui.js', "postReviewShort: '＋ 口コミを投稿する'", "postReviewShort: '＋ 匿名で口コミを投稿する'"],
  ['airlines/airline-reviews-ui.js', "lockedCta: '口コミを投稿して解放する'", "lockedCta: '匿名で口コミを投稿して解放する'"],
  ['airlines/airline-reviews-ui.js', "gateBtn: '口コミを投稿して解放する'", "gateBtn: '匿名で口コミを投稿して解放する'"],
  ['airlines/airline-reviews-ui.js', "rmBtn: '口コミを投稿して解放する'", "rmBtn: '匿名で口コミを投稿して解放する'"],
  ['airlines/airline-reviews-ui.js', "vcGateBtn: '口コミを投稿して全カテゴリを開放する →'", "vcGateBtn: '匿名で口コミを投稿して全カテゴリを開放する →'"],
  ['airlines/airline-reviews-ui.js', "postReview: 'Post a review'", "postReview: 'Post a review anonymously'"],
  ['airlines/airline-reviews-ui.js', "postReviewShort: '＋ Post a review'", "postReviewShort: '＋ Post a review anonymously'"],
  ['airlines/airline-reviews-ui.js', "lockedCta: 'Post a review to unlock'", "lockedCta: 'Post a review anonymously to unlock'"],
  ['airlines/airline-reviews-ui.js', "gateBtn: 'Post a review to unlock'", "gateBtn: 'Post a review anonymously to unlock'"],
  ['airlines/airline-reviews-ui.js', "rmBtn: 'Post a review to unlock'", "rmBtn: 'Post a review anonymously to unlock'"],
  ['airlines/airline-reviews-ui.js', "vcGateBtn: 'Post a review to unlock every category →'", "vcGateBtn: 'Post a review anonymously to unlock every category →'"],
  ['airlines/premium-auth-lock.js', "ctaPost:       '口コミを投稿して解放する'", "ctaPost:       '匿名で口コミを投稿して解放する'"],
  ['airlines/premium-auth-lock.js', "salCta:        '給与明細を出して解放する'", "salCta:        '匿名で給与明細を出して解放する'"],
  ['airlines/premium-auth-lock.js', "ctaPost:       'Post a Review & Unlock'", "ctaPost:       'Post a Review Anonymously & Unlock'"],
  ['airlines/premium-auth-lock.js', "salCta:        'Submit a Payslip & Unlock'", "salCta:        'Submit a Payslip Anonymously & Unlock'"],
  ['en/airlines/en-airline-reviews.js', 'class="enrv-btn">Post a review to unlock</a>', 'class="enrv-btn">Post a review anonymously to unlock</a>'],
  ['en/airlines/en-airline-reviews.js', 'class="enrv-btn enrv-btn-sm">＋ Post a review</a>', 'class="enrv-btn enrv-btn-sm">＋ Post a review anonymously</a>'],
  // ── 記事ページ（手書きの2枚だけ。他の航空会社ページは共有 JS が描く）
  ['airlines/starlux-tenshoku.html', 'text-sm py-2 px-5">口コミを投稿して全文解放</a>', 'text-sm py-2 px-5">匿名で口コミを投稿して全文解放</a>'],
  ['airlines/starlux-tenshoku.html', '\n        口コミを投稿して全文を読む\n', '\n        匿名で口コミを投稿して全文を読む\n'],
  ['airlines/starlux-tenshoku.html', 'class="btn-orange">口コミを投稿する</a>', 'class="btn-orange">匿名で口コミを投稿する</a>'],
  ['en/airlines/starlux-tenshoku.html', 'text-sm py-2 px-5">Post a review to unlock the full article</a>', 'text-sm py-2 px-5">Post a review anonymously to unlock the full article</a>'],
  ['en/airlines/starlux-tenshoku.html', '\n        Post a review and read it all\n', '\n        Post a review anonymously and read it all\n'],
  ['en/airlines/starlux-tenshoku.html', 'class="btn-orange">Post a review</a>', 'class="btn-orange">Post a review anonymously</a>']
];

const cnt = (h, n) => h.split(n).length - 1;
const buf = new Map();
const load = (f) => {
  if (!buf.has(f)) buf.set(f, fs.readFileSync(path.join(ROOT, f), 'utf8'));
  return buf.get(f);
};

let done = 0, skip = 0, bad = 0;
for (const [f, oldS, newS, want = 1] of EDITS) {
  const s = load(f);
  const o = cnt(s, oldS), n = cnt(s, newS);
  const head = `${f} … ${JSON.stringify(oldS.trim().slice(-34))}`;
  if (o === 0 && n >= want) { skip++; console.log(`  ・済 ${head}`); continue; }
  if (o !== want) {
    bad++;
    console.log(`  ❌ ${head}\n       見つかった件数 ${o}（期待 ${want}）・新しい文字列は ${n} 件`);
    continue;
  }
  buf.set(f, s.split(oldS).join(newS));
  done++;
  console.log(`  ✅ ${head} × ${want}`);
}

if (!CHECK && !bad) for (const [f, s] of buf) fs.writeFileSync(path.join(ROOT, f), s);

console.log(`\n  ${CHECK ? '（--check なので書いていない）' : '書き換えた'}: ${done} 件 / 済み: ${skip} 件 / 合わない: ${bad} 件`);
if (bad) {
  console.log('  ❌ 1件でも合わないときは何も書かない。文字列がずれているので直してから流す。');
  process.exitCode = 1;
}
