/* airline-rollout.mjs ── 会社ページを全社へ広げるときの「1か所」（2026-10-21・全社へ広げる b）。
 *
 *   SWITCH      … 新しい会社ページ（gen-airline-glance.mjs が書く形）を持つ会社。★ここに足した会社だけが書き直される。
 *                 足していない会社のページは1文字も変わらない（gen-airline-glance.mjs は SWITCH の会社しか開かない）。
 *   LEAD        … 先行5社。台帳を手で作った会社（airline-facts.mjs・career-facts.mjs・living-facts.mjs・airline-destinations.mjs）。
 *                 この5社のページは、今までの決め方のまま1文字も変わらない（オーナーの判断で「よくある質問」も外したまま）。
 *   why(row)    … 調べの台帳（research-ledger.mjs）の1行を、画面に出してよいか。出さない理由を返す（'' ＝ 出してよい）。★ここ1か所だけ。
 *   researchFacts(slug) … 先行5社ではない会社の「会社の事実」を、調べの台帳から、画面の部品が読む形にする。
 *
 * ★ 画面に出してよい行（オーナー 2026-10-19／リード 2026-10-20）
 *   ・使い方が 条件つき／募集／過去／参考 のどれかの行だけ。保留・空欄・未指定は出さない（使い方の無い行も出さない）。
 *   ・募集の行は募集として（募集の1枚にだけ）。過去の行は、その日付と一緒にだけ（日付の無い過去の行は出さない）。
 *     参考の行は、最初の1画面の1行（lead）にしない。
 *   ・★過去と参考の行は、いまはどのカードにも置かない（WORDED）。過去は「過去の話」として・参考は「背景」として出す決まりだが、
 *     その言い方（画面の字）がまだ無い ── 言い方の無いまま並べると、過去の制度が今の制度に読める（今の待遇の1行めにもなっていた）。
 *     言い方は「全社へ広げる c」の言い回しの表（リード 2026-10-21 L1）が作る。そこで WORDED に足す。それまでは出さない行に数える。
 *   ・機長と副操縦士を分けない給与（運航乗務員の平均・全社員の平均など）は、使い方が何でも出さない（P12.77）。
 *   ・空港までの移動の行は、その会社の拠点の空港の行だけ（同じ街の行でも、別の空港の行は出さない。空港が決まらない行も出さない）。
 * ★ 字は台帳の字のまま（調べた側の名前・値・条件）。ここで言い換えない・足さない。
 *   会社が公表している条件の欄に置くのは、会社自身の資料の行だけ（gen-airline-glance.mjs の「会社が公表している条件」の決まり）。
 * ★ 機材の行は、まだ画面の形にしない（機数と型式の字の形が会社ごとにそろっていない）。暮らし（家賃・空港までの移動・住む街）と
 *   就航地の行も、この回では画面に出さない ── 街が複数ある会社の出し方・就航地の一覧が全部そろっているかを、まだ決めていない。
 *   どちらも数は gen-airline-glance.mjs --status が言う（台帳に在る ≠ 画面に出る）。
 */
import { fileURLToPath } from 'node:url';
import { readStore } from './import-research-pack.mjs';
import { PLACES } from './airline-destinations.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/** 先行5社（手で作った台帳を持つ会社）。並びは今までの GLANCE と同じ。 */
export const LEAD = Object.freeze(['jal', 'ana', 'cathay-pacific', 'etihad', 'eva-air']);
/** 新しい会社ページを持つ会社。★1か所。見本の会社を足すのは「全社へ広げる c」（オーナーが絵を見てから）。 */
export const SWITCH = Object.freeze([...LEAD]);
/** 画面に出してよい使い方。 */
export const SHOWN = Object.freeze(['条件つき', '募集', '過去', '参考']);
/** そのうち、いま画面の言い方が在る使い方（条件つき ＝ そのまま・募集 ＝ 募集の1枚）。過去・参考は言い方ができるまで出さない。 */
export const WORDED = Object.freeze(['条件つき', '募集']);

/* 調べの台帳。読むのは、先行5社ではない会社の画面を作るときだけ（先行5社しか書かない日は読まない）。 */
let STORE = null;
export const research = () => (STORE ??= readStore(ROOT).store);

/** その行が「いつの話か」の日付（YYYY-MM-DD・YYYY-MM・YYYY）。対象の始まり → 資料の日付 → 対象の終わり の順。無ければ ''。 */
export function dateOf(r) {
  const ok = d => (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(String(d || '')) ? String(d) : '');
  return ok(r.effective && r.effective.from) || ok(r.src && r.src[0] && r.src[0].published) || ok(r.effective && r.effective.to);
}

