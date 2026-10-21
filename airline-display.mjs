/* airline-display.mjs ── 先行5社ではない会社のページに、調べの台帳（research-ledger.mjs）の行を出すときの「画面の字」の1か所
 * （全社へ広げる c・2026-10-21 リードの決め L1）。
 *
 * ★ 調べた側の字（label_ja・cond_ja・注・調べた側が書いた値の字、英語の切れ端、「SH協約」「CPT/FO」「basecode」のような内輪の略語）は、
 *   カードの字にしない。
 * ★ カードの字は2つの道からだけ作る。
 *     ITEM   … 項目ごとの言い方の表（1項目に1つ）。行の決まった欄（項目・値・単位・期間・通貨・日付・使い方）だけで言えるときに使う
 *              ── 数（日数・時間・機数・額）と日付だけ。字の値（調べた側が書いた文）はここを通らない。
 *     LINES  … 欄だけでは言えない行の字（行の ID ごと）。ここで書いた短い日本語。どの行も、その行の h（台帳の中身の指紋）を持つ。
 *              台帳の行の中身が変わる（h が変わる）と、その字は古い ── 画面に出さず（stale）、check() と assert-rollout.mjs が赤くする
 *              （書き直して h を付け直すまで）。
 *   どちらでも言えない行は出さない（airline-rollout.mjs が「画面の言い方がまだ無い」と数える）。
 * ★ 資料の名前（出どころのリンクの字）は SOURCES（資料の ID ごと）。資料自身の題（英語のページ名など）は、資料の言葉として
 *   かぎかっこの中にだけ置く。
 * ★ 過去の行は「過去」の札と日付つき・参考の行は「参考」の札つきでだけ出す（TAG）。どちらもカードの1行めにしない
 *   （その決まりは gen-airline-glance.mjs の workCell・benCell・companyCard）。
 * ★ 就航地（NET）と暮らしの街（CITY）も、ここに書いた字があるときだけ出す（無い会社は今までの「確認できていません」の形）。
 *   NET と CITY の h は、まとめた行ぜんぶの指紋（digest）── 行が1つ変わる・増える・減ると古くなる。
 *
 *   node airline-display.mjs --check   古い字・名前の無い資料を数える（赤なら exit 1）
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* 使い方の札。条件つき・募集は札なし（募集は募集の1枚に置くこと自体が言い方）。 */
export const TAG = Object.freeze({ 過去: '過去', 参考: '参考' });

/* ── 項目ごとの言い方（ITEM）──────────────────────────────────────
   label … 画面の名前（先行5社の台帳と同じ言葉を使う）
   say   … 'count'（数＋単位）／'money'（通貨つきの額）／'date'（日付）。これ以外の形の値は、この表では言わない（LINES が要る） */
export const ITEM = Object.freeze({
  annual_leave: { label: '年次休暇', say: 'count' },
  sick_leave: { label: '有給の病気休暇', say: 'count' },
  days_off: { label: '休日', say: 'count' },
  working_time: { label: '勤務時間', say: 'count' },
  medical: { label: '医療の補助', say: 'money' },
  commuting: { label: '通勤の補助', say: 'money' },
  housing: { label: '住宅の補助', say: 'money' },
  founded: { label: '設立', say: 'date' },
  first_flight: { label: '最初の便', say: 'date' },
  fleet_total: { label: '運航している機材', say: 'count' },
  pilot_base: { label: '拠点', say: 'iata' },
});
/* 単位の言い方（台帳の単位の字 → 画面の字）。表に無い単位の行は言わない。 */
const UNIT = Object.freeze({
  days: '日', day: '日', '日': '日', 'days/year': '日', 'days per year': '日',
  'calendar days': '日（暦日）', calendar_days: '日（暦日）', 'calendar days per year': '日（暦日）',
  weeks: '週間', 'weeks per year': '週間', hours: '時間', '時間': '時間', '機': '機', aircraft: '機',
});
const PER = Object.freeze({ year: '年', month: '月' });
const perOf = r => PER[r.per] || (/per year|\/year/.test(String(r.unit || '')) ? '年' : '');
const DATE_JA = /^(\d{4})年(?:(\d{1,2})月(?:(\d{1,2})日)?)?$/;
const DATE_ISO = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const dateJa = s => {
  const m = DATE_JA.exec(String(s)) || DATE_ISO.exec(String(s));
  return m ? `${m[1]}年${m[2] ? `${+m[2]}月` : ''}${m[3] ? `${+m[3]}日` : ''}` : '';
};

