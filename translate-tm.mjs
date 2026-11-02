/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — translate-tm.mjs（2026-11-01・多言語化の段1）
   英語のページの文を、AI の4段でスペイン語（中南米）に訳し、訳の辞書 i18n/tm-es.mjs に足す。

   ⚠️ AI を実際に呼ぶので課金される。check.mjs には入れない。流す前に必ず --estimate で額を見る。

   使い方
     node --env-file=<mail-bot/.env の場所> translate-tm.mjs es --estimate              何文・いくらかだけ出す（AI を呼ばない）
     node --env-file=… translate-tm.mjs es --trial 50 --report <点検表.html>            試し訳（約50文）と、日本語の逆訳つきの点検表
     node --env-file=… translate-tm.mjs es --pages en/pay-report.html,en/signup.html   そのページの足りない文だけ訳す
     node --env-file=… translate-tm.mjs es --ld                                         構造化データ（JSON-LD）の文で、本文の訳から引けないものだけ訳す
     node translate-tm.mjs es --prune                                                  どのページにも無くなった訳を辞書から消す（AI を呼ばない）
     鍵は ANTHROPIC_API_KEY（mail-bot/.env にある開発用のもの。translate-eval.mjs と同じ）。

   4段（オーナー決定 2026-11-01「高レベルに・航空用語に違和感なく」）
     ① 訳す   ：英語＋同じ場所の日本語（意味の確認用・参考）＋前後の文＋用語集＋書き方の決まり
     ② 直す   ：中南米のエアラインの機長で協約に詳しい人＋プロの翻訳者として、用語・自然さ・口調を直す（理由つき）
     ③ 逆に訳す：原文を見せずに英語へ戻す → 別の呼び出しが原文と比べて意味のずれを判定。ずれたら①②をやり直し1回、まだずれたら「要確認」
     ④ ページ通読：組み上がったページの訳を通して読み、用語・口調のぶれと、つぎはぎ感だけを直す
     そのあと機械検査（数字・札・日本語の字・禁止の語・長さ）。1つでも落ちたら採らない。

   訳の辞書の1件（キーは英語の原文。札つき・空白を1つに縮めた形）
     { es, st, model, pv, gl, at, pages, note }
       st    状態：validated（AI の確認と機械検査を全部通った）／needs_review（意味のずれが残った）
             ／manual（人が直した ── 機械は上書きしない）。人が確かめた印は、人が付けるときだけ。
       pv    指示の版（PROMPT_VERSION）。模型や指示を変えただけでは訳し直さない。
       gl    その文に出た用語と、その用語の中身の指紋。用語を直すと、その用語を含む訳だけが「古い」になる。
   ════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { extract, extractHead, plain, tagSet, reportPage, jsShape, jsText, jsTags, inlineScriptUnits } from './i18n-core.mjs';
import { MSG_FILES, msgUnits } from './gen-msg.mjs';
import { LANG } from './langs.mjs';
import { GLOSSARY_ES } from './i18n/glossary-es.mjs';
import { needsAI } from './i18n/keep.mjs';   // 会社名・サービスの名前は AI に渡さない

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const MODEL = 'claude-opus-5-5';
const PROMPT_VERSION = 4;   // 2026-11-02：部品の台本の文言（JavaScript の式）も訳す   // 2026-11-02：欄の名前を先に訳して本文に渡す・pay の使い分け   // 2026-11-02 試し訳1回目のあと：prima de antigüedad の決まりを正確に・通読の直しも意味を判定
const PRICE = { in: 4 / 1e6, out: 20 / 1e6, cacheRead: 0.2 / 1e6, cacheWrite: 5 / 1e6 };   // 2026-11 の公開価格（USD / トークン）
const BATCH = 20;

const argv = process.argv.slice(2);
const code = argv[0];
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (k) => argv.includes(k);
if (code !== 'es') { console.error('いまは es だけ（langs.mjs に es を足すのは gen-lang.mjs の段）'); process.exit(1); }

