/* pv-airline-view.mjs — 新しい会社ページ（主要5社と、airline-rollout.mjs の SWITCH に足した会社）が読む、ただ1つのデータの読み口。
 *
 *   viewOf(slug) … 1社ぶんを、ページがそのまま並べられる形で返す（先行5社 ＝ 下の6つの台帳／ほかの会社 ＝ rolloutView）
 *   AXIS … 棒の目盛の右端（万円）。SWITCH の全社で同じ・0 から始まる
 *
 * ここは**つなぐだけ**で、数字を持たない。出どころは次の6つ。
 *   年収の正本          salary-data.mjs（SALARY）
 *   年収の根拠の台帳    salary-basis.mjs（BASIS・figures）
 *   会社の事実          airline-facts.mjs（JAL・ANA・キャセイ・エバー）／career-facts.mjs（エティハド）
 *   拠点の街            living-facts.mjs（東京・香港・台北）／career-facts.mjs（アブダビ）
 *   写真                airline-photos.mjs
 *   色と略号            airlines-meta.js
 *
 * ★ 年収の欄を「確認中」にしない。どの職位にも**推定年収を額で出す**。
 *   オーナーのご指示 ── 2026-09-30「確認中じゃなくて推定とかにすりゃいいじゃん」／
 *   2026-10-01「基本全て推定でいいじゃん」／2026-10-06「年収のところ確認中にするなよ」。
 *   2026-10-05 の初稿は、根拠・算出方法・時点の3つがそろわない職位を「確認中」と出していた（＝ 5社10職位のうち9つ）。
 *   それは上のご指示に反していた。⚠️ est を null にする枝を戻さない。
 *
 * ★ 棒にするのは推定年収だけ（2026-10-06「並べるならなぜ同じ基準で並べない？」）。
 *   est      推定年収          … 額は SALARY の avg。どの職位にも必ず在る。棒はこれ1種類
 *                                 backed ＝ 根拠・算出方法・時点の3つが台帳にそろっているか（説明に添えるかどうかだけを決める）
 *   cap      求人の上限        … 棒にしない。「〜」と「上限」の字を必ず一緒に出す
 *   company  会社の公表額      … 棒にしない。対象と時点つき
 *   crew     乗員全体の公表平均 … ★どの会社のページにも出さない（2026-10-21 P12.77 オーナー「機長、副操縦士のわかないと意味ないじゃん」）。
 *                                 crew はいつも空。その額の話をしている注と、その額だけの出どころも外す（CREW_ONLY）
 *   ⚠️ 下の3つを est へ流し込まない／est を下の3つの名前で出さない（種類が違う）。
 *   ⚠️ 幅（lo〜hi）は出さない（2026-09-30 に公開の画面から外した）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { BASIS, figures, man } from './salary-basis.mjs';
import { JPY_PER } from './fx-rates.mjs';
import { FACTS as CO, valueText, whenText, introText as coIntro } from './airline-facts.mjs';
import { FACTS as EYF, introText as eyIntro } from './career-facts.mjs';
import { LIVING, CITY_OF, ABUDHABI, SITES, FAMILY, MODES, BAR_STATS } from './living-facts.mjs';
import { primary } from './airline-photos.mjs';
import { axisEnd } from './pv-bars.mjs';
import { LEAD, SWITCH, researchFacts, researchNetwork, researchCities } from './airline-rollout.mjs';
import { REGIONS } from './airline-destinations.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/* 新しい会社ページを持つ会社（★1か所は airline-rollout.mjs の SWITCH。ここは今までの名前で読めるようにしているだけ）。
   先行5社（LEAD）は手で作った台帳から・ほかの会社は「年収の正本（SALARY）と色・略号」だけで作れる（無い所は今までの「確認できていません」の形）。 */
export const GLANCE = SWITCH;
export { LEAD, SWITCH };
export const RANKS = [['cap', '機長'], ['fo', '副操縦士']];

/* 色と略号は airlines-meta.js（ブラウザ用の即時関数。window を渡して中身だけ借りる）。 */
const META = (() => {
  const win = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'airlines-meta.js'), 'utf8'))(win);
  return win.AIRLINES_META || win.PV_AIRLINES || Object.values(win)[0];
})();
function metaOf(slug) {
  const a = META.find(x => x.file === `airlines/${slug}.html`);
  if (!a) throw new Error(`${slug}: airlines-meta.js に無い`);
  const color = a.color || a.c, code = a.code || a.iata;
  if (!/^#[0-9a-fA-F]{6}$/.test(color || '')) throw new Error(`${slug}: airlines-meta.js に色が無い`);
  if (!/^[A-Z0-9]{2,4}$/.test(code || '')) throw new Error(`${slug}: airlines-meta.js に略号が無い`);
  return { color, code };
}

/* ── 社名の字（段階3の面）─────────────────────────────────────────── */
/* 段階3の面（ステイ先・街）の行に出す社名：日本の会社は日本語・ほかは英語（オーナー 2026-10-18「日本は日本語、他は英語」）。
   字は正本（salary-data.mjs の SALARY）の ja / en を、地域（region 'japan'）で選ぶだけ。ページの見出し・検索向けの字には使わない。
   会社ページ（gen-airline-glance.mjs）と career.html（gen-career.mjs）の両方がここを読む（2026-10-19 P12.65。1つの決まりを2つに写さない）。
   島（#crc-data）の name に書く ＝ career-stay.js と pv-contrib.js（街の面の頭の行）が読む。 */
export const coSay = slug => (SALARY[slug].region === 'japan' ? SALARY[slug].ja : SALARY[slug].en);
/* 同じ面（暮らしの板・就航地とステイの欄・career.html の家賃の箱）の札や1行に、台帳の字のまま出てくるその会社の名前も、同じ決まり（coSay）で出す
   （街を選んだ理由「エバー航空の事業所がある」・出典の名前「エバー航空「飛航人員福利」」・就航地の条件の1行）。
   入れ替えるのは、正本の日本語の社名（SALARY の ja。すぐ後ろに「航空」が続けばそこまで）が、かぎかっこ「…」の外に在る所だけ
   ── 引用した資料の題（「飛航人員福利」）の中は1字も変えない。台帳（living-facts.mjs・airline-destinations.mjs）の字は変えない。
   日本の会社のページでは何も変わらない。ページの見出し・検索向けの字には使わない。 */
const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, c => `\\${c}`);
export const coText = (slug, t) => {
  const s = String(t ?? ''), ja = SALARY[slug].ja, say = coSay(slug);
  if (say === ja) return s;
  const re = new RegExp(`${reEsc(ja)}(?:航空)?`, 'g');
  return s.split(/(「[^」]*」)/).map(p => (p.startsWith('「') ? p : p.replace(re, () => say))).join('');
};

