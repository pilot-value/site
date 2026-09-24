/* ════════════════════════════════════════════════════════════════
   weekly-digest — 週に一度、その週の新着の「件数」だけを知らせる

   ★このサイトで**繰り返し送る唯一のメール**。だから送り先は
     通知を希望した人（email_opt_in = true）だけで、足元の文言も1本だけ違う。
     他の5通（一度きりのお知らせ）は登録者全員に送る。

   ── 本文に何を入れないか（意図的）──────────────────────────
   入れないもの: 金額・職位・機材・在籍年数・口コミの本文・本人が打ち込んだ社名。
   入れるもの:   年収レポートの件数／口コミの件数／投稿があった航空会社の名前。

   ★口コミの本文を1文字も載せないのは、サイトが鍵の無い人に見せているのが
     先頭40字だけだからで、メールに抜粋を載せると**メールがサイトの錠前を迂回する**。
   ★会社名のとなりに件数を書かない。「◯◯社 1件」と書くと、その週にその会社から
     出した**たった1人**が居ることまで伝わる。名前だけなら1人の週と4人の週が
     同じ見た目になる（サイトは元から会社を公開しているが、時期の粗さは
     「1ヶ月以内」まで ── db/pay-rows.sql の age）。
   ★そもそも**この関数は行を受け取らない。** 数えるのは SQL
     （db/weekly-digest.sql の pv_digest_week）で、ここへ届くのは件数と社名だけ。
     受け取らなければ、出しようが無い。

   ── 文面の置き場所 ────────────────────────────────────────
   ★文面はこのファイルが唯一の正。mail-bot/announce-mail.mjs が
     ここから import している（remind-payslip の langOf と同じ向き）。
     写しを作らないこと ── 手で流したメールと自動のメールで文面が違う、が起きる。
     絵で見る: node shot-remind.mjs --digest

   ── デプロイ（オーナー作業）────────────────────────────────
   Supabase → Edge Functions → Deploy a new function → Via Editor
     関数名: weekly-digest ／ このファイルの中身を貼り付け → Deploy
   ★ Verify JWT は OFF にすること（pg_cron は JWT を持たない）。
     入口は x-pv-cron-secret で塞いである。

   必要な secret（Edge Functions → Secrets）:
     RESEND_API_KEY   … 必須。remind-payslip と同じ値でよい
     PV_CRON_SECRET   … 必須。pg_cron のヘッダに入れるのと同じ値。
                        ★未設定なら送らずに 503 を返す（入口を開けたままにしない）
     FROM_EMAIL       … 任意。既定 PILOT VALUE <noreply@pilot-value.com>
     SITE_URL         … 任意。既定 https://pilot-value.com
     PV_TEST_EMAILS   … 任意。動作確認用アドレス（カンマ区切り・前方後方一致）。
                        入れておくと自分のテスト口座に届かない
     PV_DIGEST_MAX    … 任意。1回で送る上限。既定 500
   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で入れる。

   ── 入口 ───────────────────────────────────────────────────
     POST / + header x-pv-cron-secret            … 週のまとめを送る（pg_cron）
     POST / + header ... + {"dry":true}          … 送らずに件数と人数だけ返す
   ★配信停止は remind-payslip が受け持つ（このメールの List-Unsubscribe も
     あちらを指している）。解除の口を2つに増やさない。
   ════════════════════════════════════════════════════════════════ */

/* Deno 越しに読む。★ここを直接 Deno.env.get で書かないのは、
   この 1 ファイルを Node からも import できるようにするため
   （mail-bot/announce-mail.mjs と shot-remind.mjs が文面だけ使う）。 */
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
const MAX_PER_RUN = Math.max(1, Math.min(Number(env('PV_DIGEST_MAX', '500')) || 500, 2000));

/* ── しきい値（ここ1か所） ──────────────────────────────── */
/* ★3件以下の週は送らない（2026-09-24 オーナー指示）。合計が4件以上でだけ出す。
   送らない週は pv_digest_mark を呼ばない＝そのぶんは翌週のまとめに合流する。 */