/* ── 訳の辞書 ─────────────────────────────────────────────── */
const TM_FILE = path.join(ROOT, 'i18n', `tm-${code}.mjs`);
const TM = fs.existsSync(TM_FILE) ? (await import(TM_FILE)).TM : {};
function saveTM() {
  const keys = Object.keys(TM).sort();
  const body = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(TM[k])}`).join(',\n');
  fs.writeFileSync(TM_FILE, `/* 自動生成: node translate-tm.mjs ${code} — 手で直すときは st を "manual" にする（機械が上書きしない） */\nexport const TM = {\n${body}${keys.length ? ',' : ''}\n};\n`);
}

/* ── 用語集（中南米の列）─────────────────────────────────── */
const GL = GLOSSARY_ES.filter((e) => !/\bsource\)/.test(e.en));
const glHash = (e) => createHash('sha1').update(JSON.stringify([e.es, e.form, e.first, e.notes])).digest('hex').slice(0, 6);
const glTerms = GL.map((e) => {
  const variants = e.en.replace(/\(([^)]*)\)/g, ' / $1').split(/\s*\/\s*|,\s*/).map((s) => s.trim()).filter((s) => s.length >= 2 && !/^e\.g\.|^incl\./.test(s));
  return { e, res: variants.map((v) => new RegExp(`(^|[^A-Za-z])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^A-Za-z])`, /^[A-Z]{2,}$/.test(v) ? '' : 'i')) };
});
const termsIn = (text) => glTerms.filter((t) => t.res.some((r) => r.test(text))).map((t) => t.e);
const glPrint = (es) => es.map((e) => `${e.id}:${glHash(e)}`).sort().join(',');


/* ── 書き方の決まりと用語集（毎回同じ＝キャッシュに載る）──── */
const STYLE = `You translate the website PILOT VALUE from English into Latin American Spanish (es-419).
PILOT VALUE is a database of airline pilot pay and working conditions made only for pilots: pilots submit their pay anonymously (from a payslip or by hand), compare airlines, read reviews written by other pilots, and see estimated salaries per airline. Readers are airline pilots (captains, first officers, cadets) working in Mexico, Colombia, Chile, Peru, Argentina, Panama and the rest of Latin America.

Goal: the Spanish must read as if it had been written in Spanish by a pilot for pilots. Precise aviation and payroll terminology. Never add, drop, soften or strengthen meaning.

Rules
1. Address the reader with "tú" (Regístrate, tu aerolínea, tu recibo de nómina). Pilot-to-pilot tone: direct, concise, no marketing fluff that is not in the English.
2. Terminology: always use the "es" term of the glossary below for the matching concept. In form labels and select options use the "form" wording when one is given. Respect the notes (what must not be confused).
3. Keep in English: brand and product names (PILOT VALUE, REAL PAY, DEEP PAY, VOTE, Give & Get, FOUNDING PILOT), airline names, aircraft types (A320, B787, E-Jets), licence/qualification and rostering abbreviations (ATPL, CPL, MPL, TRI, TRE, SFI, SFE, LIFUS, LOFT, OPC, LPC, FDP, PBS, EBT, PIC, PICUS), currency codes (USD, MXN, EUR). Generic navigation words are translated (HOME → INICIO, MY PAGE → MI PÁGINA).
4. Tags: <g1>…</g1> wrap words that you translate in place; <x1/> is a fixed component (icon, amount, line break) that you never change. Keep every tag exactly once with the same number. You may move a tag if Spanish word order needs it. Never add tags, HTML, markdown or quotes that are not in the English.
5. Numbers, amounts, percentages, dates, ranges, durations: keep every digit exactly and keep it as a digit (1 month → 1 mes, never "un mes"); never convert currencies, units or time zones. Abbreviations of units follow Spanish usage (50 sec → 50 s, 3 min → 3 min, hrs → h).
6. Capitalisation: Spanish sentence case for headings, buttons and labels (only the first word and proper nouns capitalised). If the English is ALL CAPS, keep ALL CAPS.
7. Punctuation: Spanish ¿…? and ¡…!; no space before ? ! : ; keep "→ ← · •" symbols where they are.
8. "piloto" is the same for women and men (el/la piloto). Never write "pilota" or "piloto/a". Generic plural: "los pilotos".
9. Buttons and menu items that are actions: infinitive (Enviar, Cambiar, Iniciar sesión). Direct invitations to the reader inside sentences: tú imperative.
10. Never use: "segundo piloto" for First Officer or Second Officer; "escala" for a layover (a night away from base is "pernocta"); "prima de antigüedad" for a regular seniority pay increase or bonus (that is "bono de antigüedad"; in Mexico "prima de antigüedad" is only the statutory payment made ON LEAVING based on years of service — use it exactly when the English describes that); "aguinaldo" for an airline bonus (aguinaldo is the statutory 13th-month pay; an airline bonus is "bono"); "tiempo de vuelo" for block time; "reserva" for standby (reserve and standby are different duties: reserve = "reserva", standby = "guardia"); "K" as an abbreviation of thousands in prose; "salario" where the glossary says "sueldo".
11. The Japanese text, when given, is the original the English was translated from. Use it only to understand the meaning. It may belong to a neighbouring element; ignore it if it clearly says something else.
12. If the English is ambiguous, choose the meaning that fits a pilot pay website and explain in "note" (in Japanese, one short sentence). Otherwise leave "note" empty.
13. Items of kind "javascript" are small JavaScript expressions from the site's code (a string, an object of strings, or a short function that returns a string). Translate ONLY the human-readable text inside the quotes. Everything outside the quotes must stay byte-identical: keys, variable names, operators, brackets, function code, commas. Inside the quotes keep HTML tags and their attributes exactly, keep \n, keep placeholders such as {n}, %s, $1, and keep a space at the start or end of a string piece when it is joined to a variable ('Step ' + i). If Spanish word order would need a variable to move, rephrase so the variables keep their order. Return the whole expression.`;