/* ── 金額の字 ───────────────────────────────────────────────────── */
/** 標準の円表記（currency.js が実行時に読める形）。 */
export const yen = m => `¥${m.toLocaleString('en-US')}万`;
/** 外貨の家賃などを円に直した字。100万円より小さい額は小数1けたまで（「約11.0万円」）。 */
export function yenOf(cur, amount) {
  if (!(cur in JPY_PER)) throw new Error(`換算レートの無い通貨: ${cur}`);
  const y = amount * JPY_PER[cur], m = y / 10000;
  /* 1万円に届かない額（電車の運賃など）は、万に直さず円のまま書く（「約0.2万円」としない）。 */
  if (m < 1) return `約¥${(Math.round(y / 10) * 10).toLocaleString('en-US')}`;
  return m >= 100 ? `約${Math.round(m).toLocaleString('en-US')}万円` : `約${m.toFixed(1)}万円`;
}
const money = (cur, n) => (cur !== 'JPY' ? `${cur} ${n.toLocaleString('en-US')}`
  : n < 10000 ? `¥${n.toLocaleString('en-US')}` : yenOf('JPY', n).replace(/^約/, ''));
/** 円の家賃の字。出どころが万円の小数2けたまで書く額（22.02万円）は、そのけたまで出す。1けたで足りる額は今までどおり（12.5万円）。 */
const rentYen = n => { const c = Math.round(n / 100); return n < 10000 ? money('JPY', n) : `${c % 10 ? (c / 100).toFixed(2) : (c / 100).toFixed(1)}万円`; };
/** 分の字。60分からは、Google マップの表示と同じ形（1時間15分）。 */
export const minsText = n => (n < 60 ? `${n}分` : `${Math.floor(n / 60)}時間${n % 60}分`);
const dayJa = iso => String(iso || '').replace(/^(\d{4})-(\d\d)-(\d\d)$/, (m, y, mo, d) => `${y}年${+mo}月${+d}日`);

/* ── 年収 ───────────────────────────────────────────────────────── */
/* 金額に付ける短い前提。台帳の注（BASIS[slug].notes）の言い換えなので、
   元の言葉が台帳から消えたら止める（ここだけ古い前提を言い続けないため）。 */
const FIG = {
  'etihad.max_y':             { cond: 'A320・月75時間の乗務が前提',                     needs: ['月75時間'] },
  'cathay-pacific.target_y':  { cond: '目標の飛行時間を飛んだ場合の額（保証額ではありません）', needs: ['保証額ではありません'] },
  'cathay-pacific.allow_m_from': { cond: '公表されているのは下限だけ',                  needs: ['下限'] },
  'eva-air.cash_y_over':      { cond: '外から採用する副操縦士（4年契約）の条件。手当・補助は別', needs: ['4年契約', '手当・補助は別'] },
};
function figNote(slug, f) {
  const n = FIG[`${slug}.${f.key}`];
  if (!n) return '';
  const notes = (BASIS[slug].notes || []).join('\n');
  for (const w of n.needs) if (!notes.includes(w)) throw new Error(`${slug}: 台帳の注に「${w}」が無い（pv-airline-view.mjs の FIG を見直す）`);
  return n.cond;
}
/* 出どころの時点。台帳の as_of の頭（「2026年1月時点（脚注…）」→「2026年1月時点」）。 */
const srcWhen = s => String(s.as_of || '').replace(/（[^（）]*）$/, '').replace(/^(\d{4})-(\d{2})-(\d{2})\s*掲載$/, (m, y, mo, d) => `${y}年${+mo}月${+d}日 掲載`);
/* checked ＝ その資料を開いて確かめた日（台帳の accessed）。画面は「確認日」として出す。 */
/* エティハドの求人票に書かれている応募の条件（職位ごとに1つ）。無ければ何も書かない */
const reqOf = rank => { const r = BASIS.etihad?.[rank]?.groups?.[0]?.req; return r ? `応募条件：${r}` : ''; };
const srcOf = slug => (BASIS[slug].src || []).map(s => ({ pub: s.pub, name: s.name, when: srcWhen(s), url: s.url, secondary: !!s.secondary, checked: s.accessed || '' }));