export const DIGEST_MIN = 4;
/* ★2026-09-24 オーナー指示「投稿があった航空会社を書こうか」で、1件だけの社も名前を出す。
   代わりに件数を書かない（冒頭の理由）。 */
export const DIGEST_NAME_MIN = 1;
export const DIGEST_NAME_MAX = 12;  // 超えたぶんは「ほか◯社」

export type Air = { slug: string; n: number; ja?: string | null; en?: string | null };
/* ★since / until は pv_digest_week が返す「数えた窓」。
   手で流す側（mail-bot の digestStats）は窓を持たないので任意。 */
export type Stats = {
  pay: number; reviews: number; total: number; airlines: Air[];
  since?: string; until?: string;
};
export type Person = {
  id?: string; email?: string; name?: string | null; country?: string | null;
  airline_region?: string | null; unsub_token?: string;
};

/* ── 誰に何語で送るか ────────────────────────────────────
   ★「日本の会員は日本語だけ・それ以外は全員 英語と日本語を1通に」
     （2026-09-24 オーナー指示。刷新のお知らせと同じ）。
   ★英語**だけ**にしない ── 海外在住の日本人パイロットがこのサイトの中心的な読者で、
     居住国が UAE でも読むのは日本語。読めない1通を送らない。
   ★announce-mail.mjs の renewalLangOf と同じ答えを返すこと。
     あちらは langOf → langModeOf → realPayLangOf → updateLangOf と4段を通るが、
     行き先は2つしか無いので、ここでは畳んである。
     db/test-announce.mjs が両方に同じ人を通して答えを突き合わせている
     ＝畳み方を間違えたら赤くなる。 */
export function digestLangOf(p: Person): 'ja' | 'both' {
  const nameJa = /[぀-ヿ一-鿿]/.test(String(p?.name ?? ''));
  const country = String(p?.country ?? '').trim();
  if (nameJa) return 'ja';                       // 氏名に仮名・漢字＝日本語
  if (country) return country === '日本' ? 'ja' : 'both';
  // 氏名も居住国も手がかりが無い人。勤務先が日本の航空会社なら日本の会員とみなす。
  return String(p?.airline_region ?? '').trim().toLowerCase() === 'japan' ? 'ja' : 'both';
}

/* ★日英ともに入れるときは英語が上・日本語が下（2026-08-23 オーナー判断）。
   日本語しか読めない人はどのみち下まで読むが、英語しか読めない人は
   上が日本語だと自分宛でないと思って閉じる。読めないほうを上に置かない。 */
const BOTH_ORDER: ('ja' | 'en')[] = ['en', 'ja'];

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const strip = (s: unknown) => String(s).replace(/<[^>]+>/g, '');

/* 仕切りの一言は「次に来る言語」で決める。固定文にすると、
   英語を上にした瞬間に「English follows.」が英語の上に出て逆さになる。 */
const dividerFor = (nextLang: 'ja' | 'en') => `
    <div style="margin:4px 0 26px;border-top:1px solid #e6e9ef"></div>
    <p style="margin:0 0 18px;color:#9aa5b1;font-size:11px">${
  nextLang === 'ja' ? '日本語は下に続きます。' : 'English follows.'}</p>`;

