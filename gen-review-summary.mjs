/* gen-review-summary.mjs — 会社ページの「口コミの要約」（良い点・気になる点）を作る道具

   オーナーが手元で流す。**どこの DB にも1文字も書かない。**
   出すのは db/review-summary.sql の pv_review_summary_set() に渡す JSON だけ。

   使い方
     node gen-review-summary.mjs --in <口コミの束.json> --airline <会社コード> [--lang ja|en]
         既定は --dry。モデルへ送る文面を出して終わる（通信ゼロ・課金ゼロ・鍵も読まない）
     node gen-review-summary.mjs --in … --airline … --lang … --call
         Anthropic を1回呼び、検品を通った点だけを JSON で出す（⚠️ 課金される）
     node gen-review-summary.mjs --selftest
         検品の部分を、作り置きの返事で確かめる（通信ゼロ）

   口コミの束（--in）
     その会社の reviews_v2 の行を、本文ごと JSON にしたもの。次のどれでも読む。
       ・行の配列                     [ {airline, culture_comment, …, created_at}, … ]
       ・pv_reviews() の返り値そのまま {ok, unlocked, rows:[…]}
       ・上のどちらかを1つだけ包んだ形（SQL Editor から1セルを写したとき）
     ⚠️ created_at は**書き出した字のまま**渡す（マイクロ秒まで）。日付に丸めた束だと、
        サーバが数え直した件数と合わず stale_input で断られる。
     ⚠️ 古い短い会社コード（'cathay' など）の行も同じ束に入れる。入れ忘れると件数が合わない。

   守っていること（サーバ側 db/review-summary.sql も同じ線で弾く。ここは1本目の網）
     ・材料は渡された口コミだけ。会社名も職位も機種も在籍年数も、モデルには渡さない。
     ・良い点・気になる点はそれぞれ3つまで。
     ・1つの点は、**別々の2件以上**の口コミが同じことを言っているときだけ。
       モデルには支えている口コミの番号を出させ、ここで数え直す（k）。
       k が2に満たない点は落とす。番号は出力から外し、残すのは k だけ。
     ・会社の事実としてではなく「〜という声が複数」と書かせる。
     ・人名・日付・金額を書かせない。数字と通貨記号が入った点はここで落とす
       （サーバはここまで見ない ── 網はこの1か所）。
     ・口コミが3件に満たない／2件以上がそろう点が無いときは、空の配列を出す。
       ⚠️ 空の出力を pv_review_summary_set() に渡すと、預けてある要約は**消える**。

   ★文面・検品・上限の実体は supabase/functions/summarize-reviews/index.ts に在る（唯一の正）。
     口コミが変わったときに自動で作り直す Edge Function と、この道具が**同じもの**を使う。
     ここには写しを持たない。直すときはあちらを直す（⚠️ 直したら貼り直して Deploy。
     push だけでは、自動の道だけが古い文面のまま動き続ける）。
     画面・DB との写し（CATS / LIMITS / LEGACY_OF）の一覧もあちらの冒頭に在り、
     db/test-review-summary.mjs が突き合わせている。

   ⚠️ check.mjs の一覧に --call を入れない（課金）。検品（selftest）は
      db/test-review-summary.mjs が同じ関数を呼んで毎回確かめている。
   ⚠️ モデルと呼び方は supabase/functions/translate-review/index.ts にそろえてある
      （temperature を送らない・受け取り口を tool_choice で強制する）。
      新しいモデルには受け取り口の強制を 400 で断るものがある。MODEL を変えるときは、
      変える前に手元で1回流して確かめる（この道具の --call）。 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
/* Node がそのまま読む（translate-eval.mjs が translate-review を読むのと同じやり方）。 */
import {
  MODEL, CATS, LIMITS, MAX_POINTS, MIN_REVIEWS, MIN_SUPPORT, LEGACY_OF, codesOf,
  buildInput, systemPrompt, userMessage, TOOL, requestBody, callModel, settle, payloadOf,
} from './supabase/functions/summarize-reviews/index.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/* 今までどおりの名前で外へ出す（db/test-review-summary.mjs がここから読む）。 */
export {
  MODEL, CATS, LIMITS, MAX_POINTS, MIN_REVIEWS, MIN_SUPPORT, LEGACY_OF, codesOf,
  buildInput, systemPrompt, userMessage, TOOL, requestBody, callModel, settle, payloadOf,
};