function payOf(slug, rank) {
  const r = BASIS[slug]?.[rank] || {}, s = SALARY[slug]?.[rank];
  if (!s || !(s.avg > 0)) throw new Error(`${slug}.${rank}: 年収の正本（SALARY）に推定の額が無い`);
  const e = r.est;
  const backed = !!(e && e.basis && e.method && e.as_of);
  const est = { man: s.avg, yen: yen(s.avg), backed, basis: backed ? e.basis : '', method: backed ? e.method : '', asOf: backed ? e.as_of : '' };
  const figs = figures(slug, rank).filter(f => !f.training)
    .map(f => ({ ...f, cond: figNote(slug, f) || f.cond || '', yen: yen(f.man), orig: `${f.cur} ${f.amount.toLocaleString('en-US')}` }));
  return {
    est,
    cap: figs.filter(f => f.key === 'max_y'),
    company: figs.filter(f => f.key !== 'max_y'),
  };
}
/* 訓練生の入社時の額。機長・副操縦士の欄にも棒にも入れない
   （台帳の注がこの額の話をしているので、説明の中に別の行として出すためだけに返す）。 */
const traineeOf = slug => figures(slug, 'trainee').map(f => ({ group: f.group, kind: f.kind, text: f.text }));

/** 棒の目盛の右端（万円）。棒にするのは推定年収だけなので、新しい会社ページを持つ会社（SWITCH）ぜんぶの推定の
    いちばん大きい額を 1,000万の刻みへ切り上げる。⚠️ 会社を足すと、その額しだいで全部の会社ページと career.html の目盛が動く。 */
export const AXIS = Math.ceil(Math.max(...SWITCH.flatMap(s => RANKS.map(([r]) => SALARY[s][r].avg))) / 1000) * 1000;
/** 棒の長さ（％）。 */
export const width = m => `${Math.min(100, (m / AXIS) * 100).toFixed(2)}%`;

/* ★ 機長と副操縦士を分けない額（運航乗務員・運航乗務職の全体の平均）は、どの会社のページにも出さない（P12.77・2026-10-21）。
   台帳（BASIS.crew）には残す（社内の見張り ── 機長の推定がこの平均より低ければ怪しい、など）。画面に出す crew はいつも空。
   その額の話をしている注と、その額だけの出どころも一緒に外す（その額が無いのに「これは…の平均です」と言わない）。
   どの注・出どころがその話かは、台帳の字で決める（needs）── 台帳の字が変わって当たらなくなったら止める（黙って別の注を外さない）。
   ここに無い会社で乗員全体の平均を持つ会社は、注を1つも出さない（どれがその話か字から分けられない ── 全社へ広げる b の決まり）。 */
const CREW_ONLY = {
  jal: { notes: ['運航乗務員全体の平均です', 'グループ連結の数字です', '算定方法は会社の注のとおり'], src: ['平均年間給与'] },
  ana: { notes: ['運航乗務職全体の額です', 'エアージャパンをあわせた額です', '訓練生が人数に入るか、賞与と基準外賃金を含むか'], src: ['平均年間給与'] },
  skymark: { notes: ['運航乗務員290名の平均です', '単体（提出会社）の数字', '人材会社からの受入出向', '賞与および基準外賃金を含みます'], src: ['【従業員の状況】'] },
};
const crewIn = slug => { const b = BASIS[slug]; return !!(b && b.crew && b.crew.groups && b.crew.groups.some(g => g.avg_y != null)); };
/* 注と出どころから、乗員全体の平均の話だけを外す。分けられない会社は null。 */
function crewFree(slug) {
  const notes = BASIS[slug].notes || [], src = srcOf(slug);
  if (!crewIn(slug)) return { notes, src };
  const C = CREW_ONLY[slug];
  if (!C) return null;
  for (const w of C.notes) if (notes.filter(n => n.includes(w)).length !== 1) throw new Error(`${slug}: 乗員全体の平均の注「${w}」が台帳の注にちょうど1つ無い（pv-airline-view.mjs の CREW_ONLY を見直す）`);
  for (const w of C.src) if (!src.some(x => x.name.includes(w))) throw new Error(`${slug}: 乗員全体の平均の出どころ「${w}」が台帳に無い（pv-airline-view.mjs の CREW_ONLY を見直す）`);
  return { notes: notes.filter(n => !C.notes.some(w => n.includes(w))), src: src.filter(x => !C.src.some(w => x.name.includes(w))) };
}

/* ── 事実の1行 ──────────────────────────────────────────────────── */
function fact(x) {
  const cur = x.cur && typeof x.value === 'number' ? x.cur : '';
  return {
    key: x.key, label: x.ja,
    /* 円の額は標準の円表記（通貨切替が読める形）。外貨は元の通貨の字のまま。 */
    value: cur === 'JPY' ? `¥${x.value.toLocaleString('en-US')}` : cur ? `${cur} ${x.value.toLocaleString('en-US')}` : valueText(x),
    /* 外貨の額は、元の通貨の字（通貨切替に読ませない）と円の換算を分けて持つ。 */
    orig: cur && cur !== 'JPY', yen: cur && cur !== 'JPY' ? yenOf(cur, x.value) : '',
    cond: x.cond_ja || '', when: whenText(x),
    src: x.src ? { name: x.src.name, url: x.src.url, kind: x.src.kind } : null,
    /* 出どころを開いて確かめた日（台帳の as_of）。画面は「確認日」として出す。 */
    checked: x.as_of || '',
    /* 会社ぜんたいの決まり（パイロットに限らない）は false。 */
    pilot: x.pilot !== false,
  };
}
const facts = list => (list || []).map(fact);

