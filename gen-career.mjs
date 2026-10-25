/* career.html の本文を書く（2026-10-03・2026-10-04 に深い画面を足した）。
 * 入口・会社の概要・2社の比較を1枚に入れる。エティハド航空だけ、その先（タブ・その数字自身の詳細・
 * 就航地・カード保存の器）まで持つ ── どの会社が深い画面を持つかは下の DEEP の1か所。
 *
 *   node gen-career.mjs           career.html の <!--PV-CAREER-->…<!--/PV-CAREER--> と ?v= を書く
 *   node gen-career.mjs --check   書かずに比べるだけ（古ければ 1 で終わる）
 *
 * ★数字を手で書かない。出どころはここに並べたものだけ。
 *     年収の推定        … pv-airline-view.mjs の viewOf().pay.<職位>.est（正本は salary-data.mjs の SALARY の avg）
 *     会社が公表した額  … salary-basis.mjs の BASIS（figures()）
 *     家賃              … pv-airline-view.mjs の viewOf().living（1か月あたり）と rentCell()
 *     写真              … airline-photos.mjs
 *     就航地            … career-facts.mjs の FACTS（出どころつきの台帳）
 *     質問の鍵          … pv-conditions.mjs の QUESTIONS（入口の先。無い鍵なら止まる）
 *     QR                … career-qr.mjs（カード保存の器に、公開ページの住所を行列で置く）
 *   社名は SALARY の ja・色と略号は airlines-meta.js。
 *
 * ★大きい額と棒は、5社とも・機長も副操縦士も「推定年収」（2026-10-06 オーナー判断）。
 *     読み口は会社ページと同じ pv-airline-view.mjs の1か所 ── ここで決め直さない（2つの画面がずれない）。
 *     年収を「確認中」と出さない。概要・比較・詳細・カードの全部が cell() の答えだけを使う。
 *   ⚠️ 会社が公表した額（求人の上限・目標年収・下限・乗員全体の平均）を、棒にも大きい額にも入れない。
 *      置き場は「会社が公表している金額」の一覧だけ（pub()）。誰の額か（内訳の名前）・何の額か（種類）・
 *      額・出どころを一緒に出す。推定と公表額を同じ目盛に並べない。
 *   ⚠️ 上限（max_…）を平の額として出さない。「〜」・斜線の印（.cr-hatch）・「上限」の字の3つが必ず一緒に出る
 *      （種類の名前に「上限」の字が無ければ止まる）。
 *   ⚠️ 推定と公表額の差を埋めない（エバー航空の副操縦士は 推定 ¥1,590万・会社の公表は 約1,589万円超 のまま）。
 *   ⚠️ 推定の根拠を作らない。台帳に根拠が記録してある職位（est.backed）だけ 根拠・算出方法・時点 を出し、
 *      無い職位は1行だけ（EST_PLAIN）。幅・件数・時点を足さない。
 *
 * ★家賃は1か月あたり。街どうしを同じ目盛に並べない（比較では、会社ごとの箱に その街の物差し・出どころ・時点 を付ける）。
 *
 * ★比較の読む順は 年収 → 提出された年収 → 口コミ → 家賃 → 月の働き方 → 待遇 → 内訳（公表額）。順は assert-career.mjs が見ている。
 *
 * ★主表示には目印を付ける（5社とも）。カード保存はこの DOM の字を読む。
 *     data-main="cap|fo"      額（textContent が画面の額そのまま）
 *     data-main-tag="cap|fo"  札（「推定」）
 *     data-main-bar="cap|fo"  棒（style の --w がその会社の目盛での長さ・data-man が額（万円））
 *   ⚠️ 概要の中にだけ付ける。比較・詳細には付けない（1社の中で1つずつ）。
 *   ⚠️ 公表額の一覧には付けない（カードの大きい額は推定だけ）。
 *
 * ★生きた欄（.crl）は空で出荷する。数・星・件数をここで書かない（career-live.js がサーバーの答えで埋める）。
 *
 * ★check-salary.mjs が読める形で書く。額の行は「社名 → 職位 → 金額」をこの順に、
 *   間に数字を挟まずに置く（あちらの GAP は24個まで・数字で切れる。「A320」は額の後ろ）。
 *   概要では社名を・比較では職位を、画面上は隠している（読み上げには残る）。
 *   ⚠️ 行の中に「手取」「月額」「税引」「パッケージ」などの語を足さない。
 *      あちらはその語が近くにある金額を「年額ではない」とみなして**黙って照合から外す**。
 *
 * ★画像ファイルを読まない。assert-generated.mjs は画像の無いコピーの中で流す。
 *   大きさは airline-photos.mjs の w / h から書く。
 *
 * ★何度流しても同じ。String.replace は関数形（$ を素通しする）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { BASIS, TIERS, figures, fxNote } from './salary-basis.mjs';
import { viewOf, rentCell, coText, LEAD as LEAD_FIVE, scaleOf, scaleTop, width, SCALE_STEP, VIEW_EN, NET_EN, placeCountryEn } from './pv-airline-view.mjs';
import { model, REGIONS } from './directory-model.mjs';
import { logoHtml } from './airline-logo.mjs';
import { PHOTOS, primary, needsCredit, src as photoSrc, SMALL_W } from './airline-photos.mjs';
import { FACTS, atText, introText, valueText, EN as CF_EN, twin, twinOf, valueTextEn, atTextEn, introTextEn, JA_CHARS } from './career-facts.mjs';
import { primary as placeShot, needsCredit as placeNeedsCredit, src as placeSrc, SMALL_W as PLACE_SMALL_W, EN as PL_EN, subjectEn, changesEn } from './place-photos.mjs';
import { EN as CO_EN } from './airline-facts.mjs';
import { EN as LV_EN } from './living-facts.mjs';
import { QUESTIONS } from './pv-conditions.mjs';
import { researchCities } from './airline-rollout.mjs';
import { qrMatrix } from './career-qr.mjs';
import { curCore, bakeHtml } from './cur-core.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

export const PAGE = 'career.html';
/* ★2026-10-25 英語の EN-9：同じ1枚の英語（en/career.html）。中身は日本語と同じ部品・同じ並び・同じ数字で、字だけ英語（下の WORDS.en）。
   英語の頭（<head>・左のメニュー）はそのファイルが持つ ── ここが書くのは日本語と同じ PV-CAREER の印のあいだと ?v= だけ。 */
export const PAGE_EN = `en/${PAGE}`;
/* 先行5社。並びは入口のタイルの順。（正本は airline-rollout.mjs の LEAD。ここに並びを打たない） */
export const FIVE = LEAD_FIVE;
/* 深い画面（タブ・詳細・就航地）を持つ会社。ほかは段1の概要のまま。 */
export const DEEP = ['etihad'];
/* 比較を社名なしで開いたときの2社。 */
export const PAIR = ['jal', 'cathay-pacific'];
export const ROLES = [['cap', '機長'], ['fo', '副操縦士']];
/* 概要のタブ。住所は top だけ tab= を持たない。 */
export const TABS = [['top', '概要'], ['work', '勤務・待遇'], ['life', '暮らし・ステイ']];
/* その数字自身の詳細（d=cap-est・d=fo-est）。在るのは推定だけ ── 公表額は一覧（pub()）が持つ。 */
export const KINDS = [['est', '推定年収']];
/* 「会社が公表している金額」に並べる区分。訓練生は入れない（年収の比較ではない）。
   ★機長と副操縦士を分けない額（運航乗務員・運航乗務職の全体の平均 ＝ 台帳の crew）も入れない（2026-10-21 P12.77 オーナー
     「そもそも運行乗務員の平均年収で出してどうするの？機長、副操縦士のわかないと意味ないじゃん」）。台帳には残す（社内の見張り）。
     その額だけの会社（JAL・ANA）は「会社が公表している金額」の一覧そのものを出さない（P12.91-7）── その額の話をしている前提と出どころも、一緒に出なくなる。 */
const PUB_RANKS = ['cap', 'fo'];
/* 鍵の名前の末尾で決まる言い添え（年収の下限・手当の下限）。 */
const openEnd = key => (/_over$/.test(key) ? '超' : /_from$/.test(key) ? 'から' : '');
/* 求人の上限（max_…）は、額の頭に「〜」を付ける（平の額に見せない）。斜線の印と「上限」の字も一緒に出す。 */
const upTo = key => (/^max_/.test(key) ? '〜' : '');

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const yen = m => `¥${m.toLocaleString('en-US')}万`;

/* ── いま書いている言葉（★2026-10-25 英語の EN-9）────────────────────────────
   LANG ＝ 'ja'（career.html）か 'en'（en/career.html）。W ＝ その言葉の字（下の WORDS）。UP ＝ 部品・写真のあるルートへの道
   （career.html から ''・en/career.html から '../'）。ほかのページへの道（airlines/…・pay-report.html …）は同じ言葉のページ
   （en/ から見れば en/ の英語のページ）なので、どちらの言葉でも同じ字のまま。切り替えるのは render() の中だけ（inLang）。 */
let LANG = 'ja';
let W;
let UP = '';
const EN = () => LANG === 'en';
/* 英語のページの円の額は、HTML の時点でドルの span にする（JS を動かさない読み手にもドルで届く）。焼き方は bake-en-currency.mjs と
   同じ決まり（cur-core.mjs の bakeHtml ── span を作るのは bakeText の1か所）。data-orig は日本語と同じ「¥3,700万」の形
   （check-salary.mjs が unbake して「万」で読める）。⚠️ 生成器が焼くので、あとで bake-en-currency.mjs を流しても1文字も変わらない。 */
const C_EN = await curCore('USD', 'en');

/* ── ことば（WORDS）── 2026-10-25 英語の EN-9 ─────────────────────────────
   この1枚が自分で書く字は、ここの2つだけ（ja ＝ career.html・en ＝ en/career.html）。台帳の字は台帳の英語（読み口 viewOf(…, 'en')・
   career-facts.mjs / living-facts.mjs / place-photos.mjs の EN・salary-basis.mjs の *_en）から。
   ★鍵・形は ja と en で同じ（checkWords が見る ── 違えば読み込みで止まる・assert-career.mjs も呼ぶ）。値は字か、字を返す関数（引数はエスケープ済みの字）。
   ★ja は今までの career.html の字そのもの（1文字も変えない ── 日本語のページは ?v= のほか1バイトも変わらない）。
   ★en の字は、サイトに在る英語を先に使う（英語の会社ページの WORDS.en・航空会社一覧の英語・質問の台帳の en）。新しい英語の字は
     オーナーの英語の一覧に載る（P12.86-3）。数字・社名・日付は引数で入る（英語の字に数字を手で打たない）。 */
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WORDS = Object.freeze({
  ja: Object.freeze({
    sep: '・', slash: '／', paren: x => `（${x}）`, kv: (k, v) => `${k}：${v}`, introJoin: '',
    rank: Object.freeze({ cap: '機長', fo: '副操縦士' }),
    tabs: Object.freeze({ top: '概要', work: '勤務・待遇', life: '暮らし・ステイ' }),
    est: '推定年収', estOf: l => `${l}の推定年収`, estTarget: '機種の指定なし',
    estPlain: '当サイトの推定（公開情報からの推計）。根拠の資料はまだ記録していません。',
    estL: '推定', basisL: '根拠', methodL: '算出方法', asOfL: '時点', target: '対象', estAbout: '推定年収について',
    photoAlt: (n, a) => `${n}の ${a}`, photos: (c, n) => `写真${c ? `（${c}）` : ''}`,
    back: '航空会社を選ぶ', backCard: '戻る', go: '詳しく', moreTowns: 'ほかの街',
    srcAt: (a, c) => `適用時点：${a} ／ 確認日：${c}`, req: '応募条件', basis: '前提と出どころ', pubH: '会社が公表している金額',
    up: Object.freeze({ max: y => `〜${y}`, over: y => `${y} 超`, from: y => `${y} から` }),
    h1: '次のキャリアを、<br/>選択する。', cmpAll: '航空会社を比較', others: 'ほかの航空会社を見る', cmp: '他社と比較',
    pay: '年収', revJobs: '口コミ・募集を見る',
    topic: Object.freeze({ taxi: '通勤タクシー・クルーバス', 'staff-travel': '社員向け航空券', upgrade: '機長昇格' }), asksH: '匿名で答える',
    asOf: t => `${t} 時点`, org: '会社', fleet: '機材の内訳', srcs: '出どころ',
    jobs: '募集', posted: (p, d) => `${p}・${d} 掲載`, open: d => `${d}に公開中を確認`,
    bens: '公表されている待遇', inst: '教官の求人（A320）に書かれている手当',
    town: '拠点の街', rentH: r => `家賃（${r}・1か月あたり）`, rentBasis: '家賃の前提と出どころ',
    reviews: '口コミ', card: 'カードを保存', work: '月の働き方', payAnon: '匿名で給与を提出する', dests: '就航地',
    destsOf: n => `${n}の就航地`, seasonal: '季節便', maps: 'Google マップで開く', hotels: 'ホテル',
    first: '1社目', second: '2社目', swap: '2社を入れ替える', realPay: '提出された年収', rentCmp: '拠点の街の家賃', perMonth: '1か月あたり',
    benCmp: '待遇', close: '閉じる', search: '航空会社名・国名で検索', none: '該当する航空会社が見つかりませんでした',
    /* ★WP-compare-all-13 F2：会社ページの暮らしの板の字（gen-airline-glance.mjs の WORDS.rentNone）の写し ── 1文字も変えない */
    rentNone: '家賃の資料を確認できていません',
  }),
  en: Object.freeze({
    sep: ' · ', slash: ' / ', paren: x => ` (${x})`, kv: (k, v) => `${k}: ${v}`, introJoin: ' ',
    rank: Object.freeze({ cap: 'Captain', fo: 'First Officer' }),
    tabs: Object.freeze({ top: 'Overview', work: 'Duty &amp; benefits', life: 'Life &amp; layovers' }),
    est: 'Estimated annual pay', estOf: l => `${l}: estimated annual pay`, estTarget: 'No aircraft type specified',
    estPlain: 'Our estimate (from public information). We have not yet recorded the source documents.',
    estL: 'Estimate', basisL: 'Basis', methodL: 'Method', asOfL: 'As of', target: 'Covers', estAbout: 'About the estimated pay',
    photoAlt: (n, a) => `${n} ${a}`, photos: (c, n) => `${n === 1 ? 'Photo' : 'Photos'}${c ? ` (${c})` : ''}`,
    back: 'Choose an airline', backCard: 'Back', go: 'Details', moreTowns: 'Other towns',
    srcAt: (a, c) => `${a} · checked ${c}`, req: 'Requirements', basis: 'Basis and sources', pubH: 'Pay the airline publishes',
    up: Object.freeze({ max: y => `up to ${y}`, over: y => `over ${y}`, from: y => `from ${y}` }),
    h1: 'Choose your<br/>next career', cmpAll: 'Compare airlines', others: 'See other airlines', cmp: 'Compare',
    pay: 'Pay', revJobs: 'See reviews and jobs',
    topic: Object.freeze({ taxi: 'Commuting and taxis', 'staff-travel': 'Staff Travel', upgrade: 'Upgrade to captain' }), asksH: 'Answer anonymously',
    asOf: t => `as of ${t}`, org: 'Company', fleet: 'Fleet', srcs: 'Sources',
    jobs: 'Jobs', posted: (p, d) => `${p} · posted ${d}`, open: d => `Confirmed open on ${d}`,
    bens: 'Benefits the airline publishes', inst: 'Allowances in the instructor vacancy (A320)',
    town: 'Base city', rentH: r => `Rent (${r}, per month)`, rentBasis: 'Rent basis and sources',
    reviews: 'Reviews', card: 'Save card', work: 'Monthly duty', payAnon: 'Add your pay anonymously', dests: 'Destinations',
    destsOf: n => `${n} destinations`, seasonal: 'Seasonal', maps: 'View on Google Maps', hotels: 'Hotels',
    first: 'First airline', second: 'Second airline', swap: 'Swap the two airlines', realPay: 'Submitted pay', rentCmp: 'Rent in the base city', perMonth: 'per month',
    benCmp: 'Benefits', close: 'Close', search: 'Search by airline or country', none: 'No airlines matched your search',
    rentNone: 'We have not been able to confirm rent sources',
  }),
});
/** WORDS の検査：ja と en の鍵がどの深さでも同じ・同じ種類（字／関数／表）・en の字（関数は呼んだ答え）に日本語の字が無い・空でない。
    返すのは [理由の字…]（空 ＝ 通る）。読み込みで呼んで止める（下）・assert-career.mjs も呼ぶ。 */
