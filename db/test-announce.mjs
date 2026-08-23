/* ════════════════════════════════════════════════════════════════
   test-announce.mjs — お知らせメール（mail-bot/announce-mail.mjs）の検査

   ネットも鍵も使わない。文面を組み立てて中身を見るだけ。
     node db/test-announce.mjs

   見ているのは3つ。

   ① 入れてはいけないものが入っていないか
      金額・会社名・明細の項目名。給与レポートは user_id を持たない設計
      （db/pay-reports.sql）で「誰がいくら」を運営側に残さないようにしてある。
      その数字をメールに載せると、Resend のログと受信箱に
      「このアドレスの人の報酬額」として残る。設計で守ったものを送信で外に出す。

   ② 書いた事実がサイトの実装と合っているか
      「90日」「時間あたり報酬」などはサイトから取った主張。サイト側を変えたのに
      メールが古いままだと、開いた人が「メールにあった項目が無い」と探すことになる。
      → 実ファイル（pay-report.html / db/pay-reports.sql）と突き合わせる。

   ③ 解除の導線が全通りに付いているか
      1通でも解除リンクが欠けると特定電子メール法に触れる。
      日本語・英語・日英ともに、の3通り全部を見る。

   ④ FOUNDING PILOT 100 のお知らせ（buildFounding）
      こちらは email_opt_in で絞らず登録者全員に送る。①〜③に加えて、
      勧誘が1文も無いこと・受け取った人の番号が本文に無いことを見る。
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, statSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { join } from 'path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.log(`  ❌ ${m}${x ? '\n     ' + x : ''}`)); };

const { build, buildFounding, langModeOf, SAMPLE, IMG_VER } = await import(join(ROOT, 'mail-bot/announce-mail.mjs'));

/* 架空の人。実在の氏名は使わない（このリポジトリは PUBLIC）。 */
const P = {
  ja:   { name: '高橋 蓮',      country: '日本', unsub_token: 'tok-ja',   pay_report_count: 0 },
  jaF:  { name: '高橋 蓮',      country: '日本', unsub_token: 'tok-jaf',  pay_report_count: 4 },
  en:   { name: 'Alex Mercer',  country: 'UAE',  unsub_token: 'tok-en',   pay_report_count: 0 },
  enF:  { name: 'Alex Mercer',  country: 'UAE',  unsub_token: 'tok-enf',  pay_report_count: 2 },
  both: { name: 'Ren Aoki', country: null,  unsub_token: 'tok-both', pay_report_count: 0 },
};
const O = { supabaseUrl: 'https://example.supabase.co' };
const ALL = Object.entries(P).map(([k, p]) => [k, build(p, O)]);

/* ════════ ① 入れてはいけないもの ════════════════════════════ */
console.log('\n── ① 本文に入ってはいけないもの ──');

/* 金額。「90日間」「4つ」のような素の数字は通す。
   通貨の記号・単位が数字と一緒に出ている所だけを拾う。 */
const MONEY = [
  [/[¥$€£]\s?\d/, '通貨記号＋数字'],
  [/\d[\d,]*\s*(万|円)/, '数字＋万／円'],
  [/(USD|JPY|AED|EUR|GBP|SGD|HKD)\s?[\d]/, '通貨コード＋数字'],
  [/\d[\d,]*\s?(USD|JPY|AED|EUR|GBP)/, '数字＋通貨コード'],
];

/* ★2026-08-15 に見直した。以前は「本文に金額が1つも無いこと」を見ていたが、
   項目名の一覧だけでは何が返ってくるか伝わらず、開いた人がログインしなかった。
   いまは実物と同じ並びの見本カードを1枚入れている。
   守るものは変わっていない ——「会員本人の数字を載せない」。
   そこで、見本（SAMPLE）の文字列を取り除いた残りに金額が無いことを見る。
   見本の外に金額が1つでも出たらここで落ちる。 */