/* ── エティハド（career-facts.mjs）を、ほかの4社と同じ形にそろえる ───────── */
function etihad() {
  const E = EYF.etihad;
  const ben = E.benefits.filter(x => x.scope === 'all');
  const pick = k => { const x = ben.find(z => z.key === k); if (!x) throw new Error(`etihad: 台帳に ${k} が無い`); return x; };
  /* 会社が「勤務」として公表している項目は無い。求人の待遇欄にある年次休暇を勤務の欄に出す。 */
  const work = [pick('annual_leave')];
  const skip = new Set(['annual_leave', 'tax', 'command_path']);
  const benefits = ben.filter(x => !skip.has(x.key));
  const leadBen = 'education_primary';
  return {
    base: E.base,
    work: work.map(x => ({ ...fact(x), lead: true, cond: '機長・副操縦士の求人の待遇欄' })),
    benefits: benefits.map(x => ({ ...fact(x), lead: x.key === leadBen })).sort((a, b) => b.lead - a.lead),
    profile: facts(E.profile.filter(x => ['first_flight', 'national_airline'].includes(x.key))),
    scale: facts(E.scale.filter(x => ['fleet_total', 'destinations_operated', 'passengers_year', 'pilots_joined_year'].includes(x.key))),
    fleet: facts(E.fleet),
    jobs: E.jobs.filter(j => ['cap', 'fo'].includes(j.rank) && !/instructor/.test(j.key)).map(j => ({
      /* 応募の条件は年収の根拠の台帳に在る（求人票そのものの字。career-facts.mjs の req_ref が指している先）。写しを持たない */
      key: j.key, label: j.ja, value: `${j.place_ja}`, cond: reqOf(j.rank), when: `${whenText({ at: j.posted })} 掲載`,
      src: { name: j.src.name, url: j.url, kind: j.src.kind }, checked: j.as_of || '', pilot: true,
    })),
    /* ★ 家賃は1か月あたりで出す（2026-10-06 オーナーのご指示「年間じゃなくて月間の家賃」）。
       出どころ（Bayut）の表は1年あたりなので、12で割って1の位で丸める。台帳（career-facts.mjs）は年額のまま持つ。
       割ったことは、説明の中で1回だけ言う（basis の per_month）。 */
    living: (rows => gate('etihad', {
      cityKey: 'abudhabi', city: E.living.city_ja, cur: 'AED', per: 'month', measure: '募集家賃の平均',
      site: ABUDHABI.site, siteName: SITES[ABUDHABI.site].name, stat: ABUDHABI.stat,
      cols: COLS_EY, bars: ABUDHABI.bars, words: ABUDHABI.words, leadCol: 'bed1', beside: '',
      byTown: !!ABUDHABI.by_town, cardFamily: ABUDHABI.card_family || '',
      airports: ABUDHABI.airports.map(([iata, to]) => ({ iata, to })), ends: endsOf(ABUDHABI),
      /* 額は、この欄の列（COLS_EY）の分だけ渡す（台帳の bed3 は、列が足されるまで画面に出ない＝今日の画面と同じ） */
      rents: withWays(ABUDHABI, E.living.rents.map((r, i) => ({ ...townRow({ ...r, sub_ja: r.en }, only(COLS_EY, perMonth(r))), when: whenText(r), cond: '', pick: '', lead: i === 0 })), rows),
      estates: [],
      basis: [...E.living.rent_basis.filter(b => b.key !== 'per').map(b => ({ key: b.key, value: b.value })),
              { key: 'per_month', value: '出どころの表は1年あたりの額。ここでは12で割って、1か月あたりにしている' }],
      refs: [], commute: rows,
    }, [...E.living.rents, ...E.living.rent_basis].map(x => x.quote || '')))(ways(ABUDHABI)),
  };
}
/* エティハドの家賃の欄の列（1つの定数。列を足すときはここだけ）。名前は、どの街とも同じ1組の間取りの字（living-facts.mjs の決まり・
   オーナー 2026-10-18 V16）。Bayut の表の呼び名（Studio・1-Bed・2-Bed・3-Bed）そのもの。 */
const COLS_EY = [['studio', 'Studio'], ['bed1', '1-Bed'], ['bed2', '2-Bed'], ['bed3', '3-Bed']];
/* 値を、その欄の列だけにする（列に無い鍵は渡さない）。 */
const only = (cols, v) => Object.fromEntries(Object.entries(v).filter(([k]) => cols.some(c => c[0] === k)));

/* 1年あたりで載っている家賃を、1か月あたりにする（12で割って1の位で丸める）。年額と書いていない行が来たら止める。 */
function perMonth(r) {
  if (r.per !== 'year') throw new Error(`${r.key}: 家賃が1年あたりではない（per=${r.per}）`);
  const m = n => (typeof n === 'number' ? Math.round(n / 12) : n);
  return Object.fromEntries(Object.entries(r.value).map(([k, n]) => [k, Array.isArray(n) ? n.map(m) : m(n)]));
}

/* 街の行（台帳 → 画面）。area ＝ 家賃の数字が指す地域（街の名前より広いときだけ）。label ＝ 家賃の額のそばに書く名前。 */
const townRow = (r, value = r.value) => ({
  key: r.key, name: r.ja, sub: r.sub_ja || r.en || '', en: r.en || r.sub_ja || '', area: r.rent_area_ja || '',
  label: r.rent_area_ja ? `${r.ja}（${r.rent_area_ja}）` : r.ja, iata: r.iata || '', pick: r.pick_ja || '',
  pickSrc: r.pick_src ? { name: r.pick_src.name, url: r.pick_src.url, kind: r.pick_src.kind } : null,
  value: value || {}, when: r.value ? whenText(r) : '', src: r.src || null, cond: r.cond_ja || '', quote: r.quote || '', lead: !!r.lead, way: null,
});
/* 団地ごとの家賃を持つ街の行は、カードに出す団地（rent_from）の額・出どころ・時点で読む（街の行そのものは額を持たない）。
   rent_area_ja ＝ その団地の名前（カードと career.html は「東涌（映灣園）」と読む）。団地を持たない街はそのまま。 */
