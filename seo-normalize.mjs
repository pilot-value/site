/* ════════════════════════════════════════════════════════════════
   seo-normalize.mjs — 全ページの <head> の SEO 部分を一元管理する

   なぜ要るか（assert-seo.mjs が出した実測）
     ・og:image      288ページ全部で欠落。twitter:card は summary_large_image を
                     宣言済みなのに画像が無く、SNS 共有が文字だけになっていた。
     ・og:* 一式      149ページで欠落（英語の航空会社ページ116枚がまるごと）。
     ・hreflang       48ページで欠落。多言語サイトなのに日英の関連付けが切れていた。
     ・canonical      16ページで欠落、en/index.html は og:url が日本語トップを指していた。
     ・タイトル長      101ページが検索結果の表示幅を超過。
     ・noindex        ログイン・登録・個人領域が索引可能で、しかも sitemap にも載っていた。

   設計
     ・管理対象タグは <!--PV-SEO--> … <!--/PV-SEO--> の中に集約する。
       再実行時はブロックごと差し替えるので何度流しても同じ結果になる（冪等）。
     ・head 内に散らばった同種のタグ（旧 canonical 等）は先に全部剥がす。
       剥がしてから1箇所に書き直すので「2個ある canonical」も自動で解消する。
     ・★ 数値は salary-data.mjs（SSOT）から式で埋める。手で書かない。
       実際、index.html は「Emirates機長3,600万円〜」、pilot-salary-guide.html は
       「4,500万円」と書いてあり、SSOT の 3,700万円 と両方ズレていた。
       check-salary.mjs は会社ページしか見ないのでこのズレを拾えていない。
     ・同じ理由で「117社」表記も 110社（SSOT の実件数）に直す。数字を盛らない。

   実行: node seo-normalize.mjs           書き込む
        node seo-normalize.mjs --dry     差分だけ表示して書かない
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { SALARY } from './salary-data.mjs';
import { AIRLINE_COUNTRY, BY_CODE, nameIn } from './airline-countries.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const ORIGIN = 'https://pilot-value.com';
const DRY = process.argv.includes('--dry');

/* ── 数値ヘルパ（すべて SSOT 由来） ─────────────────────────── */
const S = SALARY;
const N = Object.keys(S).length;                       // 110
const USD_RATE = 160;                                  // currency.js と同じ換算
const man = (v) => `${v.toLocaleString('en-US')}万円`;
const usd = (v) => `$${Math.round((v * 10000) / USD_RATE / 1000)}K`;
const capJa = (k) => man(S[k].cap.avg);
const capEn = (k) => usd(S[k].cap.avg);
const topPay = Object.entries(S).sort((a, b) => b[1].cap.avg - a[1].cap.avg)[0];

/* ── 表示幅（全角2/半角1）— assert-seo.mjs と同じ尺度 ────────── */
const width = (s) => [...s].reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(c) ? 2 : 1), 0);
const BRAND = ' | PILOT VALUE';
/* Google の切り詰めは約600px。SERP のフォントで全角≒14px・半角≒7〜8px
   なので、幅単位（全角2/半角1）にすると概ね70が上限に当たる。 */
const TITLE_MAX = 70;
const CORE_MAX = TITLE_MAX - width(BRAND);

/* ── 公開対象外（noindex）─────────────────────────────────────
   検索結果に出しても価値が無く、出れば「薄いページの多いサイト」と
   見られる面。submit-review は元から noindex,nofollow（フォーム面）なので踏襲。 */
const NOINDEX = new Set([
  'admin.html', 'auth-callback.html', 'login.html', 'signup.html',
  'profile.html', 'my-value.html', 'pay-report.html', 'personal-data.html',
  'unsubscribe.html', '404.html', 'submit-review.html',
  /* 本人が自分の会社の待遇を答える画面。ログインが要るので検索に出さない。 */
  'airline-conditions.html',
  /* 給与明細を出した人だけが読める画面。ログインが要るので検索に出さない。 */
  'actual-pay.html',
  /* 2026-08-15 に求人の掲載を停止した。ページは残す（外部からのリンクを
     404 にしないため）が、中身が「停止中」の1行だけなので検索には出さない。
     gen-sitemap.mjs の同名の集合と対にしてある。 */
  'world-jobs.html',
]);

/* ════════════════════════════════════════════════════════════════
   ルートページのタイトル・説明文（日英）
   数値は式で埋めるので SSOT を更新して再実行すれば自動で追随する。
   ════════════════════════════════════════════════════════════════ */