export function checkWords(words = WORDS) {
  const bad = [], kind = x => (Array.isArray(x) ? 'array' : typeof x);
  const walk = (a, b, at) => {
    if (kind(a) !== kind(b)) { bad.push(`${at}: 日本語は ${kind(a)}・英語は ${kind(b)}`); return; }
    if (a && typeof a === 'object') {
      const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
      for (const k of ka) if (!kb.includes(k)) bad.push(`${at}.${k}: 英語に無い鍵`);
      for (const k of kb) if (!ka.includes(k)) bad.push(`${at}.${k}: 日本語に無い鍵`);
      for (const k of ka) if (kb.includes(k)) walk(a[k], b[k], `${at}.${k}`);
      return;
    }
    const r = typeof b === 'function' ? b('A', 'B') : b;
    if (typeof r !== 'string') bad.push(`${at}: 英語が字でない`);
    else if (JA_CHARS.test(r)) bad.push(`${at}: 英語の字に日本語の字（${r}）`);
    else if (!r.trim() && (typeof a === 'function' ? a('A', 'B') : a).trim()) bad.push(`${at}: 英語が空`);
  };
  walk(words.ja, words.en, 'WORDS');
  return bad;
}
{
  const bad = checkWords();
  if (bad.length) throw new Error(`gen-career.mjs の WORDS（日本語と英語の対）が食い違う ── ${bad.join(' ／ ')}`);
}
W = WORDS.ja;
/* 書く言葉を切り替える（日本語に戻すのは finally ── 途中で止まっても、次に日本語を英語で書かない） */
function inLang(lang, fn) {
  if (lang !== 'ja' && lang !== 'en') throw new Error(`言葉は ja か en（${lang}）`);
  const was = [LANG, W, UP];
  LANG = lang; W = WORDS[lang]; UP = lang === 'en' ? '../' : '';
  try { return fn(); } finally { [LANG, W, UP] = was; }
}
/* 台帳の日本語の字の英語。行に英語の欄が在ればそれ（呼ぶ側が先に見る）・無ければ台帳の英語の表（会社ページの読み口と同じ順 ──
   VIEW_EN・NET_EN・airline-facts・career-facts・living-facts、そのあと写真の台帳）・最後にこの1枚の表（LEDGER_EN）。無ければ止める
   （英語のページに日本語の字を出さない・英語を作文で埋めない）。 */
const EN_DICTS = [VIEW_EN, NET_EN, CO_EN, CF_EN, LV_EN, PL_EN];
/* 英語の対がどの台帳にも無い字（いまは salary-basis.mjs の 応募条件・休暇 の5つ）。この1枚の英語のページの「会社が公表している金額」にだけ出る。
   ★日本語の字が台帳から変わったら、ここが使われなくなって止まる（下の LEDGER_USED ── 古い英語を言い続けない）。 */
const LEDGER_EN = Object.freeze({
  '最低総飛行時間 1,500時間（3,000時間が望ましい）・うち機長時間 500時間以上・英語能力証明レベル4以上':
    'Minimum 1,500 hours total (3,000 hours preferred), including at least 500 hours in command; ICAO English level 4 or above',
  '最低総飛行時間 250時間': 'Minimum 250 hours total',
  '最低総飛行時間 2,000時間・多人数運航ジェット（最大離陸重量20トン超）500時間・ICAO ATPL・英語能力証明レベル4':
    'Minimum 2,000 hours total; 500 hours on multi-crew jets (maximum take-off weight over 20 tonnes); ICAO ATPL; ICAO English level 4',
  '年次有給 28日': 'Paid annual leave: 28 days',
  '年次有給 21日': 'Paid annual leave: 21 days',
});
const LEDGER_USED = new Set();
function enOf(s, where = '') {
  const t = String(s ?? '');
  if (!t || !JA_CHARS.test(t)) return t;
  for (const d of EN_DICTS) { const e = twinOf(d, t); if (typeof e === 'string' && e) return e; }
  if (Object.hasOwn(LEDGER_EN, t)) { LEDGER_USED.add(t); return LEDGER_EN[t]; }
  throw new Error(`英語の比較のページ：英語の対が無い字${where ? `（${where}）` : ''} ── ${t}`);
}
/* 台帳の行 x の項目 f（'ja'・'cond_ja'・'city_ja' …）の、いまの言葉の字。英語は行の英語の欄 → 台帳の英語の表（career-facts.mjs の twin）。 */
const fld = (x, f) => (EN() ? (twin(CF_EN, x, f) || enOf(x[f], `${x.key || x.iata || ''}.${f}`)) : x[f]);
/* 日付（at）の字。日本語は atText・英語は atTextEn */
const atX = at => (EN() ? atTextEn(at) : atText(at));
/* 値の字（数と単位・字）。英語は valueTextEn（単位の英語が無ければ止める） */
const valX = x => {
  if (!EN()) return valueText(x);
  const e = valueTextEn(CF_EN, x);
  if (typeof e !== 'string' || !e) return enOf(x.value, `${x.key || ''}.value`);
  return e;
};
/* 英語の日付（2026-10-04 → 4 October 2026）。 */
const dayEn = iso => String(iso || '').replace(/^(\d{4})-(\d\d)-(\d\d)$/, (m, y, mo, d) => `${+d} ${MONTHS_EN[+mo - 1]} ${y}`);

/* 色と略号は airlines-meta.js（ブラウザ用の即時関数。window を渡して中身だけ借りる）。 */
const META = (() => {
  const win = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'airlines-meta.js'), 'utf8'))(win);
  return win.PV_AIRLINES;
})();
const meta = slug => {
  const a = META.find(x => x.file === `airlines/${slug}.html`);
  if (!a) throw new Error(`${slug}: airlines-meta.js に無い`);
  return a;
};
const color = slug => {
  const c = meta(slug).color;
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error(`${slug}: airlines-meta.js に色が無い`);
  return c;
};
const code = slug => {
  const c = meta(slug).code;
  if (!/^[A-Z0-9]{2,4}$/.test(c || '')) throw new Error(`${slug}: airlines-meta.js に略号が無い`);
  return c;
};
/* 社名は SALARY のいまの言葉の名前（日本語 ＝ ja・英語 ＝ en ── 英語の会社ページの社名と同じ字） */
const name = slug => SALARY[slug][LANG];

/* ── 会社ページと同じ読み口（年収の推定・家賃）── 先行5社は読み込んだときに1回・ほかの会社は career() の中で1回 ── */
const VIEW = Object.fromEntries(FIVE.map(s => [s, viewOf(s)]));
/* 英語の読み口（viewOf(…, 'en') ── 英語の会社ページと同じ字）。英語を書くときの career() の中でだけ作る（先行5社も）。 */
const VIEW_EN_OF = {};
const vw = s => (EN() ? VIEW_EN_OF : VIEW)[s];
/* 掲載している全社 ＝ 年収の正本（SALARY）の鍵。数も名前もここに打たない（P3.1）。比較とカードの材料は全社ぶん書く。 */
export const ALL = Object.keys(SALARY);
/* 先行5社のほかの会社の読み口と決まり（色・略号・会社ページ・目盛）は、比較とカードを組むとき（build() と cardData() の頭）に1回だけ。
   ⚠️ ファイルの地の文で全社ぶんを走らせない ── このファイルは gen-airline-glance.mjs（会社ページの生成器）からも読まれる。
      1社の台帳の誤りで、全部の会社ページの生成まで止めない。
   ★英語（EN-9）：言葉ごとに1回（英語の読み口の英語の対が欠けていても、日本語の career.html の生成は止めない）。 */
const WIDE = { ja: false, en: false };
function career() {
  if (WIDE[LANG]) return;
  const V = EN() ? VIEW_EN_OF : VIEW;
  for (const s of ALL) {
    color(s); code(s);   // airlines-meta.js に行が無い・色や略号の形が違う会社が在れば、ここで止まる（色も略号も作らない）
    if (!fs.existsSync(path.join(ROOT, EN() ? 'en' : '', 'airlines', `${s}.html`))) throw new Error(`${s}: 会社ページが無い${EN() ? '（英語）' : ''}`);
    if (!V[s]) V[s] = viewOf(s, LANG);
    for (const [r] of ROLES) width(cell(s, r).man, scaleOf(s));   // 推定がその会社の目盛からはみ出すなら、ここで止まる
  }
  WIDE[LANG] = true;
}
/* 航空会社一覧と同じ並び・同じ地域（航空会社一覧の model()）。
   ⚠️ model() を呼ぶのはこの dir() の中だけ。ファイルの地の文で呼ばない ── このファイルは gen-airline-glance.mjs からも読まれる。
   一覧の決まりで止まるのは、比較を組むとき（build()）とカードを組むとき（cardData()）だけにする。 */
let DIR = null;
const dir = () => {
  if (DIR) return DIR;
  const M = model();
  if ([...M.slugs].sort().join() !== [...ALL].sort().join()) throw new Error('航空会社一覧の会社が、年収の正本（SALARY）と違う');
  for (const s of ALL) if (M.airlines[s].color !== color(s) || M.airlines[s].code !== code(s)) throw new Error(`${s}: 色か略号が、航空会社一覧と違う`);
  return (DIR = M);
};
export const listed = () => dir().slugs;
/* 比較とカードが出せる会社（gen-airline-glance.mjs の「他社と比較」「カードを保存」がこれを読む ── CA-4）。 */
export const CMP = ALL;

/* ── 棒に出す1マス ─────────────────────────────────────────────── */
/* 主表示の1マス ＝ 推定年収。5社とも・どの職位も同じ決め方（会社ページと同じ読み口）。
   ⚠️ 会社が公表した額をここへ入れない（置き場は pub() の一覧だけ）。「確認中」を返さない。 */
export function cell(slug, rank) {
  const e = vw(slug)?.pay?.[rank]?.est;
  if (!e || !(e.man > 0)) throw new Error(`${slug}/${rank}: 推定年収が無い（pv-airline-view.mjs）`);
  if (e.man !== SALARY[slug]?.[rank]?.avg) throw new Error(`${slug}/${rank}: 推定が SALARY の avg と違う`);
  if (e.yen !== yen(e.man)) throw new Error(`${slug}/${rank}: 推定の字が標準の円表記ではない ──「${e.yen}」`);
  /* kind は金額の種類の鍵（salary-basis.mjs の TIERS）。比較の板は、並べた行がどれも推定なら「推定年収」を見出しに1回だけ言う
     （行の札は読み上げにだけ残す）── 別の種類の行には、行の札を見せる（row() の data-kind ・career.css）。
     札の字は TIERS のいまの言葉（英語 ＝ 'Estimated'）。額の字は どちらの言葉も「¥…万」（英語は書いたあとでドルの span に焼く）。 */
  return { man: e.man, text: e.yen, tag: TIERS.estimate[LANG], kind: 'estimate', sub: '', look: '' };
}

