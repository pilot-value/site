/* ════════════════════════════════════════════════════════════════
   translate-review — 新しい口コミを反対言語へ自動翻訳する Edge Function

   reviews_v2 に行が入ったら Database Webhook から呼ばれ、
   原文の言語を判定して反対言語の訳文を作り、その行の
   translations / orig_lang を埋める。表示側（review-i18n.js）は
   ページ言語に合わせて原文か訳文かを選ぶ。

   ── 設計上の約束 ──────────────────────────────────────────
   1. 本文は必ず DB から読み直す。webhook のペイロードに入っている
      本文は信用しない。外から偽のペイロードを投げられても、
      実在する未翻訳の行しか処理できない＝API 費用の踏み倒しが効かない。
   2. translations が既に入っている行は何もしない（冪等）。
      同じ行に何度呼ばれても課金は1回きり。
   3. 訳は忠実訳。要約・意訳・脚色・補足を禁じる（口コミの引用としての
      信頼性を壊さないため）。訳せない欄は出力しない＝表示側が原文に落とす。
   4. 失敗しても 200 を返す。webhook の再送ループで課金が膨らむより、
      訳が無い（＝原文表示）状態で止まる方が安全。
   5. 訳は2工程（訳す → 原文と突き合わせて直す）。人間の翻訳と同じ順序。
      1工程目だけだと「訳せてはいるが読んだ瞬間に機械翻訳と分かる」文が残る。
      2工程目が落ちても下訳は残す（原文表示に落とすより読み手には良い）。

   ── プロンプトを直すとき ──────────────────────────────────
   `node translate-eval.mjs` が **このファイルからプロンプトと翻訳の実体を切り出して**
   手元で走らせる（コピーを持たないので乖離しない）。ANTHROPIC_API_KEY は
   mail-bot/.env（gitignore 済み）。デプロイ往復せずに訳し比べられる。

   ── デプロイ（オーナー作業）────────────────────────────────
   Supabase → Edge Functions → Deploy a new function → Via Editor
     関数名: translate-review ／ このファイルの中身を貼り付け → Deploy

   必要な secret（Edge Functions → Secrets）:
     ANTHROPIC_API_KEY … 必須。console.anthropic.com で発行した sk-ant-...
     PV_WEBHOOK_SECRET … 任意。設定した場合は webhook 側の HTTP ヘッダに
                         x-pv-webhook-secret として同じ値を入れる。
   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で入れる。

   ── Webhook（オーナー作業）─────────────────────────────────
   Database → Webhooks → Create a new hook
     Table: reviews_v2 ／ Events: Insert ／ Type: Supabase Edge Functions
     → translate-review
   ════════════════════════════════════════════════════════════════ */

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('PV_WEBHOOK_SECRET') ?? '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? 'info@pilot-value.com';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'PILOT VALUE <noreply@pilot-value.com>';

// 翻訳は口コミの引用としてそのまま公開される。ここは質を優先する（投稿1件につき数回の呼び出ししか出ない）。
// ⚠️ このモデルに temperature を送ってはいけない。`temperature is deprecated for this model` で
//    400 が返り、翻訳が丸ごと落ちる（2026-08-10 に実測）。揺らぎは2工程目の突き合わせで抑える。
const MODEL = 'claude-opus-5';
const MAX_ROWS = 20;          // 1回の呼び出しで触る行数の上限（暴走防止）
const TABLE = 'reviews_v2';

// review-i18n.js の KEYS と一致させること。ずれると訳文が表示されない。
const KEYS = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'] as const;
type Key = typeof KEYS[number];

const LABEL: Record<Key, string> = {
  culture: '企業文化 / Culture',
  salary: '給与 / Pay',
  benefits: '福利厚生 / Benefits',
  wlb: 'ワークライフバランス / Work-life balance',
  ops: '運航環境 / Flight operations',
  training: '訓練環境 / Training',
  mgmt: '経営陣への提案 / Suggestions for management',
};

