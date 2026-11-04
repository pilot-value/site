/* pilot-weights.mjs ── 地域・国・世界の推定年収の平均を「パイロットの人数」で重み付けするための、会社ごとの重み（2026-11-04）。
 *
 * ★オーナー「1000万の機長100人と6000万の機長1000人じゃ平均が大きく変わる」→ 1社1票の単純平均をやめて、人数で重み付けする。
 * ★人数が見つからない会社は「機材の数 × 1機あたりのパイロット」で見積もる（オーナー決定 2026-11-04「機材数で見積もる」）。
 *
 * 数字の出どころ（ここに数字を手で書かない）
 *   ・pilot-counts.mjs の COUNTS ── ROUND8（2026-11-04）の人数と機材の数。いちばん新しい調べで、これがあれば必ずこれ
 *   ・research-ledger.mjs の FACTS の scale（pilots / fleet_total）── それより前の調査パック（会社ページが読む台帳）
 *   ・airline-facts.mjs の FACTS の scale ── 先行の会社（JAL・ANA・キャセイ・エバー）
 *   同じ会社に記録が2つ以上あるときは、調べた日（checked_at / as_of）が新しいほう。
 *
 * 1機あたりのパイロット（RATIO）は、人数と機材の両方がそろった会社の真ん中の値を毎回ここで計算する。
 *   グループ全体の人数しか無い会社（GROUP）は比を作る材料にしない（人数はグループ・機材は本体、で比が膨らむ）。
 *   重みとしてはグループの人数をそのまま使う（本体が大半のため）。
 *
 * ⚠️ 各社の額は「代表の1人の推定年収」（機長は12年目など）。重み付けしても「全パイロットの平均年収」とは呼ばない。
 * ⚠️ 重みの無い会社は、平均の分母にも分子にも入れない（0 で埋めない）。会社が1社も重みを持たない集まりだけ、単純平均に戻す。
 * ⚠️ 本番には配らない（.mjs）。画面に出るのは、これで作った平均の額だけ。
 *
 * 見るもの: node pilot-weights.mjs（会社ごとの重みと、外した会社・理由の一覧）／node assert-directory.mjs の D5
 */
import { COUNTS } from './pilot-counts.mjs';
import { LEDGER } from './research-ledger.mjs';
import { FACTS as LEAD } from './airline-facts.mjs';
import { SALARY } from './salary-data.mjs';
import { pathToFileURL } from 'node:url';

/** 数字があっても重みに使わない会社（理由つき）。 */
export const SKIP = Object.freeze({
  'breeze-airways': '同じ公式ページに 731名 と 625名 の2つの人数があり、どちらとも決められない',
  'solairus': '機材の数はビジネスジェットの「管理している機数」で、運航する会社の機材とは意味が違う',
  'wizz-air': '機材の数（21機）は英国の子会社だけで、ウィズエア全体ではない',
});

/** 人数がグループ全体の合計の会社。重みにはそのまま使い、1機あたりの人数を作る材料にはしない。 */
export const GROUP = Object.freeze({
  'air-china': '会社と子会社を合わせた Flight crew',
  'china-eastern': '親会社と主要子会社を含む Group の Pilots',
  'china-southern': '会社と主要子会社を含む Group の Flight 区分',
  'hainan-airlines': '海南航空控股の報告範囲（単体と子会社の切り分けなし）',
  'juneyao-airlines': '親会社と主要子会社を含む公表区分',
  'ryanair': '全グループ航空会社を含む',
  'tap': 'TAP の連結グループ（Portugália を含む）',
  'copa-airlines': 'Copa Holdings の社員分類',
  'latam': 'LATAM Airlines Group 連結の Cockpit crew',
  'aeromexico': 'Grupo Aeroméxico 全体（Aeroméxico Connect を含む）',
});

const KEYS = ['pilots', 'fleet_total'];

/** 資料の字 → 人数・機数。"more than 5,700"・"~3300"・"300+"・"１６９"（全角）・"1.062"（点が桁区切り）。
    小数（"1.5" など）や読めない字は null ＝ 重みに使わない。 */
export function countOf(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0 ? v : null;
  if (typeof v !== 'string') return null;
  const t = v.normalize('NFKC').match(/\d[\d.,]*/)?.[0].replace(/[.,]$/, '');
  if (!t) return null;
  if (/^\d+$/.test(t)) return +t || null;
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return +t.replace(/[.,]/g, '');   // 1,062・1.062
  return null;
}