/* 目盛の右端（★2026-10-24 オーナー P12.104「年収はもっと高い人もいるだろうからMAX7000万はおかしい」）。決まった上限は持たない。
   決め方は会社ページと同じ1か所（pv-airline-view.mjs の scaleOf / scaleTop）── 画面に描く額のいちばん大きいもの（推定・その幅の上の額・
   会社が公表している額）を、次の 1,000万 の刻みへ切り上げる。
     1社の画面（概要・詳細・エティハドのタブ）… その会社の目盛（会社ページと同じ右端）。
     比較 … 並べた2社で1本（2社の目盛の大きいほう ── 2社は必ず同じ目盛）。HTML は既定の2社（PAIR）の目盛で描いておき、
            選び直したら career.js が、行の額（data-man）と会社の目盛（data-scale）から長さを決め直す（額をスクリプトに持たない）。
            目盛の字は、ありうる右端（全社の scaleOf）ごとに1本ずつ比較の板に置き、career.js は見せる1本を選ぶだけ
            （字は HTML に在る ＝ 通貨切替がそのまま読める・カードもここから読む）。
   ⚠️ 全社で1本の目盛に戻さない（幅の上の額がはみ出す・会社を足すと全部の目盛が動く）。はみ出しは width() が止める。 */
const pairScale = (a, b) => scaleTop([scaleOf(a), scaleOf(b)]);
for (const s of FIVE) for (const [r] of ROLES) width(cell(s, r).man, scaleOf(s));

/* 棒の長さは width()（目盛 top に対する％。会社ページと同じ関数）。data-man は額（万円 ── 比較を選び直したとき・カードを描くときに、
   並べた2社の目盛で長さを決め直すため）。mark は目印（概要の中だけ）。 */
const fill = (c, top, extra, mark) => `<i class="cr-fill${extra ? ' ' + extra : ''}"${mark ? ` data-main-bar="${mark}"` : ''} data-man="${c.man}" style="--w:${width(c.man, top)}"></i>`;
/* 札（「推定」）。 */
const kline = (c, mark) => `<span class="cr-tag"${mark ? ` data-main-tag="${mark}"` : ''}>${esc(c.tag)}</span>`;

/* 目盛の字（0・まんなか・右端）。比較の板では右端ごとに1本ずつ置く（attrs ＝ data-scale・data-div・hidden）。 */
const axis = (top, attrs = '') => `<div class="cr-axis"${attrs} aria-hidden="true"><span>0</span><span>${yen(top / 2)}</span><span>${yen(top)}</span></div>`;
/* 比較の板の目盛の写し（★2026-10-25 オーナー P12.110「スマホの画面も比較の年収のカードデカすぎるだろ」── WP-compare-all-11）。スマホでは
   年収の板が上の2枚の札と同じ2列（左の会社｜右の会社）になり、棒も列ごとに並ぶ ── 右の列の棒の下にも、同じ目盛の字を置く。
   右端ごとの1本（.cr-axis）のすぐ後ろに1つずつ。見せるかどうかは career.css が決める（すぐ前の1本が見えているときだけ・スマホだけ）。
   ⚠️ .cr-axis の中に字を足さない・同じ class にしない（保存するカード career-card.js が .cr-axis の子を全部読む・目盛の検査が1本ずつ数える）。 */
const axisCopy = top => `<div class="cr-axis2" aria-hidden="true"><span>0</span><span>${yen(top / 2)}</span><span>${yen(top)}</span></div>`;
/* 色の近い2社（★同じ P12.110 ── 色の近い2社は、色のほかでも見分けられる）：会社の色（airlines-meta.js）を OKLab に直し、2社の距離が NEAR より
   小さいときだけ、右の会社の点・棒・札の色の線に色のほかの手がかりを付ける（決めるのは career.js・見た目は career.css）。組み合わせの一覧は持たない。
   OKLab の座標は、ここで作って比較の行（機長の行）の data-lab に書く（L・a・b を 100 倍して丸めた整数 ── career.js は数の式を持たず、2社の
   座標の差を測るだけ）。NEAR も同じ 100 倍の目盛（比較の画面の data-near-max）。10 ＝ 赤どうし（エミレーツ｜JAL 約3・スイス｜TAP 約8）は入り、
   赤と青（JAL｜ユナイテッド 約34）は入らない。 */
export const NEAR = 10;
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export function labOf(slug) {
  const h = color(slug), [r, g, b] = [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]
    .map(x => Math.round(x * 100) || 0);
}
/* 目盛の刻みの数（.cr-track の線 ＝ 1,000万ごと）。画面の囲み（section）の style に置く。 */
const div = top => `--cr-div:${top / SCALE_STEP}`;

/* 概要の1マス（大きい数字）。社名は画面では隠してある（読み上げと check-salary.mjs のため）。 */
function num(slug, rank, label) {
  const c = cell(slug, rank);
  return `<div class="cr-num" data-role="${rank}"><span class="cr-vh">${esc(name(slug))}</span><span class="cr-num-r">${label}</span><b class="cr-num-v" data-main="${rank}">${esc(c.text)}</b><span class="cr-num-k">${kline(c, rank)}</span></div>`;
}

/* 概要の小さい棒。数字は上の2マスが持っているので、ここは形だけ（読み上げない）。 */
function mini(slug) {
  return `<div class="cr-mini" aria-hidden="true">
${ROLES.map(([r]) => `<div class="cr-mini-row"><span class="cr-mini-l">${W.rank[r]}</span><span class="cr-track">${fill(cell(slug, r), scaleOf(slug), 'is-' + r, r)}</span></div>`).join('\n')}
${axis(scaleOf(slug))}
</div>`;
}

/* ── 写真 ───────────────────────────────────────────────────────── */
function img(p, alt, sizes, eager) {
  return `<img src="${UP}${photoSrc(p)}" srcset="${UP}${photoSrc(p, true)} ${SMALL_W}w, ${UP}${photoSrc(p)} ${p.w}w" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(alt)}"${eager ? '' : ' loading="lazy"'} decoding="async"/>`;
}
const shot = slug => {
  const p = primary(slug);
  if (!p) throw new Error(`${slug}: airline-photos.mjs に写真が無い`);
  return p;
};
const photo = (slug, sizes, eager) => img(shot(slug), W.photoAlt(name(slug), shot(slug).aircraft), sizes, eager);
/* 写真の手直しの断り（「縮小・トリミング」）。英語は写真の台帳の英語（place-photos.mjs の changesEn ── 会社ページの写真と同じ字） */
const chg = p => {
  if (!EN()) return p.changes;
  const e = p.changes ? changesEn(p) : '';
  if (p.changes && !e) throw new Error(`英語の比較のページ：写真の手直しの断りの英語が無い ── ${p.changes}`);
  return e;
};
const badge = slug => `<span class="cr-code">${esc(code(slug))}</span>`;

/* 入口のいちばん上の1枚。各社の1枚目とは別の写真を使う（同じ写真が2回出ない）。 */
const LEAD_SLUG = 'etihad';
const LEAD = (PHOTOS[LEAD_SLUG] || []).find(p => p.file === 'etihad-b787');
if (!LEAD) throw new Error('airline-photos.mjs に入口の写真（etihad-b787）が無い');

/* 作者名とライセンス名を示すことが使う条件の写真にだけ出す。
   items = [[slug, 写真], …]。withName のときは社名を頭に付ける
   （同じ社の写真が2枚あるときだけ、機種も添えて見分けられるようにする）。 */
function credits(items, withName, shown) {
  /* 加工の中身が全部同じなら、頭で1回だけ言う（1枚ごとに繰り返さない）。 */
  const need = items.filter(([, p]) => needsCredit(p));
  const one = need.length && need.every(([, p]) => p.changes === need[0][1].changes) ? need[0][1] : null;
  const same = one ? one.changes : '';
  const list = need.map(([slug, p]) => {
    const twice = items.filter(([s]) => s === slug).length > 1;
    const label = withName ? `${esc(name(slug))}${twice ? ' ' + esc(p.aircraft) : ''} ` : '';
    const hide = shown && !shown.includes(slug) ? ' hidden' : '';
    return `<span class="cr-credit" data-airline="${slug}"${hide}>${label}<a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.author)}</a>${W.slash}<a href="${esc(p.licence_url)}" target="_blank" rel="noopener">${esc(p.licence)}</a>${same ? '' : W.paren(esc(chg(p)))}</span>`;
  });
  const c = same ? esc(chg(one)) : '';
  /* ★2026-10-26 段階5 compare-all-14（P12.122）：比較の段（shown が在る ── 全社ぶんを置き、並べた2社のぶんだけ見せる）の頭の字は、
     見えているクレジットの数で言う（英語の Photo / Photos）。2つの字を置き、見せるのは1つ（選び直したら career.js の pair() が選ぶ ──
     字は作らない）。日本語は同じ字が2つ（日英で骨組みをそろえる）。 */
  const k = shown ? need.filter(([s]) => shown.includes(s)).length : list.length;
  const top = shown ? [1, 2].map(n => `<span data-n="${n}"${(n === 1) === (k === 1) ? '' : ' hidden'}>${W.photos(c, n)}</span>`).join('') : W.photos(c, list.length);
  return list.length ? `<p class="cr-credits">${top} ${list.join(' ')}</p>` : '';
}