/* 行の名前と値の字の中に出てくる空港（3字）。空港と読むのは、台帳の空港の一覧（PLACES）・調べの台帳のどこかの会社の拠点・
   その会社の拠点に在る3字だけ（「ONS」「GBP」のような略語を空港と読まない）。
   ★条件の字（cond_ja）は読まない ── 「DAL と DFW を混ぜず」のように、ほかの空港の名前を打ち消しで書いていることがある。 */
let BASES = null;
const allBases = () => (BASES ??= new Set(Object.values(research().FACTS || {}).flatMap(F => (F.base || []).map(r => String(r.value)))
  .filter(c => /^[A-Z]{3}$/.test(c))));
function airportsIn(r, also = []) {
  const text = [r.label_ja, typeof r.value === 'string' ? r.value : '', r.value_text].filter(Boolean).join(' ');
  const known = new Set([...Object.keys(PLACES), ...allBases(), ...also]);
  return [...new Set((text.match(/(?<![A-Za-z])[A-Z]{3}(?![A-Za-z])/g) || []).filter(c => known.has(c)))];
}

/**
 * 1行を画面に出さない理由（'' ＝ 出してよい）。
 *   o.pay      … 給与の行として見る（機長・副操縦士のどちらかの行だけ）
 *   o.commute  … 空港までの移動の行として見る。o.bases ＝ その会社の拠点の空港（3字の並び）
 */
export function why(r, o = {}) {
  if (!r || typeof r !== 'object') return '行が無い';
  if (!SHOWN.includes(r.use)) return `使い方が「${r.use || '無し'}」`;
  const pay = o.pay || r.domain === 'pay';
  if (pay) {
    const rank = r.rank || (r.applies_to && r.applies_to.rank);
    if (rank !== 'cap' && rank !== 'fo') return '機長と副操縦士を分けない給与';
  }
  if (r.use === '過去' && !dateOf(r)) return '過去の話なのに日付が無い';
  if (o.commute || (r.domain === 'living' && r.key === 'commute')) {
    const bases = o.bases || [];
    const at = airportsIn(r, bases);
    if (!at.length) return '空港が決まらない';
    if (!bases.length || at.some(c => !bases.includes(c))) return `拠点の空港の行ではない（${at.join('・')}）`;
  }
  return '';
}
export const shown = (r, o) => !why(r, o);

