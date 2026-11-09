/* ════════════════════════════════════════════════════════════════
   follow-notify — フォローしている会社に新着（給与・口コミ・待遇の答え）が入ったら知らせる（2026-11-07）

   オーナー採用（2026-11-07）：自分の会社は最初からフォロー済み・新着を別のメールで知らせる。
   ★2026-11-09 オーナー指示：提出後すぐではなく、**次の日の17時（受け取る人の国の時間）に**まとめて1通。
   ── 誰に・何を（決めるのは SQL の pv_follow_due の1か所：db/follow.sql）──────
     ・1時間おき（毎時0分）に呼ばれる。送る相手に入るのは、受け取る人の国で17時を過ぎていて今日の分をまだ送っていない人
     ・中身は、前に送った分の終わり（またはフォローを始めた時刻）から、受け取る人の国の今日の0時までに入った新着
     ・1人1日1通まで・自分が出した分では知らせない・テスト用アカウントの投稿では知らせない
     ・通知を希望した人だけ・確認待ちで止めた会員には送らない
   ── 文面のきまり ────────────────────────────────────────────
     ★件数・金額・職位・機材・本文を書かない。書くのは会社名と「何が入ったか」（給与・口コミ・待遇の回答）だけ
       （SQL も件数を返さない＝書けない）。
     ★宛名を書かない。会社のページがある会社だけリンクを付ける。
     ★文面は下書き（2026-11-07）。オーナーが直したら、その字に替える（書き直さない）。
     ★言語の決め方は welcome-member の welcomeLangOf と同じ（写し・db/test-follow.mjs が突き合わせる）。

   ── デプロイ（オーナー作業）────────────────────────────────
   Supabase → Edge Functions → Deploy a new function → Via Editor
     関数名: follow-notify ／ このファイルの中身を貼り付け → Deploy
   ★ Verify JWT は OFF（pg_cron は JWT を持たない）。入口は x-pv-cron-secret で塞いである。
   そのあと db/follow.sql を SQL Editor に貼る（1時間おきの時計もそこで入る）。
   secret は週まとめ・歓迎メールと同じ（RESEND_API_KEY・PV_CRON_SECRET）。新しく入れるものは無い。

   ── 入口 ───────────────────────────────────────────────────
     POST / + header x-pv-cron-secret          … 送る（pg_cron が1時間おきに叩く。誰に送るかは SQL が国の17時で決める）
     POST / + header ... + {"dry":true}        … 送らずに、送る相手の人数だけ返す
   ★配信停止は remind-payslip が受け持つ（List-Unsubscribe もあちら）。
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
const MAX_PER_RUN = Math.max(1, Math.min(Number(env('PV_FOLLOW_MAX', '100')) || 100, 200));

export type Lang = 'ja' | 'en' | 'es';
export type Kind = 'pay' | 'review' | 'cond';
export type Person = {
  id?: string; email?: string; name?: string | null; country?: string | null;
  airline_region?: string | null; lang?: string | null; unsub_token?: string; has_key?: boolean | null; items?: Item[] | null;
  upto?: string | null;   // この1通がどこまでの新着か（受け取る人の国の今日の0時）。送れたら pv_follow_mark に返す
};

/* 1人1日1通の鍵。日付は「どこまでの新着か」の日（受け取る人の国の1日）。無ければ今日（UTC）。 */
export function followKey(p: Person, now = new Date()) {
  const t = p?.upto ? new Date(p.upto) : null;
  const day = (t && !isNaN(t.getTime()) ? t : now).toISOString().slice(0, 10);
  return `follow:${p.id}:${day}`;
}

/* ── 何語で（welcome-member の welcomeLangOf の写し）─────────── */
export function followLangOf(p: Person): Lang | 'both' {
  const l = String(p?.lang ?? '').trim().toLowerCase();
  if (l === 'ja') return 'ja';
  if (l === 'es') return 'es';
  if (l === 'en') return 'both';
  const nameJa = /[぀-ヿ一-鿿]/.test(String(p?.name ?? ''));
  const country = String(p?.country ?? '').trim();
  if (nameJa) return 'ja';
  if (country) return country === '日本' ? 'ja' : 'both';
  return String(p?.airline_region ?? '').trim().toLowerCase() === 'japan' ? 'ja' : 'both';
}
const BOTH_ORDER: Lang[] = ['en', 'ja'];