/* 訳文の受け取り口。これを tool_choice で強制すると、返ってくる形が確定する
   （＝モデルが入力と同じ配列の形で返して JSON.parse が落ちる事故が起きない）。
   required を空のままにしてあるのは「訳せない欄は出さない＝原文表示に落とす」
   という設計を保つため。 */
const TOOL = {
  name: 'emit_translation',
  description: 'Return the faithful translation of every category that was given.',
  input_schema: {
    type: 'object',
    properties: Object.fromEntries(
      KEYS.map((k) => [k, { type: 'string', description: `Translated body text for ${LABEL[k]}` }]),
    ),
    required: [] as string[],
  },
};

/* 現場の言い方を指定する。忠実訳の指示だけだと、業界語が素直に音写されて
   パイロットが読んだ瞬間に「機械翻訳だ」と分かる日本語になる。
   実例（2026-08-10 のエミレーツ機長の投稿・訳し直す前）:
     tax-free            → 「非税」          （日本語に無い）
     flight duty allowance → 「フライトデューティアラウンス」（音写が崩れている）
     European and Asian carriers → 「ヨーロッパやアジアのキャリア」（経歴の意味に読める）
   語を足すときは、実際に出た誤訳だけを足すこと（推測で膨らませない）。 */
const GLOSSARY: Record<'ja' | 'en', string[]> = {
  ja: [
    'carrier / airline → 航空会社（「キャリア」と書かない。日本語では経歴の意味に読まれる）',
    'allowance → 手当（flight duty allowance / flying pay → 乗務手当。音写しない）',
    'tax-free → 非課税（「非税」という語は無い）',
    'base pay → 基本給 ／ total package → 年収総額',
    'competitive（待遇） → 「条件が良い」「遜色ない」など日本語として通る言い方に',
    'well-being → 働きやすさ ／ fatigue management → 疲労管理',
    'staff travel → 社員割引搭乗 ／ housing allowance → 住宅手当 ／ medical coverage → 医療保険',
    'fleet → 機材 ／ maintenance → 整備 ／ recurrent check・PC・LPC → 定期審査 ／ line check → ライン審査',
    'SOP → 標準運航手順（SOP） ／ captain → 機長 ／ first officer → 副操縦士 ／ cadet → 訓練生',
    'roster・pairing・layover・ステイ は現場でそのまま使うのでカタカナのままでよい',
  ],
  en: [
    '機長 → Captain ／ 副操縦士 → First Officer ／ 訓練生 → Cadet',
    '乗務手当・フライト手当 → flying pay ／ 基本給 → base pay ／ 年収 → annual pay',
    '定期審査 → recurrent check ／ ライン審査 → line check ／ 路線 → route ／ 便 → flight',
    '整備 → maintenance ／ 機材 → fleet ／ 出向 → secondment ／ 自社養成 → in-house cadet programme',
    '若手 → junior pilots ／ 先輩・上位者 → senior pilots（guys のように性別を含む語にしない。'
      + '投稿者の性別は分からないし、読み手も限らない）',
    'ステイ・ステイ先 → layover ／ 時差の戻し → getting back onto local time',
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/* 原文の言語。日本語の文字が「全体のどれくらいを占めるか」で決める。
   ⚠️ 1文字でもあれば ja、にしてはいけない。英語の口コミに「羽田」と1語入るだけで
   ja と誤判定し、英語→英語に「翻訳」して orig_lang='ja' で保存される。
   すると日本語ページは from===to と見なして原文（英語）をそのまま出す
   ＝2026-08-10 にオーナーが見つけた症状とまったく同じ見え方になる。
   日本語の文章なら助詞だけで軽く3割を超えるので、1割で十分に離れている。 */
function detectLang(text: string): 'ja' | 'en' {
  const body = text.replace(/\s/g, '');
  if (!body.length) return 'en';
  const ja = body.match(/[぀-ヿ㐀-䶿一-鿿]/g)?.length ?? 0;
  return ja / body.length >= 0.1 ? 'ja' : 'en';
}

/* 訳文から数字が消えていないかを機械で見る。
   金額・年数・機種（B777 の 777）はこの口コミの中身そのもので、
   落ちても文章としては自然に読めてしまうため人の目では気づけない。
   ただし 1,800万円 → 18 million yen のような言い換えは正しいので、
   ここでは落とさず「怪しい数字」として2パス目に渡すだけにする。 */
function missingNumbers(src: string, out: string): string[] {
  const nums = (s: string) => (s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, ''));
  const have = new Set(nums(out));
  const bare = new Set([...have].map((n) => n.replace(/,/g, '')));
  return [...new Set(nums(src))].filter((n) => !have.has(n) && !bare.has(n.replace(/,/g, '')));
}

async function sb(path: string, init: RequestInit = {}) {
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/* モデルの返答から key→訳文 の対応を取り出す。
   ⚠️ 入力を配列で渡しているので、指示に反して入力と同じ配列の形で返ってくることがある。
   実際 2026-08-10 の初の en→ja でそれが起き、
   「最初の { から最後の } まで」を切る旧実装が "{…},{…}" という壊れた文字列を作って
   JSON.parse が落ち、訳が入らないまま原文（英語）が日本語ページに出ていた。
   下の tool 呼び出しで形は固定したが、両方の形を受けられるようにしておく。 */
function normalizeTranslation(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: unknown, v: unknown) => {
    if (typeof k === 'string' && typeof v === 'string' && v.trim()) out[k] = v.trim();
  };
  if (Array.isArray(value)) {
    // [{key:'culture', translation:'…'}, …] / text・value という名前で返ることもある
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      put(o.key ?? o.category_key ?? o.name, o.translation ?? o.translated ?? o.text ?? o.value);
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) put(k, v);
  }
  return out;
}

