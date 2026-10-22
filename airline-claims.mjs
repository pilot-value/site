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
  /\b(?:largest|oldest|longest|biggest|leading|best|award(?:s|-winning)?)\b/, /\bthe (?:first|only)\b/, /World.s (?:best|largest)/,
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