const resolve = r => {
  if (!r.estates) return r;
  const e = r.estates.find(x => x.key === r.rent_from);
  return { ...r, value: e.value, cur: e.cur, per: e.per, at: e.at, at_ja: e.at_ja, as_of: e.as_of, src: e.src, cond_ja: e.cond_ja, quote: e.quote, rent_area_ja: e.ja };
};
/* 団地ごとの家賃の行（団地を持たない都市は []）。town ＝ 団地が在る街の鍵。 */
const estatesOf = L => (L.rents || []).flatMap(r => (r.estates || []).map(e => ({
  key: e.key, town: r.key, townName: r.ja, name: e.ja, sub: e.sub_ja || '', value: e.value, n: e.n || {}, when: whenText(e),
  src: { name: e.src.name, url: e.src.url, kind: e.src.kind }, cond: e.cond_ja || '', quote: e.quote || '',
})));
/* 空港までの移動の行。c ＝ 都市の台帳（LIVING[…] か ABUDHABI）。
   card ＝ その街のカードの1行に入る行（Google の行・注意の付いていない行・都市の手段の組・拠点の空港に着く行）。
   ★ legs（区間ごとの乗車の表示）は渡さない ＝ 画面に出さない・足さない。 */
function ways(c) {
  const base = c.airports[0][0], ends = c.ends || {};
  return (c.commute || []).map(x => {
    const g = x.via === 'gmaps', kind = g ? Object.keys(x.value)[0] : null, e = g ? ends[x.end] : null;
    if (g && !e) throw new Error(`${x.key}: 着く場所（${x.end}）が ends に無い`);
    return { ...fact(x), key: x.key, town: x.town || '', iata: x.iata, end: g ? x.end : '', mode: x.mode, modes: x.modes || [x.mode],
      via: g ? 'gmaps' : 'operator', line: x.line || '', from: x.from_ja || '', to: g ? e.ja : '',
      kind, mins: g ? x.value[kind] : null, ride: g && x.ride != null ? x.ride : null, warn: (g && x.warn) || '',
      value: g ? minsText(x.value[kind]) : commuteText(x), fare: !g && !!x.cur, day: g ? `${dayJa(x.as_of)}に見た表示` : '',
      card: g && !x.warn && !!c.by_town && FAMILY[x.mode] === c.card_family && e.iata === base,
      lead: !c.by_town && !!x.lead };
  });
}
/* その街のカードに出す移動の1行。着く場所ごとの数字がそろえば1つ、違えば「いちばん短い〜いちばん長い」（平均しない・足さない）。 */
function cardWay(c, rows, key) {
  const m = rows.filter(x => x.town === key && x.card);
  if (!m.length) return null;
  const lo = Math.min(...m.map(x => x.mins)), hi = Math.max(...m.map(x => x.mins)), one = new Set(m.map(x => x.end)).size === 1;
  return { keys: m.map(x => x.key), modes: MODES.filter(k => m.some(x => x.modes.includes(k))), lo, hi,
    text: lo === hi ? minsText(lo) : hi < 60 ? `${lo}〜${hi}分` : `${minsText(lo)}〜${minsText(hi)}`,
    from: m[0].from, to: one ? m[0].to : c.airports[0][1], day: `${dayJa(m.map(x => x.checked).sort().pop())}に見た表示` };
}
const withWays = (c, rents, rows) => rents.map(r => ({ ...r, way: cardWay(c, rows, r.key) }));
const endsOf = c => Object.entries(c.ends || {}).map(([key, e]) => ({ key, iata: e.iata, name: e.ja, kind: e.kind }));
const refsOf = L => (L.refs || []).map(g => ({ key: g.key, name: g.ja, measure: g.measure_ja, cols: g.cols,
  cur: g.rows[0].cur, per: g.rows[0].per || (g.rows[0].cur === 'JPY' ? 'month' : ''), when: whenText(g.rows[0]), cond: g.rows[0].cond_ja || '',
  src: [...new Map(g.rows.map(r => [r.src.url, { name: r.src.name, url: r.src.url }])).values()],
  basis: (g.rent_basis || []).map(b => ({ key: b.key, value: b.value })),          // その出どころ自身の断り（落とさない）
  rows: g.rows.map(r => ({ key: r.key, name: r.ja, value: r.value })) }));

/* 5社とも通る関所：棒の1組に、出どころ・時点の違う行や、cols に無い列・幅の数字を入れさせない（アブダビは台帳が別なので、ここでも見る）。
   団地ごとの家賃（estates）も同じ1組として見る。said ＝ 棒の列の、出どころの呼び名を引用の中で探すときの字（words_src が在ればそれ）。 */