/* 素のテキストしか返ってこなかったときの保険。コードフェンスを剥がし、
   オブジェクトでも配列でも、開き括弧に対応する閉じ括弧までを切る。 */
function parseLoose(text: string): unknown {
  const t = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const cands = [t.indexOf('{'), t.indexOf('[')].filter((i) => i >= 0);
  if (!cands.length) throw new Error(`translation is not JSON: ${t.slice(0, 200)}`);
  const from = Math.min(...cands);
  const to = t.lastIndexOf(t[from] === '[' ? ']' : '}');
  if (to <= from) throw new Error(`translation is not JSON: ${t.slice(0, 200)}`);
  return JSON.parse(t.slice(from, to + 1));
}

/* どの会社の、どの職位の話かをモデルに渡す。
   「the company villa」「ステイ」「Cat A/C」が何を指すかは会社が分かって初めて訳し分けられる。
   ⚠️ これは語を選ぶための材料であって、書き足してよい材料ではない。 */
type Ctx = { airline?: string; position?: string };
const POSITION_EN: Record<string, string> = {
  captain: 'a captain', fo: 'a first officer', cadet: 'a cadet', former: 'a former crew member',
};
function contextLines(ctx: Ctx): string[] {
  const l: string[] = [];
  if (ctx.airline) l.push(`The review is about the airline: ${ctx.airline}.`);
  if (ctx.position) l.push(`The reviewer is ${POSITION_EN[ctx.position] ?? ctx.position}.`);
  if (l.length) l.push('Use this only to choose the right wording. Never add any fact that is not in the source text.');
  return l;
}

const langName = (l: 'ja' | 'en') => (l === 'ja' ? 'Japanese' : 'English');

