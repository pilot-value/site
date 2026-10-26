/* ════════════════════════════════════════════════════════════════
   directory-model.mjs ── 航空会社一覧（world-airlines.html・en/world-airlines.html）の「形」を、
   台帳だけから作る（リード P7.9：全社どうしの比較も同じ形を読む）。

   読む台帳: salary-data.mjs（SALARY ＝ 会社の集合と推定年収）・salary-basis.mjs（cardFigure ＝ 会社の公表額）・
             airline-countries.mjs（国と、検索だけの呼び名 alt）・airline-rollout.mjs（LEAD ＝ 先行5社・SWITCH ＝ 新しい会社ページ）。
             文字として読む: airlines-meta.js（一覧の行：社名・略号・色・旗・種類・提携・fleet）・
             search.js（ヘッダー検索の略称）・airline-logos.js（ロゴの在る会社）。
   ★ ファイルを書かない。書くのは gen-directory.mjs。
   ★ gen-career.mjs と cur-core.mjs を読まない（循環・起動時の await を作らない）。
   ★ 年収・会社・略称・ロゴ・国の別名・SWITCH の台帳を直したら node gen-directory.mjs を2回
     （2回目は「変更なし」）→ node assert-directory.mjs。流さないと一覧だけが古いまま残り、画面は普通に動く。
   ════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { cardFigure } from './salary-basis.mjs';
import { AIRLINE_COUNTRY, BY_CODE } from './airline-countries.mjs';
import { LEAD, SWITCH, EN_SWITCH } from './airline-rollout.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/** 地域（この順が一覧の並び）。名前・絵文字・色は一覧のページが持っていた REGION_CFG の値のまま */
export const REGIONS = Object.freeze([
  { code: 'japan',   ja: '日本',       en: 'Japan',         emoji: '🇯🇵', color: '#3d9bff' },
  { code: 'asia',    ja: 'アジア',     en: 'Asia',          emoji: '🌏', color: '#f97316' },
  { code: 'mideast', ja: '中東',       en: 'Middle East',   emoji: '🌙', color: '#efc050' },
  { code: 'africa',  ja: 'アフリカ',   en: 'Africa',        emoji: '🌍', color: '#4caf50' },
  { code: 'europe',  ja: '欧州',       en: 'Europe',        emoji: '✈️', color: '#5fb0ff' },
  { code: 'us',      ja: '北米',       en: 'North America', emoji: '🇺🇸', color: '#c8102e' },
  { code: 'oceania', ja: 'オセアニア', en: 'Oceania',       emoji: '🦘', color: '#ee6450' },
  { code: 'latam',   ja: '中南米',     en: 'Latin America', emoji: '🌎', color: '#f5c842' },
].map((r) => Object.freeze(r)));
export const ALL = Object.freeze({ code: 'all', ja: 'すべて', en: 'All', emoji: '🌐', color: '#f5c842' });
export const RANKS = Object.freeze(['cap', 'fo']);
/** カードに出す額の決め方。'published-first' ＝ 会社の公表額があればそれ・無ければ推定（いまの決め方）。
    'estimate-for-five' ＝ 先行5社は推定を主にして公表額を2行目に（検査だけが使う・ページには書かない） */
export const CARD_RULE = 'published-first';

/* 金額の行の札の字（★ここ1か所。英語の副操縦士の字はリード P12.86-3 で採った C2） */
const RANK_WORD = { cap: { ja: '機長', en: 'Captain' }, fo: { ja: '副操縦士', en: 'First Officer' } };

// 2社を横に並べるページ（career.html?view=compare）が出せる会社 ＝ 掲載している全社（compare-all CA-3b1）。
export const twoSlugs = () => Object.keys(SALARY);

/** 比較のチェックを付けるか。日本語ページ ＝ 2社比較で出せて、新しい会社ページ（SWITCH）を持つ会社（リード P12.86-1：4社も SWITCH に従う）。
    ★2026-10-25 英語の EN-9：英語ページも同じ決まり ── 2社比較（en/career.html）で出せて、新しい英語の会社ページ（airline-rollout.mjs の
    EN_SWITCH）を持つ会社。盆の「Compare airlines」が2社を en/career.html へ送る（前の英語ページは機種の段 fleet を持つ会社 ＝ レベリング図だけ）。 */