function gate(slug, L, quotes, said = L.words) {
  const bad = m => { throw new Error(`${slug}: 暮らしの台帳 ── ${m}`); };
  const keys = new Set(L.cols.map(c => c[0]));
  if (!L.airports.length) bad('airports が空');
  for (const k of L.bars) if (!keys.has(k)) bad(`棒の列（${k}）が cols に無い`);
  if (L.leadCol && !keys.has(L.leadCol)) bad(`先頭の列（${L.leadCol}）が cols に無い`);
  if (L.rents.filter(r => r.lead).length !== 1) bad('先頭の街が1つに決まらない');
  const priced = [...L.rents.filter(r => Object.keys(r.value).length), ...L.estates];
  for (const r of priced) for (const k of Object.keys(r.value)) if (!keys.has(k)) bad(`${r.key} の列（${k}）が cols に無い`);
  const host = u => new URL(u).host;
  if (new Set(priced.map(r => host(r.src.url))).size > 1 || new Set(priced.map(r => r.when)).size > 1) bad('棒の1組に、出どころか時点の違う行が混ざっている');
  if (!L.site && priced.length) bad('出どころの無い街に、家賃の額が在る');
  for (const k of L.bars) if (!L.words[k] || !said[k] || !quotes.some(q => q.includes(said[k]))) bad(`棒の列（${k}）の、出どころの呼び名（${said[k] || L.words[k]}）が、どの引用にも無い`);
  for (const k of L.bars) for (const r of priced) if (r.value[k] != null && typeof r.value[k] !== 'number') bad(`${r.key} の棒の列（${k}）に、幅の数字が在る（幅は棒にしない）`);
  for (const c of L.commute) if (c.town && !L.rents.some(r => r.key === c.town)) bad(`移動の行 ${c.key} の街（${c.town}）が無い`);
  /* 家賃の棒の組（都市に1組）。棒にできる数字の種類は台帳の BAR_STATS の1か所。行は、団地ごとの家賃が在れば団地、無ければ街。
     目盛の右端は、全部の間取りの全部の行で1つ（いちばん大きい額から）。 */
  const rows = L.estates.length ? L.estates : L.rents;
  const nums = rows.flatMap(r => L.bars.map(k => r.value[k]).filter(v => typeof v === 'number'));
  L.hasBars = BAR_STATS.includes(L.stat) && nums.length > 0;
  L.axis = L.hasBars ? axisEnd(Math.max(...nums)) : null;
  if (L.hasBars && L.rents.find(r => r.lead).value[L.leadCol] == null) bad('先頭の街に、先頭の列の額が無い');
  return L;
}

function others(slug) {
  const F = CO[slug], L = LIVING[CITY_OF[slug]];
  if (!F || !L) throw new Error(`${slug}: 台帳に無い`);
  const lead1st = list => facts(list).map((x, i) => ({ ...x, lead: !!list[i].lead })).sort((a, b) => b.lead - a.lead);
  return {
    base: F.base,
    work: lead1st(F.work), benefits: lead1st(F.benefits),
    profile: facts(F.profile), scale: facts(F.scale), fleet: facts(F.fleet),
    jobs: facts(F.jobs),
    living: cityLiving(slug, CITY_OF[slug], L),
  };
}
/* 先行5社の台帳の街（東京・香港・台北）を、暮らしの板が読む形にする。
   先行5社ではない会社（全社へ広げる c）も、拠点の空港がこの街の空港なら同じ1組を使う（1つの街に1つの資料）。
   そのときは、その会社の拠点の空港の分だけ（空港・着く場所・移動の行をしぼる ── ほかの会社の空港の行を出さない）。 */
function cityLiving(slug, cityKey, L) {
  const rents = L.rents.map(resolve);
  const r0 = rents.find(r => r.value), cur = r0 ? r0.cur : '';
  const rows = ways(L);
  return gate(slug, {
      /* 東京の出どころ（アットホーム・区の SUUMO）は、表に単位の字が無い（per が空）。日本の賃料の相場は月額なので、画面では「月」と出す。 */
      cityKey, city: L.city_ja, cur, per: r0 ? (r0.per || (cur === 'JPY' ? 'month' : '')) : 'month',
      measure: L.measure_ja || '', site: L.site, siteName: L.site ? SITES[L.site].name : '', stat: L.stat,
      cols: L.cols, bars: L.bars, words: L.words, leadCol: L.lead_col || '', beside: L.beside_ja || '',
      byTown: !!L.by_town, cardFamily: L.card_family || '',
      airports: L.airports.map(([iata, to]) => ({ iata, to })), ends: endsOf(L),
      rents: withWays(L, rents.map(r => townRow(r)), rows),
      estates: estatesOf(L),
      basis: (L.rent_basis || []).map(b => ({ key: b.key, value: b.value })),
      refs: refsOf(L), commute: rows,
    }, [...L.rents, ...L.rents.flatMap(r => r.estates || []), ...(L.rent_basis || [])].map(x => x.quote || ''), L.words_src || L.words);
}
/* 値が {t1:35, t2:39}（ターミナルごとの時間）や {fare:1280, liner:1300}（運賃と料金）の形で入っている行。
   台帳の鍵をそのまま画面に出さない ── 呼び名の無い鍵が来たら止める。 */
const PART = { t1: '第1ターミナル駅', t2: '第2ターミナル駅', t3: '第3ターミナル駅', t12: '第1・第2ターミナル駅', fare: '運賃', liner: 'ライナー料金' };
function commuteText(x) {
  const v = x.value;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (x.cur && x.cur !== 'JPY') throw new Error(`${x.key}: 外貨の内訳の書き方をまだ決めていない`);
    return Object.entries(v).map(([k, n]) => {
      if (!PART[k]) throw new Error(`${x.key}: 値の鍵「${k}」の呼び名が無い（pv-airline-view.mjs の PART）`);
      return `${PART[k]} ${x.cur ? money(x.cur, n) : `${n}${x.unit || ''}`}`;
    }).join(' ／ ');
  }
  if (x.cur && typeof v === 'number') return money(x.cur, v);
  return valueText(x);
}

/** 家賃の1ます。数なら額、[下, 上] なら幅。外貨は「元の通貨」と「円」を分けて返す。 */
export function rentCell(cur, v) {
  const lo = Array.isArray(v) ? v[0] : v, hi = Array.isArray(v) ? v[1] : null;
  if (typeof lo !== 'number') return null;
  if (cur === 'JPY') return { orig: '', yen: hi ? `${rentYen(lo)}〜${rentYen(hi)}` : rentYen(lo) };
  const n = x => x.toLocaleString('en-US');
  return {
    orig: hi ? `${cur} ${n(lo)}〜${n(hi)}` : `${cur} ${n(lo)}`,
    yen: hi ? `${yenOf(cur, lo).replace(/円$/, '')}〜${yenOf(cur, hi).replace(/^約/, '')}` : yenOf(cur, lo),
  };
}