const COPY = {
  'index.html': {
    ja: { t: `パイロット年収ランキング｜世界${N}社を比較【2026年最新】`,
          d: `パイロットの年収を世界${N}社で比較。ANA機長${capJa('ana')}・エミレーツ${capJa('emirates')}（非課税）・デルタ${capJa('delta')}。機長と副操縦士のレンジ、現役の口コミ、海外求人を無料公開。` },
    en: { t: `Pilot Salary Comparison — ${N} Airlines Worldwide [2026]`,
          d: `Compare pilot pay at ${N} airlines worldwide — ANA captain ${capEn('ana')}, Emirates ${capEn('emirates')} tax-free, Delta ${capEn('delta')}. Captain and first officer ranges, pilot reviews, and overseas jobs.` },
  },
  'world-airlines.html': {
    ja: { t: `世界の航空会社パイロット年収一覧｜${N}社の給与を比較`,
          d: `世界${N}社の航空会社のパイロット年収を一覧で比較。ANA・JAL・エミレーツ・カタール航空・シンガポール航空など、機長と副操縦士の平均とレンジを地域別に確認できます。` },
    en: { t: `Pilot Salary by Airline — All ${N} Airlines Compared`,
          d: `Pilot salaries at ${N} airlines worldwide in one table — ANA, JAL, Emirates, Qatar Airways, Singapore Airlines and more. Captain and first officer pay, by region.` },
  },
  /* 掲載元が募集終了の求人を消し、URL の番号を別の求人に付け替えるため、
     載せた求人は放っておくと必ず「無い／違う」になる。2026-08-15 に掲載を停止した。 */
  'world-jobs.html': {
    ja: { t: 'パイロット求人（掲載停止中）',
          d: '現在、求人情報の掲載を停止しています。航空会社別・国別のパイロット年収は引き続きご覧いただけます。' },
    en: { t: 'Pilot Jobs (listings suspended)',
          d: 'Job listings are currently suspended. Pilot pay by airline and by country remains available.' },
  },
  'pilot-salary-guide.html': {
    ja: { t: 'パイロット年収完全ガイド2026｜機長・副操縦士の給与',
          d: `パイロットの年収を国内外${N}社のデータから解説。機長と副操縦士の差、機種別・年次別の伸び方、日系と外資の手取り比較。ANA機長${capJa('ana')}、エミレーツ${capJa('emirates')}（非課税）。` },
    en: { t: 'Pilot Salary Guide 2026 — Captain & First Officer Pay',
          d: `What pilots actually earn, from ${N} airlines' data: the captain–first officer gap, how pay grows by fleet and seniority, and take-home at home vs overseas carriers.` },
  },
  'pilot-tenshoku.html': {
    ja: { t: 'パイロット転職ガイド｜転職先・年収の変化・必要条件',
          d: 'パイロットの転職を、転職先の選び方・年収の変化・必要な飛行時間と資格・実際の流れの順に解説。海外と国内の違い、失敗しないためのチェックポイントまで現役の匿名データで整理。' },
    en: { t: 'Pilot Career Moves — Where to Go and How Pay Changes',
          d: 'A working guide to changing airlines: picking the next carrier, what happens to your pay, the flight hours and ratings you need, and how the process actually runs.' },
  },
  'pilot-vs-bengoshi.html': {
    ja: { t: 'パイロットと弁護士、年収はどちらが高いか【2026年】',
          d: 'パイロットと弁護士の年収を、平均・生涯年収・到達までの費用と年数で比較。資格取得の難易度、収入が伸びるタイミング、リスクの種類まで、数字を並べて違いを整理しました。' },
    en: { t: 'Pilot vs Lawyer Salary — Which Pays More? [2026]',
          d: 'Pilot and lawyer pay compared on averages, lifetime earnings, and what it costs in money and years to qualify. Where each income curve rises, and the risks each carries.' },
  },
  'pilot-vs-isha.html': {
    ja: { t: 'パイロットと医者、年収はどちらが高いか【2026年】',
          d: 'パイロットと医師の年収を、平均・年代別の伸び方・資格取得までの費用と年数で比較。稼げる額だけでなく、勤務時間・定年・身体検査のリスクまで含めて整理しました。' },
    en: { t: 'Pilot vs Doctor Salary — Which Pays More? [2026]',
          d: 'Pilot and doctor pay compared: averages, how each curve rises with age, and the years and money it takes to qualify — plus hours, retirement age and medical risk.' },
  },
  'pilot-vs-kochin.html': {
    ja: { t: 'パイロット年収は高収入職業の中でどの位置か【2026年】',
          d: `パイロットの年収を、医師・弁護士・外資系金融・IT など日本の高収入職業と比較。ANA機長${capJa('ana')}がどの位置か、海外航空会社に移るとどう変わるかを数字で示します。` },
    en: { t: "Where Pilot Pay Ranks Among Top-Paying Careers [2026]",
          d: `Pilot pay lined up against doctors, lawyers, global finance and tech in Japan. Where an ANA captain's ${capEn('ana')} sits, and how that changes on an overseas contract.` },
  },
  'community.html': {
    ja: { t: 'パイロットの口コミ最新一覧｜全航空会社',
          d: `現役・元パイロットによる航空会社の口コミを最新順に掲載。待遇・勤務環境・訓練・昇格について${N}社ぶんの声を匿名で読めます。1件投稿すると全社の口コミが開きます。` },
    en: { t: 'Pilot Reviews — Latest from Every Airline',
          d: `Reviews from current and former airline pilots, newest first — pay, rosters, training and upgrade speed at ${N} airlines, anonymous. Post one review to unlock them all.` },
  },
  'guide.html': {
    ja: { t: 'ご利用案内｜PILOT VALUE の使い方',
          d: `PILOT VALUE の使い方。航空会社ページで機長・副操縦士の年収レンジと機材・路線を見る方法、${N}社の一覧を地域で絞り込む方法、口コミの投稿と閲覧の仕組みを説明します。` },
    en: { t: 'User Guide — How to Use PILOT VALUE',
          d: `How to use PILOT VALUE: reading captain and first officer ranges on an airline page, filtering ${N} airlines by region, and how one review unlocks every airline's reviews.` },
  },
  'help.html': {
    ja: { t: 'ヘルプ・よくある質問｜PILOT VALUE',
          d: '年収データの出どころ、会員登録が必要な範囲、通貨と言語の切り替え、投稿した口コミの扱いなど、よくいただく質問への回答をまとめています。' },
    en: { t: 'Help & FAQ | PILOT VALUE',
          d: 'Where the salary figures come from, what needs an account, how to switch currency and language, and what happens to a review after you post it. The questions we get most.' },
  },
  'contact.html': {
    ja: { t: 'お問い合わせ｜PILOT VALUE',
          d: 'PILOT VALUE へのご質問・ご要望・掲載内容の訂正依頼はこちらから。通常2〜3営業日以内に返信します。航空会社の方からの掲載情報に関するご連絡もお受けしています。' },
    en: { t: 'Contact | PILOT VALUE',
          d: 'Questions, requests, or a correction to something we have published. We normally reply within two to three business days, and we welcome contact from airlines.' },
  },
  'policy.html': {
    ja: { t: '運営ポリシー｜口コミの掲載基準',
          d: 'PILOT VALUE が口コミをどう扱うかの方針です。掲載する基準、非公開にする基準、個人や運航の特定につながる記述の扱い、訂正・削除の依頼方法について記載しています。' },
    en: { t: 'Operating Policy — How We Handle Reviews',
          d: 'How PILOT VALUE handles reviews: what we publish, what we withhold, how we treat anything that could identify a person or a flight, and how to request a correction.' },
  },
  'privacy.html': {
    ja: { t: 'プライバシーポリシー｜PILOT VALUE',
          d: 'PILOT VALUE が取得する情報、その利用目的、第三者提供の考え方、Cookie とローカルストレージの使い方、開示・訂正・削除の請求方法について定めています。' },
    en: { t: 'Privacy Policy | PILOT VALUE',
          d: 'What PILOT VALUE collects and why, our position on third parties, how we use cookies and local storage, and how to request access, correction or deletion of your data.' },
  },
  'privacy-pilot.html': {
    ja: { t: '匿名性の仕組み — なぜ身バレしないのか',
          d: '「見ません」という約束ではなく、技術的に見られない構造です。何を保存し何を保存しないか、口コミで年収の金額を訊かない理由、投稿と本人を結ぶ情報を持たない設計まで公開。' },
    en: { t: 'How Anonymity Works — Why You Cannot Be Identified',
          d: 'Not a promise that we will not look — a structure where we cannot. What the database stores, why a review never asks for pay, and why no post links back to its author.' },
  },
  'terms.html': {
    ja: { t: '利用規約｜PILOT VALUE',
          d: 'PILOT VALUE の利用条件を定めた規約です。サービスの範囲、禁止事項、投稿内容の取り扱いと権利、免責の範囲、規約の変更手続きについて記載しています。' },
    en: { t: 'Terms of Service | PILOT VALUE',
          d: 'The terms governing use of PILOT VALUE: what the service covers, what is not permitted, how posted content and its rights are handled, and the limits of our liability.' },
  },
  'sitemap.html': {
    ja: { t: 'サイトマップ｜PILOT VALUE 全ページ一覧',
          d: `PILOT VALUE の全ページ一覧です。日本${countryCount('JP')}社を含む世界${N}社の航空会社ページ、年収ガイド、求人情報、口コミ、各種ポリシーへここからたどれます。` },
    en: { t: 'Sitemap — Every Page on PILOT VALUE',
          d: `Every page on PILOT VALUE in one place: all ${N} airline pages including ${countryCount('JP')} Japanese carriers, the salary guides, job listings, reviews and our policies.` },
  },
  'submit-review.html': {
    ja: { t: '口コミを投稿する｜完全匿名',
          d: '所属航空会社・職位・勤務年数・年代と、7カテゴリの口コミを匿名で投稿できます。氏名もメールアドレスも投稿データには含まれません。1件の投稿で全社の口コミが読めます。' },
    en: { t: 'Submit Your Review — Fully Anonymous',
          d: 'Post your airline, position, years of service, age band and a review across seven categories — anonymously. Neither your name nor your email is stored with it. One review unlocks every airline\'s reviews.' },
  },
  /* noindex のページだが、ここを直しておかないと次に seo-normalize を流した人が
     旧タイトル（「市場価値レポート／あなたの年収は世界で何位か」）に巻き戻す。
     ページ側は「順位を主役にしない」方針に変わっている（順位を煽る文言に戻さない）。 */
  'my-value.html': {
    ja: { t: 'マイレポート｜記録した実データで見る、あなたの報酬',
          d: '記録した給与明細の実データから、今月の報酬・累計の積み上がり・前回との差を1枚にまとめます。明細の画像は端末内で処理され、サーバーには送られません。' },
    en: { t: 'My Pay Report — Built From What You Have Recorded',
          d: 'Your pay, month by month: this month, the total built up since you started, and the change since your last payslip. Payslip images are processed on your own device.' },
  },
  /* 同上。noindex だがここに無いと、次に seo-normalize を流した人が
     タイトルを空にする（noindex でも <title> は出るので中身は要る）。 */
  'actual-pay.html': {
    ja: { t: '他のパイロットの実給与を見る',
          d: '公開情報からの推定レンジと、パイロット本人が記録した実給与を別々に並べます。同じ会社・職位・機材に5人以上そろった区分だけを、丸めた金額で載せています。' },
    en: { t: 'What Other Pilots Actually Earn',
          d: 'Public estimated ranges and pay recorded by pilots themselves, side by side but never merged. A group appears only once five or more people share the same airline, position and fleet.' },
  },
  'airline-conditions.html': {
    ja: { t: '待遇・働き方を教える',
          d: '勤務スケジュール・キャリア・休暇・手当について、あなたの会社の仕組みを教えてください。答えられるところだけで構いません。氏名も社員番号も受け取りません。' },
    en: { t: 'Tell Us About Your Working Conditions',
          d: 'Rostering, career, leave and allowances: tell us how the system actually works at your airline. Answer only what you know. We never collect your name or staff number.' },
  },
  'pay-report.html': {
    ja: { t: '給与レポートを出す｜明細から自動入力',
          d: '給与明細に書いてあることだけ答えれば、年換算・時間あたり報酬・世界での位置をこちらで計算して返します。氏名も社員番号も受け取りません。' },
    en: { t: 'Report Your Pay — Autofill from a Payslip',
          d: 'Answer only what is printed on your payslip; we work out the annualised figure, your hourly rate and where you sit worldwide. We never take your name or staff number.' },
  },
  'personal-data.html': {
    ja: { t: 'パーソナルデータの扱い｜PILOT VALUE',
          d: 'PILOT VALUE が取得するデータの種別と目的を一覧にしています。メール配信の設定、給与明細の処理が端末内で完結する仕組み、保存しない情報について記載しています。' },
    en: { t: 'Handling of Personal Data | PILOT VALUE',
          d: 'Every category of data PILOT VALUE holds and why. Email preferences, how payslip processing stays on your own device, and the specific things we deliberately never store.' },
  },
  'profile.html': { ja: { t: 'マイページ｜PILOT VALUE', d: 'アカウント情報、投稿した口コミ、メール配信の設定、市場価値レポートの履歴を確認できます。' },
                    en: { t: 'My Page | PILOT VALUE', d: 'Your account details, the reviews you have posted, your email preferences and your saved market value reports.' } },
  'login.html': { ja: { t: 'ログイン｜PILOT VALUE', d: 'PILOT VALUE にログインします。投稿にはアカウントが必要ですが、メールアドレスが投稿データに含まれることはありません。' },
                  en: { t: 'Log In | PILOT VALUE', d: 'Log in to PILOT VALUE. An account is needed to post, but your email address is never attached to what you submit.' } },
  'signup.html': { ja: { t: '新規会員登録｜PILOT VALUE', d: '無料で会員登録できます。年収データの閲覧に登録は不要で、口コミの投稿と、口コミ・給与データの解放に必要です。' },
                   en: { t: 'Sign Up | PILOT VALUE', d: 'Create a free account. Browsing salary data needs no account — registration is for posting reviews and unlocking the full data set.' } },
  'unsubscribe.html': { ja: { t: 'メール配信の解除｜PILOT VALUE', d: 'PILOT VALUE からのお知らせメールの配信を停止します。手続き後もサイトの利用とアカウントはそのまま続けられます。' },
                        en: { t: 'Unsubscribe from Emails | PILOT VALUE', d: 'Stop receiving notification emails from PILOT VALUE. Your account and access to the site are unaffected.' } },
  'admin.html': { ja: { t: '管理者ページ｜PILOT VALUE', d: 'PILOT VALUE の運営管理画面です。閲覧には管理者権限が必要です。' },
                  en: { t: 'Admin | PILOT VALUE', d: 'Administration screen for PILOT VALUE. Requires administrator access.' } },
  'auth-callback.html': { ja: { t: 'ログイン処理中｜PILOT VALUE', d: '認証結果を確認しています。この画面は自動的に切り替わります。' },
                          en: { t: 'Signing In | PILOT VALUE', d: 'Confirming your sign-in. This page will redirect automatically.' } },
  '404.html': { ja: { t: 'ページが見つかりません｜PILOT VALUE', d: 'お探しのページは移動または削除された可能性があります。トップページか航空会社一覧からお探しください。' },
                en: { t: 'Page Not Found | PILOT VALUE', d: 'This page may have moved or been removed. Try the home page or the full list of airlines.' } },

  /* ── 比較・体験記ページ（SALARY に無いので候補ラダーが使えない）──────
     元のタイトルが幅を超えていて、機械的に切ると社名の列挙が途中で切れる。
     「…【2026年最新】ANA」のように1社だけ残るのがそれ。手で決める。
     説明文は既存が良く書けているので d は置かず、そのまま使わせる。   */
  'airlines/gaishi-vs-nikkei.html': { ja: { t: '外資系 vs 日系 パイロット年収比較【2026年最新】' } },
  'airlines/emirates-vs-qatar.html': { ja: { t: 'エミレーツ vs カタール航空 パイロット年収比較【2026】' },
                              en: { t: 'Emirates vs Qatar Airways Pilot Salary 2026' } },
  'airlines/starlux-tenshoku.html': { ja: { t: 'スターラックス パイロット採用試験ガイド【2025実体験】' } },
};