/* ── 行き先 ───────────────────────────────────────────────── */
export function airlinePath(l: Lang, code: string) {
  return l === 'ja' ? `airlines/${code}.html` : `${l}/airlines/${code}.html`;
}
const myPagePath = (l: Lang) => (l === 'ja' ? 'profile.html' : `${l}/profile.html`);
const unsubPath = (l: Lang) => (l === 'ja' ? 'unsubscribe.html' : 'en/unsubscribe.html');   // 解除の画面はスペイン語版が無い

/* ── 文面（下書き・2026-11-07 オーナー「OpenWork のように中身を出して」）────────────────
   会社ごとに：見出し（フォロー中の／あなたが見た ◯◯に、新しい情報が入りました）→ 新しい口コミ（評価・職位・在籍年数・最初の80字・続きを見る）
   → 新しい給与（入ったことだけ。金額はサイトで）→ 待遇の回答が入った質問の名前。
   給与の鍵が無い人には、最後に「すべての給与と口コミを見るには」＋ボタン（ボタンの字は2通目と同じオーナーの字）。
   ★書くのはサイトで誰にでも見せている範囲だけ（SQL もそれ以上は返さない）。 */
export type Review = {
  score?: number | null; pos_ja?: string | null; pos_en?: string | null; tenure?: string | null; orig?: string | null;
  text?: Record<string, string> | null; tr?: Record<string, Record<string, string>> | null;
};
export type Item = {
  code: string; ja?: string | null; en?: string | null; page?: boolean | null; why?: 'follow' | 'seen' | string | null;
  kinds: Kind[]; reviews?: Review[] | null; conds?: { ja?: string; en?: string }[] | null;
};
const ORDER = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];
/* 抜粋の本文：受け取る人の言語の訳があればそれ、無ければ元の字。欄の順に並べる（サイトと同じ）。 */
export function excerptOf(r: Review, l: Lang): string {
  const pick = (o: Record<string, string> | null | undefined, suffix: string) =>
    o ? ORDER.map((k) => String(o[k + suffix] || '')).filter(Boolean).join(' ') : '';
  const orig = String(r?.orig || '').toLowerCase();
  if (orig === l || (!orig && l === 'ja')) return pick(r?.text, '_comment');
  const tr = r?.tr && (r.tr[l] || (l === 'es' ? r.tr.en : null));
  return (tr && pick(tr, '')) || pick(r?.text, '_comment');
}
export function tenureText(b: string | null | undefined, l: Lang): string {
  const m = /^(\d+)-(\d+)$/.exec(String(b || '')), p = /^(\d+)\+$/.exec(String(b || ''));
  if (m) return l === 'ja' ? `在籍${m[1]}〜${m[2]}年` : l === 'es' ? `${m[1]}–${m[2]} años en la aerolínea` : `${m[1]}–${m[2]} yrs at airline`;
  if (p) return l === 'ja' ? `在籍${p[1]}年以上` : l === 'es' ? `${p[1]}+ años en la aerolínea` : `${p[1]}+ yrs at airline`;
  return '';
}
const W = {
  ja: {
    follow: (n: string) => `フォロー中の${n}に、新しい情報が入りました`,
    seen: (n: string) => `あなたが見た${n}に、新しい情報が入りました`,
    subjOneRv: (n: string) => `${n}に新しい口コミが入りました`, subjOne: (n: string) => `${n}に新しい情報が入りました`,
    subjMany: (n: string) => `${n}など、気になる会社に新しい情報が入りました`,
    rv: '新しい口コミ', more: '続きを見る', pay: '新しい給与が入りました',
    payLocked: '金額は、ご自身の給与を1件共有すると見られます。', payOpen: 'REAL PAY で見る',
    cond: '待遇の回答が入った質問', see: 'ページを見る',
    allT: 'すべての給与と口コミを見るには', allCta: '自分の給与を匿名で共有する',
    note: 'フォローする会社はマイページで変えられます。見た会社には30日のあいだお知らせします。', my: 'マイページを開く',
    sign: 'PILOT VALUE 運営 team',
    foot: 'このメールは、PILOT VALUE にご登録いただき、通知を希望された方にお送りしています。', unsub: '配信を停止する',
    sep: '・',
  },
  en: {
    follow: (n: string) => `New information at ${n}, which you follow`,
    seen: (n: string) => `New information at ${n}, which you viewed`,
    subjOneRv: (n: string) => `New reviews at ${n}`, subjOne: (n: string) => `New information at ${n}`,
    subjMany: (n: string) => `New information at ${n} and other airlines`,
    rv: 'New reviews', more: 'Read more', pay: 'New pay has been added',
    payLocked: 'Share one record of your own pay to see the amounts.', payOpen: 'See on REAL PAY',
    cond: 'New answers on working conditions', see: 'See the page',
    allT: 'To see all pay and reviews', allCta: 'Share your pay anonymously',
    note: 'You can change the airlines you follow on My Page. We tell you about airlines you viewed for 30 days.', my: 'Open My Page',
    sign: 'The PILOT VALUE team',
    foot: 'You are receiving this because you signed up for PILOT VALUE and asked for notifications.', unsub: 'Unsubscribe',
    sep: ' · ',
  },
  es: {
    follow: (n: string) => `Nueva información sobre ${n}, que sigues`,
    seen: (n: string) => `Nueva información sobre ${n}, que viste`,
    subjOneRv: (n: string) => `Nuevas reseñas sobre ${n}`, subjOne: (n: string) => `Nueva información sobre ${n}`,
    subjMany: (n: string) => `Nueva información sobre ${n} y otras aerolíneas`,
    rv: 'Nuevas reseñas', more: 'Seguir leyendo', pay: 'Se agregó una nueva remuneración',
    payLocked: 'Comparte un registro de tu remuneración para ver los montos.', payOpen: 'Ver en REAL PAY',
    cond: 'Nuevas respuestas sobre condiciones de trabajo', see: 'Ver la página',
    allT: 'Para ver toda la remuneración y las reseñas', allCta: 'Comparte tu remuneración de forma anónima',
    note: 'Puedes cambiar las aerolíneas que sigues en Mi página. Te avisamos de las aerolíneas que viste durante 30 días.', my: 'Abrir Mi página',
    sign: 'El equipo de PILOT VALUE',
    foot: 'Recibes este correo porque te registraste en PILOT VALUE y pediste recibir notificaciones.', unsub: 'Cancelar la suscripción',
    sep: ' · ',
  },
};
const realPayPath = (l: Lang) => (l === 'ja' ? 'actual-pay.html' : `${l}/actual-pay.html`);
const payPath = (l: Lang) => (l === 'ja' ? 'pay-report.html#ps' : `${l}/pay-report.html#ps`);