/* ── 文面 ────────────────────────────────────────────────── */
export function digestCopy(lang: 'ja' | 'en', st: Stats) {
  /* ★名前の引けた社だけを数えてから切る。先に切ると、知らないコードが
     枠を1つ食って、名前の出る社が減る。 */
  const all = (st.airlines || [])
    .map((a) => ({ ...a, name: (lang === 'en' ? (a.en || a.ja) : (a.ja || a.en)) || '' }))
    .filter((a) => a.name);
  const named = all.slice(0, DIGEST_NAME_MAX);
  const more = all.length - named.length;
  /* ★0件の行は出さない（「新しい口コミ 0件」と書かれた1通を送らない）。
     DIGEST_MIN があるので、両方 0 でここに来ることはない。 */
  const nz = (pairs: [number, string][]) => pairs.filter(([n]) => n > 0).map(([, s]) => s);
  /* 英語の単複。1件のときに「1 reviews」と出ていたのを直した（2026-09-24）。 */
  const plu = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  if (lang === 'ja') {
    return {
      subject: 'この1週間の新着：' + nz([[st.pay, `年収 ${st.pay}件`], [st.reviews, `口コミ ${st.reviews}件`]]).join('・'),
      lead: [
        'PILOT VALUEをご利用いただき、ありがとうございます。',
        'この1週間に、パイロット本人から新しいデータが届きました。',
      ],
      counts: nz([[st.pay, `新しい年収レポート ${st.pay}件`], [st.reviews, `新しい口コミ ${st.reviews}件`]]),
      airlinesPre: named.length ? '投稿があった航空会社：' : '',
      /* ★件数を書かない（冒頭の理由）。 */
      airlines: named.map((a) => a.name).concat(more > 0 ? [`ほか${more}社`] : []),
      cta: '新しいデータを見る',
      close: [
        'このメールには金額を書いていません。中身はサイトでご覧いただけます。',
        '来週も、届いたぶんをまとめてお知らせします。',
      ],
      sign: ['PILOT VALUE Team', "Pilot defines. Pilot's value."],
      why: 'このメールは、PILOT VALUE で通知を希望された方にお送りしています。',
      unsub: '配信を停止する',
    };
  }
  return {
    subject: 'This week on PILOT VALUE: ' + nz([
      [st.pay, plu(st.pay, 'pay report', 'pay reports')],
      [st.reviews, plu(st.reviews, 'review', 'reviews')],
    ]).join(', '),
    lead: [
      'Thank you for being part of PILOT VALUE.',
      'Here is what pilots added over the past week.',
    ],
    counts: nz([
      [st.pay, plu(st.pay, 'new pay report', 'new pay reports')],
      [st.reviews, plu(st.reviews, 'new review', 'new reviews')],
    ]),
    airlinesPre: named.length ? 'Airlines with new entries:' : '',
    airlines: named.map((a) => a.name).concat(more > 0 ? [`and ${more} more`] : []),
    cta: 'See the new data',
    close: [
      'We never put pay figures in email. You can see them on the site.',
      "We'll send another summary next week.",
    ],
    sign: ['PILOT VALUE Team', "Pilot defines. Pilot's value."],
    why: 'You are receiving this because you asked for notifications from PILOT VALUE.',
    unsub: 'Unsubscribe',
  };
}