// ── 口コミの束を読む ─────────────────────────────────────────
/* 行の配列まで皮をむく（pv_reviews の返り値・1セルだけの包みを外す）。 */
export function unwrapRows(j) {
  for (let i = 0; i < 4; i++) {
    if (Array.isArray(j)) {
      const looksLikeRows = j.length === 0 || j.some((r) => r && typeof r === 'object' && 'airline' in r);
      if (looksLikeRows) return j;
      if (j.length === 1 && j[0] && typeof j[0] === 'object') {
        const vals = Object.values(j[0]);
        if (vals.length === 1) { j = vals[0]; continue; }
      }
      return null;
    }
    if (j && typeof j === 'object') {
      if (Array.isArray(j.rows)) return j.rows;
      const vals = Object.values(j);
      if (vals.length === 1) { j = vals[0]; continue; }
    }
    return null;
  }
  return null;
}


// ── selftest（通信ゼロ）──────────────────────────────────────
export async function selftest(log = console.log) {
  let pass = 0, fail = 0;
  const ok = (cond, label, extra = '') => {
    if (cond) { pass++; log(`  ✅ ${label}`); } else { fail++; log(`  ❌ ${label} ${extra}`); }
  };

  log('\n▼ 検品 ── 作り置きの返事を通す');
  const reply = {
    good: [
      { text: '訓練の教え方が丁寧だという声が複数ある', cat: 'training', reviews: [1, 2, 4] },
      { text: '機内食がおいしいという声がある', cat: 'benefits', reviews: [3] },
      { text: '休みの希望が通りやすいという声が複数ある', cat: 'wlb', reviews: [2, 2] },
      { text: '同僚に相談しやすい雰囲気だという声が複数ある', cat: 'culture', reviews: [1, 5] },
      { text: '福利厚生の説明が分かりやすいという声が複数ある', cat: 'benefits', reviews: [3, 6] },
      { text: '運航の支援体制が心強いという声が複数ある', cat: 'ops', reviews: [2, 5] },
    ],
    concern: [
      { text: 'あ'.repeat(91), cat: 'wlb', reviews: [1, 2] },
      { text: '経営陣との距離が遠いという声が複数ある', cat: 'mgmt', reviews: [1, 2] },
      { text: '昇格まで10年かかるという声が複数ある', cat: 'culture', reviews: [1, 2] },
      { text: '手当が三千万円に届かないという声が複数ある', cat: 'salary', reviews: [1, 2] },
      { text: '勤務の変更が直前に来るという声が複数ある', cat: 'wlb', reviews: [4, 99] },
      { text: '忙しい', cat: 'wlb', reviews: [1, 2] },
      { text: '<b>手当</b>の説明が足りないという声が複数ある', cat: 'salary', reviews: [1, 2] },
      { text: '勤務表が出るのが遅いという声が複数ある', cat: 'wlb' },
      '文字列だけの点',
      { text: '  月の半ばに勤務が変わる\nことがあるという声が複数ある ', cat: 'wlb', reviews: [3, 4, 6] },
    ],
  };
  const s = settle(reply, { lang: 'ja', n: 6 });
  const why = (side) => s.dropped.filter((d) => d.side === side).map((d) => d.why);

  ok(s.good.length === 3, '良い点は3つで切る（4つ目は落とす）', `→ ${s.good.length}`);
  ok(JSON.stringify(s.good.map((p) => p.k)) === '[3,2,2]', '残った点の k は数え直した件数', JSON.stringify(s.good.map((p) => p.k)));
  ok(why('good').filter((w) => w === 'weak_point').length === 2, '1件にしか支えられていない点を落とす（同じ番号の重複は1件と数える）', JSON.stringify(why('good')));
  ok(why('good').includes('over_limit'), '上限を超えた点は over_limit で落ちる');
  ok(s.concern.length === 1, '気になる点は検品を通った1つだけ', `→ ${JSON.stringify(s.concern)}`);
  ok(why('concern').includes('text_too_long'), '長すぎる文（91字）を落とす');
  ok(why('concern').includes('bad_cat'), '6つに無い分類（mgmt）を落とす');
  ok(why('concern').filter((w) => w === 'has_figure').length === 2, '数字・金額の入った文を落とす（半角の数字・漢数字＋円）', JSON.stringify(why('concern')));
  ok(why('concern').includes('weak_point'), '範囲の外の番号は数えない（[4, 99] は1件）');
  ok(why('concern').includes('text_too_short'), '短すぎる文を落とす');
  ok(why('concern').includes('not_plain_text'), 'タグの入った文を落とす');
  ok(why('concern').filter((w) => w === 'bad_point').length === 2, '形の違う点を落とす（番号の無い点・文字列だけ）');
  ok(s.concern[0] && s.concern[0].text === '月の半ばに勤務が変わる ことがあるという声が複数ある', '前後の空白と改行は1つの空白にそろえる', JSON.stringify(s.concern[0]));

  const all = [...s.good, ...s.concern];
  ok(all.every((p) => JSON.stringify(Object.keys(p)) === '["text","cat","k"]'), '出力の点は text・cat・k の3つだけ（口コミの番号は付かない）');
  const payload = payloadOf({ airline: 'sample-air', lang: 'ja', n: 6, newest: '2026-01-01T00:00:00+00:00' }, s);
  ok(!/reviews|_idx|trace|dropped/.test(JSON.stringify(payload)), '預ける JSON に番号・検品の記録が混ざらない');
  ok(JSON.stringify(Object.keys(payload)) === '["airline","lang","n","newest","good","concern"]', '預ける JSON の鍵は6つ');

  ok(settle({ good: [{ text: '円滑に連絡が取れるという声が複数ある', cat: 'culture', reviews: [1, 2] }], concern: [] }, { lang: 'ja', n: 3 }).good.length === 1,
     '「円滑」は金額として落とさない');
  ok(settle({ good: [{ text: '給与は￥で払われるという声が複数ある', cat: 'salary', reviews: [1, 2] }], concern: [] }, { lang: 'ja', n: 3 }).good.length === 0,
     '通貨記号の入った文を落とす');
  ok(settle({ good: [{ text: '訓練が１年続くという声が複数ある', cat: 'training', reviews: [1, 2] }], concern: [] }, { lang: 'ja', n: 3 }).good.length === 0,
     '全角の数字も落とす');
  const few = settle(reply, { lang: 'ja', n: 2 });
  ok(few.good.length === 0 && few.concern.length === 0, '口コミが3件に満たなければ、返事が何であれ空');
  const en = settle({ good: [{ text: 'Several pilots mention that training captains take time to explain.', cat: 'training', reviews: [1, 3] },
                             { text: 'Good training.', cat: 'training', reviews: [1, 3] },
                             { text: 'Several pilots mention ' + 'x'.repeat(170), cat: 'ops', reviews: [1, 3] }], concern: [] }, { lang: 'en', n: 3 });
  ok(en.good.length === 1 && en.dropped.map((d) => d.why).join() === 'text_too_short,text_too_long', '英語は 16〜180字', JSON.stringify(en.dropped));

  log('\n▼ 口コミの束 → 材料');
  const rows = [
    { airline: 'cathay-pacific', culture_comment: '相談しやすい', created_at: '2026-03-01T00:00:00.000100+00:00', position: 'captain', fleet: 'B777' },
    { airline: 'cathay', wlb_comment: '休みが取りやすい', created_at: '2026-03-01T00:00:00.000900+00:00' },
    { airline: 'cathay-pacific', mgmt_comment: '経営陣への提案だけ', created_at: '2026-04-01T00:00:00+00:00' },
    { airline: 'cathay-pacific', culture_comment: '   ', created_at: '2026-05-01T00:00:00+00:00' },
    { airline: 'ana', culture_comment: '別の会社', created_at: '2026-06-01T00:00:00+00:00' },
    { airline: 'cathay-pacific', orig_lang: 'en', training_comment: 'Instructors are patient.',
      translations: { ja: { training: '教官が辛抱強い' } }, created_at: '2026-02-01T00:00:00+00:00' },
  ];
  const inp = buildInput(rows, { airline: 'cathay-pacific', lang: 'ja' });
  ok(inp.n === 3, '数えるのは6分類のどれかに本文がある行だけ（提案だけ・空白だけ・別の会社は数えない）', `→ ${inp.n}`);
  ok(inp.newest === '2026-03-01T00:00:00.000900+00:00', 'いちばん新しい時刻はマイクロ秒まで比べ、渡された字のまま返す', String(inp.newest));
  ok(inp.reviews[2].cats.training === '教官が辛抱強い', '原文が別の言語なら、その言語の訳を材料にする');
  ok(buildInput(rows, { airline: 'cathay-pacific', lang: 'en' }).reviews[2].cats.training === 'Instructors are patient.', '原文と同じ言語なら原文のまま');
  ok(buildInput(rows, { airline: 'cathay-pacific', lang: 'en' }).reviews[0].cats.culture === '相談しやすい', '訳が無い欄は原文で渡す');
  const msg = userMessage(inp.reviews);
  ok(!/captain|B777|2026|cathay/.test(msg), 'モデルへ渡す文面に職位・機種・時刻・会社コードが入らない');
  ok(/^\[1\]$/m.test(msg) && /^\[3\]$/m.test(msg) && !/^\[4\]$/m.test(msg), '口コミに 1 からの番号を振る');
  ok(unwrapRows({ ok: true, unlocked: true, rows }).length === 6 && unwrapRows([{ jsonb_agg: rows }]).length === 6
     && unwrapRows(rows).length === 6 && unwrapRows('x') === null, 'pv_reviews の返り値・1セルの包み・素の配列を読める');

  log('\n▼ 送る文面の形（偽の fetch ── 通信しない）');
  const body = requestBody('ja', inp.reviews);
  ok(body.model === MODEL && !('temperature' in body), 'モデルは決めた1つ・temperature を送らない');
  ok(body.tool_choice.type === 'tool' && body.tool_choice.name === TOOL.name && body.tools.length === 1, '受け取り口を強制する');
  const sys = body.system;
  ok(/at most 3 points/.test(sys) && /at least 2 DIFFERENT reviews/.test(sys) && /never as a fact about the company/.test(sys)
     && /no names of people, no dates or years, no amounts of money/.test(sys) && /Use only what is written/.test(sys)
     && /return empty arrays for both/.test(sys) && /という声が複数/.test(sys), '指示に約束の6つが入っている');
  let sent = null;
  const fake = (payload, status = 200) => async (url, init) => {
    sent = { url, init };
    return { ok: status === 200, status, text: async () => JSON.stringify(payload), json: async () => payload };
  };
  const got = await callModel(body, 'k-selftest', fake({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: TOOL.name, input: reply }] }));
  ok(got === reply, '受け取り口の中身をそのまま返す');
  ok(sent.url === 'https://api.anthropic.com/v1/messages' && sent.init.headers['x-api-key'] === 'k-selftest'
     && sent.init.headers['anthropic-version'] === '2023-06-01' && JSON.parse(sent.init.body).model === MODEL, '宛先とヘッダ');
  const thrown = async (f) => { try { await f(); return ''; } catch (e) { return String(e.message); } };
  ok(/max_tokens/.test(await thrown(() => callModel(body, 'k', fake({ stop_reason: 'max_tokens', content: [] })))), '途中で切れた返事は使わない');
  ok(/refusal/.test(await thrown(() => callModel(body, 'k', fake({ stop_reason: 'refusal', content: [] })))), '断られた返事は使わない');
  ok(/no submit_summary/.test(await thrown(() => callModel(body, 'k', fake({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] })))), '受け取り口の無い返事は使わない');
  ok(/anthropic 401/.test(await thrown(() => callModel(body, 'k', fake({ error: { type: 'authentication_error' } }, 401)))), 'API のエラーはそのまま投げる');

  log(`\n══ ${pass} pass / ${fail} fail ══`);
  return { pass, fail };
}


