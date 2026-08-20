/* ════════════════════════════════════════════════════════════════
   notify-admin — 新着を即時に info@pilot-value.com へ知らせる Edge Function

   これまで管理者通知は mail-bot/admin-notify.mjs を手で叩いたときしか
   飛んでいなかった（cron も GitHub Actions も無い）。この関数を
   Database Webhook から呼ぶことで、投稿・登録・問い合わせの瞬間に届く。

   1本で3つのテーブルを捌く：
     reviews_v2 … 新着口コミ（品質フラグ付き）
     profiles   … 新規会員
     contacts   … お問い合わせ（返信先を投稿者のメールに設定）

   ── 設計上の約束（translate-review と同じ）──────────────────
   1. 本文は必ず DB から読み直す。webhook のペイロードに入っている
      本文は信用しない。外から偽ペイロードを投げられても、実在する行の
      内容しかメールにならない＝嘘の通知を送り込まれない。
   2. 冪等。Resend の Idempotency-Key に "<table>:<id>" を渡すので、
      同じ行で二度呼ばれても24時間以内なら送信は1回きり。
   3. 失敗しても 200 を返す。webhook の再送ループを避ける。
      通知が1通落ちるより、送信が暴走する方が痛い。
   4. 本文の全文はメールに載せない（抜粋のみ）。管理者の受信箱に
      口コミ全文を溜めないため。全文は Supabase 側で見る。

   ── デプロイ（オーナー作業）────────────────────────────────
   Supabase → Edge Functions → Deploy a new function → Via Editor
     関数名: notify-admin ／ このファイルの中身を貼り付け → Deploy

   必要な secret（Edge Functions → Secrets）:
     RESEND_API_KEY    … 必須。mail-bot/.env にあるものと同じ値でよい
                         （送信専用の制限キーなので、漏れても送信しかできない）
     ADMIN_EMAIL       … 任意。既定 info@pilot-value.com
     FROM_EMAIL        … 任意。既定 PILOT VALUE <noreply@pilot-value.com>
     PV_WEBHOOK_SECRET … 任意。設定した場合は webhook 側の HTTP ヘッダに
                         x-pv-webhook-secret として同じ値を入れる。
   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で入れる。

   ── Webhook（オーナー作業・3本つくる）──────────────────────
   Database → Webhooks → Create a new hook
     Table: reviews_v2 ／ Events: Insert ／ Type: Supabase Edge Functions → notify-admin
     Table: profiles   ／ Events: Insert ／ Type: Supabase Edge Functions → notify-admin
     Table: contacts   ／ Events: Insert ／ Type: Supabase Edge Functions → notify-admin
   ════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('PV_WEBHOOK_SECRET') ?? '';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? 'info@pilot-value.com';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'PILOT VALUE <noreply@pilot-value.com>';

const CAT_KEYS = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'] as const;
const POS: Record<string, string> = { captain: '機長', fo: '副操縦士', cadet: '訓練生' };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

/* ────────────────────────────────────────────────────────────
   口コミ品質チェック。submit-review.html / mail-bot/admin-notify.mjs と
   同一ロジックをそのまま移植している。フォームを通さず API に直接
   投稿された水増し・連打を管理者が気付けるようにするための仕掛けなので、
   即時通知に移してもここは落とさない。
   ⚠️ 同じ関数が5か所にある（submit-review.html / en/submit-review.html /
   mail-bot/admin-notify.mjs / mail-bot/delete-review.mjs / ここ）。直すときは5つとも直す。
   実際に判定5だけフォーム側を直して残り4つを直し忘れ、本物の投稿に警告が付いたことがある。
   ──────────────────────────────────────────────────────── */
