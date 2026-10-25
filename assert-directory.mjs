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
        見た目の決まり（transition は transform / opacity だけ・色はトークン・検索欄の消すボタンは「マウスの画面で地域の札が出ている時」の
        1つの規則でしか隠さない）・transition:all／transition-all が2枚のページにも pv-directory.css・.js にも無い（G8）・
        保存領域（localStorage・sessionStorage）に触る所はどれも try の中（ページの中の台本と pv-directory.js。G9）── G8・G9 は WP-dd-9
     H) カードの形 ── 額の行は機長→副操縦士の2行・職位の語から額まで24字以内（check-salary.mjs が読める）・
        リンクの中に押せる部品を入れない・額の行に手取りや月額の語を入れない・
        比べる印（label.wd-cmp）はリンクの外で、決まりどおりのカードにだけ1つ（日本語 ＝ data-two="1" かつ SWITCH・英語 ＝ fleet）（H4）・
        日本語の data-two="1" ＝ career.html が2社比較で出せる会社・英語のカードと盆は career.html を指さない（H5）
     W) check-salary.mjs の読み方そのもの（あちらのソースから切り出す）で、どのカードのどの額も
        そのカードの会社として読まれ、別の会社として読まれない（境目の印 <!--wd>--> が1枚に1つ）
     L) カードを作るときにロゴの絵を読まない（読むと assert-generated.mjs の写し＝絵の無い所で生成が落ちる）。
        ※ 大きさの表（airline-logo-sizes.mjs）と絵の一致は assert-rollout.mjs の「A L-LOGO」が見ている（ここでは重ねない）
     M) 地図と地域のまとめ（directory-map の区域。WP-dmap-2 から）── 世界の輪郭（world-outline.mjs ＝ 生成物）の形・重さ・
        国の割り振り・目印の点（world-outline-probes.mjs）・出どころとライセンス（M1〜M5）／
        地域のまとめのカード（PV-DIRMAP・日英）── 平均と散らばり（最低・最高・会社・幅）の額と社数が台帳と同じ（M7）・
        日本のページと欧州のページが出している額と同じ（M8）・会社のカードの額の平均ではなく推定の平均（M9）・
        散らばりの帯の位置と目盛（会社ページと同じ決め方）（M10）・オーナーの字と日英の骨組み（M11）・属性に額を書かない・05b の口（M12）・
        英語の額はドルの span（M13）・社名は2つのリストの中だけ ＝ check-salary.mjs が地域の額を会社の額と読まない（M14）／
        WP-dmap-3 から：地域のまとめの台本（pv-directory.js の終わりの塊）が通信・保存・時計・05b の口への書き込み・額を持たない・
        地域の9つのボタンは名前と社数の2つの span だけで、見た目の規則は pv-directory.css に1か所（M15）・
        国の帯はページの終わり（カードの一覧の後ろ・フッターの前・#wd-explore の外）でリンクがそろっている（M17）。
        「機長｜副操縦士」の切り替えの字と形は M11、帯の目盛は描く額（推定）だけで決まる（M10）、最低／最高の社名は「対象」と同じ字（M7）

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
import { execFileSync } from 'node:child_process';
import { SALARY } from './salary-data.mjs';
import { BASIS, TIERS, figures } from './salary-basis.mjs';
import { AIRLINE_COUNTRY, BY_CODE } from './airline-countries.mjs';
import { LEAD, SWITCH } from './airline-rollout.mjs';
import { unbake, curCore } from './cur-core.mjs';
import { widthOf, checkWidth } from './pv-bars.mjs';

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
  I.map = await readMap();
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
/* 検索欄の例の字は、今までの例の字の前半（＝ aria-label と同じ字）。後ろの「（例：…）」は 390px で切れていた（WP-dd-9・リード P12.86-3 の一覧に載せる） */
const PH = { ja: '航空会社名・国名で検索', en: 'Search by airline or country' };
const ARIA = { ja: '航空会社名・国名で検索', en: 'Search by airline or country' };
/** 検索欄のブラウザの消すボタン（×）を隠してよいのは、この2つの規則だけ ── ① マウスの画面で、地域の札（×つき）が欄に出ている時／
    ② 欄が空の時（消す字が無い。見えない × が場所を取って例の字を「…」で切っていた）。字が入っていれば、指の画面では今までどおり出る
    （「検索だけを消す」ただ1つの手段。最終設計 D11・N7 の「隠さない」を WP-dd-9 で付け替え） */