const GLOSS_TEXT = 'Glossary (en → es for Latin America; form = wording for form fields; first = wording at first mention on a page; notes = cautions)\n' +
  GL.map((e) => `- ${e.en} → ${e.es}${e.form ? ` | form: ${e.form}` : ''}${e.first ? ` | first: ${e.first}` : ''}${e.notes ? ` | notes: ${e.notes.replace(/\s+/g, ' ').slice(0, 220)}` : ''}`).join('\n');

const REVIEWER = `You are two people at once: (a) a senior airline captain from Mexico who has also flown in Colombia and Chile, knows collective labour agreements (contratos colectivos), payslips (recibo de nómina) and rostering inside out; (b) a professional EN→ES translator for Latin American Spanish.
Review each draft translation against the English (and the Japanese original when given). Fix: wrong meaning, wrong or inconsistent terminology (glossary is binding), anything a Latin American pilot would find unnatural, register (tú), capitalisation, punctuation, tags. Do not rewrite drafts that are already correct and natural.
Return for every item the final Spanish, whether you changed it, and when you changed it a reason in Japanese (one short sentence).`;

const BACK = `Translate each Spanish text from a pilot pay website into English. Translate faithfully, close to the Spanish wording — do not improve or correct it. Keep the <g1>…</g1> and <x1/> tags exactly where they are. If an item is JavaScript code, translate only the text inside the quotes and keep the code as it is.`;

const JUDGE = `You check translations for a pilot pay website. For each item you get the original English, the Spanish translation, and an independent back-translation of the Spanish into English.
Decide whether the Spanish says the same thing as the original English. Check: facts, numbers, negation, conditions, scope (gross vs net, monthly vs annual, included vs excluded, estimate vs reported by pilots, per hour vs per day), who does what, and the strength of statements. Ignore differences of wording that do not change meaning.
Return ok=false only for a real difference of meaning, with the issue in Japanese (one short sentence). When an item is JavaScript code, compare only the text inside the quotes.`;

const READ = `You are a senior airline captain from Latin America reading one page of the Spanish version of a pilot pay website, in page order.
Fix only real problems that appear when reading the whole page: the same concept translated in different ways, switches of register, capitalisation that is inconsistent between similar items, sentences that read like stitched-together translations. Do not touch items that are fine. The glossary is binding for the concept it describes — but two different concepts may share an English word: when an item's translator note or Japanese original shows a deliberate, context-based choice of a different concept, keep it. Every change you make is checked again for meaning against the English.
Return only the items you change, with the new Spanish and a reason in Japanese (one short sentence).`;

const TO_JA = `Translate each Spanish text from a pilot pay website into natural Japanese, faithfully — do not correct or improve it, so that a Japanese reader can judge what the Spanish really says. Drop the <g1></g1> and <x1/> tags.`;

/* ── 答えの形（structured outputs）────────────────────────── */
const listOf = (props) => ({
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: Object.keys(props), properties: props } } },
});
const S_TR = listOf({ id: { type: 'integer' }, es: { type: 'string' }, note: { type: 'string' } });
const S_RV = listOf({ id: { type: 'integer' }, es: { type: 'string' }, changed: { type: 'boolean' }, reason: { type: 'string' } });
const S_BK = listOf({ id: { type: 'integer' }, en: { type: 'string' } });
const S_JD = listOf({ id: { type: 'integer' }, ok: { type: 'boolean' }, issue: { type: 'string' } });
const S_RD = listOf({ id: { type: 'integer' }, es: { type: 'string' }, reason: { type: 'string' } });
const S_JA = listOf({ id: { type: 'integer' }, ja: { type: 'string' } });

/* ── AI の呼び出し（使った量を数える）────────────────────── */
let client = null;
const used = { in: 0, out: 0, cr: 0, cw: 0, calls: 0 };
const cost = () => used.in * PRICE.in + used.out * PRICE.out + used.cr * PRICE.cacheRead + used.cw * PRICE.cacheWrite;
/* translator=true … 書き方の決まり＋用語集（毎回同じ＝キャッシュ）を前に置く（①②④）。
   false … 逆に訳す・意味を比べる・日本語に戻す呼び出し。訳す側の決まりを見せない（見せると逆訳が「直した」英語になる）。 */