export function viewOf(slug) {
  if (!SALARY[slug]) throw new Error(`${slug}: 年収の正本（SALARY）に無い`);
  if (!LEAD.includes(slug)) return rolloutView(slug);
  const S = SALARY[slug], B = BASIS[slug];
  const d = slug === 'etihad' ? etihad() : others(slug);
  const iata = [].concat(d.base.iata || []);
  const free = crewFree(slug);
  if (!free) throw new Error(`${slug}: 乗員全体の平均の注を分けられない（pv-airline-view.mjs の CREW_ONLY に足す）`);
  return {
    slug, name: S.ja, ...metaOf(slug),
    base: { city: d.base.city_ja, country: d.base.country_ja, iata, text: valueText(d.base), ...fact(d.base) },
    pay: {
      cap: payOf(slug, 'cap'), fo: payOf(slug, 'fo'),
      crew: [], trainee: traineeOf(slug),
      tax: B.tax, notes: free.notes, src: free.src, cur: B.cur,
    },
    work: d.work, benefits: d.benefits, living: d.living, livings: [d.living],
    company: { profile: d.profile, scale: d.scale, fleet: d.fleet, photo: primary(slug), intro: introOf(slug) },
    jobs: d.jobs,
  };
}

/* ── 先行5社ではない会社（全社へ広げる b・c・2026-10-21）──────────────────────────
   要るのは 年収の正本（SALARY）と 色・略号（airlines-meta.js）だけ。ほかは在る分だけ:
     年収の根拠  salary-basis.mjs（BASIS）が在れば、職位ごとの公表額・訓練生の額・注・出どころ（先行5社と同じ読み口 payOf）。
                 ⚠️ 機長と副操縦士を分けない額（乗員全体の平均）は出さない（P12.77。crew は空）。その額の話の注と出どころも外す
                    （CREW_ONLY に字が在る会社。無い会社は注を1つも出さない ── どの注がその額の話か、字からは分けられない）。
     会社の事実  調べの台帳（research-ledger.mjs）から、airline-rollout.mjs の決まり（why）と、airline-display.mjs の字
                 （項目の言い方の表か、行ごとに書いた字）を通った行だけ。調べた側の字は出さない。過去・参考の行は札（tag）つき。
     機材        型式だけ（会社の資料に載っている型式。機数は作らない）。
     就航地      調べで確かめた就航地（airline-display.mjs の NET に字が在る会社だけ・partial ＝ 会社全体の就航地とは言わない）。
                 拠点の空港（本拠地）は一覧に入れない（先行5社と同じ）。拠点を外して1つも残らなければ、今までの「…確認してから開きます。」。
     暮らし      拠点の空港ごとの街（拠点の並びの順・先頭 ＝ いちばん上の拠点）。拠点の空港が先行5社の台帳の街の空港なら、その街の1組
                 （東京 ＝ アットホーム。その会社の拠点の空港の行だけにしぼる）。そうでなければ調べの台帳の街（CITY に字が在る街だけ）。
                 家賃の行の無い街は、今までの「家賃の資料を確認できていません」。ほかの街の数字で埋めない。
   紹介文（intro）は、組み立てる型が台帳に無いので作らない（[]）。作り物の字・0 で埋めない。 */