const CANCEL_RULES = [
  '@media (hover:hover) and (pointer:fine){.wd-search:has(.wd-scope:not([hidden])) .wd-search-in::-webkit-search-cancel-button{display:none}}',
  '.wd-search-in:placeholder-shown::-webkit-search-cancel-button{display:none}',
];
const CANCEL_RULE = CANCEL_RULES[0];
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
  const p = { G1: [], G2: [], G2b: [], G3: [], G4: [], G5: [], G6: [], G7: [], G8: [], G9: [] };
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
  /* 消すボタン（×）：pv-directory.css に CANCEL_RULES の2つがちょうど1つずつ（① マウスの画面・地域の札が出ている時／② 欄が空の時）。
     それ以外の形で触る規則は無い（pv-directory.css の残りにも2枚のページにも）── WP-dd-9 で「1つも無い」から付け替えた。
     字が入っている欄の × を指の画面で隠さない、は今までどおり見ている */
  let rest = css;
  for (const rule of CANCEL_RULES) {
    if (css.split(rule).length !== 2) p.G6.push(`pv-directory.css：検索欄の消すボタンの規則「${rule.slice(0, 60)}…」が ${css.split(rule).length - 1} 個（1つであること）`);
    rest = rest.split(rule).join('');
  }
  for (const [name, s] of [['pv-directory.css', rest], ...['ja', 'en'].map((l) => [PAGE_REL[l], I.page[l]])]) if (/-webkit-search-cancel-button/.test(s)) p.G6.push(`${name}：検索欄の消すボタンに触る規則（-webkit-search-cancel-button）が CANCEL_RULES のほかに在る`);
  /* G8 transition:all を書かない（CLAUDE.md「transition-all を使わない」）── pv-directory.css の全体・2枚のページ（<style>・style 属性・class）・
     pv-directory.js。動かす物の名前を書かない transition（transition:.2s）も all と同じ */
  const js = (I.assets || {})['pv-directory.js'] || '';
  for (const [name, s] of [['pv-directory.css', css], ...['ja', 'en'].map((l) => [PAGE_REL[l], I.page[l]]), ['pv-directory.js', js]]) {
    const t = String(s).replace(/\/\*[\s\S]*?\*\//g, () => '').replace(/<!--[\s\S]*?-->/g, () => '');
    for (const m of t.matchAll(/transition(?:-property)?\s*[:=]\s*['"`]?\s*(?:all\b|[\d.]+m?s\b|ease|linear|cubic-bezier|steps)/gi)) p.G8.push(`${name}：「${m[0]}」（動かすのは transform / opacity だけ）`);
    /* 並べた2つ目より後ろの all（transition:opacity .2s,all .3s）も同じ（検査役が足した ── WP-dd-9） */
    for (const m of t.matchAll(/transition(?:-property)?\s*[:=]\s*['"`]?[^;{}"'`<>\n]*?,\s*(?:all\b|[\d.]+m?s\b)/gi)) p.G8.push(`${name}：「${m[0]}」（動かすのは transform / opacity だけ）`);
    for (const m of t.matchAll(/(?:class(?:Name)?\s*=\s*["'][^"']*|classList\.add\([^)]*)\btransition-all\b/g)) p.G8.push(`${name}：class transition-all（${m[0].slice(-40)}）`);
  }
  /* G9 保存領域（localStorage・sessionStorage）に触る所は、どれも try { } の中 ── 2枚のページの中の台本（src の無い <script>・on… 属性）と
     pv-directory.js。保存領域を閉じたブラウザ（プライベートの窓・設定で止めた人）でも、ページが止まらない（WP-dd-9） */
  for (const lang of ['ja', 'en']) {
    const h = I.page[lang], rel = PAGE_REL[lang];
    const inline = [...h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1]) && !/application\/ld\+json/.test(m[1])).map((m) => m[2]);
    const attrs = [...h.matchAll(/\son[a-z]+="([^"]*)"/g)].map((m) => unesc(m[1]));
    for (const s of [...inline, ...attrs]) for (const b of storageOutsideTry(s)) p.G9.push(`${rel}：try の外で ${b}`);
  }
  for (const b of storageOutsideTry(js)) p.G9.push(`pv-directory.js：try の外で ${b}`);
  if (!js) p.G9.push('pv-directory.js が読めない');
  return Object.entries(p).map(([id, probs]) => R(id, probs));
}

/** JS の字を読み、localStorage / sessionStorage に触る所のうち、try の { } の中に無いものを返す（「行 n：その行」）。
    コメント・文字列・正規表現の中の字は数えない。テンプレート文字列（`…`）の中に在るときは「確かめられない」として返す。 */
function storageOutsideTry(src) {
  const s = String(src), n = s.length, out = [], stack = [];
  const lineOf = (k) => { const a = s.lastIndexOf('\n', k) + 1, z = s.indexOf('\n', k); return `行 ${s.slice(0, k).split('\n').length}：${s.slice(a, z < 0 ? n : z).trim().slice(0, 90)}`; };
  let i = 0, prev = '';
  const regexHere = () => !prev || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /^(return|typeof|case|do|else|in|of|void|delete|new|throw|yield|await)$/.test(prev);
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && d === '/') { const z = s.indexOf('\n', i); i = z < 0 ? n : z; continue; }
    if (c === '/' && d === '*') { const z = s.indexOf('*/', i + 2); i = z < 0 ? n : z + 2; continue; }
    if (c === '"' || c === "'") { i++; while (i < n && s[i] !== c && s[i] !== '\n') i += s[i] === '\\' ? 2 : 1; i++; prev = 'str'; continue; }
    if (c === '`') {
      const a = i; i++;
      while (i < n && s[i] !== '`') i += s[i] === '\\' ? 2 : 1;
      if (/\b(?:local|session)Storage\b/.test(s.slice(a, i))) out.push(`${lineOf(a)}（テンプレート文字列の中 ＝ 確かめられない）`);
      i++; prev = 'str'; continue;
    }
    if (c === '/' && regexHere()) {
      i++; let cls = false;
      while (i < n && (cls || s[i] !== '/') && s[i] !== '\n') { if (s[i] === '\\') i++; else if (s[i] === '[') cls = true; else if (s[i] === ']') cls = false; i++; }
      i++; while (i < n && /[a-z]/i.test(s[i])) i++;
      prev = 're'; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const a = i; while (i < n && /[A-Za-z0-9_$]/.test(s[i])) i++;
      const w = s.slice(a, i);
      if ((w === 'localStorage' || w === 'sessionStorage') && !stack.includes('try')) out.push(lineOf(a));
      prev = w; continue;
    }
    if (c === '{') stack.push(prev === 'try' ? 'try' : '');
    else if (c === '}') stack.pop();
    prev = c; i++;
  }
  return out;
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

/** career.html が2社比較で出せる会社（読み手はこの1つ。★2026-10-25 段階5 compare-all-3 で付け替えた：2社を選ぶ面
    <ul class="cr-sheet-l" id="cr-sheet-l"> の中の <button type="button" class="cr-pk" data-airline="…"> の data-airline。
    前は <select id="cr-a" class="cr-sel"> の option の value）。無ければ null（＝ H5 は赤） */
function offered(html) {
  const s = String(html || ''), a = s.indexOf('<ul class="cr-sheet-l" id="cr-sheet-l">'), z = a < 0 ? -1 : s.indexOf('</ul>', a);
  if (a < 0 || z < 0) return null;
  return [...s.slice(a, z).matchAll(/<button type="button" class="cr-pk" data-airline="([^"]*)"/g)].map((m) => m[1]);
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
  if (!off) p.H5.push('career.html に会社選び（選ぶ面 <ul class="cr-sheet-l" id="cr-sheet-l">）が無い（offered() の読み手を付け替える）');
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

/* ── M) 地図と地域のまとめ（directory-map の区域）────────────────────────────
   期待する値はここで台帳から作る（directory-map.mjs の関数では作らない）。形の答え（目印の点）は手で打った
   world-outline-probes.mjs だけから読む（生成物 world-outline.mjs に答えを持たせない）。 */
/** 輪郭の環の数（地域ごと）── WP-dmap-1 の取り込みが出した環を、作り手と確かめ手が1つずつ地図帳で名指したあとに打った数 */
const RINGS_SEEN = { neutral: 13, us: 34, latam: 11, europe: 15, africa: 2, mideast: 1, asia: 24, oceania: 17, japan: 3 };
/** 9つの形の重さの上限（バイト）── 最初の取り込みの実測 17,072 ＋ 10% を 500 へ切り上げ（D6。リードなしに上げない） */
const OUTLINE_CEIL = 19000;
/** 色を読む点（欧州）が欧州の形の縁から離れているべき距離（箱の単位。A30） */
const EU_CLEAR = 10;
/** PV-DIRMAP の塊の重さの上限（1ページ・バイト。M2 の DM5a の行） */
const DIRMAP_CEIL = 64000;
/** pv-directory.js の終わりの、地図と地域のまとめの台本の塊の印（WP-dmap-3 の E6。この行からファイルの終わりまでが M15 の読む字） */
const MAP_SCRIPT = '/* ── 地図と地域のまとめ（directory-map）';

/** 地図の区域が読むもの（読むだけ）。関数は持たない（--selftest の写しが structuredClone で作れるように） */
async function readMap() {
  const data = async (rel) => {
    if (!fs.existsSync(at(rel))) return null;
    const m = await import(pathToFileURL(at(rel)).href);
    return Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v !== 'function').map(([k, v]) => [k, structuredClone(v)]));
  };
  let files = null;
  try { files = execFileSync('git', ['ls-files'], { cwd: RROOT || ROOT, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean); } catch { files = null; }
  /* 換算の文（通貨のメニューの字）は currency.js の AS_OF と NOTE をここで評価する（生成器の fxNote は使わない） */
  let fx = null;
  try {
    const src = read('currency.js'), a = /^\s*var AS_OF\s*=.*;$/m.exec(src), n = /^\s*var NOTE\s*=\s*\{[\s\S]*?^\s*\};/m.exec(src);
    fx = new Function(`${a[0]}\n${n[0]}\nreturn { ja: NOTE.ja(AS_OF.ja), en: NOTE.en(AS_OF.en) };`)();
  } catch { fx = null; }
  /* 会社ページの目盛の刻み（P12.104 の決め方の1か所）。数だけ読む */
  let view = null;
  try { view = await import(pathToFileURL(at('pv-airline-view.mjs')).href); } catch { view = null; }
  /* pv-directory.js の終わりに足した、地図と地域のまとめの台本の塊（印の行からファイルの終わりまで。印が1つでなければ null）── M15 */
  const js = readOr('pv-directory.js'), mk = js.split(MAP_SCRIPT).length - 1;
  return {
    outline: await data('world-outline.mjs'), probes: await data('world-outline-probes.mjs'),
    text: { outline: readOr('world-outline.mjs'), probes: readOr('world-outline-probes.mjs'), map: readOr('directory-map.mjs') },
    importer: readOr('import-world-outline.mjs'), gitignore: readOr('.gitignore'), files,
    japan: readOr('countries/japan.html'), view: { SCALE_STEP: view?.SCALE_STEP ?? null }, fx,
    script: mk === 1 ? js.slice(js.indexOf(MAP_SCRIPT)) : null,
    /* 国の帯の行き先（M17）：link-countries.mjs の字（帯の社数 n を読む）と、在る国のページ */
    lc: readOr('link-countries.mjs'), countries: new Set([...htmlIn('countries'), ...htmlIn('en/countries'), ...['countries.html', 'en/countries.html'].filter((f) => fs.existsSync(at(f)))]),
  };
}

/* 形の道具（ここで持つ。取り込みの式は読まない）── d は「M x y」と「l dx dy …」と「z」だけ */
const ringsOf = (d) => String(d).split('M').filter((s) => s.trim()).map((s) => {
  const n = s.replace(/[lz]/g, () => ' ').match(/-?\d+/g).map(Number), pts = [[n[0], n[1]]];
  for (let i = 2; i + 1 < n.length; i += 2) { const p = pts[pts.length - 1]; pts.push([p[0] + n[i], p[1] + n[i + 1]]); }
  return pts;
});
/** 0 でない巻き数 ＝ 中 */
const insideRings = (rings, px, py) => {
  let w = 0;
  for (const q of rings) for (let i = 0; i < q.length; i++) {
    const [ax, ay] = q[i], [bx, by] = q[(i + 1) % q.length], cr = (bx - ax) * (py - ay) - (px - ax) * (by - ay);
    if (ay <= py) { if (by > py && cr > 0) w++; } else if (by <= py && cr < 0) w--;
  }
  return w !== 0;
};
/** 点から形の縁（どの辺でも）までのいちばん近い距離 */
const edgeDist = (rings, px, py) => Math.min(...rings.flatMap((q) => q.map(([ax, ay], i) => {
  const [bx, by] = q[(i + 1) % q.length], vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L)) : 0;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
})));

function secM(I) {
  const p = { M1: [], M2: [], M3: [], M4: [], M5: [] }, info = {};
  const O = I.map?.outline, P = I.map?.probes;
  if (!O || !O.SHAPES || !O.META) for (const k of ['M1', 'M2', 'M3', 'M4', 'M5']) p[k].push('world-outline.mjs が読めない');
  else {
    const S = O.SHAPES, regs = [...new Set(Object.values(I.ledger).map((d) => d.region))];
    /* M1 形：neutral ＋ 台帳の8地域ちょうど・字は M l z 数字 空白 マイナスだけ・環の数 ＝ RINGS_SEEN */
    p.M1.push(...setEq('輪郭の形', Object.keys(S), ['neutral', ...regs]));
    p.M1.push(...setEq('環の数の表（RINGS_SEEN）', Object.keys(RINGS_SEEN), ['neutral', ...regs]));
    for (const [k, d] of Object.entries(S)) {
      if (typeof d !== 'string' || !d) { p.M1.push(`${k}：形が空`); continue; }
      if (!/^[Mlz0-9 -]+$/.test(d)) p.M1.push(`${k}：形に M l z 数字 空白 マイナス以外の字`);
      const n = (d.match(/M/g) || []).length;
      if (RINGS_SEEN[k] !== undefined && n !== RINGS_SEEN[k]) p.M1.push(`${k}：環 ${n}（地図帳で名指したのは ${RINGS_SEEN[k]}）`);
    }
    /* M2 重さ：9つの形の字数の和 ≦ 上限・META.bytes ＝ その和 */
    const total = Object.values(S).reduce((a, d) => a + String(d).length, 0);
    if (total > OUTLINE_CEIL) p.M2.push(`形の重さ ${total} バイトが上限 ${OUTLINE_CEIL} を超えた`);
    if (O.META.bytes !== total) p.M2.push(`META.bytes ${O.META.bytes} ≠ 形の字数の和 ${total}`);
    info.M2 = `形の重さ ${total.toLocaleString('en-US')} / ${OUTLINE_CEIL.toLocaleString('en-US')} バイト`;
    /* WP-dmap-4（DM5a）から：PV-DIRMAP の塊（地図 ＋ カード）は1ページ 64,000 バイトまで */
    for (const lang of ['ja', 'en']) {
      const b = blockOf(I.page[lang], 'PV-DIRMAP'), n = b ? Buffer.byteLength(b.text) : null;
      if (n === null) p.M2.push(`${PAGE_REL[lang]}：PV-DIRMAP が無い`);
      else { if (n > DIRMAP_CEIL) p.M2.push(`${PAGE_REL[lang]}：PV-DIRMAP ${n} バイトが上限 ${DIRMAP_CEIL} を超えた`); info.M2 += `・PV-DIRMAP ${lang} ${n.toLocaleString('en-US')}`; }
    }
    /* M3 国の割り振り：会社の国の符号は、その会社の地域の MEMBERS か NO_SHAPE に在る */
    const M = O.MEMBERS || {}, NS = new Set(O.NO_SHAPE || []), inMembers = new Set(Object.values(M).flat());
    const used = new Map();   // 符号 → 地域の集合
    for (const [slug, d] of Object.entries(I.ledger)) { const c = I.country[slug]; if (c) { if (!used.has(c)) used.set(c, new Set()); used.get(c).add(d.region); } }
    for (const [c, rs] of used) for (const r of rs) if (!(M[r] || []).includes(c) && !NS.has(c)) p.M3.push(`${c}（${r} の会社の国）が MEMBERS.${r} にも NO_SHAPE にも無い`);
    for (const c of NS) if (inMembers.has(c)) p.M3.push(`${c} が NO_SHAPE と MEMBERS の両方に在る`);
    for (const c of NS) for (const r of used.get(c) || []) {
      if (![...used].some(([o, rs]) => o !== c && rs.has(r) && (M[r] || []).includes(o))) p.M3.push(`${c}（形が無い）の地域 ${r} に、形のある会社の国がほかに無い`);
    }
    /* M4 目印の点：PROBES 28行・どの形にも1行以上・自分の形の中（点か 2単位となりの4点のどれか）で、ほかの形の中ではない */
    if (!P || !Array.isArray(P.PROBES)) p.M4.push('world-outline-probes.mjs が読めない');
    else {
      const RG = Object.fromEntries(Object.entries(S).map(([k, d]) => [k, ringsOf(d)]));
      const inside = (k, x, y) => !!RG[k] && insideRings(RG[k], x, y);
      const near = (k, x, y) => [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => inside(k, x + dx, y + dy));
      if (P.PROBES.length !== 28) p.M4.push(`PROBES ${P.PROBES.length} 行（28 行のはず）`);
      for (const k of Object.keys(S)) if (!P.PROBES.some((r) => r[0] === k)) p.M4.push(`${k} の目印が1つも無い`);
      for (const [k, x, y, w] of P.PROBES) {
        if (!near(k, x, y)) p.M4.push(`${w}（${x},${y}）が ${k} の形の中に無い`);
        const others = Object.keys(S).filter((o) => o !== k && inside(o, x, y));
        if (others.length) p.M4.push(`${w}（${x},${y}）が ${others.join('・')} の形の中にも在る`);
      }
      const J = O.JAPAN_MARK || {};
      for (const r of regs) {
        const pa = P.POINT_AT?.[r], ca = P.COLOR_AT?.[r];
        if (!pa) p.M4.push(`POINT_AT.${r} が無い`);
        else if (r === 'japan' ? !(Math.hypot(pa[0] - J.cx, pa[1] - J.cy) <= J.rHit) : !inside(r, pa[0], pa[1])) p.M4.push(`POINT_AT.${r}（${pa}）が ${r} に当たらない`);
        if (!ca) p.M4.push(`COLOR_AT.${r} が無い`);
        else if (!inside(r, ca[0], ca[1])) p.M4.push(`COLOR_AT.${r}（${ca}）が ${r} の形の中に無い`);
      }
      const eu = P.COLOR_AT?.europe;
      if (eu && RG.europe) {
        const d = edgeDist(RG.europe, eu[0], eu[1]);
        if (!(d >= EU_CLEAR)) p.M4.push(`COLOR_AT.europe（${eu}）が欧州の縁から ${d.toFixed(2)}（${EU_CLEAR} 以上のはず）`);
        info.M4 = `COLOR_AT.europe は欧州の縁から ${d.toFixed(2)}`;
      }
      const sea = P.SEA || [];
      const wet = Object.keys(S).filter((k) => inside(k, sea[0], sea[1]));
      if (sea.length !== 2 || wet.length) p.M4.push(`SEA（${sea}）が ${wet.join('・') || '—'} の形の中`);
    }
    /* M5 出どころとライセンス：META の4つ・3つのファイルに '/Users/' も 'sources-raw' も無い・.gitignore が sources-raw/ を外す・*.geojson を git に入れない */
    const Me = O.META;
    if (typeof Me.source !== 'string' || !Me.source) p.M5.push('META.source が無い');
    if (Me.licence !== 'public domain') p.M5.push(`META.licence「${Me.licence}」`);
    if (typeof Me.tag !== 'string' || !Me.tag) p.M5.push('META.tag が無い');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(Me.seen))) p.M5.push(`META.seen「${Me.seen}」が YYYY-MM-DD でない`);
    if (!/^[0-9a-f]{64}$/.test(String(Me.sha256))) p.M5.push('META.sha256 が16進64字でない');
    const bad = (s) => ['/Users/', 'sources-raw'].filter((w) => String(s).includes(w));
    for (const [k, v] of Object.entries(Me)) for (const w of bad(v)) p.M5.push(`META.${k} に「${w}」`);
    for (const [name, s] of [['world-outline.mjs', I.map.text.outline], ['world-outline-probes.mjs', I.map.text.probes], ['import-world-outline.mjs', I.map.importer]]) {
      if (!s) p.M5.push(`${name} が無い`);
      for (const w of bad(s)) p.M5.push(`${name} に「${w}」`);
    }
    if (!String(I.map.gitignore).split('\n').some((l) => /^\/?sources-raw\/\s*$/.test(l))) p.M5.push('.gitignore が sources-raw/ を外していない');
    if (!Array.isArray(I.map.files)) p.M5.push('git ls-files が読めない');
    else for (const f of I.map.files.filter((f) => /\.geojson$/i.test(f))) p.M5.push(`${f} が git に入っている`);
  }
  return [...Object.keys(p).map((id) => R(id, p[id], info[id] || '')), ...secMcard(I), ...secMdm3(I), ...secMdm4(I)];
}

/* ── M7〜M14 地域のまとめのカード（PV-DIRMAP）。ページは unbake した字を読む（英語の額は data-orig の円の字に戻る）──── */
/** オーナーの字（日本語）とリードが採った英語（P12.86-3：C-1〜C-5・C-7・C-9）。最低・最高・幅は P12.101 のオーナーの字、
    英語の Lowest / Highest / Range はその候補（リードの決め待ち ── 決まったら directory-map.mjs の WORDS とここを一緒に直す）。
    ここに打った字が正（書き換えに対する杭） */
const MAP_WORD = {
  ja: { k: '公開情報からの推定', def: '掲載{N}社の推定年収の平均', cond: '条件/出典', dt: ['対象', '対象掲載社数', '換算'], go: 'この地域の航空会社を見る',
        lo: '最低', hi: '最高', span: '幅', count: '{N}社', region: '{L} {N}社', group: '職位', hint: '地図をクリックして地域を選択' },
  en: { k: 'Estimate from public information', def: 'Mean of our estimates across {N} airlines', cond: 'Conditions / Sources',
        dt: ['Airlines included', 'Number of airlines', 'Conversion'], go: 'View airlines in this region',
        lo: 'Lowest', hi: 'Highest', span: 'Range', count: '{N}', region: '{L} {N}', group: 'Rank', hint: 'Click the map to choose a region' },
};
/* group ＝「機長｜副操縦士」の組の読み上げの名前（リード P12.112）。hint ＝ 地図の下の一言（いまの一覧の字のまま・directory-data WP-dd-9 の字） */
/** 散らばりの帯の目盛の刻み（P12.104「次の 1,000万の刻みへ」。会社ページの SCALE_STEP と同じであること） */
const MAP_STEP = 1000;
/** 帯の目盛の右端（職位ごと）＝ 帯が描く額（掲載全社の推定 avg）のいちばん大きいものを次の刻みへ。幅の上の額（hi）は帯に描かないので数えない（リード P12.109） */
const axOf = (I) => Object.fromEntries(['cap', 'fo'].map((r) => [r, Math.ceil(Math.max(...Object.values(I.ledger).map((d) => d[r].avg)) / MAP_STEP) * MAP_STEP]));
/** カードに出してはいけない字（A8 e ほか）。最高・最低・highest・lowest は、散らばりの2つの札（span.wam-mm-k）の字としてだけ許す（P12.101） */
const MAP_FORBID = ['確認中', 'Under review', '推計平均', '参考値', '全パイロット', 'パイロットの平均', '地域の平均年収', '1位', '順位', 'ランキング', 'ranking'];
const CUR_EN = await curCore('USD', 'en');
const manOf = (s) => { const m = /^¥([\d,]+)万$/.exec(String(s ?? '').trim()); return m ? num(m[1]) : null; };
const liTexts = (ul) => [...String(ul ?? '').matchAll(/<li>([^<]*)<\/li>/g)].map((m) => unesc(m[1]));
const fill = (t, o) => t.replace(/\{([A-Z])\}/g, (_, k) => String(o[k]));

/** --selftest：地域のまとめの1枚（<section id="wam-p-{code}">）の中だけを差し替える（何も変わらなければ壊し方が当たっていない） */
const onPanel = (I, lang, code, fn) => {
  const re = new RegExp(`<section class="wam-panel[^"]*" data-region="${code}" id="wam-p-${code}">[\\s\\S]*?<\\/section>`);
  const before = I.page[lang]; I.page[lang] = before.replace(re, (c) => fn(c));
  if (I.page[lang] === before) throw new Error(`${lang} の地域のまとめ ${code} が変わらない`);
};

/** カードを読む（パネルごと：定義の行・2行の額・帯2本・条件/出典）。読めない所は null のまま（＝ 赤） */
function readCard(block) {
  const out = {};
  for (const m of String(block).matchAll(/<section class="wam-panel[^"]*" data-region="([a-z]+)" id="wam-p-\1">([\s\S]*?)<\/section>/g)) {
    const t = m[2], P = { raw: t, rows: {}, sp: {} };
    P.def = unesc(/<p class="wam-def">([^<]*)<\/p>/.exec(t)?.[1] ?? '');
    P.k = unesc(/<p class="wam-k">([^<]*)<\/p>/.exec(t)?.[1] ?? '');
    for (const r of t.matchAll(/<p class="wam-row" data-pos="(cap|fo)"[^>]*><span class="wam-rk">([^<]*)<\/span><b class="wam-n">([^<]*)<\/b><\/p>/g)) P.rows[r[1]] = { rk: unesc(r[2]), n: r[3] };
    const cuts = [...t.matchAll(/<div class="wam-sp" data-pos="(cap|fo)">/g)];
    cuts.forEach((c, i) => {
      const end = i + 1 < cuts.length ? cuts[i + 1].index : t.indexOf('<details', c.index);
      const s = t.slice(c.index, end < 0 ? undefined : end);
      const tr = /<div class="wam-track" style="--wam-n:([^"]*)" aria-hidden="true">([\s\S]*?)<\/div>/.exec(s);
      const kids = tr ? tr[2] : '';
      const band = /^<i class="wam-band" style="--a:([^;"]*);--b:([^;"]*)"><\/i>/.exec(kids);
      const mean = /<i class="wam-mean" style="left:([^"]*)"><\/i>$/.exec(kids);
      const side = (k) => { const x = new RegExp(`<div class="wam-${k}"><span class="wam-mm-k">([^<]*)</span><b class="wam-mm-v">([^<]*)</b><ul class="wam-who">([\\s\\S]*?)</ul></div>`).exec(s); return x ? { k: unesc(x[1]), v: x[2], who: liTexts(x[3]) } : null; };
      const w = /<p class="wam-w"><span class="wam-w-k">([^<]*)<\/span><b class="wam-w-v">([^<]*)<\/b><\/p>/.exec(s);
      P.sp[c[1]] = {
        rk: unesc(/<p class="wam-sp-rk">([^<]*)<\/p>/.exec(s)?.[1] ?? ''), n: tr ? tr[1] : null,
        band: band ? { a: band[1], b: band[2] } : null, mean: mean ? mean[1] : null,
        dots: [...kids.matchAll(/<i style="left:([^"]*)"><\/i>/g)].map((d) => d[1]),
        kidsOk: !!tr && /^(<i class="wam-band" style="[^"]*"><\/i>)(<i style="left:[^"]*"><\/i>)*(<i class="wam-mean" style="[^"]*"><\/i>)$/.test(kids),
        ax: /<p class="wam-ax" aria-hidden="true"><span>0<\/span><span>([^<]*)<\/span><\/p>/.exec(s)?.[1] ?? null,
        lo: side('lo'), hi: side('hi'), w: w ? { k: unesc(w[1]), v: w[2] } : null,
      };
    });
    const f = /<details class="wam-cond">([\s\S]*?)<\/details>/.exec(t);
    const sum = f && /<summary>([^<]*)<\/summary>/.exec(f[1]), dl = f && /<dl class="wam-cl">([\s\S]*?)<\/dl>/.exec(f[1]);
    P.cond = sum && dl ? { sum: unesc(sum[1]), dl: dl[1], dt: [...dl[1].matchAll(/<dt>([^<]*)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((d) => ({ dt: unesc(d[1]), dd: d[2] })), raw: f[0] } : null;
    out[m[1]] = P;
  }
  return out;
}

