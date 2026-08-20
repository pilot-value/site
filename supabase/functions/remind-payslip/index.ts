/* ════════════════════════════════════════════════════════════════
   remind-payslip — 月次リマインドを、その人の給料日に合わせて送る

   この事業の資産は「月次で更新され続けるデータ」なので、
   毎月戻ってくる理由をこちらから出す。解放は90日で切れる（db/pay-reports.sql）。

   ── 送信日を固定しない ─────────────────────────────────────
   「毎月25日に一斉送信」は誤り。日本は25日前後、湾岸は月末、米国は月2回。
   このサイトは欧州・中東・アジア・米州が前提なので、
   pg_cron で毎日1回叩き、pv_reminder_due が「今日が給料日以降で、
   今月まだ出していない人」だけを返す。誰を送るかは全部 SQL 側にある
   （＝テストできる。db/test-remind.mjs）。

   ── 本文に金額を入れない（意図的）──────────────────────────
   計画では「先月のあなた：総拘束時給 ¥10,361／乗務時給 ¥17,266」を入れる案だった。
   入れていない。理由は1つで、pay_reports は user_id を持たず proof_hash だけで
   繋がっている＝DB の中では「誰がいくら」を持たない設計にしてある。
   その数字をメールに載せた瞬間、Resend のログと受信箱に「このメールアドレスの人の
   報酬額」が残る。こちらの設計で守っているものを、送信で外に出すことになる。

   なので本文に入れるのは、報酬額ではないものだけ：
     ・解放の残り日数（＝戻る理由そのもの）
     ・連続提出月数と累計枚数（本人の積み上げ）
     ・マイページへのリンク（数字はログインの向こう側で見せる）
   会社名・職位・機材・金額・明細の項目名は1つも入れない。
   （db/test-remind.mjs がこのファイルを grep して固定している）

   ── デプロイ（オーナー作業）────────────────────────────────
   Supabase → Edge Functions → Deploy a new function → Via Editor
     関数名: remind-payslip ／ このファイルの中身を貼り付け → Deploy
   ★ Verify JWT は OFF にすること。
     メール本文の解除リンクは受信箱から叩かれる＝JWT を持たない。
     代わりに cron 入口は x-pv-cron-secret で塞いである。

   必要な secret（Edge Functions → Secrets）:
     RESEND_API_KEY   … 必須。notify-admin と同じ値でよい
     PV_CRON_SECRET   … 必須。pg_cron のヘッダに入れるのと同じ値。
                        これが未設定だと一斉送信の入口を誰でも叩ける
     FROM_EMAIL       … 任意。既定 PILOT VALUE <noreply@pilot-value.com>
     SITE_URL         … 任意。既定 https://pilot-value.com
     PV_REMIND_MAX    … 任意。1回の実行で送る上限。既定 200
   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で入れる。

   ── 入口 ───────────────────────────────────────────────────
     POST /  + header x-pv-cron-secret        … 一斉送信（pg_cron）
     POST /  + header ... + {"dry":true}      … 送らずに対象人数だけ返す
     POST /?u=<token>                         … ワンクリック解除（RFC 8058）
     GET  /?u=<token>                         … 解除ページへ 302
   ════════════════════════════════════════════════════════════════ */

/* Deno 越しに読む。★ここを直接 Deno.env.get で書かないのは、
   この 1 ファイルを Node からも import できるようにするため。
   そうしないとメール本文は grep でしか確かめられず、
   「実際どう見えるか」を localhost で見比べられない（shot-remind.mjs）。 */
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
const MAX_PER_RUN = Math.max(1, Math.min(Number(env('PV_REMIND_MAX', '200')) || 200, 1000));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export type Due = {
  id: string;
  email: string;
  name: string | null;
  country: string | null;
  unsub_token: string;
  pay_day: number;
  streak_months: number;
  report_count: number;
  access_until: string | null;
  days_left: number;
};

async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

/* 言語の見当をつける。
   ★ country では決めきれない。このサイトの中心的な読者は
     「ドバイに住んでいる日本人パイロット」＝居住国は UAE だが読むのは日本語。
     氏名に仮名・漢字が入っていれば日本語、そうでなければ居住国、最後に英語。
   ★ export してあるのは mail-bot/announce-mail.mjs が同じ判定を使うため。
     ここを写すと、同じ人に月次リマインドは日本語・お知らせは英語、が起きる。 */
export function langOf(p: Due): 'ja' | 'en' {
  if (/[぀-ヿ一-鿿]/.test(String(p.name ?? ''))) return 'ja';
  if (String(p.country ?? '').trim() === '日本') return 'ja';
  return 'en';
}