function assessReviewQuality(raw: string): { ok: boolean; reason: string } {
  const t = (raw || '').replace(/\s+/g, ' ').trim();
  const len = t.length;
  if (len === 0) return { ok: true, reason: '' };
  // 1) 同一文字の連打
  if (/(.)\1{4,}/u.test(t)) return { ok: false, reason: '同一文字の連打' };
  // 2) 同一語句の反復
  const rep = t.match(/(.{2,}?)\1{2,}/u);
  if (rep && rep[0].length >= Math.max(12, len * 0.5)) return { ok: false, reason: '同一語句の反復' };
  // 3) 文字種過少（水増し）
  const uniq = new Set(t.replace(/\s/g, '')).size;
  if (len >= 40 && uniq < 10) return { ok: false, reason: '文字種過少（水増し）' };
  // 4) ラテン乱打（母音欠落）：英字12文字以上で母音率15%未満
  const latin = t.match(/[A-Za-z]/g) || [];
  if (latin.length >= 12) {
    const vowels = t.match(/[AEIOUaeiou]/g) || [];
    if (vowels.length / latin.length < 0.15) return { ok: false, reason: 'ラテン乱打（母音欠落）' };
  }
  // 5) 二連字多様性の欠落（機械的な反復パターン）
  //    ⚠️ 多様性を全長で割ってはいけない。異なり2連字はアルファベットの大きさで頭打ちになる一方、
  //    分母は長さに比例して伸び続けるので、本物の文章ほど必ず比率が下がる。英語は26文字＝実測で
  //    約350通りしかなく、実際の口コミで合計1,100字（日本語は約1,400字）を超えると 0.35 を割った。
  //    投稿は合計300字以上が必須なので、丁寧に書いた人だけが弾かれる作りになっていた。
  //    固定長の窓で測り最悪値で判定する。長さに依存しない。
  if (len >= 40) {
    const ns = t.replace(/\s/g, '');
    const WIN = 200, STEP = 100;
    const diversity = (s: string): number => {
      const grams: string[] = [];
      for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
      return grams.length >= 8 ? new Set(grams).size / grams.length : 1;
    };
    let worst = ns.length <= WIN ? diversity(ns) : 1;
    for (let i = 0; i + WIN <= ns.length; i += STEP) worst = Math.min(worst, diversity(ns.slice(i, i + WIN)));
    if (ns.length > WIN) worst = Math.min(worst, diversity(ns.slice(-WIN)));   // 刻みが届かない末尾も見る
    if (worst < 0.35) return { ok: false, reason: '低多様性の反復' };
  }
  return { ok: true, reason: '' };
}

/* カテゴリ間の同一段落コピペ検知（submit-review.html assessReviewSet と同一）。 */
function assessReviewSet(comments: string[]): { ok: boolean; reason: string } {
  const norm = (s: string) => (s || '').replace(/【[^】]*】/g, '').replace(/\s+/g, '').toLowerCase();
  const items = comments.map(norm).filter((n) => n.length >= 20);
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const sim = (a: string, b: string) => {
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length);
    const A = bigrams(a), B = bigrams(b);
    let inter = 0;
    for (const g of A) if (B.has(g)) inter++;
    const uni = A.size + B.size - inter;
    return uni ? inter / uni : 0;
  };
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (sim(items[i], items[j]) > 0.8) return { ok: false, reason: 'カテゴリ間コピペ' };
  return { ok: true, reason: '' };
}

async function sbSelect(table: string, id: string, select: string) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(select)}`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) throw new Error(`${table} REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

const shell = (title: string, lead: string, inner: string) =>
  `<div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:720px;margin:0 auto;color:#111">
    <h2 style="font-size:18px;margin:0 0 4px">${title}</h2>
    <p style="color:#666;font-size:13px;margin:0 0 20px">${lead}</p>
    ${inner}
    <p style="color:#999;font-size:11px;margin-top:24px">
      このメールは管理者宛の自動通知です（Edge Function: notify-admin）。
      本文全文は Supabase の Table editor で確認してください。
    </p>
  </div>`;

const row = (k: string, v: string) =>
  `<tr>
    <th style="padding:8px 12px 8px 0;border-bottom:1px solid #eee;text-align:left;white-space:nowrap;color:#555;font-weight:600">${esc(k)}</th>
    <td style="padding:8px 0;border-bottom:1px solid #eee">${v}</td>
  </tr>`;

const table = (rows: string) =>
  `<table style="border-collapse:collapse;width:100%;font-size:13px">${rows}</table>`;

type Mail = { subject: string; html: string; replyTo?: string };

/* ── reviews_v2 ───────────────────────────────────────────── */
async function buildReview(id: string): Promise<Mail | null> {
  const select = ['id', 'airline', 'position', 'age_bucket', 'tenure_bucket', 'fleet', 'job_role',
    'monthly_salary', 'annual_salary', 'created_at', ...CAT_KEYS.map((k) => `${k}_comment`)].join(',');
  const r = await sbSelect('reviews_v2', id, select);
  if (!r) return null;

  const comments = CAT_KEYS.map((k) => String(r[`${k}_comment`] ?? '').trim()).filter(Boolean);
  const combined = comments.join(' ');
  const qText = assessReviewQuality(combined);
  const q = qText.ok ? assessReviewSet(comments) : qText;

  const salary = r.annual_salary ? `${r.annual_salary}万円/年`
    : r.monthly_salary ? `${r.monthly_salary}万円/月` : '—';
  const excerpt = combined.slice(0, 200);

  const flag = q.ok
    ? '<span style="color:#15803d">問題なし</span>'
    : `<span style="color:#b91c1c;font-weight:700">⚠️ ${esc(q.reason)} — 内容をご確認ください</span>`;

  return {
    subject: `【PILOT VALUE】新着口コミ — ${r.airline ?? '不明'}${q.ok ? '' : '（要確認）'}`,
    html: shell('新着の口コミが1件あります', `${esc(r.created_at)} に投稿されました。`, table(
      row('航空会社', esc(r.airline)) +
      row('職位 / 年代', `${esc(POS[r.position] ?? r.position ?? '—')} / ${esc(r.age_bucket ?? '—')}`) +
      row('在籍', esc(r.tenure_bucket ?? '—')) +
      row('機種 / 区分', `${esc(r.fleet ?? '—')} / ${esc(r.job_role ?? '—')}`) +
      row('年収', esc(salary)) +
      row('記入カテゴリ', `${comments.length} / ${CAT_KEYS.length}`) +
      row('品質チェック', flag) +
      row('本文抜粋', esc(excerpt) + (combined.length > 200 ? '…' : '')),
    )),
  };
}

