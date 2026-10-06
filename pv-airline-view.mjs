/* pv-airline-view.mjs — 主要5社の会社ページが読む、ただ1つのデータの読み口。
 *
 *   viewOf(slug) … 1社ぶんを、ページがそのまま並べられる形で返す
 *   AXIS … 棒の目盛の右端（万円）。5社で同じ・0 から始まる
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
 *   crew     乗員全体の公表平均 … 棒にしない（機長と副操縦士を分けていない数字）
 *   ⚠️ 下の3つを est へ流し込まない／est を下の3つの名前で出さない（種類が違う）。
 *   ⚠️ 幅（lo〜hi）は出さない（2026-09-30 に公開の画面から外した）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { BASIS, figures, man } from './salary-basis.mjs';
import { JPY_PER } from './fx-rates.mjs';
import { FACTS as CO, valueText, whenText } from './airline-facts.mjs';
import { FACTS as EYF } from './career-facts.mjs';
import { LIVING, CITY_OF } from './living-facts.mjs';
import { primary } from './airline-photos.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

export const GLANCE = ['jal', 'ana', 'cathay-pacific', 'etihad', 'eva-air'];
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
const srcOf = slug => (BASIS[slug].src || []).map(s => ({ pub: s.pub, name: s.name, when: srcWhen(s), url: s.url, secondary: !!s.secondary }));

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

/** 棒の目盛の右端（万円）。棒にするのは推定年収だけなので、5社の推定のいちばん大きい額を 1,000万の刻みへ切り上げる。 */
export const AXIS = Math.ceil(Math.max(...GLANCE.flatMap(s => RANKS.map(([r]) => SALARY[s][r].avg))) / 1000) * 1000;
/** 棒の長さ（％）。 */
export const width = m => `${Math.min(100, (m / AXIS) * 100).toFixed(2)}%`;

function crewOf(slug) {
  const b = BASIS[slug];
  if (!b?.crew?.groups) return [];
  return b.crew.groups.filter(g => g.avg_y != null).map(g => {
    const m = man(b.cur, g.avg_y);
    const [, who, at] = g.name.match(/^(.*?)（(.*)）$/) || [null, g.name, ''];
    return { man: m, yen: yen(m), who, when: at.split('・').pop(), scope: at.split('・').slice(0, -1).join('・') };
  });
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
      key: j.key, label: j.ja, value: `${j.place_ja}`, cond: '', when: `${whenText({ at: j.posted })} 掲載`,
      src: { name: j.src.name, url: j.url, kind: j.src.kind }, pilot: true,
    })),
    /* ★ 家賃は1か月あたりで出す（2026-10-06 オーナーのご指示「年間じゃなくて月間の家賃」）。
       出どころ（Bayut）の表は1年あたりなので、12で割って1の位で丸める。台帳（career-facts.mjs）は年額のまま持つ。
       割ったことは、説明の中で1回だけ言う（basis の per_month）。 */
    living: {
      city: E.living.city_ja, cur: 'AED', per: 'month', measure: '募集家賃の平均',
      cols: [['studio', 'スタジオ'], ['bed1', '1寝室'], ['bed2', '2寝室']], leadCol: 'bed1',
      rents: E.living.rents.map((r, i) => ({ key: r.key, name: r.ja, pick: '', value: perMonth(r), when: whenText(r), src: r.src, cond: '', lead: i === 0 })),
      basis: [...E.living.rent_basis.filter(b => b.key !== 'per').map(b => ({ key: b.key, value: b.value })),
              { key: 'per_month', value: '出どころの表は1年あたりの額。ここでは12で割って、1か月あたりにしている' }],
      commute: [],
    },
  };
}

/* 1年あたりで載っている家賃を、1か月あたりにする（12で割って1の位で丸める）。年額と書いていない行が来たら止める。 */
function perMonth(r) {
  if (r.per !== 'year') throw new Error(`${r.key}: 家賃が1年あたりではない（per=${r.per}）`);
  const m = n => (typeof n === 'number' ? Math.round(n / 12) : n);
  return Object.fromEntries(Object.entries(r.value).map(([k, n]) => [k, Array.isArray(n) ? n.map(m) : m(n)]));
}