const fmtDate = (iso: string | null, lang: 'ja' | 'en') => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return lang === 'ja'
    ? `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

/* ── 文面 ─────────────────────────────────────────────────────
   金額は1つも出さない（冒頭の理由）。出すのは残り日数と積み上げだけ。 */
export function build(p: Due) {
  const lang = langOf(p);
  const left = Math.max(0, Number(p.days_left) || 0);
  const expired = left <= 0;
  const soon = !expired && left <= 14;
  const until = fmtDate(p.access_until, lang);
  const nextStreak = (Number(p.streak_months) || 0) + 1;
  const count = Number(p.report_count) || 0;

  const payUrl = `${SITE_URL}/${lang === 'en' ? 'en/' : ''}pay-report.html#ps`;
  const meUrl = `${SITE_URL}/${lang === 'en' ? 'en/' : ''}profile.html`;
  const unsubUrl = `${SITE_URL}/${lang === 'en' ? 'en/' : ''}unsubscribe.html?token=${encodeURIComponent(p.unsub_token)}`;

  const t = lang === 'ja'
    ? {
      subject: expired
        ? '【PILOT VALUE】解放が切れています（明細1枚で戻ります）'
        : soon
          ? `【PILOT VALUE】解放はあと${left}日 — 今月の明細をどうぞ`
          : '【PILOT VALUE】今月の明細を1枚',
      hi: p.name ? `${p.name} さん` : 'こんにちは',
      lead: expired
        ? 'データの解放が切れています。明細を1枚出すと、その日から90日ぶん戻ります。'
        : `給料日を過ぎました。今月の明細を1枚出すと、今月ぶんの数字がマイページに増えます。`,
      statLeft: expired ? '解放' : '解放の残り',
      statLeftV: expired ? '切れています' : `${left}日`,
      // 日本語なので日付と助詞の間に空白を入れない（「8月14日 まで」に見えていた）
      until: until ? (expired ? `${until}に終了` : `${until}まで`) : '',
      statStreak: '連続提出',
      statStreakV: `${p.streak_months}ヶ月`,
      statCount: '累計',
      statCountV: `${count}枚`,
      // 数字の前に空白を入れない（同じ文面の「明細を1枚」と揃わない）
      push: `今月出すと${nextStreak}ヶ月連続になります。`,
      cta: '今月の明細を出す',
      sub: 'マイページで推移を見る',
      why: 'このメールは、マイページで「月次リマインド」をオンにした方にお送りしています。給料日は投稿日から推定しているため、ずれることがあります。',
      priv: '本文に金額・会社名・明細の項目は一切含めていません。数字はログインの向こう側だけに置いています。',
      unsub: '配信を停止する',
    }
    : {
      subject: expired
        ? 'PILOT VALUE — your access has lapsed (one payslip brings it back)'
        : soon
          ? `PILOT VALUE — ${left} days of access left`
          : 'PILOT VALUE — time for this month\'s payslip',
      hi: p.name ? `Hi ${p.name},` : 'Hi,',
      lead: expired
        ? 'Your data access has lapsed. Dropping in one payslip brings back 90 days from that day.'
        : 'Your pay day has passed. Drop in one payslip and this month lands on your page.',
      statLeft: expired ? 'Access' : 'Access left',
      statLeftV: expired ? 'lapsed' : `${left} days`,
      until: until ? (expired ? `ended ${until}` : `until ${until}`) : '',
      statStreak: 'Streak',
      statStreakV: `${p.streak_months} mo`,
      // 単位を付ける。数字だけだと何の 11 なのか読めなかった（実測）
      statCount: 'Payslips',
      statCountV: `${count}`,
      push: `File this month and your streak reaches ${nextStreak} months.`,
      cta: 'Add this month\'s payslip',
      sub: 'See your trend',
      why: 'You are getting this because you turned on the monthly reminder on your page. Your pay day is estimated from when you last filed, so it can be a day or two off.',
      priv: 'This email contains no amounts, no airline name and no payslip line items. Your figures stay behind the login.',
      unsub: 'Unsubscribe',
    };

  /* ★白背景に載る文字の色。ボタンの琥珀（#f5c842）をそのまま文字に使うと
     白地で 1.7:1 しか出ず、いちばん読ませたい「あと◯日」が読めなかった（実測）。
     文字用に暗く振った3色を別に持つ。背景色にはこれを使わない。 */
  const accent = expired ? '#c0392b' : soon ? '#9a6c00' : '#177a52';

  const stat = (k: string, v: string, color?: string, sub?: string) =>
    `<td style="padding:0 18px 0 0;vertical-align:top">
       <div style="font-size:11px;color:#6b7a8c;letter-spacing:.04em;text-transform:uppercase">${esc(k)}</div>
       <div style="font-size:22px;font-weight:800;color:${color ?? '#111'};line-height:1.3">${esc(v)}</div>
       ${sub ? `<div style="font-size:11px;color:#6b7a8c;margin-top:2px">${esc(sub)}</div>` : ''}
     </td>`;

  const html =
    `<div style="font-family:-apple-system,'Segoe UI','Noto Sans JP',sans-serif;max-width:560px;margin:0 auto;color:#111;font-size:14px;line-height:1.7">
      <p style="margin:0 0 6px">${esc(t.hi)}</p>
      <p style="margin:0 0 22px;color:#333">${esc(t.lead)}</p>

      <table style="border-collapse:collapse;margin:0 0 22px"><tr>
        ${/* 期限の日付は1列目の中に入れる。表の下に置いていたときは
             3列すべての注記に見えて、何の日付か読めなかった（実測）。 */''}
        ${stat(t.statLeft, t.statLeftV, accent, t.until)}
        ${stat(t.statStreak, t.statStreakV)}
        ${stat(t.statCount, t.statCountV)}
      </tr></table>

      <p style="margin:0 0 20px;color:#333">${esc(t.push)}</p>

      <p style="margin:0 0 10px">
        <a href="${esc(payUrl)}" style="display:inline-block;background:#f5c842;color:#111;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:10px">${esc(t.cta)}</a>
      </p>
      <p style="margin:0 0 26px"><a href="${esc(meUrl)}" style="color:#2f5d8c;text-decoration:none">${esc(t.sub)} →</a></p>

      <hr style="border:0;border-top:1px solid #e6eaef;margin:0 0 14px">
      <p style="margin:0 0 6px;font-size:11px;color:#6b7a8c">${esc(t.why)}</p>
      <p style="margin:0 0 12px;font-size:11px;color:#6b7a8c">${esc(t.priv)}</p>
      <p style="margin:0;font-size:11px"><a href="${esc(unsubUrl)}" style="color:#4c5c6e">${esc(t.unsub)}</a></p>
    </div>`;

  return { lang, subject: t.subject, html, unsubUrl };
}