export const tickOf = (A, lang) => (lang === 'ja' ? A.two && A.sw : A.two && A.swEn);

/* 一覧の行の提携（日本語）→ 英語。知らない値は止める（英語のページに日本語の札を出さない） */
const ALLIANCE_EN = {
  'スターアライアンス': 'Star Alliance', 'ワンワールド': 'oneworld', 'スカイチーム': 'SkyTeam',
  'JALグループ': 'JAL Group', 'ANAグループ': 'ANA Group', 'ANA提携': 'ANA partner', 'JAL/ANA提携': 'JAL / ANA partner',
};

/** airlines-meta.js の行（window.PV_AIRLINES）。slug を足して返す */
export function listRows(root = ROOT) {
  const win = {};
  new Function('window', fs.readFileSync(path.join(root, 'airlines-meta.js'), 'utf8'))(win);
  return win.PV_AIRLINES.map((r) => ({ ...r, slug: win.PV_slugOf(r) }));
}
/** search.js の行（var DB = [ … ]; の中身）。slug を足して返す */
export function headerRows(root = ROOT) {
  const src = fs.readFileSync(path.join(root, 'search.js'), 'utf8');
  const a = src.indexOf('var DB = ['), z = src.indexOf('window.PV_DB = DB;');
  if (a < 0 || z < 0) throw new Error('search.js の形が変わった（var DB = [ / window.PV_DB = DB; が無い）');
  const rows = new Function('return ' + src.slice(a + 'var DB = '.length, src.lastIndexOf('];', z) + 1))();
  return rows.map((r) => ({ ...r, slug: String(r.f || '').replace(/^airlines\//, () => '').replace(/\.html$/, () => '') }));
}
/** airline-logos.js の PV_LOGOS（slug → 拡張子） */
export function logos(root = ROOT) {
  const w = {};
  new Function('window', fs.readFileSync(path.join(root, 'airline-logos.js'), 'utf8'))(w);
  return w.PV_LOGOS || {};
}

const uniq = (xs) => [...new Set(xs.filter((x) => x != null && String(x) !== '').map(String))];

let MEMO = null;
/** 一覧の形（1回だけ作る） */
export function model() {
  if (MEMO) return MEMO;
  const rows = listRows(), heads = headerRows(), L = logos();
  const rowOf = new Map(rows.map((r, i) => [r.slug, { r, i }])), headOf = new Map(heads.map((h) => [h.slug, h]));
  const two = new Set(twoSlugs()), sw = new Set(SWITCH), swEn = new Set(EN_SWITCH), airlines = {};
  for (const slug of Object.keys(SALARY)) {
    const d = SALARY[slug], hit = rowOf.get(slug);
    if (!hit) throw new Error(`${slug} の行が airlines-meta.js に無い（一覧に出ない）`);
    const row = hit.r, h = headOf.get(slug) || null, c = BY_CODE[AIRLINE_COUNTRY[slug]] || null;
    if (row.alliance && !ALLIANCE_EN[row.alliance]) throw new Error(`${slug} の提携「${row.alliance}」の英語が無い（ALLIANCE_EN）`);
    const codeLike = (t) => /^[A-Z0-9]{2,3}$/.test(t), ht = (h && h.t) || [];
    const codes = uniq([row.code, ...ht.filter(codeLike), c && c.code]).map((x) => x.toUpperCase());
    const noThe = (s) => (s ? String(s).replace(/^the /, () => '') : s);
    const keys = uniq([d.ja, d.en, row.name, row.en, h && h.n, h && h.e, ...ht.filter((t) => !codeLike(t)),
      c && c.ja, c && c.en, noThe(c && c.enIn), noThe(c && c.enFull), ...((c && c.alt) || []),
      row.alliance, ALLIANCE_EN[row.alliance], row.flag, c && c.flag]);
    for (const k of keys) if (k.includes('|')) throw new Error(`${slug} の検索の鍵「${k}」に | が入っている`);
    const A = {
      slug, region: d.region, ja: d.ja, en: d.en,
      show: { ja: row.name, en: row.en, flag: row.flag },
      listed: true, lvl: typeof row.fleet === 'string' && row.fleet !== '',
      five: LEAD.includes(slug), two: two.has(slug), sw: sw.has(slug), swEn: swEn.has(slug),
      code: row.code ?? null, color: row.color ?? null, type: row.type, taxFree: d.taxFree === true,
      alliance: row.alliance ? { ja: row.alliance, en: ALLIANCE_EN[row.alliance] } : null,
      country: c ? { code: c.code, ja: c.ja, en: c.en, flag: c.flag } : null,
      codes, keys, logo: L[slug] || null, href: `airlines/${slug}.html`,
    };
    for (const rank of RANKS) {
      const f = cardFigure(slug, rank);
      A[rank] = {
        held: !!(f && f.held), est: { man: d[rank].avg },
        pub: f && !f.held && !f.estimate ? { man: f.man, up: f.up, yen: f.yen, kindJa: f.kindJa, kindEn: f.kindEn } : null,
        sub: null,
      };
    }
    airlines[slug] = A;
  }
  const idx = (s) => REGIONS.findIndex((r) => r.code === SALARY[s].region);
  const slugs = Object.keys(SALARY).sort((a, b) => (idx(a) - idx(b)) || (rowOf.get(a).i - rowOf.get(b).i));
  const regions = REGIONS.map((r) => { const sl = slugs.filter((s) => SALARY[s].region === r.code); return { ...r, slugs: sl, n: sl.length }; });
  MEMO = { n: slugs.length, slugs, airlines, regions };
  return MEMO;
}

/** その会社・その職位のカードの額と札。rank は 'cap' / 'fo' だけ（乗員全体の額はカードに入れない） */
export function figure(A, rank, rule = CARD_RULE) {
  if (!RANKS.includes(rank)) throw new Error(`figure：職位「${rank}」はカードに出さない（機長・副操縦士だけ）`);
  if (rule !== 'published-first' && rule !== 'estimate-for-five') throw new Error(`figure：知らない決め方「${rule}」`);
  const F = A[rank], w = RANK_WORD[rank], sub = F.sub;
  if (F.held) return { kind: 'held', yen: null, labelJa: `${w.ja} 確認中`, labelEn: `${w.en} · Under review`, sub, extra: null };
  /* ★2026-10-26 英語の EN-11c：英語の札は会社ページ・2社比較と同じ言葉（estimated annual pay）を、カードの「職位 · 種類」の形で短く。
     「Estimated annual pay」と書き切ると、ドルの表示でも 320px と 1001px（箱がいちばん狭い）で副操縦士の札が2行に折れる
     （Est. ならドルは全幅で1行。円・AED の長い額で折れるのは前の「estimated salary」と同じだけ）。平均とは名乗らない */
  const est = { kind: 'est', yen: `¥${F.est.man.toLocaleString('en-US')}万`, labelJa: `${w.ja} 推定年収`, labelEn: `${w.en} · Est. annual pay`, sub, extra: null };
  if (!F.pub) return est;
  const pub = { kind: 'pub', yen: F.pub.yen, labelJa: `${w.ja} ${F.pub.kindJa}`, labelEn: `${w.en} · ${F.pub.kindEn}`, sub, extra: null };
  if (rule === 'estimate-for-five' && A.five) return { ...est, extra: { yen: pub.yen, labelJa: pub.labelJa, labelEn: pub.labelEn } };
  return pub;
}

/** 地域の推定年収の平均（万円・10万円で丸める）。'all' は全社の平均（地域の平均の平均ではない）。この区域はページに書かない */
export function regionMean(code, rank) {
  if (!RANKS.includes(rank)) throw new Error(`regionMean：職位「${rank}」`);
  const M = model(), sl = code === 'all' ? M.slugs : M.regions.find((r) => r.code === code)?.slugs;
  if (!sl) throw new Error(`regionMean：知らない地域「${code}」`);
  return Math.round(sl.reduce((a, s) => a + M.airlines[s][rank].est.man, 0) / sl.length / 10) * 10;
}
