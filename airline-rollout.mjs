/* airline-rollout.mjs ── 会社ページを全社へ広げるときの「1か所」（2026-10-21・全社へ広げる b）。
 *
 *   SWITCH      … 新しい会社ページ（gen-airline-glance.mjs が書く形）を持つ会社。★ここに足した会社だけが書き直される。
 *                 足していない会社のページは1文字も変わらない（gen-airline-glance.mjs は SWITCH の会社しか開かない）。
 *   LEAD        … 先行5社。台帳を手で作った会社（airline-facts.mjs・career-facts.mjs・living-facts.mjs・airline-destinations.mjs）。
 *                 この5社のページは、今までの決め方のまま1文字も変わらない（オーナーの判断で「よくある質問」も外したまま）。
 *   why(row)    … 調べの台帳（research-ledger.mjs）の1行を、画面に出してよいか。出さない理由を返す（'' ＝ 出してよい）。★ここ1か所だけ。
 *   researchFacts(slug) … 先行5社ではない会社の「会社の事実」を、調べの台帳から、画面の部品が読む形にする。
 *   researchNetwork(slug) / researchCities(slug, bases) … 調べで確かめた就航地・拠点の街（字が airline-display.mjs に在る会社だけ）。
 *
 * ★ 画面に出してよい行（オーナー 2026-10-19／リード 2026-10-20）
 *   ・使い方が 条件つき／募集／過去／参考 のどれかの行だけ。保留・空欄・未指定は出さない（使い方の無い行も出さない）。
 *   ・募集の行は募集として（募集の1枚にだけ）。過去の行は、その日付と一緒にだけ（日付の無い過去の行は出さない）。
 *     参考の行は、最初の1画面の1行（lead）にしない。
 *   ・過去の行は「過去」の札と日付・参考の行は「参考」の札つきでだけ出す（言い方は airline-display.mjs の TAG）。
 *     どちらもカードの1行め（lead）にしない・カードの小さい2行（also）にも置かない（gen-airline-glance.mjs）。
 *   ・機長と副操縦士を分けない給与（運航乗務員の平均・全社員の平均など）は、使い方が何でも出さない（P12.77）。
 *   ・空港までの移動の行は、その会社の拠点の空港の行だけ（同じ街の行でも、別の空港の行は出さない。空港が決まらない行も出さない）。
 * ★ 調べた側の字（label_ja・cond_ja・調べた側が書いた値の字）は画面に出さない（リード 2026-10-21 L1）。
 *   画面の字は airline-display.mjs の say() だけが作る（項目の言い方の表 ITEM か、行ごとに書いた字 LINES）。言えない行は出さない。
 *   会社が公表している条件の欄に置くのは、会社自身の資料の行だけ（gen-airline-glance.mjs の「会社が公表している条件」の決まり）。
 * ★ 機材は型式だけ（機数を作らない・機数の無い型式に数を付けない）。条件つきの行だけ。
 * ★ 就航地と暮らしの街は、airline-display.mjs に字（NET・CITY）が在る会社だけ。就航地は「調べで確かめた就航地」として出す
 *   （会社全体の就航地とは言わない）。街は拠点の空港の順・1つの街に1つの資料。移動の行はその街の拠点の空港の行だけ。
 *   どれも数は gen-airline-glance.mjs --status が言う（台帳に在る ≠ 画面に出る）。
 */