// ── 実行 ─────────────────────────────────────────────────────
function loadKey() {
  /* translate-eval.mjs と同じ読み方。--call のときだけ通る。 */
  const envPath = join(ROOT, 'mail-bot/.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      const [k, ...v] = s.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    }
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY がありません。mail-bot/.env に開発用のキーを1行足してください。');
    process.exit(1);
  }
  return process.env.ANTHROPIC_API_KEY;
}

async function main(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes('--selftest')) {
    const r = await selftest();
    process.exit(r.fail ? 1 : 0);
  }

  const file = arg('--in');
  const airline = String(arg('--airline') || '').trim().toLowerCase();
  const lang = arg('--lang') || 'ja';
  const call = argv.includes('--call');
  if (call && argv.includes('--dry')) { console.error('❌ --dry と --call は一緒に付けられません'); process.exit(1); }
  if (!file || !airline) {
    console.error('使い方: node gen-review-summary.mjs --in <口コミの束.json> --airline <会社コード> [--lang ja|en] [--dry|--call]');
    console.error('        node gen-review-summary.mjs --selftest');
    process.exit(1);
  }
  if (!LIMITS[lang]) { console.error(`❌ --lang は ja か en: ${lang}`); process.exit(1); }
  if (!existsSync(file)) { console.error(`❌ ファイルがありません: ${file}`); process.exit(1); }

  let rows;
  try { rows = unwrapRows(JSON.parse(readFileSync(file, 'utf8'))); } catch (e) { rows = null; }
  if (!rows) { console.error('❌ 口コミの束として読めません（行の配列か、pv_reviews の返り値を渡してください）'); process.exit(1); }

  const inp = buildInput(rows, { airline, lang });
  if (inp.seen > 0 && inp.n === 0) {
    console.error('❌ この会社の行は在りますが、本文が1件も入っていません（鍵の無い立場で書き出した束かもしれません）');
    process.exit(1);
  }
  const head = { airline, lang, n: inp.n, newest: inp.newest };
  const tooFew = inp.n < MIN_REVIEWS;
  if (!tooFew && !inp.newest) { console.error('❌ created_at の入った行が1件もありません（時刻を落とした束は使えません）'); process.exit(1); }

  if (!call) {
    console.log('▼ 口コミの要約 ── 送る文面の確認（API は呼びません）');
    console.log(`  会社: ${airline}（数える会社コード: ${codesOf(airline).join(' / ')}）`);
    console.log(`  言語: ${lang}`);
    console.log(`  材料にする口コミ: ${inp.n}件（束の中のこの会社の行: ${inp.seen}件）`);
    console.log(`  いちばん新しい口コミ: ${inp.newest || '—'}`);
    if (tooFew) {
      console.log(`\n  口コミが${MIN_REVIEWS}件に満たないので、--call を付けてもモデルは呼ばず、空の要約を出します。`);
      return;
    }
    const body = requestBody(lang, inp.reviews);
    console.log(`\n▼ モデル: ${body.model}（max_tokens ${body.max_tokens}）`);
    console.log('\n▼ system\n' + body.system);
    console.log('\n▼ 受け取り口（tool）\n' + JSON.stringify(body.tools[0], null, 2));
    console.log('\n▼ user\n' + body.messages[0].content);
    console.log('\n══ ここまでが送る文面。--call を付けるまで何も送りません ══');
    return;
  }

  let settled;
  if (tooFew) {
    console.error(`口コミが${MIN_REVIEWS}件に満たないので、モデルは呼ばずに空の要約を出します。`);
    settled = { good: [], concern: [], dropped: [], trace: [] };
  } else {
    const key = loadKey();
    const reply = await callModel(requestBody(lang, inp.reviews), key);
    settled = settle(reply, { lang, n: inp.n });
  }
  for (const d of settled.dropped) console.error(`  落とした点 [${d.side}] ${d.why}: ${d.text}`);
  /* 手元で見比べるための控え。標準出力（＝預ける JSON）には載せない。 */
  for (const t of settled.trace) console.error(`  残した点 [${t.side}] 口コミ ${t.reviews.join(', ')} → ${t.text}`);
  if (!settled.good.length && !settled.concern.length) {
    console.error('⚠️ 点が1つも残りませんでした。この出力を pv_review_summary_set() に渡すと、預けてある要約は消えます。');
  }
  console.log(JSON.stringify(payloadOf(head, settled), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => { console.error('❌ ' + (e && e.message || e)); process.exit(1); });
}