/* ── profiles ─────────────────────────────────────────────── */
async function buildProfile(id: string): Promise<Mail | null> {
  const r = await sbSelect('profiles', id, 'id,name,email,company,position,country,created_at');
  if (!r) return null;
  return {
    subject: `【PILOT VALUE】新規会員登録 — ${r.name ?? r.email ?? '氏名なし'}`,
    html: shell('新規の会員登録が1件あります', `${esc(r.created_at)} に登録されました。`, table(
      row('氏名', esc(r.name ?? '—')) +
      row('メール', esc(r.email ?? '—')) +
      row('在籍 / 職位', `${esc(r.company ?? '—')} / ${esc(POS[r.position] ?? r.position ?? '—')}`) +
      row('居住国', esc(r.country ?? '—')),
    )),
  };
}

/* ── contacts ─────────────────────────────────────────────── */
async function buildContact(id: string): Promise<Mail | null> {
  const r = await sbSelect('contacts', id, 'id,name,email,tel,message,lang,created_at');
  if (!r) return null;
  const msg = String(r.message ?? '');
  // 問い合わせだけは全文を載せる。返信するのに要るし、量も1通分しかない。
  const body = esc(msg).replace(/\n/g, '<br>');
  return {
    subject: `【PILOT VALUE】お問い合わせ — ${r.name ?? '氏名なし'} 様`,
    replyTo: typeof r.email === 'string' && r.email.includes('@') ? r.email : undefined,
    html: shell('お問い合わせが1件あります',
      `${esc(r.created_at)} に送信されました（${esc(r.lang === 'en' ? '英語ページ' : '日本語ページ')}）。このメールにそのまま返信すれば送信者に届きます。`,
      table(
        row('氏名', esc(r.name ?? '—')) +
        row('メール', `<a href="mailto:${esc(r.email ?? '')}">${esc(r.email ?? '—')}</a>`) +
        row('電話', esc(r.tel || '—')) +
        row('内容', body || '—'),
      )),
  };
}

async function send(mail: Mail, idemKey: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
      // 同じ行で二度呼ばれても、24時間以内なら Resend 側で1通に畳まれる。
      'Idempotency-Key': idemKey,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [ADMIN_EMAIL],
      subject: mail.subject,
      html: mail.html,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json().catch(() => ({}));
  return data?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (WEBHOOK_SECRET && req.headers.get('x-pv-webhook-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }
  if (!RESEND_KEY) return json({ error: 'RESEND_API_KEY is not set' }, 500);
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'supabase env missing' }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* 空ボディは疎通確認とみなす */ }

  // Database Webhook は {type, table, record, old_record} を送る。
  // 疎通確認用に {"table":"...","id":"..."} も受ける（本文は常に DB から読む）。
  const record = body.record as { id?: string } | undefined;
  const tbl = typeof body.table === 'string' ? body.table : '';
  const id = record?.id ?? (typeof body.id === 'string' ? body.id : '');
  const type = typeof body.type === 'string' ? body.type : 'INSERT';

  if (!tbl || !id) return json({ ok: true, note: 'no table/id in payload' });
  if (type !== 'INSERT') return json({ ok: true, note: `ignored event ${type}` });

  const builders: Record<string, (id: string) => Promise<Mail | null>> = {
    reviews_v2: buildReview,
    profiles: buildProfile,
    contacts: buildContact,
  };
  const build = builders[tbl];
  if (!build) return json({ ok: true, note: `unhandled table ${tbl}` });

  try {
    const mail = await build(id);
    if (!mail) return json({ ok: true, table: tbl, id, status: 'row_not_found' });
    const mailId = await send(mail, `${tbl}:${id}`);
    return json({ ok: true, table: tbl, id, status: 'sent', mailId });
  } catch (e) {
    // 再送ループを避けるため、失敗しても 200。詳細はレスポンスとログに残す。
    console.error('notify-admin failed', tbl, id, String(e));
    return json({ ok: true, table: tbl, id, status: 'error', detail: String(e).slice(0, 300) });
  }
});