async function ask(system, user, schema, effort = 'high', translator = true) {
  client ??= new Anthropic();
  const sys = translator
    ? [{ type: 'text', text: STYLE }, { type: 'text', text: GLOSS_TEXT, cache_control: { type: 'ephemeral' } }, { type: 'text', text: system }]
    : [{ type: 'text', text: system }];
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await client.beta.messages.parse({
        model: MODEL, max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        system: sys,
        messages: [{ role: 'user', content: user }],
        output_config: { effort, format: jsonSchemaOutputFormat(schema) },
      });
      used.calls++;
      used.in += r.usage.input_tokens || 0; used.out += r.usage.output_tokens || 0;
      used.cr += r.usage.cache_read_input_tokens || 0; used.cw += r.usage.cache_creation_input_tokens || 0;
      if (r.stop_reason === 'refusal') throw new Error('AI が断った: ' + JSON.stringify(r.stop_details));
      if (r.stop_reason === 'max_tokens') throw new Error('答えが途中で切れた（max_tokens）');
      if (!r.parsed_output) throw new Error('答えの形が読めない');
      return r.parsed_output.items;
    } catch (e) {
      if (attempt >= 3 || e instanceof Anthropic.BadRequestError || e instanceof Anthropic.AuthenticationError) throw e;
      await new Promise((res) => setTimeout(res, 3000 * attempt));
    }
  }
}
const byId = (items) => new Map(items.map((x) => [x.id, x]));

/* ── 機械検査（1つでも落ちたら採らない）────────────────────── */
const NUM = (s) => (plain(s).match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, '').replace(/,/g, ''));   // translate-review の missingNumbers と同じ読み方
/* [スペイン語で使わない語, その語が問題になる英語（無ければいつでも）] ── 用語集の「取り違えやすい語」から */
const BAN = [
  [/\bsegundo piloto\b/i, /first officer|second officer|co-?pilot|\bFO\b|\bSO\b/i],
  [/\bescalas?\b/i, /layover|overnight|nights? away/i],
  [/\baguinaldo\b/i, /^(?![\s\S]*(13th|thirteenth|christmas))[\s\S]*\bbonus\b/i],
  [/\breserva\b/i, /^(?![\s\S]*\breserve)[\s\S]*\bstandby/i],   // 英語に reserve も在るなら reserva は正しい（Reserve / Standby → Reserva / guardia）
  [/\bpilota\b/i, null], [/\bpiloto\/a\b/i, null], [/\d\s?K\b/, null],
];
function check(key, es) {
  const errs = [];
  if (key.startsWith('js:') || key.startsWith('jsl:')) {
    const src = key.slice(key.indexOf(':') + 1);
    if (jsShape(es) !== jsShape(src)) errs.push('コードの形が変わった');
    if (jsTags(es) !== jsTags(src)) errs.push('文字列の中のタグが変わった');
    const want = NUM(jsText(src)); const have = new Set(NUM(jsText(es)));
    const miss = [...new Set(want)].filter((n) => !have.has(n));
    if (miss.length) errs.push('数字が消えた: ' + miss.join(' '));
    /* 日本語の鍵の対応表（{ '機長': 'Captain' }）は鍵が日本語で正しい ＝ 元に無い日本語が増えたときだけ落とす */
    const jaOf = (x) => new Set(jsText(x).match(/[ぁ-んァ-ヶ一-龠ー・（）]+/g) || []);
    const srcJa = jaOf(src);
    if ([...jaOf(es)].some((w) => !srcJa.has(w))) errs.push('日本語の字が残った');
    for (const [b, when] of BAN) if (b.test(jsText(es)) && !b.test(jsText(src)) && (!when || when.test(jsText(src)))) errs.push('使わない語: ' + jsText(es).match(b)[0]);
    return errs;
  }
  if (tagSet(es) !== tagSet(key)) errs.push('札が合わない');
  const want = NUM(key); const have = new Set(NUM(es));
  const miss = [...new Set(want)].filter((n) => !have.has(n));
  if (miss.length) errs.push('数字が消えた: ' + miss.join(' '));
  if (/[ぁ-んァ-ヶ一-龠]/.test(es)) errs.push('日本語の字が残った');
  for (const [b, when] of BAN) if (b.test(plain(es)) && !b.test(plain(key)) && (!when || when.test(plain(key)))) errs.push('使わない語: ' + plain(es).match(b)[0]);
  const r = plain(es).length / Math.max(1, plain(key).length);
  if (plain(key).length > 20 && (r < 0.5 || r > 2.6)) errs.push(`長さが極端（${r.toFixed(2)}倍）`);
  if ((plain(es).match(/[<>]/g) || []).length > (plain(key).match(/[<>]/g) || []).length) errs.push('札でないタグ');
  return errs;
}

