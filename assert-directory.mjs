/* ════════════════════════════════════════════════════════════════
   assert-directory.mjs ── 航空会社一覧（world-airlines.html・en/world-airlines.html）と、
   一覧が読む台帳の静的な検査（ブラウザを使わない・ファイルを書かない・数秒）。

   守っているもの（どれも「画面は普通に動いたまま静かに壊れる」形）
     A) 年収の台帳（salary-data.mjs の SALARY）が1つの集合として揃っているか
        ── 会社ページが日英とも在る・地域は8つのどれか・国の表と公開 JSON が同じ会社を持つ・
           国の検索だけの呼び名（alt）が2つの国を指さない
     B) 一覧の行（airlines-meta.js）＝ SALARY と同じ会社・同じ金額・同じ免税・同じ地域
        （欧州は eu_fsc / eu_lcc で書く）。機種の段（fleet）を持たないのは決まった4社だけ
     C) ヘッダー検索の表（search.js）＝ SALARY と同じ会社。4社の社名・旗・略号は一覧の行と同じ字
     D) 地域ページ14枚と countries.html の社数・推定年収の平均が SALARY と合っている
     E) 一覧の形（directory-model.mjs）が台帳から正しく作られている ── 並び・金額と札・
        検索の鍵・比較のチェックの決め方（SWITCH に従う）・ロゴ
     L) カードを作るときにロゴの絵を読まない（読むと assert-generated.mjs の写し＝絵の無い所で生成が落ちる）。
        ※ 大きさの表（airline-logo-sizes.mjs）と絵の一致は assert-rollout.mjs の「A L-LOGO」が見ている（ここでは重ねない）

   ★ 期待する値はここで台帳から作る。directory-model.mjs / gen-directory.mjs / airline-logo.mjs は
     「検査される側」としてだけ読む（あちらの関数で期待値を作らない）。
   ★ --selftest は、台帳やページをわざと1か所だけ壊した写しを（メモリの中で）作り、
     ちょうどその項目だけが赤くなることを確かめる。ファイルには一切触らない。

   使い方: node assert-directory.mjs [--only A,B] [--root <dir>] [--selftest]
     --root <dir>  ページなどを <dir> から読む（無いファイルはこのファイルの在る所から）
   ════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';
import { SALARY } from './salary-data.mjs';
import { BASIS, TIERS, figures } from './salary-basis.mjs';
import { AIRLINE_COUNTRY, BY_CODE } from './airline-countries.mjs';
import { LEAD, SWITCH } from './airline-rollout.mjs';
import { unbake } from './cur-core.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2);
const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const RROOT = argOf('--root') ? path.resolve(argOf('--root')) : null;
const ONLY = argOf('--only') ? new Set(argOf('--only').split(',').map((s) => s.trim().toUpperCase())) : null;
const SELFTEST = argv.includes('--selftest');

/** <--root>/rel が在ればそれ、無ければこのファイルの在る所の rel */
const at = (rel) => (RROOT && fs.existsSync(path.join(RROOT, rel)) ? path.join(RROOT, rel) : path.join(ROOT, rel));
const read = (rel) => fs.readFileSync(at(rel), 'utf8');
const readOr = (rel, d = '') => (fs.existsSync(at(rel)) ? read(rel) : d);

/* ── 共有の言葉（契約。台帳から作れないものだけここに書く）──────────────── */
/** 地域の8つの符号（この順が一覧の並び） */
const REG8 = ['japan', 'asia', 'mideast', 'africa', 'europe', 'us', 'oceania', 'latam'];
/** 一覧の行の地域の書き方 → SALARY の地域（欧州だけ fsc / lcc で分けて書いてある） */
const LIST_REGION = { eu_fsc: 'europe', eu_lcc: 'europe' };
/** 機種の段（fleet）を持たない4社 ── 新しく fleet の無い行が増えたらここで止まる（レベリング図の全部の段に出てしまう） */
const NO_FLEET = ['airx-charter', 'eagle-jet', 'root-aviation', 'solairus'];
/** 地域ページ（日英7枚ずつ）→ 地域の符号 */
const HUB = { africa: 'africa', asia: 'asia', europe: 'europe', 'latin-america': 'latam', 'middle-east': 'mideast', 'north-america': 'us', oceania: 'oceania' };
const RW = { cap: { ja: '機長', en: 'Captain' }, fo: { ja: '副操縦士', en: 'First Officer' } };
/** 一覧カードに出してよい「年額の現金」（salary-basis.mjs の cardFigure と同じ鍵。ここで独立に持つ） */
const YEARLY = new Set(['cash_y', 'cash_y_over', 'max_y', 'target_y', 'avg_y', 'reward_y', 'month_x']);