import { fileURLToPath } from 'node:url';
import { readStore } from './import-research-pack.mjs';
import { PLACES } from './airline-destinations.mjs';
import { say, srcName, NET, CITY, LINES, digest, agreementOf, rankOf, AD_TAG, AD_TAG_EN, countryEn } from './airline-display.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/** 先行5社（手で作った台帳を持つ会社）。並びは今までの GLANCE と同じ。 */
export const LEAD = Object.freeze(['jal', 'ana', 'cathay-pacific', 'etihad', 'eva-air']);
/** 新しい会社ページを持つ会社。★1か所。見本の2社（カンタス航空・スカイマーク）は「全社へ広げる c」（2026-10-21）で足した。 */
export const SAMPLES = Object.freeze(['qantas', 'skymark']);
/** 全社へ広げる d1（2026-10-21・リード P12.82／P12.84）：地域ごとに足す。並びは年収の正本（SALARY）の地域の中の順。
    ★スピリット航空は入れない（オーナー 2026-10-11「スピリットを外す」）。d2（2026-10-22）で ヨーロッパ・アメリカ大陸・オセアニアを足した
    ＝ 年収の正本の 112社のうち、古い形のページはスピリット航空だけ。 */
export const WIDE = Object.freeze([
  /* 日本 */
  'zipair', 'jetstar-japan', 'peach', 'solaseed', 'spring-japan', 'airdo', 'starflyer', 'fda', 'airjapan', 'amx', 'ana-wings',
  'daiichi-air', 'hac', 'ibex', 'j-air', 'jac', 'jta', 'orc', 'rac', 'shin-central', 'shin-nihon', 'toho-air', 'toki-air',
  /* アジア（キャセイパシフィック航空・エバー航空は先行5社） */
  'singapore-airlines', 'korean-air', 'asiana', 'starlux', 'china-airlines', 'thai-airways', 'air-china', 'china-eastern',
  'china-southern', 'hainan-airlines', 'root-aviation', 'air-india', 'airasia', 'bamboo-airways', 'batik-air', 'garuda-indonesia',
  'hong-kong-express', 'indigo', 'malaysia-airlines', 'philippine-airlines', 'scoot', 'vietjet', 'vietnam-airlines', 'royal-brunei',
  /* 中東（エティハド航空は先行5社）・アフリカ */
  'emirates', 'qatar-airways', 'gulf-air', 'kuwait-airways', 'oman-air', 'riyadh-air', 'royal-jordanian', 'saudia',
  'egyptair', 'ethiopian-airlines', 'kenya-airways', 'south-african-airways',
  /* 全社へ広げる d2（2026-10-22）：ヨーロッパ（運航会社の airx-charter・eagle-jet を含む） */
  'klm', 'air-france', 'lufthansa', 'british-airways', 'airx-charter', 'eagle-jet', 'turkish-airlines', 'aegean', 'aer-lingus',
  'austrian', 'easyjet', 'eurowings', 'finnair', 'iberia', 'icelandair', 'ita-airways', 'lot', 'norwegian', 'ryanair', 'sas', 'swiss',
  'tap', 'virgin-atlantic', 'vueling', 'wizz-air',
  /* アメリカ大陸（北米・中南米。スピリット航空は入れない ── オーナー 2026-10-11） */
  'united', 'delta', 'american', 'southwest', 'air-canada', 'solairus', 'alaska-airlines', 'allegiant', 'breeze-airways', 'frontier',
  'jetblue', 'porter', 'westjet', 'aeromexico', 'avianca', 'copa-airlines', 'latam',
  /* オセアニア（カンタス航空は見本の2社） */
  'air-new-zealand', 'fiji-airways', 'jetstar',
]);
export const SWITCH = Object.freeze([...LEAD, ...SAMPLES, ...WIDE]);
/** 英語の会社ページ（en/airlines/）を新しい形で書く会社（2026-10-23 英語の EN-6）。★ここに足した会社だけ、gen-airline-glance.mjs が
    英語のページを書き直す。2026-10-23 英語の EN-7 で先行5社と見本の2社（カンタス航空・スカイマーク）を足した。
    2026-10-23 英語の EN-8 で SWITCH の全部（111社）にした ＝ 日本語が新しい形の会社は、英語のページも新しい形。
    SWITCH に無い会社（スピリット航空）は足さない（日本語のページが古い形のまま）。 */