/* ── 欄だけでは言えない行の字（LINES）── 行の ID ごと。h はその行の台帳の指紋（変わると古い）。
   label … 画面の名前／value … 値（無ければ ITEM の言い方で値を作る）／cond … 前提の短い1行（無ければ出さない）
   lead  … その欄（勤務・待遇）のカードの1行めにする行（条件つきの行だけ）
   fleet … 機材の型式（会社の資料に載っている型式。機数は書かない） */
export const LINES = Object.freeze({
  /* ── カンタス航空 ── */
  'qantas.work.resume-training-facilities': { h: '7a56db8de960d3ad', label: '訓練の場所', value: 'ブリスベン・メルボルン・シドニー', cond: '会社の主な訓練の拠点' },
  'qantas.jobs.resume-academy-no-job-guarantee': { h: '803243cfa4d8fe32', label: '養成校を修了したあとの採用', value: '約束されていない', cond: 'Qantas Group Pilot Academy の案内（会社の答え）' },
  'qantas.fleet.a380': { h: '39a559c3f4fa478d', fleet: 'エアバス A380' },
  'qantas.fleet.b787': { h: '4003af454c0a0e8b', fleet: 'ボーイング 787-9' },
  'qantas.fleet.pub-a321xlr-fleet': { h: '1d174874da2021c5', fleet: 'エアバス A321XLR' },
  'qantas.fleet.pub-a330-200-fleet': { h: '065e9da3e34dcc6a', fleet: 'エアバス A330-200' },
  'qantas.fleet.pub-a330-300-fleet': { h: '9feeb0c044449c33', fleet: 'エアバス A330-300' },
  'qantas.fleet.pub-b737-800-fleet': { h: '92188b925b40cf33', fleet: 'ボーイング 737-800' },
  /* ── スカイマーク ── */
  'skymark.benefits.staff-travel': { h: 'e04f095532e3c2cf', label: '社員の航空券', value: '自社便の優待搭乗制度', cond: '自社養成パイロット訓練生の募集要項', lead: true },
  'skymark.benefits.missing-annual-leave': { h: '2074a5e046a83080', label: '休暇', value: '年次有給休暇と、慶弔・育児・介護などの休暇', cond: '経験者の機長候補の募集要項。日数は書かれていない' },
  'skymark.benefits.missing-commuting': { h: 'ec79978e22358264', label: '通勤', value: '公共交通か車。早朝・深夜などはタクシーを使える', cond: '経験者の機長候補の募集要項' },
  'skymark.benefits.missing-medical': { h: '17a9a4b06151cd60', label: '保険', value: '社会保険・健康保険組合・団体長期障害所得補償保険', cond: '経験者の機長候補の募集要項' },
  'skymark.jobs.cont-cadet-start': { h: '50fc5c46f7e86d6f', label: '自社養成の入社予定日', value: '2027年4月1日（または会社が指定する時期）', cond: '予定' },
  'skymark.work.cadet-hours': { h: '2873589c181b47d4', label: '訓練生の勤務時間', value: '週平均37.5時間以内（1か月単位の変形労働時間制）', cond: '自社養成パイロット訓練生の募集要項' },
  'skymark.fleet.missing-fleet-types': { h: 'b9931e917624f38f', fleet: 'ボーイング 737-800' },
  'skymark.fleet.pub-fleet-b737-8': { h: 'b930b2ada55bf942', fleet: 'ボーイング 737-8' },
  /* ── 空港までの移動（暮らしの街の行）。mode ＝ 電車・バスの札 ── */
  'qantas.living.pub-bne-transport': { h: 'a915a8178c8e4f8c', mode: 'train', label: 'Airtrain：ブリスベン中心部（Central 駅）→ 空港', value: '平日 4:31〜21:31・土日祝 5:40〜21:31（15〜30分おき）' },
  'qantas.living.pub-mel-transport': { h: '353050f3935ac078', mode: 'bus', label: 'SkyBus：サザンクロス駅 ⇄ メルボルン空港', value: '市内と空港を結ぶ City Express を運行' },
  'qantas.living.pub-syd-transport': { h: '9ec22f1f80a46bca', mode: 'train', label: '電車（T8 Airport & South Line）：市内 → シドニー空港', value: '毎日 5時〜24時に運行' },
  'qantas.living.pub-syd-transport-n20-bus': { h: '8a24a6f484e2c48e', mode: 'bus', label: '深夜バス N20：市内 → シドニー空港（国際線ターミナル経由）', value: '0時〜4時に運行' },
});