/* 1パス目。忠実訳をさせる。 */
function systemTranslate(from: 'ja' | 'en', to: 'ja' | 'en', ctx: Ctx): string {
  return [
    `You translate anonymous employee reviews written by airline pilots from ${langName(from)} into ${langName(to)}.`,
    'These are quoted testimony. Translate faithfully and completely.',
    `The result must read as if an airline pilot had written it in ${langName(to)}.`,
    'Faithful does not mean word-for-word: keep every fact and every nuance, but use the wording',
    `pilots actually use in ${langName(to)}.`,
    ...contextLines(ctx),
    'Rules:',
    '- Do not summarize, shorten, embellish, soften, or add anything that is not in the source.',
    '- Keep the original tone, including complaints, hedging and bluntness.',
    '- Preserve line breaks, numbers, currency amounts and aircraft type names exactly as written.',
    '- Do not add category labels or brackets; translate the body text only.',
    ...(to === 'ja'
      ? ['- Never transliterate an English word into katakana when a standard Japanese term exists.']
      : ['- Do not leave Japanese industry words untranslated in romaji.']),
    `- If a field cannot be translated, omit that key entirely.`,
    `- Call the ${TOOL.name} tool exactly once. Put each translated body text under its own key.`,
    '',
    `Wording to use in ${langName(to)}:`,
    ...GLOSSARY[to].map((g) => `- ${g}`),
  ].join('\n');
}

/* 2パス目。人間の翻訳と同じで、訳したものを原文と突き合わせて直す工程。
   1パス目だけだと「訳せてはいるが読んだ瞬間に機械翻訳と分かる」文が残る
   （2026-08-10 の「非税」「フライトデューティアラウンス」がこれ）。 */
function systemRevise(from: 'ja' | 'en', to: 'ja' | 'en', ctx: Ctx): string {
  return [
    `You are a senior ${langName(to)} editor checking a draft translation of an anonymous airline pilot's review,`,
    `translated from ${langName(from)}.`,
    ...contextLines(ctx),
    'You are given: source (the original text per category), draft (the translation), and',
    'suspect_numbers (numbers found in the source but not in the draft).',
    'Fix only real problems:',
    `- Wording that no ${langName(to)}-speaking pilot would use, or that reads as machine translation.`,
    '- Wrong or invented industry terminology.',
    '- Facts, numbers, or nuance that were dropped, added, softened, or reversed.',
    '- Sentences that are grammatical but unnatural in context.',
    'For each entry in suspect_numbers, decide whether the number was genuinely dropped or merely',
    're-expressed correctly (for example 1,800万円 → 18 million yen). Restore only genuine drops.',
    'Do not rewrite a sentence that is already correct just to vary the wording.',
    `Return ONLY the keys you actually changed, with the full corrected body text for those keys.`,
    'Omit every key that needs no change. If nothing needs changing, return an empty object.',
    `Call the ${TOOL.name} tool exactly once.`,
    '',
    `Wording to use in ${langName(to)}:`,
    ...GLOSSARY[to].map((g) => `- ${g}`),
  ].join('\n');
}

/* ────────────────────────────────────────────────────────────────
   鍵が死んだことを黙って隠さない。

   この関数は失敗しても 200 を返す（webhook の再送ループで課金が膨らむより、
   訳が無い＝原文表示で止まる方が安全なため）。つまり鍵が死んでも
   **webhook は成功に見え、英語の口コミが日本語ページに英語のまま出続ける**。
   2026-08-10 に同じ静かな死に方を parse-payslip で実際にやった。
   ★返り値は変えない。通知を足すだけ。通知が落ちても翻訳の動作は変えない。

   ⚠️ この2つは parse-payslip/index.ts と同じ判定を持つ。片方だけ直すと食い違う。
      `node assert-translate-review.mjs` が両方のファイルから実体を import して
      同じ答えを返すか確かめる（コピーを持たないので乖離しない）。
   ──────────────────────────────────────────────────────────── */

/* 「こちらの設定が原因で、放っておくと全件失敗し続ける」ものだけ true。
     401/403 … 鍵が無効・revoke 済み・権限が無い
     400 invalid_request_error … 残高不足、モデルが受け付けない引数
       （2026-08-10 に temperature で実際に食らった。これも全件失敗する）
   429（混雑）と 5xx（向こうの障害）は時間で直るので鳴らさない。 */