export type Section = {
  head: string; page: string;
  reviews: { meta: string; text: string; more: string }[];
  pay: null | { t: string; note: string; link: string };
  conds: string[];
};
export type FollowCopy = {
  subject: string; sections: Section[]; all: null | { t: string; cta: { label: string; href: string } };
  note: string; noteLink: { label: string; href: string }; sign: string; foot: string; unsub: string;
  w: typeof W.ja;
};
export function followCopy(l: Lang, items: Item[], hasKey: boolean, site = SITE_URL): FollowCopy {
  const w = W[l];
  const nameOf = (it: Item) => String((l === 'ja' ? it.ja : it.en) || it.en || it.ja || it.code);
  const sections: Section[] = items.map((it) => {
    const page = it.page ? `${site}/${airlinePath(l, it.code)}` : '';
    const reviews = (it.reviews || []).map((r) => {
      const pos = l === 'ja' ? r.pos_ja : r.pos_en;
      const meta = [typeof r.score === 'number' ? `★${r.score.toFixed(1)}` : '', [pos, tenureText(r.tenure, l)].filter(Boolean).join(w.sep)]
        .filter(Boolean).join('　');
      return { meta, text: excerptOf(r, l), more: page ? `${page}#reviews` : '' };
    }).filter((x) => x.text || x.meta);
    const pay = (it.kinds || []).includes('pay')
      ? { t: w.pay, note: hasKey ? '' : w.payLocked, link: hasKey ? `${site}/${realPayPath(l)}` : '' } : null;
    const conds = (it.conds || []).map((c) => String((l === 'ja' ? c.ja : c.en) || c.en || c.ja || '')).filter(Boolean);
    return { head: it.why === 'seen' ? w.seen(nameOf(it)) : w.follow(nameOf(it)), page, reviews, pay, conds };
  });
  const first = items[0] ? nameOf(items[0]) : '';
  const subject = items.length > 1 ? w.subjMany(first)
    : (sections[0] && sections[0].reviews.length ? w.subjOneRv(first) : w.subjOne(first));
  return {
    subject, sections,
    all: hasKey ? null : { t: w.allT, cta: { label: w.allCta, href: `${site}/${payPath(l)}` } },
    note: w.note, noteLink: { label: w.my, href: `${site}/${myPagePath(l)}` },
    sign: w.sign, foot: w.foot, unsub: w.unsub, w,
  };
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const dividerFor = (next: Lang) => `
    <div style="margin:6px 0 26px;border-top:1px solid #e6e9ef"></div>
    <p style="margin:0 0 18px;color:#9aa5b1;font-size:11px">${next === 'ja' ? '日本語は下に続きます。' : 'English follows.'}</p>`;

export function buildFollow(p: Person, o: { siteUrl?: string; supabaseUrl?: string; lang?: Lang | 'both' } = {}) {
  const site = String(o.siteUrl ?? SITE_URL ?? 'https://pilot-value.com').replace(/\/+$/, '');
  const sb = String(o.supabaseUrl ?? SUPABASE_URL ?? '').replace(/\/+$/, '');
  const lang = o.lang || followLangOf(p);
  const langs: Lang[] = lang === 'both' ? BOTH_ORDER : [lang];
  const items = (p?.items || []).filter((it) => it && it.code && Array.isArray(it.kinds) && it.kinds.length);
  const tok = encodeURIComponent(p?.unsub_token || '');
  const unsubPage = (l: Lang) => `${site}/${unsubPath(l)}?token=${tok}`;
  const oneClickUrl = sb ? `${sb}/functions/v1/remind-payslip?u=${tok}` : '';
  const parts = langs.map((l) => ({ l, t: followCopy(l, items, p?.has_key === true, site) }));
  const subject = parts.map((x) => x.t.subject).join(' / ');
  const A = (href: string, label: string) => `<a href="${esc(href)}" style="color:#067563;font-weight:700">${esc(label)}</a>`;
  const sectionHtml = (s: Section, w: FollowCopy['w']) => `
    <div style="margin:0 0 16px;border:1px solid #e6e9ef;border-radius:12px;overflow:hidden">
      <p style="margin:0;padding:14px 16px;background:#f7f8fa;color:#111;font-weight:800">${esc(s.head)}</p>
      <div style="padding:6px 16px 14px">
      ${s.reviews.length ? `<p style="margin:10px 0 4px;color:#6b7280;font-size:12px;font-weight:700">${esc(w.rv)}</p>` : ''}
      ${s.reviews.map((r) => `
        <div style="padding:10px 0;border-top:1px solid #eef0f4">
          ${r.meta ? `<p style="margin:0 0 4px;color:#111;font-weight:700;font-size:13px">${esc(r.meta)}</p>` : ''}
          ${r.text ? `<p style="margin:0;color:#333">${esc(r.text)}${r.more ? ` ${A(r.more, w.more)}` : ''}</p>` : ''}
        </div>`).join('')}
      ${s.pay ? `
        <div style="padding:10px 0;border-top:1px solid #eef0f4">
          <p style="margin:0;color:#111;font-weight:700">${esc(s.pay.t)}</p>
          ${s.pay.note ? `<p style="margin:2px 0 0;color:#6b7280;font-size:12px">${esc(s.pay.note)}</p>` : ''}
          ${s.pay.link ? `<p style="margin:6px 0 0">${A(s.pay.link, w.payOpen)}</p>` : ''}
        </div>` : ''}
      ${s.conds.length ? `
        <div style="padding:10px 0;border-top:1px solid #eef0f4">
          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;font-weight:700">${esc(w.cond)}</p>
          ${s.conds.map((c) => `<p style="margin:0;color:#333">・${esc(c)}</p>`).join('')}
        </div>` : ''}
      ${s.page ? `<p style="margin:10px 0 0">${A(s.page, w.see + ' →')}</p>` : ''}
      </div>
    </div>`;
  const blockHtml = (t: FollowCopy) => `
    ${t.sections.map((s) => sectionHtml(s, t.w)).join('')}
    ${t.all ? `
    <div style="margin:6px 0 14px;padding:16px 14px 14px;background:#f7f8fa;border-radius:12px">
      <p style="margin:0 0 12px;color:#111;font-weight:800">${esc(t.all.t)}</p>
      <a href="${esc(t.all.cta.href)}" style="display:inline-block;background:#f5c842;color:#111;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;line-height:1.4">${esc(t.all.cta.label)}</a>
    </div>` : ''}
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px">${esc(t.note)} <a href="${esc(t.noteLink.href)}" style="color:#6b7280">${esc(t.noteLink.label)}</a></p>
    <p style="margin:18px 0 0;color:#333">${esc(t.sign)}</p>`;
  const blockText = (t: FollowCopy) => [
    ...t.sections.flatMap((s) => [
      `■ ${s.head}`,
      ...(s.reviews.length ? [t.w.rv] : []),
      ...s.reviews.flatMap((r) => [r.meta, r.text + (r.more ? ` ${t.w.more}: ${r.more}` : ''), '']),
      ...(s.pay ? [s.pay.t, ...(s.pay.note ? [s.pay.note] : []), ...(s.pay.link ? [`${t.w.payOpen}: ${s.pay.link}`] : []), ''] : []),
      ...(s.conds.length ? [t.w.cond, ...s.conds.map((c) => `・${c}`), ''] : []),
      ...(s.page ? [`${t.w.see}: ${s.page}`, ''] : []),
    ]),
    ...(t.all ? [t.all.t, `▶ ${t.all.cta.label}: ${t.all.cta.href}`, ''] : []),
    `${t.note} ${t.noteLink.href}`, '',
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
  return { lang, subject, html, text, unsubUrl: unsubPage(langs[0]), oneClickUrl, items: items.length };
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

async function send(p: Person) {
  const m = buildFollow(p, { siteUrl: SITE_URL, supabaseUrl: SUPABASE_URL });
  if (!m.items) return null;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
      /* ★1人1日1通。記録が書けずに次の回でもう一度選ばれても、Resend 側で1通に畳まれる。 */
      'Idempotency-Key': followKey(p),
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

  const due = ((await rpc('pv_follow_due', { p_limit: MAX_PER_RUN })) as Person[]) || [];
  const tally: Record<string, number> = { ja: 0, en: 0, es: 0, both: 0 };

  /* ★人数だけを返す。宛先も氏名も会社もログに残さない。 */
  if (body?.dry === true) {
    for (const p of due) tally[followLangOf(p)]++;
    return json({ ok: true, dry: true, due: due.length, ...tally });
  }

  let sent = 0, failed = 0;
  for (const p of due) {
    let ok = false;
    try { const l = await send(p); if (l) { tally[l]++; ok = true; sent++; } } catch (e) {
      failed++;
      console.error('send failed', String(e).slice(0, 200));
    }
    try { await rpc('pv_follow_mark', { p_id: p.id, p_ok: ok, p_upto: p.upto ?? null }); } catch (e) {
      console.error('mark failed', String(e).slice(0, 200));
      return json({ ok: false, error: 'mark failed', sent, failed, ...tally }, 500);
    }
    await new Promise((r) => setTimeout(r, 260)); // Resend の秒間上限に当てない
  }
  return json({ ok: true, due: due.length, sent, failed, ...tally });
}

if (DENO?.serve) DENO.serve(handler);
