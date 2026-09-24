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

   ⑤ REAL PAY 公開のお知らせ（buildRealPay）
      ④と同じく登録者全員に送る。加えて、書いた主張が actual-pay.js と
      1文字違わないことを見る（画面の文言を直したらここが落ちる＝
      メールに古い主張が残らない）。

   ⑥ この1ヶ月のお知らせ（buildUpdate）
      ★このメールだけ航空会社の名前と件数を**わざと書く**（2026-09-12 オーナー決定）。
      だから①④⑤の「社名ゼロ・数字ゼロ」は当てられない。代わりに逆向きに縛る
      ―― 出てよい社名は UPDATE_AIRLINES の7社だけ・出てよい数字は
      UPDATE_STATS から来る2つだけ。あとから1件しかない社や会員数を足したら落ちる。

   ⑦ トップページ刷新のお知らせ（buildRenewal）
      ④⑤と同じく登録者全員に送る。原稿には社名も件数も1つも無いので、
      ①④⑤の「社名ゼロ」に加えて**数字もゼロ**で縛る。
      ★共有のお願いの2段落は INVITE の案内に置き換えてある（2026-09-24 オーナー決定）。
      添えた1文は pv-referral.js からそのまま借りている＝ここで照合する。
      ★英語の人の行き先は /en/（同日オーナー指示）。
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, statSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { join } from 'path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log(`  ✅ ${m}`)) : (fail++, console.log(`  ❌ ${m}${x ? '\n     ' + x : ''}`)); };

const { build, buildFounding, buildRealPay, buildUpdate, buildRenewal, buildDigest,
        realPayLangOf, langModeOf, updateLangOf, renewalLangOf, digestLangOf, digestStats,
        DIGEST_MIN, DIGEST_NAME_MIN, DIGEST_NAME_MAX,
        SAMPLE, IMG_VER, UPDATE_STATS, UPDATE_AIRLINES, UPDATE_FALLBACK_LANG } = await import(join(ROOT, 'mail-bot/announce-mail.mjs'));

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
   通す数字は 100 ひとつだけ。100 は称号の上限そのもので、題字の
   FOUNDING PILOT 100 がすでに公にしている数だから、本文で
   「最初の100名だけに残る」と書いても新しく漏れるものが無い
   （2026-08-23 オーナー判断で本文にも書くことにした）。
   ★それ以外の数字は1文字も通さない。「No.7」も「会員31名」も、
   100 を含む「1000」も、100 を抜いた残りが digits に出るので落ちる。 */
const bareOf = (s) => s
  .split('FOUNDING PILOT 100').join(' ')
  .split('100').join(' ')
  .replace(/[^0-9]/g, '');
for (const [k, b] of FALL) {
  const digits = bareOf(b.subject + '\n' + b.text);
  ok(digits === '', `founding/${k}: 本文に 100 以外の数字が無い（番号・人数・残り枠を書かない）`, digits);
}
/* HTML 側も同じ。URL とスタイルには数字が入るので、見える文字だけを取り出して見る。 */
for (const [k, b] of FALL) {
  const visible = b.html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')                    // タグごと落とす＝href も style も消える
    .replace(/&[a-z]+;/gi, ' ');
  ok(bareOf(visible) === '', `founding/${k}: HTML の見える文字にも 100 以外の数字が無い`, bareOf(visible));
}

/* ★100 を通したぶん、守りたかったものを名指しで見張る。
   数字の全面禁止は「残り86枠」「会員31名」を止めるためのものだった。
   100 に穴を開けたので、会員数が外から分かる言い回しをここで止める。 */
const COUNTS = [/残り\s*\d/, /あと\s*\d+\s*(人|名|枠)/, /現在\s*\d+\s*(人|名)/,
  /\d+\s*(人|名)\s*が(登録|参加|投稿)/, /remaining/i, /slots? left/i,
  /spots? left/i, /joined so far/i, /so far/i];
for (const [k, b] of FALL) {
  const body = b.html + '\n' + b.subject + '\n' + b.text;
  const hit = COUNTS.find((re) => re.test(body));
  ok(!hit, `founding/${k}: 会員数が分かる言い回しが入っていない`, hit ? String(hit) : '');
}

/* ★勧誘の言い回しが入っていないこと。
   ここが入ると広告宣伝メールになる（上のコメント参照）。
   「出すとこの称号が入る」はマイページの沈んだ板が担当で、メールは担当しない。 */
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

/* ════════ ⑤ REAL PAY 公開のお知らせ ══════════════════════════════
   buildRealPay()。④と同じく登録者全員へ送るので、勧誘・人数・金額の
   見張りをそのまま継ぐ。加えてこのメール特有の約束が3つある。

   ・★主張の出どころは actual-pay.js ただ1つ。見えること7つと列の見出し6つを
     1文字違わず写しているかを見る。画面を直したのにメールが古いままだと、
     開いた人が「メールにあった列が無い」と探すことになる。
   ・★「個人が特定されない形に加工しています」と書かない。
     k≧5 の門・30日の遅延・p10-p90 のクリップは 2026-08-23 に外してあり、
     db/pay-rows.sql の契約ヘッダは「同じ会社・同じ職位の同僚には
     当てられうる」と書いている。実装より強い約束をメールでしない。
   ・★日英ともは日本語が上・英語が下（2026-08-27 オーナー指示）。
     announce / founding とは逆。ここだけ向きが違うのはわざとなので、
     揃えようとして直さない。                                        */
console.log('\n── ⑤ REAL PAY 公開のお知らせ ──');

const RP = {
  ja:   { name: '高橋 蓮',     country: '日本', unsub_token: 'rp-ja' },
  en:   { name: 'Alex Mercer', country: 'UAE',  unsub_token: 'rp-en' },
  both: { name: 'Ren Aoki',    country: null,   unsub_token: 'rp-both' },
};
const RALL = Object.entries(RP).map(([k, x]) => [k, buildRealPay(x, O)]);

/* 入れてはいけないもの。①④と同じ物差しをそのまま当てる（見本カードが
   無いので stripSample を通さない＝素の本文で見る）。 */
for (const [k, b] of RALL) {
  const body = b.html + '\n' + b.subject + '\n' + b.text;
  const money = MONEY.find(([re]) => re.test(body));
  ok(!money, `realpay/${k}: 金額が1つも入っていない`, money ? `${money[1]} → ${body.match(money[0])[0]}` : '');

  const name = NAMES.find((n) => hitsName(body, n));
  ok(!name, `realpay/${k}: 航空会社名が1つも入っていない`, name || '');

  const low = body.toLowerCase();
  const ded = DEDUCT.find((w) => low.includes(w.toLowerCase()));
  ok(!ded, `realpay/${k}: 控除の項目名が入っていない`, ded || '');
  const slip = SLIP.find((w) => low.includes(w.toLowerCase()));
  ok(!slip, `realpay/${k}: 明細の項目名が入っていない`, slip || '');
}

/* ★人数・件数を書かない。REAL PAY の画面は数え上げを出すが、それは
   開いた人にだけ見せるもので、受信箱と Resend の送信ログに残す物ではない。
   通す数字は下の3つの言い回しの中だけ（会員の規模と関係が無い数）。
   それ以外は1文字も通さないので、あとから「28件あります」を足したら落ちる。 */
const RP_OK_DIGITS = ['パイロット1人につき1行', 'パイロットが1人ずつ', '年収を12で割った', 'ここに集まる1件ずつ'];
const rpBare = (s) => RP_OK_DIGITS.reduce((a, w) => a.split(w).join(' '), s).replace(/[^0-9]/g, '');
for (const [k, b] of RALL) {
  ok(rpBare(b.subject + '\n' + b.text) === '', `realpay/${k}: 文字版に人数・件数が無い`,
     rpBare(b.subject + '\n' + b.text));
  const visible = b.html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ');
  ok(rpBare(visible) === '', `realpay/${k}: HTML の見える文字にも人数・件数が無い`, rpBare(visible));
}