export const EN_SWITCH = Object.freeze([...SWITCH]);
/** 画面に出してよい使い方。 */
export const SHOWN = Object.freeze(['条件つき', '募集', '過去', '参考']);
/** 画面の言い方が在る使い方（2026-10-21 全社へ広げる c から4つとも。過去・参考は札つき ── airline-display.mjs の TAG）。 */
export const WORDED = Object.freeze([...SHOWN]);

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

/* 資料の種類（調べた側の publisher_kind）→ 画面の種類（career-facts.mjs の SRC_KINDS の鍵）。在るのは会社と政府の2つだけ。
   ★労働協約（airline-display.mjs の AGREEMENTS に在る資料）は 'agreement'（2026-10-21 リードの決め d）── 会社の公表とも
     政府の資料とも別の種類。画面は「労働協約」の札とその協約の名前で出す（gen-airline-glance.mjs）。 */
const KIND = { airline: 'company', government: 'gov' };
const srcOf = (r, lang = 'ja') => {
  const s = (r.src || [])[0];
  if (!s || !/^https:\/\//.test(s.url || '')) return null;
  return { name: srcName(s, lang), url: s.url, kind: agreementOf(s) ? 'agreement' : KIND[s.publisher_kind] || s.publisher_kind || '' };
};

/* 調べの1行 → 画面の部品が読む事実の形（airline-facts.mjs の行と同じ鍵）。字は airline-display.mjs の say() だけ
   （調べた側の名前・値・条件の字は通さない）。言えない行・資料の住所が無い行は null。 */
function asFact(r) {
  const src = srcOf(r), d = say(r);
  if (!d || !src) return null;
  /* 前提の1行：行ごとの字（LINES）の cond。無ければ、労働協約の行はその協約が誰の条件か（AGREEMENTS の cond） */
  const ag = agreementOf((r.src || [])[0]);
  return {
    key: r.key, ja: d.label, value: d.value, unit: '', cur: d.cur || '', per: d.per || '', at: dateOf(r), as_of: r.checked_at || '',
    cond_ja: d.cond || (ag ? ag.cond : ''), src, pilot: !(r.applies_to && r.applies_to.pilot_specific === false),
    use: r.use, tag: d.tag, id: r.id, h: r.h, lead: !!d.lead, fleet: d.fleet || '', rank: rankOf(r), order: (LINES[r.id] && LINES[r.id].order) || 0,
  };
}

/**
 * 先行5社ではない会社の「会社の事実」（調べの台帳から）。
 *   base     … 拠点の空港（3字）と街。使い方が 条件つき・募集 で、会社か政府の資料の行だけ。
 *              拠点の空港の行が無い会社は、パイロットの拠点の街の行（pilot_base_city。字は airline-display.mjs の街の表）の街（2026-10-21 a2）。
 *   work / benefits / jobs / profile / scale … 画面の部品が読む事実の形の並び（lead は字の表が決めた「条件つき」の行か、
 *              無ければ最初の「条件つき」の1行だけ）。過去・参考の行は札つき（tag）で並び、lead にならない
 *              年金（pension）は待遇・ロスターの型・訓練費の返還・年間休日は勤務・本社（国か都市）は会社の欄（a2。言い方の無い行は出ない）
 *   fleet    … 機材の型式（条件つきの行だけ・機数は持たない）
 *   held     … 出さなかった行と、その理由と、置き場（sec ＝ 台帳の分野。--status が数える）
 *   R        … 調べの台帳（既定はリポジトリの research-ledger.mjs。検査が写しの台帳を渡す）
 */
export function researchFacts(slug, R = research(), lang = 'ja') {
  const out = factsJa(slug, R);
  return lang === 'en' ? factsEn(out, slug, R) : out;
}
/* 英語の事実（2026-10-22 d2 ＝ EN-2）：日本語で決めた並び・1行め・置き場はそのまま（決め方は日本語の字で1回だけ）、画面の字だけを
   英語の対に替える（airline-display.mjs の say(r, 'en')・srcName(s, 'en')）。英語の対の無い行は出さず、出さない行に理由つきで数える。 */
function factsEn(J, slug, R) {
  const F = (R.FACTS || {})[slug] || {}, byId = new Map();
  for (const [sec, rows] of Object.entries(F)) for (const r of rows || []) byId.set(r.id, [r, sec]);
  const held = [...J.held];
  const one = f => {
    const [r, sec] = byId.get(f.id) || [];
    const e = r && say(r, 'en'), src = r && srcOf(r, 'en');
    if (!e || !src || !src.name) { held.push({ id: f.id, why: '英語の言い方がまだ無い（airline-display.mjs の英語の対）', sec: sec || '' }); return null; }
    const ag = agreementOf((r.src || [])[0]);
    return { ...f, ja: e.label, value: e.value, cur: e.cur || '', per: e.per || '', cond_ja: e.cond || (ag ? ag.cond_en || '' : ''), src,
      tag: f.tag === AD_TAG ? AD_TAG_EN : e.tag, fleet: e.fleet || '' };
  };
  const list = l => l.map(one).filter(Boolean);
  const out = { ...J, work: list(J.work), benefits: list(J.benefits), jobs: list(J.jobs), profile: list(J.profile), scale: list(J.scale), fleet: list(J.fleet), held };
  if (J.base) {
    const iata = J.base.iata || [];
    const city = new Set(iata.map(c => (PLACES[c] || [])[1] || '')), land = new Set(iata.map(c => countryEn((PLACES[c] || [])[2] || '')));
    out.base = { ...J.base, rows: list(J.base.rows),
      city: iata.length ? (city.size === 1 ? [...city][0] : '') : '', country: iata.length ? (land.size === 1 ? [...land][0] : '') : '' };
    /* 拠点が街だけの会社の街の名前（日本語の街の名前 → 空港の呼び名の表の英語。2通りに読めれば言わない） */
    if (!iata.length && J.base.city) {
      const en = J.base.city.split('・').map(c => { const e = new Set(Object.values(PLACES).filter(p => String(p[0]).replace(/（.*$/, '') === c).map(p => String(p[1]))); return e.size === 1 ? [...e][0] : ''; });
      out.base.city = en.every(Boolean) ? en.join(', ') : '';
    }
  }
  return out;
}
function factsJa(slug, R) {
  const F = (R.FACTS || {})[slug] || {};
  const out = { base: null, work: [], benefits: [], jobs: [], profile: [], scale: [], fleet: [], held: [] };
  const iata = [], baseRows = [], cities = [], cityRows = [];
  /* 会社の募集の行のうち、台帳の分野が勤務・待遇のもの（下の「今の公表が無い欄」で使う） */
  const ads = { work: [], benefits: [] };
  for (const [sec, rows] of Object.entries(F)) {
    const hold = (r, w) => out.held.push({ id: r.id, why: w, sec });
    for (const r of rows || []) {
      const w = why(r);
      if (w) { hold(r, w); continue; }
      if (!WORDED.includes(r.use)) { hold(r, `「${r.use}」の行の言い方が無い`); continue; }
      const f = asFact(r);
      if (!f) { hold(r, srcOf(r) ? '画面の言い方がまだ無い（airline-display.mjs の ITEM にも LINES にも無いか、LINES の字が古い）' : '資料の住所が無い'); continue; }
      if (sec === 'fleet') {
        if (!f.fleet) { hold(r, '機材の型式の字が無い（airline-display.mjs の LINES の fleet）'); continue; }
        if (r.use !== '条件つき') { hold(r, `機材は条件つきの行だけ（「${r.use}」）`); continue; }
        /* 会社の1枚の「会社の資料に載っている型式」── 会社か政府の資料の行だけ（2026-10-21 d1） */
        if (!['company', 'gov'].includes(f.src.kind)) { hold(r, '機材は会社か政府の資料の行だけ'); continue; }
        /* 同じ型式は1つだけ（型式の数を作らない・同じ札を2つ並べない） */
        if (out.fleet.some(x => x.fleet === f.fleet)) { hold(r, `同じ型式がもう在る（${f.fleet}）`); continue; }
        out.fleet.push(f);
        continue;
      }
      if (sec === 'base') {
        if (!['条件つき', '募集'].includes(r.use)) { hold(r, `拠点に「${r.use}」の行は使わない`); continue; }
        if (!['company', 'gov', 'agreement'].includes(f.src.kind)) { hold(r, '拠点は会社か政府の資料・労働協約の行だけ'); continue; }
        if (r.key === 'pilot_base_city') { if (!cities.includes(f.value)) cities.push(f.value); cityRows.push([r, f]); continue; }
        if (!/^[A-Z]{3}$/.test(String(r.value))) { hold(r, '拠点の値が空港の3字ではない'); continue; }
        if (!iata.includes(r.value)) iata.push(r.value);
        baseRows.push(f);
        continue;
      }
      const place = r.use === '募集' ? 'jobs' : sec;
      if (!(place in out) || place === 'held' || place === 'base') { hold(r, `置き場が無い（${sec}）`); continue; }
      const company = f.src.kind === 'company', agreement = f.src.kind === 'agreement';
      /* 勤務・待遇の欄は、会社自身の資料か労働協約（リードの決め d）の行だけ。募集の1枚は会社自身の資料の行だけ */
      if (place === 'jobs' && !company) { hold(r, '募集の1枚には、会社自身の資料の行だけ'); continue; }
      if (['work', 'benefits'].includes(place) && !company && !agreement) { hold(r, '勤務・待遇の欄には、会社自身の資料か労働協約の行だけ'); continue; }
      if (['profile', 'scale'].includes(place) && !['company', 'gov'].includes(f.src.kind)) { hold(r, '会社の数字は、会社か政府の資料の行だけ'); continue; }
      out[place].push(f);
      if (place === 'jobs' && sec in ads) ads[sec].push(f);
    }
  }
  /* 同じ話は1行だけ（2026-10-23）：字の表（LINES）の same が名指す行が同じ欄に出ているときは、same を持つ行を出さない
     （ユナイテッド航空の採用ページの「保険」と、労働協約の「保険（医療・歯科など）」── 資料の強い・中身の細かい行を残す）。
     名指した行が出ない日（台帳の行が変わって字が古い など）は外さない ＝ 話題を無くさない。台帳の行は消さない。 */
  for (const k of ['work', 'benefits']) out[k] = out[k].filter(f => {
    const by = LINES[f.id] && LINES[f.id].same;
    if (!by || !out[k].some(x => x.id === by)) return true;
    out.held.push({ id: f.id, why: `同じ話を、ほかの行（${by}）が言う`, sec: k });
    return false;
  });
  /* 並び：条件つき → 参考 → 過去（台帳の順のまま）。
     最初の1画面の1行（lead）は「条件つき」の行だけ ── 字の表（LINES の lead）が決めていればその行、無ければ最初の「条件つき」の行。 */
  const ORDER = { 条件つき: 0, 募集: 0, 参考: 1, 過去: 2 };
  for (const k of ['work', 'benefits', 'jobs', 'profile', 'scale']) {
    /* 同じ使い方の中は台帳の順。字の表（LINES）が order を持つ行（勤続の段ごとの休暇のように、続き番号のある行）だけ、その順に並べ直す
       （2026-10-22 全社へ広げる e。order の無い行は 0 ＝ 今までの順のまま） */
    out[k] = out[k].map((f, i) => [f, i]).sort(([a, i], [b, j]) => ORDER[a.use] - ORDER[b.use] || (a.order || 0) - (b.order || 0) || i - j).map(([f]) => f);
    const said = out[k].filter(f => f.lead);
    for (const f of out[k]) f.lead = false;
    /* ★訓練生の行は、名前が訓練の話と言っている行（「訓練生の休日」「訓練の場所」）でなければ1行めにしない
       （2026-10-21 d1「訓練生の数を、どのパイロットにも当てはまるように1行めに出さない」── 狭い画面の1行めは前提の行を出さない） */
    const whose = f => f.rank !== 'trainee' || /^訓練/.test(f.ja);
    const first = (said[0] && said[0].use === '条件つき' && whose(said[0]) ? said[0] : null) || out[k].find(f => f.use === '条件つき' && whose(f));
    if (first && (k === 'work' || k === 'benefits')) first.lead = true;
  }
  /* ★今の公表が無い欄（勤務・待遇のカードの1行めが選べない）に、会社自身の募集の行だけが在るときは、その行を「募集」の札と
     その募集の前提（誰の・どの募集か・日付）つきでカードに出す（2026-10-21 リード d2「確認できていません」と言わない）。
     行は募集の1枚にも残る（募集の全部はあちらが並べる）。札の字は airline-display.mjs の AD_TAG。 */
  for (const k of ['work', 'benefits']) {
    if (out[k].some(f => f.lead) || !ads[k].length) continue;
    const add = ads[k].map(f => ({ ...f, tag: AD_TAG, lead: false }));
    /* 訓練生の行しか無いときは、その行が1行め（募集の札と前提の1行が、誰の募集の条件かを言う） */
    (add.find(f => f.rank !== 'trainee' || /^訓練/.test(f.ja)) || add[0]).lead = true;
    out[k] = [...add, ...out[k]];
  }
  /* 本社は1行だけ（会社の欄）：都市が言えれば都市（国は重ねない）・無ければ国。同じ項目が2行あれば最初の1行（並びは上の順）。 */
  const HQ = ['headquarters_city', 'headquarters_country'];
  const hq = HQ.map(k => out.profile.find(f => f.key === k)).find(Boolean);
  out.profile = out.profile.filter(f => {
    if (!HQ.includes(f.key) || f === hq) return true;
    out.held.push({ id: f.id, why: '本社は1行だけ（都市が在れば都市・無ければ国）', sec: 'profile' });
    return false;
  });
  if (iata.length) {
    const city = new Set(iata.map(c => (PLACES[c] || [])[0] || '')), land = new Set(iata.map(c => (PLACES[c] || [])[2] || ''));
    out.base = {
      iata, city: city.size === 1 ? [...city][0] : '', country: land.size === 1 ? [...land][0] : '',
      rows: baseRows,
    };
    /* 拠点の空港の行が在る会社の街は、空港から（街の行は重ねない） */
    for (const [r] of cityRows) out.held.push({ id: r.id, why: '拠点の空港の行が在る（街は空港の呼び名から）', sec: 'base' });
  } else if (cities.length) {
    /* 拠点の空港の行が無い会社：パイロットの拠点の街（字はサイトの街の表）。空港の3字は作らない（どの空港かは行が言っていない）。
       ★その街の空港（台帳の空港の一覧 PLACES で、街の名前がその街の空港 ── 東京なら羽田と成田）は home に持つ（2026-10-21 d1）。
         就航地の一覧から外すためだけに使う（拠点の空港を就航地として並べない）。拠点の空港としては出さない・暮らしの街にも使わない。 */
    const home = Object.entries(PLACES).filter(([, p]) => cities.includes(String(p[0]).replace(/（.*$/, ''))).map(([c]) => c);
    out.base = { iata: [], city: cities.join('・'), country: '', rows: cityRows.map(([, f]) => f), home };
  }
  return out;
}

/**
 * 調べで確かめた就航地（airline-display.mjs の NET に字が在る会社だけ。無ければ null）。
 *   形は airline-destinations.mjs の networkOf と同じ。partial: true ＝ 会社全体の就航地とは限らない（画面はそう言わない）。
 *   空港は台帳の空港の一覧（PLACES）に在る3字だけ。無い空港は held。
 *   home ＝ その会社の拠点の空港（3字の並び）。★本拠地は一覧に入れない ── 先行5社と同じ決まり（airline-destinations.mjs の
 *   home ／ db/stays.sql の pv_stay_network「本拠地は入れない」）。就航地は拠点から飛んでいく先で、拠点の空港のホテルを就航地として
 *   並べない（2026-10-21 全社へ広げる c の直し）。拠点を外して1つも残らない会社は null（今までの「…確認してから開きます。」）。
 */
export function researchNetwork(slug, REGIONS, home = [], lang = 'ja') {
  const N = NET[slug], list0 = ((research().NETWORK || {})[slug] || {}).list || [];
  if (!N || !list0.length || digest(list0) !== N.h) return null;
  const order = Object.fromEntries(REGIONS.map(([k], i) => [k, i]));
  const rows = [], held = [];
  for (const r of list0) {
    const w = why(r), code = typeof r.value === 'string' ? r.value : '';
    if (w) { held.push({ key: code || r.id, name: code, why: w }); continue; }
    if (home.includes(code)) continue;
    if (!/^[A-Z]{3}$/.test(code) || !PLACES[code]) { held.push({ key: code || r.id, name: code, why: '空港の名前が台帳に無い' }); continue; }
    if (!rows.some(x => x.iata === code)) rows.push({ iata: code, r });
  }
  if (!rows.length) return null;
  const list = rows.map(({ iata }) => { const [city, en, country, region] = PLACES[iata]; return lang === 'en' ? { iata, city: en, en, country: countryEn(country), region, seasonal: false } : { iata, city, en, country, region, seasonal: false }; })
    .sort((a, b) => order[a.region] - order[b.region]);
  const regions = REGIONS.filter(([k]) => list.some(d => d.region === k)).map(([key, label]) => ({ key, label, n: list.filter(d => d.region === key).length }));
  const src = [...new Map(rows.flatMap(({ r }) => (r.src || []).filter(s => /^https:\/\//.test(s.url || '')).map(s => [s.url, { name: srcName(s, lang), url: s.url }]))).values()];
  const at = rows.map(({ r }) => r.checked_at || '').filter(Boolean).sort().pop() || '';
  return { home: [...home], at, src, basis: lang === 'en' ? N.basis_en : N.basis, list, regions, held, partial: true };
}

/**
 * 拠点の街（調べの台帳の街のうち、airline-display.mjs の CITY に字が在る街）。bases ＝ その会社の拠点の空港の並び（この順に返す）。
 *   rents   … 家賃の行（why を通り・字の表の街の資料の行）。間取りの鍵（studio・1bed…）ごとに1つ
 *   commute … 空港までの移動の行（why を通り・その街の空港の行で・LINES に字が在る行）
 *   R / CT  … 調べの台帳と街の字の表（既定はリポジトリの research-ledger.mjs と airline-display.mjs の CITY。検査が写しを渡す）
 */
export function researchCities(slug, bases, R = research(), CT = CITY, lang = 'ja') {
  const out = [];
  for (const iata of bases) {
    const city = Object.keys(CT).find(c => (CT[c].iata === iata || (CT[c].also || []).includes(iata)) && ((R.CITY_OF || {})[slug] || []).includes(c));
    const L = city && (R.LIVING || {})[city];
    if (!L || digest([...(L.rents || []), ...(L.commute || [])]) !== CT[city].h) continue;
    const rents = (L.rents || []).filter(r => !why(r) && r.value && typeof r.value === 'object' && srcOf(r));
    /* 英語（lang 'en'）は、移動の行の字も資料の名前も英語の対（対の無い行は出さない）。街の字は C の *_en */
    const commute = (L.commute || []).filter(r => !why(r, { commute: true, bases: [iata] }) && say(r) && srcOf(r) && (lang !== 'en' || say(r, 'en')))
      .map(r => ({ r, d: say(r, lang), src: srcOf(r, lang) }));
    out.push({ city, iata, C: CT[city], rents: rents.map(r => ({ r, src: srcOf(r, lang) })), commute });
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

/* 色と略号は airlines-meta.js の1か所（2026-10-21 全社へ広げる c で、足りなかった4社もそちらへ足した。ここに写しを持たない）。 */