export function isFatalKeyError(status: number, errType: string): boolean {
  if (status === 401 || status === 403) return true;
  return status === 400 && errType === 'invalid_request_error';
}

/* 1日1通だけ。インスタンス内の再送はここで止め、インスタンスを跨ぐぶんは
   Resend の Idempotency-Key（24時間有効）が止める。 */
let keyAlertDay = '';
async function alertKeyDead(status: number, errType: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  if (keyAlertDay === day) return;
  keyAlertDay = day;
  if (!RESEND_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `translate-key-dead:${day}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: '[PILOT VALUE] 口コミの自動翻訳が止まっています（APIキーの問題）',
        text:
          `translate-review が Anthropic に ${status}（${errType || 'type不明'}）で断られました。\n` +
          `直すまで、新しい口コミに訳が入りません。英語の投稿は日本語ページに\n` +
          `英語のまま出続けます（画面にはエラーが出ないので気づけません）。\n\n` +
          `見るところ:\n` +
          `1. platform.claude.com → APIキー\n` +
          `   使っているキーが revoke / 期限切れになっていないか。\n` +
          `2. Supabase → Edge Functions → Secrets の ANTHROPIC_API_KEY を差し替え\n` +
          `   （再デプロイ不要。明細読み取りも同じキーを見ています）。\n` +
          `3. 400 invalid_request_error のときは残高切れの可能性もあります。\n\n` +
          `直ったかの確認:\n` +
          `  訳が入らなかった行は translations が null のまま残っているので、\n` +
          `  {"ids":["<id>"]} を POST すれば入れ直せます。`,
      }),
    });
  } catch { /* 通知が落ちても翻訳の動作は変えない */ }
}

/* Anthropic を1回叩き、キー→訳文の対応だけを受け取る。 */
async function callAnthropic(system: string, user: unknown): Promise<Record<string, string>> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      // 日本語は同じ内容でもトークン数が伸びる。7欄まとめて訳すと 4000 では
      // 切れる余地があり、切れると訳が丸ごと入らない（原文表示に落ちる）ので広く取る。
      max_tokens: 8000,
      system,
      // 出力の形を tool の input_schema で固定する。文章で「JSON で返せ」と
      // 頼むだけだと、入力が配列なので配列の形で返ってくることがあった。
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{ role: 'user', content: JSON.stringify(user) }],
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    let errType = '';
    try { errType = (JSON.parse(body) as { error?: { type?: string } })?.error?.type ?? ''; } catch { /* 形が違えば空 */ }
    if (isFatalKeyError(res.status, errType)) await alertKeyDead(res.status, errType);
    throw new Error(`anthropic ${res.status}: ${body}`);
  }

  const data = await res.json();
  if (data?.stop_reason === 'max_tokens') throw new Error('translation truncated (max_tokens)');

  const blocks: Array<{ type?: string; text?: string; input?: unknown }> = data?.content ?? [];
  const tool = blocks.find((c) => c?.type === 'tool_use');
  return tool
    ? normalizeTranslation(tool.input)
    : normalizeTranslation(parseLoose(blocks.map((c) => c.text ?? '').join('').trim()));
}

/* 訳す → 突き合わせて直す、の2工程。2工程目が落ちても1工程目の訳は残す
   （訳が無い＝原文表示に落ちるより、下訳でも出ている方が読み手には良い）。 */
async function translate(
  fields: Array<[Key, string]>,
  from: 'ja' | 'en',
  to: 'ja' | 'en',
  ctx: Ctx,
  // 手元で下訳と推敲後を並べて見るためだけの覗き口（本番は渡さない）。
  onDraft?: (draft: Record<string, string>, suspect: Record<string, string[]>) => void,
) {
  const payload = fields.map(([k, t]) => ({ key: k, category: LABEL[k], text: t }));

  const first = await callAnthropic(systemTranslate(from, to, ctx), payload);
  const draft: Record<string, string> = {};
  for (const [k] of fields) if (first[k]) draft[k] = first[k];
  if (!Object.keys(draft).length) return draft;

  const suspect: Record<string, string[]> = {};
  for (const [k, src] of fields) {
    if (!draft[k]) continue;
    const miss = missingNumbers(src, draft[k]);
    if (miss.length) suspect[k] = miss;
  }
  onDraft?.({ ...draft }, suspect);

  try {
    const fixed = await callAnthropic(systemRevise(from, to, ctx), { source: payload, draft, suspect_numbers: suspect });
    for (const [k] of fields) if (fixed[k]) draft[k] = fixed[k];
  } catch (e) {
    console.error('revise pass failed, keeping draft:', String(e).slice(0, 200));
  }
  return draft;
}

async function translateRow(id: string) {
  const cols = ['id', 'orig_lang', 'translations', 'airline', 'position',
    ...KEYS.map((k) => `${k}_comment`)].join(',');
  const res = await sb(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=${cols}`);
  if (!res.ok) return { id, status: 'fetch_failed', detail: (await res.text()).slice(0, 200) };

  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return { id, status: 'not_found' };
  if (row.translations) return { id, status: 'already_translated' };

  const fields = KEYS
    .map((k) => [k, (row[`${k}_comment`] ?? '').toString().trim()] as [Key, string])
    .filter(([, t]) => t.length > 0);
  if (!fields.length) return { id, status: 'nothing_to_translate' };

  const from = detectLang(fields.map(([, t]) => t).join('\n'));
  const to = from === 'ja' ? 'en' : 'ja';

  const translated = await translate(fields, from, to, {
    airline: (row.airline ?? '').toString().trim() || undefined,
    position: (row.position ?? '').toString().trim() || undefined,
  });
  if (!Object.keys(translated).length) return { id, status: 'empty_translation' };

  // orig_lang も同時に確定させる。表示側はこの2つが揃って初めて訳文を出す。
  const up = await sb(`${TABLE}?id=eq.${encodeURIComponent(id)}&translations=is.null`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ orig_lang: from, translations: { [to]: translated } }),
  });
  if (!up.ok) return { id, status: 'update_failed', detail: (await up.text()).slice(0, 200) };

  return { id, status: 'translated', from, to, fields: Object.keys(translated).length };
}

