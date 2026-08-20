// translate-review（口コミの日↔英 自動翻訳）の、モデルの返答を取り出す部分を検証する。
//
// この検査を作った理由:
//   2026-08-10、初めての en→ja の翻訳で JSON.parse が
//   「Unexpected non-whitespace character after JSON at position 118」で落ちた。
//   入力を配列で渡しているため、モデルが指示に反して入力と同じ配列の形で返し、
//   「最初の { から最後の } まで」を切る旧実装が "{…},{…}" という壊れた文字列を作っていた。
//   失敗しても 200 を返す設計なので webhook は成功に見え、訳が入らないまま
//   英語の口コミが日本語ページに英語のまま出続けた。壊れ方が静かなので機械で見張る。
//
//   本番では tool_choice で形を固定したので、この経路は保険。
//   保険が効くことを確かめておかないと、また静かに落ちる。
//
// ネットワークも API キーも使わない。使い方: node assert-translate-review.mjs
//
// 本体（TypeScript）をそのまま import する。Node 24 は .ts を直接読めるので、
// 型注釈を正規表現で剥がす必要はない。Deno.env / Deno.serve だけ差し替える。
globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
const { normalizeTranslation, parseLoose, detectLang, missingNumbers, isFatalKeyError } =
  await import('./supabase/functions/translate-review/index.ts');
// 鍵が死んだときの判定は parse-payslip も同じものを持つ。両方から実体を取って突き合わせる。
const payslip = await import('./supabase/functions/parse-payslip/index.ts');

let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`  ✗ ${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`); }
};

const WANT = { culture: '多国籍のクルーが一緒に飛ぶ環境。', salary: 'ドバイは所得税が無い。' };

// 1) 本来の形（tool の input がそのまま来る）
ck('マッピングのオブジェクト', normalizeTranslation(WANT), WANT);

// 2) 実際に落ちた形。入力と同じ配列で返ってくる
ck('配列 + key/translation',
   normalizeTranslation([{ key: 'culture', translation: WANT.culture }, { key: 'salary', translation: WANT.salary }]), WANT);
ck('配列 + key/text（入力の形をそのまま真似た場合）',
   normalizeTranslation([{ key: 'culture', category: '企業文化', text: WANT.culture },
                         { key: 'salary', category: '給与', text: WANT.salary }]), WANT);

// 3) 混ざり物は落とす
ck('空文字・非文字列は落とす',
   normalizeTranslation({ culture: WANT.culture, salary: '   ', wlb: 123, ops: null }), { culture: WANT.culture });
ck('壊れた要素があっても残りは拾う',
   normalizeTranslation([null, 'x', { key: 'culture', translation: WANT.culture }]), { culture: WANT.culture });

// 4) 素のテキストで返ってきたときの保険
const OBJ = JSON.stringify(WANT);
const ARR = JSON.stringify([{ key: 'culture', translation: WANT.culture }, { key: 'salary', translation: WANT.salary }]);
ck('素のオブジェクト',            normalizeTranslation(parseLoose(OBJ)), WANT);
ck('素の配列',                    normalizeTranslation(parseLoose(ARR)), WANT);
ck('```json のフェンス付き',      normalizeTranslation(parseLoose('```json\n' + OBJ + '\n```')), WANT);
ck('前後に説明文が付いた場合',    normalizeTranslation(parseLoose('Here is the translation:\n' + OBJ + '\nLet me know.')), WANT);
ck('配列 + 前後に説明文',         normalizeTranslation(parseLoose('Sure:\n' + ARR + '\nDone.')), WANT);

// 旧実装が落ちた入力そのもの。今は通ること。
const OLD_CRASH = ARR;
try {
  ck('旧実装が落ちた入力（配列）', normalizeTranslation(parseLoose(OLD_CRASH)), WANT);
} catch (e) {
  fail++; console.log(`  ✗ 旧実装が落ちた入力（配列） が今も落ちる: ${e.message}`);
}
// 参考: 旧実装（最初の { 〜 最後の }）だと本当に落ちることを示す
try {
  JSON.parse(OLD_CRASH.slice(OLD_CRASH.indexOf('{'), OLD_CRASH.lastIndexOf('}') + 1));
  fail++; console.log('  ✗ 旧実装が落ちないなら、この検査は原因を取り違えている');
} catch { pass++; }

// 5) JSON が無ければ黙って空を返さず落ちる（訳が空のまま更新されない方が安全）
for (const bad of ['', 'すみません、翻訳できません。', 'no json here']) {
  try { parseLoose(bad); fail++; console.log(`  ✗ JSON でない入力を通した: ${JSON.stringify(bad)}`); }
  catch { pass++; }
}

