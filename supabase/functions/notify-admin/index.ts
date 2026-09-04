/* ════════════════════════════════════════════════════════════════
   notify-admin — 新着を即時に info@pilot-value.com へ知らせる Edge Function

   これまで管理者通知は mail-bot/admin-notify.mjs を手で叩いたときしか
   飛んでいなかった（cron も GitHub Actions も無い）。この関数を
   Database Webhook から呼ぶことで、投稿・登録・問い合わせの瞬間に届く。

   1本で6つのテーブルを捌く：
     reviews_v2          … 新着口コミ（品質フラグ付き）
     profiles            … 新規会員
     contacts            … お問い合わせ（返信先を投稿者のメールに設定）
     pay_reports         … 給与レポート（★金額は載せない）
     pay_reports_pending … 会員登録せずに出した給与レポート（預かり）
     airline_conditions  … 待遇アンケートの回答（1問＝1通）

   ★ 金額をメールに載せないのは決めごと。給与レポートは user_id を持たない設計で
     「誰がいくら」を運営側に残さない（db/pay-reports.sql）。1件単位の報酬額を
     メールにすると、受信箱と Resend の送信ログに残る＝設計で守ったものを
     送信で外に出すことになる。金額は Supabase の Table editor で見る。
     手元の `node assert-admin-notify.mjs` が、漏れていないことを毎回確かめる。

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

   ── Webhook（オーナー作業・6本つくる）──────────────────────
   db/notify-admin-webhooks.sql を SQL Editor に貼って Run するのが早い（6本まとめて作る）。
   画面から作る場合は Database → Webhooks → Create a new hook を6回。
   いずれも Events: Insert のみ ／ Type: Supabase Edge Functions → notify-admin
     reviews_v2 ／ profiles ／ contacts ／
     pay_reports ／ pay_reports_pending ／ airline_conditions
   ★ Insert のみに固定する。口コミの自動翻訳の UPDATE で二重に飛ぶのを防ぐのと、
     給与レポートの出し直し（on conflict do update）で通知が増えないようにするため。
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

/* 任意の条件で引く。sbSelect は id=eq.<id> 固定なので、
   「この人がこれまでに何問答えたか」のような数え上げはこちらを使う。 */
async function sbList(table: string, query: string, select: string) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}&select=${encodeURIComponent(select)}`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) throw new Error(`${table} REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
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

/* 役職・区分は 2026-08-26 から**複数**選べる（オーナー指示）。入っている場所が
   2つに分かれているので、ここで1つの言い方に揃える。
     給与   pay_reports.job_roles（text[]）… 単数の job_role には先頭が残る
     口コミ reviews_v2.job_role（text）… カンマ区切り（列を足せないため）
   ★コードをそのまま出す。日本語名に直すと語彙の写しをここに持つことになり、
     pv_job_roles を増やしたときに黙って古いままになる。 */
const roles = (arr: unknown, one: unknown): string => {
  const list = Array.isArray(arr) && arr.length
    ? arr.map((x) => String(x))
    : String(one ?? '').split(',');
  const out = list.map((x) => x.trim()).filter(Boolean);
  return out.length ? out.join('・') : '—';
};

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
      row('機種 / 区分', `${esc(r.fleet ?? '—')} / ${esc(roles(null, r.job_role))}`) +
      row('年収', esc(salary)) +
      row('記入カテゴリ', `${comments.length} / ${CAT_KEYS.length}`) +
      row('品質チェック', flag) +
      row('本文抜粋', esc(excerpt) + (combined.length > 200 ? '…' : '')),
    )),
  };
}

