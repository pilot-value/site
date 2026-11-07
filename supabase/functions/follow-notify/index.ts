/* ════════════════════════════════════════════════════════════════
   follow-notify — フォローしている会社に新着（給与・口コミ・待遇の答え）が入ったら知らせる（2026-11-07）

   オーナー採用（2026-11-07）：自分の会社は最初からフォロー済み・新着が入ったらすぐ別のメール。
   ── 誰に・何を（決めるのは SQL の pv_follow_due の1か所：db/follow.sql）──────
     ・1時間おき（毎時7分）に呼ばれ、前に送った時刻（またはフォローを始めた時刻）より後の新着をまとめて1通
     ・1人24時間に1通まで・自分が出した分では知らせない・テスト用アカウントの投稿では知らせない
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
     POST / + header x-pv-cron-secret          … 送る（pg_cron が1時間おきに叩く）
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
export type Item = { code: string; ja?: string | null; en?: string | null; page?: boolean | null; kinds: Kind[] };
export type Person = {
  id?: string; email?: string; name?: string | null; country?: string | null;
  airline_region?: string | null; lang?: string | null; unsub_token?: string; items?: Item[] | null;
};

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

/* ── 文面（下書き）──────────────────────────────────────────── */
const KIND_WORD: Record<Lang, Record<Kind, string>> = {
  ja: { pay: '給与', review: '口コミ', cond: '待遇の回答' },
  en: { pay: 'pay', review: 'reviews', cond: 'working conditions' },
  es: { pay: 'remuneración', review: 'reseñas', cond: 'condiciones de trabajo' },
};
export type FollowCopy = {
  subject: string; lead: string; lines: { name: string; what: string; href: string; see: string }[];
  note: string; noteLink: { label: string; href: string }; sign: string; foot: string; unsub: string;
};
export function followCopy(l: Lang, items: Item[], site = SITE_URL): FollowCopy {
  const nameOf = (it: Item) => String((l === 'ja' ? it.ja : it.en) || it.en || it.ja || it.code);
  const kinds = (it: Item) => {
    const w = (it.kinds || []).map((k) => KIND_WORD[l][k]).filter(Boolean);
    return l === 'ja' ? w.join('・') : w.join(', ');
  };
  const one = items.length === 1 ? nameOf(items[0]) : '';
  const see = l === 'ja' ? 'ページを見る' : l === 'es' ? 'Ver la página' : 'See the page';
  const lines = items.map((it) => ({
    name: nameOf(it),
    what: l === 'ja' ? `新しい${kinds(it)}` : l === 'es' ? `Nueva información: ${kinds(it)}` : `New ${kinds(it)}`,
    href: it.page ? `${site}/${airlinePath(l, it.code)}` : '',
    see,
  }));
  const my = `${site}/${myPagePath(l)}`;
  if (l === 'ja') {
    return {
      subject: one ? `${one}に新しい情報が入りました` : 'フォロー中の会社に新しい情報が入りました',
      lead: 'フォロー中の会社に、パイロットから新しい情報が届きました。',
      lines,
      note: 'フォローする会社は、マイページで変えられます。',
      noteLink: { label: 'マイページを開く', href: my },
      sign: 'PILOT VALUE 運営 team',
      foot: 'このメールは、PILOT VALUE で会社をフォローし、通知を希望された方にお送りしています。',
      unsub: '配信を停止する',
    };
  }
  if (l === 'es') {
    return {
      subject: one ? `Nueva información sobre ${one}` : 'Nueva información sobre las aerolíneas que sigues',
      lead: 'Hay nueva información de pilotos sobre las aerolíneas que sigues.',
      lines,
      note: 'Puedes cambiar las aerolíneas que sigues en Mi página.',
      noteLink: { label: 'Abrir Mi página', href: my },
      sign: 'El equipo de PILOT VALUE',
      foot: 'Recibes este correo porque sigues aerolíneas en PILOT VALUE y pediste recibir notificaciones.',
      unsub: 'Cancelar la suscripción',
    };
  }
  return {
    subject: one ? `New on PILOT VALUE: ${one}` : 'New information on airlines you follow',
    lead: 'Pilots have shared new information about airlines you follow.',
    lines,
    note: 'You can change the airlines you follow on My Page.',
    noteLink: { label: 'Open My Page', href: my },
    sign: 'The PILOT VALUE team',
    foot: 'You are receiving this because you follow airlines on PILOT VALUE and asked for notifications.',
    unsub: 'Unsubscribe',
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
  const parts = langs.map((l) => ({ l, t: followCopy(l, items, site) }));
  const subject = parts.map((x) => x.t.subject).join(' / ');
  const blockHtml = (t: FollowCopy) => `
    <p style="margin:0 0 18px;color:#111;font-weight:800;font-size:16px">${esc(t.lead)}</p>
    ${t.lines.map((x) => `
    <div style="margin:0 0 10px;padding:14px;background:#f7f8fa;border-radius:12px">
      <p style="margin:0;color:#111;font-weight:800">${esc(x.name)}</p>
      <p style="margin:2px 0 0;color:#333">${esc(x.what)}</p>
      ${x.href ? `<p style="margin:8px 0 0"><a href="${esc(x.href)}" style="color:#067563;font-weight:700">${esc(x.see)} →</a></p>` : ''}
    </div>`).join('')}
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px">${esc(t.note)} <a href="${esc(t.noteLink.href)}" style="color:#6b7280">${esc(t.noteLink.label)}</a></p>
    <p style="margin:18px 0 0;color:#333">${esc(t.sign)}</p>`;
  const blockText = (t: FollowCopy) => [
    t.lead, '',
    ...t.lines.flatMap((x) => [x.name, x.what, ...(x.href ? [`${x.see}: ${x.href}`] : []), '']),
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
  const day = new Date().toISOString().slice(0, 10);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
      /* ★1人1日1通。記録が書けずに次の回でもう一度選ばれても、Resend 側で1通に畳まれる。 */
      'Idempotency-Key': `follow:${p.id}:${day}`,
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
    try { await rpc('pv_follow_mark', { p_id: p.id, p_ok: ok }); } catch (e) {
      console.error('mark failed', String(e).slice(0, 200));
      return json({ ok: false, error: 'mark failed', sent, failed, ...tally }, 500);
    }
    await new Promise((r) => setTimeout(r, 260)); // Resend の秒間上限に当てない
  }
  return json({ ok: true, due: due.length, sent, failed, ...tally });
}

if (DENO?.serve) DENO.serve(handler);