/* ── 住所と記号 ─────────────────────────────────────────────────── */
/* 会社ページが持っているタブ（生成済みのページから読む ── タブの名前をここに打たない）。今までの形のページは空。 */
/* 英語は英語の会社ページ（en/airlines/{slug}.html ── 比較の「Details」の行き先そのもの）から読む。 */
const PAGE_TABS = {};
const pageTabs = s => (PAGE_TABS[`${LANG}:${s}`] ||= new Set([...fs.readFileSync(path.join(ROOT, EN() ? 'en' : '', 'airlines', `${s}.html`), 'utf8').matchAll(/ data-pvg-tab="([a-z]+)"/g)].map(m => m[1])));
const href = {
  home: PAGE,
  airline: s => `${PAGE}?airline=${s}`,
  tab: (s, t) => `${PAGE}?airline=${s}` + (t === TABS[0][0] ? '' : `&amp;tab=${t}`),
  stay: (s, iata) => `${PAGE}?airline=${s}&amp;stay=${iata}`,
  detail: (s, d) => `${PAGE}?airline=${s}&amp;d=${d}`,
  compare: (a, b) => `${PAGE}?view=compare` + (a ? `&amp;a=${a}&amp;b=${b}` : ''),
  card: (a, b) => `${PAGE}?view=card&amp;a=${a}` + (b ? `&amp;b=${b}` : ''),
  /* いま改良している会社ページ（airlines/{slug}.html）と、そのタブ（# は pv-glance.js が読む名前）。
     # を付けるのは、そのページがそのタブを持っているときだけ（今までの形のページは、ページの頭を開く）。
     タブを持つページに頼んだタブが無ければ、ここで止まる（「詳しく」の先が無くなるのを、検査より先に生成で止める）。 */
  page: (s, tab) => {
    const has = pageTabs(s);
    if (!tab || !has.size) return `airlines/${s}.html`;
    if (!has.has(tab)) throw new Error(`${s}: 会社ページに「${tab}」のタブが無い（比較の「詳しく」の先が無くなる）`);
    return `airlines/${s}.html#${tab}`;
  },
};
const ic = d => `<svg class="cr-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const IC = { back: ic('M15 6l-6 6 6 6'), go: ic('M5 12h14M13 6l6 6-6 6'), down: ic('M6 9l6 6 6-6'), swap: ic('M7 8h11l-3-3M17 16H6l3 3'), next: ic('M9 6l6 6-6 6'), x: ic('M6 6l12 12M18 6L6 18') };
const back = () => `<a class="cr-back" href="${href.home}" data-go>${IC.back}${W.back}</a>`;
/* 比較の節の下に置く、会社ごとの入口（その会社のページの該当タブへ）。掲載している全社ぶん置いて、選ばれた2社だけ見せる（career.js の pair()）。
   読み上げの名前は「節の見出し ＋ 社名 ＋ 詳しく」（aria-labelledby。字は足さない）。
   ⚠️ data-go を付けない（career.html の外へ出る）。額・職位の字をこの中に書かない（check-salary.mjs の並びを崩さない）。 */
/* 「詳しく」「ほかの街」の字は WORDS（go・moreTowns）。 */
/* ★2026-10-25 オーナー P12.106（WP-compare-all-10）：年収の板の足だけは、会社ごとに1行 ── 社名・税の扱い・「詳しく」。
   tax（会社 → 税の扱いの字）を渡すと、会社ごとの「詳しく」を1つの入れ物（.cr-ft ── career.js の「選んだ2社だけ見せる」の一覧の .cr-go）に
   包み、税の扱いの字（.cr-tx）を「詳しく」の外に添える（リンクの読み上げの名前に字を足さない）。税の字の頭には社名を読み上げにだけ置く。
   税の扱いを持たない会社は「詳しく」だけ。字は会社ページと同じ（viewOf().pay.tax）。 */
const gos = (tab, key, tax) => `<p class="cr-gos">
${ALL.map(s => {
  const hide = PAIR.includes(s) ? '' : ' hidden';
  const a = `<a class="cr-link cr-go" id="cr-go-${key}-${s}" href="${href.page(s, tab)}" aria-labelledby="cr-cmp-h-${key} cr-go-${key}-${s}" data-airline="${s}" style="--cr-co:${color(s)}"${hide}><i class="cr-dot" aria-hidden="true"></i><span class="cr-go-n">${esc(name(s))}</span><span class="cr-go-t">${W.go}</span>${IC.go}</a>`;
  if (!tax) return a;
  const t = tax(s);
  /* ★2026-10-25 WP-compare-all-12：2列の板（〜999px）では税の扱いの字を2行で切る（career.css）── 字は削らず、同じ字を入れ物の title にも置く
     （税の字は押した手をリンクへ通すので、乗せたときに出るのは入れ物の title）。 */
  return `<span class="cr-go cr-ft" data-airline="${s}"${t ? ` title="${esc(t)}"` : ''}${hide}>${a}${t ? `<span class="cr-tx"><span class="cr-vh">${esc(name(s))}</span>${esc(t)}</span>` : ''}</span>`;
}).join('\n')}
</p>`;

/* 生きた欄。空で出荷する（career-live.js / career-stay.js がサーバーの答えで埋める）。
   attrs は data- の名前と値。値はここで書く英数字だけ（鍵・コード）。 */
const live = (kind, attrs = {}) => `<div class="crl" data-live="${kind}"${Object.entries(attrs).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')} data-state="idle"><span class="crl-ph">—</span></div>`;
/* 中身を次に入れる箱（公表されている待遇・拠点の街）。 */
const box = id => `<div class="cr-box" data-box="${id}"><span class="cr-ph">—</span></div>`;

/* ── 会社が公表している金額（機長・副操縦士の公表額が在る会社だけ）─────────────
   ★推定とは別の情報。1つの額ごとに 誰の額か（内訳の名前）・何の額か（種類）・額・出どころ を出す。
   ★ここに棒を描かない・目盛に載せない（推定の棒と同じ物差しで比べる額ではない）。
   ★上限（max_…）は「〜」・斜線の印・「上限」の字の3つが必ず一緒に出る。 */
function pubGroups(slug) {
  const out = [];
  for (const rank of PUB_RANKS) {
    const R = BASIS[slug]?.[rank];
    for (const g of R?.groups || []) {
      const figs = figures(slug, rank).filter(f => !f.training && f.group === g.name);
      if (figs.length) out.push({ tier: R.tier, g, figs });
    }
  }
  return out;
}

/* 出どころの1行。英語は読み口（viewOf(…, 'en').pay.src ── 英語の会社ページと同じ発行元・題・時点）の同じ資料（url と元の題で引く）。 */
const srcRow = (slug, s) => {
  if (!EN()) return `<li>${esc(s.pub)} <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a><span>${W.srcAt(esc(s.as_of), esc(s.accessed))}</span></li>`;
  const e = (vw(slug).pay.src || []).find(x => x.url === s.url && x.ja === s.name);
  if (!e) throw new Error(`${slug}: 英語の読み口に出どころ「${s.name}」が無い（pv-airline-view.mjs の srcOf）`);
  return `<li>${esc(e.pub)} <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(e.name)}</a><span>${W.srcAt(esc(e.when), esc(dayEn(s.accessed)))}</span></li>`;
};
/* 額の頭と尻の言い添え（求人の上限 ＝ max・下限 ＝ over / from）。日本語の原貨の字（「〜AED 674,029」「USD 100,000 超」）と、英語の額の字はこれ。 */
const upKey = key => (/^max_/.test(key) ? 'max' : /_over$/.test(key) ? 'over' : /_from$/.test(key) ? 'from' : '');

/* tag は見出しの段（概要では h2・比較では社名の下なので h3）。 */
function pub(slug, tag) {
  const B = BASIS[slug] || {};
  const groups = pubGroups(slug);
  /* 機長・副操縦士の公表額が1つも無い会社は、この一覧そのものを出さない（見出しも「公表なし」の行も・前提や出どころも）
     ★2026-10-21 リード P12.91-7（rollout.build.txt の d1／d2 への LATE NOTE）：JAL・ANA は運航乗務員の平均を外したあと公表額が無い。
     （台帳に残っているのは訓練生の募集の話で、ここに並べる額の説明ではない）。 */
  if (!groups.length) return '';

  const blocks = groups.map(({ tier, g, figs }) => {
    const rows = figs.map(f => {
      const up = upTo(f.key);
      if (up && !f.kind.includes('上限')) throw new Error(`${slug}: 上限なのに種類の名前に「上限」の字が無い ──「${f.kind}」`);
      if (!up && /上限/.test(f.kind)) throw new Error(`${slug}: 「上限」と名乗る額に「〜」が付かない ──「${f.kind}」`);
      /* ★英語：上限の3つ ＝「up to」・斜線の印・種類の名前の「maximum」（英語の会社ページと同じ字 ── 平の額に見せない） */
      const kind = EN() ? f.kind_en : f.kind;
      if (EN() && !!up !== /\bmaximum\b/.test(kind || '')) throw new Error(`${slug}: 英語の種類の名前「${kind}」と上限の印が合わない`);
      const hatch = up ? '<i class="cr-hatch" aria-hidden="true"></i>' : '';
      const k = upKey(f.key), amt = `${f.cur} ${f.amount.toLocaleString('en-US')}`;
      const orig = f.cur === 'JPY' ? '' : ` <span class="cr-orig pv-no-cur">${k ? W.up[k](amt) : amt}</span>`;
      const val = EN() ? (k ? W.up[k](yen(f.man)) : yen(f.man)) : up + f.text + openEnd(f.key);
      return `<div class="cr-fig${up ? ' is-max' : ''}"><dt>${hatch}${esc(kind)}</dt><dd><b>${esc(val)}</b>${orig}</dd></div>`;
    }).join('\n');
    const gName = EN() ? g.name_en || enOf(g.name, `${slug} の区分`) : g.name;
    const leave = g.leave ? `\n<p class="cr-leave">${esc(EN() ? g.leave_en || enOf(g.leave, `${slug} の休暇`) : g.leave)}</p>` : '';
    const req = g.req ? `\n<details class="cr-more"><summary>${W.req}</summary><p>${esc(EN() ? g.req_en || enOf(g.req, `${slug} の応募条件`) : g.req)}</p></details>` : '';
    return `<div class="cr-grp">
<p class="cr-grp-k"><span class="cr-tag">${esc(TIERS[tier][LANG])}</span> ${esc(gName)}</p>
<dl class="cr-figs">
${rows}
</dl>${leave}${req}
</div>`;
  }).join('\n');

  /* 英語の注は台帳の英語の対（notes_en・同じ並び）。外す注は日本語の字で決める（決め方は1つ） */
  if (EN() && (B.notes_en || []).length !== (B.notes || []).length) throw new Error(`${slug}: 年収の注の英語（notes_en）の数が日本語と違う`);
  const notes = (B.notes || []).map((n, i) => [n, i]).filter(([n]) => !/訓練生|採用予定/.test(n)).map(([n, i]) => (EN() ? B.notes_en[i] : n));
  /* secondary＝会社の公表ではない資料（報道など・推定の根拠）。「会社が公表している金額」の出どころではない。 */
  const srcs = (B.src || []).filter(s => !s.secondary && !/訓練生|自社養成/.test(s.name));
  const fx = B.cur && B.cur !== 'JPY' ? `\n<p class="cr-fx pv-no-cur">${esc(fxNote(B.cur, LANG))}</p>` : '';
  const noteHtml = notes.length ? `\n<ul class="cr-notes">\n${notes.map(n => `<li>${esc(n)}</li>`).join('\n')}\n</ul>` : '';
  const srcHtml = srcs.length ? `\n<ul class="cr-srcs pv-no-cur">\n${srcs.map(s => srcRow(slug, s)).join('\n')}\n</ul>` : '';
  const basis = noteHtml || fx || srcHtml
    ? `\n<details class="cr-more cr-basis"><summary>${W.basis}</summary>${noteHtml}${fx}${srcHtml}\n</details>` : '';

  return `<div class="cr-pub">
<${tag} class="cr-h2">${W.pubH}</${tag}>
${blocks}${basis}
</div>`;
}

/* ── 推定年収の説明 ─────────────────────────────────────────────
   ★台帳に根拠が記録してある職位（est.backed）だけ 根拠・算出方法・時点 を出す。
     無い職位は EST_PLAIN の1行だけ ── 根拠・幅・件数・時点をここで作らない。
   ★推定は機種ごとの額ではない（対象は「機種の指定なし」）。 */
export const EST_PLAIN = '当サイトの推定（公開情報からの推計）。根拠の資料はまだ記録していません。';
export const EST_TARGET = '機種の指定なし';
if (WORDS.ja.estPlain !== EST_PLAIN || WORDS.ja.estTarget !== EST_TARGET || WORDS.ja.est !== KINDS[0][1]) throw new Error('gen-career.mjs の WORDS.ja が EST_PLAIN・EST_TARGET・KINDS と違う');
for (const [r, l] of ROLES) if (WORDS.ja.rank[r] !== l) throw new Error(`gen-career.mjs の WORDS.ja.rank.${r} が ROLES と違う`);
for (const [t, l] of TABS) if (WORDS.ja.tabs[t] !== l) throw new Error(`gen-career.mjs の WORDS.ja.tabs.${t} が TABS と違う`);
function estRows(slug, rank) {
  const e = vw(slug).pay[rank].est;
  if (!e.backed) return [[W.estL, esc(W.estPlain)]];
  for (const k of ['basis', 'method', 'asOf']) if (!e[k]) throw new Error(`${slug}/${rank}: 根拠つきの推定なのに ${k} が空（pv-airline-view.mjs）`);
  return [[W.basisL, esc(e.basis)], [W.methodL, esc(e.method)], [W.asOfL, esc(e.asOf)]];
}
const facts = rows => `<dl class="cr-facts">
${rows.map(([k, v]) => `<div class="cr-fact"><dt>${k}</dt><dd>${v}</dd></div>`).join('\n')}
</dl>`;
/* 概要の中の折り畳み（詳細の画面を持たない会社）。職位ごとに1かたまり。 */
function estNote(slug) {
  return `<details class="cr-more cr-est">
<summary>${W.estAbout}</summary>
${ROLES.map(([r]) => `<p class="cr-est-r">${W.rank[r]}<span>${W.estTarget}</span></p>
${facts(estRows(slug, r))}`).join('\n')}
</details>`;
}

/* ── 入口 ───────────────────────────────────────────────────────── */
function home() {
  const tiles = FIVE.map(s => `<a class="cr-tile" href="${href.airline(s)}" data-go style="--cr-co:${color(s)}">
<span class="cr-tile-p">${photo(s, '(min-width: 760px) 330px, 46vw', true)}${badge(s)}</span>
<span class="cr-tile-n">${esc(name(s))}</span>
</a>`).join('\n');
  return `<section class="cr-view cr-home" data-view="home">
<div class="cr-lead">
${img(LEAD, W.photoAlt(name(LEAD_SLUG), LEAD.aircraft), '(min-width: 1100px) 1040px, 100vw', true)}
<h1 class="cr-h1" tabindex="-1">${W.h1}</h1>
</div>
<div class="cr-tiles">
${tiles}
<a class="cr-tile cr-tile-cmp" href="${href.compare()}" data-go>
<span class="cr-tile-g" aria-hidden="true"><i></i><i></i></span>
<span class="cr-tile-n">${W.cmpAll}${IC.go}</span>
</a>
</div>
<p class="cr-else"><a class="cr-link" href="world-airlines.html">${W.others}${IC.go}</a></p>
${credits([[LEAD_SLUG, LEAD], ...FIVE.map(s => [s, shot(s)])], true)}
</section>`;
}

/* 「他社と比較」は、この会社を1社目に置いて開く。相手は既定の2社のうち、この会社でないほう。 */
const rival = slug => (slug === PAIR[0] ? PAIR[1] : PAIR[0]);

/* ── 概要（段1の4社） ───────────────────────────────────────────── */
function overview(slug) {
  if (DEEP.includes(slug)) return deep(slug);
  return `<section class="cr-view cr-co" data-view="airline" data-airline="${slug}" style="--cr-co:${color(slug)};${div(scaleOf(slug))}" hidden>
<div class="cr-top">
${back()}
<a class="cr-btn" href="${href.compare(slug, rival(slug))}" data-go>${W.cmp}</a>
</div>
<div class="cr-cols">
<figure class="cr-hero">
${photo(slug, '(min-width: 900px) 500px, 100vw', false)}
${badge(slug)}
<h1 class="cr-h1 cr-hero-n" tabindex="-1">${esc(name(slug))}</h1>
</figure>
<div class="cr-pay">
<h2 class="cr-pay-h">${W.pay}</h2>
<div class="cr-nums">
${ROLES.map(([r]) => num(slug, r, W.rank[r])).join('\n')}
</div>
${mini(slug)}
<p class="cr-tax">${esc(vw(slug).pay.tax)}</p>
${estNote(slug)}
</div>
</div>
${pub(slug, 'h2')}
<p class="cr-else"><a class="cr-link" href="airlines/${slug}.html">${W.revJobs}${IC.go}</a></p>
${credits([[slug, shot(slug)]], false)}
</section>`;
}

/* ── 概要（DEEP の会社）── 写真 → タブ → パネル ───────────────── */
/* 額と棒の1行（推定年収）。行ぜんたいが、その数字自身の詳細への入口（数字も棒も同じ先へ行く）。 */
function bar(slug, rank, label) {
  const c = cell(slug, rank);
  return `<a class="cr-bar cr-bar-est" data-role="${rank}" href="${href.detail(slug, `${rank}-est`)}" data-go>
<span class="cr-bar-h"><span class="cr-vh">${esc(name(slug))}</span><span class="cr-bar-r">${label}</span><b class="cr-bar-v" data-main="${rank}">${esc(c.text)}</b><span class="cr-bar-k">${kline(c, rank)}</span>${IC.next}</span>
<span class="cr-track" aria-hidden="true">${fill(c, scaleOf(slug), '', rank)}</span>
</a>`;
}

/* 話題ごとのカード（勤務・待遇）。答えの欄（生きた欄）と、その質問へ直接行く入口。
   ★質問の鍵をここに書き写さない。待遇アンケートの質問の一覧（pv-conditions.mjs）から、鍵の頭で拾う
     ── 質問が分かれたり名前が変わったりしても、入口の先が無くなることがない
     （2026-10-04、タクシーとクルーバスを別々の質問に分けた回に、書き写した鍵が3つ消えて生成が止まった）。
   入口の字は「何を答えるか」を名指しする短い名前（ASK）。無い鍵は、質問の文そのものを出す。 */
/* ★拾うのは質問が持つ話題の印（pv-conditions.mjs の topic）。鍵の頭では拾わない
     ── 2026-10-04 に足した4問（タクシー代の上限・機長昇格の条件3問）は鍵の頭が話題とそろっていないものがあり、
        頭で拾うと「機長昇格」に年数の1問しか出ない。印で拾えば、質問を足した側の1か所で決まる。 */
const TOPIC_DEFS = [
  ['taxi', '通勤タクシー・クルーバス', 'taxi'],
  ['staff-travel', '社員向け航空券', 'staff_travel'],
  ['upgrade', '機長昇格', 'upgrade'],
];
const ASK = {
  commuting_transport: '会社が用意・負担するか',
  commuting_transport_method: '提供の形',
  commuting_taxi_when: 'タクシーを使えるとき',
  commuting_taxi_where: 'タクシーを使える範囲',
  commuting_taxi_cost: 'タクシーの費用負担',
  commuting_bus_when: 'クルーバスを使えるとき',
  commuting_bus_cost: 'クルーバスの費用負担',
  staff_travel: '制度の有無',
  staff_travel_booking: '空席待ちか、確保できるか',
  staff_travel_cabin: '上位クラス',
  staff_travel_family: '家族が使えるか',
  staff_travel_standby_trips: '空席待ちの券の年間回数',
  staff_travel_standby_cost: '空席待ちの券の本人負担',
  staff_travel_standby_family: '空席待ちの券を使える人',
  staff_travel_confirmed_trips: '確保できる券の年間回数',
  staff_travel_confirmed_cost: '確保できる券の本人負担',
  staff_travel_confirmed_family: '確保できる券を使える人',
  commuting_taxi_cap: 'タクシー代の上限',
  upgrade_years: '機長昇格までの年数',
  upgrade_order: '昇格の順番の決まり方',
  upgrade_min_hours: '昇格に必要な総飛行時間',
  upgrade_min_tenure: '昇格に必要な在籍年数',
};
/* 質問が「情報を追加」の面のどの話題に入るか。pv-contrib.js の groupOfQ / usable と同じ決め方
   （2つで対。食い違うと、入口を押しても別の話題が開く ＝ assert-contrib.mjs が突き合わせる）。
   面で答えられない質問は '' ＝ 今までどおり質問の画面へ。 */
const ASK_TOPICS = ['taxi', 'staff_travel', 'upgrade'];
export function askGroup(id) {
  const q = QUESTIONS.find(x => x.id === id);
  if (!q || q.retired || !q.ja || !q.ja.label) return '';
  const ok = (q.kind === 'choice' || q.kind === 'multi') ? Array.isArray(q.choices) && q.choices.length > 0 : (q.kind === 'num' && !!q.num);
  if (!ok) return '';
  return ASK_TOPICS.includes(q.topic) ? q.topic : q.section === 'roster' ? 'roster' : q.section === 'career' ? 'career' : 'benefits';
}
/* 比較の「回答」の欄が並べる質問。正本は質問の台帳（pv-conditions.mjs の QUESTIONS）── ここに鍵を打たない。
   どの欄に入るかは、その回答が会社ページのどのタブに出るか：
     work ＝ 勤務・訓練（勤務スケジュール・キャリアの質問と、通勤・Staff Travel の話題）／pay ＝ 給与・待遇（それ以外）。
   並びは会社ページの面の順（勤務予定 → 通勤 → Staff Travel → 昇格・訓練）、その中は台帳の順。
   額の質問（通貨つき）は入れない ── 会社ページの箱と同じ決まり（gen-airline-glance.mjs の factKeys。箱は通貨なしで数字だけを出す）。
   ⚠️ 会社ページの面を移したら、ここも直す（どの質問がどのタブに出るかは、会社ページの生成器 gen-airline-glance.mjs が決めている）。 */
const WORK_TOPICS = ['taxi', 'staff_travel'];
export function tabOfKey(id) {
  const q = QUESTIONS.find(x => x.id === id);
  if (!q || q.retired || q.currency) return '';
  return (q.section === 'roster' || q.section === 'career' || WORK_TOPICS.includes(q.topic)) ? 'work' : 'pay';
}
export const CMP_KEYS = (() => {
  const surf = q => (q.section === 'roster' ? 0 : q.topic === 'taxi' ? 1 : q.topic === 'staff_travel' ? 2 : q.section === 'career' ? 3 : 4);
  const ids = QUESTIONS.filter(q => !q.retired && !q.currency).map((q, i) => [q, i])
    .sort((a, b) => surf(a[0]) - surf(b[0]) || a[1] - b[1]).map(x => x[0].id);
  const out = { work: ids.filter(id => tabOfKey(id) === 'work'), pay: ids.filter(id => tabOfKey(id) === 'pay') };
  if (!out.work.length || !out.pay.length) throw new Error('比較の回答の欄に並べる質問が無い（pv-conditions.mjs）');
  if (QUESTIONS.some(q => q.currency && (out.work.includes(q.id) || out.pay.includes(q.id)))) throw new Error('比較の回答の欄に、額の質問（通貨つき）は入れられない');
  if (ids.length > 120) throw new Error('比較が1回で聞く質問が 120 を超えた（pv_contrib_facts が受け取る上限）');
  return out;
})();
export const TOPICS = TOPIC_DEFS.map(([id, title, tp]) => {
  const asks = QUESTIONS.filter(q => q.topic === tp && !q.retired).map(q => [q.id, ASK[q.id] || q.ja.label]);
  if (!asks.length) throw new Error(`話題 ${id}: 待遇アンケートに質問が1つも無い（pv-conditions.mjs。入口の先が無くなる）`);
  return [id, title, asks];
});

/* 質問の入口。会社ページの「情報を追加」の面を、その質問の前で開く（ログインなしで答えられる）。
   会社ページを持たない会社・面で答えられない質問は、今までどおり質問の画面へ。 */
const askHref = (slug, key) => (FIVE.includes(slug) && askGroup(key)
  ? `airlines/${slug}.html?add=${askGroup(key)}&amp;aq=${key}`
  : `airline-conditions.html?airline=${slug}&amp;q=${key}`);
/* 英語の入口の字は、質問の台帳の英語（pv-conditions.mjs の en.label ── 英語の会社ページ・質問の画面と同じ字）。無ければ止める。 */
const askEn = id => {
  const q = QUESTIONS.find(x => x.id === id), t = q && q.en && q.en.label;
  if (!t) throw new Error(`英語の比較のページ：質問 ${id} に英語の名前（en.label）が無い（pv-conditions.mjs）`);
  return t;
};
function topic(slug, [id, title, asks]) {
  if (WORDS.ja.topic[id] !== title) throw new Error(`gen-career.mjs の WORDS.ja.topic.${id} が TOPIC_DEFS と違う`);
  return `<article class="cr-topic" data-topic="${id}">
<h2 class="cr-h2">${W.topic[id]}</h2>
${live('fact', { airline: slug, keys: asks.map(a => a[0]).join(',') })}
<p class="cr-asks-h">${W.asksH}</p>
<ul class="cr-asks">
${asks.map(([key, label]) => `<li><a class="cr-ask" href="${askHref(slug, key)}">${esc(EN() ? askEn(key) : label)}${IC.go}</a></li>`).join('\n')}
</ul>
</article>`;
}

/* 就航地（出どころつきの台帳）。「就航地」と呼ぶ ── 泊まるかどうかは台帳に無い。 */
function destinations(slug) {
  const list = FACTS[slug]?.destinations;
  if (!Array.isArray(list) || !list.length) throw new Error(`${slug}: career-facts.mjs に就航地が無い`);
  const seen = new Set();
  for (const d of list) {
    if (!/^[A-Z]{3}$/.test(d.iata || '') || !d.city_ja || !d.country_ja || !d.at || !d.src?.url || !d.src?.name) throw new Error(`${slug}: 就航地 ${d.iata} の形が違う（career-facts.mjs）`);
    if (seen.has(d.iata)) throw new Error(`${slug}: 就航地 ${d.iata} が2回ある（career-facts.mjs）`);
    seen.add(d.iata);
  }
  return list;
}
/* 就航地の都市と国の字。英語は台帳の英語の都市名（city_en ── 地図の検索にも使う）と、国の英語（台帳の英語の表 → 会社ページの就航地の国の字） */
const cityOf = d => {
  if (!EN()) return d.city_ja;
  if (!d.city_en) throw new Error(`就航地 ${d.iata} に英語の都市名が無い（career-facts.mjs）`);
  return d.city_en;
};
const countryOf = d => (EN() ? twin(CF_EN, d, 'country_ja') || placeCountryEn(d.iata) || enOf(d.country_ja, `就航地 ${d.iata} の国`) : d.country_ja);
/* 出どころは、同じもの（同じ資料・同じ時点）を1回だけ言う。 */
function destSources(slug) {
  const out = [];
  for (const d of destinations(slug)) {
    if (!out.some(x => x.url === d.src.url && x.at === d.at)) out.push({ url: d.src.url, name: d.src.name, at: d.at });
  }
  return `<ul class="cr-srcs pv-no-cur">
${out.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(EN() ? enOf(s.name, '就航地の出どころ') : s.name)}</a><span>${W.asOf(esc(atX(s.at)))}</span></li>`).join('\n')}
</ul>`;
}

/* ── 会社・募集・公表されている待遇・拠点の街（DEEP の会社）────────────
   ★字も数字も career-facts.mjs（出どころつきの台帳）から機械で出す。ここで作文しない・数字を打たない。
   ★条件（cond_ja）のある数字は、条件の文と必ず一緒に出す。「◯◯時点」に出すのは at（as_of ではない）。
   見た目は career-sec.css（.cr-org*・.cr-job*・.cr-ben*・.cr-town*・.cr-rent*・.cr-sv*）。 */
/* 英語：日付まで在る・半期（「4 October 2026」「H1 2026」）なら「as of …」（日本語の「…日 時点」「…期 時点」と同じ決まり） */
const when = at => { const t = atX(at); return t ? ((EN() ? /^\d+ [A-Z]|^H[12] / : /日$|期$/).test(t) ? W.asOf(t) : t) : ''; };
/* 出どころの一覧。同じ資料は1回だけ。extra は [資料の中身を言う字, 項目] の組（発表の日つきで出すもの）。 */
function srcList(items) {
  const out = [];
  for (const x of items) {
    if (!x?.src?.url || !x.src.name) throw new Error(`出どころの無い項目がある（career-facts.mjs）: ${x?.key}`);
    if (!out.some(o => o.url === x.src.url)) out.push({ url: x.src.url, name: x.src.name, at: x.at });
  }
  return `<ul class="cr-srcs pv-no-cur">
