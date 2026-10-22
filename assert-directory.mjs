/* ════════════════════════════════════════════════════════════════
   assert-directory.mjs ── 航空会社一覧（world-airlines.html・en/world-airlines.html）と、
   一覧が読む台帳の静的な検査（ブラウザを使わない・ファイルを書かない・数秒）。

   守っているもの（どれも「画面は普通に動いたまま静かに壊れる」形）
     A) 年収の台帳（salary-data.mjs の SALARY）が1つの集合として揃っているか
        ── 会社ページが日英とも在る・地域は8つのどれか・国の表と公開 JSON が同じ会社を持つ・
           国の検索だけの呼び名（alt）が2つの国を指さない
     B) 一覧の行（airlines-meta.js）＝ SALARY と同じ会社・同じ金額・同じ免税・同じ地域
        （欧州は eu_fsc / eu_lcc で書く）。機種の段（fleet）を持たないのは決まった4社だけ。
        行の地域の符号は、画面（年収の図の会社選び＝salary-leveling.js）では必ず地域の名前で出る（B7）。
        旗は国の表（airline-countries.mjs）の旗と同じ・国が決まらない会社は旗なし（B8。ヘッダー検索の表も）
     C) ヘッダー検索の表（search.js）＝ SALARY と同じ会社。4社の社名・旗・略号は一覧の行と同じ字
     D) 地域ページ14枚と countries.html の社数・推定年収の平均が SALARY と合っている
     E) 一覧の形（directory-model.mjs）が台帳から正しく作られている ── 並び・金額と札・
        検索の鍵・比較のチェックの決め方（SWITCH に従う）・ロゴ
     F) 一覧のページ（日英）＝ gen-directory.mjs が台帳から書いた112枚のカード・地域ボタン・社数のまま
        ── 並び・リンク・社名と旗・略号・ロゴ・額と札・地域ボタンの社数・手で書いた社数が無い・日英が同じ形・
           生成の流し忘れが無い・一覧の台本はページの外（pv-directory.js）で、ヘッダーのログインの行だけページの中・
           部品（gen-directory.mjs の ASSETS）はどれも中身の指紋（?v=）で読む・左のメニューとヘッダーが1つずつ・
           見つからないときの地域の8つのボタン（PV-DIR-ELSE）は地域の順・名前・社数のまま hidden で出荷
     G) 見出しと検索欄 ── 見出しの字（日本語は「、」の後ろでだけ折れる2つの <span>）・検索欄は見出しの帯の中に HTML で在る
        （type="search"・字はそのまま）・国の帯と地図（#wd-explore）は検索欄も地域ボタンもカードも持たない・
        結果の見出し（すべて／All・社数の書き方）・見つからないときの並び・台本が動かないときの隠し方・
        見た目の決まり（transition は transform / opacity だけ・色はトークン・検索欄の消すボタンを隠さない）
     H) カードの形 ── 額の行は機長→副操縦士の2行・職位の語から額まで24字以内（check-salary.mjs が読める）・
        リンクの中に押せる部品を入れない・額の行に手取りや月額の語を入れない・
        比べる印（label.wd-cmp）はリンクの外で、決まりどおりのカードにだけ1つ（日本語 ＝ data-two="1" かつ SWITCH・英語 ＝ fleet）（H4）・
        日本語の data-two="1" ＝ career.html が2社比較で出せる会社・英語のカードと盆は career.html を指さない（H5）
     W) check-salary.mjs の読み方そのもの（あちらのソースから切り出す）で、どのカードのどの額も
        そのカードの会社として読まれ、別の会社として読まれない（境目の印 <!--wd>--> が1枚に1つ）
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
/** 地域の名前（日・英）。一覧の地域ボタン・年収の図の会社選びに出る字（どちらもこの名前で出ること） */
const REGION_LABEL = {
  all: ['すべて', 'All'], japan: ['日本', 'Japan'], asia: ['アジア', 'Asia'], mideast: ['中東', 'Middle East'], africa: ['アフリカ', 'Africa'],
  europe: ['欧州', 'Europe'], us: ['北米', 'North America'], oceania: ['オセアニア', 'Oceania'], latam: ['中南米', 'Latin America'],
};
/** 一覧の2枚のページ（言語 → ファイル） */
const PAGE_REL = { ja: 'world-airlines.html', en: 'en/world-airlines.html' };
/** 境目の印（カードの社名のリンクと額の行のあいだ。check-salary.mjs が社名から額へ跨いで読まないため） */
const BARRIER = '<!--wd>-->';
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
/** 一覧の並び（地域の順 → 一覧の行の順）。ここで台帳と一覧の行から作る */
function orderOf(I) {
  const pos = new Map(I.list.map((r, i) => [r.slug, i]));
  return Object.keys(I.ledger).sort((a, b) => (REG8.indexOf(I.ledger[a].region) - REG8.indexOf(I.ledger[b].region)) || ((pos.get(a) ?? 1e9) - (pos.get(b) ?? 1e9)));
}
/** 国の表の旗（国が決まらない会社は ''） */
const flagOf = (I, slug) => (I.byCode[I.country[slug]] || {}).flag || '';
const unesc = (s) => String(s).replace(/&(amp|lt|gt|quot);/g, (_, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"' }[k]));

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
    css: readOr('pv-directory.css'), tokens: readOr('pv-tokens.css'), assets: {}, career: readOr('career.html'),
    logos: logosOf(read('airline-logos.js')),
    lev: readOr('salary-leveling.js'), cs: read('check-salary.mjs'),
    sw: new Set(SWITCH), M: null, fn: {}, err: '',
  };
  /* 検査される側（ここで期待値は作らない） */
  try {
    const G = await import(pathToFileURL(path.join(ROOT, 'gen-directory.mjs')).href);
    I.fn = { model: G.model, figure: G.figure, regionMean: G.regionMean, tickOf: G.tickOf, twoSlugs: G.twoSlugs,
      cards: G.cards, strip: G.strip, itemList: G.itemList, render: G.render, blocks: G.BLOCKS.map((b) => b.id), assets: [...G.ASSETS] };
    for (const f of G.ASSETS) I.assets[f] = readOr(f, null);
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
  /* B7 年収の図の会社選び（salary-leveling.js）は、行の地域の符号（eu_fsc など）を画面に出さず、地域の名前で出す。
     名前の表と名前の決め方はあちらのソースから切り出して動かす（ここで写さない） */
  const p7 = [], lines = String(I.lev).split('\n');
  const tbl = lines.filter((l) => l.startsWith('  var REGION_NAME = {')), fnl = lines.filter((l) => l.startsWith('  function regionName(r) {'));
  if (tbl.length !== 1 || fnl.length !== 1) p7.push(`salary-leveling.js の地域の名前の表（var REGION_NAME）と regionName が1つずつでない（${tbl.length}・${fnl.length}）`);
  else {
    const nameIn = (en) => new Function('IS_EN', `${tbl[0]}\n${fnl[0]}\nreturn regionName;`)(en);
    const jaN = nameIn(false), enN = nameIn(true);
    for (const t of [...new Set(I.list.map((r) => r.region))]) {
      const w = REGION_LABEL[LIST_REGION[t] || t];
      if (!w) { p7.push(`行の地域「${t}」に名前が無い（契約の表）`); continue; }
      if (jaN(t) !== w[0] || enN(t) !== w[1]) p7.push(`地域「${t}」が「${jaN(t)}」／「${enN(t)}」と出る（「${w[0]}」／「${w[1]}」であること）`);
    }
    if (jaN('zz_x') !== '' || enN('zz_x') !== '') p7.push('知らない地域の符号に名前以外の字を出す（何も出さないこと）');
  }
  const html = lines.filter((l) => /'[^']*</.test(l) && /\.region\b/.test(l));
  for (const l of html) if (/\.region\b/.test(l.replace(/regionName\(a\.region\)/g, () => ''))) p7.push(`画面に符号のまま出す行：${l.trim().slice(0, 90)}`);
  if (!html.some((l) => l.includes('regionName(a.region)'))) p7.push('会社選びの一覧が地域の名前（regionName）を出していない');
  out.push(R('B7', p7));
  /* B8 旗 ＝ 国の表の旗（国が決まらない会社は旗なし）。一覧の行とヘッダー検索の表の両方 */
  const p8 = [];
  for (const r of rows) if ((r.flag || '') !== flagOf(I, r.slug)) p8.push(`${r.slug}：一覧の行の旗「${r.flag}」／国の表「${flagOf(I, r.slug)}」`);
  for (const h of I.header.filter((x) => S.has(x.slug))) if ((h.g || '') !== flagOf(I, h.slug)) p8.push(`${h.slug}：ヘッダー検索の旗「${h.g}」／国の表「${flagOf(I, h.slug)}」`);
  out.push(R('B8', p8));
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

/* ── ページを読む道具（どれも unbake したページの字を読む）──────────────────── */
/** ページのカード（<li class="wd-li" … </li>）を順に */
function cardsOf(html) {
  return [...String(html).matchAll(/<li class="wd-li"([^>]*)>([\s\S]*?)<\/li>/g)].map((m) => {
    const at = (k) => new RegExp(`\\b${k}="([^"]*)"`).exec(m[1])?.[1] ?? null;
    return { slug: at('data-slug'), region: at('data-region'), type: at('data-type'), tax: at('data-tax'), lvl: at('data-lvl'), two: at('data-two'),
      html: m[0], body: m[2], start: m.index, end: m.index + m[0].length };
  });
}
/** カードの額の行（職位・2行目か・隠した社名・札・額・行の字）。札と額は字のまま（間にタグが挟まればタグごと＝F2 で違いになる） */
const figLines = (card) => [...card.matchAll(/<p class="wd-fig[^"]*" data-rank="(cap|fo)"([^>]*)>([\s\S]*?)<\/p>/g)].map((m) => {
  const body = m[3], hid = /^<span class="wd-vh">([^<]*)<\/span>/.exec(body), b = body.indexOf('<b class="wd-v">'), e = body.lastIndexOf('</b>');
  return { rank: m[1], pub: /data-pub="1"/.test(m[2]), hid: hid ? unesc(hid[1]) : null,
    label: hid && b >= 0 ? unesc(body.slice(hid[0].length, b)) : null, amount: b >= 0 && e > b ? unesc(body.slice(b + '<b class="wd-v">'.length, e)) : null,
    src: m[0], at: m.index };
});
/** <!--ID--> … <!--/ID--> の中身（無ければ null） */
const blockOf = (html, id) => { const a = html.indexOf(`<!--${id}-->`), z = html.indexOf(`<!--/${id}-->`); return a < 0 || z < a ? null : { a, z, text: html.slice(a, z) }; };
/** 2枚のページ（unbake 済み）。1回の実行で1回だけ作る */
const UNB = new WeakMap();
const pagesOf = (I) => { if (!UNB.has(I.page)) UNB.set(I.page, { ja: unbake(I.page.ja), en: unbake(I.page.en) }); return UNB.get(I.page); };
/** ヘッダーのログインの行の頭（ページの中に残す。db/test-pay-gate.mjs がページの字を読む） */
const LOGIN_LINE = "(function(){try{var u=JSON.parse(localStorage.getItem('pv_user')||'null');var b=document.getElementById('nav-auth-btn');";