async function send(p: Due, ym: string) {
  const m = build(p);
  // 受信箱側のワンクリック解除（RFC 8058）。http の方は POST を受ける必要があるので
  // この関数自身を指す。人が押すリンクは本文の unsubscribe.html（既存のページ）。
  const oneClick = `${SUPABASE_URL}/functions/v1/remind-payslip?u=${encodeURIComponent(p.unsub_token)}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
      // 同じ人・同じ月なら、cron が二度走っても Resend 側で1通に畳まれる。
      // DB 側の mail_last_sent_at と二重に効かせる。
      'Idempotency-Key': `remind:${p.id}:${ym}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [p.email],
      subject: m.subject,
      html: m.html,
      headers: {
        'List-Unsubscribe': `<${oneClick}>, <mailto:${ADMIN_EMAIL}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

/* ── ワンクリック解除 ──────────────────────────────────────── */
async function unsubscribe(token: string) {
  // 見つからなくても ok。存在するトークンかどうかを外に教えない。
  try { await rpc('pv_reminder_unsub', { p_token: token }); } catch (e) { console.error('unsub', String(e)); }
}

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get('u') ?? '';

  // ① 受信箱からのワンクリック解除（RFC 8058 は POST で来る）
  if (token) {
    if (req.method === 'POST') {
      await unsubscribe(token);
      return new Response('unsubscribed', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    // 人が踏んだときは、既にある解除ページに渡す（見た目もそちらで揃っている）
    if (req.method === 'GET') {
      return Response.redirect(`${SITE_URL}/unsubscribe.html?token=${encodeURIComponent(token)}`, 302);
    }
    return json({ error: 'method not allowed' }, 405);
  }

  // ② 一斉送信（pg_cron）
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // 秘密が未設定なら動かさない。「未設定なら素通し」にすると、
  // secret を入れ忘れた状態で入口が全開になる（いちばん起きる事故）。
  if (!CRON_SECRET) return json({ error: 'PV_CRON_SECRET is not set' }, 500);
  if (req.headers.get('x-pv-cron-secret') !== CRON_SECRET) return json({ error: 'forbidden' }, 403);
  if (!RESEND_KEY) return json({ error: 'RESEND_API_KEY is not set' }, 500);
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'supabase env missing' }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* 空ボディでよい */ }
  const dry = body.dry === true;

  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  let due: Due[] = [];
  try {
    due = (await rpc('pv_reminder_due', { p_limit: MAX_PER_RUN })) as Due[];
  } catch (e) {
    console.error('due failed', String(e));
    return json({ ok: false, stage: 'due', detail: String(e).slice(0, 300) }, 500);
  }
  if (!Array.isArray(due)) due = [];

  // ★対象者のメールアドレスも氏名もレスポンスに出さない。
  //   cron のログと Supabase の関数ログに会員名簿が溜まる。
  if (dry) return json({ ok: true, dry: true, ym, due: due.length, max: MAX_PER_RUN });

  const sent: string[] = [];
  const failed: string[] = [];
  for (const p of due) {
    try {
      await send(p, ym);
      sent.push(p.id);
    } catch (e) {
      failed.push(p.id);
      console.error('send failed', p.id, String(e).slice(0, 200));
    }
    // Resend の秒間上限に当てない。1通ごとに軽く間を置く。
    await new Promise((r) => setTimeout(r, 260));
  }

  let marked = 0;
  if (sent.length) {
    // 送れた人だけ記録する。失敗した人は翌日の cron でもう一度拾われる。
    try { marked = (await rpc('pv_reminder_mark_sent', { p_ids: sent })) as number; } catch (e) {
      console.error('mark failed', String(e));
    }
  }

  return json({ ok: true, ym, due: due.length, sent: sent.length, failed: failed.length, marked });
}

// Deno（本番）でだけ listen する。Node から import したときは build() だけ使う。
if (DENO?.serve) DENO.serve(handler);