${out.map(o => `<li><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(EN() ? enOf(o.name, '出どころ') : o.name)}</a>${o.at ? `<span>${esc(when(o.at))}</span>` : ''}</li>`).join('\n')}
</ul>`;
}
/* 台帳の値の字。金額（cur つき）は元の通貨の記号を頭に付ける（valueText は通貨を出さない）。 */
const factValue = x => (x.cur && typeof x.value === 'number' ? `${x.cur} ${x.value.toLocaleString('en-US')}` : valX(x));

/* 会社（歴史と規模の短い紹介＋紹介文に出ていない数字の札）。 */
const ORG_NUMS = ['fleet_avg_age', 'network_destinations', 'pilots_joined_year', 'pilot_promotions_year'];
function org(slug) {
  const F = FACTS[slug];
  const intro = EN() ? introTextEn(slug) : introText(slug);
  if (!Array.isArray(intro) || !intro.length) throw new Error(`${slug}: career-facts.mjs に紹介文が無い`);
  if (intro.some(i => !i.text)) throw new Error(`${slug}: 紹介文の英語が台帳の項目で埋まらない（career-facts.mjs の EN）`);
  const used = new Set(intro.flatMap(i => i.uses));
  const all = [...F.profile, F.base, ...F.scale];
  const by = k => { const x = all.find(i => i.key === k); if (!x) throw new Error(`${slug}: 台帳に ${k} が無い`); return x; };
  /* 紹介文で言った数字を、札でもう一度言わない。 */
  for (const k of ORG_NUMS) if (used.has(k)) throw new Error(`${slug}: ${k} は紹介文に出ている（札に重ねない）`);
  const nums = ORG_NUMS.map(by);
  const owners = F.profile.filter(x => /^owner_/.test(x.key));
  return `<div class="cr-sec cr-org">
<h2 class="cr-h2">${W.org}</h2>
<p class="cr-org-p pv-no-cur">${intro.map(i => esc(i.text)).join(W.introJoin)}</p>
<ul class="cr-org-nums pv-no-cur">
${nums.map(x => `<li class="cr-org-num"><b>${esc(valX(x))}</b><span>${esc(fld(x, 'ja'))}</span><small>${[x.cond_ja ? fld(x, 'cond_ja') : '', when(x.at)].filter(Boolean).map(esc).join(W.sep)}</small></li>`).join('\n')}
</ul>
<details class="cr-more">
<summary>${W.fleet}</summary>
<ul class="cr-org-fleet pv-no-cur">
${F.fleet.map(x => `<li><span>${esc(fld(x, 'ja'))}</span><b>${esc(valX(x))}</b></li>`).join('\n')}
</ul>
<p>${esc(when(F.fleet[0].at))}</p>
</details>
<details class="cr-more">
<summary>${W.srcs}</summary>
${owners.length ? `<ul class="cr-notes pv-no-cur">
${owners.map(x => `<li>${W.kv(esc(fld(x, 'ja')), esc(valX(x)))}</li>`).join('\n')}
</ul>
` : ''}${srcList([...[...used].map(by), ...nums, ...F.fleet, ...owners])}
</details>
</div>`;
}

/* 募集（公開中を確かめた求人だけ。国籍の限定がある枠 jobs_restricted は並べない）。 */
function jobs(slug) {
  const list = FACTS[slug].jobs || [];
  if (!list.length) return '';
  for (const j of list) if (!/^https:\/\//.test(j.url || '') || !j.ja || !j.posted || !j.as_of) throw new Error(`${slug}: 求人 ${j.key} の形が違う（career-facts.mjs）`);
  return `<div class="cr-sec cr-jobs">