function countryCount(code) {
  return Object.keys(S).filter((k) => AIRLINE_COUNTRY[k] === code).length;
}

/* ── タイトル短縮 ─────────────────────────────────────────────
   航空会社ページのタイトルは編集済みで、キーワードは先頭に来ている。
   総取っ替えすると練られた訴求（「非課税3,350万〜5,050万の実態」等）を
   捨てることになるので、意味の切れ目で後ろを落とすだけにする。       */
const BOUNDARIES = ['——', '—', '【', '｜', ' | ', '／', ' - ', '・', '。', '？', '?', '、', ','];

function shortenTitle(full, hardCut = true) {
  let core = full.replace(/\s*[|｜—–-]\s*PILOT VALUE\s*$/i, '').trim();
  /* 「（Root Aviation）（Root Aviation）」のような重複を落とす */
  core = core.replace(/([（(][^）)]{2,}[）)])\s*\1+/g, '$1');
  if (width(core) <= CORE_MAX) return core + BRAND;

  /* 区切りごとに前から詰めて、収まる最長の切り口を採る */
  let best = null;
  for (const b of BOUNDARIES) {
    let idx = 0;
    while ((idx = core.indexOf(b, idx + 1)) !== -1) {
      /* ★ 「,」は英文の区切りであると同時に桁区切りでもある。数字と数字の
         あいだで切ると「機長平均3,360万円」が「機長平均3」になる。実際に
         日本語の航空会社ページ30枚が、この一箇所で金額の途中から落ちていた。
         前後が数字なら区切りとして扱わない。 */
      if (/\d$/.test(core.slice(0, idx)) && /^\d/.test(core.slice(idx + b.length))) continue;
      /* 切り口の直前に記号が残ると「…5,050万"—」のように尻切れに見える。
         「——」を1文字目で切ったときの2本目のダッシュがまさにそれ。 */
      const head = core.slice(0, idx).trim().replace(/[\s・、,．.—–—\-｜|:：;；]+$/, '');
      if (width(head) <= CORE_MAX && width(head) >= 22 && (!best || width(head) > width(best))) best = head;
    }
  }
  if (best) return best + BRAND;
  if (!hardCut) return null;

  /* 区切りが無ければ幅で切る。語の途中で切らないよう半角語は空白で戻す。 */
  let cut = '';
  for (const ch of core) { if (width(cut + ch) > CORE_MAX) break; cut += ch; }
  if (/[A-Za-z0-9]$/.test(cut) && cut.includes(' ')) cut = cut.slice(0, cut.lastIndexOf(' '));
  /* 幅で切った位置が数字の途中なら、その数字ごと落とす（「機長3,3」を残さない）*/
  if (/[\d,]$/.test(cut) && /^[\d,万円]/.test(core.slice(cut.length))) cut = cut.replace(/[\d,]+$/, '');
  return cut.trim().replace(/[・、,．.—–-]$/, '') + BRAND;
}