/* ★勧誘の言い回しが入っていないこと。オーナーの原稿にあった末尾の1文
   （「まだ給与を共有していない方は…／匿名で給与を共有する →」）は、
   全員に送るために外してある。戻すと広告宣伝メールになり、本文に
   運営者の氏名・住所を書く義務が出る。 */
for (const [k, b] of RALL) {
  const low = (b.html + b.subject + b.text).toLowerCase();
  const hit = SOLICIT.find((w) => low.includes(w.toLowerCase()));
  ok(!hit, `realpay/${k}: 勧誘の言い回しが入っていない`, hit || '');
}
/* ボタンは REAL PAY へ行く1つだけ。給与フォームへの導線を本文に置かない
   （置いた時点で「出してください」という誘いになる）。 */
for (const [k, b] of RALL) {
  ok(!/pay-report\.html/.test(b.html + b.text), `realpay/${k}: 給与フォームへの導線が無い`);
  const n = (b.html.match(/actual-pay\.html/g) || []).length;
  ok(n === (b.lang === 'both' ? 2 : 1), `realpay/${k}: 押す所は言語ごとに1つだけ`, String(n));
}

/* ★主張の出どころ。actual-pay.js から実際に切り出して突き合わせる。 */
{
  const ap = read('actual-pay.js');
  const pick = (re) => [...ap.matchAll(re)].map((m) => m[1]);
  const seeBlocks = [...ap.matchAll(/\bsee:\s*\[([\s\S]*?)\]/g)]
    .map((m) => [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]));
  ok(seeBlocks.length === 2, `actual-pay.js から see を2つ取り出せた（${seeBlocks.length}）`);
  const [seeJa, seeEn] = seeBlocks;
  const bJa = buildRealPay(RP.ja, O), bEn = buildRealPay(RP.en, O);
  for (const [nm, arr, b] of [['ja', seeJa, bJa], ['en', seeEn, bEn]]) {
    ok(arr.length === 7, `realpay/${nm}: 画面の「見えること」が7つ`, String(arr.length));
    const miss = arr.find((line) => !b.html.includes(line) || !b.text.includes(line));
    ok(!miss, `realpay/${nm}: 7つとも actual-pay.js と1文字違わない`, miss || '');
  }
  /* 列の見出し6つ。骨組みの表と画面で違う言葉を出さない。 */
  const th = (key) => pick(new RegExp('\\b' + key + ":\\s*'([^']*)'", 'g'));
  const keys = ['thAir', 'thPos', 'thAmt', 'thMon', 'thVf', 'thAge'];
  for (const [i, nm, b] of [[0, 'ja', bJa], [1, 'en', bEn]]) {
    const heads = keys.map((k2) => th(k2)[i]);
    ok(heads.every(Boolean), `realpay/${nm}: 画面から列の見出し6つを取り出せた`, heads.join('/'));
    const miss = heads.find((h) => h && !b.html.includes('>' + h + '<'));
    ok(!miss, `realpay/${nm}: 骨組みの表の見出しが画面と同じ`, miss || '');
  }
  /* 「見えること」の見出しも画面と同じ（seeT）。 */
  const seeT = pick(/\bseeT:\s*'([^']*)'/g);
  ok(seeT.length === 2 && bJa.html.includes(seeT[0]) && bEn.html.includes(seeT[1]),
     'realpay: 「見えること」の見出しが画面と同じ', seeT.join(' / '));
}

/* ★賞与の列は無い（actual-pay.js:574「賞与の列は無い」）。
   オーナーの原稿にあった「Bonusなどの報酬情報」は、無い列を約束していた。 */
for (const [k, b] of RALL) {
  const body = (b.html + b.subject + b.text).toLowerCase();
  ok(!/賞与|ボーナス|\bbonus/.test(body), `realpay/${k}: 賞与のことを書いていない（列が無い）`);
}

/* ★実装より強い約束をしない。匿名加工・特定不能をうたわない。 */
const OVERCLAIM = [/個人が特定され/, /特定できない/, /匿名加工/, /完全に匿名化/,
  /cannot be identified/i, /de-?identified/i, /anonymi[sz]ed data/i];
for (const [k, b] of RALL) {
  const body = b.html + b.subject + b.text;
  const hit = OVERCLAIM.find((re) => re.test(body));
  ok(!hit, `realpay/${k}: 特定されないと言い切っていない`, hit ? String(hit) : '');
}

/* ★DEEP PAY はまだページが無い。もう使えるように読める書き方をしない。 */
for (const [k, b] of RALL) {
  const t = b.text;
  if (!/DEEP PAY/.test(t)) { ok(false, `realpay/${k}: DEEP PAY に触れている`); continue; }
  ok(/準備しています|preparing/.test(t), `realpay/${k}: DEEP PAY は「準備しています」`);
  ok(!/DEEP PAY[^。\n]{0,20}(公開しました|見られます|is (now )?(live|available)|you can (now )?see)/i.test(t),
     `realpay/${k}: DEEP PAY がもう開いているように読めない`);
}

/* 解除の導線。全員に送るぶん、欠けたときの傷が深い。 */
for (const [k, b] of RALL) {
  ok(b.unsubUrl.includes(RP[k].unsub_token), `realpay/${k}: 解除リンクがその人のトークンを持っている`);
  ok(b.html.includes(b.unsubUrl), `realpay/${k}: HTML 版に解除リンクがある`);
  ok(b.text.includes(b.unsubUrl), `realpay/${k}: 文字版にも解除リンクがある`);
  ok(/functions\/v1\/remind-payslip\?u=/.test(b.oneClickUrl), `realpay/${k}: ワンクリック解除の宛先がある`);
  ok(!/希望|opted in|opt-in/i.test(b.text), `realpay/${k}: 「希望した方に」と書いていない（全員に送るため）`);
  ok(/お知らせとしてお送り|service notice/i.test(b.text), `realpay/${k}: 全員に送る理由を正直に書いている`);
}
/* 日英ともの人には解除リンクが2本（それぞれ自分の言語のページへ）。 */
{
  const b = buildRealPay(RP.both, O);
  ok(b.html.includes('/unsubscribe.html') && b.html.includes('/en/unsubscribe.html'),
     'realpay/both: 解除リンクが日英2本ある');
}

/* 行き先は REAL PAY。 */
ok(buildRealPay(RP.ja, O).text.includes('/actual-pay.html'), 'realpay: 日本語の人は日本語の REAL PAY へ');
ok(buildRealPay(RP.en, O).text.includes('/en/actual-pay.html'), 'realpay: 英語の人は英語の REAL PAY へ');

/* ★日英ともは日本語が上・英語が下。announce / founding とは逆（上のコメント）。 */
{
  const b = buildRealPay(RP.both, O);
  const jaAt = b.text.search(/[぀-ヿ一-鿿]/);
  const enAt = b.text.search(/[A-Za-z]{4,}/);
  ok(jaAt >= 0 && enAt >= 0 && jaAt < enAt, 'realpay/both: 日本語が上・英語が下', `ja@${jaAt} en@${enAt}`);
  ok(b.html.includes('English follows.'), 'realpay/both: 仕切りが「English follows.」');
  ok(!b.html.includes('日本語は下に続きます。'), 'realpay/both: 逆向きの仕切りが残っていない');
  ok(b.subject.includes('公開しました') && b.subject.includes('is now live'),
     'realpay/both: 件名に日英が両方ある', b.subject);
}
/* 片方だけの人に、もう片方を混ぜない。 */
ok(!/[぀-ヿ一-鿿]/.test(buildRealPay(RP.en, O).text), 'realpay: 英語だけの人に日本語を混ぜない');
ok(!/(English follows|日本語は下に続きます)/.test(buildRealPay(RP.ja, O).html),
   'realpay: 日本語だけの人に仕切りを出さない');