/* ── 資料の名前（出どころのリンクの字）── 資料の ID ごと。資料自身の題は「」の中（資料の言葉）。 */
export const SOURCES = Object.freeze({
  'src-qantas-about': 'カンタス航空「About us」',
  'src-qantas-pub-a321xlr-fleet': 'カンタス航空「Airbus A321XLR」（機材の紹介）',
  'src-qantas-pub-a330-200-fleet': 'カンタス航空「Airbus A330」（機材の紹介）',
  'src-qantas-pub-b737-800-fleet': 'カンタス航空「Boeing 737」（機材の紹介）',
  'src-qantas-resume-academy-faq': 'カンタス航空「Qantas Group Pilot Academy FAQs」',
  'src-qantas-resume-training-facilities': 'カンタス航空「Flight training」',
  'src-qantas-pub-syd-code-company': 'カンタス航空「Flights to Sydney」',
  'src-qantas-pub-brisbane-rent-rta': 'クイーンズランド州 住宅賃貸局（RTA）「Bond statistics」',
  'src-qantas-pub-sydney-rent-government': 'ニューサウスウェールズ州 地域社会・司法省「Rent tables」（2026年6月四半期）',
  'src-qantas-pub-bne-transport': 'Airtrain「Frequency & Hours」',
  'src-qantas-pub-mel-transport': 'SkyBus「Melbourne City Express」',
  'src-qantas-pub-syd-transport': 'ニューサウスウェールズ州交通局「Getting to and from Sydney Airport」',
  'src-skymark-pub-captain-current': 'スカイマーク「B737機長候補者（他社経験者）」',
  'src-skymark-cadet-2027': 'スカイマーク「自社養成パイロット訓練生 募集要項」',
  'src-skymark-pub-fleet-list': 'スカイマーク「航空機のご紹介」',
  'src-skymark-profile': 'スカイマーク「会社概要」',
  'src-skymark-pub-summer-dest': 'スカイマーク「2026年6月1日～10月24日 時刻表」',
  'src-skymark-pub-nilim-airport-codes': '国土交通省 国土技術政策総合研究所「国内空港3レター一覧」',
});

/* ── 就航地（NET）── 調べで確かめた就航地の一覧（会社全体の就航地とは限らない）。
   basis … 何の一覧か（出典の「条件」に出す1行）。h … まとめた行ぜんぶの指紋（digest）。 */
export const NET = Object.freeze({
  skymark: { h: 'fcff7b659fe42d55', basis: '2026年夏ダイヤ（6月1日〜10月24日）の時刻表で、スカイマークが自社便を飛ばしている空港。拠点の空港は入れていません。' },
  /* ⚠️ いまの台帳の行は SYD の1つだけで、SYD はカンタスの拠点（本拠地は一覧に入れない）── 画面には就航地の一覧が出ない（2026-10-21）。 */
  qantas: { h: '965d1d7ace2efd6f', basis: 'カンタス航空の機材の紹介（A321XLR）に行き先として載っている空港' },
});