const SAMPLE_STRINGS = Object.values(SAMPLE)
  .flatMap((s) => [s.big, s.sub, ...s.rows.flat(), s.note,
    s.cum.head, s.cum.alt, s.cum.cap, s.cum.img,
    s.bd.head, s.bd.alt, s.bd.cap, s.bd.img])
  .filter((x) => typeof x === 'string')
  .sort((a, b) => b.length - a.length);          // 長い方から消す（部分一致で取り残さない）
const stripSample = (s) => SAMPLE_STRINGS.reduce((acc, w) => acc.split(w).join(' '), s);

for (const [k, b] of ALL) {
  const body = stripSample(b.html + '\n' + b.subject + '\n' + b.text);
  const hit = MONEY.find(([re]) => re.test(body));
  ok(!hit, `${k}: 見本のほかに金額が1つも入っていない`, hit ? `${hit[1]} → ${body.match(hit[0])[0]}` : '');
}

/* 見本の数字は、必ず「見本」の印と断り書きと一緒に出る。
   印だけ・数字だけが残ると、架空の例が実在の額として読まれる。 */
for (const [k, b] of ALL) {
  const langs = b.lang === 'both' ? ['ja', 'en'] : [b.lang];
  const miss = langs.find((l) =>
    !(b.html.includes(SAMPLE[l].tag) && b.html.includes(SAMPLE[l].note)
      && b.text.includes(SAMPLE[l].tag) && b.text.includes(SAMPLE[l].note)));
  ok(!miss, `${k}: 見本の数字に「${SAMPLE[langs[0]].tag}」の印と断り書きが付いている`, miss || '');
}

/* 会社名。salary-data.mjs の全社を見る（slug と表示名の両方が SSOT にある）。
   2文字以下は英文に埋もれるので見ない（'AA' が 'AAA' に当たるような誤検知を避ける）。 */
const { SALARY } = await import(join(ROOT, 'salary-data.mjs'));
const NAMES = [];
for (const [slug, d] of Object.entries(SALARY)) {
  for (const s of [slug, d?.name, d?.nameJa, d?.label].filter(Boolean)) {
    const t = String(s).trim();
    if (t.length >= 3) NAMES.push(t);
  }
}
/* ★英字の社名は語の切れ目で見る。素の部分一致だと LOT が pilot-value.com の
   'lot' に当たる（実際に当たった）。日本語の社名は語の切れ目が無いので部分一致のまま。 */
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hitsName = (body, n) => (/^[\x20-\x7e]+$/.test(n)
  ? new RegExp('\\b' + reEsc(n) + '\\b', 'i').test(body)
  : body.includes(n));
for (const [k, b] of ALL) {
  const body = b.html + b.subject + b.text;
  const hit = NAMES.find((n) => hitsName(body, n));
  ok(!hit, `${k}: 航空会社名が1つも入っていない（${NAMES.length} 社ぶんを照合）`, hit || '');
}

/* 控除の内訳は、見本であっても書かない。
   税・年金・組合費といった項目名は「その人が何に属し、何を信じているか」を映す。
   サイトでも画面に出さず保存もしていない（my-value.js の taxNote）。
   ★ここは見本の除外を通さない。SAMPLE に紛れ込んでも落ちる。 */
const DEDUCT = ['組合費', '社会保険', '所得税', '住民税', '厚生年金', '共済',
  'union', 'union dues', 'income tax', 'pension', 'social insurance'];
for (const [k, b] of ALL) {
  const body = (b.html + b.subject + b.text).toLowerCase();
  const hit = DEDUCT.find((w) => body.includes(w.toLowerCase()));
  ok(!hit, `${k}: 控除の項目名が入っていない（見本でも書かない）`, hit || '');
}

/* 支給の側の項目名は、見本の帯グラフの凡例としてだけ出る。
   見本の外に出たら「その人の明細の中身を見ている」と読めるので落とす。 */
const SLIP = ['基本給', '乗務手当', '住宅手当', '扶養手当',
  'basic pay', 'flight pay', 'housing allowance'];
for (const [k, b] of ALL) {
  const body = stripSample(b.html + b.subject + b.text).toLowerCase();
  const hit = SLIP.find((w) => body.includes(w.toLowerCase()));
  ok(!hit, `${k}: 見本のほかに明細の項目名が入っていない`, hit || '');
}