/* ★言語の決め方（2026-08-27 オーナー指示）。
   手がかりのある人は今までの2通と同じ判定。手がかりが無い人だけ、
   勤務先の航空会社が海外なら英語・そうでなければ日英ともに。
   ★langModeOf を書き換えていないこと（announce / founding の判定を巻き込まない）。 */
{
  ok(realPayLangOf(RP.ja) === 'ja' && realPayLangOf(RP.en) === 'en',
     'realpay: 氏名・居住国から分かる人は今までと同じ判定');
  ok(realPayLangOf(RP.both) === 'both', 'realpay: 手がかりが無ければ日英ともに');
  const over = { ...RP.both, airline_region: 'mideast' };
  ok(realPayLangOf(over) === 'en', 'realpay: 勤務先が海外の航空会社なら英語だけ');
  ok(buildRealPay(over, O).lang === 'en' && !/[぀-ヿ一-鿿]/.test(buildRealPay(over, O).text),
     'realpay: そのとき本文にも日本語が入らない');
  ok(realPayLangOf({ ...RP.both, airline_region: 'japan' }) === 'both',
     'realpay: 勤務先が日本の航空会社なら日英ともに');
  ok(realPayLangOf({ ...RP.both, airline_region: '' }) === 'both',
     'realpay: 名寄せが当たらなかったときも日英ともに');
  /* 日本語の氏名の人は、勤務先が海外でも日本語のまま
     （言語は居住国と氏名で決める。勤務先は手がかりが無いときの最後の頼り）。 */
  ok(realPayLangOf({ ...RP.ja, airline_region: 'mideast' }) === 'ja',
     'realpay: 氏名から分かる人は勤務先で上書きしない');
  /* ★announce / founding の判定を変えていない。 */
  ok(langModeOf(RP.both) === 'both' && langModeOf({ ...RP.both, airline_region: 'mideast' }) === 'both',
     'realpay: langModeOf（announce / founding 側）は変えていない');
}

/* ★1種類しか作れないこと。提出の有無で文面を割ると、割った側が必ず勧誘になる。 */
{
  const a = buildRealPay({ name: '高橋 蓮', country: '日本', unsub_token: 'x' }, O);
  const b = buildRealPay({ name: '高橋 蓮', country: '日本', unsub_token: 'x',
    pay_report_count: 9, review_count: 4, founding_no: 7 }, O);
  ok(a.html === b.html && a.subject === b.subject,
     'realpay: 提出の有無を渡しても本文が変わらない（1種類しか作れない）');
}

/* 画像を使わない。一覧の骨組みは表で描いてあるので、画像を止めていても消えない。 */
for (const [k, b] of RALL) ok(!/<img/i.test(b.html), `realpay/${k}: 画像を使っていない`);

/* 氏名を出さない（①④と同じ理由）。 */
for (const [k, b] of RALL) {
  const nm = String(RP[k].name).split(/\s+/).filter((w) => w.length >= 2);
  const hit = nm.find((w) => (b.subject + b.html + b.text).includes(w));
  ok(!hit, `realpay/${k}: 氏名が件名にも本文にも出ない`, hit || '');
}
{
  const evil = buildRealPay({ name: '<script>x</script>', country: '日本', unsub_token: 't' }, O);
  ok(!evil.html.includes('<script>') && !evil.html.includes('&lt;script&gt;'),
     'realpay: 氏名に入れられたタグが本文に出ない');
  const anon = buildRealPay({ name: null, country: null, unsub_token: 't' }, O);
  ok(anon.html.length > 500 && !/null|undefined/.test(anon.text), 'realpay: 氏名が空でも本文が壊れない');
}

/* 件名の長さ。 */
for (const [k, b] of RALL) ok(b.subject.length <= 78, `realpay/${k}: 件名が 78 文字以内（${b.subject.length}）`);

/* タグラインは実在の文言（index.html の最後の案内の1行／pv-referral.js の TAGLINE）。発明しない。 */
{
  ok(read('index.html').includes('パイロットの待遇に、')
     && buildRealPay(RP.ja, O).text.includes('パイロットの待遇に、匿名の実データで透明性を。'),
     'realpay: 日本語のタグラインがトップページと同じ');
  ok(/Know your value\. Raise our value\./.test(read('pv-referral.js'))
     && RALL.every(([, b]) => b.text.includes('Know your value. Raise our value.')),
     'realpay: 共通のタグラインが pv-referral.js と同じ');
}

/* ════════ ⑥ この1ヶ月のお知らせ ══════════════════════════════════
   buildUpdate()。④⑤と同じく登録者全員へ送るので、勧誘・金額・明細の
   項目名の見張りはそのまま継ぐ。**違うのは2つだけ**で、どちらも
   2026-09-12 のオーナー決定。

   ・★航空会社の名前を出す。①④⑤の「社名が1つも入っていない」は当てない。
     代わりに UPDATE_AIRLINES の7社と**完全に一致**することを見る。
     ここを「含む」で見ると、1件しかない社をあとから足しても通ってしまう
     ―― 名指した瞬間、その1社の1人が誰か絞られる。
   ・★件数を出す。⑤の「数字ゼロ」は当てない。代わりに UPDATE_STATS から
     来る数字だけが出ることを見る（会員数・人数を足したら落ちる）。

   ・★文面はオーナーの原稿。こちらで作文して一度差し戻された（同日）。
     原稿に無い見出し・箇条書き・締めのタグラインが混ざっていないことも見る。
   ════════════════════════════════════════════════════════════════ */
console.log('\n── ⑥ この1ヶ月のお知らせ ──');

const UP = {
  ja:   { name: '高橋 蓮',     country: '日本', unsub_token: 'up-ja' },
  en:   { name: 'Alex Mercer', country: 'UAE',  unsub_token: 'up-en' },
  both: { name: 'Ren Aoki',    country: null,   unsub_token: 'up-both' },
};
const UALL = Object.entries(UP).map(([k, x]) => [k, buildUpdate(x, O)]);

/* 数字の土台。milestone は total を超えられない（超えたら本文が嘘になる）。 */
{
  const S = UPDATE_STATS;
  ok(/^\d{4}-\d{2}-\d{2}$/.test(S.asOf), `update: 数字にいつ数えたかが付いている（${S.asOf}）`);
  ok(Number.isInteger(S.total) && Number.isInteger(S.milestone) && Number.isInteger(S.added),
     'update: 件数が整数');
  ok(S.milestone <= S.total, `update: 「${S.milestone}件突破」が実測 ${S.total} 件を超えていない`);
  ok(S.added <= S.total, `update: この1ヶ月の増加が累計を超えていない`);
}

/* 入れてはいけないもの。①④⑤と同じ物差し（★社名だけ外す。上のコメント）。 */
for (const [k, b] of UALL) {
  const body = b.html + '\n' + b.subject + '\n' + b.text;
  const money = MONEY.find(([re]) => re.test(body));
  ok(!money, `update/${k}: 金額が1つも入っていない`, money ? `${money[1]} → ${body.match(money[0])[0]}` : '');
  const low = body.toLowerCase();
  const ded = DEDUCT.find((w) => low.includes(w.toLowerCase()));
  ok(!ded, `update/${k}: 控除の項目名が入っていない`, ded || '');
  const slip = SLIP.find((w) => low.includes(w.toLowerCase()));
  ok(!slip, `update/${k}: 明細の項目名が入っていない`, slip || '');
  ok(!/賞与|ボーナス|\bbonus/.test(low), `update/${k}: 賞与のことを書いていない`);
  const over = OVERCLAIM.find((re) => re.test(body));
  ok(!over, `update/${k}: 特定されないと言い切っていない`, over ? String(over) : '');
}