/* p = 送る相手 ／ o = { stats, siteUrl, supabaseUrl, adminEmail, lang } */
export function buildDigest(
  p: Person,
  o: { stats?: Stats; siteUrl?: string; supabaseUrl?: string; adminEmail?: string; lang?: 'ja' | 'en' | 'both' } = {},
) {
  const st: Stats = o.stats || { pay: 0, reviews: 0, total: 0, airlines: [] };
  const site = String(o.siteUrl ?? SITE_URL ?? 'https://pilot-value.com').replace(/\/+$/, '');
  const sb = String(o.supabaseUrl ?? SUPABASE_URL ?? '').replace(/\/+$/, '');
  const admin = String(o.adminEmail ?? ADMIN_EMAIL ?? 'info@pilot-value.com');
  const lang = o.lang || digestLangOf(p);
  const langs: ('ja' | 'en')[] = lang === 'both' ? BOTH_ORDER : [lang];

  const pre = (l: 'ja' | 'en') => (l === 'en' ? 'en/' : '');
  /* ★行き先は REAL PAY（新しく入ったデータが並ぶ画面）。 */
  const dataUrl = (l: 'ja' | 'en') => `${site}/${pre(l)}actual-pay.html`;
  const unsubPage = (l: 'ja' | 'en') =>
    `${site}/${pre(l)}unsubscribe.html?token=${encodeURIComponent(p?.unsub_token || '')}`;
  const unsubUrl = unsubPage(langs[0]);
  /* ★受信箱側のワンクリック解除は remind-payslip が受ける（解除の口を増やさない）。 */
  const oneClickUrl = sb
    ? `${sb}/functions/v1/remind-payslip?u=${encodeURIComponent(p?.unsub_token || '')}`
    : '';

  const parts = langs.map((l) => ({ l, t: digestCopy(l, st), u: dataUrl(l) }));
  const subject = lang === 'both' ? `${parts[0].t.subject} / ${parts[1].t.subject}` : parts[0].t.subject;

  const para = (s: string) => `<p style="margin:0 0 16px;color:#333">${esc(s)}</p>`;
  /* ★件数は「行」で出す。箇条書きのタグを使わないのは他の5通と同じ形に保つため。 */
  const rowsHtml = (t: ReturnType<typeof digestCopy>) => t.counts
    .map((s) => `<p style="margin:0 0 6px;color:#111;font-weight:800;font-size:15px">${esc(s)}</p>`).join('');
  const airHtml = (t: ReturnType<typeof digestCopy>) => (t.airlines.length
    ? `<p style="margin:12px 0 4px;color:#6b7280;font-size:13px">${esc(t.airlinesPre)}</p>
       <p style="margin:0 0 16px;color:#333">${esc(t.airlines.join(' ・ '))}</p>`
    : '');

  const blockHtml = (t: ReturnType<typeof digestCopy>, u: string) => `
    ${t.lead.map(para).join('')}
    <div style="margin:0 0 6px;padding:16px 18px;background:#fbfbfd;border:1px solid #eef0f4;border-radius:12px">
      ${rowsHtml(t)}
    </div>
    ${airHtml(t)}
    <p style="margin:22px 0 24px">
      <a href="${esc(u)}" style="display:inline-block;background:#f5c842;color:#111;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:10px">${esc(t.cta)}</a>
    </p>
    ${t.close.map(para).join('')}
    <p style="margin:22px 0 0;color:#333">${t.sign.map(esc).join('<br>')}</p>`;

  const blockText = (t: ReturnType<typeof digestCopy>, u: string) => [
    ...t.lead.flatMap((s) => [strip(s), '']),
    ...t.counts.map((s) => '  ' + strip(s)), '',
    ...(t.airlines.length ? [strip(t.airlinesPre), '  ' + strip(t.airlines.join(' / ')), ''] : []),
    `▶ ${u}`, '',
    ...t.close.flatMap((s) => [strip(s), '']),
    ...t.sign.map(strip),
  ].join('\n');

  const feet = parts.map((x) => x.t);
  const unsubLink = parts
    .map((x) => `<a href="${esc(unsubPage(x.l))}" style="color:#6b7280">${esc(x.t.unsub)}</a>`)
    .join(' / ');

  const html =
    `<div style="background:#f3f5f8;padding:24px 12px;font-family:-apple-system,'Segoe UI','Noto Sans JP',sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e9ef">
        <div style="background:#0a0c0f;padding:18px 24px">
          <span style="color:#f5c842;font-weight:800;letter-spacing:.04em;font-size:15px">PILOT VALUE</span>
        </div>
        <div style="padding:26px 24px;color:#1f2937;font-size:14px;line-height:1.8">
          ${parts.map((x) => blockHtml(x.t, x.u))
      .reduce((acc, b, i) => acc + dividerFor(langs[i]) + b)}
        </div>
        <div style="padding:16px 24px;border-top:1px solid #eef0f4;color:#9aa5b1;font-size:11px;line-height:1.7">
          ${feet.map((t) => esc(t.why)).join('<br>')}<br>
          ${unsubLink}
          ・<a href="${esc(site)}" style="color:#6b7280">${esc(site.replace(/^https?:\/\//, ''))}</a>
        </div>
      </div>
    </div>`;

  const text = [
    parts.map((x) => blockText(x.t, x.u)).join('\n\n— — —\n\n'),
    '', '--',
    ...feet.map((t) => strip(t.why)),
    ...parts.map((x) => `${strip(x.t.unsub)}: ${unsubPage(x.l)}`),
  ].join('\n');

  return { lang, subject, html, text, unsubUrl, oneClickUrl, dataUrl: dataUrl(langs[0]), stats: st, admin };
}