/* ── 暮らしの街（CITY）── 調べの台帳の街（拠点の空港ごと）。先行5社の台帳に在る街（東京など）はここに書かない（そちらを使う）。
   rents … 家賃の行の ID（間取りの鍵ごと）。h … 家賃と移動の行ぜんぶの指紋（digest）。
   per   … 家賃の期間（資料の表が週あたり ＝ 'week'。台帳の per 欄には週が無いので、ここで言う）。
   measure … 何の額か（カードの見出しに入る短い字）。site … 資料の名前（短く）。
   scope … 数字の範囲の断り（出典の「条件」に出す1行。資料の区域・何の物件か・間取りの数え方）。 */
export const CITY = Object.freeze({
  brisbane: { h: 'fea01c5db19eb55c', ja: 'ブリスベン', en: 'Brisbane', iata: 'BNE', airport: 'ブリスベン空港',
    measure: '新規契約の家賃の中央値', site: 'クイーンズランド州 住宅賃貸局', per: 'week',
    scope: 'ブリスベン市（City of Brisbane）の区域で、新しく結ばれたアパート（flat）の賃貸契約の家賃の中央値。1-Bed・2-Bed は寝室の数' },
  melbourne: { h: '0955d463f69ccc37', ja: 'メルボルン', en: 'Melbourne', iata: 'MEL', airport: 'メルボルン空港' },
  sydney: { h: '0b22d3faad7e3382', ja: 'シドニー', en: 'Sydney', iata: 'SYD', airport: 'シドニー空港',
    measure: '新規契約の家賃の中央値', site: 'ニューサウスウェールズ州 地域社会・司法省', per: 'week',
    scope: 'シドニー市（City of Sydney）の区域で、新しく結ばれたアパート・ユニットの賃貸契約の家賃の中央値（シドニー都市圏ぜんたいの数字ではない）。1-Bed・2-Bed は寝室の数' },
});

/** 行の並びの指紋（ID と h。並びに依らない）。NET・CITY の h はこれ。 */
export const digest = rows => crypto.createHash('sha256').update(rows.map(r => `${r.id}:${r.h}`).sort().join('\n')).digest('hex').slice(0, 16);

/** 資料の名前。無ければ台帳の 発行元「題」（引用として）。 */
export function srcName(s) {
  if (s && SOURCES[s.source_id]) return SOURCES[s.source_id];
  return s && s.title ? `${s.publisher}「${s.title}」` : (s && s.publisher) || '';
}

/** その行の LINES が古いか（無ければ false）。 */
export const stale = r => !!(LINES[r.id] && LINES[r.id].h !== r.h);

/* ITEM の言い方で値を作る（言えなければ ''）。 */
function itemValue(r) {
  const it = ITEM[r.key];
  if (!it) return '';
  if (it.say === 'iata') return typeof r.value === 'string' && /^[A-Z]{3}$/.test(r.value) ? r.value : '';
  if (it.say === 'date') return typeof r.value === 'string' ? dateJa(r.value) : '';
  if (typeof r.value !== 'number' || !(r.value > 0)) return '';
  if (it.say === 'money') return r.currency && !r.unit && PER[r.per] ? { per: PER[r.per], cur: r.currency, n: r.value } : '';
  if (r.currency) return '';
  const u = r.unit ? UNIT[r.unit] : '';
  if (r.unit && !u) return '';
  if (!u) return '';
  const head = it.say === 'count' && u === '機' ? '' : perOf(r);
  return `${head}${r.value.toLocaleString('en-US')}${u}`;
}

/**
 * 1行を画面の字にする。言えないとき（ITEM にも LINES にも無い・LINES が古い）は null。
 *   { label, value, cur, cond, lead, tag, fleet, mode }
 *   value が通貨つきの額のときは value ＝ 数・cur ＝ 通貨・per ＝ 月か年（画面は「月 ZAR 4,000」と円の目安）。
 */
export function say(r) {
  const L = LINES[r.id];
  if (L && L.h !== r.h) return null;                       // 古い字は出さない（書き直すまで）
  const tag = TAG[r.use] || '';
  if (L) {
    if (L.fleet) return { fleet: L.fleet, label: L.fleet, value: '', cond: '', tag, lead: false };
    const v = L.value || itemValue(r);
    if (!L.label || !v) return null;
    return typeof v === 'object'
      ? { label: L.label, value: v.n, cur: v.cur, per: v.per, cond: L.cond || '', lead: !!L.lead && !tag, tag, mode: L.mode || '' }
      : { label: L.label, value: v, cond: L.cond || '', lead: !!L.lead && !tag, tag, mode: L.mode || '' };
  }
  const it = ITEM[r.key], v = itemValue(r);
  if (!it || !v) return null;
  return typeof v === 'object'
    ? { label: it.label, value: v.n, cur: v.cur, per: v.per, cond: '', lead: false, tag }
    : { label: it.label, value: v, cond: '', lead: false, tag };
}

