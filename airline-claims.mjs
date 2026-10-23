/* airline-claims.mjs ── 新しい会社ページ（先行5社ではない会社）に残した古い節の「一番・最古・唯一・第N位」を見張る1か所
 * （2026-10-21 全社へ広げる d1・リード L6「残した節の最上級・順位・記録の言い分は、台帳かリポジトリの資料が支えるときだけ」）。
 *
 *   claimsIn(html)   … ページの字（<head>・社名の行・管理ブロックより下の残した節）の中の、最上級・順位・記録の言い分の一覧
 *   SUPPORTED        … 支える資料が在るので残す言い分（会社 ＋ 字のまとまり → 何が支えるか）。ここに無い言い分は外す。
 *   unsupported(slug, html) … 外していない言い分（assert-rollout.mjs が SWITCH の会社ページで 0 を見る）
 *
 * ★ 見る字：題・説明（<head> の title・description）、社名の行（PV-HERO）、管理ブロック（PV-GLANCE）より下の古い節と「よくある質問」。
 *   新しい部品（PV-GLANCE の中）は見ない ── そこの字は airline-display.mjs が台帳から作る。<style>・<script>・コメントは見ない。
 * ★ 言い回しとして順位を言っていないもの（「最大限」「最大の特徴」「最大30日」「最高45%」のような上限・税率）は数えない。
 *   表の見出しの「所得税率（最高）」（＝ 最高税率の欄。2026-10-21 d1 の続き・シンガポール航空の手取りの表）も同じ上限の字なので数えない
 *   ──「（最高）」の形だけ。「業界最高」「世界最高」は下の語で今までどおり数える。
 *   「最大離陸重量」（機体の重さの決まった言い方。エミレーツの応募の条件の表）も順位ではないので数えない。
 *   額の上の端の「（最高¥8,530万）」（年収の幅の上限 ── 2026-10-22 d2・米国の4社の年収の比べの表）も同じ上限の字なので数えない
 *   ── 円の記号が続く形だけ（「最高水準」「最高峰」は今までどおり数える）。
 *   英語の語は、文の中の語として（「First Officer」のような呼び名は数えない）。
 */