/* ── ここから下は本番（Deno）でだけ動く ──────────────────── */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function rpc(fn: string, args: Record<string, unknown> = {}) {
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

/* 動作確認用の口座を外す。★未設定でも止めない ── 自分のテスト口座に
   まとめが1通届くだけで、数字が狂うわけではない（数え上げは db/usage.mjs の話）。 */
function isTestEmail(email: string) {
  const pats = String(env('PV_TEST_EMAILS', '')).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const e = String(email || '').toLowerCase();
  return pats.some((p) => e === p || e.startsWith(p) || e.endsWith(p));
}

async function send(p: Person, st: Stats, tag: string) {
  const m = buildDigest(p, { stats: st, siteUrl: SITE_URL, supabaseUrl: SUPABASE_URL, adminEmail: ADMIN_EMAIL });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
      /* ★同じ人・同じ週なら、時計が二度走っても Resend 側で1通に畳まれる。
         手で流す send.mjs も同じ鍵（digest:<人>:<週>）を使う。 */
      'Idempotency-Key': `digest:${p.id}:${tag}`,
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
  /* ★合言葉が未設定なら、入口を開けたままにしない。 */
  if (!CRON_SECRET) return json({ ok: false, error: 'PV_CRON_SECRET not set' }, 503);
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  if (req.headers.get('x-pv-cron-secret') !== CRON_SECRET) return json({ ok: false, error: 'forbidden' }, 403);

  let body: { dry?: boolean } = {};
  try { body = await req.json(); } catch { /* 空でよい */ }
  const dry = body?.dry === true;

  const since = String(await rpc('pv_digest_since'));
  /* ★数えるのは SQL。ここへ来るのは件数と社名だけ＝行そのものは受け取らない。 */
  const st = await rpc('pv_digest_week', { p_since: since }) as Stats;
  const tag = String(since).slice(0, 10);

  if ((st?.total ?? 0) < DIGEST_MIN) {
    /* ★記録を進めない。このぶんは翌週のまとめに合流する。 */
    return json({ ok: true, skipped: 'too few', since, pay: st?.pay ?? 0, reviews: st?.reviews ?? 0, min: DIGEST_MIN });
  }

  const all = await rpc('pv_digest_recipients') as Person[];
  const targets = (all || []).filter((p) => p.email && !isTestEmail(p.email)).slice(0, MAX_PER_RUN);

  /* ★人数と件数だけを返す。宛先も氏名もログに残さない
     （残すと cron のログと関数のログに会員名簿が溜まる）。 */
  if (dry) {
    return json({ ok: true, dry: true, since, pay: st.pay, reviews: st.reviews,
      airlines: (st.airlines || []).length, recipients: targets.length });
  }

  const tally: Record<string, number> = { ja: 0, both: 0 };
  let sent = 0, failed = 0;
  for (const p of targets) {
    try {
      const l = await send(p, st, tag);
      tally[l] = (tally[l] || 0) + 1;
      sent++;
    } catch (e) {
      failed++;
      console.error('send failed', String(e).slice(0, 200));
    }
    // Resend の秒間上限に当てない。
    await new Promise((r) => setTimeout(r, 260));
  }

  /* ★1通でも出たときだけ記録を進める（全部失敗した週を「送った」にしない）。
     ★進める先は「数えた瞬間」（st.until）であって、送り終えた今ではない。
       今にすると、数えてから送り終えるまでの数十秒に届いた投稿が、
       今週にも来週にも入らないまま消える（画面では何も起きないので気づけない）。 */
  let marked: string | null = null;
  if (sent > 0) {
    try { marked = String(await rpc('pv_digest_mark', { p_at: st.until })); } catch (e) {
      console.error('mark failed', String(e).slice(0, 200));
    }
  }

  return json({ ok: true, since, pay: st.pay, reviews: st.reviews, sent, failed, ja: tally.ja, both: tally.both, marked });
}

// Deno（本番）でだけ listen する。Node から import したときは文面だけ使う。
if (DENO?.serve) DENO.serve(handler);