/* ★勧誘の言い回しが入っていないこと。原稿の末尾「ぜひPilot Valueを
   紹介してください」は INVITE の案内に置き換えてある（戻すと広告宣伝メールになり、
   本文に運営者の氏名・住所を書く義務が出る）。 */
for (const [k, b] of UALL) {
  const low = (b.html + b.subject + b.text).toLowerCase();
  const hit = SOLICIT.find((w) => low.includes(w.toLowerCase()));
  ok(!hit, `update/${k}: 勧誘の言い回しが入っていない`, hit || '');
  ok(!/pay-report\.html/.test(b.html + b.text), `update/${k}: 給与フォームへの導線が無い`);
}

/* ★出てよい社名は7社だけ。SSOT の112社を全部当てて、
   UPDATE_AIRLINES に無い社が1つでも出たら落とす。 */
/* ★出す7社をここにも書き写して固定する。
   この検査は鍵もネットも使わない＝**どの社が何件あるかを知る手段が無い**。
   だから「1件しかない社に差し替えられていないか」は機械では見られない。
   代わりに、一覧を1文字でも変えたらここが落ちるようにしてある。
   落ちたら、直す前に db/usage.mjs で**その社が2件以上あることを数え直す**こと
   ―― 1件しかない社を名指した瞬間、その1人が誰か絞られる。 */
{
  const PINNED = {
    ja: { intl: ['キャセイパシフィック航空', 'エティハド航空', 'シンガポール航空', 'カンタス航空'],
          jp:   ['全日本空輸（ANA）', '日本航空（JAL）', 'ジェットスター・ジャパン'] },
    en: { intl: ['Cathay Pacific', 'Etihad Airways', 'Singapore Airlines', 'Qantas'],
          jp:   ['All Nippon Airways (ANA)', 'Japan Airlines (JAL)', 'Jetstar Japan'] },
  };
  ok(JSON.stringify(UPDATE_AIRLINES) === JSON.stringify(PINNED),
     'update: 出す航空会社が決めた7社のまま（変えたなら件数を数え直す）',
     JSON.stringify(UPDATE_AIRLINES));
}

{
  const listed = [...UPDATE_AIRLINES.ja.intl, ...UPDATE_AIRLINES.ja.jp,
                  ...UPDATE_AIRLINES.en.intl, ...UPDATE_AIRLINES.en.jp];
  ok(UPDATE_AIRLINES.ja.intl.length === 4 && UPDATE_AIRLINES.ja.jp.length === 3
     && UPDATE_AIRLINES.en.intl.length === 4 && UPDATE_AIRLINES.en.jp.length === 3,
     'update: 出す社は海外4社・日本3社（日英とも）');
  for (const [k, b] of UALL) {
    const body = b.html + b.subject + b.text;
    /* 載せると決めた社名を消してから、残りに112社の名前が出ないかを見る。
       長い方から消す（「日本航空（JAL）」を消す前に「JAL」で切らない）。 */
    const rest = [...listed].sort((a, c) => c.length - a.length)
      .reduce((acc, w) => acc.split(w).join(' '), body);
    const stray = NAMES.find((n) => hitsName(rest, n));
    ok(!stray, `update/${k}: 決めた7社のほかに航空会社名が出ない`, stray || '');
  }
}

/* ★並びは海外が先・日本があと（オーナー指示）。日本が上に来たら落ちる。 */
for (const [k, b] of UALL) {
  const langs = b.lang === 'both' ? ['ja', 'en'] : [b.lang];
  for (const l of langs) {
    const A = UPDATE_AIRLINES[l];
    const idx = [...A.intl, ...A.jp].map((n) => b.text.indexOf(n));
    ok(idx.every((i) => i >= 0), `update/${k}/${l}: 7社とも本文に出ている`, idx.join(','));
    ok(idx.every((i, j) => j === 0 || i > idx[j - 1]),
       `update/${k}/${l}: 海外4社 → 日本3社 の順に並んでいる`, idx.join(','));
  }
}

/* ★出てよい数字は UPDATE_STATS から来る2つだけ（＋日本語の「1ヶ月」）。
   会員数・人数をあとから足したらここで落ちる。 */
{
  const S = UPDATE_STATS;
  const allow = new Set([String(S.added), String(S.milestone), '1']);
  for (const [k, b] of UALL) {
    const visible = b.html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ');
    for (const [what, src] of [['文字版', b.subject + '\n' + b.text], ['HTML の見える文字', visible]]) {
      const nums = [...new Set(String(src).match(/\d+/g) || [])];
      const stray = nums.filter((n) => !allow.has(n));
      ok(stray.length === 0, `update/${k}: ${what}に UPDATE_STATS 以外の数字が無い`, stray.join(','));
    }
    ok(b.text.includes(String(S.added)) && b.text.includes(String(S.milestone)),
       `update/${k}: この1ヶ月の増加と累計の両方が本文に出ている`);
    ok(b.subject.includes(String(S.milestone)),
       `update/${k}: 件名に累計の件数が入っている`, b.subject);
  }
}