const fleetOf = (row) => typeof row?.fleet === 'string' && row.fleet !== '';
const yen = (man) => `¥${man.toLocaleString('en-US')}万`;
const num = (s) => Number(String(s).replace(/,/g, () => ''));
const fold = (s) => String(s ?? '').normalize('NFKC').toLowerCase().trim();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** その会社・その職位のカードに出るべき金額と札（assert-basis.mjs の I と同じ決め方を、ここで作る） */
function want(I, slug, rank) {
  const w = RW[rank], avg = I.ledger[slug][rank].avg;
  const est = { kind: 'est', yen: yen(avg), labelJa: `${w.ja} 推定年収`, labelEn: `${w.en} estimated salary` };
  if (!BASIS[slug]) return est;
  const tier = BASIS[slug][rank]?.tier || 'held';
  if (tier === 'estimate') return est;
  const f = figures(slug, rank).find((x) => YEARLY.has(x.key) && !x.training);
  if (!f) return tier === 'held' ? { kind: 'held', yen: null, labelJa: `${w.ja} 確認中`, labelEn: `${w.en} · Under review` } : est;
  const up = f.key === 'max_y';
  return {
    kind: 'pub', yen: `${up ? '〜' : ''}${yen(f.man)}`,
    labelJa: `${w.ja} ${TIERS[tier].ja}${up ? '（上限）' : ''}`, labelEn: `${w.en} · ${TIERS[tier].en}${up ? ' (max)' : ''}`,
  };
}
/** 万円の平均を10万円で丸める（地域ページ・countries.html と同じ） */
const mean10 = (I, slugs, rank) => Math.round(slugs.reduce((a, s) => a + I.ledger[s][rank].avg, 0) / slugs.length / 10) * 10;
const regionSlugs = (I, code) => Object.keys(I.ledger).filter((s) => code === 'all' || I.ledger[s].region === code);

