/* ════════════════════════════════════════════════════════════════
   welcome-member — 登録した会員に、1人1回だけ歓迎のメールを送る（2026-11-06）

   中身：登録のお礼／PILOT VALUE をつくる理由／Give & Get の仕組み／給与を匿名で1件のお願い。
   ★日本語の文はオーナーが書いたもの（2026-11-07）。書き直さない。英語・スペイン語はその訳。

   ── 誰に送るか（決めるのは SQL の pv_welcome_due の1か所）────────
     ・登録を終えた人（居住国・在籍企業・職位が入っている）
     ・通知を希望した人（email_opt_in = true）。登録画面の既定はオンなので、ほとんどの人に届く。
       ★外した人には送らない（届いて困るものを、断った人に送らない）
     ・登録から72時間以内。★古い会員には送らない（この関数を初めて動かした日に、
       今までの会員全員へ「ご登録ありがとうございます」が飛ばない）
     ・1人1回。送れたら pv_welcome_mail に記録し、二度と選ばれない。
       送れなかった人は3回まで試す（壊れたアドレスに10分おきに打ち続けない）。

   ── 何語で送るか（welcomeLangOf）──────────────────────────
     登録した画面の言語（profiles.lang）で決める。
       日本語のページ → 日本語 ／ スペイン語のページ → スペイン語
       英語のページ → 英語が上・日本語が下（週まとめと同じ決まり：2026-09-24 オーナー
         「日本の会員は日本語だけ・それ以外は全員 英語と日本語を1通に」）
     言語が残っていない人は、週まとめ（weekly-digest の digestLangOf）と同じ推測をする。
     ★推測の部分は写し。db/test-welcome.mjs が両方に同じ人を通して突き合わせている。

   ── 文面のきまり ────────────────────────────────────────────
     ★文面はこのファイルが唯一の正。mail-bot/send.mjs（自分宛ての下見）と
       shot-remind.mjs --welcome（絵）はここを import する。写しを作らない。
     ★「90日間」はサイトの登録完了画面と同じ日数。サイトの日数を変えたら、ここも変える
       ── db/test-welcome.mjs が突き合わせて落ちる。
     ★ボタンは1つだけ。ふつうは給与（2026-09-15 オーナー：登録の次にやることは給与ひとつ）。
       ★もう給与を出した人（SQL の gave_pay）には、お願いを口コミに替える（2026-11-07 オーナー
         「口コミへの誘導にする」）。給与フォームから入る人はこちらになることが多い。
     ★「このメールに返信」は info@ に届く（reply_to）。★返事は info@ から出す
       （Gmail からそのまま返すと個人のアドレスが相手に渡る。mail-bot/README.md の「返信経路」）。
     ★運営者の名前・経歴・勤務先を書かない（公開リポジトリ・身元を守る）。署名は PILOT VALUE Team。
     ★数字（掲載社数・会員数など）を書かない。日が経つと嘘になる。
     ★DEEP PAY・VERIFIED PAY など、今ひらいていないものを約束しない。
     ★宛名を書かない（受信箱と Resend の送信ログに「このアドレス＝この氏名」を残さない）。
     絵で見る: node shot-remind.mjs --welcome

   ── デプロイ（オーナー作業）────────────────────────────────
   Supabase → Edge Functions → Deploy a new function → Via Editor
     関数名: welcome-member ／ このファイルの中身を貼り付け → Deploy
   ★ Verify JWT は OFF（pg_cron は JWT を持たない）。入口は x-pv-cron-secret で塞いである。
   そのあと db/welcome-mail.sql を SQL Editor に貼る（10分おきの時計もそこで入る）。

   必要な secret（週まとめと同じもの。新しく入れるものは無い）:
     RESEND_API_KEY   … 必須
     PV_CRON_SECRET   … 必須。★未設定なら送らずに 503 を返す
     FROM_EMAIL / SITE_URL / ADMIN_EMAIL … 任意
     PV_WELCOME_MAX   … 任意。1回で送る上限。既定 50
   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で入れる。

   ── 入口 ───────────────────────────────────────────────────
     POST / + header x-pv-cron-secret              … 送る（pg_cron が10分おきに叩く）
     POST / + header ... + {"dry":true}            … 送らずに、送る相手の人数だけ返す
   ★配信停止は remind-payslip が受け持つ（List-Unsubscribe もあちら）。口を増やさない。
   ════════════════════════════════════════════════════════════════ */