/* ── ページから文を集める ─────────────────────────────────── */
const DEFAULT_PAGES = LANG[code].pages.map((p) => 'en/' + p);   // 作るページは langs.mjs の1か所
function collect(pages) {
  const out = [];
  for (const rel of pages) {
    if (!fs.existsSync(path.join(ROOT, rel))) { console.log(`  （${rel} は無いので飛ばした）`); continue; }
    const enHtml = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const jaRel = rel.replace(/^en\//, '');
    const ja = fs.existsSync(path.join(ROOT, jaRel)) ? extract(fs.readFileSync(path.join(ROOT, jaRel), 'utf8')) : { units: [], attrs: [] };
    const jaAt = new Map([...ja.units, ...ja.attrs].map((u) => [u.path, plain(u.key)]));
    const { units, attrs } = extract(enHtml);
    /* <title> と説明文も訳す（gen-lang.mjs が head の管理ブロックを作り直すときに使う） */
    const head = extractHead(enHtml).map((h, k) => ({ ...h, start: -10 + k, path: 'head@' + h.name }));
    const all = [...head, ...units, ...attrs].sort((a, b) => a.start - b.start);
    all.forEach((u, i) => {
      if (!needsAI(u.key)) return;
      const jaText = /(^|>)option[:~]/.test(u.path) || /select/.test(u.path) ? '' : (jaAt.get(u.path) || '');
      out.push({
        key: u.key, page: rel, kind: u.kind === 'attr' ? `attribute ${u.name}` : u.kind === 'head' ? `page ${u.name} (search result)` : 'text',
        ja: /[ぁ-んァ-ヶ一-龠]/.test(jaText) ? jaText : '',
        before: all[i - 1] ? plain(all[i - 1].key).slice(-120) : '', after: all[i + 1] ? plain(all[i + 1].key).slice(0, 120) : '',
      });
    });
  }
  return out;
}
const fresh = (key) => {
  const t = TM[key];
  if (!t) return false;
  if (t.st === 'manual') return true;
  return t.gl === glPrint(termsIn(/^jsl?:/.test(key) ? jsText(key.slice(key.indexOf(':') + 1)) : plain(key)));   // 用語が直っていなければ使える
};

/* ── 試し訳の選び方：航空と給与の用語を含む文を中心に、ページをまたいで散らす ── */
const TRIAL_QUOTA = { 'en/pay-report.html': 22, 'en/airlines/aeromexico.html': 14, 'en/signup.html': 5, 'en/actual-pay.html': 4, 'en/privacy.html': 5 };
function pickTrial(cands, n) {
  const words = (c) => plain(c.key).split(/\s+/).length;
  const score = (c) => termsIn(plain(c.key)).length * 3 + (c.ja ? 1 : 0) + (words(c) >= 6 ? 1 : 0);
  const out = [];
  for (const [p, q] of Object.entries(TRIAL_QUOTA)) {
    const want = Math.round(q * n / 50);
    /* 点の高い順に並べ、ページの中で偏らないよう1つおきに取る（同じ節の文ばかりにしない） */
    const list = cands.filter((c) => c.page === p && words(c) >= 2 && words(c) <= 60).sort((a, b) => score(b) - score(a));
    const alt = [...list.filter((_, i) => i % 2 === 0), ...list.filter((_, i) => i % 2 === 1)];
    out.push(...alt.slice(0, want));
  }
  return out.slice(0, n);
}

/* ── 4段 ─────────────────────────────────────────────────── */
const show = (it) => JSON.stringify(it);
/* そのページで先に訳した短い見出し（欄の名前・ボタン）。本文がその名前を挙げるときは一字一句この訳を使う */
const known = (page) => Object.entries(TM).filter(([k, v]) => v.pages?.includes(page) && isLabel(k)).map(([k, v]) => `${plain(k)} => ${plain(v.es)}`);
const isLabel = (key) => plain(key).split(/\s+/).length <= 6 && !/[.?!]$/.test(plain(key));
async function stage12(batch, hints = new Map()) {
  const items = batch.map((c, i) => ({ id: i + 1, english: c.src ?? c.key, kind: c.kind, japanese_original: c.ja || undefined, before: c.before || undefined, after: c.after || undefined, recheck: hints.get(i + 1) }));
  const page = batch[0].page;
  const labels = known(page);
  const fixed = labels.length ? `\nLabels already translated on this page (when an item names one of these fields or buttons, use exactly this Spanish):\n${labels.slice(0, 400).join('\n')}\n` : '';
  const tr = byId(await ask('Translate each item.', `Page: ${page}${fixed}\nItems (JSON lines):\n${items.map(show).join('\n')}`, S_TR, 'high'));
  const drafts = items.map((it) => ({ id: it.id, english: it.english, japanese_original: it.japanese_original, draft: tr.get(it.id)?.es ?? '', translator_note: tr.get(it.id)?.note || undefined, recheck: it.recheck }));
  const rv = byId(await ask(REVIEWER, `Page: ${page}${fixed}\nReview each item (JSON lines):\n${drafts.map(show).join('\n')}`, S_RV, 'high'));
  return items.map((it) => ({ id: it.id, draft: tr.get(it.id)?.es ?? '', es: rv.get(it.id)?.es ?? tr.get(it.id)?.es ?? '', reason: rv.get(it.id)?.changed ? rv.get(it.id).reason : '', note: tr.get(it.id)?.note || '' }));
}
async function stage3(batch, res) {
  const bk = byId(await ask(BACK, `Items (JSON lines):\n${res.map((r) => show({ id: r.id, spanish: r.es })).join('\n')}`, S_BK, 'medium', false));
  const jd = byId(await ask(JUDGE, `Items (JSON lines):\n${res.map((r, i) => show({ id: r.id, english: batch[i].src ?? batch[i].key, spanish: r.es, back_translation: bk.get(r.id)?.en ?? '' })).join('\n')}`, S_JD, 'high', false));
  return res.map((r) => ({ ...r, back: bk.get(r.id)?.en ?? '', ok: jd.get(r.id)?.ok !== false, issue: jd.get(r.id)?.issue || '' }));
}
async function translateBatch(batch) {
  let res = await stage3(batch, await stage12(batch));
  const bad = res.filter((r) => !r.ok);
  if (bad.length) {
    const sub = bad.map((r) => batch[r.id - 1]);
    const hints = new Map(bad.map((r, i) => [i + 1, `前回の訳「${r.es}」は意味がずれていると判定された：${r.issue}`]));
    const again = await stage3(sub, await stage12(sub, hints));
    again.forEach((a, i) => { const r = bad[i]; Object.assign(res[r.id - 1], { ...a, id: r.id, retried: true }); });
  }
  return res;
}
async function readThrough(page, rows) {
  if (rows.length < 3) return new Map();
  const items = rows.map((r, i) => ({ id: i + 1, english: r.c.src ?? r.key, japanese_original: r.c.ja || undefined, spanish: r.es, translator_note: r.note || undefined }));
  return new Map((await ask(READ, `Page: ${page}\nAll translated items on this page, in page order (JSON lines):\n${items.map(show).join('\n')}`, S_RD, 'high'))
    .map((x) => [rows[x.id - 1]?.key, x]).filter(([k]) => k));
}

/* ── 本体 ─────────────────────────────────────────────────── */
const pages = (opt('--pages') || (flag('--trial') || opt('--trial') ? ['en/pay-report.html', 'en/airlines/aeromexico.html', 'en/signup.html', 'en/actual-pay.html', 'en/privacy.html'].join(',') : DEFAULT_PAGES.join(','))).split(',');
const collectJS = () => MSG_FILES.flatMap((f) => msgUnits(f).map((u) => ({ key: u.key, src: u.value, page: f, kind: `javascript (property "${u.prop}" of the site's message table)`, ja: u.ja, before: '', after: '' })));
/* --inline：ページの中の台本の、画面に出る文字列（文字列1つずつ・前後のコードの行を添える） */
const collectInline = () => (LANG[code].pages.map((p) => 'en/' + p)).flatMap((rel) => inlineScriptUnits(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
  .map((u) => ({ key: u.key, src: u.raw, page: rel, kind: 'javascript string literal inside the page code (return only this one literal, same quote characters; the code line is given as context)', ja: '', before: u.line, after: '' })));
/* --bank：待遇の質問の台帳（pv-conditions.json）の英語。日本語の同じ所の字を意味の確認用に添える */
const collectBank = () => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'pv-conditions.json'), 'utf8'));
  const out = [];
  const pair = (en, ja, where) => {
    if (typeof en === 'string') { if (/[A-Za-z]{2,}/.test(en)) out.push({ key: en, page: 'pv-conditions.json', kind: `survey question for airline pilots about working conditions (${where})`, ja: typeof ja === 'string' ? ja : '', before: '', after: '' }); return; }
    if (Array.isArray(en)) { en.forEach((x, i) => pair(x, Array.isArray(ja) ? ja[i] : undefined, where)); return; }
    if (en && typeof en === 'object') for (const k of Object.keys(en)) pair(en[k], ja && typeof ja === 'object' ? ja[k] : undefined, where + '.' + k);
  };
  (function walk(o, where) {
    if (Array.isArray(o)) { o.forEach((x, i) => walk(x, where)); return; }
    if (!o || typeof o !== 'object') return;
    if (o.ja !== undefined && o.en !== undefined) pair(o.en, o.ja, where + (o.id ? ' ' + o.id : o.code ? ' ' + o.code : ''));
    for (const k of Object.keys(o)) if (!['ja', 'en', 'es'].includes(k)) walk(o[k], k);
  })(j, 'bank');
  return out;
};
/* --ld：構造化データ（JSON-LD）の文のうち、本文の訳から引けないもの（gen-lang.mjs --ld-miss が出す）。鍵は英語の字そのまま（タグ無し） */
const collectLD = () => execFileSync(process.execPath, ['gen-lang.mjs', code, '--check', '--ld-miss'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
  .split('\n').filter((l) => l.startsWith('LDMISS\t')).map((l) => JSON.parse(l.slice(7)))
  .map((m) => ({ key: m.key, page: m.page, kind: `structured data for search engines (schema.org JSON-LD, field "${m.field}"; plain text, no markup)`, ja: m.ja, before: '', after: '' }));
/* 構造化データの文を全部（--prune が「まだ使っている」と数えるため。訳した後は --ld-miss に出てこない） */
const allLD = () => DEFAULT_PAGES.flatMap((rel) => [...fs.readFileSync(path.join(ROOT, rel), 'utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
  const out = [];
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); else if (typeof v === 'string') out.push(v); };
  try { walk(JSON.parse(m[1])); } catch { /* 読めない塊は飛ばす */ }
  return out;
}));