<h2 class="cr-h2">${W.jobs}</h2>
<ul class="cr-job-l">
${list.map(j => `<li><a class="cr-job" href="${esc(j.url)}" target="_blank" rel="noopener"><span class="cr-job-n">${esc(fld(j, 'ja'))}</span><span class="cr-job-m pv-no-cur">${W.posted(esc(fld(j, 'place_ja')), esc(atX(j.posted)))}</span>${IC.go}</a></li>`).join('\n')}
</ul>
<p class="cr-job-at pv-no-cur">${W.open(esc(atX(list[0].as_of)))}</p>
</div>`;
}

/* 公表されている待遇。教官の求人1件だけに書かれている額は、折り畳みの中に分ける（会社どうしの比較には使わない）。 */
function benefits(slug) {
  const list = FACTS[slug].benefits || [];
  const item = x => `<div class="cr-ben-i"><dt>${esc(fld(x, 'ja'))}</dt><dd><b class="pv-no-cur">${esc(factValue(x))}</b>${x.cond_ja ? `<small>${esc(fld(x, 'cond_ja'))}</small>` : ''}</dd></div>`;
  const main = list.filter(x => x.scope === 'all');
  const inst = list.filter(x => x.scope === 'instructor');
  if (main.length + inst.length !== list.length) throw new Error(`${slug}: 待遇に、出し場所の決まっていない区分がある（career-facts.mjs の scope）`);
  if (!main.length) return '';
  return `<div class="cr-sec cr-bens">
<h2 class="cr-h2">${W.bens}</h2>
<dl class="cr-ben">
${main.map(item).join('\n')}
</dl>
${inst.length ? `<details class="cr-more">
<summary>${W.inst}</summary>
<dl class="cr-ben">
${inst.map(item).join('\n')}
</dl>
</details>
` : ''}<details class="cr-more">
<summary>${W.srcs}</summary>
${srcList(list)}
</details>
</div>`;
}

/* 就航地・街の写真（place-photos.mjs）。示すことが条件の写真には、作者名とライセンス名を付ける。 */
function placeImg(p, sizes) {
  return `<img src="${UP}${placeSrc(p)}" srcset="${UP}${placeSrc(p, true)} ${PLACE_SMALL_W}w, ${UP}${placeSrc(p)} ${p.w}w" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(EN() ? subjectEn(p) || enOf(p.subject, '写真の説明') : p.subject)}" loading="lazy" decoding="async"/>`;
}
function placeCredits(items) {
  const need = items.filter(([, p]) => placeNeedsCredit(p));
  if (!need.length) return '';
  const same = need.every(([, p]) => p.changes === need[0][1].changes) ? need[0][1].changes : '';
  return `<p class="cr-credits">${W.photos(same ? esc(chg(need[0][1])) : '', need.length)} ${need.map(([label, p]) => `<span class="cr-credit">${label ? esc(label) + ' ' : ''}<a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.author)}</a>${W.slash}<a href="${esc(p.licence_url)}" target="_blank" rel="noopener">${esc(p.licence)}</a>${same ? '' : W.paren(esc(chg(p)))}</span>`).join(' ')}</p>`;
}

/* ── 家賃（1か月あたり）── 読み口は会社ページと同じ viewOf().living と rentCell() ──────────
   ★額は元の通貨が正本・円は比較用の換算。台帳が1年あたりの街は、読み口がもう12で割っている
     （その断りは台帳の per_month の1文。ここで割り算をしない）。
   ★街どうしを同じ目盛に並べない。棒も表も作らない ── 街ごとに 物差し（何の家賃か）・出どころ・時点 を付ける。 */
function living(slug) {
  const L = vw(slug).living;
  if (!L?.rents?.length) throw new Error(`${slug}: 家賃が台帳に無い（pv-airline-view.mjs）`);
  if (L.per !== 'month') throw new Error(`${slug}: 家賃が1か月あたりではない（${L.per}）`);
  if (!L.measure || !L.city) throw new Error(`${slug}: 家賃の物差し・街の名前が無い`);
  for (const r of L.rents) if (!r.name || (Object.keys(r.value).length && (!r.when || !r.src?.url || !r.src?.name))) throw new Error(`${slug}: 家賃 ${r.key} に名前・時点・出どころのどれかが無い`);
  return L;
}
/* 家賃の1マス。元の通貨（円の街は無い）と、円の額。 */
function rentRow(L, r, [k, l]) {
  const c = rentCell(L.cur, r.value[k], LANG);
  if (!c) return '';
  return `<div><dt>${esc(l)}</dt><dd>${c.orig ? `<b class="pv-no-cur">${esc(c.orig)}</b><span>${esc(c.yen)}</span>` : `<b>${esc(c.yen)}</b>`}</dd></div>`;
}
/* 前提と出どころ。台帳の前提の鍵は、出し方の決まっているものだけ（知らない鍵が増えたら止まる）。
   scope ＝ 調べの台帳の街の、数字の範囲の断り（airline-display.mjs の CITY の1行。会社ページの暮らしの板の「出典」と同じ字）。 */
const RENT_BASIS = ['what', 'period', 'caveat', 'per_month', 'currency', 'cols', 'scope'];
function rentBasis(slug, L, rents) {
  for (const b of L.basis || []) if (!RENT_BASIS.includes(b.key)) throw new Error(`${slug}: 家賃の前提 ${b.key} の出し方が決まっていない`);
  const by = k => (L.basis || []).find(b => b.key === k)?.value || '';
  const lines = [];
  if (by('what')) lines.push(by('what') + (by('period') ? W.paren(by('period')) : ''));
  else for (const r of rents) if (r.cond && !lines.includes(r.cond)) lines.push(r.cond);
  if (by('caveat')) lines.push(by('caveat'));
  if (by('per_month')) lines.push(by('per_month'));
  if (by('scope')) lines.push(by('scope'));
  if (!lines.length) throw new Error(`${slug}: 家賃の前提が台帳に1つも無い`);
  const srcs = [];
  for (const r of rents) if (!srcs.some(o => o.url === r.src.url)) srcs.push({ url: r.src.url, name: r.src.name, when: rentWhen(slug, L, r) });
  return `${lines.map(t => `<p>${esc(t)}</p>`).join('\n')}${L.cur === 'JPY' ? '' : `
<p class="cr-fx pv-no-cur">${esc(fxNote(L.cur, LANG))}</p>`}
<ul class="cr-srcs pv-no-cur">
${srcs.map(o => `<li><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a><span>${esc(o.when)}</span></li>`).join('\n')}
</ul>`;
}

/* 拠点の街（暮らしのタブ）。地域を横に見られるのは、全部の地域にそろっている間取りだけ（台帳から機械で選ぶ）。 */
function town(slug) {
  const F = FACTS[slug], L = living(slug);
  const rooms = L.cols.filter(([k]) => L.rents.every(r => rentCell(L.cur, r.value[k])));
  if (!rooms.length) throw new Error(`${slug}: 全部の地域にそろっている間取りが無い`);
  const shots = L.rents.map(r => [r, placeShot(r.key)]);
  return `<div class="cr-sec cr-towns">
<h2 class="cr-h2">${W.town}</h2>
<p class="cr-town-base pv-no-cur">${esc(fld(F.base, 'city_ja'))}<span class="cr-stay-c">${esc(F.base.iata)}</span><span class="cr-town-ap">${esc(valX(F.base))}</span></p>
<h3 class="cr-town-h">${W.rentH(rooms.map(r => esc(r[1])).join(W.sep))}<span class="cr-tag">${esc(L.measure)}</span></h3>
<ul class="cr-town-l">
${shots.map(([r, p]) => `<li class="cr-town">
${p ? `<span class="cr-town-p">${placeImg(p, '(min-width: 700px) 240px, 46vw')}</span>` : ''}
<span class="cr-town-n">${esc(r.name)}</span>
<dl class="cr-rent">
${rooms.map(c => rentRow(L, r, c)).join('\n')}
</dl>
</li>`).join('\n')}
</ul>
<details class="cr-more">
<summary>${W.rentBasis}</summary>
${rentBasis(slug, L, L.rents)}
</details>
${placeCredits(shots.filter(([, p]) => p).map(([r, p]) => [r.name, p]))}
</div>`;
}

/* 比較の中の、1社ぶんの家賃の箱。その会社の拠点の街の、台帳がいちばん先に挙げる地域（lead）だけ。
   地域を選んだ理由（pick）の中の社名は、会社ページの暮らしの板と同じ決まり（coText：日本の会社は日本語・ほかは英語。
   2026-10-19 P12.65「エバー航空の事業所がある」→「EVA Airの事業所がある」）。箱の見出しの社名は見出しなので変えない。
   ⚠️ 2つの街を1つの表・1つの目盛に並べない（物差しが街ごとに違う）。箱の中に その街の物差し・出どころ・時点 を持つ。 */
function rentBox(slug, shown) {
  const L = rentLiving(slug);
  const lead = L.rents.filter(r => r.lead);
  if (lead.length !== 1) throw new Error(`${slug}: 家賃の先頭の地域が${lead.length}つ（1つに決まらない）`);
  const r = lead[0];
  const rows = L.cols.map(c => rentRow(L, r, c)).filter(Boolean);
  if (!rows.length) throw new Error(`${slug}: 先頭の地域に家賃が1つも無い`);
  const at = rentWhen(slug, L, r);
  if (!at) throw new Error(`${slug}: 家賃の箱に時点が無い（${L.city}）`);
  /* 調べの台帳の街は、地域の名前 ＝ 街の名前（見出しの横にもう出ている）── 同じ名前を2度言わない。
     「ほかの街」は、会社ページの暮らしのタブにこの箱の街のほかの街が在る会社だけ（地域が2つ以上・拠点の街が2つ以上）。 */
  const v = vw(slug), more = L.rents.length > 1 || (v.livings || []).length > 1;
  return `<article class="cr-rentb" data-airline="${slug}" style="--cr-co:${color(slug)}"${shown ? '' : ' hidden'}>
<h3 class="cr-rentb-h"><i class="cr-dot" aria-hidden="true"></i>${esc(name(slug))}<span>${esc(L.city)}</span></h3>
<p class="cr-rentb-k"><span class="cr-tag">${esc(L.measure)}</span>${r.label === L.city ? '' : ` ${esc(r.label)}`}${r.pick ? `<small>${esc(coText(slug, r.pick, LANG))}</small>` : ''}</p>
<dl class="cr-rent cr-rentb-l">
${rows.join('\n')}
</dl>
<p class="cr-rentb-s pv-no-cur">${esc(r.src.name)}<span>${esc(at)}</span></p>
<details class="cr-more">
<summary>${W.basis}</summary>
${rentBasis(slug, L, [r])}
</details>
${more ? `<p class="cr-else cr-rentb-go"><a class="cr-link" href="${href.page(slug, 'life')}">${W.moreTowns}${IC.go}</a></p>` : ''}
</article>`;
}

/* 家賃の箱が片方の会社にだけ在るとき、もう片方の列に出す箱（★2026-10-25 WP-compare-all-13 F2 ── 空けていた列）。字は会社ページの
   暮らしの板と同じ1行（W.rentNone）だけ。箱は1つ ── 社名と色は career.js が選ぶ面のその会社の1行から写し、置く列も career.js が決める。
   会社ページに家賃の額が在る会社（調べの台帳の街・1週あたり …… 比較の箱の決まりに合わないだけ）は data-held に並べる ＝ その会社には出さない
   （資料が在るのに「確認できていません」と言わない）。 */
function rentNoneBox() {
  const held = ALL.filter(s => !rentable(s) && livingsOf(s).some(L => (L.rents || []).some(r => Object.keys(r.value || {}).length)));
  return `<article class="cr-rentn" data-held="${held.join(' ')}" hidden>
<h3 class="cr-rentb-h"><i class="cr-dot" aria-hidden="true"></i><b class="cr-rentn-n"></b></h3>
<p class="cr-rentn-t">${W.rentNone}</p>
</article>`;
}

/* 比較に家賃の箱を置ける会社 ＝ 会社ページと同じ読み口（viewOf() の暮らし）が、箱の決まりどおりの1か月あたりの家賃を持つ会社。
   先行5社は今までどおり必ず置く（置けなければ rentBox が止まる）。ほかの会社は、決まりに合わない（1週あたり／先頭の地域が1つに
   決まらない／前提の1行が無い／時点が無い …）なら箱を置かない ── 空の箱・「準備中」・断りの1行を比較に置かない。
   ★2026-10-26 段階5 compare-all-15（P12.123）：調べの台帳の街も読む。箱に出す街は、会社ページの暮らしのタブと同じ並び（拠点の順）の
     うち、決まりに合ういちばん上の街（いちばん上の拠点の街に家賃の資料が無い会社は、次の拠点の街）。調べの台帳の街の字は
     airline-display.mjs の CITY に書いた街だけ ── この箱は「過去」「参考」「募集」の札を出さないので、そういう行の街には CITY を書かない
     （assert-career.mjs が台帳の行の使い方を見る）。下の条件は living()・rentBox()・rentBasis() の止まる条件を問いの形にしたもの。 */
const livingsOf = s => { const v = vw(s); return (v.livings && v.livings.length ? v.livings : [v.living]).filter(Boolean); };
function boxable(slug, L) {
  if (!L || L.per !== 'month' || !L.measure || !L.city || !(L.rents || []).length) return false;
  if ((L.basis || []).some(b => !RENT_BASIS.includes(b.key))) return false;
  for (const x of L.rents) if (!x.name || (Object.keys(x.value || {}).length && (!rentWhen(slug, L, x) || !x.src?.url || !x.src?.name))) return false;
  const lead = L.rents.filter(x => x.lead);
  if (lead.length !== 1 || !L.cols.some(([k]) => rentCell(L.cur, lead[0].value[k]))) return false;
  const by = k => (L.basis || []).find(b => b.key === k)?.value || '';
  return !!(by('what') || lead[0].cond || by('caveat') || by('per_month') || by('scope'));
}
function rentLiving(slug) {
  if (FIVE.includes(slug)) return living(slug);
  const L = livingsOf(slug).find(x => boxable(slug, x));
  if (!L) throw new Error(`${slug}: 比較の家賃の箱に置ける街が無い`);
  return L;
}
const rentable = slug => FIVE.includes(slug) || livingsOf(slug).some(L => boxable(slug, L));
/* 家賃の時点。台帳の行の対象の期間（読み口の when）。調べの台帳の街で、資料に対象の期間が書いていない行は、資料を開いた日
   （「…に開いた時点の表示」── living-facts.mjs の決まり「ページに日付が無いものは、開いた時点の表示」と同じ字）。開いた日の無い行は ''。 */