// deno-lint-ignore no-explicit-any
const DENO = (globalThis as any).Deno;
const env = (k: string, d = '') => (DENO?.env?.get(k) ?? d) as string;

const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_ROLE = env('SUPABASE_SERVICE_ROLE_KEY');
const RESEND_KEY = env('RESEND_API_KEY');
const CRON_SECRET = env('PV_CRON_SECRET');
const FROM_EMAIL = env('FROM_EMAIL', 'PILOT VALUE <noreply@pilot-value.com>');
const SITE_URL = env('SITE_URL', 'https://pilot-value.com').replace(/\/+$/, '');
const ADMIN_EMAIL = env('ADMIN_EMAIL', 'info@pilot-value.com');
const MAX_PER_RUN = Math.max(1, Math.min(Number(env('PV_WELCOME_MAX', '50')) || 50, 200));

export type Lang = 'ja' | 'en' | 'es';
export type Person = {
  id?: string; email?: string; name?: string | null; country?: string | null;
  airline_region?: string | null; lang?: string | null; unsub_token?: string;
  gave_pay?: boolean | null;
};

/* ── 誰に何語で ─────────────────────────────────────────── */
export function welcomeLangOf(p: Person): Lang | 'both' {
  const l = String(p?.lang ?? '').trim().toLowerCase();
  if (l === 'ja') return 'ja';
  if (l === 'es') return 'es';
  if (l === 'en') return 'both';
  /* ↓ 言語が残っていない人。weekly-digest の digestLangOf と同じ答え（写し）。 */
  const nameJa = /[぀-ヿ一-鿿]/.test(String(p?.name ?? ''));
  const country = String(p?.country ?? '').trim();
  if (nameJa) return 'ja';
  if (country) return country === '日本' ? 'ja' : 'both';
  return String(p?.airline_region ?? '').trim().toLowerCase() === 'japan' ? 'ja' : 'both';
}

/* ★日英を1通に入れるときは英語が上（2026-08-23 オーナー判断。ほかのメールと同じ）。 */
const BOTH_ORDER: Lang[] = ['en', 'ja'];

/* ── 行き先 ─────────────────────────────────────────────────
   スペイン語のページがある画面だけ es/。無い画面は英語のページへ
   （gen-lang.mjs と同じ扱い）。db/test-welcome.mjs が、行き先のファイルが
   リポジトリに本当にあるかを見ている。 */
const ES_PAGES = new Set(['pay-report.html', 'submit-review.html']);
export function pagePath(l: Lang, page: string) {
  if (l === 'ja') return page;
  if (l === 'es' && ES_PAGES.has(page.split('#')[0])) return 'es/' + page;
  return 'en/' + page;
}

type Link = { label: string; href: string };
export type WelcomeCopy = {
  subject: string;
  lead: string[];        // 冒頭の2行（1行目は太字）
  body: string[][];      // 段落のまとまり（まとまりの間だけ少し広く空ける）
  ask: { thanks?: string; lead: string; t: string; cta: Link; note: string };
  close: string[];
  sign: string;
  foot: string;
  unsub: string;
};

/* ── 文面 ────────────────────────────────────────────────────
   ★日本語はオーナーが書いた文（2026-11-07）。1文字も変えない・足さない。
     英語とスペイン語は、その文の訳（パイロットが使う言葉で）。
   ★「90日間」はサイトの登録完了画面の字と同じ日数（db/test-welcome.mjs が突き合わせる）。 */