/* ★招待のリンク（2026-09-12 オーナー指示）。入口は invite.html の1枚だけ。 */
for (const [k, b] of UALL) {
  const langs = b.lang === 'both' ? ['ja', 'en'] : [b.lang];
  const n = (b.html.match(/invite\.html/g) || []).length;
  ok(n === langs.length, `update/${k}: 招待のリンクが言語ごとに1つ`, String(n));
  ok(b.text.includes('/invite.html'), `update/${k}: 文字版にも招待の URL がある（アンカーが無いため）`);
  ok(!/invite\.html[?#]/.test(b.html + b.text), `update/${k}: 招待の URL に追跡用の印が付いていない`);
  ok(b.html.includes('>INVITE</a>'), `update/${k}: 本文の「INVITE」の文字がそのままリンク`);
  /* ボタンは REAL PAY へ行く1つだけ（招待は文字リンク）。 */
  const btn = (b.html.match(/actual-pay\.html/g) || []).length;
  ok(btn === langs.length, `update/${k}: 押すボタンは言語ごとに1つだけ`, String(btn));
}
ok(buildUpdate(UP.ja, O).text.includes('/invite.html')
   && !buildUpdate(UP.ja, O).text.includes('/en/invite.html'),
   'update: 日本語の人は日本語の招待ページへ');
ok(buildUpdate(UP.en, O).text.includes('/en/invite.html'), 'update: 英語の人は英語の招待ページへ');

/* ★原稿に無いものを足していない（2026-09-12、作文して差し戻された）。 */
for (const [k, b] of UALL) {
  ok(!/<h[1-6]|<li|<ul|<ol/i.test(b.html), `update/${k}: 見出しも箇条書きも足していない`);
  ok(!/Know your value/i.test(b.text), `update/${k}: 締めのタグラインを足していない（原稿に無い）`);
  ok(!/<img/i.test(b.html), `update/${k}: 画像を使っていない`);
}
/* 原稿の書き出しと結びが1文字違わず入っている。 */
{
  const bJa = buildUpdate(UP.ja, O), bEn = buildUpdate(UP.en, O);
  ok(bJa.text.startsWith('いつもPilot Valueをご利用いただきありがとうございます。'),
     'update/ja: 原稿どおりの書き出し');
  ok(bJa.text.includes('一緒にPilot Valueを大きくしていけたら嬉しいです。✈️'),
     'update/ja: 原稿どおりの結び');
  ok(bEn.text.startsWith('Thank you for being part of Pilot Value.'),
     'update/en: 原稿どおりの書き出し');
  ok(bEn.text.includes("Let's grow Pilot Value together. ✈️"),
     'update/en: 原稿どおりの結び');
}

/* 解除の導線。全員に送るぶん、欠けたときの傷が深い。 */
for (const [k, b] of UALL) {
  ok(b.unsubUrl.includes(UP[k].unsub_token), `update/${k}: 解除リンクがその人のトークンを持っている`);
  ok(b.html.includes(b.unsubUrl), `update/${k}: HTML 版に解除リンクがある`);
  ok(b.text.includes(b.unsubUrl), `update/${k}: 文字版にも解除リンクがある`);
  ok(/functions\/v1\/remind-payslip\?u=/.test(b.oneClickUrl), `update/${k}: ワンクリック解除の宛先がある`);
  ok(!/希望|opted in|opt-in/i.test(b.text), `update/${k}: 「希望した方に」と書いていない（全員に送るため）`);
  ok(/お知らせとしてお送り|service notice/i.test(b.text), `update/${k}: 全員に送る理由を正直に書いている`);
}
{
  const b = buildUpdate(UP.both, O);
  ok(b.html.includes('/unsubscribe.html') && b.html.includes('/en/unsubscribe.html'),
     'update/both: 解除リンクが日英2本ある');
}

/* ★日英ともは日本語が上・英語が下（realpay と同じ向き）。 */
{
  const b = buildUpdate(UP.both, O);
  const jaAt = b.text.search(/[぀-ヿ一-鿿]/);
  const enAt = b.text.search(/[A-Za-z]{4,}/);
  ok(jaAt >= 0 && enAt >= 0 && jaAt < enAt, 'update/both: 日本語が上・英語が下', `ja@${jaAt} en@${enAt}`);
  ok(b.html.includes('English follows.'), 'update/both: 仕切りが「English follows.」');
  ok(!b.html.includes('日本語は下に続きます。'), 'update/both: 逆向きの仕切りが残っていない');
}
ok(!/[぀-ヿ一-鿿]/.test(buildUpdate(UP.en, O).text), 'update: 英語だけの人に日本語を混ぜない');

/* ★送り分け（2026-09-12 オーナー指示）。日本の会員は日本語・海外は英語。
   居住国も勤務先も分からない人だけ日英ともに1通（updateLangOf の最後の1行）。 */
{
  const over = { ...UP.both, airline_region: 'mideast' };
  ok(buildUpdate(over, O).lang === 'en' && !/[぀-ヿ一-鿿]/.test(buildUpdate(over, O).text),
     'update: 勤務先が海外の航空会社なら英語だけ');
  ok(buildUpdate({ ...UP.both, airline_region: 'japan' }, O).lang === 'ja',
     'update: 勤務先が日本の航空会社なら日本語だけ');
  ok(buildUpdate({ ...UP.ja, airline_region: 'mideast' }, O).lang === 'ja',
     'update: 氏名から分かる人は勤務先で上書きしない');
  ok(buildUpdate({ ...UP.en, airline_region: 'japan' }, O).lang === 'en',
     'update: 居住国から分かる人も勤務先で上書きしない');
  /* ★手がかりが1つも無い人だけが日英ともに。ここを片方に変えると、
     その人たちの半分が読めない1通を受け取る（2026-09-12 オーナー判断）。 */
  ok(UPDATE_FALLBACK_LANG === 'both' && buildUpdate(UP.both, O).lang === 'both',
     'update: 居住国も勤務先も分からない人には日英ともに1通');
}

/* ★1種類しか作れないこと。提出の有無で文面を割ると、割った側が必ず勧誘になる。 */
{
  const a = buildUpdate({ name: '高橋 蓮', country: '日本', unsub_token: 'x' }, O);
  const b = buildUpdate({ name: '高橋 蓮', country: '日本', unsub_token: 'x',
    pay_report_count: 9, review_count: 4, founding_no: 7 }, O);
  ok(a.html === b.html && a.subject === b.subject,
     'update: 提出の有無を渡しても本文が変わらない（1種類しか作れない）');
}

/* 氏名を出さない（①④⑤と同じ理由）。 */
for (const [k, b] of UALL) {
  const nm = String(UP[k].name).split(/\s+/).filter((w) => w.length >= 2);
  const hit = nm.find((w) => (b.subject + b.html + b.text).includes(w));
  ok(!hit, `update/${k}: 氏名が件名にも本文にも出ない`, hit || '');
}
{
  const evil = buildUpdate({ name: '<script>x</script>', country: '日本', unsub_token: 't' }, O);
  ok(!evil.html.includes('<script>') && !evil.html.includes('&lt;script&gt;'),
     'update: 氏名に入れられたタグが本文に出ない');
  const anon = buildUpdate({ name: null, country: null, unsub_token: 't' }, O);
  ok(anon.html.length > 500 && !/null|undefined/.test(anon.text), 'update: 氏名が空でも本文が壊れない');
}

/* 件名の長さ。 */
for (const [k, b] of UALL) ok(b.subject.length <= 78, `update/${k}: 件名が 78 文字以内（${b.subject.length}）`);


/* ════════ ⑦ トップページ刷新のお知らせ ════════════════════════════
   buildRenewal()。④⑤⑥と同じく登録者全員へ送る。⑥と違って原稿には
   社名も件数も1つも無いので、**社名ゼロ・数字ゼロ**の両方で縛る。

   ・★共有のお願いの2段落（「ぜひPILOT VALUEを共有していただけると
     うれしいです」／「サイトのリンクを共有していただくだけでも…」）は、
     INVITE の案内に置き換えてある（2026-09-24 オーナー決定・2026-09-12 と同じ扱い）。
     戻すと広告宣伝メールになり、本文に運営者の氏名・住所を書く義務が出る。
   ・★添えた1文は pv-referral.js の privacy をそのまま借りている。
     実ファイルと突き合わせる＝画面の言い方を変えたらここが落ちる
     （メールだけが古い約束を語り続けない）。
   ・★英語の人の行き先は /en/（同日オーナー指示）。日本語はルート。
   ════════════════════════════════════════════════════════════════ */
console.log('\n── ⑦ トップページ刷新のお知らせ ──');

const RN = {
  ja:   { name: '高橋 蓮',     country: '日本', unsub_token: 'rn-ja' },
  en:   { name: 'Alex Mercer', country: 'UAE',  unsub_token: 'rn-en' },
  both: { name: 'Ren Aoki',    country: null,   unsub_token: 'rn-both' },
};
const RNALL = Object.entries(RN).map(([k, x]) => [k, buildRenewal(x, O)]);

/* ★本番では「英語だけの1通」は作られない（2026-09-24 オーナー指示で、日本の会員
   以外は全員 英語＋日本語の1通）。原稿の照合のためだけに lang を明示して
   英語の面だけを作る ── --lang=en のプレビューが見ているのもこれ。 */
const O_EN = { ...O, lang: 'en' };

/* 入れてはいけないもの。①④⑤と同じ物差しをそのまま当てる。 */
for (const [k, b] of RNALL) {
  const body = b.html + '\n' + b.subject + '\n' + b.text;
  const money = MONEY.find(([re]) => re.test(body));
  ok(!money, `renewal/${k}: 金額が1つも入っていない`, money ? `${money[1]} → ${body.match(money[0])[0]}` : '');
  const low = body.toLowerCase();
  const ded = DEDUCT.find((w) => low.includes(w.toLowerCase()));
  ok(!ded, `renewal/${k}: 控除の項目名が入っていない`, ded || '');
  const slip = SLIP.find((w) => low.includes(w.toLowerCase()));
  ok(!slip, `renewal/${k}: 明細の項目名が入っていない`, slip || '');
  ok(!/賞与|ボーナス|\bbonus/.test(low), `renewal/${k}: 賞与のことを書いていない`);
  const over = OVERCLAIM.find((re) => re.test(body));
  ok(!over, `renewal/${k}: 特定されないと言い切っていない`, over ? String(over) : '');
  const stray = NAMES.find((n) => hitsName(body, n));
  ok(!stray, `renewal/${k}: 航空会社名が1つも入っていない`, stray || '');
}

/* ★勧誘の言い回しが入っていないこと。ここが入ると広告宣伝メールになる。 */
for (const [k, b] of RNALL) {
  const low = (b.html + b.subject + b.text).toLowerCase();
  const hit = SOLICIT.find((w) => low.includes(w.toLowerCase()));
  ok(!hit, `renewal/${k}: 勧誘の言い回しが入っていない`, hit || '');
  ok(!/pay-report\.html/.test(b.html + b.text), `renewal/${k}: 給与フォームへの導線が無い`);
}

/* ★数字が1つも出ないこと。原稿に件数も人数も無い＝あとから足したらここで落ちる
   （会員の規模が読める数字を、このメールに紛れ込ませない）。 */
for (const [k, b] of RNALL) {
  const visible = b.html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ');
  for (const [what, src] of [['文字版', b.subject + '\n' + b.text], ['HTML の見える文字', visible]]) {
    const nums = [...new Set(String(src).match(/\d+/g) || [])];
    ok(nums.length === 0, `renewal/${k}: ${what}に数字が1つも無い`, nums.join(','));
  }
}

/* ★行き先。日本語はトップページ、英語は /en/（2026-09-24 オーナー指示）。 */
{
  const bJa = buildRenewal(RN.ja, O), bEn = buildRenewal(RN.en, O_EN);
  ok(bJa.topUrl === 'https://pilot-value.com/', 'renewal: 日本語の人はトップページへ', bJa.topUrl);
  ok(bEn.topUrl === 'https://pilot-value.com/en/', 'renewal: 英語の人は /en/ へ', bEn.topUrl);
  ok(bJa.text.includes('▶ https://pilot-value.com/\n'), 'renewal/ja: 文字版に原稿どおりの ▶ の行がある');
  ok(bEn.text.includes('▶ https://pilot-value.com/en/'), 'renewal/en: 文字版の ▶ の行も /en/');
  ok(!/\/en\//.test(bJa.text), 'renewal/ja: 日本語の人の本文に英語版の URL が混ざらない');
}
for (const [k, b] of RNALL) {
  const langs = b.lang === 'both' ? ['ja', 'en'] : [b.lang];
  const btn = (b.html.match(/background:#f5c842/g) || []).length;
  ok(btn === langs.length, `renewal/${k}: 押すボタンは言語ごとに1つだけ`, String(btn));
}

/* ★招待のリンク。入口は invite.html の1枚だけ・追跡用の印を付けない。 */
for (const [k, b] of RNALL) {
  const langs = b.lang === 'both' ? ['ja', 'en'] : [b.lang];
  const n = (b.html.match(/invite\.html/g) || []).length;
  ok(n === langs.length, `renewal/${k}: 招待のリンクが言語ごとに1つ`, String(n));
  ok(b.text.includes('/invite.html'), `renewal/${k}: 文字版にも招待の URL がある（アンカーが無いため）`);
  ok(!/invite\.html[?#]/.test(b.html + b.text), `renewal/${k}: 招待の URL に追跡用の印が付いていない`);
  ok(b.html.includes('>INVITE</a>'), `renewal/${k}: 本文の「INVITE」の文字がそのままリンク`);
}
ok(buildRenewal(RN.ja, O).text.includes('/invite.html')
   && !buildRenewal(RN.ja, O).text.includes('/en/invite.html'),
   'renewal: 日本語の人は日本語の招待ページへ');
ok(buildRenewal(RN.en, O_EN).text.includes('/en/invite.html'), 'renewal: 英語の人は英語の招待ページへ');

/* ★招待に添えた1文は pv-referral.js からそのまま借りたもの。
   画面の言い方を変えたらここが落ちる＝メールだけが古い約束を語り続けない。 */
{
  const REF = read('pv-referral.js');
  const jaNote = '招待した相手が誰かは、こちらでは分かりません。あなたの給与も相手には見えません。';
  const enNote = 'We never tell you who accepted an invitation, and they never see your pay.';
  ok(REF.includes('招待した相手が誰かは、こちらでは分かりません。')
     && REF.includes('あなたの給与も相手には見えません。'),
     'renewal: 日本語の但し書きが pv-referral.js と同じ文');
  ok(REF.includes('We never tell you who accepted an invitation,')
     && REF.includes('and they never see your pay.'),
     'renewal: 英語の但し書きが pv-referral.js と同じ文');
  ok(buildRenewal(RN.ja, O).text.includes(jaNote), 'renewal/ja: その但し書きが本文にある');
  ok(buildRenewal(RN.en, O_EN).text.includes(enNote), 'renewal/en: その但し書きが本文にある');
}

/* ★原稿に無いものを足していない。 */
for (const [k, b] of RNALL) {
  ok(!/<h[1-6]|<li|<ul|<ol/i.test(b.html), `renewal/${k}: 見出しも箇条書きも足していない`);
  ok(!/<img/i.test(b.html), `renewal/${k}: 画像を使っていない`);
}
/* 原稿の書き出し・結び・署名が1文字違わず入っている。 */
{
  const bJa = buildRenewal(RN.ja, O), bEn = buildRenewal(RN.en, O_EN);
  ok(bJa.subject === 'PILOT VALUEのトップページが新しくなりました ✈️',
     'renewal/ja: 原稿どおりの件名', bJa.subject);
  ok(bEn.subject === 'A new look for PILOT VALUE ✈️', 'renewal/en: 原稿どおりの件名', bEn.subject);
  ok(bJa.text.startsWith('PILOT VALUEをご利用いただき、ありがとうございます。'),
     'renewal/ja: 原稿どおりの書き出し');
  ok(bJa.text.includes('このたび、トップページをリニューアルしました！'),
     'renewal/ja: 原稿どおりの知らせ');
  ok(bJa.text.includes('これからも改善を続けていきますので、引き続きよろしくお願いいたします。'),
     'renewal/ja: 原稿どおりの結び');
  ok(bEn.text.startsWith('Thank you for being part of PILOT VALUE.'),
     'renewal/en: 原稿どおりの書き出し');
  ok(bEn.text.includes("Thank you for being part of this journey. We're just getting started."),
     'renewal/en: 原稿どおりの結び');
  for (const [k, b] of RNALL) {
    ok(b.text.includes('PILOT VALUE Team') && b.text.includes("Pilot defines. Pilot's value."),
       `renewal/${k}: 原稿どおりの署名とタグラインが入っている`);
  }
}

/* 解除の導線。全員に送るぶん、欠けたときの傷が深い。 */
for (const [k, b] of RNALL) {
  ok(b.unsubUrl.includes(RN[k].unsub_token), `renewal/${k}: 解除リンクがその人のトークンを持っている`);
  ok(b.html.includes(b.unsubUrl), `renewal/${k}: HTML 版に解除リンクがある`);
  ok(b.text.includes(b.unsubUrl), `renewal/${k}: 文字版にも解除リンクがある`);
  ok(/functions\/v1\/remind-payslip\?u=/.test(b.oneClickUrl), `renewal/${k}: ワンクリック解除の宛先がある`);
  ok(!/希望|opted in|opt-in/i.test(b.text), `renewal/${k}: 「希望した方に」と書いていない（全員に送るため）`);
  ok(/お知らせとしてお送り|service notice/i.test(b.text), `renewal/${k}: 全員に送る理由を正直に書いている`);
}
{
  const b = buildRenewal(RN.both, O);
  ok(b.html.includes('/unsubscribe.html') && b.html.includes('/en/unsubscribe.html'),
     'renewal/both: 解除リンクが日英2本ある');
}

/* ★このメールだけ英語が上・日本語が下（2026-09-24 オーナー指示の語順
   「それ以外には英語と日本語で」）。受け取るのは日本の会員以外だけ。 */
{
  const b = buildRenewal(RN.both, O);
  /* ★このメールは日本語の1文目も「PILOT VALUE」で始まる。だから
     「最初の英字」で向きを見ると誤判定する（実際にした）。
     日英それぞれの書き出しの位置で見る。 */
  const jaAt = b.text.indexOf('PILOT VALUEをご利用いただき、ありがとうございます。');
  const enAt = b.text.indexOf('Thank you for being part of PILOT VALUE.');
  ok(jaAt >= 0 && enAt >= 0 && enAt < jaAt, 'renewal/both: 英語が上・日本語が下', `en@${enAt} ja@${jaAt}`);
  ok(b.html.includes('日本語は下に続きます。'), 'renewal/both: 仕切りが「日本語は下に続きます。」');
  ok(!b.html.includes('English follows.'), 'renewal/both: 逆向きの仕切りが残っていない');
  ok(b.subject.startsWith('A new look for PILOT VALUE'), 'renewal/both: 件名も英語が先', b.subject);
}

/* ★送り分け ── 日本の会員だけ日本語1本、それ以外は全員 日英ともに1通
   （2026-09-24 オーナー指示）。海外の会員に英語だけを送らない
   ── 海外在住の日本人パイロットが読めない1通を受け取らないため。 */
{
  ok(typeof renewalLangOf === 'function' && renewalLangOf !== updateLangOf,
     'renewal: update とは別の送り分け（あちらは海外に英語だけを送る）');
  ok(buildRenewal({ ...RN.both, airline_region: 'mideast' }, O).lang === 'both',
     'renewal: 勤務先が海外の航空会社なら英語と日本語');
  ok(buildRenewal({ name: 'James Carter', country: 'United States', unsub_token: 'x' }, O).lang === 'both',
     'renewal: 居住国が海外の人にも日本語を付ける（英語だけにしない）');
  ok(buildRenewal({ ...RN.both, airline_region: 'japan' }, O).lang === 'ja',
     'renewal: 勤務先が日本の航空会社なら日本語だけ');
  ok(buildRenewal({ ...RN.ja, airline_region: 'mideast' }, O).lang === 'ja',
     'renewal: 氏名から分かる日本の人は勤務先で上書きしない');
  ok(buildRenewal(RN.both, O).lang === 'both',
     'renewal: 居住国も勤務先も分からない人にも日英ともに1通');
  ok(new Set([RN.ja, RN.en, RN.both, { ...RN.both, airline_region: 'japan' }]
      .map((p) => buildRenewal(p, O).lang)).size === 2,
     'renewal: 出来上がる版は「日本語だけ」と「英語＋日本語」の2つしかない');
}
ok(/[぀-ヿ一-鿿]/.test(buildRenewal(RN.en, O).text), 'renewal: 英語の人の1通にも日本語が入っている');

/* ★1種類しか作れないこと。提出の有無で文面を割ると、割った側が必ず勧誘になる。 */
{
  const a = buildRenewal({ name: '高橋 蓮', country: '日本', unsub_token: 'x' }, O);
  const b = buildRenewal({ name: '高橋 蓮', country: '日本', unsub_token: 'x',
    pay_report_count: 9, review_count: 4, founding_no: 7 }, O);
  ok(a.html === b.html && a.subject === b.subject,
     'renewal: 提出の有無を渡しても本文が変わらない（1種類しか作れない）');
}

/* 氏名を出さない（①④⑤⑥と同じ理由）。 */
for (const [k, b] of RNALL) {
  const nm = String(RN[k].name).split(/\s+/).filter((w) => w.length >= 2);
  const hit = nm.find((w) => (b.subject + b.html + b.text).includes(w));
  ok(!hit, `renewal/${k}: 氏名が件名にも本文にも出ない`, hit || '');
}
{
  const evil = buildRenewal({ name: '<script>x</script>', country: '日本', unsub_token: 't' }, O);
  ok(!evil.html.includes('<script>') && !evil.html.includes('&lt;script&gt;'),
     'renewal: 氏名に入れられたタグが本文に出ない');
  const anon = buildRenewal({ name: null, country: null, unsub_token: 't' }, O);
  ok(anon.html.length > 500 && !/null|undefined/.test(anon.text), 'renewal: 氏名が空でも本文が壊れない');
}

/* 件名の長さ。 */
for (const [k, b] of RNALL) ok(b.subject.length <= 78, `renewal/${k}: 件名が 78 文字以内（${b.subject.length}）`);


/* ════════ ⑧ 週に一度の新着まとめ ════════════════════════════════
   buildDigest()。**これだけが繰り返し送るメール**で、送り先は
   email_opt_in = true の人だけ。①〜⑦とは足元の文言も違う。

   ・★1件しか入らなかった会社の名前を出さない（その1人が誰か絞られる）
   ・★口コミの本文を1文字も載せない。鍵の無い人にサイトが見せるのは先頭40字なので、
     メールに抜粋を載せると**メールが錠前を迂回する**（作り直す前の digest は140字を
     載せていた。一度も送っていないので実害は無い）
   ・★金額・職位・機材を載せない。数えるのは件数だけ
   ・★3件未満の週は送らない（send.mjs の門も一緒に見る）
   ════════════════════════════════════════════════════════════════ */
console.log('\n── ⑧ 週に一度の新着まとめ ──');

const DG = {
  ja:       { name: '高橋 蓮',     country: '日本', unsub_token: 'dg-ja' },
  overseas: { name: 'Alex Mercer', country: 'UAE',  unsub_token: 'dg-en' },
  both:     { name: 'Ren Aoki',    country: null,   unsub_token: 'dg-both' },
};
/* ★数えるのは本物の digestStats。ここで数え直さない。 */
const dgRows = {
  pay: [{ airline: 'ana' }, { airline: 'ana' }, { airline: 'jal' }, { airline: 'emirates' }],
  reviews: [{ airline: 'ana' }, { airline: 'cathay-pacific' }, { airline: 'cathay-pacific' }],
};
const DGST = digestStats(dgRows);
const DGO = { ...O, stats: DGST };
const DGALL = Object.entries(DG).map(([k, x]) => [k, buildDigest(x, DGO)]);

/* 数え方そのもの。 */
{
  ok(DGST.pay === 4 && DGST.reviews === 3 && DGST.total === 7, 'digest: 年収と口コミを別々に数えて合計も出す',
     JSON.stringify(DGST));
  const slugs = DGST.airlines.map((a) => a.slug);
  ok(slugs.includes('ana') && slugs.includes('cathay-pacific'),
     'digest: 2件以上入った会社は名前を出す候補になる', slugs.join(','));
  ok(!slugs.includes('jal') && !slugs.includes('emirates'),
     'digest: ★1件しか入らなかった会社は候補に入れない（その1人が絞られる）', slugs.join(','));
  ok(DIGEST_NAME_MIN >= 2, `digest: 名前を出す下限が2件以上（${DIGEST_NAME_MIN}）`);
  /* ★3件以下は送らない（2026-09-24 オーナー指示）。下げるとオーナーの指示を破る。 */
  ok(DIGEST_MIN === 4, `digest: 3件以下の週は送らない（下限 ${DIGEST_MIN}件＝4件以上でだけ出す）`);
  const many = digestStats({ pay: Array.from({ length: 40 }, (_, i) => ({ airline: `a${i % 20}` })).concat(
    Array.from({ length: 40 }, (_, i) => ({ airline: `a${i % 20}` }))) });
  ok(many.airlines.length <= DIGEST_NAME_MAX, `digest: 並べる社の数に上限がある（${many.airlines.length} ≦ ${DIGEST_NAME_MAX}）`);
  /* ★同じ週を二度数えたら同じ並びになる（人によって順番が変わらない）。 */
  ok(JSON.stringify(digestStats(dgRows)) === JSON.stringify(DGST), 'digest: 同じ週なら何度数えても同じ結果');
}

/* ★本文に入れてはいけないもの。①④⑤⑦と同じ物差しを当てる。 */
for (const [k, b] of DGALL) {
  const body = b.html + '\n' + b.subject + '\n' + b.text;
  const money = MONEY.find(([re]) => re.test(body));
  ok(!money, `digest/${k}: 金額が1つも入っていない`, money ? `${money[1]} → ${body.match(money[0])[0]}` : '');
  const low = body.toLowerCase();
  const ded = DEDUCT.find((w) => low.includes(w.toLowerCase()));
  ok(!ded, `digest/${k}: 控除の項目名が入っていない`, ded || '');
  const slip = SLIP.find((w) => low.includes(w.toLowerCase()));
  ok(!slip, `digest/${k}: 明細の項目名が入っていない`, slip || '');
  const over = OVERCLAIM.find((re) => re.test(body));
  ok(!over, `digest/${k}: 特定されないと言い切っていない`, over ? String(over) : '');
  const hit = SOLICIT.find((w) => low.includes(w.toLowerCase()));
  ok(!hit, `digest/${k}: 勧誘の言い回しが入っていない`, hit || '');
  ok(!/pay-report\.html/.test(b.html + b.text), `digest/${k}: 給与フォームへの導線が無い`);
  ok(!/機長|副操縦士|\bcaptain\b|\bfirst officer\b|\b[AB]\d{3}\b/i.test(body),
     `digest/${k}: 職位も機材も書いていない（1件ごとの姿に近づけない）`);
}

/* ★口コミの本文も、本人の自由入力も、1文字も運ばれないこと。
   digestStats は airline しか見ない ── 余計な列を渡しても本文に出てこない。 */
{
  const dirty = digestStats({
    pay: [{ airline: 'ana', airline_other: 'ヒミツ航空', gross_monthly: 1234567, position: 'captain' },
          { airline: 'ana', airline_other: 'ヒミツ航空' }],
    reviews: [{ airline: 'ana', culture_comment: 'これは口コミの本文です', salary_comment: '秘密の待遇' },
              { airline: 'zzz-not-in-table' }],
  });
  const b = buildDigest(DG.both, { ...O, stats: dirty });
  const body = b.html + b.subject + b.text;
  for (const bad of ['ヒミツ航空', 'これは口コミの本文です', '秘密の待遇', '1234567', 'captain', 'zzz-not-in-table']) {
    ok(!body.includes(bad), `digest: 「${bad}」が本文に出てこない`);
  }
  ok(dirty.pay === 2 && dirty.reviews === 2, 'digest: 表に無いコードも件数には数える（数だけは正しい）');
  ok(dirty.airlines.every((a) => a.slug !== 'zzz-not-in-table'),
     'digest: 表に無いコードの名前は出さない');
}

/* ★足元の文言が①〜⑦と逆＝「希望した方に」。繰り返し届くメールだから。 */
for (const [k, b] of DGALL) {
  ok(/希望|you asked for/i.test(b.text), `digest/${k}: 「通知を希望した方に」と書いている（繰り返し届くため）`);
  ok(!/お知らせとしてお送りしています/.test(b.text), `digest/${k}: 全員宛の足元の文言が混ざっていない`);
  ok(b.unsubUrl.includes(DG[k].unsub_token), `digest/${k}: 解除リンクがその人のトークンを持っている`);
  ok(b.html.includes(b.unsubUrl) && b.text.includes(b.unsubUrl), `digest/${k}: 日英どちらの版にも解除リンクがある`);
  ok(/functions\/v1\/remind-payslip\?u=/.test(b.oneClickUrl), `digest/${k}: ワンクリック解除の宛先がある`);
  ok(b.subject.length <= 78, `digest/${k}: 件名が 78 文字以内（${b.subject.length}）`);
}

/* ★送り分けと並びは renewal と同じ（日本の会員は日本語・それ以外は英語＋日本語）。 */
{
  ok(digestLangOf === renewalLangOf, 'digest: 送り分けは renewal と同じ判定を使っている');
  ok(buildDigest(DG.ja, DGO).lang === 'ja', 'digest: 日本の会員は日本語だけ');
  ok(buildDigest(DG.overseas, DGO).lang === 'both', 'digest: 海外の会員は英語と日本語');
  ok(buildDigest(DG.both, DGO).lang === 'both', 'digest: 手がかりが無い人も英語と日本語');
  const b = buildDigest(DG.both, DGO);
  const enAt = b.text.indexOf('Thank you for being part of PILOT VALUE.');
  const jaAt = b.text.indexOf('PILOT VALUEをご利用いただき、ありがとうございます。');
  ok(enAt >= 0 && jaAt >= 0 && enAt < jaAt, 'digest/both: 英語が上・日本語が下', `en@${enAt} ja@${jaAt}`);
}

/* ★行き先は REAL PAY。英語の面は /en/。 */
{
  const bJa = buildDigest(DG.ja, DGO), bEn = buildDigest(DG.overseas, { ...DGO, lang: 'en' });
  ok(bJa.dataUrl === 'https://pilot-value.com/actual-pay.html', 'digest: 日本語の人は REAL PAY へ', bJa.dataUrl);
  ok(bEn.dataUrl === 'https://pilot-value.com/en/actual-pay.html', 'digest: 英語の人は /en/ の REAL PAY へ', bEn.dataUrl);
  ok(!/\/en\//.test(bJa.text), 'digest/ja: 日本語だけの人の本文に英語版の URL が混ざらない');
  for (const [k, b] of DGALL) {
    const langs = b.lang === 'both' ? 2 : 1;
    ok((b.html.match(/background:#f5c842/g) || []).length === langs, `digest/${k}: 押すボタンは言語ごとに1つだけ`);
    ok(!/<h[1-6]|<img/i.test(b.html), `digest/${k}: 見出しも画像も足していない`);
  }
}

/* ★0件の行は出さない（「新しい口コミ 0件」と書かれた1通を送らない）。 */
{
  const quiet = digestStats({ pay: [{ airline: 'ana' }, { airline: 'jal' }, { airline: 'delta' },
                                    { airline: 'united-airlines' }], reviews: [] });
  const b = buildDigest(DG.overseas, { ...O, stats: quiet });
  ok(!/0件|\b0 review/.test(b.text), 'digest: 0件の行を書かない', b.text.slice(0, 120));
  ok(!/1 reviews|1 pay reports/.test(b.text + b.subject), 'digest: 英語の単複が正しい（1 review）');
  ok(!/複数の投稿があった|more than one new entry/.test(b.text),
     'digest: 名前を出せる社が無い週は、その見出しごと出さない');
  ok(b.subject.includes('4'), 'digest: 一番静かな週（下限ちょうど）でも件数は出る', b.subject);
}

/* ★送信側の門。ここが外れると「1件の週に1通」や「全員へ毎週」が起きる。 */
{
  const S = read('mail-bot/send.mjs');
  ok(/stats\.total\s*<\s*DIGEST_MIN/.test(S), 'digest/send: 少ない週は送らない門がある');
  ok(/\['email_opt_in',\s*'eq\.true'\]/.test(S.slice(S.indexOf('async function runDigest'))),
     'digest/send: 送るのは通知を希望した人だけ');
  ok(!/state\.lastDigestAt = nowIso;[\s\S]{0,40}$/m.test('') && /sent > 0.*lastDigestAt/.test(S),
     'digest/send: 1通も出せなかった週に基準時刻を進めない');
  ok(/MODE === 'digest'/.test(S), 'digest/send: 既定は「送らない」側にある（--send が要る）');
  const runDigest = S.slice(S.indexOf('async function runDigest'), S.indexOf('async function runDigest') + 4000);
  ok(!/culture_comment|salary_comment|wlb_comment|gross_monthly|annual_salary|monthly_salary/.test(runDigest),
     'digest/send: 口コミ本文も金額の列も取ってこない');
  ok(!/→ \$\{m\.email\}|console\.log\(`.*m\.email/.test(runDigest), 'digest/send: 宛先を画面に出さない');
}

console.log(`\n${pass} pass / ${fail} fail\n`);
process.exit(fail ? 1 : 0);