/* ── 航空会社ページのタイトル ─────────────────────────────────
   編集済みの訴求（「非課税3,350万〜5,050万の実態」等）が幅に収まるなら
   そのまま活かす。収まらないときに幅で切ると「…パイロット情」のように
   語の途中で落ちるので、切らずに SSOT から組み直す。
   社名と機長年収は必ず残るので、検索意図（社名＋年収）は外さない。   */
/* 「その社名で年収を調べている人」に当たる語。これが無いタイトルは、
   幅に収まっていても検索意図を外している。「エーゲ航空（Aegean Airlines）
   パイロット情報」が 53枚あり、どれも "年収" を一度も含んでいなかった。
   手取り・給与も拾うのは、ANA の「機長の手取りは月147万円」のような
   練られた訴求まで定型文に潰さないため。                          */
const INTENT = { ja: /年収|給与|給料|手取り/, en: /salar|\bpay\b|compensation/i };

/* 金額が入っているか。日本語は「1,300万」、英語は「$231K」。
   タイトルに具体的な金額があると Google が勝手に書き換えにくくなる。
   実際、英語版は「Emirates Pilot Salary 2026」と素っ気なかったため
   Google が「¥45M Tax-Free」を足して表示していた。 */
const HAS_PAY = /[\d,]+\s*万|[$€£]\s?[\d,.]+\s?[KM]\b/;