const WORDS = [
  /(?:世界|日本|国内|アジア|中東|欧州|業界|地域|地方)(?:最[大古長多高速小]|初|一|有数|唯一)/,
  /最大(?![\d０-９約限]|の特徴|離陸重量)/, /最古/, /最長/, /最多/, /最小/, /(?<!（)最高(?!経営|責任|裁|[\d０-９¥])|（最高(?!）|経営|責任|裁|[\d０-９¥])/, /最先端/, /最新鋭/, /最も/,
  /第\s*[\d０-９一二三四五]+\s*位/, /[\d１-９]位/, /首位/, /No\.?\s*1/, /ナンバーワン/, /トップ(?:クラス|レベル|水準|の)/,
  /唯一/, /随一/, /屈指/, /有数/, /類を見ない/, /世界初|日本初|国内初|初の/, /一番/, /リーディング/, /受賞/,
  /* ★2026-10-23 英語の EN-8（104社の英語のページの残した節を見る前に）：大文字も見る（文の頭の「Largest」・見出しの「World's Best」）── 下の CLAIM_RE は
     字の形（source）だけをつなぐので /i は効かない。大文字と小文字は字の中に両方書く。日本語の語の英語の対も足した
     （最高 → highest・最小 → smallest・世界最速 → fastest・トップクラス → top-tier・類を見ない → unmatched・世界初／日本初 → 「Vietnam's first」・
     最も → 「the most」「the world's most」・最先端 → cutting-edge／state-of-the-art・屈指／有数 → premier／foremost）。
     言い分ではないものは数えない：職位の名前（the first officer）・台帳の額の話（The only amount in its own material …）・
     機体の受領（The first A350-1000 arrived …）・「The biggest advantage:」（日本語の「最大の特徴」と同じ ── 上の 最大(?!…の特徴) の対）。 */
  /\b(?:[Ll]argest|[Oo]ldest|[Ll]ongest|[Bb]iggest(?!\s+advantage\b)|[Ll]eading|[Bb]est|[Aa]ward(?:s|-winning)?|[Hh]ighest|[Ss]mallest|[Ff]astest)\b/,
  /\b[Tt]he (?:first|only)\b(?!\s+(?:[Oo]fficers?\b|amounts?\b|figures?\b|[AB]\d{3}|Boeing\b|Airbus\b))/, /[Ww]orld.s (?:[Bb]est|[Ll]argest)/,
  /\b[Tt]op[- ](?:tier|class|level)\b/, /\b(?:[Uu]nmatched|[Uu]nparall?ell?ed|[Uu]nrivall?ed|[Uu]nsurpassed)\b/,
  /\b(?:[Ww]orld|[Ii]ndustry|[A-Z][A-Za-z.]*)['’]s (?:first|only)\b(?!\s+[Oo]fficers?\b)/,
  /\b(?:[Tt]he|[Ww]orld['’]s|[Ii]ndustry['’]s|[A-Z][A-Za-z.]*['’]s)(?: single)? most\b/,
  /\b(?:[Cc]utting-edge|[Ss]tate-of-the-art|[Pp]remier|[Ff]oremost)\b/,
  /* ★2026-10-23 英語の EN-8 の検査役：日本語の語の英語の対がまだ足りなかった（最多 → 「most frequent」「busiest」・最高 → 「finest」・
     最も → 「the densest … of any」・トップ → 「top-rated」・受賞 → 「won … top scores」）。大文字と小文字は字の中に両方書く（/i は効かない）。
     日本語の対を写した字は数えない（「shortest」＝ 最短ルート・「widest possible」＝ 最大限・「Skytrax 5-Star」＝ スカイトラックス5スター）。
     「Korean won」（通貨の名前）は数えない ── 「won」のあとに同じ文の中で「top scores」が続く形だけ */
  /\b(?:[Ff]inest|[Bb]usiest|[Dd]ensest)\b/, /\b[Mm]ost frequent\b/, /\b[Tt]op[- ](?:rated|ranked)\b/,
  /\b[Ww](?:on|ins)\b[^.<]{0,60}?\b[Tt]op (?:scores?|marks|ratings?)\b/,
  /* ★2026-10-23 英語の EN-8 の2回めの検査役：「world-class」（世界トップクラス ── 上の トップクラス の英語の対）も数える。
     シンガポール航空・カタール航空の訓練施設、エミレーツの医療、エアージャパンの訓練に付いていて、日本語の対はどれも言っていなかった。 */
  /\b[Ww]orld[- ]class\b/,
  /* 2026-10-23 英語の EN-7：英語の順位の言い方（日本語の「第N位」「N位」「首位」の対）── 「ranking third in Japan」（スカイマークの英語のページの
     残した節）は上の語では見えなかった。順位を言う動詞のすぐ後ろの序数・「number one」・「top 3」の形だけ（「First Officer」は数えない）
     ★大文字も見る（文の頭の「Ranked third」・「Number One」・「Top 10」）。下の CLAIM_RE は字の形（source）だけをつなぐので、/i は効かない ──
       大文字と小文字は字の中に両方書く（2026-10-23 EN-7 の検査役） */
  /\b[Rr]ank(?:s|ed|ing)?\s+(?:[Ff]irst|[Ss]econd|[Tt]hird|[Ff]ourth|[Ff]ifth|[Tt]op|No\.?\s*\d|#\d|\d+(?:st|nd|rd|th))\b(?!\s+[Oo]fficers?\b)/, /\b[Nn]umber [Oo]ne\b/, /\b[Tt]op (?:three|five|ten|\d+)\b/,
];
export const CLAIM_RE = new RegExp(WORDS.map(r => r.source).join('|'), 'g');

/** 見る字（ページの3つの所。タグ・<style>・<script>・コメントを外した字） */
export function claimText(html) {
  const strip = s => s.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
  const head = html.slice(0, Math.max(0, html.indexOf('</head>')));
  const title = (/<title>([\s\S]*?)<\/title>/.exec(head) || [, ''])[1];
  const desc = (/<meta name="description" content="([^"]*)"/.exec(head) || [, ''])[1];
  const h0 = html.indexOf('<!--PV-HERO-->'), h1 = html.indexOf('<!--/PV-HERO-->');
  const hero = h0 >= 0 && h1 > h0 ? html.slice(h0, h1) : '';
  const g = html.indexOf('<!--/PV-GLANCE-->'), f = html.indexOf('<footer', g);
  const below = g >= 0 ? html.slice(g, f > g ? f : undefined) : '';
  return [['head', strip(`${title} ${desc}`)], ['hero', strip(hero)], ['body', strip(below)]];
}
/** 言い分の一覧 [{ where, word, around, at, text }]（around ＝ 前後の字・at ＝ その所の字の中の位置） */
export function claimsIn(html) {
  const out = [];
  for (const [where, t] of claimText(html)) for (const m of t.matchAll(CLAIM_RE))
    out.push({ where, word: m[0], at: m.index, text: t, around: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30) });
  return out;
}

/* ── 支える資料が在るので残す言い分（会社ごと）──
   text … 言い分のまとまり（ページの字にそのまま在る字）／why … 何が支えるか（調べの台帳の行の ID か、リポジトリの台帳の名前） */
export const SUPPORTED = Object.freeze({
  zipair: [{ text: 'B787-8 唯一の使用機材', why: '調べの台帳 zipair.fleet の行は B787-8 の1型式だけ（会社の資料「ボーイング787-8型機（290人乗り）8機」）' }],
});

/** 外していない言い分（SUPPORTED の字のまとまりの中に無いもの） */
export function unsupported(slug, html) {
  const ok = SUPPORTED[slug] || [];
  const inside = c => ok.some(s => { for (let i = c.text.indexOf(s.text); i >= 0; i = c.text.indexOf(s.text, i + 1)) if (c.at >= i && c.at < i + s.text.length) return true; return false; });
  return claimsIn(html).filter(c => !inside(c)).map(({ where, word, around }) => ({ where, word, around }));
}