if (flag('--prune')) {
  /* ★全部の集め方を足して「まだ使っている」を作る（2026-11-02 まではページの本文だけを見ていて、部品の辞書 js: と待遇の質問の訳まで消す形だった） */
  const live = new Set([...collect(DEFAULT_PAGES.concat((opt('--pages') || '').split(',').filter(Boolean))), ...collectJS(), ...collectInline(), ...collectBank()].map((c) => c.key).concat(allLD()));
  const gone = Object.keys(TM).filter((k) => !live.has(k) && TM[k].st !== 'manual');
  if (flag('--dry')) { gone.forEach((k) => console.log('  消す: ' + k.slice(0, 100))); console.log(`消す予定: ${gone.length}件（--dry なので消していない）`); process.exit(0); }
  for (const k of gone) delete TM[k];
  saveTM();
  console.log(`使わなくなった訳を消した: ${gone.length}件`);
  process.exit(0);
}
let pool = flag('--js') ? collectJS() : flag('--inline') ? collectInline() : flag('--bank') ? collectBank() : flag('--ld') ? collectLD() : collect(pages);
pool = [...new Map(pool.map((c) => [c.key, c])).values()];
if (flag('--again')) pool = pool.filter((c) => TM[c.key]);
else if (opt('--trial')) pool = pickTrial(pool.filter((c) => !fresh(c.key)), Number(opt('--trial')));
let cands = pool.filter((c) => !fresh(c.key));
if (opt('--limit')) cands = cands.slice(0, Number(opt('--limit')));   // 少しだけ試すとき
const kept = flag('--limit') ? [] : pool.filter((c) => fresh(c.key));