/* ────────────────────────────────────────────────────────────────────────────
   6) 原文の言語判定。
   「日本語の文字が1つでもあれば ja」だと、英語の口コミに地名が1語入るだけで
   ja と誤判定し、英語→英語に「翻訳」して orig_lang='ja' で保存される。
   すると日本語ページは from===to と見て原文（英語）をそのまま出す＝
   2026-08-10 にオーナーが見つけた症状と同じ見え方になる。比率で見ること。
   ──────────────────────────────────────────────────────────────────────── */
const EN_LONG = 'Roster stability varies month to month on the ultra long haul pairings, and fatigue '
  + 'management is as much on you as on the company. The maintenance standard is high and SOPs are tight.';
const JA_LONG = 'ロスターの安定度は月によって差がある。超長距離の組み合わせが続くと疲労が抜けない。'
  + '整備の水準は高く、手順書もよく整理されている。';
ck('英語の本文は en', detectLang(EN_LONG), 'en');
ck('英語の本文に地名が1語混じっても en', detectLang(EN_LONG + ' We night stop at 羽田.'), 'en');
ck('英語の本文に機種・社名が混じっても en', detectLang(EN_LONG + ' B777 と A380.'), 'en');
ck('日本語の本文は ja', detectLang(JA_LONG), 'ja');
ck('日本語に英語の業界語が混じっても ja', detectLang(JA_LONG + ' SOP や CRM の徹底も進んでいる。'), 'ja');
ck('空文字は en（訳す本文が無いので実害なし）', detectLang(''), 'en');

/* 7) 訳文から数字が落ちていないか。落ちても文章としては自然に読めるので、
      人の目では気づけない。2パス目に渡す材料。 */
const ms = (a, b) => JSON.stringify(missingNumbers(a, b));
ck('数字が残っていれば空', ms('B777 and A380, USD 225K', '機材はB777とA380。年収は225K USD。'), '[]');
ck('落ちた数字を拾う',     ms('B777 and A380', '機材はB777が中心。'), '["380"]');
ck('桁区切りの違いを同じと見る', ms('年収1,800万円', 'about 1800万'), '[]');
ck('数字が無ければ空',     ms('roster stability varies', 'ロスターの安定度は月によって差がある。'), '[]');

/* ────────────────────────────────────────────────────────────────────────────
   8) 鍵が死んだときに気づけるか。
   2026-08-10、Anthropic のキーを1本消したら parse-payslip だけが止まり、
   利用者には「読み取れませんでした」としか出ないまま誰も気づかなかった。
   実画像を投げるまで分からなかったので、認証エラーだけ切り分けて通知するようにした。
   ここで見張るのは「何を鳴らして、何を鳴らさないか」。
   鳴りすぎれば無視されるようになり、鳴らなすぎれば元の木阿弥になる。
   ──────────────────────────────────────────────────────────────────────── */
const FATAL = [
  [401, 'authentication_error', true,  '鍵が無効'],
  [403, 'permission_error',     true,  '権限が無い'],
  [400, 'invalid_request_error', true, '残高切れ・受け付けない引数（temperature で実際に食らった）'],
  [429, 'rate_limit_error',     false, '混雑は時間で直る'],
  [500, 'api_error',            false, '向こうの障害は時間で直る'],
  [529, 'overloaded_error',     false, '過負荷は時間で直る'],
  [400, 'not_found_error',      false, '400 でも invalid_request_error 以外は鳴らさない'],
];
for (const [status, type, want, why] of FATAL) {
  ck(`${status} ${type} → ${want ? '鳴らす' : '鳴らさない'}（${why}）`, isFatalKeyError(status, type), want);
  // 2つの Edge Function が同じ答えを返すこと。片方だけ直すとここで落ちる。
  ck(`${status} ${type} は parse-payslip でも同じ`, payslip.isFatalKeyError(status, type), want);
}

// error.type の取り出しは message を読まない（明細の断片が混ざる経路を作らない）。
const asRes = (s) => ({ text: async () => s });
ck('error.type を取り出す',
   await payslip.anthropicErrorType(asRes('{"type":"error","error":{"type":"authentication_error","message":"x"}}')),
   'authentication_error');
ck('JSON でなければ空',       await payslip.anthropicErrorType(asRes('<html>502</html>')), '');
ck('error が無ければ空',      await payslip.anthropicErrorType(asRes('{"ok":true}')), '');
ck('type が文字列でなければ空', await payslip.anthropicErrorType(asRes('{"error":{"type":123}}')), '');

console.log(`\n==== ${pass} pass / ${fail} fail ====`);
if (fail) process.exitCode = 1;