/* 会社ごとに、人数と機材の数のいちばん新しい記録を1つずつ */
function pick() {
  const got = {};
  const put = (co, key, value, checked, from) => {
    const n = countOf(value);
    if (!n || !SALARY[co]) return;
    const cur = (got[co] ||= {})[key];
    if (!cur || checked > cur.checked) got[co][key] = { n, checked, from };
  };
  for (const [co, secs] of Object.entries(LEDGER.FACTS)) {
    for (const arr of Object.values(secs)) {
      if (!Array.isArray(arr)) continue;
      for (const f of arr) if (KEYS.includes(f.key) && f.use !== '保留') put(co, f.key, f.value, String(f.checked_at || f.imported_on || ''), f.id);
    }
  }
  for (const [co, F] of Object.entries(LEAD)) {
    for (const f of F.scale || []) if (KEYS.includes(f.key)) put(co, f.key, f.value, String(f.as_of || ''), `airline-facts:${co}.${f.key}`);
  }
  /* ROUND8 は「ほかの記録より新しい」として必ず勝たせる（調べた日の字がほかの台帳と同じ日でも） */
  for (const [co, o] of Object.entries(COUNTS)) {
    if (o.pilots) put(co, 'pilots', o.pilots.text, '9999-round8', `pilot-counts:${o.pilots.id}`);
    if (o.fleet) put(co, 'fleet_total', o.fleet.text, '9999-round8', `pilot-counts:${o.fleet.id}`);
  }
  return got;
}

const median = (xs) => {
  const a = [...xs].sort((x, y) => x - y), h = a.length >> 1;
  return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2;
};

function build() {
  const got = pick();
  const pairs = Object.keys(got)
    .filter((s) => got[s].pilots && got[s].fleet_total && !GROUP[s] && !SKIP[s])
    .map((s) => ({ slug: s, r: got[s].pilots.n / got[s].fleet_total.n }));
  if (pairs.length < 5) throw new Error(`pilot-weights：人数と機材の両方がそろった会社が ${pairs.length} 社しかない（1機あたりの人数を決められない）`);
  const ratio = median(pairs.map((p) => p.r));
  const weights = {}, out = {};
  for (const s of Object.keys(SALARY)) {
    const g = got[s] || {};
    if (SKIP[s]) { out[s] = SKIP[s]; continue; }
    if (g.pilots) weights[s] = { n: g.pilots.n, kind: 'pilots', from: g.pilots.from };
    else if (g.fleet_total) weights[s] = { n: Math.round(g.fleet_total.n * ratio), kind: 'fleet', fleet: g.fleet_total.n, from: g.fleet_total.from };
    else out[s] = '人数も機材の数も見つからない';
  }
  return { ratio, pairs, weights, out };
}

const B = build();
/** 1機あたりのパイロット（人数と機材の両方がそろった会社の真ん中の値） */
export const RATIO = B.ratio;
/** 会社ごとの重み { slug: { n, kind: 'pilots' | 'fleet', fleet?, from } }。無い会社は入っていない */
export const WEIGHTS = Object.freeze(B.weights);
/** 平均に入れない会社 { slug: 理由 } */
export const LEFT_OUT = Object.freeze(B.out);

/**
 * 重み付けの平均。slugs ＝ 平均を取る会社の集まり、valueOf(slug) ＝ その会社の額。
 * 返り値 { value, used }：used ＝ 平均に入れた会社。重みを持つ会社が1社も無い集まりだけ、全社の単純平均（used ＝ 全社）。
 */
export function pilotMean(slugs, valueOf) {
  if (!slugs.length) throw new Error('pilotMean：会社が1社も無い');
  const used = slugs.filter((s) => WEIGHTS[s]);
  if (!used.length) return { value: slugs.reduce((a, s) => a + valueOf(s), 0) / slugs.length, used: [...slugs] };
  const t = used.reduce((a, s) => a + WEIGHTS[s].n, 0);
  return { value: used.reduce((a, s) => a + WEIGHTS[s].n * valueOf(s), 0) / t, used };
}

/* node pilot-weights.mjs ── 重みの一覧 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ws = Object.entries(WEIGHTS);
  const by = (k) => ws.filter(([, w]) => w.kind === k);
  console.log(`1機あたりのパイロット ${RATIO.toFixed(1)} 人（人数と機材の両方がそろった ${B.pairs.length} 社の真ん中）`);
  console.log(`人数 ${by('pilots').length} 社・機材から見積もり ${by('fleet').length} 社・平均に入れない ${Object.keys(LEFT_OUT).length} 社（全 ${Object.keys(SALARY).length} 社）`);
  console.log('\n■ 機材から見積もった会社（機材 → 人数）');
  for (const [s, w] of by('fleet').sort((a, b) => b[1].n - a[1].n)) console.log(`  ${s.padEnd(22)} ${String(w.fleet).padStart(4)} 機 → ${w.n} 人`);
  console.log('\n■ 平均に入れない会社');
  for (const [s, why] of Object.entries(LEFT_OUT)) console.log(`  ${s.padEnd(22)} ${why}`);
}