/* ── profiles ─────────────────────────────────────────────── */
async function buildProfile(id: string): Promise<Mail | null> {
  const r = await sbSelect('profiles', id, 'id,name,email,company,position,country,email_opt_in,created_at');
  if (!r) return null;

  // ★ email が無い行は「新規登録」ではない。
  //   投稿・招待まわりの4つの RPC が、profiles の行が無い既存会員を救うために
  //   `insert into public.profiles (id) values (...)` を打つ（db/pay-reports.sql:660 ほか）。
  //   それも INSERT なので webhook が飛ぶ。本物の登録は handle_new_user が
  //   auth.users から必ず email を入れる（db/schema-additions.sql:81-）ので、
  //   ここが空なら補完の行だと断定できる。件名で区別しないと、中身が全部「—」の
  //   「新規会員登録 — 氏名なし」が新規登録として届き続ける。
  const real = typeof r.email === 'string' && r.email.includes('@');

  if (!real) {
    return {
      subject: '【PILOT VALUE】会員情報の行を作成（新規登録ではありません）',
      html: shell('会員情報の行が1件作られました',
        `${esc(r.created_at)} に作られました。<b>新規登録ではありません。</b>`
        + '既に登録済みの方が投稿・招待などをしたときに、欠けていた会員情報の行が'
        + '補われたものです。中身が空なのは正常です。',
        table(row('会員ID', esc(r.id)))),
    };
  }

  return {
    subject: `【PILOT VALUE】新規会員登録 — ${r.name ?? r.email}`,
    html: shell('新規の会員登録が1件あります', `${esc(r.created_at)} に登録されました。`, table(
      row('氏名', esc(r.name ?? '—')) +
      row('メール', esc(r.email)) +
      row('在籍 / 職位', `${esc(r.company ?? '—')} / ${esc(POS[r.position] ?? r.position ?? '—')}`) +
      row('居住国', esc(r.country ?? '—')) +
      row('メール受信の同意', r.email_opt_in ? 'あり' : 'なし'),
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

/* ── pay_reports ──────────────────────────────────────────── */
/* 給与レポート。
   ★ 金額は1つも載せない。SELECT にすら入れない＝事故で本文に出る道を作らない。
     明細の項目名も出さない（手当の呼び名は勤務先が割れる社内語彙になりうる）。
   ★ 出し直し（同じ社・同じ月）は on conflict do update ＝ UPDATE なのでここには
     来ない（下の dispatch が INSERT 以外を落とす）。新規のぶんだけ届く。
   ★ 登録前の預かりを後から本登録したぶんも、claim_pending_report が
     submit_pay_report を呼ぶので同じ経路で届く。 */
async function buildPayReport(id: string): Promise<Mail | null> {
  const r = await sbSelect('pay_reports', id,
    'id,created_at,airline,airline_other,period_year,period_month,position,fleet,job_role,job_roles,'
    + 'currency,source,lang,payslip_detail,pay_items');
  if (!r) return null;

  const ym = `${r.period_year}-${String(r.period_month).padStart(2, '0')}`;
  const co = r.airline_other ? `${r.airline}（${r.airline_other}）` : String(r.airline ?? '—');
  // 文言は db/usage.mjs の「入れ方」と揃える。同じものの言い方を増やさない。
  const how = r.source === 'payslip' ? '明細から' : '手入力';
  // 内訳は「何項目あったか」だけ。ラベルも金額も出さない。
  const lines = Array.isArray(r.payslip_detail?.earnings) ? r.payslip_detail.earnings.length : 0;
  /* ★本人が手で書いた内訳（変動給・その他の現金手当）も**行数だけ**。
     pay_items は「明細上の名称」を持っているので、ラベルは1文字も出さない
     （手当の呼び名は勤務先が割れる社内語彙になりうる）。 */
  const items = (Array.isArray(r.pay_items?.variable) ? r.pay_items.variable.length : 0)
              + (Array.isArray(r.pay_items?.other) ? r.pay_items.other.length : 0);

  return {
    subject: `【PILOT VALUE】給与レポート — ${r.airline ?? '不明'} / ${ym}`,
    html: shell('給与レポートが1件あります',
      `${esc(r.created_at)} に提出されました。`
      + '金額はメールに載せません（Supabase の pay_reports で確認してください）。',
      table(
        row('航空会社', esc(co)) +
        row('対象月', esc(ym)) +
        row('入れ方', esc(how)) +
        row('職位 / 機種', `${esc(POS[r.position] ?? r.position ?? '—')} / ${esc(r.fleet ?? '—')}`) +
        row('区分', esc(roles(r.job_roles, r.job_role))) +
        row('通貨', esc(r.currency ?? '—')) +
        row('明細の内訳', lines ? `${lines}項目` : 'なし') +
        row('本人が書いた内訳', items ? `${items}行` : 'なし') +
        row('言語', esc(r.lang === 'ja' ? '日本語' : r.lang ?? '—')),
      )),
  };
}

/* ── pay_reports_pending ──────────────────────────────────── */
/* 会員登録せずに給与明細を出した人（db/pay-report-pending.sql）。
   「出したのに登録しなかった」離脱が、この通知でしか見えない。
   ★ payload は SELECT しない。中に金額が丸ごと入っている。 */
async function buildPayReportPending(id: string): Promise<Mail | null> {
  const r = await sbSelect('pay_reports_pending', id,
    'id,created_at,airline,period_year,period_month,lang');
  if (!r) return null;

  const ym = `${r.period_year}-${String(r.period_month).padStart(2, '0')}`;

  return {
    subject: `【PILOT VALUE】給与レポート（登録前の預かり）— ${r.airline ?? '不明'} / ${ym}`,
    html: shell('会員登録前の給与レポートが1件あります',
      `${esc(r.created_at)} に出されました。まだ会員登録していない方です。`
      + '<b>登録が済むと「給与レポート」の通知がもう1通届きます。</b>'
      + '届かなければ、その方は登録せずに離脱しています。',
      table(
        row('航空会社', esc(r.airline)) +
        row('対象月', esc(ym)) +
        row('言語', esc(r.lang === 'ja' ? '日本語' : r.lang ?? '—')) +
        row('状態', '登録待ち'),
      )),
  };
}

/* ── airline_conditions ───────────────────────────────────── */
/* 待遇アンケート。1問答えるごとに1行入るので、1問ごとに1通届く。
   ★ スキップの行では送らない。skipped_at が立っていて答えの列は全部 null
     （db/airline-conditions.sql の ac_answer_any_ck）。これが無いと、
     質問を飛ばすたびに中身の無いメールが飛ぶ。
   ★ 金額の回答と自由記述は中身を出さない。answer_text はスキーマが
     「≤300字・非公開」と書いている列。
   ★ 選択肢のコード（yes / partial / unknown …）は日本語に直さずそのまま出す。
     ここに対応表を書くと語彙のコピーが増えて必ず本体とずれる
     （同じ品質判定が5か所に散って事故った前例がある）。 */
async function buildCondition(id: string): Promise<Mail | null> {
  const r = await sbSelect('airline_conditions', id,
    'id,created_at,proof_hash,airline,airline_other,question_id,'
    + 'answer_code,answer_codes,answer_num,answer_currency,answer_text,skipped_at,'
    + 'position,fleet,lang');
  if (!r) return null;
  if (r.skipped_at) return null;   // スキップは通知しない

  // question_id は pv_condition_questions の主キーなので、既存のヘルパがそのまま使える
  const q = await sbSelect('pv_condition_questions', r.question_id, 'id,label_ja,kind,has_currency');

  // 質問マスタが引けなかったときは「金額かもしれない」側に倒す（数値を出さない）
  const money = q ? (q.has_currency === true || r.answer_currency != null) : true;

  let ans: string;
  if (Array.isArray(r.answer_codes) && r.answer_codes.length) ans = r.answer_codes.join(' / ');
  else if (r.answer_code != null) ans = String(r.answer_code);
  else if (money) ans = '金額の回答あり（メールには載せません）';
  else if (r.answer_num != null) ans = String(r.answer_num);
  else if (r.answer_text != null) ans = '自由記述あり（メールには載せません）';
  else ans = '—';
  // 選択肢に自由記述が添えられている場合も、付いている事実だけは伝える
  if (r.answer_text != null && !ans.startsWith('自由記述')) ans += '（自由記述あり）';

  // この人の累計。skipped_at が null ＝ 答えた行（ac_answer_any_ck と、
  // 答え直しで skipped_at を null に戻す実装が保証している）。
  // ★ 数え上げに失敗しても通知そのものは落とさない。この通知の値打ちは
  //   「どの質問にどう答えたか」で、累計はおまけ。数えられなければ黙って省く。
  let total = '';
  try {
    const done = await sbList('airline_conditions',
      `proof_hash=eq.${encodeURIComponent(r.proof_hash)}&skipped_at=is.null`, 'id');
    const all = await sbList('pv_condition_questions', 'active=eq.true', 'id');
    if (all.length) total = `${done.length} / ${all.length}問`;
  } catch (e) {
    console.error('待遇の累計を数えられませんでした', String(e));
  }

  const co = r.airline_other ? `${r.airline}（${r.airline_other}）` : String(r.airline ?? '—');

  return {
    subject: `【PILOT VALUE】待遇アンケート — ${r.airline ?? '不明'}`,
    html: shell('待遇アンケートに回答が1件あります',
      `${esc(r.created_at)} に回答されました。1問ごとに1通届きます。`,
      table(
        row('航空会社', esc(co)) +
        row('質問', esc(q?.label_ja ?? r.question_id)) +
        row('答え', esc(ans)) +
        (total ? row('この人の累計', total) : '') +
        row('職位 / 機種', `${esc(POS[r.position] ?? r.position ?? '—')} / ${esc(r.fleet ?? '—')}`) +
        row('言語', esc(r.lang === 'ja' ? '日本語' : r.lang ?? '—')),
      )),
  };
}

/* ── pv_requests ──────────────────────────────────────────── */
/* ロードマップの画面から届く「こういう機能がほしい」。
   ★ author_hash を SELECT に入れない。事故で本文に出る道を作らない。
     あれは sha256(user_id ‖ 固定文字列) ＝ 同じ人なら毎回同じ値なので、
     メールに1度でも出れば「この12件は同じ人」が組めてしまう。
   ★ 表示するのは本文・区分・状態だけ。航空会社・職位・給与とは結びつけない
     （画面と同じ約束をメールでも守る）。
   ★ 本文は全文を載せる。返事をするのに要るし、1通ぶんしかない。
     ただし esc() を通してから <br> に直す（生の HTML をメールに通さない）。
   ★ ♡ では送らない。1押しごとにメールが来る（webhooks.sql の配列に
     pv_request_likes を入れていないのはこのため）。
     ★ 画像は「添付があるか」の真偽1つだけ。画素も URL もメールには載せない
       （メールは転送も保存もされる。確認は必ずサイトの画面で1回する）。 */
async function buildRequest(id: string): Promise<Mail | null> {
  const r = await sbSelect('pv_requests', id,
                           'id,created_at,body,category,status,visibility,image_state');
  if (!r) return null;
  const CAT: Record<string, string> = {
    feature: '機能', data: 'データ', ui: '使いやすさ', bug: '不具合', other: 'その他',
  };
  const body = esc(String(r.body ?? '')).replace(/\n/g, '<br>');
  const hasImg = String(r.image_state ?? 'none') !== 'none';
  return {
    subject: `【PILOT VALUE】要望 — ${CAT[String(r.category)] ?? 'その他'}`,
    html: shell('パイロットから要望が1件あります',
      `${esc(r.created_at)} に匿名で送信されました。誰が書いたかはこのメールには載りません。`,
      table(
        row('区分', esc(CAT[String(r.category)] ?? String(r.category ?? '—'))) +
        row('内容', body || '—') +
        row('公開範囲', String(r.visibility ?? 'public') === 'private'
              ? '運営だけに見せる（本人の指定）' : 'みんなに見える') +
        row('画像', hasImg ? '添付あり — 運営の確認が必要（要望の一覧で公開／見送りを選ぶ）'
                           : '添付なし') +
        row('状態', esc(String(r.status ?? 'new'))),
      )),
  };
}

/* 手元の検査（assert-admin-notify.mjs）が実体をそのまま動かせるように出す。
   translate-review/index.ts と同じ形。Deno 側では無害。 */
export { buildReview, buildProfile, buildContact, buildPayReport, buildPayReportPending, buildCondition, buildRequest };

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

  // ⚠️ ここに足したら db/notify-admin-webhooks.sql の表の配列にも足す。
  //    片方だけだと「実装は正しく見えるのに一通も届かない」という静かな壊れ方をする。
  //    assert-admin-notify.mjs が両者の顔ぶれの一致を見張っている。
  const builders: Record<string, (id: string) => Promise<Mail | null>> = {
    reviews_v2: buildReview,
    profiles: buildProfile,
    contacts: buildContact,
    pay_reports: buildPayReport,
    pay_reports_pending: buildPayReportPending,
    airline_conditions: buildCondition,
    pv_requests: buildRequest,
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