function rentWhen(slug, L, r) {
  if (r.when || !L.research) return r.when || '';
  const c = researchCities(slug, L.airports.map(a => a.iata)).find(x => x.city === L.cityKey);
  const day = c && c.rents.length ? ((c.rents[0].r.src || [])[0] || {}).retrieved : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return '';
  return EN() ? `as shown when opened on ${atTextEn(day)}` : `${atText(day)}に開いた時点の表示`;
}

function deep(slug) {
  const top = `<div class="cr-tabp" data-tab="top">
<div class="cr-pay cr-pay-deep">
<h2 class="cr-pay-h">${W.pay}</h2>
<div class="cr-bars">
${ROLES.map(([r]) => bar(slug, r, W.rank[r])).join('\n')}
${axis(scaleOf(slug))}
</div>
<p class="cr-tax">${esc(vw(slug).pay.tax)}</p>
</div>
${pub(slug, 'h2')}
${org(slug)}
<div class="cr-sec">
<h2 class="cr-h2">${W.reviews}</h2>
${live('stars', { airline: slug })}
${live('reviews', { airline: slug })}
</div>
<div class="cr-sec">
<h2 class="cr-h2">REAL PAY</h2>
${live('realpay', { airline: slug })}
</div>
${jobs(slug)}
<p class="cr-else"><a class="cr-link" href="airlines/${slug}.html">${W.revJobs}${IC.go}</a></p>
<div class="cr-ents">
${TABS.slice(1).map(([t]) => `<a class="cr-ent" href="${href.tab(slug, t)}" data-go>${W.tabs[t]}${IC.go}</a>`).join('\n')}
<a class="cr-ent" href="${href.card(slug)}" data-go>${W.card}${IC.go}</a>
</div>
</div>`;

  const work = `<div class="cr-tabp" data-tab="work" hidden>
<div class="cr-sec">
<h2 class="cr-h2">${W.work}</h2>
${live('work', { airline: slug })}
<p class="cr-else"><a class="cr-link" href="pay-report.html?airline=${slug}">${W.payAnon}${IC.go}</a></p>
</div>
${benefits(slug)}
<div class="cr-topics">
${TOPICS.map(t => topic(slug, t)).join('\n')}
</div>
</div>`;

  const life = `<div class="cr-tabp" data-tab="life" hidden>
${town(slug)}
<div class="cr-sec">
<h2 class="cr-h2">${W.dests}</h2>
<ul class="cr-dests">
${destinations(slug).map(d => `<li><a class="cr-dest" href="${href.stay(slug, d.iata)}" data-go><span class="cr-dest-n">${esc(cityOf(d))}</span><span class="cr-dest-c">${d.iata}</span></a></li>`).join('\n')}
</ul>
${destSources(slug)}
</div>
</div>`;

  return `<section class="cr-view cr-co cr-deep" data-view="airline" data-airline="${slug}" style="--cr-co:${color(slug)};${div(scaleOf(slug))}" hidden>
<div class="cr-top">
${back()}
<a class="cr-btn" href="${href.compare(slug, rival(slug))}" data-go>${W.cmp}</a>
</div>
<figure class="cr-hero">
${photo(slug, '(min-width: 1100px) 1040px, 100vw', false)}
${badge(slug)}
<h1 class="cr-h1 cr-hero-n" tabindex="-1">${esc(name(slug))}</h1>
</figure>
<nav class="cr-tabs" aria-label="${esc(name(slug))}">
${TABS.map(([t], i) => `<a class="cr-tab" href="${href.tab(slug, t)}" data-go data-tab="${t}"${i ? '' : ' aria-current="page"'}>${W.tabs[t]}</a>`).join('\n')}
</nav>
${top}
${work}
${life}
${credits([[slug, shot(slug)]], false)}
</section>`;
}

/* ── その数字自身の詳細（d=cap-est・d=fo-est）── 推定年収の 対象・根拠（在れば）── */
function detail(slug, rank, label) {
  const c = cell(slug, rank);
  const hid = `<span class="cr-vh">${esc(name(slug))}</span><span class="cr-vh">${label}</span>`;
  const other = ROLES.find(([r]) => r !== rank);
  return `<section class="cr-view cr-det" data-view="detail" data-airline="${slug}" data-d="${rank}-est" style="--cr-co:${color(slug)};${div(scaleOf(slug))}" hidden>
<a class="cr-back" href="${href.airline(slug)}" data-go>${IC.back}${esc(name(slug))}</a>
<h1 class="cr-h1 cr-det-h" tabindex="-1"><span class="cr-vh">${esc(name(slug))} </span>${W.estOf(label)}</h1>
<div class="cr-det-top cr-det-est">
<p class="cr-det-n">${hid}<b class="cr-det-v">${esc(c.text)}</b> <span class="cr-det-k">${kline(c)}</span></p>
<div class="cr-track" aria-hidden="true">${fill(c, scaleOf(slug))}</div>
${axis(scaleOf(slug))}
</div>
${facts([[W.target, `${label}<small>${W.estTarget}</small>`], ...estRows(slug, rank)])}
<p class="cr-else"><a class="cr-link" href="${href.detail(slug, `${other[0]}-est`)}" data-go>${W.estOf(W.rank[other[0]])}${IC.go}</a></p>
</section>`;
}

/* ── 就航地の1画面（器）── 中に乗員ホテルの生きた欄 ───────────── */
function stay(slug, d) {
  /* 写真は台帳に在る先だけ（無い先・保留の先は写真なし）。地図は検索の住所（都市と空港の3レター）。 */
  const p = placeShot(d.iata);
  if (!d.city_en) throw new Error(`${slug}: 就航地 ${d.iata} に英語の都市名が無い（地図の検索に使う）`);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.city_en} ${d.iata}`)}`;
  return `<section class="cr-view cr-stay" data-view="stay" data-airline="${slug}" data-stay="${d.iata}" style="--cr-co:${color(slug)}" hidden>
<a class="cr-back" href="${href.tab(slug, 'life')}" data-go>${IC.back}${W.destsOf(esc(name(slug)))}</a>
${p ? `<figure class="cr-sv-p">${placeImg(p, '(min-width: 1100px) 1040px, 100vw')}</figure>
` : ''}<h1 class="cr-h1 cr-stay-h" tabindex="-1"><span class="cr-vh">${esc(name(slug))} </span>${esc(cityOf(d))}<span class="cr-stay-c">${d.iata}</span></h1>
<p class="cr-stay-n">${esc(countryOf(d))}${d.seasonal ? `<span class="cr-sv-tag">${W.seasonal}</span>` : ''}</p>
<p class="cr-sv-map"><a class="cr-link" href="${esc(maps)}" target="_blank" rel="noopener">${W.maps}${IC.go}</a></p>
<div class="cr-sec">
<h2 class="cr-h2">${W.hotels}</h2>
${live('hotels', { airline: slug, stay: d.iata })}
</div>
${p ? placeCredits([['', p]]) : ''}
</section>`;
}

/* 口コミの6分類の名前（比較の6角形に添える）。正本は会社ページの口コミの部品が持つ CAT_FULL（airlines/airline-reviews-data.js）
   ── 会社ページの評価スコアの図と同じ言葉（2026-10-21 オーナー「必ず多角形のレーダーの図を載せて」：図の名前は古いページの言葉）。
   同じ分類を別の言葉で呼ばない。あのファイルは見本の口コミも持っているので、この1枚では読み込まない
   ── 名前だけを生成のときに写して島に置く（career-live.js の catNames() が読む）。⚠️ ここに名前を打たない。 */
/* ★英語（EN-9）：英語のページは同じファイルの CAT_FULL_EN（英語の会社ページの口コミの欄と同じ言葉・同じ並び）。 */
const REVIEW_CATS_OF = {};
const reviewCats = () => (REVIEW_CATS_OF[LANG] ||= (() => {
  const t = fs.readFileSync(path.join(ROOT, 'airlines', 'airline-reviews-data.js'), 'utf8');
  const m = t.match(EN() ? /const CAT_FULL_EN\s*=\s*\[([^\]]*)\];/ : /const CAT_FULL\s*=\s*\[([^\]]*)\];/);
  const names = m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
  if (names.length !== 6) throw new Error(`airlines/airline-reviews-data.js の ${EN() ? 'CAT_FULL_EN' : 'CAT_FULL'}（6分類の名前）が読めない`);
  return names;
})());

/* ── 比較 ───────────────────────────────────────────────────────── */
/* 比較の1行（推定年収どうし・同じ職位・同じ目盛）。職位は見出しが持っているので、行の中では隠してある。
   行は入口にしない（会社ページの 給与・待遇 のタブへは、箱の下の「詳しく」から）。
   ⚠️ 会社が公表した額の行をここへ足さない（下の「会社が公表している金額」の箱が持つ）。
   data-scale はその会社の目盛の右端（並べた2社の目盛 ＝ 2つの大きいほう）。棒は、既定の2社の行はその2社の目盛で・ほかの行は
   その会社の目盛で描いておく（選ばれたら career.js が並べた2社の目盛で描き直す）。
   ★2026-10-25 オーナー P12.106（WP-compare-all-10）：札（「推定」）は行に書いたまま、画面では見出しの1行「推定年収」が1回だけ言う
   （行の札は読み上げにだけ残す ── career.css）。推定でない種類の行は data-kind を持ち、その行が見えているあいだは、どの行も自分の札を見せ、
   見出しの1行は出さない（推定でない行に「推定年収」と言わない）。推定の行は data-kind を持たない（全社の行に同じ字を足さない ── T-A8）。 */
function row(slug, rank, label, shown) {
  const c = cell(slug, rank);
  if (!TIERS[c.kind] || TIERS[c.kind][LANG] !== c.tag) throw new Error(`${slug}/${rank}: 金額の種類「${c.kind}」と札「${c.tag}」が合わない`);
  const lab = rank === ROLES[0][0] ? ` data-lab="${labOf(slug).join(' ')}"` : '';   // 色の近さを測る座標は機長の行にだけ（上の NEAR）
  const attrs = `data-airline="${slug}"${c.kind === 'estimate' ? '' : ` data-kind="${c.kind}"`} data-scale="${scaleOf(slug)}"${lab} style="--cr-co:${color(slug)}"${shown ? '' : ' hidden'}`;
  return `<div class="cr-row" ${attrs}>
<div class="cr-row-h"><span class="cr-row-co"><i class="cr-dot" aria-hidden="true"></i>${esc(name(slug))}</span><span class="cr-vh">${label}</span><b class="cr-row-v">${esc(c.text)}</b></div>
<div class="cr-row-k">${kline(c)}</div>
<div class="cr-track" aria-hidden="true">${fill(c, shown ? pairScale(...PAIR) : scaleOf(slug))}</div>
</div>`;
}