/** F) 一覧のページ（日英）── 期待値はここで台帳・一覧の行・ロゴの表から作る */
function secF(I) {
  const U = pagesOf(I), S = Object.keys(I.ledger), N = S.length, order = orderOf(I), out = [];
  const rowOf = new Map(I.list.map((r) => [r.slug, r]));
  const p = { F1: [], F2: [], F3: [], F4: [], F5: [], F6: [], F7: [], F9: [], F10: [] };
  const twins = {};
  for (const lang of ['ja', 'en']) {
    const h = U[lang], C = cardsOf(h), en = lang === 'en', rel = PAGE_REL[lang];
    /* F1 枚数と並び */
    if (C.length !== N) p.F1.push(`${rel}：カード ${C.length} 枚／台帳 ${N} 社`);
    if (!same(C.map((c) => c.slug), order)) p.F1.push(`${rel}：カードの並びが台帳の並び（地域の順 → 一覧の行の順）と違う`);
    /* F2 1枚ずつ */
    for (const c of C) {
      const r = rowOf.get(c.slug), d = I.ledger[c.slug];
      if (!r || !d) { p.F2.push(`${rel}：${c.slug} は台帳か一覧の行に無い`); continue; }
      const q = [];
      const link = /<a class="wd-go" href="([^"]*)">([\s\S]*?)<\/a>/.exec(c.body);
      if (!link || link[1] !== `airlines/${c.slug}.html`) q.push(`リンク ${link ? link[1] : '無し'}`);
      const name = unesc(/<span class="wd-name" id="wn-[^"]*">([^<]*)<\/span>/.exec(c.body)?.[1] ?? '');
      const wn = `${r.flag ? `${r.flag} ` : ''}${en ? r.en : r.name}`;
      if (name !== wn) q.push(`社名「${name}」／一覧の行「${wn}」`);
      const sub = unesc(/<span class="wd-sub">([^<]*)<\/span>/.exec(c.body)?.[1] ?? '');
      const ws = en ? REGION_LABEL[d.region][1] : r.en;
      if (sub !== ws) q.push(`2行目「${sub}」／「${ws}」`);
      const code = unesc(/<span class="wd-code">([^<]*)<\/span>/.exec(c.body)?.[1] ?? '');
      if (code !== r.code) q.push(`略号「${code}」／一覧の行「${r.code}」`);
      if (c.region !== d.region) q.push(`data-region ${c.region}／SALARY ${d.region}`);
      if (c.type !== r.type) q.push(`data-type ${c.type}／一覧の行 ${r.type}`);
      if (c.tax !== (d.taxFree === true ? '1' : '0')) q.push(`data-tax ${c.tax}`);
      if (c.lvl !== (fleetOf(r) ? '1' : '0')) q.push(`data-lvl ${c.lvl}／fleet ${fleetOf(r)}`);
      const lg = /<span class="wd-logo"><span class="pvg-logo([^"]*)" aria-hidden="true">([\s\S]*?)<\/span><\/span>/.exec(c.body);
      const ext = I.logos[c.slug];
      if (!lg) q.push('ロゴの札が無い');
      else if (ext) {
        const img = /<img ([^>]*)>/.exec(lg[2])?.[1] ?? '', src = /\bsrc="([^"]*)"/.exec(img)?.[1] ?? '';
        if (lg[1] !== '' || !src.endsWith(`assets/airline-logos/${c.slug}.${ext}`) || !/\bloading="lazy"/.test(img)) q.push(`ロゴ「${src}」${/\bloading="lazy"/.test(img) ? '' : '（loading="lazy" が無い）'}`);
      } else if (lg[1] !== ' is-mono' || /<img\b/.test(lg[2])) q.push('ロゴの無い会社なのに頭文字の札でない');
      for (const f of figLines(c.body)) {
        const w = want(I, c.slug, f.rank);
        if (f.hid !== (en ? d.en : d.ja)) q.push(`${f.rank} の隠した社名「${f.hid}」／台帳「${en ? d.en : d.ja}」`);
        if (f.label !== (en ? w.labelEn : w.labelJa)) q.push(`${f.rank} の札「${f.label}」／台帳「${en ? w.labelEn : w.labelJa}」`);
        if (f.amount !== (w.yen ?? '—')) q.push(`${f.rank} の額「${f.amount}」／台帳「${w.yen ?? '—'}」`);
      }
      if (q.length) p.F2.push(`${rel} ${c.slug}：${q.join('・')}`);
    }
    /* F3 地域の9つのボタン */
    const st = blockOf(h, 'PV-DIR-REGIONS');
    const bs = st ? [...st.text.matchAll(/<button\b([^>]*)>[\s\S]*?<span class="rstrip-l">([^<]*)<\/span><span class="rstrip-n"[^>]*>([^<]*)<\/span><\/button>/g)] : [];
    const codes = bs.map((m) => /data-region="([^"]*)"/.exec(m[1])?.[1]);
    if (!same(codes, ['all', ...REG8])) p.F3.push(`${rel}：地域ボタン ${codes.join(',') || '無し'}`);
    for (const m of bs) {
      const code = /data-region="([^"]*)"/.exec(m[1])?.[1], lab = REGION_LABEL[code]?.[en ? 1 : 0];
      const dl = unesc(/data-label="([^"]*)"/.exec(m[1])?.[1] ?? '');
      if (dl !== lab || unesc(m[2]) !== lab) p.F3.push(`${rel} ${code}：名前「${dl}」「${m[2]}」／「${lab}」`);
      const n = code === 'all' ? N : C.filter((c) => c.region === code).length;
      if (m[3] !== String(n)) p.F3.push(`${rel} ${code}：社数 ${m[3]}／カード ${n} 枚`);
    }
    /* F3（DG）見つからないときの地域の8つのボタン（PV-DIR-ELSE）── 地域の順・名前・その地域の社数・どれも hidden で出荷 */
    const el = blockOf(h, 'PV-DIR-ELSE');
    const eb = el ? [...el.text.matchAll(/<button\b([^>]*)><span class="wd-else-l">([^<]*)<\/span><span class="wd-else-n">([^<]*)<\/span><\/button>/g)] : [];
    const ecodes = eb.map((m) => /data-region="([^"]*)"/.exec(m[1])?.[1]);
    if (!el) p.F3.push(`${rel}：PV-DIR-ELSE が無い`);
    else if (!same(ecodes, REG8)) p.F3.push(`${rel}：見つからないときの地域ボタン ${ecodes.join(',') || '無し'}`);
    for (const m of eb) {
      const code = /data-region="([^"]*)"/.exec(m[1])?.[1], lab = REGION_LABEL[code]?.[en ? 1 : 0];
      if (!/\bclass="wd-else-b"/.test(m[1])) p.F3.push(`${rel} 見つからないとき ${code}：class が wd-else-b でない`);
      if (unesc(m[2]) !== lab) p.F3.push(`${rel} 見つからないとき ${code}：名前「${m[2]}」／「${lab}」`);
      const n = C.filter((c) => c.region === code).length;
      if (m[3] !== String(n)) p.F3.push(`${rel} 見つからないとき ${code}：社数 ${m[3]}／カード ${n} 枚`);
      if (!/(?:^|\s)hidden(?:\s|$|=)/.test(m[1])) p.F3.push(`${rel} 見つからないとき ${code}：hidden が無い（台本が当たりの数を書くまで見せない）`);
    }
    /* F4 社数を書く所 */
    const ns = [...h.matchAll(/<!--PV-DIR-N-->([\s\S]*?)<!--\/PV-DIR-N-->/g)].map((m) => m[1]);
    if (!ns.length) p.F4.push(`${rel}：PV-DIR-N が無い`);
    for (const v of ns) if (v !== String(N)) p.F4.push(`${rel}：PV-DIR-N「${v}」／${N}`);
    if (!h.includes(`"numberOfItems":${N}\n`)) p.F4.push(`${rel}：numberOfItems が ${N} でない`);
    if (!(/<title>([^<]*)<\/title>/.exec(h)?.[1] || '').match(new RegExp(`(?<![\\d,.])${N}(?![\\d,.])`))) p.F4.push(`${rel}：<title> に ${N} が無い`);
    for (const m of h.matchAll(/id="pc-([a-z]+)">([^<]*)</g)) {
      const n = REG8.includes(m[1]) ? regionSlugs(I, m[1]).length : null;
      if (m[2] !== (en ? `${n} airlines` : `${n}社`)) p.F4.push(`${rel} pc-${m[1]}：「${m[2]}」／${n}`);
    }
    /* F5 手で書いた社数が無い */
    let t = h.replace(/<title>[\s\S]*?<\/title>/g, () => '').replace(/<script\b[\s\S]*?<\/script>/g, () => '').replace(/<style\b[\s\S]*?<\/style>/g, () => '')
      .replace(/<!--PV-SEO-->[\s\S]*?<!--\/PV-SEO-->/g, () => '').replace(/<!--PV-CBAND-->[\s\S]*?<!--\/PV-CBAND-->/g, () => '');
    for (const id of I.fn.blocks || []) t = t.replace(new RegExp(`<!--${id}-->[\\s\\S]*?<!--/${id}-->`, 'g'), () => '');
    t = t.replace(/(id="pc-[a-z]+">)[^<]*/g, (_, a) => a);
    for (const m of t.matchAll(/(?<![\d,.])\d{2,3}\s*(社|airlines)/gi)) p.F5.push(`${rel}：手で書いた社数「${m[0]}」（…${t.slice(Math.max(0, m.index - 20), m.index).replace(/\s+/g, ' ')}）`);
    /* F6 日英の形（タグ・class・data-slug・data-region・data-rank の並び） */
    const g = h.indexOf('<ul id="airline-grid"'), ge = blockOf(h, 'PV-DIR-CARDS');
    const seg = (g < 0 || !ge ? '' : h.slice(g, ge.z)) + (st ? st.text : '') + (el ? el.text : '');
    twins[lang] = [...seg.replace(/<label class="wd-cmp"[\s\S]*?<\/label>/g, () => '').matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)]
      .map((m) => [m[1], ...['class', 'data-slug', 'data-region', 'data-rank'].map((k) => new RegExp(`\\b${k}="([^"]*)"`).exec(m[2])?.[1] ?? '')].join('|'));
    /* F7 生成の流し忘れ（素のページで） */
    if (I.fn.render) { let w; try { w = I.fn.render(lang, I.page[lang]); } catch (e) { p.F7.push(`${rel}：${e.message}`); } if (w !== undefined && w !== I.page[lang]) p.F7.push(`${rel} が台帳と合っていない（node gen-directory.mjs）`); }
    else p.F7.push(I.err || 'render が無い');
    /* F10 左のメニューとヘッダーが1つずつ（assert-pay-rows.mjs の枚数の静的な半分） */
    const nav = (I.page[lang].match(/<nav class="mr-side"/g) || []).length, mn = (I.page[lang].match(/id="main-nav"/g) || []).length;
    if (nav !== 1 || mn !== 1) p.F10.push(`${rel}：<nav class="mr-side"> ${nav}・id="main-nav" ${mn}（1つずつであること）`);
  }
  if (!same(twins.ja, twins.en)) {
    const i = twins.ja.findIndex((x, k) => x !== twins.en[k]);
    p.F6.push(`日英でカード・地域ボタンの形が違う（${twins.ja.length}／${twins.en.length} 個・最初の違い：${twins.ja[i] ?? '無し'} ／ ${twins.en[i] ?? '無し'}）`);
  }
  /* F9 一覧の台本はページの外（pv-directory.js）── ページに台本の中身が残っていない・ヘッダーのログインの行はページの中の台本に1つ・
     ASSETS の部品はどれも、両方のページが中身の指紋（?v= ＝ sha256 の頭8字）を付けて読む（古い部品が残らない） */
  const sha8 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
  if (!I.fn.assets) p.F9.push(I.err || 'gen-directory.mjs の ASSETS が読めない');
  for (const lang of ['ja', 'en']) {
    const h = I.page[lang], rel = PAGE_REL[lang], up = lang === 'en' ? '../' : '';
    for (const w of ['const CARDS', 'createCard']) if (h.includes(w)) p.F9.push(`${rel}：「${w}」がページに在る（一覧の台本は pv-directory.js）`);
    const inl = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].filter((m) => m[1].includes(LOGIN_LINE)).length;
    if (inl !== 1) p.F9.push(`${rel}：ヘッダーのログインの行を持つページの中の台本が ${inl} 個（1つであること）`);
    for (const f of I.fn.assets || []) {
      const src = I.assets[f];
      if (src == null) { p.F9.push(`${f} が無い`); continue; }
      const want = sha8(src), refs = [...h.matchAll(new RegExp(`(?:src|href)=(["'])${esc(up + f)}(?:\\?v=([^"']*))?\\1`, 'g'))];
      if (!refs.length) p.F9.push(`${rel}：${up + f} を読んでいない`);
      for (const m of refs) if (m[2] !== want) p.F9.push(`${rel}：${up + f}?v=${m[2] ?? '（無し）'}／中身の指紋 ${want}`);
    }
  }
  return Object.entries(p).map(([id, probs]) => R(id, probs));
}