/* 資料の種類（調べた側の publisher_kind）→ 画面の種類（career-facts.mjs の SRC_KINDS の鍵）。在るのは会社と政府の2つだけ。 */
const KIND = { airline: 'company', government: 'gov' };
const srcOf = r => {
  const s = (r.src || [])[0];
  if (!s || !/^https:\/\//.test(s.url || '')) return null;
  return { name: s.title ? `${s.publisher}「${s.title}」` : s.publisher, url: s.url, kind: KIND[s.publisher_kind] || s.publisher_kind || '' };
};

/* 調べの1行 → 画面の部品が読む事実の形（airline-facts.mjs の行と同じ鍵）。字は台帳のまま。
   単位がラテン文字（"calendar days"）なら、数字とのあいだに空白を1つ置く（字は変えない）。 */
function asFact(r) {
  const src = srcOf(r);
  let value = r.value, unit = r.unit || '', cur = '';
  if (typeof value === 'number' && r.currency) cur = r.currency;
  else if (typeof value === 'number') unit = unit && /^[\x20-\x7e]/.test(unit) ? ` ${unit}` : unit;
  else if (value && typeof value === 'object') value = typeof r.value_text === 'string' ? r.value_text : null;
  if (value == null || value === '' || !src) return null;
  return {
    key: r.key, ja: r.label_ja || '', value, unit: cur ? '' : unit, cur, at: dateOf(r), as_of: r.checked_at || '',
    cond_ja: r.cond_ja || '', src, pilot: !(r.applies_to && r.applies_to.pilot_specific === false),
    use: r.use, id: r.id, lead: false,
  };
}

/**
 * 先行5社ではない会社の「会社の事実」（調べの台帳から）。
 *   base     … 拠点の空港（3字）と街。使い方が 条件つき・募集 で、会社か政府の資料の行だけ。
 *   work / benefits / jobs / profile / scale … 画面の部品が読む事実の形の並び（lead は最初の「条件つき」の1行だけ）。
 *              置くのは使い方が WORDED の行だけ（過去・参考は、言い方ができるまで held）
 *   held     … 出さなかった行と、その理由（--status が数える）
 */
export function researchFacts(slug) {
  const F = (research().FACTS || {})[slug] || {};
  const out = { base: null, work: [], benefits: [], jobs: [], profile: [], scale: [], held: [] };
  const hold = (r, w) => out.held.push({ id: r.id, why: w });
  const iata = [], baseRows = [];
  for (const [sec, rows] of Object.entries(F)) {
    for (const r of rows || []) {
      const w = why(r);
      if (w) { hold(r, w); continue; }
      if (!WORDED.includes(r.use)) { hold(r, `「${r.use}」の行の言い方が、まだ無い（全社へ広げる c の言い回しの表で出す）`); continue; }
      if (sec === 'fleet') { hold(r, '機材の行は、まだ画面の形にしていない'); continue; }
      const f = asFact(r);
      if (!f) { hold(r, '値か資料の住所が無い'); continue; }
      if (sec === 'base') {
        if (!['条件つき', '募集'].includes(r.use)) { hold(r, `拠点に「${r.use}」の行は使わない`); continue; }
        if (!['company', 'gov'].includes(f.src.kind)) { hold(r, '拠点は会社か政府の資料の行だけ'); continue; }
        if (!/^[A-Z]{3}$/.test(String(r.value))) { hold(r, '拠点の値が空港の3字ではない'); continue; }
        if (!iata.includes(r.value)) iata.push(r.value);
        baseRows.push(f);
        continue;
      }
      const place = r.use === '募集' ? 'jobs' : sec;
      if (!(place in out) || place === 'held' || place === 'base') { hold(r, `置き場が無い（${sec}）`); continue; }
      const company = f.src.kind === 'company';
      if (['work', 'benefits', 'jobs'].includes(place) && !company) { hold(r, '会社が公表している条件の欄には、会社自身の資料の行だけ'); continue; }
      if (['profile', 'scale'].includes(place) && !['company', 'gov'].includes(f.src.kind)) { hold(r, '会社の数字は、会社か政府の資料の行だけ'); continue; }
      out[place].push(f);
    }
  }
  /* 並び：条件つき → 参考 → 過去（台帳の順のまま。いまは WORDED の行だけなので、参考・過去は並ばない）。
     最初の1画面の1行（lead）は、最初の「条件つき」の行だけ。 */
  const ORDER = { 条件つき: 0, 募集: 0, 参考: 1, 過去: 2 };
  for (const k of ['work', 'benefits', 'jobs', 'profile', 'scale']) {
    out[k] = out[k].map((f, i) => [f, i]).sort(([a, i], [b, j]) => ORDER[a.use] - ORDER[b.use] || i - j).map(([f]) => f);
    const first = out[k].find(f => f.use === '条件つき');
    if (first && (k === 'work' || k === 'benefits')) first.lead = true;
  }
  if (iata.length) {
    const city = new Set(iata.map(c => (PLACES[c] || [])[0] || '')), land = new Set(iata.map(c => (PLACES[c] || [])[2] || ''));
    out.base = {
      iata, city: city.size === 1 ? [...city][0] : '', country: land.size === 1 ? [...land][0] : '',
      rows: baseRows,
    };
  }
  return out;
}

/* 先行5社ではない会社の、台帳（調べ）に在るけれどこの回では画面に出さない行の数（--status 用）。 */
export function researchHeld(slug) {
  const R = research(), cities = (R.CITY_OF || {})[slug] || [];
  const net = (R.NETWORK || {})[slug];
  const living = cities.map(c => (R.LIVING || {})[c]).filter(Boolean);
  const base = researchFacts(slug).base;
  const commute = living.flatMap(L => L.commute || []);
  return {
    destinations: net ? (net.list || []).filter(r => shown(r)).length : 0,
    cities: cities.length,
    rents: living.reduce((n, L) => n + (L.rents || []).filter(r => shown(r)).length, 0),
    commute: commute.filter(r => shown(r, { commute: true, bases: base ? base.iata : [] })).length,
    commuteAll: commute.length,
    pay: ((R.SOURCES || {})[slug] || []).filter(r => shown(r, { pay: true })).length,
  };
}

/* 色と略号が airlines-meta.js（一覧・レベリング図の配列）に無い会社の、会社ページの色と略号。
   字と色は、今の会社ページの社名の行（略号の四角と色）に在るもの（2026-10-21 に読んだ）。
   airlines-meta.js へ足すと、トップのレベリング図と世界の一覧にも出る（その2画面は別の判断）── だからここに置く。 */
export const PAGE_META = Object.freeze({
  'airx-charter': { color: '#a78bfa', code: 'AXC' },
  'eagle-jet': { color: '#5ec4ff', code: 'EJI' },
  'root-aviation': { color: '#34d399', code: 'ROOT' },
  'solairus': { color: '#3d9bff', code: 'SOL' },
});