function compare() {
  /* 掲載している全社ぶんを置いておき、選ばれた2社だけ見せる（career.js は数字を持たない）。台帳に中身の無い箱は、その会社のぶんを置かない。 */
  const on = s => PAIR.includes(s);
  /* 「会社が公表している金額」の箱（.cr-cards）は、並べた2社のどちらにも一覧が無ければ描かない（空の箱・「公表なし」を置かない ──
     2026-10-22 LEAD AMENDMENT・P12.91-7）。片方に在れば、もう片方は社名だけ。選び直したときは career.js の pair() が同じ決まりで決める。 */
  const pubs = Object.fromEntries(FIVE.map(s => [s, pub(s, 'h3')]));
  /* 札の中身（略号かロゴ・社名・「選び直せる」印）は写真の箱（.cr-opt-p）の中 ── 広い画面では1行に並べる（★2026-10-25 P12.106・career.css）。
     ★WP-compare-all-12：写真の無い札の ▼ は2か所に置き、画面に出すのはいつも1つ（352px からは社名の中 ── 写真の札と同じ所・
     351px まではロゴの段 ── 写真の札が略号の札の中に印を移すのと同じ段。どちらを出すかは career.css）。
     ★2026-10-26 段階5 compare-all-14（P12.122）：先行5社のほかの会社でも、台帳に写真の在る会社は、この札の地にその会社の1枚目の写真を
     career.js が置く（絵の道・大きさ・説明はカードの島 #crc-data から ── 下の cardData()）。写真のクレジットは、写真の在る全社ぶんを下の段に
     置き（並べた2社のものだけ見える）、示すことが条件の写真には必ず作者とライセンスのリンクが付く（会社ページと同じ形）。 */
  const side = (id, label, chosen) => `<div class="cr-side" data-side="${id}">
${FIVE.map(s => `<div class="cr-opt" data-airline="${s}" style="--cr-co:${color(s)}"${s === chosen ? '' : ' hidden'}>
<span class="cr-opt-p">${photo(s, '(min-width: 900px) 500px, 46vw', false)}${badge(s)}<span class="cr-opt-n">${esc(name(s))}${IC.down}</span></span>
</div>`).join('\n')}
<div class="cr-opt cr-opt-x" data-airline="" hidden><span class="cr-opt-p"><span class="cr-opt-lg">${IC.down}</span><span class="cr-opt-n"><span class="cr-opt-t"></span>${IC.down}</span></span></div>
<button type="button" class="cr-pickb" id="cr-open-${id}" data-label="${label}" aria-label="${label} ${esc(name(chosen))}" aria-haspopup="dialog"></button>
<span class="cr-ring" aria-hidden="true"></span>
</div>`;
  /* 目盛の字は、ありうる右端（全社の目盛）ごとに1本。見せるのは並べた2社の1本だけ（career.js が選ぶ）。 */
  const ax = pairScale(...PAIR), scales = [...new Set(ALL.map(scaleOf))].sort((x, y) => x - y);
  return `<section class="cr-view cr-cmp" data-view="compare" data-near-max="${NEAR}" style="${div(ax)}" hidden>
${back()}
<h1 class="cr-h1 cr-cmp-h" tabindex="-1">${W.cmpAll}</h1>
<div class="cr-pick">
${side('a', W.first, PAIR[0])}
<button type="button" class="cr-swap" id="cr-swap" aria-label="${W.swap}">${IC.swap}</button>
${side('b', W.second, PAIR[1])}
</div>
<div class="cr-panel" data-kind="estimate">
<div class="cr-panel-top"><h2 class="cr-panel-h" id="cr-cmp-h-pay">${W.pay}</h2><p class="cr-tgt"><span class="cr-tgt-k">${W.est}</span><span>${W.estTarget}</span></p></div>
${ROLES.map(([r]) => { const l = W.rank[r]; return `<h3 class="cr-role">${l}</h3>
<div class="cr-pair" data-role="${r}">
${ALL.map(s => row(s, r, l, on(s))).join('\n')}
</div>`; }).join('\n')}
${scales.map(t => `${axis(t, ` data-scale="${t}" data-div="${t / SCALE_STEP}"${t === ax ? '' : ' hidden'}`)}\n${axisCopy(t)}`).join('\n')}
${gos('pay', 'pay', s => vw(s).pay.tax || '')}
</div>
<div class="cr-sec cr-subpay" data-kind="submitted">
<h2 class="cr-h2">${W.realPay}<span class="cr-h2-s" lang="en">REAL PAY</span></h2>
${live('cmp-pay')}
</div>
<div class="cr-sec cr-cmp-rev">
<h2 class="cr-h2" id="cr-cmp-h-rev">${W.reviews}</h2>
${live('cmp-stars')}
${live('cmp-summary')}
${gos('reviews', 'rev')}
</div>
<div class="cr-sec cr-rents" data-wrap>
<h2 class="cr-h2">${W.rentCmp}<span class="cr-h2-s">${W.perMonth}</span></h2>
<div class="cr-rentbs">
${ALL.filter(rentable).map(s => rentBox(s, on(s))).join('\n')}
${rentNoneBox()}
</div>
</div>
<div class="cr-sec cr-cmp-work">
<h2 class="cr-h2" id="cr-cmp-h-work">${W.work}</h2>
${live('cmp-work', { entry: 'give' })}
${live('cmp-facts', { keys: CMP_KEYS.work.join(','), quiet: '1' })}
${gos('work', 'work')}
</div>
<div class="cr-sec cr-cmp-ben">
<h2 class="cr-h2" id="cr-cmp-h-ben">${W.benCmp}</h2>
${live('cmp-facts', { keys: CMP_KEYS.pay.join(',') })}
${gos('pay', 'ben')}
</div>
<div class="cr-cards" data-kind="published"${PAIR.some(s => pubs[s]) ? '' : ' hidden'}>
${FIVE.map(s => `<div class="cr-card" data-airline="${s}" style="--cr-co:${color(s)}"${on(s) ? '' : ' hidden'}>
<h2 class="cr-card-h"><a class="cr-card-n" href="${href.page(s)}">${esc(name(s))}${IC.go}</a></h2>
${pubs[s]}
</div>`).join('\n')}
</div>
<p class="cr-else cr-cmp-card"><a class="cr-link" id="cr-to-card" href="${href.card(PAIR[0], PAIR[1])}" data-go>${W.card}${IC.go}</a></p>
${credits(ALL.filter(s => primary(s)).map(s => [s, shot(s)]), true, PAIR)}
<script type="application/json" id="crl-cats">${JSON.stringify(reviewCats()).replace(/</g, () => '\\u003c')}</script>
</section>`;
}

/* ── カード保存（器）── 中身は career-card.js が DOM API で組む ─── */
/* ★金額を入れない。カードは、画面の DOM の字（data-main）を読む。ここに置くのは
   社名・色・写真の一覧とクレジット・公開ページの住所・QR の行列だけ。 */
const HOST = (() => {
  const h = fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) throw new Error('CNAME が読めない（公開ページの住所を作れない）');
  return h;
})();
/* カードの島の並び：先行5社が先（カードの選ぶ欄の頭と、会社が決まらないときの1社は今までどおり）、あとは航空会社一覧の並び
   （CA-3b1）。 */
const ISLE = () => [...FIVE, ...listed().filter(s => !FIVE.includes(s))];
export function cardData() {
  career();
  /* 地域の名前（航空会社一覧の見出しと同じ字）。カードの選ぶ欄が会社を地域ごとに束ねる（CA-3b2）。 */
  const RJ = Object.fromEntries(REGIONS.map(R => [R.code, R[LANG]]));
  const airlines = {};
  for (const s of ISLE()) {
    /* 英語のカードの住所と QR は、英語の会社ページ（en/airlines/{slug}.html） */
    const url = `https://${HOST}/${EN() ? 'en/' : ''}airlines/${s}.html`;
    airlines[s] = {
      ja: SALARY[s].ja, en: SALARY[s].en, code: code(s), color: color(s), url, g: RJ[dir().airlines[s].region],
      qr: qrMatrix(url).map(r => r.join('')),
      /* クレジットは「示すことが使う条件」の写真にだけ入れる（要らない写真は空）。
         ★2026-10-26 段階5 compare-all-14（P12.122）：1枚目には写真の説明（alt）も ── 比較の札（career.js）が、先行5社の札と同じ説明
         （「会社名の 機種」）で写真を置くため。career.js は字を作らない。 */
      photos: (PHOTOS[s] || []).map((p, i) => ({ src: UP + photoSrc(p), w: p.w, h: p.h, credit: needsCredit(p) ? `${p.author} / ${p.licence}` : '',
        ...(i ? {} : { alt: W.photoAlt(name(s), p.aircraft) }) })),
    };
    if (!airlines[s].en) throw new Error(`${s}: SALARY に英語の社名が無い`);
  }
  return { host: HOST, airlines };
}
function card() {
  /* JSON の中の < は、HTML が </script> と読み違えないように逃がす。 */
  const json = JSON.stringify(cardData()).replace(/</g, () => '\\u003c');
  return `<section class="cr-view cr-cardv" data-view="card" hidden>
<a class="cr-back" id="crc-back" href="${href.home}" data-go>${IC.back}${W.backCard}</a>
<h1 class="cr-h1 cr-cardv-h" tabindex="-1">${W.card}</h1>
<div id="crc-root"></div>
<script type="application/json" id="crc-data">${json}</script>
</section>`;
}

/* 比較の2社を選ぶ面（1つ・どちらの札からも開く）。並べるのは選べる会社。字は社名と略号だけ（額を置かない）。 */
const choice = () => listed();
/* ロゴは会社ページ・航空会社一覧と同じ部品（airline-logo.mjs）。面は開くまで見えないので、絵は見えたときに読む
   （loading="lazy" ── 航空会社一覧の gen-directory.mjs と同じ足し方。部品は lazy の口を持たない）。 */
const logo = s => logoHtml({ slug: s, color: color(s) }, { up: UP }).replace('<img ', () => '<img loading="lazy" ');
/* 検索の鍵（data-c ＝ 略号・data-k ＝ 呼び名）は航空会社一覧と同じ（model() の codes / keys ── 一覧のカードと同じ字。CA-3b2）。 */
const entry = s => `<li><button type="button" class="cr-pk" data-airline="${s}" data-c="${esc(dir().airlines[s].codes.join(' '))}" data-k="${esc(dir().airlines[s].keys.join('|'))}" style="--cr-co:${color(s)}"><span class="cr-pk-lg">${logo(s)}</span><span class="cr-pk-n">${esc(name(s))}</span><span class="cr-pk-c">${esc(code(s))}</span></button></li>`;
function sheet() {
  /* 会社は航空会社一覧の地域の見出しの下に、一覧の並びで（会社の無い地域は何も書かない）。見出しの行は、読み上げの「一覧の項目」に数えない。 */
  return `<dialog class="cr-sheet" id="cr-sheet" aria-labelledby="cr-sheet-h">
<div class="cr-sheet-top"><h2 class="cr-sheet-h" id="cr-sheet-h">${W.first}</h2><button type="button" class="cr-sheet-x" id="cr-sheet-x" aria-label="${W.close}">${IC.x}</button></div>
<input type="search" class="cr-sheet-q" id="cr-sheet-q" placeholder="${W.search}" aria-label="${W.search}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"/>
<ul class="cr-sheet-l" id="cr-sheet-l">
${REGIONS.map(R => { const ss = choice().filter(s => dir().airlines[s].region === R.code);
  return ss.length ? `<li class="cr-pk-gl" role="presentation" data-region="${R.code}"><h3 class="cr-pk-g">${esc(R[LANG])}</h3></li>\n${ss.map(entry).join('\n')}` : ''; }).filter(Boolean).join('\n')}
</ul>
<p class="cr-sheet-0" id="cr-sheet-0" role="status" hidden>${W.none}</p>
</dialog>`;
}

export function build() {
  career();
  return `<div class="cr" id="cr" data-a="${PAIR[0]}" data-b="${PAIR[1]}">
${home()}
${FIVE.map(overview).join('\n')}
${DEEP.flatMap(s => ROLES.map(([r]) => detail(s, r, W.rank[r]))).join('\n')}
${DEEP.flatMap(s => destinations(s).map(d => stay(s, d))).join('\n')}
${compare()}
${sheet()}
${card()}
</div>`;
}

/* ── 書き込み ──────────────────────────────────────────────────── */
const OPEN = '<!--PV-CAREER-->', CLOSE = '<!--/PV-CAREER-->';
const fingerprint = f => createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);
/* career.html が読む、この1枚だけの部品。指紋（?v=）を付ける一覧。
   ⚠️ どれか1つを直したら node gen-career.mjs を流す（流さないと古い部品が最大4時間残る）。 */
export const ASSETS = [
  'career.css', 'career-sec.css', 'career-live.css', 'career-stay.css', 'career-card.css', 'pv-gg.css',
  'career.js', 'career-live.js', 'career-stay.js', 'career-card.js',
  /* パイロットであることの確認の共通のポップアップ。ホテルの欄の、会員の鍵の1行から開く（career-stay.js・2026-10-18 オーナー Q2） */
  'pv-proof-offer.js',
  /* ホテルの名前の候補（「ホテルを追加」の面の名前の欄・career-stay.js より前に読む。2026-10-18 オーナー V7） */
  'pv-hotel-suggest.js',
];

/** career.html（lang 'en' ＝ en/career.html）のあるべき全文（いまのファイルを読んで、管理している所だけ差し替える）。
    英語は、書いた中身の円の額をドルの span に焼いてから入れる（bakeHtml ── 英語の頭と左のメニューには額が無い）。 */
export function render(html, lang = 'ja') {
  return inLang(lang, () => {
    const page = EN() ? PAGE_EN : PAGE;
    const a = html.indexOf(OPEN), b = html.indexOf(CLOSE);
    if (a < 0 || b < a) throw new Error(`${page}: ${OPEN} … ${CLOSE} が無い`);
    if (EN() && !/<html lang="en"/.test(html)) throw new Error(`${page}: <html lang="en"> ではない（英語の部品が英語を話さない）`);
    LEDGER_USED.clear();
    const body = EN() ? bakeHtml(build(), C_EN) : build();
    if (EN()) for (const k of Object.keys(LEDGER_EN)) if (!LEDGER_USED.has(k)) throw new Error(`gen-career.mjs の LEDGER_EN の「${k}」が、もう台帳に無い（古い英語を言い続けない）`);
    let out = html.slice(0, a + OPEN.length) + '\n' + body + '\n' + html.slice(b);
    /* HTML は10分・CSS と JS は4時間キャッシュされる。中身の指紋を付けておけば、
       直した日に「新しい HTML ＋ 端末に残った古い JS」の組み合わせが成立しない。
       英語のページは en/ から読むので、道の頭に ../ が付く（UP）。 */
    for (const f of ASSETS) {
      const re = new RegExp(`(["'])${UP.replace(/\./g, () => '\\.')}${f.replace('.', () => '\\.')}(?:\\?v=[0-9a-f]{8})?\\1`, 'g');
      let n = 0;
      out = out.replace(re, (m, q) => { n++; return `${q}${UP}${f}?v=${fingerprint(f)}${q}`; });
      if (!n) throw new Error(`${page}: ${f} を読んでいない`);
    }
    return out;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /* 日本語と英語の2枚。両方を先に作ってから書く（片方が止まったら、どちらも書かない）。 */
  const next = [['ja', PAGE], ['en', PAGE_EN]].map(([lang, page]) => {
    const file = path.join(ROOT, page), now = fs.readFileSync(file, 'utf8');
    return { page, file, now, want: render(now, lang) };
  });
  if (process.argv.includes('--check')) {
    let stale = 0;
    for (const x of next) {
      if (x.now !== x.want) { console.error(`❌ ${x.page} が古い。node gen-career.mjs を流す`); stale++; }
      else console.log(`✓ ${x.page} は最新`);
    }
    if (stale) process.exit(1);
  } else {
    for (const x of next) {
      if (x.now === x.want) { console.log(`✓ ${x.page} 変更なし`); continue; }
      fs.writeFileSync(x.file, x.want);
      console.log(`✓ ${x.page} を書いた（目盛は1社の画面はその会社・比較は並べた2社で1本。既定の2社は 0〜${yen(pairScale(...PAIR))}）`);
    }
  }
}