/* ── G) 見出しと検索欄（DG）。字は台帳（シート・進行役の決め）のまま。ここに書いた字が正 ── */
const H1 = { ja: '次のキャリアを、選択する', en: 'Choose your next career' };
/** 日本語の見出しは「、」の後ろでだけ折れる（2つの半分がどちらも折れない）。390px でも語の途中で折れない */
const H1_HALVES = ['次のキャリアを、', '選択する'];
const PH = { ja: '航空会社名・国名で検索（例：Emirates, フランス）', en: 'Search by airline or country (e.g. Emirates, France)' };
const ARIA = { ja: '航空会社名・国名で検索', en: 'Search by airline or country' };
const ALL_WORD = { ja: 'すべて', en: 'All' };
const CLEAR = { ja: '絞り込みを解除', en: 'Clear filters' };
const NONE = { ja: '該当する航空会社が見つかりませんでした', en: 'No airlines matched your search' };
const FMT = { ja: '{n}社', en: '{n} airlines' };
const FMT_ONE = { ja: null, en: '{n} airline' };
const HEAD_Q = "<script>(function(){try{if(/[?&]q=[^&#]/.test(location.search))document.documentElement.classList.add('wd-q');}catch(e){}}());</script>";
const NOSCRIPT = '<noscript><style>.wd-search,#filter-bar,.view-toggle,.map-wrapper,.wd-cmp,.wd-tray{display:none!important}</style></noscript>';
/** id="…" を持つ <div> の始まりから、対になる </div> まで（div の入れ子を数える）。無い・閉じない・2つ以上なら null */
function divById(html, id) {
  const hits = [...html.matchAll(new RegExp(`<div\\b[^>]*\\bid="${id}"[^>]*>`, 'g'))];
  return hits.length === 1 ? divAt(html, hits[0].index) : null;
}
/** html の a から始まる <div> の、対になる </div> まで */
function divAt(html, a) {
  const tag = /<(\/?)div\b[^>]*>/g;
  tag.lastIndex = a;
  let d = 0, m;
  while ((m = tag.exec(html))) { d += m[1] ? -1 : 1; if (d === 0) return { a, z: m.index + m[0].length, text: html.slice(a, m.index + m[0].length) }; }
  return null;
}
const attrOf = (tag, k) => new RegExp(`\\s${k}="([^"]*)"`).exec(tag)?.[1] ?? null;
const tagsWith = (html, idOrClass) => [...html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)].filter((m) => idOrClass(m[2])).map((m) => ({ tag: m[1].toLowerCase(), attrs: m[2], at: m.index, end: m.index + m[0].length }));
const textAfter = (html, t) => { const z = html.indexOf(`</${t.tag}>`, t.end); return z < 0 ? null : unesc(html.slice(t.end, z).replace(/<[^>]*>/g, () => '')); };
const hasId = (id) => (a) => attrOf(a, 'id') === id;
const hasClass = (c) => (a) => (attrOf(a, 'class') || '').split(/\s+/).includes(c);