/* 手元の検査用に中身を公開する。Edge Function の動きは何も変わらない
   （Deno も Supabase も、export のある ES モジュールをそのまま動かす）。
   これがあるので translate-eval.mjs / assert-translate-review.mjs は
   プロンプトのコピーを持たずに済む＝本体と乖離しない。 */
export { translate, detectLang, missingNumbers, normalizeTranslation, parseLoose, systemTranslate, systemRevise, MODEL };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (WEBHOOK_SECRET && req.headers.get('x-pv-webhook-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not set' }, 500);
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'supabase env missing' }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* 空ボディは ids なしとして扱う */ }

  // Database Webhook は {type, table, record, old_record} を送る。
  // 手動の埋め戻し用に {"ids":[...]} も受ける（本文は常に DB から読む）。
  const record = body.record as { id?: string } | undefined;
  const ids = Array.isArray(body.ids)
    ? (body.ids as unknown[]).filter((v): v is string => typeof v === 'string')
    : record?.id
      ? [record.id]
      : [];

  if (!ids.length) return json({ ok: true, results: [], note: 'no id in payload' });

  const results = [];
  for (const id of ids.slice(0, MAX_ROWS)) {
    try {
      results.push(await translateRow(id));
    } catch (e) {
      // 個別の失敗で全体を落とさない。訳が無い＝原文表示なので実害は出ない。
      results.push({ id, status: 'error', detail: String(e).slice(0, 300) });
    }
  }
  // webhook の再送ループを避けるため、失敗を含んでも 200 を返す
  return json({ ok: true, results, skipped: Math.max(0, ids.length - MAX_ROWS) });
});