function secMcard(I) {
  const p = { M7: [], M8: [], M9: [], M10: [], M11: [], M12: [], M13: [], M14: [] }, info = {};
  const pg = pagesOf(I), blocks = {}, cards = {};
  for (const lang of ['ja', 'en']) {
    const b = blockOf(pg[lang], 'PV-DIRMAP');
    if (!b) { for (const k of Object.keys(p)) p[k].push(`${PAGE_REL[lang]}：PV-DIRMAP が無い`); continue; }
    blocks[lang] = b.text; cards[lang] = readCard(b.text);
  }
  if (!blocks.ja || !blocks.en) return Object.keys(p).map((id) => R(id, p[id]));
  const order = orderOf(I), codes = ['all', ...REG8];
  const slugsOf = (code) => order.filter((s) => code === 'all' || I.ledger[s].region === code);
  const AX = axOf(I);
  const rowOf = Object.fromEntries(I.list.map((r) => [r.slug, r]));

  for (const lang of ['ja', 'en']) {
    const C = cards[lang], W = MAP_WORD[lang], li = lang === 'ja' ? 0 : 1, rel = PAGE_REL[lang];
    if (!same(Object.keys(C), codes)) p.M7.push(`${rel}：カードの並び ${Object.keys(C).join(',')}／${codes.join(',')}`);
    for (const code of codes) {
      const P = C[code]; if (!P) continue;
      const sl = slugsOf(code), N = sl.length, at = `${rel} ${code}`;
      /* M7 社数・平均・散らばり・対象 */
      const dn = /(\d+)/.exec(P.def)?.[1];
      if (Number(dn) !== N) p.M7.push(`${at}：定義の行の社数 ${dn}／${N}`);
      for (const r of ['cap', 'fo']) {
        const got = manOf(P.rows[r]?.n), want = mean10(I, sl, r);
        if (got !== want) p.M7.push(`${at} ${r}：平均 ${P.rows[r]?.n ?? '（行が無い）'}／${yen(want)}`);
        const S = P.sp[r]; if (!S) { p.M7.push(`${at} ${r}：散らばりが無い`); continue; }
        const vals = sl.map((s) => I.ledger[s][r].avg), lo = Math.min(...vals), hi = Math.max(...vals);
        /* 最低／最高の会社の名前 ＝ 一覧のカードの社名（「対象」と同じ出どころ。1枚のカードの中で1社を2通りに書かない ── リード P12.109） */
        const who = (v) => sl.filter((s) => I.ledger[s][r].avg === v).map((s) => (lang === 'ja' ? rowOf[s]?.name : rowOf[s]?.en));
        if (manOf(S.lo?.v) !== lo) p.M7.push(`${at} ${r}：最低 ${S.lo?.v}／${yen(lo)}`);
        if (manOf(S.hi?.v) !== hi) p.M7.push(`${at} ${r}：最高 ${S.hi?.v}／${yen(hi)}`);
        if (!same(S.lo?.who, who(lo))) p.M7.push(`${at} ${r}：最低の会社 ${S.lo?.who?.join('・')}／${who(lo).join('・')}`);
        if (!same(S.hi?.who, who(hi))) p.M7.push(`${at} ${r}：最高の会社 ${S.hi?.who?.join('・')}／${who(hi).join('・')}`);
        if (manOf(S.w?.v) !== hi - lo) p.M7.push(`${at} ${r}：幅 ${S.w?.v}／${yen(hi - lo)}`);
        /* M10 帯：目盛・最低〜最高の帯・1社に1つの点・平均の印（どれも pv-bars.mjs の checkWidth で、ここで作った目盛に対して） */
        if (Number(S.n) !== AX[r] / MAP_STEP) p.M10.push(`${at} ${r}：--wam-n ${S.n}／${AX[r] / MAP_STEP}`);
        if (!S.kidsOk) p.M10.push(`${at} ${r}：帯の中が「帯・点…・平均の印」の順でない`);
        for (const [k, v, w] of [['帯の左', lo, S.band?.a], ['帯の右', hi, S.band?.b], ['平均の印', manOf(P.rows[r]?.n), S.mean]]) {
          const c = checkWidth(w, v, AX[r]); if (!c.ok) p.M10.push(`${at} ${r}：${k} ${c.why}`);
        }
        const wantDots = vals.map((v) => widthOf(v, AX[r])).sort(), gotDots = S.dots.slice().sort();
        if (!same(gotDots, wantDots)) p.M10.push(`${at} ${r}：点 ${S.dots.length} 個の位置が会社の推定（${N}社）と合わない`);
        if (manOf(S.ax) !== AX[r]) p.M10.push(`${at} ${r}：目盛の右端の字 ${S.ax}／${yen(AX[r])}`);
        /* M11 字（散らばり） */
        if (S.lo?.k !== W.lo || S.hi?.k !== W.hi || S.w?.k !== W.span) p.M11.push(`${at} ${r}：散らばりの札 ${S.lo?.k}/${S.hi?.k}/${S.w?.k}`);
        if (S.rk !== RW[r][lang] || P.rows[r]?.rk !== RW[r][lang]) p.M11.push(`${at} ${r}：職位の字 ${P.rows[r]?.rk}／${RW[r][lang]}`);
      }
      const names = P.cond ? P.cond.dt[0]?.dd : '';
      const ul = /^<ul class="wam-names">([\s\S]*)<\/ul>$/.exec(String(names ?? ''));
      const wantNames = code === 'all'
        ? REG8.map((c) => fill(W.region, { L: REGION_LABEL[c][li], N: slugsOf(c).length }))
        : sl.map((s) => (lang === 'ja' ? rowOf[s]?.name : rowOf[s]?.en));
      if (!ul || !same(liTexts(ul[1]), wantNames)) p.M7.push(`${at}：対象の名前が台帳と違う（${ul ? liTexts(ul[1]).length : 0} 件／${wantNames.length} 件）`);
      if (code !== 'all' && ul) for (const r of ['cap', 'fo']) for (const nm of [...(P.sp[r]?.lo?.who || []), ...(P.sp[r]?.hi?.who || [])]) {
        if (!liTexts(ul[1]).includes(nm)) p.M7.push(`${at} ${r}：最低／最高の会社「${nm}」が同じカードの「対象」と違う字`);
      }
      if (unesc(P.cond?.dt[1]?.dd ?? '') !== fill(W.count, { N })) p.M7.push(`${at}：対象掲載社数「${P.cond?.dt[1]?.dd}」／${fill(W.count, { N })}`);
      /* M11 字（定義・札・条件/出典） */
      if (P.k !== W.k) p.M11.push(`${at}：「${P.k}」／「${W.k}」`);
      if (P.def.replace(/\d+/, () => '{N}') !== W.def) p.M11.push(`${at}：定義の行「${P.def}」`);
      if (!P.cond) p.M11.push(`${at}：条件/出典が読めない`);
      else {
        if (P.cond.sum !== W.cond) p.M11.push(`${at}：「${P.cond.sum}」／「${W.cond}」`);
        if (!same(P.cond.dt.map((d) => d.dt), W.dt) || (P.cond.dl.match(/<dt>/g) || []).length !== 3) p.M11.push(`${at}：条件/出典の見出し ${P.cond.dt.map((d) => d.dt).join('・')}`);
        if (unesc(P.cond.dt[2]?.dd ?? '') !== I.map.fx?.[lang]) p.M11.push(`${at}：換算の文が currency.js と違う`);
        if (/<p[\s>]|<img[\s>]/.test(P.cond.raw)) p.M11.push(`${at}：条件/出典に <p> か <img> が在る`);
        if (P.cond.dt.some((d) => d.dt.includes('時点'))) p.M11.push(`${at}：「時点」を読む見出し`);
      }
    }
    /* M11 ボタン・禁じた字 */
    const B = blocks[lang];
    const go = /<button type="button" class="wam-go is-off" id="wa-go">([^<]*)<\/button>/.exec(B);
    if (!go || unesc(go[1]) !== W.go) p.M11.push(`${rel}：「${go?.[1]}」／「${W.go}」`);
    /* 「機長｜副操縦士」の切り替え（P12.100・リード P12.109）：面（.wam-g）の先頭に1つ・地図の列の前・ボタン2つ・字は行の札と同じ（新しい字を作らない）・
       組の読み上げの名前は「職位」／Rank（リード P12.112）・hidden で出荷（台本が動いたときだけ見せる）・押してある方 ＝ 区域の data-pos（機長）。
       WP-dmap-4 でカードの先頭から面の先頭へ移った（スマホでは地図の上に立つ） */
    const SW = `<div class="wam-pos" role="group" aria-label="${MAP_WORD[lang].group}" hidden><button type="button" class="wam-pb" data-pos="cap" aria-pressed="true">${RW.cap[lang]}</button>`
      + `<button type="button" class="wam-pb" data-pos="fo" aria-pressed="false">${RW.fo[lang]}</button></div>`;
    if (B.split('class="wam-pos"').length !== 2 || !B.includes(`<div class="wam-g">\n${SW}\n<div class="wam-mc">`)) p.M11.push(`${rel}：「機長｜副操縦士」の切り替えが決まりの形でない（${(/<div class="wam-pos"[^\n]*/.exec(B)?.[0] ?? '無い').slice(0, 120)}）`);
    /* 地図の下の一言（いまの一覧の字のまま・WP-dd-9）：1つ・同じ字 */
    const hints = [...B.matchAll(/<p class="wam-hint" aria-hidden="true">([^<]*)<\/p>/g)].map((m) => unesc(m[1]));
    if (hints.length !== 1 || hints[0] !== W.hint || B.split('class="wam-hint"').length !== 2) p.M11.push(`${rel}：地図の下の一言「${hints.join('｜')}」／「${W.hint}」`);
    if (!/<div class="wam" id="wa-map-sec" data-rest="[a-z]+" data-pos="cap">/.test(B)) p.M11.push(`${rel}：区域の data-pos が機長で出ていない（切り替えの押してある方と違う）`);
    const plain = B.replace(/<span class="wam-mm-k">(?:最低|最高|Lowest|Highest)<\/span>/g, () => '');
    for (const w of [...MAP_FORBID, '最高', '最低', 'highest', 'lowest']) if (plain.toLowerCase().includes(w.toLowerCase())) p.M11.push(`${rel}：「${w}」が在る`);
    /* M12 属性に額を書かない・05b の口・狭い画面の決まり */
    for (const t of B.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
      const tag = t[1].toLowerCase(), attrs = [...t[2].matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)="([^"]*)"/g)];
      for (const [, k, v] of attrs) {
        if (k === 'data-axis-jpy' || (tag === 'span' && /class="pv-cur"/.test(t[2]) && (k === 'data-jpy' || k === 'data-orig'))) continue;
        if (tag === 'svg' && k === 'viewBox' && v === '0 0 1000 440') continue;   // 地図の箱の大きさ（額ではない ── WP-dmap-4）
        if (/[万¥$]|\d{4}/.test(v)) p.M12.push(`${rel}：<${tag}> の ${k}="${v.slice(0, 30)}" に額`);
      }
    }
    const rp = /<div id="pv-rp"([^>]*)>([\s\S]*?)<\/div>/.exec(B);
    if (!rp) p.M12.push(`${rel}：#pv-rp が無い`);
    else {
      if (rp[0] !== `<div id="pv-rp" class="pv-rp" data-axis-jpy="${Math.max(AX.cap, AX.fo) * 10000}" hidden></div>`) p.M12.push(`${rel}：#pv-rp が id・class・data-axis-jpy・hidden だけの空の箱でない（${rp[0].slice(0, 90)}）`);
      else if (!/^<div class="wam-slot"><div id="pv-rp"/.test(B.slice(B.indexOf('<div class="wam-slot">')))) p.M12.push(`${rel}：#pv-rp が .wam-slot の中に無い`);
    }
    if (!/<div class="wam" id="wa-map-sec" data-rest="none"/.test(B)) p.M12.push(`${rel}：区域が data-rest="none" で出ていない（P7.4）`);
  }
  /* M10 目盛：会社ページと同じ決め方（刻みが同じ）・05b の口の目盛 */
  if (I.map.view?.SCALE_STEP !== MAP_STEP) p.M10.push(`会社ページの目盛の刻み（pv-airline-view.mjs の SCALE_STEP）${I.map.view?.SCALE_STEP}／一覧の帯 ${MAP_STEP}`);
  info.M10 = `帯の目盛の右端 機長 ${yen(AX.cap)}・副操縦士 ${yen(AX.fo)}（帯が描く推定のいちばん大きいもの・次の 1,000万）`;
  /* M11 日英の骨組み（タグと class の並び。字・<br>・額の span は外す） */
  const skel = (lang) => [...String(blockOf(I.page[lang], 'PV-DIRMAP')?.text ?? '').replace(/<span class="pv-cur"[^>]*>[^<]*<\/span>/g, () => '')
    .matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi)].map((m) => `${m[1]}${m[2].toLowerCase()}.${/class="([^"]*)"/.exec(m[3])?.[1] ?? ''}`).filter((x) => !/^\/?br\./.test(x));
  const sj = skel('ja'), se = skel('en');
  if (!same(sj, se)) { const i = sj.findIndex((x, k) => x !== se[k]); p.M11.push(`日英の骨組みが違う（${i} 番目：${sj[i]}／${se[i]}）`); }
  /* M8 ほかのページが出している額（日本：countries/japan.html・すべての副操縦士：欧州のページ）── 一覧はそれに従う */
  const J = cards.ja;
  const jp = /機長の推定年収の平均が¥([\d,]+)万（[^）]*）、副操縦士が¥([\d,]+)万/.exec(I.map.japan || '');
  if (!jp) p.M8.push('countries/japan.html：日本の機長と副操縦士の平均の文が読めない');
  else {
    if (num(jp[1]) !== manOf(J.japan?.rows.cap?.n)) p.M8.push(`countries/japan.html は日本の機長 ¥${jp[1]}万／一覧 ${J.japan?.rows.cap?.n}`);
    if (num(jp[2]) !== manOf(J.japan?.rows.fo?.n)) p.M8.push(`countries/japan.html は日本の副操縦士 ¥${jp[2]}万／一覧 ${J.japan?.rows.fo?.n}`);
  }
  const eu = /（世界(\d+)社では¥([\d,]+)万）/.exec(I.hub['europe-pilot-salary.html'] || '');
  if (!eu) p.M8.push('europe-pilot-salary.html：「（世界N社では…）」が読めない');
  else {
    if (Number(eu[1]) !== order.length || num(eu[2]) !== manOf(J.all?.rows.fo?.n)) p.M8.push(`europe-pilot-salary.html は世界${eu[1]}社 ¥${eu[2]}万／一覧 すべて ${order.length}社 ${J.all?.rows.fo?.n}`);
  }
  /* M9 会社のカードの額の平均ではなく、推定の平均を出している（違うマスが1つ以上在り、そのマスで一覧はカードの平均を出していない）。
     directory-map.mjs は研究の台帳も乗員全体の額も読まない */
  const cardMan = (s, r) => { const w = want(I, s, r); const m = w.yen ? /([\d,]+)万/.exec(w.yen) : null; return m ? num(m[1]) : I.ledger[s][r].avg; };
  const diff = [];
  for (const code of codes) for (const r of ['cap', 'fo']) {
    const sl = slugsOf(code), cm = Math.round(sl.reduce((a, s) => a + cardMan(s, r), 0) / sl.length / 10) * 10, em = mean10(I, sl, r);
    if (cm !== em) { diff.push(`${code} ${r} ${em}（カード ${cm}）`); for (const lang of ['ja', 'en']) if (manOf(cards[lang][code]?.rows[r]?.n) === cm) p.M9.push(`${PAGE_REL[lang]} ${code} ${r}：カードの額の平均 ${yen(cm)} を出している（推定の平均は ${yen(em)}）`); }
  }
  if (!diff.length) p.M9.push('カードの額の平均と推定の平均が違うマスが1つも無い（この項目が何も確かめていない）');
  info.M9 = `違うマス ${diff.length}：${diff.join(' | ')}`;
  for (const w of ['research-ledger', 'crew']) if (String(I.map.text.map).includes(w)) p.M9.push(`directory-map.mjs に「${w}」`);
  /* M13 英語の額：span を外すと ¥ も 万 も残らない・span の字 ＝ fmt(data-jpy)・data-jpy ＝ data-orig の円 */
  const enB = blockOf(I.page.en, 'PV-DIRMAP')?.text ?? '';
  const spans = [...enB.matchAll(/<span class="pv-cur" data-jpy="(\d+)" data-orig="([^"]*)">([^<]*)<\/span>/g)];
  if (!spans.length) p.M13.push('英語のカードに額の span が1つも無い');
  if (/[¥万]/.test(enB.replace(/<span class="pv-cur"[^>]*>[^<]*<\/span>/g, () => ''))) p.M13.push('英語のカードに span の外の ¥ か 万');
  for (const [, jpy, orig, text] of spans) {
    if (manOf(unesc(orig)) * 10000 !== Number(jpy)) p.M13.push(`data-orig「${orig}」と data-jpy ${jpy} が合わない`);
    if (text !== CUR_EN.fmt(Number(jpy))) p.M13.push(`${orig} の字 ${text}／${CUR_EN.fmt(Number(jpy))}`);
  }
  /* M14 社名は2つのリスト（対象・最低／最高の会社）の <li> の中だけ・そのリストに職位の語を入れない・check-salary.mjs の読み方でカードから読まれる額は0 */
  const K = scanOf(I), aliases = [...new Set(Object.values(I.ledger).flatMap((d) => K.aliases(d)))];
  for (const lang of ['ja', 'en']) {
    const B = blockOf(pg[lang], 'PV-DIRMAP').text, ok = [];
    for (const u of B.matchAll(/<ul class="wam-(?:names|who)">([\s\S]*?)<\/ul>/g)) {
      for (const l of u[0].matchAll(/<li>([^<]*)<\/li>/g)) {
        ok.push([u.index + l.index, u.index + l.index + l[0].length]);
        if (/機長|副操縦士|Captain|First Officer/.test(l[1])) p.M14.push(`${PAGE_REL[lang]}：名前のリストに職位の語（${l[1]}）`);
      }
    }
    for (const a of aliases) for (let i = B.indexOf(a); i >= 0; i = B.indexOf(a, i + 1)) {
      if (!ok.some(([x, y]) => i >= x && i + a.length <= y)) p.M14.push(`${PAGE_REL[lang]}：社名「${a}」が名前のリストの外に在る`);
    }
    const hits = acceptedOf(I, B, K).hits;
    if (hits.length) p.M14.push(`${PAGE_REL[lang]}：check-salary.mjs がカードから ${hits.length} 件の額を会社の額として読む（${hits[0].a}）`);
  }
  return Object.keys(p).map((id) => R(id, p[id], info[id] || ''));
}