/** G) 見出し・検索欄・結果の見出し・見つからないとき（日英）と、その見た目の決まり（pv-directory.css の PV-DIR-DATA） */
function secG(I) {
  const p = { G1: [], G2: [], G2b: [], G3: [], G4: [], G5: [], G6: [], G7: [] };
  for (const lang of ['ja', 'en']) {
    const h = I.page[lang], rel = PAGE_REL[lang];
    /* G1 検索欄は HTML に在る（台本が作らない）・見出しの帯（#wa-hero）の .wd-search の中・type="search"・字はそのまま */
    const inputs = tagsWith(h, hasId('search'));
    const hero = divById(h, 'wa-hero'), bi = hero ? hero.text.split('<div class="wd-search" role="search">') : [];
    const box = bi.length === 2 ? divAt(h, hero.a + bi[0].length) : null;
    if (inputs.length !== 1 || inputs[0].tag !== 'input') p.G1.push(`${rel}：id="search" の <input> が ${inputs.length} 個`);
    else {
      const a = inputs[0].attrs;
      if (attrOf(a, 'type') !== 'search') p.G1.push(`${rel}：type="${attrOf(a, 'type')}"（search であること）`);
      if (attrOf(a, 'placeholder') !== PH[lang]) p.G1.push(`${rel}：placeholder「${attrOf(a, 'placeholder')}」／「${PH[lang]}」`);
      if (attrOf(a, 'aria-label') !== ARIA[lang]) p.G1.push(`${rel}：aria-label「${attrOf(a, 'aria-label')}」／「${ARIA[lang]}」`);
      if (!box || box.z > hero.z || inputs[0].at < box.a || inputs[0].end > box.z) p.G1.push(`${rel}：検索欄が見出しの帯（#wa-hero）の .wd-search の中に無い`);
      else if (tagsWith(box.text, hasId('wd-scope')).length !== 1) p.G1.push(`${rel}：検索欄の枠に #wd-scope が無い`);
    }
    /* G2 見出しの字（タグを外して） */
    const h1s = [...h.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    const h1text = h1s.length === 1 ? unesc(h1s[0][1].replace(/<[^>]*>/g, () => '')) : null;
    if (h1s.length !== 1) p.G2.push(`${rel}：<h1> が ${h1s.length} 個`);
    else if (h1text !== H1[lang]) p.G2.push(`${rel}：見出し「${h1text}」／「${H1[lang]}」`);
    /* G2b 日本語の見出しは2つの <span>（どちらも white-space:nowrap）＝「、」の後ろでだけ折れる・題名は career.html と別 */
    if (lang === 'ja') {
      const inner = h1s.length === 1 ? h1s[0][1] : '', sp = /^<span style="([^"]*)">([^<]*)<\/span><span style="([^"]*)">([^<]*)<\/span>$/.exec(inner);
      if (!sp) p.G2b.push(`${rel}：見出しの中が2つの <span> だけでない（${inner.slice(0, 80)}）`);
      else {
        if (![sp[1], sp[3]].every((s) => /(?:^|;)\s*white-space:\s*nowrap\s*(?:;|$)/.test(s))) p.G2b.push(`${rel}：見出しの <span> に white-space:nowrap が無い`);
        if (!same([unesc(sp[2]), unesc(sp[4])], H1_HALVES)) p.G2b.push(`${rel}：見出しの2つの半分「${sp[2]}」「${sp[4]}」／「${H1_HALVES.join('」「')}」`);
        if (unesc(sp[2] + sp[4]) !== H1.ja) p.G2b.push(`${rel}：見出しの字「${sp[2]}${sp[4]}」／「${H1.ja}」`);
      }
      const tj = /<title>([^<]*)<\/title>/.exec(h)?.[1], tc = /<title>([^<]*)<\/title>/.exec(I.career || '')?.[1];
      if (!tj || tj === tc) p.G2b.push(`${rel}：<title> が career.html と同じ（${tj}）`);
    }
    /* G3 #wd-explore（国の帯＋古い地図）は1つ・地域ボタン・検索欄・カードを持たない／「WORLD MAP」の行の次が <!--PV-CBAND--> */
    const ex = divById(h, 'wd-explore');
    if (!ex) p.G3.push(`${rel}：#wd-explore が無い・2つ以上・閉じていない`);
    else for (const id of ['region-strip', 'search', 'airline-grid']) if (new RegExp(`\\bid="${id}"`).test(ex.text)) p.G3.push(`${rel}：#wd-explore の中に #${id}`);
    const lines = h.split('\n'), wm = lines.map((l, i) => (l.includes('<!-- ── WORLD MAP') ? i : -1)).filter((i) => i >= 0);
    if (wm.length !== 1 || !(lines[wm[0] + 1] || '').startsWith('<!--PV-CBAND-->')) p.G3.push(`${rel}：「<!-- ── WORLD MAP」の行（${wm.length}）の次の行が <!--PV-CBAND--> でない`);
    /* G4 結果の見出し #wd-rh ＝ h2#wd-rh-name（すべて／All・tabindex="-1"）＋ #result-count（data-fmt）＋ .wd-clear が1つ */
    const rh = divById(h, 'wd-rh');
    if (!rh) p.G4.push(`${rel}：#wd-rh が無い`);
    else {
      const h2 = tagsWith(rh.text, hasId('wd-rh-name')), rc = tagsWith(rh.text, hasId('result-count')), cl = tagsWith(rh.text, hasClass('wd-clear'));
      if (h2.length !== 1 || h2[0].tag !== 'h2') p.G4.push(`${rel}：#wd-rh に h2#wd-rh-name が無い`);
      else {
        if (textAfter(rh.text, h2[0]) !== ALL_WORD[lang]) p.G4.push(`${rel}：h2「${textAfter(rh.text, h2[0])}」／「${ALL_WORD[lang]}」`);
        if (attrOf(h2[0].attrs, 'tabindex') !== '-1') p.G4.push(`${rel}：h2 に tabindex="-1" が無い`);
      }
      if (rc.length !== 1) p.G4.push(`${rel}：#wd-rh に #result-count が ${rc.length} 個`);
      else {
        if (attrOf(rc[0].attrs, 'data-fmt') !== FMT[lang]) p.G4.push(`${rel}：data-fmt「${attrOf(rc[0].attrs, 'data-fmt')}」／「${FMT[lang]}」`);
        if (attrOf(rc[0].attrs, 'data-fmt-one') !== FMT_ONE[lang]) p.G4.push(`${rel}：data-fmt-one「${attrOf(rc[0].attrs, 'data-fmt-one')}」／「${FMT_ONE[lang]}」`);
      }
      if (cl.length !== 1) p.G4.push(`${rel}：#wd-rh に .wd-clear が ${cl.length} 個`);
      else if (textAfter(rh.text, cl[0]) !== CLEAR[lang]) p.G4.push(`${rel}：「${textAfter(rh.text, cl[0])}」／「${CLEAR[lang]}」`);
    }
    if (tagsWith(h, hasId('wd-rh-name')).length !== 1 || tagsWith(h, hasId('result-count')).length !== 1) p.G4.push(`${rel}：#wd-rh-name か #result-count がページに1つでない`);
    /* G5 <head> の1行（?q= のときは国の帯と地図を最初から隠す）と、台本が動かないときの隠し方 */
    const head = h.slice(0, h.indexOf('</head>'));
    for (const [what, s] of [['?q= の1行', HEAD_Q], ['<noscript> の隠し方', NOSCRIPT]]) {
      if (h.split(s).length !== 2) p.G5.push(`${rel}：${what}がページに ${h.split(s).length - 1} 個`);
      else if (!head.includes(s)) p.G5.push(`${rel}：${what}が <head> の外`);
    }
    /* G7 #no-results ＝ p#wd-none（今の文のまま）→ p.wd-empty-acts（#wd-scope-e → span#wd-else（PV-DIR-ELSE）→ #wd-clear-e）の順 */
    const nr = divById(h, 'no-results');
    if (!nr) p.G7.push(`${rel}：#no-results が無い`);
    else {
      const t = nr.text, none = t.indexOf(`<p id="wd-none">${NONE[lang]}</p>`), acts = t.indexOf('<p class="wd-empty-acts">');
      const actsText = acts < 0 ? '' : t.slice(acts, t.indexOf('</p>', t.indexOf('<!--/PV-DIR-ELSE-->', acts)) + 4);
      const at = (s) => actsText.indexOf(s);
      const order = [at('id="wd-scope-e"'), at('<span class="wd-else" id="wd-else">\n<!--PV-DIR-ELSE-->'), at('<!--/PV-DIR-ELSE-->\n</span>'), at('id="wd-clear-e"')];
      if (none < 0) p.G7.push(`${rel}：p#wd-none「${NONE[lang]}」が無い`);
      if (acts < 0 || acts < none) p.G7.push(`${rel}：p.wd-empty-acts が p#wd-none の後ろに無い`);
      else if (order.some((x) => x < 0) || order.some((x, i) => i && x < order[i - 1])) p.G7.push(`${rel}：p.wd-empty-acts の中の並び（#wd-scope-e → span#wd-else（PV-DIR-ELSE）→ #wd-clear-e）が違う ${JSON.stringify(order)}`);
      const ce = tagsWith(actsText, hasId('wd-clear-e'));
      if (ce.length === 1 && textAfter(actsText, ce[0]) !== CLEAR[lang]) p.G7.push(`${rel}：#wd-clear-e「${textAfter(actsText, ce[0])}」／「${CLEAR[lang]}」`);
    }
  }
  /* G6 見た目の決まり（PV-DIR-DATA の中）── transition:all 無し・transition は transform / opacity だけ・色は #fff のほかに hex 無し・
     var(--pv-…) はどれも pv-tokens.css に在る／検索欄の消すボタン（×）を隠す規則が無い（pv-directory.css にも2枚のページにも） */
  const css = I.css || '', a = css.indexOf('/* PV-DIR-DATA'), z = css.indexOf('/* /PV-DIR-DATA */');
  if (a < 0 || z < a) p.G6.push('pv-directory.css に PV-DIR-DATA の印が無い');
  else {
    const blk = css.slice(a, z).replace(/\/\*[\s\S]*?\*\//g, () => '');
    if (/transition\s*:\s*all\b/i.test(blk)) p.G6.push('transition:all が在る');
    for (const m of blk.matchAll(/(?:^|[;{\s])transition(-property)?\s*:\s*([^;}]*)/g)) {
      const v = m[2].trim();
      if (!m[1] && v === 'none') continue;
      const items = v.split(/,(?![^(]*\))/).map((s) => s.trim().split(/\s+/)[0]);
      const bad = items.filter((x) => !['transform', 'opacity'].includes(x));
      if (bad.length) p.G6.push(`transition${m[1] || ''} が ${bad.join('・')} を動かす（transform / opacity だけ）`);
    }
    for (const m of blk.matchAll(/\{([^{}]*)\}/g)) for (const c of m[1].matchAll(/#[0-9a-f]{3,8}(?![0-9a-z_-])/gi)) if (c[0].toLowerCase() !== '#fff') p.G6.push(`色 ${c[0]}（トークンを使う。#fff だけは会社ページの札と同じ白）`);
    const defined = new Set([...(I.tokens || '').matchAll(/(--pv-[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = [...new Set([...blk.matchAll(/var\(\s*(--pv-[\w-]+)/g)].map((m) => m[1]))];
    for (const v of used) if (!defined.has(v)) p.G6.push(`${v} が pv-tokens.css に無い`);
  }
  for (const [name, s] of [['pv-directory.css', css], ...['ja', 'en'].map((l) => [PAGE_REL[l], I.page[l]])]) if (/-webkit-search-cancel-button/.test(s)) p.G6.push(`${name}：検索欄の消すボタンに触る規則（-webkit-search-cancel-button）`);
  return Object.entries(p).map(([id, probs]) => R(id, probs));
}

/** check-salary.mjs の読み方を、あちらのソースから切り出す（写さない） */
function scanOf(I) {
  const src = String(I.cs), lines = src.split('\n'), pick = [];
  for (const k of ['const ROLE =', 'const GAP =', 'const NUM =', 'const DERIVED =', 'const NAME_CHAR =']) {
    const hit = lines.filter((l) => l.startsWith(k));
    if (hit.length !== 1) throw new Error(`check-salary.mjs の形が変わった（${k} が ${hit.length} 行）`);
    pick.push(hit[0]);
  }
  const a = lines.findIndex((l) => l.startsWith('function aliases(d) {')), z = lines.findIndex((l, i) => i > a && l === '}');
  if (a < 0 || z < 0) throw new Error('check-salary.mjs の形が変わった（function aliases(d) { が無い）');
  pick.push(lines.slice(a, z + 1).join('\n'));
  return new Function(`${pick.join('\n')}\nreturn { ROLE, GAP, NUM, DERIVED, NAME_CHAR, aliases };`)();
}
/** そのページの「読まれた」額（check-salary.mjs と同じ規則・同じ順で） */
function acceptedOf(I, html, K) {
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
  const ALIAS = [];
  for (const [slug, d] of Object.entries(I.ledger)) for (const a of K.aliases(d)) ALIAS.push({ slug, a });
  ALIAS.sort((x, y) => y.a.length - x.a.length);
  const ALL = ALIAS.map((x) => x.a), out = [];
  const h = html.replace(/<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->/g, () => '');
  for (const { slug, a } of ALIAS) {
    const re = new RegExp(reEsc(a) + K.GAP + K.ROLE + K.GAP + K.NUM + '(?:\\s*万?\\s*[〜~–—-]\\s*' + K.NUM + ')?\\s*万', 'g');
    let m;
    while ((m = re.exec(h)) !== null) {
      const span = m[0];
      if (m.index > 0 && K.NAME_CHAR.test(h[m.index - 1])) continue;
      if (ALL.some((x) => x.length > a.length && h.startsWith(x, m.index))) continue;
      const inner = span.slice(a.length);
      if (/<\/(?:tr|thead|tbody|table|section|article|li|ul|ol)>/.test(inner)) continue;
      if (ALL.some((x) => x !== a && !a.includes(x) && inner.includes(x))) continue;
      if (K.DERIVED.test(h.slice(Math.max(0, m.index - 40), m.index + span.length + 20))) continue;
      out.push({ slug, a, at: m.index, rank: /機長|Captain/.test(m[1]) ? 'cap' : 'fo', lo: num(m[2]) });
    }
  }
  return { h, hits: out };
}

/** career.html が2社比較で出せる会社（読み手はこの1つ。いまは <select id="cr-a" class="cr-sel"> の option の value。
    career.html が会社選びを作り替えたら、compare-all がこの1つを付け替える）。無ければ null（＝ H5 は赤） */
function offered(html) {
  const s = String(html || ''), a = s.indexOf('<select id="cr-a" class="cr-sel"'), z = a < 0 ? -1 : s.indexOf('</select>', a);
  if (a < 0 || z < 0) return null;
  return [...s.slice(a, z).matchAll(/<option\b[^>]*\bvalue="([^"]*)"/g)].map((m) => m[1]);
}
/** 比べる印の字（自己検査で印を足すときだけ使う。ページの字は gen-directory.mjs が書く） */
const tickHtml = (slug, word) => `<label class="wd-cmp"><input type="checkbox" class="wd-cmp-i" value="${slug}" aria-labelledby="wn-${slug} wc-${slug}"><span id="wc-${slug}">${word}</span></label>`;

/** H) カードの形 */
function secH(I) {
  const U = pagesOf(I), p = { H1: [], H2: [], H3: [], H4: [], H5: [] };
  const rowOf = new Map(I.list.map((r) => [r.slug, r]));
  let K = null; try { K = scanOf(I); } catch (e) { p.H3.push(e.message); }
  for (const lang of ['ja', 'en']) {
    const rel = PAGE_REL[lang];
    for (const c of cardsOf(U[lang])) {
      /* H4 比べる印 ── 決まり（ここで台帳から）：日本語 ＝ data-two="1" かつ SWITCH・英語 ＝ 一覧の行の fleet。
         印はリンクの外・決まりどおりのカードにだけちょうど1つ・印の中の入力は1つで、その社の値と、カードの中に在る2つの id で名乗る */
      const rule = lang === 'ja' ? c.two === '1' && I.sw.has(c.slug) : fleetOf(rowOf.get(c.slug));
      const labs = [...c.body.matchAll(/<label class="wd-cmp">([\s\S]*?)<\/label>/g)];
      if (labs.length !== (rule ? 1 : 0)) p.H4.push(`${rel} ${c.slug}：比べる印 ${labs.length} 個（${rule ? 'ちょうど1つ' : '無し'}であること・${lang === 'ja' ? `data-two ${c.two}・SWITCH ${I.sw.has(c.slug)}` : `fleet ${fleetOf(rowOf.get(c.slug))}`}）`);
      for (const a of c.body.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)) if (a[0].includes('<label class="wd-cmp"')) p.H4.push(`${rel} ${c.slug}：比べる印がリンク（<a>）の中`);
      const ins = [...c.body.matchAll(/<input\b([^>]*)>/g)].filter((m) => (attrOf(m[1], 'class') || '').split(/\s+/).includes('wd-cmp-i'));
      if (ins.length !== labs.length || labs.some((l) => (l[1].match(/<input\b/g) || []).length !== 1)) p.H4.push(`${rel} ${c.slug}：印の入力 ${ins.length} 個／印 ${labs.length} 個（印1つに入力1つ）`);
      for (const m of ins) {
        const ids = (attrOf(m[1], 'aria-labelledby') || '').split(/\s+/).filter(Boolean);
        if (attrOf(m[1], 'type') !== 'checkbox' || attrOf(m[1], 'value') !== c.slug) p.H4.push(`${rel} ${c.slug}：印の入力 type「${attrOf(m[1], 'type')}」・value「${attrOf(m[1], 'value')}」`);
        if (ids.length !== 2 || ids.some((id) => !c.body.includes(` id="${id}"`))) p.H4.push(`${rel} ${c.slug}：aria-labelledby「${ids.join(' ')}」（カードの中に在る2つの id であること）`);
      }
      const F = figLines(c.body);
      if (!same(F.map((f) => `${f.rank}${f.pub ? '+' : ''}`), ['cap', 'fo'])) p.H1.push(`${rel} ${c.slug}：額の行 ${F.map((f) => f.rank + (f.pub ? '（2行目）' : '')).join('・') || '無し'}（機長・副操縦士の2行であること）`);
      for (const f of F) {
        /* 職位の語の終わりから額の最初の数字まで：タグ1つ＝1・字1つ＝1（check-salary.mjs の GAP は24まで） */
        const body = f.src.slice(f.src.indexOf('</span>') + 7), rw = /(機長|副操縦士|Captain|First Officer)/.exec(body);
        if (!rw) { p.H2.push(`${rel} ${c.slug} ${f.rank}：札に職位の語が無い`); continue; }
        let i = rw.index + rw[0].length, n = 0;
        while (i < body.length && !/\d/.test(body[i])) { if (body[i] === '<') i = body.indexOf('>', i) + 1; else i++; n++; }
        if (i >= body.length || n > 24) p.H2.push(`${rel} ${c.slug} ${f.rank}：職位の語から額まで ${n}（24以下であること）`);
        if (K && K.DERIVED.test(f.src)) p.H3.push(`${rel} ${c.slug} ${f.rank}：額の行に手取り・月額などの語`);
      }
      const go = /<a class="wd-go"[^>]*>([\s\S]*?)<\/a>/.exec(c.body)?.[1] ?? '';
      if (/<(input|label|button|select|textarea)\b/i.test(go)) p.H3.push(`${rel} ${c.slug}：リンクの中に押せる部品`);
    }
  }
  /* H5 日本語のカードの data-two="1" ＝ career.html が出せる会社（offered）。英語のカードに data-two="1" は無く、
     英語のページの PV-DIR-CARDS と #wd-tray は career.html を指さない（左のメニューとヘッダーはほかの持ち場なので見ない） */
  const off = offered(I.career), jaTwo = cardsOf(U.ja).filter((c) => c.two === '1').map((c) => c.slug);
  if (!off) p.H5.push('career.html に会社選び（<select id="cr-a" class="cr-sel">）が無い（offered() の読み手を付け替える）');
  else {
    for (const s of setDiff(new Set(jaTwo), new Set(off))) p.H5.push(`${PAGE_REL.ja} ${s}：data-two="1" なのに career.html が出せない`);
    for (const s of setDiff(new Set(off), new Set(jaTwo))) p.H5.push(`${PAGE_REL.ja} ${s}：career.html が出せるのに data-two="1" でない`);
  }
  for (const c of cardsOf(U.en)) if (c.two === '1') p.H5.push(`${PAGE_REL.en} ${c.slug}：英語のカードに data-two="1"`);
  const enCards = blockOf(U.en, 'PV-DIR-CARDS'), enTray = divById(U.en, 'wd-tray');
  if (enCards && enCards.text.includes('career.html')) p.H5.push(`${PAGE_REL.en}：カード（PV-DIR-CARDS）が career.html を指す（日本語だけのページ）`);
  if (enTray && enTray.text.includes('career.html')) p.H5.push(`${PAGE_REL.en}：盆（#wd-tray）が career.html を指す（日本語だけのページ）`);
  return Object.entries(p).map(([id, probs]) => R(id, probs));
}

/** W) check-salary.mjs の読み方で、カードの額がそのカードの会社として読まれる */
function secW(I) {
  const U = pagesOf(I), p = { W1: [], W2: [], W3: [] };
  let K; try { K = scanOf(I); } catch (e) { return ['W1', 'W2', 'W3'].map((id) => R(id, [e.message])); }
  const tally = [];
  for (const lang of ['ja', 'en']) {
    const rel = PAGE_REL[lang], { h, hits } = acceptedOf(I, U[lang], K), blk = blockOf(h, 'PV-DIR-CARDS'), C = cardsOf(h);
    const cardAt = (at) => C.find((c) => c.start <= at && at < c.end) || null;
    const inBlock = hits.filter((x) => blk && x.at > blk.a && x.at < blk.z);
    tally.push(`${rel} ${inBlock.length}件`);
    for (const c of C) {
      /* W1 境目の印が1つ、リンクの後・最初の額の行の前 */
      const nb = c.body.split(BARRIER).length - 1, ib = c.body.indexOf(BARRIER), ia = c.body.indexOf('</a>'), ifg = c.body.indexOf('<p class="wd-fig');
      if (nb !== 1 || !(ia >= 0 && ia < ib && ib < ifg)) p.W1.push(`${rel} ${c.slug}：境目の印 ${nb} 個${nb === 1 ? '（場所が違う）' : ''}`);
      /* W2 職位ごとに、そのカードの会社として・印字の額で読まれている */
      for (const f of figLines(c.body)) {
        if (f.amount === '—') continue;   // 確認中（—）は読まれなくてよい
        if (f.amount == null || !/\d/.test(f.amount)) { p.W2.push(`${rel} ${c.slug} ${f.rank}：額が読めない`); continue; }
        const lo = num(/[\d,]+/.exec(f.amount)[0]);
        if (!inBlock.some((x) => cardAt(x.at) === c && x.slug === c.slug && x.rank === f.rank && x.lo === lo)) p.W2.push(`${rel} ${c.slug} ${f.rank}：check-salary.mjs が「${f.amount}」をこの会社の額として読まない`);
      }
    }
    /* W3 カードの中の読まれた額は、どれもそのカードの会社・隠した社名から始まる */
    for (const x of inBlock) {
      const c = cardAt(x.at), lt = h.lastIndexOf('<', x.at), tag = h.slice(lt, h.indexOf('>', lt) + 1);
      if (!c || c.slug !== x.slug) p.W3.push(`${rel}：${c ? c.slug : 'カードの外'} の中で ${x.slug}（「${x.a}」）の額として読まれた`);
      else if (tag !== '<span class="wd-vh">') p.W3.push(`${rel} ${c.slug}：「${x.a}」の読み始めが隠した社名の中でない（${tag.slice(0, 40)}）`);
    }
  }
  return [R('W1', p.W1), R('W2', p.W2, `check-salary.mjs の読み方でカードから読まれた額：${tally.join('・')}`), R('W3', p.W3)];
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

const SECTIONS = { A: secA, B: secB, C: secC, D: secD, E: secE, F: secF, G: secG, H: secH, W: secW, L: secL };
const runScope = (I, scope) => [...scope].flatMap((l) => SECTIONS[l](I));

/* ── 自己検査：わざと1か所だけ壊した写しで、ちょうどその項目だけが赤くなるか ─── */
const clone = (I) => ({ ...structuredClone({ ...I, fn: null }), fn: { ...I.fn } });
const rowAt = (I, slug) => I.list.find((r) => r.slug === slug);
const bump = (I, rel, re) => { I.hub[rel] = I.hub[rel].replace(re, (m, a, n, b) => `${a}${Number(n) + 1}${b}`); };
/** 文字列の1か所を差し替える（ちょうど1つ在ること。無ければ壊し方が当たっていない） */
const sub = (s, a, b) => { if (s.split(a).length !== 2) throw new Error(`「${a.slice(0, 40)}」がちょうど1つでない`); return s.replace(a, () => b); };
/** 1枚のカードを差し替える（何も変わらなければ壊し方が当たっていない） */
const onCard = (I, lang, slug, fn) => {
  const re = new RegExp(`<li class="wd-li"[^>]*data-slug="${slug}"[\\s\\S]*?<\\/li>\\n?`);
  const before = I.page[lang]; I.page[lang] = before.replace(re, (c) => fn(c));
  if (I.page[lang] === before) throw new Error(`${lang} ${slug} のカードが変わらない`);
};
/** <!--ID--> … <!--/ID--> の中だけを差し替える */
const onBlock = (I, lang, id, fn) => {
  const re = new RegExp(`<!--${id}-->[\\s\\S]*?<!--/${id}-->`);
  const before = I.page[lang]; I.page[lang] = before.replace(re, (c) => fn(c));
  if (I.page[lang] === before) throw new Error(`${lang} ${id} が変わらない`);
};
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
  ['B7a', (I) => { I.lev = sub(I.lev, "regionName(a.region) + '</span>'", "(a.region || '') + '</span>'"); }, 'B', ['B7']],
  ['B7b', (I) => { I.lev = sub(I.lev, " eu_fsc: ['欧州', 'Europe'],", ''); }, 'B', ['B7']],
  ['B8a', (I) => { rowAt(I, 'wizz-air').flag = '🇭🇺'; }, 'B', ['B8']],
  ['B8b', (I) => { I.header.find((h) => h.slug === 'eagle-jet').g = '🇪🇺'; }, 'B', ['B8']],
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
  ['F1', (I) => onCard(I, 'ja', 'skymark', () => ''), 'F', ['F1', 'F3', 'F6', 'F7']],
  ['F2a', (I) => onCard(I, 'ja', 'jal', (c) => c.replace(/(<b class="wd-v">[^\d]*)(\d)/, (_, a, d) => a + (d === '9' ? '8' : String(+d + 1)))), 'F', ['F2', 'F7']],
  ['F2b', (I) => onCard(I, 'ja', 'ana', (c) => c.replace(/(<span class="wd-name"[^>]*>[^<]*)/, (_, a) => `${a}X`)), 'F', ['F2', 'F7']],
  ['F2c', (I) => onCard(I, 'ja', 'ana', (c) => c.replace(' loading="lazy"', () => '')), 'F', ['F2', 'F7']],
  ['F2d', (I) => onCard(I, 'ja', 'solairus', (c) => c.replace('data-lvl="0"', () => 'data-lvl="1"')), 'F', ['F2', 'F7']],
  ['F3b', (I) => onBlock(I, 'en', 'PV-DIR-ELSE', (b) => b.replace(' hidden>', () => '>')), 'F', ['F3', 'F7']],
  ['F3a', (I) => onBlock(I, 'ja', 'PV-DIR-REGIONS', (b) => b.replace(/(data-region="japan"[^>]*>[\s\S]*?<span class="rstrip-n"[^>]*>)(\d+)/, (_, a, n) => `${a}${Number(n) + 1}`)), 'F', ['F3', 'F7']],
  ['F4', (I) => { I.page.ja = sub(I.page.ja, `"numberOfItems":${Object.keys(I.ledger).length}\n`, '"numberOfItems":117\n'); }, 'F', ['F4', 'F7']],
  ['F5a', (I) => { I.page.ja = sub(I.page.ja, '社の給与・採用・訓練情報</p>', '社の給与・採用・訓練情報（108社）</p>'); }, 'F', ['F5']],
  ['F5b', (I) => { I.page.en = sub(I.page.en, '<!--/PV-DIR-N--> airlines</p>', '<!--/PV-DIR-N--> airlines — 108 Airlines</p>'); }, 'F', ['F5']],
  ['F6', (I) => onCard(I, 'en', 'ana', (c) => c.replace('<span class="tag tag-gray">Star Alliance</span>', () => '')), 'F', ['F6', 'F7']],
  ['F7', (I) => onCard(I, 'ja', 'jal', (c) => c.replace('data-k="', () => 'data-k="X|')), 'F', ['F7']],
  ['F9a', (I) => { I.assets['pv-directory.js'] = sub(I.assets['pv-directory.js'], "applyThemeW(localStorage.getItem('pv-theme')||'light');\n", "applyThemeW(localStorage.getItem('pv-theme')||'light'),\n"); }, 'F', ['F9']],
  ['F9b', (I) => { I.page.ja = sub(I.page.ja, '</body>', 'createCard</body>'); }, 'F', ['F9']],
  ['F10', (I) => { I.page.en = I.page.en.replace(/<nav class="mr-side"[\s\S]*?<\/nav>/, () => ''); }, 'F', ['F10']],
  ['G1', (I) => { I.page.en = sub(I.page.en, 'aria-label="Search by airline or country"', 'aria-label="Search"'); }, 'G', ['G1']],
  ['G2', (I) => { I.page.en = sub(I.page.en, 'Choose your next career</h1>', 'World Airlines — Pilot Information</h1>'); }, 'G', ['G2']],
  ['G2b', (I) => { I.page.ja = sub(I.page.ja, '選択する</span></h1>', '選択する。</span></h1>'); }, 'G', ['G2', 'G2b']],
  /* 字は同じまま折れ目だけ外す（G2 はタグを外して読むので緑のまま。G2b だけが赤） */
  ['G2bn', (I) => { I.page.ja = sub(I.page.ja, '<span style="white-space:nowrap">選択する</span></h1>', '<span>選択する</span></h1>'); }, 'G', ['G2b']],
  ['G3a', (I) => { I.page.ja = sub(I.page.ja, '\n<!--PV-CBAND-->', '\n\n<!--PV-CBAND-->'); }, 'G', ['G3']],
  /* #wd-explore の始まりを見出しの帯の前へ ＝ 検索欄が「探す前だけ見せる」側に入る */
  ['G3b', (I) => { I.page.ja = sub(sub(I.page.ja, '<div id="wd-explore">\n<!-- ── WORLD MAP', '<!-- ── WORLD MAP'), '<!-- ── HERO', '<div id="wd-explore">\n<!-- ── HERO'); }, 'G', ['G3']],
  ['G4a', (I) => { I.page.en = sub(I.page.en, 'tabindex="-1">All</h2>', 'tabindex="-1">All airlines</h2>'); }, 'G', ['G4']],
  ['G4b', (I) => { I.page.en = sub(I.page.en, ' data-fmt-one="{n} airline"', ''); }, 'G', ['G4']],
  ['G5', (I) => { I.page.ja = sub(I.page.ja, NOSCRIPT, ''); }, 'G', ['G5']],
  ['G6a', (I) => { I.css = sub(I.css, '.wd-rh-name:focus{outline:none}', '.wd-rh-name:focus{outline:none;transition:all .2s}'); }, 'G', ['G6']],
  ['G6b', (I) => { I.css = sub(I.css, '.wd-rh-name:focus{outline:none}', '.wd-rh-name:focus{outline:none;transition:color .2s}'); }, 'G', ['G6']],
  ['G6c', (I) => { I.css = sub(I.css, '.wd-search-in::placeholder{color:var(--pv-ink-3)}', '.wd-search-in::placeholder{color:#64748b}'); }, 'G', ['G6']],
  ['G6d', (I) => { I.css = sub(I.css, '.wd-search-in::placeholder{color:var(--pv-ink-3)}', '.wd-search-in::placeholder{color:var(--pv-ink-9)}'); }, 'G', ['G6']],
  ['G6e', (I) => { I.css = sub(I.css, '/* /PV-DIR-DATA */', '.wd-search-in::-webkit-search-cancel-button{display:none}\n/* /PV-DIR-DATA */'); }, 'G', ['G6']],
  ['G7', (I) => { I.page.en = sub(I.page.en, '<p id="wd-none">No airlines matched your search</p>', '<p id="wd-none">No airlines found</p>'); }, 'G', ['G7']],
  ['G7b', (I) => { I.page.ja = sub(I.page.ja, '<span class="wd-else" id="wd-else">', '<span class="wd-else">'); }, 'G', ['G7']],
  ['H1', (I) => onCard(I, 'ja', 'jal', (c) => c.replace(/<p class="wd-fig" data-rank="fo"[\s\S]*?<\/p>\n?/, () => '')), 'H', ['H1']],
  /* 札の全体を <span> で包むだけでは、職位の語の後ろに増えるのは閉じタグ1つ（23 → 24 ＝ まだ読める）。語の直後で包んで 25 にする */
  ['H2', (I) => onCard(I, 'en', 'etihad', (c) => c.replace(/(data-rank="cap"><span class="wd-vh">[^<]*<\/span>Captain)([^<]*)/, (_, a, l) => `${a}<span>${l}</span>`)), 'H', ['H2']],
  ['H3', (I) => onCard(I, 'ja', 'ana', (c) => c.replace('<span class="wd-names">', () => '<button type="button">x</button><span class="wd-names">')), 'H', ['H3']],
  /* H4a〜H4e・H5 は、compare-all の切り替え（twoSlugs が全社に）の前でも後でも、SWITCH が増えても同じ赤になる
     （jal ＝ 5社・SWITCH の中・fleet あり／solairus ＝ fleet 無し／lufthansa ＝ 切り替えの後に印が付く社。H4d は印を「足す」＝ 2つ目でも赤）。
     H4a は印をリンクの中へ動かす ＝ H3（リンクの中に押せる部品）も同じ1か所で赤くなる */
  ['H4a', (I) => onCard(I, 'ja', 'jal', (c) => { const lab = /<label class="wd-cmp">[\s\S]*?<\/label>/.exec(c)?.[0]; return lab ? c.replace(lab, () => '').replace('</a>', () => `${lab}</a>`) : c; }), 'H', ['H3', 'H4']],
  ['H4b', (I) => onCard(I, 'ja', 'jal', (c) => c.replace(/<label class="wd-cmp">[\s\S]*?<\/label>/, () => '')), 'H', ['H4']],
  ['H4c', (I) => onCard(I, 'en', 'solairus', (c) => c.replace(/(<div class="wd-foot">[\s\S]*?)(<\/div>)/, (_, a, z) => a + tickHtml('solairus', 'Compare') + z)), 'H', ['H4']],
  ['H4d', (I) => onCard(I, 'ja', 'lufthansa', (c) => c.replace(/(<div class="wd-foot">[\s\S]*?)(<\/div>)/, (_, a, z) => a + tickHtml('lufthansa', '比較') + z)), 'H', ['H4']],
  ['H4e', (I) => { if (!I.sw.delete('jal')) throw new Error('SWITCH に jal が無い'); }, 'H', ['H4']],
  ['H5', (I) => onCard(I, 'ja', 'jal', (c) => c.replace('data-two="1"', () => 'data-two="0"')), 'H', ['H4', 'H5']],
  ['W1', (I) => onCard(I, 'ja', 'airjapan', (c) => c.replace(`${BARRIER}\n`, () => '')), 'W', ['W1', 'W3']],
  ['W2', (I) => onCard(I, 'ja', 'jal', (c) => c.replace(/(data-rank="cap"[\s\S]*?)(<b class="wd-v">)/, (_, a, b) => `${a}${'<i></i>'.repeat(30)}${b}`)), 'W', ['W2']],
  ['W3', (I) => onCard(I, 'ja', 'jal', (c) => c.replace('<div class="wd-foot"><span class="wd-tags">', () => '<div class="wd-foot"><span class="wd-tags">全日本空輸（ANA）機長 ¥1,850万')), 'W', ['W3']],
  ['L2', (I) => { const f = I.fn.cards; I.fn.cards = (...a) => { fs.readFileSync(path.join(ROOT, 'assets/airline-logos/ana.svg')); return f(...a); }; }, 'L', ['L2']],
];

/* ── 実行 ────────────────────────────────────────────────── */
const I = await readIN();
if (SELFTEST) {
  const all = runScope(I, Object.keys(SECTIONS)), ids = all.map((r) => r.id), bad = [];
  const red0 = all.filter((r) => !r.ok).map((r) => r.id);
  if (red0.length) bad.push(`壊す前から赤い：${red0.join(', ')}`);
  /* 行の名前 ＝ 項目の id そのもの、または id ＋ 小文字1字（F3a・F3b …）。G2b のように id が小文字で終わるときは G2b・G2bn */
  for (const id of ids) if (!ROWS.some(([n]) => n === id || n.replace(/[a-z]$/, () => '') === id)) bad.push(`${id} に自己検査の行が無い`);
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