function others(slug) {
  const F = CO[slug], L = LIVING[CITY_OF[slug]];
  if (!F || !L) throw new Error(`${slug}: 台帳に無い`);
  const lead1st = list => facts(list).map((x, i) => ({ ...x, lead: !!list[i].lead })).sort((a, b) => b.lead - a.lead);
  const cur = L.rents[0].cur;
  return {
    base: F.base,
    work: lead1st(F.work), benefits: lead1st(F.benefits),
    profile: facts(F.profile), scale: facts(F.scale), fleet: facts(F.fleet),
    jobs: facts(F.jobs),
    living: {
      /* 東京（SUUMO）は台帳に単位の字が無い（per が空）。日本の賃料の相場は月額なので、画面では「月」と出す。 */
      city: L.city_ja, cur, per: L.rents[0].per || (cur === 'JPY' ? 'month' : ''), measure: L.measure_ja,
      cols: L.cols, leadCol: L.lead_col,
      rents: L.rents.map(r => ({ key: r.key, name: r.ja, pick: r.pick_ja || '', value: r.value, when: whenText(r), src: r.src, cond: r.cond_ja || '', lead: !!r.lead })),
      basis: (L.rent_basis || []).map(b => ({ key: b.key, value: b.value })),
      commute: (L.commute || []).map(x => ({ ...fact(x), lead: !!x.lead, value: commuteText(x) })),
    },
  };
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
  if (cur === 'JPY') return { orig: '', yen: hi ? `${money('JPY', lo)}〜${money('JPY', hi)}` : money('JPY', lo) };
  const n = x => x.toLocaleString('en-US');
  return {
    orig: hi ? `${cur} ${n(lo)}〜${n(hi)}` : `${cur} ${n(lo)}`,
    yen: hi ? `${yenOf(cur, lo).replace(/円$/, '')}〜${yenOf(cur, hi).replace(/^約/, '')}` : yenOf(cur, lo),
  };
}

export function viewOf(slug) {
  if (!GLANCE.includes(slug)) throw new Error(`${slug}: 主要5社ではない`);
  const S = SALARY[slug], B = BASIS[slug];
  const d = slug === 'etihad' ? etihad() : others(slug);
  const iata = [].concat(d.base.iata || []);
  return {
    slug, name: S.ja, ...metaOf(slug),
    base: { city: d.base.city_ja, country: d.base.country_ja, iata, text: valueText(d.base), ...fact(d.base) },
    pay: {
      cap: payOf(slug, 'cap'), fo: payOf(slug, 'fo'),
      crew: crewOf(slug), trainee: traineeOf(slug),
      tax: B.tax, notes: B.notes || [], src: srcOf(slug), cur: B.cur,
    },
    work: d.work, benefits: d.benefits, living: d.living,
    company: { profile: d.profile, scale: d.scale, fleet: d.fleet, photo: primary(slug) },
    jobs: d.jobs,
  };
}

/* node pv-airline-view.mjs … 5社ぶんを一覧で出す（目で確かめる用）。 */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`目盛の右端 ${AXIS}万`);
  for (const s of GLANCE) {
    const v = viewOf(s);
    const lead = l => { const x = l.find(z => z.lead) || l[0]; return x ? `${x.label}＝${x.value}` : '（公表なし）'; };
    const r = v.living.rents.find(x => x.lead), c = rentCell(v.living.cur, r.value[v.living.leadCol]);
    console.log(`\n${v.name}（${v.code}・${v.base.city} ${v.base.iata.join('・')}）`);
    for (const [k, l] of RANKS) {
      const p = v.pay[k];
      console.log(`  ${l}  推定年収 ${p.est.yen}${p.est.backed ? '（根拠あり）' : ''}`);
      for (const f of [...p.cap, ...p.company]) console.log(`      ${f.kind}  ${f.text}（${f.orig}）`);
    }
    for (const c2 of v.pay.crew) console.log(`  乗員全体  ${c2.yen}（${c2.scope}・${c2.when}）`);
    console.log(`  勤務  ${lead(v.work)}\n  待遇  ${lead(v.benefits)}\n  暮らし ${r.name} ${c.orig} ${c.yen}`);
  }
}