/* ════════ 図（画像）══════════════════════════════════════════
   受信箱では SVG も conic-gradient も動かないので、折れ線とドーナツは
   実物の my-value.html を撮った画像（gen-mail-images.mjs）を貼っている。
   ここで見るのは4つ。
     A) 綴り違いで空の枠が出ないこと（PNG/JPG がリポジトリに実在する）
     B) 本番のドメインを指していること（下見用の localhost が混ざったまま送らない）
     C) 画像を止めている受信箱で中身が空にならないこと（alt と要約が文字で残る）
     D) 文字だけの版に画像 URL が並んでいないこと                        */
console.log('\n── 図（画像）──');

const IMGS = Object.values(SAMPLE).flatMap((s) => [s.cum, s.bd]);
for (const c of IMGS) {
  let size = 0;
  try { size = statSync(join(ROOT, 'assets/mail', c.img)).size; } catch (e) { /* 無い */ }
  ok(size > 0, `assets/mail/${c.img} が実在する`, size ? '' : 'gen-mail-images.mjs を流す');
  /* 1枚 400KB を超えたら重い。受信箱は2枚まとめて落とすので、開くのが遅くなる。 */
  ok(size > 0 && size < 400 * 1024, `assets/mail/${c.img} が 400KB 未満（${Math.round(size / 1024)}KB）`);
}

/* 配信されるフォルダに置いてあること（_config.yml の exclude は除外リスト方式。
   assets/ は書かれていない＝配信される）。ここが変わると画像だけ 404 になる。 */