export function welcomeCopy(l: Lang, site = SITE_URL, gavePay = false): WelcomeCopy {
  const pay = `${site}/${pagePath(l, 'pay-report.html#ps')}`;
  const review = `${site}/${pagePath(l, 'submit-review.html')}`;
  /* もう給与を出した人へのお願い（口コミ）。囲みの中だけを差し替える。 */
  const REVIEW_ASK = {
    ja: {
      thanks: '給与の共有、ありがとうございます。',
      lead: '次は、あなたの会社の口コミを匿名で1件、共有してください。',
      t: '投稿すると、他のパイロットから寄せられた口コミをすべて閲覧できます。',
      cta: { label: '匿名で口コミを投稿', href: review },
      note: '投稿者の名前やメールアドレスは表示されません。',
    },
    en: {
      thanks: 'Thank you for sharing your pay.',
      lead: 'Next, share one review of your airline, anonymously.',
      t: 'Once you do, you can read all the reviews other pilots have shared.',
      cta: { label: 'Write a review anonymously', href: review },
      note: 'Your name and email address are never shown with your review.',
    },
    es: {
      thanks: 'Gracias por compartir tu remuneración.',
      lead: 'Ahora, comparte una reseña de tu aerolínea de forma anónima.',
      t: 'Al hacerlo, podrás leer todas las reseñas que han compartido otros pilotos.',
      cta: { label: 'Escribe una reseña de forma anónima', href: review },
      note: 'Tu nombre y tu correo electrónico nunca se muestran junto a tu reseña.',
    },
  }[l];
  const pick = (payAsk: WelcomeCopy['ask']) => (gavePay ? REVIEW_ASK : payAsk);

  if (l === 'ja') {
    return {
      subject: 'PILOT VALUEへようこそ。ご登録ありがとうございます',
      lead: ['PILOT VALUEへようこそ。', 'ご登録ありがとうございます。'],
      body: [
        [
          'どの会社で飛ぶかで、収入も、休みも、家族と過ごす時間も変わります。',
          'その判断に必要な給与の内訳や勤務の実態には、入社して初めて分かることがあります。航空会社が把握している情報と、入社を考えるパイロットが手にできる情報には、差があるからです。',
          '私たちは、この情報の非対称性をなくしたい。',
          '実際の待遇を知ったうえで、自分のキャリアを選べるように。そして、パイロットを大切にする航空会社が、正当に評価され、選ばれるように。',
          'それが、私たちがPILOT VALUEをつくる理由です。',
        ],
        [
          'そのための情報を持っているのは、現場で働くパイロットです。',
          '一人ひとりが知っている給与や働き方を匿名で持ち寄り、会社を越えて比較できる形にする。',
          '情報を共有した人が、他のパイロットの情報も知ることができる。このGive & Getを基本に、確かな判断に役立つデータを積み重ねていきます。',
          'PILOT VALUEは、そのための給与・待遇データベースです。',
        ],
      ],
      ask: pick({
        lead: 'まずは、あなたの給与を匿名で1件、共有してください。',
        t: '投稿すると、他のパイロットから寄せられた給与データを90日間閲覧できます。',
        cta: { label: '匿名で給与を追加する', href: pay },
        note: '氏名・社員番号・口座情報など、個人を直接特定する情報は公開しません。',
      }),
      close: [
        '使ってみて気づいたことや、知りたい情報があれば、このメールに返信してください。',
        'ご参加いただき、ありがとうございます。',
      ],
      sign: 'PILOT VALUE Team',
      foot: 'このメールは、PILOT VALUE にご登録いただき、通知を希望された方にお送りしています。',
      unsub: '配信を停止する',
    };
  }
  if (l === 'es') {
    return {
      subject: 'Te damos la bienvenida a PILOT VALUE: gracias por registrarte',
      lead: ['Te damos la bienvenida a PILOT VALUE.', 'Gracias por registrarte.'],
      body: [
        [
          'La aerolínea en la que vuelas define tus ingresos, tus días libres y el tiempo que pasas con tu familia.',
          'Pero parte de lo que necesitas para tomar esa decisión, como el desglose real de la remuneración o cómo es de verdad el trabajo, solo se descubre después de entrar. Hay una diferencia entre la información que tiene la aerolínea y la que puede conseguir un piloto que piensa unirse a ella.',
          'Queremos acabar con esa asimetría de información.',
          'Para que puedas elegir tu carrera conociendo las condiciones reales. Y para que las aerolíneas que cuidan a sus pilotos reciban el reconocimiento que merecen y sean las elegidas.',
          'Por eso estamos construyendo PILOT VALUE.',
        ],
        [
          'Esa información la tienen los pilotos en activo.',
          'Cada piloto aporta de forma anónima lo que sabe sobre su remuneración y sus condiciones de trabajo, y lo convertimos en datos que se pueden comparar entre aerolíneas.',
          'Quien comparte su información puede ver la de otros pilotos. Con este Give & Get como base, vamos sumando datos que ayudan a tomar decisiones con fundamento.',
          'PILOT VALUE es la base de datos de remuneración y condiciones de trabajo creada para eso.',
        ],
      ],
      ask: pick({
        lead: 'Para empezar, comparte un registro de tu remuneración de forma anónima.',
        t: 'Al hacerlo, podrás ver durante 90 días los datos de remuneración que han compartido otros pilotos.',
        cta: { label: 'Agrega tu remuneración de forma anónima', href: pay },
        note: 'Nunca publicamos tu nombre, tu número de empleado, tus datos bancarios ni ningún otro dato que te identifique directamente.',
      }),
      close: [
        'Si notas algo al usar el sitio o hay información que te gustaría encontrar, responde a este correo.',
        'Gracias por unirte.',
      ],
      sign: 'PILOT VALUE Team',
      foot: 'Recibes este correo porque te registraste en PILOT VALUE y pediste recibir notificaciones.',
      unsub: 'Cancelar la suscripción',
    };
  }
  return {
    subject: 'Welcome to PILOT VALUE — thank you for signing up',
    lead: ['Welcome to PILOT VALUE.', 'Thank you for signing up.'],
    body: [
      [
        'The airline you fly for shapes your pay, your days off and the time you spend with your family.',
        "Yet some of what you need to make that call, like how the pay really breaks down or what the flying is actually like, you only find out after you join. That's because there is a gap between what an airline knows and what a pilot thinking of joining it can find out.",
        'We want to end that information asymmetry.',
        'So that you can choose your career knowing the real terms and conditions. And so that airlines that look after their pilots are recognized fairly, and chosen.',
        "That's why we are building PILOT VALUE.",
      ],
      [
        'The people who hold that information are the pilots out there flying the line.',
        'Each pilot brings what they know about their pay and working conditions, anonymously, and we turn it into data you can compare across airlines.',
        'Those who share can see what other pilots have shared. With this Give & Get at its core, we keep building data that supports sound decisions.',
        'PILOT VALUE is the pay and conditions database built for exactly that.',
      ],
    ],
    ask: pick({
      lead: 'To start, share one pay record, anonymously.',
      t: 'Once you do, you can view the pay data other pilots have shared for 90 days.',
      cta: { label: 'Add your pay anonymously', href: pay },
      note: 'We never publish your name, staff number, bank details or anything else that directly identifies you.',
    }),
    close: [
      'If you notice anything while using the site, or there is information you would like to see, just reply to this email.',
      'Thank you for joining us.',
    ],
    sign: 'PILOT VALUE Team',
    foot: 'You are receiving this because you signed up for PILOT VALUE and asked for notifications.',
    unsub: 'Unsubscribe',
  };
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/* 仕切りの一言は「次に来る言語」で決める（週まとめと同じ）。 */
const dividerFor = (next: Lang) => `
    <div style="margin:6px 0 26px;border-top:1px solid #e6e9ef"></div>
    <p style="margin:0 0 18px;color:#9aa5b1;font-size:11px">${next === 'ja' ? '日本語は下に続きます。' : 'English follows.'}</p>`;

/* p = 送る相手 ／ o = { siteUrl, supabaseUrl, lang } */
export function buildWelcome(p: Person, o: { siteUrl?: string; supabaseUrl?: string; lang?: Lang | 'both' } = {}) {
  const site = String(o.siteUrl ?? SITE_URL ?? 'https://pilot-value.com').replace(/\/+$/, '');
  const sb = String(o.supabaseUrl ?? SUPABASE_URL ?? '').replace(/\/+$/, '');
  const lang = o.lang || welcomeLangOf(p);
  const langs: Lang[] = lang === 'both' ? BOTH_ORDER : [lang];
  const tok = encodeURIComponent(p?.unsub_token || '');
  /* 解除の画面はスペイン語版が無いので英語のページ。 */
  const unsubPage = (l: Lang) => `${site}/${pagePath(l, 'unsubscribe.html')}?token=${tok}`;
  const oneClickUrl = sb ? `${sb}/functions/v1/remind-payslip?u=${tok}` : '';

  const parts = langs.map((l) => ({ l, t: welcomeCopy(l, site, p?.gave_pay === true) }));
  const subject = parts.map((x) => x.t.subject).join(' / ');

  const P = (s: string, st = '') => `<p style="margin:0 0 14px;color:#333${st}">${esc(s)}</p>`;
  const GAP = '<div style="height:12px"></div>';   // まとまりとまとまりの間

  const blockHtml = (t: WelcomeCopy) => `
    ${t.lead.map((s, i) => P(s, i === 0 ? ';font-weight:800;color:#111;font-size:16px' : '')).join('')}
    ${GAP}
    ${t.body.map((g) => g.map((s) => P(s)).join('')).join(GAP)}
    ${GAP}
    <div style="margin:0 0 14px;padding:16px 14px 14px;background:#f7f8fa;border-radius:12px">
      ${t.ask.thanks ? `<p style="margin:0 0 6px;color:#333">${esc(t.ask.thanks)}</p>` : ''}
      <p style="margin:0 0 8px;color:#111;font-weight:800">${esc(t.ask.lead)}</p>
      <p style="margin:0 0 14px;color:#333">${esc(t.ask.t)}</p>
      <a href="${esc(t.ask.cta.href)}" style="display:inline-block;background:#f5c842;color:#111;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;line-height:1.4">${esc(t.ask.cta.label)}</a>
      <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.7">${esc(t.ask.note)}</p>
    </div>
    ${GAP}
    ${t.close.map((s) => P(s)).join('')}
    <p style="margin:18px 0 0;color:#333">${esc(t.sign)}</p>`;

  const blockText = (t: WelcomeCopy) => [
    ...t.lead, '',
    ...t.body.flatMap((g) => [...g.flatMap((s) => [s, ''])]),
    ...(t.ask.thanks ? [t.ask.thanks] : []), t.ask.lead, t.ask.t, '',
    `▶ ${t.ask.cta.label}: ${t.ask.cta.href}`, '',
    t.ask.note, '',
    ...t.close.flatMap((s) => [s, '']),
    t.sign,
  ].join('\n');

  const unsubLinks = parts
    .map((x) => `<a href="${esc(unsubPage(x.l))}" style="color:#6b7280">${esc(x.t.unsub)}</a>`)
    .join(' / ');

  const html =
    `<div style="background:#f3f5f8;padding:24px 12px;font-family:-apple-system,'Segoe UI','Noto Sans JP',sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e9ef">
        <div style="background:#0a0c0f;padding:18px 24px">
          <span style="color:#f5c842;font-weight:800;letter-spacing:.04em;font-size:15px">PILOT VALUE</span>
        </div>
        <div style="padding:26px 24px;color:#1f2937;font-size:14px;line-height:1.8">
          ${parts.map((x) => blockHtml(x.t)).reduce((acc, b, i) => acc + dividerFor(langs[i]) + b)}
        </div>
        <div style="padding:16px 24px;border-top:1px solid #eef0f4;color:#9aa5b1;font-size:11px;line-height:1.7">
          ${parts.map((x) => esc(x.t.foot)).join('<br>')}<br>
          ${unsubLinks}
          ・<a href="${esc(site)}" style="color:#6b7280">${esc(site.replace(/^https?:\/\//, ''))}</a>
        </div>
      </div>
    </div>`;

  const text = [
    parts.map((x) => blockText(x.t)).join('\n\n— — —\n\n'),
    '', '--',
    ...parts.map((x) => x.t.foot),
    ...parts.map((x) => `${x.t.unsub}: ${unsubPage(x.l)}`),
  ].join('\n');

  return { lang, subject, html, text, unsubUrl: unsubPage(langs[0]), oneClickUrl };
}

/* ════════════════════════════════════════════════════════════════
   2通目（2026-11-07・オーナー採用「登録だけで止まっている人への2通目」・登録から3日後）

   誰に：SQL の pv_welcome_followup_due の1か所（db/welcome-followup.sql）。歓迎メールを受け取って2日以上・
         登録から3〜10日・給与をまだ出していない・確認待ちで止めていない・1人1回。
   ★日本語の文はオーナーが書いたもの（2026-11-07）。1文字も変えない・足さない。
     （オーナーの了承で誤字を2つだけ直した：「コックピッド」→「コックピット」・「OO万」→「〇〇万」）
     件名もオーナーの字。英語・スペイン語はその訳（パイロットが使う言葉で）。
   ★全員に同じ1通（会社ごとに文を変えない）。宛名も会社名も書かない。
   ★「90日間」はサイトの登録完了画面・歓迎メールと同じ日数（db/test-welcome-followup.mjs が突き合わせる）。
   ════════════════════════════════════════════════════════════════ */
export type FollowupCopy = {
  subject: string;
  lead: string;          // 1行目（太字）
  quote: string;         // コックピットでの一言（引用の形で出す）
  body: string[];        // 段落
  ask: string;           // お願いの段落（ボタンと同じ囲みに入れる）
  cta: Link;
  sign: string;
  foot: string;
  unsub: string;
};
export function followupCopy(l: Lang, site = SITE_URL): FollowupCopy {
  const pay = `${site}/${pagePath(l, 'pay-report.html#ps')}`;
  if (l === 'ja') {
    return {
      subject: '他社の給与、どう知っていますか',
      lead: 'PILOT VALUEへようこそ。',
      quote: '「あの会社、〇〇万くらいもらってるらしいよ」',
      body: [
        '他社の待遇の話になると、コックピットでよくこのような会話になります。',
        '求人票で基本給は分かっても、乗務手当や賞与を含めて実際にいくらになるのか。そこまで聞けるかどうかは、その会社に誰を知っているかで変わります。',
        '知り合いのいない会社も、同じように比べて、自分で選べるようにしたい。私たちがPILOT VALUEをつくった理由です。',
        'ここでは、パイロットが自分の給与を匿名で持ち寄ります。あなたが知りたい他社の給与を、そこで飛んでいる誰かが共有してくれています。あなたにとってはいつもの給与明細も、あなたの会社を考えている人には、いちばん知りたかった情報かもしれません。',
      ],
      ask: 'ご自身の給与を1件共有すると、ほかのパイロットが投稿した給与を90日間ご覧いただけます。入力には給与明細の写真を使えます。氏名・社員番号・口座情報など、個人を直接特定する情報は公開しません。',
      cta: { label: '自分の給与を匿名で共有する', href: pay },
      sign: 'PILOT VALUE 運営 team',
      foot: 'このメールは、PILOT VALUE にご登録いただき、通知を希望された方にお送りしています。',
      unsub: '配信を停止する',
    };
  }
  if (l === 'es') {
    return {
      subject: '¿Cómo te enteras de lo que pagan otras aerolíneas?',
      lead: 'Te damos la bienvenida a PILOT VALUE.',
      quote: '"Dicen que en esa aerolínea ganan unos ___ al año."',
      body: [
        'En la cabina, cuando se habla de las condiciones de otras aerolíneas, la conversación suele ir así.',
        'Una oferta de trabajo te dice el sueldo base. Pero ¿cuánto es en realidad, con las primas de vuelo y los bonos? Poder averiguarlo depende de a quién conozcas en esa aerolínea.',
        'Queremos que también puedas comparar de la misma manera las aerolíneas donde no conoces a nadie, y elegir por tu cuenta. Por eso creamos PILOT VALUE.',
        'Aquí, los pilotos comparten su propia remuneración de forma anónima. La remuneración de la aerolínea que te interesa la ha compartido alguien que vuela allí. Tu recibo de nómina puede ser algo de todos los meses para ti, pero para alguien que está pensando en tu aerolínea puede ser justo lo que más quería saber.',
      ],
      ask: 'Si compartes un registro de tu remuneración, podrás ver durante 90 días la remuneración que han publicado otros pilotos. Puedes usar una foto de tu recibo de nómina para completarlo. Nunca publicamos tu nombre, tu número de empleado, tus datos bancarios ni ningún otro dato que te identifique directamente.',
      cta: { label: 'Comparte tu remuneración de forma anónima', href: pay },
      sign: 'El equipo de PILOT VALUE',
      foot: 'Recibes este correo porque te registraste en PILOT VALUE y pediste recibir notificaciones.',
      unsub: 'Cancelar la suscripción',
    };
  }
  return {
    subject: 'How do you find out what other airlines pay?',
    lead: 'Welcome to PILOT VALUE.',
    quote: '"I hear they make about ___ a year over there."',
    body: [
      'Talk about other airlines on the flight deck often goes like this.',
      'A job posting tells you the base pay. But what does it really come to, with flight pay and bonuses? Whether you can find that out depends on who you know at that airline.',
      "We want you to be able to compare airlines where you don't know anyone in the same way, and choose for yourself. That's why we built PILOT VALUE.",
      "Here, pilots share their own pay anonymously. The pay at the airline you're curious about has been shared by someone flying there. Your payslip may be routine to you, but to someone considering your airline, it may be exactly what they most wanted to know.",
    ],
    ask: 'Share one record of your own pay and you can view the pay other pilots have posted for 90 days. You can use a photo of your payslip to fill it in. We never publish your name, staff number, bank details or anything else that directly identifies you.',
    cta: { label: 'Share your pay anonymously', href: pay },
    sign: 'The PILOT VALUE team',
    foot: 'You are receiving this because you signed up for PILOT VALUE and asked for notifications.',
    unsub: 'Unsubscribe',
  };
}

export function buildFollowup(p: Person, o: { siteUrl?: string; supabaseUrl?: string; lang?: Lang | 'both' } = {}) {
  const site = String(o.siteUrl ?? SITE_URL ?? 'https://pilot-value.com').replace(/\/+$/, '');
  const sb = String(o.supabaseUrl ?? SUPABASE_URL ?? '').replace(/\/+$/, '');
  const lang = o.lang || welcomeLangOf(p);
  const langs: Lang[] = lang === 'both' ? BOTH_ORDER : [lang];
  const tok = encodeURIComponent(p?.unsub_token || '');
  const unsubPage = (l: Lang) => `${site}/${pagePath(l, 'unsubscribe.html')}?token=${tok}`;
  const oneClickUrl = sb ? `${sb}/functions/v1/remind-payslip?u=${tok}` : '';
  const parts = langs.map((l) => ({ l, t: followupCopy(l, site) }));
  const subject = parts.map((x) => x.t.subject).join(' / ');
  const P = (s: string, st = '') => `<p style="margin:0 0 14px;color:#333${st}">${esc(s)}</p>`;
  const blockHtml = (t: FollowupCopy) => `
    ${P(t.lead, ';font-weight:800;color:#111;font-size:16px')}
    <p style="margin:18px 0 18px;padding:2px 0 2px 14px;border-left:3px solid #d6dbe3;color:#111;font-size:15px;font-weight:700">${esc(t.quote)}</p>
    ${t.body.map((s) => P(s)).join('')}
    <div style="margin:6px 0 14px;padding:16px 14px 14px;background:#f7f8fa;border-radius:12px">
      <p style="margin:0 0 14px;color:#333">${esc(t.ask)}</p>
      <a href="${esc(t.cta.href)}" style="display:inline-block;background:#f5c842;color:#111;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;line-height:1.4">${esc(t.cta.label)}</a>
    </div>
    <p style="margin:18px 0 0;color:#333">${esc(t.sign)}</p>`;
  const blockText = (t: FollowupCopy) => [
    t.lead, '', t.quote, '',
    ...t.body.flatMap((s) => [s, '']),
    t.ask, '',
    `▶ ${t.cta.label}: ${t.cta.href}`, '',
    t.sign,
  ].join('\n');
  const unsubLinks = parts
    .map((x) => `<a href="${esc(unsubPage(x.l))}" style="color:#6b7280">${esc(x.t.unsub)}</a>`)
    .join(' / ');
  const html =
    `<div style="background:#f3f5f8;padding:24px 12px;font-family:-apple-system,'Segoe UI','Noto Sans JP',sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e9ef">
        <div style="background:#0a0c0f;padding:18px 24px">
          <span style="color:#f5c842;font-weight:800;letter-spacing:.04em;font-size:15px">PILOT VALUE</span>
        </div>
        <div style="padding:26px 24px;color:#1f2937;font-size:14px;line-height:1.8">
          ${parts.map((x) => blockHtml(x.t)).reduce((acc, b, i) => acc + dividerFor(langs[i]) + b)}
        </div>
        <div style="padding:16px 24px;border-top:1px solid #eef0f4;color:#9aa5b1;font-size:11px;line-height:1.7">
          ${parts.map((x) => esc(x.t.foot)).join('<br>')}<br>
          ${unsubLinks}
          ・<a href="${esc(site)}" style="color:#6b7280">${esc(site.replace(/^https?:\/\//, ''))}</a>
        </div>
      </div>
    </div>`;
  const text = [
    parts.map((x) => blockText(x.t)).join('\n\n— — —\n\n'),
    '', '--',
    ...parts.map((x) => x.t.foot),
    ...parts.map((x) => `${x.t.unsub}: ${unsubPage(x.l)}`),
  ].join('\n');
  return { lang, subject, html, text, unsubUrl: unsubPage(langs[0]), oneClickUrl };
}

/* ── ここから下は本番（Deno）でだけ動く ──────────────────── */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function rpc(fn: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

async function send(p: Person, kind: 'welcome' | 'followup' = 'welcome') {
  const m = kind === 'followup'
    ? buildFollowup(p, { siteUrl: SITE_URL, supabaseUrl: SUPABASE_URL })
    : buildWelcome(p, { siteUrl: SITE_URL, supabaseUrl: SUPABASE_URL });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
      /* ★1人1通。記録が書けずに次の回でもう一度選ばれても、Resend 側で1通に畳まれる。 */
      'Idempotency-Key': `${kind === 'followup' ? 'welcome2' : 'welcome'}:${p.id}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [p.email],
      subject: m.subject,
      html: m.html,
      text: m.text,
      reply_to: ADMIN_EMAIL,
      headers: {
        'List-Unsubscribe': (m.oneClickUrl ? `<${m.oneClickUrl}>, ` : '')
          + `<${m.unsubUrl}>, <mailto:${ADMIN_EMAIL}?subject=unsubscribe>`,
        ...(m.oneClickUrl ? { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return m.lang;
}

export async function handler(req: Request): Promise<Response> {
  if (!CRON_SECRET) return json({ ok: false, error: 'PV_CRON_SECRET not set' }, 503);
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  if (req.headers.get('x-pv-cron-secret') !== CRON_SECRET) return json({ ok: false, error: 'forbidden' }, 403);
  if (!RESEND_KEY) return json({ ok: false, error: 'RESEND_API_KEY not set' }, 503);

  let body: { dry?: boolean } = {};
  try { body = await req.json(); } catch { /* 空でよい */ }

  const due = (await rpc('pv_welcome_due', { p_limit: MAX_PER_RUN })) as Person[];
  const tally: Record<string, number> = { ja: 0, en: 0, es: 0, both: 0 };

  /* ★2通目の相手（2026-11-07）。口がまだ無い（db/welcome-followup.sql を貼る前）なら飛ばす＝歓迎メールは今までどおり。 */
  let due2: Person[] = [];
  let followup = 'ok';
  try { due2 = ((await rpc('pv_welcome_followup_due', { p_limit: MAX_PER_RUN })) as Person[]) || []; }
  catch (e) { followup = 'unavailable'; console.error('followup due failed', String(e).slice(0, 200)); }

  /* ★人数だけを返す。宛先も氏名もログに残さない。 */
  if (body?.dry === true) {
    for (const p of due || []) tally[welcomeLangOf(p)]++;
    return json({ ok: true, dry: true, due: (due || []).length, due2: due2.length, followup, ...tally });
  }

  let sent = 0, failed = 0;
  for (const p of due || []) {
    let ok = false;
    try { tally[await send(p)]++; ok = true; sent++; } catch (e) {
      failed++;
      console.error('send failed', String(e).slice(0, 200));
    }
    /* ★送れたら記録する。送れなかったら試した回数だけ数える（3回で諦める）。
       記録が書けないときは、そこで止める ── 続けると、記録の無い人に次の回でまた送ろうとする
       （1日以内なら Resend が畳むが、それに頼り切らない）。 */
    try { await rpc('pv_welcome_mark', { p_id: p.id, p_ok: ok }); } catch (e) {
      console.error('mark failed', String(e).slice(0, 200));
      return json({ ok: false, error: 'mark failed', sent, failed, ...tally }, 500);
    }
    await new Promise((r) => setTimeout(r, 260)); // Resend の秒間上限に当てない
  }

  /* ── 2通目（歓迎メールと同じ決まりで送って記録する）── */
  let sent2 = 0, failed2 = 0;
  for (const p of due2) {
    let ok = false;
    try { await send(p, 'followup'); ok = true; sent2++; } catch (e) {
      failed2++;
      console.error('followup send failed', String(e).slice(0, 200));
    }
    try { await rpc('pv_welcome_followup_mark', { p_id: p.id, p_ok: ok }); } catch (e) {
      console.error('followup mark failed', String(e).slice(0, 200));
      return json({ ok: false, error: 'followup mark failed', sent, failed, sent2, failed2, ...tally }, 500);
    }
    await new Promise((r) => setTimeout(r, 260));
  }
  return json({ ok: true, due: (due || []).length, sent, failed, due2: due2.length, sent2, failed2, followup, ...tally });
}

if (DENO?.serve) DENO.serve(handler);