/* ── 読む（1回だけ）──────────────────────────────────────── */
/** airlines-meta.js の行（window.PV_AIRLINES）。slug は PV_slugOf で */
function list(src = read('airlines-meta.js')) {
  const win = {};
  new Function('window', src)(win);
  return win.PV_AIRLINES.map((r) => ({ ...r, slug: win.PV_slugOf(r) }));
}
/** search.js の行（var DB = [ … ]; の中身）。slug は f から */
function header(src = read('search.js')) {
  const a = src.indexOf('var DB = ['), z = src.indexOf('window.PV_DB = DB;');
  if (a < 0 || z < 0) throw new Error('search.js の形が変わった（var DB = [ / window.PV_DB = DB; が無い）');
  const end = src.lastIndexOf('];', z);
  const rows = new Function('return ' + src.slice(a + 'var DB = '.length, end + 1))();
  return rows.map((r) => ({ ...r, slug: String(r.f || '').replace(/^airlines\//, () => '').replace(/\.html$/, () => '') }));
}
const logosOf = (src) => { const w = {}; new Function('window', src)(w); return w.PV_LOGOS || {}; };
const htmlIn = (dir) => (fs.existsSync(at(dir)) ? fs.readdirSync(at(dir)).filter((f) => f.endsWith('.html')).map((f) => `${dir}/${f}`) : []);

async function readIN() {
  const hub = {};
  for (const p of Object.keys(HUB)) for (const rel of [`${p}-pilot-salary.html`, `en/${p}-pilot-salary.html`]) hub[rel] = read(rel);
  hub['countries.html'] = read('countries.html');
  const I = {
    ledger: structuredClone(SALARY), country: structuredClone(AIRLINE_COUNTRY), byCode: structuredClone(BY_CODE),
    json: JSON.parse(read('salary-data.json')),
    files: new Set([...htmlIn('airlines'), ...htmlIn('en/airlines')]),
    list: list(), header: header(), hub,
    page: { ja: read('world-airlines.html'), en: read('en/world-airlines.html') },
    css: readOr('pv-directory.css'), assets: {}, career: readOr('career.html'),
    logos: logosOf(read('airline-logos.js')),
    sw: new Set(SWITCH), M: null, fn: {}, err: '',
  };
  /* 検査される側（ここで期待値は作らない） */
  try {
    const G = await import(pathToFileURL(path.join(ROOT, 'gen-directory.mjs')).href);
    I.fn = { model: G.model, figure: G.figure, regionMean: G.regionMean, tickOf: G.tickOf, twoSlugs: G.twoSlugs,
      cards: G.cards, strip: G.strip, itemList: G.itemList, render: G.render };
    I.M = G.model();
  } catch (e) { I.err = `gen-directory.mjs / directory-model.mjs が読めない：${String(e.message).split('\n')[0].split(ROOT).join('')}`; }
  return I;
}

/* ── 項目 ────────────────────────────────────────────────── */
const R = (id, probs, info = '') => ({
  id, ok: probs.length === 0, info,
  detail: probs.slice(0, 6).join(' / ') + (probs.length > 6 ? ` …ほか${probs.length - 6}件` : ''),
});
const setDiff = (a, b) => [...a].filter((x) => !b.has(x));
const setEq = (name, a, b) => {
  const A = new Set(a), B = new Set(b), p = [];
  for (const x of setDiff(A, B)) p.push(`${x} が${name}にだけ在る`);
  for (const x of setDiff(B, A)) p.push(`${x} が${name}に無い`);
  return p;
};

/** A) 年収の台帳 */
function secA(I) {
  const S = Object.keys(I.ledger), out = [];
  out.push(R('A1', S.flatMap((s) => [`airlines/${s}.html`, `en/airlines/${s}.html`].filter((f) => !I.files.has(f)).map((f) => `${f} が無い`))));
  out.push(R('A2', S.filter((s) => !REG8.includes(I.ledger[s].region)).map((s) => `${s} の地域「${I.ledger[s].region}」は8つのどれでもない`)));
  out.push(R('A3', setEq('国の表（AIRLINE_COUNTRY）', Object.keys(I.country), S)));
  const ja = I.json.airlines || {};
  out.push(R('A4', [...setEq('salary-data.json', Object.keys(ja), S),
    ...Object.keys(ja).filter((s) => !ja[s]?.ladder).map((s) => `${s} に ladder が無い（レベリング図に段が出ない）`)]));
  const names = new Map(), p5 = [];
  const add = (v, code) => { if (!v) return; const k = fold(v); if (!names.has(k)) names.set(k, new Set()); names.get(k).add(code); };
  for (const c of Object.values(I.byCode)) for (const v of [c.ja, c.en, c.enIn, ...(Array.isArray(c.alt) ? c.alt : [])]) add(v, c.code);
  for (const c of Object.values(I.byCode)) {
    if (!('alt' in c)) continue;
    if (!Array.isArray(c.alt)) { p5.push(`${c.code} の alt が配列でない`); continue; }
    for (const a of c.alt) {
      if (typeof a !== 'string' || !a.trim()) { p5.push(`${c.code} の alt に空の呼び名`); continue; }
      const other = [...(names.get(fold(a)) || [])].filter((x) => x !== c.code);
      if (other.length) p5.push(`${c.code} の alt「${a}」は ${other.join('・')} の名前でもある（1つの名前が2つの国を指す）`);
    }
  }
  out.push(R('A5', p5));
  return out;
}

/** B) 一覧の行（airlines-meta.js） */
function secB(I) {
  const S = new Set(Object.keys(I.ledger)), out = [], seen = new Map();
  for (const r of I.list) seen.set(r.slug, (seen.get(r.slug) || 0) + 1);
  out.push(R('B1', [...I.list.filter((r) => !S.has(r.slug)).map((r) => `行 ${r.code}（${r.file}）は SALARY に無い会社`),
    ...[...seen].filter(([, n]) => n > 1).map(([s, n]) => `${s} の行が${n}つ`)]));
  const rows = I.list.filter((r) => S.has(r.slug));
  out.push(R('B2', rows.flatMap((r) => { const w = want(I, r.slug, 'cap').yen ?? '—'; return r.salary === w ? [] : [`${r.slug}：行「${r.salary}」／台帳「${w}」`]; })));
  out.push(R('B3', rows.filter((r) => r.taxfree !== (I.ledger[r.slug].taxFree === true)).map((r) => `${r.slug}：行の taxfree ${r.taxfree}／SALARY ${I.ledger[r.slug].taxFree}`)));
  out.push(R('B4', rows.flatMap((r) => {
    const p = [], g = LIST_REGION[r.region] || r.region;
    if (g !== I.ledger[r.slug].region) p.push(`${r.slug}：行の地域「${r.region}」／SALARY「${I.ledger[r.slug].region}」`);
    if (r.region === 'eu_fsc' && r.type !== 'fsc') p.push(`${r.slug}：eu_fsc なのに type「${r.type}」`);
    if (r.region === 'eu_lcc' && r.type !== 'lcc') p.push(`${r.slug}：eu_lcc なのに type「${r.type}」`);
    return p;
  })));
  out.push(R('B5', setEq('一覧の行', I.list.map((r) => r.slug), S)));
  const nf = I.list.filter((r) => !fleetOf(r)).map((r) => r.slug);
  out.push(R('B6', setEq('fleet の無い行', nf, NO_FLEET), `fleet の無い行：${nf.join('・') || 'なし'}（${nf.length}社）`));
  return out;
}

/** C) ヘッダー検索の表（search.js） */
function secC(I) {
  const S = new Set(Object.keys(I.ledger)), out = [], seen = new Map();
  for (const h of I.header) seen.set(h.slug, (seen.get(h.slug) || 0) + 1);
  out.push(R('C1', [...I.header.filter((h) => !S.has(h.slug)).map((h) => `${h.f} は SALARY に無い会社`),
    ...[...seen].filter(([, n]) => n > 1).map(([s, n]) => `${s} の行が${n}つ`)]));
  out.push(R('C2', setEq('ヘッダー検索の表', I.header.map((h) => h.slug), S)));
  const p3 = [];
  for (const s of NO_FLEET) {
    const h = I.header.find((x) => x.slug === s), r = I.list.find((x) => x.slug === s);
    if (!h) { p3.push(`${s} の行が search.js に無い`); continue; }
    if (!r) { p3.push(`${s} の行が airlines-meta.js に無い`); continue; }
    if (h.n !== I.ledger[s]?.ja) p3.push(`${s}：n「${h.n}」／SALARY「${I.ledger[s]?.ja}」`);
    if (h.e !== I.ledger[s]?.en) p3.push(`${s}：e「${h.e}」／SALARY「${I.ledger[s]?.en}」`);
    if (h.g !== r.flag) p3.push(`${s}：旗「${h.g}」／一覧の行「${r.flag}」`);
    if (!same(h.t, [r.code])) p3.push(`${s}：t ${JSON.stringify(h.t)}／一覧の略号 ["${r.code}"]`);
  }
  out.push(R('C3', p3));
  return out;
}

/** D) 地域ページ・countries.html の社数と平均（＋ D5 一覧の形の地域平均） */
function secD(I) {
  const out = [], p1 = [], p2 = [];
  for (const [p, code] of Object.entries(HUB)) {
    const sl = regionSlugs(I, code), N = sl.length, C = mean10(I, sl, 'cap'), F = mean10(I, sl, 'fo');
    const ja = unbake(I.hub[`${p}-pilot-salary.html`]), en = unbake(I.hub[`en/${p}-pilot-salary.html`]);
    const ms = [...ja.matchAll(/PILOT VALUE が掲載している[^。<]*?の航空会社(\d+)社では、機長の推定年収の平均が¥([\d,]+)万（[^）]*）、副操縦士の推定年収の平均が¥([\d,]+)万/g)];
    if (!ms.length) p1.push(`${p}：「PILOT VALUE が掲載している…」の文が読めない`);
    for (const m of ms) if (num(m[1]) !== N || num(m[2]) !== C || num(m[3]) !== F) p1.push(`${p}：文「${m[1]}社・¥${m[2]}万・¥${m[3]}万」／台帳「${N}社・${yen(C)}・${yen(F)}」`);
    const h2 = [...ja.matchAll(/<h2 id="airlines">[^<]*（(\d+)社）<\/h2>/g)];
    if (h2.length !== 1) p1.push(`${p}：<h2 id="airlines">…（N社）が ${h2.length} 個`);
    else if (num(h2[0][1]) !== N) p1.push(`${p}：見出し ${h2[0][1]}社／台帳 ${N}社`);
    const e2 = [...en.matchAll(/<h2 id="airlines">[^<]*\((\d+) airlines\)<\/h2>/g)];
    if (e2.length !== 1) p2.push(`en/${p}：<h2 id="airlines">… (N airlines) が ${e2.length} 個`);
    else if (num(e2[0][1]) !== N) p2.push(`en/${p}：見出し ${e2[0][1]} airlines／台帳 ${N}`);
  }
  out.push(R('D1', p1), R('D2', p2));
  const jp = regionSlugs(I, 'japan'), m3 = [...unbake(I.hub['middle-east-pilot-salary.html']).matchAll(/日本の掲載(\d+)社の機長の推定年収の平均は¥([\d,]+)万/g)];
  out.push(R('D3', m3.length ? m3.filter((m) => num(m[1]) !== jp.length || num(m[2]) !== mean10(I, jp, 'cap'))
    .map((m) => `middle-east：「日本の掲載${m[1]}社…¥${m[2]}万」／台帳「${jp.length}社…${yen(mean10(I, jp, 'cap'))}」`) : ['middle-east：「日本の掲載…社の機長の推定年収の平均は…」が読めない']));
  const all = Object.keys(I.ledger), m4 = /<div class="stat-label">世界の機長の推定年収<\/div>\s*<div[^>]*>¥([\d,]+)万<\/div>\s*<div class="stat-sub">掲載(\d+)社の推定年収の平均<\/div>/.exec(unbake(I.hub['countries.html']));
  out.push(R('D4', !m4 ? ['countries.html：「世界の機長の推定年収」の札が読めない']
    : [...(num(m4[1]) !== mean10(I, all, 'cap') ? [`countries.html：¥${m4[1]}万／台帳 ${yen(mean10(I, all, 'cap'))}`] : []),
      ...(num(m4[2]) !== all.length ? [`countries.html：掲載${m4[2]}社／台帳 ${all.length}社`] : [])]));
  const p5 = [];
  if (!I.fn.regionMean) p5.push(I.err || 'regionMean が無い');
  else {
    for (const code of [...REG8, 'all']) for (const rank of ['cap', 'fo']) {
      let got; try { got = I.fn.regionMean(code, rank); } catch (e) { p5.push(`regionMean(${code}, ${rank}) が投げた：${e.message}`); continue; }
      const w = mean10(I, regionSlugs(I, code), rank);
      if (got !== w) p5.push(`regionMean(${code}, ${rank}) = ${got}／台帳 ${w}`);
    }
    let threw = false; try { I.fn.regionMean('canada', 'cap'); } catch { threw = true; }
    if (!threw) p5.push('regionMean(知らない地域) が投げない');
  }
  out.push(R('D5', p5));
  return out;
}

/** 1枚のカードの塊（slug → 文字列）。<li class="wd-li" で切る */
const chunks = (html) => Object.fromEntries(String(html).split(/(?=<li class="wd-li")/).filter((c) => c.startsWith('<li class="wd-li"'))
  .map((c) => [/data-slug="([^"]*)"/.exec(c)?.[1], c]));
const figsOf = (html) => [...String(html).matchAll(/<p class="wd-fig[^"]*" data-rank="(cap|fo)"[^>]*>[\s\S]*?<b class="wd-v">([\s\S]*?)<\/b><\/p>/g)].map((m) => `${m[1]}:${m[2]}`);

/** E) 一覧の形（directory-model.mjs）── 期待値はここで台帳から作る */
function secE(I) {
  const ids = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'];
  if (!I.M || !I.fn.figure) return ids.map((id) => R(id, [I.err || '一覧の形が読めない']));
  const M = I.M, S = Object.keys(I.ledger), out = [], pos = new Map(I.list.map((r, i) => [r.slug, i]));
  const rowOf = (s) => I.list.find((r) => r.slug === s), hOf = (s) => I.header.find((h) => h.slug === s);
  /* E1 並び・地域の社数 */
  const order = [...S].sort((a, b) => (REG8.indexOf(I.ledger[a].region) - REG8.indexOf(I.ledger[b].region)) || ((pos.get(a) ?? 1e9) - (pos.get(b) ?? 1e9)));
  const p1 = [];
  if (M.n !== S.length) p1.push(`n = ${M.n}／SALARY ${S.length}`);
  if (!same(M.slugs, order)) p1.push('slugs が並び（地域の順 → 一覧の行の順）と違う');
  if (!same((M.regions || []).map((r) => r.code), REG8)) p1.push(`地域の並び ${(M.regions || []).map((r) => r.code).join(',')}`);
  let sum = 0;
  for (const r of M.regions || []) {
    sum += r.n;
    const w = order.filter((s) => I.ledger[s].region === r.code);
    if (r.n !== w.length || !same(r.slugs, w)) p1.push(`${r.code}：${r.n}社／台帳 ${w.length}社`);
  }
  if (sum !== S.length) p1.push(`地域の社数の合計 ${sum}／${S.length}`);
  out.push(R('E1', p1));
  /* E2 金額と札 */
  const p2 = [], cnt = { est: 0, pub: 0, held: 0 };
  for (const s of S) for (const rank of ['cap', 'fo']) {
    const A = M.airlines[s]; if (!A) { p2.push(`${s} が形に無い`); continue; }
    let f; try { f = I.fn.figure(A, rank); } catch (e) { p2.push(`${s} ${rank}：figure が投げた ${e.message}`); continue; }
    const w = want(I, s, rank); cnt[w.kind]++;
    for (const k of ['kind', 'yen', 'labelJa', 'labelEn']) if (f[k] !== w[k]) p2.push(`${s} ${rank} ${k}：「${f[k]}」／台帳「${w[k]}」`);
  }
  out.push(R('E2', p2, `金額の種類（機長＋副操縦士）：推定 ${cnt.est}・会社の公表 ${cnt.pub}・確認中 ${cnt.held}`));
  /* E3 検索の鍵と略号 */
  const p3 = [];
  for (const s of S) {
    const A = M.airlines[s], r = rowOf(s), h = hOf(s), c = I.byCode[I.country[s]] || null;
    if (!A || !r) continue;
    const codes = new Set(A.codes || []), keys = new Set(A.keys || []);
    const htok = (h?.t || []), cw = [r.code, ...htok.filter((t) => /^[A-Z0-9]{2,3}$/.test(t)), c?.code].filter(Boolean);
    for (const x of cw) if (!codes.has(String(x).toUpperCase())) p3.push(`${s}：略号「${x}」が codes に無い`);
    const kw = [I.ledger[s].ja, I.ledger[s].en, r.name, r.en, ...htok.filter((t) => !/^[A-Z0-9]{2,3}$/.test(t)), c?.ja, c?.en, ...(c?.alt || [])].filter(Boolean);
    for (const x of kw) if (!keys.has(x)) p3.push(`${s}：鍵「${x}」が keys に無い`);
    for (const k of keys) if (String(k).includes('|')) p3.push(`${s}：鍵「${k}」に | が入っている`);
    for (const rank of ['cap', 'fo']) if (A[rank]?.sub !== null) p3.push(`${s} ${rank}.sub が null でない`);
  }
  out.push(R('E3', p3));
  /* E4 機種の段・5社・2社比較・SWITCH・チェックの決め方・カードに出す名前 */
  const p4 = []; let lv = 0;
  const two = new Set(I.fn.twoSlugs());
  for (const s of S) {
    const A = M.airlines[s], r = rowOf(s); if (!A || !r) continue;
    const lvl = fleetOf(r); if (lvl) lv++;
    if (A.lvl !== lvl) p4.push(`${s}：lvl ${A.lvl}／fleet ${lvl}`);
    if (A.listed !== true) p4.push(`${s}：listed が true でない`);
    if (A.five !== LEAD.includes(s)) p4.push(`${s}：five ${A.five}`);
    if (A.two !== two.has(s)) p4.push(`${s}：two ${A.two}`);
    if (A.sw !== I.sw.has(s)) p4.push(`${s}：sw ${A.sw}／SWITCH ${I.sw.has(s)}`);
    if (I.fn.tickOf(A, 'ja') !== (A.two && I.sw.has(s))) p4.push(`${s}：日本語のチェック ${I.fn.tickOf(A, 'ja')}／two かつ SWITCH ${A.two && I.sw.has(s)}`);
    if (I.fn.tickOf(A, 'en') !== lvl) p4.push(`${s}：英語のチェック ${I.fn.tickOf(A, 'en')}／fleet ${lvl}`);
    if (!same(A.show, { ja: r.name, en: r.en, flag: r.flag })) p4.push(`${s}：カードの名前が一覧の行と違う`);
    if (A.code !== r.code || A.color !== r.color) p4.push(`${s}：略号・色が一覧の行と違う`);
  }
  const tj = S.filter((s) => M.airlines[s] && I.fn.tickOf(M.airlines[s], 'ja'));
  out.push(R('E4', p4, `機種の段：${lv}社が持つ・${S.length - lv}社が持たない／日本語のチェック：${tj.join('・')}（${tj.length}社）`));
  /* E5 「5社は推定を主に」の決め方（ページには書かない）*/
  const p5 = [];
  for (const s of S) for (const rank of ['cap', 'fo']) {
    const A = M.airlines[s]; if (!A) continue;
    let e, d; try { e = I.fn.figure(A, rank, 'estimate-for-five'); d = I.fn.figure(A, rank); } catch (x) { p5.push(`${s} ${rank}：${x.message}`); continue; }
    if (LEAD.includes(s)) {
      const w = want(I, s, rank), est = { kind: 'est', yen: yen(I.ledger[s][rank].avg), labelJa: `${RW[rank].ja} 推定年収`, labelEn: `${RW[rank].en} estimated salary` };
      const main = w.kind === 'held' ? w : est;
      for (const k of ['kind', 'yen', 'labelJa', 'labelEn']) if (e[k] !== main[k]) p5.push(`${s} ${rank}：主の ${k}「${e[k]}」／「${main[k]}」`);
      const wx = w.kind === 'pub' ? { yen: w.yen, labelJa: w.labelJa, labelEn: w.labelEn } : null;
      if (!same(e.extra ? { yen: e.extra.yen, labelJa: e.extra.labelJa, labelEn: e.extra.labelEn } : null, wx)) p5.push(`${s} ${rank}：2行目 ${JSON.stringify(e.extra)}／${JSON.stringify(wx)}`);
    } else if (!same(e, d)) p5.push(`${s} ${rank}：5社でないのに既定と違う`);
  }
  for (const lang of ['ja', 'en']) {
    const a = chunks(I.fn.cards(lang, M, 'estimate-for-five')), b = chunks(I.fn.cards(lang, M));
    for (const s of S) {
      if (!LEAD.includes(s)) { if (a[s] !== b[s]) p5.push(`${lang} ${s}：5社でないのにカードが既定と違う`); continue; }
      const n = ['cap', 'fo'].filter((rank) => want(I, s, rank).kind === 'pub').length;
      const got = (String(a[s]).match(/data-pub="1"/g) || []).length;
      if (got !== n) p5.push(`${lang} ${s}：公表額の2行目 ${got}／${n}`);
    }
  }
  out.push(R('E5', p5));
  /* E6 職位は2つだけ・英語のカードに素の円が無い・日英で同じ額・地域の帯・ItemList */
  const p6 = [];
  { let threw = false; try { I.fn.figure(M.airlines[S[0]], 'crew'); } catch { threw = true; } if (!threw) p6.push("figure(A, 'crew') が投げない（乗員全体の額がカードに入れる）"); }
  const cj = I.fn.cards('ja', M), ce = I.fn.cards('en', M);
  if (/¥/.test(ce.replace(/data-orig="[^"]*"/g, () => ''))) p6.push('英語のカードに data-orig の外の ¥ が在る');
  if (!same(figsOf(unbake(ce)), figsOf(cj))) p6.push('英語のカード（焼き込みを戻したもの）と日本語のカードの額が違う');
  if (figsOf(cj).length < S.length * 2) p6.push(`日本語のカードの金額の行が ${figsOf(cj).length}／${S.length * 2} 以上`);
  for (const lang of ['ja', 'en']) {
    const bs = [...String(I.fn.strip(lang, M)).matchAll(/<button[^>]*data-region="([^"]*)"[\s\S]*?<span class="rstrip-n"[^>]*>(\d+)<\/span><\/button>/g)];
    const w = ['all', ...REG8];
    if (!same(bs.map((m) => m[1]), w)) p6.push(`${lang}：地域の帯 ${bs.map((m) => m[1]).join(',')}`);
    for (const m of bs) { const n = regionSlugs(I, m[1]).length; if (num(m[2]) !== n) p6.push(`${lang}：帯の ${m[1]} ${m[2]}／台帳 ${n}`); }
    const il = String(I.fn.itemList(lang, M));
    if (!il.includes(`"numberOfItems":${S.length}\n`) || (il.match(new RegExp(`(?<![\\d,.])${S.length}(?![\\d,.])`, 'g')) || []).length !== 2) p6.push(`${lang}：ItemList に ${S.length} が2か所（説明と numberOfItems）でない`);
  }
  out.push(R('E6', p6));
  /* E7 ロゴ */
  out.push(R('E7', S.filter((s) => M.airlines[s] && M.airlines[s].logo !== (I.logos[s] ?? null)).map((s) => `${s}：logo ${M.airlines[s].logo}／airline-logos.js ${I.logos[s] ?? null}`)));
  return out;
}

/** L) カードを作るときにロゴの絵を読まない */
function secL(I) {
  if (!I.fn.cards) return [R('L2', [I.err || 'cards が無い'])];
  const p2 = [], plain = { ja: I.fn.cards('ja', I.M), en: I.fn.cards('en', I.M) };
  const orig = { readFileSync: fs.readFileSync, openSync: fs.openSync, readSync: fs.readSync };
  const img = (p) => typeof p !== 'number' && /\/assets\/airline-logos\//.test(String(p instanceof URL ? p.pathname : p).replace(/\\/g, () => '/'));
  try {
    fs.readFileSync = function (p, ...a) { if (img(p)) throw new Error(`絵を読んだ：${String(p).split(ROOT).join("")}`); return orig.readFileSync.call(this, p, ...a); };
    fs.openSync = function (p, ...a) { if (img(p)) throw new Error(`絵を開いた：${String(p).split(ROOT).join("")}`); return orig.openSync.call(this, p, ...a); };
    /* readSync は fd しか受け取らない。絵の fd は上の openSync で止まるので作られない。
       ここで差し替えるのは、名前つきの import（import { readSync } from 'node:fs'）も同じ関数を通らせるため。 */
    fs.readSync = function (...a) { return orig.readSync.apply(this, a); };
    syncBuiltinESMExports();
    for (const lang of ['ja', 'en']) {
      let got; try { got = I.fn.cards(lang, I.M); } catch (e) { p2.push(`${lang}：${e.message}`); continue; }
      if (got !== plain[lang]) p2.push(`${lang}：絵を読めないときのカードが違う`);
    }
  } finally {
    Object.assign(fs, orig);
    syncBuiltinESMExports();
  }
  return [R('L2', p2)];
}

const SECTIONS = { A: secA, B: secB, C: secC, D: secD, E: secE, L: secL };
const runScope = (I, scope) => [...scope].flatMap((l) => SECTIONS[l](I));

/* ── 自己検査：わざと1か所だけ壊した写しで、ちょうどその項目だけが赤くなるか ─── */
const clone = (I) => ({ ...structuredClone({ ...I, fn: null }), fn: { ...I.fn } });
const rowAt = (I, slug) => I.list.find((r) => r.slug === slug);
const bump = (I, rel, re) => { I.hub[rel] = I.hub[rel].replace(re, (m, a, n, b) => `${a}${Number(n) + 1}${b}`); };
const ROWS = [
  ['A1', (I) => { I.files.delete('en/airlines/solairus.html'); }, 'A', ['A1']],
  ['A2', (I) => { I.ledger.qantas.region = 'canada'; }, 'A', ['A2']],
  ['A3', (I) => { delete I.country.jal; }, 'A', ['A3']],
  ['A4', (I) => { delete I.json.airlines['eagle-jet'].ladder; }, 'A', ['A4']],
  ['A5', (I) => { I.byCode.GB.alt = [...(I.byCode.GB.alt || []), 'アメリカ']; }, 'A', ['A5']],
  ['B1', (I) => { const r = rowAt(I, 'ana'); r.file = 'airlines/nope.html'; r.slug = 'nope'; }, 'B', ['B1', 'B5']],
  ['B2', (I) => { rowAt(I, 'jal').salary = '¥9,999万'; }, 'B', ['B2']],
  ['B3', (I) => { const r = rowAt(I, 'emirates'); r.taxfree = !r.taxfree; }, 'B', ['B3']],
  ['B4', (I) => { rowAt(I, 'turkish-airlines').region = 'mideast'; }, 'B', ['B4']],
  ['B5', (I) => { I.list = I.list.filter((r) => r.slug !== 'jetstar'); }, 'B', ['B5']],
  ['B6', (I) => { delete rowAt(I, 'jetstar').fleet; }, 'B', ['B6']],
  ['C1', (I) => { const h = I.header.find((x) => x.slug === 'ana'); h.f = 'airlines/nope.html'; h.slug = 'nope'; }, 'C', ['C1', 'C2']],
  ['C2', (I) => { I.header = I.header.filter((h) => h.slug !== 'solairus'); }, 'C', ['C2', 'C3']],
  ['C3', (I) => { I.header.find((h) => h.slug === 'airx-charter').t = ['AXY']; }, 'C', ['C3']],
  ['D1', (I) => bump(I, 'asia-pilot-salary.html', /(の航空会社)(\d+)(社では)/), 'D', ['D1']],
  ['D2', (I) => bump(I, 'en/asia-pilot-salary.html', /(\()(\d+)( airlines\)<\/h2>)/), 'D', ['D2']],
  ['D3', (I) => bump(I, 'middle-east-pilot-salary.html', /(日本の掲載)(\d+)(社)/), 'D', ['D3']],
  ['D4', (I) => bump(I, 'countries.html', /(掲載)(\d+)(社の推定年収の平均)/), 'D', ['D4']],
  ['D5', (I) => { const f = I.fn.regionMean; I.fn.regionMean = (c, r) => f(c, r) + 10; }, 'D', ['D5']],
  ['E1', (I) => { const s = I.M.slugs; [s[0], s[1]] = [s[1], s[0]]; }, 'E', ['E1']],
  ['E2', (I) => { I.M.airlines.etihad.cap.pub = null; }, 'E', ['E2', 'E5']],
  ['E3a', (I) => { const A = I.M.airlines.ana; A.codes = A.codes.filter((c) => c !== 'NH'); }, 'E', ['E3']],
  ['E3b', (I) => { I.M.airlines.jal.cap.sub = 1; }, 'E', ['E3']],
  ['E3c', (I) => { const A = I.M.airlines.united; A.codes = A.codes.filter((c) => c !== 'US'); }, 'E', ['E3']],
  ['E3d', (I) => { const A = I.M.airlines.delta; A.keys = A.keys.filter((k) => k !== '米国'); }, 'E', ['E3']],
  ['E4a', (I) => { I.M.airlines.solairus.five = true; }, 'E', ['E4']],
  ['E4b', (I) => { I.M.airlines.solairus.lvl = true; }, 'E', ['E4']],
  ['E4c', (I) => { I.M.airlines.jal.sw = false; }, 'E', ['E4']],
  ['E5', (I) => { const f = I.fn.figure; I.fn.figure = (A, rank) => f(A, rank); }, 'E', ['E5']],
  ['E6', (I) => { const f = I.fn.cards; I.fn.cards = (lang, ...a) => f(lang, ...a) + (lang === 'en' ? '¥1,850万' : ''); }, 'E', ['E6']],
  ['E7', (I) => { I.M.airlines.ana.logo = null; }, 'E', ['E7']],
  ['L2', (I) => { const f = I.fn.cards; I.fn.cards = (...a) => { fs.readFileSync(path.join(ROOT, 'assets/airline-logos/ana.svg')); return f(...a); }; }, 'L', ['L2']],
];

/* ── 実行 ────────────────────────────────────────────────── */
const I = await readIN();
if (SELFTEST) {
  const all = runScope(I, Object.keys(SECTIONS)), ids = all.map((r) => r.id), bad = [];
  const red0 = all.filter((r) => !r.ok).map((r) => r.id);
  if (red0.length) bad.push(`壊す前から赤い：${red0.join(', ')}`);
  for (const id of ids) if (!ROWS.some(([n]) => n.replace(/[a-z]$/, () => '') === id)) bad.push(`${id} に自己検査の行が無い`);
  for (const [name, doctor, scope, expected] of ROWS) {
    const J = clone(I);
    try { doctor(J); } catch (e) { bad.push(`${name}：壊し方が当たらない（${e.message}）`); continue; }
    const red = runScope(J, scope).filter((r) => !r.ok).map((r) => r.id);
    if (!same([...new Set(red)].sort(), [...expected].sort())) bad.push(`${name}：赤 [${red.join(', ')}]／期待 [${expected.join(', ')}]`);
  }
  for (const b of bad) console.log(`❌ selftest ${b}`);
  console.log(bad.length ? `\nassert-directory --selftest：${bad.length} 件 落ちた（${ROWS.length} 行・${ids.length} 項目）`
    : `✅ assert-directory --selftest：${ROWS.length} 行すべて、壊した項目だけが赤くなった（${ids.length} 項目）`);
  process.exit(bad.length ? 1 : 0);
}
const res = runScope(I, ONLY ? Object.keys(SECTIONS).filter((l) => ONLY.has(l)) : Object.keys(SECTIONS));
for (const r of res) if (!r.ok) console.log(`❌ ${r.id} ${r.detail}`);
for (const r of res) if (r.info) console.log(`   ${r.id}：${r.info}`);
const nBad = res.filter((r) => !r.ok).length;
console.log(nBad ? `\nassert-directory：${nBad} / ${res.length} 項目 落ちた` : `✅ assert-directory：${res.length} 項目すべて通過`);
process.exit(nBad ? 1 : 0);