/* ── M15・M17 地域のまとめの台本（pv-directory.js の終わりの塊）・地域の9つのボタンの形・ページの終わりの国の帯（WP-dmap-3）──── */
/** 台本の塊に書いてはいけない字（通信・保存・時計・合成した出来事・HTML を書き込む・緑の段 ── S3・RULING M・A8 c） */
const SCRIPT_FORBID = ['fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'supabase', 'dispatchEvent', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'innerHTML', 'wam-t'];
/** 台本が 05b の口（#pv-rp）に触ってよい形はこの3つだけ（中には何も書かない ── S3） */
const MOUNT_OK = ["mount.setAttribute('data-rp-region',", "mount.removeAttribute('data-rp-region')", "mount.getAttribute('data-rp-region')"];
function secMdm3(I) {
  const p = { M15: [], M17: [] }, info = {};
  /* M15 A 台本の塊：禁じた字が無い・「数字＋万」も、カードのどの額（平均・最低・最高・幅・目盛の右端）の数も書いていない・
     mount. は決まった3つの形だけ */
  const js = I.map?.script;
  if (!js) p.M15.push(`pv-directory.js に地図と地域のまとめの塊（「${MAP_SCRIPT}」の行）がちょうど1つ無い`);
  else {
    for (const w of SCRIPT_FORBID) if (js.includes(w)) p.M15.push(`台本に「${w}」`);
    if (/\d\s*万/.test(js)) p.M15.push('台本に「数字＋万」');
    const order = orderOf(I), AX = axOf(I), figs = new Set([AX.cap, AX.fo]);
    for (const code of ['all', ...REG8]) for (const r of ['cap', 'fo']) {
      const sl = order.filter((s) => code === 'all' || I.ledger[s].region === code), vals = sl.map((s) => I.ledger[s][r].avg);
      const lo = Math.min(...vals), hi = Math.max(...vals);
      for (const v of [mean10(I, sl, r), lo, hi, hi - lo]) figs.add(v);
    }
    const nums = new Set((js.match(/\d[\d,]*/g) || []).map((s) => num(s)));
    const hit = [...figs].filter((v) => nums.has(v));
    if (hit.length) p.M15.push(`台本にカードの額の数 ${hit.join('・')}`);
    info.M15 = `カードの額 ${figs.size} 種類のどれも台本の数に無い`;
    for (let i = js.indexOf('mount.'); i >= 0; i = js.indexOf('mount.', i + 1)) {
      if (!MOUNT_OK.some((f) => js.startsWith(f, i))) p.M15.push(`台本が 05b の口に触る形「${js.slice(i, i + 40).split('\n')[0]}」`);
    }
  }
  /* M15 B 地域の9つのボタン（生成した HTML）：style 無し・絵文字の span 無し・span は名前と社数の2つだけ／ページの <style> に地域のボタンの規則が無い／
     押した見た目の規則は pv-directory.css の地図の区域の塊に1つだけ */
  for (const lang of ['ja', 'en']) {
    const h = I.page[lang], rel = PAGE_REL[lang], b = blockOf(h, 'PV-DIR-REGIONS');
    const bs = b ? [...b.text.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)] : [];
    if (bs.length !== 9) p.M15.push(`${rel}：地域のボタンが ${bs.length} 個（9つ）`);
    for (const [, attrs, inner] of bs) {
      const code = /data-region="([^"]*)"/.exec(attrs)?.[1] ?? '?';
      if (/\sstyle=/.test(attrs)) p.M15.push(`${rel} ${code}：ボタンに style`);
      if (!/^\s*class="rstrip-btn"|\sclass="rstrip-btn"/.test(attrs)) p.M15.push(`${rel} ${code}：ボタンの class が rstrip-btn だけでない`);
      if (!/^<span class="rstrip-l">[^<]*<\/span><span class="rstrip-n">\d+<\/span>$/.test(inner)) p.M15.push(`${rel} ${code}：ボタンの中が名前と社数の2つの span でない（${inner.slice(0, 60)}）`);
    }
    /* 見た目を決める規則（.rstrip-btn{ ・ .rstrip-btn.active ・ .region-strip{）。「動きを減らす」の1行が名前を並べて transition:none にするのは見た目を決めない */
    const styles = [...h.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    for (const m of styles.matchAll(/\.rstrip-btn\{|\.rstrip-btn\.active|\.region-strip\{/g)) p.M15.push(`${rel}：ページの <style> に地域のボタンの見た目の規則「${m[0]}」`);
  }
  const css = I.css || '', wa = css.indexOf('/* ── wam:'), wz = css.indexOf('/* ── /wam ── */'), PR = '.rstrip-btn[aria-pressed="true"]{';
  const iPR = css.indexOf(PR);
  if (css.split(PR).length !== 2 || !(wa >= 0 && wa < iPR && iPR < wz)) p.M15.push(`pv-directory.css：押した見た目の規則「${PR}」が ${css.split(PR).length - 1} 個・地図の区域の塊の中に1つであること`);
  /* M17 A 国の帯：「WORLD MAP」の行の次が <!--PV-CBAND-->・どちらもカードの一覧の後ろでフッターの前・#wd-explore の外・
     国のページへのリンク n 本（link-countries.mjs の BANDS のそのページの行）＋ countries.html 1本・行き先はどれも在る */
  for (const lang of ['ja', 'en']) {
    const h = I.page[lang], rel = PAGE_REL[lang], WM = '<!-- ── WORLD MAP', A = '<!--PV-CBAND-->', Z = '<!--/PV-CBAND-->';
    const lines = h.split('\n'), wm = lines.map((l, i) => (l.includes(WM) ? i : -1)).filter((i) => i >= 0);
    if (wm.length !== 1 || !(lines[wm[0] + 1] || '').startsWith(A) || h.split(A).length !== 2 || h.split(Z).length !== 2) { p.M17.push(`${rel}：「${WM}」の行（${wm.length}）の次が国の帯でない・帯が1つでない`); continue; }
    const iW = h.indexOf(WM), iZ = h.indexOf(Z), cards = h.indexOf('<!--/PV-DIR-CARDS-->'), foot = h.indexOf('<footer class="py-10">');
    if (!(cards >= 0 && cards < iW)) p.M17.push(`${rel}：国の帯がカードの一覧より前に在る`);
    if (!(foot > iZ)) p.M17.push(`${rel}：国の帯がフッター（<footer class="py-10">）の前に無い`);
    const ex = divById(h, 'wd-explore');
    if (ex && (ex.text.includes(WM) || ex.text.includes(A))) p.M17.push(`${rel}：#wd-explore の中に国の帯`);
    const row = String(I.map.lc || '').split('\n').filter((l) => l.includes(`rel: '${rel}'`) && l.includes('after: /<!-- ── WORLD MAP'));
    const n = row.length === 1 ? Number(/\bn: (\d+)/.exec(row[0])?.[1]) : NaN;
    if (!Number.isInteger(n)) { p.M17.push(`link-countries.mjs の BANDS に ${rel} の行（WORLD MAP の後ろ）が1つ無い`); continue; }
    const hrefs = [...h.slice(iW, iZ).matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    const ctry = hrefs.filter((x) => /^countries\/[a-z-]+\.html$/.test(x)), hub = hrefs.filter((x) => x === 'countries.html');
    if (ctry.length !== n || new Set(ctry).size !== n || hub.length !== 1 || hrefs.length !== n + 1) p.M17.push(`${rel}：帯のリンク 国 ${ctry.length}・一覧 ${hub.length}・ほか ${hrefs.length - ctry.length - hub.length}（国 ${n} 本 ＋ countries.html 1本）`);
    for (const x of hrefs) { const t = path.posix.join(path.posix.dirname(rel), x); if (!I.map.countries?.has(t)) p.M17.push(`${rel}：帯の行き先 ${t} が無い`); }
    info.M17 = `${info.M17 ? info.M17 + '・' : ''}${rel} 国 ${ctry.length} 本 ＋ 一覧 1本`;
  }
  return Object.keys(p).map((id) => R(id, p[id], info[id] || ''));
}

/* ── M16・M20 地図（WP-dmap-4：点で描く地図・光る層・当たりの層・凡例。古い地図は消えた）──────────────── */
/** 塗る順（あとのものが上）── 当たりの層でも同じ順（あとの地域の陸地が上に来て、自分の答えを持つ） */
const PAINT8 = ['us', 'latam', 'europe', 'africa', 'mideast', 'asia', 'oceania', 'japan'];
const r1 = (v) => Math.round(v * 10) / 10;
const ROW_H = 5.2 * 0.866;
/** 偶奇の数え方（見本 sketch-v4 の式。点がちょうど辺の上にあるときもこの式の答え ── 0 でない巻き数とは辺の上の8点で答えが違う） */
const insideEO = (rings, px, py) => {
  let c = false;
  for (const q of rings) for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, yi] = q[i], [xj, yj] = q[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
/** 形 → 点の列（決まり：行 r の y ＝ r1(2.6 + r × ROW_H)（ROW_H ＝ 5.2 × 0.866 を先に掛けた数）・その行の点 i の x ＝ r1((r が奇数なら 5.2・偶数なら 2.6) + i × 5.2)・
    点 ＝ (x, y) が形の中（偶奇）・1つの行で続く点を「M{x} {y}h{r1((続く数 − 1) × 5.2 + 0.1)}」の1本に）。directory-map.mjs を読まずにここで作る */
const RUNS = new Map();   // 形の字 → 点の列（同じ形を何度も作り直さない ── --selftest は行ごとに M を流す）
const runsOf = (d) => {
  if (RUNS.has(d)) return RUNS.get(d);
  const rs = ringsOf(d); let out = '';
  for (let r = 0; r1(2.6 + r * ROW_H) < 440; r++) {
    const y = r1(2.6 + r * ROW_H), xs = [];
    for (let i = 0; r1((r % 2 ? 5.2 : 2.6) + i * 5.2) < 1000; i++) { const x = r1((r % 2 ? 5.2 : 2.6) + i * 5.2); if (insideEO(rs, x, y)) xs.push(i); }
    for (let k = 0; k < xs.length;) { let e = k; while (e + 1 < xs.length && xs[e + 1] === xs[e] + 1) e++; out += `M${r1((r % 2 ? 5.2 : 2.6) + xs[k] * 5.2)} ${y}h${r1((e - k) * 5.2 + 0.1)}`; k = e + 1; }
  }
  RUNS.set(d, out);
  return out;
};
/** pv-directory.css の地図の塊（印の間）。印が1組でなければ null */
const mapCssOf = (css) => { const a = String(css).split('/* ── wam-map ── */'), z = String(css).split('/* ── /wam-map ── */'); return a.length === 2 && z.length === 2 && a[1].includes('/* ── /wam-map ── */') ? a[1].slice(0, a[1].indexOf('/* ── /wam-map ── */')) : null; };
/** 規則（セレクタ → 中身）。@media / @container の中も1つずつ */
const rulesOf = (css) => [...String(css).replace(/\/\*[\s\S]*?\*\//g, () => '').matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
function secMdm4(I) {
  const p = { M16: [], M20: [] }, info = {};
  const O = I.map?.outline, J = O?.JAPAN_MARK || {};
  /* ── M16 B 地図の形（静的）── */
  const css = mapCssOf(I.css);
  if (!O?.SHAPES) p.M16.push('world-outline.mjs が読めない');
  for (const lang of ['ja', 'en']) {
    const rel = PAGE_REL[lang], b = blockOf(I.page[lang], 'PV-DIRMAP'), B = b ? b.text : '';
    if (!b) { p.M16.push(`${rel}：PV-DIRMAP が無い`); continue; }
    const SVG = '<svg class="wam-svg" viewBox="0 0 1000 440" aria-hidden="true" focusable="false">';
    if (B.split('<svg').length !== 2 || !B.includes(`<div class="wam-mc">\n<div class="wam-map" id="wa-map">\n${SVG}\n`)) { p.M16.push(`${rel}：地図の svg が1つ・.wam-mc > .wam-map#wa-map の中でない`); continue; }
    const s = B.slice(B.indexOf(SVG), B.indexOf('</svg>') + 6);
    for (const w of ['tabindex', '<a ', '<a>', '<text']) if (s.includes(w)) p.M16.push(`${rel}：地図に「${w}」`);
    for (const w of ['is-on', 'is-hot']) if (B.includes(w)) p.M16.push(`${rel}：出荷する塊に「${w}」（光るのは台本が付けたときだけ）`);
    if (B.includes('wam-lbl')) p.M16.push(`${rel}：地図に地域の名前の札（.wam-lbl）が在る（P12.99：大陸の名前は地図に書かない）`);
    for (const t of s.matchAll(/<path\b([^>]*)>/g)) if (/\s(fill|stroke|style)=/.test(t[1])) p.M16.push(`${rel}：<path> に fill / stroke / style（${t[1].slice(0, 50)}）`);
    /* 点：どこにも入れない陸地 ＋ 8地域の d ＝ 形からここで作り直した点の列（見本と同じ格子・丸ごとの点だけ） */
    const nl = /<g class="wam-nl"><path id="wam-d-neutral" d="([^"]*)"\/><\/g>/.exec(s);
    if (!nl) p.M16.push(`${rel}：どこにも入れない陸地の点（g.wam-nl）が無い`);
    else if (O?.SHAPES && nl[1] !== runsOf(O.SHAPES.neutral)) p.M16.push(`${rel}：どこにも入れない陸地の点が形と合わない`);
    const regs = [...s.matchAll(/<g class="wam-r" data-region="([a-z]+)" style="--c:[^;"]*;--f:[^;"]*"><path class="wam-land" id="wam-d-\1" d="([^"]*)"\/><\/g>/g)];
    if (!same(regs.map((m) => m[1]), PAINT8) || (s.match(/class="wam-r[ "]/g) || []).length !== 8) p.M16.push(`${rel}：地域の <g> が塗る順の8つちょうどでない（${regs.map((m) => m[1]).join(',')}）`);
    for (const m of regs) if (O?.SHAPES && m[2] !== runsOf(O.SHAPES[m[1]])) p.M16.push(`${rel}：${m[1]} の点が形と合わない`);
    /* 当たりの層：日本の丸2つが先・どこにも入れない陸地（答えなし）・8地域。光る層 g.wam-ol は svg のいちばん後ろの子で、<use> と日本の輪は全部その中 */
    const HL = ['<g class="wam-hl">', `<circle class="wam-hit wam-hit-t" data-region="japan" cx="${J.cx}" cy="${J.cy}" r="${J.rTouch}"/>`,
      `<circle class="wam-hit" data-region="japan" cx="${J.cx}" cy="${J.cy}" r="${J.rHit}"/>`, '<use class="wam-hit wam-hit-n" href="#wam-d-neutral"/>',
      ...PAINT8.map((r) => `<use class="wam-hit" data-region="${r}" href="#wam-d-${r}"/>`), '</g>'].join('\n');
    const OL = ['<g class="wam-ol">', ...PAINT8.map((r) => `<g class="wam-o" data-region="${r}"><use class="wam-halo" href="#wam-d-${r}"/><use class="wam-lit" href="#wam-d-${r}"/>${r === 'japan' ? `<circle class="wam-ring" cx="${J.cx}" cy="${J.cy}" r="${J.rRing}"/>` : ''}</g>`), '</g>', '</svg>'].join('\n');
    if (!s.includes(`\n${HL}\n${OL}`) || !s.endsWith(OL)) p.M16.push(`${rel}：当たりの層（g.wam-hl）と光る層（g.wam-ol ＝ svg の最後の子）が決まりの形でない`);
    if ((s.match(/<use\b/g) || []).length !== 1 + 8 + 16) p.M16.push(`${rel}：<use> が ${(s.match(/<use\b/g) || []).length} 個（当たり 9 ＋ 光る層 16）`);
    /* 台本なし：地図・凡例・一言を出さない（押しても何も起きない地図を出さない ── A38） */
    const ns = /<noscript><style>([^{]*)\{display:none!important\}/.exec(B);
    if (!ns || !['.wam-map', '.wam-key', '.wam-hint'].every((c) => ns[1].split(',').includes(c))) p.M16.push(`${rel}：塊の <noscript> の規則が .wam-map・.wam-key・.wam-hint を隠していない`);
    /* DM5b：古い地図は消えた（directory-data の <head> の noscript の字 '.map-wrapper,' は数えない ── A27） */
    for (const w of ['world-svg', 'map-tooltip', 'pulse-ring', 'pin-group', 'id="f-', 'class="map-wrapper"']) if (I.page[lang].includes(w)) p.M16.push(`${rel}：古い地図の「${w}」が残っている`);
  }
  const js = I.assets?.['pv-directory.js'] || '';
  for (const w of ['oldMap', 'map-tooltip']) if (js.includes(w)) p.M16.push(`pv-directory.js に古い地図の「${w}」`);
  if (/\.wam-[a-z-]+\s*\{/.test(I.map?.importer || '')) p.M16.push('import-world-outline.mjs に地図の規則（.wam-…{）が残っている（D25：見た目は pv-directory.css の1か所）');
  if (css === null) p.M16.push('pv-directory.css に地図の塊（/* ── wam-map ── */ … /* ── /wam-map ── */）が1組無い');
  else {
    if (!(I.css.indexOf('/* ── /wam-map ── */') < I.css.indexOf('.wam-slot{'))) p.M16.push('地図の塊が .wam-slot{ の前に無い');
    for (const h of css.match(/#[0-9a-fA-F]{3,8}\b/g) || []) if (h.toLowerCase() !== '#fff') p.M16.push(`地図の塊に色の直書き ${h}`);
    if (/transition:\s*all/.test(css)) p.M16.push('地図の塊に transition:all');
    if (/filter|drop-shadow/.test(css)) p.M16.push('地図の塊に filter / drop-shadow（光は前もって描いた層の opacity だけ ── P12.102）');
    const R = rulesOf(css);
    for (const r of R) {
      if (/:hover/.test(r.sel) && /\.wam-(r|o|hit|hl|land)\b/.test(r.sel)) p.M16.push(`地図の形に :hover の規則（${r.sel}）── 指した見た目は台本の is-hot だけ`);
      if (/\.wam-land\b/.test(r.sel) && /(^|;)\s*(fill|stroke)[a-z-]*\s*:/.test(r.body)) p.M16.push(`.wam-land を名指す規則が塗りを決めている（${r.sel}）── D10`);
      for (const t of r.body.matchAll(/transition:([^;]*)/g)) if (!/^\s*(none|opacity|transform)\b/.test(t[1]) || /,/.test(t[1])) p.M16.push(`地図の塊の transition が opacity / transform だけでない（${r.sel}）`);
    }
    if (!/@media \(prefers-reduced-motion:reduce\)\{\.wam-halo,\.wam-lit,\.wam-ring\{transition:none\}\}/.test(css)) p.M16.push('光る層の「動きを減らす」の規則が無い');
  }
  info.M16 = O?.SHAPES ? `点 ${Object.values(O.SHAPES).reduce((a, d) => a + [...runsOf(d).matchAll(/h([\d.]+)/g)].reduce((x, m) => x + Math.round((Number(m[1]) - 0.1) / 5.2) + 1, 0), 0)} 個（9つの形）` : '';

  /* ── M20 A 濃さと凡例 ＝ カードに出している数（8地域の平均）。台本は濃さに触らない ── */
  const pg = pagesOf(I);
  for (const lang of ['ja', 'en']) {
    const rel = PAGE_REL[lang], b = blockOf(pg[lang], 'PV-DIRMAP');
    if (!b) { p.M20.push(`${rel}：PV-DIRMAP が無い`); continue; }
    const C = readCard(b.text), N = (code, r) => manOf(C[code]?.rows[r]?.n);
    const span = Object.fromEntries(['cap', 'fo'].map((r) => { const v = REG8.map((c) => N(c, r)); return [r, v.every((x) => typeof x === 'number') ? [Math.min(...v), Math.max(...v)] : null]; }));
    for (const r of ['cap', 'fo']) if (!span[r] || !(span[r][1] > span[r][0])) p.M20.push(`${rel} ${r}：8地域の平均が読めない`);
    const gs = Object.fromEntries([...b.text.matchAll(/<g class="wam-r" data-region="([a-z]+)" style="--c:([^;"]*);--f:([^;"]*)">/g)].map((m) => [m[1], { cap: m[2], fo: m[3] }]));
    for (const code of REG8) for (const r of ['cap', 'fo']) {
      const got = gs[code]?.[r], sp = span[r], n = N(code, r);
      if (!sp || typeof n !== 'number') continue;
      const want = Math.round(((n - sp[0]) / (sp[1] - sp[0])) * 100) / 100;
      if (got === undefined || !/^(0|1|0\.\d{1,2})$/.test(got) || Number(got) !== want) p.M20.push(`${rel} ${code}：${r === 'cap' ? '--c' : '--f'}「${got}」／カードの ${yen(n)} から ${want}（${yen(sp[0])}〜${yen(sp[1])}）`);
    }
    if ((b.text.match(/class="wam-r[ "]/g) || []).length !== 8 || Object.keys(gs).length !== 8) p.M20.push(`${rel}：濃さを持つ地域の <g> が8つでない`);
    if (/<g class="wam-nl"[^>]*style=/.test(b.text)) p.M20.push(`${rel}：どこにも入れない陸地に濃さ`);
    /* 凡例：選べる職位ごとに1行・いちばん低い平均〜高い平均の額だけ（字も順位も持たない） */
    const keys = [...b.text.matchAll(/<p class="wam-key" data-pos="(cap|fo)" aria-hidden="true"><span>([^<]*)<\/span><i class="wam-kb"><\/i><span>([^<]*)<\/span><\/p>/g)];
    if (!same(keys.map((k) => k[1]), ['cap', 'fo']) || b.text.split('class="wam-key"').length !== 3) p.M20.push(`${rel}：凡例が職位ごとの2行（機長・副操縦士）でない`);
    for (const [, r, lo, hi] of keys) if (span[r] && (manOf(lo) !== span[r][0] || manOf(hi) !== span[r][1])) p.M20.push(`${rel} ${r}：凡例 ${lo}〜${hi}／8地域の平均 ${yen(span[r][0])}〜${yen(span[r][1])}`);
  }
  if (css !== null) {
    const R = rulesOf(css), has = (sel, body) => R.some((r) => r.sel === sel && r.body.replace(/\s/g, () => '') === body);
    if (!has('.wam[data-pos="cap"] .wam-r', '--t:var(--c)') || !has('.wam[data-pos="fo"] .wam-r', '--t:var(--f)')) p.M20.push('pv-directory.css：区域の data-pos が --c（機長）／--f（副操縦士）を選ぶ2つの規則が無い');
    if (!has('.wam[data-pos="cap"] .wam-key[data-pos="cap"],.wam[data-pos="fo"] .wam-key[data-pos="fo"]', 'display:inline-flex')) p.M20.push('pv-directory.css：凡例が選んだ職位の行だけを見せる規則が無い');
    const wr = R.find((r) => r.sel === '.wam-r');
    if (!wr || !/stroke:color-mix\(in oklab,var\(--wam-hi\) calc\(var\(--t,\.5\) \* 100%\),var\(--wam-lo\)\)/.test(wr.body)) p.M20.push('pv-directory.css：地域の点の色が --wam-lo 〜 --wam-hi を --t で混ぜていない');
    const tk = (sel) => R.find((r) => r.sel === sel)?.body || '';
    if (!/--wam-lo:var\(--pv-accent-line\)/.test(tk('.wam')) || !/--wam-hi:var\(--pv-accent-dark\)/.test(tk('.wam')) || !/--wam-hi:var\(--pv-teal\)/.test(tk('[data-theme="dark"] .wam'))) p.M20.push('pv-directory.css：濃さの両端がサイトの緑（--pv-accent-line → --pv-accent-dark・ダークは --pv-teal）でない');
    const nlr = tk('.wam-nl');
    if (!nlr || /accent|--wam-/.test(nlr)) p.M20.push('pv-directory.css：どこにも入れない陸地の点が灰色でない（緑の濃さを持たない）');
  }
  const sc = I.map?.script || '';
  for (const w of ['--c', '--f', 'setProperty', '.style', 'wam-t']) if (sc.includes(w)) p.M20.push(`台本に「${w}」（台本は地図の濃さに触らない）`);
  return Object.keys(p).map((id) => R(id, p[id], info[id] || ''));
}

const SECTIONS = { A: secA, B: secB, C: secC, D: secD, E: secE, F: secF, G: secG, H: secH, W: secW, L: secL, M: secM };
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
  /* #wd-explore の始まりを見出しの帯の前へ ＝ 検索欄が「探す前だけ見せる」側に入る
     （WP-dmap-3 で国の帯がページの終わりへ移った ── #wd-explore の先頭は地域のまとめの印。壊し方は同じ） */
  ['G3b', (I) => { I.page.ja = sub(sub(I.page.ja, '<div id="wd-explore">\n<!--PV-DIRMAP-->', '<!--PV-DIRMAP-->'), '<!-- ── HERO', '<div id="wd-explore">\n<!-- ── HERO'); }, 'G', ['G3']],
  ['G4a', (I) => { I.page.en = sub(I.page.en, 'tabindex="-1">All</h2>', 'tabindex="-1">All airlines</h2>'); }, 'G', ['G4']],
  ['G4b', (I) => { I.page.en = sub(I.page.en, ' data-fmt-one="{n} airline"', ''); }, 'G', ['G4']],
  ['G5', (I) => { I.page.ja = sub(I.page.ja, NOSCRIPT, ''); }, 'G', ['G5']],
  /* transition:all は G6（PV-DIR-DATA の決まり）と G8（2枚のページ・pv-directory.css の全体・台本）の両方が見る（WP-dd-9 から G8 も赤） */
  ['G6a', (I) => { I.css = sub(I.css, '.wd-rh-name:focus{outline:none}', '.wd-rh-name:focus{outline:none;transition:all .2s}'); }, 'G', ['G6', 'G8']],
  ['G6b', (I) => { I.css = sub(I.css, '.wd-rh-name:focus{outline:none}', '.wd-rh-name:focus{outline:none;transition:color .2s}'); }, 'G', ['G6']],
  ['G6c', (I) => { I.css = sub(I.css, '.wd-search-in::placeholder{color:var(--pv-ink-3)}', '.wd-search-in::placeholder{color:#64748b}'); }, 'G', ['G6']],
  ['G6d', (I) => { I.css = sub(I.css, '.wd-search-in::placeholder{color:var(--pv-ink-3)}', '.wd-search-in::placeholder{color:var(--pv-ink-9)}'); }, 'G', ['G6']],
  ['G6e', (I) => { I.css = sub(I.css, '/* /PV-DIR-DATA */', '.wd-search-in::-webkit-search-cancel-button{display:none}\n/* /PV-DIR-DATA */'); }, 'G', ['G6']],
  /* 消すボタンの規則から「マウスの画面だけ」を外す（指の画面でも隠れる）／「地域の札が出ている時だけ」を外す（札が無くても隠れる） */
  ['G6f', (I) => { I.css = sub(I.css, CANCEL_RULE, '.wd-search:has(.wd-scope:not([hidden])) .wd-search-in::-webkit-search-cancel-button{display:none}'); }, 'G', ['G6']],
  ['G6g', (I) => { I.css = sub(I.css, CANCEL_RULE, '@media (hover:hover) and (pointer:fine){.wd-search-in::-webkit-search-cancel-button{display:none}}'); }, 'G', ['G6']],
  /* 「欄が空の時だけ」を外す（字が入っていても、指の画面でも × が出ない） */
  ['G6h', (I) => { I.css = sub(I.css, CANCEL_RULES[1], '.wd-search-in::-webkit-search-cancel-button{display:none}'); }, 'G', ['G6']],
  ['G7', (I) => { I.page.en = sub(I.page.en, '<p id="wd-none">No airlines matched your search</p>', '<p id="wd-none">No airlines found</p>'); }, 'G', ['G7']],
  ['G7b', (I) => { I.page.ja = sub(I.page.ja, '<span class="wd-else" id="wd-else">', '<span class="wd-else">'); }, 'G', ['G7']],
  /* G8：ページの <style> に transition:all／英語のページの部品に class transition-all／動かす物の名前の無い transition（＝ all） */
  ['G8a', (I) => { I.page.ja = sub(I.page.ja, 'color:#6b7d93;cursor:pointer;transition:transform .2s var(--pv-ease);white-space:nowrap}\n.ftype-btn.active', 'color:#6b7d93;cursor:pointer;transition:all .2s;white-space:nowrap}\n.ftype-btn.active'); }, 'G', ['G8']],
  ['G8b', (I) => { I.page.en = sub(I.page.en, '<div class="search-wrap">', '<div class="search-wrap transition-all">'); }, 'G', ['G8']],
  ['G8c', (I) => { I.page.ja = sub(I.page.ja, 'background:transparent;color:#6b7d93;cursor:pointer;transition:transform .2s var(--pv-ease)', 'background:transparent;color:#6b7d93;cursor:pointer;transition:.2s'); }, 'G', ['G8']],
  ['G8d', (I) => { I.page.en = sub(I.page.en, '.view-btn:active{transform:scale(.97)}', '.view-btn:active{transform:scale(.97);transition:opacity .2s,all .3s}'); }, 'G', ['G8']],
  /* G9：テーマを読む1行を try の外へ（pv-directory.js）／ページの頭のテーマの1行から try を外す／テーマを書く1行から try を外す（リードが見つけた形） */
  ['G9a', (I) => { I.assets['pv-directory.js'] = sub(I.assets['pv-directory.js'], "  try {\n    applyThemeW(localStorage.getItem('pv-theme')||'light');\n  } catch (e) { applyThemeW('light'); }", "  applyThemeW(localStorage.getItem('pv-theme')||'light');"); }, 'G', ['G9']],
  ['G9b', (I) => { I.page.ja = sub(I.page.ja, "<script>(function(){try{var t=localStorage.getItem('pv-theme')||'light';}catch(e){t='light';}", "<script>(function(){var t=localStorage.getItem('pv-theme')||'light';"); }, 'G', ['G9']],
  ['G9c', (I) => { I.assets['pv-directory.js'] = sub(I.assets['pv-directory.js'], "try { localStorage.setItem('pv-theme',t); } catch (e) {}", "localStorage.setItem('pv-theme',t);"); }, 'G', ['G9']],
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
  /* M) 地図と地域のまとめ（directory-map）── 輪郭（M1〜M5） */
  ['M1', (I) => { const x = ' M0 0l1 0l0 1z'; I.map.outline.SHAPES.neutral += x; I.map.outline.META.bytes += x.length; }, 'M', ['M1']],
  ['M2', (I) => { I.map.outline.META.bytes += 1; }, 'M', ['M2']],
  /* DM5a：PV-DIRMAP の塊が 64,000 バイトを超える */
  ['M2b', (I) => { I.page.ja = sub(I.page.ja, '<!--PV-DIRMAP-->\n', `<!--PV-DIRMAP-->\n<!--${'x'.repeat(70000)}-->\n`); }, 'M', ['M2']],
  ['M3', (I) => { const M = I.map.outline.MEMBERS; M.europe = M.europe.filter((c) => c !== 'TR'); M.mideast.push('TR'); }, 'M', ['M3']],
  ['M4', (I) => { const r = I.map.probes.PROBES.find((x) => x[3] === 'Paris'); r[0] = 'asia'; }, 'M', ['M4']],
  /* A30：Kyiv は欧州の縁から 5.4 単位（選んだときの外枠の線にかかる） */
  ['M4b', (I) => { I.map.probes.COLOR_AT.europe = [570, 69]; }, 'M', ['M4']],
  /* 手元の絶対パスの形（字を分けて書く ── 1つの字で書くと assert-no-pii.mjs がこのファイルそのものを止める） */
  ['M5', (I) => { I.map.outline.META.home = ['', 'Users', 'x', 'sources-raw', 'natural-earth'].join('/'); }, 'M', ['M5']],
  /* M) 地域のまとめのカード（M7〜M14） */
  ['M7', (I) => onPanel(I, 'ja', 'japan', (c) => sub(c, '掲載26社', '掲載27社')), 'M', ['M7']],
  ['M7b', (I) => onPanel(I, 'ja', 'europe', (c) => sub(c, '<b class="wam-mm-v">¥1,300万</b>', '<b class="wam-mm-v">¥1,310万</b>')), 'M', ['M7']],
  ['M7c', (I) => onPanel(I, 'ja', 'europe', (c) => c.replace(/(<div class="wam-hi">[\s\S]*?<ul class="wam-who"><li>)[^<]*/, (_, a) => a + SALARY.aegean.ja)), 'M', ['M7']],
  /* A36：日本のページの文の1つ目（<head> の説明ではなく本文の文）を直す */
  ['M8', (I) => { I.map.japan = I.map.japan.replace('機長の推定年収の平均が¥1,850万（', () => '機長の推定年収の平均が¥1,860万（'); }, 'M', ['M8']],
  /* 中東の機長をカードの額の平均（¥2,780万）で描き直す（平均の印もそれに合わせる）── 数が台帳と違う（M7）・カードの平均を出している（M9）・
     地図の中東の濃さ（--c）が出ている数と合わなくなる（M20 ── WP-dmap-4 から。A35 a：{M7, M9} → {M7, M9, M20}） */
  ['M9', (I) => onPanel(I, 'ja', 'mideast', (c) => sub(sub(c, '<b class="wam-n">¥3,030万</b>', '<b class="wam-n">¥2,780万</b>'),
    `<i class="wam-mean" style="left:${widthOf(3030, axOf(I).cap)}">`, `<i class="wam-mean" style="left:${widthOf(2780, axOf(I).cap)}">`)), 'M', ['M7', 'M9', 'M20']],
  ['M10', (I) => onPanel(I, 'ja', 'europe', (c) => c.replace(/(<div class="wam-sp" data-pos="cap">[\s\S]*?<i class="wam-band" style="--a:[^;]*;--b:)[^"]*/, (_, a) => `${a}52.00%`)), 'M', ['M10']],
  ['M10b', (I) => { I.map.view.SCALE_STEP = 500; }, 'M', ['M10']],
  ['M11', (I) => onPanel(I, 'ja', 'europe', (c) => sub(c, '</dl>\n</details>', '</dl>\n<p class="wam-note">x</p>\n</details>')), 'M', ['M11']],
  ['M12', (I) => onPanel(I, 'ja', 'europe', (c) => sub(c, '<p class="wam-row" data-pos="cap">', '<p class="wam-row" data-pos="cap" title="¥2,600万">')), 'M', ['M12']],
  ['M13', (I) => onPanel(I, 'en', 'europe', (c) => c.replace(/<span class="pv-cur" data-jpy="\d+" data-orig="([^"]*)">[^<]*<\/span>/, (_, o) => o)), 'M', ['M13']],
  ['M14', (I) => onPanel(I, 'ja', 'europe', (c) => sub(c, '<h2 class="wam-h">欧州</h2>', `<h2 class="wam-h">欧州 ${SALARY.lufthansa.ja}</h2>`)), 'M', ['M14']],
  /* 「機長｜副操縦士」の切り替え：字を書き換える／hidden を外す（台本が動かないときに押しても何も起きないボタンが出る）── WP-dmap-3 */
  ['M11b', (I) => onBlock(I, 'ja', 'PV-DIRMAP', (b) => sub(b, 'aria-pressed="false">副操縦士</button>', 'aria-pressed="false">副操縦士の平均</button>')), 'M', ['M11']],
  ['M11c', (I) => onBlock(I, 'en', 'PV-DIRMAP', (b) => sub(b, '<div class="wam-pos" role="group" aria-label="Rank" hidden>', '<div class="wam-pos" role="group" aria-label="Rank">')), 'M', ['M11']],
  /* 組の読み上げの名前（リード P12.112）を消す／地図の下の一言を書き換える（WP-dmap-4） */
  ['M11d', (I) => onBlock(I, 'ja', 'PV-DIRMAP', (b) => sub(b, ' aria-label="職位"', '')), 'M', ['M11']],
  ['M11e', (I) => onBlock(I, 'en', 'PV-DIRMAP', (b) => sub(b, '>Click the map to choose a region</p>', '>Click to choose</p>')), 'M', ['M11']],
  /* 台本の塊（M15 A）：保存領域・05b の口に書き込む・カードの額の数（欧州の機長の最低 ¥1,300万） */
  ['M15', (I) => { I.map.script += "\nlocalStorage.getItem('x');"; }, 'M', ['M15']],
  ['M15b', (I) => { I.map.script += "\nmount.setAttribute('hidden','');"; }, 'M', ['M15']],
  ['M15e', (I) => { I.map.script += "\nvar v = '1,300';"; }, 'M', ['M15']],
  /* 地域のボタンの形（M15 B）：生成した HTML に style／押した見た目の規則を2つ目 */
  ['M15c', (I) => onBlock(I, 'ja', 'PV-DIR-REGIONS', (b) => sub(b, 'data-region="japan" data-rc', 'data-region="japan" style="--rc:#3d9bff" data-rc')), 'M', ['M15']],
  ['M15d', (I) => { I.css = sub(I.css, '/* ── /wam ── */', '#region-strip .rstrip-btn[aria-pressed="true"]{color:var(--rc)}\n/* ── /wam ── */'); }, 'M', ['M15']],
  /* 地図の形（M16 B）：点の path に fill を書く／欧州の点の列を1本消す（形と合わない点の地図）── 日英どちらも同じ形に直す */
  ['M16', (I) => { I.page.ja = I.page.ja.replace(/(<path class="wam-land" id="wam-d-europe")/, (_, a) => `${a} fill="#fff"`); }, 'M', ['M16']],
  ['M16b', (I) => { for (const lang of ['ja', 'en']) I.page[lang] = I.page[lang].replace(/(id="wam-d-europe" d=")M[\d.]+ [\d.]+h[\d.]+/, (_, a) => a); }, 'M', ['M16']],
  /* 地図の濃さと凡例（M20 A）：欧州の機長の濃さを書き換える（日英とも）／凡例の機長のいちばん高い額を書き換える */
  ['M20', (I) => { for (const lang of ['ja', 'en']) I.page[lang] = sub(I.page[lang], 'data-region="europe" style="--c:0.42;', 'data-region="europe" style="--c:0.43;'); }, 'M', ['M20']],
  ['M20b', (I) => { I.page.ja = sub(I.page.ja, '<i class="wam-kb"></i><span>¥4,110万</span>', '<i class="wam-kb"></i><span>¥4,120万</span>'); }, 'M', ['M20']],
  /* 国の帯（M17）：1つのリンクを消す／帯を #wd-explore の中（動かす前の場所）へ戻す */
  ['M17', (I) => { I.page.ja = sub(I.page.ja, '<a href="countries/ireland.html">🇮🇪 アイルランド<i>2社</i></a>', ''); }, 'M', ['M17']],
  ['M17b', (I) => {
    const h = I.page.ja, Z = '<!--/PV-CBAND-->\n', s = h.lastIndexOf('\n', h.indexOf('<!-- ── WORLD MAP')) + 1, e = h.indexOf(Z) + Z.length;
    I.page.ja = sub(h.slice(0, s) + h.slice(e), '<div id="wd-explore">\n', `<div id="wd-explore">\n${h.slice(s, e)}`);
  }, 'M', ['M17']],
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