function airlineTitle(slug, lang, curTitle) {
  /* 温存するのは「幅に収まっていて、かつ金額まで入っている」ときだけ。
     区切りで後ろを落とすと金額が消えることがあり、そうなると社名＋年収の
     検索意図には当たっていても、クリックの決め手になる数字を失う。
     落ちたぶんは下の候補ラダーが SSOT から組み直す。 */
  const kept = INTENT[lang].test(curTitle) ? shortenTitle(curTitle, false) : null;
  if (kept && HAS_PAY.test(kept)) return kept;

  const a = S[slug];
  const full = (lang === 'ja' ? a.ja : a.en).trim();
  const short = full.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim() || full;
  const pay = lang === 'ja' ? capJa(slug) : capEn(slug);
  /* 社名が長いと上の段が全部あふれて、金額の無い最下段まで落ちる。
     「ブリティッシュ・エアウェイズ」「Swiss International Air Lines」が
     まさにそれだった。数字を捨てる前に、金額を残したまま詰める段を挟む。 */
  const payS = lang === 'ja' ? pay.replace(/万円$/, '万') : pay;

  const cands = lang === 'ja'
    ? [`${full} パイロット年収 機長${pay}【2026】`,
       `${full} パイロット年収 機長${pay}`,
       `${short} パイロット年収 機長${pay}`,
       `${short}パイロット年収 機長${payS}`,
       `${short} パイロット年収【2026年最新】`,
       `${short} パイロット年収`]
    : [`${full} Pilot Salary 2026 — Captain ${pay}`,
       `${short} Pilot Salary 2026 — Captain ${pay}`,
       `${short} Pilot Salary — Captain ${pay}`,
       `${short} Captain Salary — ${payS}`,
       `${short} Pilot Salary 2026`,
       `${short} Pilot Salary`];

  return (cands.find((c) => width(c) <= CORE_MAX) || cands[cands.length - 1]) + BRAND;
}

/* ── 航空会社ページの説明文 ───────────────────────────────────
   既存が 100〜170 幅に収まっていればそのまま使う。短すぎる／長すぎる
   ものだけ SSOT から組み直す。数値は全部 SALARY 由来なので、年収を
   更新して流し直せば description も自動で追随する。                */
const DESC_MIN = 100;
const DESC_MAX = 170;

/* ── 説明文の底上げ ───────────────────────────────────────────
   既存の説明文は「機長の平均年収」しか言っていないものが多い。
   英語版は110枚が全部 `{社名} pilot salary 2026: captain avg $231K.` の型で、
   副操縦士の額がどこにも無い。読み手が続けて知りたいのは
   「副操縦士は？」「で、月いくら？」なので、そこまで書く。

   規律
     ・**入っていないものだけ足す。**既に触れている説明文には何もしない。
     ・幅 DESC_MAX に収まるときだけ足す。押し込んで尻を切らない。
     ・手取りに触れるのは taxFree の社だけ。課税国の手取りは書かない
       （税率を推測することになる＝「確認できない数値を推測で埋めない」）。
     ・月額は年収÷12。gen-faq.mjs の月収の問と同じ計算。
       「月あたり」「a month」は check-salary.mjs の DERIVED に載っている語なので、
       年額として SSOT と突合されない（月額を年額と誤検出しない）。         */
function enrichDesc(d, slug, lang) {
  const a = S[slug]; const c = a.cap; const f = a.fo;
  const ja = lang === 'ja';
  const add = [];
  if (!(ja ? /副操縦士/ : /first officer/i).test(d)) {
    add.push(ja ? `副操縦士は平均${man(f.avg)}。` : ` First officers average ${usd(f.avg)}.`);
  }
  if (!(ja ? /月/ : /\ba month\b|monthly|per month/i).test(d)) {
    /* 「月あたり」「a month」と書く。「月収」と言い切らないのは、賞与のある会社では
       毎月の支給額がこれより低く出るため（年収÷12 の単純計算だと明示できる幅が無い）。 */
    add.push(ja ? `機長は月あたり約${man(Math.round(c.avg / 12))}。`
      : ` Captains average about ${usd(Math.round(c.avg / 12))} a month.`);
  }
  if (a.taxFree && !(ja ? /非課税|税金がかからない/ : /tax[- ]free/i).test(d)) {
    add.push(ja ? '所得税が非課税のため額面に近い額が手取りになります。'
      : ' Pay is tax-free, so take-home is higher still.');
  }
  /* 既存の説明文は句点で終わっていないものがある（"… Star Alliance member"）。
     そのまま足すと文が繋がってしまうので、足すときだけ終止符を補う。 */
  const term = ja ? '。' : '.';
  let out = d;
  for (const s of add) {
    const base = out.trimEnd();
    const t = (/[。．.!?！？…]$/.test(base) ? base : base + term) + s;
    if (width(t) <= DESC_MAX) out = t;
  }
  return out;
}

function airlineDesc(slug, lang, curDesc) {
  if (curDesc) {
    const w = width(curDesc);
    if (w >= DESC_MIN && w <= DESC_MAX) return enrichDesc(curDesc, slug, lang);
    /* 長すぎるだけなら、まず文の切れ目で落として既存の文面を活かす。
       いきなり定型文に差し替えると「ANA比で手取りが約2倍」のような
       ページ固有の訴求を捨てることになる。 */
    if (w > DESC_MAX) {
      const s = shortenDesc(curDesc, DESC_MAX);
      if (!s.endsWith('…') && width(s) >= DESC_MIN) return enrichDesc(s, slug, lang);
    }
  }

  const a = S[slug];
  const nm = (lang === 'ja' ? a.ja : a.en).trim();
  const c = a.cap; const f = a.fo;
  const M = lang === 'ja' ? man : usd;
  const tail = lang === 'ja'
    ? (a.taxFree ? '所得税が非課税のため手取りはさらに大きくなります。' : '')
    : (a.taxFree ? ' Pay is tax-free, so take-home is higher still.' : '');

  const cands = lang === 'ja' ? [
    `${nm}のパイロット年収は、機長が平均${M(c.avg)}（${M(c.lo)}〜${M(c.hi)}）、副操縦士が平均${M(f.avg)}（${M(f.lo)}〜${M(f.hi)}）。${tail}保有機材・応募条件・現役パイロットの口コミまで掲載しています。`,
    `${nm}のパイロット年収は、機長が平均${M(c.avg)}（${M(c.lo)}〜${M(c.hi)}）、副操縦士が平均${M(f.avg)}。${tail}保有機材・応募条件・現役パイロットの口コミまで掲載しています。`,
    `${nm}のパイロット年収は、機長が平均${M(c.avg)}（${M(c.lo)}〜${M(c.hi)}）、副操縦士が平均${M(f.avg)}。保有機材・応募条件・現役パイロットの口コミを掲載。`,
    `${nm}のパイロット年収は機長平均${M(c.avg)}、副操縦士平均${M(f.avg)}。給与レンジ・保有機材・応募条件・現役パイロットの口コミを掲載しています。`,
  ] : [
    `${nm} pilot salary 2026: captains average ${M(c.avg)} (${M(c.lo)}–${M(c.hi)}) and first officers ${M(f.avg)} (${M(f.lo)}–${M(f.hi)}).${tail} Fleet, hiring requirements and reviews from working pilots.`,
    `${nm} pilot salary 2026: captains average ${M(c.avg)} (${M(c.lo)}–${M(c.hi)}) and first officers ${M(f.avg)}.${tail} Fleet, hiring requirements and reviews from working pilots.`,
    `${nm} pilot salary 2026: captains average ${M(c.avg)} (${M(c.lo)}–${M(c.hi)}), first officers ${M(f.avg)}. Fleet, requirements and pilot reviews.`,
  ];

  const fit = cands.filter((x) => width(x) <= DESC_MAX);
  return enrichDesc(fit.length ? fit[0] : cands[cands.length - 1], slug, lang);
}