ok(!/^\s*-\s*assets\//m.test(read('_config.yml')), 'assets/ が配信から外されていない（_config.yml）');

/* 画像の版が中身と合っていること。
   ★Cloudflare が画像を4時間持つ。作り直しただけで版を上げないと、受信箱には
     古い絵が出続ける。版は中身から作るので、ここがずれたら貼り忘れ。
   ★公開直後に 404 を1回引くとその「無い」も残る。版を付けた URL は
     新しい入口なので、その事故を巻き込まない（実際に push 直後に起きた）。 */
const h = createHash('sha1');
for (const f of readdirSync(join(ROOT, 'assets/mail')).sort()) h.update(readFileSync(join(ROOT, 'assets/mail', f)));
const wantVer = h.digest('hex').slice(0, 8);
ok(IMG_VER === wantVer, `画像の版が中身と一致（IMG_VER = '${wantVer}'）`,
   IMG_VER === wantVer ? '' : `いま '${IMG_VER}'。announce-mail.mjs の IMG_VER を '${wantVer}' に直す`);

for (const [k, b] of ALL) {
  const srcs = [...b.html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  ok(srcs.length === (b.lang === 'both' ? 4 : 2), `${k}: 図が ${b.lang === 'both' ? 4 : 2} 枚ある（${srcs.length}）`);
  const bad = srcs.find((s) => !s.startsWith('https://pilot-value.com/assets/mail/'));
  ok(!bad, `${k}: 図の宛先が本番のドメイン`, bad || '');
  const noVer = srcs.find((s) => !s.endsWith(`?v=${IMG_VER}`));
  ok(!noVer, `${k}: 図の URL に版が付いている`, noVer || '');

  /* 画像には必ず alt を付ける。しかも「見本」で始める＝画像だけが切り取られて
     広まっても、架空の値だと分かる。 */
  const alts = [...b.html.matchAll(/<img[^>]+alt="([^"]*)"/g)].map((m) => m[1]);
  ok(alts.length === srcs.length && alts.every((a) => a.length > 10),
     `${k}: すべての図に alt がある`);
  const badAlt = alts.find((a) => !/^(見本|Sample)/.test(a));
  ok(!badAlt, `${k}: alt が「見本」／「Sample」で始まる`, badAlt || '');

  /* 画像を止めていても、図の中身が言葉で残っていること。 */
  const langs = b.lang === 'both' ? ['ja', 'en'] : [b.lang];
  const missCap = langs.find((l) =>
    !(b.html.includes(SAMPLE[l].cum.cap) && b.html.includes(SAMPLE[l].bd.cap)));
  ok(!missCap, `${k}: 図の要約が HTML に文字として入っている`, missCap || '');

  /* 文字だけの版に画像 URL を並べない。長いリンクが5本続くと本文が読めなくなる。 */
  ok(!/assets\/mail\//.test(b.text), `${k}: 文字だけの版に図の URL が入っていない`);
  const missText = langs.find((l) =>
    !(b.text.includes(SAMPLE[l].cum.cap) && b.text.includes(SAMPLE[l].bd.cap)));
  ok(!missText, `${k}: 文字だけの版にも図の中身が言葉で入っている`, missText || '');
}

/* 図の数字と本文の数字が同じ架空のパイロットから来ていること。
   元が2つに割れると、同じメールの中で図と本文に違う金額が並ぶ。 */
const { SAMPLE_ROWS } = await import(join(ROOT, 'mail-bot/announce-mail.mjs'));
const r0 = SAMPLE_ROWS[0];
const gross = r0.net_pay_actual + r0.deduction_total;                 // 総支給／月
const cumJpy = gross * SAMPLE_ROWS.length;                            // 累計報酬
const perBh = Math.round((r0.annual_total_jpy / 12 - r0.per_diem) / r0.block_hours);
ok(SAMPLE.ja.cum.cap.includes(`¥${(cumJpy / 10000).toLocaleString('en-US')}万`),
   `日本語の要約の累計が SAMPLE_ROWS と一致（¥${(cumJpy / 10000).toLocaleString('en-US')}万）`, SAMPLE.ja.cum.cap);
ok(SAMPLE.ja.cum.cap.includes(`¥${perBh.toLocaleString('en-US')}`),
   `日本語の要約の時間あたりが SAMPLE_ROWS と一致（¥${perBh.toLocaleString('en-US')}）`, SAMPLE.ja.cum.cap);
ok(SAMPLE.ja.rows.some(([, v]) => v.includes(`$${r0.usd_per_block_hour} `)),
   `見本カードの時間あたり報酬が SAMPLE_ROWS と一致（$${r0.usd_per_block_hour}）`);
ok(SAMPLE.en.rows.some(([, v]) => v.includes(`¥${r0.net_annual_jpy.toLocaleString('en-US')}`)),
   '英語の見本カードの推定手取りが SAMPLE_ROWS と一致');
ok(!('gross_monthly' in r0),
   'SAMPLE_ROWS に gross_monthly が無い（あると支給構成のドーナツが描かれない）');
ok(r0.flight_variable_pay < r0.other_allowance,
   '乗務変動手当がその他手当の内訳に収まっている（足すと二重計上）');

console.log('\n── ① のつづき ──');

/* 「同区分の中での位置」は書かない。n≧5 の枠にしか出ない
   （pay-report.html の分布バー）ので、いま受け取る人にはまず出ない＝嘘になる。 */
const PCT = ['パーセンタイル', 'percentile', '上位', '平均より', 'compared with others', '順位'];
for (const [k, b] of ALL) {
  const body = (b.html + b.subject + b.text).toLowerCase();
  const hit = PCT.find((w) => body.includes(w.toLowerCase()));
  ok(!hit, `${k}: 「他人と比べた位置」を約束していない`, hit || '');
}

/* ════════ ② サイトの実装と合っているか ══════════════════════ */
console.log('\n── ② 書いた事実がサイトと合っているか ──');

const SQL = read('db/pay-reports.sql');
const JP = read('pay-report.html');
const EN = read('en/pay-report.html');

ok(/interval\s+'90 days'/.test(SQL), '解放が 90 日であることをスキーマ側で確認した');
for (const [k, b] of ALL) {
  if (b.lang !== 'en') ok(b.text.includes('90日'), `${k}: 本文の「90日」がスキーマと一致`);
  if (b.lang !== 'ja') ok(/90 days/.test(b.text), `${k}: 本文の「90 days」がスキーマと一致`);
}

/* レポート画面に出る見出しと、メールに並べた見出しが同じ言葉であること。 */
const LABELS_JA = ['年換算の総額', '時間あたり報酬', '推定手取り（年）'];
const LABELS_EN = ['Annualised total', 'Pay per block hour', 'Estimated take-home (yr)'];
for (const w of LABELS_JA) ok(JP.includes(w), `pay-report.html に「${w}」がある`);
for (const w of LABELS_EN) ok(EN.includes(w), `en/pay-report.html に「${w}」がある`);
for (const w of LABELS_JA) ok(build(P.ja, O).text.includes(w), `日本語のメールに「${w}」がある`);
for (const w of LABELS_EN) ok(build(P.en, O).text.includes(w), `英語のメールに「${w}」がある`);

/* 明細の扱いについての主張が、実際の画面の説明と食い違っていないこと。 */
const PS = read('payslip.js');
ok(/保存しません/.test(PS), '「読み取りに使った画像は保存しません」は画面側にもある主張');
ok(build(P.ja, O).text.includes('保存しません'), '日本語のメールにも同じ言い方で入っている');

/* 送信時のログインがページ内で終わることを言っている＝その実装があること。 */
ok(read('pay-login.js').includes('PVPayLogin'), 'ページ内ログインの実体がある（pay-login.js）');
ok(build(P.jaF, O).text.includes('最後にレポートを表示するとき'), '「最後だけログイン」を提出済みの人に伝えている');

/* ════════ ③ 解除の導線 ══════════════════════════════════════ */
console.log('\n── ③ 解除の導線 ──');
for (const [k, b] of ALL) {
  ok(b.unsubUrl.includes(P[k].unsub_token), `${k}: 解除リンクがその人のトークンを持っている`);
  ok(b.html.includes(b.unsubUrl), `${k}: HTML 版に解除リンクがある`);
  ok(b.text.includes(b.unsubUrl), `${k}: 文字版にも解除リンクがある`);
  ok(/functions\/v1\/remind-payslip\?u=/.test(b.oneClickUrl), `${k}: 受信箱のワンクリック解除の宛先がある`);
}
/* 解除の入口を新設していないこと（本番で動いている1本に寄せる）。 */
ok(/pv_reminder_unsub/.test(read('db/pay-reminder.sql')), 'ワンクリック解除の先で email_opt_in が落ちる（既存の関数）');

/* ════════ 出し分け ══════════════════════════════════════════ */
console.log('\n── 出し分け ──');
ok(langModeOf(P.ja) === 'ja', '仮名漢字の氏名 → 日本語');
ok(langModeOf({ name: 'Taro', country: '日本' }) === 'ja', 'ローマ字でも居住国が日本なら日本語');
ok(langModeOf(P.en) === 'en', '英字の氏名＋日本以外 → 英語');
ok(langModeOf(P.both) === 'both', '氏名も居住国も手がかりが無い → 日英ともに送る');
ok(langModeOf({ name: '', country: '' }) === 'both', '氏名が空でも当てずっぽうで決めない');

ok(build(P.ja, O).text.includes('/pay-report.html') && !build(P.ja, O).text.includes('/en/'),
   '日本語の人には日本語ページへ送る');
ok(build(P.en, O).text.includes('/en/pay-report.html'), '英語の人には英語ページへ送る');
ok(build(P.both, O).text.includes('/pay-report.html') && build(P.both, O).text.includes('/en/pay-report.html'),
   '日英ともの人には両方のページを出す');

ok(build(P.ja, O).subject !== build(P.jaF, O).subject, '提出済みの人と未提出の人で件名が違う');
ok(build(P.jaF, O).text.includes('変更点'), '提出済みの人には「変更点」を出す');
ok(!build(P.ja, O).text.includes('変更点'), '未提出の人には「変更点」を出さない');

/* 件名の長さ。受信箱の一覧で切られない範囲に収める。 */
for (const [k, b] of ALL) ok(b.subject.length <= 78, `${k}: 件名が 78 文字以内（${b.subject.length}）`);

/* ★氏名を本文に出さない（2026-08-23 オーナー判断）。
   匿名で給与と職場のことを出してもらっているサービスで、こちらから氏名で呼びかけると、
   受信箱にも Resend の送信ログにも「このアドレス＝この氏名」が残る。
   氏名は言語の判定（langOf）にだけ使う。
   宛名に戻すと、ここが落ちる。 */
const named = build({ name: '高橋 蓮', country: '日本', unsub_token: 't', pay_report_count: 0 }, O);
ok(!named.html.includes('高橋') && !named.text.includes('高橋') && !named.subject.includes('高橋'),
  '氏名が本文・件名のどこにも出ない');
const namedEn = build({ name: 'Alex Mercer', country: 'UAE', unsub_token: 't', pay_report_count: 0 }, O);
ok(!/Mercer/.test(namedEn.html + namedEn.text + namedEn.subject), '英語でも氏名が出ない');
/* 差し込まないので、タグを入れられても本文に出る道が無い。 */
const evil = build({ name: '<script>x</script>', country: '日本', unsub_token: 't', pay_report_count: 0 }, O);
ok(!evil.html.includes('<script>') && !evil.html.includes('&lt;script&gt;'),
  '氏名に入れられたタグが本文に出ない（エスケープ済みの形でも出ない）');

/* 名前が無い人にも送れること（Google 登録だと空のことがある）。 */
const anon = build({ name: null, country: null, unsub_token: 't', pay_report_count: 0 }, O);
ok(anon.html.length > 500 && !/null|undefined/.test(anon.text), '氏名が空でも本文が壊れない');

/* ════════ ④ FOUNDING PILOT 100 のお知らせ ══════════════════════════
   buildFounding()。announce と同じ約束を継ぐが、決定的に違う点が2つある。

   ・★email_opt_in で絞らずに登録者全員へ送る（オーナー判断）。
     そのため本文に勧誘が1文でも入ると広告宣伝メールになり、
     特定電子メール法4条の「送信者の氏名・住所」の表示義務が発生する。
     運営者の身元を守る方針と正面からぶつかるので、勧誘を機械で見張る。
   ・★受け取った人自身の番号を本文に書かない。
     書くと受信箱と Resend の送信ログに「このアドレスの人は No.7」が残る。
     番号はログインしたマイページにだけ出す。                        */
console.log('\n── ④ FOUNDING PILOT 100 のお知らせ ──');

const FP = {
  ja:   { name: '高橋 蓮',     country: '日本', unsub_token: 'f-ja' },
  en:   { name: 'Alex Mercer', country: 'UAE',  unsub_token: 'f-en' },
  both: { name: 'Ren Aoki',    country: null,   unsub_token: 'f-both' },
};
const FALL = Object.entries(FP).map(([k, x]) => [k, buildFounding(x, O)]);

/* 入れてはいけないもの。announce と同じ物差しをそのまま当てる。
   ★こちらは見本カードが無いので stripSample を通さない＝素の本文で見る。 */
for (const [k, b] of FALL) {
  const body = b.html + '\n' + b.subject + '\n' + b.text;
  const money = MONEY.find(([re]) => re.test(body));
  ok(!money, `founding/${k}: 金額が1つも入っていない`, money ? `${money[1]} → ${body.match(money[0])[0]}` : '');

  const name = NAMES.find((n) => hitsName(body, n));
  ok(!name, `founding/${k}: 航空会社名が1つも入っていない`, name || '');

  const low = body.toLowerCase();
  const ded = DEDUCT.find((w) => low.includes(w.toLowerCase()));
  ok(!ded, `founding/${k}: 控除の項目名が入っていない`, ded || '');
  const slip = SLIP.find((w) => low.includes(w.toLowerCase()));
  ok(!slip, `founding/${k}: 明細の項目名が入っていない`, slip || '');
}

/* ★番号を本文に書かない。
   出てよい数字は題名の "FOUNDING PILOT 100" の 100 だけ。それを取り除いた残りに
   数字が1文字も無いこと。「No.7」も「残り86枠」も「会員31名」もここで落ちる。 */
for (const [k, b] of FALL) {
  const bare = (b.subject + '\n' + b.text).split('FOUNDING PILOT 100').join(' ');
  const digits = bare.replace(/[^0-9]/g, '');
  ok(digits === '', `founding/${k}: 本文に数字が1つも無い（番号・人数・残り枠を書かない）`, digits);
}
/* HTML 側も同じ。URL とスタイルには数字が入るので、見える文字だけを取り出して見る。 */
for (const [k, b] of FALL) {
  const visible = b.html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')                    // タグごと落とす＝href も style も消える
    .split('FOUNDING PILOT 100').join(' ')
    .replace(/&[a-z]+;/gi, ' ');
  const digits = visible.replace(/[^0-9]/g, '');
  ok(digits === '', `founding/${k}: HTML の見える文字にも数字が無い`, digits);
}

/* ★勧誘の言い回しが入っていないこと。
   ここが入ると広告宣伝メールになる（上のコメント参照）。
   「出すと番号が入る」はマイページの沈んだ板が担当で、メールは担当しない。 */
const SOLICIT = [
  'ください', 'しませんか', 'お願いします', 'ぜひ', 'いかがですか',
  'please share', 'why not', 'sign up', 'submit your', 'upload your', "don't miss",
];
for (const [k, b] of FALL) {
  const low = (b.html + b.subject + b.text).toLowerCase();
  const hit = SOLICIT.find((w) => low.includes(w.toLowerCase()));
  ok(!hit, `founding/${k}: 勧誘の言い回しが入っていない`, hit || '');
}

/* ★「あなたには番号がある／まだ無い」と言い当てないこと。
   全員に同じ1通が届くので、どちらを書いても嘘になる人が出る。
   機械で確かめられるのは「入力が変わっても本文が1文字も変わらない」こと。 */
{
  const a = buildFounding({ name: '高橋 蓮', country: '日本', unsub_token: 'x' }, O);
  const b = buildFounding({ name: '高橋 蓮', country: '日本', unsub_token: 'x',
    pay_report_count: 9, review_count: 4, founding_no: 7 }, O);
  ok(a.html === b.html && a.subject === b.subject,
     'founding: 提出の有無や番号を渡しても本文が変わらない（1種類しか作れない）');
}

/* 解除の導線。全員に送るぶん、ここが欠けたときの傷が announce より深い。 */
for (const [k, b] of FALL) {
  ok(b.unsubUrl.includes(FP[k].unsub_token), `founding/${k}: 解除リンクがその人のトークンを持っている`);
  ok(b.html.includes(b.unsubUrl), `founding/${k}: HTML 版に解除リンクがある`);
  ok(b.text.includes(b.unsubUrl), `founding/${k}: 文字版にも解除リンクがある`);
  ok(/functions\/v1\/remind-payslip\?u=/.test(b.oneClickUrl), `founding/${k}: ワンクリック解除の宛先がある`);
}

/* ★footer の理由書き。announce の「通知を希望した方に」を流用すると、
   希望していない人にそれが届く＝嘘になる。別の1行を持っていること。 */
for (const [k, b] of FALL) {
  const t = b.text;
  ok(!/希望|opted in|opt-in/i.test(t), `founding/${k}: 「希望した方に」と書いていない（全員に送るため）`);
  ok(/お知らせとしてお送り|service notice/i.test(t), `founding/${k}: 全員に送る理由を正直に書いている`);
}

/* 画像を使わない。画像を止めている受信箱で称号そのものが消えないこと。 */
for (const [k, b] of FALL) ok(!/<img/i.test(b.html), `founding/${k}: 画像を使っていない`);

/* 行き先はマイページ（番号があるのはそこだけ）。 */
ok(buildFounding(FP.ja, O).text.includes('/profile.html'), 'founding: 日本語の人はマイページへ');
ok(buildFounding(FP.en, O).text.includes('/en/profile.html'), 'founding: 英語の人は英語のマイページへ');
{
  const b = buildFounding(FP.both, O).text;
  ok(b.includes('/profile.html') && b.includes('/en/profile.html'), 'founding: 日英ともの人には両方');
}

/* ★日英ともに入れるときは英語が上、日本語が下（2026-08-23 オーナー判断）。
   この形になるのは「言語の手がかりがまったく無い人」だけで、
   英語しか読めない人が上の日本語を見て閉じるほうが損が大きい。
   announce と founding で並びを変えない ―― 同じ人に届く2通で上下が
   入れ替わると、同じサービスから来たものに見えない。 */
for (const [nm, mk] of [['announce', () => build(P.both, O)], ['founding', () => buildFounding(FP.both, O)]]) {
  const b = mk();
  const t = b.text;
  const jaAt = t.search(/[぀-ヿ一-鿿]/);
  const enAt = t.search(/[A-Za-z]{4,}/);
  ok(enAt >= 0 && jaAt >= 0 && enAt < jaAt, `${nm}: 日英ともは英語が上・日本語が下`,
     `en@${enAt} ja@${jaAt}`);
  /* 仕切りの一言も向きに合わせる。固定の "English follows." のままだと、
     英語の上に「English follows.」が出て逆さになる。 */
  ok(b.html.includes('日本語は下に続きます。'), `${nm}: 仕切りが「日本語は下に続きます。」`);
  ok(!b.html.includes('English follows.'), `${nm}: 逆向きの仕切りが残っていない`);
  /* 件名も英語が先（受信箱の一覧で最初に目に入る）。 */
  ok(/^[\x00-\x7F]/.test(b.subject), `${nm}: 件名の頭が英語`, b.subject);
  /* 解除リンクの行き先は、その文言の言語のページ。 */
  ok(b.text.includes('/en/unsubscribe.html'), `${nm}: 英語の解除リンクは英語のページへ`);
}
/* 片方だけの人は今までどおり（英語の人に日本語を足さない・その逆も）。 */
ok(!/[぀-ヿ一-鿿]/.test(buildFounding(FP.en, O).text), 'founding: 英語だけの人に日本語を混ぜない');
ok(!/(English follows|日本語は下に続きます)/.test(buildFounding(FP.ja, O).html),
   'founding: 日本語だけの人に仕切りを出さない');

/* 出し分けは announce と同じ物差しを使う（同じ人に日本語と英語が別々に届かない）。 */
for (const [k] of FALL) ok(buildFounding(FP[k], O).lang === langModeOf(FP[k]),
  `founding/${k}: 言語の決め方が announce と同じ`);

/* ★こちらも氏名を本文に出さない。理由は上の announce と同じ。 */
{
  for (const [k, b] of FALL) {
    const nm = String(FP[k].name).split(/\s+/).filter((w) => w.length >= 2);
    const hit = nm.find((w) => (b.subject + b.html + b.text).includes(w));
    ok(!hit, `founding/${k}: 氏名が件名にも本文にも出ない`, hit || '');
  }
  const evil = buildFounding({ name: '<script>x</script>', country: '日本', unsub_token: 't' }, O);
  ok(!evil.html.includes('<script>') && !evil.html.includes('&lt;script&gt;'),
    'founding: 氏名に入れられたタグが本文に出ない');
  const anon = buildFounding({ name: null, country: null, unsub_token: 't' }, O);
  ok(anon.html.length > 500 && !/null|undefined/.test(anon.text), 'founding: 氏名が空でも本文が壊れない');
}

/* 件名の長さ。 */
for (const [k, b] of FALL) ok(b.subject.length <= 78, `founding/${k}: 件名が 78 文字以内（${b.subject.length}）`);

/* 称号の名前は画面と同じでなければならない（メールで見た名前がページに無い、を防ぐ）。 */
{
  const js = read('pv-founding.js');
  ok(/FOUNDING PILOT 100/.test(js) && FALL.every(([, b]) => b.html.includes('FOUNDING PILOT 100')),
     'founding: 称号の綴りが pv-founding.js と同じ');
  ok(/創設メンバー/.test(js) && buildFounding(FP.ja, O).html.includes('創設メンバー'),
     'founding: 日本語の副題も画面と同じ');
  ok(/Founding Member/.test(js) && buildFounding(FP.en, O).html.includes('Founding Member'),
     'founding: 英語の副題も画面と同じ');
}

console.log(`\n${pass} pass / ${fail} fail\n`);
process.exit(fail ? 1 : 0);