/* ここで書く字に入れてはいけない語。「よくある質問」は gen-faq.mjs がページの FAQ を探す目印 ──
   新しい部品の字に在ると、その位置から下の <details> を FAQ と読み、検索向けの FAQPage を作り違える（2026-10-21 に踏んだ）。 */
export const NEVER = Object.freeze(['よくある質問']);
/** 古い字・名前の無い資料（store ＝ 調べの台帳）。[{ what, id, why }]。 */
export function check(store) {
  const bad = [];
  const words = [...Object.entries(LINES).flatMap(([id, L]) => [L.label, L.value, L.cond, L.fleet].map(t => [id, t])),
    ...Object.entries(SOURCES), ...Object.entries(NET).map(([id, N]) => [id, N.basis]),
    ...Object.entries(CITY).flatMap(([id, C]) => [C.ja, C.measure, C.site, C.airport, C.scope].map(t => [id, t])), ...Object.entries(ITEM).map(([id, I]) => [id, I.label])];
  for (const [id, t] of words) for (const w of NEVER) if (typeof t === 'string' && t.includes(w)) bad.push({ what: 'NEVER', id, why: `「${w}」を字に入れない（${t}）` });
  const byId = new Map();
  for (const F of Object.values(store.FACTS || {})) for (const rows of Object.values(F)) for (const r of rows || []) byId.set(r.id, r);
  for (const N of Object.values(store.NETWORK || {})) for (const r of N.list || []) byId.set(r.id, r);
  for (const L of Object.values(store.LIVING || {})) for (const k of ['rents', 'commute', 'towns']) for (const r of L[k] || []) byId.set(r.id, r);
  for (const [id, L] of Object.entries(LINES)) {
    const r = byId.get(id);
    if (!r) bad.push({ what: 'LINES', id, why: '台帳に無い行' });
    else if (r.h !== L.h) bad.push({ what: 'LINES', id, why: `台帳の行が変わった（${L.h} → ${r.h}）── 字を書き直して h を付け直す` });
  }
  for (const [slug, N] of Object.entries(NET)) {
    const list = ((store.NETWORK || {})[slug] || {}).list || [];
    const d = digest(list);
    if (!list.length) bad.push({ what: 'NET', id: slug, why: '台帳に就航地の行が無い' });
    else if (d !== N.h) bad.push({ what: 'NET', id: slug, why: `就航地の行が変わった（${N.h} → ${d}）── basis を読み直して h を付け直す` });
  }
  for (const [city, C] of Object.entries(CITY)) {
    const L = (store.LIVING || {})[city];
    if (!L) { bad.push({ what: 'CITY', id: city, why: '台帳に街が無い' }); continue; }
    const d = digest([...(L.rents || []), ...(L.commute || [])]);
    if (d !== C.h) bad.push({ what: 'CITY', id: city, why: `街の行が変わった（${C.h} → ${d}）── 字を読み直して h を付け直す` });
  }
  return bad;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--check')) {
  const { readStore } = await import('./import-research-pack.mjs');
  const bad = check(readStore(fileURLToPath(new URL('.', import.meta.url))).store);
  for (const b of bad) console.log(`❌ ${b.what} ${b.id}: ${b.why}`);
  console.log(bad.length ? `❌ airline-display: ${bad.length}件` : `✅ airline-display: LINES ${Object.keys(LINES).length}行・NET ${Object.keys(NET).length}社・CITY ${Object.keys(CITY).length}街・資料の名前 ${Object.keys(SOURCES).length}件（どれも台帳の今の行と合っている）`);
  process.exit(bad.length ? 1 : 0);
}