/* ── 説明文の短縮（既存を活かしつつ幅に収める）───────────────── */
function shortenDesc(d, max = 170) {
  if (width(d) <= max) return d;
  /* ★ 文の区切りで割るとき、split の \s* が文と文の間の空白を食う。
     繋ぎ直すと英語が "…across 26 airlines.Captains average…" になる
     （EN の国別 49枚で実際に出ていた）。区切り文字ごと各文に残す。 */
  const parts = d.match(/[\s\S]*?[。．.!?！？]+\s*|[\s\S]+$/g) || [d];
  let out = '';
  for (const p of parts) { if (width(out + p) > max) break; out += p; }
  if (width(out) >= 100) return out.trim();
  let cut = '';
  for (const ch of d) { if (width(cut + ch) > max - 1) break; cut += ch; }
  return cut.trim().replace(/[、,]$/, '') + '…';
}

/* ════════════════════════════════════════════════════════════════
   ページ収集
   ════════════════════════════════════════════════════════════════ */
const listHtml = (dir) => (fs.existsSync(path.join(ROOT, dir))
  ? fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.html')).sort() : []);

const files = [
  ...listHtml('.'),
  ...listHtml('airlines').map((f) => `airlines/${f}`),
  ...listHtml('countries').map((f) => `countries/${f}`),
  ...listHtml('en').map((f) => `en/${f}`),
  ...listHtml('en/airlines').map((f) => `en/airlines/${f}`),
  ...listHtml('en/countries').map((f) => `en/countries/${f}`),
];

const relToUrl = (rel) => (rel === 'index.html' ? `${ORIGIN}/`
  : rel === 'en/index.html' ? `${ORIGIN}/en/` : `${ORIGIN}/${rel}`);

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i')) || tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i'));
  return m ? m[1] : null;
};
const esc = (s) => String(s).replace(/&(?!(?:amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/* ════════════════════════════════════════════════════════════════
   本文 <h2> の言い換え

   なぜ要るか
     中身はあるのに、見出しが「書いた人の言葉」になっていて
     「読む人の言葉」になっていない箇所が4つある。全406ページを数えた実測：

       福利厚生   見出し 0 / 本文 118      ← 節は113社にあるのに見出しは「ベネフィット」
       allowance  見出し 0 / 本文 100      ← 中身は住宅手当・教育手当そのもの
       pay scale  見出し 0 / 本文 277      ← 中身は段階別の給与表そのもの

     つまり足りないのは中身ではなく呼び名。中身と違う名前を付けていた、が正しい。

   規律
     ・**先頭の語だけ**差し替え、後ろ（「— 業界屈指の総合パッケージ」
       「(as of March 2026)」）はそのまま残す。
     ・置換後の文字列はどのパターンにも一致しない＝何度流しても同じ結果（冪等）。
     ・<h2> の中だけ。口コミ本文に出る「パスベネフィット」のような語は触らない
       （community.html に実在する。引用を書き換えてはいけない）。
     ・同義語の並べ書きはしない。検索語に寄せるのではなく、
       中身を正しく言い当てる名前に直すだけ。
   ════════════════════════════════════════════════════════════════ */
const H2_RENAME = [
  /* カタカナ語を日本語に。中身は所得税ゼロ・住宅手当・教育手当。 */
  [/^ベネフィット/, '福利厚生'],
  /* 中身が住宅手当・教育手当・搭乗手当なので Allowances のほうが正確。 */
  [/^Benefits\s*(?:&amp;|&)\s*Perks/, 'Pilot Benefits &amp; Allowances'],
  /* 中身は必要飛行時間・英語力＝requirements。「Info」は中身を言っていない。 */
  [/^Recruitment Info/, 'Pilot Hiring &amp; Requirements'],
  /* 中身は段階別の給与表なので Pay Scale。 */
  [/^Pay by Seniority/, 'Pay Scale by Seniority'],
];

function renameH2(body) {
  return body.replace(/(<h2\b[^>]*>)(\s*)([^<]*)/g, (m, open, sp, text) => {
    for (const [re, to] of H2_RENAME) {
      if (re.test(text)) return open + sp + text.replace(re, to);
    }
    return m;
  });
}

/* ── OGP 画像の割り当て ─────────────────────────────────────── */
function ogImage(rel, lang) {
  const base = path.basename(rel, '.html');
  if (/^(en\/)?airlines\//.test(rel) && S[base]) return `/assets/og/a-${base}-${lang}.jpg`;
  if (/^(en\/)?countries\//.test(rel)) {
    const c = Object.values(BY_CODE).find((x) => x.slug === base);
    if (c) return `/assets/og/c-${c.code.toLowerCase()}-${lang}.jpg`;
  }
  return `/assets/og/default-${lang}.jpg`;
}

/* ════════════════════════════════════════════════════════════════
   本体
   ════════════════════════════════════════════════════════════════ */
let changed = 0; const notes = [];

for (const rel of files) {
  const abs = path.join(ROOT, rel);
  let html = fs.readFileSync(abs, 'utf8');
  const orig = html;

  const lang = rel.startsWith('en/') ? 'en' : 'ja';
  const bare = rel.replace(/^en\//, '');
  const jaUrl = relToUrl(bare);
  const enUrl = relToUrl(bare === 'index.html' ? 'en/index.html' : `en/${bare}`);
  const selfUrl = lang === 'ja' ? jaUrl : enUrl;
  const noindex = NOINDEX.has(path.basename(rel)) && !rel.includes('/airlines/') && !rel.includes('/countries/');

  const headEnd = html.search(/<\/head>/i);
  if (headEnd === -1) { notes.push(`${rel}: </head> が無い — 飛ばした`); continue; }
  let head = html.slice(0, headEnd);
  const rest = html.slice(headEnd);

  /* 1) 既存の値を回収 */
  const curTitle = unesc((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1].trim());
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const getMeta = (n) => { for (const t of metas) if ((attr(t, 'name') || '').toLowerCase() === n) return unesc(attr(t, 'content') || ''); return ''; };
  const getOg = (p) => { for (const t of metas) if ((attr(t, 'property') || '').toLowerCase() === p) return unesc(attr(t, 'content') || ''); return ''; };
  const curKw = getMeta('keywords');

  /* ★ 短縮後のタイトルをそのまま <title> に書くと、次の実行ではそれが
     「元のタイトル」になる（＝一度切り詰めると二度と戻せない自己参照）。
     元の文字列を管理ブロックに残しておき、毎回そこから組み直す。 */
  const src = (head.match(/<!--PV-SRC\s+t="([\s\S]*?)"\s+d="([\s\S]*?)"-->/) || []);
  const srcTitle = src[1] !== undefined ? unesc(src[1]) : curTitle;
  const curDesc = src[2] !== undefined ? unesc(src[2]) : getMeta('description');

  /* 2) タイトル・説明文を決める */
  const copy = COPY[bare];
  let title, desc;
  if (copy && copy[lang]) {
    title = copy[lang].t.includes('PILOT VALUE') ? copy[lang].t : copy[lang].t + BRAND;
    /* d を省いた「タイトルだけの上書き」も許す。既存の説明文が良く書けている
       ページで、タイトルだけ幅の都合で崩れているときに使う。 */
    desc = copy[lang].d || (curDesc ? shortenDesc(curDesc) : '');
  } else {
    const slug = path.basename(rel, '.html');
    const isAirline = /airlines\//.test(rel) && S[slug];
    title = isAirline ? airlineTitle(slug, lang, srcTitle) : shortenTitle(srcTitle);
    desc = isAirline ? airlineDesc(slug, lang, curDesc)
      : curDesc ? shortenDesc(curDesc) : '';
    if (!desc) notes.push(`${rel}: description が無く生成元も無い`);
  }

  /* 3) 「117社」等の実態と違う社数表記を SSOT の件数に直す（数字を盛らない） */
  const fixCount = (s) => s.replace(/11[0-9]\s*社/g, `${N}社`).replace(/\b11[0-9]\s+([Aa]irlines)/g, `${N} $1`);
  title = fixCount(title); desc = fixCount(desc);

  /* 4) og / twitter はタイトル・説明文から一意に決める。
     ★ 既存の og:title を残す作りにすると、それを管理ブロックに書き戻し →
       次の実行でそれを「既存値」として読む、という自己参照になり、
       タイトルを直しても og だけ古いままになる。純関数にして断ち切る。 */
  const ogTitle = title;
  const ogDesc = desc;
  const ogType = /(airlines|countries)\//.test(rel) ? 'article' : 'website';
  const img = ORIGIN + ogImage(rel, lang);

  /* 5) 管理対象タグを head から全部剥がす（重複・古い値をここで一掃）*/
  head = head
    /* ★ 末尾を \s* で食わせない。改行の次の行の字下げまで飲み込んでしまい、
       1回目と2回目で出力がズレる（＝冪等でなくなる）。行末までに限定する。 */
    .replace(/<!--PV-SEO-->[\s\S]*?<!--\/PV-SEO-->[ \t]*\n?/gi, '')
    .replace(/[ \t]*<link\b[^>]*\brel\s*=\s*["'](?:canonical|alternate)["'][^>]*>[ \t]*\n?/gi, (m) => (/hreflang|canonical/i.test(m) ? '' : m))
    .replace(/[ \t]*<meta\b[^>]*\bname\s*=\s*["'](?:robots|description|keywords|twitter:[a-z:]+)["'][^>]*>[ \t]*\n?/gi, '')
    .replace(/[ \t]*<meta\b[^>]*\bproperty\s*=\s*["']og:[a-z:_]+["'][^>]*>[ \t]*\n?/gi, '');

  /* 6) 構造化データ。★ 既にページが持っている型は足さない。
     日本語の航空会社ページは Article / FAQPage / BreadcrumbList を自前で
     持っているので、同じ型を重ねると矛盾した2つの定義を Google に渡す。
     判定は管理ブロックを剥がした後の中身に対して行うので、再実行しても
     「自分が書いたものを既存とみなす」ことは起きない。                */
  const existing = head + rest;
  const hasType = (t) => new RegExp(`"@type"\\s*:\\s*(?:"${t}"|\\[[^\\]]*"${t}")`).test(existing);
  const graph = [];

  if (!noindex && !hasType('BreadcrumbList')) {
    const home = lang === 'ja' ? { n: 'ホーム', u: `${ORIGIN}/` } : { n: 'Home', u: `${ORIGIN}/en/` };
    const crumbs = [home];
    const slug = path.basename(rel, '.html');
    if (/airlines\//.test(rel) && S[slug]) {
      crumbs.push(lang === 'ja'
        ? { n: '航空会社一覧', u: `${ORIGIN}/world-airlines.html` }
        : { n: 'Airlines', u: `${ORIGIN}/en/world-airlines.html` });
      crumbs.push({ n: lang === 'ja' ? S[slug].ja : S[slug].en, u: selfUrl });
    } else if (/countries\//.test(rel)) {
      const c = Object.values(BY_CODE).find((x) => x.slug === slug);
      crumbs.push(lang === 'ja'
        ? { n: '国別のパイロット年収', u: `${ORIGIN}/countries.html` }
        : { n: 'Pilot Salary by Country', u: `${ORIGIN}/en/countries.html` });
      if (c) crumbs.push({ n: lang === 'ja' ? c.ja : c.en, u: selfUrl });
    } else if (rel !== 'index.html' && rel !== 'en/index.html') {
      crumbs.push({ n: title.replace(/\s*[|｜]\s*PILOT VALUE\s*$/i, ''), u: selfUrl });
    }
    if (crumbs.length > 1) {
      graph.push({
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.n, item: c.u })),
      });
    }
  }

  if ((rel === 'index.html' || rel === 'en/index.html')) {
    if (!hasType('WebSite')) {
      graph.push({
        '@type': 'WebSite', '@id': `${ORIGIN}/#website`, url: selfUrl,
        name: 'PILOT VALUE', description: desc, inLanguage: lang === 'ja' ? 'ja-JP' : 'en',
      });
    }
    if (!hasType('Organization')) {
      graph.push({
        '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: 'PILOT VALUE', url: `${ORIGIN}/`,
        logo: ORIGIN + encodeURI('/baland_ass/ロゴイメージ.png'),
        description: lang === 'ja'
          ? `世界${N}社の航空会社のパイロット年収と待遇を、現役パイロットの一次データで公開するデータベース。`
          : `A database of pilot pay and conditions at ${N} airlines worldwide, built on first-hand data from working pilots.`,
      });
    }
  }

  if (!noindex && /(airlines|countries)\//.test(rel) && !hasType('Article')) {
    graph.push({
      '@type': 'Article', headline: title.replace(/\s*[|｜]\s*PILOT VALUE\s*$/i, ''),
      description: desc, inLanguage: lang === 'ja' ? 'ja-JP' : 'en',
      image: img, mainEntityOfPage: selfUrl,
      author: { '@type': 'Organization', name: 'PILOT VALUE', url: `${ORIGIN}/` },
      publisher: { '@id': `${ORIGIN}/#org` },
    });
  }

  /* ── Occupation（年収サイトの本命の型）────────────────────────
     Article は「記事がある」としか言わない。年収そのものを機械可読に
     するのは Occupation.estimatedSalary で、これが職種・地域・金額を
     結び付ける唯一の型。年収DBを名乗る以上、ここを空けておく理由が無い。

     ★ MonetaryAmountDistribution（median / percentile10 / percentile90）
       を使わないのは、SSOT が持っているのが平均と上下限だからで、
       平均を median と書けば検証できない主張になる。分布を持っていない
       ものを分布の型で書かない。MonetaryAmount の value / minValue /
       maxValue なら、ページに出ている数字とそのまま同じことを言える。 */
  if (!noindex && !hasType('Occupation')) {
    const slug = path.basename(rel, '.html');
    const money = (name, r) => ({
      '@type': 'MonetaryAmount', name, currency: 'JPY',
      value: {
        '@type': 'QuantitativeValue', unitText: 'YEAR',
        value: r.avg * 10000, minValue: r.lo * 10000, maxValue: r.hi * 10000,
      },
    });
    const roleCap = lang === 'ja' ? '機長の年収' : 'Captain, annual';
    const roleFo = lang === 'ja' ? '副操縦士の年収' : 'First officer, annual';
    /* O*NET-SOC 53-2011.00 = Airline Pilots, Copilots, and Flight Engineers。
       実在する標準コードなので、職種の同定はこれに任せる。 */
    const SOC = '53-2011.00';

    if (/airlines\//.test(rel) && S[slug]) {
      const a = S[slug];
      const cc = BY_CODE[AIRLINE_COUNTRY[slug]];
      graph.push({
        '@type': 'Occupation', mainEntityOfPage: selfUrl, occupationalCategory: SOC,
        name: lang === 'ja' ? `${a.ja}のパイロット` : `Pilot at ${a.en}`,
        ...(cc ? { occupationLocation: { '@type': 'Country', name: lang === 'ja' ? cc.ja : cc.en } } : {}),
        estimatedSalary: [money(roleCap, a.cap), money(roleFo, a.fo)],
      });
    } else if (/countries\//.test(rel)) {
      const cc = Object.values(BY_CODE).find((x) => x.slug === slug);
      const mem = cc ? Object.keys(S).filter((k) => AIRLINE_COUNTRY[k] === cc.code) : [];
      if (cc && mem.length) {
        /* 国の値は gen-countries.mjs と同じ導出（平均は各社平均の単純平均、
           上下限は所属各社の最小・最大）。ページの表示と一字一句そろえる。 */
        const agg = (key) => ({
          avg: Math.round(mem.reduce((s, k) => s + S[k][key].avg, 0) / mem.length / 10) * 10,
          lo: Math.min(...mem.map((k) => S[k][key].lo)),
          hi: Math.max(...mem.map((k) => S[k][key].hi)),
        });
        graph.push({
          '@type': 'Occupation', mainEntityOfPage: selfUrl, occupationalCategory: SOC,
          /* name は文。冠詞つきの形（the USA）。
             occupationLocation.name は国そのものの識別子なので正式名のまま。 */
          name: lang === 'ja' ? `${cc.ja}の航空会社パイロット` : `Airline pilot in ${nameIn(cc)}`,
          occupationLocation: { '@type': 'Country', name: lang === 'ja' ? cc.ja : cc.en },
          estimatedSalary: [money(roleCap, agg('cap')), money(roleFo, agg('fo'))],
        });
      }
    }
  }

  const ld = graph.length
    ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>\n`
    : '';

  /* 7) タイトルを差し替え、その直後に管理ブロックを置く */
  const block = `
<!--PV-SEO-->
<!--PV-SRC t="${esc(srcTitle)}" d="${esc(curDesc)}"-->
<meta name="description" content="${esc(desc)}"/>
${curKw ? `<meta name="keywords" content="${esc(fixCount(curKw))}"/>\n` : ''}<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'}"/>
<link rel="canonical" href="${selfUrl}"/>
<link rel="alternate" hreflang="ja" href="${jaUrl}"/>
<link rel="alternate" hreflang="en" href="${enUrl}"/>
<link rel="alternate" hreflang="x-default" href="${enUrl}"/>
<meta property="og:title" content="${esc(ogTitle)}"/>
<meta property="og:description" content="${esc(ogDesc)}"/>
<meta property="og:url" content="${selfUrl}"/>
<meta property="og:type" content="${ogType}"/>
<meta property="og:site_name" content="PILOT VALUE"/>
<meta property="og:locale" content="${lang === 'ja' ? 'ja_JP' : 'en_US'}"/>
<meta property="og:locale:alternate" content="${lang === 'ja' ? 'en_US' : 'ja_JP'}"/>
<meta property="og:image" content="${img}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="${esc(ogTitle)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(ogTitle)}"/>
<meta name="twitter:description" content="${esc(ogDesc)}"/>
<meta name="twitter:image" content="${img}"/>
${ld}<!--/PV-SEO-->
`;

  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(head)) {
    head = head.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>${block}`);
  } else {
    head = head.replace(/(<meta\b[^>]*charset[^>]*>)/i, `$1\n<title>${esc(title)}</title>${block}`);
  }

  /* 7) 本文・構造化データ側に残った実態と違う社数表記も直す。
     head だけ直しても JSON-LD の description に「117 airlines」が残り、
     Google には矛盾した2つの数字が届く。 */
  html = fixCount(head.replace(/\n{3,}/g, '\n\n')) + renameH2(fixCount(rest));
  if (html !== orig) { changed++; if (!DRY) fs.writeFileSync(abs, html); }
}

console.log(`\n${DRY ? '[dry-run] ' : ''}${changed} / ${files.length} ページの head を更新`);
if (notes.length) { console.log('\n注意:'); for (const n of notes) console.log('  ' + n); }
console.log('\n次: node assert-seo.mjs で検証する');