const ROOM = [['studio', 'studio', 'Studio'], ['1bed', 'bed1', '1-Bed'], ['2bed', 'bed2', '2-Bed'], ['3bed', 'bed3', '3-Bed']];
/* 家賃の対象の期間（2026-07-01〜2026-09-30 → 2026年7〜9月）。月の頭から月の終わりまでの行だけ。ほかは対象の始まりの日付の字。 */
function periodText(r) {
  const e = r.effective || {}, f = /^(\d{4})-(\d{2})-01$/.exec(e.from || ''), t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.to || '');
  if (f && t && f[1] === t[1]) return f[2] === t[2] ? `${f[1]}年${+f[2]}月` : `${f[1]}年${+f[2]}〜${+t[2]}月`;
  return whenText({ at: e.from || '' });
}
/* 調べの台帳の街 → 暮らしの板の形（先行5社の街と同じ形・同じ関所 gate）。家賃は街ぜんたいの1行（街の中の区分けを作らない）。 */
function researchCityLiving(slug, c) {
  const C = c.C, value = {}, cols = [];
  const first = c.rents[0], same = c.rents.filter(x => first && x.src.url === first.src.url && periodText(x.r) === periodText(first.r));
  for (const { r } of same) for (const [k, n] of Object.entries(r.value)) {
    const m = ROOM.find(x => x[0] === k);
    if (!m || typeof n !== 'number') continue;
    value[m[1]] = n;
  }
  for (const m of ROOM) if (value[m[1]] != null) cols.push([m[1], m[2]]);
  const priced = cols.length > 0;
  const town = {
    key: c.city, name: C.ja, sub: C.en, en: C.en, area: '', label: C.ja,
    iata: C.iata, pick: '', pickSrc: null, value, when: priced ? periodText(first.r) : '',
    src: priced ? { name: first.src.name, url: first.src.url, kind: first.src.kind } : null, cond: '', quote: '', lead: true, way: null,
  };
  const commute = c.commute.map(({ r, d, src }, i) => ({
    key: r.id, town: '', iata: C.iata, end: '', mode: d.mode || 'train', modes: [d.mode || 'train'], via: 'operator', line: '', from: '', to: '',
    kind: null, mins: null, ride: null, warn: '', label: d.label, value: d.value, orig: false, yen: '', cond: d.cond || '', when: '',
    src: { name: src.name, url: src.url, kind: src.kind }, checked: r.checked_at || '', pilot: true, fare: false, day: '', card: false, lead: i === 0,
  }));
  return gate(slug, {
    cityKey: c.city, city: C.ja, cur: priced ? first.r.currency : '', per: priced ? C.per || 'month' : 'month', measure: priced ? C.measure || '' : '',
    site: priced ? c.city : '', siteName: priced ? C.site || '' : '', stat: priced ? (first.r.amount || {}).stat || '' : '',
    cols, bars: [], words: {}, leadCol: cols.length ? cols[0][0] : '', beside: '', byTown: false, cardFamily: '',
    airports: [{ iata: C.iata, to: C.airport }], ends: [], rents: [town], estates: [], basis: priced && C.scope ? [{ key: 'scope', value: C.scope }] : [], refs: [], commute, research: true,
  }, [], {});
}
/* 先行5社の台帳の街を、その会社の拠点の空港の分だけにしぼって使う。 */
function leadCityFor(slug, key, bases) {
  const L = LIVING[key], at = iata => bases.includes(iata);
  return cityLiving(slug, key, { ...L, airports: L.airports.filter(([a]) => at(a)),
    ends: Object.fromEntries(Object.entries(L.ends || {}).filter(([, e]) => at(e.iata))), commute: (L.commute || []).filter(x => at(x.iata)) });
}
/* 拠点の空港の順に、街を1つずつ（同じ街は1回だけ）。 */
function livingsOf(slug, bases) {
  const out = [], found = researchCities(slug, bases);
  for (const code of bases) {
    const key = Object.keys(LIVING).find(k => LIVING[k].airports.some(([a]) => a === code));
    if (key) { if (!out.some(L => L.cityKey === key)) out.push(leadCityFor(slug, key, bases)); continue; }
    const c = found.find(x => x.iata === code);
    if (c && !out.some(L => L.cityKey === c.city)) out.push(researchCityLiving(slug, c));
  }
  return out;
}
function rolloutView(slug) {
  const S = SALARY[slug], B = BASIS[slug], R = researchFacts(slug);
  const free = B ? crewFree(slug) : null;
  /* 額の行（月・年あたりの通貨つきの額）は、期間の字を額の前に置く（「月 ZAR 4,000」）。 */
  const rows = list => list.map(x => { const f = { ...fact(x), lead: !!x.lead, use: x.use, tag: x.tag || '', id: x.id }; if (x.per && x.cur) f.value = `${x.per} ${f.value}`; return f; });
  const base = R.base
    ? { city: R.base.city, country: R.base.country, iata: R.base.iata, text: R.base.city || R.base.iata[0], rows: rows(R.base.rows) }
    : { city: '', country: '', iata: [], text: '', rows: [] };
  const livings = livingsOf(slug, base.iata);
  return {
    slug, name: S.ja, ...metaOf(slug), rollout: true,
    base,
    pay: {
      cap: payOf(slug, 'cap'), fo: payOf(slug, 'fo'),
      crew: [], trainee: traineeOf(slug),
      tax: (B && B.tax) || '', notes: free ? free.notes : [], src: B ? (free ? free.src : srcOf(slug).filter(x => !/平均年間給与|【従業員の状況/.test(x.name))) : [], cur: (B && B.cur) || '',
    },
    work: rows(R.work), benefits: rows(R.benefits), living: livings[0] || null, livings,
    network: researchNetwork(slug, REGIONS, base.iata),
    company: { profile: rows(R.profile), scale: rows(R.scale), fleet: rows(R.fleet), photo: primary(slug), intro: [] },
    jobs: rows(R.jobs),
    held: R.held,
  };
}

/* 会社のカードのいちばん上の字（紹介文）。字は台帳の項目から組み立てたもの ── 手で書いた字ではない
   （型と決まりは career-facts.mjs の fillIntro / checkIntro。エティハドは career-facts、ほかは airline-facts が持つ）。
   uses ＝ その文が使った項目の鍵。カードは、同じ項目を下の一覧の先頭にもう一度並べない。 */
function introOf(slug) {
  const list = slug === 'etihad' ? eyIntro(slug) : coIntro(slug);
  if (!list.length) throw new Error(`${slug}: 台帳に紹介文が無い`);
  for (const s of list) if (!s.text) throw new Error(`${slug}: 紹介文が台帳の項目で埋まらない（${s.uses.join('・')}）`);
  return list;
}

/* node pv-airline-view.mjs … 5社ぶんを一覧で出す（目で確かめる用）。 */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`目盛の右端 ${AXIS}万`);
  for (const s of GLANCE) {
    const v = viewOf(s);
    const lead = l => { const x = l.find(z => z.lead) || l[0]; return x ? `${x.label}＝${x.value}` : '（公表なし）'; };
    const r = v.living.rents.find(x => x.lead), c = v.living.leadCol ? rentCell(v.living.cur, r.value[v.living.leadCol]) : null;
    console.log(`\n${v.name}（${v.code}・${v.base.city} ${v.base.iata.join('・')}）`);
    for (const [k, l] of RANKS) {
      const p = v.pay[k];
      console.log(`  ${l}  推定年収 ${p.est.yen}${p.est.backed ? '（根拠あり）' : ''}`);
      for (const f of [...p.cap, ...p.company]) console.log(`      ${f.kind}  ${f.text}（${f.orig}）`);
    }
    console.log(`  勤務  ${lead(v.work)}\n  待遇  ${lead(v.benefits)}\n  暮らし ${r.name} ${c ? `${c.orig} ${c.yen}` : '（家賃の資料なし）'}${r.way ? ` ／ ${r.way.text}` : ''}`);
  }
}