const srcTok = cands.reduce((n, c) => n + Math.ceil((plain(c.key).length + (c.ja || '').length * 1.5 + 160) / 3.5), 0);
const est = srcTok * 7.5 * PRICE.in + srcTok * 6 * PRICE.out;   // 6回の呼び出し × 文脈 ＋ 考える分を含めた大まかな額
console.log(`対象 ${pages.length} ページ / 訳す文 ${cands.length}（辞書にあって使える文は除いた） / 見込み 約 $${est.toFixed(2)}（まとめて流すと約半額）`);
if (flag('--list')) { cands.forEach((c, i) => console.log(String(i + 1).padStart(3), c.page.replace(/^en\//, '').padEnd(22), plain(c.key).slice(0, 90), c.ja ? '｜' + c.ja.slice(0, 24) : '')); }
if (flag('--estimate') || flag('--list')) process.exit(0);
if (!process.env.ANTHROPIC_API_KEY) { console.error('❌ ANTHROPIC_API_KEY がありません（node --env-file=… で mail-bot/.env を渡す）'); process.exit(1); }
const CAP = Number(opt('--max-usd') || 5);

const results = [];
const byPage = new Map();
for (const c of cands) { if (!byPage.has(c.page)) byPage.set(c.page, []); byPage.get(c.page).push(c); }
for (const list of byPage.values()) list.sort((a, b) => Number(isLabel(b.key)) - Number(isLabel(a.key)));
for (const [page, list] of byPage) {
  const rows = [];
  for (let i = 0; i < list.length; i += BATCH) {
    if (cost() > CAP) { console.log(`⚠️ 上限 $${CAP} に届いたので止めた（--max-usd で変えられる）`); break; }
    const batch = list.slice(i, i + BATCH);
    let res;
    try { res = await translateBatch(batch); }
    catch (e) { console.log(`  ✗ ${page} の ${i + 1}〜${i + batch.length} 件目で失敗（飛ばした・次に流すとここだけやり直す）: ${String(e.message).slice(0, 160)}`); continue; }
    res.forEach((r, j) => rows.push({ ...r, key: batch[j].key, c: batch[j] }));
    for (const r of res) { const k = batch[r.id - 1].key; if (!/^jsl?:/.test(k) && isLabel(k) && r.ok && !check(k, r.es).length && TM[k]?.st !== 'manual') TM[k] = { ...(TM[k] || {}), es: r.es, st: 'validated', by: 'ai', model: MODEL, pv: PROMPT_VERSION, gl: glPrint(termsIn(plain(k))), at: new Date().toLocaleDateString('sv-SE'), pages: [...new Set([...(TM[k]?.pages || []), page])].sort() }; }
    saveTM();   // 途中で止まっても、ここまでの見出しの訳は残る
    console.log(`  ${page} ${Math.min(i + BATCH, list.length)}/${list.length}  （ここまで $${cost().toFixed(2)}）`);
  }
  let fixes = new Map();
  try { fixes = await readThrough(page, rows); } catch (e) { console.log(`  ⚠️ ${page} の通読が失敗（通読の直しなしで進めた）: ${String(e.message).slice(0, 160)}`); }
  const changed = rows.filter((r) => fixes.get(r.key)?.es && fixes.get(r.key).es !== r.es);
  if (changed.length) {
    const re = await stage3(changed.map((r) => r.c), changed.map((r, i) => ({ id: i + 1, es: fixes.get(r.key).es })));
    re.forEach((x, i) => {
      const r = changed[i];
      if (x.ok) { r.read = fixes.get(r.key).reason; r.es = x.es; r.back = x.back; }
      else r.read = `（通読の直し「${plain(fixes.get(r.key).es)}」は意味がずれると判定されたので採らなかった：${x.issue}）`;
    });
  }
  for (const r of rows) {
    r.errs = check(r.key, r.es);
    if (r.errs.length) { r.st = 'failed'; } else r.st = r.ok ? 'validated' : 'needs_review';
    if (r.st !== 'failed') {
      const prev = TM[r.key];
      TM[r.key] = {
        es: (r.key.startsWith('jsl:') ? 'jsl:' : r.key.startsWith('js:') ? 'js:' : '') + r.es, st: r.st, by: 'ai', model: MODEL, pv: PROMPT_VERSION, gl: glPrint(termsIn(/^jsl?:/.test(r.key) ? jsText(r.key.slice(r.key.indexOf(':') + 1)) : plain(r.key))),
        at: new Date().toLocaleDateString('sv-SE'), pages: [...new Set([...(prev?.pages || []), page])].sort(),
        ...(r.st === 'needs_review' ? { note: r.issue } : {}),
      };
    }
    results.push(r);
  }
  saveTM();
}
for (const c of kept) results.push({ key: c.key, c, es: TM[c.key].es, st: TM[c.key].st, ok: true, errs: [], kept: true });
const n = (s) => results.filter((r) => r.st === s).length;
console.log(`\n採用 ${n('validated')} / 要確認 ${n('needs_review')} / 機械検査で落とした ${n('failed')} / 呼び出し ${used.calls}回 / 使った額 $${cost().toFixed(2)}`);
for (const r of results.filter((x) => x.st === 'failed')) console.log('  ✗', plain(r.key).slice(0, 60), '→', r.errs.join('・'));

/* ── 点検表（オーナーが日本語で確かめる）────────────────────── */
const report = opt('--report');
if (report && results.length) {
  const ja = new Map();
  for (let i = 0; i < results.length; i += 30) {
    const part = results.slice(i, i + 30);
    for (const x of await ask(TO_JA, `Items (JSON lines):\n${part.map((r, j) => show({ id: i + j + 1, spanish: r.es })).join('\n')}`, S_JA, 'medium', false)) ja.set(x.id, x.ja);
  }
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  /* 点検表は「1枚の表」。行の左端の色が採否（緑＝採用・橙＝要確認・赤＝機械検査で落とした）。
     狭い画面では1行を1枚に縦に積み、各欄の頭に見出しを出す。結果の生データも横に置く（表だけ作り直せるように）。 */
  fs.writeFileSync(report + '.json', JSON.stringify(results.map((r, i) => ({ ...r, c: undefined, page: r.c.page, ja_ref: r.c.ja, ja_back: ja.get(i + 1) })), null, 1));
  const H = ['#', '英語（原文）', 'スペイン語（訳）', '日本語に戻した文', '確認のメモ'];
  const rows = results.map((r, i) => '<tr class="' + r.st + '">' + [
    i + 1 + '<div class="pg">' + esc(r.c.page.replace(/^en\//, '')) + '</div>',
    esc(plain(r.key)) + (r.c.ja ? '<div class="ja">日本語版：' + esc(r.c.ja) + '</div>' : ''),
    '<b>' + esc(plain(r.es)) + '</b>' + (r.draft && plain(r.draft) !== plain(r.es) ? '<div class="sub">最初の訳：' + esc(plain(r.draft)) + '</div>' : ''),
    esc(ja.get(i + 1)),
    [r.reason && '② 直した理由：' + r.reason, r.read && '④ 通読で直した：' + r.read, r.note && '① 訳者のメモ：' + r.note, r.retried && '③ 意味のずれで1回やり直した', r.kept && '（前回の訳のまま）', !r.ok && '③ 意味のずれが残った：' + r.issue, r.errs.length && '✗ 機械検査：' + r.errs.join('・')].filter(Boolean).map(esc).join('<br>'),
  ].map((v, j) => '<td data-h="' + H[j] + '"' + (j === 0 ? ' class="n"' : j === 2 ? ' lang="es"' : j === 4 ? ' class="memo"' : '') + '>' + v + '</td>').join('') + '</tr>').join('\n');
  const html = reportPage(rows, { ok: n('validated'), review: n('needs_review'), failed: n('failed'), calls: used.calls, usd: cost().toFixed(2), model: MODEL });
  fs.writeFileSync(report, html);
  console.log(`点検表: ${report}（使った額 合計 $${cost().toFixed(2)}）`);
}

